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

    const toggleVelicinaPolja = (index, listaIme) => {
        const novaLista = [...saas.ui[listaIme]];
        const trenutno = novaLista[index].span;
        novaLista[index].span = trenutno === 'col-span-1' ? 'col-span-2' : (trenutno === 'col-span-2' ? 'col-span-4' : 'col-span-1');
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
    
    // NOVO: Dodani state-ovi za kontrolne dimenzije
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
        const { data, error } = await supabase.from('trupci').select('*').eq('otpremnica_broj', pHeader.otpremnica_broj).eq('zakljucen_prijem', false);
        if (error) console.error(error);
        setListaPrijema(data || []);
    };

    const updateHeader = (key, val) => {
        const updated = { ...pHeader, [key]: val };
        if(key === 'sumarija') { updated.podruznica = ''; ucitajPodruznice(val); }
        setPHeader(updated);
        localStorage.setItem(`pr_${key}`, val);
    };

    // Obračun zapremine sa Otpremnice
    const calculatedZapremina = useMemo(() => {
        if(!form.duzina || !form.promjer) return "0.00";
        const r = parseFloat(form.promjer) / 200; 
        return (r * r * Math.PI * parseFloat(form.duzina)).toFixed(2);
    }, [form.duzina, form.promjer]);

    // Obračun KONTROLNE zapremine
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
                    // ISPRAVLJENO: Nema više pitanja "Da li želite prepisati". Sada je striktna blokada.
                    alert(`⛔ GREŠKA! QR KOD JE VEĆ ISKORIŠTEN!\n\nTrupac sa kodom ${id} već postoji u bazi!\nTrenutni status: ${existing.status ? existing.status.toUpperCase() : 'N/A'}\nOtpremnica: ${existing.otpremnica_broj || 'N/A'}\n\nUzmite i skenirajte drugu (novu) pločicu!`);
                    setScan(''); 
                }
            }, 1000); // Ubrzano na 1 sekundu
        }
    };

    const snimiTrupac = async () => {
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        if(!pHeader.otpremnica_broj || !pHeader.sumarija) return alert("Popunite Šumariju i Broj Otpremnice u Zaglavlju!");
        if(!scan || !form.duzina || !form.promjer) return alert("Skeniraj QR, unesi dužinu i prečnik.");
        if(form.isKontrola && (!form.kontrolna_duzina || !form.kontrolni_promjer)) return alert("Upalili ste Kontrolu. Unesite kontrolnu dužinu i prečnik!");
        
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
            
            // SPAŠAVANJE KONTROLNIH MJERA U BAZU
            kontrolna_duzina: form.isKontrola ? parseFloat(form.kontrolna_duzina) : null,
            kontrolni_promjer: form.isKontrola ? parseFloat(form.kontrolni_promjer) : null,
            kontrolna_zapremina: form.isKontrola ? parseFloat(calculatedKontrolnaZapremina) : null,
            
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

        // ISPRAVLJENO: Potpuni reset SVIH polja za sljedeći trupac
        setScan(''); 
        setForm({ 
            broj_plocice: '', redni_broj: '', vrsta: 'Jela', klasa: 'I', 
            duzina: '', promjer: '', isKontrola: false, kontrolna_duzina: '', kontrolni_promjer: '' 
        }); 
        
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

        if (actualId === 'sumarija') return <SmartSearchableInput value={val} onChange={setVal} list={sumarijeList} storageKey="sum_hist" />;
        if (actualId === 'podruznica') return <SmartSearchableInput value={val} onChange={setVal} list={podruzniceList} storageKey="pod_hist" />;
        if (actualId === 'prevoznik') return <SmartSearchableInput value={val} onChange={setVal} list={prevozniciList} storageKey="prev_hist" />;
        if (actualId === 'odjel') return <SmartSearchableInput value={val} onChange={setVal} list={odjeliList} storageKey="odjel_hist" />;
        
        if (actualId === 'otpremnica_datum') return (
            <div className="flex items-center gap-1 bg-[#0f172a] border border-slate-700 rounded-xl p-1 focus-within:border-indigo-500">
                <button type="button" onClick={() => setVal(shiftDateString(val, -1))} className="w-8 h-8 bg-slate-800 rounded hover:bg-indigo-600 text-white font-black shrink-0">-</button>
                <input type="date" value={val} onChange={e => setVal(e.target.value)} className="flex-1 w-full bg-transparent text-xs text-white outline-none text-center uppercase [&::-webkit-calendar-picker-indicator]:invert" />
                <button type="button" onClick={() => setVal(shiftDateString(val, 1))} className="w-8 h-8 bg-slate-800 rounded hover:bg-indigo-600 text-white font-black shrink-0">+</button>
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

    // Zbirna analitika za otpremnicu
    const { totalDeklarisano, totalStvarno, totalRazlikaM3 } = useMemo(() => {
        let dek = 0, stv = 0;
        listaPrijema.forEach(t => {
            dek += parseFloat(t.zapremina || 0);
            stv += parseFloat(t.kontrolna_zapremina || t.zapremina || 0);
        });
        return { totalDeklarisano: dek.toFixed(2), totalStvarno: stv.toFixed(2), totalRazlikaM3: (stv - dek).toFixed(2) };
    }, [listaPrijema]);

    return (
        <div className="p-4 max-w-2xl mx-auto space-y-6 font-bold">
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-indigo-500" user={user} hideMasina={true} saas={saas} />

            {pHeader.otpremnica_broj && listaPrijema.length > 0 && (
                <div className="bg-[#1e293b] p-5 rounded-[2rem] border border-indigo-500/50 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4 animate-in slide-in-from-top">
                    <div>
                        <span className="text-white text-base font-black">OTPREMNICA: {pHeader.otpremnica_broj}</span>
                        <div className="text-[10px] text-slate-400 mt-2 flex gap-4 uppercase font-black">
                            <p>Skenirano: <span className="text-indigo-400 text-sm ml-1">{listaPrijema.length} kom</span></p>
                            <p>Papir: <span className="text-white text-sm ml-1">{totalDeklarisano} m³</span></p>
                        </div>
                        {parseFloat(totalRazlikaM3) !== 0 && (
                            <div className="mt-2 text-xs uppercase font-black">
                                Stvarno stanje: <span className="text-white">{totalStvarno} m³</span> | 
                                Razlika: <span className={parseFloat(totalRazlikaM3) > 0 ? "text-emerald-400 ml-1" : "text-red-500 ml-1"}>{parseFloat(totalRazlikaM3) > 0 ? '+' : ''}{totalRazlikaM3} m³</span>
                            </div>
                        )}
                    </div>
                    <button onClick={zakljuciOtpremnicu} className="w-full md:w-auto px-6 py-4 bg-indigo-600 text-white font-black rounded-xl text-xs uppercase shadow-[0_0_20px_rgba(79,70,229,0.5)] hover:bg-indigo-500 transition-all">
                        🏁 ZAKLJUČI OTPREMNICU
                    </button>
                </div>
            )}

            <div className={`p-6 rounded-[2.5rem] shadow-xl space-y-4 transition-all ${saas.isEditMode ? 'ring-2 ring-amber-500' : ''}`} style={{ backgroundColor: saas.ui.boja_zaglavlja }}>
                <div className="text-center font-black relative mb-4">
                    {saas.isEditMode ? (
                        <input value={saas.ui.naslov_zaglavlja} onChange={e => saas.setUi({...saas.ui, naslov_zaglavlja: e.target.value})} className="w-full bg-slate-900 text-amber-400 p-2 rounded border border-amber-500/50 text-xs uppercase font-black text-center" placeholder="Naziv zaglavlja..." />
                    ) : (
                        <span className="text-[10px] text-indigo-500 uppercase tracking-widest">{saas.ui.naslov_zaglavlja}</span>
                    )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 relative">
                    {aktivnaPoljaZaglavlja.map((polje, index) => (
                        <div key={polje.id} className={`relative ${polje.span} transition-all`} style={{ zIndex: 50 - index }}>
                            {polje.label && <label className="text-[8px] text-slate-500 uppercase block mb-1 ml-2">{polje.label}</label>}
                            {renderPolje(polje, pHeader, updateHeader)}
                        </div>
                    ))}
                </div>
            </div>

            <div className={`p-6 rounded-[2.5rem] border border-indigo-500/30 shadow-2xl space-y-5 transition-all mt-4`} style={{ backgroundColor: saas.ui.boja_kartice }}>
                
                <div className="relative font-black">
                    <label className={`text-[8px] uppercase ${saas.ui.boja_teksta} block mb-1 ml-2`}>{saas.ui.naslov_skenera}</label>
                    <div className="flex bg-[#0f172a] border-2 border-indigo-500/50 rounded-2xl overflow-hidden shadow-inner">
                        <input value={scan} onChange={e => handleScanInput(e.target.value)} className="flex-1 p-5 bg-transparent text-xl text-center text-white outline-none uppercase placeholder-slate-600 w-full" placeholder="Čekam sken..." />
                        <button onClick={() => setIsScanning(true)} className="px-6 bg-indigo-600 text-white font-black hover:bg-indigo-500 transition-colors shrink-0">📷 SCAN</button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 relative">
                    {aktivnaPoljaUnosa.map((polje, index) => (
                        <div key={polje.id} className={`relative ${polje.span} transition-all`} style={{ zIndex: 50 - index }}>
                            {polje.label && <label className="text-[8px] text-slate-500 uppercase block mb-1 text-center">{polje.label}</label>}
                            {renderPolje(polje, form, (key, val) => setForm({...form, [key]: val}))}
                        </div>
                    ))}
                </div>

                <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-700">
                    <span className="text-xs text-slate-400 uppercase">Deklarisano (Papir):</span>
                    <span className="text-2xl text-indigo-400 font-black">{calculatedZapremina} m³</span>
                </div>

                {/* NOVO: KONTROLA DIMENZIJA PREKIDAČ */}
                <div className="flex items-center justify-between bg-[#0f172a] p-4 rounded-2xl border border-emerald-500/20">
                    <div>
                        <span className="text-xs text-emerald-400 uppercase font-black">Kontrola Dimenzija</span>
                        <p className="text-[9px] text-slate-500">Omogući unos kontrolnih mjera</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={form.isKontrola} onChange={e => setForm({...form, isKontrola: e.target.checked})} />
                        <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                </div>

                {form.isKontrola && (
                    <div className="grid grid-cols-2 gap-3 mt-2 p-5 bg-emerald-900/10 border border-emerald-500/30 rounded-2xl animate-in zoom-in-95">
                        <div>
                            <label className="text-[8px] text-emerald-400 uppercase block mb-1 text-center font-black">Stvarna Dužina (M)</label>
                            <input type="number" value={form.kontrolna_duzina} onChange={e => setForm({...form, kontrolna_duzina: e.target.value})} className="w-full p-4 bg-black border border-emerald-500/50 rounded-xl text-emerald-400 outline-none focus:border-emerald-400 text-center text-sm font-black shadow-inner" placeholder="0" />
                        </div>
                        <div>
                            <label className="text-[8px] text-emerald-400 uppercase block mb-1 text-center font-black">Stvarni Prečnik (CM)</label>
                            <input type="number" value={form.kontrolni_promjer} onChange={e => setForm({...form, kontrolni_promjer: e.target.value})} className="w-full p-4 bg-black border border-emerald-500/50 rounded-xl text-emerald-400 outline-none focus:border-emerald-400 text-center text-sm font-black shadow-inner" placeholder="0" />
                        </div>
                        <div className="col-span-2 text-center mt-2 flex justify-between items-center bg-slate-900 p-3 rounded-xl border border-emerald-500/20">
                            <span className="text-[10px] text-slate-400 uppercase">Stvarna Kubikaža: </span>
                            <span className="text-emerald-400 font-black text-xl">{calculatedKontrolnaZapremina} m³</span>
                        </div>
                    </div>
                )}

                <button onClick={snimiTrupac} className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl uppercase shadow-xl hover:bg-indigo-500 transition-all">➕ DODAJ NA OTPREMNICU</button>
            </div>

            {pHeader.otpremnica_broj && listaPrijema.length > 0 && (
                <div className="bg-[#1e293b] p-4 rounded-[2rem] border border-slate-700 animate-in fade-in">
                    <div className="flex justify-between items-center mb-3 px-2">
                        <span className="text-[10px] text-slate-500 uppercase">Lista skeniranih trupaca:</span>
                    </div>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto mb-4 custom-scrollbar pr-2">
                        {listaPrijema.map(t => {
                            const isKontrolisan = t.kontrolna_zapremina !== null;
                            const razlika = isKontrolisan ? (parseFloat(t.kontrolna_zapremina) - parseFloat(t.zapremina)).toFixed(2) : 0;
                            
                            return (
                                <div key={t.id} className={`flex flex-col p-4 bg-slate-900 border rounded-2xl ${isKontrolisan ? 'border-emerald-500/30' : 'border-slate-800'}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="text-sm text-white font-black flex items-center gap-2">
                                                {t.id} <span className="text-indigo-400 text-xs bg-indigo-900/30 px-2 py-0.5 rounded">P: {t.broj_plocice || '-'}</span>
                                            </div>
                                            <div className="text-[10px] text-slate-400 uppercase mt-1">
                                                {t.vrsta} | Klasa {t.klasa} | Deklarisano: L:{t.duzina}m Ø:{t.promjer}cm
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg text-white font-black">{t.zapremina} m³</div>
                                            <button onClick={async () => { if(window.confirm("Brisati trupac?")) { await supabase.from('trupci').delete().eq('id', t.id); loadPrijemList(); } }} className="text-[9px] text-red-500 uppercase hover:underline font-black bg-red-900/20 px-2 py-1 rounded mt-1">Obriši ×</button>
                                        </div>
                                    </div>
                                    
                                    {isKontrolisan && (
                                        <div className="mt-3 pt-3 border-t border-emerald-500/20 flex justify-between items-center bg-emerald-900/10 p-2 rounded-xl">
                                            <div className="text-[9px] text-emerald-400 uppercase font-black">
                                                Stvarno: L:{t.kontrolna_duzina}m Ø:{t.kontrolni_promjer}cm = {t.kontrolna_zapremina} m³
                                            </div>
                                            <div className={`text-xs font-black ${razlika > 0 ? 'text-emerald-400' : (razlika < 0 ? 'text-red-500' : 'text-slate-400')}`}>
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