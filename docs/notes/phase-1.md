# Phase 1 — giả định

- Đảo tròn bán kính 30 m; `fall_enabled=false`: người chơi bị chặn ở mép.
- 5 đèn trên vòng tròn bán kính 20 m. 30 đom đóm ngẫu nhiên theo seed.
- `pulse_cost` trừ vào số đom đóm đang mang; không đủ hoặc đang hồi chiêu thì không có pulse (không ghi event).
- `safe_radius` chỉ áp cho đèn **đã thắp**.
- Hết giờ (`dawn`) → `lost`.
- Bị chạm: mất 1 lửa, rơi `floor(carried × hit_drop_ratio)` đom đóm; số rơi xuất hiện lại ngẫu nhiên trên đảo.
- Một lần `interact` nạp tối đa đủ `lantern_cost` vào đèn chưa thắp gần nhất trong `interact_radius`.
- 2 Bóng Mực lúc đầu, thêm 1 con mỗi 30 s (tối đa 6) khi `random_shades` bật.
- Điểm thưởng giây/lửa còn lại chỉ cộng khi thắng.
