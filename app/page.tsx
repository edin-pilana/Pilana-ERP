"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { Card, Text, Metric, List, ListItem, Flex, Badge, Button, Grid, Divider } from '@tremor/react';
import { Zap, Target, Clock, ArrowRight, FileText, ChevronLeft, ChevronRight, Activity, Search, Bot, UserCircle } from 'lucide-react';
import PilanaIzvjestaj from './components/PilanaIzvjestaj';
import PilanaPeriodIzvjestaj from './components/PilanaPeriodIzvjestaj';
import MasterHeader from './components/MasterHeader';
import SearchableInput from './components/SearchableInput';
import ScannerOverlay from './components/ScannerOverlay';
import ProrezModule from './modules/ProrezModule';
import PrijemModule from './modules/PrijemModule';
import PilanaModule from './modules/PilanaModule';
import { printDokument, printDeklaracijaPaketa, POSTAVKE } from './utils/printHelpers';
import DoradaModule from './modules/DoradaModule';
import SettingsModule from './modules/SettingsModule';
import PonudeModule from './modules/PonudeModule';
import RadniNaloziModule from './modules/RadniNaloziModule';
import OtpremniceModule from './modules/OtpremniceModule';
import RacuniModule from './modules/RacuniModule';
import BlagajnaModule from './modules/BlagajnaModule';
import KontrolniToranjModule from './modules/KontrolniToranjModule';
import LagerPaketaModule from './modules/LagerPaketaModule';
import DashboardModule from './modules/DashboardModule';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 🎨 NOVA KOMPONENTA ZA GLAVNI MENI (SaaS Dizajn)
const MenuCard = ({ naziv, ikona, bgGradient, onClick }) => (
    <div 
        onClick={onClick}
        className={`relative cursor-pointer overflow-hidden rounded-3xl ${bgGradient} p-6 flex flex-col items-center justify-center gap-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-black/50 border border-white/5 group`}
    >
        <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 shadow-inner flex items-center justify-center text-4xl group-hover:bg-white/20 transition-all">
            {ikona}
        </div>
        <span className="text-white font-black tracking-widest text-[10px] uppercase text-center drop-shadow-md">
            {naziv}
        </span>
    </div>
);

