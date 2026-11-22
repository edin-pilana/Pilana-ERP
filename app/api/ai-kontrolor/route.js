import { NextResponse } from 'next/server';

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
  "naslov": "Jasan naslov izvještaja (npr. Analiza Profitabilnosti i Marži — Novembar 2026)",
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

function detectProvider(apiKey) {
    const k = String(apiKey || '').trim();
    if (!k) return null;
    if (k.startsWith('AIza')) return 'gemini';
    if (k.startsWith('gsk_')) return 'groq';
    if (k.startsWith('sk-ant-')) return 'anthropic';
    if (k.startsWith('sk-or-')) return 'openrouter';
    if (k.startsWith('sk-')) return 'openai';
    return 'gemini';
}

function resolveServerKey() {
    if (process.env.GEMINI_API_KEY) return { key: process.env.GEMINI_API_KEY.trim(), provider: 'gemini' };
    if (process.env.GROQ_API_KEY) return { key: process.env.GROQ_API_KEY.trim(), provider: 'groq' };
    if (process.env.OPENAI_API_KEY) return { key: process.env.OPENAI_API_KEY.trim(), provider: 'openai' };
    if (process.env.ANTHROPIC_API_KEY) return { key: process.env.ANTHROPIC_API_KEY.trim(), provider: 'anthropic' };
    if (process.env.OPENROUTER_API_KEY) return { key: process.env.OPENROUTER_API_KEY.trim(), provider: 'openrouter' };
    return { key: '', provider: null };
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

async function callGemini({ apiKey, requestedModel, systemPrompt, history, userPrompt }) {
    const candidates = Array.from(new Set([
        ...(requestedModel && requestedModel.startsWith('gemini-') ? [requestedModel] : []),
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-2.5-flash-lite',
        'gemini-1.5-flash',
    ]));

    let lastErr = 'GEMINI_UNAVAILABLE';
    for (const model of candidates) {
        const contents = [
            ...history.map((h) => ({
                role: h.role === 'user' ? 'user' : 'model',
                parts: [{ text: String(h.text || '').slice(0, 1800) }],
            })),
            { role: 'user', parts: [{ text: userPrompt }] },
        ];

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const resp = await fetch(url, {
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
        });

        if (resp.ok) {
            const json = await resp.json();
            const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return { ok: true, model, rawText };
        }

        const errTxt = await resp.text().catch(() => '');
        lastErr = `GEMINI_${resp.status}: ${errTxt.slice(0, 180)}`;
        // Ako je nevažeći API ključ (400 API_KEY_INVALID ili 401/403), nema smisla pokušavati druge modele
        if (resp.status === 401 || resp.status === 403 || errTxt.includes('API_KEY_INVALID')) {
            break;
        }
    }
    return { ok: false, error: lastErr };
}

async function callOpenAICompatible({ endpoint, apiKey, model, systemPrompt, history, userPrompt, extraHeaders = {} }) {
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map((h) => ({
            role: h.role === 'user' ? 'user' : 'assistant',
            content: String(h.text || '').slice(0, 1800),
        })),
        { role: 'user', content: userPrompt },
    ];

    const resp = await fetch(endpoint, {
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
    });

    if (!resp.ok) {
        const errTxt = await resp.text().catch(() => '');
        return { ok: false, error: `HTTP_${resp.status}: ${errTxt.slice(0, 180)}` };
    }
    const json = await resp.json();
    const rawText = json?.choices?.[0]?.message?.content || '';
    return { ok: true, model, rawText };
}

async function callAnthropic({ apiKey, requestedModel, systemPrompt, history, userPrompt }) {
    const model = requestedModel && requestedModel.startsWith('claude-') ? requestedModel : 'claude-sonnet-4-20250514';
    const messages = [
        ...history.map((h) => ({
            role: h.role === 'user' ? 'user' : 'assistant',
            content: String(h.text || '').slice(0, 1800),
        })),
        { role: 'user', content: userPrompt },
    ];

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model,
            max_tokens: 4096,
            temperature: 0.25,
            system: systemPrompt,
            messages,
        }),
    });

    if (!resp.ok) {
        const errTxt = await resp.text().catch(() => '');
        return { ok: false, error: `CLAUDE_${resp.status}: ${errTxt.slice(0, 180)}` };
    }
    const json = await resp.json();
    const rawText = json?.content?.[0]?.text || '';
    return { ok: true, model, rawText };
}

export async function GET() {
    const srv = resolveServerKey();
    return NextResponse.json({
        hasServerKey: Boolean(srv.key),
        serverProvider: srv.provider,
    });
}

