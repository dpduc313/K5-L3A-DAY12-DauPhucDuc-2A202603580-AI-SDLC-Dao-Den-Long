// Chạy toàn bộ kiểm chứng và ghi báo cáo vào docs/proof/<phase>/verify.md (khớp commit hiện tại).
// Dùng: node scripts/verify.mjs phase-2
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir, cpus, platform, release } from 'node:os';
import { join } from 'node:path';

const phase = process.argv[2] || 'adhoc';
const outDir = join('docs', 'proof', phase);
mkdirSync(outDir, { recursive: true });
const sh = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32' });
const commit = sh('git', ['rev-parse', '--short', 'HEAD']).stdout.trim();
const dirty = sh('git', ['status', '--porcelain', '--', 'src', 'tests', 'game.contract.json']).stdout.trim() ? ' (có thay đổi chưa commit)' : '';
const contract = JSON.parse(readFileSync('game.contract.json', 'utf8'));
const [cmd, ...cmdArgs] = contract.headless_cmd.split(' ');
const tmp = mkdtempSync(join(tmpdir(), 'ddl-verify-'));

const test = sh('npm', ['test', '--silent']);
writeFileSync(join(outDir, 'npm-test.txt'), test.stdout + test.stderr);
const pass = /# pass (\d+)/.exec(test.stdout)?.[1];
const fail = /# fail (\d+)/.exec(test.stdout)?.[1];

const rows = [];
for (const night of [1, 2, 3]) {
  const outs = [];
  let ms = 0;
  for (const k of [0, 1]) {
    const out = join(tmp, `n${night}-${k}.jsonl`);
    const t0 = performance.now();
    const r = spawnSync(cmd, [...cmdArgs, '--seed', '123', '--night', String(night), '--ticks', '21600', '--out', out], { encoding: 'utf8' });
    ms = performance.now() - t0;
    if (r.status !== 0) throw new Error(r.stderr);
    outs.push(readFileSync(out, 'utf8'));
  }
  const end = JSON.parse(outs[0].trim().split('\n').at(-1));
  rows.push(`| ${night} | ${outs[0] === outs[1] ? 'giống hệt' : '**KHÁC**'} | ${(ms / 1000).toFixed(2)} s | ${end.ticks} | ${end.state} |`);
}

const report = `# Kiểm chứng ${phase}

- Commit: \`${commit}\`${dirty}
- Máy: ${platform()} ${release()}, ${cpus()[0].model}, Node ${process.version}
- Lệnh: \`node scripts/verify.mjs ${phase}\`

## Test (\`npm test\`)
pass ${pass}, fail ${fail}. Chi tiết: \`npm-test.txt\`.

## Headless: tất định và thời gian một Đêm đầy đủ (21.600 tick, seed 123, chạy 2 lần)
| Đêm | So 2 lần chạy | Thời gian | ticks | state |
|---|---|---|---|---|
${rows.join('\n')}

Ngưỡng Ticket-02: ≤ 30 s mỗi Đêm.
`;
writeFileSync(join(outDir, 'verify.md'), report);
console.log(report);
process.exit(fail === '0' ? 0 : 1);
