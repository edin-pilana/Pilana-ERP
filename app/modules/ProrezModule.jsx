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

function SaaS_DnevnikMasine({ modul, header, user, saas, updatePolje, toggleVelicina, spremiDimenzije, handleDragStart, handleDragEnter, handleDrop }) {
    const [logovi, setLogovi] = useState([]);
    const t = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const [form, setForm] = useState({ vrijeme_od: t, vrijeme_do: '', zastoj_min: '', napomena: '' });

    useEffect(() => { loadLogove(); }, [header]);

    const loadLogove = async () => {
        if(!header || !header.datum || !header.masina) return;
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
        if(window.confirm("Obrisati ovaj zapis?")) { await supabase.from('dnevnik_masine').delete().eq('id', id); loadLogove(); }
    };

    const renderDnevnikPolje = (polje) => {
        if (polje.id === 'pocetak') return <input type="time" value={form.vrijeme_od} onChange={e => setForm({...form, vrijeme_od: e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none focus:border-theme-accent shadow-inner" />;
        if (polje.id === 'kraj') return <input type="time" value={form.vrijeme_do} onChange={e => setForm({...form, vrijeme_do: e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none focus:border-theme-accent shadow-inner" />;
        if (polje.id === 'zastoj') return <input type="number" value={form.zastoj_min} onChange={e => setForm({...form, zastoj_min: e.target.value})} placeholder="0" className="w-full h-full min-h-[45px] p-3 bg-red-900/20 rounded-xl text-xs text-red-400 font-black border border-red-500/50 outline-none shadow-inner" />;
        if (polje.id === 'napomena') return <input type="text" value={form.napomena} onChange={e => setForm({...form, napomena: e.target.value})} placeholder="Održavanje, kvar..." className="w-full h-full min-h-[45px] p-3 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none focus:border-theme-accent shadow-inner" />;
        return null;
    };

    return (
        <div className={`bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-[var(--radius-box)] border shadow-2xl space-y-4 transition-all ${saas.isEditMode ? 'ring-2 ring-amber-500 border-amber-500/50' : 'border-theme-border'}`}>
            <h3 className="text-theme-accent font-black uppercase text-xs tracking-widest">⚙️ Evidencija zastoja mašine</h3>
            <div className="grid grid-cols-2 gap-3 bg-theme-panel p-4 rounded-2xl border border-theme-border items-start shadow-inner">
                {(saas.ui.polja_dnevnik || []).map((polje, index) => (
                    <div 
                        key={polje.id} 
                        className={`relative flex flex-col ${polje.span} transition-all ${saas.isEditMode ? 'border-2 border-dashed border-amber-500 p-2 rounded-xl bg-black/20 resize overflow-auto' : ''}`} 
                        style={{ maxWidth: '100%', ...(saas.isEditMode ? { minWidth: '100px', minHeight: '80px' } : {}), width: polje.customWidth || undefined, height: polje.customHeight || undefined }}
                        draggable={saas.isEditMode} 
                        onDragStart={(e) => handleDragStart(e, index, 'polja_dnevnik')} 
                        onDragEnter={(e) => handleDragEnter(e, index)} 
                        onDragEnd={() => handleDrop('polja_dnevnik')} 
                        onDragOver={(e) => e.preventDefault()}
                        onMouseUp={(e) => spremiDimenzije(e, index, 'polja_dnevnik')}
                    >
                        {saas.isEditMode && (
                            <div className="flex justify-between items-center mb-2 shrink-0">
                                <span className="text-[9px] text-amber-500 uppercase font-black cursor-move">☰</span>
                                <button onClick={() => toggleVelicina(index, 'polja_dnevnik')} className="text-[8px] text-amber-500 font-black bg-amber-500/20 px-2 py-1 rounded">ŠIRINA: {polje.span==='col-span-4'?'100%':polje.span==='col-span-2'?'50%':'25%'}</button>
                            </div>
                        )}
                        {saas.isEditMode ? (
                            <input value={polje.label} onChange={(e) => updatePolje(index, 'label', e.target.value, 'polja_dnevnik')} className="w-full bg-theme-card text-amber-400 p-1 mb-1 rounded border border-amber-500/50 text-[8px] uppercase font-black text-center shrink-0" placeholder="Naslov polja" />
                        ) : (
                            polje.label && <label className="text-[8px] text-theme-muted uppercase ml-2 block mb-1 shrink-0">{polje.label}</label>
                        )}
                        <div className={`flex-1 ${saas.isEditMode ? 'opacity-50 pointer-events-none' : ''}`}>{renderDnevnikPolje(polje)}</div>
                    </div>
                ))}
                <button onClick={snimiZastojIliRad} className={`w-full py-4 bg-orange-600 text-white font-black rounded-xl text-[10px] uppercase shadow-lg hover:bg-orange-500 ${saas.isEditMode ? 'opacity-50 pointer-events-none col-span-2' : 'col-span-2 mt-2'}`}>➕ Dodaj Zapis u Dnevnik</button>
            </div>
            
            <div className="space-y-2 mt-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                {logovi.length === 0 && <p className="text-center text-theme-muted text-[10px] uppercase p-4 border border-dashed border-theme-border rounded-xl">Nema unesenih zastoja za danas.</p>}
                {logovi.map(l => (
                    <div key={l.id} className="flex justify-between items-center p-4 bg-theme-card border border-theme-border rounded-xl shadow-sm">
                        <div>
                            <p className="text-[10px] text-theme-muted font-black uppercase tracking-widest"><span className="text-theme-accent">{l.vrijeme_od}</span> - {l.vrijeme_do ? <span className="text-amber-400">{l.vrijeme_do}</span> : <span className="text-theme-muted">...</span>}</p>
                            <p className="text-theme-text text-sm font-bold mt-1">{l.napomena || 'Nema napomene'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {l.zastoj_min > 0 && <span className="text-red-400 text-xs font-black bg-red-900/30 px-2 py-1 rounded border border-red-500/30 shadow-inner">{l.zastoj_min} min</span>}
                            <button onClick={() => obrisiLog(l.id)} className="text-red-500 font-black hover:bg-red-500/20 p-2 rounded-lg transition-colors">✕</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function ProrezModule({ user, header, setHeader, onExit }) {
    // AUTOMATSKI ODABIR MAŠINE
    useEffect(() => {
        if (!header?.masina) {
            setHeader(prev => ({ ...prev, masina: 'PILANA' })); // Ovdje upiši TAČAN naziv mašine iz baze
        }
    }, [header?.masina]);
    const saas = useSaaS('prorez_trupaca', {
        boja_kartice: '#1e293b',
        naslov_skenera: 'SKENIRAJ TRUPAC (Ulaz u brentu)',
        boja_teksta: 'text-cyan-500',
        boja_bordera: 'border-cyan-500/50',
        polja_radnici: [
            { id: 'brentista', label: '👨‍🔧 BRENTISTA', span: 'col-span-1' },
            { id: 'viljuskarista', label: '🚜 VILJUŠKARISTA', span: 'col-span-1' }
        ],
        polja_dnevnik: [
            { id: 'pocetak', label: 'POČETAK', span: 'col-span-1' },
            { id: 'kraj', label: 'ZAVRŠETAK', span: 'col-span-1' },
            { id: 'zastoj', label: 'ZASTOJ (MIN)', span: 'col-span-2' },
            { id: 'napomena', label: 'NAPOMENA / RAZLOG', span: 'col-span-2' }
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
    
    // LOKALNA MEMORIJA KAO BACKUP (Prorez i Pilana je dijele)
    const [brentista, setBrentista] = useState(typeof window !== 'undefined' ? localStorage.getItem('pilana_brentista') || '' : '');
    const [viljuskarista, setViljuskarista] = useState(typeof window !== 'undefined' ? localStorage.getItem('pilana_viljuskarista') || '' : '');
    const [radniciList, setRadniciList] = useState([]);

    // 1. UČITAVANJE IZ BAZE PRILIKOM OTVARANJA MODULA ILI PROMJENE MAŠINE
    useEffect(() => {
        const ucitajDezurneRadnike = async () => {
            if (!header?.masina) return;
            const { data } = await supabase.from('aktivni_radnici')
                .select('radnik_ime, uloga')
                .eq('masina_naziv', header.masina)
                .is('vrijeme_odjave', null);
                
            if (data) {
                const b = data.find(r => r.uloga === 'brentista');
                const v = data.find(r => r.uloga === 'viljuskarista');
                if (b) { setBrentista(b.radnik_ime); localStorage.setItem('pilana_brentista', b.radnik_ime); }
                if (v) { setViljuskarista(v.radnik_ime); localStorage.setItem('pilana_viljuskarista', v.radnik_ime); }
            }
        };
        ucitajDezurneRadnike();
    }, [header?.masina]);

    // 2. AKCIJA KADA KORISNIK IZABERE BRENTISTU U INPUTU
    const handleBrentistaChange = async (novoIme) => {
        if (header?.masina) {
            await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('masina_naziv', header.masina).eq('uloga', 'brentista').is('vrijeme_odjave', null);
            if (novoIme) await supabase.from('aktivni_radnici').insert([{ radnik_ime: novoIme, masina_naziv: header.masina, vrijeme_prijave: new Date().toISOString(), uloga: 'brentista' }]);
            window.dispatchEvent(new Event('radnici_updated')); // OBAVIJESTI MASTER HEADER!
        }
        setBrentista(novoIme); localStorage.setItem('pilana_brentista', novoIme);
    };

    // 3. AKCIJA KADA KORISNIK IZABERE VILJUŠKARISTU U INPUTU
    const handleViljuskaristaChange = async (novoIme) => {
        if (header?.masina) {
            await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('masina_naziv', header.masina).eq('uloga', 'viljuskarista').is('vrijeme_odjave', null);
            if (novoIme) await supabase.from('aktivni_radnici').insert([{ radnik_ime: novoIme, masina_naziv: header.masina, vrijeme_prijave: new Date().toISOString(), uloga: 'viljuskarista' }]);
            window.dispatchEvent(new Event('radnici_updated')); // OBAVIJESTI MASTER HEADER!
        }
        setViljuskarista(novoIme); localStorage.setItem('pilana_viljuskarista', novoIme);
    };

    const timerRef = useRef(null);

    useEffect(() => { 
        if (header?.masina && header?.datum) loadList(); 
        supabase.from('radnici').select('ime_prezime').then(({data}) => setRadniciList(data ? data.map(r=>r.ime_prezime) : []));
    }, [header?.masina, header?.datum]);

    const loadList = async () => {
        if(!header?.masina) return;
        const { data: logData, error } = await supabase.from('prorez_log').select('*').eq('masina', header.masina).eq('datum', header.datum).eq('zakljuceno', false);
        if (error || !logData || logData.length === 0) { setList([]); return; }

        const trupacIds = logData.map(l => l.trupac_id);
        const { data: trupciData } = await supabase.from('trupci').select('*').in('id', trupacIds);

        const finalnaLista = logData.map(log => {
            const siguranLogId = String(log.trupac_id || '').trim().toUpperCase();
            const detalji = (trupciData || []).find(t => String(t.id || '').trim().toUpperCase() === siguranLogId) || {};
            return { ...log, detaljiTrupca: detalji };
        });
        
        finalnaLista.sort((a, b) => {
            if (a.vrijeme_unosa && b.vrijeme_unosa) return b.vrijeme_unosa.localeCompare(a.vrijeme_unosa);
            return 0;
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
        if (!brentista) return alert("⚠️ ZABRANJENO: Molimo unesite ko je Brentista u polje lijevo!");
        
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
        // OVERFLOW-VISIBLE DA BI ISKAČUĆI MENI RADIO NORMALNO
        if (polje.id === 'brentista') return <div className="h-full w-full min-w-0 bg-transparent text-theme-text font-black text-sm uppercase px-2 py-1 outline-none focus-within:border-theme-accent overflow-visible"><SmartSearchableInput value={brentista} onChange={handleBrentistaChange} list={radniciList} /></div>;
        if (polje.id === 'viljuskarista') return <div className="h-full w-full min-w-0 bg-transparent text-theme-text font-black text-sm uppercase px-2 py-1 outline-none focus-within:border-theme-accent overflow-visible"><SmartSearchableInput value={viljuskarista} onChange={handleViljuskaristaChange} list={radniciList} /></div>;
        return null;
    };

    if (!header?.masina) {
        return (
            <div className="p-4 max-w-2xl mx-auto space-y-6 font-bold animate-in fade-in">
                <MasterHeader header={header} setHeader={setHeader} onExit={onExit} user={user} saas={saas} />
                <div className="bg-red-900/30 border border-red-500 p-10 rounded-[var(--radius-box)] text-center shadow-2xl mt-10 backdrop-blur-[var(--glass-blur)]">
                    <span className="text-6xl block mb-4 animate-bounce">⚠️</span>
                    <h2 className="text-2xl text-red-400 font-black uppercase tracking-widest">Mašina nije odabrana!</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6 font-sans animate-in fade-in pb-24">
            
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} user={user} modulIme="prorez" saas={saas} />
            
            <div className="text-center mb-6">
                <h2 className="text-theme-accent font-black tracking-widest uppercase text-xl md:text-2xl drop-shadow-md flex items-center justify-center gap-3">
                    🪵 PROREZ - ULAZ TRUPACA U BRENTU
                </h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                <div className="lg:col-span-5 space-y-6 flex flex-col">
                    
                    <div className="p-6 rounded-[var(--radius-box)] shadow-2xl transition-all border border-theme-border bg-theme-card backdrop-blur-[var(--glass-blur)]">
                        <h3 className="text-[10px] text-theme-muted uppercase font-black tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-theme-accent"></span> Ekipa na brenti
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                            {(saas.ui.polja_radnici || []).map((polje, index) => (
                                <div key={polje.id} className="w-full relative">
                                    <label className="text-[8px] text-theme-muted uppercase ml-2 block mb-1">{polje.label}</label>
                                    <div className={`w-full h-12 bg-theme-panel border border-theme-border rounded-xl overflow-visible focus-within:border-theme-accent transition-colors shadow-inner flex items-center ${saas.isEditMode ? 'opacity-50 pointer-events-none' : ''}`}>
                                        {renderRadnikPolje(polje)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1">
                        <SaaS_DnevnikMasine 
                            modul="Prorez" header={header} user={user} saas={saas} updatePolje={updatePolje} toggleVelicina={toggleVelicinaPolja} spremiDimenzije={spremiDimenzije} handleDragStart={handleDragStart} handleDragEnter={handleDragEnter} handleDrop={handleDrop}
                        />
                    </div>
                </div>

                <div className="lg:col-span-7 space-y-6 flex flex-col">
                    
                    <div className={`p-8 rounded-[var(--radius-box)] shadow-[0_0_40px_rgba(0,0,0,0.3)] border bg-theme-card backdrop-blur-[var(--glass-blur)] relative overflow-hidden group ${saas.isEditMode ? 'border-dashed border-amber-500' : 'border-theme-accent/40'}`}>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-theme-accent to-transparent opacity-50"></div>
                        
                        <label className={`text-xs uppercase text-theme-accent block mb-4 font-black tracking-widest text-center`}>
                            {saas.ui.naslov_skenera || "SKENIRAJ TRUPAC (ULAZ U BRENTU)"}
                        </label>
                        
                        <div className={`flex bg-theme-panel border-2 rounded-2xl overflow-hidden shadow-inner focus-within:shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] transition-all h-20 ${saas.isEditMode ? 'border-amber-500/50 opacity-50 pointer-events-none' : 'border-theme-accent/50 focus-within:border-theme-accent'}`}>
                            <input value={scan} onChange={e => handleInput(e.target.value)} className="flex-1 px-6 bg-transparent text-xl md:text-2xl text-center text-theme-text outline-none uppercase font-black placeholder:text-theme-muted/30 tracking-widest" placeholder="ČEKAM SKEN..." />
                            <button onClick={() => setIsScanning(true)} className="px-8 bg-theme-accent text-white font-black hover:opacity-80 transition-colors text-2xl flex items-center justify-center shadow-lg">📷</button>
                        </div>
                    </div>

                    <div className="p-6 rounded-[var(--radius-box)] shadow-xl border border-theme-border bg-theme-card backdrop-blur-[var(--glass-blur)] flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-4 border-b border-theme-border pb-4">
                            <span className="text-[10px] text-theme-muted uppercase font-black tracking-widest">Prorezano u ovoj smjeni:</span>
                            <span className="text-theme-accent font-black text-lg bg-theme-accent/10 px-4 py-1.5 rounded-xl border border-theme-accent/30 shadow-inner">{list.length} kom</span>
                        </div>
                        
                        <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-[500px]">
                            {list.length === 0 && (
                                <div className="text-center p-10 border-2 border-dashed border-theme-border rounded-2xl text-theme-muted text-xs font-bold bg-theme-panel/50 flex items-center justify-center h-full min-h-[200px]">
                                    Skenirajte prvi trupac za ovu smjenu.
                                </div>
                            )}
                            
                            {list.map((log) => {
                                const plocica = log.broj_plocice || log.detaljiTrupca?.broj_plocice;
                                const duzina = log.duzina || log.detaljiTrupca?.duzina || '?';
                                const promjer = log.promjer || log.detaljiTrupca?.promjer || '?';
                                const vrsta = log.vrsta || log.detaljiTrupca?.vrsta || 'N/A';
                                const zapremina = log.zapremina || log.detaljiTrupca?.zapremina || '0.00';

                                return (
                                    <div key={log.id} className="p-5 bg-theme-panel border border-theme-border rounded-2xl flex flex-col justify-between items-start gap-3 shadow-md hover:border-theme-accent/50 transition-all group">
                                        <div className="w-full flex justify-between items-start border-b border-theme-border/50 pb-3 mb-1">
                                            <span className="text-2xl text-theme-accent font-black tracking-widest drop-shadow-md">
                                                {log.trupac_id}
                                            </span>
                                            {plocica ? (
                                                <span className="bg-theme-card text-theme-text px-3 py-1.5 rounded-lg text-[10px] uppercase font-black border border-theme-border shadow-inner tracking-wider">
                                                    Pl: {plocica}
                                                </span>
                                            ) : (
                                                <span className="bg-red-900/20 text-red-400 px-3 py-1.5 rounded-lg text-[10px] uppercase font-black border border-red-500/30 tracking-wider">
                                                    BEZ PLOČICE
                                                </span>
                                            )}
                                        </div>
                                        <div className="w-full flex flex-col sm:flex-row justify-between sm:items-end gap-4">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex gap-2">
                                                    <span className="bg-theme-accent/10 text-theme-accent px-3 py-1.5 rounded-xl text-sm font-black border border-theme-accent/30 shadow-inner">
                                                        L: {duzina}m
                                                    </span>
                                                    <span className="bg-theme-accent/10 text-theme-accent px-3 py-1.5 rounded-xl text-sm font-black border border-theme-accent/30 shadow-inner">
                                                        Ø: {promjer}cm
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-theme-muted font-bold uppercase tracking-widest pl-1 mt-1">
                                                    Vrsta drveta: <span className="text-theme-text ml-1">{vrsta}</span>
                                                </div>
                                            </div>
                                            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                                                <span className="text-3xl text-emerald-500 font-black leading-none drop-shadow-lg">{zapremina} <span className="text-sm text-theme-muted">m³</span></span>
                                                <button onClick={() => obrisiIzProreza(log.id, log.trupac_id)} className="text-[10px] text-red-400 font-black hover:text-white bg-red-900/20 hover:bg-red-600 px-4 py-2 rounded-xl transition-all uppercase border border-red-500/20 shadow-md">
                                                    PONIŠTI ✕
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {list.length > 0 && (
                            <div className="pt-4 mt-2 border-t border-theme-border">
                                <button onClick={async () => {
                                    if(window.confirm("ZAKLJUČITI OVU LISTU? To znači da je smjena/tura gotova.")){
                                        for(let item of list) await supabase.from('prorez_log').update({ zakljuceno: true }).eq('id', item.id);
                                        setList([]); alert("Lista uspješno zaključena i poslana u analitiku!");
                                    }
                                }} className="w-full py-5 bg-theme-accent/10 border-2 border-theme-accent text-theme-accent font-black rounded-2xl text-sm uppercase hover:bg-theme-accent hover:text-white transition-all shadow-[0_0_20px_rgba(var(--theme-accent-rgb),0.3)] tracking-widest">
                                    🏁 ZAKLJUČI SMJENU PROREZA
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {isScanning && <ScannerOverlay onScan={(text) => { obradiTrupac(text.toUpperCase()); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}