"use client";
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import SearchableInput from '../components/SearchableInput';
import ScannerOverlay from '../components/ScannerOverlay';
import { printDokument } from '../utils/printHelpers';
import { useSaaS } from '../utils/useSaaS';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function OTP_SearchableProizvod({ katalog, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value);
    useEffect(() => { setSearch(value); }, [value]);

    const filtered = katalog.filter(k => k.sifra.toUpperCase().includes(search.toUpperCase()) || k.naziv.toUpperCase().includes(search.toUpperCase()));

    return (
        <div className="relative font-black w-full">
            <input value={search} onFocus={() => setOpen(true)} onChange={e => { setSearch(e.target.value); setOpen(true); }} placeholder="Pronađi šifru ili naziv..." className="w-full p-4 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none focus:border-orange-500 shadow-inner" />
            {open && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-theme-panel border border-theme-border rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    {filtered.map(k => {
                        const tekstZaPolje = `${k.sifra} | ${k.naziv} | Dim: ${k.visina}x${k.sirina}x${k.duzina}`;
                        return (
                            <div key={k.sifra} onClick={() => { onChange(k.sifra, tekstZaPolje); setSearch(tekstZaPolje); setOpen(false); }} className="p-3 border-b border-theme-border hover:bg-theme-card border-b border-theme-border cursor-pointer transition-all">
                                <div className="text-theme-text text-xs font-black">{k.sifra} <span className="text-orange-300 ml-1">{k.naziv}</span></div>
                                <div className="text-[9px] text-slate-400 mt-1 uppercase">Kat: {k.kategorija} | Dim: {k.visina}x{k.sirina}x{k.duzina}</div>
                            </div>
                        )
                    })}
                    <div onClick={() => setOpen(false)} className="p-2 text-center text-[8px] text-slate-500 cursor-pointer hover:text-theme-text bg-theme-card sticky bottom-0">Zatvori</div>
                </div>
            )}
        </div>
    );
}

