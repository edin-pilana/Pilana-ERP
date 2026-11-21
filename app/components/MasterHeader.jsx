"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { toast } from 'sonner';
import NotificationDetailModal from './NotificationDetailModal';
import {
    getNazivModula,
    ocistiTekstDetalja,
    daLiJeLicnaNotifikacijaZaKorisnika,
    daLiJeProcitanoZaKorisnika,
    ucitajNotifikacijeZaKorisnika,
    oznaciNotifikacijuProcitanom,
    oznaciNotifikacijeProcitanim,
} from '../utils/notificationHelpers';

export default function MasterHeader({ header, setHeader, onExit, user, hideMasina, modulIme, saas }) {
    const [masine, setMasine] = useState([]);
    const [sviRadnici, setSviRadnici] = useState([]);
    const [aktivniRadnici, setAktivniRadnici] = useState([]);
    const [otvorenTab, setOtvorenTab] = useState(false);
    const [noviRadnik, setNoviRadnik] = useState('');

    // 🔔 State za modul-specifična obavještenja i modal sa kompletnom historijom
    const [brojAlarma, setBrojAlarma] = useState(0);
    const [listaAlarma, setListaAlarma] = useState([]);
    const [otvorenoZvonce, setOtvorenoZvonce] = useState(false);
    const [zvonceTab, setZvonceTab] = useState('AKTIVNA'); // 'AKTIVNA' | 'HISTORIJA'
    const [odabranaNotifikacija, setOdabranaNotifikacija] = useState(null);

    const dropdownRef = useRef(null);

    const currentUser = (() => {
        if (user?.ime_prezime || user?.username) return user;
        try {
            return typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('smart_timber_user') || '{}') : {};
        } catch (e) {
            return {};
        }
    })();
    const isLoggedIn = Boolean(currentUser?.ime_prezime || currentUser?.username);
    const isAdminOrSuper = currentUser?.uloga === 'superadmin' || currentUser?.uloga === 'admin';
    const isStrictSuperadmin = currentUser?.uloga === 'superadmin';
    const nazivModula = getNazivModula(modulIme);

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

    const ucitajAlarme = useCallback(async () => {
        if (!isLoggedIn) return;
        const neprocitane = await ucitajNotifikacijeZaKorisnika(currentUser, modulIme, { includeRead: false, limit: 30 });
        setBrojAlarma(neprocitane.length);
        if (zvonceTab === 'HISTORIJA') {
            const sve = await ucitajNotifikacijeZaKorisnika(currentUser, modulIme, { includeRead: true, limit: 30 });
            setListaAlarma(sve);
        } else {
            setListaAlarma(neprocitane);
        }
    }, [isLoggedIn, currentUser?.ime_prezime, currentUser?.username, currentUser?.uloga, modulIme, zvonceTab]);

    // 🔔 Slušanje promjena za ovaj modul u realnom vremenu (za SVE prijavljene korisnike; globalne toastove prikazuje AppShell)
    useEffect(() => {
        if (!isLoggedIn) return;

        ucitajAlarme();

        const unikatanKanal = `alarmi_modul_${Math.random().toString(36).substring(2)}`;
        const channel = supabase.channel(unikatanKanal)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sistem_audit_log' }, () => {
                ucitajAlarme();
            })
            .subscribe();

        const handleSync = () => ucitajAlarme();
        window.addEventListener('notifikacije_updated', handleSync);

        return () => {
            supabase.removeChannel(channel);
            window.removeEventListener('notifikacije_updated', handleSync);
        };
    }, [isLoggedIn, ucitajAlarme]);

    // Funkcija za brzo označavanje jednog obavještenja kao pročitanog
    const oznaciKaoProcitano = async (alarm, e) => {
        e.stopPropagation();
        const { error } = await oznaciNotifikacijuProcitanom(alarm, currentUser);
        if (error) return toast.error("Greška pri označavanju upozorenja.");
        ucitajAlarme();
    };

    // Funkcija za brzo čitanje svih trenutnih obavještenja u ovom modulu
    const oznaciSveKaoProcitano = async (e) => {
        e.stopPropagation();
        const neprocitani = listaAlarma.filter((a) => !daLiJeProcitanoZaKorisnika(a, currentUser));
        if (neprocitani.length === 0) return;

        const { error } = await oznaciNotifikacijeProcitanim(neprocitani, currentUser);
        if (error) return toast.error("Greška pri označavanju upozorenja.");
        toast.success(`Sva obavještenja za modul ${nazivModula} su označena kao pročitana.`);
        ucitajAlarme();
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
        if (!header?.masina) {
            setAktivniRadnici([]);
            return;
        }
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
        if (!header?.masina) return toast.warning("Prvo odaberite mašinu u zaglavlju!");
        if (!noviRadnik) return;
        if (aktivniRadnici.some(r => r.radnik_ime === noviRadnik)) {
            return toast.info(`Radnik ${noviRadnik} je već prijavljen na ${header.masina}.`);
        }
        const { error } = await supabase.from('aktivni_radnici').insert([{ radnik_ime: noviRadnik, masina_naziv: header.masina, vrijeme_prijave: new Date().toISOString(), uloga: 'pomocni' }]);
        if (error) return toast.error("Greška pri prijavi radnika: " + error.message);
        setNoviRadnik('');
        ucitajAktivne();
        window.dispatchEvent(new Event('radnici_updated'));
    };

    const odjaviRadnika = async (ime) => {
        const { error } = await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('radnik_ime', ime).eq('masina_naziv', header?.masina).is('vrijeme_odjave', null);
        if (error) return toast.error("Greška pri odjavi radnika.");
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
                        <input type="date" value={header.datum || ''} onChange={e => setHeader({ ...header, datum: e.target.value })} className="!p-3 text-xs font-black cursor-pointer w-full sm:w-auto bg-theme-panel border border-theme-border rounded-xl text-theme-text outline-none focus:border-theme-accent" />

                        {!hideMasina && (
                            <>
                                <select
                                    value={header.masina || ''}
                                    onChange={e => { setHeader({ ...header, masina: e.target.value }); localStorage.setItem('last_masina', e.target.value); }}
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

                    {/* 🔔 ZVONCE MODULA (PRIKAZUJE SAMO OBAVJEŠTENJA ZA OVAJ MODUL I OVOG KORISNIKA) */}
                    {isLoggedIn && (
                        <div className="relative" ref={dropdownRef}>
                            <button
                                type="button"
                                data-testid="module-notification-bell"
                                onClick={() => setOtvorenoZvonce(!otvorenoZvonce)}
                                className={`relative w-10 h-10 rounded-xl border flex items-center justify-center text-lg transition-transform shadow-inner cursor-pointer ${otvorenoZvonce ? 'bg-theme-accent text-white border-theme-accent scale-105' : 'bg-theme-panel border-theme-border hover:scale-105'}`}
                                title={`Obavještenja za modul: ${nazivModula}`}
                            >
                                🔔
                                {brojAlarma > 0 && (
                                    <span data-testid="module-bell-badge" className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-theme-card shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-bounce">
                                        {brojAlarma > 99 ? '99+' : brojAlarma}
                                    </span>
                                )}
                            </button>

                            {/* PADAJUĆI MENI — fiksiran unutar viewporta ispod lg (<1024px) da ne prelijeva na 390px i 768px */}
                            {otvorenoZvonce && (
                                <div data-testid="module-bell-dropdown" className="fixed lg:absolute left-3 right-3 lg:left-auto lg:right-0 top-20 lg:top-[120%] lg:w-[26rem] max-w-[calc(100vw-1.5rem)] bg-theme-card border-2 border-theme-border rounded-[1.5rem] shadow-2xl overflow-hidden z-[9999] animate-in slide-in-from-top-2">
                                    <div className="p-4 border-b border-theme-border bg-theme-panel/70 space-y-2.5">
                                        <div className="flex justify-between items-center gap-2">
                                            <div className="min-w-0">
                                                <h4 className="text-xs font-black uppercase text-theme-text flex items-center gap-2 truncate">
                                                    <span>🔔</span> {nazivModula} ({brojAlarma})
                                                </h4>
                                                <p className="text-[9px] text-theme-muted font-bold mt-0.5">
                                                    Samo obavještenja vezana za ovaj modul • Klikni za kompletnu historiju
                                                </p>
                                            </div>
                                            {brojAlarma > 0 && (
                                                <button type="button" onClick={oznaciSveKaoProcitano} className="shrink-0 text-[9px] text-theme-muted hover:text-emerald-500 uppercase font-black transition-colors">
                                                    ✓ Pročitaj sve
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setZvonceTab('AKTIVNA')}
                                                className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-colors ${zvonceTab === 'AKTIVNA' ? 'bg-theme-accent text-white' : 'bg-theme-card text-theme-muted border border-theme-border hover:text-theme-text'}`}
                                            >
                                                Aktivna ({brojAlarma})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setZvonceTab('HISTORIJA')}
                                                className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-colors ${zvonceTab === 'HISTORIJA' ? 'bg-theme-accent text-white' : 'bg-theme-card text-theme-muted border border-theme-border hover:text-theme-text'}`}
                                            >
                                                Historija modula
                                            </button>
                                        </div>
                                    </div>

                                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                                        {listaAlarma.length === 0 ? (
                                            <div className="p-8 text-center text-theme-muted text-[10px] uppercase font-black">
                                                Nema obavještenja za modul {nazivModula}. ✅
                                            </div>
                                        ) : (
                                            <div className="flex flex-col">
                                                {listaAlarma.map(alarm => {
                                                    const jeLicno = daLiJeLicnaNotifikacijaZaKorisnika(alarm, currentUser);
                                                    const jeProcitano = daLiJeProcitanoZaKorisnika(alarm, currentUser);
                                                    const borderTone = alarm.nivo_alarma === 'CRVENO'
                                                        ? 'border-l-red-500'
                                                        : alarm.nivo_alarma === 'ŽUTO'
                                                            ? 'border-l-amber-500'
                                                            : 'border-l-blue-500';
                                                    const dotTone = alarm.nivo_alarma === 'CRVENO'
                                                        ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                                                        : alarm.nivo_alarma === 'ŽUTO'
                                                            ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                                                            : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]';

                                                    return (
                                                        <div
                                                            key={alarm.id}
                                                            role="button"
                                                            tabIndex={0}
                                                            onClick={() => {
                                                                setOdabranaNotifikacija(alarm);
                                                                setOtvorenoZvonce(false);
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' || e.key === ' ') {
                                                                    e.preventDefault();
                                                                    setOdabranaNotifikacija(alarm);
                                                                    setOtvorenoZvonce(false);
                                                                }
                                                            }}
                                                            className={`p-4 border-b border-theme-border/60 transition-colors hover:bg-theme-panel flex gap-3 items-start relative group cursor-pointer border-l-4 ${borderTone} ${jeProcitano ? 'opacity-70' : ''}`}
                                                        >
                                                            <div className={`mt-1 shrink-0 w-2 h-2 rounded-full ${dotTone}`}></div>
                                                            <div className="flex-1 min-w-0 pr-7">
                                                                <div className="flex justify-between items-center gap-2 mb-1">
                                                                    <span className="text-[10px] font-black text-theme-text uppercase truncate">
                                                                        {jeLicno && <span className="text-emerald-400 mr-1">🎯</span>}
                                                                        {alarm.akcija}
                                                                    </span>
                                                                    <span className="text-[9px] text-theme-muted shrink-0">{formatirajVrijeme(alarm.vrijeme || alarm.created_at)}</span>
                                                                </div>
                                                                <p className="text-xs text-theme-muted font-medium leading-snug line-clamp-2">{ocistiTekstDetalja(alarm.detalji)}</p>
                                                                <div className="flex items-center justify-between mt-2">
                                                                    <p className="text-[9px] text-theme-muted font-bold">👤 {alarm.korisnik}</p>
                                                                    <span className="text-[9px] text-theme-accent font-black uppercase group-hover:underline">Historija →</span>
                                                                </div>
                                                            </div>
                                                            {!jeProcitano && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => oznaciKaoProcitano(alarm, e)}
                                                                    className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-md bg-theme-panel border border-theme-border text-theme-muted hover:text-emerald-500 hover:border-emerald-500 transition-all"
                                                                    title="Označi pročitano"
                                                                >
                                                                    ✓
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {isStrictSuperadmin && (
                                        <div className="p-3 bg-theme-panel/70 border-t border-theme-border text-center">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setOtvorenoZvonce(false);
                                                    window.dispatchEvent(new CustomEvent('navigacija_na_nadzor'));
                                                }}
                                                className="text-[10px] text-theme-accent uppercase font-black tracking-widest hover:underline w-full py-1"
                                            >
                                                → Otvori Nadzorni Centar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {odabranaNotifikacija && (
                        <NotificationDetailModal
                            notification={odabranaNotifikacija}
                            user={currentUser}
                            onClose={() => setOdabranaNotifikacija(null)}
                            onActionComplete={ucitajAlarme}
                        />
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
                            {isAdminOrSuper && <span className="text-amber-500 ml-1" title="Admin / Superadmin">★</span>}
                        </span>
                    </div>
                </div>
            </div>

            {/* UPRAVLJANJE RADNICIMA */}
            {otvorenTab && header?.masina && !hideMasina && (
                <div className="bg-theme-panel p-5 rounded-[var(--radius-box)] border border-theme-accent shadow-glow animate-in slide-in-from-top-4 flex flex-col md:flex-row gap-4 items-start md:items-center relative z-40 mt-1 backdrop-blur-[var(--glass-blur)]">
                    <div className="flex-1 flex gap-2 w-full">
                        <select value={noviRadnik} onChange={e => setNoviRadnik(e.target.value)} className="flex-1 !p-3 bg-theme-card border border-theme-border rounded-xl text-theme-text outline-none font-bold">
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