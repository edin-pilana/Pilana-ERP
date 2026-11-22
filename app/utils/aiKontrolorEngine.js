"use client";
import { toLocalIso, prikazDatumaBHS, getEfektivnaZapreminaTrupca } from './dateHelpers';
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
    return (parseFloat(r?.ukupno_sa_pdv || 0) || 0) * kurs;
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
    if (!prev || Math.abs(prev) < 0.001) return curr > 0 ? '+100%' : '0%';
    const d = ((curr - prev) / Math.abs(prev)) * 100;
    return `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`;
};

const datumIso = (val) => String(val || '').slice(0, 10);

export function izgradiErpSnimak(baza, { bezQaTesta = true } = {}) {
    const filt = (arr) => (Array.isArray(arr) ? (bezQaTesta ? arr.filter((x) => !jeQaTestniZapis(x)) : arr) : []);

    const trupci = filt(baza.trupci);
    const prorezLog = filt(baza.prorez_log);
    const paketi = filt(baza.paketi).filter((p) => parseFloat(p.kolicina_final || 0) > 0);
    const racuni = filt(baza.racuni).filter((r) => !['STORNIRANO', 'OBRISANO'].includes(String(r.status || '').toUpperCase()));
    const ponude = filt(baza.ponude);
    const otpremnice = filt(baza.otpremnice);
    const blagajna = filt(baza.blagajna);
    const nalozi = filt(baza.radni_nalozi).filter((n) => String(n.status || '').toUpperCase() !== 'OBRISANO');
    const reklamacije = filt(baza.reklamacije);
    const zastoji = filt(baza.dnevnik_masine);
    const radnici = Array.isArray(baza.radnici) ? baza.radnici : [];
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

    // Dnevna serija zadnjih 7 dana
    const dani7 = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(danasObj.getFullYear(), danasObj.getMonth(), danasObj.getDate() - i);
        const iso = toLocalIso(d);
        const label = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
        const prM3 = prorezLog.filter((x) => datumIso(x.datum) === iso).reduce((s, r) => s + (parseFloat(r.zapremina || 0) || 0), 0);
        const izM3 = paketi.filter((x) => datumIso(x.datum_yyyy_mm || x.created_at) === iso).reduce((s, p) => s + (parseFloat(p.kolicina_final || 0) || 0), 0);
        const ulKM = blagajna.filter((b) => datumIso(b.datum) === iso && String(b.tip || '').toUpperCase().includes('ULAZ')).reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);
        const izKM = blagajna.filter((b) => datumIso(b.datum) === iso && !String(b.tip || '').toUpperCase().includes('ULAZ')).reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);
        const racKM = racuni.filter((r) => datumIso(r.datum) === iso).reduce((s, r) => s + kmVal(r), 0);
        dani7.push({
            iso,
            dan: label,
            prorezM3: parseFloat(prM3.toFixed(3)),
            izlazM3: parseFloat(izM3.toFixed(3)),
            ulazKM: parseFloat(ulKM.toFixed(2)),
            izlazKM: parseFloat(izKM.toFixed(2)),
            fakturisanoKM: parseFloat(racKM.toFixed(2)),
        });
    }

    // Mjesečni sažetak funkcija
    const izracunajMjesec = (prefix) => {
        const pr = prorezLog.filter((x) => datumIso(x.datum).startsWith(prefix));
        const pk = paketi.filter((x) => datumIso(x.datum_yyyy_mm || x.created_at).startsWith(prefix));
        const rc = racuni.filter((x) => datumIso(x.datum).startsWith(prefix));
        const bl = blagajna.filter((x) => datumIso(x.datum).startsWith(prefix));
        const rk = reklamacije.filter((x) => datumIso(x.datum || x.created_at).startsWith(prefix));
        const zs = zastoji.filter((x) => datumIso(x.datum).startsWith(prefix));

        const prorezM3 = pr.reduce((s, r) => s + (parseFloat(r.zapremina || 0) || 0), 0);
        const izlazM3 = pk.reduce((s, p) => s + (parseFloat(p.kolicina_final || 0) || 0), 0);
        const yieldProc = prorezM3 > 0 ? Math.min(100, (izlazM3 / prorezM3) * 100) : 0;
        const fakturisanoKM = rc.reduce((s, r) => s + kmVal(r), 0);
        const kesUlazKM = bl.filter((b) => String(b.tip || '').toUpperCase().includes('ULAZ')).reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);
        const kesIzlazKM = bl.filter((b) => !String(b.tip || '').toUpperCase().includes('ULAZ')).reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);
        const zastojMin = zs.reduce((s, z) => s + (parseFloat(z.trajanje_min || z.trajanje_minuta || 0) || 0), 0);

        return {
            prefix,
            prorezM3: parseFloat(prorezM3.toFixed(3)),
            prorezKom: pr.length,
            izlazM3: parseFloat(izlazM3.toFixed(3)),
            paketiBroj: pk.length,
            yieldProc: parseFloat(yieldProc.toFixed(1)),
            fakturisanoKM: parseFloat(fakturisanoKM.toFixed(2)),
            racuniBroj: rc.length,
            kesUlazKM: parseFloat(kesUlazKM.toFixed(2)),
            kesIzlazKM: parseFloat(kesIzlazKM.toFixed(2)),
            kesNetoKM: parseFloat((kesUlazKM - kesIzlazKM).toFixed(2)),
            reklamacijeBroj: rk.length,
            zastojMin,
        };
    };

    const ovajMjesec = izracunajMjesec(ovajMjPrefix);
    const prosliMjesec = izracunajMjesec(prosliMjPrefix);

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

    // Paketi & Lager & Mašine
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
    paketi.forEach((p) => {
        const m = (p.masina || 'Ostalo').trim();
        if (!poMasiniMapa[m]) poMasiniMapa[m] = { masina: m, izlazM3: 0, paketa: 0, zastojMin: 0 };
        poMasiniMapa[m].izlazM3 += parseFloat(p.kolicina_final || 0) || 0;
        poMasiniMapa[m].paketa += 1;
    });
    zastoji.forEach((z) => {
        const m = (z.masina || 'Ostalo').trim();
        if (!poMasiniMapa[m]) poMasiniMapa[m] = { masina: m, izlazM3: 0, paketa: 0, zastojMin: 0 };
        poMasiniMapa[m].zastojMin += parseFloat(z.trajanje_min || z.trajanje_minuta || 0) || 0;
    });
    const poMasinama = Object.values(poMasiniMapa)
        .map((x) => ({ ...x, izlazM3: parseFloat(x.izlazM3.toFixed(3)), zastojMin: Math.round(x.zastojMin) }))
        .sort((a, b) => b.izlazM3 - a.izlazM3);

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

    // Profit po radnim nalozima (Job Costing)
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
        const pon = ponude.find((po) => po.id === n.ponuda_id || String(po.broj_ponude || '') === String(n.ponuda_id || ''));
        const racN = racuni.filter((r) => String(r.radni_nalog_id || '') === rnId || (n.kupac_naziv && String(r.napomena || '').includes(rnId)));
        let prihodKM = racN.reduce((s, r) => s + kmVal(r), 0);
        if (prihodKM <= 0 && pon) prihodKM = kmVal(pon);
        if (prihodKM <= 0 && proizM3 > 0) prihodKM = proizM3 * prosjecnaCijenaArtiklaM3;

        const yieldFaktor = globalYieldProc > 20 ? (globalYieldProc / 100) : 0.62;
        const procSirovinaM3 = proizM3 / yieldFaktor;
        const trosakSirovineKM = procSirovinaM3 * prosjecnaCijenaTrupcaM3;
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
            proizvedenoM3: parseFloat(proizM3.toFixed(3)),
            prihodKM: parseFloat(prihodKM.toFixed(2)),
            trosakKM: parseFloat(ukupTrosak.toFixed(2)),
            profitKM: parseFloat(profitKM.toFixed(2)),
            marzaProc: parseFloat(marza.toFixed(1)),
        };
    }).filter((x) => x.prihodKM > 0 || x.proizvedenoM3 > 0)
      .sort((a, b) => b.profitKM - a.profitKM);

    // Biomasa & EKO & FSC
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

    return {
        danasIso,
        juceIso,
        ovajMjPrefix,
        prosliMjPrefix,
        ovaGodPrefix,
        bezQaTesta,
        dani7,
        ovajMjesec,
        prosliMjesec,
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
        },
        masine: poMasinama,
        finansije: {
            ukupnoFakturisanoKM: parseFloat(ukupnoFakturisanoKM.toFixed(2)),
            racuniUkupno: racuni.length,
            otvoreniRacuniBroj: otvoreniRacuni.length,
            otvoreniDugKM: parseFloat(ukupnoOtvoreniDugKM.toFixed(2)),
            dospjeliDugKM: parseFloat((aging.d1_30 + aging.d31_60 + aging.d61_90 + aging.d90plus).toFixed(2)),
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
        },
        profitPoNalogu,
        reklamacije: {
            ukupno: reklamacije.length,
            odobrene: reklamacije.filter((r) => String(r.status || '').toUpperCase() === 'ODOBRENO').length,
            naCekanju: reklamacije.filter((r) => String(r.status || '').toUpperCase().includes('ČEKANJ') || String(r.status || '').toUpperCase().includes('CEKANJ')).length,
            ukupnoM3: parseFloat(reklamacije.reduce((s, r) => s + (parseFloat(r.kolicina || 0) || 0), 0).toFixed(3)),
            lista: reklamacije.slice(0, 25),
        },
        susare: susareLista,
        servisi: servisiLista,
        biomasaMjesec,
        cbamCfg,
        hr: { brojRadnika: radnici.length, brojKupaca: kupci.length, brojArtikala: katalog.length, aktivniNalozi: nalozi.filter((n) => n.status !== 'ZAVRŠENO').length },
    };
}

