"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import PametniDialog from '../components/PametniDialog';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function LagerPaketaModule({ user, header, setHeader, onExit }) {
    const [masineList, setMasineList] = useState([]);
    const [filterMasina, setFilterMasina] = useState('SVE');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('NA_STANJU'); 
    
    // 🟢 NAPREDNI FILTERI ZA DIMENZIJE
    const [prikaziNapredno, setPrikaziNapredno] = useState(false);
    const [debOd, setDebOd] = useState(''); const [debDo, setDebDo] = useState('');
    const [sirOd, setSirOd] = useState(''); const [sirDo, setSirDo] = useState('');
    const [duzOd, setDuzOd] = useState(''); const [duzDo, setDuzDo] = useState('');

    const [paketi, setPaketi] = useState([]);
    const [otpremljeneVeze, setOtpremljeneVeze] = useState([]); // 🟢 NOVI STATE ZA HISTORIJU OTPREMNICA
    const [isLoading, setIsLoading] = useState(true);
    
    // 🟢 DETALJI PAKETA (KLIK NA PLOČICU)
    const [detaljiPaketaId, setDetaljiPaketaId] = useState(null);

    const [dialog, setDialog] = useState({ isOpen: false });
    const prikaziDialog = (opcije) => setDialog({ isOpen: true, confirmText: 'POTVRDI', cancelText: 'ZATVORI', ...opcije });
    const zatvoriDialog = () => setDialog({ isOpen: false });

    useEffect(() => {
        const fetchMasine = async () => {
            const { data } = await supabase.from('masine').select('naziv').order('naziv');
            if (data) setMasineList(data.map(m => m.naziv));
        };
        fetchMasine();
    }, []);

    const loadPaketi = async () => {
        setIsLoading(true);

        // 🟢 SUPER-SIGURNOSNA PROVJERA ZA HISTORIJSKE PODATKE
        // Skeniramo sve izdate otpremnice i izdatnice da retroaktivno ispravimo statuse starih paketa
        try {
            const [otpRes, izdRes] = await Promise.all([
                supabase.from('otpremnice').select('id, broj_veze'),
                supabase.from('izdatnice').select('broj_izdatnice, izvor_id')
            ]);
            
            let zavrseneVeze = [];
            if (otpRes.data) {
                otpRes.data.forEach(o => {
                    if (o.broj_veze) {
                        if (o.broj_veze.startsWith('IZD-')) {
                            const izd = (izdRes.data || []).find(i => i.broj_izdatnice === o.broj_veze);
                            if (izd && izd.izvor_id) zavrseneVeze.push(izd.izvor_id);
                        } else {
                            zavrseneVeze.push(o.broj_veze);
                        }
                    }
                });
            }
            setOtpremljeneVeze(zavrseneVeze);
        } catch (e) {
            console.error("Greška pri učitavanju historije otpremnica:", e);
        }

        let query = supabase.from('paketi').select('*').order('created_at', { ascending: false }).limit(2000); // Povećan limit za lager
        
        if (filterMasina !== 'SVE') {
            query = query.eq('masina', filterMasina);
        }

        const { data, error } = await query;
        if (error) {
            console.error("Greška baze:", error);
            prikaziDialog({ tip: 'greska', naslov: 'Greška pri učitavanju', poruka: error.message, onCancel: zatvoriDialog });
        } else {
            setPaketi(data || []);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadPaketi();
    }, [filterMasina]);

    useEffect(() => {
        const channel = supabase.channel(`lager_live_${Math.random()}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'paketi' }, () => {
                loadPaketi();
            }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [filterMasina]);

    // 🟢 FILTRIRANJE PODATAKA (Obična i Napredna pretraga)
    const filtriraniPaketi = useMemo(() => {
        let filtrirano = paketi.filter(p => {
            let pass = true;

            // 1. DIMENZIJSKI FILTERI (Ako su uneseni)
            const deb = parseFloat(p.debljina) || 0;
            const sir = parseFloat(p.sirina) || 0;
            const duz = parseFloat(p.duzina) || 0;

            if (debOd && deb < parseFloat(debOd)) pass = false;
            if (debDo && deb > parseFloat(debDo)) pass = false;
            if (sirOd && sir < parseFloat(sirOd)) pass = false;
            if (sirDo && sir > parseFloat(sirDo)) pass = false;
            if (duzOd && duz < parseFloat(duzOd)) pass = false;
            if (duzDo && duz > parseFloat(duzDo)) pass = false;

            // 2. TEKSTUALNA PRETRAGA (ID, Naziv, Šifra, Nalog, Dimenzija)
            if (searchTerm && pass) {
                const term = searchTerm.toLowerCase();
                const dimenzijaString = `${p.debljina}x${p.sirina}x${p.duzina}`;
                const match = 
                    p.paket_id?.toLowerCase().includes(term) || 
                    p.naziv_proizvoda?.toLowerCase().includes(term) ||
                    p.broj_veze?.toLowerCase().includes(term) ||
                    dimenzijaString.includes(term); // Može kucati npr "10x10"
                if (!match) pass = false;
            }

            return pass;
        });

        // RAZVRSTAVANJE U TABOVE (Statusi)
        return filtrirano.reduce((acc, curr) => {
            // 🟢 HIBRIDNA PROVJERA OTPREME: 
            // Pored klasičnog statusa u paketu, provjeravamo da li se Nalog ovog paketa nalazi u arhivi Otpremnica!
            const isIsporuceno = curr.otpremnica_id || curr.status === 'ISPORUČENO' || (curr.broj_veze && otpremljeneVeze.includes(curr.broj_veze));

            if (isIsporuceno) {
                acc.ISPORUCENO.push(curr);
            } else if (!curr.closed_at) {
                acc.U_RADU.push(curr);
            } else {
                acc.NA_STANJU.push(curr);
            }
            return acc;
        }, { U_RADU: [], NA_STANJU: [], ISPORUCENO: [] });

    }, [paketi, searchTerm, debOd, debDo, sirOd, sirDo, duzOd, duzDo, otpremljeneVeze]);

    const paketiZaPrikaz = filtriraniPaketi[activeTab] || [];
    
    // GRUPISANJE U PLOČICE
    const grupisaniPoId = useMemo(() => {
        const grouped = paketiZaPrikaz.reduce((acc, curr) => {
            if (!acc[curr.paket_id]) {
                acc[curr.paket_id] = { 
                    id: curr.paket_id, 
                    proizvod: curr.naziv_proizvoda,
                    dimenzija: `${curr.debljina}x${curr.sirina}x${curr.duzina}`,
                    m3: 0, 
                    stavke: 0,
                    masina: curr.masina,
                    nalog: curr.broj_veze,
                    datum: curr.closed_at ? new Date(curr.closed_at).toLocaleDateString('de-DE') : new Date(curr.created_at).toLocaleDateString('de-DE')
                };
            }
            acc[curr.paket_id].m3 += parseFloat(curr.kolicina_final || curr.kolicina_m3 || 0);
            acc[curr.paket_id].stavke += 1;
            return acc;
        }, {});
        return Object.values(grouped);
    }, [paketiZaPrikaz]);

    const totalM3TrenutnogTaba = grupisaniPoId.reduce((sum, p) => sum + p.m3, 0);

    // FUNKCIJA ZA ČIŠĆENJE FILTERA
    const ocistiFiltere = () => {
        setSearchTerm(''); setDebOd(''); setDebDo(''); setSirOd(''); setSirDo(''); setDuzOd(''); setDuzDo('');
    };

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6 animate-in fade-in font-sans pb-24 text-theme-text">
            <PametniDialog {...dialog} />
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} user={user} modulIme="lager" />

            {/* 🟢 MODAL ZA DETALJE PAKETA */}
            {detaljiPaketaId && (
                <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-theme-card border border-theme-border rounded-[2rem] p-6 max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                        <div className="flex justify-between items-center border-b border-theme-border pb-4 mb-4">
                            <div>
                                <h2 className="text-2xl font-black text-theme-accent uppercase flex items-center gap-3">
                                    📦 Paket: {detaljiPaketaId}
                                </h2>
                                <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">Detaljan pregled stavki u paketu</p>
                            </div>
                            <button onClick={() => setDetaljiPaketaId(null)} className="text-slate-400 hover:text-white bg-slate-800 hover:bg-red-500 p-3 rounded-xl font-black transition-colors shadow-lg">✕ ZATVORI</button>
                        </div>
                        
                        <div className="overflow-y-auto flex-1 custom-scrollbar pr-2 space-y-3">
                            {paketi.filter(p => p.paket_id === detaljiPaketaId).map((stavka, index) => (
                                <div key={stavka.id} className="bg-theme-panel p-4 rounded-2xl border border-theme-border flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-theme-accent transition-colors">
                                    <div className="flex gap-4 items-center">
                                        <div className="bg-black/30 w-8 h-8 rounded-lg flex items-center justify-center font-black text-slate-500 text-xs border border-theme-border/50">{index + 1}.</div>
                                        <div>
                                            <p className="text-sm font-black text-theme-text">{stavka.naziv_proizvoda}</p>
                                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                                <span className="text-theme-accent font-black text-sm">{stavka.debljina}x{stavka.sirina}x{stavka.duzina}</span>
                                                {stavka.oznake && stavka.oznake.length > 0 && (
                                                    <span className="text-[8px] bg-amber-900/30 text-amber-500 px-2 py-0.5 rounded border border-amber-500/30 font-bold uppercase">{stavka.oznake.join(', ')}</span>
                                                )}
                                                {stavka.je_nusproizvod && <span className="text-[8px] bg-red-900/30 text-red-400 px-2 py-0.5 rounded border border-red-500/30 font-bold uppercase">Nusproizvod</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col md:items-end gap-1 border-t md:border-none border-theme-border/50 pt-3 md:pt-0">
                                        <div className="flex items-end gap-3">
                                            <span className="text-xs text-slate-400 font-black">{stavka.kolicina_ulaz} {stavka.jm} =</span>
                                            <span className="text-xl font-black text-emerald-400">{stavka.kolicina_final} <span className="text-xs text-emerald-600">m³</span></span>
                                        </div>
                                        <div className="text-[8px] text-slate-500 uppercase font-bold text-right">
                                            Radnici: {stavka.radnici_pilana || 'Nepoznato'} | Vrijeme: {stavka.vrijeme_tekst || '-'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-theme-card/80 backdrop-blur-md p-6 rounded-[2.5rem] border border-theme-border shadow-2xl space-y-6">
                
                {/* 🟢 TOP KONTROLE: FILTER I PRETRAGA */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-theme-border pb-6">
                    <div className="flex flex-col w-full md:w-auto">
                        <label className="text-[10px] text-theme-muted uppercase font-black tracking-widest mb-2 ml-2">🌍 Filtriraj po Mašini</label>
                        <select 
                            value={filterMasina} 
                            onChange={(e) => setFilterMasina(e.target.value)}
                            className="bg-theme-panel border border-theme-border text-theme-accent font-black text-lg px-6 py-3 rounded-2xl shadow-inner focus:border-theme-accent outline-none cursor-pointer w-full md:w-64"
                        >
                            <option value="SVE">SVE MAŠINE</option>
                            {masineList.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col w-full md:w-auto flex-1 md:max-w-xl">
                        <label className="text-[10px] text-theme-muted uppercase font-black tracking-widest mb-2 ml-2">🔍 Brza pretraga (Broj paketa, Nalog, Dimenzija)</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                                placeholder="Npr. 10x10, RN-2026, ili 55..." 
                                className="w-full bg-theme-panel border border-theme-border px-6 py-3 rounded-2xl text-theme-text font-black outline-none focus:border-theme-accent shadow-inner placeholder:text-slate-500 uppercase"
                            />
                            <button 
                                onClick={() => setPrikaziNapredno(!prikaziNapredno)}
                                className={`px-4 rounded-2xl font-black text-xs uppercase transition-all shadow-md ${prikaziNapredno ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-theme-border'}`}
                            >
                                ⚙️ Napredni Filteri
                            </button>
                        </div>
                    </div>
                </div>

                {/* 🟢 NAPREDNI FILTERI (DIMENZIJE) */}
                {prikaziNapredno && (
                    <div className="bg-black/30 p-5 rounded-2xl border border-theme-border/50 animate-in slide-in-from-top-2">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-[10px] text-amber-500 uppercase font-black tracking-widest">Pronađi po tačnim dimenzijama (Od - Do)</h4>
                            <button onClick={ocistiFiltere} className="text-[9px] text-red-400 uppercase font-black bg-red-900/30 px-3 py-1.5 rounded-lg hover:bg-red-500 hover:text-white transition-colors">✕ Očisti sve filtere</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-theme-panel p-3 rounded-xl border border-theme-border shadow-inner">
                                <label className="text-[9px] text-slate-400 uppercase font-black block text-center mb-2">Debljina (cm)</label>
                                <div className="flex items-center gap-2">
                                    <input type="number" value={debOd} onChange={e=>setDebOd(e.target.value)} placeholder="Min" className="w-full bg-slate-800 text-center text-sm font-black p-2 rounded-lg outline-none focus:ring-1 ring-amber-500 placeholder:text-slate-600" />
                                    <span className="text-slate-500">-</span>
                                    <input type="number" value={debDo} onChange={e=>setDebDo(e.target.value)} placeholder="Max" className="w-full bg-slate-800 text-center text-sm font-black p-2 rounded-lg outline-none focus:ring-1 ring-amber-500 placeholder:text-slate-600" />
                                </div>
                            </div>
                            <div className="bg-theme-panel p-3 rounded-xl border border-theme-border shadow-inner">
                                <label className="text-[9px] text-slate-400 uppercase font-black block text-center mb-2">Širina (cm)</label>
                                <div className="flex items-center gap-2">
                                    <input type="number" value={sirOd} onChange={e=>setSirOd(e.target.value)} placeholder="Min" className="w-full bg-slate-800 text-center text-sm font-black p-2 rounded-lg outline-none focus:ring-1 ring-amber-500 placeholder:text-slate-600" />
                                    <span className="text-slate-500">-</span>
                                    <input type="number" value={sirDo} onChange={e=>setSirDo(e.target.value)} placeholder="Max" className="w-full bg-slate-800 text-center text-sm font-black p-2 rounded-lg outline-none focus:ring-1 ring-amber-500 placeholder:text-slate-600" />
                                </div>
                            </div>
                            <div className="bg-theme-panel p-3 rounded-xl border border-theme-border shadow-inner">
                                <label className="text-[9px] text-slate-400 uppercase font-black block text-center mb-2">Dužina (cm)</label>
                                <div className="flex items-center gap-2">
                                    <input type="number" value={duzOd} onChange={e=>setDuzOd(e.target.value)} placeholder="Min" className="w-full bg-slate-800 text-center text-sm font-black p-2 rounded-lg outline-none focus:ring-1 ring-amber-500 placeholder:text-slate-600" />
                                    <span className="text-slate-500">-</span>
                                    <input type="number" value={duzDo} onChange={e=>setDuzDo(e.target.value)} placeholder="Max" className="w-full bg-slate-800 text-center text-sm font-black p-2 rounded-lg outline-none focus:ring-1 ring-amber-500 placeholder:text-slate-600" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🟢 TABOVI (Statusi) */}
                <div className="flex bg-black/40 p-2 rounded-2xl border border-theme-border gap-2 overflow-x-auto scrollbar-hide">
                    <button 
                        onClick={() => setActiveTab('U_RADU')}
                        className={`flex-1 min-w-[150px] py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${activeTab === 'U_RADU' ? 'bg-amber-600 text-white shadow-lg scale-105' : 'text-slate-400 hover:bg-slate-800'}`}
                    >
                        🚧 U Proizvodnji ({filtriraniPaketi.U_RADU.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('NA_STANJU')}
                        className={`flex-1 min-w-[150px] py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${activeTab === 'NA_STANJU' ? 'bg-emerald-600 text-white shadow-lg scale-105' : 'text-slate-400 hover:bg-slate-800'}`}
                    >
                        📦 Na Stanju ({filtriraniPaketi.NA_STANJU.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('ISPORUCENO')}
                        className={`flex-1 min-w-[150px] py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${activeTab === 'ISPORUCENO' ? 'bg-blue-600 text-white shadow-lg scale-105' : 'text-slate-400 hover:bg-slate-800'}`}
                    >
                        🚚 Isporučeno ({filtriraniPaketi.ISPORUCENO.length})
                    </button>
                </div>

                {/* 🟢 ZBIRNA STATISTIKA TRENUTNOG PRIKAZA */}
                <div className="flex justify-between items-center bg-theme-panel/50 p-4 rounded-xl border border-theme-border shadow-inner">
                    <span className="text-[10px] text-theme-muted uppercase font-black tracking-widest">
                        Prikazano: <span className="text-theme-text">{grupisaniPoId.length} Paketa</span>
                    </span>
                    <span className="text-[10px] text-theme-muted uppercase font-black tracking-widest text-right">
                        Ukupna Zapremina: <span className="text-xl text-theme-accent ml-2 drop-shadow-md">{totalM3TrenutnogTaba.toFixed(3)} m³</span>
                    </span>
                </div>

                {/* 🟢 LISTA PAKETA (PLOČICE KOJE SE MOGU KLIKNUTI) */}
                {isLoading ? (
                    <div className="text-center py-20 text-theme-muted font-black uppercase tracking-widest animate-pulse">
                        Učitavanje podataka sa servera...
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
                        {grupisaniPoId.length === 0 && (
                            <div className="col-span-full text-center py-16 text-slate-500 border-2 border-dashed border-theme-border rounded-2xl font-bold uppercase text-xs tracking-widest">
                                Nema paketa za odabrani filter i status.
                            </div>
                        )}
                        {grupisaniPoId.map(p => (
                            <div 
                                key={p.id} 
                                onClick={() => setDetaljiPaketaId(p.id)}
                                className="bg-theme-panel border border-theme-border rounded-2xl p-5 hover:border-theme-accent transition-all shadow-md group flex flex-col relative overflow-hidden cursor-pointer hover:scale-[1.02]"
                            >
                                
                                {/* Status indikator boje sa strane */}
                                <div className={`absolute top-0 left-0 w-1.5 h-full ${activeTab === 'U_RADU' ? 'bg-amber-500' : activeTab === 'NA_STANJU' ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                                
                                <div className="flex justify-between items-start mb-3 pl-2">
                                    <h3 className="text-xl font-black text-theme-text group-hover:text-theme-accent transition-colors">{p.id}</h3>
                                    <span className="bg-black/40 border border-theme-border px-2 py-1 rounded text-[9px] text-slate-400 font-bold uppercase">{p.datum}</span>
                                </div>
                                
                                <div className="pl-2 flex-1">
                                    <p className="text-sm font-black text-theme-text mb-1">{p.proizvod}</p>
                                    <p className="text-[10px] text-slate-400 font-bold mb-3">Dimenzija: <span className="text-theme-accent font-black text-xs">{p.dimenzija}</span></p>
                                    
                                    <div className="flex flex-col gap-1 text-[9px] text-slate-500 uppercase font-black tracking-widest border-t border-theme-border/50 pt-3">
                                        <p>Mašina: <span className="text-slate-300">{p.masina}</span></p>
                                        <p>Nalog: <span className={p.nalog ? "text-blue-400" : "text-slate-600"}>{p.nalog || 'Slobodna Prodaja'}</span></p>
                                        <p>Stavki u paketu: <span className="text-slate-300">{p.stavke}</span></p>
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-theme-border pl-2 flex justify-between items-end">
                                    <span className="text-[9px] text-theme-accent bg-theme-accent/10 px-2 py-1 rounded uppercase font-black group-hover:bg-theme-accent group-hover:text-white transition-colors">🔍 Detalji</span>
                                    <span className={`text-2xl font-black drop-shadow-md ${activeTab === 'U_RADU' ? 'text-amber-400' : activeTab === 'NA_STANJU' ? 'text-emerald-400' : 'text-blue-400'}`}>
                                        {p.m3.toFixed(3)} <span className="text-xs">m³</span>
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}