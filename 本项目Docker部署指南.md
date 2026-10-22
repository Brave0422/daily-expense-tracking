# Daily Expense Tracking：使用 Docker 部署到 Ubuntu 云服务器

本文面向会开发前后端、能运行本项目，但第一次使用 Docker、还不熟悉服务器运维的程序员。每个操作小节先说明前提和新参数，再给命令，最后说明应该看到的结果；你不需要预先知道 build、push、端口映射或证书续期的含义。

本文对应当前 `daily-expense-tracking` 仓库，参照[本项目 Ubuntu 部署指南](本项目Ubuntu部署指南.md)编写 Docker 版本，按“本地准备 → 本地验证 → 构建、打标签并推送镜像 → 云端拉取和启动 → 验收 → 备份与更新”展开。本次文档整理日期：**2026-10-21**。示例发布标签只表示版本名，并非要求使用该日期。

默认是一台全新的 **Ubuntu 24.04 LTS 64 位 UEFI 版** 云服务器，包含 24.04.x 维护版本，部署 Web、NestJS API、MySQL。Windows/macOS 使用 Docker Desktop；云服务器使用 Docker Engine 和 Compose 插件。本教程提供需要新建的完整配置样例，**当前仓库尚未内置这些 Docker 配置**；照着操作时才创建它们。本文编写期间没有实际构建镜像或连接你的云服务器，上线前须逐节验证。

**想部署本仓库，按本文操作即可。** [全栈项目 Docker 部署教程](全栈项目Docker部署教程.md)用来理解通用原理和迁移到其他项目，不需要把两篇的命令交叉执行。

## 0. 先看从 0 到 1 的完整部署流程

部署的目标是：别人输入你的域名，就能通过 HTTPS 使用记账网页；网页请求能到达 API，账本保存在数据库里，更新程序后数据仍在。

先按下面的主线走一遍，不需要一开始就理解所有 Docker 参数。**第 1～2 节用于理解结构，第 3～11 节是首次上线主线，第 13 节让上线后的数据有备份。** 已有账本要迁移时，先读第 12 节，再决定何时正式对外开放。第 14～17 节后续按需查阅。

| 顺序 | 在哪里做 | 具体做什么 | 这一步的作用 | 完成标志 / 对应章节 |
| --- | --- | --- | --- | --- |
| 1 | 本地电脑、云平台 | 准备源码、Ubuntu 服务器、公网 IP、域名、SMTP 发信邮箱和镜像仓库账号 | 备齐应用运行、外网访问和发验证码所需的资源 | 知道所有真实值；参见第 2、8 节 |
| 2 | 本地电脑；服务器只查架构 | 安装 Docker Desktop，确认引擎可用和服务器 CPU 架构 | 让电脑能构建容器镜像，并保证镜像能在目标服务器运行 | Client/Server 正常，知道 amd64 或 arm64；第 3 节 |
| 3 | 本地仓库 | 创建 Dockerfile、忽略文件、Nginx 配置、初始化 SQL | 写好“如何打包程序”和“网页请求怎样进入后端”的说明书 | 第 4 节列出的文件齐全 |
| 4 | 本地仓库 | 创建 Compose 和环境模板 | 定义三个服务如何连接、使用哪些变量、数据存在哪里 | 运行、构建和 HTTPS 覆盖模板及根目录环境模板齐全；第 5 节 |
| 5 | 本地电脑 | 填本地私有配置，构建并启动一次 | 提前发现依赖、SQL、代理和环境变量的问题 | 页面 200、空登录请求 400 JSON；第 6 节 |
| 6 | 本地电脑 → 镜像仓库 | 按架构构建 → 查看本地镜像 → 打仓库标签 → 登录 → 分别执行 push | 让服务器能下载已经打包好的程序 | 两个远程镜像标签和平台都正确；第 7 节 |
| 7 | 云平台、服务器 | 配 DNS、安全组、SSH 用户，安装 Docker Engine | 给云端提供运行容器和接收公网请求的环境 | 域名指向公网 IP，deployer 可运行 Docker，80/443 可用；第 8 节 |
| 8 | 本地 → 服务器 | 上传 Compose、环境模板、Nginx 配置与 SQL，在服务器填写正式 .env | 把运行方案、Nginx 配置、首次建库文件及正式密钥放到正确位置 | /opt/expense 文件齐全，占位符已替换；第 9 节 |
| 9 | 服务器 | 拉取镜像，先启动 HTTP，再用 Certbot 申请证书并启用 HTTPS 覆盖配置 | 依次初始化数据库、连接后端、验证域名并提供加密入口 | db/api healthy、Nginx 配置通过、HTTPS 与续期演练成功；第 10 节 |
| 10 | 浏览器与外部网络 | 验证 HTTPS、邮件、注册登录、流水和重建后的数据 | 证明用户真的能用，数据也不会随容器消失 | 第 11 节验收通过后再对外开放；已有账本先完成第 12 节 |
| 11 | 服务器、备份存储 | 建备份任务，并在隔离数据库中恢复一次 | 防止磁盘或主机损坏后无法找回账本 | 备份可恢复且有异机副本；第 13 节 |

后续发布的流程会更短：**改源码 → 测试 → build → tag → push → 服务器备份 → 改版本 → pull → 必要时迁移数据库 → up → 验收**，见第 14 节。Docker Desktop 不会自动替你把本地数据库搬到云端。

### 0.1 先认识几个会反复出现的词

| 名词 / 文件 | 在本教程里负责什么 |
| --- | --- |
| 镜像 image | 打包好的程序与依赖，类似一份可运行的安装包；不含你的数据库卷 |
| 容器 container | 镜像启动后的运行实例；API、Web、MySQL 各自运行 |
| Dockerfile | 构建一个镜像的说明书，通常先装依赖、再编译、最后指定启动方式 |
| compose.yaml | 管理多个容器的运行清单，定义服务、端口、环境变量和持久卷 |
| 镜像仓库 registry | 电脑上传镜像、服务器下载镜像的中转站，例如 Docker Hub |
| 命名卷 volume | 容器之外保存数据的空间，重建容器仍保留；仍需另外备份 |
| 反向代理 | Nginx 收到浏览器请求后，把 /api 转交给 NestJS，其余请求返回网页 |
| 环境变量 | 启动时传入的配置，例如数据库密码、域名；不应写进程序镜像 |

### 0.2 怎么读和复制下面的示例

- **本地电脑**：Windows 使用 PowerShell；Mac 使用终端。**服务器**：先 SSH 登录 Ubuntu，再在 Bash 中执行。不要把两处命令混着运行。
- **“新建某文件”下面的代码是文件内容**，在编辑器里粘贴保存；**“执行”下面的代码才是终端命令**。Dockerfile/YAML 不能直接粘进终端执行。
- 每条命令、每行配置上方都有中文注释，可以随代码复制。`#`、SQL 的 `--`、xcconfig 的 `//` 是对应格式支持的注释。备份脚本的 `#!/usr/bin/env bash` 必须保持第一行，其说明放在代码块外。
- 为便于逐行解释，多数命令写成完整一行。页面自动折行不代表要手动换行；一条命令执行成功后再执行下一条，失败就先排查。
- 流程图、目录树是结构示意，无需粘贴执行。`203.0.113.10`、`expense.example.com`、`yourname`、中文占位符均要按自己的资源替换。
- 根目录 `.env.example` 是公开模板；`.env.local` 是本地私有配置；服务器 `.env` 是正式私有配置。这三者用途不同。后端目录已有的 `.env.example` 不能直接代替根目录 Compose 模板。

### 0.3 先分清：你究竟要制作几个镜像，运行几个容器

本教程有 **3 个长期运行的业务容器，但只制作 2 个应用镜像**。镜像可以理解为装好程序和依赖的发布包，容器是从这个包启动出来的进程环境。

| 服务名 | 运行什么 | 镜像从哪里来 | 你需要做什么 |
| --- | --- | --- | --- |
| `api` | NestJS 后端 | 用 `service-nest/Dockerfile` 构建 | 把后端源码、依赖和 Node 运行环境打包 |
| `web` | Nginx + Vue 静态页面 | 以官方 Nginx 镜像为基础构建 | 加入前端打包文件和代理配置 |
| `db` | MySQL | 直接下载官方 `mysql:8.4` | 填写密码，准备初始化 SQL，指定数据保存位置 |
| `certbot` | 证书工具 | 直接下载官方 Certbot 镜像 | 申请或续期时临时运行，用完退出；不属于上面 3 个常驻容器 |

准备 SQL 是配置官方 MySQL 的首次建表过程，不是制作 MySQL 镜像。账本保存在数据库卷里，也不在这些镜像中。

### 0.4 先把几个动作分开，后面每一步都按这个顺序展开

| 动作 | 命令 | 执行后发生什么 | 还没有发生什么 |
| --- | --- | --- | --- |
| 构建 | `docker build` | 按 Dockerfile 在电脑里生成镜像 | 还没有上传，也没有启动容器 |
| 打标签 | `docker tag` | 给同一镜像增加符合仓库规则的名字 | 不重新编译，也不上传 |
| 登录仓库 | `docker login` | 当前这台机器取得仓库访问凭据 | 不上传镜像，也不登录 Ubuntu |
| 上传 | `docker push` | 将指定名字和版本的镜像上传镜像仓库 | 不会自动让服务器启动它 |
| 下载 | `docker compose pull` | 在当前 Docker 主机下载配置指定的镜像 | 不会因此启动应用 |
| 启动 | `docker compose up` | 按配置创建或更新容器，再启动服务 | 不会自动把本地真实账本迁入云端 |

例如，写好了 Dockerfile，只是写好了“怎样打包”的文件；执行 build 才有镜像。写好了 Compose，也只是写好了“怎样运行”的清单；执行 up 才有运行中的容器。**第 7 节会把 build、tag、login、push 分开执行，不把上传藏进构建参数。**

### 0.5 读到终端命令时，先确认这三个问题

1. **在哪台机器？** Windows 本地 PowerShell 和 SSH 登录后的 Ubuntu 是两台机器。相同的 Docker 命令在两处操作的是各自的镜像和容器。
2. **在哪个目录？** 本地通常是仓库根目录；服务器通常是 `/opt/expense`。相对路径根据当前目录查找。
3. **这是命令还是文件内容？** 标为“文件内容”的 Dockerfile、YAML、Nginx、SQL 先粘贴到指定文件保存；不要直接当终端命令运行。

示例命令前的 `#` 是注释，可以和命令一起复制。每个小步骤完成后先核对“应该看到什么”，失败时停在当前步骤处理。这里的教程面向首次创建新部署；已有服务更新、旧账本导入和恢复都放在后面的独立章节。

## 1. 先回答：可以在桌面端准备好，再放到云服务器运行吗

**这一步做什么、有什么用：** 理解本地准备与云端运行如何衔接，知道哪些东西会随镜像传输。

**在哪里做、怎样算完成：** 本节只阅读。完成后能区分镜像、配置文件和真实数据库数据。

