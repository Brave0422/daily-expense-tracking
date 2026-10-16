# Daily Expense Tracking：Ubuntu 云服务器部署指南

本文只针对当前仓库 `daily-expense-tracking`，按“执行位置 → 命令 → 修改内容 → 验证结果”的顺序说明部署、验收、更新和恢复。核对日期：2026-10-15。

默认使用一台全新的 **Ubuntu 24.04 LTS** 服务器，部署 Vue Web、NestJS API 和 MySQL。命令没有在真实云服务器执行过；实际部署时应逐节验证，上一节通过后再继续。

主流程先上线 Web；第 15 节单独说明已有原生 iOS 和 Flutter 如何接入同一套云端后端。

## 1. 本项目的部署约定

### 1.1 先替换这些值

| 项目 | 本文采用的值 | 你需要做什么 |
| --- | --- | --- |
| 服务器公网 IP | `203.0.113.10` | 替换成真实公网 IP；这是文档示例地址 |
| Web 域名 | `expense.example.com` | 替换全文中这个域名 |
| Git 仓库 | `https://github.com/Brave0422/daily-expense-tracking.git` | 当前仓库 origin；私有仓库按第 5 节配置访问权限 |
| 部署用户 | `deployer` | 按本文创建 |
| 项目目录 | `/var/www/daily-expense-tracking` | 建议保持本文路径，方便直接对应命令 |
| 数据库名称 | `daily-expense-tracking` | 与现有 `sql/init.sql` 一致，建议保持 |
| 数据库账号 | `expense_app` | 本项目专用账号 |
| PM2 进程名 | `daily-expense-api` | 按本文保持一致 |
| 后端端口 | `3000` | 如果服务器已占用，修改 PM2、Nginx及检查命令 |
| Node.js | `24.11.0` | 当前 `web/package.json` 的 engines 明确声明此版本 |

文中的 `<数据库密码>`、`<SMTP授权码>` 等是需要替换的占位符，不能原样保留。SQL、配置文件和 Bash 是不同语法；只在对应的位置粘贴。

### 1.2 上线后的访问关系

```text
浏览器：https://expense.example.com
  └─ Nginx：80 / 443
       ├─ /、/login、/transactions 等 → web/dist
       └─ /api/... → http://127.0.0.1:3000/api/...
                       └─ NestJS → MySQL 127.0.0.1:3306
```

本项目与一般示例不同的地方：

1. 后端路由统一使用 `/api` 前缀，登录接口是 `POST /api/auth/login`。
2. Web 默认调用 `/api`；Vite 和线上 Nginx 均保留该前缀。
3. 后端 Refresh Cookie 的 Path 是 `/api/auth`；Web 和原生客户端直接使用该路径，无需代理改写。
4. 后端读取 `.env.production`，不是普通的 `.env`，且必须在启动前设置 `NODE_ENV=production`。
5. 生产环境关闭 TypeORM 自动同步；首次上线必须建表并导入分类基础数据。
6. Access Token 和 Refresh Token 使用两把独立密钥，不能照搬单 JWT 项目的配置。

本流程不要求修改业务源码。生产环境文件、PM2 配置和 Nginx 配置在服务器上创建。

## 2. 域名解析和云平台安全组

### 2.1 设置 DNS

在域名服务商的 DNS 控制台添加：

| 类型 | 主机记录 | 记录值 |
| --- | --- | --- |
| A | `expense` | 真实服务器公网 IPv4 |

上例对应 `expense.example.com`。如果不使用服务器 IPv6，不要留下指向其他机器的 AAAA 记录；如果使用 IPv6，要同步配置 IPv6 路由和防火墙。

**本地电脑 PowerShell 执行：**

```powershell
Resolve-DnsName expense.example.com -Type A
```

应看到自己的服务器公网 IP。`ping` 不通不能单独证明 DNS 错误，服务器可能没有开放 ICMP。

### 2.2 设置安全组入站规则

在云服务器控制台的安全组或云防火墙中添加：

| 端口 | 来源 | 用途 |
| --- | --- | --- |
| TCP 22 | 自己当前的公网 IP，或实际管理网络 | SSH；如果使用自定义端口，填写实际端口 |
| TCP 80 | 公网 | HTTP、HTTPS 跳转和证书验证 |
| TCP 443 | 公网 | 正式 HTTPS |

不为公网添加 3000、3306 的入站放行规则。出站规则需要允许 DNS、软件源、Git 仓库以及 SMTP 的 465 或 587 端口。

## 3. 登录服务器并创建部署用户

**本地电脑 PowerShell 执行：**

```powershell
# 云厂商默认管理员可能是 ubuntu；此时将 root 换成 ubuntu。
ssh root@203.0.113.10
```

使用密钥登录时：

```powershell
ssh -i C:\Users\你的用户名\.ssh\你的服务器私钥 root@203.0.113.10
```

首次连接时，对照云控制台信息核对主机指纹，再确认连接。不要把私钥内容粘贴到服务器或 Git 平台。

