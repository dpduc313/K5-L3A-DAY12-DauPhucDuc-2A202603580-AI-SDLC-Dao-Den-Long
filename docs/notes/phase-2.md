# Phase 2 — Ticket-02 "Ba hòn đảo" (Contract v1.1)

## Thay đổi yêu cầu và ảnh hưởng tới thiết kế

Ticket-02 thay toàn bộ số tự chọn ở Phase 1 bằng số chuẩn, và thêm 3 Đêm cùng các tính năng mới.

- **Thiết kế:** bản đồ tách ra `src/sim/maps.js` (dữ liệu thuần, theo Phần 2). `src/sim/game.js` viết lại theo đúng "Thứ tự xử lý trong một tick". Bộ đếm chuyển sang tick nguyên để tránh sai số dấu phẩy động.
- **Đổi luật so với Phase 1:**
  - Điểm đom đóm cộng khi **nạp**, không còn cộng khi nhặt.
  - Đẩy lùi của Tỏa Sáng rải đều trong 15 tick, không còn tức thì.
  - Lịch sinh Bóng Mực đổi: 2 con ở tick 300, sau đó mỗi 480 tick.
  - Đảo có mép rơi: `fall_enabled` chuyển thành `true`.
  - Thắng được xét **trước** hết giờ trong cùng một tick.
- **Test cũ được sửa, kèm lý do ghi ngay trong `tests/rules.test.js`:**

  | Test | Sửa thế nào | Lý do |
  |---|---|---|
  | contract | kiểm `1.1` và 5 khóa mới | contract lên v1.1 |
  | tỏa sáng | kiểm sau 15 tick | đẩy lùi rải trong 15 tick |
  | hết giờ | dùng `simTick` | có pause nên đếm riêng `sim_tick` |
  | lịch sinh | thay bằng lịch chuẩn | lịch Phase 1 bị thay |

  Không test nào bị tắt.

## Giả định (chỗ ticket chưa quy định)

- Đêm 3 xuất phát ở (0, 0, −30), quay mặt về +Z, vì (0, 0, 0) là tháp chuông. **Cần hỏi trợ giảng.**
- `spawning` kéo dài đúng 1 tick: snapshot ở tick sinh thấy `spawning`, từ tick sau là `wander`.
- `wander`: Bóng Mực đứng yên tại chỗ. Chuyển sang `chase` khi Mây trong 12 m, về `wander` khi xa hơn 18 m.
- `player.invuln` trong snapshot là boolean (đang bất tử hay không).
- `night_start` ghi ở tick 0, ngay sau snapshot tick 0.
- Gió Lạc bị Tỏa Sáng lúc đang flee và có mang đồ: thả đom đóm thành đom đóm rơi (TTL 480), và Gió Lạc biến mất sau 120 tick.
- Gió Lạc idle lượn 2 m/s về một điểm sương ngẫu nhiên (điểm sinh Bóng Mực của Đêm đó).
- Gió mạnh bắt đầu ở sim_tick 1800, 3600, …; hướng là số nguyên độ ngẫu nhiên theo seed.
- Bóng Mực bay theo địa hình (y = mặt đất + 1), không bị vách chặn.
- Có vật cản (tháp chuông) thì Mây không đi vào được.

## Acceptance criteria cho Phần 3 và cách kiểm chứng

