# ADR 0001 — Mô hình trạng thái đèn có nhiên liệu và luật thắng "giữ sáng tới bình minh"

- Ngày: 2026-11-20 (Phase 3, Ticket-03 "Đèn cạn dầu", Contract v1.2)
- Trạng thái: chấp nhận

## Bối cảnh
Đến Phase 2, đèn chỉ có hai trạng thái và chỉ đi một chiều: tắt → sáng (khi `deposited` đủ 10). Đêm kết thúc ngay khi mọi đèn sáng (`all_lit`). Ticket-03 cho đèn tắt lại được, và đổi mục tiêu thành giữ đủ đèn sáng tới bình minh.

## Quyết định
1. **Mô hình đèn**: `{ lit, deposited, fuel, everLit, relit }`. Chuyển trạng thái:
   - tắt → sáng: `deposited ≥ cost`, với `cost = everLit ? relight_cost (5) : lantern_cost (10)`. Khi đó `fuel = 100`, `everLit = true`, và `relit += 1` nếu là thắp lại.
   - sáng → sáng: châm dầu, `used = min(mang, ceil((100 − fuel) / 10))`.
   - sáng → tắt: `fuel ≤ 0` ngay sau bước 2 của tick. Khi đó `deposited = 0`, phát `lantern_out`.
2. **Dầu là số nguyên** theo đơn vị 1/60 (100 dầu = 6000). Mỗi tick đèn tự hao 1 đơn vị, mỗi bóng đang drain hút thêm 5 đơn vị. Chỉ làm tròn 1 chữ số thập phân khi ghi ra. Lý do: ticket khuyến nghị, và cách này tránh sai số trong so sánh `< 30` và `≤ 0`.
3. **Vùng an toàn** phụ thuộc dầu: đèn sáng có `fuel ≥ 30` mới chặn Bóng Mực. Hàm `blockSafe` chỉ cần thêm một điều kiện.
4. **Bóng Mực** có thêm trạng thái `drain`. Chỉ bóng đang `wander` mới chọn mục tiêu theo thứ tự: đèn sáng `fuel < 30` gần nhất → đèn tắt gần nhất → lượn ngẫu nhiên (giữ câu trả lời của trợ giảng P2). Ở `drain`, bóng đứng yên và lượng dầu bị hút được trừ ở bước 2.
5. **Luật thắng** chuyển khỏi bước "nạp đèn" sang một chỗ duy nhất là bước 11. Thứ tự: hết lửa → `no_flames`; hết giờ → đếm đèn sáng, nếu `≥ ceil(0.6 × n)` thì `dawn_survived`, ngược lại thì `dawn`. Không còn thắng sớm.
6. **Điểm** tính theo sự kiện ở đúng nơi phát sự kiện (deposit/refuel +5 mỗi đom đóm, thắp +100 hoặc +40, pulse +5 hoặc +15). Thưởng bình minh được cộng trong `end()`.

## Hệ quả
- Ba test cũ bị thay thế. Một test được sửa (không còn thắng sớm), một test bị xóa (công thức điểm cũ), test contract đổi sang v1.2. Lý do ghi ngay trong test.
- Tuning có `per_second_left: 0` vì thưởng thời gian đã bị bỏ.
- Giả định chưa được ticket quy định: tốc độ wander 1.5 m/s cũng dùng khi đi tới đèn; chạm tới đèn tắt thì lượn tại chỗ; đẩy bóng ra khi châm dầu chỉ áp dụng khi dầu đi từ dưới 30 lên ≥ 30.
