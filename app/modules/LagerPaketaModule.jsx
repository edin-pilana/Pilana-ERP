"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import ScannerOverlay from '../components/ScannerOverlay';
import { printDeklaracijaPaketa } from '../utils/printHelpers';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// PAMETNI DROPDOWN ZA RADNE NALOGE (Sa 2s zadrškom)
function Lager_SearchableRN({ nalozi, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    const timerRef = useRef(null);

    useEffect(() => { setSearch(value || ''); }, [value]);

    const handleInputChange = (val) => {
        setSearch(val);
        setOpen(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { onChange(val); setOpen(false); }, 2000);
    };

    const handleSelect = (val) => {
        setSearch(val);
        setOpen(false);
        if (timerRef.current) clearTimeout(timerRef.current);
        onChange(val);
    };

    const safeSearch = (search || '').toString().toUpperCase();
    const filtered = nalozi.filter(n => n.id.toUpperCase().includes(safeSearch) || n.kupac_naziv.toUpperCase().includes(safeSearch));

    return (
        <div className="relative font-black w-full">
            <input
                value={search}
                onFocus={() => setOpen(true)}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={e => { if(e.key === 'Enter') handleSelect(search); }}
                placeholder="Pretraži ili skeniraj RN-..."
                className="w-full p-3 bg-theme-panel border border-blue-500/50 rounded-xl text-xs text-theme-text outline-none focus:border-blue-400 uppercase font-black tracking-widest shadow-inner"
            />
            {open && search && (
                <div className="absolute top-full left-0 z-[100] w-full mt-1 bg-theme-panel border border-theme-border rounded-xl shadow-2xl max-h-60 overflow-y-auto text-left">
                    {filtered.length === 0 && <div className="p-3 text-xs text-slate-500 text-center">Nema rezultata...</div>}
                    {filtered.map(n => (
                        <div key={n.id} onClick={() => handleSelect(n.id)} className="p-3 border-b border-theme-border hover:bg-theme-accent cursor-pointer transition-colors">
                            <div className="text-theme-text text-xs font-black">{n.id}</div>
                            <div className="text-[10px] text-slate-400 mt-1">{n.kupac_naziv} | Status: <span className="text-amber-400">{n.status}</span></div>
                        </div>
                    ))}
                    <div onClick={() => setOpen(false)} className="p-2 text-center text-[9px] text-slate-500 cursor-pointer hover:text-theme-text bg-theme-card rounded-b-xl uppercase font-bold">Zatvori</div>
                </div>
            )}
        </div>
    );
}

export default function LagerPaketaModule({ onExit, user, header, setHeader }) {
    const [glavniTab, setGlavniTab] = useState('paketi'); 
    const [subTabPaketi, setSubTabPaketi] = useState('NA STANJU'); 
    
    const [paketi, setPaketi] = useState([]);
    const [trupci, setTrupci] = useState([]);
    const [aktivniNalozi, setAktivniNalozi] = useState([]);
    const [rnDetalji, setRnDetalji] = useState(null); 

    const [loading, setLoading] = useState(false);
    const [pretraga, setPretraga] = useState('');
    const [isScanning, setIsScanning] = useState(false);

    const [selektovaniPaket, setSelektovaniPaket] = useState(null);
    const [historija, setHistorija] = useState([]);
    const [izvedeniPaketi, setIzvedeniPaketi] = useState([]); 
    const [isPrinting, setIsPrinting] = useState(false);

    const [fPaket, setFPaket] = useState({ rn: '', debljinaOd: '', debljinaDo: '', sirinaOd: '', sirinaDo: '', duzinaOd: '', duzinaDo: '' });
    const [fTrupac, setFTrupac] = useState({ sumarija: '', klasa: '', precnikOd: '', precnikDo: '', duzinaOd: '', duzinaDo: '', vrsta: '' });

    const formatirajDatum = (isoString) => {
        if(!isoString) return ''; const [y, m, d] = isoString.split('T')[0].split('-'); return `${d}.${m}.${y}.`;
    };

    useEffect(() => { loadData(); }, [glavniTab, subTabPaketi]);

    const loadData = async () => {
        setLoading(true);
        supabase.from('radni_nalozi').select('id, kupac_naziv, status, stavke_jsonb').order('datum', {ascending: false}).then(({data}) => setAktivniNalozi(data || []));

        if (glavniTab === 'paketi') {
            let query = supabase.from('paketi').select('*');
            if (subTabPaketi === 'U PROIZVODNJI') query = query.is('closed_at', null);
            else if (subTabPaketi === 'NA STANJU') query = query.not('closed_at', 'is', null).is('otpremnica_id', null);
            else if (subTabPaketi === 'OTPREMLJENO') query = query.not('otpremnica_id', 'is', null);
            
            const { data } = await query.order('created_at', { ascending: false });
            
            if (data) {
                const grupisaniPaketi = [];
                const iskoristeniIDovi = new Set();
                for (let p of data) {
                    if (!iskoristeniIDovi.has(p.paket_id)) { iskoristeniIDovi.add(p.paket_id); grupisaniPaketi.push(p); }
                }
                setPaketi(grupisaniPaketi);
            }
        } else {
            const { data } = await supabase.from('trupci').select('*').is('prorezan_at', null).order('datum_prijema', { ascending: false });
            setTrupci(data || []);
        }
        setLoading(false);
    };

    // IZVLAČENJE JEDINSTVENIH VRIJEDNOSTI ZA PADAJUĆE MENIJE (Samo ono što je stvarno na placu)
    const sumarijeList = useMemo(() => [...new Set(trupci.map(t => t.sumarija).filter(Boolean))].sort(), [trupci]);
    const vrsteDrvetaList = useMemo(() => [...new Set(trupci.map(t => t.vrsta_drveta).filter(Boolean))].sort(), [trupci]);

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

    const otvoriPaketDirektno = async (paketId) => {
        const cistId = paketId.trim();
        const { data } = await supabase.from('paketi').select('*').eq('paket_id', cistId).maybeSingle();
        if (data) ucitajHistoriju(data);
        else alert(`Paket ${cistId} nije pronađen u bazi (možda je arhiviran).`);
    };

    const ucitajHistoriju = async (paket) => {
        setSelektovaniPaket(paket);
        setHistorija('load'); setIzvedeniPaketi([]);
        const sid = paket.paket_id;

        const { data: auditData } = await supabase.from('audit_log').select('*').eq('zapis_id', sid).order('vrijeme', { ascending: true });
        let dogadjaji = auditData ? auditData.map(a => ({ vrijeme: a.vrijeme, naslov: a.akcija, opis: a.akcija === 'DODAVANJE' ? 'Kreiran u proizvodnji' : 'Izmjena podataka', korisnik: a.korisnik })) : [];

        const { data: forwardData } = await supabase.from('paketi').select('paket_id, naziv_proizvoda, kolicina_final').ilike('ai_sirovina_ids', `%${sid}%`);
        if (forwardData && forwardData.length > 0) {
            const jedinstveniIzvedeni = [...new Map(forwardData.map(item => [item.paket_id, item])).values()];
            setIzvedeniPaketi(jedinstveniIzvedeni);
        }

        const { data: sveStavkePaketa } = await supabase.from('paketi').select('ulaz_trupci_ids').eq('paket_id', sid);
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

                    dogadjaji.push({ vrijeme: paket.created_at, naslov: 'SASTAV SIROVINE (TRUPCI)', opis: `Povezano sa ${unikatniTrupci.length} trupaca.\nUdio šumarija:\n${infoText}`, korisnik: 'Sistem' });
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
            const matchSearch = p.paket_id.includes(pretraga.toUpperCase()) || p.naziv_proizvoda.toUpperCase().includes(pretraga.toUpperCase());
            const matchRN = fPaket.rn === '' || (p.broj_veze && p.broj_veze.includes(fPaket.rn.toUpperCase()));
            const matchDeb = (fPaket.debljinaOd === '' || p.debljina >= parseFloat(fPaket.debljinaOd)) && (fPaket.debljinaDo === '' || p.debljina <= parseFloat(fPaket.debljinaDo));
            const matchSir = (fPaket.sirinaOd === '' || p.sirina >= parseFloat(fPaket.sirinaOd)) && (fPaket.sirinaDo === '' || p.sirina <= parseFloat(fPaket.sirinaDo));
            const matchDuz = (fPaket.duzinaOd === '' || p.duzina >= parseFloat(fPaket.duzinaOd)) && (fPaket.duzinaDo === '' || p.duzina <= parseFloat(fPaket.duzinaDo));
            return matchSearch && matchRN && matchDeb && matchSir && matchDuz;
        });
    }, [paketi, pretraga, fPaket]);

    const filtriraniTrupci = useMemo(() => {
        return trupci.filter(t => {
            const matchSearch = t.id.toString().includes(pretraga) || (t.dobavljas_naziv && t.dobavljas_naziv.toUpperCase().includes(pretraga.toUpperCase()));
            const matchSum = fTrupac.sumarija === '' || (t.sumarija && t.sumarija.toUpperCase().includes(fTrupac.sumarija.toUpperCase()));
            const matchVrsta = fTrupac.vrsta === '' || (t.vrsta_drveta && t.vrsta_drveta.toUpperCase().includes(fTrupac.vrsta.toUpperCase()));
            const matchPrec = (fTrupac.precnikOd === '' || t.precnik >= parseFloat(fTrupac.precnikOd)) && (fTrupac.precnikDo === '' || t.precnik <= parseFloat(fTrupac.precnikDo));
            const matchDuz = (fTrupac.duzinaOd === '' || t.duzina >= parseFloat(fTrupac.duzinaOd)) && (fTrupac.duzinaDo === '' || t.duzina <= parseFloat(fTrupac.duzinaDo));
            return matchSearch && matchSum && matchVrsta && matchPrec && matchDuz;
        });
    }, [trupci, pretraga, fTrupac]);

    const stats = useMemo(() => {
        const m3 = glavniTab === 'paketi' ? filtriraniPaketi.reduce((s, p) => s + parseFloat(p.kolicina_final || 0), 0) : filtriraniTrupci.reduce((s, t) => s + parseFloat(t.zapremina || 0), 0);
        return { count: glavniTab === 'paketi' ? filtriraniPaketi.length : filtriraniTrupci.length, m3: m3.toFixed(3) };
    }, [filtriraniPaketi, filtriraniTrupci, glavniTab]);

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6 font-bold animate-in fade-in">
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-blue-500" user={user} modulIme="lager" />

            <div className="flex bg-theme-panel p-1.5 rounded-2xl border border-theme-border shadow-inner">
    <button onClick={() => setGlavniTab('paketi')} className={`flex-1 py-4 rounded-xl text-xs uppercase font-black transition-all flex items-center justify-center gap-2 ${glavniTab === 'paketi' ? 'bg-theme-accent text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-theme-text'}`}>
        📦 Lager Gotovih Paketa
    </button>
    <button onClick={() => setGlavniTab('trupci')} className={`flex-1 py-4 rounded-xl text-xs uppercase font-black transition-all flex items-center justify-center gap-2 ${glavniTab === 'trupci' ? 'bg-theme-accent text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-theme-text'}`}>
        🪵 Lager Trupaca na Placu
    </button>
