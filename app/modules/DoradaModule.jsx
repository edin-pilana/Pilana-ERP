"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import ScannerOverlay from '../components/ScannerOverlay';
import { printDeklaracijaPaketa } from '../utils/printHelpers';
import { useSaaS } from '../utils/useSaaS';

const supabase = createClient('https://awaxwejrhmjeqohrgidm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY');

// Lokalne pomoćne komponente
function DimBox({ label, val, set, disabled }) {
    return (<div className={`bg-slate-900 p-2 rounded-xl border border-slate-800 font-bold text-center ${disabled ? 'opacity-50' : ''}`}><span className="text-[7px] text-slate-500 uppercase block mb-1 font-black">{label}</span><input type="number" value={val} onChange={e => set(e.target.value)} disabled={disabled} className="w-full bg-transparent text-white font-black outline-none text-lg text-center" /></div>);
}

function PD_SearchableRN({ nalozi, value, onSelect, onScanClick }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    useEffect(() => { setSearch(value || ''); }, [value]);
    const safeSearch = (search || '').toString().toUpperCase();
    const filtered = nalozi.filter(n => (n.id || '').toString().toUpperCase().includes(safeSearch) || (n.kupac_naziv || '').toString().toUpperCase().includes(safeSearch));

    return (
        <div className="relative font-black w-full flex bg-[#0f172a] border border-slate-700 rounded-xl overflow-hidden focus-within:border-blue-500 shadow-inner">
            <input value={search} onFocus={() => setOpen(true)} onChange={e => { setSearch(e.target.value); setOpen(true); }} onKeyDown={e => { if(e.key === 'Enter' && search) { onSelect(search); setOpen(false); } }} placeholder="Upiši nalog ili skeniraj..." className="flex-1 p-4 bg-transparent text-center text-white outline-none uppercase" />
            <button onClick={onScanClick} className="px-6 bg-blue-600 text-white font-black hover:bg-blue-500 transition-all text-xl shadow-lg border-l border-slate-700">📷</button>
            {open && search && (
                <div className="absolute z-50 top-full left-0 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto text-left">
                    {filtered.map(n => (
                        <div key={n.id} onClick={() => { onSelect(n.id); setSearch(n.id); setOpen(false); }} className="p-3 border-b border-slate-700 hover:bg-blue-600 cursor-pointer">
                            <div className="text-white text-xs font-black">{n.id}</div>
                            <div className="text-[9px] text-slate-400">{n.kupac_naziv}</div>
                        </div>
                    ))}
                    <div onClick={() => setOpen(false)} className="p-2 text-center text-[8px] text-slate-500 cursor-pointer hover:text-white bg-slate-900 rounded-b-xl">ZATVORI</div>
                </div>
            )}
        </div>
    );
}

function PD_SearchableProizvod({ katalog, value, onSelect }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    useEffect(() => { setSearch(value || ''); }, [value]);
    const safeSearch = (search || '').toString().toUpperCase();
    const filtered = katalog.filter(k => (k.sifra || '').toString().toUpperCase().includes(safeSearch) || (k.naziv || '').toString().toUpperCase().includes(safeSearch));

    return (
        <div className="relative font-black w-full">
            <input value={search} onFocus={() => setOpen(true)} onChange={e => { setSearch(e.target.value); setOpen(true); }} placeholder="Pronađi proizvod (Šifra ili Naziv)..." className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-emerald-500 uppercase" />
            {open && search && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto text-left">
                    {filtered.map(k => (
                        <div key={k.sifra} onClick={() => { onSelect(k); setSearch(k.naziv); setOpen(false); }} className="p-3 border-b border-slate-700 hover:bg-emerald-600 cursor-pointer">
                            <div className="text-white text-xs font-black">{k.sifra} - {k.naziv}</div>
                            <div className="text-[9px] text-slate-400">Dim: {k.visina}x{k.sirina}x{k.duzina} | Baza: {k.default_jedinica}</div>
                        </div>
                    ))}
                    <div onClick={() => setOpen(false)} className="p-2 text-center text-[8px] text-slate-500 cursor-pointer hover:text-white bg-slate-900 rounded-b-xl">ZATVORI</div>
                </div>
            )}
        </div>
    );
}

