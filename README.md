# Lumi Book Tab

Lumi là app đọc sách lofi với frontend Next.js và backend riêng bằng Node.js, Express, MongoDB. Dữ liệu user không còn lưu bằng `localStorage`; sách đã lưu, tiến độ đọc và playlist nhạc được lấy từ server theo tài khoản Google.

## Cấu trúc

```txt
app/                  Frontend Next.js App Router
components/           UI đọc sách, bookshelf, music player
lib/api-client.ts     Client gọi Express API
server/src/           Backend Express + MongoDB + Google OAuth
sachmoi_books.json    Nguồn seed sách ban đầu
```

## Biến môi trường

Tạo file `.env` ở root dự án, có thể copy từ `.env.example`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/lumi-book-tab
SESSION_SECRET=change-this-session-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
SERVER_URL=http://localhost:4000
CLIENT_URL=http://localhost:3000
PORT=4000
SEED_BOOKS_ON_START=false
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

Trong Google Cloud Console, OAuth redirect URI cần là:

```txt
http://localhost:4000/api/auth/google/callback
```

## Cài dependencies

```bash
pnpm install
```

Hoặc dùng npm nếu bạn không dùng pnpm:

```bash
npm install
```

## Chạy MongoDB

Chạy MongoDB local trước:

```bash
mongod
```

Hoặc dùng MongoDB Atlas và đổi `MONGODB_URI`.

## Tạo collection/index và seed sách

Sau khi MongoDB và `.env` sẵn sàng:

```bash
npm run db:init
```

Bạn cũng có thể đặt:

```env
SEED_BOOKS_ON_START=true
```

để backend tự seed khi start.

## Chạy backend

```bash
npm run server:dev
```

API chạy tại:

```txt
http://localhost:4000/api
```

Các nhóm API chính:

- `GET /api/auth/me`
- `GET /api/auth/google`
- `POST /api/auth/logout`
- `GET/POST/PUT/DELETE /api/books`
- `GET/POST/DELETE /api/bookmarks`
- `GET/PUT/DELETE /api/progress/:bookId`
- `GET/POST/PATCH/DELETE /api/playlists`
- `POST /api/playlists/:playlistId/tracks`
- `DELETE /api/playlists/:playlistId/tracks/:trackId`
- `GET/PATCH/DELETE /api/users/me`
- `GET/PATCH/DELETE /api/users/:id` cho admin

## Chạy frontend

Ở terminal khác:

```bash
npm run dev
```

Frontend chạy tại:

```txt
http://localhost:3000
```

Luồng dùng app:

1. Mở frontend.
2. Đăng nhập bằng Google.
3. Vào tab `Discover` để tìm/filter sách và bookmark.
4. Vào tab `Library` để xem sách đã lưu, tiến độ đọc và playlist cá nhân.
5. Mở sách để đọc; tiến độ trang sẽ được lưu qua API.

## Kiểm tra build

```bash
npx tsc --noEmit
npm run build
```
