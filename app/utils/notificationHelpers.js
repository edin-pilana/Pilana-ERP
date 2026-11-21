import { supabase } from './supabaseClient';

const META_REGEX = /\s*\[\[META:(\{[\s\S]*?\})\]\]\s*$/;
const PRAVILA_MODUL_IME = 'notifikacije_pravila';
const PRAVILA_LS_KEY = 'erp_notifikacije_pravila_cache';

export const NOTIF_KATEGORIJE = [
    { id: 'PONUDE_RABAT', kratki: 'Rabat', naziv: 'Ručni rabat (Ponude)', ikona: '🏷️', opis: 'Upozorenja kada neko ručno promijeni rabat ili cijenu na ponudi' },
    { id: 'PONUDE_ODOBRENJE', kratki: 'Ponuda/RN', naziv: 'Odobrenje Ponuda ↔ RN', ikona: '📝', opis: 'Zahtjevi za odobrenje kada Radni Nalog odstupa od Ponude' },
    { id: 'REKLAMACIJE', kratki: 'Reklamacije', naziv: 'Reklamacije i Povrati', ikona: '⚠️', opis: 'Nove reklamacije paketa i zahtjevi za odobrenje povrata' },
    { id: 'HR_ODMOR', kratki: 'HR Odmor', naziv: 'HR Zahtjevi za Odmor', ikona: '🏖️', opis: 'Zahtjevi radnika za godišnji odmor, bolovanje i korekcije sati' },
    { id: 'BLAGAJNA_ALARM', kratki: 'Blagajna', naziv: 'Alarmi Blagajne / Kase', ikona: '💵', opis: 'Kritične izmjene, storniranja i brisanja uplata u blagajni' },
    { id: 'OTPREMNICE_ALARM', kratki: 'Otpremnice', naziv: 'Alarmi Otpremnica', ikona: '🚚', opis: 'Povrati djelimične otpreme i kritične izmjene otpremnica' },
    { id: 'PROIZVODNJA_LAGER', kratki: 'Pogon/Lager', naziv: 'Pogon, Prijem i Lager', ikona: '🏭', opis: 'Alarmi u prijemu, prorezu, pilani, doradi, planiranju i lageru' },
    { id: 'LICNE_PORUKE', kratki: 'Lične', naziv: 'Lične notifikacije za korisnika', ikona: '🎯', opis: 'Poruke naslovljene direktno na tog korisnika (npr. odobren godišnji)' },
];

export const MODUL_META = {
    prijem: { naziv: 'Prijem Trupaca', appId: 'prijem', dozvola: 'Prijem trupaca', ikona: '🌲' },
    prorez: { naziv: 'Prorez', appId: 'prorez', dozvola: 'Prorez (Trupci)', ikona: '🪚' },
    pilana: { naziv: 'Pilana', appId: 'pilana', dozvola: 'Pilana (Izlaz)', ikona: '🪵' },
    dorada: { naziv: 'Dorada', appId: 'dorada', dozvola: 'Dorada (Ulaz/Izlaz)', ikona: '🔄' },
    planiranje: { naziv: 'Planiranje', appId: 'planiranje', dozvola: 'Planiranje Proizvodnje', ikona: '📅' },
    lager: { naziv: 'Lager Paketa', appId: 'lager', dozvola: 'Lager Paketa', ikona: '📦' },
    ponude: { naziv: 'Ponude', appId: 'ponude', dozvola: 'Ponude', ikona: '📝' },
    radni_nalog: { naziv: 'Radni Nalozi', appId: 'radni_nalozi', dozvola: 'Radni Nalozi', ikona: '⚙️' },
    otpremnice: { naziv: 'Otpremnice', appId: 'otpremnice', dozvola: 'Otpremnice i Izdatnice', ikona: '🚚' },
    racuni: { naziv: 'Računi', appId: 'racuni', dozvola: 'Računi', ikona: '🧾' },
    blagajna: { naziv: 'Blagajna', appId: 'blagajna', dozvola: 'Blagajna (Keš)', ikona: '💵' },
    reklamacije: { naziv: 'Reklamacije', appId: 'reklamacije', dozvola: 'Reklamacije i Povrati', ikona: '⚠️' },
    hr_modul: { naziv: 'HR & Odsustva', appId: 'hr', dozvola: 'HR Dashboard', ikona: '👥' },
    kiosk: { naziv: 'Prijava na Rad', appId: 'kiosk', dozvola: 'Prijava na Rad', ikona: '🕒' },
    podesavanja: { naziv: 'Postavke', appId: 'podesavanja', dozvola: 'Podešavanja', ikona: '⚙️' },
    analitika: { naziv: 'Analitika', appId: 'analitika', dozvola: 'Analitika', ikona: '📊' },
    forenzika: { naziv: 'Kontrolni Toranj', appId: 'toranj', dozvola: 'Kontrolni Toranj', ikona: '🕵️' },
    nadzor: { naziv: 'Nadzorni Centar', appId: 'nadzor', dozvola: 'Superadmin', ikona: '🛡️' },
};

