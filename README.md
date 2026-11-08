# 🐰 Usagi Bot — Discord Bot Quản Trị & Giải Trí Độc Quyền

<div align="center">

[![Discord Server](https://img.shields.io/badge/Discord-Gia%20%C4%90%C3%ACnh%20Usagi-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/6HpRCSVj5D)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14%20Components%20V2-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Status](https://img.shields.io/badge/Status-Private%20Bot-red?style=for-the-badge)](#)

**Usagi Bot** là bot Discord độc quyền phục vụ quản trị và các hoạt động giải trí, tương tác tại máy chủ **[Gia Đình Usagi](https://discord.gg/6HpRCSVj5D)**.

</div>

---

## 📌 Giới Thiệu & Bản Quyền

- **Chủ sở hữu & Quản trị**: Bot thuộc quyền sở hữu, sử dụng và quản lý của **Hoàng Uyên (Em Chanh)**.
- **Mục đích lưu trữ**: Kho mã nguồn này được duy trì cho mục đích quản lý và vận hành cá nhân cho server riêng. **Chủ sở hữu không có nhu cầu code bot hộ, không nhận yêu cầu hỗ trợ kỹ thuật bên ngoài và không có nhu cầu chia sẻ mã nguồn cho bên thứ ba.**
- **Nguồn gốc ý tưởng (Credits)**: Dự án được tùy biến, phát triển và lấy ý tưởng từ nền tảng **Titan Bot** của tác giả gốc đã tạo ra repository ban đầu và chia sẻ.

---

## ✨ Các Tính Năng Nổi Bật

### 🌸 Hệ Thống Server Boost (Components V2)
- Thông báo vinh danh thành viên boost server với giao diện **Discord Components V2** tinh giản, không viền màu.
- Tự động gán role **TỶ PHÚ** độc quyền khi boost và tự động thu hồi khi hết hạn.
- Hỗ trợ bảng điều khiển cấu hình và lệnh test thông báo boost.

### 🎂 Hệ Thống Sinh Nhật Tự Động (Components V2)
- Tự động gửi lời chúc mừng sinh nhật vào đúng **00:00** hằng ngày (giờ Việt Nam GMT+7).
- Giao diện Components V2 xinh xắn kèm hình ảnh Usagi dễ thương, tự động tính tuổi và trao role chúc mừng sinh nhật trong ngày.
- Lệnh quản lý ngày sinh và gửi thông báo bù thủ công linh hoạt.

### 🔞 Xác Nhận Độ Tuổi 18+ (Tâm Sự Vùng Kín)
- Bảng nội quy `#xác-nhận-tuổi` chuẩn giao diện V2 với nút bấm màu xám bảo mật.
- Xác nhận một lần duy nhất để mở khóa không gian trò chuyện nhạy cảm và riêng tư.

### 🏰 Witch Hunter — Thế Giới Phù Thủy & Thợ Săn RPG
- **Bảng Ký Kết Khế Ước Chọn Phe**: Giao diện V2 hiện đại với 2 nút xám chọn phe Thợ Săn hoặc Phù Thủy.
- **Nghi Thức Thắp Nến Cầu Nguyện Hằng Ngày**: Giao diện V2, tích lũy điểm Bí Ngô và tỷ lệ nổ hũ Trăng Máu.
- **Thí Luyện Cuối Tuần: Giải Mã Cổ Ngữ**: Giao diện V2, bốc câu hỏi trắc nghiệm ẩn nhận thưởng Bí Ngô.
- Hệ thống thám hiểm (Expedition), đấu phép (Duel), chợ đen (Black Market) và săn Boss thế giới.

### 🛍️ Tiệm Role Icon & Tủ Đồ (Wardrobe)
- Menu sticky ghim cố định ở đáy kênh shop, tự động làm mới vị trí.
- Giao diện Tủ Đồ cá nhân giúp thành viên dễ dàng xem trước, trang bị hoặc gỡ bỏ role icon bất cứ lúc nào.

### 🎫 Hệ Thống Ticket Hỗ Trợ
- Giao diện tạo ticket tương tác trực quan, phân quyền hỗ trợ viên rõ ràng.
- Tự động lưu trữ lịch sử tin nhắn (transcript) phục vụ quản lý nội bộ.

### 🔊 Auto Voice (Join to Create)
- Tự động tạo kênh đàm thoại tạm thời khi thành viên vào phòng chờ.
- Bảng điều khiển trực tiếp cho phép chủ phòng đổi tên, khóa/mở, ẩn/hiện, kick và giới hạn slot phòng.
- Tự động dọn dẹp phòng trống khi không còn ai sử dụng.

### 🛡️ Quản Trị Server & Tiện Ích
- Bộ lệnh kiểm duyệt và xử lý vi phạm server.
- Bảng tự đổi biệt danh thành viên theo cú pháp quy định của server.
- Bảng xếp hạng cấp độ, bảng xếp hạng đóng góp (donate).

---

## 🛠️ Vận Hành Cơ Bản (Dành Cho Chủ Sở Hữu)

### Yêu cầu hệ thống:
- **Node.js**: Phiên bản 20 trở lên.
- **PostgreSQL**: Phiên bản 15 trở lên.

### Khởi động nhanh:
```bash
# 1. Cài đặt các thư viện
npm install

# 2. Cấu hình file môi trường (.env)
cp .env.example .env

# 3. Chạy kiểm tra database migration
npm run migrate:check

# 4. Khởi động bot
npm start
```

---

## 💬 Kết Nối & Trải Nghiệm

Mọi hoạt động và trải nghiệm thực tế của bot đều diễn ra tại máy chủ chính thức:
👉 **Tham gia máy chủ Discord:** **[https://discord.gg/6HpRCSVj5D](https://discord.gg/6HpRCSVj5D)**

---

<div align="center">

*Usagi Bot — Thiết kế riêng và đồng hành cùng Gia Đình Usagi.*

</div>
