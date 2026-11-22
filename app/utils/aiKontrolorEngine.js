"use client";
import { toLocalIso, prikazDatumaBHS, prikazMjesecaBHS, formatBrojBHS, getEfektivnaZapreminaTrupca } from './dateHelpers';
import { jeQaTestniZapis } from './smartReminders';

const normTxt = (s) =>
    String(s || '')
        .toLowerCase()
        .replace(/č/g, 'c').replace(/ć/g, 'c').replace(/š/g, 's')
        .replace(/ž/g, 'z').replace(/đ/g, 'd')
        .trim();

const kmVal = (r) => {
    const val = String(r?.valuta || 'KM').toUpperCase();
    const kurs = (val === 'EUR' || val === '€') ? 1.95583 : 1;
    return (parseFloat(r?.ukupno_sa_pdv || r?.ukupno || 0) || 0) * kurs;
};

const getRokIso = (r) => {
    const raw = String(r?.rok_placanja || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    if (r?.datum) {
        const dana = parseInt(raw, 10);
        const dt = new Date(`${String(r.datum).slice(0, 10)}T12:00:00`);
        if (!isNaN(dt.getTime())) {
            dt.setDate(dt.getDate() + (isNaN(dana) ? 15 : dana));
            return toLocalIso(dt);
        }
    }
    return '';
};

const pctDelta = (curr, prev) => {
    if (!prev || Math.abs(prev) < 0.001) return curr > 0 ? '+100,0%' : '0,0%';
    const d = ((curr - prev) / Math.abs(prev)) * 100;
    return `${d >= 0 ? '+' : ''}${formatBrojBHS(d, 1)}%`;
};

const datumIso = (val) => String(val || '').slice(0, 10);

const MJESECI_MAPA = {
    januar: '01', sijecanj: '01',
    februar: '02', veljaca: '02',
    mart: '03', ozujak: '03',
    april: '04', travanj: '04',
    maj: '05', svibanj: '05',
    juni: '06', jun: '06', lipanj: '06',
    juli: '07', jul: '07', srpanj: '07',
    avgust: '08', august: '08', kolovoz: '08',
    septembar: '09', rujan: '09',
    oktobar: '10', listopad: '10',
    novembar: '11', studeni: '11',
    decembar: '12', prosinac: '12',
};

/**
 * Pametno prepoznaje vremenski period iz prirodnog pitanja na bosanskom jeziku.
 */
export function parsirajPeriodIzUpita(pitanje, danasIso) {
    const q = normTxt(pitanje);
    const danas = new Date(`${danasIso}T12:00:00`);
    const y = danas.getFullYear();
    const m = danas.getMonth();
    const d = danas.getDate();

    // Eksplicitan datum DD.MM.YYYY ili YYYY-MM-DD
    const bhsMatch = String(pitanje || '').match(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\.?\b/);
    if (bhsMatch) {
        const iso = `${bhsMatch[3]}-${bhsMatch[2].padStart(2, '0')}-${bhsMatch[1].padStart(2, '0')}`;
        return { tip: 'DAN', od: iso, do: iso, label: prikazDatumaBHS(iso) };
    }
    const isoMatch = String(pitanje || '').match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (isoMatch) {
        return { tip: 'DAN', od: isoMatch[0], do: isoMatch[0], label: prikazDatumaBHS(isoMatch[0]) };
    }

    if (/\b(danas|danasnj|ovaj dan)\b/.test(q)) {
        return { tip: 'DAN', od: danasIso, do: danasIso, label: `Danas (${prikazDatumaBHS(danasIso)})` };
    }
    if (/\b(juce|jucer|jucerasnj)\b/.test(q)) {
        const juce = toLocalIso(new Date(y, m, d - 1));
        return { tip: 'DAN', od: juce, do: juce, label: `Juče (${prikazDatumaBHS(juce)})` };
    }
    if (/\b(prekjuce|prekjucer)\b/.test(q)) {
        const pk = toLocalIso(new Date(y, m, d - 2));
        return { tip: 'DAN', od: pk, do: pk, label: `Prekjuče (${prikazDatumaBHS(pk)})` };
    }
    if (/\b(7 dana|sedam dana|ova sedmica|zadnja sedmica|posljednjih 7|zadnjih 7)\b/.test(q)) {
        const od = toLocalIso(new Date(y, m, d - 6));
        return { tip: 'PERIOD', od, do: danasIso, label: `Zadnjih 7 dana (${prikazDatumaBHS(od)} – ${prikazDatumaBHS(danasIso)})` };
    }
    if (/\b(30 dana|trideset dana|zadnjih 30|posljednjih 30)\b/.test(q)) {
        const od = toLocalIso(new Date(y, m, d - 29));
        return { tip: 'PERIOD', od, do: danasIso, label: `Zadnjih 30 dana (${prikazDatumaBHS(od)} – ${prikazDatumaBHS(danasIso)})` };
    }
    if (/\b(prosli mjesec|proslog mjeseca|prethodni mjesec|prosli mj)\b/.test(q)) {
        const pOd = toLocalIso(new Date(y, m - 1, 1));
        const pDo = toLocalIso(new Date(y, m, 0));
        return { tip: 'PERIOD', od: pOd, do: pDo, label: `Prošli mjesec (${prikazMjesecaBHS(pOd.slice(0, 7))})` };
    }
    if (/\b(ovaj mjesec|ovog mjeseca|tekuci mjesec|ovaj mj)\b/.test(q)) {
        const oOd = toLocalIso(new Date(y, m, 1));
        return { tip: 'PERIOD', od: oOd, do: danasIso, label: `Ovaj mjesec (${prikazMjesecaBHS(oOd.slice(0, 7))})` };
    }
    if (/\b(ova godina|ove godine|tekuca godina)\b/.test(q)) {
        return { tip: 'PERIOD', od: `${y}-01-01`, do: danasIso, label: `Ova godina (${y}.)` };
    }
    if (/\b(prosla godina|prosle godine)\b/.test(q)) {
        return { tip: 'PERIOD', od: `${y - 1}-01-01`, do: `${y - 1}-12-31`, label: `Prošla godina (${y - 1}.)` };
    }

    // Specifičan naziv mjeseca (npr. "oktobar", "septembar 2026")
    for (const [nazivMj, brojMj] of Object.entries(MJESECI_MAPA)) {
        if (new RegExp(`\\b${nazivMj}`).test(q)) {
            const godMatch = q.match(/\b(20\d{2})\b/);
            const god = godMatch ? parseInt(godMatch[1], 10) : y;
            const mjInt = parseInt(brojMj, 10) - 1;
            const pOd = toLocalIso(new Date(god, mjInt, 1));
            const pDo = toLocalIso(new Date(god, mjInt + 1, 0));
            return { tip: 'PERIOD', od: pOd, do: pDo, label: `${prikazMjesecaBHS(`${god}-${brojMj}`)}` };
        }
    }

    return { tip: 'SVE', od: '2000-01-01', do: '2099-12-31', label: 'Ukupno (svi podaci)' };
}

export function izgradiErpSnimak(baza, { bezQaTesta = true } = {}) {
    const filt = (arr) => (Array.isArray(arr) ? (bezQaTesta ? arr.filter((x) => !jeQaTestniZapis(x)) : arr) : []);

    const trupci = filt(baza.trupci);
    const prorezLog = filt(baza.prorez_log);
    const paketi = filt(baza.paketi).filter((p) => parseFloat(p.kolicina_final || 0) > 0);
    const racuni = filt(baza.racuni).filter((r) => !['STORNIRANO', 'OBRISANO'].includes(String(r.status || '').toUpperCase()));
    const ponude = filt(baza.ponude).filter((p) => String(p.status || '').toUpperCase() !== 'OBRISANO');
    const otpremnice = filt(baza.otpremnice).filter((o) => String(o.status || '').toUpperCase() !== 'OBRISANO');
    const blagajna = filt(baza.blagajna);
    const nalozi = filt(baza.radni_nalozi).filter((n) => String(n.status || '').toUpperCase() !== 'OBRISANO');
    const reklamacije = filt(baza.reklamacije);
    const zastoji = filt(baza.dnevnik_masine);
    const raspored = filt(baza.raspored_proizvodnje);
    const masineLista = Array.isArray(baza.masine) ? baza.masine : [];
    const radnici = Array.isArray(baza.radnici) ? baza.radnici : [];
    const radniSati = Array.isArray(baza.radni_sati) ? baza.radni_sati : [];
    const odsustva = Array.isArray(baza.zahtjevi_odsustva) ? baza.zahtjevi_odsustva : [];
    const katalog = Array.isArray(baza.katalog_proizvoda) ? baza.katalog_proizvoda : [];
    const kupci = Array.isArray(baza.kupci) ? baza.kupci : [];
    const susareLista = Array.isArray(baza.susare_sarze?.lista) ? baza.susare_sarze.lista : (Array.isArray(baza.susare_sarze?.sarze) ? baza.susare_sarze.sarze : []);
    const servisiLista = Array.isArray(baza.servis_masina_pila?.lista) ? baza.servis_masina_pila.lista : [];
    const biomasaCfg = baza.biomasa_postavke || {};
    const cbamCfg = baza.cbam_energenti || {};

    const danasObj = new Date();
    const danasIso = toLocalIso(danasObj);
    const danasMs = new Date(`${danasIso}T12:00:00`).getTime();
    const juceIso = toLocalIso(new Date(danasObj.getFullYear(), danasObj.getMonth(), danasObj.getDate() - 1));
    const ovajMjPrefix = danasIso.slice(0, 7);
    const prosliMjDate = new Date(danasObj.getFullYear(), danasObj.getMonth() - 1, 1);
    const prosliMjPrefix = toLocalIso(prosliMjDate).slice(0, 7);
    const ovaGodPrefix = danasIso.slice(0, 4);

    // Pomoćnik za presjek bilo kog perioda [od, do]
    const izracunajPeriod = (odIso, doIso, label = '') => {
        const inR = (dt) => {
            const s = datumIso(dt);
            return s && s >= odIso && s <= doIso;
        };
        const pr = prorezLog.filter((x) => inR(x.datum));
        const pk = paketi.filter((x) => inR(x.datum_yyyy_mm || x.created_at));
        const rc = racuni.filter((x) => inR(x.datum));
        const pn = ponude.filter((x) => inR(x.datum));
        const ot = otpremnice.filter((x) => inR(x.datum));
        const bl = blagajna.filter((x) => inR(x.datum));
        const rk = reklamacije.filter((x) => inR(x.datum || x.created_at));
        const zs = zastoji.filter((x) => inR(x.datum));

        const prorezM3 = pr.reduce((s, r) => s + (parseFloat(r.zapremina || 0) || 0), 0);
        const izlazM3 = pk.reduce((s, p) => s + (parseFloat(p.kolicina_final || 0) || 0), 0);
        const yieldProc = prorezM3 > 0 ? Math.min(100, (izlazM3 / prorezM3) * 100) : 0;
        const fakturisanoKM = rc.reduce((s, r) => s + kmVal(r), 0);
        const ponudeKM = pn.reduce((s, p) => s + kmVal(p), 0);
        const kesUlazKM = bl.filter((b) => String(b.tip || '').toUpperCase().includes('ULAZ')).reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);
        const kesIzlazKM = bl.filter((b) => !String(b.tip || '').toUpperCase().includes('ULAZ')).reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);
        const zastojMin = zs.reduce((s, z) => s + (parseFloat(z.trajanje_min || z.trajanje_minuta || 0) || 0), 0);

        return {
            label: label || `${prikazDatumaBHS(odIso)} – ${prikazDatumaBHS(doIso)}`,
            od: odIso,
            do: doIso,
            prorezM3: parseFloat(prorezM3.toFixed(3)),
            prorezKom: pr.length,
            izlazM3: parseFloat(izlazM3.toFixed(3)),
            paketiBroj: pk.length,
            yieldProc: parseFloat(yieldProc.toFixed(1)),
            fakturisanoKM: parseFloat(fakturisanoKM.toFixed(2)),
            racuniBroj: rc.length,
            ponudeBroj: pn.length,
            ponudeKM: parseFloat(ponudeKM.toFixed(2)),
            otpremniceBroj: ot.length,
            kesUlazKM: parseFloat(kesUlazKM.toFixed(2)),
            kesIzlazKM: parseFloat(kesIzlazKM.toFixed(2)),
            kesNetoKM: parseFloat((kesUlazKM - kesIzlazKM).toFixed(2)),
            reklamacijeBroj: rk.length,
            zastojMin: Math.round(zastojMin),
        };
    };

    const danasStat = izracunajPeriod(danasIso, danasIso, `Danas (${prikazDatumaBHS(danasIso)})`);
    const juceStat = izracunajPeriod(juceIso, juceIso, `Juče (${prikazDatumaBHS(juceIso)})`);
    const ovajMjesec = izracunajPeriod(`${ovajMjPrefix}-01`, `${ovajMjPrefix}-31`, prikazMjesecaBHS(ovajMjPrefix));
    const prosliMjesec = izracunajPeriod(`${prosliMjPrefix}-01`, `${prosliMjPrefix}-31`, prikazMjesecaBHS(prosliMjPrefix));

    // Zadnjih 12 mjeseci serija (za trendove i poređenja bilo kojih mjeseci!)
    const poMjesecima = [];
    for (let i = 11; i >= 0; i--) {
        const dt = new Date(danasObj.getFullYear(), danasObj.getMonth() - i, 1);
        const pref = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        const mStat = izracunajPeriod(`${pref}-01`, `${pref}-31`, prikazMjesecaBHS(pref));
        poMjesecima.push({
            mjesec: prikazMjesecaBHS(pref),
            prefix: pref,
            prorezM3: mStat.prorezM3,
            izlazM3: mStat.izlazM3,
            yieldProc: mStat.yieldProc,
            fakturisanoKM: mStat.fakturisanoKM,
            kesUlazKM: mStat.kesUlazKM,
            kesIzlazKM: mStat.kesIzlazKM,
            kesNetoKM: mStat.kesNetoKM,
            zastojMin: mStat.zastojMin,
            reklamacijeBroj: mStat.reklamacijeBroj,
        });
    }

    // Dnevna serija zadnjih 30 dana i zadnjih 7 dana
    const dani30 = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(danasObj.getFullYear(), danasObj.getMonth(), danasObj.getDate() - i);
        const iso = toLocalIso(d);
        const label = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
        const prM3 = prorezLog.filter((x) => datumIso(x.datum) === iso).reduce((s, r) => s + (parseFloat(r.zapremina || 0) || 0), 0);
        const izM3 = paketi.filter((x) => datumIso(x.datum_yyyy_mm || x.created_at) === iso).reduce((s, p) => s + (parseFloat(p.kolicina_final || 0) || 0), 0);
        const ulKM = blagajna.filter((b) => datumIso(b.datum) === iso && String(b.tip || '').toUpperCase().includes('ULAZ')).reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);
        const izKM = blagajna.filter((b) => datumIso(b.datum) === iso && !String(b.tip || '').toUpperCase().includes('ULAZ')).reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);
        const racKM = racuni.filter((r) => datumIso(r.datum) === iso).reduce((s, r) => s + kmVal(r), 0);
        const zsMin = zastoji.filter((z) => datumIso(z.datum) === iso).reduce((s, z) => s + (parseFloat(z.trajanje_min || z.trajanje_minuta || 0) || 0), 0);
        dani30.push({
            iso,
            dan: label,
            prorezM3: parseFloat(prM3.toFixed(3)),
            izlazM3: parseFloat(izM3.toFixed(3)),
            ulazKM: parseFloat(ulKM.toFixed(2)),
            izlazKM: parseFloat(izKM.toFixed(2)),
            fakturisanoKM: parseFloat(racKM.toFixed(2)),
            zastojMin: Math.round(zsMin),
        });
    }
    const dani7 = dani30.slice(-7);

    // Trupci & Sirovina
    const trupciNaLageru = trupci.filter((t) => t.zakljucen_prijem && t.status === 'na_lageru');
    const trupciProrezani = trupci.filter((t) => t.status === 'prorezano');
    const trupciLagerM3 = trupciNaLageru.reduce((s, t) => s + getEfektivnaZapreminaTrupca(t), 0);
    const trupciProrezaniM3 = trupciProrezani.reduce((s, t) => s + getEfektivnaZapreminaTrupca(t), 0);
    const poVrstiMapa = {};
    const poDobavljacuMapa = {};
    trupci.forEach((t) => {
        const m3 = getEfektivnaZapreminaTrupca(t);
        const v = (t.vrsta || 'Ostalo').trim();
        if (!poVrstiMapa[v]) poVrstiMapa[v] = { vrsta: v, lagerM3: 0, prorezanoM3: 0, kom: 0 };
        if (t.status === 'na_lageru' && t.zakljucen_prijem) poVrstiMapa[v].lagerM3 += m3;
        if (t.status === 'prorezano') poVrstiMapa[v].prorezanoM3 += m3;
        poVrstiMapa[v].kom += 1;

        const dob = (t.dobavljac || t.sumarija || 'Nepoznato').trim();
        if (!poDobavljacuMapa[dob]) poDobavljacuMapa[dob] = { dobavljac: dob, m3: 0, kom: 0, fscKom: 0 };
        poDobavljacuMapa[dob].m3 += m3;
        poDobavljacuMapa[dob].kom += 1;
        if (t.fsc_certifikat || String(t.fsc_status || '').toUpperCase().includes('FSC')) poDobavljacuMapa[dob].fscKom += 1;
    });
    const poVrstiTrupaca = Object.values(poVrstiMapa)
        .map((x) => ({ ...x, lagerM3: parseFloat(x.lagerM3.toFixed(3)), prorezanoM3: parseFloat(x.prorezanoM3.toFixed(3)) }))
        .sort((a, b) => (b.lagerM3 + b.prorezanoM3) - (a.lagerM3 + a.prorezanoM3));
    const poDobavljacu = Object.values(poDobavljacuMapa)
        .map((x) => ({ ...x, m3: parseFloat(x.m3.toFixed(3)) }))
        .sort((a, b) => b.m3 - a.m3);

    // Paketi, Lager & Mašine
    const iskljuceniStatusi = new Set(['ISPORUČENO', 'ISPORUCENO', 'POTROŠENO_U_DORADI', 'POTROSENO_U_DORADI', 'POVRAT_REKLAMACIJA']);
    const paketiNaLageru = paketi.filter((p) => !p.otpremnica_id && p.closed_at !== null && !iskljuceniStatusi.has(String(p.status || '').toUpperCase()));
    const paketiURadu = paketi.filter((p) => !p.otpremnica_id && p.closed_at === null);
    const paketiOtpremljeni = paketi.filter((p) => Boolean(p.otpremnica_id));
    const ukupnoPaketiM3 = paketi.reduce((s, p) => s + (parseFloat(p.kolicina_final || 0) || 0), 0);
    const lagerPaketiM3 = paketiNaLageru.reduce((s, p) => s + (parseFloat(p.kolicina_final || 0) || 0), 0);

    const paketiPilana = paketi.filter((p) => {
        const m = String(p.masina || '').toUpperCase();
        return (m.includes('PILANA') || m.includes('BRENTA') || m.includes('GATAR') || m.includes('VISELIS')) && (!p.ai_sirovina_ids || p.ai_sirovina_ids.length === 0);
    });
    const izlazPilanaM3 = paketiPilana.reduce((s, p) => s + (parseFloat(p.kolicina_final || 0) || 0), 0);
    const globalYieldProc = trupciProrezaniM3 > 0 ? Math.min(100, (izlazPilanaM3 / trupciProrezaniM3) * 100) : 0;

    const lagerPoProizvoduMapa = {};
    paketiNaLageru.forEach((p) => {
        const n = (p.naziv_proizvoda || 'Ostalo').trim();
        if (!lagerPoProizvoduMapa[n]) lagerPoProizvoduMapa[n] = { naziv: n, m3: 0, paketa: 0 };
        lagerPoProizvoduMapa[n].m3 += parseFloat(p.kolicina_final || 0) || 0;
        lagerPoProizvoduMapa[n].paketa += 1;
    });
    const lagerPoProizvodu = Object.values(lagerPoProizvoduMapa)
        .map((x) => ({ ...x, m3: parseFloat(x.m3.toFixed(3)) }))
        .sort((a, b) => b.m3 - a.m3);

    const poMasiniMapa = {};
    const razloziZastojaMapa = {};
    paketi.forEach((p) => {
        const m = (p.masina || 'Ostalo').trim();
        if (!poMasiniMapa[m]) poMasiniMapa[m] = { masina: m, izlazM3: 0, paketa: 0, zastojMin: 0, brojZastoja: 0 };
        poMasiniMapa[m].izlazM3 += parseFloat(p.kolicina_final || 0) || 0;
        poMasiniMapa[m].paketa += 1;
    });
    zastoji.forEach((z) => {
        const m = (z.masina || 'Ostalo').trim();
        const mins = parseFloat(z.trajanje_min || z.trajanje_minuta || 0) || 0;
        if (!poMasiniMapa[m]) poMasiniMapa[m] = { masina: m, izlazM3: 0, paketa: 0, zastojMin: 0, brojZastoja: 0 };
        poMasiniMapa[m].zastojMin += mins;
        poMasiniMapa[m].brojZastoja += 1;
        const razlog = (z.razlog || z.napomena || 'Ostalo').trim().slice(0, 45);
        razloziZastojaMapa[razlog] = (razloziZastojaMapa[razlog] || 0) + mins;
    });
    const poMasinama = Object.values(poMasiniMapa)
        .map((x) => ({ ...x, izlazM3: parseFloat(x.izlazM3.toFixed(3)), zastojMin: Math.round(x.zastojMin) }))
        .sort((a, b) => b.izlazM3 - a.izlazM3);
    const topRazloziZastoja = Object.entries(razloziZastojaMapa)
        .map(([razlog, minuta]) => ({ razlog, minuta: Math.round(minuta) }))
        .sort((a, b) => b.minuta - a.minuta)
        .slice(0, 10);

    // Finansije, Računi, Aging, Kupci
    const uplateSve = blagajna.filter((b) => String(b.tip || '').toUpperCase().includes('ULAZ'));
    const isplateSve = blagajna.filter((b) => !String(b.tip || '').toUpperCase().includes('ULAZ'));
    const kasaUlazKM = uplateSve.reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);
    const kasaIzlazKM = isplateSve.reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);
    const stanjeKaseKM = kasaUlazKM - kasaIzlazKM;

    const troskoviKatMapa = {};
    isplateSve.forEach((b) => {
        const k = (b.kategorija || 'Ostalo').trim();
        troskoviKatMapa[k] = (troskoviKatMapa[k] || 0) + (parseFloat(b.iznos || 0) || 0);
    });
    const troskoviPoKategoriji = Object.entries(troskoviKatMapa)
        .map(([kategorija, iznos]) => ({ kategorija, iznos: parseFloat(iznos.toFixed(2)) }))
        .sort((a, b) => b.iznos - a.iznos);

    const aging = { uRoku: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
    const kupciStatMapa = {};
    const otvoreniRacuni = [];
    let ukupnoFakturisanoKM = 0;
    let ukupnoOtvoreniDugKM = 0;

    racuni.forEach((r) => {
        const iznKM = kmVal(r);
        ukupnoFakturisanoKM += iznKM;
        const kup = (r.kupac_naziv || 'Nepoznat kupac').trim();
        if (!kupciStatMapa[kup]) kupciStatMapa[kup] = { kupac: kup, fakturisanoKM: 0, otvoreniDugKM: 0, dospjeliDugKM: 0, racuna: 0, maxKasni: 0 };
        kupciStatMapa[kup].fakturisanoKM += iznKM;
        kupciStatMapa[kup].racuna += 1;

        const st = String(r.status || '').toUpperCase().trim();
        if (st === 'NAPLAĆENO' || st === 'NAPLACENO' || st === 'PLAĆENO') return;

        const ridUp = String(r.id || '').toUpperCase().trim();
        const uplBl = uplateSve
            .filter((u) => (u.racun_id && String(u.racun_id).toUpperCase().trim() === ridUp) || (u.opis && String(u.opis).toUpperCase().includes(ridUp)))
            .reduce((s, u) => s + (parseFloat(u.iznos || 0) || 0), 0);
        const upl = Math.max(uplBl, parseFloat(r.uplaceno || 0) || 0);
        const dugKM = parseFloat(Math.max(0, iznKM - upl).toFixed(2));
        if (dugKM <= 0.5) return;

        ukupnoOtvoreniDugKM += dugKM;
        kupciStatMapa[kup].otvoreniDugKM += dugKM;

        const rokIso = getRokIso(r);
        let kasniDana = 0;
        if (rokIso) {
            kasniDana = Math.round((danasMs - new Date(`${rokIso}T12:00:00`).getTime()) / 86400000);
        }
        if (kasniDana <= 0) aging.uRoku += dugKM;
        else if (kasniDana <= 30) aging.d1_30 += dugKM;
        else if (kasniDana <= 60) aging.d31_60 += dugKM;
        else if (kasniDana <= 90) aging.d61_90 += dugKM;
        else aging.d90plus += dugKM;

        if (kasniDana > 0) {
            kupciStatMapa[kup].dospjeliDugKM += dugKM;
            if (kasniDana > kupciStatMapa[kup].maxKasni) kupciStatMapa[kup].maxKasni = kasniDana;
        }

        otvoreniRacuni.push({
            id: r.id,
            kupac: kup,
            datumIso: datumIso(r.datum),
            datum: prikazDatumaBHS(r.datum),
            rok: prikazDatumaBHS(rokIso),
            kasniDana: Math.max(0, kasniDana),
            ukupnoKM: parseFloat(iznKM.toFixed(2)),
            uplacenoKM: parseFloat(upl.toFixed(2)),
            dugKM,
        });
    });

    otvoreniRacuni.sort((a, b) => b.kasniDana - a.kasniDana || b.dugKM - a.dugKM);
    const kupciStat = Object.values(kupciStatMapa)
        .map((k) => ({
            ...k,
            fakturisanoKM: parseFloat(k.fakturisanoKM.toFixed(2)),
            otvoreniDugKM: parseFloat(k.otvoreniDugKM.toFixed(2)),
            dospjeliDugKM: parseFloat(k.dospjeliDugKM.toFixed(2)),
        }))
        .sort((a, b) => b.fakturisanoKM - a.fakturisanoKM);
    const topDuznici = [...kupciStat].filter((k) => k.otvoreniDugKM > 0.5).sort((a, b) => b.otvoreniDugKM - a.otvoreniDugKM);

    // Ponude & Otpremnice & Radni Nalozi
    const ponudeStatusMapa = {};
    let ponudeUkupnoKM = 0;
    const ponudeVisokiRabat = [];
    ponude.forEach((p) => {
        const st = String(p.status || 'NA ODLUČIVANJU').toUpperCase();
        ponudeStatusMapa[st] = (ponudeStatusMapa[st] || 0) + 1;
        ponudeUkupnoKM += kmVal(p);
        const maxRab = Array.isArray(p.stavke_jsonb)
            ? Math.max(0, ...p.stavke_jsonb.map((s) => parseFloat(s.rabat || 0) || 0))
            : (parseFloat(p.rabat || 0) || 0);
        if (maxRab > 15) {
            ponudeVisokiRabat.push({ id: p.id, kupac: p.kupac_naziv || '-', datum: prikazDatumaBHS(p.datum), rabat: parseFloat(maxRab.toFixed(1)), iznosKM: parseFloat(kmVal(p).toFixed(2)) });
        }
    });
    const ponudePotvrdjene = ponude.filter((p) => {
        const st = String(p.status || '').toUpperCase();
        return st.includes('POTVR') || st.includes('REALIZ') || st.includes('NALOG');
    }).length;
    const ponudeKonverzijaProc = ponude.length > 0 ? parseFloat(((ponudePotvrdjene / ponude.length) * 100).toFixed(1)) : 0;

    const otpremniceIsporucene = otpremnice.filter((o) => String(o.status || '').toUpperCase().includes('ISPORU'));
    const otpremniceNaCekanju = otpremnice.filter((o) => !String(o.status || '').toUpperCase().includes('ISPORU'));

    const aktivniNaloziLista = nalozi.filter((n) => String(n.status || '').toUpperCase() !== 'ZAVRŠENO');
    const kasneciNalozi = aktivniNaloziLista.filter((n) => n.rok_isporuke && datumIso(n.rok_isporuke) < danasIso);

    // Profit po radnim nalozima
    const prosjecnaCijenaTrupcaM3 = (() => {
        const sCijenom = trupci.filter((t) => parseFloat(t.cijena_m3 || t.cijena || 0) > 0);
        if (!sCijenom.length) return 185;
        return sCijenom.reduce((s, t) => s + (parseFloat(t.cijena_m3 || t.cijena || 0) || 0), 0) / sCijenom.length;
    })();
    const prosjecnaCijenaArtiklaM3 = (() => {
        const sCijenom = katalog.filter((k) => parseFloat(k.cijena_m3 || k.osnovna_cijena || 0) > 0);
        if (!sCijenom.length) return 480;
        return sCijenom.reduce((s, k) => s + (parseFloat(k.cijena_m3 || k.osnovna_cijena || 0) || 0), 0) / sCijenom.length;
    })();

    const profitPoNalogu = nalozi.map((n) => {
        const rnId = String(n.id || '').trim();
        const pkN = paketi.filter((p) => String(p.broj_veze || '').trim() === rnId);
        const proizM3 = pkN.reduce((s, p) => s + (parseFloat(p.kolicina_final || 0) || 0), 0);
        const pon = ponude.find((po) => po.id === n.ponuda_id || String(po.id || '') === String(n.broj_ponude || ''));
        const racN = racuni.filter((r) => String(r.radni_nalog_id || '') === rnId || String(r.broj_veze || '') === rnId || String(r.napomena || '').includes(rnId));
        let prihodKM = racN.reduce((s, r) => s + kmVal(r), 0);
        if (prihodKM <= 0 && pon) prihodKM = kmVal(pon);
        if (prihodKM <= 0 && proizM3 > 0) prihodKM = proizM3 * prosjecnaCijenaArtiklaM3;

        const yieldFaktor = globalYieldProc > 20 ? (globalYieldProc / 100) : 0.62;
        const trosakSirovineKM = (proizM3 / yieldFaktor) * prosjecnaCijenaTrupcaM3;
        const trosakRadaKM = proizM3 * 42;
        const rekN = reklamacije.filter((rk) => String(rk.radni_nalog_id || '') === rnId && String(rk.status || '').toUpperCase() === 'ODOBRENO');
        const trosakRekKM = rekN.reduce((s, rk) => s + ((parseFloat(rk.kolicina || 0) || 0) * prosjecnaCijenaArtiklaM3), 0);
        const ukupTrosak = trosakSirovineKM + trosakRadaKM + trosakRekKM;
        const profitKM = prihodKM - ukupTrosak;
        const marza = prihodKM > 0 ? (profitKM / prihodKM) * 100 : 0;

        return {
            rn_id: rnId,
            kupac: n.kupac_naziv || 'Lager',
            status: n.status || 'U RADU',
            rok: prikazDatumaBHS(n.rok_isporuke),
            kasniRok: Boolean(n.rok_isporuke && datumIso(n.rok_isporuke) < danasIso && String(n.status || '').toUpperCase() !== 'ZAVRŠENO'),
            proizvedenoM3: parseFloat(proizM3.toFixed(3)),
            prihodKM: parseFloat(prihodKM.toFixed(2)),
            trosakKM: parseFloat(ukupTrosak.toFixed(2)),
            profitKM: parseFloat(profitKM.toFixed(2)),
            marzaProc: parseFloat(marza.toFixed(1)),
        };
    }).filter((x) => x.prihodKM > 0 || x.proizvedenoM3 > 0)
      .sort((a, b) => b.profitKM - a.profitKM);

    // Planiranje & Zaostatci
    const zaostatciPlaniranja = raspored.filter((r) => {
        const dp = datumIso(r.datum_plana);
        const plan = parseFloat(r.planirano_m3 || 0);
        return dp && dp < danasIso && r.status !== 'ZAVRŠENO' && plan > 0.001;
    });
    const planDanasM3 = raspored.filter((r) => datumIso(r.datum_plana) === danasIso).reduce((s, r) => s + (parseFloat(r.planirano_m3 || 0) || 0), 0);

    // HR statistika (tekući mjesec)
    const satiOvajMjesec = radniSati.filter((s) => datumIso(s.datum).startsWith(ovajMjPrefix));
    const hrPoRadnikuMapa = {};
    satiOvajMjesec.forEach((s) => {
        const ime = (s.radnik_ime || s.ime_prezime || 'Radnik').trim();
        if (!hrPoRadnikuMapa[ime]) hrPoRadnikuMapa[ime] = { radnik: ime, sati: 0, dana: 0, kasnjenjeMin: 0, prekovremenoSati: 0 };
        hrPoRadnikuMapa[ime].sati += (parseFloat(s.obracunato_sati || 0) || 0);
        hrPoRadnikuMapa[ime].dana += 1;
        hrPoRadnikuMapa[ime].kasnjenjeMin += (parseFloat(s.kasnjenje_min || 0) || 0);
        hrPoRadnikuMapa[ime].prekovremenoSati += (parseFloat(s.prekovremeno_min || 0) || 0) / 60;
    });
    const hrPoRadniku = Object.values(hrPoRadnikuMapa)
        .map((x) => ({ ...x, sati: parseFloat(x.sati.toFixed(1)), prekovremenoSati: parseFloat(x.prekovremenoSati.toFixed(1)), kasnjenjeMin: Math.round(x.kasnjenjeMin) }))
        .sort((a, b) => b.sati - a.sati);
    const odsustvaNaCekanju = odsustva.filter((o) => String(o.status || '').toUpperCase().includes('ČEKANJ') || String(o.status || '').toUpperCase().includes('CEKANJ'));

    // Biomasa & FSC
    const koraProc = parseFloat(biomasaCfg.proc_kora ?? 10) || 10;
    const piljProc = parseFloat(biomasaCfg.proc_piljevina ?? 14) || 14;
    const okorakProc = parseFloat(biomasaCfg.proc_okorak ?? 18) || 18;
    const biomasaMjesec = {
        prorezM3: ovajMjesec.prorezM3,
        koraM3: parseFloat((ovajMjesec.prorezM3 * (koraProc / 100)).toFixed(2)),
        piljevinaM3: parseFloat((ovajMjesec.prorezM3 * (piljProc / 100)).toFixed(2)),
        okorakM3: parseFloat((ovajMjesec.prorezM3 * (okorakProc / 100)).toFixed(2)),
        utrosakPeciM3: parseFloat(biomasaCfg.utrosak_peci_mjesecno || 0) || 0,
    };
    const fscTrupciKom = trupci.filter((t) => t.fsc_certifikat || String(t.fsc_status || '').toUpperCase().includes('FSC')).length;
    const fscUdioProc = trupci.length > 0 ? parseFloat(((fscTrupciKom / trupci.length) * 100).toFixed(1)) : 0;

    // Automatski detektovani rizici i anomalije u firmi!
    const anomalije = [];
    const dospjeliDug = parseFloat((aging.d1_30 + aging.d31_60 + aging.d61_90 + aging.d90plus).toFixed(2));
    if (dospjeliDug > 0) {
        anomalije.push({ kategorija: 'Finansije / Naplata', nivo: (aging.d61_90 + aging.d90plus) > 0 ? 'KRITIČNO' : 'UPOZORENJE', opis: `Dospjeli nenaplaćeni dug iznosi ${formatBrojBHS(dospjeliDug, 2)} KM (60+ dana: ${formatBrojBHS(aging.d61_90 + aging.d90plus, 2)} KM). Najveći dužnik: ${topDuznici[0]?.kupac || '-'}.` });
    }
    if (kasneciNalozi.length > 0) {
        anomalije.push({ kategorija: 'Proizvodnja / Rokovi', nivo: 'KRITIČNO', opis: `${kasneciNalozi.length} aktivnih radnih naloga je prekoračilo rok isporuke (${kasneciNalozi.slice(0, 3).map((n) => n.id).join(', ')}).` });
    }
    if (zaostatciPlaniranja.length > 0) {
        const zM3 = zaostatciPlaniranja.reduce((s, r) => s + (parseFloat(r.planirano_m3 || 0) || 0), 0);
        anomalije.push({ kategorija: 'Planiranje (Carryover)', nivo: 'UPOZORENJE', opis: `${zaostatciPlaniranja.length} nezavršenih stavki (${formatBrojBHS(zM3, 2)} m³) zaostalo iz prošlih dana u rasporedu.` });
    }
    if (ponudeVisokiRabat.length > 0) {
        anomalije.push({ kategorija: 'Komercijala / Rabati', nivo: 'UPOZORENJE', opis: `${ponudeVisokiRabat.length} ponuda ima rabat iznad 15% (najveći: ${formatBrojBHS(ponudeVisokiRabat[0].rabat, 1)}% na ${ponudeVisokiRabat[0].id}).` });
    }
    const loseMarze = profitPoNalogu.filter((n) => n.prihodKM > 0 && n.marzaProc < 10);
    if (loseMarze.length > 0) {
        anomalije.push({ kategorija: 'Profitabilnost', nivo: 'UPOZORENJE', opis: `${loseMarze.length} radnih naloga ima neto maržu ispod 10% (najniži: ${loseMarze[loseMarze.length - 1].rn_id} sa ${formatBrojBHS(loseMarze[loseMarze.length - 1].marzaProc, 1)}%).` });
    }
    if (ovajMjesec.zastojMin > 120) {
        anomalije.push({ kategorija: 'Mašine / Zastoji', nivo: 'UPOZORENJE', opis: `Ovaj mjesec je zabilježeno ${formatBrojBHS(ovajMjesec.zastojMin, 0)} min zastoja mašina (najčešći razlog: ${topRazloziZastoja[0]?.razlog || '-'}).` });
    }
    const servisiHitni = servisiLista.filter((s) => s.status === 'POTREBAN_SERVIS' || (parseFloat(s.odradjeno_m3 || 0) >= parseFloat(s.prag_m3 || 999999)));
    if (servisiHitni.length > 0) {
        anomalije.push({ kategorija: 'Održavanje Pila', nivo: 'UPOZORENJE', opis: `${servisiHitni.length} pila/mašina je dostiglo servisni prag (${servisiHitni.map((s) => s.masina || s.naziv).join(', ')}).` });
    }
    const rekCekanje = reklamacije.filter((r) => String(r.status || '').toUpperCase().includes('ČEKANJ') || String(r.status || '').toUpperCase().includes('CEKANJ')).length;
    if (rekCekanje > 0) {
        anomalije.push({ kategorija: 'Kvalitet / Reklamacije', nivo: 'INFO', opis: `${rekCekanje} reklamacija čeka odluku uprave.` });
    }

    return {
        danasIso,
        juceIso,
        ovajMjPrefix,
        prosliMjPrefix,
        ovaGodPrefix,
        bezQaTesta,
        izracunajPeriod,
        danasStat,
        juceStat,
        ovajMjesec,
        prosliMjesec,
        poMjesecima,
        dani30,
        dani7,
        trupci: {
            ukupnoKom: trupci.length,
            naLageruKom: trupciNaLageru.length,
            naLageruM3: parseFloat(trupciLagerM3.toFixed(3)),
            prorezanoKom: trupciProrezani.length,
            prorezanoM3: parseFloat(trupciProrezaniM3.toFixed(3)),
            fscUdioProc,
            poVrsti: poVrstiTrupaca,
            poDobavljacu,
        },
        paketi: {
            ukupnoBroj: paketi.length,
            ukupnoM3: parseFloat(ukupnoPaketiM3.toFixed(3)),
            naLageruBroj: paketiNaLageru.length,
            naLageruM3: parseFloat(lagerPaketiM3.toFixed(3)),
            uRaduBroj: paketiURadu.length,
            otpremljeniBroj: paketiOtpremljeni.length,
            izlazPilanaM3: parseFloat(izlazPilanaM3.toFixed(3)),
            globalYieldProc: parseFloat(globalYieldProc.toFixed(1)),
            lagerPoProizvodu,
            sviPaketi: paketi,
            paketiNaLageru,
        },
        masine: poMasinama,
        masineRegistar: masineLista,
        topRazloziZastoja,
        finansije: {
            ukupnoFakturisanoKM: parseFloat(ukupnoFakturisanoKM.toFixed(2)),
            racuniUkupno: racuni.length,
            otvoreniRacuniBroj: otvoreniRacuni.length,
            otvoreniDugKM: parseFloat(ukupnoOtvoreniDugKM.toFixed(2)),
            dospjeliDugKM: dospjeliDug,
            aging: {
                uRoku: parseFloat(aging.uRoku.toFixed(2)),
                d1_30: parseFloat(aging.d1_30.toFixed(2)),
                d31_60: parseFloat(aging.d31_60.toFixed(2)),
                d61_90: parseFloat(aging.d61_90.toFixed(2)),
                d90plus: parseFloat(aging.d90plus.toFixed(2)),
            },
            kasaUlazKM: parseFloat(kasaUlazKM.toFixed(2)),
            kasaIzlazKM: parseFloat(kasaIzlazKM.toFixed(2)),
            stanjeKaseKM: parseFloat(stanjeKaseKM.toFixed(2)),
            troskoviPoKategoriji,
            otvoreniRacuni,
            kupciStat,
            topDuznici,
            blagajnaSve: blagajna,
            racuniSvi: racuni,
        },
        ponude: {
            ukupno: ponude.length,
            ukupnoKM: parseFloat(ponudeUkupnoKM.toFixed(2)),
            konverzijaProc: ponudeKonverzijaProc,
            poStatusu: Object.entries(ponudeStatusMapa).map(([status, broj]) => ({ status, broj })),
            visokiRabat: ponudeVisokiRabat,
            lista: ponude,
        },
        otpremnice: {
            ukupno: otpremnice.length,
            isporuceno: otpremniceIsporucene.length,
            naCekanju: otpremniceNaCekanju.length,
            lista: otpremnice,
        },
        nalozi: {
            ukupno: nalozi.length,
            aktivni: aktivniNaloziLista.length,
            kasneci: kasneciNalozi.length,
            kasneciLista: kasneciNalozi,
            lista: nalozi,
        },
        planiranje: {
            zaostatciBroj: zaostatciPlaniranja.length,
            zaostatciM3: parseFloat(zaostatciPlaniranja.reduce((s, r) => s + (parseFloat(r.planirano_m3 || 0) || 0), 0).toFixed(2)),
            planDanasM3: parseFloat(planDanasM3.toFixed(2)),
            zaostatciLista: zaostatciPlaniranja.slice(0, 15),
        },
        profitPoNalogu,
        reklamacije: {
            ukupno: reklamacije.length,
            odobrene: reklamacije.filter((r) => String(r.status || '').toUpperCase() === 'ODOBRENO').length,
            naCekanju: rekCekanje,
            ukupnoM3: parseFloat(reklamacije.reduce((s, r) => s + (parseFloat(r.kolicina || 0) || 0), 0).toFixed(3)),
            lista: reklamacije,
        },
        susare: susareLista,
        servisi: servisiLista,
        biomasaMjesec,
        cbamCfg,
        hr: {
            brojRadnika: radnici.length,
            brojKupaca: kupci.length,
            brojArtikala: katalog.length,
            aktivniNalozi: aktivniNaloziLista.length,
            odsustvaNaCekanju: odsustvaNaCekanju.length,
            poRadnikuMjesec: hrPoRadniku,
        },
        anomalije,
    };
}

