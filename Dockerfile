# Image nhỏ gọn chỉ chứa Node.js và các file cần cho game
FROM node:22-alpine

WORKDIR /srv/dap-chuot
ENV NODE_ENV=production \
    PORT=3000

# Không có dependency nên không cần npm install
COPY package.json server.js ./
COPY app ./app
COPY design ./design

# Chạy bằng user "node" có sẵn trong image, không dùng root
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "server.js"]
