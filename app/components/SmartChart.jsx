"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    ResponsiveContainer,
    BarChart, Bar,
    AreaChart, Area,
    LineChart, Line,
    PieChart, Pie, Cell,
    ComposedChart,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList, Label,
} from 'recharts';
import { SlidersHorizontal, Maximize2, Minimize2, Printer, RotateCcw, Check, BarChart3, TrendingUp, PieChart as PieIcon, Activity, Layers, AlignLeft } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { printDokument } from '../utils/printHelpers';
import { escapeHtml } from '../utils/dateHelpers';

export const SMART_PALETTE = [
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#ef4444', // Red
    '#f97316', // Orange
    '#14b8a6', // Teal
    '#6366f1', // Indigo
];

const CHART_TYPES = [
    { id: 'bar', label: 'Stubovi', short: 'Bar', icon: BarChart3 },
    { id: 'hbar', label: 'Horizontalni', short: 'H-Bar', icon: AlignLeft },
    { id: 'area', label: 'Površina', short: 'Area', icon: Activity },
    { id: 'line', label: 'Linija', short: 'Line', icon: TrendingUp },
    { id: 'donut', label: 'Prsten', short: 'Donut', icon: PieIcon },
    { id: 'pie', label: 'Pita', short: 'Pie', icon: PieIcon },
    { id: 'composed', label: 'Kombo', short: 'Kombo', icon: Layers },
];

const LS_KEY = 'erp_smartchart_prefs_v1';
const DB_KEY = 'smartchart_postavke';

let remoteLoaded = false;
let remoteCache = null;
let saveDebounceTimer = null;

const readAllLocalPrefs = () => {
    if (remoteCache && typeof remoteCache === 'object') return remoteCache;
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(LS_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        remoteCache = (parsed && typeof parsed === 'object') ? parsed : {};
        return remoteCache;
    } catch (e) {
        return {};
    }
};

const writePref = (chartId, cfg) => {
    if (!chartId || typeof window === 'undefined') return;
    const all = { ...readAllLocalPrefs(), [chartId]: cfg };
    remoteCache = all;
    try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch (e) {}
    window.dispatchEvent(new CustomEvent('smartchart_updated', { detail: { chartId, config: cfg } }));

    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
        supabase.from('ui_postavke')
            .upsert([{ modul_ime: DB_KEY, postavke_jsonb: all }], { onConflict: 'modul_ime' })
            .then(() => {});
    }, 700);
};

const syncRemotePrefsOnce = async () => {
    if (remoteLoaded || typeof window === 'undefined') return;
    remoteLoaded = true;
    try {
        const { data } = await supabase.from('ui_postavke').select('postavke_jsonb').eq('modul_ime', DB_KEY).maybeSingle();
        if (data?.postavke_jsonb && typeof data.postavke_jsonb === 'object') {
            const merged = { ...data.postavke_jsonb, ...readAllLocalPrefs() };
            remoteCache = merged;
            try { localStorage.setItem(LS_KEY, JSON.stringify(merged)); } catch (e) {}
            window.dispatchEvent(new CustomEvent('smartchart_updated', { detail: { all: merged } }));
        }
    } catch (e) {}
};

const formatBroj = (val, unit = '') => {
    const n = Number(val);
    if (!Number.isFinite(n)) return String(val ?? '0');
    const formatted = Math.abs(n) >= 100
        ? n.toLocaleString('bs-BA', { maximumFractionDigits: 1 })
        : n.toLocaleString('bs-BA', { maximumFractionDigits: 2 });
    return unit ? `${formatted} ${unit}` : formatted;
};

/**
 * Hvata živi vektorski SVG iz SmartChart-a za čisto ubacivanje u printDokument() A4 izvještaje!
 */