const normText = (v) => String(v || '').trim().toLowerCase();

let pravilaCache = null;
let pravilaLoadedAt = 0;

export const getCachedPravilaNotifikacija = () => {
    if (pravilaCache && typeof pravilaCache === 'object') return pravilaCache;
    if (typeof window !== 'undefined') {
        try {
            const raw = localStorage.getItem(PRAVILA_LS_KEY);
            if (raw) {
                pravilaCache = JSON.parse(raw);
                return pravilaCache;
            }
        } catch (e) {}
    }
    return {};
};

export const ucitajPravilaNotifikacija = async (force = false) => {
    const now = Date.now();
    if (!force && pravilaCache && now - pravilaLoadedAt < 8000) {
        return pravilaCache;
    }
    try {
        const { data } = await supabase
            .from('ui_postavke')
            .select('postavke_jsonb')
            .eq('modul_ime', PRAVILA_MODUL_IME)
            .maybeSingle();
        const mapa = (data?.postavke_jsonb && typeof data.postavke_jsonb === 'object') ? data.postavke_jsonb : {};
        pravilaCache = mapa;
        pravilaLoadedAt = now;
        if (typeof window !== 'undefined') {
            try { localStorage.setItem(PRAVILA_LS_KEY, JSON.stringify(mapa)); } catch (e) {}
        }
        return mapa;
    } catch (e) {
        return getCachedPravilaNotifikacija();
    }
};

export const spasiPravilaNotifikacija = async (mapa) => {
    const clean = (mapa && typeof mapa === 'object') ? mapa : {};
    const { error } = await supabase
        .from('ui_postavke')
        .upsert([{ modul_ime: PRAVILA_MODUL_IME, postavke_jsonb: clean }], { onConflict: 'modul_ime' });
    if (!error) {
        pravilaCache = clean;
        pravilaLoadedAt = Date.now();
        if (typeof window !== 'undefined') {
            try { localStorage.setItem(PRAVILA_LS_KEY, JSON.stringify(clean)); } catch (e) {}
            window.dispatchEvent(new CustomEvent('notifikacije_updated'));
        }
    }
    return { error };
};

export const getPraviloKorisnika = (user, pravilaMapa = null) => {
    if (!user) return null;
    const mapa = pravilaMapa || getCachedPravilaNotifikacija();
    if (!mapa || typeof mapa !== 'object') return null;
    const uKey = normText(user.username);
    const iKey = normText(user.ime_prezime);
    if (uKey && mapa[uKey]) return mapa[uKey];
    if (iKey && mapa[iKey]) return mapa[iKey];
    const matchKey = Object.keys(mapa).find((k) => {
        const nk = normText(k);
        return (uKey && nk === uKey) || (iKey && nk === iKey);
    });
    return matchKey ? mapa[matchKey] : null;
};

export const getPodrazumijevanaPravilaZaKorisnika = (user) => {
    const isAdminOrSuper = user?.uloga === 'superadmin' || user?.uloga === 'admin';
    const dozvole = Array.isArray(user?.dozvole) ? user.dozvole : [];
    return {
        PONUDE_RABAT: isAdminOrSuper || dozvole.includes('Ponude'),
        PONUDE_ODOBRENJE: isAdminOrSuper || dozvole.includes('Ponude'),
        REKLAMACIJE: isAdminOrSuper || dozvole.includes('Reklamacije i Povrati'),
        HR_ODMOR: isAdminOrSuper || dozvole.includes('HR Dashboard'),
        BLAGAJNA_ALARM: isAdminOrSuper || dozvole.includes('Blagajna (Keš)'),
        OTPREMNICE_ALARM: isAdminOrSuper || dozvole.includes('Otpremnice i Izdatnice'),
        PROIZVODNJA_LAGER: isAdminOrSuper || dozvole.some((d) => ['Prijem trupaca', 'Prorez (Trupci)', 'Pilana (Izlaz)', 'Dorada (Ulaz/Izlaz)', 'Lager Paketa', 'Planiranje Proizvodnje'].includes(d)),
        LICNE_PORUKE: true,
    };
};

