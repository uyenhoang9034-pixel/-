# Chính Sách Bảo Mật (Security Policy) — Usagi Bot

Chính sách bảo mật này áp dụng cho mã nguồn và các dịch vụ vận hành của **Usagi Bot**.

---

## 📌 Phạm Vi Sử Dụng

- **Usagi Bot** là bot Discord độc quyền phục vụ nội bộ máy chủ **[Gia Đình Usagi](https://discord.gg/6HpRCSVj5D)**.
- Dự án không vận hành thương mại hay cung cấp dịch vụ bên ngoài.

---

## 🔒 Nguyên Tắc Bảo Mật

1. **Tuyệt đối không tiết lộ thông tin nhạy cảm**: Toàn bộ Token Discord Bot, thông tin xác thực cơ sở dữ liệu (PostgreSQL credentials), URL Webhook và Secret Key luôn được bảo vệ trong biến môi trường (`.env`), không commit lên kho mã nguồn công khai.
2. **Quyền riêng tư thành viên**: Dữ liệu người dùng (ngày sinh nhật, cấp độ, thông tin cá nhân) chỉ được lưu trữ nhằm phục vụ hoạt động nội bộ tại máy chủ và không chia sẻ ra ngoài.

---

## 🛡️ Báo Cáo Lỗ Hổng Bảo Mật

Nếu bạn phát hiện bất kỳ nguy cơ hoặc lỗ hổng bảo mật nào liên quan đến Usagi Bot:

- **Vui lòng không mở issue công khai** chứa chi tiết cách khai thác (exploit) hoặc thông tin nhạy cảm.
- **Kênh liên hệ trực tiếp**: Vui lòng nhắn tin trực tiếp cho Ban Quản Trị tại máy chủ Discord:
  👉 **[https://discord.gg/6HpRCSVj5D](https://discord.gg/6HpRCSVj5D)**

Cảm ơn bạn đã quan tâm và giúp giữ cho môi trường Usagi Bot luôn an toàn!
