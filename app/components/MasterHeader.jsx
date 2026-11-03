"use client";
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { toast } from 'sonner';

export default function MasterHeader({ header, setHeader, onExit, user, hideMasina, modulIme, saas }) {
    const [masine, setMasine] = useState([]);
    const [sviRadnici, setSviRadnici] = useState([]);
    const [aktivniRadnici, setAktivniRadnici] = useState([]);
    const [otvorenTab, setOtvorenTab] = useState(false);
    const [noviRadnik, setNoviRadnik] = useState('');
    
    // 🔔 State za Nadzorni Centar / Alarme i Mobilne Notifikacije
    const [brojAlarma, setBrojAlarma] = useState(0);
    const [listaAlarma, setListaAlarma] = useState([]);
    const [otvorenoZvonce, setOtvorenoZvonce] = useState(false);
    
    const dropdownRef = useRef(null);

    const currentUser = user?.ime_prezime ? user : JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');
    const isSuperadmin = currentUser?.uloga === 'superadmin' || currentUser?.uloga === 'admin';

    // Zatvaranje dropdowna na klik izvan njega
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setOtvorenoZvonce(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // 🔔 Efekat za slušanje alarma u realnom vremenu (Za Admina i Superadmina + Mobilne Notifikacije)
    useEffect(() => {
        if (!isSuperadmin) return;

        const ucitajAlarme = async () => {
            const { data, count } = await supabase
                .from('sistem_audit_log')
                .select('*', { count: 'exact' })
                .eq('pregledano', false)
                .in('nivo_alarma', ['CRVENO', 'ŽUTO'])
                .order('vrijeme', { ascending: false })
                .limit(15);
            
            setListaAlarma(data || []);
            setBrojAlarma(count || 0);
        };

        ucitajAlarme();

        const unikatanKanal = `alarmi_sync_header_${Math.random().toString(36).substring(2)}`;

        const channel = supabase.channel(unikatanKanal)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sistem_audit_log' }, (payload) => {
                ucitajAlarme();
                const novi = payload?.new;
                if (novi && (novi.nivo_alarma === 'CRVENO' || novi.nivo_alarma === 'ŽUTO')) {
                    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
                        window.navigator.vibrate([200, 100, 200]);
                    }
                    if (novi.nivo_alarma === 'CRVENO') {
                        toast.error(`🚨 ${novi.akcija}: ${novi.detalji}`, { duration: 8000 });
                    } else {
                        toast.warning(`⚠️ ${novi.akcija}: ${novi.detalji}`, { duration: 6000 });
                    }
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sistem_audit_log' }, () => {
                ucitajAlarme(); 
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [isSuperadmin]);

    // Funkcija za brzo označavanje jednog alarma kao pročitanog
    const oznaciKaoProcitano = async (id, e) => {
        e.stopPropagation();
        await supabase.from('sistem_audit_log').update({ pregledano: true }).eq('id', id);
    };

    // Funkcija za brzo zatvaranje/čitanje svih trenutnih alarma u padajućem meniju
    const oznaciSveKaoProcitano = async (e) => {
        e.stopPropagation();
        const ids = listaAlarma.map(a => a.id);
        if (ids.length === 0) return;
        
        await supabase.from('sistem_audit_log').update({ pregledano: true }).in('id', ids);
        toast.success("Sva upozorenja su označena kao pročitana.");
    };

    useEffect(() => {
        const fetchMasine = async () => {
            const { data } = await supabase.from('masine').select('naziv, dozvoljeni_moduli').order('naziv');
            if (data) {
                const filtrirane = data.filter(m => {
                    if (!modulIme) return true; 
                    if (!m.dozvoljeni_moduli) return true; 
                    return m.dozvoljeni_moduli.toLowerCase().includes(modulIme.toLowerCase());
                });
                setMasine(filtrirane.map(m => m.naziv));
            }
        };

        const fetchRadnici = async () => {
            const { data } = await supabase.from('radnici').select('ime_prezime').order('ime_prezime');
            setSviRadnici(data ? data.map(r => r.ime_prezime) : []);
        };

        fetchMasine();
        fetchRadnici();
    }, [modulIme]); 

    const ucitajAktivne = async () => {
        if (!header?.masina) return;
        const { data } = await supabase.from('aktivni_radnici').select('*').eq('masina_naziv', header.masina).is('vrijeme_odjave', null);
        setAktivniRadnici(data || []);
    };

    useEffect(() => { ucitajAktivne(); }, [header?.masina]);

    useEffect(() => {
        const handleRefresh = () => ucitajAktivne();
        window.addEventListener('radnici_updated', handleRefresh);
        return () => window.removeEventListener('radnici_updated', handleRefresh);
    }, [header?.masina]);

    const dodajRadnika = async () => {
        if(!header?.masina) return toast.warning("Prvo odaberite mašinu u zaglavlju!");
        if(!noviRadnik) return;
        await supabase.from('aktivni_radnici').insert([{ radnik_ime: noviRadnik, masina_naziv: header.masina, vrijeme_prijave: new Date().toISOString(), uloga: 'pomocni' }]);
        setNoviRadnik('');
        ucitajAktivne();
        window.dispatchEvent(new Event('radnici_updated')); 
    };

    const odjaviRadnika = async (ime) => {
        await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('radnik_ime', ime).eq('masina_naziv', header?.masina).is('vrijeme_odjave', null);
        ucitajAktivne();
        window.dispatchEvent(new Event('radnici_updated'));
    };

    // Pomoćna funkcija za formatiranje datuma alarma
    const formatirajVrijeme = (isoString) => {
        if (!isoString) return '';
        const datum = new Date(isoString);
        return datum.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex flex-col gap-3 w-full mb-6">
            <div className={`flex flex-wrap lg:flex-nowrap justify-between items-center bg-theme-card p-3 lg:p-4 rounded-[var(--radius-box)] border border-theme-border shadow-glow backdrop-blur-[var(--glass-blur)] gap-4 relative z-[100] ${saas?.isEditMode ? 'ring-2 ring-amber-500' : ''}`}>
                
                {/* LIJEVA STRANA: Izlaz, Modul i Live indikator */}
                <div className="flex items-center gap-3">
                    <button onClick={onExit} className="bg-theme-panel border border-theme-border text-[10px] px-4 py-3 rounded-xl uppercase text-theme-text font-black hover:bg-red-500 hover:text-white hover:border-red-500 transition-all shadow-md">← Meni</button>
                    {modulIme && (
                        <div className="flex items-center gap-3 bg-theme-panel/50 px-3 py-1.5 rounded-lg border border-theme-border/50">
                            <span className="text-theme-accent font-black tracking-widest uppercase text-xs hidden sm:block">Modul: {modulIme}</span>
                            {/* GLOBALNA LIVE LAMPICA */}
                            <div className="flex items-center gap-1.5 ml-2 border-l border-theme-border/50 pl-3" title="Sistem je uživo povezan sa bazom">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                </span>
                                <span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest hidden md:block">Live</span>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* SREDINA: Datum, Mašine i Radnici */}
                {header && (
                    <div className="flex flex-wrap items-center justify-center gap-2 lg:gap-3 flex-1 lg:flex-none">
                        <input type="date" value={header.datum || ''} onChange={e => setHeader({...header, datum: e.target.value})} className="!p-3 text-xs font-black cursor-pointer w-full sm:w-auto bg-theme-panel border border-theme-border rounded-xl text-theme-text outline-none focus:border-theme-accent" />
                        
                        {!hideMasina && (
                            <>
                                <select 
                                    value={header.masina || ''} 
                                    onChange={e => { setHeader({...header, masina: e.target.value}); localStorage.setItem('last_masina', e.target.value); }} 
                                    className={`!p-3 text-xs cursor-pointer font-black uppercase tracking-wider w-full sm:w-auto min-w-[160px] bg-theme-panel border border-theme-border rounded-xl text-theme-text outline-none focus:border-theme-accent ${!header.masina ? '!bg-red-900/30 !border-red-500 !text-red-400 animate-pulse' : ''}`}
                                >
                                    <option value="">Odaberi mašinu...</option>
                                    {masine.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>

                                {header.masina && (
                                    <button onClick={() => setOtvorenTab(!otvorenTab)} className="w-full sm:w-auto min-w-[140px] !p-3 bg-theme-panel border border-theme-accent text-theme-accent text-xs uppercase font-black rounded-xl hover:bg-theme-accent hover:text-white transition-all shadow-lg flex items-center justify-center gap-2">
                                        👷 RADNICI ({aktivniRadnici.length})
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* DESNA STRANA: God Mode, Zvonce i Korisnik */}
                <div className="flex flex-wrap items-center gap-3 justify-center lg:justify-end w-full lg:w-auto">
                    
                    {/* 🔔 ZVONCE ZA NADZORNI CENTAR (PADAJUĆI MENI NA DESKTOPU I MOBITELU) */}
                    {isSuperadmin && (
                        <div className="relative" ref={dropdownRef}>
                            <button 
                                onClick={() => setOtvorenoZvonce(!otvorenoZvonce)} 
                                className={`relative w-10 h-10 rounded-xl border flex items-center justify-center text-lg transition-transform shadow-inner cursor-pointer ${otvorenoZvonce ? 'bg-theme-accent text-white border-theme-accent scale-105' : 'bg-theme-panel border-theme-border hover:scale-105'}`}
                                title="Otvori upozorenja i zahtjeve za odobrenje"
                            >
                                🔔
                                {brojAlarma > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-theme-card shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-bounce">
                                        {brojAlarma > 99 ? '99+' : brojAlarma}
                                    </span>
                                )}
                            </button>

                            {/* PADAJUĆI MENI */}
                            {otvorenoZvonce && (
                                <div className="fixed sm:absolute top-20 sm:top-[120%] right-4 sm:right-0 w-[92vw] sm:w-96 bg-theme-card border-2 border-theme-border rounded-[1.5rem] shadow-2xl overflow-hidden z-[9999] animate-in slide-in-from-top-2">
                                    <div className="flex justify-between items-center p-4 border-b border-theme-border bg-theme-panel/50">
                                        <h4 className="text-xs font-black uppercase text-theme-text flex items-center gap-2">
                                            <span>🚨</span> Upozorenja ({brojAlarma})
                                        </h4>
                                        {listaAlarma.length > 0 && (
                                            <button onClick={oznaciSveKaoProcitano} className="text-[9px] text-theme-muted hover:text-emerald-400 uppercase font-black transition-colors">
                                                ✓ Pročitaj sve
                                            </button>
                                        )}
                                    </div>
                                    
                                    <div className="max-h-72 overflow-y-auto custom-scrollbar">
                                        {listaAlarma.length === 0 ? (
                                            <div className="p-8 text-center text-slate-500 text-[10px] uppercase font-black">
                                                Nema novih upozorenja. Sve je čisto! ✅
                                            </div>
                                        ) : (
                                            <div className="flex flex-col">
                                                {listaAlarma.map(alarm => (
                                                    <div key={alarm.id} className={`p-4 border-b border-theme-border/50 transition-colors hover:bg-slate-800/50 flex gap-3 items-start relative group ${alarm.nivo_alarma === 'CRVENO' ? 'bg-red-950/10' : 'bg-amber-950/10'}`}>
                                                        <div className={`mt-1 shrink-0 w-2 h-2 rounded-full ${alarm.nivo_alarma === 'CRVENO' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'}`}></div>
                                                        <div className="flex-1 min-w-0 pr-6">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-[10px] font-black text-theme-text uppercase">{alarm.akcija}</span>
                                                                <span className="text-[9px] text-slate-500">{formatirajVrijeme(alarm.vrijeme || alarm.created_at)}</span>
                                                            </div>
                                                            <p className="text-xs text-slate-400 font-medium leading-snug">{alarm.detalji}</p>
                                                            <p className="text-[9px] text-slate-500 mt-2 font-bold">👤 {alarm.korisnik}</p>
                                                        </div>
                                                        <button 
                                                            onClick={(e) => oznaciKaoProcitano(alarm.id, e)} 
                                                            className="absolute top-1/2 -translate-y-1/2 right-3 w-7 h-7 flex items-center justify-center rounded-md bg-theme-panel border border-theme-border text-slate-400 hover:text-emerald-400 hover:border-emerald-500 transition-all"
                                                            title="Označi pročitano"
                                                        >
                                                            ✓
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="p-3 bg-theme-panel/50 border-t border-theme-border text-center">
                                        <button 
                                            onClick={() => { 
                                                setOtvorenoZvonce(false); 
                                                window.dispatchEvent(new CustomEvent('navigacija_na_nadzor'));
                                            }} 
                                            className="text-[10px] text-theme-accent uppercase font-black tracking-widest hover:underline w-full py-1"
                                        >
                                            → Otvori Nadzorni Centar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {(currentUser?.uloga === 'superadmin' || currentUser?.uloga === 'admin') && saas && (
                        <div className="flex gap-2">
                            {saas.isEditMode ? (
                                <>
                                    <button onClick={saas.odustani} className="px-3 py-3 bg-red-900/40 text-red-400 border border-red-500/50 rounded-xl text-[9px] font-black uppercase hover:bg-red-500 hover:text-white transition-all">✕ Odustani</button>
                                    <button onClick={saas.spasiDizajn} className="px-3 py-3 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-emerald-500 transition-all">💾 Spasi</button>
                                </>
                            ) : (
                                <button onClick={saas.pokreniEdit} className="px-3 py-3 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded-xl text-[9px] font-black uppercase hover:bg-amber-500 hover:text-white transition-all">✏️ Uredi Dizajn</button>
                            )}
                        </div>
                    )}

                    <div className="bg-theme-panel px-4 py-2 rounded-xl border border-theme-border flex flex-col items-end shadow-inner w-full sm:w-auto">
                        <span className="text-[9px] text-theme-muted uppercase font-black">Prijavljen:</span>
                        <span className="text-xs text-theme-text font-bold whitespace-nowrap">
                            {currentUser?.ime_prezime || 'Korisnik'}
                            {isSuperadmin && <span className="text-amber-500 ml-1" title="Admin / Superadmin">★</span>}
                        </span>
                    </div>
                </div>
            </div>

            {/* UPRAVLJANJE RADNICIMA */}
            {otvorenTab && header?.masina && !hideMasina && (
                <div className="bg-theme-panel p-5 rounded-[var(--radius-box)] border border-theme-accent shadow-glow animate-in slide-in-from-top-4 flex flex-col md:flex-row gap-4 items-start md:items-center relative z-40 mt-1 backdrop-blur-[var(--glass-blur)]">
                    <div className="flex-1 flex gap-2 w-full">
                        <select value={noviRadnik} onChange={e=>setNoviRadnik(e.target.value)} className="flex-1 !p-3 bg-theme-card border border-theme-border rounded-xl text-theme-text outline-none font-bold">
                            <option value="">Odaberi dodatnog radnika iz baze...</option>
                            {sviRadnici.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button onClick={dodajRadnika} className="bg-theme-accent px-6 py-3 rounded-xl text-white font-black text-[10px] uppercase hover:opacity-80 shadow-lg transition-all border border-theme-accent">➕ Dodaj</button>
                    </div>
                    <div className="flex flex-wrap gap-2 flex-1 w-full items-center mt-2 md:mt-0">
                        <span className="text-[10px] text-theme-muted uppercase font-black mr-2">Trenutno na mašini:</span>
                        {aktivniRadnici.length === 0 && <span className="text-xs text-theme-muted italic">Niko nije prijavljen...</span>}
                        {aktivniRadnici.map(r => (
                            <div key={r.id} className="bg-theme-panel border border-theme-accent text-theme-accent px-3 py-2 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 shadow-md">
                                {r.radnik_ime} <span className="opacity-50 lowercase ml-1">({r.uloga})</span> 
                                <button onClick={() => odjaviRadnika(r.radnik_ime)} className="hover:text-red-400 text-red-500 ml-2 text-xs transition-all font-black">✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}