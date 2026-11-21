import { supabase } from './supabaseClient';

const META_REGEX = /\s*\[\[META:(\{[\s\S]*?\})\]\]\s*$/;

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

    // Specifični međumodulni slučajevi
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
    if (akc.includes('DORADA')) {
        moduli.add('dorada');
    }
    if (akc.includes('PROREZ')) {
        moduli.add('prorez');
    }
    if (akc.includes('PRIJEM') || akc.includes('TRUPAC') || akc.includes('TRUPCA') || akc.includes('SUMARIJ')) {
        moduli.add('prijem');
    }
    if (akc.includes('PLANIRANJ') || akc.includes('RASPORED') || akc.includes('TEHNOLOGIJ') || akc.includes('DNEVNIK_MASINE')) {
        moduli.add('planiranje');
    }
    if (akc.includes('LAGER') || akc.includes('PAKET_RASTUREN') || akc.includes('OTKLJUČAN_PAKET') || akc.includes('OTKLJUCAN_PAKET') || akc.includes('OBRISAN_PAKET')) {
        moduli.add('lager');
    }
    if (!akc.includes('DORADA') && (akc.includes('PILANA') || akc.includes('ZAKLJUČEN_PAKET') || akc.includes('ZAKLJUCEN_PAKET') || akc.includes('DODANA_STAVKA_U_PAKET') || akc.includes('IZMJENA_U_PAKETU'))) {
        moduli.add('pilana');
    }
    if (akc.includes('KUPCA') || akc.includes('KATALOG') || akc.includes('MASIN') || akc.includes('PREVOZNIK') || akc.includes('PODRUZNIC') || akc.includes('PROIZVOD') || akc.includes('MASOVNA_IZMJENA') || akc.includes('RADNIK') || akc.includes('BRENDING') || akc.includes('POSTAVK')) {
        moduli.add('podesavanja');
    }
    if (akc.includes('ANALITIK') || akc.includes('IZVJESTAJ')) {
        moduli.add('analitika');
    }

    // Fallback preko ID prefiksa u tekstu detalja ako akcija nije bila dovoljna
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

