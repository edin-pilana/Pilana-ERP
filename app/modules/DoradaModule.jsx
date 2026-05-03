"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import ScannerOverlay from '../components/ScannerOverlay';
import { printFaznaDeklaracijaPaketa, printDeklaracijaPaketa } from '../utils/printHelpers';
import { useSaaS } from '../utils/useSaaS';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function DimBox({ label, val, set, disabled }) {
    return (
        <div className={`bg-theme-card/80 p-2 rounded-xl border border-theme-border font-bold text-center shadow-inner ${disabled ? 'opacity-50' : ''}`}>
            <span className="text-[8px] text-slate-400 uppercase block mb-1 font-black tracking-widest">{label}</span>
            <input type="number" value={val} onChange={e => set(e.target.value)} disabled={disabled} className="w-full bg-transparent text-theme-text font-black outline-none text-xl text-center" />
        </div>
    );
}

function PD_SearchableRN({ nalozi, value, onSelect, onScanClick }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const wrapperRef = useRef(null);

    useEffect(() => { setSearch(value || ''); }, [value]);
    useEffect(() => { setSelectedIndex(0); }, [search]); 

    useEffect(() => {
        function handleClickOutside(event) { if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false); }
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);
        return () => { document.removeEventListener("mousedown", handleClickOutside); document.removeEventListener("touchstart", handleClickOutside); };
    }, []);

    const safeSearch = (search || '').toString().toUpperCase();
    const filtered = nalozi.filter(n => (n.id || '').toString().toUpperCase().includes(safeSearch) || (n.kupac_naziv || '').toString().toUpperCase().includes(safeSearch));

    const handleKeyDown = (e) => {
        if (!open) { if (e.key === 'ArrowDown') setOpen(true); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev)); } 
        else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0)); } 
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered.length > 0) {
                const sel = filtered[selectedIndex];
                onSelect(sel.id); setSearch(sel.id); setOpen(false);
            }
        } else if (e.key === 'Escape') setOpen(false);
    };

    return (
        <div ref={wrapperRef} className="relative font-black w-full flex bg-theme-panel border border-blue-500/50 rounded-xl overflow-visible focus-within:border-blue-400 transition-all shadow-inner">
            <input value={search} onFocus={() => setOpen(true)} onKeyDown={handleKeyDown} onChange={e => { setSearch(e.target.value); setOpen(true); }} placeholder="Upiši broj naloga/ponude ili skeniraj..." className="flex-1 p-4 bg-transparent text-sm text-theme-text outline-none uppercase font-black tracking-widest relative z-10 min-w-0" />
            <button onClick={onScanClick} className="px-6 bg-blue-600/50 text-blue-300 hover:text-theme-text text-xl hover:bg-blue-500 transition-all border-l border-blue-500/50 relative z-10 shrink-0 backdrop-blur-sm">📷</button>
            {open && search && (
                <div className="absolute top-full left-0 z-[1000] w-full mt-2 bg-slate-800 border border-theme-border rounded-xl shadow-2xl max-h-60 overflow-y-auto text-left custom-scrollbar">
                    {filtered.length === 0 && <div className="p-3 text-xs text-slate-500 text-center">Nema rezultata...</div>}
                    {filtered.map((n, index) => (
                        <div key={n.id} onClick={() => { onSelect(n.id); setSearch(n.id); setOpen(false); }} onMouseEnter={()=>setSelectedIndex(index)} className={`p-3 border-b border-theme-border cursor-pointer transition-colors ${index === selectedIndex ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
                            <div className="text-theme-text text-xs font-black">{n.id}</div>
                            <div className="text-[9px] text-slate-400">{n.kupac_naziv}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function PD_SearchableProizvod({ katalog, value, onSelect, onChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const wrapperRef = useRef(null);

    useEffect(() => { setSearch(value || ''); }, [value]);
    useEffect(() => { setSelectedIndex(0); }, [search]); 

    useEffect(() => {
        function handleClickOutside(event) { if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false); }
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);
        return () => { document.removeEventListener("mousedown", handleClickOutside); document.removeEventListener("touchstart", handleClickOutside); };
    }, []);

    const safeSearch = (search || '').toString().toUpperCase();
    const filtered = katalog.filter(k => (k.sifra || '').toString().toUpperCase().includes(safeSearch) || (k.naziv || '').toString().toUpperCase().includes(safeSearch));

    const handleKeyDown = (e) => {
        if (!open) { if (e.key === 'ArrowDown') setOpen(true); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev)); } 
        else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0)); } 
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered.length > 0) {
                const k = filtered[selectedIndex];
                onSelect(k); setSearch(k.naziv); onChange(k.naziv); setOpen(false);
            } else {
                setOpen(false);
            }
        } else if (e.key === 'Escape') setOpen(false);
    };

    return (
        <div ref={wrapperRef} className="relative font-black w-full">
            <input value={search} onFocus={() => setOpen(true)} onKeyDown={handleKeyDown} onChange={e => { setSearch(e.target.value); onChange(e.target.value); setOpen(true); }} placeholder="Pronađi proizvod ili UNESI SLOBODAN NAZIV..." className="w-full p-3 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none focus:border-emerald-500 uppercase relative z-10" />
            {open && search && (
                <div className="absolute top-full left-0 z-[1000] w-full mt-1 bg-slate-800 border border-theme-border rounded-xl shadow-2xl max-h-60 overflow-y-auto text-left custom-scrollbar">
                    {filtered.map((k, index) => (
                        <div key={k.sifra} onClick={() => { onSelect(k); setSearch(k.naziv); onChange(k.naziv); setOpen(false); }} onMouseEnter={()=>setSelectedIndex(index)} className={`p-3 border-b border-theme-border cursor-pointer transition-colors ${index === selectedIndex ? 'bg-emerald-600' : 'hover:bg-slate-700'}`}>
                            <div className="text-theme-text text-xs font-black">{k.sifra} - {k.naziv}</div>
                            <div className="text-[9px] text-slate-400">Dim: {k.visina}x{k.sirina}x{k.duzina} | Baza: {k.default_jedinica}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function PD_SmartSearchableInput({ value, onChange, list = [] }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    const [selectedIndex, setSelectedIndex] = useState(0); 
    const wrapperRef = useRef(null);

    useEffect(() => { setSearch(value || ''); }, [value]);
    useEffect(() => { setSelectedIndex(0); }, [search]); 

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);
        return () => { document.removeEventListener("mousedown", handleClickOutside); document.removeEventListener("touchstart", handleClickOutside); };
    }, []);

    const filtered = list.filter(item => (item || '').toString().toUpperCase().includes((search || '').toString().toUpperCase()));

    const handleKeyDown = (e) => {
        if (!open) { if (e.key === 'ArrowDown') setOpen(true); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev)); } 
        else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0)); } 
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered.length > 0) { onChange(filtered[selectedIndex]); setSearch(filtered[selectedIndex]); setOpen(false); }
        } else if (e.key === 'Escape') setOpen(false);
    };

    return (
        <div ref={wrapperRef} className="relative w-full h-full">
            <input value={search} onChange={e => { setSearch(e.target.value); setOpen(true); onChange(e.target.value); }} onFocus={() => setOpen(true)} onKeyDown={handleKeyDown} placeholder="Pronađi..." className="w-full h-full min-h-[45px] p-2 bg-transparent text-xs text-theme-text outline-none font-black uppercase min-w-0 relative z-10" />
            {open && filtered.length > 0 && (
                <div className="absolute top-full left-0 z-[1000] w-full mt-1 bg-slate-800 border border-theme-border rounded-xl shadow-2xl max-h-60 overflow-y-auto text-left custom-scrollbar">
                    {filtered.map((item, index) => (
                        <div key={index} onClick={() => {onChange(item); setSearch(item); setOpen(false);}} onMouseEnter={() => setSelectedIndex(index)} className={`p-3 border-b border-theme-border cursor-pointer text-xs font-black uppercase transition-colors ${index === selectedIndex ? 'bg-emerald-600 text-theme-text' : 'text-slate-300 hover:bg-slate-700'}`}>
                            {item}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

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
            zastoj_min: parseInt(form.zastoj_min) || 0, napomena: form.napomena, snimio: user.ime_prezime
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
        if (polje.id === 'pocetak') return <input type="time" value={form.vrijeme_od} onChange={e => setForm({...form, vrijeme_od: e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none focus:border-amber-500" />;
        if (polje.id === 'kraj') return <input type="time" value={form.vrijeme_do} onChange={e => setForm({...form, vrijeme_do: e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none focus:border-amber-500" />;
        if (polje.id === 'zastoj') return <input type="number" value={form.zastoj_min} onChange={e => setForm({...form, zastoj_min: e.target.value})} placeholder="0" className="w-full h-full min-h-[45px] p-3 bg-red-900/20 rounded-xl text-xs text-red-400 font-black border border-red-500/50 outline-none" />;
        if (polje.id === 'napomena') return <input type="text" value={form.napomena} onChange={e => setForm({...form, napomena: e.target.value})} placeholder="Održavanje, kvar..." className="w-full h-full min-h-[45px] p-3 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none focus:border-amber-500" />;
        return null;
    };

    return (
        <div className={`bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-[2.5rem] border shadow-2xl space-y-4 mt-6 transition-all ${saas.isEditMode ? 'ring-2 ring-amber-500 border-amber-500/50' : 'border-theme-border'}`}>
            <h3 className="text-amber-500 font-black uppercase text-xs">⚙️ EVIDENCIJA RADA I ZASTOJA MAŠINE</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-theme-card p-4 rounded-2xl border border-slate-800 items-start">
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
                            <input value={polje.label} onChange={(e) => updatePolje(index, 'label', e.target.value, 'polja_dnevnik')} className="w-full bg-theme-card text-amber-400 p-1 mb-1 rounded border border-amber-500/50 text-[8px] uppercase font-black text-center shrink-0" placeholder="Ostavite prazno za bez naslova" />
                        ) : (
                            polje.label && <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1 shrink-0">{polje.label}</label>
                        )}
                        <div className={`flex-1 ${saas.isEditMode ? 'opacity-50 pointer-events-none' : ''}`}>{renderDnevnikPolje(polje)}</div>
                    </div>
                ))}
                <button onClick={snimiZastojIliRad} className={`w-full py-3 bg-amber-600 text-theme-text font-black rounded-xl text-[10px] uppercase shadow-lg hover:bg-amber-500 ${saas.isEditMode ? 'opacity-50 pointer-events-none col-span-4' : 'col-span-4 md:col-span-4 mt-2'}`}>➕ Dodaj Zapis u Dnevnik</button>
            </div>
            
            <div className="space-y-2 mt-4">
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

export default function DoradaModule({ user, header, setHeader, onExit }) {
    
    const saas = useSaaS('dorada_modul', {
        boja_kartice: '#1e293b',
        boja_teksta_ulaz: 'text-red-500',
        boja_teksta_izlaz: 'text-emerald-500',
        naslov_ulaz: 'SKENIRAJ ULAZNI PAKET (SIROVINA)',
        naslov_izlaz: 'QR IZLAZNOG PAKETA (GOTOVO)',
        polja_radnici: [
            { id: 'operater', label: '👨‍🔧 ODGOVORNI RADNIK (ZA MAŠINOM)', span: 'col-span-1' },
            { id: 'viljuskarista', label: '🚜 VILJUŠKARISTA', span: 'col-span-1' }
        ],
        polja_dnevnik: [
            { id: 'pocetak', label: 'POČETAK', span: 'col-span-1' },
            { id: 'kraj', label: 'ZAVRŠETAK', span: 'col-span-1' },
            { id: 'zastoj', label: 'ZASTOJ (MINUTA)', span: 'col-span-1' },
            { id: 'napomena', label: 'NAPOMENA / RAZLOG', span: 'col-span-1', customWidth: '100%', span: 'col-span-4' }
        ]
    });

    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    const handleDragStart = (e, index, lista) => { dragItem.current = { index, lista }; };
    const handleDragEnter = (e, index) => { dragOverItem.current = index; };
    const handleDrop = (listaIme) => {
        if(!dragItem.current || dragOverItem.current === null || dragItem.current.lista !== listaIme) return;
        const aktuelnaLista = saas.ui[listaIme]?.length > 0 ? saas.ui[listaIme] : saas.defaultConfig[listaIme];
        const novaLista = [...aktuelnaLista];
        const premjesteniItem = novaLista[dragItem.current.index];
        novaLista.splice(dragItem.current.index, 1);
        novaLista.splice(dragOverItem.current, 0, premjesteniItem);
        dragItem.current = null; dragOverItem.current = null;
        saas.setUi({...saas.ui, [listaIme]: novaLista});
    };

    const updatePolje = (index, key, val, listaIme) => {
        const aktuelnaLista = saas.ui[listaIme]?.length > 0 ? saas.ui[listaIme] : saas.defaultConfig[listaIme];
        const novaLista = [...aktuelnaLista];
        novaLista[index][key] = val;
        saas.setUi({...saas.ui, [listaIme]: novaLista});
    };

    const toggleVelicinaPolja = (index, listaIme) => {
        const aktuelnaLista = saas.ui[listaIme]?.length > 0 ? saas.ui[listaIme] : saas.defaultConfig[listaIme];
        const novaLista = [...aktuelnaLista];
        const trenutno = novaLista[index].span;
        novaLista[index].span = trenutno === 'col-span-1' ? 'col-span-2' : (trenutno === 'col-span-2' ? 'col-span-4' : 'col-span-1');
        saas.setUi({...saas.ui, [listaIme]: novaLista});
    };

    const spremiDimenzije = (e, index, listaIme) => {
        if (!saas.isEditMode) return;
        const w = e.currentTarget.style.width;
        const h = e.currentTarget.style.height;
        if (w || h) {
            const aktuelnaLista = saas.ui[listaIme]?.length > 0 ? saas.ui[listaIme] : saas.defaultConfig[listaIme];
            const novaLista = [...aktuelnaLista];
            if (w) novaLista[index].customWidth = w;
            if (h) novaLista[index].customHeight = h;
            saas.setUi({...saas.ui, [listaIme]: novaLista});
        }
    };

    const [ulazScan, setUlazScan] = useState('');
    const [izlazScan, setIzlazScan] = useState('');
    const [radniNalog, setRadniNalog] = useState('');
    const [tipNaloga, setTipNaloga] = useState('');
    const [rnStavke, setRnStavke] = useState([]);
    
    const [katalog, setKatalog] = useState([]);
    const [aktivniNalozi, setAktivniNalozi] = useState([]);

    const [activeUlazIds, setActiveUlazIds] = useState([]);
    const [ulazneStavke, setUlazneStavke] = useState([]); 
    const [predlozeniPaketi, setPredlozeniPaketi] = useState([]);
    
    const [razduziZapis, setRazduziZapis] = useState(null);
    const [razduziMod, setRazduziMod] = useState('potroseno'); 
    const [razduziKol, setRazduziKol] = useState('');
    const [razduziJm, setRazduziJm] = useState('kom'); 

    const [activeIzlazIds, setActiveIzlazIds] = useState([]);
    const [selectedIzlazId, setSelectedIzlazId] = useState('');
    const [izlazPackageItems, setIzlazPackageItems] = useState([]);
    
    const [activeEditItem, setActiveEditItem] = useState(null);
    const [updateMode, setUpdateMode] = useState('dodaj');
    
    const [form, setForm] = useState({ naziv: '', debljina: '', sirina: '', duzina: '', kolicina_ulaz: '', jm: 'kom', rn_jm: 'm3', rn_stavka_id: null, naruceno: 0, napravljeno: 0 });
    const [isScanning, setIsScanning] = useState(false);
    const [scanTarget, setScanTarget] = useState('');

    const [dostupneOznake, setDostupneOznake] = useState([]); 
    const [odabraneOznake, setOdabraneOznake] = useState([]);

    const izlazTimerRef = useRef(null);
    const ulazTimerRef = useRef(null);

    // OVDJE SU SADA PRAVI RADNICI UZ ULOGU DORADE
    const [operater, setOperater] = useState('');
    const [viljuskarista, setViljuskarista] = useState('');
    const [radniciList, setRadniciList] = useState([]);

    const handleOperaterChange = async (novoIme) => {
        if (header?.masina) {
            await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('masina_naziv', header.masina).eq('uloga', 'operater_dorada').is('vrijeme_odjave', null);
            if (novoIme) await supabase.from('aktivni_radnici').insert([{ radnik_ime: novoIme, masina_naziv: header.masina, vrijeme_prijave: new Date().toISOString(), uloga: 'operater_dorada' }]);
            window.dispatchEvent(new Event('radnici_updated')); 
        }
        setOperater(novoIme); localStorage.setItem('dorada_operater', novoIme);
    };
    
    const handleViljuskaristaChange = async (novoIme) => {
        if (header?.masina) {
            await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('masina_naziv', header.masina).eq('uloga', 'viljuskarista_dorada').is('vrijeme_odjave', null);
            if (novoIme) await supabase.from('aktivni_radnici').insert([{ radnik_ime: novoIme, masina_naziv: header.masina, vrijeme_prijave: new Date().toISOString(), uloga: 'viljuskarista_dorada' }]);
            window.dispatchEvent(new Event('radnici_updated')); 
        }
        setViljuskarista(novoIme); localStorage.setItem('dorada_viljuskarista', novoIme);
    };

    useEffect(() => {
        supabase.from('radnici').select('ime_prezime').then(({data}) => setRadniciList(data ? data.map(r=>r.ime_prezime) : []));
        supabase.from('katalog_proizvoda').select('*').then(({data}) => setKatalog(data || []));
        supabase.from('radni_nalozi').select('id, kupac_naziv, status, tip_naloga, stavke_jsonb, tehnologija_jsonb').neq('status', 'ZAVRŠENO').then(({data}) => setAktivniNalozi(data || []));
        ucitajSveZapoocetePakete();
    }, [header?.masina]);

    const ucitajSveZapoocetePakete = async () => {
        if (!header?.masina) { setActiveIzlazIds([]); return; }
        const { data } = await supabase.from('paketi')
            .select('paket_id')
            .is('closed_at', null)
            .eq('masina', header.masina); 
            
        if (data && data.length > 0) {
            const jedinstveniPaketi = [...new Set(data.map(p => p.paket_id))];
            setActiveIzlazIds(jedinstveniPaketi);
        } else {
            setActiveIzlazIds([]);
        }
    };

    useEffect(() => {
        const fetchMasinaAtribute = async () => {
            if (!header?.masina) return;
            const { data } = await supabase.from('masine').select('atributi_paketa').eq('naziv', header.masina).maybeSingle();
            setDostupneOznake(data?.atributi_paketa || []);
            setOdabraneOznake([]); 
        };
        fetchMasinaAtribute();

        // UČITAVAMO OPERATERA I VILJUŠKARISTU SAMO ZA OVU MAŠINU U DORADI
        const ucitajDezurneRadnike = async () => {
            if (!header?.masina) return;
            const { data } = await supabase.from('aktivni_radnici').select('radnik_ime, uloga').eq('masina_naziv', header.masina).is('vrijeme_odjave', null);
            if (data) {
                const o = data.find(r => r.uloga === 'operater_dorada');
                const v = data.find(r => r.uloga === 'viljuskarista_dorada');
                if (o) { setOperater(o.radnik_ime); localStorage.setItem('dorada_operater', o.radnik_ime); }
                if (v) { setViljuskarista(v.radnik_ime); localStorage.setItem('dorada_viljuskarista', v.radnik_ime); }
            }
        };
        ucitajDezurneRadnike();
    }, [header?.masina]);

    useEffect(() => {
        const fetchSve = async () => {
            if (!header?.masina) return;
            
            const { data: paks } = await supabase.from('paketi')
                .select('*')
                .gt('kolicina_final', 0)
                .is('closed_at', null)
                .neq('masina', header.masina)
                .order('created_at', { ascending: false })
                .limit(100);
                
            const { data: techData } = await supabase.from('tehnologija_katalog').select('finalna_sifra, faze_jsonb');

            let validni = paks || [];

            if (radniNalog && tipNaloga === 'FAZNI') {
                validni = validni.filter(p => p.broj_veze === radniNalog);

                validni = validni.filter(p => {
                    const katItem = katalog.find(k => k.naziv === p.naziv_proizvoda);
                    if (!katItem) return true; 
                    
                    const bom = techData?.find(t => t.finalna_sifra === katItem.sifra);
                    if (!bom || !bom.faze_jsonb) return true; 
                    
                    const currIdx = bom.faze_jsonb.findIndex(f => f.masina.toUpperCase() === header.masina.toUpperCase());
                    
                    if (currIdx > 0) {
                        const prevMasina = bom.faze_jsonb[currIdx - 1].masina.toUpperCase();
                        return p.masina?.toUpperCase() === prevMasina;
                    }
                    return true; 
                });
            } else if (radniNalog && tipNaloga !== 'FAZNI') {
                // Slobodni režim
            }

            setPredlozeniPaketi(validni);
        };
        fetchSve();
    }, [header?.masina, radniNalog, tipNaloga, katalog]);

    const handleNalogSelect = async (val) => {
        if(!val) {
            setRadniNalog('');
            setTipNaloga('');
            setRnStavke([]);
            setPredlozeniPaketi([]);
            ucitajSveZapoocetePakete();
            return;
        }
        setRadniNalog(val);
        const {data} = await supabase.from('radni_nalozi').select('*').eq('id', val.toUpperCase()).maybeSingle();
        
        if (data) {
            setTipNaloga(data.tip_naloga || ''); 
            
            const ucitaneStavke = data.stavke_jsonb || data.stavke || [];
            const tehnologija = data.tehnologija_jsonb || {};
            const isFazni = data.tip_naloga === 'FAZNI';
            let mapiraneStavke = [];

            if (ucitaneStavke.length > 0) {
                ucitaneStavke.forEach(s => {
                    const katItem = katalog.find(k => k.sifra === s.sifra) || {};
                    let dimenzije = katItem.sifra ? `${katItem.visina || '-'}x${katItem.sirina || '-'}x${katItem.duzina || '-'}` : 'Nema u katalogu';
                    let naruceno = parseFloat(s.kolicina_obracun || s.kolicina || 0);
                    let jm = s.jm_obracun || s.jm_unos || 'm3';
                    let oznake = [];
                    let napravljeno = 0;
                    let skica = null;

                    if (isFazni) {
                        const fazaZaOvuMasinu = (tehnologija[s.id] || []).find(f => f.masina?.toUpperCase() === header.masina?.toUpperCase());
                        if (!fazaZaOvuMasinu) return; 

                        dimenzije = fazaZaOvuMasinu.dimenzija || dimenzije;
                        naruceno = parseFloat(fazaZaOvuMasinu.kolicina || 0);
                        jm = fazaZaOvuMasinu.jm || jm;
                        oznake = fazaZaOvuMasinu.oznake || [];
                        napravljeno = parseFloat(s.napravljeno_po_fazama?.[header.masina] || 0);
                        
                        skica = fazaZaOvuMasinu.skica_url || fazaZaOvuMasinu.dokument_url || s.skica_url || s.dokument_url;
                    } else {
                        napravljeno = parseFloat(s.napravljeno || 0);
                        skica = s.skica_url || s.dokument_url;
                    }

                    const v = parseFloat(katItem.visina) || 0; const sir = parseFloat(katItem.sirina) || 0; const d = parseFloat(katItem.duzina) || 0;
                    const vol1kom = (v > 0 && sir > 0 && d > 0) ? (v/100) * (sir/100) * (d/100) : 0;

                    mapiraneStavke.push({
                        id: s.id, 
                        sifra_proizvoda: s.sifra, 
                        naziv_proizvoda: s.naziv, 
                        jm: jm, 
                        naruceno: naruceno, 
                        napravljeno: napravljeno,
                        dimenzije: dimenzije,
                        vol1kom: vol1kom,
                        predlozene_oznake: oznake,
                        isFazni: isFazni,
                        skica_url: skica 
                    });
                });
                
                if(mapiraneStavke.length === 0 && isFazni) {
                    alert(`⚠️ Ovaj nalog ne sadrži stavke predviđene za mašinu: ${header.masina}`);
                }
                setRnStavke(mapiraneStavke);

            } else { alert(`Nalog ${val} nema stavki!`); setRnStavke([]); setTipNaloga(''); }
        } else { alert(`Nalog ${val} ne postoji!`); setRnStavke([]); setTipNaloga(''); }
    };

    const handleStavkaSelect = async (stavka) => {
        let deb = '', sir = '', duz = '';
        
        if (stavka.isFazni && stavka.dimenzije && stavka.dimenzije !== 'Nema u katalogu') {
            const parts = stavka.dimenzije.split(/x|\*/i); 
            if (parts.length >= 3) { deb = parts[0].trim(); sir = parts[1].trim(); duz = parts[2].trim(); }
        } else {
            const {data: kat} = await supabase.from('katalog_proizvoda').select('*').eq('sifra', stavka.sifra_proizvoda).maybeSingle();
            deb = kat?.visina||''; sir = kat?.sirina||''; duz = kat?.duzina||'';
        }

        setForm({ 
            ...form, 
            naziv: stavka.naziv_proizvoda, 
            debljina: deb, sirina: sir, duzina: duz, 
            jm: 'kom', rn_jm: stavka.jm, rn_stavka_id: stavka.id, 
            naruceno: parseFloat(stavka.naruceno).toFixed(4), 
            napravljeno: parseFloat(stavka.napravljeno || 0).toFixed(4) 
        });

        if (stavka.predlozene_oznake && stavka.predlozene_oznake.length > 0) {
            setOdabraneOznake(stavka.predlozene_oznake);
        } else {
            setOdabraneOznake([]);
        }
    };

    const processUlaz = async (val) => {
        const id = val.toUpperCase().trim();
        if (activeUlazIds.includes(id)) { setUlazScan(''); return; }
        
        const { data, error } = await supabase.from('paketi').select('*').eq('paket_id', id).gt('kolicina_final', 0);
        
        if (error) { alert(`❌ GREŠKA BAZE PRI UČITAVANJU: ${error.message}`); setUlazScan(''); return; }

        if (data && data.length > 0) { 
            const paket = data[0];
            setActiveUlazIds(prev => [...prev, id]); 
            setUlazneStavke(prev => [...prev, ...data]); 
            setUlazScan(''); 

            if (paket.broj_veze && !radniNalog) {
                if(window.confirm(`Skenirani paket pripada Radnom Nalogu: ${paket.broj_veze}\nŽelite li automatski učitati taj nalog na mašinu?`)) {
                    handleNalogSelect(paket.broj_veze);
                }
            }
        } else { 
            alert(`⚠️ ULAZNI paket ${id} ne postoji u bazi, ili je njegova količina nula (potrošen)!`); 
            setUlazScan(''); 
        }
    };

    const handleUlazInput = (val, isEnter = false) => {
        setUlazScan(val);
        if(ulazTimerRef.current) clearTimeout(ulazTimerRef.current);
        if(!val) return;
        if (isEnter) processUlaz(val);
        else ulazTimerRef.current = setTimeout(() => processUlaz(val), 2000);
    };

    const potvrdiRazduzivanje = async () => {
        if (!razduziKol || isNaN(razduziKol)) return alert("Unesite ispravnu količinu (broj)!");
        const unos = parseFloat(razduziKol.toString().replace(',', '.'));
        if (unos < 0) return alert("Količina ne može biti negativna!");

        const v = parseFloat(razduziZapis.debljina) || 1; const s = parseFloat(razduziZapis.sirina) || 1; const d = parseFloat(razduziZapis.duzina) || 1;

        let unosM3 = unos;
        if (razduziJm === 'kom') unosM3 = unos * (v/100) * (s/100) * (d/100);
        else if (razduziJm === 'm2') unosM3 = unos * (v/100);
        else if (razduziJm === 'm1') unosM3 = unos * (v/100) * (s/100);

        let preostalo = 0;
        const trenutnoNaStanju = parseFloat(razduziZapis.kolicina_final);

        if (razduziMod === 'potroseno') preostalo = trenutnoNaStanju - unosM3;
        else if (razduziMod === 'ostalo') preostalo = unosM3;

        if (preostalo < 0) preostalo = 0;
        const novaKol = preostalo <= 0.001 ? 0 : preostalo;

        if (novaKol === 0) {
            if(!window.confirm(`Stanje ove stavke će pasti na NULU i biće potpuno razdužena sa ulaza.\nDa li ste sigurni?`)) return;
        }

        const { error } = await supabase.from('paketi').update({ kolicina_final: novaKol.toFixed(3) }).eq('id', razduziZapis.id);
        if (error) return alert("Greška pri razduživanju baze: " + error.message);

        const { data } = await supabase.from('paketi').select('*').in('paket_id', activeUlazIds).gt('kolicina_final', 0);
        setUlazneStavke(data || []);
        setRazduziZapis(null); setRazduziKol('');
    };

    const ukloniIzAktivnihUlaza = (paket_id) => {
        setActiveUlazIds(prev => prev.filter(id => id !== paket_id));
        setUlazneStavke(prev => prev.filter(s => s.paket_id !== paket_id));
    };

    const processIzlaz = async (val) => {
        const id = val.toUpperCase().trim();
        if (!activeIzlazIds.includes(id)) {
            const { data: existing } = await supabase.from('paketi').select('*').eq('paket_id', id);
            if (existing && existing.length > 0) {
                const spisak = existing.map(i => `- ${i.naziv_proizvoda}: ${i.kolicina_final} ${i.jm}`).join('\n');
                if (!window.confirm(`📦 PAKET VEĆ POSTOJI: ${id}\n\nTrenutno sadrži:\n${spisak}\n\nDa li želite AŽURIRATI ovaj paket?\n(OK = Ažuriraj, Cancel = Poništi unos)`)) { 
                    setIzlazScan(''); return; 
                }
            }
            setActiveIzlazIds(p => [...p, id]);
        }
        setSelectedIzlazId(id); fetchIzlaz(id); setIzlazScan('');
    };

    const handleIzlazInput = (val, isEnter = false) => {
        setIzlazScan(val);
        if (izlazTimerRef.current) clearTimeout(izlazTimerRef.current);
        if (!val) return;
        if (isEnter) processIzlaz(val);
        else izlazTimerRef.current = setTimeout(() => processIzlaz(val), 2000);
    };

    const fetchIzlaz = async (pid) => { 
        const { data } = await supabase.from('paketi').select('*').eq('paket_id', pid); 
        setIzlazPackageItems(data || []); 
        if (data && data.length > 0 && data[0].broj_veze && !radniNalog) {
            handleNalogSelect(data[0].broj_veze);
        }
    };

    const toggleOznaka = (o) => { setOdabraneOznake(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o]); };

    const saveIzlaz = async () => {
        if (!selectedIzlazId) return alert("Prvo skenirajte IZLAZNI PAKET!");
        if (activeUlazIds.length === 0 && !window.confirm("Niste učitali nijedan ULAZNI paket (sirovinu). Da li sigurno želite snimiti izlaz?")) return;
        if (!form.kolicina_ulaz) return alert("Unesite količinu prije snimanja!");

        const timeNow = new Date().toLocaleTimeString('de-DE');
        const unosKol = parseFloat(form.kolicina_ulaz);
        const v = parseFloat(form.debljina) || 1; const s = parseFloat(form.sirina) || 1; const d = parseFloat(form.duzina) || 1;

        let komada = unosKol;
        if (form.jm === 'm3') komada = unosKol / ((v/100) * (s/100) * (d/100));
        else if (form.jm === 'm2') komada = unosKol / ((s/100) * (d/100));
        else if (form.jm === 'm1') komada = unosKol / (d/100);

        const qtyZaPaket = parseFloat((komada * (v/100) * (s/100) * (d/100)).toFixed(3));

        let isNusProizvod = false;
        let currentRnStavka = null;

        if (form.rn_stavka_id) {
            currentRnStavka = rnStavke.find(rs => rs.id === form.rn_stavka_id);
            if (currentRnStavka && currentRnStavka.naziv_proizvoda !== form.naziv) isNusProizvod = true; 
        } else if (radniNalog) {
            isNusProizvod = true; 
        }

        if (currentRnStavka && !isNusProizvod && !activeEditItem && !activeUlazIds.includes(selectedIzlazId)) {
            const vecNapravljeno = parseFloat(currentRnStavka.napravljeno) || 0;
            const naruceno = parseFloat(currentRnStavka.naruceno) || 0;
            
            let kolikoSadPravimo = komada;
            if (currentRnStavka.jm === 'm3') kolikoSadPravimo = qtyZaPaket;
            else if (currentRnStavka.jm === 'm2') kolikoSadPravimo = komada * (s/100) * (d/100);
            else if (currentRnStavka.jm === 'm1') kolikoSadPravimo = komada * (d/100);

            if ((vecNapravljeno + kolikoSadPravimo) > naruceno) {
                const preostalo = naruceno - vecNapravljeno;
                if (!window.confirm(`⚠️ UPOZORENJE: PRELAZITE NORMU!\n\nZa ovaj Radni Nalog je preostalo samo: ${preostalo.toFixed(3)} ${currentRnStavka.jm}.\nVi pokušavate dodati: ${kolikoSadPravimo.toFixed(3)} ${currentRnStavka.jm}.\n\nDa li ste sigurni da želite napraviti ovaj višak?`)) {
                    return; 
                }
            }
        }

        const { data: aktuelniRadnici } = await supabase.from('aktivni_radnici').select('radnik_ime').eq('masina_naziv', header.masina).is('vrijeme_odjave', null);
        const ostaliRadnici = aktuelniRadnici ? aktuelniRadnici.map(r => r.radnik_ime).filter(ime => ime !== operater && ime !== viljuskarista) : [];
        const sviRadniciPilana = [operater, viljuskarista, ...ostaliRadnici].filter(Boolean).join(', ');

        if (activeEditItem) {
            const newM3 = updateMode === 'dodaj' ? parseFloat(activeEditItem.kolicina_final) + qtyZaPaket : parseFloat(activeEditItem.kolicina_final) - qtyZaPaket;
            
            const { error } = await supabase.from('paketi').update({ 
                kolicina_final: parseFloat(newM3.toFixed(3)), 
                vrijeme_tekst: timeNow, 
                snimio_korisnik: user?.ime_prezime || 'Nepoznat',
                radnici_pilana: sviRadniciPilana, 
                brentista: operater, 
                viljuskarista: viljuskarista,
                oznake: odabraneOznake,
                broj_veze: radniNalog || activeEditItem.broj_veze,
                je_nusproizvod: activeEditItem.je_nusproizvod,
                masina: header.masina 
            }).eq('id', activeEditItem.id);
            
            if (error) return alert("❌ GREŠKA PRI AŽURIRANJU PAKETA: " + error.message);
        } else {
            const { error } = await supabase.from('paketi').insert([{ 
                paket_id: selectedIzlazId, naziv_proizvoda: form.naziv, debljina: form.debljina, sirina: form.sirina, duzina: form.duzina, 
                kolicina_ulaz: form.kolicina_ulaz, jm: form.jm, kolicina_final: qtyZaPaket, 
                mjesto: header.mjesto, masina: header.masina, snimio_korisnik: user?.ime_prezime || 'Nepoznat',
                radnici_pilana: sviRadniciPilana, brentista: operater, viljuskarista: viljuskarista,
                vrijeme_tekst: timeNow, datum_yyyy_mm: header.datum,
                ai_sirovina_ids: activeUlazIds.join(','), oznake: odabraneOznake, broj_veze: radniNalog,
                je_nusproizvod: isNusProizvod 
            }]);
            
            if (error) return alert("❌ GREŠKA PRI SNIMANJU PAKETA U BAZU: " + error.message);
            
            if(currentRnStavka && !isNusProizvod) {
                const rn_jm = form.rn_jm || 'm3';
                let napravljenoZaRN = komada;

                if (rn_jm === 'm3') napravljenoZaRN = komada * (v/100) * (s/100) * (d/100);
                else if (rn_jm === 'm2') napravljenoZaRN = komada * (s/100) * (d/100);
                else if (rn_jm === 'm1') napravljenoZaRN = komada * (d/100);

                const {data: rn} = await supabase.from('radni_nalozi').select('stavke_jsonb, tip_naloga').eq('id', radniNalog.toUpperCase()).maybeSingle();
                if (rn && rn.stavke_jsonb) {
                    const isFazni = rn.tip_naloga === 'FAZNI';
                    const azuriraneStavke = rn.stavke_jsonb.map(st => {
                        if (st.id === form.rn_stavka_id) {
                            if (isFazni) {
                                const trenutnoFaza = parseFloat(st.napravljeno_po_fazama?.[header.masina] || 0);
                                return { ...st, napravljeno_po_fazama: { ...(st.napravljeno_po_fazama || {}), [header.masina]: parseFloat((trenutnoFaza + napravljenoZaRN).toFixed(4)) } };
                            } else {
                                const novaKol = (parseFloat(st.napravljeno) || 0) + napravljenoZaRN;
                                return { ...st, napravljeno: parseFloat(novaKol.toFixed(4)) };
                            }
                        }
                        return st;
                    });
                    await supabase.from('radni_nalozi').update({ stavke_jsonb: azuriraneStavke }).eq('id', radniNalog.toUpperCase());
                }
                handleNalogSelect(radniNalog);
                setForm(f => ({ ...f, napravljeno: (parseFloat(f.napravljeno) + napravljenoZaRN).toFixed(4) }));
            }
        }
        fetchIzlaz(selectedIzlazId); setForm(f => ({...f, kolicina_ulaz: ''})); setOdabraneOznake([]); setActiveEditItem(null);
    };

    const obrisiStavkuIzPaketa = async (item, e) => {
        e.stopPropagation();
        if(!window.confirm(`Da li ste sigurni da želite OBRISATI stavku iz ovog paketa?\n(Napomena: Količina na Radnom Nalogu se neće automatski umanjiti, korigujte je ručno po potrebi!)`)) return;
        await supabase.from('paketi').delete().eq('id', item.id);
        fetchIzlaz(selectedIzlazId);
    };

    const zakljuciPaket = async (pid) => {
        if(izlazPackageItems.length === 0) {
            setActiveIzlazIds(p => p.filter(x => x !== pid));
            if (selectedIzlazId === pid) setSelectedIzlazId('');
            alert(`Prazan paket ${pid} je zatvoren i oslobođen.`);
            return;
        }
        if (window.confirm(`ZAKLJUČITI paket ${pid}?`)) {
            await supabase.from('paketi').update({ closed_at: new Date().toISOString() }).eq('paket_id', pid);
            
            if (window.confirm(`📦 Paket uspješno zaključen!\n\nŽelite li odmah isprintati A5 deklaraciju za ovaj paket?`)) {
                
                const stavkaNaloga = rnStavke.find(s => s.naziv_proizvoda === izlazPackageItems[0]?.naziv_proizvoda);
                if (stavkaNaloga && stavkaNaloga.isFazni) {
                    supabase.from('radni_nalozi').select('tehnologija_jsonb').eq('id', radniNalog).single().then(({data: rnDb}) => {
                        const teh = rnDb?.tehnologija_jsonb?.[stavkaNaloga.id] || [];
                        printFaznaDeklaracijaPaketa(pid, izlazPackageItems, radniNalog, header.masina, teh);
                    });
                } else {
                    printDeklaracijaPaketa(pid, izlazPackageItems, radniNalog);
                }
            }
            setActiveIzlazIds(p => p.filter(x => x !== pid));
            if (selectedIzlazId === pid) { setSelectedIzlazId(''); setIzlazPackageItems([]); }
        }
    };

    const otkaziPaket = (pid) => {
        if(window.confirm(`Ukloniti paket ${pid} sa ekrana? (Ostat će u bazi kao Započet)`)) {
            setActiveIzlazIds(p => p.filter(x => x !== pid));
            if(selectedIzlazId === pid) setSelectedIzlazId('');
        }
    };

    const ulazM3 = useMemo(() => {
        return ulazneStavke.reduce((sum, p) => sum + parseFloat(p.kolicina_final || 0), 0).toFixed(3);
    }, [ulazneStavke]);

    const izlazM3 = useMemo(() => {
        return izlazPackageItems.reduce((sum, p) => sum + parseFloat(p.kolicina_final || 0), 0).toFixed(3);
    }, [izlazPackageItems]);

    const livePreracunM3 = useMemo(() => {
        if(!razduziKol || isNaN(razduziKol) || !razduziZapis) return 0;
        const unos = parseFloat(razduziKol);
        const v = parseFloat(razduziZapis.debljina) || 1; const s = parseFloat(razduziZapis.sirina) || 1; const d = parseFloat(razduziZapis.duzina) || 1;
        if (razduziJm === 'kom') return unos * (v/100) * (s/100) * (d/100);
        if (razduziJm === 'm2') return unos * (v/100);
        if (razduziJm === 'm1') return unos * (v/100) * (s/100);
        return unos;
    }, [razduziKol, razduziJm, razduziZapis]);

    const renderRadnikPolje = (polje) => {
        if (polje.id === 'operater') return <div className="h-full w-full min-w-0 bg-transparent text-theme-text font-black text-sm uppercase px-2 py-1 outline-none focus-within:border-theme-accent overflow-visible"><PD_SmartSearchableInput value={operater} onChange={handleOperaterChange} list={radniciList} /></div>;
        if (polje.id === 'viljuskarista') return <div className="h-full w-full min-w-0 bg-transparent text-theme-text font-black text-sm uppercase px-2 py-1 outline-none focus-within:border-theme-accent overflow-visible"><PD_SmartSearchableInput value={viljuskarista} onChange={handleViljuskaristaChange} list={radniciList} /></div>;
        return null;
    };

    const sveOznakeZaPrikaz = Array.from(new Set([...dostupneOznake, ...odabraneOznake]));

    if (!header?.masina) {
        return (
            <div className="p-4 max-w-2xl mx-auto space-y-6 font-bold animate-in fade-in">
                <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-amber-500" user={user} saas={saas} />
                <div className="bg-red-900/30 border-2 border-red-500 p-10 rounded-[2.5rem] text-center shadow-2xl mt-10">
                    <span className="text-6xl block mb-4 animate-bounce">⚠️</span>
                    <h2 className="text-2xl text-red-400 font-black uppercase tracking-widest">Mašina nije odabrana!</h2>
                </div>
            </div>
        );
    }
    
    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6 animate-in fade-in font-bold">
            
            {razduziZapis && (
                <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-theme-card border border-red-500 p-6 rounded-[2.5rem] shadow-2xl max-w-sm w-full relative">
                        <button onClick={() => setRazduziZapis(null)} className="absolute top-4 right-4 bg-slate-800 text-slate-400 hover:text-theme-text hover:bg-red-500 w-8 h-8 rounded-box font-black flex items-center justify-center transition-all">✕</button>
                        <h3 className="text-red-400 font-black uppercase text-sm mb-4 border-b border-theme-border pb-3">Razduživanje Stavke</h3>
                        
                        <div className="mb-4 text-xs text-slate-300">
                            <p className="mb-1">Paket: <b className="text-theme-text bg-slate-800 px-2 py-0.5 rounded">{razduziZapis.paket_id}</b></p>
                            <p className="mb-1">Proizvod: <b className="text-theme-text">{razduziZapis.naziv_proizvoda}</b></p>
                            <p className="mt-2 text-[10px] uppercase text-slate-500">Trenutno stanje na ulazu:</p>
                            <p className="text-emerald-400 font-black text-2xl drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">{razduziZapis.kolicina_final} <span className="text-sm">m³</span></p>
                        </div>

                        <div className="flex bg-slate-800 p-1 rounded-xl mb-4 border border-theme-border">
                            <button onClick={() => { setRazduziMod('potroseno'); setRazduziKol(''); }} className={`flex-1 py-3 rounded-lg text-[10px] uppercase font-black transition-all ${razduziMod === 'potroseno' ? 'bg-red-600 text-theme-text shadow-lg' : 'text-slate-400 hover:text-theme-text hover:bg-slate-700'}`}>🔴 Potrošeno</button>
                            <button onClick={() => { setRazduziMod('ostalo'); setRazduziKol(''); }} className={`flex-1 py-3 rounded-lg text-[10px] uppercase font-black transition-all ${razduziMod === 'ostalo' ? 'bg-blue-600 text-theme-text shadow-lg' : 'text-slate-400 hover:text-theme-text hover:bg-slate-700'}`}>🔵 Ostalo</button>
                        </div>

                        <div className="mb-6">
                            <label className="text-[10px] text-slate-400 uppercase font-black mb-2 block text-center">Unesi količinu i odaberi mjeru</label>
                            <div className="flex gap-2 w-full items-center">
                                <input type="number" value={razduziKol} onChange={e => setRazduziKol(e.target.value)} placeholder="0" className={`flex-1 min-w-0 p-4 bg-theme-panel border-2 rounded-2xl text-center text-2xl text-theme-text font-black outline-none transition-all shadow-inner ${razduziMod === 'potroseno' ? 'border-red-500/50 focus:border-red-400 text-red-400' : 'border-blue-500/50 focus:border-blue-400 text-blue-400'}`} />
                                <select value={razduziJm} onChange={e => setRazduziJm(e.target.value)} className="w-24 shrink-0 p-4 bg-slate-800 rounded-2xl text-lg text-theme-text font-black outline-none border border-theme-border focus:border-emerald-500">
                                    <option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option>
                                </select>
                            </div>
                            {razduziKol && razduziJm !== 'm3' && (
                                <p className="text-center text-[10px] text-slate-400 mt-3 font-bold bg-slate-800 p-2 rounded-xl border border-theme-border">
                                    Preračunato: <span className="text-theme-text font-black text-xs">~{livePreracunM3.toFixed(3)} m³</span>
                                </p>
                            )}
                        </div>
                        <button onClick={potvrdiRazduzivanje} className="w-full py-4 bg-emerald-600 text-theme-text font-black rounded-xl text-xs uppercase shadow-lg hover:bg-emerald-500 transition-all border border-emerald-400">✅ Potvrdi i Razduži</button>
                    </div>
                </div>
            )}

            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-amber-500" user={user} modulIme="dorada" saas={saas} />
            <h2 className="text-amber-500 text-center font-black tracking-widest uppercase text-xl mt-2 mb-6 drop-shadow-md">🔄 DORADA - ULAZ / IZLAZ</h2>
            
            <div className="flex flex-col md:flex-row gap-4 bg-theme-card/60 backdrop-blur-md p-4 rounded-2xl border border-theme-border/50 items-center justify-between shadow-lg relative z-[50]">
                <div className="flex gap-4 w-full md:w-auto flex-1 flex-wrap">
                    {(saas.ui.polja_radnici || []).map((polje, index) => (
                        <div key={polje.id} className={`relative flex-1 min-w-[250px] flex items-center bg-black/40 rounded-xl border border-slate-800/50 p-2 overflow-visible transition-all ${saas.isEditMode ? 'border-dashed border-amber-500 bg-amber-900/20' : ''}`} draggable={saas.isEditMode} onDragStart={(e) => handleDragStart(e, index, 'polja_radnici')} onDragEnter={(e) => handleDragEnter(e, index)} onDragEnd={() => handleDrop('polja_radnici')} onDragOver={(e) => e.preventDefault()}>
                            {saas.isEditMode && (
                                <div className="absolute -top-3 -right-2 z-[60] flex gap-1">
                                    <span className="text-[10px] text-amber-500 bg-theme-card px-2 py-1 rounded-box cursor-move border border-amber-500/50 shadow-lg">☰ POMICANJE</span>
                                </div>
                            )}
                            <div className="flex-1 flex items-center overflow-visible">
                                {saas.isEditMode ? (
                                    <input value={polje.label} onChange={(e) => updatePolje(index, 'label', e.target.value, 'polja_radnici')} className="w-24 bg-theme-card text-amber-400 p-1 rounded border border-amber-500/50 text-[8px] uppercase font-black shrink-0 mr-2" placeholder="Naslov..." />
                                ) : (
                                    polje.label && <label className="text-[8px] text-slate-500 uppercase mx-2 whitespace-nowrap shrink-0 w-24 overflow-hidden text-ellipsis">{polje.label}</label>
                                )}
                                <div className="flex-1 border-l border-theme-border/50 pl-2 relative overflow-visible z-[100]">
                                    {renderRadnikPolje(polje)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-6 items-start relative z-10">
                
                <div className="w-full xl:w-1/2 flex flex-col gap-6">
                    <div className="bg-theme-card/80 backdrop-blur-md p-6 rounded-[2.5rem] border border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.05)]">
                        <h3 className="text-red-500 font-black uppercase tracking-widest border-b border-red-500/20 pb-3 mb-5 flex items-center gap-2">
                            <span>📥</span> ULAZ - SIROVINA I NALOG
                        </h3>

                        <div className="relative font-black bg-blue-900/10 p-4 rounded-2xl border border-blue-500/20 mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[10px] text-blue-400 uppercase font-black tracking-widest">RADNI NALOG ZA IZRADU</label>
                                {radniNalog && <button onClick={() => {setRadniNalog(''); setTipNaloga(''); setRnStavke([]); setPredlozeniPaketi([]); ucitajSveZapoocetePakete();}} className="text-[9px] text-red-400 hover:text-theme-text uppercase px-3 py-1 rounded bg-red-900/30 font-black border border-red-500/30">✕ Ukloni</button>}
                            </div>
                            <PD_SearchableRN nalozi={aktivniNalozi} value={radniNalog} onSelect={handleNalogSelect} onScanClick={() => {setScanTarget('nalog'); setIsScanning(true);}} />
                            
                            {rnStavke.length > 0 && (
                                <div className="mt-3 space-y-2 border-t border-blue-500/20 pt-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    <span className="text-[9px] text-blue-300 uppercase font-black block mb-2 tracking-widest opacity-80">Stavke na nalogu (Klikni za prenos desno):</span>
                                    {rnStavke.map(s => {
                                        const preostalo = s.naruceno - s.napravljeno;
                                        let pM3 = 0, pKom = 0;
                                        if (preostalo > 0) {
                                            if (s.jm === 'm3') { pM3 = preostalo; pKom = s.vol1kom > 0 ? Math.ceil(preostalo / s.vol1kom) : 0; }
                                            else if (s.jm === 'kom') { pKom = preostalo; pM3 = preostalo * s.vol1kom; }
                                            else { pM3 = preostalo; }
                                        }
                                        return (
                                        <div key={s.id} onClick={() => {
                                            if(!selectedIzlazId) return alert("⚠️ Prvo desno skeniraj ili upiši broj IZLAZNOG PAKETA!");
                                            handleStavkaSelect(s);
                                        }} className="flex flex-col p-3 bg-slate-800/80 rounded-xl cursor-pointer hover:bg-blue-600 transition-all border border-theme-border/50 group">
                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                                                <div>
                                                    <div className="text-xs text-theme-text font-black">{s.sifra_proizvoda} - {s.naziv_proizvoda}</div>
                                                    <div className="text-[10px] text-slate-400 mt-1 font-bold">
                                                        {s.isFazni ? <span className="text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded mr-2">FAZA: {header.masina}</span> : ''}
                                                        {s.isFazni ? `Cilj:` : `Dimenzije:`} {s.dimenzije}
                                                    </div>
                                                </div>
                                                <div className="text-right mt-2 md:mt-0 bg-theme-card/50 p-2 rounded-lg border border-theme-border/50 group-hover:border-blue-400 transition-colors w-full md:w-auto">
                                                    <div className={`text-xs font-black ${preostalo > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>Preostalo: {preostalo > 0 ? `${pM3.toFixed(3)} m³` : 'GOTOVO ✅'}</div>
                                                </div>
                                            </div>
                                            
                                            {s.skica_url && (
                                                <div className="mt-3 pt-3 border-t border-blue-500/20">
                                                    <button onClick={(e) => { e.stopPropagation(); window.open(s.skica_url, '_blank'); }} className="text-[9px] bg-blue-500/20 text-blue-400 px-4 py-2 rounded-lg border border-blue-500/30 flex items-center gap-2 hover:bg-blue-600 hover:text-white transition-colors font-black uppercase tracking-widest w-full justify-center shadow-sm">
                                                        📎 Prikaz Skice / PDF-a
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )})}
                                </div>
                            )}
                        </div>

                        <div className="relative font-black">
                            <label className={`text-[10px] uppercase text-red-500 block mb-2 tracking-widest`}>SKENIRAJ ULAZNI PAKET (SIROVINA)</label>
                            <div className="flex bg-theme-panel border border-red-500/50 rounded-2xl overflow-hidden shadow-inner focus-within:border-red-500 relative z-10">
                                <input type="text" value={ulazScan} onChange={e => handleUlazInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') handleUlazInput(ulazScan, true)}} placeholder="UČITAJ PAKET SIROVINE..." className="flex-1 p-5 bg-transparent text-center text-theme-text outline-none uppercase text-lg font-black min-w-0" />
                                <button onClick={() => {setScanTarget('ulaz'); setIsScanning(true);}} className="px-6 bg-red-600/30 text-red-400 font-bold hover:bg-red-500 hover:text-theme-text transition-all text-2xl border-l border-red-500/50 shrink-0 backdrop-blur-sm">📷</button>
                            </div>
                        </div>

                        {predlozeniPaketi.length > 0 && (
                            <div className="mt-4 bg-red-900/10 border border-red-500/20 p-4 rounded-2xl shadow-inner animate-in fade-in">
                                <span className="text-[9px] text-red-400 uppercase font-black mb-3 block opacity-80">
                                    Dostupna sirovina {radniNalog ? `iz naloga ${radniNalog}` : 'za ovu fazu'}:
                                </span>
                                <div className="flex gap-2 flex-wrap">
                                    {predlozeniPaketi.filter(p => !activeUlazIds.includes(p.paket_id)).map(p => (
                                        <button key={p.id} onClick={() => processUlaz(p.paket_id)} className="bg-slate-800 text-slate-300 px-3 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-red-600 hover:text-theme-text transition-all border border-slate-600/50 flex items-center gap-2">
                                            <span className="bg-slate-950 px-2 py-0.5 rounded text-theme-text">{p.paket_id}</span>{p.naziv_proizvoda}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeUlazIds.length > 0 && (
                            <div className="flex gap-2 flex-wrap mt-4">
                                {activeUlazIds.map(id => (
                                    <div key={id} className="bg-red-900/30 border border-red-500 text-red-400 px-3 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg">
                                        {id} <button onClick={() => ukloniIzAktivnihUlaza(id)} className="hover:text-theme-text bg-red-500/20 w-5 h-5 flex items-center justify-center rounded-box ml-1">✕</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {ulazneStavke.length > 0 && (
                            <div className="mt-4 border-t border-theme-border/50 pt-4 animate-in fade-in">
                                <h4 className="text-[9px] text-slate-500 uppercase font-black mb-3 tracking-widest">Sadržaj učitanih paketa (Klikni za razduživanje):</h4>
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                    {ulazneStavke.map(s => (
                                        <div key={s.id} onClick={() => { setRazduziZapis(s); setRazduziMod('potroseno'); setRazduziKol(''); setRazduziJm('kom'); }} className="p-3 bg-slate-800/50 border border-theme-border/50 rounded-xl flex justify-between items-center cursor-pointer hover:border-red-500 hover:bg-slate-800 transition-all shadow-sm">
                                            <div>
                                                <p className="text-theme-text text-xs font-black">{s.naziv_proizvoda}</p>
                                                <p className="text-[9px] text-slate-400 mt-1">Paket: {s.paket_id} | Dim: {s.debljina}x{s.sirina}x{s.duzina}</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-red-400 font-black text-lg">{s.kolicina_final} m³</div>
                                                <p className="text-[8px] text-slate-500 uppercase mt-1">Klikni za unos potrošnje 👆</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-full xl:w-1/2 flex flex-col gap-6">
                    <div className="bg-theme-card/80 backdrop-blur-md p-6 rounded-[2.5rem] border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.05)]">
                        <h3 className="text-emerald-500 font-black uppercase tracking-widest border-b border-emerald-500/20 pb-3 mb-5 flex items-center gap-2">
                            <span>📤</span> IZLAZ - GOTOV PROIZVOD
                        </h3>

                        <div>
                            <label className="text-[9px] text-theme-muted uppercase block mb-2 font-black tracking-widest text-emerald-400">Upiši ili skeniraj izlazni paket</label>
                            <div className={`flex bg-theme-panel border-2 rounded-2xl overflow-hidden shadow-inner focus-within:shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] transition-all h-16 ${saas.isEditMode ? 'border-amber-500/50 opacity-50 pointer-events-none' : 'border-emerald-900/50 focus-within:border-emerald-500'}`}>
                                <input type="text" value={izlazScan} onChange={e => handleIzlazInput(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') handleIzlazInput(izlazScan, true) }} className="flex-1 px-6 bg-transparent text-xl md:text-xl text-center text-theme-text outline-none uppercase font-black placeholder:text-theme-muted/30 tracking-widest" placeholder="SKENIRAJ GOTOV PAKET..." />
                                <button onClick={() => {setScanTarget('izlaz'); setIsScanning(true);}} className="px-6 bg-emerald-900/30 text-emerald-500 border-l border-emerald-900/50 hover:bg-emerald-600 hover:text-white font-black transition-colors text-xl flex items-center justify-center">📷</button>
                            </div>
                        </div>

                        <div className="flex-1 bg-theme-panel/50 border border-theme-border rounded-xl p-4 flex flex-col mt-4">
                            <label className="text-[9px] text-theme-muted uppercase font-black tracking-widest mb-3 block flex items-center gap-2 text-emerald-400">
                                📦 Započeti izlazni paketi na ovoj mašini:
                            </label>
                            
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                {activeIzlazIds.length === 0 && <span className="text-xs text-slate-500 italic border border-dashed border-theme-border p-4 rounded-xl w-full text-center">Nema započetih paketa...</span>}
                                {activeIzlazIds.map(id => (
                                    <div key={id} className={`flex items-center rounded-xl border-2 transition-all shrink-0 shadow-md h-10 ${selectedIzlazId === id ? 'bg-emerald-600 border-white font-black shadow-[0_0_10px_rgba(16,185,129,0.5)] scale-105' : 'bg-slate-800 border-theme-border hover:border-emerald-500/50'}`}>
                                        <button onClick={() => {setSelectedIzlazId(id); fetchIzlaz(id);}} className={`px-4 py-1.5 text-xs font-black h-full flex items-center ${selectedIzlazId === id ? 'text-white' : 'text-theme-text'}`}>{id}</button>
                                        <button onClick={() => otkaziPaket(id)} className={`px-3 py-1.5 text-xs font-black h-full flex items-center border-l rounded-r-xl transition-colors ${selectedIzlazId === id ? 'border-white/20 text-white hover:bg-white/20' : 'border-theme-border text-red-400 hover:bg-red-500 hover:text-white'}`} title="Skloni sa ekrana">✕</button>
                                    </div>
                                ))}
                            </div>

                            {selectedIzlazId && (
                                <div id="package-form-area" className="mt-4 animate-in zoom-in-95 space-y-4 border-t border-theme-border pt-4">
                                    <div className="flex justify-between items-center bg-emerald-900/20 border border-emerald-500/30 p-3 rounded-lg">
                                        <span className="text-xs font-black text-emerald-500 uppercase">Uređivanje: {selectedIzlazId}</span>
                                        <button onClick={() => zakljuciPaket(selectedIzlazId)} className="bg-emerald-600 text-white px-3 py-1.5 rounded text-[10px] font-black uppercase hover:bg-emerald-500 shadow-sm transition-all">🏁 ZAKLJUČI</button>
                                    </div>

                                    {/* KALO PREGLED */}
                                    <div className="flex bg-black/30 p-2 rounded-xl border border-theme-border gap-4 shadow-inner mb-2">
                                        <div className="text-center px-3 border-r border-theme-border/50"><div className="text-[9px] text-amber-500 uppercase font-black">Ulaz Sirovina</div><div className="text-sm font-black text-theme-text">{ulazM3}</div></div>
                                        <div className="text-center px-3 border-r border-theme-border/50"><div className="text-[9px] text-emerald-400 uppercase font-black">Novi Izlaz</div><div className="text-sm font-black text-theme-text">{izlazM3}</div></div>
                                        <div className="text-center px-3"><div className="text-[9px] text-red-400 uppercase font-black">Kalo (Otpad)</div><div className="text-sm font-black text-red-400">{(ulazM3 - izlazM3).toFixed(3)}</div></div>
                                    </div>

                                    {activeEditItem && (
                                        <div className="p-4 bg-blue-900/10 rounded-2xl border border-blue-500/30 mb-4">
                                            <div className="flex justify-between items-center"><span className="text-[10px] text-blue-300 uppercase font-black">Ažuriranje: {activeEditItem.naziv_proizvoda}</span><button onClick={()=>setActiveEditItem(null)} className="text-red-500 text-xs font-black hover:underline">PONIŠTI ×</button></div>
                                            <div className="flex bg-theme-card p-1 rounded-xl mt-3"><button onClick={() => setUpdateMode('dodaj')} className={`flex-1 py-2 rounded-lg text-[10px] uppercase font-black transition-all ${updateMode==='dodaj'?'bg-emerald-600 text-theme-text':'text-slate-500'}`}>+ Dodaj</button><button onClick={() => setUpdateMode('oduzmi')} className={`flex-1 py-2 rounded-lg text-[10px] uppercase font-black transition-all ${updateMode==='oduzmi'?'bg-red-600 text-theme-text':'text-slate-500'}`}>- Oduzmi</button></div>
                                        </div>
                                    )}
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[9px] text-slate-500 uppercase ml-1 block mb-1 tracking-widest">PROIZVOD KOJI SE SLAŽE</label>
                                            <PD_SearchableProizvod katalog={katalog} value={form.naziv} onChange={v => setForm({...form, naziv: v})} onSelect={k => setForm({...form, naziv: k.naziv, debljina: k.visina, sirina: k.sirina, duzina: k.duzina, jm: 'kom'})} />
                                        </div>
                                        <div className="flex gap-2 items-center pt-[18px]">
                                            <DimBox label="Deb" val={form.debljina} set={v => setForm({...form, debljina: v})} disabled={!!activeEditItem} />
                                            <DimBox label="Šir" val={form.sirina} set={v => setForm({...form, sirina: v})} disabled={!!activeEditItem} />
                                            <DimBox label="Duž" val={form.duzina} set={v => setForm({...form, duzina: v})} disabled={!!activeEditItem} />
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                                        <div className="flex-1 relative">
                                            <input type="number" value={form.kolicina_ulaz} onKeyDown={e => {if(e.key==='Enter') saveIzlaz()}} onChange={e => setForm({...form, kolicina_ulaz: e.target.value})} className="w-full p-4 bg-theme-panel border border-theme-border rounded-xl text-xl text-center text-emerald-500 font-black focus:border-emerald-500 transition-all placeholder:text-theme-muted/30 shadow-inner outline-none" placeholder="KOLIČINA..." />
                                        </div>
                                        <div className="sm:w-24 relative">
                                            <select value={form.jm} onChange={e => setForm({...form, jm: e.target.value})} className="w-full h-full bg-theme-panel rounded-xl text-theme-text font-black outline-none border border-theme-border focus:border-emerald-500 text-sm uppercase px-3 cursor-pointer shadow-inner">
                                                <option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option>
                                            </select>
                                        </div>
                                    </div>

                                    {sveOznakeZaPrikaz.length > 0 && (
                                        <div className="mt-2 bg-theme-card/50 p-4 rounded-2xl border border-theme-border/50">
                                            <label className="text-[8px] text-slate-400 uppercase font-black ml-1 tracking-widest mb-2 block">Opcije obrade (Naslijeđeno i Novo):</label>
                                            <div className="flex flex-wrap gap-2">
                                                {sveOznakeZaPrikaz.map(o => (
                                                    <button key={o} onClick={() => toggleOznaka(o)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${odabraneOznake.includes(o) ? 'bg-amber-600 border-amber-400 text-theme-text shadow-lg' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                                                        {odabraneOznake.includes(o) ? '✓ ' : '+ '} {o}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <button onClick={saveIzlaz} className={`w-full py-4 mt-2 text-white font-black rounded-xl uppercase shadow-md hover:scale-[1.02] transition-all text-xs tracking-widest ${activeEditItem ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                                        {activeEditItem ? `✅ SPASI IZMJENE` : `➕ DODAJ U ${selectedIzlazId}`}
                                    </button>
                                    
                                    {izlazPackageItems.length > 0 && (
                                        <div className="mt-4 border-t border-theme-border pt-4">
                                            <label className="text-[9px] text-slate-400 uppercase font-black block mb-2 tracking-widest">Sadržaj:</label>
                                            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                                                {izlazPackageItems.map(item => {
                                                    const rnStavka = rnStavke.find(rs => rs.naziv_proizvoda === item.naziv_proizvoda);
                                                    let preostaloText = null;
                                                    if (rnStavka && !item.je_nusproizvod) {
                                                        const preostalo = rnStavka.naruceno - rnStavka.napravljeno;
                                                        if (preostalo > 0) {
                                                            let pM3 = 0, pKom = 0;
                                                            if (rnStavka.jm === 'm3') { pM3 = preostalo; pKom = rnStavka.vol1kom > 0 ? Math.ceil(preostalo / rnStavka.vol1kom) : 0; }
                                                            else if (rnStavka.jm === 'kom') { pKom = preostalo; pM3 = preostalo * rnStavka.vol1kom; }
                                                            else { pM3 = preostalo; }
                                                            preostaloText = `${pM3.toFixed(3)} m³`;
                                                        } else preostaloText = '0 (GOTOVO)';
                                                    }

                                                    return (
                                                    <div key={item.id} onClick={() => { setActiveEditItem(item); setForm({...item, kolicina_ulaz: '' }); setOdabraneOznake(item.oznake || []); }} className="flex justify-between items-center p-4 bg-theme-card border border-theme-border/50 rounded-2xl cursor-pointer hover:border-emerald-500 transition-all shadow-sm group">
                                                        <div>
                                                            <div className="text-xs uppercase text-theme-text font-black">{item.naziv_proizvoda} {item.je_nusproizvod ? <span className="text-amber-500 text-[9px] ml-2">(Nusproizvod)</span> : ''}</div>
                                                            <div className="text-emerald-500 text-lg font-black tracking-tighter mt-1">{item.debljina}x{item.sirina}x{item.duzina} <span className="text-[10px] text-slate-500 ml-1">cm</span></div>
                                                            <div className="flex flex-wrap gap-2 items-center mt-2">
                                                                {item.oznake && item.oznake.length > 0 && (<div className="flex gap-1">{item.oznake.map(o => <span key={o} className="text-[8px] bg-amber-900/40 text-amber-400 px-2 py-1 rounded uppercase font-black">{o}</span>)}</div>)}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-2">
                                                            <div className="text-right font-black"><div className="text-xl text-theme-text">{item.kolicina_final} <span className="text-emerald-500 text-xs">m³</span></div><div className="text-[9px] text-slate-500 bg-black/40 px-2 py-1 rounded mt-1 inline-block">{item.kolicina_ulaz} {item.jm}</div></div>
                                                            <div className="flex gap-1">
                                                                <button onClick={(e) => obrisiStavkuIzPaketa(item, e)} className="bg-red-900/40 text-red-400 hover:bg-red-600 hover:text-theme-text px-2 py-1.5 rounded-lg text-[9px] font-black uppercase opacity-0 group-hover:opacity-100 transition-all">🗑️</button>
                                                                <button onClick={(e) => { e.stopPropagation(); printDeklaracijaPaketa(item.paket_id, [item], radniNalog); }} className="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-theme-text px-2 py-1.5 rounded-lg text-[9px] font-black uppercase opacity-0 group-hover:opacity-100 transition-all">🖨️</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )})}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
            
            <SaaS_DnevnikMasine 
                modul="Dorada" 
                header={header} 
                user={user} 
                saas={saas} 
                updatePolje={updatePolje} 
                toggleVelicina={toggleVelicinaPolja} 
                spremiDimenzije={spremiDimenzije}
                handleDragStart={handleDragStart}
                handleDragEnter={handleDragEnter}
                handleDrop={handleDrop}
            />
            
            {isScanning && <ScannerOverlay onScan={(text) => { if(scanTarget==='nalog') handleNalogSelect(text); else if(scanTarget==='ulaz') handleUlazInput(text, true); else handleIzlazInput(text, true); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}