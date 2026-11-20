# AGENTS.md — Đảo Đèn Lồng

Game 3D, Node.js (JS thuần, ESM). Đề gốc: `docs/de-bai/`. Yêu cầu phase: lab board.

## Lệnh
- Cài: `npm ci`
- Test (một lệnh): `npm test`
- Headless: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario f.json] [--inputs f.json]`

## Cấu trúc
- `src/sim/` logic thuần: không `Math.random`, không `Date`, không DOM. Mọi ngẫu nhiên đi qua `mulberry32(seed)`.
- `src/headless.js` CLI theo Test Contract; `game.contract.json` là nguồn duy nhất của tuning.

## Quy tắc
- Đổi số trong code thì đổi `game.contract.json` cùng commit.
- Không sửa tay output, không viết test luôn đạt. Chưa đạt thì ghi "chưa đạt".
- Tính năng sáng tạo không được đổi đầu ra headless.
