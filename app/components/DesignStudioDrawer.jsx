"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Palette, Type, ChevronDown, Package, Globe, RotateCcw, Save, X, Minimize2, Maximize2, Sparkles, Check, Layers } from 'lucide-react';
import { DESIGN_PRESETS, isUserDesignAdmin, cleanDesignTokens } from '../utils/designTokens';

function ColorField({ label, hint, value, globalValue, fallback = '#3b82f6', onChange }) {
    const activeVal = value || '';
    const displayVal = activeVal || globalValue || '';
    const pickerVal = /^#[0-9a-fA-F]{6}$/.test(displayVal) ? displayVal : fallback;

    return (
        <div className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/70 hover:border-slate-500/80 transition-colors">
            <div className="min-w-0 flex-1">
                <div className="text-[11px] font-black text-slate-100 leading-tight truncate">{label}</div>
                <div className="text-[9px] text-slate-400 font-semibold leading-tight mt-0.5 truncate">
                    {activeVal ? (
                        <span className="text-amber-400 font-mono">{activeVal}</span>
                    ) : globalValue ? (
                        <span className="text-sky-400">Globalno ({globalValue})</span>
                    ) : (
                        <span>{hint || 'Prati aktivnu temu'}</span>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                <label className="relative w-9 h-9 rounded-lg border-2 border-slate-600 overflow-hidden cursor-pointer shadow-inner flex items-center justify-center shrink-0" style={{ backgroundColor: displayVal || 'transparent' }} title="Izaberi boju">
                    {!displayVal && <span className="text-[8px] font-black text-slate-400 uppercase">Tema</span>}
                    <input
                        type="color"
                        value={pickerVal}
                        onChange={(e) => onChange(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                </label>
                {activeVal && (
                    <button
                        type="button"
                        onClick={() => onChange('')}
                        title="Vrati samo ovu boju na temu"
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white text-[10px] font-black flex items-center justify-center transition-colors border border-slate-700"
                    >
                        ✕
                    </button>
                )}
            </div>
        </div>
    );
}

function SizeField({ label, value, globalValue, min = 8, max = 34, def = 14, onChange }) {
    const activeVal = value ? parseInt(value, 10) : null;
    const displayNum = activeVal ?? (globalValue ? parseInt(globalValue, 10) : def);

    return (
        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/70 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black text-slate-100">{label}</span>
                <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded ${activeVal ? 'bg-amber-500/20 text-amber-300' : globalValue ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-400'}`}>
                        {activeVal ? `${activeVal}px` : globalValue ? `Glob: ${globalValue}px` : 'Tema'}
                    </span>
                    {activeVal && (
                        <button
                            type="button"
                            onClick={() => onChange('')}
                            title="Vrati veličinu na temu"
                            className="w-6 h-6 rounded-md bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white text-[9px] font-black flex items-center justify-center"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                value={displayNum}
                onChange={(e) => onChange(e.target.value)}
                className="w-full accent-amber-500 cursor-pointer h-1.5"
            />
        </div>
    );
}

function SectionTitle({ title, subtitle }) {
    return (
        <div className="pt-2 pb-1 border-b border-slate-700/70">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-400">{title}</h4>
            {subtitle && <p className="text-[9px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
    );
}

export default function DesignStudioDrawer({ saas, user, modulNaziv = 'Ovaj Modul' }) {
    const [mounted, setMounted] = useState(false);
    const [tab, setTab] = useState('baza');
    const [minimized, setMinimized] = useState(false);
    const [savingGlobal, setSavingGlobal] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || !saas || !saas.isEditMode || !isUserDesignAdmin(user)) {
        return null;
    }

    const t = saas.designTokens || {};
    const g = saas.globalTokens || {};
    const eff = { ...g, ...t };
    const setT = (k, v) => saas.setDesignToken(k, v);
    const activeTokenCount = Object.keys(cleanDesignTokens(t)).length;
    const globalTokenCount = Object.keys(cleanDesignTokens(g)).length;

    const handleSaveGlobal = async () => {
        setSavingGlobal(true);
        try {
            await saas.spasiKaoGlobalniDizajn(eff);
        } finally {
            setSavingGlobal(false);
        }
    };

    const tabs = [
        { id: 'baza', label: 'Baza', icon: Palette },
        { id: 'slova', label: 'Slova', icon: Type },
        { id: 'dropdown', label: 'Dropdowni', icon: ChevronDown },
        { id: 'paketi', label: 'Paketi & Dim', icon: Package },
        { id: 'global', label: 'Globalno', icon: Globe },
    ];

    const drawerContent = minimized ? (
        <div
            data-design-studio="true"
            className="fixed bottom-4 right-4 z-[10060] flex items-center gap-2 bg-slate-950/95 text-white border-2 border-amber-500 rounded-2xl px-3.5 py-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.75)] backdrop-blur-xl"
        >
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-400 pr-2 border-r border-slate-700">
                <Sparkles size={14} /> Dizajn: {modulNaziv}
            </span>
            <button
                type="button"
                onClick={() => setMinimized(false)}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 text-[10px] font-black uppercase flex items-center gap-1 transition-colors"
            >
                <Maximize2 size={12} /> Otvori Panel
            </button>
            <button
                type="button"
                onClick={saas.spasiDizajn}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase flex items-center gap-1 transition-colors"
            >
                <Save size={12} /> Spasi
            </button>
            <button
                type="button"
                onClick={saas.odustani}
                className="px-2 py-1.5 rounded-xl bg-red-900/50 hover:bg-red-600 text-red-200 hover:text-white text-[10px] font-black uppercase transition-colors"
                title="Odustani"
            >
                <X size={13} />
            </button>
        </div>
    ) : (
        <aside
            data-design-studio="true"
            className="fixed top-3 right-3 bottom-3 w-[calc(100vw-1.5rem)] sm:w-[420px] z-[10060] bg-slate-950/96 text-slate-100 border-2 border-amber-500/70 rounded-[1.5rem] shadow-[0_25px_70px_rgba(0,0,0,0.85)] backdrop-blur-2xl flex flex-col overflow-hidden"
        >
            {/* ZAGLAVLJE */}
            <div className="p-4 bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-lg">
                            <Palette size={15} />
                        </span>
                        <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 truncate">
                            God Mode • Design Studio
                        </h3>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 truncate">
                        Modul: <strong className="text-white">{modulNaziv}</strong> • {activeTokenCount} lokalnih / {globalTokenCount} globalnih pravila
                    </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        type="button"
                        onClick={() => setMinimized(true)}
                        title="Minimiziraj da vidiš i klikćeš po ekranu modula"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-amber-500 text-slate-200 hover:text-slate-950 transition-colors border border-slate-700"
                    >
                        <Minimize2 size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={saas.odustani}
                        title="Odustani i zatvori"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white transition-colors border border-slate-700"
                    >
                        <X size={15} />
                    </button>
                </div>
            </div>

            {/* TABOVI */}
            <div className="grid grid-cols-5 gap-1 p-2 bg-slate-900/90 border-b border-slate-800 shrink-0">
                {tabs.map((tb) => {
                    const Icon = tb.icon;
                    const active = tab === tb.id;
                    return (
                        <button
                            key={tb.id}
                            type="button"
                            onClick={() => setTab(tb.id)}
                            className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all ${
                                active
                                    ? 'bg-amber-500 text-slate-950 shadow-md'
                                    : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            <Icon size={13} />
                            <span className="truncate max-w-full">{tb.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* TIJELO PANELA */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {tab === 'baza' && (
                    <>
                        <SectionTitle title="⚡ Brzi Profesionalni Preseti" subtitle="Jednim klikom primijeni usklađenu paletu (možeš dalje fino doraditi)" />
                        <div className="grid grid-cols-1 gap-2">
                            {DESIGN_PRESETS.map((p) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => saas.setDesignTokens(p.tokens)}
                                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/60 text-left transition-all group"
                                >
                                    <div className="min-w-0">
                                        <div className="text-[11px] font-black text-white group-hover:text-amber-400 transition-colors">{p.naziv}</div>
                                        <div className="text-[9px] text-slate-400 truncate">{p.opis}</div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {p.preview.map((c, idx) => (
                                            <span key={idx} className="w-4 h-4 rounded-full border border-white/25 shadow-sm" style={{ backgroundColor: c }} />
                                        ))}
                                    </div>
                                </button>
                            ))}
                        </div>

                        <SectionTitle title="🧱 Kartice, Paneli i Okviri" subtitle="Prazno polje automatski prati aktivnu temu" />
                        <div className="space-y-2">
                            <ColorField label="Pozadina modula (stranice)" value={t.pageBg} globalValue={g.pageBg} fallback="#0f172a" onChange={(v) => setT('pageBg', v)} />
                            <ColorField label="Pozadina glavnih kartica" value={t.cardBg} globalValue={g.cardBg} fallback="#1e293b" onChange={(v) => setT('cardBg', v)} />
                            <ColorField label="Boja okvira kartica" value={t.cardBorder} globalValue={g.cardBorder} fallback="#334155" onChange={(v) => setT('cardBorder', v)} />
                            <ColorField label="Pozadina unutrašnjih panela" value={t.panelBg} globalValue={g.panelBg} fallback="#0f172a" onChange={(v) => setT('panelBg', v)} />
                            <ColorField label="Boja okvira unutrašnjih panela" value={t.panelBorder} globalValue={g.panelBorder} fallback="#334155" onChange={(v) => setT('panelBorder', v)} />
                            <SizeField label="Zaobljenje uglova kartica (px)" value={t.borderRadius} globalValue={g.borderRadius} min={4} max={32} def={16} onChange={(v) => setT('borderRadius', v)} />
                        </div>
                    </>
                )}

                {tab === 'slova' && (
                    <>
                        <SectionTitle title="🔤 Boje i Veličine Slova" subtitle="Primjenjuje se na naslove, opise i oznake u modulu" />
                        <div className="space-y-2">
                            <ColorField label="Akcent boja (naslovi & naglasci)" value={t.accentColor} globalValue={g.accentColor} fallback="#3b82f6" onChange={(v) => setT('accentColor', v)} />
                            <ColorField label="Boja glavnih slova" value={t.textColor} globalValue={g.textColor} fallback="#f8fafc" onChange={(v) => setT('textColor', v)} />
                            <ColorField label="Boja sporednih slova / opisa" value={t.mutedColor} globalValue={g.mutedColor} fallback="#94a3b8" onChange={(v) => setT('mutedColor', v)} />
                            <SizeField label="Veličina glavnih naslova" value={t.headingSize} globalValue={g.headingSize} min={14} max={36} def={22} onChange={(v) => setT('headingSize', v)} />
                            <SizeField label="Osnovna veličina teksta" value={t.bodySize} globalValue={g.bodySize} min={11} max={20} def={14} onChange={(v) => setT('bodySize', v)} />
                            <SizeField label="Veličina oznaka (labela)" value={t.labelSize} globalValue={g.labelSize} min={8} max={16} def={10} onChange={(v) => setT('labelSize', v)} />
                        </div>

                        <SectionTitle title="🔘 Glavna Akcijska Dugmad" subtitle="Npr. Dodaj u paket, Snimi, Potvrdi" />
                        <div className="space-y-2">
                            <ColorField label="Pozadina glavnog dugmeta" value={t.btnPrimaryBg} globalValue={g.btnPrimaryBg} fallback="#2563eb" onChange={(v) => setT('btnPrimaryBg', v)} />
                            <ColorField label="Boja slova glavnog dugmeta" value={t.btnPrimaryText} globalValue={g.btnPrimaryText} fallback="#ffffff" onChange={(v) => setT('btnPrimaryText', v)} />
                        </div>
                    </>
                )}

                {tab === 'dropdown' && (
                    <>
                        {/* MINI LIVE PREVIEW DROPDOWNA */}
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80 space-y-2">
                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">👁️ Pregled Dropdowna Uživo</div>
                            <div
                                className="px-3 py-2 rounded-xl border font-black uppercase flex items-center justify-between"
                                style={{
                                    backgroundColor: eff.inputBg || '#0f172a',
                                    borderColor: eff.inputBorder || '#3b82f6',
                                    color: eff.inputText || '#f8fafc',
                                    fontSize: eff.inputFontSize ? `${eff.inputFontSize}px` : '12px',
                                }}
                            >
                                <span>ODABERI STAVKU / RADNIKA...</span>
                                <ChevronDown size={14} />
                            </div>
                            <div
                                className="rounded-xl border overflow-hidden shadow-lg"
                                style={{
                                    backgroundColor: eff.dropdownMenuBg || '#0f172a',
                                    borderColor: eff.dropdownMenuBorder || eff.inputBorder || '#334155',
                                }}
                            >
                                <div
                                    className="px-3 py-2 font-black uppercase"
                                    style={{
                                        backgroundColor: eff.dropdownActiveBg || '#2563eb',
                                        color: eff.dropdownActiveText || '#ffffff',
                                        fontSize: eff.dropdownItemSize ? `${eff.dropdownItemSize}px` : '12px',
                                    }}
                                >
                                    ✓ Selektovana / Hover opcija
                                </div>
                                <div
                                    className="px-3 py-2 font-bold uppercase"
                                    style={{
                                        color: eff.dropdownItemText || '#e2e8f0',
                                        fontSize: eff.dropdownItemSize ? `${eff.dropdownItemSize}px` : '12px',
                                    }}
                                >
                                    Obična opcija u padajućoj listi
                                </div>
                            </div>
                        </div>

                        <SectionTitle title="📥 Sva Polja i Dropdown Okidači" subtitle="Važi za sve inpute, selecte, MasterSearch i dropdown liste" />
                        <div className="space-y-2">
                            <ColorField label="Pozadina polja / dropdowna" value={t.inputBg} globalValue={g.inputBg} fallback="#0f172a" onChange={(v) => setT('inputBg', v)} />
                            <ColorField label="Boja okvira polja" value={t.inputBorder} globalValue={g.inputBorder} fallback="#3b82f6" onChange={(v) => setT('inputBorder', v)} />
                            <ColorField label="Boja okvira u fokusu (aktivno)" value={t.inputFocusBorder} globalValue={g.inputFocusBorder} fallback="#60a5fa" onChange={(v) => setT('inputFocusBorder', v)} />
                            <ColorField label="Boja slova u polju" value={t.inputText} globalValue={g.inputText} fallback="#f8fafc" onChange={(v) => setT('inputText', v)} />
                            <SizeField label="Veličina slova u poljima" value={t.inputFontSize} globalValue={g.inputFontSize} min={10} max={24} def={14} onChange={(v) => setT('inputFontSize', v)} />
                        </div>

                        <SectionTitle title="📜 Padajući Meni (Otvorena Lista)" subtitle="Boja i tekst otvorene dropdown liste" />
                        <div className="space-y-2">
                            <ColorField label="Pozadina padajućeg menija" value={t.dropdownMenuBg} globalValue={g.dropdownMenuBg} fallback="#0f172a" onChange={(v) => setT('dropdownMenuBg', v)} />
                            <ColorField label="Boja okvira padajućeg menija" value={t.dropdownMenuBorder} globalValue={g.dropdownMenuBorder} fallback="#3b82f6" onChange={(v) => setT('dropdownMenuBorder', v)} />
                            <ColorField label="Boja slova stavki u listi" value={t.dropdownItemText} globalValue={g.dropdownItemText} fallback="#f8fafc" onChange={(v) => setT('dropdownItemText', v)} />
                            <SizeField label="Veličina slova u listi" value={t.dropdownItemSize} globalValue={g.dropdownItemSize} min={10} max={20} def={12} onChange={(v) => setT('dropdownItemSize', v)} />
                            <ColorField label="Pozadina selektovane / hover stavke" value={t.dropdownActiveBg} globalValue={g.dropdownActiveBg} fallback="#2563eb" onChange={(v) => setT('dropdownActiveBg', v)} />
                            <ColorField label="Boja slova selektovane stavke" value={t.dropdownActiveText} globalValue={g.dropdownActiveText} fallback="#ffffff" onChange={(v) => setT('dropdownActiveText', v)} />
                        </div>

                        <SectionTitle title="👷 Ekipa na Mašini (Zasebno)" subtitle="Opcionalno — ako je prazno, nasljeđuje opći dropdown stil" />
                        <div className="space-y-2">
                            <ColorField label="Ekipa — pozadina polja" value={t.teamBg} globalValue={g.teamBg} fallback="#0f172a" onChange={(v) => setT('teamBg', v)} />
                            <ColorField label="Ekipa — boja okvira" value={t.teamBorder} globalValue={g.teamBorder} fallback="#38bdf8" onChange={(v) => setT('teamBorder', v)} />
                            <ColorField label="Ekipa — boja slova" value={t.teamText} globalValue={g.teamText} fallback="#ffffff" onChange={(v) => setT('teamText', v)} />
                            <SizeField label="Ekipa — veličina slova" value={t.teamFontSize} globalValue={g.teamFontSize} min={10} max={22} def={14} onChange={(v) => setT('teamFontSize', v)} />
                            <ColorField label="Ekipa — pozadina padajuće liste" value={t.teamMenuBg} globalValue={g.teamMenuBg} fallback="#0f172a" onChange={(v) => setT('teamMenuBg', v)} />
                        </div>

                        <SectionTitle title="🪵 Odabir Proizvoda (Zasebno)" subtitle="Opcionalno — ako je prazno, nasljeđuje opći dropdown stil" />
                        <div className="space-y-2">
                            <ColorField label="Proizvod — pozadina polja" value={t.productBg} globalValue={g.productBg} fallback="#0f172a" onChange={(v) => setT('productBg', v)} />
                            <ColorField label="Proizvod — boja okvira" value={t.productBorder} globalValue={g.productBorder} fallback="#10b981" onChange={(v) => setT('productBorder', v)} />
                            <ColorField label="Proizvod — boja slova" value={t.productText} globalValue={g.productText} fallback="#ffffff" onChange={(v) => setT('productText', v)} />
                            <SizeField label="Proizvod — veličina slova" value={t.productFontSize} globalValue={g.productFontSize} min={10} max={22} def={14} onChange={(v) => setT('productFontSize', v)} />
                            <ColorField label="Proizvod — pozadina padajuće liste" value={t.productMenuBg} globalValue={g.productMenuBg} fallback="#0f172a" onChange={(v) => setT('productMenuBg', v)} />
                        </div>
                    </>
                )}

                {tab === 'paketi' && (
                    <>
                        {/* MINI LIVE PREVIEW PAKETA I DIMENZIJA */}
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80 space-y-2.5">
                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">👁️ Pregled Paketa i Dimenzija Uživo</div>
                            <div className="grid grid-cols-2 gap-2">
                                <div
                                    className="p-2.5 rounded-xl border-2"
                                    style={{
                                        backgroundColor: eff.pkgBg || '#0f172a',
                                        borderColor: eff.pkgBorder || '#334155',
                                        color: eff.pkgText || '#f8fafc',
                                    }}
                                >
                                    <div className="text-[9px] font-black uppercase opacity-70">Neselektovan</div>
                                    <div className="text-sm font-black">PAK-101</div>
                                    <div className="text-[10px] font-bold" style={{ color: eff.pkgSubText || '#38bdf8' }}>2.4x15x400 cm</div>
                                    <div className="text-[10px] font-black mt-1">80 kom • 1.152 m³</div>
                                </div>
                                <div
                                    className="p-2.5 rounded-xl border-2"
                                    style={{
                                        backgroundColor: eff.pkgSelectedBg || '#2563eb',
                                        borderColor: eff.pkgSelectedBorder || '#60a5fa',
                                        color: eff.pkgSelectedText || '#ffffff',
                                        boxShadow: eff.pkgSelectedGlow ? `0 0 14px ${eff.pkgSelectedGlow}` : undefined,
                                    }}
                                >
                                    <div className="text-[9px] font-black uppercase opacity-80">✓ Selektovan</div>
                                    <div className="text-sm font-black">PAK-102</div>
                                    <div className="text-[10px] font-bold opacity-90">5x10x300 cm</div>
                                    <div className="text-[10px] font-black mt-1">50 kom • 0.750 m³</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                                {['DEB (cm)', 'ŠIR (cm)', 'DUŽ (cm)'].map((lbl, idx) => (
                                    <div
                                        key={lbl}
                                        className="p-2 rounded-xl border text-center"
                                        style={{
                                            backgroundColor: eff.dimBg || '#0f172a',
                                            borderColor: eff.dimBorder || '#334155',
                                        }}
                                    >
                                        <div className="text-[8px] font-black uppercase" style={{ color: eff.dimLabelColor || '#94a3b8' }}>{lbl}</div>
                                        <div
                                            className="font-black leading-tight mt-0.5"
                                            style={{
                                                color: eff.dimText || '#ffffff',
                                                fontSize: eff.dimFontSize ? `${Math.min(22, parseInt(eff.dimFontSize, 10))}px` : '16px',
                                            }}
                                        >
                                            {[2.4, 15, 400][idx]}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <SectionTitle title="📦 Započeti Paket — Neselektovan" subtitle="Izgled paketa dok nije kliknut/otvoren" />
                        <div className="space-y-2">
                            <ColorField label="Pozadina neselektovanog paketa" value={t.pkgBg} globalValue={g.pkgBg} fallback="#0f172a" onChange={(v) => setT('pkgBg', v)} />
                            <ColorField label="Boja okvira neselektovanog paketa" value={t.pkgBorder} globalValue={g.pkgBorder} fallback="#334155" onChange={(v) => setT('pkgBorder', v)} />
                            <ColorField label="Boja glavnih slova (ID / Količina)" value={t.pkgText} globalValue={g.pkgText} fallback="#f8fafc" onChange={(v) => setT('pkgText', v)} />
                            <ColorField label="Boja podteksta (Dimenzija / Proizvod)" value={t.pkgSubText} globalValue={g.pkgSubText} fallback="#38bdf8" onChange={(v) => setT('pkgSubText', v)} />
                        </div>

                        <SectionTitle title="✅ Započeti Paket — SELEKTOVAN (Aktivan)" subtitle="Izgled paketa kada kliknete na njega" />
                        <div className="space-y-2">
                            <ColorField label="Pozadina selektovanog paketa" value={t.pkgSelectedBg} globalValue={g.pkgSelectedBg} fallback="#2563eb" onChange={(v) => setT('pkgSelectedBg', v)} />
                            <ColorField label="Boja okvira selektovanog paketa" value={t.pkgSelectedBorder} globalValue={g.pkgSelectedBorder} fallback="#60a5fa" onChange={(v) => setT('pkgSelectedBorder', v)} />
                            <ColorField label="Boja slova selektovanog paketa" value={t.pkgSelectedText} globalValue={g.pkgSelectedText} fallback="#ffffff" onChange={(v) => setT('pkgSelectedText', v)} />
                            <ColorField label="Boja sjaja (Glow) selektovanog paketa" value={t.pkgSelectedGlow} globalValue={g.pkgSelectedGlow} fallback="#3b82f6" onChange={(v) => setT('pkgSelectedGlow', v)} />
                        </div>

                        <SectionTitle title="📐 Polja Dimenzija (Deb / Šir / Duž)" subtitle="Unos dimenzija u Pilani, Doradi itd." />
                        <div className="space-y-2">
                            <ColorField label="Pozadina polja dimenzija" value={t.dimBg} globalValue={g.dimBg} fallback="#0f172a" onChange={(v) => setT('dimBg', v)} />
                            <ColorField label="Boja okvira polja dimenzija" value={t.dimBorder} globalValue={g.dimBorder} fallback="#38bdf8" onChange={(v) => setT('dimBorder', v)} />
                            <ColorField label="Boja brojeva/slova dimenzija" value={t.dimText} globalValue={g.dimText} fallback="#ffffff" onChange={(v) => setT('dimText', v)} />
                            <SizeField label="Veličina brojeva dimenzija" value={t.dimFontSize} globalValue={g.dimFontSize} min={14} max={34} def={22} onChange={(v) => setT('dimFontSize', v)} />
                            <ColorField label="Boja oznaka (Deb / Šir / Duž)" value={t.dimLabelColor} globalValue={g.dimLabelColor} fallback="#94a3b8" onChange={(v) => setT('dimLabelColor', v)} />
                        </div>
                    </>
                )}

                {tab === 'global' && (
                    <div className="space-y-3">
                        <div className="p-3.5 rounded-2xl bg-sky-950/40 border border-sky-500/40 space-y-2">
                            <div className="flex items-center gap-2 text-xs font-black text-sky-300 uppercase">
                                <Layers size={15} /> Kako radi hijerarhija dizajna
                            </div>
                            <ol className="text-[11px] text-slate-300 space-y-1 list-decimal list-inside leading-relaxed">
                                <li><strong>Aktivna tema</strong> (Industrial, Aurora, Light, Executive) je čista osnova.</li>
                                <li><strong>Globalni Admin Dizajn</strong> primjenjuje se na <strong>SVE module</strong> u aplikaciji.</li>
                                <li><strong>Dizajn ovog modula</strong> ({modulNaziv}) ima najveći prioritet samo unutar ovog modula.</li>
                            </ol>
                            <p className="text-[10px] text-amber-300 font-bold pt-1">
                                🔒 Uređivanje dizajna je dostupno isključivo Adminu i Superadminu. Svi radnici vide spašeni izgled, bez mogućnosti izmjene.
                            </p>
                        </div>

                        <button
                            type="button"
                            disabled={savingGlobal}
                            onClick={handleSaveGlobal}
                            className="w-full py-3.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all"
                        >
                            <Globe size={15} /> {savingGlobal ? 'Spremam...' : 'Primijeni ove boje GLOBALNO na SVE module'}
                        </button>

                        <div className="pt-2 border-t border-slate-800 space-y-2">
                            <button
                                type="button"
                                onClick={saas.resetujDizajnModula}
                                className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-amber-600 text-slate-200 hover:text-white font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 border border-slate-700 transition-all"
                            >
                                <RotateCcw size={14} /> Očisti lokalni dizajn za {modulNaziv}
                            </button>

                            <button
                                type="button"
                                onClick={saas.resetujGlobalniDizajn}
                                className="w-full py-3 px-4 rounded-xl bg-red-950/50 hover:bg-red-600 text-red-300 hover:text-white font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 border border-red-500/40 transition-all"
                            >
                                <RotateCcw size={14} /> Vrati GLOBALNI dizajn na fabričke teme
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* PODNOŽJE SA AKCIJAMA */}
            <div className="p-3.5 bg-slate-900 border-t border-slate-800 flex items-center gap-2 shrink-0">
                <button
                    type="button"
                    onClick={saas.odustani}
                    className="px-3.5 py-2.5 rounded-xl bg-red-950/60 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 text-[10px] font-black uppercase transition-colors"
                >
                    ✕ Odustani
                </button>
                <button
                    type="button"
                    onClick={saas.spasiDizajn}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg transition-colors"
                >
                    <Check size={14} /> Spasi za {modulNaziv}
                </button>
            </div>
        </aside>
    );

    return createPortal(drawerContent, document.body);
}
