# 从零使用 Docker 部署全栈项目：Docker Desktop → 镜像仓库 → Ubuntu 云服务器

本文面向这样的读者：会开发前后端，项目能在自己的电脑运行，但还没有用 Docker 发布过项目，也不熟悉服务器运维。我们会从“程序怎样变成镜像”开始，一步步走到“别人用域名访问网站”，再完成证书续期、备份和第二次发布。本文参照[全栈项目部署教程](全栈项目部署教程.md)编写，是适配其他项目的通用模板。

实操模板采用 **Ubuntu 24.04 LTS 64 位 UEFI 版 + 静态 SPA 前端 + Node.js API + MySQL 8.4 LTS + Nginx 反向代理 + Certbot 管理 HTTPS 证书**。服务器系统的发行代号为 `noble`，24.04.x 维护版本也适用。Vue/React 静态项目可套用；其他语言、SSR、云数据库的替换方法见第 17 节。针对当前仓库的具体路由、密钥、初始化数据和移动端配置，请使用[本项目 Docker 部署指南](本项目Docker部署指南.md)。

本次整理日期：**2026-10-21**；示例发布标签仍用 `20261016-1`。本文是可迁移的教程模板，里面的文件需要你按真实项目创建、适配；本次文档整理没有在服务器执行部署。

**先确定使用哪一篇。** 如果你正在部署这个记账仓库，优先使用[本项目 Docker 部署指南](本项目Docker部署指南.md)，其中的后端目录、密钥和 SQL 已按实际代码核对。本文使用 `server/`、`JWT_SECRET`、`/api/health` 等教学约定；你需要先完成第 3 节的信息表，再把这些约定替换成真实项目值。

本文每个操作小节都按“前面要准备好什么 → 解释新参数 → 执行命令 → 看结果”推进。**构建镜像、给镜像起仓库名称、上传镜像、下载镜像、启动容器是五个不同动作，会分别展示。**

## 先看全程：从电脑里能运行，到域名能访问

**部署的最终目标：别人打开你的 HTTPS 域名，能看到页面、调用 API，并且数据在重建容器后仍然存在。** 本文采用一条主路线：**本地准备配置并预演 → 构建镜像 → 推送镜像仓库 → SSH 登录服务器 → 上传运行配置 → 拉取镜像 → 准备数据库 → 启动 HTTP 应用 → 申请证书 → 为 Nginx 开启 HTTPS → 验收、续期和备份。**

可以把镜像理解为“装好程序和依赖的发布包”，把 Compose 理解为“把前端、后端、数据库连起来的运行说明书”。代码通过镜像仓库传输；密码、数据库数据和服务器配置单独管理。

| 顺序 | 在哪里做 | 做什么 | 这一步起什么作用 | 完成标志 | 对应章节 |
| --- | --- | --- | --- | --- | --- |
| 1 | 本地，阅读代码 | 确认启动命令、目录、端口、接口、数据库与配置变量 | 确定要装进镜像的到底是什么，避免照抄错误入口 | 填好项目运行信息表，代码能按正式方式构建 | 第 1～3 节 |
| 2 | 本地电脑 | 安装 Docker Desktop；确认目标服务器 CPU 架构 | 提供镜像构建和本地容器运行工具，确定镜像平台 | Docker Client/Server 可用，知道目标是 amd64 还是 arm64 | 第 4 节 |
| 3 | 本地项目目录 | 创建 Dockerfile、Nginx HTTP/HTTPS 配置、Compose 和环境模板 | 将“怎样打包、怎样互相访问、证书和数据放哪里”写进文件 | 文件齐全，真实变量名、入口、域名和路由已适配 | 第 5～6 节 |
| 4 | 本地项目目录 | 选定 SQL 初始化或 ORM migration，准备真实表结构 | 让新数据库拥有应用所需表，决定旧数据怎样迁入 | SQL/迁移已审核；已有数据迁移方案明确 | 第 7 节；有旧数据再看 13.4 |
| 5 | 本地电脑 | 用本地配置启动并测试页面、接口与读写 | 在发布之前发现构建、容器网络和数据库问题 | 本地核心流程正常，测试后停容器并保留数据卷 | 第 8 节 |
| 6 | 本地 → 镜像仓库 | 按目标架构构建 → 检查本地镜像 → 打仓库标签 → 登录 → 分别执行 push | 让服务器取得和本地准备一致的程序发布包 | 两个镜像标签存在，架构正确，记录 digest | 第 9 节 |
| 7 | 云控制台、本地、服务器 | 配置 DNS/安全组，创建部署用户，安装 Engine/Compose | 准备公网入口、SSH 管理通道和容器运行环境 | SSH 可用、Docker 可用；DNS 正确，80/443 允许入站且空闲 | 第 10 节 |
| 8 | 本地 → 服务器 | 上传 Compose/初始化文件，填写独立生产配置 | 告诉服务器运行哪个版本、用哪个域名和密钥 | 服务器文件齐全，`.env` 完成替换且仅部署用户可读 | 第 11 节 |
| 9 | 服务器 → 外部浏览器 | 拉镜像，核对数据库，启动 HTTP；用 Certbot 申请证书，再切换 Nginx HTTPS | 先提供证书验证入口，再启用加密访问并确认业务可用 | HTTPS、登录、核心读写、证书续期、重建/重启验收均通过 | 第 12 节 |
| 10 | 服务器和异机备份位置 | 导出数据库，备份证书与配置，安排备份并练习恢复 | 让数据在误操作或服务器丢失后仍有可恢复副本 | 有可验证备份、异机副本和恢复演练记录 | 第 13 节 |
| 11 | 本地与服务器 | 记录版本、配置位置和发布步骤 | 让下一次发布、回退或换服务器时有据可查 | 部署记录完整，知道如何更新和回退 | 第 14、19 节 |

**第一次从第 1 节读起，理解少量概念后按第 3～13 节依次操作，再补第 19 节记录。** 第 1～2 节帮助理解；第 14 节留到第二次发布；第 15～17 节是选读替代方案，不要与主线混用；遇到问题再按第 18 节逐层排查。第 7.2 的最小权限、第 7.3 的 ORM 路线、第 13.4 的旧数据迁移，仅在项目需要时采用。

### 先统一示例名称和执行位置

| 本文写法 | 含义与替换方法 |
| --- | --- |
| `my-fullstack/` | 你的项目根目录，里面示例使用 `web/`、`server/`；当前记账项目的后端目录不同，按专用指南操作 |
| `app.example.com`、`203.0.113.10` | 示例域名和示例公网 IP，全部替换为你实际拥有的值 |
| `yourname` | 镜像仓库账号，替换后在构建标签和 `.env` 中保持一致 |
| `deployer`、`/opt/my-fullstack` | 本文创建的服务器部署用户和运行目录，可自定义但后文要同步修改 |
| `20261016-1` | 本次发布的示例版本号；API 和 Web 使用同一标签，每次发布换新标签 |
| “本地项目根目录” | 在自己的电脑打开终端并进入源码根目录后执行 |
| “服务器” | 先用 SSH 登录 Ubuntu，再在这个远程终端执行；不能直接粘到本地 PowerShell |

每个可执行代码或配置行的**上一行**都写了中文注释，说明它的作用。复制时保留这些合法注释即可。标为目录树/链路图的 `text` 块只是示意，不是命令。Bash 代码用于 Ubuntu/macOS；PowerShell 代码用于 Windows；跨平台 Docker 命令每条独立执行。文件内容示例要保存到标明的文件里，不能把 Dockerfile/YAML 当作终端命令。

**执行规则：按顺序一条一条执行，上一条成功再继续；任何一步报错，先停在这里，按第 18 节定位原因。** 代码块不会自动阻止你继续粘贴后面的命令；尤其是建表检查、备份、导入和镜像拉取失败时，不要继续切换应用。

**下面所有正式步骤都以“空的新数据库”作为主线。** 如果已经有真实数据，先读第 13.4 节，在第 12 节启动 API/Web 之前完成导入；不要先开放一个空系统让用户继续录入。

## 1. 先弄清：我们要准备哪些镜像，运行哪些容器

**这一步做什么、为什么做：**先建立和日常开发对应的概念，知道后面每条命令在处理什么。

**在哪里做：**只阅读，不执行命令。 **完成标志：**能区分镜像、容器、数据卷，知道三个业务容器为什么只制作两个应用镜像。

### 1.1 从你熟悉的开发流程开始理解

开发时，你通常先安装 Node、安装依赖、编译项目，再启动服务。Dockerfile 把这些安装和编译步骤写成文件；Docker 按它制作出一份**镜像**，里面包含程序及运行所需的环境。

**镜像是准备好的运行材料，容器是用这些材料启动的进程环境。** 同一个镜像可以在电脑或服务器上启动容器；把容器删掉再创建，不需要重新手工安装 Node。数据库的真实数据要另外保存在**数据卷**里，因此镜像、容器和数据不能当成同一件东西。

| 对象 | 可以这样理解 | 本教程的例子 |
| --- | --- | --- |
| 源码 | 你正在开发和修改的项目 | Vue/React、Node API、SQL |
| Dockerfile | 制作一个镜像的操作说明 | 安装依赖、编译、复制产物、指定启动命令 |
| 镜像 image | 已包含程序和运行环境的发布包 | API 镜像、Web 镜像、官方 MySQL 镜像 |
| 容器 container | 从镜像创建并启动的运行实例 | 正在接收请求的 API 进程和 Nginx |
| 数据卷 volume | 在容器之外持续保存数据的空间 | MySQL 的用户、订单、账目等真实数据 |
| Compose | 把多个服务连起来的运行清单 | 指定谁连接谁、端口怎么映射、数据保存在哪 |
| 镜像仓库 registry | 保存镜像、供服务器下载的地方 | Docker Hub；它与保存源码的 Git 仓库用途不同 |

### 1.2 三个常驻业务容器，只需要自己制作两个镜像

| 服务名 / 容器用途 | 镜像从哪里来 | 你需要做什么 |
| --- | --- | --- |
| `api`：后端接口 | 用项目自己的 Dockerfile 构建 | 把后端代码、依赖和 Node 运行环境打包 |
| `web`：网页入口 | 基于官方 Nginx 镜像构建项目镜像 | 加入前端构建产物和 Nginx 代理配置 |
| `db`：数据库 | 直接使用官方 `mysql:8.4` | 配密码、初始化 SQL、数据卷；不用自己制作 MySQL 镜像 |
| `certbot`：证书工具 | 直接使用官方 Certbot 镜像 | 申请或续期时临时运行，用完退出，不是第四个常驻业务服务 |

第 5 节只写 API/Web 的 Dockerfile，正是因为 MySQL 和 Certbot 已有现成的官方镜像。准备 SQL 是让官方 MySQL 在首次启动时建立业务表，**不是重新制作 MySQL 程序镜像**。官方 MySQL、Certbot 的下载会在后文明确执行 `pull`。

### 1.3 先记住这些动作，不要把“打包”和“发布”混在一起

| 命令 | 做什么 | 完成后发生什么 |
| --- | --- | --- |
| `docker build` | 读 Dockerfile 并构建镜像 | 本机多出一份镜像；此时还没有上传 |
| `docker image ls` | 列出本机镜像 | 用来核对刚构建的名称、标签与镜像 ID |
| `docker tag` | 给已有镜像加一个名称和版本标签 | 增加仓库需要的名称，镜像内容不变；此时仍没有上传 |
| `docker login` | 登录镜像仓库 | 允许这台电脑按账号权限上传或下载镜像 |
| `docker push` | 把本机指定镜像上传到仓库 | 仓库里出现这个版本；服务器现在可以下载它 |
| `docker pull` | 把仓库中的镜像下载到当前 Docker 主机 | 本机或服务器有了镜像；此时还没有启动应用 |
| `docker compose up` | 按 Compose 定义创建并启动容器 | 程序开始运行；具体就绪情况还要检查 |

本教程的发布主线会逐条执行 `build → image ls → tag → login → push`，服务器再执行 `pull → up`。不会把上传动作藏在构建命令的一个参数里。第 9 节会在命令前解释镜像名称、版本标签和每个构建参数。

### 1.4 请求最终怎样经过这套应用

下图只表示流向，不需要执行：

```text
浏览器访问你的域名
  → 公网 80/443 端口
  → web 容器中的 Nginx
      ├─ 页面和 JS/CSS → 镜像内的前端文件
      └─ /api/... → api 容器 → db 容器 → 数据卷

Certbot 临时工具 → 写入验证文件 → 域名验证通过 → 保存证书 → Nginx 读取证书
```

只开放 Nginx 入口，API 与数据库在容器内部网络通信。证书、正式密码和数据库数据不会因为你上传了应用镜像就自动准备好；后面会分别处理。

## 2. Docker Desktop 能否提前配置好，再给云服务器使用



**这一步做什么、为什么做：**明确本地 Desktop 和云端 Engine 的分工，知道哪些文件能带过去、哪些内容必须重新准备。

**在哪里做：**阅读即可。 **完成标志：**选定本文主线：本地构建 → 镜像仓库 → SSH 云端运行。

