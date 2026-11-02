// CENTRALNA UNIFIKACIJA MJERNIH JEDINICA (Sve dimenzije u sistemu su u CENTIMETRIMA - cm)

export function izracunajJedinicneMjere(debljinaCm, sirinaCm, duzinaCm) {
    const v = (parseFloat(debljinaCm) || 0) / 100; // pretvoreno u metre
    const s = (parseFloat(sirinaCm) || 0) / 100;   // pretvoreno u metre
    const d = (parseFloat(duzinaCm) || 0) / 100;   // pretvoreno u metre

    const vol1kom = (v > 0 && s > 0 && d > 0) ? (v * s * d) : 0; // m3 po 1 komadu
    const area1kom = (s > 0 && d > 0) ? (s * d) : 0;             // m2 po 1 komadu
    const len1kom = (d > 0) ? d : 0;                             // m1 po 1 komadu

    return { v, s, d, vol1kom, area1kom, len1kom };
}

// Pretvara bilo koju unesenu količinu i jedinicu (kom, m3, m2, m1) u sve ostale jedinice
export function preracunajKolicinu(kolicinaUnos, jmUnos, jmCilj, debljinaCm, sirinaCm, duzinaCm) {
    const kol = parseFloat(kolicinaUnos) || 0;
    if (kol <= 0) return { komada: 0, m3: 0, m2: 0, m1: 0, ciljnaKolicina: 0 };

    const ulazJm = (jmUnos || 'kom').toLowerCase();
    const izlazJm = (jmCilj || 'm3').toLowerCase();
    const { vol1kom, area1kom, len1kom } = izracunajJedinicneMjere(debljinaCm, sirinaCm, duzinaCm);

    // 1. Prvo izračunamo tačan broj komada
    let komada = kol;
    if (ulazJm === 'm3' && vol1kom > 0) komada = kol / vol1kom;
    else if (ulazJm === 'm2' && area1kom > 0) komada = kol / area1kom;
    else if (ulazJm === 'm1' && len1kom > 0) komada = kol / len1kom;

    // 2. Iz broja komada računamo sve jedinice
    const m3 = ulazJm === 'm3' ? kol : (vol1kom > 0 ? komada * vol1kom : 0);
    const m2 = ulazJm === 'm2' ? kol : (area1kom > 0 ? komada * area1kom : 0);
    const m1 = ulazJm === 'm1' ? kol : (len1kom > 0 ? komada * len1kom : 0);

    // 3. Vraćamo traženu ciljnu jedinicu
    let ciljnaKolicina = kol;
    if (ulazJm !== izlazJm) {
        if (izlazJm === 'm3') ciljnaKolicina = m3;
        else if (izlazJm === 'm2') ciljnaKolicina = m2;
        else if (izlazJm === 'm1') ciljnaKolicina = m1;
        else if (izlazJm === 'kom') ciljnaKolicina = komada;
    }

    return {
        komada: Math.round(komada * 100) / 100,
        m3: parseFloat(m3.toFixed(4)),
        m2: parseFloat(m2.toFixed(4)),
        m1: parseFloat(m1.toFixed(4)),
        ciljnaKolicina: parseFloat(ciljnaKolicina.toFixed(4))
    };
}

// Preračunava cijenu artikla iz bazne jedinice kataloga u traženu obračunsku jedinicu
export function preracunajCijenuPoJedinici(proizvod, jmCilj) {
    if (!proizvod) return 0;
    const cijenaBaza = parseFloat(proizvod.cijena) || 0;
    const jmBaza = (proizvod.default_jedinica || 'm3').toLowerCase();
    const cilj = (jmCilj || 'm3').toLowerCase();

    if (jmBaza === cilj) return cijenaBaza;

    const { vol1kom, area1kom, len1kom } = izracunajJedinicneMjere(
        proizvod.visina || proizvod.debljina,
        proizvod.sirina,
        proizvod.duzina
    );

    let faktorBaza = 1;
    if (jmBaza === 'm3' && vol1kom > 0) faktorBaza = vol1kom;
    else if (jmBaza === 'm2' && area1kom > 0) faktorBaza = area1kom;
    else if (jmBaza === 'm1' && len1kom > 0) faktorBaza = len1kom;

    const cijenaZaJedanKomad = cijenaBaza * faktorBaza;

    let faktorCilj = 1;
    if (cilj === 'm3' && vol1kom > 0) faktorCilj = vol1kom;
    else if (cilj === 'm2' && area1kom > 0) faktorCilj = area1kom;
    else if (cilj === 'm1' && len1kom > 0) faktorCilj = len1kom;

    return cijenaZaJedanKomad / (faktorCilj || 1);
}