export default function OtpremniceModule({ user, header, setHeader, onExit }) {
    const currentUser = user?.ime_prezime ? user : JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');

    // === SaaS ALAT (Konfiguracija za zaglavlje otpremnice) ===
    const saas = useSaaS('otpremnice_zaglavlje', {
        boja_kartice: '#1e293b',
        polja: [
            { id: 'veza', label: 'Vezni Dokument (Istorija)', span: 'col-span-2' },
            { id: 'broj', label: 'BROJ OTPREMNICE', span: 'col-span-2' },
            { id: 'kupac', label: '* KUPAC (Za koga isporučujemo)', span: 'col-span-2' },
            { id: 'datum', label: 'Datum isporuke', span: 'col-span-1' },
            { id: 'status', label: 'Status', span: 'col-span-1' },
            { id: 'vozac', label: 'Ime i Prezime Vozača', span: 'col-span-2' },
            { id: 'registracija', label: 'Registracija Vozila', span: 'col-span-2' }
        ]
    });

    const aktivnaPolja = saas.ui.polja?.length > 0 ? saas.ui.polja : saas.defaultConfig.polja;

    // Drag & Drop i Resize Logika
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    const handleDragStart = (e, index) => { dragItem.current = index; };
    const handleDragEnter = (e, index) => { dragOverItem.current = index; };
    const handleDrop = () => {
        if(dragItem.current === null || dragOverItem.current === null) return;
        const novaLista = [...aktivnaPolja];
        const premjesteniItem = novaLista[dragItem.current];
        novaLista.splice(dragItem.current, 1);
        novaLista.splice(dragOverItem.current, 0, premjesteniItem);
        dragItem.current = null; dragOverItem.current = null;
        saas.setUi({...saas.ui, polja: novaLista});
    };

    const updatePolje = (index, key, val) => {
        const novaLista = [...aktivnaPolja];
        novaLista[index][key] = val;
        saas.setUi({...saas.ui, polja: novaLista});
    };

    const toggleVelicinaPolja = (index) => {
        const novaLista = [...aktivnaPolja];
        const trenutno = novaLista[index].span;
        novaLista[index].span = trenutno === 'col-span-1' ? 'col-span-2' : (trenutno === 'col-span-2' ? 'col-span-4' : 'col-span-1');
        saas.setUi({...saas.ui, polja: novaLista});
    };

    const spremiDimenzije = (e, index) => {
        if (!saas.isEditMode) return;
        const w = e.currentTarget.style.width;
        const h = e.currentTarget.style.height;
        if (w || h) {
            const novaLista = [...aktivnaPolja];
            if (w) novaLista[index].customWidth = w;
            if (h) novaLista[index].customHeight = h;
            saas.setUi({...saas.ui, polja: novaLista});
        }
    };
    // ===========================

    const [tab, setTab] = useState('nova');
    const [kupci, setKupci] = useState([]);
    const [katalog, setKatalog] = useState([]);
    const [otpremnice, setOtpremnice] = useState([]);

    const generisiID = () => `OTP-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;

    const [form, setForm] = useState({ id: generisiID(), broj_veze: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0], vozac: '', registracija: '', napomena: '', status: 'KREIRANA' });
    const [stavke, setStavke] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    
    // SMART SEARCH STATE
    const [dostupniDokumenti, setDostupniDokumenti] = useState([]);
    const [prikaziDrop, setPrikaziDrop] = useState(false);
    const [kucanjeTimer, setKucanjeTimer] = useState(null);
    const [isScanningOverlay, setIsScanningOverlay] = useState(false);
    
    const [stavkaForm, setStavkaForm] = useState({ id: null, sifra_unos: '', kolicina_obracun: '', jm_obracun: 'm3' });
    const [trenutniProizvod, setTrenutniProizvod] = useState(null);

    const [skenerInput, setSkenerInput] = useState('');

    useEffect(() => { load(); }, []);

    const load = async () => {
        const {data: k} = await supabase.from('kupci').select('*').order('naziv'); setKupci(k||[]);
        const {data: cat} = await supabase.from('katalog_proizvoda').select('*').order('sifra'); setKatalog(cat||[]);
        const {data: otp} = await supabase.from('otpremnice').select('*').order('datum', { ascending: false }); setOtpremnice(otp||[]);
        
        const { data: rn } = await supabase.from('radni_nalozi').select('id, kupac_naziv, status').neq('status', 'ZAVRŠENO');
        const { data: pon } = await supabase.from('ponude').select('id, kupac_naziv, status').in('status', ['POTVRĐENA', 'REALIZOVANA ✅']);
        setDostupniDokumenti([
            ...(rn || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Radni Nalog', status: d.status })),
            ...(pon || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Ponuda', status: d.status }))
        ]);
    };

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: currentUser.ime_prezime || 'Nepoznat', akcija, detalji }]);
    };

    const skenirajVezu = async (e, forcedVal = null) => {
        if (e?.key === 'Enter' || e?.type === 'click' || forcedVal) {
            const broj = (forcedVal || skenerInput).toUpperCase().trim();
            if(!broj) return;
            
            let dokument = null;
            if (broj.startsWith('PON-')) {
                const { data: ponuda } = await supabase.from('ponude').select('*').eq('id', broj).maybeSingle();
                if(!ponuda) return alert(`❌ Ponuda ${broj} nije pronađena!`);
                dokument = ponuda;
            } else if (broj.startsWith('RN-')) {
                const { data: nalog } = await supabase.from('radni_nalozi').select('*').eq('id', broj).maybeSingle();
                if(!nalog) return alert(`❌ Radni nalog ${broj} nije pronađen!`);
                
                // ERP BLOKADA
                if (nalog.status !== 'ZAVRŠENO' && nalog.status !== 'ISPORUČENO') {
                    setSkenerInput('');
                    return alert(`⛔ STOP: Radni nalog ${broj} je u statusu "${nalog.status}".\nNe možete praviti otpremnicu i isporučiti robu dok se proizvodnja ne označi kao ZAVRŠENO!`);
                }
                dokument = nalog;
            } else {
                return alert("❌ Nepoznat format! Mora početi sa PON- ili RN-");
            }

            const prepravljeneStavke = (dokument.stavke_jsonb || []).map(s => ({
                id: Math.random().toString(), sifra: s.sifra, naziv: s.naziv, 
                kolicina_obracun: s.kolicina_obracun, jm_obracun: s.jm_obracun
            }));
            setForm({ ...form, kupac_naziv: dokument.kupac_naziv, broj_veze: broj, napomena: dokument.napomena || '' });
            setStavke(prepravljeneStavke);
            setSkenerInput('');
            alert(`✅ Uspješno preuzeti podaci iz dokumenta: ${broj}`);
        }
    };

    const handleSkenUnos = (e) => {
        const val = e.target.value.toUpperCase();
        setSkenerInput(val);
        setPrikaziDrop(true); 

        if (kucanjeTimer) clearTimeout(kucanjeTimer);
        if (val) {
            setKucanjeTimer(setTimeout(() => {
                setPrikaziDrop(false); 
                skenirajVezu(null, val); 
            }, 2000));
        }
    };

    const odaberiIzDropdowna = (id) => {
        setSkenerInput(id);
        setPrikaziDrop(false);
        if (kucanjeTimer) clearTimeout(kucanjeTimer);
        skenirajVezu(null, id);
    };

    const handleProizvodSelect = (sifraVal, tekstZaPolje) => {
        const nadjeni = katalog.find(k => k.sifra === sifraVal);
        setTrenutniProizvod(nadjeni || null);
        if (nadjeni) setStavkaForm({ ...stavkaForm, id: null, sifra_unos: tekstZaPolje, jm_obracun: nadjeni.default_jedinica || 'm3' });
    };

    const dodajStavku = () => {
        if(!trenutniProizvod || !stavkaForm.kolicina_obracun) return alert("Odaberite proizvod i unesite količinu!");
        const novaStavka = {
            id: stavkaForm.id || Math.random().toString(), 
            sifra: trenutniProizvod.sifra, naziv: trenutniProizvod.naziv,
            kolicina_obracun: parseFloat(stavkaForm.kolicina_obracun), jm_obracun: stavkaForm.jm_obracun
        };
        if (stavkaForm.id) setStavke(stavke.map(s => s.id === stavkaForm.id ? novaStavka : s));
        else setStavke([...stavke, novaStavka]);
        
        setStavkaForm({ id: null, sifra_unos: '', kolicina_obracun: '', jm_obracun: 'm3' });
        setTrenutniProizvod(null);
    };

    const urediStavku = (stavka) => {
        const nadjeni = katalog.find(k => k.sifra === stavka.sifra);
        setTrenutniProizvod(nadjeni || null);
        const tekstZaPolje = nadjeni ? `${nadjeni.sifra} | ${nadjeni.naziv}` : stavka.sifra;
        setStavkaForm({ id: stavka.id, sifra_unos: tekstZaPolje, kolicina_obracun: stavka.kolicina_obracun, jm_obracun: stavka.jm_obracun });
    };

    const ukloniStavku = (id) => setStavke(stavke.filter(s => s.id !== id));

    const snimiOtpremnicu = async () => {
        if(!form.kupac_naziv) return alert("Kupac je obavezan!");
        if(stavke.length === 0) return alert("Otpremnica mora imati stavke!");
        
        const payload = {
            id: form.id.toUpperCase(), broj_veze: form.broj_veze, kupac_naziv: form.kupac_naziv, 
            datum: form.datum, vozac: form.vozac, registracija: form.registracija, napomena: form.napomena, 
            stavke_jsonb: stavke, status: form.status, snimio_korisnik: currentUser.ime_prezime
        };

        if (isEditing) {
            const { error } = await supabase.from('otpremnice').update(payload).eq('id', form.id);
            if(error) return alert("Greška: " + error.message);
            await zapisiU_Log('IZMJENA_OTPREMNICE', `Ažurirana otpremnica ${form.id}`);
            alert("✅ Otpremnica uspješno ažurirana!");
        } else {
            const { error } = await supabase.from('otpremnice').insert([payload]);
            if(error) return alert("Greška pri snimanju: " + error.message);
            await zapisiU_Log('KREIRANA_OTPREMNICA', `Otpremnica ${form.id} za ${form.kupac_naziv}`);
            alert("✅ Otpremnica uspješno kreirana!");
        }
        resetFormu(); load(); setTab('lista');
    };

    const resetFormu = () => {
        setForm({ id: generisiID(), broj_veze: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0], vozac: '', registracija: '', napomena: '', status: 'KREIRANA' });
        setStavke([]); setSkenerInput(''); setIsEditing(false);
    };

    const formatirajDatum = (isoString) => {
        if(!isoString) return ''; const [y, m, d] = isoString.split('-'); return `${d}.${m}.${y}.`;
    };

    const kreirajPDF = () => {
        const odabraniKupac = kupci.find(k => k.naziv === form.kupac_naziv) || null;
        let redovi = stavke.map((s, i) => `
            <tr>
                <td style="font-weight: bold; color: #64748b; text-align: center;">${i+1}.</td>
                <td><b style="color: #0f172a; font-size: 14px;">${s.sifra}</b><br/><span style="color: #64748b; font-size: 11px;">${s.naziv}</span></td>
                <td style="text-align: center; font-size: 18px; font-weight: 900; color: #f97316;">${s.kolicina_obracun} <span style="color: #64748b; font-size: 12px; font-weight: 600;">${s.jm_obracun}</span></td>
            </tr>
        `).join('');

        const htmlSadrzajTabela = `
            <div class="info-grid">
                <div class="info-col">
                    <h4>Kupac / Primalac robe</h4>
                    <p style="font-size: 18px; font-weight: 900; margin-bottom: 5px;">${form.kupac_naziv}</p>
                    <p style="font-weight: 400; color: #475569;">${odabraniKupac?.adresa || ''}</p>
                    <p style="font-weight: 600; color: #0f172a; font-size: 12px; margin-top: 6px;">PDV / ID: ${odabraniKupac?.pdv_broj || 'N/A'}</p>
                </div>
                <div class="info-col" style="text-align: right;">
                    <h4>Detalji Transporta</h4>
                    <p>Vezni Dokument: <span style="font-weight: 600; color: #0f172a;">${form.broj_veze || '-'}</span></p>
                    <p>Ime Vozača: <span style="font-weight: 600; color: #0f172a;">${form.vozac || '-'}</span></p>
                    <p>Vozilo (Reg): <span style="font-weight: 900; color: #f97316;">${form.registracija || '-'}</span></p>
                </div>
            </div>
            <table>
                <thead><tr><th style="width: 5%; text-align: center;">R.B.</th><th>Šifra i Naziv Proizvoda</th><th style="text-align:center;">Isporučena Količina</th></tr></thead>
                <tbody>${redovi}</tbody>
            </table>
            <div style="display: flex; justify-content: space-between; margin-top: 100px; text-align: center; color: #0f172a; font-weight: 600;">
                <div style="width: 25%;"><div style="border-bottom: 1px solid #94a3b8; margin-bottom: 10px; height: 20px;"></div>Isporučio (Vozač)</div>
                <div style="width: 25%;"><div style="border-bottom: 1px solid #94a3b8; margin-bottom: 10px; height: 20px;"></div>Izdao (Magacin)</div>
                <div style="width: 25%;"><div style="border-bottom: 1px solid #94a3b8; margin-bottom: 10px; height: 20px;"></div>Primio (Kupac)</div>
            </div>
            <div class="footer"><div style="width: 100%;"><b style="color: #0f172a;">Napomena uz isporuku:</b><br/>${form.napomena || 'Roba isporučena bez oštećenja.'}</div></div>
        `;
        printDokument('OTPREMNICA', form.id, formatirajDatum(form.datum), htmlSadrzajTabela, '#f97316');
    };

    const pokreniIzmjenu = (o) => {
        setForm({ id: o.id, broj_veze: o.broj_veze || '', kupac_naziv: o.kupac_naziv, datum: o.datum, vozac: o.vozac || '', registracija: o.registracija || '', napomena: o.napomena || '', status: o.status || 'KREIRANA' });
        setStavke(o.stavke_jsonb || []);
        setIsEditing(true); setTab('nova'); window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const renderPoljeHeader = (polje) => {
        if (polje.id === 'veza') return <input value={form.broj_veze} onChange={e=>setForm({...form, broj_veze:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-theme-card rounded-xl text-theme-text outline-none border border-theme-border uppercase focus:border-orange-500" placeholder="Nema veznog dokumenta" />;
        if (polje.id === 'broj') return <input value={form.id} disabled className="w-full h-full min-h-[45px] p-4 bg-theme-panel rounded-xl text-theme-text border border-theme-border font-black disabled:opacity-50" />;
        if (polje.id === 'kupac') return <div className="h-full min-h-[45px]"><SearchableInput value={form.kupac_naziv} onChange={v=>setForm({...form, kupac_naziv:v})} list={kupci.map(k=>k.naziv)} /></div>;
        if (polje.id === 'datum') return <input type="date" value={form.datum} onChange={e=>setForm({...form, datum:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none" />;
        if (polje.id === 'status') return <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-theme-panel rounded-xl text-theme-accent font-black border border-orange-500/50 outline-none uppercase"><option value="KREIRANA">Kreirana</option><option value="ISPORUČENO">Isporučeno</option></select>;
        if (polje.id === 'vozac') return <input value={form.vozac} onChange={e=>setForm({...form, vozac:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-theme-panel rounded-xl text-theme-text border border-theme-border outline-none focus:border-orange-500" placeholder="npr. Marko Marković" />;
        if (polje.id === 'registracija') return <input value={form.registracija} onChange={e=>setForm({...form, registracija:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-theme-panel rounded-xl text-theme-text border border-theme-border outline-none uppercase focus:border-orange-500" placeholder="npr. A12-B-345" />;
        return null;
    };

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 font-bold animate-in fade-in">
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-orange-500" user={user} modulIme="otpremnice" saas={saas} />

            <div className="flex bg-theme-panel p-1.5 rounded-2xl border border-theme-border shadow-inner">
    <button onClick={() => {setTab('nova'); if(!isEditing) resetFormu();}} className={`flex-1 py-3 rounded-xl text-[10px] uppercase font-black transition-all ${tab === 'nova' ? 'bg-theme-accent text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-theme-text'}`}>
        {isEditing ? '✏️ Ažuriranje Otpremnice' : '➕ Nova Otpremnica'}
    </button>
    <button onClick={() => setTab('lista')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase font-black transition-all ${tab === 'lista' ? 'bg-theme-accent text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-theme-text'}`}>
        📋 Pregled Otpremnica
    </button>
