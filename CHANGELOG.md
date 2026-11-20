# CHANGELOG

## [phase-4] — v1.0.0, Ticket-04 "Bình minh: phát hành v1.0.0", Contract v1.3

### Thêm
- `contract_version` `"1.3"`; thêm `bench_cmd` (`node scripts/bench.mjs`) và `soak_cmd` (`node --expose-gc --single-threaded --max-semi-space-size=1 src/soak.js`).
- **Đổi `run_cmd`** từ `npm run dev` sang `node scripts/play.mjs`: npm nuốt cờ `--export-leaderboard` nếu không có `--`, nên `<run_cmd> --export-leaderboard out.json` không chạy được với lệnh cũ. `npm run dev` vẫn dùng được khi phát triển.
- Cảnh benchmark chuẩn trong sim (`createGame({ bench: true })`) và bản web (`?bench=1`), bộ chạy `scripts/bench.mjs`.
- Soak test `src/soak.js`.
- Bảng xếp hạng cục bộ top 10 (`leaderboard.json`), màn hình từ menu, nhập tên khi thua hoặc ở Bình Minh, lệnh xuất.
- Máy chủ tĩnh không phụ thuộc thư viện `scripts/serve.mjs`, dùng cho chơi, bench và bản phát hành.
- Dễ tiếp cận: đổi phím (báo trùng, khôi phục mặc định), phụ đề và mũi tên chỉ Bóng Mực mới, giảm chuyển động, chữ ≥ 18 px và tùy chọn ×1.25.

### Thay đổi
- Phím lướt mặc định đổi từ Shift sang F.
- HUD chỉ ghi DOM khi nội dung đổi: p1_low_fps cảnh bench từ 30 lên 130 trên máy tôi.

### Không đổi
- Luật, số tuning, đầu ra headless (đã so byte 3 Đêm), mọi yêu cầu v1.0–v1.2.

## Sửa lỗi sau tag phase-3 (nằm trong phase-4)

### Thay đổi hành vi
- **Mỗi lần ở trên không chỉ lướt được 1 lần**, chạm đất hoặc hồi sinh thì được lướt lại. Trước đây Bùa Gió bỏ hồi chiêu Lướt, còn lướt trên không giữ nguyên độ cao, nên lướt liên tục làm Mây bay lơ lửng mãi trên biển. Đầu ra headless chỉ đổi khi lướt lần thứ hai trước khi chạm đất. Test: `tests/scenarios.test.js` "Bùa Gió + lướt liên tục trên biển".

### Khác
- Bản web: mất focus thì xóa phím đang giữ và tự tạm dừng; thêm phím lướt F.
- Sáng tạo (chỉ bản web, headless không đổi): Đom Đóm Chúa và Đuốc. Xem README "Sáng tạo của tôi".

## [phase-3] — Ticket-03 "Đèn cạn dầu", Contract v1.2

### Breaking changes
- `contract_version` đổi thành `"1.2"`. Thời lượng Đêm 1/2/3 giảm từ 300/330/360 s xuống **240/270/300 s**.
- **Không còn thắng sớm.** `game_over.reason` không còn `all_lit`. Thắng có lý do `dawn_survived` (hết giờ và số đèn sáng ≥ ceil(0.6 × tổng)).
- Đèn sáng **có thể tắt** khi hết dầu (`lantern_out`), và khi tắt thì `deposited` về 0.
- Tương tác với đèn đang sáng nay là **châm dầu** (`refuel`), không còn bị bỏ qua.
- Vùng an toàn chỉ có ở đèn sáng có `fuel ≥ 30`.
- Bóng Mực có thêm trạng thái `drain`.
- **Công thức điểm thay toàn bộ**: +5 mỗi đom đóm nạp, +100 thắp lần đầu, +40 thắp lại, +5 hoặc +15 khi Tỏa Sáng trúng (15 nếu bóng đang drain). Khi thắng: +50 + floor(fuel) cho mỗi đèn sáng, +50 cho mỗi lửa. Bỏ thưởng thời gian.
- Sức chứa không cố định 10 nữa: bằng 10 + 2 × số lần thắp thành công, tối đa 20.
- Snapshot: đèn có thêm `fuel`, `ever_lit`, `relit_count`; player có thêm `capacity`; shade có thêm `target_lantern_id`.
- Event `lantern_lit` có thêm `relight`. Có thêm event `refuel`, `lantern_out`, `fuel_drain`.

### Khác
- Scenario nhận thêm `lanterns[].fuel`, `lanterns[].ever_lit`, `player.successful_lights`, `shades[].target_lantern_id`, và state `drain`.

## [phase-2] — Ticket-02 "Ba hòn đảo", Contract v1.1
- Số chuẩn, 3 Đêm, Lướt, Bùa Gió, Gió Lạc, gió mạnh, rơi khỏi đảo, tạm dừng. Xem `docs/notes/phase-2.md`.
- Sau tag `phase-2`, theo trợ giảng: `spawning` kéo dài 3 s, `wander` di chuyển, `player.invuln` tính bằng giây.

## [phase-1] — PRD-0, Contract v1.0
- Bản đầu: Đêm 1, headless theo contract v1.0.
