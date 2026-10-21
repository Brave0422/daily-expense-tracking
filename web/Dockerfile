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