"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Papa from 'papaparse';

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
           <div className="w-full flex justify-between items-center bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-xl mb-6">
              <div className="text-left">
                <p className="text-[10px] text-blue-500 uppercase tracking-widest font-black">Operater</p>
                <p className="text-white text-xl font-black uppercase tracking-tighter">{loggedUser.ime_prezime}</p>
              </div>
              <button onClick={() => {localStorage.removeItem('smart_timber_user'); setLoggedUser(null);}} className="bg-red-900/20 text-red-500 px-5 py-3 rounded-2xl text-[10px] font-black hover:bg-red-500 hover:text-white transition-all">ODJAVA ✕</button>
           </div>
           
           <div className="grid grid-cols-2 gap-4 w-full">
             <MenuBtn label="PONUDE" icon="📝" color="pink" onClick={() => setActiveModule('ponude')} />
             <MenuBtn label="R. NALOZI" icon="📋" color="purple" onClick={() => setActiveModule('nalozi')} />
             <MenuBtn label="PRIJEM TRUPACA" icon="📥" color="indigo" onClick={() => setActiveModule('prijem')} />
             <MenuBtn label="PROREZ (Trupci)" icon="🪚" color="cyan" onClick={() => setActiveModule('prorez')} />
           </div>
           <div className="grid grid-cols-1 gap-4 w-full">
             <MenuBtn label="PILANA (Izlaz)" icon="🪵" color="emerald" onClick={() => setActiveModule('pilana')} />
             <MenuBtn label="DORADA (Ulaz/Izlaz)" icon="🔄" color="amber" onClick={() => setActiveModule('dorada')} />
             {loggedUser.uloga === 'admin' && (
                <button onClick={() => {const p = prompt("PIN:"); if(p==="0111") setActiveModule('settings')}} className="mt-8 text-slate-500 text-xs uppercase tracking-[0.3em] font-black hover:text-blue-400 transition-colors w-full border border-slate-800 rounded-3xl py-4">⚙️ Sistemska Podešavanja</button>
             )}
           </div>
        </div>
      ) : activeModule === 'prijem' ? (
        <PrijemModule user={loggedUser} onExit={() => setActiveModule('dashboard')} />
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

function SearchableInput({ label, value, onChange, list = [] }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative font-black">
            <label className="text-[8px] text-slate-500 uppercase ml-3 block mb-1">{label}</label>
            <input type="text" value={value} onFocus={() => setOpen(true)} onChange={e => { onChange(e.target.value.toUpperCase()); setOpen(true); }} className="w-full p-3 bg-[#0f172a] border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-blue-500 uppercase" />
            {open && list.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-40 overflow-y-auto z-50">
                    {list.filter(i => i.includes(value)).map((item, idx) => (
                        <div key={idx} onClick={() => { onChange(item); setOpen(false); }} className="p-3 text-[10px] border-b border-slate-700 hover:bg-blue-600 uppercase cursor-pointer text-white">{item}</div>
                    ))}
                    <div onClick={() => setOpen(false)} className="p-2 text-center text-[8px] text-slate-500 cursor-pointer">Zatvori</div>
                </div>
            )}
        </div>
    );
}

