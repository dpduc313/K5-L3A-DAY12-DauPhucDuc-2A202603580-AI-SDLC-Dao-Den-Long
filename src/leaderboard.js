// Bảng xếp hạng cục bộ (Ticket-04 §3). Logic thuần, dùng chung cho bản web, máy chủ và lệnh xuất.
export const TOP = 10;

// 3–12 ký tự chữ, số hoặc gạch dưới. Chữ tiếng Việt có dấu được chấp nhận (điểm cộng của đề).
export function validName(name) {
  if (typeof name !== 'string') return false;
  const n = name.normalize('NFC');
  return /^[\p{L}\p{N}_]+$/u.test(n) && [...n].length >= 3 && [...n].length <= 12;
}

// Điểm giảm dần; bằng điểm thì ai đạt trước (achieved_at sớm hơn) đứng trên.
export function sortEntries(list) {
  return [...list].sort((a, b) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at));
}

export function validEntry(e) {
  return !!e && validName(e.name) && Number.isInteger(e.score) && e.score >= 0
    && Number.isInteger(e.nights_won) && e.nights_won >= 0 && e.nights_won <= 3
    && typeof e.achieved_at === 'string' && /[+-]\d\d:\d\d$|Z$/.test(e.achieved_at) && !Number.isNaN(Date.parse(e.achieved_at))
    && Number.isInteger(e.seed);
}

export function addEntry(list, e) {
  const entry = { name: e.name.normalize('NFC'), score: e.score, nights_won: e.nights_won, achieved_at: e.achieved_at, seed: e.seed };
  return sortEntries([...list, entry]).slice(0, TOP);
}

// ISO 8601 có múi giờ địa phương, ví dụ 2026-11-20T17:05:00+07:00.
export function isoLocal(d = new Date()) {
  const p = (x) => String(x).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${sign}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
}
