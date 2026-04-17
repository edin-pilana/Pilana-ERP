"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://awaxwejrhmjeqohrgidm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY');

function SettingsSearchable({ label, value, onChange, list = [], placeholder="..." }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative font-black">
            {label && <label className="text-[8px] text-slate-500 uppercase ml-3 block mb-1">{label}</label>}
            <input type="text" value={value} onFocus={() => setOpen(true)} onChange={e => { onChange(e.target.value.toUpperCase()); setOpen(true); }} className="w-full p-3 bg-[#0f172a] border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-blue-500 uppercase" placeholder={placeholder} />
            {open && list.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-40 overflow-y-auto">
                    {list.filter(i => i.toUpperCase().includes(value.toUpperCase())).map((item, idx) => (
                        <div key={idx} onClick={() => { onChange(item); setOpen(false); }} className="p-3 text-[10px] border-b border-slate-700 hover:bg-blue-600 uppercase cursor-pointer text-white">{item}</div>
                    ))}
                    <div onClick={() => setOpen(false)} className="p-2 text-center text-[8px] text-slate-500 cursor-pointer hover:text-white">Zatvori</div>
                </div>
            )}
        </div>
    );
}

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

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]);
    };

    const handleSumChange = (val) => {
        const upperVal = val.toUpperCase();
        setFormSum({...formSum, naziv: upperVal});
        setWarningSum(null);
        if(timerSum.current) clearTimeout(timerSum.current);
        if(upperVal.length >= 2 && !isEditingSum) {
            timerSum.current = setTimeout(() => {
                const postoji = sumarije.find(s => s.naziv === upperVal);
                if(postoji) setWarningSum(postoji);
            }, 2000);
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
            await supabase.from('sumarije').delete().eq('id', id);
            await zapisiU_Log('BRISANJE_SUMARIJE', `Obrisana šumarija: ${naziv}`); load();
        }
    };

    const handlePodrChange = (val) => {
        const upperVal = val.toUpperCase();
        setFormPodr({...formPodr, naziv: upperVal});
        setWarningPodr(null);
        if(timerPodr.current) clearTimeout(timerPodr.current);
        if(upperVal.length >= 2 && formPodr.sumarija_naziv && !isEditingPodr) {
            timerPodr.current = setTimeout(() => {
                const postoji = podruznice.find(p => p.naziv === upperVal && p.sumarija_naziv === formPodr.sumarija_naziv);
                if(postoji) setWarningPodr(postoji);
            }, 2000);
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
        if(window.confirm(`Brisati podružnicu: ${naziv}?`)) {
            await supabase.from('podruznice').delete().eq('id', id);
            await zapisiU_Log('BRISANJE_PODRUZNICE', `Obrisana podružnica: ${naziv}`); load();
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
            <div className="space-y-4">
                <div className={`bg-[#1e293b] p-6 rounded-[2.5rem] border shadow-2xl space-y-4 transition-all ${isEditingSum ? 'border-amber-500/50' : 'border-slate-700'}`}>
                    <div className="flex justify-between items-center">
                        <h3 className={`${isEditingSum ? 'text-amber-500' : 'text-emerald-500'} font-black uppercase text-xs`}>{isEditingSum ? '✏️ Ažuriranje Šumarije' : '🌲 Dodaj Novu Šumariju'}</h3>
                        {isEditingSum && <button onClick={ponistiIzmjenuSum} className="text-xs text-red-500 font-black bg-red-900/20 px-3 py-1 rounded-xl hover:bg-red-500 hover:text-white transition-all">Odustani ✕</button>}
                    </div>
                    {warningSum && (
                        <div className="bg-amber-900/30 border border-amber-500/50 p-4 rounded-2xl space-y-2 animate-in zoom-in-95">
                            <h4 className="text-amber-500 font-black uppercase text-[10px]">⚠️ Šumarija već postoji!</h4>
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => pokreniIzmjenuSum(warningSum)} className="flex-1 bg-amber-600 text-white py-2 rounded-xl font-black text-[10px] uppercase hover:bg-amber-500">✏️ Ažuriraj</button>
                                <button onClick={() => { setFormSum({...formSum, naziv: ''}); setWarningSum(null); }} className="flex-1 bg-slate-700 text-white py-2 rounded-xl font-black text-[10px] uppercase hover:bg-slate-600">✕ Otkaži</button>
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* Pretraži ili unesi naziv šumarije</label>
                        <SettingsSearchable value={formSum.naziv} onChange={handleSumChange} list={sumarije.map(s=>s.naziv)} placeholder="Unesi naziv..." />
                    </div>
                    <button onClick={saveSumarija} className={`w-full py-4 text-white font-black rounded-xl text-xs shadow-lg uppercase transition-all ${isEditingSum ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>{isEditingSum ? '✅ Ažuriraj Šumariju' : '➕ Snimi Šumariju'}</button>
                </div>
                <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-xl">
                    <h3 className="text-slate-400 font-black uppercase text-[10px] mb-3">Lista Šumarija - Klikni za izmjenu</h3>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                        {sumarije.map(s => (
                            <div key={s.id} onClick={() => pokreniIzmjenuSum(s)} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-emerald-500/50 transition-all">
                                <span className="text-white text-xs font-black">{s.naziv}</span>
                                <button onClick={(e)=>{e.stopPropagation(); obrisiSumariju(s.id, s.naziv);}} className="text-red-500 font-black px-4 py-2 hover:bg-red-500/20 rounded-xl transition-all">✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className={`bg-[#1e293b] p-6 rounded-[2.5rem] border shadow-2xl space-y-4 transition-all ${isEditingPodr ? 'border-amber-500/50' : 'border-slate-700'}`}>
                    <div className="flex justify-between items-center">
                        <h3 className={`${isEditingPodr ? 'text-amber-500' : 'text-emerald-400'} font-black uppercase text-xs`}>{isEditingPodr ? '✏️ Ažuriranje Podružnice' : '🍃 Dodaj Podružnicu'}</h3>
                        {isEditingPodr && <button onClick={ponistiIzmjenuPodr} className="text-xs text-red-500 font-black bg-red-900/20 px-3 py-1 rounded-xl hover:bg-red-500 hover:text-white transition-all">Odustani ✕</button>}
                    </div>
                    {warningPodr && (
                        <div className="bg-amber-900/30 border border-amber-500/50 p-4 rounded-2xl space-y-2 animate-in zoom-in-95">
                            <h4 className="text-amber-500 font-black uppercase text-[10px]">⚠️ Podružnica već postoji u ovoj šumariji!</h4>
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => pokreniIzmjenuPodr(warningPodr)} className="flex-1 bg-amber-600 text-white py-2 rounded-xl font-black text-[10px] uppercase hover:bg-amber-500">✏️ Ažuriraj</button>
                                <button onClick={() => { setFormPodr({...formPodr, naziv: ''}); setWarningPodr(null); }} className="flex-1 bg-slate-700 text-white py-2 rounded-xl font-black text-[10px] uppercase hover:bg-slate-600">✕ Otkaži</button>
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
                    <button onClick={savePodruznica} className={`w-full py-4 text-white font-black rounded-xl text-xs shadow-lg uppercase transition-all ${isEditingPodr ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>{isEditingPodr ? '✅ Ažuriraj Podružnicu' : '➕ Snimi Podružnicu'}</button>
                </div>
                <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-xl">
                    <h3 className="text-slate-400 font-black uppercase text-[10px] mb-3">Lista Podružnica - Klikni za izmjenu</h3>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                        {podruznice.map(p => (
                            <div key={p.id} onClick={() => pokreniIzmjenuPodr(p)} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-emerald-500/50 transition-all">
                                <div><p className="font-black text-white text-xs">{p.naziv}</p><p className="text-[9px] text-emerald-500 uppercase mt-1">Šumarija: {p.sumarija_naziv}</p></div>
                                <button onClick={(e)=>{e.stopPropagation(); obrisiPodruznicu(p.id, p.naziv);}} className="text-red-500 font-black px-4 py-2 hover:bg-red-500/20 rounded-xl transition-all">✕</button>
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

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]);
    };

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
        <div className="bg-[#1e293b] p-6 rounded-[2rem] border border-slate-700 shadow-xl max-w-2xl mx-auto animate-in slide-in-from-right space-y-6">
            <h3 className="text-amber-400 font-black uppercase text-xs mb-4">🚚 Upravljanje Prevoznicima</h3>

            <div className="flex gap-2">
                <input value={noviPrevoznik} onChange={e=>setNoviPrevoznik(e.target.value)} placeholder="Novi prevoznik (npr. TRANS-KOP)" className="flex-1 p-4 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-amber-500 uppercase font-bold" />
                <button onClick={dodajPrevoznika} className="px-8 bg-amber-600 text-white font-black rounded-xl hover:bg-amber-500 shadow-lg uppercase text-[10px]">➕ Dodaj</button>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {prevoznici.map(p => (
                    <div key={p.id} className="flex justify-between items-center p-4 bg-slate-900 border border-slate-800 rounded-xl group hover:border-amber-500/30 transition-all">
                        <span className="text-sm text-white font-bold uppercase">{p.naziv}</span>
                        <button onClick={() => obrisiPrevoznika(p.id, p.naziv)} className="text-[10px] text-red-400 bg-red-900/20 px-4 py-2 rounded-lg transition-all uppercase font-black hover:bg-red-500 hover:text-white">✕ Obriši</button>
                    </div>
                ))}
                {prevoznici.length === 0 && (
                    <div className="text-center p-10 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 text-xs font-bold">
                        Nema unesenih prevoznika u bazi.
                    </div>
                )}
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

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]);
    };

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

    const obrisi = async (id, naziv) => {
        if(window.confirm(`Da li ste sigurni da želite obrisati mašinu: ${naziv}?`)){
            await supabase.from('masine').delete().eq('id', id); await zapisiU_Log('BRISANJE_MASINE', `Obrisana mašina: ${naziv}`); load();
        }
    };

    return (
        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-6 animate-in fade-in">
            <div className={`space-y-4 p-5 rounded-3xl border transition-all ${isEditing ? 'border-amber-500/50 bg-slate-800' : 'border-slate-800 bg-slate-900'}`}>
                <div className="flex justify-between items-center">
                    <h3 className={`${isEditing ? 'text-amber-500' : 'text-blue-500'} font-black uppercase text-xs`}>{isEditing ? '✏️ Ažuriranje Mašine' : '⚙️ Dodavanje Nove Mašine'}</h3>
                    {isEditing && <button onClick={ponistiIzmjenu} className="text-xs text-red-500 font-black bg-red-900/20 px-3 py-1 rounded-xl hover:bg-red-500 hover:text-white transition-all">Odustani ✕</button>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* Naziv Mašine</label><input placeholder="npr. BRENTA 1" value={form.naziv} onChange={e=>setForm({...form, naziv:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none uppercase border border-slate-700 focus:border-blue-500" /></div>
                    <div><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Cijena po radnom satu (KM)</label><input type="number" placeholder="0.00" value={form.cijena_sat} onChange={e=>setForm({...form, cijena_sat:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-blue-500" /></div>
                    <div><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Cijena po m³ (KM)</label><input type="number" placeholder="0.00" value={form.cijena_m3} onChange={e=>setForm({...form, cijena_m3:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-blue-500" /></div>
                    <div className="col-span-1 md:col-span-3 mt-2 bg-[#0f172a] p-4 rounded-xl border border-slate-700">
                        <label className="text-[10px] text-slate-500 uppercase font-black mb-3 block">Dozvoljeni Moduli (gdje se mašina prikazuje)</label>
                        <div className="flex gap-6">
                            {['prorez', 'pilana', 'dorada'].map(modul => (
                                <label key={modul} className="flex items-center gap-2 text-white text-xs font-bold cursor-pointer uppercase hover:text-blue-400 transition-colors">
                                    <input type="checkbox" checked={form.dozvoljeni_moduli?.includes(modul) || false} onChange={(e) => { const trenutni = form.dozvoljeni_moduli || []; setForm({ ...form, dozvoljeni_moduli: e.target.checked ? [...trenutni, modul] : trenutni.filter(m => m !== modul) }); }} className="w-5 h-5 accent-blue-600 bg-slate-800 border-slate-700 rounded" />
                                    {modul}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="col-span-1 md:col-span-3 pt-4 border-t border-slate-700 mt-2">
                        <label className="text-[10px] text-slate-400 uppercase font-black mb-3 block">🏷️ Odobreni atributi / operacije za ovu mašinu:</label>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {masterOznake.map(oznaka => {
                                const aktivan = form.atributi_paketa.includes(oznaka);
                                return (
                                    <div key={oznaka} className="flex items-center">
                                        <button onClick={() => toggleOznakaMasine(oznaka)} className={`px-3 py-2 rounded-l-xl text-[10px] font-black uppercase transition-all border-y border-l ${aktivan ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500'}`}>{aktivan ? '✓ ' : '+ '} {oznaka}</button>
                                        <button onClick={() => obrisiIzMastera(oznaka)} className={`px-2 py-2 border-y border-r rounded-r-xl text-[10px] font-black transition-all ${aktivan ? 'bg-emerald-700 border-emerald-400 text-emerald-300 hover:text-white hover:bg-red-500' : 'bg-slate-900 border-slate-700 text-slate-600 hover:text-red-500'}`} title="Trajno obriši iz sistema">✕</button>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex gap-2 max-w-sm mt-4 bg-slate-950 p-2 rounded-xl border border-slate-800">
                            <input value={novaMasterOznaka} onChange={e=>setNovaMasterOznaka(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') dodajUMaster()}} placeholder="Nova operacija u sistemu..." className="flex-1 p-2 bg-transparent text-xs text-white outline-none uppercase" />
                            <button onClick={dodajUMaster} className="px-4 bg-blue-600 rounded-lg text-white font-black hover:bg-blue-500 text-[10px] uppercase shadow-lg">+ Baza</button>
                        </div>
                    </div>
                </div>
                <button onClick={save} className={`w-full py-4 text-white font-black rounded-xl text-xs shadow-lg uppercase transition-all mt-4 ${isEditing ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'}`}>{isEditing ? '✅ Ažuriraj Mašinu' : '➕ Dodaj Mašinu'}</button>
            </div>

            <div className="space-y-2 pt-2">
                <h4 className="text-[10px] text-slate-400 font-black uppercase mb-3 ml-2">Spisak mašina</h4>
                <div className="max-h-80 overflow-y-auto pr-2 space-y-3">
                    {masine.length === 0 && <p className="text-center text-slate-500 text-xs">Nema unesenih mašina.</p>}
                    {masine.map(m => (
                        <div key={m.id} onClick={() => pokreniIzmjenu(m)} className={`flex flex-col p-4 border rounded-2xl cursor-pointer transition-all ${isEditing && form.id === m.id ? 'bg-slate-800 border-amber-500/50' : 'bg-slate-900 border-slate-800 hover:border-blue-500/50'}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-black text-white text-sm">{m.naziv}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">Radni sat: <b className="text-emerald-400">{m.cijena_sat} KM</b> | Po kubiku: <b className="text-emerald-400">{m.cijena_m3} KM</b> | Moduli: <b className="text-blue-400">{m.dozvoljeni_moduli ? m.dozvoljeni_moduli.toUpperCase() : 'SVI'}</b></p>
                                </div>
                                <button onClick={(e)=>{e.stopPropagation(); obrisi(m.id, m.naziv);}} className="text-red-500 font-black px-4 py-2 bg-red-900/20 rounded-xl hover:bg-red-500 hover:text-white transition-all">✕</button>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-3">
                                {(m.atributi_paketa || []).length === 0 ? (
                                    <span className="text-[8px] text-slate-500 font-bold italic border border-slate-700 px-2 py-0.5 rounded">Nema dodijeljenih operacija</span>
                                ) : (
                                    (m.atributi_paketa || []).map(attr => <span key={attr} className="text-[8px] text-emerald-400 bg-emerald-900/20 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold uppercase">{attr}</span>)
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
    const [duplicateWarning, setDuplicateWarning] = useState(null); 
    const sifraTimerRef = useRef(null); 

    const [excelFile, setExcelFile] = useState(null);
    const [log, setLog] = useState('');

    useEffect(() => { load(); }, []);
    const load = async () => { const {data} = await supabase.from('katalog_proizvoda').select('*').order('sifra'); setKatalog(data||[]); };

    const jedinstveneKategorije = useMemo(() => Array.from(new Set(katalog.map(k=>k.kategorija).filter(Boolean))), [katalog]);

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]);
    };

    const handleSifraChange = (val) => {
        const upperVal = val.toUpperCase();
        setForm({...form, sifra: upperVal});
        setDuplicateWarning(null);

        if (sifraTimerRef.current) clearTimeout(sifraTimerRef.current);

        if (upperVal.length >= 2 && !isEditing) {
            sifraTimerRef.current = setTimeout(async () => {
                const { data } = await supabase.from('katalog_proizvoda').select('*').eq('sifra', upperVal).maybeSingle();
                if (data) setDuplicateWarning(data);
            }, 2000);
        }
    };

    const pokreniIzmjenu = (proizvod) => {
        setForm({
            sifra: proizvod.sifra, naziv: proizvod.naziv, dimenzije: proizvod.dimenzije || '', kategorija: proizvod.kategorija || '',
            default_jedinica: proizvod.default_jedinica || 'm3', cijena: proizvod.cijena || '', m3: proizvod.m3 || '', 
            m2: proizvod.m2 || '', m1: proizvod.m1 || '', duzina: proizvod.duzina || '', sirina: proizvod.sirina || '', visina: proizvod.visina || ''
        });
        setIsEditing(true); setDuplicateWarning(null); window.scrollTo({ top: 0, behavior: 'smooth' }); 
    };

    const ponistiIzmjenu = () => {
        setForm({ sifra: '', naziv: '', dimenzije: '', kategorija: '', default_jedinica: 'm3', cijena: '', m3: '', m2: '', m1: '', duzina: '', sirina: '', visina: '' });
        setIsEditing(false); setDuplicateWarning(null);
    };

    const snimiProizvod = async () => {
        if(!form.sifra || !form.naziv) return alert("Šifra i Naziv su obavezni!");
        const payload = {...form, cijena: parseFloat(form.cijena)||0, m3: parseFloat(form.m3)||0, m2: parseFloat(form.m2)||0, m1: parseFloat(form.m1)||0, duzina: parseFloat(form.duzina)||0, sirina: parseFloat(form.sirina)||0, visina: parseFloat(form.visina)||0 };
        
        if (isEditing) {
            const { error } = await supabase.from('katalog_proizvoda').update(payload).eq('sifra', form.sifra);
            if(error) return alert("Greška pri ažuriranju: " + error.message);
            await zapisiU_Log('IZMJENA_PROIZVODA', `Ažuriran proizvod: ${form.sifra} - ${form.naziv}`); alert("✅ Proizvod uspješno ažuriran!");
        } else {
            const { data: postoji } = await supabase.from('katalog_proizvoda').select('sifra').eq('sifra', form.sifra.toUpperCase()).maybeSingle();
            if(postoji) return alert("❌ STROGA KONTROLA: Proizvod sa ovom šifrom već postoji! Ukoliko želite, kliknite 'Ažuriraj' na upozorenju.");
            const { error } = await supabase.from('katalog_proizvoda').insert([payload]);
            if(error) return alert("Greška pri dodavanju: " + error.message);
            await zapisiU_Log('DODAVANJE_PROIZVODA', `Dodan novi proizvod: ${form.sifra} - ${form.naziv}`); alert("✅ Proizvod uspješno dodan!");
        }
        ponistiIzmjenu(); load();
    };

    const obrisiProizvod = async (sifra, naziv) => {
        if(window.confirm(`Da li ste sigurni da želite TRAJNO OBRISATI proizvod: ${naziv}?`)){
            await supabase.from('katalog_proizvoda').delete().eq('sifra', sifra);
            await zapisiU_Log('BRISANJE_PROIZVODA', `Obrisan proizvod: ${sifra} - ${naziv}`); load();
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in">
            <div className={`bg-[#1e293b] p-6 rounded-[2.5rem] border shadow-2xl space-y-4 transition-all ${isEditing ? 'border-amber-500/50' : 'border-slate-700'}`}>
                <div className="flex justify-between items-center">
                    <h3 className={`${isEditing ? 'text-amber-500' : 'text-blue-500'} font-black uppercase text-xs`}>{isEditing ? '✏️ Ažuriranje Proizvoda' : '➕ Dodaj Proizvod Ručno'}</h3>
                    {isEditing && <button onClick={ponistiIzmjenu} className="text-xs text-red-500 font-black bg-red-900/20 px-3 py-1 rounded-xl hover:bg-red-500 hover:text-white">Odustani ✕</button>}
                </div>

                {duplicateWarning && (
                    <div className="bg-amber-900/30 border border-amber-500/50 p-4 rounded-2xl space-y-3 animate-in zoom-in-95">
                        <h4 className="text-amber-500 font-black uppercase text-[10px]">⚠️ Upozorenje: Šifra već postoji u bazi!</h4>
                        <div className="text-white text-xs bg-slate-900 p-3 rounded-xl border border-slate-700">
                            <p><b>Šifra:</b> {duplicateWarning.sifra} | <b>Naziv:</b> {duplicateWarning.naziv}</p>
                            <p className="text-[10px] text-slate-400 mt-1">Kategorija: {duplicateWarning.kategorija} | Dim: {duplicateWarning.visina}x{duplicateWarning.sirina}x{duplicateWarning.duzina} | Cijena: {duplicateWarning.cijena} KM/{duplicateWarning.default_jedinica}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => pokreniIzmjenu(duplicateWarning)} className="flex-1 bg-amber-600 text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-amber-500">✏️ Ažuriraj ovaj proizvod</button>
                            <button onClick={() => { setForm({...form, sifra: ''}); setDuplicateWarning(null); }} className="flex-1 bg-slate-700 text-white py-3 rounded-xl font-black text-[10px] uppercase hover:bg-slate-600">✕ Otkaži unos</button>
                        </div>
                    </div>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="col-span-2">
                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* ŠIFRA</label>
                        <input value={form.sifra} disabled={isEditing} onChange={e=>handleSifraChange(e.target.value)} className={`w-full p-3 rounded-xl text-xs text-white uppercase font-black outline-none ${isEditing ? 'bg-slate-800 border border-slate-700 opacity-50 cursor-not-allowed' : 'bg-[#0f172a] border border-blue-500/50 focus:border-blue-400'}`} />
                    </div>
                    <div className="col-span-2">
                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* NAZIV</label>
                        <input value={form.naziv} onChange={e=>setForm({...form, naziv:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-blue-500" />
                    </div>
                    <div className="relative z-40">
                        <SettingsSearchable label="Kategorija" value={form.kategorija} onChange={v=>setForm({...form, kategorija:v})} list={jedinstveneKategorije} placeholder="..." />
                    </div>
                    <div>
                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Dimenzije tekst</label>
                        <input value={form.dimenzije} onChange={e=>setForm({...form, dimenzije:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-blue-500" />
                    </div>
                    <div>
                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Def. Jedinica</label>
                        <select value={form.default_jedinica} onChange={e=>setForm({...form, default_jedinica:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-blue-500">
                            <option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option><option value="kom">kom</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[8px] text-emerald-500 uppercase ml-2 block mb-1">Cijena (KM)</label>
                        <input type="number" value={form.cijena} onChange={e=>setForm({...form, cijena:e.target.value})} className="w-full p-3 bg-emerald-900/20 border-emerald-500/50 rounded-xl text-xs text-emerald-400 font-black outline-none" />
                    </div>
                    
                    <div><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Faktor m³</label><input type="number" value={form.m3} onChange={e=>setForm({...form, m3:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-center text-slate-400 border border-slate-700 outline-none focus:border-blue-500" /></div>
                    <div><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Faktor m²</label><input type="number" value={form.m2} onChange={e=>setForm({...form, m2:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-center text-slate-400 border border-slate-700 outline-none focus:border-blue-500" /></div>
                    <div><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Faktor m1</label><input type="number" value={form.m1} onChange={e=>setForm({...form, m1:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-center text-slate-400 border border-slate-700 outline-none focus:border-blue-500" /></div>
                    <div className="hidden md:block"></div>

                    <div><label className="text-[8px] text-amber-500 uppercase ml-2 block mb-1">Dužina (cm)</label><input type="number" value={form.duzina} onChange={e=>setForm({...form, duzina:e.target.value})} className="w-full p-3 bg-slate-900 rounded-xl text-xs text-center text-amber-400 border border-slate-700 outline-none focus:border-blue-500" /></div>
                    <div><label className="text-[8px] text-amber-500 uppercase ml-2 block mb-1">Širina (cm)</label><input type="number" value={form.sirina} onChange={e=>setForm({...form, sirina:e.target.value})} className="w-full p-3 bg-slate-900 rounded-xl text-xs text-center text-amber-400 border border-slate-700 outline-none focus:border-blue-500" /></div>
                    <div><label className="text-[8px] text-amber-500 uppercase ml-2 block mb-1">Visina/Deb (cm)</label><input type="number" value={form.visina} onChange={e=>setForm({...form, visina:e.target.value})} className="w-full p-3 bg-slate-900 rounded-xl text-xs text-center text-amber-400 border border-slate-700 outline-none focus:border-blue-500" /></div>
                </div>
                <button onClick={snimiProizvod} className={`w-full py-4 text-white font-black rounded-xl text-xs shadow-lg uppercase transition-all ${isEditing ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'}`}>{isEditing ? '✅ Ažuriraj Proizvod' : '➕ Snimi u Katalog'}</button>
            </div>

            <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-xl">
                <h3 className="text-slate-400 font-black uppercase text-[10px] mb-3">Trenutni Katalog ({katalog.length} proizvoda) - Klikni za izmjenu</h3>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                    {katalog.map(k => (
                        <div key={k.sifra} onClick={() => pokreniIzmjenu(k)} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-blue-500/50 transition-all">
                            <div><p className="text-white text-xs font-black">{k.sifra} <span className="text-blue-400 ml-1">{k.naziv}</span></p><p className="text-[9px] text-slate-500 uppercase mt-1">Kat: {k.kategorija} | Dim: {k.visina}x{k.sirina}x{k.duzina} | <b className="text-emerald-500">{k.cijena} KM/{k.default_jedinica}</b></p></div>
                            <button onClick={(e)=>{e.stopPropagation(); obrisiProizvod(k.sifra, k.naziv);}} className="text-red-500 font-black px-4 py-2 hover:bg-red-500/20 rounded-xl transition-all">✕</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function KatalogSearchableDetail({ katalog, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value);
    useEffect(() => { setSearch(value); }, [value]);
    const filtered = katalog.filter(k => k.sifra.toUpperCase().includes(search.toUpperCase()) || k.naziv.toUpperCase().includes(search.toUpperCase()));

    return (
        <div className="relative font-black w-full">
            <input value={search} onFocus={() => setOpen(true)} onChange={e => { setSearch(e.target.value.toUpperCase()); setOpen(true); }} placeholder="Pronađi šifru ili naziv..." className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-amber-500" />
            {open && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    {filtered.map(k => (
                        <div key={k.sifra} onClick={() => { onChange(k.sifra); setSearch(k.sifra); setOpen(false); }} className="p-3 border-b border-slate-700 hover:bg-amber-600 cursor-pointer transition-all">
                            <div className="text-white text-xs font-black">{k.sifra} <span className="text-amber-300 ml-1">{k.naziv}</span></div>
                            <div className="text-[9px] text-slate-400 mt-1 uppercase">Kat: {k.kategorija} | Dim: {k.visina}x{k.sirina}x{k.duzina} | Cijena: <b className="text-white">{k.cijena} KM</b></div>
                        </div>
                    ))}
                    <div onClick={() => setOpen(false)} className="p-2 text-center text-[8px] text-slate-500 cursor-pointer hover:text-white">Zatvori</div>
                </div>
            )}
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
            kupacTimerRef.current = setTimeout(async () => {
                const { data } = await supabase.from('kupci').select('*').eq('naziv', upperVal).maybeSingle();
                if (data) setDuplicateWarning(data);
            }, 2000);
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
        setForm({ id: null, naziv: '', pdv: '', adresa: '', ukupni_rabat: '' });
        setRabatiProizvodi([]); setRabatiKategorije([]); setIsEditing(false); setDuplicateWarning(null);
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

    const obrisiKupca = async (id, naziv) => {
        if(window.confirm(`Da li ste sigurni da želite TRAJNO OBRISATI kupca: ${naziv}?`)){
            await supabase.from('kupci').delete().eq('id', id); await zapisiU_Log('BRISANJE_KUPCA', `Obrisan kupac: ${naziv}`); load();
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in">
            <div className={`bg-[#1e293b] p-6 rounded-[2.5rem] border shadow-2xl space-y-4 transition-all ${isEditing ? 'border-amber-500/50' : 'border-slate-700'}`}>
                <div className="flex justify-between items-center">
                    <h3 className={`${isEditing ? 'text-amber-500' : 'text-amber-500'} font-black uppercase text-xs`}>{isEditing ? '✏️ Ažuriranje Kupca' : '🤝 Novi Kupac i Rabati'}</h3>
                    {isEditing && <button onClick={ponistiIzmjenu} className="text-xs text-red-500 font-black bg-red-900/20 px-3 py-1 rounded-xl hover:bg-red-500 hover:text-white">Odustani ✕</button>}
                </div>
                {duplicateWarning && (
                    <div className="bg-amber-900/30 border border-amber-500/50 p-4 rounded-2xl space-y-3 animate-in zoom-in-95">
                        <h4 className="text-amber-500 font-black uppercase text-[10px]">⚠️ Upozorenje: Kupac već postoji u bazi!</h4>
                        <div className="text-white text-xs bg-slate-900 p-3 rounded-xl border border-slate-700">
                            <p><b>Firma:</b> {duplicateWarning.naziv} | <b>Adresa:</b> {duplicateWarning.adresa || 'N/A'}</p>
                            <p className="text-[10px] text-slate-400 mt-1">PDV: {duplicateWarning.pdv_broj || 'N/A'} | Ukupni Rabat: {duplicateWarning.rabati_jsonb?.ukupni || 0}%</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => pokreniIzmjenu(duplicateWarning)} className="flex-1 bg-amber-600 text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-amber-500">✏️ Ažuriraj ovog kupca</button>
                            <button onClick={() => { setForm({...form, naziv: ''}); setDuplicateWarning(null); }} className="flex-1 bg-slate-700 text-white py-3 rounded-xl font-black text-[10px] uppercase hover:bg-slate-600">✕ Otkaži unos</button>
                        </div>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-b border-slate-700 pb-4">
                    <div><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* Naziv Kupca / Firme</label><input value={form.naziv} onChange={e=>handleNazivChange(e.target.value)} disabled={isEditing} className={`w-full p-3 rounded-xl text-xs text-white uppercase font-black outline-none ${isEditing ? 'bg-slate-800 border border-slate-700 opacity-50 cursor-not-allowed' : 'bg-[#0f172a] border border-amber-500/50 focus:border-amber-400'}`} /></div>
                    <div><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">PDV Broj</label><input value={form.pdv} onChange={e=>setForm({...form, pdv:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-amber-500" /></div>
                    <div><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Adresa / Lokacija</label><input value={form.adresa} onChange={e=>setForm({...form, adresa:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-amber-500" /></div>
                    <div><label className="text-[8px] text-amber-500 uppercase ml-2 block mb-1 font-black">UKUPNI RABAT NA SVE PROIZVODE (%)</label><input type="number" value={form.ukupni_rabat} onChange={e=>setForm({...form, ukupni_rabat:e.target.value})} className="w-full p-3 bg-amber-900/20 rounded-xl text-xs text-amber-400 font-black outline-none border border-amber-500/50 focus:border-amber-400" /></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
                        <span className="text-[10px] text-slate-400 uppercase font-black">Specifični Rabat po Proizvodu (%)</span>
                        <div className="flex gap-2 items-end">
                            <div className="flex-1"><KatalogSearchableDetail katalog={katalog} value={tempP_sifra} onChange={setTempP_sifra} /></div>
                            <input type="number" value={tempP_rabat} onChange={e=>setTempP_rabat(e.target.value)} placeholder="%" className="w-16 p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 text-center focus:border-amber-500 outline-none" />
                            <button onClick={addR_Proizvod} className="bg-blue-600 text-white px-3 py-3 rounded-xl font-black text-xs hover:bg-blue-500">+</button>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {rabatiProizvodi.map((r, i) => {
                                const proizvod = katalog.find(k => k.sifra === r.sifra);
                                return (
                                    <div key={i} className="text-[10px] text-blue-300 bg-blue-900/20 p-3 rounded-lg flex justify-between items-center border border-blue-500/30">
                                        <div className="flex-1">
                                            <span className="font-black text-white">Šifra: {r.sifra}</span>
                                            {proizvod && (<div className="text-[9px] text-slate-400 mt-1"><span className="text-white font-bold">{proizvod.naziv}</span><br />Dim: {proizvod.visina}x{proizvod.sirina}x{proizvod.duzina} | {proizvod.cijena} KM/{proizvod.default_jedinica}</div>)}
                                        </div>
                                        <div className="flex items-center gap-3 ml-2">
                                            <span className="font-black text-amber-400 text-sm">{r.rabat}%</span>
                                            <button onClick={()=>remR_Proizvod(i)} className="text-red-500 hover:text-red-400 font-black px-2 py-1 bg-red-900/30 hover:bg-red-900/50 rounded-lg">✕</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
                        <span className="text-[10px] text-slate-400 uppercase font-black">Rabat po Kategoriji (%)</span>
                        <div className="flex gap-2 items-end">
                            <div className="flex-1"><SettingsSearchable value={tempK_kat} onChange={setTempK_kat} list={jedinstveneKategorije} placeholder="Pronađi kategoriju..." /></div>
                            <input type="number" value={tempK_rabat} onChange={e=>setTempK_rabat(e.target.value)} placeholder="%" className="w-16 p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 text-center focus:border-amber-500 outline-none" />
                            <button onClick={addR_Kategorija} className="bg-purple-600 text-white px-3 py-3 rounded-xl font-black text-xs hover:bg-purple-500">+</button>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {rabatiKategorije.map((r, i) => (
                                <div key={i} className="text-[10px] text-purple-300 bg-purple-900/20 p-3 rounded-lg flex justify-between items-center border border-purple-500/30">
                                    <span>Kategorija: <b className="text-white text-xs">{r.kategorija}</b></span>
                                    <div className="flex items-center gap-3"><span className="font-black text-amber-400 text-sm">{r.rabat}%</span><button onClick={()=>remR_Kategorija(i)} className="text-red-500 hover:text-red-400 font-black px-2 py-1 bg-red-900/30 hover:bg-red-900/50 rounded-lg">✕</button></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <button onClick={snimiKupca} className={`w-full py-4 text-white font-black rounded-xl uppercase text-xs shadow-lg transition-all ${isEditing ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'}`}>{isEditing ? '✅ Ažuriraj Kupca' : '➕ Snimi Kupca u Bazu'}</button>
            </div>
            <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-xl">
                <h3 className="text-slate-400 font-black uppercase text-[10px] mb-3">Lista Kupaca - Klikni za izmjenu</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {kupci.map(k => (
                        <div key={k.id} onClick={() => pokreniIzmjenu(k)} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-amber-500/50 transition-all">
                            <div>
                                <p className="text-white text-xs font-black">{k.naziv}</p>
                                <p className="text-[9px] text-slate-500 uppercase mt-1">Ukupni Rabat: <b className="text-amber-400">{k.rabati_jsonb?.ukupni || 0}%</b> | Spec. proizvoda: {Object.keys(k.rabati_jsonb?.proizvodi || {}).length} | Kategorija: {Object.keys(k.rabati_jsonb?.kategorije || {}).length}</p>
                            </div>
                            <button onClick={(e)=>{e.stopPropagation(); obrisiKupca(k.id, k.naziv);}} className="text-red-500 font-black px-4 py-2 hover:bg-red-500/20 rounded-xl transition-all">✕</button>
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
        <div className="space-y-4 animate-in fade-in">
            <div className={`p-6 rounded-[2.5rem] border shadow-2xl space-y-4 transition-all ${editId ? 'bg-blue-950 border-blue-500' : 'bg-[#1e293b] border-slate-700'}`}>
                <div className="flex justify-between items-center">
                    <h3 className="text-blue-500 font-black uppercase text-xs">{editId ? `✏️ Uređivanje Radnika: ${form.ime_prezime}` : `👷‍♂️ Dodaj Novog Radnika`}</h3>
                    {editId && <button onClick={ponistiEdit} className="text-red-400 hover:text-white text-[10px] font-black uppercase bg-red-900/30 px-3 py-1 rounded-lg">✕ Poništi</button>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input placeholder="Ime i Prezime" value={form.ime_prezime} onChange={e=>setForm({...form, ime_prezime:e.target.value})} className="p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-blue-500" />
                    <select value={form.uloga} onChange={e=>setForm({...form, uloga:e.target.value})} className="p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-blue-500 font-black"><option value="operater">Uloga: Operater (Rad na mašini)</option><option value="admin">Uloga: Administrator (Šef)</option></select>
                    <input placeholder="Username (za login)" value={form.username} onChange={e=>setForm({...form, username:e.target.value})} className="p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-blue-500" />
                    <input placeholder="Password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} className="p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-blue-500" />
                    <input type="number" placeholder="Bruto satnica (KM)" value={form.bruto_satnica} onChange={e=>setForm({...form, bruto_satnica:e.target.value})} className="p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-blue-500" />
                    <input type="number" placeholder="Dani godišnjeg (početno)" value={form.preostalo_godisnjeg} onChange={e=>setForm({...form, preostalo_godisnjeg:e.target.value})} className="p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-blue-500" />
                    <div className="col-span-1 md:col-span-2 pt-4 border-t border-slate-700 mt-2">
                        <label className="text-[10px] text-slate-400 uppercase font-black mb-3 block">🔐 Odobreni Moduli (Dozvole pristupa):</label>
                        <div className="flex flex-wrap gap-2">
                            {sviModuli.map(modul => {
                                const aktivan = form.dozvole.includes(modul);
                                return (<button key={modul} onClick={() => toggleDozvola(modul)} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${aktivan ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500'}`}>{aktivan ? '✓ ' : '+ '} {modul}</button>);
                            })}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 mt-2">
                    <button onClick={snimi} className="flex-1 py-5 bg-blue-600 text-white font-black rounded-xl uppercase text-xs shadow-xl hover:bg-blue-500 transition-all">{editId ? '✅ Ažuriraj Radnika' : '✅ Snimi Radnika'}</button>
                </div>
            </div>
            <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-xl">
                <h3 className="text-slate-400 font-black uppercase text-[10px] mb-4">Svi Radnici u sistemu</h3>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                    {radnici.map(r => (
                        <div key={r.id} className={`flex flex-col md:flex-row justify-between md:items-center p-4 border rounded-2xl gap-3 transition-all ${editId === r.id ? 'bg-blue-900/30 border-blue-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}>
                            <div>
                                <p className="text-white text-sm font-black">{r.ime_prezime} <span className="text-slate-500 text-[10px] font-normal">(@{r.username})</span></p>
                                <p className="text-[9px] text-slate-400 uppercase mt-1 mb-2"><span className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded mr-2 border border-blue-500/30">{r.uloga}</span> Satnica: <b className="text-white">{r.bruto_satnica} KM</b> | Godišnji: <b className="text-white">{r.preostalo_godisnjeg} dana</b></p>
                                <div className="flex flex-wrap gap-1">
                                    {(r.dozvole || []).length === 0 ? ( <span className="text-[8px] text-red-500 font-bold italic border border-red-500/30 px-2 py-0.5 rounded">NEMA DOZVOLA</span> ) : ( (r.dozvole || []).map(d => ( <span key={d} className="text-[8px] text-emerald-400 bg-emerald-900/20 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold uppercase">{d}</span> )) )}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => pokreniEdit(r)} className="text-blue-400 font-black px-4 py-2 hover:bg-blue-600 hover:text-white rounded-xl transition-all border border-blue-500/30 bg-blue-900/20">✎ Uredi</button>
                                <button onClick={async()=>{if(window.confirm(`Da li ste sigurni da zelite obrisati radnika ${r.ime_prezime}?`)){await supabase.from('radnici').delete().eq('id', r.id); load();}}} className="text-red-500 font-black px-4 py-2 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-red-500/30">✕</button>
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
        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-6 animate-in fade-in">
            <h3 className="text-emerald-400 font-black uppercase text-xs">🗂️ Kategorije Transakcija (Blagajna)</h3>
            <div className="flex gap-2">
                <select value={form.tip} onChange={e=>setForm({...form, tip:e.target.value})} className="p-4 bg-slate-900 rounded-xl text-white font-bold outline-none border border-slate-700"><option value="ULAZ">ULAZ</option><option value="IZLAZ">IZLAZ</option></select>
                <input value={form.naziv} onChange={e=>setForm({...form, naziv:e.target.value})} placeholder="Npr. Kupovina alata..." className="flex-1 p-4 bg-slate-900 rounded-xl text-white outline-none border border-slate-700" />
                <button onClick={dodajKategoriju} className="bg-emerald-600 px-6 rounded-xl text-white font-black hover:bg-emerald-500 shadow-lg">Dodaj</button>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
                {['ULAZ', 'IZLAZ'].map(tip => (
                    <div key={tip} className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                        <h4 className={`text-[10px] uppercase font-black mb-3 ${tip==='ULAZ'?'text-emerald-500':'text-red-500'}`}>Kategorije za ${tip}</h4>
                        {kategorije.filter(k=>k.tip===tip).map(k => (
                            <div key={k.id} className="flex justify-between items-center p-2 border-b border-slate-800">
                                <span className="text-xs text-slate-300 font-bold">{k.naziv}</span>
                                <button onClick={()=>obrisiKategoriju(k.id, k.naziv)} className="text-red-500 font-black hover:text-red-400">✕</button>
                            </div>
                        ))}
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

    const opcijeLokacija = [
        'Ikona u pregledniku (Favicon)', 'Glavni Meni (Dashboard Vrh)', 
        'Svi PDF Dokumenti', 'PDF Ponuda', 'PDF Radni Nalog', 
        'PDF Otpremnica', 'PDF Račun', 'PDF Blagajna'
    ];

    useEffect(() => { load(); }, []);
    
    const load = async () => { 
        const { data, error } = await supabase.from('brending').select('*').order('naziv'); 
        if (error) console.error("Greška baze:", error); setLogotipi(data || []); 
    };

    const toggleLokacija = (lok) => {
        setForm(prev => ({ ...prev, lokacije_jsonb: prev.lokacije_jsonb.includes(lok) ? prev.lokacije_jsonb.filter(l => l !== lok) : [...prev.lokacije_jsonb, lok] }));
    };

    const pokreniIzmjenu = (l) => { 
        setForm({ id: l.id, naziv: l.naziv, url_slike: l.url_slike, lokacije_jsonb: l.lokacije_jsonb || [], full_width: l.full_width || false }); 
        setFajlSlike(null); setIsEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); 
    };

    const ponisti = () => { 
        setForm({ id: null, naziv: '', url_slike: '', lokacije_jsonb: [], full_width: false }); 
        setFajlSlike(null); setIsEditing(false); 
    };

    const uploadISnimi = async () => {
        if(!form.naziv) return alert("Naziv je obavezan!");
        if(!form.url_slike && !fajlSlike) return alert("Morate odabrati sliku sa računara (ili unijeti link)!");
        
        setUploading(true);
        let finalUrl = form.url_slike;

        if (fajlSlike) {
            const fileExt = fajlSlike.name.split('.').pop();
            const fileName = `logo_${Date.now()}.${fileExt}`; 
            
            const { data: uploadData, error: uploadError } = await supabase.storage.from('slike').upload(fileName, fajlSlike);
            if (uploadError) { setUploading(false); return alert("Greška pri uploadu: " + uploadError.message); }
            
            const { data: publicUrlData } = supabase.storage.from('slike').getPublicUrl(fileName);
            finalUrl = publicUrlData.publicUrl;
        }

        const payload = { naziv: form.naziv, url_slike: finalUrl, lokacije_jsonb: form.lokacije_jsonb, full_width: form.full_width };
        
        if(isEditing) {
            const { error } = await supabase.from('brending').update(payload).eq('id', form.id);
            if (error) { setUploading(false); return alert("Greška pri ažuriranju: " + error.message); }
        } else {
            const { error } = await supabase.from('brending').insert([payload]);
            if (error) { setUploading(false); return alert("Greška pri unosu: " + error.message); }
        }
        
        const { data: bData } = await supabase.from('brending').select('*');
        localStorage.setItem('erp_brending', JSON.stringify(bData || []));
        
        setUploading(false); ponisti(); load();
        alert("✅ Brending uspješno snimljen! Osvježite stranicu (F5) da bi se primijenila nova postavka za PDF.");
    };

    const obrisi = async (id, naziv, e) => { 
        e.stopPropagation(); 
        if(window.confirm(`Da li ste sigurni da želite obrisati logo: ${naziv}?`)) { 
            await supabase.from('brending').delete().eq('id', id); load(); 
        } 
    };

    return (
        <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto">
            <div className={`p-6 rounded-[2.5rem] border shadow-2xl space-y-4 transition-all ${isEditing ? 'bg-amber-950/30 border-amber-500' : 'bg-[#1e293b] border-slate-700'}`}>
                <div className="flex justify-between items-center">
                    <h3 className={`${isEditing ? 'text-amber-500' : 'text-blue-500'} font-black uppercase text-xs`}>{isEditing ? `✏️ Uređivanje: ${form.naziv}` : `🎨 Dodaj Novi Logo / Memorandum`}</h3>
                    {isEditing && <button onClick={ponisti} className="text-red-400 hover:text-white text-[10px] font-black uppercase bg-red-900/30 px-3 py-1 rounded-lg transition-all">✕ Poništi</button>}
                </div>
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* Naziv Logotipa (npr. Glavni Logo)</label>
                        <input value={form.naziv} onChange={e=>setForm({...form, naziv:e.target.value})} className="w-full p-4 bg-[#0f172a] rounded-xl text-sm text-white outline-none border border-slate-700 focus:border-blue-500 font-bold" placeholder="Unesite naziv..." />
                    </div>
                    <div className="bg-slate-900 p-4 rounded-2xl border border-slate-700">
                        <label className="text-[10px] text-blue-400 uppercase font-black mb-3 block">1. Odaberi sliku sa računara:</label>
                        <input type="file" accept="image/png, image/jpeg, image/webp, image/svg+xml, image/x-icon" onChange={e=>setFajlSlike(e.target.files[0])} className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer" />
                        <div className="mt-4 border-t border-slate-800 pt-3">
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">...ILI unesi web link do slike (opciono)</label>
                            <input value={form.url_slike} onChange={e=>setForm({...form, url_slike:e.target.value})} placeholder="https://..." className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-slate-400 font-mono outline-none border border-slate-700 focus:border-blue-500" disabled={!!fajlSlike} />
                        </div>
                    </div>
                    <div className="pt-4 border-t border-slate-700">
                        <label className="text-[10px] text-slate-400 uppercase font-black mb-3 block">📍 2. Odaberi gdje se ovaj logo prikazuje:</label>
                        <div className="flex flex-wrap gap-2">
                            {opcijeLokacija.map(lok => {
                                const aktivan = form.lokacije_jsonb.includes(lok);
                                return (<button key={lok} onClick={() => toggleLokacija(lok)} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${aktivan ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)] scale-105' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500'}`}>{aktivan ? '✓ ' : '+ '} {lok}</button>);
                            })}
                        </div>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex items-center justify-between mt-2 cursor-pointer hover:bg-slate-800 transition-all" onClick={() => setForm({...form, full_width: !form.full_width})}>
                        <div><p className="text-white font-black text-xs uppercase">Prikaz preko cijele širine (Memorandum / Baner)</p><p className="text-[9px] text-slate-400 mt-1">Ako je ovo uključeno, slika ide na sami vrh PDF-a u punoj širini papira.</p></div>
                        <div className={`w-12 h-6 rounded-full p-1 transition-all ${form.full_width ? 'bg-emerald-500' : 'bg-slate-700'}`}><div className={`w-4 h-4 bg-white rounded-full transition-all ${form.full_width ? 'translate-x-6' : ''}`}></div></div>
                    </div>
                </div>
                {(form.url_slike || fajlSlike) && (
                    <div className="mt-4 p-6 bg-slate-900 rounded-2xl border border-slate-700 flex justify-center shadow-inner relative">
                        <span className="absolute top-2 left-3 text-[8px] uppercase text-slate-500 font-black">Pregled</span>
                        {fajlSlike ? <img src={URL.createObjectURL(fajlSlike)} alt="Preview" className="max-h-24 object-contain" /> : <img src={form.url_slike} alt="Preview" className="max-h-24 object-contain" />}
                    </div>
                )}
                <button onClick={uploadISnimi} disabled={uploading} className={`w-full py-5 text-white font-black rounded-2xl uppercase text-sm shadow-xl transition-all ${uploading ? 'bg-slate-600 cursor-not-allowed' : (isEditing ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500')}`}>
                    {uploading ? '⏳ Slanje na server...' : (isEditing ? '✅ Ažuriraj i Snimi Logo' : '✅ Snimi Novi Logo')}
                </button>
            </div>
            <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-xl">
                <h3 className="text-slate-400 font-black uppercase text-[10px] mb-4">Trenutni Logotipi u Sistemu (Klikni za izmjenu)</h3>
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {logotipi.length === 0 && <p className="text-center text-slate-500 text-xs py-6 font-bold border-2 border-dashed border-slate-700 rounded-2xl">Još nema dodanih logotipa.</p>}
                    {logotipi.map(l => (
                        <div key={l.id} onClick={() => pokreniIzmjenu(l)} className={`flex flex-col md:flex-row justify-between items-start md:items-center p-4 rounded-2xl cursor-pointer transition-all border ${isEditing && form.id === l.id ? 'bg-amber-900/20 border-amber-500/50' : 'bg-slate-900 border-slate-800 hover:border-blue-500/50 hover:bg-slate-800'}`}>
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className="w-20 h-20 bg-[#0f172a] rounded-2xl flex items-center justify-center p-2 border border-slate-700 shrink-0 shadow-inner"><img src={l.url_slike} className="max-h-full max-w-full object-contain" alt={l.naziv} /></div>
                                <div className="flex-1"><p className="text-white text-base font-black">{l.naziv}</p><div className="flex flex-wrap gap-1 mt-2">
                                    {l.full_width && <span className="text-[8px] bg-emerald-900/50 text-emerald-400 border border-emerald-500/50 px-2 py-1 rounded-md font-black uppercase">Preko cijele širine (Baner)</span>}
                                    {(l.lokacije_jsonb || []).length === 0 && <span className="text-[8px] text-slate-500 italic">Nema odabranih lokacija</span>}
                                    {(l.lokacije_jsonb || []).map(lok => <span key={lok} className="text-[8px] bg-blue-900/30 text-blue-400 border border-blue-500/30 px-2 py-1 rounded-md font-bold uppercase">{lok}</span>)}
                                </div></div>
                            </div>
                            <div className="mt-4 md:mt-0 flex gap-2 self-end md:self-auto"><button onClick={(e) => obrisi(l.id, l.naziv, e)} className="text-red-500 font-black px-4 py-3 bg-red-900/20 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-red-500/30 text-xs uppercase shadow-md">✕ Obriši</button></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function SettingsModule({ onExit, lockedTab }) {
    const [tab, setTab] = useState(lockedTab || 'sumarije');
    const tabs = ['sumarije', 'prevoznici', 'masine', 'katalog', 'kupci', 'radnici', 'blagajna', 'brending'];
    const labels = { sumarije: 'Šumarije', prevoznici: '🚚 Prevoznici', masine: 'Mašine', katalog: 'Katalog', kupci: 'Kupci', radnici: 'Radnici', blagajna: 'Kase / Kat.', brending: '🎨 Brending (SaaS)' };

    return (
        <div className="p-4 max-w-2xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-[#1e293b] p-4 rounded-3xl border border-slate-700 shadow-lg">
                <button onClick={onExit} className={`text-[10px] px-4 py-2 rounded-xl uppercase font-black text-white transition-all ${lockedTab ? 'bg-red-600 hover:bg-red-500' : 'bg-slate-800 hover:bg-slate-700'}`}>
                    {lockedTab ? '✕ ZATVORI I NASTAVI RAD' : '← Meni'}
                </button>
                <h2 className={`${lockedTab ? 'text-amber-500' : 'text-slate-400'} font-black tracking-widest uppercase text-xs`}>
                    {lockedTab ? '⚡ BRZI UNOS PODATAKA' : '⚙️ ERP PODEŠAVANJA'}
                </h2>
            </div>
            {!lockedTab && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {tabs.map(t => (
                        <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 rounded-2xl border-2 whitespace-nowrap transition-all text-[9px] tracking-widest uppercase font-black ${tab === t ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>{labels[t]}</button>
                    ))}
                </div>
            )}
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