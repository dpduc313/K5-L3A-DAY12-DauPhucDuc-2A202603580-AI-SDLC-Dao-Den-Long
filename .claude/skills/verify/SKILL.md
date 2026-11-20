---
name: verify
description: Chạy toàn bộ kiểm chứng của Đảo Đèn Lồng (test, headless tất định, thời gian 1 Đêm) và lưu bằng chứng vào docs/proof/<phase>/. Dùng trước khi báo xong một tính năng và trước khi gắn tag phase.
---

# Kiểm chứng và lưu bằng chứng

1. Commit thay đổi code trước (báo cáo ghi hash commit; có thay đổi chưa commit thì báo cáo ghi rõ).
2. Chạy `node scripts/verify.mjs phase-N` (N là phase hiện tại). Lệnh thoát khác 0 khi có test đỏ.
3. Đọc `docs/proof/phase-N/verify.md`. Mọi Đêm phải "giống hệt" và ≤ 30 s.
4. Ảnh màn hình (nếu sửa phần hiển thị): `npm run build`, `npx vite preview --port 4173`, rồi Chrome headless
   `--window-size=1280,720 --screenshot=... "http://localhost:4173/?night=N"`. Ảnh lưu vào `docs/proof/`.
   FPS thật phải đo bằng trình duyệt có GPU: mở `?night=N&fps`, chơi 60 s, ghi số.
5. Cập nhật bảng truy vết trong `docs/notes/phase-N.md`: yêu cầu, cách kiểm chứng, bằng chứng, kết quả. Chưa đạt thì ghi "chưa đạt".

Không sửa tay file trong docs/proof; chỉ script sinh ra.
