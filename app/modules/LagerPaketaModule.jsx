"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import MasterSearch from '../components/MasterSearch';
import PametniDialog from '../components/PametniDialog';
import ScannerOverlay from '../components/ScannerOverlay';
import { printDeklaracijaPaketa } from '../utils/printHelpers';
import { useSaaS } from '../utils/useSaaS';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function LagerPaketaModule({ onExit, user, header, setHeader }) {
    const saas = useSaaS('lager_modul', {
        boja_kartice: '#1e293b',
        boja_slova: '#ffffff',
        velicina_naslova: '16',
        boja_teksta: '#3b82f6'
    });

    const [glavniTab, setGlavniTab] = useState('paketi');
    const [subTabPaketi, setSubTabPaketi] = useState('NA STANJU');

    const [paketi, setPaketi] = useState([]);
    const [trupci, setTrupci] = useState([]);
    const [aktivniNalozi, setAktivniNalozi] = useState([]);
    const [katalog, setKatalog] = useState([]);
    const [rnDetalji, setRnDetalji] = useState(null);

    const [loading, setLoading] = useState(false);
    const [pretraga, setPretraga] = useState('');
    const [isScanning, setIsScanning] = useState(false);

    const [selektovaniPaket, setSelektovaniPaket] = useState(null);
    const [historija, setHistorija] = useState([]);
    const [izvedeniPaketi, setIzvedeniPaketi] = useState([]);
    const [isPrinting, setIsPrinting] = useState(false);

    const [fPaket, setFPaket] = useState({ rn: '', debljinaOd: '', debljinaDo: '', sirinaOd: '', sirinaDo: '', duzinaOd: '', duzinaDo: '' });

   // STATE ZA RUČNI (SLOBODNI) ULAZ
   const [rucniUlazForm, setRucniUlazForm] = useState({ naziv: '', debljina: '', sirina: '', duzina: '', kolicina: '', jm: 'kom', klasa: 'Standard' });
   const generisiIDPaketa = () => `RUČNO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

   const livePreracunRucniM3 = useMemo(() => {
       if(!rucniUlazForm.kolicina || isNaN(rucniUlazForm.kolicina)) return 0;
       const v = parseFloat(rucniUlazForm.debljina) || 1;
       const s = parseFloat(rucniUlazForm.sirina) || 1;
       const d = parseFloat(rucniUlazForm.duzina) || 1;
       const unosKol = parseFloat(rucniUlazForm.kolicina);
       
       let komada = unosKol;
       if (rucniUlazForm.jm === 'm3') komada = unosKol / ((v/100) * (s/100) * (d/100));
       else if (rucniUlazForm.jm === 'm2') komada = unosKol / ((s/100) * (d/100));
       else if (rucniUlazForm.jm === 'm1') komada = unosKol / (d/100);
       
       return (komada * (v/100) * (s/100) * (d/100)).toFixed(3);
   }, [rucniUlazForm]);
    const [dialog, setDialog] = useState({ isOpen: false });
    const prikaziDialog = (opcije) => setDialog({ isOpen: true, confirmText: 'POTVRDI', cancelText: 'ZATVORI', ...opcije });
    const zatvoriDialog = () => setDialog({ isOpen: false });

    const normalizujDimenzije = (p) => {
        let d = parseFloat(p.debljina) || 0;
        let s = parseFloat(p.sirina) || 0;
        let l = parseFloat(p.duzina) || 0;

        const katArtikal = katalog.find(k => k.sifra === p.naziv_proizvoda || k.naziv === p.naziv_proizvoda);
        const jedinica = (katArtikal?.jm_unos || p.jm || 'kom').toLowerCase();

        if (jedinica === 'cm') { d = d * 10; s = s * 10; l = l * 10; }
        else if (jedinica === 'm') { d = d * 1000; s = s * 1000; l = l * 1000; }

        return { debljina: d, sirina: s, duzina: l };
    };

    useEffect(() => {
        loadData();
        const channel = supabase.channel(`lager_realtime_channel_${Math.random()}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'paketi' }, () => loadData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'trupci' }, () => loadData())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [glavniTab, subTabPaketi]);

    const loadData = async () => {
        if (paketi.length === 0 && trupci.length === 0) setLoading(true);
        supabase.from('radni_nalozi').select('id, kupac_naziv, status, stavke_jsonb').order('datum', {ascending: false}).then(({data}) => setAktivniNalozi(data || []));
        supabase.from('katalog_proizvoda').select('*').then(({data}) => setKatalog(data || []));

        if (glavniTab === 'paketi' || glavniTab === 'rucni_ulaz') {
            const { data } = await supabase.from('paketi').select('*').order('created_at', { ascending: false });
            if (data) {
                let filtriraniPoTabu = [];
                if (subTabPaketi === 'U PROIZVODNJI') filtriraniPoTabu = data.filter(p => p.closed_at === null);
                else if (subTabPaketi === 'NA STANJU') filtriraniPoTabu = data.filter(p => p.closed_at !== null && p.otpremnica_id === null);
                else if (subTabPaketi === 'OTPREMLJENO') filtriraniPoTabu = data.filter(p => p.otpremnica_id !== null);

                const grupisaniPaketi = [];
                const iskoristeniIDovi = new Set();
                for (let p of filtriraniPoTabu) {
                    if (!iskoristeniIDovi.has(p.id)) { iskoristeniIDovi.add(p.id); grupisaniPaketi.push(p); }
                }
                setPaketi(grupisaniPaketi);
            }
        } else {
            const { data, error } = await supabase.from('trupci').select('*').eq('zakljucen_prijem', true).eq('status', 'na_lageru').order('created_at', { ascending: false });
            if (error) console.error("Greška pri učitavanju lagera trupaca:", error);
            setTrupci(data || []);
        }
        setLoading(false);
    };

    const ucitajRnDetalje = async (rnId) => {
        if (!rnId) { setRnDetalji(null); return; }
        const nalog = aktivniNalozi.find(n => n.id === rnId.toUpperCase());
        if (!nalog) { setRnDetalji(null); return; }

        const { data: rnPaketi } = await supabase.from('paketi').select('*').eq('broj_veze', nalog.id);
        const realizacija = (nalog.stavke_jsonb || []).map(stavka => {
            const proizvedeniPaketi = (rnPaketi || []).filter(p => p.naziv_proizvoda === stavka.naziv);
            const napravljenoKom = proizvedeniPaketi.reduce((s, p) => s + parseFloat(p.kolicina_ulaz || 0), 0);
            const napravljenoM3 = proizvedeniPaketi.reduce((s, p) => s + parseFloat(p.kolicina_final || 0), 0);
            return {
                ...stavka,
                napravljenoKom,
                napravljenoM3,
                faliKom: parseFloat(stavka.kolicina_unos) - napravljenoKom,
                faliM3: parseFloat(stavka.kolicina_obracun) - napravljenoM3
            };
        });
        setRnDetalji({ kupac: nalog.kupac_naziv, status: nalog.status, stavke: realizacija });
    };

    useEffect(() => { ucitajRnDetalje(fPaket.rn); }, [fPaket.rn, aktivniNalozi]);

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: user?.ime_prezime || 'Sistem', akcija, detalji }]);
    };

    const spasiSlobodniUlaz = async () => {
        if(!rucniUlazForm.naziv || !rucniUlazForm.kolicina) return prikaziDialog({ tip: 'upozorenje', naslov: 'Fali Podataka', poruka: "Odaberite proizvod i upišite količinu!", onCancel: zatvoriDialog });
        
        const v = parseFloat(rucniUlazForm.debljina) || 1;
        const s = parseFloat(rucniUlazForm.sirina) || 1;
        const d = parseFloat(rucniUlazForm.duzina) || 1;
        const unosKol = parseFloat(rucniUlazForm.kolicina) || 0;

        let komada = unosKol;
        if (rucniUlazForm.jm === 'm3') komada = unosKol / ((v/100) * (s/100) * (d/100));
        else if (rucniUlazForm.jm === 'm2') komada = unosKol / ((s/100) * (d/100));
        else if (rucniUlazForm.jm === 'm1') komada = unosKol / (d/100);
        
        const izracunatM3 = parseFloat((komada * (v/100) * (s/100) * (d/100)).toFixed(3));
        const noviIdPaketa = generisiIDPaketa();

        const payload = {
            paket_id: noviIdPaketa,
            naziv_proizvoda: rucniUlazForm.naziv,
            debljina: v, sirina: s, duzina: d,
            kolicina_ulaz: unosKol, jm: rucniUlazForm.jm,
            kolicina_final: izracunatM3,
            broj_veze: 'SLOBODNA_ROBA',
            mjesto: header.mjesto || 'Lager',
            masina: 'Ručni Unos',
            snimio_korisnik: user?.ime_prezime || 'Nepoznat',
            datum_yyyy_mm: new Date().toISOString().split('T')[0],
            vrijeme_tekst: new Date().toLocaleTimeString('de-DE'),
            closed_at: new Date().toISOString(), // Paket je automatski zatvoren i spreman za prodaju
            oznake: [rucniUlazForm.klasa]
        };

        const { error } = await supabase.from('paketi').insert([payload]);
        if (error) {
            return prikaziDialog({ tip: 'greska', naslov: 'Greška baze', poruka: error.message, onCancel: zatvoriDialog });
        }

        await zapisiU_Log('SLOBODNI_ULAZ_LAGER', `Ubačen paket: ${noviIdPaketa} (${izracunatM3} m³). Proizvod: ${rucniUlazForm.naziv}`);
        
        setRucniUlazForm({ naziv: '', debljina: '', sirina: '', duzina: '', kolicina: '', klasa: 'Standard' });
        loadData();
        
        prikaziDialog({
            tip: 'uspjeh',
            naslov: 'Stanje Ažurirano',
            poruka: `Paket ${noviIdPaketa} je uspješno smješten na lager.\nŽelite li isprintati deklaraciju za ovaj paket?`,
            confirmText: '🖨️ DA, ŠTAMPAJ',
            cancelText: 'ZATVORI',
            onConfirm: () => { printDeklaracijaPaketa(noviIdPaketa, [payload], 'SLOBODNA_ROBA'); zatvoriDialog(); },
            onCancel: zatvoriDialog
        });
    };

    const ucitajHistoriju = async (paket) => {
        setSelektovaniPaket(paket);
        setHistorija('load'); setIzvedeniPaketi([]);
        const sid = paket.paket_id;

        const { data: auditData } = await supabase.from('audit_log').select('*').eq('zapis_id', sid).order('vrijeme', { ascending: true });
        let dogadjaji = auditData ? auditData.map(a => {
            let detaljanOpis = "Izmjena unutrašnjih parametara paketa.";
            if (a.akcija === 'DODAVANJE') detaljanOpis = `Kreiran paket na mašini: ${paket.masina || 'N/A'}. Količina: ${paket.kolicina_ulaz} kom (${paket.kolicina_final} m³).`;
            if (a.stari_podaci && a.novi_podaci) {
                try {
                    const s = typeof a.stari_podaci === 'string' ? JSON.parse(a.stari_podaci) : a.stari_podaci;
                    const n = typeof a.novi_podaci === 'string' ? JSON.parse(a.novi_podaci) : a.novi_podaci;
                    const promjene = [];
                    Object.keys(n).forEach(k => {
                        if (JSON.stringify(s[k]) !== JSON.stringify(n[k]) && !['created_at', 'vrijeme_tekst', 'id'].includes(k)) {
                            promjene.push(`${k.toUpperCase()}: ${s[k] || 'prazno'} ➔ ${n[k]}`);
                        }
                    });
                    if (promjene.length > 0) detaljanOpis = promjene.join(' | ');
                } catch(e) {}
            }
            return { vrijeme: a.vrijeme, naslov: a.akcija, opis: detaljanOpis, korisnik: a.korisnik || 'Sistem' };
        }) : [];

        const { data: forwardData } = await supabase.from('paketi').select('paket_id, naziv_proizvoda, kolicina_final, masina').ilike('ai_sirovina_ids', `%${sid}%`);
        if (forwardData && forwardData.length > 0) {
            setIzvedeniPaketi([...new Map(forwardData.map(item => [item.paket_id, item])).values()]);
        }

        const { data: sveStavkePaketa } = await supabase.from('paketi').select('ulaz_trupci_ids, ai_sirovina_ids').eq('paket_id', sid);
        if (sveStavkePaketa && sveStavkePaketa.length > 0) {
            let sviTrupciId = [];
            sveStavkePaketa.forEach(red => { if (red.ulaz_trupci_ids && Array.isArray(red.ulaz_trupci_ids)) sviTrupciId = [...sviTrupciId, ...red.ulaz_trupci_ids]; });
            const unikatniTrupci = [...new Set(sviTrupciId)]; 

            if (unikatniTrupci.length > 0) {
                const { data: trupciPodaci } = await supabase.from('trupci').select('*').in('id', unikatniTrupci);
                if (trupciPodaci && trupciPodaci.length > 0) {
                    const totalV = trupciPodaci.reduce((s, t) => s + parseFloat(t.zapremina || 0), 0);
                    const sumarijeMap = {};
                    trupciPodaci.forEach(t => { const s = t.sumarija || 'Nepoznato'; sumarijeMap[s] = (sumarijeMap[s] || 0) + parseFloat(t.zapremina || 0); });
                    const infoText = Object.keys(sumarijeMap).map(k => `${k}: ${((sumarijeMap[k]/totalV)*100).toFixed(1)}%`).join(' | ');
                    dogadjaji.push({ vrijeme: paket.created_at, naslov: 'SASTAV SIROVINE (TRUPCI)', opis: `Povezano sa ${unikatniTrupci.length} trupaca iz šume.\nUdio šumarija:\n${infoText}`, korisnik: 'Sistem' });
                }
            }
        }
        setHistorija(dogadjaji.length > 0 ? dogadjaji.sort((a,b) => new Date(a.vrijeme) - new Date(b.vrijeme)) : 'none');
    };

    const isprintajAutomatski = async (paket) => {
        setIsPrinting(true);
        let vezniDokument = paket.broj_veze; 
        if (vezniDokument && vezniDokument.startsWith('RN-')) {
            const nalog = aktivniNalozi.find(n => n.id === vezniDokument);
            if (nalog && nalog.broj_ponude) vezniDokument = nalog.broj_ponude;
        }
        printDeklaracijaPaketa(paket.paket_id, [paket], vezniDokument || '');
        setIsPrinting(false);
    };

    const filtriraniPaketi = useMemo(() => {
        return paketi.filter(p => {
            const norm = normalizujDimenzije(p);
            const matchSearch = String(p.paket_id || '').toUpperCase().includes(pretraga.toUpperCase()) || String(p.naziv_proizvoda || '').toUpperCase().includes(pretraga.toUpperCase());
            const matchRN = fPaket.rn === '' || (p.broj_veze && p.broj_veze.includes(fPaket.rn.toUpperCase()));
            const matchDeb = (fPaket.debljinaOd === '' || norm.debljina >= parseFloat(fPaket.debljinaOd)) && (fPaket.debljinaDo === '' || norm.debljina <= parseFloat(fPaket.debljinaDo));
            const matchSir = (fPaket.sirinaOd === '' || norm.sirina >= parseFloat(fPaket.sirinaOd)) && (fPaket.sirinaDo === '' || norm.sirina <= parseFloat(fPaket.sirinaDo));
            const matchDuz = (fPaket.duzinaOd === '' || norm.duzina >= parseFloat(fPaket.duzinaOd)) && (fPaket.duzinaDo === '' || norm.duzina <= parseFloat(fPaket.duzinaDo));
            return matchSearch && matchRN && matchDeb && matchSir && matchDuz;
        });
    }, [paketi, pretraga, fPaket, katalog]);

    const filtriraniTrupci = useMemo(() => {
        return trupci.filter(t => {
            const searchStr = pretraga.toUpperCase();
            return String(t.id || '').toUpperCase().includes(searchStr) || 
                   String(t.sumarija || '').toUpperCase().includes(searchStr) ||
                   String(t.otpremnica_broj || '').toUpperCase().includes(searchStr) ||
                   String(t.vrsta || '').toUpperCase().includes(searchStr);
        });
    }, [trupci, pretraga]);

    const stats = useMemo(() => {
        let count = 0; let m3 = 0;
        if (glavniTab === 'paketi') {
            count = filtriraniPaketi.length;
            m3 = filtriraniPaketi.reduce((s, p) => s + parseFloat(p.kolicina_final || 0), 0);
        } else if (glavniTab === 'trupci') {
            count = filtriraniTrupci.length;
            m3 = filtriraniTrupci.reduce((s, t) => s + parseFloat(t.zapremina || 0), 0);
        }
        return { count, m3: m3.toFixed(3) };
    }, [filtriraniPaketi, filtriraniTrupci, glavniTab]);

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6 font-bold animate-in fade-in" style={{ color: saas.ui.boja_slova }}>
            <PametniDialog {...dialog} />
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-blue-500" user={user} modulIme="lager" saas={saas} hideMasina={true} />

            <div className="flex flex-col sm:flex-row bg-theme-panel p-1.5 rounded-2xl border border-theme-border shadow-inner gap-1 overflow-x-auto custom-scrollbar">
                <button onClick={() => setGlavniTab('paketi')} className={`flex-1 py-4 px-4 rounded-xl text-xs uppercase font-black transition-all whitespace-nowrap flex items-center justify-center gap-2 ${glavniTab === 'paketi' ? 'bg-theme-accent text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-white'}`}>📦 Lager Gotovih Paketa</button>
                <button onClick={() => setGlavniTab('rucni_ulaz')} className={`flex-1 py-4 px-4 rounded-xl text-xs uppercase font-black transition-all whitespace-nowrap flex items-center justify-center gap-2 ${glavniTab === 'rucni_ulaz' ? 'bg-amber-600 text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-white'}`}>➕ Slobodni Ulaz</button>
                <button onClick={() => setGlavniTab('trupci')} className={`flex-1 py-4 px-4 rounded-xl text-xs uppercase font-black transition-all whitespace-nowrap flex items-center justify-center gap-2 ${glavniTab === 'trupci' ? 'bg-emerald-600 text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-white'}`}>🪵 Lager Trupaca na Placu</button>
            </div>

            {glavniTab === 'rucni_ulaz' && (
                <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-8 rounded-[2rem] border-2 border-amber-500/50 shadow-2xl space-y-6 animate-in slide-in-from-top-4 max-w-4xl mx-auto" style={{ backgroundColor: saas.ui.boja_kartice }}>
                    <div className="flex items-center gap-3 border-b border-theme-border pb-4 mb-4">
                        <span className="text-3xl">📥</span>
                        <div>
                            <h3 className="text-amber-500 font-black uppercase tracking-widest text-lg">Zaduženje Lagera (Slobodna Roba)</h3>
                            <p className="text-[10px] text-slate-400 mt-1 uppercase">Ovi paketi nemaju vezu sa Radnim Nalogom. Odmah će biti dostupni za prodaju.</p>
                        </div>
                    </div>
                    
                    <div className="relative overflow-visible z-50">
                        <label className="text-[9px] text-slate-400 uppercase font-black tracking-widest ml-1 mb-2 block">Pronađi Artikal iz Kataloga:</label>
                        <MasterSearch 
                            data={katalog} 
                            poljaZaPretragu={['sifra', 'naziv']} 
                            value={rucniUlazForm.naziv}
                            onSelect={(k) => setRucniUlazForm({...rucniUlazForm, naziv: k.naziv, debljina: k.visina, sirina: k.sirina, duzina: k.duzina})} 
                            placeholder="Pretraži po šifri ili nazivu..."
                            renderItem={(k) => (
                                <div>
                                    <div className="text-theme-text text-xs font-black">{k.visina}x{k.sirina}x{k.duzina} | {k.naziv}</div>
                                    <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold text-amber-400">Kat: {k.kategorija} | Baza: {k.default_jedinica}</div>
                                </div>
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3 relative z-10">
                        <div className="bg-theme-panel p-3 rounded-xl border border-theme-border shadow-inner text-center">
                            <label className="text-[9px] text-slate-400 uppercase font-black block mb-2">Debljina (cm)</label>
                            <input type="number" value={rucniUlazForm.debljina} onChange={e=>setRucniUlazForm({...rucniUlazForm, debljina:e.target.value})} className="w-full bg-transparent text-theme-text text-xl font-black text-center outline-none" placeholder="0" />
                        </div>
                        <div className="bg-theme-panel p-3 rounded-xl border border-theme-border shadow-inner text-center">
                            <label className="text-[9px] text-slate-400 uppercase font-black block mb-2">Širina (cm)</label>
                            <input type="number" value={rucniUlazForm.sirina} onChange={e=>setRucniUlazForm({...rucniUlazForm, sirina:e.target.value})} className="w-full bg-transparent text-theme-text text-xl font-black text-center outline-none" placeholder="0" />
                        </div>
                        <div className="bg-theme-panel p-3 rounded-xl border border-theme-border shadow-inner text-center">
                            <label className="text-[9px] text-slate-400 uppercase font-black block mb-2">Dužina (cm)</label>
                            <input type="number" value={rucniUlazForm.duzina} onChange={e=>setRucniUlazForm({...form, duzina:e.target.value})} className="w-full bg-transparent text-theme-text text-xl font-black text-center outline-none" placeholder="0" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
    <div className="md:col-span-2 bg-amber-900/10 p-4 rounded-xl border border-amber-500/30 text-center flex flex-col justify-center">
        <label className="text-[9px] text-amber-500 uppercase font-black block mb-2">Količina</label>
        <input type="number" value={rucniUlazForm.kolicina} onChange={e=>setRucniUlazForm({...rucniUlazForm, kolicina:e.target.value})} className="w-full bg-transparent text-amber-400 text-3xl font-black text-center outline-none" placeholder="0" />
    </div>
    <div className="md:col-span-1 bg-theme-panel p-4 rounded-xl border border-theme-border text-center flex flex-col justify-center shadow-inner">
        <label className="text-[9px] text-slate-400 uppercase font-black block mb-2">Jedinica</label>
        <select value={rucniUlazForm.jm} onChange={e=>setRucniUlazForm({...rucniUlazForm, jm:e.target.value})} className="w-full py-1 bg-transparent text-theme-text font-black outline-none text-center uppercase cursor-pointer text-xl">
            <option value="kom">kom</option>
            <option value="m3">m³</option>
            <option value="m2">m²</option>
            <option value="m1">m1</option>
        </select>
    </div>
    <div className="md:col-span-1 bg-theme-panel p-4 rounded-xl border border-theme-border text-center flex flex-col justify-center shadow-inner">
        <label className="text-[9px] text-slate-400 uppercase font-black block mb-2">Klasa</label>
        <select value={rucniUlazForm.klasa} onChange={e=>setRucniUlazForm({...rucniUlazForm, klasa:e.target.value})} className="w-full py-1 bg-transparent text-theme-text font-black outline-none text-center uppercase cursor-pointer text-xl">
            <option value="I Klasa">I Klasa</option>
            <option value="II Klasa">II Klasa</option>
            <option value="III Klasa">III Klasa</option>
            <option value="Standard">Standard</option>
        </select>
    </div>
</div>

                    {rucniUlazForm.kolicina && (
                        <div className="text-[10px] text-emerald-400 bg-emerald-900/20 p-2 rounded-lg border border-emerald-500/20 text-center uppercase animate-in zoom-in-95 mt-2 relative z-10">
                            Automatski preračunato: <span className="text-theme-text text-sm ml-1 font-black">{livePreracunRucniM3} m³</span>
                        </div>
                    )}

                    <button onClick={spasiSlobodniUlaz} className="w-full bg-amber-600 hover:bg-amber-500 text-theme-text font-black px-6 py-5 rounded-xl uppercase text-sm shadow-xl transition-all border border-amber-400 tracking-widest relative z-10">
                        ✅ Snimi paket na Lager
                    </button>
                </div>
            )}

            {(glavniTab === 'paketi' || glavniTab === 'trupci') && (
                <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-theme-border shadow-2xl space-y-5 relative z-40" style={{ backgroundColor: saas.ui.boja_kartice }}>
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <input value={pretraga} onChange={e => setPretraga(e.target.value.toUpperCase())} placeholder={glavniTab === 'paketi' ? "Brza pretraga po ID-u ili Nazivu..." : "Pretraga po ID-u, Šumariji, Otpremnici, Vrsti..."} className="w-full p-4 bg-theme-panel border border-theme-border rounded-2xl text-theme-text outline-none focus:border-blue-500 font-black uppercase shadow-inner" />
                            <button onClick={() => setIsScanning(true)} className="absolute right-2 top-2 bottom-2 px-4 bg-theme-accent rounded-xl text-white font-bold hover:opacity-80 transition-all shadow-lg text-xl">📷</button>
                        </div>
                        {glavniTab === 'paketi' && (
                            <div className="flex bg-theme-card p-1 rounded-2xl border border-theme-border shrink-0 overflow-x-auto custom-scrollbar">
                                {['U PROIZVODNJI', 'NA STANJU', 'OTPREMLJENO'].map(t => (
                                    <button key={t} onClick={() => setSubTabPaketi(t)} className={`px-4 py-2 shrink-0 rounded-xl text-[9px] font-black uppercase transition-all ${subTabPaketi === t ? 'bg-theme-accent text-white shadow-md' : 'text-slate-500 hover:text-theme-text'}`}>{t}</button>
                                ))}
                            </div>
                        )}
                    </div>

                    {glavniTab === 'paketi' && (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-4 border-t border-theme-border flex-wrap">
                            <div className="col-span-2 md:col-span-1">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 mb-1 block">Radni Nalog</label>
                                <div className="h-[45px]"><MasterSearch data={aktivniNalozi} poljaZaPretragu={['id', 'kupac_naziv']} value={fPaket.rn} onSelect={n => setFPaket({...fPaket, rn: n.id})} placeholder="Odaberi RN..." /></div>
                            </div>
                            <div><label className="text-[8px] text-slate-500 uppercase ml-2 mb-1 block">Debljina (mm od-do)</label><div className="flex gap-1"><input type="number" value={fPaket.debljinaOd} onChange={e=>setFPaket({...fPaket, debljinaOd: e.target.value})} placeholder="Min" className="w-1/2 p-3 bg-theme-card border border-theme-border rounded-xl text-xs text-center text-white" /><input type="number" value={fPaket.debljinaDo} onChange={e=>setFPaket({...fPaket, debljinaDo: e.target.value})} placeholder="Max" className="w-1/2 p-3 bg-theme-card border border-theme-border rounded-xl text-xs text-center text-white" /></div></div>
                            <div><label className="text-[8px] text-slate-500 uppercase ml-2 mb-1 block">Širina (mm od-do)</label><div className="flex gap-1"><input type="number" value={fPaket.sirinaOd} onChange={e=>setFPaket({...fPaket, sirinaOd: e.target.value})} placeholder="Min" className="w-1/2 p-3 bg-theme-card border border-theme-border rounded-xl text-xs text-center text-white" /><input type="number" value={fPaket.sirinaDo} onChange={e=>setFPaket({...fPaket, sirinaDo: e.target.value})} placeholder="Max" className="w-1/2 p-3 bg-theme-card border border-theme-border rounded-xl text-xs text-center text-white" /></div></div>
                            <div><label className="text-[8px] text-slate-500 uppercase ml-2 mb-1 block">Dužina (mm od-do)</label><div className="flex gap-1"><input type="number" value={fPaket.duzinaOd} onChange={e=>setFPaket({...fPaket, duzinaOd: e.target.value})} placeholder="Min" className="w-1/2 p-3 bg-theme-card border border-theme-border rounded-xl text-xs text-center text-white" /><input type="number" value={fPaket.duzinaDo} onChange={e=>setFPaket({...fPaket, duzinaDo: e.target.value})} placeholder="Max" className="w-1/2 p-3 bg-theme-card border border-theme-border rounded-xl text-xs text-center text-white" /></div></div>
                            <div className="flex flex-col justify-end"><button onClick={() => { setPretraga(''); setFPaket({ rn: '', debljinaOd: '', debljinaDo: '', sirinaOd: '', sirinaDo: '', duzinaOd: '', duzinaDo: '' }); }} className="w-full p-3 bg-theme-panel text-slate-400 rounded-xl text-[9px] uppercase font-black hover:bg-red-900/30 hover:text-red-400 border border-theme-border">Poništi filtere ✕</button></div>
                        </div>
                    )}
                </div>
            )}

            {glavniTab === 'paketi' && fPaket.rn && rnDetalji && (
                <div className="bg-purple-900/20 border-2 border-purple-500/50 p-6 rounded-box shadow-2xl animate-in zoom-in-95 relative z-30">
                    <div className="flex justify-between items-start mb-4 border-b border-purple-500/30 pb-3">
                        <div>
                            <h3 className="text-theme-accent font-black uppercase text-sm tracking-widest">Pregled realizacije naloga: {fPaket.rn}</h3>
                            <p className="text-theme-text text-xs mt-1">Kupac: <span className="font-bold">{rnDetalji.kupac}</span></p>
                        </div>
                        <span className={`text-[10px] px-3 py-1 rounded font-black uppercase ${rnDetalji.status === 'ZAVRŠENO' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-purple-900/40 text-theme-accent'}`}>{rnDetalji.status}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {rnDetalji.stavke.map((st, i) => (
                            <div key={i} className="bg-theme-card p-4 rounded-2xl border border-theme-border shadow-md">
                                <p className="text-theme-text text-xs font-black mb-2">{st.sifra} - {st.naziv}</p>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px]"><span className="text-slate-400">Naručeno:</span><span className="text-theme-text font-bold">{st.kolicina_obracun} m³</span></div>
                                    <div className="flex justify-between text-[10px]"><span className="text-slate-400">Proizvedeno na lageru:</span><span className="text-emerald-400 font-bold">{st.napravljenoM3.toFixed(3)} m³</span></div>
                                    <div className="flex justify-between text-[10px] pt-1 border-t border-theme-border mt-1"><span className="text-slate-400 font-bold">Preostalo za izradu:</span><span className={st.faliM3 > 0 ? "text-amber-400 font-black" : "text-emerald-500 font-black"}>{st.faliM3 > 0 ? `${st.faliM3.toFixed(3)} m³ (${st.faliKom} ${st.jm_unos || 'kom'})` : 'ZAVRŠENO ✅'}</span></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {(glavniTab === 'paketi' || glavniTab === 'trupci') && (
                <>
                    <div className="flex justify-between items-center bg-theme-card p-4 rounded-2xl border border-theme-border" style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <p className="text-slate-500 text-xs uppercase">Prikazano: <span className="text-white font-black ml-1">{stats.count}</span></p>
                        <p className="text-emerald-500 text-sm font-black uppercase">Ukupna zapremina: <span className="text-2xl ml-2 text-emerald-400">{stats.m3} m³</span></p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {loading ? (
                            <div className="col-span-full text-center py-20 animate-pulse text-theme-accent font-black tracking-widest uppercase">Učitavam lager...</div>
                        ) : (glavniTab === 'paketi' ? filtriraniPaketi : filtriraniTrupci).map(item => {
                            const norm = normalizujDimenzije(item);
                            return (
                                <div key={item.id} onClick={() => { if(glavniTab==='paketi') ucitajHistoriju(item); }} className="p-5 rounded-box border border-theme-border bg-[#111827] hover:border-blue-500 hover:-translate-y-1 cursor-pointer transition-all shadow-xl group relative overflow-hidden">
                                    {glavniTab === 'paketi' ? (
                                        <>
                                            {item.closed_at && <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[8px] px-3 py-1 font-black rounded-bl-xl uppercase shadow-md z-10">ZAVRŠEN</div>}
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex-1 pr-2">
                                                    <p className="text-theme-accent font-black text-lg font-mono">{item.paket_id}</p>
                                                    <p className="text-white text-sm font-bold mt-1 uppercase leading-tight">{item.naziv_proizvoda}</p>
                                                    <p className="text-amber-400 font-black text-xs uppercase mt-1 tracking-widest font-mono">{norm.debljina}x{norm.sirina}x{norm.duzina} <span className="text-[9px] lowercase text-slate-500">mm</span></p>
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {item.broj_veze === 'SLOBODNA_ROBA' ? (
                                                            <span className="text-[9px] bg-amber-900/30 text-amber-400 px-2 py-0.5 rounded font-black border border-amber-500/30">📦 SLOBODNI ULAZ</span>
                                                        ) : item.broj_veze ? (
                                                            <span className="text-[9px] bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded font-black border border-blue-500/20">RN: {item.broj_veze}</span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                <div className="text-right flex flex-col items-end shrink-0">
                                                    <div className="bg-emerald-900/20 border border-emerald-500/30 px-3 py-2 rounded-xl text-right mb-1">
                                                        <p className="text-emerald-400 font-black text-xl font-mono leading-none">{item.kolicina_final} <span className="text-[10px]">m³</span></p>
                                                    </div>
                                                    <div className="bg-theme-panel border border-theme-border px-3 py-1.5 rounded-xl text-right">
                                                        <p className="text-white font-black text-sm leading-none">{item.kolicina_ulaz || 0} <span className="text-[9px] text-slate-400">kom</span></p>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex-1 pr-2">
                                                <p className="text-amber-500 font-black text-lg font-mono">QR: {item.id}</p>
                                                <p className="text-white font-bold text-xs uppercase mt-1">{item.vrsta} | Klasa: {item.klasa}</p>
                                                <div className="flex gap-2 mt-2">
                                                    <span className="text-[9px] bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-600 font-black uppercase">L: {item.duzina}m</span>
                                                    <span className="text-[9px] bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-600 font-black uppercase">Ø: {item.promjer}cm</span>
                                                </div>
                                                <p className="text-[9px] text-slate-500 mt-3 font-bold uppercase">Šumarija: <span className="text-slate-300">{item.sumarija}</span></p>
                                                <p className="text-[9px] text-slate-500 mt-1 font-bold uppercase">Otpremnica: <span className="text-slate-300">{item.otpremnica_broj}</span></p>
                                            </div>
                                            <div className="text-right flex flex-col items-end shrink-0">
                                                <div className="bg-emerald-900/20 border border-emerald-500/30 px-3 py-2 rounded-xl text-right">
                                                    <p className="text-emerald-400 font-black text-xl font-mono leading-none">{parseFloat(item.zapremina || 0).toFixed(3)} <span className="text-[10px]">m³</span></p>
                                                </div>
                                                <p className="text-[8px] text-slate-500 mt-3 font-bold uppercase">Prijem: <br/>{new Date(item.datum_prijema).toLocaleDateString('bs-BA')}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {selektovaniPaket && (
                <div className="fixed inset-0 z-[150] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-slate-900 border-2 border-blue-500 p-8 rounded-[3rem] shadow-2xl max-w-2xl w-full relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <button onClick={() => setSelektovaniPaket(null)} className="absolute top-6 right-6 text-slate-400 hover:text-white text-2xl font-black transition-all">✕</button>
                        <div className="mb-6">
                            <h3 className="text-blue-400 text-xs uppercase tracking-widest mb-1">Forenzika i Hronologija izmjena paketa</h3>
                            <p className="text-white text-base uppercase font-black">{selektovaniPaket.paket_id} - {selektovaniPaket.naziv_proizvoda}</p>
                            <p className="text-amber-400 font-black text-sm tracking-widest mt-1 font-mono">DIMENZIJE U BAZI: {normalizujDimenzije(selektovaniPaket).debljina}x{normalizujDimenzije(selektovaniPaket).sirina}x{normalizujDimenzije(selektovaniPaket).duzina} mm</p>
                        </div>

                        {selektovaniPaket.broj_veze === 'SLOBODNA_ROBA' ? (
                            <div className="mb-4 bg-amber-900/10 border border-amber-500/30 p-4 rounded-xl">
                                <h4 className="text-amber-400 font-black uppercase text-[10px] mb-2">📦 Ručni Unos (Slobodna Roba)</h4>
                                <p className="text-xs text-slate-300">Ovaj paket nije potekao iz radnog naloga. Unešen je ručno na stanje i predviđen je za slobodnu prodaju.</p>
                            </div>
                        ) : selektovaniPaket.ai_sirovina_ids && (
                            <div className="mb-4 bg-blue-900/10 border border-blue-500/30 p-4 rounded-xl">
                                <h4 className="text-blue-400 font-black uppercase text-[10px] mb-2">⬅️ Sljedivost unazad (Izvorna sirovina)</h4>
                                <p className="text-xs text-slate-300">Ovaj paket je nastao preradom sirovine iz paketa: <span className="text-white font-mono bg-black px-2 py-0.5 rounded">{String(selektovaniPaket.ai_sirovina_ids)}</span></p>
                            </div>
                        )}

                        {izvedeniPaketi.length > 0 && (
                            <div className="mb-4 bg-purple-900/10 border border-purple-500/30 p-4 rounded-xl">
                                <h4 className="text-purple-400 font-black uppercase text-[10px] mb-2">➡️ Sljedivost unaprijed (Dalja Prerada)</h4>
                                <div className="flex flex-wrap gap-2">
                                    {izvedeniPaketi.map(izv => (
                                        <span key={izv.paket_id} className="text-[10px] bg-black text-slate-300 px-2 py-1 rounded border border-purple-500/30">Potrošen za: <b>{izv.paket_id}</b> ({izv.kolicina_final} m³)</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-4 mb-8">
                            <h4 className="text-slate-500 font-black uppercase text-[10px] border-b border-theme-border pb-2">Hronologija i detaljne razlike izmjena (Audit):</h4>
                            {historija === 'load' ? <p className="animate-pulse text-xs text-theme-accent">Generiram timeline...</p> : 
                            historija === 'none' ? <p className="text-xs text-slate-600">Nema zapisa o izmjenama.</p> : (
                                <div className="space-y-4">
                                    {historija.map((h, i) => (
                                        <div key={i} className="bg-theme-panel p-3 rounded-xl border border-theme-border/60">
                                            <div className="flex justify-between text-[10px] text-slate-500">
                                                <span>⏳ {new Date(h.vrijeme).toLocaleString('bs-BA')}</span>
                                                <span className="uppercase font-black text-amber-500">Korisnik: {h.korisnik}</span>
                                            </div>
                                            <p className="text-blue-300 uppercase font-black text-[10px] mt-1">Akcija: {h.naslov}</p>
                                            <p className="text-slate-200 font-mono text-[11px] leading-relaxed border-l-2 border-blue-500 pl-2 mt-1 whitespace-pre-wrap">{h.opis}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button onClick={() => isprintajAutomatski(selektovaniPaket)} disabled={isPrinting} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl uppercase shadow-lg text-xs tracking-widest">🖨️ Isprintaj deklaraciju (Auto QR + mm)</button>
                    </div>
                </div>
            )}
            
            {isScanning && <ScannerOverlay onScan={(text) => { setPretraga(text.toUpperCase()); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}