export const getEfektivnaPravilaZaKorisnika = (user, pravilaMapa = null) => {
    const defaults = getPodrazumijevanaPravilaZaKorisnika(user);
    const custom = getPraviloKorisnika(user, pravilaMapa);
    if (!custom || typeof custom !== 'object') return defaults;
    const merged = { ...defaults };
    NOTIF_KATEGORIJE.forEach((cat) => {
        if (typeof custom[cat.id] === 'boolean') {
            merged[cat.id] = custom[cat.id];
        }
    });
    return merged;
};

export const normalizujModulKljuc = (modulIme) => {
    const raw = normText(modulIme);
    if (!raw || raw === 'home' || raw === 'dashboard') return 'home';
    if (raw === 'radni_nalozi' || raw === 'radni_nalog' || raw === 'nalozi') return 'radni_nalog';
    if (raw === 'hr' || raw === 'hr_modul' || raw === 'hr dashboard') return 'hr_modul';
    if (raw === 'toranj' || raw === 'forenzika' || raw === 'kontrolni toranj') return 'forenzika';
    if (raw === 'nadzor' || raw === 'nadzorni centar') return 'nadzor';
    if (raw === 'postavke' || raw === 'podesavanja' || raw === 'podešavanja') return 'podesavanja';
    if (raw === 'lager_paketa' || raw === 'lager') return 'lager';
    if (MODUL_META[raw]) return raw;
    return raw;
};

export const getNazivModula = (modulIme) => {
    const k = normalizujModulKljuc(modulIme);
    return MODUL_META[k]?.naziv || (modulIme ? String(modulIme) : 'Sistem');
};

export const formatirajMetapodatkeNotifikacije = (detaljiTekst, meta = null) => {
    const cistTekst = String(detaljiTekst || '').replace(META_REGEX, '').trim();
    if (!meta || typeof meta !== 'object') return cistTekst;
    const cleanedMeta = {};
    Object.keys(meta).forEach((k) => {
        if (meta[k] !== undefined && meta[k] !== null && meta[k] !== '') {
            cleanedMeta[k] = meta[k];
        }
    });
    if (Object.keys(cleanedMeta).length === 0) return cistTekst;
    return `${cistTekst} [[META:${JSON.stringify(cleanedMeta)}]]`;
};

export const parsirajMetapodatkeNotifikacije = (logOrDetalji) => {
    const raw = typeof logOrDetalji === 'string' ? logOrDetalji : String(logOrDetalji?.detalji || '');
    const match = raw.match(META_REGEX);
    if (!match) {
        return { cleanDetalji: raw, meta: {} };
    }
    let meta = {};
    try {
        meta = JSON.parse(match[1]) || {};
    } catch (e) {
        meta = {};
    }
    const cleanDetalji = raw.replace(META_REGEX, '').trim();
    return { cleanDetalji, meta };
};

export const ocistiTekstDetalja = (detalji) => parsirajMetapodatkeNotifikacije(detalji).cleanDetalji;