export const uhvatiSmartChartSvgHtml = (chartId, naslov = '', podnaslov = '') => {
    if (typeof document === 'undefined' || !chartId) return '';
    const host = document.querySelector(`[data-smartchart-id="${chartId}"]`);
    if (!host) return '';
    const svgEl = host.querySelector('svg.recharts-surface') || host.querySelector('svg');
    if (!svgEl) return '';

    const clone = svgEl.cloneNode(true);
    const rect = svgEl.getBoundingClientRect();
    const w = Math.max(300, Math.round(rect.width || 620));
    const h = Math.max(180, Math.round(rect.height || 260));
    clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
    clone.setAttribute('width', '100%');
    clone.setAttribute('height', `${Math.min(280, h)}px`);
    clone.style.maxWidth = '100%';
    clone.style.display = 'block';

    // Prilagodi svijetle tekstove iz tamne teme na tamni print tekst
    clone.querySelectorAll('text, tspan').forEach((t) => {
        const fill = (t.getAttribute('fill') || '').toLowerCase();
        if (!fill || fill === '#fff' || fill === '#ffffff' || fill === '#cbd5e1' || fill === '#e2e8f0' || fill === '#f8fafc') {
            t.setAttribute('fill', '#1e293b');
        }
    });

    const serializer = new XMLSerializer();
    const svgMarkup = serializer.serializeToString(clone);

    return `
        <div style="border:1px solid #cbd5e1; border-radius:10px; padding:12px 14px; margin:14px 0; background:#ffffff; page-break-inside:avoid;">
            ${naslov ? `<div style="font-size:11px; font-weight:900; text-transform:uppercase; color:#0f172a; margin-bottom:2px;">${escapeHtml(naslov)}</div>` : ''}
            ${podnaslov ? `<div style="font-size:9px; color:#64748b; font-weight:700; margin-bottom:8px;">${escapeHtml(podnaslov)}</div>` : ''}
            <div style="width:100%; overflow:hidden;">${svgMarkup}</div>
        </div>
    `;
};