**能。推荐把可复用的内容保存在 Dockerfile 和 Compose 文件中，本地验证后发布镜像。** Windows 与 Mac 都有官方 Docker Desktop，它包含图形界面和本教程使用的 Docker/Compose 工具。[Docker Desktop 文档](https://docs.docker.com/desktop/)

完整操作分成三个动作：

1. **在本地准备**：写 Dockerfile、Compose，使用本地专用配置启动和测试。
2. **分发发布包**：把 Linux 镜像推到镜像仓库，把 Compose 和必要的 SQL/配置文件上传服务器。
3. **在云端运行**：安装 Docker Engine，单独填写正式密钥，拉取镜像并启动。

| 可复用 | 云端仍需单独准备 |
| --- | --- |
| 镜像中的程序和运行时 | 服务器 CPU 架构是否匹配 |
| Compose 中的服务关系 | 正式端口、域名和安全组 |
| 相对路径 `/api` 的前端产物 | 正式 CORS、Cookie、外部回调地址 |
| 经过审核的建表/迁移脚本 | 现有数据库迁移与正式数据 |
| 数据卷的声明 | 卷的真实内容和备份 |

Desktop 中看到了一个运行中的 MySQL，不表示云端也有同样的数据。`docker commit` 或导出某个容器也不是这套流程的替代方案；应从源码和明确的构建配置生成可复现的镜像。

**本节完成后，你应知道接下来分两次运行：**先在电脑上预演，再在云服务器运行。两边可以用相同程序镜像，但 `.env`、域名、密码和数据卷分别管理。第 3～7 节先准备文件，第 8 节才真正启动本地容器。

## 3. 部署前填写项目运行信息表

**这一步做什么、为什么做：**先把项目真实运行条件查清楚，给后面的模板提供准确参数。

**在哪里做：**本地项目根目录。 **完成标志：**填好信息表，确认健康接口、数据库脚本和程序入口。

先在自己的电脑取得项目源码（已有源码就直接打开），再打开 PowerShell/终端并进入包含 README、前端与后端目录的**项目根目录**。下面路径仅是示例，要换成自己的源码路径；目录不对，后面的 COPY、构建上下文和上传都会找不到文件。

**本地 Windows：**

```powershell
# 进入你电脑上的项目源码根目录，路径中有空格时也需要保留引号。
Set-Location 'D:/projects/my-fullstack'
# 列出当前目录内容，确认能看到 README 以及真实前后端目录。
Get-ChildItem
```

Mac 在终端用 `cd /你的项目绝对路径` 进入根目录，用 `ls` 确认目录内容。本文不要求先在本机安装 Node 才能进行 Docker 构建，镜像内会安装构建所需的 Node 与依赖。

**开始前准备：**已经取得项目源码、能打开编辑器，并知道前后端分别在哪个目录。通用教程无法替任意项目编造启动入口或建表脚本；如果下面某一项不确定，先在代码或 README 中查到，再继续写 Dockerfile。

先读取自己的 README、package.json、运行配置和数据库脚本，再修改下面模板。**命令名称相同，不代表启动入口和环境变量一定相同。**

| 项目 | 本文示例假设 | 你要核对什么 |
| --- | --- | --- |
| 前端目录 | `web/` | 源码所在目录 |
| 前端构建 | `npm ci`、`npm run build` | 包管理器、锁文件和实际 scripts |
| 前端产物 | `web/dist/`，静态 SPA | SSR 项目不可照搬静态容器 |
| 前端接口变量 | `VITE_API_BASE_URL=/api` | 源码是否实际读取这个变量 |
| 后端目录 | `server/` | 真实目录 |
| Node 版本 | Node.js 24.22.1（LTS） | engines、原生依赖、项目验证版本 |
| 后端构建 | `npm run build` | 是否需要编译 |
| 正式入口 | `dist/main.js` | TypeScript 输出可能是其他路径 |
| 监听 | `0.0.0.0:3000` | 监听 localhost 会阻止其他容器访问 |
| 路由前缀 | `/api` | 代理是否需要保留该前缀 |
| 健康接口 | `GET /api/health` → 200 | 必须实际存在且不需要登录 |
| 配置读取 | 读取进程环境 | 有的应用必须显式加载文件或配置对象 |
| 数据库变量 | `DB_HOST` 等 | 实际名称可能是 `DATABASE_URL` 等 |
| 数据库初始化 | 审核后的 SQL | 建库、建表、迁移分别怎么完成 |
| 持久文件 | 数据库；如有上传则另加卷 | 不能放在会被重建的容器可写层 |
| 外部依赖 | 按项目添加 SMTP、Redis 等 | 凭据、网络及持久化方式 |
| 登录 | 按项目选择 Cookie/JWT | HTTPS、Path、SameSite、来源、代理信任 |

**本地 PowerShell 查看示例：**

```powershell
# 查看前端的依赖、构建命令与 Node 版本要求。
Get-Content web/package.json
# 查看后端的构建、启动命令与依赖；目录要替换成实际路径。
Get-Content server/package.json
```

本文的 `/api/health` 是教学前提，不是 Node/Nest/Express 自动提供的接口。没有时先实现合适的健康检查，或把模板改为真实存在、预期状态明确的接口；不能机械要求所有项目返回 200。

同样要确认：项目在生产模式下会使用**已有表结构**，不会靠自动同步随意改表。若启动需要 SMTP、Redis、文件存储等，记录真实变量名；第 6 节需要同时在 Compose 的 `environment` 与环境模板里补齐它们。

**本节完成标志：**你已经能填写表格右列；健康检查指向真实接口，SQL 或 migration 的来源明确。缺少这些输入时先补齐，不把后面的教学占位符当成真实项目配置。

后文使用的域名 `app.example.com`、IP `203.0.113.10`、镜像用户 `yourname` 都是示例，必须替换。

## 4. 本地安装 Docker Desktop 并核对平台

**这一步做什么、为什么做：**准备本地构建和预演工具，并确定要给哪种 CPU 架构生成镜像。

**在哪里做：**Docker Desktop 在本地安装；架构命令在服务器执行。 **完成标志：**Docker Client/Server 可连接、系统为 Linux，并记录目标架构。

### 4.1 Windows

按 [Windows 官方安装说明](https://docs.docker.com/desktop/setup/install/windows-install/)核对系统版本、硬件虚拟化和 WSL 2。需要安装 WSL 时，在管理员 PowerShell 执行 `wsl --install`，按提示重启，再安装并启动 Docker Desktop，选择 Linux containers。

下面先检查工具，不会构建或上传应用。`version` 查询版本与连接情况，`info` 查询引擎信息，`--format '{{.OSType}}'` 只显示其中的操作系统字段。`buildx` 是 Docker 的构建工具插件，主线用 `docker build` 构建，后面也用它的只读查询命令核对仓库镜像。

**本地 PowerShell：**

```powershell
# 检查 Windows 的 WSL 状态，确认本地 Linux 容器的基础环境可用。
wsl --status
# 查看 Docker 客户端与引擎版本；缺少 Server 通常表示引擎未启动或无权限。
docker version
# 检查 Compose 插件是否已安装，后续用它管理多容器。
docker compose version
# 检查 buildx 是否可用，后续用它按服务器架构构建镜像。
docker buildx version
# 显示当前 Docker 引擎的操作系统；本教程需要输出 linux。
docker info --format '{{.OSType}}'
```

### 4.2 Mac

按 [Mac 官方安装说明](https://docs.docker.com/desktop/setup/install/mac-install/)选择 Apple Silicon 或 Intel 版本，安装并启动。终端运行相同的 `docker` 检查命令。

应看到可用的 Client 和 Server，操作系统是 `linux`。Server 连不上时，先处理 Desktop 启动问题。

### 4.3 确认云服务器 CPU 架构

先在云控制台选择或查看服务器的 CPU 架构：常见 Intel/AMD 实例是 amd64，Arm 实例是 arm64。还没创建服务器时，先确定计划购买的架构；不要直接把自己电脑的架构当作云端架构。第 10 节配置好 SSH 后，再在**服务器**执行下面命令复核；第 9 节构建前必须已确定目标架构。

```bash
# 查看云服务器 CPU 架构，决定镜像用 linux/amd64 还是 linux/arm64。
uname -m
```

`x86_64` 对应 `linux/amd64`，`aarch64` 对应 `linux/arm64`。Apple Silicon 本地可能是 arm64，而云端是 amd64；第 9 节会显式指定构建平台。[Docker 多平台构建](https://docs.docker.com/build/building/multi-platform/)

## 5. 写好镜像制作说明：API 和 Web 各一份 Dockerfile

**这一步做什么、为什么做：**先写好“镜像怎样制作”的文件，并给前端准备静态托管和 API 代理规则；真正构建镜像在第 8、9 节执行。

**在哪里做：**本地项目目录，创建本节注明的文件。 **完成标志：**两个 Dockerfile、两份忽略规则、Nginx HTTP/HTTPS 配置均已按真实项目适配。

**开始前准备：**第 3 节已确认实际目录、Node 版本、构建命令和入口。接下来每段标有文件名的代码都要保存为文件内容，不能粘进 PowerShell 或 Bash 当命令执行。

在编辑器中创建文件时，显示完整扩展名：文件应叫 `Dockerfile`，不能是 `Dockerfile.txt`；`.dockerignore` 的文件名以一个点开头。所有配置保存为 UTF-8，脚本使用 LF 换行。

下面是**目录树示意，不是终端命令**。先在项目根目录创建 `deploy/mysql-init/` 文件夹，再按每小节创建对应文件：

```text
my-fullstack/
├── web/
│   ├── Dockerfile
│   ├── .dockerignore
│   └── nginx.conf             # 本地和首次上线使用的纯 HTTP 配置
├── server/
│   ├── Dockerfile
│   └── .dockerignore
├── deploy/
│   ├── mysql-init/
│   │   └── 01-schema.sql     # 你的真实建表脚本
│   └── nginx/
│       └── https.conf        # 申请证书后才启用的 Nginx HTTPS 配置
├── compose.yaml
├── compose.build.yaml
├── compose.https.yaml        # 服务器拿到证书后复制为 compose.override.yaml
├── .env.example             # 可以提交的无密钥模板
└── .env.local               # 本地私有文件
```

**先创建两个部署文件夹。Windows PowerShell，在项目根目录执行：**

```powershell
# 创建初始化 SQL 与正式 Nginx 配置所在目录，已有目录会继续使用。
New-Item -ItemType Directory -Force deploy/mysql-init,deploy/nginx
```

**Mac 终端执行对应命令，二选一即可：**

```bash
# 创建同样的两个目录；-p 允许父目录不存在或目标目录已存在。
mkdir -p deploy/mysql-init deploy/nginx
```

目录创建后再新建下面各文件。文件树中的 `.env.local` 到第 8 节才复制生成，不需要现在手工填两份配置。

### 5.1 Node.js API Dockerfile

Dockerfile 中的单词是 **Dockerfile 指令**，由 `docker build` 读取。先认识会用到的指令：

| 指令 | 本文中的作用 |
| --- | --- |
| `FROM` | 选择已经装好 Node 或 Nginx 的基础镜像，第一次构建时 Docker 会按需下载它 |
| `WORKDIR /app` | 后续镜像内操作以 `/app` 为当前目录，和你电脑上的路径没有直接关系 |
| `COPY 源 目标` | 将构建目录中的文件复制到镜像，不会复制整台电脑 |
| `RUN` | 在制作镜像时执行，例如安装依赖和编译；其中 `&&` 表示前一步成功才执行后一步 |
| `ENV` | 设置镜像中的环境变量；正式密码通过 Compose 传入，不写在这里 |
| `USER` | 指定启动程序使用哪个镜像内用户 |
| `EXPOSE` | 说明程序在容器内部使用的端口，公网映射由 Compose 另配 |
| `CMD` | 指定容器启动时运行的程序；它与构建阶段的 `RUN` 时间不同 |

下面有两个 `FROM`，叫**多阶段构建**：第一阶段叫 `build`，负责安装编译工具并生成 `dist`；第二阶段从干净镜像开始，只拿运行需要的文件。`COPY --from=build` 就是从第一阶段复制产物，`--chown=node:node` 设置文件归属。这样编译工具不必留在运行镜像里。

本例后端在 `server/`，构建时会把这个目录作为**构建上下文**，所以 `COPY package.json ...` 指的是 `server/package.json`。如果实际目录或构建产物不同，先修改 Dockerfile 中的路径。

**本地新建 `server/Dockerfile`：**

```dockerfile
# 使用固定 Node 24.22.1 的 Debian 精简镜像，开始构建阶段，安装依赖并编译源码。
FROM node:24.22.1-bookworm-slim AS build
# 将当前镜像中后续命令的工作目录设为 /app。
WORKDIR /app
# 安装原生 Node 依赖编译所需的 Python、make 和 C++ 工具，再清理软件源缓存。
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
# 先复制 npm 清单和锁文件，便于依赖未变化时复用构建缓存。
COPY package.json package-lock.json ./
# 严格按锁文件安装依赖，包含构建时需要的开发依赖。
RUN npm ci --include=dev
# 把未被 .dockerignore 排除的当前构建目录内容复制到镜像工作目录。
COPY . .
# 编译后端，再移除运行时不需要的开发依赖。
RUN npm run build && npm prune --omit=dev

# 使用固定 Node 24.22.1 的 Debian 精简镜像，开始正式运行阶段，和构建阶段保持相同 Node 版本。
FROM node:24.22.1-bookworm-slim AS runtime
# 安装 HTTPS CA 证书和时区数据，再清理软件源缓存以缩小镜像。
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tzdata && rm -rf /var/lib/apt/lists/*
# 将运行模式设为 production，并将容器时区统一为 UTC。
ENV NODE_ENV=production TZ=Etc/UTC
# 将当前镜像中后续命令的工作目录设为 /app。
WORKDIR /app
# 从构建阶段复制包信息，并将文件归属设为普通 node 用户。
COPY --from=build --chown=node:node /app/package*.json ./
# 仅复制构建阶段保留的正式运行依赖，并设置普通用户归属。
COPY --from=build --chown=node:node /app/node_modules ./node_modules
# 复制后端编译结果；实际输出目录不同时需要修改。
COPY --from=build --chown=node:node /app/dist ./dist
# 切换到镜像内的普通 node 用户运行应用。
USER node
# 声明 API 在容器内部使用 3000 端口；这不会对公网开放端口。
EXPOSE 3000
# 容器启动时直接运行后端正式入口；按真实编译入口调整。
CMD ["node", "dist/main.js"]
```

需要适配的地方：

- Node 版本遵循自己的项目。`24.22.1-bookworm-slim` 在本教程用于演示固定版本，构建/运行阶段保持一致；它不是“当前最新版本”的承诺。正式发布应选经过兼容和安全验证的版本，必要时记录并固定 digest，按计划升级。
- 若项目有运行时模板、Prisma 生成物、静态资源、迁移文件等，按需要额外 COPY；不能假定只有 dist 和 node_modules 就足够。
- 若是 monorepo/workspace，锁文件和公共包通常在仓库根目录，需要调整构建上下文和 COPY 路径。
- 若是纯 JavaScript API，没有 build 脚本，改为复制真实入口和必要源码，不能照搬 `npm run build`。
- 项目用 pnpm/yarn 时使用对应锁文件与安装方式，不能强行改用 npm。

运行阶段用普通 `node` 用户，直接启动正式入口；不需要在容器里再套一层 PM2。后端必须接受来自其他容器的连接，不能仅绑定 `127.0.0.1`。

### 5.2 静态 SPA 前端 Dockerfile

**本地新建 `web/Dockerfile`：**

```dockerfile
# 使用固定 Node 24.22.1 的 Debian 精简镜像，开始构建阶段，安装依赖并编译源码。
FROM node:24.22.1-bookworm-slim AS build
# 将当前镜像中后续命令的工作目录设为 /app。
WORKDIR /app
# 先复制 npm 清单和锁文件，便于依赖未变化时复用构建缓存。
COPY package.json package-lock.json ./
# 严格按锁文件安装依赖，包含构建时需要的开发依赖。
RUN npm ci --include=dev
# 把未被 .dockerignore 排除的当前构建目录内容复制到镜像工作目录。
COPY . .
# 在前端构建时将 API 地址设为同源 /api，源码必须实际读取此变量。
ENV VITE_API_BASE_URL=/api
# 执行前端构建脚本，按本例生成 /app/dist 静态产物。
RUN npm run build

# 使用 Nginx 稳定版精简镜像托管静态文件并反向代理 API。
FROM nginx:stable-alpine
# 将纯 HTTP 配置复制到 Nginx 默认站点位置，保证无证书时也能首次启动。
COPY nginx.conf /etc/nginx/conf.d/default.conf
# 只将前端构建产物复制到 Nginx 的静态站点目录。
COPY --from=build /app/dist /usr/share/nginx/html
```

此处假定源码使用 `import.meta.env.VITE_API_BASE_URL`。React 或其他构建器的变量名可能不同，必须修改。Vite 静态变量在构建时写入 JS，运行容器时设置同名变量不会重写浏览器代码。`nginx:stable-alpine` 是可更新标签；正式发布记录已验证镜像的 digest，并按计划升级。

使用相对 `/api` 后，同一 Web 镜像可用于本地与正式域名。数据库密码、JWT 密钥和 SMTP 凭据绝不能放进前端构建变量。

### 5.3 两个目录分别创建 `.dockerignore`

在 `web/.dockerignore`、`server/.dockerignore` 写入：

```dockerignore
# 排除本机依赖目录，避免将 Windows/macOS 依赖打进 Linux 构建上下文。
node_modules
# 排除已有构建产物，让容器按源码重新构建。
dist
# 排除测试覆盖率报告，缩小构建上下文。
coverage
# 排除 Git 历史与元数据，避免传入镜像构建。
.git
# 排除默认环境文件，避免把本地或生产密钥提交或打包。
.env
# 排除所有带环境后缀的配置文件，保护本地与生产密钥。
.env.*
# 排除运行日志，减少上下文并避免带入敏感内容。
*.log
# 排除 TypeScript 本机构建缓存，避免旧缓存影响容器构建。
*.tsbuildinfo
```

不要把 Windows/macOS 安装的 node_modules 复制进 Linux 镜像；容器构建时按锁文件安装。`.dockerignore` 管构建上下文，`.gitignore` 管 Git 提交，两者都需要。

在仓库 `.gitignore` 至少增加：

```gitignore
# 排除默认环境文件，避免把本地或生产密钥提交或打包。
.env
# 排除所有带环境后缀的配置文件，保护本地与生产密钥。
.env.*
# 允许提交不含真实密钥的环境变量模板。
!.env.example
```

### 5.4 用 Nginx 提供页面和 API 代理

Nginx 负责接收浏览器请求：页面和静态资源直接返回；`/api` 请求转给 API 容器。Certbot 负责向证书机构申请和续期证书，Nginx 读取证书后提供 HTTPS。**第一次先用 HTTP 启动，申请成功后才加载 HTTPS 配置**，否则 Nginx 会因证书文件不存在而启动失败。

先看配置对应的行为：Nginx 收到 `/.well-known/acme-challenge/` 时读取证书验证文件；收到 `/api` 或 `/api/...` 时转发后端；其他路径返回前端静态页面。找不到真实页面文件时返回 `index.html`，由前端路由决定显示哪个页面。

`listen` 设监听端口，`root` 设文件目录，`location` 选择路径，`proxy_pass` 转发请求。`$uri`、`$host`、`$scheme` 是 Nginx 自己的变量，要原样保留。`resolver 127.0.0.11` 使用 Docker 提供的内部域名解析，便于 API 容器重建换 IP 后继续转发。

**本地新建 `web/nginx.conf`，供本地预演和服务器首次 HTTP 启动使用：**

```nginx
# 定义一个 HTTP 站点，配置会被官方镜像的主配置加载。
server {
    # 监听容器内部的 HTTP 80 端口。
    listen 80;
    # 接受当前入口收到的主机名，便于同一镜像用于 localhost 和正式域名。
    server_name _;
    # 指定前端构建产物所在目录。
    root /usr/share/nginx/html;
    # 将 index.html 作为目录默认首页。
    index index.html;
    # 为证书机构验证域名保留路径，优先于其他正则路由处理。
    location ^~ /.well-known/acme-challenge/ {
        # 从与 Certbot 共享的验证目录读取文件。
        root /var/www/certbot;
    # 结束证书验证路径配置。
    }
    # 匹配 /api 本身及其子路径，避免进入 SPA 页面兜底。
    location ~ ^/api(?:/|$) {
        # 使用 Docker 内置 DNS，缓存 10 秒后重新解析 API 容器地址。
        resolver 127.0.0.11 valid=10s ipv6=off;
        # 将 API 上游地址存为变量，以便 API 容器重建后重新解析服务名。
        set $api_upstream http://api:3000;
        # 将原始请求 URI 交给 API，保留 /api 前缀和查询参数。
        proxy_pass $api_upstream;
        # 使用 HTTP 1.1 与 API 通信。
        proxy_http_version 1.1;
        # 将浏览器访问的主机名传给 API。
        proxy_set_header Host $host;
        # 将与 Nginx 直接连接的客户端 IP 传给 API。
        proxy_set_header X-Real-IP $remote_addr;
        # 追加客户端 IP，供后端按可信代理配置读取。
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        # 告诉后端浏览器使用的是 HTTP 还是 HTTPS。
        proxy_set_header X-Forwarded-Proto $scheme;
    # 结束 API 代理配置。
    }
    # 处理页面和静态资源请求。
    location / {
        # 优先返回真实文件或目录，否则返回首页以支持 SPA 子路由刷新。
        try_files $uri $uri/ /index.html;
    # 结束页面路由配置。
    }
# 结束 HTTP 站点配置。
}
```

**先确定前缀：**上例中的 `proxy_pass $api_upstream;` 没有追加 URI，保留 `/api`，适合后端真实路径为 `/api/...` 的项目。不能在这个正则 location 中直接照抄带 `/` 的 `proxy_pass http://api:3000/;`，需要去掉前缀时应重新设计并验证重写规则、Cookie Path、重定向和生成链接。[Nginx proxy_pass 官方说明](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass)

**到这里先核对三件事：**两个 Dockerfile 已保存；两个构建目录都有 `.dockerignore`；`web/nginx.conf` 指向正确的 `api:3000` 并保留本项目需要的 API 前缀。现在还没有运行任何构建命令，所以 Docker Desktop 暂时看不到新镜像是正常的。

### 5.5 提前准备正式 HTTPS 配置，申请证书后再启用

下面的 HTTPS 文件只需要提前写好，暂时不会被加载。证书还没申请时，先运行上一节的 HTTP 配置；第 12 节完成申请后才切换。将文件里出现的域名统一替换成你自己的正式域名，证书路径中的目录名也要一起替换。

**本地新建 `deploy/nginx/https.conf`，把所有 `app.example.com` 替换成你的真实域名：**

```nginx
# 定义 HTTP 入口，用于证书验证及跳转 HTTPS。
server {
    # 监听容器 HTTP 端口。
    listen 80;
    # 指定正式域名，必须与申请证书时使用的域名一致。
    server_name app.example.com;
    # 保留 HTTP 验证入口，使证书续期时无需停止网站。
    location ^~ /.well-known/acme-challenge/ {
        # 从共享验证卷读取证书机构要求的文件。
        root /var/www/certbot;
    # 结束证书验证路径配置。
    }
    # 将其他 HTTP 请求引导到正式 HTTPS 域名。
    location / {
        # 使用明确的正式域名跳转，并保留路径及查询参数。
        return 301 https://app.example.com$request_uri;
    # 结束跳转配置。
    }
# 结束 HTTP 入口配置。
}

# 定义正式 HTTPS 站点，只有证书文件已存在才能启动。
server {
    # 在容器 443 端口启用 TLS。
    listen 443 ssl;
    # 指定与证书一致的正式域名。
    server_name app.example.com;
    # 读取 Certbot 维护的完整证书链。
    ssl_certificate /etc/letsencrypt/live/app.example.com/fullchain.pem;
    # 读取与证书配套的私钥，禁止公开这个文件。
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;
    # 允许现代 TLS 协议版本。
    ssl_protocols TLSv1.2 TLSv1.3;
    # 指定前端静态产物目录。
    root /usr/share/nginx/html;
    # 将 index.html 作为默认首页。
    index index.html;
    # 将 /api 本身及其子路径送到后端，避免落入页面兜底。
    location ~ ^/api(?:/|$) {
        # 使用 Docker DNS 并定期刷新 API 容器地址。
        resolver 127.0.0.11 valid=10s ipv6=off;
        # 设置需要动态解析的 API 服务地址。
        set $api_upstream http://api:3000;
        # 保留完整请求 URI，将请求转给 API。
        proxy_pass $api_upstream;
        # 使用 HTTP 1.1 与 API 通信。
        proxy_http_version 1.1;
        # 传递原始站点主机名。
        proxy_set_header Host $host;
        # 传递与入口直接连接的客户端 IP。
        proxy_set_header X-Real-IP $remote_addr;
        # 追加客户端 IP，由后端按可信代理配置解释。
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        # 告诉后端外部请求使用 HTTPS，支持安全 Cookie 和回调地址判断。
        proxy_set_header X-Forwarded-Proto $scheme;
    # 结束 API 代理配置。
    }
    # 为其余请求提供页面与静态资源。
    location / {
        # 返回真实文件或目录，没有时返回 SPA 首页。
        try_files $uri $uri/ /index.html;
    # 结束页面路由配置。
    }
# 结束 HTTPS 站点配置。
}
```

这两份 Nginx 配置直接使用 Nginx 的 `$uri`、`$host` 等变量，不需要环境变量替换。域名只在正式 HTTPS 配置和第 12 节的证书命令中填写；修改 `.env` 中的前端来源不会自动改写证书或站点域名。[Nginx HTTPS 配置说明](https://nginx.org/en/docs/http/configuring_https_servers.html)

## 6. Compose：定义服务、配置、网络和数据

**这一步做什么、为什么做：**写出各容器如何启动、如何互相连接、变量从哪里来、数据保存在哪里。

**在哪里做：**本地项目根目录。 **完成标志：**创建 compose.yaml、compose.build.yaml、compose.https.yaml 和无真实密钥的 .env.example。

**开始前准备：**第 5 节文件已保存，实际 API 变量与健康接口已确认。本节只写运行清单，暂不执行 `up`。

### 6.0 先读懂这份文件会出现的写法

Compose 使用 YAML。缩进表示层级，使用空格而不是 Tab；以 `-` 开头的是列表项。下面的 `db`、`api`、`web` 是服务名，Compose 会在需要运行时为它们创建容器。

| 写法 | 先理解它表示什么 |
| --- | --- |
| `image` | 选择运行哪个镜像；写在这里不会立刻下载或启动 |
| `environment` | 传进容器的变量，程序通过进程环境读取 |
| `${DB_PASSWORD:?提示}` | 从环境文件取值；未填写或为空时让 Compose 报错 |
| `${MYSQL_IMAGE:-mysql:8.4}` | 有配置就用配置值，否则使用冒号后面的默认值 |
| `$${MYSQL_PASSWORD}` | 用两个美元符号告诉 Compose 先不要替换，将变量留给容器里的 shell 读取 |
| `ports` | `宿主机地址:宿主机端口:容器端口`；如 `127.0.0.1:8080:80` 表示本机 8080 转到 Nginx 的 80 |
| `volumes` | 把数据卷或主机文件挂进容器；路径末尾 `:ro` 表示容器只能读 |
| `db_data:/var/lib/mysql` | 用命名卷保存数据库文件；`db_data` 是卷名，不是镜像名 |
| `./deploy/mysql-init:/docker-entrypoint-initdb.d:ro` | 把当前项目的 SQL 目录只读提供给官方 MySQL 的首次初始化机制 |
| `healthcheck` | 定期执行检查，判断程序是否已准备好；与仅仅进程存在不同 |
| `depends_on` | 按检查结果等数据库、API 就绪后再启动下游服务 |
| `restart: unless-stopped` | 进程退出或主机重启后恢复；你主动停止的容器不会自行恢复 |
| `profiles: [tools]` | 把 Certbot 放在按需工具组，普通启动不会让它常驻 |

根目录 `.env` / `.env.local` 先给 Compose 提供变量值；只有 `environment` 明确列出的值才进入某个容器。不要因为根目录填了一个变量，就以为 API 已经能读到。先保存以下 YAML，配置值在第 6.6 节准备，第 8 节才检查和运行。

### 6.1 运行文件 `compose.yaml`

```yaml
# 声明由 Compose 管理的各个服务。
services:
  # 定义数据库服务，其他容器用服务名 db 访问它。
  db:
    # 指定运行镜像；${...} 由环境文件插值，:? 表示缺少值时拒绝启动。
    image: ${MYSQL_IMAGE:-mysql:8.4}
    # 设置异常退出或重启后的恢复策略；手动 stop 的容器不会靠它自动恢复。
    restart: unless-stopped
    # 将下列变量注入这个容器，应用或镜像启动脚本必须实际读取它们。
    environment:
      # 将该容器时区设为 UTC，与数据库和后端保持一致。
      TZ: Etc/UTC
      # 将独立管理员密码传给 MySQL 首次初始化流程。
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:?请设置管理员密码}
      # 指定首次初始化时自动创建的业务数据库名称。
      MYSQL_DATABASE: my_fullstack
      # 指定首次初始化时创建的业务数据库账号。
      MYSQL_USER: app_user
      # 将业务密码传给 MySQL 首次初始化流程，须与 API 连接密码一致。
      MYSQL_PASSWORD: ${DB_PASSWORD:?请设置业务密码}
    # 向 MySQL 启动进程追加下列服务器配置参数。
    command:
      # 将数据库服务器默认字符集设为 utf8mb4，支持中文和完整 Unicode。
      - --character-set-server=utf8mb4
      # 将数据库服务器默认排序规则设为与本文 schema 约定一致的 Unicode 规则。
      - --collation-server=utf8mb4_unicode_ci
      # 将 MySQL 默认会话时区统一为 UTC。
      - --default-time-zone=+00:00
    # 声明本服务的挂载，或在文件根部声明需持久保存的命名卷。
    volumes:
      # 将 MySQL 数据目录挂载到命名卷，避免重建容器丢失业务数据。
      - db_data:/var/lib/mysql
      # 将已审核的 SQL 目录只读挂载到首次初始化入口；仅空数据目录会执行。
      - ./deploy/mysql-init:/docker-entrypoint-initdb.d:ro
    # 定义如何判断容器里的服务已经能接受预期请求。
    healthcheck:
      # 指定健康检查执行方式及命令；失败会将服务标为 unhealthy。
      test:
        # 使用容器内 shell 执行下一行数据库健康检查，允许展开容器环境变量。
        - CMD-SHELL
        # 使用容器内业务账号经 TCP 执行 SELECT 1；$$ 防止 Compose 提前展开密码变量。
        - 'MYSQL_PWD="$${MYSQL_PASSWORD}" mysql --protocol=TCP -h 127.0.0.1 -u"$${MYSQL_USER}" "$${MYSQL_DATABASE}" -e "SELECT 1" >/dev/null 2>&1'
      # 设置健康检查的执行间隔。
      interval: 10s
      # 设置一次健康检查的最长执行时间。
      timeout: 5s
      # 设置连续失败多少次后标记为 unhealthy。
      retries: 18
      # 为首次初始化或应用启动预留宽限期，此期间的失败不计入失败次数。
      start_period: 60s
    # 设置 Docker 容器日志的保存方式。
    logging:
      # 使用 Docker local 日志驱动，在宿主机轮转保存日志。
      driver: local
      # 配置日志驱动的大小及文件数量限制。
      options:
        # 限制单个日志文件大小，降低日志占满磁盘的风险。
        max-size: "10m"
        # 限制轮转保留的日志文件数量。
        max-file: "3"

  # 定义后端服务；作为 depends_on 子项时表示依赖 api。
  api:
    # 指定运行镜像；${...} 由环境文件插值，:? 表示缺少值时拒绝启动。
    image: ${API_IMAGE:?请设置API镜像}:${APP_VERSION:?请设置版本}
    # 设置异常退出或重启后的恢复策略；手动 stop 的容器不会靠它自动恢复。
    restart: unless-stopped
    # 添加轻量 init 进程，协助转发信号并回收子进程。
    init: true
    # 将下列变量注入这个容器，应用或镜像启动脚本必须实际读取它们。
    environment:
      # 让后端按 production 模式启动。
      NODE_ENV: production
      # 将该容器时区设为 UTC，与数据库和后端保持一致。
      TZ: Etc/UTC
      # 指定后端容器内部的监听端口，应用须监听 0.0.0.0。
      PORT: "3000"
      # 告诉 API 通过 Compose 服务名 db 连接数据库，不能写 localhost。
      DB_HOST: db
      # 指定 MySQL 容器内部端口 3306，无需将它发布到公网。
      DB_PORT: "3306"
      # 指定 API 日常读写数据库所用的业务账号。
      DB_USER: app_user
      # 将业务数据库密码传给 API，必须与 MySQL 账号真实密码一致。
      DB_PASSWORD: ${DB_PASSWORD:?请设置业务密码}
      # 指定 API 连接的业务库名，与建表脚本和 MySQL 初始化名称保持一致。
      DB_DATABASE: my_fullstack
      # 将令牌密钥传给 API；如果项目用其他变量名，须按实际源码修改。
      JWT_SECRET: ${JWT_SECRET:?请设置应用密钥}
      # 向 API 注入真实前端来源，供项目的来源校验/CORS 等逻辑使用。
      FRONTEND_ORIGIN: ${FRONTEND_ORIGIN:?请设置前端来源}
      # 设置健康检查访问的 API 路径，真实接口必须无需登录且返回预期状态码。
      HEALTH_PATH: /api/health
    # 声明启动依赖；下方 condition 要求依赖服务先通过健康检查。
    depends_on:
      # 指定当前 API 启动前必须等待的数据库服务 db。
      db:
        # 等待依赖服务 healthy 后才启动当前服务，不能替代真实数据库迁移。
        condition: service_healthy
    # 定义如何判断容器里的服务已经能接受预期请求。
    healthcheck:
      # 指定健康检查执行方式及命令；失败会将服务标为 unhealthy。
      test:
        # 直接执行后续参数组成的命令，不经过 shell。
        - CMD
        # 使用 API 镜像内已有的 Node 运行时发起健康检查。
        - node
        # 让 Node 执行下一项给出的短 JavaScript 程序。
        - -e
        # 请求本容器健康接口；只有 HTTP 200 才返回成功退出码，异常或其他状态都失败。
        - "fetch('http://127.0.0.1:3000'+process.env.HEALTH_PATH).then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"
      # 设置健康检查的执行间隔。
      interval: 30s
      # 设置一次健康检查的最长执行时间。
      timeout: 5s
      # 设置连续失败多少次后标记为 unhealthy。
      retries: 5
      # 为首次初始化或应用启动预留宽限期，此期间的失败不计入失败次数。
      start_period: 40s
    # 设置 Docker 容器日志的保存方式。
    logging:
      # 使用 Docker local 日志驱动，在宿主机轮转保存日志。
      driver: local
      # 配置日志驱动的大小及文件数量限制。
      options:
        # 限制单个日志文件大小，降低日志占满磁盘的风险。
        max-size: "10m"
        # 限制轮转保留的日志文件数量。
        max-file: "3"

  # 定义 Web 入口服务，负责页面、API 代理和 HTTPS。
  web:
    # 指定运行镜像；${...} 由环境文件插值，:? 表示缺少值时拒绝启动。
    image: ${WEB_IMAGE:?请设置Web镜像}:${APP_VERSION:?请设置版本}
    # 设置异常退出或重启后的恢复策略；手动 stop 的容器不会靠它自动恢复。
    restart: unless-stopped
    # 仅为 Web 发布主机端口，让浏览器从容器网络外访问；API/db 不配置此项。
    ports:
      # 把宿主机 HTTP 端口映射到 Web 容器 80；绑定地址与端口取自环境配置。
      - "${BIND_ADDRESS:-127.0.0.1}:${HTTP_PORT:-8080}:80"
      # 把宿主机 HTTPS 端口映射到 Web 容器 443，供正式域名加密访问。
      - "${BIND_ADDRESS:-127.0.0.1}:${HTTPS_PORT:-8443}:443"
    # 声明本服务的挂载，或在文件根部声明需持久保存的命名卷。
    volumes:
      # 只读挂载 Certbot 验证文件，让 Nginx 通过 HTTP 对外提供验证内容。
      - certbot_www:/var/www/certbot:ro
      # 只读挂载证书和私钥，正式 HTTPS 配置从这里读取证书。
      - certbot_conf:/etc/letsencrypt:ro
    # 声明启动依赖；下方 condition 要求依赖服务先通过健康检查。
    depends_on:
      # 指定当前 Web 启动前必须等待的 API 服务。
      api:
        # 等待依赖服务 healthy 后才启动当前服务，不能替代真实数据库迁移。
        condition: service_healthy
    # 设置 Docker 容器日志的保存方式。
    logging:
      # 使用 Docker local 日志驱动，在宿主机轮转保存日志。
      driver: local
      # 配置日志驱动的大小及文件数量限制。
      options:
        # 限制单个日志文件大小，降低日志占满磁盘的风险。
        max-size: "10m"
        # 限制轮转保留的日志文件数量。
        max-file: "3"

  # 定义按需运行的证书工具，不作为常驻网站服务启动。
  certbot:
    # 使用 Certbot 官方镜像；正式使用前验证并记录镜像版本或摘要。
    image: ${CERTBOT_IMAGE:-certbot/certbot:latest}
    # 将证书工具放入可选 profile，普通 up 不会启动它。
    profiles:
      # 只有显式运行证书工具时才启用这组服务。
      - tools
    # 将验证目录和证书存储与 Nginx 共享，Certbot 需要写入权限。
    volumes:
      # 保存证书机构通过 HTTP 读取的验证文件。
      - certbot_www:/var/www/certbot
      # 持久保存账户、证书链、私钥和续期配置。
      - certbot_conf:/etc/letsencrypt

# 声明当前 Compose 项目需要持久保存的命名卷。
volumes:
  # 声明 MySQL 命名卷，保存真实数据库文件，后续重建容器继续复用。
  db_data:
  # 声明证书验证文件卷，供 Nginx 读取、Certbot 写入。
  certbot_www:
  # 声明证书状态卷，保存证书、私钥、账户和续期设置。
  certbot_conf:
```

注意模板假设：API 读取 `DB_*`、`JWT_SECRET`、`FRONTEND_ORIGIN`。如果真实项目用双 Token、SMTP 或其他配置，在 `environment` 中逐项修改/补充；不要认为名字看起来合理就已经被程序读取。

### 6.2 读懂容器网络

| 发出请求的位置 | 正确目标示例 |
| --- | --- |
| 用户浏览器 | `https://app.example.com/api/...` 或同源 `/api/...` |
| web 容器 | `http://api:3000/api/...` |
| api 容器 | 数据库主机 `db`、端口 3306 |
| db 健康检查自身 | `127.0.0.1:3306` |

Compose 为同一应用创建网络，服务名可用于内部解析。`db` 不是公网域名，浏览器不能用它；API 里的 `localhost` 也不是宿主机数据库。

只给 Web 配置 `ports`，3000 和 3306 不发布到宿主机。Dockerfile 中的 `EXPOSE` 是端口说明，不会自动创建公网映射。

### 6.3 理解环境变量的三种位置

先用数据库密码举例：你在 `.env.local` 填 `DB_PASSWORD` → Compose 将 `${DB_PASSWORD}` 替换为该值 → `db.environment.MYSQL_PASSWORD` 和 `api.environment.DB_PASSWORD` 得到同一个值 → MySQL 创建账号、API 使用这个账号连接。这是两个容器能使用同一密码的原因。

前端的 `/api` 则在 Web Dockerfile 的 `ENV VITE_API_BASE_URL=/api` 后执行构建时写入 JS。修改已运行容器的环境变量不会重新编译 JS；改前端构建配置后，需要重新构建 Web 镜像。

| 位置 | 作用 |
| --- | --- |
| Compose 的 `.env` / `--env-file` | 给 YAML 中 `${变量}` 提供插值 |
| 服务的 `environment` / `env_file` | 将变量传进容器，供程序读取 |
| Dockerfile 的构建变量 | 构建镜像时生效；前端静态配置常在这一阶段使用 |

本文采用 `.env` 插值后通过 `environment` 显式注入，没有自动挂载后端环境文件。若应用强制读取某个文件，需按真实加载方式改造或只读挂载，不能把秘密 COPY 进镜像。[Compose 插值文档](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)

`$${MYSQL_PASSWORD}` 中 `$$` 保留给容器内 shell；若只写 `${MYSQL_PASSWORD}`，Compose 会在启动前尝试从自己的环境展开。当前终端的同名环境变量也可能覆盖文件值，排查配置时要一起核对。

### 6.4 本地构建覆盖文件 `compose.build.yaml`

`compose.yaml` 说明“运行哪个镜像”；还没有说明“怎样从源码制作 API/Web 镜像”。这份小文件补充 `build` 信息，供本地预演使用。`context` 是发送给 Docker 的构建目录，`dockerfile` 是该目录内的制作说明文件。

第 8 节用两个 `-f` 参数把运行文件和构建文件按顺序合并；正式服务器只下载镜像，不需要这个构建文件。

```yaml
# 声明由 Compose 管理的各个服务。
services:
  # 定义后端服务；作为 depends_on 子项时表示依赖 api。
  api:
    # 定义本地构建方式，只放在构建覆盖文件中，服务器拉镜像主线无需此项。
    build:
      # 指定 Docker 构建上下文目录，Dockerfile 的 COPY 只能从这个上下文读取文件。
      context: ./server
      # 指定上述构建上下文中的 Dockerfile 文件名。
      dockerfile: Dockerfile
  # 定义 Web 入口服务，负责页面、API 代理和 HTTPS。
  web:
    # 定义本地构建方式，只放在构建覆盖文件中，服务器拉镜像主线无需此项。
    build:
      # 指定 Docker 构建上下文目录，Dockerfile 的 COPY 只能从这个上下文读取文件。
      context: ./web
      # 指定上述构建上下文中的 Dockerfile 文件名。
      dockerfile: Dockerfile
```

### 6.5 HTTPS 覆盖模板 `compose.https.yaml`

它只做一件事：把正式 HTTPS 配置挂到 Nginx 默认站点文件上，替换镜像内的纯 HTTP 配置。它不负责申请证书，所以现在只保存模板。第 12 节会先申请证书，再在服务器复制成自动加载的 `compose.override.yaml`，每一步都会单独执行。

这份文件只把 Web 默认配置切换为已经准备好的 HTTPS 配置。**现在只创建模板，拿到证书前不要启用。**第 12 节在服务器将它复制为 `compose.override.yaml`，以后在部署目录执行不带 `-f` 的 `docker compose` 会自动叠加它。[Compose 多文件合并说明](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/)

```yaml
# 在基础 Compose 的服务配置上叠加 HTTPS 所需挂载。
services:
  # 仅修改已有 Web 服务，其他服务继续使用基础配置。
  web:
    # 添加正式 Nginx 站点配置，不覆盖共享证书卷。
    volumes:
      # 用服务器已有 HTTPS 配置替换镜像内的纯 HTTP 默认站点文件。
      - ./deploy/nginx/https.conf:/etc/nginx/conf.d/default.conf:ro
```

`compose.override.yaml` 只在服务器申请证书成功后生成；本地预演不创建它。本地继续显式使用基础和构建两份文件，避免误加载正式 HTTPS 配置。`compose.https.yaml` 本身不会自动生效。

### 6.6 创建 `.env.example`

**先保存模板，再填私有配置。** 下面的中文是占位文字，`.env.example` 可以提交 Git。第 8 节复制出 `.env.local` 后才填写本地真实值；服务器在第 11 节另外创建 `.env`。两处各自生成密码，不要把本地真实文件上传给所有人。

镜像名称先按模板保存；第 9 节会解释 `yourname/仓库名:版本` 并创建相应仓库。密码字段的随机值在代码块后有生成方法，本节只准备文件，还不启动容器。

```dotenv
# 设置 Compose 项目名，决定容器/网络/卷的命名前缀；本地与正式必须区分，正式后续保持稳定。
COMPOSE_PROJECT_NAME=my-fullstack
# 设置后端镜像仓库名；Compose 会在其后拼接 APP_VERSION 标签。
API_IMAGE=yourname/my-fullstack-api
# 设置前端镜像仓库名；须与实际构建、推送或加载的名称一致。
WEB_IMAGE=yourname/my-fullstack-web
# 指定本次 API/Web 的共同镜像标签；每次发布改成已存在的新标签。
APP_VERSION=20261016-1
# 选择 MySQL 镜像版本，数据库升级需独立验证，不能随业务标签随意变更。
MYSQL_IMAGE=mysql:8.4

# 选择 Certbot 官方镜像；验证后可固定标签或 digest，避免无计划升级。
CERTBOT_IMAGE=certbot/certbot:latest
# 设置完整前端来源（协议加域名和必要端口），供后端来源/CORS 等实际逻辑使用。
FRONTEND_ORIGIN=https://app.example.com
# 设置 Web 发布端口绑定的宿主机地址；本地 127.0.0.1 仅本机，正式 0.0.0.0 接受 IPv4 外部连接。
BIND_ADDRESS=0.0.0.0
# 设置宿主机 HTTP 端口；本地示例用 8080，正式用 80。
HTTP_PORT=80
# 设置宿主机 HTTPS 端口；正式用 443，本地 HTTP 测试不会使用此端口。
HTTPS_PORT=443

# 首次初始化数据库的管理员密码，使用独立随机值，不传给日常 API。
MYSQL_ROOT_PASSWORD=替换为独立随机管理员密码
# 首次初始化业务数据库账号的密码，须与 API 使用的 DB_PASSWORD 保持一致。
DB_PASSWORD=替换为独立随机业务密码
# 设置签发/验证应用令牌的随机密钥，须确认项目实际读取此变量。
JWT_SECRET=替换为独立随机应用密钥
```

各密码/密钥使用不同随机值，正式和本地配置也分开。在 Ubuntu/macOS 使用 `openssl rand -hex 32`；有 Python 的 Windows 可执行：

```powershell
# 生成 32 字节随机值并输出十六进制文本；每个密钥分别执行一次。
python -c "import secrets; print(secrets.token_hex(32))"
```

所有中文占位符都须替换。值含 `$` 可用单引号保留字面值，含 `#` 或空格需按环境文件规则处理；十六进制随机密码比较容易避免转义问题。

## 7. 数据库：初始化、迁移和持久化是三件事



**这一步做什么、为什么做：**为数据库准备真实表结构，并区分首次建表、后续升级与持久化。

**在哪里做：**先在本地准备 SQL 或迁移文件；在首次启动时由数据库执行。 **完成标志：**选定一种建表路线，确认需要的表、权限和基础数据，避免只启动一个空库。

### 7.1 首次部署：准备真实建表 SQL

**开始前准备：**第 3 节已经找到项目真正使用的建表脚本。本教程主线使用 SQL 初始化；如果你选择 ORM migration，先按第 7.3 节调整配置，后续每次看到“SQL 路线”时采用同一选择，不能中途混用。

MySQL 镜像只提供数据库程序，不知道你的业务有几张表。因此先把自己项目的 SQL 保存为 `deploy/mysql-init/01-schema.sql`。这一段是文件准备，还不需要手工运行 MySQL。

按文件名排序，`01-schema.sql` 先建表，选用的 `02-app-grants.sql` 再限制账号权限。**SQL 只初始化空的数据卷。** 本地预演和服务器各有自己的卷，分别会在第一次启动时执行一次；以后改 SQL 不会自动修改旧库。

将自己项目已经审核的建表脚本放到 `deploy/mysql-init/01-schema.sql`。本文的数据库叫 `my_fullstack`，脚本里的库名要一致。只导入必要基础数据，不导入演示账号或假业务数据。

MySQL 官方镜像会创建 `MYSQL_DATABASE`、`MYSQL_USER`，然后按文件名顺序执行 `/docker-entrypoint-initdb.d` 中的初始化脚本；**只有数据目录为空时执行**。数据库已存在后，修改 SQL 或重新创建容器不会再自动执行这些脚本。[MySQL 官方镜像文档](https://hub.docker.com/_/mysql/)

只创建库不等于创建表。`SELECT 1` 健康检查通过，只证明账号和连接可用；下一步还要核对实际业务表和迁移版本。

### 7.2 运行时账号与迁移账号

官方 `MYSQL_USER` 默认获得目标库的广泛权限。若 API 运行时只需业务读写，可新增 `deploy/mysql-init/02-app-grants.sql`：

```sql
-- 撤销业务账号在目标库上的原有权限，为重新授予最少权限做准备。
REVOKE ALL PRIVILEGES ON my_fullstack.* FROM 'app_user'@'%';
-- 仅允许业务账号读取、插入、更新与删除数据；不授予建表或修改结构权限。
GRANT SELECT, INSERT, UPDATE, DELETE ON my_fullstack.* TO 'app_user'@'%';
```

只在确认应用不需要其他权限时使用。建表、ALTER 和迁移改由管理员或专用迁移账号执行，不能将管理员密码传给日常 API。

### 7.3 如果项目使用 ORM migration

不要同时保留两套互相冲突的建表方式。可以移除初始化目录挂载，启动 db 后，用受控的迁移任务执行项目已有的迁移命令，再启动 API；迁移文件、工具和管理员凭据要给该任务单独准备。不要编造 `migration:run`，也不要启用生产自动同步替代版本迁移。

Compose 的 `depends_on: service_healthy` 可以等待依赖健康，但不会替你执行任意框架迁移。上线前记录迁移版本；后续镜像回退也不会自动撤销它。[Compose 启动顺序说明](https://docs.docker.com/compose/how-tos/startup-order/)

### 7.4 数据版本选择

本文新部署选 MySQL 8.4 LTS；旧项目依赖不同版本时先做兼容性验证。MySQL 8.0 已在 2026 年 4 月结束生命周期，不应继续照搬旧教程作为新部署默认版本。旧库升级先备份和演练，不能仅把镜像标签改大版本后直接挂旧数据目录。[MySQL 8.0 官方发布说明](https://dev.mysql.com/doc/relnotes/mysql/8.0/en/)

## 8. 本地预演：先在自己的电脑一步步启动

**这一步做什么、为什么做：**先在本机确认镜像能构建、数据库能建表、后端能连库、Nginx 能返回页面和代理 API。

**在哪里做：**本地电脑的项目根目录，Docker Desktop 已启动。 **完成标志：**本地页面和接口符合预期，核心读写正常，然后停止本地容器并保留测试数据。

**开始前准备：**第 5～7 节文件齐全，项目变量已适配，根目录没有生产专用 `compose.override.yaml`。本地与服务器是两套环境，本节不会发布网站，也不会上传镜像。

### 8.1 从模板复制本地私有配置

**Windows PowerShell：**

```powershell
# 首次预演时复制公开模板，生成只给自己电脑使用的环境文件；已有文件时先保留原内容。
Copy-Item .env.example .env.local
```

**Mac 终端使用对应命令，二选一执行：**

```bash
# 复制模板作为本地私有配置；已有 .env.local 时不要直接覆盖。
cp .env.example .env.local
```

用编辑器打开 `.env.local`，按第 6.6 节生成并填写本地数据库密码、JWT 及项目需要的其他密钥。再把以下字段改成本地值，**保留文件中的其他密码字段**：

```dotenv
# 本地项目独立命名，避免与服务器项目混淆。
COMPOSE_PROJECT_NAME=my-fullstack-local
# 本机准备制作的 API 镜像短名称，此时不需要镜像仓库账号。
API_IMAGE=my-fullstack-api
# 本机准备制作的 Web 镜像短名称。
WEB_IMAGE=my-fullstack-web
# 本地测试镜像的版本标签，和第 9 节的正式版本分开。
APP_VERSION=local
# 让 API 认可本地网页来源，协议和端口都要与浏览器一致。
FRONTEND_ORIGIN=http://localhost:8080
# 只允许自己的电脑连接这套测试入口。
BIND_ADDRESS=127.0.0.1
# 本地用 8080 接收 HTTP 请求，转给 Nginx 容器的 80。
HTTP_PORT=8080
# 本地暂不启用 HTTPS，这个端口映射先保留，不代表 Nginx 已监听 443。
HTTPS_PORT=8443
```

**预期结果：**占位密码都已替换，本地项目名和端口如上。不要提交 `.env.local`。如果应用还需要 SMTP 等配置，也要在实际模板和 `environment` 中补齐；仅填这几行不会凭空提供项目未配置的依赖。

### 8.2 先检查配置，不急着启动

后面的本地命令会重复一段前缀，先理解它：

| 参数 / 子命令 | 含义 |
| --- | --- |
| `--env-file .env.local` | 明确读取本地变量，避免错读正式 `.env` |
| `-f compose.yaml -f compose.build.yaml` | 依次合并运行定义和本地构建定义 |
| `config --quiet` | 检查合并结果和必填变量，正常时不打印内容，避免把密码展开到屏幕 |
| `pull db` | 下载配置中 `db` 使用的官方 MySQL 镜像，尚不启动 |
| `build api web` | 根据两个 Dockerfile 在本机制作应用镜像，尚不上传 |
| `up -d` | 创建并在后台启动容器，终端不会一直停在应用日志界面 |
| `--wait --wait-timeout 300` | 等待有健康检查的服务健康，最多等 300 秒 |
| `ps` / `logs --tail=100` | 分别查看状态与最近 100 行日志 |

**本地项目根目录，Windows PowerShell 和 Mac 终端均可执行下面各条 Docker 命令：**

```powershell
# 检查本地变量和两份 Compose 文件，成功时通常没有输出。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml config --quiet
```

**检查通过再继续。** 若提示必填变量为空，回 `.env.local` 填好；若提示 YAML 错误，核对缩进与冒号。此时没有启动数据库，不能靠删卷处理配置错误。

### 8.3 明确下载官方 MySQL，再制作两个应用镜像

```powershell
# 直接下载官方 MySQL 镜像；本项目不用自己编写 MySQL Dockerfile。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml pull db
```

**预期结果：**显示镜像下载完成或镜像已是当前版本。网络错误、认证错误先解决，再构建应用。

```powershell
# 读取 API/Web 的 Dockerfile，分别安装依赖、编译并制作本地镜像。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml build api web
# 列出本地 API 镜像，应能看到 local 标签。
docker image ls my-fullstack-api
# 列出本地 Web 镜像，应能看到 local 标签。
docker image ls my-fullstack-web
```

`FROM node:...`、`FROM nginx:...` 所需的基础镜像由构建过程按需下载，这是 Dockerfile 的 `FROM` 步骤；和应用镜像的 `push` 上传不同。构建成功后有 `my-fullstack-api:local`、`my-fullstack-web:local`，**此时只在自己的电脑上，没有发布到仓库**。

### 8.4 先启动数据库，确认真实业务表已建立

```powershell
# 只启动 db，让官方镜像在本地新数据卷中创建账号并执行初始化 SQL。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml up -d --wait --wait-timeout 300 db
# 查看数据库状态，预期为 running/healthy。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml ps
# 查看数据库初始化日志，确认没有 SQL 或权限错误。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml logs --tail=100 db
```

**预期结果：**数据库健康检查通过，但本模板的检查只证明能连接，所以还要看业务表。`exec` 可以在已运行的容器里执行命令。这里先用 `exec db sh` 进入 db 的 shell，再在容器内查询，避免不同 Windows 终端对复杂引号的传递方式影响检查。

```powershell
# 打开已运行 db 容器中的 shell；下一段查询在这个容器提示符内执行。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml exec db sh
```

**进入后，在 db 容器的 shell 中执行下面两条。** 密码从容器已有环境变量读取，不需要复制出来；查询后用 `exit` 返回本地终端。

```bash
# 用容器中的业务账号和密码查询当前库的表名。
MYSQL_PWD="$MYSQL_PASSWORD" mysql -u"$MYSQL_USER" "$MYSQL_DATABASE" -e 'SHOW TABLES;'
# 退出这个容器 shell，回到电脑上的 PowerShell 或 Mac 终端。
exit
```

**预期结果：**出现自己项目所需的表名。采用 migration 路线时，应先执行真实项目的迁移任务，再查表。空列表或缺表时先查 SQL/迁移，不启动 API 试运气；修改 SQL 后也不能期待已有卷自动重放初始化。

### 8.5 再启动 API 和 Web，确认三项服务就绪

```powershell
# 数据库准备好后启动整套应用，API 等待 db，Web 等待 API。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml up -d --wait --wait-timeout 300
# 查看三个常驻服务；Certbot 工具不需要出现在这里。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml ps
# 检查三个服务最近的日志，避免只看 running 就认定业务可用。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml logs --tail=100 db api web
```

**预期结果：**db、api 为 `healthy`，web 为运行状态。`running` 表示进程在运行，`healthy` 表示配置的检查命令通过；真正登录和读写仍需下一步测试。超时就先看日志，定位第一个失败的服务。

### 8.6 从浏览器经过 Nginx 测试页面与接口

Windows 使用 `curl.exe`，避免某些 PowerShell 将 `curl` 当成别的命令。`-I` 只看响应头，`-i` 同时显示响应头与响应体：

```powershell
# 请求本地首页的响应头，按静态 SPA 模板预期返回 200。
curl.exe -I http://localhost:8080
# 经过 Web 代理请求真实健康接口，按本文前提预期返回 200。
curl.exe -i http://localhost:8080/api/health
```

Mac 对应命令如下，二选一执行：

```bash
# 检查本地首页的响应头。
curl -I http://localhost:8080
# 经过 Nginx 检查后端健康接口。
curl -i http://localhost:8080/api/health
```

打开 `http://localhost:8080`，检查 JS/CSS、直接刷新前端子路由、注册/登录和最基本的业务读写。若项目的生产 Cookie 强制 Secure，本地 HTTP 只能覆盖部分流程，最终还要在云端 HTTPS 验收；先理解限制，不要为通过本地测试关闭生产安全配置。

Docker Desktop 的 Containers 页面应显示这套 Compose 应用中的三个服务，Images 页面能看到两份应用镜像和官方 MySQL 镜像。文件是可重复部署的依据，图形界面主要用于查看状态。

### 8.7 停止本地预演，为正式发布做准备

`down` 停止并删除这套应用的容器和网络，默认保留命名卷。**不要加 `-v`**，它会连数据卷一起删除。

```powershell
# 停止本地测试容器，保留测试数据库卷，后续可用相同配置再次启动。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml down
```

**本节完成：**你已经验证程序能在容器中运行。下一节才把应用制作成正式版本并上传镜像仓库；本地测试卷不会随镜像一起上传。

## 9. 发布应用镜像：构建、命名、登录、推送分别执行

**这一步做什么、为什么做：**把 API/Web 做成一个明确版本，上传到 Docker Hub，让服务器可以下载。

**在哪里做：**自己的电脑、项目根目录。 **完成标志：**本地镜像存在，仓库名称和标签正确，两条 `docker push` 成功，远程仓库能查到同一版本。

**开始前准备：**第 8 节本地预演通过，Docker Desktop 仍在运行，第 4.3 节已确认服务器是 amd64 还是 arm64。以下主线假设服务器 `x86_64`，目标平台就是 `linux/amd64`；若服务器为 `aarch64`，把两条构建命令的平台改成 `linux/arm64`。

### 9.1 先确定发布名称，并在 Docker Hub 创建两个仓库

浏览器打开 [Docker Hub](https://hub.docker.com/)，注册或登录自己的账号。在 Repositories 页面选择创建仓库，分别创建 `my-fullstack-api`、`my-fullstack-web`，按项目需要选择私有或公开。

主线中的 `yourname` 全部替换成**自己的个人 Docker Hub 用户名**，创建仓库、打标签和登录都使用同一账号，不是随意取一个名字。后面使用这组值：

| 用途 | API | Web |
| --- | --- | --- |
| 本地构建名称 | `my-fullstack-api:20261016-1` | `my-fullstack-web:20261016-1` |
| 仓库完整名称 | `yourname/my-fullstack-api:20261016-1` | `yourname/my-fullstack-web:20261016-1` |
| 本次版本标签 | 冒号后的 `20261016-1` | 与 API 使用相同发布标签 |

可以把完整名称拆成“谁的仓库 / 哪个镜像 : 哪个版本”。不写仓库主机时默认使用 Docker Hub。本次选 `20261016-1` 只是演示版本名，后续每次发布换一个新标签，避免覆盖旧版本。

### 9.2 第一步：在本机构建正式版本，此时不上传

第 8 节的 `:local` 镜像用于本机测试，可能是本机 CPU 架构。现在显式按云服务器架构重新构建一个正式标签。先解释下面的参数：

| 命令部分 | 含义 |
| --- | --- |
| `docker build` | 根据 Dockerfile 制作镜像，结果放在本机 Docker 中 |
| `--platform linux/amd64` | 指定服务器运行的平台；64 位不自动等于 amd64，要按实际架构选择 |
| `--file server/Dockerfile` | 指定这次读取哪份 Dockerfile |
| `--tag my-fullstack-api:20261016-1` | 给构建结果一个本地名称和版本；它不会上传镜像 |
| 命令最后的 `server` | 构建上下文，也就是 Dockerfile 中 `COPY` 能读取的本地目录 |

**本地根目录，Windows PowerShell / Mac 终端均可，逐条执行：**

```powershell
# 按服务器目标平台构建后端正式镜像，并在本机保存指定版本。
docker build --platform linux/amd64 --file server/Dockerfile --tag my-fullstack-api:20261016-1 server
# 按同一平台构建前端与 Nginx 镜像，保存在本机，尚未上传。
docker build --platform linux/amd64 --file web/Dockerfile --tag my-fullstack-web:20261016-1 web
```

**预期结果：**两次构建都成功结束，依赖安装和编译没有错误。Apple Silicon 为 amd64 服务器构建时可能使用模拟，速度更慢是可能的；编译失败先解决构建问题，不执行后面的上传。

### 9.3 第二步：查看本地镜像，确认名称、标签与平台

`docker image ls 名称` 会按名称筛选镜像。`docker image inspect` 查看元数据，`--format` 指定只输出操作系统与 CPU 架构。

```powershell
# 确认本地存在 API 的 20261016-1 标签，记住 IMAGE ID。
docker image ls my-fullstack-api
# 确认本地存在 Web 的 20261016-1 标签。
docker image ls my-fullstack-web
# 查看 API 镜像的平台，amd64 服务器预期为 linux/amd64。
docker image inspect --format '{{.Os}}/{{.Architecture}}' my-fullstack-api:20261016-1
# 查看 Web 镜像的平台，必须与同一服务器匹配。
docker image inspect --format '{{.Os}}/{{.Architecture}}' my-fullstack-web:20261016-1
```

**预期结果：**两份镜像的标签和平台都正确。这里只查本机镜像，Docker Hub 此时还没有这个版本。

### 9.4 第三步：给已有镜像增加仓库完整名称

`docker tag 源名称 目标名称` 给同一镜像增加一个标签。它不会再编译一次，也不会复制一份完整镜像，更不会上传。加仓库名称是为了让 `push` 知道该上传到哪个账号下的哪个仓库。

**先把下面的 `yourname` 替换为真实用户名：**

```powershell
# 给已有 API 镜像加上自己 Docker Hub 仓库需要的完整名称。
docker tag my-fullstack-api:20261016-1 yourname/my-fullstack-api:20261016-1
# 给已有 Web 镜像增加对应的仓库完整名称。
docker tag my-fullstack-web:20261016-1 yourname/my-fullstack-web:20261016-1
# 查看 API 仓库名称是否已经出现在本地列表中。
docker image ls yourname/my-fullstack-api
# 查看 Web 仓库名称是否已经出现在本地列表中。
docker image ls yourname/my-fullstack-web
```

**预期结果：**带 `yourname/` 的标签与原本地标签使用同一个 IMAGE ID，这是增加名称，不是重建镜像。

### 9.5 第四步：登录镜像仓库，取得本机推送权限

浏览器里的 Docker Hub 登录和本地命令行登录分别管理。先在 Docker Hub 账号设置中创建允许本次仓库推送的访问令牌（Personal Access Token），再登录命令行。`--username` 后面填写自己的用户名；命令提示 `Password` 时粘贴令牌，输入时通常不显示字符。

```powershell
# 让本机 Docker 以自己的账号登录 Docker Hub，按提示输入访问令牌。
docker login --username yourname
```

**预期结果：**出现 `Login Succeeded`。失败时先核对账号、令牌与仓库权限，不把令牌写进 Dockerfile、`.env.example` 或 Git。

### 9.6 第五步：明确执行两条 push 命令，真正上传镜像

`docker push 镜像完整名称:版本` 才是把本地镜像传到仓库的动作。它不会启动服务器应用。这里分别上传 API 和 Web，不能只成功一份就切换服务器。

```powershell
# 把 API 的这个明确版本上传到自己的 Docker Hub API 仓库。
docker push yourname/my-fullstack-api:20261016-1
# 把 Web 的同一版本上传到自己的 Docker Hub Web 仓库。
docker push yourname/my-fullstack-web:20261016-1
```

**预期结果：**每条命令都上传完成，并显示该标签对应的 `digest: sha256:...`。这是仓库中镜像内容的摘要，可以记录用于精确核对。看到 `unauthorized` 时先查登录与权限；看到镜像名称不存在时回第 9.4 节核对本地仓库标签，不凭空更改服务器配置。

### 9.7 第六步：检查仓库中确实有这两份镜像

先在 Docker Hub 打开两个仓库的 Tags 页面，确认都有 `20261016-1`。再用下面的只读查询检查远程版本和平台。`buildx imagetools inspect` 在这里读取**仓库中的镜像信息**，不执行构建、上传或启动。

```powershell
# 查询远程 API 版本的 digest 与平台，确认刚才上传的是服务器需要的镜像。
docker buildx imagetools inspect yourname/my-fullstack-api:20261016-1
# 查询远程 Web 的相同版本，确认两份镜像都已发布。
docker buildx imagetools inspect yourname/my-fullstack-web:20261016-1
```

**本节完成：**两次 `push` 成功，仓库中两份标签与平台正确。至此叫“镜像已发布”，还不是“网站已上线”。服务器接下来要安装 Docker、上传运行文件、下载镜像并启动容器。MySQL 与 Certbot 使用官方镜像，不需要给它们打自己的仓库标签或执行项目镜像的推送。

第一次只为一类服务器构建单平台镜像即可。多平台发布涉及一份标签包含多个平台的清单，留到第 16 节选读，不在第一次上线中把构建和上传合并成一个动作。

## 10. 准备 Ubuntu：域名、SSH、Engine 和防火墙

**这一步做什么、为什么做：**给容器准备可登录、可运行、能被域名找到的 Ubuntu 环境。

**在哪里做：**云控制台配置 DNS/安全组；本地执行 SSH；其余命令在服务器执行。 **完成标志：**部署用户可登录，Docker/Compose 可用，DNS 与 80/443 入口条件满足。

**开始前准备：**有云服务器控制台权限、域名 DNS 管理权限，以及初始 SSH 登录方式。这里的“云平台操作”在浏览器控制台完成，“本地执行”在电脑终端完成，“服务器执行”在 SSH 连接后的终端完成。不要根据代码块语言猜执行位置。

### 10.1 域名与安全组

创建 Ubuntu 24.04 LTS 64 位 UEFI 版云服务器，在云平台镜像选项中确认版本、系统位数和启动方式，记录公网 IP、登录用户、SSH 端口和私钥位置。在域名 DNS 管理页面为 `app.example.com` 添加 A 记录，记录值填写服务器公网 IPv4（例如域名前缀填写 `app`）；等待公共解析生效。不用 IPv6 时删除错误的 AAAA 记录。本文端口发布使用 IPv4；若同时使用 IPv6，必须另行验证 IPv6 的 Docker 端口绑定和入站规则。

域名的 **A 记录**就是把名字指向 IPv4。若你拥有 `example.com`，要用 `app.example.com`，通常在 DNS 控制台添加主机记录 `app`、类型 `A`、记录值“真实服务器公网 IP”。云安全组相当于云平台外层的入站放行规则，按下面端口配置后才检查解析。

`SSH` 是远程终端连接；`ubuntu@203.0.113.10` 中 `ubuntu` 是服务器用户，`@` 后是服务器 IP。登录成功后，同一个终端里输入的命令就改为在服务器执行。

| 云安全组入站 | 来源 | 用途 |
| --- | --- | --- |
| TCP 22，或真实 SSH 端口 | 自己的管理 IP | SSH |
| TCP 80 | 公网 | HTTP 与证书验证 |
| TCP 443 | 公网 | HTTPS |

不开放数据库 3306、API 3000 或 Docker 2375。出站放行所需 DNS、软件源、镜像仓库、证书服务及外部业务服务。

**本地 Windows：**

```powershell
# 检查示例域名的 IPv4 解析结果，确认已指向真实服务器。
Resolve-DnsName app.example.com -Type A
# 检查是否存在 IPv6 记录；未配置 IPv6 时不应保留错误的 AAAA。
Resolve-DnsName app.example.com -Type AAAA
# 用云平台提供的初始用户 SSH 登录服务器；替换真实用户和 IP。
ssh ubuntu@203.0.113.10
```

A 查询应返回这台服务器的真实 IPv4；没有配置 IPv6 时 AAAA 查询无结果是正常的。Mac 用 `dig +short app.example.com A` 和 `dig +short app.example.com AAAA` 检查 DNS。管理员若是 root 或使用 SSH 私钥，按云平台提供的方式替换登录命令；首次连接核对主机指纹。

### 10.2 准备 SSH 公钥，再创建日常部署用户

这一小节会在**本地窗口**和**服务器管理员窗口**之间切换。先把公钥准备好，再打开服务器公钥文件，避免编辑时才发现没有可粘贴的内容。`deployer` 是我们新建的日常部署账号，`/opt/my-fullstack` 是它管理的部署目录。

#### 10.2.1 本地：找到用于登录的公钥

SSH 密钥是一对文件：**私钥留在电脑，公钥放到服务器**。例如 `id_ed25519` 是私钥，`id_ed25519.pub` 是公钥。已有可用密钥就使用已有文件，不必再生成。

下面按默认 Ed25519 密钥名举例。**Windows PowerShell 查看已有公钥：**

```powershell
# 显示本机公钥，复制完整一行；实际使用其他密钥名时改成对应 .pub 文件。
Get-Content "$HOME/.ssh/id_ed25519.pub"
```

如果确认没有可用密钥，才执行下一条。`-t ed25519` 选择密钥算法，按提示选择保存路径和私钥口令；保存路径如果已有密钥，应选择新路径，不能覆盖仍在用的密钥。

```powershell
# 仅在没有可用 SSH 密钥时生成新密钥对，并按提示记录实际保存路径。
ssh-keygen -t ed25519
# 查看刚生成的公钥，供后面的服务器授权使用。
Get-Content "$HOME/.ssh/id_ed25519.pub"
```

Mac 用终端查看实际 `.pub` 文件即可。**预期结果：**你已复制公钥的一整行文本，并知道与它对应的私钥路径。不是复制私钥内容，也不是上传私钥。

#### 10.2.2 服务器管理员窗口：创建用户和目录

回到第 10.1 节已经登录的 `ubuntu`/`root` 管理员窗口。`sudo` 表示用管理员权限执行；`adduser` 会要求设置 deployer 密码，后续使用 sudo 时会用到它。`-d` 创建目录，`-o/-g` 设置所有者/组，`-m` 设置权限。

```bash
# 刷新软件包索引，为安装编辑器做准备。
sudo apt update
# 安装下面编辑公钥和正式配置时使用的 nano。
sudo apt install -y nano
# 创建 deployer 用户，已存在该用户时跳过这条。
sudo adduser deployer
# 允许 deployer 通过 sudo 管理服务器。
sudo usermod -aG sudo deployer
# 创建正式运行目录并交给 deployer 管理，其他用户不能随意访问。
sudo install -d -o deployer -g deployer -m 750 /opt/my-fullstack
# 创建 SSH 授权目录，700 表示只有所有者能访问。
sudo install -d -o deployer -g deployer -m 700 /home/deployer/.ssh
```

**预期结果：**用户与两个目录准备好，没有权限错误。现在再编辑授权文件。

#### 10.2.3 服务器管理员窗口：粘贴公钥并保存

`nano` 是终端文本编辑器。打开后粘贴第 10.2.1 节复制的公钥，一行一把；已有公钥时追加，不能清空其他人仍在使用的内容。保存按 **Ctrl+O → 回车**，退出按 **Ctrl+X**。

```bash
# 以 deployer 身份打开公钥授权文件，粘贴本机公钥后保存并退出。
sudo -u deployer nano /home/deployer/.ssh/authorized_keys
# 确保授权文件归 deployer 所有。
sudo chown deployer:deployer /home/deployer/.ssh/authorized_keys
# 将文件权限设为 600，只有 deployer 可读取与修改。
sudo chmod 600 /home/deployer/.ssh/authorized_keys
```

#### 10.2.4 本地新窗口：确认 deployer 能登录

保持管理员窗口不要关闭，在电脑**另开一个终端窗口**执行：

```powershell
# 使用已授权的默认 SSH 密钥登录部署用户，IP 要替换为真实服务器公网地址。
ssh deployer@203.0.113.10
```

**预期结果：**出现服务器上 deployer 的提示符。之后大多数操作都在这个 deployer 窗口进行；上传文件时仍切回本地窗口。登录失败先核对用户、公钥、私钥和权限，管理员窗口暂时保留。

如果云平台使用自定义 SSH 端口或你需要指定私钥，参数要贯穿后面的所有连接：`ssh -p` 是端口，`scp -P` 是端口（大小写不同），两者的 `-i` 都是本地私钥路径。

```powershell
# 自定义连接示例：用实际端口与实际私钥登录，2222 只作示例。
ssh -p 2222 -i "$HOME/.ssh/id_ed25519" deployer@203.0.113.10
```

第 11 节上传时会给出匹配的 `scp` 参数示例。本节完成后，至少已在新窗口成功登录 deployer 一次。

### 10.3 安装 Docker Engine 与 Compose 插件

以下针对新装 Ubuntu 24.04 LTS 64 位 UEFI 版，Docker 官方支持该系统版本。若已有 Docker、containerd 或其他容器平台，先按官方文档检查冲突包与运行服务，不要直接卸载。[Docker Ubuntu 官方安装步骤](https://docs.docker.com/engine/install/ubuntu/)

UEFI 表示服务器的启动方式，不改变 Docker、Nginx 或 Certbot 的配置。64 位系统仍可能使用不同 CPU 架构，构建镜像时继续按第 4.3 节的 `uname -m` 结果选择 amd64 或 arm64。

**先在服务器宿主机的 SSH 终端核对实际发行版和启动方式，不在容器内执行，也不能把云平台镜像名称或制作日期当成系统版本：**

```bash
# 查看实际系统版本和代号，确认后再添加 Docker 软件源。
cat /etc/os-release
# 查看系统用户空间位数，预期为 64。
getconf LONG_BIT
# 核验当前服务器启动方式，预期显示 UEFI。
if [ -d /sys/firmware/efi ]; then printf '%s\n' UEFI; else printf '%s\n' '非 UEFI（Legacy BIOS）'; fi
```

本教程预期 `ID=ubuntu`、`VERSION_ID="24.04"`、`VERSION_CODENAME=noble`，系统位数为 `64`，启动方式为 `UEFI`；24.04.x 维护版本仍使用同一代号。[Ubuntu 官方版本列表](https://ubuntu.com/project/docs/release-team/list-of-releases/)

UEFI 检测使用 `/sys/firmware/efi` 是否存在来判断当前系统的启动方式。[Ubuntu UEFI 启动检查说明](https://help.ubuntu.com/community/UEFI)

实际输出不同就先核对 Docker 的支持列表。后面的命令会自动读取代号和架构，不要为绕过错误而硬填其他发行版代号。

接下来按三件事操作：**添加官方软件下载地址 → 用 apt 安装 Docker 与插件 → 启动并验证**。Ubuntu 的 `apt update` 更新“可下载软件清单”，不会部署业务；`apt install` 才安装指定软件。`docker-ce` 是引擎，`docker-ce-cli` 是客户端，`containerd.io` 是运行时，`docker-buildx-plugin` 和 `docker-compose-plugin` 是命令插件。

软件源签名公钥用于验证下载的软件包来自配置的仓库。下面读取 `/etc/os-release` 后生成源文件，再运行第二次 `apt update`，是让 apt 认识新添加的 Docker 仓库。

安装后会用 `docker run --rm hello-world` 检查引擎：`run` 从官方测试镜像创建并运行一个临时容器，`--rm` 在测试结束后删除该临时容器。`systemctl enable --now docker` 表示立即启动并开启开机自启；`usermod -aG docker deployer` 把用户追加进 Docker 管理组，重新登录后才生效。

**服务器：**

```bash
# 刷新 Ubuntu 软件包索引，读取当前已配置软件源中的可用版本。
sudo apt update
# 安装证书、下载、编辑、随机密钥与主机防火墙所需工具。
sudo apt install -y ca-certificates curl nano openssl ufw
# 创建 APT 保存签名密钥的标准目录。
sudo install -m 0755 -d /etc/apt/keyrings
# 从 Docker 官方地址下载软件源签名公钥到 keyrings 目录。
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
# 允许 APT 的受限用户读取 Docker 软件源公钥。
sudo chmod a+r /etc/apt/keyrings/docker.asc

# 自动读取当前 Ubuntu 发行代号；24.04 LTS 为 noble，供官方软件源选择对应发行版。
docker_codename=$(. /etc/os-release && printf '%s' "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
# 读取 Ubuntu 包管理器识别的 CPU 架构，供软件源选择相应安装包。
docker_arch=$(dpkg --print-architecture)
# 按前面检测的系统代号和架构生成官方 APT 源配置，换行符用于写出合法的 deb822 字段。
printf 'Types: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: %s\nComponents: stable\nArchitectures: %s\nSigned-By: /etc/apt/keyrings/docker.asc\n' "$docker_codename" "$docker_arch" | sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null

# 刷新 Ubuntu 软件包索引，读取当前已配置软件源中的可用版本。
sudo apt update
# 安装 Docker 引擎、CLI、容器运行时及 buildx/Compose 插件。
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
# 立即启动 Docker 服务，并设置服务器开机自动启动 Docker。
sudo systemctl enable --now docker
# 运行官方测试镜像验证 Docker 能拉取并运行容器，完成后删除测试容器。
sudo docker run --rm hello-world
# 将部署用户加入 docker 组；退出并重新登录后权限才会生效。
sudo usermod -aG docker deployer
```

docker 组拥有很高的主机控制权限，只给可信的部署账号。退出并重新登录 deployer，使组变更生效；后文不再对每条 Docker 命令加 sudo。[Linux 安装后权限说明](https://docs.docker.com/engine/install/linux-postinstall/)

```bash
# 查看 Docker 客户端与引擎版本；缺少 Server 通常表示引擎未启动或无权限。
docker version
# 检查 Compose 插件是否已安装，后续用它管理多容器。
docker compose version
# 检查 Docker 是否已设置为开机自启；预期输出 enabled。
sudo systemctl is-enabled docker
```

此方案的 Nginx 和 Certbot 都通过容器运行，不要求在宿主机另装 Node、PM2、MySQL、Nginx 或 Certbot。

**安装检查的预期结果：**`docker version` 同时显示 Client 和 Server，`docker compose version` 有版本号，`is-enabled` 输出 `enabled`。若只有加 sudo 才能连接 Docker，通常是组权限尚未生效，先重新登录 deployer，不要立刻进入上传和启动步骤。

### 10.4 防火墙与端口冲突

Ubuntu 上的 UFW 是主机内的防火墙，和云控制台的安全组是两层配置。端口写作 `22/tcp` 表示允许 TCP 22。**先允许 SSH 再开启防火墙**，并保留现有窗口，避免把自己锁在服务器外。

Nginx 容器之后要占用服务器 80/443。如果服务器已经有其他网站占用这些端口，先确认旧站点的迁移安排；新手不要直接停止自己不认识的服务。

**服务器，保持现有 SSH 会话并确认实际 SSH 端口后执行：** 如果实际端口不是 22，先把下一条的 `22` 改为真实端口；先放行 SSH，再启用防火墙，启用后用另一个窗口确认还能登录。

```bash
# 先放行 SSH 管理端口；如果实际端口不是 22，必须先替换。
sudo ufw allow 22/tcp
# 放行 HTTP 端口，供访问跳转和证书验证使用。
sudo ufw allow 80/tcp
# 放行 HTTPS 端口，供用户加密访问网站与 API。
sudo ufw allow 443/tcp
# 默认拒绝未明确允许的入站连接。
sudo ufw default deny incoming
# 默认允许服务器出站，便于访问软件源、镜像仓库和外部服务。
sudo ufw default allow outgoing
# 启用 UFW；执行前必须已放行真实 SSH 端口并保留当前会话。
sudo ufw enable
# 查看带编号的防火墙规则，核对 SSH/80/443 是否放行。
sudo ufw status numbered
# 查看主机正在监听的 TCP 端口和进程，检查 80/443 是否被占用。
sudo ss -lntp
```

Docker 发布端口的网络规则可能绕过 UFW 的普通规则，因此核心措施是：只发布需要的入口端口，API/数据库不写 `ports`，再配合云安全组；不能只依靠 `ufw deny 3306`。[Docker 防火墙说明](https://docs.docker.com/engine/network/packet-filtering-firewalls/)

如果 80/443 已由旧站点占用，先确认迁移安排和原配置备份，避免停止其他网站。本文主流程假定独占新服务器上的这两个端口。

## 11. 上传运行文件，再单独填写服务器正式配置

**这一步做什么、为什么做：**镜像仓库已经有程序，但服务器还需要知道运行什么版本、如何连接服务、首次执行什么 SQL，以及使用哪个域名和密码。

**在哪里做：**上传命令在本地项目根目录；文件核对和 `.env` 编辑在服务器 `/opt/my-fullstack`。 **完成标志：**文件路径齐全，正式占位符都已替换，服务器能登录私有镜像仓库。

**开始前准备：**第 9 节两个镜像都已推送，第 10 节 deployer 已能登录，Docker 可用，部署目录归 deployer。现在同时保留一个本地终端和一个 deployer 的服务器 SSH 终端。

### 11.1 服务器窗口：准备接收目录

```bash
# 进入已经创建的部署目录，后续服务器 Compose 都以这里为工作目录。
cd /opt/my-fullstack
# 创建上传目录；-p 允许目录已存在。
mkdir -p deploy
```

### 11.2 本地窗口：明确上传哪些文件

`scp` 是通过 SSH 复制文件。`本地文件 deployer@IP:远程目录/` 的冒号左边是登录账号和主机，右边是服务器路径。`-r` 递归复制整个目录。下面只传运行材料，镜像内容已经通过 `push` 交给镜像仓库。

```powershell
# 从本地项目根目录上传基础运行文件、HTTPS 覆盖模板和无真实密钥的环境模板。
scp compose.yaml compose.https.yaml .env.example deployer@203.0.113.10:/opt/my-fullstack/
# 递归上传初始化 SQL 与正式 Nginx 配置目录。
scp -r deploy/mysql-init deploy/nginx deployer@203.0.113.10:/opt/my-fullstack/deploy/
```

若登录使用了自定义端口和密钥，两条上传命令都带上对应参数。例如：

```powershell
# 自定义上传示例：-P 指定真实 SSH 端口，-i 使用与登录相同的本地私钥。
scp -P 2222 -i "$HOME/.ssh/id_ed25519" compose.yaml compose.https.yaml .env.example deployer@203.0.113.10:/opt/my-fullstack/
```

**预期结果：**两次传输完成，没有 permission denied 或找不到文件。不要上传 `.env.local`、`node_modules` 或 Docker Desktop 虚拟磁盘。

### 11.3 服务器窗口：确认文件确实到位

```bash
# 回到正式部署目录，避免在主目录误建另一套配置。
cd /opt/my-fullstack
# 查看三份根目录运行材料的文件信息。
ls -l compose.yaml compose.https.yaml .env.example
# 查看两个部署子目录，确认 SQL 和 HTTPS 配置分别在正确位置。
ls -l deploy/mysql-init deploy/nginx
```

应看到 `deploy/mysql-init/01-schema.sql` 和 `deploy/nginx/https.conf`，以及选用的权限脚本。路径缺失就先补传；不要继续启动一个找不到初始化文件的数据库。

### 11.4 服务器窗口：第一次创建正式 .env

服务器上的 `.env` 和本地 `.env.local` 分别使用自己的密码。`umask 077` 让后续新文件默认只给当前用户访问，`chmod 600` 限制这个文件只有所有者可读写。已有正式 `.env` 时先保存副本，不重复覆盖它。

```bash
# 让当前终端接下来创建的私有文件默认仅自己可访问。
umask 077
# 首次部署才从公开模板创建正式环境文件。
cp .env.example .env
# 再次明确限制正式环境文件权限。
chmod 600 .env
# 打开文件，填写实际镜像用户名、发布标签、独立密码和项目变量。
nano .env
```

在 nano 中修改并保存：**Ctrl+O → 回车 → Ctrl+X**。下面是需要确认的正式字段片段，不是整份 `.env`；镜像名必须和第 9 节 `docker push` 的名称一致，版本必须是已推送的标签。

```dotenv
# 正式项目名后续保持不变，以便持续使用原数据卷。
COMPOSE_PROJECT_NAME=my-fullstack
# 与已推送的 API 仓库全名一致，替换为真实命名空间。
API_IMAGE=yourname/my-fullstack-api
# 与已推送的 Web 仓库全名一致。
WEB_IMAGE=yourname/my-fullstack-web
# 服务器这次要下载并运行的明确发布版本。
APP_VERSION=20261016-1
# 完整正式来源，必须包含 https 协议；API 按项目实际用途读取。
FRONTEND_ORIGIN=https://app.example.com
# 接受服务器所有 IPv4 网卡上的入口连接，公网访问仍受安全组等约束。
BIND_ADDRESS=0.0.0.0
# 正式 HTTP 入口，证书验证和跳转要使用它。
HTTP_PORT=80
# 正式 HTTPS 入口，证书申请后才真正启用 Nginx TLS 监听。
HTTPS_PORT=443
```

其余密码字段按第 6.6 节分别生成正式随机值；项目额外变量也要在 Compose `environment` 中对应存在。再打开 `deploy/nginx/https.conf`，检查 `server_name`、HTTP 跳转域名和证书路径中都是同一个真实域名。普通 Nginx `.conf` 不会因为你改了 `.env` 自动替换域名。

**预期结果：**`.env` 没有中文占位符，API/Web 名称与版本都能在 Docker Hub 查到。此时先不创建 `compose.override.yaml`，因为证书尚未申请。

### 11.5 服务器窗口：登录私有仓库

本机的 `docker login` 凭据不会自动跟到服务器。如果 API/Web 仓库是私有的，要在服务器 deployer 账号下单独登录。使用允许读取仓库的令牌，权限只需覆盖部署所需范围。

```bash
# 在服务器登录镜像仓库，按提示输入自己的用户名对应的访问令牌。
docker login --username yourname
```

**预期结果：**显示 `Login Succeeded`。公开仓库通常可以直接拉取，但仍受仓库访问和限流规则影响。下一节才执行 `pull` 下载镜像与 `up` 启动容器；本节只把运行材料准备齐。

## 12. 首次启动和上线验收

**这一步做什么、为什么做：**按数据库 → API → Nginx HTTP → 申请证书 → Nginx HTTPS 的顺序上线，确认加密访问与真实业务都可用，并建立证书续期任务。

**在哪里做：**启动命令在服务器 /opt/my-fullstack；公网验收从本地或外部网络发起。 **完成标志：**表结构、健康接口、HTTPS、登录读写、证书续期演练、数据持久化与重启恢复均验收通过。

### 12.1 先检查配置，再逐项下载镜像和启动数据库

**开始前准备：**第 11 节文件与正式变量齐全。下面每一步都在**服务器 deployer 的 SSH 终端**执行，当前目录为 `/opt/my-fullstack`。主线使用全新数据库；有旧数据时，先读第 13.4 节的导入分支，必须在正式开放应用前完成。

#### 12.1.1 检查配置和 SQL 文件

服务器不用 `--env-file`，因为部署目录下的 `.env` 是 Compose 默认读取的环境文件。`config --quiet` 正常时没有输出；`test -s` 检查文件存在并且不为空，成功时也不输出。

```bash
# 进入部署目录，确保使用的是正式 Compose 与 .env。
cd /opt/my-fullstack
# 检查正式运行定义和变量，失败时先修正，不继续拉取与启动。
docker compose config --quiet
# SQL 初始化路线必须有真实建表脚本；为空或不存在时先补文件。
test -s deploy/mysql-init/01-schema.sql
# 检查未来要挂载的 HTTPS 配置文件已上传，此时仍不启用。
test -s deploy/nginx/https.conf
```

采用第 7.3 节 migration 路线时，已经移除了初始化目录挂载，可跳过 SQL 文件检查；启动数据库后必须执行自己项目真实的迁移任务，不能照抄不存在的命令。

#### 12.1.2 明确执行 pull，下载三个业务镜像与证书工具

`pull` 把镜像下载到**当前服务器**，不创建或启动业务容器。`api web` 使用 `.env` 中的仓库名称和标签，`db` 直接使用官方 MySQL，`certbot` 使用官方工具镜像。

```bash
# 从自己的仓库下载 API 的指定版本，不从源码构建。
docker compose pull api
# 下载 Web 的同一发布版本。
docker compose pull web
# 直接下载官方 MySQL 镜像，不需要自己的 MySQL Dockerfile。
docker compose pull db
# 显式启用工具组，仅下载官方 Certbot 镜像，暂时不运行它。
docker compose --profile tools pull certbot
```

这里 `--profile tools` 启用 Compose 中标记为工具组的服务，便于显式下载 Certbot。**四次都成功后继续。** `unauthorized` 先回第 11.5 节检查服务器登录；`manifest unknown` 核对名称/版本；平台不匹配先回第 9 节重建正确平台，不能靠改密码解决。

#### 12.1.3 仅启动数据库，检查业务表和必要数据

服务器使用 Bash，下面可以直接用一行 `exec -T db sh -c` 完成容器内查询：`-T` 关闭伪终端，适合脚本输出；`sh -c` 让单引号中的命令在容器内部读取环境变量。它执行完会返回服务器提示符，不需要手工输入 `exit`。

```bash
# 先只启动数据库，给空数据卷执行初始化留出时间，最多等待 300 秒。
docker compose up -d --wait --wait-timeout 300 db
# 查看数据库的初始化输出，确认没有 SQL 错误。
docker compose logs --tail=100 db
# 用业务账号查询表名，确认不是只有一个空业务库。
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -u"$MYSQL_USER" "$MYSQL_DATABASE" -e "SHOW TABLES;"'
# 查看正式项目创建的命名卷，记录数据库卷的真实名称。
docker volume ls --filter label=com.docker.compose.project=my-fullstack
```

**预期结果：**db 健康，表名、必要基础数据和 migration 版本符合项目要求。`db_data` 的真实卷名通常带项目名前缀，例如 `my-fullstack_db_data`，以后保持项目名不变。检查未通过就停在本步。

#### 12.1.4 表准备好后，再启动 API 和 HTTP 网页入口

第一次部署目录里只有 `compose.https.yaml` 模板，**尚未生成 `compose.override.yaml`**，因此 Web 使用镜像内的纯 HTTP 配置。API 的 `/api/health` 必须按第 3 节事先适配为真实检查接口。

```bash
# 启动其余常驻服务，API 等 db 就绪，Web 等 API 健康。
docker compose up -d --wait --wait-timeout 300
# 检查三个服务的运行状态；Certbot 不需要常驻出现。
docker compose ps
# 查看初始化与启动日志，确认代理和后端没有错误。
docker compose logs --tail=100 db api web
# 在运行中的 Web 容器校验当前 HTTP Nginx 配置。
docker compose exec -T web nginx -t
```

**预期结果：**db/api healthy，web 运行，`nginx -t` 显示语法正确且检查成功。现在只有临时 HTTP 入口，映射了 443 也不代表已有 HTTPS；先进行下一节证书验证，不在临时 HTTP 入口开放正式业务写入。

本节的顺序是：**数据库表就绪 → HTTP 入口就绪 → 公网能读验证文件 → Certbot 申请证书 → 检查 HTTPS 配置 → 只重建 Web → 公网 HTTPS 验收**。每个箭头前都有检查，任何一项失败都先解决，再继续下一项。

### 12.2 验证 HTTP 入口，申请证书，再启用 HTTPS

**先理解两种“运行命令”的区别。** `docker compose exec` 在已有的运行容器里执行命令；`docker compose run` 临时创建一个该服务的工具容器，执行完就退出。这里的 `--rm` 只删除临时容器，保留证书卷；`--entrypoint sh` 临时改用 shell，`-c` 后面是要在里面执行的一段命令。

先用工具容器向共享目录写一个固定测试文件，再从公网读回来。这样能先验证 DNS、80 端口、Nginx 路径和共享卷确实贯通，再向证书机构申请。

**这一步的作用：**证书机构通过公网 HTTP 读取验证文件，确认域名由你控制。Nginx 必须先能提供这个文件；申请成功后才有证书让 HTTPS 配置读取。首次 HTTP 只用于验证入口，生产登录和录入留到 HTTPS 开启后验收。

先确认 DNS 的 A 记录指向这台服务器；存在 AAAA 时也须指向可访问的正确 IPv6 入口，否则先纠正。云安全组及服务器端口允许公网访问 TCP 80/443。以下所有域名及邮箱必须替换成真实值，并与 `deploy/nginx/https.conf` 一致。

**服务器 `/opt/my-fullstack`，先写入一个临时验证文件：**

```bash
# 通过按需 Certbot 工具容器，将测试内容写到与 Nginx 共享的验证目录。
docker compose run --rm --entrypoint sh certbot -c 'mkdir -p /var/www/certbot/.well-known/acme-challenge && printf "nginx-acme-ok\n" > /var/www/certbot/.well-known/acme-challenge/deploy-check'
```

**本地 Mac / 外部 Linux，Windows 改用 `curl.exe`：**

```bash
# 从外部验证 80 端口及 Nginx 验证路径，响应必须为 nginx-acme-ok。
curl -f http://app.example.com/.well-known/acme-challenge/deploy-check
```

必须在外部网络得到测试内容后再继续；从服务器本机访问成功不足以证明公网已打通。下面使用 Certbot 的 webroot 模式，验证时复用 Nginx 的 HTTP 端口，不会额外启动一个占用 80 端口的服务。[Certbot webroot 说明](https://eff-certbot.readthedocs.io/en/stable/using.html#webroot)

**外部读到测试内容后才申请。先解释申请参数：**

| 参数 | 意义 |
| --- | --- |
| `certonly` | 只申请并保存证书，Nginx 配置由本文单独启用 |
| `--webroot` | 通过现有网站目录放验证文件，不另占服务器 80 端口 |
| `-w /var/www/certbot` | 验证文件写入的位置，已与 Nginx 共享 |
| `--cert-name app.example.com` | 固定证书目录名称，必须与 Nginx 的证书路径一致 |
| `-d app.example.com` | 实际申请证书的域名，替换为你的真实域名 |
| `--email` | 你自己的证书联系邮箱 |
| `--agree-tos --non-interactive` | 同意证书服务条款，并以无需交互输入的方式执行 |

两个域名参数都要替换，邮箱也要替换。该命令完成后只表示证书已保存，还需要下一步让 Nginx 加载它。

**服务器 `/opt/my-fullstack`：**

```bash
# 申请真实域名证书；替换两处域名及真实邮箱，证书名称决定后续文件路径。
docker compose run --rm certbot certonly --webroot -w /var/www/certbot --cert-name app.example.com -d app.example.com --email your-email@example.com --agree-tos --non-interactive
```

看到证书成功保存的信息后再继续。证书、私钥、账户及续期配置保存在 `certbot_conf` 卷里；HTTPS 配置的 `/etc/letsencrypt/live/app.example.com/` 必须与这里的 `--cert-name` 一致。失败时按 DNS、AAAA、80 入站、验证文件、出站网络顺序排查，不能先启用没有证书的 HTTPS 配置。

**现在准备启用 HTTPS。** `compose.https.yaml` 仍是模板；把它复制为 `compose.override.yaml` 后，普通 `docker compose` 会自动将它合并到基础文件中。复制前确认没有其他用途的同名文件；已有覆盖文件应先合并审核，不能盲目覆盖。

`--no-deps` 表示这次只操作 Web，不顺带启动或重建 API/数据库；`--force-recreate` 明确重建 Web 以应用新的配置挂载。先用 `run ... nginx -t` 临时检查，成功后才重建正式 Web。

```bash
# 确认即将挂载的正式 Nginx 配置文件存在且非空。
test -s deploy/nginx/https.conf
# 首次申请成功后启用自动覆盖文件，使以后普通 Compose 命令继续加载 HTTPS 挂载。
cp compose.https.yaml compose.override.yaml
# 校验合并后的基础配置和 HTTPS 覆盖配置，不输出密钥。
docker compose config --quiet
# 先用相同镜像和挂载检查 HTTPS 配置与证书，不发布端口，也不停止现有 HTTP 入口。
docker compose run --rm --no-deps web nginx -t
# 检查成功后只重新创建 Web 服务以加载 HTTPS 配置，数据库和 API 继续运行。
docker compose up -d --no-deps --force-recreate --wait --wait-timeout 300 web
# 确认 Nginx 配置语法及证书路径有效。
docker compose exec -T web nginx -t
# 查看 Web 最近日志，确认没有证书加载或代理错误。
docker compose logs --tail=100 web
# 删除用于检查路径的临时验证文件，保留目录供后续续期使用。
docker compose run --rm --entrypoint sh certbot -c 'rm -f /var/www/certbot/.well-known/acme-challenge/deploy-check'
```

后续在 `/opt/my-fullstack` 执行不带 `-f` 的 `docker compose`，会自动读取 `compose.yaml` 和 `compose.override.yaml`。**生产环境不能临时只写 `-f compose.yaml` 重新创建 Web**，否则会跳过 HTTPS 挂载；选读的服务器构建路线需显式列出全部文件。

复制覆盖模板前，先确认没有其他用途的 `compose.override.yaml`；已有文件应先合并审核，不能盲目覆盖。若一次性 `nginx -t` 失败，保持当前 HTTP 容器运行，修正配置或证书路径后重新检查，通过后再重建 Web。

**本地 Mac / 外部 Linux，Windows 改用 `curl.exe`：**

```bash
# 从外部检查 HTTP 响应头，正式域名应跳转到 HTTPS。
curl -I http://app.example.com
# 从外部检查 HTTPS 站点的证书与 HTTP 响应头。
curl -I https://app.example.com
# 通过公网 HTTPS 和 Web 代理检查 API 健康接口及状态码。
curl -i https://app.example.com/api/health
```

预期 HTTP 跳转 HTTPS，HTTPS 页面与健康接口成功，证书域名及有效期正确。不要用忽略证书错误作为上线标准。80 端口的验证路径仍保留，普通请求才跳转 HTTPS。

### 12.3 浏览器实际业务

1. 首页与 JS/CSS 加载正常，地址栏证书有效。
2. 直接访问并刷新一个前端子路由，SPA 能回到正确页面。
3. API 请求使用正式同源 `/api`，没有用户浏览器自己的 localhost。
4. 完成注册/登录、核心增删改查和退出登录。
5. 若有邮件、上传、支付回调等外部能力，按真实业务流程验证。
6. Cookie 项目检查 HttpOnly、Secure、SameSite、Domain、Path，以及刷新/重登流程。
7. 核对数据、时区、金额精度及基础数据。

同源部署减少 CORS 配置；若拆成 Web/API 子域名，仍须精确来源与凭据配置。后端若依据代理头判断协议或真实 IP，还需按框架要求设置信任代理范围。

### 12.4 重启恢复

在合适的维护时间重建容器，确认数据库与上传数据保留；再安排服务器重启并复测。

```bash
# 重新创建容器并等待就绪，用于验收重建后卷中的数据仍在。
docker compose up -d --force-recreate --wait --wait-timeout 300
# 列出当前项目容器的运行状态、健康状态和端口映射。
docker compose ps
# 重启服务器验收开机恢复；SSH 会断开，等待启动后重新登录检查。
sudo reboot
```

重新登录后检查 `docker compose ps`、页面和数据。`unless-stopped` 不会自动恢复你主动停止的容器；健康检查失败本身也不会触发 Docker 重启，进程存活和业务健康是两项不同检查。

### 12.5 设置证书续期，续期后让 Nginx 重新读取证书

**开始前准备：**第 12.2 节 HTTPS 已成功，证书在共享卷中，80 端口仍保留验证路径。申请证书不是一次配置后永远有效，需要定期检查是否到期。

`renew` 按已有续期配置检查证书，需要时更新；`--dry-run` 用测试环境演练，不替换正式证书。Nginx 会把证书加载进运行进程，所以更新文件后还要 `nginx -t` 检查，并用 `nginx -s reload` 平滑重新读取。

下面先演练成功，再把相同过程保存为脚本，最后交给 Ubuntu 的定时任务 `cron` 每天执行两次。每一步都要手工成功一次，再安排自动执行。

**这一步的作用：**Certbot 按证书需要续期，成功后 Nginx 重新加载证书。单纯更新磁盘上的证书文件，不会自动替换 Nginx 已经加载的证书。本文使用部署用户的 cron，每天检查两次；Certbot 工具容器执行完即删除。

先手动演练续期，确认 HTTPS 开启后 HTTP 验证路径仍可访问。此命令使用测试证书机构，成功不会替换线上证书：[Certbot 续期说明](https://eff-certbot.readthedocs.io/en/stable/using.html#renewing-certificates)

```bash
# 在服务器部署目录演练续期，确认验证路径和续期设置有效。
docker compose run --rm certbot renew --dry-run
# 创建部署用户的脚本目录及私有证书日志目录。
mkdir -p ~/bin ~/certbot-logs
# 限制证书任务日志目录只允许当前部署用户访问。
chmod 700 ~/certbot-logs
# 打开续期脚本，填写下一段完整内容并保存。
nano ~/bin/renew-my-fullstack-cert
```

**脚本文件 `~/bin/renew-my-fullstack-cert` 的完整内容：**

```bash
#!/usr/bin/env bash
# 任一命令失败、变量未定义或管道失败时停止，防止续期失败仍继续操作。
set -euo pipefail
# 限制脚本新建文件默认只允许当前用户访问。
umask 077
# 切换到正式目录，自动加载生产环境与 HTTPS 覆盖文件。
cd /opt/my-fullstack
# 让 Certbot 按需续期；--quiet 仍会输出需要处理的错误。
/usr/bin/docker compose run --rm certbot renew --quiet
# 校验证书与 Nginx 配置，失败时停止，保留当前运行配置。
/usr/bin/docker compose exec -T web nginx -t
# 平滑重载 Nginx，让工作进程使用续期后的证书。
/usr/bin/docker compose exec -T web nginx -s reload
```

`#!/usr/bin/env bash` 是脚本必须放在首行的解释器声明；其余执行行的上一行均为用途注释。`renew` 在暂时没有到期证书时也会成功退出，因此每次成功检查后重载 Nginx 是预期行为。脚本失败时不会继续执行后续命令，需检查日志、修复并重新演练；cron 不保证主动把失败通知给你，应接入你使用的运维告警或检查这些日志。

```bash
# 仅允许当前部署用户读取、修改和执行续期脚本。
chmod 700 ~/bin/renew-my-fullstack-cert
# 手动执行正式续期检查，确认 Docker 路径、权限与重载均正确。
~/bin/renew-my-fullstack-cert
# 编辑当前部署用户的 cron，保留其他任务并加入下一段配置。
crontab -e
```

**在现有 crontab 中增加：**

`crontab -e` 打开当前用户的定时任务表，首次可能要求选择编辑器，可选 nano。保留已有任务，在末尾新增下面一行，再保存。前五段依次是“分钟、小时、日、月、星期”；`17 3,15 * * *` 表示每天服务器时间 03:17 和 15:17。`>>` 追加日志，`2>&1` 把错误输出也写进同一日志文件。

```cron
# 按服务器本地时区每天 03:17、15:17 检查续期，并将结果写入私有日志目录。
17 3,15 * * * /home/deployer/bin/renew-my-fullstack-cert >> /home/deployer/certbot-logs/renew.log 2>&1
```

路径中的 `deployer` 要与真实部署用户名一致。服务器使用 UTC 时，这两个时间对应北京时间 11:17、23:17；可用 `timedatectl` 核对服务器时区。证书卷、域名的 DNS 及公网 HTTP 验证入口需要持续保留，不能申请一次后关闭 80 端口。

## 13. 备份与恢复：卷让数据保留，备份让数据可找回

**这一步做什么、为什么做：**把持久数据做成可恢复备份，并验证备份真的能用。

**在哪里做：**备份脚本在服务器；恢复优先用隔离环境；异机副本另行保存。 **完成标志：**至少成功导出一次、恢复演练一次，并安排保留周期、异机副本与失败提醒。

### 13.1 备份范围

| 内容 | 处理方式 |
| --- | --- |
| 数据库 | 一致性逻辑导出或适合数据库的备份方案 |
| 用户上传文件 | 卷/对象存储的独立备份 |
| `.env`、密钥 | 私有、加密保存，严格限制访问 |
| Compose、Nginx 配置、初始化/迁移 SQL | 版本管理并留存发布副本，生产还需保存 compose.override.yaml |
| Certbot 证书状态 | 备份整个 certbot_conf 卷，包含私钥、archive/live/renewal/accounts，按敏感文件保存 |
| 镜像版本 | 保留仓库标签与 digest，避免仓库清理旧版本 |

命名卷在同一 Docker 主机持久化，不能抵御整机丢失。不要使用 `down -v` 或卷清理命令作为日常发布步骤。[Docker 卷生命周期](https://docs.docker.com/engine/storage/volumes/)

证书备份必须保留整个 `/etc/letsencrypt` 目录结构、权限和符号链接。`live/` 中的证书通常链接到 `archive/`，只复制 `fullchain.pem` 或只备份 `live/` 会遗漏续期所需状态。安排与证书续期错开的备份窗口，通过受控的卷备份工具归档整个 `certbot_conf` 卷，恢复时也还原整个卷；`certbot_www` 是临时验证文件卷，不可代替证书卷。证书私钥不得放进 Git 或公开备份位置。[Docker 卷备份说明](https://docs.docker.com/engine/storage/volumes/#back-up-restore-or-migrate-data-volumes)

**开始前准备：**正式库运行正常，部署目录和项目名已固定，有足够磁盘保存备份。先做一次手工备份并恢复演练，再添加自动任务。备份文件含真实业务数据，应放在只有部署用户能访问的位置，并另外保留异机副本。

### 13.2 创建 MySQL 备份脚本

先解释脚本中的几个动作：`mysqldump` 把数据库逻辑结构和数据导出成 SQL；`| gzip` 将 SQL 压缩；先写入 `.partial` 临时文件，成功校验后才改为正式 `.sql.gz`。`set -euo pipefail` 让中间失败能终止脚本，避免导出失败却生成“看起来成功”的空压缩包。

| 导出参数 | 作用 |
| --- | --- |
| `-uroot` | 使用容器内数据库管理员账号；密码从容器环境读取 |
| `--single-transaction --quick` | 按事务一致性读取 InnoDB，并流式导出，备份期间不执行表结构修改 |
| `--routines --events --triggers` | 同时导出存储过程、事件和触发器 |
| `--no-tablespaces` | 不导出表空间相关信息 |
| `--set-gtid-purged=OFF` | 不把源库 GTID 状态写入这份业务逻辑备份 |
| `--databases my_fullstack` | 导出指定业务库，并包含建库/选择库语句，因此恢复时必须确认目标 |

接下来的第一段是终端命令，用来打开文件；第二段是**要粘贴进这个文件的脚本内容**。保存后退出编辑器，才继续执行 chmod 和手工备份命令。

**服务器 deployer：**

```bash
# 创建部署用户的脚本目录和本地备份目录。
mkdir -p ~/bin ~/my-fullstack-backups
# 限制备份目录仅部署用户可访问。
chmod 700 ~/my-fullstack-backups
# 创建或编辑数据库备份脚本文件。
nano ~/bin/backup-my-fullstack
```

写入下面完整脚本。首行 `#!/usr/bin/env bash` 是解释器声明，必须保持文件第一行；本句说明它的作用，块内从第二行起逐行注释：

```bash
#!/usr/bin/env bash
# 命令失败、未定义变量或管道中任一步失败时退出，避免将失败当成功。
set -euo pipefail
# 让本终端随后创建的文件默认仅当前用户可访问，保护配置与备份。
umask 077
# 进入服务器正式部署目录，让 Compose 读取该目录中的配置。
cd /opt/my-fullstack
# 指定数据库备份保存目录；使用其他部署用户时同步修改路径。
backup_dir=/home/deployer/my-fullstack-backups
# 确保备份目录存在，并限制仅当前用户可访问。
install -d -m 700 "$backup_dir"
# 用服务器当前时间生成不易重名的压缩备份文件名。
backup_file="$backup_dir/db_$(date +%Y%m%d_%H%M%S).sql.gz"
# 使用容器内管理员凭据一致性导出业务库（含过程/事件/触发器），压缩写入临时文件，管道失败由 pipefail 检出。
/usr/bin/docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --quick --routines --events --triggers --no-tablespaces --set-gtid-purged=OFF --databases my_fullstack' | gzip > "$backup_file.partial"
# 校验临时压缩文件是否完整；失败时脚本退出，不把它标记成正式备份。
gzip -t "$backup_file.partial"
# 校验成功后将临时文件改名为正式备份文件。
mv -- "$backup_file.partial" "$backup_file"
# 打印本次生成的备份路径，便于人工检查和日志追踪。
printf '备份完成：%s\n' "$backup_file"
```

当前方案通过容器环境向客户端提供密码，避免把明文写进宿主机命令参数。只有备份成功才将 `.partial` 改成正式文件；失败应检查退出码和日志。

`--single-transaction` 主要适用于 InnoDB；备份期间不执行 DDL，非事务表需另行设计一致性方案。不要对运行中的 `/var/lib/mysql` 直接打包就当成可靠备份。

```bash
# 仅允许部署用户读取、修改和执行备份脚本。
chmod 700 ~/bin/backup-my-fullstack
# 立即执行一次数据库备份；首次上线或每次切换前先确认它成功。
~/bin/backup-my-fullstack
# 查看备份文件的时间与大小，确认有本次生成的结果。
ls -lh ~/my-fullstack-backups
# 编辑当前部署用户的定时任务，保存下一块的备份计划。
crontab -e
```

添加：

在 `crontab -e` 中保留前面的证书续期任务，另外添加下面的数据库备份任务。`30 3 * * *` 表示每天服务器时间 03:30；脚本路径必须与实际保存位置一致。

```cron
# 每天按服务器时区 03:30 执行备份，将标准输出与错误追加到日志。
30 3 * * * /home/deployer/bin/backup-my-fullstack >> /home/deployer/my-fullstack-backups/backup.log 2>&1
```

这是**服务器时区**每天 03:30，不一定是本地电脑时间。检查 `timedatectl`，按业务统一时区；另设备份保留周期、异机副本和失败告警，定期检查容量。

### 13.3 在隔离数据库恢复演练

**先看清操作对象。** `-p my-fullstack-restore` 手动指定另一套 Compose 项目名，因此生成另一组网络和数据库卷；所有演练命令都必须带同一个 `-p`。正式项目仍使用 `.env` 中的 `my-fullstack`，不会因这次演练变成测试库。

`gzip -t` 只检查压缩文件完整；真正用备份恢复一次并检查业务数据，才能证明它可用。下面仅启动隔离的 db，正式 API、Web 与证书工具都不参与演练。命令中的“实际时间”必须先换成 `ls` 中真实存在的备份文件名。

恢复管道里的 `gzip -dc` 表示“解压并把 SQL 输出到标准输出”，后面的 `|` 将 SQL 交给隔离容器内的 MySQL 客户端。不要手工把管道目标改成正式项目来做第一次尝试。

在资源足够的测试服务器或同机隔离项目中执行，只启动 db，不启动会发送邮件或触发任务的 API：

```bash
# 进入服务器正式部署目录，让 Compose 读取该目录中的配置。
cd /opt/my-fullstack
# 以隔离项目名仅启动测试数据库，生成独立网络和数据卷。
docker compose -p my-fullstack-restore up -d --wait --wait-timeout 300 db
# 替换成真实备份文件。
# 设置要演练的真实备份路径，先将“实际时间”替换为现有文件名。
backup_file=/home/deployer/my-fullstack-backups/db_实际时间.sql.gz
# 验证选中的压缩备份没有损坏，失败时不要继续导入。
gzip -t "$backup_file"
# 让下面的导入管道任一步失败都返回失败状态，便于识别解压或导入错误。
set -o pipefail
# 解压备份并导入隔离数据库；此处不连接正式项目的数据库。
gzip -dc "$backup_file" | docker compose -p my-fullstack-restore exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot'
# 查询恢复库中的业务表，随后还应核对行数和实际数据。
docker compose -p my-fullstack-restore exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot my_fullstack -e "SHOW TABLES;"'
# 停止并移除隔离测试容器及网络，保留测试卷以便后续检查。
docker compose -p my-fullstack-restore down
```

进一步核对关键表行数和业务数据；完整演练还应让独立测试 API 连接恢复库。备份含 `CREATE DATABASE` / `USE`，隔离靠不同容器、网络和数据卷实现，仅修改 mysql 命令中的库名可能无效。

测试卷保留供检查；确认所属项目后再单独清理，勿误删正式卷。真实恢复按下面顺序安排维护窗口，恢复旧库会丢失备份后的写入。

| 恢复阶段 | 要做的事情 | 为什么要先做 |
| --- | --- | --- |
| 1. 停写 | 停止 Web、API、队列消费者和所有可能写库的定时任务；保留 db 运行 | 避免导入过程中又产生新数据 |
| 2. 保护当前状态 | 对当前业务库和必要文件另做一份备份，保留当前镜像与配置记录 | 发现恢复目标选错时仍有回到操作前的机会 |
| 3. 确认目标 | 选择已演练过的备份，核对时间、业务库、版本和数据范围 | gzip 校验只能证明压缩文件完好，不能证明业务内容正确 |
| 4. 导入 | 将上方演练命令中的 `-p my-fullstack-restore` 换为正式项目的选择方式（主线在部署目录不写 `-p`），再次核对卷和库后导入 | 演练命令默认隔离，正式恢复必须显式确认操作对象 |
| 5. 验收再开放 | 检查表、行数、关键业务数据和迁移版本，启动与此数据库版本兼容的 API/Web，再检查登录和核心读写 | 程序和恢复后的表结构必须兼容，验收完成才能恢复流量 |

### 13.4 迁移原有本地数据库（有真实旧数据时，在第 12 节启动应用前完成）

这条分支的顺序是：**先备份旧库 → 在隔离环境试导入 → 安排切换并暂停旧系统所有写入 → 做最终导出 → 传到服务器 → 仅启动正式 db 并导入 → 核对数据 → 启动新 API/Web → 验收后切换入口。** 主线初始化 SQL 和旧库导入不能互相重复建表；先在隔离环境验证，是选择空库导入还是用兼容的既有结构，不能凭报错随意删正式表。

先暂停旧系统写入，导出所需业务库，不迁移 `mysql` 系统库。Windows 使用本机 MySQL 工具时，推荐 `mysqldump --result-file=完整文件路径`，避免旧 PowerShell 重定向转换 SQL 编码。

通过 scp 传输 SQL 并限制文件权限，先导入隔离容器验证版本兼容、表结构和数据；正式切换时停止新系统写入，再导入指定正式库。不要同时让新旧两套系统继续产生账目或订单。

**如果旧库还没有导出文件，先在本地生成它。** 下面假设旧 MySQL 在电脑的 127.0.0.1，且本机已安装可连接该旧库的 MySQL 客户端工具。先在隔离环境演练；正式切换时暂停所有旧系统写入，再做一次最终导出。`--password` 会交互询问密码，命令里不填写明文。

**本地 Windows PowerShell，先替换本地管理员账号和实际业务库名：**

```powershell
# 创建本地导出目录，保存业务 SQL。
New-Item -ItemType Directory -Force D:/my-fullstack-backups
# 导出指定业务库到文件，result-file 避免 PowerShell 重定向改变 SQL 编码。
mysqldump --host=127.0.0.1 --user=本地管理员账号 --password --single-transaction --no-tablespaces --set-gtid-purged=OFF --databases my_fullstack --result-file=D:/my-fullstack-backups/business.sql
# 切换到导出文件所在目录，下一段 scp 的相对路径以这里为准。
Set-Location D:/my-fullstack-backups
```

Mac/Linux 可用同一套 MySQL 导出参数，将 `--result-file` 换成自己可写的实际路径，再在那个目录上传。旧库如果也在 Docker 中，可按第 13.2 节的容器内导出方式生成文件，不需要在宿主机额外安装数据库服务。

**预期结果：**导出命令成功，文件非空。接下来先上传这份文件，再用下面的隔离命令核对结构、业务记录和版本兼容；通过后才安排正式切换。

假设已在本地准备了 `business.sql`（只包含所需业务库，且库名已核对），先把它传到服务器，同一文件先用于隔离演练，通过后才用于正式导入。

**本地，SQL 所在目录：**

```bash
# 将已导出的业务 SQL 传到服务器，下一步先在隔离数据库中试导入。
scp business.sql deployer@203.0.113.10:/opt/my-fullstack/business.sql
```

**服务器，先在隔离项目中演练，不触碰正式库：**`-p my-fullstack-import-test` 为所有演练命令指定另一组容器和卷，不能省略。当前文件是未压缩的 `.sql`，直接用 `< business.sql`；第 13.3 节的 `.sql.gz` 才需要 gzip 解压。

```bash
# 进入配置目录，下面通过独立项目名隔离数据库。
cd /opt/my-fullstack
# 限制旧业务数据文件只有 deployer 可读写。
chmod 600 business.sql
# 只启动隔离数据库，不运行 API/Web。
docker compose -p my-fullstack-import-test up -d --wait --wait-timeout 300 db
# 将这份 SQL 直接导入隔离数据库，目标不会是正式项目的 db。
docker compose -p my-fullstack-import-test exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot my_fullstack' < business.sql
# 核对隔离库中的表，进一步按真实项目查询关键行数和业务数据。
docker compose -p my-fullstack-import-test exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot my_fullstack -e "SHOW TABLES;"'
# 停止演练容器并保留测试卷，正式数据卷不受影响。
docker compose -p my-fullstack-import-test down
```

只有导入成功且关键表、数据和版本兼容性核对通过，才安排正式切换。先暂停旧系统所有写入，再重新执行上面的导出和上传，拿到最终数据文件；下面才是正式导入，必须停止新系统及其他任务写入并确认目标。

**服务器，仅 db 已启动，API/Web 尚未开放：**

```bash
# 进入服务器正式部署目录，让 Compose 读取该目录中的配置。
cd /opt/my-fullstack
# 限制业务数据文件仅部署用户可读写。
chmod 600 business.sql
# 用管理员账号将 SQL 导入正式 db；执行前必须停止所有写入并确认目标。
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot my_fullstack' < business.sql
# 查看正式业务库中的表，随后按项目核对关键行数、金额与账号。
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot my_fullstack -e "SHOW TABLES;"'
```

如果 SQL 自带 `CREATE DATABASE` / `USE`，导入目标受脚本内容控制，命令末尾写 `my_fullstack` 不能强制改名；需要先审核并在隔离环境验证。再按项目核对关键表行数、金额、时间与账号，确认后回到第 12 节启动 API/Web。导入文件含业务数据，按备份的访问权限和保留周期管理。

## 14. 更新、配置变更与应用回退

**这一步做什么、为什么做：**用明确版本发布新程序，出现问题时按数据库兼容范围回退。

**在哪里做：**本地/CI 构建镜像；服务器执行备份、拉取和切换。 **完成标志：**发布前保留旧版本及备份，发布后重复核心验收并更新记录。

### 14.1 第二次发布：用新标签重复完整链路

**开始前准备：**第一次上线、续期、备份和恢复演练已完成；本次代码检查通过，明确是否有数据库变更。下面以旧版本 `20261016-1` 更新到新版本 `20261017-1` 为例，两份应用镜像都用同一个新标签。

#### 14.1.1 本地先构建、打标签、推送新版本

Dockerfile 已在镜像内执行构建。如另外执行 npm 测试/检查，要在装好项目要求的 Node 与依赖的电脑或 CI 中执行；服务器不需要为此安装 Node。参数含义沿用第 9 节，下面仍把每个动作单独列出。

**本地项目根目录：**

```powershell
# 按目标服务器架构构建新版 API，在本机保存；Arm 服务器按实际改平台。
docker build --platform linux/amd64 --file server/Dockerfile --tag my-fullstack-api:20261017-1 server
# 构建相同发布版本的 Web 镜像。
docker build --platform linux/amd64 --file web/Dockerfile --tag my-fullstack-web:20261017-1 web
# 为已有新版 API 镜像增加真实仓库名称。
docker tag my-fullstack-api:20261017-1 yourname/my-fullstack-api:20261017-1
# 为新版 Web 镜像增加对应仓库名称。
docker tag my-fullstack-web:20261017-1 yourname/my-fullstack-web:20261017-1
# 明确上传新版 API；本机须仍有仓库推送权限，登录失效先按第 9.5 节重新登录。
docker push yourname/my-fullstack-api:20261017-1
# 明确上传新版 Web；两份都成功后才操作服务器。
docker push yourname/my-fullstack-web:20261017-1
# 检查仓库中新版 API 的实际平台和摘要。
docker buildx imagetools inspect yourname/my-fullstack-api:20261017-1
# 检查新版 Web，确认不会让服务器拉到不存在的标签。
docker buildx imagetools inspect yourname/my-fullstack-web:20261017-1
```

**预期结果：**两条 push 都成功，两个新标签可查。保留旧标签，不能覆盖旧版来“更新”。若本次增加或修改了服务器上的 Nginx 配置/Compose/迁移文件，先审核并上传这些材料；程序镜像不会自动更新宿主机挂载的文件。

#### 14.1.2 服务器先备份，再修改本次要运行的版本

```bash
# 进入正式部署目录，保持原 Compose 项目名和 HTTPS 覆盖文件。
cd /opt/my-fullstack
# 让接下来新建的配置备份仅自己可访问。
umask 077
# 保存当前正式环境文件，用时间戳避免覆盖已有副本。
cp .env ".env.before-$(date +%Y%m%d_%H%M%S)"
# 执行已经手工验证过的备份脚本，失败时不继续发布。
~/bin/backup-my-fullstack
# 打开 .env，只切换发布标签并补齐本版本确实需要的新配置。
nano .env
```

在文件中把对应字段改为下面这一行，保留当前有效的密码：

```dotenv
# 让服务器 API/Web 选择刚才已经成功推送的新版本。
APP_VERSION=20261017-1
```

保存退出。**预期结果：**旧配置副本和数据库备份都存在，`.env` 指向已发布的新标签；此时旧容器还在运行。

#### 14.1.3 服务器下载新镜像，成功后才停写和切换

```bash
# 先检查新配置，避免在停机后才发现变量缺失。
docker compose config --quiet
# 下载新版 API 到服务器，仍不启动它。
docker compose pull api
# 下载新版 Web，确认两份都成功后再进行维护切换。
docker compose pull web
# 暂停网页和 API 写入，保留数据库运行。
docker compose stop web api
```

如果本版有数据库迁移，在这个停写窗口执行该项目真实配套的迁移命令/SQL，并核对结果。没有迁移就跳过这一动作；不能把首次建表 SQL 重跑一遍当成升级，也不能开启生产自动同步来代替迁移。

```bash
# 用同一正式配置启动新版服务，自动保留 HTTPS 覆盖与原数据卷。
docker compose up -d --wait --wait-timeout 300
# 查看新版应用日志，定位启动或代理问题。
docker compose logs --tail=100 api web
```

**预期结果：**新服务健康，按第 12.3 节重新验收登录、核心读写和统计，记录新版本。这是短暂停机发布；有多个写库任务时也要在迁移期间停止它们。数据库大版本升级单独演练，不能跟每次业务发布顺便改。

### 14.2 按改动类型操作

| 改了什么 | 怎样生效 |
| --- | --- |
| 业务代码/依赖 | 构建新镜像、推送、改标签、pull、up |
| API 环境变量 | 改 `.env` / Compose，然后 `up -d --force-recreate api` |
| 前端构建变量 | 重新构建 Web 镜像，运行时变量不会改已有静态 JS |
| 镜像内的 web/nginx.conf | 重建并发布 Web 镜像；生产使用挂载的 HTTPS 配置时不会读取这份默认文件 |
| 生产 deploy/nginx/https.conf | 先审核配置，再在容器内 nginx -t，成功后 nginx -s reload；更换挂载文件或挂载参数时重建 web |
| 站点域名 | 更新 DNS，先为新域名申请证书，再改 HTTPS 配置、证书路径和 FRONTEND_ORIGIN，并验收 |
| 证书续期 | 由续期脚本执行 Certbot、nginx -t 和 reload，定期核对日志及证书有效期 |
| 数据库用户密码 | 在数据库内改账号密码，再更新环境变量和相关容器 |
| 数据库版本 | 独立安排升级与恢复演练，不随业务版本顺便变更 |
| 卷或 Compose 项目名 | 先确认数据定位；变化可能指向一组全新空卷 |

`docker compose restart` 不会重新应用环境变量和其他容器创建参数；使用 `up` 重新创建相应服务。[Compose restart 官方说明](https://docs.docker.com/reference/cli/docker/compose/restart/)

**本节完成标志：**新版本经过仓库核验、服务器备份、下载、切换和业务验收；若发现问题，下一节先判断旧程序是否兼容当前数据库，再回退应用。

### 14.3 应用回退

回退时是在服务器选择仍保留的旧镜像标签，不是重新上传旧数据库。先核对数据库迁移后的兼容性，再编辑 `.env` 将 `APP_VERSION` 改回例如 `20261016-1`；有效密码保留当前值。后面的 pull 确保旧镜像可下载，up 才真正替换运行容器。

确认旧代码兼容当前数据库结构后，在服务器执行下面步骤。编辑时只把 `APP_VERSION` 改回已保留的旧标签，并保留当前有效密钥；只有确认旧镜像能拉取后才停止现有应用：

```bash
# 进入服务器正式部署目录，让 Compose 读取该目录中的配置。
cd /opt/my-fullstack
# 编辑生产环境配置，按当前步骤填写真实值或切换发布标签。
nano .env
# 校验 Compose 结构与变量插值，不输出可能包含密码的完整配置。
docker compose config --quiet
# 先拉取当前标签的 API/Web 镜像，拉取成功后再切换运行版本。
docker compose pull api web
# 停止 Web 与 API，阻止它们在受控迁移或版本切换时继续写库。
docker compose stop web api
# 按依赖顺序启动完整服务，等待健康检查或运行状态，最多等 300 秒。
docker compose up -d --wait --wait-timeout 300
# 查看 API 与 Web 最近 100 行日志，确认新版本或回退版本没有启动错误。
docker compose logs --tail=100 api web
```

按第 12 节重新验收 HTTPS、登录、核心读写，并记录回退后的版本。

镜像回退只换程序，不会还原数据库迁移和业务数据。不要盲目恢复整份旧环境文件覆盖新密码；不要把恢复旧数据库作为所有回退的默认步骤。

## 15. 可选：本地终端直接管理云端 Docker

**这一步做什么、为什么做：**了解通过本地 CLI 查看远程 Docker 的可选方式，减少远程路径误解。

**在哪里做：**本地终端。 **完成标志：**可用显式 --context 查看远端状态；主流程仍通过 SSH 执行 Compose。

**开始前准备：**主流程已经上线成功，本机用 SSH 能登录 deployer，服务器该用户有 Docker 权限。`context` 可以理解为给一套 Docker 连接起的名字；`--context my-cloud` 明确指定这次查询发往哪台引擎。第一次上线不需要先配置它。

Docker CLI 支持通过 SSH Context 连接远程引擎，适合查看云端状态。先确认 SSH 可用，服务器用户有 Docker 权限。[Docker 官方 SSH 连接文档](https://docs.docker.com/engine/security/protect-access/)

**本地：**

```bash
# 创建通过 SSH 连接云端 Docker 的命名 Context，替换真实用户与 IP。
docker context create my-cloud --docker host=ssh://deployer@203.0.113.10
# 显式指定远程 Context，查看云端 Docker 引擎信息。
docker --context my-cloud info
# 显式指定远程 Context，列出云端运行中的容器。
docker --context my-cloud ps
# 列出本地配置的 Docker Context，核对默认与远程连接目标。
docker context ls
```

显式 `--context` 可以看清命令发往哪里；不必将全局默认切到正式环境。不要开放未加密的 2375 管理端口。

这里有一个常见误区：**远程 Docker 不会自动读取你电脑上的 bind mount 文件**。Compose 里的 `./deploy/mysql-init` 会对应 Docker 服务器上的路径，Windows 的 `D:/...` 也不会自动变成 Ubuntu 目录。Context 不会复制配置、数据卷或生产密钥，主流程仍建议上传文件后在 SSH 中执行 Compose。[Bind mount 的主机归属](https://docs.docker.com/engine/storage/bind-mounts/)

Docker Desktop 的本地界面也不能假定会因为 CLI Context 切换而成为远程容器面板。用远程 CLI 或 SSH 维护即可；同一套镜像文件并不依赖图形界面存在。

## 16. 两种替代路线：离线传镜像或在服务器构建

**这一步做什么、为什么做：**了解镜像仓库不可用或不使用 Desktop 时的替代路线。

**在哪里做：**按小节分别在本地与服务器执行。 **完成标志：**只在确定需要时选择一条替代路线，保持镜像、配置和数据三者都完整。

### 16.1 不使用镜像仓库：save / load

这是一条替代路线：先用已经学会的 `docker build` 把单平台镜像放在本机，再 `save` 打成归档，经 SCP 传到服务器，最后 `load` 导入服务器 Docker。`save -o` 指定输出归档文件，`load -i` 指定输入文件。它替代镜像仓库的 push/pull，不替代运行文件上传、数据库迁移和证书申请。

第一次按主线成功后，需要离线传输时再选用，不与第 9 节的仓库步骤交叉执行。

以下示例假定目标为 amd64，先在本地构建并加载单平台镜像。多平台发布更适合仓库流程。

**本地项目根目录：**

```bash
# 为 Linux amd64 构建API 镜像并标记本次版本，加载到本地 Docker 供离线导出使用。
docker build --platform linux/amd64 --file server/Dockerfile --tag my-fullstack-api:20261016-1 server
# 为 Linux amd64 构建Web 镜像并标记本次版本，加载到本地 Docker 供离线导出使用。
docker build --platform linux/amd64 --file web/Dockerfile --tag my-fullstack-web:20261016-1 web
# 将指定版本的 API/Web 本地镜像保存为 tar 归档，不包含数据库数据卷。
docker image save -o my-fullstack-images.tar my-fullstack-api:20261016-1 my-fullstack-web:20261016-1
# 将镜像归档从本地复制到云端部署目录。
scp my-fullstack-images.tar deployer@203.0.113.10:/opt/my-fullstack/
```

**服务器：**

```bash
# 进入服务器正式部署目录，让 Compose 读取该目录中的配置。
cd /opt/my-fullstack
# 在云端加载归档中的镜像，使 Compose 可以按本地镜像名使用它们。
docker image load -i my-fullstack-images.tar
```

生产 `.env` 改为 `API_IMAGE=my-fullstack-api`、`WEB_IMAGE=my-fullstack-web` 和匹配的版本，再按第 12 节先启动 db、核对表和数据，最后 `docker compose up -d --wait --wait-timeout 300` 启动应用；首次仍需完成 HTTP 验证、证书申请和 HTTPS 切换。该路线不要对不存在的远程标签执行 `pull`；MySQL、Certbot 等依赖镜像仍须从仓库拉取，完全离线时也要按正确平台一并传输；公开 HTTPS 证书申请仍需能访问证书机构。

使用 `save -o` 避免 PowerShell 对二进制重定向的兼容问题。镜像归档不包含 Compose、`.env` 或数据库卷；数据库仍按第 13 节迁移。[Docker save](https://docs.docker.com/reference/cli/docker/image/save/)、[Docker load](https://docs.docker.com/reference/cli/docker/image/load/)

### 16.2 不使用本地 Desktop：云端构建

也可以把源码、Dockerfile、Compose 和初始化文件通过 Git 放到服务器，在服务器创建正式 `.env`，使用本地镜像名，然后执行：

```bash
# 在服务器上合并运行文件和构建覆盖文件，按源码构建 API/Web 镜像。
docker compose -f compose.yaml -f compose.build.yaml build
# 在云端构建路线中先启动数据库，核对表或迁移后再启动完整应用。
docker compose -f compose.yaml -f compose.build.yaml up -d --wait --wait-timeout 300 db
```

然后按第 12 节核对表/执行迁移，首次使用同样的两份 `-f` 参数启动 HTTP 应用并申请证书。申请成功后生成 `compose.override.yaml`，生产构建和启动要显式列出基础、构建、HTTPS 三份配置；显式 `-f` 时不会自动加载覆盖文件。

**已开启 HTTPS 的服务器，后续构建与启动：**

```bash
# 在服务器按源码重新构建，同时保留生产 HTTPS 覆盖配置。
docker compose -f compose.yaml -f compose.build.yaml -f compose.override.yaml build
# 使用同样三份配置启动发布版本，避免意外退回纯 HTTP 入口。
docker compose -f compose.yaml -f compose.build.yaml -f compose.override.yaml up -d --wait --wait-timeout 300
```

服务器需要 Git 权限、足够内存/磁盘，以及访问依赖源的能力；以后更新使用这三份配置。第 12 节的普通证书和续期命令仍在部署目录执行，会自动加载基础与 HTTPS 配置。该方式省去镜像仓库，但构建会占用生产资源。本地或 CI 构建、服务器只拉镜像，更容易区分构建失败与运行故障。

### 16.3 进阶阅读：同时支持多种 CPU 架构

主线为一种服务器构建一种平台，并明确执行 `docker push`。当一个标签需要同时给 amd64、arm64 两类服务器使用时，还需要构建各平台内容并组合镜像清单。先掌握本教程的单平台链路，再按 [Docker 多平台构建文档](https://docs.docker.com/build/building/multi-platform/)学习；不要把本机可运行当作任意服务器都能运行。

一些进阶示例使用 `docker buildx build --push`：`--push` 的意思是“构建完成后直接上传”，它把主线的构建与上传合成了一条命令。本文主线保留独立的 `docker push`，便于逐步检查每个动作，不要求第一次部署就使用这种合并写法。

## 17. 把教程用于其他技术栈

**这一步做什么、为什么做：**识别其他语言、SSR、云数据库或任务服务需要改哪些部分。

**在哪里做：**阅读后修改自己项目的配置。 **完成标志：**明确替换项，不能把本节概念说明误当作完整可运行配置。

### 17.1 不同运行时

| 项目 | 保留 | 替换 |
| --- | --- | --- |
| Vue/React 静态 SPA | Compose、HTTPS、镜像分发、备份 | 构建变量、命令、产物路径 |
| Next.js / Nuxt SSR | 网络、域名、发布流程 | 前端需运行 Node 服务，页面请求代理到该服务 |
| Python API | Web 入口与数据库拓扑 | Python 基础镜像、依赖锁定、正式 ASGI/WSGI 启动命令 |
| Java / Spring Boot | Compose、卷、证书 | JDK 构建阶段、JRE 运行阶段、jar 入口 |
| Go API | Compose 与发布流程 | 编译阶段、可执行文件、运行镜像和 CA 证书 |
| PostgreSQL | 应用镜像和入口思路 | 镜像/变量、驱动、迁移、pg_dump 和恢复命令 |
| 云数据库 | Web/API 容器 | 删除本地 db 与其 depends_on，用私网地址、访问控制和 TLS |

这些是替换位置，不是可直接运行的其他语言配置；版本、路径和依赖按对应项目核对。

### 17.2 SSR 前端

SSR 需要独立服务，例如 `frontend:3000`；将 HTTP 配置及正式 HTTPS 站点中的页面 `location /` 改为以下内容，保留证书验证、跳转、TLS 和 API 路由：

```nginx
# 将页面请求交给 SSR 服务，而不是查找静态 SPA 文件。
location / {
    # 使用 Docker DNS，并定期刷新 SSR 服务容器地址。
    resolver 127.0.0.11 valid=10s ipv6=off;
    # 保存 SSR 上游地址，支持容器重建后重新解析服务名。
    set $frontend_upstream http://frontend:3000;
    # 保留原始路径和查询参数，将页面请求转给 SSR 服务。
    proxy_pass $frontend_upstream;
    # 使用 HTTP 1.1 与 SSR 服务通信。
    proxy_http_version 1.1;
    # 将原始站点主机名传给 SSR 服务。
    proxy_set_header Host $host;
    # 传递与入口直接连接的客户端地址。
    proxy_set_header X-Real-IP $remote_addr;
    # 追加客户端地址，由 SSR 服务按可信代理配置解释。
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    # 传递外部协议，供 SSR 生成正确的链接和安全 Cookie。
    proxy_set_header X-Forwarded-Proto $scheme;
# 结束 SSR 页面代理配置。
}
```

为 frontend 创建运行镜像和 Compose 服务，配置健康检查及依赖。不要把 SSR 的任意 `.output` 或 dist 当作普通静态目录托管。

### 17.3 用户上传文件、Redis 和任务进程

上传文件放命名卷或对象存储，运行用户须有正确写权限，并纳入备份。数据库里只有文件 URL，不意味着文件已备份。

Redis、队列消费者和定时任务按独立服务定义；需要持久化时配置其自己的卷。恢复数据库期间停止所有可能写库的服务，不只是 API。长任务、WebSocket、大文件上传也要按实际代理、超时与应用限制验证。

### 17.4 不同站点与登录

同源 `/api` 通常最容易开始。拆成不同源后，要同时检查前端 credentials、后端精确 CORS 来源、Cookie 的 SameSite/Secure/Domain/Path，以及浏览器限制。原生 App 不依赖浏览器 CORS，但仍要配置正确的 HTTPS API 地址和认证流程。

## 18. 按链路排查，不要同时改所有配置



**这一步做什么、为什么做：**按请求经过的顺序定位故障，每次只修复有证据的问题。

**在哪里做：**先看日志和状态，再检查 DNS、端口与浏览器。 **完成标志：**找到最先失败的一环，修复后从该环开始重新验收。

下图是检查顺序示意，不是命令。

```text
镜像能否拉取 / 平台是否正确
  → 数据库和业务表是否就绪
  → API 是否返回预期响应
  → Web 代理是否保持正确路径
  → 公网 DNS / HTTP / HTTPS
  → 浏览器登录和业务读写
```

先问“哪一步最先失败”：本地没有镜像就回构建，仓库没有标签就回 push，服务器没有镜像就查 pull；镜像有了但容器未就绪，再查数据库和应用日志。网页能打开却接口失败，就沿 Nginx → API → 数据库继续定位。

`logs` 是应用输出，`ps` 是运行状态；两者需要一起看。不要因为看到 HTTP 400/401 就统一判断为 Docker 故障，先核对该接口在当前请求下本来应该返回什么状态。

| 现象 | 优先原因与操作 |
| --- | --- |
| Desktop Server 不可用 | 启动 Desktop，核对当前 Context |
| Docker permission denied | 核对组权限，重新登录部署账号 |
| pull unauthorized / not found | 镜像全名、标签、仓库权限、云端登录 |
| `exec format error` | 构建架构和服务器不匹配 |
| 初始化一直失败 | db 日志、真实 SQL、密码、数据卷和磁盘 |
| db healthy 但 API 报表不存在 | 连接错库或未执行建表/迁移 |
| API 数据库连接失败 | 主机应是 db 而非 localhost，核对密码与网络 |
| 修改 SQL/初始密码无效 | 非空数据卷不会重新初始化，使用正式 SQL/迁移修改 |
| API unhealthy | 健康路由不存在、需要鉴权或状态码预期不匹配 |
| 502 | API 未启动、监听回环地址、服务名/端口错误 |
| API 返回 HTML | 请求被 SPA fallback 接收，核对 API 路径匹配 |
| API 404 | `/api` 被错误保留、移除或重复添加 |
| 浏览器请求 localhost | 前端构建配置未修改或未重建镜像 |
| 首次证书申请失败 | DNS、AAAA、80 入站、challenge 测试文件及出站网络；先保留纯 HTTP 配置 |
| Nginx 报证书文件不存在 | 是否申请成功，--cert-name 与证书路径是否一致，共享卷是否正确 |
| HTTPS 重建后失效 | 生产 compose.override.yaml 是否仍在，是否显式只写了 -f compose.yaml |
| 证书即将到期或浏览器仍见旧证书 | 检查续期 cron 日志、HTTP 验证入口、nginx -t 和 reload 是否成功 |
| 刷新后退出登录 | Cookie、HTTPS、代理信任和刷新接口 |
| 重启后服务没恢复 | Docker 自启、重启策略，是否主动 stop/down |
| 重建后“空库” | 项目名或卷引用变了，先找原卷 |
| 改 `.env` 不生效 | 用 up 重建相应容器，检查同名 shell 环境变量 |

**服务器常用检查：**

```bash
# 进入服务器正式部署目录，让 Compose 读取该目录中的配置。
cd /opt/my-fullstack
# 列出当前项目容器的运行状态、健康状态和端口映射。
docker compose ps
# 查看数据库、API 和 Web 各自最近 100 行日志，定位启动错误。
docker compose logs --tail=100 db api web
# 查看所有 Docker 数据卷，确认正式数据卷仍存在。
docker volume ls
# 查看镜像、容器、卷和构建缓存占用的磁盘空间。
docker system df
# 查看 Docker 系统服务最近 100 行日志，定位引擎级故障。
sudo journalctl -u docker -n 100 --no-pager
# 查看主机正在监听的 TCP 端口和进程，检查 80/443 是否被占用。
sudo ss -lntp
# 查看服务器磁盘空间，检查数据库或镜像是否因磁盘已满而失败。
df -h
# 查看服务器内存与交换空间，排查内存不足。
free -h
```

日志、`.env`、`docker inspect` 和完整 Compose 展开结果可能含密码或令牌，分享前脱敏。卷清理、删除容器、重装数据库不应作为没有定位原因的第一步。

## 19. 给未来的自己留一份部署记录

**这一步做什么、为什么做：**把一次操作变成下次能复用、换机器能重建的部署记录。

**在哪里做：**你的私有运维记录或项目文档。 **完成标志：**记录版本、域名、卷、备份和验收结果，密钥只记录私有保存位置。

| 项目 | 需要记录的内容 |
| --- | --- |
| 服务器 | 云平台、实例、Ubuntu 版本、CPU 架构、SSH 用户/端口 |
| 域名 | DNS、正式 URL、证书管理方式 |
| 镜像 | 源码提交、应用标签、平台、镜像 digest |
| 运行配置 | 部署目录、Compose 项目名、私有配置保存位置 |
| 数据 | 数据库版本、业务库、迁移版本、真实卷名、上传文件位置 |
| 备份 | 计划、保留周期、异机副本、最近恢复演练结果 |
| 发布 | 当前/上一版本、发布步骤、数据库兼容范围 |
| 验收 | 证书、登录、核心读写、重建与重启检查结果 |

记录里不存明文密钥，标记它们在密码管理器或私有运维存储中的位置。用这份记录，应能在一台新 Ubuntu 服务器重建服务，并找到经过验证的数据恢复入口。
