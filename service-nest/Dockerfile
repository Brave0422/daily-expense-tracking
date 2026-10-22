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