export function napraviKompaktanKontekstZaLLM(snimak, pitanje = '') {
    const qNorm = normTxt(pitanje);
    // Pronađi eventualne specifične pakete ili kupce spomenute u upitu
    const rijeci = String(pitanje || '').toUpperCase().split(/[\s,?.!:;"'()]+/).filter((w) => w.length >= 3);
    const nadjeniPaketi = (snimak.paketi.sviPaketi || [])
        .filter((p) => rijeci.includes(String(p.paket_id || '').toUpperCase()))
        .slice(0, 5)
        .map((p) => ({
            paket_id: p.paket_id,
            proizvod: p.naziv_proizvoda,
            dimenzije: `${p.debljina}x${p.sirina}x${p.duzina}`,
            m3: parseFloat(p.kolicina_final || 0),
            masina: p.masina,
            status: p.otpremnica_id ? `OTPREMLJENO (${p.otpremnica_id})` : (p.closed_at ? 'NA LAGERU' : 'U RADU'),
            rn: p.broj_veze || null,
        }));

    const nadjeniKupci = (snimak.finansije.kupciStat || [])
        .filter((k) => qNorm.includes(normTxt(k.kupac).slice(0, 8)) && normTxt(k.kupac).length >= 3)
        .slice(0, 5);

    return {
        datum_danas: snimak.danasIso,
        filter_bez_qa: snimak.bezQaTesta,
        poredjenje_mjeseci: {
            ovaj_mjesec: snimak.ovajMjesec,
            prosli_mjesec: snimak.prosliMjesec,
        },
        zadnjih_7_dana: snimak.dani7,
        trupci_sirovina: {
            ...snimak.trupci,
            poVrsti: snimak.trupci.poVrsti.slice(0, 8),
            poDobavljacu: snimak.trupci.poDobavljacu.slice(0, 8),
        },
        paketi_i_lager: {
            ukupnoBroj: snimak.paketi.ukupnoBroj,
            ukupnoM3: snimak.paketi.ukupnoM3,
            naLageruBroj: snimak.paketi.naLageruBroj,
            naLageruM3: snimak.paketi.naLageruM3,
            uRaduBroj: snimak.paketi.uRaduBroj,
            otpremljeniBroj: snimak.paketi.otpremljeniBroj,
            globalYieldProc: snimak.paketi.globalYieldProc,
            topLagerProizvodi: snimak.paketi.lagerPoProizvodu.slice(0, 10),
        },
        masine_ucinak_zastoji: snimak.masine.slice(0, 10),
        finansije: {
            ukupnoFakturisanoKM: snimak.finansije.ukupnoFakturisanoKM,
            otvoreniDugKM: snimak.finansije.otvoreniDugKM,
            dospjeliDugKM: snimak.finansije.dospjeliDugKM,
            aging: snimak.finansije.aging,
            stanjeKaseKM: snimak.finansije.stanjeKaseKM,
            kasaUlazKM: snimak.finansije.kasaUlazKM,
            kasaIzlazKM: snimak.finansije.kasaIzlazKM,
            topTroskovi: snimak.finansije.troskoviPoKategoriji.slice(0, 8),
            topKupci: snimak.finansije.kupciStat.slice(0, 10),
            topDuznici: snimak.finansije.topDuznici.slice(0, 10),
            topOtvoreniRacuni: snimak.finansije.otvoreniRacuni.slice(0, 12),
        },
        profit_po_nalozima_top10: snimak.profitPoNalogu.slice(0, 10),
        reklamacije: {
            ukupno: snimak.reklamacije.ukupno,
            odobrene: snimak.reklamacije.odobrene,
            naCekanju: snimak.reklamacije.naCekanju,
            ukupnoM3: snimak.reklamacije.ukupnoM3,
        },
        susare_aktivne: snimak.susare.slice(0, 8),
        servis_pila: snimak.servisi.slice(0, 8),
        biomasa_i_fsc: snimak.biomasaMjesec,
        opste: snimak.hr,
        trazeni_detalji: { paketi: nadjeniPaketi, kupci: nadjeniKupci },
    };
}

/**
 * Bogati ugrađeni bosanski konverzacijski analitički motor (radi 100% i bez vanjskog API ključa).
 */
export function odgovoriLokalniAiKontrolor(snimak, pitanje = '') {
    const q = normTxt(pitanje);
    const rijeciUp = String(pitanje || '').toUpperCase().split(/[\s,?.!:;"'()]+/).filter(Boolean);

    // 1. Pozdrav / Pomoć
    if (/^(cao|zdravo|pozdrav|ej|hey|hello|hi|dobar dan|dobro jutro|pomoc|sta mozes|kako radis)[!?. ]*$/.test(q)) {
        return {
            naslov: 'AI Direktorski Asistent',
            odgovor: `Zdravo šefe! Tu sam i spreman da analiziram **svaki dio Pilane-ERP u realnom vremenu**.\n\n### Šta možeš tražiti od mene:\n- **Poređenja perioda:** *"Uporedi ovaj i prošli mjesec po proizvodnji i finansijama"*\n- **Finansije i dugovi:** *"Koji kupci najviše duguju i kakva je Aging 30/60/90 struktura?"*\n- **Profitabilnost:** *"Koji radni nalozi imaju najveću neto maržu i profit?"*\n- **Pogon i mašine:** *"Analiziraj učinak mašina, Yield i zastoje"*\n- **Lager i sirovina:** *"Stanje lagera gotove robe i trupaca po vrstama"*\n- **EKO, Biomasa & Sušare:** *"Izvještaj biomase, peći, FSC udjela i sušara"*\n\nZa svaki izvještaj automatski pravim **interaktivni dijagram**, **tabelu** i dugmad za **PDF print / Excel izvoz**. Šta prvo da pogledamo?`,
            kpi: [
                { label: 'Stanje Kase', value: `${snimak.finansije.stanjeKaseKM.toFixed(2)} KM`, sub: 'Trenutna gotovina', color: 'emerald' },
                { label: 'Otvoreni Dug', value: `${snimak.finansije.otvoreniDugKM.toFixed(2)} KM`, sub: `Dospjelo: ${snimak.finansije.dospjeliDugKM.toFixed(2)} KM`, color: snimak.finansije.dospjeliDugKM > 0 ? 'red' : 'emerald' },
                { label: 'Lager Robe', value: `${snimak.paketi.naLageruM3.toFixed(2)} m³`, sub: `${snimak.paketi.naLageruBroj} paketa`, color: 'blue' },
                { label: 'Global Yield', value: `${snimak.paketi.globalYieldProc.toFixed(1)}%`, sub: `Trupci plac: ${snimak.trupci.naLageruM3.toFixed(1)} m³`, color: 'amber' },
            ],
            chart: null,
            tabela: null,
            predlozi: [
                'Uporedi ovaj i prošli mjesec',
                'Koji kupci najviše duguju (Aging)?',
                'Top 10 najprofitabilnijih radnih naloga',
                'Analiza učinka i zastoja po mašinama',
            ],
        };
    }

    // 2. Specifična pretraga paketa (PK-...)
    const trazeniPaketi = (snimak.paketi.sviPaketi || []).filter((p) => rijeciUp.includes(String(p.paket_id || '').toUpperCase()));
    if (trazeniPaketi.length > 0) {
        const prvi = trazeniPaketi[0];
        const ukM3 = trazeniPaketi.reduce((s, p) => s + (parseFloat(p.kolicina_final || 0) || 0), 0);
        const ukKom = trazeniPaketi.reduce((s, p) => s + (parseFloat(p.kolicina_ulaz || 0) || 0), 0);
        const status = prvi.otpremnica_id ? `OTPREMLJENO (${prvi.otpremnica_id})` : (prvi.closed_at ? 'NA LAGERU (Zaključan)' : 'U PROIZVODNJI');
        return {
            naslov: `Detaljni Izvještaj — Paket ${prvi.paket_id}`,
            odgovor: `Pronašao sam **Paket ${prvi.paket_id}** u bazi podataka.\n\n- **Trenutni status:** **${status}**\n- **Ukupna zapremina:** **${ukM3.toFixed(3)} m³** (${ukKom} ${prvi.jm || 'kom'})\n- **Vezni nalog:** **${prvi.broj_veze || 'Slobodna roba'}** | **Mašina:** **${prvi.masina || '-'}**`,
            kpi: [
                { label: 'Paket ID', value: String(prvi.paket_id), sub: status, color: 'blue' },
                { label: 'Ukupno m³', value: `${ukM3.toFixed(3)} m³`, sub: `${trazeniPaketi.length} stavki u paketu`, color: 'emerald' },
                { label: 'Komada', value: `${ukKom} ${prvi.jm || 'kom'}`, sub: `Mašina: ${prvi.masina || '-'}`, color: 'amber' },
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
                    { key: 'masina', label: 'Mašina', type: 'string', align: 'left' },
                ],
                redovi: trazeniPaketi.map((x) => ({
                    proizvod: x.naziv_proizvoda || '-',
                    dim: `${x.debljina || 0}×${x.sirina || 0}×${x.duzina || 0}`,
                    kom: parseFloat(x.kolicina_ulaz || 0) || 0,
                    m3: parseFloat((parseFloat(x.kolicina_final || 0) || 0).toFixed(3)),
                    masina: x.masina || '-',
                })),
            },
            predlozi: ['Stanje lagera gotove robe', 'Uporedi ovaj i prošli mjesec', 'Profit po radnim nalozima'],
        };
    }

    // 3. Poređenje Ovaj vs Prošli Mjesec
    if (/(upored|pored|razlik|ovaj.*prosli|prosli.*ovaj|mjesec.*mjesec|trend.*mjesec|rast|pad)/.test(q)) {
        const o = snimak.ovajMjesec;
        const p = snimak.prosliMjesec;
        const redovi = [
            { metrika: 'Prorez trupaca (m³)', ovaj: o.prorezM3, prosli: p.prorezM3, promjena: pctDelta(o.prorezM3, p.prorezM3) },
            { metrika: 'Izlaz gotove robe (m³)', ovaj: o.izlazM3, prosli: p.izlazM3, promjena: pctDelta(o.izlazM3, p.izlazM3) },
            { metrika: 'Iskorištenje / Yield (%)', ovaj: o.yieldProc, prosli: p.yieldProc, promjena: `${(o.yieldProc - p.yieldProc >= 0 ? '+' : '')}${(o.yieldProc - p.yieldProc).toFixed(1)} p.p.` },
            { metrika: 'Fakturisani prihod (KM)', ovaj: o.fakturisanoKM, prosli: p.fakturisanoKM, promjena: pctDelta(o.fakturisanoKM, p.fakturisanoKM) },
            { metrika: 'Keš priliv blagajna (KM)', ovaj: o.kesUlazKM, prosli: p.kesUlazKM, promjena: pctDelta(o.kesUlazKM, p.kesUlazKM) },
            { metrika: 'Keš odliv / troškovi (KM)', ovaj: o.kesIzlazKM, prosli: p.kesIzlazKM, promjena: pctDelta(o.kesIzlazKM, p.kesIzlazKM) },
            { metrika: 'Neto keš tok (KM)', ovaj: o.kesNetoKM, prosli: p.kesNetoKM, promjena: pctDelta(o.kesNetoKM, p.kesNetoKM) },
            { metrika: 'Zastoji mašina (min)', ovaj: o.zastojMin, prosli: p.zastojMin, promjena: pctDelta(o.zastojMin, p.zastojMin) },
        ];

        return {
            naslov: `Poređenje Mjeseci: ${o.prefix} vs ${p.prefix}`,
            odgovor: `Evo uporedne direktorske analize za **tekući mjesec (${o.prefix})** u odnosu na **prošli mjesec (${p.prefix})**:\n\n### Proizvodnja & Pogon\n- Prorezano je **${o.prorezM3.toFixed(2)} m³** trupaca u odnosu na **${p.prorezM3.toFixed(2)} m³** prošlog mjeseca (**${pctDelta(o.prorezM3, p.prorezM3)}**).\n- Proizvedeno gotove robe: **${o.izlazM3.toFixed(2)} m³** vs **${p.izlazM3.toFixed(2)} m³** (**${pctDelta(o.izlazM3, p.izlazM3)}**), uz prosječni Yield od **${o.yieldProc.toFixed(1)}%**.\n\n### Finansije & Likvidnost\n- Fakturisano: **${o.fakturisanoKM.toFixed(2)} KM** vs **${p.fakturisanoKM.toFixed(2)} KM** (**${pctDelta(o.fakturisanoKM, p.fakturisanoKM)}**).\n- Neto keš tok u blagajni: **${o.kesNetoKM.toFixed(2)} KM** (priliv **+${o.kesUlazKM.toFixed(2)} KM**, odliv **-${o.kesIzlazKM.toFixed(2)} KM**).`,
            kpi: [
                { label: 'Prorez Ovaj Mj.', value: `${o.prorezM3.toFixed(2)} m³`, sub: `vs ${p.prorezM3.toFixed(2)} m³ (${pctDelta(o.prorezM3, p.prorezM3)})`, color: 'amber' },
                { label: 'Izlaz Ovaj Mj.', value: `${o.izlazM3.toFixed(2)} m³`, sub: `Yield: ${o.yieldProc.toFixed(1)}% (prošli ${p.yieldProc.toFixed(1)}%)`, color: 'emerald' },
                { label: 'Fakturisano', value: `${o.fakturisanoKM.toFixed(0)} KM`, sub: `vs ${p.fakturisanoKM.toFixed(0)} KM (${pctDelta(o.fakturisanoKM, p.fakturisanoKM)})`, color: 'blue' },
                { label: 'Neto Keš Tok', value: `${o.kesNetoKM.toFixed(0)} KM`, sub: `Prošli mj: ${p.kesNetoKM.toFixed(0)} KM`, color: o.kesNetoKM >= 0 ? 'emerald' : 'red' },
            ],
            chart: {
                title: `📊 Uporedni Dijagram Finansija (${o.prefix} vs ${p.prefix})`,
                subtitle: 'Fakturisano, Keš Priliv i Keš Odliv (KM)',
                type: 'bar',
                xKey: 'kategorija',
                unit: 'KM',
                series: [
                    { key: 'ovaj', name: `Ovaj mj. (${o.prefix})`, color: '#3b82f6', unit: 'KM' },
                    { key: 'prosli', name: `Prošli mj. (${p.prefix})`, color: '#94a3b8', unit: 'KM' },
                ],
                data: [
                    { kategorija: 'Fakturisano', ovaj: o.fakturisanoKM, prosli: p.fakturisanoKM },
                    { kategorija: 'Keš Priliv', ovaj: o.kesUlazKM, prosli: p.kesUlazKM },
                    { kategorija: 'Keš Odliv', ovaj: o.kesIzlazKM, prosli: p.kesIzlazKM },
                    { kategorija: 'Neto Keš', ovaj: o.kesNetoKM, prosli: p.kesNetoKM },
                ],
            },
            tabela: {
                naslov: `Kompletna Uporedna Tabela (${o.prefix} vs ${p.prefix})`,
                kolone: [
                    { key: 'metrika', label: 'Metrika', type: 'string', align: 'left' },
                    { key: 'ovaj', label: `Ovaj mj. (${o.prefix})`, type: 'number', align: 'right' },
                    { key: 'prosli', label: `Prošli mj. (${p.prefix})`, type: 'number', align: 'right' },
                    { key: 'promjena', label: 'Promjena', type: 'string', align: 'right' },
                ],
                redovi,
            },
            predlozi: [
                'Koji kupci najviše duguju i kakav je Aging?',
                'Top 10 najprofitabilnijih radnih naloga',
                'Analiza učinka i zastoja po mašinama',
            ],
        };
    }

    // 4. Profitabilnost & Marže po Nalozima
    if (/(profit|marz|zarad|isplativ|nalog|job cost|rn-)/.test(q)) {
        const top = snimak.profitPoNalogu.slice(0, 15);
        const ukPrihod = top.reduce((s, r) => s + r.prihodKM, 0);
        const ukTrosak = top.reduce((s, r) => s + r.trosakKM, 0);
        const ukProfit = top.reduce((s, r) => s + r.profitKM, 0);
        const avgMarza = ukPrihod > 0 ? (ukProfit / ukPrihod) * 100 : 0;
        const najbolji = top[0];

        return {
            naslov: 'Analiza Profitabilnosti i Marži po Radnim Nalozima',
            odgovor: `Analizirao sam **${snimak.profitPoNalogu.length} radnih naloga** na osnovu prihoda (računi/ponude), procijenjenog troška sirovine (trupci), rada i reklamacija.\n\n### Ključni nalazi:\n- Ukupan neto profit za top ${top.length} naloga iznosi **${ukProfit.toFixed(2)} KM** uz prosječnu maržu od **${avgMarza.toFixed(1)}%**.\n${najbolji ? `- Najprofitabilniji nalog je **${najbolji.rn_id}** (${najbolji.kupac}) sa neto zaradom od **${najbolji.profitKM.toFixed(2)} KM** (**${najbolji.marzaProc.toFixed(1)}%** marže).` : '- Trenutno nema završenih naloga sa obračunatim prihodom.'}`,
            kpi: [
                { label: 'Ukupni Prihod (Top)', value: `${ukPrihod.toFixed(0)} KM`, sub: `${top.length} najjačih naloga`, color: 'blue' },
                { label: 'Ukupni Troškovi', value: `-${ukTrosak.toFixed(0)} KM`, sub: 'Sirovina + Rad + Reklamacije', color: 'amber' },
                { label: 'Neto Profit', value: `${ukProfit.toFixed(0)} KM`, sub: 'Čista zarada', color: ukProfit >= 0 ? 'emerald' : 'red' },
                { label: 'Prosječna Marža', value: `${avgMarza.toFixed(1)}%`, sub: 'Cilj > 20%', color: avgMarza >= 20 ? 'emerald' : 'amber' },
            ],
            chart: {
                title: '💎 Top Radni Nalozi: Prihod vs Trošak vs Profit (KM)',
                subtitle: 'Poređenje finansijskog rezultata po radnom nalogu',
                type: 'bar',
                xKey: 'rn',
                unit: 'KM',
                series: [
                    { key: 'prihod', name: 'Prihod', color: '#3b82f6', unit: 'KM' },
                    { key: 'trosak', name: 'Trošak', color: '#f59e0b', unit: 'KM' },
                    { key: 'profit', name: 'Neto Profit', color: '#10b981', unit: 'KM' },
                ],
                data: top.slice(0, 8).map((r) => ({ rn: r.rn_id, prihod: r.prihodKM, trosak: r.trosakKM, profit: r.profitKM })),
            },
            tabela: {
                naslov: 'Detaljna Profitabilnost Radnih Naloga',
                kolone: [
                    { key: 'rn_id', label: 'Nalog', type: 'string', align: 'left' },
                    { key: 'kupac', label: 'Kupac', type: 'string', align: 'left' },
                    { key: 'proizvedenoM3', label: 'Izlaz (m³)', type: 'number', align: 'right', suffix: ' m³' },
                    { key: 'prihodKM', label: 'Prihod (KM)', type: 'number', align: 'right', suffix: ' KM' },
                    { key: 'trosakKM', label: 'Trošak (KM)', type: 'number', align: 'right', suffix: ' KM' },
                    { key: 'profitKM', label: 'Profit (KM)', type: 'number', align: 'right', suffix: ' KM' },
                    { key: 'marzaProc', label: 'Marža %', type: 'number', align: 'right', suffix: '%' },
                ],
                redovi: top,
            },
            predlozi: [
                'Koji kupci donose najveći promet?',
                'Koji kupci najviše duguju (Aging)?',
                'Uporedi ovaj i prošli mjesec',
            ],
        };
    }

    // 5. Dužnici, Aging, Dospjeli Računi
    if (/(dug|duzn|aging|dospjel|kasn|naplat|neplacen|otvoren.*racun|racun)/.test(q)) {
        const f = snimak.finansije;
        const a = f.aging;
        return {
            naslov: 'Analiza Potraživanja, Dužnika i Aging Strukture',
            odgovor: `Pregledao sam sve račune i uplatu po uplatu iz blagajne (sa konverzijom EUR u KM).\n\n### Stanje potraživanja:\n- **Ukupni otvoreni dug:** **${f.otvoreniDugKM.toFixed(2)} KM** na **${f.otvoreniRacuniBroj} otvorenih računa**.\n- **Dospjelo preko roka valute:** **${f.dospjeliDugKM.toFixed(2)} KM**.\n- **Kritični dug preko 60 dana:** **${(a.d61_90 + a.d90plus).toFixed(2)} KM** (od toga 90+ dana: **${a.d90plus.toFixed(2)} KM**).\n${f.topDuznici[0] ? `- Najveći pojedinačni dužnik je **${f.topDuznici[0].kupac}** sa otvorenim saldom od **${f.topDuznici[0].otvoreniDugKM.toFixed(2)} KM**.` : '- Trenutno nema otvorenih dugovanja!'}`,
            kpi: [
                { label: 'Otvoreni Dug', value: `${f.otvoreniDugKM.toFixed(2)} KM`, sub: `${f.otvoreniRacuniBroj} otvorenih računa`, color: f.otvoreniDugKM > 0 ? 'amber' : 'emerald' },
                { label: 'Dospjelo (Kasni)', value: `${f.dospjeliDugKM.toFixed(2)} KM`, sub: 'Preko roka valute', color: f.dospjeliDugKM > 0 ? 'red' : 'emerald' },
                { label: 'U Roku (0 d)', value: `${a.uRoku.toFixed(2)} KM`, sub: 'Još nije dospjelo', color: 'blue' },
                { label: 'Kritično 60+ dana', value: `${(a.d61_90 + a.d90plus).toFixed(2)} KM`, sub: `90+ d: ${a.d90plus.toFixed(2)} KM`, color: (a.d61_90 + a.d90plus) > 0 ? 'red' : 'emerald' },
            ],
            chart: {
                title: '⏳ Aging Struktura Otvorenih Potraživanja (KM)',
                subtitle: 'Raspodjela duga po starosti kašnjenja',
                type: 'bar',
                xKey: 'period',
                unit: 'KM',
                series: [{ key: 'iznos', name: 'Dug', color: '#ef4444', unit: 'KM' }],
                data: [
                    { period: 'U roku', iznos: a.uRoku },
                    { period: '1–30 dana', iznos: a.d1_30 },
                    { period: '31–60 dana', iznos: a.d31_60 },
                    { period: '61–90 dana', iznos: a.d61_90 },
                    { period: '90+ dana', iznos: a.d90plus },
                ],
            },
            tabela: {
                naslov: `Otvoreni i Dospjeli Računi (Top ${Math.min(25, f.otvoreniRacuni.length)})`,
                kolone: [
                    { key: 'id', label: 'Račun', type: 'string', align: 'left' },
                    { key: 'kupac', label: 'Kupac', type: 'string', align: 'left' },
                    { key: 'rok', label: 'Rok valute', type: 'string', align: 'left' },
                    { key: 'kasniDana', label: 'Kasni (d)', type: 'number', align: 'right', suffix: ' d' },
                    { key: 'uplacenoKM', label: 'Uplaćeno', type: 'number', align: 'right', suffix: ' KM' },
                    { key: 'dugKM', label: 'Preostali Dug', type: 'number', align: 'right', suffix: ' KM' },
                ],
                redovi: f.otvoreniRacuni.slice(0, 25),
            },
            predlozi: [
                'Koji kupci ostvaruju najveći promet?',
                'Analiza blagajne i troškova',
                'Uporedi ovaj i prošli mjesec',
            ],
        };
    }

    // 6. Kupci & Prodaja
    if (/(kupac|kupci|prodaj|promet|klijent|ponud)/.test(q)) {
        const topK = snimak.finansije.kupciStat.slice(0, 15);
        return {
            naslov: 'Analiza Kupaca i Strukture Prodaje',
            odgovor: `Ukupno je fakturisano **${snimak.finansije.ukupnoFakturisanoKM.toFixed(2)} KM** kroz **${snimak.finansije.racuniUkupno} računa** prema **${snimak.finansije.kupciStat.length} aktivnih kupaca**.\n\n${topK[0] ? `- Najveći kupac po prometu je **${topK[0].kupac}** sa **${topK[0].fakturisanoKM.toFixed(2)} KM** (${topK[0].racuna} računa, otvoreni saldo **${topK[0].otvoreniDugKM.toFixed(2)} KM**).` : ''}`,
            kpi: [
                { label: 'Ukupno Fakturisano', value: `${snimak.finansije.ukupnoFakturisanoKM.toFixed(0)} KM`, sub: `${snimak.finansije.racuniUkupno} računa`, color: 'blue' },
                { label: 'Aktivnih Kupaca', value: `${snimak.finansije.kupciStat.length}`, sub: `U bazi ukupno ${snimak.hr.brojKupaca}`, color: 'emerald' },
                { label: 'Top Kupac', value: topK[0]?.kupac?.slice(0, 16) || '-', sub: topK[0] ? `${topK[0].fakturisanoKM.toFixed(0)} KM` : '', color: 'purple' },
                { label: 'Otvoreni Saldo', value: `${snimak.finansije.otvoreniDugKM.toFixed(0)} KM`, sub: `Dospjelo: ${snimak.finansije.dospjeliDugKM.toFixed(0)} KM`, color: 'amber' },
            ],
            chart: {
                title: '🏆 Top Kupci po Ukupnom Prometu (KM)',
                subtitle: 'Fakturisano vs Otvoreni dug',
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
                naslov: 'Rang Lista Kupaca po Prometu i Saldu',
                kolone: [
                    { key: 'kupac', label: 'Kupac', type: 'string', align: 'left' },
                    { key: 'racuna', label: 'Računa', type: 'number', align: 'right' },
                    { key: 'fakturisanoKM', label: 'Fakturisano', type: 'number', align: 'right', suffix: ' KM' },
                    { key: 'otvoreniDugKM', label: 'Otvoreni Dug', type: 'number', align: 'right', suffix: ' KM' },
                    { key: 'dospjeliDugKM', label: 'Dospjelo', type: 'number', align: 'right', suffix: ' KM' },
                ],
                redovi: topK,
            },
            predlozi: ['Koji kupci najviše duguju (Aging)?', 'Top 10 najprofitabilnijih naloga', 'Uporedi ovaj i prošli mjesec'],
        };
    }

    // 7. Mašine, Prorez, Yield & Zastoji
    if (/(masin|prorez|pilan|yield|iskorist|prinos|zastoj|kvar|brent|ucinak|proizvodnj)/.test(q)) {
        const ukZastoj = snimak.masine.reduce((s, m) => s + m.zastojMin, 0);
        return {
            naslov: 'Analiza Proreza, Yield-a i Učinka Mašina',
            odgovor: `### Pregled proizvodnje i efikasnosti:\n- **Globalni Yield Pilane:** **${snimak.paketi.globalYieldProc.toFixed(1)}%** (izlaz Pilane **${snimak.paketi.izlazPilanaM3.toFixed(2)} m³** iz **${snimak.trupci.prorezanoM3.toFixed(2)} m³** prorezanih trupaca).\n- **Ovaj mjesec:** Prorez **${snimak.ovajMjesec.prorezM3.toFixed(2)} m³** → Izlaz **${snimak.ovajMjesec.izlazM3.toFixed(2)} m³** (Yield **${snimak.ovajMjesec.yieldProc.toFixed(1)}%**).\n- **Ukupno evidentirani zastoji:** **${ukZastoj} minuta** po svim mašinama.\n${snimak.masine[0] ? `- Najproduktivnija mašina je **${snimak.masine[0].masina}** sa **${snimak.masine[0].izlazM3.toFixed(2)} m³** (${snimak.masine[0].paketa} paketa).` : ''}`,
            kpi: [
                { label: 'Global Yield', value: `${snimak.paketi.globalYieldProc.toFixed(1)}%`, sub: `Ovaj mj: ${snimak.ovajMjesec.yieldProc.toFixed(1)}%`, color: 'emerald' },
                { label: 'Prorez Ovaj Mj.', value: `${snimak.ovajMjesec.prorezM3.toFixed(2)} m³`, sub: `${snimak.ovajMjesec.prorezKom} trupaca`, color: 'amber' },
                { label: 'Izlaz Ovaj Mj.', value: `${snimak.ovajMjesec.izlazM3.toFixed(2)} m³`, sub: `${snimak.ovajMjesec.paketiBroj} paketa`, color: 'blue' },
                { label: 'Ukupno Zastoja', value: `${ukZastoj} min`, sub: `Ovaj mj: ${snimak.ovajMjesec.zastojMin} min`, color: ukZastoj > 180 ? 'red' : 'purple' },
            ],
            chart: {
                title: '⚙️ Učinak Mašina (m³) vs Zastoji',
                subtitle: 'Ukupna proizvodnja po pogonu/mašini',
                type: 'bar',
                xKey: 'masina',
                unit: 'm³',
                series: [
                    { key: 'izlazM3', name: 'Izlaz (m³)', color: '#10b981', unit: 'm³' },
                ],
                data: snimak.masine.slice(0, 10),
            },
            tabela: {
                naslov: 'Detaljna Statistika po Mašinama',
                kolone: [
                    { key: 'masina', label: 'Mašina / Pogon', type: 'string', align: 'left' },
                    { key: 'paketa', label: 'Paketa / Stavki', type: 'number', align: 'right' },
                    { key: 'izlazM3', label: 'Proizvedeno (m³)', type: 'number', align: 'right', suffix: ' m³' },
                    { key: 'zastojMin', label: 'Zastoji (min)', type: 'number', align: 'right', suffix: ' min' },
                ],
                redovi: snimak.masine,
            },
            predlozi: [
                'Stanje lagera gotove robe',
                'Izvještaj sušara i servisa pila',
                'Uporedi ovaj i prošli mjesec',
            ],
        };
    }

    // 8. Blagajna, Keš Tok & Troškovi
    if (/(blagajn|kas|kes|gotovin|trosk|rashod|isplat|uplat)/.test(q)) {
        const f = snimak.finansije;
        return {
            naslov: 'Analiza Blagajne, Keš Toka i Troškova',
            odgovor: `### Finansijski presjek gotovinske blagajne:\n- **Trenutno stanje u kasi:** **${f.stanjeKaseKM.toFixed(2)} KM**\n- **Ukupni prilivi (ULAZ):** **+${f.kasaUlazKM.toFixed(2)} KM** | **Ukupni odlivi (IZLAZ):** **-${f.kasaIzlazKM.toFixed(2)} KM**\n- **Ovaj mjesec neto:** **${snimak.ovajMjesec.kesNetoKM.toFixed(2)} KM** (+${snimak.ovajMjesec.kesUlazKM.toFixed(2)} / -${snimak.ovajMjesec.kesIzlazKM.toFixed(2)} KM)\n${f.troskoviPoKategoriji[0] ? `- Najveća stavka troška je **${f.troskoviPoKategoriji[0].kategorija}** (**${f.troskoviPoKategoriji[0].iznos.toFixed(2)} KM**).` : ''}`,
            kpi: [
                { label: 'Stanje Kase', value: `${f.stanjeKaseKM.toFixed(2)} KM`, sub: 'Ukupni neto saldo', color: f.stanjeKaseKM >= 0 ? 'emerald' : 'red' },
                { label: 'Ukupni Prilivi', value: `+${f.kasaUlazKM.toFixed(0)} KM`, sub: `Ovaj mj: +${snimak.ovajMjesec.kesUlazKM.toFixed(0)} KM`, color: 'blue' },
                { label: 'Ukupni Odlivi', value: `-${f.kasaIzlazKM.toFixed(0)} KM`, sub: `Ovaj mj: -${snimak.ovajMjesec.kesIzlazKM.toFixed(0)} KM`, color: 'red' },
                { label: 'Neto Ovaj Mjesec', value: `${snimak.ovajMjesec.kesNetoKM.toFixed(0)} KM`, sub: `Prošli mj: ${snimak.prosliMjesec.kesNetoKM.toFixed(0)} KM`, color: 'amber' },
            ],
            chart: {
                title: '💵 7-Dnevni Keš Tok (Ulaz vs Izlaz KM)',
                subtitle: 'Dnevno kretanje gotovine u blagajni',
                type: 'bar',
                xKey: 'dan',
                unit: 'KM',
                series: [
                    { key: 'ulazKM', name: 'Priliv (Ulaz)', color: '#10b981', unit: 'KM' },
                    { key: 'izlazKM', name: 'Odliv (Izlaz)', color: '#ef4444', unit: 'KM' },
                ],
                data: snimak.dani7,
            },
            tabela: {
                naslov: 'Struktura Troškova po Kategorijama',
                kolone: [
                    { key: 'kategorija', label: 'Kategorija Troška', type: 'string', align: 'left' },
                    { key: 'iznos', label: 'Ukupno (KM)', type: 'number', align: 'right', suffix: ' KM' },
                ],
                redovi: f.troskoviPoKategoriji,
            },
            predlozi: ['Koji kupci najviše duguju (Aging)?', 'Uporedi ovaj i prošli mjesec', 'Top 10 najprofitabilnijih naloga'],
        };
    }

    // 9. Lager & Zalihe gotove robe
    if (/(lager|zalih|paket|stanje robe|dorad|artikl|gotov)/.test(q)) {
        const topP = snimak.paketi.lagerPoProizvodu.slice(0, 15);
        return {
            naslov: 'Izvještaj Lagera Gotove Robe i Paketa',
            odgovor: `### Stanje zaliha gotove robe na lageru:\n- Trenutno je zaključano na lageru **${snimak.paketi.naLageruM3.toFixed(3)} m³** u **${snimak.paketi.naLageruBroj} paketa**.\n- U toku proizvodnje (otvoreni paketi): **${snimak.paketi.uRaduBroj}** | Već otpremljeno: **${snimak.paketi.otpremljeniBroj}**.\n${topP[0] ? `- Najzastupljeniji artikal na stanju je **${topP[0].naziv}** sa **${topP[0].m3.toFixed(3)} m³** (${topP[0].paketa} paketa).` : ''}`,
            kpi: [
                { label: 'Lager Gotove Robe', value: `${snimak.paketi.naLageruM3.toFixed(2)} m³`, sub: `${snimak.paketi.naLageruBroj} paketa spremno`, color: 'emerald' },
                { label: 'U Proizvodnji', value: `${snimak.paketi.uRaduBroj} pak.`, sub: 'Otvoreni paketi u pogonu', color: 'amber' },
                { label: 'Otpremljeno', value: `${snimak.paketi.otpremljeniBroj} pak.`, sub: 'Isporučeno kupcima', color: 'blue' },
                { label: 'Trupci na Placu', value: `${snimak.trupci.naLageruM3.toFixed(2)} m³`, sub: `${snimak.trupci.naLageruKom} trupaca`, color: 'purple' },
            ],
            chart: {
                title: '📦 Struktura Lagera po Proizvodima (m³)',
                subtitle: 'Top proizvodi trenutno na stanju',
                type: 'hbar',
                xKey: 'naziv',
                unit: 'm³',
                series: [{ key: 'm3', name: 'Na lageru', color: '#3b82f6', unit: 'm³' }],
                data: topP.slice(0, 10).map((x) => ({ naziv: x.naziv.slice(0, 24), m3: x.m3 })),
            },
            tabela: {
                naslov: 'Detaljan Lager Gotovih Proizvoda',
                kolone: [
                    { key: 'naziv', label: 'Naziv Proizvoda', type: 'string', align: 'left' },
                    { key: 'paketa', label: 'Paketa', type: 'number', align: 'right' },
                    { key: 'm3', label: 'Količina (m³)', type: 'number', align: 'right', suffix: ' m³' },
                ],
                redovi: topP,
            },
            predlozi: ['Stanje trupaca i sirovine po vrstama', 'Analiza učinka i zastoja po mašinama', 'Top 10 najprofitabilnijih naloga'],
        };
    }

    // 10. Trupci, Sirovina & Dobavljači
    if (/(trupac|trupc|sirovin|sumarij|dobavljac|vrst|bukv|jel|smrc|hrast|bor)/.test(q)) {
        const t = snimak.trupci;
        return {
            naslov: 'Izvještaj Sirovine, Trupaca i Dobavljača',
            odgovor: `### Stanje sirovine (trupaca):\n- **Na lageru (spremno za prorez):** **${t.naLageruM3.toFixed(3)} m³** (**${t.naLageruKom} kom**)\n- **Ukupno prorezano:** **${t.prorezanoM3.toFixed(3)} m³** (**${t.prorezanoKom} kom**)\n- **FSC certificirani udio:** **${t.fscUdioProc.toFixed(1)}%** svih zaprimljenih trupaca.`,
            kpi: [
                { label: 'Trupci na Placu', value: `${t.naLageruM3.toFixed(2)} m³`, sub: `${t.naLageruKom} komada`, color: 'emerald' },
                { label: 'Prorezano Ukupno', value: `${t.prorezanoM3.toFixed(2)} m³`, sub: `${t.prorezanoKom} komada`, color: 'amber' },
                { label: 'FSC Udio', value: `${t.fscUdioProc.toFixed(1)}%`, sub: 'Certificirana sirovina', color: 'blue' },
                { label: 'Dobavljača / Šumarija', value: `${t.poDobavljacu.length}`, sub: t.poDobavljacu[0] ? `Top: ${t.poDobavljacu[0].dobavljac.slice(0, 16)}` : '', color: 'purple' },
            ],
            chart: {
                title: '🪵 Trupci po Vrsti Drveta (Lager vs Prorezano m³)',
                subtitle: 'Pregled zaliha i prerade po vrstama',
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
                naslov: 'Pregled Dobavljača / Šumarija',
                kolone: [
                    { key: 'dobavljac', label: 'Dobavljač / Šumarija', type: 'string', align: 'left' },
                    { key: 'kom', label: 'Trupaca', type: 'number', align: 'right' },
                    { key: 'm3', label: 'Ukupno (m³)', type: 'number', align: 'right', suffix: ' m³' },
                    { key: 'fscKom', label: 'FSC kom', type: 'number', align: 'right' },
                ],
                redovi: t.poDobavljacu.slice(0, 20),
            },
            predlozi: ['Izvještaj biomase, peći i FSC', 'Stanje lagera gotove robe', 'Analiza učinka i zastoja po mašinama'],
        };
    }

    // 11. Biomasa, Peći, FSC, CBAM, Sušare, Servis
    if (/(biomas|piljevin|okor|sjeck|pec|kotl|fsc|eudr|cbam|co2|eko|susar|sarz|servis|ostr)/.test(q)) {
        const b = snimak.biomasaMjesec;
        const aktivneSusare = snimak.susare.filter((s) => s.status === 'U SUŠENJU' || s.status === 'SUŠENJE');
        const ukBio = b.koraM3 + b.piljevinaM3 + b.okorakM3;
        return {
            naslov: 'Izvještaj Biomase, Peći, FSC & Sušara',
            odgovor: `### EKO Bilans, Biomasa & Sušare (${snimak.ovajMjPrefix}):\n- Na osnovu mjesečnog proreza (**${b.prorezM3.toFixed(2)} m³**), procijenjeni nusproizvodi iznose ukupno **${ukBio.toFixed(2)} m³** (Kora: **${b.koraM3} m³**, Piljevina: **${b.piljevinaM3} m³**, Okorak: **${b.okorakM3} m³**).\n- **FSC certificirana sirovina:** **${snimak.trupci.fscUdioProc.toFixed(1)}%**.\n- **Sušare:** Trenutno je aktivno **${aktivneSusare.length} šarži** u procesu sušenja, a prati se **${snimak.servisi.length}** servisnih rasporeda pila.`,
            kpi: [
                { label: 'Ukupna Biomasa (Mj.)', value: `${ukBio.toFixed(1)} m³`, sub: `Iz ${b.prorezM3.toFixed(1)} m³ proreza`, color: 'emerald' },
                { label: 'Piljevina / Okorak', value: `${b.piljevinaM3.toFixed(1)} / ${b.okorakM3.toFixed(1)}`, sub: `Kora: ${b.koraM3.toFixed(1)} m³`, color: 'amber' },
                { label: 'FSC Udio Trupaca', value: `${snimak.trupci.fscUdioProc.toFixed(1)}%`, sub: 'Sljedivost CoC / EUDR', color: 'blue' },
                { label: 'Aktivnih Šarži Sušara', value: `${aktivneSusare.length}`, sub: `Servis pila praćeno: ${snimak.servisi.length}`, color: 'purple' },
            ],
            chart: {
                title: '🌿 Struktura Biomase za Tekući Mjesec (m³)',
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
                naslov: `Aktivne Šarže u Sušarama & Servis Pila`,
                kolone: [
                    { key: 'kategorija', label: 'Pogon', type: 'string', align: 'left' },
                    { key: 'naziv', label: 'Komora / Mašina', type: 'string', align: 'left' },
                    { key: 'status', label: 'Status', type: 'string', align: 'left' },
                    { key: 'kolicina', label: 'Količina / Opterećenje', type: 'string', align: 'right' },
                ],
                redovi: [
                    ...snimak.susare.slice(0, 10).map((s) => ({
                        kategorija: '🔥 Sušara',
                        naziv: `${s.komora || 'Komora'} (${s.artikal || s.vrsta || '-'})`,
                        status: s.status || '-',
                        kolicina: `${(parseFloat(s.kolicina_m3 || s.zapremina || 0) || 0).toFixed(2)} m³`,
                    })),
                    ...snimak.servisi.slice(0, 10).map((s) => ({
                        kategorija: '🪚 Pila',
                        naziv: s.masina || s.naziv || 'Mašina',
                        status: s.status || 'OK',
                        kolicina: `${(parseFloat(s.odradjeno_m3 || 0) || 0).toFixed(1)} / ${(parseFloat(s.prag_m3 || 0) || 0).toFixed(0)} m³`,
                    })),
                ],
            },
            predlozi: ['Stanje trupaca i dobavljača', 'Uporedi ovaj i prošli mjesec', 'Kompletni direktorski izvještaj'],
        };
    }

    // 12. Reklamacije
    if (/(reklamacij|povrat|skart|kvalitet)/.test(q)) {
        const rk = snimak.reklamacije;
        return {
            naslov: 'Izvještaj Reklamacija i Kvaliteta',
            odgovor: `### Pregled reklamacija:\n- Ukupno evidentirano: **${rk.ukupno}** reklamacija (**${rk.ukupnoM3.toFixed(3)} m³**).\n- Odobreno: **${rk.odobrene}** | Na čekanju odobrenja: **${rk.naCekanju}**.`,
            kpi: [
                { label: 'Ukupno Reklamacija', value: `${rk.ukupno}`, sub: `${rk.ukupnoM3.toFixed(3)} m³`, color: 'amber' },
                { label: 'Odobreno', value: `${rk.odobrene}`, sub: 'Knjižno/materijalno', color: 'red' },
                { label: 'Na Čekanju', value: `${rk.naCekanju}`, sub: 'Zahtijeva odluku', color: 'blue' },
                { label: 'Ovaj Mjesec', value: `${snimak.ovajMjesec.reklamacijeBroj}`, sub: `Prošli mj: ${snimak.prosliMjesec.reklamacijeBroj}`, color: 'purple' },
            ],
            chart: {
                title: '⚠️ Status Reklamacija',
                subtitle: 'Raspodjela po statusu obrade',
                type: 'donut',
                xKey: 'status',
                unit: 'kom',
                series: [{ key: 'broj', name: 'Broj', color: '#f59e0b', unit: 'kom' }],
                data: [
                    { status: 'Odobreno', broj: rk.odobrene },
                    { status: 'Na čekanju', broj: rk.naCekanju },
                    { status: 'Ostalo/Odbijeno', broj: Math.max(0, rk.ukupno - rk.odobrene - rk.naCekanju) },
                ],
            },
            tabela: {
                naslov: 'Zadnje Reklamacije',
                kolone: [
                    { key: 'datum', label: 'Datum', type: 'string', align: 'left' },
                    { key: 'kupac', label: 'Kupac', type: 'string', align: 'left' },
                    { key: 'razlog', label: 'Razlog', type: 'string', align: 'left' },
                    { key: 'm3', label: 'Količina (m³)', type: 'number', align: 'right', suffix: ' m³' },
                    { key: 'status', label: 'Status', type: 'string', align: 'left' },
                ],
                redovi: rk.lista.map((r) => ({
                    datum: prikazDatumaBHS(r.datum || r.created_at),
                    kupac: r.kupac_naziv || '-',
                    razlog: r.razlog || r.opis || '-',
                    m3: parseFloat((parseFloat(r.kolicina || 0) || 0).toFixed(3)),
                    status: r.status || '-',
                })),
            },
            predlozi: ['Top 10 najprofitabilnijih naloga', 'Koji kupci najviše duguju (Aging)?', 'Kompletni direktorski izvještaj'],
        };
    }

    // 13. Default: Kompletni Direktorski Izvještaj (sa 7-dnevnim dijagramom + uporednom tabelom)
    const o = snimak.ovajMjesec;
    const p = snimak.prosliMjesec;
    const f = snimak.finansije;
    return {
        naslov: `Direktorski ERP Presjek (${prikazDatumaBHS(snimak.danasIso)})`,
        odgovor: `Evo kompletnog direktorskog pregleda za upit **"${pitanje}"** na osnovu živih podataka iz baze:\n\n### Proizvodnja & Zalihe\n- **Ovaj mjesec (${o.prefix}):** Prorez **${o.prorezM3.toFixed(2)} m³** (${pctDelta(o.prorezM3, p.prorezM3)} vs prošli mj.) → Izlaz **${o.izlazM3.toFixed(2)} m³** (Yield **${o.yieldProc.toFixed(1)}%**).\n- **Zalihe:** Na lageru gotove robe **${snimak.paketi.naLageruM3.toFixed(2)} m³** (${snimak.paketi.naLageruBroj} paketa), a na placu trupaca **${snimak.trupci.naLageruM3.toFixed(2)} m³** (${snimak.trupci.naLageruKom} kom).\n\n### Finansije & Likvidnost\n- **Stanje gotovine u blagajni:** **${f.stanjeKaseKM.toFixed(2)} KM**.\n- **Otvorena potraživanja:** **${f.otvoreniDugKM.toFixed(2)} KM** (od toga dospjelo preko roka: **${f.dospjeliDugKM.toFixed(2)} KM**).\n- **Aktivni radni nalozi:** **${snimak.hr.aktivniNalozi}** | **Reklamacije na čekanju:** **${snimak.reklamacije.naCekanju}**.\n\n*Savjet: Možeš mi postaviti i specifično pitanje ili povezati Gemini / OpenAI API ključ gore za potpuno slobodnu konverzaciju!*`,
        kpi: [
            { label: 'Stanje Kase', value: `${f.stanjeKaseKM.toFixed(0)} KM`, sub: `Mjesečni neto: ${o.kesNetoKM.toFixed(0)} KM`, color: 'emerald' },
            { label: 'Dospjeli Dug', value: `${f.dospjeliDugKM.toFixed(0)} KM`, sub: `Ukupno otvoreno: ${f.otvoreniDugKM.toFixed(0)} KM`, color: f.dospjeliDugKM > 0 ? 'red' : 'emerald' },
            { label: 'Prorez / Izlaz (Mj.)', value: `${o.prorezM3.toFixed(1)} / ${o.izlazM3.toFixed(1)} m³`, sub: `Yield: ${o.yieldProc.toFixed(1)}%`, color: 'amber' },
            { label: 'Lager Robe / Trupci', value: `${snimak.paketi.naLageruM3.toFixed(1)} / ${snimak.trupci.naLageruM3.toFixed(1)}`, sub: 'm³ na stanju', color: 'blue' },
        ],
        chart: {
            title: '📈 7-Dnevni Operativni Trend (Prorez vs Izlaz m³)',
            subtitle: 'Dnevni pregled prerade zadnjih 7 dana',
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
            naslov: 'Ključni Pokazatelji: Ovaj vs Prošli Mjesec',
            kolone: [
                { key: 'pokazatelj', label: 'Pokazatelj', type: 'string', align: 'left' },
                { key: 'ovaj', label: `Ovaj mj. (${o.prefix})`, type: 'number', align: 'right' },
                { key: 'prosli', label: `Prošli mj. (${p.prefix})`, type: 'number', align: 'right' },
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
            'Uporedi ovaj i prošli mjesec detaljno',
            'Koji kupci najviše duguju (Aging 30/60/90)?',
            'Top 10 najprofitabilnijih radnih naloga',
            'Izvještaj biomase, peći, FSC i sušara',
        ],
    };
}