// SaaS Dnevnik Mašine
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
        if (polje.id === 'pocetak') return <input type="time" value={form.vrijeme_od} onChange={e => setForm({...form, vrijeme_od: e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-amber-500" />;
        if (polje.id === 'kraj') return <input type="time" value={form.vrijeme_do} onChange={e => setForm({...form, vrijeme_do: e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-amber-500" />;
        if (polje.id === 'zastoj') return <input type="number" value={form.zastoj_min} onChange={e => setForm({...form, zastoj_min: e.target.value})} placeholder="0" className="w-full h-full min-h-[45px] p-3 bg-red-900/20 rounded-xl text-xs text-red-400 font-black border border-red-500/50 outline-none" />;
        if (polje.id === 'napomena') return <input type="text" value={form.napomena} onChange={e => setForm({...form, napomena: e.target.value})} placeholder="Održavanje, kvar..." className="w-full h-full min-h-[45px] p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-amber-500" />;
        return null;
    };

    return (
        <div className={`bg-[#1e293b] p-6 rounded-[2.5rem] border shadow-2xl space-y-4 mt-6 transition-all ${saas.isEditMode ? 'ring-2 ring-amber-500 border-amber-500/50' : 'border-slate-700'}`}>
            <h3 className="text-amber-500 font-black uppercase text-xs">⚙️ EVIDENCIJA RADA I ZASTOJA MAŠINE</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800 items-start">
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
                            <input value={polje.label} onChange={(e) => updatePolje(index, 'label', e.target.value, 'polja_dnevnik')} className="w-full bg-slate-900 text-amber-400 p-1 mb-1 rounded border border-amber-500/50 text-[8px] uppercase font-black text-center shrink-0" placeholder="Ostavite prazno za bez naslova" />
                        ) : (
                            polje.label && <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1 shrink-0">{polje.label}</label>
                        )}
                        <div className={`flex-1 ${saas.isEditMode ? 'opacity-50 pointer-events-none' : ''}`}>{renderDnevnikPolje(polje)}</div>
                    </div>
                ))}
                <button onClick={snimiZastojIliRad} className={`w-full py-3 bg-amber-600 text-white font-black rounded-xl text-[10px] uppercase shadow-lg hover:bg-amber-500 ${saas.isEditMode ? 'opacity-50 pointer-events-none col-span-4' : 'col-span-4 md:col-span-4 mt-2'}`}>➕ Dodaj Zapis u Dnevnik</button>
            </div>
            
            <div className="space-y-2 mt-4">
                {logovi.length === 0 && <p className="text-center text-slate-500 text-[10px] uppercase">Nema unesenih zastoja za danas.</p>}
                {logovi.map(l => (
                    <div key={l.id} className="flex justify-between items-center p-3 bg-slate-800 border border-slate-700 rounded-xl">
                        <div>
                            <p className="text-[10px] text-slate-400 font-black"><span className="text-emerald-400">{l.vrijeme_od}</span> - {l.vrijeme_do ? <span className="text-amber-400">{l.vrijeme_do}</span> : <span className="text-slate-500">...</span>}</p>
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

export default function DoradaModule({ user, header, setHeader, onExit }) {
    
    // === SaaS ALAT (OČIŠĆENO OD RADNIKA) ===
    const saas = useSaaS('dorada_modul', {
        boja_kartice: '#1e293b',
        boja_teksta_ulaz: 'text-red-500',
        boja_teksta_izlaz: 'text-emerald-500',
        naslov_ulaz: 'SKENIRAJ ULAZNI PAKET (SIROVINA)',
        naslov_izlaz: 'QR IZLAZNOG PAKETA (GOTOVO)',
        polja_dnevnik: [
            { id: 'pocetak', label: 'POČETAK', span: 'col-span-1' },
            { id: 'kraj', label: 'ZAVRŠETAK', span: 'col-span-1' },
            { id: 'zastoj', label: 'ZASTOJ (MINUTA)', span: 'col-span-1' },
            { id: 'napomena', label: 'NAPOMENA / RAZLOG', span: 'col-span-1', customWidth: '100%', span: 'col-span-4' }
        ]
    });

    // === Drag & Drop i Resize Logika ===
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
    // ===========================

    const [ulazScan, setUlazScan] = useState('');
    const [izlazScan, setIzlazScan] = useState('');
    const [radniNalog, setRadniNalog] = useState('');
    const [rnStavke, setRnStavke] = useState([]);
    
    const [katalog, setKatalog] = useState([]);
    const [aktivniNalozi, setAktivniNalozi] = useState([]);

    const [activeUlazIds, setActiveUlazIds] = useState([]);
    const [ulazneStavke, setUlazneStavke] = useState([]); 
    
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

    useEffect(() => {
        supabase.from('katalog_proizvoda').select('*').then(({data}) => setKatalog(data || []));
        supabase.from('radni_nalozi').select('id, kupac_naziv, status').neq('status', 'ZAVRŠENO').then(({data}) => setAktivniNalozi(data || []));
        ucitajSveZapoocetePakete();
    }, [header.masina]);

    // FILTER SAMO ZA TRENUTNU MAŠINU
    const ucitajSveZapoocetePakete = async () => {
        if (!header.masina) { setActiveIzlazIds([]); return; }
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
            if (!header.masina) return;
            const { data } = await supabase.from('masine').select('atributi_paketa').eq('naziv', header.masina).maybeSingle();
            setDostupneOznake(data?.atributi_paketa || []);
            setOdabraneOznake([]); 
        };
        fetchMasinaAtribute();
    }, [header.masina]);

    const handleNalogSelect = async (val) => {
        if(!val) return;
        setRadniNalog(val);
        const {data} = await supabase.from('radni_nalozi').select('*').eq('id', val.toUpperCase()).maybeSingle();
        if (data) {
            const ucitaneStavke = data.stavke_jsonb || data.stavke || [];
            if (ucitaneStavke.length > 0) {
                const mapiraneStavke = ucitaneStavke.map(s => {
                    const katItem = katalog.find(k => k.sifra === s.sifra) || {};
                    const v = parseFloat(katItem.visina) || 0; const sir = parseFloat(katItem.sirina) || 0; const d = parseFloat(katItem.duzina) || 0;
                    const vol1kom = (v > 0 && sir > 0 && d > 0) ? (v/100) * (sir/100) * (d/100) : 0;
                    return {
                        id: s.id, sifra_proizvoda: s.sifra, naziv_proizvoda: s.naziv,
                        jm: s.jm_obracun || s.jm_unos || 'm3', naruceno: parseFloat(s.kolicina_obracun || s.kolicina || 0), napravljeno: parseFloat(s.napravljeno || 0),
                        dimenzije: katItem.sifra ? `${katItem.visina || '-'}x${katItem.sirina || '-'}x${katItem.duzina || '-'}` : 'Nema u katalogu',
                        vol1kom: vol1kom
                    }
                });
                setRnStavke(mapiraneStavke);
            } else { alert(`Nalog ${val} nema stavki!`); setRnStavke([]); }
        } else { alert(`Nalog ${val} ne postoji!`); setRnStavke([]); }
    };

    const handleStavkaSelect = async (stavka) => {
        const {data: kat} = await supabase.from('katalog_proizvoda').select('*').eq('sifra', stavka.sifra_proizvoda).maybeSingle();
        setForm({ 
            ...form, naziv: stavka.naziv_proizvoda, debljina: kat?.visina||'', sirina: kat?.sirina||'', duzina: kat?.duzina||'', 
            jm: 'kom', rn_jm: stavka.jm, rn_stavka_id: stavka.id, naruceno: parseFloat(stavka.naruceno).toFixed(4), napravljeno: parseFloat(stavka.napravljeno || 0).toFixed(4) 
        });
        window.scrollTo({ top: 600, behavior: 'smooth' });
    };

    const processUlaz = async (val) => {
        const id = val.toUpperCase().trim();
        if (activeUlazIds.includes(id)) { setUlazScan(''); return; }
        
        const { data, error } = await supabase.from('paketi').select('*').eq('paket_id', id).gt('kolicina_final', 0);
        
        if (error) {
            alert(`❌ GREŠKA BAZE PRI UČITAVANJU: ${error.message}`); setUlazScan(''); return;
        }

        if (data && data.length > 0) { 
            setActiveUlazIds(prev => [...prev, id]); 
            setUlazneStavke(prev => [...prev, ...data]); 
            setUlazScan(''); 
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
        
        // Automatski učitaj Radni Nalog ako je paket već vezan za njega
        if (data && data.length > 0 && data[0].broj_veze) {
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

        // PAMETNO UPOZORENJE (ZAŠTITA OD VIŠKA)
        if (form.rn_stavka_id && !activeEditItem) {
            const rnStavka = rnStavke.find(rs => rs.id === form.rn_stavka_id);
            if (rnStavka) {
                const vecNapravljeno = parseFloat(rnStavka.napravljeno) || 0;
                const naruceno = parseFloat(rnStavka.naruceno) || 0;
                
                let kolikoSadPravimo = komada;
                if (rnStavka.jm === 'm3') kolikoSadPravimo = qtyZaPaket;
                else if (rnStavka.jm === 'm2') kolikoSadPravimo = komada * (s/100) * (d/100);
                else if (rnStavka.jm === 'm1') kolikoSadPravimo = komada * (d/100);

                if ((vecNapravljeno + kolikoSadPravimo) > naruceno) {
                    const preostalo = naruceno - vecNapravljeno;
                    if (!window.confirm(`⚠️ UPOZORENJE: PRELAZITE NORMU!\n\nZa ovaj Radni Nalog je preostalo samo: ${preostalo.toFixed(3)} ${rnStavka.jm}.\nVi pokušavate dodati: ${kolikoSadPravimo.toFixed(3)} ${rnStavka.jm}.\n\nDa li ste sigurni da želite napraviti ovaj višak?`)) {
                        return; 
                    }
                }
            }
        }

        // VUČE AKTIVNE RADNIKE IZ BAZE U TRENUTKU SNIMANJA
        const { data: aktuelniRadnici } = await supabase.from('aktivni_radnici').select('radnik_ime').eq('masina_naziv', header.masina).is('vrijeme_odjave', null);
        const radniciNaMasini = aktuelniRadnici ? aktuelniRadnici.map(r => r.radnik_ime).join(', ') : '';

        if (activeEditItem) {
            const newM3 = updateMode === 'dodaj' ? parseFloat(activeEditItem.kolicina_final) + qtyZaPaket : parseFloat(activeEditItem.kolicina_final) - qtyZaPaket;
            const { error } = await supabase.from('paketi').update({ 
                kolicina_final: parseFloat(newM3.toFixed(3)), vrijeme_tekst: timeNow, snimio_korisnik: user?.ime_prezime || 'Nepoznat',
                radnici_pilana: radniciNaMasini,
                oznake: odabraneOznake.length > 0 ? odabraneOznake : activeEditItem.oznake,
                broj_veze: radniNalog || activeEditItem.broj_veze 
            }).eq('id', activeEditItem.id);
            if (error) return alert("❌ GREŠKA PRI AŽURIRANJU PAKETA: " + error.message);
        } else {
            const { error } = await supabase.from('paketi').insert([{ 
                paket_id: selectedIzlazId, naziv_proizvoda: form.naziv, debljina: form.debljina, sirina: form.sirina, duzina: form.duzina, 
                kolicina_ulaz: form.kolicina_ulaz, jm: form.jm, kolicina_final: qtyZaPaket, 
                mjesto: header.mjesto, masina: header.masina, snimio_korisnik: user?.ime_prezime || 'Nepoznat',
                radnici_pilana: radniciNaMasini,
                vrijeme_tekst: timeNow, datum_yyyy_mm: header.datum,
                ai_sirovina_ids: activeUlazIds, oznake: odabraneOznake, broj_veze: radniNalog 
            }]);
            
            if (error) return alert("❌ GREŠKA PRI SNIMANJU PAKETA U BAZU: " + error.message);
            
            if(form.rn_stavka_id) {
                const rn_jm = form.rn_jm || 'm3';
                let napravljenoZaRN = komada;

                if (rn_jm === 'm3') napravljenoZaRN = komada * (v/100) * (s/100) * (d/100);
                else if (rn_jm === 'm2') napravljenoZaRN = komada * (s/100) * (d/100);
                else if (rn_jm === 'm1') napravljenoZaRN = komada * (d/100);

                const {data: rn} = await supabase.from('radni_nalozi').select('stavke_jsonb').eq('id', radniNalog.toUpperCase()).maybeSingle();
                if (rn && rn.stavke_jsonb) {
                    const azuriraneStavke = rn.stavke_jsonb.map(st => {
                        if (st.id === form.rn_stavka_id) {
                            const novaKol = (parseFloat(st.napravljeno) || 0) + napravljenoZaRN;
                            return { ...st, napravljeno: parseFloat(novaKol.toFixed(4)) };
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
                printDeklaracijaPaketa(pid, izlazPackageItems, radniNalog);
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

    const livePreracunM3 = useMemo(() => {
        if(!razduziKol || isNaN(razduziKol) || !razduziZapis) return 0;
        const unos = parseFloat(razduziKol);
        const v = parseFloat(razduziZapis.debljina) || 1; const s = parseFloat(razduziZapis.sirina) || 1; const d = parseFloat(razduziZapis.duzina) || 1;
        if (razduziJm === 'kom') return unos * (v/100) * (s/100) * (d/100);
        if (razduziJm === 'm2') return unos * (v/100);
        if (razduziJm === 'm1') return unos * (v/100) * (s/100);
        return unos;
    }, [razduziKol, razduziJm, razduziZapis]);

    // BLOKADA - OBAVEZAN EKRAN AKO NIJE ODABRANA MAŠINA U ZAGLAVLJU
    if (!header?.masina) {
        return (
            <div className="p-4 max-w-2xl mx-auto space-y-6 font-bold animate-in fade-in">
                <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-amber-500" user={user} saas={saas} />
                <div className="bg-red-900/30 border-2 border-red-500 p-10 rounded-[2.5rem] text-center shadow-2xl mt-10">
                    <span className="text-6xl block mb-4 animate-bounce">⚠️</span>
                    <h2 className="text-2xl text-red-400 font-black uppercase tracking-widest">Mašina nije odabrana!</h2>
                    <p className="text-slate-300 mt-4 text-sm">Da biste započeli rad na Doradi i učitali ispravne pakete, molimo odaberite mašinu u gornjem meniju.</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="p-4 max-w-2xl mx-auto space-y-6 animate-in fade-in font-bold">
            {razduziZapis && (
                <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-red-500 p-6 rounded-[2.5rem] shadow-2xl max-w-sm w-full relative">
                        <button onClick={() => setRazduziZapis(null)} className="absolute top-4 right-4 bg-slate-800 text-slate-400 hover:text-white hover:bg-red-500 w-8 h-8 rounded-full font-black flex items-center justify-center transition-all">✕</button>
                        <h3 className="text-red-400 font-black uppercase text-sm mb-4 border-b border-slate-700 pb-3">Razduživanje Stavke</h3>
                        
                        <div className="mb-4 text-xs text-slate-300">
                            <p className="mb-1">Paket: <b className="text-white bg-slate-800 px-2 py-0.5 rounded">{razduziZapis.paket_id}</b></p>
                            <p className="mb-1">Proizvod: <b className="text-white">{razduziZapis.naziv_proizvoda}</b></p>
                            <p className="mt-2 text-[10px] uppercase text-slate-500">Trenutno stanje na ulazu:</p>
                            <p className="text-emerald-400 font-black text-2xl drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">{razduziZapis.kolicina_final} <span className="text-sm">m³</span></p>
                        </div>

                        <div className="flex bg-slate-800 p-1 rounded-xl mb-4 border border-slate-700">
                            <button onClick={() => { setRazduziMod('potroseno'); setRazduziKol(''); }} className={`flex-1 py-3 rounded-lg text-[10px] uppercase font-black transition-all ${razduziMod === 'potroseno' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>🔴 Potrošeno</button>
                            <button onClick={() => { setRazduziMod('ostalo'); setRazduziKol(''); }} className={`flex-1 py-3 rounded-lg text-[10px] uppercase font-black transition-all ${razduziMod === 'ostalo' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>🔵 Ostalo</button>
                        </div>

                        <div className="mb-6">
                            <label className="text-[10px] text-slate-400 uppercase font-black mb-2 block text-center">Unesi količinu i odaberi mjeru</label>
                            <div className="flex gap-2 w-full items-center">
                                <input type="number" value={razduziKol} onChange={e => setRazduziKol(e.target.value)} placeholder="0" className={`flex-1 min-w-0 p-4 bg-[#0f172a] border-2 rounded-2xl text-center text-2xl text-white font-black outline-none transition-all shadow-inner ${razduziMod === 'potroseno' ? 'border-red-500/50 focus:border-red-400 text-red-400' : 'border-blue-500/50 focus:border-blue-400 text-blue-400'}`} />
                                <select value={razduziJm} onChange={e => setRazduziJm(e.target.value)} className="w-24 shrink-0 p-4 bg-slate-800 rounded-2xl text-lg text-white font-black outline-none border border-slate-700 focus:border-emerald-500">
                                    <option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option>
                                </select>
                            </div>
                            {razduziKol && razduziJm !== 'm3' && (
                                <p className="text-center text-[10px] text-slate-400 mt-3 font-bold bg-slate-800 p-2 rounded-xl border border-slate-700">
                                    Preračunato: <span className="text-white font-black text-xs">~{livePreracunM3.toFixed(3)} m³</span>
                                </p>
                            )}
                        </div>
                        <button onClick={potvrdiRazduzivanje} className="w-full py-4 bg-emerald-600 text-white font-black rounded-xl text-xs uppercase shadow-lg hover:bg-emerald-500 transition-all border border-emerald-400">✅ Potvrdi i Razduži</button>
                    </div>
                </div>
            )}

            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-amber-500" user={user} modulIme="dorada" saas={saas} />
            <h2 className="text-amber-500 text-center font-black tracking-widest uppercase text-xl mt-2 drop-shadow-md">🔄 DORADA - ULAZ / IZLAZ</h2>
            
            <div className={`p-6 rounded-[2.5rem] shadow-2xl space-y-5 transition-all ${saas.isEditMode ? 'ring-2 ring-amber-500 border-dashed' : ''}`} style={{ backgroundColor: saas.ui.boja_kartice, borderColor: saas.isEditMode ? '' : 'rgba(245, 158, 11, 0.3)', borderWidth: saas.isEditMode ? '0' : '1px' }}>
                
                {saas.isEditMode && (
                    <div className="bg-black/40 p-3 rounded-xl flex flex-wrap gap-4 items-center mb-4 border border-amber-500/30">
                        <label className="text-[10px] text-amber-500 uppercase font-black flex items-center gap-2">Boja Pozadine: <input type="color" value={saas.ui.boja_kartice || '#1e293b'} onChange={e => saas.setUi({...saas.ui, boja_kartice: e.target.value})} className="w-8 h-8 cursor-pointer rounded border-none bg-transparent" /></label>
                        <label className="text-[10px] text-amber-500 uppercase font-black flex items-center gap-2">Boja ULAZA: <input type="text" value={saas.ui.boja_teksta_ulaz || 'text-red-500'} onChange={e => saas.setUi({...saas.ui, boja_teksta_ulaz: e.target.value})} className="w-32 p-1 bg-slate-900 border border-slate-700 rounded text-white font-mono" placeholder="text-red-500" /></label>
                        <label className="text-[10px] text-amber-500 uppercase font-black flex items-center gap-2">Boja IZLAZA: <input type="text" value={saas.ui.boja_teksta_izlaz || 'text-emerald-500'} onChange={e => saas.setUi({...saas.ui, boja_teksta_izlaz: e.target.value})} className="w-32 p-1 bg-slate-900 border border-slate-700 rounded text-white font-mono" placeholder="text-emerald-500" /></label>
                    </div>
                )}

                {/* ULAZNI BLOK (CRVENO) */}
                <div className="relative font-black border-b border-slate-700 pb-5 mt-4">
                    {saas.isEditMode ? (
                        <input value={saas.ui.naslov_ulaz} onChange={e => saas.setUi({...saas.ui, naslov_ulaz: e.target.value})} className="w-full bg-slate-900 text-amber-400 p-2 mb-2 rounded border border-amber-500/50 text-[10px] uppercase font-black" placeholder="Naslov iznad skenera ulaza..." />
                    ) : (
                        <label className={`text-[10px] uppercase ${saas.ui.boja_teksta_ulaz} block mb-2 tracking-widest ml-2`}>{saas.ui.naslov_ulaz}</label>
                    )}
                    <div className="flex bg-[#0f172a] border border-red-500/50 rounded-xl overflow-hidden shadow-inner focus-within:border-red-500">
                        <input type="text" value={ulazScan} onChange={e => handleUlazInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') handleUlazInput(ulazScan, true)}} placeholder="Učitaj paket sirovine..." className="flex-1 p-4 bg-transparent text-center text-white outline-none uppercase text-lg font-black" />
                        <button onClick={() => {setScanTarget('ulaz'); setIsScanning(true);}} className="px-6 bg-red-600/30 text-red-400 font-bold hover:bg-red-500 hover:text-white transition-all text-xl border-l border-red-500/50">📷</button>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {activeUlazIds.map(id => (
                        <div key={id} className="bg-red-900/30 border border-red-500 text-red-400 px-3 py-1 rounded-lg text-xs font-black uppercase flex items-center gap-2 shadow-lg">
                            {id} <button onClick={() => ukloniIzAktivnihUlaza(id)} className="hover:text-white">✕</button>
                        </div>
                    ))}
                </div>

                {ulazneStavke.length > 0 && (
                    <div className="bg-slate-900 border border-red-500/30 p-4 rounded-2xl animate-in zoom-in-95 shadow-inner">
                        <h4 className="text-[10px] text-slate-500 uppercase font-black mb-3">Sadržaj ulaznih paketa (Klikni za razduživanje):</h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                            {ulazneStavke.map(s => (
                                <div key={s.id} onClick={() => { setRazduziZapis(s); setRazduziMod('potroseno'); setRazduziKol(''); setRazduziJm('kom'); }} className="p-3 bg-slate-800 border border-slate-700 rounded-xl flex justify-between items-center cursor-pointer hover:border-red-500 transition-all shadow-lg">
                                    <div><p className="text-white text-xs font-black">{s.naziv_proizvoda}</p><p className="text-[9px] text-slate-400 mt-1">Paket: {s.paket_id} | Dim: {s.debljina}x{s.sirina}x{s.duzina}</p></div>
                                    <div className="text-right"><div className="text-red-400 font-black text-lg">{s.kolicina_final} m³</div><p className="text-[8px] text-slate-500 uppercase mt-1">Klikni za unos potrošnje 👆</p></div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* RADNI NALOG BLOK */}
                <div className="relative font-black bg-blue-900/20 p-4 rounded-2xl border border-blue-500/30">
                    <label className="text-[10px] text-blue-400 uppercase ml-2 block mb-2 tracking-widest">RADNI NALOG ZA IZLAZ</label>
                    <PD_SearchableRN nalozi={aktivniNalozi} value={radniNalog} onSelect={handleNalogSelect} onScanClick={() => {setScanTarget('nalog'); setIsScanning(true);}} />
                    
                    {rnStavke.length > 0 && (
                        <div className="mt-3 space-y-2 border-t border-blue-500/30 pt-3">
                            <span className="text-[10px] text-blue-300 uppercase font-black mb-2 block tracking-widest">Stavke na nalogu (Klikni za izradu):</span>
                            {rnStavke.map(s => {
                                const preostalo = s.naruceno - s.napravljeno;
                                let pM3 = 0, pKom = 0;
                                if (preostalo > 0) {
                                    if (s.jm === 'm3') { pM3 = preostalo; pKom = s.vol1kom > 0 ? Math.ceil(preostalo / s.vol1kom) : 0; }
                                    else if (s.jm === 'kom') { pKom = preostalo; pM3 = preostalo * s.vol1kom; }
                                    else { pM3 = preostalo; }
                                }
                                return (
                                <div key={s.id} onClick={() => handleStavkaSelect(s)} className="flex flex-col md:flex-row justify-between items-start md:items-center p-3 bg-slate-800 rounded-xl cursor-pointer hover:bg-blue-600 transition-all border border-slate-700 shadow-md">
                                    <div>
                                        <div className="text-xs text-white font-black">{s.sifra_proizvoda} - {s.naziv_proizvoda}</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5 font-bold">Dimenzije: {s.dimenzije}</div>
                                    </div>
                                    <div className="text-right mt-2 md:mt-0 bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                                        <div className="text-[10px] text-blue-300 font-black">Naručeno: <span className="text-white">{s.naruceno}</span> | Urađeno: <span className="text-emerald-400">{s.napravljeno}</span></div>
                                        <div className={`text-sm font-black mt-1 ${preostalo > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>Preostalo: {preostalo > 0 ? `${pM3.toFixed(3)} m³ (${pKom} kom)` : 'GOTOVO ✅'}</div>
                                    </div>
                                </div>
                            )})}
                        </div>
                    )}
                </div>

                {/* ZAPOČETI PAKETI (TABOVI) - FILTRIRANI PO MAŠINI */}
                <div className="pt-2">
                    <label className="text-[10px] text-amber-500 uppercase font-black ml-2 mb-2 block">📦 Započeti Izlazni Paketi (Spremni za nastavak):</label>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {activeIzlazIds.length === 0 && <span className="text-xs text-slate-500 italic ml-2 border border-dashed border-slate-700 p-2 rounded-xl">Trenutno nema započetih paketa na ovoj mašini...</span>}
                        {activeIzlazIds.map(id => (
                            <div key={id} className={`flex items-center rounded-xl border-2 transition-all shrink-0 ${selectedIzlazId === id ? 'bg-emerald-600 border-white font-black shadow-[0_0_10px_rgba(16,185,129,0.5)] scale-105' : 'bg-slate-800 border-slate-700 hover:border-emerald-500/50'}`}>
                                <button onClick={() => {setSelectedIzlazId(id); fetchIzlaz(id);}} className="px-4 py-2 font-black">{id}</button>
                                <button onClick={() => otkaziPaket(id)} className="px-3 py-2 text-red-300 hover:text-white hover:bg-red-500 rounded-r-lg font-black border-l border-slate-700" title="Skloni sa ekrana">✕</button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* IZLAZNI BLOK (ZELENO) */}
                <div className="relative font-black border-t border-slate-700 pt-5">
                    {saas.isEditMode ? (
                        <input value={saas.ui.naslov_izlaz} onChange={e => saas.setUi({...saas.ui, naslov_izlaz: e.target.value})} className="w-full bg-slate-900 text-amber-400 p-2 mb-2 rounded border border-amber-500/50 text-[10px] uppercase font-black" placeholder="Naslov iznad skenera izlaza..." />
                    ) : (
                        <label className={`text-[10px] uppercase ${saas.ui.boja_teksta_izlaz} block mb-2 tracking-widest ml-4`}>{saas.ui.naslov_izlaz}</label>
                    )}
                    <div className="flex bg-[#0f172a] border border-emerald-500/50 rounded-xl overflow-hidden shadow-inner shadow-[0_0_15px_rgba(16,185,129,0.1)] focus-within:border-emerald-400">
                        <input type="text" value={izlazScan} onChange={e => handleIzlazInput(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') handleIzlazInput(izlazScan, true) }} placeholder="Upiši ili skeniraj izlazni paket..." className="flex-1 p-4 bg-transparent text-center text-lg text-white outline-none uppercase font-black" />
                        <button onClick={() => {setScanTarget('izlaz'); setIsScanning(true);}} className="px-6 bg-emerald-600/30 text-emerald-400 font-bold hover:bg-emerald-500 hover:text-white transition-all text-xl shadow-lg border-l border-emerald-500/50">📷</button>
                    </div>
                </div>
                
                {selectedIzlazId && (
                    <div className="animate-in zoom-in-50 space-y-4 bg-slate-900 p-5 rounded-3xl border border-emerald-500/50 mt-4 shadow-2xl">
                        <div className="flex justify-between items-center border-b border-slate-700 pb-2 mb-2">
                            <h3 className="text-emerald-400 font-black uppercase text-sm drop-shadow-md">Paket u radu: <span className="text-white text-lg">{selectedIzlazId}</span></h3>
                            <button onClick={() => zakljuciPaket(selectedIzlazId)} className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)] transition-all">🏁 Zaključi Paket</button>
                        </div>

                        {activeEditItem && (
                            <div className="p-4 bg-slate-950/80 rounded-2xl border border-blue-500/50 shadow-inner">
                                <div className="flex justify-between items-center"><span className="text-[10px] text-blue-300 uppercase font-black">Ažuriranje: {activeEditItem.naziv_proizvoda}</span><button onClick={()=>setActiveEditItem(null)} className="text-red-500 text-xs font-black hover:underline">PONIŠTI ×</button></div>
                                <div className="flex bg-slate-900 p-1 rounded-xl mt-3"><button onClick={() => setUpdateMode('dodaj')} className={`flex-1 py-2 rounded-lg text-[10px] uppercase font-black transition-all ${updateMode==='dodaj'?'bg-emerald-600 text-white shadow-lg':'text-slate-500'}`}>+ Dodaj komade</button><button onClick={() => setUpdateMode('oduzmi')} className={`flex-1 py-2 rounded-lg text-[10px] uppercase font-black transition-all ${updateMode==='oduzmi'?'bg-red-600 text-white shadow-lg':'text-slate-500'}`}>- Oduzmi komade</button></div>
                            </div>
                        )}
                        
                        <div className="pt-2">
                            <label className="text-[10px] text-slate-500 uppercase ml-2 block mb-1">PROIZVOD KOJI SE SLAŽE</label>
                            <PD_SearchableProizvod katalog={katalog} value={form.naziv} onSelect={k => setForm({...form, naziv: k.naziv, debljina: k.visina, sirina: k.sirina, duzina: k.duzina, jm: 'kom'})} />
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-2">
                            <DimBox label="Deb (cm)" val={form.debljina} set={v => setForm({...form, debljina: v})} disabled={!!activeEditItem} />
                            <DimBox label="Šir (cm)" val={form.sirina} set={v => setForm({...form, sirina: v})} disabled={!!activeEditItem} />
                            <DimBox label="Duž (cm)" val={form.duzina} set={v => setForm({...form, duzina: v})} disabled={!!activeEditItem} />
                        </div>
                        <div className="flex gap-2 items-center">
                            <input type="number" value={form.kolicina_ulaz} onKeyDown={e => {if(e.key==='Enter') saveIzlaz()}} onChange={e => setForm({...form, kolicina_ulaz: e.target.value})} className="flex-1 p-5 bg-[#0f172a] border-2 border-emerald-500/50 rounded-2xl text-2xl text-center text-emerald-400 font-black focus:border-emerald-400 transition-colors placeholder-emerald-900/50" placeholder="Unesi količinu..." />
                            <select value={form.jm} onChange={e => setForm({...form, jm: e.target.value})} className="bg-slate-800 p-5 rounded-2xl text-white font-black outline-none border border-slate-700 focus:border-emerald-500 text-lg uppercase"><option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option></select>
                        </div>

                        {dostupneOznake.length > 0 && (
                            <div className="space-y-2 mt-4 bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-inner">
                                <label className="text-[10px] text-slate-400 uppercase font-black ml-1">Dodatne operacije na paketu:</label>
                                <div className="flex flex-wrap gap-2">
                                    {dostupneOznake.map(o => (
                                        <button key={o} onClick={() => toggleOznaka(o)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${odabraneOznake.includes(o) ? 'bg-amber-600 border-amber-400 text-white shadow-[0_0_15px_rgba(217,119,6,0.4)] scale-105' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:bg-slate-700'}`}>
                                            {odabraneOznake.includes(o) ? '✓ ' : '+ '} {o}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button onClick={saveIzlaz} className={`w-full py-6 mt-4 text-white font-black rounded-2xl uppercase shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:scale-[1.02] transition-all text-sm tracking-widest ${activeEditItem ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                            {activeEditItem ? `✅ SAČUVAJ IZMJENE STAVKE` : `➕ DODAJ U PAKET`}
                        </button>
                        
                        <div className="pt-6 space-y-3 max-h-60 overflow-y-auto border-t border-slate-700">
                        <label className="text-[10px] text-slate-400 uppercase font-black block mb-2 tracking-widest">Šta se sve nalazi u ovom paketu:</label>
                        {izlazPackageItems.length === 0 && <div className="text-center p-6 border-2 border-dashed border-slate-700 rounded-2xl text-slate-500 text-xs font-bold">Paket je prazan.</div>}
                        {izlazPackageItems.map(item => {
                            const rnStavka = rnStavke.find(rs => rs.naziv_proizvoda === item.naziv_proizvoda);
                            let preostaloText = null;
                            if (rnStavka) {
                                const preostalo = rnStavka.naruceno - rnStavka.napravljeno;
                                if (preostalo > 0) {
                                    let pM3 = 0, pKom = 0;
                                    if (rnStavka.jm === 'm3') { pM3 = preostalo; pKom = rnStavka.vol1kom > 0 ? Math.ceil(preostalo / rnStavka.vol1kom) : 0; }
                                    else if (rnStavka.jm === 'kom') { pKom = preostalo; pM3 = preostalo * rnStavka.vol1kom; }
                                    else { pM3 = preostalo; }
                                    preostaloText = `${pM3.toFixed(3)} m³ (${pKom} kom)`;
                                } else preostaloText = '0 (GOTOVO)';
                            }

                            return (
                            <div key={item.id} onClick={() => { setActiveEditItem(item); setForm({...item, kolicina_ulaz: '' }); }} className="flex justify-between items-center p-4 bg-slate-950 border border-slate-800 rounded-2xl cursor-pointer hover:border-emerald-500 transition-all shadow-md group">
                                <div>
                                    <div className="text-xs uppercase text-white font-black">{item.naziv_proizvoda}</div>
                                    <div className="text-emerald-500 text-lg font-black tracking-tighter mt-1 drop-shadow-md">{item.debljina}x{item.sirina}x{item.duzina} <span className="text-[10px] text-slate-500 ml-1">cm</span></div>
                                    <div className="flex flex-wrap gap-2 items-center mt-2">
                                        {item.oznake && item.oznake.length > 0 && (<div className="flex gap-1">{item.oznake.map(o => <span key={o} className="text-[8px] bg-amber-900/40 text-amber-400 px-2 py-1 rounded uppercase font-black border border-amber-500/30">{o}</span>)}</div>)}
                                        {rnStavka && (<div className="text-[9px] bg-blue-900/40 border border-blue-500/30 px-2 py-1 rounded uppercase font-black text-blue-300 shadow-sm">Nalog Preostalo: <span className={preostaloText !== '0 (GOTOVO)' ? 'text-amber-400' : 'text-emerald-400'}>{preostaloText}</span></div>)}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-3">
                                    <div className="text-right font-black"><div className="text-2xl text-white drop-shadow-lg">{item.kolicina_final} <span className="text-emerald-500 text-sm">m³</span></div><div className="text-[10px] text-slate-500 bg-slate-900 px-2 py-1 rounded mt-1 text-center inline-block">{item.kolicina_ulaz} {item.jm}</div></div>
                                    <button onClick={(e) => { e.stopPropagation(); printDeklaracijaPaketa(item.paket_id, [item], radniNalog); }} className="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-blue-500/30 transition-all shadow-lg opacity-0 group-hover:opacity-100">🖨️ Print QR</button>
                                </div>
                            </div>
                        )})}
                        </div>
                    </div>
                )}
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