export const odrediModuleNotifikacije = (log) => {
    if (!log) return [];
    const { cleanDetalji, meta } = parsirajMetapodatkeNotifikacije(log);

    if (meta.moduli && Array.isArray(meta.moduli) && meta.moduli.length > 0) {
        return Array.from(new Set(meta.moduli.map(normalizujModulKljuc)));
    }
    if (meta.modul) {
        return [normalizujModulKljuc(meta.modul)];
    }

    const akc = String(log.akcija || '').toUpperCase();
    const det = String(cleanDetalji || '').toUpperCase();
    const moduli = new Set();

    if (akc.includes('TRAŽI_ODOBRENJE_PONUDE') || akc.includes('ODOBRENA_IZMJENA_PONUDE') || akc.includes('ALARM_PONUDE')) {
        moduli.add('ponude');
        if (det.includes('RN-') || det.includes('RADNI NALOG')) moduli.add('radni_nalog');
        return Array.from(moduli);
    }

    if (akc.includes('REKLAMACIJ')) moduli.add('reklamacije');
    if (akc.includes('ODMOR') || akc.includes('ODSUSTV') || akc.includes('BOLOVANJ') || akc.includes('RADNOG_VREMENA') || akc.includes('SMJEN') || akc.startsWith('HR_')) {
        moduli.add('hr_modul');
    }
    if (akc.includes('KASA') || akc.includes('BLAGAJN') || akc.includes('UPLAT') || akc.includes('ISPLAT')) {
        moduli.add('blagajna');
    }
    if (akc.includes('OTPREMNIC') || akc.includes('OTPREM') || akc.includes('UTOVAR') || akc.includes('IZDATNIC')) {
        moduli.add('otpremnice');
    }
    if (akc.includes('RAČUN') || akc.includes('RACUN') || akc.includes('FAKTUR')) {
        moduli.add('racuni');
    }
    if (akc.includes('PONUD') || akc.includes('RABAT')) {
        moduli.add('ponude');
    }
    if (akc.includes('_RN') || akc.endsWith('RN') || akc.includes('RADNI_NALOG') || akc.includes('NALOG')) {
        moduli.add('radni_nalog');
    }
    if (akc.includes('DORADA')) moduli.add('dorada');
    if (akc.includes('PROREZ')) moduli.add('prorez');
    if (akc.includes('PRIJEM') || akc.includes('TRUPAC') || akc.includes('TRUPCA') || akc.includes('SUMARIJ')) moduli.add('prijem');
    if (akc.includes('PLANIRANJ') || akc.includes('RASPORED') || akc.includes('TEHNOLOGIJ') || akc.includes('DNEVNIK_MASINE')) moduli.add('planiranje');
    if (akc.includes('LAGER') || akc.includes('PAKET_RASTUREN') || akc.includes('OTKLJUČAN_PAKET') || akc.includes('OTKLJUCAN_PAKET') || akc.includes('OBRISAN_PAKET')) moduli.add('lager');
    if (!akc.includes('DORADA') && (akc.includes('PILANA') || akc.includes('ZAKLJUČEN_PAKET') || akc.includes('ZAKLJUCEN_PAKET') || akc.includes('DODANA_STAVKA_U_PAKET') || akc.includes('IZMJENA_U_PAKETU'))) {
        moduli.add('pilana');
    }
    if (akc.includes('KUPCA') || akc.includes('KATALOG') || akc.includes('MASIN') || akc.includes('PREVOZNIK') || akc.includes('PODRUZNIC') || akc.includes('PROIZVOD') || akc.includes('MASOVNA_IZMJENA') || akc.includes('RADNIK') || akc.includes('BRENDING') || akc.includes('POSTAVK')) {
        moduli.add('podesavanja');
    }
    if (akc.includes('ANALITIK') || akc.includes('IZVJESTAJ')) moduli.add('analitika');

    if (moduli.size === 0) {
        if (/\bPON-[A-Z0-9-]+/.test(det)) moduli.add('ponude');
        if (/\bRN-[A-Z0-9-]+/.test(det)) moduli.add('radni_nalog');
        if (/\bOTP-[A-Z0-9-]+/.test(det)) moduli.add('otpremnice');
        if (/\bRAC-[A-Z0-9-]+/.test(det)) moduli.add('racuni');
        if (/\bKASA-[A-Z0-9-]+/.test(det)) moduli.add('blagajna');
        if (/\bTR-[A-Z0-9-]+/.test(det)) moduli.add('prijem');
        if (/\bPK-[A-Z0-9-]+/.test(det)) moduli.add('lager');
    }

    return Array.from(moduli);
};

