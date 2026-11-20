# Đảo Đèn Lồng — Day 12 AI SDLC (2A202603580 Đậu Phúc Đức)

> Video demo: (sẽ thêm ở Phase 4)

Game 3D góc nhìn thứ ba (Three.js). Mây, người giữ đèn đội nón lá treo đèn lồng nhỏ, gom đom đóm để thắp lại Đèn Lồng Lớn trên ba hòn đảo và tỏa sáng để xua Bóng Mực.

## Cài và chạy (Node ≥ 20; macOS, Linux, Windows)
```
npm ci
npm run dev        # mở game trong trình duyệt
npm test           # toàn bộ test (luật game + headless + tất định)
```
Headless theo Test Contract v1.0 (lệnh lấy từ `game.contract.json`):
```
node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```

## Điều khiển
| Phím | Việc |
|---|---|
| W A S D | đi theo hướng camera |
| Kéo chuột / ← → | xoay camera (độ nhạy chỉnh trong Cài đặt) |
| Space | nhảy |
| Shift | lướt (14 m/s trong 0.2 s, hồi 1.5 s) |
| E | nạp đom đóm vào đèn chưa sáng gần nhất (trong 2 m) |
| Q | tỏa sáng: tốn 3 đom đóm, choáng Bóng Mực trong 5 m, hồi 3 s |
| Esc / P | tạm dừng (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu) |

## Luật và cách tính điểm (số chuẩn Ticket-02)
- Ba Đêm: Đảo Bến (5 đèn, 300 s), Đảo Cau (6 đèn, 330 s), Đảo Chuông (7 đèn, 360 s). Thắng Đêm 3 thì tới Bình Minh. Thua thì chơi lại Đêm đó.
- Mang tối đa 10 đom đóm. Mỗi đèn cần 10, nạp nhiều lần được. Đèn sáng tạo vùng an toàn 6 m mà Bóng Mực không vào được.
- 3 Ngọn Lửa, hồi đầy đầu mỗi Đêm. Bóng Mực chạm thì −1 lửa, rơi một nửa đom đóm đang mang, bất tử 1.5 s. Rơi khỏi đảo thì −1 lửa và mất hết đom đóm.
- Gió Lạc (Đêm 2, 3) cướp tối đa 3 đom đóm khi Mây mang từ 5 trở lên. Bùa Gió tăng tốc lên 7.2 m/s và bỏ hồi chiêu Lướt trong 10 s.
- Điểm: +10 mỗi đom đóm **nạp** vào đèn, +100 mỗi đèn thắp, +5 mỗi Bóng Mực trúng Tỏa Sáng. Khi thắng một Đêm: + floor(giây còn lại) × 2 + 50 × Ngọn Lửa còn lại. Tổng điểm là tổng các Đêm đã thắng.

## Tuning
Mọi số trong `game.contract.json` khớp số chuẩn Ticket-02. Logic đọc trực tiếp từ file này. `fall_enabled: true` (rơi khỏi đảo bị phạt). Hằng số chuẩn không có khóa tuning (nhảy 7 m/s, trọng lực 20, lịch sinh…) nằm ở đầu `src/sim/game.js`.

## Kiểm chứng và harness
- Ghi chú, giả định, acceptance criteria, bảng truy vết: `docs/notes/phase-N.md`. Bằng chứng: `docs/proof/`.
- `npm run verify -- phase-N`: chạy test, headless 3 Đêm hai lần để so tất định, đo thời gian, ghi `docs/proof/phase-N/verify.md`.
- CI (`.github/workflows/ci.yml`): chạy test, headless hai lần để so tất định, và build trên ubuntu + macOS mỗi lần push.
- Harness AI: `AGENTS.md` (`CLAUDE.md` trỏ tới nó); Stop hook `.claude/hooks/stop-tests.mjs` chặn agent kết thúc khi `npm test` đỏ; skill `.claude/skills/verify` để chạy kiểm chứng và lưu bằng chứng trước khi gắn tag.

## Sáng tạo của tôi
(chưa có)
