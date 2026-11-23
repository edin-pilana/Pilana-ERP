"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Bot, Send, Sparkles, Printer, FileSpreadsheet, RefreshCw, KeyRound,
    Trash2, Copy, Check, ShieldCheck, BarChart3, Zap, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../utils/supabaseClient';
import { toLocalIso, prikazDatumaBHS, formatBrojBHS, escapeHtml } from '../utils/dateHelpers';
import { printDokument } from '../utils/printHelpers';
import { exportToExcel } from '../utils/exportHelpers';
import {
    izgradiErpSnimak,
    napraviKompaktanKontekstZaLLM,
    odgovoriLokalniAiKontrolor,
} from '../utils/aiKontrolorEngine';
import SmartChart, { uhvatiSmartChartSvgHtml } from './SmartChart';

const AI_CONFIG_KEY = 'ai_kontrolor_config';

const STARTER_PROMPTS = [
    { icon: '🚨', label: 'Gdje gubimo novac & Rizici', query: 'Pronađi najveće rizike, anomalije, kašnjenja i gdje firma potencijalno gubi novac. Daj konkretan plan akcije.' },
    { icon: '📊', label: 'Uporedi ovaj i prošli mjesec', query: 'Uporedi ovaj i prošli mjesec po proizvodnji, prinosu (Yield), fakturisanju i keš toku sa procentima promjene.' },
    { icon: '📈', label: '6-mjesečni trend', query: 'Prikaži 6-mjesečni trend proizvodnje, fakturisanja i keš priliva sa dijagramom.' },
    { icon: '💎', label: 'Profit po nalozima', query: 'Napravi izvještaj najprofitabilnijih radnih naloga sa neto maržom, prihodom i troškovima.' },
    { icon: '⏳', label: 'Dužnici & Aging 30/60/90', query: 'Koji kupci najviše duguju, koliki je dospjeli dug i kakva je Aging 30/60/90 struktura?' },
    { icon: '📅', label: 'Današnji & Jučerašnji učinak', query: 'Kakav je današnji operativni učinak u poređenju sa jučerašnjim danom?' },
    { icon: '📝', label: 'Ponude, Rabati & Otpreme', query: 'Analiziraj ponude, stopu konverzije, visoke rabate i status otpremnica.' },
    { icon: '👥', label: 'HR Sati & Prisustvo', query: 'Napravi izvještaj radnih sati radnika, kašnjenja i zahtjeva za odsustvo za ovaj mjesec.' },
];

const KPI_STYLE_MAP = {
    emerald: 'border-emerald-500/40 bg-emerald-950/15 text-emerald-400',
    blue: 'border-blue-500/40 bg-blue-950/15 text-blue-400',
    amber: 'border-amber-500/40 bg-amber-950/15 text-amber-400',
    red: 'border-red-500/40 bg-red-950/15 text-red-400',
    purple: 'border-purple-500/40 bg-purple-950/15 text-purple-400',
};

const WELCOME_MSG = {
    id: 'welcome',
    role: 'ai',
    mode: 'system',
    naslov: 'AI Direktorski Analitičar & Kontrolor',
    text: `Zdravo šefe! Povezan sam uživo na **svih 19 modula Pilana-ERP baze** (proizvodnja, lager, trupci, ponude, radni nalozi, otpremnice, računi, blagajna, reklamacije, planiranje, sušare, biomasa/FSC/CBAM i HR).\n\n### Kako da izvučeš maksimum:\n- Pitaj me za **konkretan period** (*danas, juče, zadnjih 7 dana, oktobar, zadnjih 6 mjeseci*) ili **poređenje** (*ovaj vs prošli mjesec*).\n- Napiši ime **bilo kog kupca, mašine, proizvoda ili broj dokumenta** (` + '`RN-...`, `PK-...`' + `) za instant 360° izvještaj.\n- Za punu **Antigravity-level slobodnu konverzaciju**, klikni **🔑 AI Ključ** gore desno i unesi besplatan **Google Gemini** ili **Groq** ključ (ili OpenAI / Claude) — čuva se trajno za cijelu firmu!`,
    kpi: [],
    chart: null,
    tabela: null,
    predlozi: [
        'Pronađi najveće rizike i gdje gubimo novac',
        'Prikaži 6-mjesečni trend proizvodnje i prihoda',
        'Uporedi ovaj i prošli mjesec',
        'Koji kupci najviše duguju (Aging)?',
    ],
};

function detectProviderLabel(key, model, serverStatus) {
    const k = String(key || '').trim();
    if (!k) {
        if (serverStatus?.hasGroq && serverStatus?.hasGemini) return `Dual AI: Groq 120B + Gemini`;
        if (serverStatus?.hasGroq) return `Groq (${model || 'gpt-oss-120b'})`;
        if (serverStatus?.hasGemini) return `Gemini (${model || 'gemini-3.8-flash'})`;
        if (serverStatus?.serverProvider) return `Server AI (${serverStatus.serverProvider.toUpperCase()})`;
        return 'Ugrađeni ERP AI Motor';
    }
    if (k.startsWith('gsk_')) return `Groq (${model || 'gpt-oss-120b'})`;
    if (k.startsWith('AIza') || k.startsWith('AQ.')) return `Gemini (${model || 'gemini-3.8-flash'})`;
    if (k.startsWith('sk-ant-')) return 'Anthropic Claude';
    if (k.startsWith('sk-or-')) return 'OpenRouter AI';
    if (k.startsWith('sk-')) return `OpenAI (${model || 'gpt-4o-mini'})`;
    return `AI API (${model || 'Auto'})`;
}

