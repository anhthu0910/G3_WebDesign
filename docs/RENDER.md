# Triển khai GlowGuide trên Render

Chạy mọi lệnh từ thư mục gốc `G3_WebDesign`; không đặt Root Directory thành `backend`.

## Cấu hình đã chuẩn bị

- FastAPI phục vụ frontend và API cùng tên miền. `/` chuyển đến `/frontend/html/index.html`; giữ nguyên liên kết tương đối. Các URL `/index.html`, `/products.html`, v.v. cũng hoạt động.
- Chỉ mount CSS, JS, ảnh và thư mục upload; không mount repository, database, `.env` hoặc backend. Trang HTML dùng danh sách cho phép.
- Frontend lấy sản phẩm từ `/api/products`; danh mục mới phản ánh thay đổi của Admin. Sản phẩm ẩn không xuất hiện trong API công khai.
- Cookie phiên có HttpOnly, SameSite=Lax và Secure trong production. Đăng xuất hủy phiên; khóa user cũng vô hiệu quyền truy cập bằng phiên hiện có. Chặn browser request ghi dữ liệu từ origin khác.
- Giữ Skin Quiz, Cart (localStorage trên từng trình duyệt), Gemini và logic fallback hiện có. Guest/User đọc quiz đã publish; dùng câu hỏi tích hợp khi chưa có câu hỏi publish.
- Giữ các module quản trị: Overview, Products, Skin Quiz, AI Consultant, Home Content, Users và Analytics, cùng API audit hiện có. Chuẩn bị deploy không bổ sung tính năng nghiệp vụ còn thiếu sẵn trong các module.
- Database mới chỉ nhận `data/products.seed.json` gồm 10 mỹ phẩm, không tạo tài khoản mẫu. Database có sản phẩm sẽ không bị ghi đè.

## Build, Start và môi trường

Build Command:

```sh
pip install -r requirements.txt
```

Start Command:

```sh
uvicorn backend.main:app --host 0.0.0.0 --port $PORT --workers 1 --proxy-headers --forwarded-allow-ips='*'
```

Render là reverse proxy tin cậy của service; tùy chọn forwarded headers phục vụ URL HTTPS và kiểm tra Origin đúng sau proxy. Không dùng cấu hình tin mọi proxy này khi mở trực tiếp Uvicorn ra Internet ngoài Render.

| Biến | Giá trị trên Render |
| --- | --- |
| `PYTHON_VERSION` | `3.12.8` |
| `APP_ENV` | `production` |
| `COOKIE_SECURE` | `true` (production luôn bật Secure) |
| `GEMINI_API_KEY` | Key của bạn, nhập trong Render Environment; không commit |
| `GEMINI_MODELS` | Các model ID khả dụng trong project Gemini, phân cách bằng dấu phẩy, theo thứ tự ưu tiên |
| `DATABASE_PATH` | `/var/data/glowguide.db` khi dùng disk |
| `UPLOAD_DIR` | `/var/data/uploads` khi dùng disk |
| `CORS_ORIGINS` | Bỏ trống cho cùng tên miền; nếu cần, danh sách origin HTTPS chính xác, không có dấu `/` cuối |
| `PORT` | Render tự cấp, không cần đặt thủ công |

`GEMINI_MODEL` vẫn được hỗ trợ khi không có `GEMINI_MODELS`. Không sửa danh sách model trong `.env` cá nhân. Kiểm tra model hiện được cấp cho API project trước deploy; không giả định mọi model ID trong cấu hình local đều khả dụng.

## Các bước GitHub → Render

