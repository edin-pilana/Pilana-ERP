const fs = require('fs');
const path = require('path');

let out = '=== GENERISANO: ' + new Date().toLocaleString() + ' ===\n\n';

function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const p = path.join(dir, file);
        if (fs.statSync(p).isDirectory()) {
            if (!p.match(/node_modules|\.next|\.git/)) walk(p);
        } else if (p.match(/\.(js|jsx|ts|tsx)$/)) {
            out += '\n\n=== ' + p + ' ===\n';
            const lines = fs.readFileSync(p, 'utf8').split('\n');
            out += lines.map((l, i) => (i + 1) + '\t' + l).join('\n');
        }
    }
}

walk('./app');
fs.writeFileSync('sav_kod.txt', out);
console.log('\n✅ USPJESNO: Fajl sav_kod.txt je kreiran sa vremenom i brojevima linija!\n');