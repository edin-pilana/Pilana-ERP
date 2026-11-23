import { supabase } from './supabaseClient';

export const VAPID_PUBLIC_KEY =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    'BJRf2oT1LU0KAfUPwUneHkN_NVGy5H0fEh9qLYp-Y0CAZK4ewv_kQl8KGwzEi2ANHyWgb63qfi5LZlC1ysj3mQU';

export const PUSH_PREF_KEY = 'push_pretplate';

export const getUserStorageKey = (user) => {
    const raw = String(user?.username || user?.ime_prezime || '').trim().toLowerCase();
    return raw || null;
};

export const detektujTipUredjaja = () => {
    if (typeof navigator === 'undefined') return 'desktop';
    const ua = navigator.userAgent || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
        (typeof window !== 'undefined' && window.innerWidth < 768);
    return isMobile ? 'mobile' : 'desktop';
};

export const getOpisUredjaja = () => {
    if (typeof navigator === 'undefined') return 'Uređaj';
    const ua = navigator.userAgent || '';
    const tip = detektujTipUredjaja() === 'mobile' ? 'Mobitel' : 'Računar';
    let os = '';
    if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Mac OS/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua)) os = 'Linux';

    let browser = '';
    if (/Edg\//i.test(ua)) browser = 'Edge';
    else if (/Chrome\//i.test(ua)) browser = 'Chrome';
    else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
    else if (/Firefox\//i.test(ua)) browser = 'Firefox';

    return [tip, os, browser].filter(Boolean).join(' • ');
};

const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

export const jePushPodrzan = () => {
    if (typeof window === 'undefined') return false;
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
};

const ucitajSvePretplate = async () => {
    const { data } = await supabase
        .from('ui_postavke')
        .select('postavke_jsonb')
        .eq('modul_ime', PUSH_PREF_KEY)
        .maybeSingle();
    return (data?.postavke_jsonb && typeof data.postavke_jsonb === 'object') ? data.postavke_jsonb : {};
};

const spasiSvePretplate = async (mapa) => {
    return supabase
        .from('ui_postavke')
        .upsert([{ modul_ime: PUSH_PREF_KEY, postavke_jsonb: mapa }], { onConflict: 'modul_ime' });
};

const getActiveSwRegistration = async () => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
    try {
        const direct = await navigator.serviceWorker.getRegistration('/');
        if (direct) return direct;
        const all = await navigator.serviceWorker.getRegistrations();
        return all.find((r) => r?.active?.scriptURL?.includes('/sw.js')) || all[0] || null;
    } catch (e) {
        return null;
    }
};

const arraysEqual = (a, b) => {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) return false;
    }
    return true;
};

/**
 * Suptilan Web Audio zvučni signal (bez vanjskih audio fajlova) kada stigne novo obavještenje.
 */
export const svirajZvukNotifikacije = (urgent = false) => {
    if (typeof window === 'undefined') return;
    try {
        if (localStorage.getItem('erp_notif_sound') === 'off') return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;
        const freqs = urgent ? [880, 1174.66, 1318.5] : [659.25, 880];
        freqs.forEach((f, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, now + idx * 0.11);
            gain.gain.setValueAtTime(0.0001, now + idx * 0.11);
            gain.gain.exponentialRampToValueAtTime(0.09, now + idx * 0.11 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 0.22);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.11);
            osc.stop(now + idx * 0.11 + 0.24);
        });
        setTimeout(() => { try { ctx.close(); } catch (e) {} }, 800);
    } catch (e) {}
};

/**
 * Registruje (ili ažurira) Web Push pretplatu za trenutno prijavljenog korisnika.
 * Čuva ZADNJI prijavljeni računar (`desktop`) i ZADNJI prijavljeni mobitel (`mobile`) po korisniku.
 * Ako je isti browser endpoint ranije pripadao drugom korisniku, automatski ga sklanja sa starog profila!
 */
