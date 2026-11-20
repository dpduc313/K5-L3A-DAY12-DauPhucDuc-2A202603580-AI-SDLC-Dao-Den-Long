# CHANGELOG

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
