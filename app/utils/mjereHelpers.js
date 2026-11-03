// Pomoćne funkcije za preračun mjernih jedinica (Dimenzije su u centimetrima - cm)

export function preracunajKolicinu(kolicinaUnos, jmUnos, jmCilj, debljinaCm, sirinaCm, duzinaCm) {
    const kol = parseFloat(kolicinaUnos);
    if (isNaN(kol) || kol <= 0) {
        return { kom: 0, m3: 0, m2: 0, m1: 0, ciljnaKolicina: 0 };
    }

    const u = (jmUnos || 'kom').toLowerCase();
    const c = (jmCilj || 'm3').toLowerCase();

    const debM = (parseFloat(debljinaCm) || 0) / 100;
    const sirM = (parseFloat(sirinaCm) || 0) / 100;
    const duzM = (parseFloat(duzinaCm) || 0) / 100;

    const vol1Kom = debM * sirM * duzM;
    const area1Kom = sirM * duzM;
    const len1Kom = duzM;

    if (vol1Kom <= 0) {
        return {
            kom: u === 'kom' ? kol : 0,
            m3: u === 'm3' ? kol : 0,
            m2: u === 'm2' ? kol : 0,
            m1: u === 'm1' ? kol : 0,
            ciljnaKolicina: kol
        };
    }

    let brojKomada = kol;
    if (u === 'm3') brojKomada = kol / vol1Kom;
    else if (u === 'm2') brojKomada = area1Kom > 0 ? kol / area1Kom : 0;
    else if (u === 'm1') brojKomada = len1Kom > 0 ? kol / len1Kom : 0;

    const m3 = parseFloat((brojKomada * vol1Kom).toFixed(6));
    const m2 = parseFloat((brojKomada * area1Kom).toFixed(6));
    const m1 = parseFloat((brojKomada * len1Kom).toFixed(6));
    const kom = parseFloat(brojKomada.toFixed(4));

    let ciljnaKolicina = m3;
    if (c === 'kom') ciljnaKolicina = kom;
    else if (c === 'm2') ciljnaKolicina = m2;
    else if (c === 'm1') ciljnaKolicina = m1;

    return { kom, m3, m2, m1, ciljnaKolicina };
}

export function preracunajCijenuPoJedinici(proizvod, jmCilj) {
    if (!proizvod) return 0;
    const cijenaBaza = parseFloat(proizvod.cijena) || 0;
    const jmBaza = (proizvod.default_jedinica || 'm3').toLowerCase();
    const cilj = (jmCilj || 'm3').toLowerCase();

    if (jmBaza === cilj) return cijenaBaza;

    const debM = (parseFloat(proizvod.visina || proizvod.debljina) || 1) / 100;
    const sirM = (parseFloat(proizvod.sirina) || 1) / 100;
    const duzM = (parseFloat(proizvod.duzina) || 1) / 100;

    let faktorBaza = 1;
    if (jmBaza === 'm3') faktorBaza = debM * sirM * duzM;
    else if (jmBaza === 'm2') faktorBaza = sirM * duzM;
    else if (jmBaza === 'm1') faktorBaza = duzM;

    const cijenaPoKomadu = cijenaBaza * faktorBaza;

    let faktorCilj = 1;
    if (cilj === 'm3') faktorCilj = debM * sirM * duzM;
    else if (cilj === 'm2') faktorCilj = sirM * duzM;
    else if (cilj === 'm1') faktorCilj = duzM;

    return faktorCilj > 0 ? cijenaPoKomadu / faktorCilj : cijenaBaza;
}