function renderMarkdownBlocks(text) {
    const safe = (s) =>
        String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

    const inlineFormat = (s) =>
        safe(s)
            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-theme-text font-black">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em class="opacity-90">$1</em>')
            .replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 rounded bg-theme-panel border border-theme-border text-[11px] font-mono text-theme-accent">$1</code>');

    const lines = String(text || '').split('\n');
    return lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2" />;
        if (trimmed.startsWith('### ')) {
            return (
                <h4
                    key={idx}
                    className="text-xs font-black uppercase tracking-wider text-theme-accent mt-3 mb-1.5"
                    dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed.slice(4)) }}
                />
            );
        }
        if (trimmed.startsWith('## ')) {
            return (
                <h3
                    key={idx}
                    className="text-sm font-black uppercase tracking-wide text-theme-text mt-3 mb-1.5"
                    dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed.slice(3)) }}
                />
            );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
                <li
                    key={idx}
                    className="ml-4 list-disc text-[13px] leading-relaxed text-theme-text/95 mb-1"
                    dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed.slice(2)) }}
                />
            );
        }
        return (
            <p
                key={idx}
                className="text-[13px] leading-relaxed text-theme-text/95 mb-1.5"
                dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed) }}
            />
        );
    });
}

export default function TabAiAnalitika({ saas, user }) {
    const [messages, setMessages] = useState([WELCOME_MSG]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [bezQaTesta, setBezQaTesta] = useState(true);
    const [showConfig, setShowConfig] = useState(false);
    const [apiKey, setApiKey] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('erp_gemini_key') || '' : ''));
    const [modelName, setModelName] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('erp_ai_model') || 'openai/gpt-oss-120b' : 'openai/gpt-oss-120b'));
    const [serverStatus, setServerStatus] = useState({ hasServerKey: false, hasGroq: false, hasGemini: false, serverProvider: null });
    const [savingKey, setSavingKey] = useState(false);
    const [testingKey, setTestingKey] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [dbCache, setDbCache] = useState(null);
    const [lastSync, setLastSync] = useState(null);
    const [copiedId, setCopiedId] = useState(null);

    const chatEndRef = useRef(null);
    const inputRef = useRef(null);
    const isAdmin = !user || user?.uloga === 'superadmin' || user?.uloga === 'admin';

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // Provjeri server env ključ i učitaj sačuvani AI ključ iz Supabase ui_postavke
    useEffect(() => {
        let cancelled = false;
        const initKeys = async () => {
            try {
                const [srvRes, dbRes] = await Promise.all([
                    fetch('/api/ai-kontrolor').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
                    supabase.from('ui_postavke').select('postavke_jsonb').eq('modul_ime', AI_CONFIG_KEY).maybeSingle(),
                ]);
                if (cancelled) return;
                if (srvRes?.hasServerKey) {
                    setServerStatus({
                        hasServerKey: true,
                        hasGroq: Boolean(srvRes.hasGroq),
                        hasGemini: Boolean(srvRes.hasGemini),
                        serverProvider: srvRes.serverProvider || 'groq',
                    });
                    if (srvRes.defaultModel && !localStorage.getItem('erp_ai_model')) {
                        setModelName(srvRes.defaultModel);
                    }
                }
                const cfg = dbRes?.data?.postavke_jsonb;
                if (cfg?.apiKey && !localStorage.getItem('erp_gemini_key')) {
                    setApiKey(cfg.apiKey);
                    try { localStorage.setItem('erp_gemini_key', cfg.apiKey); } catch (e) {}
                }
                if (cfg?.model) {
                    setModelName(cfg.model);
                    try { localStorage.setItem('erp_ai_model', cfg.model); } catch (e) {}
                }
            } catch (e) {}
        };
        initKeys();
        return () => { cancelled = true; };
    }, []);

    const fetchCijelaBaza = useCallback(async (force = false) => {
        if (dbCache && !force) return dbCache;
        const [
            trupciRes, prorezRes, paketiRes, racuniRes, ponudeRes, otpremniceRes,
            blagajnaRes, naloziRes, reklamacijeRes, zastojiRes, rasporedRes, masineRes,
            radniciRes, radniSatiRes, odsustvaRes, katalogRes, kupciRes,
            susRes, srvRes, bioRes, cbamRes
        ] = await Promise.all([
            supabase.from('trupci').select('*'),
            supabase.from('prorez_log').select('*'),
            supabase.from('paketi').select('*'),
            supabase.from('racuni').select('*'),
            supabase.from('ponude').select('*'),
            supabase.from('otpremnice').select('*'),
            supabase.from('blagajna').select('*'),
            supabase.from('radni_nalozi').select('*'),
            supabase.from('reklamacije').select('*'),
            supabase.from('dnevnik_masine').select('*'),
            supabase.from('raspored_proizvodnje').select('*'),
            supabase.from('masine').select('naziv, dnevni_kapacitet_m3'),
            supabase.from('radnici').select('id, ime_prezime, uloga'),
            supabase.from('radni_sati').select('*').order('datum', { ascending: false }).limit(500),
            supabase.from('zahtjevi_odsustva').select('*').order('created_at', { ascending: false }).limit(150),
            supabase.from('katalog_proizvoda').select('*'),
            supabase.from('kupci').select('id, naziv, adresa, pdv_broj'),
            supabase.from('ui_postavke').select('postavke_jsonb').eq('modul_ime', 'susare_sarze').maybeSingle(),
            supabase.from('ui_postavke').select('postavke_jsonb').eq('modul_ime', 'servis_masina_pila').maybeSingle(),
            supabase.from('ui_postavke').select('postavke_jsonb').eq('modul_ime', 'biomasa_postavke').maybeSingle(),
            supabase.from('ui_postavke').select('postavke_jsonb').eq('modul_ime', 'cbam_energenti').maybeSingle(),
        ]);

        const fresh = {
            trupci: trupciRes.data || [],
            prorez_log: prorezRes.data || [],
            paketi: paketiRes.data || [],
            racuni: racuniRes.data || [],
            ponude: ponudeRes.data || [],
            otpremnice: otpremniceRes.data || [],
            blagajna: blagajnaRes.data || [],
            radni_nalozi: naloziRes.data || [],
            reklamacije: reklamacijeRes.data || [],
            dnevnik_masine: zastojiRes.data || [],
            raspored_proizvodnje: rasporedRes.data || [],
            masine: masineRes.data || [],
            radnici: radniciRes.data || [],
            radni_sati: radniSatiRes.data || [],
            zahtjevi_odsustva: odsustvaRes.data || [],
            katalog_proizvoda: katalogRes.data || [],
            kupci: kupciRes.data || [],
            susare_sarze: susRes.data?.postavke_jsonb || {},
            servis_masina_pila: srvRes.data?.postavke_jsonb || {},
            biomasa_postavke: bioRes.data?.postavke_jsonb || {},
            cbam_energenti: cbamRes.data?.postavke_jsonb || {},
        };
        setDbCache(fresh);
        setLastSync(new Date());
        return fresh;
    }, [dbCache]);

    const handleTestApiKey = async () => {
        const cleanKey = apiKey.trim();
        if (!cleanKey && !serverStatus.hasServerKey) {
            return toast.warning('Prvo zalijepi svoj Gemini, Groq, OpenAI, Claude ili OpenRouter API ključ.');
        }
        setTestingKey(true);
        setTestResult(null);
        try {
            const resp = await fetch('/api/ai-kontrolor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'test', apiKey: cleanKey, model: modelName }),
            });
            const data = await resp.json();
            if (data.ok) {
                const det = Array.isArray(data.results)
                    ? data.results.map((r) => `${r.provider.toUpperCase()}: ${r.ok ? `✅ ${r.model} (${r.ms}ms)` : `⚠️ ${r.error?.slice(0, 60)}`}`).join('  |  ')
                    : `${String(data.provider || '').toUpperCase()} (${data.model})`;
                setTestResult({ ok: true, msg: `Veza uspješna! ${det}` });
                toast.success(`AI API veza uspješna (${data.model})!`);
            } else {
                setTestResult({ ok: false, msg: `Greška provjere: ${data.error || 'Nevažeći API ključ ili ograničena kvota'}` });
                toast.error('API ključ nije prošao provjeru.');
            }
        } catch (e) {
            setTestResult({ ok: false, msg: 'Mrežna greška pri testiranju API ključa.' });
        } finally {
            setTestingKey(false);
        }
    };

    const handleSaveConfig = async (saveToCloud = false) => {
        const cleanKey = apiKey.trim();
        try {
            localStorage.setItem('erp_gemini_key', cleanKey);
            localStorage.setItem('erp_ai_model', modelName);
        } catch (e) {}

        if (saveToCloud && isAdmin) {
            setSavingKey(true);
            try {
                const { data: existing } = await supabase
                    .from('ui_postavke')
                    .select('postavke_jsonb')
                    .eq('modul_ime', AI_CONFIG_KEY)
                    .maybeSingle();
                const prevCfg = existing?.postavke_jsonb || {};
                const nextCfg = { ...prevCfg, model: modelName, updated_at: new Date().toISOString() };
                if (cleanKey) {
                    if (cleanKey.startsWith('gsk_')) nextCfg.groqKey = cleanKey;
                    else if (cleanKey.startsWith('AIza') || cleanKey.startsWith('AQ.')) nextCfg.geminiKey = cleanKey;
                    else nextCfg.apiKey = cleanKey;
                }
                const { error } = await supabase
                    .from('ui_postavke')
                    .upsert([{ modul_ime: AI_CONFIG_KEY, postavke_jsonb: nextCfg }], { onConflict: 'modul_ime' });
                if (error) toast.error('Greška pri spremanju u bazu: ' + error.message);
                else toast.success('AI API konfiguracija sačuvana za cijelu firmu!');
            } finally {
                setSavingKey(false);
            }
        } else {
            toast.success(cleanKey ? 'AI API ključ je aktivan!' : 'Prebačeno na ugrađeni ERP AI motor.');
        }
        setShowConfig(false);
    };

    const posaljiPoruku = async (overrideText = null) => {
        const userText = String(overrideText ?? input).trim();
        if (!userText || isTyping) return;

        const userMsgId = `u_${Date.now()}`;
        const nextHistory = [...messages, { id: userMsgId, role: 'user', text: userText }];
        setMessages(nextHistory);
        if (overrideText === null) setInput('');
        setIsTyping(true);

        try {
            const baza = await fetchCijelaBaza(false);
            const snimak = izgradiErpSnimak(baza, { bezQaTesta });
            const erpContext = napraviKompaktanKontekstZaLLM(snimak, userText);

            let aiResult = null;
            let engineMode = 'local';
            let activeModel = '';
            let fallbackNotice = '';

            try {
                const compactHistory = nextHistory
                    .filter((m) => m.id !== 'welcome')
                    .slice(-11, -1)
                    .map((m) => ({ role: m.role, text: m.text }));

                const res = await fetch('/api/ai-kontrolor', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'chat',
                        message: userText,
                        history: compactHistory,
                        erpContext,
                        apiKey: apiKey.trim(),
                        model: modelName,
                    }),
                });
                if (res.ok) {
                    const payload = await res.json();
                    if (payload?.ok && payload?.data) {
                        aiResult = payload.data;
                        engineMode = payload.mode || 'gemini';
                        activeModel = payload.model || '';
                    } else if ((apiKey.trim() || serverStatus.hasServerKey) && payload?.reason && payload.reason !== 'NO_API_KEY') {
                        fallbackNotice = `Vanjski AI model trenutno nije odgovorio (${payload.reason}) — odgovor generisao ugrađeni ERP AI motor.`;
                    }
                }
            } catch (e) {
                if (apiKey.trim() || serverStatus.hasServerKey) {
                    fallbackNotice = 'Mrežna greška prema vanjskom AI API-ju — odgovor generisao ugrađeni ERP AI motor.';
                }
            }

            if (!aiResult) {
                aiResult = odgovoriLokalniAiKontrolor(snimak, userText);
                engineMode = 'local';
            }

            const aiMsgId = `ai_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            setMessages((prev) => [
                ...prev,
                {
                    id: aiMsgId,
                    role: 'ai',
                    mode: engineMode,
                    model: activeModel,
                    fallbackNotice,
                    naslov: aiResult.naslov || 'AI ERP Izvještaj',
                    text: aiResult.odgovor || 'Analiza je završena.',
                    kpi: Array.isArray(aiResult.kpi) ? aiResult.kpi : [],
                    chart: aiResult.chart || null,
                    chartId: aiResult.chart ? `ai_msg_chart_${aiMsgId}` : null,
                    tabela: aiResult.tabela || null,
                    predlozi: Array.isArray(aiResult.predlozi) ? aiResult.predlozi : [],
                },
            ]);
        } catch (err) {
            console.error('Greška AI Kontrolor:', err);
            setMessages((prev) => [
                ...prev,
                {
                    id: `err_${Date.now()}`,
                    role: 'ai',
                    mode: 'error',
                    naslov: 'Greška pri analizi',
                    text: 'Došlo je do greške pri čitanju baze podataka. Klikni **Osvježi Bazu** i pokušaj ponovo.',
                    kpi: [],
                    chart: null,
                    tabela: null,
                    predlozi: ['Uporedi ovaj i prošli mjesec', 'Pronađi najveće rizike u firmi'],
                },
            ]);
        } finally {
            setIsTyping(false);
            setTimeout(() => inputRef.current?.focus(), 60);
        }
    };

    const handlePrintReport = (msg) => {
        const chartSvgHtml = msg.chart && msg.chartId
            ? uhvatiSmartChartSvgHtml(msg.chartId, msg.chart.title, msg.chart.subtitle)
            : '';

        const kpiHtml = (msg.kpi && msg.kpi.length > 0) ? `
            <div style="display:grid; grid-template-columns:repeat(${Math.min(4, msg.kpi.length)}, 1fr); gap:10px; margin:12px 0;">
                ${msg.kpi.map((k) => `
                    <div style="border:1px solid #cbd5e1; border-radius:8px; padding:10px; background:#f8fafc;">
                        <div style="font-size:8px; font-weight:800; text-transform:uppercase; color:#64748b;">${escapeHtml(k.label)}</div>
                        <div style="font-size:15px; font-weight:900; color:#0f172a; margin-top:4px;">${escapeHtml(k.value)}</div>
                        ${k.sub ? `<div style="font-size:8px; color:#475569; margin-top:2px;">${escapeHtml(k.sub)}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        ` : '';

        const proseHtml = String(msg.text || '')
            .split('\n')
            .map((line) => {
                const t = line.trim();
                if (!t) return '';
                const fmt = escapeHtml(t).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                if (t.startsWith('### ')) return `<h4 style="font-size:11px;font-weight:900;text-transform:uppercase;color:#1e40af;margin:10px 0 4px 0;">${fmt.slice(4)}</h4>`;
                if (t.startsWith('- ') || t.startsWith('* ')) return `<div style="font-size:10px;margin:2px 0 2px 12px;">• ${fmt.slice(2)}</div>`;
                return `<p style="font-size:10px;margin:4px 0;line-height:1.5;color:#1e293b;">${fmt}</p>`;
            })
            .join('');

        let tableHtml = '';
        if (msg.tabela && msg.tabela.kolone?.length && msg.tabela.redovi?.length) {
            const th = msg.tabela.kolone.map((c) => `<th class="${c.align === 'right' ? 'num' : ''}">${escapeHtml(c.label)}</th>`).join('');
            const tr = msg.tabela.redovi.map((r) => `
                <tr>
                    ${msg.tabela.kolone.map((c) => {
                        const raw = r[c.key];
                        const val = c.type === 'number' && typeof raw === 'number'
                            ? formatBrojBHS(raw, Number.isInteger(raw) ? 0 : 2)
                            : (raw ?? '-');
                        const disp = c.suffix && val !== '-' ? `${val}${c.suffix}` : val;
                        return `<td class="${c.align === 'right' ? 'num' : ''}">${escapeHtml(disp)}</td>`;
                    }).join('')}
                </tr>
            `).join('');
            tableHtml = `
                <div style="font-size:11px;font-weight:900;text-transform:uppercase;color:#0f172a;margin:14px 0 6px 0;">${escapeHtml(msg.tabela.naslov || 'Tabela')}</div>
                <table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>
            `;
        }

        const bodyHtml = `
            <div style="background:#f8fafc;border:1px solid #cbd5e1;border-left:4px solid #3b82f6;border-radius:8px;padding:12px;margin-bottom:12px;">
                ${proseHtml}
            </div>
            ${kpiHtml}
            ${chartSvgHtml}
            ${tableHtml}
        `;

        printDokument(
            (msg.naslov || 'AI ANALITIČKI IZVJEŠTAJ').toUpperCase(),
            `AI-REPORT-${toLocalIso(new Date())}`,
            prikazDatumaBHS(toLocalIso(new Date())),
            bodyHtml,
            saas?.ui?.boja_akcenta || '#3b82f6'
        );
    };

    const handleExportExcel = (msg) => {
        if (!msg.tabela?.redovi?.length) return;
        exportToExcel({
            filename: `AI_Izvjestaj_${toLocalIso(new Date())}`,
            sheetName: (msg.naslov || 'AI Izvjestaj').slice(0, 28),
            title: `${msg.naslov || 'AI Izvještaj'} (${prikazDatumaBHS(toLocalIso(new Date()))})`,
            columns: msg.tabela.kolone.map((c) => ({ key: c.key, label: c.label, type: c.type || 'string' })),
            rows: msg.tabela.redovi,
        });
    };

    const handleCopyText = (msg) => {
        const plain = `${msg.naslov ? msg.naslov + '\n\n' : ''}${msg.text || ''}`;
        navigator.clipboard?.writeText(plain).then(() => {
            setCopiedId(msg.id);
            setTimeout(() => setCopiedId(null), 1800);
        });
    };

    const handleRefreshDb = async () => {
        toast.info('Osvježavam svih 19 tabela iz ERP baze...');
        await fetchCijelaBaza(true);
        toast.success('AI Kontrolor sinhronizovan sa najnovijim podacima!');
    };

    const bojaAkcenta = saas?.ui?.boja_akcenta || '#3b82f6';
    const hasLlm = Boolean(apiKey.trim()) || serverStatus.hasServerKey;
    const providerLabel = detectProviderLabel(apiKey, modelName, serverStatus);

    return (
        <div
            data-testid="ai-kontrolor-workspace"
            className="relative max-w-6xl mx-auto h-[840px] max-h-[86vh] flex flex-col bg-theme-card rounded-3xl border border-theme-border shadow-2xl overflow-hidden animate-in fade-in"
        >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-theme-border bg-gradient-to-r from-theme-panel via-theme-card to-theme-panel flex flex-wrap justify-between items-center gap-3 shrink-0 z-10">
                <div className="flex items-center gap-3.5 min-w-0">
                    <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg border shrink-0"
                        style={{ backgroundColor: `${bojaAkcenta}20`, borderColor: `${bojaAkcenta}66`, color: bojaAkcenta }}
                    >
                        <Bot size={24} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-theme-text font-black uppercase tracking-widest text-xs sm:text-sm flex items-center gap-2 flex-wrap">
                            <span>TTM AI Kontrolor</span>
                            <span className={`text-[9px] px-2.5 py-0.5 rounded-full border font-black uppercase ${hasLlm ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'}`}>
                                {hasLlm ? '🧠 ' : '⚡ '}{providerLabel}
                            </span>
                        </h3>
                        <p className="text-[10px] text-theme-muted font-bold flex items-center gap-1.5 mt-0.5 truncate">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse shrink-0" />
                            19 modula uživo • 12-mjesečni trendovi • 360° pretraga • PDF & Excel
                            {lastSync && <span className="hidden md:inline opacity-75">• {lastSync.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setBezQaTesta((v) => !v)}
                        data-testid="ai-qa-filter-btn"
                        className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-black uppercase transition-all ${
                            bezQaTesta
                                ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40'
                                : 'bg-amber-600/20 text-amber-300 border-amber-500/40'
                        }`}
                    >
                        {bezQaTesta ? '🧹 Bez QA testa' : '🧪 Sa QA testom'}
                    </button>

                    <button
                        type="button"
                        onClick={handleRefreshDb}
                        title="Osvježi živu bazu podataka"
                        className="px-2.5 py-1.5 rounded-xl bg-theme-panel hover:bg-theme-card border border-theme-border text-[10px] font-black uppercase text-theme-muted hover:text-theme-text flex items-center gap-1 transition-colors"
                    >
                        <RefreshCw size={12} /> Baza
                    </button>

                    <button
                        type="button"
                        onClick={() => setMessages([WELCOME_MSG])}
                        data-testid="ai-new-chat-btn"
                        className="px-2.5 py-1.5 rounded-xl bg-theme-panel hover:bg-theme-card border border-theme-border text-[10px] font-black uppercase text-theme-muted hover:text-red-400 flex items-center gap-1 transition-colors"
                    >
                        <Trash2 size={12} /> Novi
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowConfig((v) => !v)}
                        data-testid="ai-api-config-btn"
                        className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase flex items-center gap-1 transition-all ${
                            showConfig ? 'bg-theme-accent text-white border-theme-accent' : hasLlm ? 'bg-purple-600/20 border-purple-500/50 text-purple-300' : 'bg-amber-600/20 border-amber-500/50 text-amber-300 hover:bg-amber-600 hover:text-white'
                        }`}
                    >
                        <KeyRound size={12} /> {hasLlm ? 'AI Ključ ✓' : 'Poveži AI Ključ'}
                    </button>
                </div>
            </div>

            {/* Konfiguracija API ključa (Gemini / Groq / OpenAI / Claude / OpenRouter) */}
            {showConfig && (
                <div className="p-4 bg-theme-panel border-b border-theme-border space-y-3 animate-in slide-in-from-top-2 shrink-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <p className="text-xs font-black text-theme-text uppercase flex items-center gap-1.5">
                                <Sparkles size={14} className="text-purple-400" /> Poveži AI API ključ (Automatski prepoznaje Gemini, Groq, OpenAI, Claude i OpenRouter)
                            </p>
                            <p className="text-[11px] text-theme-muted font-medium mt-0.5">
                                Za puni Antigravity-level razgovor preporučujemo besplatni <b>Google Gemini</b> (`AIza...`) ili ultra-brzi <b>Groq</b> (`gsk_...`) ključ.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[10px] font-black uppercase text-blue-400 hover:underline">
                                Besplatan Gemini ključ →
                            </a>
                            <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-[10px] font-black uppercase text-emerald-400 hover:underline">
                                Besplatan Groq ključ →
                            </a>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
                            placeholder="Zalijepi Gemini API (AIza...), Groq (gsk_...), OpenAI (sk-...), Claude (sk-ant-...)..."
                            className="flex-1 min-w-[240px] px-3.5 py-2.5 bg-theme-card border border-theme-border rounded-xl text-xs text-theme-text font-bold outline-none focus:border-theme-accent"
                        />
                        <select
                            value={modelName}
                            onChange={(e) => setModelName(e.target.value)}
                            className="px-3 py-2.5 bg-theme-card border border-theme-border rounded-xl text-xs font-black text-theme-text outline-none"
                        >
                            <option value="openai/gpt-oss-120b">Groq GPT-OSS 120B (Najbrži & Najjači — Preporučeno)</option>
                            <option value="qwen/qwen3.8-27b">Groq Qwen 3.8 27B (Ultra-brz)</option>
                            <option value="gemini-3.8-flash">Google Gemini 3.8 Flash</option>
                            <option value="gemini-3.7-flash">Google Gemini 3.7 Flash</option>
                            <option value="gemini-3.1-flash-lite">Google Gemini 3.1 Flash Lite</option>
                            <option value="gpt-4o-mini">OpenAI GPT-4o Mini</option>
                            <option value="gpt-4o">OpenAI GPT-4o</option>
                            <option value="claude-sonnet-4-20250514">Anthropic Claude Sonnet 4</option>
                        </select>
                        <button
                            type="button"
                            disabled={testingKey}
                            onClick={handleTestApiKey}
                            className="px-3.5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-1"
                        >
                            <Zap size={12} /> {testingKey ? 'Testiram...' : 'Testiraj'}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSaveConfig(false)}
                            className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase"
                        >
                            Sačuvaj Lokalno
                        </button>
                        {isAdmin && (
                            <button
                                type="button"
                                disabled={savingKey}
                                onClick={() => handleSaveConfig(true)}
                                className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-1"
                            >
                                <ShieldCheck size={13} /> Sačuvaj za Firmu
                            </button>
                        )}
                    </div>

                    {testResult && (
                        <div className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 ${testResult.ok ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' : 'bg-red-950/30 border-red-500/40 text-red-300'}`}>
                            {testResult.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                            <span>{testResult.msg}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Brzi izvještaji */}
            <div className="px-4 py-2.5 bg-theme-panel/50 border-b border-theme-border/70 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
                <span className="text-[9px] font-black uppercase text-theme-muted whitespace-nowrap shrink-0 flex items-center gap-1">
                    <BarChart3 size={11} /> Brzi izvještaji:
                </span>
                {STARTER_PROMPTS.map((sp, idx) => (
                    <button
                        key={idx}
                        type="button"
                        disabled={isTyping}
                        data-testid={`ai-starter-chip-${idx}`}
                        onClick={() => posaljiPoruku(sp.query)}
                        className="px-3 py-1.5 rounded-full bg-theme-card hover:bg-theme-accent hover:text-white border border-theme-border text-[10px] font-black text-theme-text whitespace-nowrap transition-all shrink-0 disabled:opacity-50"
                    >
                        {sp.icon} {sp.label}
                    </button>
                ))}
            </div>

            {/* Chat Stream */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-theme-main/70 custom-scrollbar">
                {messages.map((msg) => {
                    const isUser = msg.role === 'user';
                    return (
                        <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                            <div
                                data-testid={isUser ? 'ai-user-bubble' : 'ai-assistant-bubble'}
                                className={`rounded-3xl shadow-lg ${
                                    isUser
                                        ? 'max-w-[85%] md:max-w-[70%] px-5 py-3.5 bg-theme-accent text-white rounded-tr-md'
                                        : 'w-full max-w-[97%] xl:max-w-[94%] p-5 bg-theme-card text-theme-text rounded-tl-md border border-theme-border'
                                }`}
                            >
                                {isUser ? (
                                    <p className="text-sm font-bold leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-theme-border/60">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Sparkles size={15} className="text-theme-accent shrink-0" />
                                                <span className="text-xs font-black uppercase tracking-wider text-theme-text truncate">
                                                    {msg.naslov || 'AI ERP Analiza'}
                                                </span>
                                                {msg.mode && msg.mode !== 'system' && (
                                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-theme-panel border border-theme-border text-theme-muted font-black uppercase">
                                                        {msg.mode === 'local' ? 'ERP AI Motor' : `${String(msg.mode).toUpperCase()}${msg.model ? ` • ${msg.model}` : ''}`}
                                                    </span>
                                                )}
                                            </div>

                                            {msg.id !== 'welcome' && (
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        data-testid="ai-msg-print-btn"
                                                        onClick={() => handlePrintReport(msg)}
                                                        className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/40 text-[10px] font-black uppercase flex items-center gap-1 transition-all"
                                                    >
                                                        <Printer size={11} /> PDF Print
                                                    </button>
                                                    {msg.tabela?.redovi?.length > 0 && (
                                                        <button
                                                            type="button"
                                                            data-testid="ai-msg-excel-btn"
                                                            onClick={() => handleExportExcel(msg)}
                                                            className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/40 text-[10px] font-black uppercase flex items-center gap-1 transition-all"
                                                        >
                                                            <FileSpreadsheet size={11} /> Excel
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyText(msg)}
                                                        className="p-1.5 rounded-lg bg-theme-panel hover:bg-theme-card border border-theme-border text-theme-muted hover:text-theme-text transition-colors"
                                                        title="Kopiraj tekst analize"
                                                    >
                                                        {copiedId === msg.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {msg.fallbackNotice && (
                                            <div className="text-[10px] font-bold text-amber-300 bg-amber-950/30 border border-amber-500/30 rounded-xl px-3 py-1.5">
                                                ⚠️ {msg.fallbackNotice}
                                            </div>
                                        )}

                                        <div className="prose-sm max-w-none">
                                            {renderMarkdownBlocks(msg.text)}
                                        </div>

                                        {Array.isArray(msg.kpi) && msg.kpi.length > 0 && (
                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                                                {msg.kpi.map((k, kIdx) => (
                                                    <div
                                                        key={kIdx}
                                                        className={`p-3 rounded-2xl border shadow-sm ${KPI_STYLE_MAP[k.color] || KPI_STYLE_MAP.blue}`}
                                                    >
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-theme-muted block truncate">
                                                            {k.label}
                                                        </span>
                                                        <p className="text-base sm:text-lg font-black mt-0.5 truncate">{k.value}</p>
                                                        {k.sub && <p className="text-[10px] text-theme-muted font-bold mt-0.5 truncate">{k.sub}</p>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {msg.chart && msg.chart.data?.length > 0 && (
                                            <div className="bg-theme-panel/60 border border-theme-border rounded-2xl p-3.5">
                                                <SmartChart
                                                    chartId={msg.chartId}
                                                    title={msg.chart.title}
                                                    subtitle={msg.chart.subtitle}
                                                    data={msg.chart.data}
                                                    xKey={msg.chart.xKey || 'naziv'}
                                                    series={msg.chart.series}
                                                    defaultType={msg.chart.type || 'bar'}
                                                    unit={msg.chart.unit || ''}
                                                    height={250}
                                                />
                                            </div>
                                        )}

                                        {msg.tabela && msg.tabela.kolone?.length > 0 && msg.tabela.redovi?.length > 0 && (
                                            <div className="border border-theme-border rounded-2xl overflow-hidden bg-theme-panel/40">
                                                <div className="px-3.5 py-2 border-b border-theme-border bg-theme-panel/70 flex items-center justify-between">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-theme-text">
                                                        {msg.tabela.naslov || 'Detaljni Podaci'}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-theme-muted">
                                                        {msg.tabela.redovi.length} redova
                                                    </span>
                                                </div>
                                                <div className="overflow-x-auto max-h-[260px] overflow-y-auto custom-scrollbar">
                                                    <table className="w-full text-left border-collapse text-xs">
                                                        <thead className="sticky top-0 bg-theme-panel text-[10px] uppercase font-black text-theme-muted border-b border-theme-border">
                                                            <tr>
                                                                {msg.tabela.kolone.map((c) => (
                                                                    <th key={c.key} className={`p-2.5 whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}>
                                                                        {c.label}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-theme-border/50">
                                                            {msg.tabela.redovi.map((row, rIdx) => (
                                                                <tr key={rIdx} className="hover:bg-theme-card/70 transition-colors">
                                                                    {msg.tabela.kolone.map((c) => {
                                                                        const raw = row[c.key];
                                                                        const val = c.type === 'number' && typeof raw === 'number'
                                                                            ? formatBrojBHS(raw, Number.isInteger(raw) ? 0 : 2)
                                                                            : raw;
                                                                        const disp = val !== undefined && val !== null && val !== ''
                                                                            ? `${val}${c.suffix || ''}`
                                                                            : '-';
                                                                        return (
                                                                            <td key={c.key} className={`p-2.5 ${c.align === 'right' ? 'text-right font-mono font-black' : 'font-bold'} text-theme-text`}>
                                                                                {disp}
                                                                            </td>
                                                                        );
                                                                    })}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {Array.isArray(msg.predlozi) && msg.predlozi.length > 0 && (
                                            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-theme-border/40">
                                                <span className="text-[9px] font-black uppercase text-theme-muted mr-1">Nastavi razgovor:</span>
                                                {msg.predlozi.map((pr, pIdx) => (
                                                    <button
                                                        key={pIdx}
                                                        type="button"
                                                        disabled={isTyping}
                                                        onClick={() => posaljiPoruku(pr)}
                                                        className="px-2.5 py-1 rounded-xl bg-theme-panel hover:bg-theme-accent hover:text-white border border-theme-border text-[10px] font-bold text-theme-text transition-all disabled:opacity-50"
                                                    >
                                                        ↳ {pr}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {isTyping && (
                    <div className="flex justify-start">
                        <div className="px-5 py-3.5 rounded-3xl rounded-tl-md bg-theme-card border border-theme-accent/40 flex items-center gap-3 shadow-lg">
                            <span className="w-2.5 h-2.5 rounded-full bg-theme-accent animate-ping" />
                            <span className="text-xs font-black text-theme-text animate-pulse">
                                Dubinski analiziram svih 19 modula ERP baze i generišem izvještaj...
                            </span>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Composer */}
            <div className="p-3.5 sm:p-4 bg-theme-card border-t border-theme-border shrink-0">
                <div className="relative flex items-end gap-2">
                    <textarea
                        ref={inputRef}
                        rows={1}
                        value={input}
                        data-testid="ai-chat-input"
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                posaljiPoruku();
                            }
                        }}
                        placeholder="Pitaj bilo šta, npr: Gdje gubimo novac? / Kakav je današnji učinak? / Prikaži 6-mjesečni trend / Dosije kupca..."
                        disabled={isTyping}
                        className="flex-1 px-4 py-3.5 bg-theme-panel rounded-2xl text-sm text-theme-text font-bold outline-none border border-theme-border focus:border-theme-accent transition-all resize-none max-h-32 disabled:opacity-50"
                    />
                    <button
                        type="button"
                        data-testid="ai-chat-send-btn"
                        onClick={() => posaljiPoruku()}
                        disabled={!input.trim() || isTyping}
                        className="px-5 py-3.5 rounded-2xl font-black text-xs uppercase text-white flex items-center gap-2 transition-all shadow-lg disabled:opacity-40 shrink-0"
                        style={{ backgroundColor: bojaAkcenta }}
                    >
                        <Send size={15} />
                        <span className="hidden sm:inline">Pošalji</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
