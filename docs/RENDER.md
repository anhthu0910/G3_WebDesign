# Chạy local và triển khai GlowGuide trên Render

## Chạy local từ máy mới

Ứng dụng dùng Python/FastAPI để phục vụ cả website và API. Không cần cài Node.js, không mở file HTML trực tiếp bằng `file://` và không dùng Live Server làm web server.

### 1. Cài Python và mở đúng thư mục dự án

Cài Python 3.12 (64-bit) và Git nếu máy chưa có. Trên Windows, chọn thêm Python vào `PATH` khi cài. Mở PowerShell tại thư mục gốc `G3_WebDesign` — thư mục có `requirements.txt` và `backend\main.py` — rồi kiểm tra:

```powershell
py -3.12 --version
Test-Path .\backend\main.py
```

Lệnh thứ hai phải trả về `True`. Nếu `py` không được nhận diện, cài Python 3.12 từ python.org, mở PowerShell mới và thử `python --version`; dùng lệnh `python` thay cho `py -3.12` ở các bước dưới đây nếu phiên bản là 3.12.

### 2. Tạo môi trường riêng và cài dependencies

Chạy tại thư mục gốc dự án:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements-dev.txt
```

Nếu PowerShell chặn kích hoạt môi trường, chỉ cho phép script trong cửa sổ hiện tại rồi kích hoạt lại:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

Khi kích hoạt thành công, đầu dòng lệnh có tiền tố `(.venv)`. Cần cài lại dependencies sau khi clone dự án trên máy khác; môi trường `.venv` không nằm trong Git.

### 3. Khởi động website

```powershell
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Giữ cửa sổ này mở trong lúc sử dụng. Khi thấy Uvicorn báo đang chạy tại `http://127.0.0.1:8000`, mở:

- Website: <http://127.0.0.1:8000/>
- Sức khỏe API: <http://127.0.0.1:8000/api/health>
- Danh sách sản phẩm: <http://127.0.0.1:8000/api/products>
- Tài liệu API khi chạy local: <http://127.0.0.1:8000/docs>

Lần chạy đầu tự tạo `data/glowguide.db` và `data/uploads`, sau đó nạp seed 10 sản phẩm. Database và dữ liệu runtime bị Git bỏ qua; không cần cài SQLite riêng. Nếu đã có database, ứng dụng dùng lại database đó.

Để kiểm tra nhanh trong một cửa sổ PowerShell khác:

```powershell
(Invoke-RestMethod http://127.0.0.1:8000/api/health).status
(Invoke-RestMethod http://127.0.0.1:8000/api/products).products.Count
```

Kết quả mong đợi lần lượt là `ok` và số lượng sản phẩm lớn hơn 0.

### 4. Chạy kiểm thử

Mở PowerShell thứ hai tại thư mục gốc dự án, kích hoạt cùng môi trường ảo rồi chạy:

```powershell
.\.venv\Scripts\Activate.ps1
python -m unittest discover -s tests -v
node tests/cart_isolation.cjs
node tests/cart_transition.cjs
```

Kết quả thành công kết thúc với `OK`. Bộ test dùng database kiểm thử riêng và mock các lời gọi AI; không cần cấu hình Gemini API key. Nếu PowerShell chặn kích hoạt, dùng cách `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` ở bước 2.

Hai lệnh `node` kiểm tra giỏ hàng và cách chấm điểm quiz phía trình duyệt; cần cài Node.js 18 trở lên. Mỗi lệnh in ra một dòng `... passed.` khi đạt. Lệnh `discover` chỉ tìm file có tên bắt đầu bằng `test_`, nên hai file `.cjs` phải chạy riêng như trên.

### macOS/Linux

Tại thư mục gốc dự án, dùng Python 3.12 thay cho lệnh `py` và lệnh activate tương ứng:

