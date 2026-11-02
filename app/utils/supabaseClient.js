import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';

// 🟢 OVDJE UPIŠI SVOJ TELEGRAM BOT TOKEN I CHAT ID (ZA NOTIFIKACIJE KAD JE APLIKACIJA UGAŠENA)
export const TELEGRAM_BOT_TOKEN = ''; // npr. '7123456789:AAH_tvoj_token_ovdje'
export const TELEGRAM_CHAT_ID = '';   // npr. '123456789'

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

// 🚀 FUNKCIJA KOJA ŠALJE NOTIFIKACIJU NA MOBITEL ČAK I KADA JE APLIKACIJA UGAŠENA
export const posaljiEksterniPushAlarm = async (zapis) => {
    if (!zapis) return;
    const akcija = zapis.akcija || 'SISTEMSKI ALARM';
    const nivo = zapis.nivo_alarma || 'INFO';

    // Šaljemo na mobitel sve CRVENE i ŽUTE alarme, te zahtjeve za odobrenje, rabate, reklamacije i brisanja
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
    const porukaTekst = `${ikona} *PILANA ERP ALARM (${nivo})*\n\n👤 *Radnik:* ${zapis.korisnik || 'Nepoznat'}\n📋 *Akcija:* ${akcija}\n📝 *Detalji:* ${zapis.detalji || '-'}\n🕒 *Vrijeme:* ${new Date().toLocaleString('bs-BA')}`;

    try {
        // 1. Provjeri Telegram konfiguraciju (iz koda ili iz localStorage-a)
        const botToken = TELEGRAM_BOT_TOKEN || (typeof window !== 'undefined' ? localStorage.getItem('erp_tg_token') : '');
        const chatId = TELEGRAM_CHAT_ID || (typeof window !== 'undefined' ? localStorage.getItem('erp_tg_chat_id') : '');

        if (botToken && chatId) {
            fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: porukaTekst,
                    parse_mode: 'Markdown'
                })
            }).catch(() => {});
        }

        // 2. Ako u Postavkama (Brending -> Cloud Print) imaš podešen Webhook (npr. Make.com / Viber / WhatsApp), pošalji i tamo!
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

// 🟢 PAMETNI PRESRETAČ: Svaki put kad bilo koji modul upiše alarm u 'sistem_audit_log', automatski šalje Push na tvoj mobitel!
const origFrom = rawSupabase.from.bind(rawSupabase);
rawSupabase.from = (table) => {
    const builder = origFrom(table);
    if (table === 'sistem_audit_log') {
        const origInsert = builder.insert.bind(builder);
        builder.insert = (values, options) => {
            const niz = Array.isArray(values) ? values : [values];
            niz.forEach(item => {
                posaljiEksterniPushAlarm(item);
            });
            return origInsert(values, options);
        };
    }
    return builder;
};

export const supabase = rawSupabase;