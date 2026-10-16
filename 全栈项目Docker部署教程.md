# 从零使用 Docker 部署全栈项目：Docker Desktop → 镜像仓库 → Ubuntu 云服务器

本文参照[全栈项目部署教程](全栈项目部署教程.md)，将部署方式改为 Docker。适合“项目能在自己电脑运行，希望通过 Docker 把它部署到 Ubuntu 云服务器”的读者，不依赖当前记账仓库。

实操模板采用 **Ubuntu 24.04 LTS + 静态 SPA 前端 + Node.js API + MySQL 8.4 LTS + Caddy 自动 HTTPS**。Vue/React 静态项目可套用；其他语言、SSR、云数据库的替换方法见第 17 节。针对当前仓库的具体路由、密钥、初始化数据和移动端配置，请使用[本项目 Docker 部署指南](本项目Docker部署指南.md)。

核对日期：**2026-10-16**。本文给出需要自行创建和适配的配置模板，没有在你的真实服务器执行部署。标有“本地”的命令在电脑执行，标有“服务器”的命令在 SSH 登录后的 Ubuntu 执行；不要把 Bash 的反斜杠续行直接粘到 PowerShell。

## 1. 先理解 Docker 帮你搬走了什么

传统部署是在服务器分别安装 Node、依赖、进程管理器和数据库；Docker 把各服务需要的程序和运行环境做成镜像，再用容器运行。

```text
本地电脑
  源码 + Dockerfile → 镜像 → 推送镜像仓库
                                   │
Ubuntu 服务器                      ▼
  Docker Engine + Compose → 拉取相同镜像 → 启动容器

用户浏览器 → DNS → 云安全组 → Web 入口 80/443
                             ├─ 静态页面
                             └─ /api → API 容器 → 数据库容器 → 持久卷
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

先读取自己的 README、package.json、运行配置和数据库脚本，再修改下面模板。**命令名称相同，不代表启动入口和环境变量一定相同。**

| 项目 | 本文示例假设 | 你要核对什么 |
| --- | --- | --- |
| 前端目录 | `web/` | 源码所在目录 |
| 前端构建 | `npm ci`、`npm run build` | 包管理器、锁文件和实际 scripts |
| 前端产物 | `web/dist/`，静态 SPA | SSR 项目不可照搬静态容器 |
| 前端接口变量 | `VITE_API_BASE_URL=/api` | 源码是否实际读取这个变量 |
| 后端目录 | `server/` | 真实目录 |
| Node 版本 | Node 24 系列示例 | engines、原生依赖、项目验证版本 |
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
Get-Content web/package.json
Get-Content server/package.json
```

本文的 `/api/health` 是教学前提，不是 Node/Nest/Express 自动提供的接口。没有时先实现合适的健康检查，或把模板改为真实存在、预期状态明确的接口；不能机械要求所有项目返回 200。

后文使用的域名 `app.example.com`、IP `203.0.113.10`、镜像用户 `yourname` 都是示例，必须替换。

## 4. 本地安装 Docker Desktop 并核对平台

### 4.1 Windows

