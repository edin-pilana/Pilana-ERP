"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import MasterSearch from '../components/MasterSearch'; // NOVO
import PametniDialog from '../components/PametniDialog'; // NOVO
import ScannerOverlay from '../components/ScannerOverlay';
import { useSaaS } from '../utils/useSaaS';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const shiftDateString = (isoStr, days) => {
    if(!isoStr) return new Date().toISOString().split('T')[0];
    const d = new Date(isoStr); d.setDate(d.getDate() + days); return d.toISOString().split('T')[0];
};

export default function PrijemModule({ user, header, setHeader, onExit }) {
    
    const saas = useSaaS('prijem_trupaca', {
        boja_kartice: '#1e293b',
        boja_slova: '#ffffff',
        velicina_naslova: '16',
        naslov_zaglavlja: 'ZAGLAVLJE OTPREMNICE',
        naslov_skenera: 'SKENIRAJ QR KOD TRUPCA',
        boja_teksta: 'text-indigo-400',
        polja_zaglavlje: [
            { id: 'sumarija', label: 'ŠUMARIJA', span: 'col-span-1' }, { id: 'podruznica', label: 'PODRUŽNICA', span: 'col-span-1' },
            { id: 'prevoznik', label: 'PREVOZNIK', span: 'col-span-1' }, { id: 'odjel', label: 'ODJEL', span: 'col-span-1' },
            { id: 'otpremnica_datum', label: 'DATUM OTPR.', span: 'col-span-1' }, { id: 'otpremnica_broj', label: 'BROJ OTPREMNICE', span: 'col-span-1' }
        ],
        polja_unos: [
            { id: 'plocica', label: 'BROJ PLOČICE', span: 'col-span-2' }, { id: 'redni', label: 'REDNI BROJ (OPCIONO)', span: 'col-span-2' },
            { id: 'vrsta', label: 'VRSTA DRVETA', span: 'col-span-1' }, { id: 'klasa', label: 'KLASA', span: 'col-span-1' },
            { id: 'duzina', label: 'DUŽINA (M)', span: 'col-span-1' }, { id: 'promjer', label: 'PREČNIK (CM)', span: 'col-span-1' }
        ]
    });

    const aktivnaPoljaZaglavlja = saas.ui.polja_zaglavlje?.length > 0 ? saas.ui.polja_zaglavlje : saas.defaultConfig.polja_zaglavlje;
    const aktivnaPoljaUnosa = saas.ui.polja_unos?.length > 0 ? saas.ui.polja_unos : saas.defaultConfig.polja_unos;

    const [sumarijeList, setSumarijeList] = useState([]);
    const [podruzniceList, setPodruzniceList] = useState([]);
    const [prevozniciList, setPrevozniciList] = useState([]);
    const [odjeliList, setOdjeliList] = useState([]);
    const [vrsteList, setVrsteList] = useState([]);
    const [klaseList, setKlaseList] = useState([]);
    const [podruzniceBaza, setPodruzniceBaza] = useState([]);
    const [cjenovnikBaza, setCjenovnikBaza] = useState([]);

    const [dialog, setDialog] = useState({ isOpen: false });
    const prikaziDialog = (opcije) => setDialog({ isOpen: true, confirmText: 'POTVRDI', cancelText: 'ZATVORI', ...opcije });
    const zatvoriDialog = () => setDialog({ isOpen: false });

    const [pHeader, setPHeader] = useState({
        sumarija: typeof window !== 'undefined' ? localStorage.getItem('pr_sumarija') || '' : '',
        podruznica: typeof window !== 'undefined' ? localStorage.getItem('pr_podruznica') || '' : '',
        prevoznik: typeof window !== 'undefined' ? localStorage.getItem('pr_prevoznik') || '' : '',
        odjel: typeof window !== 'undefined' ? localStorage.getItem('pr_odjel') || '' : '',
        otpremnica_broj: typeof window !== 'undefined' ? localStorage.getItem('pr_otpr_broj') || '' : '',
        otpremnica_datum: typeof window !== 'undefined' ? localStorage.getItem('pr_otpr_datum') || new Date().toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    });

    const [scan, setScan] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [form, setForm] = useState({ broj_plocice: '', redni_broj: '', vrsta: '', klasa: '', duzina: '', promjer: '', isKontrola: false, kontrolna_duzina: '', kontrolni_promjer: '' });
    const [listaPrijema, setListaPrijema] = useState([]);
    const scanTimerRef = useRef(null);

    useEffect(() => {
        supabase.from('sumarije').select('naziv').then(({data}) => setSumarijeList(data?data.map(d=>({naziv: d.naziv})):[]));
        supabase.from('prevoznici').select('naziv').then(({data}) => setPrevozniciList(data?data.map(d=>({naziv: d.naziv})):[]));
        supabase.from('trupci').select('odjel').neq('odjel', null).then(({data}) => { if(data) { const uniqueOdjeli = [...new Set(data.map(d => d.odjel).filter(Boolean))]; setOdjeliList(uniqueOdjeli.map(o=>({naziv: o}))); } });
        supabase.from('vrste_drveta').select('naziv').then(({data}) => { if(data && data.length > 0) { setVrsteList(data.map(d=>d.naziv)); setForm(f => ({...f, vrsta: data[0].naziv})); } });
        supabase.from('klase_trupaca').select('naziv').then(({data}) => { if(data && data.length > 0) { setKlaseList(data.map(d=>d.naziv)); setForm(f => ({...f, klasa: data[0].naziv})); } });
        supabase.from('cjenovnik_trupaca').select(`cijena_po_m3, sumarije(naziv), vrste_drveta(naziv), klase_trupaca(naziv)`).then(({data}) => setCjenovnikBaza(data || []));
    }, []);

    useEffect(() => { loadPrijemList(); }, [pHeader.otpremnica_broj]);
    useEffect(() => { if(pHeader.sumarija) ucitajPodruznice(pHeader.sumarija); }, []);

    const ucitajPodruznice = async (sumarijaNaziv) => {
        const {data} = await supabase.from('podruznice').select('*').eq('sumarija_naziv', sumarijaNaziv);
        setPodruzniceBaza(data || []); setPodruzniceList(data?data.map(d=>({naziv: d.naziv})):[]);
    };

    const loadPrijemList = async () => {
        if(!pHeader.otpremnica_broj) return;
        const { data } = await supabase.from('trupci').select('*').eq('otpremnica_broj', pHeader.otpremnica_broj).eq('zakljucen_prijem', false).order('created_at', { ascending: false });
        setListaPrijema(data || []);
    };

    const updateHeader = (key, val) => {
        const updated = { ...pHeader, [key]: val };
        if(key === 'sumarija') { updated.podruznica = ''; ucitajPodruznice(val); }
        setPHeader(updated); localStorage.setItem(`pr_${key}`, val);
    };

    const calculatedZapremina = useMemo(() => {
        if(!form.duzina || !form.promjer) return "0.00";
        const r = parseFloat(form.promjer) / 200; return (r * r * Math.PI * parseFloat(form.duzina)).toFixed(2);
    }, [form.duzina, form.promjer]);

    const calculatedKontrolnaZapremina = useMemo(() => {
        if(!form.kontrolna_duzina || !form.kontrolni_promjer) return "0.00";
        const r = parseFloat(form.kontrolni_promjer) / 200; return (r * r * Math.PI * parseFloat(form.kontrolna_duzina)).toFixed(2);
    }, [form.kontrolna_duzina, form.kontrolni_promjer]);

    const handleScanInput = (val) => {
        setScan(val);
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        if (val.length >= 3) {
            scanTimerRef.current = setTimeout(async () => {
                const id = val.toUpperCase();
                const { data: existing } = await supabase.from('trupci').select('id, status, otpremnica_broj').eq('id', id).maybeSingle();
                if(existing) {
                    prikaziDialog({ tip: 'greska', naslov: 'Iskorišten Kod', poruka: `QR KOD JE VEĆ ISKORIŠTEN!\nTrenutni status: ${existing.status}\nOtpremnica: ${existing.otpremnica_broj}\nSkenirajte drugu pločicu.`, onCancel: zatvoriDialog });
                    setScan(''); 
                }
            }, 1000); 
        }
    };

    const snimiTrupac = async () => {
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        if(!pHeader.otpremnica_broj || !pHeader.sumarija) return prikaziDialog({ tip: 'upozorenje', naslov: 'Fale podaci', poruka: "Popunite Šumariju i Broj Otpremnice u Zaglavlju!", onCancel: zatvoriDialog });
        if(!scan || !form.duzina || !form.promjer) return prikaziDialog({ tip: 'upozorenje', naslov: 'Fale podaci', poruka: "Skeniraj QR, unesi dužinu i prečnik.", onCancel: zatvoriDialog });
        
        const trupacID = scan.toUpperCase();
        const zapreminaZaObracun = form.isKontrola ? parseFloat(calculatedKontrolnaZapremina) : parseFloat(calculatedZapremina);
        const podrObj = podruzniceBaza.find(p => p.naziv === pHeader.podruznica && p.sumarija_naziv === pHeader.sumarija);
        const prevozPoKubiku = podrObj ? parseFloat(podrObj.cijena_prevoza_po_m3 || 0) : 0;
        const cjenObj = cjenovnikBaza.find(c => c.sumarije?.naziv === pHeader.sumarija && c.vrste_drveta?.naziv === form.vrsta && c.klase_trupaca?.naziv === form.klasa);
        const cijenaTrupcaPoKubiku = cjenObj ? parseFloat(cjenObj.cijena_po_m3 || 0) : 0;
        const konacna_nabavna_vrijednost = (cijenaTrupcaPoKubiku + prevozPoKubiku) * zapreminaZaObracun;

        const trupacData = {
            id: trupacID, broj_plocice: form.broj_plocice || null, redni_broj: form.redni_broj || null, 
            vrsta: form.vrsta, klasa: form.klasa, duzina: parseFloat(form.duzina), promjer: parseFloat(form.promjer), 
            zapremina: parseFloat(calculatedZapremina), kontrolna_duzina: form.isKontrola ? parseFloat(form.kontrolna_duzina) : null,
            kontrolni_promjer: form.isKontrola ? parseFloat(form.kontrolni_promjer) : null, kontrolna_zapremina: form.isKontrola ? parseFloat(calculatedKontrolnaZapremina) : null,
            sumarija: pHeader.sumarija, podruznica: pHeader.podruznica || null, otpremnica_broj: pHeader.otpremnica_broj,
            otpremnica_datum: pHeader.otpremnica_datum, prevoznik: pHeader.prevoznik || null, odjel: pHeader.odjel || null,         
            snimio_korisnik: user?.ime_prezime || 'Nepoznat', datum_prijema: new Date().toISOString().split('T')[0], 
            zakljucen_prijem: false, status: 'na_lageru', nabavna_vrijednost: konacna_nabavna_vrijednost
        };

        const { error } = await supabase.from('trupci').upsert([trupacData]);
        if (error) return prikaziDialog({ tip: 'greska', naslov: 'Baza Greška', poruka: error.message, onCancel: zatvoriDialog });

        if (typeof window !== 'undefined' && window.navigator.vibrate) window.navigator.vibrate(100); 
        setScan(''); setForm({ broj_plocice: '', redni_broj: '', vrsta: vrsteList[0] || '', klasa: klaseList[0] || '', duzina: '', promjer: '', isKontrola: false, kontrolna_duzina: '', kontrolni_promjer: '' }); 
        await loadPrijemList();
    };

    const zakljuciOtpremnicu = async () => {
        if(listaPrijema.length === 0) return prikaziDialog({ tip: 'upozorenje', naslov: 'Prazno', poruka: "Nema trupaca na listi za zaključavanje.", onCancel: zatvoriDialog });
        prikaziDialog({
            tip: 'info',
            naslov: 'Zaključi Otpremnicu?',
            poruka: `Da li ste sigurni da želite ZAKLJUČITI OTPREMNICU ${pHeader.otpremnica_broj}?\nOvo će trajno potvrditi sve dodane trupce.`,
            confirmText: '✅ ZAKLJUČI',
            onConfirm: async () => {
                for(let trupac of listaPrijema) await supabase.from('trupci').update({ zakljucen_prijem: true }).eq('id', trupac.id);
                ['pr_sumarija', 'pr_podruznica', 'pr_prevoznik', 'pr_odjel', 'pr_otpr_broj'].forEach(k => localStorage.removeItem(k));
                setPHeader({...pHeader, sumarija: '', podruznica: '', prevoznik: '', odjel: '', otpremnica_broj: ''});
                setListaPrijema([]);
                zatvoriDialog();
                prikaziDialog({ tip: 'uspjeh', naslov: 'Zaključeno', poruka: "Otpremnica je uspješno zaključena i trupci su evidentirani.", onCancel: zatvoriDialog });
            },
            onCancel: zatvoriDialog
        });
    };

    const renderPolje = (polje, formData, setFormData) => {
        const actualId = polje.id === 'datum' ? 'otpremnica_datum' : (polje.id === 'broj' ? 'otpremnica_broj' : polje.id);
        const val = formData[actualId] || '';
        const setVal = (v) => setFormData(actualId, v);

        // Korištenje univerzalnog MasterSearch
        if (['sumarija', 'podruznica', 'prevoznik', 'odjel'].includes(actualId)) {
            let listToUse = [];
            if(actualId === 'sumarija') listToUse = sumarijeList;
            if(actualId === 'podruznica') listToUse = podruzniceList;
            if(actualId === 'prevoznik') listToUse = prevozniciList;
            if(actualId === 'odjel') listToUse = odjeliList;

            return (
                <div className="w-full h-full min-h-[45px]">
                    <MasterSearch data={listToUse} poljaZaPretragu={['naziv']} value={val} onSelect={k => setVal(k.naziv)} placeholder={`Odaberi ${polje.label}...`} />
                </div>
            );
        }
        
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
        if (actualId === 'vrsta') return <select value={val} onChange={e => setVal(e.target.value)} className="w-full h-full min-h-[45px] px-3 py-0 bg-theme-panel border border-theme-border rounded-xl text-theme-text outline-none uppercase text-center text-sm font-black shadow-inner cursor-pointer">{vrsteList.map(v => <option key={v} value={v} className="bg-slate-800 text-white">{v}</option>)}</select>;
        if (actualId === 'klasa') return <select value={val} onChange={e => setVal(e.target.value)} className="w-full h-full min-h-[45px] px-3 py-0 bg-theme-panel border border-theme-border rounded-xl text-theme-text outline-none uppercase text-center text-sm font-black shadow-inner cursor-pointer">{klaseList.map(k => <option key={k} value={k} className="bg-slate-800 text-white">{k}</option>)}</select>;
        if (actualId === 'duzina' || actualId === 'promjer') return <input type="number" value={val} onChange={e => setVal(e.target.value)} className="w-full h-full min-h-[45px] p-3 bg-theme-panel border border-theme-border rounded-xl text-theme-text outline-none focus:border-theme-accent text-center text-xl font-black shadow-inner" placeholder="0" />;
        
        return null;
    };

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6 font-sans animate-in fade-in pb-24 overflow-visible" style={{ color: saas.ui.boja_slova }}>
            <PametniDialog {...dialog} />
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} user={user} hideMasina={true} modulIme="prijem" saas={saas} />

            {/* GOD MODE EDITOR POKRENUT */}
            {saas.isEditMode && (
                <div className="bg-black/60 p-6 rounded-2xl border-2 border-amber-500/50 mb-6 shadow-2xl">
                    <h3 className="text-amber-500 font-black uppercase text-sm mb-4">God Mode - Kontrole Dizajna</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <label className="text-[10px] text-amber-500 uppercase font-black">Boja Pozadine (Kartice): <input type="color" value={saas.ui.boja_kartice} onChange={e => saas.setUi({...saas.ui, boja_kartice: e.target.value})} className="w-full h-10 mt-1 cursor-pointer rounded bg-transparent" /></label>
                        <label className="text-[10px] text-amber-500 uppercase font-black">Boja SVIH slova: <input type="color" value={saas.ui.boja_slova} onChange={e => saas.setUi({...saas.ui, boja_slova: e.target.value})} className="w-full h-10 mt-1 cursor-pointer rounded bg-transparent" /></label>
                        <label className="text-[10px] text-amber-500 uppercase font-black">Veličina naslova (px): <input type="number" value={saas.ui.velicina_naslova} onChange={e => saas.setUi({...saas.ui, velicina_naslova: e.target.value})} className="w-full p-2 mt-1 bg-black text-amber-400 font-mono rounded" /></label>
                        <label className="text-[10px] text-amber-500 uppercase font-black md:col-span-1">Naslov Zaglavlja: <input type="text" value={saas.ui.naslov_zaglavlja} onChange={e => saas.setUi({...saas.ui, naslov_zaglavlja: e.target.value})} className="w-full p-2 mt-1 bg-black text-amber-400 rounded" /></label>
                        <label className="text-[10px] text-amber-500 uppercase font-black md:col-span-2">Naslov Skenera: <input type="text" value={saas.ui.naslov_skenera} onChange={e => saas.setUi({...saas.ui, naslov_skenera: e.target.value})} className="w-full p-2 mt-1 bg-black text-amber-400 rounded" /></label>
                    </div>
                </div>
            )}

            <div className="text-center mb-6">
                <h2 className="text-theme-accent font-black tracking-widest uppercase text-xl md:text-2xl drop-shadow-md flex items-center justify-center gap-3">
                    🌳 PRIJEM TRUPACA (Lager)
                </h2>
            </div>

            {pHeader.otpremnica_broj && listaPrijema.length > 0 && (
                <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-[var(--radius-box)] border border-theme-accent/50 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4 animate-in slide-in-from-top">
                    <div>
                        <span className="text-theme-text text-lg font-black uppercase">OTPREMNICA: <span className="text-theme-accent">{pHeader.otpremnica_broj}</span></span>
                        <div className="text-xs text-theme-muted mt-2 flex flex-wrap gap-4 uppercase font-black tracking-widest">
                            <p>Skenirano: <span className="text-theme-accent text-sm ml-1">{listaPrijema.length} kom</span></p>
                            <p>Stvarno: <span className="text-theme-text text-sm ml-1">{listaPrijema.reduce((s,t) => s + parseFloat(t.zapremina||0), 0).toFixed(2)} m³</span></p>
                        </div>
                    </div>
                    <button onClick={zakljuciOtpremnicu} className="w-full md:w-auto px-8 py-4 bg-theme-accent text-white font-black rounded-xl text-xs uppercase shadow-[0_0_20px_rgba(var(--theme-accent-rgb),0.5)] hover:opacity-80 transition-all">🏁 ZAKLJUČI OTPREMNICU</button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-visible">
                <div className="lg:col-span-5 space-y-6 overflow-visible">
                    <div className="p-6 rounded-[var(--radius-box)] shadow-2xl transition-all border border-theme-border backdrop-blur-[var(--glass-blur)] relative overflow-visible" style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <div className="text-center font-black relative mb-6 border-b border-theme-border pb-4">
                            <span className="text-theme-accent uppercase tracking-widest flex items-center justify-center gap-2" style={{ fontSize: `${saas.ui.velicina_naslova}px` }}><span className="w-2 h-2 rounded-full bg-theme-accent"></span> {saas.ui.naslov_zaglavlja}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 relative overflow-visible">
                            {aktivnaPoljaZaglavlja.map((polje, index) => (
                                <div key={polje.id} className={`relative ${polje.span} transition-all overflow-visible`} style={{ zIndex: 50 - index }}>
                                    {polje.label && <label className="text-[9px] text-theme-muted uppercase block mb-1 font-black tracking-widest">{polje.label}</label>}
                                    <div className="h-12 w-full overflow-visible">{renderPolje(polje, pHeader, updateHeader)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-7 space-y-6 overflow-visible">
                    <div className={`p-8 rounded-[var(--radius-box)] shadow-[0_0_40px_rgba(0,0,0,0.3)] border backdrop-blur-[var(--glass-blur)] relative overflow-visible group border-theme-accent/40`} style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-theme-accent to-transparent opacity-50"></div>
                        <label className="uppercase text-theme-accent block mb-4 font-black tracking-widest text-center" style={{ fontSize: `${saas.ui.velicina_naslova}px` }}>{saas.ui.naslov_skenera}</label>
                        <div className="flex bg-theme-panel border-2 border-theme-accent/40 rounded-2xl overflow-hidden shadow-inner focus-within:border-theme-accent transition-all h-20 mb-6">
                            <input value={scan} onChange={e => handleScanInput(e.target.value)} className="flex-1 px-6 bg-transparent text-xl md:text-2xl text-center text-theme-text outline-none uppercase placeholder:text-theme-muted/30 font-black tracking-widest" placeholder="ČEKAM SKEN..." />
                            <button onClick={() => setIsScanning(true)} className="px-8 bg-theme-accent text-white font-black hover:opacity-80 transition-colors text-2xl flex items-center justify-center shadow-lg">📷</button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative mb-6 overflow-visible">
                            {aktivnaPoljaUnosa.map((polje, index) => (
                                <div key={polje.id} className={`relative ${polje.span} transition-all overflow-visible`} style={{ zIndex: 50 - index }}>
                                    {polje.label && <label className="text-[9px] text-theme-muted uppercase block mb-1 font-black tracking-widest text-center">{polje.label}</label>}
                                    <div className="h-14 w-full overflow-visible">{renderPolje(polje, form, (key, val) => setForm({...form, [key]: val}))}</div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between items-center bg-theme-panel p-5 rounded-2xl border border-theme-border shadow-inner mb-6">
                            <span className="text-[10px] text-theme-muted uppercase font-black tracking-widest">Deklarisano (Papir):</span>
                            <span className="text-3xl text-theme-accent font-black drop-shadow-md">{calculatedZapremina} <span className="text-lg">m³</span></span>
                        </div>
                        <button onClick={snimiTrupac} className="w-full py-6 bg-theme-accent text-white font-black rounded-2xl uppercase shadow-xl hover:opacity-90 transition-all text-sm tracking-widest">➕ DODAJ NA OTPREMNICU</button>
                    </div>
                </div>
            </div>

            {pHeader.otpremnica_broj && listaPrijema.length > 0 && (
                <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-[var(--radius-box)] border border-theme-border shadow-xl animate-in fade-in">
                    <div className="flex justify-between items-center mb-6 px-2 border-b border-theme-border pb-4"><span className="text-[10px] text-theme-muted uppercase font-black tracking-widest">Lista skeniranih trupaca:</span></div>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto mb-4 custom-scrollbar pr-2">
                        {listaPrijema.map(t => (
                            <div key={t.id} className={`flex flex-col p-5 bg-theme-panel border rounded-2xl shadow-md transition-all hover:scale-[1.01] border-theme-border hover:border-theme-accent/50`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="text-sm text-theme-text font-black flex items-center gap-3"><span className="text-theme-accent text-lg drop-shadow-md">{t.id}</span> <span className="text-theme-text text-[10px] bg-theme-card px-3 py-1 rounded-lg border border-theme-border shadow-inner">Pločica: {t.broj_plocice || '-'}</span></div>
                                        <div className="text-[10px] text-theme-muted uppercase mt-2 font-bold tracking-widest">{t.vrsta} | Klasa {t.klasa} | L:{t.duzina}m Ø:{t.promjer}cm</div>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                        <div className="text-2xl text-theme-text font-black drop-shadow-md">{t.zapremina} <span className="text-sm text-theme-accent">m³</span></div>
                                        <button onClick={async () => { if(window.confirm("Brisati trupac?")) { await supabase.from('trupci').delete().eq('id', t.id); loadPrijemList(); } }} className="text-[10px] text-red-400 uppercase font-black hover:text-white bg-red-900/20 hover:bg-red-600 px-4 py-1.5 rounded-lg mt-2 transition-all shadow-sm">Obriši ×</button>
                                    </div>
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