"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function Page() {
    const [loggedUser, setLoggedUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [activeModule, setActiveModule] = useState('dashboard');
    
    const [header, setHeader] = useState({
      mjesto: typeof window !== 'undefined' ? localStorage.getItem('last_loc') || '' : '',
      datum: new Date().toISOString().split('T')[0],
      masina: typeof window !== 'undefined' ? localStorage.getItem('last_masina') || '' : ''
    });
  
    useEffect(() => {
      const user = localStorage.getItem('smart_timber_user');
      if (user) { try { setLoggedUser(JSON.parse(user)); } catch (e) { localStorage.removeItem('smart_timber_user'); } }
      setAuthLoading(false);
    }, []);
  
    const handleLogin = async (e) => {
      e.preventDefault();
      const userInp = e.target.user.value.trim();
      const passInp = e.target.pass.value.trim();
  
      const { data } = await supabase.from('radnici').select('*').ilike('username', userInp).eq('password', passInp).maybeSingle();
      if (data) { localStorage.setItem('smart_timber_user', JSON.stringify(data)); setLoggedUser(data); } 
      else alert("Pogrešan Username ili Password!");
    };
  
    if (authLoading) return <div className="min-h-screen bg-[#0f172a]" />;
  
    if (!loggedUser) {
      return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 font-bold">
          <form onSubmit={handleLogin} className="w-full max-w-sm bg-[#1e293b] p-10 rounded-[3rem] border border-slate-700 shadow-2xl space-y-6">
            <div className="text-center mb-8"><h1 className="text-4xl font-black text-white tracking-tighter">Smart<span className="text-blue-500">Timber</span></h1></div>
            <div className="space-y-4">
              <input name="user" placeholder="Username" required className="w-full p-4 bg-[#0f172a] border border-slate-700 rounded-2xl text-white outline-none text-center" />
              <input name="pass" type="password" placeholder="Password" required className="w-full p-4 bg-[#0f172a] border border-slate-700 rounded-2xl text-white outline-none text-center" />
              <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl uppercase shadow-lg hover:opacity-90 transition-all">Pristupi sistemu</button>
            </div>
          </form>
        </div>
      );
    }
  
    return (
      <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans font-bold">
          {activeModule === 'dashboard' ? (
              <div className="p-6 md:p-10 flex flex-col items-center justify-center space-y-6 animate-in fade-in max-w-xl mx-auto">
                  
                  {/* ZAGLAVLJE: Pozdrav i odjava */}
                  <div className="w-full flex justify-between items-center bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-xl mb-6">
                      <div>
                          <h2 className="text-xl text-emerald-400 font-black">Dobrodošli,</h2>
                          <p className="text-white text-3xl">{loggedUser?.ime_prezime || 'Korisnik'}</p>
                      </div>
                      <button onClick={() => { localStorage.removeItem('smart_timber_user'); window.location.reload(); }} className="bg-red-500/10 text-red-500 px-4 py-2 rounded-xl text-xs hover:bg-red-500 hover:text-white transition-all font-black">
                          Odjava
                      </button>
                  </div>
  
                  {/* GORNJI BLOK DUGMADI (Prodaja i Finansije) */}
                  <div className="grid grid-cols-2 gap-4 w-full">
                      <MenuBtn label="PONUDE" icon="📝" color="pink" onClick={() => setActiveModule('ponude')} />
                      <MenuBtn label="R. NALOZI" icon="📄" color="purple" onClick={() => setActiveModule('nalozi')} />
                      <MenuBtn label="OTPREMNICE" icon="🚚" color="orange" onClick={() => setActiveModule('otpremnice')} />
                      <MenuBtn label="RAČUNI" icon="💰" color="red" onClick={() => setActiveModule('racuni')} />
                      <MenuBtn label="PRIJEM TRUPACA" icon="🪵" color="indigo" onClick={() => setActiveModule('prijem')} />
                      <MenuBtn label="PROREZ (Trupci)" icon="🪚" color="cyan" onClick={() => setActiveModule('prorez')} />
                  </div>
  
                  {/* DONJI BLOK DUGMADI (Proizvodnja i Podešavanja) */}
                  <div className="grid grid-cols-1 gap-4 w-full">
                      <MenuBtn label="PILANA (Izlaz)" icon="🪵" color="emerald" onClick={() => setActiveModule('pilana')} />
                      <MenuBtn label="DORADA (Ulaz/Izlaz)" icon="🔄" color="amber" onClick={() => setActiveModule('dorada')} />
                      
                      {loggedUser?.uloga === 'admin' && (
                          <>
                              <button onClick={() => setActiveModule('analitika')} className="mt-4 h-32 bg-gradient-to-br from-blue-900/80 to-[#0f172a] rounded-[2rem] flex flex-col items-center justify-center gap-3 border border-blue-500/30 hover:scale-105 transition-all shadow-2xl relative overflow-hidden group">
                                  <span className="text-4xl group-hover:scale-110 transition-all drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]">📊</span>
                                  <span className="text-blue-400 font-black tracking-widest uppercase text-sm drop-shadow-[0_0_10px_rgba(0,0,0,1)]">PAMETNA ANALITIKA</span>
                              </button>
                              <button onClick={() => { const p = prompt("PIN:"); if(p==="0111") setActiveModule('settings') }} className="mt-4 bg-slate-800 text-slate-400 py-4 rounded-2xl uppercase text-xs hover:bg-slate-700 transition-all font-black w-full shadow-lg border border-slate-700">
                                  ⚙️ Podešavanja Sistema
                              </button>
                          </>
                      )}
                  </div>
  
              </div>
          ) : activeModule === 'prijem' ? (
              <PrijemModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('dashboard')} />
          ) : activeModule === 'prorez' ? (
              <ProrezModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('dashboard')} />
          ) : activeModule === 'pilana' ? (
              <PilanaModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('dashboard')} />
          ) : activeModule === 'dorada' ? (
              <DoradaModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('dashboard')} />
          ) : activeModule === 'settings' ? (
              <SettingsModule onExit={() => setActiveModule('dashboard')} />
          ) : activeModule === 'ponude' ? (
              <PonudeModule onExit={() => setActiveModule('dashboard')} />
          ) : activeModule === 'nalozi' ? (
              <RadniNaloziModule onExit={() => setActiveModule('dashboard')} />
          ) : activeModule === 'otpremnice' ? (
              <OtpremniceModule onExit={() => setActiveModule('dashboard')} />
          ) : activeModule === 'racuni' ? (
              <RacuniModule onExit={() => setActiveModule('dashboard')} />
          ) : activeModule === 'analitika' ? (
              <DashboardModule user={loggedUser} onExit={() => setActiveModule('dashboard')} />
          ) : null}
      </div>
    );
  }
// ============================================================================
// ZAJEDNIČKE POMOĆNE KOMPONENTE 
// ============================================================================

function SmartSearchableInput({ label, value, onChange, list = [], storageKey }) {
    const [open, setOpen] = useState(false);
    
    const sortedList = useMemo(() => {
        if (!storageKey) return list;
        const freqs = JSON.parse(localStorage.getItem(`freq_${storageKey}`) || '{}');
        return [...list].sort((a, b) => (freqs[b] || 0) - (freqs[a] || 0));
    }, [list, storageKey, open]);

    const handleSelect = (item) => {
        onChange(item);
        setOpen(false);
        if (storageKey) {
            const freqs = JSON.parse(localStorage.getItem(`freq_${storageKey}`) || '{}');
            freqs[item] = (freqs[item] || 0) + 1;
            localStorage.setItem(`freq_${storageKey}`, JSON.stringify(freqs));
        }
    };

    return (
        <div className="relative font-black">
            <label className="text-[8px] text-slate-500 uppercase ml-3 block mb-1">{label}</label>
            <input type="text" value={value} onFocus={() => setOpen(true)} onChange={e => { onChange(e.target.value.toUpperCase()); setOpen(true); }} className="w-full p-3 bg-[#0f172a] border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-indigo-500 uppercase" />
            {open && sortedList.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-40 overflow-y-auto z-50">
                    {sortedList.filter(i => i.includes(value.toUpperCase())).map((item, idx) => (
                        <div key={idx} onClick={() => handleSelect(item)} className="p-3 text-[10px] border-b border-slate-700 hover:bg-indigo-600 uppercase cursor-pointer text-white flex justify-between">
                            <span>{item}</span>
                            {idx === 0 && !value && <span className="text-[8px] text-indigo-300">Najčešće</span>}
                        </div>
                    ))}
                    <div onClick={() => setOpen(false)} className="p-2 text-center text-[8px] text-slate-500 cursor-pointer">Zatvori</div>
                </div>
            )}
        </div>
    );
}

function SearchableInput({ label, value, onChange, list }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    
    useEffect(() => { setSearch(value || ''); }, [value]);

    const filtered = list.filter(item => item.toUpperCase().includes(search.toUpperCase()));

    return (
        <div className="relative w-full font-black">
            {label && <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">{label}</label>}
            <input 
                value={search} 
                onFocus={() => setOpen(true)} 
                onChange={e => { setSearch(e.target.value); setOpen(true); onChange(e.target.value); }} 
                className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-blue-500 uppercase" 
                placeholder="Pronađi..." 
            />
            {open && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl max-h-40 overflow-y-auto shadow-2xl">
                    {filtered.map((item, idx) => (
                        <div 
                            key={idx} 
                            onClick={() => { onChange(item); setSearch(item); setOpen(false); }} 
                            className="p-3 border-b border-slate-700 hover:bg-blue-600 cursor-pointer text-xs text-white uppercase"
                        >
                            {item}
                        </div>
                    ))}
                    <div onClick={() => setOpen(false)} className="p-2 text-center text-[8px] text-slate-500 cursor-pointer hover:text-white bg-slate-900 rounded-b-xl">ZATVORI</div>
                </div>
            )}
        </div>
    );
}

function MasterHeader({ header, setHeader, onExit, color, user, hideMasina = false }) {
    const [showWorkers, setShowWorkers] = useState(false);
    const [masineList, setMasineList] = useState([]);

    useEffect(() => {
        supabase.from('masine').select('naziv').then(({data}) => setMasineList(data ? data.map(m=>m.naziv) : []));
    }, []);

    const handleDate = (dir) => { const d = new Date(header.datum); d.setDate(d.getDate() + dir); setHeader({...header, datum: d.toISOString().split('T')[0]}); };
    return (
        <div className="bg-[#1e293b] p-5 rounded-[2.5rem] border border-slate-700 shadow-xl space-y-4 font-bold relative">
            <div className="flex justify-between items-center">
                <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase transition-all hover:bg-slate-700">← Meni</button>
                <div className="flex gap-3 items-center">
                    {!hideMasina && (
                        <button onClick={() => setShowWorkers(true)} className="bg-blue-900/30 text-blue-400 px-4 py-2 rounded-xl text-xs flex items-center gap-2 border border-blue-500/30 hover:bg-blue-600 hover:text-white transition-all">
                            <span>👥</span> Prijavljeni Radnici
                        </button>
                    )}
                </div>
            </div>
            <div className="flex items-center justify-between bg-slate-950 p-2 rounded-2xl border border-slate-800">
                <button onClick={() => handleDate(-1)} className="w-10 h-10 bg-slate-800 rounded-lg text-white font-black hover:bg-slate-700">-</button>
                <span className={`text-sm font-black uppercase ${color}`}>{new Date(header.datum).toLocaleDateString('de-DE')}</span>
                <button onClick={() => handleDate(1)} className="w-10 h-10 bg-slate-800 rounded-lg text-white font-black hover:bg-slate-700">+</button>
            </div>
            <div className={`grid ${hideMasina ? 'grid-cols-1' : 'grid-cols-2'} gap-2 font-black`}>
                <SearchableInput label="MJESTO" value={header.mjesto} onChange={v => {setHeader({...header, mjesto: v}); localStorage.setItem('last_loc', v)}} list={['SREBRENIK', 'MAGACIN A', 'RAMPA']} />
                {!hideMasina && <SearchableInput label="MAŠINA" value={header.masina} onChange={v => {setHeader({...header, masina: v}); localStorage.setItem('last_masina', v)}} list={masineList} />}
            </div>
            {showWorkers && <WorkerModal masina={header.masina} onClose={() => setShowWorkers(false)} />}
        </div>
    );
}