1. Kiểm tra `git status --short` và `git ls-files '*.db' '*.sqlite*' '.env'` trước khi commit. `.gitignore` bảo vệ database, backup, dữ liệu local, `.env` và upload runtime; chỉ seed sản phẩm được đưa lên Git. Không commit file database thật hay tài khoản. Nếu đã từng commit secret ở lịch sử khác, cần thu hồi key và xử lý lịch sử đó riêng; `.gitignore` không gỡ file đã tracked.
2. Commit source, seed, ảnh tĩnh, requirements, `render.yaml`, tài liệu và tests lên GitHub.
3. Trên Render chọn **New → Blueprint**, kết nối repository và dùng `render.yaml`. Blueprint đề xuất **Starter với disk 1 GB có phí**, không tự tạo dịch vụ hay phát sinh phí từ workspace này. Nhập Gemini key và danh sách model khi Render yêu cầu.
4. Hoặc chọn **New → Web Service**, kết nối repository, runtime Python, Root Directory để trống, điền Build/Start ở trên, health check `/api/health`, rồi thêm các biến môi trường.
5. Với cấu hình lâu dài, chọn instance trả phí và thêm disk mount `/var/data`. Disk chỉ dùng lúc runtime; không chạy khởi tạo DB trong Build Command. Dùng một worker/một instance cho SQLite.
6. Deploy. URL `https://<service-name>.onrender.com/` phục vụ toàn bộ ứng dụng. Tạo Admin mới trong **Render Shell** bằng `python -m backend.create_admin`; mật khẩu được nhập ẩn và hash Argon2. Không mang tài khoản cá nhân lên GitHub. Không có endpoint tạo Admin công khai hay mật khẩu mặc định.
7. Kiểm tra Home, Products, Product Detail, Quiz, AI Consultant, Cart, Register/Login/Logout; đăng nhập Admin và thử cả 7 module. Xem `/api/health`; xác nhận `.env`, `/data/glowguide.db`, `/backend/main.py` đều trả 404.
8. Với custom domain, cấu hình tại Settings → Custom Domains và DNS theo Render. Frontend vẫn dùng API cùng origin, không cần thay hostname trong JS.

## Lưu trữ và sao lưu

Render Free dùng filesystem tạm thời, không gắn persistent disk. **Tài khoản, phiên, chỉnh sửa catalog/quiz/nội dung và ảnh upload có thể mất sau restart/redeploy.** Chỉ dùng Free làm demo, không lưu dữ liệu người dùng cần giữ.

Nếu tạo service Free thủ công, bỏ cấu hình disk, đặt `DATABASE_PATH=/tmp/glowguide/glowguide.db`, `UPLOAD_DIR=/tmp/glowguide/uploads`; giữ `APP_ENV=production`. Không dùng các giá trị `/var/data` khi chưa gắn disk. Service mới sẽ seed lại 10 sản phẩm khi mất database. Việc tạo Admin cần môi trường có quyền chạy lệnh tương ứng; workflow được kiểm tra và mô tả ở đây dùng Render Shell trên service trả phí.

Phương án đã triển khai trong source: SQLite và upload dùng thư mục riêng trên cùng persistent disk; database local tiếp tục ở `data/glowguide.db`, không di chuyển hoặc reset. Seed và 5 ảnh có sẵn nằm trong Git, không phụ thuộc disk. Năm ảnh còn thiếu từ trước được thay bằng placeholder rõ ràng trong seed; cần bổ sung ảnh thật trước khi giới thiệu đầy đủ catalog.

Backup online:

```sh
python -m backend.backup_database
```

Lệnh dùng SQLite backup API và kiểm tra integrity. Backup ở cạnh database trong `backups/` là bản sao nội bộ; tải bản sao và thư mục upload ra kho lưu trữ riêng có kiểm soát truy cập, mã hóa và chính sách giữ bản sao. Backup nằm cùng disk không bảo vệ được trường hợp mất disk. Không public đường dẫn backup hoặc commit vào Git. Khi khôi phục, dừng ghi dữ liệu, sao lưu bản hiện tại, kiểm tra bản khôi phục rồi mới thay file bằng thao tác vận hành riêng.

