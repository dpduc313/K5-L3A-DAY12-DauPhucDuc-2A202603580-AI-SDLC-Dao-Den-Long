// Stop hook: chạy `npm test`; test đỏ thì chặn agent kết thúc (exit 2, lý do ra stderr).
// Nếu đã bị chặn một lần (stop_hook_active) mà vẫn đỏ: cho dừng nhưng cảnh báo, tránh vòng lặp đốt token.
import { spawnSync } from 'node:child_process';
let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let active = false;
  try { active = JSON.parse(input || '{}').stop_hook_active === true; } catch {}
  const r = spawnSync('npm', ['test', '--silent'], { encoding: 'utf8', shell: true });
  if (r.status === 0) process.exit(0);
  const tail = (r.stdout + r.stderr).split('\n').slice(-30).join('\n');
  if (active) {
    console.log(JSON.stringify({ systemMessage: 'CANH BAO: npm test van do sau mot lan chan. Ghi "chua dat" vao docs/notes.' }));
    process.exit(0);
  }
  process.stderr.write(`npm test dang do. Sua cho xanh truoc khi ket thuc, khong sua test cho luon dat.\n${tail}\n`);
  process.exit(2);
});
