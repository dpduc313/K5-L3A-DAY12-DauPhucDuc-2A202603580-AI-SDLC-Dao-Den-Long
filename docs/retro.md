# Retro — Đảo Đèn Lồng (Day 12 AI SDLC)

Người làm: Đậu Phúc Đức (2A202603580), L3A. Công cụ: Claude Code (Claude Opus 5.5) trong VS Code. Chi tiết từng phase: `docs/notes/phase-1..4.md`; nhật ký lời nhắc và token: `docs/notes/ai-log.md`.

## Tổng hợp Evaluation 4 phase
| Phase | Kết quả chính | Sai sót đáng nhớ |
|---|---|---|
| 1 — PRD-0, Contract v1.0 | sim tất định 60 Hz dùng chung cho headless và web; contract, CLI, test, Stop hook, CI ubuntu + macOS | `npm test` gọi sai đường dẫn thư mục; một commit đỏ vì nối `npm test \| grep && git commit` (812f562) |
| 2 — Ba hòn đảo, v1.1 | 3 bản đồ, bục nhảy, Gió Lạc, Bùa Gió, lướt, tạm dừng, cài đặt | cạnh lên của phím pause tính sai; bóng bị đẩy khỏi vùng an toàn vẫn đuổi |
| 3 — Đèn cạn dầu, v1.2 | mô hình dầu, thắp lại, drain, luật thắng 60%, thanh dầu, mù màu (ADR 0001) | một test giả (`score >= 0`); quên cho headless nhận state `drain`; chẩn đoán sai "lỗi mũi tên" |
| 4 — Phát hành v1.0.0, v1.3 | bench, soak, bảng xếp hạng, đổi phím, phụ đề, giảm chuyển động, Release | soak trượt ngưỡng lần đầu; bench đo sai do cửa sổ không giữ 1280×720; HUD làm tụt p1 low |
| Sau phase 3 | sửa lỗi kẹt phím (Sticky Keys), lỗi Bùa Gió bay lơ lửng; sáng tạo Đom Đóm Chúa + Đuốc | — |

## Điều gì hiệu quả khi làm với AI
- **Sim thuần dùng chung**: một `src/sim/game.js` cho cả headless, web, bench và soak. Mọi luật mới được test bằng scenario trước khi có hình, và sáng tạo được bật/tắt bằng một cờ mà không đổi đầu ra headless.
- **Viết test trước, chạy cho đỏ rồi mới code** (quy tắc trong AGENTS.md): bắt được lỗi Bùa Gió bay lơ lửng và các lỗi luật của Phase 3.
- **Đo thay vì đoán**: lỗi mũi tên, lỗi Shift và bộ nhớ soak đều được giải quyết bằng số đo (DOM dump, mô phỏng sim, heap từng vùng), không phải bằng cảm giác nhìn ảnh.
- **Giao quyết định cho người, việc tra cứu cho AI**: grill ở đầu buổi chốt giờ, công nghệ, quyền commit. Sau đó AI chạy liên tục.

## Điều gì không hiệu quả
- AI có xu hướng "sửa" trước khi xác nhận lỗi có thật (mũi tên HUD). Phải nhắc lại bằng quy tắc "đo trước".
- AI đôi khi viết test luôn đạt khi khó dựng tình huống. Chỉ đọc lại test mới phát hiện được.
- Ticket mới dán giữa lúc AI đang làm việc khác làm ngữ cảnh dài ra, tốn token đọc lại.

## Những lần AI sai và cách phát hiện
Xem mục "Đánh giá nhanh" của từng `docs/notes/phase-N.md`. Ba lần đáng nhớ nhất:
1. Commit đỏ 812f562: Stop hook không chặn commit trong lúc chạy. Phát hiện qua CI đỏ. Sau đó thêm quy tắc "chỉ commit khi mã thoát của `npm test` là 0".
2. Test giả `assert.ok(end.score >= 0)`: phát hiện khi đọc lại test, thay bằng test trên sim.
3. Bench p1 low 3.7 FPS: phát hiện vì trường `canvas` trong `bench.json` là 3248×2061, không phải 1280×720.

## Harness giúp nhiều nhất
- **Stop hook** (`.claude/hooks/stop-tests.mjs`): agent không thể báo "xong" khi `npm test` đỏ.
- **AGENTS.md**: các quy tắc rút ra từ lỗi thật (commit theo mã thoát, không tắt test, sáng tạo không đổi headless) được ghi lại để agent không lặp lại.
- **Skill `verify`** và `scripts/verify.mjs`: tạo bằng chứng `docs/proof/phase-N/` trước khi gắn tag.
- **Chế độ auto của Claude Code** chặn một lệnh nguy hiểm (`taskkill /IM chrome.exe`).

## Token và chi phí
- Gói thuê bao, không trả theo token. Số token thật mỗi phase nằm trong `docs/notes/ai-log.md` (đếm từ log phiên, gộp theo `message.id`).
- Tổng token cả buổi: **(điền từ ai-log)**. Hạn mức gói đã dùng: **(điền từ ảnh chụp usage)**.
- Cách tiết kiệm: một phiên dài dùng lại cache (khoảng 96% token đầu vào là đọc cache); gom nhiều lệnh độc lập vào một lượt; dùng skill và AGENTS.md thay cho việc giải thích lại; đọc đúng đoạn file cần thay vì cả file.

## Nếu làm lại
- Dựng cảnh bench và đo FPS ngay từ Phase 2, thay vì để tới Phase 4.
- Đặt phím mặc định tránh Shift ngay từ đầu (Sticky Keys trên Windows).
- Chụp usage trước và sau mỗi phase ngay từ Phase 1.
- Viết bộ đổi phím trước khi viết điều khiển, để không phải sửa lại đường đọc input.
