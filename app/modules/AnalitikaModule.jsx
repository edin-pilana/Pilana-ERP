"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Flex } from '@tremor/react';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { useSaaS } from '../utils/useSaaS';

// IMPORTUJEMO NAŠ NOVI TAB ZA PROREZ
import TabProrezAnalitika from '../components/TabProrezAnalitika';
import TabDoradaAnalitika from '../components/TabDoradaAnalitika';
import TabFinansijeAnalitika from '../components/TabFinansijeAnalitika';
import TabAiAnalitika from '../components/TabAiAnalitika';
import TabUkupnoAnalitika from '../components/TabUkupnoAnalitika';

const supabase = createClient('https://awaxwejrhmjeqohrgidm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY');

export default function AnalitikaModule({ user, header, setHeader, onExit }) {
    
    const saas = useSaaS('analitika_glavna', {
        boja_pozadine: '#090e17',
        boja_kartice: '#1e293b',
        boja_akcenta: '#10b981'
    });

    const danasnjiDatum = new Date().toISOString().split('T')[0];
    const [activeTab, setActiveTab] = useState('prorez'); 
    
    const [tipDatuma, setTipDatuma] = useState('dan'); 
    const [datumOd, setDatumOd] = useState(danasnjiDatum);
    const [datumDo, setDatumDo] = useState(danasnjiDatum);
    const [isPeriodic, setIsPeriodic] = useState(false);
    
    const [masinaFilter, setMasinaFilter] = useState('SVE');
    const [sveMasineIzBaze, setSveMasineIzBaze] = useState([]);

    // 1. Povlačimo SVE mašine iz baze i njihove dozvole
    useEffect(() => {
        supabase.from('masine').select('naziv, dozvoljeni_moduli').then(({data}) => {
            if(data) setSveMasineIzBaze(data);
        });
    }, []);

    // 2. Pametni filter - prikazuje samo mašine zavisno od taba!
    const dostupneMasine = useMemo(() => {
        const filtrirane = sveMasineIzBaze.filter(m => {
            if (!m.dozvoljeni_moduli) return true; // Ako nije podešeno, daj ga svuda
            const dozvole = m.dozvoljeni_moduli.toLowerCase();
            
            // Logika: Na tabu prorez prikazuj mašine za pilanu/prorez, na doradi za doradu
            if (activeTab === 'prorez') return dozvole.includes('pilana') || dozvole.includes('prorez');
            if (activeTab === 'dorada') return dozvole.includes('dorada');
            return true;
        });

        // Osigurač: Ako promijenimo tab i trenutno odabrana mašina nije na listi novog taba, vrati na SVE MAŠINE
        const nazivi = filtrirane.map(m => m.naziv);
        if (masinaFilter !== 'SVE' && !nazivi.includes(masinaFilter)) {
            setMasinaFilter('SVE');
        }

        return nazivi;
    }, [activeTab, sveMasineIzBaze]);

    const setBrziDatum = (tip) => {
        const danas = new Date();
        setTipDatuma('period'); setIsPeriodic(true);
        if (tip === '7d') { setDatumOd(new Date(danas.getTime() - 6*24*60*60*1000).toISOString().split('T')[0]); setDatumDo(danasnjiDatum); } 
        else if (tip === 'mjesec') { setDatumOd(new Date(danas.getFullYear(), danas.getMonth(), 1).toISOString().split('T')[0]); setDatumDo(new Date(danas.getFullYear(), danas.getMonth() + 1, 0).toISOString().split('T')[0]); } 
        else if (tip === 'prosli_mjesec') { setDatumOd(new Date(danas.getFullYear(), danas.getMonth() - 1, 1).toISOString().split('T')[0]); setDatumDo(new Date(danas.getFullYear(), danas.getMonth(), 0).toISOString().split('T')[0]); }
    };

    const shiftDate = (n) => { const d = new Date(datumOd); d.setDate(d.getDate()+n); const iso = d.toISOString().split('T')[0]; setDatumOd(iso); setDatumDo(iso); };

    return (
        <div className="min-h-screen p-4 md:p-8 pb-24 font-sans transition-colors duration-500" style={{ backgroundColor: saas.ui.boja_pozadine }}>
            
            {/* 1. GLOBALNI HEADER (Navigacija, Datumi, Filteri) */}
<div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row justify-between items-center p-4 rounded-2xl shadow-xl mb-6 gap-4 border print:hidden" style={{ backgroundColor: saas.ui.boja_kartice, borderColor: '#1e293b' }}>
                
                <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 w-full lg:w-auto overflow-x-auto">
                    <div className="flex items-center gap-4">
                        <button onClick={onExit} className="bg-theme-panel text-slate-400 hover:bg-red-500 hover:text-theme-text px-4 h-10 rounded-xl text-[10px] font-black uppercase transition-all shadow-md shrink-0">← Meni</button>
                    </div>
                    
                    <nav className="flex gap-2 bg-black/20 p-1.5 rounded-xl border border-white/5 overflow-x-auto whitespace-nowrap shadow-inner">
                        {['prorez', 'dorada', 'ukupno', 'finansije', 'ai kontrolor'].map(t => (
                            <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase transition-all ${activeTab === t ? 'text-theme-text shadow-lg' : 'text-slate-500 hover:text-theme-text hover:bg-white/5'}`} style={{ backgroundColor: activeTab === t ? saas.ui.boja_akcenta : 'transparent' }}>
                                {t}
                            </button>
                        ))}
                    </nav>
                </div>
                
                <div className="flex flex-col md:flex-row items-center gap-4 w-full lg:w-auto justify-end">
                    
                    {/* PAMETNI FILTER MAŠINA */}
                    {(activeTab === 'prorez' || activeTab === 'dorada') && (
                       <select value={masinaFilter} onChange={e => setMasinaFilter(e.target.value)} className="bg-black/20 text-slate-300 p-2 h-10 rounded-xl text-xs font-bold border border-white/5 outline-none focus:border-emerald-500 shadow-inner uppercase tracking-widest [&>option]:bg-theme-card [&>option]:text-theme-text">
                       <option value="SVE">SVE MAŠINE</option>
                       {dostupneMasine.map(m => <option key={m} value={m}>{m}</option>)}
                   </select>
                    )}

                    <Flex className="bg-black/20 p-1.5 rounded-xl border border-white/5 gap-1 shadow-inner w-full md:w-auto">
                        <button onClick={() => { setTipDatuma('dan'); setIsPeriodic(false); setDatumDo(datumOd); }} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${!isPeriodic?'bg-slate-700 text-theme-text':'text-slate-500 hover:text-theme-text'}`}>Dan</button>
                        <button onClick={() => { setTipDatuma('period'); setIsPeriodic(true); }} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${isPeriodic?'bg-slate-700 text-theme-text':'text-slate-500 hover:text-theme-text'}`}>Period</button>
                    </Flex>
        
                    <Flex className="bg-black/20 p-1.5 rounded-xl border border-white/5 gap-2 shadow-inner w-full md:w-auto flex-wrap">
                        {!isPeriodic ? (
                            <>
                                <button onClick={()=>shiftDate(-1)} className="w-8 h-8 bg-theme-panel rounded hover:bg-slate-600 font-black text-theme-text flex items-center justify-center transition-all"><ChevronLeft size={16}/></button>
                                <div className="flex items-center justify-center bg-theme-card px-3 py-1.5 rounded border border-theme-border h-8">
                                    <input type="date" value={datumOd} onChange={e=>{setDatumOd(e.target.value); setDatumDo(e.target.value);}} className="bg-transparent text-slate-300 font-bold text-sm tracking-widest outline-none cursor-pointer uppercase [&::-webkit-calendar-picker-indicator]:invert" />
                                </div>
                                <button onClick={()=>shiftDate(1)} className="w-8 h-8 bg-theme-panel rounded hover:bg-slate-600 font-black text-theme-text flex items-center justify-center transition-all"><ChevronRight size={16}/></button>
                            </>
                        ) : (
                            <>
                                <input type="date" value={datumOd} onChange={e=>setDatumOd(e.target.value)} className="bg-theme-card border border-theme-border text-slate-300 font-bold text-xs p-1.5 rounded h-8 outline-none [&::-webkit-calendar-picker-indicator]:invert" />
                                <span className="text-slate-600 font-black">-</span>
                                <input type="date" value={datumDo} onChange={e=>setDatumDo(e.target.value)} className="bg-theme-card border border-theme-border text-slate-300 font-bold text-xs p-1.5 rounded h-8 outline-none [&::-webkit-calendar-picker-indicator]:invert" />
                                <div className="flex gap-1 ml-2 border-l border-theme-border pl-2">
                                    <button onClick={()=>setBrziDatum('7d')} className="px-2 py-1.5 bg-theme-panel hover:bg-theme-accent hover:text-theme-text rounded text-[9px] font-black uppercase text-slate-300 transition-colors">7 Dana</button>
                                    <button onClick={()=>setBrziDatum('mjesec')} className="px-2 py-1.5 bg-theme-panel hover:bg-theme-accent hover:text-theme-text rounded text-[9px] font-black uppercase text-slate-300 transition-colors">Ovaj Mj</button>
                                </div>
                            </>
                        )}
                    </Flex>

                    {user?.uloga === 'superadmin' && (
                        <button onClick={saas.pokreniEdit} className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded-xl text-[9px] font-black uppercase hover:bg-amber-500 hover:text-theme-text transition-all">
                            <Settings size={14} /> UI
                        </button>
                    )}
                </div>
            </div>

            {/* SAAS EDITOR OVERLAY (GLOBALNE BOJE) */}
            {saas.isEditMode && (
                <div className="max-w-[1600px] mx-auto mb-6 bg-amber-900/20 p-6 rounded-box flex flex-wrap gap-4 items-center justify-between border-2 border-amber-500/50 shadow-2xl">
                    <div>
                        <h2 className="text-amber-500 font-black uppercase text-lg tracking-widest">SaaS Boje Analitike</h2>
                        <p className="text-amber-200/70 text-xs mt-1 font-bold">Podesite globalne boje menija i kartica.</p>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <label className="text-[10px] text-amber-500 uppercase font-black flex items-center gap-2">Pozadina: <input type="color" value={saas.ui.boja_pozadine} onChange={e => saas.setUi({...saas.ui, boja_pozadine: e.target.value})} className="w-8 h-8 rounded cursor-pointer border-none bg-transparent" /></label>
                        <label className="text-[10px] text-amber-500 uppercase font-black flex items-center gap-2">Boja Akcenta: <input type="color" value={saas.ui.boja_akcenta} onChange={e => saas.setUi({...saas.ui, boja_akcenta: e.target.value})} className="w-8 h-8 rounded cursor-pointer border-none bg-transparent" /></label>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={saas.odustani} className="px-6 py-3 bg-red-900/40 text-red-400 border border-red-500/50 rounded-xl text-[9px] font-black uppercase hover:bg-red-500 hover:text-theme-text transition-all shadow-md">✕ Odustani</button>
                        <button onClick={saas.spasiDizajn} className="px-6 py-3 bg-emerald-600 text-theme-text rounded-xl text-[9px] font-black uppercase shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:bg-emerald-500 transition-all">💾 Spasi Dizajn</button>
                    </div>
                </div>
            )}

            {/* 2. SADRŽAJ TABOVA */}
                     <div className="max-w-[1600px] mx-auto">
                {activeTab === 'prorez' && (
                <TabProrezAnalitika datumOd={datumOd} datumDo={datumDo} masinaFilter={masinaFilter} saas={saas} header={header} />
                 )}
                {activeTab === 'dorada' && (
                <TabDoradaAnalitika datumOd={datumOd} datumDo={datumDo} masinaFilter={masinaFilter} saas={saas} header={header} />
                 )}
                {activeTab === 'ukupno' && (
                <TabUkupnoAnalitika datumOd={datumOd} datumDo={datumDo} saas={saas} header={header} />
                )}
                {activeTab === 'finansije' && (
                <TabFinansijeAnalitika datumOd={datumOd} datumDo={datumDo} saas={saas} header={header} />
                )}
                {activeTab === 'ai kontrolor' && (
                <TabAiAnalitika saas={saas} />
                )}
            </div>

        </div>
    );
}