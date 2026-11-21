import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    daLiJeNotifikacijaZaKorisnika,
    ocistiTekstDetalja,
    getNazivModula,
    odrediModuleNotifikacije,
    izvuciEntiteteNotifikacije,
} from '../../../utils/notificationHelpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://awaxwejrhmjeqohrgidm.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';

const VAPID_PUBLIC_KEY =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    'BJRf2oT1LU0KAfUPwUneHkN_NVGy5H0fEh9qLYp-Y0CAZK4ewv_kQl8KGwzEi2ANHyWgb63qfi5LZlC1ysj3mQU';
const VAPID_PRIVATE_KEY =
    process.env.VAPID_PRIVATE_KEY ||
    'yk7cC59MAOnvIYCTKL0aXsI5OqO1SShYem1U6Z9bJ34';

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@pilana-erp.local';

let cachedWebPush = null;
async function getWebPush() {
    if (cachedWebPush) return cachedWebPush;
    const mod = await import('web-push');
    const wp = mod?.default?.setVapidDetails ? mod.default : mod;
    wp.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    cachedWebPush = wp;
    return wp;
}

const norm = (v) => String(v || '').trim().toLowerCase();

export async function POST(request) {
    try {
        const body = await request.json();
        const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        const [pretplateRes, pravilaRes, radniciRes] = await Promise.all([
            sb.from('ui_postavke').select('postavke_jsonb').eq('modul_ime', 'push_pretplate').maybeSingle(),
            sb.from('ui_postavke').select('postavke_jsonb').eq('modul_ime', 'notifikacije_pravila').maybeSingle(),
            sb.from('radnici').select('id, ime_prezime, username, uloga, dozvole'),
        ]);

        const pretplate = (pretplateRes.data?.postavke_jsonb && typeof pretplateRes.data.postavke_jsonb === 'object')
            ? pretplateRes.data.postavke_jsonb
            : {};
        const pravilaMapa = (pravilaRes.data?.postavke_jsonb && typeof pravilaRes.data.postavke_jsonb === 'object')
            ? pravilaRes.data.postavke_jsonb
            : {};
        const radnici = Array.isArray(radniciRes.data) ? radniciRes.data : [];

        const targets = [];

        // TEST MOD: šalje testnu push poruku na zadnji računar i mobitel odabranog korisnika
        if (body?.testOnly && body?.targetUser) {
            const key = norm(body.targetUser);
            const entry = pretplate[key] || Object.values(pretplate).find((e) => norm(e?.ime_prezime) === key || norm(e?.username) === key);
            if (!entry) {
                return NextResponse.json({ ok: false, sent: 0, error: 'Nema aktivne push pretplate za vaš profil na ovom uređaju.' }, { status: 200 });
            }
            const payload = JSON.stringify({
                title: '🔔 Pilana ERP — Test Push Notifikacija',
                body: `Push obavještenja za ${body.targetName || body.targetUser} rade ispravno i kada je aplikacija zatvorena!`,
                tag: `pilana-test-${Date.now()}`,
                url: '/',
                urgent: true,
            });
            for (const slot of ['desktop', 'mobile']) {
                if (entry[slot]?.subscription?.endpoint) {
                    targets.push({ userKey: key, slot, subscription: entry[slot].subscription, payload });
                }
            }
        } else if (body?.notification) {
            const notif = body.notification;
            const cistiDetalji = ocistiTekstDetalja(notif.detalji || '');
            const moduli = odrediModuleNotifikacije(notif);
            const nazivModula = moduli[0] ? getNazivModula(moduli[0]) : 'Pilana ERP';
            const parsed = izvuciEntiteteNotifikacije(notif);
            const jeOdobrenje = Boolean(parsed.approvalType) || String(notif.akcija || '').includes('ODOBRENJE');
            const isUrgent = notif.nivo_alarma === 'CRVENO' || jeOdobrenje;

            const ikona = notif.nivo_alarma === 'CRVENO' ? '🚨' : (jeOdobrenje ? '✅' : (notif.nivo_alarma === 'ŽUTO' ? '⚠️' : '🔔'));
            const title = `${ikona} ${jeOdobrenje ? 'ZAHTJEV ZA ODOBRENJE' : nazivModula} — ${notif.akcija || 'Obavještenje'}`;
            const payload = JSON.stringify({
                title,
                body: cistiDetalji || 'Kliknite da otvorite detalje u ERP sistemu.',
                tag: `pilana-${notif.id || Date.now()}`,
                notifId: notif.id || null,
                url: notif.id ? `/?notif=${encodeURIComponent(notif.id)}` : '/',
                urgent: isUrgent,
            });

            // Pronađi sve registrovane korisnike koji po matrici pravila + dozvolama imaju pravo primiti ovu notifikaciju
            for (const [userKey, entry] of Object.entries(pretplate)) {
                if (!entry || (!entry.desktop?.subscription && !entry.mobile?.subscription)) continue;

                const radnik = radnici.find((r) => norm(r.username) === norm(userKey) || norm(r.ime_prezime) === norm(entry.ime_prezime)) || {
                    username: entry.username || userKey,
                    ime_prezime: entry.ime_prezime || userKey,
                    uloga: entry.uloga || 'operater',
                    dozvole: [],
                };

                if (!daLiJeNotifikacijaZaKorisnika(notif, radnik, pravilaMapa)) continue;

                for (const slot of ['desktop', 'mobile']) {
                    if (entry[slot]?.subscription?.endpoint) {
                        targets.push({ userKey, slot, subscription: entry[slot].subscription, payload });
                    }
                }
            }
        }

        let sent = 0;
        let failed = 0;
        let pruned = false;

        if (targets.length > 0) {
            const webpush = await getWebPush();
            await Promise.all(
                targets.map(async (t) => {
                    try {
                        await webpush.sendNotification(t.subscription, t.payload, { TTL: 86400 });
                        sent += 1;
                    } catch (err) {
                        failed += 1;
                        const code = err?.statusCode;
                        if (code === 404 || code === 410) {
                            if (pretplate[t.userKey]?.[t.slot]) {
                                delete pretplate[t.userKey][t.slot];
                                pruned = true;
                            }
                        }
                    }
                })
            );
        }

        if (pruned) {
            await sb
                .from('ui_postavke')
                .upsert([{ modul_ime: 'push_pretplate', postavke_jsonb: pretplate }], { onConflict: 'modul_ime' });
        }

        return NextResponse.json({ ok: true, sent, failed, totalTargets: targets.length });
    } catch (error) {
        return NextResponse.json({ ok: false, error: error?.message || 'Push server greška' }, { status: 500 });
    }
}