export const odrediKategorijuNotifikacije = (log) => {
    if (!log) return 'PROIZVODNJA_LAGER';
    const { meta } = parsirajMetapodatkeNotifikacije(log);
    if (meta.target_user || meta.target_username) return 'LICNE_PORUKE';
    if (meta.kategorija) return meta.kategorija;

    const akc = String(log.akcija || '').toUpperCase();
    if (akc.includes('RABAT')) return 'PONUDE_RABAT';
    if (akc.includes('TRAŽI_ODOBRENJE_PONUDE') || akc.includes('ALARM_PONUDE') || akc.includes('ODOBRENA_IZMJENA_PONUDE') || meta.approval_type === 'ODOBRENJE_PONUDE') {
        return 'PONUDE_ODOBRENJE';
    }
    if (akc.includes('REKLAMACIJ') || meta.approval_type === 'REKLAMACIJA') return 'REKLAMACIJE';
    if (akc.includes('ODMOR') || akc.includes('ODSUSTV') || akc.includes('RADNOG_VREMENA') || meta.approval_type === 'ZAHTJEV_ODMOR') {
        return 'HR_ODMOR';
    }
    if (akc.includes('KASA') || akc.includes('BLAGAJN') || akc.includes('UPLAT')) return 'BLAGAJNA_ALARM';
    if (akc.includes('OTPREM') || akc.includes('UTOVAR') || akc.includes('IZDATNIC')) return 'OTPREMNICE_ALARM';

    const moduli = odrediModuleNotifikacije(log);
    if (moduli.includes('reklamacije')) return 'REKLAMACIJE';
    if (moduli.includes('hr_modul')) return 'HR_ODMOR';
    if (moduli.includes('blagajna')) return 'BLAGAJNA_ALARM';
    if (moduli.includes('otpremnice')) return 'OTPREMNICE_ALARM';
    if (moduli.includes('ponude')) return 'PONUDE_RABAT';
    return 'PROIZVODNJA_LAGER';
};

export const daLiPripadaModulu = (log, modulIme) => {
    const kljuc = normalizujModulKljuc(modulIme);
    if (!kljuc || kljuc === 'home' || kljuc === 'nadzor' || kljuc === 'forenzika') {
        return true;
    }
    const moduli = odrediModuleNotifikacije(log);
    return moduli.includes(kljuc);
};

export const daLiKorisnikImaDozvoluZaModul = (user, modulKey) => {
    if (!user) return false;
    const kljuc = normalizujModulKljuc(modulKey);
    if (kljuc === 'nadzor') return user.uloga === 'superadmin';
    if (user.uloga === 'superadmin' || user.uloga === 'admin') return true;
    if (kljuc === 'home') return true;
    const dozvole = Array.isArray(user.dozvole) ? user.dozvole : [];
    if (kljuc === 'planiranje') {
        return dozvole.includes('Planiranje Proizvodnje') || dozvole.includes('Planiranje (Samo Pregled)');
    }
    const meta = MODUL_META[kljuc];
    if (!meta?.dozvola) return false;
    return dozvole.includes(meta.dozvola);
};

export const daLiJeLicnaNotifikacija = (log) => {
    const { meta } = parsirajMetapodatkeNotifikacije(log);
    return Boolean(meta.target_user || meta.target_username);
};

export const daLiJeLicnaNotifikacijaZaKorisnika = (log, user) => {
    if (!log || !user) return false;
    const { meta } = parsirajMetapodatkeNotifikacije(log);
    if (!meta.target_user && !meta.target_username) return false;

    const uIme = normText(user.ime_prezime);
    const uUser = normText(user.username);
    const tIme = normText(meta.target_user);
    const tUser = normText(meta.target_username);

    if (tIme && (uIme === tIme || (uUser && uUser === tIme))) return true;
    if (tUser && (uUser === tUser || (uIme && uIme === tUser))) return true;
    return false;
};

