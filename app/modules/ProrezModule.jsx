"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import MasterSearch from '../components/MasterSearch';
import PametniDialog from '../components/PametniDialog';
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
        const payload = { datum: header.datum, masina: header.masina, modul: modul, vrijeme_od: form.vrijeme_od, vrijeme_do: form.vrijeme_do || null, zastoj_min: parseInt(form.zastoj_min) || 0, napomena: form.napomena, snimio: user.ime_prezime };
        await supabase.from('dnevnik_masine').insert([payload]);
        setForm({ vrijeme_od: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), vrijeme_do: '', zastoj_min: '', napomena: '' });
        loadLogove();
    };

    const obrisiLog = async (id) => { if(window.confirm("Obrisati ovaj zapis?")) { await supabase.from('dnevnik_masine').delete().eq('id', id); loadLogove(); } };

    const renderDnevnikPolje = (polje) => {
        if (polje.id === 'pocetak') return <input type="time" value={form.vrijeme_od} onChange={e => setForm({...form, vrijeme_od: e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none focus:border-red-500" />;
        if (polje.id === 'kraj') return <input type="time" value={form.vrijeme_do} onChange={e => setForm({...form, vrijeme_do: e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none focus:border-red-500" />;
        if (polje.id === 'zastoj') return <input type="number" value={form.zastoj_min} onChange={e => setForm({...form, zastoj_min: e.target.value})} placeholder="0" className="w-full h-full min-h-[45px] p-3 bg-red-900/20 rounded-xl text-xs text-red-400 font-black border border-red-500/50 outline-none" />;
        if (polje.id === 'napomena') return <input type="text" value={form.napomena} onChange={e => setForm({...form, napomena: e.target.value})} placeholder="Održavanje, kvar..." className="w-full h-full min-h-[45px] p-3 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none focus:border-red-500" />;
        return null;
    };

    return (
        <div className={`bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-[2.5rem] border shadow-2xl space-y-4 transition-all ${saas.isEditMode ? 'ring-2 ring-amber-500 border-amber-500/50' : 'border-theme-border'}`}>
            <h3 className="text-red-500 font-black uppercase text-xs">⚙️ EVIDENCIJA RADA I ZASTOJA MAŠINE</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-theme-panel p-4 rounded-2xl border border-red-500/20 items-start shadow-inner">
                {(saas.ui.polja_dnevnik || []).map((polje, index) => (
                    <div key={polje.id} className={`relative flex flex-col ${polje.span} transition-all ${saas.isEditMode ? 'border-2 border-dashed border-amber-500 p-2 rounded-xl bg-black/20 resize overflow-auto' : ''}`} style={{ maxWidth: '100%', ...(saas.isEditMode ? { minWidth: '100px', minHeight: '80px' } : {}), width: polje.customWidth || undefined, height: polje.customHeight || undefined }} draggable={saas.isEditMode} onDragStart={(e) => handleDragStart(e, index, 'polja_dnevnik')} onDragEnter={(e) => handleDragEnter(e, index)} onDragEnd={() => handleDrop('polja_dnevnik')} onDragOver={(e) => e.preventDefault()} onMouseUp={(e) => spremiDimenzije(e, index, 'polja_dnevnik')}>
                        {saas.isEditMode && (<div className="flex justify-between items-center mb-2 shrink-0"><span className="text-[9px] text-amber-500 uppercase font-black cursor-move">☰</span><button onClick={() => toggleVelicina(index, 'polja_dnevnik')} className="text-[8px] text-amber-500 font-black bg-amber-500/20 px-2 py-1 rounded">ŠIRINA: {polje.span==='col-span-4'?'100%':polje.span==='col-span-2'?'50%':'25%'}</button></div>)}
                        {saas.isEditMode ? (<input value={polje.label} onChange={(e) => updatePolje(index, 'label', e.target.value, 'polja_dnevnik')} className="w-full bg-theme-card text-amber-400 p-1 mb-1 rounded border border-amber-500/50 text-[8px] uppercase font-black text-center shrink-0" placeholder="Ostavite prazno za bez naslova" />) : (polje.label && <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1 shrink-0">{polje.label}</label>)}
                        <div className={`flex-1 ${saas.isEditMode ? 'opacity-50 pointer-events-none' : ''}`}>{renderDnevnikPolje(polje)}</div>
                    </div>
                ))}
                <button onClick={snimiZastojIliRad} className={`w-full py-3 bg-red-600 text-theme-text font-black rounded-xl text-[10px] uppercase shadow-lg hover:bg-red-500 ${saas.isEditMode ? 'opacity-50 pointer-events-none col-span-4' : 'col-span-4 md:col-span-4 mt-2'}`}>➕ Dodaj Zapis</button>
            </div>
            
            <div className="space-y-2 mt-4 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {logovi.length === 0 && <p className="text-center text-slate-500 text-[10px] uppercase">Nema unesenih zastoja za danas.</p>}
                {logovi.map(l => (
                    <div key={l.id} className="flex justify-between items-center p-3 bg-slate-800 border border-theme-border rounded-xl">
                        <div>
                            <p className="text-[10px] text-slate-400 font-black"><span className="text-emerald-400">{l.vrijeme_od}</span> - {l.vrijeme_do ? <span className="text-amber-400">{l.vrijeme_do}</span> : <span className="text-slate-500">...</span>}</p>
                            <p className="text-theme-text text-xs font-bold mt-1">{l.napomena || 'Nema napomene'}</p>
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
    useEffect(() => { if (!header?.masina) { setHeader(prev => ({ ...prev, masina: 'BRENTA 1' })); } }, [header?.masina]);

    const saas = useSaaS('prorez_modul', {
        boja_kartice: '#1e293b', boja_slova: '#ffffff', velicina_naslova: '16', naslov_skenera: 'SKENIRAJ TRUPAC NA BRENTI',
        polja_radnici: [ { id: 'brentista', label: '👨‍🔧 BRENTISTA (GLAVNI)', span: 'col-span-1' }, { id: 'pomocnik', label: '👷 POMOĆNIK 1', span: 'col-span-1' }, { id: 'viljuskarista', label: '🚜 VILJUŠKARISTA', span: 'col-span-1' } ],
        polja_dnevnik: [ { id: 'pocetak', label: 'POČETAK', span: 'col-span-1' }, { id: 'kraj', label: 'ZAVRŠETAK', span: 'col-span-1' }, { id: 'zastoj', label: 'ZASTOJ (MINUTA)', span: 'col-span-1' }, { id: 'napomena', label: 'NAPOMENA / RAZLOG', span: 'col-span-1', customWidth: '100%', span: 'col-span-4' } ]
    });

    const dragItem = useRef(null); const dragOverItem = useRef(null);
    const handleDragStart = (e, index, lista) => { dragItem.current = { index, lista }; };
    const handleDragEnter = (e, index) => { dragOverItem.current = index; };
    const handleDrop = (listaIme) => { if(!dragItem.current || dragOverItem.current === null || dragItem.current.lista !== listaIme) return; const aktuelnaLista = saas.ui[listaIme]?.length > 0 ? saas.ui[listaIme] : saas.defaultConfig[listaIme]; const novaLista = [...aktuelnaLista]; const premjesteniItem = novaLista[dragItem.current.index]; novaLista.splice(dragItem.current.index, 1); novaLista.splice(dragOverItem.current, 0, premjesteniItem); dragItem.current = null; dragOverItem.current = null; saas.setUi({...saas.ui, [listaIme]: novaLista}); };
    const updatePolje = (index, key, val, listaIme) => { const aktuelnaLista = saas.ui[listaIme]?.length > 0 ? saas.ui[listaIme] : saas.defaultConfig[listaIme]; const novaLista = [...aktuelnaLista]; novaLista[index][key] = val; saas.setUi({...saas.ui, [listaIme]: novaLista}); };
    const toggleVelicinaPolja = (index, listaIme) => { const aktuelnaLista = saas.ui[listaIme]?.length > 0 ? saas.ui[listaIme] : saas.defaultConfig[listaIme]; const novaLista = [...aktuelnaLista]; const trenutno = novaLista[index].span; novaLista[index].span = trenutno === 'col-span-1' ? 'col-span-2' : (trenutno === 'col-span-2' ? 'col-span-4' : 'col-span-1'); saas.setUi({...saas.ui, [listaIme]: novaLista}); };
    const spremiDimenzije = (e, index, listaIme) => { if (!saas.isEditMode) return; const w = e.currentTarget.style.width; const h = e.currentTarget.style.height; if (w || h) { const aktuelnaLista = saas.ui[listaIme]?.length > 0 ? saas.ui[listaIme] : saas.defaultConfig[listaIme]; const novaLista = [...aktuelnaLista]; if (w) novaLista[index].customWidth = w; if (h) novaLista[index].customHeight = h; saas.setUi({...saas.ui, [listaIme]: novaLista}); } };

    const [scan, setScan] = useState('');
    const [trupac, setTrupac] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [prorezaniLista, setProrezaniLista] = useState([]);
    
    // PAMETNI DIJALOZI
    const [dialog, setDialog] = useState({ isOpen: false });
    const prikaziDialog = (opcije) => setDialog({ isOpen: true, confirmText: 'POTVRDI', cancelText: 'ZATVORI', ...opcije });
    const zatvoriDialog = () => setDialog({ isOpen: false });

    // OVDJE SU SADA PRAVI RADNICI UZ ULOGU PROREZA
    const [brentista, setBrentista] = useState('');
    const [pomocnik, setPomocnik] = useState('');
    const [viljuskarista, setViljuskarista] = useState('');
    const [radniciList, setRadniciList] = useState([]);

    const handleBrentistaChange = async (novoIme) => {
        if (header?.masina) {
            await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('masina_naziv', header.masina).eq('uloga', 'brentista').is('vrijeme_odjave', null);
            if (novoIme) await supabase.from('aktivni_radnici').insert([{ radnik_ime: novoIme, masina_naziv: header.masina, vrijeme_prijave: new Date().toISOString(), uloga: 'brentista' }]);
            window.dispatchEvent(new Event('radnici_updated')); 
        }
        setBrentista(novoIme); localStorage.setItem('prorez_brentista', novoIme);
    };

    const handlePomocnikChange = async (novoIme) => {
        if (header?.masina) {
            await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('masina_naziv', header.masina).eq('uloga', 'pomocnik').is('vrijeme_odjave', null);
            if (novoIme) await supabase.from('aktivni_radnici').insert([{ radnik_ime: novoIme, masina_naziv: header.masina, vrijeme_prijave: new Date().toISOString(), uloga: 'pomocnik' }]);
            window.dispatchEvent(new Event('radnici_updated')); 
        }
        setPomocnik(novoIme); localStorage.setItem('prorez_pomocnik', novoIme);
    };

    const handleViljuskaristaChange = async (novoIme) => {
        if (header?.masina) {
            await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('masina_naziv', header.masina).eq('uloga', 'viljuskarista').is('vrijeme_odjave', null);
            if (novoIme) await supabase.from('aktivni_radnici').insert([{ radnik_ime: novoIme, masina_naziv: header.masina, vrijeme_prijave: new Date().toISOString(), uloga: 'viljuskarista' }]);
            window.dispatchEvent(new Event('radnici_updated')); 
        }
        setViljuskarista(novoIme); localStorage.setItem('prorez_viljuskarista', novoIme);
    };

    useEffect(() => {
        supabase.from('radnici').select('ime_prezime').then(({data}) => setRadniciList(data ? data.map(r=>({naziv: r.ime_prezime})) : []));
        if (header?.masina) loadProrezani();

        // UČITAVAMO RADNIKE ZA OVU MAŠINU U PROREZU
        const ucitajDezurneRadnike = async () => {
            if (!header?.masina) return;
            const { data } = await supabase.from('aktivni_radnici').select('radnik_ime, uloga').eq('masina_naziv', header.masina).is('vrijeme_odjave', null);
            if (data) {
                const b = data.find(r => r.uloga === 'brentista');
                const p = data.find(r => r.uloga === 'pomocnik');
                const v = data.find(r => r.uloga === 'viljuskarista');
                if (b) { setBrentista(b.radnik_ime); localStorage.setItem('prorez_brentista', b.radnik_ime); }
                if (p) { setPomocnik(p.radnik_ime); localStorage.setItem('prorez_pomocnik', p.radnik_ime); }
                if (v) { setViljuskarista(v.radnik_ime); localStorage.setItem('prorez_viljuskarista', v.radnik_ime); }
            }
        };
        ucitajDezurneRadnike();
    }, [header?.masina]);

    const loadProrezani = async () => {
        if(!header?.masina) return;
        const now = new Date();
        const past12h = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase.from('prorez_log').select('*').eq('masina', header.masina).gte('created_at', past12h).order('created_at', { ascending: false });
        if(data) setProrezaniLista(data);
    };

    const handleScanInput = async (val) => {
        setScan(val);
        const id = val.toUpperCase().trim();
        if (id.length >= 3) {
            const { data } = await supabase.from('trupci').select('*').eq('id', id).maybeSingle();
            if(data) {
                if(data.prorezan_at) return prikaziDialog({ tip: 'upozorenje', naslov: 'Iskorišten Trupac', poruka: `Trupac ${id} je VEĆ PROREZAN!\nSkenirajte drugi.`, onCancel: zatvoriDialog });
                setTrupac(data); setScan('');
                if (window.navigator.vibrate) window.navigator.vibrate(50);
            }
        }
    };

    const zavrsiProrez = async () => {
        if(!trupac) return;
        if(!brentista) return prikaziDialog({ tip: 'upozorenje', naslov: 'Obavezno Polje', poruka: "ZABRANJENO:\nMorate odabrati Brentistu kako bi se prorez evidentirao!", onCancel: zatvoriDialog });

        prikaziDialog({
            tip: 'info', naslov: 'Potvrda',
            poruka: `Da li ste sigurni da je trupac ${trupac.id} izrezan i želite ga skinuti sa zaliha?`,
            confirmText: '✅ DA, IZREZANO', cancelText: '✕ PREKINI',
            onConfirm: async () => {
                const now = new Date().toISOString();
                const { error: errUpdate } = await supabase.from('trupci').update({ status: 'prorezano', prorezan_at: now }).eq('id', trupac.id);
                if (errUpdate) return prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: errUpdate.message, onCancel: zatvoriDialog });

                const { data: aktuelniRadnici } = await supabase.from('aktivni_radnici').select('radnik_ime').eq('masina_naziv', header.masina).is('vrijeme_odjave', null);
                const ostaliRadnici = aktuelniRadnici ? aktuelniRadnici.map(r => r.radnik_ime).filter(ime => ime !== brentista && ime !== pomocnik && ime !== viljuskarista) : [];
                const sviRadniciProrez = [brentista, pomocnik, viljuskarista, ...ostaliRadnici].filter(Boolean).join(', ');

                const logPayload = {
                    trupac_id: trupac.id, zapremina: trupac.zapremina,
                    mjesto: header.mjesto, masina: header.masina,
                    brentista, pomocnik, viljuskarista, svi_radnici_imena: sviRadniciProrez,
                    snimio_korisnik: user.ime_prezime, vrsta_drveta: trupac.vrsta || 'N/A'
                };
                
                await supabase.from('prorez_log').insert([logPayload]);
                setTrupac(null); setScan(''); loadProrezani(); zatvoriDialog();
            },
            onCancel: zatvoriDialog
        });
    };

    const totalIzrezanoM3 = useMemo(() => prorezaniLista.reduce((s, p) => s + parseFloat(p.zapremina||0), 0), [prorezaniLista]);

    const renderRadnikPolje = (polje) => {
        if (polje.id === 'brentista') return <div className="h-full w-full min-w-0 bg-transparent text-theme-text font-black text-sm uppercase px-2 py-1 outline-none overflow-visible"><MasterSearch data={radniciList} poljaZaPretragu={['naziv']} value={brentista} onSelect={r => handleBrentistaChange(r.naziv)} placeholder="Odaberi..." /></div>;
        if (polje.id === 'pomocnik') return <div className="h-full w-full min-w-0 bg-transparent text-theme-text font-black text-sm uppercase px-2 py-1 outline-none overflow-visible"><MasterSearch data={radniciList} poljaZaPretragu={['naziv']} value={pomocnik} onSelect={r => handlePomocnikChange(r.naziv)} placeholder="Odaberi..." /></div>;
        if (polje.id === 'viljuskarista') return <div className="h-full w-full min-w-0 bg-transparent text-theme-text font-black text-sm uppercase px-2 py-1 outline-none overflow-visible"><MasterSearch data={radniciList} poljaZaPretragu={['naziv']} value={viljuskarista} onSelect={r => handleViljuskaristaChange(r.naziv)} placeholder="Odaberi..." /></div>;
        return null;
    };

    if (!header?.masina) {
        return (
            <div className="p-4 max-w-2xl mx-auto space-y-6 font-bold animate-in fade-in">
                <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-red-500" user={user} saas={saas} />
                <div className="bg-red-900/30 border-2 border-red-500 p-10 rounded-[2.5rem] text-center shadow-2xl mt-10 backdrop-blur-[var(--glass-blur)]">
                    <span className="text-6xl block mb-4 animate-bounce">⚠️</span>
                    <h2 className="text-2xl text-red-400 font-black uppercase tracking-widest">Mašina nije odabrana!</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6 animate-in fade-in font-sans pb-24 overflow-visible" style={{ color: saas.ui.boja_slova }}>
            <PametniDialog {...dialog} />
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-red-500" user={user} modulIme="prorez" saas={saas} />

            {saas.isEditMode && (
                <div className="bg-black/60 p-6 rounded-2xl border-2 border-amber-500/50 mb-6 shadow-2xl">
                    <h3 className="text-amber-500 font-black uppercase text-sm mb-4">God Mode - Kontrole Dizajna</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <label className="text-[10px] text-amber-500 uppercase font-black">Boja Pozadine (Kartice): <input type="color" value={saas.ui.boja_kartice} onChange={e => saas.setUi({...saas.ui, boja_kartice: e.target.value})} className="w-full h-10 mt-1 cursor-pointer rounded bg-transparent" /></label>
                        <label className="text-[10px] text-amber-500 uppercase font-black">Boja SVIH slova: <input type="color" value={saas.ui.boja_slova} onChange={e => saas.setUi({...saas.ui, boja_slova: e.target.value})} className="w-full h-10 mt-1 cursor-pointer rounded bg-transparent" /></label>
                        <label className="text-[10px] text-amber-500 uppercase font-black">Veličina naslova (px): <input type="number" value={saas.ui.velicina_naslova} onChange={e => saas.setUi({...saas.ui, velicina_naslova: e.target.value})} className="w-full p-2 mt-1 bg-black text-amber-400 font-mono rounded" /></label>
                        <label className="text-[10px] text-amber-500 uppercase font-black md:col-span-3">Naslov Skenera: <input type="text" value={saas.ui.naslov_skenera} onChange={e => saas.setUi({...saas.ui, naslov_skenera: e.target.value})} className="w-full p-2 mt-1 bg-black text-amber-400 rounded" /></label>
                    </div>
                </div>
            )}

            <h2 className="text-red-500 text-center font-black tracking-widest uppercase text-xl md:text-2xl mt-2 mb-6 drop-shadow-md">🪚 PROREZ TRUPACA</h2>
            
            <div className="flex flex-col md:flex-row gap-4 bg-theme-card/60 backdrop-blur-[var(--glass-blur)] p-4 rounded-[2rem] border border-red-500/20 items-center justify-between shadow-lg relative z-[50]" style={{ backgroundColor: saas.ui.boja_kartice }}>
                <div className="flex gap-4 w-full md:w-auto flex-1 flex-wrap overflow-visible">
                    {(saas.ui.polja_radnici || []).map((polje, index) => (
                        <div key={polje.id} className={`relative flex-1 min-w-[200px] flex items-center bg-black/40 rounded-xl border border-slate-800/50 p-2 overflow-visible transition-all ${saas.isEditMode ? 'border-dashed border-amber-500 bg-amber-900/20' : ''}`} draggable={saas.isEditMode} onDragStart={(e) => handleDragStart(e, index, 'polja_radnici')} onDragEnter={(e) => handleDragEnter(e, index)} onDragEnd={() => handleDrop('polja_radnici')} onDragOver={(e) => e.preventDefault()}>
                            {saas.isEditMode && (<div className="absolute -top-3 -right-2 z-[60] flex gap-1"><span className="text-[10px] text-amber-500 bg-theme-card px-2 py-1 rounded-box cursor-move border border-amber-500/50 shadow-lg">☰ POMICANJE</span></div>)}
                            <div className="flex-1 flex items-center overflow-visible">
                                {saas.isEditMode ? (<input value={polje.label} onChange={(e) => updatePolje(index, 'label', e.target.value, 'polja_radnici')} className="w-24 bg-theme-card text-amber-400 p-1 rounded border border-amber-500/50 text-[8px] uppercase font-black shrink-0 mr-2" placeholder="Naslov..." />) : (polje.label && <label className="text-[8px] text-slate-500 uppercase mx-2 whitespace-nowrap shrink-0 w-24 overflow-hidden text-ellipsis">{polje.label}</label>)}
                                <div className="flex-1 border-l border-theme-border/50 pl-2 relative overflow-visible z-[100]">{renderRadnikPolje(polje)}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
                
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-theme-card/80 backdrop-blur-md p-8 rounded-[2.5rem] border border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.1)] relative group overflow-hidden" style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50"></div>
                        <label className="text-[9px] text-theme-muted uppercase block mb-4 font-black tracking-widest text-center" style={{ color: saas.ui.boja_teksta, fontSize: `${saas.ui.velicina_naslova}px` }}>{saas.ui.naslov_skenera}</label>
                        <div className={`flex bg-theme-panel border-2 rounded-2xl overflow-hidden shadow-inner transition-all h-20 mb-8 ${saas.isEditMode ? 'border-amber-500/50 opacity-50 pointer-events-none' : 'border-red-500/50 focus-within:border-red-500'}`}>
                            <input value={scan} onChange={e => handleScanInput(e.target.value)} className="flex-1 min-w-0 px-6 bg-transparent text-xl md:text-2xl text-center text-theme-text outline-none uppercase font-black placeholder:text-theme-muted/30 tracking-widest" placeholder="ČEKAM SKEN..." />
                            <button onClick={() => setIsScanning(true)} className="shrink-0 px-8 bg-red-600/30 text-red-500 font-bold hover:bg-red-500 hover:text-white transition-all text-3xl border-l border-red-500/50">📷</button>
                        </div>

                        {trupac ? (
                            <div className="bg-theme-panel p-6 rounded-3xl border border-red-500/50 shadow-2xl relative overflow-hidden animate-in zoom-in-95">
                                <div className="absolute -right-10 -top-10 text-9xl opacity-5">🪵</div>
                                <div className="flex justify-between items-start mb-6 border-b border-theme-border/50 pb-4 relative z-10">
                                    <div><span className="text-[10px] text-theme-muted uppercase font-black tracking-widest block mb-1">ID Trupca (Pločica)</span><h3 className="text-3xl text-theme-text font-black drop-shadow-md">{trupac.id}</h3></div>
                                    <div className="text-right"><span className="text-[10px] text-theme-muted uppercase font-black tracking-widest block mb-1">Zapremina</span><h3 className="text-4xl text-red-500 font-black drop-shadow-lg">{parseFloat(trupac.zapremina || 0).toFixed(3)} <span className="text-lg text-red-700">m³</span></h3></div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 relative z-10">
                                    <div className="bg-black/30 p-4 rounded-2xl border border-theme-border/30 text-center"><span className="text-[9px] text-slate-500 uppercase block mb-1 font-bold">Vrsta</span><span className="text-sm font-black text-theme-text uppercase tracking-widest">{trupac.vrsta || 'N/A'}</span></div>
                                    <div className="bg-black/30 p-4 rounded-2xl border border-theme-border/30 text-center"><span className="text-[9px] text-slate-500 uppercase block mb-1 font-bold">Klasa</span><span className="text-sm font-black text-theme-text uppercase tracking-widest">{trupac.klasa || '-'}</span></div>
                                    <div className="bg-black/30 p-4 rounded-2xl border border-theme-border/30 text-center"><span className="text-[9px] text-slate-500 uppercase block mb-1 font-bold">Dužina</span><span className="text-sm font-black text-theme-text uppercase tracking-widest">{trupac.duzina} m</span></div>
                                    <div className="bg-black/30 p-4 rounded-2xl border border-theme-border/30 text-center"><span className="text-[9px] text-slate-500 uppercase block mb-1 font-bold">Prečnik</span><span className="text-sm font-black text-theme-text uppercase tracking-widest">Ø {trupac.promjer} cm</span></div>
                                </div>
                                <div className="flex gap-4 relative z-10">
                                    <button onClick={() => {setTrupac(null); setScan('');}} className="flex-1 py-5 bg-theme-card text-slate-400 font-black rounded-2xl uppercase hover:bg-slate-800 transition-all border border-theme-border text-sm">✕ Otkazivanje</button>
                                    <button onClick={zavrsiProrez} className="flex-[2] py-5 bg-red-600 text-white font-black rounded-2xl uppercase shadow-[0_0_30px_rgba(220,38,38,0.4)] hover:bg-red-500 transition-all text-sm tracking-widest hover:scale-[1.02]">✅ POTVRDI KAO IZREZANO</button>
                                </div>
                            </div>
                        ) : (
                            <div className="border-2 border-dashed border-theme-border p-10 rounded-3xl text-center text-slate-500 flex flex-col items-center justify-center bg-black/10">
                                <span className="text-5xl mb-4 opacity-50">🪵</span>
                                <p className="font-bold text-sm uppercase tracking-widest">Čekam skeniranje sljedećeg trupca...</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-theme-card/80 backdrop-blur-md p-6 rounded-[2.5rem] border border-theme-border shadow-xl flex flex-col h-full" style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <div className="flex justify-between items-end border-b border-theme-border pb-4 mb-4">
                            <div><h3 className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Dnevni Učinak (Izrezano)</h3><p className="text-3xl font-black text-red-500 drop-shadow-md">{totalIzrezanoM3.toFixed(3)} <span className="text-sm text-red-700">m³</span></p></div>
                            <div className="text-right"><p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Broj Trupaca</p><p className="text-xl font-black text-theme-text">{prorezaniLista.length} <span className="text-xs text-slate-500">kom</span></p></div>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 max-h-[500px]">
                            {prorezaniLista.length === 0 && <div className="text-center text-xs text-slate-500 py-10 italic">Nema izrezanih trupaca u zadnjih 12 sati.</div>}
                            {prorezaniLista.map((p, i) => (
                                <div key={p.id} className="bg-theme-panel p-4 rounded-2xl border border-theme-border/50 flex justify-between items-center hover:border-red-500/50 transition-colors shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="text-[10px] font-black text-slate-500 w-4">{prorezaniLista.length - i}.</div>
                                        <div><p className="text-theme-text text-sm font-black">{p.trupac_id}</p><p className="text-[9px] text-slate-400 mt-1 uppercase font-bold tracking-widest">{new Date(p.created_at).toLocaleTimeString('de-DE')} | {p.vrsta_drveta}</p></div>
                                    </div>
                                    <div className="text-right"><p className="text-red-400 font-black text-lg">{parseFloat(p.zapremina||0).toFixed(3)}</p><p className="text-[8px] text-red-700 uppercase font-black">m³</p></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            
            <SaaS_DnevnikMasine modul="Prorez" header={header} user={user} saas={saas} updatePolje={updatePolje} toggleVelicina={toggleVelicinaPolja} spremiDimenzije={spremiDimenzije} handleDragStart={handleDragStart} handleDragEnter={handleDragEnter} handleDrop={handleDrop} />
            {isScanning && <ScannerOverlay onScan={(text) => { handleScanInput(text.toUpperCase()); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}