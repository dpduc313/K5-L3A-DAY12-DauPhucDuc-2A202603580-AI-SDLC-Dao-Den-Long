# AGENTS.md — Đảo Đèn Lồng

Game 3D, Node.js (JS thuần, ESM) + Three.js. Đề gốc: `docs/de-bai/`. Yêu cầu phase: lab board. Ghi chú phase: `docs/notes/phase-N.md`.

## Lệnh
- Cài: `npm ci` · Chơi: `node scripts/play.mjs` (run_cmd; build + máy chủ có API bảng xếp hạng) hoặc `npm run dev` (Vite). `?night=N` vào thẳng Đêm N, `?fps` đo FPS, `?bench=1` cảnh benchmark
- Bench: `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json` · Soak: lệnh `soak_cmd` trong contract · Bản phát hành: `npm run release`
- Test (một lệnh): `npm test`
- Kiểm chứng + bằng chứng: `node scripts/verify.mjs phase-N` (xem skill `verify`)
- Headless: `node src/headless.js --seed 1 --night 1|2|3 --ticks 600 --out out.jsonl [--scenario f.json] [--inputs f.json]`

## Cấu trúc
- `src/sim/game.js` luật, đúng "Thứ tự xử lý trong một tick" của Ticket-02 + bổ sung Ticket-03 (trừ dầu và tắt đèn ở bước 2; thắng/thua chỉ xét ở bước 11). Mô hình đèn: `docs/adr/0001-*.md`. Dầu lưu bằng đơn vị nguyên 1/60 (`F`).
- Luật mới đổi luật cũ: ghi ADR trong `docs/adr/`, breaking change trong `CHANGELOG.md`, bảng "test bị ảnh hưởng" trong `docs/notes/phase-N.md`. `src/sim/maps.js` bản đồ chuẩn. Không `Math.random`, `Date`, DOM trong `src/sim`.
- `src/web/` chỉ đọc state sim và vẽ. Âm thanh `src/web/audio.js` (WebAudio, không asset).
- `game.contract.json` là nguồn duy nhất của tuning; hằng số chuẩn không có khóa tuning nằm đầu `game.js`.

## Quy tắc
- Số chuẩn Ticket-02 là bắt buộc: không tự đổi. Đổi số trong code thì đổi contract cùng commit.
- Bộ đếm tính bằng tick nguyên (`sec()`), không trừ dần theo giây.
- Mỗi luật mới: viết scenario trong `tests/scenarios.test.js` trước, chạy cho đỏ, rồi mới code.
- Kỳ vọng test sai thì sửa kèm comment lý do; không tắt test, không viết test luôn đạt, không sửa tay output.
- Tính năng sáng tạo không được đổi đầu ra headless: chỉ bật qua `createGame({ creative: true })`, dùng RNG riêng; bench và soak không bật.
- Cảnh bench (`createGame({ bench: true })`) phải giữ đúng Ticket-04 §1; đổi gì thì chạy lại `bench.json` và `soak.json` rồi commit kèm.
- Bản web: không ghi DOM mỗi khung nếu nội dung không đổi (dùng `setDom`), vì việc đó làm tụt p1_low_fps.
- Tắt tiến trình thì tắt theo PID/cổng của tiến trình mình mở, không tắt theo tên chương trình (`taskkill /IM chrome.exe` sẽ đóng cả trình duyệt của người dùng).
- Chỉ commit khi **mã thoát** của `npm test` là 0 (`if npm test; then git commit ...`). Không nối `npm test | grep ... && git commit`: grep thành công cả khi có `not ok` (đã xảy ra ở 812f562).

## Harness
- Stop hook `.claude/hooks/stop-tests.mjs`: chạy `npm test` khi agent định dừng; đỏ thì chặn (exit 2).
- Skill `.claude/skills/verify`: dùng trước khi báo xong và trước khi gắn tag.