export const daLiJeNotifikacijaZaKorisnika = (log, user, pravilaMapaOverride = null) => {
    if (!log || !user || (!user.ime_prezime && !user.username)) return false;
    const { meta } = parsirajMetapodatkeNotifikacije(log);
    const praviloKorisnika = getPraviloKorisnika(user, pravilaMapaOverride);

    // 1. Lično adresirane notifikacije -> vidi ISKLJUČIVO taj korisnik (osim ako mu admin eksplicitno nije isključio LICNE_PORUKE)
    if (meta.target_user || meta.target_username) {
        if (!daLiJeLicnaNotifikacijaZaKorisnika(log, user)) return false;
        if (praviloKorisnika && praviloKorisnika.LICNE_PORUKE === false) return false;
        return true;
    }

    // 2. Samo aktivni alarmi (CRVENO/ŽUTO) ili eksplicitni zahtjevi za odobrenje idu u zvonce/push
    const jeAlarmIliZahtjev =
        log.nivo_alarma === 'CRVENO' ||
        log.nivo_alarma === 'ŽUTO' ||
        Boolean(meta.approval_type) ||
        Boolean(meta.target_permission) ||
        Boolean(meta.target_role);

    if (!jeAlarmIliZahtjev) return false;

    // 3. Eksplicitno ograničenje uloge (npr. samo superadmin)
    if (meta.target_role) {
        const roles = Array.isArray(meta.target_role) ? meta.target_role : [meta.target_role];
        if (!roles.map(normText).includes(normText(user.uloga))) return false;
    }

    // 4. MATRICA PRAVILA OBAVJEŠTENJA PO KORISNIKU (ima prioritet iznad dozvola modula!)
    // Ako je admin u matrici stavio kvačicu OFF -> korisnik NE vidi obavijest bez obzira što ima pristup modulu!
    // Ako je admin u matrici stavio kvačicu ON -> korisnik VIDI ovu kategoriju obavijesti!
    const kategorija = odrediKategorijuNotifikacije(log);
    if (praviloKorisnika && typeof praviloKorisnika[kategorija] === 'boolean') {
        return praviloKorisnika[kategorija];
    }

    // 5. Podrazumijevano (ako za korisnika nije postavljena posebna matrica):
    if (user.uloga === 'superadmin' || user.uloga === 'admin') {
        return true;
    }

    const dozvole = Array.isArray(user.dozvole) ? user.dozvole : [];
    if (meta.target_permission) {
        return dozvole.includes(meta.target_permission);
    }

    const moduli = odrediModuleNotifikacije(log);
    if (moduli.length === 0) return false;
    return moduli.some((m) => daLiKorisnikImaDozvoluZaModul(user, m));
};

export const daLiKorisnikMozeOdobriti = (approvalType, user, pravilaMapaOverride = null) => {
    if (!user || !approvalType) return false;
    const pravilo = getPraviloKorisnika(user, pravilaMapaOverride);

    if (approvalType === 'ZAHTJEV_ODMOR') {
        if (pravilo && typeof pravilo.HR_ODMOR === 'boolean') return pravilo.HR_ODMOR;
        if (user.uloga === 'superadmin' || user.uloga === 'admin') return true;
        return (user.dozvole || []).includes('HR Dashboard');
    }
    if (approvalType === 'REKLAMACIJA') {
        if (pravilo && typeof pravilo.REKLAMACIJE === 'boolean') return pravilo.REKLAMACIJE;
        if (user.uloga === 'superadmin' || user.uloga === 'admin') return true;
        return (user.dozvole || []).includes('Reklamacije i Povrati');
    }
    if (approvalType === 'ODOBRENJE_PONUDE') {
        if (pravilo && typeof pravilo.PONUDE_ODOBRENJE === 'boolean') return pravilo.PONUDE_ODOBRENJE;
        if (user.uloga === 'superadmin' || user.uloga === 'admin') return true;
        return (user.dozvole || []).includes('Ponude');
    }
    return false;
};

