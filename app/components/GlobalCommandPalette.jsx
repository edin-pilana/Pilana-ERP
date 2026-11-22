"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, ArrowRight, User, FileText, Package, Layers, Receipt, Settings, Shield, Wrench, Flame } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { normalizujZaPretragu } from './MasterSearch';

export default function GlobalCommandPalette({ isOpen, onClose, user, modules = [], onNavigateModule, onOpenKupacKartica }) {
    const [mounted, setMounted] = useState(false);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [dataset, setDataset] = useState({
        kupci: [],
        ponude: [],
        nalozi: [],
        otpremnice: [],
        racuni: [],
        paketi: [],
        trupci: [],
    });
    const inputRef = useRef(null);
    const loadedAtRef = useRef(0);

    useEffect(() => { setMounted(true); }, []);

    const isAdminOrSuper = user?.uloga === 'superadmin' || user?.uloga === 'admin';
    const dozvole = Array.isArray(user?.dozvole) ? user.dozvole : [];
    const imaPristup = (kljuc) => {
        if (isAdminOrSuper) return true;
        const map = {
            kupci: ['Ponude', 'Otpremnice i Izdatnice', 'Računi', 'Računi (Fakturisanje)', 'Baza Kupaca (Edit)'],
            ponude: ['Ponude'],
            nalozi: ['Radni Nalozi', 'Pilana (Izlaz)', 'Dorada (Ulaz/Izlaz)', 'Planiranje Proizvodnje'],
            otpremnice: ['Otpremnice i Izdatnice'],
            racuni: ['Računi', 'Računi (Fakturisanje)', 'Blagajna (Keš)'],
            paketi: ['Lager Paketa', 'Pilana (Izlaz)', 'Dorada (Ulaz/Izlaz)', 'Otpremnice i Izdatnice', 'Reklamacije i Povrati'],
            trupci: ['Prijem trupaca', 'Prorez (Trupci)', 'Lager Paketa'],
        };
        return (map[kljuc] || []).some((d) => dozvole.includes(d));
    };

    useEffect(() => {
        if (!isOpen) return;
        setQuery('');
        setSelectedIdx(0);
        setTimeout(() => inputRef.current?.focus(), 40);

        // Keširaj do 45s da otvaranje bude trenutno
        if (Date.now() - loadedAtRef.current < 45000 && dataset.kupci.length + dataset.paketi.length > 0) return;

        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const [kRes, pRes, rnRes, oRes, rRes, pkRes, tRes] = await Promise.all([
                    imaPristup('kupci') ? supabase.from('kupci').select('id, naziv, adresa, pdv_broj').limit(300) : Promise.resolve({ data: [] }),
                    imaPristup('ponude') ? supabase.from('ponude').select('id, kupac_naziv, datum, status, ukupno_sa_pdv, valuta').order('datum', { ascending: false }).limit(120) : Promise.resolve({ data: [] }),
                    imaPristup('nalozi') ? supabase.from('radni_nalozi').select('id, kupac_naziv, datum, status').order('datum', { ascending: false }).limit(120) : Promise.resolve({ data: [] }),
                    imaPristup('otpremnice') ? supabase.from('otpremnice').select('id, kupac_naziv, datum, status').order('datum', { ascending: false }).limit(120) : Promise.resolve({ data: [] }),
                    imaPristup('racuni') ? supabase.from('racuni').select('id, kupac_naziv, datum, status, ukupno_sa_pdv, valuta').order('datum', { ascending: false }).limit(120) : Promise.resolve({ data: [] }),
                    imaPristup('paketi') ? supabase.from('paketi').select('paket_id, naziv_proizvoda, debljina, sirina, duzina, kolicina_final, status, otpremnica_id').order('created_at', { ascending: false }).limit(250) : Promise.resolve({ data: [] }),
                    imaPristup('trupci') ? supabase.from('trupci').select('id, broj_plocice, vrsta, status, zapremina, kontrolna_zapremina').order('created_at', { ascending: false }).limit(150) : Promise.resolve({ data: [] }),
                ]);

                if (cancelled) return;
                // Dedupliciraj pakete po paket_id
                const pkMap = {};
                (pkRes.data || []).forEach((pk) => {
                    if (!pk.paket_id) return;
                    if (!pkMap[pk.paket_id]) pkMap[pk.paket_id] = { ...pk, m3: 0 };
                    pkMap[pk.paket_id].m3 += parseFloat(pk.kolicina_final || 0) || 0;
                });

                setDataset({
                    kupci: kRes.data || [],
                    ponude: pRes.data || [],
                    nalozi: rnRes.data || [],
                    otpremnice: oRes.data || [],
                    racuni: rRes.data || [],
                    paketi: Object.values(pkMap),
                    trupci: tRes.data || [],
                });
                loadedAtRef.current = Date.now();
            } catch (e) {
                console.error('Ctrl+K load error:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [isOpen]);

    const rezultati = useMemo(() => {
        const q = normalizujZaPretragu(query);
        const tokeni = q ? q.split(/\s+/).filter(Boolean) : [];
        const match = (text) => {
            if (tokeni.length === 0) return true;
            const norm = normalizujZaPretragu(text);
            return tokeni.every((t) => norm.includes(t));
        };

        const out = [];

        // 1. Moduli i brze akcije
        (modules || []).forEach((m) => {
            if (match(`${m.naziv} ${m.id} modul`)) {
                out.push({
                    id: `mod_${m.id}`,
                    grupa: 'MODULI',
                    naslov: m.naziv,
                    podnaslov: `Otvori modul ${m.naziv}`,
                    ikona: m.ikona || '📌',
                    akcija: () => { onNavigateModule(m.id); onClose(); },
                });
            }
        });

        // Specijalna brza akcija za Sušare i Servis pila
        if ((isAdminOrSuper || dozvole.includes('Planiranje Proizvodnje')) && match('susare susara servis pile odrzavanje masina komora')) {
            out.push({
                id: 'act_susare',
                grupa: 'BRZE AKCIJE',
                naslov: 'Sušare & Servis Mašina / Pila',
                podnaslov: 'Otvori komore sušare i evidenciju oštrenja pila u Planiranju',
                ikona: '🔥',
                akcija: () => {
                    localStorage.setItem('planiranje_auto_tab', 'susare');
                    onNavigateModule('planiranje');
                    onClose();
                },
            });
        }

        if (tokeni.length === 0) {
            return out.slice(0, 12);
        }

        // 2. Kupci -> otvara Finansijsku karticu kupca!
        dataset.kupci.forEach((k) => {
            if (match(`${k.naziv} ${k.adresa || ''} ${k.pdv_broj || ''} kupac kartica saldo`)) {
                out.push({
                    id: `kup_${k.id || k.naziv}`,
                    grupa: 'KUPCI (FINANSIJSKA KARTICA)',
                    naslov: k.naziv,
                    podnaslov: `${k.adresa || 'Kupac'}${k.pdv_broj ? ` • PDV: ${k.pdv_broj}` : ''} — Klikni za Karticu, Aging & Limit`,
                    ikona: '💳',
                    akcija: () => {
                        onClose();
                        if (onOpenKupacKartica) onOpenKupacKartica(k.naziv);
                    },
                });
            }
        });

        // 3. Ponude
        dataset.ponude.forEach((p) => {
            if (match(`${p.id} ${p.kupac_naziv || ''} ${p.status || ''} ponuda`)) {
                out.push({
                    id: `pon_${p.id}`,
                    grupa: 'PONUDE',
                    naslov: `${p.id} — ${p.kupac_naziv || ''}`,
                    podnaslov: `${p.datum || ''} • ${p.status || ''} • ${p.ukupno_sa_pdv || 0} ${p.valuta || 'KM'}`,
                    ikona: '📝',
                    akcija: () => {
                        window.dispatchEvent(new CustomEvent('navigacija_na_modul', { detail: { modul: 'toranj', autoOpenId: p.id } }));
                        onClose();
                    },
                });
            }
        });

        // 4. Radni nalozi
        dataset.nalozi.forEach((n) => {
            if (match(`${n.id} ${n.kupac_naziv || ''} ${n.status || ''} radni nalog`)) {
                out.push({
                    id: `rn_${n.id}`,
                    grupa: 'RADNI NALOZI',
                    naslov: `${n.id} — ${n.kupac_naziv || ''}`,
                    podnaslov: `${n.datum || ''} • Status: ${n.status || ''}`,
                    ikona: '⚙️',
                    akcija: () => {
                        window.dispatchEvent(new CustomEvent('navigacija_na_modul', { detail: { modul: 'toranj', autoOpenId: n.id } }));
                        onClose();
                    },
                });
            }
        });

        // 5. Otpremnice
        dataset.otpremnice.forEach((o) => {
            if (match(`${o.id} ${o.kupac_naziv || ''} ${o.status || ''} otpremnica`)) {
                out.push({
                    id: `otp_${o.id}`,
                    grupa: 'OTPREMNICE',
                    naslov: `${o.id} — ${o.kupac_naziv || ''}`,
                    podnaslov: `${o.datum || ''} • ${o.status || ''}`,
                    ikona: '🚚',
                    akcija: () => {
                        window.dispatchEvent(new CustomEvent('navigacija_na_modul', { detail: { modul: 'toranj', autoOpenId: o.id } }));
                        onClose();
                    },
                });
            }
        });

        // 6. Računi
        dataset.racuni.forEach((r) => {
            if (match(`${r.id} ${r.kupac_naziv || ''} ${r.status || ''} racun`)) {
                out.push({
                    id: `rac_${r.id}`,
                    grupa: 'RAČUNI',
                    naslov: `${r.id} — ${r.kupac_naziv || ''}`,
                    podnaslov: `${r.datum || ''} • ${r.status || ''} • ${r.ukupno_sa_pdv || 0} ${r.valuta || 'KM'}`,
                    ikona: '🧾',
                    akcija: () => {
                        window.dispatchEvent(new CustomEvent('navigacija_na_modul', { detail: { modul: 'toranj', autoOpenId: r.id } }));
                        onClose();
                    },
                });
            }
        });

        // 7. Paketi
        dataset.paketi.forEach((pk) => {
            if (match(`${pk.paket_id} ${pk.naziv_proizvoda || ''} ${pk.debljina}x${pk.sirina}x${pk.duzina} ${pk.otpremnica_id || ''} paket`)) {
                out.push({
                    id: `pk_${pk.paket_id}`,
                    grupa: 'PAKETI',
                    naslov: `${pk.paket_id} — ${pk.naziv_proizvoda || ''}`,
                    podnaslov: `${pk.debljina || 0}x${pk.sirina || 0}x${pk.duzina || 0} cm • ${Number(pk.m3 || 0).toFixed(3)} m³ • ${pk.otpremnica_id ? `Isporučen (${pk.otpremnica_id})` : 'Na stanju'}`,
                    ikona: '📦',
                    akcija: () => {
                        window.dispatchEvent(new CustomEvent('navigacija_na_modul', { detail: { modul: 'toranj', autoOpenId: pk.paket_id } }));
                        onClose();
                    },
                });
            }
        });

        // 8. Trupci
        dataset.trupci.forEach((t) => {
            if (match(`${t.id} ${t.broj_plocice || ''} ${t.vrsta || ''} ${t.status || ''} trupac`)) {
                out.push({
                    id: `tr_${t.id}`,
                    grupa: 'TRUPCI',
                    naslov: `${t.id}${t.broj_plocice ? ` (Pločica: ${t.broj_plocice})` : ''}`,
                    podnaslov: `${t.vrsta || 'Trupac'} • ${Number(t.kontrolna_zapremina || t.zapremina || 0).toFixed(3)} m³ • ${t.status || ''}`,
                    ikona: '🌲',
                    akcija: () => {
                        window.dispatchEvent(new CustomEvent('navigacija_na_modul', { detail: { modul: 'toranj', autoOpenId: t.id } }));
                        onClose();
                    },
                });
            }
        });

        return out.slice(0, 35);
    }, [query, modules, dataset, isAdminOrSuper, dozvole]);

    useEffect(() => { setSelectedIdx(0); }, [query]);

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIdx((prev) => (rezultati.length > 0 ? Math.min(prev + 1, rezultati.length - 1) : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIdx((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (rezultati[selectedIdx]) {
                rezultati[selectedIdx].akcija();
            }
        }
    };

    if (!mounted || !isOpen) return null;

    return createPortal(
        <div
            data-testid="command-palette-overlay"
            onClick={onClose}
            className="erp-modal-backdrop fixed inset-0 z-[10080] bg-slate-950/75 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-3 sm:px-6 animate-in fade-in"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-2xl bg-theme-card border-2 border-theme-accent/60 rounded-[1.75rem] shadow-[0_30px_90px_rgba(0,0,0,0.75)] overflow-hidden flex flex-col max-h-[75vh]"
            >
                <div className="flex items-center gap-3 px-5 py-4 border-b border-theme-border bg-theme-panel/70">
                    <Search size={20} className="text-theme-accent shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        data-testid="command-palette-input"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Pretraži kupce, ponude, naloge, pakete, račune, trupce ili module..."
                        className="flex-1 bg-transparent text-sm sm:text-base font-black text-theme-text outline-none placeholder:text-theme-muted/60"
                    />
                    {loading && <span className="text-[10px] font-black uppercase text-theme-accent animate-pulse">Učitavam...</span>}
                    <kbd className="hidden sm:inline-block px-2 py-1 rounded-lg bg-theme-card border border-theme-border text-[9px] font-black text-theme-muted">ESC</kbd>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-xl bg-theme-card border border-theme-border text-theme-muted hover:text-red-400">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-theme-border/40">
                    {rezultati.length === 0 ? (
                        <div className="p-10 text-center text-xs text-theme-muted font-bold">
                            Nema rezultata za „{query}“. Probajte naziv kupca, broj dokumenta (RN-, PON-, RAC-, OTP-), ID paketa ili naziv modula.
                        </div>
                    ) : (
                        rezultati.map((item, idx) => {
                            const active = idx === selectedIdx;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onMouseEnter={() => setSelectedIdx(idx)}
                                    onClick={item.akcija}
                                    className={`w-full px-5 py-3.5 text-left flex items-center justify-between gap-3 transition-colors ${
                                        active ? 'bg-theme-accent/20 border-l-4 border-l-theme-accent' : 'hover:bg-theme-panel/70 border-l-4 border-l-transparent'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <span className="text-xl shrink-0">{item.ikona}</span>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs sm:text-sm font-black text-theme-text truncate">{item.naslov}</span>
                                                <span className="text-[8px] px-2 py-0.5 rounded-full bg-theme-panel border border-theme-border text-theme-accent font-black uppercase shrink-0">
                                                    {item.grupa}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-theme-muted font-semibold truncate mt-0.5">{item.podnaslov}</p>
                                        </div>
                                    </div>
                                    <ArrowRight size={15} className={`shrink-0 transition-transform ${active ? 'text-theme-accent translate-x-0.5' : 'text-theme-muted/40'}`} />
                                </button>
                            );
                        })
                    )}
                </div>

                <div className="px-5 py-2.5 bg-theme-panel/80 border-t border-theme-border flex items-center justify-between text-[10px] font-bold text-theme-muted">
                    <span>↑↓ navigacija • Enter otvara • Ctrl+K bilo gdje u ERP-u</span>
                    <span>{rezultati.length} rezultata</span>
                </div>
            </div>
        </div>,
        document.body
    );
}