export const aktivirajPushNaUredjaju = async (user, { silentIfDenied = false } = {}) => {
    const userKey = getUserStorageKey(user);
    if (!userKey) return { ok: false, reason: 'no_user' };
    if (!jePushPodrzan()) return { ok: false, reason: 'unsupported' };

    let permission = Notification.permission;
    if (permission === 'default' && !silentIfDenied) {
        permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
        return { ok: false, reason: permission === 'denied' ? 'denied' : 'not_granted' };
    }

    try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;

        const expectedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        let sub = await reg.pushManager.getSubscription();
        if (sub?.options?.applicationServerKey) {
            const currentKey = new Uint8Array(sub.options.applicationServerKey);
            if (!arraysEqual(currentKey, expectedKey)) {
                await sub.unsubscribe().catch(() => {});
                sub = null;
            }
        }
        if (!sub) {
            sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: expectedKey,
            });
        }

        const subJson = sub.toJSON();
        const endpoint = subJson?.endpoint;
        if (!endpoint) return { ok: false, reason: 'no_endpoint' };

        const deviceType = detektujTipUredjaja();
        const deviceLabel = getOpisUredjaja();
        const sve = await ucitajSvePretplate();

        // Ukloni ovaj isti browser endpoint sa bilo kojeg drugog korisnika (stroga izolacija pri promjeni profila!)
        Object.keys(sve).forEach((k) => {
            if (k === userKey) return;
            const entry = sve[k];
            if (entry?.desktop?.subscription?.endpoint === endpoint) delete entry.desktop;
            if (entry?.mobile?.subscription?.endpoint === endpoint) delete entry.mobile;
        });

        const korisnikEntry = {
            ...(sve[userKey] || {}),
            ime_prezime: user.ime_prezime || user.username,
            username: user.username || '',
            uloga: user.uloga || 'operater',
            [deviceType]: {
                subscription: subJson,
                label: deviceLabel,
                updated_at: new Date().toISOString(),
            },
        };

        sve[userKey] = korisnikEntry;
        const { error } = await spasiSvePretplate(sve);
        if (error) return { ok: false, reason: error.message };

        return {
            ok: true,
            deviceType,
            deviceLabel,
            devices: {
                desktop: korisnikEntry.desktop?.label || null,
                mobile: korisnikEntry.mobile?.label || null,
            },
        };
    } catch (err) {
        return { ok: false, reason: err?.message || 'push_error' };
    }
};

/**
 * Uklanja ovaj uređaj iz push pretplata (npr. pri odjavi ili kad korisnik isključi push).
 */
export const ukloniPushSaOvogUredjaja = async (user = null) => {
    if (!jePushPodrzan()) return { ok: true };
    try {
        const reg = await getActiveSwRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        const endpoint = sub?.endpoint;

        if (endpoint) {
            const sve = await ucitajSvePretplate();
            let changed = false;
            Object.keys(sve).forEach((k) => {
                if (user && k !== getUserStorageKey(user)) return;
                if (sve[k]?.desktop?.subscription?.endpoint === endpoint) {
                    delete sve[k].desktop;
                    changed = true;
                }
                if (sve[k]?.mobile?.subscription?.endpoint === endpoint) {
                    delete sve[k].mobile;
                    changed = true;
                }
            });
            if (changed) await spasiSvePretplate(sve);
        }

        if (sub) await sub.unsubscribe().catch(() => {});
        return { ok: true };
    } catch (e) {
        return { ok: false, reason: e?.message };
    }
};

export const provjeriPushStatusKorisnika = async (user) => {
    const userKey = getUserStorageKey(user);
    const supported = jePushPodrzan();
    const permission = supported ? Notification.permission : 'unsupported';
    let thisDeviceActive = false;
    let desktopLabel = null;
    let mobileLabel = null;

    if (userKey) {
        try {
            const sve = await ucitajSvePretplate();
            const entry = sve[userKey];
            desktopLabel = entry?.desktop?.label || null;
            mobileLabel = entry?.mobile?.label || null;

            if (supported && permission === 'granted') {
                const reg = await getActiveSwRegistration();
                const sub = reg ? await reg.pushManager.getSubscription() : null;
                if (sub?.endpoint) {
                    thisDeviceActive =
                        entry?.desktop?.subscription?.endpoint === sub.endpoint ||
                        entry?.mobile?.subscription?.endpoint === sub.endpoint;
                }
            }
        } catch (e) {}
    }

    return {
        supported,
        permission,
        thisDeviceActive,
        deviceType: detektujTipUredjaja(),
        desktopLabel,
        mobileLabel,
    };
};

export const posaljiTestnuPushNotifikaciju = async (user) => {
    const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            testOnly: true,
            targetUser: user?.username || user?.ime_prezime,
            targetName: user?.ime_prezime || user?.username,
        }),
    });
    return res.json();
};

/**
 * End-to-end test cijelog kanala obavještenja (In-App zvonce + Zvuk + Browser notifikacija + Pozadinski Web Push).
 */
export const posaljiKompletnoTestObavjestenje = async (user) => {
    const userName = user?.ime_prezime || user?.username || 'Korisnik';
    const meta = {
        target_user: userName,
        target_username: user?.username || '',
        entity_type: 'test_notif',
    };
    const detalji = `Testno obavještenje za ${userName} (${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}) — In-App zvonce, zvuk i push kanal su povezani. [[META:${JSON.stringify(meta)}]]`;

    const { data: inserted, error: insertError } = await supabase
        .from('sistem_audit_log')
        .insert([{
            korisnik: userName,
            akcija: 'TEST_OBAVJESTENJA',
            nivo_alarma: 'ŽUTO',
            detalji,
            pregledano: false,
        }])
        .select('*')
        .maybeSingle();

    let pushRes = { ok: false, sent: 0 };
    try {
        pushRes = await posaljiTestnuPushNotifikaciju(user);
    } catch (e) {
        pushRes = { ok: false, sent: 0, error: e?.message };
    }

    return {
        ok: !insertError,
        inserted,
        insertError: insertError?.message || null,
        pushRes,
    };
};
