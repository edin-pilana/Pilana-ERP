"use client";
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CalendarDays, CheckCircle2, AlertCircle, ScanLine, X, LogIn, LogOut, UserCircle, ArrowLeft } from 'lucide-react';
import PametniDialog from '../components/PametniDialog';
import ScannerOverlay from '../components/ScannerOverlay';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function KioskModule() {
    const [vrijeme, setVrijeme] = useState(new Date());
    const [aktivnaAkcija, setAktivaAkcija] = useState(null); 
    
    const [sken, setSken] = useState('');
    const [poruka, setPoruka] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    
    const [radniciList, setRadniciList] = useState([]);
    const [filteredRadnici, setFilteredRadnici] = useState([]);
    const [radnikProfil, setRadnikProfil] = useState(null);

    const [showOdmorModal, setShowOdmorModal] = useState(false);
    const [formaOdmor, setFormaOdmor] = useState({ radnik_ime: '', tip: 'GODIŠNJI', razlog: '' });
    const [odsustvaZauzetost, setOdsustvaZauzetost] = useState({}); 

    const [trenutniMjesec, setTrenutniMjesec] = useState(new Date());
    const [datumOd, setDatumOd] = useState(null);
    const [datumDo, setDatumDo] = useState(null);
    const [potvrdaModal, setPotvrdaModal] = useState(null); 

    const inputRef = useRef(null);
    const isProcessingRef = useRef(false); // NEPROBOJNI ZID ZA SKENER
    const porukaTimeoutRef = useRef(null);

    useEffect(() => {
        const timer = setInterval(() => setVrijeme(new Date()), 1000);
        supabase.from('radnici').select('ime_prezime, username, qr_kod').then(({data}) => setRadniciList(data || []));
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (aktivnaAkcija && !isScanning && !radnikProfil && !showOdmorModal && !potvrdaModal) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [aktivnaAkcija, sken, isScanning, radnikProfil, showOdmorModal, potvrdaModal]);

    // Live pretraga za Kiosk
    useEffect(() => {
        if (!sken) { setFilteredRadnici([]); return; }
        const search = sken.toLowerCase();
        const results = radniciList.filter(r => 
            (r.ime_prezime && r.ime_prezime.toLowerCase().includes(search)) ||
            (r.username && r.username.toLowerCase().includes(search)) ||
            (r.qr_kod && r.qr_kod.toLowerCase().includes(search))
        );
        setFilteredRadnici(results);
    }, [sken, radniciList]);

    const ucitajZauzetost = async () => {
        const { data } = await supabase.from('zahtjevi_odsustva').select('datum_od, datum_do, status').neq('status', 'ODBIJENO');
        if (data) {
            let mapa = {};
            data.forEach(z => {
                let start = new Date(z.datum_od); let end = new Date(z.datum_do);
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    let dStr = d.toISOString().split('T')[0];
                    if(!mapa[dStr]) mapa[dStr] = { odobreno: 0, cekanje: 0 };
                    if (z.status === 'ODOBRENO') mapa[dStr].odobreno += 1;
                    else mapa[dStr].cekanje += 1;
                }
            });
            setOdsustvaZauzetost(mapa);
        }
    };

    const prikaziPrivremenuPoruku = (tip, tekst) => {
        setPoruka({ tip, tekst });
        if (porukaTimeoutRef.current) clearTimeout(porukaTimeoutRef.current);
        porukaTimeoutRef.current = setTimeout(() => {
            setPoruka(null);
            if (tip === 'success' && aktivnaAkcija !== 'PROFIL') {
                setAktivaAkcija(null);
            }
        }, 4000);
    };

    const procesuirajSkenId = async (unos) => {
        const unosZaObradu = unos || sken.trim();
        if (!unosZaObradu || isProcessingRef.current) return;
        
        // ZAKLJUČAVAMO SISTEM (Barijera za brzi skener)
        isProcessingRef.current = true; 
        setIsScanning(false); 
        setSken('');
        setFilteredRadnici([]);

        try {
            const { data: radniciPretraga } = await supabase.from('radnici').select('*')
                .or(`username.ilike.${unosZaObradu},ime_prezime.ilike.${unosZaObradu},qr_kod.eq.${unosZaObradu}`)
                .limit(1);
            
            if (!radniciPretraga || radniciPretraga.length === 0) {
                prikaziPrivremenuPoruku('error', `Radnik/Kartica "${unosZaObradu}" nije pronađen u bazi.`);
                return;
            }

            const radnik = radniciPretraga[0];
            const ime = radnik.ime_prezime;
            const danas = new Date().toISOString().split('T')[0];
            const sada = new Date().toISOString();

            if (aktivnaAkcija === 'PRIJAVA') {
                const { data: otvoreniZapis } = await supabase.from('radni_sati').select('id').eq('radnik_ime', ime).eq('datum', danas).eq('status', 'NA_POSLU').limit(1);
                const { data: zatvoreniZapis } = await supabase.from('radni_sati').select('id').eq('radnik_ime', ime).eq('datum', danas).eq('status', 'ZAVRŠIO').limit(1);
                
                if (otvoreniZapis && otvoreniZapis.length > 0) {
                    prikaziPrivremenuPoruku('error', `⚠️ ${ime}, vi ste već prijavljeni na posao!`);
                } else if (zatvoreniZapis && zatvoreniZapis.length > 0) {
                    prikaziPrivremenuPoruku('error', `⚠️ ${ime}, vi ste već završili smjenu za danas!`);
                } else {
                    const { error } = await supabase.from('radni_sati').insert([{ radnik_ime: ime, datum: danas, vrijeme_dolaska: sada, status: 'NA_POSLU' }]);
                    if (error) throw error;
                    prikaziPrivremenuPoruku('success', `✅ Dobrodošli, ${ime}! Prijava u ${new Date().toLocaleTimeString('de-DE')}.`);
                }
            } 
            else if (aktivnaAkcija === 'ODJAVA') {
                // Tražimo sve otvorene zapise u slučaju da se desio duplikat bug od ranije!
                const { data: otvoreniZapisi } = await supabase.from('radni_sati').select('id').eq('radnik_ime', ime).eq('datum', danas).eq('status', 'NA_POSLU');
                
                if (otvoreniZapisi && otvoreniZapisi.length > 0) {
                    for (let z of otvoreniZapisi) {
                        await supabase.from('radni_sati').update({ vrijeme_odlaska: sada, status: 'ZAVRŠIO' }).eq('id', z.id);
                    }
                    prikaziPrivremenuPoruku('success', `👋 Doviđenja, ${ime}! Odjava u ${new Date().toLocaleTimeString('de-DE')}.`);
                } else {
                    prikaziPrivremenuPoruku('error', `⚠️ ${ime}, niste prijavljeni na posao za današnji dan!`);
                }
            }
            else if (aktivnaAkcija === 'PROFIL') {
                const { data: zahtjevi } = await supabase.from('zahtjevi_odsustva').select('*').eq('radnik_ime', ime).order('created_at', { ascending: false }).limit(3);
                setRadnikProfil({ radnik, zahtjevi: zahtjevi || [] });
                setAktivaAkcija(null); 
            }
        } catch (err) {
            prikaziPrivremenuPoruku('error', `Sistemska greška: ${err.message}`);
        } finally {
            // Oslobađamo lock tek nakon 2 sekunde
            setTimeout(() => { isProcessingRef.current = false; }, 2000);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            procesuirajSkenId();
        }
    };

    const zatvoriSveModale = () => {
        setRadnikProfil(null);
        setShowOdmorModal(false);
        setPotvrdaModal(null);
        setAktivaAkcija(null);
        setSken('');
        setFilteredRadnici([]);
        setIsScanning(false);
    };

    const pokreniZahtjevIzProfila = () => {
        setFormaOdmor(prev => ({ ...prev, radnik_ime: radnikProfil.radnik.ime_prezime }));
        setRadnikProfil(null);
        ucitajZauzetost();
        setTrenutniMjesec(new Date());
        setDatumOd(null); setDatumDo(null);
        setTimeout(() => setShowOdmorModal(true), 100); 
    };

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => { let day = new Date(year, month, 1).getDay(); return day === 0 ? 6 : day - 1; };
    const daniUMjesecu = getDaysInMonth(trenutniMjesec.getFullYear(), trenutniMjesec.getMonth());
    const praznaPoljaNaPocetku = getFirstDayOfMonth(trenutniMjesec.getFullYear(), trenutniMjesec.getMonth());
    const daniNiz = Array.from({length: daniUMjesecu}, (_, i) => i + 1);
    
    const handleDatumClick = (dan) => {
        const kliknutiDatum = new Date(trenutniMjesec.getFullYear(), trenutniMjesec.getMonth(), dan);
        const danasPocetak = new Date(); danasPocetak.setHours(0,0,0,0);
        if (kliknutiDatum < danasPocetak) return; 

        if (!datumOd || (datumOd && datumDo)) { setDatumOd(kliknutiDatum); setDatumDo(null); } 
        else if (datumOd && !datumDo) {
            if (kliknutiDatum < datumOd) { setDatumOd(kliknutiDatum); } 
            else { setDatumDo(kliknutiDatum); zatraziOdmorInteraktivno(datumOd, kliknutiDatum); }
        }
    };

    const zatraziOdmorJedanDan = () => { if(datumOd && !datumDo) zatraziOdmorInteraktivno(datumOd, datumOd); };

    const zatraziOdmorInteraktivno = async (startD, endD) => {
        let brojDana = 0;
        for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) { const day = d.getDay(); if (day !== 0 && day !== 6) brojDana++; }
        const pocetakStr = startD.toLocaleDateString('bs-BA');
        const krajStr = endD.toLocaleDateString('bs-BA');
        const istiDan = pocetakStr === krajStr;
        setPotvrdaModal({ radnik: formaOdmor.radnik_ime, tip: formaOdmor.tip, pocetakStr, krajStr, istiDan, brojDana, startD, endD });
    };

    const posaljiKrajnjiZahtjev = async () => {
        const p = potvrdaModal;
        const payload = { radnik_ime: p.radnik, tip_odsustva: p.tip, datum_od: p.startD.toISOString().split('T')[0], datum_do: p.endD.toISOString().split('T')[0], broj_radnih_dana: p.brojDana, razlog: formaOdmor.razlog, status: 'NA ČEKANJU', inicijativa: 'RADNIK' };
        const { error } = await supabase.from('zahtjevi_odsustva').insert([payload]);
        if (error) { prikaziPrivremenuPoruku('error', error.message); }
        else {
            zatvoriSveModale();
            prikaziPrivremenuPoruku('success', `✅ Zahtjev za odmor uspješno poslan!`);
        }
    };

    return (
        <div className="min-h-screen bg-[#090e17] text-white flex flex-col items-center p-4 md:p-6 relative font-sans overflow-x-hidden overflow-y-auto">
            
            <div className="fixed top-[-20%] left-[-10%] w-96 h-96 bg-blue-600/20 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="fixed bottom-[-20%] right-[-10%] w-96 h-96 bg-emerald-600/20 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="text-center z-10 mb-8 md:mb-12 mt-6">
                <h1 className="text-6xl md:text-[8vw] font-black tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 drop-shadow-2xl">
                    {vrijeme.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </h1>
                <p className="text-lg md:text-3xl text-blue-400 font-bold tracking-widest uppercase mt-2 md:mt-4">
                    {vrijeme.toLocaleDateString('bs-BA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
            </div>

            {!aktivnaAkcija && !radnikProfil && !showOdmorModal && (
                <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 z-10 animate-in fade-in zoom-in-95">
                    <button onClick={() => setAktivaAkcija('PRIJAVA')} className="bg-emerald-900/40 border-2 border-emerald-500/50 hover:bg-emerald-600 rounded-[2rem] p-8 md:p-12 flex flex-col items-center justify-center gap-4 transition-all shadow-[0_0_40px_rgba(16,185,129,0.15)] hover:shadow-[0_0_60px_rgba(16,185,129,0.4)] group">
                        <LogIn className="w-16 h-16 md:w-24 md:h-24 text-emerald-400 group-hover:text-white transition-colors" />
                        <span className="text-2xl md:text-3xl font-black uppercase tracking-widest text-emerald-100 group-hover:text-white">Prijava na Posao</span>
                    </button>
                    
                    <button onClick={() => setAktivaAkcija('ODJAVA')} className="bg-red-900/40 border-2 border-red-500/50 hover:bg-red-600 rounded-[2rem] p-8 md:p-12 flex flex-col items-center justify-center gap-4 transition-all shadow-[0_0_40px_rgba(239,68,68,0.15)] hover:shadow-[0_0_60px_rgba(239,68,68,0.4)] group">
                        <LogOut className="w-16 h-16 md:w-24 md:h-24 text-red-400 group-hover:text-white transition-colors" />
                        <span className="text-2xl md:text-3xl font-black uppercase tracking-widest text-red-100 group-hover:text-white">Odjava sa Posla</span>
                    </button>

                    <button onClick={() => setAktivaAkcija('PROFIL')} className="md:col-span-2 bg-blue-900/40 border-2 border-blue-500/50 hover:bg-blue-600 rounded-[2rem] p-6 md:p-10 flex flex-col items-center justify-center gap-4 transition-all shadow-[0_0_40px_rgba(59,130,246,0.15)] hover:shadow-[0_0_60px_rgba(59,130,246,0.4)] group">
                        <UserCircle className="w-12 h-12 md:w-16 md:h-16 text-blue-400 group-hover:text-white transition-colors" />
                        <span className="text-xl md:text-2xl font-black uppercase tracking-widest text-blue-100 group-hover:text-white">Moj Profil / Zahtjev za Odmor</span>
                    </button>
                </div>
            )}

            {aktivnaAkcija && !radnikProfil && (
                <div className="w-full max-w-2xl bg-slate-900/80 backdrop-blur-xl border-2 border-slate-700 p-6 md:p-10 rounded-3xl md:rounded-[3rem] shadow-2xl z-10 flex flex-col items-center animate-in slide-in-from-bottom-8">
                    <button onClick={() => {setAktivaAkcija(null); setPoruka(null); setSken(''); setFilteredRadnici([]);}} className="absolute top-6 left-6 text-slate-400 hover:text-white flex items-center gap-2 font-black uppercase text-xs bg-black/40 px-4 py-2 rounded-xl transition-colors">
                        <ArrowLeft size={16}/> Nazad
                    </button>

                    <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mb-6 mt-8 md:mt-4 border-4 shadow-lg ${aktivnaAkcija === 'PRIJAVA' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/50' : (aktivnaAkcija === 'ODJAVA' ? 'bg-red-900/30 text-red-400 border-red-500/50' : 'bg-blue-900/30 text-blue-400 border-blue-500/50')}`}>
                        {aktivnaAkcija === 'PRIJAVA' ? <LogIn size={40}/> : (aktivnaAkcija === 'ODJAVA' ? <LogOut size={40}/> : <UserCircle size={40}/>)}
                    </div>
                    
                    <h2 className="text-xl md:text-3xl font-black uppercase tracking-widest mb-2 text-center">{aktivnaAkcija}</h2>
                    <p className="text-slate-400 text-xs md:text-sm mb-8 text-center">Prislonite ID karticu ili ukucajte ime u polje ispod.</p>

                    <div className="w-full max-w-md flex bg-black/80 border-2 border-slate-600 focus-within:border-white rounded-2xl overflow-visible shadow-inner transition-colors relative z-20">
                        <div className="flex-1 relative">
                            <input 
                                ref={inputRef} type="text" value={sken} 
                                onChange={(e) => setSken(e.target.value)} onKeyDown={handleKeyDown}
                                className="w-full h-full p-5 md:p-6 text-center text-xl md:text-2xl font-black text-white uppercase tracking-widest bg-transparent outline-none"
                                placeholder="KARTICA / IME" autoFocus
                            />
                            {sken && filteredRadnici.length > 0 && (
                                <div className="absolute top-full mt-2 w-full bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden z-50">
                                    {filteredRadnici.map(r => (
                                        <div key={r.id} onClick={() => procesuirajSkenId(r.qr_kod || r.username || r.ime_prezime)} className="p-4 border-b border-slate-700 hover:bg-blue-600 cursor-pointer transition-colors text-left">
                                            <p className="font-black text-white">{r.ime_prezime}</p>
                                            <p className="text-[10px] text-slate-400">ID: {r.qr_kod || r.username}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button onClick={() => setIsScanning(true)} className="w-16 md:w-24 shrink-0 bg-slate-800 text-white hover:bg-slate-700 transition-all flex items-center justify-center border-l border-slate-600 z-10 relative">
                            <ScanLine className="w-6 h-6 md:w-8 md:h-8"/>
                        </button>
                    </div>

                    {poruka && (
                        <div className={`mt-8 w-full p-4 md:p-6 rounded-2xl flex items-center justify-center gap-3 animate-in zoom-in font-black text-sm md:text-lg border ${poruka.tip === 'success' ? 'bg-emerald-900/40 text-emerald-400 border-emerald-500/50' : 'bg-red-900/40 text-red-400 border-red-500/50'}`}>
                            {poruka.tip === 'success' ? <CheckCircle2 className="w-6 h-6 shrink-0" /> : <AlertCircle className="w-6 h-6 shrink-0" />}
                            <span className="text-center leading-tight">{poruka.tekst}</span>
                        </div>
                    )}
                </div>
            )}

            {radnikProfil && (
                <div className="fixed inset-0 z-[10020] bg-black/95 flex items-center justify-center p-4 backdrop-blur-xl animate-in zoom-in-95">
                    <div className="bg-theme-card border-2 border-blue-500 p-6 md:p-10 rounded-[2rem] shadow-[0_0_80px_rgba(59,130,246,0.3)] max-w-3xl w-full flex flex-col relative max-h-[95vh] overflow-y-auto">
                        <button onClick={zatvoriSveModale} className="absolute top-4 right-4 bg-slate-800 w-12 h-12 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-500 transition-colors z-50 shadow-lg"><X size={24}/></button>
                        
                        <div className="text-center border-b border-theme-border pb-6 mb-6 mt-8 md:mt-0">
                            <div className="w-20 h-20 md:w-24 md:h-24 mx-auto rounded-full flex items-center justify-center mb-4 border-4 shadow-lg bg-blue-900/30 text-blue-400 border-blue-500">
                                <UserCircle size={48}/>
                            </div>
                            <h2 className="text-2xl md:text-4xl font-black uppercase tracking-widest text-white mb-2">{radnikProfil.radnik.ime_prezime}</h2>
                            <p className="text-sm md:text-lg font-bold uppercase tracking-widest text-slate-400">Vaš Profil i Evidencija</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
                            <div className="bg-theme-panel p-6 rounded-2xl border border-theme-border shadow-inner">
                                <h4 className="text-xs text-slate-400 font-black uppercase tracking-widest mb-4">Vaš Godišnji Odmor</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                                        <span className="text-sm text-slate-300">Ukupno pripada:</span>
                                        <span className="text-base font-black text-white">{radnikProfil.radnik.godisnji_ukupno || 20} d</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                                        <span className="text-sm text-slate-300">Iskorišteno:</span>
                                        <span className="text-base font-black text-amber-400">{(radnikProfil.radnik.godisnji_iskoristeno_radnik || 0) + (radnikProfil.radnik.godisnji_iskoristeno_poslodavac || 0)} d</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2">
                                        <span className="text-base font-bold text-slate-300">PREOSTALO:</span>
                                        <span className="text-3xl font-black text-emerald-400">
                                            {(radnikProfil.radnik.godisnji_ukupno || 20) - ((radnikProfil.radnik.godisnji_iskoristeno_radnik || 0) + (radnikProfil.radnik.godisnji_iskoristeno_poslodavac || 0))} d
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-theme-panel p-6 rounded-2xl border border-theme-border shadow-inner flex flex-col">
                                <h4 className="text-xs text-slate-400 font-black uppercase tracking-widest mb-4">Status Vaših Zahtjeva</h4>
                                <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
                                    {radnikProfil.zahtjevi.length === 0 ? (
                                        <p className="text-sm text-slate-500 italic mt-4 text-center">Nemate nedavnih zahtjeva.</p>
                                    ) : (
                                        radnikProfil.zahtjevi.map(z => (
                                            <div key={z.id} className="flex justify-between items-center p-3 border-b border-slate-700/50 last:border-0 bg-black/20 rounded-xl mb-2">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-white uppercase">{z.tip_odsustva}</span>
                                                    <span className="text-[10px] text-slate-400 mt-1">{new Date(z.datum_od).toLocaleDateString('de-DE')} - {new Date(z.datum_do).toLocaleDateString('de-DE')}</span>
                                                </div>
                                                <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg ${z.status === 'ODOBRENO' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' : (z.status === 'ODBIJENO' ? 'bg-red-900/30 text-red-400 border border-red-500/30' : 'bg-amber-900/30 text-amber-400 border border-amber-500/30')}`}>
                                                    {z.status}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 mt-auto">
                            <button onClick={pokreniZahtjevIzProfila} className="flex-[2] py-5 md:py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl uppercase font-black text-sm md:text-base transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] flex items-center justify-center gap-3">
                                <CalendarDays size={24} /> ZATRAŽI ODMOR / SLOBODNO
                            </button>
                            <button onClick={zatvoriSveModale} className="flex-1 py-5 md:py-6 bg-slate-800 hover:bg-slate-700 text-white hover:text-white rounded-2xl uppercase font-black text-sm md:text-base transition-colors border-2 border-slate-600">
                                ✕ NAZAD NA EKRAN
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showOdmorModal && (
                <div className="fixed inset-0 bg-black/95 z-[9990] flex items-center justify-center p-2 md:p-4 backdrop-blur-md animate-in fade-in overflow-y-auto">
                    <div className="bg-theme-card border-2 border-amber-500 p-4 md:p-8 rounded-2xl md:rounded-[2rem] w-full max-w-5xl shadow-[0_0_80px_rgba(245,158,11,0.15)] relative flex flex-col mt-10 md:mt-0">
                        <button onClick={zatvoriSveModale} className="absolute top-4 right-4 md:top-6 md:right-6 w-10 h-10 md:w-12 md:h-12 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-500 transition-colors font-black text-lg md:text-xl z-50 shadow-lg"><X/></button>
                        
                        <div className="mb-6 md:mb-8 border-b border-slate-800 pb-4 pr-12 md:pr-0">
                            <h2 className="text-xl md:text-2xl text-amber-500 font-black uppercase tracking-widest flex items-center gap-2 md:gap-3">🏖️ Rezervacija Odsustva</h2>
                            <p className="text-white text-sm md:text-lg mt-2 font-bold bg-slate-800 inline-block px-3 py-1 rounded-lg border border-slate-600">Radnik: {formaOdmor.radnik_ime}</p>
                        </div>

                        <div className="flex flex-col lg:flex-row gap-6 md:gap-8 flex-1 min-h-0">
                            <div className="w-full lg:w-1/3 space-y-4 md:space-y-6">
                                <div className="relative z-40">
                                    <label className="text-[9px] md:text-[10px] text-amber-500 font-black uppercase mb-2 block tracking-widest">1. Tip Odsustva</label>
                                    <select value={formaOdmor.tip} onChange={e=>setFormaOdmor({...formaOdmor, tip: e.target.value})} className="w-full p-4 md:p-5 bg-black border-2 border-slate-700 focus:border-amber-500 rounded-xl md:rounded-2xl text-white outline-none uppercase font-bold cursor-pointer shadow-inner text-xs md:text-sm">
                                        <option value="GODIŠNJI">Godišnji Odmor (Plaćeno)</option>
                                        <option value="BOLOVANJE">Bolovanje (Privremeno)</option>
                                        <option value="SLOBODNO">Slobodan dan (Neplaćeno)</option>
                                    </select>
                                </div>

                                <div className="relative z-30">
                                    <label className="text-[9px] md:text-[10px] text-amber-500 font-black uppercase mb-2 block tracking-widest">2. Razlog (Opciono)</label>
                                    <textarea value={formaOdmor.razlog} onChange={e=>setFormaOdmor({...formaOdmor, razlog: e.target.value})} className="w-full p-3 md:p-4 bg-black border-2 border-slate-700 focus:border-amber-500 rounded-xl md:rounded-2xl text-white outline-none shadow-inner resize-none text-xs md:text-sm" placeholder="Dodatna napomena..." rows="3"></textarea>
                                </div>

                                {datumOd && !datumDo && (
                                    <button onClick={zatraziOdmorJedanDan} className="w-full py-4 md:py-5 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl md:rounded-2xl uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all animate-in zoom-in-95 text-xs md:text-sm">Zatraži samo ovaj 1 dan</button>
                                )}
                            </div>

                            <div className="flex-1 bg-black/40 border-2 border-slate-800 p-4 md:p-6 rounded-2xl md:rounded-3xl flex flex-col select-none relative z-10">
                                <div className="flex justify-between items-center mb-4 md:mb-6">
                                    <button onClick={() => setTrenutniMjesec(new Date(trenutniMjesec.getFullYear(), trenutniMjesec.getMonth() - 1, 1))} className="p-3 md:p-4 bg-slate-800 hover:bg-amber-600 rounded-xl transition-colors"><ChevronLeft className="w-4 h-4 md:w-6 md:h-6"/></button>
                                    <h3 className="text-lg md:text-2xl font-black uppercase tracking-widest text-amber-500">
                                        {trenutniMjesec.toLocaleDateString('bs-BA', { month: 'long', year: 'numeric' })}
                                    </h3>
                                    <button onClick={() => setTrenutniMjesec(new Date(trenutniMjesec.getFullYear(), trenutniMjesec.getMonth() + 1, 1))} className="p-3 md:p-4 bg-slate-800 hover:bg-amber-600 rounded-xl transition-colors"><ChevronRight className="w-4 h-4 md:w-6 md:h-6"/></button>
                                </div>

                                <div className="grid grid-cols-7 gap-1 md:gap-2 flex-1">
                                    {['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'].map(d => <div key={d} className="text-center text-[8px] md:text-[10px] text-slate-500 font-black uppercase pb-1 md:pb-2">{d}</div>)}
                                    {Array.from({length: praznaPoljaNaPocetku}).map((_, i) => <div key={`empty-${i}`} />)}
                                    
                                    {daniNiz.map((dan) => {
                                        const dateObj = new Date(trenutniMjesec.getFullYear(), trenutniMjesec.getMonth(), dan);
                                        const iso = dateObj.toISOString().split('T')[0];
                                        const zauz = odsustvaZauzetost[iso];
                                        const danasPocetak = new Date(); danasPocetak.setHours(0,0,0,0);
                                        const jeProsli = dateObj < danasPocetak;
                                        const jeVikend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                                        const isStart = datumOd && iso === datumOd.toISOString().split('T')[0];
                                        const isEnd = datumDo && iso === datumDo.toISOString().split('T')[0];
                                        const inRange = datumOd && datumDo && dateObj > datumOd && dateObj < datumDo;
                                        
                                        let bgClass = jeVikend ? 'bg-slate-900/50 text-slate-500' : 'bg-slate-800 hover:bg-slate-700 cursor-pointer';
                                        let borderClass = 'border-transparent';
                                        
                                        if (isStart || isEnd) { bgClass = 'bg-amber-600 text-white shadow-lg'; borderClass = 'border-amber-400'; }
                                        else if (inRange) { bgClass = 'bg-amber-900/40 text-amber-200'; borderClass = 'border-amber-500/30'; }
                                        else if (jeProsli) { bgClass = 'bg-black text-slate-700 cursor-not-allowed'; }

                                        return (
                                            <div key={dan} onClick={() => !jeProsli && handleDatumClick(dan)} className={`aspect-square rounded-lg md:rounded-2xl flex flex-col justify-center items-center border md:border-2 transition-all relative ${bgClass} ${borderClass}`}>
                                                <span className="text-sm md:text-xl font-black">{dan}</span>
                                                {zauz && !isStart && !isEnd && !inRange && !jeProsli && (
                                                    <div className="absolute bottom-1 md:bottom-2 flex gap-0.5 md:gap-1 justify-center">
                                                        {Array.from({length: Math.min(3, zauz.odobreno)}).map((_, i) => <div key={`o${i}`} className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-red-500 shadow-[0_0_5px_red]"></div>)}
                                                        {Array.from({length: Math.min(3, zauz.cekanje)}).map((_, i) => <div key={`c${i}`} className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-amber-500 shadow-[0_0_5px_orange]"></div>)}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                <p className="text-center text-[8px] md:text-[10px] text-slate-500 mt-4 md:mt-6 font-bold uppercase tracking-widest"><span className="text-red-500 mx-1">●</span> Odobreni odmori (Gužva) <span className="text-amber-500 ml-2 md:ml-4 mx-1">●</span> Na čekanju</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {potvrdaModal && (
                <div className="fixed inset-0 z-[10030] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-theme-card border-2 border-amber-500 p-6 md:p-8 rounded-[2rem] shadow-[0_0_50px_rgba(245,158,11,0.5)] max-w-md w-full text-center flex flex-col items-center">
                        <div className="w-16 h-16 bg-amber-600 text-white rounded-full flex items-center justify-center mb-4"><CalendarDays size={32}/></div>
                        <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest text-white mb-2">Potvrda Odsustva</h2>
                        
                        <div className="bg-theme-panel p-4 rounded-xl border border-theme-border w-full mb-6">
                            <p className="text-[10px] md:text-[11px] text-slate-400 uppercase font-black mb-1">Zatražiti <span className="text-amber-500">{potvrdaModal.tip}</span> za period:</p>
                            <p className="text-base md:text-lg font-black text-white mt-2">
                                {potvrdaModal.istiDan ? potvrdaModal.pocetakStr : `od ${potvrdaModal.pocetakStr} do ${potvrdaModal.krajStr}`}
                            </p>
                            <p className="text-[9px] md:text-[10px] text-slate-500 uppercase font-bold mt-3">(Okvirno radnih dana: {potvrdaModal.brojDana})</p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
                            <button onClick={() => { setPotvrdaModal(null); setDatumOd(null); setDatumDo(null); }} className="flex-1 py-4 bg-theme-panel border border-slate-600 rounded-xl text-white font-black uppercase text-xs hover:bg-slate-700 transition-all">✕ OTKAŽI</button>
                            <button onClick={posaljiKrajnjiZahtjev} className="flex-[2] py-4 bg-amber-600 rounded-xl text-white font-black uppercase text-xs hover:bg-amber-500 transition-all shadow-[0_0_20px_rgba(245,158,11,0.5)]">✅ POŠALJI UPRAVI</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="relative z-[10010]">
                {isScanning && <ScannerOverlay onScan={(text) => { setIsScanning(false); procesuirajSkenId(text); }} onClose={() => setIsScanning(false)} />}
            </div>
        </div>
    );
}