/**
 * Pronalazi konkretne entitete (kupac, mašina, dokument ID, artikal/dimenzija, radnik) spomenute u pitanju.
 */
function pronadjiSpomenuteEntitete(snimak, pitanje) {
    const qNorm = normTxt(pitanje);
    const rijeci = String(pitanje || '').toUpperCase().split(/[\s,?.!:;"'()]+/).filter((w) => w.length >= 3);

    // 1. Dokument ID-jevi (PK, RN, PON, RAC, OTP)
    const paketiHit = (snimak.paketi.sviPaketi || []).filter((p) => rijeci.includes(String(p.paket_id || '').toUpperCase()));
    const naloziHit = (snimak.nalozi.lista || []).filter((n) => rijeci.includes(String(n.id || '').toUpperCase()));
    const racuniHit = (snimak.finansije.racuniSvi || []).filter((r) => rijeci.includes(String(r.id || '').toUpperCase()));
    const ponudeHit = (snimak.ponude.lista || []).filter((p) => rijeci.includes(String(p.id || '').toUpperCase()));
    const otpHit = (snimak.otpremnice.lista || []).filter((o) => rijeci.includes(String(o.id || '').toUpperCase()));

    // 2. Kupci (match na puni ili značajni dio naziva kupca, min 4 znaka)
    const kupciHit = (snimak.finansije.kupciStat || []).filter((k) => {
        const kn = normTxt(k.kupac);
        if (kn.length < 4) return false;
        if (qNorm.includes(kn)) return true;
        const rijeciKupca = kn.split(/\s+/).filter((w) => w.length >= 4 && !['d.o.o.', 'doo', 'firma', 'company', 'trade', 'gradnja', 'drvo', 'pilana'].includes(w));
        return rijeciKupca.some((w) => qNorm.includes(w));
    });

    // 3. Mašine
    const masineHit = (snimak.masine || []).filter((m) => {
        const mn = normTxt(m.masina);
        return mn.length >= 4 && qNorm.includes(mn);
    });

    // 4. Proizvodi / dimenzije na lageru
    const dimMatch = qNorm.match(/\b(\d+(?:[.,]\d+)?)\s*[x*×]\s*(\d+(?:[.,]\d+)?)/);
    const proizvodiHit = (snimak.paketi.lagerPoProizvodu || []).filter((p) => {
        const pn = normTxt(p.naziv);
        if (pn.length >= 4 && qNorm.includes(pn)) return true;
        return false;
    });

    return { paketiHit, naloziHit, racuniHit, ponudeHit, otpHit, kupciHit, masineHit, proizvodiHit, dimMatch };
}

export function napraviKompaktanKontekstZaLLM(snimak, pitanje = '') {
    const hits = pronadjiSpomenuteEntitete(snimak, pitanje);
    const period = parsirajPeriodIzUpita(pitanje, snimak.danasIso);
    const periodStat = period.tip !== 'SVE' ? snimak.izracunajPeriod(period.od, period.do, period.label) : null;

    return {
        datum_danas: prikazDatumaBHS(snimak.danasIso),
        datum_danas_iso: snimak.danasIso,
        filter_bez_qa: snimak.bezQaTesta,
        trazeni_period_iz_pitanja: periodStat,
        danas: snimak.danasStat,
        juce: snimak.juceStat,
        poredjenje_ovaj_vs_prosli_mjesec: {
            ovaj_mjesec: snimak.ovajMjesec,
            prosli_mjesec: snimak.prosliMjesec,
        },
        trend_12_mjeseci: snimak.poMjesecima,
        zadnjih_14_dana: snimak.dani30.slice(-14),
        anomalije_i_rizici: snimak.anomalije,
        trupci_sirovina: {
            ...snimak.trupci,
            poVrsti: snimak.trupci.poVrsti.slice(0, 10),
            poDobavljacu: snimak.trupci.poDobavljacu.slice(0, 12),
        },
        paketi_i_lager: {
            ukupnoBroj: snimak.paketi.ukupnoBroj,
            ukupnoM3: snimak.paketi.ukupnoM3,
            naLageruBroj: snimak.paketi.naLageruBroj,
            naLageruM3: snimak.paketi.naLageruM3,
            uRaduBroj: snimak.paketi.uRaduBroj,
            otpremljeniBroj: snimak.paketi.otpremljeniBroj,
            globalYieldProc: snimak.paketi.globalYieldProc,
            topLagerProizvodi: snimak.paketi.lagerPoProizvodu.slice(0, 15),
        },
        masine_i_zastoji: {
            poMasinama: snimak.masine.slice(0, 12),
            topRazloziZastoja: snimak.topRazloziZastoja.slice(0, 8),
        },
        finansije: {
            ukupnoFakturisanoKM: snimak.finansije.ukupnoFakturisanoKM,
            racuniUkupno: snimak.finansije.racuniUkupno,
            otvoreniDugKM: snimak.finansije.otvoreniDugKM,
            dospjeliDugKM: snimak.finansije.dospjeliDugKM,
            aging: snimak.finansije.aging,
            stanjeKaseKM: snimak.finansije.stanjeKaseKM,
            kasaUlazKM: snimak.finansije.kasaUlazKM,
            kasaIzlazKM: snimak.finansije.kasaIzlazKM,
            topTroskovi: snimak.finansije.troskoviPoKategoriji.slice(0, 12),
            topKupci: snimak.finansije.kupciStat.slice(0, 20),
            topDuznici: snimak.finansije.topDuznici.slice(0, 15),
            topOtvoreniRacuni: snimak.finansije.otvoreniRacuni.slice(0, 15),
        },
        ponude: {
            ukupno: snimak.ponude.ukupno,
            ukupnoKM: snimak.ponude.ukupnoKM,
            konverzijaProc: snimak.ponude.konverzijaProc,
            poStatusu: snimak.ponude.poStatusu,
            visokiRabat: snimak.ponude.visokiRabat.slice(0, 8),
        },
        otpremnice: {
            ukupno: snimak.otpremnice.ukupno,
            isporuceno: snimak.otpremnice.isporuceno,
            naCekanju: snimak.otpremnice.naCekanju,
        },
        radni_nalozi_i_planiranje: {
            aktivni: snimak.nalozi.aktivni,
            kasneciRokovi: snimak.nalozi.kasneci,
            zaostatciPlaniranja: snimak.planiranje.zaostatciBroj,
            zaostatciM3: snimak.planiranje.zaostatciM3,
            planDanasM3: snimak.planiranje.planDanasM3,
            topProfitNalozi: snimak.profitPoNalogu.slice(0, 15),
        },
        reklamacije: {
            ukupno: snimak.reklamacije.ukupno,
            odobrene: snimak.reklamacije.odobrene,
            naCekanju: snimak.reklamacije.naCekanju,
            ukupnoM3: snimak.reklamacije.ukupnoM3,
        },
        susare_aktivne: snimak.susare.slice(0, 10),
        servis_pila: snimak.servisi.slice(0, 10),
        biomasa_i_fsc: snimak.biomasaMjesec,
        hr_ovaj_mjesec: {
            brojRadnika: snimak.hr.brojRadnika,
            odsustvaNaCekanju: snimak.hr.odsustvaNaCekanju,
            topRadniciSati: snimak.hr.poRadnikuMjesec.slice(0, 15),
        },
        pronadjeni_specificni_zapisi: {
            kupci: hits.kupciHit.slice(0, 5),
            masine: hits.masineHit.slice(0, 5),
            paketi: hits.paketiHit.slice(0, 6).map((p) => ({
                paket_id: p.paket_id, proizvod: p.naziv_proizvoda, dim: `${p.debljina}x${p.sirina}x${p.duzina}`,
                m3: parseFloat(p.kolicina_final || 0), masina: p.masina, rn: p.broj_veze, otpremnica: p.otpremnica_id,
            })),
            nalozi: hits.naloziHit.slice(0, 5).map((n) => ({ id: n.id, kupac: n.kupac_naziv, rok: prikazDatumaBHS(n.rok_isporuke), status: n.status })),
            racuni: hits.racuniHit.slice(0, 5).map((r) => ({ id: r.id, kupac: r.kupac_naziv, datum: prikazDatumaBHS(r.datum), iznosKM: parseFloat(kmVal(r).toFixed(2)), status: r.status })),
        },
    };
}

/**
 * Napredni ugrađeni bosanski analitički motor (radi 100% i bez vanjskog API ključa,
 * period-aware + entity-aware + 19 specijalizovanih modula!).
 */
export function odgovoriLokalniAiKontrolor(snimak, pitanje = '') {
    const q = normTxt(pitanje);
    const period = parsirajPeriodIzUpita(pitanje, snimak.danasIso);
    const hits = pronadjiSpomenuteEntitete(snimak, pitanje);

    // 1. Pozdrav / Pomoć
    if (/^(cao|zdravo|pozdrav|ej|hey|hello|hi|dobar dan|dobro jutro|pomoc|sta mozes|kako radis)[!?. ]*$/.test(q)) {
        return {
            naslov: 'AI Direktorski Analitičar',
            odgovor: `Zdravo šefe! Imam kompletan uvid u svih **19 tabela Pilana-ERP baze** (proizvodnja, finansije, ponude, otpremnice, lager, nalozi, planiranje, sušare, biomasa, HR).\n\n### Šta mogu odmah uraditi:\n- **Audit rizika:** *"Gdje gubimo novac i koji su najveći rizici u firmi?"*\n- **Dnevni ili periodični presjek:** *"Kakav je današnji/jučerašnji učinak?"* ili *"Prikaži 6-mjesečni trend prihoda i proizvodnje"*\n- **360° dosije kupca / mašine / paketa:** samo napiši ime kupca, mašine ili broj RN-... / PK-...\n- **Poređenja & Profitabilnost:** *"Uporedi ovaj i prošli mjesec"* ili *"Najprofitabilniji radni nalozi"*`,
            kpi: [
                { label: 'Stanje Kase', value: `${formatBrojBHS(snimak.finansije.stanjeKaseKM, 2)} KM`, sub: 'Trenutna gotovina', color: 'emerald' },
                { label: 'Dospjeli Dug', value: `${formatBrojBHS(snimak.finansije.dospjeliDugKM, 2)} KM`, sub: `Ukupno otvoreno: ${formatBrojBHS(snimak.finansije.otvoreniDugKM, 0)} KM`, color: snimak.finansije.dospjeliDugKM > 0 ? 'red' : 'emerald' },
                { label: 'Lager Robe', value: `${formatBrojBHS(snimak.paketi.naLageruM3, 2)} m³`, sub: `${snimak.paketi.naLageruBroj} paketa`, color: 'blue' },
                { label: 'Detektovani Rizici', value: `${snimak.anomalije.length}`, sub: 'Aktivnih upozorenja', color: snimak.anomalije.length > 0 ? 'amber' : 'emerald' },
            ],
            chart: null,
            tabela: null,
            predlozi: [
                'Pronađi najveće rizike i gdje gubimo novac',
                'Prikaži 6-mjesečni trend proizvodnje i prihoda',
                'Kakav je današnji i jučerašnji učinak?',
                'Uporedi ovaj i prošli mjesec',
            ],
        };
    }

    // 2. Specifičan Paket ID (PK-...)
    if (hits.paketiHit.length > 0) {
        const prvi = hits.paketiHit[0];
        const ukM3 = hits.paketiHit.reduce((s, p) => s + (parseFloat(p.kolicina_final || 0) || 0), 0);
        const ukKom = hits.paketiHit.reduce((s, p) => s + (parseFloat(p.kolicina_ulaz || 0) || 0), 0);
        const status = prvi.otpremnica_id ? `OTPREMLJENO (${prvi.otpremnica_id})` : (prvi.closed_at ? 'NA LAGERU (Zaključan)' : 'U PROIZVODNJI');
        return {
            naslov: `X-Ray Paketa ${prvi.paket_id}`,
            odgovor: `Pronašao sam **Paket ${prvi.paket_id}** u ERP bazi:\n- **Status:** **${status}**\n- **Volumen:** **${formatBrojBHS(ukM3, 3)} m³** (${formatBrojBHS(ukKom, 2, { minDecimale: 0 })} ${prvi.jm || 'kom'})\n- **Radni nalog:** **${prvi.broj_veze || 'Slobodna roba'}** | **Mašina:** **${prvi.masina || '-'}** | **Datum:** **${prikazDatumaBHS(prvi.datum_yyyy_mm)}**`,
            kpi: [
                { label: 'Paket ID', value: String(prvi.paket_id), sub: status, color: 'blue' },
                { label: 'Volumen', value: `${formatBrojBHS(ukM3, 3)} m³`, sub: `${hits.paketiHit.length} stavki`, color: 'emerald' },
                { label: 'Količina', value: `${formatBrojBHS(ukKom, 2, { minDecimale: 0 })} ${prvi.jm || 'kom'}`, sub: prvi.masina || '-', color: 'amber' },
                { label: 'Radni Nalog', value: prvi.broj_veze || 'Lager', sub: prikazDatumaBHS(prvi.datum_yyyy_mm), color: 'purple' },
            ],
            chart: null,
            tabela: {
                naslov: `Stavke u Paketu ${prvi.paket_id}`,
                kolone: [
                    { key: 'proizvod', label: 'Proizvod', type: 'string', align: 'left' },
                    { key: 'dim', label: 'Dimenzije (cm)', type: 'string', align: 'left' },
                    { key: 'kom', label: 'Količina', type: 'number', align: 'right' },
                    { key: 'm3', label: 'Volumen (m³)', type: 'number', align: 'right', suffix: ' m³' },
                ],
                redovi: hits.paketiHit.map((x) => ({
                    proizvod: x.naziv_proizvoda || '-',
                    dim: `${x.debljina || 0}×${x.sirina || 0}×${x.duzina || 0}`,
                    kom: parseFloat(x.kolicina_ulaz || 0) || 0,
                    m3: parseFloat((parseFloat(x.kolicina_final || 0) || 0).toFixed(3)),
                })),
            },
            predlozi: ['Stanje lagera gotove robe', 'Aktivni radni nalozi i rokovi', 'Uporedi ovaj i prošli mjesec'],
        };
    }

    // 3. Specifičan Kupac (360° Dosije Kupca!)
    if (hits.kupciHit.length === 1 && !/(svi kupc|top kupc|upored)/.test(q)) {
        const k = hits.kupciHit[0];
        const racK = snimak.finansije.otvoreniRacuni.filter((r) => normTxt(r.kupac) === normTxt(k.kupac));
        const sviRacK = snimak.finansije.racuniSvi.filter((r) => normTxt(r.kupac_naziv) === normTxt(k.kupac));
        const nalK = snimak.nalozi.lista.filter((n) => normTxt(n.kupac_naziv) === normTxt(k.kupac));
        const ponK = snimak.ponude.lista.filter((p) => normTxt(p.kupac_naziv) === normTxt(k.kupac));

        // Mjesečni promet za ovog kupca (zadnjih 6 mj)
        const chartData = snimak.poMjesecima.slice(-6).map((mj) => ({
            mjesec: mj.mjesec,
            promet: parseFloat(sviRacK.filter((r) => datumIso(r.datum).startsWith(mj.prefix)).reduce((s, r) => s + kmVal(r), 0).toFixed(2)),
        }));

        return {
            naslov: `360° Finansijski i Poslovni Dosije — ${k.kupac}`,
            odgovor: `### Sažetak saradnje sa kupcem **${k.kupac}**:\n- **Ukupno fakturisano:** **${formatBrojBHS(k.fakturisanoKM, 2)} KM** kroz **${k.racuna} računa**.\n- **Otvoreni saldo:** **${formatBrojBHS(k.otvoreniDugKM, 2)} KM** (od toga dospjelo preko roka: **${formatBrojBHS(k.dospjeliDugKM, 2)} KM**, najstarije kašnjenje: **${k.maxKasni} dana**).\n- **Komercijala & Pogon:** **${ponK.length}** ponuda i **${nalK.length}** radnih naloga u historiji.\n${k.dospjeliDugKM > 0 ? `\n⚠️ **Preporuka:** Kupac ima dospjelih obaveza — provjeriti naplatu prije naredne isporuke.` : `\n✅ **Status:** Kupac je uredan platiša bez dospjelih kašnjenja.`}`,
            kpi: [
                { label: 'Ukupni Promet', value: `${formatBrojBHS(k.fakturisanoKM, 2)} KM`, sub: `${k.racuna} računa`, color: 'blue' },
                { label: 'Otvoreni Dug', value: `${formatBrojBHS(k.otvoreniDugKM, 2)} KM`, sub: `${racK.length} otvorenih`, color: k.otvoreniDugKM > 0 ? 'amber' : 'emerald' },
                { label: 'Dospjelo (Kasni)', value: `${formatBrojBHS(k.dospjeliDugKM, 2)} KM`, sub: `Max kašnjenje: ${k.maxKasni} d`, color: k.dospjeliDugKM > 0 ? 'red' : 'emerald' },
                { label: 'Ponude / Nalozi', value: `${ponK.length} / ${nalK.length}`, sub: 'Komercijalni tok', color: 'purple' },
            ],
            chart: {
                title: `📈 6-Mjesečni Promet — ${k.kupac} (KM)`,
                subtitle: 'Fakturisani prihod po mjesecima',
                type: 'area',
                xKey: 'mjesec',
                unit: 'KM',
                series: [{ key: 'promet', name: 'Fakturisano', color: '#3b82f6', unit: 'KM' }],
                data: chartData,
            },
            tabela: {
                naslov: `Otvoreni / Nedavni Računi za ${k.kupac}`,
                kolone: [
                    { key: 'id', label: 'Račun', type: 'string', align: 'left' },
                    { key: 'datum', label: 'Datum', type: 'string', align: 'left' },
                    { key: 'rok', label: 'Rok', type: 'string', align: 'left' },
                    { key: 'kasniDana', label: 'Kasni (d)', type: 'number', align: 'right', suffix: ' d' },
                    { key: 'dugKM', label: 'Preostali Dug', type: 'number', align: 'right', suffix: ' KM' },
                ],
                redovi: racK.length > 0 ? racK : sviRacK.slice(0, 15).map((r) => ({
                    id: r.id, datum: prikazDatumaBHS(r.datum), rok: prikazDatumaBHS(getRokIso(r)), kasniDana: 0, dugKM: parseFloat(kmVal(r).toFixed(2)),
                })),
            },
            predlozi: ['Koji kupci najviše duguju (Aging)?', 'Top 10 kupaca po prometu', 'Pronađi najveće rizike u firmi'],
        };
    }

    // 4. Specifična Mašina
    if (hits.masineHit.length === 1 && !/(sve masin|upored)/.test(q)) {
        const m = hits.masineHit[0];
        const pkM = snimak.paketi.sviPaketi.filter((p) => normTxt(p.masina) === normTxt(m.masina));
        const trend14 = snimak.dani30.slice(-14).map((d) => ({
            dan: d.dan,
            m3: parseFloat(pkM.filter((p) => datumIso(p.datum_yyyy_mm || p.created_at) === d.iso).reduce((s, p) => s + (parseFloat(p.kolicina_final || 0) || 0), 0).toFixed(3)),
        }));
        return {
            naslov: `Analiza Mašine — ${m.masina}`,
            odgovor: `### Performanse mašine **${m.masina}**:\n- **Ukupan izlaz:** **${formatBrojBHS(m.izlazM3, 3)} m³** kroz **${m.paketa} paketa/stavki**.\n- **Zastoji:** **${formatBrojBHS(m.zastojMin, 0)} minuta** (${m.brojZastoja} evidentiranih zastoja).\n- Prosječna veličina paketa: **${m.paketa > 0 ? formatBrojBHS(m.izlazM3 / m.paketa, 3) : '0,000'} m³**.`,
            kpi: [
                { label: 'Ukupni Izlaz', value: `${formatBrojBHS(m.izlazM3, 2)} m³`, sub: `${m.paketa} stavki`, color: 'emerald' },
                { label: 'Zastoji Ukupno', value: `${formatBrojBHS(m.zastojMin, 0)} min`, sub: `${m.brojZastoja} zapisa`, color: m.zastojMin > 120 ? 'red' : 'amber' },
                { label: 'Zadnjih 14 dana', value: `${formatBrojBHS(trend14.reduce((s, x) => s + x.m3, 0), 2)} m³`, sub: 'Aktivni ritam', color: 'blue' },
                { label: 'Prosjek / Paket', value: `${m.paketa > 0 ? formatBrojBHS(m.izlazM3 / m.paketa, 2) : '0,00'} m³`, sub: m.masina, color: 'purple' },
            ],
            chart: {
                title: `⚙️ 14-Dnevni Učinak — ${m.masina} (m³)`,
                subtitle: 'Dnevna proizvodnja na ovoj mašini',
                type: 'bar',
                xKey: 'dan',
                unit: 'm³',
                series: [{ key: 'm3', name: 'Izlaz m³', color: '#10b981', unit: 'm³' }],
                data: trend14,
            },
            tabela: {
                naslov: `Zadnje Proizvedene Stavke (${m.masina})`,
                kolone: [
                    { key: 'datum', label: 'Datum', type: 'string', align: 'left' },
                    { key: 'paket', label: 'Paket', type: 'string', align: 'left' },
                    { key: 'proizvod', label: 'Proizvod', type: 'string', align: 'left' },
                    { key: 'm3', label: 'm³', type: 'number', align: 'right', suffix: ' m³' },
                ],
                redovi: pkM.slice(0, 20).map((p) => ({
                    datum: prikazDatumaBHS(p.datum_yyyy_mm),
                    paket: p.paket_id || '-',
                    proizvod: p.naziv_proizvoda || '-',
                    m3: parseFloat((parseFloat(p.kolicina_final || 0) || 0).toFixed(3)),
                })),
            },
            predlozi: ['Uporedi učinak svih mašina', 'Koji su najčešći razlozi zastoja?', 'Izvještaj sušara i servisa pila'],
        };
    }

    // 5. Audit Rizika, Anomalija & Gdje Gubimo Novac
    if (/(rizik|anomalij|problem|sta ne valja|gdje gubim|upozorenj|alarm|savjet|preporuk|audit|kontrola)/.test(q)) {
        const an = snimak.anomalije;
        const krit = an.filter((a) => a.nivo === 'KRITIČNO').length;
        return {
            naslov: `Direktorski Audit Rizika i Anomalija (${prikazDatumaBHS(snimak.danasIso)})`,
            odgovor: an.length > 0
                ? `### Automatski audit cijelog ERP sistema pronašao je **${an.length} tačaka pažnje** (${krit} kritičnih):\n\n${an.map((a) => `- **[${a.nivo}] ${a.kategorija}:** ${a.opis}`).join('\n')}\n\n### 💡 Prioritetne akcije za danas:\n- Fokusirati naplatu na dospjela potraživanja preko 60 dana.\n- Prioritizirati radne naloge sa prekoračenim rokom isporuke u modulu Planiranje.\n- Provjeriti ponude sa vanrednim rabatima i mašine sa najvećim zastojima.`
                : `✅ **Odlične vijesti!** Automatski audit nije pronašao nijednu kritičnu anomaliju u naplati, rokovima naloga, zastojima niti rabatima.`,
            kpi: [
                { label: 'Ukupno Rizika', value: `${an.length}`, sub: `${krit} kritičnih`, color: krit > 0 ? 'red' : 'amber' },
                { label: 'Dospjeli Dug', value: `${formatBrojBHS(snimak.finansije.dospjeliDugKM, 0)} KM`, sub: `60+ d: ${formatBrojBHS(snimak.finansije.aging.d61_90 + snimak.finansije.aging.d90plus, 0)} KM`, color: snimak.finansije.dospjeliDugKM > 0 ? 'red' : 'emerald' },
                { label: 'Kasneći Nalozi', value: `${snimak.nalozi.kasneci}`, sub: `Zaostatci plana: ${snimak.planiranje.zaostatciBroj}`, color: snimak.nalozi.kasneci > 0 ? 'red' : 'emerald' },
                { label: 'Zastoji (Ovaj Mj.)', value: `${formatBrojBHS(snimak.ovajMjesec.zastojMin, 0)} min`, sub: `Reklamacije čekaju: ${snimak.reklamacije.naCekanju}`, color: 'amber' },
            ],
            chart: {
                title: '🚨 Struktura Rizika i Zastoja po Kategorijama',
                subtitle: 'Aging potraživanja (KM)',
                type: 'bar',
                xKey: 'kategorija',
                unit: 'KM',
                series: [{ key: 'iznos', name: 'Izloženost', color: '#ef4444', unit: 'KM' }],
                data: [
                    { kategorija: '1–30 d', iznos: snimak.finansije.aging.d1_30 },
                    { kategorija: '31–60 d', iznos: snimak.finansije.aging.d31_60 },
                    { kategorija: '61–90 d', iznos: snimak.finansije.aging.d61_90 },
                    { kategorija: '90+ d', iznos: snimak.finansije.aging.d90plus },
                ],
            },
            tabela: {
                naslov: 'Lista Detektovanih Rizika i Preporuka',
                kolone: [
                    { key: 'nivo', label: 'Prioritet', type: 'string', align: 'left' },
                    { key: 'kategorija', label: 'Oblast', type: 'string', align: 'left' },
                    { key: 'opis', label: 'Nalaz iz baze', type: 'string', align: 'left' },
                ],
                redovi: an.length > 0 ? an : [{ nivo: 'OK', kategorija: 'Sistem', opis: 'Nema aktivnih kritičnih odstupanja.' }],
            },
            predlozi: ['Koji kupci najviše duguju (Aging)?', 'Aktivni i kasneći radni nalozi', 'Analiza ponuda i visokih rabata'],
        };
    }

    // 6. Mjesečni Trend (6 ili 12 mjeseci / ova godina)
    if (/(6 mjesec|12 mjesec|po mjesec|mjesecni trend|godisnj|kretanj|tokom godine|ova godina)/.test(q)) {
        const brojMj = /12|godin/.test(q) ? 12 : 6;
        const serija = snimak.poMjesecima.slice(-brojMj);
        const ukPrihod = serija.reduce((s, x) => s + x.fakturisanoKM, 0);
        const ukIzlaz = serija.reduce((s, x) => s + x.izlazM3, 0);
        const ukProrez = serija.reduce((s, x) => s + x.prorezM3, 0);
        const najboljiMj = [...serija].sort((a, b) => b.fakturisanoKM - a.fakturisanoKM)[0];

        return {
            naslov: `${brojMj}-Mjesečni Trend Proizvodnje i Finansija`,
            odgovor: `### Pregled zadnjih **${brojMj} mjeseci**:\n- **Ukupno fakturisano:** **${formatBrojBHS(ukPrihod, 2)} KM** (prosjek **${formatBrojBHS(ukPrihod / brojMj, 2)} KM/mj**).\n- **Ukupna proizvodnja:** Prorez **${formatBrojBHS(ukProrez, 2)} m³** → Izlaz **${formatBrojBHS(ukIzlaz, 2)} m³**.\n${najboljiMj ? `- Najjači mjesec po fakturisanju je **${najboljiMj.mjesec}** sa **${formatBrojBHS(najboljiMj.fakturisanoKM, 2)} KM** i **${formatBrojBHS(najboljiMj.izlazM3, 2)} m³** izlaza.` : ''}`,
            kpi: [
                { label: `Fakturisano (${brojMj} mj)`, value: `${formatBrojBHS(ukPrihod, 0)} KM`, sub: `Prosjek: ${formatBrojBHS(ukPrihod / brojMj, 0)} KM/mj`, color: 'blue' },
                { label: `Izlaz Robe (${brojMj} mj)`, value: `${formatBrojBHS(ukIzlaz, 2)} m³`, sub: `Prorez: ${formatBrojBHS(ukProrez, 2)} m³`, color: 'emerald' },
                { label: 'Najjači Mjesec', value: najboljiMj?.mjesec || '-', sub: najboljiMj ? `${formatBrojBHS(najboljiMj.fakturisanoKM, 0)} KM` : '', color: 'purple' },
                { label: 'Tekući Mjesec', value: `${formatBrojBHS(snimak.ovajMjesec.fakturisanoKM, 0)} KM`, sub: `${pctDelta(snimak.ovajMjesec.fakturisanoKM, snimak.prosliMjesec.fakturisanoKM)} vs prošli`, color: 'amber' },
            ],
            chart: {
                title: `📈 ${brojMj}-Mjesečni Trend: Fakturisano vs Keš Priliv (KM)`,
                subtitle: 'Mjesečno kretanje prihoda i naplate',
                type: 'area',
                xKey: 'mjesec',
                unit: 'KM',
                series: [
                    { key: 'fakturisanoKM', name: 'Fakturisano (KM)', color: '#3b82f6', unit: 'KM' },
                    { key: 'kesUlazKM', name: 'Keš Priliv (KM)', color: '#10b981', unit: 'KM' },
                ],
                data: serija,
            },
            tabela: {
                naslov: `Mjesečna Tabela (${brojMj} mjeseci)`,
                kolone: [
                    { key: 'mjesec', label: 'Mjesec', type: 'string', align: 'left' },
                    { key: 'prorezM3', label: 'Prorez (m³)', type: 'number', align: 'right', suffix: ' m³' },
                    { key: 'izlazM3', label: 'Izlaz (m³)', type: 'number', align: 'right', suffix: ' m³' },
                    { key: 'yieldProc', label: 'Yield %', type: 'number', align: 'right', suffix: '%' },
                    { key: 'fakturisanoKM', label: 'Fakturisano', type: 'number', align: 'right', suffix: ' KM' },
                    { key: 'kesNetoKM', label: 'Neto Keš', type: 'number', align: 'right', suffix: ' KM' },
                ],
                redovi: serija,
            },
            predlozi: ['Uporedi ovaj i prošli mjesec detaljno', 'Top 10 najprofitabilnijih naloga', 'Pronađi najveće rizike u firmi'],
        };
    }

    // 7. Specifičan Dan (Danas / Juče / Konkretan datum)
    if (period.tip === 'DAN' && !/(upored|pored)/.test(q)) {
        const s = snimak.izracunajPeriod(period.od, period.do, period.label);
        return {
            naslov: `Operativni Dnevni Izvještaj — ${s.label}`,
            odgovor: `### Rezultati za **${s.label}**:\n- **Proizvodnja:** Prorezano **${formatBrojBHS(s.prorezM3, 3)} m³** (${s.prorezKom} trupaca) → Proizvedeno **${formatBrojBHS(s.izlazM3, 3)} m³** (${s.paketiBroj} stavki) uz Yield **${formatBrojBHS(s.yieldProc, 1)}%**.\n- **Finansije:** Fakturisano **${formatBrojBHS(s.fakturisanoKM, 2)} KM** (${s.racuniBroj} računa) | Blagajna: **+${formatBrojBHS(s.kesUlazKM, 2)} KM** / **-${formatBrojBHS(s.kesIzlazKM, 2)} KM** (neto **${formatBrojBHS(s.kesNetoKM, 2)} KM**).\n- **Komercijala & Pogon:** Ponude: **${s.ponudeBroj}** (${formatBrojBHS(s.ponudeKM, 2)} KM) | Otpremnice: **${s.otpremniceBroj}** | Zastoji: **${s.zastojMin} min**.`,
            kpi: [
                { label: 'Prorez / Izlaz', value: `${formatBrojBHS(s.prorezM3, 2)} / ${formatBrojBHS(s.izlazM3, 2)} m³`, sub: `Yield: ${formatBrojBHS(s.yieldProc, 1)}%`, color: 'emerald' },
                { label: 'Fakturisano', value: `${formatBrojBHS(s.fakturisanoKM, 2)} KM`, sub: `${s.racuniBroj} računa`, color: 'blue' },
                { label: 'Keš Tok (Neto)', value: `${formatBrojBHS(s.kesNetoKM, 2)} KM`, sub: `+${formatBrojBHS(s.kesUlazKM, 0)} / -${formatBrojBHS(s.kesIzlazKM, 0)} KM`, color: s.kesNetoKM >= 0 ? 'emerald' : 'red' },
                { label: 'Zastoji / Otpreme', value: `${s.zastojMin} min / ${s.otpremniceBroj}`, sub: `Ponuda: ${s.ponudeBroj}`, color: s.zastojMin > 60 ? 'red' : 'amber' },
            ],
            chart: {
                title: '📊 Kontekst Zadnjih 7 Dana (Prorez vs Izlaz m³)',
                subtitle: 'Dnevni ritam prerade u proteklih 7 dana',
                type: 'bar',
                xKey: 'dan',
                unit: 'm³',
                series: [
                    { key: 'prorezM3', name: 'Prorez (m³)', color: '#f59e0b', unit: 'm³' },
                    { key: 'izlazM3', name: 'Izlaz (m³)', color: '#10b981', unit: 'm³' },
                ],
                data: snimak.dani7,
            },
            tabela: {
                naslov: 'Uporedni Pregled: Danas vs Juče',
                kolone: [
                    { key: 'metrika', label: 'Metrika', type: 'string', align: 'left' },
                    { key: 'danas', label: `Danas (${prikazDatumaBHS(snimak.danasIso)})`, type: 'number', align: 'right' },
                    { key: 'juce', label: `Juče (${prikazDatumaBHS(snimak.juceIso)})`, type: 'number', align: 'right' },
                ],
                redovi: [
                    { metrika: 'Prorez trupaca (m³)', danas: snimak.danasStat.prorezM3, juce: snimak.juceStat.prorezM3 },
                    { metrika: 'Izlaz gotove robe (m³)', danas: snimak.danasStat.izlazM3, juce: snimak.juceStat.izlazM3 },
                    { metrika: 'Fakturisano (KM)', danas: snimak.danasStat.fakturisanoKM, juce: snimak.juceStat.fakturisanoKM },
                    { metrika: 'Keš priliv (KM)', danas: snimak.danasStat.kesUlazKM, juce: snimak.juceStat.kesUlazKM },
                    { metrika: 'Keš odliv (KM)', danas: snimak.danasStat.kesIzlazKM, juce: snimak.juceStat.kesIzlazKM },
                    { metrika: 'Zastoji (min)', danas: snimak.danasStat.zastojMin, juce: snimak.juceStat.zastojMin },
                ],
            },
            predlozi: ['Uporedi ovaj i prošli mjesec', 'Pronađi najveće rizike u firmi', 'Aktivni i kasneći radni nalozi'],
        };
    }

    // 8. Poređenje Ovaj vs Prošli Mjesec
    if (/(upored|pored|razlik|ovaj.*prosli|prosli.*ovaj|mjesec.*mjesec|rast|pad)/.test(q)) {
        const o = snimak.ovajMjesec;
        const p = snimak.prosliMjesec;
        const redovi = [
            { metrika: 'Prorez trupaca (m³)', ovaj: o.prorezM3, prosli: p.prorezM3, promjena: pctDelta(o.prorezM3, p.prorezM3) },
            { metrika: 'Izlaz gotove robe (m³)', ovaj: o.izlazM3, prosli: p.izlazM3, promjena: pctDelta(o.izlazM3, p.izlazM3) },
            { metrika: 'Iskorištenje / Yield (%)', ovaj: o.yieldProc, prosli: p.yieldProc, promjena: `${(o.yieldProc - p.yieldProc >= 0 ? '+' : '')}${formatBrojBHS(o.yieldProc - p.yieldProc, 1)} p.p.` },
            { metrika: 'Fakturisani prihod (KM)', ovaj: o.fakturisanoKM, prosli: p.fakturisanoKM, promjena: pctDelta(o.fakturisanoKM, p.fakturisanoKM) },
            { metrika: 'Keš priliv blagajna (KM)', ovaj: o.kesUlazKM, prosli: p.kesUlazKM, promjena: pctDelta(o.kesUlazKM, p.kesUlazKM) },
            { metrika: 'Keš odliv / troškovi (KM)', ovaj: o.kesIzlazKM, prosli: p.kesIzlazKM, promjena: pctDelta(o.kesIzlazKM, p.kesIzlazKM) },
            { metrika: 'Neto keš tok (KM)', ovaj: o.kesNetoKM, prosli: p.kesNetoKM, promjena: pctDelta(o.kesNetoKM, p.kesNetoKM) },
            { metrika: 'Zastoji mašina (min)', ovaj: o.zastojMin, prosli: p.zastojMin, promjena: pctDelta(o.zastojMin, p.zastojMin) },
        ];

        return {
            naslov: `Uporedni Izvještaj: ${o.label} vs ${p.label}`,
            odgovor: `### Direktorski zaključak poređenja (**${o.label}** vs **${p.label}**):\n- **Proizvodnja:** Prorez **${formatBrojBHS(o.prorezM3, 2)} m³** (${pctDelta(o.prorezM3, p.prorezM3)}) → Izlaz **${formatBrojBHS(o.izlazM3, 2)} m³** (${pctDelta(o.izlazM3, p.izlazM3)}), Yield **${formatBrojBHS(o.yieldProc, 1)}%**.\n- **Finansije:** Fakturisano **${formatBrojBHS(o.fakturisanoKM, 2)} KM** (${pctDelta(o.fakturisanoKM, p.fakturisanoKM)}), dok je neto keš tok **${formatBrojBHS(o.kesNetoKM, 2)} KM** (prošli mjesec: **${formatBrojBHS(p.kesNetoKM, 2)} KM**).`,
            kpi: [
                { label: `Prorez (${o.label})`, value: `${formatBrojBHS(o.prorezM3, 2)} m³`, sub: `vs ${formatBrojBHS(p.prorezM3, 2)} m³ (${pctDelta(o.prorezM3, p.prorezM3)})`, color: 'amber' },
                { label: `Izlaz (${o.label})`, value: `${formatBrojBHS(o.izlazM3, 2)} m³`, sub: `Yield: ${formatBrojBHS(o.yieldProc, 1)}%`, color: 'emerald' },
                { label: 'Fakturisano', value: `${formatBrojBHS(o.fakturisanoKM, 0)} KM`, sub: `vs ${formatBrojBHS(p.fakturisanoKM, 0)} KM (${pctDelta(o.fakturisanoKM, p.fakturisanoKM)})`, color: 'blue' },
                { label: 'Neto Keš Tok', value: `${formatBrojBHS(o.kesNetoKM, 0)} KM`, sub: `Prošli mj: ${formatBrojBHS(p.kesNetoKM, 0)} KM`, color: o.kesNetoKM >= 0 ? 'emerald' : 'red' },
            ],
            chart: {
                title: `📊 Poređenje Finansija (${o.label} vs ${p.label})`,
                subtitle: 'Fakturisano, Keš Priliv, Keš Odliv i Neto (KM)',
                type: 'bar',
                xKey: 'kategorija',
                unit: 'KM',
                series: [
                    { key: 'ovaj', name: o.label, color: '#3b82f6', unit: 'KM' },
                    { key: 'prosli', name: p.label, color: '#94a3b8', unit: 'KM' },
                ],
                data: [
                    { kategorija: 'Fakturisano', ovaj: o.fakturisanoKM, prosli: p.fakturisanoKM },
                    { kategorija: 'Keš Priliv', ovaj: o.kesUlazKM, prosli: p.kesUlazKM },
                    { kategorija: 'Keš Odliv', ovaj: o.kesIzlazKM, prosli: p.kesIzlazKM },
                    { kategorija: 'Neto Keš', ovaj: o.kesNetoKM, prosli: p.kesNetoKM },
                ],
            },
            tabela: {
                naslov: `Uporedna Tabela (${o.label} vs ${p.label})`,
                kolone: [
                    { key: 'metrika', label: 'Metrika', type: 'string', align: 'left' },
                    { key: 'ovaj', label: o.label, type: 'number', align: 'right' },
                    { key: 'prosli', label: p.label, type: 'number', align: 'right' },
                    { key: 'promjena', label: 'Promjena', type: 'string', align: 'right' },
                ],
                redovi,
            },
            predlozi: ['Prikaži 6-mjesečni trend proizvodnje i prihoda', 'Koji kupci najviše duguju (Aging)?', 'Top 10 najprofitabilnijih naloga'],
        };
    }

    // 9. Ponude & Rabati & Otpremnice
    if (/(ponud|rabat|konverzij|otpremnic|isporuk|utovar|kamion)/.test(q)) {
        const pn = snimak.ponude;
        const ot = snimak.otpremnice;
        return {
            naslov: 'Analiza Ponuda, Rabata i Otpremnica',
            odgovor: `### Komercijalni tok (Ponude → Otpreme):\n- **Ponude:** Ukupno **${pn.ukupno}** ponuda vrijednosti **${formatBrojBHS(pn.ukupnoKM, 2)} KM**, sa stopom realizacije/potvrde od **${formatBrojBHS(pn.konverzijaProc, 1)}%**.\n- **Kontrola rabata:** **${pn.visokiRabat.length}** ponuda ima rabat iznad 15%.\n- **Otpremnice:** Ukupno **${ot.ukupno}** (isporučeno: **${ot.isporuceno}**, u pripremi / čeka utovar: **${ot.naCekanju}**).`,
            kpi: [
                { label: 'Ukupno Ponuda', value: `${pn.ukupno}`, sub: `${formatBrojBHS(pn.ukupnoKM, 0)} KM`, color: 'blue' },
                { label: 'Konverzija Ponuda', value: `${formatBrojBHS(pn.konverzijaProc, 1)}%`, sub: 'Potvrđeno / Realizovano', color: pn.konverzijaProc >= 50 ? 'emerald' : 'amber' },
                { label: 'Otpreme (Isp. / Čeka)', value: `${ot.isporuceno} / ${ot.naCekanju}`, sub: `Ukupno ${ot.ukupno} otpremnica`, color: 'purple' },
                { label: 'Visoki Rabati (>15%)', value: `${pn.visokiRabat.length}`, sub: 'Za kontrolu uprave', color: pn.visokiRabat.length > 0 ? 'red' : 'emerald' },
            ],
            chart: {
                title: '📝 Ponude po Statusu',
                subtitle: 'Struktura komercijalnog pipeline-a',
                type: 'donut',
                xKey: 'status',
                unit: 'kom',
                series: [{ key: 'broj', name: 'Ponuda', color: '#3b82f6', unit: 'kom' }],
                data: pn.poStatusu,
            },
            tabela: {
                naslov: pn.visokiRabat.length > 0 ? 'Ponude sa Visokim Rabatom (>15%)' : 'Zadnje Ponude',
                kolone: [
                    { key: 'id', label: 'Ponuda', type: 'string', align: 'left' },
                    { key: 'kupac', label: 'Kupac', type: 'string', align: 'left' },
                    { key: 'datum', label: 'Datum', type: 'string', align: 'left' },
                    { key: 'rabat', label: 'Max Rabat %', type: 'number', align: 'right', suffix: '%' },
                    { key: 'iznosKM', label: 'Iznos (KM)', type: 'number', align: 'right', suffix: ' KM' },
                ],
                redovi: pn.visokiRabat.length > 0 ? pn.visokiRabat.slice(0, 20) : pn.lista.slice(0, 20).map((p) => ({
                    id: p.id, kupac: p.kupac_naziv || '-', datum: prikazDatumaBHS(p.datum), rabat: parseFloat(p.rabat || 0) || 0, iznosKM: parseFloat(kmVal(p).toFixed(2)),
                })),
            },
            predlozi: ['Koji kupci donose najveći promet?', 'Top 10 najprofitabilnijih naloga', 'Aktivni i kasneći radni nalozi'],
        };
    }

    // 10. HR, Radnici, Sati, Odsustva
    if (/(radnik|radnici|zaposlen|hr\b|prisustv|odmor|bolovanj|odsustv|sati rada|prekovremen)/.test(q)) {
        const h = snimak.hr;
        const ukSati = h.poRadnikuMjesec.reduce((s, r) => s + r.sati, 0);
        const ukKasnjenje = h.poRadnikuMjesec.reduce((s, r) => s + r.kasnjenjeMin, 0);
        return {
            naslov: `HR Izvještaj — Radni Sati i Prisustvo (${prikazMjesecaBHS(snimak.ovajMjPrefix)})`,
            odgovor: `### Pregled ljudskih resursa za **${prikazMjesecaBHS(snimak.ovajMjPrefix)}**:\n- **Aktivni radnici u sistemu:** **${h.brojRadnika}**\n- **Evidentirani radni sati ovaj mjesec:** **${formatBrojBHS(ukSati, 1)} h** (ukupno kašnjenja: **${formatBrojBHS(ukKasnjenje, 0)} min**).\n- **Zahtjevi za odsustvo na čekanju:** **${h.odsustvaNaCekanju}**.`,
            kpi: [
                { label: 'Radnika u Bazi', value: `${h.brojRadnika}`, sub: `Aktivnih na evidenciji: ${h.poRadnikuMjesec.length}`, color: 'blue' },
                { label: 'Obračunati Sati (Mj.)', value: `${formatBrojBHS(ukSati, 1)} h`, sub: prikazMjesecaBHS(snimak.ovajMjPrefix), color: 'emerald' },
                { label: 'Ukupno Kašnjenja', value: `${formatBrojBHS(ukKasnjenje, 0)} min`, sub: 'Tekući mjesec', color: ukKasnjenje > 120 ? 'red' : 'amber' },
                { label: 'Zahtjevi Odsustva', value: `${h.odsustvaNaCekanju}`, sub: 'Čekaju odobrenje', color: h.odsustvaNaCekanju > 0 ? 'amber' : 'emerald' },
            ],
            chart: {
                title: `👥 Obračunati Radni Sati po Radniku (${prikazMjesecaBHS(snimak.ovajMjPrefix)})`,
                subtitle: 'Top radnici po broju sati u tekućem mjesecu',
                type: 'hbar',
                xKey: 'radnik',
                unit: 'h',
                series: [{ key: 'sati', name: 'Sati', color: '#3b82f6', unit: 'h' }],
                data: h.poRadnikuMjesec.slice(0, 12),
            },
            tabela: {
                naslov: 'Detaljna Evidencija Rada (Tekući Mjesec)',
                kolone: [
                    { key: 'radnik', label: 'Radnik', type: 'string', align: 'left' },
                    { key: 'dana', label: 'Radnih dana', type: 'number', align: 'right' },
                    { key: 'sati', label: 'Sati', type: 'number', align: 'right', suffix: ' h' },
                    { key: 'prekovremenoSati', label: 'Prekovremeno', type: 'number', align: 'right', suffix: ' h' },
                    { key: 'kasnjenjeMin', label: 'Kašnjenje', type: 'number', align: 'right', suffix: ' min' },
                ],
                redovi: h.poRadnikuMjesec,
            },
            predlozi: ['Analiza učinka i zastoja po mašinama', 'Pronađi najveće rizike u firmi', 'Kompletni direktorski izvještaj'],
        };
    }

    // 11. Profitabilnost & Marže po Nalozima (i aktivni/kasneći RN)
    if (/(profit|marz|zarad|isplativ|nalog|job cost|rn-|rok isporuk|kasneci)/.test(q)) {
        const top = snimak.profitPoNalogu.slice(0, 15);
        const ukPrihod = top.reduce((s, r) => s + r.prihodKM, 0);
        const ukTrosak = top.reduce((s, r) => s + r.trosakKM, 0);
        const ukProfit = top.reduce((s, r) => s + r.profitKM, 0);
        const avgMarza = ukPrihod > 0 ? (ukProfit / ukPrihod) * 100 : 0;

        return {
            naslov: 'Profitabilnost i Status Radnih Naloga (Job Costing)',
            odgovor: `### Analiza radnih naloga:\n- **Aktivnih naloga u proizvodnji:** **${snimak.nalozi.aktivni}** (od toga **${snimak.nalozi.kasneci}** sa prekoračenim rokom isporuke!).\n- **Top ${top.length} naloga:** Prihod **${formatBrojBHS(ukPrihod, 2)} KM** | Trošak **${formatBrojBHS(ukTrosak, 2)} KM** | Neto profit **${formatBrojBHS(ukProfit, 2)} KM** (prosječna marža **${formatBrojBHS(avgMarza, 1)}%**).`,
            kpi: [
                { label: 'Aktivni / Kasneći RN', value: `${snimak.nalozi.aktivni} / ${snimak.nalozi.kasneci}`, sub: `Zaostatci plana: ${snimak.planiranje.zaostatciBroj}`, color: snimak.nalozi.kasneci > 0 ? 'red' : 'blue' },
                { label: 'Ukupni Prihod (Top)', value: `${formatBrojBHS(ukPrihod, 0)} KM`, sub: `${top.length} naloga`, color: 'blue' },
                { label: 'Neto Profit', value: `${formatBrojBHS(ukProfit, 0)} KM`, sub: `Trošak: -${formatBrojBHS(ukTrosak, 0)} KM`, color: ukProfit >= 0 ? 'emerald' : 'red' },
                { label: 'Prosječna Marža', value: `${formatBrojBHS(avgMarza, 1)}%`, sub: 'Cilj > 20%', color: avgMarza >= 20 ? 'emerald' : 'amber' },
            ],
            chart: {
                title: '💎 Top Radni Nalozi: Prihod vs Trošak vs Profit (KM)',
                subtitle: 'Finansijski rezultat po nalogu',
                type: 'bar',
                xKey: 'rn',
                unit: 'KM',
                series: [
                    { key: 'prihod', name: 'Prihod', color: '#3b82f6', unit: 'KM' },
                    { key: 'trosak', name: 'Trošak', color: '#f59e0b', unit: 'KM' },
                    { key: 'profit', name: 'Profit', color: '#10b981', unit: 'KM' },
                ],
                data: top.slice(0, 8).map((r) => ({ rn: r.rn_id, prihod: r.prihodKM, trosak: r.trosakKM, profit: r.profitKM })),
            },
            tabela: {
                naslov: 'Detaljna Profitabilnost i Rokovi Naloga',
                kolone: [
                    { key: 'rn_id', label: 'Nalog', type: 'string', align: 'left' },
                    { key: 'kupac', label: 'Kupac', type: 'string', align: 'left' },
                    { key: 'rok', label: 'Rok', type: 'string', align: 'left' },
                    { key: 'prihodKM', label: 'Prihod', type: 'number', align: 'right', suffix: ' KM' },
                    { key: 'profitKM', label: 'Profit', type: 'number', align: 'right', suffix: ' KM' },
                    { key: 'marzaProc', label: 'Marža %', type: 'number', align: 'right', suffix: '%' },
                ],
                redovi: top,
            },
            predlozi: ['Koji kupci najviše duguju (Aging)?', 'Analiza ponuda i visokih rabata', 'Pronađi najveće rizike u firmi'],
        };
    }

    // 12. Dužnici, Aging, Dospjeli Računi
    if (/(dug|duzn|aging|dospjel|kasn|naplat|neplacen|otvoren.*racun|racun)/.test(q)) {
        const f = snimak.finansije;
        const a = f.aging;
        const minDanaMatch = q.match(/preko\s*(\d+)|vise od\s*(\d+)|>\s*(\d+)/);
        const minDana = minDanaMatch ? parseInt(minDanaMatch[1] || minDanaMatch[2] || minDanaMatch[3], 10) : 0;
        const filtrirani = minDana > 0 ? f.otvoreniRacuni.filter((r) => r.kasniDana > minDana) : f.otvoreniRacuni;

        return {
            naslov: minDana > 0 ? `Dužnici sa Kašnjenjem Preko ${minDana} Dana` : 'Analiza Potraživanja, Dužnika i Aging Strukture',
            odgovor: `### Stanje otvorenih potraživanja:\n- **Ukupni otvoreni dug:** **${formatBrojBHS(f.otvoreniDugKM, 2)} KM** (${f.otvoreniRacuniBroj} otvorenih računa).\n- **Dospjelo preko roka valute:** **${formatBrojBHS(f.dospjeliDugKM, 2)} KM**.\n- **Kritično (60+ dana):** **${formatBrojBHS(a.d61_90 + a.d90plus, 2)} KM** (90+ dana: **${formatBrojBHS(a.d90plus, 2)} KM**).\n${f.topDuznici[0] ? `- Najveći dužnik je **${f.topDuznici[0].kupac}** (**${formatBrojBHS(f.topDuznici[0].otvoreniDugKM, 2)} KM**).` : '- Nema otvorenih dugovanja!'}`,
            kpi: [
                { label: 'Otvoreni Dug', value: `${formatBrojBHS(f.otvoreniDugKM, 2)} KM`, sub: `${f.otvoreniRacuniBroj} računa`, color: f.otvoreniDugKM > 0 ? 'amber' : 'emerald' },
                { label: 'Dospjelo (Kasni)', value: `${formatBrojBHS(f.dospjeliDugKM, 2)} KM`, sub: 'Preko roka valute', color: f.dospjeliDugKM > 0 ? 'red' : 'emerald' },
                { label: 'U Roku (0 d)', value: `${formatBrojBHS(a.uRoku, 2)} KM`, sub: 'Još nije dospjelo', color: 'blue' },
                { label: 'Kritično 60+ dana', value: `${formatBrojBHS(a.d61_90 + a.d90plus, 2)} KM`, sub: `90+ d: ${formatBrojBHS(a.d90plus, 2)} KM`, color: (a.d61_90 + a.d90plus) > 0 ? 'red' : 'emerald' },
            ],
            chart: {
                title: '⏳ Aging Struktura Potraživanja (KM)',
                subtitle: 'Starost duga preko roka valute',
                type: 'bar',
                xKey: 'period',
                unit: 'KM',
                series: [{ key: 'iznos', name: 'Dug', color: '#ef4444', unit: 'KM' }],
                data: [
                    { period: 'U roku', iznos: a.uRoku },
                    { period: '1–30 d', iznos: a.d1_30 },
                    { period: '31–60 d', iznos: a.d31_60 },
                    { period: '61–90 d', iznos: a.d61_90 },
                    { period: '90+ d', iznos: a.d90plus },
                ],
            },
            tabela: {
                naslov: `Otvoreni Računi (${filtrirani.length})`,
                kolone: [
                    { key: 'id', label: 'Račun', type: 'string', align: 'left' },
                    { key: 'kupac', label: 'Kupac', type: 'string', align: 'left' },
                    { key: 'rok', label: 'Rok valute', type: 'string', align: 'left' },
                    { key: 'kasniDana', label: 'Kasni (d)', type: 'number', align: 'right', suffix: ' d' },
                    { key: 'dugKM', label: 'Preostali Dug', type: 'number', align: 'right', suffix: ' KM' },
                ],
                redovi: filtrirani.slice(0, 30),
            },
            predlozi: ['Izdvoji samo račune što kasne preko 30 dana', 'Top 10 kupaca po prometu', 'Analiza blagajne i troškova'],
        };
    }

    // 13. Kupci & Prodaja
    if (/(kupac|kupci|prodaj|promet|klijent)/.test(q)) {
        const topK = snimak.finansije.kupciStat.slice(0, 15);
        return {
            naslov: 'Analiza Kupaca i Strukture Prodaje',
            odgovor: `Ukupno je fakturisano **${formatBrojBHS(snimak.finansije.ukupnoFakturisanoKM, 2)} KM** prema **${snimak.finansije.kupciStat.length} kupaca**.\n${topK[0] ? `- Najveći kupac je **${topK[0].kupac}** sa **${formatBrojBHS(topK[0].fakturisanoKM, 2)} KM** (${topK[0].racuna} računa, otvoreni saldo **${formatBrojBHS(topK[0].otvoreniDugKM, 2)} KM**).` : ''}`,
            kpi: [
                { label: 'Ukupno Fakturisano', value: `${formatBrojBHS(snimak.finansije.ukupnoFakturisanoKM, 0)} KM`, sub: `${snimak.finansije.racuniUkupno} računa`, color: 'blue' },
                { label: 'Aktivnih Kupaca', value: `${snimak.finansije.kupciStat.length}`, sub: `U bazi ${snimak.hr.brojKupaca}`, color: 'emerald' },
                { label: 'Top Kupac', value: topK[0]?.kupac?.slice(0, 16) || '-', sub: topK[0] ? `${formatBrojBHS(topK[0].fakturisanoKM, 0)} KM` : '', color: 'purple' },
                { label: 'Otvoreni Saldo', value: `${formatBrojBHS(snimak.finansije.otvoreniDugKM, 0)} KM`, sub: `Dospjelo: ${formatBrojBHS(snimak.finansije.dospjeliDugKM, 0)} KM`, color: 'amber' },
            ],
            chart: {
                title: '🏆 Top 10 Kupaca po Prometu vs Dug (KM)',
                subtitle: 'Ukupno fakturisano i otvoreni saldo',
                type: 'hbar',
                xKey: 'kupac',
                unit: 'KM',
                series: [
                    { key: 'fakturisano', name: 'Fakturisano', color: '#3b82f6', unit: 'KM' },
                    { key: 'dug', name: 'Otvoreni dug', color: '#ef4444', unit: 'KM' },
                ],
                data: topK.slice(0, 10).map((k) => ({ kupac: k.kupac.slice(0, 22), fakturisano: k.fakturisanoKM, dug: k.otvoreniDugKM })),
            },
            tabela: {
                naslov: 'Rang Lista Kupaca',
                kolone: [
                    { key: 'kupac', label: 'Kupac', type: 'string', align: 'left' },
                    { key: 'racuna', label: 'Računa', type: 'number', align: 'right' },
                    { key: 'fakturisanoKM', label: 'Fakturisano', type: 'number', align: 'right', suffix: ' KM' },
                    { key: 'otvoreniDugKM', label: 'Otvoreni Dug', type: 'number', align: 'right', suffix: ' KM' },
                ],
                redovi: topK,
            },
            predlozi: ['Koji kupci najviše duguju (Aging)?', 'Analiza ponuda i konverzije', 'Top 10 najprofitabilnijih naloga'],
        };
    }

    // 14. Mašine, Prorez, Yield & Zastoji
    if (/(masin|prorez|pilan|yield|iskorist|prinos|zastoj|kvar|brent|ucinak|proizvodnj)/.test(q)) {
        const ukZastoj = snimak.masine.reduce((s, m) => s + m.zastojMin, 0);
        return {
            naslov: 'Analiza Proreza, Yield-a, Mašina i Zastoja',
            odgovor: `### Performanse pogona:\n- **Globalni Yield Pilane:** **${formatBrojBHS(snimak.paketi.globalYieldProc, 1)}%** (${formatBrojBHS(snimak.paketi.izlazPilanaM3, 2)} m³ iz ${formatBrojBHS(snimak.trupci.prorezanoM3, 2)} m³ trupaca).\n- **Tekući mjesec:** Prorez **${formatBrojBHS(snimak.ovajMjesec.prorezM3, 2)} m³** → Izlaz **${formatBrojBHS(snimak.ovajMjesec.izlazM3, 2)} m³** (Yield **${formatBrojBHS(snimak.ovajMjesec.yieldProc, 1)}%**).\n- **Zastoji:** Ukupno **${formatBrojBHS(ukZastoj, 0)} min** (ovaj mj: **${formatBrojBHS(snimak.ovajMjesec.zastojMin, 0)} min**). Najčešći razlog zastoja: **${snimak.topRazloziZastoja[0]?.razlog || 'Nema zabilježenih'}**.`,
            kpi: [
                { label: 'Global Yield', value: `${formatBrojBHS(snimak.paketi.globalYieldProc, 1)}%`, sub: `Ovaj mj: ${formatBrojBHS(snimak.ovajMjesec.yieldProc, 1)}%`, color: 'emerald' },
                { label: 'Prorez (Ovaj Mj.)', value: `${formatBrojBHS(snimak.ovajMjesec.prorezM3, 2)} m³`, sub: `${snimak.ovajMjesec.prorezKom} trupaca`, color: 'amber' },
                { label: 'Izlaz (Ovaj Mj.)', value: `${formatBrojBHS(snimak.ovajMjesec.izlazM3, 2)} m³`, sub: `${snimak.ovajMjesec.paketiBroj} stavki`, color: 'blue' },
                { label: 'Zastoji (Ovaj Mj.)', value: `${formatBrojBHS(snimak.ovajMjesec.zastojMin, 0)} min`, sub: `Ukupno: ${formatBrojBHS(ukZastoj, 0)} min`, color: snimak.ovajMjesec.zastojMin > 120 ? 'red' : 'purple' },
            ],
            chart: {
                title: '⚙️ Proizvodnja po Mašinama (m³)',
                subtitle: 'Ukupna proizvedena kubikaža po pogonu',
                type: 'bar',
                xKey: 'masina',
                unit: 'm³',
                series: [{ key: 'izlazM3', name: 'Izlaz (m³)', color: '#10b981', unit: 'm³' }],
                data: snimak.masine.slice(0, 10),
            },
            tabela: {
                naslov: 'Statistika Mašina i Zastoja',
                kolone: [
                    { key: 'masina', label: 'Mašina', type: 'string', align: 'left' },
                    { key: 'paketa', label: 'Stavki', type: 'number', align: 'right' },
                    { key: 'izlazM3', label: 'Izlaz (m³)', type: 'number', align: 'right', suffix: ' m³' },
                    { key: 'zastojMin', label: 'Zastoji (min)', type: 'number', align: 'right', suffix: ' min' },
                ],
                redovi: snimak.masine,
            },
            predlozi: ['Izvještaj sušara i servisa pila', 'Stanje trupaca i sirovine', 'Prikaži 6-mjesečni trend proizvodnje i prihoda'],
        };
    }

    // 15. Blagajna, Keš Tok & Troškovi (period-aware!)
    if (/(blagajn|kas|kes|gotovin|trosk|rashod|isplat|uplat)/.test(q)) {
        const f = snimak.finansije;
        const blFilt = period.tip !== 'SVE'
            ? f.blagajnaSve.filter((b) => datumIso(b.datum) >= period.od && datumIso(b.datum) <= period.do)
            : f.blagajnaSve;
        const katM = {};
        blFilt.filter((b) => !String(b.tip || '').toUpperCase().includes('ULAZ')).forEach((b) => {
            const k = (b.kategorija || 'Ostalo').trim();
            katM[k] = (katM[k] || 0) + (parseFloat(b.iznos || 0) || 0);
        });
        const katArr = Object.entries(katM).map(([kategorija, iznos]) => ({ kategorija, iznos: parseFloat(iznos.toFixed(2)) })).sort((a, b) => b.iznos - a.iznos);
        const perUlaz = blFilt.filter((b) => String(b.tip || '').toUpperCase().includes('ULAZ')).reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);
        const perIzlaz = blFilt.filter((b) => !String(b.tip || '').toUpperCase().includes('ULAZ')).reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);

        return {
            naslov: `Blagajna, Keš Tok i Troškovi — ${period.label}`,
            odgovor: `### Presjek gotovinskog toka (**${period.label}**):\n- **Trenutno ukupno stanje u kasi:** **${formatBrojBHS(f.stanjeKaseKM, 2)} KM**\n- **Prilivi u periodu:** **+${formatBrojBHS(perUlaz, 2)} KM** | **Odlivi (troškovi):** **-${formatBrojBHS(perIzlaz, 2)} KM** | **Neto:** **${formatBrojBHS(perUlaz - perIzlaz, 2)} KM**.\n${katArr[0] ? `- Najveća stavka troška u periodu je **${katArr[0].kategorija}** (**${formatBrojBHS(katArr[0].iznos, 2)} KM**).` : ''}`,
            kpi: [
                { label: 'Trenutno u Kasi', value: `${formatBrojBHS(f.stanjeKaseKM, 2)} KM`, sub: 'Ukupno stanje', color: f.stanjeKaseKM >= 0 ? 'emerald' : 'red' },
                { label: 'Prilivi (Period)', value: `+${formatBrojBHS(perUlaz, 0)} KM`, sub: period.label, color: 'blue' },
                { label: 'Odlivi (Period)', value: `-${formatBrojBHS(perIzlaz, 0)} KM`, sub: `${katArr.length} kategorija`, color: 'red' },
                { label: 'Neto (Period)', value: `${formatBrojBHS(perUlaz - perIzlaz, 0)} KM`, sub: 'Razlika priliv - odliv', color: perUlaz >= perIzlaz ? 'emerald' : 'amber' },
            ],
            chart: {
                title: `💵 Struktura Troškova (${period.label})`,
                subtitle: 'Najveće kategorije odliva (KM)',
                type: 'hbar',
                xKey: 'kategorija',
                unit: 'KM',
                series: [{ key: 'iznos', name: 'Trošak', color: '#ef4444', unit: 'KM' }],
                data: katArr.slice(0, 10),
            },
            tabela: {
                naslov: `Troškovi po Kategorijama (${period.label})`,
                kolone: [
                    { key: 'kategorija', label: 'Kategorija', type: 'string', align: 'left' },
                    { key: 'iznos', label: 'Iznos (KM)', type: 'number', align: 'right', suffix: ' KM' },
                ],
                redovi: katArr,
            },
            predlozi: ['Koji kupci najviše duguju (Aging)?', 'Uporedi ovaj i prošli mjesec', 'Pronađi najveće rizike u firmi'],
        };
    }

    // 16. Lager Gotove Robe (sa pretragom po artiklu/dimenziji!)
    if (/(lager|zalih|paket|stanje robe|dorad|artikl|gotov|dask|gred|letv|element)/.test(q)) {
        const keywords = q.split(/\s+/).filter((w) => w.length >= 3 && !['sta', 'imamo', 'na', 'lageru', 'lager', 'stanje', 'robe', 'zaliha', 'zalihe', 'paketa', 'gotove', 'proizvoda', 'artikala', 'od', 'za', 'sve'].includes(w));
        const filtLager = keywords.length > 0
            ? snimak.paketi.lagerPoProizvodu.filter((p) => keywords.some((kw) => normTxt(p.naziv).includes(kw)))
            : snimak.paketi.lagerPoProizvodu;
        const lista = filtLager.length > 0 ? filtLager : snimak.paketi.lagerPoProizvodu;
        const sumM3 = lista.reduce((s, x) => s + x.m3, 0);

        return {
            naslov: 'Izvještaj Lagera Gotove Robe i Paketa',
            odgovor: `### Stanje zaliha na lageru:\n- **Ukupan lager gotove robe:** **${formatBrojBHS(snimak.paketi.naLageruM3, 3)} m³** (**${snimak.paketi.naLageruBroj} paketa**).\n- U proizvodnji: **${snimak.paketi.uRaduBroj}** paketa | Otpremljeno: **${snimak.paketi.otpremljeniBroj}** paketa.\n${filtLager.length > 0 && keywords.length > 0 ? `- Za traženi filter pronađeno je **${filtLager.length} artikala** ukupne kubikaže **${formatBrojBHS(sumM3, 3)} m³**.` : ''}`,
            kpi: [
                { label: 'Lager Gotove Robe', value: `${formatBrojBHS(snimak.paketi.naLageruM3, 2)} m³`, sub: `${snimak.paketi.naLageruBroj} paketa`, color: 'emerald' },
                { label: 'U Proizvodnji', value: `${snimak.paketi.uRaduBroj} pak.`, sub: 'Otvoreni paketi', color: 'amber' },
                { label: 'Otpremljeno', value: `${snimak.paketi.otpremljeniBroj} pak.`, sub: 'Isporučeno kupcima', color: 'blue' },
                { label: 'Trupci na Placu', value: `${formatBrojBHS(snimak.trupci.naLageruM3, 2)} m³`, sub: `${snimak.trupci.naLageruKom} trupaca`, color: 'purple' },
            ],
            chart: {
                title: '📦 Lager po Proizvodima (m³)',
                subtitle: 'Top artikli na stanju',
                type: 'hbar',
                xKey: 'naziv',
                unit: 'm³',
                series: [{ key: 'm3', name: 'Na lageru', color: '#3b82f6', unit: 'm³' }],
                data: lista.slice(0, 10).map((x) => ({ naziv: x.naziv.slice(0, 24), m3: x.m3 })),
            },
            tabela: {
                naslov: 'Detaljan Lager Gotove Robe',
                kolone: [
                    { key: 'naziv', label: 'Proizvod', type: 'string', align: 'left' },
                    { key: 'paketa', label: 'Paketa', type: 'number', align: 'right' },
                    { key: 'm3', label: 'Količina (m³)', type: 'number', align: 'right', suffix: ' m³' },
                ],
                redovi: lista.slice(0, 25),
            },
            predlozi: ['Stanje trupaca i sirovine po vrstama', 'Aktivni radni nalozi i rokovi', 'Analiza učinka i zastoja po mašinama'],
        };
    }

    // 17. Trupci, Sirovina & Dobavljači
    if (/(trupac|trupc|sirovin|sumarij|dobavljac|vrst|bukv|jel|smrc|hrast|bor)/.test(q)) {
        const t = snimak.trupci;
        return {
            naslov: 'Izvještaj Sirovine, Trupaca i Šumarija',
            odgovor: `### Stanje trupaca:\n- **Na lageru (spremno za prorez):** **${formatBrojBHS(t.naLageruM3, 3)} m³** (**${t.naLageruKom} kom**)\n- **Ukupno prorezano:** **${formatBrojBHS(t.prorezanoM3, 3)} m³** (**${t.prorezanoKom} kom**)\n- **FSC certificirani udio:** **${formatBrojBHS(t.fscUdioProc, 1)}%**.`,
            kpi: [
                { label: 'Trupci na Placu', value: `${formatBrojBHS(t.naLageruM3, 2)} m³`, sub: `${t.naLageruKom} kom`, color: 'emerald' },
                { label: 'Prorezano', value: `${formatBrojBHS(t.prorezanoM3, 2)} m³`, sub: `${t.prorezanoKom} kom`, color: 'amber' },
                { label: 'FSC Udio', value: `${formatBrojBHS(t.fscUdioProc, 1)}%`, sub: 'Sljedivost CoC', color: 'blue' },
                { label: 'Dobavljača', value: `${t.poDobavljacu.length}`, sub: t.poDobavljacu[0] ? `Top: ${t.poDobavljacu[0].dobavljac.slice(0, 16)}` : '', color: 'purple' },
            ],
            chart: {
                title: '🪵 Trupci po Vrsti Drveta (Lager vs Prorezano m³)',
                subtitle: 'Pregled sirovine po vrstama',
                type: 'bar',
                xKey: 'vrsta',
                unit: 'm³',
                series: [
                    { key: 'lagerM3', name: 'Na lageru', color: '#10b981', unit: 'm³' },
                    { key: 'prorezanoM3', name: 'Prorezano', color: '#f59e0b', unit: 'm³' },
                ],
                data: t.poVrsti.slice(0, 8),
            },
            tabela: {
                naslov: 'Dobavljači / Šumarije',
                kolone: [
                    { key: 'dobavljac', label: 'Dobavljač / Šumarija', type: 'string', align: 'left' },
                    { key: 'kom', label: 'Trupaca', type: 'number', align: 'right' },
                    { key: 'm3', label: 'Ukupno (m³)', type: 'number', align: 'right', suffix: ' m³' },
                    { key: 'fscKom', label: 'FSC kom', type: 'number', align: 'right' },
                ],
                redovi: t.poDobavljacu.slice(0, 20),
            },
            predlozi: ['Izvještaj biomase, peći, FSC i sušara', 'Stanje lagera gotove robe', 'Analiza učinka i zastoja po mašinama'],
        };
    }

    // 18. Biomasa, Peći, FSC, CBAM, Sušare, Servis, Planiranje
    if (/(biomas|piljevin|okor|sjeck|pec|kotl|fsc|eudr|cbam|co2|eko|susar|sarz|servis|ostr|planiranj|raspor)/.test(q)) {
        const b = snimak.biomasaMjesec;
        const aktivneSusare = snimak.susare.filter((s) => s.status === 'U SUŠENJU' || s.status === 'SUŠENJE');
        const ukBio = b.koraM3 + b.piljevinaM3 + b.okorakM3;
        return {
            naslov: 'Izvještaj Biomase, Peći, FSC, Sušara & Planiranja',
            odgovor: `### EKO Bilans, Sušare i Planiranje (${prikazMjesecaBHS(snimak.ovajMjPrefix)}):\n- **Biomasa iz mjesečnog proreza (${formatBrojBHS(b.prorezM3, 2)} m³):** Kora **${formatBrojBHS(b.koraM3, 2)} m³**, Piljevina **${formatBrojBHS(b.piljevinaM3, 2)} m³**, Okorak **${formatBrojBHS(b.okorakM3, 2)} m³** (ukupno **${formatBrojBHS(ukBio, 2)} m³**).\n- **FSC udio sirovine:** **${formatBrojBHS(snimak.trupci.fscUdioProc, 1)}%**.\n- **Sušare & Planiranje:** **${aktivneSusare.length}** aktivnih šarži sušara | Danas zakazano **${formatBrojBHS(snimak.planiranje.planDanasM3, 2)} m³** | Zaostatci iz prošlih dana: **${snimak.planiranje.zaostatciBroj}** stavki (**${formatBrojBHS(snimak.planiranje.zaostatciM3, 2)} m³**).`,
            kpi: [
                { label: 'Ukupna Biomasa (Mj.)', value: `${formatBrojBHS(ukBio, 1)} m³`, sub: `Iz ${formatBrojBHS(b.prorezM3, 1)} m³ proreza`, color: 'emerald' },
                { label: 'FSC Udio Trupaca', value: `${formatBrojBHS(snimak.trupci.fscUdioProc, 1)}%`, sub: 'CoC / EUDR sljedivost', color: 'blue' },
                { label: 'Sušare / Servis', value: `${aktivneSusare.length} / ${snimak.servisi.length}`, sub: 'Aktivne šarže / Pile', color: 'amber' },
                { label: 'Zaostatci Planiranja', value: `${snimak.planiranje.zaostatciBroj} stavki`, sub: `${formatBrojBHS(snimak.planiranje.zaostatciM3, 2)} m³`, color: snimak.planiranje.zaostatciBroj > 0 ? 'red' : 'emerald' },
            ],
            chart: {
                title: '🌿 Bilans Biomase — Tekući Mjesec (m³)',
                subtitle: 'Kora, Piljevina, Okorak i Utrošak Peći',
                type: 'bar',
                xKey: 'vrsta',
                unit: 'm³',
                series: [{ key: 'm3', name: 'Volumen', color: '#10b981', unit: 'm³' }],
                data: [
                    { vrsta: 'Kora', m3: b.koraM3 },
                    { vrsta: 'Piljevina', m3: b.piljevinaM3 },
                    { vrsta: 'Okorak', m3: b.okorakM3 },
                    { vrsta: 'Utrošak Peći', m3: b.utrosakPeciM3 },
                ],
            },
            tabela: {
                naslov: 'Aktivne Šarže Sušara & Servis Pila',
                kolone: [
                    { key: 'kategorija', label: 'Pogon', type: 'string', align: 'left' },
                    { key: 'naziv', label: 'Komora / Mašina', type: 'string', align: 'left' },
                    { key: 'status', label: 'Status', type: 'string', align: 'left' },
                    { key: 'kolicina', label: 'Opterećenje', type: 'string', align: 'right' },
                ],
                redovi: [
                    ...snimak.susare.slice(0, 10).map((s) => ({
                        kategorija: '🔥 Sušara', naziv: `${s.komora || 'Komora'} (${s.artikal || s.vrsta || '-'})`, status: s.status || '-', kolicina: `${formatBrojBHS(parseFloat(s.kolicina_m3 || s.zapremina || 0) || 0, 2)} m³`,
                    })),
                    ...snimak.servisi.slice(0, 10).map((s) => ({
                        kategorija: '🪚 Pila', naziv: s.masina || s.naziv || 'Mašina', status: s.status || 'OK', kolicina: `${formatBrojBHS(parseFloat(s.odradjeno_m3 || 0) || 0, 1)} / ${formatBrojBHS(parseFloat(s.prag_m3 || 0) || 0, 0)} m³`,
                    })),
                ],
            },
            predlozi: ['Stanje trupaca i šumarija', 'Pronađi najveće rizike u firmi', 'Kompletni direktorski izvještaj'],
        };
    }

    // 19. Reklamacije
    if (/(reklamacij|povrat|skart|kvalitet)/.test(q)) {
        const rk = snimak.reklamacije;
        return {
            naslov: 'Izvještaj Reklamacija i Kvaliteta',
            odgovor: `### Pregled reklamacija:\n- Ukupno evidentirano: **${rk.ukupno}** reklamacija (**${formatBrojBHS(rk.ukupnoM3, 3)} m³**).\n- Odobreno: **${rk.odobrene}** | Na čekanju: **${rk.naCekanju}**.`,
            kpi: [
                { label: 'Ukupno Reklamacija', value: `${rk.ukupno}`, sub: `${formatBrojBHS(rk.ukupnoM3, 3)} m³`, color: 'amber' },
                { label: 'Odobreno', value: `${rk.odobrene}`, sub: 'Prihvaćeno', color: 'red' },
                { label: 'Na Čekanju', value: `${rk.naCekanju}`, sub: 'Čeka odluku', color: 'blue' },
                { label: 'Ovaj Mjesec', value: `${snimak.ovajMjesec.reklamacijeBroj}`, sub: `Prošli mj: ${snimak.prosliMjesec.reklamacijeBroj}`, color: 'purple' },
            ],
            chart: {
                title: '⚠️ Status Reklamacija',
                subtitle: 'Raspodjela po statusu',
                type: 'donut',
                xKey: 'status',
                unit: 'kom',
                series: [{ key: 'broj', name: 'Broj', color: '#f59e0b', unit: 'kom' }],
                data: [
                    { status: 'Odobreno', broj: rk.odobrene },
                    { status: 'Na čekanju', broj: rk.naCekanju },
                    { status: 'Ostalo', broj: Math.max(0, rk.ukupno - rk.odobrene - rk.naCekanju) },
                ],
            },
            tabela: {
                naslov: 'Zadnje Reklamacije',
                kolone: [
                    { key: 'datum', label: 'Datum', type: 'string', align: 'left' },
                    { key: 'kupac', label: 'Kupac', type: 'string', align: 'left' },
                    { key: 'razlog', label: 'Razlog', type: 'string', align: 'left' },
                    { key: 'm3', label: 'm³', type: 'number', align: 'right', suffix: ' m³' },
                    { key: 'status', label: 'Status', type: 'string', align: 'left' },
                ],
                redovi: rk.lista.slice(0, 25).map((r) => ({
                    datum: prikazDatumaBHS(r.datum || r.created_at), kupac: r.kupac_naziv || '-', razlog: r.razlog || r.opis || '-', m3: parseFloat((parseFloat(r.kolicina || 0) || 0).toFixed(3)), status: r.status || '-',
                })),
            },
            predlozi: ['Top 10 najprofitabilnijih naloga', 'Pronađi najveće rizike u firmi', 'Kompletni direktorski izvještaj'],
        };
    }

    // 20. Default: Period-aware Direktorski Presjek sa automatskim rizicima!
    const o = snimak.ovajMjesec;
    const p = snimak.prosliMjesec;
    const f = snimak.finansije;
    const topRizik = snimak.anomalije[0];
    return {
        naslov: `Direktorski ERP Presjek (${prikazDatumaBHS(snimak.danasIso)})`,
        odgovor: `### Direktorski sažetak stanja firme:\n- **Proizvodnja (${o.label}):** Prorez **${formatBrojBHS(o.prorezM3, 2)} m³** (${pctDelta(o.prorezM3, p.prorezM3)}) → Izlaz **${formatBrojBHS(o.izlazM3, 2)} m³** (Yield **${formatBrojBHS(o.yieldProc, 1)}%**).\n- **Zalihe:** Gotova roba **${formatBrojBHS(snimak.paketi.naLageruM3, 2)} m³** (${snimak.paketi.naLageruBroj} paketa) | Trupci plac **${formatBrojBHS(snimak.trupci.naLageruM3, 2)} m³**.\n- **Finansije:** Kasa **${formatBrojBHS(f.stanjeKaseKM, 2)} KM** | Otvoreni dug **${formatBrojBHS(f.otvoreniDugKM, 2)} KM** (dospjelo: **${formatBrojBHS(f.dospjeliDugKM, 2)} KM**).\n${topRizik ? `\n⚠️ **Glavna tačka pažnje (${topRizik.kategorija}):** ${topRizik.opis}` : ''}\n\n*💡 Za potpuno slobodnu konverzaciju kao u Antigravity-ju (odgovori na svako kompleksno i nestandardno pitanje), klikni **🔑 AI Ključ** gore desno i zalijepi besplatni Google Gemini ili Groq ključ!*`,
        kpi: [
            { label: 'Stanje Kase', value: `${formatBrojBHS(f.stanjeKaseKM, 0)} KM`, sub: `Mj. neto: ${formatBrojBHS(o.kesNetoKM, 0)} KM`, color: 'emerald' },
            { label: 'Dospjeli Dug', value: `${formatBrojBHS(f.dospjeliDugKM, 0)} KM`, sub: `Otvoreno: ${formatBrojBHS(f.otvoreniDugKM, 0)} KM`, color: f.dospjeliDugKM > 0 ? 'red' : 'emerald' },
            { label: `Izlaz (${o.label})`, value: `${formatBrojBHS(o.izlazM3, 2)} m³`, sub: `Yield: ${formatBrojBHS(o.yieldProc, 1)}%`, color: 'amber' },
            { label: 'Aktivni Rizici', value: `${snimak.anomalije.length}`, sub: `${snimak.nalozi.kasneci} kasnećih RN`, color: snimak.anomalije.length > 0 ? 'red' : 'emerald' },
        ],
        chart: {
            title: '📈 7-Dnevni Operativni Trend (Prorez vs Izlaz m³)',
            subtitle: 'Dnevna dinamika prerade u zadnjih 7 dana',
            type: 'bar',
            xKey: 'dan',
            unit: 'm³',
            series: [
                { key: 'prorezM3', name: 'Prorez (m³)', color: '#f59e0b', unit: 'm³' },
                { key: 'izlazM3', name: 'Izlaz (m³)', color: '#10b981', unit: 'm³' },
            ],
            data: snimak.dani7,
        },
        tabela: {
            naslov: `Ključni Pokazatelji: ${o.label} vs ${p.label}`,
            kolone: [
                { key: 'pokazatelj', label: 'Pokazatelj', type: 'string', align: 'left' },
                { key: 'ovaj', label: o.label, type: 'number', align: 'right' },
                { key: 'prosli', label: p.label, type: 'number', align: 'right' },
                { key: 'trend', label: 'Promjena', type: 'string', align: 'right' },
            ],
            redovi: [
                { pokazatelj: 'Prorez trupaca (m³)', ovaj: o.prorezM3, prosli: p.prorezM3, trend: pctDelta(o.prorezM3, p.prorezM3) },
                { pokazatelj: 'Izlaz gotove robe (m³)', ovaj: o.izlazM3, prosli: p.izlazM3, trend: pctDelta(o.izlazM3, p.izlazM3) },
                { pokazatelj: 'Fakturisani prihod (KM)', ovaj: o.fakturisanoKM, prosli: p.fakturisanoKM, trend: pctDelta(o.fakturisanoKM, p.fakturisanoKM) },
                { pokazatelj: 'Keš priliv (KM)', ovaj: o.kesUlazKM, prosli: p.kesUlazKM, trend: pctDelta(o.kesUlazKM, p.kesUlazKM) },
                { pokazatelj: 'Keš odliv (KM)', ovaj: o.kesIzlazKM, prosli: p.kesIzlazKM, trend: pctDelta(o.kesIzlazKM, p.kesIzlazKM) },
            ],
        },
        predlozi: [
            'Pronađi najveće rizike i gdje gubimo novac',
            'Prikaži 6-mjesečni trend proizvodnje i prihoda',
            'Koji kupci najviše duguju (Aging)?',
            'Analiza ponuda, rabata i otpremnica',
        ],
    };
}