**服务器管理员终端执行：**

```bash
# 如果已经是 root，下面的 sudo 可以省略。
sudo adduser deployer
sudo usermod -aG sudo deployer
sudo -iu deployer
whoami
```

最后应输出 `deployer`。`adduser` 会要求设置该用户的密码，后续执行 sudo 时使用这个密码。

如果以后希望直接 SSH 登录 deployer，需要将本地登录公钥加入该用户的 `~/.ssh/authorized_keys`。在 **deployer 终端**执行：

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

粘贴的是本地对应私钥的 `.pub` 公钥，一行一把。nano 保存方法：`Ctrl + O`、回车、`Ctrl + X`。在新的本地窗口测试 `ssh deployer@203.0.113.10` 成功后，再关闭原管理员连接。

后续除明确标注“本地电脑”或“MySQL 提示符”外，都在 **服务器 deployer 的 Bash 终端**执行。

## 4. 安装系统软件和 Node.js

### 4.1 安装系统软件

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y git curl ca-certificates build-essential python3 openssl nano nginx mysql-server ufw snapd dnsutils
sudo systemctl enable --now nginx mysql
```

升级后如果系统提示需要重启，先完成重启并重新登录，再往下执行。

本项目默认按中国时区使用，统一服务器时区：

```bash
sudo timedatectl set-timezone Asia/Shanghai
timedatectl
```

如果迁入旧数据库，要同时核对原环境时区；改变系统时区不会替你转换旧的 DATETIME 数据。

### 4.2 配置服务器防火墙

先确认云平台 SSH 端口。下面假设是 22；自定义端口必须先替换，避免断开后无法重新登录。

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw enable
sudo ufw status numbered
```