**可以，这正是 Docker 常见的使用方式。** Docker Desktop 提供 Windows、macOS 桌面应用以及 Docker CLI、Compose 等工具，可以在本地构建、运行和检查容器。云端无需安装桌面应用。[Docker Desktop 官方说明](https://docs.docker.com/desktop/)

本文推荐的流程是：

```text
Windows / Mac：Docker Desktop
  源码 + Dockerfile → Linux 镜像 → 本地 Compose 验证
                         │
                         └─ 推送到镜像仓库，例如 Docker Hub
                                      │
Ubuntu 云服务器：Docker Engine          ▼
  Compose + 正式环境变量 + 初始化 SQL → 拉取指定版本 → 启动服务
```

| 内容 | 怎样从本地到云端 |
| --- | --- |
| API 程序、依赖、Node 运行时 | 打进 API 镜像 |
| Web 构建产物、HTTP Nginx 配置 | 打进 Web 镜像；正式 HTTPS 配置单独上传服务器 |
| 服务关系、端口、数据卷声明 | 上传 `compose.yaml` |
| 首次建表 SQL | 单独上传 `deploy/mysql-init/` |
| 数据库密码、JWT、SMTP 凭据 | 在服务器单独填写 `.env`，不写进镜像 |
| 本地已有的真实账本 | 单独导出、传输、导入；镜像不含数据库卷数据 |
| 域名、安全组、备份计划 | 在云平台和服务器配置 |

Docker Desktop 的图形界面方便查看容器、日志、镜像和数据卷；部署方案本身保存在文件里。仅在界面手动创建几个容器，并不会自动产生一份完整的云端部署配置。

另一种方式是通过 SSH Context 从电脑管理云端 Docker，见第 15 节；首次部署建议先使用本文的“镜像仓库 + SSH”流程。

## 2. 本项目最终部署结构

**这一步做什么、有什么用：** 看清浏览器、网页容器、API 和数据库的请求路径，并准备要替换的真实值。

**在哪里做、怎样算完成：** 本节只阅读和记录。后文沿用同一套域名、端口、目录和版本名。

```text
浏览器：https://expense.example.com
  │
  ▼ 云安全组，仅开放 SSH / HTTP / HTTPS
web 容器：Nginx，发布服务器 80、443
  ├─ /、/login、/transactions → 镜像内的 Vue 静态页面
  └─ /api/... → api:3000，完整保留 /api
                   │
                   ▼
              api 容器：NestJS
                   │ DB_HOST=db
                   ▼
              db 容器：MySQL → db_data 持久卷

certbot 工具容器 → certbot_conf 证书卷、certbot_www 验证文件卷
Nginx 只读使用这两个卷，Certbot 只在申请/续期时运行
```

这里使用 **Nginx 容器提供静态页面、反向代理和 HTTPS**，另用 **Certbot 工具容器申请与续期证书**。宿主机安装 Docker 即可，Nginx、Certbot、Node 和 MySQL 均不需要再安装一份。Nginx 本身不会自动签发证书，因此第 10 节会先用 HTTP 申请证书，再启用 HTTPS，并配置定时续期。[Nginx 官方镜像](https://hub.docker.com/_/nginx)、[Certbot webroot 说明](https://eff-certbot.readthedocs.io/en/stable/using.html#webroot)

本项目有几个必须保持的约定：

- 前后端统一使用 `/api`，不能在代理处去掉它。
- Refresh Cookie 的 Path 是 `/api/auth`，生产环境启用 `Secure`；最终登录验收必须走 HTTPS。
- `NODE_ENV=production` 必须在 API 进程创建前设置，生产环境关闭 TypeORM 自动同步。
- 初始化脚本是 `service-nest/sql/init.sql`，包含 9 张表、112 个分类图标和 84 条分类模板；不要导入 `mock-data.sql`。
- 后端需要两把独立 JWT 密钥、验证码密钥、真实 SMTP 配置。
- 当前没有 `/api/health`，也没有已经配置好的 `migration:run`。本文用真实登录接口的预期 400 响应进行进程检查。

这条请求链可以分成三次连接来理解：浏览器访问域名，Nginx 收到 `/api/...` 后访问 `api:3000`，API 再通过 `db:3306` 读写账本。`api` 和 `db` 是 Compose 给容器的内部服务名，浏览器不能直接使用这些名字。只有 `web` 需要接受公网访问。

你会看到两种“仓库”：Git 仓库保存源码，Docker Hub 镜像仓库保存 build 生成的发布包。把源码推送到 Git，不会自动得到 Docker 镜像；本教程会单独执行镜像的构建和推送。

### 2.1 版本与示例值

| 项目 | 本文使用的值 |
| --- | --- |
| 服务器公网 IP | `203.0.113.10`，必须替换 |
| 服务器系统 | Ubuntu 24.04 LTS 64 位 UEFI 版，发行代号 `noble`；安装前按第 8.3 节核验 |
| 域名 | `expense.example.com`，必须替换 |
| SSH 用户 | `deployer` |
| 服务器部署目录 | `/opt/expense` |
| 正式 Compose 项目名 | `expense`，后续保持不变 |
| Node 镜像 | `node:24.22.1-bookworm-slim`（LTS），与前后端 engines 一致 |
| MySQL 镜像 | `mysql:8.4`，8.4 LTS 系列 |
| Web 运行镜像 | `nginx:stable-alpine` |
| 证书工具镜像 | `certbot/certbot:latest`，按需执行，验证后固定 digest |
| 发布版本示例 | `20261016-1`，每次发布用新标签 |

**数据库版本与原教程的区别：** 原仓库 SQL 注明适用于 MySQL 8.0，而 MySQL 官方已宣布 8.0 于 2026 年 4 月结束生命周期。本文新部署选择 8.4 LTS；这不表示本仓库已经完成 8.4 全量兼容认证。首次部署应验证建表、分类初始化、登录、流水和统计；旧库升级须先在隔离库演练逻辑导入，不可把旧版本数据目录直接交给新镜像。[MySQL 8.0 发布说明](https://dev.mysql.com/doc/relnotes/mysql/8.0/en/)

`8.4`、`stable-alpine` 和 Certbot 的 `latest` 都会随发布变化。首次验证后记录实际 digest，正式环境可改用 `mysql:8.4@sha256:实际摘要` 等引用。应用镜像标签同样应避免被覆盖；不要以 `latest` 作为回退依据。

### 2.2 开始前准备这些真实资料

| 准备项 | 从哪里获得 | 后面用在哪里 |
| --- | --- | --- |
| 本项目源码 | 已有工作目录，或第 4.0 节下载 | 编译 API 和前端 |
| Docker Hub 账号 | 在 Docker Hub 注册，记下用户名 | 第 7 节创建两个镜像仓库并上传 |
| Ubuntu 服务器 | 云平台创建 Ubuntu 24.04 LTS 64 位 UEFI 版，记下公网 IP、初始账号和登录方式 | 第 8 节 SSH 和安装 Docker |
| 服务器 CPU 架构 | 云平台实例信息，之后用 `uname -m` 复核 | 第 7 节选择构建目标 |
| 已拥有的域名 | 域名服务商购买或使用现有域名，选定子域名 | DNS、Nginx 和 HTTPS 证书 |
| 发信邮箱 SMTP 资料 | 邮箱设置中启用 SMTP，取得主机、端口、账号与授权码 | 注册和找回密码的真实验证码 |

`yourname` 是 Docker Hub 用户名，`deployer` 是稍后在 Ubuntu 创建的部署用户；两者不是同一个账号。`expense.example.com` 和 `203.0.113.10` 是不能照抄上线的示例，后面始终使用同一套自己的真实值。

暂时不会创建服务器或 DNS 记录也可以继续到本地预演，但开始第 7 节前要知道目标 CPU 架构，第 8 节会逐项配置云端。首次照做时建议只走一条主线：Windows 本地构建，镜像仓库传输，Ubuntu 通过 SSH 运行。Mac 仅选择明确标为 Mac 的对应操作，不需要两套都做。

## 3. 在 Windows / Mac 安装并检查 Docker Desktop

**这一步做什么、有什么用：** 让电脑具备构建和运行 Linux 容器的能力，并确认云服务器目标架构。

**在哪里做、怎样算完成：** 在本地安装和检查 Desktop；先从云控制台确认服务器架构，登录服务器后可再复核。完成后 Docker Client/Server 均可用。

### 3.1 Windows

从 [Windows 官方安装页面](https://docs.docker.com/desktop/setup/install/windows-install/)下载 Docker Desktop，按当前系统要求启用硬件虚拟化和 WSL 2 后端。若尚未安装 WSL，可在管理员 PowerShell 执行：

```powershell
# 安装 WSL 及默认 Linux 发行版，为 Docker Desktop 的 WSL 2 后端准备环境；按提示重启电脑。
wsl --install
```

按提示重启；安装并启动 Docker Desktop，使用 **Linux containers**。本项目要运行 Linux 镜像。

**本地 PowerShell 执行：**

```powershell
# 查看 WSL 的安装状态和默认版本。
wsl --status
# 检查 Docker 客户端和引擎是否都可连接；应同时看到 Client 和 Server。
docker version
# 检查 Compose 插件是否可用，后面用它一起启动三个服务。
docker compose version
# 检查 Buildx 是否可用，后面用它构建指定 CPU 架构的镜像。
docker buildx version
# 检查引擎是否运行 Linux 容器；本项目预期输出 linux。
docker info --format '{{.OSType}}'
```

最后应输出 `linux`，`docker version` 应同时有 Client 和 Server。只有客户端版本、Server 连接失败时，先启动并修复 Docker Desktop。

### 3.2 macOS

从 [Mac 官方安装页面](https://docs.docker.com/desktop/setup/install/mac-install/)选择 Apple Silicon 或 Intel 对应安装包，安装并启动后，在终端执行上述 `docker` 检查命令。后文标为 Bash 的命令可用于 Mac；PowerShell 的复制和建目录命令有对应 Bash 版本。

### 3.3 提前确认服务器架构

先在云平台的实例信息中查看 CPU 架构，后面发布镜像会用到。如果已经能 SSH 登录，可用下面的命令复核；尚未登录时先记录云控制台的结果，第 8 节准备 SSH 后再复核。

**服务器初始管理员的 SSH 终端（用云平台提供的 ubuntu/root 等账号登录；第 8 节才创建 deployer）：**

```bash
# 查看云服务器 CPU 架构，决定稍后构建 amd64 还是 arm64 镜像。
uname -m
```

| 输出 | 构建目标 |
| --- | --- |
| `x86_64` | `linux/amd64` |
| `aarch64` | `linux/arm64` |

Apple Silicon 本地通常运行 arm64，云服务器可能是 amd64。发布镜像时要显式指定目标平台；本文第 7 节给出命令。镜像能跨操作系统分发，并不意味着任意 CPU 架构的镜像都能原生运行。[多平台构建说明](https://docs.docker.com/build/building/multi-platform/)

## 4. 在项目中创建镜像配置

**这一步做什么、有什么用：** 写好两个镜像的构建方式、网页代理规则和首次建库脚本。

**在哪里做、怎样算完成：** 在本地仓库创建文件；本节输出 Dockerfile、.dockerignore、Nginx HTTP/HTTPS 配置和两份 SQL，尚未启动服务。

### 4.0 先打开项目根目录

本教程中的“仓库根目录”指同时包含 `web`、`service-nest` 和本文的目录。已经下载本项目时，直接用编辑器打开这个目录，在这里新建终端即可；不要再克隆一份。

如果还没有源码，先安装 Git，再在**本地准备存放项目的父目录**执行下面两条命令（Windows PowerShell、Mac 终端均可）：

```powershell
# 下载本项目源码到当前目录下的 daily-expense-tracking 文件夹。
git clone https://github.com/Brave0422/daily-expense-tracking.git
# 进入刚下载的项目根目录；后面的本地相对路径都以这里为起点。
cd daily-expense-tracking
```

以下文件均在**本地仓库**创建；保存为 UTF-8。Dockerfile、YAML、Nginx 配置用编辑器保存，不需要额外扩展名；例如文件名应为 `Dockerfile`，不要保存成 `Dockerfile.txt`。Shell 文件如后文备份脚本使用 LF 换行。

创建完成后的新增结构（目录树仅作示意，不是终端命令）：

```text
daily-expense-tracking/
├── compose.yaml
├── compose.build.yaml
├── compose.https.yaml            # HTTPS 覆盖模板，拿到证书后在云端启用
├── .env.example
├── .env.local                    # 本地私有配置，不提交
├── deploy/
│   ├── mysql-init/
│   │   ├── 01-init.sql           # 从现有 init.sql 复制
│   │   └── 02-app-grants.sql
│   └── nginx/
│       └── https.conf            # 正式域名及证书路径配置
├── service-nest/
│   ├── Dockerfile
│   └── .dockerignore
└── web/
    ├── Dockerfile
    ├── .dockerignore
    └── nginx.conf                # 本地与首次申请证书使用的 HTTP 配置
```

本节都是**创建文件**，还没有执行构建。先在编辑器文件树中新建相应目录和文件，再粘贴对应内容保存；`deploy/nginx` 不存在时先新建该目录。Windows 需要显示文件扩展名，避免误存为 `Dockerfile.txt` 或 `.env.example.txt`。

先检查自己确实在仓库根目录。本地 PowerShell 执行下面两行，结果都应为 `True`：

```powershell
# 确认当前目录能找到后端依赖清单。
Test-Path service-nest/package.json
# 确认当前目录能找到前端依赖清单。
Test-Path web/package.json
```

Dockerfile 中有两个容易误会的地方，先解释再复制：

- **两个 `FROM` 是两个构建阶段，不是两个常驻容器。** 第一个阶段安装工具并编译，第二个阶段只带运行所需文件；最终得到一个 API 镜像。Web 同样最终只得到一个镜像。
- **`RUN` 在构建时执行，`CMD` 在容器启动时执行。** 因此编译只在 build 时做，启动 API 时不会每次重新编译。
- **`COPY` 从“构建上下文”读取文件。** 第 7 节会把 `service-nest` 指定为 API 上下文，所以其中的 `COPY package.json ...` 读取的是 `service-nest/package.json`，不是仓库根目录。
- **`/app` 是镜像内部目录。** 它不是让你在 Windows 上额外创建一个 `/app` 文件夹。

### 4.1 API：`service-nest/Dockerfile`

在编辑器新建该文件，将下面内容完整保存进去。它负责“如何把后端做成镜像”，不是终端脚本。`npm ci` 按锁文件安装依赖；编译工具只存在于构建阶段。

```dockerfile
# 以项目要求的 Node 24.22.1 作为编译环境，并把这个阶段命名为 build。
FROM node:24.22.1-bookworm-slim AS build
# 将后续构建命令的工作目录设为镜像内的 /app。
WORKDIR /app
# 安装 bcrypt 可能用到的编译工具，并在同一层清除 apt 索引以减小镜像。
RUN apt-get update  && apt-get install -y --no-install-recommends python3 make g++  && rm -rf /var/lib/apt/lists/*
# 先只复制依赖清单和锁文件；源码变化时可以复用安装依赖的缓存。
COPY package.json package-lock.json ./
# 严格按锁文件安装依赖，包含编译 NestJS 所需的开发依赖。
RUN npm ci --include=dev
# 把未被 .dockerignore 排除的后端源码复制到 /app。
COPY . .
# 将 TypeScript 编译到 dist，再移除运行时不需要的开发依赖。
RUN npm run build && npm prune --omit=dev
# 重新从干净的 Node 镜像开始运行阶段，不带上前一阶段的编译工具。
FROM node:24.22.1-bookworm-slim AS runtime
# 安装 HTTPS 请求所需的根证书和时区数据，并清理 apt 索引。
RUN apt-get update  && apt-get install -y --no-install-recommends ca-certificates tzdata  && rm -rf /var/lib/apt/lists/*
# 在 Node 启动前设置生产模式与时区；生产模式会关闭自动同步数据库表。
ENV NODE_ENV=production TZ=Asia/Shanghai
# 把运行目录设为 /app，与编译产物的位置一致。
WORKDIR /app
# 复制依赖清单，并把文件所有者设为镜像内置的 node 用户。
COPY --from=build --chown=node:node /app/package*.json ./
# 复制已经安装并裁剪过的生产依赖。
COPY --from=build --chown=node:node /app/node_modules ./node_modules
# 复制编译好的 JavaScript，不把原始源码放进最终运行目录。
COPY --from=build --chown=node:node /app/dist ./dist
# 切换到普通 node 用户运行服务，减少进程权限。
USER node
# 声明 API 使用 3000 端口；这行本身不会向公网开放端口。
EXPOSE 3000
# 容器启动时直接运行编译后的 NestJS 入口，由 Docker 管理重启。
CMD ["node", "dist/main.js"]
```

构建时安装 Nest CLI、TypeScript 等开发依赖，编译后移除；运行阶段直接启动 Node，Docker 负责进程重启。构建和运行使用相同 Linux 发行版，避免原生模块依赖不匹配。

### 4.2 Web：`web/Dockerfile`

在编辑器新建该文件并保存下面内容。Vue 的源码先在 Node 环境编译成 HTML、JS、CSS，最终由 Nginx 提供这些文件；正式服务器不运行 Vite 开发服务器。

```dockerfile
# 使用项目要求的 Node 版本构建前端，并命名为 build 阶段。
FROM node:24.22.1-bookworm-slim AS build
# 将构建工作目录设为镜像内的 /app。
WORKDIR /app
# 先复制依赖清单和锁文件，便于复用依赖缓存。
COPY package.json package-lock.json ./
# 安装全部依赖，包含 Vite 和 TypeScript 等构建工具。
RUN npm ci --include=dev
# 复制未被 .dockerignore 排除的前端源码。
COPY . .
# 让打包后的网页通过当前域名下的 /api 访问后端。
ENV VITE_API_BASE_URL=/api
# 执行项目已有构建脚本，检查类型并生成 dist 静态文件。
RUN npm run build
# 使用 Nginx 托管网页和代理 API；正式 HTTPS 在拿到证书后启用。
FROM nginx:stable-alpine
# 用本项目的 HTTP 配置替换镜像自带站点，供本地预演和首次签证书使用。
COPY nginx.conf /etc/nginx/conf.d/default.conf
# 把打包后的 Vue 静态文件复制到 Nginx 的网页根目录。
COPY --from=build /app/dist /usr/share/nginx/html
```

先区分两种配置时机：前端打包时使用的变量会写进生成的 JS；容器启动时的环境变量只是给运行中的进程读取。`VITE_API_BASE_URL` 是构建时变量。这里构建为同源 `/api`，同一份镜像可以分别用于本地与正式域名，无需给每个域名重新打包。

### 4.3 两个 `.dockerignore`

分别新建 `service-nest/.dockerignore` 和 `web/.dockerignore`，两处都写入下面的文件内容：

```gitignore
# 不把本机安装的依赖复制进 Linux 镜像。
node_modules
# 排除旧构建产物，镜像构建时重新生成。
dist
# 排除测试覆盖率报告。
coverage
# 排除 Git 历史和仓库元数据。
.git
# 排除可能含密码的默认环境文件。
.env
# 排除其他环境配置文件；运行参数通过 Compose 注入。
.env.*
# 排除运行日志。
*.log
# 排除本机 TypeScript 增量构建缓存。
*.tsbuildinfo
```

构建上下文分别是 `service-nest` 和 `web`，因此两个目录都需要自己的忽略文件。它防止 Windows/macOS 的依赖、旧产物和环境密钥进入镜像；不能只依赖 `.gitignore`。

### 4.4 Web 入口：`web/nginx.conf` 与 `deploy/nginx/https.conf`

这两个文件负责不同阶段：`web/nginx.conf` 打进镜像，本地与首次上线用 HTTP；`deploy/nginx/https.conf` 单独上传，拿到证书后才挂载启用。**不能在还没有证书时直接启用 443 配置，否则 Nginx 会因找不到证书而启动失败。**

**本地新建 `web/nginx.conf`，写入：**

```nginx
# 定义本地预演与首次申请证书时使用的 HTTP 站点。
server {
    # 监听容器内 80 端口；实际对外端口由 Compose 映射。
    listen 80;
    # 接受本地 localhost 和正式域名请求，正式 HTTPS 配置另行指定域名。
    server_name _;
    # 指向 Dockerfile 复制进去的前端静态文件。
    root /usr/share/nginx/html;
    # 访问目录时默认返回首页。
    index index.html;
    # 优先处理证书验证文件，不能把验证请求转给 SPA 首页。
    location ^~ /.well-known/acme-challenge/ {
        # 从与 Certbot 共享的卷读取验证文件，完整保留请求路径。
        root /var/www/certbot;
        # 结束证书验证路径的处理规则。
    }
    # 只匹配 /api 本身和 /api/ 下的接口，避免匹配 /apix 等页面。
    location ~ ^/api(?:/|$) {
        # 用 Docker 内置 DNS 定期解析服务名，适应 API 容器重建后的 IP 变化。
        resolver 127.0.0.11 valid=10s ipv6=off;
        # 设置后端地址；只有主机和端口，没有会替换路径的尾部斜杠。
        set $api_upstream http://api:3000;
        # 动态解析并转发请求，保留原始 /api 路径和查询参数。
        proxy_pass $api_upstream;
        # 使用 HTTP/1.1 与后端通信。
        proxy_http_version 1.1;
        # 把浏览器访问的主机名传给后端。
        proxy_set_header Host $host;
        # 传递与 Nginx 连接的客户端 IP。
        proxy_set_header X-Real-IP $remote_addr;
        # 追加代理链中的客户端 IP，后端应按需配置信任代理范围。
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        # 告诉后端本次入口使用的是 HTTP 还是 HTTPS。
        proxy_set_header X-Forwarded-Proto $scheme;
        # 结束 API 代理规则，API 错误不会交给首页处理。
    }
    # 处理其他网页和静态资源请求。
    location / {
        # 优先返回真实文件或目录，否则返回首页，支持 Vue 路由刷新。
        try_files $uri $uri/ /index.html;
        # 结束网页处理规则。
    }
    # 结束 HTTP 站点配置。
}
```

`$uri`、`$host`、`$api_upstream` 等是 Nginx 自己的变量，不是 `.env` 变量；按原样保留。这里不使用环境变量模板替换。`proxy_pass` 使用不含 URI 的地址，保持项目要求的 `/api` 前缀。[Nginx proxy_pass 文档](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass)

**本地新建 `deploy/nginx/https.conf`，写入下面内容。把所有 `expense.example.com` 替换为同一个真实域名，包括证书路径里的目录名：**

```nginx
# 80 端口保留证书验证入口，并把其余访问跳转到 HTTPS。
server {
    # 证书续期的 HTTP-01 验证仍需要公网 80 端口。
    listen 80;
    # 替换为你实际拥有并已经解析到服务器的域名。
    server_name expense.example.com;
    # 验证请求优先返回文件，不能一律跳转或进入 SPA。
    location ^~ /.well-known/acme-challenge/ {
        # 读取 Certbot 写入共享卷的验证文件。
        root /var/www/certbot;
        # 结束验证文件规则。
    }
    # 其他 HTTP 请求统一跳转到正式 HTTPS 域名。
    location / {
        # 固定正式域名，并保留原路径和查询参数；域名也要替换。
        return 301 https://expense.example.com$request_uri;
        # 结束 HTTP 跳转规则。
    }
    # 结束 HTTP 站点配置。
}
# 使用申请成功的证书提供正式 HTTPS 页面和 API。
server {
    # 在容器内 443 端口启用 TLS。
    listen 443 ssl;
    # 与证书申请命令的域名保持一致。
    server_name expense.example.com;
    # 读取完整证书链；live 目录名由 --cert-name 固定。
    ssl_certificate /etc/letsencrypt/live/expense.example.com/fullchain.pem;
    # 读取私钥；整个 /etc/letsencrypt 卷需挂载，不能只复制符号链接。
    ssl_certificate_key /etc/letsencrypt/live/expense.example.com/privkey.pem;
    # 只允许 TLS 1.2 与 TLS 1.3。
    ssl_protocols TLSv1.2 TLSv1.3;
    # 指向镜像内已构建的前端文件。
    root /usr/share/nginx/html;
    # 访问目录时默认返回首页。
    index index.html;
    # 单独匹配 API 请求，保留 /api 前缀。
    location ~ ^/api(?:/|$) {
        # 动态解析 Compose 服务名，以适应 API 容器 IP 变化。
        resolver 127.0.0.11 valid=10s ipv6=off;
        # 使用不含 URI 的后端地址，避免替换原请求路径。
        set $api_upstream http://api:3000;
        # 转发原始路径与查询参数到 NestJS。
        proxy_pass $api_upstream;
        # 使用 HTTP/1.1 与 API 通信。
        proxy_http_version 1.1;
        # 将用户访问的主机名传给后端。
        proxy_set_header Host $host;
        # 将当前客户端地址传给后端。
        proxy_set_header X-Real-IP $remote_addr;
        # 追加代理链地址，后端按实际信任范围使用。
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        # 在本 TLS 入口中传递 https，便于后端了解原始协议。
        proxy_set_header X-Forwarded-Proto $scheme;
        # 结束 HTTPS API 代理规则。
    }
    # 其余请求由前端静态文件和 Vue 路由处理。
    location / {
        # 文件不存在时返回首页，保持前端子路由可刷新。
        try_files $uri $uri/ /index.html;
        # 结束网页处理规则。
    }
    # 结束 HTTPS 站点配置。
}
```

证书文件由第 10 节生成，不能把私钥打进镜像或提交 Git。普通 `.conf` 不会自动读取 Compose 的 `.env`；改域名时必须同步修改这里的 `server_name`、跳转地址、证书路径和证书申请命令。

### 4.5 准备初始化 SQL

MySQL 直接使用官方镜像。我们只准备两份首次启动时交给它执行的 SQL：第一份建表和写入分类基础数据，第二份限制业务账号权限。这里还没有启动数据库，也没有导入你的旧账本。

**本地 Windows PowerShell：**

```powershell
# 在本地仓库创建 MySQL 初始化目录；目录已存在时继续使用。
New-Item -ItemType Directory -Force deploy/mysql-init
# 复制仓库已有建表和基础数据 SQL，01 前缀让它先执行。
Copy-Item service-nest/sql/init.sql deploy/mysql-init/01-init.sql
```

**本地 Mac / Linux Bash：**

```bash
# 在本地仓库创建 MySQL 初始化目录。
mkdir -p deploy/mysql-init
# 复制项目建表和基础数据脚本，并让它排在权限脚本之前执行。
cp service-nest/sql/init.sql deploy/mysql-init/01-init.sql
```

新建 `deploy/mysql-init/02-app-grants.sql`：

```sql
-- 撤销镜像初始化时授予业务账号的该库权限，为收窄权限做准备。
REVOKE ALL PRIVILEGES ON `daily-expense-tracking`.* FROM 'expense_app'@'%';
-- 只授予业务账号日常增删改查权限，建表和升级由管理员执行。
GRANT SELECT, INSERT, UPDATE, DELETE ON `daily-expense-tracking`.* TO 'expense_app'@'%';
```

官方 MySQL 镜像先按环境变量创建业务库和用户，再依文件名顺序执行初始化目录中的 SQL。第二个脚本收窄业务用户权限；管理员负责建表和迁移。此处 `%` 允许来自容器网段的连接，数据库端口不发布到宿主机；它不等于允许公网访问。[MySQL 官方镜像初始化说明](https://hub.docker.com/_/mysql/)

**初始化目录只在数据库数据目录为空时执行。** 两份 SQL 只是首次安装用的材料，不是每次重启都执行的命令。修改 SQL、密码变量或重新创建容器，都不会自动重建旧表或修改已有数据库用户密码。

## 5. 创建 Compose 和环境模板

**这一步做什么、有什么用：** 把 MySQL、API、Web 三个业务容器组合成一套应用，明确各自镜像来源、连接、配置、端口与数据保存方式。

**在哪里做、怎样算完成：** 在本地仓库根目录创建 compose.yaml、compose.build.yaml、compose.https.yaml 和 .env.example；下一节再填写本地私有值。

### 5.0 先读懂这份运行清单，再复制配置

Compose 是 Docker 的多服务管理工具。它读取 YAML 清单，为 `db`、`api`、`web` 创建各自容器并放进同一个内部网络。`certbot` 也写在清单里，但带有工具标记，普通启动不会让它常驻。

| 配置项 | 本教程中表示什么 |
| --- | --- |
| `services` | 下面开始列服务；`db`、`api`、`web` 是服务名 |
| `image` | 要用哪个镜像；直接写官方镜像，或写自己构建的镜像名和版本 |
| `build` | 怎样从源码构建镜像；只放在额外的本地构建文件里 |
| `environment` | 容器启动时实际收到的环境变量 |
| `ports` | 宿主机端口怎样连接到容器端口 |
| `volumes` | 容器中的文件怎样保存到容器外，或从宿主机读取配置 |
| `depends_on`、`healthcheck` | 哪个依赖先准备好，怎样检查它已经可用 |

例如 `127.0.0.1:8080:80` 从左到右是“宿主机地址：宿主机端口：容器端口”。浏览器访问电脑的 8080，Docker 转交给 Nginx 容器的 80。API 使用内部 3000、数据库使用内部 3306，并不意味着要把这两个端口都开放到公网。

`db_data:/var/lib/mysql` 表示把数据库目录保存到名为 `db_data` 的持久卷；`./deploy/mysql-init:/docker-entrypoint-initdb.d:ro` 则把你准备的目录挂进去供首次初始化读取，`ro` 表示容器只能读它。前者保存账本，后者提供建表材料，二者作用不同。

`${DB_PASSWORD:?请设置业务数据库密码}` 表示 Compose 在启动前从环境配置中取值，缺少时直接报错；`${MYSQL_IMAGE:-mysql:8.4}` 表示没填写时使用默认值。你只需在第 5.3 节模板中填写密码，不必在 YAML 里重复写明文。

YAML 用缩进表示层级，使用空格，不要用 Tab。下面的配置逐行有注释；先完整保存，再按第 6 节检查，当前还不用执行它。

### 5.1 `compose.yaml`：本地与生产共用的运行定义

```yaml
# 定义三个常驻服务，以及按需使用的证书工具。
services:
  # 定义 MySQL 服务；其他容器使用 db 这个名字访问它。
  db:
    # 读取数据库镜像配置；未指定时使用 mysql:8.4。
    image: ${MYSQL_IMAGE:-mysql:8.4}
    # 进程退出后自动重启，并在主机重启后恢复；手动停止的容器不会自动恢复。
    restart: unless-stopped
    # 下面的参数会作为环境变量传入当前容器。
    environment:
      # 将该容器的运行时区设置为 Asia/Shanghai。
      TZ: Asia/Shanghai
      # 设置首次建库的管理员密码，使用独立随机值；不会自动更改已有数据库账号。
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:?请设置数据库管理员密码}
      # 让 MySQL 首次初始化时创建本项目业务库。
      MYSQL_DATABASE: daily-expense-tracking
      # 让 MySQL 首次初始化时创建业务账号 expense_app。
      MYSQL_USER: expense_app
      # 从 Compose 环境文件读取业务密码，供 MySQL 首次创建账号使用。
      MYSQL_PASSWORD: ${DB_PASSWORD:?请设置业务数据库密码}
    # 为 MySQL 追加启动参数，统一字符集、排序规则和时区。
    command:
      # 将 MySQL 默认字符集设为 utf8mb4，支持中文和表情符号。
      - --character-set-server=utf8mb4
      # 设置默认排序规则，与项目 SQL 的字符集约定一致。
      - --collation-server=utf8mb4_unicode_ci
      # 设置数据库会话默认时区为东八区。
      - --default-time-zone=+08:00
    # 挂载持久数据或只读初始化脚本。
    volumes:
      # 把数据库文件保存到命名卷，不留在可被重建的容器层里。
      - db_data:/var/lib/mysql
      # 把宿主机初始化目录只读挂载给 MySQL；仅空数据目录首次启动时执行。
      - ./deploy/mysql-init:/docker-entrypoint-initdb.d:ro
    # 定义如何判断当前服务已准备好接收请求。
    healthcheck:
      # 下面的参数组成一次健康检查命令。
      test:
        # 通过容器里的 shell 执行下一行检查，支持环境变量与重定向。
        - CMD-SHELL
        # 用业务账号查分类模板表，检查可连接且表已建好；$$ 将变量留给容器内 shell。
        - MYSQL_PWD="$${MYSQL_PASSWORD}" mysql --protocol=TCP -h 127.0.0.1 -u"$${MYSQL_USER}" "$${MYSQL_DATABASE}" -e 'SELECT 1 FROM category_templates LIMIT 1' >/dev/null 2>&1
      # 设置两次健康检查之间的间隔。
      interval: 10s
      # 单次健康检查最多等待 5 秒。
      timeout: 5s
      # 连续失败达到该次数后，将容器标记为 unhealthy。
      retries: 18
      # 给予首次初始化宽限期，期间的失败不计入重试次数。
      start_period: 60s
    # 设置当前容器的日志保存方式，避免日志无限增长。
    logging:
      # 使用带轮转机制的 Docker local 日志驱动。
      driver: local
      # 设置日志轮转的大小和保留份数。
      options:
        # 单份日志达到约 10 MB 后轮转。
        max-size: "10m"
        # 最多保留 3 份日志文件。
        max-file: "3"
  # 定义 NestJS 后端服务。
  api:
    # 组合 API 镜像名与版本；缺少任一必填值就报错。
    image: ${API_IMAGE:?请设置API镜像}:${APP_VERSION:?请设置发布版本}
    # 进程退出后自动重启，并在主机重启后恢复；手动停止的容器不会自动恢复。
    restart: unless-stopped
    # 添加轻量 init 进程，帮助转发退出信号和回收子进程。
    init: true
    # 下面的参数会作为环境变量传入当前容器。
    environment:
      # 在启动 API 前设为 production，关闭 TypeORM 自动同步并启用生产认证行为。
      NODE_ENV: production
      # 将该容器的运行时区设置为 Asia/Shanghai。
      TZ: Asia/Shanghai
      # 让 NestJS 在容器内部监听 3000 端口。
      PORT: "3000"
      # 通过 Compose 服务名 db 连接 MySQL；这里不能写 localhost。
      DB_HOST: db
      # 连接 db 容器内部的 MySQL 3306 端口。
      DB_PORT: "3306"
      # 让 API 使用只有日常读写权限的业务账号。
      DB_USER: expense_app
      # 指定 API 连接本项目业务库，与 MYSQL_DATABASE 保持一致。
      DB_DATABASE: daily-expense-tracking
      # 设置 expense_app 业务数据库密码；API 与数据库初始化必须使用相同值。
      DB_PASSWORD: ${DB_PASSWORD:?请设置业务数据库密码}
      # 设置 Access Token 签名密钥，每个环境独立随机生成。
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET:?请设置Access密钥}
      # 设置 Access Token 有效期为 15 分钟。
      JWT_ACCESS_EXPIRES_IN: 15m
      # 设置 Refresh Token 签名密钥，不能与 Access 密钥相同。
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:?请设置Refresh密钥}
      # 设置 Refresh Token 有效期为 7 天。
      JWT_REFRESH_EXPIRES_IN: 7d
      # 设置当前部署的令牌签发者标识。
      JWT_ISSUER: daily-expense-tracking-production
      # 设置后端允许的完整网页来源，协议、域名和非默认端口要与浏览器一致。
      FRONTEND_ORIGIN: ${FRONTEND_ORIGIN:?请设置Web来源}
      # 设置验证码校验密钥，使用另一份独立随机值。
      VERIFICATION_CODE_SECRET: ${VERIFICATION_CODE_SECRET:?请设置验证码密钥}
      # 明确留空开发固定验证码；生产环境使用真实邮件验证码。
      DEV_VERIFICATION_CODE: ""
      # 填写邮箱服务商提供的 SMTP 主机地址。
      MAIL_HOST: ${MAIL_HOST:?请设置SMTP主机}
      # 填写 SMTP 端口，常用 587；以服务商要求为准。
      MAIL_PORT: ${MAIL_PORT:-587}
      # 配置连接时是否立即使用 TLS；常用 587=false、465=true。
      MAIL_SECURE: ${MAIL_SECURE:-false}
      # 填写用于发送验证码的完整邮箱账号。
      MAIL_USER: ${MAIL_USER:?请设置SMTP账号}
      # 填写 SMTP 授权码或应用专用密码，不要填示例占位符。
      MAIL_PASS: ${MAIL_PASS:?请设置SMTP授权码}
      # 设置发件人显示名称；真实发件地址由 MAIL_USER 指定。
      MAIL_FROM: 日常记账
      # 设置邮件验证码 5 分钟内有效。
      MAIL_CODE_EXPIRES_MINUTES: "5"
      # 设置同一邮箱重发验证码的最短间隔为 60 秒。
      MAIL_CODE_RESEND_SECONDS: "60"
    # 指定启动依赖，避免下游服务过早连接。
    depends_on:
      # 指定需要等待的数据库服务。
      db:
        # 等待上面指定的服务通过健康检查后再启动当前服务。
        condition: service_healthy
    # 定义如何判断当前服务已准备好接收请求。
    healthcheck:
      # 下面的参数组成一次健康检查命令。
      test:
        # 直接执行后面的程序和参数，不额外经过 shell。
        - CMD
        # 使用 API 镜像中已有的 Node 作为检查程序。
        - node
        # 告诉 Node 执行下一项 JavaScript 字符串。
        - -e
        # 向本容器 API 发送空登录请求；仅预期的 400 响应算健康，网络失败算不健康。
        - "fetch('http://127.0.0.1:3000/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>process.exit(r.status===400?0:1)).catch(()=>process.exit(1))"
      # 设置两次健康检查之间的间隔。
      interval: 30s
      # 单次健康检查最多等待 5 秒。
      timeout: 5s
      # 连续失败达到该次数后，将容器标记为 unhealthy。
      retries: 5
      # 给予首次初始化宽限期，期间的失败不计入重试次数。
      start_period: 40s
    # 设置当前容器的日志保存方式，避免日志无限增长。
    logging:
      # 使用带轮转机制的 Docker local 日志驱动。
      driver: local
      # 设置日志轮转的大小和保留份数。
      options:
        # 单份日志达到约 10 MB 后轮转。
        max-size: "10m"
        # 最多保留 3 份日志文件。
        max-file: "3"
  # 定义 Nginx 网页入口与 API 反向代理服务。
  web:
    # 组合 Web 镜像名和发布标签。
    image: ${WEB_IMAGE:?请设置Web镜像}:${APP_VERSION:?请设置发布版本}
    # 进程退出或服务器重启后恢复服务，手动停止的容器除外。
    restart: unless-stopped
    # 只有 Web 向宿主机发布端口。
    ports:
      # 将宿主机 HTTP 端口映射到容器 80，本地默认只绑定回环地址。
      - "${BIND_ADDRESS:-127.0.0.1}:${HTTP_PORT:-8080}:80"
      # 预留 HTTPS 映射；启用 HTTPS 配置后容器才会监听 443。
      - "${BIND_ADDRESS:-127.0.0.1}:${HTTPS_PORT:-8443}:443"
    # Nginx 只读取验证文件和证书，不负责修改它们。
    volumes:
      # 读取 Certbot 生成的 HTTP-01 域名验证文件。
      - certbot_www:/var/www/certbot:ro
      # 读取完整证书目录，包括 live 符号链接及其 archive 目标。
      - certbot_conf:/etc/letsencrypt:ro
    # 等后端就绪后再启动网页入口。
    depends_on:
      # 指定要等待的 API 服务。
      api:
        # 只有 API 健康后才启动 Web。
        condition: service_healthy
    # 限制容器日志占用的磁盘空间。
    logging:
      # 使用带轮转功能的本地日志驱动。
      driver: local
      # 配置每份日志大小及保留数量。
      options:
        # 每份日志最多约 10 MB。
        max-size: "10m"
        # 最多保留 3 份日志文件。
        max-file: "3"
  # 定义申请和续期证书的工具，不作为常驻业务服务启动。
  certbot:
    # 选择 Certbot 镜像；验证后可将变量固定到明确版本或 digest。
    image: ${CERTBOT_IMAGE:-certbot/certbot:latest}
    # 普通 up 不启动此服务，run certbot 时会按需启用。
    profiles: [tools]
    # Certbot 需要写入证书及验证文件，Nginx 挂载同一组卷只读访问。
    volumes:
      # 保存账户、续期配置、证书版本和私钥。
      - certbot_conf:/etc/letsencrypt
      # 写入 HTTP-01 验证文件供 Nginx 通过 80 端口返回。
      - certbot_www:/var/www/certbot
# 声明三个命名卷，删除或重建容器不会自动删除这里的数据。
volumes:
  # 保存数据库数据，正式项目名后续保持不变。
  db_data:
  # 保存证书与账户完整目录，按含私钥的敏感数据管理。
  certbot_conf:
  # 保存 HTTP-01 验证文件，Nginx 与 Certbot 共享。
  certbot_www:
```

三个网络地址不能混淆：浏览器使用域名或 `/api`；Web 容器通过 `api:3000` 访问后端；API 通过 `db:3306` 访问数据库。**容器里的 `127.0.0.1` 代表该容器自己**，因此 API 的 `DB_HOST` 不能照搬原非容器教程中的回环地址。

`db` 和 `api` 没有 `ports`，只有 Web 发布公网入口。`EXPOSE 3000` 不等于发布端口。健康检查中的 `$$` 用于把变量保留给容器内 shell；`${...}` 由本地 Compose 先展开。

`depends_on: service_healthy` 用于首次启动等待；它不是持续故障恢复系统。`unhealthy` 本身不会触发重启，重启策略主要响应进程退出；后续仍要观察日志、告警和业务状态。[Compose 启动顺序](https://docs.docker.com/compose/how-tos/startup-order/)

**这一小步的完成标志：**根目录出现 `compose.yaml`。写完此文件只定义了运行方案；Docker 此刻还没有为本项目创建容器。后面可以分别对它执行 pull（下载镜像）和 up（创建并启动）。

### 5.2 `compose.build.yaml`：只在需要构建时追加

```yaml
# 为需要本地构建的两个服务追加构建配置，与 compose.yaml 合并使用。
services:
  # 定义 NestJS 后端服务。
  api:
    # 追加本地构建信息；正式服务器只拉镜像时不需要这一段。
    build:
      # 指定构建上下文，Dockerfile 的 COPY 路径从这个目录开始解析。
      context: ./service-nest
      # 使用构建上下文里的 Dockerfile 作为构建说明书。
      dockerfile: Dockerfile
  # 定义网页与反向代理入口服务。
  web:
    # 追加本地构建信息；正式服务器只拉镜像时不需要这一段。
    build:
      # 指定构建上下文，Dockerfile 的 COPY 路径从这个目录开始解析。
      context: ./web
      # 使用构建上下文里的 Dockerfile 作为构建说明书。
      dockerfile: Dockerfile
```

生产部署先用 `compose.yaml` 以 HTTP 启动，取得证书后自动合并 `compose.override.yaml`；服务器不需要业务源码或构建工具。

`compose.build.yaml` 不是另一套应用，而是给同名的 `api`、`web` 服务补充“如何构建”的信息。本地使用两次 `-f` 合并运行清单和构建说明；生产服务器已经能下载成品镜像，所以无需业务源码和这份构建文件。

### 5.3 根目录 `.env.example`：生产配置模板

这里的 `.env.example` 必须创建在**仓库根目录**，不是 `service-nest` 目录；两个文件虽然同名，用途不同。

先认识四个名字：公开模板 `.env.example` 用来列出需要哪些值；本地复制成 `.env.local`；服务器复制成 `.env`；两份私有文件各自填写不同密码。Compose 先读取这些值，替换 YAML 中的 `${...}`，再把 `environment` 里列出的配置传给容器。只在 `.env` 写了一个变量，不代表所有容器都会自动收到它。

下面先保存模板，第 6 节填写本地值，第 9 节填写正式值。用户名、域名、版本、密码和 SMTP 资料都需要逐项核对，中文占位符不能原样使用。

```dotenv
# 指定 Compose 项目名；它决定容器、网络和卷的名称，正式部署后保持不变。
COMPOSE_PROJECT_NAME=expense
# 指定 API 镜像名；正式部署填自己的 Docker Hub 命名空间与仓库名，本地可用短名。
API_IMAGE=yourname/daily-expense-api
# 指定 Web 镜像名；与实际构建或推送的仓库名一致。
WEB_IMAGE=yourname/daily-expense-web
# 指定 API/Web 共用的镜像标签；正式环境必须是已经推送的版本。
APP_VERSION=20261016-1
# 选择 MySQL 镜像版本；验证后可进一步固定 digest。
MYSQL_IMAGE=mysql:8.4
# 指定按需使用的证书工具镜像；验证后固定版本或 digest。
CERTBOT_IMAGE=certbot/certbot:latest
# 设置后端允许的完整网页来源，协议、域名和非默认端口要与浏览器一致。
FRONTEND_ORIGIN=https://expense.example.com
# 指定入口绑定地址；127.0.0.1 仅本机可访问，0.0.0.0 接受外部 IPv4 连接。
BIND_ADDRESS=0.0.0.0
# 设置服务器或本机对外的 HTTP 端口，映射到 Web 容器的 80。
HTTP_PORT=80
# 设置服务器或本机对外的 HTTPS 端口，映射到 Web 容器的 443。
HTTPS_PORT=443
# 设置首次建库的管理员密码，使用独立随机值；不会自动更改已有数据库账号。
MYSQL_ROOT_PASSWORD=替换为独立随机管理员密码
# 设置 expense_app 业务数据库密码；API 与数据库初始化必须使用相同值。
DB_PASSWORD=替换为独立随机业务密码
# 设置 Access Token 签名密钥，每个环境独立随机生成。
JWT_ACCESS_SECRET=替换为独立随机Access密钥
# 设置 Refresh Token 签名密钥，不能与 Access 密钥相同。
JWT_REFRESH_SECRET=替换为独立随机Refresh密钥
# 设置验证码校验密钥，使用另一份独立随机值。
VERIFICATION_CODE_SECRET=替换为独立随机验证码密钥
# 填写邮箱服务商提供的 SMTP 主机地址。
MAIL_HOST=替换为邮箱商SMTP主机
# 填写 SMTP 端口，常用 587；以服务商要求为准。
MAIL_PORT=587
# 配置连接时是否立即使用 TLS；常用 587=false、465=true。
MAIL_SECURE=false
# 填写用于发送验证码的完整邮箱账号。
MAIL_USER=替换为完整发信邮箱
# 填写 SMTP 授权码或应用专用密码，不要填示例占位符。
MAIL_PASS=替换为SMTP授权码
```

将 `yourname` 改成自己的 Docker Hub 命名空间；五个密码/密钥字段各用独立随机值，正式环境与本地环境也分别生成。Ubuntu/macOS 可以执行：

```bash
# 生成一个 32 字节随机值；五个密码/密钥字段各自执行一次，不要复用输出。
openssl rand -hex 32
```

装有 Python 的 Windows 也可执行下面的命令，然后把输出手工填进对应字段：

```powershell
# 生成一个 32 字节随机值并以 64 个十六进制字符输出；每个密码或密钥都要重新生成一次。
python -c "import secrets; print(secrets.token_hex(32))"
```

587 通常对应 `MAIL_SECURE=false`，465 通常对应 `true`，以邮箱商要求为准。`MAIL_FROM` 在本项目中是显示名称，发信地址取 `MAIL_USER`。

**两层配置的区别：** 根目录 `.env` 或 `--env-file` 提供 Compose 插值；只有 YAML 中 `environment` 明确列出的字段才进入相应容器。API 通过进程环境接收这些值，Nest ConfigModule 可以直接读取，所以无需把 `service-nest/.env.production` 打包进去，管理员数据库密码也不会传给 API。[Compose 环境变量插值](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)

值包含 `$` 时，Compose 环境文件可使用单引号保留字面值；`#`、空格也要按环境文件规则处理。建议随机密码使用十六进制，避免转义混淆。示例中的中文占位符非空，Compose 不会替你识别它们，必须全部替换。

### 5.4 `compose.https.yaml`：申请证书后才启用的 HTTPS 覆盖模板

**这份文件做什么：**让正式 Web 容器改用第 4.4 节的 HTTPS 配置；本地预演继续使用镜像里的 HTTP 配置。

**本地根目录新建 `compose.https.yaml`：**

```yaml
# 仅覆盖已有 Web 服务的一项挂载，其他服务和端口沿用 compose.yaml。
services:
  # 为 Nginx 网页入口追加正式配置。
  web:
    # 只读挂载服务器上的 HTTPS 配置文件。
    volumes:
      # 覆盖镜像里的 HTTP 站点；宿主机文件必须存在且已替换域名。
      - ./deploy/nginx/https.conf:/etc/nginx/conf.d/default.conf:ro
```

先不要在本地把它改名。第 10 节拿到正式证书后，在服务器复制为 `compose.override.yaml`；后续不带 `-f` 的 `docker compose` 会自动合并 `compose.yaml` 和这个覆盖文件，持续使用 HTTPS。显式传 `-f` 时必须把需要的覆盖文件一起列出。[Compose 文件合并说明](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/)

## 6. 在电脑上一步步启动，先确认本地能运行

**这一步做什么、有什么用：**先在自己的电脑跑通“数据库 → API → Nginx”，把构建、配置、建表和代理问题留在本地解决。

**在哪里做、怎样算完成：**本地仓库根目录的 PowerShell；Docker Desktop 已启动，第 4～5 节文件已保存。完成时应看到 3 个业务容器、本地首页 200、空登录请求 400 JSON。Mac 使用对应终端和 curl 命令。

### 6.1 先创建并编辑本地配置

先复制模板；如果 `.env.local` 已存在，只编辑已有文件，不要覆盖已保存的密码。

```powershell
# 首次预演时从模板创建本地私有配置。
Copy-Item .env.example .env.local
# 用记事本打开刚创建的文件，按下面的说明编辑并保存。
notepad .env.local
```

Mac 对应复制命令如下，然后用自己的编辑器打开 `.env.local`：

```bash
# 首次预演时复制一份本地私有配置。
cp .env.example .env.local
```

先给模板中的 5 个密码/密钥字段各生成一个随机值，并填写真实 SMTP。然后把同一文件中的下列字段改成本地值；这是修改部分字段，不是删掉其他字段后只留下这几行。

```dotenv
# 给本地预演单独命名，避免与云端数据卷混淆。
COMPOSE_PROJECT_NAME=expense-local
# 使用本地 API 镜像名，不需要填写 Docker Hub 用户名。
API_IMAGE=daily-expense-api
# 使用本地 Web 镜像名。
WEB_IMAGE=daily-expense-web
# 把这次预演镜像的版本标记为 local。
APP_VERSION=local
# 本地网页的完整来源，端口必须与 HTTP_PORT 一致。
FRONTEND_ORIGIN=http://localhost:8080
# 仅允许自己的电脑通过回环地址访问预演入口。
BIND_ADDRESS=127.0.0.1
# 浏览器访问本机 8080，转发到 Nginx 容器的 80。
HTTP_PORT=8080
# 只预留本机 8443 映射；本地 HTTP 配置不监听 HTTPS。
HTTPS_PORT=8443
```

**应该得到：**一个填好真实值的 `.env.local`。API 完整镜像名由两段拼成：`API_IMAGE` 加冒号和 `APP_VERSION`，所以本地会是 `daily-expense-api:local`。Web 同理为 `daily-expense-web:local`。

### 6.2 执行前先读懂命令的固定前半段

后面多条命令都重复 `docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml`。它只是说“用本地配置，把这两份清单合并起来”；末尾的 build、pull、up、ps 才是本次动作。这里故意不定义命令别名，便于看清每次执行的完整内容。

| 写法 | 意思 |
| --- | --- |
| `--env-file .env.local` | 读取本地私有配置；不读取云服务器的正式密码 |
| `-f compose.yaml` | 读取服务、网络、卷等运行定义 |
| `-f compose.build.yaml` | 再补上 API/Web 的源码构建方式，顺序不能反过来 |
| `config --quiet` | 检查配置和必填变量；成功时不打印完整内容，避免输出密码 |

```powershell
# 先检查文件、缩进和必填变量，正常时没有输出。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml config --quiet
```

**通过后再继续。**出现“找不到文件”先核对当前目录；出现变量缺失先编辑 `.env.local`。这个检查不负责识别中文占位符是否已替换，需要你自己核对。

### 6.3 明确下载官方 MySQL，不自己制作数据库镜像

`pull db` 是下载 db 服务的镜像。这里会根据 `MYSQL_IMAGE=mysql:8.4` 取得官方 MySQL，尚未创建数据库容器。

```powershell
# 下载官方 MySQL 镜像；已有相同镜像层时会复用本地缓存。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml pull db
```

**应该看到：**镜像下载完成或镜像已是可用状态。网络错误先处理网络，不要改初始化 SQL 来解决镜像下载失败。

### 6.4 构建 API 与 Web，仍然不上传、不启动

下面的 build 只处理两个有构建说明的服务。Docker 会在构建过程中下载 Dockerfile 的 Node、Nginx 基础镜像，再安装依赖、编译源码，并生成自己的应用镜像。

```powershell
# 按两个 Dockerfile 构建本地 API 和 Web 镜像。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml build api web
# 列出本机镜像，核对是否出现两个应用名和 local 标签。
docker image ls
```

**应该看到：**`daily-expense-api`、`daily-expense-web` 的标签是 `local`。此时得到的是镜像，Desktop 的 Images 页面能看到它们，Containers 页面还不一定有本项目。构建失败就先看最后一段错误，是 npm 下载失败还是 TypeScript 编译失败；不要继续 up。

### 6.5 先启动数据库，核对首次建表

先解释这次启动参数：`up` 表示创建并启动；`-d` 让容器在后台运行；`--wait` 等待健康检查通过；`--wait-timeout 300` 最多等 300 秒；末尾 `db` 表示此时只启动数据库。

```powershell
# 启动数据库并等待它完成首次初始化。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml up -d --wait --wait-timeout 300 db
# 查看数据库状态，预期是 running 且 healthy。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml ps db
```

第一次会创建空数据卷，并执行挂载的 `01-init.sql` 和 `02-app-grants.sql`。`exec` 可以在已经运行的容器里执行命令；这里先用 `exec db sh` 进入 db 容器自己的 shell，再执行查询，避免不同 Windows PowerShell 版本对复杂引号的传递差异。

```powershell
# 在本地 PowerShell 打开 db 容器的 shell，下一段命令在该容器提示符里执行。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml exec db sh
```

**现在临时位于本地 db 容器内部。**下面用容器已经收到的账号和密码查询；美元变量保持原样，不要替换成明文。执行完查询后，第二条 exit 返回电脑的 PowerShell/Mac 终端，再继续后面的 Compose 命令。

```bash
# 用容器内的业务账号检查表、图标数和分类模板数。
MYSQL_PWD="$MYSQL_PASSWORD" mysql -u"$MYSQL_USER" "$MYSQL_DATABASE" -e 'SHOW TABLES; SELECT COUNT(*) AS icon_count FROM category_icons; SELECT COUNT(*) AS template_count FROM category_templates;'
# 退出数据库容器的 shell，回到本地终端。
exit
```

**全新库预期：**9 张表，图标数 112，模板数 84。超时或报错时先看日志；`--tail=100` 表示只查看最近 100 行，不是再启动服务。

```powershell
# 数据库启动失败时读取日志，修复后再重试当前小步骤。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml logs --tail=100 db
```

不要通过删卷重复初始化来掩盖错误。已有卷不会因为改了 SQL、密码或重建容器而重新建库。

### 6.6 再启动 API 和 Web，检查真实请求

下面不再限定服务，Compose 会保留已经健康的 db，并继续启动 api、web；带工具标记的 Certbot 不会常驻启动。

```powershell
# 在数据库准备好后启动整套业务应用。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml up -d --wait --wait-timeout 300
# 核对三个业务服务状态，db/api 应 healthy，web 应运行中。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml ps
```

浏览器打开 `http://localhost:8080`。下面再用 Windows 的 `curl.exe` 请求入口；`-I` 查看响应头，`-i` 同时显示响应头和内容，`-X POST` 指定 POST，`-H` 设置请求类型，`--data '{}'` 故意发送空对象。

```powershell
# 检查首页是否返回 200。
curl.exe -I http://localhost:8080
# 检查 Nginx 是否把空登录请求交给 NestJS，预期 400 且内容为 JSON。
curl.exe -i -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" --data '{}'
```

Mac 把 `curl.exe` 换成 `curl`，其他参数不变。空登录请求的 400 是因为没有填写邮箱和密码，在这个测试里是预期结果；如果返回 HTML，说明落到了网页路由，不是 API。若出现 502，先看 api 是否健康。

```powershell
# 有启动或请求错误时查看各服务最近日志，先找到最早失败的一层。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml logs --tail=100 db api web
```

前端页面和子路由刷新也应正常。本地 API 仍以 production 模式运行，真实验证码需要 SMTP，Refresh Cookie 使用 Secure，因此本地 HTTP 不作为最终登录会话验收；云端完成 HTTPS 后，第 11 节再做完整注册、登录和流水验收。

### 6.7 停止预演，再进入发布阶段

确认当前目录与项目名都是本地后，再执行 down。它停止并移除容器和网络，保留命名卷；不要加会删除卷的 `-v`。

```powershell
# 停止本地预演，但保留本地数据库卷中的数据。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml down
```

**本节结束时：**电脑里已有两个 `:local` 应用镜像和官方 MySQL 镜像，本地数据库保存在本地卷里。它们都还没有上传到镜像仓库，云服务器也还没有运行应用。下一节专门处理“构建发布版本、打标签、上传”。

## 7. 发布镜像：构建、打标签、登录、推送逐项完成

**这一步做什么、有什么用：**把本地验证过的源码做成目标服务器可下载的正式版本。

**在哪里做、怎样算完成：**全程在本地仓库根目录执行；Docker Desktop 保持运行，第 6 节已通过。知道服务器 CPU 架构，并准备好 Docker Hub 账号。完成时必须在远程仓库看到两个完整版本标签，只有本地有镜像不算完成发布。

### 7.1 先确定这次发布的名字，创建两个远程仓库

本节使用版本 `20261016-1`。它只是一个版本名，不要求当天发布。下一次发布改成新标签，不能覆盖正在使用的旧标签。

打开 [Docker Hub](https://hub.docker.com/)，登录自己的账号，进入 Repositories，创建两个仓库：`daily-expense-api` 和 `daily-expense-web`。选择自己账号的命名空间；需要保密时设为 Private。记下你真正的 Docker Hub 用户名，后面所有 `yourname` 都替换成它。GitHub 用户名不一定与它相同。

| 本地构建后使用的名字 | 需要上传到的完整仓库名 |
| --- | --- |
| `daily-expense-api:20261016-1` | `yourname/daily-expense-api:20261016-1` |
| `daily-expense-web:20261016-1` | `yourname/daily-expense-web:20261016-1` |

完整名里的 `yourname` 是仓库所属账号，`daily-expense-api` 是仓库名，冒号后是版本。没有额外指定仓库主机时，Docker 默认使用 Docker Hub。第 9 节服务器配置必须拼出与右栏完全相同的名字。[镜像名字和标签](https://docs.docker.com/reference/cli/docker/image/tag/)

### 7.2 第一步：只构建发布镜像，不上传

本地预演用了 `:local`，这次生成正式版本 `:20261016-1`。之所以再构建一次，是要显式指定云服务器的平台；Mac 本地与云服务器可能使用不同 CPU 架构。

下面按服务器 `x86_64` 演示。如果第 3.3 节确认是 `aarch64`，两条构建命令都改用 `linux/arm64`。不要为了使用同一条命令，把 ARM 服务器当作 amd64。

执行前先看参数：

| 参数或位置 | 表示什么 |
| --- | --- |
| `docker build` | 根据 Dockerfile 构建镜像；当前主线使用 Docker Desktop 默认构建器 |
| `--platform linux/amd64` | 产物要能在 Linux amd64 服务器运行，与 Windows 宿主系统不同 |
| `--file service-nest/Dockerfile` | 从仓库根目录找到 API 的 Dockerfile；`--file` 也可以缩写成 `-f` |
| `--tag daily-expense-api:20261016-1` | 给构建结果一个本地名字和版本；这里的 `--tag` 常缩写为 `-t` |
| 末尾的 `service-nest` | 构建上下文，即 Dockerfile 中 COPY 能读取的源码目录；它不是遗漏的参数名 |

先构建 API，等待成功再构建 Web。现代 Docker 的 build 内部使用 BuildKit/Buildx，但本节不需要把上传动作合并进去。[Docker 构建说明](https://docs.docker.com/build/builders/)

```powershell
# 仅在电脑里构建 API 发布镜像，读取后端目录中的源码和锁文件。
docker build --platform linux/amd64 --file service-nest/Dockerfile --tag daily-expense-api:20261016-1 service-nest
# API 构建成功后，仅在电脑里构建 Web 发布镜像。
docker build --platform linux/amd64 --file web/Dockerfile --tag daily-expense-web:20261016-1 web
```

**完成标志：**两次构建均成功结束，没有 npm、类型检查或编译错误。这个时候镜像仍在自己的电脑里，不在 Docker Hub，也没有启动新的容器。

### 7.3 第二步：查看本地镜像，确认发布标签存在

`docker image ls` 只查询本机镜像列表，传入镜像名可以缩小结果范围。

```powershell
# 核对 API 的本地列表，必须有 20261016-1 标签。
docker image ls daily-expense-api
# 核对 Web 的本地列表，必须有同一个发布标签。
docker image ls daily-expense-web
```

如果只有 `local` 而没有 `20261016-1`，上一小步没有得到本次版本，先处理再继续。

### 7.4 第三步：给镜像添加用于上传的完整名字

`docker tag` 的顺序是“现有镜像 → 新名字”。它为同一镜像增加一个名字，不重新编译，也不上传一份文件。例如自己的用户名为 `alice`，右侧应写成 `alice/daily-expense-api:20261016-1`；下面仍用 `yourname` 提醒你替换。

```powershell
# 给已经构建的 API 镜像增加自己的 Docker Hub 仓库全名。
docker tag daily-expense-api:20261016-1 yourname/daily-expense-api:20261016-1
# 给同版本 Web 镜像增加自己的 Docker Hub 仓库全名。
docker tag daily-expense-web:20261016-1 yourname/daily-expense-web:20261016-1
# 核对旧名和仓库全名都出现在本地列表中。
docker image ls
```

**应该看到：**本地短名与对应的 `yourname/...` 全名指向相同镜像（常见显示为相同 IMAGE ID），不是重复编译了两份程序。若报 `No such image`，核对源名字、版本以及上一小步的构建结果。

### 7.5 第四步：在这台电脑登录 Docker Hub

这里登录的是镜像仓库，不是 Ubuntu。`--username` 用来明确指定准备上传的账号；按 CLI 提示提供该账号的访问令牌，用户名必须与仓库所属账号匹配。

```powershell
# 以自己的 Docker Hub 用户名登录本机 Docker 客户端，按提示输入访问令牌。
docker login --username yourname
```

**预期：**显示 `Login Succeeded`。需要令牌时在 Docker Hub 的账号设置中创建有上传权限的 Personal Access Token，作为提示中的密码输入，不把令牌写进命令。登录失败先处理账号和权限，不能指望 push 自动修好。

### 7.6 第五步：明确执行 push，把两个镜像上传

**下面这两行才是上传动作。** 参数是刚才 tag 得到的仓库全名，必须包含用户名、仓库名和版本；`docker push` 不会读取源码，也不会重新执行 npm build。[Docker push 说明](https://docs.docker.com/reference/cli/docker/image/push/)

```powershell
# 把当前 API 发布镜像上传到自己的 Docker Hub API 仓库。
docker push yourname/daily-expense-api:20261016-1
# API 推送成功后，把同版本 Web 镜像上传到 Web 仓库。
docker push yourname/daily-expense-web:20261016-1
```

**完成标志：**两条命令均成功，通常末尾显示该标签的 `digest: sha256:...`。出现 `Layer already exists` 表示仓库已有这一层，可正常复用。出现 `denied`、`unauthorized` 或仓库不存在，先核对登录账号、仓库名及权限，不继续服务器部署。

### 7.7 第六步：去远程仓库核对，不只看 Desktop 的 Images

在 Docker Hub 网页分别打开两个仓库的 Tags 页面，确认都有 `20261016-1`。也可以执行下面的只读查询；`docker buildx imagetools inspect` 是查看远程镜像信息，本命令不构建、不上传，也不启动容器。

```powershell
# 查询 Docker Hub 上的 API 标签、平台和镜像摘要。
docker buildx imagetools inspect yourname/daily-expense-api:20261016-1
# 查询 Docker Hub 上的 Web 标签、平台和镜像摘要。
docker buildx imagetools inspect yourname/daily-expense-web:20261016-1
```

确认目标平台与服务器一致。摘要 digest 是镜像内容的标识，可以连同源码提交 ID、版本名一起记录；第一次只需记住“远程标签存在，平台正确”，不必先学习摘要锁定。

**本节结束时：**两个应用发布包已在镜像仓库。官方 MySQL 和 Certbot 无需自己构建或推送；服务器会直接下载官方镜像。Ubuntu 仍未运行应用，下一步准备服务器，第 10 节才会明确执行 pull 和 up。

### 7.8 选读：为什么以前一条 build 命令里会出现 --push

Buildx 提供 `--push`，表示构建完成后顺便上传，是“构建 + 推送”的合并写法。为了让首次学习能分清动作，主线已经拆成 build、tag、push，照做时不需要再补执行合并写法。

只有一份发布物要同时支持 amd64 和 arm64 时，才需要进一步学习多平台构建、清单与仓库导出；不能仅把上面的单平台参数换成逗号列表，再假定普通本地镜像存储和 push 的行为完全一样。掌握主线后再参考 [Docker 多平台构建](https://docs.docker.com/build/building/multi-platform/)。

## 8. 准备 Ubuntu 云服务器

**这一步做什么、有什么用：** 准备一个能接收公网请求并长期运行容器的 Ubuntu 环境。

**在哪里做、怎样算完成：** DNS 和安全组在云平台配置；安装与权限在服务器配置。完成后能用 deployer 登录并运行 Docker。

### 8.1 创建服务器、配置域名和公网入口

到这里，你已经完成的是“发布包在镜像仓库”，接下来才操作云服务器。本节会在云平台、本地终端、服务器终端之间切换，先把窗口区分开：

- **窗口 A：本地 PowerShell。** 进入本地仓库目录，后面运行 scp 上传文件，也从这里打开 SSH 连接。
- **窗口 B：服务器 SSH 终端。** 本地执行 ssh 并登录成功后，这个终端里的命令就运行在 Ubuntu 上。窗口提示符通常变为 `用户名@服务器名`。后面明确标“服务器”的命令都在这里执行。

**第一步，在云控制台创建或选定服务器。**系统选 Ubuntu 24.04 LTS、64 位、UEFI。记录公网 IPv4、初始登录账号（例如 ubuntu 或 root）、SSH 端口，以及登录密码或私钥文件。CPU 架构要与第 7 节构建平台一致；如果不一致，先回第 7 节为正确平台构建并推送新版本。

**第二步，设置 DNS，把域名指向这台服务器。**在域名服务商的 DNS/解析管理页添加 A 记录。假设你拥有 `example.com`，计划用 `expense.example.com`：

| DNS 字段 | 应填写什么 |
| --- | --- |
| 记录类型 | A，表示指向一个 IPv4 地址 |
| 主机记录/名称 | 通常填 `expense`；有的平台要求完整域名，以平台说明为准 |
| 记录值 | 你的服务器公网 IPv4，例如实际使用的那一个地址 |
| TTL | 可以先用平台默认值，修改后需等待缓存更新 |

`example.com` 是文档示例，必须换成自己拥有的域名。不使用 IPv6 时不要留一个指向错误地址的 AAAA 记录；证书机构可能优先尝试它。

**第三步，在云平台设置安全组。**安全组是云平台在服务器外层设置的访问规则。进入该实例绑定的安全组/防火墙页面，添加入站允许规则：

| 入站端口 | 来源 | 作用 |
| --- | --- | --- |
| TCP 22，或实际 SSH 端口 | 自己的管理公网 IP | 让你的电脑登录服务器 |
| TCP 80 | 公网 | 网页初始访问、证书域名验证和后续跳转 |
| TCP 443 | 公网 | 正式 HTTPS 访问 |

公网 IPv4 来源常写为 `0.0.0.0/0`，表示所有 IPv4 地址；只为 80/443 开放这个范围。3000、3306、2375 不开放到公网。出站连接需要能访问 DNS、软件源、镜像仓库、证书机构和 SMTP。

**第四步，在窗口 A 检查域名。**`Resolve-DnsName` 是 Windows DNS 查询命令，`-Type A` 只查 IPv4 记录；Mac 可在域名平台查询状态，或在安装了 dig 的终端执行对应查询。

```powershell
# 查询自己的正式子域名，检查返回的 IPAddress 是否等于真实服务器公网 IP。
Resolve-DnsName expense.example.com -Type A
```

**预期：**返回你记录的公网 IPv4。旧地址或查不到时先检查 DNS，不能仅因为云控制台显示“已保存”就认定解析已经生效。

**第五步，从窗口 A 登录服务器。**`ssh 账号@地址` 建立远程终端。使用云平台提供的真实初始账号；下面的 ubuntu 只是示例。首次连接先核对云平台给出的主机指纹，确认后按提示输入 yes。

```powershell
# 登录服务器的初始管理员；登录成功后，这个窗口就成为服务器窗口 B。
ssh ubuntu@203.0.113.10
```

密码登录时输入内容不会显示字符，这是正常现象。如果云平台要求私钥或自定义 SSH 端口，先用下面的完整写法代替上一行；`-i` 指定你电脑上的私钥，`-p` 指定 SSH 端口。两条登录命令只选适合自己的一条。

```powershell
# 使用指定私钥和自定义端口登录，先替换路径、2222、账号和 IP。
ssh -i "$env:USERPROFILE/.ssh/id_ed25519" -p 2222 ubuntu@203.0.113.10
```

**预期：**看到 Ubuntu 欢迎信息，提示符变为服务器账号。超时先检查 IP、SSH 端口和安全组；`Permission denied` 先检查账号、密码或私钥。没有登录成功就不要把后面的 sudo、apt 命令粘到本地运行。

Mac 的 ssh 参数相同，私钥路径换成自己的实际路径。以后所有登录和上传都沿用相同真实端口与密钥；SCP 的端口参数会用大写 `-P`，到第 9 节再实际执行上传。

### 8.2 创建部署用户和目录

先解释下面的主机管理操作：`sudo` 表示以管理员权限执行，可能要求输入当前账号密码；`adduser` 创建 Ubuntu 用户；`usermod -aG` 给用户追加一个组；`/opt/expense` 是我们约定的正式部署目录，与本地源码目录相互独立。

`deployer` 是部署账号示例，不要求与 Docker Hub 用户名相同。已有这个账号时跳过 adduser，后续继续核对权限和登录方式。不要把“创建 Ubuntu 用户”理解为“创建应用里的记账用户”。

**服务器管理员终端：**

```bash
# 创建日常部署账号，并按提示设置该账号密码；账号已存在时跳过。
sudo adduser deployer
# 允许部署账号使用 sudo 管理主机。
sudo usermod -aG sudo deployer
# 创建部署目录并交给 deployer 管理，其他用户不能随意写入。
sudo install -d -o deployer -g deployer -m 750 /opt/expense
```

如果已有 deployer，跳过创建账号。接着配置该用户的 SSH 登录，否则后面的 scp 会没有可用的登录方式。

现在保持服务器管理员窗口 B 打开，回到电脑再新开一个本地 PowerShell 窗口 A。先准备要给 deployer 使用的 SSH 公钥，再编辑服务器授权文件：公钥 `.pub` 可以复制到服务器，配套的私钥只留在自己的电脑。

如果已经有用于登录的密钥，继续使用它并找对应 `.pub` 文件；**不要生成新密钥覆盖已有文件**。确实没有可用密钥时，先在本地执行下面一条，按提示保存到一个未占用的路径，可设置私钥口令；后面查看和登录要使用你刚保存的实际文件名。

```powershell
# 仅在没有可用密钥时生成新的密钥对，提示覆盖已有文件时选择否。
ssh-keygen -t ed25519
```

**本地 Windows PowerShell**，查看用于服务器登录的公钥。这里假定密钥名为 id_ed25519；云平台使用其他名称时改为对应的 `.pub` 文件：

```powershell
# 显示 SSH 公钥，复制完整的一行；没有此文件时使用自己实际登录密钥对应的公钥。
Get-Content "$env:USERPROFILE/.ssh/id_ed25519.pub"
```

**服务器原管理员 SSH 窗口**，保持此窗口不断开：

```bash
# 刷新系统软件包索引，为安装编辑器做准备。
sudo apt update
# 安装下面用于编辑公钥和配置的 nano。
sudo apt install -y nano
# 创建 deployer 的 SSH 目录，设定所有者和严格访问权限。
sudo install -d -o deployer -g deployer -m 700 /home/deployer/.ssh
# 粘贴刚才复制的公钥，一行一把；已有内容时追加，不能粘贴私钥。
sudo nano /home/deployer/.ssh/authorized_keys
# 将公钥文件的所有者交给 deployer。
sudo chown deployer:deployer /home/deployer/.ssh/authorized_keys
# 限制公钥文件只有 deployer 可读写，满足 SSH 的权限要求。
sudo chmod 600 /home/deployer/.ssh/authorized_keys
```

编辑器打开后，把本地 `.pub` 文件的完整一行粘进去。如果原来有其他公钥，就追加在新行，保留原内容。`700` 表示 SSH 目录只有所有者能进入，`600` 表示授权文件只有所有者能读写；这些权限是登录检查的一部分。

nano 保存方法：`Ctrl+O`、回车、`Ctrl+X`。Mac 在本地查看 `~/.ssh/` 中实际使用的 `.pub` 公钥即可。

**本地新开一个终端窗口**，测试登录：

```powershell
# 测试部署用户能否登录；有多把密钥时用 -i 指定实际私钥路径。
ssh deployer@203.0.113.10
```

登录成功后可在新窗口继续第 8.3 节。`adduser` 设置的密码用于后面的 sudo；不要在尚未验证 deployer 登录前关闭管理员连接。

### 8.3 安装 Docker Engine 与 Compose

下面针对**新装 Ubuntu 24.04 LTS 64 位 UEFI 版**，Docker 官方支持该系统版本。已装其他 Docker/containerd 发行包时，先按官方文档核对冲突，勿直接卸载运行其他应用的运行时。[Docker Ubuntu 安装文档](https://docs.docker.com/engine/install/ubuntu/)

在云平台选择镜像时，选择 Ubuntu 24.04、64 位、UEFI 启动。UEFI 是服务器的启动方式，不需要为它修改 Dockerfile、Nginx 或 Compose。镜像的 CPU 平台仍按第 3.3 节的 `uname -m` 结果选择，不能仅凭“64 位”判断为 amd64。

**先在服务器宿主机的 SSH 终端核对实际系统版本和启动方式，不在容器内执行，也不以云平台的镜像名称或制作日期代替发行版版本号：**

```bash
# 显示真实系统名称、版本号与发行代号，确认安装命令对应当前服务器。
cat /etc/os-release
# 查看系统用户空间位数，本教程预期输出 64。
getconf LONG_BIT
# 检查当前服务器是否通过 UEFI 启动；本教程预期输出 UEFI。
if [ -d /sys/firmware/efi ]; then printf '%s\n' UEFI; else printf '%s\n' '非 UEFI（Legacy BIOS）'; fi
```

本教程预期 `ID=ubuntu`、`VERSION_ID="24.04"`、`VERSION_CODENAME=noble`，系统位数为 `64`，启动方式为 `UEFI`。24.04.x 维护版本仍使用 `noble` 代号。[Ubuntu 官方版本列表](https://ubuntu.com/project/docs/release-team/list-of-releases/)

UEFI 检测依据是当前系统是否存在 `/sys/firmware/efi` 目录。[Ubuntu UEFI 启动检查说明](https://help.ubuntu.com/community/UEFI)

若实际输出不同，先核对 Docker 对该版本的支持情况。下面的软件源配置会自动读取实际发行代号；不要手工改成其他代号来绕过安装错误。

接下来分清两个软件来源：`apt` 是 Ubuntu 安装软件的工具；这里给 apt 加入 Docker 官方软件源，再让 apt 安装 Docker Engine 和 Compose。Node、MySQL、Nginx 后面都从容器镜像运行，不在宿主机重复安装。

下面的签名密钥用于验证安装包来源，和你的 SSH 密钥、数据库密码都不是同一回事。读取 `/etc/os-release` 是为了自动选 `noble` 软件源；后面的 `docker_repo_suite`、`docker_repo_arch` 是临时 shell 变量，不需要写进应用 `.env`。

**服务器执行：**

```bash
# 刷新 Ubuntu 软件包索引。
sudo apt update
# 安装下载工具、证书、编辑器、随机密钥工具和主机防火墙。
sudo apt install -y ca-certificates curl nano openssl ufw
# 创建 apt 存放仓库签名密钥的目录。
sudo install -m 0755 -d /etc/apt/keyrings
# 下载 Docker 官方软件仓库签名密钥。
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
# 让 apt 能读取签名密钥。
sudo chmod a+r /etc/apt/keyrings/docker.asc
# 读取 Ubuntu 版本信息，供下一行选择对应的软件包发行版。
. /etc/os-release
# 保存 Ubuntu 发行版代号；Ubuntu 24.04 LTS 对应 noble，从系统信息自动读取。
docker_repo_suite="${UBUNTU_CODENAME:-$VERSION_CODENAME}"
# 检测主机 CPU 架构，用于选择匹配的 Docker 软件包。
docker_repo_arch="$(dpkg --print-architecture)"
# 写入 Docker 官方 apt 源；printf 的各个字符串分别成为源文件中的一行。
printf '%s\n' 'Types: deb' 'URIs: https://download.docker.com/linux/ubuntu' "Suites: $docker_repo_suite" 'Components: stable' "Architectures: $docker_repo_arch" 'Signed-By: /etc/apt/keyrings/docker.asc' | sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null
# 再次刷新索引，让 apt 识别刚添加的 Docker 仓库。
sudo apt update
# 安装 Docker 引擎、客户端、容器运行时、Buildx 与 Compose 插件。
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
# 立即启动 Docker，并设置为开机自启。
sudo systemctl enable --now docker
# 下载并运行官方测试镜像，成功后自动删除测试容器。
sudo docker run --rm hello-world
# 允许 deployer 直接管理 Docker；退出 SSH 并重新登录后才生效。
sudo usermod -aG docker deployer
# 统一服务器时区，后面的每日备份时间按此时区执行。
sudo timedatectl set-timezone Asia/Shanghai
```

**预期结果：**安装过程没有报错，hello-world 输出说明镜像拉取和容器运行成功的信息，然后测试容器自动删除。最后两条给 deployer 添加 Docker 权限并设置服务器时区；添加组不会立刻改变当前 SSH 会话。

现在需要真正退出并重新登录，而不是继续在旧窗口测试：

**服务器窗口 B：**

```bash
# 退出当前 SSH 会话，命令完成后回到本地终端。
exit
```

**回到本地窗口后：**

```powershell
# 重新登录部署账号，让刚添加的 docker 组权限生效；有自定义参数时继续带上。
ssh deployer@203.0.113.10
```

后面使用这个重新登录的服务器窗口 B。先核对下面四项，再继续防火墙配置。

docker 组具有相当于 root 的主机管理能力，仅授予可信部署用户。**退出 SSH 后重新以 deployer 登录**，让组权限生效；后文 Docker 命令均在 deployer 下执行。

```bash
# 查看当前用户与所属组，确认当前为 deployer 且已加入 docker 组。
id
# 检查部署用户能否连接 Docker 引擎。
docker version
# 检查服务器已安装 Compose 插件。
docker compose version
# 确认 Docker 服务已设置开机自启，预期输出 enabled。
sudo systemctl is-enabled docker
```

### 8.4 防火墙与端口检查

云安全组在服务器外层，UFW 是 Ubuntu 主机自己的防火墙。下面两层都要允许需要的连接。先确认真实 SSH 端口再启用 UFW，保持当前 SSH 窗口不要关闭；提示是否继续时确认已放行自己的 SSH 端口后再输入 y。

```bash
# 先放行 SSH，防止启用防火墙后无法登录；自定义 SSH 端口须替换 22。
sudo ufw allow 22/tcp
# 放行 HTTP，供证书验证和跳转 HTTPS 使用。
sudo ufw allow 80/tcp
# 放行 HTTPS，供浏览器访问正式网站。
sudo ufw allow 443/tcp
# 将未单独允许的入站连接默认拒绝。
sudo ufw default deny incoming
# 允许服务器主动访问镜像仓库、DNS、SMTP 等外部服务。
sudo ufw default allow outgoing
# 启用 UFW；确认 SSH 规则无误后按提示确认。
sudo ufw enable
# 列出当前规则及编号，检查实际放行端口。
sudo ufw status numbered
# 查看正在监听的端口，确认 80 和 443 没有被旧服务占用。
sudo ss -lntp
```

**本小节完成标志：**规则列表包含实际 SSH、80、443；`ss -lntp` 没有显示其他进程占用 80/443。`LISTEN` 表示某个进程在等连接；如果这里已有旧网站，先确认它属于哪个应用，不能直接照抄停止命令影响旧服务。

**Docker 发布端口的流量可能绕过 UFW 的常规规则**，不能认为 `ufw deny 3306` 一定能阻止被 Docker 发布的数据库端口。本文直接不发布 db/api，配合云安全组控制公网入口。[Docker 与防火墙说明](https://docs.docker.com/engine/network/packet-filtering-firewalls/)

服务器 80/443 必须空闲；本文由容器内的 Nginx 占用它们。若已按原教程部署宿主机 Nginx，先备份旧配置、确认迁移窗口并停止冲突服务，再切换，不能让宿主机和容器同时占用同一端口。

## 9. 把运行配置上传服务器，再填写正式环境变量

**这一步做什么、有什么用：**镜像通过仓库传输，Compose、SQL、Nginx HTTPS 配置通过文件上传。这两条通道都需要，上传镜像不会自动上传这些文件。

**在哪里做、怎样算完成：**scp 在本地仓库根目录执行，mkdir、ls、nano 在服务器窗口 B 执行。前置条件是第 7 节两个发布镜像已推送，第 8 节 deployer 能登录。完成时文件齐全、正式配置已填、服务器可以访问镜像仓库。

### 9.1 先在服务器准备接收目录

`mkdir -p` 会创建需要的父目录，目录已经存在就保留。`/opt/expense` 已在第 8 节交给 deployer 管理。

```bash
# 服务器窗口 B：准备放初始化 SQL 和 Nginx 配置的目录。
mkdir -p /opt/expense/deploy
```

### 9.2 回到本地上传文件，不是在 SSH 里上传

打开本地窗口 A 并进入仓库根目录，确保能看到 compose.yaml。`scp 源文件 用户@服务器:目标目录` 是从当前电脑上传到服务器；`-r` 表示递归复制整个目录。

```powershell
# 本地窗口 A：上传运行清单、HTTPS 覆盖模板和不含真实密码的环境模板。
scp compose.yaml compose.https.yaml .env.example deployer@203.0.113.10:/opt/expense/
# 本地窗口 A：上传两个配置目录，保留 SQL 和 HTTPS 文件的目录结构。
scp -r deploy/mysql-init deploy/nginx deployer@203.0.113.10:/opt/expense/deploy/
```

传输成功时会显示文件名和进度，命令正常返回。本地主目录中的 `.env.local` 不上传，正式密码在服务器单独填写；也不需要上传 node_modules、业务源码或 Desktop 虚拟磁盘。

如果登录用了私钥和自定义端口，两条上传都要使用同一套参数。SCP 用大写 `-P`，不是 SSH 的小写 `-p`。下面是替代写法，和上面普通写法二选一；先按自己的真实参数修改。

```powershell
# 用指定本地私钥和真实端口上传三个根目录文件。
scp -i "$env:USERPROFILE/.ssh/id_ed25519" -P 2222 compose.yaml compose.https.yaml .env.example deployer@203.0.113.10:/opt/expense/
# 用同样的密钥和端口上传两个目录，-r 保留目录内部文件。
scp -i "$env:USERPROFILE/.ssh/id_ed25519" -P 2222 -r deploy/mysql-init deploy/nginx deployer@203.0.113.10:/opt/expense/deploy/
```

### 9.3 回服务器检查文件已经落在正确位置

`ls -l` 显示指定文件的信息；文件缺失会明确报错。这里不是只凭“scp 好像成功”继续，先核对真实路径。

```bash
# 服务器窗口 B：进入正式运行目录，后面普通 Compose 命令都在这里执行。
cd /opt/expense
# 检查根目录的三份文件都已经收到。
ls -l compose.yaml compose.https.yaml .env.example
# 检查两份 SQL 和正式 Nginx 配置都在正确子目录。
ls -l deploy/mysql-init/01-init.sql deploy/mysql-init/02-app-grants.sql deploy/nginx/https.conf
```

全部文件存在后再继续。若提示路径是目录而不是文件，先修正上传结构，不能直接挂载一个错误路径继续启动。

### 9.4 创建服务器专用 .env，并逐项填写

`umask 077` 让随后创建的文件默认不向其他用户开放；`chmod 600` 限制 .env 只有所有者可读写；`nano` 是终端文本编辑器。下面的复制仅用于首次部署，如果正式 `.env` 已存在就编辑已有文件，不覆盖现有密码。

```bash
# 后面新建的私有文件默认仅 deployer 可访问。
umask 077
# 首次从模板创建正式配置，不使用本地预演的密码。
cp .env.example .env
# 限制正式配置只有 deployer 可读写。
chmod 600 .env
# 打开正式配置，完成下方各项替换后保存。
nano .env
```

按这个顺序核对：

1. 把 API_IMAGE、WEB_IMAGE 的 `yourname` 换成第 7 节实际上传的账号名，保留 APP_VERSION=`20261016-1`，或换成你已经成功推送的真实标签。
2. 保持正式项目名 `expense`，端口 80/443，绑定地址 `0.0.0.0`。项目名决定使用哪组卷，正式使用后不要随意改动。
3. FRONTEND_ORIGIN 填 `https://你的真实域名`，没有 `/api` 后缀、没有路径；它表示浏览器来源，不是接口地址。
4. 5 个密码和密钥字段分别生成新随机值；不要照抄中文占位符，也不要复用本地密码。
5. MAIL_HOST、MAIL_PORT、MAIL_SECURE、MAIL_USER、MAIL_PASS 填真实 SMTP 资料。先在邮箱设置启用 SMTP/生成授权码，MAIL_PASS 填授权码或应用密码，不是随意编造的值；常用 587 对应 false、465 对应 true，以邮箱商为准。

镜像名的对应关系必须能对上：

| 服务器 .env 字段 | 本例内容 | Compose 拼出的结果 |
| --- | --- | --- |
| API_IMAGE | `yourname/daily-expense-api` | 与 APP_VERSION 合成 `yourname/daily-expense-api:20261016-1` |
| WEB_IMAGE | `yourname/daily-expense-web` | 与 APP_VERSION 合成 `yourname/daily-expense-web:20261016-1` |
| APP_VERSION | `20261016-1` | 必须等于两个仓库已经存在的标签 |

镜像字段只写到仓库名，不要在 API_IMAGE/WEB_IMAGE 里再加一次版本，否则会拼出两个冒号。`yourname` 必须已换成自己用户名。

nano 保存按 `Ctrl+O`、回车，退出按 `Ctrl+X`。接着打开正式 HTTPS 配置，把所有示例域名及证书目录名改为同一个真实域名；`.env` 不会自动替换这个文件里的文本。

```bash
# 单独编辑正式域名、跳转地址、证书目录；此时还没有启用 HTTPS。
nano deploy/nginx/https.conf
```

### 9.5 私有仓库在服务器另行登录，再做配置预检

本地的 docker login 只给本地电脑授权，不会自动给云服务器授权。若第 7 节用了私有仓库，现在在服务器执行下面命令，使用有拉取权限的账号和令牌；公有仓库可以跳过登录。

```bash
# 服务器窗口 B：登录镜像仓库，不是再次登录 Ubuntu。
docker login --username yourname
```

看到 `Login Succeeded` 后继续。凭据由 Docker 保存在部署用户的私有配置中，不写进 Compose。然后检查 .env 和 YAML 能否组合成合法配置：

```bash
# 核对正式配置和必填变量，成功时安静返回，不打印密码。
docker compose config --quiet
```

**本节结束时：**服务器已经有运行定义、建库文件、正式配置和 HTTPS 配置模板，但还没有执行本项目 pull 或 up。下一节先下载镜像，再从数据库开始启动。

## 10. 首次启动、申请证书与启用 HTTPS

**这一步做什么、有什么用：**先让数据库、API 和 HTTP 网页入口可用，再申请证书并切换到 HTTPS，最后配置续期。

**在哪里做、怎样算完成：**除标注的公网检查外，服务器 deployer 在 /opt/expense 执行。完成标志是基础数据正确、HTTPS 可访问、续期演练成功且定时任务已保存。

### 10.1 先拉取镜像，再按数据库 → API → HTTP 入口启动

前置条件：第 9 节已完成，当前是服务器窗口 B 的 `/opt/expense`。第一次部署还没有 `compose.override.yaml`，Nginx 使用镜像里的 HTTP 配置。已有 HTTPS 部署直接按第 14 节更新，不要重新走首次申请流程。

**第一步，检查文件。**`test -s` 检查路径是非空文件，成功时没有输出；任一条失败就先修正文件，再继续。

```bash
# 检查正式配置和变量。
docker compose config --quiet
# 核对首次建表脚本。
test -s deploy/mysql-init/01-init.sql
# 核对首次授权脚本。
test -s deploy/mysql-init/02-app-grants.sql
# 核对后面要启用的 HTTPS 配置，此时先不启用。
test -s deploy/nginx/https.conf
```

**第二步，明确下载镜像。**`pull` 只下载，不创建容器。本次分别下载官方 MySQL 和第 7 节推送的两个应用发布包；Certbot 到使用前再下载。

```bash
# 从官方仓库下载 compose.yaml 指定的 MySQL 版本。
docker compose pull db
# 从自己的镜像仓库下载 APP_VERSION 指定的 API 与 Web 版本。
docker compose pull api web
```

**预期：**三个镜像全部可用。`unauthorized` 先解决服务器仓库登录；`not found` 先对照仓库全名和标签；平台不匹配就回第 7 节构建正确平台。只有下载成功，才进入启动步骤。

**第三步，只启动数据库。**`up -d` 创建并后台运行容器，`--wait` 等待健康检查，300 秒是本次等待上限。Compose 此时才创建网络、数据库卷并挂载服务器上的 SQL；SQL 不是事先打进 MySQL 镜像的。

```bash
# 先创建并启动 MySQL，等待首次初始化完成。
docker compose up -d --wait --wait-timeout 300 db
# 核对数据库容器是否 running 且 healthy。
docker compose ps db
```

超时先执行下面的只读日志检查，找出 SQL、密码或磁盘方面的真实错误，不要直接删除数据卷。

```bash
# 读取数据库最近 100 行日志，启动成功时也可用来核对初始化过程。
docker compose logs --tail=100 db
```

**第四步，核对业务表。**`exec -T db` 是在已经运行的 db 内执行命令；后面的 `sh -c` 和单引号脚本让容器使用它自己的账号密码。命令里的 `$MYSQL_PASSWORD` 等保持原样，不要替换成明文。

```bash
# 用业务账号检查真实表和基础数据，而不是只检查 MySQL 进程存在。
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -u"$MYSQL_USER" "$MYSQL_DATABASE" -e "SHOW TABLES; SELECT COUNT(*) AS icon_count FROM category_icons; SELECT COUNT(*) AS template_count FROM category_templates;"'
# 记录当前项目实际使用的持久卷名称，方便后续备份与排错。
docker volume ls --filter label=com.docker.compose.project=expense
```

全新库预期 **9 张表、112 个图标、84 条分类模板**。已有账本要迁移时，在此暂停，按第 12 节完成备份与导入，再回来启动应用；首次只建新库的读者继续下一步。

**第五步，再启动 API 和 Web。**数据库健康不等于后端已经运行，后端运行也不等于 Nginx 能代理；下面依次检查。

```bash
# 保留已经健康的 db，并继续启动 API 与 Web；Certbot 工具不会常驻启动。
docker compose up -d --wait --wait-timeout 300
# 预期 db/api healthy、web running，不应出现反复重启或退出。
docker compose ps
# 查看后端和入口日志，确认没有数据库连接或 Nginx 配置错误。
docker compose logs --tail=100 api web
# 在运行中的 Web 内检查 Nginx 配置，预期 syntax is ok 和 test is successful。
docker compose exec -T web nginx -t
```

此时只有 HTTP，443 只是预留端口映射，还没有 Nginx 的 TLS 监听。先不开放正式登录或录入真实账本；下一小节先验证域名并申请证书，再启用 HTTPS。

### 10.2 验证 HTTP 域名访问，然后申请证书

Certbot 的 webroot 模式在共享卷里写入随机验证文件，证书服务通过你的公网域名的 80 端口读取文件，以证明你能控制该域名。申请和续期时都要保持这条路径可达。[Certbot webroot 文档](https://eff-certbot.readthedocs.io/en/stable/using.html#webroot)

先明确工具命令的层次，避免把 Certbot 当作第四个常驻应用：

| 写法 | 本次作用 |
| --- | --- |
| `docker compose pull certbot` | 下载工具镜像，尚不运行 |
| `docker compose run certbot ...` | 以该服务配置启动一次性工具容器，执行后面的 Certbot 命令 |
| `--rm` | 一次性容器退出后删除容器本身，共享证书卷仍保留 |
| `--entrypoint sh` | 仅这次改用容器里的 shell，便于写测试文件；真正申请时不带这个参数 |
| `-c '...'` | 把引号中的内容交给 shell 执行；变量、路径按示例保留 |

先在服务器下载工具镜像，明确把“下载”和“运行”分开：

```bash
# 下载官方 Certbot 工具镜像，等待完成后才运行下面的测试工具。
docker compose pull certbot
```

**服务器执行，写入一个不含敏感信息的测试文件：**

```bash
# 临时启动证书工具里的 shell，在共享验证卷创建测试文件；完成后删除工具容器。
docker compose run --rm --entrypoint sh certbot -c 'mkdir -p /var/www/certbot/.well-known/acme-challenge && printf "%s\n" expense-acme-ok > /var/www/certbot/.well-known/acme-challenge/deploy-check'
```

**本地 Mac 或外部 Linux 终端检查；Windows 把 curl 换成 curl.exe：**

这次 curl 的 `-f` 会把 HTTP 错误视为失败，`-sS` 隐藏进度但保留错误信息。预期响应是测试文件原文 `expense-acme-ok`；先知道这一点，再执行命令，不能只看网页是否能打开。

```bash
# 从公网读取测试文件，必须返回 expense-acme-ok，不能是网页 HTML。
curl -fsS http://expense.example.com/.well-known/acme-challenge/deploy-check
```

如果失败，先检查 DNS、安全组、服务器 80 端口和 Nginx 的验证路径，不要继续反复申请。这里的域名必须已替换为真实域名，不能用示例域名或单纯用 IP 申请本教程的域名证书。

这里检查的是“公网 80 是否能找到验证文件”，不是申请证书本身。服务器自己能访问并不足以替代外部网络验证。

真正申请前，先读懂下一条的参数：

| 参数 | 含义 |
| --- | --- |
| `certonly` | 只申请/保存证书，不自动修改 Nginx 配置 |
| `--webroot` | 通过现有 Nginx 返回验证文件，不再额外占用 80 端口 |
| `-w /var/www/certbot` | 把验证文件写进与 Nginx 共享的 webroot 目录 |
| `--cert-name` | 固定证书保存目录名，必须与 HTTPS 配置里的 live 子目录一致 |
| `-d` | 要给哪个真实域名申请证书，不是运行后台容器的 `up -d` |
| `--email` | 证书账户联系邮箱，填写自己的真实邮箱 |
| `--agree-tos` | 同意证书服务条款 |
| `--non-interactive` | 参数已填齐，使用非交互方式执行 |

同样是 `-d`，在不同程序中含义不同：`docker compose up -d` 是后台运行，而这里 Certbot 的 `-d` 是域名。先看清它属于哪条命令，不需要靠猜。

**回到服务器 `/opt/expense` 申请证书。先替换域名与邮箱，两个域名参数保持一致：**

```bash
# 用共享 webroot 完成验证，固定证书目录名，并同意证书服务条款；邮箱填写你自己的真实邮箱。
docker compose run --rm certbot certonly --webroot -w /var/www/certbot --cert-name expense.example.com -d expense.example.com --email you@example.com --agree-tos --non-interactive
```

申请成功后，证书在 `certbot_conf` 卷中的 `/etc/letsencrypt/live/expense.example.com/`。Nginx 已只读挂载整个卷，所以能读取证书链和私钥。`--cert-name` 的值必须与 HTTPS 配置中的证书目录名一致；申请失败时保持当前 HTTP 配置，修复原因后再试。

`certbot` 带有 `profiles: [tools]`，平时 `up` 不会启动它；上面显式执行 `run certbot` 会自动启用这个工具服务，用完即退出，不需要多启动一个常驻进程。[Compose profiles 说明](https://docs.docker.com/compose/how-tos/profiles/)

### 10.3 拿到证书后再启用 HTTPS

先理解这次切换：证书已经保存在卷里，但 Nginx 仍在运行原来的 HTTP 配置。我们把已有 HTTPS 模板复制成默认覆盖文件，让 Compose 下次创建 Web 时多挂载一份正式配置。

接下来 `config --quiet` 只检查清单，`run --rm --no-deps web nginx -t` 临时检查 Nginx 和证书，`--no-deps` 表示不拉起或重建 API/db，最后 `up --force-recreate web` 才真正替换 Web 容器。`run` 默认不发布服务端口，所以预检不会与现有 HTTP 入口抢端口。每条通过后才执行下一条。

**服务器执行；先确认没有其他用途的 `compose.override.yaml`，如果已有则先合并审核，不能盲目覆盖：**

```bash
# 把 HTTPS 模板启用为默认覆盖文件，后续普通 Compose 命令会自动合并它。
cp compose.https.yaml compose.override.yaml
# 检查合并后的 Compose 定义；失败则先修复，不重建 Web。
docker compose config --quiet
# 用同样的镜像和挂载启动一次性配置检查容器，不发布端口，也不停止正在运行的 HTTP 入口。
docker compose run --rm --no-deps web nginx -t
# 检查成功后仅重建 Web，切换为 HTTPS 配置；不重建数据库与 API。
docker compose up -d --no-deps --force-recreate --wait --wait-timeout 300 web
# 再次确认正式运行中的 Nginx 能读取配置、证书链及私钥。
docker compose exec -T web nginx -t
# 查看 Nginx 启动日志，确认没有证书路径或权限错误。
docker compose logs --tail=100 web
```

现在预期 HTTP 跳转 HTTPS，HTTPS 能正常打开。后续发布、备份及恢复使用的普通 `docker compose` 会自动读取覆盖文件，**不要只加 `-f compose.yaml` 而遗漏 HTTPS 覆盖文件**。如果使用显式文件列表，必须一并列出 `compose.override.yaml`。

若一次性 `nginx -t` 失败，现有 HTTP 入口还在运行。修正域名、证书路径或配置语法后重新检查，再重建 Web；不要通过跳过检查来继续上线。

### 10.4 演练续期，并配置定时续期检查

这一步是“上线后保持证书有效”的工作，不是再次首次申请。`renew` 读取证书卷里保存的续期配置；`--dry-run` 用测试环境演练，不覆盖当前正式证书。真正定时运行用 `--quiet` 减少正常输出，失败仍记录错误。

下面会保存一个可重复执行的脚本，再交给 Ubuntu 的 cron 定时调用。`crontab -e` 是编辑当前用户的任务表，不是让你把 cron 规则直接粘到 shell。脚本中 `nginx -t` 先检查、`nginx -s reload` 再重新读取证书，不需要停止数据库或重启整套应用。

证书不会因为 Nginx 正在运行而自动续期。Certbot 更新证书文件后，Nginx 也需要重新加载。先用测试环境演练续期，不替换当前正式证书：

```bash
# 使用证书服务测试环境演练已有证书的续期验证，预期所有模拟续期成功。
docker compose run --rm certbot renew --dry-run
# 创建续期脚本和私有日志目录。
mkdir -p ~/bin ~/expense-cert-logs
# 限制日志目录只有部署用户可访问。
chmod 700 ~/expense-cert-logs
# 打开续期脚本，将下面完整内容写入文件。
nano ~/bin/renew-expense-cert
```

**脚本文件内容**如下。第一行 `#!/usr/bin/env bash` 指定 Bash 解释器，必须保持文件第一行；保存为 UTF-8、LF 换行：

```bash
#!/usr/bin/env bash
# 命令失败、未定义变量或管道失败时退出，续期失败后不继续重新加载。
set -euo pipefail
# 让脚本创建的文件默认仅部署用户可访问。
umask 077
# 进入正式目录，读取正确的环境、项目名及 HTTPS 覆盖文件。
cd /opt/expense
# 检查证书是否需要续期，需要时更新共享证书卷；无到期证书也会成功返回。
/usr/bin/docker compose run --rm certbot renew --quiet
# 确认证书与 Nginx 配置有效，检查失败则停止，不向 Nginx 发送重新加载信号。
/usr/bin/docker compose exec -T web nginx -t
# 平滑重新加载，让 Nginx 读取共享卷中的当前证书；没有更新时重新加载也无妨。
/usr/bin/docker compose exec -T web nginx -s reload
```

```bash
# 仅允许部署用户读取、修改和执行续期脚本。
chmod 700 ~/bin/renew-expense-cert
# 手动执行一次完整检查，验证工具、卷、权限及重新加载都可用。
~/bin/renew-expense-cert
# 编辑 deployer 的定时任务，加入下面的规则并保留已有备份任务。
crontab -e
```

```cron
# 每天按服务器时区 03:17、15:17 检查续期，把输出和错误追加到私有日志。
17 3,15 * * * /home/deployer/bin/renew-expense-cert >> /home/deployer/expense-cert-logs/renew.log 2>&1
```

Certbot 成功返回也可能表示“暂时不需要续期”，不能据此判断一定生成了新证书。续期脚本每次成功检查后都重新加载 Nginx，便于理解与维护。保持 DNS、80 端口、验证 location 及两组证书卷有效，定期检查日志、证书到期时间并配置失败提醒。[Certbot 续期说明](https://eff-certbot.readthedocs.io/en/stable/using.html#renewing-certificates)

## 11. 正式验收

**这一步做什么、有什么用：** 从用户视角验证网站真的可用，包括登录会话、邮件、账目与数据持久化。

**在哪里做、怎样算完成：** 用外部网络和浏览器验收；容器重建在服务器维护窗口进行。全部通过后才开放给用户。

### 11.1 从公网检查入口和接口

执行前先知道预期结果：HTTP 请求应跳转到 HTTPS，HTTPS 页面应返回 200。空登录请求故意不填必填字段，所以 400 JSON 才表示请求到了真实 API；不带令牌访问受保护接口得到 401 也是预期。不要把这两个刻意设计的响应当作部署失败。

下面 `-I` 只看响应头，`-i` 看响应头和正文；`-X POST`、`-H`、`--data` 分别设置请求方法、请求头和请求体。本地 Windows 逐条把 curl 改成 curl.exe，整行执行即可。

**本地 Mac 或服务器 Bash，最好另从外部网络复测：**

```bash
# 检查 HTTP 入口是否跳转到 HTTPS。
curl -I http://expense.example.com
# 检查 HTTPS 证书和页面响应，预期为 200。
curl -I https://expense.example.com
# 发送空登录请求，预期 400 JSON，说明请求确实到达 NestJS。
curl -i -X POST https://expense.example.com/api/auth/login  -H 'Content-Type: application/json' --data '{}'
# 不带登录令牌访问受保护的图标接口，预期为 401。
curl -i https://expense.example.com/api/categories/getAllIcons
```

预期：HTTP 跳转 HTTPS；HTTPS 页面 200；空登录请求 400 JSON；未登录获取图标 401。Windows 把 `curl` 改成 `curl.exe`，多行命令合并成一行执行，不使用 Bash 的反斜杠续行。

400/401 在这里是刻意设置的预期结果，只证明请求到达真实 API，不代表邮件和完整业务已可用。

### 11.2 浏览器完成业务闭环

1. 打开正式 HTTPS 域名，证书没有错误。
2. 请求真实邮箱验证码，注册并登录。
3. 检查默认分类、分类图标和标签。
4. 新增、修改、删除一笔测试流水，核对统计金额。
5. 刷新 `/transactions` 页面，确认页面路由仍正常，登录能恢复。
6. 浏览器 Network 中确认调用 `/api/...`，没有 localhost 或 Mixed Content。
7. 检查 `refresh_token` Cookie：`HttpOnly`、`Secure`、`SameSite=Lax`、Path=`/api/auth`；刷新接口使用 `POST /api/auth/refresh`。
8. 退出登录后不能继续访问受保护数据。

### 11.3 验证重建与重启后数据保留

先在没有其他用户写入的时间操作：

```bash
# 在维护时间重建容器并等待启动，以验证数据确实保存在命名卷中。
docker compose up -d --force-recreate --wait --wait-timeout 300
# 查看重建后的服务状态，然后回网页核对测试流水仍存在。
docker compose ps
```

再次确认测试流水存在。安排合适时间执行 `sudo reboot`，重新登录后检查 Docker 服务、容器和业务数据。`restart: unless-stopped` 不会把你主动停止的容器自动恢复；停机维护后需再次 `docker compose up -d`。

## 12. 有旧账本时才做：导出、上传、导入

**这一步做什么、有什么用：**把旧数据库中的真实用户和账目迁到云端。没有旧账本就跳过本节，继续做新部署的 HTTPS 和业务验收。

**在哪里做、怎样算完成：**旧库导出在本地，文件上传在本地，导入在服务器。服务器 db 已在第 10.1 节启动，API/Web 尚未正式开放；如果原来已经对外运行，则维护期间停止所有写入，并先按第 13 节备份当前状态。完成标志是旧用户、流水、分类和统计都能在新环境核对。

### 12.1 先决定什么时候停旧系统

先按本节导出和上传一份旧库 SQL，再在第 12.4 节的隔离数据库试导入，特别是 MySQL 8.0 → 8.4 的情况。演练通过后，真正切换时先停止旧环境写入，重新导出并上传最终 SQL，才按第 12.5 节导入正式库；新旧两套系统不能同时继续录账。

镜像只保存程序，不会把本地 MySQL 数据卷装进去。这里用 mysqldump 把数据导出为 SQL，再通过文件导入云端；不要复制 MySQL 的数据目录给另一版本直接使用。

### 12.2 在旧库所在电脑导出业务库

先准备兼容的 MySQL 客户端导出工具，下面的 mysqldump 命令需要本地已经能找到该程序。用户名、主机地址改成旧库实际值，`--password` 会交互询问密码，不要把明文拼在参数后。

| 参数 | 作用 |
| --- | --- |
| `--single-transaction` | 为当前 InnoDB 业务表取得一致性快照；导出期间不执行建表/改表等 DDL |
| `--no-tablespaces`、`--set-gtid-purged=OFF` | 避免把不需要的表空间/GTID 管理信息带入本次逻辑迁移 |
| `--databases daily-expense-tracking` | 只导出本项目业务库，不导出 mysql 系统库和服务器账号 |
| `--result-file` | 让导出工具直接写 SQL 文件，避免旧版 PowerShell 重定向改变编码 |

**本地 PowerShell：**

```powershell
# 为导出创建本地目录，可换成有权限的实际路径。
New-Item -ItemType Directory -Force D:/expense-backups
# 连接旧数据库并按提示输入密码，导出本项目业务库。
mysqldump --host=127.0.0.1 --user=你的本地管理员 --password --single-transaction --no-tablespaces --set-gtid-purged=OFF --databases daily-expense-tracking --result-file=D:/expense-backups/expense.sql
# 检查导出文件存在、修改时间是本次操作，Length 不为 0。
Get-Item D:/expense-backups/expense.sql
```

导出失败先处理旧库连接和权限，不能拿空文件继续上传。旧库本身在 Docker 里时，可以参考第 13 节的容器内导出方法，不要求为此再安装一台本地数据库。

### 12.3 从本地把 SQL 上传服务器

scp 的方向仍然是电脑 → 服务器，必须在本地窗口 A 执行；有私钥或自定义 SSH 端口时，沿用第 9 节的参数。

```powershell
# 将本次导出的业务 SQL 上传到 deployer 主目录。
scp D:/expense-backups/expense.sql deployer@203.0.113.10:/home/deployer/
```

### 12.4 先把这份旧 SQL 导入隔离容器演练

下面操作在服务器 `/opt/expense` 执行，使用独立项目名 `expense-import-test`，所有数据库命令都带这个 `-p`，因此使用另一组容器和卷，不触碰正式 `expense` 的数据库。只启动 db，不启动会发邮件或写入业务的 API/Web。

这次传的是未压缩的 `~/expense.sql`，直接用 `<` 传给 MySQL；第 13.3 节的 `.sql.gz` 则先用 gzip 解压，不能混用。

```bash
# 服务器窗口 B：进入配置目录，下面用另一个项目名隔离数据。
cd /opt/expense
# 限制旧账本文件只有当前部署用户可读写。
chmod 600 ~/expense.sql
# 创建隔离数据库，不启动正式应用。
docker compose -p expense-import-test up -d --wait --wait-timeout 300 db
# 把同一份旧 SQL 直接导入隔离数据库，不使用 gzip。
docker compose -p expense-import-test exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot' < ~/expense.sql
# 查询隔离库恢复后的用户和流水数量，与旧环境核对。
docker compose -p expense-import-test exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -e "SELECT COUNT(*) FROM \`daily-expense-tracking\`.users; SELECT COUNT(*) FROM \`daily-expense-tracking\`.transactions;"'
# 演练结束后停止隔离容器，保留测试卷供核查，不删除正式卷。
docker compose -p expense-import-test down
```

导入无错误、表结构和关键数据正确后，才进入正式切换。还应在独立测试部署中验证业务兼容性；若试导入失败，先修复兼容问题，正式库保持原状。真正停旧系统后，按第 12.2～12.3 节重新导出和上传最终 SQL，不把早期演练快照当成最终数据。

### 12.5 在服务器停止写入，再导入明确的目标

SQL 可能含 DROP TABLE，导入会覆盖目标数据。目标已经存有真实账目时，先完成第 13 节备份，再做下面操作；纯新部署只有初始化基础数据时，确认目标就是准备接收旧账本的新库。

`< ~/expense.sql` 是让 MySQL 客户端读取这个 SQL 文件；这份文件里的 CREATE DATABASE/USE 会决定数据库对象，因此不能只靠命令末尾换个库名就认为已经隔离。

```bash
# 服务器窗口 B：进入正式部署目录。
cd /opt/expense
# 限制真实账本导出文件只有 deployer 可读写。
chmod 600 ~/expense.sql
# 停止 Web 和 API；如果尚未启动也无需创建它们，数据库继续运行。
docker compose stop web api
# 用管理员账号将审核过的业务 SQL 导入正式 db，等待成功结束后再继续。
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot' < ~/expense.sql
```

导入正常结束通常没有额外输出；出现 SQL 错误就停在这里检查，不继续开放应用。数据库账号仍由云端初始化管理，不用把旧库的 mysql 系统库复制过来。

### 12.6 核对数据，再返回首次上线流程

```bash
# 查询导入后的用户与流水数量，和旧环境的记录核对。
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -e "SELECT COUNT(*) FROM \`daily-expense-tracking\`.users; SELECT COUNT(*) FROM \`daily-expense-tracking\`.transactions;"'
```

首次部署的读者回到第 10.1 节第五步启动应用，再申请证书，最后做第 11 节的用户和金额核对。已启用 HTTPS 的维护迁移则使用下列命令恢复服务；原有 HTTPS 覆盖文件继续保留。

```bash
# 仅在维护迁移完成且数据核对通过后，重新启动正式应用。
docker compose up -d --wait --wait-timeout 300
```

不要在“首次部署尚未启动”的分支和“已运行系统维护”的分支之间来回复制命令。验收通过后停用旧环境，防止新旧两边继续写入不同账本。

## 13. 数据备份、定时任务与恢复演练

**这一步做什么、有什么用：** 让账本在误操作、磁盘损坏或整机丢失后有可验证的恢复来源。

**在哪里做、怎样算完成：** 服务器创建并试跑备份脚本，隔离库验证恢复，再安排定时任务与异机副本。

### 13.1 先理解卷与备份

`db_data` 让数据在容器重建后保留，**它仍在同一台服务器上，不等于备份**。删除卷、磁盘损坏或整机丢失都可能丢数据。不要执行 `docker compose down -v` 或不加核对的卷清理命令。

另需私下备份 `.env`、Compose（包括已启用的 `compose.override.yaml`）、`deploy/nginx/https.conf`、初始化/迁移 SQL 和续期脚本。`certbot_conf` 卷保存私钥、账户、`renewal`、`live` 和 `archive`，应完整保留目录与符号链接并按敏感数据备份；不要只复制 `live` 中的链接。运行中的 MySQL 数据目录不能简单打包充当一致性备份。

### 13.2 创建可重复执行的备份脚本

本节分成四个动作：**创建脚本文件 → 手工运行一次 → 在隔离库恢复 → 保存定时任务**。备份文件生成了不等于恢复一定可用，所以别只做到文件大小检查就结束。

先看脚本里几个符号：`|` 把导出的 SQL 交给 gzip 压缩；`>` 写入文件；`$(date ...)` 取得当前时间用于文件名；`set -euo pipefail` 让导出或压缩任一失败时终止脚本。mysqldump 的 `--single-transaction` 为当前 InnoDB 表导出一致性快照，`--quick` 按行读取，`--routines --events --triggers` 同时保留相关对象，`--databases` 明确只导出本项目业务库。

脚本内使用 `/usr/bin/docker` 是因为定时任务的 PATH 可能比交互终端短；备份任务读取同一个部署目录与 `.env`，所以执行用户必须是有 Docker 权限的 deployer。

**服务器 deployer：**

```bash
# 创建脚本目录和备份目录。
mkdir -p ~/bin ~/expense-backups
# 限制备份目录只有 deployer 可访问。
chmod 700 ~/expense-backups
# 打开备份脚本文件；将下一段脚本内容写入文件并保存。
nano ~/bin/backup-expense
```

将下面内容写入刚打开的脚本文件（不是逐行粘到终端）。第一行 `#!/usr/bin/env bash` 告诉系统用 Bash 执行，必须保持首行；文件保存为 UTF-8、LF 换行：

```bash
#!/usr/bin/env bash
# 任意命令失败、未定义变量或管道失败时终止脚本，避免生成假成功备份。
set -euo pipefail
# 限制新生成的备份文件仅当前用户可读写。
umask 077
# 进入部署目录，确保 Compose 读取正确的 .env 与项目定义。
cd /opt/expense
# 指定备份保存目录，部署账号若不同也要修改这个绝对路径。
backup_dir=/home/deployer/expense-backups
# 确保备份目录存在且只有所有者能访问。
install -d -m 700 "$backup_dir"
# 用服务器当前时间生成不会轻易重名的备份文件名。
backup_file="$backup_dir/expense_$(date +%Y%m%d_%H%M%S).sql.gz"
# 在 db 容器内一致性导出业务库并压缩到临时文件；密码由容器环境提供。
/usr/bin/docker compose exec -T db sh -c  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --quick --routines --events --triggers --no-tablespaces --set-gtid-purged=OFF --databases daily-expense-tracking'  | gzip > "$backup_file.partial"
# 检查 gzip 完整性，失败时不把临时文件视为正式备份。
gzip -t "$backup_file.partial"
# 导出和校验都成功后，将临时文件改成正式文件名。
mv -- "$backup_file.partial" "$backup_file"
# 打印成功文件路径，便于手动检查和记录日志。
printf '备份完成：%s\n' "$backup_file"
```

`pipefail` 避免导出失败却只生成一个看似成功的压缩文件；`.partial` 不作为成功备份。单事务适用于当前 InnoDB 业务表，备份期间不要并发执行 DDL。

```bash
# 只允许脚本所有者读取、修改和执行备份脚本。
chmod 700 ~/bin/backup-expense
# 手工执行一次备份，验证导出与压缩流程。
~/bin/backup-expense
# 查看生成的备份文件及大小；仍需后续恢复演练证明可用。
ls -lh ~/expense-backups
```

手工运行成功后，先完成下一小节的隔离恢复演练，再在第 13.4 节配置定时任务。

### 13.3 使用另一组 Compose 卷做恢复演练

选择磁盘和内存足够的测试服务器，或在本服务器上仅启动隔离数据库。下面用不同项目名 `expense-restore`，不发布数据库端口，不启动会发邮件的 API。

执行前先理解隔离方式：`-p expense-restore` 为这次演练指定另一个 Compose 项目名，因而使用另一套容器、网络和数据卷。正式库仍叫 daily-expense-tracking，但它位于另一台容器里；**下面每条恢复命令都保留 `-p expense-restore`**，不能省掉。

先从 `ls -lh ~/expense-backups` 结果选一个真实文件，替换下面的“实际时间”。`gzip -t` 只检查压缩完整性，`gzip -dc` 是解压并写到管道，真正证明可恢复的是导入后能核对表和账目。

**服务器 Bash：**

```bash
# 进入正式配置所在目录，仅复用定义，下面用另一个项目名隔离数据。
cd /opt/expense
# 启动独立的 expense-restore 数据库和数据卷，不启动 API/Web。
docker compose -p expense-restore up -d --wait --wait-timeout 300 db
# 指定实际生成的备份路径；必须替换“实际时间”。
backup_file=/home/deployer/expense-backups/expense_实际时间.sql.gz
# 先检查压缩文件是否损坏；失败则不继续导入。
gzip -t "$backup_file"
# 让管道中任意一条命令失败时返回失败状态，防止误判导入成功。
set -o pipefail
# 解压并导入隔离项目数据库；-T 避免管道被伪终端影响。
gzip -dc "$backup_file" | docker compose -p expense-restore exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot'
# 查询恢复后用户和流水数量，并与预期备份数据核对。
docker compose -p expense-restore exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -e "SELECT COUNT(*) FROM \`daily-expense-tracking\`.users; SELECT COUNT(*) FROM \`daily-expense-tracking\`.transactions;"'
# 停止并移除演练容器与网络，保留演练卷供检查。
docker compose -p expense-restore down
```

备份中的 `CREATE DATABASE` / `USE` 仍使用原库名，隔离由不同容器和数据卷实现；仅给 mysql 命令换一个库名不一定能隔离。演练卷会保留，核对所属项目后再单独处理，不要误删 `expense_db_data`。完整恢复演练还应在独立测试部署中连接测试 API，核对流水、分类和统计。

正式恢复顺序：停 web/api 及所有写入者 → 备份当前状态 → 确认目标备份 → 将上面导入命令改成正式 Compose 项目执行 → 启动 → 完整验收。旧备份会覆盖之后的写入，不能把恢复数据库当作普通代码回退。

### 13.4 恢复演练成功后，再保存每天的备份任务

下面在服务器 deployer 终端执行。`crontab -e` 打开当前用户的定时任务编辑器，保存后 cron 才会按时运行脚本。

```bash
# 打开 deployer 的任务表，追加备份规则并保留已有证书续期规则。
crontab -e
```

先手工确认打印“备份完成”且生成本次的 `.sql.gz`；没有通过就先修复脚本或数据库连接。运行 `crontab -e` 后进入的是任务表编辑器：首次提示选择编辑器时可选 nano，追加下面这一行并保存，保留第 10.4 节已有的续期任务。

cron 五个时间字段按“分、时、日、月、星期”排列，`30 3 * * *` 是每天 03:30。`>>` 是追加日志，`2>&1` 让错误也写入同一个日志；这行要写进 crontab，不是在 Bash 提示符下直接执行。

添加 deployer 的定时任务：

```cron
# 按服务器时区每天 03:30 执行备份，并将标准输出和错误追加到备份日志。
30 3 * * * /home/deployer/bin/backup-expense >> /home/deployer/expense-backups/backup.log 2>&1
```

每天服务器时区 03:30 备份；检查日志和磁盘，制定保留周期，并通过自己控制的方式保留异机副本。仅看文件大小或 `gzip -t` 不能证明数据库可恢复。

保存后可以用 `crontab -l` 查看当前任务表；确认备份和证书续期规则都存在，不是只执行过一次脚本。

```bash
# 查看刚保存的定时任务，核对路径、时间和日志目录。
crontab -l
```

## 14. 后续发布、配置修改与回退

**这一步做什么、有什么用：** 以可核对的版本更新程序，并在旧代码仍兼容数据库时回退应用。

**在哪里做、怎样算完成：** 本地构建并推送新镜像；服务器备份、换版本、拉取、迁移及验收。首次上线时可先读过再查用。

### 14.1 发布新版本：仍然逐项构建、推送、下载、切换

先明确：只把新源码提交到 Git，正在运行的容器不会改变；只在电脑 build，新镜像也不会自动出现在服务器。这里完整走一次第二次发布，本例从 `20261016-1` 更新到 `20261017-1`，它们都是版本名而非必须匹配当天日期。

#### 14.1.1 在本地验证代码

此处假定本地开发环境已使用 Node 24.22.1；没有本地 Node 的团队可让已有 CI 完成检查。镜像中的 Node 不会自动让 Windows 终端拥有 npm，也不要求服务器另装 Node。

`Push-Location` 临时进入目录，`Pop-Location` 回到原目录。下面每一行成功后再执行下一行；任一测试或构建失败先修复，不继续发布。首次 npm ci 可能需要下载依赖。

```powershell
# 本地仓库根目录：进入后端目录，执行该项目已有的检查。
Push-Location service-nest
# 按后端锁文件准备依赖。
npm ci
# 执行后端测试。
npm test -- --runInBand
# 检查后端能编译。
npm run build
# 回到仓库根目录。
Pop-Location
# 进入前端目录。
Push-Location web
# 按前端锁文件准备依赖。
npm ci
# 执行前端已有单元测试并退出运行。
npm run test:unit -- --run
# 检查前端类型与构建产物。
npm run build
# 回到仓库根目录，供下面 Docker 命令读取路径。
Pop-Location
```

#### 14.1.2 构建新版本、打标签，然后明确推送

参数与第 7 节相同，版本改为新标签；根据真实服务器架构保留 amd64 或改用 arm64。下面都在**本地仓库根目录**执行，yourname 使用自己第 7 节的真实用户名。

```powershell
# 构建 API 新版本，只生成本地镜像。
docker build --platform linux/amd64 --file service-nest/Dockerfile --tag daily-expense-api:20261017-1 service-nest
# 构建 Web 新版本，只生成本地镜像。
docker build --platform linux/amd64 --file web/Dockerfile --tag daily-expense-web:20261017-1 web
# 核对本地确实出现两个新版本标签。
docker image ls
# 给 API 新镜像添加仓库全名。
docker tag daily-expense-api:20261017-1 yourname/daily-expense-api:20261017-1
# 给 Web 新镜像添加仓库全名。
docker tag daily-expense-web:20261017-1 yourname/daily-expense-web:20261017-1
# 确认当前电脑使用有推送权限的仓库账号。
docker login --username yourname
# 明确上传 API 新版本。
docker push yourname/daily-expense-api:20261017-1
# 明确上传 Web 新版本。
docker push yourname/daily-expense-web:20261017-1
```

两次 push 成功后，到 Docker Hub 的两个仓库 Tags 页面确认 `20261017-1` 都存在。保留旧标签 `20261016-1`，不要删除或覆盖。发布会短暂停机，先安排维护时间；数据库大版本升级不与这次普通应用更新混在一起。

#### 14.1.3 在服务器备份当前状态，再修改版本配置

先读本版本的配置和数据库变更说明：没有迁移时走普通更新，有迁移时使用下一小节的独立分支。备份脚本必须已按第 13 节创建并验证。

```bash
# 服务器窗口 B：进入正式部署目录。
cd /opt/expense
# 让保存的旧配置只对 deployer 开放。
umask 077
# 保存当前配置副本，便于核对原来的版本和字段。
cp .env ".env.before-$(date +%Y%m%d_%H%M%S)"
# 执行已验证的备份脚本，看到成功文件路径后再继续。
~/bin/backup-expense
# 编辑正式配置，只将 APP_VERSION 改成已推送的 20261017-1，并按版本说明补配置。
nano .env
```

不要改正式项目名、数据卷和已有密码。保存后先检查配置、下载新镜像，此时旧容器仍在运行，用户还没有切换到新程序。

```bash
# 检查修改后的正式配置，成功时没有额外输出。
docker compose config --quiet
# 从仓库下载新标签，下载失败先修复，旧程序此时仍可运行。
docker compose pull api web
```

只有拉取成功后才进入维护切换：

```bash
# 停止 Web 与 API，数据库保留运行，进入维护窗口。
docker compose stop web api
```

#### 14.1.4 仅本版本确实有迁移时执行；无迁移直接跳到下一小节

本仓库没有可直接调用的通用 migration:run。只有新版本提供了真实迁移 SQL、已审核并在测试库验证时，才按管理员流程执行；**不要把第 4 节 init.sql 当成升级脚本重新导入**。

如有 SQL 迁移，先在本地把真实文件上传至 `/opt/expense/deploy/`，再核对服务器实际文件名。下面两个路径是待替换的说明性占位符，不能原样执行。没有迁移文件时，本小节所有命令都跳过。

**有迁移才在本地执行：**

```powershell
# 将本版本真实迁移文件上传服务器，先把本地文件名替换为实际路径。
scp ./本版本实际迁移.sql deployer@203.0.113.10:/opt/expense/deploy/
```

**有迁移才回到服务器执行：**

```bash
# 确认真实迁移文件已经上传且不为空，先替换下面的文件名。
test -s deploy/本版本实际迁移.sql
# 用管理员账号执行已备份、已验证的迁移，成功后才启动新版本。
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot daily-expense-tracking' < deploy/本版本实际迁移.sql
```

迁移失败停在这里处理，不能继续 up，也不能不核对数据库状态就盲目回退应用。

#### 14.1.5 启动新版本，重新验收

有迁移且已成功，或本次本来没有迁移，都会到这一步。服务器原有的 `compose.override.yaml` 继续自动加载，不需要重新申请证书，也不要删数据库卷。

```bash
# 按新镜像版本更新并启动应用，等待就绪。
docker compose up -d --wait --wait-timeout 300
# 检查三个业务服务的状态。
docker compose ps
# 检查 API 和入口最近日志。
docker compose logs --tail=100 api web
```

随后按第 11 节重新验收 HTTPS、真实邮箱验证码、登录、流水读写和刷新会话。新容器 healthy 只是启动检查通过，不能省略浏览器业务验收。确认后记录当前和上一个版本，保留镜像与备份。

### 14.2 不同改动分别怎样生效

| 改动 | 操作 |
| --- | --- |
| API/Web 源码或依赖 | 构建新镜像、推送、改版本、pull、up |
| `VITE_API_BASE_URL` | 重建 Web 镜像；运行容器时改变量不会改变现有 JS |
| `.env` 的 API 配置 | `docker compose up -d --force-recreate api`，然后验收 |
| 站点域名 | 更新 DNS、FRONTEND_ORIGIN、HTTPS 配置和证书申请域名；先申请新证书，再检查并重建 Web |
| 证书续期 | Certbot 更新证书后执行 `nginx -t` 和 `nginx -s reload`，见第 10.4 节 |
| `web/nginx.conf` | HTTP 配置已打进镜像，需重建 Web 镜像；正式 HTTPS 以挂载配置为准 |
| `deploy/nginx/https.conf` | 修改服务器文件后执行 `docker compose exec -T web nginx -t`，成功再 `docker compose exec -T web nginx -s reload`；若替换了整个文件，重新创建 Web 确保挂载更新 |
| 数据库密码 | 先用数据库 SQL 修改已有用户，再同步 `.env`；初始化变量不会重置账号 |
| 端口/卷声明 | 审核 Compose 后 `up -d`；不能随意变更正式项目名或数据卷 |

`docker compose restart` 重新启动现有容器，不会自动把修改后的环境变量重新注入。

### 14.3 回退应用镜像：先确认旧代码能用当前数据库

本例把程序从 `20261017-1` 换回 `20261016-1`。回退镜像只换程序，不会撤销数据库迁移或抹掉新产生的账目。先核对旧代码能读取当前表结构；有破坏性迁移时先制定单独恢复方案，不直接照抄下面步骤。

**服务器 `/opt/expense`：**

```bash
# 确保正在操作正式部署目录。
cd /opt/expense
# 编辑配置，只把 APP_VERSION 改回保留的旧标签 20261016-1，保留当前有效密钥。
nano .env
# 检查旧版本配置仍完整可用。
docker compose config --quiet
# 先下载旧应用镜像，下载失败时不要停止当前应用。
docker compose pull api web
```

确认旧镜像已经拉取成功，再在维护窗口切换：

```bash
# 停止新版本应用，保持数据库运行。
docker compose stop web api
# 用配置指定的旧镜像重新启动应用，继续加载 HTTPS 覆盖。
docker compose up -d --wait --wait-timeout 300
# 检查回退后的应用日志。
docker compose logs --tail=100 api web
```

回退后仍然执行第 11 节验收，不直接把整份旧 `.env` 覆盖回来，以免恢复已经失效的密码或密钥。

## 15. 可选：从电脑通过 SSH 管理云端 Docker

**这一步做什么、有什么用：** 了解通过远程连接、离线传镜像或服务器构建进行部署的替代办法。

**在哪里做、怎样算完成：** 本节选读，不是首次上线主线；选择一种路线后使用与之匹配的上传和更新步骤。

如果希望在本地终端检查云端容器，Docker CLI 支持 SSH Context。先确认 `ssh deployer@真实IP` 可用，且该用户有服务器 Docker 权限。[Docker 官方 SSH 连接说明](https://docs.docker.com/engine/security/protect-access/)

**本地 Windows / Mac：**

Context 是给一组 Docker 连接信息起的名字；下面 `expense-cloud` 指向云端，`--context expense-cloud` 只让这一条命令连接远端。先理解这个目标切换，再执行只读检查，不能把云端当作本地预演环境清理。

```powershell
# 创建通过 SSH 连接云服务器 Docker 的命名连接，不会切换默认连接。
docker context create expense-cloud --docker host=ssh://deployer@203.0.113.10
# 仅本条命令读取云服务器的 Docker 引擎信息。
docker --context expense-cloud info
# 仅本条命令列出云服务器容器。
docker --context expense-cloud ps
# 列出所有连接，星号标记当前默认连接。
docker context ls
```

这里一直显式传 `--context`，减少把本地操作误发到正式环境的机会；不要开放未加密的 Docker TCP 2375 端口。

**Context 只改变命令连接的 Docker 引擎，不会自动上传本地文件、环境配置或数据库。** 特别是 Compose 的 `./deploy/mysql-init` 挂载：bind mount 的源路径由服务器解释，本地 Windows 路径不会凭空出现在 Ubuntu 上。首次部署仍按第 9 节上传文件，并在 SSH 中运行 Compose。[远程 bind mount 限制](https://docs.docker.com/engine/storage/bind-mounts/)

Docker Desktop 的本地图形界面也不等于远程服务器控制台；不要假定切了 CLI Context，界面就会显示云端所有容器。维护时用上面的远程 CLI 或 SSH 即可。

### 15.1 不使用镜像仓库时

这是替代第 7 节的传输办法，第一次学习按主线使用仓库即可，不需要两种路线都做。前置条件是已经完成第 7.2～7.3 节，电脑里有目标架构的两个发布镜像。

先解释：`docker image save` 把指定镜像写成归档文件，`-o` 指定输出文件；scp 传输这个归档；服务器 `docker image load -i` 从输入文件把镜像导入。归档不包含运行中的数据库数据。

**本地仓库根目录：**

```powershell
# 将两个已经构建的正式镜像保存为一个归档，不需要 tag 或 push 到仓库。
docker image save -o expense-images.tar daily-expense-api:20261016-1 daily-expense-web:20261016-1
# 将归档上传到已经按第 8 节准备好的服务器目录。
scp expense-images.tar deployer@203.0.113.10:/opt/expense/
```

**服务器窗口 B：**

```bash
# 进入正式目录，读取服务器刚收到的归档。
cd /opt/expense
# 将归档内两个镜像加载到服务器本地镜像列表。
docker image load -i expense-images.tar
# 核对两个短名镜像和 20261016-1 标签都已出现。
docker image ls
# 编辑正式配置，将 API_IMAGE/WEB_IMAGE 改为上面加载的短名。
nano .env
```

这里 API_IMAGE 填 `daily-expense-api`、WEB_IMAGE 填 `daily-expense-web`、APP_VERSION 填 `20261016-1`，才能找到加载的镜像。其余上传配置、初始化、HTTPS、验收仍逐项按第 9～11 节执行；第 10.1 节下载时只执行官方数据库的 `pull db`，跳过 `pull api web`，因为这两个短名并未发布到远程仓库。

镜像归档仍不含 Compose、密钥或命名卷数据；首次还需让服务器能拉取 MySQL 镜像，或将它一同保存传输。频繁更新更适合镜像仓库。

### 15.2 也可以直接在服务器构建

若暂不使用 Docker Desktop，可以在服务器克隆仓库、创建本文文件和正式 `.env`，改用本地镜像名，然后执行：

```bash
# 在服务器从源码构建镜像；构建不需要读取 HTTPS 证书。
docker compose -f compose.yaml -f compose.build.yaml build
# 首次申请证书前，用 HTTP 启动；已有 HTTPS 部署不要执行这条两文件启动命令。
docker compose -f compose.yaml -f compose.build.yaml up -d --wait --wait-timeout 300
```

然后按第 10 节申请证书并生成 `compose.override.yaml`。证书流程中的普通 `docker compose` 会找到刚构建的镜像；成功启用 HTTPS 后，后续源码构建的启动命令要带三份文件：

```bash
# 显式合并运行、构建和 HTTPS 配置，避免更新后退回镜像内的 HTTP 配置。
docker compose -f compose.yaml -f compose.build.yaml -f compose.override.yaml up -d --wait --wait-timeout 300
```

这条路线需要服务器有源码、Git 访问权限、构建所需内存和 npm 网络访问。它是主流程的替代方案，不要与“只拉镜像”的更新步骤混用。

## 16. iOS 与历史 Flutter 如何接入

**这一步做什么、有什么用：** 让原生移动端连接已经部署好的同一个正式 API。

**在哪里做、怎样算完成：** 本节按需阅读；iOS 的修改、编译和签名在 Mac 上完成，完成后做真机登录与流水验收。

移动端继续使用同一个正式 API，例如 `https://expense.example.com/api`，不需要额外发布后端 3000 端口。原生 App 不依赖浏览器 CORS 放行。

原生 iOS 在 Mac 修改现有 `ios/Config/Release.xcconfig`：

```xcconfig
// 设置 iOS Release 使用的正式 API；保留 $() 以免 xcconfig 将 // 当作注释。
API_BASE_URL = https:/$()/expense.example.com/api
```

保留 xcconfig 避免 `//` 注释的 `$()` 写法；只改 Debug 的本地配置不会改变 Release。编译、签名和真机验收仍按 `ios/README.md` 在 Mac 上完成。历史 Flutter 构建传入 `--dart-define=API_BASE_URL=https://expense.example.com/api`。

## 17. 常见问题排查

**这一步做什么、有什么用：** 按请求经过的各层定位问题，避免反复改配置却不知道哪一层出错。

**在哪里做、怎样算完成：** 本节按需查阅；先使用只读状态与日志检查，再针对已经定位的原因修复。

| 现象 | 优先检查 |
| --- | --- |
| Docker Server 连接失败 | 本地 Desktop 是否启动，服务器 Docker 服务是否正常，当前 Context 是否正确 |
| 服务器 permission denied | deployer 是否加入 docker 组，是否重新登录 |
| 镜像拉取 unauthorized | 仓库名、标签、服务器是否以正确账号登录私有仓库 |
| `no matching manifest` / `exec format error` | 发布平台是否与 `uname -m` 对应 |
| db 不健康 | `docker compose logs db`，密码、初始化 SQL、磁盘及原有卷状态 |
| 修改 SQL 后没有变化 | 初始化脚本只对空数据目录执行；旧库需要正式迁移 |
| API 连接 MySQL 失败 | `DB_HOST=db`、业务密码、db 状态，不能使用 API 容器自己的 localhost |
| 改数据库密码后仍拒绝连接 | 只改了 `.env`，没有修改已有数据库用户 |
| API 路径 404 或返回 HTML | Nginx API location 是否匹配 `/api`，proxy_pass 是否保留前缀，Web 是否使用 `/api` |
| Nginx 502 | API 是否 healthy，地址是否为 `api:3000`，resolver 是否使用 Docker DNS |
| HTTPS 申请失败 | 域名 A/AAAA、80 入站、验证文件是否返回原文、Certbot 输出和证书服务出站连接 |
| Nginx 报 cannot load certificate | 是否先签发证书、--cert-name 是否与配置路径一致、整个 certbot_conf 卷是否挂载 |
| 续期后仍显示旧证书 | 检查续期日志、Nginx 检查及 reload 是否成功，核对浏览器访问的域名 |
| 登录后刷新失效 | 正式 HTTPS、Cookie Path、Secure、刷新接口及浏览器日志 |
| 邮件失败 | 正式 SMTP 授权码、端口、云平台出站限制；生产不使用开发固定验证码 |
| 修改环境变量没有生效 | 用 `up -d` 重建对应容器，不只是 `restart` |
| 看起来“数据全没了” | 是否换了 Compose 项目名/卷、连接错库；先检查原卷，勿重新初始化 |
| 磁盘不足 | `df -h`、`docker system df`、备份保留量；不要盲目清理卷 |

**服务器常用只读检查：**

```bash
# 进入服务器正式部署目录，确保检查的是这套 Compose 项目。
cd /opt/expense
# 查看三个服务的运行与健康状态。
docker compose ps
# 查看数据库、API 和网页最近的日志。
docker compose logs --tail=100 db api web
# 查看 Docker 镜像、容器和卷的磁盘占用。
docker system df
# 列出命名卷，排查是否因项目名变化连接了空卷。
docker volume ls
# 查看 Docker 引擎最近 100 条系统日志。
sudo journalctl -u docker -n 100 --no-pager
# 查看主机端口监听情况，定位端口冲突。
sudo ss -lntp
# 查看文件系统剩余容量。
df -h
# 查看可用内存与交换空间。
free -h
```

排查按“数据库 → API → Web 代理 → 公网 HTTPS → 浏览器会话”逐层进行。`.env`、展开后的 `docker compose config`、`docker inspect` 以及日志可能包含敏感信息，对外分享前先脱敏。
