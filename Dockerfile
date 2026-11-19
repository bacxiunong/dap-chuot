# Image nhỏ gọn chỉ chứa Node.js, thư viện cần thiết và file của game
FROM node:22-alpine

WORKDIR /srv/dap-chuot
ENV NODE_ENV=production \
    PORT=3000

# Cài thư viện trước để Docker tận dụng cache khi chỉ sửa code
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# --chown + chmod: user "node" luôn đọc được code, kể cả khi file trên máy chỉ có quyền 600
COPY --chown=node:node server.js ./
COPY --chown=node:node src ./src
COPY --chown=node:node app ./app
COPY --chown=node:node design ./design
RUN chmod -R u=rwX,go=rX /srv/dap-chuot

# Chạy bằng user "node" có sẵn trong image, không dùng root
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "server.js"]
