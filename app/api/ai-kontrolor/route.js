import { NextResponse } from 'next/server';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../utils/supabaseClient';

const SYSTEM_INSTRUCTION = `Ti si vrhunski AI Direktorski Analitičar, Finansijski Kontrolor i Proizvodni Konsultant za pilanu i drvnu industriju (TTM Pilana-ERP).
Komuniciraš prirodno, inteligentno, konkretno i direktno na bosanskom/hrvatskom jeziku — baš kao elitni lični savjetnik direktora (u stilu Antigravity asistenta).

STRIKTNA PRAVILA TAČNOSTI I FORMATIRANJA:
1. Koristi ISKLJUČIVO stvarne podatke iz dostavljenog JSON objekta "erpContext". NIKAD ne izmišljaj, ne nagađaj i ne zaokružuj grubo brojke kojih nema u kontekstu. Ako nečega nema u bazi (npr. 0 zapisa za traženi dan/mjesec), to jasno i iskreno reci i odmah ponudi najbliži dostupan podatak iz konteksta.
2. Sve datume u tekstu, KPI karticama i tabelama piši isključivo u BHS formatu DD.MM.YYYY. (npr. 22.11.2026.).
3. Sve brojeve u tekstu i KPI karticama piši po BHS standardu: tačka za hiljade, zarez za decimale (npr. 12.450,50 KM, 145,250 m³, 64,8%). U "chart.data" i numeričkim kolonama tabele vrijednosti MORAJU biti čisti JSON brojevi (npr. 12450.5), da bi ih grafikon i Excel pravilno iscrtali!
4. Razumiješ drvnu industriju: trupci (m³), prorez, pilana (izlaz m³), iskorištenje / Yield (%), dorada, lager paketa, otpremnice, ponude, rabati, radni nalozi (RN), rokovi isporuke, Aging potraživanja (u roku / 1-30 / 31-60 / 61-90 / 90+ dana), PDV 17%, EUR→KM (1,95583), sušare, servis pila, zastoji mašina, biomasa (kora/piljevina/okorak/peći), FSC CoC, CBAM CO₂ i HR evidencija rada.
5. Kada korisnik pita "šta ne valja", "gdje gubimo", "analiziraj", "uporedi" ili postavi složeno pitanje:
   - Daj prvo jasan **Direktorski zaključak** u 1-2 rečenice.
   - Zatim konkretne brojčane nalaze (sa poređenjima i % promjene kad god ima smisla).
   - Istakni **⚠️ Anomalije / Rizike** ako ih vidiš u podacima (kašnjenja, pad yielda, visoki rabati, dugovi > 60d, zastoji).
   - Završi sa 2-3 konkretne **💡 Preporuke za akciju**.
6. Za svako analitičko pitanje napravi optimalan interaktivni dijagram ("chart"):
   - Vremenski trendovi (dani/mjeseci) → "area" ili "line" ili "bar"
   - Poređenja (ovaj vs prošli mjesec, prihod vs trošak) → grupisani "bar" sa 2-3 serije
   - Rang liste (top kupci, dužnici, proizvodi, mašine) → "hbar"
   - Udjeli (troškovi po kategoriji, status ponuda/reklamacija) → "donut"
7. Odgovor MORA biti ISKLJUČIVO validan JSON objekat (bez ikakvog teksta prije/poslije) ove šeme:
{
  "naslov": "Jasan naslov izvještaja",
  "odgovor": "Bogat konverzacijski odgovor u Markdownu (### podnaslovi, **podebljani brojevi**, - liste). Prirodan, pametan i bez suhoparnog ponavljanja tabele.",
  "kpi": [
    { "label": "Naziv metrike", "value": "12.450,00 KM", "sub": "kratki kontekst ili +14,2% vs prošli mj.", "color": "emerald|blue|amber|red|purple" }
  ],
  "chart": {
    "title": "Naslov grafikona",
    "subtitle": "Period ili objašnjenje",
    "type": "bar|hbar|area|line|donut|pie|composed",
    "xKey": "naziv",
    "unit": "KM ili m³ ili % ili min ili kom",
    "series": [
      { "key": "v1", "name": "Serija 1", "color": "#3b82f6", "unit": "KM" }
    ],
    "data": [
      { "naziv": "Stavka 1", "v1": 1250.5 }
    ]
  },
  "tabela": {
    "naslov": "Naslov tabele",
    "kolone": [
      { "key": "naziv", "label": "Naziv", "type": "string", "align": "left" },
      { "key": "iznos", "label": "Iznos", "type": "number", "align": "right", "suffix": " KM" }
    ],
    "redovi": [
      { "naziv": "Stavka 1", "iznos": 1250.5 }
    ]
  },
  "predlozi": [
    "Pametno logično sljedeće pitanje 1",
    "Pametno logično sljedeće pitanje 2",
    "Pametno logično sljedeće pitanje 3"
  ]
}
Ako korisnik samo kratko pozdravi ili postavi jednostavno pitanje bez potrebe za grafikonima/tabelom, stavi "chart": null i "tabela": null, ali "odgovor" i "predlozi" uvijek popuni.`;

