"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import SearchableInput from '../components/SearchableInput';
import ScannerOverlay from '../components/ScannerOverlay';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Komponenta Dnevnik Masine specifična za Prorez
function DnevnikMasine({ modul, header, user }) {
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
        if(window.confirm("Obrisati ovaj zapis?")) {
            await supabase.from('dnevnik_masine').delete().eq('id', id);
            loadLogove();
        }
    };

    return (
        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-4 mt-6">
            <h3 className="text-amber-500 font-black uppercase text-xs">⚙️ EVIDENCIJA RADA I ZASTOJA MAŠINE</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800 items-end">
                <div>
                    <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Početak</label>
                    <input type="time" value={form.vrijeme_od} onChange={e => setForm({...form, vrijeme_od: e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-amber-500" />
                </div>
                <div>
                    <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Završetak</label>
                    <input type="time" value={form.vrijeme_do} onChange={e => setForm({...form, vrijeme_do: e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-amber-500" />
                </div>
                <div>
                    <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Zastoj (Minuta)</label>
                    <input type="number" value={form.zastoj_min} onChange={e => setForm({...form, zastoj_min: e.target.value})} placeholder="0" className="w-full p-3 bg-red-900/20 rounded-xl text-xs text-red-400 font-black border border-red-500/50 outline-none" />
                </div>
                <div className="col-span-2 md:col-span-1">
                    <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Napomena / Razlog</label>
                    <input type="text" value={form.napomena} onChange={e => setForm({...form, napomena: e.target.value})} placeholder="Održavanje, kvar..." className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-amber-500" />
                </div>
                <button onClick={snimiZastojIliRad} className="w-full py-3 bg-amber-600 text-white font-black rounded-xl text-[10px] uppercase shadow-lg hover:bg-amber-500">➕ Dodaj</button>
            </div>
            <div className="space-y-2 mt-4">
                {logovi.length === 0 && <p className="text-center text-slate-500 text-[10px] uppercase">Nema unesenih zastoja za danas.</p>}
                {logovi.map(l => (
                    <div key={l.id} className="flex justify-between items-center p-3 bg-slate-800 border border-slate-700 rounded-xl">
                        <div>
                            <p className="text-[10px] text-slate-400 font-black">
                                <span className="text-emerald-400">{l.vrijeme_od}</span> - {l.vrijeme_do ? <span className="text-amber-400">{l.vrijeme_do}</span> : <span className="text-slate-500">...</span>}
                            </p>
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

export default function ProrezModule({ user, header, setHeader, onExit }) {
    const [scan, setScan] = useState('');
    const [list, setList] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    
    const [brentista, setBrentista] = useState(typeof window !== 'undefined' ? localStorage.getItem('shared_brentista') || '' : '');
    const [viljuskarista, setViljuskarista] = useState(typeof window !== 'undefined' ? localStorage.getItem('shared_viljuskarista') || '' : '');
    const [radniciList, setRadniciList] = useState([]);

    const handleBrentistaChange = async (novoIme) => {
        const staroIme = localStorage.getItem('shared_brentista');
        if (staroIme && staroIme !== novoIme) {
            await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('radnik_ime', staroIme).eq('masina_naziv', header.masina).is('vrijeme_odjave', null);
        }
        if (novoIme) {
            await supabase.from('aktivni_radnici').insert([{ radnik_ime: novoIme, masina_naziv: header.masina, vrijeme_prijave: new Date().toISOString(), uloga: 'brentista' }]);
        }
        setBrentista(novoIme); localStorage.setItem('shared_brentista', novoIme);
    };

    const handleViljuskaristaChange = async (novoIme) => {
        const staroIme = localStorage.getItem('shared_viljuskarista');
        if (staroIme && staroIme !== novoIme) {
            await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('radnik_ime', staroIme).eq('masina_naziv', header.masina).is('vrijeme_odjave', null);
        }
        if (novoIme) {
            await supabase.from('aktivni_radnici').insert([{ radnik_ime: novoIme, masina_naziv: header.masina, vrijeme_prijave: new Date().toISOString(), uloga: 'viljuskarista' }]);
        }
        setViljuskarista(novoIme); localStorage.setItem('shared_viljuskarista', novoIme);
    };

    const timerRef = useRef(null);

    useEffect(() => { 
        loadList(); 
        supabase.from('radnici').select('ime_prezime').then(({data}) => setRadniciList(data ? data.map(r=>r.ime_prezime) : []));
    }, [header.masina, header.datum]);

    const loadList = async () => {
        if(!header.masina) return;
        const { data: logData } = await supabase.from('prorez_log').select('*').eq('masina', header.masina).eq('datum', header.datum).eq('zakljuceno', false);
        if (!logData || logData.length === 0) { setList([]); return; }

        const trupacIds = logData.map(l => l.trupac_id);
        const { data: trupciData } = await supabase.from('trupci').select('*').in('id', trupacIds);

        const finalnaLista = logData.map(log => {
            const detalji = (trupciData || []).find(t => t.id === log.trupac_id) || {};
            return { ...log, detaljiTrupca: detalji };
        });
        finalnaLista.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        setList(finalnaLista);
    };

    const handleInput = (val) => {
        setScan(val);
        if (timerRef.current) clearTimeout(timerRef.current);
        if (val.length >= 3) timerRef.current = setTimeout(() => obradiTrupac(val.toUpperCase()), 1500);
    };

    const obradiTrupac = async (trupacId) => {
        if (!header.masina) return alert("Odaberi mašinu u zaglavlju!");
        if (!brentista) return alert("Molimo unesite ko je Brentista!");
        
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

    return (
        <div className="p-4 max-w-xl mx-auto space-y-6 animate-in fade-in">
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-cyan-500" user={user} modulIme="prorez" hideWorkers={true} />
            
            <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-cyan-500/30 shadow-2xl space-y-6">
                <div className="grid grid-cols-2 gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-700 mb-4">
                    <SearchableInput label="👨‍🔧 BRENTISTA" value={brentista} onChange={handleBrentistaChange} list={radniciList} />
                    <SearchableInput label="🚜 VILJUŠKARISTA" value={viljuskarista} onChange={handleViljuskaristaChange} list={radniciList} />
                </div>

                <div className="relative font-black">
                    <label className="text-[10px] uppercase text-cyan-500 block mb-2 tracking-widest ml-2">SKENIRAJ TRUPAC (Ulaz u brentu)</label>
                    <input value={scan} onChange={e => handleInput(e.target.value)} className="w-full p-5 bg-[#0f172a] border-2 border-cyan-500/50 rounded-2xl text-xl text-center text-white outline-none focus:border-cyan-400 uppercase font-black" placeholder="Čekam sken..." />
                    <button onClick={() => setIsScanning(true)} className="absolute right-3 top-9 bottom-3 px-4 bg-cyan-600 rounded-xl text-white font-bold">📷</button>
                </div>

                <div className="pt-4 border-t border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] text-slate-500 uppercase font-black">Prorezano u ovoj smjeni:</span>
                        <span className="text-cyan-500 font-black">{list.length} kom</span>
                    </div>
                    
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                        {list.length === 0 && <p className="text-center text-slate-600 text-xs font-bold border-2 border-dashed border-slate-700 p-6 rounded-2xl">Skenirajte prvi trupac za ovu smjenu.</p>}
                        {list.map(l => (
                            <div key={l.id} onClick={() => obrisiIzProreza(l.id, l.trupac_id)} className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex justify-between items-center group cursor-pointer hover:border-red-500 transition-all shadow-lg animate-in slide-in-from-right-2">
                                <div>
                                    <span className="text-cyan-400 font-black tracking-widest block text-sm">
                                        {l.trupac_id} <span className="text-white text-[10px] ml-2">[{l.detaljiTrupca?.broj_plocice || 'Bez pločice'}]</span>
                                    </span>
                                    <span className="text-[10px] text-white uppercase mt-1 block font-bold">
                                        {l.detaljiTrupca?.vrsta || 'Nepoznato'} | L: {l.detaljiTrupca?.duzina || 0}m | Ø: {l.detaljiTrupca?.promjer || 0}cm
                                    </span>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-base text-emerald-400 font-black">{l.detaljiTrupca?.zapremina || '0.00'} m³</span>
                                    <span className="text-[9px] text-red-500 uppercase font-black group-hover:underline">Poništi ✕</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {list.length > 0 && (
                        <button onClick={async () => {
                            if(window.confirm("ZAKLJUČITI OVU LISTU? To znači da je smjena/tura gotova.")){
                                for(let item of list) await supabase.from('prorez_log').update({ zakljuceno: true }).eq('id', item.id);
                                setList([]); alert("Lista uspješno zaključena i poslana u analitiku!");
                            }
                        }} className="w-full mt-5 py-4 bg-cyan-900/30 border border-cyan-500 text-cyan-400 font-black rounded-xl text-xs uppercase hover:bg-cyan-600 hover:text-white transition-all shadow-lg">🏁 ZAKLJUČI SMJENU PROREZA</button>
                    )}
                </div>
            </div>
            <DnevnikMasine modul="Prorez" header={header} user={user} />
            {isScanning && <ScannerOverlay onScan={(text) => { obradiTrupac(text.toUpperCase()); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}