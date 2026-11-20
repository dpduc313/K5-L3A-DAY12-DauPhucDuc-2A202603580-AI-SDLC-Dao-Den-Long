# Đảo Đèn Lồng — Day 12 AI SDLC (2A202603580 Đậu Phúc Đức)

> Video demo: (sẽ thêm ở Phase 4)

Game 3D góc nhìn thứ ba (Three.js). Mây, người giữ đèn đội nón lá treo đèn lồng nhỏ, gom đom đóm để thắp 5 Đèn Lồng Lớn của Đêm 1 – Đảo Bến và tỏa sáng để xua Bóng Mực.

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
| Kéo chuột / ← → | xoay camera |
| Space | nhảy |
| E | nạp đom đóm vào đèn gần nhất (trong 2.5 m) |
| Q | tỏa sáng: tốn 1 đom đóm, choáng Bóng Mực trong 6 m, hồi 2 s |
| R | chơi lại |

## Luật và cách tính điểm
- Mang tối đa 5 đom đóm. Mỗi đèn cần 5 đom đóm để thắp. Thắp đủ 5 đèn thì **thắng**.
- Có 3 ngọn lửa (máu). Bóng Mực chạm thì mất 1 lửa, rơi một nửa số đom đóm đang mang, sau đó bất tử 1.5 s. Hết lửa thì **thua**. Hết 300 s thì trời sáng và **thua**.
- Bóng Mực không vào được vùng 4 m quanh đèn **đã thắp**.
- Điểm: +10 mỗi đom đóm nhặt, +100 mỗi đèn thắp, +20 mỗi Bóng Mực bị choáng. Khi thắng cộng thêm +1 mỗi giây còn lại (làm tròn xuống) và +50 mỗi ngọn lửa còn lại.

## Tuning
Mọi số trong `game.contract.json` là số game đang dùng: logic đọc trực tiếp từ file này, không có bản sao trong code. `fall_enabled: false` vì đảo có rào vô hình ở mép (bán kính 30 m) nên không thể rơi. Không trường nào là `null`.

## Kiểm chứng và harness
- Bảng yêu cầu → bằng chứng: `docs/notes/phase-1.md`. Bằng chứng: `docs/proof/phase-1/`.
- CI (`.github/workflows/ci.yml`): chạy test, headless hai lần để so tất định, và build trên ubuntu + macOS mỗi lần push.
- Harness AI: `AGENTS.md` (`CLAUDE.md` trỏ tới nó), Stop hook `.claude/hooks/stop-tests.mjs` chặn agent kết thúc khi `npm test` đỏ.

## Sáng tạo của tôi
(chưa có)
