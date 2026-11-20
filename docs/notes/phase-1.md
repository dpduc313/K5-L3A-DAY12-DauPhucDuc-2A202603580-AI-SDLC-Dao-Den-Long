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

# Phase 1 — bảng truy vết yêu cầu → bằng chứng

| Yêu cầu (PRD-0 / Contract v1.0) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| `game.contract.json` đủ trường, 5 đèn | test `contract có đủ trường…` | `docs/proof/phase-1/npm-test.txt` | đạt |
| Tuning khai đúng số game dùng | sim đọc tuning trực tiếp từ contract (không có bản sao) | `src/headless.js`, `src/web/main.js` | đạt |
| CLI headless, snapshot từ tick 0, `--ticks N` = N bước, dòng end cuối | test headless | npm-test.txt | đạt |
| Inputs/scenario sai định dạng → exit 2 | test `exit 2` | npm-test.txt | đạt |
| Công thức quay `cam_yaw_deg`, chuẩn hóa move | test di chuyển | npm-test.txt | đạt |
| Nút kích hoạt khi false→true | test giữ nút | npm-test.txt | đạt |
| Nhặt đom đóm, giới hạn carry | test carry_capacity, test headless | npm-test.txt | đạt |
| Nạp, thắp đèn, thắng `all_lit` | test nạp đủ lantern_cost | npm-test.txt | đạt |
| Scenario không cộng điểm khi dựng | test lit:true | npm-test.txt | đạt |
| Tỏa sáng choáng + đẩy, event `pulse` | test tỏa sáng | npm-test.txt | đạt |
| `safe_radius` quanh đèn đã thắp | test Bóng Mực không vào | npm-test.txt | đạt |
| Bị chạm, `hit_drop_ratio`, `invuln_s`; thua `no_flames` | test bị chạm, hết lửa | npm-test.txt | đạt |
| Hết giờ thua `dawn`, `time_left_s` theo scenario | test hết giờ | npm-test.txt | đạt |
| Sinh Bóng Mực, `shade_spawned` | test random_shades | npm-test.txt | đạt |
| Tất định (cùng seed → output giống hệt) | test tất định + CI chạy 2 lần `cmp` | npm-test.txt, CI | đạt |
| Chạy trên macOS/Linux | CI ubuntu + macOS | tab Actions trên GitHub | chờ CI chạy |
| Game 3D chơi được: đi, nhảy, camera, HUD, thắng/thua, chơi lại | chơi thử bằng tay + ảnh chụp | `docs/proof/phase-1/*.png` | **chưa có bằng chứng** (người dùng chơi thử) |
| Mây đội nón lá treo đèn lồng | ảnh chụp | `docs/proof/phase-1/*.png` | **chưa có bằng chứng** |
| Stop hook chặn khi test đỏ | chạy hook với test đỏ giả | `docs/proof/phase-1/stop-hook-chan-khi-do.txt` | đạt |

Ghi chú tag: tag `phase-1` (d12bd98) đặt lúc 14:55, khi chưa có bản 3D, CI và Stop hook. Các phần này được thêm sau đó, trong lúc Phase 2 chưa mở.
