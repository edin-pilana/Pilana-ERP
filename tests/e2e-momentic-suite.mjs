import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { preracunajKolicinu, preracunajCijenuPoJedinici } from '../app/utils/mjereHelpers.js';
import { toLocalIso, parseISODateLocal, prikazDatumaBHS, escapeHtml, getEfektivnaZapreminaTrupca } from '../app/utils/dateHelpers.js';

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, 'app');

const results = [];
let currentSuite = '';

async function test(name, fn) {
    const start = Date.now();
    try {
        await fn();
        results.push({ suite: currentSuite, name, status: 'PASS', ms: Date.now() - start });
        console.log(`  \x1b[32m✓ PASS\x1b[0m  ${name} \x1b[90m(${Date.now() - start}ms)\x1b[0m`);
    } catch (err) {
        results.push({ suite: currentSuite, name, status: 'FAIL', ms: Date.now() - start, error: err.message });
        console.log(`  \x1b[31m✕ FAIL\x1b[0m  ${name}`);
        console.log(`          \x1b[31m→ ${err.message}\x1b[0m`);
    }
}

function suite(title) {
    currentSuite = title;
    console.log(`\n\x1b[1m\x1b[36m▶ ${title}\x1b[0m`);
}

function walkFiles(dir) {
    let out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out = out.concat(walkFiles(full));
        else if (/\.(js|jsx|ts|tsx|css)$/.test(entry.name)) out.push(full);
    }
    return out;
}

const allAppFiles = walkFiles(APP_DIR);
const readAppFile = (rel) => fs.readFileSync(path.join(APP_DIR, rel), 'utf8');

console.log('\x1b[1m======================================================================\x1b[0m');
console.log('\x1b[1m   PILANA-ERP — MOMENTIC-STYLE E2E & REGRESSION QA SUITE              \x1b[0m');
console.log('\x1b[1m======================================================================\x1b[0m');

// ============================================================================
// SUITE 1: STATIČKA, ARHITEKTONSKA I REGRESIJSKA FORENZIKA
// ============================================================================
suite('SUITE 1 — Statička, Arhitektonska & Regresijska Forenzika');

