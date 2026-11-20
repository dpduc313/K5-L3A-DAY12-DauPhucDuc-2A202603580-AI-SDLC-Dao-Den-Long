# Nhật ký dùng AI

Công cụ: Claude Code trong VS Code, model `claude-opus-5-5`, gói thuê bao (tính theo % hạn mức, không trả tiền theo token).

Cách đếm token: đọc trường `usage` của từng lượt trả lời trong log phiên Claude Code (`~/.claude/projects/<thư mục>/<phiên>.jsonl`), gộp theo `message.id` để không đếm trùng, lọc theo giờ. Số liệu là số thật từ log, không phải ước lượng.

## Phase 1 (14:00 → 15:03)

### Lời nhắc chính

| Giờ | Lời nhắc | Kết quả |
|---|---|---|
| 14:31 | `/phan-tich-de-bai` (skill riêng của tôi) | `PHAN-TICH.md`: yêu cầu cứng, mâu thuẫn, checkpoint, câu hỏi grill. Agent tự đọc lab board để lấy PRD-0 và Test Contract v1.0 |
| 14:35 | "Tạo repo cá nhân dùm tôi trên Github theo quy định đặt tên giống các bài lab cá nhân trước" (phiên riêng) | Lệnh `gh repo create` đúng tên theo SUBMISSION.md; tôi tự chạy |
| 14:36 | skill `grilling`, trả lời vòng 1 (Q1–Q5) | Chốt giờ 0h = 14:00, Node.js + Three.js, Claude được tự commit |
| 14:52 | "Có, code ngay đi" (nhận hết khuyến nghị Q6–Q17 trong một câu) | Contract, `src/sim`, headless, 4 test, commit `d12bd98`, tag `phase-1` lúc 14:55 |
| 14:59 | "Phase 2 chưa mở, tiếp tục hoàn thiện phase 1" | Bản 3D, 17 test, Stop hook, CI ubuntu + macOS, commit `46ecc70` |

### Token

| Phiên | Việc | Lượt gọi | Input mới | Ghi cache | Đọc cache | Output |
|---|---|---:|---:|---:|---:|---:|
| `f58bf475` | phân tích đề, grill, code | 33 | 76 | 128.829 | 3.959.702 | 68.136 |
| `2db2e759` | tạo repo | 7 | 16 | 25.364 | 351.545 | 3.393 |
| **Tổng Phase 1** | | **40** | **92** | **154.193** | **4.311.247** | **71.529** |

- Khoảng 96% token đầu vào là đọc cache, tức là ngữ cảnh cũ được dùng lại chứ không phải gửi mới. Phần tốn thật là ~154 nghìn token ghi cache và ~72 nghìn token output.
- Hạn mức gói lúc 15:08 ([ảnh](../proof/phase-1/usage-15h08.png)): phiên 5 giờ 4%, tuần 40%. Cửa sổ 5 giờ hiện tại bắt đầu lúc 14:59 (reset 19:59), nên con số 4% gần như chỉ gồm việc sau Phase 1. Phần dùng trong Phase 1 thuộc cửa sổ trước và **không đo lại được**. Con số 40% là cộng dồn cả tuần, không tách riêng cho lab này.
- Từ Phase 2: chụp usage ngay **trước** và **sau** mỗi phase để tính chênh lệch.

### Cách tiết kiệm đã dùng

- Phân tích đề một lần, ghi vào `PHAN-TICH.md`. Các bước sau đọc file này thay vì đọc lại 6 file đề.
- Gộp các câu grill còn lại (Q6–Q17) thành một câu "nhận hết khuyến nghị", thay vì thêm 2–3 vòng hỏi đáp.
- Gom nhiều lệnh shell chỉ đọc vào một lần gọi, và lọc output (`grep '^# (pass|fail)'`) để không đưa cả log test vào ngữ cảnh.
- Giữ một phiên dài cho cả phase để tận dụng cache.

### Lỗi của AI

| # | Lỗi | Phát hiện thế nào | Đã sửa / chỉnh harness |
|---|---|---|---|
| 1 | Script `npm test` truyền thư mục cho `node --test tests/`. Lần chạy đầu bị đỏ dù code đúng | Agent chạy test trước khi commit | Sửa script trong `package.json`. `AGENTS.md` ghi `npm test` là lệnh test duy nhất; Stop hook chạy đúng lệnh này nên lỗi tương tự sẽ chặn agent dừng |
| 2 | Viết test có nhánh `\|\| g.state !== 'playing'`, có thể luôn đạt (**test giả**) | Agent tự đọc lại test vừa viết, trước khi commit | Sửa assert chặt hơn. Để chứng minh Stop hook không bị qua mặt, cố ý thêm một test đỏ rồi chạy hook: hook trả mã 2 (`docs/proof/phase-1/stop-hook-chan-khi-do.txt`). Quy tắc "không viết test luôn đạt" đã có trong `AGENTS.md` |
| 3 | Commit `d12bd98` viết tiếng Việt không dấu, trái quy tắc commit của tôi | Agent tự báo sau khi commit | Không amend vì commit đã được tag. Từ commit sau viết có dấu |
| 4 | Phân tích + grill mất 21 phút (14:31–14:52) trong khi Phase 1 chỉ còn 29 phút. Tag `phase-1` thiếu bản 3D, CI và Stop hook | Agent báo lúc 14:48 khi thấy còn 12 phút | Ghi lịch ca chiều, lớp, MSSV và quy tắc tạo repo vào `CLAUDE.md` cấp thư mục Vin, để các lab sau không hỏi lại. Ghi trung thực trong `phase-1.md` rằng phần 3D nằm ở `46ecc70`, sau tag |
| 5 | Không đọc được nội dung Phase 2 trên lab board vì nội dung tải bằng JavaScript sau khi đăng nhập | Agent đọc HTML gốc, chỉ thấy nhãn "Ticket-02" trống | Không phải lỗi của code. Từ Phase 2, tôi copy nội dung ticket rồi dán vào phiên |

Bản 3D chưa được agent tự kiểm chứng (agent không chơi được game). Bằng chứng phần này cần tôi chơi thử và chụp ảnh.
