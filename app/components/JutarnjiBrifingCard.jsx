"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { toLocalIso } from '../utils/dateHelpers';
import { jeQaTestniZapis } from '../utils/smartReminders';
import { Sun, ChevronDown, ChevronUp, Search, AlertTriangle, Flame, Wrench, TrendingUp, CheckCircle2 } from 'lucide-react';

export default function JutarnjiBrifingCard({ user, onNavigateModule }) {
    const [collapsed, setCollapsed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [brifing, setBrifing] = useState(null);

    const isExec = user?.uloga === 'superadmin' || user?.uloga === 'admin';

    useEffect(() => {
        if (!isExec) return;
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            try {
                const danasObj = new Date();
                const juceObj = new Date(danasObj.getFullYear(), danasObj.getMonth(), danasObj.getDate() - 1);
                const danasIso = toLocalIso(danasObj);
                const juceIso = toLocalIso(juceObj);

                const [prRes, pkRes, racRes, blRes, logRes, susRes, srvRes] = await Promise.all([
                    supabase.from('prorez_log').select('id, datum, created_at, zapremina, trupac_id').eq('datum', juceIso),
                    supabase.from('paketi').select('paket_id, datum_yyyy_mm, created_at, kolicina_final, naziv_proizvoda').eq('datum_yyyy_mm', juceIso),
                    supabase.from('racuni').select('id, kupac_naziv, datum, rok_placanja, ukupno_sa_pdv, status'),
                    supabase.from('blagajna').select('tip, iznos, datum, opis').eq('datum', juceIso),
                    supabase.from('sistem_audit_log').select('id, akcija, nivo_alarma, pregledano').eq('pregledano', false).limit(50),
                    supabase.from('ui_postavke').select('postavke_jsonb').eq('modul_ime', 'susare_sarze').maybeSingle(),
                    supabase.from('ui_postavke').select('postavke_jsonb').eq('modul_ime', 'servis_masina_pila').maybeSingle(),
                ]);

                if (cancelled) return;

                const juceProrez = (prRes.data || []).filter((x) => !jeQaTestniZapis(x));
                const jucePaketi = (pkRes.data || []).filter((x) => !jeQaTestniZapis(x));
                const juceProrezM3 = juceProrez.reduce((s, r) => s + (parseFloat(r.zapremina || 0) || 0), 0);
                const juceIzlazM3 = jucePaketi.reduce((s, p) => s + (parseFloat(p.kolicina_final || 0) || 0), 0);
                const juceYield = juceProrezM3 > 0 ? Math.min(100, (juceIzlazM3 / juceProrezM3) * 100) : 0;

                const juceUlazKM = (blRes.data || []).filter((b) => String(b.tip || '').toUpperCase().includes('ULAZ') && !jeQaTestniZapis(b)).reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);
                const juceIzlazKM = (blRes.data || []).filter((b) => !String(b.tip || '').toUpperCase().includes('ULAZ') && !jeQaTestniZapis(b)).reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);

                // Dospjeli nenaplaćeni računi
                const dospjeliRacuni = (racRes.data || []).filter((r) => {
                    if (jeQaTestniZapis(r)) return false;
                    const st = String(r.status || '').toUpperCase();
                    if (st === 'NAPLAĆENO' || st === 'PLAĆENO' || st === 'STORNIRANO') return false;
                    const rok = (r.rok_placanja || '').split('T')[0];
                    return rok && rok < danasIso;
                });
                const dospjeloKM = dospjeliRacuni.reduce((s, r) => s + (parseFloat(r.ukupno_sa_pdv || 0) || 0), 0);

                // Nepročitani kritični alarmi / zahtjevi
                const neprocitaniKrit = (logRes.data || []).filter((l) => l.nivo_alarma === 'CRVENO' || l.nivo_alarma === 'ŽUTO').length;

                // Sušare spremne ili pri kraju (<= 1 dan do planiranog kraja)
                const sarze = Array.isArray(susRes.data?.postavke_jsonb?.lista)
                    ? susRes.data.postavke_jsonb.lista
                    : (Array.isArray(susRes.data?.postavke_jsonb?.sarze) ? susRes.data.postavke_jsonb.sarze : []);
                const aktivneSarze = sarze.filter((s) => s.status === 'U SUŠENJU' || s.status === 'SUŠENJE');
                const susareSpremne = aktivneSarze.filter((s) => {
                    const kraj = s.plan_zavrsetak || s.planirani_kraj;
                    if (!kraj) return false;
                    const diff = Math.ceil((new Date(kraj).getTime() - new Date(danasIso).getTime()) / 86400000);
                    return diff <= 1;
                }).length;

                // Servis mašina/pila
                const servisi = Array.isArray(srvRes.data?.postavke_jsonb?.lista) ? srvRes.data.postavke_jsonb.lista : [];
                const servisiUpozorenje = servisi.filter((s) => s.status === 'POTREBAN_SERVIS').length;

                setBrifing({
                    juceIso,
                    juceProrezM3,
                    juceProrezKom: juceProrez.length,
                    juceIzlazM3,
                    juceYield,
                    juceUlazKM,
                    juceIzlazKM,
                    dospjeliBroj: dospjeliRacuni.length,
                    dospjeloKM,
                    neprocitaniKrit,
                    aktivneSarzeBroj: aktivneSarze.length,
                    susareSpremne,
                    servisiUpozorenje,
                });
            } catch (e) {
                console.error('Greška pri učitavanju jutarnjeg brifinga:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [isExec]);

    if (!isExec) return null;

    const otvoriKomandnuPaletu = () => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('open_command_palette'));
        }
    };

    const otvoriSusare = () => {
        try { localStorage.setItem('planiranje_auto_tab', 'susare'); } catch (e) {}
        onNavigateModule?.('planiranje');
    };

    return (
        <div
            data-testid="jutarnji-brifing-card"
            className="bg-gradient-to-br from-theme-card via-theme-card to-theme-accent/10 border border-theme-accent/35 rounded-[var(--radius-box)] p-4 sm:p-5 shadow-xl transition-all"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
                        <Sun size={20} />
                    </div>
                    <div>
                        <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-theme-text flex items-center gap-2">
                            Jutarnji Direktorski Brifing
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-theme-accent/20 text-theme-accent border border-theme-accent/30">
                                LIVE
                            </span>
                        </h3>
                        <p className="text-[10px] text-theme-muted font-bold mt-0.5">
                            Jučerašnji učinak i današnji prioriteti u jednom pogledu
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={otvoriKomandnuPaletu}
                        data-testid="brifing-ctrlk-btn"
                        className="px-3 py-2 rounded-xl bg-theme-panel hover:bg-theme-accent hover:text-white border border-theme-border text-[10px] font-black uppercase text-theme-text transition-all flex items-center gap-1.5 shadow-sm"
                    >
                        <Search size={13} /> Brza Pretraga <kbd className="hidden sm:inline px-1.5 py-0.5 rounded bg-theme-card border border-theme-border text-[9px] text-theme-muted">Ctrl+K</kbd>
                    </button>
                    <button
                        type="button"
                        onClick={() => setCollapsed((v) => !v)}
                        className="p-2 rounded-xl bg-theme-panel border border-theme-border text-theme-muted hover:text-theme-text transition-colors"
                        title={collapsed ? 'Proširi brifing' : 'Skupi brifing'}
                    >
                        {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>
                </div>
            </div>

            {!collapsed && (
                <div className="mt-4 pt-4 border-t border-theme-border/60">
                    {loading || !brifing ? (
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="h-20 rounded-2xl bg-theme-panel/60 animate-pulse border border-theme-border/40" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                            <button
                                type="button"
                                onClick={() => onNavigateModule?.('analitika')}
                                className="text-left p-3.5 rounded-2xl bg-theme-panel/80 hover:border-emerald-500/60 border border-theme-border transition-all group"
                            >
                                <span className="text-[9px] font-black uppercase text-theme-muted flex items-center justify-between">
                                    <span>🪵 Juče Prorez / Izlaz</span>
                                    <TrendingUp size={12} className="text-emerald-400" />
                                </span>
                                <p className="text-base sm:text-lg font-black text-theme-text mt-1">
                                    {brifing.juceProrezM3.toFixed(2)} → <span className="text-emerald-400">{brifing.juceIzlazM3.toFixed(2)} m³</span>
                                </p>
                                <p className="text-[10px] text-theme-muted font-bold mt-0.5">
                                    {brifing.juceProrezKom} trupaca • Yield {brifing.juceYield.toFixed(1)}%
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={() => onNavigateModule?.('blagajna')}
                                className="text-left p-3.5 rounded-2xl bg-theme-panel/80 hover:border-blue-500/60 border border-theme-border transition-all"
                            >
                                <span className="text-[9px] font-black uppercase text-theme-muted block">💵 Jučerašnji Keš Tok</span>
                                <p className="text-base sm:text-lg font-black text-emerald-400 mt-1">
                                    +{brifing.juceUlazKM.toFixed(0)} <span className="text-xs text-red-400">/ -{brifing.juceIzlazKM.toFixed(0)} KM</span>
                                </p>
                                <p className="text-[10px] text-theme-muted font-bold mt-0.5">
                                    Neto: {(brifing.juceUlazKM - brifing.juceIzlazKM).toFixed(2)} KM
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={() => onNavigateModule?.('racuni')}
                                className={`text-left p-3.5 rounded-2xl border transition-all ${brifing.dospjeliBroj > 0 ? 'bg-red-950/20 border-red-500/40 hover:border-red-400' : 'bg-theme-panel/80 border-theme-border hover:border-emerald-500/60'}`}
                            >
                                <span className="text-[9px] font-black uppercase text-theme-muted flex items-center justify-between">
                                    <span>🧾 Dospjeli Računi</span>
                                    {brifing.dospjeliBroj > 0 ? <AlertTriangle size={12} className="text-red-400" /> : <CheckCircle2 size={12} className="text-emerald-400" />}
                                </span>
                                <p className={`text-base sm:text-lg font-black mt-1 ${brifing.dospjeliBroj > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {brifing.dospjeliBroj} kom • {brifing.dospjeloKM.toFixed(0)} KM
                                </p>
                                <p className="text-[10px] text-theme-muted font-bold mt-0.5">
                                    {brifing.dospjeliBroj > 0 ? 'Klikni za naplatu & kartice' : 'Nema zakašnjelih faktura'}
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={otvoriSusare}
                                className={`text-left p-3.5 rounded-2xl border transition-all ${brifing.susareSpremne > 0 ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400' : 'bg-theme-panel/80 border-theme-border hover:border-amber-500/50'}`}
                            >
                                <span className="text-[9px] font-black uppercase text-theme-muted flex items-center justify-between">
                                    <span>🔥 Sušare & Servis</span>
                                    {brifing.susareSpremne > 0 ? <Flame size={12} className="text-amber-400" /> : <Wrench size={12} className="text-sky-400" />}
                                </span>
                                <p className="text-base sm:text-lg font-black text-amber-400 mt-1">
                                    {brifing.aktivneSarzeBroj} aktivnih šarži
                                </p>
                                <p className="text-[10px] text-theme-muted font-bold mt-0.5">
                                    {brifing.susareSpremne > 0 ? `🔥 ${brifing.susareSpremne} pri kraju!` : 'Otvori Sušare & Servis pila'}
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={() => onNavigateModule?.('toranj')}
                                className={`text-left p-3.5 rounded-2xl border transition-all col-span-2 lg:col-span-1 ${brifing.neprocitaniKrit > 0 ? 'bg-amber-950/25 border-amber-500/50 hover:border-amber-400' : 'bg-theme-panel/80 border-theme-border hover:border-theme-accent'}`}
                            >
                                <span className="text-[9px] font-black uppercase text-theme-muted block">🔔 Aktivni Alarmi</span>
                                <p className={`text-base sm:text-lg font-black mt-1 ${brifing.neprocitaniKrit > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {brifing.neprocitaniKrit} neriješenih
                                </p>
                                <p className="text-[10px] text-theme-muted font-bold mt-0.5">
                                    Otvori Kontrolni Toranj →
                                </p>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
