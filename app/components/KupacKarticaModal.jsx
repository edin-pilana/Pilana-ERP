"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, Lock, AlertTriangle, Printer, FileSpreadsheet, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
    izracunajKarticuKupca,
    mozeUredjivatiKreditniLimit,
    spasiKreditniLimitKupca,
    DOZVOLA_KREDITNI_LIMIT,
} from '../utils/kupacKreditHelpers';
import { exportToExcel } from '../utils/exportHelpers';
import { printDokument } from '../utils/printHelpers';
import { escapeHtml, prikazDatumaBHS } from '../utils/dateHelpers';

export default function KupacKarticaModal({ kupacNaziv, user, onClose, onLimitSaved = null }) {
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [kartica, setKartica] = useState(null);
    const [tab, setTab] = useState('racuni'); // 'racuni' | 'uplate' | 'reklamacije'

    // Forma kreditnog limita (otključana ISKLJUČIVO za Superadmina ili osobu sa dozvolom od Superadmina)
    const [limitForm, setLimitForm] = useState({ limitKM: '', maxKasnjenjeDana: '', blokirajPrekoracenje: false, napomena: '' });
    const [savingLimit, setSavingLimit] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const mozeMijenjatiLimit = mozeUredjivatiKreditniLimit(user);

    const loadKartica = async () => {
        if (!kupacNaziv) return;
        setLoading(true);
        try {
            const data = await izracunajKarticuKupca(kupacNaziv);
            setKartica(data);
            if (data?.limitPostavka) {
                setLimitForm({
                    limitKM: data.limitPostavka.limitKM || '',
                    maxKasnjenjeDana: data.limitPostavka.maxKasnjenjeDana || '',
                    blokirajPrekoracenje: Boolean(data.limitPostavka.blokirajPrekoracenje),
                    napomena: data.limitPostavka.napomena || '',
                });
            }
        } catch (e) {
            toast.error('Greška pri učitavanju kartice kupca.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadKartica(); }, [kupacNaziv]);

    const handleSaveLimit = async () => {
        if (!mozeMijenjatiLimit) {
            return toast.error(`Nemate ovlaštenje! Samo Superadmin ili osoba sa dozvolom "${DOZVOLA_KREDITNI_LIMIT}" može mijenjati limit.`);
        }
        setSavingLimit(true);
        try {
            const { error } = await spasiKreditniLimitKupca(kupacNaziv, limitForm, user);
            if (error) return toast.error(error.message || 'Greška pri snimanju limita.');
            toast.success(`Kreditni limit za kupca "${kupacNaziv}" je uspješno spašen!`);
            await loadKartica();
            if (onLimitSaved) onLimitSaved();
        } finally {
            setSavingLimit(false);
        }
    };

    const handlePrintPdf = () => {
        if (!kartica) return;
        const redovi = kartica.racuni.map((r, i) => `
            <tr>
                <td>${i + 1}.</td>
                <td><b>${escapeHtml(r.id)}</b></td>
                <td>${escapeHtml(prikazDatumaBHS(r.datum))}</td>
                <td>${escapeHtml(prikazDatumaBHS(r.rokIso))}</td>
                <td class="num">${r.ukupnoKM.toFixed(2)} KM</td>
                <td class="num">${r.uplacenoKM.toFixed(2)} KM</td>
                <td class="num"><b>${r.preostaloKM.toFixed(2)} KM</b></td>
                <td style="text-align:center;">${r.kasniDana > 0 ? `Kasni ${r.kasniDana}d` : escapeHtml(r.status)}</td>
            </tr>
        `).join('');

        const html = `
            <div class="info-grid">
                <div class="info-col-left">
                    <h4>Finansijska Kartica Kupca</h4>
                    <h2>${escapeHtml(kupacNaziv)}</h2>
                    <p>Kreditni limit: <b>${kartica.limitPostavka.limitKM > 0 ? `${kartica.limitPostavka.limitKM.toFixed(2)} KM` : 'Nije ograničen'}</b></p>
                </div>
                <div class="info-col-right">
                    <p>Ukupno fakturisano: <b>${kartica.ukupnoFakturisanoKM.toFixed(2)} KM</b></p>
                    <p>Ukupno naplaćeno: <b>${kartica.ukupnoNaplacenoKM.toFixed(2)} KM</b></p>
                    <p>OTVORENI SALDO (DUG): <b style="color:#dc2626;">${kartica.otvoreniDugKM.toFixed(2)} KM</b></p>
                </div>
            </div>
            <table>
                <thead><tr><th>Aging Potraživanja</th><th class="num">U roku</th><th class="num">1–30 dana</th><th class="num">31–60 dana</th><th class="num">61–90 dana</th><th class="num">90+ dana</th></tr></thead>
                <tbody><tr><td><b>Iznos (KM)</b></td><td class="num">${kartica.aging.uRoku.toFixed(2)}</td><td class="num">${kartica.aging.d1_30.toFixed(2)}</td><td class="num">${kartica.aging.d31_60.toFixed(2)}</td><td class="num">${kartica.aging.d61_90.toFixed(2)}</td><td class="num" style="color:#dc2626;"><b>${kartica.aging.d90plus.toFixed(2)}</b></td></tr></tbody>
            </table>
            <table style="margin-top:14px;">
                <thead><tr><th>#</th><th>Račun</th><th>Datum</th><th>Rok</th><th class="num">Ukupno</th><th class="num">Uplaćeno</th><th class="num">Dug</th><th style="text-align:center;">Status</th></tr></thead>
                <tbody>${redovi}</tbody>
            </table>
        `;
        printDokument('KARTICA KUPCA', kupacNaziv, prikazDatumaBHS(new Date().toISOString().slice(0, 10)), html, '#2563eb');
    };

    const handleExcel = () => {
        if (!kartica) return;
        exportToExcel({
            filename: `Kartica_Kupca_${kupacNaziv}_${new Date().toISOString().slice(0, 10)}`,
            sheetName: 'Kartica Kupca',
            title: `Finansijska Kartica Kupca: ${kupacNaziv}`,
            columns: [
                { key: 'id', label: 'Broj Računa', width: 130 },
                { key: 'datum', label: 'Datum', width: 95 },
                { key: 'rokIso', label: 'Rok Valute', width: 95 },
                { key: 'ukupnoKM', label: 'Ukupno (KM)', type: 'number', width: 115 },
                { key: 'uplacenoKM', label: 'Uplaćeno (KM)', type: 'number', width: 115 },
                { key: 'preostaloKM', label: 'Otvoreni Dug (KM)', type: 'number', width: 125 },
                { key: 'kasniDana', label: 'Kašnjenje (dana)', type: 'number', width: 110 },
                { key: 'status', label: 'Status', width: 105 },
            ],
            rows: kartica.racuni,
            summaryRow: {
                id: 'UKUPNO',
                ukupnoKM: kartica.ukupnoFakturisanoKM,
                uplacenoKM: kartica.ukupnoNaplacenoKM,
                preostaloKM: kartica.otvoreniDugKM,
            },
        });
    };

    if (!mounted || !kupacNaziv) return null;

    const agTotal = kartica
        ? Math.max(0.01, kartica.aging.uRoku + kartica.aging.d1_30 + kartica.aging.d31_60 + kartica.aging.d61_90 + kartica.aging.d90plus)
        : 1;

    return createPortal(
        <div
            data-testid="kupac-kartica-modal"
            onClick={onClose}
            className="erp-modal-backdrop fixed inset-0 z-[10075] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-4xl max-h-[92vh] bg-theme-card border-2 border-theme-border rounded-[2rem] shadow-2xl flex flex-col overflow-hidden"
            >
                {/* HEADER */}
                <div className="p-5 bg-theme-panel/80 border-b border-theme-border flex items-start justify-between gap-3 shrink-0">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-theme-accent/20 text-theme-accent border border-theme-accent/40">
                                💳 Finansijska Kartica Kupca
                            </span>
                            {kartica?.prekoracenLimit && (
                                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-red-600 text-white animate-pulse">
                                    🚨 PREKORAČEN LIMIT
                                </span>
                            )}
                            {kartica?.prekoracenoKasnjenje && (
                                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500 text-black">
                                    ⏳ KASNI {kartica.najstarijeKasnjenjeDana} DANA
                                </span>
                            )}
                        </div>
                        <h3 className="text-lg sm:text-xl font-black text-theme-text uppercase mt-1.5 truncate">{kupacNaziv}</h3>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button type="button" onClick={handleExcel} className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/40 text-[10px] font-black uppercase flex items-center gap-1.5 transition-colors">
                            <FileSpreadsheet size={14} /> Excel
                        </button>
                        <button type="button" onClick={handlePrintPdf} className="px-3 py-2 rounded-xl bg-theme-card hover:bg-theme-accent text-theme-text hover:text-white border border-theme-border text-[10px] font-black uppercase flex items-center gap-1.5 transition-colors">
                            <Printer size={14} /> PDF
                        </button>
                        <button type="button" onClick={onClose} className="p-2 rounded-xl bg-theme-card border border-theme-border text-theme-muted hover:text-red-400">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                    {loading || !kartica ? (
                        <div className="p-12 text-center text-xs font-black uppercase text-theme-muted animate-pulse">
                            Obračunavam finansijsku karticu i Aging strukturu...
                        </div>
                    ) : (
                        <>
                            {/* KPI KARTICE */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <div className="p-4 rounded-2xl bg-theme-panel border border-theme-border">
                                    <span className="text-[9px] text-theme-muted uppercase font-black">Ukupno Fakturisano</span>
                                    <p className="text-xl font-black text-theme-text mt-1">{kartica.ukupnoFakturisanoKM.toFixed(2)} <span className="text-xs text-theme-muted">KM</span></p>
                                </div>
                                <div className="p-4 rounded-2xl bg-theme-panel border border-emerald-500/30">
                                    <span className="text-[9px] text-emerald-400 uppercase font-black">Ukupno Naplaćeno</span>
                                    <p className="text-xl font-black text-emerald-400 mt-1">{kartica.ukupnoNaplacenoKM.toFixed(2)} <span className="text-xs">KM</span></p>
                                </div>
                                <div className="p-4 rounded-2xl bg-theme-panel border border-amber-500/30">
                                    <span className="text-[9px] text-amber-400 uppercase font-black">Povrati / Reklamacije</span>
                                    <p className="text-xl font-black text-amber-400 mt-1">{kartica.povratReklamacijeKM.toFixed(2)} <span className="text-xs">KM</span></p>
                                </div>
                                <div className={`p-4 rounded-2xl border-2 ${kartica.otvoreniDugKM > 0 ? 'bg-red-950/20 border-red-500/50' : 'bg-emerald-950/20 border-emerald-500/50'}`}>
                                    <span className="text-[9px] uppercase font-black text-theme-muted">Otvoreni Saldo (Dug)</span>
                                    <p className={`text-xl font-black mt-1 ${kartica.otvoreniDugKM > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {kartica.otvoreniDugKM.toFixed(2)} <span className="text-xs">KM</span>
                                    </p>
                                </div>
                            </div>

                            {/* AGING 30 / 60 / 90+ DANA */}
                            <div className="p-4 rounded-2xl bg-theme-panel border border-theme-border space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-theme-accent">📊 Starost Potraživanja (Aging 30 / 60 / 90+ dana)</h4>
                                    {kartica.najstarijeKasnjenjeDana > 0 && (
                                        <span className="text-[10px] font-black text-red-400">Najstariji dug kasni {kartica.najstarijeKasnjenjeDana} dana</span>
                                    )}
                                </div>
                                <div className="w-full h-3 rounded-full bg-theme-card overflow-hidden flex border border-theme-border">
                                    {kartica.aging.uRoku > 0 && <div style={{ width: `${(kartica.aging.uRoku / agTotal) * 100}%` }} className="bg-emerald-500 h-full" title="U roku" />}
                                    {kartica.aging.d1_30 > 0 && <div style={{ width: `${(kartica.aging.d1_30 / agTotal) * 100}%` }} className="bg-sky-500 h-full" title="1–30 dana" />}
                                    {kartica.aging.d31_60 > 0 && <div style={{ width: `${(kartica.aging.d31_60 / agTotal) * 100}%` }} className="bg-amber-500 h-full" title="31–60 dana" />}
                                    {kartica.aging.d61_90 > 0 && <div style={{ width: `${(kartica.aging.d61_90 / agTotal) * 100}%` }} className="bg-orange-500 h-full" title="61–90 dana" />}
                                    {kartica.aging.d90plus > 0 && <div style={{ width: `${(kartica.aging.d90plus / agTotal) * 100}%` }} className="bg-red-600 h-full" title="90+ dana" />}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                                    {[
                                        { label: 'U roku', val: kartica.aging.uRoku, cls: 'text-emerald-400 border-emerald-500/30' },
                                        { label: '1–30 dana', val: kartica.aging.d1_30, cls: 'text-sky-400 border-sky-500/30' },
                                        { label: '31–60 dana', val: kartica.aging.d31_60, cls: 'text-amber-400 border-amber-500/30' },
                                        { label: '61–90 dana', val: kartica.aging.d61_90, cls: 'text-orange-400 border-orange-500/30' },
                                        { label: '90+ dana', val: kartica.aging.d90plus, cls: 'text-red-400 border-red-500/40' },
                                    ].map((b) => (
                                        <div key={b.label} className={`p-2.5 rounded-xl bg-theme-card border ${b.cls}`}>
                                            <div className="text-[9px] font-black uppercase text-theme-muted">{b.label}</div>
                                            <div className="text-sm font-black mt-0.5">{b.val.toFixed(2)} KM</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* KREDITNI LIMIT (SAMO SUPERADMIN ILI OVLAŠTENA OSOBA!) */}
                            <div className={`p-4 rounded-2xl border-2 space-y-3 ${mozeMijenjatiLimit ? 'bg-amber-950/15 border-amber-500/40' : 'bg-theme-panel border-theme-border'}`}>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        {mozeMijenjatiLimit ? <ShieldCheck size={16} className="text-amber-400" /> : <Lock size={16} className="text-theme-muted" />}
                                        <h4 className="text-xs font-black uppercase tracking-wider text-theme-text">
                                            Kreditni Limit & Zaštita Naplate
                                        </h4>
                                    </div>
                                    <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${mozeMijenjatiLimit ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' : 'bg-theme-card text-theme-muted border-theme-border'}`}>
                                        {mozeMijenjatiLimit ? '✓ Ovlašteni za izmjenu limita' : '🔒 Samo Superadmin ili ovlaštena osoba'}
                                    </span>
                                </div>

                                {kartica.limitPostavka.limitKM > 0 && (
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] font-black">
                                            <span className="text-theme-muted">Iskorištenost limita: {kartica.otvoreniDugKM.toFixed(2)} / {kartica.limitPostavka.limitKM.toFixed(2)} KM</span>
                                            <span className={kartica.iskoristenostProc >= 100 ? 'text-red-400' : kartica.iskoristenostProc >= 80 ? 'text-amber-400' : 'text-emerald-400'}>
                                                {kartica.iskoristenostProc}%
                                            </span>
                                        </div>
                                        <div className="w-full h-2.5 rounded-full bg-theme-card overflow-hidden border border-theme-border">
                                            <div
                                                className={`h-full transition-all ${kartica.iskoristenostProc >= 100 ? 'bg-red-500' : kartica.iskoristenostProc >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${Math.min(100, kartica.iskoristenostProc)}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-theme-muted block mb-1">Max Kreditni Limit (KM, 0 = bez limita)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="100"
                                            disabled={!mozeMijenjatiLimit}
                                            value={limitForm.limitKM}
                                            onChange={(e) => setLimitForm((p) => ({ ...p, limitKM: e.target.value }))}
                                            placeholder="npr. 15000"
                                            className="w-full p-2.5 rounded-xl bg-theme-card border border-theme-border text-xs font-black text-theme-text disabled:opacity-60"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-theme-muted block mb-1">Max Dozvoljeno Kašnjenje (dana)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            disabled={!mozeMijenjatiLimit}
                                            value={limitForm.maxKasnjenjeDana}
                                            onChange={(e) => setLimitForm((p) => ({ ...p, maxKasnjenjeDana: e.target.value }))}
                                            placeholder="npr. 30"
                                            className="w-full p-2.5 rounded-xl bg-theme-card border border-theme-border text-xs font-black text-theme-text disabled:opacity-60"
                                        />
                                    </div>
                                    <label className={`p-2.5 rounded-xl bg-theme-card border border-theme-border flex items-center gap-2 self-end min-h-[42px] ${mozeMijenjatiLimit ? 'cursor-pointer' : 'opacity-60'}`}>
                                        <input
                                            type="checkbox"
                                            disabled={!mozeMijenjatiLimit}
                                            checked={limitForm.blokirajPrekoracenje}
                                            onChange={(e) => setLimitForm((p) => ({ ...p, blokirajPrekoracenje: e.target.checked }))}
                                            className="w-4 h-4 accent-red-500"
                                        />
                                        <span className="text-[10px] font-black uppercase text-red-400">Strogo blokiraj otpremu preko limita</span>
                                    </label>
                                </div>

                                {mozeMijenjatiLimit && (
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
                                        <input
                                            type="text"
                                            value={limitForm.napomena}
                                            onChange={(e) => setLimitForm((p) => ({ ...p, napomena: e.target.value }))}
                                            placeholder="Napomena odobrenja limita (opcionalno)..."
                                            className="flex-1 p-2.5 rounded-xl bg-theme-card border border-theme-border text-xs text-theme-text"
                                        />
                                        <button
                                            type="button"
                                            data-testid="save-kredit-limit-btn"
                                            disabled={savingLimit}
                                            onClick={handleSaveLimit}
                                            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] uppercase flex items-center justify-center gap-1.5 shadow-md shrink-0"
                                        >
                                            <Save size={14} /> {savingLimit ? 'Spremam...' : 'Spasi Limit'}
                                        </button>
                                    </div>
                                )}

                                {kartica.limitPostavka.odobrio && (
                                    <p className="text-[10px] text-theme-muted font-bold">
                                        Zadnja izmjena limita: <strong className="text-theme-text">{kartica.limitPostavka.odobrio}</strong>
                                        {kartica.limitPostavka.datum_izmjene ? ` (${new Date(kartica.limitPostavka.datum_izmjene).toLocaleDateString('bs-BA')})` : ''}
                                    </p>
                                )}
                            </div>

                            {/* TABOVI DETALJA */}
                            <div>
                                <div className="flex gap-2 mb-3">
                                    <button type="button" onClick={() => setTab('racuni')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${tab === 'racuni' ? 'bg-theme-accent text-white' : 'bg-theme-panel text-theme-muted border border-theme-border'}`}>
                                        🧾 Računi ({kartica.racuni.length})
                                    </button>
                                    <button type="button" onClick={() => setTab('uplate')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${tab === 'uplate' ? 'bg-theme-accent text-white' : 'bg-theme-panel text-theme-muted border border-theme-border'}`}>
                                        💵 Uplate / Blagajna ({kartica.uplate.length})
                                    </button>
                                    <button type="button" onClick={() => setTab('reklamacije')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${tab === 'reklamacije' ? 'bg-theme-accent text-white' : 'bg-theme-panel text-theme-muted border border-theme-border'}`}>
                                        ⚠️ Reklamacije ({kartica.reklamacije.length})
                                    </button>
                                </div>

                                {tab === 'racuni' && (
                                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                        {kartica.racuni.length === 0 ? (
                                            <p className="text-xs text-theme-muted text-center py-6 italic">Kupac još nema izdanih računa.</p>
                                        ) : kartica.racuni.map((r) => (
                                            <div key={r.id} className="p-3 rounded-xl bg-theme-panel border border-theme-border flex flex-wrap items-center justify-between gap-2 text-xs">
                                                <div>
                                                    <span className="font-black text-theme-text font-mono">{r.id}</span>
                                                    <span className="text-theme-muted ml-2">Datum: {prikazDatumaBHS(r.datum)} • Rok: {prikazDatumaBHS(r.rokIso)}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-theme-muted">Ukupno: <b>{r.ukupnoKM.toFixed(2)} KM</b></span>
                                                    <span className={r.preostaloKM > 0 ? 'text-red-400 font-black' : 'text-emerald-400 font-black'}>
                                                        {r.preostaloKM > 0 ? `Dug: ${r.preostaloKM.toFixed(2)} KM${r.kasniDana > 0 ? ` (${r.kasniDana}d)` : ''}` : 'NAPLAĆENO ✅'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {tab === 'uplate' && (
                                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                        {kartica.uplate.length === 0 ? (
                                            <p className="text-xs text-theme-muted text-center py-6 italic">Nema evidentiranih uplata u blagajni.</p>
                                        ) : kartica.uplate.map((u) => (
                                            <div key={u.id} className="p-3 rounded-xl bg-theme-panel border border-theme-border flex items-center justify-between gap-2 text-xs">
                                                <div className="min-w-0">
                                                    <span className="font-black text-theme-text">{u.kategorija}</span>
                                                    <p className="text-[10px] text-theme-muted truncate">{u.opis} • {prikazDatumaBHS(u.datum)}</p>
                                                </div>
                                                <span className={`font-black shrink-0 ${u.tip === 'ULAZ' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {u.tip === 'ULAZ' ? '+' : '-'}{parseFloat(u.iznos || 0).toFixed(2)} KM
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {tab === 'reklamacije' && (
                                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                        {kartica.reklamacije.length === 0 ? (
                                            <p className="text-xs text-theme-muted text-center py-6 italic">Kupac nema evidentiranih reklamacija. ✅</p>
                                        ) : kartica.reklamacije.map((rek) => (
                                            <div key={rek.id} className="p-3 rounded-xl bg-theme-panel border border-theme-border flex items-center justify-between gap-2 text-xs">
                                                <div>
                                                    <span className="font-black text-theme-text">{rek.paket_id}</span>
                                                    <span className="text-theme-muted ml-2">{rek.naziv_proizvoda} ({rek.kolicina} m³)</span>
                                                </div>
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-theme-card border border-theme-border text-amber-400">{rek.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
