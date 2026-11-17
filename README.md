# Đập Chuột 🐭

Mini game chạy trên trình duyệt: lưới 3×3, bấm trúng chuột được 1 điểm, mỗi lượt 30 giây.
Dự án tập vibecoding — HTML, CSS, JavaScript thuần.

## Cấu trúc thư mục

```
├── app/          code game (index.html, style.css, game.js)
├── design/       design system (tokens.css, design-system.html)
├── docs/         tài liệu: tổng quan, chức năng, màn hình, quy tắc dữ liệu, kế hoạch test
├── server.js     server Node.js nhỏ phục vụ app/ và design/
├── Dockerfile
├── docker-compose.yml
└── YEU-CAU.md    yêu cầu gốc
```

## Cách chạy bằng Docker

**Cần có:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) đã cài và đang chạy.

1. Mở Terminal tại thư mục dự án:
   ```bash
   cd ~/Desktop/videcoding
   ```
2. Build và khởi động:
   ```bash
   docker compose up -d --build
   ```
3. Mở trình duyệt: **http://localhost:3000**

Các lệnh hay dùng:

| Việc cần làm | Lệnh |
|---|---|
| Xem log | `docker compose logs -f app` |
| Xem trạng thái | `docker compose ps` |
| Dừng | `docker compose down` |
| Chạy lại sau khi sửa code | `docker compose up -d --build` |

Nếu cổng 3000 đã bị chiếm, đổi dòng `"3000:3000"` trong `docker-compose.yml` thành `"3001:3000"` rồi mở http://localhost:3001.

## Chạy không cần Docker

```bash
npm start
```
Rồi mở http://localhost:3000 (cần Node.js 18 trở lên).