```sh
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements-dev.txt
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Trong terminal khác, kích hoạt lại `.venv` rồi chạy `python -m unittest discover -s tests -v`, `node tests/cart_isolation.cjs` và `node tests/cart_transition.cjs`.

### AI Consultant (tùy chọn)

Các trang, API sản phẩm và bộ kiểm thử chạy được mà không cần Gemini API key. Để dùng AI thật, sao chép `.env.example` thành `.env`, điền `GEMINI_API_KEY` cùng các model ID Gemini khả dụng vào `GEMINI_MODELS`, rồi khởi động lại server. Không chia sẻ hoặc commit `.env`. Nếu chưa cấu hình key, riêng chức năng AI sẽ không hoạt động.

### Nếu không mở được website

- Đảm bảo terminal đang ở thư mục gốc dự án và môi trường `(.venv)` đã được kích hoạt.
- Nếu thấy `No module named uvicorn` hoặc thiếu package, chạy lại `python -m pip install -r requirements-dev.txt` trong đúng môi trường ảo.
- Nếu cổng 8000 đang được dùng, đổi `--port 8001` rồi mở <http://127.0.0.1:8001/>.
- Xem lỗi trong terminal đang chạy Uvicorn; website chỉ hoạt động khi tiến trình này còn chạy.

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

## Kết quả thực tế ngày 30/10/2026

- 5 nhóm kiểm thử tự động đạt: trang và liên kết/tài nguyên nội bộ; 10 sản phẩm và ảnh; auth/phân quyền/API quản trị/upload/khóa user/logout; chặn origin ngoài; Gemini fallback và phản hồi 503 khi chưa cấu hình.
- Test chạy qua FastAPI TestClient với URL HTTPS, không phải trình duyệt thật hoặc chứng chỉ TLS Render. Chưa kiểm thử thao tác UI Cart/Quiz/Admin bằng trình duyệt; các file và luồng hiện có được giữ lại.
- Gọi Gemini thật thất bại `ConnectError` cả trong và ngoài sandbox. Chưa xác nhận được API key, quota hay model thực tế hoạt động từ Render. Không đưa API key vào output.
- Chưa tạo dịch vụ Render, chưa publish GitHub, chưa có link HTTPS công khai. Cần chủ tài khoản kết nối repo, nhập secrets và chọn gói hosting theo hướng dẫn.
- Một số chỉ số/tính năng có giới hạn từ trước: quiz submissions trong analytics là 0, AI test Admin trả trạng thái hướng dẫn, home content chưa bảo đảm được mọi vùng giao diện sử dụng. Không báo các mục này là đã hoàn thiện nghiệp vụ.
- Bản sao trước chỉnh sửa: `data/backups/pre_render_20261030.db`, integrity `ok`. SHA256 database gốc trước/sau: `bc1309a8ac9a2cb3721a7c7cfed9e7dace3f8a96a9c14253ee3480533c643456`.

## Kết quả kiểm thử ngày 13/11/2026

- 21 test Python đạt (`python -m unittest discover -s tests`), gồm các nhóm của ngày 30/10 và thêm: kiểm tra dữ liệu quiz, đếm lượt hỏi AI, click mua và lượt hoàn thành quiz, tính năng tài khoản người dùng, audit log cho quiz và nội dung trang chủ, lệnh `create_admin`.
- Hai test Node.js `cart_isolation.cjs` và `cart_transition.cjs` đạt.
- Lượt hoàn thành quiz nay đã được ghi vào bảng `quiz_completions` và hiển thị trên Admin Home; ghi chú "quiz submissions trong analytics là 0" ở mục ngày 30/10 không còn đúng.
- Audit log nay ghi cả thao tác tạo, sửa, xoá câu hỏi quiz và sửa nội dung trang chủ, ngoài sản phẩm và người dùng.
- `python -m backend.create_admin` báo "Username or email already exists." khi trùng tên hoặc email, thay vì dừng với lỗi `IntegrityError`.

## File tạo/sửa

Tạo: `backend/config.py`, `backend/backup_database.py`, `requirements.txt`, `requirements-dev.txt`, `.env.example`, `render.yaml`, `data/products.seed.json`, `frontend/images/product-placeholder.svg`, `tests/test_deployment.py`, tài liệu này và bản backup local bị ignore.

Sửa: `.gitignore`, `README.md`, `backend/main.py`, `backend/database.py`, `backend/auth_routes.py`, `backend/admin_routes.py`, `backend/services/auth_service.py`, `backend/services/ai_service.py`, `backend/requirements.txt`; frontend JS: `api.js`, `app.js`, `auth.js`, `product_detail.js`, `main.js`, `products.js`, `cart_page.js`, `skin_quiz.js`. Các file JS khác chỉ được chuẩn hóa kết thúc dòng trong bước chuyển đổi, không đổi logic. Requirements backend khóa các dependency trực tiếp theo phiên bản đã chạy kiểm thử; dependency bắc cầu vẫn do pip giải quyết.
