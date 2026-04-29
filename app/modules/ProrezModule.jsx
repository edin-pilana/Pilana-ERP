"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import SmartSearchableInput from '../components/SmartSearchableInput';
import ScannerOverlay from '../components/ScannerOverlay';
import { useSaaS } from '../utils/useSaaS';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function DnevnikMasine({ modul, header, user, isEditMode, saasPolja, updatePolje, toggleVelicina }) {
    const [logovi, setLogovi] = useState([]);
    const [form, setForm] = useState({ vrijeme_od: '', vrijeme_do: '', zastoj_min: '', napomena: '' });

    useEffect(() => { 
        setForm(f => ({ ...f, vrijeme_od: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) }));
        if (header?.datum && header?.masina) {
            loadLogove(); 
        }
    }, [header?.datum, header?.masina]);

    const loadLogove = async () => {
        if(!header?.datum || !header?.masina) return;
        const { data } = await supabase.from('dnevnik_masine').select('*').eq('datum', header.datum).eq('masina', header.masina).eq('modul', modul).order('vrijeme_od', { ascending: false });
        if (data) setLogovi(data);
    };

    const snimiZastojIliRad = async () => {
        if (!form.vrijeme_od) return alert("Vrijeme početka je obavezno!");
        const payload = {
            datum: header.datum, masina: header.masina, modul: modul,
            vrijeme_od: form.vrijeme_od, vrijeme_do: form.vrijeme_do || null,
            zastoj_min: parseInt(form.zastoj_min) || 0, napomena: form.napomena, snimio: user?.ime_prezime || 'Nepoznat'
        };
        const { error } = await supabase.from('dnevnik_masine').insert([payload]);
        if (error) return alert("Greška: " + error.message);
        setForm({ vrijeme_od: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), vrijeme_do: '', zastoj_min: '', napomena: '' });
        loadLogove();
    };

    const obrisiLog = async (id) => {
        if(window.confirm("Obrisati ovaj zapis?")) {
            await supabase.from('dnevnik_masine').delete().eq('id', id);
            loadLogove();
        }
    };

    const spremiDimenzijeDnevnik = (e, index) => {
        if (!isEditMode) return;
        const w = e.currentTarget.style.width;
        const h = e.currentTarget.style.height;
        if (w) updatePolje(index, 'customWidth', w, 'polja_dnevnik');
        if (h) updatePolje(index, 'customHeight', h, 'polja_dnevnik');
    };

    const renderDnevnikPolje = (polje) => {
        if (polje.id === 'pocetak') return <input type="time" value={form.vrijeme_od} onChange={e => setForm({...form, vrijeme_od: e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-amber-500" />;
        if (polje.id === 'kraj') return <input type="time" value={form.vrijeme_do} onChange={e => setForm({...form, vrijeme_do: e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-amber-500" />;
        if (polje.id === 'zastoj') return <input type="number" value={form.zastoj_min} onChange={e => setForm({...form, zastoj_min: e.target.value})} placeholder="0" className="w-full h-full min-h-[45px] p-3 bg-red-900/20 rounded-xl text-xs text-red-400 font-black border border-red-500/50 outline-none" />;
        if (polje.id === 'napomena') return <input type="text" value={form.napomena} onChange={e => setForm({...form, napomena: e.target.value})} placeholder="Održavanje, kvar..." className="w-full h-full min-h-[45px] p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-amber-500" />;
        return null;
    };

    return (
        <div className={`bg-[#1e293b] p-4 md:p-6 rounded-[2.5rem] border shadow-2xl space-y-4 mt-6 transition-all ${isEditMode ? 'ring-2 ring-amber-500 border-amber-500/50' : 'border-slate-700'}`}>
            <h3 className="text-amber-500 font-black uppercase text-xs">⚙️ EVIDENCIJA RADA I ZASTOJA MAŠINE</h3>
            <div className="flex flex-col md:flex-row gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800 items-start">
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                    {(saasPolja || []).map((polje, index) => (
                        <div 
                            key={polje.id} 
                            className={`relative flex flex-col ${polje.span} transition-all ${isEditMode ? 'border-2 border-dashed border-amber-500 p-2 rounded-xl bg-black/20 resize overflow-auto' : ''}`} 
                            style={{
                                maxWidth: '100%',
                                ...(isEditMode ? { minWidth: '100px', minHeight: '80px' } : {}),
                                width: polje.customWidth || undefined,
                                height: polje.customHeight || undefined
                            }}
                            onMouseUp={(e) => spremiDimenzijeDnevnik(e, index)}
                        >
                            {isEditMode && (
                                <div className="flex justify-between items-center mb-2 shrink-0">
                                    <span className="text-[9px] text-amber-500 uppercase font-black">☰</span>
                                    <button onClick={() => toggleVelicina(index, 'polja_dnevnik')} className="text-[8px] text-amber-500 font-black bg-amber-500/20 px-2 py-1 rounded">ŠIRINA: {polje.span==='col-span-4'?'100%':polje.span==='col-span-2'?'50%':'25%'}</button>
                                </div>
                            )}
                            {isEditMode ? (
                                <input value={polje.label} onChange={(e) => updatePolje(index, 'label', e.target.value, 'polja_dnevnik')} className="w-full bg-slate-900 text-amber-400 p-1 mb-1 rounded border border-amber-500/50 text-[8px] uppercase font-black text-center shrink-0" placeholder="Ostavite prazno za bez naslova" />
                            ) : (
                                polje.label && <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1 shrink-0">{polje.label}</label>
                            )}
                            <div className={`flex-1 ${isEditMode ? 'opacity-50 pointer-events-none' : ''}`}>
                                {renderDnevnikPolje(polje)}
                            </div>
                        </div>
                    ))}
                </div>
                
                <button onClick={snimiZastojIliRad} className={`w-full md:w-auto h-full min-h-[45px] px-6 bg-amber-600 text-white font-black rounded-xl text-[10px] uppercase shadow-lg hover:bg-amber-500 shrink-0 ${isEditMode ? 'opacity-50 pointer-events-none mt-4 md:mt-0' : 'mt-4 md:mt-0'}`}>➕ Dodaj</button>
            </div>
            
            <div className="space-y-2 mt-4">
                {logovi.length === 0 && <p className="text-center text-slate-500 text-[10px] uppercase">Nema unesenih zastoja za danas.</p>}
                {logovi.map(l => (
                    <div key={l.id} className="flex justify-between items-center p-3 bg-slate-800 border border-slate-700 rounded-xl">
                        <div>
                            <p className="text-[10px] text-slate-400 font-black">
                                <span className="text-emerald-400">{l.vrijeme_od}</span> - {l.vrijeme_do ? <span className="text-amber-400">{l.vrijeme_do}</span> : <span className="text-slate-500">...</span>}
                            </p>
                            <p className="text-white text-xs font-bold mt-1">{l.napomena || 'Nema napomene'}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            {l.zastoj_min > 0 && <span className="text-red-400 text-xs font-black bg-red-900/30 px-2 py-1 rounded border border-red-500/30">Zastoj: {l.zastoj_min} min</span>}
                            <button onClick={() => obrisiLog(l.id)} className="text-red-500 font-black hover:bg-slate-700 p-2 rounded">✕</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function ProrezModule({ user, header, setHeader, onExit }) {
    const saas = useSaaS('prorez_trupaca', {
        boja_zaglavlja: '#1e293b',
        boja_kartice: '#1e293b',
        naslov_skenera: 'SKENIRAJ TRUPAC (Ulaz u brentu)',
        boja_teksta: 'text-cyan-500',
        boja_bordera: 'border-cyan-500/50',
        polja_radnici: [
            { id: 'brentista', label: '👨‍🔧 BRENTISTA', span: 'col-span-2' },
            { id: 'viljuskarista', label: '🚜 VILJUŠKARISTA', span: 'col-span-2' }
        ],
        polja_dnevnik: [
            { id: 'pocetak', label: 'POČETAK', span: 'col-span-1' },
            { id: 'kraj', label: 'ZAVRŠETAK', span: 'col-span-1' },
            { id: 'zastoj', label: 'ZASTOJ (MIN)', span: 'col-span-1' },
            { id: 'napomena', label: 'NAPOMENA / RAZLOG', span: 'col-span-1' }
        ]
    });

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

    const spremiDimenzije = (e, index, listaIme) => {
        if (!saas.isEditMode) return;
        const w = e.currentTarget.style.width;
        const h = e.currentTarget.style.height;
        if (w || h) {
            const novaLista = [...saas.ui[listaIme]];
            if (w) novaLista[index].customWidth = w;
            if (h) novaLista[index].customHeight = h;
            saas.setUi({...saas.ui, [listaIme]: novaLista});
        }
    };

    const [scan, setScan] = useState('');
    const [list, setList] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    
    // FIX: Hydration safe state za localStorage
    const [brentista, setBrentista] = useState('');
    const [viljuskarista, setViljuskarista] = useState('');
    const [radniciList, setRadniciList] = useState([]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setBrentista(localStorage.getItem('shared_brentista') || '');
            setViljuskarista(localStorage.getItem('shared_viljuskarista') || '');
        }
    }, []);

    const handleBrentistaChange = async (novoIme) => {
        const staroIme = localStorage.getItem('shared_brentista');
        if (staroIme && staroIme !== novoIme && header?.masina) {
            await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('radnik_ime', staroIme).eq('masina_naziv', header.masina).is('vrijeme_odjave', null);
        }
        if (novoIme && header?.masina) {
            await supabase.from('aktivni_radnici').insert([{ radnik_ime: novoIme, masina_naziv: header.masina, vrijeme_prijave: new Date().toISOString(), uloga: 'brentista' }]);
        }
        setBrentista(novoIme); localStorage.setItem('shared_brentista', novoIme);
    };

    const handleViljuskaristaChange = async (novoIme) => {
        const staroIme = localStorage.getItem('shared_viljuskarista');
        if (staroIme && staroIme !== novoIme && header?.masina) {
            await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('radnik_ime', staroIme).eq('masina_naziv', header.masina).is('vrijeme_odjave', null);
        }
        if (novoIme && header?.masina) {
            await supabase.from('aktivni_radnici').insert([{ radnik_ime: novoIme, masina_naziv: header.masina, vrijeme_prijave: new Date().toISOString(), uloga: 'viljuskarista' }]);
        }
        setViljuskarista(novoIme); localStorage.setItem('shared_viljuskarista', novoIme);
    };

    const timerRef = useRef(null);

    useEffect(() => { 
        if (header?.masina && header?.datum) {
            loadList(); 
        }
        supabase.from('radnici').select('ime_prezime').then(({data}) => setRadniciList(data ? data.map(r=>r.ime_prezime) : []));
    }, [header?.masina, header?.datum]);

    const loadList = async () => {
        if(!header?.masina) return;
        const { data: logData } = await supabase.from('prorez_log').select('*').eq('masina', header.masina).eq('datum', header.datum).eq('zakljuceno', false).order('created_at', { ascending: false });
        if (!logData || logData.length === 0) { setList([]); return; }

        const trupacIds = logData.map(l => l.trupac_id);
        const { data: trupciData } = await supabase.from('trupci').select('*').in('id', trupacIds);

        const finalnaLista = logData.map(log => {
            const detalji = (trupciData || []).find(t => t.id === log.trupac_id) || {};
            return { ...log, detaljiTrupca: detalji };
        });
        setList(finalnaLista);
    };

    const handleInput = (val) => {
        setScan(val);
        if (timerRef.current) clearTimeout(timerRef.current);
        if (val.length >= 3) timerRef.current = setTimeout(() => obradiTrupac(val.toUpperCase()), 1500);
    };

    const obradiTrupac = async (trupacId) => {
        if (!header?.masina) return alert("Odaberi mašinu u zaglavlju!");
        if (!brentista) return alert("Molimo unesite ko je Brentista!");
        
        const { data: trupac } = await supabase.from('trupci').select('*').eq('id', trupacId).maybeSingle();
        if (!trupac) { alert(`❌ TRUPAC ${trupacId} NE POSTOJI NA LAGERU!`); setScan(''); return; }
        if (trupac.status === 'prorezan') { alert(`⚠️ TRUPAC ${trupacId} JE VEĆ PROREZAN!`); setScan(''); return; }

        const logEntry = {
            trupac_id: trupacId, masina: header.masina, korisnik: user?.ime_prezime || 'Nepoznat',
            brentista: brentista, viljuskarista: viljuskarista, mjesto: header.mjesto, datum: header.datum,
            zakljuceno: false, vrijeme_unosa: new Date().toLocaleTimeString('de-DE')
        };

        const { error: logError } = await supabase.from('prorez_log').insert([logEntry]);
        if (logError) return alert("Greška pri upisu u bazu: " + logError.message);

        await supabase.from('trupci').update({ status: 'prorezan' }).eq('id', trupacId);
        if (typeof window !== 'undefined' && window.navigator.vibrate) window.navigator.vibrate([100, 50, 100]); 
        setScan(''); await loadList(); 
    };

    const obrisiIzProreza = async (logId, trupacId) => {
        if(window.confirm(`Vratiti trupac ${trupacId} nazad na lager?`)) {
            await supabase.from('trupci').update({ status: 'na_lageru' }).eq('id', trupacId);
            await supabase.from('prorez_log').delete().eq('id', logId);
            await loadList();
        }
    };

    const renderRadnikPolje = (polje) => {
        if (polje.id === 'brentista') return <div className="h-full w-full min-h-[45px]"><SmartSearchableInput value={brentista} onChange={handleBrentistaChange} list={radniciList} /></div>;
        if (polje.id === 'viljuskarista') return <div className="h-full w-full min-h-[45px]"><SmartSearchableInput value={viljuskarista} onChange={handleViljuskaristaChange} list={radniciList} /></div>;
        return null;
    };

    return (
        <div className="p-2 md:p-4 max-w-2xl mx-auto space-y-6 animate-in fade-in font-bold">
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-cyan-500" user={user} modulIme="prorez" hideWorkers={true} saas={saas} />
            
            <div className={`p-4 md:p-6 rounded-[2.5rem] shadow-2xl space-y-6 transition-all ${saas.isEditMode ? 'ring-2 ring-amber-500' : ''}`} style={{ backgroundColor: saas.ui?.boja_kartice || '#1e293b', borderColor: saas.isEditMode ? '' : (saas.ui?.boja_bordera || ''), borderWidth: saas.isEditMode ? '0' : '1px' }}>
                
                {saas.isEditMode && (
                    <div className="bg-black/40 p-3 rounded-xl flex flex-wrap gap-4 items-center mb-4 border border-amber-500/30">
                        <label className="text-[10px] text-amber-500 uppercase font-black flex items-center gap-2">Boja Kartice: <input type="color" value={saas.ui.boja_kartice || '#1e293b'} onChange={e => saas.setUi({...saas.ui, boja_kartice: e.target.value})} className="w-8 h-8 cursor-pointer rounded border-none bg-transparent" /></label>
                        <label className="text-[10px] text-amber-500 uppercase font-black flex items-center gap-2">Tekst SKENER: <input type="text" value={saas.ui.boja_teksta || 'text-cyan-500'} onChange={e => saas.setUi({...saas.ui, boja_teksta: e.target.value})} className="w-32 p-1 bg-slate-900 border border-slate-700 rounded text-white font-mono" placeholder="text-cyan-500" /></label>
                        <label className="text-[10px] text-amber-500 uppercase font-black flex items-center gap-2">Okvir SKENER: <input type="text" value={saas.ui.boja_bordera || 'border-cyan-500/50'} onChange={e => saas.setUi({...saas.ui, boja_bordera: e.target.value})} className="w-32 p-1 bg-slate-900 border border-slate-700 rounded text-white font-mono" placeholder="border-cyan-500/50" /></label>
                    </div>
                )}

                <div className="flex flex-col md:flex-row gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-700 mb-4 items-start md:items-end w-full">
                    {(saas.ui?.polja_radnici || []).map((polje, index) => (
                        <div 
                            key={polje.id} 
                            className={`relative flex flex-col w-full flex-1 transition-all ${saas.isEditMode ? 'border-2 border-dashed border-amber-500 p-2 rounded-xl bg-black/20 resize overflow-auto' : ''}`} 
                            style={{
                                ...(saas.isEditMode ? { minWidth: '100px', minHeight: '80px' } : {}),
                                width: polje.customWidth || undefined,
                                height: polje.customHeight || undefined
                            }}
                            draggable={saas.isEditMode} 
                            onDragStart={(e) => handleDragStart(e, index, 'polja_radnici')} 
                            onDragEnter={(e) => handleDragEnter(e, index)} 
                            onDragEnd={() => handleDrop('polja_radnici')} 
                            onDragOver={(e) => e.preventDefault()}
                            onMouseUp={(e) => spremiDimenzije(e, index, 'polja_radnici')}
                        >
                            {saas.isEditMode && (
                                <div className="flex justify-between items-center mb-2 shrink-0">
                                    <span className="text-[9px] text-amber-500 uppercase font-black cursor-move">☰</span>
                                </div>
                            )}
                            {saas.isEditMode ? (
                                <input value={polje.label} onChange={(e) => updatePolje(index, 'label', e.target.value, 'polja_radnici')} className="w-full bg-slate-900 text-amber-400 p-1 mb-1 rounded border border-amber-500/50 text-[8px] uppercase font-black text-center shrink-0" placeholder="Ostavite prazno za bez naslova" />
                            ) : (
                                polje.label && <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1 shrink-0">{polje.label}</label>
                            )}
                            <div className={`w-full ${saas.isEditMode ? 'opacity-50 pointer-events-none' : ''}`}>
                                {renderRadnikPolje(polje)}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="relative font-black w-full">
                    {saas.isEditMode ? (
                        <input value={saas.ui?.naslov_skenera || ''} onChange={e => saas.setUi({...saas.ui, naslov_skenera: e.target.value})} className="w-full bg-slate-900 text-amber-400 p-2 mb-2 rounded border border-amber-500/50 text-[10px] uppercase font-black" placeholder="Naslov iznad skenera..." />
                    ) : (
                        <label className={`text-[10px] uppercase ${saas.ui?.boja_teksta || ''} block mb-2 tracking-widest ml-2`}>{saas.ui?.naslov_skenera || ''}</label>
                    )}
                    
                    <div className={`flex flex-row bg-[#0f172a] border-2 rounded-2xl overflow-hidden shadow-inner w-full ${saas.isEditMode ? 'opacity-50 pointer-events-none border-dashed border-amber-500/50' : (saas.ui?.boja_bordera || '')}`}>
                        <input value={scan} onChange={e => handleInput(e.target.value)} className="w-full min-w-0 p-4 md:p-5 bg-transparent text-lg md:text-xl text-center text-white outline-none uppercase font-black placeholder-slate-600" placeholder="Čekam sken..." />
                        <button onClick={() => setIsScanning(true)} className="px-4 md:px-6 py-4 bg-cyan-600 text-white font-black hover:bg-cyan-500 transition-colors shrink-0 text-xl flex items-center justify-center gap-2">📷 <span className="hidden md:inline">SCAN</span></button>
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] text-slate-500 uppercase font-black">Prorezano u ovoj smjeni:</span>
                        <span className="text-cyan-500 font-black text-lg bg-cyan-900/20 px-3 py-1 rounded-xl border border-cyan-500/30">{list.length} kom</span>
                    </div>
                    
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {list.length === 0 && <p className="text-center text-slate-600 text-xs font-bold border-2 border-dashed border-slate-700 p-6 rounded-2xl">Skenirajte prvi trupac za ovu smjenu.</p>}
                        
                        {list.map((log) => {
                            const plocica = log.broj_plocice || log.detaljiTrupca?.broj_plocice;
                            const duzina = log.duzina || log.detaljiTrupca?.duzina || '?';
                            const promjer = log.promjer || log.detaljiTrupca?.promjer || '?';
                            const vrsta = log.vrsta || log.detaljiTrupca?.vrsta || 'N/A';
                            const zapremina = log.zapremina || log.detaljiTrupca?.zapremina || '0.00';

                            return (
                                <div key={log.id} className="p-4 md:p-5 bg-[#0f172a] border border-slate-700 rounded-3xl flex flex-col justify-between items-start gap-3 shadow-lg hover:border-cyan-500/50 transition-all">
                                    
                                    <div className="w-full flex justify-between items-start border-b border-slate-800 pb-3 mb-1">
                                        <span className="text-2xl text-cyan-400 font-black tracking-widest drop-shadow-md">
                                            {log.trupac_id}
                                        </span>
                                        {plocica ? (
                                            <span className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-[10px] uppercase font-black border border-slate-600 tracking-wider">
                                                Pl: {plocica}
                                            </span>
                                        ) : (
                                            <span className="bg-red-900/20 text-red-400 px-3 py-1.5 rounded-lg text-[10px] uppercase font-black border border-red-500/30 tracking-wider">
                                                BEZ PLOČICE
                                            </span>
                                        )}
                                    </div>

                                    <div className="w-full flex flex-row justify-between items-end gap-2">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex gap-2">
                                                <span className="bg-cyan-900/40 text-cyan-300 px-3 py-1.5 rounded-xl text-sm font-black border border-cyan-500/50 shadow-inner">
                                                    L: {duzina}m
                                                </span>
                                                <span className="bg-cyan-900/40 text-cyan-300 px-3 py-1.5 rounded-xl text-sm font-black border border-cyan-500/50 shadow-inner">
                                                    Ø: {promjer}cm
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest pl-1 mt-1">
                                                Vrsta drveta: <span className="text-slate-300 ml-1">{vrsta}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-2">
                                            <span className="text-2xl text-emerald-400 font-black leading-none">{zapremina} <span className="text-xs text-emerald-500/50">m³</span></span>
                                            <button onClick={() => obrisiIzProreza(log.id, log.trupac_id)} className="text-[10px] text-red-500 font-black hover:text-white bg-red-900/20 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-all uppercase border border-red-500/20 shadow-md">
                                                PONIŠTI ✕
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {list.length > 0 && (
                        <button onClick={async () => {
                            if(window.confirm("ZAKLJUČITI OVU LISTU? To znači da je smjena/tura gotova.")){
                                for(let item of list) await supabase.from('prorez_log').update({ zakljuceno: true }).eq('id', item.id);
                                setList([]); alert("Lista uspješno zaključena i poslana u analitiku!");
                            }
                        }} className="w-full mt-6 py-5 bg-cyan-900/30 border-2 border-cyan-500 text-cyan-400 font-black rounded-2xl text-sm uppercase hover:bg-cyan-600 hover:text-white transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] tracking-widest">🏁 ZAKLJUČI SMJENU PROREZA</button>
                    )}
                </div>
            </div>
            
            <DnevnikMasine modul="Prorez" header={header} user={user} isEditMode={saas.isEditMode} saasPolja={saas.ui?.polja_dnevnik || []} updatePolje={updatePolje} toggleVelicina={toggleVelicinaPolja} />
            
            {isScanning && <ScannerOverlay onScan={(text) => { obradiTrupac(text.toUpperCase()); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}