export const daLiPripadaModulu = (log, modulIme) => {
    const kljuc = normalizujModulKljuc(modulIme);
    // Globalni pogledi (početna, Nadzorni Centar, Kontrolni Toranj) prikazuju sva dozvoljena obavještenja korisnika
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

export const daLiJeNotifikacijaZaKorisnika = (log, user) => {
    if (!log || !user || (!user.ime_prezime && !user.username)) return false;
    const { meta } = parsirajMetapodatkeNotifikacije(log);

    // 1. Ako je notifikacija LIČNO adresirana na određenog korisnika -> vidi je ISKLJUČIVO taj korisnik!
    if (meta.target_user || meta.target_username) {
        return daLiJeLicnaNotifikacijaZaKorisnika(log, user);
    }

    // 2. U suprotnom, samo aktivni alarmi (CRVENO/ŽUTO) ili eksplicitni zahtjevi za odobrenje idu u zvonce
    const jeAlarmIliZahtjev =
        log.nivo_alarma === 'CRVENO' ||
        log.nivo_alarma === 'ŽUTO' ||
        Boolean(meta.approval_type) ||
        Boolean(meta.target_permission) ||
        Boolean(meta.target_role);

    if (!jeAlarmIliZahtjev) return false;

    // 3. Ako postoji eksplicitno ograničenje uloge (npr. samo superadmin)
    if (meta.target_role) {
        const roles = Array.isArray(meta.target_role) ? meta.target_role : [meta.target_role];
        if (!roles.map(normText).includes(normText(user.uloga))) return false;
    }

    // 4. Admin i Superadmin vide sistemske/modulne alarme i zahtjeve za odobrenje
    if (user.uloga === 'superadmin' || user.uloga === 'admin') {
        return true;
    }

    // 5. Obični korisnici (operater / manager) vide modulne alarme / odobrenja SAMO ako imaju eksplicitnu dozvolu!
    const dozvole = Array.isArray(user.dozvole) ? user.dozvole : [];
    if (meta.target_permission) {
        return dozvole.includes(meta.target_permission);
    }

    const moduli = odrediModuleNotifikacije(log);
    if (moduli.length === 0) return false;
    return moduli.some((m) => daLiKorisnikImaDozvoluZaModul(user, m));
};

export const daLiKorisnikMozeOdobriti = (approvalType, user) => {
    if (!user || !approvalType) return false;
    if (user.uloga === 'superadmin' || user.uloga === 'admin') return true;
    const dozvole = Array.isArray(user.dozvole) ? user.dozvole : [];
    if (approvalType === 'ZAHTJEV_ODMOR') return dozvole.includes('HR Dashboard');
    if (approvalType === 'REKLAMACIJA') return dozvole.includes('Reklamacije i Povrati');
    if (approvalType === 'ODOBRENJE_PONUDE') return dozvole.includes('Ponude');
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

    // Pokušaj izvući naziv paketa iza riječi "paket " (npr. "paket 2026-001" ili "paket PK-123")
    const paketMatch = cleanDetalji.match(/paket[a]?\s+([A-Za-z0-9_-]{3,})/i);
    if (paketMatch && paketMatch[1] && !paketi.includes(paketMatch[1])) {
        paketi.push(paketMatch[1]);
    }
    const ponudaMatch = cleanDetalji.match(/ponud[aei]\s+([A-Za-z0-9_-]{3,})/i);
    if (ponudaMatch && ponudaMatch[1] && !ponude.includes(ponudaMatch[1])) {
        ponude.push(ponudaMatch[1]);
    }
    const rnMatch = cleanDetalji.match(/(?:radni\s+nalog|nalog)\s+([A-Za-z0-9_-]{3,})/i);
    if (rnMatch && rnMatch[1] && !nalozi.includes(rnMatch[1])) {
        nalozi.push(rnMatch[1]);
    }

    const entityId = meta.entity_id || ponude[0] || nalozi[0] || otpremnice[0] || racuni[0] || paketi[0] || trupci[0] || kase[0] || customTestIds[0] || null;
    const allTokens = Array.from(new Set([
        ...(meta.entity_id ? [String(meta.entity_id)] : []),
        ...(meta.rn_id ? [String(meta.rn_id)] : []),
        ...(meta.paket_id ? [String(meta.paket_id)] : []),
        ...ponude,
        ...nalozi,
        ...otpremnice,
        ...racuni,
        ...paketi,
        ...trupci,
        ...kase,
        ...customTestIds,
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

// Lokalno praćenje pročitanih za ne-admin korisnike (da ne brišu globalni admin alarm u Nadzornom Centru)
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

    // Dohvatamo zadnjih 150 relevantnih zapisa (i nepročitane alarme i lične notifikacije sa [[META:...)
    let query = supabase
        .from('sistem_audit_log')
        .select('*')
        .order('vrijeme', { ascending: false })
        .limit(180);

    if (!includeRead) {
        query = query.eq('pregledano', false);
    }

    const { data, error } = await query;
    if (error || !Array.isArray(data)) return [];

    const filtered = data.filter((log) => {
        if (!daLiJeNotifikacijaZaKorisnika(log, user)) return false;
        if (modulIme && !daLiPripadaModulu(log, modulIme)) return false;
        if (!includeRead && daLiJeProcitanoZaKorisnika(log, user)) return false;
        return true;
    });

    return filtered.slice(0, limit);
};

export const posaljiNotifikaciju = async ({ korisnik, akcija, detalji, nivo_alarma = 'INFO', meta = null }) => {
    const payload = {
        korisnik: korisnik || 'Sistem',
        akcija,
        detalji: formatirajMetapodatkeNotifikacije(detalji, meta),
        nivo_alarma,
        pregledano: false,
        vrijeme: new Date().toISOString(),
    };
    const res = await supabase.from('sistem_audit_log').insert([payload]).select('*');
    if (typeof window !== 'undefined' && !res.error) {
        window.dispatchEvent(new CustomEvent('notifikacije_updated'));
    }
    return res;
};
