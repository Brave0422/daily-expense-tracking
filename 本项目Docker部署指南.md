# Daily Expense Tracking：使用 Docker 部署到 Ubuntu 云服务器

本文对应当前 `daily-expense-tracking` 仓库，参照[本项目 Ubuntu 部署指南](本项目Ubuntu部署指南.md)编写 Docker 版本，按“本地准备 → 本地验证 → 发布镜像 → 云端启动 → 验收 → 备份与更新”展开。核对日期：**2026-10-16**。

默认是一台全新的 **Ubuntu 24.04 LTS** 云服务器，部署 Web、NestJS API、MySQL。Windows/macOS 使用 Docker Desktop；云服务器使用 Docker Engine 和 Compose 插件。本教程提供需要新建的完整配置样例，**当前仓库尚未内置这些 Docker 配置**；照着操作时才创建它们。本文编写期间没有实际构建镜像或连接你的云服务器，上线前须逐节验证。

## 1. 先回答：可以在桌面端准备好，再放到云服务器运行吗

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
| Web 构建产物、Caddy 配置 | 打进 Web 镜像 |
| 服务关系、端口、数据卷声明 | 上传 `compose.yaml` |
| 首次建表 SQL | 单独上传 `deploy/mysql-init/` |
| 数据库密码、JWT、SMTP 凭据 | 在服务器单独填写 `.env`，不写进镜像 |
| 本地已有的真实账本 | 单独导出、传输、导入；镜像不含数据库卷数据 |
| 域名、安全组、备份计划 | 在云平台和服务器配置 |

Docker Desktop 的图形界面方便查看容器、日志、镜像和数据卷；部署方案本身保存在文件里。仅在界面手动创建几个容器，并不会自动产生一份完整的云端部署配置。

另一种方式是通过 SSH Context 从电脑管理云端 Docker，见第 15 节；首次部署建议先使用本文的“镜像仓库 + SSH”流程。

## 2. 本项目最终部署结构

```text
浏览器：https://expense.example.com
  │
  ▼ 云安全组，仅开放 SSH / HTTP / HTTPS
web 容器：Caddy，发布服务器 80、443
  ├─ /、/login、/transactions → 镜像内的 Vue 静态页面
  └─ /api/... → api:3000，完整保留 /api
                   │
                   ▼
              api 容器：NestJS
                   │ DB_HOST=db
                   ▼
              db 容器：MySQL → db_data 持久卷

Caddy 证书与账户信息 → caddy_data 持久卷
```

