"use client";
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import PametniDialog from '../components/PametniDialog';
import ScannerOverlay from '../components/ScannerOverlay';
import { useSaaS } from '../utils/useSaaS';
import { AlertTriangle, CheckCircle2, XCircle, Search, ArrowRight, ShieldAlert } from 'lucide-react';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function ReklamacijeModule({ user, header, setHeader, onExit }) {
    
    const saas = useSaaS('reklamacije_modul', { boja_kartice: '#1e293b', boja_slova: '#ffffff' });
    const imaPravoNadzora = user && (user.uloga === 'superadmin' || user.uloga === 'admin' || (user.dozvole || []).includes('Reklamacije i Povrati'));

    const [tab, setTab] = useState('unos'); // 'unos' ili 'nadzor'
    const [dialog, setDialog] = useState({ isOpen: false });
    const prikaziDialog = (opcije) => setDialog({ isOpen: true, confirmText: 'POTVRDI', cancelText: 'ZATVORI', ...opcije });
    const zatvoriDialog = () => setDialog({ isOpen: false });

    // STANJA ZA UNOS REKLAMACIJE
    const [scan, setScan] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const scanTimerRef = useRef(null);

    const [paket, setPaket] = useState(null);
    const [katalog, setKatalog] = useState([]);
    const [trenutniProizvod, setTrenutniProizvod] = useState(null);
    const [imeKupca, setImeKupca] = useState('Nepoznat Kupac');
    const [prikaznaJedinicaDimenzija, setPrikaznaJedinicaDimenzija] = useState('mm');

    const [kolicinaGreska, setKolicinaGreska] = useState(false);
    const [porukaGreske, setPorukaGreske] = useState('');

    const [prethodnoReklamiranoM3, setPrethodnoReklamiranoM3] = useState(0);
    const [stvarnoPreostaloM3, setStvarnoPreostaloM3] = useState(0);

    const [form, setForm] = useState({ 
        kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '',
        razlog: 'LOŠA KLASA', napomena: '', tip_reklamacije: 'POVRAT', nova_isporuka: true 
    });

    // STANJA ZA NADZOR
    const [reklamacijeLista, setReklamacijeLista] = useState([]);

    useEffect(() => {
        loadReklamacije();
        // LIVE SYNC za Reklamacije
        const channel = supabase.channel('reklamacije_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reklamacije' }, () => {
                loadReklamacije();
            }).subscribe();
        return () => supabase.removeChannel(channel);
    }, []);

    const loadReklamacije = async () => {
        const { data } = await supabase.from('reklamacije').select('*').order('created_at', { ascending: false });
        if (data) setReklamacijeLista(data);
        const { data: kat } = await supabase.from('katalog_proizvoda').select('*');
        if (kat) setKatalog(kat);
    };

    const handleScanInput = (val, isEnter = false) => {
        setScan(val);
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        if (!val) return;
        
        if (isEnter) {
            processScan(val);
        } else {
            scanTimerRef.current = setTimeout(() => processScan(val), 2000);
        }
    };

    const processScan = async (val) => {
        const id = val.toUpperCase().trim();
        if (id.length < 3) return;

        const { data } = await supabase.from('paketi').select('*').eq('paket_id', id).maybeSingle();
        if (data) {
            const paketZaReklamaciju = data;
            
            const { data: istorijaRek } = await supabase.from('reklamacije')
                .select('kolicina')
                .eq('paket_id', id)
                .in('status', ['CEKA_ODOBRENJE', 'ODOBRENO']);
            
            const ukupnoPotrosenoM3 = (istorijaRek || []).reduce((acc, r) => acc + parseFloat(r.kolicina || 0), 0);
            const ukupniKapacitetM3 = parseFloat(paketZaReklamaciju.kolicina_final || 0);
            const preostaliKapacitetM3 = Math.max(0, ukupniKapacitetM3 - ukupnoPotrosenoM3);

            const kat = katalog.find(k => k.naziv === paketZaReklamaciju.naziv_proizvoda || k.sifra === paketZaReklamaciju.naziv_proizvoda);
            setTrenutniProizvod(kat || null);

            let upotrijebiCm = false;
            if (kat) {
                const duzinaFilter = parseFloat(kat.duzina) || 0;
                if (duzinaFilter < 1000 && duzinaFilter > 0) {
                    upotrijebiCm = true;
                    setPrikaznaJedinicaDimenzija('cm');
                } else {
                    setPrikaznaJedinicaDimenzija('mm');
                }
            }

            if (preostaliKapacitetM3 <= 0.0001) {
                prikaziDialog({ tip: 'greska', naslov: 'Paket Potpuno Reklamiran', poruka: `Za paket ${id} je već iskorišten sav isporučeni volumen (${ukupniKapacitetM3} m³).\nNije moguće unijeti nove reklamacije!`, onCancel: zatvoriDialog });
                setScan('');
                return;
            }

            setPrethodnoReklamiranoM3(ukupnoPotrosenoM3);
            setStvarnoPreostaloM3(preostaliKapacitetM3);
            setPaket(paketZaReklamaciju);
            setKolicinaGreska(false);

            let nadjeniKupac = 'Nepoznat Kupac';
            if (paketZaReklamaciju.otpremnica_id) {
                const {data: otp} = await supabase.from('otpremnice').select('kupac_naziv').eq('id', paketZaReklamaciju.otpremnica_id).maybeSingle();
                if (otp) nadjeniKupac = otp.kupac_naziv;
            } 
            if (nadjeniKupac === 'Nepoznat Kupac' && paketZaReklamaciju.broj_veze) {
                const {data: rn} = await supabase.from('radni_nalozi').select('kupac_naziv').eq('id', paketZaReklamaciju.broj_veze).maybeSingle();
                if (rn) nadjeniKupac = rn.kupac_naziv;
            }
            setImeKupca(nadjeniKupac);

            setForm(f => ({ 
                ...f, 
                kolicina_unos: '',
                jm_unos: paketZaReklamaciju.jm || 'kom',
                kolicina_obracun: ''
            }));
            setScan('');
        } else {
            prikaziDialog({ tip: 'greska', naslov: 'Nepoznat Paket', poruka: `Paket ${id} ne postoji u bazi!`, onCancel: zatvoriDialog });
            setScan('');
        }
    };

    useEffect(() => {
        if (!form.kolicina_unos || !paket) {
            setForm(f => ({ ...f, kolicina_obracun: '' }));
            return;
        }
        const kol = parseFloat(form.kolicina_unos);
        let obracun = kol;
        
        if (form.jm_unos !== 'm3' && trenutniProizvod) {
            const v = parseFloat(trenutniProizvod.visina) || 1;
            const s = parseFloat(trenutniProizvod.sirina) || 1;
            const d = parseFloat(trenutniProizvod.duzina) || 1;
            
            if (form.jm_unos === 'kom') {
                if (prikaznaJedinicaDimenzija === 'cm') {
                    obracun = kol * (v / 100) * (s / 100) * (d / 100);
                } else {
                    obracun = kol * (v / 1000) * (s / 1000) * (d / 1000);
                }
            }
            else if (form.jm_unos === 'm2') {
                obracun = prikaznaJedinicaDimenzija === 'cm' ? kol * (s / 100) * (d / 100) : kol * (s / 1000) * (d / 1000);
            }
            else if (form.jm_unos === 'm1') {
                obracun = prikaznaJedinicaDimenzija === 'cm' ? kol * (d / 100) : kol * (d / 1000);
            }
        }
        
        const konacniM3 = parseFloat(obracun.toFixed(4));

        if (konacniM3 > stvarnoPreostaloM3) {
            setKolicinaGreska(true);
            setPorukaGreske(`Maksimalni preostali volumen paketa iznosi: ${stvarnoPreostaloM3.toFixed(3)} m³. Vaš unos daje: ${konacniM3.toFixed(3)} m³!`);
        } else {
            setKolicinaGreska(false);
            setPorukaGreske('');
        }
        
        setForm(f => ({ ...f, kolicina_obracun: konacniM3 }));
    }, [form.kolicina_unos, form.jm_unos, trenutniProizvod, paket, stvarnoPreostaloM3, prikaznaJedinicaDimenzija]);

    const podnesiReklamaciju = async () => {
        if (!paket) return;
        if (!form.kolicina_obracun || parseFloat(form.kolicina_obracun) <= 0 || parseFloat(form.kolicina_obracun) > stvarnoPreostaloM3) {
            return prikaziDialog({ tip: 'upozorenje', naslov: 'Količina', poruka: `Unesite ispravnu količinu (Maksimalno: ${stvarnoPreostaloM3.toFixed(3)} m³)`, onCancel: zatvoriDialog });
        }

        const payload = {
            broj_otpremnice: paket.broj_veze || 'NEPOZNATO',
            kupac_naziv: imeKupca, 
            paket_id: paket.paket_id,
            naziv_proizvoda: paket.naziv_proizvoda,
            kolicina: parseFloat(form.kolicina_obracun),
            jm: 'm3',
            razlog: form.razlog,
            napomena: `[Unos: ${form.kolicina_unos} ${form.jm_unos}] ${form.napomena}`,
            tip_reklamacije: form.tip_reklamacije,
            nova_isporuka: form.nova_isporuka,
            snimio_korisnik: user?.ime_prezime || 'Nepoznat'
        };

        const { error } = await supabase.from('reklamacije').insert([payload]);
        if (error) return prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: error.message, onCancel: zatvoriDialog });

        setPaket(null); setTrenutniProizvod(null);
        setForm({ kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', razlog: 'LOŠA KLASA', napomena: '', tip_reklamacije: 'POVRAT', nova_isporuka: true });
        prikaziDialog({ tip: 'uspjeh', naslov: 'Poslano na odobrenje', poruka: "Reklamacija je uspješno kreirana i čeka odobrenje Superadmina.", onCancel: zatvoriDialog });
    };

    const odobriReklamaciju = async (rek) => {
        prikaziDialog({
            tip: 'info', naslov: 'Odobravanje Reklamacije',
            poruka: `Odobravate reklamaciju za paket ${rek.paket_id}.\n\nDa li ste sigurni? Sistem će automatski korigovati zalihe i naloge po potrebi!`,
            confirmText: '✅ ODOBRI I PROCESUIRAJ', cancelText: '✕ ODUSTANI',
            onConfirm: async () => {
                zatvoriDialog();
                
                try {
                    if (rek.tip_reklamacije === 'POVRAT') {
                        const { data: orig } = await supabase.from('paketi').select('*').eq('paket_id', rek.paket_id).maybeSingle();
                        if (orig) {
                            const noviPaket = {
                                ...orig,
                                id: undefined, 
                                paket_id: `${rek.paket_id}-R`, 
                                kolicina_ulaz: rek.kolicina,
                                kolicina_final: rek.kolicina,
                                jm: 'm3',
                                masina: 'MAGACIN_REKLAMACIJA', 
                                oznake: ['REKLAMACIJA'],
                                closed_at: null, 
                                otpremnica_id: null,
                                broj_veze: 'POVRAT'
                            };
                            await supabase.from('paketi').insert([noviPaket]);
                        }
                    }

                    if (rek.nova_isporuka && rek.broj_otpremnice !== 'NEPOZNATO') {
                        const { data: rn } = await supabase.from('radni_nalozi').select('stavke_jsonb').eq('id', rek.broj_otpremnice).maybeSingle();
                        if (rn && rn.stavke_jsonb) {
                            const kat = katalog.find(k => k.naziv === rek.naziv_proizvoda || k.sifra === rek.naziv_proizvoda);
                            const novaStavka = {
                                id: `rek-${Date.now()}`,
                                sifra: kat ? kat.sifra : 'REK-ZAMJENA',
                                naziv: `${rek.naziv_proizvoda} (ZAMJENA REKLAMACIJE)`,
                                kolicina_unos: rek.kolicina,
                                jm_unos: 'm3',
                                kolicina_obracun: rek.kolicina,
                                jm_obracun: 'm3',
                                status: 'ZA_IZRADU',
                                napravljeno: 0
                            };
                            const noveStavke = [...rn.stavke_jsonb, novaStavka];
                            await supabase.from('radni_nalozi').update({ stavke_jsonb: noveStavke, status: 'U RADU' }).eq('id', rek.broj_otpremnice);
                        }
                    }

                    await supabase.from('reklamacije').update({ 
                        status: 'ODOBRENO', 
                        odobrio_korisnik: user?.ime_prezime || 'Admin' 
                    }).eq('id', rek.id);

                    prikaziDialog({ tip: 'uspjeh', naslov: 'Odobreno', poruka: "Reklamacija je uspješno obrađena! Zalihe i nalozi su ažurirani.", onCancel: zatvoriDialog });
                } catch (error) {
                    prikaziDialog({ tip: 'greska', naslov: 'Sistemska Greška', poruka: error.message, onCancel: zatvoriDialog });
                }
            },
            onCancel: zatvoriDialog
        });
    };

    const odbijReklamaciju = async (rek) => {
        if(window.confirm("Da li ste sigurni da želite ODBITI ovu reklamaciju?")) {
            await supabase.from('reklamacije').update({ 
                status: 'ODBIJENO', 
                odobrio_korisnik: user?.ime_prezime || 'Admin' 
            }).eq('id', rek.id);
        }
    };

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6 animate-in fade-in font-sans pb-24" style={{ color: saas.ui.boja_slova }}>
            <PametniDialog {...dialog} />
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} user={user} modulIme="reklamacije" saas={saas} hideMasina={true} />

            <div className="text-center mb-6">
                <h2 className="text-red-500 font-black tracking-widest uppercase text-xl md:text-2xl drop-shadow-md flex items-center justify-center gap-3">
                    <AlertTriangle /> MODUL REKLAMACIJE I POVRATI
                </h2>
            </div>

            <div className="flex bg-theme-panel p-1.5 rounded-2xl border border-theme-border shadow-inner mb-6 mx-auto max-w-xl">
                <button onClick={() => setTab('unos')} className={`flex-1 py-3 md:py-4 rounded-xl text-[10px] md:text-xs uppercase font-black transition-all flex items-center justify-center gap-2 ${tab === 'unos' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>📥 PRIJAVA REKLAMACIJE</button>
                <button onClick={() => setTab('nadzor')} className={`flex-1 py-3 md:py-4 rounded-xl text-[10px] md:text-xs uppercase font-black transition-all flex items-center justify-center gap-2 ${tab === 'nadzor' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>👑 NADZOR I ODOBRAVANJE</button>
            </div>

            {/* TAB: UNOS REKLAMACIJE */}
            {tab === 'unos' && (
                <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-left">
                    <div className="bg-theme-card p-6 md:p-8 rounded-[var(--radius-box)] border-2 border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.15)]" style={{ backgroundColor: saas.ui.boja_kartice }}>
                        
                        <div className="flex bg-theme-panel border-2 border-red-500/40 rounded-2xl overflow-hidden shadow-inner focus-within:border-red-500 transition-all h-20 mb-6">
                            <input value={scan} onChange={e => handleScanInput(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') handleScanInput(scan, true) }} className="flex-1 px-6 bg-transparent text-xl md:text-2xl text-center text-red-400 outline-none uppercase placeholder:text-slate-600 font-black tracking-widest" placeholder="SKENIRAJ ID PAKETA..." />
                            <button onClick={() => { setIsScanning(true); }} className="px-8 bg-red-600/20 text-red-500 font-black hover:bg-red-500 hover:text-white transition-colors text-2xl flex items-center justify-center shadow-lg border-l border-red-500/30"><Search /></button>
                        </div>

                        {paket && (
                            <div className="bg-black/40 p-6 rounded-2xl border border-red-500/30 shadow-inner mt-6 animate-in zoom-in-95">
                                <div className="flex justify-between items-start border-b border-theme-border pb-4 mb-6">
                                    <div><span className="text-[10px] text-slate-500 uppercase font-black tracking-widest block mb-1">Fokusirani Paket</span><h3 className="text-2xl text-white font-black drop-shadow-md">{paket.paket_id}</h3>
                                    <div className="mt-2"><span className="text-[10px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-lg">KUPAC: {imeKupca}</span></div></div>
                                    <div className="text-right bg-red-950/40 border border-red-500/40 p-3 rounded-xl">
                                        <span className="text-[9px] text-red-400 uppercase font-black tracking-widest block mb-1">Maksimalno preostalo</span>
                                        <h3 className="text-2xl text-red-400 font-black drop-shadow-md">{stvarnoPreostaloM3.toFixed(3)} <span className="text-xs">m³</span></h3>
                                        {prethodnoReklamiranoM3 > 0 && <span className="text-[8px] font-black uppercase text-pink-400 block mt-1">Već reklamirano: {prethodnoReklamiranoM3.toFixed(3)} m³</span>}
                                    </div>
                                </div>
                                <div className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-6">
                                    <span>{paket.naziv_proizvoda}</span> | <span className="text-amber-500">Radni Nalog: {paket.broj_veze || 'Nepoznat'}</span>
                                    {trenutniProizvod && <p className="text-emerald-400 font-black mt-2 text-xs md:text-sm bg-emerald-950/40 border border-emerald-500/20 px-3 py-1.5 rounded-lg w-fit">📏 DIMENZIJE: {trenutniProizvod.visina}x{trenutniProizvod.sirina}x{trenutniProizvod.duzina} {prikaznaJedinicaDimenzija}</p>}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div className="bg-theme-panel p-4 rounded-xl border border-theme-border shadow-inner flex flex-col justify-between">
                                        <label className="text-[10px] md:text-[10px] text-slate-400 uppercase tracking-widest block mb-2 font-black">1. Količina za reklamaciju (UNOS)</label>
                                        <div className="flex gap-2 w-full">
                                            <input type="number" value={form.kolicina_unos} onChange={e => setForm({...form, kolicina_unos: e.target.value})} className={`w-2/3 p-3 md:p-4 bg-black rounded-xl text-lg md:text-xl font-black text-center outline-none border-2 ${kolicinaGreska ? 'border-red-600 text-red-500 bg-red-950/20' : 'border-slate-700 text-white focus:border-red-400'}`} placeholder="0" />
                                            <select value={form.jm_unos} onChange={e => setForm({...form, jm_unos: e.target.value})} className="w-1/3 p-3 md:p-4 bg-black border border-slate-700 rounded-xl text-white font-black outline-none cursor-pointer uppercase text-xs md:text-sm">
                                                <option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="bg-theme-panel p-4 rounded-xl border border-emerald-500/30 shadow-inner relative overflow-hidden">
                                        <label className="text-[9px] md:text-[10px] text-emerald-500 uppercase tracking-widest block mb-2 font-black">2. Preračunato u Kubike</label>
                                        <div className="relative">
                                            <input type="number" value={form.kolicina_obracun} readOnly className={`w-full p-3 md:p-4 bg-emerald-900/10 border-2 rounded-xl text-center text-lg md:text-xl font-black outline-none cursor-not-allowed shadow-inner ${kolicinaGreska ? 'border-red-600 text-red-500' : 'border-emerald-500/30 text-emerald-400'}`} />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-xs">m³</span>
                                        </div>
                                    </div>
                                </div>
                                {kolicinaGreska && (
                                    <div className="bg-red-950/50 border border-red-500 p-4 rounded-xl flex items-center gap-3 animate-in shake duration-300 mb-6">
                                        <span className="text-xl">🛑</span>
                                        <p className="text-[10px] md:text-xs text-red-400 font-black uppercase leading-tight">{porukaGreske}</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-2 font-black">Tip Reklamacije</label>
                                        <select value={form.tip_reklamacije} onChange={e => setForm({...form, tip_reklamacije: e.target.value})} className="w-full p-4 h-[60px] bg-theme-panel border border-theme-border rounded-xl text-white font-black outline-none cursor-pointer">
                                            <option value="POVRAT">Fizički Povrat Robe (Vraća se u firmu)</option>
                                            <option value="OTPIS_BEZ_POVRATA">Rasknjižavanje bez povrata (Kupac zadržava/baca)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-2 font-black">Razlog (Kategorija)</label>
                                        <select value={form.razlog} onChange={e => setForm({...form, razlog: e.target.value})} className="w-full p-4 h-[60px] bg-theme-panel border border-theme-border rounded-xl text-white font-black outline-none cursor-pointer">
                                            <option value="LOŠA KLASA">Loša Klasa / Kvalitet</option>
                                            <option value="POGREŠNA DIMENZIJA">Pogrešna Dimenzija</option>
                                            <option value="OSTECENJE TRANSPORT">Oštećenje u transportu</option>
                                            <option value="OSTALO">Ostalo (Upiši u napomenu)</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-2 font-black">Detaljna napomena</label>
                                        <input type="text" value={form.napomena} onChange={e => setForm({...form, napomena: e.target.value})} className="w-full p-4 bg-theme-panel border border-theme-border rounded-xl text-white font-bold outline-none focus:border-red-400" placeholder="Opiši problem..." />
                                    </div>
                                </div>

                                <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl mb-6 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] text-blue-400 uppercase font-black tracking-widest">PONOVNA IZRADA (ZAMJENA)</p>
                                        <p className="text-xs text-slate-400 mt-1">Sistem će ovu količinu automatski dodati nazad na Radni nalog kako bi se proizvela nova roba za kupca.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={form.nova_isporuka} onChange={e => setForm({...form, nova_isporuka: e.target.checked})} className="sr-only peer" />
                                        <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>

                                <div className="flex gap-4">
                                    <button onClick={() => {setPaket(null); setScan('');}} className="flex-1 py-4 bg-theme-panel text-slate-400 font-black rounded-xl uppercase hover:bg-slate-800 transition-all border border-theme-border text-xs tracking-widest">✕ ODUSTANI</button>
                                    <button onClick={podnesiReklamaciju} disabled={kolicinaGreska} className={`flex-[2] py-4 text-white font-black rounded-xl uppercase tracking-widest transition-all text-xs border ${kolicinaGreska ? 'bg-slate-700 border-slate-600 opacity-40 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)] hover:scale-[1.02]'}`}>📤 PODNESI ZAHTJEV ZA ODOBRENJE</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: NADZOR I ODOBRAVANJE */}
            {tab === 'nadzor' && (
                <div className="animate-in slide-in-from-right space-y-6">
                    <div className="bg-theme-card p-6 rounded-[var(--radius-box)] border border-theme-border shadow-2xl" style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <h3 className="text-blue-400 font-black uppercase text-sm mb-6 border-b border-theme-border pb-4 flex items-center gap-2">👑 Lista Reklamacija (Kontrolni Panel)</h3>
                        
                        <div className="space-y-4">
                            {reklamacijeLista.length === 0 && <div className="text-center p-10 border border-dashed border-theme-border rounded-2xl text-slate-500 font-bold uppercase tracking-widest text-sm">Nema evidentiranih reklamacija.</div>}
                            {reklamacijeLista.map(rek => {
                                const kat = katalog.find(k => k.naziv === rek.naziv_proizvoda || k.sifra === rek.naziv_proizvoda);
                                let jedDim = 'mm';
                                if (kat && parseFloat(kat.duzina) < 1000 && parseFloat(kat.duzina) > 0) jedDim = 'cm';
                                const dimenzijeTekst = kat ? `${kat.visina}x${kat.sirina}x${kat.duzina} ${jedDim}` : 'Dimenzije nisu definisane';
                                const originalniUnosUtaknut = rek.napomena?.match(/\[Unos:\s*\d+\s*\w+\]/i)?.[0]?.replace(/[\[\]]/g, '') || 'N/A';

                                return (
                                <div key={rek.id} className={`p-5 rounded-2xl border flex flex-col md:flex-row gap-6 justify-between items-start md:items-center shadow-lg transition-all ${rek.status === 'CEKA_ODOBRENJE' ? 'bg-theme-panel border-amber-500/50 ring-1 ring-amber-500/20' : (rek.status === 'ODOBRENO' ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-red-900/10 border-red-500/30')}`}>
                                    
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`text-[10px] px-2 py-1 rounded font-black uppercase tracking-widest ${rek.status === 'CEKA_ODOBRENJE' ? 'bg-amber-500 text-black' : (rek.status === 'ODOBRENO' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400')}`}>
                                                {rek.status.replace('_', ' ')}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase">{new Date(rek.created_at).toLocaleString('bs-BA')} | Podnosilac: {rek.snimio_korisnik}</span>
                                        </div>
                                        <div className="text-xl font-black text-white flex items-center gap-3 drop-shadow-md">
                                            <span>Paket: {rek.paket_id}</span> <ArrowRight className="w-5 h-5 text-slate-500"/> <span className="text-red-400">{rek.kolicina} m³</span>
                                        </div>
                                        
                                        <div className="bg-black/30 p-3 rounded-lg border border-slate-700/50 my-3">
                                            <p className="text-[10px] text-amber-500 font-black uppercase mb-1">Kupac: <span className="text-white font-bold">{rek.kupac_naziv}</span></p>
                                            <p className="text-[11px] text-slate-300 font-bold uppercase tracking-widest leading-relaxed">{rek.naziv_proizvoda} <span className="text-blue-400 ml-2">(Nalog: {rek.broj_otpremnice})</span></p>
                                            
                                            <div className="pt-2 mt-2 border-t border-slate-700/40 flex flex-wrap gap-4 text-[10px]">
                                                <p className="text-emerald-400 font-mono font-black">📏 DIMENZIJE: {dimenzijeTekst}</p>
                                                <p className="text-blue-400 font-black">📦 IZVORNI UNOS: <span className="text-white bg-blue-950 px-2 py-0.5 rounded border border-blue-500/30 font-mono font-black">{originalniUnosUtaknut}</span></p>
                                            </div>
                                        </div>

                                        <div className="mt-3 flex gap-2 flex-wrap">
                                            <span className="text-[9px] bg-slate-800 border border-slate-600 px-2 py-1 rounded text-slate-300 font-black uppercase">TIP: {rek.tip_reklamacije.replace('_', ' ')}</span>
                                            <span className="text-[9px] bg-slate-800 border border-slate-600 px-2 py-1 rounded text-slate-300 font-black uppercase">RAZLOG: {rek.razlog}</span>
                                            {rek.nova_isporuka && <span className="text-[9px] bg-blue-900/40 border border-blue-500/50 px-2 py-1 rounded text-blue-400 font-black uppercase">ZAHTJEVA NOVU IZRADU</span>}
                                        </div>
                                        {rek.napomena && <p className="text-[10px] text-slate-400 mt-3 italic border-l-2 border-slate-600 pl-2 leading-relaxed">Napomena: "{rek.napomena.replace(/\[Unos:\s*\d+\s*\w+\]/i, '').trim()}"</p>}
                                    </div>

                                    {rek.status === 'CEKA_ODOBRENJE' && (
                                        <div className="flex gap-2 w-full md:w-auto shrink-0">
                                            <button onClick={() => odbijReklamaciju(rek)} className="flex-1 md:flex-none px-6 py-3 bg-theme-card border border-red-500/50 hover:bg-red-600 hover:text-white text-red-400 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm flex items-center justify-center gap-2"><XCircle className="w-4 h-4"/> Odbij</button>
                                            <button onClick={() => odobriReklamaciju(rek)} className="flex-[2] md:flex-none px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 border border-emerald-400"><CheckCircle2 className="w-4 h-4"/> ODOBRI I KNJIŽI</button>
                                        </div>
                                    )}

                                    {rek.status !== 'CEKA_ODOBRENJE' && (
                                        <div className="text-right w-full md:w-auto">
                                            <p className="text-[9px] text-slate-500 uppercase font-bold mb-1">Obradio / Odobrio:</p>
                                            <p className="text-sm font-black text-white bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">{rek.odobrio_korisnik || 'N/A'}</p>
                                        </div>
                                    )}

                                </div>
                            )})}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}