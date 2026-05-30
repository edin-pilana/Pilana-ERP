const fs = require('fs');
const path = require('path');

try {
    // Čita tvoj originalni backup fajl
    const text = fs.readFileSync('sav_kod.txt', 'utf8');
    const sections = text.split('\n\n=== ');
    
    let brojVracenihFajlova = 0;
    
    for(let i = 1; i < sections.length; i++) {
        const lines = sections[i].split('\n');
        const putanjaFajla = lines[0].replace(' ===', '').trim();
        
        // Vraćamo samo kod iz app foldera
        if (putanjaFajla.startsWith('app/') || putanjaFajla.startsWith('./app/')) {
            
            // Sklanjamo brojeve linija koje je skripta ranije dodala
            const cistKod = lines.slice(1).map(linija => {
                const indexTaba = linija.indexOf('\t');
                if (indexTaba > -1 && !isNaN(parseInt(linija.substring(0, indexTaba)))) {
                    return linija.substring(indexTaba + 1);
                }
                return linija;
            }).join('\n');
            
            // Provjera da li folder postoji
            const dir = path.dirname(putanjaFajla);
            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir, { recursive: true });
            }
            
            // Prepisujemo fajl originalnim kodom
            fs.writeFileSync(putanjaFajla, cistKod);
            brojVracenihFajlova++;
        }
    }
    console.log(`\n✅ VREMEPLOV USPJEŠAN! Vraćeno je ${brojVracenihFajlova} fajlova u originalno, radno stanje.\n`);
} catch (err) {
    console.error('\n❌ Greška (Provjeri da li postoji sav_kod.txt u folderu):', err.message);
}