# 从零使用 Docker 部署全栈项目：Docker Desktop → 镜像仓库 → Ubuntu 云服务器

本文参照[全栈项目部署教程](全栈项目部署教程.md)，将部署方式改为 Docker。适合“项目能在自己电脑运行，希望通过 Docker 把它部署到 Ubuntu 云服务器”的读者，不依赖当前记账仓库。

实操模板采用 **Ubuntu 24.04 LTS 64 位 UEFI 版 + 静态 SPA 前端 + Node.js API + MySQL 8.4 LTS + Nginx 反向代理 + Certbot 管理 HTTPS 证书**。服务器系统的发行代号为 `noble`，24.04.x 维护版本也适用。Vue/React 静态项目可套用；其他语言、SSR、云数据库的替换方法见第 17 节。针对当前仓库的具体路由、密钥、初始化数据和移动端配置，请使用[本项目 Docker 部署指南](本项目Docker部署指南.md)。

本次整理日期：**2026-10-21**；示例发布标签仍用 `20261016-1`。本文是可迁移的教程模板，里面的文件需要你按真实项目创建、适配；本次文档整理没有在服务器执行部署。

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
| 6 | 本地 → 镜像仓库 | 按目标架构构建 API/Web 镜像，推送同一版本标签 | 让服务器取得和本地准备一致的程序发布包 | 两个镜像标签存在，架构正确，记录 digest | 第 9 节 |
| 7 | 云控制台、本地、服务器 | 配置 DNS/安全组，创建部署用户，安装 Engine/Compose | 准备公网入口、SSH 管理通道和容器运行环境 | SSH 可用、Docker 可用；DNS 正确，80/443 允许入站且空闲 | 第 10 节 |
| 8 | 本地 → 服务器 | 上传 Compose/初始化文件，填写独立生产配置 | 告诉服务器运行哪个版本、用哪个域名和密钥 | 服务器文件齐全，`.env` 完成替换且仅部署用户可读 | 第 11 节 |
| 9 | 服务器 → 外部浏览器 | 拉镜像，核对数据库，启动 HTTP；用 Certbot 申请证书，再切换 Nginx HTTPS | 先提供证书验证入口，再启用加密访问并确认业务可用 | HTTPS、登录、核心读写、证书续期、重建/重启验收均通过 | 第 12 节 |
| 10 | 服务器和异机备份位置 | 导出数据库，备份证书与配置，安排备份并练习恢复 | 让数据在误操作或服务器丢失后仍有可恢复副本 | 有可验证备份、异机副本和恢复演练记录 | 第 13 节 |
| 11 | 本地与服务器 | 记录版本、配置位置和发布步骤 | 让下一次发布、回退或换服务器时有据可查 | 部署记录完整，知道如何更新和回退 | 第 14、19 节 |

**第一次部署按第 3～13 节依次操作，再补第 19 节记录。** 第 1～2 节帮助理解；第 14 节留到第二次发布；第 15～17 节是选读替代方案，不要与主线混用；遇到问题再按第 18 节逐层排查。第 7.2 的最小权限、第 7.3 的 ORM 路线、第 13.4 的旧数据迁移，仅在项目需要时采用。

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

## 1. 先理解 Docker 帮你搬走了什么

**这一步做什么、为什么做：**理解程序、镜像、容器、数据库卷各自负责什么，后续就知道该改哪一层。

**在哪里做：**阅读即可。 **完成标志：**能说清代码经镜像发布，业务数据保存在卷里。

传统部署是在服务器分别安装 Node、依赖、进程管理器和数据库；Docker 把各服务需要的程序和运行环境做成镜像，再用容器运行。

下图为部署链路示意，不需要执行。

```text
本地电脑
  源码 + Dockerfile → 镜像 → 推送镜像仓库
                                   │
Ubuntu 服务器                      ▼
  Docker Engine + Compose → 拉取相同镜像 → 启动容器

用户浏览器 → DNS → 云安全组 → Nginx Web 入口 80/443
                             ├─ 静态页面
                             └─ /api → API 容器 → 数据库容器 → 持久卷
Certbot 按需运行 → 通过 HTTP 验证域名 → 证书卷 → Nginx 加载证书
```