这里使用 **Caddy 同时提供静态页面、反向代理和自动 HTTPS**，因此不用另装宿主机 Nginx、Certbot、PM2、Node 或 MySQL。Caddy 获得有效域名、正确 DNS 及可达的验证端口后，可以自动申请和续期证书。[Caddy 自动 HTTPS](https://caddyserver.com/docs/automatic-https)

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
| 域名 | `expense.example.com`，必须替换 |
| SSH 用户 | `deployer` |
| 服务器部署目录 | `/opt/expense` |
| 正式 Compose 项目名 | `expense`，后续保持不变 |
| Node 镜像 | `node:24.11.0-bookworm-slim`，与 Web engines 一致 |
| MySQL 镜像 | `mysql:8.4`，8.4 LTS 系列 |
| Web 运行镜像 | `caddy:2-alpine` |
| 发布版本示例 | `20261016-1`，每次发布用新标签 |

**数据库版本与原教程的区别：** 原仓库 SQL 注明适用于 MySQL 8.0，而 MySQL 官方已宣布 8.0 于 2026 年 4 月结束生命周期。本文新部署选择 8.4 LTS；这不表示本仓库已经完成 8.4 全量兼容认证。首次部署应验证建表、分类初始化、登录、流水和统计；旧库升级须先在隔离库演练逻辑导入，不可把旧版本数据目录直接交给新镜像。[MySQL 8.0 发布说明](https://dev.mysql.com/doc/relnotes/mysql/8.0/en/)

`8.4`、`2-alpine` 都会随补丁更新。首次验证后记录实际 digest，正式环境可改用 `mysql:8.4@sha256:实际摘要` 等引用。应用镜像标签同样应避免被覆盖；不要以 `latest` 作为回退依据。

## 3. 在 Windows / Mac 安装并检查 Docker Desktop

### 3.1 Windows

从 [Windows 官方安装页面](https://docs.docker.com/desktop/setup/install/windows-install/)下载 Docker Desktop，按当前系统要求启用硬件虚拟化和 WSL 2 后端。若尚未安装 WSL，可在管理员 PowerShell 执行：

```powershell
wsl --install
```

按提示重启；安装并启动 Docker Desktop，使用 **Linux containers**。本项目要运行 Linux 镜像。

**本地 PowerShell 执行：**

```powershell
wsl --status
docker version
docker compose version
docker buildx version
docker info --format '{{.OSType}}'
```

最后应输出 `linux`，`docker version` 应同时有 Client 和 Server。只有客户端版本、Server 连接失败时，先启动并修复 Docker Desktop。

### 3.2 macOS

从 [Mac 官方安装页面](https://docs.docker.com/desktop/setup/install/mac-install/)选择 Apple Silicon 或 Intel 对应安装包，安装并启动后，在终端执行上述 `docker` 检查命令。后文标为 Bash 的命令可用于 Mac；PowerShell 的复制和建目录命令有对应 Bash 版本。

### 3.3 提前确认服务器架构

**服务器 SSH 终端：**

```bash
uname -m
```

| 输出 | 构建目标 |
| --- | --- |
| `x86_64` | `linux/amd64` |
| `aarch64` | `linux/arm64` |

Apple Silicon 本地通常运行 arm64，云服务器可能是 amd64。发布镜像时要显式指定目标平台；本文第 7 节给出命令。镜像能跨操作系统分发，并不意味着任意 CPU 架构的镜像都能原生运行。[多平台构建说明](https://docs.docker.com/build/building/multi-platform/)

## 4. 在项目中创建镜像配置

以下文件均在**本地仓库**创建；保存为 UTF-8。Dockerfile、YAML、Caddyfile 用编辑器保存，不需要额外扩展名。Shell 文件如后文备份脚本使用 LF 换行。

创建完成后的新增结构：

```text
daily-expense-tracking/
├── compose.yaml
├── compose.build.yaml
├── .env.example
├── .env.local                    # 本地私有配置，不提交
├── deploy/mysql-init/
│   ├── 01-init.sql               # 从现有 init.sql 复制
│   └── 02-app-grants.sql
├── service-nest/
│   ├── Dockerfile
│   └── .dockerignore
└── web/
    ├── Dockerfile
    ├── .dockerignore
    └── Caddyfile
```

### 4.1 API：`service-nest/Dockerfile`

```dockerfile
FROM node:24.11.0-bookworm-slim AS build
WORKDIR /app

# bcrypt 等依赖需要源码编译时有编译工具可用；工具不进入最终镜像。
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24.11.0-bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production TZ=Asia/Shanghai
WORKDIR /app
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

构建时安装 Nest CLI、TypeScript 等开发依赖，编译后移除；运行阶段直接启动 Node，Docker 负责进程重启。构建和运行使用相同 Linux 发行版，避免原生模块依赖不匹配。

### 4.2 Web：`web/Dockerfile`

```dockerfile
FROM node:24.11.0-bookworm-slim AS build
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

`VITE_API_BASE_URL` 是构建时变量。这里构建为同源 `/api`，同一份镜像可以分别用于本地与正式域名，无需给每个域名重新打包。

### 4.3 两个 `.dockerignore`

分别在 `service-nest/.dockerignore` 和 `web/.dockerignore` 写入：

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

构建上下文分别是 `service-nest` 和 `web`，因此两个目录都需要自己的忽略文件。它防止 Windows/macOS 的依赖、旧产物和环境密钥进入镜像；不能只依赖 `.gitignore`。

### 4.4 Web 入口：`web/Caddyfile`

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

本地令 `SITE_ADDRESS=:80`，只提供 HTTP；生产填写真实域名，如 `expense.example.com`，触发自动 HTTPS。`handle` 分开 API 与页面请求，API 错误不会落入 SPA 首页；这里没有使用会移除前缀的 `handle_path`。[Caddy handle 文档](https://caddyserver.com/docs/caddyfile/directives/handle)

### 4.5 准备初始化 SQL

**本地 Windows PowerShell：**

```powershell
New-Item -ItemType Directory -Force deploy/mysql-init
Copy-Item service-nest/sql/init.sql deploy/mysql-init/01-init.sql
```

**本地 Mac / Linux Bash：**

```bash
mkdir -p deploy/mysql-init
cp service-nest/sql/init.sql deploy/mysql-init/01-init.sql
```

新建 `deploy/mysql-init/02-app-grants.sql`：

```sql
REVOKE ALL PRIVILEGES ON `daily-expense-tracking`.* FROM 'expense_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON `daily-expense-tracking`.* TO 'expense_app'@'%';
```

官方 MySQL 镜像先按环境变量创建业务库和用户，再依文件名顺序执行初始化目录中的 SQL。第二个脚本收窄业务用户权限；管理员负责建表和迁移。此处 `%` 允许来自容器网段的连接，数据库端口不发布到宿主机；它不等于允许公网访问。[MySQL 官方镜像初始化说明](https://hub.docker.com/_/mysql/)

**初始化目录只在数据库数据目录为空时执行。** 修改 SQL、密码变量或重新创建容器，都不会自动重建旧表或修改已有数据库用户密码。

## 5. 创建 Compose 和环境模板

### 5.1 `compose.yaml`：本地与生产共用的运行定义

```yaml
services:
  db:
    image: ${MYSQL_IMAGE:-mysql:8.4}
    restart: unless-stopped
    environment:
      TZ: Asia/Shanghai
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:?请设置数据库管理员密码}
      MYSQL_DATABASE: daily-expense-tracking
      MYSQL_USER: expense_app
      MYSQL_PASSWORD: ${DB_PASSWORD:?请设置业务数据库密码}
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
      - --default-time-zone=+08:00
    volumes:
      - db_data:/var/lib/mysql
      - ./deploy/mysql-init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test:
        - CMD-SHELL
        - >-
          MYSQL_PWD="$${MYSQL_PASSWORD}" mysql --protocol=TCP
          -h 127.0.0.1 -u"$${MYSQL_USER}" "$${MYSQL_DATABASE}"
          -e 'SELECT 1 FROM category_templates LIMIT 1' >/dev/null 2>&1
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
    image: ${API_IMAGE:?请设置API镜像}:${APP_VERSION:?请设置发布版本}
    restart: unless-stopped
    init: true
    environment:
      NODE_ENV: production
      TZ: Asia/Shanghai
      PORT: "3000"
      DB_HOST: db
      DB_PORT: "3306"
      DB_USER: expense_app
      DB_DATABASE: daily-expense-tracking
      DB_PASSWORD: ${DB_PASSWORD:?请设置业务数据库密码}
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET:?请设置Access密钥}
      JWT_ACCESS_EXPIRES_IN: 15m
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:?请设置Refresh密钥}
      JWT_REFRESH_EXPIRES_IN: 7d
      JWT_ISSUER: daily-expense-tracking-production
      FRONTEND_ORIGIN: ${FRONTEND_ORIGIN:?请设置Web来源}
      VERIFICATION_CODE_SECRET: ${VERIFICATION_CODE_SECRET:?请设置验证码密钥}
      DEV_VERIFICATION_CODE: ""
      MAIL_HOST: ${MAIL_HOST:?请设置SMTP主机}
      MAIL_PORT: ${MAIL_PORT:-587}
      MAIL_SECURE: ${MAIL_SECURE:-false}
      MAIL_USER: ${MAIL_USER:?请设置SMTP账号}
      MAIL_PASS: ${MAIL_PASS:?请设置SMTP授权码}
      MAIL_FROM: 日常记账
      MAIL_CODE_EXPIRES_MINUTES: "5"
      MAIL_CODE_RESEND_SECONDS: "60"
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test:
        - CMD
        - node
        - -e
        - "fetch('http://127.0.0.1:3000/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>process.exit(r.status===400?0:1)).catch(()=>process.exit(1))"
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
    image: ${WEB_IMAGE:?请设置Web镜像}:${APP_VERSION:?请设置发布版本}
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

三个网络地址不能混淆：浏览器使用域名或 `/api`；Web 容器通过 `api:3000` 访问后端；API 通过 `db:3306` 访问数据库。**容器里的 `127.0.0.1` 代表该容器自己**，因此 API 的 `DB_HOST` 不能照搬原非容器教程中的回环地址。

`db` 和 `api` 没有 `ports`，只有 Web 发布公网入口。`EXPOSE 3000` 不等于发布端口。健康检查中的 `$$` 用于把变量保留给容器内 shell；`${...}` 由本地 Compose 先展开。

`depends_on: service_healthy` 用于首次启动等待；它不是持续故障恢复系统。`unhealthy` 本身不会触发重启，重启策略主要响应进程退出；后续仍要观察日志、告警和业务状态。[Compose 启动顺序](https://docs.docker.com/compose/how-tos/startup-order/)

### 5.2 `compose.build.yaml`：只在需要构建时追加

```yaml
services:
  api:
    build:
      context: ./service-nest
      dockerfile: Dockerfile
  web:
    build:
      context: ./web
      dockerfile: Dockerfile
```

生产部署仅使用 `compose.yaml`，服务器不必拥有业务源码或构建工具。

### 5.3 根目录 `.env.example`：生产配置模板

```dotenv
COMPOSE_PROJECT_NAME=expense
API_IMAGE=yourname/daily-expense-api
WEB_IMAGE=yourname/daily-expense-web
APP_VERSION=20261016-1
MYSQL_IMAGE=mysql:8.4

SITE_ADDRESS=expense.example.com
ACME_EMAIL=你的证书联系邮箱
FRONTEND_ORIGIN=https://expense.example.com
BIND_ADDRESS=0.0.0.0
HTTP_PORT=80
HTTPS_PORT=443

MYSQL_ROOT_PASSWORD=替换为独立随机管理员密码
DB_PASSWORD=替换为独立随机业务密码
JWT_ACCESS_SECRET=替换为独立随机Access密钥
JWT_REFRESH_SECRET=替换为独立随机Refresh密钥
VERIFICATION_CODE_SECRET=替换为独立随机验证码密钥

MAIL_HOST=替换为邮箱商SMTP主机
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=替换为完整发信邮箱
MAIL_PASS=替换为SMTP授权码
```

将 `yourname` 改成自己的 Docker Hub 命名空间；五个密码/密钥字段各用独立随机值，正式环境与本地环境也分别生成。Ubuntu/macOS 可用 `openssl rand -hex 32`；装有 Python 的 Windows 也可用：

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

587 通常对应 `MAIL_SECURE=false`，465 通常对应 `true`，以邮箱商要求为准。`MAIL_FROM` 在本项目中是显示名称，发信地址取 `MAIL_USER`。

**两层配置的区别：** 根目录 `.env` 或 `--env-file` 提供 Compose 插值；只有 YAML 中 `environment` 明确列出的字段才进入相应容器。API 通过进程环境接收这些值，Nest ConfigModule 可以直接读取，所以无需把 `service-nest/.env.production` 打包进去，管理员数据库密码也不会传给 API。[Compose 环境变量插值](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)

值包含 `$` 时，Compose 环境文件可使用单引号保留字面值；`#`、空格也要按环境文件规则处理。建议随机密码使用十六进制，避免转义混淆。示例中的中文占位符非空，Compose 不会替你识别它们，必须全部替换。

## 6. 用 Docker Desktop 在本地预演

**本地 Windows PowerShell，在仓库根目录：**

```powershell
Copy-Item .env.example .env.local
```

Mac 使用 `cp .env.example .env.local`。填写本地专用密码、密钥及 SMTP，并将以下字段改成：

```dotenv
COMPOSE_PROJECT_NAME=expense-local
API_IMAGE=daily-expense-api
WEB_IMAGE=daily-expense-web
APP_VERSION=local
SITE_ADDRESS=:80
FRONTEND_ORIGIN=http://localhost:8080
BIND_ADDRESS=127.0.0.1
HTTP_PORT=8080
HTTPS_PORT=8443
```

`ACME_EMAIL` 也填自己的有效邮箱。本地与云端项目名不同，数据卷相互独立。

**Windows PowerShell / Mac 终端均可执行，每条单独运行：**

```text
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml config --quiet
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml build
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml up -d --wait --wait-timeout 300
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml ps
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml logs --tail=100 db api web
```

`config --quiet` 检查配置，不输出展开后的密钥。数据库首次初始化可能耗时数分钟；若超时先看日志，不要删除卷来“重试”。`--wait` 会等待 db、api 健康及 web 运行，仍需检查真实 HTTP。

Windows 使用 `curl.exe`，Mac 使用 `curl`：

```powershell
curl.exe -I http://localhost:8080
curl.exe -i -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" --data '{}'
```

预期首页 200、空登录请求 **400 JSON**。打开 `http://localhost:8080` 检查页面、静态资源和页面刷新。Docker Desktop 的 Containers 页面应能看到该 Compose 应用及三个服务，可查看日志、停止和启动容器。

本地仍以 `production` 运行，Refresh Cookie 会带 `Secure`；localhost 在部分浏览器有特殊待遇，本地 HTTP 结果不能替代正式 HTTPS 下的 Cookie 验收。生产验证码也不会使用开发固定值。

暂停预演：

```text
docker compose --env-file .env.local -f compose.yaml -f compose.build.yaml down
```

`down` 默认保留命名卷；不要添加 `-v`，它会删除本次 Compose 的命名卷。重建容器也不会清空账本。

## 7. 发布镜像：让云服务器直接拉取

### 7.1 准备镜像仓库

在 Docker Hub 创建 `daily-expense-api`、`daily-expense-web` 两个仓库，按需要设为私有。以下 `yourname` 全部替换成自己的用户名；CLI 登录时按提示使用访问令牌，避免把令牌放到命令、文档或 Dockerfile 中。

**本地执行：**

```text
docker login
```

### 7.2 为服务器架构构建并推送

以下假设服务器是 `x86_64`；arm64 服务器将目标改为 `linux/arm64`。

**本地仓库根目录执行：**

```text
docker buildx build --platform linux/amd64 -f service-nest/Dockerfile -t yourname/daily-expense-api:20261016-1 --push service-nest
docker buildx build --platform linux/amd64 -f web/Dockerfile -t yourname/daily-expense-web:20261016-1 --push web
docker buildx imagetools inspect yourname/daily-expense-api:20261016-1
docker buildx imagetools inspect yourname/daily-expense-web:20261016-1
```

如果希望同时支持两类服务器，将两条构建命令的 `--platform` 改为 `linux/amd64,linux/arm64`，并继续使用 `--push`。Docker Desktop 支持模拟构建，跨架构编译可能更慢；若某依赖不兼容，应修复构建或使用对应架构的构建机。

`--push` 将结果写到仓库，不保证结果出现在本地 Images 列表。检查仓库标签和镜像支持的平台；云端最终使用这个发布版本再次验收。源码提交 ID、版本标签和镜像 digest 建议一起记录。

## 8. 准备 Ubuntu 云服务器

### 8.1 域名和安全组

DNS 将 `expense.example.com` 的 A 记录指向真实公网 IP。本文端口发布按 IPv4 配置；暂不使用 IPv6 时不要留一个无法访问的 AAAA 记录。

| 入站端口 | 来源 | 用途 |
| --- | --- | --- |
| TCP 22 或真实 SSH 端口 | 自己的管理 IP | SSH |
| TCP 80 | 公网 | HTTP、证书验证和跳转 |
| TCP 443 | 公网 | HTTPS |

不开放 3000、3306、Caddy 管理端口 2019。出站需能访问 DNS、Docker 软件源、镜像仓库、证书服务及 SMTP。

**本地 Windows：**

```powershell
Resolve-DnsName expense.example.com -Type A
ssh ubuntu@203.0.113.10
```

默认账号若是 root 就换成 root；密钥登录增加 `-i 私钥路径`。首次连接核对云平台提供的主机指纹。

### 8.2 创建部署用户和目录

**服务器管理员终端：**

```bash
sudo adduser deployer
sudo usermod -aG sudo deployer
sudo install -d -o deployer -g deployer -m 750 /opt/expense
```

如果已有 deployer，跳过创建。把自己的 SSH 公钥加入 `/home/deployer/.ssh/authorized_keys`，目录归 deployer 且权限 700、文件权限 600；在新窗口测试 `ssh deployer@真实IP` 成功后继续。原[非容器部署指南第 3 节](本项目Ubuntu部署指南.md#3-登录服务器并创建部署用户)有完整步骤。

### 8.3 安装 Docker Engine 与 Compose

下面针对**新装 Ubuntu 24.04**。已装其他 Docker/containerd 发行包时，先按官方文档核对冲突，勿直接卸载运行其他应用的运行时。[Docker Ubuntu 安装文档](https://docs.docker.com/engine/install/ubuntu/)

**服务器执行：**

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
sudo timedatectl set-timezone Asia/Shanghai
```

docker 组具有相当于 root 的主机管理能力，仅授予可信部署用户。**退出 SSH 后重新以 deployer 登录**，让组权限生效；后文 Docker 命令均在 deployer 下执行。

```bash
id
docker version
docker compose version
sudo systemctl is-enabled docker
```

### 8.4 防火墙与端口检查

先确认真实 SSH 端口再启用 UFW：

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

**Docker 发布端口的流量可能绕过 UFW 的常规规则**，不能认为 `ufw deny 3306` 一定能阻止被 Docker 发布的数据库端口。本文直接不发布 db/api，配合云安全组控制公网入口。[Docker 与防火墙说明](https://docs.docker.com/engine/network/packet-filtering-firewalls/)

服务器 80/443 必须空闲；若已按原教程部署宿主机 Nginx，先备份旧配置、确认迁移窗口并停止冲突服务，再切换，不能同时占用这些端口。

## 9. 上传运行文件，在云端创建生产配置

**服务器 deployer：**

```bash
mkdir -p /opt/expense/deploy
```

**本地仓库根目录，Windows / Mac 均可：**

```text
scp compose.yaml .env.example deployer@203.0.113.10:/opt/expense/
scp -r deploy/mysql-init deployer@203.0.113.10:/opt/expense/deploy/
```

服务器最终必须有 `/opt/expense/deploy/mysql-init/01-init.sql` 和 `02-app-grants.sql`。不要上传 `.env.local`、`node_modules` 或 Docker Desktop 的虚拟磁盘。

**服务器执行：**

```bash
cd /opt/expense
umask 077
cp .env.example .env
chmod 600 .env
nano .env
```

将模板占位符全部换成正式值，尤其是镜像用户名、版本、真实域名、HTTPS 来源、随机密钥和 SMTP。保持 `COMPOSE_PROJECT_NAME=expense`；生产端口为 80/443，绑定地址为 `0.0.0.0`。

nano 保存：`Ctrl+O`、回车、`Ctrl+X`。仓库已有 `.gitignore` 忽略 `.env`、`.env.*` 并放行 `.env.example`，但仍要在提交前检查，不能提交真实密钥。

私有镜像需要在服务器执行 `docker login`，使用仅有拉取权限的令牌。Docker 凭据应留在部署账号的私有目录；不要把凭据复制到 Compose。

## 10. 首次启动与 HTTPS

**服务器 `/opt/expense`：**

```bash
docker compose config --quiet
test -s deploy/mysql-init/01-init.sql
test -s deploy/mysql-init/02-app-grants.sql
docker compose pull
docker compose up -d --wait --wait-timeout 300
docker compose ps
docker compose logs --tail=100 db api web
```

预期：db 和 api 显示 healthy，web 运行；Caddy 日志显示域名证书申请成功。首次签发取决于公网 DNS、验证端口和出站网络，Compose 启动成功不等于 HTTPS 已可用。

查看实际挂载卷，记下 `expense_db_data` 等名称：

```bash
docker volume ls --filter label=com.docker.compose.project=expense
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -u"$MYSQL_USER" "$MYSQL_DATABASE" -e "SHOW TABLES; SELECT COUNT(*) AS icon_count FROM category_icons; SELECT COUNT(*) AS template_count FROM category_templates;"'
```

全新库应是 **9 张表、112 个图标、84 条分类模板**。若已导入真实数据，数据行数按实际核对；此时不能重新跑初始化流程来覆盖旧库。

## 11. 正式验收

### 11.1 从公网检查入口和接口

**本地 Mac 或服务器 Bash，最好另从外部网络复测：**

```bash
curl -I http://expense.example.com
curl -I https://expense.example.com
curl -i -X POST https://expense.example.com/api/auth/login \
  -H 'Content-Type: application/json' --data '{}'
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
docker compose up -d --force-recreate --wait --wait-timeout 300
docker compose ps
```

再次确认测试流水存在。安排合适时间执行 `sudo reboot`，重新登录后检查 Docker 服务、容器和业务数据。`restart: unless-stopped` 不会把你主动停止的容器自动恢复；停机维护后需再次 `docker compose up -d`。

## 12. 把本地真实账本迁移到容器数据库

本节可替换“只使用全新空库”的数据流程。先暂停旧环境写入、做好备份；涉及 MySQL 8.0 → 8.4 时，先按第 13 节在隔离环境验证导入和业务，再执行正式迁移。

**本地 Windows，需有兼容的 MySQL 导出工具：**

```powershell
New-Item -ItemType Directory -Force D:/expense-backups
mysqldump --host=127.0.0.1 --user=你的本地管理员 --password --single-transaction --no-tablespaces --set-gtid-purged=OFF --databases daily-expense-tracking --result-file=D:/expense-backups/expense.sql
scp D:/expense-backups/expense.sql deployer@203.0.113.10:/home/deployer/
```

使用 `--result-file` 避免旧版 PowerShell 重定向改变编码；不要原样复制本地 MySQL 数据目录。若本地 MySQL 也在 Docker 中，可使用第 13 节的容器内导出方式。

**服务器，只对已经确认的目标库操作：**

```bash
cd /opt/expense
chmod 600 ~/expense.sql
docker compose stop web api
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot' < ~/expense.sql
docker compose up -d --wait --wait-timeout 300
```

SQL 可能包含 DROP TABLE，目标已有数据时必须先备份，不可直接覆盖。导出文件只含本项目业务库，不包含 `mysql` 系统库和账号；正式业务账号仍由云端初始化配置管理。核对用户、流水、分类、统计与邮件后再停止使用旧环境，避免两边继续写入。

## 13. 数据备份、定时任务与恢复演练

### 13.1 先理解卷与备份

`db_data` 让数据在容器重建后保留，**它仍在同一台服务器上，不等于备份**。删除卷、磁盘损坏或整机丢失都可能丢数据。不要执行 `docker compose down -v` 或不加核对的卷清理命令。

另需私下备份 `.env`、Compose、初始化/迁移 SQL；`caddy_data` 保存证书私钥及账户信息，也按敏感数据保存。运行中的 MySQL 数据目录不能简单打包充当一致性备份。

### 13.2 创建可重复执行的备份脚本

**服务器 deployer：**

```bash
mkdir -p ~/bin ~/expense-backups
chmod 700 ~/expense-backups
nano ~/bin/backup-expense
```

写入：

```bash
#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /opt/expense
backup_dir=/home/deployer/expense-backups
install -d -m 700 "$backup_dir"
backup_file="$backup_dir/expense_$(date +%Y%m%d_%H%M%S).sql.gz"
/usr/bin/docker compose exec -T db sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --quick --routines --events --triggers --no-tablespaces --set-gtid-purged=OFF --databases daily-expense-tracking' \
  | gzip > "$backup_file.partial"
gzip -t "$backup_file.partial"
mv -- "$backup_file.partial" "$backup_file"
printf '备份完成：%s\n' "$backup_file"
```

`pipefail` 避免导出失败却只生成一个看似成功的压缩文件；`.partial` 不作为成功备份。单事务适用于当前 InnoDB 业务表，备份期间不要并发执行 DDL。

```bash
chmod 700 ~/bin/backup-expense
~/bin/backup-expense
ls -lh ~/expense-backups
crontab -e
```

添加 deployer 的定时任务：

```cron
30 3 * * * /home/deployer/bin/backup-expense >> /home/deployer/expense-backups/backup.log 2>&1
```

每天服务器时区 03:30 备份；检查日志和磁盘，制定保留周期，并通过自己控制的方式保留异机副本。仅看文件大小或 `gzip -t` 不能证明数据库可恢复。

### 13.3 使用另一组 Compose 卷做恢复演练

选择磁盘和内存足够的测试服务器，或在本服务器上仅启动隔离数据库。下面用不同项目名 `expense-restore`，不发布数据库端口，不启动会发邮件的 API。

**服务器 Bash：**

```bash
cd /opt/expense
docker compose -p expense-restore up -d --wait --wait-timeout 300 db
# 替换为上一步真实生成的备份文件。
backup_file=/home/deployer/expense-backups/expense_实际时间.sql.gz
gzip -t "$backup_file"
set -o pipefail
gzip -dc "$backup_file" | docker compose -p expense-restore exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot'
docker compose -p expense-restore exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -e "SELECT COUNT(*) FROM \`daily-expense-tracking\`.users; SELECT COUNT(*) FROM \`daily-expense-tracking\`.transactions;"'
docker compose -p expense-restore down
```

备份中的 `CREATE DATABASE` / `USE` 仍使用原库名，隔离由不同容器和数据卷实现；仅给 mysql 命令换一个库名不一定能隔离。演练卷会保留，核对所属项目后再单独处理，不要误删 `expense_db_data`。完整恢复演练还应在独立测试部署中连接测试 API，核对流水、分类和统计。

正式恢复顺序：停 web/api 及所有写入者 → 备份当前状态 → 确认目标备份 → 将上面导入命令改成正式 Compose 项目执行 → 启动 → 完整验收。旧备份会覆盖之后的写入，不能把恢复数据库当作普通代码回退。

## 14. 后续发布、配置修改与回退

### 14.1 发布新版本

1. 本地/CI 完成项目已有测试及构建：后端 `npm test -- --runInBand`，前端 `npm run test:unit -- --run`，两个目录各自执行 `npm run build`。
2. 为目标架构构建并推送两个新镜像，例如 `20261017-1`；保留旧标签。
3. 阅读新版本配置和数据库变更，确认所需迁移 SQL，备份后再操作。

**服务器先保存当前配置并备份：**

```bash
cd /opt/expense
umask 077
cp .env ".env.before-$(date +%Y%m%d_%H%M%S)"
~/bin/backup-expense
nano .env
```

只将 `APP_VERSION` 改成已推送的新标签，按版本需要补充配置。接着：

```bash
docker compose config --quiet
docker compose pull api web
docker compose stop web api
```

若本次提供了经过审核的结构迁移，在此时以管理员身份导入真实迁移 SQL；仓库当前没有可直接调用的通用迁移命令，不要重新导入 `init.sql` 代替升级，也不要开启生产同步。

```bash
# 只有本版本确实有该文件时执行，并替换为真实路径。
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot daily-expense-tracking' < deploy/本版本实际迁移.sql
docker compose up -d --wait --wait-timeout 300
docker compose logs --tail=100 api web
```

重复第 11 节验收。这是一套短暂停机发布流程，不承诺零中断；数据库版本升级应另行安排，不和每次业务镜像发布混在一起。

### 14.2 不同改动分别怎样生效

| 改动 | 操作 |
| --- | --- |
| API/Web 源码或依赖 | 构建新镜像、推送、改版本、pull、up |
| `VITE_API_BASE_URL` | 重建 Web 镜像；运行容器时改变量不会改变现有 JS |
| `.env` 的 API 配置 | `docker compose up -d --force-recreate api`，然后验收 |
| 站点域名/证书邮箱 | 更新 DNS 和 `.env`，`docker compose up -d --force-recreate web` |
| `web/Caddyfile` | 已打进镜像，须重建并发布 Web 镜像 |
| 数据库密码 | 先用数据库 SQL 修改已有用户，再同步 `.env`；初始化变量不会重置账号 |
| 端口/卷声明 | 审核 Compose 后 `up -d`；不能随意变更正式项目名或数据卷 |

`docker compose restart` 重新启动现有容器，不会自动把修改后的环境变量重新注入。

### 14.3 回退应用镜像

核对更新前保存的配置，确认旧代码兼容当前数据库结构后，把 `.env` 的 `APP_VERSION` 改回旧标签，然后：

```bash
docker compose pull api web
docker compose up -d --wait --wait-timeout 300
```

不要直接恢复整份旧 `.env` 而遗漏已经轮换的密钥或数据库密码。回退镜像不会撤销数据库迁移，也不会恢复数据卷中的旧数据；有破坏性迁移时需单独设计恢复方案。

## 15. 可选：从电脑通过 SSH 管理云端 Docker

如果希望在本地终端检查云端容器，Docker CLI 支持 SSH Context。先确认 `ssh deployer@真实IP` 可用，且该用户有服务器 Docker 权限。[Docker 官方 SSH 连接说明](https://docs.docker.com/engine/security/protect-access/)

**本地 Windows / Mac：**

```text
docker context create expense-cloud --docker host=ssh://deployer@203.0.113.10
docker --context expense-cloud info
docker --context expense-cloud ps
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
docker compose -f compose.yaml -f compose.build.yaml build
docker compose -f compose.yaml -f compose.build.yaml up -d --wait --wait-timeout 300
```

这条路线需要服务器有源码、Git 访问权限、构建所需内存和 npm 网络访问。以后也要使用相同的两份 Compose 文件；它是主流程的替代方案，不要与“只拉镜像”的更新步骤混用。

## 16. iOS 与历史 Flutter 如何接入

移动端继续使用同一个正式 API，例如 `https://expense.example.com/api`，不需要额外发布后端 3000 端口。原生 App 不依赖浏览器 CORS 放行。

原生 iOS 在 Mac 修改现有 `ios/Config/Release.xcconfig`：

```xcconfig
API_BASE_URL = https:/$()/expense.example.com/api
```

保留 xcconfig 避免 `//` 注释的 `$()` 写法；只改 Debug 的本地配置不会改变 Release。编译、签名和真机验收仍按 `ios/README.md` 在 Mac 上完成。历史 Flutter 构建传入 `--dart-define=API_BASE_URL=https://expense.example.com/api`。

## 17. 常见问题排查

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
| API 路径 404 或返回 HTML | Caddy 是否匹配 `/api`，是否保留前缀，Web 是否使用 `/api` |
| Caddy 502 | api 是否 healthy，服务名/端口是否是 `api:3000` |
| HTTPS 申请失败 | 域名 A/AAAA、80/443、旧站端口冲突、证书服务出站连接 |
| 登录后刷新失效 | 正式 HTTPS、Cookie Path、Secure、刷新接口及浏览器日志 |
| 邮件失败 | 正式 SMTP 授权码、端口、云平台出站限制；生产不使用开发固定验证码 |
| 修改环境变量没有生效 | 用 `up -d` 重建对应容器，不只是 `restart` |
| 看起来“数据全没了” | 是否换了 Compose 项目名/卷、连接错库；先检查原卷，勿重新初始化 |
| 磁盘不足 | `df -h`、`docker system df`、备份保留量；不要盲目清理卷 |

**服务器常用只读检查：**

```bash
cd /opt/expense
docker compose ps
docker compose logs --tail=100 db api web
docker system df
docker volume ls
sudo journalctl -u docker -n 100 --no-pager
sudo ss -lntp
df -h
free -h
```

排查按“数据库 → API → Web 代理 → 公网 HTTPS → 浏览器会话”逐层进行。`.env`、展开后的 `docker compose config`、`docker inspect` 以及日志可能包含敏感信息，对外分享前先脱敏。
