"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import ScannerOverlay from '../components/ScannerOverlay';
import { printDeklaracijaPaketa } from '../utils/printHelpers';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function LagerPaketaModule({ onExit, user, header, setHeader }) {
    const danasnjiDatum = new Date().toISOString().split('T')[0];
    const [datumOd, setDatumOd] = useState(danasnjiDatum);
    const [datumDo, setDatumDo] = useState(danasnjiDatum);
    const [isPeriod, setIsPeriod] = useState(false); 
    const [filterStatus, setFilterStatus] = useState('SVI');
    const [pretraga, setPretraga] = useState('');
    
    const [paketi, setPaketi] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selektovaniPaket, setSelektovaniPaket] = useState(null);
    const [historija, setHistorija] = useState([]);
    const [isPrinting, setIsPrinting] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    const formatirajDatum = (isoString) => {
        if(!isoString) return '';
        const [y, m, d] = isoString.split('T')[0].split('-');
        return `${d}.${m}.${y}.`;
    };

    useEffect(() => { ucitajLager(); }, [datumOd, datumDo, isPeriod, filterStatus]);

    const ucitajLager = async () => {
        setLoading(true);
        let query = supabase.from('paketi').select('*');

        if (isPeriod) {
            query = query.gte('datum_yyyy_mm', datumOd).lte('datum_yyyy_mm', datumDo);
        } else {
            query = query.eq('datum_yyyy_mm', datumOd);
        }

        if (filterStatus === 'AKTIVNI') query = query.is('closed_at', null);
        else if (filterStatus === 'ZAVRŠENI') query = query.not('closed_at', 'is', null);

        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (data) {
            const grupisaniPaketi = [];
            const iskoristeniIDovi = new Set();
            for (let p of data) {
                if (!iskoristeniIDovi.has(p.paket_id)) {
                    iskoristeniIDovi.add(p.paket_id);
                    grupisaniPaketi.push(p);
                }
            }
            setPaketi(grupisaniPaketi);
        }
        setLoading(false);
    };

    const ucitajHistoriju = async (paket) => {
        setSelektovaniPaket(paket);
        setHistorija('load');
        const sid = paket.paket_id;

        const { data: auditData } = await supabase.from('audit_log').select('*').eq('zapis_id', sid).order('vrijeme', { ascending: true });
        
        let dogadjaji = [];
        if (auditData) {
            dogadjaji = auditData.map(a => ({
                vrijeme: a.vrijeme,
                naslov: a.akcija,
                opis: a.akcija === 'DODAVANJE' ? 'Kreiran u proizvodnji' : 'Izmjena podataka',
                korisnik: a.korisnik
            }));
        }

        // --- PRIKAZ ULAZNE SIROVINE (ZA DORADU GOTOVE ROBE) ---
        if (paket.ai_sirovina_ids && paket.ai_sirovina_ids.length > 0) {
            dogadjaji.push({
                vrijeme: paket.created_at,
                naslov: 'ULAZNA SIROVINA (DORADA)',
                opis: `Napravljeno preradom paketa: ${Array.isArray(paket.ai_sirovina_ids) ? paket.ai_sirovina_ids.join(', ') : paket.ai_sirovina_ids}`,
                korisnik: 'Sistem'
            });
        }

        // --- PRIKAZ ULAZNIH TRUPACA (ZBIRNO IZ SVIH STAVKI PAKETA U PILANI) ---
        const { data: sveStavkePaketa } = await supabase.from('paketi').select('ulaz_trupci_ids').eq('paket_id', sid);
        
        if (sveStavkePaketa && sveStavkePaketa.length > 0) {
            let sviTrupciId = [];
            
            // Skupljamo nizove trupaca iz svih mogućih smjena/redova za ovaj paket
            sveStavkePaketa.forEach(red => {
                if (red.ulaz_trupci_ids && Array.isArray(red.ulaz_trupci_ids)) {
                    sviTrupciId = [...sviTrupciId, ...red.ulaz_trupci_ids];
                }
            });
            
            const unikatniTrupci = [...new Set(sviTrupciId)]; // Uklanjamo duplikate

            if (unikatniTrupci.length > 0) {
                // Tražimo detalje o tim trupcima iz baze
                const { data: trupciPodaci } = await supabase.from('trupci').select('*').in('id', unikatniTrupci);
                
                if (trupciPodaci && trupciPodaci.length > 0) {
                    const totalV = trupciPodaci.reduce((s, t) => s + parseFloat(t.zapremina || 0), 0);
                    const sumarijeMap = {};
                    
                    trupciPodaci.forEach(t => {
                        const s = t.sumarija || 'Nepoznato';
                        sumarijeMap[s] = (sumarijeMap[s] || 0) + parseFloat(t.zapremina || 0);
                    });

                    // Formatiranje tekstualnog izvještaja
                    const infoText = Object.keys(sumarijeMap)
                        .map(k => `${k}: ${((sumarijeMap[k]/totalV)*100).toFixed(1)}%`)
                        .join(' | ');

                    dogadjaji.push({
                        vrijeme: paket.created_at,
                        naslov: 'SASTAV SIROVINE (SVE SMJENE)',
                        opis: `Paket je kroz sve faze izrade utrošio ${unikatniTrupci.length} trupaca.\n\nUdio šumarija:\n${infoText}`,
                        korisnik: 'Sistem'
                    });
                }
            }
        }

        // Sortiramo događaje po vremenu da ima logičan slijed
        setHistorija(dogadjaji.length > 0 ? dogadjaji.sort((a,b) => new Date(a.vrijeme) - new Date(b.vrijeme)) : 'none');
    };

    const shiftDate = (n) => {
        const d = new Date(datumOd + 'T12:00:00'); 
        d.setDate(d.getDate() + n);
        const iso = d.toISOString().split('T')[0];
        setDatumOd(iso); setDatumDo(iso);
    };

    const isprintajAutomatski = async (paket) => {
        setIsPrinting(true);
        
        let vezniDokument = paket.broj_veze; 
        
        // Ako postoji RN, provjeri ima li on svoju Ponudu
        if (vezniDokument && vezniDokument.startsWith('RN-')) {
            const { data: rn } = await supabase.from('radni_nalozi').select('broj_ponude').eq('id', vezniDokument).maybeSingle();
            
            // Ako RN ima upisanu ponudu, prepisujemo vezni dokument da bude ponuda
            if (rn && rn.broj_ponude && rn.broj_ponude.trim() !== '') {
                vezniDokument = rn.broj_ponude;
            }
        }
        
        if (!vezniDokument) {
            alert(`Sistem napominje: Paket ${paket.paket_id} nema zabilježen Radni Nalog prilikom kreiranja u Pilani/Doradi.\nQR kod će ostati prazan.`);
        }
        
        // Šaljemo u print!
        printDeklaracijaPaketa(paket.paket_id, [paket], vezniDokument || '');
        setIsPrinting(false);
    };

    const handleScanInput = (val) => {
        const query = val.toUpperCase().trim();
        setPretraga(query);
        setIsScanning(false);
    };


    return (
        <div className="p-4 max-w-5xl mx-auto space-y-6 animate-in fade-in font-bold">
            <div className="flex justify-between items-center bg-[#1e293b] p-4 rounded-3xl border border-blue-500/30 shadow-lg">
                <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase text-white font-black hover:bg-slate-700 transition-all">← Meni</button>
                <h2 className="text-blue-400 font-black tracking-widest uppercase text-xs">📦 LAGER I SLJEDIVOST PAKETA</h2>
                <div className="w-20"></div>
            </div>

            <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
                        <button onClick={() => setIsPeriod(false)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${!isPeriod ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-white'}`}>Dan</button>
                        <button onClick={() => setIsPeriod(true)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${isPeriod ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-white'}`}>Period</button>
                    </div>

                    <div className="flex items-center gap-3">
                        {!isPeriod ? (
                            <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-700">
                                <button onClick={() => shiftDate(-1)} className="w-8 h-8 bg-slate-800 rounded hover:bg-blue-600 text-white flex items-center justify-center font-black transition-all">-</button>
                                
                                <input 
                                    type="date" 
                                    value={datumOd} 
                                    onChange={e => { setDatumOd(e.target.value); setDatumDo(e.target.value); }} 
                                    className="bg-slate-800 text-blue-400 font-black text-sm p-2 rounded-xl border border-slate-700 outline-none focus:border-blue-500 cursor-pointer tracking-widest text-center"
                                />

                                <button onClick={() => shiftDate(1)} className="w-8 h-8 bg-slate-800 rounded hover:bg-blue-600 text-white flex items-center justify-center font-black transition-all">+</button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-700">
                                <input type="date" value={datumOd} onChange={e => setDatumOd(e.target.value)} className="bg-slate-800 text-blue-400 font-black text-xs p-2 rounded-xl border border-slate-700 outline-none focus:border-blue-500 cursor-pointer" />
                                <span className="text-slate-500 font-black">-</span>
                                <input type="date" value={datumDo} onChange={e => setDatumDo(e.target.value)} className="bg-slate-800 text-blue-400 font-black text-xs p-2 rounded-xl border border-slate-700 outline-none focus:border-blue-500 cursor-pointer" />
                            </div>
                        )}
                    </div>

                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-slate-900 text-white p-3 rounded-xl text-xs font-black border border-slate-700 outline-none focus:border-blue-500">
                        <option value="SVI">SVI PAKETI</option>
                        <option value="AKTIVNI">U PROIZVODNJI (Otvoreni)</option>
                        <option value="ZAVRŠENI">NA STANJU (Zaključeni)</option>
                    </select>
                </div>

                <div className="relative font-black">
                    <input 
                        value={pretraga} 
                        onChange={e => setPretraga(e.target.value.toUpperCase())}
                        placeholder="Pretraži po broju paketa ili nazivu robe..." 
                        className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl text-white text-sm outline-none focus:border-blue-500 uppercase font-black"
                    />
                    <button onClick={() => setIsScanning(true)} className="absolute right-2 top-2 bottom-2 px-4 bg-blue-600 rounded-xl text-white font-bold hover:bg-blue-500 transition-all shadow-lg">📷 SKENIRAJ QR</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <div className="col-span-full text-center py-20 animate-pulse text-blue-400 font-black tracking-widest uppercase">Učitavam Lager...</div>
                ) : paketi.length === 0 ? (
                    <div className="col-span-full text-center py-20 text-slate-600 font-bold border-2 border-dashed border-slate-800 rounded-[2.5rem]">Nema paketa za odabrani datum/kriterij.</div>
                ) : (
                    paketi.filter(p => p.paket_id.includes(pretraga) || p.naziv_proizvoda.toUpperCase().includes(pretraga)).map(p => (
                        <div key={p.id} onClick={() => ucitajHistoriju(p)} className="bg-[#111827] border border-slate-800 p-5 rounded-[2rem] hover:border-blue-500 transition-all cursor-pointer group relative overflow-hidden shadow-xl">
                            {p.closed_at && <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[8px] px-3 py-1 font-black rounded-bl-xl uppercase shadow-md">ZAVRŠEN</div>}
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <p className="text-blue-400 font-black text-lg">{p.paket_id}</p>
                                    <p className="text-white text-xs font-bold mt-1 uppercase">{p.naziv_proizvoda}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-emerald-400 font-black text-xl">{p.kolicina_final} <span className="text-[10px]">m³</span></p>
                                    <p className="text-slate-500 text-[9px] uppercase mt-1">{formatirajDatum(p.datum_yyyy_mm)}</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-800/50">
                                <span className="text-[9px] text-slate-400 uppercase font-bold">{p.debljina}x{p.sirina}x{p.duzina}</span>
                                <span className="text-[9px] text-slate-500 uppercase font-black">{p.vrijeme_tekst} | {p.masina}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {selektovaniPaket && (
                <div className="fixed inset-0 z-[150] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-[#1e293b] border-2 border-blue-500 p-8 rounded-[3rem] shadow-2xl max-w-lg w-full relative max-h-[90vh] overflow-y-auto">
                        <button onClick={() => setSelektovaniPaket(null)} className="absolute top-6 right-6 text-slate-400 hover:text-white text-2xl font-black transition-all hover:scale-110">✕</button>
                        
                        <div className="mb-8">
                            <h3 className="text-blue-400 font-black uppercase text-xs mb-2 tracking-widest">Detalji Paketa</h3>
                            <p className="text-white text-4xl font-black">{selektovaniPaket.paket_id}</p>
                            <p className="text-slate-400 text-sm mt-2">{selektovaniPaket.naziv_proizvoda} ({selektovaniPaket.debljina}x{selektovaniPaket.sirina}x{selektovaniPaket.duzina})</p>
                        </div>

                        <div className="space-y-4 mb-8">
                            <h4 className="text-slate-500 font-black uppercase text-[10px] border-b border-slate-700 pb-2">Vremenska Sljedivost (Historija):</h4>
                            {historija === 'load' ? <p className="animate-pulse text-xs text-blue-400">Generiram timeline...</p> : 
                             historija === 'none' ? <p className="text-xs text-slate-600">Nema dodatnih zapisa o promjenama.</p> : (
                                <div className="space-y-4">
                                    {historija.map((h, i) => (
                                        <div key={i} className="flex gap-4 items-start relative before:absolute before:left-[7px] before:top-5 before:bottom-[-20px] before:w-[2px] before:bg-slate-800 last:before:hidden">
                                            <div className="w-4 h-4 rounded-full bg-blue-600 border-4 border-[#1e293b] z-10 shrink-0 mt-1"></div>
                                            <div>
                                                <p className="text-white text-xs font-black uppercase">{h.naslov}</p>
                                                <p className="text-[10px] text-slate-400 mt-1">{h.opis}</p>
                                                <p className="text-[8px] text-slate-500 mt-1 uppercase font-bold">{new Date(h.vrijeme).toLocaleString('bs-BA')} | Snimio: {h.korisnik}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                             )}
                        </div>

                        <button 
                            onClick={() => isprintajAutomatski(selektovaniPaket)}
                            disabled={isPrinting}
                            className={`w-full py-4 text-white font-black rounded-2xl uppercase shadow-lg transition-all flex items-center justify-center gap-2 ${isPrinting ? 'bg-slate-600' : 'bg-blue-600 hover:bg-blue-500'}`}
                        >
                            {isPrinting ? '⏳ Tražim vezu i generišem...' : '🖨️ Isprintaj deklaraciju (Auto QR)'}
                        </button>
                    </div>
                </div>
            )}
            
            {isScanning && <ScannerOverlay onScan={(text) => handleScanInput(text)} onClose={() => setIsScanning(false)} />}
        </div>
    );
}