| 名词 | 用途 | 不要混淆 |
| --- | --- | --- |
| Docker Desktop | Windows/macOS 的本地开发工具和图形界面 | 云服务器不需要桌面界面 |
| Docker Engine | 构建、运行、管理容器的服务 | Ubuntu 仍需安装它 |
| Dockerfile | 描述某个镜像如何构建 | 通常一个服务一份 |
| 镜像 Image | 程序、依赖和运行环境的发布包 | 不自动包含数据库卷里的数据 |
| 容器 Container | 从镜像创建的运行实例 | 重建后其可写层可能被替换 |
| 镜像仓库 Registry | 保存并分发镜像，如 Docker Hub | 与 Git 源码仓库分工不同 |
| Compose | 用 YAML 定义多个服务的配置、网络、卷 | 它不替你完成 DNS 和云安全组 |
| 命名卷 Volume | 在容器之外保存数据库和上传文件 | 同机持久化不等于异机备份 |
| Bind mount | 把 Docker 主机已有文件挂进容器 | 远程引擎读取的是服务器路径 |
| Tag / digest | 标签便于命名，摘要用于精确标识镜像 | 标签可以被覆盖，摘要不能凭空填写 |

镜像解决“这个程序连同依赖如何一致运行”；域名、HTTPS、生产密钥、数据迁移、备份与业务验收仍要完成。

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

先读取自己的 README、package.json、运行配置和数据库脚本，再修改下面模板。**命令名称相同，不代表启动入口和环境变量一定相同。**

| 项目 | 本文示例假设 | 你要核对什么 |
| --- | --- | --- |
| 前端目录 | `web/` | 源码所在目录 |
| 前端构建 | `npm ci`、`npm run build` | 包管理器、锁文件和实际 scripts |
| 前端产物 | `web/dist/`，静态 SPA | SSR 项目不可照搬静态容器 |
| 前端接口变量 | `VITE_API_BASE_URL=/api` | 源码是否实际读取这个变量 |
| 后端目录 | `server/` | 真实目录 |
| Node 版本 | Node 24.11.0 示例（按项目验证后更新） | engines、原生依赖、项目验证版本 |
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

后文使用的域名 `app.example.com`、IP `203.0.113.10`、镜像用户 `yourname` 都是示例，必须替换。

## 4. 本地安装 Docker Desktop 并核对平台

**这一步做什么、为什么做：**准备本地构建和预演工具，并确定要给哪种 CPU 架构生成镜像。

**在哪里做：**Docker Desktop 在本地安装；架构命令在服务器执行。 **完成标志：**Docker Client/Server 可连接、系统为 Linux，并记录目标架构。

### 4.1 Windows