await test('Nema nijednog nativnog alert()/confirm()/prompt() poziva u app/', () => {
    const hits = [];
    for (const f of allAppFiles) {
        if (f.endsWith('.css')) continue;
        const lines = fs.readFileSync(f, 'utf8').split('\n');
        lines.forEach((line, idx) => {
            if (/(?:^|[^\w.])(?:window\.)?(alert|confirm|prompt)\s*\(/.test(line) && !line.trim().startsWith('//')) {
                hits.push(`${path.relative(ROOT, f)}:${idx + 1}`);
            }
        });
    }
    assert.equal(hits.length, 0, `Pronađeni nativni dijalozi: ${hits.join(', ')}`);
});

await test('Samo jedna centralizovana Supabase createClient() instanca (supabaseClient.js)', () => {
    const hits = allAppFiles
        .filter(f => /\bcreateClient\s*\(/.test(fs.readFileSync(f, 'utf8')))
        .map(f => path.relative(ROOT, f).replace(/\\/g, '/'));
    assert.deepEqual(hits, ['app/utils/supabaseClient.js']);
});

await test('globals.css koristi html[data-theme] (nema nevažećeg body[data-theme] selektora)', () => {
    const css = readAppFile('globals.css');
    assert.equal(/body\[data-theme|body:not\(\[data-theme/.test(css), false, 'Pronađen body[data-theme] selektor!');
    assert.ok(css.includes('html[data-theme="aurora"] body::before'), 'Nedostaje Aurora glow selektor');
    assert.ok(css.includes('html[data-theme="executive"] body::before'), 'Nedostaje Executive glow selektor');
    assert.ok(css.includes('html[data-theme="light"] select option'), 'Nedostaje Clinical Light select option selektor');
    assert.ok(css.includes('[data-sonner-toaster] [data-sonner-toast]'), 'Nedostaju moderni Sonner toast stilovi');
});

await test('AppShell.jsx ima tačno jedan <main> (promjena layouta i širine ne briše nacrte)', () => {
    const src = readAppFile('components/AppShell.jsx');
    const bezKomentara = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const mainMatches = bezKomentara.match(/<main\b/g) || [];
    assert.equal(mainMatches.length, 1, `Očekivan 1 <main>, pronađeno ${mainMatches.length}`);
    assert.ok(src.includes('backupModulesRef'), 'Nedostaje backup snapshot za Odustani u uređivanju menija');
    assert.ok(src.includes('odustaniOdUredjivanjaMenija'), 'Nedostaje handler za Odustani');
});

await test('page.tsx memoizuje finalniModuliZaMeni i dozvoljava klik na brzi_moduli u edit modu', () => {
    const src = readAppFile('page.tsx');
    assert.ok(src.includes('const finalniModuliZaMeni = useMemo('), 'finalniModuliZaMeni mora biti u useMemo');
    assert.ok(src.includes("widget.type === 'brzi_moduli'"), 'brzi_moduli ne smije biti blokiran sa pointer-events-none');
});

await test('PametniDialog.jsx podržava Escape, backdrop klik i ima moderni akcentni header', () => {
    const src = readAppFile('components/PametniDialog.jsx');
    assert.ok(src.includes("e.key === 'Escape'"), 'Nedostaje Escape zatvaranje');
    assert.ok(src.includes('erp-modal-backdrop'), 'Nedostaje erp-modal-backdrop zaštita za Light temu');
    assert.ok(src.includes('t.accentBar'), 'Nedostaje moderna akcentna traka');
});

await test('HrDashboardModule.jsx nema tipfeler nparseISODateLocal i ima stopPropagation na dugmadima', () => {
    const src = readAppFile('modules/HrDashboardModule.jsx');
    assert.equal(src.includes('nparseISODateLocal'), false, 'Pronađen tipfeler nparseISODateLocal!');
    assert.ok(src.includes('e.stopPropagation(); obradiZahtjevOdmor'), 'Nedostaje e.stopPropagation() na odobrenju zahtjeva');
});

await test('PilanaIzvjestaj.jsx poštuje React Rules of Hooks (svi useMemo prije early return)', () => {
    const src = readAppFile('components/PilanaIzvjestaj.jsx');
    const lastMemo = src.lastIndexOf('useMemo(');
    const earlyReturn = src.indexOf('if (!data || !data.kpi) return');
    assert.ok(lastMemo > 0 && earlyReturn > lastMemo, 'Early return mora biti NAKON svih useMemo poziva!');
});

await test('LagerPaketaModule.jsx renderuje selektovaniPaket modal IZVAN CSS zoom kontejnera', () => {
    const src = readAppFile('modules/LagerPaketaModule.jsx');
    const zoomIdx = src.indexOf('ref={zoomRef}');
    const modalIdx = src.indexOf('{selektovaniPaket && (');
    const between = src.slice(zoomIdx, modalIdx);
    assert.ok(between.includes('</div>\n\n            {selektovaniPaket') || between.trimEnd().endsWith('</div>'), 'Modal mora biti izvan transform: scale(zoom) kontejnera');
});

// ============================================================================
// SUITE 2: TOK 1 — KOMERCIJALA I FINANSIJE
// ============================================================================
suite('SUITE 2 — Tok 1: Komercijala i Finansije (Ponude → RN → Otpremnice → Računi → Blagajna)');

await test('Preciznost kom → m³ na 6 decimala eliminiše fening odstupanja (PDV 17%)', () => {
    // 7 kom x 2.4x17x420 cm = 7 * 0.024 * 0.17 * 4.20 = 0.119952 m3
    const pr = preracunajKolicinu(7, 'kom', 'm3', 2.4, 17, 420);
    assert.equal(pr.m3, 0.119952);
    const cijenaM3 = 425.25;
    const osnovica6 = parseFloat((pr.m3 * cijenaM3).toFixed(2)); // 51.01 KM
    const pdv = parseFloat((osnovica6 * 0.17).toFixed(2));        // 8.67 KM
    const ukupno = parseFloat((osnovica6 + pdv).toFixed(2));      // 59.68 KM
    assert.equal(osnovica6, 51.01);
    assert.equal(pdv, 8.67);
    assert.equal(ukupno, 59.68);
});

await test('Ponuda: ručni rabat 0% ostaje 0% (uz kupčev 12.5%) i dozvoljava cijenu iznad baze', () => {
    const normalizujSim = (s, cijenaBaza = 500, kupacRabat = 12.5) => {
        let rabatProc = (s.rabat_procenat !== undefined && s.rabat_procenat !== null && String(s.rabat_procenat).trim() !== '')
            ? parseFloat(s.rabat_procenat) : NaN;
        if (isNaN(rabatProc)) rabatProc = kupacRabat;
        rabatProc = Math.max(0, Math.min(100, rabatProc));

        let fiksnaCijena = (s.fiksna_cijena !== undefined && s.fiksna_cijena !== null && String(s.fiksna_cijena).trim() !== '')
            ? parseFloat(s.fiksna_cijena) : NaN;
        if (isNaN(fiksnaCijena) || fiksnaCijena < 0) fiksnaCijena = cijenaBaza * (1 - rabatProc / 100);
        else if (Math.abs(rabatProc - 100) < 0.001) fiksnaCijena = 0;
        else if (Math.abs(rabatProc) < 0.001 && fiksnaCijena < cijenaBaza) fiksnaCijena = cijenaBaza;
        if (fiksnaCijena > cijenaBaza) { cijenaBaza = fiksnaCijena; rabatProc = 0; }
        return { rabatProc, fiksnaCijena, cijenaBaza };
    };

    // 1. Ručni 0% rabat ne vraća se na 12.5%
    const r0 = normalizujSim({ rabat_procenat: 0, fiksna_cijena: '500.00' });
    assert.equal(r0.rabatProc, 0);
    assert.equal(r0.fiksnaCijena, 500);

    // 2. Ručna viša cijena (550 > 500) ostaje 550
    const rUp = normalizujSim({ rabat_procenat: 0, fiksna_cijena: '550.00' });
    assert.equal(rUp.fiksnaCijena, 550);
    assert.equal(rUp.cijenaBaza, 550);

    // 3. 100% rabat daje fiksnu cijenu 0.00 KM
    const r100 = normalizujSim({ rabat_procenat: 100, fiksna_cijena: '0.00' });
    assert.equal(r100.fiksnaCijena, 0);
});

await test('Decimalni depozit (25.55 KM) + obračun preostale gotovine u Blagajni bez dupliranja', () => {
    const racunUkupno = 100.00;
    const avansSaPonude = 25.55;
    const rucneUplate = 10.00;
    const zaAutoKasu = parseFloat(Math.max(0, racunUkupno - rucneUplate - avansSaPonude).toFixed(2));
    assert.equal(zaAutoKasu, 64.45);
    assert.equal(parseFloat((avansSaPonude + rucneUplate + zaAutoKasu).toFixed(2)), 100.00);
});

await test('FIFO djelimična otprema višerednog paketa (5.5 kom) i tačan povrat na KREIRANA', () => {
    // 2 reda istog paket_id: svaki 10 kom (1.0000 m3), ukupno 2.0000 m3
    const redovi = [
        { id: 1, kolicina_final: 1.0, kolicina_ulaz: 10, otpremnica_id: null },
        { id: 2, kolicina_final: 1.0, kolicina_ulaz: 10, otpremnica_id: null },
    ];
    // Djelimična otprema 5.5 kom = 0.5500 m3 (FIFO skida samo red 1!)
    const skidanja = [];
    let preostalo = 0.55;
    for (const r of redovi) {
        if (preostalo <= 0.0001) break;
        if (preostalo >= r.kolicina_final - 0.0004) {
            skidanja.push({ row_id: r.id, tip: 'CIJELI_RED', m3: r.kolicina_final, kom: r.kolicina_ulaz });
            r.otpremnica_id = 'OTP-2026-1';
            preostalo -= r.kolicina_final;
        } else {
            r.kolicina_final = parseFloat((r.kolicina_final - preostalo).toFixed(4));
            r.kolicina_ulaz = parseFloat((r.kolicina_ulaz - 5.5).toFixed(2));
            skidanja.push({ row_id: r.id, tip: 'DJELIMICNO', m3: preostalo, kom: 5.5 });
            preostalo = 0;
        }
    }
    const ukupnoNakonOtpreme = parseFloat(redovi.reduce((s, r) => s + r.kolicina_final, 0).toFixed(4));
    assert.equal(ukupnoNakonOtpreme, 1.45, 'Mora ostati tačno 1.45 m³ (bez fantomskog viška!)');
    assert.equal(redovi[0].kolicina_ulaz, 4.5);
    assert.equal(redovi[1].kolicina_ulaz, 10);

    // Povrat ISPORUČENO -> KREIRANA pomoću skidanja snapshota
    for (const sk of skidanja) {
        const r = redovi.find(x => x.id === sk.row_id);
        r.kolicina_final = parseFloat((r.kolicina_final + sk.m3).toFixed(4));
        r.kolicina_ulaz = parseFloat((r.kolicina_ulaz + sk.kom).toFixed(2));
        r.otpremnica_id = null;
    }
    assert.equal(parseFloat(redovi.reduce((s, r) => s + r.kolicina_final, 0).toFixed(4)), 2.0);
    assert.equal(redovi[0].kolicina_ulaz, 10);
});

await test('Kontrolni Toranj X-Ray regex: blokira 10200.65 KM, KASA_ i PON-2026-12 vs PON-2026-123', () => {
    const matchLog = (akcija, detalji, cid) => {
        if (cid.length <= 4 && akcija.toUpperCase().startsWith('KASA_')) return false;
        const escaped = cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(^|[^0-9A-Z.,-])${escaped}([^0-9A-Z.,-]|$)`, 'i');
        return regex.test(`${akcija} ${detalji}`.toUpperCase());
    };
    assert.equal(matchLog('RACUN', 'Iznos računa 10200.65 KM', '65'), false);
    assert.equal(matchLog('KASA_ULAZ', 'Upisan ULAZ od 65 KM', '65'), false);
    assert.equal(matchLog('OTPREMA', 'Paket 65 isporučen na OTP-2026-10', '65'), true);
    assert.equal(matchLog('PONUDA', 'Kreirana PON-2026-1234 za kupca', 'PON-2026-12'), false);
    assert.equal(matchLog('PONUDA', 'Kreirana PON-2026-12 za kupca', 'PON-2026-12'), true);
});

// ============================================================================
// SUITE 3: TOK 2 — SIROVINA I POGON
// ============================================================================
suite('SUITE 3 — Tok 2: Sirovina i Pogon (Prijem → Krojenje → Prorez → Dorada → Lager)');

await test('getEfektivnaZapreminaTrupca daje prioritet kontrolna_zapremina nad papirnom zapreminom', () => {
    assert.equal(getEfektivnaZapreminaTrupca({ zapremina: 1.5, kontrolna_zapremina: 1.38 }), 1.38);
    assert.equal(getEfektivnaZapreminaTrupca({ zapremina: 1.5, kontrolna_zapremina: null }), 1.5);
    assert.equal(getEfektivnaZapreminaTrupca({ zapremina: 0, kontrolna_zapremina: 0 }), 0);
});

await test('Status trupaca (case-insensitive): blokira prorezano / PROREZANO / PREKROJENO', () => {
    const mozeNaKrojenjeIliProrez = (status) => {
        const st = String(status || '').toLowerCase().trim();
        return st === 'na_lageru';
    };
    assert.equal(mozeNaKrojenjeIliProrez('na_lageru'), true);
    assert.equal(mozeNaKrojenjeIliProrez('prorezano'), false);
    assert.equal(mozeNaKrojenjeIliProrez('PROREZANO'), false);
    assert.equal(mozeNaKrojenjeIliProrez('PREKROJENO'), false);
    assert.equal(mozeNaKrojenjeIliProrez('prekrojeno'), false);
});

await test('LagerPaketaModule: normStatus ne pretvara ZAVRŠENO u ZAVRŠENOO', () => {
    const normStatus = (s) => String(s || '').toUpperCase().trim().replace(/^ZAVRŠEN$/, 'ZAVRŠENO');
    assert.equal(normStatus('ZAVRŠEN'), 'ZAVRŠENO');
    assert.equal(normStatus('ZAVRŠENO'), 'ZAVRŠENO');
    assert.equal(normStatus('DJELIMIČNO'), 'DJELIMIČNO');
});

// ============================================================================
// SUITE 4: TOK 3 — HR, KIOSK, LOKALNI DATUMI & XSS SIGURNOST
// ============================================================================
suite('SUITE 4 — Tok 3: HR, Kiosk, Noćna Smjena, Praznici & XSS Zaštita');

await test('Lokalni datumi (parseISODateLocal / toLocalIso / prikazDatumaBHS) bez UTC pomaka', () => {
    const d = parseISODateLocal('2026-11-21');
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 10);
    assert.equal(d.getDate(), 21);
    assert.equal(toLocalIso(d), '2026-11-21');
    assert.equal(prikazDatumaBHS('2026-11-21T00:30:00Z'), '21.11.2026.');
});

await test('Noćna (3.) smjena 22:00 → 06:00 preko ponoći obračunava 8.00 h (ne 0.00 h)', () => {
    const dStart = new Date(2026, 10, 20, 22, 0, 0);
    const dEnd = new Date(2026, 10, 21, 6, 0, 0);
    let officialStart = new Date(dStart); officialStart.setHours(22, 0, 0, 0);
    let officialEnd = new Date(dStart); officialEnd.setHours(6, 0, 0, 0);
    if (officialEnd <= officialStart) officialEnd.setDate(officialEnd.getDate() + 1);

    let obracunskiStart = dStart < officialStart ? officialStart : dStart;
    let obracunskiEnd = dEnd > officialEnd ? officialEnd : dEnd;
    const sati = (obracunskiEnd - obracunskiStart) / 3600000;
    assert.equal(sati, 8);
});

await test('Ručni upis odsustva tačno broji radne subote i isključuje državne praznike', () => {
    // 2026-11-23 (Pon) do 2026-11-28 (Sub): 25.11. je praznik (neradni), 28.11. je radna subota -> 5 radnih dana
    const izuzeci = { '2026-11-25': false, '2026-11-28': true };
    const startD = parseISODateLocal('2026-11-23');
    const endD = parseISODateLocal('2026-11-28');
    let brojDana = 0;
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
        const iso = toLocalIso(d);
        if (izuzeci[iso] !== undefined) {
            if (izuzeci[iso] === true) brojDana++;
        } else if (d.getDay() !== 0 && d.getDay() !== 6) {
            brojDana++;
        }
    }
    assert.equal(brojDana, 5);
});

await test('escapeHtml neutrališe XSS payload u printHelpers / ID karticama', () => {
    const raw = `<img src=x onerror="alert('xss')"> & "Kupac"`;
    const safe = escapeHtml(raw);
    assert.equal(safe.includes('<'), false);
    assert.equal(safe.includes('>'), false);
    assert.ok(safe.includes('&lt;img') && safe.includes('&quot;Kupac&quot;'));
});

// ============================================================================
// SUITE 6: MOMENTIC MO (24 BUGA) & UNCOVERED MODULES REGRESIJSKA ZAŠTITA
// ============================================================================
suite('SUITE 6 — Momentic Mo (24 buga) & Uncovered Modules Regresijska Zaštita');

await test('supabaseClient.js: ne poziva dupli Promise.resolve(result).then() na PostgrestBuilderu i eksportuje formatDbError', () => {
    const src = readAppFile('utils/supabaseClient.js');
    assert.equal(src.includes('Promise.resolve(result).then'), false, 'Pronađen dupli POST uzrok na PostgrestBuilderu!');
    assert.ok(src.includes('export const formatDbError'), 'Nedostaje formatDbError helper');
    assert.ok(src.includes("code === '23505'"), 'formatDbError mora prevoditi 23505');
});

await test('LagerPaketaModule.jsx: katalog_proizvoda se sortira po sifra (ne created_at) i responsivni Slobodni Ulaz', () => {
    const src = readAppFile('modules/LagerPaketaModule.jsx');
    assert.equal(src.includes("ucitajSveSaPaginacijom('katalog_proizvoda', '*', 'created_at')"), false, 'katalog_proizvoda nema created_at kolonu!');
    assert.ok(src.includes("ucitajSveSaPaginacijom('katalog_proizvoda', '*', 'sifra')"), 'katalog_proizvoda mora sortirati po sifra');
});

await test('PrijemModule.jsx: sinhronizovani localStorage ključevi, sekvencijalna zaštita i blokada viška kubika pri krojenju', () => {
    const src = readAppFile('modules/PrijemModule.jsx');
    assert.ok(src.includes('prijemLoadSeqRef'), 'Nedostaje monotonic race-condition guard za loadPrijemList');
    assert.ok(src.includes('trenutnaDjecaVolume > izvornaVol'), 'Nedostaje provjera zapremine djece vs majke u izvrsiKrojenje');
});

await test('PilanaModule & DoradaModule: ponovo otvoreni paketi zbrajaju sve redove, 6-decimalna preciznost i validacija zastoja', () => {
    const pil = readAppFile('modules/PilanaModule.jsx');
    const dor = readAppFile('modules/DoradaModule.jsx');
    assert.ok(pil.includes('closed_at: null'), 'Pilana mora ponovo otvoriti zatvorene redove paketa');
    assert.ok(dor.includes('closed_at: null'), 'Dorada mora ponovo otvoriti zatvorene redove paketa');
    assert.ok(dor.includes('zastojNum < 0 || zastojNum > 1440'), 'Dorada dnevnik mora odbiti negativan zastoj');
    assert.ok(pil.includes('zastojNum < 0 || zastojNum > 1440'), 'Pilana dnevnik mora odbiti negativan zastoj');
});

await test('OtpremniceModule.jsx: ukupno m³ konvertuje kom/m2/m1 i koristi formatDbError', () => {
    const src = readAppFile('modules/OtpremniceModule.jsx');
    assert.ok(src.includes('izracunajStavkuM3'), 'Nedostaje izracunajStavkuM3 konverzija');
    assert.ok(src.includes('formatDbError('), 'OtpremniceModule mora koristiti formatDbError');
});

await test('PonudeModule & RacuniModule: odbijaju negativne cijene/rabate i sinhronizuju odabraniKupac u load()', () => {
    const pon = readAppFile('modules/PonudeModule.jsx');
    const rac = readAppFile('modules/RacuniModule.jsx');
    assert.ok(pon.includes('formatDbError(') && rac.includes('formatDbError('), 'Oba modula moraju koristiti formatDbError');
    assert.ok(rac.includes('parsedFiksna < 0') || rac.includes('fiksnaNum < 0'), 'RacuniModule mora odbiti negativnu cijenu');
    assert.ok(pon.includes('setOdabraniKupac(prev =>'), 'PonudeModule mora sinhronizovati odabraniKupac iz svježe baze');
});

await test('BlagajnaModule.jsx: CBBiH EUR->KM konverzija (1.95583) i blokada iznosa < 0.01 KM', () => {
    const src = readAppFile('modules/BlagajnaModule.jsx');
    assert.ok(src.includes('1.95583'), 'Nedostaje CBBiH fiksni kurs 1.95583 za EUR->KM');
    assert.ok(src.includes('iznosNum < 0.01'), 'Blagajna mora odbiti sub-fening iznose (< 0.01 KM)');
});

await test('SettingsModule.jsx: 0..100% rabat validacija, brisanje resetuje edit formu, radnik ne briše lozinku', () => {
    const src = readAppFile('modules/SettingsModule.jsx');
    assert.ok(src.includes('rVal < 0 || rVal > 100'), 'Rabat po proizvodu/kategoriji mora biti u opsegu 0..100%');
    assert.ok(src.includes('if (isEditing && form.id === id) ponistiIzmjenu()'), 'Brisanje aktivnog zapisa mora resetovati edit formu');
    assert.ok(src.includes('if (form.password && String(form.password).trim() !== \'\')'), 'Uređivanje radnika bez nove lozinke ne smije pregaziti postojeću lozinku');
    assert.ok(src.includes('if (!printWindow)'), 'printAkreditaciju mora rukovati blokiranim popup prozorom');
});

await test('KioskModule, MasterHeader & globals.css: responsivni modali/zvono i kontrast tamne/svijetle teme', () => {
    const kiosk = readAppFile('modules/KioskModule.jsx');
    const hdr = readAppFile('components/MasterHeader.jsx');
    const css = readAppFile('globals.css');
    assert.ok(kiosk.includes('max-h-[calc(100dvh-1.5rem)]'), 'Kiosk modali moraju stati u mobilni viewport');
    assert.ok(hdr.includes('max-w-[calc(100vw-1.5rem)]'), 'MasterHeader zvono dropdown ne smije prelaziti širinu ekrana');
    assert.equal(css.includes('padding: 0.75rem 1rem !important;'), false, 'globals.css ne smije forsirati !important padding na sve inpute');
    assert.ok(css.includes('html:not([data-theme="light"]) .bg-white'), 'globals.css mora osigurati kontrast za .bg-white u tamnim temama');
});

await test('Uncovered moduli (Planiranje, RN, Prorez, Reklamacije, Toranj, HR): validacije, UTC-safe datumi i error handling', () => {
    const plan = readAppFile('modules/PlaniranjeModule.jsx');
    const rn = readAppFile('modules/RadniNaloziModule.jsx');
    const prorez = readAppFile('modules/ProrezModule.jsx');
    const rek = readAppFile('modules/ReklamacijeModule.jsx');
    const toranj = readAppFile('modules/KontrolniToranjModule.jsx');
    const hr = readAppFile('modules/HrDashboardModule.jsx');
    assert.ok(plan.includes('proizvedeno_m3 || 0) > 0'), 'Planiranje mora štititi već proizvedene stavke od brisanja');
    assert.ok(rn.includes('form.rok_isporuke < form.datum'), 'RN mora odbiti rok isporuke prije datuma izdavanja');
    assert.ok(prorez.includes('if (p._pending)'), 'Prorez ne smije stornirati nepotvrđen optimistic red');
    assert.equal(rek.includes("parseFloat(paket?.debljina || trenutniProizvod?.visina) || 1"), false, 'Reklamacije ne smiju imati tihi || 1 cm fallback');
    assert.ok(toranj.includes('safeFilterVal'), 'Kontrolni Toranj mora sanitizovati PostgREST .or() filtere');
    assert.equal(hr.includes("new Date(p.datum).toLocaleDateString('bs-BA')"), false, 'HR kalendar mora koristiti prikazDatumaBHS umjesto UTC new Date()');
});

// ============================================================================
// SUITE 5: LIVE SERVER HTTP/SSR SMOKE TEST (OPCIONO SA --url=...)
// ============================================================================
const urlArg = process.argv.find(a => a.startsWith('--url='));
if (urlArg) {
    const targetUrl = urlArg.split('=')[1];
    suite(`SUITE 5 — Živi Next.js Server Smoke Test (${targetUrl})`);

    await test('Početna stranica (/) vraća HTTP 200, lang="bs", Pilana ERP naslov bez crash overlay-a', async () => {
        const res = await fetch(targetUrl);
        assert.equal(res.status, 200, `Očekivan HTTP 200, dobijen ${res.status}`);
        const html = await res.text();
        assert.ok(html.includes('lang="bs"'), 'HTML nema lang="bs"');
        assert.ok(html.includes('Pilana ERP'), 'HTML nema naslov Pilana ERP');
        assert.equal(html.includes('__next_error__'), false, 'Pronađen Next.js error boundary!');
        assert.equal(html.includes('Application error: a client-side exception'), false, 'Client-side exception!');
    });
}

// ============================================================================
// ZAVRŠNI IZVJEŠTAJ
// ============================================================================
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
console.log('\n\x1b[1m======================================================================\x1b[0m');
console.log(`\x1b[1m   REZULTAT: \x1b[32m${passed} PASS\x1b[0m  |  \x1b[${failed ? '31' : '32'}m${failed} FAIL\x1b[0m  |  UKUPNO: ${results.length}\x1b[0m`);
console.log('\x1b[1m======================================================================\x1b[0m\n');

if (failed > 0) process.exit(1);
