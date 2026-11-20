# Phase 3 — Ticket-03 "Đèn cạn dầu" (Change Request, Contract v1.2)

Quyết định thiết kế: [ADR 0001](../adr/0001-mo-hinh-den-nhien-lieu-va-luat-thang.md). Breaking changes: [CHANGELOG.md](../../CHANGELOG.md).

## Luật bị thay và test bị ảnh hưởng

| Luật cũ [THAY THẾ] | Test cũ | Xử lý | Lý do |
|---|---|---|---|
| Thắng ngay khi mọi đèn sáng (`all_lit`) | `rules.test.js` "thắp hết thì thắng all_lit" | **sửa** thành "thắp hết đèn không kết thúc Đêm" | Ticket-03 §3: không còn thắng sớm |
| Công thức điểm Ticket-02 | `scenarios.test.js` "Điểm chuẩn" | **xóa**, comment chỉ tới test thay thế | Ticket-03 §5 thay toàn bộ công thức điểm |
| Contract v1.1 | `rules.test.js` contract | **sửa** sang v1.2 + 8 khóa mới | Ticket-03 §7 |
| Đèn sáng không nhận thêm đom đóm | (không có test riêng) | thêm test châm dầu | §1 |
| Bóng Mực không bao giờ vào vùng an toàn | `rules.test.js` safe_radius: vẫn đạt (đèn fuel 100) | giữ, thêm test ngưỡng 30 | §2 |

Không test nào bị `skip`.

## Thay đổi sau tag phase-2 (theo trợ giảng P2), nằm trong tag phase-3
- `spawning` kéo dài 3 s; `wander` di chuyển ngẫu nhiên; `player.invuln` tính bằng giây; Đêm 3 xuất phát ở (0, 0, −30). Test: `tests/tro-giang-p2.test.js`.
- Ảnh FPS và Cài đặt của Phase 2 (`docs/proof/phase-2/fps.png`, `volume.png`) được commit lúc 15:56, sau tag `phase-2`.

## Giả định Phase 3
- Bóng wander đi tới đèn (yếu hoặc tắt) với tốc độ wander 1.5 m/s. Khi đã ở trong 2 m của một đèn tắt thì lượn tại chỗ.
- Châm dầu đẩy bóng ra khỏi vùng 6 m chỉ khi dầu đi từ dưới 30 lên ≥ 30.
- `fuel_drain.fuel` là lượng dầu sau khi bị hút ở tick đó.
- `per_second_left: 0` trong tuning vì thưởng thời gian đã bị bỏ.

## Acceptance criteria và bằng chứng (`tests/phase3.test.js`)

| Yêu cầu | Tiêu chí | Kết quả |
|---|---|---|
| Dầu hao 1/s, hết thì tắt | fuel 2 → tắt ở tick 120, `deposited = 0`, `ever_lit = true`, có `lantern_out` | đạt |
| Châm dầu | used = min(mang, ceil((100−fuel)/10)), +5/đom đóm, có `refuel` | đạt |
| Đèn đầy không được chọn | không có event, không có điểm | đạt |
| Thắp lại | cần 5, +40, `relight: true`, `relit_count` + 1 | đạt |
| Drain | wander tới đèn fuel < 30, hút 5/s cộng hao 1/s, `fuel_drain` mỗi 60 tick | đạt |
| Ngưỡng vùng an toàn | fuel ≥ 30 vẫn chặn, < 30 không chặn | đạt |
| Pulse vào bóng đang drain | +15 | đạt |
| Luật thắng | 3/5 → `dawn_survived`; 2/5 → `dawn`; ngưỡng 4/6 và 5/7 | đạt |
| Điểm bình minh | 50 + floor(fuel) mỗi đèn sáng + 50 mỗi lửa | đạt |
| Sức chứa | 10 + 2 × lần thắp, tối đa 20 | đạt |
| Hiển thị: thanh dầu, nhấp nháy 1 Hz khi < 30, đèn tắt xẹp 20% + vết rách | xem mã `src/web/main.js` | đạt theo mã, **chưa có ảnh** |
| Chế độ mù màu (#00B3FF, cảnh báo trắng + ⚠, lưu cài đặt) | xem mã | đạt theo mã, **chưa có ảnh** |
| Mũi tên chỉ đèn ngoài màn hình | ảnh `docs/proof/phase-3/dem1.png` + kiểm tra DOM (xem dưới) | đạt. Lúc tag `phase-3` tôi ghi nhầm là "chưa đạt", xem mục Đánh giá |

## Đánh giá nhanh
- AI viết một **test giả** (`assert.ok(end.score >= 0)`) cho trường hợp đèn đầy dầu, vì không dựng được tình huống qua scenario. Tự phát hiện khi đọc lại test, rồi thay bằng test trên sim.
- AI quên cập nhật validate của headless cho state `drain`, nên scenario hợp lệ bị thoát mã 2. Test scenario phát hiện lỗi này.
- **AI chẩn đoán sai "lỗi mũi tên"** (sau tag phase-3). AI cho rằng đèn gần nhất lúc xuất phát là L1 (0, 0, 25), đang thấy trên màn hình, nên mũi tên không được hiện. Kiểm lại bằng số đo thay vì nhìn ảnh:
  1. Tính phép chiếu bằng Node với đúng camera của game: L1 nằm trong màn hình (NDC 0; 0.61).
  2. Tạm ghi debug vào `data-dbg` của mũi tên, rồi `chrome --headless --dump-dom`: `L3 1.320 1.125 1.022`. Đèn gần nhất là **L3**, cách 24.98 m < 25 m, nằm sau lưng camera (z > 1) ở phía +X (bên trái màn hình). Vậy mũi tên ở dưới bên trái là đúng.

  Bài học: trước khi "sửa" một lỗi hiển thị, phải đo xem nó có thật không. Đã gỡ dòng debug; giữ `camera.updateMatrixWorld()` trước khi chiếu.