按 [Windows 官方安装说明](https://docs.docker.com/desktop/setup/install/windows-install/)核对系统版本、硬件虚拟化和 WSL 2。需要安装 WSL 时，在管理员 PowerShell 执行 `wsl --install`，按提示重启，再安装并启动 Docker Desktop，选择 Linux containers。

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

## 5. 创建两个镜像：前端与 API 分开打包

**这一步做什么、为什么做：**把前后端源码分别打包，给前端加入静态托管和 API 代理入口。

**在哪里做：**本地项目目录，创建本节注明的文件。 **完成标志：**两个 Dockerfile、两份忽略规则、Nginx HTTP/HTTPS 配置均已按真实项目适配。

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

### 5.1 Node.js API Dockerfile

**本地新建 `server/Dockerfile`：**

```dockerfile
# 使用固定 Node 24.11.0 的 Debian 精简镜像，开始构建阶段，安装依赖并编译源码。
FROM node:24.11.0-bookworm-slim AS build
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

# 使用固定 Node 24.11.0 的 Debian 精简镜像，开始正式运行阶段，和构建阶段保持相同 Node 版本。
FROM node:24.11.0-bookworm-slim AS runtime
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

- Node 版本遵循自己的项目。`24.11.0-bookworm-slim` 在本教程用于演示固定版本，构建/运行阶段保持一致；它不是“当前最新版本”的承诺。正式发布应选经过兼容和安全验证的版本，必要时记录并固定 digest，按计划升级。
- 若项目有运行时模板、Prisma 生成物、静态资源、迁移文件等，按需要额外 COPY；不能假定只有 dist 和 node_modules 就足够。
- 若是 monorepo/workspace，锁文件和公共包通常在仓库根目录，需要调整构建上下文和 COPY 路径。
- 若是纯 JavaScript API，没有 build 脚本，改为复制真实入口和必要源码，不能照搬 `npm run build`。
- 项目用 pnpm/yarn 时使用对应锁文件与安装方式，不能强行改用 npm。

运行阶段用普通 `node` 用户，直接启动正式入口；不需要在容器里再套一层 PM2。后端必须接受来自其他容器的连接，不能仅绑定 `127.0.0.1`。

### 5.2 静态 SPA 前端 Dockerfile

**本地新建 `web/Dockerfile`：**

```dockerfile
# 使用固定 Node 24.11.0 的 Debian 精简镜像，开始构建阶段，安装依赖并编译源码。
FROM node:24.11.0-bookworm-slim AS build
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

### 5.5 提前准备正式 HTTPS 配置，申请证书后再启用

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

| 位置 | 作用 |
| --- | --- |
| Compose 的 `.env` / `--env-file` | 给 YAML 中 `${变量}` 提供插值 |
| 服务的 `environment` / `env_file` | 将变量传进容器，供程序读取 |
| Dockerfile 的构建变量 | 构建镜像时生效；前端静态配置常在这一阶段使用 |

本文采用 `.env` 插值后通过 `environment` 显式注入，没有自动挂载后端环境文件。若应用强制读取某个文件，需按真实加载方式改造或只读挂载，不能把秘密 COPY 进镜像。[Compose 插值文档](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)

`$${MYSQL_PASSWORD}` 中 `$$` 保留给容器内 shell；若只写 `${MYSQL_PASSWORD}`，Compose 会在启动前尝试从自己的环境展开。当前终端的同名环境变量也可能覆盖文件值，排查配置时要一起核对。

### 6.4 本地构建覆盖文件 `compose.build.yaml`

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

## 8. 本地预演：先确认这一套配置能启动

**这一步做什么、为什么做：**在自己的电脑跑通完整容器链路，提前发现路径、变量、连接和构建问题。

**在哪里做：**本地项目根目录，Docker Desktop 必须运行。 **完成标志：**本地页面、健康接口和核心读写通过；正式 HTTPS 留到云端验收。

**本地 Windows：**

```powershell
# 从无密钥模板复制出本地私有配置文件；随后填写本地专用密钥。
Copy-Item .env.example .env.local
```

Mac 用 `cp .env.example .env.local`。填写本地专用密钥，再改这些值：

```dotenv
# 设置 Compose 项目名，决定容器/网络/卷的命名前缀；本地与正式必须区分，正式后续保持稳定。
COMPOSE_PROJECT_NAME=my-fullstack-local
# 设置后端镜像仓库名；Compose 会在其后拼接 APP_VERSION 标签。
API_IMAGE=my-fullstack-api
# 设置前端镜像仓库名；须与实际构建、推送或加载的名称一致。
WEB_IMAGE=my-fullstack-web
# 指定本次 API/Web 的共同镜像标签；每次发布改成已存在的新标签。
APP_VERSION=local
# 设置完整前端来源（协议加域名和必要端口），供后端来源/CORS 等实际逻辑使用。
FRONTEND_ORIGIN=http://localhost:8080
# 设置 Web 发布端口绑定的宿主机地址；本地 127.0.0.1 仅本机，正式 0.0.0.0 接受 IPv4 外部连接。
BIND_ADDRESS=127.0.0.1
# 设置宿主机 HTTP 端口；本地示例用 8080，正式用 80。
HTTP_PORT=8080
# 设置宿主机 HTTPS 端口；正式用 443，本地 HTTP 测试不会使用此端口。
HTTPS_PORT=8443
```

**本地仓库根目录，每条分别执行：**

```bash
# 用本地环境文件合并运行与构建配置，只检查语法和变量，不输出密钥。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml config --quiet
# 用本地配置构建 API/Web 镜像，检查依赖安装和编译能否完成。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml build
# 用本地专用项目名在后台启动整套服务，最多等待 300 秒直至就绪。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml up -d --wait --wait-timeout 300
# 查看本地项目中各容器的状态与端口，确认依赖健康。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml ps
# 查看本地各服务最近 100 行日志，定位初始化、连接或代理错误。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml logs --tail=100 db api web
```

`config --quiet` 检查 Compose 结构与插值；没有 `--quiet` 的完整输出可能含密钥。`--wait` 等待有健康检查的服务 healthy、其余服务 running，仍须实际验收页面和接口。

**本地 Windows：**

```powershell
# 检查本地 Web 是否返回 HTTP 响应头。
curl.exe -I http://localhost:8080
# 经过本地 Web 代理请求健康接口，检查状态码与响应内容。
curl.exe -i http://localhost:8080/api/health
```

Mac 使用 `curl`。按本文前提，均应成功；随后打开网页，检查接口、页面路由刷新、登录和最基本的读写。

若生产 Cookie 强制 Secure，本地 HTTP 只能覆盖部分验收，最终需正式 HTTPS 复测，不要为了让本地测试通过而关闭生产 Cookie 安全属性。

Docker Desktop 的 Containers 页面可查看服务、日志和运行状态，Images 页面可查看镜像。配置仍以文件为准，界面操作后也应能用相同 Compose 重建环境。

完成本地预演后：

```bash
# 停止并移除本地项目容器及网络，默认保留命名卷中的数据库数据。
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml down
```

默认保留命名卷；`down -v` 会删除相关卷。首次启动失败后不要随意用删卷作为重试手段。

## 9. 将镜像发布到镜像仓库

**这一步做什么、为什么做：**将已验证的程序发布成服务器能拉取的镜像。

**在哪里做：**本地项目根目录和镜像仓库网站。 **完成标志：**API/Web 同一版本的镜像已推送，平台与服务器匹配。

### 9.1 创建仓库并登录

以 Docker Hub 为例，创建 `my-fullstack-api` 和 `my-fullstack-web` 两个镜像仓库；需要保密的应用使用私有仓库。下方 `yourname` 全部替换成自己的用户名。

**本地：**

```bash
# 按提示登录镜像仓库；输入访问令牌时不要将其写进命令或文档。
docker login
```

使用访问令牌登录，按提示输入；不要把令牌放在 Dockerfile、脚本正文或 Git 中。云服务器若要拉私有镜像，也须在部署账号下登录，最好使用仅能拉取的凭据。

### 9.2 按目标架构构建并推送

**本地仓库根目录，假设云服务器为 amd64：**

```bash
# 为 Linux amd64 构建API 镜像并标记本次版本，直接推送镜像仓库供服务器拉取。
docker buildx build --platform linux/amd64 -f server/Dockerfile -t yourname/my-fullstack-api:20261016-1 --push server
# 为 Linux amd64 构建Web 镜像并标记本次版本，直接推送镜像仓库供服务器拉取。
docker buildx build --platform linux/amd64 -f web/Dockerfile -t yourname/my-fullstack-web:20261016-1 --push web
# 检查仓库中的API镜像标签、digest 和平台，确认目标架构已发布。
docker buildx imagetools inspect yourname/my-fullstack-api:20261016-1
# 检查仓库中的Web镜像标签、digest 和平台，确认目标架构已发布。
docker buildx imagetools inspect yourname/my-fullstack-web:20261016-1
```

arm64 服务器改为 `linux/arm64`。需要两种架构时，构建参数改为 `--platform linux/amd64,linux/arm64` 并推送；跨架构模拟可能更慢，依赖问题应在构建阶段修复。

每次使用新版本标签，例如日期加序号或 Git 提交 ID，避免覆盖正在使用的发布标签。记录应用源码提交、镜像标签、平台和 digest。基础镜像也应测试后固定，按计划升级。

## 10. 准备 Ubuntu：域名、SSH、Engine 和防火墙

**这一步做什么、为什么做：**给容器准备可登录、可运行、能被域名找到的 Ubuntu 环境。

**在哪里做：**云控制台配置 DNS/安全组；本地执行 SSH；其余命令在服务器执行。 **完成标志：**部署用户可登录，Docker/Compose 可用，DNS 与 80/443 入口条件满足。

### 10.1 域名与安全组

创建 Ubuntu 24.04 LTS 64 位 UEFI 版云服务器，在云平台镜像选项中确认版本、系统位数和启动方式，记录公网 IP、登录用户、SSH 端口和私钥位置。在域名 DNS 管理页面为 `app.example.com` 添加 A 记录，记录值填写服务器公网 IPv4（例如域名前缀填写 `app`）；等待公共解析生效。不用 IPv6 时删除错误的 AAAA 记录。本文端口发布使用 IPv4；若同时使用 IPv6，必须另行验证 IPv6 的 Docker 端口绑定和入站规则。

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

### 10.2 创建部署用户

**服务器管理员：**

```bash
# 刷新软件包索引；此处提前安装编辑器，避免下一步编辑公钥时没有 nano。
sudo apt update
# 安装后面编辑 authorized_keys 所需的 nano。
sudo apt install -y nano
# 创建日常部署使用的 deployer 用户，按提示设置其登录资料。
sudo adduser deployer
# 允许部署用户在需要时使用 sudo 管理服务器。
sudo usermod -aG sudo deployer
# 创建正式运行目录，归属部署用户，限制其他用户访问。
sudo install -d -o deployer -g deployer -m 750 /opt/my-fullstack
# 创建部署用户的 SSH 配置目录，仅本人可访问。
sudo install -d -o deployer -g deployer -m 700 /home/deployer/.ssh
# 以部署用户身份编辑授权公钥文件，保留已有公钥并添加自己的公钥。
sudo -u deployer nano /home/deployer/.ssh/authorized_keys
# 确保授权公钥文件属于部署用户。
sudo chown deployer:deployer /home/deployer/.ssh/authorized_keys
# 限制授权公钥文件只能由部署用户读取与修改。
sudo chmod 600 /home/deployer/.ssh/authorized_keys
```

先确认本地有 SSH 密钥。Windows 的默认公钥一般在 `$HOME/.ssh/id_ed25519.pub`；如果没有，可在**本地 PowerShell**生成，再查看公钥：

```powershell
# 在本地生成 Ed25519 SSH 密钥对；按提示操作，不能覆盖仍在使用的密钥。
ssh-keygen -t ed25519
# 显示本地默认 SSH 公钥，复制其内容到服务器 authorized_keys。
Get-Content "$HOME/.ssh/id_ed25519.pub"
```

生成时沿用默认路径前先确认不会覆盖已有密钥，按提示设置私钥口令；如已有可用密钥直接查看对应 `.pub`。编辑服务器的 authorized_keys 时，粘贴自己电脑上的 SSH **公钥**，一行一把，不是私钥。已有用户和公钥文件时保留原内容。nano 保存方法：`Ctrl+O`、回车、`Ctrl+X`。新窗口确认 `ssh deployer@真实IP` 成功，再继续使用 deployer 部署。

本文后续 SSH/SCP 示例默认使用 22 端口和 SSH 默认密钥。如果你的云服务器要求自定义端口或密钥，**所有登录和上传命令**都要使用相同真实值。区别是 SSH 的端口选项是小写 `-p`，SCP 是大写 `-P`；`-i` 两者都用于指定本地私钥：

```powershell
# 用指定本地私钥和真实 SSH 端口登录部署用户；2222 与私钥路径都只是示例。
ssh -p 2222 -i "$HOME/.ssh/id_ed25519" deployer@203.0.113.10
# 使用相同端口与私钥上传文件；scp 的端口选项必须用大写 -P。
scp -P 2222 -i "$HOME/.ssh/id_ed25519" compose.yaml deployer@203.0.113.10:/opt/my-fullstack/
```

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

### 10.4 防火墙与端口冲突

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

## 11. 上传运行文件，填写生产环境

**这一步做什么、为什么做：**把运行说明和初始化文件传到服务器，并配置真实的域名、镜像版本和独立密钥。

**在哪里做：**scp 在本地执行；创建目录、编辑 .env 在服务器执行。 **完成标志：**服务器 /opt/my-fullstack 文件齐全，生产 .env 已替换全部占位符。

**服务器 deployer：**

```bash
# 创建服务器上的配置父目录，供后续上传数据库初始化和 Nginx 配置使用。
mkdir -p /opt/my-fullstack/deploy
```

**本地项目根目录，Windows/Mac 均可：**

```bash
# 把基础运行文件、HTTPS 覆盖模板和无密钥环境模板上传到服务器。
scp compose.yaml compose.https.yaml .env.example deployer@203.0.113.10:/opt/my-fullstack/
# 递归上传已审核的数据库初始化目录，保持服务器上的挂载路径一致。
scp -r deploy/mysql-init deployer@203.0.113.10:/opt/my-fullstack/deploy/
# 上传已将域名替换正确的正式 Nginx HTTPS 配置目录。
scp -r deploy/nginx deployer@203.0.113.10:/opt/my-fullstack/deploy/
```

服务器应得到 `/opt/my-fullstack/deploy/mysql-init/01-schema.sql`、`/opt/my-fullstack/deploy/nginx/https.conf` 及两份 Compose 文件。镜像路线不需要上传前后端源码、node_modules 或本地构建目录；纯 HTTP Nginx 配置已经包含在 Web 镜像中。

**服务器：**

```bash
# 进入服务器正式部署目录，让 Compose 读取该目录中的配置。
cd /opt/my-fullstack
# 让本终端随后创建的文件默认仅当前用户可访问，保护配置与备份。
umask 077
# 从无密钥模板创建正式私有配置；只在首次配置且 .env 尚不存在时执行。
cp .env.example .env
# 限制生产配置仅部署用户可读写，保护其中的密码和令牌。
chmod 600 .env
# 编辑生产环境配置，按当前步骤填写真实值或切换发布标签。
nano .env
```

填写正式独立密码和应用密钥、真实镜像仓库名/版本，确认下面的来源与端口；正式域名还须填入 `deploy/nginx/https.conf`，邮箱在第 12 节证书申请命令中填写：

```dotenv
# 设置 Compose 项目名，决定容器/网络/卷的命名前缀；本地与正式必须区分，正式后续保持稳定。
COMPOSE_PROJECT_NAME=my-fullstack
# 设置完整前端来源（协议加域名和必要端口），供后端来源/CORS 等实际逻辑使用。
FRONTEND_ORIGIN=https://app.example.com
# 设置 Web 发布端口绑定的宿主机地址；本地 127.0.0.1 仅本机，正式 0.0.0.0 接受 IPv4 外部连接。
BIND_ADDRESS=0.0.0.0
# 设置宿主机 HTTP 端口；本地示例用 8080，正式用 80。
HTTP_PORT=80
# 设置宿主机 HTTPS 端口；正式用 443，本地 HTTP 测试不会使用此端口。
HTTPS_PORT=443
```

不要上传 `.env.local` 当作生产配置。环境变量不会因为有变量名就自动生效，必须能从 Compose 注入到应用实际读取的位置。

私有镜像需要先在**服务器 deployer 用户**下执行：

```bash
# 按提示登录镜像仓库；输入访问令牌时不要将其写进命令或文档。
docker login
```

使用仅能拉取的凭据，按提示输入；公有镜像按仓库访问规则拉取。云端网络无法访问某仓库时，选择自己可访问的合规镜像仓库，修改完整镜像地址；不要从不明来源粘贴任意镜像加速配置。

## 12. 首次启动和上线验收

**这一步做什么、为什么做：**按数据库 → API → Nginx HTTP → 申请证书 → Nginx HTTPS 的顺序上线，确认加密访问与真实业务都可用，并建立证书续期任务。

**在哪里做：**启动命令在服务器 /opt/my-fullstack；公网验收从本地或外部网络发起。 **完成标志：**表结构、健康接口、HTTPS、登录读写、证书续期演练、数据持久化与重启恢复均验收通过。

### 12.1 拉取镜像，先用 HTTP 启动

**服务器 `/opt/my-fullstack`：**

```bash
# 校验 Compose 结构与变量插值，不输出可能包含密码的完整配置。
docker compose config --quiet
# 检查主线建表 SQL 存在且非空；若失败，先补齐文件再继续。
test -s deploy/mysql-init/01-schema.sql
# 按当前配置拉取数据库、API 与 Web 镜像，不启动服务。
docker compose pull
# 仅在后台启动数据库并最多等 300 秒，先完成初始化或迁移。
docker compose up -d --wait --wait-timeout 300 db
# 查看数据库最近 100 行日志，确认初始化没有报错。
docker compose logs --tail=100 db
```

上面只启动了数据库。`test -s` 用于检查主线的建表 SQL 存在且非空，检查不通过就先补文件；不要继续启动应用。若采用第 7.3 节 migration 路线，先移除初始化目录挂载，跳过这条 SQL 文件检查，启动 db 后执行真实迁移，再继续下面的表结构检查。模板健康检查假设 `/api/health` 返回 200；报错应先查接口、配置和依赖，不要为了显示 healthy 而改成永远成功。

核对业务表：

```bash
# 使用业务账号查询当前业务库表名，核对真实建表或迁移结果。
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -u"$MYSQL_USER" "$MYSQL_DATABASE" -e "SHOW TABLES;"'
# 列出当前正式 Compose 项目的数据卷，记录真实卷名。
docker volume ls --filter label=com.docker.compose.project=my-fullstack
```

确认表名、关键字段、基础数据或 migration 版本与项目要求一致后，再启动应用。**首次启动时部署目录里应只有 `compose.https.yaml` 模板，尚未创建 `compose.override.yaml`，所以 Nginx 此时只监听 HTTP。**

```bash
# 按依赖顺序启动完整服务，等待健康检查或运行状态，最多等 300 秒。
docker compose up -d --wait --wait-timeout 300
# 列出当前项目容器的运行状态、健康状态和端口映射。
docker compose ps
# 查看数据库、API 和 Web 各自最近 100 行日志，定位启动错误。
docker compose logs --tail=100 db api web
# 校验运行中的纯 HTTP Nginx 配置，确认没有语法或依赖文件错误。
docker compose exec -T web nginx -t
```

**如果要迁移已有真实数据，先按第 13.4 节导入并核对，再运行上面的 API/Web 启动命令。** 数据库健康只证明连接可用，不能替代业务表和数据检查。`db_data` 实际卷名通常带项目名前缀，例如 `my-fullstack_db_data`。正式项目名后续保持稳定，避免误连到另一组新卷。

### 12.2 验证 HTTP 入口，申请证书，再启用 HTTPS

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

**服务器 `/opt/my-fullstack`：**

```bash
# 申请真实域名证书；替换两处域名及真实邮箱，证书名称决定后续文件路径。
docker compose run --rm certbot certonly --webroot -w /var/www/certbot --cert-name app.example.com -d app.example.com --email your-email@example.com --agree-tos --non-interactive
```

看到证书成功保存的信息后再继续。证书、私钥、账户及续期配置保存在 `certbot_conf` 卷里；HTTPS 配置的 `/etc/letsencrypt/live/app.example.com/` 必须与这里的 `--cert-name` 一致。失败时按 DNS、AAAA、80 入站、验证文件、出站网络顺序排查，不能先启用没有证书的 HTTPS 配置。

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

### 13.2 创建 MySQL 备份脚本

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

```cron
# 每天按服务器时区 03:30 执行备份，将标准输出与错误追加到日志。
30 3 * * * /home/deployer/bin/backup-my-fullstack >> /home/deployer/my-fullstack-backups/backup.log 2>&1
```

这是**服务器时区**每天 03:30，不一定是本地电脑时间。检查 `timedatectl`，按业务统一时区；另设备份保留周期、异机副本和失败告警，定期检查容量。

### 13.3 在隔离数据库恢复演练

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

假设已在本地准备并验证了 `business.sql`（只包含所需业务库，且库名已核对），示例传输与导入如下；此处导入的是正式库，必须先确认旧、新系统及所有任务都已停止写入。

**本地，SQL 所在目录：**

```bash
# 将已审核、试导入的业务 SQL 从本地传到正式服务器。
scp business.sql deployer@203.0.113.10:/opt/my-fullstack/business.sql
```

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

### 14.1 一次普通发布

1. 本地/CI 完成项目已有测试与构建检查，为目标架构构建新镜像。Dockerfile 已在镜像内执行 build；如果另外在宿主机运行 npm 测试/检查命令，宿主机也要有项目要求的 Node 和依赖，或将这些检查放在已配好环境的 CI/构建容器中运行。
2. 推送新标签，确认仓库中 API/Web 版本与平台完整。
3. 记录旧版本，阅读配置与迁移变化，备份数据库及必要文件。

**服务器：**

```bash
# 进入服务器正式部署目录，让 Compose 读取该目录中的配置。
cd /opt/my-fullstack
# 让本终端随后创建的文件默认仅当前用户可访问，保护配置与备份。
umask 077
# 按当前时间备份发布前的环境配置，便于核对旧标签与配置变更。
cp .env ".env.before-$(date +%Y%m%d_%H%M%S)"
# 立即执行一次数据库备份；首次上线或每次切换前先确认它成功。
~/bin/backup-my-fullstack
# 编辑生产环境配置，按当前步骤填写真实值或切换发布标签。
nano .env
```

把 `APP_VERSION` 改成已推送的新标签，补齐必要配置，再执行：

```bash
# 校验 Compose 结构与变量插值，不输出可能包含密码的完整配置。
docker compose config --quiet
# 先拉取当前标签的 API/Web 镜像，拉取成功后再切换运行版本。
docker compose pull api web
# 停止 Web 与 API，阻止它们在受控迁移或版本切换时继续写库。
docker compose stop web api
```

如版本需要数据库迁移，此时执行**实际项目配套命令/SQL**；先核对兼容性，不能重复执行初始建表脚本冒充升级。迁移完成后：

```bash
# 按依赖顺序启动完整服务，等待健康检查或运行状态，最多等 300 秒。
docker compose up -d --wait --wait-timeout 300
# 查看 API 与 Web 最近 100 行日志，确认新版本或回退版本没有启动错误。
docker compose logs --tail=100 api web
```

完成公网接口、登录及核心业务验收。这个流程会短暂停机；零中断发布还需多实例、流量切换和数据库向前/向后兼容设计。

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

### 14.3 应用回退

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

以下示例假定目标为 amd64，先在本地构建并加载单平台镜像。多平台发布更适合仓库流程。

**本地项目根目录：**

```bash
# 为 Linux amd64 构建API 镜像并标记本次版本，加载到本地 Docker 供离线导出使用。
docker buildx build --platform linux/amd64 -f server/Dockerfile -t my-fullstack-api:20261016-1 --load server
# 为 Linux amd64 构建Web 镜像并标记本次版本，加载到本地 Docker 供离线导出使用。
docker buildx build --platform linux/amd64 -f web/Dockerfile -t my-fullstack-web:20261016-1 --load web
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