function MasterHeader({ header, setHeader, onExit, color, user, hideMasina = false }) {
    const [showWorkers, setShowWorkers] = useState(false);
    const handleDate = (dir) => { const d = new Date(header.datum); d.setDate(d.getDate() + dir); setHeader({...header, datum: d.toISOString().split('T')[0]}); };
    return (
        <div className="bg-[#1e293b] p-5 rounded-[2.5rem] border border-slate-700 shadow-xl space-y-4 font-bold relative">
            <div className="flex justify-between items-center">
                <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase">← Meni</button>
                <div className="flex gap-3 items-center">
                    {!hideMasina && (
                        <button onClick={() => setShowWorkers(true)} className="bg-blue-900/30 text-blue-400 px-3 py-1 rounded-lg text-xs flex items-center gap-2 border border-blue-500/30 hover:bg-blue-800">
                            <span>👥</span> Radnici
                        </button>
                    )}
                </div>
            </div>
            <div className="flex items-center justify-between bg-slate-950 p-2 rounded-2xl border border-slate-800">
                <button onClick={() => handleDate(-1)} className="w-10 h-10 bg-slate-800 rounded-lg text-white font-black">-</button>
                <span className={`text-sm font-black uppercase ${color}`}>{new Date(header.datum).toLocaleDateString('de-DE')}</span>
                <button onClick={() => handleDate(1)} className="w-10 h-10 bg-slate-800 rounded-lg text-white font-black">+</button>
            </div>
            <div className={`grid ${hideMasina ? 'grid-cols-1' : 'grid-cols-2'} gap-2 font-black`}>
                <SearchableInput label="MJESTO" value={header.mjesto} onChange={v => {setHeader({...header, mjesto: v}); localStorage.setItem('last_loc', v)}} list={['SREBRENIK', 'MAGACIN A', 'RAMPA']} />
                {!hideMasina && <SearchableInput label="MAŠINA" value={header.masina} onChange={v => {setHeader({...header, masina: v}); localStorage.setItem('last_masina', v)}} list={['BRENTA 1', 'ŠTUCER 1', 'VIŠELISNI']} />}
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
    const loadWorkers = async () => { const { data } = await supabase.from('aktivni_radnici').select('*').eq('masina_naziv', masina).is('vrijeme_odjave', null); setWorkers(data || []); };
    const loadAllRadnici = async () => { const { data } = await supabase.from('radnici').select('ime_prezime'); setAllRadnici(data ? data.map(r => r.ime_prezime) : []); };

    const handleWorkerAction = async (kodRadnika) => {
        if(!kodRadnika) return;
        const ID = kodRadnika.toUpperCase();
        const vecTu = workers.find(w => w.radnik_ime === ID);
        if (vecTu) {
            await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('id', vecTu.id);
        } else {
            const { data: aktivanDrugdje } = await supabase.from('aktivni_radnici').select('*').eq('radnik_ime', ID).is('vrijeme_odjave', null).maybeSingle();
            if (aktivanDrugdje) {
                if (window.confirm(`Radnik je već na mašini: ${aktivanDrugdje.masina_naziv}.\nOdjaviti i prebaciti ovdje?`)) {
                    await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('id', aktivanDrugdje.id);
                    await supabase.from('aktivni_radnici').insert([{ radnik_ime: ID, masina_naziv: masina }]);
                }
            } else {
                await supabase.from('aktivni_radnici').insert([{ radnik_ime: ID, masina_naziv: masina }]);
            }
        }
        setScanCode(''); loadWorkers();
    };

    return (
        <div className="absolute top-0 left-0 w-full bg-[#0f172a] p-6 rounded-[2.5rem] border border-blue-500 shadow-2xl z-50 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-blue-500 text-xs tracking-widest uppercase font-black">Prijava na mašinu</h3>
                <button onClick={onClose} className="text-slate-500 text-xl font-black">✕</button>
            </div>
            <div className="flex gap-2 mb-6 items-end">
                <div className="flex-1"><SearchableInput label="Ime ili QR" value={scanCode} onChange={v => setScanCode(v)} list={allRadnici} /></div>
                <button onClick={() => handleWorkerAction(scanCode)} className="bg-blue-600 px-6 rounded-xl font-black text-white h-[46px] mb-[2px]">OK</button>
                <button onClick={() => setIsScanningWorkers(true)} className="bg-amber-600 px-4 rounded-xl font-black text-white h-[46px] mb-[2px]">📷</button>
            </div>
            <div className="border-t border-slate-700 pt-4">
                <span className="text-[10px] text-slate-500 uppercase block mb-3 font-black">Prisutni ({workers.length}):</span>
                <div className="flex flex-wrap gap-2">
                    {workers.length === 0 && <span className="text-xs text-slate-600 font-bold">Nema prijavljenih.</span>}
                    {workers.map(w => (
                        <div key={w.id} className="bg-emerald-900/30 text-emerald-400 border border-emerald-500/30 pl-4 pr-1 py-1 rounded-full text-[10px] flex items-center gap-3 font-bold shadow-lg">
                            {w.radnik_ime}
                            <button onClick={() => handleWorkerAction(w.radnik_ime)} className="bg-red-900/50 text-red-500 w-6 h-6 rounded-full hover:bg-red-500 hover:text-white transition-all font-black">✕</button>
                        </div>
                    ))}
                </div>
            </div>
            {isScanningWorkers && <ScannerOverlay onScan={(text) => { handleWorkerAction(text); setIsScanningWorkers(false); }} onClose={() => setIsScanningWorkers(false)} />}
        </div>
    );
}

function DnevnikMasine({ modul, header, user }) {
    const [dnevnik, setDnevnik] = useState({ pocetak: '', kraj: '', zastoj: '', napomena: '' });
    const snimiDnevnik = async () => {
        if(!header.masina) return alert("Odaberite mašinu u zaglavlju.");
        await supabase.from('masine_dnevnik').insert([{ masina: header.masina, datum: header.datum, pocetak: dnevnik.pocetak, kraj: dnevnik.kraj, zastoj_min: dnevnik.zastoj || 0, napomena: dnevnik.napomena, modul: modul, korisnik: user.ime_prezime }]);
        alert("Dnevnik mašine snimljen!"); setDnevnik({ pocetak: '', kraj: '', zastoj: '', napomena: '' });
    };
    return (
        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-xl space-y-4 mt-6">
            <h3 className="text-[10px] text-slate-500 uppercase tracking-widest text-center">Dnevnik Rada Mašine</h3>
            <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-900 p-2 rounded-xl"><span className="text-[7px] text-slate-500 uppercase block mb-1">Početak</span><input type="time" value={dnevnik.pocetak} onChange={e=>setDnevnik({...dnevnik, pocetak: e.target.value})} className="w-full bg-transparent text-white text-xs outline-none" /></div>
                <div className="bg-slate-900 p-2 rounded-xl"><span className="text-[7px] text-slate-500 uppercase block mb-1">Kraj</span><input type="time" value={dnevnik.kraj} onChange={e=>setDnevnik({...dnevnik, kraj: e.target.value})} className="w-full bg-transparent text-white text-xs outline-none" /></div>
                <div className="bg-slate-900 p-2 rounded-xl"><span className="text-[7px] text-slate-500 uppercase block mb-1">Zastoj (m)</span><input type="number" value={dnevnik.zastoj} onChange={e=>setDnevnik({...dnevnik, zastoj: e.target.value})} className="w-full bg-transparent text-white text-xs outline-none text-center" placeholder="0" /></div>
            </div>
            <textarea value={dnevnik.napomena} onChange={e=>setDnevnik({...dnevnik, napomena: e.target.value})} placeholder="Napomena (kvar...)" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-blue-500" rows="2"></textarea>
            <button onClick={snimiDnevnik} className="w-full py-3 bg-slate-800 text-slate-300 font-black rounded-xl text-[10px] uppercase hover:bg-slate-700">Snimi dnevnik</button>
        </div>
    );
}

function DimBox({ label, val, set, disabled }) {
    return (<div className={`bg-slate-900 p-2 rounded-xl border border-slate-800 font-bold text-center ${disabled ? 'opacity-50' : ''}`}><span className="text-[7px] text-slate-500 uppercase block mb-1 font-black">{label}</span><input type="number" value={val} onChange={e => set(e.target.value)} disabled={disabled} className="w-full bg-transparent text-white font-black outline-none text-lg text-center" /></div>);
}

function ScannerOverlay({ onScan, onClose }) {
    useEffect(() => {
        const sc = new Html5QrcodeScanner("global-reader", { fps: 10, qrbox: 250 }, false);
        sc.render(onScan, () => {});
        return () => sc.clear();
    }, []);
    return (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-6 backdrop-blur-md animate-in fade-in duration-300">
            <div id="global-reader" className="w-full max-w-sm aspect-square bg-slate-900 rounded-[2.5rem] border-4 border-blue-500 overflow-hidden shadow-2xl"></div>
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

// ============================================================================
// 1. MODUL PRIJEM TRUPACA (NETAKNUT ZLATNI STANDARD)
// ============================================================================

function PrijemModule({ user, onExit }) {
    const [pHeader, setPHeader] = useState({
        sumarija: localStorage.getItem('pr_sumarija') || '',
        podruznica: localStorage.getItem('pr_podruznica') || '',
        prevoznik: localStorage.getItem('pr_prevoznik') || '',
        odjel: localStorage.getItem('pr_odjel') || '',
        otpremnica_broj: localStorage.getItem('pr_otpr_broj') || '',
        otpremnica_datum: localStorage.getItem('pr_otpr_datum') || new Date().toISOString().split('T')[0]
    });

    const [scan, setScan] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [form, setForm] = useState({ broj_plocice: '', redni_broj: '', vrsta: 'Jela', klasa: 'I', duzina: '', promjer: '' });
    const [listaPrijema, setListaPrijema] = useState([]);
    
    const scanTimerRef = useRef(null);

    const sumarijeList = ['ŠGD ZDK', 'ŠUME TK', 'BOSANSKA KRUPA', 'KUPRES'];
    const podruzniceMap = {
        'ŠGD ZDK': ['Olovo', 'Zavidovići', 'Žepče', 'Kakanj'],
        'ŠUME TK': ['Kladanj', 'Banovići', 'Živinice', 'Kalesija']
    };

    useEffect(() => { loadPrijemList(); }, [pHeader.otpremnica_broj]);

    const loadPrijemList = async () => {
        if(!pHeader.otpremnica_broj) return;
        const { data } = await supabase.from('trupci').select('*').eq('otpremnica_broj', pHeader.otpremnica_broj).eq('zakljucen_prijem', false).order('created_at', { ascending: false });
        setListaPrijema(data || []);
    };

    const updateHeader = (key, val) => {
        const updated = { ...pHeader, [key]: val };
        if(key === 'sumarija') updated.podruznica = ''; 
        setPHeader(updated);
        localStorage.setItem(`pr_${key}`, val);
    };

    const calculatedZapremina = useMemo(() => {
        if(!form.duzina || !form.promjer) return "0.00";
        const r = parseFloat(form.promjer) / 200; 
        return (r * r * Math.PI * parseFloat(form.duzina)).toFixed(2);
    }, [form]);

    const handleScanInput = (val) => {
        setScan(val);
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        if (val.length >= 3) {
            scanTimerRef.current = setTimeout(async () => {
                const id = val.toUpperCase();
                const { data: existing } = await supabase.from('trupci').select('id').eq('id', id).maybeSingle();
                if(existing) {
                    alert(`❌ TRUPAC SA QR KODOM ${id} VEĆ POSTOJI U BAZI!`);
                    setScan('');
                }
            }, 2000);
        }
    };

    const snimiTrupac = async () => {
        if(!pHeader.otpremnica_broj || !pHeader.sumarija) return alert("Popunite zaglavlje otpremnice (Šumarija i Broj)!");
        if(!scan || !form.duzina || !form.promjer) return alert("Popunite QR ID, dužinu i promjer.");
        
        const trupacID = scan.toUpperCase();
        const { data: existing } = await supabase.from('trupci').select('id').eq('id', trupacID).maybeSingle();
        if(existing) return alert("❌ Trupac sa ovim QR kodom već postoji!");

        await supabase.from('trupci').insert([{
            id: trupacID, broj_plocice: form.broj_plocice, redni_broj: form.redni_broj, vrsta: form.vrsta, klasa: form.klasa,
            duzina: form.duzina, promjer: form.promjer, zapremina: calculatedZapremina, sumarija: pHeader.sumarija,
            podruznica: pHeader.podruznica, prevoznik: pHeader.prevoznik, odjel: pHeader.odjel, otpremnica_broj: pHeader.otpremnica_broj,
            otpremnica_datum: pHeader.otpremnica_datum, snimio_korisnik: user.ime_prezime, datum_prijema: new Date().toISOString().split('T')[0], zakljucen_prijem: false
        }]);
        
        setScan(''); setForm({ broj_plocice: '', redni_broj: '', vrsta: 'Jela', klasa: 'I', duzina: '', promjer: '' });
        loadPrijemList();
    };

    const zakljuciOtpremnicu = async () => {
        if(listaPrijema.length === 0) return;
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
            <div className="flex justify-between items-center bg-[#1e293b] p-4 rounded-3xl border border-slate-700">
                <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase">← Meni</button>
                <h2 className="text-indigo-400 font-black tracking-widest uppercase text-xs">📥 PRIJEM OTPREMNICE</h2>
            </div>

            <div className="bg-[#1e293b] p-5 rounded-[2.5rem] border border-indigo-500/30 shadow-xl space-y-4">
                <span className="text-[10px] text-indigo-500 uppercase tracking-widest block text-center mb-2">ZAGLAVLJE OTPREMNICE</span>
                <div className="grid grid-cols-2 gap-2">
                    <SmartSearchableInput label="ŠUMARIJA" value={pHeader.sumarija} onChange={v => updateHeader('sumarija', v)} list={sumarijeList} storageKey="sumarije" />
                    <SmartSearchableInput label="PODRUŽNICA" value={pHeader.podruznica} onChange={v => updateHeader('podruznica', v)} list={podruzniceMap[pHeader.sumarija] || []} storageKey="podruznice" />
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

            {listaPrijema.length > 0 && (
                <div className="bg-[#1e293b] p-4 rounded-[2rem] border border-slate-700">
                    <div className="flex justify-between items-center mb-3 px-2">
                        <span className="text-[10px] text-slate-500 uppercase">Lista trupaca (Otpremnica: {pHeader.otpremnica_broj}):</span>
                        <span className="text-indigo-400 font-black">{listaPrijema.length} kom</span>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto mb-4 scrollbar-hide">
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
// 2. MODUL PROREZ (NETAKNUT ZLATNI STANDARD)
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
// 3. MODUL PILANA (SA RADNIM NALOGOM)
// ============================================================================

function PilanaModule({ user, header, setHeader, onExit }) {
    const [izlazScan, setIzlazScan] = useState('');
    const [radniNalog, setRadniNalog] = useState('');
    const [rnStavke, setRnStavke] = useState([]);
    
    const [activeIzlazIds, setActiveIzlazIds] = useState([]);
    const [selectedIzlazId, setSelectedIzlazId] = useState('');
    const [izlazPackageItems, setIzlazPackageItems] = useState([]);
    const [activeEditItem, setActiveEditItem] = useState(null);
    const [updateMode, setUpdateMode] = useState('dodaj');
    
    const [form, setForm] = useState({ naziv: '', debljina: '', sirina: '', duzina: '', kolicina_ulaz: '', jm: 'm3', rn_stavka_id: null, naruceno: 0, napravljeno: 0 });
    
    const [isScanning, setIsScanning] = useState(false);
    const [scanTarget, setScanTarget] = useState('');
    
    const rnTimer = useRef(null);
    const timerRef = useRef(null);

    // KADA SE UNESE RADNI NALOG (2s Debounce)
    const handleNalogInput = (val) => {
        setRadniNalog(val);
        if(rnTimer.current) clearTimeout(rnTimer.current);
        if(val.length >= 3) {
            rnTimer.current = setTimeout(async () => {
                const {data} = await supabase.from('radni_nalozi_stavke').select('*').eq('nalog_id', val.toUpperCase());
                if(data && data.length > 0) {
                    setRnStavke(data);
                } else {
                    alert(`Nalog ${val} nema stavki ili ne postoji!`);
                    setRnStavke([]);
                }
            }, 2000);
        } else {
            setRnStavke([]);
        }
    };

    const handleStavkaSelect = async (stavka) => {
        const {data: kat} = await supabase.from('katalog_proizvoda').select('*').eq('sifra', stavka.sifra_proizvoda).maybeSingle();
        setForm({ ...form, naziv: stavka.naziv_proizvoda, debljina: kat?.visina||'', sirina: kat?.sirina||'', duzina: kat?.duzina||'', jm: stavka.jm||'m3', rn_stavka_id: stavka.id, naruceno: stavka.naruceno, napravljeno: stavka.napravljeno });
    };

    // KADA SE UNESE QR PAKETA
    const handleIzlazInput = (val) => {
        setIzlazScan(val);
        if (timerRef.current) clearTimeout(timerRef.current);
        if (!val || val.length < 3) return;

        timerRef.current = setTimeout(async () => {
            if (!activeIzlazIds.includes(val)) {
                const { data: existing } = await supabase.from('paketi').select('*').eq('paket_id', val);
                if (existing && existing.length > 0) {
                    const spisak = existing.map(i => `- ${i.naziv_proizvoda} -> ${i.kolicina_final} m3`).join('\n');
                    if (!window.confirm(`⚠️ Paket ${val} već sadrži:\n${spisak}\n\nNastaviti rad?`)) { setIzlazScan(''); return; }
                }
                setActiveIzlazIds(p => [...p, val]);
            }
            setSelectedIzlazId(val);
            fetchIzlaz(val);
        }, 2000);
    };

    const fetchIzlaz = async (pid) => {
        const { data } = await supabase.from('paketi').select('*').eq('paket_id', pid);
        setIzlazPackageItems(data || []); setIzlazScan(pid);
    };

    const save = async () => {
        if (!selectedIzlazId || !form.kolicina_ulaz) return;
        const timeNow = new Date().toLocaleTimeString('de-DE');
        let qty = parseFloat(form.kolicina_ulaz);
        if(form.jm === 'kom') qty = (parseFloat(form.debljina)/100) * (parseFloat(form.sirina)/100) * parseFloat(form.duzina) * qty;

        if (activeEditItem) {
            const newM3 = updateMode === 'dodaj' ? parseFloat(activeEditItem.kolicina_final) + qty : parseFloat(activeEditItem.kolicina_final) - qty;
            await supabase.from('paketi').update({ kolicina_final: newM3.toFixed(3), vrijeme_tekst: timeNow, snimio_korisnik: user.ime_prezime }).eq('id', activeEditItem.id);
        } else {
            await supabase.from('paketi').insert([{ paket_id: selectedIzlazId, naziv_proizvoda: form.naziv, debljina: form.debljina, sirina: form.sirina, duzina: form.duzina, kolicina_ulaz: form.kolicina_ulaz, jm: form.jm, kolicina_final: qty.toFixed(3), mjesto: header.mjesto, masina: header.masina, snimio_korisnik: user.ime_prezime, vrijeme_tekst: timeNow, datum_yyyy_mm: header.datum }]);
            
            // AKO JE VEZANO ZA NALOG, AZURIRAJ NAPRAVLJENU KOLICINU
            if(form.rn_stavka_id) {
                const novoStanje = form.napravljeno + qty;
                await supabase.from('radni_nalozi_stavke').update({ napravljeno: novoStanje }).eq('id', form.rn_stavka_id);
                // Osvježi prikaz stavki naloga
                handleNalogInput(radniNalog);
            }
        }
        fetchIzlaz(selectedIzlazId); setForm({...form, kolicina_ulaz: ''}); setActiveEditItem(null);
    };

    return (
        <div className="p-4 max-w-xl mx-auto space-y-6">
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-emerald-500" user={user} />
            <h2 className="text-emerald-500 text-center font-black tracking-widest uppercase">🪵 PILANA - IZLAZ DASKE</h2>
            
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {activeIzlazIds.map(id => (
                    <button key={id} onClick={() => {setIzlazScan(id); handleIzlazInput(id)}} className={`px-4 py-2 rounded-xl border-2 whitespace-nowrap transition-all ${selectedIzlazId === id ? 'bg-emerald-600 border-white font-black' : 'bg-slate-800 border-slate-700'}`}>
                        {id} <span onClick={(e) => {e.stopPropagation(); if(window.confirm("ZAKLJUČITI?")) { supabase.from('paketi').update({closed_at: new Date().toISOString()}).eq('paket_id', id); setActiveIzlazIds(p=>p.filter(x=>x!==id)); if(selectedIzlazId===id){setSelectedIzlazId(''); setIzlazScan(''); setIzlazPackageItems([])} } }} className="ml-2 text-red-400 font-black">🏁</span>
                    </button>
                ))}
            </div>

            <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-emerald-500/30 shadow-2xl space-y-5">
                
                {/* RADNI NALOG POLJE */}
                <div className="relative font-black bg-blue-900/20 p-4 rounded-2xl border border-blue-500/30">
                    <label className="text-[8px] text-blue-400 uppercase ml-2 block mb-1">RADNI NALOG (Skeniraj ili Upiši)</label>
                    <input type="text" value={radniNalog} onChange={e => handleNalogInput(e.target.value)} placeholder="RN-..." className="w-full p-4 bg-slate-900 rounded-xl text-center text-white outline-none focus:border-blue-500 uppercase" />
                    <button onClick={() => {setScanTarget('nalog'); setIsScanning(true);}} className="absolute right-6 top-9 px-3 bg-blue-600 rounded-lg text-white text-xs py-2 font-bold hover:opacity-80">📷</button>
                    
                    {rnStavke.length > 0 && (
                        <div className="mt-3 space-y-2 border-t border-blue-500/30 pt-3">
                            <span className="text-[9px] text-blue-300 uppercase">Stavke na nalogu:</span>
                            {rnStavke.map(s => (
                                <div key={s.id} onClick={() => handleStavkaSelect(s)} className="flex justify-between items-center p-3 bg-slate-800 rounded-xl cursor-pointer hover:bg-blue-600">
                                    <span className="text-[10px] text-white font-bold">{s.naziv_proizvoda}</span>
                                    <span className="text-[9px] text-slate-300">Nar: {s.naruceno} | Ur: {s.napravljeno}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="relative font-black">
                    <label className="text-[8px] text-emerald-500 uppercase ml-4 block mb-1">QR IZLAZNOG PAKETA</label>
                    <input type="text" value={izlazScan} onChange={e => handleIzlazInput(e.target.value)} placeholder="..." className="w-full p-5 bg-[#0f172a] border-2 border-slate-700 rounded-2xl text-center text-xl text-white outline-none focus:border-emerald-500 uppercase font-black" />
                    <button onClick={() => {setScanTarget('paket'); setIsScanning(true);}} className="absolute right-3 top-7 bottom-3 px-4 bg-emerald-600 rounded-xl text-white font-bold hover:opacity-80">📷 SCAN</button>
                </div>
                
                {selectedIzlazId && (
                    <div className="animate-in zoom-in-50 space-y-4">
                        {activeEditItem && (
                            <div className="p-4 bg-slate-950/50 rounded-2xl border border-blue-500/50">
                                <div className="flex justify-between items-center"><span className="text-[10px] text-blue-300 uppercase font-black">Ažuriranje: {activeEditItem.naziv_proizvoda}</span><button onClick={()=>setActiveEditItem(null)} className="text-red-500 text-xs font-black">PONIŠTI ×</button></div>
                                <div className="flex bg-slate-900 p-1 rounded-xl mt-3"><button onClick={() => setUpdateMode('dodaj')} className={`flex-1 py-2 rounded-lg text-[10px] uppercase font-black ${updateMode==='dodaj'?'bg-green-600 text-white shadow-lg':'text-slate-500'}`}>+ Dodaj</button><button onClick={() => setUpdateMode('oduzmi')} className={`flex-1 py-2 rounded-lg text-[10px] uppercase font-black ${updateMode==='oduzmi'?'bg-red-600 text-white shadow-lg':'text-slate-500'}`}>- Oduzmi</button></div>
                            </div>
                        )}
                        
                        <SearchableInput label="Proizvod" value={form.naziv} onChange={v => setForm({...form, naziv: v})} list={[]} />
                        
                        {form.rn_stavka_id && (
                            <div className="flex justify-between bg-blue-900/30 p-3 rounded-xl border border-blue-500/30">
                                <div className="text-[10px] text-blue-300 uppercase">Naručeno: <b className="text-white text-xs">{form.naruceno}</b></div>
                                <div className="text-[10px] text-emerald-400 uppercase">Dosad urađeno: <b className="text-white text-xs">{form.napravljeno}</b></div>
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-2">
                            <DimBox label="Deb" val={form.debljina} set={v => setForm({...form, debljina: v})} disabled={!!activeEditItem} />
                            <DimBox label="Šir" val={form.sirina} set={v => setForm({...form, sirina: v})} disabled={!!activeEditItem} />
                            <DimBox label="Duž" val={form.duzina} set={v => setForm({...form, duzina: v})} disabled={!!activeEditItem} />
                        </div>
                        <div className="flex gap-2">
                            <input type="number" value={form.kolicina_ulaz} onChange={e => setForm({...form, kolicina_ulaz: e.target.value})} className="flex-1 p-4 bg-[#0f172a] border-2 border-slate-700 rounded-2xl text-2xl text-center text-white font-black" placeholder="Količina..." />
                            <select value={form.jm} onChange={e => setForm({...form, jm: e.target.value})} className="bg-slate-800 px-4 rounded-xl text-white font-black"><option value="kom">kom</option><option value="m3">m³</option></select>
                        </div>
                        <button onClick={save} className="w-full py-6 bg-emerald-600 text-white font-black rounded-2xl uppercase shadow-xl hover:opacity-90">{activeEditItem ? `✅ AŽURIRAJ` : `✅ SNIMI STAVKU`}</button>
                        
                        <div className="pt-4 space-y-2 max-h-52 overflow-y-auto border-t border-slate-700">
                            {izlazPackageItems.map(item => (
                                <div key={item.id} onClick={() => { setActiveEditItem(item); setForm({...item, kolicina_ulaz: '' }); }} className="flex justify-between items-center p-4 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-emerald-500">
                                    <div><div className="text-[10px] uppercase text-white font-bold">{item.naziv_proizvoda}</div><div className="text-emerald-500 text-lg font-black tracking-tighter">{item.debljina}x{item.sirina}x{item.duzina}</div></div>
                                    <div className="text-right font-black"><div className="text-xl text-white">{item.kolicina_final} m³</div><div className="text-[9px] text-slate-500">{item.kolicina_ulaz} {item.jm}</div></div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <DnevnikMasine modul="Pilana" header={header} user={user} />
            {isScanning && <ScannerOverlay onScan={(text) => { if(scanTarget==='nalog') handleNalogInput(text); else handleIzlazInput(text); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}

// ============================================================================
// 4. MODUL DORADA (Ulaz i Izlaz sa RADNIM NALOGOM)
// ============================================================================

function DoradaModule({ user, header, setHeader, onExit }) {
    const [tab, setTab] = useState('ulaz');
    const [isScanning, setIsScanning] = useState(false);
    const [scanTarget, setScanTarget] = useState(''); // 'ulaz', 'izlaz', ili 'nalog'

    const [ulazScan, setUlazScan] = useState('');
    const [activeUlazIds, setActiveUlazIds] = useState([]);
    const [selectedUlazId, setSelectedUlazId] = useState('');
    const [ulazItems, setUlazItems] = useState([]);
    const [activeUlazItem, setActiveUlazItem] = useState(null);
    const [calcMode, setCalcMode] = useState('preostalo'); 
    const [inputQty, setInputQty] = useState('');

    const [izlazScan, setIzlazScan] = useState('');
    const [radniNalog, setRadniNalog] = useState('');
    const [rnStavke, setRnStavke] = useState([]);
    const [activeIzlazIds, setActiveIzlazIds] = useState([]);
    const [selectedIzlazId, setSelectedIzlazId] = useState('');
    const [izlazPackageItems, setIzlazPackageItems] = useState([]);
    const [activeEditItem, setActiveEditItem] = useState(null);
    const [updateMode, setUpdateMode] = useState('dodaj');
    const [form, setForm] = useState({ naziv: '', debljina: '', sirina: '', duzina: '', kolicina_ulaz: '', jm: 'm3', rn_stavka_id: null, naruceno: 0, napravljeno: 0 });

    const ulazTimerRef = useRef(null);
    const izlazTimerRef = useRef(null);
    const rnTimer = useRef(null);

    // ULAZ LOGIKA
    const handleUlazInput = (val) => {
        setUlazScan(val);
        if (ulazTimerRef.current) clearTimeout(ulazTimerRef.current);
        if (!val || val.length < 3) return;

        ulazTimerRef.current = setTimeout(async () => {
            const { data } = await supabase.from('paketi').select('*').eq('paket_id', val).gt('kolicina_final', 0);
            if(!activeUlazIds.includes(val)) setActiveUlazIds(p => [...p, val]);
            setSelectedUlazId(val); setUlazItems(data || []); setActiveUlazItem(null);
        }, 2000);
    };

    const handleUpdateUlaz = async () => {
        if (!activeUlazItem || !inputQty) return;
        let unesenoM3 = parseFloat(inputQty);
        let novoStanje = calcMode === 'preostalo' ? unesenoM3 : parseFloat(activeUlazItem.kolicina_final) - unesenoM3;
        await supabase.from('paketi').update({ kolicina_final: novoStanje.toFixed(3) }).eq('id', activeUlazItem.id);
        alert("✅ AŽURIRANO!"); handleUlazInput(selectedUlazId);
    };

    // IZLAZ LOGIKA (RADNI NALOG)
    const handleNalogInput = (val) => {
        setRadniNalog(val);
        if(rnTimer.current) clearTimeout(rnTimer.current);
        if(val.length >= 3) {
            rnTimer.current = setTimeout(async () => {
                const {data} = await supabase.from('radni_nalozi_stavke').select('*').eq('nalog_id', val.toUpperCase());
                if(data && data.length > 0) {
                    setRnStavke(data);
                } else {
                    alert(`Nalog ${val} nema stavki ili ne postoji!`);
                    setRnStavke([]);
                }
            }, 2000);
        } else {
            setRnStavke([]);
        }
    };

    const handleStavkaSelect = async (stavka) => {
        const {data: kat} = await supabase.from('katalog_proizvoda').select('*').eq('sifra', stavka.sifra_proizvoda).maybeSingle();
        setForm({ ...form, naziv: stavka.naziv_proizvoda, debljina: kat?.visina||'', sirina: kat?.sirina||'', duzina: kat?.duzina||'', jm: stavka.jm||'m3', rn_stavka_id: stavka.id, naruceno: stavka.naruceno, napravljeno: stavka.napravljeno });
    };

    const handleIzlazInput = (val) => {
        setIzlazScan(val);
        if (izlazTimerRef.current) clearTimeout(izlazTimerRef.current);
        if (!val || val.length < 3) return;

        izlazTimerRef.current = setTimeout(async () => {
            if (!activeIzlazIds.includes(val)) {
                const { data: existing } = await supabase.from('paketi').select('*').eq('paket_id', val);
                if (existing && existing.length > 0) {
                    const spisak = existing.map(i => `- ${i.naziv_proizvoda} -> ${i.kolicina_final} m3`).join('\n');
                    if (!window.confirm(`⚠️ Paket ${val} već sadrži:\n${spisak}\n\nNastaviti rad?`)) { setIzlazScan(''); return; }
                }
                setActiveIzlazIds(p => [...p, val]);
            }
            setSelectedIzlazId(val); fetchIzlaz(val);
        }, 2000);
    };

    const fetchIzlaz = async (pid) => {
        const { data } = await supabase.from('paketi').select('*').eq('paket_id', pid);
        setIzlazPackageItems(data || []); setIzlazScan(pid);
    };

    const saveIzlaz = async () => {
        if (!selectedIzlazId || !form.kolicina_ulaz) return;
        const timeNow = new Date().toLocaleTimeString('de-DE');
        let qty = parseFloat(form.kolicina_ulaz);
        if(form.jm === 'kom') qty = (parseFloat(form.debljina)/100) * (parseFloat(form.sirina)/100) * parseFloat(form.duzina) * qty;

        if (activeEditItem) {
            const newM3 = updateMode === 'dodaj' ? parseFloat(activeEditItem.kolicina_final) + qty : parseFloat(activeEditItem.kolicina_final) - qty;
            await supabase.from('paketi').update({ kolicina_final: newM3.toFixed(3), vrijeme_tekst: timeNow, snimio_korisnik: user.ime_prezime }).eq('id', activeEditItem.id);
        } else {
            await supabase.from('paketi').insert([{
                paket_id: selectedIzlazId, naziv_proizvoda: form.naziv, debljina: form.debljina, sirina: form.sirina, duzina: form.duzina, kolicina_ulaz: form.kolicina_ulaz,
                jm: form.jm, kolicina_final: qty.toFixed(3), mjesto: header.mjesto, masina: header.masina, snimio_korisnik: user.ime_prezime, vrijeme_tekst: timeNow, ai_sirovina_ids: activeUlazIds
            }]);
            
            if(form.rn_stavka_id) {
                const novoStanje = form.napravljeno + qty;
                await supabase.from('radni_nalozi_stavke').update({ napravljeno: novoStanje }).eq('id', form.rn_stavka_id);
                handleNalogInput(radniNalog);
            }
        }
        fetchIzlaz(selectedIzlazId); setForm({...form, kolicina_ulaz: ''}); setActiveEditItem(null);
    };

    return (
        <div className="p-4 max-w-xl mx-auto space-y-6 font-bold">
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-amber-500" user={user} />
            <div className="flex bg-[#1e293b] p-1 rounded-2xl border border-slate-700">
                <button onClick={() => setTab('ulaz')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'ulaz' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500'}`}>1. ULAZ (Sirovina)</button>
                <button onClick={() => setTab('izlaz')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'izlaz' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500'}`}>2. IZLAZ (Roba)</button>
            </div>

            {tab === 'ulaz' ? (
                <div className="space-y-4 animate-in slide-in-from-left">
                   <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {activeUlazIds.map(id => (
                            <button key={id} onClick={() => {setUlazScan(id); handleUlazInput(id);}} className={`px-4 py-2 rounded-xl border-2 whitespace-nowrap transition-all ${selectedUlazId === id ? 'bg-amber-600 border-white' : 'bg-slate-800 border-slate-700'}`}>{id}</button>
                        ))}
                   </div>
                   <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border-2 border-amber-500/30 shadow-2xl space-y-5">
                        <div className="relative font-black">
                            <label className="text-[8px] text-amber-500 uppercase ml-4 block mb-1">QR SIROVINE</label>
                            <input type="text" value={ulazScan} onChange={e => handleUlazInput(e.target.value)} placeholder="..." className="w-full p-5 bg-[#0f172a] border-2 border-slate-700 rounded-2xl text-center text-xl text-white outline-none focus:border-amber-500" />
                            <button onClick={() => {setScanTarget('ulaz'); setIsScanning(true);}} className="absolute right-3 top-7 bottom-3 px-4 bg-amber-600 rounded-xl text-white font-bold hover:opacity-80">📷 SCAN</button>
                        </div>
                        {selectedUlazId && !activeUlazItem && (
                            <div className="space-y-3">
                                {ulazItems.map(item => (
                                    <div key={item.id} onClick={() => setActiveUlazItem(item)} className="p-5 bg-slate-800 border border-slate-700 rounded-3xl flex justify-between items-center cursor-pointer hover:border-amber-500">
                                        <div><div className="text-white uppercase text-sm font-black">{item.naziv_proizvoda}</div><div className="text-2xl text-amber-400 font-black tracking-tighter">{item.debljina}x{item.sirina}x{item.duzina}</div></div>
                                        <div className="text-2xl font-black text-white">{item.kolicina_final} m³</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {activeUlazItem && (
                            <div className="animate-in zoom-in space-y-4">
                                <div className="text-center bg-slate-900 p-6 rounded-3xl border border-slate-700">
                                    <div className="text-xl text-slate-400 uppercase">{activeUlazItem.naziv_proizvoda}</div>
                                    <div className="text-3xl text-amber-500 font-black mt-1">{activeUlazItem.debljina}x{activeUlazItem.sirina}x{activeUlazItem.duzina}</div>
                                </div>
                                <div className="flex bg-slate-950 p-1 rounded-xl">
                                    <button onClick={() => setCalcMode('preostalo')} className={`flex-1 py-3 rounded-lg text-[10px] uppercase ${calcMode === 'preostalo' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Ostalo</button>
                                    <button onClick={() => setCalcMode('potroseno')} className={`flex-1 py-3 rounded-lg text-[10px] uppercase ${calcMode === 'potroseno' ? 'bg-red-600 text-white' : 'text-slate-500'}`}>Potrošeno</button>
                                </div>
                                <input type="number" value={inputQty} onChange={e => setInputQty(e.target.value)} className="w-full p-5 bg-[#0f172a] border-2 border-slate-700 rounded-2xl text-4xl text-white text-center" placeholder="0.00" />
                                <button onClick={handleUpdateUlaz} className="w-full py-6 bg-amber-600 text-white font-black rounded-2xl uppercase shadow-xl font-bold">✅ SNIMI STANJE</button>
                                <button onClick={() => setActiveUlazItem(null)} className="w-full text-slate-500 text-[10px] uppercase">← Nazad</button>
                            </div>
                        )}
                   </div>
                </div>
            ) : (
                <div className="space-y-4 animate-in slide-in-from-right">
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {activeIzlazIds.map(id => (
                            <button key={id} onClick={() => {setIzlazScan(id); handleIzlazInput(id);}} className={`px-4 py-2 rounded-xl border-2 whitespace-nowrap transition-all ${selectedIzlazId === id ? 'bg-amber-600 border-white font-black' : 'bg-slate-800 border-slate-700'}`}>
                                {id} <span onClick={(e) => {e.stopPropagation(); if(window.confirm("Zaključiti paket?")) { supabase.from('paketi').update({closed_at: new Date().toISOString()}).eq('paket_id', id); setActiveIzlazIds(p=>p.filter(x=>x!==id)); if(selectedIzlazId===id){setSelectedIzlazId(''); setIzlazScan(''); setIzlazPackageItems([])} } }} className="ml-2 text-red-400 font-black">🏁</span>
                            </button>
                        ))}
                    </div>
                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border-2 border-amber-500/30 shadow-2xl space-y-5">
                        
                        <div className="relative font-black bg-blue-900/20 p-4 rounded-2xl border border-blue-500/30">
                            <label className="text-[8px] text-blue-400 uppercase ml-2 block mb-1">RADNI NALOG (Skeniraj ili Upiši)</label>
                            <input type="text" value={radniNalog} onChange={e => handleNalogInput(e.target.value)} placeholder="RN-..." className="w-full p-4 bg-slate-900 rounded-xl text-center text-white outline-none focus:border-blue-500 uppercase" />
                            <button onClick={() => {setScanTarget('nalog'); setIsScanning(true);}} className="absolute right-6 top-9 px-3 bg-blue-600 rounded-lg text-white text-xs py-2 font-bold hover:opacity-80">📷</button>
                            
                            {rnStavke.length > 0 && (
                                <div className="mt-3 space-y-2 border-t border-blue-500/30 pt-3">
                                    <span className="text-[9px] text-blue-300 uppercase">Stavke na nalogu:</span>
                                    {rnStavke.map(s => (
                                        <div key={s.id} onClick={() => handleStavkaSelect(s)} className="flex justify-between items-center p-3 bg-slate-800 rounded-xl cursor-pointer hover:bg-blue-600">
                                            <span className="text-[10px] text-white font-bold">{s.naziv_proizvoda}</span>
                                            <span className="text-[9px] text-slate-300">Nar: {s.naruceno} | Ur: {s.napravljeno}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="relative font-black">
                            <label className="text-[8px] text-amber-500 uppercase ml-4 block mb-1">QR IZLAZNOG PAKETA</label>
                            <input type="text" value={izlazScan} onChange={e => handleIzlazInput(e.target.value)} placeholder="..." className="w-full p-5 bg-[#0f172a] border-2 border-slate-700 rounded-2xl text-center text-xl text-white outline-none focus:border-amber-500 uppercase font-black" />
                            <button onClick={() => {setScanTarget('izlaz'); setIsScanning(true);}} className="absolute right-3 top-7 bottom-3 px-4 bg-amber-600 rounded-xl text-white font-bold hover:opacity-80">📷 SCAN</button>
                        </div>
                        
                        {selectedIzlazId && (
                            <div className="animate-in zoom-in-50 space-y-4">
                                {activeEditItem && (
                                    <div className="p-4 bg-slate-950/50 rounded-2xl border border-blue-500/50">
                                        <div className="flex justify-between items-center"><span className="text-[10px] text-blue-300 uppercase font-black">Ažuriranje: {activeEditItem.naziv_proizvoda}</span><button onClick={()=>setActiveEditItem(null)} className="text-red-500 text-xs font-black">PONIŠTI ×</button></div>
                                        <div className="flex bg-slate-900 p-1 rounded-xl mt-3"><button onClick={() => setUpdateMode('dodaj')} className={`flex-1 py-2 rounded-lg text-[10px] uppercase font-black ${updateMode==='dodaj'?'bg-green-600 text-white':'text-slate-500'}`}>+ Dodaj</button><button onClick={() => setUpdateMode('oduzmi')} className={`flex-1 py-2 rounded-lg text-[10px] uppercase font-black ${updateMode==='oduzmi'?'bg-red-600 text-white':'text-slate-500'}`}>- Oduzmi</button></div>
                                    </div>
                                )}
                                
                                <SearchableInput label="Proizvod" value={form.naziv} onChange={v => setForm({...form, naziv: v})} list={[]} />
                                
                                {form.rn_stavka_id && (
                                    <div className="flex justify-between bg-blue-900/30 p-3 rounded-xl border border-blue-500/30">
                                        <div className="text-[10px] text-blue-300 uppercase">Naručeno: <b className="text-white text-xs">{form.naruceno}</b></div>
                                        <div className="text-[10px] text-amber-400 uppercase">Dosad urađeno: <b className="text-white text-xs">{form.napravljeno}</b></div>
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-2">
                                    <DimBox label="Deb" val={form.debljina} set={v => setForm({...form, debljina: v})} disabled={!!activeEditItem} />
                                    <DimBox label="Šir" val={form.sirina} set={v => setForm({...form, sirina: v})} disabled={!!activeEditItem} />
                                    <DimBox label="Duž" val={form.duzina} set={v => setForm({...form, duzina: v})} disabled={!!activeEditItem} />
                                </div>
                                <div className="flex gap-2">
                                    <input type="number" value={form.kolicina_ulaz} onChange={e => setForm({...form, kolicina_ulaz: e.target.value})} className="flex-1 p-4 bg-[#0f172a] border-2 border-slate-700 rounded-2xl text-2xl text-center text-white font-black" placeholder="Količina..." />
                                    <select value={form.jm} onChange={e => setForm({...form, jm: e.target.value})} className="bg-slate-800 px-4 rounded-xl text-white font-black"><option value="kom">kom</option><option value="m3">m³</option></select>
                                </div>
                                <button onClick={saveIzlaz} className="w-full py-6 bg-amber-600 text-white font-black rounded-2xl uppercase shadow-xl hover:opacity-90">{activeEditItem ? `✅ AŽURIRAJ` : `✅ SNIMI STAVKU`}</button>
                                
                                <div className="pt-4 space-y-2 max-h-52 overflow-y-auto border-t border-slate-700">
                                    {izlazPackageItems.map(item => (
                                        <div key={item.id} onClick={() => { setActiveEditItem(item); setForm({...item, kolicina_ulaz: '' }); }} className="flex justify-between items-center p-4 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-amber-500">
                                            <div><div className="text-[10px] uppercase text-white font-bold">{item.naziv_proizvoda}</div><div className="text-amber-500 text-lg font-black tracking-tighter">{item.debljina}x{item.sirina}x{item.duzina}</div></div>
                                            <div className="text-right font-black"><div className="text-xl text-white">{item.kolicina_final} m³</div><div className="text-[9px] text-slate-500">{item.kolicina_ulaz} {item.jm}</div></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <DnevnikMasine modul="Dorada" header={header} user={user} />
            {isScanning && <ScannerOverlay onScan={(text) => { if(scanTarget==='nalog') handleNalogInput(text); else if(scanTarget==='ulaz') handleUlazInput(text); else handleIzlazInput(text); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}

// ============================================================================
// MODUL: PODEŠAVANJA (Katalog Excel Uvoz + Kupci)
// ============================================================================
function SettingsModule({ onExit }) {
    const [tab, setTab] = useState('katalog');
    
    // Kupci State
    const [kupacForm, setKupacForm] = useState({ naziv: '', pdv: '', adresa: '', rabatKategorija: '', rabatProizvod: '' });
    const dodajKupca = async () => {
        if(!kupacForm.naziv) return alert("Naziv obavezan");
        const rabati = { kategorije: {}, proizvodi: {} };
        if(kupacForm.rabatKategorija) { const [k, v] = kupacForm.rabatKategorija.split(':'); if(k&&v) rabati.kategorije[k.trim()] = parseFloat(v); }
        if(kupacForm.rabatProizvod) { const [k, v] = kupacForm.rabatProizvod.split(':'); if(k&&v) rabati.proizvi[k.trim()] = parseFloat(v); }
        
        await supabase.from('kupci').insert([{ naziv: kupacForm.naziv, pdv_broj: kupacForm.pdv, adresa: kupacForm.adresa, rabati_jsonb: rabati }]);
        alert("Kupac dodan!"); setKupacForm({ naziv: '', pdv: '', adresa: '', rabatKategorija: '', rabatProizvod: '' });
    };

    // Katalog State
    const handleCSVUpload = (e) => {
        const file = e.target.files[0];
        if(!file) return;
        Papa.parse(file, {
            header: true, skipEmptyLines: true,
            complete: async (results) => {
                const podaci = results.data.map(r => ({
                    sifra: r.sifra, naziv: r.naziv, dimenzije: r.dimenzije, kategorija: r.kategorija, default_jedinica: r.default_jedinicaMjere || r.default_jedinica,
                    cijena: parseFloat(r.cijena)||0, m3: parseFloat(r.m3)||0, m2: parseFloat(r.m2)||0, m1: parseFloat(r.m1)||0, duzina: parseFloat(r.duzina)||0, sirina: parseFloat(r.sirina)||0, visina: parseFloat(r.visina)||0
                })).filter(r => r.sifra && r.naziv);
                
                if(podaci.length > 0) {
                    const { error } = await supabase.from('katalog_proizvoda').upsert(podaci);
                    if(error) alert("Greška: " + error.message); else alert(`Uspješno uvezeno ${podaci.length} proizvoda!`);
                }
            }
        });
    };

    return (
        <div className="p-4 max-w-xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-[#1e293b] p-4 rounded-3xl border border-slate-700">
                <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase">← Meni</button>
                <h2 className="text-slate-400 font-black tracking-widest uppercase text-xs">⚙️ PODEŠAVANJA</h2>
            </div>

            <div className="flex bg-[#1e293b] p-1 rounded-2xl border border-slate-700">
                <button onClick={() => setTab('katalog')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'katalog' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>Katalog</button>
                <button onClick={() => setTab('kupci')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'kupci' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>Kupci</button>
            </div>

            {tab === 'katalog' && (
                <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-4">
                    <h3 className="text-blue-500 font-black uppercase text-xs">Uvoz iz CSV fajla (Excel)</h3>
                    <p className="text-[10px] text-slate-400">Snimi Excel kao .csv. Kolone moraju biti: sifra, naziv, dimenzije, kategorija, default_jedinicaMjere, cijena, m3, m2, m1, duzina, sirina, visina.</p>
                    <input type="file" accept=".csv" onChange={handleCSVUpload} className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-blue-600 file:text-white hover:file:bg-blue-500" />
                </div>
            )}

            {tab === 'kupci' && (
                <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-4">
                    <h3 className="text-blue-500 font-black uppercase text-xs">Novi Kupac</h3>
                    <input placeholder="Naziv Kupca" value={kupacForm.naziv} onChange={e=>setKupacForm({...kupacForm, naziv:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none" />
                    <div className="grid grid-cols-2 gap-2">
                        <input placeholder="PDV Broj" value={kupacForm.pdv} onChange={e=>setKupacForm({...kupacForm, pdv:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none" />
                        <input placeholder="Adresa" value={kupacForm.adresa} onChange={e=>setKupacForm({...kupacForm, adresa:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none" />
                    </div>
                    <div className="space-y-2 p-3 bg-slate-900 rounded-xl">
                        <span className="text-[10px] text-slate-500 uppercase">Rabati (Format -> Ime:Procenat)</span>
                        <input placeholder="Po Kat. (npr. Daska:10)" value={kupacForm.rabatKategorija} onChange={e=>setKupacForm({...kupacForm, rabatKategorija:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none" />
                        <input placeholder="Po Proizvodu (npr. SIFRA123:15)" value={kupacForm.rabatProizvod} onChange={e=>setKupacForm({...kupacForm, rabatProizvod:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none" />
                    </div>
                    <button onClick={dodajKupca} className="w-full py-4 bg-blue-600 text-white font-black rounded-xl uppercase text-xs">Snimi Kupca</button>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// MODUL: PONUDE I RADNI NALOZI (Jednostavan prototip da ne ruši Dashboard)
// ============================================================================
function PonudeModule({ onExit }) {
    return (
        <div className="p-4 max-w-xl mx-auto space-y-6 text-center">
            <div className="flex justify-between items-center bg-[#1e293b] p-4 rounded-3xl border border-pink-500/30">
                <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase">← Meni</button>
                <h2 className="text-pink-400 font-black tracking-widest uppercase text-xs">📝 PONUDE</h2>
            </div>
            <div className="bg-[#1e293b] p-10 rounded-[2.5rem] border border-pink-500/30">
                <span className="text-5xl block mb-4">🚧</span>
                <p className="text-slate-400 text-xs">Modul Ponuda se naslanja na Kupce. Pripremljena baza, spreman za finalno poliranje u narednoj fazi.</p>
            </div>
        </div>
    );
}

function RadniNaloziModule({ onExit }) {
    const [idNaloga, setIdNaloga] = useState('');
    const kreirajNalog = async () => {
        if(!idNaloga) return;
        await supabase.from('radni_nalozi').insert([{ id: idNaloga.toUpperCase(), kupac_naziv: 'Gost', datum: new Date().toISOString().split('T')[0] }]);
        alert("Nalog kreiran! (Ovo je brzi test. Pun modul RN se veže za Ponude).");
    };
    return (
        <div className="p-4 max-w-xl mx-auto space-y-6 text-center">
            <div className="flex justify-between items-center bg-[#1e293b] p-4 rounded-3xl border border-purple-500/30">
                <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase">← Meni</button>
                <h2 className="text-purple-400 font-black tracking-widest uppercase text-xs">📋 RADNI NALOZI</h2>
            </div>
            <div className="bg-[#1e293b] p-10 rounded-[2.5rem] border border-purple-500/30 space-y-4">
                <p className="text-slate-400 text-xs">Brzo kreiranje naloga za test Pilane:</p>
                <input placeholder="ID NALOGA (npr. RN-001)" value={idNaloga} onChange={e=>setIdNaloga(e.target.value)} className="w-full p-4 bg-slate-900 rounded-xl text-white text-center uppercase font-black" />
                <button onClick={kreirajNalog} className="w-full py-4 bg-purple-600 text-white font-black rounded-xl">KREIRAJ NALOG</button>
            </div>
        </div>
    );
}