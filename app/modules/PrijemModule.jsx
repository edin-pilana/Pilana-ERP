"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import SmartSearchableInput from '../components/SmartSearchableInput';
import ScannerOverlay from '../components/ScannerOverlay';
import { useSaaS } from '../utils/useSaaS';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const shiftDateString = (isoStr, days) => {
    if(!isoStr) return new Date().toISOString().split('T')[0];
    const d = new Date(isoStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
};

export default function PrijemModule({ user, header, setHeader, onExit }) {
    
    const saas = useSaaS('prijem_trupaca', {
        boja_kartice: '#1e293b',
        naslov_zaglavlja: 'ZAGLAVLJE OTPREMNICE',
        naslov_skenera: 'SKENIRAJ QR KOD TRUPCA',
        boja_teksta: 'text-indigo-400',
        polja_zaglavlje: [
            { id: 'sumarija', label: 'ŠUMARIJA', span: 'col-span-1' },
            { id: 'podruznica', label: 'PODRUŽNICA', span: 'col-span-1' },
            { id: 'prevoznik', label: 'PREVOZNIK', span: 'col-span-1' },
            { id: 'odjel', label: 'ODJEL', span: 'col-span-1' },
            { id: 'otpremnica_datum', label: 'DATUM OTPR.', span: 'col-span-1' },
            { id: 'otpremnica_broj', label: 'BROJ OTPREMNICE', span: 'col-span-1' }
        ],
        polja_unos: [
            { id: 'plocica', label: 'BROJ PLOČICE', span: 'col-span-2' },
            { id: 'redni', label: 'REDNI BROJ (OPCIONO)', span: 'col-span-2' },
            { id: 'vrsta', label: 'VRSTA DRVETA', span: 'col-span-1' },
            { id: 'klasa', label: 'KLASA', span: 'col-span-1' },
            { id: 'duzina', label: 'DUŽINA (M)', span: 'col-span-1' },
            { id: 'promjer', label: 'PREČNIK (CM)', span: 'col-span-1' }
        ]
    });

    const aktivnaPoljaZaglavlja = saas.ui.polja_zaglavlje?.length > 0 ? saas.ui.polja_zaglavlje : saas.defaultConfig.polja_zaglavlje;
    const aktivnaPoljaUnosa = saas.ui.polja_unos?.length > 0 ? saas.ui.polja_unos : saas.defaultConfig.polja_unos;

    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    const handleDragStart = (e, index, lista) => { dragItem.current = { index, lista }; };
    const handleDragEnter = (e, index) => { dragOverItem.current = index; };
    const handleDrop = (listaIme) => {
        if(!dragItem.current || dragOverItem.current === null || dragItem.current.lista !== listaIme) return;
        const novaLista = [...saas.ui[listaIme]];
        const premjesteniItem = novaLista[dragItem.current.index];
        novaLista.splice(dragItem.current.index, 1);
        novaLista.splice(dragOverItem.current, 0, premjesteniItem);
        dragItem.current = null; dragOverItem.current = null;
        saas.setUi({...saas.ui, [listaIme]: novaLista});
    };
    const updatePolje = (index, key, val, listaIme) => {
        const novaLista = [...saas.ui[listaIme]];
        novaLista[index][key] = val;
        saas.setUi({...saas.ui, [listaIme]: novaLista});
    };

    const [sumarijeList, setSumarijeList] = useState([]);
    const [podruzniceList, setPodruzniceList] = useState([]);
    const [prevozniciList, setPrevozniciList] = useState([]);
    const [odjeliList, setOdjeliList] = useState([]);

    useEffect(() => {
        supabase.from('sumarije').select('naziv').then(({data}) => setSumarijeList(data?data.map(d=>d.naziv):[]));
        supabase.from('prevoznici').select('naziv').then(({data}) => setPrevozniciList(data?data.map(d=>d.naziv):[]));
        supabase.from('trupci').select('odjel').neq('odjel', null).then(({data}) => {
            if(data) { const uniqueOdjeli = [...new Set(data.map(d => d.odjel).filter(Boolean))]; setOdjeliList(uniqueOdjeli); }
        });
    }, []);

    const ucitajPodruznice = async (sumarijaNaziv) => {
        const {data} = await supabase.from('podruznice').select('naziv').eq('sumarija_naziv', sumarijaNaziv);
        setPodruzniceList(data?data.map(d=>d.naziv):[]);
    };

    const [pHeader, setPHeader] = useState({
        sumarija: typeof window !== 'undefined' ? localStorage.getItem('pr_sumarija') || '' : '',
        podruznica: typeof window !== 'undefined' ? localStorage.getItem('pr_podruznica') || '' : '',
        prevoznik: typeof window !== 'undefined' ? localStorage.getItem('pr_prevoznik') || '' : '',
        odjel: typeof window !== 'undefined' ? localStorage.getItem('pr_odjel') || '' : '',
        otpremnica_broj: typeof window !== 'undefined' ? localStorage.getItem('pr_otpr_broj') || '' : '',
        otpremnica_datum: typeof window !== 'undefined' ? localStorage.getItem('pr_otpr_datum') || new Date().toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    });

    useEffect(() => { if(pHeader.sumarija) ucitajPodruznice(pHeader.sumarija); }, []);

    const [scan, setScan] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    
    const [form, setForm] = useState({ 
        broj_plocice: '', redni_broj: '', vrsta: 'Jela', klasa: 'I', 
        duzina: '', promjer: '',
        isKontrola: false, kontrolna_duzina: '', kontrolni_promjer: ''
    });
    
    const [listaPrijema, setListaPrijema] = useState([]);
    const scanTimerRef = useRef(null);

    useEffect(() => { loadPrijemList(); }, [pHeader.otpremnica_broj]);

    const loadPrijemList = async () => {
        if(!pHeader.otpremnica_broj) return;
        const { data, error } = await supabase.from('trupci').select('*').eq('otpremnica_broj', pHeader.otpremnica_broj).eq('zakljucen_prijem', false).order('created_at', { ascending: false });
        if (error) console.error(error);
        setListaPrijema(data || []);
    };

    const updateHeader = (key, val) => {
        const updated = { ...pHeader, [key]: val };
        if(key === 'sumarija') { updated.podruznica = ''; ucitajPodruznice(val); }
        setPHeader(updated);
        localStorage.setItem(`pr_${key}`, val);
    };

    const calculatedZapremina = useMemo(() => {
        if(!form.duzina || !form.promjer) return "0.00";
        const r = parseFloat(form.promjer) / 200; 
        return (r * r * Math.PI * parseFloat(form.duzina)).toFixed(2);
    }, [form.duzina, form.promjer]);

    const calculatedKontrolnaZapremina = useMemo(() => {
        if(!form.kontrolna_duzina || !form.kontrolni_promjer) return "0.00";
        const r = parseFloat(form.kontrolni_promjer) / 200; 
        return (r * r * Math.PI * parseFloat(form.kontrolna_duzina)).toFixed(2);
    }, [form.kontrolna_duzina, form.kontrolni_promjer]);

    const handleScanInput = (val) => {
        setScan(val);
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        if (val.length >= 3) {
            scanTimerRef.current = setTimeout(async () => {
                const id = val.toUpperCase();
                const { data: existing } = await supabase.from('trupci').select('id, status, otpremnica_broj').eq('id', id).maybeSingle();
                if(existing) {
                    alert(`⛔ GREŠKA! QR KOD JE VEĆ ISKORIŠTEN!\n\nTrupac sa kodom ${id} već postoji u bazi!\nTrenutni status: ${existing.status ? existing.status.toUpperCase() : 'N/A'}\nOtpremnica: ${existing.otpremnica_broj || 'N/A'}\n\nUzmite i skenirajte drugu (novu) pločicu!`);
                    setScan(''); 
                }
            }, 1000); 
        }
    };

    const snimiTrupac = async () => {
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        if(!pHeader.otpremnica_broj || !pHeader.sumarija) return alert("Popunite Šumariju i Broj Otpremnice u Zaglavlju!");
        if(!scan || !form.duzina || !form.promjer) return alert("Skeniraj QR, unesi dužinu i prečnik.");
        if(form.isKontrola && (!form.kontrolna_duzina || !form.kontrolni_promjer)) return alert("Upalili ste Kontrolu. Unesite kontrolnu dužinu i prečnik!");
        
        const trupacID = scan.toUpperCase();
        
        const trupacData = {
            id: trupacID, broj_plocice: form.broj_plocice || null, redni_broj: form.redni_broj || null, 
            vrsta: form.vrsta, klasa: form.klasa, duzina: parseFloat(form.duzina), promjer: parseFloat(form.promjer), 
            zapremina: parseFloat(calculatedZapremina), 
            kontrolna_duzina: form.isKontrola ? parseFloat(form.kontrolna_duzina) : null,
            kontrolni_promjer: form.isKontrola ? parseFloat(form.kontrolni_promjer) : null,
            kontrolna_zapremina: form.isKontrola ? parseFloat(calculatedKontrolnaZapremina) : null,
            sumarija: pHeader.sumarija, podruznica: pHeader.podruznica || null, otpremnica_broj: pHeader.otpremnica_broj,
            otpremnica_datum: pHeader.otpremnica_datum, prevoznik: pHeader.prevoznik || null, odjel: pHeader.odjel || null,         
            snimio_korisnik: user?.ime_prezime || 'Nepoznat', datum_prijema: new Date().toISOString().split('T')[0], 
            zakljucen_prijem: false, status: 'na_lageru'
        };

        const { error } = await supabase.from('trupci').upsert([trupacData]);
        if (error) return alert("Baza greška: " + error.message);

        if (typeof window !== 'undefined' && window.navigator.vibrate) window.navigator.vibrate(100); 

        setScan(''); 
        setForm({ broj_plocice: '', redni_broj: '', vrsta: 'Jela', klasa: 'I', duzina: '', promjer: '', isKontrola: false, kontrolna_duzina: '', kontrolni_promjer: '' }); 
        await loadPrijemList();
    };

    const zakljuciOtpremnicu = async () => {
        if(listaPrijema.length === 0) return alert("Nema trupaca na listi za zaključavanje.");
        if(window.confirm(`ZAKLJUČITI OTPREMNICU ${pHeader.otpremnica_broj}?\nOvo će trajno potvrditi sve dodane trupce.`)) {
            for(let trupac of listaPrijema) await supabase.from('trupci').update({ zakljucen_prijem: true }).eq('id', trupac.id);
            ['pr_sumarija', 'pr_podruznica', 'pr_prevoznik', 'pr_odjel', 'pr_otpr_broj'].forEach(k => localStorage.removeItem(k));
            setPHeader({...pHeader, sumarija: '', podruznica: '', prevoznik: '', odjel: '', otpremnica_broj: ''});
            setListaPrijema([]);
            alert("Otpremnica zaključena!");
        }
    };

    const renderPolje = (polje, formData, setFormData) => {
        const actualId = polje.id === 'datum' ? 'otpremnica_datum' : (polje.id === 'broj' ? 'otpremnica_broj' : polje.id);
        const val = formData[actualId] || '';
        const setVal = (v) => setFormData(actualId, v);

        // OVDJE JE DODAT STAKLENI OKVIR OKO SMART PRETRAGE DA BI BILA VIDLJIVA KAO INPUT
        const searchableWrapper = (child) => (
            <div className="w-full h-full min-h-[45px] bg-theme-panel border border-theme-border rounded-xl focus-within:border-theme-accent shadow-inner flex items-center px-3 overflow-visible transition-colors">
                <div className="w-full h-full min-w-0 bg-transparent text-theme-text font-black text-xs uppercase outline-none overflow-visible pt-1">
                    {child}
                </div>
            </div>
        );

        if (actualId === 'sumarija') return searchableWrapper(<SmartSearchableInput value={val} onChange={setVal} list={sumarijeList} storageKey="sum_hist" />);
        if (actualId === 'podruznica') return searchableWrapper(<SmartSearchableInput value={val} onChange={setVal} list={podruzniceList} storageKey="pod_hist" />);
        if (actualId === 'prevoznik') return searchableWrapper(<SmartSearchableInput value={val} onChange={setVal} list={prevozniciList} storageKey="prev_hist" />);
        if (actualId === 'odjel') return searchableWrapper(<SmartSearchableInput value={val} onChange={setVal} list={odjeliList} storageKey="odjel_hist" />);
        
        if (actualId === 'otpremnica_datum') return (
            <div className="flex items-center gap-1 bg-theme-panel border border-theme-border rounded-xl p-1 focus-within:border-theme-accent h-full w-full">
                <button type="button" onClick={() => setVal(shiftDateString(val, -1))} className="w-8 h-8 bg-black/20 rounded hover:bg-theme-accent text-theme-text font-black shrink-0 transition-colors">-</button>
                <input type="date" value={val} onChange={e => setVal(e.target.value)} className="flex-1 w-full bg-transparent text-xs text-theme-text outline-none text-center uppercase [&::-webkit-calendar-picker-indicator]:invert" />
                <button type="button" onClick={() => setVal(shiftDateString(val, 1))} className="w-8 h-8 bg-black/20 rounded hover:bg-theme-accent text-theme-text font-black shrink-0 transition-colors">+</button>
            </div>
        );
        if (actualId === 'otpremnica_broj') return <input type="text" value={val} onChange={e => setVal(e.target.value.toUpperCase())} className="w-full h-full min-h-[45px] p-3 bg-theme-panel border border-theme-border rounded-xl text-xs text-theme-text outline-none focus:border-theme-accent" placeholder="Unesi broj..." />;
        
        if (actualId === 'plocica') return <input type="text" value={val} onChange={e => setVal(e.target.value)} className="w-full h-full min-h-[45px] p-3 bg-theme-panel border border-theme-border rounded-xl text-theme-text outline-none focus:border-theme-accent text-center text-sm font-black shadow-inner" placeholder="12345" />;
        if (actualId === 'redni') return <input type="text" value={val} onChange={e => setVal(e.target.value)} className="w-full h-full min-h-[45px] p-3 bg-theme-panel border border-theme-border rounded-xl text-theme-text outline-none focus:border-theme-accent text-center text-sm shadow-inner" placeholder="npr. 1" />;
        if (actualId === 'vrsta') return (
            <select value={val} onChange={e => setVal(e.target.value)} className="w-full h-full min-h-[45px] p-3 bg-theme-panel border border-theme-border rounded-xl text-theme-text outline-none uppercase text-center text-sm font-black shadow-inner cursor-pointer">
                <option value="Jela">JELA</option><option value="Smrča">SMRČA</option><option value="Bukva">BUKVA</option>
            </select>
        );
        if (actualId === 'klasa') return (
            <select value={val} onChange={e => setVal(e.target.value)} className="w-full h-full min-h-[45px] p-3 bg-theme-panel border border-theme-border rounded-xl text-theme-text outline-none uppercase text-center text-sm font-black shadow-inner cursor-pointer">
                <option value="I">I</option><option value="II">II</option><option value="III">III</option><option value="L">L</option>
            </select>
        );
        if (actualId === 'duzina' || actualId === 'promjer') return <input type="number" value={val} onChange={e => setVal(e.target.value)} className="w-full h-full min-h-[45px] p-3 bg-theme-panel border border-theme-border rounded-xl text-theme-text outline-none focus:border-theme-accent text-center text-xl font-black shadow-inner" placeholder="0" />;
        
        return null;
    };

    const { totalDeklarisano, totalStvarno, totalRazlikaM3 } = useMemo(() => {
        let dek = 0, stv = 0;
        listaPrijema.forEach(t => {
            dek += parseFloat(t.zapremina || 0);
            stv += parseFloat(t.kontrolna_zapremina || t.zapremina || 0);
        });
        return { totalDeklarisano: dek.toFixed(2), totalStvarno: stv.toFixed(2), totalRazlikaM3: (stv - dek).toFixed(2) };
    }, [listaPrijema]);

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6 font-sans animate-in fade-in pb-24">
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} user={user} hideMasina={true} modulIme="prijem" saas={saas} />

            <div className="text-center mb-6">
                <h2 className="text-theme-accent font-black tracking-widest uppercase text-xl md:text-2xl drop-shadow-md flex items-center justify-center gap-3">
                    🌳 PRIJEM TRUPACA (Lager)
                </h2>
            </div>

            {/* ANALITIKA GORNJE TRAKE */}
            {pHeader.otpremnica_broj && listaPrijema.length > 0 && (
                <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-[var(--radius-box)] border border-theme-accent/50 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4 animate-in slide-in-from-top">
                    <div>
                        <span className="text-theme-text text-lg font-black uppercase">OTPREMNICA: <span className="text-theme-accent">{pHeader.otpremnica_broj}</span></span>
                        <div className="text-xs text-theme-muted mt-2 flex flex-wrap gap-4 uppercase font-black tracking-widest">
                            <p>Skenirano: <span className="text-theme-accent text-sm ml-1">{listaPrijema.length} kom</span></p>
                            <p>Papir: <span className="text-theme-text text-sm ml-1">{totalDeklarisano} m³</span></p>
                            {parseFloat(totalRazlikaM3) !== 0 && (
                                <p>Stvarno stanje: <span className="text-theme-text text-sm ml-1">{totalStvarno} m³</span> | 
                                <span className={parseFloat(totalRazlikaM3) > 0 ? "text-emerald-400 ml-2" : "text-red-500 ml-2"}>Razlika: {parseFloat(totalRazlikaM3) > 0 ? '+' : ''}{totalRazlikaM3} m³</span></p>
                            )}
                        </div>
                    </div>
                    <button onClick={zakljuciOtpremnicu} className="w-full md:w-auto px-8 py-4 bg-theme-accent text-white font-black rounded-xl text-xs uppercase shadow-[0_0_20px_rgba(var(--theme-accent-rgb),0.5)] hover:opacity-80 transition-all">
                        🏁 ZAKLJUČI OTPREMNICU
                    </button>
                </div>
            )}

            {/* BENTO GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* LIJEVA KOLONA: Zaglavlje Otpremnice */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="p-6 rounded-[var(--radius-box)] shadow-2xl transition-all border border-theme-border bg-theme-card backdrop-blur-[var(--glass-blur)] relative">
                        <div className="text-center font-black relative mb-6 border-b border-theme-border pb-4">
                            {saas.isEditMode ? (
                                <input value={saas.ui.naslov_zaglavlja} onChange={e => saas.setUi({...saas.ui, naslov_zaglavlja: e.target.value})} className="w-full bg-black/40 text-amber-400 p-2 rounded border border-amber-500/50 text-xs uppercase font-black text-center outline-none" placeholder="Naziv zaglavlja..." />
                            ) : (
                                <span className="text-xs text-theme-accent uppercase tracking-widest flex items-center justify-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-theme-accent"></span> {saas.ui.naslov_zaglavlja}
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 relative">
                            {aktivnaPoljaZaglavlja.map((polje, index) => (
                                <div key={polje.id} className={`relative ${polje.span} transition-all`} style={{ zIndex: 50 - index }}>
                                    {polje.label && <label className="text-[9px] text-theme-muted uppercase block mb-1 font-black tracking-widest">{polje.label}</label>}
                                    <div className="h-12 w-full overflow-visible">{renderPolje(polje, pHeader, updateHeader)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* DESNA KOLONA: Unos i Skener */}
                <div className="lg:col-span-7 space-y-6">
                    <div className={`p-8 rounded-[var(--radius-box)] shadow-[0_0_40px_rgba(0,0,0,0.3)] border bg-theme-card backdrop-blur-[var(--glass-blur)] relative overflow-hidden group ${saas.isEditMode ? 'border-dashed border-amber-500' : 'border-theme-accent/40'}`}>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-theme-accent to-transparent opacity-50"></div>
                        
                        <label className="text-xs uppercase text-theme-accent block mb-4 font-black tracking-widest text-center">
                            {saas.ui.naslov_skenera || "SKENIRAJ QR KOD TRUPCA"}
                        </label>
                        
                        <div className="flex bg-theme-panel border-2 border-theme-accent/40 rounded-2xl overflow-hidden shadow-inner focus-within:border-theme-accent transition-all h-20 mb-6">
                            <input value={scan} onChange={e => handleScanInput(e.target.value)} className="flex-1 px-6 bg-transparent text-xl md:text-2xl text-center text-theme-text outline-none uppercase placeholder:text-theme-muted/30 font-black tracking-widest" placeholder="ČEKAM SKEN..." />
                            <button onClick={() => setIsScanning(true)} className="px-8 bg-theme-accent text-white font-black hover:opacity-80 transition-colors text-2xl flex items-center justify-center shadow-lg">📷</button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative mb-6">
                            {aktivnaPoljaUnosa.map((polje, index) => (
                                <div key={polje.id} className={`relative ${polje.span} transition-all`} style={{ zIndex: 50 - index }}>
                                    {polje.label && <label className="text-[9px] text-theme-muted uppercase block mb-1 font-black tracking-widest text-center">{polje.label}</label>}
                                    <div className="h-14 w-full">{renderPolje(polje, form, (key, val) => setForm({...form, [key]: val}))}</div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between items-center bg-theme-panel p-5 rounded-2xl border border-theme-border shadow-inner mb-6">
                            <span className="text-[10px] text-theme-muted uppercase font-black tracking-widest">Deklarisano (Papir):</span>
                            <span className="text-3xl text-theme-accent font-black drop-shadow-md">{calculatedZapremina} <span className="text-lg">m³</span></span>
                        </div>

                        {/* KONTROLA DIMENZIJA PREKIDAČ */}
                        <div className="flex items-center justify-between bg-black/20 p-5 rounded-2xl border border-amber-500/30 mb-4">
                            <div>
                                <span className="text-xs text-amber-500 uppercase font-black tracking-widest">Kontrola Dimenzija</span>
                                <p className="text-[10px] text-slate-400 mt-1">Omogući unos kontrolnih mjera (Kalo)</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={form.isKontrola} onChange={e => setForm({...form, isKontrola: e.target.checked})} />
                                <div className="w-12 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                            </label>
                        </div>

                        {form.isKontrola && (
                            <div className="grid grid-cols-2 gap-4 mb-6 p-6 bg-amber-900/10 border border-amber-500/30 rounded-2xl animate-in zoom-in-95">
                                <div>
                                    <label className="text-[9px] text-amber-500 uppercase block mb-2 text-center font-black tracking-widest">Stvarna Dužina (M)</label>
                                    <input type="number" value={form.kontrolna_duzina} onChange={e => setForm({...form, kontrolna_duzina: e.target.value})} className="w-full p-4 bg-theme-panel border border-amber-500/50 rounded-xl text-amber-400 outline-none focus:border-amber-400 text-center text-lg font-black shadow-inner" placeholder="0" />
                                </div>
                                <div>
                                    <label className="text-[9px] text-amber-500 uppercase block mb-2 text-center font-black tracking-widest">Stvarni Prečnik (CM)</label>
                                    <input type="number" value={form.kontrolni_promjer} onChange={e => setForm({...form, kontrolni_promjer: e.target.value})} className="w-full p-4 bg-theme-panel border border-amber-500/50 rounded-xl text-amber-400 outline-none focus:border-amber-400 text-center text-lg font-black shadow-inner" placeholder="0" />
                                </div>
                                <div className="col-span-2 text-center mt-2 flex justify-between items-center bg-black/30 p-4 rounded-xl border border-amber-500/20 shadow-inner">
                                    <span className="text-[10px] text-theme-muted uppercase font-black tracking-widest">Stvarna Kubikaža: </span>
                                    <span className="text-amber-500 font-black text-2xl">{calculatedKontrolnaZapremina} m³</span>
                                </div>
                            </div>
                        )}

                        <button onClick={snimiTrupac} className="w-full py-6 bg-theme-accent text-white font-black rounded-2xl uppercase shadow-xl hover:opacity-90 transition-all text-sm tracking-widest">
                            ➕ DODAJ NA OTPREMNICU
                        </button>
                    </div>
                </div>
            </div>

            {/* LISTA SKENIRANIH TRUPACA */}
            {pHeader.otpremnica_broj && listaPrijema.length > 0 && (
                <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-[var(--radius-box)] border border-theme-border shadow-xl animate-in fade-in">
                    <div className="flex justify-between items-center mb-6 px-2 border-b border-theme-border pb-4">
                        <span className="text-[10px] text-theme-muted uppercase font-black tracking-widest">Lista skeniranih trupaca (Zadnji dodan na vrhu):</span>
                    </div>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto mb-4 custom-scrollbar pr-2">
                        {listaPrijema.map(t => {
                            const isKontrolisan = t.kontrolna_zapremina !== null;
                            const razlika = isKontrolisan ? (parseFloat(t.kontrolna_zapremina) - parseFloat(t.zapremina)).toFixed(2) : 0;
                            
                            return (
                                <div key={t.id} className={`flex flex-col p-5 bg-theme-panel border rounded-2xl shadow-md transition-all hover:scale-[1.01] ${isKontrolisan ? 'border-amber-500/40' : 'border-theme-border hover:border-theme-accent/50'}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="text-sm text-theme-text font-black flex items-center gap-3">
                                                <span className="text-theme-accent text-lg drop-shadow-md">{t.id}</span> 
                                                <span className="text-theme-text text-[10px] bg-theme-card px-3 py-1 rounded-lg border border-theme-border shadow-inner">Pločica: {t.broj_plocice || '-'}</span>
                                            </div>
                                            <div className="text-[10px] text-theme-muted uppercase mt-2 font-bold tracking-widest">
                                                {t.vrsta} | Klasa {t.klasa} | Papir: L:{t.duzina}m Ø:{t.promjer}cm
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end">
                                            <div className="text-2xl text-theme-text font-black drop-shadow-md">{t.zapremina} <span className="text-sm text-theme-accent">m³</span></div>
                                            <button onClick={async () => { if(window.confirm("Brisati trupac?")) { await supabase.from('trupci').delete().eq('id', t.id); loadPrijemList(); } }} className="text-[10px] text-red-400 uppercase font-black hover:text-white bg-red-900/20 hover:bg-red-600 px-4 py-1.5 rounded-lg mt-2 transition-all shadow-sm">Obriši ×</button>
                                        </div>
                                    </div>
                                    
                                    {isKontrolisan && (
                                        <div className="mt-4 pt-3 border-t border-amber-500/20 flex justify-between items-center bg-amber-900/10 p-3 rounded-xl shadow-inner">
                                            <div className="text-[10px] text-amber-500 uppercase font-black tracking-widest">
                                                Stvarno: L:{t.kontrolna_duzina}m Ø:{t.kontrolni_promjer}cm = {t.kontrolna_zapremina} m³
                                            </div>
                                            <div className={`text-sm font-black bg-theme-card px-3 py-1 rounded-lg shadow-sm ${razlika > 0 ? 'text-emerald-400' : (razlika < 0 ? 'text-red-500' : 'text-slate-400')}`}>
                                                {razlika > 0 ? '+' : ''}{razlika} m³
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            {isScanning && <ScannerOverlay onScan={(text) => { handleScanInput(text.toUpperCase()); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}