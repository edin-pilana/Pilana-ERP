"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function MasterHeader({ header, setHeader, onExit, user, hideMasina, modulIme, saas }) {
    const [masine, setMasine] = useState([]);
    const [sviRadnici, setSviRadnici] = useState([]);
    const [aktivniRadnici, setAktivniRadnici] = useState([]);
    const [otvorenTab, setOtvorenTab] = useState(false);
    const [noviRadnik, setNoviRadnik] = useState('');

    const currentUser = user?.ime_prezime ? user : JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');

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

    // Učitaj pri prvom renderu i kad se promijeni mašina
    useEffect(() => { ucitajAktivne(); }, [header?.masina]);

    // OVO JE TAJNA MAGIJA ZA SINHRONIZACIJU: Sluša signale iz svih modula
    useEffect(() => {
        const handleRefresh = () => ucitajAktivne();
        window.addEventListener('radnici_updated', handleRefresh);
        return () => window.removeEventListener('radnici_updated', handleRefresh);
    }, [header?.masina]);

    const dodajRadnika = async () => {
        if(!header?.masina) return alert("Odaberi mašinu prvo!");
        if(!noviRadnik) return;
        await supabase.from('aktivni_radnici').insert([{ radnik_ime: noviRadnik, masina_naziv: header.masina, vrijeme_prijave: new Date().toISOString(), uloga: 'pomocni' }]);
        setNoviRadnik('');
        ucitajAktivne();
        window.dispatchEvent(new Event('radnici_updated')); // Obavijesti sve da je radnik dodan
    };

    const odjaviRadnika = async (ime) => {
        await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('radnik_ime', ime).eq('masina_naziv', header?.masina).is('vrijeme_odjave', null);
        ucitajAktivne();
        window.dispatchEvent(new Event('radnici_updated'));
    };

    return (
        <div className="flex flex-col gap-3 w-full mb-6">
            <div className={`flex flex-wrap lg:flex-nowrap justify-between items-center bg-theme-card p-3 lg:p-4 rounded-[var(--radius-box)] border border-theme-border shadow-glow backdrop-blur-[var(--glass-blur)] gap-4 relative z-[100] ${saas?.isEditMode ? 'ring-2 ring-amber-500' : ''}`}>
                <div className="flex items-center gap-3">
                    <button onClick={onExit} className="bg-theme-panel border border-theme-border text-[10px] px-4 py-3 rounded-xl uppercase text-theme-text font-black hover:bg-red-500 hover:border-red-500 transition-all shadow-md">← Meni</button>
                    {modulIme && <span className="text-theme-accent font-black tracking-widest uppercase text-xs whitespace-nowrap hidden sm:block">Modul: {modulIme}</span>}
                </div>
                
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

                <div className="flex flex-wrap items-center gap-3 justify-center lg:justify-end w-full lg:w-auto">
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
                        <span className="text-xs text-theme-text font-bold whitespace-nowrap">{currentUser?.ime_prezime || 'Korisnik'}</span>
                    </div>
                </div>
            </div>

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