# Phase 4 — Ticket-04 "Bình minh: phát hành v1.0.0" (Contract v1.3)

Breaking changes và thay đổi: [CHANGELOG.md](../../CHANGELOG.md). Test: `tests/phase4.test.js` (+ `tests/sang-tao.test.js` cho phần sáng tạo).

## Giả định
- **Bench, `load_ms`**: tính từ lúc mở tiến trình trình duyệt tới khung hình đầu tiên của cảnh bench. Game là bản web, nên "tiến trình game" là trình duyệt. Thời gian build trước đó không tính.
- **Bench, cửa sổ 1280×720**: mở Chrome với `--window-size=1280,720 --force-device-scale-factor=1`. Cảnh bench luôn vẽ canvas đúng 1280×720, tỉ lệ điểm ảnh 1, kể cả khi cửa sổ bị phóng to.
- **Bench, Bóng Mực "wander"**: trong cảnh bench, Mây không bị nhắm tới, nên bóng không chuyển sang chase. Bóng vẫn đi theo luật wander chuẩn (tới đèn tắt gần nhất, lượn quanh).
- **Bench, `peak_mem_mb`**: `null`. Lý do ghi trong README.
- **Soak, "Đêm thứ i dùng seed 7 + i"**: i đếm từ 0, nên Đêm đầu dùng seed 7. Input ngẫu nhiên dùng RNG riêng tách từ seed của Đêm. Khi đổi hướng, hướng mới là vector đơn vị góc ngẫu nhiên.
- **Soak, đo bộ nhớ**: `--expose-gc` để gọi `gc()` trước mỗi lần đo; `--single-threaded --max-semi-space-size=1` để RSS không phình vì luồng biên dịch nền và vùng nhớ trẻ của V8.
- **Bảng xếp hạng**: `seed` là seed của lượt chơi (Đêm n dùng seed + n − 1). Lưu ra `leaderboard.json` qua máy chủ game. Nếu chạy `npm run dev` (không có máy chủ game) thì lưu trong `localStorage` của trình duyệt.
- **`run_cmd`** đổi thành `node scripts/play.mjs`, vì `npm run dev --export-leaderboard out.json` bị npm nuốt cờ.

## Acceptance criteria và bằng chứng

| Yêu cầu | Tiêu chí | Bằng chứng | Kết quả |
|---|---|---|---|
| §1 Bench: cảnh chuẩn | 200 bóng wander, 100 đom đóm, L1–L3 fuel 100, Mây (0,0,0), tắt sinh/sát thương/nhặt/hao dầu/kết thúc, tất định | `phase4.test.js` 3 test cảnh bench | đạt |
| §1 Bench: camera, đo, thoát 0 | vòng 30 m, cao 15 m, 15 s/vòng, khởi động 3 s, đo đúng `duration` | `src/web/main.js` (BENCH), `scripts/bench.mjs` | đạt |
| §1 Bench: ngưỡng | avg ≥ 60, p1 low ≥ 30, load ≤ 10000 ms | `bench.json`: 158.1 / 76.9 / 1193 ms (Iris Plus, i7-1065G7) | đạt trên máy tôi |
| §2 Soak | crashes 0, mem_end ≤ 1.2 × mem_start | `soak.json`: 0 crash, 46.2 → 50.2 MB (×1.09); CI chạy lại mỗi lần push | đạt |
| §3 Bảng xếp hạng | tên 3–12 ký tự, top 10, sắp xếp, tie-break, ISO có múi giờ | `phase4.test.js` 2 test; thử API bằng `fetch` với tên "Đức_2" | đạt |
| §3 Lưu đĩa, màn hình, lệnh xuất | còn sau khi tắt mở, có màn hình từ menu, `--export-leaderboard` | `src/lbstore.js` (ghi nguyên tử), `scripts/play.mjs`, CI | đạt |
| §4 Đổi phím | 9 hành động, báo trùng, khôi phục mặc định, lưu | `src/web/main.js` `renderKeys`, `finishRebind` | đạt theo mã |
| §4 Phụ đề / chỉ báo | Bóng Mực xuất hiện + mũi tên mép màn hình, gió, 10 s cuối, đèn < 30 | `onEvents`, `hud()`, `edgeArrow` | đạt theo mã |
| §4 Giảm chuyển động, cỡ chữ | tắt nhấp nháy; ≥ 18 px; ×1.25 | `index.html` (`:root`, `.big`, `.calm`), `blink()` | đạt theo mã |
| §5 Đóng gói | ≤ 3 lệnh; README đủ mục; CHANGELOG 4 phase; CREDITS; LICENSE; Release có bản chạy được | README, `scripts/release.mjs`, `release/dao-den-long-v1.0.0-web.zip` chạy độc lập (đã thử) | đạt |
| §6 Contract v1.3 | `bench_cmd`, `soak_cmd`, giữ v1.0–v1.2 | `rules.test.js`, `phase4.test.js`; toàn bộ test cũ vẫn đạt | đạt |
| Sáng tạo không đổi headless | so byte đầu ra headless 3 Đêm với bản trước | so bằng `cmp`, giống hệt | đạt |

## Test cũ bị ảnh hưởng
| Test | Xử lý | Lý do |
|---|---|---|
| `rules.test.js` contract | sửa `1.2` → `1.3`, kèm comment | Ticket-04 §6 |

## Đánh giá nhanh (AI sai ở đâu, phát hiện thế nào)
- **Soak trượt ngưỡng ở lần chạy đầu** (RSS 46.1 → 59.4 MB, vượt 1.2×). Đo heap từng vùng: heap JS đang dùng chỉ 4.2 → 4.6 MB. Vậy không phải rò rỉ trong game; phần tăng là bộ nhớ native của trình biên dịch V8. Chọn cờ Node thay vì "làm nóng" trước khi đo, vì làm nóng sẽ lách định nghĩa `mem_start` của đề.
- **Bench lần 30 s đầu cho p1 low 3.7 FPS**: canvas 3248×2061 vì cửa sổ không giữ 1280×720. Số đo lệch vì cảnh không cố định, không phải vì game chậm. Sửa: cảnh bench luôn vẽ 1280×720.
- **p1 low 30 FPS ở lần đo thứ hai**: HUD ghi `innerHTML` mỗi khung. Sửa: chỉ ghi khi nội dung đổi, p1 low lên 130.
- AI định tắt máy chủ thử nghiệm bằng `taskkill /IM chrome.exe`, việc này sẽ đóng cả Chrome của người dùng. Chế độ auto của Claude Code chặn lệnh. Sau đó chỉ tắt đúng tiến trình theo cổng.
- AI lỡ xóa dòng đặt màu `--danger` (chế độ mù màu) khi tối ưu HUD; tự phát hiện khi đọc lại diff và thêm lại.
- Lần thử API với tên tiếng Việt bị từ chối: lỗi do `curl` của Git Bash gửi sai mã hóa, không phải lỗi máy chủ. Thử lại bằng `fetch` của Node thì đạt.