</div>

            {tab === 'nova' ? (
                <div className="space-y-4 animate-in slide-in-from-left max-w-4xl mx-auto">
                    
                    {!isEditing && (
                        <div className="bg-theme-card border border-orange-500/50 p-6 rounded-box shadow-2xl relative z-[60]">
                            <label className="text-[10px] text-theme-accent uppercase font-black block mb-2 ml-2">Pametni unos (Skeniraj Ponudu ili Radni Nalog)</label>
                            <div className="flex bg-theme-panel border-2 border-orange-500 rounded-xl overflow-visible focus-within:border-orange-400 transition-all shadow-inner">
                                <input 
                                    value={skenerInput} 
                                    onChange={handleSkenUnos} 
                                    onFocus={() => setPrikaziDrop(true)} 
                                    placeholder="Skeniraj ili ukucaj broj..." 
                                    className="flex-1 p-4 bg-transparent text-sm text-theme-text outline-none uppercase font-black tracking-widest relative z-10" 
                                />
                                <button onClick={() => setIsScanningOverlay(true)} className="px-6 bg-theme-card border-b border-theme-border text-theme-text text-xl hover:opacity-80 transition-all border-l border-orange-500/50 relative z-10">📷</button>
                                
                                {prikaziDrop && skenerInput && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-theme-panel border border-slate-600 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden z-[100] max-h-60 overflow-y-auto text-left">
                                        {dostupniDokumenti.filter(d => d.id.includes(skenerInput) || (d.kupac && d.kupac.toUpperCase().includes(skenerInput))).length === 0 && <div className="p-3 text-xs text-slate-500 text-center">Nema rezultata...</div>}
                                        {dostupniDokumenti
                                            .filter(d => d.id.includes(skenerInput) || (d.kupac && d.kupac.toUpperCase().includes(skenerInput)))
                                            .map(p => (
                                            <div key={p.id} onClick={() => odaberiIzDropdowna(p.id)} className="p-3 border-b border-theme-border hover:bg-theme-card border-b border-theme-border cursor-pointer flex justify-between items-center transition-colors">
                                                <div><span className="text-theme-text font-black">{p.id}</span> <span className="text-[10px] text-orange-300 ml-2 uppercase font-bold">{p.tip}</span></div>
                                                <div className="text-slate-300 text-[10px] font-bold">{p.kupac} | <span className={p.status === 'ZAVRŠENO' ? 'text-emerald-400' : 'text-amber-400'}>{p.status}</span></div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className={`p-6 rounded-box border-2 shadow-2xl space-y-4 transition-all relative z-[40] ${saas.isEditMode ? 'border-dashed border-amber-500 bg-black/20' : 'border-orange-500/30 bg-theme-card backdrop-blur-[var(--glass-blur)]'}`} >
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-theme-accent font-black uppercase text-xs">1. Parametri Otpremnice</h3>
                            {isEditing && <button onClick={resetFormu} className="text-[10px] bg-red-900/30 text-red-400 px-3 py-1 rounded-xl uppercase hover:bg-red-900/50 transition-all">Odustani od izmjena ✕</button>}
                        </div>

                        {saas.isEditMode && (
                            <div className="bg-black/40 p-3 rounded-xl flex flex-wrap gap-4 items-center mb-4 border border-amber-500/30">
                                <label className="text-[10px] text-amber-500 uppercase font-black flex items-center gap-2">Boja Pozadine: <input type="color" value={saas.ui.boja_kartice || '#1e293b'} onChange={e => saas.setUi({...saas.ui, boja_kartice: e.target.value})} className="w-8 h-8 cursor-pointer rounded border-none bg-transparent" /></label>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border-b border-theme-border pb-4 items-start">
                            {aktivnaPolja.map((polje, index) => (
                                <div key={polje.id} className={`relative flex flex-col ${polje.span} transition-all ${saas.isEditMode ? 'border-2 border-dashed border-amber-500 p-2 rounded-xl bg-black/20 resize overflow-auto' : ''}`} style={{ maxWidth: '100%', ...(saas.isEditMode ? { minWidth: '100px', minHeight: '80px' } : {}), width: polje.customWidth || undefined, height: polje.customHeight || undefined }} draggable={saas.isEditMode} onDragStart={(e) => handleDragStart(e, index)} onDragEnter={(e) => handleDragEnter(e, index)} onDragEnd={handleDrop} onDragOver={(e) => e.preventDefault()} onMouseUp={(e) => spremiDimenzije(e, index)}>
                                    {saas.isEditMode && (<div className="flex justify-between items-center mb-2 shrink-0"><span className="text-[9px] text-amber-500 uppercase font-black cursor-move">☰</span><button onClick={() => toggleVelicinaPolja(index)} className="text-[8px] text-amber-500 font-black bg-amber-500/20 px-2 py-1 rounded">ŠIRINA: {polje.span==='col-span-4'?'100%':polje.span==='col-span-2'?'50%':'25%'}</button></div>)}
                                    {saas.isEditMode ? (<input value={polje.label} onChange={(e) => updatePolje(index, 'label', e.target.value)} className="w-full bg-theme-card text-amber-400 p-1 mb-1 rounded border border-amber-500/50 text-[8px] uppercase font-black text-center shrink-0" placeholder="Naslov polja" />) : (polje.label && <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1 shrink-0">{polje.label}</label>)}
                                    <div className={`flex-1 ${saas.isEditMode ? 'opacity-50 pointer-events-none' : ''}`}>{renderPoljeHeader(polje)}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-theme-card p-6 rounded-box border border-theme-border space-y-4 shadow-xl relative z-[30]">
                        <h3 className="text-theme-accent uppercase text-xs">2. Stavke otpremnice (Ručni unos)</h3>
                        
                        <div className="relative mb-3">
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Pronađi proizvod</label>
                            <OTP_SearchableProizvod katalog={katalog} value={stavkaForm.sifra_unos} onChange={handleProizvodSelect} />
                        </div>

                        {trenutniProizvod && (
                            <div className="p-4 bg-blue-900/10 border border-blue-500/30 rounded-2xl animate-in zoom-in-95 space-y-4 shadow-inner">
                                <div className="border-b border-theme-border pb-3">
                                    <p className="text-theme-text text-sm font-black">{trenutniProizvod.sifra} - {trenutniProizvod.naziv}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">Dimenzije: <span className="text-theme-text">{trenutniProizvod.visina}x{trenutniProizvod.sirina}x{trenutniProizvod.duzina}</span></p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Količina za isporuku</label>
                                        <input type="number" value={stavkaForm.kolicina_obracun} onChange={e=>setStavkaForm({...stavkaForm, kolicina_obracun:e.target.value})} placeholder="0.00" className="w-full p-4 bg-black rounded-xl text-lg text-theme-text font-black text-center outline-none border border-theme-border focus:border-blue-500" />
                                    </div>
                                    <div className="w-32">
                                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Jedinica</label>
                                        <select value={stavkaForm.jm_obracun} onChange={e=>setStavkaForm({...stavkaForm, jm_obracun:e.target.value})} className="w-full p-4 bg-theme-panel rounded-xl text-sm text-theme-text font-black outline-none border border-theme-border uppercase"><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option><option value="kom">kom</option></select>
                                    </div>
                                </div>
                                <button onClick={dodajStavku} className={`w-full py-4 text-theme-text font-black rounded-xl text-xs shadow-lg uppercase mt-2 transition-all ${stavkaForm.id ? 'bg-amber-600 hover:bg-amber-500' : 'bg-theme-accent hover:opacity-80'}`}>
                                    {stavkaForm.id ? '✅ Ažuriraj ovu stavku' : '➕ Dodaj na otpremnicu'}
                                </button>
                            </div>
                        )}
                    </div>

                    {stavke.length > 0 && (
                        <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-orange-500/30 shadow-2xl animate-in slide-in-from-bottom">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-theme-accent font-black uppercase text-xs">3. Pregled Otpremnice</h3>
                                <button onClick={kreirajPDF} className="bg-theme-panel text-theme-text px-4 py-2 rounded-xl text-[10px] uppercase font-black border border-slate-600 hover:bg-white hover:text-black transition-all">🖨️ Kreiraj PDF</button>
                            </div>
                            <div className="space-y-3 mb-6">
                                {stavke.map((s, i) => (
                                    <div key={s.id} onClick={() => urediStavku(s)} className="flex justify-between items-center p-4 bg-theme-card border border-theme-border rounded-xl cursor-pointer hover:border-orange-500 transition-all group shadow-md">
                                        <div className="flex items-center gap-4">
                                            <span className="text-slate-500 text-sm font-black">{i+1}.</span>
                                            <div><p className="text-theme-text text-sm font-black">{s.naziv}</p><p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest">{s.sifra}</p></div>
                                        </div>
                                        <div className="flex items-center gap-6 text-right">
                                            <p className="text-theme-accent font-black text-xl">{s.kolicina_obracun} <span className="text-xs text-slate-400">{s.jm_obracun}</span></p>
                                            <button onClick={(e)=>{e.stopPropagation(); ukloniStavku(s.id);}} className="text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 p-2 rounded-lg transition-all font-black">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <textarea value={form.napomena} onChange={e=>setForm({...form, napomena:e.target.value})} placeholder="Napomena na isporuci (opciono)..." className="w-full mt-4 p-4 bg-theme-card border border-theme-border rounded-xl text-xs text-theme-text outline-none focus:border-orange-500 shadow-inner" rows="3"></textarea>
                            <button onClick={snimiOtpremnicu} className={`w-full mt-4 py-6 text-theme-text font-black rounded-box uppercase shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all text-sm tracking-widest ${isEditing ? 'bg-amber-600 hover:bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.4)]' : 'bg-theme-card border-b border-theme-border hover:opacity-80'}`}>
                                {isEditing ? '✅ Snimi izmjene otpremnice' : '🏁 KREIRAJ OTPREMNICU'}
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-theme-border shadow-2xl animate-in slide-in-from-right">
                    <h3 className="text-slate-400 font-black uppercase text-[10px] mb-4">Arhiva Otpremnica</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-2">
                        {otpremnice.length === 0 && <p className="text-center text-slate-500 text-xs col-span-full">Nema kreiranih otpremnica.</p>}
                        {otpremnice.map(o => (
                            <div key={o.id} onClick={() => pokreniIzmjenu(o)} className="p-5 bg-theme-card border border-theme-border rounded-box cursor-pointer hover:border-orange-500 hover:-translate-y-1 transition-all relative overflow-hidden group shadow-lg">
                                <div className="flex justify-between items-start border-b border-theme-border pb-3 mb-3">
                                    <div><p className="text-theme-accent font-black text-base">{o.id}</p><p className="text-theme-text text-xs font-bold mt-1 uppercase">{o.kupac_naziv}</p></div>
                                    <div className="text-right"><p className={`text-[9px] px-3 py-1 rounded-lg font-black uppercase ${o.status === 'ISPORUČENO' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-orange-900/30 text-theme-accent'}`}>{o.status}</p><p className="text-[9px] text-slate-500 uppercase mt-2">{formatirajDatum(o.datum)}</p></div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] text-slate-400 font-bold bg-theme-panel px-2 py-1 rounded">Veza: {o.broj_veze || 'Nema'}</span>
                                    <span className="text-[10px] text-slate-300 font-black">Stavki: {o.stavke_jsonb ? o.stavke_jsonb.length : 0}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {isScanningOverlay && <ScannerOverlay onScan={(text) => { skenirajVezu(null, text); setIsScanningOverlay(false); }} onClose={() => setIsScanningOverlay(false)} />}
        </div>
    );
}