function GlassTooltip({ active, payload, label, unit, totalSum }) {
    if (!active || !payload || payload.length === 0) return null;
    return (
        <div className="bg-slate-950/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl px-3.5 py-2.5 shadow-2xl text-xs min-w-[140px]">
            {label !== undefined && label !== null && String(label) !== '' && (
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-1 mb-1.5 truncate max-w-[220px]">
                    {String(label)}
                </p>
            )}
            <div className="space-y-1">
                {payload.map((entry, idx) => {
                    const val = Number(entry.value || 0);
                    const pct = totalSum > 0 && payload.length === 1 ? ` (${((val / totalSum) * 100).toFixed(1)}%)` : '';
                    return (
                        <div key={idx} className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 truncate max-w-[140px]">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color || entry.payload?.fill || SMART_PALETTE[idx % SMART_PALETTE.length] }} />
                                {entry.name}
                            </span>
                            <span className="font-mono font-black text-white whitespace-nowrap">
                                {formatBroj(val, entry.unit || unit)}{pct}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * SmartChart — Moderni interaktivni dijagram sa izborom tipa, selekcijom serija/podataka,
 * Top-N/sortiranjem, pamćenjem postavki i 100% print-ready podrškom za izvještaje.
 *
 * Props:
 * - chartId: jedinstveni ID grafikona (služi za pamćenje izbora + sinhronizaciju sa PDF printMode)
 * - title: naslov grafikona
 * - subtitle: opcioni podnaslov
 * - data: niz objekata
 * - xKey: ključ kategorije/ose X (npr. 'dan', 'name', 'duzina', 'naziv')
 * - series: [{ key: 'm3', name: 'Proizvodnja', color: '#3b82f6', unit: 'm³' }, ...]
 * - defaultType: 'bar' | 'hbar' | 'area' | 'line' | 'donut' | 'pie' | 'composed'
 * - allowedTypes: opcioni niz dozvoljenih tipova
 * - unit: podrazumijevana mjerna jedinica ('m³', 'KM', '%', 'kom')
 * - height: visina u px (default 240)
 * - compact: za manje Dashboard kartice
 * - printMode: true za nevidljive PDF kontejnere (fiksna širina/visina, bez animacije i toolbar-a)
 * - width: fiksna širina za printMode
 * - colorMap: opciona mapa { [xValue]: '#hex' } za specifične boje stubova/kriški
 * - onItemClick: callback kad korisnik klikne na stub/krišku
 * - datasetSelector: opciono { value, options: [{id, label}], onChange } za mijenjanje izvora podataka!
 */
export default function SmartChart({
    chartId,
    title = '',
    subtitle = '',
    data = [],
    xKey = 'name',
    series = [],
    defaultType = 'bar',
    allowedTypes = null,
    unit = '',
    height = 240,
    compact = false,
    printMode = false,
    width = 340,
    colorMap = null,
    onItemClick = null,
    datasetSelector = null,
}) {
    const normalizedSeries = useMemo(() => {
        if (Array.isArray(series) && series.length > 0) {
            return series.map((s, idx) => ({
                key: s.key,
                name: s.name || s.key,
                color: s.color || SMART_PALETTE[idx % SMART_PALETTE.length],
                unit: s.unit !== undefined ? s.unit : unit,
            }));
        }
        return [{ key: 'value', name: title || 'Vrijednost', color: SMART_PALETTE[0], unit }];
    }, [series, title, unit]);

    const defaultCfg = useMemo(() => ({
        type: defaultType,
        activeSeries: normalizedSeries.map((s) => s.key),
        hiddenCategories: [],
        topN: 0, // 0 = Sve
        sort: 'default', // 'default' | 'desc' | 'asc'
        showValues: false,
        showLegend: true,
    }), [defaultType, normalizedSeries]);

    const [cfg, setCfg] = useState(() => {
        const saved = chartId ? readAllLocalPrefs()[chartId] : null;
        return saved ? { ...defaultCfg, ...saved } : defaultCfg;
    });
    const [showDataMenu, setShowDataMenu] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        syncRemotePrefsOnce();
    }, []);

    useEffect(() => {
        if (!chartId) return;
        const onSync = (ev) => {
            const d = ev?.detail;
            if (d?.chartId === chartId && d?.config) {
                setCfg({ ...defaultCfg, ...d.config });
            } else if (d?.all?.[chartId]) {
                setCfg({ ...defaultCfg, ...d.all[chartId] });
            }
        };
        window.addEventListener('smartchart_updated', onSync);
        return () => window.removeEventListener('smartchart_updated', onSync);
    }, [chartId, defaultCfg]);

    useEffect(() => {
        if (!showDataMenu) return;
        const onOut = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setShowDataMenu(false);
        };
        document.addEventListener('mousedown', onOut);
        return () => document.removeEventListener('mousedown', onOut);
    }, [showDataMenu]);

    const updateCfg = (patch) => {
        setCfg((prev) => {
            const next = { ...prev, ...patch };
            if (chartId) writePref(chartId, next);
            return next;
        });
    };

    const activeSeriesList = useMemo(() => {
        const validKeys = new Set(normalizedSeries.map((s) => s.key));
        const chosen = (cfg.activeSeries || []).filter((k) => validKeys.has(k));
        const finalKeys = chosen.length > 0 ? chosen : [normalizedSeries[0]?.key];
        return normalizedSeries.filter((s) => finalKeys.includes(s.key));
    }, [normalizedSeries, cfg.activeSeries]);

    const allCategoryNames = useMemo(() => {
        return Array.from(new Set((data || []).map((d) => String(d?.[xKey] ?? ''))));
    }, [data, xKey]);

    const processedData = useMemo(() => {
        let arr = Array.isArray(data) ? data.map((row) => ({ ...row })) : [];
        const hiddenSet = new Set(cfg.hiddenCategories || []);
        if (hiddenSet.size > 0) {
            arr = arr.filter((r) => !hiddenSet.has(String(r?.[xKey] ?? '')));
        }
        const primaryKey = activeSeriesList[0]?.key;
        if (cfg.sort === 'desc' && primaryKey) {
            arr.sort((a, b) => Number(b?.[primaryKey] || 0) - Number(a?.[primaryKey] || 0));
        } else if (cfg.sort === 'asc' && primaryKey) {
            arr.sort((a, b) => Number(a?.[primaryKey] || 0) - Number(b?.[primaryKey] || 0));
        }
        if (cfg.topN && cfg.topN > 0) {
            arr = arr.slice(0, cfg.topN);
        }
        return arr;
    }, [data, xKey, cfg.hiddenCategories, cfg.sort, cfg.topN, activeSeriesList]);

    const primarySeries = activeSeriesList[0] || normalizedSeries[0];
    const totalSum = useMemo(() => {
        if (!primarySeries) return 0;
        return processedData.reduce((s, r) => s + Math.max(0, Number(r?.[primarySeries.key] || 0)), 0);
    }, [processedData, primarySeries]);

    const availableTypes = useMemo(() => {
        const list = allowedTypes ? CHART_TYPES.filter((t) => allowedTypes.includes(t.id)) : CHART_TYPES;
        return list;
    }, [allowedTypes]);

    const uid = (chartId || 'sc').replace(/[^a-zA-Z0-9_-]/g, '_');

    const getItemColor = (row, idx, fallbackColor) => {
        const cat = String(row?.[xKey] ?? '');
        if (colorMap && colorMap[cat]) return colorMap[cat];
        if (row?.color) return row.color;
        if (activeSeriesList.length === 1 && (cfg.type === 'donut' || cfg.type === 'pie' || colorMap)) {
            return SMART_PALETTE[idx % SMART_PALETTE.length];
        }
        return fallbackColor || SMART_PALETTE[idx % SMART_PALETTE.length];
    };

    const axisStroke = printMode ? '#475569' : '#94a3b8';
    const gridStroke = printMode ? '#cbd5e1' : '#334155';
    const fontSize = printMode ? 8 : 10;

    const renderDefs = () => (
        <defs>
            {activeSeriesList.map((s, idx) => (
                <linearGradient key={s.key} id={`grad_${uid}_${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0.28} />
                </linearGradient>
            ))}
            {activeSeriesList.map((s, idx) => (
                <linearGradient key={`area_${s.key}`} id={`area_${uid}_${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color} stopOpacity={0.48} />
                    <stop offset="95%" stopColor={s.color} stopOpacity={0.03} />
                </linearGradient>
            ))}
            {activeSeriesList.map((s, idx) => (
                <linearGradient key={`hgrad_${s.key}`} id={`hgrad_${uid}_${idx}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={1} />
                </linearGradient>
            ))}
        </defs>
    );

    const renderChartBody = (chartW, chartH) => {
        if (!processedData || processedData.length === 0) {
            return (
                <div className="h-full w-full flex items-center justify-center text-xs text-theme-muted italic border border-dashed border-theme-border rounded-xl p-6 text-center">
                    Nema odabranih podataka za prikaz.
                </div>
            );
        }

        const anim = !printMode;
        const type = cfg.type || defaultType;
        const sizeProps = printMode ? { width: chartW, height: chartH } : {};

        const commonChart = (() => {
            if (type === 'donut' || type === 'pie') {
                const rawPieData = processedData.map((r, i) => ({
                    name: String(r?.[xKey] ?? ''),
                    value: Math.max(0, Number(r?.[primarySeries.key] || 0)),
                    fill: getItemColor(r, i, SMART_PALETTE[i % SMART_PALETTE.length]),
                    raw: r,
                }));
                const allZero = rawPieData.every((d) => d.value <= 0);
                const pieData = allZero
                    ? [{ name: 'Nema prometa u periodu', value: 1, fill: printMode ? '#cbd5e1' : '#334155', raw: null }]
                    : rawPieData;
                const outerR = printMode ? Math.min(chartW, chartH) * 0.34 : '82%';
                const innerR = type === 'donut' ? (printMode ? Math.min(chartW, chartH) * 0.19 : '54%') : 0;

                return (
                    <PieChart {...sizeProps}>
                        <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={innerR}
                            outerRadius={outerR}
                            paddingAngle={type === 'donut' && !allZero ? 3 : 0}
                            stroke={printMode ? '#ffffff' : 'rgba(15,23,42,0.5)'}
                            strokeWidth={2}
                            isAnimationActive={anim}
                            onClick={(d) => !allZero && onItemClick && onItemClick(d?.raw || d)}
                        >
                            {pieData.map((entry, idx) => (
                                <Cell key={`cell-${idx}`} fill={entry.fill} style={!allZero && onItemClick ? { cursor: 'pointer' } : undefined} />
                            ))}
                            {type === 'donut' && (
                                <Label
                                    position="center"
                                    content={({ viewBox }) => {
                                        const cx = viewBox?.cx ?? 0;
                                        const cy = viewBox?.cy ?? 0;
                                        return (
                                            <g>
                                                <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="central" fill={printMode ? '#475569' : '#94a3b8'} fontSize={printMode ? 8 : 10} fontWeight="800">
                                                    UKUPNO
                                                </text>
                                                <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="central" fill={printMode ? '#0f172a' : '#3b82f6'} fontSize={printMode ? 11 : 14} fontWeight="900">
                                                    {formatBroj(totalSum, primarySeries.unit)}
                                                </text>
                                            </g>
                                        );
                                    }}
                                />
                            )}
                        </Pie>
                        {!printMode && !allZero && <Tooltip content={<GlassTooltip unit={primarySeries.unit} totalSum={totalSum} />} />}
                        {(cfg.showLegend || printMode) && (
                            <Legend
                                wrapperStyle={{ fontSize: printMode ? '8px' : '10px', fontWeight: 'bold', color: printMode ? '#0f172a' : '#94a3b8' }}
                            />
                        )}
                    </PieChart>
                );
            }

            if (type === 'hbar') {
                return (
                    <BarChart {...sizeProps} data={processedData} layout="vertical" margin={{ top: 6, right: 24, left: 10, bottom: 4 }} onClick={(d) => onItemClick && d?.activePayload?.[0] && onItemClick(d.activePayload[0].payload)}>
                        {renderDefs()}
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} opacity={printMode ? 0.6 : 0.28} />
                        <XAxis type="number" stroke={axisStroke} fontSize={fontSize} tickLine={false} axisLine={false} />
                        <YAxis dataKey={xKey} type="category" stroke={axisStroke} fontSize={fontSize} tickLine={false} axisLine={false} width={printMode ? 70 : 95} />
                        {!printMode && <Tooltip content={<GlassTooltip unit={unit} totalSum={totalSum} />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />}
                        {cfg.showLegend && activeSeriesList.length > 1 && <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />}
                        {activeSeriesList.map((s, idx) => (
                            <Bar key={s.key} dataKey={s.key} name={s.name} fill={colorMap ? s.color : `url(#hgrad_${uid}_${idx})`} radius={[0, 8, 8, 0]} barSize={activeSeriesList.length > 1 ? 14 : 20} isAnimationActive={anim}>
                                {colorMap && processedData.map((row, rIdx) => <Cell key={`c-${rIdx}`} fill={getItemColor(row, rIdx, s.color)} />)}
                                {cfg.showValues && <LabelList dataKey={s.key} position="right" fill={axisStroke} fontSize={9} formatter={(v) => formatBroj(v)} />}
                            </Bar>
                        ))}
                    </BarChart>
                );
            }

            if (type === 'area') {
                return (
                    <AreaChart {...sizeProps} data={processedData} margin={{ top: 10, right: 12, left: -12, bottom: 4 }} onClick={(d) => onItemClick && d?.activePayload?.[0] && onItemClick(d.activePayload[0].payload)}>
                        {renderDefs()}
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} opacity={printMode ? 0.6 : 0.28} />
                        <XAxis dataKey={xKey} stroke={axisStroke} fontSize={fontSize} tickLine={false} axisLine={false} />
                        <YAxis stroke={axisStroke} fontSize={fontSize} tickLine={false} axisLine={false} />
                        {!printMode && <Tooltip content={<GlassTooltip unit={unit} totalSum={totalSum} />} />}
                        {cfg.showLegend && activeSeriesList.length > 1 && <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />}
                        {activeSeriesList.map((s, idx) => (
                            <Area
                                key={s.key}
                                type="monotone"
                                dataKey={s.key}
                                name={s.name}
                                stroke={s.color}
                                strokeWidth={2.8}
                                fill={`url(#area_${uid}_${idx})`}
                                activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                                isAnimationActive={anim}
                            />
                        ))}
                    </AreaChart>
                );
            }

            if (type === 'line') {
                return (
                    <LineChart {...sizeProps} data={processedData} margin={{ top: 10, right: 12, left: -12, bottom: 4 }} onClick={(d) => onItemClick && d?.activePayload?.[0] && onItemClick(d.activePayload[0].payload)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} opacity={printMode ? 0.6 : 0.28} />
                        <XAxis dataKey={xKey} stroke={axisStroke} fontSize={fontSize} tickLine={false} axisLine={false} />
                        <YAxis stroke={axisStroke} fontSize={fontSize} tickLine={false} axisLine={false} />
                        {!printMode && <Tooltip content={<GlassTooltip unit={unit} totalSum={totalSum} />} />}
                        {cfg.showLegend && activeSeriesList.length > 1 && <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />}
                        {activeSeriesList.map((s) => (
                            <Line
                                key={s.key}
                                type="monotone"
                                dataKey={s.key}
                                name={s.name}
                                stroke={s.color}
                                strokeWidth={3}
                                dot={{ r: 3.5, fill: s.color, strokeWidth: 1.5, stroke: '#fff' }}
                                activeDot={{ r: 6 }}
                                isAnimationActive={anim}
                            />
                        ))}
                    </LineChart>
                );
            }

            if (type === 'composed') {
                return (
                    <ComposedChart {...sizeProps} data={processedData} margin={{ top: 10, right: 12, left: -12, bottom: 4 }} onClick={(d) => onItemClick && d?.activePayload?.[0] && onItemClick(d.activePayload[0].payload)}>
                        {renderDefs()}
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} opacity={printMode ? 0.6 : 0.28} />
                        <XAxis dataKey={xKey} stroke={axisStroke} fontSize={fontSize} tickLine={false} axisLine={false} />
                        <YAxis stroke={axisStroke} fontSize={fontSize} tickLine={false} axisLine={false} />
                        {!printMode && <Tooltip content={<GlassTooltip unit={unit} totalSum={totalSum} />} />}
                        {cfg.showLegend && <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />}
                        <Bar dataKey={primarySeries.key} name={primarySeries.name} fill={`url(#grad_${uid}_0)`} radius={[8, 8, 0, 0]} maxBarSize={38} isAnimationActive={anim}>
                            {colorMap && processedData.map((row, rIdx) => <Cell key={`c-${rIdx}`} fill={getItemColor(row, rIdx, primarySeries.color)} />)}
                        </Bar>
                        {activeSeriesList.length > 1 ? (
                            activeSeriesList.slice(1).map((s) => (
                                <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={3} dot={{ r: 3 }} isAnimationActive={anim} />
                            ))
                        ) : (
                            <Line type="monotone" dataKey={primarySeries.key} name="Trend" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={anim} />
                        )}
                    </ComposedChart>
                );
            }

            // Default: 'bar'
            return (
                <BarChart {...sizeProps} data={processedData} margin={{ top: 12, right: 12, left: -12, bottom: 4 }} onClick={(d) => onItemClick && d?.activePayload?.[0] && onItemClick(d.activePayload[0].payload)}>
                    {renderDefs()}
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} opacity={printMode ? 0.6 : 0.28} />
                    <XAxis dataKey={xKey} stroke={axisStroke} fontSize={fontSize} tickLine={false} axisLine={false} />
                    <YAxis stroke={axisStroke} fontSize={fontSize} tickLine={false} axisLine={false} />
                    {!printMode && <Tooltip content={<GlassTooltip unit={unit} totalSum={totalSum} />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />}
                    {cfg.showLegend && activeSeriesList.length > 1 && <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />}
                    {activeSeriesList.map((s, idx) => (
                        <Bar key={s.key} dataKey={s.key} name={s.name} fill={colorMap ? s.color : `url(#grad_${uid}_${idx})`} radius={[8, 8, 0, 0]} maxBarSize={42} isAnimationActive={anim}>
                            {colorMap && processedData.map((row, rIdx) => <Cell key={`c-${rIdx}`} fill={getItemColor(row, rIdx, s.color)} />)}
                            {cfg.showValues && <LabelList dataKey={s.key} position="top" fill={axisStroke} fontSize={9} formatter={(v) => formatBroj(v)} />}
                        </Bar>
                    ))}
                </BarChart>
            );
        })();

        if (printMode) return commonChart;
        return (
            <ResponsiveContainer width="100%" height="100%">
                {commonChart}
            </ResponsiveContainer>
        );
    };

    // Nevidljivi PDF/print režim: bez ikakvih kontrola, samo čist sinhronizovan dijagram!
    if (printMode) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                {renderChartBody(width, height)}
            </div>
        );
    }

    const handlePrintSingleChart = (e) => {
        e.stopPropagation();
        const svgHtml = uhvatiSmartChartSvgHtml(chartId, title, subtitle);
        const cols = activeSeriesList.map((s) => `<th style="text-align:right;">${escapeHtml(s.name)}${s.unit ? ` (${escapeHtml(s.unit)})` : ''}</th>`).join('');
        const rows = processedData.map((r) => `
            <tr>
                <td style="font-weight:bold;">${escapeHtml(r?.[xKey] ?? '')}</td>
                ${activeSeriesList.map((s) => `<td style="text-align:right; font-weight:bold;">${escapeHtml(formatBroj(r?.[s.key] ?? 0, s.unit))}</td>`).join('')}
            </tr>
        `).join('');

        const bodyHtml = `
            ${svgHtml}
            <table style="margin-top:14px;">
                <thead><tr><th>Kategorija / Period</th>${cols}</tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;
        printDokument(title || 'ANALITIČKI DIJAGRAM', `CHART-${new Date().toISOString().slice(0, 10)}`, new Date().toLocaleDateString('bs-BA'), bodyHtml, primarySeries?.color || '#3b82f6');
    };

    const toggleSeries = (key) => {
        const curr = activeSeriesList.map((s) => s.key);
        if (curr.includes(key)) {
            if (curr.length <= 1) return; // bar 1 serija mora ostati aktivna
            updateCfg({ activeSeries: curr.filter((k) => k !== key) });
        } else {
            updateCfg({ activeSeries: [...curr, key] });
        }
    };

    const toggleCategory = (cat) => {
        const curr = cfg.hiddenCategories || [];
        const next = curr.includes(cat) ? curr.filter((c) => c !== cat) : [...curr, cat];
        updateCfg({ hiddenCategories: next });
    };

    const renderToolbar = (expanded = false) => (
        <div
            className="flex flex-wrap items-center justify-between gap-2 mb-2.5 print:hidden"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
                {title && (
                    <div className="min-w-0">
                        <h3 className={`${compact && !expanded ? 'text-[10px]' : 'text-xs'} font-black uppercase tracking-wider text-theme-text truncate`}>
                            {title}
                        </h3>
                        {subtitle && <p className="text-[9px] text-theme-muted font-bold truncate">{subtitle}</p>}
                    </div>
                )}
                {datasetSelector && (
                    <select
                        value={datasetSelector.value}
                        onChange={(e) => datasetSelector.onChange(e.target.value)}
                        className="bg-theme-panel border border-theme-border text-theme-text text-[10px] font-black uppercase px-2.5 py-1 rounded-lg outline-none focus:border-theme-accent cursor-pointer"
                    >
                        {(datasetSelector.options || []).map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                    </select>
                )}
            </div>

            <div className="flex items-center gap-1 flex-wrap">
                {/* Brzi izbor tipa dijagrama */}
                <div className="flex items-center bg-theme-panel/80 border border-theme-border rounded-xl p-0.5 gap-0.5">
                    {availableTypes.map((t) => {
                        const Icon = t.icon;
                        const active = (cfg.type || defaultType) === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                data-testid={`smartchart-type-${t.id}`}
                                onClick={() => updateCfg({ type: t.id })}
                                title={`Prikaz: ${t.label}`}
                                className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 transition-all ${
                                    active
                                        ? 'bg-theme-accent text-white shadow-sm'
                                        : 'text-theme-muted hover:text-theme-text hover:bg-theme-card'
                                }`}
                            >
                                <Icon size={11} />
                                {(!compact || expanded) && <span className="hidden sm:inline">{t.short}</span>}
                            </button>
                        );
                    })}
                </div>

                {/* Dugme za izbor PODATAKA (serije, kategorije, Top-N, sortiranje) */}
                <div className="relative" ref={menuRef}>
                    <button
                        type="button"
                        data-testid="smartchart-data-btn"
                        onClick={() => setShowDataMenu((v) => !v)}
                        title="Odaberi koje podatke dijagram prikazuje"
                        className={`px-2.5 py-1.5 rounded-xl border text-[9px] font-black uppercase flex items-center gap-1 transition-all ${
                            showDataMenu || (cfg.hiddenCategories?.length > 0) || cfg.topN > 0 || cfg.sort !== 'default'
                                ? 'bg-theme-accent text-white border-theme-accent'
                                : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'
                        }`}
                    >
                        <SlidersHorizontal size={11} />
                        <span>Podaci</span>
                    </button>

                    {showDataMenu && (
                        <div
                            data-testid="smartchart-data-popover"
                            className="absolute right-0 top-[115%] w-72 max-w-[85vw] bg-theme-card border-2 border-theme-border rounded-2xl shadow-2xl p-3.5 z-[6000] space-y-3 text-left"
                        >
                            <div className="flex items-center justify-between border-b border-theme-border pb-2">
                                <span className="text-[10px] font-black uppercase text-theme-text">⚙️ Podešavanje podataka</span>
                                <button
                                    type="button"
                                    onClick={() => updateCfg({ ...defaultCfg })}
                                    className="text-[9px] font-black uppercase text-theme-muted hover:text-theme-accent flex items-center gap-1"
                                >
                                    <RotateCcw size={10} /> Reset
                                </button>
                            </div>

                            {/* Serije (metrike) */}
                            {normalizedSeries.length > 1 && (
                                <div>
                                    <span className="text-[9px] font-black uppercase text-theme-muted block mb-1.5">Prikazane metrike / serije:</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {normalizedSeries.map((s) => {
                                            const active = activeSeriesList.some((as) => as.key === s.key);
                                            return (
                                                <button
                                                    key={s.key}
                                                    type="button"
                                                    onClick={() => toggleSeries(s.key)}
                                                    className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border flex items-center gap-1 transition-all ${
                                                        active ? 'bg-theme-panel border-theme-accent text-theme-text' : 'bg-theme-card border-theme-border text-theme-muted opacity-50'
                                                    }`}
                                                >
                                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                                    {s.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Top-N & Sortiranje */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-[9px] font-black uppercase text-theme-muted block mb-1">Broj stavki:</span>
                                    <select
                                        value={cfg.topN || 0}
                                        onChange={(e) => updateCfg({ topN: Number(e.target.value) })}
                                        className="w-full bg-theme-panel border border-theme-border rounded-lg p-1.5 text-[10px] font-black text-theme-text outline-none"
                                    >
                                        <option value={0}>Sve ({allCategoryNames.length})</option>
                                        <option value={5}>Top 5</option>
                                        <option value={8}>Top 8</option>
                                        <option value={12}>Top 12</option>
                                    </select>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black uppercase text-theme-muted block mb-1">Sortiranje:</span>
                                    <select
                                        value={cfg.sort || 'default'}
                                        onChange={(e) => updateCfg({ sort: e.target.value })}
                                        className="w-full bg-theme-panel border border-theme-border rounded-lg p-1.5 text-[10px] font-black text-theme-text outline-none"
                                    >
                                        <option value="default">Originalno</option>
                                        <option value="desc">Najveće ↓</option>
                                        <option value="asc">Najmanje ↑</option>
                                    </select>
                                </div>
                            </div>

                            {/* Opcije prikaza */}
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => updateCfg({ showValues: !cfg.showValues })}
                                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase border ${cfg.showValues ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-theme-panel text-theme-muted border-theme-border'}`}
                                >
                                    {cfg.showValues ? '✓ Brojevi' : '+ Brojevi'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateCfg({ showLegend: !cfg.showLegend })}
                                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase border ${cfg.showLegend ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-theme-panel text-theme-muted border-theme-border'}`}
                                >
                                    {cfg.showLegend ? '✓ Legenda' : '+ Legenda'}
                                </button>
                            </div>

                            {/* Izbor pojedinačnih stavki / kategorija */}
                            {allCategoryNames.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[9px] font-black uppercase text-theme-muted">Stavke na dijagramu:</span>
                                        {cfg.hiddenCategories?.length > 0 && (
                                            <button type="button" onClick={() => updateCfg({ hiddenCategories: [] })} className="text-[8px] font-black uppercase text-theme-accent hover:underline">
                                                Prikaži sve
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-36 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                                        {allCategoryNames.map((cat) => {
                                            const visible = !(cfg.hiddenCategories || []).includes(cat);
                                            return (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    onClick={() => toggleCategory(cat)}
                                                    className={`w-full flex items-center justify-between px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                                                        visible ? 'bg-theme-panel text-theme-text' : 'bg-theme-card text-theme-muted line-through opacity-50'
                                                    }`}
                                                >
                                                    <span className="truncate pr-2">{cat || '(prazno)'}</span>
                                                    <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${visible ? 'bg-emerald-600 text-white' : 'border border-theme-border'}`}>
                                                        {visible && <Check size={10} />}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Direktno printanje ovog dijagrama */}
                <button
                    type="button"
                    onClick={handlePrintSingleChart}
                    title="Isprintaj ovaj dijagram i tabelu (A4 PDF)"
                    className="p-1.5 rounded-xl bg-theme-panel border border-theme-border text-theme-muted hover:text-theme-text hover:border-theme-accent transition-all"
                >
                    <Printer size={12} />
                </button>

                {/* Proširi na puni ekran */}
                <button
                    type="button"
                    onClick={() => setIsExpanded((v) => !v)}
                    title={expanded ? 'Smanji' : 'Puni ekran (Fokus pregled)'}
                    className="p-1.5 rounded-xl bg-theme-panel border border-theme-border text-theme-muted hover:text-theme-text hover:border-theme-accent transition-all"
                >
                    {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                </button>
            </div>
        </div>
    );

    const expandedModal = isExpanded && typeof document !== 'undefined' ? createPortal(
        <div
            className="erp-modal-backdrop fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[10060] flex items-center justify-center p-4 sm:p-8"
            onClick={() => setIsExpanded(false)}
        >
            <div
                className="w-full max-w-5xl bg-theme-card border-2 border-theme-border rounded-[2rem] shadow-2xl p-5 sm:p-6 flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {renderToolbar(true)}
                <div className="w-full h-[65vh] min-h-[340px]">
                    {renderChartBody(800, 480)}
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <div className="flex flex-col h-full w-full min-w-0" data-smartchart-id={chartId || undefined}>
            {renderToolbar(false)}
            <div className="w-full min-w-0" style={{ height: `${height}px` }}>
                {renderChartBody(width, height)}
            </div>
            {expandedModal}
        </div>
    );
}
