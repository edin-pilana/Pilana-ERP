"use client";
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CalendarDays, CheckCircle2, UserCheck, AlertCircle, ScanLine, ChevronLeft, ChevronRight, X, Info } from 'lucide-react';
import PametniDialog from '../components/PametniDialog';
import ScannerOverlay from '../components/ScannerOverlay';
import MasterSearch from '../components/MasterSearch';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function KioskModule() {
    const [vrijeme, setVrijeme] = useState(new Date());
    const [sken, setSken] = useState('');
    const [poruka, setPoruka] = useState(null);
    const [isScanningKiosk, setIsScanningKiosk] = useState(false);
    const [isScanningModal, setIsScanningModal] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false); // Blokada duplog skeniranja
    
    const [radniciList, setRadniciList] = useState([]);

    // NOVO: Profil radnika koji iskače nakon skeniranja
    const [radnikProfil, setRadnikProfil] = useState(null);

    // Odmor Modal i Kalendar State
    const [showOdmorModal, setShowOdmorModal] = useState(false);
    const [formaOdmor, setFormaOdmor] = useState({ radnik_ime: '', tip: 'GODIŠNJI', razlog: '' });
    const [odsustvaZauzetost, setOdsustvaZauzetost] = useState({}); 

    // Interaktivni kalendar
    const [trenutniMjesec, setTrenutniMjesec] = useState(new Date());
    const [datumOd, setDatumOd] = useState(null);
    const [datumDo, setDatumDo] = useState(null);

    const [potvrdaModal, setPotvrdaModal] = useState(null); 

    const inputRef = useRef(null);

    useEffect(() => {
        const timer = setInterval(() => setVrijeme(new Date()), 1000);
        supabase.from('radnici').select('ime_prezime, username, qr_kod').then(({data}) => setRadniciList(data || []));
        return () => clearInterval(timer);
    }, []);

    const ucitajZauzetost = async () => {
        const { data } = await supabase.from('zahtjevi_odsustva').select('datum_od, datum_do, status').neq('status', 'ODBIJENO');
        if (data) {
            let mapa = {};
            data.forEach(z => {
                let start = new Date(z.datum_od);
                let end = new Date(z.datum_do);
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
        setTimeout(() => setPoruka(null), 5000);
    };

    const procesuirajSkenId = async (unos) => {
        if (!unos || isProcessing) return;
        setIsProcessing(true); // Zaključaj dok ne završi obradu

        const { data: radnik } = await supabase.from('radnici').select('*').or(`username.ilike.${unos},ime_prezime.ilike.${unos},qr_kod.eq.${unos}`).maybeSingle();
        
        if (!radnik) {
            prikaziPrivremenuPoruku('error', `Radnik/Kartica "${unos}" nije pronađen u bazi.`);
            setSken('');
            setIsProcessing(false);
            return;
        }

        const ime = radnik.ime_prezime;
        const danas = new Date().toISOString().split('T')[0];
        const sada = new Date().toISOString();

        let akcijaTekst = '';
        let akcijaTip = '';

        const { data: otvoreniZapis } = await supabase.from('radni_sati').select('*').eq('radnik_ime', ime).eq('datum', danas).eq('status', 'NA_POSLU').maybeSingle();

        if (otvoreniZapis) {
            const { error } = await supabase.from('radni_sati').update({ vrijeme_odlaska: sada, status: 'ZAVRŠIO' }).eq('id', otvoreniZapis.id);
            if (error) { prikaziPrivremenuPoruku('error', error.message); setIsProcessing(false); return; }
            akcijaTekst = `Odjava uspješna u ${new Date().toLocaleTimeString('de-DE')}`;
            akcijaTip = 'ODJAVA';
        } else {
            const { data: zatvoreniZapis } = await supabase.from('radni_sati').select('*').eq('radnik_ime', ime).eq('datum', danas).eq('status', 'ZAVRŠIO').maybeSingle();
            if (zatvoreniZapis) {
                akcijaTekst = `Vi ste već završili smjenu za danas!`;
                akcijaTip = 'GRESKA';
            } else {
                const { error } = await supabase.from('radni_sati').insert([{ radnik_ime: ime, datum: danas, vrijeme_dolaska: sada, status: 'NA_POSLU' }]);
                if (error) { prikaziPrivremenuPoruku('error', error.message); setIsProcessing(false); return; }
                akcijaTekst = `Prijava uspješna u ${new Date().toLocaleTimeString('de-DE')}`;
                akcijaTip = 'PRIJAVA';
            }
        }

        // Dohvatanje nedavnih zahtjeva za godišnji za ovog radnika
        const { data: zahtjevi } = await supabase.from('zahtjevi_odsustva')
            .select('*').eq('radnik_ime', ime).order('created_at', { ascending: false }).limit(3);

        setSken('');
        setIsProcessing(false);

        // Prikazujemo lični panel radniku na 10 sekundi
        setRadnikProfil({
            radnik,
            akcijaTekst,
            akcijaTip,
            zahtjevi: zahtjevi || []
        });

        // Automatsko zatvaranje profila nakon 10 sekundi
        setTimeout(() => setRadnikProfil(null), 10000);
    };

    const otvoriMeniZaOdmor = () => {
        ucitajZauzetost();
        setTrenutniMjesec(new Date());
        setDatumOd(null); setDatumDo(null);
        setShowOdmorModal(true);
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

        if (!datumOd || (datumOd && datumDo)) {
            setDatumOd(kliknutiDatum); setDatumDo(null);
        } else if (datumOd && !datumDo) {
            if (kliknutiDatum < datumOd) {
                setDatumOd(kliknutiDatum);
            } else {
                setDatumDo(kliknutiDatum);
                zatraziOdmorInteraktivno(datumOd, kliknutiDatum);
            }
        }
    };

    const zatraziOdmorJedanDan = () => {
        if(datumOd && !datumDo) zatraziOdmorInteraktivno(datumOd, datumOd);
    };

    const zatraziOdmorInteraktivno = async (startD, endD) => {
        if (!formaOdmor.radnik_ime) {
            setPoruka({tip: 'error', tekst: "Prvo ukucajte Vaš ID sa lijeve strane!"});
            setDatumOd(null); setDatumDo(null); return;
        }

        const { data: radnik } = await supabase.from('radnici').select('ime_prezime').or(`username.ilike.${formaOdmor.radnik_ime},ime_prezime.ilike.${formaOdmor.radnik_ime},qr_kod.eq.${formaOdmor.radnik_ime}`).maybeSingle();
        if (!radnik) {
            setPoruka({tip: 'error', tekst: "ID koji ste ukucali ne postoji u sistemu."});
            setDatumOd(null); setDatumDo(null); return;
        }

        let brojDana = 0;
        for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
            const day = d.getDay();
            if (day !== 0 && day !== 6) brojDana++; 
        }

        const pocetakStr = startD.toLocaleDateString('bs-BA');
        const krajStr = endD.toLocaleDateString('bs-BA');
        const istiDan = pocetakStr === krajStr;

        setPotvrdaModal({
            radnik: radnik.ime_prezime,
            tip: formaOdmor.tip,
            pocetakStr, krajStr, istiDan, brojDana,
            startD, endD
        });
    };

    const posaljiKrajnjiZahtjev = async () => {
        const p = potvrdaModal;
        const payload = { radnik_ime: p.radnik, tip_odsustva: p.tip, datum_od: p.startD.toISOString().split('T')[0], datum_do: p.endD.toISOString().split('T')[0], broj_radnih_dana: p.brojDana, razlog: formaOdmor.razlog, status: 'NA ČEKANJU', inicijativa: 'RADNIK' };
        
        const { error } = await supabase.from('zahtjevi_odsustva').insert([payload]);
        
        setPotvrdaModal(null);
        if (error) { setPoruka({tip: 'error', tekst: error.message}); }
        else {
            setShowOdmorModal(false);
            setFormaOdmor({ radnik_ime: '', tip: 'GODIŠNJI', razlog: '' });
            setDatumOd(null); setDatumDo(null);
            prikaziPrivremenuPoruku('success', `✅ Zahtjev za odmor je poslan upravi!`);
        }
    };

    return (
        <div className="min-h-screen bg-[#090e17] text-white flex flex-col items-center justify-center p-4 md:p-6 relative font-sans overflow-x-hidden overflow-y-auto">
            
            {/* NOVI MODAL ZAKUCAN PREKO SVEGA (Z-INDEX 10000) */}
            {potvrdaModal && (
                <div className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-theme-card border-2 border-blue-500 p-6 md:p-8 rounded-[2rem] shadow-[0_0_50px_rgba(59,130,246,0.5)] max-w-md w-full text-center flex flex-col items-center">
                        <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center mb-4"><span className="text-3xl">ℹ️</span></div>
                        <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest text-white mb-2">Potvrda Odsustva</h2>
                        <p className="text-slate-400 text-xs md:text-sm mb-6">Radnik: <span className="text-blue-400 font-bold">{potvrdaModal.radnik}</span></p>
                        
                        <div className="bg-theme-panel p-4 rounded-xl border border-theme-border w-full mb-6">
                            <p className="text-[10px] md:text-[11px] text-slate-400 uppercase font-black mb-1">Želite li zatražiti <span className="text-amber-500">{potvrdaModal.tip}</span> za period:</p>
                            <p className="text-base md:text-lg font-black text-white mt-2">
                                {potvrdaModal.istiDan ? potvrdaModal.pocetakStr : `od ${potvrdaModal.pocetakStr} do ${potvrdaModal.krajStr}`}
                            </p>
                            <p className="text-[9px] md:text-[10px] text-slate-500 uppercase font-bold mt-3">(Okvirno radnih dana: {potvrdaModal.brojDana})</p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
                            <button onClick={() => { setPotvrdaModal(null); setDatumOd(null); setDatumDo(null); }} className="flex-1 py-4 bg-theme-panel border border-slate-600 rounded-xl text-white font-black uppercase text-xs hover:bg-slate-700 transition-all flex items-center justify-center gap-2">✕ OTKAŽI</button>
                            <button onClick={posaljiKrajnjiZahtjev} className="flex-[2] py-4 bg-blue-600 rounded-xl text-white font-black uppercase text-xs hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.5)] flex items-center justify-center gap-2">✅ POŠALJI UPRAVI</button>
                        </div>
                    </div>
                </div>
            )}

            {/* LIČNI PROFIL RADNIKA KOJI ISKAČE NA 10 SEKUNDI NAKON PRIJAVE */}
            {radnikProfil && (
                <div className="fixed inset-0 z-[10020] bg-[#090e17]/95 flex items-center justify-center p-4 backdrop-blur-xl animate-in zoom-in-95">
                    <div className="bg-theme-card border-2 border-emerald-500 p-6 md:p-10 rounded-[2rem] shadow-[0_0_80px_rgba(16,185,129,0.3)] max-w-2xl w-full flex flex-col relative">
                        <button onClick={() => setRadnikProfil(null)} className="absolute top-4 right-4 bg-slate-800 w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-500 transition-colors z-50">✕</button>
                        
                        <div className="text-center border-b border-theme-border pb-6 mb-6">
                            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 border-4 shadow-lg ${radnikProfil.akcijaTip === 'PRIJAVA' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500' : (radnikProfil.akcijaTip === 'ODJAVA' ? 'bg-amber-900/30 text-amber-400 border-amber-500' : 'bg-red-900/30 text-red-400 border-red-500')}`}>
                                {radnikProfil.akcijaTip === 'PRIJAVA' ? <CheckCircle2 size={36}/> : (radnikProfil.akcijaTip === 'ODJAVA' ? <CheckCircle2 size={36}/> : <AlertCircle size={36}/>)}
                            </div>
                            <h2 className="text-2xl md:text-4xl font-black uppercase tracking-widest text-white mb-2">{radnikProfil.radnik.ime_prezime}</h2>
                            <p className={`text-sm md:text-lg font-bold uppercase tracking-widest ${radnikProfil.akcijaTip === 'PRIJAVA' ? 'text-emerald-400' : (radnikProfil.akcijaTip === 'ODJAVA' ? 'text-amber-400' : 'text-red-400')}`}>{radnikProfil.akcijaTekst}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-theme-panel p-5 rounded-2xl border border-theme-border shadow-inner">
                                <h4 className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-4">Vaš Godišnji Odmor</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                                        <span className="text-xs text-slate-300">Ukupno pripada:</span>
                                        <span className="text-sm font-black text-white">{radnikProfil.radnik.godisnji_ukupno || 20} d</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                                        <span className="text-xs text-slate-300">Iskorišteno:</span>
                                        <span className="text-sm font-black text-amber-400">{(radnikProfil.radnik.godisnji_iskoristeno_radnik || 0) + (radnikProfil.radnik.godisnji_iskoristeno_poslodavac || 0)} d</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2">
                                        <span className="text-sm font-bold text-slate-300">PREOSTALO:</span>
                                        <span className="text-2xl font-black text-emerald-400">
                                            {(radnikProfil.radnik.godisnji_ukupno || 20) - ((radnikProfil.radnik.godisnji_iskoristeno_radnik || 0) + (radnikProfil.radnik.godisnji_iskoristeno_poslodavac || 0))} d
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-theme-panel p-5 rounded-2xl border border-theme-border shadow-inner">
                                <h4 className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-4">Status Vaših Zahtjeva</h4>
                                <div className="space-y-3 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                                    {radnikProfil.zahtjevi.length === 0 ? (
                                        <p className="text-xs text-slate-500 italic">Nemate nedavnih zahtjeva za odmor.</p>
                                    ) : (
                                        radnikProfil.zahtjevi.map(z => (
                                            <div key={z.id} className="flex justify-between items-center p-2 border-b border-slate-700/50 last:border-0">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-white uppercase">{z.tip_odsustva}</span>
                                                    <span className="text-[9px] text-slate-400">{new Date(z.datum_od).toLocaleDateString('de-DE')} - {new Date(z.datum_do).toLocaleDateString('de-DE')}</span>
                                                </div>
                                                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${z.status === 'ODOBRENO' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' : (z.status === 'ODBIJENO' ? 'bg-red-900/30 text-red-400 border border-red-500/30' : 'bg-amber-900/30 text-amber-400 border border-amber-500/30')}`}>
                                                    {z.status}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <button onClick={() => setRadnikProfil(null)} className="w-full mt-6 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl uppercase font-black text-xs transition-colors border border-slate-600">ZATVORI PROZOR (Automatski za 10s)</button>
                    </div>
                </div>
            )}

            {/* KAMERA PREKO SVEGA */}
            <div className="relative z-[10010]">
                {isScanningKiosk && <ScannerOverlay onScan={(text) => { if(isScanningKiosk) { setIsScanningKiosk(false); setSken(text); procesuirajSkenId(text); } }} onClose={() => setIsScanningKiosk(false)} />}
                {isScanningModal && <ScannerOverlay onScan={(text) => { if(isScanningModal) { setIsScanningModal(false); setFormaOdmor({...formaOdmor, radnik_ime: text}); } }} onClose={() => setIsScanningModal(false)} />}
            </div>
            
            <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-blue-600/20 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-emerald-600/20 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="text-center z-10 mb-8 md:mb-12 mt-4 md:mt-0">
                <h1 className="text-5xl md:text-[10vw] font-black tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 drop-shadow-2xl">
                    {vrijeme.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </h1>
                <p className="text-lg md:text-3xl text-blue-400 font-bold tracking-widest uppercase mt-2 md:mt-4">
                    {vrijeme.toLocaleDateString('bs-BA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
            </div>

            <div className="w-full max-w-3xl bg-slate-900/60 backdrop-blur-xl border border-slate-700 p-6 md:p-10 rounded-3xl md:rounded-[3rem] shadow-2xl z-10 flex flex-col items-center">
                <div className="w-16 h-16 md:w-24 md:h-24 bg-blue-600/20 rounded-full flex items-center justify-center mb-4 md:mb-6 border border-blue-500/30">
                    <UserCheck className="text-blue-400 w-8 h-8 md:w-10 md:h-10" />
                </div>
                
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest mb-2 text-center">Prijava / Odjava sa posla</h2>
                <p className="text-slate-400 text-xs md:text-sm mb-6 md:mb-8 text-center">Prislonite ID karticu ili ukucajte ime.</p>

                <div className="w-full flex bg-black/50 border-2 border-slate-600 focus-within:border-blue-500 rounded-2xl overflow-visible shadow-inner transition-colors relative z-20">
                    <div className="flex-1 [&_input]:p-4 md:[&_input]:p-6 [&_input]:text-center [&_input]:text-xl md:[&_input]:text-3xl [&_input]:font-black [&_input]:text-white [&_input]:uppercase [&_input]:tracking-widest [&_input]:bg-transparent">
                        <MasterSearch 
                            data={radniciList} 
                            poljaZaPretragu={['ime_prezime', 'username', 'qr_kod']} 
                            value={sken}
                            onChange={(val) => setSken(val)}
                            onSelect={(r) => { const id = r.qr_kod || r.username || r.ime_prezime; setSken(id); procesuirajSkenId(id); }} 
                            placeholder="ID KARTICA / IME"
                        />
                    </div>
                    {/* DUGME IMA STALNU BOJU I UVIJEK JE VIDLJIVO */}
                    <button onClick={() => setIsScanningKiosk(true)} className="px-6 md:px-8 bg-blue-600/30 text-blue-400 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center border-l border-slate-600 z-10 relative"><ScanLine className="w-6 h-6 md:w-8 md:h-8"/></button>
                </div>

                {poruka && (
                    <div className={`mt-6 md:mt-8 w-full p-4 md:p-6 rounded-2xl flex items-center justify-center gap-3 animate-in zoom-in font-black text-sm md:text-lg border ${poruka.tip === 'success' ? 'bg-emerald-900/40 text-emerald-400 border-emerald-500/50' : 'bg-red-900/40 text-red-400 border-red-500/50'}`}>
                        {poruka.tip === 'success' ? <CheckCircle2 className="w-5 h-5 md:w-7 md:h-7" /> : <AlertCircle className="w-5 h-5 md:w-7 md:h-7" />}
                        {poruka.tekst}
                    </div>
                )}
            </div>

            <button onClick={otvoriMeniZaOdmor} className="mt-8 md:absolute md:bottom-8 md:right-8 bg-slate-800 hover:bg-amber-600 text-slate-300 hover:text-white px-6 md:px-8 py-4 md:py-5 rounded-2xl md:rounded-[2rem] font-black uppercase text-xs md:text-sm flex items-center gap-3 transition-all border border-slate-700 shadow-2xl z-10">
                <CalendarDays className="w-5 h-5 md:w-6 md:h-6" /> Zatraži Odmor
            </button>

            {/* INTERAKTIVNI MODAL ZA ODMOR */}
            {showOdmorModal && (
                <div className="fixed inset-0 bg-[#090e17]/95 z-[9990] flex items-center justify-center p-2 md:p-4 backdrop-blur-md animate-in fade-in overflow-y-auto">
                    <div className="bg-slate-900 border-2 border-amber-500/50 p-4 md:p-8 rounded-[2rem] w-full max-w-5xl shadow-[0_0_80px_rgba(245,158,11,0.15)] relative flex flex-col mt-10 md:mt-0">
                        <button onClick={() => setShowOdmorModal(false)} className="absolute top-4 right-4 md:top-6 md:right-6 w-10 h-10 md:w-12 md:h-12 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-500 transition-colors font-black text-lg md:text-xl z-50"><X/></button>
                        
                        <div className="mb-6 md:mb-8 border-b border-slate-800 pb-4 pr-12 md:pr-0">
                            <h2 className="text-xl md:text-2xl text-amber-500 font-black uppercase tracking-widest flex items-center gap-2 md:gap-3">🏖️ Rezervacija Odsustva</h2>
                            <p className="text-slate-400 text-xs md:text-sm mt-2">Unesite ID, zatim na kalendaru kliknite početni datum i krajnji datum odmora.</p>
                        </div>

                        <div className="flex flex-col lg:flex-row gap-6 md:gap-8 flex-1 min-h-0">
                            <div className="w-full lg:w-1/3 space-y-4 md:space-y-6">
                                <div>
                                    <label className="text-[9px] md:text-[10px] text-amber-500 font-black uppercase mb-2 block tracking-widest">1. Identifikacija (Vaš ID / Ime)</label>
                                    <div className="flex w-full bg-black border-2 border-slate-700 focus-within:border-amber-500 rounded-xl md:rounded-2xl overflow-visible shadow-inner relative z-50 transition-colors">
                                        <div className="flex-1 [&_input]:p-3 md:[&_input]:p-5 [&_input]:bg-transparent [&_input]:text-white [&_input]:font-black [&_input]:uppercase [&_input]:text-sm md:[&_input]:text-lg">
                                            <MasterSearch 
                                                data={radniciList} 
                                                poljaZaPretragu={['ime_prezime', 'username', 'qr_kod']} 
                                                value={formaOdmor.radnik_ime}
                                                onSelect={(r) => setFormaOdmor({...formaOdmor, radnik_ime: r.ime_prezime})} 
                                                placeholder="Upiši ID..."
                                            />
                                        </div>
                                        <button onClick={() => setIsScanningModal(true)} className="px-3 md:px-5 bg-amber-500/20 text-amber-500 border-l border-slate-700 hover:bg-amber-500 hover:text-black transition-colors rounded-r-lg md:rounded-r-xl relative z-10 flex items-center justify-center"><ScanLine className="w-5 h-5 md:w-6 md:h-6"/></button>
                                    </div>
                                </div>
                                
                                <div className="relative z-40">
                                    <label className="text-[9px] md:text-[10px] text-amber-500 font-black uppercase mb-2 block tracking-widest">2. Tip Odsustva</label>
                                    <select value={formaOdmor.tip} onChange={e=>setFormaOdmor({...formaOdmor, tip: e.target.value})} className="w-full p-3 md:p-5 bg-black border-2 border-slate-700 focus:border-amber-500 rounded-xl md:rounded-2xl text-white outline-none uppercase font-bold cursor-pointer shadow-inner text-xs md:text-sm">
                                        <option value="GODIŠNJI">Godišnji Odmor (Plaćeno)</option>
                                        <option value="BOLOVANJE">Bolovanje (Privremeno)</option>
                                        <option value="SLOBODNO">Slobodan dan (Neplaćeno)</option>
                                    </select>
                                </div>

                                <div className="relative z-30">
                                    <label className="text-[9px] md:text-[10px] text-amber-500 font-black uppercase mb-2 block tracking-widest">3. Razlog (Opciono)</label>
                                    <textarea value={formaOdmor.razlog} onChange={e=>setFormaOdmor({...formaOdmor, razlog: e.target.value})} className="w-full p-3 md:p-4 bg-black border-2 border-slate-700 focus:border-amber-500 rounded-xl md:rounded-2xl text-white outline-none shadow-inner resize-none text-xs md:text-sm" placeholder="Dodatna napomena..." rows="2 md:rows-3"></textarea>
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
        </div>
    );
}