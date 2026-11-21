"use client";
import { supabase } from './supabaseClient';
import { posaljiNotifikaciju } from './notificationHelpers';
import { toLocalIso } from './dateHelpers';

export const REMINDERS_CONFIG_KEY = 'smart_reminders_config';
export const REMINDERS_STATE_KEY = 'smart_reminders_state';

export const DEFAULT_REMINDERS_CONFIG = {
    omoguceno: true,
    provjeriDospjeleRacune: true,
    provjeriNiskeZalihe: true,
    minZalihaGlobalM3: 0, // Ako > 0, prati sve aktivne artikle; pojedinačni pragovi imaju prednost
    artikliMinM3: {}, // { [sifra]: minM3 }
};

/**
 * Pouzdano prepoznaje QA / E2E / testne zapise (nikad ne označava prave radne dokumente).
 */
export function jeQaTestniId(val) {
    const s = String(val || '').toUpperCase().trim();
    if (!s) return false;
    return (
        /^QA\d*[-_]/i.test(s) ||
        /^OWNQA\d*[-_]/i.test(s) ||
        /^E2E[-_]/i.test(s) ||
        /^TEST[-_]/i.test(s) ||
        /^DEMO[-_]/i.test(s) ||
        s.includes('QA-TEST') ||
        s.includes('QA_TEST') ||
        s.includes('E2ENOTIF') ||
        s.includes('TEST-NEW-PK') ||
        s.includes('NOVI-MO-TEST')
    );
}

export function jeQaTestniZapis(row = {}) {
    if (!row || typeof row !== 'object') return false;
    const polja = [
        row.paket_id,
        row.id,
        row.trupac_id,
        row.naziv_proizvoda,
        row.kupac_naziv,
        row.otpremnica_id,
        row.otpremnica_broj,
        row.broj_veze,
        row.napomena,
        row.opis,
    ];
    return polja.some((v) => jeQaTestniId(v));
}

export async function ucitajRemindersConfig() {
    try {
        const { data } = await supabase
            .from('ui_postavke')
            .select('postavke_jsonb')
            .eq('modul_ime', REMINDERS_CONFIG_KEY)
            .maybeSingle();
        return { ...DEFAULT_REMINDERS_CONFIG, ...(data?.postavke_jsonb || {}) };
    } catch (e) {
        return { ...DEFAULT_REMINDERS_CONFIG };
    }
}

export async function spasiRemindersConfig(config) {
    const clean = { ...DEFAULT_REMINDERS_CONFIG, ...(config || {}) };
    const { error } = await supabase
        .from('ui_postavke')
        .upsert([{ modul_ime: REMINDERS_CONFIG_KEY, postavke_jsonb: clean }], { onConflict: 'modul_ime' });
    return { error, config: clean };
}

/**
 * Analizira stvarne dospjele neplaćene račune i zalihe ispod minimuma.
 */
