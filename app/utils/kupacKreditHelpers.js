"use client";
import { supabase } from './supabaseClient';
import { toLocalIso } from './dateHelpers';

export const KUPCI_LIMITI_KEY = 'kupci_kreditni_limiti';
export const DOZVOLA_KREDITNI_LIMIT = 'Kreditni Limiti Kupaca (Odobrenje)';

export const normKupacKljuc = (naziv) =>
    String(naziv || '')
        .toUpperCase()
        .replace(/Ć/g, 'C').replace(/Č/g, 'C').replace(/Š/g, 'S')
        .replace(/Ž/g, 'Z').replace(/Đ/g, 'D')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .trim();

/**
 * STROGA SIGURNOST: Samo Superadmin ILI korisnik kojem je Superadmin dodijelio
 * eksplicitnu dozvolu "Kreditni Limiti Kupaca (Odobrenje)" smije postavljati ili mijenjati limite!
 */
export function mozeUredjivatiKreditniLimit(user) {
    if (!user) return false;
    const uloga = String(user.uloga || '').toLowerCase().trim();
    if (uloga === 'superadmin') return true;
    const dozvole = Array.isArray(user.dozvole) ? user.dozvole : [];
    return dozvole.includes(DOZVOLA_KREDITNI_LIMIT);
}

let limitiCache = null;

export async function ucitajSveKreditneLimite(force = false) {
    if (limitiCache && !force) return limitiCache;
    try {
        const { data } = await supabase
            .from('ui_postavke')
            .select('postavke_jsonb')
            .eq('modul_ime', KUPCI_LIMITI_KEY)
            .maybeSingle();
        limitiCache = data?.postavke_jsonb && typeof data.postavke_jsonb === 'object' ? data.postavke_jsonb : {};
        return limitiCache;
    } catch (e) {
        return limitiCache || {};
    }
}

export async function spasiKreditniLimitKupca(kupacNaziv, postavka, user) {
    if (!mozeUredjivatiKreditniLimit(user)) {
        return { error: { message: 'Nemate ovlaštenje za izmjenu kreditnog limita! Ovlaštenje dodjeljuje isključivo Superadmin.' } };
    }
    const kljuc = normKupacKljuc(kupacNaziv);
    if (!kljuc) return { error: { message: 'Nedostaje naziv kupca.' } };

    const trenutni = await ucitajSveKreditneLimite(true);
    const limitVal = Math.max(0, parseFloat(postavka?.limitKM || 0) || 0);
    const maxKasnjenje = Math.max(0, parseInt(postavka?.maxKasnjenjeDana || 0, 10) || 0);

    const noviZapis = {
        kupac_naziv: kupacNaziv,
        limitKM: parseFloat(limitVal.toFixed(2)),
        maxKasnjenjeDana: maxKasnjenje,
        blokirajPrekoracenje: Boolean(postavka?.blokirajPrekoracenje),
        napomena: String(postavka?.napomena || '').trim(),
        odobrio: user?.ime_prezime || 'Superadmin',
        datum_izmjene: new Date().toISOString(),
    };

    const novaMapa = { ...trenutni, [kljuc]: noviZapis };
    const { error } = await supabase
        .from('ui_postavke')
        .upsert([{ modul_ime: KUPCI_LIMITI_KEY, postavke_jsonb: novaMapa }], { onConflict: 'modul_ime' });

    if (!error) {
        limitiCache = novaMapa;
        await supabase.from('sistem_audit_log').insert([{
            korisnik: user?.ime_prezime || 'Superadmin',
            akcija: 'IZMJENA_KREDITNOG_LIMITA',
            detalji: `Kupac ${kupacNaziv}: Kreditni limit postavljen na ${noviZapis.limitKM.toFixed(2)} KM, max kašnjenje ${noviZapis.maxKasnjenjeDana} dana (${noviZapis.blokirajPrekoracenje ? 'STROGA BLOKADA' : 'UPOZORENJE'}). Odobrio: ${noviZapis.odobrio}.`,
            nivo_alarma: 'ŽUTO',
            pregledano: true,
        }]);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kreditni_limiti_updated', { detail: novaMapa }));
        }
    }
    return { error, zapis: noviZapis };
}

/**
 * Izračunava kompletnu finansijsku karticu kupca:
 * - ukupno fakturisano (KM)
 * - ukupno uplaćeno (keš + virman iz blagajne / naplaćeni računi)
 * - knjižna odobrenja od reklamacija
 * - trenutni otvoreni saldo (dug KM)
 * - Aging struktura (U roku | 1-30d | 31-60d | 61-90d | 90+d)
 * - provjera prekoračenja limita i maksimalnog kašnjenja!
 */
