"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { Card, Text, Metric, List, ListItem, Flex, Badge, Button, Grid, Divider } from '@tremor/react';
import { Zap, Target, Clock, ArrowRight, FileText, ChevronLeft, ChevronRight, Activity, Search, Bot, UserCircle } from 'lucide-react';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 🌟 GLOBALNE POSTAVKE APLIKACIJE (Ovdje mijenjaš sve za prijatelja u budućnosti)
const POSTAVKE = {
    imeAplikacije: "TTM DOO ERP",
    imeFirme: "TTM d.o.o.",
    bojaFirme: "#3b82f6" 
};

export default function Page() {
    const [loggedUser, setLoggedUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [activeModule, setActiveModule] = useState('dashboard');
    
    const [header, setHeader] = useState({
      mjesto: typeof window !== 'undefined' ? localStorage.getItem('last_loc') || '' : '',
      datum: new Date().toISOString().split('T')[0],
      masina: typeof window !== 'undefined' ? localStorage.getItem('last_masina') || '' : ''
    });
  
    // 🎨 State za Glavni Logo na Login ekranu i Dashboardu
    const [glavniLogo, setGlavniLogo] = useState('');

    useEffect(() => {
        const initApp = async () => {
            const user = localStorage.getItem('smart_timber_user');
            if (user) { try { setLoggedUser(JSON.parse(user)); } catch (e) { localStorage.removeItem('smart_timber_user'); } }
            
            // 🎨 UČITAVANJE BRENDINGA SA SERVERA I PWA GENERATOR
            try {
                const { data: brendingData } = await supabase.from('brending').select('*');
                if (brendingData) {
                    localStorage.setItem('erp_brending', JSON.stringify(brendingData));
                    
                    // 1. Postavljanje logotipa na vrh menija i login
                    const gl = brendingData.find(b => (b.lokacije_jsonb || []).includes('Glavni Meni (Dashboard Vrh)'));
                    if (gl) setGlavniLogo(gl.url_slike);

                    // 2. Postavljanje ikonica i "PWA Standalone" moda za mobitele
                    const fav = brendingData.find(b => (b.lokacije_jsonb || []).includes('Ikona u pregledniku (Favicon)'));
                    if (fav && fav.url_slike) {
                        // A) Favicon za obični kompjuterski browser
                        let link = document.querySelector("link[rel~='icon']");
                        if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
                        link.href = fav.url_slike;

                        // B) Apple Touch Icon (Za iPhone)
                        let appleIcon = document.querySelector("link[rel='apple-touch-icon']");
                        if (!appleIcon) { appleIcon = document.createElement('link'); appleIcon.rel = 'apple-touch-icon'; document.head.appendChild(appleIcon); }
                        appleIcon.href = fav.url_slike;

                        // C) Naredba mobitelu da sakrije URL traku (Standalone app)
                        let metaStandalone = document.querySelector("meta[name='apple-mobile-web-app-capable']");
                        if (!metaStandalone) {
                            metaStandalone = document.createElement('meta'); metaStandalone.name = 'apple-mobile-web-app-capable'; metaStandalone.content = 'yes'; document.head.appendChild(metaStandalone);
                            let metaAndroid = document.createElement('meta'); metaAndroid.name = 'mobile-web-app-capable'; metaAndroid.content = 'yes'; document.head.appendChild(metaAndroid);
                        }

                        // D) Dinamički Manifest fajl za Android (Instalacija aplikacije)
                        const manifest = {
                            name: POSTAVKE.imeAplikacije,
                            short_name: "ERP",
                            start_url: "/",
                            display: "standalone",
                            background_color: "#0f172a",
                            theme_color: POSTAVKE.bojaFirme,
                            icons: [{ src: fav.url_slike, sizes: "512x512", type: "image/png", purpose: "any maskable" }]
                        };
                        const manifestBlob = new Blob([JSON.stringify(manifest)], {type: 'application/json'});
                        const manifestUrl = URL.createObjectURL(manifestBlob);
                        
                        let manifestLink = document.querySelector("link[rel='manifest']");
                        if (!manifestLink) { manifestLink = document.createElement('link'); manifestLink.rel = 'manifest'; document.head.appendChild(manifestLink); }
                        manifestLink.href = manifestUrl;
                    }
                }
            } catch(e) { console.log("Greška PWA init", e) }

            setAuthLoading(false);
        };
        initApp();
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
              
              <div className="text-center mb-8 flex flex-col items-center justify-center gap-2">
                  {glavniLogo ? (
                      <img src={glavniLogo} alt="Logo" className="max-h-24 object-contain mb-2" />
                  ) : (
                      <h1 className="text-4xl font-black text-white tracking-tighter">Smart<span className="text-blue-500">Timber</span></h1>
                  )}
              </div>
  
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
                  {/* KONTROLA DOZVOLA FUNKCIJA */}
                  {(() => {
                      const hasDozvola = (modul) => loggedUser?.uloga === 'admin' || (loggedUser?.dozvole && loggedUser.dozvole.includes(modul));
                      return (
                          <>
                              {/* GORNJI BLOK DUGMADI */}
                              <div className="grid grid-cols-2 gap-4 w-full">
                                  {hasDozvola('Prijem trupaca') && <MenuBtn label="PRIJEM TRUPACA" icon="🪵" color="indigo" onClick={() => setActiveModule('prijem')} />}
                                  {hasDozvola('Prorez (Trupci)') && <MenuBtn label="PROREZ (Trupci)" icon="🪚" color="cyan" onClick={() => setActiveModule('prorez')} />}
                                  {hasDozvola('Pilana (Izlaz)') && <MenuBtn label="PILANA (Izlaz)" icon="🪵" color="emerald" onClick={() => setActiveModule('pilana')} />}
                                  {hasDozvola('Dorada (Ulaz/Izlaz)') && <MenuBtn label="DORADA (Ulaz/Izlaz)" icon="🔄" color="amber" onClick={() => setActiveModule('dorada')} />}
                                  {hasDozvola('LAGER PAKETA') && <MenuBtn label="LAGER PAKETA" icon="🔍" color="blue" onClick={() => setActiveModule('qr_kontrola')} />}
                              </div>

                              {/* DONJI BLOK DUGMADI */}
                              <div className="grid grid-cols-1 gap-4 w-full mt-4">
                                  {hasDozvola('Ponude') && <MenuBtn label="PONUDE" icon="📝" color="pink" onClick={() => setActiveModule('ponude')} />}
                                  {hasDozvola('Radni Nalozi') && <MenuBtn label="R. NALOZI" icon="📄" color="purple" onClick={() => setActiveModule('nalozi')} />}
                                  {hasDozvola('Otpremnice') && <MenuBtn label="OTPREMNICE" icon="🚚" color="orange" onClick={() => setActiveModule('otpremnice')} />}
                                  {hasDozvola('Računi') && <MenuBtn label="RAČUNI" icon="💰" color="red" onClick={() => setActiveModule('racuni')} />}
                                  {hasDozvola('Blagajna (Keš)') && <MenuBtn label="BLAGAJNA (KEŠ)" icon="💵" color="emerald" onClick={() => setActiveModule('blagajna')} />}
                                  {hasDozvola('Kontrolni Toranj') && <MenuBtn label="KONTROLNI TORANJ" icon="📡" color="blue" onClick={() => setActiveModule('toranj')} />}
                                  
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
                          </>
                      );
                  })()}
              </div>
          ) : activeModule === 'prijem' ? (
              <PrijemModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('dashboard')} />
          ) : activeModule === 'prorez' ? (
              <ProrezModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('dashboard')} />
          ) : activeModule === 'pilana' ? (
              <PilanaModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('dashboard')} />
              ) : activeModule === 'blagajna' ? (
                <BlagajnaModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('dashboard')} />
          ) : activeModule === 'dorada' ? (
              <DoradaModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('dashboard')} />
          ) : activeModule === 'settings' ? (
              <SettingsModule onExit={() => setActiveModule('dashboard')} />
          ) : activeModule === 'ponude' ? (
              <PonudeModule onExit={() => setActiveModule('dashboard')} />
              ) : activeModule === 'toranj' ? (
                <KontrolniToranjModule onExit={() => setActiveModule('dashboard')} />
          ) : activeModule === 'nalozi' ? (
              <RadniNaloziModule onExit={() => setActiveModule('dashboard')} />
          ) : activeModule === 'otpremnice' ? (
              <OtpremniceModule onExit={() => setActiveModule('dashboard')} />
          ) : activeModule === 'racuni' ? (
              <RacuniModule onExit={() => setActiveModule('dashboard')} />
          ) : activeModule === 'analitika' ? (
              <DashboardModule user={loggedUser} onExit={() => setActiveModule('dashboard')} />
          ) : activeModule === 'qr_kontrola' ? (
              <LagerPaketaModule user={loggedUser} onExit={() => setActiveModule('dashboard')} />
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

function MasterHeader({ header, setHeader, onExit, color, user, hideMasina = false, modulIme = '' }) {
    const [showWorkers, setShowWorkers] = useState(false);
    const [masineList, setMasineList] = useState([]);

    useEffect(() => {
        // Tražimo i naziv i dozvoljene module iz baze
        supabase.from('masine').select('naziv, dozvoljeni_moduli').then(({data}) => {
            if (data) {
                let filtriraneMasine = [];

                data.forEach(m => {
                    // Ako modulIme nije proslijeđen, ILI ako mašina nema ograničenja (null), 
                    // ILI ako njena lista sadrži ime trenutnog modula -> dodaj je u listu
                    if (!modulIme || !m.dozvoljeni_moduli || m.dozvoljeni_moduli.toLowerCase().includes(modulIme.toLowerCase())) {
                        filtriraneMasine.push(m.naziv);
                    }
                });

                setMasineList(filtriraneMasine);

                // Ako trenutno odabrana mašina nije na dozvoljenoj listi za ovaj modul, očisti polje
                if (header.masina && !filtriraneMasine.includes(header.masina) && filtriraneMasine.length > 0) {
                    setHeader(prev => ({ ...prev, masina: '' }));
                }
            }
        });
    }, [modulIme, header.masina]); // Osvježi ako se promijeni modul

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

// ============================================================================
// 1. MODUL PRIJEM TRUPACA (BULLETPROOF VERZIJA SA ALARMIMA ZA GREŠKE)
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
        
        // POKUŠAJ UČITAVANJA (Bez sortiranja, za slučaj da 'created_at' ne postoji u bazi)
        const { data, error } = await supabase.from('trupci').select('*').eq('otpremnica_broj', pHeader.otpremnica_broj).eq('zakljucen_prijem', false);
        
        if (error) {
            alert("⚠️ GREŠKA PRI UČITAVANJU LISTE: " + error.message);
            console.error(error);
        }
        
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
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        if(!pHeader.otpremnica_broj || !pHeader.sumarija) return alert("Popunite zaglavlje!");
        if(!scan || !form.duzina || !form.promjer) return alert("Popunite QR, dužinu i promjer.");
        
        const trupacID = scan.toUpperCase();
        const trupacData = {
            id: trupacID, 
            broj_plocice: form.broj_plocice || null, 
            redni_broj: form.redni_broj || null, 
            vrsta: form.vrsta, 
            klasa: form.klasa,
            duzina: parseFloat(form.duzina), 
            promjer: parseFloat(form.promjer), 
            zapremina: parseFloat(calculatedZapremina), 
            sumarija: pHeader.sumarija,
            podruznica: pHeader.podruznica || null, 
            otpremnica_broj: pHeader.otpremnica_broj,
            otpremnica_datum: pHeader.otpremnica_datum, 
            prevoznik: pHeader.prevoznik || null, // <--- DODANO
            odjel: pHeader.odjel || null,         // <--- DODANO
            snimio_korisnik: user?.ime_prezime || 'Nepoznat', 
            datum_prijema: new Date().toISOString().split('T')[0], 
            zakljucen_prijem: false,
            status: 'na_lageru'
        };

        const { error } = await supabase.from('trupci').upsert([trupacData]);
        if (error) return alert("Baza javlja grešku: " + error.message);

        // TIHA POTVRDA: Kratka vibracija (radi na Android/iPhone u pregledniku)
        if (typeof window !== 'undefined' && window.navigator.vibrate) {
            window.navigator.vibrate(100); 
        }

        setScan(''); 
        setForm(f => ({ ...f, broj_plocice: '', redni_broj: '' }));
        await loadPrijemList();
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

            {pHeader.otpremnica_broj && (
                <div className="bg-[#1e293b] p-4 rounded-[2rem] border border-slate-700 animate-in fade-in">
                    <div className="flex justify-between items-center mb-3 px-2">
                        <span className="text-[10px] text-slate-500 uppercase">Lista trupaca (Otpremnica: {pHeader.otpremnica_broj}):</span>
                        <span className="text-indigo-400 font-black">{listaPrijema.length} kom</span>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto mb-4 scrollbar-hide">
                        {listaPrijema.length === 0 && (
                            <div className="text-center p-6 text-slate-500 text-xs font-bold border-2 border-dashed border-slate-700 rounded-xl">
                                Nema dodatih trupaca na listi.
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

// ============================================================================
// 2. MODUL PROREZ (POPRAVLJENO DODAVANJE I PRAĆENJE BRENTISTE)
// ============================================================================

// ============================================================================
// 2. MODUL PROREZ (BULLETPROOF LISTA SA DETALJIMA I VRAĆANJEM NA LAGER)
// ============================================================================

function ProrezModule({ user, header, setHeader, onExit }) {
    const [scan, setScan] = useState('');
    const [list, setList] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    
    // Polja za radnike
    const [brentista, setBrentista] = useState(localStorage.getItem('shared_brentista') || '');
    const [viljuskarista, setViljuskarista] = useState(localStorage.getItem('shared_viljuskarista') || '');
    const [radniciList, setRadniciList] = useState([]);

    const handleBrentistaChange = async (novoIme) => {
        const staroIme = localStorage.getItem('shared_brentista');
        
        // 1. Ako je postojao stari brentista, odjavi ga u bazi
        if (staroIme && staroIme !== novoIme) {
            await supabase.from('aktivni_radnici')
                .update({ vrijeme_odjave: new Date().toISOString() })
                .eq('radnik_ime', staroIme)
                .eq('masina_naziv', header.masina)
                .is('vrijeme_odjave', null);
        }

        // 2. Prijavi novog brentistu u bazu
        if (novoIme) {
            await supabase.from('aktivni_radnici').insert([{
                radnik_ime: novoIme,
                masina_naziv: header.masina,
                vrijeme_prijave: new Date().toISOString(),
                uloga: 'brentista' // Specifična uloga
            }]);
        }

        setBrentista(novoIme);
        localStorage.setItem('shared_brentista', novoIme);
    };

    const handleViljuskaristaChange = async (novoIme) => {
        const staroIme = localStorage.getItem('shared_viljuskarista');
        
        if (staroIme && staroIme !== novoIme) {
            await supabase.from('aktivni_radnici')
                .update({ vrijeme_odjave: new Date().toISOString() })
                .eq('radnik_ime', staroIme)
                .eq('masina_naziv', header.masina)
                .is('vrijeme_odjave', null);
        }

        if (novoIme) {
            await supabase.from('aktivni_radnici').insert([{
                radnik_ime: novoIme,
                masina_naziv: header.masina,
                vrijeme_prijave: new Date().toISOString(),
                uloga: 'viljuskarista'
            }]);
        }

        setViljuskarista(novoIme);
        localStorage.setItem('shared_viljuskarista', novoIme);
    };
    const timerRef = useRef(null);

    useEffect(() => { 
        loadList(); 
        supabase.from('radnici').select('ime_prezime').then(({data}) => setRadniciList(data ? data.map(r=>r.ime_prezime) : []));
    }, [header.masina, header.datum]);

    const loadList = async () => {
        if(!header.masina) return;
        const { data: logData, error: logError } = await supabase.from('prorez_log').select('*').eq('masina', header.masina).eq('datum', header.datum).eq('zakljuceno', false);
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
            trupac_id: trupacId,
            masina: header.masina,
            korisnik: user?.ime_prezime || 'Nepoznat',
            brentista: brentista,
            viljuskarista: viljuskarista,
            mjesto: header.mjesto,
            datum: header.datum,
            zakljuceno: false,
            vrijeme_unosa: new Date().toLocaleTimeString('de-DE')
        };

        const { error: logError } = await supabase.from('prorez_log').insert([logEntry]);
        if (logError) return alert("Greška pri upisu u bazu (Provjerite jesu li dodate kolone brentista i viljuskarista): " + logError.message);

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

    // RADNICI I MEMORIJA
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

        // NOVO: Automatsko povlačenje radnika iz baze ako su odabrani u Prorezu
        const ucitajDezurneRadnike = async () => {
            if (!header.masina) return;
            const { data } = await supabase.from('aktivni_radnici')
                .select('radnik_ime, uloga')
                .eq('masina_naziv', header.masina)
                .is('vrijeme_odjave', null);
            
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

        const timeNowFull = new Date().toISOString();
        const timeNow = new Date().toLocaleTimeString('de-DE');

        // 1. DOHVAĆANJE OSTALIH RADNIKA (Prijavljeni preko gumba u Pilani)
        const { data: aktuelniRadnici } = await supabase
            .from('aktivni_radnici')
            .select('radnik_ime')
            .eq('masina_naziv', header.masina)
            .is('vrijeme_odjave', null);
        const radniciIzPilane = aktuelniRadnici ? aktuelniRadnici.map(r => r.radnik_ime).join(', ') : '';

        // 2. INTERVALNA SLJEDIVOST TRUPACA
        const { data: lastItem } = await supabase
            .from('paketi').select('created_at').eq('paket_id', selectedIzlazId)
            .order('created_at', { ascending: false }).limit(1).maybeSingle();

        const startTime = lastItem ? lastItem.created_at : new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        const { data: logs } = await supabase.from('prorez_log').select('trupac_id')
            .eq('masina', header.masina).gte('created_at', startTime).lte('created_at', timeNowFull);
        const currentTrupciIds = logs ? [...new Set(logs.map(l => l.trupac_id))] : [];

        // 3. KALKULACIJA KOLIČINE
        const v = parseFloat(form.debljina) || 1; const s = parseFloat(form.sirina) || 1; const d = parseFloat(form.duzina) || 1;
        const unosKol = parseFloat(form.kolicina_ulaz);
        let komada = unosKol;
        if (form.jm === 'm3') komada = unosKol / ((v/100) * (s/100) * (d/100));
        else if (form.jm === 'm2') komada = unosKol / ((s/100) * (d/100));
        else if (form.jm === 'm1') komada = unosKol / (d/100);
        const qtyZaPaket = parseFloat((komada * (v/100) * (s/100) * (d/100)).toFixed(3));

        // 4. SNIMANJE SVEGA U BAZU (Svi radnici, trupci i nalog)
        if (activeEditItem) {
            const newM3 = updateMode === 'dodaj' ? parseFloat(activeEditItem.kolicina_final) + qtyZaPaket : parseFloat(activeEditItem.kolicina_final) - qtyZaPaket;
            const { error } = await supabase.from('paketi').update({ 
                kolicina_final: parseFloat(newM3.toFixed(3)), 
                vrijeme_tekst: timeNow, 
                snimio_korisnik: user.ime_prezime,
                brentista: brentista, 
                viljuskarista: viljuskarista, 
                radnici_pilana: radniciIzPilane, 
                oznake: odabraneOznake.length > 0 ? odabraneOznake : activeEditItem.oznake,
                broj_veze: radniNalog || activeEditItem.broj_veze,
                ulaz_trupci_ids: currentTrupciIds.length > 0 ? currentTrupciIds : activeEditItem.ulaz_trupci_ids 
            }).eq('id', activeEditItem.id);
            if (error) return alert("❌ GREŠKA PRI AŽURIRANJU: " + error.message);
        } else {
            const payload = {
                paket_id: selectedIzlazId,
                naziv_proizvoda: form.naziv,
                debljina: v, sirina: s, duzina: d,
                kolicina_ulaz: form.kolicina_ulaz, jm: form.jm, kolicina_final: qtyZaPaket,
                mjesto: header.mjesto, masina: header.masina,
                snimio_korisnik: user.ime_prezime,
                brentista: brentista, 
                viljuskarista: viljuskarista, 
                radnici_pilana: radniciIzPilane, 
                ulaz_trupci_ids: currentTrupciIds,
                broj_veze: radniNalog,
                vrijeme_tekst: timeNow,
                datum_yyyy_mm: header.datum,
                oznake: odabraneOznake
            };

            const { error } = await supabase.from('paketi').insert([payload]);
            if (error) return alert("Greška: " + error.message);

            // Update Radnog Naloga ako postoji
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
            
            // Pitanje za automatski print
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
                                <div className="flex flex-col items-end gap-2">
                                    <div className="text-right font-black">
                                        <div className="text-xl text-white">{item.kolicina_final} m³</div>
                                        <div className="text-[9px] text-slate-500">{item.kolicina_ulaz} {item.jm}</div>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); printDeklaracijaPaketa(item.paket_id, [item], radniNalog); }} 
                                        className="bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border border-blue-500/30 transition-all shadow-md z-10"
                                    >
                                        🖨️ Print QR
                                    </button>
                                </div>
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
// MODUL: ANALITIKA / DASHBOARD (SA INTERAKTIVNOM AI PRETRAGOM I DETALJIMA)
// ===========================================================================

// ============================================================================
// ENTERPRISE ERP DASHBOARD: FULL FIX (PERFEKTAN FILTER ZA SIROVINU)proba
// ============================================================================

// Pomoćne funkcije (Neprobojne)
const fmtBS = (iso) => {
    if(!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}.`;
  };
  
  const imaSirovinu = (val) => {
      if (!val) return false;
      if (Array.isArray(val) && val.length > 0) return true;
      if (typeof val === 'string') {
          const clean = val.replace(/[{}"[\]\s]/g, '');
          return clean.length > 0;
      }
      return false;
  };
  
  const getSirovineNiz = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') return val.replace(/[{}"[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean);
      return [];
  };

  // GLOBALNA FUNKCIJA ZA DOKUMENTE (Ponude, Fakture, Nalozi) - Dostupna svuda!
// GLOBALNA FUNKCIJA ZA DOKUMENTE (Ultra Moderni Dizajn)
// GLOBALNA FUNKCIJA ZA DOKUMENTE (Ultra Moderni Dizajn - FIXED BUG)
// GLOBALNA FUNKCIJA ZA DOKUMENTE (Ultra Moderni Dizajn - FIXED BUG)
// GLOBALNA FUNKCIJA ZA DOKUMENTE (Pametno Brendiranje)
// GLOBALNA FUNKCIJA ZA DOKUMENTE (Pametno Brendiranje)
// GLOBALNA FUNKCIJA ZA DOKUMENTE (Pametno Brendiranje)
// GLOBALNA FUNKCIJA ZA DOKUMENTE (Pametno Brendiranje i PDF)
// GLOBALNA FUNKCIJA ZA DOKUMENTE (Pametno Brendiranje i PDF)
// GLOBALNA FUNKCIJA ZA DOKUMENTE (Pametno Brendiranje i PDF)
// GLOBALNA FUNKCIJA ZA DOKUMENTE (Pametno Brendiranje i PDF)
// GLOBALNA FUNKCIJA ZA DOKUMENTE (Pametno Brendiranje i PDF)
const printDokument = (tipDokumenta, brojDokumenta, datum, htmlSadrzajTabela, themeColor = '#3b82f6') => {
    const originalTitle = document.title;
    const nazivFajla = `${datum} ${tipDokumenta} ${brojDokumenta}`;
    document.title = nazivFajla; 

    // 🎨 Dinamički povlači logo iz baze (memorije) zavisno od tipa PDF-a
    let trazenaLokacija = 'Svi PDF Dokumenti';
    if (tipDokumenta === 'PONUDA') trazenaLokacija = 'PDF Ponuda';
    if (tipDokumenta === 'RADNI NALOG') trazenaLokacija = 'PDF Radni Nalog';
    if (tipDokumenta === 'OTPREMNICA') trazenaLokacija = 'PDF Otpremnica';
    if (tipDokumenta === 'RAČUN') trazenaLokacija = 'PDF Račun';
    if (tipDokumenta.includes('POTVRDA')) trazenaLokacija = 'PDF Blagajna';

    let topBannerHtml = '';
    let leftLogoHtml = '<div class="company-name">SmartTimber ERP</div>';

    try {
        const brending = JSON.parse(localStorage.getItem('erp_brending') || '[]');
        const logoObj = brending.find(b => (b.lokacije_jsonb || []).includes(trazenaLokacija)) || brending.find(b => (b.lokacije_jsonb || []).includes('Svi PDF Dokumenti'));
        
        if (logoObj && logoObj.url_slike) {
            if (logoObj.full_width) {
                // Prikaz preko cijele širine (MEMORANDUM)
                topBannerHtml = `<div style="width: 100%; margin-bottom: 25px; text-align: center;"><img src="${logoObj.url_slike}" style="width: 100%; max-height: 180px; object-fit: contain; display: block;" alt="Banner Firme" /></div>`;
                leftLogoHtml = ''; // Brišemo onaj mali logo u uglu jer imamo baner
            } else {
                // Standardni prikaz u lijevom uglu
                leftLogoHtml = `<img src="${logoObj.url_slike}" style="max-height: 65px; max-width: 250px; object-fit: contain; margin-bottom: 8px;" alt="Logo Firme" />`;
            }
        }
    } catch(e) { console.log("Greška pri učitavanju logotipa", e); }

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${brojDokumenta}`;
    
    // Šifrirana skripta da ne bi rušila SWC Compiler
    const printSkripta = decodeURIComponent('%3Cscript%3Ewindow.onload%3Dfunction()%7BsetTimeout(function()%7Bwindow.print()%3B%7D%2C800)%3B%7D%3B%3C%2Fscript%3E');

    const html = `
        <html>
        <head>
            <title>${nazivFajla}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
                body { font-family: 'Inter', sans-serif; padding: 0; margin: 0; color: #1e293b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .page-container { padding: 40px; }
                .top-bar { height: 14px; background-color: ${themeColor}; width: 100%; }
                .header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; margin-bottom: 30px; }
                .logo-area { display: flex; flex-direction: column; }
                .company-name { font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; opacity: 0.8;}
                .doc-title { font-size: 42px; font-weight: 900; color: ${themeColor}; text-transform: uppercase; margin: 5px 0 0px 0; letter-spacing: -1.5px; line-height: 1; }
                .qr-wrapper { text-align: center; background: #f8fafc; padding: 12px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                .qr-wrapper img { width: 90px; height: 90px; }
                .qr-text { font-family: monospace; font-size: 11px; font-weight: 800; margin-top: 8px; color: #475569; letter-spacing: 1px;}
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
                th { background-color: ${themeColor}; color: white; padding: 14px 12px; text-transform: uppercase; font-size: 10px; letter-spacing: 1px; text-align: left; }
                td { padding: 14px 12px; border-bottom: 1px solid #e2e8f0; color: #334155; }
                tr:nth-child(even) td { background-color: #f8fafc; }
                .summary-box { width: 320px; float: right; background: #f8fafc; border-radius: 16px; padding: 25px; margin-top: 30px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
                .summary-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; color: #64748b; }
                .summary-row b { color: #0f172a; }
                .summary-total { display: flex; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 2px dashed #cbd5e1; font-size: 22px; font-weight: 900; color: ${themeColor}; align-items: center; }
                .info-grid { display: flex; justify-content: space-between; background: #f1f5f9; padding: 25px; border-radius: 16px; border-left: 6px solid ${themeColor}; margin-bottom: 30px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }
                .info-col h4 { margin: 0 0 10px 0; font-size: 10px; text-transform: uppercase; color: #64748b; letter-spacing: 1px; font-weight: 800; }
                .info-col p { margin: 0; font-size: 14px; font-weight: 600; color: #0f172a; line-height: 1.5; }
                .footer { clear: both; padding-top: 30px; margin-top: 50px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; }
            </style>
        </head>
        <body>
            <div class="top-bar"></div>
            <div class="page-container">
                ${topBannerHtml}
                <div class="header">
                    <div class="logo-area">
                        ${leftLogoHtml}
                        <div class="doc-title">${tipDokumenta}</div>
                        <div style="color: #64748b; font-size: 14px; font-weight: 600; margin-top: 8px; letter-spacing: 0.5px;">Broj: <span style="color: #0f172a;">${brojDokumenta}</span> &nbsp;|&nbsp; Datum: ${datum}</div>
                    </div>
                    <div class="qr-wrapper">
                        <img src="${qrCodeUrl}" alt="QR" />
                        <div class="qr-text">${brojDokumenta}</div>
                    </div>
                </div>
                ${htmlSadrzajTabela}
            </div>
            ${printSkripta}
        </body>
        </html>
    `;
    
    iframe.contentWindow.document.open(); iframe.contentWindow.document.write(html); iframe.contentWindow.document.close();
    setTimeout(() => { document.title = originalTitle; }, 3000);
    setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 300000);
};
// ============================================================================
// GLOBALNA FUNKCIJA ZA PRINTANJE GOTOVIH PAKETA (A5 LANDSCAPE - TTM DIZAJN)
// ============================================================================
// GLOBALNA FUNKCIJA ZA PRINTANJE GOTOVIH PAKETA (A5 LANDSCAPE - PRAVI TTM DIZAJN)
// ============================================================================
// ============================================================================
// AŽURIRANA GLOBALNA FUNKCIJA ZA DINAMIČKO PRINTANJE NA A5 (TTM DIZAJN)
// ============================================================================
// ============================================================================
// STROGA A5 PRINT FUNKCIJA (TTM DIZAJN - 1 STRANICA GARANTOVANO)
// ============================================================================
const printDeklaracijaPaketa = (paketId, items, vezniDokument = '') => {
    if (!items || items.length === 0) return;

    const originalTitle = document.title;
    document.title = `Deklaracija_${paketId}`;

    let logoUrl = '';
    try {
        const brending = JSON.parse(localStorage.getItem('erp_brending') || '[]');
        const logoObj = brending.find(b => (b.lokacije_jsonb || []).includes('Svi PDF Dokumenti')) || brending.find(b => (b.lokacije_jsonb || []).includes('Glavni Meni (Dashboard Vrh)'));
        if (logoObj && logoObj.url_slike) logoUrl = logoObj.url_slike;
    } catch(e) {}

    const qrPaket = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${paketId}`;
    const qrVeza = vezniDokument ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${vezniDokument}` : '';

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    // Kalkulacije
    const totalVol = items.reduce((sum, i) => sum + parseFloat(i.kolicina_final || 0), 0).toFixed(3);
    const formatDatumTacke = (iso) => {
        if(!iso) return '';
        const [y, m, d] = iso.split('-');
        return `${d}.${m}.${y}.`;
    };
    const datum = items[0].datum_yyyy_mm ? formatDatumTacke(items[0].datum_yyyy_mm) : formatDatumTacke(new Date().toISOString().split('T')[0]);
    const woodType = items[0].naziv_proizvoda.split(' ')[0] || 'Rezana'; 
    let totalLengthM = 0;

    const redoviStavki = items.map(item => {
        let pcs = parseFloat(item.kolicina_ulaz || 0);
        const v = parseFloat(item.debljina)||1; const s = parseFloat(item.sirina)||1; const d = parseFloat(item.duzina)||1;
        if (item.jm === 'm3') pcs = Math.round(pcs / ((v/100)*(s/100)*(d/100)));
        
        totalLengthM += (pcs * (d/100)); // Ukupna dužina u metrima

        return `
        <div class="row">
            <div class="col"><div class="lbl-wrap"><span class="lbl">Tickness mm</span></div><div class="box">${item.debljina}</div></div>
            <div class="col"><div class="lbl-wrap"><span class="lbl">Width mm</span></div><div class="box">${item.sirina}</div></div>
            <div class="col"><div class="lbl-wrap"><span class="lbl">Length mm</span></div><div class="box">${item.duzina * 10}</div></div>
            <div class="col"><div class="lbl-wrap"><span class="lbl">PCS</span></div><div class="box">${pcs}</div></div>
            <div class="col"><div class="lbl-wrap"><span class="lbl">Volume (m³)</span></div><div class="box">${item.kolicina_final}</div></div>
        </div>
        `;
    }).join('');

    const html = `
        <html>
        <head>
            <title>Deklaracija ${paketId}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                
                /* STRIKTNI A5 FORMAT - SPREČAVA PRAZNE STRANICE */
                @page { size: 210mm 148mm landscape; margin: 0; }
                
                html, body {
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #fff;
                    width: 210mm;
                    height: 148mm;
                    overflow: hidden; /* Zaključava sadržaj na tačno 1 stranicu */
                }

                .page-container { 
                    font-family: 'Inter', sans-serif; 
                    width: 210mm; 
                    height: 148mm; 
                    padding: 8mm 10mm; 
                    box-sizing: border-box; 
                    -webkit-print-color-adjust: exact; print-color-adjust: exact;
                    display: flex; 
                    flex-direction: column; 
                    justify-content: space-between;
                }

                .header { display: flex; justify-content: space-between; align-items: flex-start; }
                .logo img { max-width: 280px; max-height: 55px; object-fit: contain; }
                .logo h1 { margin: 0; font-size: 26px; font-weight: 900; color: #1e3a8a; }
                
                .header-info { text-align: right; font-size: 13px; font-weight: bold; }
                .info-row { display: flex; justify-content: flex-end; align-items: center; margin-bottom: 4px; gap: 8px;}
                .info-lbl { border: 1px dotted #666; padding: 2px 6px; font-weight: normal;}
                .info-val { border: 1px dotted #666; padding: 2px 10px; min-width: 110px; text-align: center; }

                .pkg-row { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 8px; margin-bottom: 5px;}
                .pkg-lbl { border: 1px dotted #666; padding: 2px 6px; font-size: 13px;}
                .pkg-val { font-size: 38px; font-weight: 900; letter-spacing: 0.5px; line-height: 1;}

                /* DIZAJN REDOVA I KOCKI */
                .content-area { flex: 1; display: flex; flex-direction: column; justify-content: flex-start; margin-top: 5px;}
                .row { display: flex; justify-content: space-between; gap: 10px; width: 100%; margin-top: 6px;}
                .col { flex: 1; text-align: center; display: flex; flex-direction: column;}
                .lbl-wrap { text-align: center; margin-bottom: 2px; }
                .lbl { font-size: 11px; border-bottom: 1px dotted #000; padding-bottom: 2px; display: inline-block; }
                .box { border: 3px solid #000; font-size: 22px; font-weight: 900; flex: 1; display: flex; align-items: center; justify-content: center; min-height: 34px; padding: 2px;}
                
                /* QR KODOVI */
                .qr-area { display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; padding-top: 10px;}
                .qr-left { display: flex; gap: 6px; align-items: center; }
                .qr-left-text { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 11px; letter-spacing: 1px; font-weight: bold; margin-bottom: 2px;}
                .qr-img-small { width: 85px; height: 85px; }
                
                .qr-right { display: flex; flex-direction: column; align-items: center;}
                .qr-img-large { width: 95px; height: 95px; }
                .qr-number { font-family: monospace; font-size: 11px; font-weight: bold; letter-spacing: 2px; margin-top: 2px; }

                /* FOOTER */
                .footer { border-top: 4px solid #000; padding-top: 4px; margin-top: 8px; display: flex; justify-content: space-between; font-size: 11px; line-height: 1.4; }
                .footer b { font-size: 13px; }
                .footer-links { text-align: right; color: blue; text-decoration: underline; }
            </style>
        </head>
        <body>
            <div class="page-container">
                <div class="header">
                    <div class="logo">
                        ${logoUrl ? `<img src="${logoUrl}" />` : `<h1>${POSTAVKE.imeFirme}</h1><p style="margin:0; font-size:11px;">TIMBER TRADING & MANUFACTURING</p>`}
                    </div>
                    <div class="header-info">
                        <div class="info-row"><span class="info-lbl">PLACE:</span><span class="info-val">Brčko, BiH</span></div>
                        <div class="info-row"><span class="info-lbl">DATE:</span><span class="info-val">${datum}</span></div>
                        <div class="pkg-row"><span class="pkg-lbl">Package number:</span><span class="pkg-val">${paketId}</span></div>
                    </div>
                </div>

                <div class="content-area">
                    <div class="row">
                        <div class="col"><div class="lbl-wrap"><span class="lbl">Wood Type</span></div><div class="box">${woodType}</div></div>
                        <div class="col"><div class="lbl-wrap"><span class="lbl">Treatment</span></div><div class="box">0</div></div>
                        <div class="col"><div class="lbl-wrap"><span class="lbl">MC</span></div><div class="box">8-11%</div></div>
                        <div class="col"><div class="lbl-wrap"><span class="lbl">Quality</span></div><div class="box">A/B</div></div>
                        <div class="col"><div class="lbl-wrap"><span class="lbl">Total Length (m)</span></div><div class="box">${Math.round(totalLengthM)}</div></div>
                    </div>
                    
                    ${redoviStavki}
                </div>

                <div class="qr-area">
                    <div class="qr-left">
                        ${vezniDokument ? `
                            <img src="${qrVeza}" class="qr-img-small" />
                            <span class="qr-left-text">${vezniDokument}</span>
                        ` : ''} 
                    </div>
                    <div class="qr-right">
                        <img src="${qrPaket}" class="qr-img-large" />
                        <div class="qr-number">${paketId}</div>
                    </div>
                </div>

                <div class="footer">
                    <div>
                        <b>${POSTAVKE.imeFirme}</b><br>
                        Rijeka bb, 75328 Doborovci,<br>
                        Bosnia and Herzegovina<br>
                        Tel: +387 49 591 900
                    </div>
                    <div class="footer-links">
                        www.ttmdoo.com<br>
                        E-mail: info@ttmdoo.com
                    </div>
                </div>
            </div>
            ${"<sc"+"ript>"}window.onload = function(){ setTimeout(function(){ window.print(); }, 800); };${"</sc"+"ript>"}
        </body>
        </html>
    `;

    iframe.contentWindow.document.open(); iframe.contentWindow.document.write(html); iframe.contentWindow.document.close();
    setTimeout(() => { document.title = originalTitle; }, 3000);
    setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 60000);
};
//===========================================================
// MODUL: ANALITIKA / DASHBOARD (SPOJENI SVI IZVJEŠTAJI, FINANSIJE I AI)
// ============================================================================
export function DashboardModule({ user, onExit }) {
    const danasnjiDatum = new Date().toISOString().split('T')[0];
    const [activeTab, setActiveTab] = useState('pilana');
    const [tipDatuma, setTipDatuma] = useState('dan'); 
    const [datumOd, setDatumOd] = useState(danasnjiDatum);
    const [datumDo, setDatumDo] = useState(danasnjiDatum);
    const [isPeriodic, setIsPeriodic] = useState(false);
    
    const [filterMjesto, setFilterMjesto] = useState('SVE');
    const [filterSmjena, setFilterSmjena] = useState('SVE');
  
    const [loading, setLoading] = useState(true);
  
    // --- STARA STANJA (PILANA, DORADA, AI, QR) ---
    const [pilanaData, setPilanaData] = useState({ kpi: { ulaz_m3: 0, ulaz_kom: 0, avg_d: 0, izlaz_m3: 0, yield_proc: 0, trend_7d_proc: 0, trend_30d_proc: 0 }, trupci_duzine: [], izlaz_struktura: [], ucinak_brentista: [], trend_7d: [], trend_30d: [], glavna_tabela: [] });
    const [doradaData, setDoradaData] = useState({ kpi: { ulaz_m3: 0, izlaz_m3: 0, kalo_m3: 0, yield_proc: 0, trend_7d_proc: 0, operacije_count: 0 }, operacije: [], trend_7d: [], trace_blokovi: [] });
    const [aiUpit, setAiUpit] = useState('');
    const [aiOdgovor, setAiOdgovor] = useState('');
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const apiKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') || '' : '';
    const [searchId, setSearchId] = useState('');
    const [auditLog, setAuditLog] = useState(null);

    // --- NOVA STANJA (FINANSIJE, PROCESI) ---
    const [finansijeKPI, setFinansijeKPI] = useState({ ukupnoFakturisano: 0, naplacenoGotovina: 0, naplacenoVirman: 0, nenaplacenoDug: 0, ocekivaniPDV: 0 });
    const [trendFinansija, setTrendFinansija] = useState([]);
    const [strukturaNaplate, setStrukturaNaplate] = useState([]);
    const [topDuznici, setTopDuznici] = useState([]);
    const [procesiKPI, setProcesiKPI] = useState({ ponudeBroj: 0, rnBroj: 0, isporukeBroj: 0, avgDaniPonRn: 0, avgDaniRnOtp: 0, avgDaniOtpRac: 0 });
    const [funnelData, setFunnelData] = useState([]);
  
    const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6', '#f43f5e', '#06b6d4'];
  
    useEffect(() => { ucitajAnalitiku(); }, [datumOd, datumDo, isPeriodic, filterMjesto, filterSmjena]);
  
    const setBrziDatum = (tip) => {
      const danas = new Date();
      setTipDatuma('period'); setIsPeriodic(true);
      if (tip === '7d') { setDatumOd(new Date(danas.getTime() - 6*24*60*60*1000).toISOString().split('T')[0]); setDatumDo(danasnjiDatum); } 
      else if (tip === 'mjesec') { setDatumOd(new Date(danas.getFullYear(), danas.getMonth(), 1).toISOString().split('T')[0]); setDatumDo(new Date(danas.getFullYear(), danas.getMonth() + 1, 0).toISOString().split('T')[0]); } 
      else if (tip === 'prosli_mjesec') { setDatumOd(new Date(danas.getFullYear(), danas.getMonth() - 1, 1).toISOString().split('T')[0]); setDatumDo(new Date(danas.getFullYear(), danas.getMonth(), 0).toISOString().split('T')[0]); }
    };
  
    const shiftDate = (n) => { const d = new Date(datumOd); d.setDate(d.getDate()+n); const iso = d.toISOString().split('T')[0]; setDatumOd(iso); setDatumDo(iso); };
  
    const provjeriSmjenu = (vrijemeStr) => {
        if (filterSmjena === 'SVE' || !vrijemeStr) return true;
        const hour = parseInt(vrijemeStr.substring(0, 2));
        if (filterSmjena === '1' && hour >= 7 && hour < 15) return true;
        if (filterSmjena === '2' && hour >= 15 && hour < 23) return true;
        if (filterSmjena === '3' && (hour >= 23 || hour < 7)) return true;
        return false;
    };
  
    const ucitajAnalitiku = async () => {
      setLoading(true);
      try {
        const d60 = new Date(new Date(datumOd).getTime() - 60*24*60*60*1000).toISOString().split('T')[0];
        
        // POvlačimo i staru bazu i novu finansijsku bazu
        const [tRes, pRes, plRes, ponRes, rnRes, otpRes, racRes, blaRes] = await Promise.all([
          supabase.from('trupci').select('*').gte('datum_prijema', d60).lte('datum_prijema', datumDo),
          supabase.from('paketi').select('*').gte('datum_yyyy_mm', d60).lte('datum_yyyy_mm', datumDo),
          supabase.from('prorez_log').select('*').gte('datum', d60).lte('datum', datumDo),
          supabase.from('ponude').select('*').gte('datum', datumOd).lte('datum', datumDo),
          supabase.from('radni_nalozi').select('*').gte('datum', datumOd).lte('datum', datumDo),
          supabase.from('otpremnice').select('*').gte('datum', datumOd).lte('datum', datumDo),
          supabase.from('racuni').select('*').gte('datum', datumOd).lte('datum', datumDo),
          supabase.from('blagajna').select('*').gte('datum', datumOd).lte('datum', datumDo)
        ]);
  
        // 1. OBRADA PILANE
        const logTrenutno = plRes.data?.filter(pl => pl.datum >= datumOd && pl.datum <= datumDo && (filterMjesto==='SVE' || pl.mjesto===filterMjesto) && provjeriSmjenu(pl.vrijeme_unosa)) || [];
        const paketiPilanaTrenutno = pRes.data?.filter(p => p.datum_yyyy_mm >= datumOd && p.datum_yyyy_mm <= datumDo && !imaSirovinu(p.ai_sirovina_ids) && (filterMjesto==='SVE' || p.mjesto===filterMjesto) && provjeriSmjenu(p.vrijeme_tekst)) || [];
  
        let p_ulaz_m3 = 0; let p_ulaz_kom = 0; let p_total_d = 0; const duzineMap = {}; const brentistaMap = {};
        logTrenutno.forEach(log => {
          const trupac = tRes.data?.find(t => t.id === log.trupac_id);
          if (trupac) {
              p_ulaz_kom++; const m3 = parseFloat(trupac.zapremina || 0); p_ulaz_m3 += m3; p_total_d += parseFloat(trupac.promjer || 0);
              const duz = parseFloat(trupac.duzina || 0).toFixed(1);
              if (!duzineMap[duz]) duzineMap[duz] = { kom: 0, m3: 0 };
              duzineMap[duz].kom++; duzineMap[duz].m3 += m3;
              const brentista = log.brentista || log.korisnik || 'Nepoznat';
              brentistaMap[brentista] = (brentistaMap[brentista] || 0) + m3;
          }
        });
  
        let p_izlaz_m3 = 0; const strukturaMap = {}; 
        paketiPilanaTrenutno.forEach(p => { const m3 = parseFloat(p.kolicina_final || 0); p_izlaz_m3 += m3; strukturaMap[p.naziv_proizvoda] = (strukturaMap[p.naziv_proizvoda] || 0) + m3; });
  
        const d7_pocetak = new Date(new Date(datumOd).getTime() - 7*24*60*60*1000).toISOString().split('T')[0];
        const d30_pocetak = new Date(new Date(datumOd).getTime() - 30*24*60*60*1000).toISOString().split('T')[0];
        
        const p_izlaz_7d = pRes.data?.filter(p => p.datum_yyyy_mm >= d7_pocetak && p.datum_yyyy_mm < datumOd && !imaSirovinu(p.ai_sirovina_ids)).reduce((sum, p) => sum + parseFloat(p.kolicina_final || 0), 0) || 0;
        const p_trend7dProc = (p_izlaz_7d/7) > 0 ? (((p_izlaz_m3 - (p_izlaz_7d/7)) / (p_izlaz_7d/7)) * 100).toFixed(1) : 0;
        const p_izlaz_30d = pRes.data?.filter(p => p.datum_yyyy_mm >= d30_pocetak && p.datum_yyyy_mm < datumOd && !imaSirovinu(p.ai_sirovina_ids)).reduce((sum, p) => sum + parseFloat(p.kolicina_final || 0), 0) || 0;
        const p_trend30dProc = (p_izlaz_30d/30) > 0 ? (((p_izlaz_m3 - (p_izlaz_30d/30)) / (p_izlaz_30d/30)) * 100).toFixed(1) : 0;
  
        let p_chart_7d = []; let p_chart_30d = [];
        for(let i=6; i>=0; i--) { const d = new Date(new Date(datumOd).getTime() - i*24*60*60*1000).toISOString().split('T')[0]; const dayOut = pRes.data?.filter(p => p.datum_yyyy_mm === d && !imaSirovinu(p.ai_sirovina_ids)).reduce((s,p) => s + parseFloat(p.kolicina_final||0), 0) || 0; p_chart_7d.push({ name: fmtBS(d).substring(0,5), Proizvodnja: parseFloat(dayOut.toFixed(2)) }); }
        for(let i=9; i>=0; i--) { const dEnd = new Date(new Date(datumOd).getTime() - (i*3)*24*60*60*1000).toISOString().split('T')[0]; const dStart = new Date(new Date(datumOd).getTime() - ((i*3)+2)*24*60*60*1000).toISOString().split('T')[0]; const periodOut = pRes.data?.filter(p => p.datum_yyyy_mm >= dStart && p.datum_yyyy_mm <= dEnd && !imaSirovinu(p.ai_sirovina_ids)).reduce((s,p) => s + parseFloat(p.kolicina_final||0), 0) || 0; p_chart_30d.push({ name: fmtBS(dEnd).substring(0,5), Proizvodnja: parseFloat(periodOut.toFixed(2)) }); }
  
        setPilanaData({
            kpi: { ulaz_m3: p_ulaz_m3.toFixed(2), ulaz_kom: p_ulaz_kom, avg_d: p_ulaz_kom > 0 ? (p_total_d / p_ulaz_kom).toFixed(1) : 0, izlaz_m3: p_izlaz_m3.toFixed(2), yield_proc: p_ulaz_m3 > 0 ? ((p_izlaz_m3 / p_ulaz_m3) * 100).toFixed(1) : 0, trend_7d_proc: p_trend7dProc, trend_30d_proc: p_trend30dProc },
            trupci_duzine: Object.keys(duzineMap).map(d => ({ duzina: d, kom: duzineMap[d].kom, m3: duzineMap[d].m3.toFixed(2) })).sort((a,b)=>b.duzina-a.duzina),
            izlaz_struktura: Object.keys(strukturaMap).map(k => ({ name: k, m3: parseFloat(strukturaMap[k].toFixed(2)) })).sort((a,b)=>b.m3-a.m3),
            ucinak_brentista: Object.keys(brentistaMap).map(k => ({ name: k, m3: parseFloat(brentistaMap[k].toFixed(2)) })).sort((a,b)=>b.m3-a.m3),
            trend_7d: p_chart_7d, trend_30d: p_chart_30d, glavna_tabela: paketiPilanaTrenutno.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
        });
  
        // 2. OBRADA DORADE
        const paketiDoradaTrenutno = pRes.data?.filter(p => {
          if (p.datum_yyyy_mm < datumOd || p.datum_yyyy_mm > datumDo) return false;
          if (!imaSirovinu(p.ai_sirovina_ids)) return false; 
          if (filterMjesto !== 'SVE' && p.mjesto !== filterMjesto) return false;
          if (!provjeriSmjenu(p.vrijeme_tekst)) return false;
          return true;
        }) || [];
  
        let d_ulaz_m3 = 0; let d_izlaz_m3 = 0; const operacijeMap = {}; const traceBlokovi = [];
        const globalProductYieldMap = {}; const svaDorada60d = pRes.data?.filter(p => imaSirovinu(p.ai_sirovina_ids)) || [];
        svaDorada60d.forEach(p => { const u = parseFloat(p.kolicina_ulaz || p.kolicina_final || 0); const i = parseFloat(p.kolicina_final || 0); if(!globalProductYieldMap[p.naziv_proizvoda]) globalProductYieldMap[p.naziv_proizvoda] = { u: 0, i: 0 }; globalProductYieldMap[p.naziv_proizvoda].u += u; globalProductYieldMap[p.naziv_proizvoda].i += i; });
  
        paketiDoradaTrenutno.forEach(p => {
            const izlaz = parseFloat(p.kolicina_final || 0); const ulaz = parseFloat(p.kolicina_ulaz || izlaz); 
            d_izlaz_m3 += izlaz; d_ulaz_m3 += ulaz;
            if(p.oznake && Array.isArray(p.oznake)) p.oznake.forEach(o => { operacijeMap[o] = (operacijeMap[o] || 0) + izlaz; });
  
            let sirovineTekst = []; const idsSirovine = getSirovineNiz(p.ai_sirovina_ids);
            if (idsSirovine.length > 0) {
                idsSirovine.forEach(id => {
                    const orig = pRes.data?.find(r => r.paket_id === id);
                    if (orig) { const ostalo = parseFloat(orig.kolicina_final || 0); sirovineTekst.push(`Paket ${orig.paket_id} (${orig.naziv_proizvoda} ${orig.debljina}x${orig.sirina}x${orig.duzina}) ${ostalo > 0 ? `| Preostalo: ${ostalo}m³` : '| Utrošen'}`); } else sirovineTekst.push(`Paket ${id}`);
                });
            }
  
            const currYield = ulaz > 0 ? ((izlaz / ulaz) * 100).toFixed(1) : 100;
            const avg60d = globalProductYieldMap[p.naziv_proizvoda]?.u > 0 ? ((globalProductYieldMap[p.naziv_proizvoda].i / globalProductYieldMap[p.naziv_proizvoda].u) * 100).toFixed(1) : '-';
            const brzinaM3h = (paketiDoradaTrenutno.reduce((s, dPkg) => s + parseFloat(dPkg.kolicina_final||0), 0) / 8).toFixed(2);
  
            traceBlokovi.push({ out_id: p.paket_id, out_naziv: p.naziv_proizvoda, out_dim: `${p.debljina}x${p.sirina}x${p.duzina}`, out_m3: izlaz.toFixed(2), in_m3: ulaz.toFixed(2), in_ids: sirovineTekst.join(' \n '), operacije: p.oznake ? p.oznake.join(', ') : 'Prerada / Reklasiranje', yield: currYield, avg_60d: avg60d, brzina: brzinaM3h, radnik: p.snimio_korisnik, vrijeme: p.vrijeme_tekst, masina: p.masina || '-' });
        });
  
        const dorada_proslih_7d = svaDorada60d.filter(p => p.datum_yyyy_mm >= d7_pocetak && p.datum_yyyy_mm < datumOd).reduce((sum, p) => sum + parseFloat(p.kolicina_final || 0), 0) || 0;
        const d_avg_7d = dorada_proslih_7d / 7; const d_trend7dProc = d_avg_7d > 0 ? (((d_izlaz_m3 - d_avg_7d) / d_avg_7d) * 100).toFixed(1) : 0;
        let d_chart_7d = []; for(let i=6; i>=0; i--) { const d = new Date(new Date(datumOd).getTime() - i*24*60*60*1000).toISOString().split('T')[0]; const dayOut = svaDorada60d.filter(p => p.datum_yyyy_mm === d).reduce((s,p) => s + parseFloat(p.kolicina_final||0), 0) || 0; d_chart_7d.push({ name: fmtBS(d).substring(0,5), Dorada: parseFloat(dayOut.toFixed(2)) }); }
  
        setDoradaData({ kpi: { ulaz_m3: d_ulaz_m3.toFixed(2), izlaz_m3: d_izlaz_m3.toFixed(2), kalo_m3: (d_ulaz_m3 - d_izlaz_m3).toFixed(2), yield_proc: d_ulaz_m3 > 0 ? ((d_izlaz_m3 / d_ulaz_m3) * 100).toFixed(1) : 0, trend_7d_proc: d_trend7dProc, operacije_count: paketiDoradaTrenutno.length }, operacije: Object.keys(operacijeMap).map(k => ({ name: k, m3: parseFloat(operacijeMap[k].toFixed(2)) })).sort((a,b)=>b.m3-a.m3), trend_7d: d_chart_7d, trace_blokovi: traceBlokovi.sort((a,b) => b.out_m3 - a.out_m3) });

        // 3. OBRADA FINANSIJA I KPI
        const racuni = racRes.data || [];
        const blagajna = blaRes.data || [];
        let fGotovina = 0; let fVirman = 0; let fDug = 0; let fPdv = 0;
        let kupciDugovanja = {};

        racuni.forEach(r => {
            fPdv += (r.ukupno_sa_pdv - r.ukupno_bez_pdv);
            if (r.status.includes('NAPLAĆENO')) {
                if (r.nacin_placanja === 'Gotovina') fGotovina += r.ukupno_sa_pdv;
                else fVirman += r.ukupno_sa_pdv;
            } else {
                fDug += r.ukupno_sa_pdv;
                kupciDugovanja[r.kupac_naziv] = (kupciDugovanja[r.kupac_naziv] || 0) + r.ukupno_sa_pdv;
            }
        });

        setFinansijeKPI({ ukupnoFakturisano: fGotovina + fVirman + fDug, naplacenoGotovina: fGotovina, naplacenoVirman: fVirman, nenaplacenoDug: fDug, ocekivaniPDV: fPdv });
        setTopDuznici(Object.keys(kupciDugovanja).map(k => ({ name: k, dug: kupciDugovanja[k] })).sort((a,b) => b.dug - a.dug).slice(0,5));
        setStrukturaNaplate([ { name: 'Gotovina (Kasa)', value: fGotovina }, { name: 'Virman (Banka)', value: fVirman }, { name: 'Nenaplaćeno (Dug)', value: fDug } ]);

        const daniFinansija = {};
        racuni.forEach(r => {
            if(!daniFinansija[r.datum]) daniFinansija[r.datum] = { datum: r.datum, Fakturisano: 0, Naplaćeno: 0 };
            daniFinansija[r.datum].Fakturisano += r.ukupno_sa_pdv;
            if(r.status.includes('NAPLAĆENO')) daniFinansija[r.datum].Naplaćeno += r.ukupno_sa_pdv;
        });
        const trendArr = Object.values(daniFinansija).sort((a,b) => new Date(a.datum) - new Date(b.datum)).map(d => ({ ...d, datum: fmtBS(d.datum).substring(0,5) }));
        setTrendFinansija(trendArr);

        // 4. OBRADA PROCESA (LIJEVAK)
        const ponBroj = ponRes.data?.length || 0;
        const rnBroj = rnRes.data?.length || 0;
        const otpBroj = otpRes.data?.length || 0;
        const racBroj = racuni.length;
        const naplacenoBroj = racuni.filter(r => r.status.includes('NAPLAĆENO')).length;

        setProcesiKPI({ ponudeBroj: ponBroj, rnBroj, isporukeBroj: otpBroj, avgDaniPonRn: 1.2, avgDaniRnOtp: 3.5, avgDaniOtpRac: 0.5 });
        setFunnelData([
            { name: 'Kreirane Ponude', vrijednost: ponBroj, fill: '#ec4899' },
            { name: 'Proizvodnja (RN)', vrijednost: rnBroj, fill: '#a855f7' },
            { name: 'Isporuka (OTP)', vrijednost: otpBroj, fill: '#f97316' },
            { name: 'Fakturisano (RAC)', vrijednost: racBroj, fill: '#3b82f6' },
            { name: 'Naplaćeno (CASH)', vrijednost: naplacenoBroj, fill: '#10b981' }
        ]);
  
      } catch (e) { console.error("Greška u analitici:", e); }
      setLoading(false);
    };
  
    const parseAuditDiff = (oldD, newD) => {
        if (!oldD && newD) return `Kreirano u bazi. Zapremina: ${newD.kolicina_final || newD.zapremina || 0}m³`;
        if (oldD && newD) {
            let diffs = [];
            if (oldD.kolicina_final !== newD.kolicina_final) diffs.push(`Količina: ${oldD.kolicina_final}m³ ➡️ ${newD.kolicina_final}m³`);
            if (oldD.masina !== newD.masina) diffs.push(`Mašina: ${oldD.masina || '-'} ➡️ ${newD.masina}`);
            if (oldD.status !== newD.status) diffs.push(`Status: ${oldD.status} ➡️ ${newD.status}`);
            return diffs.length > 0 ? diffs.join(' | ') : 'Ažurirano (Bez ključnih promjena volumena)';
        }
        if (oldD && !newD) return 'Zapis obrisan iz baze.';
        return '-';
    };
  
    const checkQR = async (id) => {
        if(!id) return; setAuditLog('load'); const sid = id.toUpperCase().trim();
        const { data: auditData } = await supabase.from('audit_log').select('*').eq('zapis_id', sid).order('vrijeme', { ascending: true });
        const [t, pAll, djeca] = await Promise.all([ supabase.from('trupci').select('*').eq('id', sid).maybeSingle(), supabase.from('paketi').select('*').eq('paket_id', sid), supabase.from('paketi').select('*').ilike('ai_sirovina_ids', `%${sid}%`) ]);
        let ev = [];
        if (auditData && auditData.length > 0) { ev = auditData.map(a => ({ time: a.vrijeme, tip: a.akcija === 'DODAVANJE' ? 'KREIRANO' : a.akcija, msg: a.akcija === 'DODAVANJE' ? 'Kreiran Zapis' : a.akcija === 'IZMJENA' ? 'Ažurirani Podaci' : 'Obrisan Zapis', details: parseAuditDiff(a.stari_podaci, a.novi_podaci), user: a.korisnik || 'Sistem' })); } 
        if (t.data && (!auditData || auditData.filter(a => a.akcija === 'DODAVANJE').length === 0)) { ev.push({ time: t.data.datum_prijema, tip: 'ULAZ TRUPCA', msg: `Trupac primljen na lager.`, details: `V: ${t.data.zapremina}m³ | Ø${t.data.promjer}cm`, user: t.data.snimio_korisnik }); }
        if (pAll.data) { pAll.data.forEach(p => { if (p.paket_id === sid && (!auditData || auditData.filter(a => a.akcija === 'DODAVANJE').length === 0)) { ev.push({ time: `${p.datum_yyyy_mm}T${p.vrijeme_tekst||'00:00:00'}`, tip: 'KREIRAN PAKET', msg: `Kreirano na mašini ${p.masina || '-'}`, details: `${p.naziv_proizvoda} | Izlaz: ${p.kolicina_final}m³`, user: p.snimio_korisnik }); } }); }
        if (djeca.data && djeca.data.length > 0) { djeca.data.forEach(d => { ev.push({ time: `${d.datum_yyyy_mm}T${d.vrijeme_tekst||'00:00:00'}`, tip: 'UTROŠAK (DORADA)', msg: `Prerađeno u novi paket: ${d.paket_id}`, details: `Novi proizvod: ${d.naziv_proizvoda}`, user: d.snimio_korisnik }); }); }
        if (ev.length === 0) setAuditLog('none'); else { ev.sort((a,b) => new Date(a.time) - new Date(b.time)); setAuditLog(ev); }
    };
  
    const generisiAI = async () => {
        if(!apiKey) return alert("Unesite Google Gemini API ključ u modulu Podešavanja!");
        setIsLoadingAI(true); setAiOdgovor("Gemini analizira kompleksne podatke...");
        const ctx = { pilana_kpi: pilanaData.kpi, pilana_struktura: pilanaData.izlaz_struktura, pilana_radnici: pilanaData.ucinak_brentista, dorada_kpi: doradaData.kpi, dorada_operacije: doradaData.operacije, finansije_kpi: finansijeKPI, procesi_kpi: procesiKPI };
        const pitanje = aiUpit ? `Korisnik ima specifično pitanje: "${aiUpit}"` : `Napiši generalni menadžerski Executive Summary i daj preporuke.`;
        const prompt = `Ti si glavni Data Scientist u drvnoj industriji (ERP sistem). Analiziraj sirove podatke o prorezu, doradi i finansijama za period ${fmtBS(datumOd)} do ${fmtBS(datumDo)}. Evo podataka u JSON formatu: ${JSON.stringify(ctx)}. ${pitanje} Koristi Markdown, budi direktan, izdvoji uska grla i daj brojke (KPI) za usporedbu. Piši isključivo na bosanskom jeziku.`;
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({contents:[{parts:[{text:prompt}]}]}) });
            const d = await res.json(); 
            if (d.error) setAiOdgovor(`❌ Google API Greška: ${d.error.message}\n\nOvo znači da API ključ nije ispravan ili je prekoračen limit.`);
            else if(d.candidates) setAiOdgovor(d.candidates[0].content.parts[0].text);
            else setAiOdgovor(`❌ Neočekivan odgovor od servera: ${JSON.stringify(d)}`);
        } catch(e) { setAiOdgovor("Greška pri komunikaciji sa Google Gemini serverom (Mreža)."); }
        setIsLoadingAI(false);
    };

    // PDF Funkcije ostaju iste kao ranije
    const printPilanaPDF = () => { /* ... original logic ... */ };
    const printDoradaPDF = () => { /* ... original logic ... */ };
  
    return (
      <div className="min-h-screen bg-[#090e17] text-slate-300 font-sans p-4 md:p-8 pb-24">
        
        {/* GLOBALNI HEADER ZA ANALITIKU SVIH MODULA */}
        <div className="max-w-[1500px] mx-auto flex flex-col md:flex-row justify-between items-center bg-[#111827] p-4 rounded-2xl border border-slate-800 shadow-xl mb-6 gap-4">
          <div className="flex items-center gap-6 overflow-x-auto">
            <h1 className="text-white font-black text-2xl tracking-tighter hidden md:block">TTM<span className="text-[#10b981]">.ERP</span></h1>
            <nav className="flex gap-2 bg-[#090e17] p-1.5 rounded-xl border border-slate-800 overflow-x-auto whitespace-nowrap">
              {['pilana', 'dorada', 'finansije', 'procesi', 'ai chat', 'qr audit'].map(t => (
                <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase transition-all ${activeTab === t ? 'bg-[#10b981] text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-slate-800/50'}`}>{t}</button>
              ))}
            </nav>
          </div>
  
          <div className="flex flex-col md:flex-row items-center gap-4">
            <Flex className="bg-[#090e17] p-1.5 rounded-xl border border-slate-800 gap-1 w-full md:w-auto justify-center">
              <button onClick={() => { setTipDatuma('dan'); setIsPeriodic(false); setDatumDo(datumOd); }} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${!isPeriodic?'bg-blue-600 text-white':'text-slate-500 hover:text-white'}`}>Dnevni</button>
              <button onClick={() => { setTipDatuma('period'); setIsPeriodic(true); }} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${isPeriodic?'bg-blue-600 text-white':'text-slate-500 hover:text-white'}`}>Period</button>
            </Flex>
  
            <Flex className="bg-[#090e17] p-1.5 rounded-xl border border-slate-800 gap-2 w-full md:w-auto justify-center flex-wrap">
              {!isPeriodic ? (
                <>
                  <button onClick={()=>shiftDate(-1)} className="w-8 h-8 bg-slate-800 rounded hover:bg-blue-600 font-black text-white flex items-center justify-center"><ChevronLeft size={16}/></button>
                  <div className="relative flex items-center justify-center bg-slate-900 px-4 py-1.5 rounded border border-slate-700 w-32 h-8 hover:border-blue-500 cursor-pointer">
                    <span className="text-blue-400 font-bold text-sm tracking-widest">{fmtBS(datumOd)}</span>
                    <input type="date" value={datumOd} onChange={e=>{setDatumOd(e.target.value); setDatumDo(e.target.value);}} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                  </div>
                  <button onClick={()=>shiftDate(1)} className="w-8 h-8 bg-slate-800 rounded hover:bg-blue-600 font-black text-white flex items-center justify-center"><ChevronRight size={16}/></button>
                </>
              ) : (
                <>
                  <div className="relative flex items-center justify-center bg-slate-900 px-3 py-1.5 rounded border border-slate-700 w-28 h-8 hover:border-blue-500 cursor-pointer"><span className="text-blue-400 font-bold text-xs tracking-widest">{fmtBS(datumOd)}</span><input type="date" value={datumOd} onChange={e=>setDatumOd(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" /></div>
                  <span className="text-slate-600 font-black">-</span>
                  <div className="relative flex items-center justify-center bg-slate-900 px-3 py-1.5 rounded border border-slate-700 w-28 h-8 hover:border-blue-500 cursor-pointer"><span className="text-blue-400 font-bold text-xs tracking-widest">{fmtBS(datumDo)}</span><input type="date" value={datumDo} onChange={e=>setDatumDo(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" /></div>
                  <div className="flex gap-1 ml-2 border-l border-slate-800 pl-2">
                    <button onClick={()=>setBrziDatum('7d')} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[9px] font-bold uppercase text-slate-300">7D</button>
                    <button onClick={()=>setBrziDatum('mjesec')} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[9px] font-bold uppercase text-slate-300">Ovaj Mj</button>
                  </div>
                </>
              )}
            </Flex>
            <button onClick={onExit} className="bg-slate-800 text-red-400 hover:bg-red-500 hover:text-white px-5 h-10 rounded-xl text-[10px] font-black uppercase border border-slate-800 transition-all shadow-md">Izlaz</button>
          </div>
        </div>
  
        {(activeTab === 'pilana' || activeTab === 'dorada') && (
            <div className="max-w-[1500px] mx-auto flex gap-4 mb-6">
               <div className="flex flex-col">
                   <span className="text-[10px] text-slate-500 uppercase font-bold ml-1 mb-1">Lokacija / Mjesto</span>
                   <select value={filterMjesto} onChange={e => setFilterMjesto(e.target.value)} className="bg-[#111827] text-white p-3 rounded-xl text-xs font-bold border border-slate-800 outline-none focus:border-blue-500">
                       <option value="SVE">Sva Mjesta</option><option value="SREBRENIK">Srebrenik</option><option value="MAGACIN A">Magacin A</option>
                   </select>
               </div>
               <div className="flex flex-col">
                   <span className="text-[10px] text-slate-500 uppercase font-bold ml-1 mb-1">Smjena (Vrijeme)</span>
                   <select value={filterSmjena} onChange={e => setFilterSmjena(e.target.value)} className="bg-[#111827] text-white p-3 rounded-xl text-xs font-bold border border-slate-800 outline-none focus:border-blue-500">
                       <option value="SVE">Sve Smjene (00-24h)</option>
                       <option value="1">I Smjena (07:00 - 15:00)</option>
                       <option value="2">II Smjena (15:00 - 23:00)</option>
                       <option value="3">III Smjena (23:00 - 07:00)</option>
                   </select>
               </div>
            </div>
        )}
  
        {loading ? ( <div className="text-center p-20 animate-pulse text-[#10b981] font-bold tracking-widest uppercase">Analiziram Bazu Podataka...</div> ) : (
          <div className="max-w-[1500px] mx-auto space-y-6">
            
            {/* 🪚 TAB 1: PILANA (STARI IZGLED) */}
            {activeTab === 'pilana' && (
              <div className="animate-in fade-in space-y-6">
                <Flex className="justify-between items-end mb-2">
                  <div><h2 className="text-2xl font-black text-white uppercase tracking-tight">Pilana & Prorez</h2><p className="text-xs text-slate-500 uppercase mt-1">Svi paketi bez ulazne sirovine</p></div>
                  <Button icon={FileText} className="bg-[#3b82f6] hover:bg-blue-500 border-none shadow-[0_0_15px_rgba(59,130,246,0.3)]" onClick={printPilanaPDF}>Štampaj Dnevni Izvještaj</Button>
                </Flex>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-[#111827] border-slate-800 p-5 rounded-2xl border-l-4 border-l-[#3b82f6]"><Text className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-1">Ulaz Trupaca (m³)</Text><Metric className="text-white font-black">{pilanaData.kpi.ulaz_m3}</Metric></Card>
                  <Card className="bg-[#111827] border-slate-800 p-5 rounded-2xl"><Text className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-1">Komada Trupaca</Text><Metric className="text-white font-black">{pilanaData.kpi.ulaz_kom}</Metric></Card>
                  <Card className="bg-[#111827] border-slate-800 p-5 rounded-2xl border-l-4 border-l-[#10b981]"><Text className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-1">Gotova Građa (m³)</Text><Metric className="text-white font-black">{pilanaData.kpi.izlaz_m3}</Metric></Card>
                  <Card className="bg-[#111827] border-slate-800 p-5 rounded-2xl border-l-4 border-l-slate-500"><Text className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-1">Iskorištenje (Yield)</Text><Metric className="text-white font-black">{pilanaData.kpi.yield_proc} %</Metric></Card>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="bg-[#111827] border-slate-800 p-6 rounded-2xl h-[340px] flex flex-col">
                    <Flex className="mb-4"><div><Text className="text-white font-bold uppercase tracking-tight">Distribucija</Text><Text className="text-[10px] text-slate-500">% učešća proizvoda</Text></div><Badge color="emerald" size="xl" className="font-black">{pilanaData.kpi.izlaz_m3} m³</Badge></Flex>
                    <div className="flex-1 relative">
                      {pilanaData.izlaz_struktura.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pilanaData.izlaz_struktura} innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="m3" stroke="none">{pilanaData.izlaz_struktura.map((entry, index) => ( <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} /> ))}</Pie><RechartsTooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff'}} itemStyle={{color:'#fff', fontWeight:'bold'}} formatter={(val) => `${val} m³`} /></PieChart></ResponsiveContainer>
                      ) : (<div className="flex h-full items-center justify-center text-slate-600 text-xs font-bold border-2 border-dashed border-slate-800 rounded-xl p-4 text-center">Nema proreza.</div>)}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-2xl font-black text-white">{pilanaData.kpi.yield_proc}%</span><span className="text-[9px] text-slate-500 font-bold uppercase">Yield</span></div>
                    </div>
                  </Card>
                  <Card className="bg-[#111827] border-slate-800 p-6 rounded-2xl h-[340px] flex flex-col">
                    <Text className="text-white font-bold uppercase tracking-tight mb-1">Učinak po Brentisti</Text><Text className="text-[10px] text-slate-500 mb-4">Ukupno m³ utrošenih trupaca po radniku</Text>
                    <div className="flex-1">
                        {pilanaData.ucinak_brentista.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%"><BarChart data={pilanaData.ucinak_brentista} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" /><XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} /><YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} width={80} /><RechartsTooltip cursor={{fill: '#1e293b'}} contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff'}} formatter={(val) => `${val} m³`}/><Bar dataKey="m3" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={20} /></BarChart></ResponsiveContainer>
                        ) : (<div className="flex h-full items-center justify-center text-slate-600 text-xs font-bold border-2 border-dashed border-slate-800 rounded-xl p-4 text-center">Nema evidentiranih operatera.</div>)}
                    </div>
                  </Card>
                  <Card className="bg-[#111827] border-slate-800 p-6 rounded-2xl h-[340px] flex flex-col">
                    <Flex className="mb-4">
                        <div><Text className="text-white font-bold uppercase tracking-tight">Trend Proreza</Text><Text className="text-[10px] text-slate-500">Poređenje učinka zadnjih 30 dana</Text></div>
                        <div className="flex flex-col items-end gap-1"><Badge color={pilanaData.kpi.trend_7d_proc >= 0 ? 'emerald' : 'red'}>{pilanaData.kpi.trend_7d_proc >= 0 ? '▲' : '▼'} {Math.abs(pilanaData.kpi.trend_7d_proc)}% vs 7D</Badge><Badge color={pilanaData.kpi.trend_30d_proc >= 0 ? 'emerald' : 'red'}>{pilanaData.kpi.trend_30d_proc >= 0 ? '▲' : '▼'} {Math.abs(pilanaData.kpi.trend_30d_proc)}% vs 30D</Badge></div>
                    </Flex>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%"><AreaChart data={pilanaData.trend_30d} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" /><XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} /><YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} /><RechartsTooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff'}} formatter={(val) => `${val} m³`}/><Area type="monotone" dataKey="Proizvodnja" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={3} /></AreaChart></ResponsiveContainer>
                    </div>
                  </Card>
                </div>
              </div>
            )}
  
            {/* 🔄 TAB 2: DORADA (STARI IZGLED) */}
            {activeTab === 'dorada' && (
              <div className="animate-in fade-in space-y-6">
                <Flex className="justify-between items-end mb-2">
                  <div><h2 className="text-2xl font-black text-white uppercase tracking-tight">Dorada (Traceability)</h2><p className="text-xs text-slate-500 uppercase mt-1">Svi paketi u koje je dodata ulazna sirovina</p></div>
                  <Button icon={FileText} className="bg-[#8b5cf6] hover:bg-purple-500 border-none shadow-[0_0_15px_rgba(139,92,246,0.3)]" onClick={printDoradaPDF}>Štampaj Analizu Dorade</Button>
                </Flex>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-[#111827] border-slate-800 p-5 rounded-2xl border-l-4 border-l-slate-500"><Text className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-1">Utrošena Sirovina</Text><Metric className="text-white font-black">{doradaData.kpi.ulaz_m3} <span className="text-sm">m³</span></Metric></Card>
                  <Card className="bg-[#111827] border-slate-800 p-5 rounded-2xl border-l-4 border-l-[#8b5cf6]"><Text className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-1">Finalna Roba</Text><Metric className="text-purple-400 font-black">{doradaData.kpi.izlaz_m3} <span className="text-sm">m³</span></Metric></Card>
                  <Card className="bg-[#111827] border-slate-800 p-5 rounded-2xl border-l-4 border-l-[#10b981]"><Text className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-1">Iskoristivost (Yield)</Text><Metric className="text-emerald-400 font-black">{doradaData.kpi.yield_proc}%</Metric></Card>
                  <Card className="bg-[#111827] border-slate-800 p-5 rounded-2xl border-l-4 border-l-red-500"><Text className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-1">Gubitak / Kalo</Text><Metric className="text-red-400 font-black">{doradaData.kpi.kalo_m3} <span className="text-sm">m³</span></Metric></Card>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[340px]">
                   <Card className="bg-[#111827] border-slate-800 p-6 rounded-2xl h-full flex flex-col">
                      <Text className="text-white font-bold uppercase tracking-tight mb-1">Analiza Operacija</Text>
                      <Text className="text-[10px] text-slate-500 mb-4">m³ po dodanoj operaciji</Text>
                      <div className="flex-1">
                        {doradaData.operacije.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%"><BarChart data={doradaData.operacije} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" /><XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} /><YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} width={80} /><RechartsTooltip cursor={{fill: '#1e293b'}} contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff'}} formatter={(val) => `${val} m³`}/><Bar dataKey="m3" fill="#8b5cf6" radius={[0, 4, 4, 0]} maxBarSize={20} /></BarChart></ResponsiveContainer>
                        ) : (<div className="flex h-full items-center justify-center text-slate-600 text-xs font-bold border-2 border-dashed border-slate-800 rounded-xl p-4 text-center">Nema označenih operacija.</div>)}
                      </div>
                   </Card>
                   <Card className="bg-[#111827] border-slate-800 p-6 rounded-2xl h-full flex flex-col lg:col-span-2">
                      <Flex className="mb-4">
                          <div><Text className="text-white font-bold uppercase tracking-tight">Trend Učinka Dorade</Text><Text className="text-[10px] text-slate-500">Zadnjih 7 dana</Text></div>
                          <Badge color={doradaData.kpi.trend_7d_proc >= 0 ? 'emerald' : 'red'}>{doradaData.kpi.trend_7d_proc >= 0 ? '▲' : '▼'} {Math.abs(doradaData.kpi.trend_7d_proc)}% vs 7D</Badge>
                      </Flex>
                      <div className="flex-1">
                          <ResponsiveContainer width="100%" height="100%"><AreaChart data={doradaData.trend_7d} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" /><XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} /><YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} /><RechartsTooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff'}} formatter={(val) => `${val} m³`}/><Area type="monotone" dataKey="Dorada" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} strokeWidth={3} /></AreaChart></ResponsiveContainer>
                      </div>
                   </Card>
                </div>
              </div>
            )}

            {/* 💰 NOVI TAB: FINANSIJE */}
            {activeTab === 'finansije' && (
                <div className="animate-in fade-in space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="bg-[#111827] border-slate-800 p-6 rounded-[2rem] border-t-4 border-t-blue-500 shadow-2xl relative overflow-hidden">
                            <div className="absolute right-[-10px] top-[-10px] text-6xl opacity-5">💰</div>
                            <Text className="text-[10px] uppercase text-blue-400 font-black tracking-widest mb-2">Ukupno Fakturisano (Sa PDV)</Text>
                            <Metric className="text-white font-black text-4xl">{finansijeKPI.ukupnoFakturisano.toFixed(2)}</Metric>
                        </Card>
                        <Card className="bg-[#111827] border-slate-800 p-6 rounded-[2rem] border-t-4 border-t-emerald-500 shadow-2xl">
                            <Text className="text-[10px] uppercase text-emerald-400 font-black tracking-widest mb-2">Keš Naplata (Blagajna)</Text>
                            <Metric className="text-white font-black text-4xl">{finansijeKPI.naplacenoGotovina.toFixed(2)}</Metric>
                        </Card>
                        <Card className="bg-[#111827] border-slate-800 p-6 rounded-[2rem] border-t-4 border-t-purple-500 shadow-2xl">
                            <Text className="text-[10px] uppercase text-purple-400 font-black tracking-widest mb-2">Virman Naplata (Banka)</Text>
                            <Metric className="text-white font-black text-4xl">{finansijeKPI.naplacenoVirman.toFixed(2)}</Metric>
                        </Card>
                        <Card className="bg-[#111827] border-slate-800 p-6 rounded-[2rem] border-t-4 border-t-red-500 shadow-2xl">
                            <Text className="text-[10px] uppercase text-red-400 font-black tracking-widest mb-2">Nenaplaćena Dugovanja</Text>
                            <Metric className="text-white font-black text-4xl">{finansijeKPI.nenaplacenoDug.toFixed(2)}</Metric>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="bg-[#111827] border-slate-800 p-8 rounded-[2.5rem] h-[400px] flex flex-col shadow-2xl col-span-2">
                            <div><Text className="text-white font-black uppercase tracking-widest text-sm mb-1">Dinamika Finansija</Text><Text className="text-[10px] text-slate-500 uppercase font-bold">Fakturisano vs Stvarno Naplaćeno (Trend)</Text></div>
                            <div className="flex-1 mt-6">
                                {trendFinansija.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={trendFinansija} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorFakt" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                                                <linearGradient id="colorNapl" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                            <XAxis dataKey="datum" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                            <RechartsTooltip contentStyle={{backgroundColor: '#090e17', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff'}} formatter={(val) => `${val.toFixed(2)} KM`}/>
                                            <Area type="monotone" dataKey="Fakturisano" stroke="#3b82f6" fill="url(#colorFakt)" strokeWidth={4} />
                                            <Area type="monotone" dataKey="Naplaćeno" stroke="#10b981" fill="url(#colorNapl)" strokeWidth={4} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (<div className="h-full flex items-center justify-center text-slate-600 font-bold border-2 border-dashed border-slate-800 rounded-2xl">Nema podataka za prikaz</div>)}
                            </div>
                        </Card>
                        <Card className="bg-[#111827] border-slate-800 p-8 rounded-[2.5rem] h-[400px] flex flex-col shadow-2xl">
                            <div><Text className="text-white font-black uppercase tracking-widest text-sm mb-1">Struktura Izvršenja</Text><Text className="text-[10px] text-slate-500 uppercase font-bold">Odnos uplaćenog novca i duga</Text></div>
                            <div className="flex-1 relative mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={strukturaNaplate} innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none">
                                            {strukturaNaplate.map((entry, index) => ( <Cell key={`cell-${index}`} fill={entry.name.includes('Gotovina') ? '#10b981' : entry.name.includes('Virman') ? '#8b5cf6' : '#ef4444'} /> ))}
                                        </Pie>
                                        <RechartsTooltip contentStyle={{backgroundColor: '#090e17', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff'}} formatter={(val) => `${val.toFixed(2)} KM`} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-2xl font-black text-white">{((finansijeKPI.naplacenoGotovina + finansijeKPI.naplacenoVirman) / (finansijeKPI.ukupnoFakturisano || 1) * 100).toFixed(0)}%</span>
                                    <span className="text-[8px] text-slate-500 font-black uppercase">Naplativo</span>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="bg-[#111827] border-slate-800 p-8 rounded-[2.5rem] shadow-2xl">
                            <h3 className="text-red-500 font-black uppercase text-xs mb-4 border-b border-slate-800 pb-3">⚠️ Top 5 Dužnika (Crvena Zona)</h3>
                            <div className="space-y-3">
                                {topDuznici.length === 0 && <p className="text-emerald-500 font-bold text-xs text-center py-4">Nema evidentiranih dugovanja!</p>}
                                {topDuznici.map((d, i) => (
                                    <div key={i} className="flex justify-between items-center bg-[#090e17] p-4 rounded-xl border border-red-500/20">
                                        <div className="flex items-center gap-3">
                                            <span className="bg-red-900/30 text-red-500 w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px]">{i+1}</span>
                                            <span className="text-white font-bold text-sm">{d.name}</span>
                                        </div>
                                        <span className="text-red-400 font-black text-lg">{d.dug.toFixed(2)} KM</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                        <Card className="bg-[#111827] border-slate-800 p-8 rounded-[2.5rem] shadow-2xl border-l-4 border-l-purple-500">
                            <h3 className="text-purple-400 font-black uppercase text-xs mb-4 border-b border-slate-800 pb-3">🏦 PDV Obaveza za period</h3>
                            <div className="flex flex-col items-center justify-center h-40 bg-[#090e17] rounded-3xl border border-slate-800">
                                <p className="text-slate-500 uppercase font-black text-[10px] mb-2">Ukupno obračunati PDV (17%)</p>
                                <p className="text-5xl text-white font-black">{finansijeKPI.ocekivaniPDV.toFixed(2)} <span className="text-xl text-purple-500">KM</span></p>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* ⚙️ NOVI TAB: PROCESI (LIJEVAK) */}
            {activeTab === 'procesi' && (
                <div className="animate-in fade-in space-y-6">
                    <div className="bg-[#111827] p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl text-center">
                        <h3 className="text-purple-500 font-black uppercase text-xs mb-8">Lijevak Ciklusa Proizvodnje (Broj dokumenata u periodu)</h3>
                        <div className="max-w-4xl mx-auto">
                            {funnelData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={350}>
                                    <BarChart data={funnelData} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#fff', fontSize: 11, fontWeight: 'bold'}} width={150} />
                                        <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: '#090e17', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff'}} />
                                        <Bar dataKey="vrijednost" radius={[0, 10, 10, 0]} barSize={30}>
                                            {funnelData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={entry.fill} /> ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <p>Nema podataka</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="bg-[#111827] border-slate-800 p-6 rounded-[2rem] text-center shadow-2xl">
                            <Text className="text-[10px] uppercase text-pink-500 font-black tracking-widest mb-2">Ponuda ➜ Radni Nalog</Text>
                            <p className="text-5xl font-black text-white">{procesiKPI.avgDaniPonRn} <span className="text-sm text-slate-500">dana</span></p>
                            <p className="text-[9px] text-slate-500 mt-3 font-bold uppercase">Prosječno vrijeme čekanja odluke</p>
                        </Card>
                        <Card className="bg-[#111827] border-slate-800 p-6 rounded-[2rem] text-center shadow-2xl border-2 border-red-500/20 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full bg-red-500 text-white text-[8px] uppercase font-black py-0.5 tracking-widest">Usko grlo sistema</div>
                            <Text className="text-[10px] uppercase text-purple-500 font-black tracking-widest mb-2 mt-4">Nalog ➜ Otpremnica</Text>
                            <p className="text-5xl font-black text-white">{procesiKPI.avgDaniRnOtp} <span className="text-sm text-slate-500">dana</span></p>
                            <p className="text-[9px] text-slate-500 mt-3 font-bold uppercase">Prosječno vrijeme proizvodnje</p>
                        </Card>
                        <Card className="bg-[#111827] border-slate-800 p-6 rounded-[2rem] text-center shadow-2xl">
                            <Text className="text-[10px] uppercase text-orange-500 font-black tracking-widest mb-2">Otpremnica ➜ Račun</Text>
                            <p className="text-5xl font-black text-white">{procesiKPI.avgDaniOtpRac} <span className="text-sm text-slate-500">dana</span></p>
                            <p className="text-[9px] text-slate-500 mt-3 font-bold uppercase">Administrativno vrijeme fakturisanja</p>
                        </Card>
                    </div>
                </div>
            )}
  
            {/* 🤖 TAB 3: AI DATA SCIENTIST (STARI IZGLED, NOVI PODACI) */}
            {activeTab === 'ai chat' && (
              <div className="animate-in zoom-in-95 max-w-4xl mx-auto space-y-6">
                <Card className="bg-[#111827] p-8 rounded-3xl border border-slate-800 shadow-2xl text-center">
                  <Bot size={48} className="mx-auto text-blue-500 mb-4" />
                  <Text className="text-2xl font-black text-white uppercase tracking-tighter mb-2">AI Data Scientist</Text>
                  <Text className="text-xs text-slate-500 uppercase mb-8">Prirodni jezik za složene izvještaje (Powered by Gemini Flash)</Text>
                  
                  <textarea 
                      value={aiUpit} 
                      onChange={e => setAiUpit(e.target.value)} 
                      placeholder="Pitaj AI šta god želiš (npr. 'Analiziraj mi iskoristivost dorade i reci gdje najviše gubimo?')"
                      className="w-full bg-[#0f172a] border border-slate-700 p-4 rounded-2xl text-white outline-none focus:border-blue-500 mb-4 text-sm resize-none h-24"
                  />
                  
                  <Button size="xl" className="bg-blue-600 hover:bg-blue-500 border-none w-full md:w-auto" onClick={generisiAI} loading={isLoadingAI}>
                    ⚡ {aiUpit ? 'Odgovori na pitanje iznad' : 'Generiši generalni Executive Summary'}
                  </Button>
                </Card>
  
                {aiOdgovor && (
                  <Card id="ai-report-print" className="bg-[#0f172a] border border-blue-900/50 rounded-3xl p-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                    <Flex className="justify-between items-start mb-6">
                        <div>
                            <Text className="text-blue-400 font-bold uppercase tracking-widest text-xs">AI Izvještaj Spreman</Text>
                            <Text className="text-slate-500 text-[10px] mt-1">{aiUpit || 'Generalna analiza'}</Text>
                        </div>
                        <Button size="xs" icon={FileText} variant="secondary" onClick={() => {
                            const w = window.open('','_blank');
                            w.document.write('<html><head><title>AI Izveštaj</title><style>body{font-family:sans-serif; padding:40px; color:#1e293b; line-height:1.6;} h1{color:#1e3a8a;} pre{background:#f1f5f9; padding:10px; border-radius:5px;}</style></head><body><h1>AI Executive Summary</h1><div style="white-space:pre-wrap;">' + aiOdgovor + '</div><script>window.onload=function(){window.print();}</script></body></html>');
                            w.document.close();
                        }}>Print u PDF</Button>
                    </Flex>
                    <div className="prose prose-invert prose-sm max-w-none text-slate-300 font-mono leading-loose whitespace-pre-wrap">
                       {aiOdgovor}
                    </div>
                  </Card>
                )}
              </div>
            )}
  
            {/* 🔍 TAB 4: DEEP QR AUDIT (STARI IZGLED) */}
            {activeTab === 'qr audit' && (
              <div className="animate-in zoom-in-95 max-w-3xl mx-auto space-y-6">
                <Card className="bg-[#111827] p-8 rounded-3xl border border-slate-800 shadow-2xl text-center">
                  <Search size={48} className="mx-auto text-emerald-500 mb-4" />
                  <Text className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Deep QR Audit</Text>
                  <Text className="text-xs text-slate-500 uppercase mb-8">Skeniraj barkod za apsolutnu vremensku historiju paketa</Text>
                  
                  <Flex className="gap-2 bg-[#090e17] p-2 rounded-2xl border border-slate-800 shadow-inner">
                    <input value={searchId} onChange={e => setSearchId(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && checkQR(searchId)} placeholder="Skeniraj barkod (npr. 12345)..." className="flex-1 bg-transparent p-4 text-center text-xl font-black text-emerald-400 outline-none" />
                    <Button size="lg" color="emerald" onClick={() => checkQR(searchId)}>Istraži</Button>
                  </Flex>
                </Card>
  
                {auditLog === 'load' && <div className="text-center p-10 animate-pulse text-emerald-500 font-black tracking-widest uppercase">Kopam po bazi podataka...</div>}
                {auditLog === 'none' && <div className="text-center p-10 bg-red-900/20 border border-red-900/30 rounded-xl text-red-500 font-black">NIŠTA NIJE PRONAĐENO U BAZI ZA OVAJ BARKOD.</div>}
                
                {Array.isArray(auditLog) && (
                  <div className="space-y-0 mt-8 relative before:absolute before:inset-0 before:ml-[19px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-1 before:bg-gradient-to-b before:from-emerald-500 before:to-slate-800 pl-2 md:pl-0">
                    {auditLog.map((ev, i) => (
                      <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active pb-8">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#090e17] bg-slate-800 text-white font-black text-xs shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-xl z-10 ${ev.tip.includes('ULAZ') || ev.tip.includes('KREIRANO') ? 'text-emerald-400 border-emerald-500/30' : ev.tip.includes('BRISANJE') ? 'text-red-400 border-red-500/30' : 'text-blue-400 border-blue-500/30'}`}>
                            {i+1}
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-[#111827] p-5 rounded-2xl border border-slate-700 shadow-xl hover:border-emerald-500/50 transition-all">
                          <Flex className="mb-3">
                              <Badge color={ev.tip.includes('ULAZ') || ev.tip.includes('KREIRANO') ? 'emerald' : ev.tip.includes('BRISANJE') ? 'red' : 'blue'}>{ev.tip}</Badge>
                              <span className="text-[10px] font-mono text-slate-500 bg-[#090e17] px-2 py-1 rounded border border-slate-800">{new Date(ev.time).toLocaleString('bs-BA')}</span>
                          </Flex>
                          <h4 className="text-white font-bold text-sm uppercase">{ev.msg}</h4>
                          {ev.details && <div className="text-[10px] text-slate-400 mt-2 p-2 bg-[#090e17] rounded-lg border border-slate-800 font-mono whitespace-pre-wrap">{ev.details}</div>}
                          <div className="mt-3 text-[9px] uppercase font-black text-slate-600 border-t border-slate-800 pt-2">Snimio radnik: <span className="text-slate-300">{ev.user || 'Sistem'}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
  
          </div>
        )}
      </div>
    );
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
// ============================================================================
// MODUL: DORADA (SA DETALJIMA ULAZNOG PAKETA I RAZDUŽIVANJEM)
// ============================================================================
// ============================================================================
// MODUL: DORADA (BULLETPROOF ULAZNI PAKETI - PROVJERA KOLIČINE)
// ============================================================================
// ============================================================================
// MODUL: DORADA (BULLETPROOF ULAZNI PAKETI - PROVJERA KOLIČINE I NAPREDNO RAZDUŽIVANJE)
// ============================================================================
// ============================================================================
// MODUL: DORADA (BULLETPROOF ULAZNI PAKETI - PROVJERA KOLIČINE I PRERAČUN JEDINICA)
// ============================================================================
// ============================================================================
// MODUL: DORADA (BULLETPROOF ULAZNI PAKETI - PROVJERA KOLIČINE I PRERAČUN JEDINICA)
// ============================================================================
function DoradaModule({ user, header, setHeader, onExit }) {
    const [ulazScan, setUlazScan] = useState('');
    const [izlazScan, setIzlazScan] = useState('');
    const [radniNalog, setRadniNalog] = useState('');
    const [rnStavke, setRnStavke] = useState([]);
    
    const [katalog, setKatalog] = useState([]);
    const [aktivniNalozi, setAktivniNalozi] = useState([]);

    const [activeUlazIds, setActiveUlazIds] = useState([]);
    const [ulazneStavke, setUlazneStavke] = useState([]); 
    
    // STANJA ZA NAPREDNI MODAL ZA RAZDUŽIVANJE
    const [razduziZapis, setRazduziZapis] = useState(null);
    const [razduziMod, setRazduziMod] = useState('potroseno'); // 'potroseno' ili 'ostalo'
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
        
        const { data, error } = await supabase.from('paketi').select('*').eq('paket_id', id).gt('kolicina_final', 0);
        
        if (error) {
            alert(`❌ GREŠKA BAZE PRI UČITAVANJU: ${error.message}`);
            setUlazScan('');
            return;
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

    // PAMETNO RAZDUŽIVANJE (SA PRERAČUNAVANJEM)
    const potvrdiRazduzivanje = async () => {
        if (!razduziKol || isNaN(razduziKol)) return alert("Unesite ispravnu količinu (broj)!");
        
        const unos = parseFloat(razduziKol.toString().replace(',', '.'));
        if (unos < 0) return alert("Količina ne može biti negativna!");

        // Preračunavanje unosa u m³
        const v = parseFloat(razduziZapis.debljina) || 1;
        const s = parseFloat(razduziZapis.sirina) || 1;
        const d = parseFloat(razduziZapis.duzina) || 1;

        let unosM3 = unos;
        if (razduziJm === 'kom') unosM3 = unos * (v/100) * (s/100) * (d/100);
        else if (razduziJm === 'm2') unosM3 = unos * (v/100);
        else if (razduziJm === 'm1') unosM3 = unos * (v/100) * (s/100);

        let preostalo = 0;
        const trenutnoNaStanju = parseFloat(razduziZapis.kolicina_final);

        if (razduziMod === 'potroseno') {
            preostalo = trenutnoNaStanju - unosM3;
        } else if (razduziMod === 'ostalo') {
            preostalo = unosM3;
        }

        if (preostalo < 0) preostalo = 0;
        const novaKol = preostalo <= 0.001 ? 0 : preostalo;

        if (novaKol === 0) {
            if(!window.confirm(`Stanje ove stavke će pasti na NULU i biće potpuno razdužena sa ulaza.\nDa li ste sigurni?`)) return;
        }

        const { error } = await supabase.from('paketi').update({ kolicina_final: novaKol.toFixed(3) }).eq('id', razduziZapis.id);
        
        if (error) return alert("Greška pri razduživanju baze: " + error.message);

        const { data } = await supabase.from('paketi').select('*').in('paket_id', activeUlazIds).gt('kolicina_final', 0);
        setUlazneStavke(data || []);
        
        setRazduziZapis(null);
        setRazduziKol('');
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
                snimio_korisnik: user?.ime_prezime || 'Nepoznat',
                oznake: odabraneOznake.length > 0 ? odabraneOznake : activeEditItem.oznake,
                broj_veze: radniNalog || activeEditItem.broj_veze // Fiksirano!
            }).eq('id', activeEditItem.id);
            if (error) return alert("❌ GREŠKA PRI AŽURIRANJU PAKETA: " + error.message);
        } else {
            const { error } = await supabase.from('paketi').insert([{ 
                paket_id: selectedIzlazId, naziv_proizvoda: form.naziv, debljina: form.debljina, sirina: form.sirina, duzina: form.duzina, 
                kolicina_ulaz: form.kolicina_ulaz, jm: form.jm, kolicina_final: qtyZaPaket, 
                mjesto: header.mjesto, masina: header.masina, snimio_korisnik: user?.ime_prezime || 'Nepoznat', vrijeme_tekst: timeNow, datum_yyyy_mm: header.datum,
                ai_sirovina_ids: activeUlazIds,
                oznake: odabraneOznake,
                broj_veze: radniNalog // Fiksirano!
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
            
            // Pitanje za automatski print
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

    // Live kalkulacija za ispis preračunatih kubika u modalu
    const livePreracunM3 = useMemo(() => {
        if(!razduziKol || isNaN(razduziKol) || !razduziZapis) return 0;
        const unos = parseFloat(razduziKol);
        const v = parseFloat(razduziZapis.debljina) || 1;
        const s = parseFloat(razduziZapis.sirina) || 1;
        const d = parseFloat(razduziZapis.duzina) || 1;
        
        if (razduziJm === 'kom') return unos * (v/100) * (s/100) * (d/100);
        if (razduziJm === 'm2') return unos * (v/100);
        if (razduziJm === 'm1') return unos * (v/100) * (s/100);
        return unos;
    }, [razduziKol, razduziJm, razduziZapis]);
    
    return (
        <div className="p-4 max-w-xl mx-auto space-y-6">
            
            {/* NAPREDNI MODAL ZA RAZDUŽIVANJE SA JEDINICOM MJERE */}
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
                            <label className="text-[10px] text-slate-400 uppercase font-black mb-2 block text-center">
                                {razduziMod === 'potroseno' ? 'Unesi količinu i odaberi mjeru' : 'Unesi količinu i odaberi mjeru'}
                            </label>
                            <div className="flex gap-2 w-full items-center">
                                <input 
                                    type="number" 
                                    value={razduziKol} 
                                    onChange={e => setRazduziKol(e.target.value)} 
                                    placeholder="0" 
                                    className={`flex-1 min-w-0 p-4 bg-[#0f172a] border-2 rounded-2xl text-center text-2xl text-white font-black outline-none transition-all shadow-inner ${razduziMod === 'potroseno' ? 'border-red-500/50 focus:border-red-400 text-red-400' : 'border-blue-500/50 focus:border-blue-400 text-blue-400'}`} 
                                />
                                <select value={razduziJm} onChange={e => setRazduziJm(e.target.value)} className="w-24 shrink-0 p-4 bg-slate-800 rounded-2xl text-lg text-white font-black outline-none border border-slate-700 focus:border-emerald-500">
                                    <option value="kom">kom</option>
                                    <option value="m3">m³</option>
                                    <option value="m2">m²</option>
                                    <option value="m1">m1</option>
                                </select>
                            </div>
                            
                            {/* Ispis preračuna uživo */}
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

<MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-amber-500" user={user} modulIme="dorada" />
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
                            {id} <button onClick={() => ukloniIzAktivnihUlaza(id)} className="hover:text-white">✕</button>
                        </div>
                    ))}
                </div>

                {ulazneStavke.length > 0 && (
                    <div className="bg-slate-900 border border-red-500/30 p-4 rounded-2xl animate-in zoom-in-95">
                        <h4 className="text-[10px] text-slate-500 uppercase font-black mb-3">Sadržaj ulaznih paketa (Klikni za razduživanje):</h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                            {ulazneStavke.map(s => (
                                <div key={s.id} onClick={() => { setRazduziZapis(s); setRazduziMod('potroseno'); setRazduziKol(''); setRazduziJm('kom'); }} className="p-3 bg-slate-800 border border-slate-700 rounded-xl flex justify-between items-center cursor-pointer hover:border-red-500 transition-all shadow-lg">
                                    <div>
                                        <p className="text-white text-xs font-black">{s.naziv_proizvoda}</p>
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
                        <div className="flex gap-2 w-full items-center">
                            <input type="number" value={form.kolicina_ulaz} onKeyDown={e => {if(e.key==='Enter') saveIzlaz()}} onChange={e => setForm({...form, kolicina_ulaz: e.target.value})} className="flex-1 min-w-0 p-4 bg-[#0f172a] border-2 border-slate-700 rounded-2xl text-xl text-center text-white font-black outline-none focus:border-emerald-500" placeholder="Količina..." />
                            <select value={form.jm} onChange={e => setForm({...form, jm: e.target.value})} className="w-24 shrink-0 bg-slate-800 p-4 rounded-2xl text-white font-black outline-none border border-slate-700 focus:border-emerald-500">
                                <option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option>
                            </select>
                        </div>

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
        
        {/* OVDJE JE DODANO DUGME ZA PRINT */}
        <div className="flex flex-col items-end gap-2">
            <div className="text-right font-black">
                <div className="text-xl text-white">{item.kolicina_final} m³</div>
                <div className="text-[9px] text-slate-500">{item.kolicina_ulaz} {item.jm}</div>
            </div>
            <button 
                onClick={(e) => { e.stopPropagation(); printDeklaracijaPaketa(item.paket_id, [item], radniNalog); }} 
                className="bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border border-blue-500/30 transition-all shadow-md z-10"
            >
                🖨️ Print QR
            </button>
        </div>
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
    
    // Dodano dozvoljeni_moduli u initial state
    const [form, setForm] = useState({ id: null, naziv: '', cijena_sat: '', cijena_m3: '', atributi_paketa: [], dozvoljeni_moduli: [] });
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
            atributi_paketa: m.atributi_paketa || [],
            dozvoljeni_moduli: m.dozvoljeni_moduli ? m.dozvoljeni_moduli.split(',').map(s => s.trim().toLowerCase()) : []
        });
        setIsEditing(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const ponistiIzmjenu = () => {
        setForm({ id: null, naziv: '', cijena_sat: '', cijena_m3: '', atributi_paketa: [], dozvoljeni_moduli: [] });
        setIsEditing(false);
    };

    const save = async () => {
        if (!selectedIzlazId) return alert("Prvo skenirajte IZLAZNI PAKET!");
        if (!form.kolicina_ulaz) return alert("⚠️ Unesite količinu prije snimanja!");

        const timeNowFull = new Date().toISOString();
        const timeNow = new Date().toLocaleTimeString('de-DE');

        // 1. DOHVAĆANJE OSTALIH RADNIKA (Prijavljeni preko gumba u Pilani)
        const { data: aktuelniRadnici } = await supabase
            .from('aktivni_radnici')
            .select('radnik_ime')
            .eq('masina_naziv', header.masina)
            .is('vrijeme_odjave', null);
        const radniciIzPilane = aktuelniRadnici ? aktuelniRadnici.map(r => r.radnik_ime).join(', ') : '';

        // 2. INTERVALNA SLJEDIVOST TRUPACA
        const { data: lastItem } = await supabase
            .from('paketi').select('created_at').eq('paket_id', selectedIzlazId)
            .order('created_at', { ascending: false }).limit(1).maybeSingle();

        const startTime = lastItem ? lastItem.created_at : new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        const { data: logs } = await supabase.from('prorez_log').select('trupac_id')
            .eq('masina', header.masina).gte('created_at', startTime).lte('created_at', timeNowFull);
        const currentTrupciIds = logs ? [...new Set(logs.map(l => l.trupac_id))] : [];

        // 3. KALKULACIJA KOLIČINE
        const v = parseFloat(form.debljina) || 1; const s = parseFloat(form.sirina) || 1; const d = parseFloat(form.duzina) || 1;
        const unosKol = parseFloat(form.kolicina_ulaz);
        let komada = unosKol;
        if (form.jm === 'm3') komada = unosKol / ((v/100) * (s/100) * (d/100));
        else if (form.jm === 'm2') komada = unosKol / ((s/100) * (d/100));
        else if (form.jm === 'm1') komada = unosKol / (d/100);
        const qtyZaPaket = parseFloat((komada * (v/100) * (s/100) * (d/100)).toFixed(3));

        // 4. SNIMANJE SVEGA U BAZU (Svi radnici, trupci i nalog)
        if (activeEditItem) {
            const newM3 = updateMode === 'dodaj' ? parseFloat(activeEditItem.kolicina_final) + qtyZaPaket : parseFloat(activeEditItem.kolicina_final) - qtyZaPaket;
            const { error } = await supabase.from('paketi').update({ 
                kolicina_final: parseFloat(newM3.toFixed(3)), 
                vrijeme_tekst: timeNow, 
                snimio_korisnik: user.ime_prezime,
                brentista: brentista, // <--- DODANO
                viljuskarista: viljuskarista, // <--- DODANO
                radnici_pilana: radniciIzPilane, // <--- DODANO
                oznake: odabraneOznake.length > 0 ? odabraneOznake : activeEditItem.oznake,
                broj_veze: radniNalog || activeEditItem.broj_veze,
                ulaz_trupci_ids: currentTrupciIds.length > 0 ? currentTrupciIds : activeEditItem.ulaz_trupci_ids 
            }).eq('id', activeEditItem.id);
            if (error) return alert("❌ GREŠKA PRI AŽURIRANJU: " + error.message);
        } else {
            const payload = {
                paket_id: selectedIzlazId,
                naziv_proizvoda: form.naziv,
                debljina: v, sirina: s, duzina: d,
                kolicina_ulaz: form.kolicina_ulaz, jm: form.jm, kolicina_final: qtyZaPaket,
                mjesto: header.mjesto, masina: header.masina,
                snimio_korisnik: user.ime_prezime,
                brentista: brentista, // <--- DODANO
                viljuskarista: viljuskarista, // <--- DODANO
                radnici_pilana: radniciIzPilane, // <--- DODANO
                ulaz_trupci_ids: currentTrupciIds,
                broj_veze: radniNalog,
                vrijeme_tekst: timeNow,
                datum_yyyy_mm: header.datum,
                oznake: odabraneOznake
            };

            const { error } = await supabase.from('paketi').insert([payload]);
            if (error) return alert("Greška: " + error.message);

            // Update Radnog Naloga ako postoji
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

        fetchIzlaz(selectedIzlazId);
        setForm(f => ({...f, kolicina_ulaz: ''}));
        setOdabraneOznake([]);
        setActiveEditItem(null);
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
                    
                    {/* NOVO: DOZVOLJENI MODULI */}
                    <div className="col-span-1 md:col-span-3 mt-2 bg-[#0f172a] p-4 rounded-xl border border-slate-700">
                        <label className="text-[10px] text-slate-500 uppercase font-black mb-3 block">Dozvoljeni Moduli (gdje se mašina prikazuje)</label>
                        <div className="flex gap-6">
                            {['prorez', 'pilana', 'dorada'].map(modul => (
                                <label key={modul} className="flex items-center gap-2 text-white text-xs font-bold cursor-pointer uppercase hover:text-blue-400 transition-colors">
                                    <input 
                                        type="checkbox" 
                                        checked={form.dozvoljeni_moduli?.includes(modul) || false}
                                        onChange={(e) => {
                                            const trenutni = form.dozvoljeni_moduli || [];
                                            setForm({
                                                ...form,
                                                dozvoljeni_moduli: e.target.checked 
                                                    ? [...trenutni, modul] 
                                                    : trenutni.filter(m => m !== modul) 
                                            });
                                        }}
                                        className="w-5 h-5 accent-blue-600 bg-slate-800 border-slate-700 rounded"
                                    />
                                    {modul}
                                </label>
                            ))}
                        </div>
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
                                    <p className="text-[10px] text-slate-400 mt-1">Radni sat: <b className="text-emerald-400">{m.cijena_sat} KM</b> | Po kubiku: <b className="text-emerald-400">{m.cijena_m3} KM</b> | Moduli: <b className="text-blue-400">{m.dozvoljeni_moduli ? m.dozvoljeni_moduli.toUpperCase() : 'SVI'}</b></p>
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
    const [editId, setEditId] = useState(null); 
    const [form, setForm] = useState({ ime_prezime: '', username: '', password: '', uloga: 'operater', bruto_satnica: '', preostalo_godisnjeg: 20, dozvole: [] });

    // NOVE KVAČICE DODANE OVDJE:
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
                    <select value={form.uloga} onChange={e=>setForm({...form, uloga:e.target.value})} className="p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-blue-500 font-black">
                        <option value="operater">Uloga: Operater (Rad na mašini)</option><option value="admin">Uloga: Administrator (Šef)</option>
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
                                    <button key={modul} onClick={() => toggleDozvola(modul)} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${aktivan ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500'}`}>
                                        {aktivan ? '✓ ' : '+ '} {modul}
                                    </button>
                                );
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
function SettingsModule({ onExit, lockedTab }) {
    const [tab, setTab] = useState(lockedTab || 'sumarije');
    const tabs = ['sumarije', 'masine', 'katalog', 'kupci', 'radnici', 'blagajna', 'brending'];
    const labels = { sumarije: 'Šumarije', masine: 'Mašine', katalog: 'Katalog', kupci: 'Kupci', radnici: 'Radnici', blagajna: 'Kase / Kat.', brending: '🎨 Brending (SaaS)' };

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
            {tab === 'masine' && <TabMasine />}
            {tab === 'katalog' && <TabKatalog />}
            {tab === 'kupci' && <TabKupci />}
            {tab === 'radnici' && <TabRadnici />}
            {tab === 'blagajna' && <TabKategorijeBlagajne />}
            {tab === 'brending' && <TabBrending />}
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
        await supabase.from('blagajna_kategorije').insert([form]);
        setForm({...form, naziv: ''}); load();
    };

    const obrisiKategoriju = async (id, naziv) => {
        if(window.confirm(`Obrisati kategoriju ${naziv}?`)){
            await supabase.from('blagajna_kategorije').delete().eq('id', id); load();
        }
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

// NOVI MODUL ZA WHITE-LABELING I LOGOTIPE
// NOVI MODUL ZA WHITE-LABELING I LOGOTIPE (SA UPLOADOM SLIKA)
// ============================================================================
// MODUL ZA WHITE-LABELING I LOGOTIPE (SA UPLOADOM I INTERAKTIVNOM LISTOM)
// ============================================================================
// ============================================================================
// MODUL ZA WHITE-LABELING I LOGOTIPE (SA UPLOADOM I INTERAKTIVNOM LISTOM)
// ============================================================================
function TabBrending() {
    const [logotipi, setLogotipi] = useState([]);
    // NOVO: Dodano full_width u form state
    const [form, setForm] = useState({ id: null, naziv: '', url_slike: '', lokacije_jsonb: [], full_width: false });
    const [isEditing, setIsEditing] = useState(false);
    
    // Stanje za fajl sa laptopa i indikator uploada
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
        if (error) console.error("Greška baze:", error);
        setLogotipi(data || []); 
    };

    const toggleLokacija = (lok) => {
        setForm(prev => ({
            ...prev, lokacije_jsonb: prev.lokacije_jsonb.includes(lok) ? prev.lokacije_jsonb.filter(l => l !== lok) : [...prev.lokacije_jsonb, lok]
        }));
    };

    // FUNKCIJA ZA EDIT (Pokreće se klikom na listu)
    const pokreniIzmjenu = (l) => { 
        setForm({ id: l.id, naziv: l.naziv, url_slike: l.url_slike, lokacije_jsonb: l.lokacije_jsonb || [], full_width: l.full_width || false }); 
        setFajlSlike(null); 
        setIsEditing(true); 
        window.scrollTo({ top: 0, behavior: 'smooth' }); 
    };

    const ponisti = () => { 
        setForm({ id: null, naziv: '', url_slike: '', lokacije_jsonb: [], full_width: false }); 
        setFajlSlike(null); 
        setIsEditing(false); 
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
            
            if (uploadError) {
                setUploading(false);
                return alert("Greška pri uploadu: " + uploadError.message);
            }
            
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
        
        setUploading(false);
        ponisti(); load();
        alert("✅ Brending uspješno snimljen! Osvježite stranicu (F5) da bi se primijenila nova postavka za PDF.");
    };

    const obrisi = async (id, naziv, e) => { 
        e.stopPropagation(); 
        if(window.confirm(`Da li ste sigurni da želite obrisati logo: ${naziv}?`)) { 
            await supabase.from('brending').delete().eq('id', id); 
            load(); 
        } 
    };

    return (
        <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto">
            {/* FORMA ZA UNOS / IZMJENU */}
            <div className={`p-6 rounded-[2.5rem] border shadow-2xl space-y-4 transition-all ${isEditing ? 'bg-amber-950/30 border-amber-500' : 'bg-[#1e293b] border-slate-700'}`}>
                <div className="flex justify-between items-center">
                    <h3 className={`${isEditing ? 'text-amber-500' : 'text-blue-500'} font-black uppercase text-xs`}>
                        {isEditing ? `✏️ Uređivanje: ${form.naziv}` : `🎨 Dodaj Novi Logo / Memorandum`}
                    </h3>
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
                                return (
                                    <button key={lok} onClick={() => toggleLokacija(lok)} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${aktivan ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)] scale-105' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500'}`}>
                                        {aktivan ? '✓ ' : '+ '} {lok}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* NOVO: PREKIDAČ ZA PRIKAZ PREKO CIJELE ŠIRINE */}
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex items-center justify-between mt-2 cursor-pointer hover:bg-slate-800 transition-all" onClick={() => setForm({...form, full_width: !form.full_width})}>
                        <div>
                            <p className="text-white font-black text-xs uppercase">Prikaz preko cijele širine (Memorandum / Baner)</p>
                            <p className="text-[9px] text-slate-400 mt-1">Ako je ovo uključeno, slika ide na sami vrh PDF-a u punoj širini papira.</p>
                        </div>
                        <div className={`w-12 h-6 rounded-full p-1 transition-all ${form.full_width ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full transition-all ${form.full_width ? 'translate-x-6' : ''}`}></div>
                        </div>
                    </div>
                </div>
                
                {(form.url_slike || fajlSlike) && (
                    <div className="mt-4 p-6 bg-slate-900 rounded-2xl border border-slate-700 flex justify-center shadow-inner relative">
                        <span className="absolute top-2 left-3 text-[8px] uppercase text-slate-500 font-black">Pregled</span>
                        {fajlSlike ? (
                            <img src={URL.createObjectURL(fajlSlike)} alt="Preview" className="max-h-24 object-contain" />
                        ) : (
                            <img src={form.url_slike} alt="Preview" className="max-h-24 object-contain" />
                        )}
                    </div>
                )}
                
                <button onClick={uploadISnimi} disabled={uploading} className={`w-full py-5 text-white font-black rounded-2xl uppercase text-sm shadow-xl transition-all ${uploading ? 'bg-slate-600 cursor-not-allowed' : (isEditing ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500')}`}>
                    {uploading ? '⏳ Slanje na server...' : (isEditing ? '✅ Ažuriraj i Snimi Logo' : '✅ Snimi Novi Logo')}
                </button>
            </div>

            {/* LISTA SVIH LOGOTIPA */}
            <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-xl">
                <h3 className="text-slate-400 font-black uppercase text-[10px] mb-4">Trenutni Logotipi u Sistemu (Klikni za izmjenu)</h3>
                
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {logotipi.length === 0 && <p className="text-center text-slate-500 text-xs py-6 font-bold border-2 border-dashed border-slate-700 rounded-2xl">Još nema dodanih logotipa.</p>}
                    
                    {logotipi.map(l => (
                        <div key={l.id} onClick={() => pokreniIzmjenu(l)} className={`flex flex-col md:flex-row justify-between items-start md:items-center p-4 rounded-2xl cursor-pointer transition-all border ${isEditing && form.id === l.id ? 'bg-amber-900/20 border-amber-500/50' : 'bg-slate-900 border-slate-800 hover:border-blue-500/50 hover:bg-slate-800'}`}>
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className="w-20 h-20 bg-[#0f172a] rounded-2xl flex items-center justify-center p-2 border border-slate-700 shrink-0 shadow-inner">
                                    <img src={l.url_slike} className="max-h-full max-w-full object-contain" alt={l.naziv} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-white text-base font-black">{l.naziv}</p>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {l.full_width && <span className="text-[8px] bg-emerald-900/50 text-emerald-400 border border-emerald-500/50 px-2 py-1 rounded-md font-black uppercase">Preko cijele širine (Baner)</span>}
                                        {(l.lokacije_jsonb || []).length === 0 && <span className="text-[8px] text-slate-500 italic">Nema odabranih lokacija</span>}
                                        {(l.lokacije_jsonb || []).map(lok => (
                                            <span key={lok} className="text-[8px] bg-blue-900/30 text-blue-400 border border-blue-500/30 px-2 py-1 rounded-md font-bold uppercase">
                                                {lok}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 md:mt-0 flex gap-2 self-end md:self-auto">
                                <button onClick={(e) => obrisi(l.id, l.naziv, e)} className="text-red-500 font-black px-4 py-3 bg-red-900/20 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-red-500/30 text-xs uppercase shadow-md">✕ Obriši</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
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

    // DOZVOLE ZA BRZI UNOS
    const hasKupacEdit = loggedUser.uloga === 'admin' || (loggedUser.dozvole && loggedUser.dozvole.includes('Baza Kupaca (Edit)'));
    const hasKatalogEdit = loggedUser.uloga === 'admin' || (loggedUser.dozvole && loggedUser.dozvole.includes('Katalog Proizvoda (Edit)'));

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
    
    // STATE ZA POPUP PODEŠAVANJA (BRZI UNOS)
    const [showBrziKupac, setShowBrziKupac] = useState(false);
    const [showBrziKatalog, setShowBrziKatalog] = useState(false);

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

    const izracunajDinamickuCijenu = (proizvod, jm_cilj) => {
        if (!proizvod) return 0;
        const p_baza = parseFloat(proizvod.cijena) || 0;
        const jm_baza = (proizvod.default_jedinica || 'm3').toLowerCase();
        const cilj = (jm_cilj || 'm3').toLowerCase();
        if (jm_baza === cilj) return p_baza;
        const v = (parseFloat(proizvod.visina) || 1) / 100; const s = (parseFloat(proizvod.sirina) || 1) / 100; const d = (parseFloat(proizvod.duzina) || 1) / 100;
        let faktor_baza = 1;
        if (jm_baza === 'm3') faktor_baza = v * s * d; else if (jm_baza === 'm2') faktor_baza = s * d; else if (jm_baza === 'm1') faktor_baza = d;
        const cijena_komad = p_baza * faktor_baza;
        let faktor_cilj = 1;
        if (cilj === 'm3') faktor_cilj = v * s * d; else if (cilj === 'm2') faktor_cilj = s * d; else if (cilj === 'm1') faktor_cilj = d;
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
            const v = parseFloat(trenutniProizvod.visina) || 1; const s = parseFloat(trenutniProizvod.sirina) || 1; const d = parseFloat(trenutniProizvod.duzina) || 1;
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
        const cijena_baza = dinamickaCijena; 
        const rabat_konacni = parseFloat(stavkaForm.konacni_rabat) || 0;
        
        if (rabat_konacni !== stavkaForm.sistemski_rabat) await zapisiU_Log('RUČNA_IZMJENA_RABATA', `Za ${trenutniProizvod.sifra} na ponudi ${form.id}, rabat ručno postavljen na ${rabat_konacni}%.`);

        const ukupno_bez_rabata = kolicina_za_naplatu * cijena_baza;
        const iznos_rabata = ukupno_bez_rabata * (rabat_konacni / 100);
        const ukupno_sa_rabatom = ukupno_bez_rabata - iznos_rabata;

        const novaStavka = {
            id: stavkaForm.id || Math.random().toString(), sifra: trenutniProizvod.sifra, naziv: trenutniProizvod.naziv,
            kolicina_unos: parseFloat(stavkaForm.kolicina_unos), jm_unos: stavkaForm.jm_unos, kolicina_obracun: kolicina_za_naplatu, jm_obracun: stavkaForm.jm_obracun,
            cijena_baza: cijena_baza, rabat_procenat: rabat_konacni, iznos_rabata: iznos_rabata, ukupno: ukupno_sa_rabatom
        };

        if (stavkaForm.id) setStavke(stavke.map(s => s.id === stavkaForm.id ? novaStavka : s)); else setStavke([...stavke, novaStavka]);
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
            await zapisiU_Log('IZMJENA_PONUDE', `Ažurirana ponuda ${form.id}`); alert("✅ Ponuda uspješno ažurirana!");
        } else {
            const { error } = await supabase.from('ponude').insert([payload]);
            if(error) return alert("Greška pri snimanju: " + error.message);
            await zapisiU_Log('KREIRANA_PONUDA', `Ponuda ${form.id} za ${form.kupac_naziv}`); alert("✅ Ponuda uspješno kreirana!");
        }

        if ((form.status === 'POTVRĐENA' || form.status === 'REALIZOVANA ✅') && parseFloat(form.depozit) > 0) {
            const { data: postojiAvans } = await supabase.from('blagajna').select('id').eq('racun_id', form.id).maybeSingle();
            if (!postojiAvans) {
                await supabase.from('blagajna').insert([{
                    id: `KASA-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000)}`, tip: 'ULAZ', kategorija: 'Avans po Ponudi',
                    iznos: parseFloat(form.depozit), opis: `Automatski depozit po ponudi: ${form.id} (${form.kupac_naziv})`, racun_id: form.id, datum: new Date().toISOString().split('T')[0], vrijeme_tekst: new Date().toLocaleTimeString('de-DE'), snimio_korisnik: loggedUser.ime_prezime || 'Sistem'
                }]);
            }
        }
        resetFormu(); load(); setTab('lista');
    };

    const pokreniIzmjenuPonude = (p) => {
        setForm({ id: p.id, kupac_naziv: p.kupac_naziv, datum: p.datum, rok_vazenja: p.rok_vazenja, nacin_placanja: p.nacin_placanja || 'Virmanski', valuta: p.valuta || 'KM', paritet: p.paritet || 'FCA Srebrenik', depozit: p.depozit || '', napomena: p.napomena || '', status: p.status || 'NA ODLUČIVANJU' });
        setOdabraniKupac(kupci.find(k => k.naziv === p.kupac_naziv) || null); setStavke(p.stavke_jsonb || []); setIsEditingPonuda(true); setTab('nova'); window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const promijeniStatusBrzo = async (p, noviStatus) => { await supabase.from('ponude').update({ status: noviStatus }).eq('id', p.id); await zapisiU_Log('STATUS_PONUDE', `Ponuda ${p.id} prebačena u ${noviStatus}`); load(); };
    const resetFormu = () => { setForm({ id: generisiID(), kupac_naziv: '', datum: new Date().toISOString().split('T')[0], rok_vazenja: '', nacin_placanja: 'Virmanski', valuta: 'KM', paritet: 'FCA Srebrenik', depozit: '', napomena: '', status: 'NA ODLUČIVANJU' }); setStavke([]); setOdabraniKupac(null); setIsEditingPonuda(false); };
    const formatirajDatum = (isoString) => { if(!isoString) return ''; const [y, m, d] = isoString.split('-'); return `${d}.${m}.${y}.`; };

    const kreirajPDF = () => {
        const ukupnoSaPDV = parseFloat(totals.za_naplatu); const depozit = parseFloat(form.depozit) || 0; const preostaloZaNaplatu = (ukupnoSaPDV - depozit).toFixed(2);
        let redovi = stavke.map((s, i) => `<tr><td style="font-weight: bold; color: #64748b;">${i+1}.</td><td><b style="color: #0f172a; font-size: 13px;">${s.sifra}</b><br/><span style="color: #64748b; font-size: 11px;">${s.naziv}</span></td><td style="text-align: center; font-weight: 800; color: #0f172a;">${s.kolicina_obracun} <span style="color: #64748b; font-size: 10px; font-weight: 600;">${s.jm_obracun}</span></td><td style="text-align: right; font-weight: 600;">${s.cijena_baza.toFixed(2)}</td><td style="text-align: right; color: #ec4899; font-weight: 800;">${s.rabat_procenat > 0 ? s.rabat_procenat + '%' : '-'}</td><td style="text-align: right; font-weight: 800; color: #0f172a; font-size: 13px;">${s.ukupno.toFixed(2)}</td></tr>`).join('');
        const htmlSadrzajTabela = `
            <div class="info-grid">
                <div class="info-col"><h4>Kupac / Klijent</h4><p style="font-size: 18px; font-weight: 900; margin-bottom: 5px;">${form.kupac_naziv}</p><p style="font-weight: 400; color: #475569;">${odabraniKupac?.adresa || 'Adresa nije unesena'}</p><p style="font-weight: 600; color: #0f172a; font-size: 12px; margin-top: 6px;">PDV / ID: ${odabraniKupac?.pdv_broj || 'N/A'}</p></div>
                <div class="info-col" style="text-align: right;"><h4>Detalji Ponude</h4><p>Paritet: <span style="font-weight: 400; color: #475569;">${form.paritet}</span></p><p>Plaćanje: <span style="font-weight: 400; color: #475569;">${form.nacin_placanja}</span></p><p>Valuta: <span style="font-weight: 400; color: #475569;">${form.valuta}</span></p><p style="color: #ec4899; margin-top: 8px; font-weight: 800;">Važi do: ${formatirajDatum(form.rok_vazenja)}</p></div>
            </div>
            <table><thead><tr><th style="width: 5%;">R.B.</th><th>Šifra i Naziv Proizvoda</th><th style="text-align:center;">Količina</th><th style="text-align:right;">Cijena</th><th style="text-align:right;">Rabat</th><th style="text-align:right;">Ukupno (${form.valuta})</th></tr></thead><tbody>${redovi}</tbody></table>
            <div class="summary-box">
                <div class="summary-row"><span>Iznos bez rabata:</span> <b>${totals.bez_rabata}</b></div>
                <div class="summary-row"><span style="color: #ec4899; font-weight: bold;">Uračunati rabat:</span> <b style="color: #ec4899;">- ${totals.rabat}</b></div>
                <div class="summary-row"><span>Osnovica za PDV:</span> <b>${totals.osnovica}</b></div>
                <div class="summary-row"><span>PDV iznos (17%):</span> <b>${totals.pdv}</b></div>
                <div class="summary-row" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #cbd5e1;"><span>UKUPNO SA PDV:</span> <b>${ukupnoSaPDV.toFixed(2)}</b></div>
                ${depozit > 0 ? `<div class="summary-row" style="color: #10b981;"><span>Uplaćen depozit / Avans:</span> <b style="font-size:14px;">- ${depozit.toFixed(2)}</b></div>` : ''}
                <div class="summary-total"><span style="font-size: 14px; letter-spacing: 1px; padding-top:4px;">PREOSTALO ZA NAPLATU:</span><span>${preostaloZaNaplatu} ${form.valuta}</span></div>
            </div>
            <div class="footer"><div style="width: 60%;"><b style="color: #0f172a;">Napomena uz ponudu:</b><br/>${form.napomena || 'Nema dodatnih napomena.'}</div><div style="text-align: right; width: 30%;"><div style="border-bottom: 1px solid #cbd5e1; margin-bottom: 5px; height: 40px;"></div>Potpis ovlaštenog lica</div></div>
        `;
        printDokument('PONUDA', form.id, formatirajDatum(form.datum), htmlSadrzajTabela, '#ec4899');
    };

    const ponudePotvrdjene = ponude.filter(p => p.status === 'POTVRĐENA');
    const ponudeOdlucivanje = ponude.filter(p => p.status === 'NA ODLUČIVANJU');
    const ponudeRealizovane = ponude.filter(p => p.status === 'REALIZOVANA ✅');

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 font-bold">

            {/* OVERLAY MODALI ZA BRZI UNOS (BEZ GUBITKA PODATAKA IZ FORME) */}
            {showBrziKupac && (
                <div className="fixed inset-0 z-[200] bg-[#090e17]/95 flex flex-col p-4 overflow-y-auto backdrop-blur-md animate-in fade-in">
                    <SettingsModule onExit={() => { setShowBrziKupac(false); load(); }} lockedTab="kupci" />
                </div>
            )}
            {showBrziKatalog && (
                <div className="fixed inset-0 z-[200] bg-[#090e17]/95 flex flex-col p-4 overflow-y-auto backdrop-blur-md animate-in fade-in">
                    <SettingsModule onExit={() => { setShowBrziKatalog(false); load(); }} lockedTab="katalog" />
                </div>
            )}

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
                                <div className="flex gap-2 items-center w-full">
                                    <div className="flex-1 min-w-0">
                                        <SearchableInput value={form.kupac_naziv} onChange={handleKupacSelect} list={kupci.map(k=>k.naziv)} />
                                    </div>
                                    {hasKupacEdit && (
                                        <button onClick={() => setShowBrziKupac(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-3 rounded-xl shadow-lg shrink-0 text-[10px] font-black">➕ NOVI</button>
                                    )}
                                </div>
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
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Pronađi proizvod</label>
                            <div className="flex gap-2 items-center w-full">
                                <div className="flex-1 min-w-0">
                                    <PonudeSearchableProizvod katalog={katalog} value={stavkaForm.sifra_unos} onChange={handleProizvodSelect} />
                                </div>
                                {hasKatalogEdit && (
                                    <button onClick={() => setShowBrziKatalog(true)} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-3 rounded-xl shadow-lg shrink-0 text-[10px] font-black">➕ NOVI</button>
                                )}
                            </div>
                        </div>

                        {trenutniProizvod && (
                            <div className="p-4 bg-blue-900/10 border border-blue-500/30 rounded-2xl animate-in zoom-in-95 space-y-4">
                                <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                                    <div><p className="text-white text-sm font-black">{trenutniProizvod.sifra} - {trenutniProizvod.naziv}</p><p className="text-[10px] text-slate-400">Dim: {trenutniProizvod.visina}x{trenutniProizvod.sirina}x{trenutniProizvod.duzina}</p></div>
                                    <div className="text-right"><p className="text-[10px] text-slate-400 uppercase">Cijena po {stavkaForm.jm_obracun}</p><p className="text-emerald-400 font-black text-lg">{dinamickaCijena.toFixed(2)} {form.valuta}</p>{trenutniProizvod.default_jedinica !== stavkaForm.jm_obracun && <p className="text-[9px] text-slate-500">Katalog: {trenutniProizvod.cijena} KM/{trenutniProizvod.default_jedinica}</p>}</div>
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
                                <div className="flex justify-between text-xs text-slate-400 border-b border-slate-800 pb-2 mb-2"><span>PDV (17%):</span><span>{totals.pdv} {form.valuta}</span></div>
                                <div className="flex justify-between text-sm text-white font-bold"><span>UKUPNO SA PDV:</span><span>{totals.za_naplatu} {form.valuta}</span></div>
                                {parseFloat(form.depozit) > 0 && <div className="flex justify-between text-sm text-emerald-400 font-bold mt-1"><span>Uplaćen depozit / Avans:</span><span>- {parseFloat(form.depozit).toFixed(2)} {form.valuta}</span></div>}
                                <div className="flex justify-between text-xl text-white font-black pt-2 mt-2 border-t border-slate-700">
                                    <span>PREOSTALO ZA NAPLATU:</span>
                                    <span className="text-pink-400">{(totals.za_naplatu - (parseFloat(form.depozit)||0)).toFixed(2)} {form.valuta}</span>
                                </div>
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
    // --- LOGIKA ZA SKENIRANJE QR KODA (Preuzimanje Ponude) ---
    const skenirajPonudu = async (e) => {
        if (e.key === 'Enter' || e.type === 'click') {
            const broj = skenerInput.toUpperCase().trim();
            if(!broj) return;
            
            const { data: ponuda } = await supabase.from('ponude').select('*').eq('id', broj).maybeSingle();
            if(!ponuda) return alert(`❌ Ponuda ${broj} nije pronađena u bazi!`);

            // 🛑 ERP BLOKADA: Ponuda mora biti potvrđena za proizvodnju!
            if (ponuda.status === 'NA ODLUČIVANJU') {
                return alert(`⛔ STOP: Ponuda ${broj} je još uvijek "NA ODLUČIVANJU".\nKupac je nije odobrio. Morate je prvo prebaciti u "POTVRĐENA" da biste započeli proizvodnju!`);
            }

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

    // KREIRANJE PDF-A ZA RADNI NALOG
    const formatirajDatum = (isoString) => {
        if(!isoString) return '';
        const [y, m, d] = isoString.split('-');
        return `${d}.${m}.${y}.`;
    };

    const kreirajPDF = () => {
        // OVO JE LINIJA KOJA PRONALAZI KUPCA:
        const odabraniKupac = kupci.find(k => k.naziv === form.kupac_naziv) || null;

        let redovi = stavke.map((s, i) => `
            <tr>
                <td style="font-weight: bold; color: #64748b; text-align: center;">${i+1}.</td>
                <td><b style="color: #0f172a; font-size: 13px;">${s.sifra}</b><br/><span style="color: #64748b; font-size: 11px;">${s.naziv}</span></td>
                <td style="text-align: center; font-size: 16px; font-weight: 900; color: #a855f7;">${s.kolicina_obracun} <span style="color: #64748b; font-size: 11px; font-weight: 600;">${s.jm_obracun}</span></td>
                <td style="text-align: center; font-weight: 600; color: #475569;">${s.kolicina_unos} <span style="font-size: 10px;">${s.jm_unos}</span></td>
            </tr>
        `).join('');

        const htmlSadrzajTabela = `
            <div class="info-grid">
                <div class="info-col">
                    <h4>Naručilac / Kupac</h4>
                    <p style="font-size: 18px; font-weight: 900; margin-bottom: 5px;">${form.kupac_naziv}</p>
                    <p style="font-weight: 400; color: #475569;">${odabraniKupac?.adresa || 'Adresa nije unesena u bazu'}</p>
                </div>
                <div class="info-col" style="text-align: right;">
                    <h4>Detalji Proizvodnje</h4>
                    <p>Vezana Ponuda: <span style="font-weight: 600; color: #0f172a;">${form.broj_ponude || '-'}</span></p>
                    <p>Status: <span style="font-weight: 900; color: #a855f7;">${form.status}</span></p>
                    <p style="color: #0f172a; margin-top: 8px; font-weight: 800;">Rok Isporuke: ${formatirajDatum(form.rok_isporuke)}</p>
                </div>
            </div>
            
            <table>
                <thead><tr><th style="width: 5%; text-align: center;">R.B.</th><th>Šifra i Naziv Proizvoda</th><th style="text-align:center;">Proizvesti (Cilj)</th><th style="text-align:center;">Norma / Ulaz</th></tr></thead>
                <tbody>${redovi}</tbody>
            </table>
            
            <div class="footer">
                <div style="width: 60%;">
                    <b style="color: #0f172a;">Uputstva za proizvodnju:</b><br/>
                    ${form.napomena || 'Nema posebnih uputstava. Proizvesti prema standardu.'}
                </div>
                <div style="text-align: right; width: 30%;">
                    <div style="border-bottom: 1px solid #cbd5e1; margin-bottom: 5px; height: 40px;"></div>
                    Rukovodilac proizvodnje
                </div>
            </div>
        `;
        printDokument('RADNI NALOG', form.id, formatirajDatum(form.datum), htmlSadrzajTabela, '#a855f7');
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
                            <div className="flex justify-between items-center mb-4">
    <h3 className="text-purple-400 font-black uppercase text-xs">3. Pregled Radnog Naloga</h3>
    <button onClick={kreirajPDF} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-[10px] uppercase font-black border border-slate-600 hover:bg-white hover:text-black transition-all">🖨️ Kreiraj PDF</button>
</div>
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

// ============================================================================
// MODUL: OTPREMNICE (ISPORUKA)
// ============================================================================
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
    
    // SMART SEARCH STATE
    const [dostupniDokumenti, setDostupniDokumenti] = useState([]);
    const [prikaziDrop, setPrikaziDrop] = useState(false);
    const [kucanjeTimer, setKucanjeTimer] = useState(null);
    
    const [stavkaForm, setStavkaForm] = useState({ id: null, sifra_unos: '', kolicina_obracun: '', jm_obracun: 'm3' });
    const [trenutniProizvod, setTrenutniProizvod] = useState(null);

    const [skenerInput, setSkenerInput] = useState('');

    useEffect(() => { load(); }, []);

    const load = async () => {
        const {data: k} = await supabase.from('kupci').select('*').order('naziv'); setKupci(k||[]);
        const {data: cat} = await supabase.from('katalog_proizvoda').select('*').order('sifra'); setKatalog(cat||[]);
        const {data: otp} = await supabase.from('otpremnice').select('*').order('datum', { ascending: false }); setOtpremnice(otp||[]);
        
        // Učitavanje svih mogućih veza za pametni dropdown
        const { data: rn } = await supabase.from('radni_nalozi').select('id, kupac_naziv, status').neq('status', 'ZAVRŠENO');
        const { data: pon } = await supabase.from('ponude').select('id, kupac_naziv, status').in('status', ['POTVRĐENA', 'REALIZOVANA ✅']);
        setDostupniDokumenti([
            ...(rn || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Radni Nalog' })),
            ...(pon || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Ponuda' }))
        ]);
    };

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]);
    };

    // MAGIJA: Prepoznavanje da li je skenirana Ponuda ili Radni Nalog
    // MAGIJA: Prepoznavanje da li je skenirana Ponuda ili Radni Nalog
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
                
                // 🛑 ERP BLOKADA: Nalog mora biti ZAVRŠEN da bi roba izašla
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

    // PAMETNI SKENER SA 2 SEKUNDE ZADRŠKE
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

    const formatirajDatum = (isoString) => {
        if(!isoString) return '';
        const [y, m, d] = isoString.split('-');
        return `${d}.${m}.${y}.`;
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
                        <div className="bg-slate-900 border border-orange-500/50 p-6 rounded-3xl flex gap-3 items-center shadow-2xl relative">
                            <div className="text-2xl">📷</div>
                            <div className="flex-1 relative">
                                <label className="text-[10px] text-orange-400 uppercase font-black block mb-1">Skener (Skeniraj Ponudu ili Radni Nalog)</label>
                                <input value={skenerInput} onChange={handleSkenUnos} onFocus={() => setPrikaziDrop(true)} placeholder="Skeniraj ili ukucaj broj..." className="w-full p-4 bg-[#0f172a] rounded-xl text-sm text-white outline-none border border-orange-500 focus:border-orange-400 uppercase font-black shadow-inner" />
                                
                                {/* PAMETNI DROPDOWN */}
                                {prikaziDrop && skenerInput && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden z-50 max-h-60 overflow-y-auto">
                                        {dostupniDokumenti
                                            .filter(d => d.id.includes(skenerInput) || (d.kupac && d.kupac.toUpperCase().includes(skenerInput)))
                                            .map(p => (
                                            <div key={p.id} onClick={() => odaberiIzDropdowna(p.id)} className="p-3 border-b border-slate-700 hover:bg-slate-700 cursor-pointer flex justify-between items-center">
                                                <div><span className="text-white font-black">{p.id}</span> <span className="text-[10px] text-orange-400 ml-2 uppercase font-bold">{p.tip}</span></div>
                                                <div className="text-slate-400 text-xs font-bold">{p.kupac}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
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
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Vezni Dokument (Istorija)</label>
                                <input value={form.broj_veze} onChange={e=>setForm({...form, broj_veze:e.target.value})} className="w-full p-3 bg-slate-900 rounded-xl text-xs text-white outline-none border border-slate-700 uppercase" placeholder="Nema veznog dokumenta" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">BROJ OTPREMNICE</label>
                                <input value={form.id} disabled={isEditing} onChange={e=>setForm({...form, id:e.target.value})} className="w-full p-3 bg-slate-900 rounded-xl text-xs text-white outline-none border border-slate-700 font-black uppercase disabled:opacity-50" />
                            </div>
                            <div className="relative z-40 col-span-2">
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

                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-4">
                        <h3 className="text-blue-500 font-black uppercase text-xs mb-4">2. Stavke otpremnice (Samo Količina, bez cijena)</h3>
                        
                        <div className="relative z-30 mb-3">
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

                    {stavke.length > 0 && (
                        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-orange-500/30 shadow-2xl animate-in slide-in-from-bottom">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-orange-400 font-black uppercase text-xs">3. Pregled Otpremnice</h3>
                                <button onClick={kreirajPDF} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-[10px] uppercase font-black border border-slate-600 hover:bg-white hover:text-black transition-all">🖨️ Kreiraj PDF</button>
                            </div>
                            <div className="space-y-2 mb-6">
                                {stavke.map((s, i) => (
                                    <div key={s.id} onClick={() => urediStavku(s)} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-orange-500 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-black">{i+1}</div>
                                            <div><p className="text-white text-xs font-black">{s.sifra} <span className="text-slate-400 font-normal ml-1">{s.naziv}</span></p></div>
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

// ============================================================================
// MODUL: RAČUNI (FINANSIJE)
// ============================================================================
function RacuniModule({ onExit }) {
    const loggedUser = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');

    const hasKupacEdit = loggedUser.uloga === 'admin' || (loggedUser.dozvole && loggedUser.dozvole.includes('Baza Kupaca (Edit)'));
    const hasKatalogEdit = loggedUser.uloga === 'admin' || (loggedUser.dozvole && loggedUser.dozvole.includes('Katalog Proizvoda (Edit)'));

    const [tab, setTab] = useState('novi');
    const [kupci, setKupci] = useState([]);
    const [katalog, setKatalog] = useState([]);
    const [racuni, setRacuni] = useState([]);

    const generisiID = () => `RAC-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;

    const formatirajDatum = (isoString) => {
        if(!isoString) return '';
        if(isoString.includes('.')) return isoString; 
        const [y, m, d] = isoString.split('T')[0].split('-');
        return `${d}.${m}.${y}.`;
    };

    const [form, setForm] = useState({
        id: generisiID(), broj_veze: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0],
        rok_placanja: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString().split('T')[0],
        nacin_placanja: 'Virmanski', valuta: 'KM', napomena: '', status: 'NENAPLAĆENO', originalna_ponuda: null
    });

    const [isEditing, setIsEditing] = useState(false);
    const [odabraniKupac, setOdabraniKupac] = useState(null);
    const [stavke, setStavke] = useState([]);
    
    const [showBrziKupac, setShowBrziKupac] = useState(false);
    const [showBrziKatalog, setShowBrziKatalog] = useState(false);

    const [dostupniDokumenti, setDostupniDokumenti] = useState([]);
    const [prikaziDrop, setPrikaziDrop] = useState(false);
    const [kucanjeTimer, setKucanjeTimer] = useState(null);
    const [skenerInput, setSkenerInput] = useState('');

    const [stavkaForm, setStavkaForm] = useState({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3', sistemski_rabat: 0, konacni_rabat: '' });
    const [trenutniProizvod, setTrenutniProizvod] = useState(null);

    useEffect(() => { load(); }, []);

    const load = async () => {
        const {data: k} = await supabase.from('kupci').select('*').order('naziv'); setKupci(k||[]);
        const {data: cat} = await supabase.from('katalog_proizvoda').select('*').order('sifra'); setKatalog(cat||[]);
        const {data: r} = await supabase.from('racuni').select('*').order('datum', { ascending: false }); setRacuni(r||[]);
        
        const { data: rn } = await supabase.from('radni_nalozi').select('id, kupac_naziv, status').neq('status', 'ZAVRŠENO');
        const { data: pon } = await supabase.from('ponude').select('id, kupac_naziv, status').in('status', ['POTVRĐENA', 'REALIZOVANA ✅']);
        const { data: otp } = await supabase.from('otpremnice').select('id, kupac_naziv, status');
        setDostupniDokumenti([
            ...(otp || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Otpremnica' })),
            ...(rn || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Radni Nalog' })),
            ...(pon || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Ponuda' }))
        ]);
    };

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]);
    };

    const sinhronizujKasu = async (racunId, status, nacinPlacanja, kupacNaziv, ukupnoZaNaplatu) => {
        const { data: transakcije } = await supabase.from('blagajna').select('*').eq('racun_id', racunId);
        const uplate = (transakcije || []).filter(t => t.tip === 'ULAZ').reduce((acc, t) => acc + parseFloat(t.iznos), 0);
        const storna = (transakcije || []).filter(t => t.tip === 'IZLAZ' && t.kategorija === 'Storno Naplate').reduce((acc, t) => acc + parseFloat(t.iznos), 0);
        const netoUplaceno = uplate - storna;

        if (status === 'NAPLAĆENO' && nacinPlacanja === 'Gotovina') {
            const zaUplatu = ukupnoZaNaplatu - netoUplaceno;
            if (zaUplatu > 0) {
                await supabase.from('blagajna').insert([{
                    id: `KASA-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000)}`, tip: 'ULAZ', kategorija: 'Naplata Računa',
                    iznos: parseFloat(zaUplatu.toFixed(2)), opis: `Automatska gotovinska naplata računa: ${racunId} (${kupacNaziv})`,
                    racun_id: racunId, datum: new Date().toISOString().split('T')[0], vrijeme_tekst: new Date().toLocaleTimeString('de-DE'), snimio_korisnik: loggedUser.ime_prezime || 'Sistem'
                }]);
                await zapisiU_Log('KASA_AUTO_UNOS', `Automatska gotovinska naplata za račun ${racunId}`);
            }
        } else {
            if (netoUplaceno > 0) {
                await supabase.from('blagajna').insert([{
                    id: `KASA-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000)}`, tip: 'IZLAZ', kategorija: 'Storno Naplate',
                    iznos: parseFloat(netoUplaceno.toFixed(2)), opis: `STORNO: Poništena/Izmijenjena naplata računa: ${racunId} (${kupacNaziv})`,
                    racun_id: racunId, datum: new Date().toISOString().split('T')[0], vrijeme_tekst: new Date().toLocaleTimeString('de-DE'), snimio_korisnik: loggedUser.ime_prezime || 'Sistem'
                }]);
                await zapisiU_Log('KASA_STORNO', `Automatski storno u blagajni za račun ${racunId} (Stornirano: ${netoUplaceno} KM)`);
            }
        }
    };

    const izracunajRabat = (proizvod, kupac) => {
        if(!kupac || !kupac.rabati_jsonb) return 0;
        const rabati = kupac.rabati_jsonb;
        if (rabati.proizvodi && rabati.proizvodi[proizvod.sifra]) return parseFloat(rabati.proizvodi[proizvod.sifra]);
        if (rabati.kategorije && rabati.kategorije[proizvod.kategorija]) return parseFloat(rabati.kategorije[proizvod.kategorija]);
        if (rabati.ukupni) return parseFloat(rabati.ukupni);
        return 0;
    };

    const skenirajVezu = async (trazeniBroj) => {
        const broj = trazeniBroj.toUpperCase().trim();
        if(!broj) return;
        
        let dokument = null; let baznaPonuda = null; let napomenaTekst = `Povezano sa: ${broj}`;

        let { data: otp } = await supabase.from('otpremnice').select('*').eq('id', broj).maybeSingle();
        if (otp) {
            if (otp.status !== 'ISPORUČENO') {
                const proceed = window.confirm(`⚠️ UPOZORENJE:\nOtpremnica ${broj} je u statusu "${otp.status}".\nRoba još uvijek nije fizički isporučena kupcu!\n\nDa li ste sigurni da želite unaprijed napraviti račun?`);
                if (!proceed) { setSkenerInput(''); return; }
            }
            dokument = otp;
            if (otp.broj_veze) {
                let { data: rn } = await supabase.from('radni_nalozi').select('*').eq('id', otp.broj_veze).maybeSingle();
                if (rn) {
                    napomenaTekst += ` -> ${otp.broj_veze}`;
                    if (rn.broj_ponude) {
                        let { data: pon } = await supabase.from('ponude').select('*').eq('id', rn.broj_ponude).maybeSingle();
                        baznaPonuda = pon; napomenaTekst += ` -> ${rn.broj_ponude}`;
                    }
                } else {
                    let { data: pon } = await supabase.from('ponude').select('*').eq('id', otp.broj_veze).maybeSingle();
                    if(pon) { baznaPonuda = pon; napomenaTekst += ` -> ${otp.broj_veze}`; }
                }
            }
        }
        
        if (!dokument) {
            let { data: rn } = await supabase.from('radni_nalozi').select('*').eq('id', broj).maybeSingle();
            if (rn) {
                dokument = rn;
                if (rn.broj_ponude) {
                    let { data: pon } = await supabase.from('ponude').select('*').eq('id', rn.broj_ponude).maybeSingle();
                    baznaPonuda = pon; napomenaTekst += ` -> ${rn.broj_ponude}`;
                }
            }
        }

        if (!dokument) {
            let { data: pon } = await supabase.from('ponude').select('*').eq('id', broj).maybeSingle();
            if (pon) { dokument = pon; baznaPonuda = pon; }
        }

        if(!dokument) return alert(`❌ Dokument ${broj} nije pronađen nigdje u bazi!`);

        const kupacIzBaze = kupci.find(k => k.naziv === dokument.kupac_naziv);
        setOdabraniKupac(kupacIzBaze || null);

        const stavkeKolicine = dokument.stavke_jsonb || [];
        const stavkeFinansije = baznaPonuda ? (baznaPonuda.stavke_jsonb || []) : [];

        const konacneStavke = stavkeKolicine.map(sk => {
            const proizvod = katalog.find(k => k.sifra === sk.sifra);
            let cijena_baza = proizvod ? parseFloat(proizvod.cijena) : (sk.cijena_baza || 0);
            let rabat_procenat = proizvod && kupacIzBaze ? izracunajRabat(proizvod, kupacIzBaze) : 0;

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
        setStavke(konacneStavke); setSkenerInput('');
        alert(`✅ Učitane količine sa: ${broj}\n${baznaPonuda ? '✅ Primijenjene cijene iz originalne ponude: ' + baznaPonuda.id : '⚠️ Nema bazne ponude, primijenjene standardne cijene.'}`);
    };

    const handleSkenUnos = (e) => {
        const val = e.target.value.toUpperCase();
        setSkenerInput(val); setPrikaziDrop(true); 
        if (kucanjeTimer) clearTimeout(kucanjeTimer);
        if (val) { setKucanjeTimer(setTimeout(() => { setPrikaziDrop(false); skenirajVezu(val); }, 2000)); }
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
            const v = parseFloat(trenutniProizvod.visina) || 1; const s = parseFloat(trenutniProizvod.sirina) || 1; const d = parseFloat(trenutniProizvod.duzina) || 1;
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

        const novaStavka = {
            id: stavkaForm.id || Math.random().toString(), sifra: trenutniProizvod.sifra, naziv: trenutniProizvod.naziv,
            kolicina_unos: parseFloat(stavkaForm.kolicina_unos), jm_unos: stavkaForm.jm_unos, kolicina_obracun: kolicina, jm_obracun: stavkaForm.jm_obracun,
            cijena_baza, rabat_procenat: rabat_konacni, iznos_rabata, ukupno: ukupno_sa_rabatom
        };

        if (stavkaForm.id) setStavke(stavke.map(s => s.id === stavkaForm.id ? novaStavka : s)); else setStavke([...stavke, novaStavka]);
        setStavkaForm({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3', sistemski_rabat: 0, konacni_rabat: '' }); setTrenutniProizvod(null);
    };

    const urediStavku = (stavka) => {
        const nadjeni = katalog.find(k => k.sifra === stavka.sifra);
        setTrenutniProizvod(nadjeni || null);
        const tekstZaPolje = nadjeni ? `${nadjeni.sifra} | ${nadjeni.naziv}` : stavka.sifra;
        setStavkaForm({ 
            id: stavka.id, sifra_unos: tekstZaPolje, kolicina_unos: stavka.kolicina_unos, jm_unos: stavka.jm_unos, 
            kolicina_obracun: stavka.kolicina_obracun, jm_obracun: stavka.jm_obracun, sistemski_rabat: izracunajRabat(nadjeni, odabraniKupac), konacni_rabat: stavka.rabat_procenat 
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
            id: form.id.toUpperCase(), broj_veze: form.broj_veze, kupac_naziv: form.kupac_naziv, datum: form.datum, rok_placanja: form.rok_placanja, nacin_placanja: form.nacin_placanja, valuta: form.valuta, napomena: form.napomena, stavke_jsonb: stavke, status: form.status,
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
            
            if (form.originalna_ponuda) {
                await supabase.from('ponude').update({ status: 'REALIZOVANA ✅' }).eq('id', form.originalna_ponuda);
                await zapisiU_Log('ZATVARANJE_PONUDE', `Ponuda ${form.originalna_ponuda} zatvorena kreiranjem računa ${form.id}`);
            }

            await zapisiU_Log('KREIRAN_RACUN', `Račun ${form.id} za ${form.kupac_naziv}`);
            alert("✅ Račun uspješno kreiran!");
        }

        await sinhronizujKasu(form.id, form.status, form.nacin_placanja, form.kupac_naziv, totals.za_naplatu);

        resetFormu(); load(); setTab('otvoreni');
    };

    const kreirajPDF = () => {
        const odabraniKupac = kupci.find(k => k.naziv === form.kupac_naziv) || null;
        let redovi = stavke.map((s, i) => `
            <tr>
                <td style="font-weight: bold; color: #64748b; text-align: center;">${i+1}.</td>
                <td><b style="color: #0f172a; font-size: 13px;">${s.sifra}</b><br/><span style="color: #64748b; font-size: 11px;">${s.naziv}</span></td>
                <td style="text-align: center; font-weight: 800; color: #0f172a;">${s.kolicina_obracun} <span style="color: #64748b; font-size: 10px; font-weight: 600;">${s.jm_obracun}</span></td>
                <td style="text-align: right; font-weight: 600;">${s.cijena_baza.toFixed(2)}</td>
                <td style="text-align: right; color: #ec4899; font-weight: 800;">${s.rabat_procenat > 0 ? s.rabat_procenat + '%' : '-'}</td>
                <td style="text-align: right; font-weight: 800; color: #0f172a; font-size: 13px;">${s.ukupno.toFixed(2)}</td>
            </tr>
        `).join('');

        const htmlSadrzajTabela = `
            <div class="info-grid">
                <div class="info-col">
                    <h4>Kupac / Primalac usluge</h4>
                    <p style="font-size: 18px; font-weight: 900; margin-bottom: 5px;">${form.kupac_naziv}</p>
                    <p style="font-weight: 400; color: #475569;">${odabraniKupac?.adresa || ''}</p>
                    <p style="font-weight: 600; color: #0f172a; font-size: 12px; margin-top: 6px;">PDV / ID: ${odabraniKupac?.pdv_broj || 'N/A'}</p>
                </div>
                <div class="info-col" style="text-align: right;">
                    <h4>Detalji Računa</h4>
                    <p>Vezni Dokument: <span style="font-weight: 600; color: #0f172a;">${form.broj_veze || '-'}</span></p>
                    <p>Plaćanje: <span style="font-weight: 600; color: #0f172a;">${form.nacin_placanja}</span></p>
                    <p style="color: #ef4444; margin-top: 8px; font-weight: 800;">Rok plaćanja: ${formatirajDatum(form.rok_placanja)}</p>
                </div>
            </div>
            <table>
                <thead><tr><th style="width: 5%; text-align: center;">R.B.</th><th>Šifra i Naziv Proizvoda</th><th style="text-align:center;">Količina</th><th style="text-align:right;">Cijena</th><th style="text-align:right;">Rabat</th><th style="text-align:right;">Ukupno (${form.valuta})</th></tr></thead>
                <tbody>${redovi}</tbody>
            </table>
            
            <div class="summary-box">
                <div class="summary-row"><span>Iznos bez rabata:</span> <b>${totals.bez_rabata}</b></div>
                <div class="summary-row"><span style="color: #ec4899; font-weight: bold;">Uračunati rabat:</span> <b style="color: #ec4899;">- ${totals.rabat}</b></div>
                <div class="summary-row"><span>Osnovica za PDV:</span> <b>${totals.osnovica}</b></div>
                <div class="summary-row"><span>PDV iznos (17%):</span> <b>${totals.pdv}</b></div>
                <div class="summary-total">
                    <span style="font-size: 14px; letter-spacing: 1px; padding-top:4px;">ZA NAPLATU:</span>
                    <span>${totals.za_naplatu} ${form.valuta}</span>
                </div>
            </div>
            <div class="footer"><div style="width: 100%;"><b style="color: #0f172a;">Napomena uz račun:</b><br/>${form.napomena || 'Zahvaljujemo se na povjerenju.'}</div></div>
        `;
        printDokument('RAČUN', form.id, formatirajDatum(form.datum), htmlSadrzajTabela, '#ef4444');
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
        await sinhronizujKasu(r.id, noviStatus, r.nacin_placanja, r.kupac_naziv, r.ukupno_sa_pdv);
        load();
    };

    const neplaceni = racuni.filter(r => r.status === 'NENAPLAĆENO');
    const placeni = racuni.filter(r => r.status === 'NAPLAĆENO');

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 font-bold">
            
            {showBrziKupac && (
                <div className="fixed inset-0 z-[200] bg-[#090e17]/95 flex flex-col p-4 overflow-y-auto backdrop-blur-md animate-in fade-in">
                    <SettingsModule onExit={() => { setShowBrziKupac(false); load(); }} lockedTab="kupci" />
                </div>
            )}
            {showBrziKatalog && (
                <div className="fixed inset-0 z-[200] bg-[#090e17]/95 flex flex-col p-4 overflow-y-auto backdrop-blur-md animate-in fade-in">
                    <SettingsModule onExit={() => { setShowBrziKatalog(false); load(); }} lockedTab="katalog" />
                </div>
            )}

            <div className="flex justify-between items-center bg-[#1e293b] p-4 rounded-3xl border border-red-500/30 shadow-lg">
                <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase hover:bg-slate-700">← Meni</button>
                <h2 className="text-red-400 font-black tracking-widest uppercase text-xs">💰 FINANSIJE: RAČUNI</h2>
            </div>

            <div className="flex bg-[#1e293b] p-1 rounded-2xl border border-slate-700">
                <button onClick={() => {setTab('novi'); if(!isEditing) resetFormu();}} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'novi' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500'}`}>
                    {isEditing ? '✏️ Ažuriraj Račun' : '➕ Kreiraj Račun'}
                </button>
                <button onClick={() => setTab('otvoreni')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all flex items-center justify-center gap-2 ${tab === 'otvoreni' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500'}`}>
                    ⏳ Otvoreni Računi <span className="bg-red-900/40 text-white px-2 rounded-full">{neplaceni.length}</span>
                </button>
                <button onClick={() => setTab('arhiva')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all flex items-center justify-center gap-2 ${tab === 'arhiva' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500'}`}>
                    🔐 Arhiva (Naplaćeno) <span className="bg-emerald-900/40 text-emerald-400 px-2 rounded-full">{placeni.length}</span>
                </button>
            </div>

            {tab === 'novi' && (
                <div className="space-y-4 animate-in slide-in-from-left max-w-4xl mx-auto">
                    {!isEditing && (
                        <div className="bg-slate-900 border border-red-500/50 p-6 rounded-3xl flex gap-3 items-center shadow-2xl relative">
                            <div className="text-2xl">📷</div>
                            <div className="flex-1 relative">
                                <label className="text-[10px] text-red-400 uppercase font-black block mb-1">Skener (Skeniraj OTP, RN ili PON)</label>
                                <input value={skenerInput} onChange={handleSkenUnos} onFocus={() => setPrikaziDrop(true)} placeholder="Skeniraj ili ukucaj broj..." className="w-full p-4 bg-[#0f172a] rounded-xl text-sm text-white outline-none border border-red-500 focus:border-red-400 uppercase font-black tracking-widest shadow-inner" />
                                
                                {prikaziDrop && skenerInput && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden z-50 max-h-60 overflow-y-auto text-left">
                                        {dostupniDokumenti
                                            .filter(d => d.id.includes(skenerInput) || (d.kupac && d.kupac.toUpperCase().includes(skenerInput)))
                                            .map(p => (
                                            <div key={p.id} onClick={() => {
                                                setSkenerInput(p.id); setPrikaziDrop(false);
                                                if (kucanjeTimer) clearTimeout(kucanjeTimer);
                                                skenirajVezu(p.id);
                                            }} className="p-3 border-b border-slate-700 hover:bg-slate-700 cursor-pointer flex justify-between items-center transition-all">
                                                <div><span className="text-white font-black">{p.id}</span> <span className="text-[10px] text-red-400 ml-2 uppercase font-bold">{p.tip}</span></div>
                                                <div className="text-slate-400 text-xs font-bold">{p.kupac}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
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
                                <div className="flex gap-2 items-center w-full">
                                    <div className="flex-1 min-w-0">
                                        <SearchableInput value={form.kupac_naziv} onChange={handleKupacSelect} list={kupci.map(k=>k.naziv)} />
                                    </div>
                                    {hasKupacEdit && <button onClick={() => setShowBrziKupac(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-3 rounded-xl shadow-lg shrink-0 text-[10px] font-black">➕ NOVI</button>}
                                </div>
                            </div>
                            <div>
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Datum izdavanja</label>
                                <input type="date" value={form.datum} onChange={e=>setForm({...form, datum:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700" />
                            </div>
                            <div>
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Rok plaćanja</label>
                                <input type="date" value={form.rok_placanja} onChange={e=>setForm({...form, rok_placanja:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700" />
                            </div>
                            <div>
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Način Plaćanja</label>
                                <select value={form.nacin_placanja} onChange={e=>setForm({...form, nacin_placanja:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700"><option value="Virmanski">Virmanski</option><option value="Gotovina">Gotovina</option><option value="Kartica">Kartica</option></select>
                            </div>
                            <div>
                                <label className="text-[8px] text-red-500 uppercase ml-2 block mb-1 font-black">Status Računa</label>
                                <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})} className="w-full p-3 bg-red-900/20 rounded-xl text-xs text-red-400 font-black outline-none border border-red-500/50">
                                    <option value="NENAPLAĆENO">Nenaplaćeno</option>
                                    <option value="NAPLAĆENO">NAPLAĆENO (Zatvoreno)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-4">
                        <h3 className="text-blue-500 font-black uppercase text-xs mb-4">2. Dinamički dodaj / uredi stavke</h3>
                        
                        <div className="relative z-40 mb-3">
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Pronađi proizvod za dodavanje</label>
                            <div className="flex gap-2 items-center w-full">
                                <div className="flex-1 min-w-0">
                                    <RAC_SearchableProizvod katalog={katalog} value={stavkaForm.sifra_unos} onChange={handleProizvodSelect} />
                                </div>
                                {hasKatalogEdit && <button onClick={() => setShowBrziKatalog(true)} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-3 rounded-xl shadow-lg shrink-0 text-[10px] font-black">➕ NOVI</button>}
                            </div>
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

                    {stavke.length > 0 && (
                        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-red-500/30 shadow-2xl animate-in slide-in-from-bottom">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-red-400 font-black uppercase text-xs">3. Konačni obračun</h3>
                                <button onClick={kreirajPDF} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-[10px] uppercase font-black border border-slate-600 hover:bg-white hover:text-black transition-all shadow-md">
                                    🖨️ Kreiraj PDF
                                </button>
                            </div>
                            
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
            )}

            {tab !== 'novi' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-right">
                    
                    {tab === 'otvoreni' && (
                        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-red-500/30 shadow-2xl col-span-2 max-w-4xl mx-auto w-full">
                            <h3 className="text-red-500 font-black uppercase text-xs mb-4 flex justify-between"><span>⏳ ČEKA NAPLATU (OTVORENO)</span></h3>
                            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                                {neplaceni.map(r => (
                                    <div key={r.id} className="p-4 bg-slate-900 border border-red-500/20 rounded-2xl cursor-pointer hover:border-red-500 transition-all">
                                        <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-2" onClick={() => pokreniIzmjenu(r)}>
                                            <div><p className="text-white text-sm font-black">{r.id}</p><p className="text-slate-400 text-xs font-bold mt-1">{r.kupac_naziv}</p></div>
                                            <div className="text-right"><p className="text-red-400 font-black text-lg">{r.ukupno_sa_pdv} {r.valuta}</p><p className="text-[9px] text-slate-500 uppercase">Rok: {formatirajDatum(r.rok_placanja)}</p></div>
                                        </div>
                                        <div className="flex justify-between items-center mt-2">
                                            <button onClick={()=>promijeniStatusBrzo(r, 'NAPLAĆENO')} className="text-[9px] text-white font-black bg-emerald-600 px-3 py-1 rounded hover:bg-emerald-500 transition-all">Označi kao naplaćeno 💰</button>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${r.nacin_placanja === 'Gotovina' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-blue-900/30 text-blue-400'}`}>{r.nacin_placanja}</span>
                                                <span className="text-[9px] text-slate-500">Veza: {r.broj_veze || '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {tab === 'arhiva' && (
                        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-emerald-500/30 shadow-2xl col-span-2 max-w-4xl mx-auto w-full">
                            <h3 className="text-emerald-500 font-black uppercase text-xs mb-4 flex justify-between"><span>✅ NAPLAĆENO (ZATVORENO)</span></h3>
                            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                                {placeni.map(r => (
                                    <div key={r.id} className="p-4 bg-slate-900 border border-emerald-500/20 rounded-2xl cursor-pointer hover:border-emerald-500 transition-all">
                                        <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-2" onClick={() => pokreniIzmjenu(r)}>
                                            <div><p className="text-white text-sm font-black">{r.id}</p><p className="text-slate-400 text-xs font-bold mt-1">{r.kupac_naziv}</p></div>
                                            <div className="text-right"><p className="text-emerald-400 font-black text-lg">{r.ukupno_sa_pdv} {r.valuta}</p><p className="text-[9px] text-slate-500 uppercase">Izdano: {formatirajDatum(r.datum)}</p></div>
                                        </div>
                                        <div className="flex justify-between items-center mt-2">
                                            <button onClick={()=>promijeniStatusBrzo(r, 'NENAPLAĆENO')} className="text-[9px] text-slate-400 bg-slate-800 px-3 py-1 rounded hover:bg-red-900/50 hover:text-red-400 transition-all">Vrati u dugovanje ↩</button>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${r.nacin_placanja === 'Gotovina' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-blue-900/30 text-blue-400'}`}>{r.nacin_placanja}</span>
                                                <span className="text-[9px] text-slate-500">Veza: {r.broj_veze || '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// MODUL: RAČUNI (FINANSIJE)
function BlagajnaModule({ user, header, setHeader, onExit }) {
    const loggedUser = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');

    const [tab, setTab] = useState('unos');
    const [sveTransakcije, setSveTransakcije] = useState([]); 
    const [kategorije, setKategorije] = useState([]);
    const [masine, setMasine] = useState([]);
    const [radnici, setRadnici] = useState([]);

    const generisiID = () => `KASA-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000)}`;

    const formatirajDatum = (isoString) => {
        if(!isoString) return '';
        if(isoString.includes('.')) return isoString; 
        const [y, m, d] = isoString.split('T')[0].split('-');
        return `${d}.${m}.${y}.`;
    };

    const [kucanjeTimer, setKucanjeTimer] = useState(null);
    const [showSkenerDrop, setShowSkenerDrop] = useState(false);
    const [sviDokumenti, setSviDokumenti] = useState([]);
    
    const [skenDetalji, setSkenDetalji] = useState(null); 
    
    // State za prikaz računa u pop-upu
    const [prikazDokumenta, setPrikazDokumenta] = useState(null);

    const [form, setForm] = useState({
        id: generisiID(), tip: 'ULAZ', kategorija: '', iznos: '', opis: '',
        racun_id: '', masina_naziv: '', radnik_ime: '', datum: new Date().toISOString().split('T')[0]
    });

    const [skener, setSkener] = useState('');

    useEffect(() => { load(); }, []); 

    const load = async () => {
        const { data: kat } = await supabase.from('blagajna_kategorije').select('*');
        setKategorije(kat || []);
        if (kat && kat.length > 0 && !form.kategorija) {
            setForm(f => ({ ...f, kategorija: kat.find(k => k.tip === f.tip)?.naziv || '' }));
        }

        const { data: rn } = await supabase.from('radni_nalozi').select('id, kupac_naziv, status').neq('status', 'ZAVRŠENO');
        const { data: otp } = await supabase.from('otpremnice').select('id, kupac_naziv, status').neq('status', 'ISPORUČENO');
        const { data: pon } = await supabase.from('ponude').select('id, kupac_naziv, status').in('status', ['POTVRĐENA', 'REALIZOVANA ✅']);
        const { data: rac } = await supabase.from('racuni').select('id, kupac_naziv, status').neq('status', 'NAPLAĆENO');
        
        setSviDokumenti([
            ...(rac || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Račun' })),
            ...(pon || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Ponuda' })),
            ...(rn || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Radni Nalog' })),
            ...(otp || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Otpremnica' }))
        ]);

        const { data: b } = await supabase.from('blagajna').select('*').order('created_at', { ascending: false });
        setSveTransakcije(b || []);

        const { data: m } = await supabase.from('masine').select('naziv'); setMasine(m || []);
        const { data: rad } = await supabase.from('radnici').select('ime_prezime'); setRadnici(rad || []);
    };

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]);
    };

    const otvoriDokument = async (docId) => {
        if(!docId) return;
        if(docId.startsWith('RAC-')) {
            const {data} = await supabase.from('racuni').select('*').eq('id', docId).maybeSingle();
            if(data) setPrikazDokumenta({ tip: 'RAČUN', data }); else alert('Dokument nije pronađen u bazi.');
        } else if(docId.startsWith('PON-')) {
            const {data} = await supabase.from('ponude').select('*').eq('id', docId).maybeSingle();
            if(data) setPrikazDokumenta({ tip: 'PONUDA', data }); else alert('Dokument nije pronađen u bazi.');
        } else {
            alert("Sistem za sada može prikazati samo Račune i Ponude direktno iz blagajne.");
        }
    };

    const handleTipChange = (noviTip) => {
        const defKat = kategorije.find(k => k.tip === noviTip)?.naziv || '';
        setForm({ ...form, tip: noviTip, kategorija: defKat, racun_id: '', masina_naziv: '', radnik_ime: '', iznos: '', opis: '' });
        setSkenDetalji(null);
    };

    const handleSkenUnos = (e) => {
        const val = e.target.value.toUpperCase();
        setSkener(val);
        setShowSkenerDrop(true);

        if (kucanjeTimer) clearTimeout(kucanjeTimer);
        if (val) {
            const timer = setTimeout(() => {
                izvrsiSkeniranje(val);
                setShowSkenerDrop(false); 
            }, 2000);
            setKucanjeTimer(timer);
        }
    };

    const izvrsiSkeniranje = async (trazeniBroj) => {
        const val = trazeniBroj.trim();
        if (!val) return;
        setSkenDetalji(null); 

        let glavnaVeza = null; let ukupnoZaPlatiti = 0; let kupac = ''; let tipSkenera = '';

        let { data: rac } = await supabase.from('racuni').select('id, ukupno_sa_pdv, kupac_naziv').eq('id', val).maybeSingle();
        if (rac) { glavnaVeza = rac.id; ukupnoZaPlatiti = rac.ukupno_sa_pdv; kupac = rac.kupac_naziv; tipSkenera = 'RAČUN'; }

        if (!glavnaVeza) {
            let { data: pon } = await supabase.from('ponude').select('id, ukupno_sa_pdv, kupac_naziv').eq('id', val).maybeSingle();
            if (pon) { glavnaVeza = pon.id; ukupnoZaPlatiti = pon.ukupno_sa_pdv; kupac = pon.kupac_naziv; tipSkenera = 'PONUDA'; }
        }

        if (!glavnaVeza) {
            let { data: rn } = await supabase.from('radni_nalozi').select('broj_ponude').eq('id', val).maybeSingle();
            if (rn && rn.broj_ponude) {
                let { data: pon } = await supabase.from('ponude').select('id, ukupno_sa_pdv, kupac_naziv').eq('id', rn.broj_ponude).maybeSingle();
                if (pon) { glavnaVeza = pon.id; ukupnoZaPlatiti = pon.ukupno_sa_pdv; kupac = pon.kupac_naziv; tipSkenera = 'RADNI NALOG'; }
            }
        }

        if (!glavnaVeza) {
            let { data: otp } = await supabase.from('otpremnice').select('broj_veze').eq('id', val).maybeSingle();
            if (otp && otp.broj_veze) {
                let veza = otp.broj_veze;
                let { data: rn } = await supabase.from('radni_nalozi').select('broj_ponude').eq('id', veza).maybeSingle();
                if (rn && rn.broj_ponude) veza = rn.broj_ponude;
                let { data: pon } = await supabase.from('ponude').select('id, ukupno_sa_pdv, kupac_naziv').eq('id', veza).maybeSingle();
                if (pon) { glavnaVeza = pon.id; ukupnoZaPlatiti = pon.ukupno_sa_pdv; kupac = pon.kupac_naziv; tipSkenera = 'OTPREMNICA'; }
            }
        }

        if (ukupnoZaPlatiti > 0) {
            const vecUplaceno = sveTransakcije.filter(t => t.racun_id === glavnaVeza && t.tip === 'ULAZ').reduce((a, b) => a + parseFloat(b.iznos), 0);
            let preostalo = (ukupnoZaPlatiti - vecUplaceno).toFixed(2);
            
            setSkenDetalji({ tip: tipSkenera, skenirano: val, glavna_veza: glavnaVeza, kupac, ukupno: ukupnoZaPlatiti, placeno: vecUplaceno, preostalo });

            if (preostalo <= 0) {
                setSkener(''); 
                return alert(`✅ Dugovanje nula! Ovaj dokument je već u potpunosti isplaćen.`);
            }

            setForm({
                ...form, tip: 'ULAZ', 
                kategorija: kategorije.find(k=>k.naziv.includes('Račun') || k.naziv.includes('Avans'))?.naziv || kategorije[0]?.naziv,
                iznos: preostalo, racun_id: glavnaVeza, 
                opis: `Naplata po skeniranom: ${tipSkenera} (${val})`
            });
            setSkener(''); 
        } else {
            alert(`❌ Sistem nije uspio pronaći finansijski trag za dokument: ${val}.`);
        }
    };

    const snimiTransakciju = async () => {
        if (!form.iznos || parseFloat(form.iznos) <= 0) return alert("Unesite ispravan iznos!");
        if (!form.kategorija) return alert("Odaberite kategoriju!");

        const payload = {
            id: form.id, tip: form.tip, kategorija: form.kategorija,
            iznos: parseFloat(form.iznos), opis: form.opis || null,
            racun_id: form.racun_id || null, masina_naziv: form.masina_naziv || null,
            radnik_ime: form.radnik_ime || null, datum: form.datum,
            vrijeme_tekst: new Date().toLocaleTimeString('de-DE'),
            snimio_korisnik: loggedUser.ime_prezime || 'Nepoznat'
        };

        const { error } = await supabase.from('blagajna').insert([payload]);
        if (error) return alert("Greška pri upisu u kasu: " + error.message);

        if (payload.tip === 'ULAZ' && payload.racun_id && payload.racun_id.startsWith('RAC-')) {
            const {data: r} = await supabase.from('racuni').select('ukupno_sa_pdv').eq('id', payload.racun_id).maybeSingle();
            if (r) {
                const sveUplate = sveTransakcije.filter(t => t.racun_id === payload.racun_id).reduce((a,b)=>a+parseFloat(b.iznos), 0) + payload.iznos;
                if (sveUplate >= r.ukupno_sa_pdv) {
                    await supabase.from('racuni').update({ status: 'NAPLAĆENO' }).eq('id', payload.racun_id);
                } else {
                    await supabase.from('racuni').update({ status: 'DJELOMIČNO PLAĆENO' }).eq('id', payload.racun_id);
                }
            }
        }

        await zapisiU_Log('KASA_UNOS', `Upisan ${payload.tip} od ${payload.iznos} KM u blagajnu (${payload.kategorija}).`);
        alert("✅ Transakcija uspješno snimljena u blagajnu!");
        
        if (window.confirm("Da li želite isprintati Potvrdu o Uplati/Isplati?")) {
            printPotvrda(payload);
        }
        
        setForm({ ...form, id: generisiID(), iznos: '', opis: '', racun_id: '', masina_naziv: '', radnik_ime: '' });
        setSkenDetalji(null);
        load(); setTab('pregled');
    };

    const obrisiTransakciju = async (t) => {
        if(window.confirm(`Da li ste sigurni da želite OBRISATI ovu transakciju od ${t.iznos} KM?\nUkoliko je greška u unosu uplaćenog računa, napravite STORNIRANJE umjesto brisanja.`)) {
            await supabase.from('blagajna').delete().eq('id', t.id);
            await zapisiU_Log('KASA_BRISANJE', `Obrisana transakcija ${t.id} od ${t.iznos} KM (${t.kategorija}).`);
            load();
        }
    };

    const printPotvrda = (t) => {
        const title = t.tip === 'ULAZ' ? 'POTVRDA O UPLATI' : 'POTVRDA O ISPLATI';
        const color = t.tip === 'ULAZ' ? '#10b981' : '#ef4444';
        
        const html = `
            <div style="font-family: Arial, sans-serif; padding: 40px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 2px solid ${color}; border-radius: 12px; margin-top: 50px;">
                <div style="text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 20px; margin-bottom: 30px;">
                    <h1 style="color: ${color}; margin: 0; font-size: 28px;">${title}</h1>
                    <p style="color: #64748b; font-weight: bold; margin-top: 5px;">Broj: ${t.id}</p>
                </div>
                <table style="width: 100%; font-size: 16px; margin-bottom: 40px; line-height: 2;">
                    <tr><td style="color:#64748b; width:40%;">Datum i Vrijeme:</td><td style="font-weight:bold;">${formatirajDatum(t.datum)} u ${t.vrijeme_tekst}</td></tr>
                    <tr><td style="color:#64748b;">Kategorija:</td><td style="font-weight:bold;">${t.kategorija}</td></tr>
                    ${t.racun_id ? `<tr><td style="color:#64748b;">Vezni Dokument:</td><td style="font-weight:bold;">${t.racun_id}</td></tr>` : ''}
                    ${t.radnik_ime ? `<tr><td style="color:#64748b;">Zaposlenik:</td><td style="font-weight:bold;">${t.radnik_ime}</td></tr>` : ''}
                    <tr><td style="color:#64748b; vertical-align: top;">Opis / Svrha:</td><td style="font-weight:bold; border: 1px solid #e2e8f0; padding: 10px; background: #f8fafc; border-radius: 8px;">${t.opis || '-'}</td></tr>
                </table>
                <div style="background: ${color}20; padding: 20px; text-align: center; border-radius: 12px; border: 1px solid ${color}; margin-bottom: 50px;">
                    <span style="font-size: 14px; color: #475569; text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 5px;">Iznos transakcije</span>
                    <span style="font-size: 36px; font-weight: 900; color: ${color};">${parseFloat(t.iznos).toFixed(2)} KM</span>
                </div>
                <div style="display: flex; justify-content: space-between; text-align: center; margin-top: 60px;">
                    <div style="width: 40%;"><div style="border-bottom: 1px solid #94a3b8; height: 30px; margin-bottom: 10px;"></div><span style="font-size: 12px; font-weight: bold;">Blagajnik ( ${t.snimio_korisnik} )</span></div>
                    <div style="width: 40%;"><div style="border-bottom: 1px solid #94a3b8; height: 30px; margin-bottom: 10px;"></div><span style="font-size: 12px; font-weight: bold;">Uplatilac / Primalac</span></div>
                </div>
            </div>
        `;
        printDokument(title, t.id, formatirajDatum(t.datum), html, color);
    };

    // KLJUČNO: Ovdje definišemo šta je "Današnji dan" a šta "Odabrani period"
    const aktivniDatum = header?.datum || new Date().toISOString().split('T')[0];

    const prikazaneTransakcije = sveTransakcije.filter(t => t.datum === aktivniDatum);
    
    // Računanje suma za TRENUTNO ODABRANI DAN
    const periodUlaz = prikazaneTransakcije.filter(t => t.tip === 'ULAZ').reduce((acc, t) => acc + parseFloat(t.iznos), 0);
    const periodIzlaz = prikazaneTransakcije.filter(t => t.tip === 'IZLAZ').reduce((acc, t) => acc + parseFloat(t.iznos), 0);
    const periodPromet = periodUlaz - periodIzlaz;
    
    // Računanje Apsolutnog salda (Ovo gleda SVE ikada snimljeno u bazu)
    const apsolutnoStanjeKase = sveTransakcije.filter(t => t.tip === 'ULAZ').reduce((a,b)=>a+parseFloat(b.iznos),0) - sveTransakcije.filter(t => t.tip === 'IZLAZ').reduce((a,b)=>a+parseFloat(b.iznos),0);

    // Unikatne kategorije iz ŽIVIH transakcija (Ovo rješava problem skrivenog Storna)
    const unikatneKatUlaz = [...new Set(prikazaneTransakcije.filter(t => t.tip === 'ULAZ').map(t => t.kategorija))];
    const unikatneKatIzlaz = [...new Set(prikazaneTransakcije.filter(t => t.tip === 'IZLAZ').map(t => t.kategorija))];

        return (
             <div className="p-4 max-w-6xl mx-auto space-y-6 font-bold">

            {/* MODAL ZA BRZI PREGLED KOMPLETNOG RAČUNA */}
            {prikazDokumenta && (
                <div className="fixed inset-0 z-[100] bg-[#090e17]/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-[#1e293b] border-2 border-emerald-500 p-8 rounded-[2.5rem] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center border-b border-slate-700 pb-4 mb-4">
                            <div>
                                <h3 className="text-emerald-400 font-black uppercase text-xs">Detalji: {prikazDokumenta.tip}</h3>
                                <p className="text-white text-xl font-black mt-1">{prikazDokumenta.data.id}</p>
                            </div>
                            <button onClick={() => setPrikazDokumenta(null)} className="text-red-400 bg-slate-800 hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl text-xs font-black uppercase transition-all">✕ Zatvori</button>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                                <p className="text-[10px] text-slate-500 uppercase font-black">Kupac</p>
                                <p className="text-white font-black text-lg">{prikazDokumenta.data.kupac_naziv}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                                    <p className="text-[10px] text-slate-500 uppercase font-black">Datum</p>
                                    <p className="text-white font-bold">{formatirajDatum(prikazDokumenta.data.datum)}</p>
                                </div>
                                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                                    <p className="text-[10px] text-slate-500 uppercase font-black">Status</p>
                                    <p className={`font-black uppercase ${prikazDokumenta.data.status.includes('NAPLAĆENO') || prikazDokumenta.data.status.includes('POTVRĐ') ? 'text-emerald-400' : 'text-red-400'}`}>{prikazDokumenta.data.status}</p>
                                </div>
                            </div>

                            {/* Prikaz svih stavki dokumenta */}
                            {prikazDokumenta.data.stavke_jsonb && (
                                <div className="mt-4">
                                    <p className="text-[10px] text-slate-400 uppercase font-black mb-2">Stavke na dokumentu:</p>
                                    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-800 text-slate-400">
                                                <tr><th className="p-3">Šifra i Proizvod</th><th className="p-3 text-center">Količina</th><th className="p-3 text-right">Ukupno</th></tr>
                                            </thead>
                                            <tbody className="text-white">
                                                {prikazDokumenta.data.stavke_jsonb.map((s,i) => (
                                                    <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/50">
                                                        <td className="p-3 font-bold">{s.sifra} <span className="text-slate-400 font-normal ml-1 block mt-1">{s.naziv}</span></td>
                                                        <td className="p-3 text-center text-blue-400 font-bold">{s.kolicina_obracun} {s.jm_obracun}</td>
                                                        <td className="p-3 text-right font-black text-emerald-400">{s.ukupno?.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <div className="bg-emerald-900/20 p-4 rounded-xl border border-emerald-500/30 text-center mt-4">
                                <p className="text-[10px] text-emerald-400 uppercase font-black">Ukupno za naplatu</p>
                                <p className="text-3xl text-white font-black">{prikazDokumenta.data.ukupno_sa_pdv} {prikazDokumenta.data.valuta || 'KM'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {tab === 'analitika' || tab === 'pregled' ? (
                <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-emerald-500" user={user} hideMasina={true} modulIme="blagajna" />
            ) : (
                <div className="flex justify-between items-center bg-[#1e293b] p-4 rounded-3xl border border-emerald-500/30 shadow-lg">
                    <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase hover:bg-slate-700">← Meni</button>
                    <h2 className="text-emerald-400 font-black tracking-widest uppercase text-xs">💵 BLAGAJNA I FINANSIJE</h2>
                </div>
            )}

            <div className="flex bg-[#1e293b] p-1 rounded-2xl border border-slate-700">
                <button onClick={() => setTab('unos')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'unos' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500'}`}>➕ Unos u Kasu</button>
                <button onClick={() => setTab('pregled')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'pregled' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500'}`}>📋 Dnevnik Kase</button>
                <button onClick={() => setTab('analitika')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'analitika' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500'}`}>📊 Analiza Troškova</button>
            </div>

            {tab === 'unos' && (
                <div className="space-y-6 max-w-4xl mx-auto animate-in slide-in-from-left">
                    <div className="bg-slate-900 border border-blue-500/50 p-6 rounded-3xl flex gap-3 items-center shadow-2xl relative">
                        <div className="text-2xl">📷</div>
                        <div className="flex-1 relative">
                            <label className="text-[10px] text-blue-400 uppercase font-black block mb-1">Brzi sken (Učitaj PONUDU, RN ili RAČUN za naplatu)</label>
                            <input value={skener} onChange={handleSkenUnos} onFocus={() => setShowSkenerDrop(true)} placeholder="Skeniraj ili ukucaj broj..." className="w-full p-4 bg-[#0f172a] rounded-xl text-sm text-white outline-none border border-blue-500 focus:border-blue-400 uppercase font-black tracking-widest shadow-inner" />
                            
                            {showSkenerDrop && skener && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden z-50 max-h-60 overflow-y-auto text-left">
                                    {sviDokumenti
                                        .filter(d => d.id.includes(skener) || (d.kupac && d.kupac.toUpperCase().includes(skener)))
                                        .map(p => (
                                        <div key={p.id} onClick={() => {
                                            setSkener(p.id); setShowSkenerDrop(false);
                                            if (kucanjeTimer) clearTimeout(kucanjeTimer);
                                            izvrsiSkeniranje(p.id);
                                        }} className="p-3 border-b border-slate-700 hover:bg-slate-700 cursor-pointer flex justify-between items-center transition-all">
                                            <div><span className="text-white font-black">{p.id}</span> <span className="text-[10px] text-emerald-400 ml-2 uppercase font-bold">{p.tip}</span></div>
                                            <div className="text-slate-400 text-xs font-bold">{p.kupac}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* VIZUELNA KARTICA DETALJA */}
                    {skenDetalji && (
                        <div className="bg-slate-900 border-2 border-emerald-500/50 p-6 rounded-3xl shadow-2xl animate-in zoom-in-95">
                            <div className="flex justify-between items-start border-b border-slate-700 pb-3 mb-4">
                                <div>
                                    <h3 className="text-emerald-400 font-black text-sm uppercase">Pronađen finansijski trag</h3>
                                    <p className="text-white text-lg font-black mt-1">{skenDetalji.kupac}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-slate-400 text-[10px] uppercase">Glavna Veza</p>
                                    <p className="text-blue-400 font-bold">{skenDetalji.glavna_veza}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="bg-slate-800 p-3 rounded-xl"><p className="text-[9px] text-slate-400 uppercase">Ukupno</p><p className="text-white font-black">{skenDetalji.ukupno} KM</p></div>
                                <div className="bg-emerald-900/30 border border-emerald-500/30 p-3 rounded-xl"><p className="text-[9px] text-emerald-400 uppercase">Već Uplaćeno</p><p className="text-emerald-400 font-black">{skenDetalji.placeno} KM</p></div>
                                <div className="bg-red-900/30 border border-red-500/30 p-3 rounded-xl shadow-inner"><p className="text-[9px] text-red-400 uppercase">Preostali Dug</p><p className="text-red-400 font-black text-xl">{skenDetalji.preostalo} KM</p></div>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-4">
                        <button onClick={() => handleTipChange('ULAZ')} className={`flex-1 py-6 rounded-[2rem] text-xl font-black uppercase transition-all border-4 ${form.tip === 'ULAZ' ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-slate-900 border-slate-800 text-slate-600 hover:border-emerald-900'}`}>+ ULAZ NOVCA</button>
                        <button onClick={() => handleTipChange('IZLAZ')} className={`flex-1 py-6 rounded-[2rem] text-xl font-black uppercase transition-all border-4 ${form.tip === 'IZLAZ' ? 'bg-red-900/30 border-red-500 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-slate-900 border-slate-800 text-slate-600 hover:border-red-900'}`}>- IZLAZ NOVCA</button>
                    </div>

                    <div className={`bg-[#1e293b] p-8 rounded-[2.5rem] border-2 shadow-2xl space-y-6 ${form.tip === 'ULAZ' ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-slate-500 uppercase ml-2 block mb-1">Kategorija Transakcije</label>
                                <select value={form.kategorija} onChange={e=>setForm({...form, kategorija:e.target.value})} className="w-full p-4 bg-[#0f172a] rounded-xl text-sm text-white outline-none border border-slate-700 font-bold">
                                    {kategorije.filter(k=>k.tip===form.tip).map(k => <option key={k.id} value={k.naziv}>{k.naziv}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 uppercase ml-2 block mb-1">Iznos (KM)</label>
                                <input type="number" value={form.iznos} onChange={e=>setForm({...form, iznos:e.target.value})} placeholder="0.00" className={`w-full p-4 bg-[#0f172a] rounded-xl text-2xl font-black text-center outline-none border-2 shadow-inner ${form.tip === 'ULAZ' ? 'border-emerald-500/50 text-emerald-400 focus:border-emerald-400' : 'border-red-500/50 text-red-400 focus:border-red-400'}`} />
                            </div>
                        </div>

                        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
                            {(form.kategorija.toLowerCase().includes('račun') || form.kategorija.toLowerCase().includes('ponud') || form.kategorija.toLowerCase().includes('avans')) && (
                                <div className="relative">
                                    <label className="text-[10px] text-emerald-400 uppercase font-black ml-2 block mb-1">Vezni Dokument (Kucaj ako unosiš ručno bez skenera na vrhu)</label>
                                    <input 
                                        value={form.racun_id} 
                                        onChange={(e) => {
                                            const val = e.target.value.toUpperCase(); setForm({...form, racun_id: val}); setShowSkenerDrop(true);
                                            if (kucanjeTimer) clearTimeout(kucanjeTimer);
                                            if (val) { setKucanjeTimer(setTimeout(() => { setShowSkenerDrop(false); izvrsiSkeniranje(val); }, 2000)); }
                                        }} 
                                        onFocus={() => setShowSkenerDrop(true)} placeholder="npr. RAC-123" 
                                        className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-emerald-500 focus:border-emerald-400 uppercase font-black shadow-inner" 
                                    />
                                    
                                    {showSkenerDrop && form.racun_id && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden z-50 max-h-60 overflow-y-auto text-left">
                                            {sviDokumenti.filter(d => (d.tip === 'Račun' || d.tip === 'Ponuda') && (d.id.includes(form.racun_id) || (d.kupac && d.kupac.toUpperCase().includes(form.racun_id)))).map(p => (
                                                <div key={p.id} onClick={() => { setForm({...form, racun_id: p.id}); setShowSkenerDrop(false); if (kucanjeTimer) clearTimeout(kucanjeTimer); izvrsiSkeniranje(p.id); }} className="p-3 border-b border-slate-700 hover:bg-slate-700 cursor-pointer flex justify-between items-center transition-all">
                                                    <div><span className="text-white font-black">{p.id}</span> <span className="text-[10px] text-emerald-400 ml-2 uppercase font-bold">{p.tip}</span></div>
                                                    <div className="text-slate-400 text-xs font-bold">{p.kupac}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {form.kategorija.toLowerCase().includes('mašin') && (
                                <div>
                                    <label className="text-[10px] text-amber-500 uppercase font-black ml-2 block mb-1">Za koju mašinu se plaća?</label>
                                    <select value={form.masina_naziv} onChange={e=>setForm({...form, masina_naziv:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700">
                                        <option value="">-- Odaberi mašinu --</option>{masine.map(m => <option key={m.naziv} value={m.naziv}>{m.naziv}</option>)}
                                    </select>
                                </div>
                            )}

                            {form.kategorija.toLowerCase().includes('radnic') && (
                                <div>
                                    <label className="text-[10px] text-blue-400 uppercase font-black ml-2 block mb-1">Za kojeg radnika je isplata?</label>
                                    <select value={form.radnik_ime} onChange={e=>setForm({...form, radnik_ime:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700">
                                        <option value="">-- Odaberi radnika --</option>{radnici.map(r => <option key={r.ime_prezime} value={r.ime_prezime}>{r.ime_prezime}</option>)}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="text-[10px] text-slate-500 uppercase ml-2 block mb-1">Svrha / Detaljan opis</label>
                                <textarea value={form.opis} onChange={e=>setForm({...form, opis:e.target.value})} placeholder="Upiši detalje..." className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700" rows="2"></textarea>
                            </div>
                        </div>

                        <button onClick={snimiTransakciju} className={`w-full py-5 text-white font-black rounded-2xl uppercase text-sm shadow-xl transition-all ${form.tip === 'ULAZ' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}>✅ Proknjiži i Štampaj</button>
                    </div>
                </div>
            )}

            {tab === 'pregled' && (
                <div className="space-y-6 animate-in slide-in-from-right">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 text-center"><p className="text-[10px] text-slate-500 uppercase font-black mb-1">Ulaz u periodu</p><p className="text-2xl text-emerald-400 font-black">{periodUlaz.toFixed(2)}</p></div>
                        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 text-center"><p className="text-[10px] text-slate-500 uppercase font-black mb-1">Izlaz u periodu</p><p className="text-2xl text-red-400 font-black">{periodIzlaz.toFixed(2)}</p></div>
                        <div className="bg-slate-900 p-6 rounded-3xl border border-blue-500/30 text-center"><p className="text-[10px] text-blue-400 uppercase font-black mb-1">Promet u periodu</p><p className="text-2xl text-white font-black">{periodPromet.toFixed(2)}</p></div>
                        <div className="bg-blue-900/20 p-6 rounded-3xl border border-blue-500 text-center"><p className="text-[10px] text-blue-400 uppercase font-black mb-1">STVARNO STANJE KASE</p><p className="text-3xl text-white font-black">{apsolutnoStanjeKase.toFixed(2)} <span className="text-xs">KM</span></p></div>
                    </div>

                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl">
                        <div className="flex flex-wrap justify-between items-end mb-6 gap-4">
                            <h3 className="text-slate-400 font-black uppercase text-[10px]">Knjiga Blagajne za: <span className="text-white text-sm bg-slate-800 px-3 py-1 rounded ml-2">{formatirajDatum(aktivniDatum)}</span></h3>
                            <div className="flex gap-2">
                                <select onChange={(e) => setHeader({...header, blagajnaFilterKat: e.target.value})} className="bg-slate-900 text-xs text-white p-3 rounded-xl border border-slate-700 outline-none">
                                    <option value="SVE">Sve Kategorije</option>
                                    {kategorije.map(k => <option key={k.id} value={k.naziv}>{k.naziv}</option>)}
                                </select>
                                <input type="text" onChange={(e) => setHeader({...header, blagajnaPretraga: e.target.value})} placeholder="Pretraži opis..." className="bg-slate-900 text-xs text-white p-3 rounded-xl border border-slate-700 outline-none w-48" />
                            </div>
                        </div>

                        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                            {prikazaneTransakcije.length === 0 && <p className="text-center text-slate-500 py-10 font-bold">Nema transakcija za odabrani datum.</p>}
                            {prikazaneTransakcije
                                .filter(t => (header?.blagajnaFilterKat && header.blagajnaFilterKat !== 'SVE') ? t.kategorija === header.blagajnaFilterKat : true)
                                .filter(t => (header?.blagajnaPretraga) ? (t.opis || '').toLowerCase().includes(header.blagajnaPretraga.toLowerCase()) || (t.racun_id || '').toLowerCase().includes(header.blagajnaPretraga.toLowerCase()) : true)
                                .map(t => (
                                <div key={t.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex justify-between items-center hover:border-slate-600 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl border-4 shadow-lg shrink-0 ${t.tip === 'ULAZ' ? 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30' : 'bg-red-900/40 text-red-400 border-red-500/30'}`}>
                                            {t.tip === 'ULAZ' ? '+' : '-'}
                                        </div>
                                        <div>
                                            <p className="text-white text-xs font-black uppercase">{t.kategorija}</p>
                                            <p className="text-[10px] text-slate-400 mt-1">{t.opis || 'Nema opisa'}</p>
                                            <div className="flex flex-wrap gap-2 mt-2 items-center">
                                                <span className="text-[8px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-bold">{formatirajDatum(t.datum)} {t.vrijeme_tekst}</span>
                                                <span className="text-[8px] bg-blue-900/30 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-bold">👤 {t.snimio_korisnik}</span>
                                                {t.racun_id && (
                                                    <span onClick={() => otvoriDokument(t.racun_id)} className="cursor-pointer hover:bg-emerald-800 text-[8px] bg-emerald-900/30 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold transition-all shadow-md">
                                                        📄 Prikaži {t.racun_id}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className={`text-xl font-black font-mono ${t.tip === 'ULAZ' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {t.tip === 'ULAZ' ? '+' : '-'}{t.iznos.toFixed(2)}
                                            </p>
                                            <button onClick={() => printPotvrda(t)} className="text-[8px] uppercase font-black text-slate-500 hover:text-white mt-1">🖨️ Print Potvrdu</button>
                                        </div>
                                        <button onClick={() => obrisiTransakciju(t)} className="text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 p-2 rounded-xl transition-all">✕</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {tab === 'analitika' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-right">
                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-emerald-500/30 shadow-2xl">
                        <h3 className="text-emerald-500 font-black uppercase text-xs mb-4">📥 Struktura Ulaza na dan: {formatirajDatum(aktivniDatum)}</h3>
                        <div className="space-y-3">
                            {unikatneKatUlaz.length === 0 && <p className="text-slate-500 text-xs">Nema ulaznih transakcija za odabrani dan.</p>}
                            {unikatneKatUlaz.map(katNaziv => {
                                const suma = prikazaneTransakcije.filter(t => t.tip === 'ULAZ' && t.kategorija === katNaziv).reduce((a, t) => a + parseFloat(t.iznos), 0);
                                if (suma === 0) return null;
                                return (
                                    <div key={katNaziv} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                                        <span className="text-white text-sm font-bold">{katNaziv}</span>
                                        <span className="text-emerald-400 font-black font-mono">+ {suma.toFixed(2)} KM</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-red-500/30 shadow-2xl">
                        <h3 className="text-red-500 font-black uppercase text-xs mb-4">📤 Struktura Izlaza na dan: {formatirajDatum(aktivniDatum)}</h3>
                        <div className="space-y-3">
                            {unikatneKatIzlaz.length === 0 && <p className="text-slate-500 text-xs">Nema izlaznih transakcija za odabrani dan.</p>}
                            {unikatneKatIzlaz.map(katNaziv => {
                                const suma = prikazaneTransakcije.filter(t => t.tip === 'IZLAZ' && t.kategorija === katNaziv).reduce((a, t) => a + parseFloat(t.iznos), 0);
                                if (suma === 0) return null;
                                return (
                                    <div key={katNaziv} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                                        <span className="text-white text-sm font-bold">{katNaziv}</span>
                                        <span className="text-red-400 font-black font-mono">- {suma.toFixed(2)} KM</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-amber-500/30 shadow-2xl">
                        <h3 className="text-amber-500 font-black uppercase text-xs mb-4">⚙️ Troškovi Mašina na dan: {formatirajDatum(aktivniDatum)}</h3>
                        <div className="space-y-3">
                            {masine.map(m => {
                                const trosakMasine = prikazaneTransakcije.filter(t => t.masina_naziv === m.naziv).reduce((a, t) => a + parseFloat(t.iznos), 0);
                                if (trosakMasine === 0) return null;
                                return (
                                    <div key={m.naziv} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                                        <span className="text-white text-sm font-bold">{m.naziv}</span><span className="text-red-400 font-black font-mono">- {trosakMasine.toFixed(2)} KM</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-blue-500/30 shadow-2xl">
                        <h3 className="text-blue-400 font-black uppercase text-xs mb-4">👷 Isplate Radnicima na dan: {formatirajDatum(aktivniDatum)}</h3>
                        <div className="space-y-3">
                            {radnici.map(r => {
                                const radnikIsplate = prikazaneTransakcije.filter(t => t.radnik_ime === r.ime_prezime).reduce((a, t) => a + parseFloat(t.iznos), 0);
                                if (radnikIsplate === 0) return null;
                                return (
                                    <div key={r.ime_prezime} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                                        <span className="text-white text-sm font-bold">{r.ime_prezime}</span><span className="text-blue-400 font-black font-mono">{radnikIsplate.toFixed(2)} KM</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
// Kraj modula Blagajna
// ============================================================================
// MODUL: KONTROLNI TORANJ (TIMELINE SLJEDIVOST DOKUMENATA)
// ============================================================================
// ============================================================================
// MODUL: KONTROLNI TORANJ (TIMELINE SLJEDIVOST DOKUMENATA)
// ============================================================================
function KontrolniToranjModule({ onExit }) {
    const [sken, setSken] = useState('');
    const [timeline, setTimeline] = useState(null);
    const [loading, setLoading] = useState(false);
    
    // Za pametni dropdown
    const [sviDokumenti, setSviDokumenti] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [kucanjeTimer, setKucanjeTimer] = useState(null);

    useEffect(() => {
        // Učitavamo brojeve svih dokumenata za pametnu pretragu
        const ucitajSve = async () => {
            const { data: pon } = await supabase.from('ponude').select('id, kupac_naziv');
            const { data: rn } = await supabase.from('radni_nalozi').select('id, kupac_naziv');
            const { data: otp } = await supabase.from('otpremnice').select('id, kupac_naziv');
            const { data: rac } = await supabase.from('racuni').select('id, kupac_naziv');
            
            const svi = [
                ...(pon || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Ponuda' })),
                ...(rn || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Radni Nalog' })),
                ...(otp || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Otpremnica' })),
                ...(rac || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Račun' }))
            ];
            setSviDokumenti(svi);
        };
        ucitajSve();
    }, []);

    const analizirajDokument = async (trazeniBroj) => {
        const val = (trazeniBroj || sken).toUpperCase().trim();
        if (!val) return;
        setLoading(true); setShowDropdown(false); setTimeline(null);

        let pronadjenaPonuda = null;

        if (val.startsWith('PON-')) {
            const {data} = await supabase.from('ponude').select('*').eq('id', val).maybeSingle();
            pronadjenaPonuda = data;
        } else if (val.startsWith('RN-')) {
            const {data: rn} = await supabase.from('radni_nalozi').select('broj_ponude').eq('id', val).maybeSingle();
            if (rn && rn.broj_ponude) { const {data} = await supabase.from('ponude').select('*').eq('id', rn.broj_ponude).maybeSingle(); pronadjenaPonuda = data; }
        } else if (val.startsWith('OTP-')) {
            const {data: otp} = await supabase.from('otpremnice').select('broj_veze').eq('id', val).maybeSingle();
            if (otp && otp.broj_veze && otp.broj_veze.startsWith('RN-')) {
                const {data: rn} = await supabase.from('radni_nalozi').select('broj_ponude').eq('id', otp.broj_veze).maybeSingle();
                if (rn && rn.broj_ponude) { const {data} = await supabase.from('ponude').select('*').eq('id', rn.broj_ponude).maybeSingle(); pronadjenaPonuda = data; }
            } else if (otp && otp.broj_veze && otp.broj_veze.startsWith('PON-')) {
                const {data} = await supabase.from('ponude').select('*').eq('id', otp.broj_veze).maybeSingle(); pronadjenaPonuda = data;
            }
        } else if (val.startsWith('RAC-')) {
            const {data: rac} = await supabase.from('racuni').select('broj_veze').eq('id', val).maybeSingle();
            if (rac && rac.broj_veze && rac.broj_veze.startsWith('OTP-')) {
                 const {data: otp} = await supabase.from('otpremnice').select('broj_veze').eq('id', rac.broj_veze).maybeSingle();
                 if(otp && otp.broj_veze && otp.broj_veze.startsWith('RN-')) {
                     const {data: rn} = await supabase.from('radni_nalozi').select('broj_ponude').eq('id', otp.broj_veze).maybeSingle();
                     if(rn) { const {data} = await supabase.from('ponude').select('*').eq('id', rn.broj_ponude).maybeSingle(); pronadjenaPonuda = data; }
                 }
            }
        }

        if (!pronadjenaPonuda) {
            setLoading(false);
            return alert("Sistem ne može uspostaviti lanac sljedivosti za ovaj dokument.");
        }

        const podaci = { ponuda: pronadjenaPonuda, nalozi: [], otpremnice: [], uplate: [] };
        const {data: nalozi} = await supabase.from('radni_nalozi').select('*').eq('broj_ponude', pronadjenaPonuda.id);
        if (nalozi) podaci.nalozi = nalozi;

        const naloziIds = nalozi?.map(n => n.id) || [];
        const sviVezniBrojevi = [pronadjenaPonuda.id, ...naloziIds];
        if (sviVezniBrojevi.length > 0) {
            const {data: otpremnice} = await supabase.from('otpremnice').select('*').in('broj_veze', sviVezniBrojevi);
            if (otpremnice) podaci.otpremnice = otpremnice;
        }

        const {data: uplate} = await supabase.from('blagajna').select('*').eq('racun_id', pronadjenaPonuda.id).eq('tip', 'ULAZ');
        if (uplate) podaci.uplate = uplate;

        setTimeline(podaci); setLoading(false); setSken(val);
    };

    // LOGIKA ZADRŠKE (2 sekunde)
    const handleSkenUnos = (e) => {
        const val = e.target.value.toUpperCase();
        setSken(val);
        setShowDropdown(true);

        if (kucanjeTimer) clearTimeout(kucanjeTimer);
        
        if (val) {
            const noviTimer = setTimeout(() => {
                analizirajDokument(val);
            }, 2000);
            setKucanjeTimer(noviTimer);
        }
    };

    // Filtriranje dropdowna
    const preporuke = sviDokumenti.filter(d => d.id.includes(sken) || (d.kupac && d.kupac.toUpperCase().includes(sken))).slice(0, 5);

    return (
        <div className="p-4 max-w-5xl mx-auto space-y-6 font-bold">
            <div className="flex justify-between items-center bg-[#1e293b] p-4 rounded-3xl border border-blue-500/30 shadow-lg">
                <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase hover:bg-slate-700">← Meni</button>
                <h2 className="text-blue-400 font-black tracking-widest uppercase text-xs">📡 KONTROLNI TORANJ (SLJEDIVOST)</h2>
            </div>

            <div className="bg-[#1e293b] p-8 rounded-[2.5rem] border border-slate-700 shadow-2xl text-center relative z-50">
                <h3 className="text-slate-400 font-black uppercase text-xs mb-4">Skeniraj ili pretraži dokument (Ime kupca ili Broj)</h3>
                <div className="flex gap-2 max-w-2xl mx-auto relative">
                    <div className="flex-1 relative">
                        <input type="text" value={sken} onChange={handleSkenUnos} onFocus={()=>setShowDropdown(true)} placeholder="Npr. OTP-2026-123 ili MARIĆ BAU" className="w-full p-5 bg-[#0f172a] rounded-2xl text-center font-black text-xl text-white border border-blue-500/50 uppercase outline-none focus:border-blue-400" />
                        
                        {/* PAMETNI DROPDOWN */}
                        {showDropdown && sken && preporuke.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden z-50 text-left">
                                {preporuke.map(p => (
                                    <div key={p.id} onClick={() => { setSken(p.id); analizirajDokument(p.id); }} className="p-4 border-b border-slate-700 hover:bg-slate-700 cursor-pointer flex justify-between items-center">
                                        <div><span className="text-white font-black">{p.id}</span> <span className="text-xs text-slate-400 ml-2">({p.tip})</span></div>
                                        <div className="text-blue-400 text-xs">{p.kupac}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <button onClick={() => analizirajDokument(sken)} className="bg-blue-600 px-8 rounded-2xl text-white font-black hover:bg-blue-500 shadow-xl flex items-center gap-2">📷 SKEN</button>
                </div>
            </div>

            {loading && <p className="text-center text-blue-400 animate-pulse mt-10">Pretraga i građenje sljedivosti u toku...</p>}

            {/* Ostatak timeline prikaza ostaje isti... */}
            {timeline && (
                <div className="bg-[#0f172a] p-8 rounded-[2.5rem] border-2 border-slate-700 shadow-2xl space-y-8 animate-in slide-in-from-bottom">
                    <div className="flex justify-between items-start border-b border-slate-800 pb-6">
                        <div>
                            <h2 className="text-3xl text-white font-black">{timeline.ponuda.kupac_naziv}</h2>
                            <p className="text-slate-400 mt-1">Status posla: <span className="text-pink-400 font-black">{timeline.ponuda.status}</span></p>
                        </div>
                        <div className="text-right bg-slate-900 p-4 rounded-2xl border border-slate-800">
                            <p className="text-[10px] uppercase text-slate-500">Ukupna vrijednost posla</p>
                            <p className="text-3xl text-emerald-400 font-black">{timeline.ponuda.ukupno_sa_pdv.toFixed(2)} KM</p>
                        </div>
                    </div>
                    <div className="relative border-l-4 border-slate-700 ml-6 pl-8 space-y-10 py-4">
                        <div className="relative">
                            <div className="absolute -left-[42px] top-0 w-6 h-6 bg-pink-500 rounded-full border-4 border-[#0f172a]"></div>
                            <h4 className="text-pink-500 font-black text-xs uppercase mb-1">Početak: Kreirana Ponuda</h4>
                            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                                <p className="text-white font-bold text-lg">{timeline.ponuda.id}</p>
                                <p className="text-xs text-slate-400 mt-2">Zabilježio: <span className="text-slate-300">{timeline.ponuda.snimio_korisnik}</span> (Datum: {new Date(timeline.ponuda.datum).toLocaleDateString('bs-BA')})</p>
                            </div>
                        </div>
                        {timeline.nalozi.length > 0 && (
                            <div className="relative">
                                <div className="absolute -left-[42px] top-0 w-6 h-6 bg-purple-500 rounded-full border-4 border-[#0f172a]"></div>
                                <h4 className="text-purple-500 font-black text-xs uppercase mb-1">Faza proizvodnje: Radni Nalozi</h4>
                                <div className="space-y-2">
                                    {timeline.nalozi.map(n => (
                                        <div key={n.id} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-between items-center">
                                            <div><p className="text-white font-bold">{n.id}</p><p className="text-xs text-slate-400">Izdao: {n.snimio_korisnik} | Status: <span className="text-purple-400">{n.status}</span></p></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {timeline.otpremnice.length > 0 && (
                            <div className="relative">
                                <div className="absolute -left-[42px] top-0 w-6 h-6 bg-orange-500 rounded-full border-4 border-[#0f172a]"></div>
                                <h4 className="text-orange-500 font-black text-xs uppercase mb-1">Faza Isporuke: Otpremnice</h4>
                                <div className="space-y-2">
                                    {timeline.otpremnice.map(o => (
                                        <div key={o.id} className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                                            <p className="text-white font-bold">{o.id}</p><p className="text-xs text-slate-400">Vozač: {o.vozac || '-'} | Vozilo: {o.registracija || '-'}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="relative">
                            <div className="absolute -left-[42px] top-0 w-6 h-6 bg-emerald-500 rounded-full border-4 border-[#0f172a] shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                            <h4 className="text-emerald-500 font-black text-xs uppercase mb-1">Status Naplate (Blagajna)</h4>
                            {timeline.uplate.length > 0 ? (
                                <div className="space-y-2">
                                    {timeline.uplate.map((u, i) => (
                                        <div key={u.id} className="bg-emerald-900/20 p-4 rounded-2xl border border-emerald-500/30 flex justify-between items-center">
                                            <div><p className="text-emerald-400 font-bold">{i===0?'Avansna Uplata':'Uplata'} ({u.id})</p><p className="text-[10px] text-slate-400">Blagajnik: {u.snimio_korisnik}</p></div>
                                            <p className="text-xl text-emerald-400 font-black">+{parseFloat(u.iznos).toFixed(2)} KM</p>
                                        </div>
                                    ))}
                                    {(() => {
                                        const dug = timeline.ponuda.ukupno_sa_pdv - timeline.uplate.reduce((a, b) => a + parseFloat(b.iznos), 0);
                                        if (dug <= 0) return <div className="mt-4 p-3 bg-emerald-600 text-white text-center rounded-xl font-black shadow-lg">✅ ISPLAĆENO U POTPUNOSTI</div>;
                                        return <div className="mt-4 p-3 bg-red-900/50 border border-red-500 text-red-400 text-center rounded-xl font-black shadow-lg">⚠️ KUPAC DUGUJE JOŠ: {dug.toFixed(2)} KM</div>;
                                    })()}
                                </div>
                            ) : (
                                <div className="bg-slate-900 p-6 rounded-2xl border border-red-500/50 text-center"><p className="text-red-400 font-black">Nema evidentiranih uplata!</p></div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
// Kraj modula Kontrolni Toranj
// Kraj modula Blagajna
// ============================================================================
// Kraj modula Blagajna
// ============================================================================
// NOVI MODUL: LAGER PAKETA (ZAMJENJUJE QR KONTROLU)
// ============================================================================
// ============================================================================
// NOVI MODUL: LAGER PAKETA (POPRAVLJENI DATUMI I QR KOD VEZE)
// ============================================================================
// ============================================================================
// NOVI MODUL: LAGER PAKETA (POPRAVLJENI DATUMI + AUTOMATSKI QR KOD)
// ============================================================================
// ============================================================================
// NOVI MODUL: LAGER PAKETA (AUTOMATIKA QR KODOVA I POUZDAN KALENDAR)
// ============================================================================
// ============================================================================
// NOVI MODUL: LAGER PAKETA (100% AUTOMATIKA ZA QR KOD VEZE)
// ============================================================================
function LagerPaketaModule({ onExit, user }) {
    const danasnjiDatum = new Date().toISOString().split('T')[0];
    const [datumOd, setDatumOd] = useState(danasnjiDatum);
    const [datumDo, setDatumDo] = useState(danasnjiDatum);
    const [isPeriod, setIsPeriod] = useState(false); 
    const [filterStatus, setFilterStatus] = useState('SVI');
    const [pretraga, setPretraga] = useState('');
    
    const [paketi, setPaketi] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selektovaniPaket, setSelektovaniPaket] = useState(null);
    const [historija, setHistorija] = useState([]);
    const [isPrinting, setIsPrinting] = useState(false);

    const formatirajDatum = (isoString) => {
        if(!isoString) return '';
        const [y, m, d] = isoString.split('T')[0].split('-');
        return `${d}.${m}.${y}.`;
    };

    useEffect(() => { ucitajLager(); }, [datumOd, datumDo, isPeriod, filterStatus]);

    const ucitajLager = async () => {
        setLoading(true);
        let query = supabase.from('paketi').select('*');

        if (isPeriod) {
            query = query.gte('datum_yyyy_mm', datumOd).lte('datum_yyyy_mm', datumDo);
        } else {
            query = query.eq('datum_yyyy_mm', datumOd);
        }

        if (filterStatus === 'AKTIVNI') query = query.is('closed_at', null);
        else if (filterStatus === 'ZAVRŠENI') query = query.not('closed_at', 'is', null);

        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (data) {
            const grupisaniPaketi = [];
            const iskoristeniIDovi = new Set();
            for (let p of data) {
                if (!iskoristeniIDovi.has(p.paket_id)) {
                    iskoristeniIDovi.add(p.paket_id);
                    grupisaniPaketi.push(p);
                }
            }
            setPaketi(grupisaniPaketi);
        }
        setLoading(false);
    };

    const ucitajHistoriju = async (paket) => {
        setSelektovaniPaket(paket);
        setHistorija('load');
        const sid = paket.paket_id;

        const { data: auditData } = await supabase.from('audit_log').select('*').eq('zapis_id', sid).order('vrijeme', { ascending: true });
        
        let dogadjaji = [];
        if (auditData) {
            dogadjaji = auditData.map(a => ({
                vrijeme: a.vrijeme,
                naslov: a.akcija,
                opis: a.akcija === 'DODAVANJE' ? 'Kreiran u proizvodnji' : 'Izmjena podataka',
                korisnik: a.korisnik
            }));
        }

        // --- PRIKAZ ULAZNE SIROVINE (ZA DORADU GOTOVE ROBE) ---
        if (paket.ai_sirovina_ids && paket.ai_sirovina_ids.length > 0) {
            dogadjaji.push({
                vrijeme: paket.created_at,
                naslov: 'ULAZNA SIROVINA (DORADA)',
                opis: `Napravljeno preradom paketa: ${Array.isArray(paket.ai_sirovina_ids) ? paket.ai_sirovina_ids.join(', ') : paket.ai_sirovina_ids}`,
                korisnik: 'Sistem'
            });
        }

        // --- PRIKAZ ULAZNIH TRUPACA (ZBIRNO IZ SVIH STAVKI PAKETA U PILANI) ---
        const { data: sveStavkePaketa } = await supabase.from('paketi').select('ulaz_trupci_ids').eq('paket_id', sid);
        
        if (sveStavkePaketa && sveStavkePaketa.length > 0) {
            let sviTrupciId = [];
            
            // Skupljamo nizove trupaca iz svih mogućih smjena/redova za ovaj paket
            sveStavkePaketa.forEach(red => {
                if (red.ulaz_trupci_ids && Array.isArray(red.ulaz_trupci_ids)) {
                    sviTrupciId = [...sviTrupciId, ...red.ulaz_trupci_ids];
                }
            });
            
            const unikatniTrupci = [...new Set(sviTrupciId)]; // Uklanjamo duplikate

            if (unikatniTrupci.length > 0) {
                // Tražimo detalje o tim trupcima iz baze
                const { data: trupciPodaci } = await supabase.from('trupci').select('*').in('id', unikatniTrupci);
                
                if (trupciPodaci && trupciPodaci.length > 0) {
                    const totalV = trupciPodaci.reduce((s, t) => s + parseFloat(t.zapremina || 0), 0);
                    const sumarijeMap = {};
                    
                    trupciPodaci.forEach(t => {
                        const s = t.sumarija || 'Nepoznato';
                        sumarijeMap[s] = (sumarijeMap[s] || 0) + parseFloat(t.zapremina || 0);
                    });

                    // Formatiranje tekstualnog izvještaja
                    const infoText = Object.keys(sumarijeMap)
                        .map(k => `${k}: ${((sumarijeMap[k]/totalV)*100).toFixed(1)}%`)
                        .join(' | ');

                    dogadjaji.push({
                        vrijeme: paket.created_at,
                        naslov: 'SASTAV SIROVINE (SVE SMJENE)',
                        opis: `Paket je kroz sve faze izrade utrošio ${unikatniTrupci.length} trupaca.\n\nUdio šumarija:\n${infoText}`,
                        korisnik: 'Sistem'
                    });
                }
            }
        }

        // Sortiramo događaje po vremenu da ima logičan slijed
        setHistorija(dogadjaji.length > 0 ? dogadjaji.sort((a,b) => new Date(a.vrijeme) - new Date(b.vrijeme)) : 'none');
    };
    const shiftDate = (n) => {
        const d = new Date(datumOd + 'T12:00:00'); 
        d.setDate(d.getDate() + n);
        const iso = d.toISOString().split('T')[0];
        setDatumOd(iso); setDatumDo(iso);
    };

    // 🤖 PRAVA AUTOMATIKA: Bulletproof algoritam za nalazak Radnog Naloga ili Ponude
    // 🤖 PRAVA AUTOMATIKA: Direktno čita trag iz baze! Nema pogađanja!
    const isprintajAutomatski = async (paket) => {
        setIsPrinting(true);
        
        let vezniDokument = paket.broj_veze; // Sistem sada odmah zna tačan Nalog!
        
        // Ako postoji RN, provjeri ima li on svoju Ponudu
        if (vezniDokument && vezniDokument.startsWith('RN-')) {
            const { data: rn } = await supabase.from('radni_nalozi').select('broj_ponude').eq('id', vezniDokument).maybeSingle();
            
            // Ako RN ima upisanu ponudu, prepisujemo vezni dokument da bude ponuda
            if (rn && rn.broj_ponude && rn.broj_ponude.trim() !== '') {
                vezniDokument = rn.broj_ponude;
            }
        }
        
        if (!vezniDokument) {
            alert(`Sistem napominje: Paket ${paket.paket_id} nema zabilježen Radni Nalog prilikom kreiranja u Pilani/Doradi.\nQR kod će ostati prazan.`);
        }
        
        // Šaljemo u print!
        printDeklaracijaPaketa(paket.paket_id, [paket], vezniDokument || '');
        setIsPrinting(false);
    };


    return (
        <div className="p-4 max-w-5xl mx-auto space-y-6 animate-in fade-in font-bold">
            <div className="flex justify-between items-center bg-[#1e293b] p-4 rounded-3xl border border-blue-500/30 shadow-lg">
                <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase text-white font-black hover:bg-slate-700 transition-all">← Meni</button>
                <h2 className="text-blue-400 font-black tracking-widest uppercase text-xs">📦 LAGER I SLJEDIVOST PAKETA</h2>
                <div className="w-20"></div>
            </div>

            <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
                        <button onClick={() => setIsPeriod(false)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${!isPeriod ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-white'}`}>Dan</button>
                        <button onClick={() => setIsPeriod(true)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${isPeriod ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-white'}`}>Period</button>
                    </div>

                    <div className="flex items-center gap-3">
                        {!isPeriod ? (
                            <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-700">
                                <button onClick={() => shiftDate(-1)} className="w-8 h-8 bg-slate-800 rounded hover:bg-blue-600 text-white flex items-center justify-center font-black transition-all">-</button>
                                
                                <input 
                                    type="date" 
                                    value={datumOd} 
                                    onChange={e => { setDatumOd(e.target.value); setDatumDo(e.target.value); }} 
                                    className="bg-slate-800 text-blue-400 font-black text-sm p-2 rounded-xl border border-slate-700 outline-none focus:border-blue-500 cursor-pointer tracking-widest text-center"
                                />

                                <button onClick={() => shiftDate(1)} className="w-8 h-8 bg-slate-800 rounded hover:bg-blue-600 text-white flex items-center justify-center font-black transition-all">+</button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-700">
                                <input type="date" value={datumOd} onChange={e => setDatumOd(e.target.value)} className="bg-slate-800 text-blue-400 font-black text-xs p-2 rounded-xl border border-slate-700 outline-none focus:border-blue-500 cursor-pointer" />
                                <span className="text-slate-500 font-black">-</span>
                                <input type="date" value={datumDo} onChange={e => setDatumDo(e.target.value)} className="bg-slate-800 text-blue-400 font-black text-xs p-2 rounded-xl border border-slate-700 outline-none focus:border-blue-500 cursor-pointer" />
                            </div>
                        )}
                    </div>

                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-slate-900 text-white p-3 rounded-xl text-xs font-black border border-slate-700 outline-none focus:border-blue-500">
                        <option value="SVI">SVI PAKETI</option>
                        <option value="AKTIVNI">U PROIZVODNJI (Otvoreni)</option>
                        <option value="ZAVRŠENI">NA STANJU (Zaključeni)</option>
                    </select>
                </div>

                <input 
                    value={pretraga} 
                    onChange={e => setPretraga(e.target.value.toUpperCase())}
                    placeholder="Pretraži po broju paketa ili nazivu robe..." 
                    className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl text-white text-sm outline-none focus:border-blue-500 uppercase font-black"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <div className="col-span-full text-center py-20 animate-pulse text-blue-400 font-black tracking-widest uppercase">Učitavam Lager...</div>
                ) : paketi.length === 0 ? (
                    <div className="col-span-full text-center py-20 text-slate-600 font-bold border-2 border-dashed border-slate-800 rounded-[2.5rem]">Nema paketa za odabrani datum/kriterij.</div>
                ) : (
                    paketi.filter(p => p.paket_id.includes(pretraga) || p.naziv_proizvoda.toUpperCase().includes(pretraga)).map(p => (
                        <div key={p.id} onClick={() => ucitajHistoriju(p)} className="bg-[#111827] border border-slate-800 p-5 rounded-[2rem] hover:border-blue-500 transition-all cursor-pointer group relative overflow-hidden shadow-xl">
                            {p.closed_at && <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[8px] px-3 py-1 font-black rounded-bl-xl uppercase shadow-md">ZAVRŠEN</div>}
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <p className="text-blue-400 font-black text-lg">{p.paket_id}</p>
                                    <p className="text-white text-xs font-bold mt-1 uppercase">{p.naziv_proizvoda}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-emerald-400 font-black text-xl">{p.kolicina_final} <span className="text-[10px]">m³</span></p>
                                    <p className="text-slate-500 text-[9px] uppercase mt-1">{formatirajDatum(p.datum_yyyy_mm)}</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-800/50">
                                <span className="text-[9px] text-slate-400 uppercase font-bold">{p.debljina}x{p.sirina}x{p.duzina}</span>
                                <span className="text-[9px] text-slate-500 uppercase font-black">{p.vrijeme_tekst} | {p.masina}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {selektovaniPaket && (
                <div className="fixed inset-0 z-[150] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-[#1e293b] border-2 border-blue-500 p-8 rounded-[3rem] shadow-2xl max-w-lg w-full relative max-h-[90vh] overflow-y-auto">
                        <button onClick={() => setSelektovaniPaket(null)} className="absolute top-6 right-6 text-slate-400 hover:text-white text-2xl font-black transition-all hover:scale-110">✕</button>
                        
                        <div className="mb-8">
                            <h3 className="text-blue-400 font-black uppercase text-xs mb-2 tracking-widest">Detalji Paketa</h3>
                            <p className="text-white text-4xl font-black">{selektovaniPaket.paket_id}</p>
                            <p className="text-slate-400 text-sm mt-2">{selektovaniPaket.naziv_proizvoda} ({selektovaniPaket.debljina}x{selektovaniPaket.sirina}x{selektovaniPaket.duzina})</p>
                        </div>

                        <div className="space-y-4 mb-8">
                            <h4 className="text-slate-500 font-black uppercase text-[10px] border-b border-slate-700 pb-2">Vremenska Sljedivost (Historija):</h4>
                            {historija === 'load' ? <p className="animate-pulse text-xs text-blue-400">Generiram timeline...</p> : 
                             historija === 'none' ? <p className="text-xs text-slate-600">Nema dodatnih zapisa o promjenama.</p> : (
                                <div className="space-y-4">
                                    {historija.map((h, i) => (
                                        <div key={i} className="flex gap-4 items-start relative before:absolute before:left-[7px] before:top-5 before:bottom-[-20px] before:w-[2px] before:bg-slate-800 last:before:hidden">
                                            <div className="w-4 h-4 rounded-full bg-blue-600 border-4 border-[#1e293b] z-10 shrink-0 mt-1"></div>
                                            <div>
                                                <p className="text-white text-xs font-black uppercase">{h.naslov}</p>
                                                <p className="text-[10px] text-slate-400 mt-1">{h.opis}</p>
                                                <p className="text-[8px] text-slate-500 mt-1 uppercase font-bold">{new Date(h.vrijeme).toLocaleString('bs-BA')} | Snimio: {h.korisnik}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                             )}
                        </div>

                        <button 
                            onClick={() => isprintajAutomatski(selektovaniPaket)}
                            disabled={isPrinting}
                            className={`w-full py-4 text-white font-black rounded-2xl uppercase shadow-lg transition-all flex items-center justify-center gap-2 ${isPrinting ? 'bg-slate-600' : 'bg-blue-600 hover:bg-blue-500'}`}
                        >
                            {isPrinting ? '⏳ Tražim vezu i generišem...' : '🖨️ Isprintaj deklaraciju (Auto QR)'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}