本文针对新服务器。如果原来已经配置规则，先检查并移除多余的 3000/3306 公网放行项；设置默认拒绝不会覆盖已有 allow 规则。[Ubuntu 防火墙说明](https://ubuntu.com/server/docs/firewalls/)

**注意监听地址：** 当前 `service-nest/src/main.ts` 是 `app.listen(PORT)`，没有指定监听 `127.0.0.1`，所以实际可能显示 `*:3000`。Nginx 使用回环地址访问后端，并不意味着后端自动只监听回环地址。本方案通过安全组和 UFW 限制外部访问；设置 `DB_HOST` 也不会改变 HTTP 监听地址。

### 4.3 在 deployer 用户下安装 nvm

```bash
whoami
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh -o /tmp/install-nvm.sh
bash /tmp/install-nvm.sh
source ~/.bashrc
command -v nvm
```

应输出 `nvm`。本文核对时官方安装示例是 v0.40.8；以后可对照 [nvm 官方说明](https://github.com/nvm-sh/nvm#installing-and-updating)更新安装脚本版本。

如果当前终端仍找不到 nvm，手动加载：

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
```

安装当前项目要求的 Node.js：

```bash
nvm install 24.11.0
nvm use 24.11.0
nvm alias default 24.11.0
node -v
npm -v
command -v node
```

Node 应输出 `v24.11.0`，路径应位于 `/home/deployer/.nvm/`。这是当前仓库的版本约束；以后升级 Node 时应同时核对 engines、锁文件和构建结果。

不要使用 `sudo npm install`；它会绕过当前用户的 nvm 环境，还可能造成目录权限问题。

## 5. 获取本项目代码

只为本项目目录设置所有者，不改变整台机器其他站点的权限：

```bash
sudo install -d -o deployer -g deployer -m 755 /var/www/daily-expense-tracking
git clone https://github.com/Brave0422/daily-expense-tracking.git /var/www/daily-expense-tracking
cd /var/www/daily-expense-tracking
git status --short
git log -1 --oneline
ls
```

应该看到 `web`、`service-nest`、`ios`、`app` 等目录。`git status --short` 应没有输出。

如果仓库是私有仓库，先在 deployer 下生成一把用于拉取仓库的密钥：

```bash
ssh-keygen -t ed25519 -f ~/.ssh/expense_repository -C "deployer@daily-expense-tracking"
cat ~/.ssh/expense_repository.pub
```

将输出的**公钥**添加到 GitHub 对应仓库的只读 Deploy Key。使用以下命令代替上面的 HTTPS clone；不要在已经克隆成功后再执行一次：

```bash
GIT_SSH_COMMAND='ssh -i /home/deployer/.ssh/expense_repository -o IdentitiesOnly=yes' git clone git@github.com:Brave0422/daily-expense-tracking.git /var/www/daily-expense-tracking
```

首次连接 GitHub 时按官方公布的指纹核对主机身份。后续 `git pull` 也需要同样的 `GIT_SSH_COMMAND`，或在 `~/.ssh/config` 中为该仓库配置专用 Host。

服务器不需要复制 Windows 的 `node_modules`。Vite 的平台依赖、后端 bcrypt 等应在 Linux 上重新安装。

## 6. 初始化 MySQL

### 6.1 限制 MySQL 监听并检查服务

```bash
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
```

在已有 `[mysqld]` 下检查或修改原来的配置行，不重复增加同名配置项：

```ini
bind-address = 127.0.0.1
```

然后执行：

```bash
sudo systemctl restart mysql
sudo systemctl status mysql --no-pager
sudo ss -lntp
sudo mysql -e "SELECT VERSION(), @@global.time_zone, NOW();"
```

MySQL 应是 `active (running)`，3306 应监听 `127.0.0.1`。如果启用了 33060，也应确认其没有暴露公网。本文 SQL 按项目声明的 MySQL 8.0 编写。

### 6.2 全新数据库：导入现有初始化脚本

**只有新建正式库才走本小节。** 如果要迁移本地真实账本，走 6.4，并保留完整数据，不要另外导入假数据。

```bash
cd /var/www/daily-expense-tracking
sudo mysql < service-nest/sql/init.sql
sudo mysql -e 'SHOW TABLES FROM `daily-expense-tracking`;'
sudo mysql -e 'SELECT COUNT(*) AS icon_count FROM `daily-expense-tracking`.category_icons; SELECT COUNT(*) AS template_count FROM `daily-expense-tracking`.category_templates;'
```

当前初始化脚本应得到 **9 张表、112 个分类图标、84 条默认分类模板**。这些模板会在注册时用于初始化用户分类。

不要将 `sql/mock-data.sql` 作为正式初始化步骤；它包含演示账号和假流水。`init.sql` 的 `IF NOT EXISTS` 也不会修复已经存在的旧表结构。

### 6.3 创建后端专用数据库账号

生成一段数据库密码，保存到自己的密码管理器，下一步和环境文件中使用同一段：

```bash
openssl rand -hex 24
sudo mysql
```

在 **MySQL 提示符**执行，替换密码后再粘贴：

```sql
CREATE USER 'expense_app'@'127.0.0.1' IDENTIFIED BY '<数据库密码>';
GRANT SELECT, INSERT, UPDATE, DELETE ON `daily-expense-tracking`.* TO 'expense_app'@'127.0.0.1';
SHOW GRANTS FOR 'expense_app'@'127.0.0.1';
EXIT;
```

这个账号负责业务读写；建表、结构迁移由管理员执行。MySQL 账号修改命令会立即生效，不需要额外执行 `FLUSH PRIVILEGES`。

按照后端相同的 TCP 地址验证，而不是只测试默认 Unix Socket：

```bash
mysql --protocol=TCP -h 127.0.0.1 -P 3306 -u expense_app -p daily-expense-tracking
```

输入数据库密码后，在 MySQL 中运行：

```sql
SELECT CURRENT_USER();
SHOW TABLES;
SELECT COUNT(*) FROM category_templates;
EXIT;
```

### 6.4 可选：将本地真实数据迁入云端

这一步是 6.2 的替代流程。先暂停本地旧服务的写入，确认本地 MySQL 导出工具可用。

**本地 Windows PowerShell 执行：**

```powershell
New-Item -ItemType Directory -Force D:\expense-backups
mysqldump --host=127.0.0.1 --port=3306 --user=你的本地数据库管理员 --password --single-transaction --no-tablespaces --set-gtid-purged=OFF --databases daily-expense-tracking --result-file="D:\expense-backups\daily-expense-tracking.sql"
Get-Item D:\expense-backups\daily-expense-tracking.sql
scp D:\expense-backups\daily-expense-tracking.sql deployer@203.0.113.10:/home/deployer/
```

使用 `--result-file` 避免不同 PowerShell 版本重定向输出时改变 SQL 编码。若命令找不到，使用本地 MySQL 安装目录中的 `mysqldump.exe` 完整路径。

**服务器执行：**

```bash
chmod 600 ~/daily-expense-tracking.sql
sudo mysql < ~/daily-expense-tracking.sql
sudo mysql -e 'SELECT COUNT(*) AS users FROM `daily-expense-tracking`.users; SELECT COUNT(*) AS transactions FROM `daily-expense-tracking`.transactions;'
```

仅在确认是空目标库时直接导入。SQL 备份可能含删表语句；已有正式数据时先备份和核对，不能直接覆盖。导入后按 6.3 创建业务账号，并核对用户、流水和分类数据。

## 7. 创建后端生产配置

### 7.1 创建配置文件

```bash
cd /var/www/daily-expense-tracking/service-nest
cp .env.example .env.production
chmod 600 .env.production
nano .env.production
```

用下面内容替换文件中的对应配置；所有占位符填写完才能启动：

```dotenv
NODE_ENV=production
PORT=3000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=expense_app
DB_PASSWORD=<第6节创建账号时使用的数据库密码>
DB_DATABASE=daily-expense-tracking

JWT_ACCESS_SECRET=<独立生成的Access密钥>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<独立生成的Refresh密钥>
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=daily-expense-tracking-production

FRONTEND_ORIGIN=https://expense.example.com
VERIFICATION_CODE_SECRET=<独立生成的验证码密钥>
DEV_VERIFICATION_CODE=

MAIL_HOST=<邮箱提供商的SMTP主机>
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=<完整发信邮箱>
MAIL_PASS=<SMTP授权码或应用专用密码>
MAIL_FROM=日常记账
MAIL_CODE_EXPIRES_MINUTES=5
MAIL_CODE_RESEND_SECONDS=60
```

生成三次随机值，分别填入三个密钥字段，三个值不要复用：

```bash
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32
```

配置说明：

| 配置 | 本项目要求 |
| --- | --- |
| `NODE_ENV` | 必须是 `production`；启动时还要由 PM2 提前设置，见第 8 节 |
| `FRONTEND_ORIGIN` | 使用浏览器实际打开的 HTTPS 源，不带 `/api`、不带结尾 `/` |
| `JWT_REFRESH_EXPIRES_IN` | 本文保持 `7d`；当前 Cookie 有效期在控制器中固定为 7 天，只改这个变量不会同步改变 Cookie |
| `DEV_VERIFICATION_CODE` | 清空；代码只在 development 下支持固定验证码 |
| `MAIL_FROM` | 当前代码把它当发件人显示名称；邮箱地址取 `MAIL_USER` |
| `MAIL_PORT` / `MAIL_SECURE` | 587 通常为 `false` 并使用 STARTTLS；465 通常为 `true`，以邮件商说明为准 |

`.env` 注释使用 `#`，不能使用 JavaScript 的 `//`。包含 `#` 或首尾空格的值需要正确加引号，建议数据库密码直接采用上面的十六进制随机值。

### 7.2 为什么不是 `.env`，也不能只在文件中写 production

当前 `src/app.module.ts` 的加载路径为：

```typescript
envFilePath: `.env.${process.env.NODE_ENV ?? 'development'}`
```

必须先给进程设置 `NODE_ENV=production`，它才知道要读 `.env.production`。`npm run start:prod` 目前只执行 `node dist/main`，不会自动设置这个变量。PM2 配置将在进程创建前设置它。

运行时已经存在的环境变量通常优先于文件；修改文件后如果发现值不生效，还要核对 PM2 和当前 shell 有没有设置同名变量。[NestJS 配置说明](https://docs.nestjs.com/techniques/configuration)

## 8. 构建后端并交给 PM2

### 8.1 安装依赖、检查并构建

```bash
cd /var/www/daily-expense-tracking/service-nest
nvm use 24.11.0
npm ci --include=dev
npm test -- --runInBand
npm run build
test -f dist/main.js
```

最后一条退出码为 0、没有错误即表示入口存在。不要先省略开发依赖：Nest CLI 和 TypeScript 在构建阶段需要它们。`npm ci` 按锁文件安装；遇到锁文件不一致，应回到开发环境修正，不能在服务器临时换一套依赖。[npm ci 说明](https://docs.npmjs.com/cli/v11/commands/npm-ci/)

### 8.2 安装 PM2 并创建服务器配置

```bash
npm install -g pm2
mkdir -p ~/deploy-configs
nano ~/deploy-configs/daily-expense-tracking.config.js
```

写入：

```javascript
module.exports = {
  apps: [
    {
      name: 'daily-expense-api',
      cwd: '/var/www/daily-expense-tracking/service-nest',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        TZ: 'Asia/Shanghai',
      },
    },
  ],
};
```

该文件位于用户目录，便于避免与 Git 更新互相影响；数据库密码和 JWT 密钥保留在权限为 600 的 `.env.production`，不复制到 PM2 文件。

```bash
pm2 start ~/deploy-configs/daily-expense-tracking.config.js
pm2 status
pm2 logs daily-expense-api --lines 100 --nostream
```

进程应为 `online`，日志应没有数据库连接错误、缺少环境变量或端口占用错误。PM2 的 `online` 只表示进程在运行，下一步还必须检查 HTTP。

### 8.3 用项目真实接口检查后端

```bash
curl -i --request POST http://127.0.0.1:3000/api/auth/login \
  --header 'Content-Type: application/json' \
  --data '{}'
```

**预期：HTTP 400，JSON 中包含邮箱或密码校验错误。** 这里故意使用空请求，不注册账号、不修改数据；收到预期的校验响应，说明请求已到达 NestJS 的真实登录接口。

```bash
curl -i http://127.0.0.1:3000/api/categories/getAllIcons
```

**预期：HTTP 401，提示“请先登录”。** 该接口受全局鉴权保护。当前项目没有 `/api/health`；服务欢迎接口 `GET /api` 同样受到全局守卫保护，不能将它必须返回 `Hello World!` 当作部署标准。

### 8.4 开机自启和日志轮转

```bash
pm2 startup systemd -u deployer --hp /home/deployer
```

这条命令会打印一条带实际 Node 路径的 `sudo ...` 命令，**复制它并执行一次**，然后：

```bash
pm2 save
sudo systemctl status pm2-deployer --no-pager
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
pm2 save
```

本项目应用日志写到标准输出，由 PM2 保存到 `~/.pm2/logs/`；没有自动生成 `service-nest/logs/error.log` 的配置。

PM2 保存进程列表和创建 systemd 服务是两件事，必须都完成；以后升级 nvm 中的 Node 路径，还要更新开机启动配置。[PM2 开机启动说明](https://pm2.keymetrics.io/docs/usage/startup/)

## 9. 构建 Web

```bash
cd /var/www/daily-expense-tracking/web
nvm use 24.11.0
```

默认 API 地址本来就是 `/api`。为了把生产选择记录清楚，可以在服务器创建：

```bash
nano .env.production
```

写入：

```dotenv
VITE_API_BASE_URL=/api
```

然后执行：

```bash
npm ci --include=dev
npm run test:unit -- --run
npm run build
test -f dist/index.html
```

构建产物应位于 `/var/www/daily-expense-tracking/web/dist`。生产环境由 Nginx 提供这些静态文件，不需要额外运行 Vite 开发服务。[Vite 静态部署说明](https://vite.dev/guide/static-deploy.html)

`VITE_API_BASE_URL` 在构建时写入前端；修改它后必须重新构建。不要把数据库密码、SMTP 授权码或 JWT 密钥放进任何 `VITE_` 变量。[Vite 环境变量说明](https://vite.dev/guide/env-and-mode)

确认 Nginx 用户能读取静态文件：

```bash
chmod 755 /var/www/daily-expense-tracking
chmod 755 /var/www/daily-expense-tracking/web
find /var/www/daily-expense-tracking/web/dist -type d -exec chmod 755 {} +
find /var/www/daily-expense-tracking/web/dist -type f -exec chmod 644 {} +
sudo -u www-data test -r /var/www/daily-expense-tracking/web/dist/index.html
```

仅开放静态构建目录的读取权限，不要递归将整个仓库设为 755 或 777；后端环境文件保持 600。

## 10. 配置 Nginx

### 10.1 创建站点文件

```bash
sudo nano /etc/nginx/sites-available/daily-expense-tracking
```

写入，记得替换域名：

```nginx
server {
    listen 80;
    server_name expense.example.com;

    root /var/www/daily-expense-tracking/web/dist;
    index index.html;

    access_log /var/log/nginx/daily-expense-access.log;
    error_log /var/log/nginx/daily-expense-error.log;

    location /api/ {
        # 不附加 URI：将 /api/auth/login 原样转发给后端。
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 后端 Cookie Path 已为 /api/auth，无需改写。
    }

    location /assets/ {
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

本项目后端统一使用 `/api`；`proxy_pass` 不附加 URI，保留完整请求路径。不要在代理中剥离 `/api`，也无需改写服务端的 `/api/auth` Cookie Path。[Nginx 代理说明](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)

### 10.2 启用和验证

首次执行：

```bash
sudo ln -s /etc/nginx/sites-available/daily-expense-tracking /etc/nginx/sites-enabled/daily-expense-tracking
sudo nginx -t
```

如果链接已存在，检查 `ls -l /etc/nginx/sites-enabled/`，不要重复创建。语法检查通过后：

```bash
sudo systemctl reload nginx
curl -I -H 'Host: expense.example.com' http://127.0.0.1/login
curl -i --request POST http://127.0.0.1/api/auth/login \
  --header 'Host: expense.example.com' \
  --header 'Content-Type: application/json' \
  --data '{}'
```

第一个应返回 200；第二个应返回 NestJS 的 400 JSON。若第二个返回 HTML，说明请求进入了前端回退；若是后端 404，优先核对 `/api` 和末尾斜线。

有正确 `server_name` 时，通常不需要删除默认站点。若看到了 Nginx 欢迎页，先核对域名、DNS、站点链接和 `sudo nginx -T`，再处理冲突配置。

此时可以用 `http://expense.example.com/login` 检查页面，但**正式登录验收放在 HTTPS 配置完成后**，因为 production 下 Refresh Cookie 带 Secure 属性。

## 11. 配置 HTTPS

先确认域名已解析到当前机器、80 端口公网可达。本文新服务器统一使用 snap 版 Certbot；如果机器已有其他来源的 Certbot，先按官方说明处理安装来源冲突。

```bash
sudo snap install --classic certbot
sudo /snap/bin/certbot --nginx -d expense.example.com --redirect
```

根据提示填写证书联系邮箱、同意服务条款。Certbot 会申请证书并修改站点配置，开启 HTTPS 和 HTTP 跳转。后续不要用第 10 节的原始 HTTP 配置覆盖已经加入证书内容的站点文件。

```bash
sudo nginx -t
sudo systemctl reload nginx
curl -I http://expense.example.com
curl -I https://expense.example.com/login
sudo /snap/bin/certbot renew --dry-run
systemctl list-timers --all
```

预期 HTTP 跳到 HTTPS、HTTPS 页面为 200、模拟续期成功。检查系统定时任务中 Certbot 的续期安排；snap 已提供自动续期，不再重复添加每日手动签发命令。[Certbot 官方步骤](https://certbot.eff.org/instructions?os=snap&ws=nginx)

## 12. 正式验收：页面、邮件、Cookie、真实数据

### 12.1 先做不会写数据的接口检查

```bash
curl -i --request POST https://expense.example.com/api/auth/login \
  --header 'Content-Type: application/json' \
  --data '{}'

curl -i https://expense.example.com/api/categories/getAllIcons
curl -I https://expense.example.com/transactions
```

依次预期为：400 JSON、401 JSON、200 HTML。第三个返回前端入口，浏览器进入页面后再由登录守卫决定跳转。

### 12.2 用浏览器完成业务闭环

1. 打开 `https://expense.example.com/register`，使用自己的可收信邮箱发送验证码。
2. 确认收到真实邮件，注册并登录。固定 `123456` 在本环境不适用。
3. 确认默认分类正常；创建一条便于识别的小额测试流水。
4. 查看流水列表、分类、标签和统计，确认数据一致。
5. 刷新页面，关闭后重新打开站点，确认能恢复登录。
6. 退出登录，再刷新，确认回到登录页。
7. 重新登录，确认刚才的测试流水仍在；测试完可以按业务功能删除。

### 12.3 检查 Refresh Cookie

Chrome / Edge 按 F12，打开 Application → Cookies → 当前域名，登录后检查 `refresh_token`：

| 属性 | Web 同源方案预期 |
| --- | --- |
| Domain / Host | `expense.example.com` |
| Path | `/api/auth` |
| HttpOnly | 开启 |
| Secure | 开启 |
| SameSite | Lax |

在 Network 中观察刷新页面产生的 `POST /api/auth/refresh`：已登录时应携带 Cookie 并成功返回新 Access Token，Cookie 也会轮换。未登录首次访问时返回 401 是正常情况。

如果“登录成功，一刷新又退出”，先检查 Cookie Path 和 Secure，再检查 PM2 中 `NODE_ENV` 是否正确。不要通过关闭 HttpOnly、关闭 Secure 或持久化 Refresh Token 到前端存储来绕过配置问题。

### 12.4 验证重启恢复

确认 `pm2 save` 已完成、没有正在编辑的配置，再进行一次计划内重启：

```bash
sudo reboot
```

本地重新 SSH 登录 deployer 后：

```bash
pm2 status
sudo systemctl status nginx mysql pm2-deployer --no-pager
curl -I https://expense.example.com/login
```

再用浏览器验证登录恢复和流水读取。只有重启后服务和数据都正常，才完成本轮上线验收。

## 13. 数据备份和恢复

### 13.1 手动备份：每次更新前执行

```bash
umask 077
mkdir -p ~/expense-db-backups
backup_stamp=$(date +%Y%m%d_%H%M%S)
sudo mysqldump --single-transaction --no-tablespaces --set-gtid-purged=OFF --databases daily-expense-tracking > "$HOME/expense-db-backups/expense_${backup_stamp}.sql"
test -s "$HOME/expense-db-backups/expense_${backup_stamp}.sql"
ls -lh ~/expense-db-backups
```

只有 mysqldump 正常退出、文件非空后，才把它当作本轮备份；命令报错后留下的空文件不是有效备份。备份包含用户信息和业务数据，文件保持私有。

**本地 PowerShell 执行，将实际文件名替换进去：**

```powershell
scp deployer@203.0.113.10:/home/deployer/expense-db-backups/expense_20261015_030000.sql D:\expense-backups\
```

本地文件名以上一条服务器 `ls` 输出为准。需要保留一份服务器之外的备份。

### 13.2 每日备份

```bash
sudo nano /usr/local/sbin/backup-expense-db
```

写入：

```bash
#!/usr/bin/env bash
set -euo pipefail
umask 077
install -d -m 700 /var/backups/daily-expense-tracking
backup_file="/var/backups/daily-expense-tracking/expense_$(date +%Y%m%d_%H%M%S).sql"
/usr/bin/mysqldump --single-transaction --no-tablespaces --set-gtid-purged=OFF --databases daily-expense-tracking > "$backup_file"
test -s "$backup_file"
gzip "$backup_file"
```

```bash
sudo chmod 700 /usr/local/sbin/backup-expense-db
sudo /usr/local/sbin/backup-expense-db
sudo ls -lh /var/backups/daily-expense-tracking
sudo crontab -e
```

添加一行，按服务器时区每天 03:30 执行：

```cron
30 3 * * * /usr/local/sbin/backup-expense-db >> /var/log/expense-db-backup.log 2>&1
```

定期检查任务日志、备份文件和磁盘容量，按自己的保留周期清理旧备份并复制到异机。创建 cron 不代表任务已经成功执行过。

### 13.3 恢复前先演练

在隔离的测试数据库服务器恢复一份备份，核对 9 张表、用户数量、流水数量，并让测试后端读取。本文备份含 `CREATE DATABASE` / `USE daily-expense-tracking`，不能只在命令末尾换一个库名就以为恢复到了另一个库。

正式库恢复会覆盖备份之后的数据，只有明确需要恢复时才执行下面流程：先停止写入、备份当前状态，再恢复指定文件。

```bash
pm2 stop daily-expense-api
# 先按 13.1 备份当前库；确认目标 SQL 文件确实是要恢复的版本。
sudo mysql < /home/deployer/expense-db-backups/要恢复的实际文件名.sql
pm2 restart ~/deploy-configs/daily-expense-tracking.config.js --update-env
```

恢复后重新完成第 12 节的登录、流水、统计检查。MySQL 逻辑备份选项可对照 [MySQL 备份说明](https://downloads.mysql.com/docs/mysql-backup-excerpt-8.0-en.a4.pdf)。

## 14. 后续更新、配置变更和代码回退

以下是个人项目可采用的短暂停机更新流程。不要在第一个命令失败后仍继续重启；每一组成功后再执行下一组。

### 14.1 更新前记录和备份

先执行第 13.1 节的数据库备份，然后：

```bash
cd /var/www/daily-expense-tracking
git status --short
git rev-parse HEAD > ~/deploy-configs/expense.previous-commit
mkdir -p ~/expense-web-backups
update_stamp=$(date +%Y%m%d_%H%M%S)
cp -a web/dist "$HOME/expense-web-backups/dist_${update_stamp}"
```

如果 `git status` 有源码改动，先处理清楚，不执行强制 reset。`.env.production` 被仓库忽略，`git pull` 不会把服务器配置自动更新成新的模板。

### 14.2 停止后端、拉取和构建

```bash
pm2 stop daily-expense-api
cd /var/www/daily-expense-tracking
git pull --ff-only
```

私有仓库按第 5 节使用对应 SSH 配置。检查本次代码和 `.env.example` 的变化；有新配置就补到 `.env.production`。

数据库结构有变化时，先审阅并执行这次版本配套的迁移 SQL。当前仓库没有已经配置好的 `migration:run` 命令；不要编造命令，也不要打开生产 `synchronize` 代替迁移。

```bash
# 仅当本次版本确实提供了这个迁移文件时，替换成真实路径执行。
sudo mysql daily-expense-tracking < service-nest/sql/本次版本的实际迁移文件.sql
```

分别构建：

```bash
cd /var/www/daily-expense-tracking/service-nest
nvm use 24.11.0
npm ci --include=dev
npm test -- --runInBand
npm run build

cd /var/www/daily-expense-tracking/web
npm ci --include=dev
npm run test:unit -- --run
npm run build
```

前端原地构建会短暂替换 dist；如果需要无中断发布，后续应改用独立 release 目录和经过验证的发布流程。

### 14.3 启动和验证

```bash
pm2 restart ~/deploy-configs/daily-expense-tracking.config.js --update-env
pm2 save
pm2 logs daily-expense-api --lines 100 --nostream
curl -i --request POST https://expense.example.com/api/auth/login \
  --header 'Content-Type: application/json' \
  --data '{}'
```

应返回预期的 400 JSON，再完成浏览器登录恢复和业务读写检查。仅修改前端静态文件无需 reload Nginx；只有 Nginx 配置改变时才执行 `sudo nginx -t` 和 reload。

### 14.4 更新环境变量

修改后端 `.env.production` 后重启后端即可重新读取；若修改了 PM2 配置中的 `PORT`、`NODE_ENV` 等，使用上面的配置文件重启并带 `--update-env`，再 `pm2 save`。修改 Web 的 `VITE_API_BASE_URL` 则需要重新构建前端。

### 14.5 代码回退

先检查先前记录的版本：

```bash
cat ~/deploy-configs/expense.previous-commit
cd /var/www/daily-expense-tracking
git status --short
```

确认工作区可安全切换后：

```bash
pm2 stop daily-expense-api
git switch --detach "$(cat ~/deploy-configs/expense.previous-commit)"
```

按 14.2 重新安装依赖和构建旧版本，再按 14.3 启动验收。此时仓库处于 detached HEAD；以后继续发布前，先切回真实发布分支。不要在 detached HEAD 下直接 `git pull`。

**代码回退不会撤销数据库迁移。** 先判断旧代码是否兼容当前表结构；不兼容时使用对应的逆向迁移，或按第 13 节经确认恢复备份。后者会丢失备份之后的写入，不能当作每次回退的默认动作。

## 15. 原生 iOS 和历史 Flutter 接入

### 15.1 iOS 与 Web 使用统一 API 入口

后端和原生 iOS 的 Refresh Cookie Path 统一为 `/api/auth`。iOS 可直接配置 `https://expense.example.com/api`，与 Web 共用同一 API 入口。

如需独立移动端 API 子域名，可按下一节配置；子域名同样保留 `/api`，转发到同一个 NestJS 进程，共用同一数据库。

### 15.2 可选：添加移动端 API 域名

DNS 添加 `api.expense.example.com` 的 A 记录，指向同一公网 IP。然后：

```bash
sudo nano /etc/nginx/sites-available/daily-expense-mobile-api
```

写入：

```nginx
server {
    listen 80;
    server_name api.expense.example.com;

    location / {
        # 不附加 URI，保留 /api/auth、/api/categories 等完整接口路径。
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

该入口同样直接使用后端的 `/api/auth` Cookie Path，无需配置 Cookie 路径改写。

```bash
sudo ln -s /etc/nginx/sites-available/daily-expense-mobile-api /etc/nginx/sites-enabled/daily-expense-mobile-api
sudo nginx -t
sudo systemctl reload nginx
sudo /snap/bin/certbot --nginx -d api.expense.example.com --redirect
curl -i --request POST https://api.expense.example.com/api/auth/login \
  --header 'Content-Type: application/json' \
  --data '{}'
```

应返回同样的 400 JSON。Web 仍使用原来的 `/api`，`FRONTEND_ORIGIN` 仍是 Web 域名；原生 App 不依赖浏览器 CORS 放行。

### 15.3 配置已有原生 iOS 工程

在 Mac 上修改 `ios/Config/Release.xcconfig` 的正式地址：

```xcconfig
API_BASE_URL = https:/$()/api.expense.example.com/api
```

保留 xcconfig 中用于避免 `//` 被识别为注释的 `$()` 写法。Release 不读取 `Local.xcconfig`，只改本地 Debug 覆盖文件不会改变正式包。

之后按 `ios/README.md` 在 Xcode 配置正式 Bundle ID、Team 和签名，编译并验收真机登录、重启恢复和流水读写。Ubuntu 负责 API 服务；iOS 编译签名仍在 Mac 上完成。

历史 Flutter 若继续使用，在 `app/` 下构建时传入：

```bash
flutter build appbundle --release --dart-define=API_BASE_URL=https://api.expense.example.com/api
```

API 基础地址同样包含 `/api`。Android 正式签名需按 Flutter 工程发布要求另行配置。

## 16. 按现象排查问题

| 现象 | 优先检查 | 对应操作 |
| --- | --- | --- |
| 域名解析失败 | DNS A/AAAA | 本地 `Resolve-DnsName`，服务器 `dig +short expense.example.com A` |
| 页面连接超时 | 公网 IP、安全组、UFW、Nginx | `sudo ufw status numbered`、`sudo systemctl status nginx --no-pager` |
| 显示 Nginx 欢迎页 | 域名命中的 server 块 | `sudo nginx -T`、核对 DNS 和 sites-enabled |
| 页面 403 | dist 路径和目录权限 | `namei -l /var/www/daily-expense-tracking/web/dist/index.html` |
| API 502 | 后端没运行或端口不同 | `pm2 status`、`pm2 logs daily-expense-api --lines 100 --nostream` |
| API 404 | `/api` 被剥离或重复添加 | 对照第 10 节，保留 `/api` 且 `proxy_pass` 不附加 URI |
| API 返回 HTML | API 请求被前端回退接收 | 核对请求地址和 `location /api/` |
| `Unknown database` / `Table ... doesn't exist` | 正式库未初始化或库名不一致 | 第 6 节；不要临时启用 synchronize |
| `Access denied for user` | 账号 Host、密码、TCP 连接 | 按 6.3 相同的 host / port / user 重测 |
| 登录后刷新退出 | Cookie Path、HTTPS、NODE_ENV | 第 12.3 节检查 `/api/auth`、Secure 和 refresh 请求 |
| 配置文件存在仍缺配置 | 文件名、PM2 cwd、启动环境 | 核对 `.env.production`、进程 cwd 和 production 环境 |
| SMTP 未配置或发信失败 | 授权码、主机、端口、出站网络 | 查看 PM2 日志和邮箱商 SMTP 设置 |
| nvm / pm2 找不到 | 当前 Linux 用户和 shell | `whoami`、加载 nvm、`command -v node` |
| 重启后后端未恢复 | PM2 systemd 和保存列表 | `systemctl status pm2-deployer`、`pm2 save` |
| 证书申请失败 | A/AAAA、80 入站、域名配置 | 先验证 HTTP 从公网可达，再运行 Certbot |

常用只读检查命令：

```bash
pm2 status
pm2 logs daily-expense-api --lines 100 --nostream
sudo nginx -t
sudo tail -n 100 /var/log/nginx/daily-expense-error.log
sudo journalctl -u mysql -n 100 --no-pager
sudo ss -lntp
df -h
free -h
```

日志发给别人前，先去掉令牌、邮箱和其他个人信息。排查时按“数据库 → 本机后端 → 本机代理 → 公网 HTTPS → 浏览器会话”逐层检查。
