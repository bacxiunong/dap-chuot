# Đập Chuột 🐭

Mini game chạy trên trình duyệt: lưới 3×3, bấm trúng chuột được 1 điểm, mỗi lượt 30 giây.
Dự án tập vibecoding — HTML, CSS, JavaScript thuần, server Node.js, database PostgreSQL.

- **v1.0:** game chơi được ngay, kỷ lục lưu trên trình duyệt.
- **v1.1:** người chơi đăng ký (họ tên, email, SĐT) trước khi chơi, điểm từng lượt lưu vào database; trang quản trị `/admin` để xem, tìm kiếm, xoá và xuất CSV. *Có trên bản Docker và bản Vercel* — bản GitHub Pages vẫn là bản chơi thử không đăng ký.

## Cấu trúc thư mục

```
├── app/              code giao diện
│   ├── index.html    game (màn Đăng ký → Bắt đầu → Chơi → Kết thúc)
│   ├── style.css, game.js, env.js
│   └── admin/        trang quản trị (login.html, index.html, admins.html, admin.css, admin.js)
├── design/           design system (tokens.css, design-system.html)
├── docs/             tài liệu: tổng quan, chức năng, màn hình, quy tắc dữ liệu, kế hoạch test
├── src/              mã server: app.js (định tuyến, API, trang admin), db.js (database), validate.js (kiểm tra dữ liệu), auth.js (mật khẩu, mã đăng nhập)
├── server.js         khởi động server Node.js khi chạy Docker/local (dùng src/app.js)
├── api/index.js      Vercel Function (dùng chung src/app.js)
├── vercel.json       cấu hình Vercel: mọi đường dẫn vào api/index
├── public/           thư mục output trống cho Vercel (không đặt gì vào đây)
├── Dockerfile
├── docker-compose.yml   2 dịch vụ: app (Node.js) và db (PostgreSQL 16)
├── .env.example      mẫu file cấu hình (mật khẩu thật để trong .env, không đưa lên Git)
└── YEU-CAU.md        yêu cầu gốc
```

## Cách chạy bằng Docker

**Cần có:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) đã cài và đang chạy.

1. Mở Terminal tại thư mục dự án:
   ```bash
   cd ~/videcoding
   ```
2. Tạo file `.env` từ mẫu (chỉ làm lần đầu), rồi mở `.env` đổi **mật khẩu database** và **mật khẩu admin**:
   ```bash
   cp .env.example .env
   ```
3. Build và khởi động:
   ```bash
   docker compose up -d --build
   ```
4. Mở trình duyệt:
   - Game: **http://localhost:3000**
   - Trang quản trị: **http://localhost:3000/admin** — đăng nhập bằng `ADMIN_USERNAME` / `ADMIN_PASSWORD` trong `.env`

Các lệnh hay dùng:

| Việc cần làm | Lệnh |
|---|---|
| Xem log | `docker compose logs -f app` |
| Xem log database | `docker compose logs -f db` |
| Xem trạng thái | `docker compose ps` |
| Dừng (giữ dữ liệu) | `docker compose down` |
| Chạy lại sau khi sửa code | `docker compose up -d --build` |
| Xoá sạch dữ liệu người chơi và admin | `docker compose down -v` ⚠️ không hoàn tác được |

Nếu cổng 3000 đã bị chiếm, đổi dòng `"3000:3000"` trong `docker-compose.yml` thành `"3001:3000"` rồi mở http://localhost:3001.

### Lưu ý về tài khoản admin

- `ADMIN_USERNAME` / `ADMIN_PASSWORD` trong `.env` chỉ dùng để **tạo admin đầu tiên** khi database còn trống. Sau đó đổi mật khẩu và thêm admin khác ngay trong trang **Quản lý admin**.
- Sai mật khẩu 5 lần liên tiếp thì tài khoản bị khoá 15 phút.
- Quên mật khẩu admin duy nhất: chạy `docker compose exec db psql -U <POSTGRES_USER> -d <POSTGRES_DB> -c "DELETE FROM admins;"`, đặt lại mật khẩu trong `.env`, rồi `docker compose restart app` để tạo lại admin đầu tiên.

### Dữ liệu

- Dữ liệu nằm trong volume Docker `pgdata`, không mất khi dừng, khởi động lại hay build lại.
- Họ tên, email, SĐT là dữ liệu cá nhân: chỉ admin xem được; server không ghi chúng vào log.

## Chạy không cần Docker

Cần Node.js 18+ và một PostgreSQL đang chạy:

```bash
npm install
PGHOST=localhost POSTGRES_DB=dapchuot POSTGRES_USER=dapchuot POSTGRES_PASSWORD=... \
ADMIN_USERNAME=admin ADMIN_PASSWORD=... npm start
```
Rồi mở http://localhost:3000.

## Cách deploy lên Vercel

Bản Vercel chạy **cùng code** với bản Docker: `api/index.js` gọi `src/app.js`. Database là **Neon Postgres** (gói Free) cài từ Vercel Marketplace.

1. Đưa code lên GitHub (không có `.env`).
2. Vào [vercel.com](https://vercel.com) → **Add New… → Project** → Import repo `dap-chuot`. Framework Preset: **Other**; không đổi Build/Output (đã khai báo trong `vercel.json`).
3. Project → **Storage** → **Create Database / Browse Marketplace** → **Neon** → chọn gói **Free**, vùng **AWS us-east-1** (gần vùng chạy function mặc định của Vercel). Neon tự thêm `DATABASE_URL`.
4. Project → **Settings → Environment Variables** (Production):

   | Biến | Giá trị |
   |---|---|
   | `ADMIN_USERNAME` | tên đăng nhập admin đầu tiên |
   | `ADMIN_PASSWORD` | mật khẩu mới, ≥ 16 ký tự ngẫu nhiên — **không dùng lại mật khẩu local** |
   | `COOKIE_SECURE` | `true` |
   | `NODEJS_HELPERS` | `0` |

5. **Deployments → Redeploy**. Lần chạy đầu tự tạo bảng và admin đầu tiên.
6. Kiểm tra: `https://<project>.vercel.app/healthz` trả `ok`; `/admin` chuyển về trang đăng nhập.
7. Tên miền: **Settings → Domains** → thêm `bacxiunong.com` và `www.bacxiunong.com` (chuyển về bản chính). Ở nơi quản lý DNS: bản ghi **A** `@` → `76.76.21.21`, **CNAME** `www` → `cname.vercel-dns.com` (nếu Vercel hiển thị giá trị khác thì dùng theo Vercel).

**Lưu ý:** gói Hobby của Vercel chỉ dành cho mục đích cá nhân, phi thương mại. Xem chi tiết chi phí và bảo mật trong `docs/06-ke-hoach-deploy.html`, mục “Phương án Vercel”.