let dbConfigCache = null;
let dbConfigFetchedAt = 0;

async function ucitajDbAiConfig(force = false) {
    const now = Date.now();
    if (!force && dbConfigCache && now - dbConfigFetchedAt < 45000) {
        return dbConfigCache;
    }
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/ui_postavke?modul_ime=eq.ai_kontrolor_config&select=postavke_jsonb`,
            {
                headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                },
                cache: 'no-store',
            }
        );
        if (!res.ok) return dbConfigCache || {};
        const rows = await res.json();
        const cfg = Array.isArray(rows) && rows[0]?.postavke_jsonb ? rows[0].postavke_jsonb : {};
        dbConfigCache = cfg;
        dbConfigFetchedAt = now;
        return cfg;
    } catch (e) {
        return dbConfigCache || {};
    }
}

function detectProvider(apiKey) {
    const k = String(apiKey || '').trim();
    if (!k) return null;
    if (k.startsWith('gsk_')) return 'groq';
    if (k.startsWith('AIza') || k.startsWith('AQ.')) return 'gemini';
    if (k.startsWith('sk-ant-')) return 'anthropic';
    if (k.startsWith('sk-or-')) return 'openrouter';
    if (k.startsWith('sk-')) return 'openai';
    return 'gemini';
}

async function resolveAllKeys(body = {}, forceDb = false) {
    const dbCfg = await ucitajDbAiConfig(forceDb);

    let groqKey = String(body.groqKey || '').trim();
    let geminiKey = String(body.geminiKey || '').trim();
    let openaiKey = '';
    let anthropicKey = '';
    let openrouterKey = '';

    // Ako je korisnik poslao jedan generički apiKey, razvrstaj ga po prefiksu
    const singleKey = String(body.apiKey || '').trim();
    if (singleKey) {
        const p = detectProvider(singleKey);
        if (p === 'groq' && !groqKey) groqKey = singleKey;
        else if (p === 'gemini' && !geminiKey) geminiKey = singleKey;
        else if (p === 'openai') openaiKey = singleKey;
        else if (p === 'anthropic') anthropicKey = singleKey;
        else if (p === 'openrouter') openrouterKey = singleKey;
    }

    // Popuni iz env varijabli i iz Supabase ui_postavke (nikad hardkodirano u git!)
    if (!groqKey) groqKey = String(process.env.GROQ_API_KEY || dbCfg.groqKey || '').trim();
    if (!geminiKey) geminiKey = String(process.env.GEMINI_API_KEY || dbCfg.geminiKey || '').trim();
    if (!openaiKey) openaiKey = String(process.env.OPENAI_API_KEY || '').trim();
    if (!anthropicKey) anthropicKey = String(process.env.ANTHROPIC_API_KEY || '').trim();
    if (!openrouterKey) openrouterKey = String(process.env.OPENROUTER_API_KEY || '').trim();

    if (dbCfg.apiKey) {
        const p = detectProvider(dbCfg.apiKey);
        if (p === 'groq' && !groqKey) groqKey = String(dbCfg.apiKey).trim();
        if (p === 'gemini' && !geminiKey) geminiKey = String(dbCfg.apiKey).trim();
        if (p === 'openai' && !openaiKey) openaiKey = String(dbCfg.apiKey).trim();
        if (p === 'anthropic' && !anthropicKey) anthropicKey = String(dbCfg.apiKey).trim();
        if (p === 'openrouter' && !openrouterKey) openrouterKey = String(dbCfg.apiKey).trim();
    }

    return {
        groqKey,
        geminiKey,
        openaiKey,
        anthropicKey,
        openrouterKey,
        savedModel: String(dbCfg.model || '').trim(),
    };
}

function parseJsonSafe(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            try {
                return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
            } catch (e2) {
                return null;
            }
        }
        return null;
    }
}

function sanitizeResponsePayload(parsed) {
    if (!parsed || typeof parsed !== 'object') return null;
    const odgovor = typeof parsed.odgovor === 'string' && parsed.odgovor.trim()
        ? parsed.odgovor.trim()
        : null;
    if (!odgovor) return null;

    const kpi = Array.isArray(parsed.kpi)
        ? parsed.kpi.slice(0, 6).filter((k) => k && k.label && k.value !== undefined).map((k) => ({
            label: String(k.label),
            value: String(k.value),
            sub: k.sub ? String(k.sub) : '',
            color: ['emerald', 'blue', 'amber', 'red', 'purple'].includes(k.color) ? k.color : 'blue',
        }))
        : [];

    let chart = null;
    if (parsed.chart && Array.isArray(parsed.chart.data) && parsed.chart.data.length > 0 && Array.isArray(parsed.chart.series) && parsed.chart.series.length > 0) {
        chart = {
            title: String(parsed.chart.title || 'Analitički Dijagram'),
            subtitle: String(parsed.chart.subtitle || ''),
            type: ['bar', 'hbar', 'area', 'line', 'donut', 'pie', 'composed'].includes(parsed.chart.type) ? parsed.chart.type : 'bar',
            xKey: String(parsed.chart.xKey || 'naziv'),
            unit: String(parsed.chart.unit || ''),
            series: parsed.chart.series.slice(0, 4).map((s, idx) => ({
                key: String(s.key || `v${idx + 1}`),
                name: String(s.name || s.key || `Serija ${idx + 1}`),
                color: String(s.color || ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'][idx % 4]),
                unit: s.unit !== undefined ? String(s.unit) : String(parsed.chart.unit || ''),
            })),
            data: parsed.chart.data.slice(0, 30),
        };
    }

    let tabela = null;
    if (parsed.tabela && Array.isArray(parsed.tabela.kolone) && parsed.tabela.kolone.length > 0 && Array.isArray(parsed.tabela.redovi) && parsed.tabela.redovi.length > 0) {
        tabela = {
            naslov: String(parsed.tabela.naslov || 'Detaljni Podaci'),
            kolone: parsed.tabela.kolone.slice(0, 10).map((c) => ({
                key: String(c.key),
                label: String(c.label || c.key),
                type: c.type === 'number' ? 'number' : 'string',
                align: c.align === 'right' || c.type === 'number' ? 'right' : 'left',
                suffix: c.suffix ? String(c.suffix) : '',
            })),
            redovi: parsed.tabela.redovi.slice(0, 80),
        };
    }

    const predlozi = Array.isArray(parsed.predlozi)
        ? parsed.predlozi.map((p) => String(p).trim()).filter(Boolean).slice(0, 4)
        : [];

    return {
        naslov: parsed.naslov ? String(parsed.naslov) : '',
        odgovor,
        kpi,
        chart,
        tabela,
        predlozi,
    };
}

async function fetchWithTimeout(url, options, timeoutMs = 14000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function callGroq({ apiKey, requestedModel, systemPrompt, history, userPrompt }) {
    const candidates = Array.from(new Set([
        ...(requestedModel && (requestedModel.startsWith('openai/gpt-oss') || requestedModel.startsWith('qwen/')) ? [requestedModel] : []),
        'openai/gpt-oss-120b',
        'qwen/qwen3.8-27b',
        'openai/gpt-oss-20b',
    ]));

    let lastErr = 'GROQ_UNAVAILABLE';
    for (const model of candidates) {
        try {
            const messages = [
                { role: 'system', content: systemPrompt },
                ...history.map((h) => ({
                    role: h.role === 'user' ? 'user' : 'assistant',
                    content: String(h.text || '').slice(0, 1600),
                })),
                { role: 'user', content: userPrompt },
            ];

            const resp = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    temperature: 0.25,
                    response_format: { type: 'json_object' },
                    messages,
                }),
            }, 18000);

            if (resp.ok) {
                const json = await resp.json();
                const rawText = json?.choices?.[0]?.message?.content || '';
                if (rawText.trim()) return { ok: true, provider: 'groq', model, rawText };
            } else {
                const errTxt = await resp.text().catch(() => '');
                lastErr = `GROQ_${resp.status}: ${errTxt.slice(0, 160)}`;
                if (resp.status === 401 || resp.status === 403) break;
            }
        } catch (e) {
            lastErr = `GROQ_ERR: ${e?.name === 'AbortError' ? 'TIMEOUT' : e?.message}`;
        }
    }
    return { ok: false, provider: 'groq', error: lastErr };
}

async function callGemini({ apiKey, requestedModel, systemPrompt, history, userPrompt }) {
    const candidates = Array.from(new Set([
        ...(requestedModel && requestedModel.startsWith('gemini-') ? [requestedModel] : []),
        'gemini-3.1-flash-lite',
        'gemini-3.8-flash',
        'gemini-3.7-flash',
        'gemini-flash-latest',
    ]));

    let lastErr = 'GEMINI_UNAVAILABLE';
    for (const model of candidates) {
        try {
            const contents = [
                ...history.map((h) => ({
                    role: h.role === 'user' ? 'user' : 'model',
                    parts: [{ text: String(h.text || '').slice(0, 1600) }],
                })),
                { role: 'user', parts: [{ text: userPrompt }] },
            ];

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
            const resp = await fetchWithTimeout(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents,
                    generationConfig: {
                        temperature: 0.25,
                        responseMimeType: 'application/json',
                    },
                }),
            }, 10000);

            if (resp.ok) {
                const json = await resp.json();
                const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (rawText.trim()) return { ok: true, provider: 'gemini', model, rawText };
            } else {
                const errTxt = await resp.text().catch(() => '');
                lastErr = `GEMINI_${resp.status}: ${errTxt.slice(0, 160)}`;
                if (resp.status === 401 || resp.status === 403 || errTxt.includes('API_KEY_INVALID')) break;
            }
        } catch (e) {
            lastErr = `GEMINI_ERR: ${e?.name === 'AbortError' ? 'TIMEOUT' : e?.message}`;
        }
    }
    return { ok: false, provider: 'gemini', error: lastErr };
}

async function callOpenAICompatible({ endpoint, provider, apiKey, model, systemPrompt, history, userPrompt, extraHeaders = {} }) {
    try {
        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.map((h) => ({
                role: h.role === 'user' ? 'user' : 'assistant',
                content: String(h.text || '').slice(0, 1600),
            })),
            { role: 'user', content: userPrompt },
        ];
        const resp = await fetchWithTimeout(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
                ...extraHeaders,
            },
            body: JSON.stringify({
                model,
                temperature: 0.25,
                response_format: { type: 'json_object' },
                messages,
            }),
        }, 18000);
        if (!resp.ok) {
            const errTxt = await resp.text().catch(() => '');
            return { ok: false, provider, error: `HTTP_${resp.status}: ${errTxt.slice(0, 160)}` };
        }
        const json = await resp.json();
        const rawText = json?.choices?.[0]?.message?.content || '';
        return { ok: true, provider, model, rawText };
    } catch (e) {
        return { ok: false, provider, error: String(e?.message || e) };
    }
}

async function callAnthropic({ apiKey, requestedModel, systemPrompt, history, userPrompt }) {
    try {
        const model = requestedModel && requestedModel.startsWith('claude-') ? requestedModel : 'claude-sonnet-4-20250514';
        const messages = [
            ...history.map((h) => ({
                role: h.role === 'user' ? 'user' : 'assistant',
                content: String(h.text || '').slice(0, 1600),
            })),
            { role: 'user', content: userPrompt },
        ];
        const resp = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({ model, max_tokens: 4096, temperature: 0.25, system: systemPrompt, messages }),
        }, 20000);
        if (!resp.ok) {
            const errTxt = await resp.text().catch(() => '');
            return { ok: false, provider: 'anthropic', error: `CLAUDE_${resp.status}: ${errTxt.slice(0, 160)}` };
        }
        const json = await resp.json();
        return { ok: true, provider: 'anthropic', model, rawText: json?.content?.[0]?.text || '' };
    } catch (e) {
        return { ok: false, provider: 'anthropic', error: String(e?.message || e) };
    }
}

export async function GET() {
    const keys = await resolveAllKeys({}, true);
    const hasGroq = Boolean(keys.groqKey);
    const hasGemini = Boolean(keys.geminiKey);
    const hasOpenai = Boolean(keys.openaiKey);
    const hasAnthropic = Boolean(keys.anthropicKey);
    const hasOpenrouter = Boolean(keys.openrouterKey);
    const hasAny = hasGroq || hasGemini || hasOpenai || hasAnthropic || hasOpenrouter;

    const primary = hasGroq ? 'groq' : (hasGemini ? 'gemini' : (hasOpenai ? 'openai' : (hasAnthropic ? 'anthropic' : (hasOpenrouter ? 'openrouter' : null))));
    return NextResponse.json({
        hasServerKey: hasAny,
        hasGroq,
        hasGemini,
        serverProvider: primary,
        defaultModel: keys.savedModel || (hasGroq ? 'openai/gpt-oss-120b' : (hasGemini ? 'gemini-3.8-flash' : '')),
    });
}

export async function POST(request) {
    try {
        const body = await request.json();
        const action = String(body?.action || 'chat');
        const message = String(body?.message || '').trim();
        const history = Array.isArray(body?.history) ? body.history.slice(-6).map((h) => ({ role: h.role, text: String(h.text || '').slice(0, 600) })) : [];
        const erpContext = body?.erpContext || {};
        const requestedModel = String(body?.model || '').trim();

        const keys = await resolveAllKeys(body, action === 'test');
        const hasAnyKey = Boolean(keys.groqKey || keys.geminiKey || keys.openaiKey || keys.anthropicKey || keys.openrouterKey);

        if (!hasAnyKey) {
            return NextResponse.json({ ok: false, mode: 'local', reason: 'NO_API_KEY' }, { status: 200 });
        }

        // Test akcija: provjerava sve dostupne ključeve uživo!
        if (action === 'test') {
            const testPrompt = 'Vrati JSON: {"naslov":"Test","odgovor":"Veza aktivna.","kpi":[],"chart":null,"tabela":null,"predlozi":[]}';
            const results = [];
            if (keys.groqKey) {
                const t0 = Date.now();
                const r = await callGroq({ apiKey: keys.groqKey, requestedModel, systemPrompt: 'Vrati isključivo validan JSON.', history: [], userPrompt: testPrompt });
                results.push({ provider: 'groq', ok: r.ok, model: r.model, ms: Date.now() - t0, error: r.error || null });
            }
            if (keys.geminiKey) {
                const t0 = Date.now();
                const r = await callGemini({ apiKey: keys.geminiKey, requestedModel, systemPrompt: 'Vrati isključivo validan JSON.', history: [], userPrompt: testPrompt });
                results.push({ provider: 'gemini', ok: r.ok, model: r.model, ms: Date.now() - t0, error: r.error || null });
            }
            if (keys.openaiKey) {
                const t0 = Date.now();
                const r = await callOpenAICompatible({ endpoint: 'https://api.openai.com/v1/chat/completions', provider: 'openai', apiKey: keys.openaiKey, model: requestedModel.startsWith('gpt-') ? requestedModel : 'gpt-4o-mini', systemPrompt: 'Vrati isključivo validan JSON.', history: [], userPrompt: testPrompt });
                results.push({ provider: 'openai', ok: r.ok, model: r.model, ms: Date.now() - t0, error: r.error || null });
            }
            const firstOk = results.find((x) => x.ok);
            return NextResponse.json({
                ok: Boolean(firstOk),
                provider: firstOk?.provider || results[0]?.provider || null,
                model: firstOk?.model || requestedModel,
                results,
                error: firstOk ? null : (results.map((r) => `${r.provider}: ${r.error}`).join(' | ') || 'FAILED'),
            }, { status: 200 });
        }

        if (!message) {
            return NextResponse.json({ ok: false, mode: 'local', reason: 'EMPTY_MESSAGE' }, { status: 200 });
        }

        const tStart = Date.now();
        let ctxStr = JSON.stringify(erpContext);
        if (ctxStr.length > 14000 && erpContext && typeof erpContext === 'object') {
            const slim = {
                datum_danas: erpContext.datum_danas,
                trazeni_period: erpContext.trazeni_period,
                ovaj_vs_prosli_mjesec: erpContext.ovaj_vs_prosli_mjesec,
                anomalije: erpContext.anomalije,
                pronadjeni_specificni_zapisi: erpContext.pronadjeni_specificni_zapisi,
                finansije: erpContext.finansije ? {
                    ukupnoFakturisanoKM: erpContext.finansije.ukupnoFakturisanoKM,
                    ukupnoFakturisanoM3: erpContext.finansije.ukupnoFakturisanoM3,
                    otvoreniDugKM: erpContext.finansije.otvoreniDugKM,
                    dospjeliDugKM: erpContext.finansije.dospjeliDugKM,
                    stanjeKaseKM: erpContext.finansije.stanjeKaseKM,
                    aging: erpContext.finansije.aging,
                    topKupci: (erpContext.finansije.topKupci || []).slice(0, 6),
                } : undefined,
                lager_i_paketi: erpContext.lager_i_paketi,
                trupci: erpContext.trupci,
            };
            ctxStr = JSON.stringify(slim).slice(0, 14500);
        }
        const contextBlock = `TRENUTNI PODACI IZ PILANA-ERP BAZE (JSON):\n${ctxStr}`;
        const userPrompt = `${contextBlock}\n\nPITANJE DIREKTORA / KORISNIKA:\n${message}`;

        // Odredi redoslijed provajdera sa automatskim failoverom!
        const wantsGeminiFirst = requestedModel.startsWith('gemini-');
        const wantsOpenaiFirst = requestedModel.startsWith('gpt-');
        const wantsClaudeFirst = requestedModel.startsWith('claude-');

        const queue = [];
        if (wantsGeminiFirst && keys.geminiKey) queue.push('gemini');
        if (wantsOpenaiFirst && keys.openaiKey) queue.push('openai');
        if (wantsClaudeFirst && keys.anthropicKey) queue.push('anthropic');

        // Default primarni je Groq (openai/gpt-oss-120b — ultra-brz 0.4s!), pa Gemini, pa ostali
        if (keys.groqKey && !queue.includes('groq')) queue.push('groq');
        if (keys.geminiKey && !queue.includes('gemini')) queue.push('gemini');
        if (keys.openaiKey && !queue.includes('openai')) queue.push('openai');
        if (keys.anthropicKey && !queue.includes('anthropic')) queue.push('anthropic');
        if (keys.openrouterKey && !queue.includes('openrouter')) queue.push('openrouter');

        let llmRes = null;
        const errors = [];

        for (const prov of queue) {
            let attempt;
            if (prov === 'groq') {
                attempt = await callGroq({ apiKey: keys.groqKey, requestedModel, systemPrompt: SYSTEM_INSTRUCTION, history, userPrompt });
            } else if (prov === 'gemini') {
                attempt = await callGemini({ apiKey: keys.geminiKey, requestedModel, systemPrompt: SYSTEM_INSTRUCTION, history, userPrompt });
            } else if (prov === 'openai') {
                attempt = await callOpenAICompatible({ endpoint: 'https://api.openai.com/v1/chat/completions', provider: 'openai', apiKey: keys.openaiKey, model: requestedModel.startsWith('gpt-') ? requestedModel : 'gpt-4o-mini', systemPrompt: SYSTEM_INSTRUCTION, history, userPrompt });
            } else if (prov === 'anthropic') {
                attempt = await callAnthropic({ apiKey: keys.anthropicKey, requestedModel, systemPrompt: SYSTEM_INSTRUCTION, history, userPrompt });
            } else if (prov === 'openrouter') {
                attempt = await callOpenAICompatible({ endpoint: 'https://openrouter.ai/api/v1/chat/completions', provider: 'openrouter', apiKey: keys.openrouterKey, model: requestedModel.includes('/') ? requestedModel : 'google/gemini-3.8-flash', systemPrompt: SYSTEM_INSTRUCTION, history, userPrompt, extraHeaders: { 'HTTP-Referer': 'https://pilana-erp.vercel.app', 'X-Title': 'Pilana-ERP AI Kontrolor' } });
            }

            if (attempt?.ok) {
                llmRes = attempt;
                break;
            }
            if (attempt?.error) errors.push(attempt.error);
        }

        if (!llmRes?.ok) {
            return NextResponse.json({ ok: false, mode: 'local', reason: errors.join(' | ') || 'LLM_FAILED' }, { status: 200 });
        }

        const elapsedMs = Date.now() - tStart;
        const parsed = sanitizeResponsePayload(parseJsonSafe(llmRes.rawText));
        if (!parsed) {
            if (llmRes.rawText && llmRes.rawText.trim().length > 20) {
                return NextResponse.json({
                    ok: true,
                    mode: llmRes.provider,
                    model: llmRes.model,
                    ms: elapsedMs,
                    data: {
                        naslov: 'AI ERP Analiza',
                        odgovor: llmRes.rawText.trim(),
                        kpi: [],
                        chart: null,
                        tabela: null,
                        predlozi: ['Prikaži mi ovo sa dijagramom', 'Uporedi ovaj i prošli mjesec', 'Pronađi najveće rizike u firmi'],
                    },
                }, { status: 200 });
            }
            return NextResponse.json({ ok: false, mode: 'local', reason: 'INVALID_JSON' }, { status: 200 });
        }

        return NextResponse.json({
            ok: true,
            mode: llmRes.provider,
            model: llmRes.model,
            ms: elapsedMs,
            data: parsed,
        }, { status: 200 });
    } catch (err) {
        return NextResponse.json({ ok: false, mode: 'local', reason: 'SERVER_ERROR', detail: String(err?.message || err) }, { status: 200 });
    }
}