export async function POST(request) {
    try {
        const body = await request.json();
        const action = String(body?.action || 'chat');
        const message = String(body?.message || '').trim();
        const history = Array.isArray(body?.history) ? body.history.slice(-12) : [];
        const erpContext = body?.erpContext || {};
        const userKey = String(body?.apiKey || '').trim();
        const requestedModel = String(body?.model || '').trim();

        const serverFallback = resolveServerKey();
        const effectiveKey = userKey || serverFallback.key;
        if (!effectiveKey) {
            return NextResponse.json({ ok: false, mode: 'local', reason: 'NO_API_KEY' }, { status: 200 });
        }

        const provider = userKey ? detectProvider(userKey) : serverFallback.provider;

        // Ping / Test mode za dugme "⚡ Testiraj Ključ"
        if (action === 'test') {
            const testPrompt = 'Vrati JSON: {"naslov":"Test","odgovor":"Veza aktivna.","kpi":[],"chart":null,"tabela":null,"predlozi":[]}';
            let res;
            if (provider === 'gemini') {
                res = await callGemini({ apiKey: effectiveKey, requestedModel, systemPrompt: 'Vrati isključivo validan JSON.', history: [], userPrompt: testPrompt });
            } else if (provider === 'groq') {
                res = await callOpenAICompatible({ endpoint: 'https://api.groq.com/openai/v1/chat/completions', apiKey: effectiveKey, model: requestedModel.startsWith('llama-') ? requestedModel : 'llama-3.3-70b-versatile', systemPrompt: 'Vrati isključivo validan JSON.', history: [], userPrompt: testPrompt });
            } else if (provider === 'anthropic') {
                res = await callAnthropic({ apiKey: effectiveKey, requestedModel, systemPrompt: 'Vrati isključivo validan JSON.', history: [], userPrompt: testPrompt });
            } else if (provider === 'openrouter') {
                res = await callOpenAICompatible({ endpoint: 'https://openrouter.ai/api/v1/chat/completions', apiKey: effectiveKey, model: requestedModel.includes('/') ? requestedModel : 'google/gemini-2.5-flash', systemPrompt: 'Vrati isključivo validan JSON.', history: [], userPrompt: testPrompt });
            } else {
                res = await callOpenAICompatible({ endpoint: 'https://api.openai.com/v1/chat/completions', apiKey: effectiveKey, model: requestedModel.startsWith('gpt-') ? requestedModel : 'gpt-4o-mini', systemPrompt: 'Vrati isključivo validan JSON.', history: [], userPrompt: testPrompt });
            }
            return NextResponse.json({
                ok: res.ok,
                provider,
                model: res.model || requestedModel,
                error: res.ok ? null : res.error,
            }, { status: 200 });
        }

        if (!message) {
            return NextResponse.json({ ok: false, mode: 'local', reason: 'EMPTY_MESSAGE' }, { status: 200 });
        }

        const contextBlock = `TRENUTNI PODACI IZ PILANA-ERP BAZE (JSON):\n${JSON.stringify(erpContext)}`;
        const userPrompt = `${contextBlock}\n\nPITANJE DIREKTORA / KORISNIKA:\n${message}`;

        let llmRes;
        if (provider === 'gemini') {
            llmRes = await callGemini({ apiKey: effectiveKey, requestedModel, systemPrompt: SYSTEM_INSTRUCTION, history, userPrompt });
        } else if (provider === 'groq') {
            const groqModel = requestedModel.startsWith('llama-') || requestedModel.startsWith('qwen') ? requestedModel : 'llama-3.3-70b-versatile';
            llmRes = await callOpenAICompatible({
                endpoint: 'https://api.groq.com/openai/v1/chat/completions',
                apiKey: effectiveKey,
                model: groqModel,
                systemPrompt: SYSTEM_INSTRUCTION,
                history,
                userPrompt,
            });
        } else if (provider === 'anthropic') {
            llmRes = await callAnthropic({ apiKey: effectiveKey, requestedModel, systemPrompt: SYSTEM_INSTRUCTION, history, userPrompt });
        } else if (provider === 'openrouter') {
            const orModel = requestedModel.includes('/') ? requestedModel : 'google/gemini-2.5-flash';
            llmRes = await callOpenAICompatible({
                endpoint: 'https://openrouter.ai/api/v1/chat/completions',
                apiKey: effectiveKey,
                model: orModel,
                systemPrompt: SYSTEM_INSTRUCTION,
                history,
                userPrompt,
                extraHeaders: { 'HTTP-Referer': 'https://pilana-erp.vercel.app', 'X-Title': 'Pilana-ERP AI Kontrolor' },
            });
        } else {
            const openaiModel = requestedModel.startsWith('gpt-') || requestedModel.startsWith('o3') || requestedModel.startsWith('o4') ? requestedModel : 'gpt-4o-mini';
            llmRes = await callOpenAICompatible({
                endpoint: 'https://api.openai.com/v1/chat/completions',
                apiKey: effectiveKey,
                model: openaiModel,
                systemPrompt: SYSTEM_INSTRUCTION,
                history,
                userPrompt,
            });
        }

        if (!llmRes.ok) {
            return NextResponse.json({ ok: false, mode: 'local', reason: llmRes.error || 'LLM_FAILED' }, { status: 200 });
        }

        const parsed = sanitizeResponsePayload(parseJsonSafe(llmRes.rawText));
        if (!parsed) {
            // Ako model vrati običan tekst umjesto JSON-a, sačuvaj taj moćan tekst umjesto da ga baciš!
            if (llmRes.rawText && llmRes.rawText.trim().length > 20) {
                return NextResponse.json({
                    ok: true,
                    mode: provider,
                    model: llmRes.model,
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

        return NextResponse.json({ ok: true, mode: provider, model: llmRes.model, data: parsed }, { status: 200 });
    } catch (err) {
        return NextResponse.json({ ok: false, mode: 'local', reason: 'SERVER_ERROR', detail: String(err?.message || err) }, { status: 200 });
    }
}
