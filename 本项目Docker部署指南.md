# Daily Expense Tracking：使用 Docker 部署到 Ubuntu 云服务器

本文对应当前 `daily-expense-tracking` 仓库，参照[本项目 Ubuntu 部署指南](本项目Ubuntu部署指南.md)编写 Docker 版本，按“本地准备 → 本地验证 → 发布镜像 → 云端启动 → 验收 → 备份与更新”展开。本次文档整理日期：**2026-10-21**。示例发布标签只表示版本名，并非要求使用该日期。

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
| 6 | 本地电脑 → 镜像仓库 | 按服务器架构构建并推送 API/Web 版本 | 让服务器能下载已经打包好的程序 | 两个远程镜像标签和平台都正确；第 7 节 |
| 7 | 云平台、服务器 | 配 DNS、安全组、SSH 用户，安装 Docker Engine | 给云端提供运行容器和接收公网请求的环境 | 域名指向公网 IP，deployer 可运行 Docker，80/443 可用；第 8 节 |
| 8 | 本地 → 服务器 | 上传 Compose、环境模板、Nginx 配置与 SQL，在服务器填写正式 .env | 把运行方案、Nginx 配置、首次建库文件及正式密钥放到正确位置 | /opt/expense 文件齐全，占位符已替换；第 9 节 |
| 9 | 服务器 | 拉取镜像，先启动 HTTP，再用 Certbot 申请证书并启用 HTTPS 覆盖配置 | 依次初始化数据库、连接后端、验证域名并提供加密入口 | db/api healthy、Nginx 配置通过、HTTPS 与续期演练成功；第 10 节 |
| 10 | 浏览器与外部网络 | 验证 HTTPS、邮件、注册登录、流水和重建后的数据 | 证明用户真的能用，数据也不会随容器消失 | 第 11 节验收通过后再对外开放；已有账本先完成第 12 节 |
| 11 | 服务器、备份存储 | 建备份任务，并在隔离数据库中恢复一次 | 防止磁盘或主机损坏后无法找回账本 | 备份可恢复且有异机副本；第 13 节 |

后续发布的流程会更短：**改源码 → 测试 → 构建并推送新标签 → 服务器备份 → 改版本并拉取 → 必要时迁移数据库 → 启动并验收**，见第 14 节。Docker Desktop 不会自动替你把本地数据库搬到云端。

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

### 2.1 版本与示例值

| 项目 | 本文使用的值 |
| --- | --- |
| 服务器公网 IP | `203.0.113.10`，必须替换 |
| 服务器系统 | Ubuntu 24.04 LTS 64 位 UEFI 版，发行代号 `noble`；安装前按第 8.3 节核验 |
| 域名 | `expense.example.com`，必须替换 |
| SSH 用户 | `deployer` |
| 服务器部署目录 | `/opt/expense` |
| 正式 Compose 项目名 | `expense`，后续保持不变 |
| Node 镜像 | `node:24.11.0-bookworm-slim`，与 Web engines 一致 |
| MySQL 镜像 | `mysql:8.4`，8.4 LTS 系列 |
| Web 运行镜像 | `nginx:stable-alpine` |
| 证书工具镜像 | `certbot/certbot:latest`，按需执行，验证后固定 digest |
| 发布版本示例 | `20261016-1`，每次发布用新标签 |

