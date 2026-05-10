"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import PametniDialog from '../components/PametniDialog';
import { useSaaS } from '../utils/useSaaS';
import { Users, CalendarCheck, Clock4, CalendarX2, ChevronLeft, ChevronRight } from 'lucide-react';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const POČETAK_SMJENE = '07:30';
const KRAJ_SMJENE = '16:00';

export default function HrDashboardModule({ user, header, setHeader, onExit }) {
    const saas = useSaaS('hr_modul', { boja_kartice: '#1e293b', boja_slova: '#ffffff', boja_akcenta: '#3b82f6' });

    const [tab, setTab] = useState('prisutnost');
    const [radnici, setRadnici] = useState([]);
    const [radniSati, setRadniSati] = useState([]);
    const [zahtjevi, setZahtjevi] = useState([]);
    const [praznici, setPraznici] = useState([]);

    const [odabraniRadnik, setOdabraniRadnik] = useState(null);
    const [mjesecPrikaza, setMjesecPrikaza] = useState(new Date().toISOString().substring(0, 7)); 
    
    // Za interaktivni kalendar u odobrenjima
    const [trenutniMjesecKalendara, setTrenutniMjesecKalendara] = useState(new Date());
    const [selektovaniZahtjev, setSelektovaniZahtjev] = useState(null);

    // Modali za unos
    const [showRucniUpis, setShowRucniUpis] = useState(false);
    const [formaUpis, setFormaUpis] = useState({ tip_odsustva: 'NEOPRAVDANO', datum_od: '', datum_do: '', razlog: '' });
    
    // Nedostajuća varijabla za praznike!
    const [formaPraznik, setFormaPraznik] = useState({ datum: '', naziv: '', je_radni_dan: false });

    const [dialog, setDialog] = useState({ isOpen: false });
    const prikaziDialog = (opcije) => setDialog({ isOpen: true, confirmText: 'POTVRDI', cancelText: 'ZATVORI', ...opcije });
    const zatvoriDialog = () => setDialog({ isOpen: false });

    useEffect(() => { loadAll(); }, [mjesecPrikaza]);

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

    const izracunajDnevnicu = async (zapis) => {
        if (!zapis.vrijeme_dolaska || !zapis.vrijeme_odlaska) return;

        const dStart = new Date(zapis.vrijeme_dolaska);
        const dEnd = new Date(zapis.vrijeme_odlaska);
        
        const [hStart, mStart] = POČETAK_SMJENE.split(':');
        const [hEnd, mEnd] = KRAJ_SMJENE.split(':');
        
        const officialStart = new Date(dStart); officialStart.setHours(parseInt(hStart), parseInt(mStart), 0);
        const officialEnd = new Date(dEnd); officialEnd.setHours(parseInt(hEnd), parseInt(mEnd), 0);

        let kasnjenjeMin = 0; let ranijiIzlazakMin = 0;
        let obracunskiStart = new Date(dStart);
        let obracunskiEnd = new Date(dEnd);

        if (dStart < officialStart) { obracunskiStart = officialStart; }
        else if (dStart > officialStart) { kasnjenjeMin = Math.round((dStart - officialStart) / 60000); }

        if (dEnd < officialEnd) { ranijiIzlazakMin = Math.round((officialEnd - dEnd) / 60000); }
        else if (dEnd > officialEnd) { obracunskiEnd = officialEnd; }

        const radniSatiDec = (obracunskiEnd - obracunskiStart) / (1000 * 60 * 60);

        await supabase.from('radni_sati').update({
            obracunato_sati: Math.max(0, radniSatiDec).toFixed(2),
            kasnjenje_min: kasnjenjeMin,
            raniji_izlazak_min: ranijiIzlazakMin
        }).eq('id', zapis.id);
        
        loadAll();
    };

    const odobriPrekovremeno = async (id, sati) => {
        const val = prompt("Koliko sati prekovremenog odobravate? (npr. 1.5)");
        if (val && !isNaN(val)) {
            await supabase.from('radni_sati').update({ prekovremeno_min: parseFloat(val) * 60 }).eq('id', id);
            loadAll();
        }
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
                setSelektovaniZahtjev(null);
                loadAll(); zatvoriDialog();
            },
            onCancel: zatvoriDialog
        });
    };

    const rucniUpisOdsustva = async () => {
        if (!formaUpis.datum_od || !formaUpis.datum_do) return alert("Odaberite datume!");
        
        let brojDana = 0;
        for (let d = new Date(formaUpis.datum_od); d <= new Date(formaUpis.datum_do); d.setDate(d.getDate() + 1)) {
            const day = d.getDay();
            if (day !== 0 && day !== 6) brojDana++; 
        }

        const payload = {
            radnik_ime: odabraniRadnik.ime_prezime,
            tip_odsustva: formaUpis.tip_odsustva,
            datum_od: formaUpis.datum_od, datum_do: formaUpis.datum_do,
            broj_radnih_dana: brojDana, status: 'ODOBRENO', inicijativa: 'POSLODAVAC',
            razlog: formaUpis.razlog, odobrio_korisnik: user?.ime_prezime
        };

        await supabase.from('zahtjevi_odsustva').insert([payload]);
        setShowRucniUpis(false); loadAll();
    };

    // Nedostajuće funkcije za praznike!
    const dodajPraznik = async () => {
        if (!formaPraznik.datum || !formaPraznik.naziv) return alert("Unesite datum i naziv praznika!");
        await supabase.from('kalendar_izuzeci').insert([formaPraznik]);
        setFormaPraznik({ datum: '', naziv: '', je_radni_dan: false });
        loadAll();
    };

    const obrisiPraznik = async (datum) => {
        if(window.confirm("Da li ste sigurni da želite obrisati ovaj izuzetak u kalendaru?")) {
            await supabase.from('kalendar_izuzeci').delete().eq('datum', datum);
            loadAll();
        }
    };

    const generisiSubote = async (tip) => {
        const danas = new Date(); const godina = danas.getFullYear();
        let zaUbaciti = [];
        for (let m = 0; m < 12; m++) {
            let prvaSubotaNadjen = false;
            let counterSubota = 0;
            for (let d = 1; d <= 31; d++) {
                const dateObj = new Date(godina, m, d);
                if (dateObj.getMonth() !== m) break;
                if (dateObj.getDay() === 6) {
                    counterSubota++;
                    const iso = dateObj.toISOString().split('T')[0];
                    if (tip === 'SVE') zaUbaciti.push({ datum: iso, naziv: 'Radna Subota', je_radni_dan: true });
                    else if (tip === 'PRVA' && !prvaSubotaNadjen) { zaUbaciti.push({ datum: iso, naziv: 'Radna Subota (Prva)', je_radni_dan: true }); prvaSubotaNadjen = true; }
                    else if (tip === 'DRUGA' && counterSubota % 2 !== 0) { zaUbaciti.push({ datum: iso, naziv: 'Radna Subota', je_radni_dan: true }); }
                }
            }
        }
        
        prikaziDialog({
            tip: 'info', naslov: 'Automatski Kalendar',
            poruka: `Pronađeno je ukupno ${zaUbaciti.length} subota po zadanom pravilu.\nŽelite li ih upisati u kalendar kao radne?`,
            confirmText: '✅ UPISATI SVE', cancelText: '✕ ODUSTANI',
            onConfirm: async () => { await supabase.from('kalendar_izuzeci').upsert(zaUbaciti); loadAll(); zatvoriDialog(); },
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
                let dStr = d.toISOString().split('T')[0];
                if(!mapa[dStr]) mapa[dStr] = [];
                mapa[dStr].push(z.radnik_ime);
            }
        });
        return mapa;
    }, [zahtjevi]);

    const danasStr = new Date().toISOString().split('T')[0];
    const prisutniDanas = radniSati.filter(s => s.datum === danasStr);

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6 font-bold animate-in fade-in" style={{ color: saas.ui.boja_slova }}>
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-blue-500" user={user} modulIme="hr_modul" saas={saas} hideMasina={true} />
            <PametniDialog {...dialog} />

            <div className="flex bg-theme-panel p-1.5 rounded-2xl border border-theme-border shadow-inner">
                <button onClick={() => setTab('prisutnost')} className={`flex-1 py-4 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-2 ${tab === 'prisutnost' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}><Clock4 size={16}/> Prisutnost (Danas)</button>
                <button onClick={() => setTab('odobrenja')} className={`flex-1 py-4 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-2 ${tab === 'odobrenja' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}><CalendarCheck size={16}/> Odobrenja Odmora</button>
                <button onClick={() => setTab('profili')} className={`flex-1 py-4 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-2 ${tab === 'profili' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}><Users size={16}/> Profili Radnika</button>
                <button onClick={() => setTab('kalendar')} className={`flex-1 py-4 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-2 ${tab === 'kalendar' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}><CalendarX2 size={16}/> Praznici / Kalendar</button>
            </div>

            {/* TAB 1: PRISUTNOST DANAS */}
            {tab === 'prisutnost' && (
                <div className="bg-theme-card p-6 rounded-[2rem] border border-theme-border shadow-2xl animate-in slide-in-from-left">
                    <div className="flex justify-between items-center mb-6 border-b border-theme-border pb-4">
                        <h3 className="text-blue-400 font-black uppercase text-sm">📍 TRENUTNO STANJE U POGONU ({prisutniDanas.length} radnika)</h3>
                        <p className="text-slate-400 text-xs font-bold">{new Date().toLocaleDateString('bs-BA')}</p>
                    </div>

                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {prisutniDanas.length === 0 && <p className="text-center text-slate-500 py-10 font-bold border border-dashed border-theme-border rounded-xl">Kiosk nema prijava za danas.</p>}
                        {prisutniDanas.map(p => (
                            <div key={p.id} className="bg-theme-panel p-4 rounded-xl border border-theme-border flex justify-between items-center hover:border-blue-500/50 transition-all shadow-sm">
                                <div>
                                    <p className="text-theme-text text-sm font-black uppercase">{p.radnik_ime}</p>
                                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">
                                        Ulaz: <span className="text-white">{p.vrijeme_dolaska ? new Date(p.vrijeme_dolaska).toLocaleTimeString('de-DE') : '-'}</span> 
                                        <span className="mx-2 opacity-50">|</span> 
                                        Izlaz: <span className="text-white">{p.vrijeme_odlaska ? new Date(p.vrijeme_odlaska).toLocaleTimeString('de-DE') : 'JOŠ UVIJEK TU'}</span>
                                    </p>
                                </div>
                                <div className="text-right flex items-center gap-3">
                                    <span className={`text-[9px] px-3 py-1.5 rounded-lg font-black uppercase tracking-widest ${p.status === 'NA_POSLU' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                                        {p.status === 'NA_POSLU' ? '🟢 AKTIVAN' : '⚪ ZAVRŠIO'}
                                    </span>
                                    {p.status === 'ZAVRŠIO' && parseFloat(p.obracunato_sati) === 0 && (
                                        <button onClick={() => izracunajDnevnicu(p)} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-lg">⚙️ Obračunaj Sate</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 2: ODOBRENJA ODMORA (Sa Vizuelnim Kalendarom) */}
            {tab === 'odobrenja' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-right">
                    <div className="lg:col-span-5 bg-theme-card p-6 rounded-[2rem] border border-theme-border shadow-2xl flex flex-col h-[700px]">
                        <h3 className="text-amber-500 font-black uppercase text-sm mb-4 border-b border-theme-border pb-4">📋 Zahtjevi na čekanju</h3>
                        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                            {zahtjevi.filter(z => z.status === 'NA ČEKANJU').length === 0 && <p className="text-center text-slate-500 py-10 font-bold border border-dashed border-theme-border rounded-xl">Nema novih zahtjeva za odmor.</p>}
                            {zahtjevi.filter(z => z.status === 'NA ČEKANJU').map(z => {
                                const isSel = selektovaniZahtjev?.id === z.id;
                                return (
                                    <div key={z.id} onClick={() => {setSelektovaniZahtjev(z); setTrenutniMjesecKalendara(new Date(z.datum_od));}} className={`p-4 rounded-2xl cursor-pointer transition-all border shadow-sm ${isSel ? 'bg-amber-900/10 border-amber-500/50' : 'bg-theme-panel border-theme-border hover:border-amber-500/30'}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-black text-white uppercase">{z.radnik_ime}</span>
                                            <span className="text-[9px] bg-blue-900/30 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-black">{z.tip_odsustva}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-2">
                                            {new Date(z.datum_od).toLocaleDateString('bs-BA')} - {new Date(z.datum_do).toLocaleDateString('bs-BA')}
                                        </p>
                                        
                                        {isSel && (
                                            <div className="mt-4 pt-3 border-t border-theme-border/50">
                                                <p className="text-[9px] text-slate-400 uppercase font-black mb-2">Čija je inicijativa?</p>
                                                <div className="flex gap-2 mb-2">
                                                    <button onClick={() => obradiZahtjevOdmor(z, 'ODOBRENO', 'RADNIK')} className="flex-1 bg-emerald-900/30 hover:bg-emerald-600 text-emerald-400 hover:text-white px-2 py-2 rounded-lg text-[9px] font-black uppercase border border-emerald-500/30 transition-all">✅ Radnik</button>
                                                    <button onClick={() => obradiZahtjevOdmor(z, 'ODOBRENO', 'POSLODAVAC')} className="flex-1 bg-amber-900/30 hover:bg-amber-600 text-amber-400 hover:text-white px-2 py-2 rounded-lg text-[9px] font-black uppercase border border-amber-500/30 transition-all">✅ Poslodavac</button>
                                                </div>
                                                <button onClick={() => obradiZahtjevOdmor(z, 'ODBIJENO', 'N/A')} className="w-full bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white px-2 py-2 rounded-lg text-[9px] font-black uppercase border border-red-500/30 transition-all">✕ ODBIJ</button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="lg:col-span-7 bg-theme-card p-6 rounded-[2rem] border border-theme-border shadow-2xl h-[700px] flex flex-col">
                        <div className="flex justify-between items-center mb-6 bg-theme-panel p-2 rounded-2xl border border-theme-border">
                            <button onClick={() => setTrenutniMjesecKalendara(new Date(trenutniMjesecKalendara.getFullYear(), trenutniMjesecKalendara.getMonth() - 1, 1))} className="p-3 bg-slate-800 hover:bg-amber-600 rounded-xl transition-colors"><ChevronLeft size={20}/></button>
                            <h3 className="text-lg font-black uppercase tracking-widest text-amber-500">
                                {trenutniMjesecKalendara.toLocaleDateString('bs-BA', { month: 'long', year: 'numeric' })}
                            </h3>
                            <button onClick={() => setTrenutniMjesecKalendara(new Date(trenutniMjesecKalendara.getFullYear(), trenutniMjesecKalendara.getMonth() + 1, 1))} className="p-3 bg-slate-800 hover:bg-amber-600 rounded-xl transition-colors"><ChevronRight size={20}/></button>
                        </div>
                        
                        <div className="grid grid-cols-7 gap-2 flex-1">
                            {['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'].map(d => <div key={d} className="text-center text-[10px] text-slate-500 font-black uppercase pb-2">{d}</div>)}
                            
                            {Array.from({length: praznaPoljaNaPocetku}).map((_, i) => <div key={`empty-${i}`} />)}
                            
                            {daniNiz.map((dan) => {
                                const dateObj = new Date(trenutniMjesecKalendara.getFullYear(), trenutniMjesecKalendara.getMonth(), dan);
                                const iso = dateObj.toISOString().split('T')[0];
                                const zapisiNaOvajDan = odsustvaZauzetost[iso] || [];
                                const jeVikend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                                
                                const isReqRange = selektovaniZahtjev && dateObj >= new Date(selektovaniZahtjev.datum_od) && dateObj <= new Date(selektovaniZahtjev.datum_do);

                                return (
                                    <div key={dan} className={`aspect-square rounded-2xl flex flex-col items-center justify-start pt-2 border-2 transition-all relative ${jeVikend ? 'bg-slate-900/50 border-slate-800' : 'bg-theme-panel border-theme-border'} ${isReqRange ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-theme-card bg-amber-900/20' : ''}`}>
                                        <span className="text-sm font-black text-slate-300">{dan}</span>
                                        <div className="w-full flex flex-col gap-0.5 mt-1 px-1 overflow-hidden">
                                            {zapisiNaOvajDan.map((ime, idx) => (
                                                <div key={idx} className="bg-red-500/20 border border-red-500/30 text-red-400 text-[6px] uppercase font-black px-1 rounded truncate leading-tight w-full" title={ime}>{ime.split(' ')[0]}</div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: PROFIL RADNIKA (HR ANALITIKA I UPIS BOLOVANJA) */}
            {tab === 'profili' && (
                <div className="flex flex-col lg:flex-row gap-6 animate-in slide-in-from-bottom">
                    <div className="w-full lg:w-1/3 bg-theme-card p-6 rounded-[2rem] border border-theme-border shadow-2xl h-fit shrink-0">
                        <h3 className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-4 border-b border-theme-border pb-3">Odaberi Radnika</h3>
                        <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
                            {radnici.map(r => (
                                <button key={r.id} onClick={() => setOdabraniRadnik(r)} className={`w-full text-left p-4 rounded-xl font-black uppercase text-xs transition-all border ${odabraniRadnik?.id === r.id ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-theme-panel border-theme-border text-slate-400 hover:text-white hover:border-slate-500'}`}>
                                    {r.ime_prezime}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 bg-theme-card p-8 rounded-[2rem] border border-theme-border shadow-2xl overflow-hidden relative">
                        {!odabraniRadnik ? (
                            <div className="flex flex-col items-center justify-center h-full opacity-50 py-20">
                                <Users size={64} className="mb-4 text-slate-600" />
                                <p className="text-slate-400 font-bold uppercase tracking-widest">Odaberite radnika lijevo za prikaz profila</p>
                            </div>
                        ) : (() => {
                            const mjesecniZapis = radniSati.filter(s => s.radnik_ime === odabraniRadnik.ime_prezime);
                            const totalKasnjenje = mjesecniZapis.reduce((s, z) => s + (z.kasnjenje_min || 0), 0);
                            const totalRanije = mjesecniZapis.reduce((s, z) => s + (z.raniji_izlazak_min || 0), 0);
                            const totalPrekovremeno = mjesecniZapis.reduce((s, z) => s + ((z.prekovremeno_min || 0)/60), 0);
                            const daniKasnjenja = mjesecniZapis.filter(z => (z.kasnjenje_min || 0) > 0).length;
                            
                            const kvotaUkupno = odabraniRadnik.godisnji_ukupno || 20;
                            const kvotaRadnik = odabraniRadnik.godisnji_iskoristeno_radnik || 0;
                            const kvotaFirma = odabraniRadnik.godisnji_iskoristeno_poslodavac || 0;
                            const kvotaOstalo = kvotaUkupno - kvotaRadnik - kvotaFirma;

                            const svaOdsustva = zahtjevi.filter(z => z.radnik_ime === odabraniRadnik.ime_prezime && z.status === 'ODOBRENO');
                            const bolovanja = svaOdsustva.filter(z => z.tip_odsustva === 'BOLOVANJE').reduce((s, z) => s + z.broj_radnih_dana, 0);
                            const opravdani = svaOdsustva.filter(z => z.tip_odsustva === 'OPRAVDANO').reduce((s, z) => s + z.broj_radnih_dana, 0);
                            const neopravdani = svaOdsustva.filter(z => z.tip_odsustva === 'NEOPRAVDANO').reduce((s, z) => s + z.broj_radnih_dana, 0);

                            return (
                                <div className="space-y-6">
                                    <div className="flex flex-col md:flex-row justify-between md:items-center border-b border-theme-border pb-6 gap-4">
                                        <div>
                                            <h2 className="text-3xl text-white font-black uppercase tracking-tighter">{odabraniRadnik.ime_prezime}</h2>
                                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2 bg-theme-panel inline-block px-3 py-1 rounded-lg border border-theme-border">Uloga: {odabraniRadnik.uloga}</p>
                                        </div>
                                        <div className="flex gap-3 items-center">
                                            <button onClick={() => setShowRucniUpis(true)} className="bg-red-900/30 text-red-400 hover:bg-red-600 hover:text-white px-4 py-3 rounded-xl text-[10px] uppercase font-black border border-red-500/30 transition-colors">+ Upis Izostanka</button>
                                            <input type="month" value={mjesecPrikaza} onChange={e=>setMjesecPrikaza(e.target.value)} className="p-3 bg-theme-panel border border-blue-500/50 rounded-xl text-blue-400 outline-none font-black cursor-pointer shadow-inner uppercase text-xs" />
                                        </div>
                                    </div>

                                    {showRucniUpis && (
                                        <div className="bg-slate-900/80 border border-red-500/50 p-6 rounded-2xl animate-in zoom-in-95 mb-6">
                                            <h4 className="text-red-400 font-black uppercase text-[10px] mb-4 tracking-widest">Ručni upis izostanka (Admin)</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                                <div><label className="text-[9px] text-slate-500 uppercase block mb-1">Tip</label><select value={formaUpis.tip_odsustva} onChange={e=>setFormaUpis({...formaUpis, tip_odsustva: e.target.value})} className="w-full p-3 bg-black rounded-lg text-white font-bold text-xs outline-none"><option value="NEOPRAVDANO">Neopravdano</option><option value="OPRAVDANO">Opravdano (Slobodno)</option><option value="BOLOVANJE">Bolovanje</option></select></div>
                                                <div><label className="text-[9px] text-slate-500 uppercase block mb-1">Od Datuma</label><input type="date" value={formaUpis.datum_od} onChange={e=>setFormaUpis({...formaUpis, datum_od: e.target.value})} className="w-full p-3 bg-black rounded-lg text-white font-bold text-xs outline-none" /></div>
                                                <div><label className="text-[9px] text-slate-500 uppercase block mb-1">Do Datuma</label><input type="date" value={formaUpis.datum_do} onChange={e=>setFormaUpis({...formaUpis, datum_do: e.target.value})} className="w-full p-3 bg-black rounded-lg text-white font-bold text-xs outline-none" /></div>
                                                <div><label className="text-[9px] text-slate-500 uppercase block mb-1">Napomena</label><input type="text" value={formaUpis.razlog} onChange={e=>setFormaUpis({...formaUpis, razlog: e.target.value})} placeholder="Razlog..." className="w-full p-3 bg-black rounded-lg text-white font-bold text-xs outline-none" /></div>
                                            </div>
                                            <div className="flex gap-2"><button onClick={()=>setShowRucniUpis(false)} className="px-4 py-2 bg-theme-panel text-slate-400 rounded-lg text-[10px] uppercase font-black">Odustani</button><button onClick={rucniUpisOdsustva} className="px-4 py-2 bg-red-600 text-white rounded-lg text-[10px] uppercase font-black">Zavedi Izostanak</button></div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-2xl text-center"><p className="text-[9px] text-blue-500 font-black uppercase mb-1">Godišnji Odmor</p><p className="text-xl text-white font-black">{kvotaOstalo} <span className="text-[10px] text-blue-400">dana</span></p><p className="text-[8px] text-slate-500 uppercase mt-1">Iskoristio: R({kvotaRadnik}) P({kvotaFirma})</p></div>
                                        <div className="bg-red-900/10 border border-red-500/20 p-4 rounded-2xl text-center"><p className="text-[9px] text-red-500 font-black uppercase mb-1">Kašnjenja</p><p className="text-xl text-white font-black">{totalKasnjenje} <span className="text-[10px] text-red-400">min</span></p><p className="text-[8px] text-slate-500 uppercase mt-1">U {daniKasnjenja} dana</p></div>
                                        <div className="bg-orange-900/10 border border-orange-500/20 p-4 rounded-2xl text-center"><p className="text-[9px] text-orange-500 font-black uppercase mb-1">Bolovanje</p><p className="text-xl text-white font-black">{bolovanja} <span className="text-[10px] text-orange-400">dana ukupno</span></p></div>
                                        <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl text-center"><p className="text-[9px] text-slate-400 font-black uppercase mb-1">Neopravdani izo.</p><p className="text-xl text-white font-black">{neopravdani} <span className="text-[10px] text-slate-500">dana ukupno</span></p></div>
                                    </div>

                                    <div className="mt-8 border-t border-theme-border pt-6">
                                        <h4 className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-4">Dnevnik Skeniranja u ovom mjesecu:</h4>
                                        <div className="bg-theme-panel border border-theme-border rounded-xl overflow-hidden shadow-inner">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-black/40 text-slate-500 uppercase text-[9px]">
                                                    <tr><th className="p-4">Datum</th><th className="p-4">Dolazak</th><th className="p-4">Odlazak</th><th className="p-4 text-center">Obračunato</th><th className="p-4 text-right">Devijacije</th></tr>
                                                </thead>
                                                <tbody className="text-theme-text font-bold divide-y divide-theme-border/50">
                                                    {mjesecniZapis.length === 0 && <tr><td colSpan="5" className="p-6 text-center text-slate-600 italic">Nema prijava u ovom mjesecu.</td></tr>}
                                                    {mjesecniZapis.map(z => (
                                                        <tr key={z.id} className="hover:bg-slate-800/50 transition-colors">
                                                            <td className="p-4 uppercase">{new Date(z.datum).toLocaleDateString('bs-BA')}</td>
                                                            <td className="p-4 text-emerald-400">{z.vrijeme_dolaska ? new Date(z.vrijeme_dolaska).toLocaleTimeString('de-DE') : '-'}</td>
                                                            <td className="p-4 text-amber-400">{z.vrijeme_odlaska ? new Date(z.vrijeme_odlaska).toLocaleTimeString('de-DE') : '-'}</td>
                                                            <td className="p-4 text-center font-black text-white">{z.obracunato_sati} h</td>
                                                            <td className="p-4 text-right">
                                                                {z.kasnjenje_min > 0 && <span className="text-[9px] bg-red-900/40 text-red-400 px-2 py-1 rounded ml-1">Kasnio: {z.kasnjenje_min}m</span>}
                                                                {z.raniji_izlazak_min > 0 && <span className="text-[9px] bg-orange-900/40 text-orange-400 px-2 py-1 rounded ml-1">Ranije: {z.raniji_izlazak_min}m</span>}
                                                                {parseFloat(z.obracunato_sati) > 0 && z.prekovremeno_min === 0 && <button onClick={()=>odobriPrekovremeno(z.id)} className="text-[9px] bg-blue-900/30 text-blue-400 hover:bg-blue-600 hover:text-white px-2 py-1 rounded ml-1 transition-colors border border-blue-500/30">+ Prekovremeno</button>}
                                                                {z.prekovremeno_min > 0 && <span className="text-[9px] bg-emerald-900/40 text-emerald-400 px-2 py-1 rounded ml-1">Prekovremeno: {z.prekovremeno_min/60}h</span>}
                                                            </td>
                                                        </tr>
                                                    ))}
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
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-right max-w-5xl mx-auto">
                    <div className="lg:col-span-5 bg-theme-card p-6 rounded-[2rem] border border-theme-border shadow-2xl h-fit">
                        <h3 className="text-purple-400 font-black uppercase text-sm mb-6 border-b border-theme-border pb-4">➕ Praznik ili Subota</h3>
                        <div className="space-y-4">
                            <div><label className="text-[10px] text-slate-500 uppercase ml-2 block mb-1">Ručni unos datuma</label><input type="date" value={formaPraznik.datum} onChange={e=>setFormaPraznik({...formaPraznik, datum: e.target.value})} className="w-full p-4 bg-theme-panel border border-theme-border rounded-xl text-white outline-none focus:border-purple-500 cursor-pointer" /></div>
                            <div><label className="text-[10px] text-slate-500 uppercase ml-2 block mb-1">Naziv (Npr. Prvi Maj, Radna Subota...)</label><input type="text" value={formaPraznik.naziv} onChange={e=>setFormaPraznik({...formaPraznik, naziv: e.target.value})} className="w-full p-4 bg-theme-panel border border-theme-border rounded-xl text-white outline-none focus:border-purple-500 font-bold uppercase" placeholder="Naziv izuzetka" /></div>
                            <div className="bg-theme-panel p-4 rounded-xl border border-theme-border flex items-center justify-between">
                                <div><p className="text-[10px] text-slate-300 font-black uppercase">Da li se radi ovaj dan?</p><p className="text-[8px] text-slate-500 uppercase mt-0.5">Utiče na skidanje godišnjeg</p></div>
                                <select value={formaPraznik.je_radni_dan} onChange={e=>setFormaPraznik({...formaPraznik, je_radni_dan: e.target.value === 'true'})} className="p-2 bg-black text-xs font-black uppercase text-white rounded border border-slate-600 outline-none"><option value="false">NERADNI DAN (Praznik)</option><option value="true">RADNI DAN (Subota)</option></select>
                            </div>
                            <button onClick={dodajPraznik} className="w-full py-5 bg-purple-600 text-white font-black rounded-xl uppercase text-xs shadow-lg hover:bg-purple-500 transition-all">Dodaj u kalendar</button>
                        </div>

                        <div className="mt-8 border-t border-theme-border pt-6 space-y-3">
                            <h4 className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Automatsko generisanje subota za ovu godinu</h4>
                            <button onClick={() => generisiSubote('SVE')} className="w-full py-3 bg-theme-panel text-white text-[10px] font-black uppercase rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors">Sve subote su RADNE</button>
                            <button onClick={() => generisiSubote('PRVA')} className="w-full py-3 bg-theme-panel text-white text-[10px] font-black uppercase rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors">Samo prva subota u mjesecu je RADNA</button>
                            <button onClick={() => generisiSubote('DRUGA')} className="w-full py-3 bg-theme-panel text-white text-[10px] font-black uppercase rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors">Svaka druga subota je RADNA</button>
                        </div>
                    </div>

                    <div className="lg:col-span-7 bg-theme-card p-6 rounded-[2rem] border border-theme-border shadow-2xl">
                        <h3 className="text-slate-400 font-black uppercase text-xs mb-6 border-b border-theme-border pb-4">Izuzeci u bazi</h3>
                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                            {praznici.length === 0 && <p className="text-center text-slate-500 py-10 font-bold border border-dashed border-theme-border rounded-xl">Kalendar nema unesenih izuzetaka.</p>}
                            {praznici.map(p => (
                                <div key={p.datum} className="bg-theme-panel p-4 rounded-xl border border-theme-border flex justify-between items-center group shadow-sm">
                                    <div>
                                        <p className="text-white text-sm font-black uppercase">{new Date(p.datum).toLocaleDateString('bs-BA')} - {p.naziv}</p>
                                        <p className={`text-[9px] font-black uppercase mt-1 inline-block px-2 py-0.5 rounded ${p.je_radni_dan ? 'bg-amber-900/30 text-amber-400 border border-amber-500/30' : 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30'}`}>{p.je_radni_dan ? 'RADNI DAN' : 'NERADNI PRAZNIK'}</p>
                                    </div>
                                    <button onClick={() => obrisiPraznik(p.datum)} className="text-red-500 bg-red-900/20 w-8 h-8 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all font-black text-xs">✕</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}