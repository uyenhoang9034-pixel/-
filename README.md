# 🐰 Usagi Bot - Ultimate Community Discord Bot

<div align="center">

![Discord.js](https://img.shields.io/npm/v/discord.js?style=flat-square&labelColor=%23202225&color=%235865F2&logo=discord&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?style=flat-square&logo=postgresql&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20+-43853D?style=flat-square&logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

**Usagi Bot** là bot Discord đa chức năng mạnh mẽ, hiện đại, được xây dựng trên nền tảng **Discord.js v14** kết hợp chuẩn giao diện **Discord Components V2** và cơ sở dữ liệu **PostgreSQL** tối ưu hóa hiệu năng cao.

</div>

---

## 📑 Mục Lục
- [Tính Năng Nổi Bật](#-tính-năng-nổi-bật)
- [Cài Đặt & Khởi Chạy](#-cài-đặt--khởi-chạy)
  - [Chạy bằng Docker (Khuyên Dùng)](#chạy-bằng-docker)
  - [Chạy thủ công với Node.js](#chạy-thủ-công-với-nodejs)
- [Cấu Hình Môi Trường (.env)](#-cấu-hình-môi-trường-env)
- [Yêu Cầu Intents & Permissions](#-yêu-cầu-intents--permissions)
- [Bảo Mật & Đóng Góp](#-bảo-mật--đóng-góp)

---

## ✨ Tính Năng Nổi Bật

### 🌸 Hệ Thống Server Boost
- **Thông báo vinh danh V2**: Giao diện Container Components V2 thiết kế riêng, hiển thị số boost hiện tại và cấp độ server.
- **Tự động cấp & thu hồi role TỶ PHÚ**: Trao quyền lợi độc quyền ngay khi thành viên boost server và tự động thu hồi khi hết hạn.
- **Boost Dashboard trực quan**: Quản lý kênh thông báo, chỉnh sửa nội dung, test thông báo qua `/boost testboost` và `/boost setup`.

### 🎂 Hệ Thống Sinh Nhật (Birthday System)
- **Giao diện Components V2**: Thông báo sinh nhật xinh xắn với hình ảnh Usagi độc quyền.
- **Tự động quét hàng ngày**: Gửi lời chúc vào đúng 00:00 (Giờ Việt Nam - GMT+7).
- **Tính tuổi & trao Role**: Tự động tính số tuổi hiện tại và cấp role chúc mừng sinh nhật trong ngày.
- **Lệnh quản lý**: `/birthday set`, `/birthday list`, `/birthday send` (gửi thủ công/gửi bù).

### 🔞 Kênh Riêng Tư & Xác Nhận 18+ (Private Verification)
- **Chuẩn giao diện V2**: Bảng quy tắc `#xác-nhận-tuổi` với nút bấm màu xám chuẩn Discord.
- **Liên kết tuổi tự động**: Tự động đối soát với ngày sinh trong hệ thống Birthday để đảm bảo thành viên đủ 18 tuổi.
- **Tự động cấp quyền**: Phân quyền mở khóa kênh trò chuyện riêng tư chỉ với một lần xác nhận duy nhất.

### 🛍️ Tiệm Role Icon Usagi (Role Icon Shop)
- **Sticky Bottom Panel**: Bảng menu tự động ghim cố định ở đáy kênh shop.
- **Menu chọn Role Icon đa dạng**: Phân cấp và bảng giá rõ ràng.
- **Tủ Đồ Role Icon (Wardrobe)**: Giao diện xem trước, trang bị và gỡ bỏ icon cá nhân tiện lợi.
- **Tích hợp SePay Webhook**: Tự động nhận diện thanh toán ngân hàng và cập nhật số dư cho thành viên.

### 🏰 Witch Hunter (Thợ Săn Phù Thủy RPG)
- **Hệ thống phe phái**: Chọn phe Phù Thủy hoặc Thợ Săn với bộ kỹ năng riêng.
- **Đấu phép (Duel) & Thám hiểm (Expedition)**: Tranh tài kỹ năng, thu thập vật phẩm và nguyên liệu hiếm.
- **Giải mã & Bí ngô**: Sự kiện hàng tuần, cược tài lộc, Boss thế giới (World Boss).
- **Chợ đen (Black Market) & Tiền thưởng (Bounty)**: Giao dịch và săn lùng mục tiêu nhận thưởng.

### 🎫 Hệ Thống Ticket Hỗ Trợ
- **Giao diện Container V2**: Tạo ticket nhanh chóng, tự động phân loại phòng hỗ trợ.
- **Quản lý Staff**: Claim ticket, phân quyền hỗ trợ viên, giới hạn số ticket chống spam.
- **Transcript & Đánh giá**: Lưu trữ lịch sử chat hoàn chỉnh, gửi biểu mẫu đánh giá chất lượng phục vụ sau khi đóng.

### 🛡️ Quản Trị Server (Moderation)
- **Bộ công cụ xử lý vi phạm**: `/ban`, `/kick`, `/warn`, `/purge`, `/lock`, `/cases`.
- **Tự đổi biệt danh (Set Nickname Panel)**: Bảng tự phục vụ cho thành viên đổi biệt danh theo định dạng server.
- **Role phản ứng (Reaction Roles)**: Tự nhận vai trò qua nút bấm và select menu.

### 🔊 Auto Voice (Join to Create)
- Tự động tạo kênh Voice tạm thời khi thành viên vào phòng chờ.
- Bảng điều khiển tương tác trực tiếp (đổi tên phòng, khóa/mở, ẩn/hiện, giới hạn slot, kick thành viên).
- Tự động dọn dẹp phòng khi không còn người sử dụng.

### 🎵 Âm Nhạc 24/7 (Music System)
- Hỗ trợ Lavalink v4 và thư viện Riffy hiệu năng cao.
- Phát nhạc từ YouTube, Spotify, Soundcloud, Deezer với chất lượng ổn định.
- Bảng điều khiển phát nhạc bằng nút bấm (Pause, Resume, Skip, Queue, Volume).

### 📊 Leveling & Bảng Xếp Hạng
- Tích lũy điểm kinh nghiệm qua tin nhắn văn bản và thời gian đàm thoại voice chat.
- Bảng xếp hạng cấp độ, bảng xếp hạng nạp thẻ (bxhdonate).
- Tự động gán role danh hiệu khi đạt cấp độ tương ứng.

---

## 🚀 Cài Đặt & Khởi Chạy

### Chạy bằng Docker (Khuyên Dùng)

Usagi Bot được đóng gói container đầy đủ kèm theo cơ sở dữ liệu PostgreSQL:

1. **Clone mã nguồn:**
   ```bash
   git clone https://github.com/uyenhoang9034-pixel/-.git UsagiBot
   cd UsagiBot
   ```

2. **Cấu hình môi trường:**
   ```bash
   cp .env.example .env
   ```
   Điền ít nhất `DISCORD_TOKEN`, `CLIENT_ID`, và `GUILD_ID` trong file `.env`.

3. **Khởi chạy container:**
   ```bash
   docker compose up -d --build
   ```

4. **Kiểm tra trạng thái:**
   ```bash
   docker compose ps
   curl http://localhost:3000/health
   ```

---

### Chạy thủ công với Node.js

#### Yêu cầu hệ thống:
- **Node.js**: Phiên bản 20.10.0 trở lên.
- **PostgreSQL**: Phiên bản 15 trở lên.

1. **Cài đặt thư viện phụ thuộc:**
   ```bash
   npm install
   ```

2. **Cấu hình database & biến môi trường:**
   ```bash
   cp .env.example .env
   ```

3. **Kiểm tra và khởi chạy migration:**
   ```bash
   npm run migrate:check
   npm run migrate
   ```

4. **Khởi động Bot:**
   ```bash
   npm start
   ```

---

## ⚙️ Cấu Hình Môi Trường (.env)

```env
# Discord Bot
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_guild_id_here

# PostgreSQL Database
POSTGRES_URL=postgresql://postgres:password@localhost:5432/usagibot
POSTGRES_DB=usagibot
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_SSL=false

# Web & Webhook Server
PORT=3000
WEB_HOST=0.0.0.0
NODE_ENV=production
LOG_LEVEL=warn
```

---

## 🔑 Yêu Cầu Intents & Permissions

### Gateway Intents
- **Guilds**
- **Guild Members** *(Privileged)*
- **Guild Messages**
- **Message Content** *(Privileged)*
- **Guild Message Reactions**
- **Guild Voice States**
- **Direct Messages**

### Bot Permissions
- Administrator *(hoặc tối thiểu: Manage Server, Manage Roles, Manage Channels, Kick/Ban Members, Send Messages, Embed Links, Attach Files, Read Message History)*

---

## 📄 License
Phát hành theo giấy phép [MIT License](LICENSE).

<div align="center">

Dự án được bảo trì và phát triển bởi **Hoàng Uyên (Em Chanh)**.

</div>
