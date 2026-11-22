import { NextResponse } from 'next/server';

const SYSTEM_INSTRUCTION = `Ti si elitni AI Direktorski Analitičar i ERP Kontrolor za pilanu i drvnu industriju (TTM Pilana-ERP).
Komuniciraš prirodno, jasno, precizno i prijateljski na bosanskom/hrvatskom jeziku — baš kao vrhunski lični poslovni savjetnik.

PRAVILA:
1. Koristi ISKLJUČIVO stvarne podatke iz dostavljenog ERP konteksta (erpContext). Nikad ne izmišljaj brojke! Ako nešto nedostaje u bazi, to jasno reci.
2. Kada korisnik traži POREĐENJE (npr. ovaj vs prošli mjesec, mašina vs mašina, kupac vs kupac, prorez vs izlaz), obavezno izračunaj apsolutne razlike i procente promjene (%).
3. Za svaki izvještaj ili analizu, uvijek kada ima smisla pripremi i vizualizaciju ("chart") sa čistim numeričkim podacima i preglednu tabelu ("tabela") kako bi korisnik mogao odmah da vidi dijagram i isprinta PDF ili izveze Excel.
4. Odgovor MORA biti isključivo validan JSON objekat (bez markdown code-block ograda) sljedeće strukture:
{
  "naslov": "Kratak naslov izvještaja (npr. Poređenje Ovaj vs Prošli Mjesec)",
  "odgovor": "Prirodan konverzacijski odgovor u Markdown formatu (koristi ### podnaslove, **podebljane brojeve**, i bullet liste - ...). Budi konkretan i daj jasne preporuke direktoru.",
  "kpi": [
    { "label": "Naziv metrike", "value": "12.450,00 KM", "sub": "kratki kontekst ili % promjene", "color": "emerald|blue|amber|red|purple" }
  ],
  "chart": {
    "title": "Naslov grafikona",
    "subtitle": "Kratki opis perioda/metrike",
    "type": "bar|hbar|area|line|donut|pie|composed",
    "xKey": "naziv",
    "unit": "KM ili m³ ili % ili kom",
    "series": [
      { "key": "v1", "name": "Naziv serije 1", "color": "#3b82f6", "unit": "m³" }
    ],
    "data": [
      { "naziv": "Kategorija 1", "v1": 12.5 }
    ]
  },
  "tabela": {
    "naslov": "Naslov detaljne tabele",
    "kolone": [
      { "key": "naziv", "label": "Naziv", "type": "string", "align": "left" },
      { "key": "vrijednost", "label": "Vrijednost", "type": "number", "align": "right", "suffix": " KM" }
    ],
    "redovi": [
      { "naziv": "Stavka 1", "vrijednost": 100.5 }
    ]
  },
  "predlozi": [
    "Sljedeće pametno pitanje za nastavak analize 1",
    "Sljedeće pametno pitanje 2",
    "Sljedeće pametno pitanje 3"
  ]
}
Ako je korisnik samo pozdravio ili postavio kratko pitanje gdje tabela/dijagram nisu potrebni, stavi "chart": null i "tabela": null, ali "odgovor" i "predlozi" uvijek popuni.`;

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
            data: parsed.chart.data.slice(0, 24),
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
            redovi: parsed.tabela.redovi.slice(0, 60),
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

export async function POST(request) {
    try {
        const body = await request.json();
        const message = String(body?.message || '').trim();
        const history = Array.isArray(body?.history) ? body.history.slice(-10) : [];
        const erpContext = body?.erpContext || {};
        const userKey = String(body?.apiKey || '').trim();
        const requestedModel = String(body?.model || '').trim();

        if (!message) {
            return NextResponse.json({ ok: false, mode: 'local', reason: 'EMPTY_MESSAGE' }, { status: 200 });
        }

        const effectiveKey = userKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '';
        if (!effectiveKey) {
            return NextResponse.json({ ok: false, mode: 'local', reason: 'NO_API_KEY' }, { status: 200 });
        }

        const contextBlock = `TRENUTNI PODACI IZ PILANA-ERP BAZE (JSON):\n${JSON.stringify(erpContext)}`;
        const isOpenAI = effectiveKey.startsWith('sk-');

        if (isOpenAI) {
            const openaiModel = requestedModel && requestedModel.startsWith('gpt-') ? requestedModel : 'gpt-4o-mini';
            const messages = [
                { role: 'system', content: `${SYSTEM_INSTRUCTION}\n\n${contextBlock}` },
                ...history.map((h) => ({
                    role: h.role === 'user' ? 'user' : 'assistant',
                    content: String(h.text || '').slice(0, 1500),
                })),
                { role: 'user', content: message },
            ];

            const resp = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${effectiveKey}`,
                },
                body: JSON.stringify({
                    model: openaiModel,
                    temperature: 0.35,
                    response_format: { type: 'json_object' },
                    messages,
                }),
            });

            if (!resp.ok) {
                const errTxt = await resp.text().catch(() => '');
                return NextResponse.json({ ok: false, mode: 'local', reason: `OPENAI_HTTP_${resp.status}`, detail: errTxt.slice(0, 220) }, { status: 200 });
            }

            const json = await resp.json();
            const content = json?.choices?.[0]?.message?.content || '';
            const parsed = sanitizeResponsePayload(parseJsonSafe(content));
            if (!parsed) {
                return NextResponse.json({ ok: false, mode: 'local', reason: 'INVALID_JSON' }, { status: 200 });
            }

            return NextResponse.json({ ok: true, mode: 'openai', model: openaiModel, data: parsed }, { status: 200 });
        }

        // Google Gemini API
        const geminiModel = requestedModel && requestedModel.startsWith('gemini-') ? requestedModel : 'gemini-2.5-flash';
        const contents = [
            ...history.map((h) => ({
                role: h.role === 'user' ? 'user' : 'model',
                parts: [{ text: String(h.text || '').slice(0, 1500) }],
            })),
            {
                role: 'user',
                parts: [{ text: `${contextBlock}\n\nPITANJE KORISNIKA:\n${message}` }],
            },
        ];

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(effectiveKey)}`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
                contents,
                generationConfig: {
                    temperature: 0.35,
                    responseMimeType: 'application/json',
                },
            }),
        });

        if (!resp.ok) {
            const errTxt = await resp.text().catch(() => '');
            return NextResponse.json({ ok: false, mode: 'local', reason: `GEMINI_HTTP_${resp.status}`, detail: errTxt.slice(0, 220) }, { status: 200 });
        }

        const json = await resp.json();
        const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = sanitizeResponsePayload(parseJsonSafe(rawText));
        if (!parsed) {
            return NextResponse.json({ ok: false, mode: 'local', reason: 'INVALID_JSON' }, { status: 200 });
        }

        return NextResponse.json({ ok: true, mode: 'gemini', model: geminiModel, data: parsed }, { status: 200 });
    } catch (err) {
        return NextResponse.json({ ok: false, mode: 'local', reason: 'SERVER_ERROR', detail: String(err?.message || err) }, { status: 200 });
    }
}
