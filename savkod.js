const fs = require('fs');
const path = require('path');

let out = '';
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (!['node_modules', '.next', '.git'].includes(f)) walk(p);
    } else if (/\.(js|jsx|ts|tsx|css)$/.test(f)) {
      const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
      out += `\n========================================\nFAJL: ${p} (Ukupno redova: ${lines.length})\n========================================\n`;
      out += lines.map((l, i) => `${i + 1}: ${l}`).join('\n') + '\n';
    }
  }
}
walk('app');
fs.writeFileSync('sav_kod.txt', out, 'utf8');
console.log('GOTOVO! Kreiran je sav_kod.txt');