export async function izracunajStanjePodsjetnika(configOverride = null) {
    const cfg = configOverride || (await ucitajRemindersConfig());
    const danasIso = toLocalIso(new Date());

    const [racRes, blagRes, pakRes, katRes] = await Promise.all([
        supabase.from('racuni').select('id, kupac_naziv, datum, rok_placanja, valuta, ukupno_sa_pdv, status'),
        supabase.from('blagajna').select('tip, iznos, racun_id, opis').eq('tip', 'ULAZ'),
        supabase.from('paketi').select('paket_id, naziv_proizvoda, kolicina_final, status, otpremnica_id').is('otpremnica_id', null).gt('kolicina_final', 0),
        supabase.from('katalog_proizvoda').select('sifra, naziv, kategorija'),
    ]);

    const uplate = blagRes.data || [];
    const dospjeliRacuni = [];

    (racRes.data || []).forEach((r) => {
        if (jeQaTestniZapis(r)) return;
        const st = String(r.status || '').toUpperCase().trim();
        if (st === 'NAPLAĆENO' || st === 'NAPLACENO' || st === 'STORNIRANO' || st === 'OBRISANO') return;

        // Izračunaj rok valute (rok_placanja može biti YYYY-MM-DD datum ili broj dana)
        let rokIso = '';
        const rawRok = String(r.rok_placanja || '').trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(rawRok)) {
            rokIso = rawRok.slice(0, 10);
        } else if (r.datum) {
            const dana = parseInt(rawRok, 10);
            const base = new Date(`${String(r.datum).slice(0, 10)}T12:00:00`);
            if (!isNaN(base.getTime())) {
                base.setDate(base.getDate() + (isNaN(dana) ? 15 : dana));
                rokIso = toLocalIso(base);
            }
        }
        if (!rokIso || rokIso >= danasIso) return;

        const valuta = String(r.valuta || 'KM').toUpperCase();
        const kurs = valuta === 'EUR' || valuta === '€' ? 1.95583 : 1;
        const ukupnoKM = (parseFloat(r.ukupno_sa_pdv || 0) || 0) * kurs;
        if (ukupnoKM <= 0.01) return;

        const ridUp = String(r.id || '').toUpperCase().trim();
        const uplacenoKM = uplate
            .filter((u) => (u.racun_id && String(u.racun_id).toUpperCase().trim() === ridUp) || (u.opis && String(u.opis).toUpperCase().includes(ridUp)))
            .reduce((s, u) => s + (parseFloat(u.iznos || 0) || 0), 0);

        const dugKM = parseFloat((ukupnoKM - uplacenoKM).toFixed(2));
        if (dugKM <= 0.5) return;

        const kasniDana = Math.max(1, Math.round((new Date(`${danasIso}T12:00:00`) - new Date(`${rokIso}T12:00:00`)) / 86400000));
        dospjeliRacuni.push({
            id: r.id,
            kupac: r.kupac_naziv || 'Nepoznat kupac',
            rok: rokIso,
            kasniDana,
            dugKM,
        });
    });

    dospjeliRacuni.sort((a, b) => b.kasniDana - a.kasniDana);
    const ukupanDospjeliDugKM = parseFloat(dospjeliRacuni.reduce((s, r) => s + r.dugKM, 0).toFixed(2));

    // Zalihe po nazivu proizvoda (samo stvarni neisporučeni paketi)
    const stanjePoNazivu = {};
    const iskljuceni = new Set(['ISPORUČENO', 'ISPORUCENO', 'POTROŠENO_U_DORADI', 'POTROSENO_U_DORADI', 'POVRAT_REKLAMACIJA']);
    (pakRes.data || []).forEach((p) => {
        if (jeQaTestniZapis(p)) return;
        const st = String(p.status || '').toUpperCase().trim();
        if (iskljuceni.has(st)) return;
        const key = String(p.naziv_proizvoda || '').toUpperCase().trim();
        if (!key) return;
        stanjePoNazivu[key] = (stanjePoNazivu[key] || 0) + (parseFloat(p.kolicina_final || 0) || 0);
    });

    const niskeZalihe = [];
    const globalMin = parseFloat(cfg.minZalihaGlobalM3 || 0) || 0;
    const pragovi = cfg.artikliMinM3 || {};

    (katRes.data || []).forEach((k) => {
        if (jeQaTestniId(k.sifra) || jeQaTestniId(k.naziv)) return;
        const prag = parseFloat(pragovi[k.sifra] ?? globalMin) || 0;
        if (prag <= 0) return;
        const nazivKey = String(k.naziv || '').toUpperCase().trim();
        const sifraKey = String(k.sifra || '').toUpperCase().trim();
        const trenutnoM3 = parseFloat(((stanjePoNazivu[nazivKey] || 0) + (nazivKey !== sifraKey ? (stanjePoNazivu[sifraKey] || 0) : 0)).toFixed(3));
        if (trenutnoM3 < prag) {
            niskeZalihe.push({
                sifra: k.sifra,
                naziv: k.naziv,
                trenutnoM3,
                pragM3: prag,
            });
        }
    });

    niskeZalihe.sort((a, b) => (a.trenutnoM3 / a.pragM3) - (b.trenutnoM3 / b.pragM3));

    return {
        danasIso,
        cfg,
        dospjeliRacuni,
        ukupanDospjeliDugKM,
        niskeZalihe,
    };
}