**数据库版本与原教程的区别：** 原仓库 SQL 注明适用于 MySQL 8.0，而 MySQL 官方已宣布 8.0 于 2026 年 4 月结束生命周期。本文新部署选择 8.4 LTS；这不表示本仓库已经完成 8.4 全量兼容认证。首次部署应验证建表、分类初始化、登录、流水和统计；旧库升级须先在隔离库演练逻辑导入，不可把旧版本数据目录直接交给新镜像。[MySQL 8.0 发布说明](https://dev.mysql.com/doc/relnotes/mysql/8.0/en/)

`8.4`、`stable-alpine` 和 Certbot 的 `latest` 都会随发布变化。首次验证后记录实际 digest，正式环境可改用 `mysql:8.4@sha256:实际摘要` 等引用。应用镜像标签同样应避免被覆盖；不要以 `latest` 作为回退依据。

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

### 4.1 API：`service-nest/Dockerfile`

```dockerfile
# 以项目要求的 Node 24.11.0 作为编译环境，并把这个阶段命名为 build。
FROM node:24.11.0-bookworm-slim AS build
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
FROM node:24.11.0-bookworm-slim AS runtime
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

```dockerfile
# 使用项目要求的 Node 版本构建前端，并命名为 build 阶段。
FROM node:24.11.0-bookworm-slim AS build
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

`VITE_API_BASE_URL` 是构建时变量。这里构建为同源 `/api`，同一份镜像可以分别用于本地与正式域名，无需给每个域名重新打包。

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

**这一步做什么、有什么用：** 把三个独立容器组合成一套应用，明确连接、配置、端口与数据保存方式。

**在哪里做、怎样算完成：** 在本地仓库根目录创建 compose.yaml、compose.build.yaml、compose.https.yaml 和 .env.example；下一节再填写本地私有值。

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

### 5.3 根目录 `.env.example`：生产配置模板

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
# 生成一个 32 字节随机值并以 64 位十六进制输出；每个密码或密钥都要重新生成一次。
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

## 6. 用 Docker Desktop 在本地预演

**这一步做什么、有什么用：** 在自己的电脑先运行整套部署，提前发现构建、配置、数据库初始化和代理问题。

**在哪里做、怎样算完成：** 本地仓库根目录执行。完成标志是三个服务启动、页面可打开且测试 API 返回预期 JSON。

**本地 Windows PowerShell，在仓库根目录：**

```powershell
# 复制配置模板作为本地私有配置；如果已有此文件，请先保留已有内容。
Copy-Item .env.example .env.local
```

Mac 终端执行以下命令（Windows 已复制则跳过）：

```bash
# 从公开模板复制出本地私有配置，后面只编辑 .env.local。
cp .env.example .env.local
```

填写本地专用密码、密钥及真实 SMTP，并将以下字段改成（只替换这些字段，其他密钥和邮件字段仍然保留）：

```dotenv
# 指定 Compose 项目名；它决定容器、网络和卷的名称，正式部署后保持不变。
COMPOSE_PROJECT_NAME=expense-local
# 指定 API 镜像名；正式部署填自己的 Docker Hub 命名空间与仓库名，本地可用短名。
API_IMAGE=daily-expense-api
# 指定 Web 镜像名；与实际构建或推送的仓库名一致。
WEB_IMAGE=daily-expense-web
# 指定 API/Web 共用的镜像标签；正式环境必须是已经推送的版本。
APP_VERSION=local
# 设置后端允许的完整网页来源，协议、域名和非默认端口要与浏览器一致。
FRONTEND_ORIGIN=http://localhost:8080
# 指定入口绑定地址；127.0.0.1 仅本机可访问，0.0.0.0 接受外部 IPv4 连接。
BIND_ADDRESS=127.0.0.1
# 设置服务器或本机对外的 HTTP 端口，映射到 Web 容器的 80。
HTTP_PORT=8080
# 设置服务器或本机对外的 HTTPS 端口，映射到 Web 容器的 443。
HTTPS_PORT=8443
```

本地不申请公网证书，不需要填写证书邮箱；第 10 节在申请命令中填写自己的真实邮箱。本地与云端项目名不同，数据卷相互独立。编辑 `.env.local` 时不需要设置后端目录中的环境文件；第 5.1 节的 `environment` 会将值传给容器。

**Windows PowerShell / Mac 终端均可执行，每条单独运行：**

```powershell
# 合并运行和构建配置，读取本地变量并检查语法；quiet 避免打印展开后的密码。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml config --quiet
# 在本机分别构建 API 与 Web 镜像，此时不上传到镜像仓库。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml build
# 后台启动三项服务，最多等待 300 秒让健康检查和启动条件满足。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml up -d --wait --wait-timeout 300
# 查看三个服务的运行状态，预期 db/api 为 healthy、web 为运行中。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml ps
# 查看最近 100 行日志，确认初始化、API 和网页入口没有报错。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml logs --tail=100 db api web
```

`config --quiet` 检查配置，不输出展开后的密钥。正常时没有输出；每条命令成功后才执行下一条。数据库首次初始化可能耗时数分钟；若超时先看日志，不要删除卷来“重试”。`--wait` 会等待 db、api 健康及 web 运行，仍需检查真实 HTTP。

Windows 使用 `curl.exe`，Mac 使用 `curl`：

```powershell
# 请求本地首页响应头，预期状态码为 200。
curl.exe -I http://localhost:8080
# 故意发送空登录数据，预期得到 API 的 400 JSON，证明反向代理已连通。
curl.exe -i -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" --data '{}'
```

预期首页 200、空登录请求 **400 JSON**。打开 `http://localhost:8080` 检查页面、静态资源和页面刷新。Docker Desktop 的 Containers 页面应能看到该 Compose 应用及三个服务，可查看日志、停止和启动容器。

本地仍以 `production` 运行，Refresh Cookie 会带 `Secure`；localhost 在部分浏览器有特殊待遇，本地 HTTP 结果不能替代正式 HTTPS 下的 Cookie 验收。生产验证码也不会使用开发固定值。

暂停预演：

```powershell
# 停止并移除本地预演容器及默认网络；不加 -v，因此保留命名卷中的数据。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml down
```

`down` 默认保留命名卷；不要添加 `-v`，它会删除本次 Compose 的命名卷。重建容器也不会清空账本。

## 7. 发布镜像：让云服务器直接拉取

**这一步做什么、有什么用：** 把已验证的程序打包成服务器可下载的指定版本。

**在哪里做、怎样算完成：** 本地仓库执行并上传到 Docker Hub。完成标志是 API/Web 两个标签存在，平台与服务器一致。

### 7.1 准备镜像仓库

在 Docker Hub 创建 `daily-expense-api`、`daily-expense-web` 两个仓库，按需要设为私有。以下 `yourname` 全部替换成自己的用户名；CLI 登录时按提示使用访问令牌，避免把令牌放到命令、文档或 Dockerfile 中。

**本地执行：**

```powershell
# 登录本机 Docker Hub 账号，允许后面的命令推送镜像。
docker login
```

### 7.2 为服务器架构构建并推送

以下假设服务器是 `x86_64`；arm64 服务器将目标改为 `linux/arm64`。

**本地仓库根目录执行：**

```powershell
# 为 amd64 服务器构建 API 镜像，标记发布版本并推送到自己的仓库。
docker buildx build --platform linux/amd64 -f service-nest/Dockerfile -t yourname/daily-expense-api:20261016-1 --push service-nest
# 为同一架构构建 Web 镜像，并推送相同发布版本。
docker buildx build --platform linux/amd64 -f web/Dockerfile -t yourname/daily-expense-web:20261016-1 --push web
# 检查远程 API 镜像是否存在，并记录平台与 digest。
docker buildx imagetools inspect yourname/daily-expense-api:20261016-1
# 检查远程 Web 镜像是否存在，并记录平台与 digest。
docker buildx imagetools inspect yourname/daily-expense-web:20261016-1
```

如果希望同时支持两类服务器，将两条构建命令的 `--platform` 改为 `linux/amd64,linux/arm64`，并继续使用 `--push`。Docker Desktop 支持模拟构建，跨架构编译可能更慢；若某依赖不兼容，应修复构建或使用对应架构的构建机。

`--push` 将结果写到仓库，不保证结果出现在本地 Images 列表。检查仓库标签和镜像支持的平台；云端最终使用这个发布版本再次验收。源码提交 ID、版本标签和镜像 digest 建议一起记录。

## 8. 准备 Ubuntu 云服务器

**这一步做什么、有什么用：** 准备一个能接收公网请求并长期运行容器的 Ubuntu 环境。

**在哪里做、怎样算完成：** DNS 和安全组在云平台配置；安装与权限在服务器配置。完成后能用 deployer 登录并运行 Docker。

### 8.1 域名和安全组

DNS 将 `expense.example.com` 的 A 记录指向真实公网 IP。本文端口发布按 IPv4 配置；暂不使用 IPv6 时不要留一个无法访问的 AAAA 记录。

| 入站端口 | 来源 | 用途 |
| --- | --- | --- |
| TCP 22 或真实 SSH 端口 | 自己的管理 IP | SSH |
| TCP 80 | 公网 | HTTP、证书验证和跳转 |
| TCP 443 | 公网 | HTTPS |

不开放 API 3000、数据库 3306 或 Docker 管理端口 2375。出站需能访问 DNS、Docker 软件源、镜像仓库、证书服务及 SMTP。

**本地 Windows：**

```powershell
# 检查域名 A 记录是否已经指向服务器的真实公网 IPv4。
Resolve-DnsName expense.example.com -Type A
# 以云平台提供的初始管理员账号登录服务器；按实际情况替换账号和 IP。
ssh ubuntu@203.0.113.10
```

默认账号若是 root 就换成 root；密钥登录增加 `-i 私钥路径`。首次连接核对云平台提供的主机指纹。自定义 SSH 端口时，`ssh` 使用小写 `-p`；后面的 `scp` 使用大写 `-P`。需要指定密钥时，两者都加相同的 `-i`，例如：

```powershell
# 用实际私钥和自定义 2222 端口登录；路径、端口、账号、IP 都按自己的配置替换。
ssh -i "$env:USERPROFILE/.ssh/id_ed25519" -p 2222 ubuntu@203.0.113.10
```

Mac 把密钥路径改为自己主目录下的实际路径。后续示例省略这些可选参数，执行时继续带上自己需要的参数。

### 8.2 创建部署用户和目录

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

先确认真实 SSH 端口再启用 UFW：

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

**Docker 发布端口的流量可能绕过 UFW 的常规规则**，不能认为 `ufw deny 3306` 一定能阻止被 Docker 发布的数据库端口。本文直接不发布 db/api，配合云安全组控制公网入口。[Docker 与防火墙说明](https://docs.docker.com/engine/network/packet-filtering-firewalls/)

服务器 80/443 必须空闲；本文由容器内的 Nginx 占用它们。若已按原教程部署宿主机 Nginx，先备份旧配置、确认迁移窗口并停止冲突服务，再切换，不能让宿主机和容器同时占用同一端口。

## 9. 上传运行文件，在云端创建生产配置

**这一步做什么、有什么用：** 将运行定义和初始化脚本放到云端，并单独填写正式密码与域名。

**在哪里做、怎样算完成：** 上传在本地执行；创建 .env 在服务器 /opt/expense 执行。完成后目录与模板值均已核对。

**服务器 deployer：**

```bash
# 创建服务器上的部署子目录，稍后把初始化 SQL 上传到这里。
mkdir -p /opt/expense/deploy
```

**本地仓库根目录，Windows / Mac 均可：**

```powershell
# 从本地上传运行定义、HTTPS 覆盖模板和不含真实密钥的环境模板。
scp compose.yaml compose.https.yaml .env.example deployer@203.0.113.10:/opt/expense/
# 从本地上传初始化 SQL 与正式 Nginx 配置两个目录。
scp -r deploy/mysql-init deploy/nginx deployer@203.0.113.10:/opt/expense/deploy/
```

如果第 8 节的 SSH 使用了自定义端口和指定密钥，上传时也要带上。例如 Windows PowerShell：

```powershell
# 以同一把私钥和自定义 SSH 端口上传运行配置；scp 的端口参数是大写 -P。
scp -i "$env:USERPROFILE/.ssh/id_ed25519" -P 2222 compose.yaml compose.https.yaml .env.example deployer@203.0.113.10:/opt/expense/
```

这条是上一组上传命令的参数示例；初始化目录那条 `scp -r` 也同样加上实际的 `-i` 和 `-P`。

服务器最终必须有根目录的 `compose.yaml`、`compose.https.yaml`、`.env.example`，以及 `/opt/expense/deploy/mysql-init/01-init.sql`、`02-app-grants.sql` 和 `/opt/expense/deploy/nginx/https.conf`。不要上传 `.env.local`、`node_modules` 或 Docker Desktop 的虚拟磁盘。

**服务器执行：**

```bash
# 切换到服务器部署目录，后面的 Compose 命令在这里执行。
cd /opt/expense
# 让接下来创建的私有文件默认仅当前用户可访问。
umask 077
# 首次部署时从模板创建正式环境文件；已有 .env 时不要覆盖。
cp .env.example .env
# 限制正式配置文件只有文件所有者可读写。
chmod 600 .env
# 打开正式配置文件，填写本服务器专用的密码、域名、镜像和 SMTP 参数。
nano .env
```

将模板占位符全部换成正式值，尤其是镜像用户名、版本、HTTPS 来源、随机密钥和 SMTP。另核对 `deploy/nginx/https.conf` 中所有域名和证书路径；这些 Nginx 配置不会由 `.env` 自动替换。保持 `COMPOSE_PROJECT_NAME=expense`；生产端口为 80/443，绑定地址为 `0.0.0.0`。

nano 保存：`Ctrl+O`、回车、`Ctrl+X`。仓库已有 `.gitignore` 忽略 `.env`、`.env.*` 并放行 `.env.example`，但仍要在提交前检查，不能提交真实密钥。

私有镜像需要在服务器执行 `docker login`，使用仅有拉取权限的令牌。Docker 凭据应留在部署账号的私有目录；不要把凭据复制到 Compose。

## 10. 首次启动、申请证书与启用 HTTPS

**这一步做什么、有什么用：**先让数据库、API 和 HTTP 网页入口可用，再申请证书并切换到 HTTPS，最后配置续期。

**在哪里做、怎样算完成：**除标注的公网检查外，服务器 deployer 在 /opt/expense 执行。完成标志是基础数据正确、HTTPS 可访问、续期演练成功且定时任务已保存。

### 10.1 先使用 HTTP 配置启动三个常驻服务

第一次部署时根目录**还没有 `compose.override.yaml`**，因此 Web 使用镜像里的 HTTP 配置；数据库卷为空时才会初始化。若这套部署已经启用 HTTPS，保留现有覆盖文件和证书，直接按第 14 节更新，不要重新走首次申请流程。

**服务器 `/opt/expense`：**

```bash
# 检查运行定义与正式变量，不输出展开后的密码。
docker compose config --quiet
# 检查建表脚本存在且不为空；失败时先补齐文件，不继续启动。
test -s deploy/mysql-init/01-init.sql
# 检查业务账号权限脚本存在且不为空。
test -s deploy/mysql-init/02-app-grants.sql
# 检查准备好的正式 Nginx 配置文件存在；此时只是检查文件，尚未启用。
test -s deploy/nginx/https.conf
# 拉取三个常驻服务使用的镜像；Certbot 首次 run 时会另行拉取。
docker compose pull
# 按 db → api → web 的依赖顺序启动，最多等待 300 秒。
docker compose up -d --wait --wait-timeout 300
# 查看状态，预期 db/api healthy、web 运行；certbot 不在常驻服务中。
docker compose ps
# 查看初始化、后端和 HTTP 入口最近 100 行日志。
docker compose logs --tail=100 db api web
# 检查 Nginx HTTP 配置，预期显示 syntax is ok 和 test is successful。
docker compose exec -T web nginx -t
```

此时仅 HTTP 可用，443 虽已做端口映射，但 Nginx 尚未监听它。**先不要在这个 HTTP 临时入口进行正式登录或录入真实账本。** 第 11 节的完整业务验收在 HTTPS 启用后进行。

```bash
# 列出正式部署的命名卷，记录 expense_db_data 和证书相关卷的真实名称。
docker volume ls --filter label=com.docker.compose.project=expense
# 用业务账号检查表及分类初始化是否成功。
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -u"$MYSQL_USER" "$MYSQL_DATABASE" -e "SHOW TABLES; SELECT COUNT(*) AS icon_count FROM category_icons; SELECT COUNT(*) AS template_count FROM category_templates;"'
```

全新库应是 **9 张表、112 个图标、84 条分类模板**。已有真实数据按实际核对，不重新跑初始化覆盖旧库。若需要迁入旧账本，可在正式开放前按第 12 节导入，再继续完整验收。

### 10.2 验证 HTTP 域名访问，然后申请证书

Certbot 的 webroot 模式在共享卷里写入随机验证文件，证书服务通过你的公网域名的 80 端口读取文件，以证明你能控制该域名。申请和续期时都要保持这条路径可达。[Certbot webroot 文档](https://eff-certbot.readthedocs.io/en/stable/using.html#webroot)

**服务器执行，写入一个不含敏感信息的测试文件：**

```bash
# 临时启动证书工具里的 shell，在共享验证卷创建测试文件；完成后删除工具容器。
docker compose run --rm --entrypoint sh certbot -c 'mkdir -p /var/www/certbot/.well-known/acme-challenge && printf "%s\n" expense-acme-ok > /var/www/certbot/.well-known/acme-challenge/deploy-check'
```

**本地 Mac 或外部 Linux 终端检查；Windows 把 curl 换成 curl.exe：**

```bash
# 从公网读取测试文件，必须返回 expense-acme-ok，不能是网页 HTML。
curl -fsS http://expense.example.com/.well-known/acme-challenge/deploy-check
```

如果失败，先检查 DNS、安全组、服务器 80 端口和 Nginx 的验证路径，不要继续反复申请。这里的域名必须已替换为真实域名，不能用示例域名或单纯用 IP 申请本教程的域名证书。

**回到服务器 `/opt/expense` 申请证书。先替换域名与邮箱，两个域名参数保持一致：**

```bash
# 用共享 webroot 完成验证，固定证书目录名，并同意证书服务条款；邮箱填写你自己的真实邮箱。
docker compose run --rm certbot certonly --webroot -w /var/www/certbot --cert-name expense.example.com -d expense.example.com --email you@example.com --agree-tos --non-interactive
```

申请成功后，证书在 `certbot_conf` 卷中的 `/etc/letsencrypt/live/expense.example.com/`。Nginx 已只读挂载整个卷，所以能读取证书链和私钥。`--cert-name` 的值必须与 HTTPS 配置中的证书目录名一致；申请失败时保持当前 HTTP 配置，修复原因后再试。

`certbot` 带有 `profiles: [tools]`，平时 `up` 不会启动它；上面显式执行 `run certbot` 会自动启用这个工具服务，用完即退出，不需要多启动一个常驻进程。[Compose profiles 说明](https://docs.docker.com/compose/how-tos/profiles/)

### 10.3 拿到证书后再启用 HTTPS

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

## 12. 把本地真实账本迁移到容器数据库

**这一步做什么、有什么用：** 把已有真实账本从旧环境迁到云端，避免上线后得到一套空账本。

**在哪里做、怎样算完成：** 有旧数据才做本节。先在隔离数据库演练；正式导入期间停止写入，导入后回第 11 节验收。

本节可替换“只使用全新空库”的数据流程。已有账本时，第 10 节先确认容器和空库可用，再完成本节导入，最后回到第 11 节正式验收，对外开放前停止旧环境写入。先暂停旧环境写入、做好备份；涉及 MySQL 8.0 → 8.4 时，先按第 13 节在隔离环境验证导入和业务，再执行正式迁移。

**本地 Windows，需有兼容的 MySQL 导出工具：**

```powershell
# 在本地创建导出文件存放目录；可换成自己有权限的目录。
New-Item -ItemType Directory -Force D:/expense-backups
# 交互输入本地管理员密码，一致性导出本项目业务库；result-file 避免 PowerShell 改变 SQL 编码。
mysqldump --host=127.0.0.1 --user=你的本地管理员 --password --single-transaction --no-tablespaces --set-gtid-purged=OFF --databases daily-expense-tracking --result-file=D:/expense-backups/expense.sql
# 把导出的 SQL 上传到服务器部署账号的主目录。
scp D:/expense-backups/expense.sql deployer@203.0.113.10:/home/deployer/
```

使用 `--result-file` 避免旧版 PowerShell 重定向改变编码；不要原样复制本地 MySQL 数据目录。若本地 MySQL 也在 Docker 中，可使用第 13 节的容器内导出方式。

**服务器，只对已经确认的目标库操作：**

```bash
# 切换到服务器的正式部署目录。
cd /opt/expense
# 将导出的真实账本 SQL 设为仅当前用户可读写。
chmod 600 ~/expense.sql
# 停止网页和 API，暂停通过本部署产生的业务写入。
docker compose stop web api
# 以数据库管理员身份将 SQL 导入正式 db；执行前须已备份目标并确认导入对象。
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot' < ~/expense.sql
# 导入成功后重新启动服务，再按第 11 节核对账本和登录。
docker compose up -d --wait --wait-timeout 300
```

SQL 可能包含 DROP TABLE，目标已有数据时必须先备份，不可直接覆盖。导出文件只含本项目业务库，不包含 `mysql` 系统库和账号；正式业务账号仍由云端初始化配置管理。核对用户、流水、分类、统计与邮件后再停止使用旧环境，避免两边继续写入。

## 13. 数据备份、定时任务与恢复演练

**这一步做什么、有什么用：** 让账本在误操作、磁盘损坏或整机丢失后有可验证的恢复来源。

**在哪里做、怎样算完成：** 服务器创建并试跑备份脚本，隔离库验证恢复，再安排定时任务与异机副本。

### 13.1 先理解卷与备份

`db_data` 让数据在容器重建后保留，**它仍在同一台服务器上，不等于备份**。删除卷、磁盘损坏或整机丢失都可能丢数据。不要执行 `docker compose down -v` 或不加核对的卷清理命令。

另需私下备份 `.env`、Compose（包括已启用的 `compose.override.yaml`）、`deploy/nginx/https.conf`、初始化/迁移 SQL 和续期脚本。`certbot_conf` 卷保存私钥、账户、`renewal`、`live` 和 `archive`，应完整保留目录与符号链接并按敏感数据备份；不要只复制 `live` 中的链接。运行中的 MySQL 数据目录不能简单打包充当一致性备份。

### 13.2 创建可重复执行的备份脚本

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
# 编辑当前 deployer 用户的定时任务表，把下一段 cron 规则加入其中。
crontab -e
```

添加 deployer 的定时任务：

```cron
# 按服务器时区每天 03:30 执行备份，并将标准输出和错误追加到备份日志。
30 3 * * * /home/deployer/bin/backup-expense >> /home/deployer/expense-backups/backup.log 2>&1
```

每天服务器时区 03:30 备份；检查日志和磁盘，制定保留周期，并通过自己控制的方式保留异机副本。仅看文件大小或 `gzip -t` 不能证明数据库可恢复。

### 13.3 使用另一组 Compose 卷做恢复演练

选择磁盘和内存足够的测试服务器，或在本服务器上仅启动隔离数据库。下面用不同项目名 `expense-restore`，不发布数据库端口，不启动会发邮件的 API。

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

## 14. 后续发布、配置修改与回退

**这一步做什么、有什么用：** 以可核对的版本更新程序，并在旧代码仍兼容数据库时回退应用。

**在哪里做、怎样算完成：** 本地构建并推送新镜像；服务器备份、换版本、拉取、迁移及验收。首次上线时可先读过再查用。

### 14.1 发布新版本

本地直接执行下面提到的 npm 检查，需要已安装项目要求的 Node 24.11.0，并在两个目录各自安装锁文件中的依赖；也可以让已有 CI 执行。Docker 主部署流程中的 Node 已在镜像内，不要求云服务器另装 Node。不要在没有 Node 的本地终端直接执行 npm 命令。

1. 本地/CI 完成项目已有测试及构建：后端 `npm test -- --runInBand`，前端 `npm run test:unit -- --run`，两个目录各自执行 `npm run build`。
2. 为目标架构构建并推送两个新镜像，例如 `20261017-1`；保留旧标签。
3. 阅读新版本配置和数据库变更，确认所需迁移 SQL，备份后再操作。

**服务器先保存当前配置并备份：**

```bash
# 进入正式部署目录。
cd /opt/expense
# 让接下来保存的配置副本仅当前用户可访问。
umask 077
# 给现有 .env 保存带时间戳的副本，便于核对旧版本配置。
cp .env ".env.before-$(date +%Y%m%d_%H%M%S)"
# 运行已经验证过的数据库备份脚本。
~/bin/backup-expense
# 把 APP_VERSION 改为已推送的新版本，按需要补充新配置。
nano .env
```

只将 `APP_VERSION` 改成已推送的新标签，按版本需要补充配置。接着：

```bash
# 检查新版本的运行定义和变量是否完整。
docker compose config --quiet
# 在旧服务仍运行时先下载新 API/Web 镜像，减少停机等待。
docker compose pull api web
# 停止网页和 API，为必要的数据库升级准备维护窗口。
docker compose stop web api
```

若本次提供了经过审核的结构迁移，在此时以管理员身份导入真实迁移 SQL；仓库当前没有可直接调用的通用迁移命令，不要重新导入 `init.sql` 代替升级，也不要开启生产同步。

```bash
# 仅当本版本确实有此迁移文件且已审核时执行，并先替换为真实路径；无迁移就跳过。
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot daily-expense-tracking' < deploy/本版本实际迁移.sql
# 使用新版本配置启动服务并等待健康检查。
docker compose up -d --wait --wait-timeout 300
# 查看新版本 API 与网页日志，随后执行第 11 节业务验收。
docker compose logs --tail=100 api web
```

重复第 11 节验收。这是一套短暂停机发布流程，不承诺零中断；数据库版本升级应另行安排，不和每次业务镜像发布混在一起。

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

### 14.3 回退应用镜像

核对更新前保存的配置，确认旧代码兼容当前数据库结构后，把 `.env` 的 `APP_VERSION` 改回旧标签，然后：

```bash
# 将 APP_VERSION 改回兼容的旧标签后，拉取该版本 API/Web 镜像。
docker compose pull api web
# 按当前配置重建为旧应用版本，等待启动后再次验收。
docker compose up -d --wait --wait-timeout 300
```

不要直接恢复整份旧 `.env` 而遗漏已经轮换的密钥或数据库密码。回退镜像不会撤销数据库迁移，也不会恢复数据卷中的旧数据；有破坏性迁移时需单独设计恢复方案。

## 15. 可选：从电脑通过 SSH 管理云端 Docker

**这一步做什么、有什么用：** 了解通过远程连接、离线传镜像或服务器构建进行部署的替代办法。

**在哪里做、怎样算完成：** 本节选读，不是首次上线主线；选择一种路线后使用与之匹配的上传和更新步骤。

如果希望在本地终端检查云端容器，Docker CLI 支持 SSH Context。先确认 `ssh deployer@真实IP` 可用，且该用户有服务器 Docker 权限。[Docker 官方 SSH 连接说明](https://docs.docker.com/engine/security/protect-access/)

**本地 Windows / Mac：**

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

可在本地为服务器平台构建并 `--load`，再使用 `docker image save -o expense-images.tar 镜像1 镜像2`，通过 `scp` 传输后在云端 `docker image load -i expense-images.tar`。生产 Compose 填加载进去的同名标签，再 `up -d`，不要继续对不存在的远程标签执行 `pull`。

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