</div>

            <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-theme-border shadow-2xl space-y-5 relative z-40">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <input value={pretraga} onChange={e => setPretraga(e.target.value)} placeholder="Brza pretraga po ID-u ili Nazivu..." className="w-full p-4 bg-theme-panel border border-theme-border rounded-2xl text-theme-text outline-none focus:border-blue-500 font-black uppercase shadow-inner" />
                        <button onClick={() => setIsScanning(true)} className="absolute right-2 top-2 bottom-2 px-4 bg-theme-accent rounded-xl text-theme-text font-bold hover:opacity-80 transition-all shadow-lg text-xl">📷</button>
                    </div>
                    {glavniTab === 'paketi' && (
                        <div className="flex bg-theme-card p-1 rounded-2xl border border-theme-border shrink-0 overflow-x-auto">
                            {['U PROIZVODNJI', 'NA STANJU', 'OTPREMLJENO'].map(t => (
                                <button key={t} onClick={() => setSubTabPaketi(t)} className={`px-4 py-2 shrink-0 rounded-xl text-[9px] font-black uppercase transition-all ${subTabPaketi === t ? 'bg-theme-accent text-theme-text shadow-md' : 'text-slate-500 hover:text-theme-text hover:bg-theme-panel'}`}>{t}</button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-4 border-t border-theme-border">
                    {glavniTab === 'paketi' ? (
                        <>
                            <div className="col-span-2 md:col-span-1"><label className="text-[8px] text-slate-500 uppercase ml-2 mb-1 block">Radni Nalog</label><Lager_SearchableRN nalozi={aktivniNalozi} value={fPaket.rn} onChange={val => setFPaket({...fPaket, rn: val})} /></div>
                            <div><label className="text-[8px] text-slate-500 uppercase ml-2 mb-1 block">Debljina (od-do)</label><div className="flex gap-1"><input type="number" value={fPaket.debljinaOd} onChange={e=>setFPaket({...fPaket, debljinaOd: e.target.value})} placeholder="Min" className="w-1/2 p-3 bg-theme-card border border-theme-border rounded-xl text-xs text-theme-text text-center outline-none focus:border-blue-500" /><input type="number" value={fPaket.debljinaDo} onChange={e=>setFPaket({...fPaket, debljinaDo: e.target.value})} placeholder="Max" className="w-1/2 p-3 bg-theme-card border border-theme-border rounded-xl text-xs text-theme-text text-center outline-none focus:border-blue-500" /></div></div>
                            <div><label className="text-[8px] text-slate-500 uppercase ml-2 mb-1 block">Širina (od-do)</label><div className="flex gap-1"><input type="number" value={fPaket.sirinaOd} onChange={e=>setFPaket({...fPaket, sirinaOd: e.target.value})} placeholder="Min" className="w-1/2 p-3 bg-theme-card border border-theme-border rounded-xl text-xs text-theme-text text-center outline-none focus:border-blue-500" /><input type="number" value={fPaket.sirinaDo} onChange={e=>setFPaket({...fPaket, sirinaDo: e.target.value})} placeholder="Max" className="w-1/2 p-3 bg-theme-card border border-theme-border rounded-xl text-xs text-theme-text text-center outline-none focus:border-blue-500" /></div></div>
                            <div><label className="text-[8px] text-slate-500 uppercase ml-2 mb-1 block">Dužina (od-do)</label><div className="flex gap-1"><input type="number" value={fPaket.duzinaOd} onChange={e=>setFPaket({...fPaket, duzinaOd: e.target.value})} placeholder="Min" className="w-1/2 p-3 bg-theme-card border border-theme-border rounded-xl text-xs text-theme-text text-center outline-none focus:border-blue-500" /><input type="number" value={fPaket.duzinaDo} onChange={e=>setFPaket({...fPaket, duzinaDo: e.target.value})} placeholder="Max" className="w-1/2 p-3 bg-theme-card border border-theme-border rounded-xl text-xs text-theme-text text-center outline-none focus:border-blue-500" /></div></div>
                        </>
                    ) : (
                        <>
                            <div className="col-span-2 md:col-span-1">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 mb-1 block">Šumarija / Izvor</label>
                                <select value={fTrupac.sumarija} onChange={e=>setFTrupac({...fTrupac, sumarija: e.target.value})} className="w-full p-3 bg-theme-card border border-theme-border rounded-xl text-xs text-theme-text outline-none focus:border-amber-500 uppercase font-black cursor-pointer">
                                    <option value="">SVE ŠUMARIJE...</option>
                                    {sumarijeList.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 mb-1 block">Vrsta Drveta</label>
                                <select value={fTrupac.vrsta} onChange={e=>setFTrupac({...fTrupac, vrsta: e.target.value})} className="w-full p-3 bg-theme-card border border-theme-border rounded-xl text-xs text-theme-text outline-none focus:border-amber-500 uppercase font-black cursor-pointer">
                                    <option value="">SVE VRSTE...</option>
                                    {vrsteDrvetaList.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                            <div><label className="text-[8px] text-slate-500 uppercase ml-2 mb-1 block">Prečnik (od-do)</label><div className="flex gap-1"><input type="number" value={fTrupac.precnikOd} onChange={e=>setFTrupac({...fTrupac, precnikOd: e.target.value})} placeholder="Min" className="w-1/2 p-3 bg-theme-card border border-theme-border rounded-xl text-xs text-theme-text text-center outline-none focus:border-amber-500" /><input type="number" value={fTrupac.precnikDo} onChange={e=>setFTrupac({...fTrupac, precnikDo: e.target.value})} placeholder="Max" className="w-1/2 p-3 bg-theme-card border border-theme-border rounded-xl text-xs text-theme-text text-center outline-none focus:border-amber-500" /></div></div>
                            <div><label className="text-[8px] text-slate-500 uppercase ml-2 mb-1 block">Dužina (od-do)</label><div className="flex gap-1"><input type="number" value={fTrupac.duzinaOd} onChange={e=>setFTrupac({...fTrupac, duzinaOd: e.target.value})} placeholder="Min" className="w-1/2 p-3 bg-theme-card border border-theme-border rounded-xl text-xs text-theme-text text-center outline-none focus:border-amber-500" /><input type="number" value={fTrupac.duzinaDo} onChange={e=>setFTrupac({...fTrupac, duzinaDo: e.target.value})} placeholder="Max" className="w-1/2 p-3 bg-theme-card border border-theme-border rounded-xl text-xs text-theme-text text-center outline-none focus:border-amber-500" /></div></div>
                        </>
                    )}
                    <div className="flex flex-col justify-end">
                        <button onClick={() => { setPretraga(''); setFPaket({ rn: '', debljinaOd: '', debljinaDo: '', sirinaOd: '', sirinaDo: '', duzinaOd: '', duzinaDo: '' }); setFTrupac({ sumarija: '', klasa: '', precnikOd: '', precnikDo: '', duzinaOd: '', duzinaDo: '', vrsta: '' }); }} className="w-full p-3 bg-theme-panel text-slate-400 rounded-xl text-[9px] uppercase font-black hover:bg-red-900/30 hover:text-red-400 transition-all border border-theme-border">Poništi filtere ✕</button>
                    </div>
                </div>
            </div>

            {glavniTab === 'paketi' && fPaket.rn && rnDetalji && (
                <div className="bg-purple-900/20 border-2 border-purple-500/50 p-6 rounded-box shadow-2xl animate-in zoom-in-95 relative z-30">
                    <div className="flex justify-between items-start mb-4 border-b border-purple-500/30 pb-3">
                        <div>
                            <h3 className="text-theme-accent font-black uppercase text-sm tracking-widest">Pregled realizacije: {fPaket.rn}</h3>
                            <p className="text-theme-text text-xs mt-1">Kupac: <span className="font-bold">{rnDetalji.kupac}</span></p>
                        </div>
                        <span className={`text-[10px] px-3 py-1 rounded font-black uppercase ${rnDetalji.status === 'ZAVRŠENO' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-purple-900/40 text-theme-accent'}`}>{rnDetalji.status}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {rnDetalji.stavke.map((st, i) => (
                            <div key={i} className="bg-theme-card p-4 rounded-2xl border border-theme-border shadow-md">
                                <p className="text-theme-text text-xs font-black mb-2">{st.sifra} - {st.naziv}</p>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px]"><span className="text-slate-400">Naručeno:</span><span className="text-theme-text font-bold">{st.kolicina_obracun} m³ <span className="text-slate-500">({st.kolicina_unos} {st.jm_unos})</span></span></div>
                                    <div className="flex justify-between text-[10px]"><span className="text-slate-400">Proizvedeno na lageru:</span><span className="text-emerald-400 font-bold">{st.napravljenoM3.toFixed(3)} m³ <span className="text-emerald-600">({st.napravljenoKom} {st.jm_unos})</span></span></div>
                                    <div className="flex justify-between text-[10px] pt-1 border-t border-theme-border mt-1"><span className="text-slate-400 font-bold">Preostalo za izradu:</span><span className={st.faliM3 > 0 ? "text-amber-400 font-black" : "text-emerald-500 font-black"}>{st.faliM3 > 0 ? `${st.faliM3.toFixed(3)} m³ (${st.faliKom} ${st.jm_unos})` : 'ZAVRŠENO ✅'}</span></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center bg-theme-card p-4 rounded-2xl border border-theme-border shadow-inner">
                <p className="text-slate-500 text-xs uppercase">Prikazano rezultata: <span className="text-theme-text font-black ml-1">{stats.count}</span></p>
                <p className="text-emerald-500 text-sm font-black uppercase">Ukupna zapremina: <span className="text-2xl ml-2">{stats.m3} m³</span></p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <div className="col-span-full text-center py-20 animate-pulse text-theme-accent font-black tracking-widest uppercase">Učitavam lager...</div>
                ) : (glavniTab === 'paketi' ? filtriraniPaketi : filtriraniTrupci).length === 0 ? (
                    <div className="col-span-full text-center py-20 text-slate-600 font-bold border-2 border-dashed border-theme-border rounded-box">Nema rezultata za odabrane filtere.</div>
                ) : (
                    (glavniTab === 'paketi' ? filtriraniPaketi : filtriraniTrupci).map(item => (
                        <div key={item.id} onClick={() => { if(glavniTab==='paketi') ucitajHistoriju(item); }} className={`p-5 rounded-box border transition-all shadow-xl group relative overflow-hidden ${glavniTab === 'paketi' ? 'bg-[#111827] border-theme-border hover:border-blue-500 hover:-translate-y-1 cursor-pointer' : 'bg-[#1e1e1e] border-theme-border'}`}>
                            {glavniTab === 'paketi' ? (
                                <>
                                    {item.closed_at && <div className="absolute top-0 right-0 bg-emerald-600 text-theme-text text-[8px] px-3 py-1 font-black rounded-bl-xl uppercase shadow-md z-10">ZAVRŠEN</div>}
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1 pr-2">
                                            <p className="text-theme-accent font-black text-lg">{item.paket_id}</p>
                                            <p className="text-theme-text text-sm font-bold mt-1 uppercase leading-tight">{item.naziv_proizvoda}</p>
                                            <p className="text-amber-400 font-black text-xs uppercase mt-1 tracking-widest">{item.debljina}x{item.sirina}x{item.duzina} <span className="text-[9px] lowercase text-slate-500">cm</span></p>
                                            
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {item.broj_veze && <button onClick={(e) => { e.stopPropagation(); setFPaket({...fPaket, rn: item.broj_veze}); window.scrollTo({top: 0, behavior: 'smooth'}); }} className="text-[9px] bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded inline-block font-black border border-blue-500/20 hover:bg-theme-accent hover:text-theme-text transition-all cursor-pointer">RN: {item.broj_veze}</button>}
                                                {item.oznake && item.oznake.length > 0 && item.oznake.map((oznaka, idx) => (
                                                    <span key={idx} className="text-[8px] bg-theme-panel text-slate-300 px-2 py-0.5 rounded uppercase font-bold border border-theme-border">{oznaka}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end shrink-0">
                                            <div className="bg-emerald-900/20 border border-emerald-500/30 px-3 py-2 rounded-xl text-right mb-1 min-w-[80px]">
                                                <p className="text-emerald-400 font-black text-xl leading-none">{item.kolicina_final} <span className="text-[10px] text-emerald-600">m³</span></p>
                                            </div>
                                            <div className="bg-theme-panel border border-theme-border px-3 py-1.5 rounded-xl text-right min-w-[80px]">
                                                <p className="text-theme-text font-black text-sm leading-none">{item.kolicina_ulaz || 0} <span className="text-[9px] text-slate-400 uppercase">{item.jm || 'kom'}</span></p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-theme-border/50">
                                        <span className="text-[9px] text-slate-500 uppercase font-black">{item.vrijeme_tekst} | {item.masina}</span>
                                        <span className="text-[9px] text-theme-accent opacity-0 group-hover:opacity-100 transition-all uppercase font-black bg-blue-900/30 px-2 py-1 rounded">Vidi Detalje 🔍</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <p className="text-amber-500 font-black text-lg">ID: {item.id}</p>
                                            <p className="text-theme-text text-xs font-bold mt-1 uppercase">{item.vrsta_drveta || 'Miješano'}</p>
                                            <p className="text-[9px] text-slate-400 mt-2 font-black uppercase">Izvor: {item.sumarija || 'N/A'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-emerald-400 font-black text-xl">{parseFloat(item.zapremina || 0).toFixed(3)} <span className="text-[10px]">m³</span></p>
                                            <p className="text-slate-400 text-xs font-black uppercase mt-1 tracking-widest">Ø {item.precnik} cm | L {item.duzina} m</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-theme-border/50 flex justify-between items-center">
                                        <span className="text-[9px] text-slate-500 uppercase font-black">Primljeno: {formatirajDatum(item.datum_prijema)}</span>
                                        <span className={`text-[8px] px-2 py-1 rounded font-black uppercase ${item.klasa === 'I' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-theme-panel text-slate-400'}`}>Klasa {item.klasa}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>

            {selektovaniPaket && (
                <div className="fixed inset-0 z-[150] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] border-2 border-blue-500 p-8 rounded-[3rem] shadow-2xl max-w-2xl w-full relative max-h-[90vh] overflow-y-auto">
                        <button onClick={() => setSelektovaniPaket(null)} className="absolute top-6 right-6 text-slate-400 hover:text-theme-text text-2xl font-black transition-all hover:scale-110">✕</button>
                        
                        <div className="mb-6 flex justify-between items-start">
                            <div>
                                <h3 className="text-theme-accent font-black uppercase text-xs mb-2 tracking-widest">Detalji Paketa</h3>
                                <p className="text-theme-text text-4xl font-black">{selektovaniPaket.paket_id}</p>
                                <p className="text-slate-300 font-bold text-lg mt-2">{selektovaniPaket.naziv_proizvoda}</p>
                                <p className="text-amber-400 font-black text-sm tracking-widest mt-1">{selektovaniPaket.debljina}x{selektovaniPaket.sirina}x{selektovaniPaket.duzina} <span className="text-[10px] text-slate-500">cm</span></p>
                            </div>
                            {selektovaniPaket.broj_veze && (
                                <div className="text-right">
                                    <span className="text-[9px] text-slate-500 block uppercase font-bold mb-1">Vezani Nalog</span>
                                    <span className="bg-blue-900/40 border border-blue-500 text-blue-300 px-3 py-1.5 rounded-lg text-xs font-black">{selektovaniPaket.broj_veze}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4 mt-4 mb-8 bg-theme-card p-4 rounded-2xl border border-theme-border">
                            <div className="flex-1">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Količina (Unos)</p>
                                <p className="text-theme-text font-black text-xl">{selektovaniPaket.kolicina_ulaz || 0} <span className="text-xs text-slate-400">{selektovaniPaket.jm || 'kom'}</span></p>
                            </div>
                            <div className="w-px bg-slate-700"></div>
                            <div className="flex-1 text-right">
                                <p className="text-[10px] text-emerald-600 uppercase font-bold">Zapremina (Final)</p>
                                <p className="text-emerald-400 font-black text-xl">{selektovaniPaket.kolicina_final} <span className="text-xs text-emerald-600">m³</span></p>
                            </div>
                        </div>

                        {selektovaniPaket.ai_sirovina_ids && selektovaniPaket.ai_sirovina_ids.length > 0 && (
                            <div className="mb-6 bg-blue-900/10 border border-blue-500/30 p-4 rounded-2xl">
                                <h4 className="text-theme-accent font-black uppercase text-[10px] mb-3 flex items-center gap-2">⬅️ Sljedivost unazad (Izvor)</h4>
                                <p className="text-xs text-slate-300 mb-2">Ovaj paket je napravljen preradom sljedećih paketa. Klikni za detalje:</p>
                                <div className="flex flex-wrap gap-2">
                                    {(Array.isArray(selektovaniPaket.ai_sirovina_ids) ? selektovaniPaket.ai_sirovina_ids : [selektovaniPaket.ai_sirovina_ids]).map(srcId => (
                                        <button key={srcId} onClick={() => otvoriPaketDirektno(srcId)} className="bg-theme-accent text-theme-text px-4 py-2 rounded-xl text-xs font-black shadow-lg hover:opacity-80 transition-all cursor-pointer hover:scale-105 border border-blue-400">
                                            {srcId}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {izvedeniPaketi.length > 0 && (
                            <div className="mb-6 bg-purple-900/10 border border-purple-500/30 p-4 rounded-2xl">
                                <h4 className="text-theme-accent font-black uppercase text-[10px] mb-3 flex items-center gap-2">➡️ Sljedivost unaprijed (Proizvedeno)</h4>
                                <p className="text-xs text-slate-300 mb-2">Ovaj paket je potrošen da bi se u doradi napravili sljedeći paketi:</p>
                                <div className="flex flex-wrap gap-2">
                                    {izvedeniPaketi.map(izv => (
                                        <button key={izv.paket_id} onClick={() => otvoriPaketDirektno(izv.paket_id)} className="bg-theme-card border-b border-theme-border text-theme-text px-4 py-2 rounded-xl text-[10px] font-black shadow-lg hover:bg-purple-500 transition-all cursor-pointer hover:scale-105 flex flex-col items-start border border-purple-400">
                                            <span className="text-xs">{izv.paket_id}</span>
                                            <span className="text-[8px] text-purple-200">{izv.naziv_proizvoda} ({izv.kolicina_final}m³)</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-4 mb-8">
                            <h4 className="text-slate-500 font-black uppercase text-[10px] border-b border-theme-border pb-2">Vremenska Sljedivost (Historija izmjena):</h4>
                            {historija === 'load' ? <p className="animate-pulse text-xs text-theme-accent">Generiram timeline...</p> : 
                             historija === 'none' ? <p className="text-xs text-slate-600">Nema dodatnih zapisa o promjenama.</p> : (
                                <div className="space-y-4">
                                    {historija.map((h, i) => (
                                        <div key={i} className="flex gap-4 items-start relative before:absolute before:left-[7px] before:top-5 before:bottom-[-20px] before:w-[2px] before:bg-theme-panel last:before:hidden">
                                            <div className="w-4 h-4 rounded-box bg-slate-700 border-4 border-[#1e293b] z-10 shrink-0 mt-1"></div>
                                            <div>
                                                <p className="text-theme-text text-xs font-black uppercase">{h.naslov}</p>
                                                <p className="text-[10px] text-slate-400 mt-1 whitespace-pre-line">{h.opis}</p>
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
                            className={`w-full py-5 text-theme-text font-black rounded-2xl uppercase shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center gap-2 ${isPrinting ? 'bg-slate-600' : 'bg-theme-accent hover:opacity-80'}`}
                        >
                            {isPrinting ? '⏳ Tražim vezu i generišem...' : '🖨️ Isprintaj deklaraciju (Auto QR)'}
                        </button>
                    </div>
                </div>
            )}
            
            {isScanning && <ScannerOverlay onScan={(text) => { setPretraga(text.toUpperCase()); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}