按 [Windows 官方安装说明](https://docs.docker.com/desktop/setup/install/windows-install/)核对系统版本、硬件虚拟化和 WSL 2。需要安装 WSL 时，在管理员 PowerShell 执行 `wsl --install`，按提示重启，再安装并启动 Docker Desktop，选择 Linux containers。

**本地 PowerShell：**

```powershell
wsl --status
docker version
docker compose version
docker buildx version
docker info --format '{{.OSType}}'
```

### 4.2 Mac

按 [Mac 官方安装说明](https://docs.docker.com/desktop/setup/install/mac-install/)选择 Apple Silicon 或 Intel 版本，安装并启动。终端运行相同的 `docker` 检查命令。

应看到可用的 Client 和 Server，操作系统是 `linux`。Server 连不上时，先处理 Desktop 启动问题。

### 4.3 确认云服务器 CPU 架构

**服务器：**

```bash
uname -m
```

`x86_64` 对应 `linux/amd64`，`aarch64` 对应 `linux/arm64`。Apple Silicon 本地可能是 arm64，而云端是 amd64；第 9 节会显式指定构建平台。[Docker 多平台构建](https://docs.docker.com/build/building/multi-platform/)

## 5. 创建两个镜像：前端与 API 分开打包

示例目录：

```text
my-fullstack/
├── web/
│   ├── Dockerfile
│   ├── .dockerignore
│   └── Caddyfile
├── server/
│   ├── Dockerfile
│   └── .dockerignore
├── deploy/mysql-init/
│   └── 01-schema.sql         # 你的真实建表脚本
├── compose.yaml
├── compose.build.yaml
├── .env.example             # 可以提交的无密钥模板
└── .env.local               # 本地私有文件
```

### 5.1 Node.js API Dockerfile

**本地新建 `server/Dockerfile`：**

```dockerfile
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production TZ=Etc/UTC
WORKDIR /app
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

需要适配的地方：

- Node 版本遵循自己的项目。`24-bookworm-slim` 会更新；正式发布前固定为经过验证的精确版本或 digest，构建/运行阶段用同一版本。
- 若项目有运行时模板、Prisma 生成物、静态资源、迁移文件等，按需要额外 COPY；不能假定只有 dist 和 node_modules 就足够。
- 若是 monorepo/workspace，锁文件和公共包通常在仓库根目录，需要调整构建上下文和 COPY 路径。
- 若是纯 JavaScript API，没有 build 脚本，改为复制真实入口和必要源码，不能照搬 `npm run build`。
- 项目用 pnpm/yarn 时使用对应锁文件与安装方式，不能强行改用 npm。

运行阶段用普通 `node` 用户，直接启动正式入口；不需要在容器里再套一层 PM2。后端必须接受来自其他容器的连接，不能仅绑定 `127.0.0.1`。

### 5.2 静态 SPA 前端 Dockerfile

**本地新建 `web/Dockerfile`：**

```dockerfile
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
ENV VITE_API_BASE_URL=/api
RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
```

此处假定源码使用 `import.meta.env.VITE_API_BASE_URL`。React 或其他构建器的变量名可能不同，必须修改。Vite 静态变量在构建时写入 JS，运行容器时设置同名变量不会重写浏览器代码。

使用相对 `/api` 后，同一 Web 镜像可用于本地与正式域名。数据库密码、JWT 密钥和 SMTP 凭据绝不能放进前端构建变量。

### 5.3 两个目录分别创建 `.dockerignore`

在 `web/.dockerignore`、`server/.dockerignore` 写入：

```text
node_modules
dist
coverage
.git
.env
.env.*
*.log
*.tsbuildinfo
```

不要把 Windows/macOS 安装的 node_modules 复制进 Linux 镜像；容器构建时按锁文件安装。`.dockerignore` 管构建上下文，`.gitignore` 管 Git 提交，两者都需要。

在仓库 `.gitignore` 至少增加：

```gitignore
.env
.env.*
!.env.example
```

### 5.4 用 Caddy 提供页面、代理和 HTTPS

**本地新建 `web/Caddyfile`：**

```caddyfile
{
    email {$ACME_EMAIL}
}

{$SITE_ADDRESS} {
    encode zstd gzip

    @api path /api /api/*
    handle @api {
        reverse_proxy api:3000
    }

    handle {
        root * /srv
        try_files {path} /index.html
        file_server
    }
}
```

本地 `SITE_ADDRESS=:80` 提供 HTTP；云端填写 `app.example.com` 后自动管理证书。域名正确解析、验证端口可达以及证书数据持久化是必要条件。[Caddy 自动 HTTPS](https://caddyserver.com/docs/automatic-https)

**先确定前缀：** 上例保留 `/api`，适合后端真实路径就是 `/api/...` 的项目。如果后端只有 `/health`、`/auth/login`，需明确改为去掉 `/api` 的代理方案，例如 `handle_path /api/*`；同时检查 Cookie Path、重定向和生成链接是否需要调整，不能仅凭页面能打开就完成替换。[Caddy handle 说明](https://caddyserver.com/docs/caddyfile/directives/handle)

## 6. Compose：定义服务、配置、网络和数据

### 6.1 运行文件 `compose.yaml`

```yaml
services:
  db:
    image: ${MYSQL_IMAGE:-mysql:8.4}
    restart: unless-stopped
    environment:
      TZ: Etc/UTC
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:?请设置管理员密码}
      MYSQL_DATABASE: my_fullstack
      MYSQL_USER: app_user
      MYSQL_PASSWORD: ${DB_PASSWORD:?请设置业务密码}
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
      - --default-time-zone=+00:00
    volumes:
      - db_data:/var/lib/mysql
      - ./deploy/mysql-init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test:
        - CMD-SHELL
        - >-
          MYSQL_PWD="$${MYSQL_PASSWORD}" mysql --protocol=TCP
          -h 127.0.0.1 -u"$${MYSQL_USER}" "$${MYSQL_DATABASE}"
          -e 'SELECT 1' >/dev/null 2>&1
      interval: 10s
      timeout: 5s
      retries: 18
      start_period: 60s
    logging:
      driver: local
      options:
        max-size: "10m"
        max-file: "3"

  api:
    image: ${API_IMAGE:?请设置API镜像}:${APP_VERSION:?请设置版本}
    restart: unless-stopped
    init: true
    environment:
      NODE_ENV: production
      TZ: Etc/UTC
      PORT: "3000"
      DB_HOST: db
      DB_PORT: "3306"
      DB_USER: app_user
      DB_PASSWORD: ${DB_PASSWORD:?请设置业务密码}
      DB_DATABASE: my_fullstack
      JWT_SECRET: ${JWT_SECRET:?请设置应用密钥}
      FRONTEND_ORIGIN: ${FRONTEND_ORIGIN:?请设置前端来源}
      HEALTH_PATH: /api/health
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test:
        - CMD
        - node
        - -e
        - "fetch('http://127.0.0.1:3000'+process.env.HEALTH_PATH).then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 40s
    logging:
      driver: local
      options:
        max-size: "10m"
        max-file: "3"

  web:
    image: ${WEB_IMAGE:?请设置Web镜像}:${APP_VERSION:?请设置版本}
    restart: unless-stopped
    environment:
      SITE_ADDRESS: ${SITE_ADDRESS:?请设置站点地址}
      ACME_EMAIL: ${ACME_EMAIL:?请设置证书联系邮箱}
    ports:
      - "${BIND_ADDRESS:-127.0.0.1}:${HTTP_PORT:-8080}:80"
      - "${BIND_ADDRESS:-127.0.0.1}:${HTTPS_PORT:-8443}:443"
    volumes:
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      api:
        condition: service_healthy
    logging:
      driver: local
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  db_data:
  caddy_data:
  caddy_config:
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
services:
  api:
    build:
      context: ./server
      dockerfile: Dockerfile
  web:
    build:
      context: ./web
      dockerfile: Dockerfile
```

### 6.5 创建 `.env.example`

```dotenv
COMPOSE_PROJECT_NAME=my-fullstack
API_IMAGE=yourname/my-fullstack-api
WEB_IMAGE=yourname/my-fullstack-web
APP_VERSION=20261016-1
MYSQL_IMAGE=mysql:8.4

SITE_ADDRESS=app.example.com
ACME_EMAIL=你的证书联系邮箱
FRONTEND_ORIGIN=https://app.example.com
BIND_ADDRESS=0.0.0.0
HTTP_PORT=80
HTTPS_PORT=443

MYSQL_ROOT_PASSWORD=替换为独立随机管理员密码
DB_PASSWORD=替换为独立随机业务密码
JWT_SECRET=替换为独立随机应用密钥
```

各密码/密钥使用不同随机值，正式和本地配置也分开。在 Ubuntu/macOS 使用 `openssl rand -hex 32`；有 Python 的 Windows 可执行：

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

所有中文占位符都须替换。值含 `$` 可用单引号保留字面值，含 `#` 或空格需按环境文件规则处理；十六进制随机密码比较容易避免转义问题。

## 7. 数据库：初始化、迁移和持久化是三件事

### 7.1 首次部署：准备真实建表 SQL

将自己项目已经审核的建表脚本放到 `deploy/mysql-init/01-schema.sql`。本文的数据库叫 `my_fullstack`，脚本里的库名要一致。只导入必要基础数据，不导入演示账号或假业务数据。

MySQL 官方镜像会创建 `MYSQL_DATABASE`、`MYSQL_USER`，然后按文件名顺序执行 `/docker-entrypoint-initdb.d` 中的初始化脚本；**只有数据目录为空时执行**。数据库已存在后，修改 SQL 或重新创建容器不会再自动执行这些脚本。[MySQL 官方镜像文档](https://hub.docker.com/_/mysql/)

只创建库不等于创建表。`SELECT 1` 健康检查通过，只证明账号和连接可用；下一步还要核对实际业务表和迁移版本。

### 7.2 运行时账号与迁移账号

官方 `MYSQL_USER` 默认获得目标库的广泛权限。若 API 运行时只需业务读写，可新增 `deploy/mysql-init/02-app-grants.sql`：

```sql
REVOKE ALL PRIVILEGES ON my_fullstack.* FROM 'app_user'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON my_fullstack.* TO 'app_user'@'%';
```

只在确认应用不需要其他权限时使用。建表、ALTER 和迁移改由管理员或专用迁移账号执行，不能将管理员密码传给日常 API。

### 7.3 如果项目使用 ORM migration

不要同时保留两套互相冲突的建表方式。可以移除初始化目录挂载，启动 db 后，用受控的迁移任务执行项目已有的迁移命令，再启动 API；迁移文件、工具和管理员凭据要给该任务单独准备。不要编造 `migration:run`，也不要启用生产自动同步替代版本迁移。

Compose 的 `depends_on: service_healthy` 可以等待依赖健康，但不会替你执行任意框架迁移。上线前记录迁移版本；后续镜像回退也不会自动撤销它。[Compose 启动顺序说明](https://docs.docker.com/compose/how-tos/startup-order/)

### 7.4 数据版本选择

本文新部署选 MySQL 8.4 LTS；旧项目依赖不同版本时先做兼容性验证。MySQL 8.0 已在 2026 年 4 月结束生命周期，不应继续照搬旧教程作为新部署默认版本。旧库升级先备份和演练，不能仅把镜像标签改大版本后直接挂旧数据目录。[MySQL 8.0 官方发布说明](https://dev.mysql.com/doc/relnotes/mysql/8.0/en/)

## 8. 本地预演：先确认这一套配置能启动

**本地 Windows：**

```powershell
Copy-Item .env.example .env.local
```

Mac 用 `cp .env.example .env.local`。填写本地专用密钥，再改这些值：

```dotenv
COMPOSE_PROJECT_NAME=my-fullstack-local
API_IMAGE=my-fullstack-api
WEB_IMAGE=my-fullstack-web
APP_VERSION=local
SITE_ADDRESS=:80
FRONTEND_ORIGIN=http://localhost:8080
BIND_ADDRESS=127.0.0.1
HTTP_PORT=8080
HTTPS_PORT=8443
```

**本地仓库根目录，每条分别执行：**

```text
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml config --quiet
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml build
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml up -d --wait --wait-timeout 300
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml ps
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml logs --tail=100 db api web
```

`config --quiet` 检查 Compose 结构与插值；没有 `--quiet` 的完整输出可能含密钥。`--wait` 等待有健康检查的服务 healthy、其余服务 running，仍须实际验收页面和接口。

**本地 Windows：**

```powershell
curl.exe -I http://localhost:8080
curl.exe -i http://localhost:8080/api/health
```

Mac 使用 `curl`。按本文前提，均应成功；随后打开网页，检查接口、页面路由刷新、登录和最基本的读写。

若生产 Cookie 强制 Secure，本地 HTTP 只能覆盖部分验收，最终需正式 HTTPS 复测，不要为了让本地测试通过而关闭生产 Cookie 安全属性。

Docker Desktop 的 Containers 页面可查看服务、日志和运行状态，Images 页面可查看镜像。配置仍以文件为准，界面操作后也应能用相同 Compose 重建环境。

完成本地预演后：

```text
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml down
```

默认保留命名卷；`down -v` 会删除相关卷。首次启动失败后不要随意用删卷作为重试手段。

## 9. 将镜像发布到镜像仓库

### 9.1 创建仓库并登录

以 Docker Hub 为例，创建 `my-fullstack-api` 和 `my-fullstack-web` 两个镜像仓库；需要保密的应用使用私有仓库。下方 `yourname` 全部替换成自己的用户名。

**本地：**

```text
docker login
```

使用访问令牌登录，按提示输入；不要把令牌放在 Dockerfile、脚本正文或 Git 中。云服务器若要拉私有镜像，也须在部署账号下登录，最好使用仅能拉取的凭据。

### 9.2 按目标架构构建并推送

**本地仓库根目录，假设云服务器为 amd64：**

```text
docker buildx build --platform linux/amd64 -f server/Dockerfile -t yourname/my-fullstack-api:20261016-1 --push server
docker buildx build --platform linux/amd64 -f web/Dockerfile -t yourname/my-fullstack-web:20261016-1 --push web
docker buildx imagetools inspect yourname/my-fullstack-api:20261016-1
docker buildx imagetools inspect yourname/my-fullstack-web:20261016-1
```

arm64 服务器改为 `linux/arm64`。需要两种架构时，构建参数改为 `--platform linux/amd64,linux/arm64` 并推送；跨架构模拟可能更慢，依赖问题应在构建阶段修复。

每次使用新版本标签，例如日期加序号或 Git 提交 ID，避免覆盖正在使用的发布标签。记录应用源码提交、镜像标签、平台和 digest。基础镜像也应测试后固定，按计划升级。

## 10. 准备 Ubuntu：域名、SSH、Engine 和防火墙

### 10.1 域名与安全组

创建 Ubuntu 24.04 LTS 云服务器，记录公网 IP、登录用户、SSH 端口和私钥位置。为 `app.example.com` 添加 A 记录，指向公网 IPv4；不用 IPv6 时不要保留错误的 AAAA。本文端口发布使用 IPv4。

| 云安全组入站 | 来源 | 用途 |
| --- | --- | --- |
| TCP 22，或真实 SSH 端口 | 自己的管理 IP | SSH |
| TCP 80 | 公网 | HTTP 与证书验证 |
| TCP 443 | 公网 | HTTPS |

不开放数据库 3306、API 3000 或 Docker 2375。出站放行所需 DNS、软件源、镜像仓库、证书服务及外部业务服务。

**本地 Windows：**

```powershell
Resolve-DnsName app.example.com -Type A
ssh ubuntu@203.0.113.10
```

Mac 用 `dig +short app.example.com A` 检查 DNS。管理员若是 root 或使用 SSH 私钥，按云平台提供的方式替换登录命令；首次连接核对主机指纹。

### 10.2 创建部署用户

**服务器管理员：**

```bash
sudo adduser deployer
sudo usermod -aG sudo deployer
sudo install -d -o deployer -g deployer -m 750 /opt/my-fullstack
sudo install -d -o deployer -g deployer -m 700 /home/deployer/.ssh
sudo -u deployer nano /home/deployer/.ssh/authorized_keys
sudo chown deployer:deployer /home/deployer/.ssh/authorized_keys
sudo chmod 600 /home/deployer/.ssh/authorized_keys
```

编辑时粘贴自己电脑上的 SSH **公钥**，一行一把，不是私钥。已有用户和公钥文件时保留原内容。nano 保存方法：`Ctrl+O`、回车、`Ctrl+X`。新窗口确认 `ssh deployer@真实IP` 成功，再继续使用 deployer 部署。

### 10.3 安装 Docker Engine 与 Compose 插件

以下针对新服务器。若已有 Docker、containerd 或其他容器平台，先按官方文档检查冲突包与运行服务，不要直接卸载。[Docker Ubuntu 官方安装步骤](https://docs.docker.com/engine/install/ubuntu/)

**服务器：**

```bash
sudo apt update
sudo apt install -y ca-certificates curl nano openssl ufw
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
sudo usermod -aG docker deployer
```

docker 组拥有很高的主机控制权限，只给可信的部署账号。退出并重新登录 deployer，使组变更生效；后文不再对每条 Docker 命令加 sudo。[Linux 安装后权限说明](https://docs.docker.com/engine/install/linux-postinstall/)

```bash
docker version
docker compose version
sudo systemctl is-enabled docker
```

此方案不要求在宿主机另装 Node、PM2、MySQL、Nginx 或 Certbot。

### 10.4 防火墙与端口冲突

**服务器，确认实际 SSH 端口后执行：**

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw enable
sudo ufw status numbered
sudo ss -lntp
```

Docker 发布端口的网络规则可能绕过 UFW 的普通规则，因此核心措施是：只发布需要的入口端口，API/数据库不写 `ports`，再配合云安全组；不能只依靠 `ufw deny 3306`。[Docker 防火墙说明](https://docs.docker.com/engine/network/packet-filtering-firewalls/)

如果 80/443 已由旧站点占用，先确认迁移安排和原配置备份，避免停止其他网站。本文主流程假定独占新服务器上的这两个端口。

## 11. 上传运行文件，填写生产环境

**服务器 deployer：**

```bash
mkdir -p /opt/my-fullstack/deploy
```

**本地项目根目录，Windows/Mac 均可：**

```text
scp compose.yaml .env.example deployer@203.0.113.10:/opt/my-fullstack/
scp -r deploy/mysql-init deployer@203.0.113.10:/opt/my-fullstack/deploy/
```

服务器应得到 `/opt/my-fullstack/deploy/mysql-init/01-schema.sql` 及其他经审核的初始化文件。镜像路线不需要上传前后端源码、node_modules 或本地构建目录。

**服务器：**

```bash
cd /opt/my-fullstack
umask 077
cp .env.example .env
chmod 600 .env
nano .env
```

填写正式独立密码和应用密钥、真实镜像仓库名/版本、正式域名与邮箱，确认：

```dotenv
COMPOSE_PROJECT_NAME=my-fullstack
SITE_ADDRESS=app.example.com
FRONTEND_ORIGIN=https://app.example.com
BIND_ADDRESS=0.0.0.0
HTTP_PORT=80
HTTPS_PORT=443
```

不要上传 `.env.local` 当作生产配置。环境变量不会因为有变量名就自动生效，必须能从 Compose 注入到应用实际读取的位置。

私有镜像在服务器执行 `docker login`；公有镜像按仓库访问规则拉取。云端网络无法访问某仓库时，选择自己可访问的合规镜像仓库，修改完整镜像地址；不要从不明来源粘贴任意镜像加速配置。

## 12. 首次启动和上线验收

### 12.1 拉取并启动

**服务器 `/opt/my-fullstack`：**

```bash
docker compose config --quiet
test -s deploy/mysql-init/01-schema.sql
docker compose pull
docker compose up -d --wait --wait-timeout 300
docker compose ps
docker compose logs --tail=100 db api web
```

如果采用 migration 路线，按第 7 节先完成真实迁移，再启动完整服务。模板健康检查假设 `/api/health` 返回 200；报错应先查接口、配置和依赖，不要为了显示 healthy 而改成永远成功。

核对业务表：

```bash
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -u"$MYSQL_USER" "$MYSQL_DATABASE" -e "SHOW TABLES;"'
docker volume ls --filter label=com.docker.compose.project=my-fullstack
```

表名和基础数据应与项目要求一致。`db_data` 实际卷名通常带项目名前缀，例如 `my-fullstack_db_data`。正式项目名后续保持稳定，避免误连到另一组新卷。

### 12.2 HTTPS 与 HTTP 路径

Caddy 在域名可验证后自动申请证书，后续自动续期；`caddy_data` 保存证书与账户信息，不要日常删除。无需再对同一端口运行 Certbot。

**本地 Mac / 外部 Linux，Windows 改用 `curl.exe`：**

```bash
curl -I http://app.example.com
curl -I https://app.example.com
curl -i https://app.example.com/api/health
```

预期 HTTP 跳转 HTTPS，HTTPS 页面与健康接口成功。证书失败按 DNS A/AAAA、80/443 入站、端口占用、证书服务出站顺序检查；不要用忽略证书错误作为上线标准。

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
docker compose up -d --force-recreate --wait --wait-timeout 300
docker compose ps
sudo reboot
```

重新登录后检查 `docker compose ps`、页面和数据。`unless-stopped` 不会自动恢复你主动停止的容器；健康检查失败本身也不会触发 Docker 重启，进程存活和业务健康是两项不同检查。

## 13. 备份与恢复：卷让数据保留，备份让数据可找回

### 13.1 备份范围

| 内容 | 处理方式 |
| --- | --- |
| 数据库 | 一致性逻辑导出或适合数据库的备份方案 |
| 用户上传文件 | 卷/对象存储的独立备份 |
| `.env`、密钥 | 私有、加密保存，严格限制访问 |
| Compose、初始化/迁移 SQL | 版本管理并留存发布副本 |
| Caddy 数据 | 包含证书私钥与账户，按敏感文件保存 |
| 镜像版本 | 保留仓库标签与 digest，避免仓库清理旧版本 |

命名卷在同一 Docker 主机持久化，不能抵御整机丢失。不要使用 `down -v` 或卷清理命令作为日常发布步骤。[Docker 卷生命周期](https://docs.docker.com/engine/storage/volumes/)

### 13.2 创建 MySQL 备份脚本

**服务器 deployer：**

```bash
mkdir -p ~/bin ~/my-fullstack-backups
chmod 700 ~/my-fullstack-backups
nano ~/bin/backup-my-fullstack
```

写入：

```bash
#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /opt/my-fullstack
backup_dir=/home/deployer/my-fullstack-backups
install -d -m 700 "$backup_dir"
backup_file="$backup_dir/db_$(date +%Y%m%d_%H%M%S).sql.gz"
/usr/bin/docker compose exec -T db sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --quick --routines --events --triggers --no-tablespaces --set-gtid-purged=OFF --databases my_fullstack' \
  | gzip > "$backup_file.partial"
gzip -t "$backup_file.partial"
mv -- "$backup_file.partial" "$backup_file"
printf '备份完成：%s\n' "$backup_file"
```

当前方案通过容器环境向客户端提供密码，避免把明文写进宿主机命令参数。只有备份成功才将 `.partial` 改成正式文件；失败应检查退出码和日志。

`--single-transaction` 主要适用于 InnoDB；备份期间不执行 DDL，非事务表需另行设计一致性方案。不要对运行中的 `/var/lib/mysql` 直接打包就当成可靠备份。

```bash
chmod 700 ~/bin/backup-my-fullstack
~/bin/backup-my-fullstack
ls -lh ~/my-fullstack-backups
crontab -e
```

添加：

```cron
30 3 * * * /home/deployer/bin/backup-my-fullstack >> /home/deployer/my-fullstack-backups/backup.log 2>&1
```

这是**服务器时区**每天 03:30，不一定是本地电脑时间。检查 `timedatectl`，按业务统一时区；另设备份保留周期、异机副本和失败告警，定期检查容量。

### 13.3 在隔离数据库恢复演练

在资源足够的测试服务器或同机隔离项目中执行，只启动 db，不启动会发送邮件或触发任务的 API：

```bash
cd /opt/my-fullstack
docker compose -p my-fullstack-restore up -d --wait --wait-timeout 300 db
# 替换成真实备份文件。
backup_file=/home/deployer/my-fullstack-backups/db_实际时间.sql.gz
gzip -t "$backup_file"
set -o pipefail
gzip -dc "$backup_file" | docker compose -p my-fullstack-restore exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot'
docker compose -p my-fullstack-restore exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot my_fullstack -e "SHOW TABLES;"'
docker compose -p my-fullstack-restore down
```

进一步核对关键表行数和业务数据；完整演练还应让独立测试 API 连接恢复库。备份含 `CREATE DATABASE` / `USE`，隔离靠不同容器、网络和数据卷实现，仅修改 mysql 命令中的库名可能无效。

测试卷保留供检查；确认所属项目后再单独清理，勿误删正式卷。真实恢复前依次完成：停止所有写入者、备份当前状态、确认备份版本、导入、重新启动和验收。恢复旧库会丢失备份后的写入。

### 13.4 迁移原有本地数据库

先暂停旧系统写入，导出所需业务库，不迁移 `mysql` 系统库。Windows 使用本机 MySQL 工具时，推荐 `mysqldump --result-file=完整文件路径`，避免旧 PowerShell 重定向转换 SQL 编码。

通过 scp 传输 SQL 并限制文件权限，先导入隔离容器验证版本兼容、表结构和数据；正式切换时停止新系统写入，再导入指定正式库。不要同时让新旧两套系统继续产生账目或订单。

## 14. 更新、配置变更与应用回退

### 14.1 一次普通发布

1. 本地/CI 完成项目已有测试与构建检查，为目标架构构建新镜像。
2. 推送新标签，确认仓库中 API/Web 版本与平台完整。
3. 记录旧版本，阅读配置与迁移变化，备份数据库及必要文件。

**服务器：**

```bash
cd /opt/my-fullstack
umask 077
cp .env ".env.before-$(date +%Y%m%d_%H%M%S)"
~/bin/backup-my-fullstack
nano .env
```

把 `APP_VERSION` 改成已推送的新标签，补齐必要配置，再执行：

```bash
docker compose config --quiet
docker compose pull api web
docker compose stop web api
```

如版本需要数据库迁移，此时执行**实际项目配套命令/SQL**；先核对兼容性，不能重复执行初始建表脚本冒充升级。迁移完成后：

```bash
docker compose up -d --wait --wait-timeout 300
docker compose logs --tail=100 api web
```

完成公网接口、登录及核心业务验收。这个流程会短暂停机；零中断发布还需多实例、流量切换和数据库向前/向后兼容设计。

### 14.2 按改动类型操作

| 改了什么 | 怎样生效 |
| --- | --- |
| 业务代码/依赖 | 构建新镜像、推送、改标签、pull、up |
| API 环境变量 | 改 `.env` / Compose，然后 `up -d --force-recreate api` |
| 前端构建变量 | 重新构建 Web 镜像，运行时变量不会改已有静态 JS |
| 镜像内的 Caddyfile | 重建并发布 Web 镜像 |
| `SITE_ADDRESS` | 更新 DNS 和配置，重新创建 web |
| 数据库用户密码 | 在数据库内改账号密码，再更新环境变量和相关容器 |
| 数据库版本 | 独立安排升级与恢复演练，不随业务版本顺便变更 |
| 卷或 Compose 项目名 | 先确认数据定位；变化可能指向一组全新空卷 |

`docker compose restart` 不会重新应用环境变量和其他容器创建参数；使用 `up` 重新创建相应服务。[Compose restart 官方说明](https://docs.docker.com/reference/cli/docker/compose/restart/)

### 14.3 应用回退

确认旧代码兼容当前数据库结构后，将 `.env` 的 `APP_VERSION` 改回保留的旧标签，再 `docker compose pull api web`、`docker compose up -d --wait --wait-timeout 300`，完成验收。

镜像回退只换程序，不会还原数据库迁移和业务数据。不要盲目恢复整份旧环境文件覆盖新密码；不要把恢复旧数据库作为所有回退的默认步骤。

## 15. 可选：本地终端直接管理云端 Docker

Docker CLI 支持通过 SSH Context 连接远程引擎，适合查看云端状态。先确认 SSH 可用，服务器用户有 Docker 权限。[Docker 官方 SSH 连接文档](https://docs.docker.com/engine/security/protect-access/)

**本地：**

```text
docker context create my-cloud --docker host=ssh://deployer@203.0.113.10
docker --context my-cloud info
docker --context my-cloud ps
docker context ls
```

显式 `--context` 可以看清命令发往哪里；不必将全局默认切到正式环境。不要开放未加密的 2375 管理端口。

这里有一个常见误区：**远程 Docker 不会自动读取你电脑上的 bind mount 文件**。Compose 里的 `./deploy/mysql-init` 会对应 Docker 服务器上的路径，Windows 的 `D:/...` 也不会自动变成 Ubuntu 目录。Context 不会复制配置、数据卷或生产密钥，主流程仍建议上传文件后在 SSH 中执行 Compose。[Bind mount 的主机归属](https://docs.docker.com/engine/storage/bind-mounts/)

Docker Desktop 的本地界面也不能假定会因为 CLI Context 切换而成为远程容器面板。用远程 CLI 或 SSH 维护即可；同一套镜像文件并不依赖图形界面存在。

## 16. 两种替代路线：离线传镜像或在服务器构建

### 16.1 不使用镜像仓库：save / load

以下示例假定目标为 amd64，先在本地构建并加载单平台镜像。多平台发布更适合仓库流程。

**本地项目根目录：**

```text
docker buildx build --platform linux/amd64 -f server/Dockerfile -t my-fullstack-api:20261016-1 --load server
docker buildx build --platform linux/amd64 -f web/Dockerfile -t my-fullstack-web:20261016-1 --load web
docker image save -o my-fullstack-images.tar my-fullstack-api:20261016-1 my-fullstack-web:20261016-1
scp my-fullstack-images.tar deployer@203.0.113.10:/opt/my-fullstack/
```

**服务器：**

```bash
cd /opt/my-fullstack
docker image load -i my-fullstack-images.tar
```

生产 `.env` 改为 `API_IMAGE=my-fullstack-api`、`WEB_IMAGE=my-fullstack-web` 和匹配的版本，再 `docker compose up -d`。该路线不要对不存在的远程标签执行 `pull`；MySQL 等依赖镜像仍须从仓库拉取，完全离线时也要按正确平台一并传输。

使用 `save -o` 避免 PowerShell 对二进制重定向的兼容问题。镜像归档不包含 Compose、`.env` 或数据库卷；数据库仍按第 13 节迁移。[Docker save](https://docs.docker.com/reference/cli/docker/image/save/)、[Docker load](https://docs.docker.com/reference/cli/docker/image/load/)

### 16.2 不使用本地 Desktop：云端构建

也可以把源码、Dockerfile、Compose 和初始化文件通过 Git 放到服务器，在服务器创建正式 `.env`，使用本地镜像名，然后执行：

```bash
docker compose -f compose.yaml -f compose.build.yaml build
docker compose -f compose.yaml -f compose.build.yaml up -d --wait --wait-timeout 300
```

服务器需要 Git 权限、足够内存/磁盘，以及访问依赖源的能力；以后更新也使用两份 Compose 文件。该方式省去镜像仓库，但构建会占用生产资源。本地或 CI 构建、服务器只拉镜像，更容易区分构建失败与运行故障。

## 17. 把教程用于其他技术栈

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

SSR 需要独立服务，例如 `frontend:3000`；Caddy 的页面 `handle` 改为：

```caddyfile
handle {
    reverse_proxy frontend:3000
}
```

为 frontend 创建运行镜像和 Compose 服务，配置健康检查及依赖。不要把 SSR 的任意 `.output` 或 dist 当作普通静态目录托管。

### 17.3 用户上传文件、Redis 和任务进程

上传文件放命名卷或对象存储，运行用户须有正确写权限，并纳入备份。数据库里只有文件 URL，不意味着文件已备份。

Redis、队列消费者和定时任务按独立服务定义；需要持久化时配置其自己的卷。恢复数据库期间停止所有可能写库的服务，不只是 API。长任务、WebSocket、大文件上传也要按实际代理、超时与应用限制验证。

### 17.4 不同站点与登录

同源 `/api` 通常最容易开始。拆成不同源后，要同时检查前端 credentials、后端精确 CORS 来源、Cookie 的 SameSite/Secure/Domain/Path，以及浏览器限制。原生 App 不依赖浏览器 CORS，但仍要配置正确的 HTTPS API 地址和认证流程。

## 18. 按链路排查，不要同时改所有配置

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
| 证书失败 | DNS、AAAA、80/443、端口占用和出站网络 |
| 刷新后退出登录 | Cookie、HTTPS、代理信任和刷新接口 |
| 重启后服务没恢复 | Docker 自启、重启策略，是否主动 stop/down |
| 重建后“空库” | 项目名或卷引用变了，先找原卷 |
| 改 `.env` 不生效 | 用 up 重建相应容器，检查同名 shell 环境变量 |

**服务器常用检查：**

```bash
cd /opt/my-fullstack
docker compose ps
docker compose logs --tail=100 db api web
docker volume ls
docker system df
sudo journalctl -u docker -n 100 --no-pager
sudo ss -lntp
df -h
free -h
```

日志、`.env`、`docker inspect` 和完整 Compose 展开结果可能含密码或令牌，分享前脱敏。卷清理、删除容器、重装数据库不应作为没有定位原因的第一步。

## 19. 给未来的自己留一份部署记录

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
