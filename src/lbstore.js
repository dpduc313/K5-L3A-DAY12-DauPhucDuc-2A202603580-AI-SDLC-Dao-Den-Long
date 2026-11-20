// Lưu bảng xếp hạng ra đĩa (chỉ chạy trong Node: máy chủ game và lệnh xuất).
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addEntry, sortEntries, validEntry } from './leaderboard.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const LB_FILE = process.env.DDL_LEADERBOARD || join(root, 'leaderboard.json');

export function readLb(file = LB_FILE) {
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    return sortEntries((data.entries ?? []).filter(validEntry)).slice(0, 10);
  } catch { return []; }
}

export function writeLb(entries, file = LB_FILE) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify({ entries }, null, 2) + '\n');
  renameSync(tmp, file); // ghi nguyên tử: tắt game giữa chừng không làm hỏng file
}

export function exportLb(out, file = LB_FILE) {
  writeFileSync(out, JSON.stringify({ entries: readLb(file) }, null, 2) + '\n');
}

// GET /api/leaderboard → {entries}; POST /api/leaderboard {entry} → {entries}
export function handleLbApi(req, res, file = LB_FILE) {
  const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'GET') return send(200, { entries: readLb(file) });
  if (req.method !== 'POST') return send(405, { error: 'method' });
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 10000) req.destroy(); });
  req.on('end', () => {
    let e;
    try { e = JSON.parse(body); } catch { return send(400, { error: 'json' }); }
    if (!validEntry(e)) return send(400, { error: 'entry' });
    const entries = addEntry(readLb(file), e);
    writeLb(entries, file);
    send(200, { entries });
  });
}
