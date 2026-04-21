"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function MasterHeader({ header, setHeader, onExit, color, user, hideMasina, modulIme, saas }) {
    const [masine, setMasine] = useState([]);
    const [sviRadnici, setSviRadnici] = useState([]);
    const [aktivniRadnici, setAktivniRadnici] = useState([]);
    const [otvorenTab, setOtvorenTab] = useState(false);
    const [noviRadnik, setNoviRadnik] = useState('');

    // PAMETNI OSIGURAČ ZA IME RADNIKA: Ako user prop nije proslijeđen, vučemo iz memorije!
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

    useEffect(() => {
        if (header?.masina) ucitajAktivne();
    }, [header?.masina]);

    const ucitajAktivne = async () => {
        const { data } = await supabase.from('aktivni_radnici').select('*').eq('masina_naziv', header?.masina).is('vrijeme_odjave', null);
        setAktivniRadnici(data || []);
    };

    const dodajRadnika = async () => {
        if(!header?.masina) return alert("Odaberi mašinu prvo!");
        if(!noviRadnik) return;
        await supabase.from('aktivni_radnici').insert([{ radnik_ime: noviRadnik, masina_naziv: header.masina, vrijeme_prijave: new Date().toISOString() }]);
        setNoviRadnik('');
        ucitajAktivne();
    };

    const odjaviRadnika = async (ime) => {
        await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('radnik_ime', ime).eq('masina_naziv', header?.masina).is('vrijeme_odjave', null);
        ucitajAktivne();
    };

    return (
        <div className="flex flex-col gap-3 w-full">
            <div className={`flex flex-col md:flex-row justify-between items-center bg-[#1e293b] p-4 rounded-3xl border border-slate-700 shadow-lg gap-4 relative z-50 ${saas?.isEditMode ? 'ring-2 ring-amber-500' : ''}`}>
                <div className="flex items-center gap-3">
                    <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase text-white font-black hover:bg-red-500 transition-all shadow-md">← Meni</button>
                    {modulIme && <span className={`${color} font-black tracking-widest uppercase text-xs hidden md:inline-block`}>Modul: {modulIme}</span>}
                </div>
                
                {header && (
                    <div className="flex items-center gap-3">
                        <input type="date" value={header.datum || ''} onChange={e => setHeader({...header, datum: e.target.value})} className="bg-slate-900 text-xs text-white p-4 rounded-xl border border-slate-700 outline-none shadow-inner font-black" />
                        
                        {!hideMasina && (
                            <>
                                <select 
                                    value={header.masina || ''} 
                                    onChange={e => { setHeader({...header, masina: e.target.value}); localStorage.setItem('last_masina', e.target.value); }} 
                                    className={`text-xs text-white p-4 rounded-xl border outline-none w-40 md:w-48 transition-all cursor-pointer font-black uppercase tracking-wider ${!header.masina ? 'bg-red-900/30 border-red-500 text-red-400 shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-pulse' : 'bg-slate-900 border-slate-700 shadow-inner'}`}
                                >
                                    <option value="">Odaberi mašinu...</option>
                                    {masine.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>

                                {header.masina && (
                                    <button onClick={() => setOtvorenTab(!otvorenTab)} className="min-w-[160px] px-6 py-4 bg-blue-900/40 border-2 border-blue-500 text-blue-300 text-xs uppercase font-black rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-lg flex items-center justify-center gap-2">
                                        👷 RADNICI ({aktivniRadnici.length})
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-3">
                    {/* SUPERADMIN SaaS KONTROLE */}
                    {currentUser?.uloga === 'superadmin' && saas && (
                        saas.isEditMode ? (
                            <div className="flex gap-2">
                                <button onClick={saas.odustani} className="px-3 py-2 bg-red-900/40 text-red-400 border border-red-500/50 rounded-xl text-[9px] font-black uppercase hover:bg-red-500 hover:text-white transition-all shadow-md">✕ Odustani</button>
                                <button onClick={saas.spasiDizajn} className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:bg-emerald-500 transition-all">💾 Spasi Dizajn</button>
                            </div>
                        ) : (
                            <button onClick={saas.pokreniEdit} className="px-3 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded-xl text-[9px] font-black uppercase hover:bg-amber-500 hover:text-white transition-all shadow-md">✏️ Uredi Modul</button>
                        )
                    )}

                    <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-700 flex flex-col items-end shadow-inner">
                        <span className="text-[9px] text-slate-500 uppercase font-black">Prijavljeni radnik</span>
                        <span className="text-xs text-white font-bold">{currentUser?.ime_prezime || 'Nepoznat'}</span>
                    </div>
                </div>
            </div>

            {/* SADRŽAJ TABA ZA RADNIKE */}
            {otvorenTab && header?.masina && !hideMasina && (
                <div className="bg-slate-900 p-5 rounded-[2rem] border border-blue-500/50 shadow-2xl animate-in slide-in-from-top-4 flex flex-col md:flex-row gap-4 items-start md:items-center relative z-40 mx-4 md:mx-8 -mt-6 pt-10">
                    <div className="flex-1 flex gap-2 w-full">
                        <select value={noviRadnik} onChange={e=>setNoviRadnik(e.target.value)} className="flex-1 px-4 py-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none uppercase font-bold cursor-pointer shadow-inner">
                            <option value="">Odaberi iz baze radnika...</option>
                            {sviRadnici.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button onClick={dodajRadnika} className="bg-blue-600 px-6 py-3 rounded-xl text-white font-black text-[10px] uppercase hover:bg-blue-500 shadow-lg transition-all">➕ Dodaj</button>
                    </div>
                    <div className="flex flex-wrap gap-2 flex-1 w-full items-center">
                        <span className="text-[10px] text-slate-400 uppercase font-black mr-2">Trenutno na mašini:</span>
                        {aktivniRadnici.length === 0 && <span className="text-xs text-slate-500 italic">Niko nije prijavljen...</span>}
                        {aktivniRadnici.map(r => (
                            <div key={r.id} className="bg-blue-900/40 border border-blue-500 text-blue-300 px-3 py-2 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 shadow-md">
                                {r.radnik_ime} <button onClick={() => odjaviRadnika(r.radnik_ime)} className="hover:text-red-400 text-red-500 ml-2 text-xs transition-all">✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}