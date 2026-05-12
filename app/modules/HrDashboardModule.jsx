"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import PametniDialog from '../components/PametniDialog';
import { useSaaS } from '../utils/useSaaS';
import { Users, CalendarCheck, Clock4, CalendarX2, ChevronLeft, ChevronRight, Edit3 } from 'lucide-react';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const mjeseciBHS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];

const formatLocalISODate = (date) => {
    if (!date || isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export default function HrDashboardModule({ user, header, setHeader, onExit }) {
    const saas = useSaaS('hr_modul', { boja_kartice: '#1e293b', boja_slova: '#ffffff', boja_akcenta: '#3b82f6' });

    const [tab, setTab] = useState('prisutnost');
    const [radnici, setRadnici] = useState([]);
    const [radniSati, setRadniSati] = useState([]);
    const [zahtjevi, setZahtjevi] = useState([]);
    const [praznici, setPraznici] = useState([]);

    const [pocetakSmjene, setPocetakSmjene] = useState('07:30');
    const [krajSmjene, setKrajSmjene] = useState('16:00');

    const [odabraniRadnik, setOdabraniRadnik] = useState(null);
    const [mjesecPrikaza, setMjesecPrikaza] = useState(formatLocalISODate(new Date()).substring(0, 7)); 
    
    const [trenutniMjesecKalendara, setTrenutniMjesecKalendara] = useState(new Date());
    const [prikazKalendara, setPrikazKalendara] = useState('MJESEC');
    const [selektovaniZahtjev, setSelektovaniZahtjev] = useState(null);

    const [showRucniUpis, setShowRucniUpis] = useState(false);
    const [formaUpis, setFormaUpis] = useState({ tip_odsustva: 'NEOPRAVDANO', datum_od: '', datum_do: '', razlog: '' });
    const [formaPraznik, setFormaPraznik] = useState({ datum: '', naziv: '', je_radni_dan: false });

    const [datumGenOd, setDatumGenOd] = useState(formatLocalISODate(new Date())); // NOVO: Datum od kojeg vazi pravilo za subote

    const [modalUredi, setModalUredi] = useState(null);
    const [stvarniSati, setStvarniSati] = useState(0);
    const [editSati, setEditSati] = useState('');
    const [editPrekovremeno, setEditPrekovremeno] = useState('');
    const [editKasnjenje, setEditKasnjenje] = useState('');
    const [editRanije, setEditRanije] = useState('');

    const [dialog, setDialog] = useState({ isOpen: false });
    const prikaziDialog = (opcije) => setDialog({ isOpen: true, confirmText: 'POTVRDI', cancelText: 'ZATVORI', ...opcije });
    const zatvoriDialog = () => setDialog({ isOpen: false });

    useEffect(() => { 
        const snimljenPocetak = localStorage.getItem('erp_pocetak_smjene');
        const snimljenKraj = localStorage.getItem('erp_kraj_smjene');
        if (snimljenPocetak) setPocetakSmjene(snimljenPocetak);
        if (snimljenKraj) setKrajSmjene(snimljenKraj);
        loadAll(); 
    }, [mjesecPrikaza]);

    const loadAll = async () => {
        const { data: rData } = await supabase.from('radnici').select('*').order('ime_prezime');
        setRadnici(rData || []);

        const mOd = `${mjesecPrikaza}-01`;
        const mDo = `${mjesecPrikaza}-31`;

        const { data: sData } = await supabase.from('radni_sati').select('*').gte('datum', mOd).lte('datum', mDo).order('datum', { ascending: false });
        setRadniSati(sData || []);

        const { data: zData } = await supabase.from('zahtjevi_odsustva').select('*').order('created_at', { ascending: false });
        setZahtjevi(zData || []);

        const { data: pData } = await supabase.from('kalendar_izuzeci').select('*').order('datum');
        setPraznici(pData || []);
    };

    const zapisiU_Log = async (akcija, detalji) => { 
        await supabase.from('sistem_audit_log').insert([{ korisnik: user?.ime_prezime || 'Nepoznat_Admin', akcija, detalji }]); 
    };

    const spasiPostavkeSmjene = () => {
        localStorage.setItem('erp_pocetak_smjene', pocetakSmjene);
        localStorage.setItem('erp_kraj_smjene', krajSmjene);
        prikaziDialog({ tip: 'uspjeh', naslov: 'Uspješno', poruka: 'Radno vrijeme firme uspješno sačuvano!', onCancel: zatvoriDialog });
    };

    const izracunajDnevnicu = async (zapis) => {
        if (!zapis.vrijeme_dolaska || !zapis.vrijeme_odlaska) {
            return prikaziDialog({ tip: 'upozorenje', naslov: 'Greška', poruka: 'Radnik još uvijek nije odjavljen!', onCancel: zatvoriDialog });
        }

        const dStart = new Date(zapis.vrijeme_dolaska);
        const dEnd = new Date(zapis.vrijeme_odlaska);
        
        const [hStart, mStart] = pocetakSmjene.split(':');
        const [hEnd, mEnd] = krajSmjene.split(':');
        
        let officialStart = new Date(dStart); officialStart.setHours(parseInt(hStart), parseInt(mStart), 0);
        let officialEnd = new Date(dStart); officialEnd.setHours(parseInt(hEnd), parseInt(mEnd), 0);

        let kasnjenjeMin = 0; let ranijiIzlazakMin = 0;
        let radniSatiDec = 0;

        if (dStart >= officialEnd || dEnd <= officialStart) {
            radniSatiDec = 0; kasnjenjeMin = 0; ranijiIzlazakMin = 0;
        } else {
            let obracunskiStart = new Date(dStart); let obracunskiEnd = new Date(dEnd);
            if (dStart < officialStart) { obracunskiStart = officialStart; }
            else if (dStart > officialStart) { kasnjenjeMin = Math.round((dStart - officialStart) / 60000); }
            if (dEnd < officialEnd) { ranijiIzlazakMin = Math.round((officialEnd - dEnd) / 60000); }
            else if (dEnd > officialEnd) { obracunskiEnd = officialEnd; }

            radniSatiDec = (obracunskiEnd - obracunskiStart) / (1000 * 60 * 60);
            if (radniSatiDec < 0) radniSatiDec = 0;
        }

        await supabase.from('radni_sati').update({ obracunato_sati: radniSatiDec.toFixed(2), kasnjenje_min: kasnjenjeMin, raniji_izlazak_min: ranijiIzlazakMin }).eq('id', zapis.id);
        loadAll();
        prikaziDialog({ tip: 'uspjeh', naslov: 'Uspješan obračun', poruka: `Sistem je ponovo izračunao sate za radnika ${zapis.radnik_ime}.`, onCancel: zatvoriDialog });
    };

    const otvoriModalUredi = (zapis) => {
        setModalUredi(zapis);
        const stvarni = (new Date(zapis.vrijeme_odlaska) - new Date(zapis.vrijeme_dolaska)) / 3600000;
        setStvarniSati(stvarni > 0 ? stvarni : 0);
        setEditSati(zapis.obracunato_sati || 0); setEditPrekovremeno((zapis.prekovremeno_min || 0) / 60); setEditKasnjenje(zapis.kasnjenje_min || 0); setEditRanije(zapis.raniji_izlazak_min || 0);
    };

    const sacuvajIzmjeneSati = async () => {
        if (!modalUredi) return;
        const obracunato = parseFloat(editSati) || 0; const prekovr = parseFloat(editPrekovremeno) || 0; const kasni = parseInt(editKasnjenje) || 0; const ranije = parseInt(editRanije) || 0;

        await supabase.from('radni_sati').update({ obracunato_sati: obracunato.toFixed(2), prekovremeno_min: prekovr * 60, kasnjenje_min: kasni, raniji_izlazak_min: ranije }).eq('id', modalUredi.id);
        await zapisiU_Log('KOREKCIJA_RADNOG_VREMENA', `Izmijenjeni sati za: ${modalUredi.radnik_ime} (Datum: ${modalUredi.datum})`);
        
        setModalUredi(null); loadAll();
    };

    const automatskiSveStandardno = () => { setEditSati(stvarniSati.toFixed(2)); setEditPrekovremeno(0); setEditKasnjenje(0); setEditRanije(0); };
    const automatskiSvePrekovremeno = () => { setEditSati(0); setEditPrekovremeno(stvarniSati.toFixed(2)); setEditKasnjenje(0); setEditRanije(0); };

    const obrisiZapisSigurno = (zapis) => {
        prikaziDialog({
            tip: 'upozorenje', naslov: 'Brisanje Radnog Vremena', poruka: `Da li ste sigurni da želite trajno obrisati zapis za radnika ${zapis.radnik_ime}?`,
            confirmText: '🗑️ TRAJNO OBRIŠI', cancelText: '✕ ODUSTANI',
            onConfirm: async () => {
                await supabase.from('radni_sati').delete().eq('id', zapis.id);
                await zapisiU_Log('BRISANJE_RADNOG_VREMENA', `Obrisan zapis za: ${zapis.radnik_ime} (Datum: ${zapis.datum})`);
                loadAll(); zatvoriDialog();
            },
            onCancel: zatvoriDialog
        });
    };

    const obradiZahtjevOdmor = async (z, status, inicijativa) => {
        let poruka = `Da li ste sigurni da želite postaviti status na ${status}?`;
        if (status === 'ODOBRENO' && z.tip_odsustva === 'GODIŠNJI') poruka += `\nKvote će biti skinute radniku na inicijativu: ${inicijativa}.`;

        prikaziDialog({
            tip: status === 'ODOBRENO' ? 'info' : 'upozorenje', naslov: 'Obrada Zahtjeva', poruka,
            confirmText: '✅ POTVRDI', cancelText: '✕ ODUSTANI',
            onConfirm: async () => {
                await supabase.from('zahtjevi_odsustva').update({ status, inicijativa, odobrio_korisnik: user?.ime_prezime }).eq('id', z.id);
                if (status === 'ODOBRENO' && z.tip_odsustva === 'GODIŠNJI') {
                    const radnik = radnici.find(r => r.ime_prezime === z.radnik_ime);
                    if (radnik) {
                        const poljeUpdate = inicijativa === 'RADNIK' ? 'godisnji_iskoristeno_radnik' : 'godisnji_iskoristeno_poslodavac';
                        const novaKvota = (radnik[poljeUpdate] || 0) + z.broj_radnih_dana;
                        await supabase.from('radnici').update({ [poljeUpdate]: novaKvota }).eq('id', radnik.id);
                    }
                }
                setSelektovaniZahtjev(null); loadAll(); zatvoriDialog();
            },
            onCancel: zatvoriDialog
        });
    };

    const rucniUpisOdsustva = async () => {
        if (!formaUpis.datum_od || !formaUpis.datum_do) return alert("Odaberite datume!");
        let brojDana = 0;
        for (let d = new Date(formaUpis.datum_od); d <= new Date(formaUpis.datum_do); d.setDate(d.getDate() + 1)) {
            const day = d.getDay(); if (day !== 0 && day !== 6) brojDana++; 
        }

        const payload = { radnik_ime: odabraniRadnik.ime_prezime, tip_odsustva: formaUpis.tip_odsustva, datum_od: formaUpis.datum_od, datum_do: formaUpis.datum_do, broj_radnih_dana: brojDana, status: 'ODOBRENO', inicijativa: 'POSLODAVAC', razlog: formaUpis.razlog, odobrio_korisnik: user?.ime_prezime };
        await supabase.from('zahtjevi_odsustva').insert([payload]); setShowRucniUpis(false); loadAll();
    };

    const dodajPraznik = async () => {
        if (!formaPraznik.datum || !formaPraznik.naziv) return alert("Unesite datum i naziv praznika!");
        await supabase.from('kalendar_izuzeci').insert([formaPraznik]); setFormaPraznik({ datum: '', naziv: '', je_radni_dan: false }); loadAll();
    };

    const obrisiPraznik = async (datum) => {
        prikaziDialog({
            tip: 'upozorenje', naslov: 'Brisanje', poruka: "Da li ste sigurni da želite obrisati ovaj izuzetak u kalendaru?", confirmText: '🗑️ OBRIŠI', cancelText: '✕ ODUSTANI',
            onConfirm: async () => { await supabase.from('kalendar_izuzeci').delete().eq('datum', datum); loadAll(); zatvoriDialog(); }, onCancel: zatvoriDialog
        });
    };

    const obrisiSvePraznike = () => {
        prikaziDialog({
            tip: 'upozorenje', naslov: 'Brisanje SVIH Izuzetaka', 
            poruka: "Da li ste potpuno sigurni da želite obrisati APSOLUTNO SVE praznike i radne subote iz baze? Ovo će očistiti cijeli kalendar izuzetaka.", 
            confirmText: '🗑️ OBRIŠI SVE', cancelText: '✕ ODUSTANI',
            onConfirm: async () => { 
                await supabase.from('kalendar_izuzeci').delete().not('datum', 'is', null); 
                loadAll(); zatvoriDialog(); 
            }, 
            onCancel: zatvoriDialog
        });
    };

    const generisiSubote = async (tip) => {
        if (!datumGenOd) return alert("Odaberite datum od kojeg pravilo važi!");

        const startObj = new Date(datumGenOd);
        const godina = startObj.getFullYear();
        let zaUbaciti = [];

        // Idemo od mjeseca u kojem je odabran datum, do kraja godine
        for (let m = startObj.getMonth(); m < 12; m++) {
            let prvaSubotaNadjen = false; 
            let counterSubota = 0;
            
            for (let d = 1; d <= 31; d++) {
                const dateObj = new Date(godina, m, d);
                if (dateObj.getMonth() !== m) break; 
                
                // Preskoči dane koji su prije odabranog datuma
                if (dateObj < startObj) continue;

                if (dateObj.getDay() === 6) {
                    counterSubota++;
                    const iso = formatLocalISODate(dateObj); 
                    
                    if (tip === 'SVE') {
                        zaUbaciti.push({ datum: iso, naziv: 'Radna Subota', je_radni_dan: true });
                    } 
                    else if (tip === 'PRVA' && !prvaSubotaNadjen) { 
                        zaUbaciti.push({ datum: iso, naziv: 'Radna Subota (Prva)', je_radni_dan: true }); 
                        prvaSubotaNadjen = true; 
                    } 
                    else if (tip === 'DRUGA' && counterSubota % 2 !== 0) { 
                        zaUbaciti.push({ datum: iso, naziv: 'Radna Subota (Svaka druga)', je_radni_dan: true }); 
                    }
                }
            }
        }
        
        prikaziDialog({
            tip: 'info', naslov: 'Automatski Kalendar', 
            poruka: `Pronađeno je ${zaUbaciti.length} subota od ${new Date(datumGenOd).toLocaleDateString('bs-BA')} do kraja godine.\n\nPAŽNJA: Ovo će izbrisati sve stare automatske subote iz ovog perioda kako se ne bi duplale. Nastaviti?`,
            confirmText: '✅ PRIMIJENI', cancelText: '✕ ODUSTANI',
            onConfirm: async () => { 
                // 1. Obriši stare subote (duhove) od ovog datuma pa nadalje
                await supabase.from('kalendar_izuzeci').delete().gte('datum', datumGenOd).ilike('naziv', '%Subota%');
                // 2. Ubaci nove
                if(zaUbaciti.length > 0) await supabase.from('kalendar_izuzeci').upsert(zaUbaciti); 
                loadAll(); zatvoriDialog(); 
            }, 
            onCancel: zatvoriDialog
        });
    };

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => { let day = new Date(year, month, 1).getDay(); return day === 0 ? 6 : day - 1; };
    const daniUMjesecu = getDaysInMonth(trenutniMjesecKalendara.getFullYear(), trenutniMjesecKalendara.getMonth());
    const praznaPoljaNaPocetku = getFirstDayOfMonth(trenutniMjesecKalendara.getFullYear(), trenutniMjesecKalendara.getMonth());
    const daniNiz = Array.from({length: daniUMjesecu}, (_, i) => i + 1);

    const odsustvaZauzetost = useMemo(() => {
        let mapa = {};
        zahtjevi.filter(z => z.status === 'ODOBRENO').forEach(z => {
            let start = new Date(z.datum_od); let end = new Date(z.datum_do);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                let dStr = formatLocalISODate(d);
                if(!mapa[dStr]) mapa[dStr] = [];
                mapa[dStr].push(z.radnik_ime);
            }
        });
        return mapa;
    }, [zahtjevi]);

    const prebrojZahtjeveUMjesecu = (godina, mjesec) => {
        let odobreno = 0; let naCekanju = 0;
        zahtjevi.forEach(z => {
            const zOd = new Date(z.datum_od); const zDo = new Date(z.datum_do);
            const mOd = new Date(godina, mjesec, 1); const mDo = new Date(godina, mjesec + 1, 0); 
            if (zOd <= mDo && zDo >= mOd) {
                if (z.status === 'ODOBRENO') odobreno++;
                else if (z.status === 'NA ČEKANJU') naCekanju++;
            }
        });
        return { odobreno, naCekanju };
    };

    const danasStr = formatLocalISODate(new Date());
    const prisutniDanas = radniSati.filter(s => s.datum === danasStr);

    return (
        <div className="p-2 md:p-4 max-w-7xl mx-auto space-y-4 md:space-y-6 font-bold animate-in fade-in relative" style={{ color: saas.ui.boja_slova }}>
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-blue-500" user={user} modulIme="hr_modul" saas={saas} hideMasina={true} />
            <PametniDialog {...dialog} />

            {modalUredi && (
                <div className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md animate-in zoom-in-95">
                    <div className="bg-theme-card border-2 border-blue-500 p-6 md:p-8 rounded-[2rem] shadow-[0_0_50px_rgba(59,130,246,0.5)] max-w-lg w-full flex flex-col relative max-h-[95vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 border-b border-theme-border pb-4">
                            <div><h2 className="text-xl md:text-2xl font-black uppercase tracking-widest text-white flex items-center gap-2"><Edit3 size={24}/> Uredi Sate</h2><p className="text-slate-400 text-xs mt-1">Radnik: <span className="text-blue-400 font-bold">{modalUredi.radnik_ime}</span></p></div>
                            <div className="text-right"><p className="text-slate-400 text-[10px] uppercase">Datum:</p><p className="text-white font-black text-sm">{new Date(modalUredi.datum).toLocaleDateString('bs-BA')}</p></div>
                        </div>

                        <div className="bg-blue-900/10 border border-blue-500/30 p-4 rounded-xl mb-6 flex justify-between items-center shadow-inner">
                            <div><p className="text-[10px] text-blue-400 uppercase font-black tracking-widest mb-1">Stvarno vrijeme na poslu:</p><p className="text-sm text-slate-300">Od: <span className="text-white">{new Date(modalUredi.vrijeme_dolaska).toLocaleTimeString('de-DE')}</span> do <span className="text-white">{new Date(modalUredi.vrijeme_odlaska).toLocaleTimeString('de-DE')}</span></p></div>
                            <div className="text-right"><p className="text-2xl text-blue-400 font-black">{stvarniSati.toFixed(2)} <span className="text-xs">h</span></p></div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div><label className="text-[9px] text-slate-400 uppercase block mb-1 font-bold">Standardni Sati (h)</label><input type="number" step="0.5" value={editSati} onChange={e=>setEditSati(e.target.value)} className="w-full p-3 bg-black border border-slate-700 rounded-xl text-white font-black outline-none focus:border-emerald-500 shadow-inner" /></div>
                            <div><label className="text-[9px] text-amber-500 uppercase block mb-1 font-bold">Prekovremeno (h)</label><input type="number" step="0.5" value={editPrekovremeno} onChange={e=>setEditPrekovremeno(e.target.value)} className="w-full p-3 bg-amber-900/20 border border-amber-500/50 rounded-xl text-amber-400 font-black outline-none focus:border-amber-400 shadow-inner" /></div>
                            <div><label className="text-[9px] text-slate-400 uppercase block mb-1 font-bold">Kašnjenje (min)</label><input type="number" value={editKasnjenje} onChange={e=>setEditKasnjenje(e.target.value)} className="w-full p-3 bg-black border border-slate-700 rounded-xl text-white font-black outline-none focus:border-red-500 shadow-inner" /></div>
                            <div><label className="text-[9px] text-slate-400 uppercase block mb-1 font-bold">Raniji izlazak (min)</label><input type="number" value={editRanije} onChange={e=>setEditRanije(e.target.value)} className="w-full p-3 bg-black border border-slate-700 rounded-xl text-white font-black outline-none focus:border-orange-500 shadow-inner" /></div>
                        </div>

                        <div className="flex flex-col gap-2 mb-6 w-full">
                            <button onClick={automatskiSveStandardno} className="w-full py-3 bg-blue-900/30 hover:bg-blue-600 border border-blue-500/50 rounded-xl text-[10px] text-blue-400 hover:text-white font-black uppercase transition-colors">⚡ Upiši sve kao STANDARDNU smjenu ({stvarniSati.toFixed(2)} h)</button>
                            <button onClick={automatskiSvePrekovremeno} className="w-full py-3 bg-amber-900/30 hover:bg-amber-600 border border-amber-500/50 rounded-xl text-[10px] text-amber-400 hover:text-white font-black uppercase transition-colors">⚡ Poništi kašnjenja i upiši kao PREKOVREMENO ({stvarniSati.toFixed(2)} h)</button>
                        </div>

                        <div className="flex gap-3 w-full">
                            <button onClick={() => setModalUredi(null)} className="flex-1 py-4 bg-theme-panel border border-slate-600 rounded-xl text-slate-300 font-black uppercase text-xs hover:bg-slate-700 transition-colors">✕ OTKAŽI</button>
                            <button onClick={sacuvajIzmjeneSati} className="flex-[2] py-4 bg-blue-600 rounded-xl text-white font-black uppercase text-xs hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]">💾 SAČUVAJ IZMJENE</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex bg-theme-panel p-1.5 rounded-xl md:rounded-2xl border border-theme-border shadow-inner overflow-x-auto custom-scrollbar snap-x">
                <button onClick={() => setTab('prisutnost')} className={`flex-1 min-w-[140px] snap-center py-3 md:py-4 px-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] uppercase font-black transition-all flex items-center justify-center gap-1.5 md:gap-2 whitespace-nowrap ${tab === 'prisutnost' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}><Clock4 size={14}/> Prisutnost (Danas)</button>
                <button onClick={() => setTab('odobrenja')} className={`flex-1 min-w-[150px] snap-center py-3 md:py-4 px-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] uppercase font-black transition-all flex items-center justify-center gap-1.5 md:gap-2 whitespace-nowrap ${tab === 'odobrenja' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}><CalendarCheck size={14}/> Odobrenja Odmora</button>
                <button onClick={() => setTab('profili')} className={`flex-1 min-w-[130px] snap-center py-3 md:py-4 px-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] uppercase font-black transition-all flex items-center justify-center gap-1.5 md:gap-2 whitespace-nowrap ${tab === 'profili' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}><Users size={14}/> Profili Radnika</button>
                <button onClick={() => setTab('kalendar')} className={`flex-1 min-w-[150px] snap-center py-3 md:py-4 px-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] uppercase font-black transition-all flex items-center justify-center gap-1.5 md:gap-2 whitespace-nowrap ${tab === 'kalendar' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}><CalendarX2 size={14}/> Praznici / Kalendar</button>
            </div>

            {/* TAB 1: PRISUTNOST DANAS */}
            {tab === 'prisutnost' && (
                <div className="bg-theme-card p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-theme-border shadow-2xl animate-in slide-in-from-left">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 md:mb-6 border-b border-theme-border pb-3 md:pb-4 gap-2">
                        <h3 className="text-blue-400 font-black uppercase text-xs md:text-sm">📍 TRENUTNO STANJE U POGONU ({prisutniDanas.length} radnika)</h3>
                        <p className="text-slate-400 text-[10px] md:text-xs font-bold">{new Date().toLocaleDateString('bs-BA')}</p>
                    </div>

                    <div className="space-y-2 md:space-y-3 max-h-[500px] md:max-h-[600px] overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
                        {prisutniDanas.length === 0 && <p className="text-center text-slate-500 py-6 md:py-10 text-[10px] md:text-xs font-bold border border-dashed border-theme-border rounded-xl">Kiosk nema prijava za danas.</p>}
                        {prisutniDanas.map(p => (
                            <div key={p.id} className="bg-theme-panel p-3 md:p-4 rounded-xl border border-theme-border flex flex-col sm:flex-row justify-between sm:items-center hover:border-blue-500/50 transition-all shadow-sm gap-3">
                                <div>
                                    <p className="text-theme-text text-sm font-black uppercase">{p.radnik_ime}</p>
                                    <p className="text-[9px] md:text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">Ulaz: <span className="text-white">{p.vrijeme_dolaska ? new Date(p.vrijeme_dolaska).toLocaleTimeString('de-DE') : '-'}</span> <span className="mx-1 md:mx-2 opacity-50">|</span> Izlaz: <span className="text-white">{p.vrijeme_odlaska ? new Date(p.vrijeme_odlaska).toLocaleTimeString('de-DE') : 'JOŠ UVIJEK TU'}</span></p>
                                </div>
                                <div className="flex items-center gap-2 md:gap-3 self-end sm:self-auto">
                                    <span className={`text-[8px] md:text-[9px] px-2 md:px-3 py-1 md:py-1.5 rounded-lg font-black uppercase tracking-widest ${p.status === 'NA_POSLU' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                                        {p.status === 'NA_POSLU' ? '🟢 AKTIVAN' : '⚪ ZAVRŠIO'}
                                    </span>
                                    {p.status === 'ZAVRŠIO' && (<button onClick={() => izracunajDnevnicu(p)} className="bg-amber-600 hover:bg-amber-500 text-white px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[8px] md:text-[9px] font-black uppercase shadow-lg">⚙️ Obračunaj</button>)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 2: ODOBRENJA ODMORA */}
            {tab === 'odobrenja' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 animate-in slide-in-from-right">
                    <div className="lg:col-span-5 bg-theme-card p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-theme-border shadow-2xl flex flex-col h-[400px] lg:h-[700px]">
                        <h3 className="text-amber-500 font-black uppercase text-xs md:text-sm mb-3 md:mb-4 border-b border-theme-border pb-3 md:pb-4">📋 Zahtjevi na čekanju</h3>
                        <div className="flex-1 overflow-y-auto space-y-2 md:space-y-3 custom-scrollbar pr-1 md:pr-2">
                            {zahtjevi.filter(z => z.status === 'NA ČEKANJU').length === 0 && <p className="text-center text-slate-500 py-10 font-bold border border-dashed border-theme-border rounded-xl text-[10px] md:text-xs">Nema novih zahtjeva za odmor.</p>}
                            {zahtjevi.filter(z => z.status === 'NA ČEKANJU').map(z => {
                                const isSel = selektovaniZahtjev?.id === z.id;
                                return (
                                    <div key={z.id} onClick={() => {setSelektovaniZahtjev(z); setTrenutniMjesecKalendara(new Date(z.datum_od)); setPrikazKalendara('MJESEC');}} className={`p-3 md:p-4 rounded-xl md:rounded-2xl cursor-pointer transition-all border shadow-sm ${isSel ? 'bg-amber-900/10 border-amber-500/50' : 'bg-theme-panel border-theme-border hover:border-amber-500/30'}`}>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                                            <span className="text-xs font-black text-white uppercase">{z.radnik_ime}</span><span className="text-[8px] md:text-[9px] bg-blue-900/30 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-black w-fit">{z.tip_odsustva}</span>
                                        </div>
                                        <p className="text-[9px] md:text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1 md:mt-2">{new Date(z.datum_od).toLocaleDateString('bs-BA')} - {new Date(z.datum_do).toLocaleDateString('bs-BA')}</p>
                                        
                                        {isSel && (
                                            <div className="mt-3 md:mt-4 pt-2 md:pt-3 border-t border-theme-border/50">
                                                <p className="text-[8px] md:text-[9px] text-slate-400 uppercase font-black mb-2">Čija je inicijativa?</p>
                                                <div className="flex gap-2 mb-2">
                                                    <button onClick={() => obradiZahtjevOdmor(z, 'ODOBRENO', 'RADNIK')} className="flex-1 bg-emerald-900/30 hover:bg-emerald-600 text-emerald-400 hover:text-white px-2 py-1.5 md:py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase border border-emerald-500/30 transition-all">✅ Radnik</button>
                                                    <button onClick={() => obradiZahtjevOdmor(z, 'ODOBRENO', 'POSLODAVAC')} className="flex-1 bg-amber-900/30 hover:bg-amber-600 text-amber-400 hover:text-white px-2 py-1.5 md:py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase border border-amber-500/30 transition-all">✅ Poslodavac</button>
                                                </div>
                                                <button onClick={() => obradiZahtjevOdmor(z, 'ODBIJENO', 'N/A')} className="w-full bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white px-2 py-1.5 md:py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase border border-red-500/30 transition-all">✕ ODBIJ</button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="lg:col-span-7 bg-theme-card p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-theme-border shadow-2xl h-[500px] lg:h-[700px] flex flex-col">
                        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 md:mb-6 bg-theme-panel p-2 rounded-xl md:rounded-2xl border border-theme-border gap-2 sm:gap-4">
                            <div className="flex w-full sm:w-auto bg-black/40 rounded-lg p-1 border border-slate-700">
                                <button onClick={() => setPrikazKalendara('MJESEC')} className={`flex-1 sm:flex-none px-3 md:px-4 py-1.5 md:py-2 rounded-md text-[9px] md:text-[10px] font-black uppercase transition-all ${prikazKalendara === 'MJESEC' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>Mjesec</button>
                                <button onClick={() => setPrikazKalendara('GODINA')} className={`flex-1 sm:flex-none px-3 md:px-4 py-1.5 md:py-2 rounded-md text-[9px] md:text-[10px] font-black uppercase transition-all ${prikazKalendara === 'GODINA' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>Godina</button>
                            </div>

                            {prikazKalendara === 'MJESEC' ? (
                                <div className="flex items-center gap-2 md:gap-3 w-full sm:w-auto justify-between sm:justify-end">
                                    <button onClick={() => setTrenutniMjesecKalendara(new Date(trenutniMjesecKalendara.getFullYear(), trenutniMjesecKalendara.getMonth() - 1, 1))} className="p-2 md:p-3 bg-slate-800 hover:bg-amber-600 rounded-lg md:rounded-xl transition-colors"><ChevronLeft size={16}/></button>
                                    <h3 className="text-sm md:text-lg font-black uppercase tracking-widest text-amber-500 w-32 md:w-48 text-center truncate">{mjeseciBHS[trenutniMjesecKalendara.getMonth()]} {trenutniMjesecKalendara.getFullYear()}.</h3>
                                    <button onClick={() => setTrenutniMjesecKalendara(new Date(trenutniMjesecKalendara.getFullYear(), trenutniMjesecKalendara.getMonth() + 1, 1))} className="p-2 md:p-3 bg-slate-800 hover:bg-amber-600 rounded-lg md:rounded-xl transition-colors"><ChevronRight size={16}/></button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 md:gap-3 w-full sm:w-auto justify-between sm:justify-end">
                                    <button onClick={() => setTrenutniMjesecKalendara(new Date(trenutniMjesecKalendara.getFullYear() - 1, trenutniMjesecKalendara.getMonth(), 1))} className="p-2 md:p-3 bg-slate-800 hover:bg-amber-600 rounded-lg md:rounded-xl transition-colors"><ChevronLeft size={16}/></button>
                                    <h3 className="text-sm md:text-lg font-black uppercase tracking-widest text-amber-500 w-32 md:w-48 text-center">{trenutniMjesecKalendara.getFullYear()}.</h3>
                                    <button onClick={() => setTrenutniMjesecKalendara(new Date(trenutniMjesecKalendara.getFullYear() + 1, trenutniMjesecKalendara.getMonth(), 1))} className="p-2 md:p-3 bg-slate-800 hover:bg-amber-600 rounded-lg md:rounded-xl transition-colors"><ChevronRight size={16}/></button>
                                </div>
                            )}
                        </div>
                        
                        {prikazKalendara === 'MJESEC' ? (
                            <div className="grid grid-cols-7 gap-1 md:gap-2 flex-1">
                                {['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'].map(d => <div key={d} className="text-center text-[8px] md:text-[10px] text-slate-500 font-black uppercase pb-1 md:pb-2">{d}</div>)}
                                {Array.from({length: praznaPoljaNaPocetku}).map((_, i) => <div key={`empty-${i}`} />)}
                                
                                {daniNiz.map((dan) => {
                                    const dateObj = new Date(trenutniMjesecKalendara.getFullYear(), trenutniMjesecKalendara.getMonth(), dan);
                                    const iso = formatLocalISODate(dateObj);
                                    const zapisiNaOvajDan = odsustvaZauzetost[iso] || [];
                                    const jeVikend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                                    const isReqRange = selektovaniZahtjev && dateObj >= new Date(selektovaniZahtjev.datum_od) && dateObj <= new Date(selektovaniZahtjev.datum_do);

                                    return (
                                        <div key={dan} className={`aspect-square rounded-lg md:rounded-2xl flex flex-col items-center justify-start pt-1 md:pt-2 border md:border-2 transition-all relative ${jeVikend ? 'bg-slate-900/50 border-slate-800' : 'bg-theme-panel border-theme-border'} ${isReqRange ? 'ring-2 ring-amber-500 ring-offset-1 md:ring-offset-2 ring-offset-theme-card bg-amber-900/20' : ''}`}>
                                            <span className="text-xs md:text-sm font-black text-slate-300">{dan}</span>
                                            <div className="w-full flex flex-col gap-0.5 mt-0.5 md:mt-1 px-0.5 md:px-1 overflow-hidden">
                                                {zapisiNaOvajDan.map((ime, idx) => (
                                                    <div key={idx} className="bg-red-500/20 border border-red-500/30 text-red-400 text-[5px] md:text-[6px] uppercase font-black px-0.5 md:px-1 rounded truncate leading-tight w-full" title={ime}>{ime.split(' ')[0]}</div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 md:grid-cols-4 gap-3 md:gap-4 flex-1 content-start overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
                                {mjeseciBHS.map((mIme, idx) => {
                                    const stats = prebrojZahtjeveUMjesecu(trenutniMjesecKalendara.getFullYear(), idx);
                                    return (
                                        <div key={idx} onClick={() => { setTrenutniMjesecKalendara(new Date(trenutniMjesecKalendara.getFullYear(), idx, 1)); setPrikazKalendara('MJESEC'); }} className="aspect-square bg-theme-panel border border-theme-border rounded-xl md:rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-amber-500 hover:bg-amber-900/20 transition-all shadow-md group">
                                            <span className="text-sm md:text-lg font-black uppercase text-slate-300 group-hover:text-amber-500 transition-colors truncate px-1">{mIme.substring(0,3)}</span>
                                            <div className="mt-2 md:mt-4 flex flex-col gap-1 items-center w-full px-2">
                                                {stats.odobreno > 0 && <span className="text-[7px] md:text-[9px] bg-red-900/30 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded uppercase font-bold truncate w-full text-center">{stats.odobreno} Odobr.</span>}
                                                {stats.naCekanju > 0 && <span className="text-[7px] md:text-[9px] bg-amber-900/30 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded uppercase font-bold truncate w-full text-center">{stats.naCekanju} Čeka</span>}
                                                {stats.odobreno === 0 && stats.naCekanju === 0 && <span className="text-[7px] md:text-[9px] text-slate-600 uppercase font-bold truncate w-full text-center">Prazno</span>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 3: PROFIL RADNIKA */}
            {tab === 'profili' && (
                <div className="flex flex-col lg:flex-row gap-4 md:gap-6 animate-in slide-in-from-bottom">
                    <div className="w-full lg:w-1/3 bg-theme-card p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-theme-border shadow-2xl h-[30vh] lg:h-[700px] flex flex-col shrink-0">
                        <h3 className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-widest mb-3 md:mb-4 border-b border-theme-border pb-2 md:pb-3 shrink-0">Odaberi Radnika</h3>
                        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                            {radnici.map(r => (
                                <button key={r.id} onClick={() => setOdabraniRadnik(r)} className={`w-full text-left p-3 md:p-4 rounded-xl font-black uppercase text-[10px] md:text-xs transition-all border ${odabraniRadnik?.id === r.id ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-theme-panel border-theme-border text-slate-400 hover:text-white hover:border-slate-500'}`}>
                                    {r.ime_prezime}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 bg-theme-card p-4 md:p-8 rounded-2xl md:rounded-[2rem] border border-theme-border shadow-2xl overflow-hidden relative min-h-[500px]">
                        {!odabraniRadnik ? (
                            <div className="flex flex-col items-center justify-center h-full opacity-50 py-10 md:py-20">
                                <Users size={48} className="mb-4 text-slate-600" />
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-center text-xs md:text-sm">Odaberite radnika za prikaz profila</p>
                            </div>
                        ) : (() => {
                            const mjesecniZapis = radniSati.filter(s => s.radnik_ime === odabraniRadnik.ime_prezime);
                            const totalKasnjenje = mjesecniZapis.reduce((s, z) => s + (z.kasnjenje_min || 0), 0);
                            const daniKasnjenja = mjesecniZapis.filter(z => (z.kasnjenje_min || 0) > 0).length;
                            
                            let ukupnoSatiMjesec = 0;
                            let ukupnoRadnihDana = 0;
                            mjesecniZapis.forEach(z => {
                                const h = parseFloat(z.obracunato_sati) || 0;
                                const prek = (z.prekovremeno_min || 0) / 60;
                                ukupnoSatiMjesec += (h + prek);
                                if (h > 0 || prek > 0) ukupnoRadnihDana++;
                            });
                            
                            const kvotaUkupno = odabraniRadnik.godisnji_ukupno || 20;
                            const kvotaRadnik = odabraniRadnik.godisnji_iskoristeno_radnik || 0;
                            const kvotaFirma = odabraniRadnik.godisnji_iskoristeno_poslodavac || 0;
                            const kvotaOstalo = kvotaUkupno - kvotaRadnik - kvotaFirma;

                            const svaOdsustva = zahtjevi.filter(z => z.radnik_ime === odabraniRadnik.ime_prezime && z.status === 'ODOBRENO');
                            const bolovanja = svaOdsustva.filter(z => z.tip_odsustva === 'BOLOVANJE').reduce((s, z) => s + z.broj_radnih_dana, 0);
                            const neopravdani = svaOdsustva.filter(z => z.tip_odsustva === 'NEOPRAVDANO').reduce((s, z) => s + z.broj_radnih_dana, 0);

                            return (
                                <div className="space-y-4 md:space-y-6 h-full flex flex-col">
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-theme-border pb-4 md:pb-6 gap-3 md:gap-4 shrink-0">
                                        <div>
                                            <h2 className="text-xl md:text-3xl text-white font-black uppercase tracking-tighter truncate">{odabraniRadnik.ime_prezime}</h2>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                <p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-widest bg-theme-panel px-2 md:px-3 py-1 rounded-md md:rounded-lg border border-theme-border">Uloga: {odabraniRadnik.uloga}</p>
                                                <p className="text-blue-400 text-[10px] md:text-xs font-bold uppercase tracking-widest bg-blue-900/20 px-2 md:px-3 py-1 rounded-md md:rounded-lg border border-blue-500/30">🗓️ {ukupnoRadnihDana} DANA ({ukupnoSatiMjesec.toFixed(1)} h)</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 md:gap-3 items-center w-full sm:w-auto">
                                            <button onClick={() => setShowRucniUpis(true)} className="flex-1 sm:flex-none bg-red-900/30 text-red-400 hover:bg-red-600 hover:text-white px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl text-[9px] md:text-[10px] uppercase font-black border border-red-500/30 transition-colors">+ Upis Izostanka</button>
                                            <input type="month" value={mjesecPrikaza} onChange={e=>setMjesecPrikaza(e.target.value)} className="w-32 sm:w-auto p-2 md:p-3 bg-theme-panel border border-blue-500/50 rounded-lg md:rounded-xl text-blue-400 outline-none font-black cursor-pointer shadow-inner uppercase text-[10px] md:text-xs" />
                                        </div>
                                    </div>

                                    {showRucniUpis && (
                                        <div className="bg-slate-900/80 border border-red-500/50 p-4 md:p-6 rounded-xl md:rounded-2xl animate-in zoom-in-95 mb-4 shrink-0">
                                            <h4 className="text-red-400 font-black uppercase text-[9px] md:text-[10px] mb-3 md:mb-4 tracking-widest">Ručni upis izostanka (Admin)</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
                                                <div><label className="text-[8px] md:text-[9px] text-slate-500 uppercase block mb-1">Tip</label><select value={formaUpis.tip_odsustva} onChange={e=>setFormaUpis({...formaUpis, tip_odsustva: e.target.value})} className="w-full p-2 md:p-3 bg-black rounded-lg text-white font-bold text-[10px] md:text-xs outline-none"><option value="NEOPRAVDANO">Neopravdano</option><option value="OPRAVDANO">Opravdano (Slobodno)</option><option value="BOLOVANJE">Bolovanje</option></select></div>
                                                <div><label className="text-[8px] md:text-[9px] text-slate-500 uppercase block mb-1">Od Datuma</label><input type="date" value={formaUpis.datum_od} onChange={e=>setFormaUpis({...formaUpis, datum_od: e.target.value})} className="w-full p-2 md:p-3 bg-black rounded-lg text-white font-bold text-[10px] md:text-xs outline-none" /></div>
                                                <div><label className="text-[8px] md:text-[9px] text-slate-500 uppercase block mb-1">Do Datuma</label><input type="date" value={formaUpis.datum_do} onChange={e=>setFormaUpis({...formaUpis, datum_do: e.target.value})} className="w-full p-2 md:p-3 bg-black rounded-lg text-white font-bold text-[10px] md:text-xs outline-none" /></div>
                                                <div><label className="text-[8px] md:text-[9px] text-slate-500 uppercase block mb-1">Napomena</label><input type="text" value={formaUpis.razlog} onChange={e=>setFormaUpis({...formaUpis, razlog: e.target.value})} placeholder="Razlog..." className="w-full p-2 md:p-3 bg-black rounded-lg text-white font-bold text-[10px] md:text-xs outline-none" /></div>
                                            </div>
                                            <div className="flex gap-2"><button onClick={()=>setShowRucniUpis(false)} className="flex-1 md:flex-none px-4 py-2 bg-theme-panel text-slate-400 rounded-lg text-[9px] md:text-[10px] uppercase font-black">Odustani</button><button onClick={rucniUpisOdsustva} className="flex-[2] md:flex-none px-4 py-2 bg-red-600 text-white rounded-lg text-[9px] md:text-[10px] uppercase font-black">Zavedi Izostanak</button></div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 shrink-0">
                                        <div className="bg-blue-900/10 border border-blue-500/20 p-3 md:p-4 rounded-xl md:rounded-2xl text-center"><p className="text-[8px] md:text-[9px] text-blue-500 font-black uppercase mb-1">Godišnji Odmor</p><p className="text-lg md:text-xl text-white font-black">{kvotaOstalo} <span className="text-[9px] md:text-[10px] text-blue-400">dana</span></p><p className="text-[7px] md:text-[8px] text-slate-500 uppercase mt-1">Iskoristio: R({kvotaRadnik}) P({kvotaFirma})</p></div>
                                        <div className="bg-red-900/10 border border-red-500/20 p-3 md:p-4 rounded-xl md:rounded-2xl text-center"><p className="text-[8px] md:text-[9px] text-red-500 font-black uppercase mb-1">Kašnjenja</p><p className="text-lg md:text-xl text-white font-black">{totalKasnjenje} <span className="text-[9px] md:text-[10px] text-red-400">min</span></p><p className="text-[7px] md:text-[8px] text-slate-500 uppercase mt-1">U {daniKasnjenja} dana</p></div>
                                        <div className="bg-orange-900/10 border border-orange-500/20 p-3 md:p-4 rounded-xl md:rounded-2xl text-center"><p className="text-[8px] md:text-[9px] text-orange-500 font-black uppercase mb-1">Bolovanje</p><p className="text-lg md:text-xl text-white font-black">{bolovanja} <span className="text-[9px] md:text-[10px] text-orange-400">dana ukupno</span></p></div>
                                        <div className="bg-slate-800 border border-slate-700 p-3 md:p-4 rounded-xl md:rounded-2xl text-center"><p className="text-[8px] md:text-[9px] text-slate-400 font-black uppercase mb-1">Neopravdani izo.</p><p className="text-lg md:text-xl text-white font-black">{neopravdani} <span className="text-[9px] md:text-[10px] text-slate-500">dana ukupno</span></p></div>
                                    </div>

                                    <div className="mt-4 md:mt-8 border-t border-theme-border pt-4 md:pt-6 flex-1 flex flex-col min-h-0">
                                        <h4 className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-widest mb-3 md:mb-4 shrink-0">Dnevnik Skeniranja u ovom mjesecu:</h4>
                                        <div className="bg-theme-panel border border-theme-border rounded-xl shadow-inner flex-1 overflow-x-auto custom-scrollbar">
                                            <table className="w-full text-left text-[10px] md:text-xs min-w-[500px]">
                                                <thead className="bg-black/40 text-slate-500 uppercase text-[8px] md:text-[9px]">
                                                    <tr><th className="p-3 md:p-4 sticky top-0 bg-black/80 backdrop-blur">Datum</th><th className="p-3 md:p-4 sticky top-0 bg-black/80 backdrop-blur">Dolazak</th><th className="p-3 md:p-4 sticky top-0 bg-black/80 backdrop-blur">Odlazak</th><th className="p-3 md:p-4 text-center sticky top-0 bg-black/80 backdrop-blur">Obračunato</th><th className="p-3 md:p-4 text-right sticky top-0 bg-black/80 backdrop-blur">Devijacije / Korekcija</th></tr>
                                                </thead>
                                                <tbody className="text-theme-text font-bold divide-y divide-theme-border/50">
                                                    {mjesecniZapis.length === 0 && <tr><td colSpan="5" className="p-4 md:p-6 text-center text-slate-600 italic">Nema prijava u ovom mjesecu.</td></tr>}
                                                    {mjesecniZapis.map(z => {
                                                        const standardSati = parseFloat(z.obracunato_sati) || 0;
                                                        const prekovrSati = (z.prekovremeno_min || 0) / 60;
                                                        const ukupnoObacunato = standardSati + prekovrSati;

                                                        return (
                                                            <tr key={z.id} className="hover:bg-slate-800/50 transition-colors">
                                                                <td className="p-3 md:p-4 uppercase">{new Date(z.datum).toLocaleDateString('bs-BA')}</td>
                                                                <td className="p-3 md:p-4 text-emerald-400">{z.vrijeme_dolaska ? new Date(z.vrijeme_dolaska).toLocaleTimeString('de-DE') : '-'}</td>
                                                                <td className="p-3 md:p-4 text-amber-400">{z.vrijeme_odlaska ? new Date(z.vrijeme_odlaska).toLocaleTimeString('de-DE') : '-'}</td>
                                                                <td className="p-3 md:p-4 text-center font-black text-white">{ukupnoObacunato.toFixed(1)} h</td>
                                                                <td className="p-3 md:p-4 text-right">
                                                                    <div className="flex flex-wrap justify-end items-center gap-2">
                                                                        {z.kasnjenje_min > 0 && <span className="text-[8px] md:text-[9px] bg-red-900/40 text-red-400 px-1.5 md:px-2 py-0.5 md:py-1 rounded">Kasnio: {z.kasnjenje_min}m</span>}
                                                                        {z.raniji_izlazak_min > 0 && <span className="text-[8px] md:text-[9px] bg-orange-900/40 text-orange-400 px-1.5 md:px-2 py-0.5 md:py-1 rounded">Ranije: {z.raniji_izlazak_min}m</span>}
                                                                        {z.prekovremeno_min > 0 && <span className="text-[8px] md:text-[9px] bg-emerald-900/40 text-emerald-400 px-1.5 md:px-2 py-0.5 md:py-1 rounded">Prekovr: {(z.prekovremeno_min/60).toFixed(1)}h</span>}
                                                                        
                                                                        <button onClick={() => otvoriModalUredi(z)} className="text-[8px] md:text-[9px] bg-theme-card text-blue-400 hover:bg-blue-600 hover:text-white px-2 py-1.5 rounded-lg transition-colors border border-theme-border flex items-center gap-1 shadow-sm"><Edit3 size={12}/> Uredi</button>
                                                                        <button onClick={() => obrisiZapisSigurno(z)} className="text-[8px] md:text-[9px] bg-red-900/30 text-red-400 hover:bg-red-600 hover:text-white px-2 py-1.5 rounded-lg transition-colors border border-red-500/30 flex items-center shadow-sm font-black uppercase">✕ Obriši</button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* TAB 4: PRAZNICI I KALENDAR */}
            {tab === 'kalendar' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 animate-in slide-in-from-right max-w-5xl mx-auto">
                    <div className="lg:col-span-5 space-y-4 md:space-y-6">
                        
                        <div className="bg-theme-card p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-theme-border shadow-2xl">
                            <h3 className="text-emerald-400 font-black uppercase text-xs md:text-sm mb-4 border-b border-theme-border pb-3">⚙️ Postavke Glavne Smjene</h3>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div><label className="text-[9px] md:text-[10px] text-slate-500 uppercase ml-1 md:ml-2 block mb-1">Početak smjene</label><input type="time" value={pocetakSmjene} onChange={e=>setPocetakSmjene(e.target.value)} className="w-full p-3 md:p-4 bg-black border border-emerald-500/30 rounded-xl text-emerald-400 font-black outline-none focus:border-emerald-400 cursor-pointer text-center text-lg" /></div>
                                <div><label className="text-[9px] md:text-[10px] text-slate-500 uppercase ml-1 md:ml-2 block mb-1">Kraj smjene</label><input type="time" value={krajSmjene} onChange={e=>setKrajSmjene(e.target.value)} className="w-full p-3 md:p-4 bg-black border border-emerald-500/30 rounded-xl text-emerald-400 font-black outline-none focus:border-emerald-400 cursor-pointer text-center text-lg" /></div>
                            </div>
                            <button onClick={spasiPostavkeSmjene} className="w-full py-3 md:py-4 bg-emerald-600 text-white font-black rounded-xl uppercase text-[10px] md:text-xs shadow-lg hover:bg-emerald-500 transition-all">💾 Sačuvaj Radno Vrijeme</button>
                            <p className="text-[8px] text-slate-500 mt-3 text-center uppercase tracking-widest">Ovo vrijeme se koristi za obračun kašnjenja i ranijih izlazaka u cijelom sistemu.</p>
                        </div>

                        <div className="bg-theme-card p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-theme-border shadow-2xl h-fit">
                            <h3 className="text-purple-400 font-black uppercase text-xs md:text-sm mb-4 md:mb-6 border-b border-theme-border pb-3 md:pb-4">➕ Praznik ili Subota</h3>
                            <div className="space-y-3 md:space-y-4">
                                <div><label className="text-[9px] md:text-[10px] text-slate-500 uppercase ml-1 md:ml-2 block mb-1">Ručni unos datuma</label><input type="date" value={formaPraznik.datum} onChange={e=>setFormaPraznik({...formaPraznik, datum: e.target.value})} className="w-full p-3 md:p-4 bg-theme-panel border border-theme-border rounded-xl text-white outline-none focus:border-purple-500 cursor-pointer" /></div>
                                <div><label className="text-[9px] md:text-[10px] text-slate-500 uppercase ml-1 md:ml-2 block mb-1">Naziv (Npr. Prvi Maj, Radna Subota...)</label><input type="text" value={formaPraznik.naziv} onChange={e=>setFormaPraznik({...formaPraznik, naziv: e.target.value})} className="w-full p-3 md:p-4 bg-theme-panel border border-theme-border rounded-xl text-white outline-none focus:border-purple-500 font-bold uppercase" placeholder="Naziv izuzetka" /></div>
                                <div className="bg-theme-panel p-3 md:p-4 rounded-xl border border-theme-border flex items-center justify-between">
                                    <div><p className="text-[9px] md:text-[10px] text-slate-300 font-black uppercase">Da li se radi ovaj dan?</p><p className="text-[7px] md:text-[8px] text-slate-500 uppercase mt-0.5">Utiče na skidanje godišnjeg</p></div>
                                    <select value={formaPraznik.je_radni_dan} onChange={e=>setFormaPraznik({...formaPraznik, je_radni_dan: e.target.value === 'true'})} className="p-1.5 md:p-2 bg-black text-[10px] md:text-xs font-black uppercase text-white rounded border border-slate-600 outline-none"><option value="false">NERADNI DAN (Praznik)</option><option value="true">RADNI DAN (Subota)</option></select>
                                </div>
                                <button onClick={dodajPraznik} className="w-full py-4 md:py-5 bg-purple-600 text-white font-black rounded-xl uppercase text-[10px] md:text-xs shadow-lg hover:bg-purple-500 transition-all">Dodaj u kalendar</button>
                            </div>

                            <div className="mt-6 md:mt-8 border-t border-theme-border pt-4 md:pt-6 space-y-2 md:space-y-3">
                                <h4 className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Automatsko generisanje subota</h4>
                                <div className="mb-3">
                                    <label className="text-[8px] text-slate-500 uppercase block mb-1">Primijeni pravilo od datuma:</label>
                                    <input type="date" value={datumGenOd} onChange={e => setDatumGenOd(e.target.value)} className="w-full p-2 md:p-3 bg-theme-panel border border-slate-600 rounded-lg text-white text-[10px] outline-none focus:border-blue-500" />
                                </div>
                                <button onClick={() => generisiSubote('SVE')} className="w-full py-2.5 md:py-3 bg-theme-panel text-white text-[9px] md:text-[10px] font-black uppercase rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors">Sve subote su RADNE</button>
                                <button onClick={() => generisiSubote('PRVA')} className="w-full py-2.5 md:py-3 bg-theme-panel text-white text-[9px] md:text-[10px] font-black uppercase rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors">Samo prva subota u mjesecu je RADNA</button>
                                <button onClick={() => generisiSubote('DRUGA')} className="w-full py-2.5 md:py-3 bg-theme-panel text-white text-[9px] md:text-[10px] font-black uppercase rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors">Svaka druga subota je RADNA</button>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-7 bg-theme-card p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-theme-border shadow-2xl h-[400px] lg:h-auto flex flex-col">
                        <div className="flex justify-between items-center mb-4 md:mb-6 border-b border-theme-border pb-3 md:pb-4 shrink-0">
                            <h3 className="text-slate-400 font-black uppercase text-xs">Izuzeci u bazi</h3>
                            {praznici.length > 0 && (
                                <button onClick={obrisiSvePraznike} className="bg-red-900/30 text-red-400 hover:bg-red-500 hover:text-white px-2 py-1.5 rounded text-[9px] font-black uppercase border border-red-500/30 transition-colors">
                                    🗑️ Obriši Sve
                                </button>
                            )}
                        </div>
                        <div className="space-y-2 md:space-y-3 flex-1 overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
                            {praznici.length === 0 && <p className="text-center text-slate-500 py-10 font-bold border border-dashed border-theme-border rounded-xl text-xs">Kalendar nema unesenih izuzetaka.</p>}
                            {praznici.map(p => (
                                <div key={p.datum} className="bg-theme-panel p-3 md:p-4 rounded-xl border border-theme-border flex justify-between items-center group shadow-sm">
                                    <div>
                                        <p className="text-white text-xs md:text-sm font-black uppercase">{new Date(p.datum).toLocaleDateString('bs-BA')} - {p.naziv}</p>
                                        <p className={`text-[8px] md:text-[9px] font-black uppercase mt-1 inline-block px-2 py-0.5 rounded ${p.je_radni_dan ? 'bg-amber-900/30 text-amber-400 border border-amber-500/30' : 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30'}`}>{p.je_radni_dan ? 'RADNI DAN' : 'NERADNI PRAZNIK'}</p>
                                    </div>
                                    <button onClick={() => obrisiPraznik(p.datum)} className="text-red-500 bg-red-900/20 w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-lg opacity-100 lg:opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all font-black text-xs shrink-0">✕</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}