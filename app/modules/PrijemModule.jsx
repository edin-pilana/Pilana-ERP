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

// Pomoćna funkcija za pomjeranje datuma
const shiftDateString = (isoStr, days) => {
    if(!isoStr) return new Date().toISOString().split('T')[0];
    const d = new Date(isoStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
};

export default function PrijemModule({ user, header, setHeader, onExit }) {
    
    // === SaaS ALAT ===
    const saas = useSaaS('prijem_trupaca', {
        boja_zaglavlja: '#1e293b',
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

    // === Drag & Drop Logika ===
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

    const toggleVelicinaPolja = (index, listaIme) => {
        const novaLista = [...saas.ui[listaIme]];
        const trenutno = novaLista[index].span;
        novaLista[index].span = trenutno === 'col-span-1' ? 'col-span-2' : (trenutno === 'col-span-2' ? 'col-span-4' : 'col-span-1');
        saas.setUi({...saas.ui, [listaIme]: novaLista});
    };
    // ===========================

    // BAZE PODATAKA ZA PADAJUĆE MENIJE
    const [sumarijeList, setSumarijeList] = useState([]);
    const [podruzniceList, setPodruzniceList] = useState([]);
    const [prevozniciList, setPrevozniciList] = useState([]);
    const [odjeliList, setOdjeliList] = useState([]);

    useEffect(() => {
        supabase.from('sumarije').select('naziv').then(({data}) => setSumarijeList(data?data.map(d=>d.naziv):[]));
        supabase.from('prevoznici').select('naziv').then(({data}) => setPrevozniciList(data?data.map(d=>d.naziv):[]));
        
        supabase.from('trupci').select('odjel').neq('odjel', null).then(({data}) => {
            if(data) {
                const uniqueOdjeli = [...new Set(data.map(d => d.odjel).filter(Boolean))];
                setOdjeliList(uniqueOdjeli);
            }
        });
    }, []);

    const ucitajPodruznice = async (sumarijaNaziv) => {
        const {data} = await supabase.from('podruznice').select('naziv').eq('sumarija_naziv', sumarijaNaziv);
        setPodruzniceList(data?data.map(d=>d.naziv):[]);
    };

    // STATE ZA ZAGLAVLJE OTPREMNICE (Pamti se u localStorage)
    const [pHeader, setPHeader] = useState({
        sumarija: typeof window !== 'undefined' ? localStorage.getItem('pr_sumarija') || '' : '',
        podruznica: typeof window !== 'undefined' ? localStorage.getItem('pr_podruznica') || '' : '',
        prevoznik: typeof window !== 'undefined' ? localStorage.getItem('pr_prevoznik') || '' : '',
        odjel: typeof window !== 'undefined' ? localStorage.getItem('pr_odjel') || '' : '',
        otpremnica_broj: typeof window !== 'undefined' ? localStorage.getItem('pr_otpr_broj') || '' : '',
        otpremnica_datum: typeof window !== 'undefined' ? localStorage.getItem('pr_otpr_datum') || new Date().toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    });

    useEffect(() => { if(pHeader.sumarija) ucitajPodruznice(pHeader.sumarija); }, []);

    // STATE ZA TRENUTNI TRUPAC I LISTU
    const [scan, setScan] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [form, setForm] = useState({ broj_plocice: '', redni_broj: '', vrsta: 'Jela', klasa: 'I', duzina: '', promjer: '' });
    const [listaPrijema, setListaPrijema] = useState([]);
    
    const scanTimerRef = useRef(null);

    useEffect(() => { loadPrijemList(); }, [pHeader.otpremnica_broj]);

    const loadPrijemList = async () => {
        if(!pHeader.otpremnica_broj) return;
        const { data, error } = await supabase.from('trupci').select('*').eq('otpremnica_broj', pHeader.otpremnica_broj).eq('zakljucen_prijem', false);
        if (error) { alert("⚠️ GREŠKA PRI UČITAVANJU LISTE: " + error.message); console.error(error); }
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
    }, [form]);

    const handleScanInput = (val) => {
        setScan(val);
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        if (val.length >= 3) {
            scanTimerRef.current = setTimeout(async () => {
                const id = val.toUpperCase();
                const { data: existing } = await supabase.from('trupci').select('id, status, otpremnica_broj').eq('id', id).maybeSingle();
                if(existing) {
                    const confirmed = window.confirm(`⚠️ UPOZORENJE!\nTrupac sa QR kodom ${id} već postoji u bazi!\n\nTrenutni status: ${existing.status ? existing.status.toUpperCase() : 'N/A'}.\nOtpremnica: ${existing.otpremnica_broj || 'N/A'}\n\nŽelite li prepisati podatke i zadužiti ga ponovo?`);
                    if(!confirmed) { setScan(''); }
                }
            }, 2000);
        }
    };

    const snimiTrupac = async () => {
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        if(!pHeader.otpremnica_broj || !pHeader.sumarija) return alert("Popunite Šumariju i Broj Otpremnice u Zaglavlju!");
        if(!scan || !form.duzina || !form.promjer) return alert("Skeniraj QR, unesi dužinu i prečnik.");
        
        const trupacID = scan.toUpperCase();
        const trupacData = {
            id: trupacID, 
            broj_plocice: form.broj_plocice || null, 
            redni_broj: form.redni_broj || null, 
            vrsta: form.vrsta, 
            klasa: form.klasa,
            duzina: parseFloat(form.duzina), 
            promjer: parseFloat(form.promjer), 
            zapremina: parseFloat(calculatedZapremina), 
            sumarija: pHeader.sumarija,
            podruznica: pHeader.podruznica || null, 
            otpremnica_broj: pHeader.otpremnica_broj,
            otpremnica_datum: pHeader.otpremnica_datum, 
            prevoznik: pHeader.prevoznik || null,
            odjel: pHeader.odjel || null,         
            snimio_korisnik: user?.ime_prezime || 'Nepoznat', 
            datum_prijema: new Date().toISOString().split('T')[0], 
            zakljucen_prijem: false,
            status: 'na_lageru'
        };

        const { error } = await supabase.from('trupci').upsert([trupacData]);
        if (error) return alert("Baza greška: " + error.message);

        if (typeof window !== 'undefined' && window.navigator.vibrate) window.navigator.vibrate(100); 

        setScan(''); 
        setForm(f => ({ ...f, broj_plocice: '', redni_broj: '' })); 
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

    // Pomoćna funkcija za renderovanje polja
    const renderPolje = (polje, formData, setFormData) => {
        // Osiguranje za stare verzije koje su snimljene u bazu
        const actualId = polje.id === 'datum' ? 'otpremnica_datum' : (polje.id === 'broj' ? 'otpremnica_broj' : polje.id);
        const val = formData[actualId] || '';
        const setVal = (v) => setFormData(actualId, v);

        if (actualId === 'sumarija') return <SmartSearchableInput value={val} onChange={setVal} list={sumarijeList} storageKey="sum_hist" />;
        if (actualId === 'podruznica') return <SmartSearchableInput value={val} onChange={setVal} list={podruzniceList} storageKey="pod_hist" />;
        if (actualId === 'prevoznik') return <SmartSearchableInput value={val} onChange={setVal} list={prevozniciList} storageKey="prev_hist" />;
        if (actualId === 'odjel') return <SmartSearchableInput value={val} onChange={setVal} list={odjeliList} storageKey="odjel_hist" />;
        
        if (actualId === 'otpremnica_datum') return (
            <div className="flex items-center gap-1 bg-[#0f172a] border border-slate-700 rounded-xl p-1 focus-within:border-indigo-500">
                <button type="button" onClick={() => setVal(shiftDateString(val, -1))} className="w-8 h-8 bg-slate-800 rounded hover:bg-indigo-600 text-white font-black flex items-center justify-center transition-all shrink-0">-</button>
                <input type="date" value={val} onChange={e => setVal(e.target.value)} className="flex-1 w-full bg-transparent text-xs text-white outline-none text-center uppercase [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:invert" />
                <button type="button" onClick={() => setVal(shiftDateString(val, 1))} className="w-8 h-8 bg-slate-800 rounded hover:bg-indigo-600 text-white font-black flex items-center justify-center transition-all shrink-0">+</button>
            </div>
        );
        if (actualId === 'otpremnica_broj') return <input type="text" value={val} onChange={e => setVal(e.target.value.toUpperCase())} className="w-full p-3 bg-[#0f172a] border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-indigo-500" placeholder="Unesi broj..." />;
        
        if (actualId === 'plocica') return <input type="text" value={val} onChange={e => setVal(e.target.value)} className="w-full p-3 bg-[#0f172a] border border-slate-700 rounded-xl text-white outline-none focus:border-indigo-500 text-center text-xs" placeholder="12345" />;
        if (actualId === 'redni') return <input type="text" value={val} onChange={e => setVal(e.target.value)} className="w-full p-3 bg-[#0f172a] border border-slate-700 rounded-xl text-white outline-none focus:border-indigo-500 text-center text-xs" placeholder="npr. 1" />;
        if (actualId === 'vrsta') return (
            <select value={val} onChange={e => setVal(e.target.value)} className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none uppercase text-center text-xs font-bold">
                <option value="Jela">JELA</option><option value="Smrča">SMRČA</option><option value="Bukva">BUKVA</option>
            </select>
        );
        if (actualId === 'klasa') return (
            <select value={val} onChange={e => setVal(e.target.value)} className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none uppercase text-center text-xs font-bold">
                <option value="I">I</option><option value="II">II</option><option value="III">III</option><option value="L">L</option>
            </select>
        );
        if (actualId === 'duzina' || actualId === 'promjer') return <input type="number" value={val} onChange={e => setVal(e.target.value)} className="w-full p-3 bg-[#0f172a] border border-slate-700 rounded-xl text-white outline-none focus:border-indigo-500 text-center text-xs font-black" placeholder="0" />;
        
        return null;
    };

    return (
        <div className="p-4 max-w-2xl mx-auto space-y-6 font-bold">
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-indigo-500" user={user} hideMasina={true} saas={saas} />

            {pHeader.otpremnica_broj && listaPrijema.length > 0 && (
                <div className="bg-indigo-900/40 p-4 rounded-3xl border border-indigo-500 flex justify-between items-center animate-in slide-in-from-top">
                    <div>
                        <span className="text-white text-sm font-black">OTPREMNICA: {pHeader.otpremnica_broj}</span>
                        <p className="text-[10px] text-indigo-400 mt-1 uppercase">Skenirano: {listaPrijema.length} trupaca</p>
                    </div>
                    <button onClick={zakljuciOtpremnicu} className="px-6 py-4 bg-indigo-600 text-white font-black rounded-xl text-xs uppercase shadow-[0_0_20px_rgba(79,70,229,0.5)] hover:bg-indigo-500 transition-all">
                        🏁 ZAKLJUČI OTPREMNICU
                    </button>
                </div>
            )}

            {/* ZAGLAVLJE SA RIJEŠENIM Z-INDEXOM */}
            <div className={`p-6 rounded-[2.5rem] shadow-xl space-y-4 transition-all ${saas.isEditMode ? 'ring-2 ring-amber-500' : ''}`} style={{ backgroundColor: saas.ui.boja_zaglavlja }}>
                
                {saas.isEditMode && (
                    <div className="bg-black/40 p-3 rounded-xl flex gap-4 items-center mb-4 border border-amber-500/30">
                        <span className="text-[10px] text-amber-500 uppercase font-black">Boja Zaglavlja:</span>
                        <input type="color" value={saas.ui.boja_zaglavlja || '#1e293b'} onChange={e => saas.setUi({...saas.ui, boja_zaglavlja: e.target.value})} className="w-8 h-8 cursor-pointer rounded border-none bg-transparent" />
                    </div>
                )}

                <div className="text-center font-black relative mb-4">
                    {saas.isEditMode ? (
                        <input value={saas.ui.naslov_zaglavlja} onChange={e => saas.setUi({...saas.ui, naslov_zaglavlja: e.target.value})} className="w-full bg-slate-900 text-amber-400 p-2 rounded border border-amber-500/50 text-xs uppercase font-black text-center" placeholder="Naziv zaglavlja..." />
                    ) : (
                        <span className="text-[10px] text-indigo-500 uppercase tracking-widest">{saas.ui.naslov_zaglavlja}</span>
                    )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 relative">
                    {(saas.ui.polja_zaglavlje || []).map((polje, index) => (
                        <div key={polje.id} className={`relative ${polje.span} transition-all ${saas.isEditMode ? 'border-2 border-dashed border-amber-500 p-2 rounded-xl bg-black/20' : ''}`} style={{ zIndex: 50 - index }} draggable={saas.isEditMode} onDragStart={(e) => handleDragStart(e, index, 'polja_zaglavlje')} onDragEnter={(e) => handleDragEnter(e, index)} onDragEnd={() => handleDrop('polja_zaglavlje')} onDragOver={(e) => e.preventDefault()}>
                            {saas.isEditMode && (
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[9px] text-amber-500 uppercase font-black cursor-move">☰</span>
                                    <button onClick={() => toggleVelicinaPolja(index, 'polja_zaglavlje')} className="text-[8px] text-amber-500 font-black">ŠIRINA: {polje.span==='col-span-4'?'100%':polje.span==='col-span-2'?'50%':'25%'}</button>
                                </div>
                            )}
                            {saas.isEditMode ? (
                                <input value={polje.label} onChange={(e) => updatePolje(index, 'label', e.target.value, 'polja_zaglavlje')} className="w-full bg-slate-900 text-amber-400 p-1 mb-1 rounded border border-amber-500/50 text-[8px] uppercase font-black text-center" placeholder="Ostavite prazno za bez naslova" />
                            ) : (
                                polje.label && <label className="text-[8px] text-slate-500 uppercase block mb-1 ml-2">{polje.label}</label>
                            )}
                            <div className={saas.isEditMode ? 'opacity-50 pointer-events-none' : ''}>
                                {renderPolje(polje, pHeader, updateHeader)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* DONJA KARTICA SA POPRAVLJENIM SCAN DUGMETOM */}
            <div className={`p-6 rounded-[2.5rem] border border-indigo-500/30 shadow-2xl space-y-5 transition-all mt-4 ${saas.isEditMode ? 'ring-2 ring-amber-500' : ''}`} style={{ backgroundColor: saas.ui.boja_kartice }}>
                
                {saas.isEditMode && (
                    <div className="bg-black/40 p-3 rounded-xl flex gap-4 items-center mb-4 border border-amber-500/30">
                        <span className="text-[10px] text-amber-500 uppercase font-black">Boja Kartice:</span>
                        <input type="color" value={saas.ui.boja_kartice || '#1e293b'} onChange={e => saas.setUi({...saas.ui, boja_kartice: e.target.value})} className="w-8 h-8 cursor-pointer rounded border-none bg-transparent" />
                    </div>
                )}

                <div className="relative font-black">
                    {saas.isEditMode ? (
                        <input value={saas.ui.naslov_skenera} onChange={e => saas.setUi({...saas.ui, naslov_skenera: e.target.value})} className="w-full bg-slate-900 text-amber-400 p-2 mb-2 rounded border border-amber-500/50 text-[10px] uppercase font-black" placeholder="Naslov iznad skenera..." />
                    ) : (
                        <label className={`text-[8px] uppercase ${saas.ui.boja_teksta} block mb-1 ml-2`}>{saas.ui.naslov_skenera}</label>
                    )}
                    
                    <div className={`flex bg-[#0f172a] border-2 border-indigo-500/50 rounded-2xl overflow-hidden shadow-inner ${saas.isEditMode ? 'opacity-50 pointer-events-none' : ''}`}>
                        <input value={scan} onChange={e => handleScanInput(e.target.value)} className="flex-1 p-5 bg-transparent text-xl text-center text-white outline-none uppercase placeholder-slate-600 w-full" placeholder="Čekam sken..." />
                        <button onClick={() => setIsScanning(true)} className="px-6 bg-indigo-600 text-white font-black hover:bg-indigo-500 transition-colors shrink-0">📷 SCAN</button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 relative">
                    {(saas.ui.polja_unos || []).map((polje, index) => (
                        <div key={polje.id} className={`relative ${polje.span} transition-all ${saas.isEditMode ? 'border-2 border-dashed border-amber-500 p-2 rounded-xl bg-black/20' : ''}`} style={{ zIndex: 50 - index }} draggable={saas.isEditMode} onDragStart={(e) => handleDragStart(e, index, 'polja_unos')} onDragEnter={(e) => handleDragEnter(e, index)} onDragEnd={() => handleDrop('polja_unos')} onDragOver={(e) => e.preventDefault()}>
                            {saas.isEditMode && (
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[9px] text-amber-500 uppercase font-black cursor-move">☰</span>
                                    <button onClick={() => toggleVelicinaPolja(index, 'polja_unos')} className="text-[8px] text-amber-500 font-black">ŠIRINA: {polje.span==='col-span-4'?'100%':polje.span==='col-span-2'?'50%':'25%'}</button>
                                </div>
                            )}
                            {saas.isEditMode ? (
                                <input value={polje.label} onChange={(e) => updatePolje(index, 'label', e.target.value, 'polja_unos')} className="w-full bg-slate-900 text-amber-400 p-1 mb-1 rounded border border-amber-500/50 text-[8px] uppercase font-black text-center" placeholder="Ostavite prazno za bez naslova" />
                            ) : (
                                polje.label && <label className="text-[8px] text-slate-500 uppercase block mb-1 text-center">{polje.label}</label>
                            )}
                            <div className={saas.isEditMode ? 'opacity-50 pointer-events-none' : ''}>
                                {renderPolje(polje, form, (key, val) => setForm({...form, [key]: val}))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-700">
                    <span className="text-xs text-slate-400 uppercase">Kubikaža:</span>
                    <span className="text-2xl text-indigo-400 font-black">{calculatedZapremina} m³</span>
                </div>

                <button onClick={snimiTrupac} className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl uppercase shadow-xl hover:bg-indigo-500 transition-all">➕ DODAJ NA OTPREMNICU</button>
            </div>

            {pHeader.otpremnica_broj && listaPrijema.length > 0 && (
                <div className="bg-[#1e293b] p-4 rounded-[2rem] border border-slate-700 animate-in fade-in">
                    <div className="flex justify-between items-center mb-3 px-2">
                        <span className="text-[10px] text-slate-500 uppercase">Lista trupaca:</span>
                        <span className="text-indigo-400 font-black">{listaPrijema.length} kom</span>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto mb-4 scrollbar-hide">
                        {listaPrijema.map(t => (
                            <div key={t.id} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-xl">
                                <div>
                                    <div className="text-xs text-white font-black">{t.id} <span className="text-indigo-400 ml-1">[{t.broj_plocice}]</span></div>
                                    <div className="text-[9px] text-slate-500 uppercase">{t.vrsta} | Klasa {t.klasa} | L:{t.duzina}m Ø:{t.promjer}cm</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-white font-black">{t.zapremina} m³</div>
                                    <button onClick={async () => { if(window.confirm("Brisati trupac?")) { await supabase.from('trupci').delete().eq('id', t.id); loadPrijemList(); } }} className="text-[9px] text-red-500 uppercase hover:underline">Obriši ×</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {isScanning && <ScannerOverlay onScan={(text) => { handleScanInput(text.toUpperCase()); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}