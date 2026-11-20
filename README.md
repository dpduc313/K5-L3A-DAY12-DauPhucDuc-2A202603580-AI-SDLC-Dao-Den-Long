# Đảo Đèn Lồng — Day 12 AI SDLC (2A202603580 Đậu Phúc Đức)

> Video demo: (sẽ thêm ở Phase 4)

Game 3D: Mây gom đom đóm, thắp 5 Đèn Lồng Lớn, né Bóng Mực. Phase 1 hiện có logic game và chế độ headless theo Test Contract v1.0.

## Cài và chạy (Node ≥ 20, macOS/Linux/Windows)
```
npm ci
npm test
node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl
```

## Cách tính điểm
+10 mỗi đom đóm nhặt, +100 mỗi đèn thắp, +20 mỗi Bóng Mực bị choáng. Khi thắng: +1 mỗi giây còn lại (làm tròn xuống) và +50 mỗi ngọn lửa (máu) còn lại.

## Điều khiển (bản 3D)
WASD di chuyển, chuột xoay camera, Space nhảy, E nạp đèn, Q tỏa sáng.

## Trạng thái Phase 1 (trung thực)
- Đạt: `game.contract.json`, headless (tất định, exit 2 khi file sai), luật nhặt/nạp/thắp/tỏa sáng/bị chạm/thắng/thua.
- **Chưa đạt ở tag phase-1:** bản render 3D chơi được, HUD, chơi lại. Làm tiếp ở phase sau.
- Giả định: xem `docs/notes/phase-1.md`.