export const izvuciEntiteteNotifikacije = (log) => {
    const { cleanDetalji, meta } = parsirajMetapodatkeNotifikacije(log);
    const tekst = `${log?.akcija || ''} ${cleanDetalji || ''}`;

    const findAll = (regex) => {
        const res = [];
        let m;
        const r = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
        while ((m = r.exec(tekst)) !== null) {
            const cleaned = m[0].replace(/[.,;:!?)]+$/, '');
            if (cleaned && !res.includes(cleaned)) res.push(cleaned);
        }
        return res;
    };

    const ponude = findAll(/\bPON-[A-Za-z0-9_-]+/g);
    const nalozi = findAll(/\bRN-[A-Za-z0-9_-]+/g);
    const otpremnice = findAll(/\bOTP-[A-Za-z0-9_-]+/g);
    const racuni = findAll(/\bRAC-[A-Za-z0-9_-]+/g);
    const kase = findAll(/\bKASA-[A-Za-z0-9_-]+/g);
    const paketi = findAll(/\b(?:PK|PAK|PAKET)-[A-Za-z0-9_-]+/gi);
    const trupci = findAll(/\bTR-[A-Za-z0-9_-]+/g);
    const customTestIds = findAll(/\b(?:QA|E2E)[A-Za-z0-9_-]{3,}/g);

    const paketMatch = cleanDetalji.match(/paket[a]?\s+([A-Za-z0-9_-]{3,})/i);
    if (paketMatch && paketMatch[1] && !paketi.includes(paketMatch[1])) paketi.push(paketMatch[1]);
    const ponudaMatch = cleanDetalji.match(/ponud[aei]\s+([A-Za-z0-9_-]{3,})/i);
    if (ponudaMatch && ponudaMatch[1] && !ponude.includes(ponudaMatch[1])) ponude.push(ponudaMatch[1]);
    const rnMatch = cleanDetalji.match(/(?:radni\s+nalog|nalog)\s+([A-Za-z0-9_-]{3,})/i);
    if (rnMatch && rnMatch[1] && !nalozi.includes(rnMatch[1])) nalozi.push(rnMatch[1]);

    const entityId = meta.entity_id || ponude[0] || nalozi[0] || otpremnice[0] || racuni[0] || paketi[0] || trupci[0] || kase[0] || customTestIds[0] || null;
    const allTokens = Array.from(new Set([
        ...(meta.entity_id ? [String(meta.entity_id)] : []),
        ...(meta.rn_id ? [String(meta.rn_id)] : []),
        ...(meta.paket_id ? [String(meta.paket_id)] : []),
        ...ponude, ...nalozi, ...otpremnice, ...racuni, ...paketi, ...trupci, ...kase, ...customTestIds,
    ].filter((t) => t && t.length >= 3)));

    let approvalType = meta.approval_type || null;
    const akc = String(log?.akcija || '').toUpperCase();
    if (!approvalType) {
        if (akc === 'TRAŽI_ODOBRENJE_PONUDE') approvalType = 'ODOBRENJE_PONUDE';
        else if (akc === 'NOVA_REKLAMACIJA') approvalType = 'REKLAMACIJA';
        else if (akc === 'ZAHTJEV_ODMOR') approvalType = 'ZAHTJEV_ODMOR';
    }

    return {
        ponudaId: (meta.entity_type === 'ponuda' && meta.entity_id) || ponude[0] || null,
        rnId: meta.rn_id || nalozi[0] || null,
        otpremnicaId: otpremnice[0] || null,
        racunId: racuni[0] || null,
        paketId: meta.paket_id || paketi[0] || null,
        trupacId: trupci[0] || null,
        kasaId: kase[0] || null,
        zahtjevId: meta.approval_type === 'ZAHTJEV_ODMOR' || meta.entity_type === 'zahtjev_odsustva' ? (meta.approval_id || meta.entity_id || null) : null,
        reklamacijaId: meta.approval_type === 'REKLAMACIJA' || meta.entity_type === 'reklamacija' ? (meta.approval_id || null) : null,
        radnikIme: meta.radnik_ime || meta.target_user || null,
        primaryId: entityId,
        allTokens,
        approvalType,
        meta,
        cleanDetalji,
    };
};

const getReadStorageKey = (user) => {
    const idPart = normText(user?.id || user?.username || user?.ime_prezime || 'anon').replace(/[^a-z0-9_-]/g, '_');
    return `erp_notif_read_${idPart}`;
};

export const getLokalnoProcitaneIds = (user) => {
    if (typeof window === 'undefined' || !user) return new Set();
    try {
        const raw = localStorage.getItem(getReadStorageKey(user));
        const parsed = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch (e) {
        return new Set();
    }
};

export const oznaciLokalnoProcitano = (user, ids = []) => {
    if (typeof window === 'undefined' || !user || !ids.length) return;
    try {
        const current = getLokalnoProcitaneIds(user);
        ids.forEach((id) => current.add(String(id)));
        const trimmed = Array.from(current).slice(-400);
        localStorage.setItem(getReadStorageKey(user), JSON.stringify(trimmed));
    } catch (e) {}
};

export const daLiJeProcitanoZaKorisnika = (log, user) => {
    if (!log) return true;
    if (log.pregledano === true) return true;
    const lokalne = getLokalnoProcitaneIds(user);
    return lokalne.has(String(log.id));
};

export const oznaciNotifikacijuProcitanom = async (notif, user) => {
    if (!notif?.id) return { error: null };
    const isAdminOrSuper = user?.uloga === 'superadmin' || user?.uloga === 'admin';
    const isPersonal = daLiJeLicnaNotifikacijaZaKorisnika(notif, user);

    oznaciLokalnoProcitano(user, [notif.id]);

    let error = null;
    if (isAdminOrSuper || isPersonal) {
        const res = await supabase.from('sistem_audit_log').update({ pregledano: true }).eq('id', notif.id);
        error = res.error || null;
    }

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notifikacije_updated'));
    }
    return { error };
};