export async function izracunajKarticuKupca(kupacNaziv, noviIznosKM = 0) {
    const kljuc = normKupacKljuc(kupacNaziv);
    if (!kljuc) return null;

    const [limitiMapa, racRes, blagRes, rekRes, kupRes] = await Promise.all([
        ucitajSveKreditneLimite(),
        supabase.from('racuni').select('*').order('datum', { ascending: false }),
        supabase.from('blagajna').select('*').order('datum', { ascending: false }),
        supabase.from('reklamacije').select('*').order('created_at', { ascending: false }),
        supabase.from('kupci').select('*'),
    ]);

    const kupacObj = (kupRes.data || []).find((k) => normKupacKljuc(k.naziv) === kljuc) || { naziv: kupacNaziv };
    const limitPostavka = limitiMapa[kljuc] || { limitKM: 0, maxKasnjenjeDana: 0, blokirajPrekoracenje: false, napomena: '', odobrio: '' };

    const racuniKupca = (racRes.data || []).filter((r) => {
        if (normKupacKljuc(r.kupac_naziv) !== kljuc) return false;
        const st = String(r.status || '').toUpperCase().trim();
        return st !== 'STORNIRANO' && st !== 'OBRISANO';
    });

    const sveUplate = (blagRes.data || []).filter((b) => String(b.tip || '').toUpperCase() === 'ULAZ');
    const reklamacijeKupca = (rekRes.data || []).filter((r) => normKupacKljuc(r.kupac_naziv) === kljuc);

    const danasIso = toLocalIso(new Date());
    const danasMs = new Date(`${danasIso}T12:00:00`).getTime();

    let ukupnoFakturisanoKM = 0;
    let ukupnoNaplacenoKM = 0;
    let otvoreniDugKM = 0;
    let najstarijeKasnjenjeDana = 0;

    const aging = {
        uRoku: 0,
        d1_30: 0,
        d31_60: 0,
        d61_90: 0,
        d90plus: 0,
    };

    const racuniDetalji = racuniKupca.map((r) => {
        const valuta = String(r.valuta || 'KM').toUpperCase();
        const kurs = valuta === 'EUR' || valuta === '€' ? 1.95583 : 1;
        const ukupnoKM = parseFloat(((parseFloat(r.ukupno_sa_pdv || 0) || 0) * kurs).toFixed(2));
        ukupnoFakturisanoKM += ukupnoKM;

        const ridUp = String(r.id || '').toUpperCase().trim();
        const statusUp = String(r.status || '').toUpperCase().trim();
        const uplacenoIzBlagajne = sveUplate
            .filter((u) => (u.racun_id && String(u.racun_id).toUpperCase().trim() === ridUp) || (u.opis && String(u.opis).toUpperCase().includes(ridUp)))
            .reduce((s, u) => s + (parseFloat(u.iznos || 0) || 0), 0);

        const uplacenoKM = statusUp === 'NAPLAĆENO' || statusUp === 'NAPLACENO'
            ? Math.max(ukupnoKM, uplacenoIzBlagajne)
            : Math.min(ukupnoKM, uplacenoIzBlagajne);

        const preostaloKM = Math.max(0, parseFloat((ukupnoKM - uplacenoKM).toFixed(2)));
        ukupnoNaplacenoKM += Math.min(ukupnoKM, uplacenoKM);
        otvoreniDugKM += preostaloKM;

        // Datum roka valute
        let rokIso = '';
        const rawRok = String(r.rok_placanja || '').trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(rawRok)) {
            rokIso = rawRok.slice(0, 10);
        } else if (r.datum) {
            const dana = parseInt(rawRok, 10);
            const dt = new Date(`${String(r.datum).slice(0, 10)}T12:00:00`);
            if (!isNaN(dt.getTime())) {
                dt.setDate(dt.getDate() + (isNaN(dana) ? 15 : dana));
                rokIso = toLocalIso(dt);
            }
        }

        let kasniDana = 0;
        if (preostaloKM > 0.01) {
            if (rokIso) {
                const rokMs = new Date(`${rokIso}T12:00:00`).getTime();
                kasniDana = Math.round((danasMs - rokMs) / 86400000);
            }
            if (kasniDana <= 0) {
                aging.uRoku += preostaloKM;
            } else if (kasniDana <= 30) {
                aging.d1_30 += preostaloKM;
            } else if (kasniDana <= 60) {
                aging.d31_60 += preostaloKM;
            } else if (kasniDana <= 90) {
                aging.d61_90 += preostaloKM;
            } else {
                aging.d90plus += preostaloKM;
            }
        }

        return {
            id: r.id,
            datum: r.datum,
            rokIso,
            ukupnoKM,
            uplacenoKM: parseFloat(uplacenoKM.toFixed(2)),
            preostaloKM,
            kasniDana: Math.max(0, kasniDana),
            status: preostaloKM <= 0.01 ? 'NAPLAĆENO' : (kasniDana > 0 ? 'DOSPJELO' : r.status || 'OTVORENO'),
        };
    });

    // Sortiraj tako da najstariji dospjeli neplaćeni računi budu NA VRHU (uvijek 100% usklađeno sa sažetkom!)
    racuniDetalji.sort((a, b) => {
        const aOtv = a.preostaloKM > 0.01 ? 1 : 0;
        const bOtv = b.preostaloKM > 0.01 ? 1 : 0;
        if (aOtv !== bOtv) return bOtv - aOtv;
        if (a.kasniDana !== b.kasniDana) return b.kasniDana - a.kasniDana;
        return String(b.datum || '').localeCompare(String(a.datum || ''));
    });

    const najstarijiOtvoreni = racuniDetalji.find((r) => r.preostaloKM > 0.01 && r.kasniDana > 0) || null;
    najstarijeKasnjenjeDana = najstarijiOtvoreni ? najstarijiOtvoreni.kasniDana : 0;
    const najstarijiRacunId = najstarijiOtvoreni ? najstarijiOtvoreni.id : '';
    const najstarijiRokIso = najstarijiOtvoreni ? najstarijiOtvoreni.rokIso : '';

    const uplateKupca = (blagRes.data || []).filter((b) => {
        const opisUp = normKupacKljuc(b.opis || '');
        const racIds = new Set(racuniKupca.map((r) => String(r.id || '').toUpperCase().trim()));
        return (b.racun_id && racIds.has(String(b.racun_id).toUpperCase().trim())) || (kljuc.length >= 3 && opisUp.includes(kljuc));
    });

    const povratReklamacijeKM = (blagRes.data || [])
        .filter((b) => String(b.tip || '').toUpperCase() === 'IZLAZ' && String(b.kategorija || '').toLowerCase().includes('reklamacij') && normKupacKljuc(b.opis || '').includes(kljuc))
        .reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);

    const limitKM = parseFloat(limitPostavka.limitKM || 0) || 0;
    const maxKasnjenjeDana = parseInt(limitPostavka.maxKasnjenjeDana || 0, 10) || 0;
    const projektovaniDugKM = parseFloat((otvoreniDugKM + (parseFloat(noviIznosKM || 0) || 0)).toFixed(2));
    const prekoracenLimit = limitKM > 0 && projektovaniDugKM > limitKM + 0.01;
    const prekoracenoKasnjenje = maxKasnjenjeDana > 0 && najstarijeKasnjenjeDana > maxKasnjenjeDana;
    const iskoristenostProc = limitKM > 0 ? Math.min(999, parseFloat(((otvoreniDugKM / limitKM) * 100).toFixed(1))) : 0;

    const dospjeliDugKM = parseFloat((aging.d1_30 + aging.d31_60 + aging.d61_90 + aging.d90plus).toFixed(2));

    return {
        kupac: kupacObj,
        limitPostavka,
        ukupnoFakturisanoKM: parseFloat(ukupnoFakturisanoKM.toFixed(2)),
        ukupnoNaplacenoKM: parseFloat(ukupnoNaplacenoKM.toFixed(2)),
        otvoreniDugKM: parseFloat(otvoreniDugKM.toFixed(2)),
        dospjeliDugKM,
        projektovaniDugKM,
        povratReklamacijeKM: parseFloat(povratReklamacijeKM.toFixed(2)),
        najstarijeKasnjenjeDana,
        najstarijiRacunId,
        najstarijiRokIso,
        maxKasnjenjeKupca: najstarijeKasnjenjeDana,
        aging: {
            uRoku: parseFloat(aging.uRoku.toFixed(2)),
            d1_30: parseFloat(aging.d1_30.toFixed(2)),
            d31_60: parseFloat(aging.d31_60.toFixed(2)),
            d61_90: parseFloat(aging.d61_90.toFixed(2)),
            d90plus: parseFloat(aging.d90plus.toFixed(2)),
        },
        iskoristenostProc,
        prekoracenLimit,
        prekoracenoKasnjenje,
        kasniPrekoLimita: prekoracenoKasnjenje,
        zahtijevaBlokadu: Boolean(limitPostavka.blokirajPrekoracenje && (prekoracenLimit || prekoracenoKasnjenje)),
        racuni: racuniDetalji,
        uplate: uplateKupca.slice(0, 30),
        reklamacije: reklamacijeKupca.slice(0, 20),
    };
}
