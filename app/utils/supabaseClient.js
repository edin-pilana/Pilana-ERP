import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://awaxwejrhmjeqohrgidm.supabase.co';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';

export const TELEGRAM_BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || '';
export const TELEGRAM_CHAT_ID = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID || '';

const globalForSupabase = typeof window !== 'undefined' ? window : globalThis;

const rawSupabase = globalForSupabase.__pilana_supabase_client || createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    }
});

if (typeof window !== 'undefined') {
    globalForSupabase.__pilana_supabase_client = rawSupabase;
}

const escapeTelegramHtml = (str) => String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export const posaljiEksterniPushAlarm = async (zapis) => {
    if (!zapis) return;
    const akcija = zapis.akcija || 'SISTEMSKI ALARM';
    const nivo = zapis.nivo_alarma || 'INFO';

    const jeHitno =
        nivo === 'CRVENO' ||
        nivo === 'ŽUTO' ||
        akcija.includes('ODOBRENJE') ||
        akcija.includes('RABAT') ||
        akcija.includes('REKLAMACIJ') ||
        akcija.includes('OBRISAN') ||
        akcija.includes('ALARM') ||
        akcija.includes('OTKLJUČAN');

    if (!jeHitno) return;

    const ikona = nivo === 'CRVENO' ? '🚨' : '⚠️';
    const porukaTekst = `${ikona} <b>PILANA ERP ALARM (${escapeTelegramHtml(nivo)})</b>\n\n👤 <b>Radnik:</b> ${escapeTelegramHtml(zapis.korisnik || 'Nepoznat')}\n📋 <b>Akcija:</b> ${escapeTelegramHtml(akcija)}\n📝 <b>Detalji:</b> ${escapeTelegramHtml(zapis.detalji || '-')}\n🕒 <b>Vrijeme:</b> ${escapeTelegramHtml(new Date().toLocaleString('bs-BA'))}`;

    try {
        const botToken = TELEGRAM_BOT_TOKEN || (typeof window !== 'undefined' ? localStorage.getItem('erp_tg_token') : '');
        const chatId = TELEGRAM_CHAT_ID || (typeof window !== 'undefined' ? localStorage.getItem('erp_tg_chat_id') : '');

        if (botToken && chatId) {
            fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: porukaTekst,
                    parse_mode: 'HTML'
                })
            }).catch(() => {});
        }

        const { data: post } = await rawSupabase.from('postavke_izvjestaja').select('webhook_url').eq('id', 1).maybeSingle();
        if (post?.webhook_url && post.webhook_url.startsWith('http')) {
            fetch(post.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tip: 'ERP_PUSH_ALARM',
                    nivo,
                    korisnik: zapis.korisnik,
                    akcija,
                    detalji: zapis.detalji,
                    vrijeme: new Date().toISOString()
                })
            }).catch(() => {});
        }
    } catch (e) {
        console.error('Greška pri slanju eksterne notifikacije:', e);
    }
};

// Prevod čestih PostgreSQL / Supabase grešaka na razumljiv BHS jezik
export const formatDbError = (error, kontekst = 'Zapis') => {
    const raw = String(error?.message || error || '');
    const code = String(error?.code || '');
    if (code === '23505' || /duplicate key value violates unique constraint/i.test(raw)) {
        return `${kontekst} sa ovim brojem/šifrom već postoji u bazi! Unesite drugi jedinstveni broj.`;
    }
    if (code === '23503' || /violates foreign key constraint/i.test(raw)) {
        return `${kontekst} je povezan sa drugim dokumentima u sistemu i ne može se izmijeniti/obrisati dok postoje te veze.`;
    }
    if (code === '22P02' || /invalid input syntax/i.test(raw)) {
        return `Neispravan format unesenih podataka za ${kontekst.toLowerCase()}. Provjerite brojeve i datume.`;
    }
    if (code === '23502' || /violates not-null constraint/i.test(raw)) {
        return `Nedostaju obavezna polja za ${kontekst.toLowerCase()}.`;
    }
    return raw || `Greška pri obradi (${kontekst}).`;
};

// Idempotentni presretač (sprječava višestruko patchovanje pri HMR-u i duplo izvršavanje lazy PostgrestBuilder thenable-a)
if (!rawSupabase.__pilana_audit_patched) {
    rawSupabase.__pilana_audit_patched = true;
    const origFrom = rawSupabase.from.bind(rawSupabase);
    rawSupabase.from = (table) => {
        const builder = origFrom(table);
        if (table === 'sistem_audit_log') {
            const origInsert = builder.insert.bind(builder);
            builder.insert = (values, options) => {
                const niz = Array.isArray(values) ? values : [values];
                const query = origInsert(values, options);
                const origThen = query.then.bind(query);
                let alarmSent = false;
                query.then = (onfulfilled, onrejected) => origThen((res) => {
                    if (!alarmSent && !res?.error) {
                        alarmSent = true;
                        niz.forEach(item => posaljiEksterniPushAlarm(item));
                    }
                    return onfulfilled ? onfulfilled(res) : res;
                }, onrejected);
                return query;
            };
        }
        return builder;
    };
}

export const supabase = rawSupabase;
