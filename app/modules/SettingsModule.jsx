"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://awaxwejrhmjeqohrgidm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY');

function SettingsSearchable({ label, value, onChange, list = [], placeholder="..." }) {
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef(null);

    // OVO JE DODANO: Zatvaranje liste kada se klikne bilo gdje van nje
    useEffect(() => {
        function handleClickOutside(event) { 
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false); 
        }
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);
        return () => { 
            document.removeEventListener("mousedown", handleClickOutside); 
            document.removeEventListener("touchstart", handleClickOutside); 
        };
    }, []);

    return (
        <div ref={wrapperRef} className="relative font-black">
            {label && <label className="text-[8px] text-slate-500 uppercase ml-3 block mb-1">{label}</label>}
            <input 
                type="text" 
                value={value} 
                onFocus={() => setOpen(true)} 
                onChange={e => { onChange(e.target.value.toUpperCase()); setOpen(true); }} 
                className="w-full p-3 bg-theme-panel border border-theme-border rounded-xl text-xs text-theme-text outline-none focus:border-blue-500 uppercase relative z-10" 
                placeholder={placeholder} 
            />
            {open && list.length > 0 && (
                // OVDJE JE POPRAVLJENO: Stavljen z-[5000] da ide preko svega i bg-slate-800 da pozadina bude 100% puna
                <div className="absolute z-[5000] w-full mt-1 bg-slate-800 border border-theme-border rounded-xl shadow-2xl max-h-40 overflow-y-auto custom-scrollbar">
                    {list.filter(i => i.toUpperCase().includes((value||'').toUpperCase())).map((item, idx) => (
                        <div key={idx} onClick={() => { onChange(item); setOpen(false); }} className="p-3 text-[10px] border-b border-theme-border hover:bg-theme-accent uppercase cursor-pointer text-slate-200 hover:text-white">
                            {item}
                        </div>
                    ))}
                    <div onClick={() => setOpen(false)} className="p-3 text-center text-[9px] text-red-400 font-black uppercase cursor-pointer hover:bg-red-500 hover:text-white transition-colors">
                        ✕ Zatvori
                    </div>
                </div>
            )}
        </div>
    );
}

function KatalogSearchableDetail({ katalog, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value);
    useEffect(() => { setSearch(value); }, [value]);
    const filtered = katalog.filter(k => k.sifra.toUpperCase().includes((search||'').toUpperCase()) || k.naziv.toUpperCase().includes((search||'').toUpperCase()));

    return (
        <div className="relative font-black w-full">
            <input value={search} onFocus={() => setOpen(true)} onChange={e => { setSearch(e.target.value.toUpperCase()); setOpen(true); }} placeholder="Pronađi šifru ili naziv..." className="w-full p-3 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none focus:border-amber-500" />
            {open && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-theme-panel border border-theme-border rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    {filtered.map(k => (
                        <div key={k.sifra} onClick={() => { onChange(k.sifra); setSearch(k.sifra); setOpen(false); }} className="p-3 border-b border-theme-border hover:bg-amber-600 cursor-pointer transition-all">
                            <div className="text-theme-text text-xs font-black">{k.sifra} <span className="text-amber-300 ml-1">{k.naziv}</span></div>
                            <div className="text-[9px] text-slate-400 mt-1 uppercase">Kat: {k.kategorija} | Dim: {k.visina}x{k.sirina}x{k.duzina} | Cijena: <b className="text-theme-text">{k.cijena} KM</b></div>
                        </div>
                    ))}
                    <div onClick={() => setOpen(false)} className="p-2 text-center text-[8px] text-slate-500 cursor-pointer hover:text-theme-text">Zatvori</div>
                </div>
            )}
        </div>
    );
}

// ==========================================
// TABS
// ==========================================

