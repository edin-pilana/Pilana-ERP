"use client";
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import SmartSearchableInput from '../components/SmartSearchableInput';
import ScannerOverlay from '../components/ScannerOverlay';
import { printDeklaracijaPaketa, printFaznaDeklaracijaPaketa } from '../utils/printHelpers';
import { useSaaS } from '../utils/useSaaS';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function DimBox({ label, val, set, disabled }) {
    return (
        <div className={`bg-theme-panel p-3 rounded-xl border border-theme-border shadow-inner font-bold text-center flex flex-col items-center justify-center focus-within:border-theme-accent transition-colors ${disabled ? 'opacity-50' : ''}`}>
            <span className="text-[9px] text-theme-muted uppercase block mb-1 font-black tracking-widest">{label}</span>
            <input type="number" value={val} onChange={e => set(e.target.value)} disabled={disabled} className="w-full bg-transparent text-theme-text font-black outline-none text-xl text-center" placeholder="0" />
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
            <h3 className="text-theme-accent font-black uppercase text-xs tracking-widest">⚙️ Evidencija rada i zastoja mašine</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-theme-panel p-4 rounded-2xl border border-theme-border items-start shadow-inner">
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
                <button onClick={snimiZastojIliRad} className={`w-full py-4 bg-orange-600 text-white font-black rounded-xl text-[10px] uppercase shadow-lg hover:bg-orange-500 ${saas.isEditMode ? 'opacity-50 pointer-events-none col-span-4' : 'col-span-4 md:col-span-4 mt-2'}`}>➕ Dodaj Zapis u Dnevnik</button>
            </div>
            <div className="space-y-2 mt-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {logovi.length === 0 && <p className="text-center text-theme-muted text-[10px] uppercase p-4 border border-dashed border-theme-border rounded-xl">Nema unesenih zastoja za danas.</p>}
                {logovi.map(l => (
                    <div key={l.id} className="flex justify-between items-center p-4 bg-theme-card border border-theme-border rounded-xl shadow-sm">
                        <div>
                            <p className="text-[10px] text-theme-muted font-black uppercase tracking-widest"><span className="text-theme-accent">{l.vrijeme_od}</span> - {l.vrijeme_do ? <span className="text-amber-400">{l.vrijeme_do}</span> : <span className="text-theme-muted">...</span>}</p>
                            <p className="text-theme-text text-sm font-bold mt-1">{l.napomena || 'Nema napomene'}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            {l.zastoj_min > 0 && <span className="text-red-400 text-xs font-black bg-red-900/30 px-3 py-1 rounded border border-red-500/30 shadow-inner">Zastoj: {l.zastoj_min} min</span>}
                            <button onClick={() => obrisiLog(l.id)} className="text-red-500 font-black hover:bg-red-500/20 p-3 rounded-lg transition-colors">✕</button>
                        </div>
                    </div>
                ))}
            </div>
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
        document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside);
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
        <div ref={wrapperRef} className="relative font-black w-full h-[50px] overflow-visible">
            <input value={search} onFocus={() => setOpen(true)} onKeyDown={handleKeyDown} onChange={e => { setSearch(e.target.value); onChange(e.target.value); setOpen(true); }} placeholder="Pronađi proizvod ili UNESI SLOBODAN NAZIV..." className="w-full h-full p-4 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none focus:border-theme-accent uppercase shadow-inner" />
            {open && search && (
                <div className="absolute z-50 w-full mt-2 bg-theme-card border border-theme-border rounded-xl shadow-2xl max-h-60 overflow-y-auto text-left custom-scrollbar backdrop-blur-xl">
                    {filtered.map((k, index) => (
                        <div key={k.sifra} onClick={() => { onSelect(k); setSearch(k.naziv); onChange(k.naziv); setOpen(false); }} onMouseEnter={()=>setSelectedIndex(index)} className={`p-4 border-b border-theme-border cursor-pointer transition-colors ${index === selectedIndex ? 'bg-theme-accent text-white' : 'hover:bg-theme-panel text-theme-text'}`}>
                            <div className="text-xs font-black">{k.sifra} - {k.naziv}</div>
                            <div className="text-[10px] opacity-80 mt-1">Dim: {k.visina}x{k.sirina}x{k.duzina} | Baza: {k.default_jedinica}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function DoradaModule({ user, header, setHeader, onExit }) {
    const saas = useSaaS('dorada_modul', {
        boja_kartice: '#1e293b',
        naslov_skenera: 'SKENIRAJ ILI UPIŠI NOVI PAKET (IZLAZ)',
        polja_radnici: [
            { id: 'operater', label: '👨‍🔧 ODGOVORNI OPERATER', span: 'col-span-1' },
            { id: 'viljuskarista', label: '🚜 VILJUŠKARISTA', span: 'col-span-1' }
        ],
        polja_dnevnik: [
            { id: 'pocetak', label: 'POČETAK', span: 'col-span-1' },
            { id: 'kraj', label: 'ZAVRŠETAK', span: 'col-span-1' },
            { id: 'zastoj', label: 'ZASTOJ (MINUTA)', span: 'col-span-1' },
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

    const [izlazScan, setIzlazScan] = useState('');
    const [skenerSirovine, setSkenerSirovine] = useState('');
    const [sirovinaPaketi, setSirovinaPaketi] = useState([]);

    const [katalog, setKatalog] = useState([]);
    const [aktivniNalozi, setAktivniNalozi] = useState([]); // Ako zatreba za pretragu RN
    const [rnStavke, setRnStavke] = useState([]); // Lista stavki sa učitanog RN
    const [radniNalog, setRadniNalog] = useState(''); // Aktivni RN (izvučen iz sirovine)

    const [activeIzlazIds, setActiveIzlazIds] = useState([]);
    const [selectedIzlazId, setSelectedIzlazId] = useState('');
    const [izlazPackageItems, setIzlazPackageItems] = useState([]);
    const [activeEditItem, setActiveEditItem] = useState(null);
    const [updateMode, setUpdateMode] = useState('dodaj');

    // IZOLOVANA MEMORIJA ZA DORADU - Radnici se pamte PO MAŠINI da ne bi "krali" radnike jedni drugima
    const [operater, setOperater] = useState('');
    const [viljuskarista, setViljuskarista] = useState('');
    const [radniciList, setRadniciList] = useState([]);

    const [form, setForm] = useState({ naziv: '', debljina: '', sirina: '', duzina: '', kolicina_ulaz: '', jm: 'kom', rn_stavka_id: null });
    const [isScanning, setIsScanning] = useState(false);
    const [scanTarget, setScanTarget] = useState('');
    const [dostupneOznake, setDostupneOznake] = useState([]); 
    const [odabraneOznake, setOdabraneOznake] = useState([]);
    const timerRef = useRef(null);

    useEffect(() => {
        supabase.from('radnici').select('ime_prezime').then(({data}) => setRadniciList(data ? data.map(r=>r.ime_prezime) : []));
        supabase.from('katalog_proizvoda').select('*').then(({data}) => setKatalog(data || []));
        ucitajSveZapoocetePakete();
    }, [header?.masina]);

    const ucitajSveZapoocetePakete = async () => {
        if (!header?.masina) return;
        const { data } = await supabase.from('paketi').select('paket_id').is('closed_at', null).eq('masina', header.masina);
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

        // 1. UČITAVANJE IZ BAZE SAMO ONA LICA KOJA IMAJU ULOGU OPERATERA NA OVOJ MAŠINI U DORADI
        const ucitajDezurneRadnike = async () => {
            if (!header?.masina) return;
            const { data } = await supabase.from('aktivni_radnici')
                .select('radnik_ime, uloga')
                .eq('masina_naziv', header.masina)
                .is('vrijeme_odjave', null);
                
            if (data) {
                const o = data.find(r => r.uloga === 'operater_dorada');
                const v = data.find(r => r.uloga === 'viljuskarista_dorada');
                
                if (o) setOperater(o.radnik_ime); else setOperater('');
                if (v) setViljuskarista(v.radnik_ime); else setViljuskarista('');
            } else {
                setOperater(''); setViljuskarista('');
            }
        };
        ucitajDezurneRadnike();
    }, [header?.masina]);

    // 2. AKCIJA KADA KORISNIK IZABERE OPERATERA U INPUTU (Strogo vezano za ovu mašinu)
    const handleOperaterChange = async (novoIme) => {
        if (header?.masina) {
            await supabase.from('aktivni_radnici')
                .update({ vrijeme_odjave: new Date().toISOString() })
                .eq('masina_naziv', header.masina)
                .eq('uloga', 'operater_dorada')
                .is('vrijeme_odjave', null);

            if (novoIme) {
                await supabase.from('aktivni_radnici').insert([{ radnik_ime: novoIme, masina_naziv: header.masina, vrijeme_prijave: new Date().toISOString(), uloga: 'operater_dorada' }]);
            }
            window.dispatchEvent(new Event('radnici_updated')); // OBAVIJESTI MASTER HEADER
        }
        setOperater(novoIme);
    };

    // 3. AKCIJA KADA KORISNIK IZABERE VILJUŠKARISTU U INPUTU (Strogo vezano za ovu mašinu)
    const handleViljuskaristaChange = async (novoIme) => {
        if (header?.masina) {
            await supabase.from('aktivni_radnici')
                .update({ vrijeme_odjave: new Date().toISOString() })
                .eq('masina_naziv', header.masina)
                .eq('uloga', 'viljuskarista_dorada')
                .is('vrijeme_odjave', null);

            if (novoIme) {
                await supabase.from('aktivni_radnici').insert([{ radnik_ime: novoIme, masina_naziv: header.masina, vrijeme_prijave: new Date().toISOString(), uloga: 'viljuskarista_dorada' }]);
            }
            window.dispatchEvent(new Event('radnici_updated')); // OBAVIJESTI MASTER HEADER
        }
        setViljuskarista(novoIme);
    };

    // FUNKCIJA ZA UČITAVANJE RADNOG NALOGA AKO JE VEZAN ZA SIROVINU
    const ucitajNalogIzSirovine = async (brojVeze) => {
        if (!brojVeze) { setRadniNalog(''); setRnStavke([]); return; }
        
        setRadniNalog(brojVeze);
        const {data} = await supabase.from('radni_nalozi').select('*').eq('id', brojVeze.toUpperCase()).maybeSingle();
        
        if (data) {
            const ucitaneStavke = data.stavke_jsonb || [];
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
                    
                    // OVO JE DODATAK ZA SLIKU (SKICU)
                    let skica = null;

                    if (isFazni) {
                        const fazaZaOvuMasinu = (tehnologija[s.id] || []).find(f => f.masina?.toUpperCase() === header.masina?.toUpperCase());
                        if (!fazaZaOvuMasinu) return; // Nije za ovu mašinu

                        dimenzije = fazaZaOvuMasinu.dimenzija || dimenzije;
                        naruceno = parseFloat(fazaZaOvuMasinu.kolicina || 0);
                        jm = fazaZaOvuMasinu.jm || jm;
                        oznake = fazaZaOvuMasinu.oznake || [];
                        napravljeno = parseFloat(s.napravljeno_po_fazama?.[header.masina] || 0);
                        // Tražimo skicu u fazi, ako nema onda povlačimo globalnu skicu proizvoda
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
                        skica_url: skica // Proslijedimo sliku/skicu dalje
                    });
                });
                
                setRnStavke(mapiraneStavke);
            } else { setRnStavke([]); }
        }
    };

    const processSirovina = async (val) => {
        const id = val.toUpperCase().trim();
        if(!id) return;
        const { data } = await supabase.from('paketi').select('*').eq('paket_id', id);
        if(data && data.length > 0) {
            if(!sirovinaPaketi.find(p => p.paket_id === id)) {
                setSirovinaPaketi(prev => [...prev, ...data]);
                // Čim dodamo sirovinu, provjeri ima li Radni Nalog i učitaj mu zadatke
                if(data[0].broj_veze) {
                    ucitajNalogIzSirovine(data[0].broj_veze);
                }
            }
        } else {
            alert(`Paket ${id} ne postoji u bazi!`);
        }
        setSkenerSirovine('');
    };

    const handleSirovinaInput = (val, isEnter = false) => {
        setSkenerSirovine(val);
        if(timerRef.current) clearTimeout(timerRef.current);
        if(!val) return;
        if(isEnter) processSirovina(val);
        else timerRef.current = setTimeout(() => processSirovina(val), 2000);
    };

    const ukloniSirovinu = (paketId) => {
        const noviPaketi = sirovinaPaketi.filter(p => p.paket_id !== paketId);
        setSirovinaPaketi(noviPaketi);
        // Ako smo obrisali svu sirovinu, poništi radni nalog
        if(noviPaketi.length === 0) {
            setRadniNalog('');
            setRnStavke([]);
        }
    };

    const fetchIzlaz = async (pid) => { 
        const { data } = await supabase.from('paketi').select('*').eq('paket_id', pid); 
        setIzlazPackageItems(data || []); 
    };

    const processIzlaz = async (val) => {
        const id = val.toUpperCase().trim();
        if (!activeIzlazIds.includes(id)) {
            const { data: existing } = await supabase.from('paketi').select('*').eq('paket_id', id);
            if (existing && existing.length > 0) {
                const spisak = existing.map(i => `- ${i.naziv_proizvoda}: ${i.kolicina_final} ${i.jm}`).join('\n');
                if (!window.confirm(`📦 PAKET JE PRONAĐEN U BAZI: ${id}\n\nTrenutno sadrži:\n${spisak}\n\nŽelite li nastaviti rad na ovom paketu?`)) { 
                    setIzlazScan(''); return; 
                }
            }
            setActiveIzlazIds(p => [...p, id]);
        }
        setSelectedIzlazId(id); fetchIzlaz(id); setIzlazScan('');
    };

    const handleIzlazInput = (val, isEnter = false) => {
        setIzlazScan(val);
        if(timerRef.current) clearTimeout(timerRef.current);
        if(!val) return;
        if (isEnter) processIzlaz(val);
        else timerRef.current = setTimeout(() => processIzlaz(val), 2000);
    };

    const toggleOznaka = (o) => { setOdabraneOznake(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o]); };

    const save = async () => {
        if (!operater) return alert("⚠️ ZABRANJENO: Molimo odaberite Operatera na mašini (Lijeva kolona) prije snimanja paketa!");
        if (!selectedIzlazId) return alert("Prvo skenirajte ili unesite ID za NOVI IZLAZNI PAKET!");
        if (sirovinaPaketi.length === 0) return alert("Morate unijeti barem jedan paket ulazne sirovine!");
        if (!form.kolicina_ulaz) return alert("⚠️ Unesite količinu novog proizvoda!");

        const v = parseFloat(form.debljina) || 1; const s = parseFloat(form.sirina) || 1; const d = parseFloat(form.duzina) || 1;
        const unosKol = parseFloat(form.kolicina_ulaz);
        let komada = unosKol;
        if (form.jm === 'm3') komada = unosKol / ((v/100) * (s/100) * (d/100));
        else if (form.jm === 'm2') komada = unosKol / ((s/100) * (d/100));
        else if (form.jm === 'm1') komada = unosKol / (d/100);
        const qtyZaPaket = parseFloat((komada * (v/100) * (s/100) * (d/100)).toFixed(3));

        const timeNowFull = new Date().toISOString();
        const timeNow = new Date().toLocaleTimeString('de-DE');

        const { data: aktuelniRadnici } = await supabase.from('aktivni_radnici').select('radnik_ime').eq('masina_naziv', header.masina).is('vrijeme_odjave', null);
        const radniciIzDorade = aktuelniRadnici ? aktuelniRadnici.map(r => r.radnik_ime).join(', ') : '';

        const sirovineIdsText = [...new Set(sirovinaPaketi.map(p => p.paket_id))].join(', ');
        const vezniNalog = sirovinaPaketi.length > 0 ? sirovinaPaketi[0].broj_veze : null;

        let isNusProizvod = false;
        let currentRnStavka = null;

        if (form.rn_stavka_id) {
            currentRnStavka = rnStavke.find(rs => rs.id === form.rn_stavka_id);
            if (currentRnStavka && currentRnStavka.naziv_proizvoda !== form.naziv) {
                isNusProizvod = true;
            }
        } else if (vezniNalog) {
            isNusProizvod = true; 
        }

        if (currentRnStavka && !isNusProizvod && !activeEditItem) {
            const vecNapravljeno = parseFloat(currentRnStavka.napravljeno) || 0;
            const naruceno = parseFloat(currentRnStavka.naruceno) || 0;
            let kolikoSadPravimo = komada;
            if (currentRnStavka.jm === 'm3') kolikoSadPravimo = qtyZaPaket;
            else if (currentRnStavka.jm === 'm2') kolikoSadPravimo = komada * (s/100) * (d/100);
            else if (currentRnStavka.jm === 'm1') kolikoSadPravimo = komada * (d/100);

            if ((vecNapravljeno + kolikoSadPravimo) > naruceno) {
                const preostalo = naruceno - vecNapravljeno;
                if (!window.confirm(`⚠️ UPOZORENJE: PRELAZITE NORMU!\n\nZa ovaj Radni Nalog je preostalo samo: ${preostalo.toFixed(3)} ${currentRnStavka.jm}.\nVi pokušavate dodati: ${kolikoSadPravimo.toFixed(3)} ${currentRnStavka.jm}.\n\nDa li ste sigurni da želite napraviti ovaj višak? (Samo uz odobrenje šefa)`)) {
                    return; 
                }
            }
        }

        if (activeEditItem) {
            const newM3 = updateMode === 'dodaj' ? parseFloat(activeEditItem.kolicina_final) + qtyZaPaket : parseFloat(activeEditItem.kolicina_final) - qtyZaPaket;
            const { error } = await supabase.from('paketi').update({ 
                kolicina_final: parseFloat(newM3.toFixed(3)), vrijeme_tekst: timeNow, snimio_korisnik: user?.ime_prezime,
                brentista: operater, viljuskarista: viljuskarista, radnici_pilana: radniciIzDorade, 
                oznake: odabraneOznake.length > 0 ? odabraneOznake : activeEditItem.oznake,
                broj_veze: vezniNalog, ai_sirovina_ids: sirovineIdsText 
            }).eq('id', activeEditItem.id);
            if (error) return alert("❌ GREŠKA PRI AŽURIRANJU: " + error.message);
        } else {
            const payload = {
                paket_id: selectedIzlazId, naziv_proizvoda: form.naziv, debljina: v, sirina: s, duzina: d,
                kolicina_ulaz: form.kolicina_ulaz, jm: form.jm, kolicina_final: qtyZaPaket, mjesto: header.mjesto, masina: header.masina,
                snimio_korisnik: user?.ime_prezime, brentista: operater, viljuskarista: viljuskarista, radnici_pilana: radniciIzDorade, 
                ai_sirovina_ids: sirovineIdsText, broj_veze: vezniNalog, vrijeme_tekst: timeNow, datum_yyyy_mm: header.datum, oznake: odabraneOznake
            };
            const { error } = await supabase.from('paketi').insert([payload]);
            if (error) return alert("Greška: " + error.message);

            if(currentRnStavka && !isNusProizvod) {
                const rn_jm = form.rn_jm || 'm3';
                let napravljenoZaRN = komada;
                if (rn_jm === 'm3') napravljenoZaRN = komada * (v/100) * (s/100) * (d/100);
                else if (rn_jm === 'm2') napravljenoZaRN = komada * (s/100) * (d/100);
                else if (rn_jm === 'm1') napravljenoZaRN = komada * (d/100);

                const {data: rn} = await supabase.from('radni_nalozi').select('stavke_jsonb, tip_naloga').eq('id', vezniNalog.toUpperCase()).maybeSingle();
                if (rn && rn.stavke_jsonb) {
                    const isFazni = rn.tip_naloga === 'FAZNI';
                    const azurirane = rn.stavke_jsonb.map(st => {
                        if (st.id === form.rn_stavka_id) {
                            if (isFazni) {
                                const trenutnoFaza = parseFloat(st.napravljeno_po_fazama?.[header.masina] || 0);
                                return { ...st, napravljeno_po_fazama: { ...(st.napravljeno_po_fazama || {}), [header.masina]: parseFloat((trenutnoFaza + napravljenoZaRN).toFixed(4)) } };
                            } else {
                                const nova = (parseFloat(st.napravljeno) || 0) + napravljenoZaRN;
                                return { ...st, napravljeno: parseFloat(nova.toFixed(4)) };
                            }
                        }
                        return st;
                    });
                    await supabase.from('radni_nalozi').update({ stavke_jsonb: azurirane }).eq('id', vezniNalog.toUpperCase());
                }
                ucitajNalogIzSirovine(vezniNalog);
                setForm(f => ({ ...f, napravljeno: (parseFloat(f.napravljeno) + napravljenoZaRN).toFixed(4) }));
            }
        }
        fetchIzlaz(selectedIzlazId); setForm(f => ({...f, kolicina_ulaz: ''})); setOdabraneOznake([]); setActiveEditItem(null);
    };

    const obrisiStavkuIzPaketa = async (item, e) => {
        e.stopPropagation();
        if(!window.confirm(`Da li ste sigurni da želite OBRISATI stavku iz ovog paketa?`)) return;
        await supabase.from('paketi').delete().eq('id', item.id);
        fetchIzlaz(selectedIzlazId);
    };

    const zakljuciPaket = async (pid) => {
        if(izlazPackageItems.length === 0) {
            setActiveIzlazIds(p => p.filter(x => x !== pid));
            if (selectedIzlazId === pid) setSelectedIzlazId('');
            alert(`Prazan paket ${pid} je zatvoren i oslobođen.`); return;
        }
        if (window.confirm(`ZAKLJUČITI paket ${pid}?`)) {
            await supabase.from('paketi').update({ closed_at: new Date().toISOString() }).eq('paket_id', pid);
            if (window.confirm(`📦 Paket uspješno zaključen!\n\nŽelite li odmah isprintati A5 deklaraciju za ovaj paket?`)) {
                printDeklaracijaPaketa(pid, izlazPackageItems, sirovinaPaketi.length > 0 ? sirovinaPaketi[0].broj_veze : '');
            }
            setActiveIzlazIds(p => p.filter(x => x !== pid));
            if (selectedIzlazId === pid) { setSelectedIzlazId(''); setIzlazPackageItems([]); }
            
            // Očisti sirovinu i nalog da operater mora skenirati novu
            setSirovinaPaketi([]);
            setRadniNalog('');
            setRnStavke([]);
        }
    };

    const otkaziPaket = (pid) => {
        if(window.confirm(`Ukloniti paket ${pid} sa ekrana? (Ostat će u bazi kao Započet)`)) {
            setActiveIzlazIds(p => p.filter(x => x !== pid));
            if(selectedIzlazId === pid) { setSelectedIzlazId(''); setIzlazPackageItems([]); }
        }
    };

    const handleStavkaNalogaKlik = (stavka) => {
        if(!selectedIzlazId) return alert("⚠️ UPOZORENJE:\n\nPrvo desno skenirajte ili upišite ime novog PAKETA (Izlaz) u koji ćete slagati ovu robu!");
        
        let deb = '', sir = '', duz = '';
        if (stavka.isFazni && stavka.dimenzije && stavka.dimenzije !== 'Nema u katalogu') {
            const parts = stavka.dimenzije.split(/x|\*/i); 
            if (parts.length >= 3) { deb = parts[0].trim(); sir = parts[1].trim(); duz = parts[2].trim(); }
        } else {
            const kat = katalog.find(k => k.sifra === stavka.sifra_proizvoda);
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

        const formElement = document.getElementById('package-form-area');
        if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });
    };

    const renderRadnikPolje = (polje) => {
        if (polje.id === 'operater') return <div className="h-full w-full min-w-0 bg-transparent text-theme-text font-black text-sm uppercase px-2 py-1 outline-none focus-within:border-theme-accent overflow-visible"><SmartSearchableInput value={operater} onChange={handleOperaterChange} list={radniciList} /></div>;
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
            
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} user={user} modulIme="dorada" saas={saas} />
            
            <div className="text-center mb-6">
                <h2 className="text-theme-accent font-black tracking-widest uppercase text-xl md:text-2xl drop-shadow-md flex items-center justify-center gap-3">
                    🛠️ DORADA (PRERADA DASKE)
                </h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                <div className="lg:col-span-5 space-y-6">
                    
                    <div className="p-6 rounded-[var(--radius-box)] shadow-2xl transition-all border border-theme-border bg-theme-card backdrop-blur-[var(--glass-blur)]">
                        <h3 className="text-[10px] text-theme-muted uppercase font-black tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-theme-accent"></span> Ekipa na mašini
                        </h3>
                        <div className="space-y-4">
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

                    <div className="p-6 rounded-[var(--radius-box)] shadow-2xl border border-theme-border bg-theme-card backdrop-blur-[var(--glass-blur)]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-[10px] text-amber-500 uppercase font-black tracking-widest flex items-center gap-2">
                                🪵 Ulazni Paketi (Sirovina)
                            </h3>
                            {sirovinaPaketi.length > 0 && (
                                <button onClick={() => { setSirovinaPaketi([]); setRadniNalog(''); setRnStavke([]); }} className="text-[9px] text-red-400 hover:text-red-300 uppercase bg-red-900/20 px-2 py-1 rounded border border-red-500/30 transition-all font-black">
                                    ✕ Ukloni Sve
                                </button>
                            )}
                        </div>
                        
                        <div className="flex w-full bg-theme-panel border border-amber-500/50 rounded-xl overflow-hidden focus-within:border-amber-400 transition-all shadow-inner h-14">
                             <input value={skenerSirovine} onChange={e => handleSirovinaInput(e.target.value)} onKeyDown={e => {if(e.key === 'Enter') handleSirovinaInput(skenerSirovine, true)}} placeholder="Skeniraj ili upiši paket..." className="flex-1 px-4 bg-transparent text-sm text-theme-text outline-none uppercase font-black placeholder:text-theme-muted/50" />
                             <button onClick={() => {setScanTarget('sirovina'); setIsScanning(true);}} className="px-6 bg-amber-500/20 text-amber-500 border-l border-amber-500/30 hover:bg-amber-500 hover:text-white transition-all font-black">📷</button>
                        </div>

                        {sirovinaPaketi.length > 0 && (
                            <div className="mt-4 space-y-2 border-t border-theme-border pt-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                {sirovinaPaketi.map((p, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-theme-panel rounded-xl border border-theme-border shadow-md">
                                        <div>
                                            <div className="text-xs text-amber-500 font-black">{p.paket_id}</div>
                                            <div className="text-[10px] text-theme-muted font-bold">{p.naziv_proizvoda} ({p.debljina}x{p.sirina}x{p.duzina})</div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-black text-theme-text">{p.kolicina_final} <span className="text-xs text-theme-muted">m³</span></span>
                                            <button onClick={() => ukloniSirovinu(p.paket_id)} className="text-red-400 hover:text-red-300 font-black text-lg ml-2">×</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {rnStavke.length > 0 && (
                            <div className="mt-4 border-t border-theme-border pt-4">
                                <span className="text-[10px] text-theme-accent uppercase font-black mb-2 block tracking-widest flex justify-between items-center">
                                    <span>Zadaci (RN: {radniNalog})</span>
                                </span>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {rnStavke.map(s => {
                                        const preostalo = s.naruceno - s.napravljeno;
                                        return (
                                        <div key={s.id} onClick={() => handleStavkaNalogaKlik(s)} className="flex flex-col p-4 bg-theme-panel rounded-xl cursor-pointer hover:border-theme-accent transition-all border border-theme-border shadow-md group">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="text-xs text-theme-text font-black group-hover:text-theme-accent transition-colors">{s.sifra_proizvoda} - {s.naziv_proizvoda}</div>
                                                    <div className="text-[10px] text-theme-muted mt-1 font-bold">
                                                        {s.isFazni ? <span className="text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 mr-2">FAZA: {header.masina}</span> : ''}
                                                        {s.isFazni ? `Cilj:` : `Dimenzije:`} {s.dimenzije}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] text-theme-muted font-black">Naručeno: <span className="text-theme-text">{s.naruceno} {s.jm}</span></div>
                                                    <div className={`text-xs font-black mt-1 ${preostalo > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>Falilo: {preostalo > 0 ? preostalo : 'GOTOVO ✅'}</div>
                                                </div>
                                            </div>
                                            
                                            {/* OVO JE DUGME ZA SKICU / PDF */}
                                            {s.skica_url && (
                                                <div className="mt-3 pt-2 border-t border-theme-border">
                                                    <button onClick={(e) => { e.stopPropagation(); window.open(s.skica_url, '_blank'); }} className="text-[9px] bg-theme-accent/20 text-theme-accent px-3 py-1.5 rounded-lg border border-theme-accent/30 flex items-center gap-2 hover:bg-theme-accent hover:text-white transition-colors font-black uppercase tracking-widest w-fit">
                                                        📎 Prikaz Skice / PDF-a
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )})}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-7 space-y-6">
                    
                    <div className={`p-8 rounded-[var(--radius-box)] shadow-[0_0_40px_rgba(0,0,0,0.3)] border bg-theme-card backdrop-blur-[var(--glass-blur)] relative overflow-hidden group ${saas.isEditMode ? 'border-dashed border-amber-500' : 'border-theme-accent/40'}`}>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-theme-accent to-transparent opacity-50"></div>
                        
                        <label className={`text-xs uppercase text-theme-accent block mb-4 font-black tracking-widest text-center`}>
                            {saas.ui.naslov_skenera || "SKENIRAJ ILI UPIŠI NOVI PAKET (IZLAZ)"}
                        </label>
                        
                        <div className={`flex bg-theme-panel border-2 rounded-2xl overflow-hidden shadow-inner focus-within:shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] transition-all h-20 ${saas.isEditMode ? 'border-amber-500/50 opacity-50 pointer-events-none' : 'border-theme-accent/50 focus-within:border-theme-accent'}`}>
                            <input value={izlazScan} onChange={e => handleIzlazInput(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') handleIzlazInput(izlazScan, true) }} className="flex-1 px-6 bg-transparent text-xl md:text-2xl text-center text-theme-text outline-none uppercase font-black placeholder:text-theme-muted/30 tracking-widest" placeholder="ČEKAM SKEN NOVI PAKET..." />
                            <button onClick={() => {setScanTarget('izlaz'); setIsScanning(true);}} className="px-8 bg-theme-accent text-white font-black hover:opacity-80 transition-colors text-2xl flex items-center justify-center shadow-lg">📷</button>
                        </div>

                        <div className="mt-8 pt-6 border-t border-theme-border">
                            <label className="text-[10px] text-theme-muted uppercase font-black tracking-widest mb-3 block flex items-center gap-2">
                                📦 Započeti Paketi (Spremni za nastavak):
                            </label>
                            
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                {activeIzlazIds.length === 0 && <span className="text-xs text-theme-muted italic border border-dashed border-theme-border p-4 rounded-xl w-full text-center">Trenutno nema započetih paketa na ovoj mašini...</span>}
                                {activeIzlazIds.map(id => (
                                    <div key={id} className={`flex items-center rounded-xl border-2 transition-all shrink-0 shadow-md h-12 ${selectedIzlazId === id ? 'bg-theme-accent border-theme-accent font-black shadow-[0_0_15px_rgba(var(--theme-accent-rgb),0.5)] scale-105' : 'bg-theme-panel border-theme-border hover:border-theme-accent/50'}`}>
                                        <button onClick={() => {setSelectedIzlazId(id); fetchIzlaz(id);}} className={`px-5 py-2 font-black h-full flex items-center ${selectedIzlazId === id ? 'text-white' : 'text-theme-text'}`}>{id}</button>
                                        <button onClick={() => otkaziPaket(id)} className={`px-4 py-2 font-black h-full flex items-center border-l rounded-r-xl transition-colors ${selectedIzlazId === id ? 'border-white/20 text-white hover:bg-white/20' : 'border-theme-border text-red-400 hover:bg-red-500 hover:text-white'}`} title="Skloni sa ekrana">✕</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {selectedIzlazId && (
                        <div id="package-form-area" className="animate-in zoom-in-95 space-y-6 bg-theme-card p-6 rounded-[var(--radius-box)] border border-theme-accent/50 shadow-2xl backdrop-blur-[var(--glass-blur)]">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-theme-border pb-4">
                                <h3 className="text-theme-accent font-black uppercase text-sm drop-shadow-md flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-theme-accent animate-pulse"></span>
                                    Paket u radu (IZLAZ): <span className="text-theme-text text-xl">{selectedIzlazId}</span>
                                </h3>
                                <button onClick={() => zakljuciPaket(selectedIzlazId)} className="bg-red-600 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)] transition-all w-full sm:w-auto">
                                    🏁 Zaključi Paket
                                </button>
                            </div>

                            {activeEditItem && (
                                <div className="p-4 bg-theme-panel rounded-2xl border border-blue-500/50 shadow-inner">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-[10px] text-blue-400 uppercase font-black tracking-widest">Ažuriranje: {activeEditItem.naziv_proizvoda}</span>
                                        <button onClick={()=>setActiveEditItem(null)} className="text-red-500 text-[10px] font-black hover:underline uppercase bg-red-500/10 px-2 py-1 rounded">Poništi ×</button>
                                    </div>
                                    <div className="flex bg-theme-card p-1.5 rounded-xl border border-theme-border shadow-inner">
                                        <button onClick={() => setUpdateMode('dodaj')} className={`flex-1 py-3 rounded-lg text-[10px] uppercase font-black transition-all ${updateMode==='dodaj'?'bg-emerald-600 text-white shadow-md':'text-theme-muted hover:bg-theme-panel'}`}>+ Dodaj komade</button>
                                        <button onClick={() => setUpdateMode('oduzmi')} className={`flex-1 py-3 rounded-lg text-[10px] uppercase font-black transition-all ${updateMode==='oduzmi'?'bg-red-600 text-white shadow-md':'text-theme-muted hover:bg-theme-panel'}`}>- Oduzmi komade</button>
                                    </div>
                                </div>
                            )}
                            
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[9px] text-theme-muted uppercase ml-2 block mb-1 font-black tracking-widest">Novi Proizvod (Traži)</label>
                                        <div className="relative font-black w-full h-[50px]">
                                            <PD_SearchableProizvod katalog={katalog} value={form.naziv} onChange={v => setForm({...form, naziv: v})} onSelect={k => setForm({...form, naziv: k.naziv, debljina: k.visina, sirina: k.sirina, duzina: k.duzina, jm: 'kom'})} />
                                        </div>
                                    </div>
                                    <div className="flex gap-2 items-center pt-4">
                                        <DimBox label="Deb" val={form.debljina} set={v => setForm({...form, debljina: v})} disabled={!!activeEditItem} />
                                        <DimBox label="Šir" val={form.sirina} set={v => setForm({...form, sirina: v})} disabled={!!activeEditItem} />
                                        <DimBox label="Duž" val={form.duzina} set={v => setForm({...form, duzina: v})} disabled={!!activeEditItem} />
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 items-stretch mt-4">
                                    <div className="flex-1 relative">
                                        <label className="text-[9px] text-theme-muted uppercase ml-2 block mb-1 font-black tracking-widest">Količina</label>
                                        <input type="number" value={form.kolicina_ulaz} onKeyDown={e => {if(e.key==='Enter') save()}} onChange={e => setForm({...form, kolicina_ulaz: e.target.value})} className="w-full p-5 bg-theme-panel border-2 border-theme-accent/50 rounded-2xl text-2xl text-center text-theme-accent font-black focus:border-theme-accent transition-all placeholder:text-theme-accent/30 shadow-inner outline-none" placeholder="0" />
                                    </div>
                                    <div className="sm:w-32 relative">
                                        <label className="text-[9px] text-theme-muted uppercase ml-2 block mb-1 font-black tracking-widest">Jedinica</label>
                                        <select value={form.jm} onChange={e => setForm({...form, jm: e.target.value})} className="w-full h-[72px] bg-theme-panel rounded-2xl text-theme-text font-black outline-none border border-theme-border focus:border-theme-accent text-lg uppercase px-4 cursor-pointer shadow-inner">
                                            <option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option>
                                        </select>
                                    </div>
                                </div>

                                {dostupneOznake.length > 0 && (
                                    <div className="bg-theme-panel p-4 rounded-2xl border border-theme-border shadow-inner">
                                        <label className="text-[9px] text-theme-muted uppercase font-black ml-1 mb-3 block tracking-widest">Oznake / Dodatne operacije:</label>
                                        <div className="flex flex-wrap gap-2">
                                            {dostupneOznake.map(o => {
                                                const isSelected = odabraneOznake.includes(o);
                                                return (
                                                    <button key={o} onClick={() => toggleOznaka(o)} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all border ${isSelected ? 'bg-amber-600 border-amber-400 text-white shadow-[0_0_15px_rgba(217,119,6,0.4)] scale-105' : 'bg-theme-card border-theme-border text-theme-muted hover:border-theme-muted hover:text-theme-text'}`}>
                                                        {isSelected ? '✓ ' : '+ '} {o}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                <button onClick={save} className={`w-full py-6 mt-2 text-white font-black rounded-2xl uppercase shadow-[0_0_20px_rgba(var(--theme-accent-rgb),0.4)] hover:scale-[1.02] transition-all text-sm tracking-widest ${activeEditItem ? 'bg-blue-600 hover:bg-blue-500' : 'bg-theme-accent hover:opacity-90'}`}>
                                    {activeEditItem ? `✅ SAČUVAJ IZMJENE STAVKE` : `➕ DODAJ U NOVI PAKET`}
                                </button>
                            </div>
                            
                            <div className="pt-6 mt-6 border-t border-theme-border">
                                <label className="text-[10px] text-theme-muted uppercase font-black block mb-4 tracking-widest">Sadržaj trenutnog izlaznog paketa:</label>
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {izlazPackageItems.length === 0 && <div className="text-center p-8 border-2 border-dashed border-theme-border rounded-2xl text-theme-muted text-xs font-bold bg-theme-panel/50">Paket je prazan. Unesite prvu stavku.</div>}
                                    
                                    {izlazPackageItems.map(item => (
                                        <div key={item.id} onClick={() => { setActiveEditItem(item); setForm({...item, kolicina_ulaz: '' }); }} className="flex flex-col sm:flex-row justify-between sm:items-center p-5 bg-theme-panel border border-theme-border rounded-2xl cursor-pointer hover:border-theme-accent transition-all shadow-md group gap-4">
                                            <div className="flex-1">
                                                <div className="text-xs uppercase text-theme-text font-black group-hover:text-theme-accent transition-colors">{item.naziv_proizvoda}</div>
                                                <div className="text-theme-accent text-lg font-black tracking-tighter mt-1 drop-shadow-md">
                                                    {item.debljina}x{item.sirina}x{item.duzina} <span className="text-[10px] text-theme-muted ml-1">cm</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2 items-center mt-3">
                                                    {item.oznake && item.oznake.length > 0 && (<div className="flex gap-1">{item.oznake.map(o => <span key={o} className="text-[8px] bg-amber-500/20 text-amber-400 px-2 py-1 rounded uppercase font-black border border-amber-500/30">{o}</span>)}</div>)}
                                                </div>
                                            </div>
                                            <div className="flex flex-col sm:items-end gap-3 sm:border-l sm:border-theme-border sm:pl-5 w-full sm:w-auto">
                                                <div className="flex sm:flex-col justify-between sm:justify-start items-center sm:items-end w-full sm:w-auto">
                                                    <div className="text-3xl text-theme-text drop-shadow-lg font-black">{item.kolicina_final} <span className="text-theme-accent text-sm">m³</span></div>
                                                    <div className="text-[10px] text-theme-muted bg-theme-card px-3 py-1.5 rounded-lg mt-1 text-center border border-theme-border font-bold shadow-inner">{item.kolicina_ulaz} {item.jm}</div>
                                                </div>
                                                <div className="flex gap-2 w-full sm:w-auto justify-end">
                                                    <button onClick={(e) => obrisiStavkuIzPaketa(item, e)} className="flex-1 sm:flex-none bg-red-900/30 text-red-400 hover:bg-red-600 hover:text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase border border-red-500/30 transition-all shadow-lg sm:opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1">🗑️ Obriši</button>
                                                    <button onClick={(e) => { e.stopPropagation(); printDeklaracijaPaketa(item.paket_id, [item], ''); }} className="flex-1 sm:flex-none bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase border border-blue-500/30 transition-all shadow-lg sm:opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1">🖨️ Print</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <SaaS_DnevnikMasine 
                modul="Dorada" header={header} user={user} saas={saas} updatePolje={updatePolje} toggleVelicina={toggleVelicinaPolja} spremiDimenzije={spremiDimenzije} handleDragStart={handleDragStart} handleDragEnter={handleDragEnter} handleDrop={handleDrop}
            />
            
            {isScanning && <ScannerOverlay onScan={(text) => { if(scanTarget==='sirovina') handleSirovinaInput(text, true); else handleIzlazInput(text, true); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}"use client";
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import SmartSearchableInput from '../components/SmartSearchableInput';
import ScannerOverlay from '../components/ScannerOverlay';
import { printDeklaracijaPaketa, printFaznaDeklaracijaPaketa } from '../utils/printHelpers';
import { useSaaS } from '../utils/useSaaS';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function DimBox({ label, val, set, disabled }) {
    return (
        <div className={`bg-theme-panel p-3 rounded-xl border border-theme-border shadow-inner font-bold text-center flex flex-col items-center justify-center focus-within:border-theme-accent transition-colors ${disabled ? 'opacity-50' : ''}`}>
            <span className="text-[9px] text-theme-muted uppercase block mb-1 font-black tracking-widest">{label}</span>
            <input type="number" value={val} onChange={e => set(e.target.value)} disabled={disabled} className="w-full bg-transparent text-theme-text font-black outline-none text-xl text-center" placeholder="0" />
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
            <h3 className="text-theme-accent font-black uppercase text-xs tracking-widest">⚙️ Evidencija rada i zastoja mašine</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-theme-panel p-4 rounded-2xl border border-theme-border items-start shadow-inner">
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
                <button onClick={snimiZastojIliRad} className={`w-full py-4 bg-orange-600 text-white font-black rounded-xl text-[10px] uppercase shadow-lg hover:bg-orange-500 ${saas.isEditMode ? 'opacity-50 pointer-events-none col-span-4' : 'col-span-4 md:col-span-4 mt-2'}`}>➕ Dodaj Zapis u Dnevnik</button>
            </div>
            <div className="space-y-2 mt-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {logovi.length === 0 && <p className="text-center text-theme-muted text-[10px] uppercase p-4 border border-dashed border-theme-border rounded-xl">Nema unesenih zastoja za danas.</p>}
                {logovi.map(l => (
                    <div key={l.id} className="flex justify-between items-center p-4 bg-theme-card border border-theme-border rounded-xl shadow-sm">
                        <div>
                            <p className="text-[10px] text-theme-muted font-black uppercase tracking-widest"><span className="text-theme-accent">{l.vrijeme_od}</span> - {l.vrijeme_do ? <span className="text-amber-400">{l.vrijeme_do}</span> : <span className="text-theme-muted">...</span>}</p>
                            <p className="text-theme-text text-sm font-bold mt-1">{l.napomena || 'Nema napomene'}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            {l.zastoj_min > 0 && <span className="text-red-400 text-xs font-black bg-red-900/30 px-3 py-1 rounded border border-red-500/30 shadow-inner">Zastoj: {l.zastoj_min} min</span>}
                            <button onClick={() => obrisiLog(l.id)} className="text-red-500 font-black hover:bg-red-500/20 p-3 rounded-lg transition-colors">✕</button>
                        </div>
                    </div>
                ))}
            </div>
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
        document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside);
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
        <div ref={wrapperRef} className="relative font-black w-full h-[50px] overflow-visible">
            <input value={search} onFocus={() => setOpen(true)} onKeyDown={handleKeyDown} onChange={e => { setSearch(e.target.value); onChange(e.target.value); setOpen(true); }} placeholder="Pronađi proizvod ili UNESI SLOBODAN NAZIV..." className="w-full h-full p-4 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none focus:border-theme-accent uppercase shadow-inner" />
            {open && search && (
                <div className="absolute z-50 w-full mt-2 bg-theme-card border border-theme-border rounded-xl shadow-2xl max-h-60 overflow-y-auto text-left custom-scrollbar backdrop-blur-xl">
                    {filtered.map((k, index) => (
                        <div key={k.sifra} onClick={() => { onSelect(k); setSearch(k.naziv); onChange(k.naziv); setOpen(false); }} onMouseEnter={()=>setSelectedIndex(index)} className={`p-4 border-b border-theme-border cursor-pointer transition-colors ${index === selectedIndex ? 'bg-theme-accent text-white' : 'hover:bg-theme-panel text-theme-text'}`}>
                            <div className="text-xs font-black">{k.sifra} - {k.naziv}</div>
                            <div className="text-[10px] opacity-80 mt-1">Dim: {k.visina}x{k.sirina}x{k.duzina} | Baza: {k.default_jedinica}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function DoradaModule({ user, header, setHeader, onExit }) {
    const saas = useSaaS('dorada_modul', {
        boja_kartice: '#1e293b',
        naslov_skenera: 'SKENIRAJ ILI UPIŠI NOVI PAKET (IZLAZ)',
        polja_radnici: [
            { id: 'operater', label: '👨‍🔧 ODGOVORNI OPERATER', span: 'col-span-1' },
            { id: 'viljuskarista', label: '🚜 VILJUŠKARISTA', span: 'col-span-1' }
        ],
        polja_dnevnik: [
            { id: 'pocetak', label: 'POČETAK', span: 'col-span-1' },
            { id: 'kraj', label: 'ZAVRŠETAK', span: 'col-span-1' },
            { id: 'zastoj', label: 'ZASTOJ (MINUTA)', span: 'col-span-1' },
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

    const [izlazScan, setIzlazScan] = useState('');
    const [skenerSirovine, setSkenerSirovine] = useState('');
    const [sirovinaPaketi, setSirovinaPaketi] = useState([]);

    const [katalog, setKatalog] = useState([]);
    const [aktivniNalozi, setAktivniNalozi] = useState([]); 
    const [rnStavke, setRnStavke] = useState([]); 
    const [radniNalog, setRadniNalog] = useState(''); 

    const [activeIzlazIds, setActiveIzlazIds] = useState([]);
    const [selectedIzlazId, setSelectedIzlazId] = useState('');
    const [izlazPackageItems, setIzlazPackageItems] = useState([]);
    const [activeEditItem, setActiveEditItem] = useState(null);
    const [updateMode, setUpdateMode] = useState('dodaj');

    const [operater, setOperater] = useState('');
    const [viljuskarista, setViljuskarista] = useState('');
    const [radniciList, setRadniciList] = useState([]);

    const [form, setForm] = useState({ naziv: '', debljina: '', sirina: '', duzina: '', kolicina_ulaz: '', jm: 'kom', rn_stavka_id: null });
    const [isScanning, setIsScanning] = useState(false);
    const [scanTarget, setScanTarget] = useState('');
    const [dostupneOznake, setDostupneOznake] = useState([]); 
    const [odabraneOznake, setOdabraneOznake] = useState([]);
    const timerRef = useRef(null);

    useEffect(() => {
        supabase.from('radnici').select('ime_prezime').then(({data}) => setRadniciList(data ? data.map(r=>r.ime_prezime) : []));
        supabase.from('katalog_proizvoda').select('*').then(({data}) => setKatalog(data || []));
        ucitajSveZapoocetePakete();
    }, [header?.masina]);

    const ucitajSveZapoocetePakete = async () => {
        if (!header?.masina) return;
        const { data } = await supabase.from('paketi').select('paket_id').is('closed_at', null).eq('masina', header.masina);
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

        const ucitajDezurneRadnike = async () => {
            if (!header?.masina) return;
            const { data } = await supabase.from('aktivni_radnici')
                .select('radnik_ime, uloga')
                .eq('masina_naziv', header.masina)
                .is('vrijeme_odjave', null);
                
            if (data) {
                const o = data.find(r => r.uloga === 'operater_dorada');
                const v = data.find(r => r.uloga === 'viljuskarista_dorada');
                
                if (o) setOperater(o.radnik_ime); else setOperater('');
                if (v) setViljuskarista(v.radnik_ime); else setViljuskarista('');
            } else {
                setOperater(''); setViljuskarista('');
            }
        };
        ucitajDezurneRadnike();
    }, [header?.masina]);

    const handleOperaterChange = async (novoIme) => {
        if (header?.masina) {
            await supabase.from('aktivni_radnici')
                .update({ vrijeme_odjave: new Date().toISOString() })
                .eq('masina_naziv', header.masina)
                .eq('uloga', 'operater_dorada')
                .is('vrijeme_odjave', null);

            if (novoIme) {
                await supabase.from('aktivni_radnici').insert([{ radnik_ime: novoIme, masina_naziv: header.masina, vrijeme_prijave: new Date().toISOString(), uloga: 'operater_dorada' }]);
            }
            window.dispatchEvent(new Event('radnici_updated')); 
        }
        setOperater(novoIme);
    };

    const handleViljuskaristaChange = async (novoIme) => {
        if (header?.masina) {
            await supabase.from('aktivni_radnici')
                .update({ vrijeme_odjave: new Date().toISOString() })
                .eq('masina_naziv', header.masina)
                .eq('uloga', 'viljuskarista_dorada')
                .is('vrijeme_odjave', null);

            if (novoIme) {
                await supabase.from('aktivni_radnici').insert([{ radnik_ime: novoIme, masina_naziv: header.masina, vrijeme_prijave: new Date().toISOString(), uloga: 'viljuskarista_dorada' }]);
            }
            window.dispatchEvent(new Event('radnici_updated')); 
        }
        setViljuskarista(novoIme);
    };

    const ucitajNalogIzSirovine = async (brojVeze) => {
        if (!brojVeze) { setRadniNalog(''); setRnStavke([]); return; }
        
        setRadniNalog(brojVeze);
        const {data} = await supabase.from('radni_nalozi').select('*').eq('id', brojVeze.toUpperCase()).maybeSingle();
        
        if (data) {
            const ucitaneStavke = data.stavke_jsonb || [];
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
                
                setRnStavke(mapiraneStavke);
            } else { setRnStavke([]); }
        }
    };

    const processSirovina = async (val) => {
        const id = val.toUpperCase().trim();
        if(!id) return;
        const { data } = await supabase.from('paketi').select('*').eq('paket_id', id);
        if(data && data.length > 0) {
            if(!sirovinaPaketi.find(p => p.paket_id === id)) {
                setSirovinaPaketi(prev => [...prev, ...data]);
                if(data[0].broj_veze) {
                    ucitajNalogIzSirovine(data[0].broj_veze);
                }
            }
        } else {
            alert(`Paket ${id} ne postoji u bazi!`);
        }
        setSkenerSirovine('');
    };

    const handleSirovinaInput = (val, isEnter = false) => {
        setSkenerSirovine(val);
        if(timerRef.current) clearTimeout(timerRef.current);
        if(!val) return;
        if(isEnter) processSirovina(val);
        else timerRef.current = setTimeout(() => processSirovina(val), 2000);
    };

    const ukloniSirovinu = (paketId) => {
        const noviPaketi = sirovinaPaketi.filter(p => p.paket_id !== paketId);
        setSirovinaPaketi(noviPaketi);
        if(noviPaketi.length === 0) {
            setRadniNalog('');
            setRnStavke([]);
        }
    };

    const fetchIzlaz = async (pid) => { 
        const { data } = await supabase.from('paketi').select('*').eq('paket_id', pid); 
        setIzlazPackageItems(data || []); 
    };

    const processIzlaz = async (val) => {
        const id = val.toUpperCase().trim();
        if (!activeIzlazIds.includes(id)) {
            const { data: existing } = await supabase.from('paketi').select('*').eq('paket_id', id);
            if (existing && existing.length > 0) {
                const spisak = existing.map(i => `- ${i.naziv_proizvoda}: ${i.kolicina_final} ${i.jm}`).join('\n');
                if (!window.confirm(`📦 PAKET JE PRONAĐEN U BAZI: ${id}\n\nTrenutno sadrži:\n${spisak}\n\nŽelite li nastaviti rad na ovom paketu?`)) { 
                    setIzlazScan(''); return; 
                }
            }
            setActiveIzlazIds(p => [...p, id]);
        }
        setSelectedIzlazId(id); fetchIzlaz(id); setIzlazScan('');
    };

    const handleIzlazInput = (val, isEnter = false) => {
        setIzlazScan(val);
        if(timerRef.current) clearTimeout(timerRef.current);
        if(!val) return;
        if (isEnter) processIzlaz(val);
        else timerRef.current = setTimeout(() => processIzlaz(val), 2000);
    };

    const toggleOznaka = (o) => { setOdabraneOznake(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o]); };

    const save = async () => {
        if (!operater) return alert("⚠️ ZABRANJENO: Molimo odaberite Operatera na mašini (Lijeva kolona) prije snimanja paketa!");
        if (!selectedIzlazId) return alert("Prvo skenirajte ili unesite ID za NOVI IZLAZNI PAKET!");
        if (sirovinaPaketi.length === 0) return alert("Morate unijeti barem jedan paket ulazne sirovine!");
        if (!form.kolicina_ulaz) return alert("⚠️ Unesite količinu novog proizvoda!");

        const v = parseFloat(form.debljina) || 1; const s = parseFloat(form.sirina) || 1; const d = parseFloat(form.duzina) || 1;
        const unosKol = parseFloat(form.kolicina_ulaz);
        let komada = unosKol;
        if (form.jm === 'm3') komada = unosKol / ((v/100) * (s/100) * (d/100));
        else if (form.jm === 'm2') komada = unosKol / ((s/100) * (d/100));
        else if (form.jm === 'm1') komada = unosKol / (d/100);
        const qtyZaPaket = parseFloat((komada * (v/100) * (s/100) * (d/100)).toFixed(3));

        const timeNowFull = new Date().toISOString();
        const timeNow = new Date().toLocaleTimeString('de-DE');

        const { data: aktuelniRadnici } = await supabase.from('aktivni_radnici').select('radnik_ime').eq('masina_naziv', header.masina).is('vrijeme_odjave', null);
        const radniciIzDorade = aktuelniRadnici ? aktuelniRadnici.map(r => r.radnik_ime).join(', ') : '';

        const sirovineIdsText = [...new Set(sirovinaPaketi.map(p => p.paket_id))].join(', ');
        const vezniNalog = sirovinaPaketi.length > 0 ? sirovinaPaketi[0].broj_veze : null;

        let isNusProizvod = false;
        let currentRnStavka = null;

        if (form.rn_stavka_id) {
            currentRnStavka = rnStavke.find(rs => rs.id === form.rn_stavka_id);
            if (currentRnStavka && currentRnStavka.naziv_proizvoda !== form.naziv) {
                isNusProizvod = true;
            }
        } else if (vezniNalog) {
            isNusProizvod = true; 
        }

        if (currentRnStavka && !isNusProizvod && !activeEditItem) {
            const vecNapravljeno = parseFloat(currentRnStavka.napravljeno) || 0;
            const naruceno = parseFloat(currentRnStavka.naruceno) || 0;
            let kolikoSadPravimo = komada;
            if (currentRnStavka.jm === 'm3') kolikoSadPravimo = qtyZaPaket;
            else if (currentRnStavka.jm === 'm2') kolikoSadPravimo = komada * (s/100) * (d/100);
            else if (currentRnStavka.jm === 'm1') kolikoSadPravimo = komada * (d/100);

            if ((vecNapravljeno + kolikoSadPravimo) > naruceno) {
                const preostalo = naruceno - vecNapravljeno;
                if (!window.confirm(`⚠️ UPOZORENJE: PRELAZITE NORMU!\n\nZa ovaj Radni Nalog je preostalo samo: ${preostalo.toFixed(3)} ${currentRnStavka.jm}.\nVi pokušavate dodati: ${kolikoSadPravimo.toFixed(3)} ${currentRnStavka.jm}.\n\nDa li ste sigurni da želite napraviti ovaj višak? (Samo uz odobrenje šefa)`)) {
                    return; 
                }
            }
        }

        if (activeEditItem) {
            const newM3 = updateMode === 'dodaj' ? parseFloat(activeEditItem.kolicina_final) + qtyZaPaket : parseFloat(activeEditItem.kolicina_final) - qtyZaPaket;
            const { error } = await supabase.from('paketi').update({ 
                kolicina_final: parseFloat(newM3.toFixed(3)), vrijeme_tekst: timeNow, snimio_korisnik: user?.ime_prezime,
                brentista: operater, viljuskarista: viljuskarista, radnici_pilana: radniciIzDorade, 
                oznake: odabraneOznake.length > 0 ? odabraneOznake : activeEditItem.oznake,
                broj_veze: vezniNalog, ai_sirovina_ids: sirovineIdsText 
            }).eq('id', activeEditItem.id);
            if (error) return alert("❌ GREŠKA PRI AŽURIRANJU: " + error.message);
        } else {
            const payload = {
                paket_id: selectedIzlazId, naziv_proizvoda: form.naziv, debljina: v, sirina: s, duzina: d,
                kolicina_ulaz: form.kolicina_ulaz, jm: form.jm, kolicina_final: qtyZaPaket, mjesto: header.mjesto, masina: header.masina,
                snimio_korisnik: user?.ime_prezime, brentista: operater, viljuskarista: viljuskarista, radnici_pilana: radniciIzDorade, 
                ai_sirovina_ids: sirovineIdsText, broj_veze: vezniNalog, vrijeme_tekst: timeNow, datum_yyyy_mm: header.datum, oznake: odabraneOznake
            };
            const { error } = await supabase.from('paketi').insert([payload]);
            if (error) return alert("Greška: " + error.message);

            if(currentRnStavka && !isNusProizvod) {
                const rn_jm = form.rn_jm || 'm3';
                let napravljenoZaRN = komada;
                if (rn_jm === 'm3') napravljenoZaRN = komada * (v/100) * (s/100) * (d/100);
                else if (rn_jm === 'm2') napravljenoZaRN = komada * (s/100) * (d/100);
                else if (rn_jm === 'm1') napravljenoZaRN = komada * (d/100);

                const {data: rn} = await supabase.from('radni_nalozi').select('stavke_jsonb, tip_naloga').eq('id', vezniNalog.toUpperCase()).maybeSingle();
                if (rn && rn.stavke_jsonb) {
                    const isFazni = rn.tip_naloga === 'FAZNI';
                    const azurirane = rn.stavke_jsonb.map(st => {
                        if (st.id === form.rn_stavka_id) {
                            if (isFazni) {
                                const trenutnoFaza = parseFloat(st.napravljeno_po_fazama?.[header.masina] || 0);
                                return { ...st, napravljeno_po_fazama: { ...(st.napravljeno_po_fazama || {}), [header.masina]: parseFloat((trenutnoFaza + napravljenoZaRN).toFixed(4)) } };
                            } else {
                                const nova = (parseFloat(st.napravljeno) || 0) + napravljenoZaRN;
                                return { ...st, napravljeno: parseFloat(nova.toFixed(4)) };
                            }
                        }
                        return st;
                    });
                    await supabase.from('radni_nalozi').update({ stavke_jsonb: azurirane }).eq('id', vezniNalog.toUpperCase());
                }
                ucitajNalogIzSirovine(vezniNalog);
                setForm(f => ({ ...f, napravljeno: (parseFloat(f.napravljeno) + napravljenoZaRN).toFixed(4) }));
            }
        }
        fetchIzlaz(selectedIzlazId); setForm(f => ({...f, kolicina_ulaz: ''})); setOdabraneOznake([]); setActiveEditItem(null);
    };

    const obrisiStavkuIzPaketa = async (item, e) => {
        e.stopPropagation();
        if(!window.confirm(`Da li ste sigurni da želite OBRISATI stavku iz ovog paketa?`)) return;
        await supabase.from('paketi').delete().eq('id', item.id);
        fetchIzlaz(selectedIzlazId);
    };

    const zakljuciPaket = async (pid) => {
        if(izlazPackageItems.length === 0) {
            setActiveIzlazIds(p => p.filter(x => x !== pid));
            if (selectedIzlazId === pid) setSelectedIzlazId('');
            alert(`Prazan paket ${pid} je zatvoren i oslobođen.`); return;
        }
        if (window.confirm(`ZAKLJUČITI paket ${pid}?`)) {
            await supabase.from('paketi').update({ closed_at: new Date().toISOString() }).eq('paket_id', pid);
            if (window.confirm(`📦 Paket uspješno zaključen!\n\nŽelite li odmah isprintati A5 deklaraciju za ovaj paket?`)) {
                printDeklaracijaPaketa(pid, izlazPackageItems, sirovinaPaketi.length > 0 ? sirovinaPaketi[0].broj_veze : '');
            }
            setActiveIzlazIds(p => p.filter(x => x !== pid));
            if (selectedIzlazId === pid) { setSelectedIzlazId(''); setIzlazPackageItems([]); }
            
            setSirovinaPaketi([]);
            setRadniNalog('');
            setRnStavke([]);
        }
    };

    const otkaziPaket = (pid) => {
        if(window.confirm(`Ukloniti paket ${pid} sa ekrana? (Ostat će u bazi kao Započet)`)) {
            setActiveIzlazIds(p => p.filter(x => x !== pid));
            if(selectedIzlazId === pid) { setSelectedIzlazId(''); setIzlazPackageItems([]); }
        }
    };

    const handleStavkaNalogaKlik = (stavka) => {
        if(!selectedIzlazId) return alert("⚠️ UPOZORENJE:\n\nPrvo desno skenirajte ili upišite ime novog PAKETA (Izlaz) u koji ćete slagati ovu robu!");
        
        let deb = '', sir = '', duz = '';
        if (stavka.isFazni && stavka.dimenzije && stavka.dimenzije !== 'Nema u katalogu') {
            const parts = stavka.dimenzije.split(/x|\*/i); 
            if (parts.length >= 3) { deb = parts[0].trim(); sir = parts[1].trim(); duz = parts[2].trim(); }
        } else {
            const kat = katalog.find(k => k.sifra === stavka.sifra_proizvoda);
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

        const formElement = document.getElementById('package-form-area');
        if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });
    };

    const renderRadnikPolje = (polje) => {
        if (polje.id === 'operater') return <div className="h-full w-full min-w-0 bg-transparent text-theme-text font-black text-sm uppercase px-2 py-1 outline-none focus-within:border-theme-accent overflow-visible"><SmartSearchableInput value={operater} onChange={handleOperaterChange} list={radniciList} /></div>;
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
            
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} user={user} modulIme="dorada" saas={saas} />
            
            <div className="text-center mb-6">
                <h2 className="text-theme-accent font-black tracking-widest uppercase text-xl md:text-2xl drop-shadow-md flex items-center justify-center gap-3">
                    🛠️ DORADA (PRERADA DASKE)
                </h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                <div className="lg:col-span-5 space-y-6">
                    
                    <div className="p-6 rounded-[var(--radius-box)] shadow-2xl transition-all border border-theme-border bg-theme-card backdrop-blur-[var(--glass-blur)]">
                        <h3 className="text-[10px] text-theme-muted uppercase font-black tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-theme-accent"></span> Ekipa na mašini
                        </h3>
                        <div className="space-y-4">
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

                    <div className="p-6 rounded-[var(--radius-box)] shadow-2xl border border-theme-border bg-theme-card backdrop-blur-[var(--glass-blur)]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-[10px] text-amber-500 uppercase font-black tracking-widest flex items-center gap-2">
                                🪵 Ulazni Paketi (Sirovina)
                            </h3>
                            {sirovinaPaketi.length > 0 && (
                                <button onClick={() => { setSirovinaPaketi([]); setRadniNalog(''); setRnStavke([]); }} className="text-[9px] text-red-400 hover:text-red-300 uppercase bg-red-900/20 px-2 py-1 rounded border border-red-500/30 transition-all font-black">
                                    ✕ Ukloni Sve
                                </button>
                            )}
                        </div>
                        
                        <div className="flex w-full bg-theme-panel border border-amber-500/50 rounded-xl overflow-hidden focus-within:border-amber-400 transition-all shadow-inner h-14">
                             <input value={skenerSirovine} onChange={e => handleSirovinaInput(e.target.value)} onKeyDown={e => {if(e.key === 'Enter') handleSirovinaInput(skenerSirovine, true)}} placeholder="Skeniraj ili upiši paket..." className="flex-1 px-4 bg-transparent text-sm text-theme-text outline-none uppercase font-black placeholder:text-theme-muted/50" />
                             <button onClick={() => {setScanTarget('sirovina'); setIsScanning(true);}} className="px-6 bg-amber-500/20 text-amber-500 border-l border-amber-500/30 hover:bg-amber-500 hover:text-white transition-all font-black">📷</button>
                        </div>

                        {sirovinaPaketi.length > 0 && (
                            <div className="mt-4 space-y-2 border-t border-theme-border pt-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                {sirovinaPaketi.map((p, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-theme-panel rounded-xl border border-theme-border shadow-md">
                                        <div>
                                            <div className="text-xs text-amber-500 font-black">{p.paket_id}</div>
                                            <div className="text-[10px] text-theme-muted font-bold">{p.naziv_proizvoda} ({p.debljina}x{p.sirina}x{p.duzina})</div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-black text-theme-text">{p.kolicina_final} <span className="text-xs text-theme-muted">m³</span></span>
                                            <button onClick={() => ukloniSirovinu(p.paket_id)} className="text-red-400 hover:text-red-300 font-black text-lg ml-2">×</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {rnStavke.length > 0 && (
                            <div className="mt-4 border-t border-theme-border pt-4">
                                <span className="text-[10px] text-theme-accent uppercase font-black mb-2 block tracking-widest flex justify-between items-center">
                                    <span>Zadaci (RN: {radniNalog})</span>
                                </span>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {rnStavke.map(s => {
                                        const preostalo = s.naruceno - s.napravljeno;
                                        return (
                                        <div key={s.id} onClick={() => handleStavkaNalogaKlik(s)} className="flex flex-col p-4 bg-theme-panel rounded-xl cursor-pointer hover:border-theme-accent transition-all border border-theme-border shadow-md group">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="text-xs text-theme-text font-black group-hover:text-theme-accent transition-colors">{s.sifra_proizvoda} - {s.naziv_proizvoda}</div>
                                                    <div className="text-[10px] text-theme-muted mt-1 font-bold">
                                                        {s.isFazni ? <span className="text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 mr-2">FAZA: {header.masina}</span> : ''}
                                                        {s.isFazni ? `Cilj:` : `Dimenzije:`} {s.dimenzije}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] text-theme-muted font-black">Naručeno: <span className="text-theme-text">{s.naruceno} {s.jm}</span></div>
                                                    <div className={`text-xs font-black mt-1 ${preostalo > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>Falilo: {preostalo > 0 ? preostalo : 'GOTOVO ✅'}</div>
                                                </div>
                                            </div>
                                            
                                            {s.skica_url && (
                                                <div className="mt-3 pt-2 border-t border-theme-border">
                                                    <button onClick={(e) => { e.stopPropagation(); window.open(s.skica_url, '_blank'); }} className="text-[9px] bg-theme-accent/20 text-theme-accent px-3 py-1.5 rounded-lg border border-theme-accent/30 flex items-center gap-2 hover:bg-theme-accent hover:text-white transition-colors font-black uppercase tracking-widest w-fit">
                                                        📎 Prikaz Skice / PDF-a
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )})}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-7 space-y-6">
                    
                    <div className={`p-8 rounded-[var(--radius-box)] shadow-[0_0_40px_rgba(0,0,0,0.3)] border bg-theme-card backdrop-blur-[var(--glass-blur)] relative overflow-hidden group ${saas.isEditMode ? 'border-dashed border-amber-500' : 'border-theme-accent/40'}`}>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-theme-accent to-transparent opacity-50"></div>
                        
                        <label className={`text-xs uppercase text-theme-accent block mb-4 font-black tracking-widest text-center`}>
                            {saas.ui.naslov_skenera || "SKENIRAJ ILI UPIŠI NOVI PAKET (IZLAZ)"}
                        </label>
                        
                        <div className={`flex bg-theme-panel border-2 rounded-2xl overflow-hidden shadow-inner focus-within:shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] transition-all h-20 ${saas.isEditMode ? 'border-amber-500/50 opacity-50 pointer-events-none' : 'border-theme-accent/50 focus-within:border-theme-accent'}`}>
                            <input value={izlazScan} onChange={e => handleIzlazInput(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') handleIzlazInput(izlazScan, true) }} className="flex-1 px-6 bg-transparent text-xl md:text-2xl text-center text-theme-text outline-none uppercase font-black placeholder:text-theme-muted/30 tracking-widest" placeholder="ČEKAM SKEN NOVI PAKET..." />
                            <button onClick={() => {setScanTarget('izlaz'); setIsScanning(true);}} className="px-8 bg-theme-accent text-white font-black hover:opacity-80 transition-colors text-2xl flex items-center justify-center shadow-lg">📷</button>
                        </div>

                        <div className="mt-8 pt-6 border-t border-theme-border">
                            <label className="text-[10px] text-theme-muted uppercase font-black tracking-widest mb-3 block flex items-center gap-2">
                                📦 Započeti Paketi (Spremni za nastavak):
                            </label>
                            
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                {activeIzlazIds.length === 0 && <span className="text-xs text-theme-muted italic border border-dashed border-theme-border p-4 rounded-xl w-full text-center">Trenutno nema započetih paketa na ovoj mašini...</span>}
                                {activeIzlazIds.map(id => (
                                    <div key={id} className={`flex items-center rounded-xl border-2 transition-all shrink-0 shadow-md h-12 ${selectedIzlazId === id ? 'bg-theme-accent border-theme-accent font-black shadow-[0_0_15px_rgba(var(--theme-accent-rgb),0.5)] scale-105' : 'bg-theme-panel border-theme-border hover:border-theme-accent/50'}`}>
                                        <button onClick={() => {setSelectedIzlazId(id); fetchIzlaz(id);}} className={`px-5 py-2 font-black h-full flex items-center ${selectedIzlazId === id ? 'text-white' : 'text-theme-text'}`}>{id}</button>
                                        <button onClick={() => otkaziPaket(id)} className={`px-4 py-2 font-black h-full flex items-center border-l rounded-r-xl transition-colors ${selectedIzlazId === id ? 'border-white/20 text-white hover:bg-white/20' : 'border-theme-border text-red-400 hover:bg-red-500 hover:text-white'}`} title="Skloni sa ekrana">✕</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {selectedIzlazId && (
                        <div id="package-form-area" className="animate-in zoom-in-95 space-y-6 bg-theme-card p-6 rounded-[var(--radius-box)] border border-theme-accent/50 shadow-2xl backdrop-blur-[var(--glass-blur)]">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-theme-border pb-4">
                                <h3 className="text-theme-accent font-black uppercase text-sm drop-shadow-md flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-theme-accent animate-pulse"></span>
                                    Paket u radu (IZLAZ): <span className="text-theme-text text-xl">{selectedIzlazId}</span>
                                </h3>
                                <button onClick={() => zakljuciPaket(selectedIzlazId)} className="bg-red-600 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)] transition-all w-full sm:w-auto">
                                    🏁 Zaključi Paket
                                </button>
                            </div>

                            {activeEditItem && (
                                <div className="p-4 bg-theme-panel rounded-2xl border border-blue-500/50 shadow-inner">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-[10px] text-blue-400 uppercase font-black tracking-widest">Ažuriranje: {activeEditItem.naziv_proizvoda}</span>
                                        <button onClick={()=>setActiveEditItem(null)} className="text-red-500 text-[10px] font-black hover:underline uppercase bg-red-500/10 px-2 py-1 rounded">Poništi ×</button>
                                    </div>
                                    <div className="flex bg-theme-card p-1.5 rounded-xl border border-theme-border shadow-inner">
                                        <button onClick={() => setUpdateMode('dodaj')} className={`flex-1 py-3 rounded-lg text-[10px] uppercase font-black transition-all ${updateMode==='dodaj'?'bg-emerald-600 text-white shadow-md':'text-theme-muted hover:bg-theme-panel'}`}>+ Dodaj komade</button>
                                        <button onClick={() => setUpdateMode('oduzmi')} className={`flex-1 py-3 rounded-lg text-[10px] uppercase font-black transition-all ${updateMode==='oduzmi'?'bg-red-600 text-white shadow-md':'text-theme-muted hover:bg-theme-panel'}`}>- Oduzmi komade</button>
                                    </div>
                                </div>
                            )}
                            
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[9px] text-theme-muted uppercase ml-2 block mb-1 font-black tracking-widest">Novi Proizvod (Traži)</label>
                                        <div className="relative font-black w-full h-[50px]">
                                            <PD_SearchableProizvod katalog={katalog} value={form.naziv} onChange={v => setForm({...form, naziv: v})} onSelect={k => setForm({...form, naziv: k.naziv, debljina: k.visina, sirina: k.sirina, duzina: k.duzina, jm: 'kom'})} />
                                        </div>
                                    </div>
                                    <div className="flex gap-2 items-center pt-4">
                                        <DimBox label="Deb" val={form.debljina} set={v => setForm({...form, debljina: v})} disabled={!!activeEditItem} />
                                        <DimBox label="Šir" val={form.sirina} set={v => setForm({...form, sirina: v})} disabled={!!activeEditItem} />
                                        <DimBox label="Duž" val={form.duzina} set={v => setForm({...form, duzina: v})} disabled={!!activeEditItem} />
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 items-stretch mt-4">
                                    <div className="flex-1 relative">
                                        <label className="text-[9px] text-theme-muted uppercase ml-2 block mb-1 font-black tracking-widest">Količina</label>
                                        <input type="number" value={form.kolicina_ulaz} onKeyDown={e => {if(e.key==='Enter') save()}} onChange={e => setForm({...form, kolicina_ulaz: e.target.value})} className="w-full p-5 bg-theme-panel border-2 border-theme-accent/50 rounded-2xl text-2xl text-center text-theme-accent font-black focus:border-theme-accent transition-all placeholder:text-theme-accent/30 shadow-inner outline-none" placeholder="0" />
                                    </div>
                                    <div className="sm:w-32 relative">
                                        <label className="text-[9px] text-theme-muted uppercase ml-2 block mb-1 font-black tracking-widest">Jedinica</label>
                                        <select value={form.jm} onChange={e => setForm({...form, jm: e.target.value})} className="w-full h-[72px] bg-theme-panel rounded-2xl text-theme-text font-black outline-none border border-theme-border focus:border-theme-accent text-lg uppercase px-4 cursor-pointer shadow-inner">
                                            <option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option>
                                        </select>
                                    </div>
                                </div>

                                {dostupneOznake.length > 0 && (
                                    <div className="bg-theme-panel p-4 rounded-2xl border border-theme-border shadow-inner">
                                        <label className="text-[9px] text-theme-muted uppercase font-black ml-1 mb-3 block tracking-widest">Oznake / Dodatne operacije:</label>
                                        <div className="flex flex-wrap gap-2">
                                            {dostupneOznake.map(o => {
                                                const isSelected = odabraneOznake.includes(o);
                                                return (
                                                    <button key={o} onClick={() => toggleOznaka(o)} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all border ${isSelected ? 'bg-amber-600 border-amber-400 text-white shadow-[0_0_15px_rgba(217,119,6,0.4)] scale-105' : 'bg-theme-card border-theme-border text-theme-muted hover:border-theme-muted hover:text-theme-text'}`}>
                                                        {isSelected ? '✓ ' : '+ '} {o}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                <button onClick={save} className={`w-full py-6 mt-2 text-white font-black rounded-2xl uppercase shadow-[0_0_20px_rgba(var(--theme-accent-rgb),0.4)] hover:scale-[1.02] transition-all text-sm tracking-widest ${activeEditItem ? 'bg-blue-600 hover:bg-blue-500' : 'bg-theme-accent hover:opacity-90'}`}>
                                    {activeEditItem ? `✅ SAČUVAJ IZMJENE STAVKE` : `➕ DODAJ U NOVI PAKET`}
                                </button>
                            </div>
                            
                            <div className="pt-6 mt-6 border-t border-theme-border">
                                <label className="text-[10px] text-theme-muted uppercase font-black block mb-4 tracking-widest">Sadržaj trenutnog izlaznog paketa:</label>
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {izlazPackageItems.length === 0 && <div className="text-center p-8 border-2 border-dashed border-theme-border rounded-2xl text-theme-muted text-xs font-bold bg-theme-panel/50">Paket je prazan. Unesite prvu stavku.</div>}
                                    
                                    {izlazPackageItems.map(item => (
                                        <div key={item.id} onClick={() => { setActiveEditItem(item); setForm({...item, kolicina_ulaz: '' }); }} className="flex flex-col sm:flex-row justify-between sm:items-center p-5 bg-theme-panel border border-theme-border rounded-2xl cursor-pointer hover:border-theme-accent transition-all shadow-md group gap-4">
                                            <div className="flex-1">
                                                <div className="text-xs uppercase text-theme-text font-black group-hover:text-theme-accent transition-colors">{item.naziv_proizvoda}</div>
                                                <div className="text-theme-accent text-lg font-black tracking-tighter mt-1 drop-shadow-md">
                                                    {item.debljina}x{item.sirina}x{item.duzina} <span className="text-[10px] text-theme-muted ml-1">cm</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2 items-center mt-3">
                                                    {item.oznake && item.oznake.length > 0 && (<div className="flex gap-1">{item.oznake.map(o => <span key={o} className="text-[8px] bg-amber-500/20 text-amber-400 px-2 py-1 rounded uppercase font-black border border-amber-500/30">{o}</span>)}</div>)}
                                                </div>
                                            </div>
                                            <div className="flex flex-col sm:items-end gap-3 sm:border-l sm:border-theme-border sm:pl-5 w-full sm:w-auto">
                                                <div className="flex sm:flex-col justify-between sm:justify-start items-center sm:items-end w-full sm:w-auto">
                                                    <div className="text-3xl text-theme-text drop-shadow-lg font-black">{item.kolicina_final} <span className="text-theme-accent text-sm">m³</span></div>
                                                    <div className="text-[10px] text-theme-muted bg-theme-card px-3 py-1.5 rounded-lg mt-1 text-center border border-theme-border font-bold shadow-inner">{item.kolicina_ulaz} {item.jm}</div>
                                                </div>
                                                <div className="flex gap-2 w-full sm:w-auto justify-end">
                                                    <button onClick={(e) => obrisiStavkuIzPaketa(item, e)} className="flex-1 sm:flex-none bg-red-900/30 text-red-400 hover:bg-red-600 hover:text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase border border-red-500/30 transition-all shadow-lg sm:opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1">🗑️ Obriši</button>
                                                    <button onClick={(e) => { e.stopPropagation(); printDeklaracijaPaketa(item.paket_id, [item], ''); }} className="flex-1 sm:flex-none bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase border border-blue-500/30 transition-all shadow-lg sm:opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1">🖨️ Print</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <SaaS_DnevnikMasine 
                modul="Dorada" header={header} user={user} saas={saas} updatePolje={updatePolje} toggleVelicina={toggleVelicinaPolja} spremiDimenzije={spremiDimenzije} handleDragStart={handleDragStart} handleDragEnter={handleDragEnter} handleDrop={handleDrop}
            />
            
            {isScanning && <ScannerOverlay onScan={(text) => { if(scanTarget==='sirovina') handleSirovinaInput(text, true); else handleIzlazInput(text, true); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}