| Mục | Tiêu chí nghiệm thu | Kiểm chứng | Kết quả |
|---|---|---|---|
| Gió Lạc | Mây mang ≥ 5 và trong 15 m thì Gió Lạc đuổi; chạm thì cướp min(3, mang) và flee; Tỏa Sáng lúc flee làm thả lại | scenario `Gió Lạc…` (`tests/scenarios.test.js`) | đạt |
| Bùa Gió | Nhặt C1 thì có `charm_picked`, tốc độ 7.2 m/s, bùa biến mất và hồi sau 2700 tick | scenario `Bùa Gió…` | đạt |
| Lướt | 14 m/s trong 12 tick, có event `dash`, hồi 1.5 s | scenario `Lướt…` | đạt |
| Rơi khỏi đảo | −1 lửa, mất hết đom đóm, chờ 60 tick rồi hồi sinh ở điểm xuất phát với bất tử | scenario `Rơi khỏi đảo…` | đạt |
| Bục nhảy | Bay từ đảo A sang đảo B và đáp đất | scenario `Bục nhảy Đêm 2…` | đạt |
| Gió mạnh Đêm 3 | Bật ở tick 1800, có hướng | scenario `Gió mạnh…` | đạt |
| Tạm dừng | `tick` tăng, `sim_tick` đứng, state `paused`, có `paused`/`resumed` | scenario `Tạm dừng…` | đạt |
| Chuỗi 3 Đêm | Menu → giới thiệu (Ông Đăng) → chơi → kết quả → Đêm kế; thắng Đêm 3 thì Bình Minh; thua thì chơi lại | chơi tay | **chưa có bằng chứng** (cần người chơi) |
| Cài đặt | Âm lượng và độ nhạy chuột lưu trong localStorage | chơi tay | **chưa có bằng chứng** |
| Âm thanh | Nhạc nền + 10 hiệu ứng (WebAudio tổng hợp) | chơi tay | **chưa có bằng chứng** |
| HUD đầy đủ | lửa, đồng hồ mm:ss đỏ nhấp nháy khi ≤ 30 s, đèn k/n, điểm, thanh 10 ô, hồi chiêu, nhắc E, mũi tên | ảnh `docs/proof/phase-2-dem*.png` | đạt một phần (ảnh có đủ trừ nhắc E và đồng hồ đỏ) |
| Bảng màu | Màu theo bảng chuẩn | hằng `C` trong `src/web/main.js` | đạt (theo mã) |
| Ánh sáng tăng theo tiến độ | 0.15 + 0.55 × (sáng / tổng) | `src/web/main.js` | đạt (theo mã) |

## Bảng truy vết Contract v1.1 / số chuẩn

| Yêu cầu | Bằng chứng | Kết quả |
|---|---|---|
| Tuning khớp số chuẩn, 5 khóa mới | test contract; `game.contract.json` | đạt |
| `--night 1/2/3`, `night_start` | scenario `night_start…` | đạt |
| Trường snapshot mới (night, wind, player.*, motes, drifters, charms) | scenario `night_start và các trường snapshot` | đạt |
| Trạng thái Bóng Mực spawning/wander/chase/recoil/stunned | code + scenario recoil, lịch sinh | đạt |
| Điểm chuẩn | scenario `Điểm chuẩn…` | đạt |
| Đom đóm 20 lúc đầu, +1 mỗi 240 tick | scenario `Đom đóm…` | đạt |
| Vùng an toàn 6 m, đẩy ra trong 30 tick | scenario `Vùng an toàn…`, test rules | đạt |
| Recoil 2 m / 60 tick | scenario recoil | đạt |
| 1 Đêm ≤ 30 s | `docs/proof/phase-2/verify.md` | đạt (≈ 0.4 s) |
| Tất định 3 Đêm | `verify.md` + CI | đạt |
| Regression test Phase 1 với số chuẩn | `npm test` (29 test) | đạt |
| ≥ 30 FPS ở 1280×720 | mở `?night=3&fps` trên máy có GPU | **chưa đo** (Chrome headless dùng CPU nên không đại diện) |

## Đánh giá nhanh

- AI (Claude) viết sai 2 kỳ vọng test: phép đếm `sim_tick` sau pause, và vị trí recoil. Phát hiện bằng cách chạy test rồi in vết theo từng tick. Lỗi nằm ở kỳ vọng, không ở code, nên chỉ sửa kỳ vọng kèm giải thích.
- AI viết sót bug ở bản nháp: so cạnh nút pause sau khi đã ghi đè `prevInput`, và để Bóng Mực đang bị đẩy ra vẫn đuổi. Phát hiện khi tự rà diff và khi soạn scenario.