export const oznaciNotifikacijeProcitanim = async (notifs, user) => {
    if (!Array.isArray(notifs) || notifs.length === 0) return { error: null };
    const isAdminOrSuper = user?.uloga === 'superadmin' || user?.uloga === 'admin';

    oznaciLokalnoProcitano(user, notifs.map((n) => n.id));

    const dbIds = notifs
        .filter((n) => isAdminOrSuper || daLiJeLicnaNotifikacijaZaKorisnika(n, user))
        .map((n) => n.id);

    let error = null;
    if (dbIds.length > 0) {
        const res = await supabase.from('sistem_audit_log').update({ pregledano: true }).in('id', dbIds);
        error = res.error || null;
    }

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notifikacije_updated'));
    }
    return { error };
};

export const ucitajNotifikacijeZaKorisnika = async (user, modulIme = null, { includeRead = false, limit = 60 } = {}) => {
    if (!user || (!user.ime_prezime && !user.username)) return [];

    const [pravilaMapa, logRes] = await Promise.all([
        ucitajPravilaNotifikacija(false),
        (() => {
            let query = supabase
                .from('sistem_audit_log')
                .select('*')
                .order('vrijeme', { ascending: false })
                .limit(180);
            if (!includeRead) query = query.eq('pregledano', false);
            return query;
        })(),
    ]);

    const { data, error } = logRes;
    if (error || !Array.isArray(data)) return [];

    const filtered = data.filter((log) => {
        if (!daLiJeNotifikacijaZaKorisnika(log, user, pravilaMapa)) return false;
        if (modulIme && !daLiPripadaModulu(log, modulIme)) return false;
        if (!includeRead && daLiJeProcitanoZaKorisnika(log, user)) return false;
        return true;
    });

    return filtered.slice(0, limit);
};

export const posaljiNotifikaciju = async ({ korisnik, akcija, detalji, nivo_alarma = 'INFO', meta = null, pregledano = null }) => {
    const imaTarget = Boolean(meta?.target_user || meta?.target_username);
    const defaultPregledano = pregledano !== null ? Boolean(pregledano) : (nivo_alarma === 'INFO' && !imaTarget);
    const payload = {
        korisnik: korisnik || 'Sistem',
        akcija,
        detalji: formatirajMetapodatkeNotifikacije(detalji, meta),
        nivo_alarma,
        pregledano: defaultPregledano,
        vrijeme: new Date().toISOString(),
    };
    const res = await supabase.from('sistem_audit_log').insert([payload]).select('*');
    if (typeof window !== 'undefined' && !res.error) {
        window.dispatchEvent(new CustomEvent('notifikacije_updated'));
    }
    return res;
};

/**
 * Automatski označava sva povezana nepročitana obavještenja / zahtjeve kao pročitana (pregledano: true)
 * čim korisnik odobri, odbije ili riješi problem (bilo iz modula ili iz modala obavještenja).
 */
export const oznacPovezaneNotifikacijeRijesenim = async ({ akcije = [], tokeni = [] } = {}) => {
    try {
        const cleanTokens = Array.from(new Set((tokeni || []).map((t) => String(t || '').trim().toLowerCase()).filter((t) => t.length >= 2)));
        if (!akcije.length && !cleanTokens.length) return { count: 0 };

        let query = supabase
            .from('sistem_audit_log')
            .select('id, akcija, detalji')
            .eq('pregledano', false)
            .order('vrijeme', { ascending: false })
            .limit(120);

        if (akcije.length > 0) {
            query = query.in('akcija', akcije);
        }

        const { data } = await query;
        const matchedIds = (data || [])
            .filter((row) => {
                if (cleanTokens.length === 0) return true;
                const haystack = `${row.akcija || ''} ${row.detalji || ''}`.toLowerCase();
                return cleanTokens.some((tok) => haystack.includes(tok));
            })
            .map((r) => r.id);

        if (matchedIds.length > 0) {
            await supabase.from('sistem_audit_log').update({ pregledano: true }).in('id', matchedIds);
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('notifikacije_updated'));
            }
        }
        return { count: matchedIds.length };
    } catch (e) {
        return { count: 0 };
    }
};