export default function Page() {
    const [loggedUser, setLoggedUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [activeModule, setActiveModule] = useState('dashboard');
    
    const [header, setHeader] = useState({
        mjesto: typeof window !== 'undefined' ? localStorage.getItem('last_loc') || '' : '',
        datum: new Date().toISOString().split('T')[0],
        masina: typeof window !== 'undefined' ? localStorage.getItem('last_masina') || '' : ''
    });

    const [uiPostavke, setUiPostavke] = useState({
        glavni_naslov: "Operativni Centar",
        pozdravna_poruka: "Odaberi modul — isti tok rada, novi izgled.",
        boja_pozadine: "#12192b",
        moduli: [] 
    });

    const [isEditMode, setIsEditMode] = useState(false);
    const [backupPostavke, setBackupPostavke] = useState(null); // Za "Odustani" dugme
    const [uploadingImage, setUploadingImage] = useState(false); // Za status učitavanja slike
    
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    // === DRAG & DROP I EDIT LOGIKA ===
    const pokreniEdit = () => {
        // Pravimo sigurnosnu kopiju trenutnog izgleda prije nego korisnik krene mijenjati
        setBackupPostavke(JSON.parse(JSON.stringify(uiPostavke))); 
        setIsEditMode(true);
    };

    const odustaniOdEdita = () => {
        if (backupPostavke) setUiPostavke(backupPostavke); // Vraćamo na staro
        setIsEditMode(false);
    };

    const handleDragStart = (e, index) => { dragItem.current = index; };
    const handleDragEnter = (e, index) => { dragOverItem.current = index; };
    
    const handleDrop = () => {
        if(dragItem.current === null || dragOverItem.current === null) return;
        const novaLista = [...(uiPostavke.moduli || [])];
        const premjesteniItem = novaLista[dragItem.current];
        novaLista.splice(dragItem.current, 1); 
        novaLista.splice(dragOverItem.current, 0, premjesteniItem); 
        dragItem.current = null; dragOverItem.current = null;
        setUiPostavke({ ...uiPostavke, moduli: novaLista });
    };

    const updateModul = (index, polje, vrijednost) => {
        const novaLista = [...(uiPostavke.moduli || [])];
        novaLista[index][polje] = vrijednost;
        setUiPostavke({ ...uiPostavke, moduli: novaLista });
    };

    const handleImageUpload = async (e, index) => {
        const file = e.target.files[0];
        if(!file) return;
        setUploadingImage(true);
        
        const fileExt = file.name.split('.').pop();
        const fileName = `modul_${Date.now()}.${fileExt}`;
        
        const { error } = await supabase.storage.from('slike').upload(fileName, file);
        if (error) {
            alert("Greška pri uploadu: " + error.message);
        } else {
            const { data } = supabase.storage.from('slike').getPublicUrl(fileName);
            updateModul(index, 'slika_url', data.publicUrl); // Snimamo URL slike u modul
        }
        setUploadingImage(false);
    };

    const spasiDizajn = async () => {
        const { error } = await supabase.from('ui_postavke').update({ postavke_jsonb: uiPostavke }).eq('modul_ime', 'dashboard');
        if(error) alert("Greška pri snimanju dizajna: " + error.message);
        else { alert("Dizajn uspješno spašen!"); setIsEditMode(false); setBackupPostavke(null); }
    };
    // ============================

    useEffect(() => {
        const initApp = async () => {
            const userJson = localStorage.getItem('smart_timber_user');
            if (userJson) { try { setLoggedUser(JSON.parse(userJson)); } catch (e) { localStorage.removeItem('smart_timber_user'); } }
            
            try {
                const { data: uiData } = await supabase.from('ui_postavke').select('postavke_jsonb').eq('modul_ime', 'dashboard').maybeSingle();
                if (uiData && uiData.postavke_jsonb) {
                    setUiPostavke(uiData.postavke_jsonb);
                }
            } catch(e) { console.log("Greška pri učitavanju UI postavki", e) }
            
            setAuthLoading(false);
        };
        initApp();
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        const username = e.target.user.value.trim();
        const password = e.target.pass.value.trim();

        const { data, error } = await supabase.rpc('provjeri_login', { uneseni_user: username, unesena_sifra: password });

        if (error) {
            console.error("Greška pri loginu:", error);
            alert("Pogrešan Username ili Password!");
        } else if (data) {
            localStorage.setItem('smart_timber_user', JSON.stringify(data));
            setLoggedUser(data);
        } else {
            alert("Pogrešan Username ili Password!");
        }
    };

    if (authLoading) return <div className="min-h-screen bg-[#0f172a]" />;

    if (!loggedUser) {
        return (
            <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 font-bold">
                <form onSubmit={handleLogin} className="w-full max-w-sm bg-[#1e293b] p-10 rounded-[2rem] border border-slate-700 shadow-2xl space-y-6">
                    <div className="text-center mb-8 flex flex-col items-center justify-center gap-2">
                        <img src="/logo.png" alt="Logo" className="max-h-24 object-contain mb-2" />
                        <h1 className="text-4xl font-black text-white tracking-tighter">Smart<span className="text-blue-500">Timber</span></h1>
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
                <div className="min-h-screen p-4 md:p-8 font-sans selection:bg-emerald-500/30 w-full animate-in fade-in" style={{ backgroundColor: uiPostavke.boja_pozadine }}>
                    <div className="max-w-5xl mx-auto space-y-8">
                        
                        {/* HEADER */}
                        <div className={`border border-slate-800 p-8 rounded-[2rem] flex flex-col md:flex-row gap-4 justify-between items-center shadow-2xl transition-colors duration-500 ${isEditMode ? 'ring-4 ring-amber-500' : ''}`} style={{ backgroundColor: uiPostavke.boja_pozadine }}>
                            <div className="w-full md:w-auto">
                                {isEditMode ? (
                                    <div className="flex flex-col gap-2">
                                        <input value={uiPostavke.glavni_naslov} onChange={e => setUiPostavke({...uiPostavke, glavni_naslov: e.target.value})} className="bg-black/30 text-blue-400 text-xs uppercase font-black tracking-widest p-2 rounded outline-none" />
                                        <input value={uiPostavke.pozdravna_poruka} onChange={e => setUiPostavke({...uiPostavke, pozdravna_poruka: e.target.value})} className="bg-black/30 text-slate-300 text-sm p-2 rounded outline-none w-full" />
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="text-[10px] text-slate-400 uppercase font-black">Boja Pozadine:</span>
                                            {/* COLOR PICKER (Paleta) */}
                                            <input type="color" value={uiPostavke.boja_pozadine || '#12192b'} onChange={e => setUiPostavke({...uiPostavke, boja_pozadine: e.target.value})} className="w-10 h-10 rounded cursor-pointer border-none bg-transparent" />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-blue-500 text-[10px] uppercase font-black tracking-widest mb-1">{uiPostavke.glavni_naslov}</p>
                                        <h1 className="text-4xl text-white font-black">Zdravo, {loggedUser?.ime_prezime || 'Korisnik'}</h1>
                                        <p className="text-slate-400 text-sm mt-2">{uiPostavke.pozdravna_poruka}</p>
                                    </>
                                )}
                            </div>
                            
                            <div className="flex gap-3 items-center w-full md:w-auto justify-end">
                                {loggedUser?.uloga === 'superadmin' && (
                                    isEditMode ? (
                                        <div className="flex gap-2">
                                            <button onClick={odustaniOdEdita} className="px-4 py-3 rounded-2xl bg-red-900/30 text-red-400 font-black text-[10px] uppercase hover:bg-red-500 hover:text-white transition-all shadow-lg border border-red-500/30">
                                                ✕ ODUSTANI
                                            </button>
                                            <button onClick={spasiDizajn} className="px-6 py-3 rounded-2xl bg-emerald-600 text-white font-black text-[10px] uppercase hover:bg-emerald-500 transition-all shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                                                💾 SPASI RASPORED
                                            </button>
                                        </div>
                                    ) : (
                                        <button onClick={pokreniEdit} className="px-4 py-3 rounded-2xl bg-amber-500/10 text-amber-500 font-black text-[10px] uppercase border border-amber-500/30 hover:bg-amber-500 hover:text-white transition-all shadow-lg">
                                            ✏️ UREDI EKRAN
                                        </button>
                                    )
                                )}
                                {!isEditMode && (
                                    <button onClick={() => { localStorage.removeItem('smart_timber_user'); window.location.reload(); }} className="px-6 py-3 rounded-2xl bg-slate-800/50 text-slate-300 font-bold text-xs uppercase border border-slate-700 hover:bg-red-500 hover:text-white transition-all">
                                        Odjava
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* DINAMIČKI GRID MODULA */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                            {(uiPostavke.moduli || []).map((modul, index) => {
                                let imaDozvolu = false;
                                if (loggedUser?.uloga === 'superadmin' || loggedUser?.uloga === 'admin') imaDozvolu = true; 
                                else imaDozvolu = (loggedUser?.dozvole || []).includes(modul.naziv);

                                if (!imaDozvolu && !isEditMode) return null; 

                                return (
                                    <div 
                                        key={modul.id}
                                        draggable={isEditMode}
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragEnter={(e) => handleDragEnter(e, index)}
                                        onDragEnd={handleDrop}
                                        onDragOver={(e) => e.preventDefault()}
                                        className={`relative ${isEditMode ? 'cursor-move animate-in zoom-in duration-200' : ''}`}
                                    >
                                        {isEditMode ? (
                                            <div className="bg-slate-900 border-2 border-amber-500 border-dashed p-4 rounded-2xl flex flex-col gap-2 opacity-95 hover:opacity-100 transition-all shadow-xl">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-amber-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-1">☰ <span className="text-slate-400">Povuci i spusti</span></span>
                                                    <span className="text-slate-500 text-[10px] uppercase font-bold">{modul.id}</span>
                                                </div>
                                                
                                                <input value={modul.naziv} onChange={(e) => updateModul(index, 'naziv', e.target.value)} className="p-3 bg-[#0f172a] text-white text-xs font-bold rounded-lg border border-slate-700 outline-none focus:border-amber-500" placeholder="Naziv kartice" />
                                                
                                                <div className="flex items-center gap-2 mt-1">
                                                    {/* COLOR PICKER ZA KARTICU */}
                                                    <div className="flex flex-col items-center bg-[#0f172a] p-2 rounded-lg border border-slate-700">
                                                        <span className="text-[8px] text-slate-500 mb-1 uppercase">Boja</span>
                                                        <input type="color" value={modul.hex_boja || '#1e293b'} onChange={(e) => updateModul(index, 'hex_boja', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-none bg-transparent" />
                                                    </div>
                                                    
                                                    {/* UPLOAD SLIKE ZA KARTICU */}
                                                    <div className="flex-1 flex flex-col bg-[#0f172a] p-2 rounded-lg border border-slate-700">
                                                        <span className="text-[8px] text-slate-500 mb-1 uppercase">Slika / Ikona</span>
                                                        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, index)} disabled={uploadingImage} className="w-full text-[9px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[9px] file:font-black file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer" />
                                                    </div>
                                                </div>
                                                
                                                {modul.slika_url && (
                                                    <div className="mt-2 flex items-center justify-between bg-black/30 p-2 rounded border border-slate-800">
                                                        <img src={modul.slika_url} alt="Ikona" className="h-6 w-6 object-contain" />
                                                        <button onClick={() => updateModul(index, 'slika_url', null)} className="text-[9px] text-red-500 hover:text-red-400 font-black">✕ Obriši sliku</button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            // PRIKAZ KARTICE SA GLOSSY/STAKLENIM EFEKTOM
                                            <div 
                                                onClick={() => setActiveModule(modul.id)}
                                                className="p-6 rounded-[2rem] flex items-center justify-center cursor-pointer transition-all hover:scale-105 shadow-[0_15px_35px_rgba(0,0,0,0.5)] h-32 relative overflow-hidden group border border-white/10"
                                                style={{ backgroundColor: modul.hex_boja || '#1e293b' }}
                                            >
                                                {/* GLOSSY OVERLAY (Sjaj odozgo prema dole) */}
                                                <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/50 pointer-events-none"></div>
                                                
                                                {/* SJAJNI UNUTRAŠNJI ODSJAJ NA VRHU KARTICE */}
                                                <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>

                                                {/* Ako ima sliku, stavi je kao blagu pozadinu */}
                                                {modul.slika_url && (
                                                    <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity bg-cover bg-center" style={{ backgroundImage: `url(${modul.slika_url})` }}></div>
                                                )}
                                                
                                                <div className="relative z-10 flex flex-col items-center gap-2">
                                                    {modul.slika_url ? (
                                                        <img src={modul.slika_url} alt={modul.naziv} className="w-10 h-10 object-contain drop-shadow-2xl" />
                                                    ) : (
                                                        <span className="text-3xl drop-shadow-2xl">{modul.ikona}</span>
                                                    )}
                                                    <h3 className="text-white font-black tracking-widest text-[11px] uppercase drop-shadow-md text-center">{modul.naziv}</h3>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

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
            ) : activeModule === 'lager' ? (
                <LagerPaketaModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('dashboard')} />
            ) : activeModule === 'ponude' ? (
                <PonudeModule onExit={() => setActiveModule('dashboard')} />
            ) : activeModule === 'radni_nalozi' ? (
                <RadniNaloziModule onExit={() => setActiveModule('dashboard')} />
            ) : activeModule === 'otpremnice' ? (
                <OtpremniceModule onExit={() => setActiveModule('dashboard')} />
            ) : activeModule === 'racuni' ? (
                <RacuniModule onExit={() => setActiveModule('dashboard')} />
            ) : activeModule === 'blagajna' ? (
                <BlagajnaModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('dashboard')} />
            ) : activeModule === 'toranj' ? (
                <KontrolniToranjModule onExit={() => setActiveModule('dashboard')} />
            ) : activeModule === 'dashboard' ? ( /* Pomoćni uslov zbog imena Analitike */
                <DashboardModule user={loggedUser} onExit={() => setActiveModule('dashboard')} />
            ) : activeModule === 'podesavanja' ? (
                <SettingsModule onExit={() => setActiveModule('dashboard')} />
            ) : null}
        </div>
    );
}