"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function NadzorModule({ user, header, setHeader, onExit }) {
    const [logovi, setLogovi] = useState([]);
    const [filter, setFilter] = useState('AKTIVNI'); // 'AKTIVNI' ili 'ARHIVA'

    useEffect(() => {
        ucitajLogove();
        
        // 🟢 100% unikatan ID za Supabase kanal
        const unikatanKanal = `nadzor_sync_${Math.random().toString(36).substring(2)}`;
        
        const channel = supabase.channel(unikatanKanal)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sistem_audit_log' }, () => {
                ucitajLogove();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [filter]);

    const ucitajLogove = async () => {
        let query = supabase.from('sistem_audit_log').select('*');
        
        // Ako smo na tabu aktivnih, prikazujemo samo nepročitane crvene i žute
        if (filter === 'AKTIVNI') {
            query = query.in('nivo_alarma', ['CRVENO', 'ŽUTO']).eq('pregledano', false);
        } else {
            // U arhivi prikazujemo sve, ali limitiramo da ne ugušimo app
            query = query.order('vrijeme', { ascending: false }).limit(200); // 🟢 POPRAVLJENO: vrijeme umjesto created_at
        }
        
        const { data, error } = await query.order('vrijeme', { ascending: false }); // 🟢 POPRAVLJENO: vrijeme umjesto created_at
        
        // 🟢 POPRAVLJENO: Ako ima greške ili nema podataka, postavi prazan niz da se spriječi rušenje (bijeli ekran)
        if (error) {
            console.error("Supabase greška:", error);
            setLogovi([]);
        } else {
            setLogovi(data || []);
        }
    };

    const oznaciKaoRijeseno = async (id) => {
        await supabase.from('sistem_audit_log').update({ pregledano: true }).eq('id', id);
        // Live sync će automatski osvježiti listu
    };

    // Brojači za vizuelni prikaz (Sada su 100% sigurni od rušenja jer je logovi sigurno niz)
    const crvenih = logovi.filter(l => l.nivo_alarma === 'CRVENO' && !l.pregledano).length;
    const zutih = logovi.filter(l => l.nivo_alarma === 'ŽUTO' && !l.pregledano).length;

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6 animate-in fade-in pb-24">
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-slate-500" user={user} modulIme="Nadzorni Centar" />

            <div className="text-center mb-6">
                <h2 className="text-slate-500 font-black tracking-widest uppercase text-xl md:text-2xl drop-shadow-md">
                    🛡️ NADZORNI CENTAR (Superadmin)
                </h2>
                <p className="text-[10px] text-theme-muted uppercase font-bold mt-2">Stealth praćenje kritičnih akcija i prekršaja</p>
            </div>

            {/* TABOVI */}
            <div className="flex bg-theme-panel p-1.5 rounded-2xl border border-theme-border shadow-inner mb-6 mx-auto max-w-md transition-colors">
                <button 
                    onClick={() => setFilter('AKTIVNI')} 
                    className={`flex-1 py-3 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-2 ${filter === 'AKTIVNI' ? 'bg-red-600 text-white shadow-lg' : 'text-theme-muted hover:text-theme-text'}`}
                >
                    🔥 ZAHTIJEVA PAŽNJU
                </button>
                <button 
                    onClick={() => setFilter('ARHIVA')} 
                    className={`flex-1 py-3 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-2 ${filter === 'ARHIVA' ? 'bg-slate-700 text-white shadow-lg' : 'text-theme-muted hover:text-theme-text'}`}
                >
                    📁 ARHIVA / SVI LOGOVI
                </button>
            </div>

            {/* BROJAČI (Prikazuju se samo u tabu AKTIVNI) */}
            {filter === 'AKTIVNI' && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-theme-card border-2 border-red-500/50 p-6 rounded-[2rem] text-center shadow-lg flex flex-col items-center justify-center">
                        <span className="text-[10px] text-red-500 uppercase font-black tracking-widest mb-2">Kritični Alarmi</span>
                        <span className="text-5xl font-black text-red-500 drop-shadow-md">{crvenih}</span>
                    </div>
                    <div className="bg-theme-card border-2 border-amber-500/50 p-6 rounded-[2rem] text-center shadow-lg flex flex-col items-center justify-center">
                        <span className="text-[10px] text-amber-500 uppercase font-black tracking-widest mb-2">Sistemska Upozorenja</span>
                        <span className="text-5xl font-black text-amber-500 drop-shadow-md">{zutih}</span>
                    </div>
                </div>
            )}

            {/* LISTA ALARMA */}
            <div className="bg-theme-card p-6 rounded-[2rem] border border-theme-border shadow-xl min-h-[400px]">
                {logovi.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-theme-muted opacity-50">
                        <span className="text-6xl mb-4">✅</span>
                        <span className="text-xs uppercase font-black tracking-widest">Sve je čisto. Nema novih alarma!</span>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {logovi.map(log => {
                            const isCrveno = log.nivo_alarma === 'CRVENO';
                            const isZuto = log.nivo_alarma === 'ŽUTO';
                            const datum = new Date(log.vrijeme || log.created_at).toLocaleString('de-DE'); // 🟢 POPRAVLJENO: vrijeme umjesto created_at

                            return (
                                <div key={log.id} className={`flex flex-col md:flex-row justify-between md:items-center p-5 rounded-2xl border-l-4 shadow-sm transition-all hover:scale-[1.01] ${isCrveno ? 'bg-red-900/10 border-red-500' : isZuto ? 'bg-amber-900/10 border-amber-500' : 'bg-theme-panel border-slate-500'}`}>
                                    
                                    <div className="flex-1 mb-4 md:mb-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            {isCrveno && <span className="bg-red-500 text-white text-[9px] uppercase font-black px-2 py-0.5 rounded shadow-sm">Kritično</span>}
                                            {isZuto && <span className="bg-amber-500 text-white text-[9px] uppercase font-black px-2 py-0.5 rounded shadow-sm">Upozorenje</span>}
                                            {!isCrveno && !isZuto && <span className="bg-slate-500 text-white text-[9px] uppercase font-black px-2 py-0.5 rounded shadow-sm">INFO</span>}
                                            <span className="text-[10px] text-theme-muted font-bold tracking-widest">{datum}</span>
                                        </div>
                                        
                                        <h3 className="text-sm font-black text-theme-text uppercase">{log.akcija}</h3>
                                        <p className="text-xs text-theme-muted mt-1 font-bold">{log.detalji}</p>
                                        
                                        <div className="mt-3 inline-block bg-theme-card px-3 py-1 rounded-lg border border-theme-border text-[10px] font-black uppercase text-theme-text shadow-inner">
                                            👤 Izvršio: <span className="text-blue-500">{log.korisnik}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end md:ml-4">
                                        {log.pregledano ? (
                                            <span className="text-[10px] text-emerald-500 font-black uppercase flex items-center gap-1"><span className="text-lg">✓</span> Pročitano</span>
                                        ) : (
                                            <button 
                                                onClick={() => oznaciKaoRijeseno(log.id)}
                                                className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md hover:scale-105 ${isCrveno ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'}`}
                                            >
                                                ✓ Označi Riješeno
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}