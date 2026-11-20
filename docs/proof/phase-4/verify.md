# Kiểm chứng phase-4

- Commit: `7d31318`
- Máy: win32 10.0.26300, Intel(R) Core(TM) i7-1065G7 CPU @ 1.30GHz, Node v22.16.0
- Lệnh: `node scripts/verify.mjs phase-4`

## Test (`npm test`)
pass 59, fail 0. Chi tiết: `npm-test.txt`.

## Headless: tất định và thời gian một Đêm đầy đủ (21.600 tick, seed 123, chạy 2 lần)
| Đêm | So 2 lần chạy | Thời gian | ticks | state |
|---|---|---|---|---|
| 1 | giống hệt | 0.38 s | 14400 | lost |
| 2 | giống hệt | 0.51 s | 16200 | lost |
| 3 | giống hệt | 0.54 s | 18000 | lost |

Ngưỡng Ticket-02: ≤ 30 s mỗi Đêm.