/**
 * Pokreće dnevnu provjeru i šalje najviše 1 zbirnu notifikaciju za dospjele račune
 * i 1 za niske zalihe dnevno (idempotentno preko ui_postavke).
 */
export async function pokreniPametnaPodsjetnica(user, { force = false } = {}) {
    const uloga = String(user?.uloga || '').toLowerCase();
    if (!force && uloga !== 'superadmin' && uloga !== 'admin') return null;

    const danasIso = toLocalIso(new Date());

    if (!force) {
        // Lokalni guard za istu sesiju/dan da ne udaramo bazu na svaki refresh
        try {
            if (typeof window !== 'undefined' && localStorage.getItem('smart_reminders_checked_day') === danasIso) {
                return null;
            }
        } catch (e) {}
    }

    const [cfg, stateRes] = await Promise.all([
        ucitajRemindersConfig(),
        supabase.from('ui_postavke').select('postavke_jsonb').eq('modul_ime', REMINDERS_STATE_KEY).maybeSingle(),
    ]);

    if (!force && !cfg.omoguceno) return null;

    const zadnjiDan = stateRes?.data?.postavke_jsonb?.zadnji_dan;
    if (!force && zadnjiDan === danasIso) {
        try { if (typeof window !== 'undefined') localStorage.setItem('smart_reminders_checked_day', danasIso); } catch (e) {}
        return null;
    }

    const stanje = await izracunajStanjePodsjetnika(cfg);
    let poslanoNotif = 0;

    if (cfg.provjeriDospjeleRacune && stanje.dospjeliRacuni.length > 0) {
        const topLista = stanje.dospjeliRacuni
            .slice(0, 5)
            .map((r) => `${r.id} (${r.kupac}: ${r.dugKM.toFixed(2)} KM, kasni ${r.kasniDana}d)`)
            .join('; ');
        await posaljiNotifikaciju({
            korisnik: 'Sistem Podsjetnik',
            akcija: 'DOSPJELI_RACUNI',
            detalji: `Podsjetnik (${danasIso}): ${stanje.dospjeliRacuni.length} dospjelih neplaćenih računa (ukupno ${stanje.ukupanDospjeliDugKM.toFixed(2)} KM). Najstariji: ${topLista}`,
            nivo_alarma: 'ŽUTO',
            meta: {
                modul: 'racuni',
                moduli: ['racuni', 'blagajna'],
                entity_type: 'racun',
                entity_id: stanje.dospjeliRacuni[0].id,
            },
        });
        poslanoNotif++;
    }

    if (cfg.provjeriNiskeZalihe && stanje.niskeZalihe.length > 0) {
        const topArtikli = stanje.niskeZalihe
            .slice(0, 5)
            .map((a) => `${a.naziv} (${a.trenutnoM3.toFixed(2)} / min ${a.pragM3} m³)`)
            .join('; ');
        await posaljiNotifikaciju({
            korisnik: 'Sistem Podsjetnik',
            akcija: 'NISKE_ZALIHE',
            detalji: `Upozorenje (${danasIso}): ${stanje.niskeZalihe.length} artikala je ispod minimalnog lagera! Kritično: ${topArtikli}`,
            nivo_alarma: 'ŽUTO',
            meta: {
                modul: 'lager',
                moduli: ['lager', 'planiranje'],
                entity_type: 'zaliha',
                entity_id: stanje.niskeZalihe[0].sifra,
            },
        });
        poslanoNotif++;
    }

    // Zabilježi da je današnja provjera završena (idempotentnost)
    await supabase.from('ui_postavke').upsert(
        [{
            modul_ime: REMINDERS_STATE_KEY,
            postavke_jsonb: {
                zadnji_dan: danasIso,
                dospjeli_count: stanje.dospjeliRacuni.length,
                niske_zalihe_count: stanje.niskeZalihe.length,
                zadnja_provjera: new Date().toISOString(),
            },
        }],
        { onConflict: 'modul_ime' }
    );
    try { if (typeof window !== 'undefined') localStorage.setItem('smart_reminders_checked_day', danasIso); } catch (e) {}

    return { ...stanje, poslanoNotif };
}