function WorkerModal({ masina, onClose }) {
    const [workers, setWorkers] = useState([]);
    const [allRadnici, setAllRadnici] = useState([]);
    const [scanCode, setScanCode] = useState('');
    const [isScanningWorkers, setIsScanningWorkers] = useState(false);
    
    useEffect(() => { loadWorkers(); loadAllRadnici(); }, [masina]);

    const loadWorkers = async () => { 
        const { data } = await supabase.from('aktivni_radnici').select('*').eq('masina_naziv', masina).is('vrijeme_odjave', null); 
        setWorkers(data || []); 
    };
    
    const loadAllRadnici = async () => { 
        const { data } = await supabase.from('radnici').select('ime_prezime').order('ime_prezime'); 
        setAllRadnici(data ? data.map(r => r.ime_prezime) : []); 
    };

    const handleWorkerAction = async (imeRadnika) => {
        if(!imeRadnika) return;
        
        const ime = imeRadnika.trim();
        const vecTu = workers.find(w => w.radnik_ime.toLowerCase() === ime.toLowerCase());
        
        if (vecTu) {
            const { error } = await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('id', vecTu.id);
            if (error) alert("Greška pri odjavi: " + error.message);
        } else {
            const { data: aktivanDrugdje } = await supabase.from('aktivni_radnici').select('*').ilike('radnik_ime', ime).is('vrijeme_odjave', null).maybeSingle();
            
            if (aktivanDrugdje) {
                if (window.confirm(`Radnik ${ime} je već aktivan na: ${aktivanDrugdje.masina_naziv}. Prebaciti ga ovdje?`)) {
                    await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('id', aktivanDrugdje.id);
                    await supabase.from('aktivni_radnici').insert([{ radnik_ime: ime, masina_naziv: masina }]);
                }
            } else {
                const { error } = await supabase.from('aktivni_radnici').insert([{ radnik_ime: ime, masina_naziv: masina }]);
                if (error) alert("Greška pri prijavi: " + error.message);
            }
        }
        
        setScanCode('');
        loadWorkers();
    };

    return (
        <div className="absolute top-0 left-0 w-full bg-[#0f172a] p-6 rounded-[2.5rem] border border-blue-500 shadow-2xl z-50 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-blue-500 text-xs tracking-widest uppercase font-black">Prijava na mašinu</h3>
                    <p className="text-[9px] text-slate-500 uppercase">{masina}</p>
                </div>
                <button onClick={onClose} className="text-slate-500 text-xl font-black hover:text-red-500 transition-all">✕</button>
            </div>

            <div className="flex gap-2 mb-6 items-end relative z-50">
                <div className="flex-1">
                    <SearchableInput label="Ime ili QR Radnika" value={scanCode} onChange={v => setScanCode(v)} list={allRadnici} />
                </div>
                <button onClick={() => handleWorkerAction(scanCode)} className="bg-blue-600 px-6 rounded-xl font-black text-white h-[46px] mb-[2px] hover:bg-blue-500 shadow-lg active:scale-95 transition-all">OK</button>
                <button onClick={() => setIsScanningWorkers(true)} className="bg-amber-600 px-4 rounded-xl font-black text-white h-[46px] mb-[2px] hover:bg-amber-500 shadow-lg">📷</button>
            </div>

            <div className="border-t border-slate-700 pt-4 relative z-0">
                <span className="text-[10px] text-slate-500 uppercase block mb-3 font-black">Trenutno rade na mašini ({workers.length}):</span>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2">
                    {workers.length === 0 && <span className="text-xs text-slate-600 font-bold italic">Nema prijavljenih radnika.</span>}
                    {workers.map(w => (
                        <div key={w.id} className="bg-emerald-900/30 text-emerald-400 border border-emerald-500/30 pl-4 pr-1 py-1 rounded-full text-[10px] flex items-center gap-3 font-bold shadow-lg animate-in fade-in">
                            <div>
                                <span>{w.radnik_ime}</span>
                                <span className="text-[8px] opacity-60 ml-2 italic">od {new Date(w.vrijeme_prijave).toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'})}</span>
                            </div>
                            <button onClick={() => handleWorkerAction(w.radnik_ime)} className="bg-red-900/50 text-red-500 w-6 h-6 rounded-full hover:bg-red-500 hover:text-white transition-all font-black flex items-center justify-center" title="Odjavi radnika">✕</button>
                        </div>
                    ))}
                </div>
            </div>
            
            {isScanningWorkers && <ScannerOverlay onScan={(text) => { handleWorkerAction(text); setIsScanningWorkers(false); }} onClose={() => setIsScanningWorkers(false)} />}
        </div>
    );
}
function DnevnikMasine({ modul, header, user }) {
    const [logovi, setLogovi] = useState([]);
    
    // Trenutno vrijeme za default vrijednosti
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
            datum: header.datum,
            masina: header.masina,
            modul: modul,
            vrijeme_od: form.vrijeme_od,
            vrijeme_do: form.vrijeme_do || null,
            zastoj_min: parseInt(form.zastoj_min) || 0,
            napomena: form.napomena,
            snimio: user.ime_prezime
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

function DimBox({ label, val, set, disabled }) {
    return (<div className={`bg-slate-900 p-2 rounded-xl border border-slate-800 font-bold text-center ${disabled ? 'opacity-50' : ''}`}><span className="text-[7px] text-slate-500 uppercase block mb-1 font-black">{label}</span><input type="number" value={val} onChange={e => set(e.target.value)} disabled={disabled} className="w-full bg-transparent text-white font-black outline-none text-lg text-center" /></div>);
}

function ScannerOverlay({ onScan, onClose }) {
    useEffect(() => {
        const config = { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true,
            videoConstraints: { facingMode: "environment" }
        };
        const sc = new Html5QrcodeScanner("global-reader", config, false);
        sc.render(onScan, () => {});
        return () => sc.clear();
    }, []);
    return (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-6 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
            <h3 className="text-white font-black mb-4 uppercase tracking-widest text-xs">Kamera aktivna</h3>
            <div id="global-reader" className="w-full max-w-md bg-slate-900 rounded-[2.5rem] border-4 border-blue-500 overflow-hidden shadow-2xl [&_select]:bg-slate-800 [&_select]:text-white [&_select]:p-2 [&_select]:rounded-lg [&_select]:mb-2 [&_select]:w-full [&_button]:bg-blue-600 [&_button]:text-white [&_button]:p-2 [&_button]:rounded-lg"></div>
            <button onClick={onClose} className="mt-10 px-12 py-4 bg-red-600 text-white font-black rounded-2xl uppercase shadow-lg">Odustani</button>
        </div>
    );
}

function MenuBtn({ label, icon, color, onClick }) {
    const colors = { indigo: 'border-indigo-500/30 text-indigo-500 bg-indigo-900/10 hover:border-indigo-500', cyan: 'border-cyan-500/30 text-cyan-500 bg-cyan-900/10 hover:border-cyan-500', emerald: 'border-emerald-500/30 text-emerald-500 bg-emerald-900/10 hover:border-emerald-500', amber: 'border-amber-500/30 text-amber-500 bg-amber-900/10 hover:border-amber-500', pink: 'border-pink-500/30 text-pink-500 bg-pink-900/10 hover:border-pink-500', purple: 'border-purple-500/30 text-purple-500 bg-purple-900/10 hover:border-purple-500' };
    return (
        <button onClick={onClick} className={`border-2 p-6 rounded-[2.5rem] shadow-lg active:scale-95 text-center flex flex-col justify-center items-center gap-2 transition-all ${colors[color]}`}>
            <span className="text-4xl drop-shadow-xl">{icon}</span>
            <span className="font-black uppercase text-[10px] tracking-widest">{label}</span>
        </button>
    );
}
function PD_SearchableRN({ nalozi, value, onSelect, onScanClick }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    
    useEffect(() => { setSearch(value || ''); }, [value]);

    const safeSearch = (search || '').toString().toUpperCase();

    const filtered = nalozi.filter(n => {
        const id = (n.id || '').toString().toUpperCase();
        const kupac = (n.kupac_naziv || '').toString().toUpperCase();
        return id.includes(safeSearch) || kupac.includes(safeSearch);
    });

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

    const filtered = katalog.filter(k => {
        const sifra = (k.sifra || '').toString().toUpperCase();
        const naziv = (k.naziv || '').toString().toUpperCase();
        return sifra.includes(safeSearch) || naziv.includes(safeSearch);
    });

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

// ============================================================================
// 1. MODUL PRIJEM TRUPACA (POPRAVLJENI ZASTOJ, AUDIT I LISTA)
// ============================================================================

function PrijemModule({ user, header, setHeader, onExit }) {
    const [sumarijeList, setSumarijeList] = useState([]);
    const [podruzniceList, setPodruzniceList] = useState([]);

    useEffect(() => {
        supabase.from('sumarije').select('naziv').then(({data}) => setSumarijeList(data?data.map(d=>d.naziv):[]));
    }, []);

    const ucitajPodruznice = async (sumarijaNaziv) => {
        const {data} = await supabase.from('podruznice').select('naziv').eq('sumarija_naziv', sumarijaNaziv);
        setPodruzniceList(data?data.map(d=>d.naziv):[]);
    };

    const [pHeader, setPHeader] = useState({
        sumarija: localStorage.getItem('pr_sumarija') || '',
        podruznica: localStorage.getItem('pr_podruznica') || '',
        prevoznik: localStorage.getItem('pr_prevoznik') || '',
        odjel: localStorage.getItem('pr_odjel') || '',
        otpremnica_broj: localStorage.getItem('pr_otpr_broj') || '',
        otpremnica_datum: localStorage.getItem('pr_otpr_datum') || new Date().toISOString().split('T')[0]
    });

    useEffect(() => { if(pHeader.sumarija) ucitajPodruznice(pHeader.sumarija); }, []);

    const [scan, setScan] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [form, setForm] = useState({ broj_plocice: '', redni_broj: '', vrsta: 'Jela', klasa: 'I', duzina: '', promjer: '' });
    const [listaPrijema, setListaPrijema] = useState([]);
    
    const scanTimerRef = useRef(null);

    useEffect(() => { loadPrijemList(); }, [pHeader.otpremnica_broj]);

    const loadPrijemList = async () => {
        if(!pHeader.otpremnica_broj) return;
        const { data } = await supabase.from('trupci').select('*').eq('otpremnica_broj', pHeader.otpremnica_broj).eq('zakljucen_prijem', false).order('created_at', { ascending: false });
        setListaPrijema(data || []);
    };

    const updateHeader = (key, val) => {
        const updated = { ...pHeader, [key]: val };
        if(key === 'sumarija') { updated.podruznica = ''; ucitajPodruznice(val); }
        setPHeader(updated);
        localStorage.setItem(`pr_${key}`, val);
    };

    const calculatedZapremina = useMemo(() => {
        if(!form.duzina || !form.promjer) return "0.00";
        const r = parseFloat(form.promjer) / 200; 
        return (r * r * Math.PI * parseFloat(form.duzina)).toFixed(2);
    }, [form]);

    // POPRAVLJENO: Pravi zastoj i provjera da li trupac vec postoji
    const handleScanInput = (val) => {
        setScan(val);
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        if (val.length >= 3) {
            scanTimerRef.current = setTimeout(async () => {
                const id = val.toUpperCase();
                const { data: existing } = await supabase.from('trupci').select('id, status, otpremnica_broj').eq('id', id).maybeSingle();
                if(existing) {
                    const confirmed = window.confirm(`⚠️ UPOZORENJE!\nTrupac sa QR kodom ${id} već postoji u bazi!\n\nTrenutni status: ${existing.status ? existing.status.toUpperCase() : 'N/A'}.\nOtpremnica: ${existing.otpremnica_broj || 'N/A'}\n\nDa li ste sigurni da želite prepisati stare podatke i prebaciti ga na ovu otpremnicu?`);
                    if(!confirmed) {
                        setScan('');
                    }
                }
            }, 2000);
        }
    };

    const snimiTrupac = async () => {
        // Gasi duh-tajmer da ne bi iskocio prozor nakon sto kliknemo dodaj
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);

        if(!pHeader.otpremnica_broj || !pHeader.sumarija) return alert("Popunite zaglavlje otpremnice (Šumarija i Broj)!");
        if(!scan || !form.duzina || !form.promjer) return alert("Popunite QR ID, dužinu i promjer.");
        
        const trupacID = scan.toUpperCase();

        // Provjera broja pločice
        if (form.broj_plocice) {
            const { data: plocicaPostoji } = await supabase.from('trupci').select('id').eq('broj_plocice', form.broj_plocice).maybeSingle();
            if (plocicaPostoji && plocicaPostoji.id !== trupacID) {
                if (!window.confirm(`⚠️ UPOZORENJE: Pločica broj ${form.broj_plocice} je već unesena za trupac ${plocicaPostoji.id}.\n\nNastaviti i prepisati?`)) return;
            }
        }

        const trupacData = {
            id: trupacID, broj_plocice: form.broj_plocice, redni_broj: form.redni_broj, vrsta: form.vrsta, klasa: form.klasa,
            duzina: form.duzina, promjer: form.promjer, zapremina: calculatedZapremina, sumarija: pHeader.sumarija,
            podruznica: pHeader.podruznica, prevoznik: pHeader.prevoznik, odjel: pHeader.odjel, otpremnica_broj: pHeader.otpremnica_broj,
            otpremnica_datum: pHeader.otpremnica_datum, snimio_korisnik: user.ime_prezime, datum_prijema: new Date().toISOString().split('T')[0], zakljucen_prijem: false,
            status: 'na_lageru'
        };

        // UPSERT dozvoljava preljepljivanje podataka ako smo na prethodnom koraku rekli OK
        const { error } = await supabase.from('trupci').upsert([trupacData]);
        if (error) return alert("Greška baze: " + error.message);

        // ZLATNI STANDARD: Pisanje u Audit Log
        await supabase.from('paket_audit_log').insert([{
            paket_id: trupacID,
            korisnik_ime: user.ime_prezime,
            akcija: 'PRIJEM_TRUPCA',
            proizvod: `${form.vrsta} | Kl: ${form.klasa}`,
            kolicina_promjena: calculatedZapremina + ' m3',
            datum_tekst: new Date().toISOString().split('T')[0]
        }]);
        
        setScan(''); setForm({ broj_plocice: '', redni_broj: '', vrsta: 'Jela', klasa: 'I', duzina: '', promjer: '' });
        loadPrijemList();
    };

    const zakljuciOtpremnicu = async () => {
        if(listaPrijema.length === 0) return alert("Nema trupaca za zaključavanje.");
        if(window.confirm(`ZAKLJUČITI OTPREMNICU ${pHeader.otpremnica_broj}?\nOvo će zaključati sve dodane trupce na lager.`)) {
            for(let trupac of listaPrijema) await supabase.from('trupci').update({ zakljucen_prijem: true }).eq('id', trupac.id);
            ['pr_sumarija', 'pr_podruznica', 'pr_prevoznik', 'pr_odjel', 'pr_otpr_broj'].forEach(k => localStorage.removeItem(k));
            setPHeader({...pHeader, sumarija: '', podruznica: '', prevoznik: '', odjel: '', otpremnica_broj: ''});
            setListaPrijema([]);
            alert("Otpremnica uspješno zaključena i trupci su na lageru!");
        }
    };

    return (
        <div className="p-4 max-w-xl mx-auto space-y-6 font-bold">
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-indigo-500" user={user} hideMasina={true} />

            <div className="bg-[#1e293b] p-5 rounded-[2.5rem] border border-indigo-500/30 shadow-xl space-y-4">
                <span className="text-[10px] text-indigo-500 uppercase tracking-widest block text-center mb-2">ZAGLAVLJE OTPREMNICE</span>
                <div className="grid grid-cols-2 gap-2">
                    <SmartSearchableInput label="ŠUMARIJA" value={pHeader.sumarija} onChange={v => updateHeader('sumarija', v)} list={sumarijeList} storageKey="sumarije" />
                    <SmartSearchableInput label="PODRUŽNICA" value={pHeader.podruznica} onChange={v => updateHeader('podruznica', v)} list={podruzniceList} storageKey="podruznice" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <SmartSearchableInput label="PREVOZNIK" value={pHeader.prevoznik} onChange={v => updateHeader('prevoznik', v)} list={['TRANS-KOP', 'SARAJ-TRANS']} storageKey="prevoznici" />
                    <SmartSearchableInput label="ODJEL" value={pHeader.odjel} onChange={v => updateHeader('odjel', v)} list={['Odjel 12a', 'Odjel 4b']} storageKey="odjeli" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="relative font-black">
                        <label className="text-[8px] text-slate-500 uppercase ml-3 block mb-1">DATUM OTPR.</label>
                        <input type="date" value={pHeader.otpremnica_datum} onChange={e => updateHeader('otpremnica_datum', e.target.value)} className="w-full p-3 bg-[#0f172a] border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-indigo-500" />
                    </div>
                    <div className="relative font-black">
                        <label className="text-[8px] text-slate-500 uppercase ml-3 block mb-1">BROJ OTPREMNICE</label>
                        <input type="text" value={pHeader.otpremnica_broj} onChange={e => updateHeader('otpremnica_broj', e.target.value.toUpperCase())} className="w-full p-3 bg-[#0f172a] border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-indigo-500" />
                    </div>
                </div>
            </div>

            <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-indigo-500/30 shadow-2xl space-y-5">
                <div className="relative font-black">
                    <label className="text-[8px] uppercase text-indigo-400 block mb-1 ml-2">SKENIRAJ QR KOD TRUPCA</label>
                    <input value={scan} onChange={e => handleScanInput(e.target.value)} className="w-full p-5 bg-[#0f172a] border-2 border-indigo-500/50 rounded-2xl text-xl text-center text-white outline-none focus:border-indigo-400 uppercase" placeholder="Čekam sken..." />
                    <button onClick={() => setIsScanning(true)} className="absolute right-3 top-7 bottom-3 px-4 bg-indigo-600 rounded-xl text-white font-bold hover:bg-indigo-500">📷 SCAN</button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="relative font-black">
                        <label className="text-[8px] text-slate-500 uppercase ml-3 block mb-1">BROJ PLOČICE</label>
                        <input type="text" value={form.broj_plocice} onChange={e => setForm({...form, broj_plocice: e.target.value})} className="w-full p-3 bg-[#0f172a] border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-indigo-500 text-center" placeholder="12345" />
                    </div>
                    <div className="relative font-black">
                        <label className="text-[8px] text-slate-500 uppercase ml-3 block mb-1">REDNI BROJ (Opciono)</label>
                        <input type="text" value={form.redni_broj} onChange={e => setForm({...form, redni_broj: e.target.value})} className="w-full p-3 bg-[#0f172a] border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-indigo-500 text-center" placeholder="npr. 1" />
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                    <div className="relative font-black col-span-1">
                        <label className="text-[8px] text-slate-500 uppercase block mb-1 text-center">VRSTA</label>
                        <select value={form.vrsta} onChange={e=>setForm({...form, vrsta: e.target.value})} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-[10px] text-white outline-none uppercase text-center font-bold">
                            <option>Jela</option><option>Bukva</option><option>Hrast</option>
                        </select>
                    </div>
                    <div className="relative font-black col-span-1">
                        <label className="text-[8px] text-slate-500 uppercase block mb-1 text-center">KLASA</label>
                        <select value={form.klasa} onChange={e=>setForm({...form, klasa: e.target.value})} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-[10px] text-white outline-none text-center font-bold">
                            <option>I</option><option>II</option><option>III</option><option>L</option>
                        </select>
                    </div>
                    <DimBox label="Duž (m)" val={form.duzina} set={v => setForm({...form, duzina: v})} />
                    <DimBox label="Prom (cm)" val={form.promjer} set={v => setForm({...form, promjer: v})} />
                </div>

                <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-700">
                    <span className="text-xs text-slate-400 uppercase">Kubikaža:</span>
                    <span className="text-2xl text-indigo-400 font-black">{calculatedZapremina} m³</span>
                </div>

                <button onClick={snimiTrupac} className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl uppercase shadow-xl hover:bg-indigo-500">➕ DODAJ NA OTPREMNICU</button>
            </div>

            {/* POPRAVLJENO: Uvijek prikazuje kontejner sa listom ako imamo broj otpremnice, cak i kad je prazna */}
            {pHeader.otpremnica_broj && (
                <div className="bg-[#1e293b] p-4 rounded-[2rem] border border-slate-700 animate-in fade-in">
                    <div className="flex justify-between items-center mb-3 px-2">
                        <span className="text-[10px] text-slate-500 uppercase">Lista trupaca (Otpremnica: {pHeader.otpremnica_broj}):</span>
                        <span className="text-indigo-400 font-black">{listaPrijema.length} kom</span>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto mb-4 scrollbar-hide">
                        {listaPrijema.length === 0 && (
                            <div className="text-center p-6 text-slate-500 text-xs font-bold border-2 border-dashed border-slate-700 rounded-xl">
                                Nema dodatih trupaca na ovoj otpremnici.
                            </div>
                        )}
                        {listaPrijema.map(t => (
                            <div key={t.id} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-xl">
                                <div>
                                    <div className="text-xs text-white font-black">{t.id} <span className="text-indigo-400 ml-1">[{t.broj_plocice}]</span></div>
                                    <div className="text-[9px] text-slate-500 uppercase">{t.vrsta} | Klasa {t.klasa} | L:{t.duzina}m Ø:{t.promjer}cm</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-white font-black">{t.zapremina} m³</div>
                                    <button onClick={async () => { if(window.confirm("Brisati trupac?")) { await supabase.from('trupci').delete().eq('id', t.id); loadPrijemList(); } }} className="text-[9px] text-red-500 uppercase hover:underline">Obriši ×</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button onClick={zakljuciOtpremnicu} className="w-full py-4 bg-indigo-900/40 border border-indigo-500 text-indigo-400 font-black rounded-xl text-xs uppercase hover:bg-indigo-600 hover:text-white transition-all">🏁 ZAKLJUČI UNOS OTPREMNICE</button>
                </div>
            )}
            {isScanning && <ScannerOverlay onScan={(text) => { handleScanInput(text.toUpperCase()); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}

// ============================================================================
// 2. MODUL PROREZ 
// ============================================================================

function ProrezModule({ user, header, setHeader, onExit }) {
    const [scan, setScan] = useState('');
    const [list, setList] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const timerRef = useRef(null);

    useEffect(() => { loadList(); }, [header.masina, header.datum]);

    const loadList = async () => {
        if(!header.masina) return;
        const { data } = await supabase.from('prorez_log').select('*').eq('masina', header.masina).eq('datum', header.datum).eq('zakljuceno', false).order('created_at', { ascending: false });
        setList(data || []);
    };

    const handleInput = (val) => {
        setScan(val);
        if (timerRef.current) clearTimeout(timerRef.current);
        if (val.length >= 3) timerRef.current = setTimeout(() => obradiTrupac(val.toUpperCase()), 2000);
    };

    const obradiTrupac = async (trupacId) => {
        if (!header.masina) return alert("Odaberi mašinu!");
        const { data: trupac } = await supabase.from('trupci').select('*').eq('id', trupacId).maybeSingle();
        if (!trupac) { alert(`❌ TRUPAC ${trupacId} NE POSTOJI NA LAGERU!`); setScan(''); return; }

        if (trupac.status === 'prorezan') {
            const naListi = list.find(l => l.trupac_id === trupacId);
            if (naListi) {
                if (window.confirm(`Trupac ${trupacId} je na današnjoj listi.\nŽelite li PONIŠTITI PROREZ?`)) {
                    await supabase.from('trupci').update({ status: 'na_lageru' }).eq('id', trupacId);
                    await supabase.from('prorez_log').delete().eq('id', naListi.id);
                    loadList();
                }
            } else alert(`⚠️ TRUPAC ${trupacId} JE VEĆ RANIJE PROREZAN!`);
            setScan(''); return;
        }
        await supabase.from('trupci').update({ status: 'prorezan' }).eq('id', trupacId);
        await supabase.from('prorez_log').insert([{ trupac_id: trupacId, masina: header.masina, korisnik: user.ime_prezime, mjesto: header.mjesto, datum: header.datum, zakljuceno: false }]);
        setScan(''); loadList();
    };

    return (
        <div className="p-4 max-w-xl mx-auto space-y-6">
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-cyan-500" user={user} />
            <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-cyan-500/30 shadow-2xl space-y-6">
                <div className="relative font-black">
                    <label className="text-[10px] uppercase text-cyan-500 block mb-2 tracking-widest ml-2">SKENIRAJ TRUPAC (Ulaz u brentu)</label>
                    <input value={scan} onChange={e => handleInput(e.target.value)} className="w-full p-5 bg-[#0f172a] border-2 border-cyan-500/50 rounded-2xl text-xl text-center text-white outline-none focus:border-cyan-400 uppercase" placeholder="..." />
                    <button onClick={() => setIsScanning(true)} className="absolute right-3 top-7 bottom-3 px-4 bg-cyan-600 rounded-xl text-white font-bold">📷 SCAN</button>
                </div>
                <div className="pt-4 border-t border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] text-slate-500 uppercase">Trenutna lista proreza:</span>
                        <span className="text-cyan-500 font-black">{list.length} kom</span>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {list.map(l => (
                            <div key={l.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex justify-between items-center cursor-pointer hover:border-red-500" onClick={() => { if(window.confirm(`Poništiti prorez za ${l.trupac_id}?`)) { supabase.from('trupci').update({ status: 'na_lageru' }).eq('id', l.trupac_id).then(()=>supabase.from('prorez_log').delete().eq('id', l.id)).then(loadList); }}}>
                                <span className="text-cyan-400 font-black tracking-widest">{l.trupac_id}</span>
                                <span className="text-[10px] text-red-500">Poništi ✕</span>
                            </div>
                        ))}
                    </div>
                    {list.length > 0 && <button onClick={()=>{if(window.confirm("ZAKLJUČITI DANAŠNJU LISTU?")){ Promise.all(list.map(l=>supabase.from('prorez_log').update({zakljuceno:true}).eq('id', l.id))).then(()=>{setList([]); alert("Zaključeno!")}) }}} className="w-full mt-4 py-4 bg-cyan-900/30 border border-cyan-500 text-cyan-400 font-black rounded-xl text-xs uppercase hover:bg-cyan-600 hover:text-white transition-all">🏁 ZAKLJUČI LISTU</button>}
                </div>
            </div>
            <DnevnikMasine modul="Prorez" header={header} user={user} />
            {isScanning && <ScannerOverlay onScan={(text) => { obradiTrupac(text.toUpperCase()); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}

// ============================================================================
// 3. MODUL PILANA (IZLAZ)
// ============================================================================

// ============================================================================
// MODUL: PILANA
// ============================================================================
// ============================================================================
// MODUL: PILANA
// ============================================================================
// ============================================================================
// MODUL: PILANA
// ============================================================================
function PilanaModule({ user, header, setHeader, onExit }) {
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
    
    const [form, setForm] = useState({ naziv: '', debljina: '', sirina: '', duzina: '', kolicina_ulaz: '', jm: 'kom', rn_jm: 'm3', rn_stavka_id: null, naruceno: 0, napravljeno: 0 });
    const [isScanning, setIsScanning] = useState(false);
    const [scanTarget, setScanTarget] = useState('');

    // NOVO: Dinamičke oznake sa mašine
    const [dostupneOznake, setDostupneOznake] = useState([]); 
    const [odabraneOznake, setOdabraneOznake] = useState([]);

    const timerRef = useRef(null);

    useEffect(() => {
        supabase.from('katalog_proizvoda').select('*').then(({data}) => setKatalog(data || []));
        supabase.from('radni_nalozi').select('id, kupac_naziv, status').neq('status', 'ZAVRŠENO').then(({data}) => setAktivniNalozi(data || []));
    }, []);

    // NOVO: Povlačenje oznaka kada se promijeni mašina
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
                const mapiraneStavke = ucitaneStavke.map(s => ({
                    id: s.id, sifra_proizvoda: s.sifra, naziv_proizvoda: s.naziv,
                    jm: s.jm_obracun || s.jm_unos || 'm3', naruceno: s.kolicina_obracun || s.kolicina || 0, napravljeno: s.napravljeno || 0
                }));
                setRnStavke(mapiraneStavke);
            } else { alert(`Nalog ${val} nema stavki!`); setRnStavke([]); }
        } else { alert(`Nalog ${val} ne postoji!`); setRnStavke([]); }
    };

    const handleStavkaSelect = async (stavka) => {
        const {data: kat} = await supabase.from('katalog_proizvoda').select('*').eq('sifra', stavka.sifra_proizvoda).maybeSingle();
        setForm({ 
            ...form, naziv: stavka.naziv_proizvoda, 
            debljina: kat?.visina||'', sirina: kat?.sirina||'', duzina: kat?.duzina||'', 
            jm: 'kom', rn_jm: stavka.jm, rn_stavka_id: stavka.id, 
            naruceno: parseFloat(stavka.naruceno).toFixed(4), napravljeno: parseFloat(stavka.napravljeno || 0).toFixed(4) 
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
                    setIzlazScan(''); 
                    return; 
                }
            }
            setActiveIzlazIds(p => [...p, id]);
        }
        setSelectedIzlazId(id);
        fetchIzlaz(id); 
        setIzlazScan('');
    };

    const handleIzlazInput = (val, isEnter = false) => {
        setIzlazScan(val);
        if(timerRef.current) clearTimeout(timerRef.current);
        if(!val) return;
        if (isEnter) processIzlaz(val);
        else timerRef.current = setTimeout(() => processIzlaz(val), 2000);
    };

    const fetchIzlaz = async (pid) => { const { data } = await supabase.from('paketi').select('*').eq('paket_id', pid); setIzlazPackageItems(data || []); };

    const toggleOznaka = (o) => {
        setOdabraneOznake(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o]);
    };

    const save = async () => {
        if (!selectedIzlazId) return alert("Prvo skenirajte IZLAZNI PAKET!");
        if (!form.kolicina_ulaz) return alert("⚠️ Unesite količinu prije snimanja!");

        const timeNow = new Date().toLocaleTimeString('de-DE');
        const unosKol = parseFloat(form.kolicina_ulaz);
        const v = parseFloat(form.debljina) || 1;
        const s = parseFloat(form.sirina) || 1;
        const d = parseFloat(form.duzina) || 1;

        let komada = unosKol;
        if (form.jm === 'm3') komada = unosKol / ((v/100) * (s/100) * (d/100));
        else if (form.jm === 'm2') komada = unosKol / ((s/100) * (d/100));
        else if (form.jm === 'm1') komada = unosKol / (d/100);

        const qtyZaPaket = parseFloat((komada * (v/100) * (s/100) * (d/100)).toFixed(3));

        if (activeEditItem) {
            const newM3 = updateMode === 'dodaj' ? parseFloat(activeEditItem.kolicina_final) + qtyZaPaket : parseFloat(activeEditItem.kolicina_final) - qtyZaPaket;
            const { error } = await supabase.from('paketi').update({ 
                kolicina_final: parseFloat(newM3.toFixed(3)), 
                vrijeme_tekst: timeNow, 
                snimio_korisnik: user.ime_prezime,
                oznake: odabraneOznake.length > 0 ? odabraneOznake : activeEditItem.oznake // Ažuriraj oznake ako su nove
            }).eq('id', activeEditItem.id);
            
            if (error) return alert("❌ GREŠKA PRI AŽURIRANJU PAKETA: " + error.message);
        } else {
            const { error } = await supabase.from('paketi').insert([{ 
                paket_id: selectedIzlazId, naziv_proizvoda: form.naziv, debljina: form.debljina, sirina: form.sirina, duzina: form.duzina, 
                kolicina_ulaz: form.kolicina_ulaz, jm: form.jm, kolicina_final: qtyZaPaket, 
                mjesto: header.mjesto, masina: header.masina, snimio_korisnik: user.ime_prezime, vrijeme_tekst: timeNow, datum_yyyy_mm: header.datum,
                oznake: odabraneOznake // NOVO: Spasavanje oznaka
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
        fetchIzlaz(selectedIzlazId); 
        setForm(f => ({...f, kolicina_ulaz: ''})); 
        setOdabraneOznake([]); // Očisti odabir
        setActiveEditItem(null);
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
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-emerald-500" user={user} />
            <h2 className="text-emerald-500 text-center font-black tracking-widest uppercase">🪵 PILANA - IZLAZ DASKE</h2>
            
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
                            <span className="text-[9px] text-blue-300 uppercase">Stavke na nalogu:</span>
                            {rnStavke.map(s => (
                                <div key={s.id} onClick={() => handleStavkaSelect(s)} className="flex justify-between items-center p-3 bg-slate-800 rounded-xl cursor-pointer hover:bg-blue-600 transition-all border border-slate-700">
                                    <span className="text-[10px] text-white font-bold">{s.naziv_proizvoda}</span>
                                    <span className="text-[9px] text-emerald-300 font-black">Nar: {s.naruceno} | Ur: {s.napravljeno}</span>
                                </div>
                            ))}
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
                            <div className="flex justify-between bg-blue-900/30 p-3 rounded-xl border border-blue-500/30 mt-2">
                                <div className="text-[10px] text-blue-300 uppercase">Naručeno: <b className="text-white text-xs">{form.naruceno}</b></div>
                                <div className="text-[10px] text-emerald-400 uppercase">Dosad urađeno: <b className="text-white text-xs">{form.napravljeno}</b></div>
                            </div>
                        )}
                        <div className="grid grid-cols-3 gap-2 mt-2">
                            <DimBox label="Deb" val={form.debljina} set={v => setForm({...form, debljina: v})} disabled={!!activeEditItem} />
                            <DimBox label="Šir" val={form.sirina} set={v => setForm({...form, sirina: v})} disabled={!!activeEditItem} />
                            <DimBox label="Duž" val={form.duzina} set={v => setForm({...form, duzina: v})} disabled={!!activeEditItem} />
                        </div>
                        <div className="flex gap-2">
                            <input type="number" value={form.kolicina_ulaz} onKeyDown={e => {if(e.key==='Enter') save()}} onChange={e => setForm({...form, kolicina_ulaz: e.target.value})} className="flex-1 p-4 bg-[#0f172a] border-2 border-slate-700 rounded-2xl text-2xl text-center text-white font-black" placeholder="Količina..." />
                            <select value={form.jm} onChange={e => setForm({...form, jm: e.target.value})} className="bg-slate-800 px-4 rounded-xl text-white font-black outline-none border border-slate-700 focus:border-emerald-500">
                                <option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option>
                            </select>
                        </div>

                        {/* NOVO: Dodatne operacije (Oznake) */}
                        {dostupneOznake.length > 0 && (
                            <div className="space-y-2 mt-4 bg-slate-950 p-3 rounded-xl border border-slate-800">
                                <label className="text-[9px] text-slate-400 uppercase font-black ml-1">Dodatne operacije na paketu:</label>
                                <div className="flex flex-wrap gap-2">
                                    {dostupneOznake.map(o => (
                                        <button 
                                            key={o} 
                                            onClick={() => toggleOznaka(o)}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${odabraneOznake.includes(o) ? 'bg-amber-600 border-amber-400 text-white shadow-[0_0_10px_rgba(217,119,6,0.4)]' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                        >
                                            {odabraneOznake.includes(o) ? '✓ ' : '+ '} {o}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button onClick={save} className="w-full py-6 mt-4 bg-emerald-600 text-white font-black rounded-2xl uppercase shadow-xl hover:opacity-90">{activeEditItem ? `✅ AŽURIRAJ STAVKU` : `✅ SNIMI STAVKU`}</button>
                        
                        <div className="pt-4 space-y-2 max-h-52 overflow-y-auto border-t border-slate-700">
                            {izlazPackageItems.map(item => (
                                <div key={item.id} onClick={() => { setActiveEditItem(item); setForm({...item, kolicina_ulaz: '' }); }} className="flex justify-between items-center p-4 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:border-emerald-500">
                                    <div>
                                        <div className="text-[10px] uppercase text-white font-bold">{item.naziv_proizvoda}</div>
                                        <div className="text-emerald-500 text-lg font-black tracking-tighter">{item.debljina}x{item.sirina}x{item.duzina}</div>
                                        {item.oznake && item.oznake.length > 0 && (
                                            <div className="flex gap-1 mt-1">
                                                {item.oznake.map(o => <span key={o} className="text-[8px] bg-amber-900/30 text-amber-400 px-1.5 py-0.5 rounded uppercase font-bold border border-amber-500/30">{o}</span>)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right font-black"><div className="text-xl text-white">{item.kolicina_final} m³</div><div className="text-[9px] text-slate-500">{item.kolicina_ulaz} {item.jm}</div></div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <DnevnikMasine modul="Pilana" header={header} user={user} />
            {isScanning && <ScannerOverlay onScan={(text) => { if(scanTarget==='nalog') handleNalogSelect(text); else handleIzlazInput(text, true); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}
// ============================================================================
// MODUL: ANALITIKA / DASHBOARD
// ============================================================================
// ============================================================================
// MODUL: ANALITIKA / DASHBOARD (UKLJUČUJE SVE POD-IZVJEŠTAJE I AI)
// ============================================================================

// ============================================================================
// MODUL: ANALITIKA / DASHBOARD (SADA SPOJEN NA PRAVU BAZU + PDF)
// ============================================================================

// ============================================================================
// MODUL: ANALITIKA / DASHBOARD (SPREMAN ZA PERIOD, NAPREDNE NALOGE I AI PRINT)
// ============================================================================

// ============================================================================
// MODUL: ANALITIKA / DASHBOARD (SA INTERAKTIVNOM AI PRETRAGOM I DETALJIMA)
// ============================================================================

function DashboardModule({ user, onExit }) {
    const danasnjiDatum = new Date().toISOString().split('T')[0];
    const [datumOd, setDatumOd] = useState(danasnjiDatum);
    const [datumDo, setDatumDo] = useState(danasnjiDatum);
    const [tipDatuma, setTipDatuma] = useState('dan'); // 'dan' ili 'period'

    const [aiUpit, setAiUpit] = useState('');
    const [aiOdgovor, setAiOdgovor] = useState(null);
    const [aiData, setAiData] = useState(null); 
    const [selectedAiItem, setSelectedAiItem] = useState(null); // NOVO: Za prikaz detalja iz AI pretrage
    const [isAILoading, setIsAILoading] = useState(false);
    
    const [aktivanIzvjestaj, setAktivanIzvjestaj] = useState(null); 
    const [detaljiNaloga, setDetaljiNaloga] = useState(null); 
    const [loading, setLoading] = useState(true);

    const [dashData, setDashData] = useState({
        trupciUlaz: 0, gradaIzlaz: 0, iskoristenje: 0, zastoji: 0, aktivniNalozi: 0,
        proizvodi: [], trupciLista: [], naloziLista: []
    });

    useEffect(() => { ucitajPravePodatke(); }, [datumOd, datumDo]);

    const ucitajPravePodatke = async () => {
        setLoading(true);
        
        const { data: trupci } = await supabase.from('trupci').select('zapremina, vrsta, klasa, otpremnica_broj, datum_prijema')
            .gte('datum_prijema', datumOd).lte('datum_prijema', datumDo);
        let sumaTrupaca = 0;
        if (trupci) trupci.forEach(t => sumaTrupaca += parseFloat(t.zapremina || 0));

        const { data: paketi } = await supabase.from('paketi').select('kolicina_final, naziv_proizvoda, datum_yyyy_mm')
            .gte('datum_yyyy_mm', datumOd).lte('datum_yyyy_mm', datumDo);
        let sumaGrade = 0;
        let proizvodiGrupisano = {};
        if (paketi) {
            paketi.forEach(p => {
                const kol = parseFloat(p.kolicina_final || 0);
                sumaGrade += kol;
                if(proizvodiGrupisano[p.naziv_proizvoda]) proizvodiGrupisano[p.naziv_proizvoda] += kol;
                else proizvodiGrupisano[p.naziv_proizvoda] = kol;
            });
        }

        const sortiraniProizvodi = Object.keys(proizvodiGrupisano).map(naziv => ({ naziv, m3: proizvodiGrupisano[naziv] })).sort((a, b) => b.m3 - a.m3);

        const { data: zastoji } = await supabase.from('dnevnik_masine').select('zastoj_min, datum')
            .gte('datum', datumOd).lte('datum', datumDo);
        let sumaZastoja = 0;
        if (zastoji) zastoji.forEach(z => sumaZastoja += parseInt(z.zastoj_min || 0));

        const { data: nalozi } = await supabase.from('radni_nalozi').select('*').neq('status', 'ZAVRŠENO').neq('status', 'ISPORUČENO');
        
        let procenatIskoristenja = 0;
        if (sumaTrupaca > 0) procenatIskoristenja = ((sumaGrade / sumaTrupaca) * 100).toFixed(2);

        setDashData({
            trupciUlaz: sumaTrupaca.toFixed(2), gradaIzlaz: sumaGrade.toFixed(2),
            iskoristenje: procenatIskoristenja, zastoji: sumaZastoja,
            aktivniNalozi: nalozi ? nalozi.length : 0,
            proizvodi: sortiraniProizvodi, trupciLista: trupci || [], naloziLista: nalozi || []
        });

        setLoading(false);
    };

    const formatirajVrijeme = (minute) => {
        if (!minute || isNaN(minute)) return "00:00";
        const sati = Math.floor(minute / 60);
        const min = minute % 60;
        return `${sati.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    };

    // --- KOMPONENTA ZA FILTER DATUMA ---
    const FilterDatuma = () => (
        <div className="flex flex-col xl:flex-row items-center gap-3 bg-slate-900 p-2 rounded-2xl border border-slate-700 shadow-inner w-full xl:w-auto mt-4 md:mt-0">
            <div className="flex bg-slate-800 rounded-lg p-1 w-full xl:w-auto">
                <button onClick={() => { setTipDatuma('dan'); setDatumDo(datumOd); }} className={`flex-1 xl:flex-none px-4 py-2 rounded-md text-[10px] font-black uppercase transition-all ${tipDatuma === 'dan' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>Za Dan</button>
                <button onClick={() => setTipDatuma('period')} className={`flex-1 xl:flex-none px-4 py-2 rounded-md text-[10px] font-black uppercase transition-all ${tipDatuma === 'period' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>Za Period</button>
            </div>
            <div className="flex items-center gap-2 px-2 w-full xl:w-auto justify-center">
                <span className="text-[9px] text-slate-500 font-black uppercase hidden sm:inline">{tipDatuma === 'dan' ? 'Odaberi:' : 'Od:'}</span>
                <input type="date" value={datumOd} onChange={e => { setDatumOd(e.target.value); if(tipDatuma === 'dan') setDatumDo(e.target.value); }} className="bg-[#0f172a] text-white text-xs font-bold p-2.5 rounded-xl outline-none focus:border-blue-500 border border-slate-800 hover:border-slate-600 transition-all cursor-pointer" />
                
                {tipDatuma === 'period' && (
                    <>
                        <span className="text-slate-600 font-black">-</span>
                        <span className="text-[9px] text-slate-500 font-black uppercase hidden sm:inline">Do:</span>
                        <input type="date" value={datumDo} onChange={e => setDatumDo(e.target.value)} className="bg-[#0f172a] text-white text-xs font-bold p-2.5 rounded-xl outline-none focus:border-blue-500 border border-slate-800 hover:border-slate-600 transition-all cursor-pointer" />
                    </>
                )}
            </div>
        </div>
    );

    // --- PAMETNI PRETRAŽIVAČ BAZE (AI MOTOR) ---
    const pokreniAI = async () => {
        if(!aiUpit) return;
        setIsAILoading(true); setAiOdgovor(null); setAiData(null); setSelectedAiItem(null);
        
        const upit = aiUpit.toLowerCase();
        let odgovor = "Pretraga završena. Molimo unesite precizniji pojam (npr. 'paketi', 'zastoji', 'nalozi', 'trupci').";
        let siroviPodaci = null;

        try {
            if (upit.includes('paket') || upit.includes('urad') || upit.includes('proizv') || upit.includes('gotov')) {
                const { data } = await supabase.from('paketi').select('*').gte('datum_yyyy_mm', datumOd).lte('datum_yyyy_mm', datumDo);
                const ukupnoM3 = data.reduce((sum, item) => sum + parseFloat(item.kolicina_final || 0), 0);
                odgovor = `📊 PRONAĐENO: U odabranom periodu kreirano je tačno ${data.length} paketa sa gotovom robom u ukupnoj zapremini od ${ukupnoM3.toFixed(2)} m³.`;
                siroviPodaci = { tip: 'paketi', podaci: data, naslov: `AI Izvještaj: Paketi (${new Date(datumOd).toLocaleDateString('bs-BA')} do ${new Date(datumDo).toLocaleDateString('bs-BA')})` };
            } else if (upit.includes('trupac') || upit.includes('ulaz')) {
                const { data } = await supabase.from('trupci').select('*').gte('datum_prijema', datumOd).lte('datum_prijema', datumDo);
                const ukupnoM3 = data.reduce((sum, item) => sum + parseFloat(item.zapremina || 0), 0);
                odgovor = `🪵 PRONAĐENO: Zaprimljeno je ${data.length} trupaca na lager, ukupne zapremine ${ukupnoM3.toFixed(2)} m³.`;
                siroviPodaci = { tip: 'trupci', podaci: data, naslov: `AI Izvještaj: Prijem Trupaca (${new Date(datumOd).toLocaleDateString('bs-BA')} do ${new Date(datumDo).toLocaleDateString('bs-BA')})` };
            } else if (upit.includes('nalo') || upit.includes('isporuk')) {
                const { data } = await supabase.from('radni_nalozi').select('*').neq('status', 'ZAVRŠENO').neq('status', 'ISPORUČENO');
                odgovor = `📄 PRONAĐENO: Trenutno imate ${data.length} aktivnih radnih naloga u proizvodnji.`;
                siroviPodaci = { tip: 'nalozi', podaci: data, naslov: `AI Izvještaj: Aktivni Nalozi` };
            } else if (upit.includes('zastoj') || upit.includes('kvar')) {
                const { data } = await supabase.from('dnevnik_masine').select('*').gte('datum', datumOd).lte('datum', datumDo);
                const ukupnoMinuta = data.reduce((sum, item) => sum + parseInt(item.zastoj_min || 0), 0);
                odgovor = `🛑 PRONAĐENO: U odabranom periodu zabilježeno je ${data.length} zastoja u trajanju od ${ukupnoMinuta} minuta.`;
            }
        } catch (err) { odgovor = "❌ Greška pri čitanju baze podataka."; }

        setAiOdgovor(odgovor);
        setAiData(siroviPodaci);
        setIsAILoading(false);
    };

    // --- GENERISANJE PDF-a ZA AI IZVJEŠTAJ ---
    const printAIReport = () => {
        if(!aiData) return;
        const printWin = window.open('', '_blank');
        const logoUrl = window.location.origin + '/Logo TTM.png';
        
        let headerRow = ''; let bodyRows = '';

        if(aiData.tip === 'paketi') {
            headerRow = '<th>Paket ID</th><th>Proizvod</th><th>Dimenzije</th><th style="text-align:right;">M³</th><th>Mašina</th><th>Snimio</th>';
            bodyRows = aiData.podaci.map(p => `<tr><td>${p.paket_id}</td><td>${p.naziv_proizvoda}</td><td>${p.debljina}x${p.sirina}x${p.duzina}</td><td style="text-align:right;"><b>${p.kolicina_final}</b></td><td>${p.masina || '-'}</td><td>${p.snimio_korisnik}</td></tr>`).join('');
        } else if(aiData.tip === 'trupci') {
            headerRow = '<th>Trupac ID</th><th>Pločica</th><th>Vrsta/Klasa</th><th>Dimenzije</th><th style="text-align:right;">M³</th>';
            bodyRows = aiData.podaci.map(t => `<tr><td>${t.id}</td><td>${t.broj_plocice || '-'}</td><td>${t.vrsta} / ${t.klasa}</td><td>L:${t.duzina} Ø:${t.promjer}</td><td style="text-align:right;"><b>${t.zapremina}</b></td></tr>`).join('');
        } else if(aiData.tip === 'nalozi') {
            headerRow = '<th>Broj Naloga</th><th>Kupac</th><th>Rok Isporuke</th><th>Status</th>';
            bodyRows = aiData.podaci.map(n => `<tr><td><b>${n.id}</b></td><td>${n.kupac_naziv}</td><td>${n.rok_isporuke}</td><td>${n.status}</td></tr>`).join('');
        }

        const html = `
            <html><head><title>${aiData.naslov}</title>
            <style>
                body { font-family: Arial, sans-serif; color: #333; padding: 40px; }
                .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background-color: #f1f5f9; }
            </style></head>
            <body>
                <div class="header">
                    <div><h2>${aiData.naslov}</h2><p>Generisano na osnovu AI upita: <i>"${aiUpit}"</i></p></div>
                    <img src="${logoUrl}" style="height: 60px;" onload="window.print(); window.close();" onerror="this.style.display='none'; window.print(); window.close();" />
                </div>
                <table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>
            </body></html>
        `;
        printWin.document.write(html); printWin.document.close();
    };

    // --- GENERISANJE PDF-a ZA DNEVNI/PERIODIČNI PROREZ ---
    const kreirajPDF = () => {
        const printWin = window.open('', '_blank');
        const logoUrl = window.location.origin + '/Logo TTM.png';
        
        let redovi = dashData.proizvodi.map(s => {
            const procenatGrada = dashData.gradaIzlaz > 0 ? ((s.m3 / dashData.gradaIzlaz) * 100).toFixed(1) : 0;
            const procenatTrupci = dashData.trupciUlaz > 0 ? ((s.m3 / dashData.trupciUlaz) * 100).toFixed(1) : 0;
            return `<tr><td style="border: 1px solid #ddd; padding: 10px;"><b>${s.naziv}</b></td><td style="border: 1px solid #ddd; padding: 10px; text-align: right;"><b>${s.m3.toFixed(2)}</b></td><td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${procenatGrada}%</td><td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${procenatTrupci}%</td></tr>`;
        }).join('');

        const ispisDatuma = tipDatuma === 'dan' ? new Date(datumOd).toLocaleDateString('bs-BA') : `${new Date(datumOd).toLocaleDateString('bs-BA')} - ${new Date(datumDo).toLocaleDateString('bs-BA')}`;

        const html = `
            <html><head><title>Izvještaj Proreza</title>
            <style>
                body { font-family: Arial, sans-serif; color: #333; padding: 40px; }
                .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
                .summary-grid { display: flex; justify-content: space-between; background: #f8fafc; padding: 20px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 20px; }
                .summary-box { text-align: center; } .summary-box span { display: block; font-size: 12px; color: #666; text-transform: uppercase; } .summary-box b { font-size: 20px; color: #000; }
                table { width: 100%; border-collapse: collapse; font-size: 14px; } th, td { border: 1px solid #ddd; padding: 10px; } th { background-color: #f1f5f9; text-align: left; }
            </style></head>
            <body>
                <div class="header">
                    <div><h2>IZVJEŠTAJ PROIZVODNJE</h2><p><b>${tipDatuma === 'dan' ? 'Datum:' : 'Period:'}</b> ${ispisDatuma}</p></div>
                    <img src="${logoUrl}" style="height: 60px;" onload="window.print(); window.close();" onerror="this.style.display='none'; window.print(); window.close();" />
                </div>
                <div class="summary-grid">
                    <div class="summary-box"><span>Ulaz Trupaca</span><b>${dashData.trupciUlaz} m³</b></div>
                    <div class="summary-box"><span>Gotova Građa</span><b>${dashData.gradaIzlaz} m³</b></div>
                    <div class="summary-box"><span>Iskorištenje</span><b>${dashData.iskoristenje}%</b></div>
                    <div class="summary-box"><span>Zastoji</span><b>${dashData.zastoji} min</b></div>
                </div>
                <table><thead><tr><th>Proizvod</th><th style="text-align:right;">M³</th><th style="text-align:right;">% od građe</th><th style="text-align:right;">% od trupca</th></tr></thead>
                <tbody>${redovi || '<tr><td colspan="4" style="text-align:center;">Nema podataka za ovaj period.</td></tr>'}</tbody></table>
            </body></html>
        `;
        printWin.document.write(html); printWin.document.close();
    };

    // --- GLAVNI DASHBOARD EKRAN ---
    if (!aktivanIzvjestaj) {
        return (
            <div className="p-4 max-w-6xl mx-auto space-y-6 animate-in fade-in relative">
                
                {/* DETALJNI MODAL ZA AI STAVKE */}
                {selectedAiItem && (
                    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-slate-900 border border-indigo-500 p-6 rounded-[2.5rem] shadow-2xl max-w-md w-full relative">
                            <button onClick={() => setSelectedAiItem(null)} className="absolute top-4 right-4 bg-slate-800 text-slate-400 hover:text-white hover:bg-red-500 w-8 h-8 rounded-full font-black flex items-center justify-center transition-all">✕</button>
                            <h3 className="text-indigo-400 font-black uppercase text-sm mb-4 border-b border-slate-700 pb-3">Detalji zapisa</h3>
                            
                            <div className="space-y-3 text-xs text-slate-300">
                                {selectedAiItem.tip === 'paketi' && (
                                    <>
                                        <div className="flex justify-between items-center"><span className="text-slate-500 uppercase font-black text-[9px]">Paket ID:</span><span className="text-white font-bold bg-slate-800 px-3 py-1 rounded-lg">{selectedAiItem.item.paket_id}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-slate-500 uppercase font-black text-[9px]">Proizvod:</span><span className="text-indigo-300 font-bold">{selectedAiItem.item.naziv_proizvoda}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-slate-500 uppercase font-black text-[9px]">Dimenzije:</span><span className="text-white font-bold">{selectedAiItem.item.debljina}x{selectedAiItem.item.sirina}x{selectedAiItem.item.duzina}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-slate-500 uppercase font-black text-[9px]">Zapremina:</span><span className="text-emerald-400 font-black text-base">{selectedAiItem.item.kolicina_final} m³</span></div>
                                        <div className="flex justify-between items-center"><span className="text-slate-500 uppercase font-black text-[9px]">Mašina / Lokacija:</span><span className="text-white font-bold">{selectedAiItem.item.masina || '-'} / {selectedAiItem.item.mjesto || '-'}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-slate-500 uppercase font-black text-[9px]">Kreirao:</span><span className="text-white font-bold">{selectedAiItem.item.snimio_korisnik}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-slate-500 uppercase font-black text-[9px]">Datum i vrijeme:</span><span className="text-white font-bold">{new Date(selectedAiItem.item.datum_yyyy_mm).toLocaleDateString('bs-BA')} u {selectedAiItem.item.vrijeme_tekst}</span></div>
                                        
                                        {selectedAiItem.item.oznake && selectedAiItem.item.oznake.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-slate-800">
                                                <span className="text-slate-500 block mb-2 uppercase font-black text-[9px]">Dodatne Oznake na paketu:</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedAiItem.item.oznake.map(o => <span key={o} className="bg-indigo-900/30 text-indigo-300 px-3 py-1 rounded-xl font-bold text-[10px] border border-indigo-500/30 shadow-inner uppercase">{o}</span>)}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                                {selectedAiItem.tip === 'trupci' && (
                                    <>
                                        <div className="flex justify-between items-center"><span className="text-slate-500 uppercase font-black text-[9px]">Trupac ID:</span><span className="text-white font-bold bg-slate-800 px-3 py-1 rounded-lg">{selectedAiItem.item.id}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-slate-500 uppercase font-black text-[9px]">Broj Pločice:</span><span className="text-white font-bold">{selectedAiItem.item.broj_plocice || 'Nema pločice'}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-slate-500 uppercase font-black text-[9px]">Vrsta i Klasa:</span><span className="text-indigo-300 font-bold uppercase">{selectedAiItem.item.vrsta} / Klasa {selectedAiItem.item.klasa}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-slate-500 uppercase font-black text-[9px]">Dimenzije:</span><span className="text-white font-bold">Dužina: {selectedAiItem.item.duzina}m | Promjer: {selectedAiItem.item.promjer}cm</span></div>
                                        <div className="flex justify-between items-center"><span className="text-slate-500 uppercase font-black text-[9px]">Zapremina:</span><span className="text-emerald-400 font-black text-base">{selectedAiItem.item.zapremina} m³</span></div>
                                        <div className="flex justify-between items-center"><span className="text-slate-500 uppercase font-black text-[9px]">Otpremnica:</span><span className="text-white font-bold">{selectedAiItem.item.otpremnica_broj || '-'}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-slate-500 uppercase font-black text-[9px]">Lokacija (Šumarija):</span><span className="text-white font-bold">{selectedAiItem.item.sumarija} ({selectedAiItem.item.podruznica})</span></div>
                                        <div className="flex justify-between items-center"><span className="text-slate-500 uppercase font-black text-[9px]">Datum prijema:</span><span className="text-white font-bold">{new Date(selectedAiItem.item.datum_prijema).toLocaleDateString('bs-BA')}</span></div>
                                    </>
                                )}
                                {selectedAiItem.tip === 'nalozi' && (
                                    <>
                                        <div className="flex justify-between items-center"><span className="text-slate-500 uppercase font-black text-[9px]">Broj Naloga:</span><span className="text-white font-bold bg-slate-800 px-3 py-1 rounded-lg">{selectedAiItem.item.id}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-slate-500 uppercase font-black text-[9px]">Kupac:</span><span className="text-indigo-300 font-bold uppercase">{selectedAiItem.item.kupac_naziv}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-slate-500 uppercase font-black text-[9px]">Status:</span><span className="bg-amber-900/30 text-amber-400 px-2 py-1 rounded font-black text-[9px] uppercase border border-amber-500/30">{selectedAiItem.item.status}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-slate-500 uppercase font-black text-[9px]">Rok Isporuke:</span><span className="text-white font-bold">{new Date(selectedAiItem.item.rok_isporuke).toLocaleDateString('bs-BA')}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-slate-500 uppercase font-black text-[9px]">Vezana ponuda:</span><span className="text-white font-bold">{selectedAiItem.item.broj_ponude || '-'}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-slate-500 uppercase font-black text-[9px]">Kreirao:</span><span className="text-white font-bold">{selectedAiItem.item.snimio_korisnik}</span></div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* HEADER */}
                <div className="flex flex-col md:flex-row justify-between items-center bg-[#0f172a] p-5 rounded-[2rem] border border-slate-800 shadow-2xl">
                    <div className="flex items-center gap-4 mb-4 md:mb-0">
                        <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase font-black text-white hover:bg-slate-700">← Meni</button>
                        <div className="h-10 w-32 bg-white rounded flex items-center justify-center font-black text-[#1e1b4b] italic overflow-hidden">
                            <img src="/Logo TTM.png" alt="TTM Logo" className="h-full object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerText = 'TTM LOGO'; }} />
                        </div>
                    </div>
                    
                    <h2 className="text-white font-black tracking-widest text-lg lg:text-xl uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] hidden lg:block mx-4">Pametna Analitika</h2>
                    
                    <FilterDatuma />
                </div>

                {/* AI GEMINI BAR */}
                <div className="relative bg-gradient-to-r from-blue-900/40 to-purple-900/40 p-1 rounded-2xl border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                    <div className="absolute left-4 top-3 text-xl">✨</div>
                    <input 
                        type="text" value={aiUpit} onChange={e => setAiUpit(e.target.value)} onKeyDown={e => {if(e.key === 'Enter') pokreniAI()}}
                        placeholder="Pitaj sistem o bazi (npr. 'Prikaži pakete za ovaj period')" 
                        className="w-full bg-[#0f172a] p-4 pl-12 rounded-xl text-sm text-white outline-none border border-transparent focus:border-blue-400 transition-all font-medium placeholder-slate-500"
                    />
                    <button onClick={pokreniAI} disabled={isAILoading} className="absolute right-2 top-2 bottom-2 px-6 bg-blue-600 rounded-lg text-white font-black text-xs hover:bg-blue-500 shadow-lg uppercase disabled:opacity-50">
                        {isAILoading ? 'Tražim...' : 'Pitaj AI'}
                    </button>
                </div>

                {/* AI ODGOVOR SA LISTOM (NOVO) */}
                {aiOdgovor && (
                    <div className="bg-slate-900 border border-indigo-500/50 p-5 rounded-[2rem] animate-in slide-in-from-top-4 shadow-2xl space-y-4">
                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                            <div className="text-4xl animate-bounce">🤖</div>
                            <div className="flex-1">
                                <h4 className="text-indigo-400 font-black text-[10px] uppercase mb-1 tracking-widest">Rezultat pretrage baze</h4>
                                <p className="text-white text-sm font-medium leading-relaxed bg-indigo-900/20 p-3 rounded-xl border border-indigo-500/30">{aiOdgovor}</p>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                                {aiData && <button onClick={printAIReport} className="bg-indigo-600 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-500 flex-1 md:flex-none transition-all">🖨️ Štampaj</button>}
                                <button onClick={() => {setAiOdgovor(null); setAiData(null); setSelectedAiItem(null);}} className="bg-slate-800 text-slate-400 px-5 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all">✕ Zatvori</button>
                            </div>
                        </div>

                        {/* LISTA PRONAĐENIH STAVKI */}
                        {aiData && aiData.podaci && aiData.podaci.length > 0 && (
                            <div className="pt-4 border-t border-slate-700/50">
                                <h5 className="text-[9px] text-slate-400 uppercase font-black mb-3">Pronađene stavke ({aiData.podaci.length}) - Klikni na karticu za detalje:</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2">
                                    {aiData.podaci.map((item, idx) => (
                                        <div key={idx} onClick={() => setSelectedAiItem({tip: aiData.tip, item})} className="bg-[#0f172a] p-4 rounded-2xl border border-slate-700 cursor-pointer hover:border-indigo-500 hover:bg-slate-800 transition-all flex justify-between items-center group shadow-lg">
                                            {aiData.tip === 'paketi' && (
                                                <><div className="overflow-hidden"><span className="text-white font-black text-xs block truncate">{item.paket_id}</span><span className="text-[10px] text-slate-400 uppercase block truncate mt-1">{item.naziv_proizvoda}</span></div><div className="text-indigo-400 font-black text-sm whitespace-nowrap bg-indigo-900/30 px-2 py-1 rounded-lg">{item.kolicina_final} m³</div></>
                                            )}
                                            {aiData.tip === 'trupci' && (
                                                <><div className="overflow-hidden"><span className="text-white font-black text-xs block truncate">{item.id}</span><span className="text-[10px] text-slate-400 uppercase block mt-1">{item.vrsta} / Kl: {item.klasa}</span></div><div className="text-indigo-400 font-black text-sm whitespace-nowrap bg-indigo-900/30 px-2 py-1 rounded-lg">{item.zapremina} m³</div></>
                                            )}
                                            {aiData.tip === 'nalozi' && (
                                                <><div className="overflow-hidden"><span className="text-white font-black text-xs block truncate">{item.id}</span><span className="text-[10px] text-slate-400 uppercase block mt-1 truncate">{item.kupac_naziv}</span></div><div className="text-amber-400 font-black text-[9px] uppercase whitespace-nowrap bg-amber-900/30 px-2 py-1 rounded-lg border border-amber-500/30">{item.status}</div></>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {loading ? (
                    <div className="text-center p-10 text-slate-500 font-black animate-pulse">Učitavanje podataka iz baze za odabrani period...</div>
                ) : (
                    <>
                        {/* INTERAKTIVNI KPI THUMBNAILI */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div onClick={() => setAktivanIzvjestaj('prorez')} className="bg-emerald-900/20 border border-emerald-500/30 p-5 rounded-3xl shadow-lg relative overflow-hidden cursor-pointer hover:scale-105 hover:bg-emerald-900/40 hover:border-emerald-500 transition-all group">
                                <div className="flex justify-between items-start">
                                    <div className="text-[10px] text-emerald-400 font-black uppercase tracking-wider mb-1">Prorez (m³)</div>
                                    <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full border border-emerald-500/30">{tipDatuma === 'dan' ? 'Dan' : 'Period'}</span>
                                </div>
                                <div className="text-4xl text-white font-black drop-shadow-[0_0_10px_rgba(16,185,129,0.8)] mt-2">{dashData.gradaIzlaz}</div>
                                <div className="text-[9px] text-slate-400 mt-2 flex justify-between"><span>Iskorištenje: {dashData.iskoristenje}%</span> <span className="group-hover:text-emerald-300">Detalji →</span></div>
                                <div className="absolute -right-4 -bottom-4 text-emerald-500/10 text-8xl transition-all group-hover:scale-110">🪚</div>
                            </div>
                            
                            <div onClick={() => setAktivanIzvjestaj('dovoz')} className="bg-blue-900/20 border border-blue-500/30 p-5 rounded-3xl shadow-lg relative overflow-hidden backdrop-blur-sm cursor-pointer hover:scale-105 hover:bg-blue-900/40 hover:border-blue-500 transition-all group">
                                <div className="flex justify-between items-start">
                                    <div className="text-[10px] text-blue-400 font-black uppercase tracking-wider mb-1">Dovoz Trupaca</div>
                                    <span className="text-[9px] font-black bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full border border-blue-500/30">{tipDatuma === 'dan' ? 'Dan' : 'Period'}</span>
                                </div>
                                <div className="text-4xl text-white font-black drop-shadow-[0_0_10px_rgba(59,130,246,0.8)] mt-2">{dashData.trupciUlaz} <span className="text-sm">m³</span></div>
                                <div className="text-[9px] text-slate-400 mt-2 flex justify-between"><span>Zapr. trupaca: {dashData.trupciLista.length} kom</span> <span className="group-hover:text-blue-300">Detalji →</span></div>
                                <div className="absolute -right-4 -bottom-4 text-blue-500/10 text-8xl transition-all group-hover:scale-110">🪵</div>
                            </div>
                            
                            <div onClick={() => setAktivanIzvjestaj('nalozi')} className="bg-amber-900/20 border border-amber-500/30 p-5 rounded-3xl shadow-lg relative overflow-hidden backdrop-blur-sm cursor-pointer hover:scale-105 hover:bg-amber-900/40 hover:border-amber-500 transition-all group">
                                <div className="flex justify-between items-start">
                                    <div className="text-[10px] text-amber-400 font-black uppercase tracking-wider mb-1">Aktivni Nalozi</div>
                                    <span className="text-[9px] font-black bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full border border-amber-500/30">U radu</span>
                                </div>
                                <div className="text-4xl text-white font-black drop-shadow-[0_0_10px_rgba(245,158,11,0.8)] mt-2">{dashData.aktivniNalozi}</div>
                                <div className="text-[9px] text-slate-400 mt-2 flex justify-between"><span>Dinamika isporuka</span> <span className="group-hover:text-amber-300">Detalji →</span></div>
                                <div className="absolute -right-4 -bottom-4 text-amber-500/10 text-8xl transition-all group-hover:scale-110">📄</div>
                            </div>
                            
                            <div className="bg-red-900/20 border border-red-500/30 p-5 rounded-3xl shadow-lg relative overflow-hidden backdrop-blur-sm">
                                <div className="flex justify-between items-start">
                                    <div className="text-[10px] text-red-400 font-black uppercase tracking-wider mb-1">Zastoji</div>
                                </div>
                                <div className="text-4xl text-white font-black drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] mt-2">{formatirajVrijeme(dashData.zastoji)}</div>
                                <div className="text-[9px] text-slate-400 mt-2">Ukupno: {dashData.zastoji} min</div>
                                <div className="absolute -right-4 -bottom-4 text-red-500/10 text-8xl">🛑</div>
                            </div>
                        </div>

                        {/* BRZI PREGLED */}
                        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl opacity-70 hover:opacity-100 transition-all">
                            <h3 className="text-slate-400 font-black uppercase text-xs mb-4 text-center">Brzi pregled iskorištenja ({tipDatuma === 'dan' ? 'Odabrani Dan' : 'Odabrani Period'})</h3>
                            <div className="h-16 w-full bg-slate-900 rounded-full overflow-hidden flex border border-slate-800 relative">
                                <div className="h-full bg-emerald-500/80 flex items-center justify-center font-black text-xs text-white overflow-hidden whitespace-nowrap px-2 transition-all duration-1000" style={{width: `${Math.max(dashData.iskoristenje, 15)}%`}}>Gotova Građa ({dashData.iskoristenje}%)</div>
                                <div className="h-full bg-red-500/80 flex items-center justify-center font-black text-[10px] text-white flex-1 overflow-hidden transition-all duration-1000">Okorci / Rastur / Piljevina</div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    }

    // --- DETALJNI IZVJEŠTAJI ---

    // 1. IZVJEŠTAJ: DNEVNI PROREZ (SA PRINTOM)
    if (aktivanIzvjestaj === 'prorez') {
        return (
            <div className="p-4 max-w-6xl mx-auto space-y-6 animate-in slide-in-from-bottom">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-[#1e293b] p-4 rounded-[2.5rem] border border-slate-700 shadow-lg">
                    <button onClick={() => setAktivanIzvjestaj(null)} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase font-black text-white hover:bg-slate-700 self-start md:self-auto">← Nazad na Dashboard</button>
                    <FilterDatuma />
                    <button onClick={kreirajPDF} className="bg-red-900/30 text-red-400 px-6 py-3 rounded-xl text-[10px] font-black uppercase border border-red-500/50 hover:bg-red-600 hover:text-white transition-all shadow-lg flex items-center gap-2 self-end md:self-auto">
                        <span>🖨️ Štampaj PDF</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-6">
                        <div className="bg-[#1e293b] p-6 rounded-3xl border border-slate-700 shadow-xl">
                            <h3 className="text-blue-400 font-black text-xs uppercase mb-4 border-b border-slate-700 pb-3">🪵 ULAZ: Trupci ({tipDatuma === 'dan' ? 'Dan' : 'Period'})</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm items-center"><span className="text-slate-400 text-[10px] uppercase font-bold">Zabilježeno komada:</span><span className="text-white font-black bg-slate-800 px-3 py-1 rounded-lg">{dashData.trupciLista.length}</span></div>
                                <div className="flex justify-between text-lg mt-2 pt-4 border-t border-slate-700 items-center"><span className="text-slate-300 font-black text-[10px] uppercase">Ukupna zapremina:</span><span className="text-blue-400 font-black text-2xl">{dashData.trupciUlaz} m³</span></div>
                            </div>
                        </div>
                    </div>
                    <div className="col-span-2 bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl">
                        <h3 className="text-slate-300 font-black uppercase text-sm tracking-widest mb-6">Specifikacija proizvedene građe</h3>
                        <table className="w-full text-left border-collapse mb-6">
                            <thead>
                                <tr className="text-[10px] text-slate-400 uppercase border-b border-slate-700 bg-slate-900/50">
                                    <th className="p-4 font-black rounded-tl-xl">Proizvod</th><th className="p-4 font-black text-right">M³</th><th className="p-4 font-black text-right">% (od građe)</th><th className="p-4 font-black text-right rounded-tr-xl">% (od trupca)</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm font-medium">
                                {dashData.proizvodi.length === 0 && <tr><td colSpan="4" className="text-center p-6 text-slate-500 font-bold">Nema zabilježene građe za ovaj period.</td></tr>}
                                {dashData.proizvodi.map((s, idx) => {
                                    const procGrada = dashData.gradaIzlaz > 0 ? ((s.m3 / dashData.gradaIzlaz) * 100).toFixed(1) : 0;
                                    const procTrupci = dashData.trupciUlaz > 0 ? ((s.m3 / dashData.trupciUlaz) * 100).toFixed(1) : 0;
                                    return (
                                        <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                            <td className="p-4 text-white">{s.naziv}</td><td className="p-4 text-emerald-400 font-black text-right bg-emerald-900/10">{s.m3.toFixed(2)}</td><td className="p-4 text-blue-300 text-right">{procGrada}%</td><td className="p-4 text-slate-400 text-right">{procTrupci}%</td>
                                        </tr>
                                    )
                                })}
                                <tr className="bg-emerald-900/30 border-y-2 border-emerald-500/50">
                                    <td className="p-5 text-emerald-400 font-black uppercase text-xs rounded-bl-xl">R. Građa (Ukupno)</td><td className="p-5 text-emerald-400 font-black text-right text-xl">{dashData.gradaIzlaz}</td><td className="p-5 text-emerald-400 font-black text-right">100%</td><td className="p-5 text-emerald-400 font-black text-right text-2xl rounded-br-xl">{dashData.iskoristenje}%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // 2. IZVJEŠTAJ: DOVOZ TRUPACA 
    if (aktivanIzvjestaj === 'dovoz') {
        return (
            <div className="p-4 max-w-4xl mx-auto space-y-6 animate-in slide-in-from-right">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-[#1e293b] p-4 rounded-[2.5rem] border border-slate-700 shadow-lg">
                    <button onClick={() => setAktivanIzvjestaj(null)} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase font-black text-white hover:bg-slate-700 self-start md:self-auto">← Nazad</button>
                    <FilterDatuma />
                </div>
                <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-4">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                        <h3 className="text-white font-black text-sm uppercase tracking-widest text-blue-400">🚚 Evidentirani trupci</h3>
                        <span className="text-blue-400 font-black bg-blue-900/30 px-4 py-2 rounded-xl border border-blue-500/30 shadow-inner">Ukupno: {dashData.trupciUlaz} m³</span>
                    </div>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                        {dashData.trupciLista.length === 0 && <p className="text-slate-500 text-sm text-center py-10 font-bold border-2 border-dashed border-slate-700 rounded-2xl">Nema prijavljenih trupaca u odabranom periodu.</p>}
                        {dashData.trupciLista.map((t, idx) => (
                            <div key={idx} className="flex justify-between p-4 bg-slate-900 rounded-2xl border border-slate-800 hover:border-blue-500 transition-all shadow-lg">
                                <div>
                                    <span className="text-sm text-white font-black block mb-1">Otpremnica: <span className="text-blue-400">{t.otpremnica_broj || 'N/A'}</span></span>
                                    <span className="text-[10px] text-slate-400 uppercase font-black bg-slate-800 px-2 py-1 rounded-md">{t.vrsta} | Klasa {t.klasa}</span>
                                </div>
                                <div className="text-right flex flex-col justify-between items-end">
                                    <div className="text-emerald-400 font-black text-xl">{parseFloat(t.zapremina || 0).toFixed(2)} <span className="text-xs text-emerald-600">m³</span></div>
                                    <div className="text-[9px] text-slate-500 uppercase font-bold mt-1">{new Date(t.datum_prijema).toLocaleDateString('bs-BA')}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // 3. IZVJEŠTAJ: RADNI NALOZI (DETALJNO SA PROCENTIMA ZAVRŠETKA)
    if (aktivanIzvjestaj === 'nalozi') {
        if (detaljiNaloga) {
            const stavkeNaloga = detaljiNaloga.stavke_jsonb || [];
            let sumNaruceno = 0; let sumNapravljeno = 0;
            stavkeNaloga.forEach(s => {
                sumNaruceno += parseFloat(s.kolicina_obracun || 0);
                sumNapravljeno += parseFloat(s.napravljeno || 0);
            });
            const procenatNaloga = sumNaruceno > 0 ? Math.min(((sumNapravljeno / sumNaruceno) * 100), 100).toFixed(0) : 0;

            return (
                <div className="p-4 max-w-4xl mx-auto space-y-6 animate-in slide-in-from-right">
                    <div className="flex justify-between items-center bg-[#1e293b] p-4 rounded-[2rem] border border-amber-500/50 shadow-lg">
                        <button onClick={() => setDetaljiNaloga(null)} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase font-black text-white hover:bg-slate-700">← Nazad na listu</button>
                        <h2 className="text-amber-400 font-black tracking-widest uppercase text-xs md:text-sm">Detalji Naloga: {detaljiNaloga.id}</h2>
                    </div>

                    <div className="bg-[#1e293b] p-6 md:p-8 rounded-[2.5rem] border border-slate-700 shadow-2xl">
                        <div className="flex flex-col md:flex-row justify-between md:items-end border-b border-slate-700 pb-6 mb-6 gap-4">
                            <div>
                                <p className="text-white font-black text-2xl mb-1">{detaljiNaloga.kupac_naziv}</p>
                                <p className="text-xs text-slate-400 uppercase font-bold">Rok isporuke: <span className="text-white bg-slate-800 px-2 py-0.5 rounded ml-1">{new Date(detaljiNaloga.rok_isporuke).toLocaleDateString('bs-BA')}</span></p>
                            </div>
                            <div className="md:text-right">
                                <span className="bg-amber-900/40 text-amber-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-amber-500/30 shadow-inner">{detaljiNaloga.status}</span>
                            </div>
                        </div>

                        <div className="mb-8 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-inner">
                            <div className="flex justify-between text-xs font-black uppercase text-slate-400 mb-3"><span>Ukupni Napredak Proizvodnje</span><span className="text-emerald-400 text-lg">{procenatNaloga}%</span></div>
                            <div className="w-full bg-slate-950 rounded-full h-4 overflow-hidden border border-slate-800 relative">
                                <div className="bg-emerald-500 h-full transition-all duration-1000 relative overflow-hidden" style={{width: `${procenatNaloga}%`}}>
                                    <div className="absolute inset-0 bg-white/20 w-full h-full animate-[pulse_2s_ease-in-out_infinite]"></div>
                                </div>
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-500 font-black uppercase mt-2">
                                <span>Ukupno naručeno: {sumNaruceno.toFixed(2)}</span>
                                <span>Ukupno proizvedeno: {sumNapravljeno.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-4">Specifikacija i status stavki:</h4>
                            {stavkeNaloga.map((st, i) => {
                                const nar = parseFloat(st.kolicina_obracun || 0);
                                const nap = parseFloat(st.napravljeno || 0);
                                const fali = Math.max(nar - nap, 0);
                                const p = nar > 0 ? Math.min(((nap / nar) * 100), 100).toFixed(0) : 0;
                                
                                return (
                                    <div key={i} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 hover:border-amber-500/30 transition-all shadow-lg">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-white text-sm font-black">{st.sifra} <span className="text-slate-400 font-normal ml-1">{st.naziv}</span></span>
                                            <span className={`text-xs font-black px-3 py-1 rounded-lg shadow-inner ${p == 100 ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/30' : 'bg-blue-900/40 text-blue-400 border border-blue-500/30'}`}>{p}%</span>
                                        </div>
                                        <div className="w-full bg-slate-950 rounded-full h-2 mb-4 overflow-hidden border border-slate-800">
                                            <div className={`${p == 100 ? 'bg-emerald-500' : 'bg-blue-500'} h-full transition-all duration-1000`} style={{width: `${p}%`}}></div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-[10px] uppercase font-black bg-[#0f172a] p-3 rounded-xl border border-slate-700/50 text-center">
                                            <div className="flex flex-col"><span className="text-slate-500 mb-1">Naručeno</span><span className="text-white text-sm">{nar} <span className="text-[9px] text-slate-500">{st.jm_obracun}</span></span></div>
                                            <div className="flex flex-col border-x border-slate-800"><span className="text-slate-500 mb-1">Urađeno</span><span className="text-emerald-400 text-sm">{nap} <span className="text-[9px] text-emerald-700">{st.jm_obracun}</span></span></div>
                                            <div className="flex flex-col"><span className="text-slate-500 mb-1">Preostalo</span><span className="text-amber-400 text-sm">{fali.toFixed(2)} <span className="text-[9px] text-amber-700">{st.jm_obracun}</span></span></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            );
        }

        // Prikaz liste naloga
        return (
            <div className="p-4 max-w-4xl mx-auto space-y-6 animate-in slide-in-from-right">
                <div className="flex justify-between items-center bg-[#1e293b] p-4 rounded-[2rem] border border-slate-700 shadow-lg">
                    <button onClick={() => setAktivanIzvjestaj(null)} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase font-black text-white hover:bg-slate-700">← Nazad</button>
                    <h2 className="text-amber-400 font-black tracking-widest uppercase text-sm mx-4">📄 Aktivni Nalozi</h2>
                    <div className="w-20 hidden md:block"></div> {/* Spacer za centriranje */}
                </div>
                <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-4">
                    <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-4 border-b border-slate-700 pb-3">Kliknite na nalog za pregled procenta završetka stavki</h3>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                        {dashData.naloziLista.length === 0 && <p className="text-center p-10 text-slate-500 text-sm font-bold border-2 border-dashed border-slate-700 rounded-2xl">Svi nalozi su završeni.</p>}
                        {dashData.naloziLista.map(n => (
                            <div key={n.id} onClick={() => setDetaljiNaloga(n)} className="flex flex-col md:flex-row justify-between md:items-center gap-4 p-5 bg-slate-900 rounded-2xl border border-slate-800 cursor-pointer hover:border-amber-500 hover:bg-slate-800 transition-all shadow-lg group">
                                <div>
                                    <span className="text-sm text-amber-400 font-black block mb-1 group-hover:scale-105 transition-all origin-left">{n.id}</span>
                                    <span className="text-xs text-white uppercase font-bold">{n.kupac_naziv}</span>
                                </div>
                                <div className="md:text-right flex flex-col md:items-end justify-between">
                                    <span className="text-[10px] text-slate-500 font-black uppercase mb-2 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">Rok: {new Date(n.rok_isporuke).toLocaleDateString('bs-BA') || 'N/A'}</span>
                                    <span className="text-[9px] font-black bg-amber-900/40 text-amber-400 px-3 py-1 rounded-lg uppercase border border-amber-500/30 shadow-inner">{n.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
// ============================================================================
// MODUL: DORADA
// ============================================================================
// ============================================================================
// MODUL: DORADA
// ============================================================================
// ============================================================================
// MODUL: DORADA
// ============================================================================
function DoradaModule({ user, header, setHeader, onExit }) {
    const [ulazScan, setUlazScan] = useState('');
    const [izlazScan, setIzlazScan] = useState('');
    const [radniNalog, setRadniNalog] = useState('');
    const [rnStavke, setRnStavke] = useState([]);
    
    const [katalog, setKatalog] = useState([]);
    const [aktivniNalozi, setAktivniNalozi] = useState([]);

    const [activeUlazIds, setActiveUlazIds] = useState([]);
    const [activeIzlazIds, setActiveIzlazIds] = useState([]);
    const [selectedIzlazId, setSelectedIzlazId] = useState('');
    const [izlazPackageItems, setIzlazPackageItems] = useState([]);
    
    const [activeEditItem, setActiveEditItem] = useState(null);
    const [updateMode, setUpdateMode] = useState('dodaj');
    
    const [form, setForm] = useState({ naziv: '', debljina: '', sirina: '', duzina: '', kolicina_ulaz: '', jm: 'kom', rn_jm: 'm3', rn_stavka_id: null, naruceno: 0, napravljeno: 0 });
    const [isScanning, setIsScanning] = useState(false);
    const [scanTarget, setScanTarget] = useState('');

    // NOVO: Dinamičke oznake
    const [dostupneOznake, setDostupneOznake] = useState([]); 
    const [odabraneOznake, setOdabraneOznake] = useState([]);

    const izlazTimerRef = useRef(null);
    const ulazTimerRef = useRef(null);

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
    }, [header.masina]);

    const handleNalogSelect = async (val) => {
        if(!val) return;
        setRadniNalog(val);
        const {data} = await supabase.from('radni_nalozi').select('*').eq('id', val.toUpperCase()).maybeSingle();
        if (data) {
            const ucitaneStavke = data.stavke_jsonb || data.stavke || [];
            if (ucitaneStavke.length > 0) {
                const mapiraneStavke = ucitaneStavke.map(s => ({
                    id: s.id, sifra_proizvoda: s.sifra, naziv_proizvoda: s.naziv,
                    jm: s.jm_obracun || s.jm_unos || 'm3', naruceno: s.kolicina_obracun || s.kolicina || 0, napravljeno: s.napravljeno || 0
                }));
                setRnStavke(mapiraneStavke);
            } else { alert(`Nalog ${val} nema stavki!`); setRnStavke([]); }
        } else { alert(`Nalog ${val} ne postoji!`); setRnStavke([]); }
    };

    const handleStavkaSelect = async (stavka) => {
        const {data: kat} = await supabase.from('katalog_proizvoda').select('*').eq('sifra', stavka.sifra_proizvoda).maybeSingle();
        setForm({ 
            ...form, naziv: stavka.naziv_proizvoda, debljina: kat?.visina||'', sirina: kat?.sirina||'', duzina: kat?.duzina||'', 
            jm: 'kom', rn_jm: stavka.jm, rn_stavka_id: stavka.id, 
            naruceno: parseFloat(stavka.naruceno).toFixed(4), napravljeno: parseFloat(stavka.napravljeno || 0).toFixed(4) 
        });
        window.scrollTo({ top: 600, behavior: 'smooth' });
    };

    const processUlaz = async (val) => {
        const id = val.toUpperCase().trim();
        if (activeUlazIds.includes(id)) { setUlazScan(''); return; }
        const { data } = await supabase.from('paketi').select('id').eq('paket_id', id).limit(1);
        if (data && data.length > 0) { 
            setActiveUlazIds(prev => [...prev, id]); 
            setUlazScan(''); 
        } else { 
            alert(`⚠️ ULAZNI paket ${id} ne postoji u bazi! Provjerite QR kod.`); 
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

    const processIzlaz = async (val) => {
        const id = val.toUpperCase().trim();
        if (!activeIzlazIds.includes(id)) {
            const { data: existing } = await supabase.from('paketi').select('*').eq('paket_id', id);
            if (existing && existing.length > 0) {
                const spisak = existing.map(i => `- ${i.naziv_proizvoda}: ${i.kolicina_final} ${i.jm}`).join('\n');
                if (!window.confirm(`📦 PAKET VEĆ POSTOJI: ${id}\n\nTrenutno sadrži:\n${spisak}\n\nDa li želite AŽURIRATI ovaj paket?\n(OK = Ažuriraj, Cancel = Poništi unos)`)) { 
                    setIzlazScan(''); 
                    return; 
                }
            }
            setActiveIzlazIds(p => [...p, id]);
        }
        setSelectedIzlazId(id);
        fetchIzlaz(id); 
        setIzlazScan('');
    };

    const handleIzlazInput = (val, isEnter = false) => {
        setIzlazScan(val);
        if (izlazTimerRef.current) clearTimeout(izlazTimerRef.current);
        if (!val) return;
        if (isEnter) processIzlaz(val);
        else izlazTimerRef.current = setTimeout(() => processIzlaz(val), 2000);
    };

    const fetchIzlaz = async (pid) => { const { data } = await supabase.from('paketi').select('*').eq('paket_id', pid); setIzlazPackageItems(data || []); };

    const toggleOznaka = (o) => {
        setOdabraneOznake(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o]);
    };

    const saveIzlaz = async () => {
        if (!selectedIzlazId) return alert("Prvo skenirajte IZLAZNI PAKET!");
        if (activeUlazIds.length === 0 && !window.confirm("Niste učitali nijedan ULAZNI paket (sirovinu). Da li sigurno želite snimiti izlaz?")) return;
        if (!form.kolicina_ulaz) return alert("Unesite količinu prije snimanja!");

        const timeNow = new Date().toLocaleTimeString('de-DE');
        const unosKol = parseFloat(form.kolicina_ulaz);
        const v = parseFloat(form.debljina) || 1;
        const s = parseFloat(form.sirina) || 1;
        const d = parseFloat(form.duzina) || 1;

        let komada = unosKol;
        if (form.jm === 'm3') komada = unosKol / ((v/100) * (s/100) * (d/100));
        else if (form.jm === 'm2') komada = unosKol / ((s/100) * (d/100));
        else if (form.jm === 'm1') komada = unosKol / (d/100);

        const qtyZaPaket = parseFloat((komada * (v/100) * (s/100) * (d/100)).toFixed(3));

        if (activeEditItem) {
            const newM3 = updateMode === 'dodaj' ? parseFloat(activeEditItem.kolicina_final) + qtyZaPaket : parseFloat(activeEditItem.kolicina_final) - qtyZaPaket;
            const { error } = await supabase.from('paketi').update({ 
                kolicina_final: parseFloat(newM3.toFixed(3)), 
                vrijeme_tekst: timeNow, 
                snimio_korisnik: user.ime_prezime,
                oznake: odabraneOznake.length > 0 ? odabraneOznake : activeEditItem.oznake
            }).eq('id', activeEditItem.id);
            if (error) return alert("❌ GREŠKA PRI AŽURIRANJU PAKETA: " + error.message);
        } else {
            const { error } = await supabase.from('paketi').insert([{ 
                paket_id: selectedIzlazId, naziv_proizvoda: form.naziv, debljina: form.debljina, sirina: form.sirina, duzina: form.duzina, 
                kolicina_ulaz: form.kolicina_ulaz, jm: form.jm, kolicina_final: qtyZaPaket, 
                mjesto: header.mjesto, masina: header.masina, snimio_korisnik: user.ime_prezime, vrijeme_tekst: timeNow, datum_yyyy_mm: header.datum,
                ai_sirovina_ids: activeUlazIds,
                oznake: odabraneOznake // NOVO: Spasavanje oznaka
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
        fetchIzlaz(selectedIzlazId); 
        setForm(f => ({...f, kolicina_ulaz: ''})); 
        setOdabraneOznake([]);
        setActiveEditItem(null);
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
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-amber-500" user={user} />
            <h2 className="text-amber-500 text-center font-black tracking-widest uppercase">🔄 DORADA - ULAZ / IZLAZ</h2>
            
            <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-amber-500/30 shadow-2xl space-y-5">
                <div className="relative font-black border-b border-slate-700 pb-5">
                    <label className="text-[8px] text-red-400 uppercase ml-4 block mb-1">SKENIRAJ ULAZNI PAKET (SIROVINA)</label>
                    <input type="text" value={ulazScan} onChange={e => handleUlazInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') handleUlazInput(ulazScan, true)}} placeholder="Učitaj ili skeniraj..." className="w-full p-5 bg-slate-900 border border-red-500/50 rounded-2xl text-center text-white outline-none focus:border-red-500 uppercase shadow-inner" />
                    <button onClick={() => {setScanTarget('ulaz'); setIsScanning(true);}} className="absolute right-3 top-7 bottom-3 px-4 bg-red-600/20 text-red-400 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-all shadow-lg">📷</button>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {activeUlazIds.map(id => (
                        <div key={id} className="bg-red-900/30 border border-red-500 text-red-400 px-3 py-1 rounded-lg text-xs font-black uppercase flex items-center gap-2 shadow-lg">
                            {id} <button onClick={() => setActiveUlazIds(a => a.filter(x => x !== id))} className="hover:text-white">✕</button>
                        </div>
                    ))}
                </div>

                <div className="relative font-black bg-blue-900/20 p-4 rounded-2xl border border-blue-500/30">
                    <label className="text-[8px] text-blue-400 uppercase ml-2 block mb-1">RADNI NALOG</label>
                    <PD_SearchableRN nalozi={aktivniNalozi} value={radniNalog} onSelect={handleNalogSelect} onScanClick={() => {setScanTarget('nalog'); setIsScanning(true);}} />
                    
                    {rnStavke.length > 0 && (
                        <div className="mt-3 space-y-2 border-t border-blue-500/30 pt-3">
                            {rnStavke.map(s => (
                                <div key={s.id} onClick={() => handleStavkaSelect(s)} className="flex justify-between items-center p-3 bg-slate-800 rounded-xl cursor-pointer hover:bg-blue-600 transition-all border border-slate-700">
                                    <span className="text-[10px] text-white font-bold">{s.naziv_proizvoda}</span>
                                    <span className="text-[9px] text-emerald-300 font-black">Nar: {s.naruceno} | Ur: {s.napravljeno}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="relative font-black border-t border-slate-700 pt-5">
                    <label className="text-[8px] text-emerald-500 uppercase ml-4 block mb-1">QR IZLAZNOG PAKETA (GOTOVO)</label>
                    <input type="text" value={izlazScan} onChange={e => handleIzlazInput(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') handleIzlazInput(izlazScan, true) }} placeholder="Upiši ili skeniraj..." className="w-full p-5 bg-[#0f172a] border-2 border-emerald-500 rounded-2xl text-center text-xl text-white outline-none focus:border-emerald-500 uppercase font-black shadow-[0_0_15px_rgba(16,185,129,0.2)]" />
                    <button onClick={() => {setScanTarget('izlaz'); setIsScanning(true);}} className="absolute right-3 top-12 bottom-3 px-4 bg-emerald-600 rounded-xl text-white font-bold hover:bg-emerald-500 shadow-lg">📷</button>
                </div>
                
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {activeIzlazIds.map(id => (
                        <div key={id} className={`flex items-center rounded-xl border-2 transition-all ${selectedIzlazId === id ? 'bg-emerald-600 border-white font-black shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-800 border-slate-700'}`}>
                            <button onClick={() => {setSelectedIzlazId(id); fetchIzlaz(id);}} className="px-4 py-2">{id}</button>
                            <button onClick={() => otkaziPaket(id)} className="px-3 py-2 text-red-300 hover:text-white hover:bg-red-500 rounded-r-lg font-black border-l border-slate-700">✕</button>
                        </div>
                    ))}
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
                            <div className="flex justify-between bg-blue-900/30 p-3 rounded-xl border border-blue-500/30 mt-2">
                                <div className="text-[10px] text-blue-300 uppercase">Naručeno: <b className="text-white text-xs">{form.naruceno}</b></div>
                                <div className="text-[10px] text-emerald-400 uppercase">Dosad urađeno: <b className="text-white text-xs">{form.napravljeno}</b></div>
                            </div>
                        )}
                        <div className="grid grid-cols-3 gap-2 mt-2">
                            <DimBox label="Deb" val={form.debljina} set={v => setForm({...form, debljina: v})} disabled={!!activeEditItem} />
                            <DimBox label="Šir" val={form.sirina} set={v => setForm({...form, sirina: v})} disabled={!!activeEditItem} />
                            <DimBox label="Duž" val={form.duzina} set={v => setForm({...form, duzina: v})} disabled={!!activeEditItem} />
                        </div>
                        <div className="flex gap-2">
                            <input type="number" value={form.kolicina_ulaz} onKeyDown={e => {if(e.key==='Enter') saveIzlaz()}} onChange={e => setForm({...form, kolicina_ulaz: e.target.value})} className="flex-1 p-4 bg-[#0f172a] border-2 border-slate-700 rounded-2xl text-2xl text-center text-white font-black" placeholder="Količina..." />
                            <select value={form.jm} onChange={e => setForm({...form, jm: e.target.value})} className="bg-slate-800 px-4 rounded-xl text-white font-black outline-none border border-slate-700 focus:border-emerald-500">
                                <option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option>
                            </select>
                        </div>

                        {/* NOVO: Dodatne operacije (Oznake) */}
                        {dostupneOznake.length > 0 && (
                            <div className="space-y-2 mt-4 bg-slate-950 p-3 rounded-xl border border-slate-800">
                                <label className="text-[9px] text-slate-400 uppercase font-black ml-1">Dodatne operacije na paketu:</label>
                                <div className="flex flex-wrap gap-2">
                                    {dostupneOznake.map(o => (
                                        <button 
                                            key={o} 
                                            onClick={() => toggleOznaka(o)}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${odabraneOznake.includes(o) ? 'bg-amber-600 border-amber-400 text-white shadow-[0_0_10px_rgba(217,119,6,0.4)]' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                        >
                                            {odabraneOznake.includes(o) ? '✓ ' : '+ '} {o}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button onClick={saveIzlaz} className="w-full py-6 mt-4 bg-emerald-600 text-white font-black rounded-2xl uppercase shadow-xl hover:opacity-90">{activeEditItem ? `✅ AŽURIRAJ STAVKU` : `✅ SNIMI STAVKU`}</button>
                        
                        <div className="pt-4 space-y-2 max-h-52 overflow-y-auto border-t border-slate-700">
                            {izlazPackageItems.map(item => (
                                <div key={item.id} onClick={() => { setActiveEditItem(item); setForm({...item, kolicina_ulaz: '' }); }} className="flex justify-between items-center p-4 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:border-emerald-500">
                                    <div>
                                        <div className="text-[10px] uppercase text-white font-bold">{item.naziv_proizvoda}</div>
                                        <div className="text-emerald-500 text-lg font-black tracking-tighter">{item.debljina}x{item.sirina}x{item.duzina}</div>
                                        {item.oznake && item.oznake.length > 0 && (
                                            <div className="flex gap-1 mt-1">
                                                {item.oznake.map(o => <span key={o} className="text-[8px] bg-amber-900/30 text-amber-400 px-1.5 py-0.5 rounded uppercase font-bold border border-amber-500/30">{o}</span>)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right font-black"><div className="text-xl text-white">{item.kolicina_final} m³</div><div className="text-[9px] text-slate-500">{item.kolicina_ulaz} {item.jm}</div></div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <DnevnikMasine modul="Dorada" header={header} user={user} />
            {isScanning && <ScannerOverlay onScan={(text) => { if(scanTarget==='nalog') handleNalogSelect(text); else if(scanTarget==='ulaz') handleUlazInput(text, true); else handleIzlazInput(text, true); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}

// ============================================================================
// PODEŠAVANJA (RADNICI, KUPCI, KATALOG, MAŠINE, ŠUMARIJE, OPERACIJE)
// ============================================================================
// PODEŠAVANJA (RADNICI, KUPCI, KATALOG, MAŠINE, ŠUMARIJE, OPERACIJE)
// ============================================================================

// Pomoćni pametni dropdown samo za Podešavanja
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

// --- POD-MODULI PODEŠAVANJA ---

function TabSumarije() {
    const loggedUser = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');

    const [sumarije, setSumarije] = useState([]);
    const [podruznice, setPodruznice] = useState([]);
    
    // Šumarije State
    const [formSum, setFormSum] = useState({ id: null, naziv: '' });
    const [isEditingSum, setIsEditingSum] = useState(false);
    const [warningSum, setWarningSum] = useState(null);
    const timerSum = useRef(null);

    // Podružnice State
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

    // =========================================================
    // LOGIKA: ŠUMARIJE
    // =========================================================
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

    const pokreniIzmjenuSum = (item) => {
        setFormSum({ id: item.id, naziv: item.naziv });
        setIsEditingSum(true); setWarningSum(null);
    };

    const ponistiIzmjenuSum = () => {
        setFormSum({ id: null, naziv: '' });
        setIsEditingSum(false); setWarningSum(null);
    };

    const saveSumarija = async () => {
        if(!formSum.naziv) return alert("Unesite naziv šumarije!");
        
        if(isEditingSum) {
            const {error} = await supabase.from('sumarije').update({ naziv: formSum.naziv }).eq('id', formSum.id);
            if(error) return alert("Greška: " + error.message);
            await zapisiU_Log('IZMJENA_SUMARIJE', `Ažurirana šumarija: ${formSum.naziv}`);
            alert("✅ Šumarija uspješno ažurirana!");
        } else {
            const postoji = sumarije.find(s => s.naziv === formSum.naziv);
            if(postoji) return alert("❌ Šumarija već postoji!");

            const {error} = await supabase.from('sumarije').insert([{ naziv: formSum.naziv }]);
            if(error) return alert("Greška: " + error.message);
            await zapisiU_Log('DODAVANJE_SUMARIJE', `Dodana šumarija: ${formSum.naziv}`);
            alert("✅ Šumarija uspješno dodana!");
        }
        ponistiIzmjenuSum(); load();
    };

    const obrisiSumariju = async (id, naziv) => {
        if(window.confirm(`Brisati šumariju: ${naziv}?\nPAŽNJA: Obrisaće se i njene podružnice!`)) {
            await supabase.from('sumarije').delete().eq('id', id);
            await zapisiU_Log('BRISANJE_SUMARIJE', `Obrisana šumarija: ${naziv}`);
            load();
        }
    };

    // =========================================================
    // LOGIKA: PODRUŽNICE
    // =========================================================
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

    const pokreniIzmjenuPodr = (item) => {
        setFormPodr({ id: item.id, sumarija_naziv: item.sumarija_naziv, naziv: item.naziv });
        setIsEditingPodr(true); setWarningPodr(null);
    };

    const ponistiIzmjenuPodr = () => {
        setFormPodr({ id: null, sumarija_naziv: '', naziv: '' });
        setIsEditingPodr(false); setWarningPodr(null);
    };

    const savePodruznica = async () => {
        if(!formPodr.sumarija_naziv || !formPodr.naziv) return alert("Odaberite šumariju i unesite naziv podružnice!");
        
        if(isEditingPodr) {
            const {error} = await supabase.from('podruznice').update({ sumarija_naziv: formPodr.sumarija_naziv, naziv: formPodr.naziv }).eq('id', formPodr.id);
            if(error) return alert("Greška: " + error.message);
            await zapisiU_Log('IZMJENA_PODRUZNICE', `Ažurirana podružnica: ${formPodr.naziv} (${formPodr.sumarija_naziv})`);
            alert("✅ Podružnica uspješno ažurirana!");
        } else {
            const postoji = podruznice.find(p => p.naziv === formPodr.naziv && p.sumarija_naziv === formPodr.sumarija_naziv);
            if(postoji) return alert("❌ Podružnica već postoji u toj šumariji!");

            const {error} = await supabase.from('podruznice').insert([{ sumarija_naziv: formPodr.sumarija_naziv, naziv: formPodr.naziv }]);
            if(error) return alert("Greška: " + error.message);
            await zapisiU_Log('DODAVANJE_PODRUZNICE', `Dodana podružnica: ${formPodr.naziv} (${formPodr.sumarija_naziv})`);
            alert("✅ Podružnica uspješno dodana!");
        }
        ponistiIzmjenuPodr(); load();
    };

    const obrisiPodruznicu = async (id, naziv) => {
        if(window.confirm(`Brisati podružnicu: ${naziv}?`)) {
            await supabase.from('podruznice').delete().eq('id', id);
            await zapisiU_Log('BRISANJE_PODRUZNICE', `Obrisana podružnica: ${naziv}`);
            load();
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
            
            {/* SEKCIJA: ŠUMARIJE */}
            <div className="space-y-4">
                <div className={`bg-[#1e293b] p-6 rounded-[2.5rem] border shadow-2xl space-y-4 transition-all ${isEditingSum ? 'border-amber-500/50' : 'border-slate-700'}`}>
                    <div className="flex justify-between items-center">
                        <h3 className={`${isEditingSum ? 'text-amber-500' : 'text-emerald-500'} font-black uppercase text-xs`}>
                            {isEditingSum ? '✏️ Ažuriranje Šumarije' : '🌲 Dodaj Novu Šumariju'}
                        </h3>
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
                    
                    <button onClick={saveSumarija} className={`w-full py-4 text-white font-black rounded-xl text-xs shadow-lg uppercase transition-all ${isEditingSum ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                        {isEditingSum ? '✅ Ažuriraj Šumariju' : '➕ Snimi Šumariju'}
                    </button>
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

            {/* SEKCIJA: PODRUŽNICE */}
            <div className="space-y-4">
                <div className={`bg-[#1e293b] p-6 rounded-[2.5rem] border shadow-2xl space-y-4 transition-all ${isEditingPodr ? 'border-amber-500/50' : 'border-slate-700'}`}>
                    <div className="flex justify-between items-center">
                        <h3 className={`${isEditingPodr ? 'text-amber-500' : 'text-emerald-400'} font-black uppercase text-xs`}>
                            {isEditingPodr ? '✏️ Ažuriranje Podružnice' : '🍃 Dodaj Podružnicu'}
                        </h3>
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
                    
                    <button onClick={savePodruznica} className={`w-full py-4 text-white font-black rounded-xl text-xs shadow-lg uppercase transition-all ${isEditingPodr ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                        {isEditingPodr ? '✅ Ažuriraj Podružnicu' : '➕ Snimi Podružnicu'}
                    </button>
                </div>

                <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-xl">
                    <h3 className="text-slate-400 font-black uppercase text-[10px] mb-3">Lista Podružnica - Klikni za izmjenu</h3>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                        {podruznice.map(p => (
                            <div key={p.id} onClick={() => pokreniIzmjenuPodr(p)} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-emerald-500/50 transition-all">
                                <div>
                                    <p className="font-black text-white text-xs">{p.naziv}</p>
                                    <p className="text-[9px] text-emerald-500 uppercase mt-1">Šumarija: {p.sumarija_naziv}</p>
                                </div>
                                <button onClick={(e)=>{e.stopPropagation(); obrisiPodruznicu(p.id, p.naziv);}} className="text-red-500 font-black px-4 py-2 hover:bg-red-500/20 rounded-xl transition-all">✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
        </div>
    );
}

function TabMasine() {
    const loggedUser = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');

    const [masine, setMasine] = useState([]);
    const [masterOznake, setMasterOznake] = useState([]); // SVI mogući atributi iz baze
    const [novaMasterOznaka, setNovaMasterOznaka] = useState(''); // Za dodavanje u šifrarnik
    
    const [form, setForm] = useState({ id: null, naziv: '', cijena_sat: '', cijena_m3: '', atributi_paketa: [] });
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => { load(); }, []);
    
    const load = async () => { 
        // Učitaj mašine
        const {data: mData} = await supabase.from('masine').select('*').order('naziv'); 
        setMasine(mData||[]); 
        
        // Učitaj Master Oznake (Šifrarnik)
        const {data: oData} = await supabase.from('master_oznake').select('*').order('naziv');
        setMasterOznake(oData ? oData.map(o => o.naziv) : []);
    };

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]);
    };

    // --- UPRAVLJANJE MASTER OZNAKAMA (ŠIFRARNIK) ---
    const dodajUMaster = async () => {
        const val = novaMasterOznaka.trim().toUpperCase();
        if(!val) return;
        if(masterOznake.includes(val)) return alert("Ova operacija već postoji u sistemu!");

        const {error} = await supabase.from('master_oznake').insert([{ naziv: val }]);
        if(error) return alert("Greška: " + error.message);
        
        setNovaMasterOznaka('');
        load(); // Osvježava listu dugmića
    };

    const obrisiIzMastera = async (naziv) => {
        if(window.confirm(`Da li ste sigurni da želite trajno obrisati operaciju '${naziv}' iz cijelog sistema?`)) {
            await supabase.from('master_oznake').delete().eq('naziv', naziv);
            load();
        }
    };

    // --- UPRAVLJANJE MAŠINOM ---
    const toggleOznakaMasine = (oznaka) => {
        setForm(prev => {
            const ima = prev.atributi_paketa.includes(oznaka);
            return {
                ...prev,
                atributi_paketa: ima ? prev.atributi_paketa.filter(o => o !== oznaka) : [...prev.atributi_paketa, oznaka]
            };
        });
    };

    const pokreniIzmjenu = (m) => {
        setForm({ 
            id: m.id, 
            naziv: m.naziv, 
            cijena_sat: m.cijena_sat || '', 
            cijena_m3: m.cijena_m3 || '',
            atributi_paketa: m.atributi_paketa || [] 
        });
        setIsEditing(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const ponistiIzmjenu = () => {
        setForm({ id: null, naziv: '', cijena_sat: '', cijena_m3: '', atributi_paketa: [] });
        setIsEditing(false);
    };

    const save = async () => {
        if(!form.naziv) return alert("Naziv mašine je obavezan!");
        
        const payload = { 
            naziv: form.naziv.toUpperCase(), 
            cijena_sat: parseFloat(form.cijena_sat)||0, 
            cijena_m3: parseFloat(form.cijena_m3)||0,
            atributi_paketa: form.atributi_paketa 
        };

        if (isEditing) {
            const { error } = await supabase.from('masine').update(payload).eq('id', form.id);
            if (error) return alert("Greška pri ažuriranju: " + error.message);
            await zapisiU_Log('IZMJENA_MASINE', `Ažurirana mašina: ${payload.naziv}`);
            alert("✅ Mašina uspješno ažurirana!");
        } else {
            const { error } = await supabase.from('masine').insert([payload]);
            if (error) return alert("Greška pri dodavanju: " + error.message);
            await zapisiU_Log('DODAVANJE_MASINE', `Dodana mašina: ${payload.naziv}`);
            alert("✅ Mašina uspješno dodana!");
        }
        ponistiIzmjenu(); load();
    };

    const obrisi = async (id, naziv) => {
        if(window.confirm(`Da li ste sigurni da želite obrisati mašinu: ${naziv}?`)){
            await supabase.from('masine').delete().eq('id', id);
            await zapisiU_Log('BRISANJE_MASINE', `Obrisana mašina: ${naziv}`);
            load();
        }
    };

    return (
        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-6 animate-in fade-in">
            
            <div className={`space-y-4 p-5 rounded-3xl border transition-all ${isEditing ? 'border-amber-500/50 bg-slate-800' : 'border-slate-800 bg-slate-900'}`}>
                <div className="flex justify-between items-center">
                    <h3 className={`${isEditing ? 'text-amber-500' : 'text-blue-500'} font-black uppercase text-xs`}>
                        {isEditing ? '✏️ Ažuriranje Mašine' : '⚙️ Dodavanje Nove Mašine'}
                    </h3>
                    {isEditing && <button onClick={ponistiIzmjenu} className="text-xs text-red-500 font-black bg-red-900/20 px-3 py-1 rounded-xl hover:bg-red-500 hover:text-white transition-all">Odustani ✕</button>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* Naziv Mašine</label>
                        <input placeholder="npr. BRENTA 1" value={form.naziv} onChange={e=>setForm({...form, naziv:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none uppercase border border-slate-700 focus:border-blue-500" />
                    </div>
                    <div>
                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Cijena po radnom satu (KM)</label>
                        <input type="number" placeholder="0.00" value={form.cijena_sat} onChange={e=>setForm({...form, cijena_sat:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-blue-500" />
                    </div>
                    <div>
                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Cijena po m³ (KM)</label>
                        <input type="number" placeholder="0.00" value={form.cijena_m3} onChange={e=>setForm({...form, cijena_m3:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-blue-500" />
                    </div>
                    
                    {/* ODABIR OZNAKA (NA KLIK KAO KOD RADNIKA) */}
                    <div className="col-span-1 md:col-span-3 pt-4 border-t border-slate-700 mt-2">
                        <label className="text-[10px] text-slate-400 uppercase font-black mb-3 block">🏷️ Odobreni atributi / operacije za ovu mašinu:</label>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {masterOznake.map(oznaka => {
                                const aktivan = form.atributi_paketa.includes(oznaka);
                                return (
                                    <div key={oznaka} className="flex items-center">
                                        <button 
                                            onClick={() => toggleOznakaMasine(oznaka)}
                                            className={`px-3 py-2 rounded-l-xl text-[10px] font-black uppercase transition-all border-y border-l ${aktivan ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500'}`}
                                        >
                                            {aktivan ? '✓ ' : '+ '} {oznaka}
                                        </button>
                                        <button onClick={() => obrisiIzMastera(oznaka)} className={`px-2 py-2 border-y border-r rounded-r-xl text-[10px] font-black transition-all ${aktivan ? 'bg-emerald-700 border-emerald-400 text-emerald-300 hover:text-white hover:bg-red-500' : 'bg-slate-900 border-slate-700 text-slate-600 hover:text-red-500'}`} title="Trajno obriši iz sistema">✕</button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* DODAVANJE NOVE OZNAKE U SISTEM */}
                        <div className="flex gap-2 max-w-sm mt-4 bg-slate-950 p-2 rounded-xl border border-slate-800">
                            <input 
                                value={novaMasterOznaka} 
                                onChange={e=>setNovaMasterOznaka(e.target.value)} 
                                onKeyDown={e=>{if(e.key==='Enter') dodajUMaster()}} 
                                placeholder="Nova operacija u sistemu..." 
                                className="flex-1 p-2 bg-transparent text-xs text-white outline-none uppercase" 
                            />
                            <button onClick={dodajUMaster} className="px-4 bg-blue-600 rounded-lg text-white font-black hover:bg-blue-500 text-[10px] uppercase shadow-lg">+ Baza</button>
                        </div>
                    </div>
                </div>
                
                <button onClick={save} className={`w-full py-4 text-white font-black rounded-xl text-xs shadow-lg uppercase transition-all mt-4 ${isEditing ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                    {isEditing ? '✅ Ažuriraj Mašinu' : '➕ Dodaj Mašinu'}
                </button>
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
                                    <p className="text-[10px] text-slate-400 mt-1">Radni sat: <b className="text-emerald-400">{m.cijena_sat} KM</b> | Po kubiku: <b className="text-emerald-400">{m.cijena_m3} KM</b></p>
                                </div>
                                <button onClick={(e)=>{e.stopPropagation(); obrisi(m.id, m.naziv);}} className="text-red-500 font-black px-4 py-2 bg-red-900/20 rounded-xl hover:bg-red-500 hover:text-white transition-all">✕</button>
                            </div>
                            
                            <div className="flex flex-wrap gap-1 mt-3">
                                {(m.atributi_paketa || []).length === 0 ? (
                                    <span className="text-[8px] text-slate-500 font-bold italic border border-slate-700 px-2 py-0.5 rounded">Nema dodijeljenih operacija</span>
                                ) : (
                                    (m.atributi_paketa || []).map(attr => (
                                        <span key={attr} className="text-[8px] text-emerald-400 bg-emerald-900/20 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold uppercase">{attr}</span>
                                    ))
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
    
    const [duplicateWarning, setDuplicateWarning] = useState(null); // State za upozorenje o duplikatu
    const sifraTimerRef = useRef(null); // Tajmer za 2s

    const [excelFile, setExcelFile] = useState(null);
    const [log, setLog] = useState('');

    useEffect(() => { load(); }, []);
    const load = async () => { const {data} = await supabase.from('katalog_proizvoda').select('*').order('sifra'); setKatalog(data||[]); };

    const jedinstveneKategorije = useMemo(() => Array.from(new Set(katalog.map(k=>k.kategorija).filter(Boolean))), [katalog]);

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]);
    };

    // NOVO: Pametna provjera šifre sa zakašnjenjem od 2s
    const handleSifraChange = (val) => {
        const upperVal = val.toUpperCase();
        setForm({...form, sifra: upperVal});
        setDuplicateWarning(null); // Skloni upozorenje dok kuca

        if (sifraTimerRef.current) clearTimeout(sifraTimerRef.current);

        if (upperVal.length >= 2 && !isEditing) {
            sifraTimerRef.current = setTimeout(async () => {
                const { data } = await supabase.from('katalog_proizvoda').select('*').eq('sifra', upperVal).maybeSingle();
                if (data) {
                    setDuplicateWarning(data); // Prikaži karticu sa opcijama
                }
            }, 2000);
        }
    };

    const pokreniIzmjenu = (proizvod) => {
        setForm({
            sifra: proizvod.sifra, naziv: proizvod.naziv, dimenzije: proizvod.dimenzije || '', kategorija: proizvod.kategorija || '',
            default_jedinica: proizvod.default_jedinica || 'm3', cijena: proizvod.cijena || '', m3: proizvod.m3 || '', 
            m2: proizvod.m2 || '', m1: proizvod.m1 || '', duzina: proizvod.duzina || '', sirina: proizvod.sirina || '', visina: proizvod.visina || ''
        });
        setIsEditing(true);
        setDuplicateWarning(null); // Ugasi upozorenje ako smo prešli u Edit mod
        window.scrollTo({ top: 0, behavior: 'smooth' }); 
    };

    const ponistiIzmjenu = () => {
        setForm({ sifra: '', naziv: '', dimenzije: '', kategorija: '', default_jedinica: 'm3', cijena: '', m3: '', m2: '', m1: '', duzina: '', sirina: '', visina: '' });
        setIsEditing(false);
        setDuplicateWarning(null);
    };

    const snimiProizvod = async () => {
        if(!form.sifra || !form.naziv) return alert("Šifra i Naziv su obavezni!");
        const payload = {...form, cijena: parseFloat(form.cijena)||0, m3: parseFloat(form.m3)||0, m2: parseFloat(form.m2)||0, m1: parseFloat(form.m1)||0, duzina: parseFloat(form.duzina)||0, sirina: parseFloat(form.sirina)||0, visina: parseFloat(form.visina)||0 };
        
        if (isEditing) {
            const { error } = await supabase.from('katalog_proizvoda').update(payload).eq('sifra', form.sifra);
            if(error) return alert("Greška pri ažuriranju: " + error.message);
            await zapisiU_Log('IZMJENA_PROIZVODA', `Ažuriran proizvod: ${form.sifra} - ${form.naziv}`);
            alert("✅ Proizvod uspješno ažuriran!");
        } else {
            const { data: postoji } = await supabase.from('katalog_proizvoda').select('sifra').eq('sifra', form.sifra.toUpperCase()).maybeSingle();
            if(postoji) return alert("❌ STROGA KONTROLA: Proizvod sa ovom šifrom već postoji! Ukoliko želite, kliknite 'Ažuriraj' na upozorenju.");
            
            const { error } = await supabase.from('katalog_proizvoda').insert([payload]);
            if(error) return alert("Greška pri dodavanju: " + error.message);
            await zapisiU_Log('DODAVANJE_PROIZVODA', `Dodan novi proizvod: ${form.sifra} - ${form.naziv}`);
            alert("✅ Proizvod uspješno dodan!");
        }
        
        ponistiIzmjenu();
        load();
    };

    const obrisiProizvod = async (sifra, naziv) => {
        if(window.confirm(`Da li ste sigurni da želite TRAJNO OBRISATI proizvod: ${naziv}?`)){
            await supabase.from('katalog_proizvoda').delete().eq('sifra', sifra);
            await zapisiU_Log('BRISANJE_PROIZVODA', `Obrisan proizvod: ${sifra} - ${naziv}`);
            load();
        }
    };

    const parseNum = (val) => {
        if(val === undefined || val === null || val === '') return 0;
        return parseFloat(val.toString().replace(',', '.')) || 0;
    };

    const processExcel = () => {
        if(!excelFile) return setLog("⚠️ Prvo odaberite Excel fajl.");
        setLog("⏳ Učitavanje i obrada fajla...");
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                const podaci = json.map(r => {
                    const jedinica = r['default jedinicaMjere'] || r['default_jedinica'] || 'm3';
                    return {
                        sifra: r.sifra?.toString().trim().toUpperCase(), 
                        naziv: r.naziv?.toString().trim(), 
                        dimenzije: r.dimenzije?.toString().trim() || '', 
                        kategorija: r.kategorija?.toString().trim() || 'Ostalo', 
                        default_jedinica: jedinica.trim(),
                        cijena: parseNum(r.cijena), m3: parseNum(r.m3), m2: parseNum(r.m2), m1: parseNum(r.m1), 
                        duzina: parseNum(r.duzina), sirina: parseNum(r.sirina), visina: parseNum(r.visina)
                    };
                }).filter(x => x.sifra && x.naziv);
                
                if(podaci.length===0) return setLog("⚠️ Fajl je prazan ili kolone nemaju tačne nazive.");
                
                const { error } = await supabase.from('katalog_proizvoda').upsert(podaci, { onConflict: 'sifra', ignoreDuplicates: true });
                if(error) setLog("❌ GREŠKA Baze: " + error.message);
                else { 
                    await zapisiU_Log('UVOZ_EXCELA', `Uvezeno ${podaci.length} proizvoda iz Excela.`);
                    setLog(`✅ Uspješno uvezeno ${podaci.length} novih proizvoda!`); 
                    load(); setExcelFile(null); 
                }
            } catch(err) { setLog("❌ Greška pri obradi Excela: " + err.message); }
        };
        reader.readAsArrayBuffer(excelFile);
    };

    return (
        <div className="space-y-4 animate-in fade-in">
            {/* Uvoz Excela */}
            <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-emerald-500/30 shadow-2xl">
                <h3 className="text-emerald-500 font-black uppercase text-xs mb-3">Uvoz iz Excela (.xlsx)</h3>
                <div className="flex gap-2 items-center">
                    <input type="file" accept=".xlsx, .xls, .csv" onChange={e=>setExcelFile(e.target.files[0])} className="flex-1 text-xs text-slate-400 file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-slate-800 file:text-white" />
                    <button onClick={processExcel} className="bg-emerald-600 px-6 py-3 rounded-xl text-white font-black text-xs shadow-lg hover:opacity-80">UVEZI</button>
                </div>
                {log && <div className={`mt-4 p-3 rounded-xl text-xs font-bold border ${log.includes('✅') ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-400' : 'bg-red-900/20 border-red-500/30 text-red-400'}`}>{log}</div>}
            </div>

            {/* Ručni Unos / Modifikacija */}
            <div className={`bg-[#1e293b] p-6 rounded-[2.5rem] border shadow-2xl space-y-4 transition-all ${isEditing ? 'border-amber-500/50' : 'border-slate-700'}`}>
                <div className="flex justify-between items-center">
                    <h3 className={`${isEditing ? 'text-amber-500' : 'text-blue-500'} font-black uppercase text-xs`}>
                        {isEditing ? '✏️ Ažuriranje Proizvoda' : '➕ Dodaj Proizvod Ručno'}
                    </h3>
                    {isEditing && <button onClick={ponistiIzmjenu} className="text-xs text-red-500 font-black bg-red-900/20 px-3 py-1 rounded-xl hover:bg-red-500 hover:text-white">Odustani ✕</button>}
                </div>

                {/* NOVO: Kartica upozorenja ako šifra postoji */}
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
                    
                    <div>
                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Faktor m³</label>
                        <input type="number" value={form.m3} onChange={e=>setForm({...form, m3:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-center text-slate-400 border border-slate-700 outline-none focus:border-blue-500" />
                    </div>
                    <div>
                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Faktor m²</label>
                        <input type="number" value={form.m2} onChange={e=>setForm({...form, m2:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-center text-slate-400 border border-slate-700 outline-none focus:border-blue-500" />
                    </div>
                    <div>
                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Faktor m1</label>
                        <input type="number" value={form.m1} onChange={e=>setForm({...form, m1:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-center text-slate-400 border border-slate-700 outline-none focus:border-blue-500" />
                    </div>
                    <div className="hidden md:block"></div>

                    <div>
                        <label className="text-[8px] text-amber-500 uppercase ml-2 block mb-1">Dužina (cm)</label>
                        <input type="number" value={form.duzina} onChange={e=>setForm({...form, duzina:e.target.value})} className="w-full p-3 bg-slate-900 rounded-xl text-xs text-center text-amber-400 border border-slate-700 outline-none focus:border-blue-500" />
                    </div>
                    <div>
                        <label className="text-[8px] text-amber-500 uppercase ml-2 block mb-1">Širina (cm)</label>
                        <input type="number" value={form.sirina} onChange={e=>setForm({...form, sirina:e.target.value})} className="w-full p-3 bg-slate-900 rounded-xl text-xs text-center text-amber-400 border border-slate-700 outline-none focus:border-blue-500" />
                    </div>
                    <div>
                        <label className="text-[8px] text-amber-500 uppercase ml-2 block mb-1">Visina/Deb (cm)</label>
                        <input type="number" value={form.visina} onChange={e=>setForm({...form, visina:e.target.value})} className="w-full p-3 bg-slate-900 rounded-xl text-xs text-center text-amber-400 border border-slate-700 outline-none focus:border-blue-500" />
                    </div>
                </div>
                <button onClick={snimiProizvod} className={`w-full py-4 text-white font-black rounded-xl text-xs shadow-lg uppercase transition-all ${isEditing ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                    {isEditing ? '✅ Ažuriraj Proizvod' : '➕ Snimi u Katalog'}
                </button>
            </div>

            {/* Prikaz Kataloga (Klikabilni redovi) */}
            <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-xl">
                <h3 className="text-slate-400 font-black uppercase text-[10px] mb-3">Trenutni Katalog ({katalog.length} proizvoda) - Klikni za izmjenu</h3>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                    {katalog.map(k => (
                        <div key={k.sifra} onClick={() => pokreniIzmjenu(k)} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-blue-500/50 transition-all">
                            <div>
                                <p className="text-white text-xs font-black">{k.sifra} <span className="text-blue-400 ml-1">{k.naziv}</span></p>
                                <p className="text-[9px] text-slate-500 uppercase mt-1">Kat: {k.kategorija} | Dim: {k.visina}x{k.sirina}x{k.duzina} | <b className="text-emerald-500">{k.cijena} KM/{k.default_jedinica}</b></p>
                            </div>
                            <button onClick={(e)=>{e.stopPropagation(); obrisiProizvod(k.sifra, k.naziv);}} className="text-red-500 font-black px-4 py-2 hover:bg-red-500/20 rounded-xl transition-all">✕</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Specijalni pametni dropdown za prikaz DETALJA proizvoda prilikom dodjele rabata
function KatalogSearchableDetail({ katalog, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value);
    
    useEffect(() => { setSearch(value); }, [value]);

    const filtered = katalog.filter(k => k.sifra.toUpperCase().includes(search.toUpperCase()) || k.naziv.toUpperCase().includes(search.toUpperCase()));

    return (
        <div className="relative font-black w-full">
            <input 
                value={search} 
                onFocus={() => setOpen(true)} 
                onChange={e => { setSearch(e.target.value.toUpperCase()); setOpen(true); }} 
                placeholder="Pronađi šifru ili naziv..." 
                className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-amber-500" 
            />
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
    
    // State za pojedinacne i kategorijske popuste
    const [tempP_sifra, setTempP_sifra] = useState('');
    const [tempP_rabat, setTempP_rabat] = useState('');
    const [rabatiProizvodi, setRabatiProizvodi] = useState([]); // [{sifra, rabat}]

    const [tempK_kat, setTempK_kat] = useState('');
    const [tempK_rabat, setTempK_rabat] = useState('');
    const [rabatiKategorije, setRabatiKategorije] = useState([]); // [{kategorija, rabat}]

    useEffect(() => { load(); }, []);
    const load = async () => {
        const {data: k} = await supabase.from('katalog_proizvoda').select('*').order('sifra'); setKatalog(k||[]);
        const {data: c} = await supabase.from('kupci').select('*').order('naziv'); setKupci(c||[]);
    };

    const jedinstveneKategorije = useMemo(() => Array.from(new Set(katalog.map(k=>k.kategorija).filter(Boolean))), [katalog]);

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]);
    };

    // Pametna provjera Naziva kupca (2s debounce)
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

    // Prebacivanje u Edit mod iz upozorenja ili liste
    const pokreniIzmjenu = (kupac) => {
        const rabati = kupac.rabati_jsonb || {};
        const rProizvodi = Object.entries(rabati.proizvodi || {}).map(([sifra, rabat]) => ({sifra, rabat}));
        const rKategorije = Object.entries(rabati.kategorije || {}).map(([kategorija, rabat]) => ({kategorija, rabat}));

        setForm({ id: kupac.id, naziv: kupac.naziv, pdv: kupac.pdv_broj || '', adresa: kupac.adresa || '', ukupni_rabat: rabati.ukupni || '' });
        setRabatiProizvodi(rProizvodi);
        setRabatiKategorije(rKategorije);
        setIsEditing(true);
        setDuplicateWarning(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const ponistiIzmjenu = () => {
        setForm({ id: null, naziv: '', pdv: '', adresa: '', ukupni_rabat: '' });
        setRabatiProizvodi([]); setRabatiKategorije([]);
        setIsEditing(false); setDuplicateWarning(null);
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
            await zapisiU_Log('IZMJENA_KUPCA', `Ažuriran kupac: ${form.naziv}`);
            alert("✅ Kupac uspješno ažuriran!");
        } else {
            const { error } = await supabase.from('kupci').insert([payload]);
            if(error) return alert("Greška: " + error.message);
            await zapisiU_Log('DODAVANJE_KUPCA', `Dodan novi kupac: ${form.naziv}`);
            alert("✅ Kupac uspješno snimljen!");
        }
        
        ponistiIzmjenu(); load();
    };

    const obrisiKupca = async (id, naziv) => {
        if(window.confirm(`Da li ste sigurni da želite TRAJNO OBRISATI kupca: ${naziv}?`)){
            await supabase.from('kupci').delete().eq('id', id);
            await zapisiU_Log('BRISANJE_KUPCA', `Obrisan kupac: ${naziv}`);
            load();
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in">
            <div className={`bg-[#1e293b] p-6 rounded-[2.5rem] border shadow-2xl space-y-4 transition-all ${isEditing ? 'border-amber-500/50' : 'border-slate-700'}`}>
                <div className="flex justify-between items-center">
                    <h3 className={`${isEditing ? 'text-amber-500' : 'text-amber-500'} font-black uppercase text-xs`}>
                        {isEditing ? '✏️ Ažuriranje Kupca' : '🤝 Novi Kupac i Rabati'}
                    </h3>
                    {isEditing && <button onClick={ponistiIzmjenu} className="text-xs text-red-500 font-black bg-red-900/20 px-3 py-1 rounded-xl hover:bg-red-500 hover:text-white">Odustani ✕</button>}
                </div>

                {/* Upozorenje ako kupac postoji */}
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
                    <div>
                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* Naziv Kupca / Firme</label>
                        <input value={form.naziv} onChange={e=>handleNazivChange(e.target.value)} disabled={isEditing} className={`w-full p-3 rounded-xl text-xs text-white uppercase font-black outline-none ${isEditing ? 'bg-slate-800 border border-slate-700 opacity-50 cursor-not-allowed' : 'bg-[#0f172a] border border-amber-500/50 focus:border-amber-400'}`} />
                    </div>
                    <div>
                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">PDV Broj</label>
                        <input value={form.pdv} onChange={e=>setForm({...form, pdv:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-amber-500" />
                    </div>
                    <div>
                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Adresa / Lokacija</label>
                        <input value={form.adresa} onChange={e=>setForm({...form, adresa:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-amber-500" />
                    </div>
                    <div>
                        <label className="text-[8px] text-amber-500 uppercase ml-2 block mb-1 font-black">UKUPNI RABAT NA SVE PROIZVODE (%)</label>
                        <input type="number" value={form.ukupni_rabat} onChange={e=>setForm({...form, ukupni_rabat:e.target.value})} className="w-full p-3 bg-amber-900/20 rounded-xl text-xs text-amber-400 font-black outline-none border border-amber-500/50 focus:border-amber-400" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Rabat po specifičnom proizvodu (Novi moćni dropdown) */}
                    <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
                        <span className="text-[10px] text-slate-400 uppercase font-black">Specifični Rabat po Proizvodu (%)</span>
                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <KatalogSearchableDetail katalog={katalog} value={tempP_sifra} onChange={setTempP_sifra} />
                            </div>
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
                                            {proizvod && (
                                                <div className="text-[9px] text-slate-400 mt-1">
                                                    <span className="text-white font-bold">{proizvod.naziv}</span><br />
                                                    Dim: {proizvod.visina}x{proizvod.sirina}x{proizvod.duzina} | {proizvod.cijena} KM/{proizvod.default_jedinica}
                                                </div>
                                            )}
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

                    {/* Rabat po kategoriji */}
                    <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
                        <span className="text-[10px] text-slate-400 uppercase font-black">Rabat po Kategoriji (%)</span>
                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <SettingsSearchable value={tempK_kat} onChange={setTempK_kat} list={jedinstveneKategorije} placeholder="Pronađi kategoriju..." />
                            </div>
                            <input type="number" value={tempK_rabat} onChange={e=>setTempK_rabat(e.target.value)} placeholder="%" className="w-16 p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 text-center focus:border-amber-500 outline-none" />
                            <button onClick={addR_Kategorija} className="bg-purple-600 text-white px-3 py-3 rounded-xl font-black text-xs hover:bg-purple-500">+</button>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {rabatiKategorije.map((r, i) => (
                                <div key={i} className="text-[10px] text-purple-300 bg-purple-900/20 p-3 rounded-lg flex justify-between items-center border border-purple-500/30">
                                    <span>Kategorija: <b className="text-white text-xs">{r.kategorija}</b></span>
                                    <div className="flex items-center gap-3">
                                        <span className="font-black text-amber-400 text-sm">{r.rabat}%</span>
                                        <button onClick={()=>remR_Kategorija(i)} className="text-red-500 hover:text-red-400 font-black px-2 py-1 bg-red-900/30 hover:bg-red-900/50 rounded-lg">✕</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                
                <button onClick={snimiKupca} className={`w-full py-4 text-white font-black rounded-xl uppercase text-xs shadow-lg transition-all ${isEditing ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                    {isEditing ? '✅ Ažuriraj Kupca' : '➕ Snimi Kupca u Bazu'}
                </button>
            </div>

            {/* Prikaz Kupaca (Klikabilni redovi) */}
            <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-xl">
                <h3 className="text-slate-400 font-black uppercase text-[10px] mb-3">Lista Kupaca - Klikni za izmjenu</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {kupci.map(k => (
                        <div key={k.id} onClick={() => pokreniIzmjenu(k)} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-amber-500/50 transition-all">
                            <div>
                                <p className="text-white text-xs font-black">{k.naziv}</p>
                                <p className="text-[9px] text-slate-500 uppercase mt-1">
                                    Ukupni Rabat: <b className="text-amber-400">{k.rabati_jsonb?.ukupni || 0}%</b> | 
                                    Spec. proizvoda: {Object.keys(k.rabati_jsonb?.proizvodi || {}).length} | 
                                    Kategorija: {Object.keys(k.rabati_jsonb?.kategorije || {}).length}
                                </p>
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
    const [editId, setEditId] = useState(null); // NOVO: Pamti kojeg radnika uređujemo
    
    const [form, setForm] = useState({ ime_prezime: '', username: '', password: '', uloga: 'operater', bruto_satnica: '', preostalo_godisnjeg: 20, dozvole: [] });

    const sviModuli = [
        'Prijem trupaca', 'Prorez (Trupci)', 'Pilana (Izlaz)', 'Dorada (Ulaz/Izlaz)', 
        'Ponude', 'Radni Nalozi', 'Otpremnice', 'Računi', 'Podešavanja'
    ];

    useEffect(() => { load(); }, []);
    const load = async () => { const {data} = await supabase.from('radnici').select('*').order('ime_prezime'); setRadnici(data||[]); };

    const toggleDozvola = (modul) => {
        setForm(prev => {
            const imaDozvolu = prev.dozvole.includes(modul);
            return {
                ...prev,
                dozvole: imaDozvolu ? prev.dozvole.filter(m => m !== modul) : [...prev.dozvole, modul]
            };
        });
    };

    // NOVO: Funkcija za učitavanje radnika u formu
    const pokreniEdit = (r) => {
        setForm({
            ime_prezime: r.ime_prezime,
            username: r.username,
            password: r.password,
            uloga: r.uloga,
            bruto_satnica: r.bruto_satnica,
            preostalo_godisnjeg: r.preostalo_godisnjeg,
            dozvole: r.dozvole || []
        });
        setEditId(r.id);
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Automatski skrola na vrh forme
    };

    const ponistiEdit = () => {
        setForm({ ime_prezime: '', username: '', password: '', uloga: 'operater', bruto_satnica: '', preostalo_godisnjeg: 20, dozvole: [] });
        setEditId(null);
    };

    const snimi = async () => {
        if(!form.ime_prezime || !form.username || !form.password) return alert("Popuni Ime, Username i Password!");
        if(form.dozvole.length === 0 && !window.confirm("Radniku niste dodijelili nijednu dozvolu. Da li ste sigurni?")) return;
        
        // Zabrana duplog username-a (Pametnija provjera zbog uređivanja)
        if (editId) {
            const { data: userPostoji } = await supabase.from('radnici').select('id').ilike('username', form.username).neq('id', editId).maybeSingle();
            if(userPostoji) return alert("Upozorenje: Ovaj username već koristi drugi radnik!");
        } else {
            const { data: userPostoji } = await supabase.from('radnici').select('id').ilike('username', form.username).maybeSingle();
            if(userPostoji) return alert("Upozorenje: Ovaj username je već zauzet!");
        }

        const payload = {
            ime_prezime: form.ime_prezime, 
            username: form.username.toLowerCase(), 
            password: form.password, 
            uloga: form.uloga,
            bruto_satnica: parseFloat(form.bruto_satnica)||0, 
            preostalo_godisnjeg: parseInt(form.preostalo_godisnjeg)||0,
            dozvole: form.dozvole
        };

        if (editId) {
            // AŽURIRANJE
            const { error } = await supabase.from('radnici').update(payload).eq('id', editId);
            if(error) return alert("Greška pri ažuriranju: " + error.message);
            alert("Radnik uspješno ažuriran!");
        } else {
            // DODAVANJE NOVOG
            const { error } = await supabase.from('radnici').insert([payload]);
            if(error) return alert("Greška pri kreiranju: " + error.message);
            alert("Radnik uspješno kreiran!"); 
        }
        
        ponistiEdit(); 
        load();
    };

    return (
        <div className="space-y-4 animate-in fade-in">
            <div className={`p-6 rounded-[2.5rem] border shadow-2xl space-y-4 transition-all ${editId ? 'bg-blue-950 border-blue-500' : 'bg-[#1e293b] border-slate-700'}`}>
                <div className="flex justify-between items-center">
                    <h3 className="text-blue-500 font-black uppercase text-xs">
                        {editId ? `✏️ Uređivanje Radnika: ${form.ime_prezime}` : `👷‍♂️ Dodaj Novog Radnika`}
                    </h3>
                    {editId && <button onClick={ponistiEdit} className="text-red-400 hover:text-white text-[10px] font-black uppercase bg-red-900/30 px-3 py-1 rounded-lg">✕ Poništi</button>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input placeholder="Ime i Prezime" value={form.ime_prezime} onChange={e=>setForm({...form, ime_prezime:e.target.value})} className="p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-blue-500" />
                    <select value={form.uloga} onChange={e=>setForm({...form, uloga:e.target.value})} className="p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-blue-500 font-black">
                        <option value="operater">Uloga: Operater (Rad na mašini)</option>
                        <option value="admin">Uloga: Administrator (Šef)</option>
                    </select>
                    <input placeholder="Username (za login)" value={form.username} onChange={e=>setForm({...form, username:e.target.value})} className="p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-blue-500" />
                    <input placeholder="Password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} className="p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-blue-500" />
                    <input type="number" placeholder="Bruto satnica (KM)" value={form.bruto_satnica} onChange={e=>setForm({...form, bruto_satnica:e.target.value})} className="p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-blue-500" />
                    <input type="number" placeholder="Dani godišnjeg (početno)" value={form.preostalo_godisnjeg} onChange={e=>setForm({...form, preostalo_godisnjeg:e.target.value})} className="p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-blue-500" />
                    
                    <div className="col-span-1 md:col-span-2 pt-4 border-t border-slate-700 mt-2">
                        <label className="text-[10px] text-slate-400 uppercase font-black mb-3 block">🔐 Odobreni Moduli (Dozvole pristupa):</label>
                        <div className="flex flex-wrap gap-2">
                            {sviModuli.map(modul => {
                                const aktivan = form.dozvole.includes(modul);
                                return (
                                    <button 
                                        key={modul} 
                                        onClick={() => toggleDozvola(modul)}
                                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${aktivan ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500'}`}
                                    >
                                        {aktivan ? '✓ ' : '+ '} {modul}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-2 mt-2">
                    <button onClick={snimi} className="flex-1 py-5 bg-blue-600 text-white font-black rounded-xl uppercase text-xs shadow-xl hover:bg-blue-500 transition-all">
                        {editId ? '✅ Ažuriraj Radnika' : '✅ Snimi Radnika'}
                    </button>
                </div>
            </div>
            
            <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-xl">
                <h3 className="text-slate-400 font-black uppercase text-[10px] mb-4">Svi Radnici u sistemu</h3>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                    {radnici.map(r => (
                        <div key={r.id} className={`flex flex-col md:flex-row justify-between md:items-center p-4 border rounded-2xl gap-3 transition-all ${editId === r.id ? 'bg-blue-900/30 border-blue-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}>
                            <div>
                                <p className="text-white text-sm font-black">{r.ime_prezime} <span className="text-slate-500 text-[10px] font-normal">(@{r.username})</span></p>
                                <p className="text-[9px] text-slate-400 uppercase mt-1 mb-2">
                                    <span className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded mr-2 border border-blue-500/30">{r.uloga}</span> 
                                    Satnica: <b className="text-white">{r.bruto_satnica} KM</b> | Godišnji: <b className="text-white">{r.preostalo_godisnjeg} dana</b>
                                </p>
                                
                                <div className="flex flex-wrap gap-1">
                                    {(r.dozvole || []).length === 0 ? (
                                        <span className="text-[8px] text-red-500 font-bold italic border border-red-500/30 px-2 py-0.5 rounded">NEMA DOZVOLA</span>
                                    ) : (
                                        (r.dozvole || []).map(d => (
                                            <span key={d} className="text-[8px] text-emerald-400 bg-emerald-900/20 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold uppercase">{d}</span>
                                        ))
                                    )}
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
function SettingsModule({ onExit }) {
    const [tab, setTab] = useState('sumarije');
    const tabs = ['sumarije', 'masine', 'katalog', 'kupci', 'radnici'];
    const labels = { sumarije: 'Šumarije', masine: 'Mašine', katalog: 'Katalog', kupci: 'Kupci', radnici: 'Radnici' };

    return (
        <div className="p-4 max-w-2xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-[#1e293b] p-4 rounded-3xl border border-slate-700 shadow-lg">
                <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase font-black text-white hover:bg-slate-700">← Meni</button>
                <h2 className="text-slate-400 font-black tracking-widest uppercase text-xs">⚙️ ERP PODEŠAVANJA</h2>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {tabs.map(t => (
                    <button key={t} onClick={() => setTab(t)} className={`px-5 py-3 rounded-2xl border-2 whitespace-nowrap transition-all text-[10px] uppercase font-black ${tab === t ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>{labels[t]}</button>
                ))}
            </div>

            {tab === 'sumarije' && <TabSumarije />}
            {tab === 'masine' && <TabMasine />}
            {tab === 'katalog' && <TabKatalog />}
            {tab === 'kupci' && <TabKupci />}
            {tab === 'radnici' && <TabRadnici />}
        </div>
    );
}
// Ovdje ispod ostaju PonudeModule i RadniNaloziModule koje ne diramo

// ============================================================================
// MODUL: PONUDE I RADNI NALOZI 
// ============================================================================
// ============================================================================
// MODUL: PONUDE
// ============================================================================

// ============================================================================
// MODUL: PONUDE
// ============================================================================

// ============================================================================
// MODUL: PONUDE
// ============================================================================

// Pomoćni pametni dropdown za proizvode (Prikazuje sve detalje)
// ============================================================================
// MODUL: PONUDE
// ============================================================================

// ============================================================================
// MODUL: PONUDE
// ============================================================================

function PonudeSearchableProizvod({ katalog, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value);
    
    useEffect(() => { setSearch(value); }, [value]);

    const filtered = katalog.filter(k => k.sifra.toUpperCase().includes(search.toUpperCase()) || k.naziv.toUpperCase().includes(search.toUpperCase()));

    return (
        <div className="relative font-black w-full">
            <input value={search} onFocus={() => setOpen(true)} onChange={e => { setSearch(e.target.value); setOpen(true); }} placeholder="Pronađi šifru ili naziv..." className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-blue-500" />
            {open && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    {filtered.map(k => {
                        const tekstZaPolje = `${k.sifra} | ${k.naziv} | Dim: ${k.visina}x${k.sirina}x${k.duzina}`;
                        return (
                            <div key={k.sifra} onClick={() => { onChange(k.sifra, tekstZaPolje); setSearch(tekstZaPolje); setOpen(false); }} className="p-3 border-b border-slate-700 hover:bg-blue-600 cursor-pointer transition-all">
                                <div className="text-white text-xs font-black">{k.sifra} <span className="text-blue-300 ml-1">{k.naziv}</span></div>
                                <div className="text-[9px] text-slate-400 mt-1 uppercase">Kat: {k.kategorija} | Cijena: <b className="text-white">{k.cijena} KM/{k.default_jedinica}</b></div>
                            </div>
                        )
                    })}
                    <div onClick={() => setOpen(false)} className="p-2 text-center text-[8px] text-slate-500 cursor-pointer hover:text-white">Zatvori</div>
                </div>
            )}
        </div>
    );
}

function PonudeModule({ onExit }) {
    const loggedUser = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');

    const [tab, setTab] = useState('nova');
    const [kupci, setKupci] = useState([]);
    const [katalog, setKatalog] = useState([]);
    const [ponude, setPonude] = useState([]);

    const generisiID = () => `PON-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;

    const [form, setForm] = useState({
        id: generisiID(), kupac_naziv: '', datum: new Date().toISOString().split('T')[0],
        rok_vazenja: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
        nacin_placanja: 'Virmanski', valuta: 'KM', paritet: 'FCA Srebrenik', depozit: '', napomena: '', status: 'NA ODLUČIVANJU'
    });

    const [isEditingPonuda, setIsEditingPonuda] = useState(false);
    const [odabraniKupac, setOdabraniKupac] = useState(null);
    const [stavke, setStavke] = useState([]);
    
    const [stavkaForm, setStavkaForm] = useState({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3', sistemski_rabat: 0, konacni_rabat: '' });
    const [trenutniProizvod, setTrenutniProizvod] = useState(null);

    useEffect(() => { load(); }, []);

    const load = async () => {
        const {data: k} = await supabase.from('kupci').select('*').order('naziv'); setKupci(k||[]);
        const {data: cat} = await supabase.from('katalog_proizvoda').select('*').order('sifra'); setKatalog(cat||[]);
        const {data: p} = await supabase.from('ponude').select('*').order('datum', { ascending: false }); setPonude(p||[]);
    };

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]);
    };

    const handleKupacSelect = (naziv) => {
        setForm({...form, kupac_naziv: naziv});
        setOdabraniKupac(kupci.find(k => k.naziv === naziv) || null);
    };

    const izracunajRabat = (proizvod, kupac) => {
        if(!kupac || !kupac.rabati_jsonb) return 0;
        const rabati = kupac.rabati_jsonb;
        if (rabati.proizvodi && rabati.proizvodi[proizvod.sifra]) return parseFloat(rabati.proizvodi[proizvod.sifra]);
        if (rabati.kategorije && rabati.kategorije[proizvod.kategorija]) return parseFloat(rabati.kategorije[proizvod.kategorija]);
        if (rabati.ukupni) return parseFloat(rabati.ukupni);
        return 0;
    };

    // MATEMATIKA: Dinamičko preračunavanje cijene u zavisnosti od odabrane jedinice mjere
    const izracunajDinamickuCijenu = (proizvod, jm_cilj) => {
        if (!proizvod) return 0;
        const p_baza = parseFloat(proizvod.cijena) || 0;
        const jm_baza = (proizvod.default_jedinica || 'm3').toLowerCase();
        const cilj = (jm_cilj || 'm3').toLowerCase();
        
        if (jm_baza === cilj) return p_baza;

        const v = (parseFloat(proizvod.visina) || 1) / 100;
        const s = (parseFloat(proizvod.sirina) || 1) / 100;
        const d = (parseFloat(proizvod.duzina) || 1) / 100;

        let faktor_baza = 1;
        if (jm_baza === 'm3') faktor_baza = v * s * d;
        else if (jm_baza === 'm2') faktor_baza = s * d;
        else if (jm_baza === 'm1') faktor_baza = d;

        const cijena_komad = p_baza * faktor_baza;

        let faktor_cilj = 1;
        if (cilj === 'm3') faktor_cilj = v * s * d;
        else if (cilj === 'm2') faktor_cilj = s * d;
        else if (cilj === 'm1') faktor_cilj = d;

        return cijena_komad / (faktor_cilj || 1);
    };

    const handleProizvodSelect = (sifraVal, tekstZaPolje) => {
        const nadjeni = katalog.find(k => k.sifra === sifraVal);
        setTrenutniProizvod(nadjeni || null);
        if (nadjeni) {
            const predlozeniRabat = izracunajRabat(nadjeni, odabraniKupac);
            setStavkaForm({ ...stavkaForm, id: null, sifra_unos: tekstZaPolje, jm_unos: 'kom', jm_obracun: nadjeni.default_jedinica || 'm3', sistemski_rabat: predlozeniRabat, konacni_rabat: predlozeniRabat });
        }
    };

    useEffect(() => {
        if(!trenutniProizvod || !stavkaForm.kolicina_unos) return;
        const kol = parseFloat(stavkaForm.kolicina_unos);
        let obracun = kol;
        if (stavkaForm.jm_unos === 'kom' && stavkaForm.jm_obracun !== 'kom') {
            const v = parseFloat(trenutniProizvod.visina) || 1;
            const s = parseFloat(trenutniProizvod.sirina) || 1;
            const d = parseFloat(trenutniProizvod.duzina) || 1;
            if (stavkaForm.jm_obracun === 'm3') obracun = kol * (v/100) * (s/100) * (d/100);
            if (stavkaForm.jm_obracun === 'm2') obracun = kol * (s/100) * (d/100);
            if (stavkaForm.jm_obracun === 'm1') obracun = kol * (d/100);
        }
        setStavkaForm(prev => ({...prev, kolicina_obracun: obracun > 0 ? obracun.toFixed(4) : kol}));
    }, [stavkaForm.kolicina_unos, stavkaForm.jm_unos, stavkaForm.jm_obracun, trenutniProizvod]);

    const dinamickaCijena = trenutniProizvod ? izracunajDinamickuCijenu(trenutniProizvod, stavkaForm.jm_obracun) : 0;

    const dodajStavku = async () => {
        if(!trenutniProizvod || !stavkaForm.kolicina_obracun || parseFloat(stavkaForm.kolicina_obracun) <= 0) return alert("Odaberite proizvod i provjerite količine!");
        if(!odabraniKupac) return alert("Prvo odaberite kupca!");

        const kolicina_za_naplatu = parseFloat(stavkaForm.kolicina_obracun);
        // Ovdje sada uzimamo pametno preračunatu cijenu!
        const cijena_baza = dinamickaCijena; 
        const rabat_konacni = parseFloat(stavkaForm.konacni_rabat) || 0;
        
        if (rabat_konacni !== stavkaForm.sistemski_rabat) {
            await zapisiU_Log('RUČNA_IZMJENA_RABATA', `Za ${trenutniProizvod.sifra} na ponudi ${form.id}, rabat ručno postavljen na ${rabat_konacni}%.`);
        }

        const ukupno_bez_rabata = kolicina_za_naplatu * cijena_baza;
        const iznos_rabata = ukupno_bez_rabata * (rabat_konacni / 100);
        const ukupno_sa_rabatom = ukupno_bez_rabata - iznos_rabata;

        const novaStavka = {
            id: stavkaForm.id || Math.random().toString(),
            sifra: trenutniProizvod.sifra, naziv: trenutniProizvod.naziv,
            kolicina_unos: parseFloat(stavkaForm.kolicina_unos), jm_unos: stavkaForm.jm_unos,
            kolicina_obracun: kolicina_za_naplatu, jm_obracun: stavkaForm.jm_obracun,
            cijena_baza: cijena_baza, rabat_procenat: rabat_konacni, iznos_rabata: iznos_rabata, ukupno: ukupno_sa_rabatom
        };

        if (stavkaForm.id) setStavke(stavke.map(s => s.id === stavkaForm.id ? novaStavka : s));
        else setStavke([...stavke, novaStavka]);
        
        setStavkaForm({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3', sistemski_rabat: 0, konacni_rabat: '' });
        setTrenutniProizvod(null);
    };

    const urediStavku = (stavka) => {
        const nadjeni = katalog.find(k => k.sifra === stavka.sifra);
        setTrenutniProizvod(nadjeni || null);
        const tekstZaPolje = nadjeni ? `${nadjeni.sifra} | ${nadjeni.naziv}` : stavka.sifra;
        setStavkaForm({
            id: stavka.id, sifra_unos: tekstZaPolje, kolicina_unos: stavka.kolicina_unos, jm_unos: stavka.jm_unos,
            kolicina_obracun: stavka.kolicina_obracun, jm_obracun: stavka.jm_obracun,
            sistemski_rabat: izracunajRabat(nadjeni, odabraniKupac), konacni_rabat: stavka.rabat_procenat
        });
        window.scrollTo({ top: 300, behavior: 'smooth' });
    };

    const ukloniStavku = (id) => setStavke(stavke.filter(s => s.id !== id));

    const totals = useMemo(() => {
        let suma_bez_rabata = 0, suma_rabata = 0, suma_krajnja = 0;
        stavke.forEach(s => { suma_bez_rabata += (s.kolicina_obracun * s.cijena_baza); suma_rabata += s.iznos_rabata; suma_krajnja += s.ukupno; });
        const pdv = suma_krajnja * 0.17; 
        return { bez_rabata: suma_bez_rabata.toFixed(2), rabat: suma_rabata.toFixed(2), osnovica: suma_krajnja.toFixed(2), pdv: pdv.toFixed(2), za_naplatu: (suma_krajnja + pdv).toFixed(2) };
    }, [stavke]);

    const snimiPonudu = async () => {
        if(!form.kupac_naziv) return alert("Kupac je obavezan!");
        if(stavke.length === 0) return alert("Ponuda mora imati barem jednu stavku!");
        
        const payload = {
            id: form.id.toUpperCase(), kupac_naziv: form.kupac_naziv, datum: form.datum, rok_vazenja: form.rok_vazenja,
            nacin_placanja: form.nacin_placanja, valuta: form.valuta, paritet: form.paritet, depozit: parseFloat(form.depozit) || 0,
            napomena: form.napomena, stavke_jsonb: stavke, status: form.status,
            ukupno_bez_pdv: parseFloat(totals.osnovica), ukupno_rabat: parseFloat(totals.rabat), ukupno_sa_pdv: parseFloat(totals.za_naplatu),
            snimio_korisnik: loggedUser.ime_prezime
        };

        if (isEditingPonuda) {
            const { error } = await supabase.from('ponude').update(payload).eq('id', form.id);
            if(error) return alert("Greška: " + error.message);
            await zapisiU_Log('IZMJENA_PONUDE', `Ažurirana ponuda ${form.id}`);
            alert("✅ Ponuda uspješno ažurirana!");
        } else {
            const { error } = await supabase.from('ponude').insert([payload]);
            if(error) return alert("Greška pri snimanju: " + error.message);
            await zapisiU_Log('KREIRANA_PONUDA', `Ponuda ${form.id} za ${form.kupac_naziv}`);
            alert("✅ Ponuda uspješno kreirana!");
        }
        
        resetFormu(); load(); setTab('lista');
    };

    const pokreniIzmjenuPonude = (p) => {
        setForm({
            id: p.id, kupac_naziv: p.kupac_naziv, datum: p.datum, rok_vazenja: p.rok_vazenja,
            nacin_placanja: p.nacin_placanja || 'Virmanski', valuta: p.valuta || 'KM', paritet: p.paritet || 'FCA Srebrenik', 
            depozit: p.depozit || '', napomena: p.napomena || '', status: p.status || 'NA ODLUČIVANJU'
        });
        setOdabraniKupac(kupci.find(k => k.naziv === p.kupac_naziv) || null);
        setStavke(p.stavke_jsonb || []);
        setIsEditingPonuda(true);
        setTab('nova');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const promijeniStatusBrzo = async (p, noviStatus) => {
        await supabase.from('ponude').update({ status: noviStatus }).eq('id', p.id);
        await zapisiU_Log('STATUS_PONUDE', `Ponuda ${p.id} prebačena u ${noviStatus}`);
        load();
    };

    const resetFormu = () => {
        setForm({ id: generisiID(), kupac_naziv: '', datum: new Date().toISOString().split('T')[0], rok_vazenja: '', nacin_placanja: 'Virmanski', valuta: 'KM', paritet: 'FCA Srebrenik', depozit: '', napomena: '', status: 'NA ODLUČIVANJU' });
        setStavke([]); setOdabraniKupac(null); setIsEditingPonuda(false);
    };

    // Kreiranje PDF-a sa formatiranim (našim) datumom DD.MM.YYYY
    const formatirajDatum = (isoString) => {
        if(!isoString) return '';
        const [y, m, d] = isoString.split('-');
        return `${d}.${m}.${y}.`;
    };

    const kreirajPDF = () => {
        const printWin = window.open('', '_blank');
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${form.id}`;
        
        let redovi = stavke.map((s, i) => `
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${i+1}</td>
                <td style="border: 1px solid #ddd; padding: 8px;"><b>${s.sifra}</b><br/><small>${s.naziv}</small></td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${s.kolicina_obracun} ${s.jm_obracun}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${s.cijena_baza.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${s.rabat_procenat}%</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;"><b>${s.ukupno.toFixed(2)}</b></td>
            </tr>
        `).join('');

        const html = `
            <html>
            <head>
                <title>Ponuda ${form.id}</title>
                <style>
                    body { font-family: Arial, sans-serif; color: #333; line-height: 1.5; padding: 40px; }
                    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
                    .title { font-size: 24px; font-weight: bold; color: #1e293b; }
                    .info-grid { display: flex; justify-content: space-between; margin-bottom: 30px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
                    th { background-color: #f1f5f9; border: 1px solid #ddd; padding: 10px; text-align: left; }
                    .totals { width: 300px; float: right; border: 1px solid #ddd; padding: 15px; background: #f8fafc; }
                    .totals div { display: flex; justify-content: space-between; margin-bottom: 5px; }
                    .totals .big { font-size: 18px; font-weight: bold; border-top: 1px solid #ccc; padding-top: 10px; margin-top: 10px; }
                    .footer { clear: both; margin-top: 50px; font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 20px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="title">PONUDA / PREDRAČUN</div>
                        <p><b>Broj ponude:</b> ${form.id}<br/><b>Datum:</b> ${formatirajDatum(form.datum)}<br/><b>Važi do:</b> ${formatirajDatum(form.rok_vazenja)}</p>
                    </div>
                    <div><img src="${qrUrl}" alt="QR Kod" style="width: 100px; height: 100px;" /></div>
                </div>
                <div class="info-grid">
                    <div><b>Kupac:</b><br/>${form.kupac_naziv}<br/>${odabraniKupac?.adresa || ''}<br/>PDV: ${odabraniKupac?.pdv_broj || ''}</div>
                    <div>
                        <b>Detalji:</b><br/>
                        Paritet: ${form.paritet}<br/>
                        Plaćanje: ${form.nacin_placanja}<br/>
                        Valuta: ${form.valuta}<br/>
                        Status: ${form.status}
                    </div>
                </div>
                <table>
                    <thead><tr><th>R.B.</th><th>Šifra i Naziv</th><th style="text-align:center;">Količina</th><th style="text-align:right;">Cijena</th><th style="text-align:right;">Rabat</th><th style="text-align:right;">Ukupno (${form.valuta})</th></tr></thead>
                    <tbody>${redovi}</tbody>
                </table>
                <div class="totals">
                    <div><span>Iznos bez rabata:</span><span>${totals.bez_rabata}</span></div>
                    <div><span>Rabat:</span><span>- ${totals.rabat}</span></div>
                    <div><span>Osnovica:</span><span>${totals.osnovica}</span></div>
                    <div><span>PDV (17%):</span><span>${totals.pdv}</span></div>
                    <div class="big"><span>ZA NAPLATU:</span><span>${totals.za_naplatu} ${form.valuta}</span></div>
                </div>
                <div class="footer">
                    <p><b>Napomena:</b> ${form.napomena || 'Nema napomene.'}</p>
                    <p>Uplaćen depozit: ${form.depozit || 0} ${form.valuta}</p>
                </div>
                <script>setTimeout(() => { window.print(); window.close(); }, 800);</script>
            </body>
            </html>
        `;
        printWin.document.write(html);
        printWin.document.close();
        printWin.focus();
    };

    const ponudePotvrdjene = ponude.filter(p => p.status === 'POTVRĐENA');
    const ponudeOdlucivanje = ponude.filter(p => p.status === 'NA ODLUČIVANJU');
    const ponudeRealizovane = ponude.filter(p => p.status === 'REALIZOVANA ✅');

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 font-bold">
            <div className="flex justify-between items-center bg-[#1e293b] p-4 rounded-3xl border border-pink-500/30 shadow-lg">
                <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase hover:bg-slate-700">← Meni</button>
                <h2 className="text-pink-400 font-black tracking-widest uppercase text-xs">📝 UPRAVLJANJE PONUDAMA</h2>
            </div>

            <div className="flex bg-[#1e293b] p-1 rounded-2xl border border-slate-700">
                <button onClick={() => {setTab('nova'); if(!isEditingPonuda) resetFormu();}} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'nova' ? 'bg-pink-600 text-white shadow-lg' : 'text-slate-500'}`}>{isEditingPonuda ? '✏️ Ažuriranje Ponude' : '➕ Nova Ponuda'}</button>
                <button onClick={() => setTab('lista')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'lista' ? 'bg-pink-600 text-white shadow-lg' : 'text-slate-500'}`}>📋 Lista Ponuda</button>
            </div>

            {tab === 'nova' ? (
                <div className="space-y-4 animate-in slide-in-from-left max-w-4xl mx-auto">
                    <div className={`bg-[#1e293b] p-6 rounded-[2.5rem] border-2 shadow-2xl space-y-4 ${isEditingPonuda ? 'border-amber-500/50' : 'border-pink-500/30'}`}>
                        <div className="flex justify-between items-center">
                            <h3 className={`${isEditingPonuda ? 'text-amber-500' : 'text-pink-500'} font-black uppercase text-xs`}>1. Podaci o kupcu i parametrima ponude</h3>
                            {isEditingPonuda && <button onClick={resetFormu} className="text-[10px] bg-red-900/30 text-red-400 px-3 py-1 rounded-xl uppercase hover:bg-red-900/50">Odustani od izmjena ✕</button>}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border-b border-slate-700 pb-4">
                            <div className="relative z-50 col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* KUPAC</label>
                                <SearchableInput value={form.kupac_naziv} onChange={handleKupacSelect} list={kupci.map(k=>k.naziv)} />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">BROJ PONUDE</label>
                                <input value={form.id} disabled={isEditingPonuda} onChange={e=>setForm({...form, id:e.target.value})} className="w-full p-3 bg-slate-900 rounded-xl text-xs text-white outline-none border border-slate-700 font-black uppercase disabled:opacity-50" />
                            </div>
                            
                            <div>
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Datum izdavanja</label>
                                <input type="date" value={form.datum} onChange={e=>setForm({...form, datum:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700" />
                            </div>
                            <div>
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Rok Važenja</label>
                                <input type="date" value={form.rok_vazenja} onChange={e=>setForm({...form, rok_vazenja:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700" />
                            </div>
                            <div>
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Način Plaćanja</label>
                                <select value={form.nacin_placanja} onChange={e=>setForm({...form, nacin_placanja:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700"><option value="Virmanski">Virmanski</option><option value="Gotovina">Gotovina</option><option value="Kartica">Kartica</option></select>
                            </div>
                            <div>
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Valuta</label>
                                <select value={form.valuta} onChange={e=>setForm({...form, valuta:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700"><option value="KM">BAM (KM)</option><option value="EUR">EUR (€)</option><option value="RSD">RSD</option></select>
                            </div>

                            <div className="col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Paritet (Mjesto isporuke)</label>
                                <input value={form.paritet} onChange={e=>setForm({...form, paritet:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700" placeholder="npr. FCA Srebrenik" />
                            </div>
                            <div>
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Uplaćen Depozit</label>
                                <input type="number" value={form.depozit} onChange={e=>setForm({...form, depozit:e.target.value})} className="w-full p-3 bg-emerald-900/20 rounded-xl text-xs text-emerald-400 font-black outline-none border border-emerald-500/30" placeholder="0.00" />
                            </div>
                            <div>
                                <label className="text-[8px] text-pink-500 uppercase ml-2 block mb-1 font-black">Status Ponude</label>
                                <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})} className="w-full p-3 bg-pink-900/20 rounded-xl text-xs text-pink-400 font-black outline-none border border-pink-500/50">
                                    <option value="NA ODLUČIVANJU">Na odlučivanju</option>
                                    <option value="POTVRĐENA">POTVRĐENA ✅</option>
                                    <option value="REALIZOVANA ✅">REALIZOVANA (Zatvorena)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-4">
                        <h3 className="text-blue-500 font-black uppercase text-xs mb-4">2. Dinamički unos stavki</h3>
                        
                        <div className="relative z-40 mb-3">
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Pronađi proizvod (Šifra ili Naziv)</label>
                            <PonudeSearchableProizvod katalog={katalog} value={stavkaForm.sifra_unos} onChange={handleProizvodSelect} />
                        </div>

                        {trenutniProizvod && (
                            <div className="p-4 bg-blue-900/10 border border-blue-500/30 rounded-2xl animate-in zoom-in-95 space-y-4">
                                <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                                    <div><p className="text-white text-sm font-black">{trenutniProizvod.sifra} - {trenutniProizvod.naziv}</p><p className="text-[10px] text-slate-400">Dim: {trenutniProizvod.visina}x{trenutniProizvod.sirina}x{trenutniProizvod.duzina}</p></div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-400 uppercase">Cijena po {stavkaForm.jm_obracun}</p>
                                        <p className="text-emerald-400 font-black text-lg">{dinamickaCijena.toFixed(2)} {form.valuta}</p>
                                        {trenutniProizvod.default_jedinica !== stavkaForm.jm_obracun && <p className="text-[9px] text-slate-500">Katalog: {trenutniProizvod.cijena} KM/{trenutniProizvod.default_jedinica}</p>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                                    <div className="col-span-2">
                                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Unos: Količina i Jedinica</label>
                                        <div className="flex gap-1">
                                            <input type="number" value={stavkaForm.kolicina_unos} onChange={e=>setStavkaForm({...stavkaForm, kolicina_unos:e.target.value})} placeholder="Količina" className="flex-1 p-3 bg-[#0f172a] rounded-xl text-sm text-white font-black text-center outline-none border border-slate-700 focus:border-blue-500" />
                                            <select value={stavkaForm.jm_unos} onChange={e=>setStavkaForm({...stavkaForm, jm_unos:e.target.value})} className="w-20 p-3 bg-slate-800 rounded-xl text-xs text-white outline-none border border-slate-700"><option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option></select>
                                        </div>
                                    </div>
                                    
                                    <div className="col-span-2">
                                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Obračunava se po (Preračunato)</label>
                                        <div className="flex gap-1">
                                            <input type="number" value={stavkaForm.kolicina_obracun} onChange={e=>setStavkaForm({...stavkaForm, kolicina_obracun:e.target.value})} className="flex-1 p-3 bg-blue-900/20 rounded-xl text-sm text-blue-400 font-black text-center outline-none border border-blue-500/50" />
                                            <select value={stavkaForm.jm_obracun} onChange={e=>setStavkaForm({...stavkaForm, jm_obracun:e.target.value})} className="w-20 p-3 bg-slate-800 rounded-xl text-xs text-white outline-none border border-slate-700"><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option><option value="kom">kom</option></select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[8px] text-pink-500 uppercase ml-2 block mb-1 font-black">Konačni Rabat %</label>
                                        <input type="number" value={stavkaForm.konacni_rabat} onChange={e=>setStavkaForm({...stavkaForm, konacni_rabat:e.target.value})} className="w-full p-3 bg-pink-900/20 rounded-xl text-sm text-pink-400 font-black text-center outline-none border border-pink-500/50" title={`Sistemski predloženo: ${stavkaForm.sistemski_rabat}%`} />
                                    </div>
                                </div>

                                <button onClick={dodajStavku} className={`w-full py-4 text-white font-black rounded-xl text-xs shadow-lg uppercase mt-2 ${stavkaForm.id ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                                    {stavkaForm.id ? '✅ Ažuriraj ovu stavku' : '➕ Dodaj stavku na ponudu'}
                                </button>
                            </div>
                        )}
                    </div>

                    {stavke.length > 0 && (
                        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-emerald-500/30 shadow-2xl animate-in slide-in-from-bottom">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-emerald-500 font-black uppercase text-xs">3. Pregled Ponude i PDF</h3>
                                <button onClick={kreirajPDF} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-[10px] uppercase font-black border border-slate-600 hover:bg-white hover:text-black transition-all">🖨️ Kreiraj PDF</button>
                            </div>
                            
                            <div className="space-y-2 mb-6">
                                {stavke.map((s) => (
                                    <div key={s.id} onClick={() => urediStavku(s)} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden cursor-pointer hover:border-blue-500 transition-all" title="Klikni za izmjenu stavke">
                                        {s.rabat_procenat > 0 && <div className="absolute top-0 left-0 h-full w-1 bg-pink-500"></div>}
                                        <div className="ml-2">
                                            <p className="text-white text-xs font-black">{s.sifra} <span className="text-slate-400 font-normal ml-1">{s.naziv}</span></p>
                                            <p className="text-[9px] text-slate-500 uppercase mt-1">Unos: {s.kolicina_unos} {s.jm_unos} | Obr: <b className="text-white">{s.kolicina_obracun} {s.jm_obracun}</b> x {s.cijena_baza.toFixed(2)} {form.valuta}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                {s.rabat_procenat > 0 && <p className="text-[9px] text-pink-500 font-bold line-through">{(s.kolicina_obracun * s.cijena_baza).toFixed(2)}</p>}
                                                <p className="text-emerald-400 font-black text-sm">{s.ukupno.toFixed(2)} {form.valuta} {s.rabat_procenat > 0 && <span className="text-pink-500 text-[8px] ml-1">(-{s.rabat_procenat}%)</span>}</p>
                                            </div>
                                            <button onClick={(e)=>{e.stopPropagation(); ukloniStavku(s.id);}} className="text-red-500 font-black p-2 hover:bg-red-500/20 rounded-lg">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700 space-y-2">
                                <div className="flex justify-between text-xs text-slate-400"><span>Iznos bez rabata:</span><span>{totals.bez_rabata} {form.valuta}</span></div>
                                <div className="flex justify-between text-xs text-pink-500 font-bold"><span>Uračunat rabat:</span><span>- {totals.rabat} {form.valuta}</span></div>
                                <div className="flex justify-between text-xs text-slate-400 border-b border-slate-800 pb-2 mb-2"><span>Osnovica za PDV:</span><span>{totals.osnovica} {form.valuta}</span></div>
                                <div className="flex justify-between text-xs text-slate-400"><span>PDV (17%):</span><span>{totals.pdv} {form.valuta}</span></div>
                                {parseFloat(form.depozit) > 0 && <div className="flex justify-between text-xs text-amber-500 mt-1"><span>Uplaćen depozit:</span><span>- {parseFloat(form.depozit).toFixed(2)} {form.valuta}</span></div>}
                                <div className="flex justify-between text-lg text-white font-black pt-2 mt-2 border-t border-slate-700"><span>ZA NAPLATU:</span><span className="text-emerald-400">{(totals.za_naplatu - (parseFloat(form.depozit)||0)).toFixed(2)} {form.valuta}</span></div>
                            </div>

                            <textarea value={form.napomena} onChange={e=>setForm({...form, napomena:e.target.value})} placeholder="Dodatna napomena na ponudi (opciono)..." className="w-full mt-4 p-4 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-emerald-500" rows="2"></textarea>
                            
                            <button onClick={snimiPonudu} className={`w-full mt-4 py-5 text-white font-black rounded-2xl uppercase text-sm shadow-xl transition-all ${isEditingPonuda ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                                {isEditingPonuda ? '✅ Snimi izmjene ponude' : '✅ Kreiraj Ponudu'}
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-right">
                    
                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-emerald-500/30 shadow-2xl">
                        <h3 className="text-emerald-500 font-black uppercase text-xs mb-4 flex justify-between"><span>✅ POTVRĐENE PONUDE</span> <span className="bg-emerald-900/40 px-2 rounded">{ponudePotvrdjene.length}</span></h3>
                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                            {ponudePotvrdjene.length === 0 && <p className="text-center text-slate-500 text-xs">Nema potvrđenih ponuda.</p>}
                            {ponudePotvrdjene.map(p => (
                                <div key={p.id} className="p-4 bg-slate-900 border border-emerald-500/20 rounded-2xl cursor-pointer hover:border-emerald-500 transition-all">
                                    <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-2" onClick={() => pokreniIzmjenuPonude(p)}>
                                        <div><p className="text-white text-sm font-black">{p.id}</p><p className="text-slate-400 text-xs font-bold mt-1">{p.kupac_naziv}</p></div>
                                        <div className="text-right"><p className="text-emerald-400 font-black text-lg">{p.ukupno_sa_pdv} {p.valuta}</p><p className="text-[9px] text-slate-500 uppercase">{formatirajDatum(p.datum)}</p></div>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <button onClick={()=>promijeniStatusBrzo(p, 'NA ODLUČIVANJU')} className="text-[9px] text-slate-400 bg-slate-800 px-3 py-1 rounded hover:bg-amber-900/50 hover:text-amber-400 transition-all">Vrati na odlučivanje ↩</button>
                                        <span className="text-[9px] text-slate-500">Stavki: {p.stavke_jsonb ? p.stavke_jsonb.length : 0}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-amber-500/30 shadow-2xl">
                            <h3 className="text-amber-500 font-black uppercase text-xs mb-4 flex justify-between"><span>⏳ NA ODLUČIVANJU</span> <span className="bg-amber-900/40 px-2 rounded">{ponudeOdlucivanje.length}</span></h3>
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                                {ponudeOdlucivanje.map(p => (
                                    <div key={p.id} className="p-4 bg-slate-900 border border-amber-500/20 rounded-2xl cursor-pointer hover:border-amber-500 transition-all">
                                        <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-2" onClick={() => pokreniIzmjenuPonude(p)}>
                                            <div><p className="text-white text-sm font-black">{p.id}</p><p className="text-slate-400 text-xs font-bold mt-1">{p.kupac_naziv}</p></div>
                                            <div className="text-right"><p className="text-amber-400 font-black text-lg">{p.ukupno_sa_pdv} {p.valuta}</p><p className="text-[9px] text-slate-500 uppercase">{formatirajDatum(p.datum)}</p></div>
                                        </div>
                                        <div className="flex justify-between items-center mt-2">
                                            <button onClick={()=>promijeniStatusBrzo(p, 'POTVRĐENA')} className="text-[9px] text-white font-black bg-emerald-600 px-3 py-1 rounded hover:bg-emerald-500 transition-all">Potvrdi Ponudu ✅</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {ponudeRealizovane.length > 0 && (
                            <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-blue-500/30 shadow-2xl opacity-70 hover:opacity-100 transition-all">
                                <h3 className="text-blue-500 font-black uppercase text-xs mb-4">🔐 REALIZOVANO (ZATVORENO)</h3>
                                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
                                    {ponudeRealizovane.map(p => (
                                        <div key={p.id} onClick={() => pokreniIzmjenuPonude(p)} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl cursor-pointer">
                                            <div className="flex justify-between items-center">
                                                <div><p className="text-blue-400 text-xs font-black">{p.id}</p><p className="text-[10px] text-slate-400 mt-1">{p.kupac_naziv}</p></div>
                                                <p className="text-slate-300 font-black text-sm">{p.ukupno_sa_pdv} {p.valuta}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// MODUL: RADNI NALOZI (Zadnji modul u fajlu)
// ============================================================================
// ============================================================================
// MODUL: RADNI NALOZI
// ============================================================================

// Padajući meni za proizvode na radnom nalogu (BEZ PRIKAZA CIJENA!)
function RN_SearchableProizvod({ katalog, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value);
    useEffect(() => { setSearch(value); }, [value]);

    const filtered = katalog.filter(k => k.sifra.toUpperCase().includes(search.toUpperCase()) || k.naziv.toUpperCase().includes(search.toUpperCase()));

    return (
        <div className="relative font-black w-full">
            <input value={search} onFocus={() => setOpen(true)} onChange={e => { setSearch(e.target.value); setOpen(true); }} placeholder="Pronađi šifru ili naziv..." className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-purple-500" />
            {open && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    {filtered.map(k => {
                        const tekstZaPolje = `${k.sifra} | ${k.naziv} | Dim: ${k.visina}x${k.sirina}x${k.duzina}`;
                        return (
                            <div key={k.sifra} onClick={() => { onChange(k.sifra, tekstZaPolje); setSearch(tekstZaPolje); setOpen(false); }} className="p-3 border-b border-slate-700 hover:bg-purple-600 cursor-pointer transition-all">
                                <div className="text-white text-xs font-black">{k.sifra} <span className="text-purple-300 ml-1">{k.naziv}</span></div>
                                <div className="text-[9px] text-slate-400 mt-1 uppercase">Kat: {k.kategorija} | Dim: {k.visina}x{k.sirina}x{k.duzina}</div>
                            </div>
                        )
                    })}
                    <div onClick={() => setOpen(false)} className="p-2 text-center text-[8px] text-slate-500 cursor-pointer hover:text-white">Zatvori</div>
                </div>
            )}
        </div>
    );
}

function RadniNaloziModule({ onExit }) {
    const loggedUser = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');

    const [tab, setTab] = useState('novi');
    const [kupci, setKupci] = useState([]);
    const [katalog, setKatalog] = useState([]);
    const [nalozi, setNalozi] = useState([]);

    const generisiID = () => `RN-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;

    const [form, setForm] = useState({ id: generisiID(), broj_ponude: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0], rok_isporuke: '', napomena: '', status: 'U PROIZVODNJI', modifikovan: false });
    const [stavke, setStavke] = useState([]);
    const [originalneStavke, setOriginalneStavke] = useState(null); // Za poređenje modifikacija
    const [isEditingNalog, setIsEditingNalog] = useState(false);
    
    const [stavkaForm, setStavkaForm] = useState({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3' });
    const [trenutniProizvod, setTrenutniProizvod] = useState(null);

    const [skenerInput, setSkenerInput] = useState('');

    useEffect(() => { load(); }, []);

    const load = async () => {
        const {data: k} = await supabase.from('kupci').select('*').order('naziv'); setKupci(k||[]);
        const {data: cat} = await supabase.from('katalog_proizvoda').select('*').order('sifra'); setKatalog(cat||[]);
        const {data: rn} = await supabase.from('radni_nalozi').select('*').order('datum', { ascending: false }); setNalozi(rn||[]);
    };

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]);
    };

    // --- LOGIKA ZA SKENIRANJE QR KODA (Preuzimanje Ponude) ---
    const skenirajPonudu = async (e) => {
        if (e.key === 'Enter' || e.type === 'click') {
            const broj = skenerInput.toUpperCase().trim();
            if(!broj) return;
            
            const { data: ponuda } = await supabase.from('ponude').select('*').eq('id', broj).maybeSingle();
            if(!ponuda) return alert(`❌ Ponuda ${broj} nije pronađena u bazi!`);

            // Mapiramo stavke, brišemo cijene i rabate
            const prepravljeneStavke = (ponuda.stavke_jsonb || []).map(s => ({
                id: Math.random().toString(), sifra: s.sifra, naziv: s.naziv, 
                kolicina_unos: s.kolicina_unos, jm_unos: s.jm_unos,
                kolicina_obracun: s.kolicina_obracun, jm_obracun: s.jm_obracun
            }));

            setForm({ ...form, kupac_naziv: ponuda.kupac_naziv, broj_ponude: ponuda.id, napomena: ponuda.napomena });
            setStavke(prepravljeneStavke);
            setOriginalneStavke(JSON.stringify(prepravljeneStavke)); // Čuvamo "otisak" originala
            setSkenerInput('');
            alert(`✅ Uspješno preuzeti podaci iz ponude ${broj}`);
        }
    };

    const provjeriModifikacije = (noveStavke) => {
        if(originalneStavke && JSON.stringify(noveStavke) !== originalneStavke) {
            setForm(f => ({...f, modifikovan: true}));
        }
    };

    const handleProizvodSelect = (sifraVal, tekstZaPolje) => {
        const nadjeni = katalog.find(k => k.sifra === sifraVal);
        setTrenutniProizvod(nadjeni || null);
        if (nadjeni) setStavkaForm({ ...stavkaForm, id: null, sifra_unos: tekstZaPolje, jm_unos: 'kom', jm_obracun: nadjeni.default_jedinica || 'm3' });
    };

    // Preračunavanje iz Unosne jedinice u Obračunsku
    useEffect(() => {
        if(!trenutniProizvod || !stavkaForm.kolicina_unos) return;
        const kol = parseFloat(stavkaForm.kolicina_unos);
        let obracun = kol;
        if (stavkaForm.jm_unos === 'kom' && stavkaForm.jm_obracun !== 'kom') {
            const v = parseFloat(trenutniProizvod.visina) || 1;
            const s = parseFloat(trenutniProizvod.sirina) || 1;
            const d = parseFloat(trenutniProizvod.duzina) || 1;
            if (stavkaForm.jm_obracun === 'm3') obracun = kol * (v/100) * (s/100) * (d/100);
            if (stavkaForm.jm_obracun === 'm2') obracun = kol * (s/100) * (d/100);
            if (stavkaForm.jm_obracun === 'm1') obracun = kol * (d/100);
        }
        setStavkaForm(prev => ({...prev, kolicina_obracun: obracun > 0 ? obracun.toFixed(4) : kol}));
    }, [stavkaForm.kolicina_unos, stavkaForm.jm_unos, stavkaForm.jm_obracun, trenutniProizvod]);

    const dodajStavku = () => {
        if(!trenutniProizvod || !stavkaForm.kolicina_obracun) return alert("Odaberite proizvod i provjerite količine!");

        const novaStavka = {
            id: stavkaForm.id || Math.random().toString(), 
            sifra: trenutniProizvod.sifra, naziv: trenutniProizvod.naziv,
            kolicina_unos: parseFloat(stavkaForm.kolicina_unos), jm_unos: stavkaForm.jm_unos,
            kolicina_obracun: parseFloat(stavkaForm.kolicina_obracun), jm_obracun: stavkaForm.jm_obracun
        };

        let noveStavke = [];
        if (stavkaForm.id) noveStavke = stavke.map(s => s.id === stavkaForm.id ? novaStavka : s);
        else noveStavke = [...stavke, novaStavka];
        
        setStavke(noveStavke);
        provjeriModifikacije(noveStavke); // Poredi da li se nalog mijenjao u odnosu na ponudu

        setStavkaForm({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3' });
        setTrenutniProizvod(null);
    };

    const urediStavku = (stavka) => {
        const nadjeni = katalog.find(k => k.sifra === stavka.sifra);
        setTrenutniProizvod(nadjeni || null);
        const tekstZaPolje = nadjeni ? `${nadjeni.sifra} | ${nadjeni.naziv}` : stavka.sifra;
        setStavkaForm({ id: stavka.id, sifra_unos: tekstZaPolje, kolicina_unos: stavka.kolicina_unos, jm_unos: stavka.jm_unos, kolicina_obracun: stavka.kolicina_obracun, jm_obracun: stavka.jm_obracun });
    };

    const ukloniStavku = (id) => {
        const noveStavke = stavke.filter(s => s.id !== id);
        setStavke(noveStavke);
        provjeriModifikacije(noveStavke);
    };

    const snimiNalog = async () => {
        if(!form.kupac_naziv) return alert("Kupac je obavezan!");
        if(stavke.length === 0) return alert("Nalog mora imati stavke!");
        
        const payload = {
            id: form.id.toUpperCase(), broj_ponude: form.broj_ponude, kupac_naziv: form.kupac_naziv, 
            datum: form.datum, rok_isporuke: form.rok_isporuke, napomena: form.napomena, 
            stavke_jsonb: stavke, status: form.status, modifikovan: form.modifikovan,
            snimio_korisnik: loggedUser.ime_prezime
        };

        if (isEditingNalog) {
            const { error } = await supabase.from('radni_nalozi').update(payload).eq('id', form.id);
            if(error) return alert("Greška: " + error.message);
            await zapisiU_Log('IZMJENA_RN', `Ažuriran Radni Nalog ${form.id}`);
            alert("✅ Nalog uspješno ažuriran!");
        } else {
            const { error } = await supabase.from('radni_nalozi').insert([payload]);
            if(error) return alert("Greška pri snimanju: " + error.message);
            await zapisiU_Log('KREIRAN_RN', `Nalog ${form.id} za ${form.kupac_naziv}`);
            alert("✅ Radni Nalog uspješno kreiran!");
        }
        
        resetFormu(); load(); setTab('lista');
    };

    const resetFormu = () => {
        setForm({ id: generisiID(), broj_ponude: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0], rok_isporuke: '', napomena: '', status: 'U PROIZVODNJI', modifikovan: false });
        setStavke([]); setOriginalneStavke(null); setSkenerInput(''); setIsEditingNalog(false);
    };

    const pokreniIzmjenuNaloga = (n) => {
        setForm({ id: n.id, broj_ponude: n.broj_ponude || '', kupac_naziv: n.kupac_naziv, datum: n.datum, rok_isporuke: n.rok_isporuke || '', napomena: n.napomena || '', status: n.status || 'U PROIZVODNJI', modifikovan: n.modifikovan || false });
        setStavke(n.stavke_jsonb || []);
        // Ne učitavamo originalne jer su modifikacije već snimljene u bazi
        setIsEditingNalog(true); setTab('novi'); window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const statusiNaloga = ['U PROIZVODNJI', 'ZAVRŠENO', 'ISPORUČENO'];

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 font-bold">
            <div className="flex justify-between items-center bg-[#1e293b] p-4 rounded-3xl border border-purple-500/30 shadow-lg">
                <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase hover:bg-slate-700">← Meni</button>
                <h2 className="text-purple-400 font-black tracking-widest uppercase text-xs">🛠️ RADNI NALOZI (PROIZVODNJA)</h2>
            </div>

            <div className="flex bg-[#1e293b] p-1 rounded-2xl border border-slate-700">
                <button onClick={() => {setTab('novi'); if(!isEditingNalog) resetFormu();}} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'novi' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500'}`}>{isEditingNalog ? '✏️ Ažuriranje Naloga' : '➕ Novi Nalog'}</button>
                <button onClick={() => setTab('lista')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'lista' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500'}`}>📋 Pregled Naloga</button>
            </div>

            {tab === 'novi' ? (
                <div className="space-y-4 animate-in slide-in-from-left max-w-4xl mx-auto">
                    
                    {/* SKENER QR KODA (Samo za novi nalog) */}
                    {!isEditingNalog && (
                        <div className="bg-slate-900 border border-blue-500/50 p-6 rounded-3xl flex gap-3 items-center shadow-2xl">
                            <div className="text-2xl">📷</div>
                            <div className="flex-1">
                                <label className="text-[10px] text-blue-400 uppercase font-black block mb-1">Skener QR Koda ili Ručni unos ponude</label>
                                <input value={skenerInput} onChange={e=>setSkenerInput(e.target.value)} onKeyDown={skenirajPonudu} placeholder="npr. PON-2026-1234 (i pritisni Enter)" className="w-full p-4 bg-[#0f172a] rounded-xl text-sm text-white outline-none border border-blue-500 focus:border-blue-400 uppercase font-black tracking-widest shadow-inner" />
                            </div>
                            <button onClick={skenirajPonudu} className="bg-blue-600 text-white px-6 py-4 rounded-xl text-xs uppercase font-black hover:bg-blue-500 self-end mb-1">Učitaj</button>
                        </div>
                    )}

                    {/* ZAGLAVLJE RADNOG NALOGA */}
                    <div className={`bg-[#1e293b] p-6 rounded-[2.5rem] border-2 shadow-2xl space-y-4 ${form.modifikovan ? 'border-amber-500' : 'border-purple-500/30'}`}>
                        <div className="flex justify-between items-center">
                            <h3 className="text-purple-400 font-black uppercase text-xs">1. Parametri Radnog Naloga</h3>
                            {isEditingNalog && <button onClick={resetFormu} className="text-[10px] bg-red-900/30 text-red-400 px-3 py-1 rounded-xl uppercase hover:bg-red-900/50">Odustani od izmjena ✕</button>}
                        </div>

                        {form.modifikovan && (
                            <div className="bg-amber-900/40 border border-amber-500 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
                                <span className="text-2xl">⚠️</span>
                                <div className="text-[10px] text-amber-400 uppercase font-black leading-tight">
                                    PAŽNJA: Ovaj radni nalog je ručno izmijenjen i više se ne poklapa 100% sa originalnom ponudom.<br/>
                                    <span className="text-white font-normal mt-1 block">Ova informacija će biti poslana u računovodstvo za otpremnicu i račun!</span>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border-b border-slate-700 pb-4">
                            <div className="col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Broj Ponude (Vezni dokument)</label>
                                <input value={form.broj_ponude} onChange={e=>setForm({...form, broj_ponude:e.target.value})} className="w-full p-3 bg-slate-900 rounded-xl text-xs text-white outline-none border border-slate-700 uppercase" placeholder="Nema vezane ponude" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">BROJ NALOGA</label>
                                <input value={form.id} disabled={isEditingNalog} onChange={e=>setForm({...form, id:e.target.value})} className="w-full p-3 bg-slate-900 rounded-xl text-xs text-white outline-none border border-slate-700 font-black uppercase disabled:opacity-50" />
                            </div>
                            <div className="relative z-50 col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* KUPAC (Za koga proizvodimo)</label>
                                <SearchableInput value={form.kupac_naziv} onChange={v=>setForm({...form, kupac_naziv:v})} list={kupci.map(k=>k.naziv)} />
                            </div>
                            <div>
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Datum izdavanja</label>
                                <input type="date" value={form.datum} onChange={e=>setForm({...form, datum:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700" />
                            </div>
                            <div>
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Rok Isporuke</label>
                                <input type="date" value={form.rok_isporuke} onChange={e=>setForm({...form, rok_isporuke:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Status Proizvodnje</label>
                                <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-purple-500/50 text-purple-400 font-black">
                                    <option value="U PROIZVODNJI">U proizvodnji</option><option value="ZAVRŠENO">Završeno (Spremno za isporuku)</option><option value="ISPORUČENO">Isporučeno</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* DODAVANJE STAVKI */}
                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-4">
                        <h3 className="text-blue-500 font-black uppercase text-xs mb-4">2. Unos stavki za proizvodnju (BEZ CIJENA)</h3>
                        
                        <div className="relative z-40 mb-3">
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Pronađi proizvod</label>
                            <RN_SearchableProizvod katalog={katalog} value={stavkaForm.sifra_unos} onChange={handleProizvodSelect} />
                        </div>

                        {trenutniProizvod && (
                            <div className="p-4 bg-blue-900/10 border border-blue-500/30 rounded-2xl animate-in zoom-in-95 space-y-4">
                                <div className="border-b border-slate-700 pb-3">
                                    <p className="text-white text-sm font-black">{trenutniProizvod.sifra} - {trenutniProizvod.naziv}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">Dim: <span className="text-white">{trenutniProizvod.visina}x{trenutniProizvod.sirina}x{trenutniProizvod.duzina}</span> | Kat: {trenutniProizvod.kategorija}</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Zahtijevana Količina (Unos)</label>
                                        <div className="flex gap-1">
                                            <input type="number" value={stavkaForm.kolicina_unos} onChange={e=>setStavkaForm({...stavkaForm, kolicina_unos:e.target.value})} placeholder="0" className="flex-1 p-3 bg-[#0f172a] rounded-xl text-lg text-white font-black text-center outline-none border border-slate-700 focus:border-blue-500" />
                                            <select value={stavkaForm.jm_unos} onChange={e=>setStavkaForm({...stavkaForm, jm_unos:e.target.value})} className="w-24 p-3 bg-slate-800 rounded-xl text-xs text-white outline-none border border-slate-700"><option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option></select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Kalkulacija proizvodnje</label>
                                        <div className="flex gap-1">
                                            <input type="number" value={stavkaForm.kolicina_obracun} onChange={e=>setStavkaForm({...stavkaForm, kolicina_obracun:e.target.value})} className="flex-1 p-3 bg-blue-900/20 rounded-xl text-sm text-blue-400 font-black text-center outline-none border border-blue-500/50" />
                                            <select value={stavkaForm.jm_obracun} onChange={e=>setStavkaForm({...stavkaForm, jm_obracun:e.target.value})} className="w-24 p-3 bg-slate-800 rounded-xl text-xs text-white outline-none border border-slate-700"><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option><option value="kom">kom</option></select>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={dodajStavku} className={`w-full py-4 text-white font-black rounded-xl text-xs shadow-lg uppercase mt-2 ${stavkaForm.id ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                                    {stavkaForm.id ? '✅ Ažuriraj ovu stavku' : '➕ Dodaj u radni nalog'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* PREGLED NALOGA */}
                    {stavke.length > 0 && (
                        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-purple-500/30 shadow-2xl animate-in slide-in-from-bottom">
                            <h3 className="text-purple-400 font-black uppercase text-xs mb-4">3. Pregled Radnog Naloga</h3>
                            <div className="space-y-2 mb-6">
                                {stavke.map((s, i) => (
                                    <div key={s.id} onClick={() => urediStavku(s)} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-purple-500 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-black">{i+1}</div>
                                            <div>
                                                <p className="text-white text-xs font-black">{s.sifra} <span className="text-slate-400 font-normal ml-1">{s.naziv}</span></p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <p className="text-xs text-slate-400 uppercase">Proizvesti:</p>
                                                <p className="text-purple-400 font-black text-sm">{s.kolicina_obracun} {s.jm_obracun} <span className="text-slate-500 text-[10px]">({s.kolicina_unos} {s.jm_unos})</span></p>
                                            </div>
                                            <button onClick={(e)=>{e.stopPropagation(); ukloniStavku(s.id);}} className="text-red-500 font-black p-2 hover:bg-red-500/20 rounded-lg">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <textarea value={form.napomena} onChange={e=>setForm({...form, napomena:e.target.value})} placeholder="Uputa za radnike na mašinama (opciono)..." className="w-full mt-4 p-4 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-purple-500" rows="3"></textarea>
                            <button onClick={snimiNalog} className={`w-full mt-4 py-5 text-white font-black rounded-2xl uppercase text-sm shadow-xl transition-all ${isEditingNalog ? 'bg-amber-600 hover:bg-amber-500' : 'bg-purple-600 hover:bg-purple-500'}`}>
                                {isEditingNalog ? '✅ Snimi izmjene naloga' : '🖨️ Kreiraj Radni Nalog'}
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl animate-in slide-in-from-right">
                    <h3 className="text-slate-400 font-black uppercase text-[10px] mb-4">Arhiva radnih naloga</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2">
                        {nalozi.length === 0 && <p className="text-center text-slate-500 text-xs col-span-2">Nema kreiranih radnih naloga.</p>}
                        {nalozi.map(n => (
                            <div key={n.id} onClick={() => pokreniIzmjenuNaloga(n)} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl cursor-pointer hover:border-purple-500 transition-all relative overflow-hidden">
                                {n.modifikovan && <div className="absolute top-0 right-0 bg-amber-500 text-black text-[8px] px-2 py-1 font-black rounded-bl-lg uppercase">Mijenjan</div>}
                                <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-2">
                                    <div><p className="text-purple-400 font-black text-sm">{n.id}</p><p className="text-white text-xs font-bold mt-1">{n.kupac_naziv}</p></div>
                                    <div className="text-right"><p className={`text-[9px] px-2 py-1 rounded font-black uppercase ${n.status === 'ZAVRŠENO' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-purple-900/30 text-purple-400'}`}>{n.status}</p><p className="text-[9px] text-slate-500 uppercase mt-2">Rok: {n.rok_isporuke}</p></div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] text-slate-400">Vezano za: {n.broj_ponude || 'Nema ponude'}</span>
                                    <span className="text-[9px] text-slate-500">Stavki za izradu: {n.stavke_jsonb ? n.stavke_jsonb.length : 0}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
// ============================================================================
// MODUL: OTPREMNICE (ISPORUKA)
// ============================================================================

function OTP_SearchableProizvod({ katalog, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value);
    useEffect(() => { setSearch(value); }, [value]);

    const filtered = katalog.filter(k => k.sifra.toUpperCase().includes(search.toUpperCase()) || k.naziv.toUpperCase().includes(search.toUpperCase()));

    return (
        <div className="relative font-black w-full">
            <input value={search} onFocus={() => setOpen(true)} onChange={e => { setSearch(e.target.value); setOpen(true); }} placeholder="Pronađi šifru ili naziv..." className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-orange-500" />
            {open && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    {filtered.map(k => {
                        const tekstZaPolje = `${k.sifra} | ${k.naziv} | Dim: ${k.visina}x${k.sirina}x${k.duzina}`;
                        return (
                            <div key={k.sifra} onClick={() => { onChange(k.sifra, tekstZaPolje); setSearch(tekstZaPolje); setOpen(false); }} className="p-3 border-b border-slate-700 hover:bg-orange-600 cursor-pointer transition-all">
                                <div className="text-white text-xs font-black">{k.sifra} <span className="text-orange-300 ml-1">{k.naziv}</span></div>
                                <div className="text-[9px] text-slate-400 mt-1 uppercase">Kat: {k.kategorija} | Dim: {k.visina}x{k.sirina}x{k.duzina}</div>
                            </div>
                        )
                    })}
                    <div onClick={() => setOpen(false)} className="p-2 text-center text-[8px] text-slate-500 cursor-pointer hover:text-white">Zatvori</div>
                </div>
            )}
        </div>
    );
}

function OtpremniceModule({ onExit }) {
    const loggedUser = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');

    const [tab, setTab] = useState('nova');
    const [kupci, setKupci] = useState([]);
    const [katalog, setKatalog] = useState([]);
    const [otpremnice, setOtpremnice] = useState([]);

    const generisiID = () => `OTP-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;

    const [form, setForm] = useState({ id: generisiID(), broj_veze: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0], vozac: '', registracija: '', napomena: '', status: 'KREIRANA' });
    const [stavke, setStavke] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    
    const [stavkaForm, setStavkaForm] = useState({ id: null, sifra_unos: '', kolicina_obracun: '', jm_obracun: 'm3' });
    const [trenutniProizvod, setTrenutniProizvod] = useState(null);

    const [skenerInput, setSkenerInput] = useState('');

    useEffect(() => { load(); }, []);

    const load = async () => {
        const {data: k} = await supabase.from('kupci').select('*').order('naziv'); setKupci(k||[]);
        const {data: cat} = await supabase.from('katalog_proizvoda').select('*').order('sifra'); setKatalog(cat||[]);
        const {data: otp} = await supabase.from('otpremnice').select('*').order('datum', { ascending: false }); setOtpremnice(otp||[]);
    };

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]);
    };

    // MAGIJA: Prepoznavanje da li je skenirana Ponuda ili Radni Nalog
    const skenirajVezu = async (e) => {
        if (e.key === 'Enter' || e.type === 'click') {
            const broj = skenerInput.toUpperCase().trim();
            if(!broj) return;
            
            if (broj.startsWith('PON-')) {
                const { data: ponuda } = await supabase.from('ponude').select('*').eq('id', broj).maybeSingle();
                if(!ponuda) return alert(`❌ Ponuda ${broj} nije pronađena!`);
                primijeniVezu(ponuda, broj);
            } else if (broj.startsWith('RN-')) {
                const { data: nalog } = await supabase.from('radni_nalozi').select('*').eq('id', broj).maybeSingle();
                if(!nalog) return alert(`❌ Radni nalog ${broj} nije pronađen!`);
                primijeniVezu(nalog, broj);
            } else {
                alert("❌ Nepoznat format! Mora početi sa PON- ili RN-");
            }
        }
    };

    const primijeniVezu = (dokument, broj) => {
        // Mapiramo stavke bez cijena i rabata (čista količina za vozača/otpremnicu)
        const prepravljeneStavke = (dokument.stavke_jsonb || []).map(s => ({
            id: Math.random().toString(), sifra: s.sifra, naziv: s.naziv, 
            kolicina_obracun: s.kolicina_obracun, jm_obracun: s.jm_obracun
        }));
        setForm({ ...form, kupac_naziv: dokument.kupac_naziv, broj_veze: broj, napomena: dokument.napomena || '' });
        setStavke(prepravljeneStavke);
        setSkenerInput('');
        alert(`✅ Uspješno preuzeti podaci iz dokumenta: ${broj}`);
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
            stavke_jsonb: stavke, status: form.status, snimio_korisnik: loggedUser.ime_prezime
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

    const pokreniIzmjenu = (o) => {
        setForm({ id: o.id, broj_veze: o.broj_veze || '', kupac_naziv: o.kupac_naziv, datum: o.datum, vozac: o.vozac || '', registracija: o.registracija || '', napomena: o.napomena || '', status: o.status || 'KREIRANA' });
        setStavke(o.stavke_jsonb || []);
        setIsEditing(true); setTab('nova'); window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 font-bold">
            <div className="flex justify-between items-center bg-[#1e293b] p-4 rounded-3xl border border-orange-500/30 shadow-lg">
                <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase hover:bg-slate-700">← Meni</button>
                <h2 className="text-orange-400 font-black tracking-widest uppercase text-xs">🚚 OTPREMNICE (ISPORUKA)</h2>
            </div>

            <div className="flex bg-[#1e293b] p-1 rounded-2xl border border-slate-700">
                <button onClick={() => {setTab('nova'); if(!isEditing) resetFormu();}} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'nova' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500'}`}>{isEditing ? '✏️ Ažuriranje Otpremnice' : '➕ Nova Otpremnica'}</button>
                <button onClick={() => setTab('lista')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'lista' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500'}`}>📋 Pregled Otpremnica</button>
            </div>

            {tab === 'nova' ? (
                <div className="space-y-4 animate-in slide-in-from-left max-w-4xl mx-auto">
                    
                    {/* SKENER QR KODA (Povući sa Ponude ili RN) */}
                    {!isEditing && (
                        <div className="bg-slate-900 border border-orange-500/50 p-6 rounded-3xl flex gap-3 items-center shadow-2xl">
                            <div className="text-2xl">📷</div>
                            <div className="flex-1">
                                <label className="text-[10px] text-orange-400 uppercase font-black block mb-1">Skener QR Koda (Skeniraj Ponudu ili Radni Nalog)</label>
                                <input value={skenerInput} onChange={e=>setSkenerInput(e.target.value)} onKeyDown={skenirajVezu} placeholder="npr. PON-2026-1234 ili RN-2026-9876 (pritisni Enter)" className="w-full p-4 bg-[#0f172a] rounded-xl text-sm text-white outline-none border border-orange-500 focus:border-orange-400 uppercase font-black tracking-widest shadow-inner" />
                            </div>
                            <button onClick={skenirajVezu} className="bg-orange-600 text-white px-6 py-4 rounded-xl text-xs uppercase font-black hover:bg-orange-500 self-end mb-1">Učitaj</button>
                        </div>
                    )}

                    {/* ZAGLAVLJE OTPREMNICE */}
                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border-2 border-orange-500/30 shadow-2xl space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-orange-400 font-black uppercase text-xs">1. Parametri Otpremnice</h3>
                            {isEditing && <button onClick={resetFormu} className="text-[10px] bg-red-900/30 text-red-400 px-3 py-1 rounded-xl uppercase hover:bg-red-900/50">Odustani od izmjena ✕</button>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border-b border-slate-700 pb-4">
                            <div className="col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Vezni Dokument (Ponuda/RN)</label>
                                <input value={form.broj_veze} onChange={e=>setForm({...form, broj_veze:e.target.value})} className="w-full p-3 bg-slate-900 rounded-xl text-xs text-white outline-none border border-slate-700 uppercase" placeholder="Nema veznog dokumenta" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">BROJ OTPREMNICE</label>
                                <input value={form.id} disabled={isEditing} onChange={e=>setForm({...form, id:e.target.value})} className="w-full p-3 bg-slate-900 rounded-xl text-xs text-white outline-none border border-slate-700 font-black uppercase disabled:opacity-50" />
                            </div>
                            <div className="relative z-50 col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* KUPAC (Za koga isporučujemo)</label>
                                <SearchableInput value={form.kupac_naziv} onChange={v=>setForm({...form, kupac_naziv:v})} list={kupci.map(k=>k.naziv)} />
                            </div>
                            <div>
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Datum isporuke</label>
                                <input type="date" value={form.datum} onChange={e=>setForm({...form, datum:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700" />
                            </div>
                            <div>
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Status</label>
                                <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-orange-500/50 text-orange-400 font-black">
                                    <option value="KREIRANA">Kreirana</option><option value="ISPORUČENO">Isporučeno</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Ime i Prezime Vozača</label>
                                <input value={form.vozac} onChange={e=>setForm({...form, vozac:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700" placeholder="npr. Marko Marković" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Registracija Vozila</label>
                                <input value={form.registracija} onChange={e=>setForm({...form, registracija:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 uppercase" placeholder="npr. A12-B-345" />
                            </div>
                        </div>
                    </div>

                    {/* DODAVANJE STAVKI */}
                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-4">
                        <h3 className="text-blue-500 font-black uppercase text-xs mb-4">2. Stavke otpremnice (Samo Količina, bez cijena)</h3>
                        
                        <div className="relative z-40 mb-3">
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Pronađi proizvod</label>
                            <OTP_SearchableProizvod katalog={katalog} value={stavkaForm.sifra_unos} onChange={handleProizvodSelect} />
                        </div>

                        {trenutniProizvod && (
                            <div className="p-4 bg-blue-900/10 border border-blue-500/30 rounded-2xl animate-in zoom-in-95 space-y-4">
                                <div className="border-b border-slate-700 pb-3">
                                    <p className="text-white text-sm font-black">{trenutniProizvod.sifra} - {trenutniProizvod.naziv}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">Dim: <span className="text-white">{trenutniProizvod.visina}x{trenutniProizvod.sirina}x{trenutniProizvod.duzina}</span></p>
                                </div>

                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Količina za isporuku</label>
                                        <input type="number" value={stavkaForm.kolicina_obracun} onChange={e=>setStavkaForm({...stavkaForm, kolicina_obracun:e.target.value})} placeholder="0" className="w-full p-3 bg-[#0f172a] rounded-xl text-lg text-white font-black text-center outline-none border border-slate-700 focus:border-blue-500" />
                                    </div>
                                    <div className="w-32">
                                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Jedinica Mjere</label>
                                        <select value={stavkaForm.jm_obracun} onChange={e=>setStavkaForm({...stavkaForm, jm_obracun:e.target.value})} className="w-full p-3 bg-slate-800 rounded-xl text-lg text-white font-black outline-none border border-slate-700"><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option><option value="kom">kom</option></select>
                                    </div>
                                </div>
                                <button onClick={dodajStavku} className={`w-full py-4 text-white font-black rounded-xl text-xs shadow-lg uppercase mt-2 ${stavkaForm.id ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                                    {stavkaForm.id ? '✅ Ažuriraj ovu stavku' : '➕ Dodaj na otpremnicu'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* PREGLED OTPREMNICE */}
                    {stavke.length > 0 && (
                        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-orange-500/30 shadow-2xl animate-in slide-in-from-bottom">
                            <h3 className="text-orange-400 font-black uppercase text-xs mb-4">3. Pregled Otpremnice</h3>
                            <div className="space-y-2 mb-6">
                                {stavke.map((s, i) => (
                                    <div key={s.id} onClick={() => urediStavku(s)} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-orange-500 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-black">{i+1}</div>
                                            <div>
                                                <p className="text-white text-xs font-black">{s.sifra} <span className="text-slate-400 font-normal ml-1">{s.naziv}</span></p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <p className="text-orange-400 font-black text-lg">{s.kolicina_obracun} {s.jm_obracun}</p>
                                            </div>
                                            <button onClick={(e)=>{e.stopPropagation(); ukloniStavku(s.id);}} className="text-red-500 font-black p-2 hover:bg-red-500/20 rounded-lg">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <textarea value={form.napomena} onChange={e=>setForm({...form, napomena:e.target.value})} placeholder="Napomena na isporuci (opciono)..." className="w-full mt-4 p-4 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-orange-500" rows="3"></textarea>
                            <button onClick={snimiOtpremnicu} className={`w-full mt-4 py-5 text-white font-black rounded-2xl uppercase text-sm shadow-xl transition-all ${isEditing ? 'bg-amber-600 hover:bg-amber-500' : 'bg-orange-600 hover:bg-orange-500'}`}>
                                {isEditing ? '✅ Snimi izmjene otpremnice' : '🖨️ Kreiraj Otpremnicu'}
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl animate-in slide-in-from-right">
                    <h3 className="text-slate-400 font-black uppercase text-[10px] mb-4">Arhiva Otpremnica</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2">
                        {otpremnice.length === 0 && <p className="text-center text-slate-500 text-xs col-span-2">Nema kreiranih otpremnica.</p>}
                        {otpremnice.map(o => (
                            <div key={o.id} onClick={() => pokreniIzmjenu(o)} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl cursor-pointer hover:border-orange-500 transition-all relative overflow-hidden">
                                <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-2">
                                    <div><p className="text-orange-400 font-black text-sm">{o.id}</p><p className="text-white text-xs font-bold mt-1">{o.kupac_naziv}</p></div>
                                    <div className="text-right"><p className={`text-[9px] px-2 py-1 rounded font-black uppercase ${o.status === 'ISPORUČENO' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-orange-900/30 text-orange-400'}`}>{o.status}</p><p className="text-[9px] text-slate-500 uppercase mt-2">{o.datum}</p></div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] text-slate-400">Veza: {o.broj_veze || 'Nema'}</span>
                                    <span className="text-[9px] text-slate-500">Stavki: {o.stavke_jsonb ? o.stavke_jsonb.length : 0} | Vozilo: {o.registracija || 'Nepoznato'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
// ============================================================================
// MODUL: RAČUNI (FINANSIJE)
// ============================================================================

// Pomoćni pametni dropdown za dodavanje NOVIH proizvoda na račun
function RAC_SearchableProizvod({ katalog, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value);
    useEffect(() => { setSearch(value); }, [value]);

    const filtered = katalog.filter(k => k.sifra.toUpperCase().includes(search.toUpperCase()) || k.naziv.toUpperCase().includes(search.toUpperCase()));

    return (
        <div className="relative font-black w-full">
            <input value={search} onFocus={() => setOpen(true)} onChange={e => { setSearch(e.target.value); setOpen(true); }} placeholder="Pronađi šifru ili naziv..." className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-red-500" />
            {open && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    {filtered.map(k => {
                        const tekstZaPolje = `${k.sifra} | ${k.naziv} | Dim: ${k.visina}x${k.sirina}x${k.duzina}`;
                        return (
                            <div key={k.sifra} onClick={() => { onChange(k.sifra, tekstZaPolje); setSearch(tekstZaPolje); setOpen(false); }} className="p-3 border-b border-slate-700 hover:bg-red-600 cursor-pointer transition-all">
                                <div className="text-white text-xs font-black">{k.sifra} <span className="text-red-300 ml-1">{k.naziv}</span></div>
                                <div className="text-[9px] text-slate-400 mt-1 uppercase">Cijena: {k.cijena} KM</div>
                            </div>
                        )
                    })}
                    <div onClick={() => setOpen(false)} className="p-2 text-center text-[8px] text-slate-500 cursor-pointer hover:text-white">Zatvori</div>
                </div>
            )}
        </div>
    );
}

function RacuniModule({ onExit }) {
    const loggedUser = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');

    const [tab, setTab] = useState('novi');
    const [kupci, setKupci] = useState([]);
    const [katalog, setKatalog] = useState([]);
    const [racuni, setRacuni] = useState([]);

    const generisiID = () => `RAC-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;

    const [form, setForm] = useState({
        id: generisiID(), broj_veze: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0],
        rok_placanja: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString().split('T')[0],
        nacin_placanja: 'Virmanski', valuta: 'KM', napomena: '', status: 'NENAPLAĆENO', originalna_ponuda: null
    });

    const [isEditing, setIsEditing] = useState(false);
    const [odabraniKupac, setOdabraniKupac] = useState(null);
    const [stavke, setStavke] = useState([]);
    const [skenerInput, setSkenerInput] = useState('');

    // Moćna forma za uređivanje/dodavanje novih stavki na račun
    const [stavkaForm, setStavkaForm] = useState({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3', sistemski_rabat: 0, konacni_rabat: '' });
    const [trenutniProizvod, setTrenutniProizvod] = useState(null);

    useEffect(() => { load(); }, []);

    const load = async () => {
        const {data: k} = await supabase.from('kupci').select('*').order('naziv'); setKupci(k||[]);
        const {data: cat} = await supabase.from('katalog_proizvoda').select('*').order('sifra'); setKatalog(cat||[]);
        const {data: r} = await supabase.from('racuni').select('*').order('datum', { ascending: false }); setRacuni(r||[]);
    };

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]);
    };

    const izracunajRabat = (proizvod, kupac) => {
        if(!kupac || !kupac.rabati_jsonb) return 0;
        const rabati = kupac.rabati_jsonb;
        if (rabati.proizvodi && rabati.proizvodi[proizvod.sifra]) return parseFloat(rabati.proizvodi[proizvod.sifra]);
        if (rabati.kategorije && rabati.kategorije[proizvod.kategorija]) return parseFloat(rabati.kategorije[proizvod.kategorija]);
        if (rabati.ukupni) return parseFloat(rabati.ukupni);
        return 0;
    };

    // MAGIJA DETEKTIVA: Traženje duboke veze (OTP -> RN -> PON)
    const skenirajVezu = async (e) => {
        if (e.key === 'Enter' || e.type === 'click') {
            const broj = skenerInput.toUpperCase().trim();
            if(!broj) return;
            
            let dokument = null;
            let baznaPonuda = null;
            let napomenaTekst = `Povezano sa: ${broj}`;

            // Korak 1: Identifikacija osnovnog skeniranog dokumenta
            if (broj.startsWith('OTP-')) {
                const { data: otp } = await supabase.from('otpremnice').select('*').eq('id', broj).maybeSingle();
                dokument = otp;
                if (otp && otp.broj_veze) {
                    if (otp.broj_veze.startsWith('PON-')) {
                        const { data: pon } = await supabase.from('ponude').select('*').eq('id', otp.broj_veze).maybeSingle();
                        baznaPonuda = pon; napomenaTekst += ` -> ${otp.broj_veze}`;
                    } else if (otp.broj_veze.startsWith('RN-')) {
                        const { data: rn } = await supabase.from('radni_nalozi').select('*').eq('id', otp.broj_veze).maybeSingle();
                        napomenaTekst += ` -> ${otp.broj_veze}`;
                        if (rn && rn.broj_ponude) {
                            const { data: pon } = await supabase.from('ponude').select('*').eq('id', rn.broj_ponude).maybeSingle();
                            baznaPonuda = pon; napomenaTekst += ` -> ${rn.broj_ponude}`;
                        }
                    }
                }
            } else if (broj.startsWith('RN-')) {
                const { data: rn } = await supabase.from('radni_nalozi').select('*').eq('id', broj).maybeSingle();
                dokument = rn;
                if (rn && rn.broj_ponude) {
                    const { data: pon } = await supabase.from('ponude').select('*').eq('id', rn.broj_ponude).maybeSingle();
                    baznaPonuda = pon; napomenaTekst += ` -> ${rn.broj_ponude}`;
                }
            } else if (broj.startsWith('PON-')) {
                const { data: pon } = await supabase.from('ponude').select('*').eq('id', broj).maybeSingle();
                dokument = pon; baznaPonuda = pon;
            } else {
                return alert("❌ Nepoznat format! Mora početi sa OTP-, RN- ili PON-");
            }

            if(!dokument) return alert(`❌ Dokument ${broj} nije pronađen!`);

            const kupacIzBaze = kupci.find(k => k.naziv === dokument.kupac_naziv);
            setOdabraniKupac(kupacIzBaze || null);

            // Korak 2: Spajanje količina sa finansijama iz PONUDE
            const stavkeKolicine = dokument.stavke_jsonb || [];
            const stavkeFinansije = baznaPonuda ? (baznaPonuda.stavke_jsonb || []) : [];

            const konacneStavke = stavkeKolicine.map(sk => {
                const proizvod = katalog.find(k => k.sifra === sk.sifra);
                let cijena_baza = proizvod ? parseFloat(proizvod.cijena) : (sk.cijena_baza || 0);
                let rabat_procenat = proizvod && kupacIzBaze ? izracunajRabat(proizvod, kupacIzBaze) : 0;

                // Ako imamo baznu ponudu, tražimo isti proizvod na njoj da zadržimo fiksirane cijene i rabate
                const nadjenoUPonudi = stavkeFinansije.find(sf => sf.sifra === sk.sifra);
                if (nadjenoUPonudi) {
                    cijena_baza = nadjenoUPonudi.cijena_baza;
                    rabat_procenat = nadjenoUPonudi.rabat_procenat;
                }

                const kolicina = sk.kolicina_obracun || sk.kolicina || 0;
                const ukupno_bez_rabata = kolicina * cijena_baza;
                const iznos_rabata = ukupno_bez_rabata * (rabat_procenat / 100);
                const ukupno = ukupno_bez_rabata - iznos_rabata;

                return {
                    id: Math.random().toString(), sifra: sk.sifra, naziv: sk.naziv,
                    kolicina_unos: sk.kolicina_unos || kolicina, jm_unos: sk.jm_unos || sk.jm_obracun || 'kom',
                    kolicina_obracun: kolicina, jm_obracun: sk.jm_obracun || sk.jm || 'kom',
                    cijena_baza, rabat_procenat, iznos_rabata, ukupno
                };
            });

            setForm({ ...form, kupac_naziv: dokument.kupac_naziv, broj_veze: broj, napomena: napomenaTekst, originalna_ponuda: baznaPonuda ? baznaPonuda.id : null });
            setStavke(konacneStavke);
            setSkenerInput('');
            alert(`✅ Učitane količine sa: ${broj}\n${baznaPonuda ? '✅ Primijenjene cijene iz originalne ponude: ' + baznaPonuda.id : '⚠️ Nema bazne ponude, primijenjene standardne cijene.'}`);
        }
    };

    // Ručno dodavanje i uređivanje na samom računu
    const handleProizvodSelect = (sifraVal, tekstZaPolje) => {
        const nadjeni = katalog.find(k => k.sifra === sifraVal);
        setTrenutniProizvod(nadjeni || null);
        if (nadjeni) {
            const predlozeniRabat = izracunajRabat(nadjeni, odabraniKupac);
            setStavkaForm({ ...stavkaForm, id: null, sifra_unos: tekstZaPolje, jm_unos: 'kom', jm_obracun: nadjeni.default_jedinica || 'm3', sistemski_rabat: predlozeniRabat, konacni_rabat: predlozeniRabat });
        }
    };

    useEffect(() => {
        if(!trenutniProizvod || !stavkaForm.kolicina_unos) return;
        const kol = parseFloat(stavkaForm.kolicina_unos);
        let obracun = kol;
        if (stavkaForm.jm_unos === 'kom' && stavkaForm.jm_obracun !== 'kom') {
            const v = parseFloat(trenutniProizvod.visina) || 1;
            const s = parseFloat(trenutniProizvod.sirina) || 1;
            const d = parseFloat(trenutniProizvod.duzina) || 1;
            if (stavkaForm.jm_obracun === 'm3') obracun = kol * (v/100) * (s/100) * (d/100);
            if (stavkaForm.jm_obracun === 'm2') obracun = kol * (s/100) * (d/100);
            if (stavkaForm.jm_obracun === 'm1') obracun = kol * (d/100);
        }
        setStavkaForm(prev => ({...prev, kolicina_obracun: obracun > 0 ? obracun.toFixed(4) : kol}));
    }, [stavkaForm.kolicina_unos, stavkaForm.jm_unos, stavkaForm.jm_obracun, trenutniProizvod]);

    const dodajStavku = async () => {
        if(!trenutniProizvod || !stavkaForm.kolicina_obracun) return alert("Odaberite proizvod i količinu!");
        if(!odabraniKupac) return alert("Prvo odaberite kupca za pravilan obračun!");

        const kolicina = parseFloat(stavkaForm.kolicina_obracun);
        const cijena_baza = parseFloat(trenutniProizvod.cijena);
        const rabat_konacni = parseFloat(stavkaForm.konacni_rabat) || 0;
        
        const ukupno_bez_rabata = kolicina * cijena_baza;
        const iznos_rabata = ukupno_bez_rabata * (rabat_konacni / 100);
        const ukupno_sa_rabatom = ukupno_bez_rabata - iznos_rabata;

        if (rabat_konacni !== stavkaForm.sistemski_rabat) {
            await zapisiU_Log('RUČNA_IZMJENA_RABATA_RACUN', `Za ${trenutniProizvod.sifra} na računu ručno postavljen rabat ${rabat_konacni}%.`);
        }

        const novaStavka = {
            id: stavkaForm.id || Math.random().toString(),
            sifra: trenutniProizvod.sifra, naziv: trenutniProizvod.naziv,
            kolicina_unos: parseFloat(stavkaForm.kolicina_unos), jm_unos: stavkaForm.jm_unos,
            kolicina_obracun: kolicina, jm_obracun: stavkaForm.jm_obracun,
            cijena_baza, rabat_procenat: rabat_konacni, iznos_rabata, ukupno: ukupno_sa_rabatom
        };

        if (stavkaForm.id) setStavke(stavke.map(s => s.id === stavkaForm.id ? novaStavka : s));
        else setStavke([...stavke, novaStavka]);
        
        setStavkaForm({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3', sistemski_rabat: 0, konacni_rabat: '' });
        setTrenutniProizvod(null);
    };

    const urediStavku = (stavka) => {
        const nadjeni = katalog.find(k => k.sifra === stavka.sifra);
        setTrenutniProizvod(nadjeni || null);
        const tekstZaPolje = nadjeni ? `${nadjeni.sifra} | ${nadjeni.naziv}` : stavka.sifra;
        setStavkaForm({ 
            id: stavka.id, sifra_unos: tekstZaPolje, kolicina_unos: stavka.kolicina_unos, jm_unos: stavka.jm_unos, 
            kolicina_obracun: stavka.kolicina_obracun, jm_obracun: stavka.jm_obracun,
            sistemski_rabat: izracunajRabat(nadjeni, odabraniKupac), konacni_rabat: stavka.rabat_procenat 
        });
    };

    const ukloniStavku = (id) => setStavke(stavke.filter(s => s.id !== id));

    const totals = useMemo(() => {
        let suma_bez_rabata = 0, suma_rabata = 0, suma_krajnja = 0;
        stavke.forEach(s => { suma_bez_rabata += (s.kolicina_obracun * s.cijena_baza); suma_rabata += s.iznos_rabata; suma_krajnja += s.ukupno; });
        const pdv = suma_krajnja * 0.17; 
        return { bez_rabata: suma_bez_rabata.toFixed(2), rabat: suma_rabata.toFixed(2), osnovica: suma_krajnja.toFixed(2), pdv: pdv.toFixed(2), za_naplatu: (suma_krajnja + pdv).toFixed(2) };
    }, [stavke]);

    const snimiRacun = async () => {
        if(!form.kupac_naziv) return alert("Kupac je obavezan!");
        if(stavke.length === 0) return alert("Račun mora imati stavke!");
        
        const payload = {
            id: form.id.toUpperCase(), broj_veze: form.broj_veze, kupac_naziv: form.kupac_naziv, 
            datum: form.datum, rok_placanja: form.rok_placanja, nacin_placanja: form.nacin_placanja, 
            valuta: form.valuta, napomena: form.napomena, stavke_jsonb: stavke, status: form.status,
            ukupno_bez_pdv: parseFloat(totals.osnovica), ukupno_rabat: parseFloat(totals.rabat), ukupno_sa_pdv: parseFloat(totals.za_naplatu),
            snimio_korisnik: loggedUser.ime_prezime
        };

        if (isEditing) {
            const { error } = await supabase.from('racuni').update(payload).eq('id', form.id);
            if(error) return alert("Greška: " + error.message);
            await zapisiU_Log('IZMJENA_RACUNA', `Ažuriran račun ${form.id}`);
            alert("✅ Račun uspješno ažuriran!");
        } else {
            const { error } = await supabase.from('racuni').insert([payload]);
            if(error) return alert("Greška pri snimanju: " + error.message);
            
            // ZATVARANJE ORIGINALNE PONUDE AKO POSTOJI!
            if (form.originalna_ponuda) {
                await supabase.from('ponude').update({ status: 'REALIZOVANA ✅' }).eq('id', form.originalna_ponuda);
                await zapisiU_Log('ZATVARANJE_PONUDE', `Ponuda ${form.originalna_ponuda} zatvorena kreiranjem računa ${form.id}`);
            }

            await zapisiU_Log('KREIRAN_RACUN', `Račun ${form.id} za ${form.kupac_naziv}`);
            alert("✅ Račun uspješno kreiran!");
        }
        
        resetFormu(); load(); setTab('lista');
    };

    const resetFormu = () => {
        setForm({ id: generisiID(), broj_veze: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0], rok_placanja: '', nacin_placanja: 'Virmanski', valuta: 'KM', napomena: '', status: 'NENAPLAĆENO', originalna_ponuda: null });
        setStavke([]); setSkenerInput(''); setIsEditing(false); setOdabraniKupac(null); setStavkaForm({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3', sistemski_rabat: 0, konacni_rabat: '' });
    };

    const handleKupacSelect = (naziv) => {
        setForm({...form, kupac_naziv: naziv});
        setOdabraniKupac(kupci.find(k => k.naziv === naziv) || null);
    };

    const pokreniIzmjenu = (r) => {
        setForm({ id: r.id, broj_veze: r.broj_veze || '', kupac_naziv: r.kupac_naziv, datum: r.datum, rok_placanja: r.rok_placanja || '', nacin_placanja: r.nacin_placanja || 'Virmanski', valuta: r.valuta || 'KM', napomena: r.napomena || '', status: r.status || 'NENAPLAĆENO', originalna_ponuda: null });
        setStavke(r.stavke_jsonb || []);
        setOdabraniKupac(kupci.find(k => k.naziv === r.kupac_naziv) || null);
        setIsEditing(true); setTab('novi'); window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const promijeniStatusBrzo = async (r, noviStatus) => {
        await supabase.from('racuni').update({ status: noviStatus }).eq('id', r.id);
        await zapisiU_Log('STATUS_RACUNA', `Račun ${r.id} prebačen u ${noviStatus}`);
        load();
    };

    const neplaceni = racuni.filter(r => r.status === 'NENAPLAĆENO');
    const placeni = racuni.filter(r => r.status === 'NAPLAĆENO');

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 font-bold">
            <div className="flex justify-between items-center bg-[#1e293b] p-4 rounded-3xl border border-red-500/30 shadow-lg">
                <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase hover:bg-slate-700">← Meni</button>
                <h2 className="text-red-400 font-black tracking-widest uppercase text-xs">💰 FINANSIJE: RAČUNI</h2>
            </div>

            <div className="flex bg-[#1e293b] p-1 rounded-2xl border border-slate-700">
                <button onClick={() => {setTab('novi'); if(!isEditing) resetFormu();}} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'novi' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500'}`}>{isEditing ? '✏️ Ažuriranje Računa' : '➕ Kreiraj Račun'}</button>
                <button onClick={() => setTab('lista')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'lista' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500'}`}>📋 Pregled Računa</button>
            </div>

            {tab === 'novi' ? (
                <div className="space-y-4 animate-in slide-in-from-left max-w-4xl mx-auto">
                    
                    {!isEditing && (
                        <div className="bg-slate-900 border border-red-500/50 p-6 rounded-3xl flex gap-3 items-center shadow-2xl">
                            <div className="text-2xl">📷</div>
                            <div className="flex-1">
                                <label className="text-[10px] text-red-400 uppercase font-black block mb-1">Skener QR Koda (Skeniraj OTP, RN ili PON)</label>
                                <input value={skenerInput} onChange={e=>setSkenerInput(e.target.value)} onKeyDown={skenirajVezu} placeholder="npr. OTP-123, RN-123 ili PON-123 (pritisni Enter)" className="w-full p-4 bg-[#0f172a] rounded-xl text-sm text-white outline-none border border-red-500 focus:border-red-400 uppercase font-black tracking-widest shadow-inner" />
                            </div>
                            <button onClick={skenirajVezu} className="bg-red-600 text-white px-6 py-4 rounded-xl text-xs uppercase font-black hover:bg-red-500 self-end mb-1">Povući podatke</button>
                        </div>
                    )}

                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border-2 border-red-500/30 shadow-2xl space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-red-400 font-black uppercase text-xs">1. Parametri Računa</h3>
                            {isEditing && <button onClick={resetFormu} className="text-[10px] bg-red-900/30 text-red-400 px-3 py-1 rounded-xl uppercase hover:bg-red-900/50">Odustani od izmjena ✕</button>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border-b border-slate-700 pb-4">
                            <div className="col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Vezni Dokument (Istorija)</label>
                                <input value={form.broj_veze} onChange={e=>setForm({...form, broj_veze:e.target.value})} className="w-full p-3 bg-slate-900 rounded-xl text-xs text-white outline-none border border-slate-700 uppercase" placeholder="Nema veznog dokumenta" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">BROJ RAČUNA</label>
                                <input value={form.id} disabled={isEditing} onChange={e=>setForm({...form, id:e.target.value})} className="w-full p-3 bg-slate-900 rounded-xl text-xs text-white outline-none border border-slate-700 font-black uppercase disabled:opacity-50" />
                            </div>
                            <div className="relative z-50 col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* KUPAC</label>
                                <SearchableInput value={form.kupac_naziv} onChange={handleKupacSelect} list={kupci.map(k=>k.naziv)} />
                            </div>
                            <div>
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Datum izdavanja</label>
                                <input type="date" value={form.datum} onChange={e=>setForm({...form, datum:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700" />
                            </div>
                            <div>
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Rok plaćanja</label>
                                <input type="date" value={form.rok_placanja} onChange={e=>setForm({...form, rok_placanja:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700" />
                            </div>
                        </div>
                    </div>

                    {/* MOĆAN UNOS NOVIH ILI DODATNIH STAVKI */}
                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-4">
                        <h3 className="text-blue-500 font-black uppercase text-xs mb-4">2. Dinamički dodaj / uredi stavke</h3>
                        
                        <div className="relative z-40 mb-3">
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Pronađi proizvod za dodavanje</label>
                            <RAC_SearchableProizvod katalog={katalog} value={stavkaForm.sifra_unos} onChange={handleProizvodSelect} />
                        </div>

                        {trenutniProizvod && (
                            <div className="p-4 bg-blue-900/10 border border-blue-500/30 rounded-2xl animate-in zoom-in-95 space-y-4">
                                <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                                    <div><p className="text-white text-sm font-black">{trenutniProizvod.sifra} - {trenutniProizvod.naziv}</p><p className="text-[10px] text-slate-400">Dim: {trenutniProizvod.visina}x{trenutniProizvod.sirina}x{trenutniProizvod.duzina}</p></div>
                                    <div className="text-right"><p className="text-[10px] text-slate-400 uppercase">Baza</p><p className="text-red-400 font-black text-lg">{trenutniProizvod.cijena} {form.valuta}</p></div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                                    <div className="col-span-2">
                                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Unos: Količina i Jedinica</label>
                                        <div className="flex gap-1">
                                            <input type="number" value={stavkaForm.kolicina_unos} onChange={e=>setStavkaForm({...stavkaForm, kolicina_unos:e.target.value})} placeholder="0" className="flex-1 p-3 bg-[#0f172a] rounded-xl text-sm text-white font-black text-center outline-none border border-slate-700 focus:border-red-500" />
                                            <select value={stavkaForm.jm_unos} onChange={e=>setStavkaForm({...stavkaForm, jm_unos:e.target.value})} className="w-20 p-3 bg-slate-800 rounded-xl text-xs text-white outline-none border border-slate-700"><option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option></select>
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Obračun po</label>
                                        <div className="flex gap-1">
                                            <input type="number" value={stavkaForm.kolicina_obracun} onChange={e=>setStavkaForm({...stavkaForm, kolicina_obracun:e.target.value})} className="flex-1 p-3 bg-red-900/20 rounded-xl text-sm text-red-400 font-black text-center outline-none border border-red-500/50" />
                                            <select value={stavkaForm.jm_obracun} onChange={e=>setStavkaForm({...stavkaForm, jm_obracun:e.target.value})} className="w-20 p-3 bg-slate-800 rounded-xl text-xs text-white outline-none border border-slate-700"><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option><option value="kom">kom</option></select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[8px] text-pink-500 uppercase ml-2 block mb-1 font-black">Rabat %</label>
                                        <input type="number" value={stavkaForm.konacni_rabat} onChange={e=>setStavkaForm({...stavkaForm, konacni_rabat:e.target.value})} className="w-full p-3 bg-pink-900/20 rounded-xl text-sm text-pink-400 font-black text-center outline-none border border-pink-500/50" />
                                    </div>
                                </div>
                                <button onClick={dodajStavku} className={`w-full py-4 text-white font-black rounded-xl text-xs shadow-lg uppercase mt-2 ${stavkaForm.id ? 'bg-amber-600 hover:bg-amber-500' : 'bg-red-600 hover:bg-red-500'}`}>
                                    {stavkaForm.id ? '✅ Ažuriraj ovu stavku' : '➕ Dodaj stavku na račun'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* PREGLED STAVKI I TOTALI */}
                    {stavke.length > 0 && (
                        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-red-500/30 shadow-2xl animate-in slide-in-from-bottom">
                            <h3 className="text-red-400 font-black uppercase text-xs mb-4">3. Konačni obračun</h3>
                            <div className="space-y-2 mb-6">
                                {stavke.map((s, i) => (
                                    <div key={s.id} onClick={() => urediStavku(s)} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden cursor-pointer hover:border-red-500 transition-all">
                                        {s.rabat_procenat > 0 && <div className="absolute top-0 left-0 h-full w-1 bg-pink-500"></div>}
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-black">{i+1}</div>
                                            <div>
                                                <p className="text-white text-xs font-black">{s.sifra} <span className="text-slate-400 font-normal ml-1">{s.naziv}</span></p>
                                                <p className="text-[9px] text-slate-500 uppercase mt-1">Količina: <b className="text-white">{s.kolicina_obracun} {s.jm_obracun}</b> x {s.cijena_baza} {form.valuta}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                {s.rabat_procenat > 0 && <p className="text-[9px] text-pink-500 font-bold line-through">{(s.kolicina_obracun * s.cijena_baza).toFixed(2)}</p>}
                                                <p className="text-red-400 font-black text-sm">{s.ukupno.toFixed(2)} {form.valuta} {s.rabat_procenat > 0 && <span className="text-pink-500 text-[8px] ml-1">(-{s.rabat_procenat}%)</span>}</p>
                                            </div>
                                            <button onClick={(e)=>{e.stopPropagation(); ukloniStavku(s.id);}} className="text-red-500 font-black p-2 hover:bg-red-500/20 rounded-lg">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700 space-y-2">
                                <div className="flex justify-between text-xs text-slate-400"><span>Iznos bez rabata:</span><span>{totals.bez_rabata} {form.valuta}</span></div>
                                <div className="flex justify-between text-xs text-pink-500 font-bold"><span>Uračunat rabat:</span><span>- {totals.rabat} {form.valuta}</span></div>
                                <div className="flex justify-between text-xs text-slate-400 border-b border-slate-800 pb-2 mb-2"><span>Osnovica za PDV:</span><span>{totals.osnovica} {form.valuta}</span></div>
                                <div className="flex justify-between text-xs text-slate-400"><span>PDV (17%):</span><span>{totals.pdv} {form.valuta}</span></div>
                                <div className="flex justify-between text-xl text-white font-black pt-2 mt-2 border-t border-slate-700"><span>ZA NAPLATU:</span><span className="text-red-400">{totals.za_naplatu} {form.valuta}</span></div>
                            </div>

                            <textarea value={form.napomena} onChange={e=>setForm({...form, napomena:e.target.value})} placeholder="Napomena na računu..." className="w-full mt-4 p-4 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-red-500" rows="2"></textarea>
                            <button onClick={snimiRacun} className={`w-full mt-4 py-5 text-white font-black rounded-2xl uppercase text-sm shadow-xl transition-all ${isEditing ? 'bg-amber-600 hover:bg-amber-500' : 'bg-red-600 hover:bg-red-500'}`}>
                                {isEditing ? '✅ Snimi izmjene računa' : '✅ Zaključi i Kreiraj Račun'}
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-right">
                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-red-500/30 shadow-2xl">
                        <h3 className="text-red-500 font-black uppercase text-xs mb-4 flex justify-between"><span>⏳ ČEKA NAPLATU</span> <span className="bg-red-900/40 px-2 rounded">{neplaceni.length}</span></h3>
                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                            {neplaceni.map(r => (
                                <div key={r.id} className="p-4 bg-slate-900 border border-red-500/20 rounded-2xl cursor-pointer hover:border-red-500 transition-all">
                                    <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-2" onClick={() => pokreniIzmjenu(r)}>
                                        <div><p className="text-white text-sm font-black">{r.id}</p><p className="text-slate-400 text-xs font-bold mt-1">{r.kupac_naziv}</p></div>
                                        <div className="text-right"><p className="text-red-400 font-black text-lg">{r.ukupno_sa_pdv} {r.valuta}</p><p className="text-[9px] text-slate-500 uppercase">Rok: {r.rok_placanja}</p></div>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <button onClick={()=>promijeniStatusBrzo(r, 'NAPLAĆENO')} className="text-[9px] text-white font-black bg-emerald-600 px-3 py-1 rounded hover:bg-emerald-500 transition-all">Označi kao naplaćeno 💰</button>
                                        <span className="text-[9px] text-slate-500">Veza: {r.broj_veze || '-'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-emerald-500/30 shadow-2xl">
                        <h3 className="text-emerald-500 font-black uppercase text-xs mb-4 flex justify-between"><span>✅ NAPLAĆENO (ZATVORENO)</span> <span className="bg-emerald-900/40 px-2 rounded">{placeni.length}</span></h3>
                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                            {placeni.map(r => (
                                <div key={r.id} className="p-4 bg-slate-900 border border-emerald-500/20 rounded-2xl cursor-pointer hover:border-emerald-500 transition-all">
                                    <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-2" onClick={() => pokreniIzmjenu(r)}>
                                        <div><p className="text-white text-sm font-black">{r.id}</p><p className="text-slate-400 text-xs font-bold mt-1">{r.kupac_naziv}</p></div>
                                        <div className="text-right"><p className="text-emerald-400 font-black text-lg">{r.ukupno_sa_pdv} {r.valuta}</p><p className="text-[9px] text-slate-500 uppercase">Izdano: {r.datum}</p></div>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <button onClick={()=>promijeniStatusBrzo(r, 'NENAPLAĆENO')} className="text-[9px] text-slate-400 bg-slate-800 px-3 py-1 rounded hover:bg-red-900/50 hover:text-red-400 transition-all">Vrati u dugovanje ↩</button>
                                        <span className="text-[9px] text-slate-500">Veza: {r.broj_veze || '-'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
// ============================================================================
// MODUL: ANALITIKA / DASHBOARD zadnji pokusaj
// ============================================================================
