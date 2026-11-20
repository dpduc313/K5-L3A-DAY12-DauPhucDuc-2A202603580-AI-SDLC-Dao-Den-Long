# Kiểm chứng phase-3

- Commit: `641021d`
- Máy: win32 10.0.26300, Intel(R) Core(TM) i7-1065G7 CPU @ 1.30GHz, Node v22.16.0
- Lệnh: `node scripts/verify.mjs phase-3`

## Test (`npm test`)
pass 44, fail 0. Chi tiết: `npm-test.txt`.

## Headless: tất định và thời gian một Đêm đầy đủ (21.600 tick, seed 123, chạy 2 lần)
| Đêm | So 2 lần chạy | Thời gian | ticks | state |
|---|---|---|---|---|
| 1 | giống hệt | 0.34 s | 14400 | lost |
| 2 | giống hệt | 0.44 s | 16200 | lost |
| 3 | giống hệt | 0.53 s | 18000 | lost |

Ngưỡng Ticket-02: ≤ 30 s mỗi Đêm.