function TabSumarije() {
    const loggedUser = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');
    const [sumarije, setSumarije] = useState([]);
    const [podruznice, setPodruznice] = useState([]);
    const [formSum, setFormSum] = useState({ id: null, naziv: '' });
    const [isEditingSum, setIsEditingSum] = useState(false);
    const [warningSum, setWarningSum] = useState(null);
    const timerSum = useRef(null);

    const [formPodr, setFormPodr] = useState({ id: null, sumarija_naziv: '', naziv: '' });
    const [isEditingPodr, setIsEditingPodr] = useState(false);
    const [warningPodr, setWarningPodr] = useState(null);
    const timerPodr = useRef(null);

    useEffect(() => { load(); }, []);
    
    const load = async () => {
        const {data: s} = await supabase.from('sumarije').select('*').order('naziv'); setSumarije(s||[]);
        const {data: p} = await supabase.from('podruznice').select('*').order('naziv'); setPodruznice(p||[]);
    };

    const zapisiU_Log = async (akcija, detalji) => { await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]); };

    const handleSumChange = (val) => {
        const upperVal = val.toUpperCase();
        setFormSum({...formSum, naziv: upperVal});
        setWarningSum(null);
        if(timerSum.current) clearTimeout(timerSum.current);
        if(upperVal.length >= 2 && !isEditingSum) {
            timerSum.current = setTimeout(() => { const postoji = sumarije.find(s => s.naziv === upperVal); if(postoji) setWarningSum(postoji); }, 2000);
        }
    };

    const pokreniIzmjenuSum = (item) => { setFormSum({ id: item.id, naziv: item.naziv }); setIsEditingSum(true); setWarningSum(null); };
    const ponistiIzmjenuSum = () => { setFormSum({ id: null, naziv: '' }); setIsEditingSum(false); setWarningSum(null); };

    const saveSumarija = async () => {
        if(!formSum.naziv) return alert("Unesite naziv šumarije!");
        if(isEditingSum) {
            const {error} = await supabase.from('sumarije').update({ naziv: formSum.naziv }).eq('id', formSum.id);
            if(error) return alert("Greška: " + error.message);
            await zapisiU_Log('IZMJENA_SUMARIJE', `Ažurirana šumarija: ${formSum.naziv}`); alert("✅ Šumarija uspješno ažurirana!");
        } else {
            const postoji = sumarije.find(s => s.naziv === formSum.naziv);
            if(postoji) return alert("❌ Šumarija već postoji!");
            const {error} = await supabase.from('sumarije').insert([{ naziv: formSum.naziv }]);
            if(error) return alert("Greška: " + error.message);
            await zapisiU_Log('DODAVANJE_SUMARIJE', `Dodana šumarija: ${formSum.naziv}`); alert("✅ Šumarija uspješno dodana!");
        }
        ponistiIzmjenuSum(); load();
    };

    const obrisiSumariju = async (id, naziv) => {
        if(window.confirm(`Brisati šumariju: ${naziv}?\nPAŽNJA: Obrisaće se i njene podružnice!`)) {
            await supabase.from('sumarije').delete().eq('id', id); await zapisiU_Log('BRISANJE_SUMARIJE', `Obrisana šumarija: ${naziv}`); load();
        }
    };

    const handlePodrChange = (val) => {
        const upperVal = val.toUpperCase();
        setFormPodr({...formPodr, naziv: upperVal});
        setWarningPodr(null);
        if(timerPodr.current) clearTimeout(timerPodr.current);
        if(upperVal.length >= 2 && formPodr.sumarija_naziv && !isEditingPodr) {
            timerPodr.current = setTimeout(() => { const postoji = podruznice.find(p => p.naziv === upperVal && p.sumarija_naziv === formPodr.sumarija_naziv); if(postoji) setWarningPodr(postoji); }, 2000);
        }
    };

    const pokreniIzmjenuPodr = (item) => { setFormPodr({ id: item.id, sumarija_naziv: item.sumarija_naziv, naziv: item.naziv }); setIsEditingPodr(true); setWarningPodr(null); };
    const ponistiIzmjenuPodr = () => { setFormPodr({ id: null, sumarija_naziv: '', naziv: '' }); setIsEditingPodr(false); setWarningPodr(null); };

    const savePodruznica = async () => {
        if(!formPodr.sumarija_naziv || !formPodr.naziv) return alert("Odaberite šumariju i unesite naziv podružnice!");
        if(isEditingPodr) {
            const {error} = await supabase.from('podruznice').update({ sumarija_naziv: formPodr.sumarija_naziv, naziv: formPodr.naziv }).eq('id', formPodr.id);
            if(error) return alert("Greška: " + error.message);
            await zapisiU_Log('IZMJENA_PODRUZNICE', `Ažurirana podružnica: ${formPodr.naziv} (${formPodr.sumarija_naziv})`); alert("✅ Podružnica uspješno ažurirana!");
        } else {
            const postoji = podruznice.find(p => p.naziv === formPodr.naziv && p.sumarija_naziv === formPodr.sumarija_naziv);
            if(postoji) return alert("❌ Podružnica već postoji u toj šumariji!");
            const {error} = await supabase.from('podruznice').insert([{ sumarija_naziv: formPodr.sumarija_naziv, naziv: formPodr.naziv }]);
            if(error) return alert("Greška: " + error.message);
            await zapisiU_Log('DODAVANJE_PODRUZNICE', `Dodana podružnica: ${formPodr.naziv} (${formPodr.sumarija_naziv})`); alert("✅ Podružnica uspješno dodana!");
        }
        ponistiIzmjenuPodr(); load();
    };

    const obrisiPodruznicu = async (id, naziv) => {
        if(window.confirm(`Brisati podružnicu: ${naziv}?`)) { await supabase.from('podruznice').delete().eq('id', id); await zapisiU_Log('BRISANJE_PODRUZNICE', `Obrisana podružnica: ${naziv}`); load(); }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
            <div className="space-y-6">
                <div className={`bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border shadow-2xl space-y-4 transition-all ${isEditingSum ? 'border-amber-500/50' : 'border-theme-border'}`}>
                    <div className="flex justify-between items-center">
                        <h3 className={`${isEditingSum ? 'text-amber-500' : 'text-emerald-500'} font-black uppercase text-xs`}>{isEditingSum ? '✏️ Ažuriranje Šumarije' : '🌲 Dodaj Novu Šumariju'}</h3>
                        {isEditingSum && <button onClick={ponistiIzmjenuSum} className="text-xs text-red-500 font-black bg-red-900/20 px-3 py-1 rounded-xl hover:bg-red-500 hover:text-theme-text transition-all">Odustani ✕</button>}
                    </div>
                    {warningSum && (
                        <div className="bg-amber-900/30 border border-amber-500/50 p-4 rounded-2xl space-y-2 animate-in zoom-in-95">
                            <h4 className="text-amber-500 font-black uppercase text-[10px]">⚠️ Šumarija već postoji!</h4>
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => pokreniIzmjenuSum(warningSum)} className="flex-1 bg-amber-600 text-theme-text py-2 rounded-xl font-black text-[10px] uppercase hover:bg-amber-500">✏️ Ažuriraj</button>
                                <button onClick={() => { setFormSum({...formSum, naziv: ''}); setWarningSum(null); }} className="flex-1 bg-slate-700 text-theme-text py-2 rounded-xl font-black text-[10px] uppercase hover:bg-slate-600">✕ Otkaži</button>
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* Pretraži ili unesi naziv šumarije</label>
                        <SettingsSearchable value={formSum.naziv} onChange={handleSumChange} list={sumarije.map(s=>s.naziv)} placeholder="Unesi naziv..." />
                    </div>
                    <button onClick={saveSumarija} className={`w-full py-4 text-theme-text font-black rounded-xl text-xs shadow-lg uppercase transition-all ${isEditingSum ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>{isEditingSum ? '✅ Ažuriraj Šumariju' : '➕ Snimi Šumariju'}</button>
                </div>
                <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-theme-border shadow-xl">
                    <h3 className="text-slate-400 font-black uppercase text-[10px] mb-3">Lista Šumarija - Klikni za izmjenu</h3>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {sumarije.map(s => (
                            <div key={s.id} onClick={() => pokreniIzmjenuSum(s)} className="flex justify-between items-center p-3 bg-theme-panel border border-theme-border rounded-xl cursor-pointer hover:border-emerald-500/50 transition-all">
                                <span className="text-theme-text text-xs font-black">{s.naziv}</span>
                                <button onClick={(e)=>{e.stopPropagation(); obrisiSumariju(s.id, s.naziv);}} className="text-red-500 font-black px-4 py-2 bg-red-900/20 hover:bg-red-500 hover:text-theme-text rounded-xl transition-all">✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className={`bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border shadow-2xl space-y-4 transition-all ${isEditingPodr ? 'border-amber-500/50' : 'border-theme-border'}`}>
                    <div className="flex justify-between items-center">
                        <h3 className={`${isEditingPodr ? 'text-amber-500' : 'text-emerald-400'} font-black uppercase text-xs`}>{isEditingPodr ? '✏️ Ažuriranje Podružnice' : '🍃 Dodaj Podružnicu'}</h3>
                        {isEditingPodr && <button onClick={ponistiIzmjenuPodr} className="text-xs text-red-500 font-black bg-red-900/20 px-3 py-1 rounded-xl hover:bg-red-500 hover:text-theme-text transition-all">Odustani ✕</button>}
                    </div>
                    {warningPodr && (
                        <div className="bg-amber-900/30 border border-amber-500/50 p-4 rounded-2xl space-y-2 animate-in zoom-in-95">
                            <h4 className="text-amber-500 font-black uppercase text-[10px]">⚠️ Podružnica već postoji u ovoj šumariji!</h4>
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => pokreniIzmjenuPodr(warningPodr)} className="flex-1 bg-amber-600 text-theme-text py-2 rounded-xl font-black text-[10px] uppercase hover:bg-amber-500">✏️ Ažuriraj</button>
                                <button onClick={() => { setFormPodr({...formPodr, naziv: ''}); setWarningPodr(null); }} className="flex-1 bg-slate-700 text-theme-text py-2 rounded-xl font-black text-[10px] uppercase hover:bg-slate-600">✕ Otkaži</button>
                            </div>
                        </div>
                    )}
                    <div className="space-y-3">
                        <div className="relative z-50">
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* Pripada Šumariji (Odaberi iz baze)</label>
                            <SettingsSearchable value={formPodr.sumarija_naziv} onChange={v=>setFormPodr({...formPodr, sumarija_naziv: v})} list={sumarije.map(s=>s.naziv)} placeholder="Pronađi šumariju..." />
                        </div>
                        <div className="relative z-40">
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* Naziv Podružnice</label>
                            <SettingsSearchable value={formPodr.naziv} onChange={handlePodrChange} list={podruznice.filter(p=>p.sumarija_naziv===formPodr.sumarija_naziv).map(p=>p.naziv)} placeholder="Unesi naziv podružnice..." />
                        </div>
                    </div>
                    <button onClick={savePodruznica} className={`w-full py-4 text-theme-text font-black rounded-xl text-xs shadow-lg uppercase transition-all ${isEditingPodr ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>{isEditingPodr ? '✅ Ažuriraj Podružnicu' : '➕ Snimi Podružnicu'}</button>
                </div>
                <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-theme-border shadow-xl">
                    <h3 className="text-slate-400 font-black uppercase text-[10px] mb-3">Lista Podružnica - Klikni za izmjenu</h3>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {podruznice.map(p => (
                            <div key={p.id} onClick={() => pokreniIzmjenuPodr(p)} className="flex justify-between items-center p-3 bg-theme-panel border border-theme-border rounded-xl cursor-pointer hover:border-emerald-500/50 transition-all">
                                <div><p className="font-black text-theme-text text-xs">{p.naziv}</p><p className="text-[9px] text-emerald-500 uppercase mt-1">Šumarija: {p.sumarija_naziv}</p></div>
                                <button onClick={(e)=>{e.stopPropagation(); obrisiPodruznicu(p.id, p.naziv);}} className="text-red-500 font-black px-4 py-2 bg-red-900/20 hover:bg-red-500 hover:text-theme-text rounded-xl transition-all">✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function TabPrevoznici() {
    const loggedUser = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');
    const [prevoznici, setPrevoznici] = useState([]);
    const [noviPrevoznik, setNoviPrevoznik] = useState('');

    useEffect(() => { load(); }, []);
    
    const load = async () => {
        const {data} = await supabase.from('prevoznici').select('*').order('naziv');
        setPrevoznici(data || []);
    };

    const zapisiU_Log = async (akcija, detalji) => { await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]); };

    const dodajPrevoznika = async () => {
        if(!noviPrevoznik.trim()) return alert("Unesite naziv prevoznika!");
        const { error } = await supabase.from('prevoznici').insert([{ naziv: noviPrevoznik.trim().toUpperCase() }]);
        if (error) alert("Greška: " + error.message);
        else {
            await zapisiU_Log('DODAVANJE_PREVOZNIKA', `Dodan prevoznik: ${noviPrevoznik.trim().toUpperCase()}`);
            setNoviPrevoznik('');
            load();
        }
    };

    const obrisiPrevoznika = async (id, naziv) => {
        if(window.confirm(`Da li ste sigurni da želite obrisati prevoznika: ${naziv}?`)) {
            await supabase.from('prevoznici').delete().eq('id', id);
            await zapisiU_Log('BRISANJE_PREVOZNIKA', `Obrisan prevoznik: ${naziv}`);
            load();
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
            <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-theme-border shadow-xl space-y-6">
                <h3 className="text-amber-400 font-black uppercase text-xs mb-4">🚚 Dodavanje Prevoznika</h3>
                <div className="flex flex-col gap-4">
                    <input value={noviPrevoznik} onChange={e=>setNoviPrevoznik(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') dodajPrevoznika()}} placeholder="Novi prevoznik (npr. TRANS-KOP)" className="w-full p-4 bg-theme-panel border border-theme-border rounded-xl text-sm text-theme-text outline-none focus:border-amber-500 uppercase font-black" />
                    <button onClick={dodajPrevoznika} className="w-full py-4 bg-amber-600 text-theme-text font-black rounded-xl hover:bg-amber-500 shadow-lg uppercase text-xs">➕ Dodaj u Bazu</button>
                </div>
            </div>
            <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-theme-border shadow-xl">
                <h3 className="text-slate-400 font-black uppercase text-xs mb-4">Trenutni Prevoznici ({prevoznici.length})</h3>
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {prevoznici.map(p => (
                        <div key={p.id} className="flex justify-between items-center p-4 bg-theme-panel border border-theme-border rounded-xl group hover:border-amber-500/50 transition-all">
                            <span className="text-sm text-theme-text font-black uppercase">{p.naziv}</span>
                            <button onClick={() => obrisiPrevoznika(p.id, p.naziv)} className="text-[10px] text-red-400 bg-red-900/20 px-4 py-2 rounded-lg transition-all uppercase font-black hover:bg-red-500 hover:text-theme-text">✕ Obriši</button>
                        </div>
                    ))}
                    {prevoznici.length === 0 && (
                        <div className="text-center p-10 border-2 border-dashed border-theme-border rounded-xl text-slate-500 text-xs font-bold">
                            Nema unesenih prevoznika u bazi.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function TabMasine() {
    const loggedUser = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');
    const [masine, setMasine] = useState([]);
    const [masterOznake, setMasterOznake] = useState([]);
    const [novaMasterOznaka, setNovaMasterOznaka] = useState('');
    const [form, setForm] = useState({ id: null, naziv: '', cijena_sat: '', cijena_m3: '', atributi_paketa: [], dozvoljeni_moduli: [] });
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => { load(); }, []);
    
    const load = async () => { 
        const {data: mData} = await supabase.from('masine').select('*').order('naziv'); setMasine(mData||[]); 
        const {data: oData} = await supabase.from('master_oznake').select('*').order('naziv'); setMasterOznake(oData ? oData.map(o => o.naziv) : []);
    };

    const zapisiU_Log = async (akcija, detalji) => { await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]); };

    const dodajUMaster = async () => {
        const val = novaMasterOznaka.trim().toUpperCase();
        if(!val) return;
        if(masterOznake.includes(val)) return alert("Ova operacija već postoji u sistemu!");
        const {error} = await supabase.from('master_oznake').insert([{ naziv: val }]);
        if(error) return alert("Greška: " + error.message);
        setNovaMasterOznaka(''); load();
    };

    const obrisiIzMastera = async (naziv) => {
        if(window.confirm(`Da li ste sigurni da želite trajno obrisati operaciju '${naziv}' iz cijelog sistema?`)) {
            await supabase.from('master_oznake').delete().eq('naziv', naziv); load();
        }
    };

    const toggleOznakaMasine = (oznaka) => {
        setForm(prev => {
            const ima = prev.atributi_paketa.includes(oznaka);
            return { ...prev, atributi_paketa: ima ? prev.atributi_paketa.filter(o => o !== oznaka) : [...prev.atributi_paketa, oznaka] };
        });
    };

    const pokreniIzmjenu = (m) => {
        setForm({ id: m.id, naziv: m.naziv, cijena_sat: m.cijena_sat || '', cijena_m3: m.cijena_m3 || '', atributi_paketa: m.atributi_paketa || [], dozvoljeni_moduli: m.dozvoljeni_moduli ? m.dozvoljeni_moduli.split(',').map(s => s.trim().toLowerCase()) : [] });
        setIsEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const ponistiIzmjenu = () => {
        setForm({ id: null, naziv: '', cijena_sat: '', cijena_m3: '', atributi_paketa: [], dozvoljeni_moduli: [] }); setIsEditing(false);
    };

    const save = async () => {
        if(!form.naziv) return alert("Naziv mašine je obavezan!");
        const payload = { naziv: form.naziv, cijena_sat: parseFloat(form.cijena_sat)||0, cijena_m3: parseFloat(form.cijena_m3)||0, atributi_paketa: form.atributi_paketa, dozvoljeni_moduli: form.dozvoljeni_moduli.join(', ') };
        if (isEditing) {
            const {error} = await supabase.from('masine').update(payload).eq('id', form.id);
            if(error) return alert("Greška: " + error.message);
            await zapisiU_Log('IZMJENA_MASINE', `Ažurirana mašina: ${form.naziv}`); alert("✅ Mašina ažurirana!");
        } else {
            const {error} = await supabase.from('masine').insert([payload]);
            if(error) return alert("Greška: " + error.message);
            await zapisiU_Log('DODAVANJE_MASINE', `Dodana mašina: ${form.naziv}`); alert("✅ Mašina dodana!");
        }
        ponistiIzmjenu(); load();
    };

    const obrisi = async (id, naziv, e) => {
        e.stopPropagation();
        if(window.confirm(`Da li ste sigurni da želite obrisati mašinu: ${naziv}?`)){
            await supabase.from('masine').delete().eq('id', id); await zapisiU_Log('BRISANJE_MASINE', `Obrisana mašina: ${naziv}`); load();
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in">
            <div className="lg:col-span-5 space-y-6">
                <div className={`p-6 rounded-box border shadow-2xl transition-all ${isEditing ? 'border-amber-500/50 bg-theme-panel' : 'border-theme-border bg-theme-card backdrop-blur-[var(--glass-blur)]'}`}>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className={`${isEditing ? 'text-amber-500' : 'text-blue-500'} font-black uppercase text-xs`}>{isEditing ? '✏️ Ažuriranje Mašine' : '⚙️ Dodavanje Nove Mašine'}</h3>
                        {isEditing && <button onClick={ponistiIzmjenu} className="text-xs text-red-500 font-black bg-red-900/20 px-3 py-1 rounded-xl hover:bg-red-500 hover:text-theme-text transition-all">Odustani ✕</button>}
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        <div><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* Naziv Mašine</label><input placeholder="npr. BRENTA 1" value={form.naziv} onChange={e=>setForm({...form, naziv:e.target.value})} className="w-full p-4 bg-theme-card rounded-xl text-sm font-black text-theme-text outline-none uppercase border border-theme-border focus:border-blue-500" /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Cijena / Sat (KM)</label><input type="number" placeholder="0.00" value={form.cijena_sat} onChange={e=>setForm({...form, cijena_sat:e.target.value})} className="w-full p-3 bg-theme-card rounded-xl text-xs text-theme-text outline-none border border-theme-border focus:border-blue-500" /></div>
                            <div><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Cijena / m³ (KM)</label><input type="number" placeholder="0.00" value={form.cijena_m3} onChange={e=>setForm({...form, cijena_m3:e.target.value})} className="w-full p-3 bg-theme-card rounded-xl text-xs text-theme-text outline-none border border-theme-border focus:border-blue-500" /></div>
                        </div>
                        <div className="mt-2 bg-theme-card p-4 rounded-xl border border-theme-border">
                            <label className="text-[10px] text-slate-500 uppercase font-black mb-3 block">Dozvoljeni Moduli (prikaz mašine)</label>
                            <div className="flex flex-wrap gap-4">
                                {['prorez', 'pilana', 'dorada'].map(modul => (
                                    <label key={modul} className="flex items-center gap-2 text-theme-text text-[10px] font-black cursor-pointer uppercase hover:text-theme-accent transition-colors bg-theme-panel px-3 py-2 rounded-lg border border-theme-border shadow-sm">
                                        <input type="checkbox" checked={form.dozvoljeni_moduli?.includes(modul) || false} onChange={(e) => { const trenutni = form.dozvoljeni_moduli || []; setForm({ ...form, dozvoljeni_moduli: e.target.checked ? [...trenutni, modul] : trenutni.filter(m => m !== modul) }); }} className="w-4 h-4 accent-blue-600 bg-theme-panel border-theme-border rounded" />
                                        {modul}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="pt-4 border-t border-theme-border mt-2">
                            <label className="text-[10px] text-slate-400 uppercase font-black mb-3 block">🏷️ Odobreni atributi / operacije za ovu mašinu:</label>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {masterOznake.map(oznaka => {
                                    const aktivan = form.atributi_paketa.includes(oznaka);
                                    return (
                                        <div key={oznaka} className="flex items-center shadow-sm">
                                            <button onClick={() => toggleOznakaMasine(oznaka)} className={`px-3 py-2 rounded-l-xl text-[10px] font-black uppercase transition-all border-y border-l ${aktivan ? 'bg-emerald-600 border-emerald-400 text-theme-text shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-theme-card border-theme-border text-slate-500 hover:border-slate-500'}`}>{aktivan ? '✓ ' : '+ '} {oznaka}</button>
                                            <button onClick={() => obrisiIzMastera(oznaka)} className={`px-2 py-2 border-y border-r rounded-r-xl text-[10px] font-black transition-all ${aktivan ? 'bg-emerald-700 border-emerald-400 text-emerald-300 hover:text-theme-text hover:bg-red-500' : 'bg-theme-panel border-theme-border text-slate-600 hover:text-red-500'}`} title="Trajno obriši iz sistema">✕</button>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex gap-2 w-full mt-4 bg-theme-card p-2 rounded-xl border border-theme-border shadow-inner">
                                <input value={novaMasterOznaka} onChange={e=>setNovaMasterOznaka(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') dodajUMaster()}} placeholder="Nova globalna operacija..." className="flex-1 p-2 bg-transparent text-xs text-theme-text outline-none uppercase font-bold" />
                                <button onClick={dodajUMaster} className="px-5 bg-theme-accent rounded-lg text-theme-text font-black hover:opacity-80 text-[10px] uppercase shadow-md">+ Baza</button>
                            </div>
                        </div>
                    </div>
                    <button onClick={save} className={`w-full py-4 text-theme-text font-black rounded-xl text-xs shadow-lg uppercase transition-all mt-6 ${isEditing ? 'bg-amber-600 hover:bg-amber-500' : 'bg-theme-accent hover:opacity-80'}`}>{isEditing ? '✅ Ažuriraj Mašinu' : '➕ Dodaj Mašinu'}</button>
                </div>
            </div>

            <div className="lg:col-span-7 bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-theme-border shadow-2xl">
                <h3 className="text-[10px] text-slate-400 font-black uppercase mb-4 tracking-widest">Spisak mašina</h3>
                <div className="max-h-[600px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                    {masine.length === 0 && <p className="text-center text-slate-500 text-xs py-10 border-2 border-dashed border-theme-border rounded-xl">Nema unesenih mašina.</p>}
                    {masine.map(m => (
                        <div key={m.id} onClick={() => pokreniIzmjenu(m)} className={`flex flex-col p-4 border rounded-2xl cursor-pointer transition-all shadow-sm ${isEditing && form.id === m.id ? 'bg-theme-panel border-amber-500/50' : 'bg-theme-panel border-theme-border hover:border-blue-500/50'}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-black text-theme-text text-base">{m.naziv}</p>
                                    <p className="text-[10px] text-slate-400 mt-2">Radni sat: <b className="text-emerald-400">{m.cijena_sat} KM</b> | Po kubiku: <b className="text-emerald-400">{m.cijena_m3} KM</b> | Moduli: <b className="text-theme-accent">{m.dozvoljeni_moduli ? m.dozvoljeni_moduli.toUpperCase() : 'SVI'}</b></p>
                                </div>
                                <button onClick={(e)=>obrisi(m.id, m.naziv, e)} className="text-red-500 font-black px-4 py-3 bg-red-900/20 rounded-xl hover:bg-red-500 hover:text-theme-text transition-all">✕ Obriši</button>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-4 pt-3 border-t border-theme-border">
                                {(m.atributi_paketa || []).length === 0 ? (
                                    <span className="text-[9px] text-slate-500 font-bold italic">Nema dodijeljenih operacija</span>
                                ) : (
                                    (m.atributi_paketa || []).map(attr => <span key={attr} className="text-[8px] text-emerald-400 bg-emerald-900/20 border border-emerald-500/30 px-2 py-1 rounded-md font-black uppercase shadow-sm">{attr}</span>)
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function TabKatalog() {
    const loggedUser = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');
    const [katalog, setKatalog] = useState([]);
    const [form, setForm] = useState({ sifra: '', naziv: '', dimenzije: '', kategorija: '', default_jedinica: 'm3', cijena: '', m3: '', m2: '', m1: '', duzina: '', sirina: '', visina: '' });
    const [isEditing, setIsEditing] = useState(false);
    
    const [odabranaKategorija, setOdabranaKategorija] = useState('');
    const [novaGlobalnaCijena, setNovaGlobalnaCijena] = useState('');
    const [cijeneEditMap, setCijeneEditMap] = useState({}); 

    // NOVO: State za masovno prebacivanje kategorija
    const [kategorijaZaMijenjanje, setKategorijaZaMijenjanje] = useState('');
    const [kategorijaNovaDestinacija, setKategorijaNovaDestinacija] = useState('');

    useEffect(() => { load(); }, []);

    // NOVO: Funkcija za masovno prebacivanje
    const masovnoPrebaciKategoriju = async () => {
        if (!kategorijaZaMijenjanje || !kategorijaNovaDestinacija) return alert("Odaberite staru i unesite novu kategoriju!");
        if (kategorijaZaMijenjanje === kategorijaNovaDestinacija) return alert("Kategorije su iste!");

        const proizvodiZaUpdate = katalog.filter(k => k.kategorija === kategorijaZaMijenjanje).map(p => ({ ...p, kategorija: kategorijaNovaDestinacija.toUpperCase() }));
        if (proizvodiZaUpdate.length === 0) return alert("Nema proizvoda u staroj kategoriji!");

        if (!window.confirm(`Da li ste sigurni da želite prebaciti SVIH ${proizvodiZaUpdate.length} proizvoda iz kategorije '${kategorijaZaMijenjanje}' u novu kategoriju '${kategorijaNovaDestinacija.toUpperCase()}'?`)) return;

        const { error } = await supabase.from('katalog_proizvoda').upsert(proizvodiZaUpdate, { onConflict: 'sifra' });
        if (error) return alert("Greška: " + error.message);

        await zapisiU_Log('MASOVNA_IZMJENA_KATEGORIJA', `Prebačeno ${proizvodiZaUpdate.length} iz ${kategorijaZaMijenjanje} u ${kategorijaNovaDestinacija}`);
        alert("✅ Kategorije uspješno prebačene!");
        setKategorijaZaMijenjanje(''); setKategorijaNovaDestinacija('');
        load();
    };
    
    const load = async () => { 
        const {data} = await supabase.from('katalog_proizvoda').select('*').order('sifra'); 
        setKatalog(data||[]); 
    };

    const jedinstveneKategorije = useMemo(() => Array.from(new Set(katalog.map(k=>k.kategorija).filter(Boolean))), [katalog]);

    const proizvodiUKategoriji = useMemo(() => {
        if (!odabranaKategorija) return [];
        return katalog.filter(k => k.kategorija === odabranaKategorija);
    }, [odabranaKategorija, katalog]);

    useEffect(() => {
        const inicijalno = {};
        proizvodiUKategoriji.forEach(p => { inicijalno[p.sifra] = p.cijena; });
        setCijeneEditMap(inicijalno); setNovaGlobalnaCijena('');
    }, [proizvodiUKategoriji]);

    const zapisiU_Log = async (akcija, detalji) => { await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]); };

    const pokreniIzmjenu = (proizvod) => {
        setForm({
            sifra: proizvod.sifra, naziv: proizvod.naziv, dimenzije: proizvod.dimenzije || '', kategorija: proizvod.kategorija || '',
            default_jedinica: proizvod.default_jedinica || 'm3', cijena: proizvod.cijena || '', m3: proizvod.m3 || '', 
            m2: proizvod.m2 || '', m1: proizvod.m1 || '', duzina: proizvod.duzina || '', sirina: proizvod.sirina || '', visina: proizvod.visina || ''
        });
        setIsEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); 
    };

    const ponistiIzmjenu = () => {
        setForm({ sifra: '', naziv: '', dimenzije: '', kategorija: '', default_jedinica: 'm3', cijena: '', m3: '', m2: '', m1: '', duzina: '', sirina: '', visina: '' });
        setIsEditing(false);
    };

    const snimiProizvod = async () => {
        if(!form.sifra || !form.naziv) return alert("Šifra i Naziv su obavezni!");
        
        const d = parseFloat(form.duzina)||0; const s = parseFloat(form.sirina)||0; const v = parseFloat(form.visina)||0;

        // NOVO: Pametna provjera dimenzija (ako su dimenzije unesene)
        if (d > 0 && s > 0 && v > 0) {
            const duplikatDimenzija = katalog.find(k => 
                k.sifra !== form.sifra && parseFloat(k.duzina||0) === d && parseFloat(k.sirina||0) === s && parseFloat(k.visina||0) === v
            );
            if (duplikatDimenzija) {
                if (!window.confirm(`⚠️ UPOZORENJE: Proizvod sa potpuno istim dimenzijama (${v}x${s}x${d}) već postoji u bazi!\n\nŠifra postojećeg: ${duplikatDimenzija.sifra}\nNaziv postojećeg: ${duplikatDimenzija.naziv}\n\nDa li ste sigurni da želite ignorisati ovo i svejedno snimiti ovaj proizvod?`)) {
                    return; // Prekida snimanje
                }
            }
        }

        const payload = {...form, cijena: parseFloat(form.cijena)||0, m3: parseFloat(form.m3)||0, m2: parseFloat(form.m2)||0, m1: parseFloat(form.m1)||0, duzina: d, sirina: s, visina: v };
        
        if (isEditing) {
            const { error } = await supabase.from('katalog_proizvoda').update(payload).eq('sifra', form.sifra);
            if(error) return alert("Greška pri ažuriranju: " + error.message);
            await zapisiU_Log('IZMJENA_PROIZVODA', `Ažuriran proizvod: ${form.sifra}`); alert("✅ Proizvod uspješno ažuriran!");
        } else {
            const { data: postoji } = await supabase.from('katalog_proizvoda').select('sifra').eq('sifra', form.sifra.toUpperCase()).maybeSingle();
            if(postoji) return alert("❌ Proizvod sa ovom šifrom već postoji!");
            const { error } = await supabase.from('katalog_proizvoda').insert([payload]);
            if(error) return alert("Greška pri dodavanju: " + error.message);
            await zapisiU_Log('DODAVANJE_PROIZVODA', `Dodan novi proizvod: ${form.sifra}`); alert("✅ Proizvod uspješno dodan!");
        }
        ponistiIzmjenu(); load();
    };

    const obrisiProizvod = async (sifra, naziv, e) => {
        e.stopPropagation();
        if(window.confirm(`Trajno obrisati proizvod: ${naziv}?`)){
            await supabase.from('katalog_proizvoda').delete().eq('sifra', sifra);
            await zapisiU_Log('BRISANJE_PROIZVODA', `Obrisan proizvod: ${sifra}`); load();
        }
    };

    const primijeniNaSveIspod = () => {
        if (!novaGlobalnaCijena || isNaN(novaGlobalnaCijena)) return;
        const novoStanje = { ...cijeneEditMap };
        Object.keys(novoStanje).forEach(sifra => { novoStanje[sifra] = novaGlobalnaCijena; });
        setCijeneEditMap(novoStanje);
    };

    const snimiNoveCijeneBaza = async () => {
        if (!odabranaKategorija) return;
        const podaciZaUpdate = proizvodiUKategoriji.map(p => ({ ...p, cijena: parseFloat(cijeneEditMap[p.sifra]) || parseFloat(p.cijena) }));
        if (!window.confirm(`Da li ste sigurni da želite ažurirati cijene za ${podaciZaUpdate.length} proizvoda u kategoriji ${odabranaKategorija}?`)) return;
        const { error } = await supabase.from('katalog_proizvoda').upsert(podaciZaUpdate, { onConflict: 'sifra' });
        if (error) return alert("Greška pri ažuriranju cijena: " + error.message);
        await zapisiU_Log('MASOVNA_IZMJENA_CIJENA', `Izmijenjene cijene za kategoriju: ${odabranaKategorija}`); alert("✅ Cijene uspješno ažurirane!");
        setOdabranaKategorija(''); load();
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in">
            <div className="lg:col-span-5 space-y-6">
                
                {/* BRZA IZMJENA CIJENA */}
                <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-amber-500/30 shadow-2xl">
                    <h3 className="text-amber-500 font-black uppercase text-xs mb-6">📈 Brza izmjena cijena (Kategorije)</h3>
                    <div className="grid grid-cols-1 gap-4 items-end border-b border-theme-border pb-6 mb-4">
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase ml-2 block mb-2">1. Odaberi Kategoriju</label>
                            <select value={odabranaKategorija} onChange={e=>setOdabranaKategorija(e.target.value)} className="w-full p-4 bg-theme-panel rounded-xl text-sm text-theme-text border border-theme-border outline-none focus:border-amber-500 uppercase font-black cursor-pointer shadow-inner">
                                <option value="">-- Odaberi --</option>
                                {jedinstveneKategorije.map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                        </div>
                        {odabranaKategorija && (
                            <div className="flex gap-2 items-center bg-theme-panel p-3 rounded-2xl border border-theme-border shadow-inner mt-2">
                                <div className="flex-1">
                                    <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Cijena za SVE u ovoj kategoriji</label>
                                    <input type="number" value={novaGlobalnaCijena} onChange={e=>setNovaGlobalnaCijena(e.target.value)} placeholder="0.00" className="w-full p-2 bg-transparent text-amber-400 font-black outline-none text-xl" />
                                </div>
                                <button onClick={primijeniNaSveIspod} className="bg-theme-card text-amber-500 border border-amber-500/30 hover:bg-amber-500 hover:text-theme-text px-5 py-4 rounded-xl text-[10px] font-black uppercase transition-all shadow-md">👇 Primijeni na sve</button>
                            </div>
                        )}
                    </div>
                    {odabranaKategorija && proizvodiUKategoriji.length > 0 && (
                        <div className="animate-in slide-in-from-top-4">
                            <div className="max-h-60 overflow-y-auto pr-2 space-y-2 mb-4 custom-scrollbar">
                                {proizvodiUKategoriji.map(p => (
                                    <div key={p.sifra} className="flex flex-col md:flex-row justify-between md:items-center bg-theme-panel p-3 rounded-xl border border-theme-border hover:border-slate-500 transition-all gap-3 shadow-sm">
                                        <div className="flex-1">
                                            <p className="text-theme-text text-xs font-black uppercase">{p.sifra}</p>
                                            <p className="text-[10px] text-slate-400 mt-1">{p.naziv}</p>
                                        </div>
                                        <div className="flex items-center gap-3 w-full md:w-auto">
                                            <div className="text-right">
                                                <p className="text-[8px] text-slate-500 uppercase">Trenutna</p>
                                                <p className="text-slate-300 font-bold text-xs">{p.cijena} KM</p>
                                            </div>
                                            <span className="text-slate-600">→</span>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-bold">NOVA:</span>
                                                <input type="number" value={cijeneEditMap[p.sifra] || ''} onChange={e => setCijeneEditMap({...cijeneEditMap, [p.sifra]: e.target.value})} className="w-32 pl-12 pr-3 py-3 bg-theme-card border border-amber-500/50 rounded-lg text-amber-400 font-black outline-none focus:border-amber-400 shadow-inner" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={snimiNoveCijeneBaza} className="w-full py-4 bg-amber-600 text-theme-text px-6 rounded-xl font-black text-xs uppercase shadow-lg hover:bg-amber-500 transition-all border border-amber-400">💾 Spasi sve nove cijene u bazu</button>
                        </div>
                    )}
                </div>

                {/* FORMA ZA UNOS PROIZVODA */}
                {/* MASOVNO PREBACIVANJE KATEGORIJA */}
                <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-blue-500/30 shadow-xl mb-6">
                    <h3 className="text-blue-500 font-black uppercase text-xs mb-4">🔀 Masovno Prebacivanje Kategorija</h3>
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">1. Iz stare kategorije</label>
                            <select value={kategorijaZaMijenjanje} onChange={e=>setKategorijaZaMijenjanje(e.target.value)} className="w-full p-4 bg-theme-panel rounded-xl text-sm text-theme-text border border-theme-border outline-none focus:border-blue-500 uppercase font-black cursor-pointer shadow-inner">
                                <option value="">-- Odaberi Staru --</option>
                                {jedinstveneKategorije.map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                        </div>
                        <span className="hidden md:block text-slate-500 font-black text-xl mb-3">→</span>
                        <div className="flex-1 w-full relative z-50">
                            <SettingsSearchable label="2. U novu kategoriju" value={kategorijaNovaDestinacija} onChange={setKategorijaNovaDestinacija} list={jedinstveneKategorije} placeholder="Unesi ili odaberi novu..." />
                        </div>
                        <button onClick={masovnoPrebaciKategoriju} className="bg-blue-600 hover:bg-blue-500 text-white w-full md:w-auto px-6 py-4 rounded-xl text-[10px] font-black uppercase shadow-lg transition-all h-[52px]">
                            Prebaci Sve
                        </button>
                    </div>
                </div>
                <div className={`bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border shadow-2xl space-y-4 transition-all ${isEditing ? 'border-amber-500/50' : 'border-theme-border'}`}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className={`${isEditing ? 'text-amber-500' : 'text-blue-500'} font-black uppercase text-xs`}>{isEditing ? '✏️ Ažuriranje Proizvoda' : '➕ Dodaj Proizvod Ručno'}</h3>
                        {isEditing && <button onClick={ponistiIzmjenu} className="text-xs text-red-500 font-black bg-red-900/20 px-3 py-1 rounded-xl hover:bg-red-500 hover:text-theme-text">Odustani ✕</button>}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="col-span-2 md:col-span-4">
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* ŠIFRA</label>
                            <input value={form.sifra} disabled={isEditing} onChange={e=>setForm({...form, sifra: e.target.value.toUpperCase()})} className={`w-full p-4 rounded-xl text-sm text-theme-text uppercase font-black outline-none shadow-inner ${isEditing ? 'bg-theme-panel border border-theme-border opacity-50 cursor-not-allowed' : 'bg-theme-panel border border-blue-500/50 focus:border-blue-400'}`} />
                        </div>
                        <div className="col-span-2 md:col-span-4">
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* NAZIV</label>
                            <input value={form.naziv} onChange={e=>setForm({...form, naziv:e.target.value})} className="w-full p-3 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none focus:border-blue-500 shadow-inner" />
                        </div>
                        <div className="col-span-2 md:col-span-4 relative z-40">
                            <SettingsSearchable label="Kategorija (Odaberi ili Upiši novu)" value={form.kategorija} onChange={val => setForm({...form, kategorija: val})} list={jedinstveneKategorije} placeholder="Pronađi ili unesi novu..." />
                        </div>

                        <div className="col-span-2">
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Def. Jedinica</label>
                            <select value={form.default_jedinica} onChange={e=>setForm({...form, default_jedinica:e.target.value})} className="w-full p-3 bg-theme-panel rounded-xl text-xs font-black text-theme-text border border-theme-border outline-none focus:border-blue-500 shadow-inner cursor-pointer">
                                <option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option><option value="kom">kom</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="text-[8px] text-emerald-500 uppercase ml-2 block mb-1 font-black">Cijena (KM)</label>
                            <input type="number" value={form.cijena} onChange={e=>setForm({...form, cijena:e.target.value})} className="w-full p-3 bg-emerald-900/20 border border-emerald-500/50 rounded-xl text-sm text-emerald-400 font-black outline-none text-center shadow-inner" />
                        </div>
                        
                        <div className="col-span-2 md:col-span-4 pt-3 border-t border-theme-border grid grid-cols-3 gap-3">
                            <div><label className="text-[8px] text-amber-500 uppercase ml-2 block mb-1 font-black text-center">Deb/Vis (cm)</label><input type="number" value={form.visina} onChange={e=>setForm({...form, visina:e.target.value})} className="w-full p-3 bg-theme-panel rounded-xl text-xs text-center text-amber-400 font-black border border-theme-border outline-none focus:border-amber-500 shadow-inner" /></div>
                            <div><label className="text-[8px] text-amber-500 uppercase ml-2 block mb-1 font-black text-center">Širina (cm)</label><input type="number" value={form.sirina} onChange={e=>setForm({...form, sirina:e.target.value})} className="w-full p-3 bg-theme-panel rounded-xl text-xs text-center text-amber-400 font-black border border-theme-border outline-none focus:border-amber-500 shadow-inner" /></div>
                            <div><label className="text-[8px] text-amber-500 uppercase ml-2 block mb-1 font-black text-center">Dužina (cm)</label><input type="number" value={form.duzina} onChange={e=>setForm({...form, duzina:e.target.value})} className="w-full p-3 bg-theme-panel rounded-xl text-xs text-center text-amber-400 font-black border border-theme-border outline-none focus:border-amber-500 shadow-inner" /></div>
                        </div>
                    </div>
                    <button onClick={snimiProizvod} className={`w-full py-5 text-theme-text font-black rounded-xl text-xs shadow-lg uppercase transition-all mt-4 ${isEditing ? 'bg-amber-600 hover:bg-amber-500' : 'bg-theme-accent hover:opacity-80'}`}>
                        {isEditing ? '✅ Ažuriraj Proizvod' : '➕ Snimi u Katalog'}
                    </button>
                </div>
            </div>

            <div className="lg:col-span-7 bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-theme-border shadow-2xl">
                <h3 className="text-[10px] text-slate-400 font-black uppercase mb-4 tracking-widest">Trenutni Katalog ({katalog.length} proizvoda)</h3>
                <div className="space-y-3 max-h-[850px] overflow-y-auto pr-2 custom-scrollbar">
                    {katalog.map(k => (
                        <div key={k.sifra} onClick={() => pokreniIzmjenu(k)} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 bg-theme-panel border border-theme-border rounded-2xl cursor-pointer hover:border-blue-500/50 transition-all shadow-sm">
                            <div>
                                <p className="text-theme-text text-sm font-black">{k.sifra} <span className="text-theme-accent ml-2">{k.naziv}</span></p>
                                <p className="text-[10px] text-slate-400 uppercase mt-2 font-bold tracking-widest">Kat: {k.kategorija} <span className="mx-2 opacity-50">|</span> Dim: {k.visina}x{k.sirina}x{k.duzina} <span className="mx-2 opacity-50">|</span> Cijena: <b className="text-emerald-500 text-sm ml-1">{k.cijena} KM</b>/{k.default_jedinica}</p>
                            </div>
                            <button onClick={(e) => obrisiProizvod(k.sifra, k.naziv, e)} className="mt-3 sm:mt-0 text-red-500 font-black px-4 py-3 bg-red-900/20 hover:bg-red-500 hover:text-theme-text rounded-xl transition-all uppercase text-[10px] shadow-sm">✕ Obriši</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function TabKupci() {
    const loggedUser = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');
    const [katalog, setKatalog] = useState([]);
    const [kupci, setKupci] = useState([]);
    const [form, setForm] = useState({ id: null, naziv: '', pdv: '', adresa: '', ukupni_rabat: '' });
    const [isEditing, setIsEditing] = useState(false);
    const [duplicateWarning, setDuplicateWarning] = useState(null);
    const kupacTimerRef = useRef(null);
    
    const [tempP_sifra, setTempP_sifra] = useState('');
    const [tempP_rabat, setTempP_rabat] = useState('');
    const [rabatiProizvodi, setRabatiProizvodi] = useState([]); 

    const [tempK_kat, setTempK_kat] = useState('');
    const [tempK_rabat, setTempK_rabat] = useState('');
    const [rabatiKategorije, setRabatiKategorije] = useState([]); 

    useEffect(() => { load(); }, []);
    const load = async () => {
        const {data: k} = await supabase.from('katalog_proizvoda').select('*').order('sifra'); setKatalog(k||[]);
        const {data: c} = await supabase.from('kupci').select('*').order('naziv'); setKupci(c||[]);
    };

    const jedinstveneKategorije = useMemo(() => Array.from(new Set(katalog.map(k=>k.kategorija).filter(Boolean))), [katalog]);

    const zapisiU_Log = async (akcija, detalji) => { await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]); };

    const handleNazivChange = (val) => {
        const upperVal = val.toUpperCase();
        setForm({...form, naziv: upperVal});
        setDuplicateWarning(null);
        if (kupacTimerRef.current) clearTimeout(kupacTimerRef.current);
        if (upperVal.length >= 3 && !isEditing) {
            kupacTimerRef.current = setTimeout(async () => { const { data } = await supabase.from('kupci').select('*').eq('naziv', upperVal).maybeSingle(); if (data) setDuplicateWarning(data); }, 2000);
        }
    };

    const pokreniIzmjenu = (kupac) => {
        const rabati = kupac.rabati_jsonb || {};
        const rProizvodi = Object.entries(rabati.proizvodi || {}).map(([sifra, rabat]) => ({sifra, rabat}));
        const rKategorije = Object.entries(rabati.kategorije || {}).map(([kategorija, rabat]) => ({kategorija, rabat}));
        setForm({ id: kupac.id, naziv: kupac.naziv, pdv: kupac.pdv_broj || '', adresa: kupac.adresa || '', ukupni_rabat: rabati.ukupni || '' });
        setRabatiProizvodi(rProizvodi); setRabatiKategorije(rKategorije);
        setIsEditing(true); setDuplicateWarning(null); window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const ponistiIzmjenu = () => {
        setForm({ id: null, naziv: '', pdv: '', adresa: '', ukupni_rabat: '' }); setRabatiProizvodi([]); setRabatiKategorije([]); setIsEditing(false); setDuplicateWarning(null);
    };

    const addR_Proizvod = () => { if(tempP_sifra && tempP_rabat) { setRabatiProizvodi([...rabatiProizvodi, {sifra: tempP_sifra, rabat: tempP_rabat}]); setTempP_sifra(''); setTempP_rabat(''); }};
    const remR_Proizvod = (idx) => setRabatiProizvodi(rabatiProizvodi.filter((_, i) => i !== idx));

    const addR_Kategorija = () => { if(tempK_kat && tempK_rabat) { setRabatiKategorije([...rabatiKategorije, {kategorija: tempK_kat, rabat: tempK_rabat}]); setTempK_kat(''); setTempK_rabat(''); }};
    const remR_Kategorija = (idx) => setRabatiKategorije(rabatiKategorije.filter((_, i) => i !== idx));

    const snimiKupca = async () => {
        if(!form.naziv) return alert("Naziv je obavezan!");
        const rabati_json = {
            ukupni: parseFloat(form.ukupni_rabat) || 0,
            proizvodi: rabatiProizvodi.reduce((acc, c) => ({...acc, [c.sifra]: parseFloat(c.rabat)}), {}),
            kategorije: rabatiKategorije.reduce((acc, c) => ({...acc, [c.kategorija]: parseFloat(c.rabat)}), {})
        };
        const payload = { naziv: form.naziv, pdv_broj: form.pdv, adresa: form.adresa, rabati_jsonb: rabati_json };
        if (isEditing) {
            const { error } = await supabase.from('kupci').update(payload).eq('id', form.id);
            if(error) return alert("Greška: " + error.message);
            await zapisiU_Log('IZMJENA_KUPCA', `Ažuriran kupac: ${form.naziv}`); alert("✅ Kupac uspješno ažuriran!");
        } else {
            const { error } = await supabase.from('kupci').insert([payload]);
            if(error) return alert("Greška: " + error.message);
            await zapisiU_Log('DODAVANJE_KUPCA', `Dodan novi kupac: ${form.naziv}`); alert("✅ Kupac uspješno snimljen!");
        }
        ponistiIzmjenu(); load();
    };

    const obrisiKupca = async (id, naziv, e) => {
        e.stopPropagation();
        if(window.confirm(`Da li ste sigurni da želite TRAJNO OBRISATI kupca: ${naziv}?`)){
            await supabase.from('kupci').delete().eq('id', id); await zapisiU_Log('BRISANJE_KUPCA', `Obrisan kupac: ${naziv}`); load();
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in">
            <div className="lg:col-span-7 space-y-6">
                <div className={`bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border shadow-2xl transition-all ${isEditing ? 'border-amber-500/50' : 'border-theme-border'}`}>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className={`${isEditing ? 'text-amber-500' : 'text-amber-500'} font-black uppercase text-xs`}>{isEditing ? '✏️ Ažuriranje Kupca' : '🤝 Novi Kupac i Rabati'}</h3>
                        {isEditing && <button onClick={ponistiIzmjenu} className="text-xs text-red-500 font-black bg-red-900/20 px-3 py-1 rounded-xl hover:bg-red-500 hover:text-theme-text transition-all shadow-sm">Odustani ✕</button>}
                    </div>
                    {duplicateWarning && (
                        <div className="bg-amber-900/30 border border-amber-500/50 p-4 rounded-2xl space-y-3 animate-in zoom-in-95 mb-4">
                            <h4 className="text-amber-500 font-black uppercase text-[10px]">⚠️ Upozorenje: Kupac već postoji u bazi!</h4>
                            <div className="text-theme-text text-xs bg-theme-card p-3 rounded-xl border border-theme-border">
                                <p><b>Firma:</b> {duplicateWarning.naziv} | <b>Adresa:</b> {duplicateWarning.adresa || 'N/A'}</p>
                                <p className="text-[10px] text-slate-400 mt-1">PDV: {duplicateWarning.pdv_broj || 'N/A'} | Ukupni Rabat: {duplicateWarning.rabati_jsonb?.ukupni || 0}%</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => pokreniIzmjenu(duplicateWarning)} className="flex-1 bg-amber-600 text-theme-text py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-amber-500">✏️ Ažuriraj ovog kupca</button>
                                <button onClick={() => { setForm({...form, naziv: ''}); setDuplicateWarning(null); }} className="flex-1 bg-slate-700 text-theme-text py-3 rounded-xl font-black text-[10px] uppercase hover:bg-slate-600">✕ Otkaži unos</button>
                            </div>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-theme-border pb-6 mb-6">
                        <div className="md:col-span-2">
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* Naziv Kupca / Firme</label>
                            <input value={form.naziv} onChange={e=>handleNazivChange(e.target.value)} disabled={isEditing} className={`w-full p-4 rounded-xl text-sm text-theme-text uppercase font-black outline-none shadow-inner ${isEditing ? 'bg-theme-panel border border-theme-border opacity-50 cursor-not-allowed' : 'bg-theme-panel border border-amber-500/50 focus:border-amber-400'}`} />
                        </div>
                        <div><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">PDV Broj</label><input value={form.pdv} onChange={e=>setForm({...form, pdv:e.target.value})} className="w-full p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border focus:border-amber-500 shadow-inner" /></div>
                        <div><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Adresa / Lokacija</label><input value={form.adresa} onChange={e=>setForm({...form, adresa:e.target.value})} className="w-full p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border focus:border-amber-500 shadow-inner" /></div>
                        <div className="md:col-span-2 mt-2">
                            <label className="text-[10px] text-amber-500 uppercase ml-2 block mb-2 font-black">🌟 UKUPNI RABAT NA SVE PROIZVODE (%)</label>
                            <input type="number" value={form.ukupni_rabat} onChange={e=>setForm({...form, ukupni_rabat:e.target.value})} className="w-full p-4 bg-amber-900/20 rounded-xl text-lg text-amber-400 font-black outline-none border border-amber-500/50 focus:border-amber-400 text-center shadow-inner" placeholder="0" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* RABAT PROIZVODI */}
                        <div className="bg-theme-panel p-4 rounded-2xl border border-theme-border shadow-inner flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase font-black mb-3 block">Specifični Rabat po Proizvodu (%)</span>
                            <div className="flex gap-2 items-end mb-3">
                                <div className="flex-1"><KatalogSearchableDetail katalog={katalog} value={tempP_sifra} onChange={setTempP_sifra} /></div>
                                <input type="number" value={tempP_rabat} onChange={e=>setTempP_rabat(e.target.value)} placeholder="%" className="w-16 p-3 bg-theme-card rounded-xl text-xs text-theme-text border border-theme-border text-center focus:border-amber-500 outline-none font-black" />
                                <button onClick={addR_Proizvod} className="bg-theme-accent text-theme-text px-4 py-3 rounded-xl font-black text-xs hover:opacity-80 shadow-md">+</button>
                            </div>
                            <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-[150px] max-h-[250px]">
                                {rabatiProizvodi.map((r, i) => {
                                    const proizvod = katalog.find(k => k.sifra === r.sifra);
                                    return (
                                        <div key={i} className="text-[10px] text-blue-300 bg-blue-900/20 p-3 rounded-xl flex justify-between items-center border border-blue-500/30 shadow-sm">
                                            <div className="flex-1">
                                                <span className="font-black text-theme-text text-xs uppercase">{r.sifra}</span>
                                                {proizvod && (<div className="text-[9px] text-slate-400 mt-1"><span className="text-blue-400 font-bold uppercase">{proizvod.naziv}</span><br />Dim: {proizvod.visina}x{proizvod.sirina}x{proizvod.duzina} | <span className="text-theme-text font-bold">{proizvod.cijena} KM</span>/{proizvod.default_jedinica}</div>)}
                                            </div>
                                            <div className="flex items-center gap-3 ml-2">
                                                <span className="font-black text-amber-400 text-lg bg-black/40 px-2 py-1 rounded">{r.rabat}%</span>
                                                <button onClick={()=>remR_Proizvod(i)} className="text-red-500 hover:text-red-400 font-black px-3 py-2 bg-red-900/30 hover:bg-red-900/50 rounded-lg transition-colors">✕</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* RABAT KATEGORIJE */}
                        <div className="bg-theme-panel p-4 rounded-2xl border border-theme-border shadow-inner flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase font-black mb-3 block">Rabat po Kategoriji (%)</span>
                            <div className="flex gap-2 items-end mb-3">
                                <div className="flex-1"><SettingsSearchable value={tempK_kat} onChange={setTempK_kat} list={jedinstveneKategorije} placeholder="Pronađi kat..." /></div>
                                <input type="number" value={tempK_rabat} onChange={e=>setTempK_rabat(e.target.value)} placeholder="%" className="w-16 p-3 bg-theme-card rounded-xl text-xs text-theme-text border border-theme-border text-center focus:border-amber-500 outline-none font-black" />
                                <button onClick={addR_Kategorija} className="bg-purple-600 border-purple-400 border text-theme-text px-4 py-3 rounded-xl font-black text-xs hover:bg-purple-500 shadow-md">+</button>
                            </div>
                            <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-[150px] max-h-[250px]">
                                {rabatiKategorije.map((r, i) => (
                                    <div key={i} className="text-[10px] text-purple-300 bg-purple-900/20 p-4 rounded-xl flex justify-between items-center border border-purple-500/30 shadow-sm">
                                        <span>Kat: <b className="text-theme-text text-xs uppercase">{r.kategorija}</b></span>
                                        <div className="flex items-center gap-3">
                                            <span className="font-black text-amber-400 text-lg bg-black/40 px-2 py-1 rounded">{r.rabat}%</span>
                                            <button onClick={()=>remR_Kategorija(i)} className="text-red-500 hover:text-red-400 font-black px-3 py-2 bg-red-900/30 hover:bg-red-900/50 rounded-lg transition-colors">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <button onClick={snimiKupca} className={`w-full py-5 text-theme-text font-black rounded-xl uppercase text-sm shadow-xl mt-6 transition-all border ${isEditing ? 'bg-amber-600 hover:bg-amber-500 border-amber-400' : 'bg-theme-accent hover:opacity-80 border-blue-400'}`}>{isEditing ? '✅ Ažuriraj Kupca' : '➕ Snimi Kupca u Bazu'}</button>
                </div>
            </div>

            <div className="lg:col-span-5 bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-theme-border shadow-2xl">
                <h3 className="text-[10px] text-slate-400 font-black uppercase mb-4 tracking-widest">Lista Kupaca ({kupci.length})</h3>
                <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
                    {kupci.length === 0 && <p className="text-center text-slate-500 text-xs py-10 border-2 border-dashed border-theme-border rounded-xl">Nema unesenih kupaca.</p>}
                    {kupci.map(k => (
                        <div key={k.id} onClick={() => pokreniIzmjenu(k)} className={`flex justify-between items-center p-4 rounded-2xl cursor-pointer transition-all shadow-sm border ${isEditing && form.id === k.id ? 'bg-amber-900/20 border-amber-500/50' : 'bg-theme-panel border-theme-border hover:border-amber-500/50'}`}>
                            <div>
                                <p className="text-theme-text text-sm font-black uppercase">{k.naziv}</p>
                                <p className="text-[9px] text-slate-400 uppercase mt-2 font-bold tracking-widest leading-relaxed">
                                    Ukupni Rabat: <b className="text-amber-400 text-xs ml-1">{k.rabati_jsonb?.ukupni || 0}%</b> <br/> 
                                    Spec. proizvoda: <span className="text-theme-text">{Object.keys(k.rabati_jsonb?.proizvodi || {}).length}</span> | Kategorija: <span className="text-theme-text">{Object.keys(k.rabati_jsonb?.kategorije || {}).length}</span>
                                </p>
                            </div>
                            <button onClick={(e)=>obrisiKupca(k.id, k.naziv, e)} className="text-red-400 font-black px-4 py-3 bg-red-900/20 hover:bg-red-500 hover:text-theme-text rounded-xl transition-all shadow-sm text-xs ml-2">✕</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function TabRadnici() {
    const [radnici, setRadnici] = useState([]);
    const [editId, setEditId] = useState(null); 
    const [form, setForm] = useState({ ime_prezime: '', username: '', password: '', uloga: 'operater', bruto_satnica: '', preostalo_godisnjeg: 20, dozvole: [] });

    const sviModuli = [
        'Prijem trupaca', 'Prorez (Trupci)', 'Pilana (Izlaz)', 'Dorada (Ulaz/Izlaz)', 
        'Ponude', 'Radni Nalozi', 'Otpremnice', 'Računi', 'Blagajna (Keš)', 'Kontrolni Toranj',
        'LAGER PAKETA', 'Analitika', 'Podešavanja', 'Baza Kupaca (Edit)', 'Katalog Proizvoda (Edit)'
    ];

    useEffect(() => { load(); }, []);
    const load = async () => { const {data} = await supabase.from('radnici').select('*').order('ime_prezime'); setRadnici(data||[]); };

    const toggleDozvola = (modul) => {
        setForm(prev => {
            const imaDozvolu = prev.dozvole.includes(modul);
            return { ...prev, dozvole: imaDozvolu ? prev.dozvole.filter(m => m !== modul) : [...prev.dozvole, modul] };
        });
    };

    const pokreniEdit = (r) => {
        setForm({ ime_prezime: r.ime_prezime, username: r.username, password: r.password, uloga: r.uloga, bruto_satnica: r.bruto_satnica, preostalo_godisnjeg: r.preostalo_godisnjeg, dozvole: r.dozvole || [] });
        setEditId(r.id); window.scrollTo({ top: 0, behavior: 'smooth' }); 
    };

    const ponistiEdit = () => { setForm({ ime_prezime: '', username: '', password: '', uloga: 'operater', bruto_satnica: '', preostalo_godisnjeg: 20, dozvole: [] }); setEditId(null); };

    const snimi = async () => {
        if(!form.ime_prezime || !form.username || !form.password) return alert("Popuni Ime, Username i Password!");
        if(form.dozvole.length === 0 && !window.confirm("Radniku niste dodijelili nijednu dozvolu. Da li ste sigurni?")) return;
        
        if (editId) {
            const { data: userPostoji } = await supabase.from('radnici').select('id').ilike('username', form.username).neq('id', editId).maybeSingle();
            if(userPostoji) return alert("Upozorenje: Ovaj username već koristi drugi radnik!");
        } else {
            const { data: userPostoji } = await supabase.from('radnici').select('id').ilike('username', form.username).maybeSingle();
            if(userPostoji) return alert("Upozorenje: Ovaj username je već zauzet!");
        }

        const payload = { ime_prezime: form.ime_prezime, username: form.username.toLowerCase(), password: form.password, uloga: form.uloga, bruto_satnica: parseFloat(form.bruto_satnica)||0, preostalo_godisnjeg: parseInt(form.preostalo_godisnjeg)||0, dozvole: form.dozvole };

        if (editId) {
            const { error } = await supabase.from('radnici').update(payload).eq('id', editId);
            if(error) return alert("Greška pri ažuriranju: " + error.message); alert("Radnik uspješno ažuriran!");
        } else {
            const { error } = await supabase.from('radnici').insert([payload]);
            if(error) return alert("Greška pri kreiranju: " + error.message); alert("Radnik uspješno kreiran!"); 
        }
        ponistiEdit(); load();
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in">
            <div className="lg:col-span-5 space-y-6">
                <div className={`p-6 rounded-box border shadow-2xl transition-all ${editId ? 'bg-blue-900/10 border-blue-500/50' : 'bg-theme-card backdrop-blur-[var(--glass-blur)] border-theme-border'}`}>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-blue-500 font-black uppercase text-xs tracking-widest">{editId ? `✏️ Uređivanje: ${form.ime_prezime}` : `👷‍♂️ Dodaj Novog Radnika`}</h3>
                        {editId && <button onClick={ponistiEdit} className="text-red-400 hover:text-theme-text text-[10px] font-black uppercase bg-red-900/30 px-3 py-1.5 rounded-lg border border-red-500/30 transition-colors">✕ Poništi</button>}
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        <div><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* Ime i Prezime</label><input placeholder="npr. Džemal Ahmedbašić" value={form.ime_prezime} onChange={e=>setForm({...form, ime_prezime:e.target.value})} className="w-full p-4 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border focus:border-blue-500 font-black uppercase" /></div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Korisničko ime (Login)</label><input placeholder="dzemal" value={form.username} onChange={e=>setForm({...form, username:e.target.value})} className="w-full p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border focus:border-blue-500 lowercase font-mono" /></div>
                            <div><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Šifra (Lozinka)</label><input placeholder="***" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} className="w-full p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border focus:border-blue-500 font-mono" /></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Uloga</label><select value={form.uloga} onChange={e=>setForm({...form, uloga:e.target.value})} className="w-full p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border focus:border-blue-500 font-black uppercase cursor-pointer"><option value="operater">Operater</option><option value="admin">Šef (Admin)</option></select></div>
                            <div><label className="text-[8px] text-emerald-500 uppercase ml-2 block mb-1 font-black">Bruto satnica</label><input type="number" placeholder="KM/h" value={form.bruto_satnica} onChange={e=>setForm({...form, bruto_satnica:e.target.value})} className="w-full p-3 bg-emerald-900/10 rounded-xl text-xs text-emerald-400 outline-none border border-emerald-500/30 focus:border-emerald-400 text-center font-black" /></div>
                            <div><label className="text-[8px] text-blue-400 uppercase ml-2 block mb-1 font-black">Godišnji odmor</label><input type="number" placeholder="Dani" value={form.preostalo_godisnjeg} onChange={e=>setForm({...form, preostalo_godisnjeg:e.target.value})} className="w-full p-3 bg-blue-900/10 rounded-xl text-xs text-blue-400 outline-none border border-blue-500/30 focus:border-blue-400 text-center font-black" /></div>
                        </div>

                        <div className="mt-4 bg-theme-panel p-4 rounded-2xl border border-theme-border shadow-inner">
                            <label className="text-[10px] text-slate-400 uppercase font-black mb-3 block">🔐 Odobreni Moduli (Dozvole pristupa):</label>
                            <div className="flex flex-wrap gap-2">
                                {sviModuli.map(modul => {
                                    const aktivan = form.dozvole.includes(modul);
                                    return (
                                        <button key={modul} onClick={() => toggleDozvola(modul)} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${aktivan ? 'bg-emerald-600 border-emerald-400 text-theme-text shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-theme-card border-theme-border text-slate-500 hover:border-slate-500'}`}>
                                            {aktivan ? '✓ ' : '+ '} {modul}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <button onClick={snimi} className="w-full py-5 mt-6 bg-theme-accent text-theme-text font-black rounded-xl uppercase text-sm shadow-xl hover:opacity-80 transition-all">{editId ? '✅ Ažuriraj Radnika' : '✅ Snimi Novog Radnika'}</button>
                </div>
            </div>

            <div className="lg:col-span-7 bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-theme-border shadow-2xl">
                <h3 className="text-[10px] text-slate-400 font-black uppercase mb-4 tracking-widest">Svi Radnici u sistemu ({radnici.length})</h3>
                <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
                    {radnici.length === 0 && <p className="text-center text-slate-500 text-xs py-10 border-2 border-dashed border-theme-border rounded-xl">Nema unesenih radnika.</p>}
                    {radnici.map(r => (
                        <div key={r.id} className={`flex flex-col md:flex-row justify-between md:items-start p-5 border rounded-2xl gap-4 transition-all shadow-sm ${editId === r.id ? 'bg-blue-900/10 border-blue-500/50' : 'bg-theme-panel border-theme-border hover:border-slate-500'}`}>
                            <div className="flex-1">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-theme-card rounded-xl border border-theme-border flex items-center justify-center font-black text-lg text-theme-accent">{r.ime_prezime.charAt(0)}</div>
                                    <div>
                                        <p className="text-theme-text text-base font-black uppercase">{r.ime_prezime}</p>
                                        <p className="text-slate-500 text-[10px] font-bold mt-0.5">@{r.username}</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 mt-4 text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                                    <span className={`px-2 py-1 rounded border shadow-sm ${r.uloga === 'admin' ? 'bg-amber-900/30 text-amber-500 border-amber-500/30' : 'bg-blue-900/30 text-blue-400 border-blue-500/30'}`}>{r.uloga}</span>
                                    <span>Satnica: <b className="text-emerald-400 text-xs ml-1">{r.bruto_satnica} KM</b></span>
                                    <span className="opacity-50">|</span>
                                    <span>Godišnji: <b className="text-blue-400 text-xs ml-1">{r.preostalo_godisnjeg} d</b></span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-theme-border/50">
                                    {(r.dozvole || []).length === 0 ? ( <span className="text-[8px] text-red-500 font-bold italic">NEMA DOZVOLA</span> ) : ( (r.dozvole || []).map(d => ( <span key={d} className="text-[8px] text-emerald-400 bg-emerald-900/10 border border-emerald-500/30 px-2 py-1 rounded uppercase font-black shadow-sm">{d}</span> )) )}
                                </div>
                            </div>
                            <div className="flex md:flex-col gap-2 w-full md:w-auto">
                                <button onClick={() => pokreniEdit(r)} className="flex-1 md:flex-none text-blue-400 font-black px-4 py-3 bg-blue-900/20 hover:bg-blue-600 hover:text-theme-text rounded-xl transition-all border border-blue-500/30 uppercase text-[10px] shadow-sm">✎ Uredi</button>
                                <button onClick={async()=>{if(window.confirm(`Da li ste sigurni da zelite obrisati radnika ${r.ime_prezime}?`)){await supabase.from('radnici').delete().eq('id', r.id); load();}}} className="flex-1 md:flex-none text-red-400 font-black px-4 py-3 bg-red-900/20 hover:bg-red-600 hover:text-theme-text rounded-xl transition-all border border-red-500/30 uppercase text-[10px] shadow-sm">✕ Obriši</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function TabKategorijeBlagajne() {
    const [kategorije, setKategorije] = useState([]);
    const [form, setForm] = useState({ tip: 'ULAZ', naziv: '' });

    useEffect(() => { load(); }, []);
    const load = async () => { const {data} = await supabase.from('blagajna_kategorije').select('*').order('tip'); setKategorije(data||[]); };

    const dodajKategoriju = async () => {
        if(!form.naziv) return alert("Unesi naziv kategorije!");
        await supabase.from('blagajna_kategorije').insert([form]); setForm({...form, naziv: ''}); load();
    };

    const obrisiKategoriju = async (id, naziv) => {
        if(window.confirm(`Obrisati kategoriju ${naziv}?`)){ await supabase.from('blagajna_kategorije').delete().eq('id', id); load(); }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in max-w-5xl mx-auto">
            <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-theme-border shadow-2xl space-y-6">
                <h3 className="text-emerald-400 font-black uppercase text-xs">🗂️ Dodaj Kategoriju (Blagajna)</h3>
                <div className="flex flex-col gap-4">
                    <select value={form.tip} onChange={e=>setForm({...form, tip:e.target.value})} className="p-4 bg-theme-panel rounded-xl text-theme-text font-black outline-none border border-theme-border cursor-pointer uppercase text-sm focus:border-emerald-500"><option value="ULAZ">📈 ULAZ (Prihodi)</option><option value="IZLAZ">📉 IZLAZ (Troškovi)</option></select>
                    <input value={form.naziv} onChange={e=>setForm({...form, naziv:e.target.value})} onKeyDown={e=>{if(e.key==='Enter') dodajKategoriju()}} placeholder="Npr. Kupovina alata..." className="w-full p-4 bg-theme-panel rounded-xl text-theme-text outline-none border border-theme-border text-sm font-bold focus:border-emerald-500" />
                    <button onClick={dodajKategoriju} className="w-full bg-emerald-600 py-4 rounded-xl text-theme-text font-black hover:bg-emerald-500 shadow-lg uppercase text-xs">➕ Dodaj Kategoriju</button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
                {['ULAZ', 'IZLAZ'].map(tip => (
                    <div key={tip} className="bg-theme-card p-6 rounded-box border border-theme-border shadow-xl">
                        <h4 className={`text-xs uppercase font-black mb-4 border-b border-theme-border pb-2 ${tip==='ULAZ'?'text-emerald-500':'text-red-500'}`}>Kategorije za {tip}</h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                            {kategorije.filter(k=>k.tip===tip).map(k => (
                                <div key={k.id} className="flex justify-between items-center p-3 bg-theme-panel rounded-xl border border-theme-border hover:border-slate-500 transition-colors shadow-sm">
                                    <span className="text-xs text-theme-text font-bold uppercase">{k.naziv}</span>
                                    <button onClick={()=>obrisiKategoriju(k.id, k.naziv)} className="text-red-400 bg-red-900/20 px-3 py-1.5 rounded-lg font-black hover:text-theme-text hover:bg-red-500 transition-all text-[10px] uppercase">✕ Obriši</button>
                                </div>
                            ))}
                            {kategorije.filter(k=>k.tip===tip).length === 0 && <p className="text-center text-xs text-slate-500 italic py-4">Nema kategorija.</p>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TabBrending() {
    const [logotipi, setLogotipi] = useState([]);
    const [form, setForm] = useState({ id: null, naziv: '', url_slike: '', lokacije_jsonb: [], full_width: false });
    const [isEditing, setIsEditing] = useState(false);
    const [fajlSlike, setFajlSlike] = useState(null);
    const [uploading, setUploading] = useState(false);

    const [firmaInfo, setFirmaInfo] = useState({ 
        adresa: '', telefon: '', email: '', 
        footer_tekst: '', footer_boja: '#64748b', footer_velicina: '12',
        app_name: 'SmartERP' // NOVO ZA IME APP
    });

    // OVDJE JE DODANA OPCIJA ZA SIDEBAR
    const opcijeLokacija = ['Ikona u pregledniku (Favicon)', 'GLAVNI MENI / SIDEBAR (GORE LIJEVO)', 'Svi PDF Dokumenti', 'PDF Ponuda', 'PDF Radni Nalog', 'PDF Otpremnica', 'PDF Račun', 'PDF Blagajna'];

    useEffect(() => { load(); }, []);
    
    const load = async () => { 
        const { data } = await supabase.from('brending').select('*').order('naziv'); 
        setLogotipi(data || []); 
        
        const { data: fData } = await supabase.from('postavke_firme').select('*').eq('id', 1).maybeSingle();
        if (fData) {
            setFirmaInfo({
                adresa: fData.adresa || '', 
                telefon: fData.telefon || '', 
                email: fData.email || '', 
                footer_tekst: fData.footer_tekst || '', 
                footer_boja: fData.footer_boja || '#64748b', 
                footer_velicina: fData.footer_velicina || '12',
                app_name: localStorage.getItem('saas_app_name') || 'SmartERP' // Ime je uvijek iz lokala kao prioritet
            });
        } else {
            setFirmaInfo(prev => ({...prev, app_name: localStorage.getItem('saas_app_name') || 'SmartERP'}));
        }
    };

    const spasiFirmuInfo = async () => {
        // Ime aplikacije (Sidebar tekst) spašavamo direktno u memoriju i opaljujemo signal!
        localStorage.setItem('saas_app_name', firmaInfo.app_name);
        window.dispatchEvent(new Event('saas_updated'));

        const { error } = await supabase.from('postavke_firme').upsert({ id: 1, adresa: firmaInfo.adresa, telefon: firmaInfo.telefon, email: firmaInfo.email, footer_tekst: firmaInfo.footer_tekst, footer_boja: firmaInfo.footer_boja, footer_velicina: firmaInfo.footer_velicina });
        if (error) {
            alert("Greška pri spašavanju baze: " + error.message);
        } else {
            alert("✅ Podaci o firmi i Naziv Aplikacije uspješno spašeni!\n(Sidebar se automatski osvježio)");
        }
    };

    const toggleLokacija = (lok) => { setForm(prev => ({...prev, lokacije_jsonb: prev.lokacije_jsonb.includes(lok) ? prev.lokacije_jsonb.filter(l => l !== lok) : [...prev.lokacije_jsonb, lok] })); };
    const pokreniIzmjenu = (l) => { setForm({ id: l.id, naziv: l.naziv, url_slike: l.url_slike, lokacije_jsonb: l.lokacije_jsonb || [], full_width: l.full_width || false }); setFajlSlike(null); setIsEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const ponisti = () => { setForm({ id: null, naziv: '', url_slike: '', lokacije_jsonb: [], full_width: false }); setFajlSlike(null); setIsEditing(false); };
    
    const uploadISnimi = async () => {
        if(!form.naziv) return alert("Naziv je obavezan!");
        if(!form.url_slike && !fajlSlike) return alert("Odaberite sliku!");
        setUploading(true);
        let finalUrl = form.url_slike;

        if (fajlSlike) {
            const fileExt = fajlSlike.name.split('.').pop();
            const fileName = `logo_${Date.now()}.${fileExt}`; 
            const { error: uploadError } = await supabase.storage.from('slike').upload(fileName, fajlSlike);
            if (uploadError) { setUploading(false); return alert("Greška pri uploadu: " + uploadError.message); }
            const { data: publicUrlData } = supabase.storage.from('slike').getPublicUrl(fileName);
            finalUrl = publicUrlData.publicUrl;
        }

        const payload = { naziv: form.naziv, url_slike: finalUrl, lokacije_jsonb: form.lokacije_jsonb, full_width: form.full_width };
        if(isEditing) await supabase.from('brending').update(payload).eq('id', form.id);
        else await supabase.from('brending').insert([payload]);
        
        // AKO JE ODABRAN SIDEBAR, ODMAH SPASI U LOKALNU MEMORIJU I OSVJEZI EKRAN!
        if (form.lokacije_jsonb.includes('GLAVNI MENI / SIDEBAR (GORE LIJEVO)')) {
            localStorage.setItem('saas_app_logo', finalUrl);
        } else {
            if (localStorage.getItem('saas_app_logo') === finalUrl) {
                localStorage.setItem('saas_app_logo', '');
            }
        }
        window.dispatchEvent(new Event('saas_updated'));

        setUploading(false); ponisti(); load();
        alert("✅ Brending uspješno snimljen!");
    };

    const obrisi = async (id, naziv, slikaUrl, e) => { 
        e.stopPropagation(); 
        if(window.confirm(`Trajno obrisati logo: ${naziv}?`)) { 
            await supabase.from('brending').delete().eq('id', id); 
            // Ako je obrisan sidebar logo, skloni ga sa ekrana
            if (localStorage.getItem('saas_app_logo') === slikaUrl) {
                localStorage.setItem('saas_app_logo', '');
                window.dispatchEvent(new Event('saas_updated'));
            }
            load(); 
        } 
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
            
            <div className="space-y-6">
                {/* 1. KARTICA: IME APLIKACIJE I FIRMA */}
                <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-blue-500/30 shadow-2xl space-y-6">
                    <div>
                        <h3 className="text-blue-500 font-black uppercase text-xs border-b border-theme-border pb-2 mb-4">🖥️ Naziv Aplikacije (Glavni Meni / Sidebar)</h3>
                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Tekst koji se prikazuje ako nema logotipa (Gore Lijevo)</label>
                        <input value={firmaInfo.app_name} onChange={e=>setFirmaInfo({...firmaInfo, app_name:e.target.value})} onKeyDown={e=>{if(e.key==='Enter') spasiFirmuInfo()}} className="w-full p-4 bg-theme-panel rounded-xl text-lg text-theme-text font-black outline-none border border-theme-border focus:border-blue-500 uppercase tracking-widest shadow-inner" placeholder="Npr. Pilana ERP..." />
                    </div>

                    <div className="pt-4 border-t border-theme-border">
                        <h3 className="text-blue-500 font-black uppercase text-xs border-b border-theme-border pb-2 mb-4">🏢 Podaci o firmi (Za PDF Izvještaje)</h3>
                        <div className="grid grid-cols-1 gap-4">
                            <div><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Adresa Firme</label><input value={firmaInfo.adresa} onChange={e=>setFirmaInfo({...firmaInfo, adresa:e.target.value})} className="w-full p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border focus:border-blue-500" placeholder="Rijeka bb, 75328..." /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Telefon</label><input value={firmaInfo.telefon} onChange={e=>setFirmaInfo({...firmaInfo, telefon:e.target.value})} className="w-full p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border focus:border-blue-500" placeholder="+387 61..." /></div>
                                <div><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Email</label><input value={firmaInfo.email} onChange={e=>setFirmaInfo({...firmaInfo, email:e.target.value})} className="w-full p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border focus:border-blue-500" placeholder="info@..." /></div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-theme-border">
                        <h4 className="text-[10px] text-amber-500 font-black uppercase mb-3">📝 Prilagođeni tekst u dnu PDF-a (Footer)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            <div className="md:col-span-8">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Tekst (npr. Vaš partner za drvo...)</label>
                                <input value={firmaInfo.footer_tekst} onChange={e=>setFirmaInfo({...firmaInfo, footer_tekst:e.target.value})} className="w-full p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border focus:border-amber-500" placeholder="Unesite tekst u dnu PDF-a..." />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Boja Teksta</label>
                                <div className="flex bg-theme-panel rounded-xl border border-theme-border p-1 items-center h-[42px]">
                                    <input type="color" value={firmaInfo.footer_boja} onChange={e=>setFirmaInfo({...firmaInfo, footer_boja:e.target.value})} className="w-full h-full cursor-pointer rounded bg-transparent border-none" />
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Veličina (px)</label>
                                <input type="number" value={firmaInfo.footer_velicina} onChange={e=>setFirmaInfo({...firmaInfo, footer_velicina:e.target.value})} className="w-full p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border focus:border-amber-500 text-center" placeholder="12" />
                            </div>
                        </div>
                        {firmaInfo.footer_tekst && (
                            <div className="mt-4 p-4 bg-theme-panel rounded-xl text-center border border-theme-border shadow-inner">
                                <span className="text-[8px] text-slate-500 uppercase block mb-2 font-black">Uživo pregled teksta:</span>
                                <span style={{ color: firmaInfo.footer_boja, fontSize: `${firmaInfo.footer_velicina}px` }}>{firmaInfo.footer_tekst}</span>
                            </div>
                        )}
                    </div>

                    <button onClick={spasiFirmuInfo} className="w-full py-4 bg-theme-accent text-theme-text font-black rounded-xl text-xs uppercase shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:opacity-80 transition-all mt-6 tracking-widest">💾 Spasi i Sinhronizuj Aplikaciju</button>
                </div>
            </div>

            <div className="space-y-6">
                {/* 2. KARTICA: LOGO UPLOADER */}
                <div className={`p-6 rounded-box border shadow-2xl space-y-4 transition-all ${isEditing ? 'bg-amber-950/30 border-amber-500' : 'bg-theme-card backdrop-blur-[var(--glass-blur)] border-theme-border'}`}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className={`${isEditing ? 'text-amber-500' : 'text-blue-500'} font-black uppercase text-xs`}>
                            {isEditing ? `✏️ Uređivanje: ${form.naziv}` : `🎨 Dodaj Novi Logo / Memorandum`}
                        </h3>
                        {isEditing && <button onClick={ponisti} className="text-red-400 hover:text-theme-text text-[10px] font-black uppercase bg-red-900/30 px-3 py-1.5 rounded-lg transition-all border border-red-500/30 shadow-sm">✕ Poništi</button>}
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* Naziv Logotipa (npr. Glavni Logo)</label>
                            <input value={form.naziv} onChange={e=>setForm({...form, naziv:e.target.value})} className="w-full p-4 bg-theme-panel rounded-xl text-sm text-theme-text outline-none border border-theme-border focus:border-blue-500 font-bold shadow-inner" placeholder="Unesite naziv..." />
                        </div>
                        
                        <div className="bg-theme-panel p-4 rounded-2xl border border-theme-border shadow-inner">
                            <label className="text-[10px] text-theme-accent uppercase font-black mb-3 block">1. Odaberi sliku sa računara:</label>
                            <input type="file" accept="image/png, image/jpeg, image/webp, image/svg+xml, image/x-icon" onChange={e=>setFajlSlike(e.target.files[0])} className="w-full text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-theme-accent file:text-theme-text hover:file:opacity-80 cursor-pointer shadow-sm" />
                            
                            <div className="mt-4 border-t border-theme-border/50 pt-4">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">...ILI unesi web link do slike (opciono)</label>
                                <input value={form.url_slike} onChange={e=>setForm({...form, url_slike:e.target.value})} placeholder="https://..." className="w-full p-3 bg-theme-card rounded-xl text-xs text-slate-400 font-mono outline-none border border-theme-border focus:border-blue-500" disabled={!!fajlSlike} />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-theme-border mt-2">
                            <label className="text-[10px] text-slate-400 uppercase font-black mb-4 block">📍 2. Odaberi gdje se ovaj logo prikazuje:</label>
                            <div className="flex flex-wrap gap-2">
                                {opcijeLokacija.map(lok => {
                                    const aktivan = form.lokacije_jsonb.includes(lok);
                                    return (
                                        <button key={lok} onClick={() => toggleLokacija(lok)} className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all border shadow-sm ${aktivan ? 'bg-emerald-600 border-emerald-400 text-theme-text shadow-[0_0_15px_rgba(16,185,129,0.4)] scale-[1.02]' : 'bg-theme-panel border-theme-border text-slate-400 hover:border-slate-500 hover:text-slate-300'}`}>
                                            {aktivan ? '✓ ' : '+ '} {lok}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-theme-panel p-4 rounded-xl border border-theme-border flex items-center justify-between mt-4 cursor-pointer hover:border-blue-500/50 transition-all shadow-inner" onClick={() => setForm({...form, full_width: !form.full_width})}>
                            <div>
                                <p className="text-theme-text font-black text-xs uppercase">Prikaz preko cijele širine (Baner)</p>
                                <p className="text-[9px] text-slate-500 mt-1">Ako je uključeno, PDF ga rasteže od ivice do ivice papira.</p>
                            </div>
                            <div className={`w-12 h-6 rounded-box p-1 transition-all ${form.full_width ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`}>
                                <div className={`w-4 h-4 bg-white rounded-box transition-all shadow-sm ${form.full_width ? 'translate-x-6' : ''}`}></div>
                            </div>
                        </div>
                    </div>
                    
                    {(form.url_slike || fajlSlike) && (
                        <div className="mt-6 p-6 bg-theme-panel rounded-2xl border border-theme-border flex justify-center shadow-inner relative min-h-[120px] items-center">
                            <span className="absolute top-3 left-4 text-[8px] uppercase text-slate-500 font-black tracking-widest">Pregled Logotipa</span>
                            {fajlSlike ? (
                                <img src={URL.createObjectURL(fajlSlike)} alt="Preview" className="max-h-24 max-w-full object-contain drop-shadow-xl" />
                            ) : (
                                <img src={form.url_slike} alt="Preview" className="max-h-24 max-w-full object-contain drop-shadow-xl" />
                            )}
                        </div>
                    )}
                    
                    <button onClick={uploadISnimi} disabled={uploading} className={`w-full py-5 mt-6 text-theme-text font-black rounded-2xl uppercase text-sm shadow-xl transition-all tracking-widest ${uploading ? 'bg-slate-600 cursor-not-allowed' : (isEditing ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500')}`}>
                        {uploading ? '⏳ Šaljem na server...' : (isEditing ? '✅ Sačuvaj Izmjene' : '✅ Pohrani Novi Logo')}
                    </button>
                </div>

                {/* 3. KARTICA: LISTA LOGOTIPA */}
                <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-theme-border shadow-xl">
                    <h3 className="text-slate-400 font-black uppercase text-[10px] mb-5 tracking-widest">Trenutni Logotipi u Sistemu (Klikni za izmjenu)</h3>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {logotipi.length === 0 && <p className="text-center text-slate-500 text-xs py-8 font-bold border-2 border-dashed border-theme-border rounded-2xl">Još nema dodanih slika.</p>}
                        
                        {logotipi.map(l => (
                            <div key={l.id} onClick={() => pokreniIzmjenu(l)} className={`flex flex-col md:flex-row justify-between items-start md:items-center p-4 rounded-2xl cursor-pointer transition-all border shadow-sm ${isEditing && form.id === l.id ? 'bg-amber-900/20 border-amber-500/50' : 'bg-theme-panel border-theme-border hover:border-blue-500/50'}`}>
                                <div className="flex items-center gap-5 w-full md:w-auto">
                                    <div className="w-20 h-20 bg-theme-card rounded-xl flex items-center justify-center p-2 border border-theme-border shrink-0 shadow-inner">
                                        <img src={l.url_slike} className="max-h-full max-w-full object-contain drop-shadow-md" alt={l.naziv} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-theme-text text-sm font-black uppercase">{l.naziv}</p>
                                        <div className="flex flex-wrap gap-1.5 mt-3">
                                            {l.full_width && <span className="text-[8px] bg-emerald-900/50 text-emerald-400 border border-emerald-500/50 px-2 py-1 rounded font-black uppercase shadow-sm">Baner Prikaz</span>}
                                            {(l.lokacije_jsonb || []).length === 0 && <span className="text-[8px] text-slate-500 italic font-bold">Nije dodijeljen nijednoj lokaciji</span>}
                                            {(l.lokacije_jsonb || []).map(lok => (
                                                <span key={lok} className="text-[8px] bg-blue-900/30 text-blue-400 border border-blue-500/30 px-2 py-1 rounded font-black uppercase shadow-sm">
                                                    {lok}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 md:mt-0 flex gap-2 self-end md:self-auto ml-2">
                                    <button onClick={(e) => obrisi(l.id, l.naziv, l.url_slike, e)} className="text-red-400 font-black px-4 py-3 bg-red-900/20 hover:bg-red-600 hover:text-theme-text rounded-xl transition-all border border-red-500/30 text-[10px] uppercase shadow-sm">✕ Obriši</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );
}

export default function SettingsModule({ onExit, lockedTab }) {
    const [tab, setTab] = useState(lockedTab || 'sumarije');
    const tabs = ['sumarije', 'prevoznici', 'masine', 'katalog', 'kupci', 'radnici', 'blagajna', 'brending'];
    const labels = { sumarije: '🌲 Šumarije', prevoznici: '🚚 Prevoznici', masine: '⚙️ Mašine', katalog: '📦 Katalog', kupci: '🤝 Kupci', radnici: '👷 Radnici', blagajna: '🗂️ Kase / Kat.', brending: '🎨 Brending (SaaS)' };

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center bg-theme-card backdrop-blur-[var(--glass-blur)] p-4 rounded-[2rem] border border-theme-border shadow-xl gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={onExit} className={`text-[10px] px-5 py-3 rounded-xl uppercase font-black text-theme-text transition-all shadow-md ${lockedTab ? 'bg-red-600 hover:bg-red-500' : 'bg-theme-panel border border-theme-border hover:bg-slate-700'}`}>
                        {lockedTab ? '✕ ZATVORI I NASTAVI RAD' : '← Nazad u Meni'}
                    </button>
                    <h2 className={`${lockedTab ? 'text-amber-500' : 'text-slate-400'} font-black tracking-widest uppercase text-xs md:text-sm hidden md:block`}>
                        {lockedTab ? '⚡ BRZI UNOS PODATAKA' : '⚙️ ERP CENTRALNE POSTAVKE'}
                    </h2>
                </div>
                
                {!lockedTab && (
                    <div className="flex flex-wrap gap-2 justify-center bg-theme-panel p-2 rounded-2xl border border-theme-border shadow-inner">
                        {tabs.map(t => (
                            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 rounded-xl transition-all text-[9px] tracking-widest uppercase font-black ${tab === t ? 'bg-theme-accent border border-blue-400 text-white shadow-md' : 'bg-transparent text-slate-400 hover:text-theme-text hover:bg-theme-card'}`}>
                                {labels[t]}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            
            {tab === 'sumarije' && <TabSumarije />}
            {tab === 'prevoznici' && <TabPrevoznici />}
            {tab === 'masine' && <TabMasine />}
            {tab === 'katalog' && <TabKatalog />}
            {tab === 'kupci' && <TabKupci />}
            {tab === 'radnici' && <TabRadnici />}
            {tab === 'blagajna' && <TabKategorijeBlagajne />}
            {tab === 'brending' && <TabBrending />}
        </div>
    );
}