Phương án mở rộng: PostgreSQL được quản lý cho database; S3/R2 hoặc Cloudinary cho ảnh. Chưa tích hợp các dịch vụ này vì cần tài khoản/cấu hình ngoài và chuyển đổi SQL/migration để giữ dữ liệu an toàn. Không chỉ đổi `DATABASE_PATH` sang URL PostgreSQL: driver hiện tại là SQLite.

Render xác nhận filesystem tạm thời tại [Deploys](https://render.com/docs/deploys), giới hạn Free tại [Deploy for Free](https://render.com/docs/free), cấu hình disk tại [Persistent Disks](https://render.com/docs/disks).

## Chạy local và kiểm thử

```sh
pip install -r requirements-dev.txt
uvicorn backend.main:app --reload
```

Mở `http://127.0.0.1:8000/`. Giữ `APP_ENV=development` cho HTTP local. Frontend nay nên chạy qua FastAPI để API tương đối cùng origin hoạt động; không mở HTML bằng `file://` hoặc dùng Live Server làm server chính.

```sh
python -m unittest discover -s tests -v
```

Tests tạo database riêng trong `data/test-<uuid>/`, không dùng DB thật và không gọi Gemini thật. Các thư mục này bị Git bỏ qua; có thể giữ để kiểm tra sau test. Kiểm tra fallback dùng mock hai model: model đầu lỗi 503, model sau thành công.

## Kết quả thực tế ngày 30/10/2026

- 5 nhóm kiểm thử tự động đạt: trang và liên kết/tài nguyên nội bộ; 10 sản phẩm và ảnh; auth/phân quyền/API quản trị/upload/khóa user/logout; chặn origin ngoài; Gemini fallback và phản hồi 503 khi chưa cấu hình.
- Test chạy qua FastAPI TestClient với URL HTTPS, không phải trình duyệt thật hoặc chứng chỉ TLS Render. Chưa kiểm thử thao tác UI Cart/Quiz/Admin bằng trình duyệt; các file và luồng hiện có được giữ lại.
- Gọi Gemini thật thất bại `ConnectError` cả trong và ngoài sandbox. Chưa xác nhận được API key, quota hay model thực tế hoạt động từ Render. Không đưa API key vào output.
- Chưa tạo dịch vụ Render, chưa publish GitHub, chưa có link HTTPS công khai. Cần chủ tài khoản kết nối repo, nhập secrets và chọn gói hosting theo hướng dẫn.
- Một số chỉ số/tính năng có giới hạn từ trước: quiz submissions trong analytics là 0, AI test Admin trả trạng thái hướng dẫn, home content chưa bảo đảm được mọi vùng giao diện sử dụng. Không báo các mục này là đã hoàn thiện nghiệp vụ.
- Bản sao trước chỉnh sửa: `data/backups/pre_render_20261030.db`, integrity `ok`. SHA256 database gốc trước/sau: `bc1309a8ac9a2cb3721a7c7cfed9e7dace3f8a96a9c14253ee3480533c643456`.

## File tạo/sửa

Tạo: `backend/config.py`, `backend/backup_database.py`, `requirements.txt`, `requirements-dev.txt`, `.env.example`, `render.yaml`, `data/products.seed.json`, `frontend/images/product-placeholder.svg`, `tests/test_deployment.py`, tài liệu này và bản backup local bị ignore.

Sửa: `.gitignore`, `README.md`, `backend/main.py`, `backend/database.py`, `backend/auth_routes.py`, `backend/admin_routes.py`, `backend/services/auth_service.py`, `backend/services/ai_service.py`, `backend/requirements.txt`; frontend JS: `api.js`, `app.js`, `auth.js`, `product_detail.js`, `main.js`, `products.js`, `cart_page.js`, `skin_quiz.js`. Các file JS khác chỉ được chuẩn hóa kết thúc dòng trong bước chuyển đổi, không đổi logic. Requirements backend khóa các dependency trực tiếp theo phiên bản đã chạy kiểm thử; dependency bắc cầu vẫn do pip giải quyết.
