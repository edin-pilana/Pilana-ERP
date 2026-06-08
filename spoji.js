const fs = require('fs');
const path = require('path');

// Folderi koje želimo skenirati
const folderiZaSkeniranje = ['app/modules', 'app/components', 'app/utils', 'app/store', 'app']; 
const izlazniFajl = 'sav_kod.txt';

let spojenKod = '';

function skenirajFolder(dir) {
    if (!fs.existsSync(dir)) return;
    
    const fajlovi = fs.readdirSync(dir);
    
    for (const fajl of fajlovi) {
        const punaPutanja = path.join(dir, fajl);
        const stat = fs.statSync(punaPutanja);
        
        // Preskačemo nepotrebne sistemske foldere
        if (stat.isDirectory()) {
            if (fajl !== 'node_modules' && fajl !== '.next' && fajl !== '.git') {
                skenirajFolder(punaPutanja);
            }
        } 
        // Uzimamo samo bitne fajlove
        else if (punaPutanja.endsWith('.jsx') || punaPutanja.endsWith('.js') || punaPutanja.endsWith('.css') || punaPutanja.endsWith('.tsx')) {
            const sadrzaj = fs.readFileSync(punaPutanja, 'utf8');
            spojenKod += `\n\n// ` + `====================================================================\n`;
            spojenKod += `// 📂 FAJL: ${punaPutanja}\n`;
            spojenKod += `// ` + `====================================================================\n\n`;
            spojenKod += sadrzaj;
        }
    }
}

// Pokrećemo skeniranje
folderiZaSkeniranje.forEach(skenirajFolder);

// Snimamo u fajl
fs.writeFileSync(izlazniFajl, spojenKod);
console.log(`✅ Gotovo! Sav kod je uspješno spojen u fajl: ${izlazniFajl}`);