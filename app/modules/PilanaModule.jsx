"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import SearchableInput from '../components/SearchableInput';
import ScannerOverlay from '../components/ScannerOverlay';
import DnevnikMasine from '../components/DnevnikMasine';
import { printDeklaracijaPaketa } from '../utils/printHelpers';

const supabase = createClient('https://awaxwejrhmjeqohrgidm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY');

// Lokalne komponente samo za Pilanu (kasnije ih možemo izvući ako zatrebaju drugdje)
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
        <div className="relative font-black w-full">
            <input value={search} onFocus={() => setOpen(true)} onChange={e => { setSearch(e.target.value); setOpen(true); }} onKeyDown={e => { if(e.key === 'Enter' && search) { onSelect(search); setOpen(false); } }} placeholder="Upiši nalog ili skeniraj..." className="w-full p-4 pr-16 bg-slate-900 rounded-xl text-center text-white outline-none focus:border-blue-500 uppercase shadow-inner" />
            <button onClick={onScanClick} className="absolute right-2 top-2 bottom-2 px-4 bg-blue-600 rounded-xl text-white font-black hover:bg-blue-500 shadow-lg transition-all">📷</button>
            {open && search && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto text-left">
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

export default function PilanaModule({ user, header, setHeader, onExit }) {
    const [izlazScan, setIzlazScan] = useState('');
    const [radniNalog, setRadniNalog] = useState('');
    const [rnStavke, setRnStavke] = useState([]);
    const [katalog, setKatalog] = useState([]);
    const [aktivniNalozi, setAktivniNalozi] = useState([]);
    const [activeIzlazIds, setActiveIzlazIds] = useState([]);
    const [selectedIzlazId, setSelectedIzlazId] = useState('');
    const [izlazPackageItems, setIzlazPackageItems] = useState([]);
    const [activeEditItem, setActiveEditItem] = useState(null);
    const [updateMode, setUpdateMode] = useState('dodaj');

    const [brentista, setBrentista] = useState(typeof window !== 'undefined' ? localStorage.getItem('shared_brentista') || '' : '');
    const [viljuskarista, setViljuskarista] = useState(typeof window !== 'undefined' ? localStorage.getItem('shared_viljuskarista') || '' : '');
    const [radniciList, setRadniciList] = useState([]);

    const handleBrentistaChange = (v) => { setBrentista(v); localStorage.setItem('shared_brentista', v); };
    const handleViljuskaristaChange = (v) => { setViljuskarista(v); localStorage.setItem('shared_viljuskarista', v); };

    useEffect(() => {
        supabase.from('radnici').select('ime_prezime').then(({data}) => setRadniciList(data ? data.map(r=>r.ime_prezime) : []));
    }, []);

    const [form, setForm] = useState({ naziv: '', debljina: '', sirina: '', duzina: '', kolicina_ulaz: '', jm: 'kom', rn_jm: 'm3', rn_stavka_id: null, naruceno: 0, napravljeno: 0 });
    const [isScanning, setIsScanning] = useState(false);
    const [scanTarget, setScanTarget] = useState('');
    const [dostupneOznake, setDostupneOznake] = useState([]); 
    const [odabraneOznake, setOdabraneOznake] = useState([]);
    const timerRef = useRef(null);

    useEffect(() => {
        supabase.from('katalog_proizvoda').select('*').then(({data}) => setKatalog(data || []));
        supabase.from('radni_nalozi').select('id, kupac_naziv, status').neq('status', 'ZAVRŠENO').then(({data}) => setAktivniNalozi(data || []));
    }, []);

    useEffect(() => {
        const fetchMasinaAtribute = async () => {
            if (!header.masina) return;
            const { data } = await supabase.from('masine').select('atributi_paketa').eq('naziv', header.masina).maybeSingle();
            setDostupneOznake(data?.atributi_paketa || []);
            setOdabraneOznake([]); 
        };
        fetchMasinaAtribute();

        const ucitajDezurneRadnike = async () => {
            if (!header.masina) return;
            const { data } = await supabase.from('aktivni_radnici').select('radnik_ime, uloga').eq('masina_naziv', header.masina).is('vrijeme_odjave', null);
            if (data) {
                const b = data.find(r => r.uloga === 'brentista');
                const v = data.find(r => r.uloga === 'viljuskarista');
                if (b) { setBrentista(b.radnik_ime); localStorage.setItem('shared_brentista', b.radnik_ime); }
                if (v) { setViljuskarista(v.radnik_ime); localStorage.setItem('shared_viljuskarista', v.radnik_ime); }
            }
        };
        ucitajDezurneRadnike();
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
                        id: s.id, sifra_proizvoda: s.sifra, naziv_proizvoda: s.naziv, jm: s.jm_obracun || s.jm_unos || 'm3', 
                        naruceno: parseFloat(s.kolicina_obracun || s.kolicina || 0), napravljeno: parseFloat(s.napravljeno || 0),
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
        window.scrollTo({ top: 400, behavior: 'smooth' });
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
        if(timerRef.current) clearTimeout(timerRef.current);
        if(!val) return;
        if (isEnter) processIzlaz(val);
        else timerRef.current = setTimeout(() => processIzlaz(val), 2000);
    };

    const fetchIzlaz = async (pid) => { const { data } = await supabase.from('paketi').select('*').eq('paket_id', pid); setIzlazPackageItems(data || []); };

    const toggleOznaka = (o) => { setOdabraneOznake(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o]); };

    const save = async () => {
        if (!selectedIzlazId) return alert("Prvo skenirajte IZLAZNI PAKET!");
        if (!form.kolicina_ulaz) return alert("⚠️ Unesite količinu prije snimanja!");

        const timeNowFull = new Date().toISOString();
        const timeNow = new Date().toLocaleTimeString('de-DE');

        const { data: aktuelniRadnici } = await supabase.from('aktivni_radnici').select('radnik_ime').eq('masina_naziv', header.masina).is('vrijeme_odjave', null);
        const radniciIzPilane = aktuelniRadnici ? aktuelniRadnici.map(r => r.radnik_ime).join(', ') : '';

        const { data: lastItem } = await supabase.from('paketi').select('created_at').eq('paket_id', selectedIzlazId).order('created_at', { ascending: false }).limit(1).maybeSingle();
        const startTime = lastItem ? lastItem.created_at : new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        const { data: logs } = await supabase.from('prorez_log').select('trupac_id').eq('masina', header.masina).gte('created_at', startTime).lte('created_at', timeNowFull);
        const currentTrupciIds = logs ? [...new Set(logs.map(l => l.trupac_id))] : [];

        const v = parseFloat(form.debljina) || 1; const s = parseFloat(form.sirina) || 1; const d = parseFloat(form.duzina) || 1;
        const unosKol = parseFloat(form.kolicina_ulaz);
        let komada = unosKol;
        if (form.jm === 'm3') komada = unosKol / ((v/100) * (s/100) * (d/100));
        else if (form.jm === 'm2') komada = unosKol / ((s/100) * (d/100));
        else if (form.jm === 'm1') komada = unosKol / (d/100);
        const qtyZaPaket = parseFloat((komada * (v/100) * (s/100) * (d/100)).toFixed(3));

        if (activeEditItem) {
            const newM3 = updateMode === 'dodaj' ? parseFloat(activeEditItem.kolicina_final) + qtyZaPaket : parseFloat(activeEditItem.kolicina_final) - qtyZaPaket;
            const { error } = await supabase.from('paketi').update({ 
                kolicina_final: parseFloat(newM3.toFixed(3)), vrijeme_tekst: timeNow, snimio_korisnik: user.ime_prezime,
                brentista: brentista, viljuskarista: viljuskarista, radnici_pilana: radniciIzPilane, 
                oznake: odabraneOznake.length > 0 ? odabraneOznake : activeEditItem.oznake,
                broj_veze: radniNalog || activeEditItem.broj_veze,
                ulaz_trupci_ids: currentTrupciIds.length > 0 ? currentTrupciIds : activeEditItem.ulaz_trupci_ids 
            }).eq('id', activeEditItem.id);
            if (error) return alert("❌ GREŠKA PRI AŽURIRANJU: " + error.message);
        } else {
            const payload = {
                paket_id: selectedIzlazId, naziv_proizvoda: form.naziv, debljina: v, sirina: s, duzina: d,
                kolicina_ulaz: form.kolicina_ulaz, jm: form.jm, kolicina_final: qtyZaPaket, mjesto: header.mjesto, masina: header.masina,
                snimio_korisnik: user.ime_prezime, brentista: brentista, viljuskarista: viljuskarista, radnici_pilana: radniciIzPilane, 
                ulaz_trupci_ids: currentTrupciIds, broj_veze: radniNalog, vrijeme_tekst: timeNow, datum_yyyy_mm: header.datum, oznake: odabraneOznake
            };
            const { error } = await supabase.from('paketi').insert([payload]);
            if (error) return alert("Greška: " + error.message);

            if(form.rn_stavka_id) {
                const rn_jm = form.rn_jm || 'm3';
                let napravljenoZaRN = komada;
                if (rn_jm === 'm3') napravljenoZaRN = komada * (v/100) * (s/100) * (d/100);
                else if (rn_jm === 'm2') napravljenoZaRN = komada * (s/100) * (d/100);
                else if (rn_jm === 'm1') napravljenoZaRN = komada * (d/100);

                const {data: rn} = await supabase.from('radni_nalozi').select('stavke_jsonb').eq('id', radniNalog.toUpperCase()).maybeSingle();
                if (rn && rn.stavke_jsonb) {
                    const azurirane = rn.stavke_jsonb.map(st => {
                        if (st.id === form.rn_stavka_id) {
                            const nova = (parseFloat(st.napravljeno) || 0) + napravljenoZaRN;
                            return { ...st, napravljeno: parseFloat(nova.toFixed(4)) };
                        }
                        return st;
                    });
                    await supabase.from('radni_nalozi').update({ stavke_jsonb: azurirane }).eq('id', radniNalog.toUpperCase());
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
            alert(`Prazan paket ${pid} je zatvoren i oslobođen.`); return;
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
        if(window.confirm(`Ukloniti paket ${pid} sa ekrana?`)) {
            setActiveIzlazIds(p => p.filter(x => x !== pid));
            if(selectedIzlazId === pid) setSelectedIzlazId('');
        }
    };

    return (
        <div className="p-4 max-w-xl mx-auto space-y-6">
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-emerald-500" user={user} modulIme="pilana" />
            <h2 className="text-emerald-500 text-center font-black tracking-widest uppercase">🪵 PILANA - IZLAZ DASKE</h2>
            
            <div className="grid grid-cols-2 gap-3 bg-[#1e293b] p-4 rounded-[2rem] border border-emerald-500/30 shadow-lg mb-4 mt-4">
                <SearchableInput label="👨‍🔧 BRENTISTA (IZ PROREZA)" value={brentista} onChange={handleBrentistaChange} list={radniciList} />
                <SearchableInput label="🚜 VILJUŠKARISTA" value={viljuskarista} onChange={handleViljuskaristaChange} list={radniciList} />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {activeIzlazIds.map(id => (
                    <div key={id} className={`flex items-center rounded-xl border-2 transition-all ${selectedIzlazId === id ? 'bg-emerald-600 border-white font-black shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-800 border-slate-700'}`}>
                        <button onClick={() => {setSelectedIzlazId(id); fetchIzlaz(id);}} className="px-4 py-2">{id}</button>
                        <button onClick={() => otkaziPaket(id)} className="px-3 py-2 text-red-300 hover:text-white hover:bg-red-500 rounded-r-lg font-black border-l border-slate-700" title="Zatvori karticu">✕</button>
                    </div>
                ))}
            </div>

            <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-emerald-500/30 shadow-2xl space-y-5">
                <div className="relative font-black bg-blue-900/20 p-4 rounded-2xl border border-blue-500/30">
                    <label className="text-[8px] text-blue-400 uppercase ml-2 block mb-1">RADNI NALOG</label>
                    <PD_SearchableRN nalozi={aktivniNalozi} value={radniNalog} onSelect={handleNalogSelect} onScanClick={() => {setScanTarget('nalog'); setIsScanning(true);}} />
                    
                    {rnStavke.length > 0 && (
                        <div className="mt-3 space-y-2 border-t border-blue-500/30 pt-3">
                            <span className="text-[9px] text-blue-300 uppercase font-black mb-2 block">Stavke na nalogu (Klikni za izradu):</span>
                            {rnStavke.map(s => {
                                const preostalo = s.naruceno - s.napravljeno;
                                let pM3 = 0, pKom = 0;
                                if (preostalo > 0) {
                                    if (s.jm === 'm3') { pM3 = preostalo; pKom = s.vol1kom > 0 ? Math.ceil(preostalo / s.vol1kom) : 0; }
                                    else if (s.jm === 'kom') { pKom = preostalo; pM3 = preostalo * s.vol1kom; }
                                    else { pM3 = preostalo; }
                                }
                                return (
                                <div key={s.id} onClick={() => handleStavkaSelect(s)} className="flex justify-between items-center p-3 bg-slate-800 rounded-xl cursor-pointer hover:bg-blue-600 transition-all border border-slate-700">
                                    <div><div className="text-[10px] text-white font-bold">{s.sifra_proizvoda} - {s.naziv_proizvoda}</div><div className="text-[9px] text-slate-400 mt-0.5">Dimenzije: {s.dimenzije}</div></div>
                                    <div className="text-right"><div className="text-[9px] text-emerald-300 font-black">Nar: {s.naruceno} | Ur: {s.napravljeno}</div><div className={`text-[10px] font-black mt-0.5 ${preostalo > 0 ? 'text-amber-400' : 'text-emerald-500'}`}>Preostalo: {preostalo > 0 ? `${pM3.toFixed(3)} m³ (${pKom} kom)` : '0 (GOTOVO)'}</div></div>
                                </div>
                            )})}
                        </div>
                    )}
                </div>

                <div className="relative font-black border-t border-slate-700 pt-5">
                    <label className="text-[8px] text-emerald-500 uppercase ml-4 block mb-1">QR IZLAZNOG PAKETA</label>
                    <input type="text" value={izlazScan} onChange={e => handleIzlazInput(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') handleIzlazInput(izlazScan, true) }} placeholder="Upiši ili skeniraj..." className="w-full p-5 bg-[#0f172a] border-2 border-slate-700 rounded-2xl text-center text-xl text-white outline-none focus:border-emerald-500 uppercase font-black" />
                    <button onClick={() => {setScanTarget('paket'); setIsScanning(true);}} className="absolute right-3 top-12 bottom-3 px-4 bg-emerald-600 rounded-xl text-white font-bold hover:bg-emerald-500 shadow-lg">📷</button>
                </div>
                
                {selectedIzlazId && (
                    <div className="animate-in zoom-in-50 space-y-4 bg-slate-900 p-5 rounded-3xl border border-emerald-500/50 mt-4">
                        <div className="flex justify-between items-center border-b border-slate-700 pb-2 mb-2">
                            <h3 className="text-emerald-500 font-black uppercase text-xs">Paket: {selectedIzlazId}</h3>
                            <button onClick={() => zakljuciPaket(selectedIzlazId)} className="bg-red-600 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-red-500 shadow-lg">🏁 Zaključi Paket</button>
                        </div>

                        {activeEditItem && (
                            <div className="p-4 bg-slate-950/50 rounded-2xl border border-blue-500/50">
                                <div className="flex justify-between items-center"><span className="text-[10px] text-blue-300 uppercase font-black">Ažuriranje: {activeEditItem.naziv_proizvoda}</span><button onClick={()=>setActiveEditItem(null)} className="text-red-500 text-xs font-black">PONIŠTI ×</button></div>
                                <div className="flex bg-slate-900 p-1 rounded-xl mt-3"><button onClick={() => setUpdateMode('dodaj')} className={`flex-1 py-2 rounded-lg text-[10px] uppercase font-black ${updateMode==='dodaj'?'bg-green-600 text-white shadow-lg':'text-slate-500'}`}>+ Dodaj</button><button onClick={() => setUpdateMode('oduzmi')} className={`flex-1 py-2 rounded-lg text-[10px] uppercase font-black ${updateMode==='oduzmi'?'bg-red-600 text-white shadow-lg':'text-slate-500'}`}>- Oduzmi</button></div>
                            </div>
                        )}
                        
                        <PD_SearchableProizvod katalog={katalog} value={form.naziv} onSelect={k => setForm({...form, naziv: k.naziv, debljina: k.visina, sirina: k.sirina, duzina: k.duzina, jm: 'kom'})} />
                        
                        {form.rn_stavka_id && (
                            <div className="flex justify-between items-center bg-blue-900/30 p-3 rounded-xl border border-blue-500/30 mt-2">
                                {(() => {
                                    const rnStavka = rnStavke.find(rs => rs.id === form.rn_stavka_id);
                                    const preostalo = (parseFloat(form.naruceno) - parseFloat(form.napravljeno));
                                    let pM3 = 0, pKom = 0;
                                    if (rnStavka && preostalo > 0) {
                                        if (rnStavka.jm === 'm3') { pM3 = preostalo; pKom = rnStavka.vol1kom > 0 ? Math.ceil(preostalo / rnStavka.vol1kom) : 0; }
                                        else if (rnStavka.jm === 'kom') { pKom = preostalo; pM3 = preostalo * rnStavka.vol1kom; }
                                        else { pM3 = preostalo; }
                                    }
                                    return (
                                        <>
                                            <div><div className="text-[9px] text-blue-300 uppercase">Naručeno: <b className="text-white text-xs">{form.naruceno}</b></div><div className="text-[9px] text-emerald-400 uppercase">Urađeno: <b className="text-white text-xs">{form.napravljeno}</b></div></div>
                                            <div className="text-right text-[10px] text-amber-400 uppercase font-black">Preostalo: <br/><span className="text-white text-lg">{preostalo > 0 ? `${pM3.toFixed(3)} m³` : '0 m³'}</span>{preostalo > 0 && <span className="text-amber-200 text-xs ml-1">({pKom} kom)</span>}</div>
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                        <div className="grid grid-cols-3 gap-2 mt-2">
                            <DimBox label="Deb" val={form.debljina} set={v => setForm({...form, debljina: v})} disabled={!!activeEditItem} />
                            <DimBox label="Šir" val={form.sirina} set={v => setForm({...form, sirina: v})} disabled={!!activeEditItem} />
                            <DimBox label="Duž" val={form.duzina} set={v => setForm({...form, duzina: v})} disabled={!!activeEditItem} />
                        </div>
                        <div className="flex gap-2">
                            <input type="number" value={form.kolicina_ulaz} onKeyDown={e => {if(e.key==='Enter') save()}} onChange={e => setForm({...form, kolicina_ulaz: e.target.value})} className="flex-1 p-4 bg-[#0f172a] border-2 border-slate-700 rounded-2xl text-2xl text-center text-white font-black" placeholder="Količina..." />
                            <select value={form.jm} onChange={e => setForm({...form, jm: e.target.value})} className="bg-slate-800 px-4 rounded-xl text-white font-black outline-none border border-slate-700 focus:border-emerald-500"><option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option></select>
                        </div>

                        {dostupneOznake.length > 0 && (
                            <div className="space-y-2 mt-4 bg-slate-950 p-3 rounded-xl border border-slate-800">
                                <label className="text-[9px] text-slate-400 uppercase font-black ml-1">Dodatne operacije na paketu:</label>
                                <div className="flex flex-wrap gap-2">
                                    {dostupneOznake.map(o => (
                                        <button key={o} onClick={() => toggleOznaka(o)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${odabraneOznake.includes(o) ? 'bg-amber-600 border-amber-400 text-white shadow-[0_0_10px_rgba(217,119,6,0.4)]' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                            {odabraneOznake.includes(o) ? '✓ ' : '+ '} {o}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button onClick={save} className="w-full py-6 mt-4 bg-emerald-600 text-white font-black rounded-2xl uppercase shadow-xl hover:opacity-90">{activeEditItem ? `✅ Ažuriraj Stavku` : `✅ Snimi Stavku`}</button>
                        <div className="pt-4 space-y-2 max-h-52 overflow-y-auto border-t border-slate-700">
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
                            <div key={item.id} onClick={() => { setActiveEditItem(item); setForm({...item, kolicina_ulaz: '' }); }} className="flex justify-between items-center p-4 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:border-emerald-500">
                                <div>
                                    <div className="text-[10px] uppercase text-white font-bold">{item.naziv_proizvoda}</div>
                                    <div className="text-emerald-500 text-lg font-black tracking-tighter">{item.debljina}x{item.sirina}x{item.duzina}</div>
                                    <div className="flex flex-wrap gap-2 items-center mt-1">
                                        {item.oznake && item.oznake.length > 0 && (<div className="flex gap-1">{item.oznake.map(o => <span key={o} className="text-[8px] bg-amber-900/30 text-amber-400 px-1.5 py-0.5 rounded uppercase font-bold border border-amber-500/30">{o}</span>)}</div>)}
                                        {rnStavka && (<div className="text-[8px] bg-blue-900/40 border border-blue-500/30 px-1.5 py-0.5 rounded uppercase font-bold text-blue-300 shadow-sm">RN Preostalo: <span className={preostaloText !== '0 (GOTOVO)' ? 'text-amber-400' : 'text-emerald-400'}>{preostaloText}</span></div>)}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <div className="text-right font-black"><div className="text-xl text-white">{item.kolicina_final} m³</div><div className="text-[9px] text-slate-500">{item.kolicina_ulaz} {item.jm}</div></div>
                                    <button onClick={(e) => { e.stopPropagation(); printDeklaracijaPaketa(item.paket_id, [item], radniNalog); }} className="bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border border-blue-500/30 transition-all shadow-md z-10">🖨️ Print QR</button>
                                </div>
                            </div>
                        )})}
                        </div>
                    </div>
                )}
            </div>
            <DnevnikMasine modul="Pilana" header={header} user={user} />
            {isScanning && <ScannerOverlay onScan={(text) => { if(scanTarget==='nalog') handleNalogSelect(text); else handleIzlazInput(text, true); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}