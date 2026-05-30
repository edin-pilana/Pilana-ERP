"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import MasterSearch from '../components/MasterSearch';
import PametniDialog from '../components/PametniDialog';
import { useSaaS } from '../utils/useSaaS';
import { AlertTriangle, ArrowRight, History, ShieldAlert } from 'lucide-react';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const formatirajTacanDatum = (d1, d2, d3) => {
    const moguciDatumi = [d1, d2, d3].filter(Boolean);
    for (let dt of moguciDatumi) {
        try {
            const d = new Date(dt);
            if (!isNaN(d.getTime())) {
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yyyy = d.getFullYear();
                const hh = String(d.getHours()).padStart(2, '0');
                const min = String(d.getMinutes()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
            }
        } catch(e) {}
    }
    return 'N/A';
};

const getSortableTime = (d1, d2, d3) => {
    const moguciDatumi = [d1, d2, d3].filter(Boolean);
    for (let dt of moguciDatumi) {
        try { const d = new Date(dt); if (!isNaN(d.getTime())) return d.getTime(); } catch(e) {}
    }
    return 0;
};

// Handle JSON values format safely
const siguranString = (val) => {
    if (val === null || val === undefined) return 'prazno';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
};

// 🟢 APSOLUTNA INTIMNA FORENZIKA
const renderStavkeDiff = (stareRaw, noveRaw) => {
    let stare = []; let nove = [];
    try { stare = typeof stareRaw === 'string' ? JSON.parse(stareRaw) : (stareRaw || []); } catch(e) { stare = stareRaw && typeof stareRaw === 'object' ? [stareRaw] : []; }
    try { nove = typeof noveRaw === 'string' ? JSON.parse(noveRaw) : (noveRaw || []); } catch(e) { nove = noveRaw && typeof noveRaw === 'object' ? [noveRaw] : []; }
    
    if (!Array.isArray(stare)) stare = [stare];
    if (!Array.isArray(nove)) nove = [nove];

    let subDiffs = [];
    const unikatniKljuceviStavki = Array.from(new Set([
        ...stare.map((s, idx) => s.id || s.sifra || s.paket_id || `red_${idx}`),
        ...nove.map((n, idx) => n.id || n.sifra || n.paket_id || `red_${idx}`)
    ]));

    unikatniKljuceviStavki.forEach((kljuc) => {
        const o = stare.find((s, idx) => (s.id || s.sifra || s.paket_id || `red_${idx}`) === kljuc);
        const n = nove.find((item, idx) => (item.id || item.sifra || item.paket_id || `red_${idx}`) === kljuc);
        const nazivArtikla = n?.naziv || n?.naziv_proizvoda || o?.naziv || o?.naziv_proizvoda || kljuc;

        if (!o && n) {
            subDiffs.push(
                <div key={`add-${kljuc}`} className="text-emerald-400 font-bold bg-emerald-950/30 p-2 rounded border border-emerald-500/20 text-[10px] my-1">
                    ➕ DODANA STAVKA: <span className="text-white uppercase">{nazivArtikla}</span> ➔ {JSON.stringify(n)}
                </div>
            );
        } else if (o && !n) {
            subDiffs.push(
                <div key={`rem-${kljuc}`} className="text-red-400 font-bold bg-red-950/30 p-2 rounded border border-red-500/20 text-[10px] my-1">
                    ❌ UKLONJENA STAVKA: <span className="text-slate-400 line-through uppercase">{nazivArtikla}</span> ➔ {JSON.stringify(o)}
                </div>
            );
        } else {
            const unutrašnjePromjene = [];
            const unutrašnjiKljučevi = Array.from(new Set([...Object.keys(o), ...Object.keys(n)]));
            
            unutrašnjiKljučevi.forEach(sk => {
                if (JSON.stringify(o[sk]) !== JSON.stringify(n[sk])) {
                    unutrašnjePromjene.push(
                        <div key={sk} className="flex flex-col sm:flex-row sm:items-center gap-1 text-[10px] ml-4 border-b border-slate-800 pb-1 last:border-0">
                            <span className="text-slate-400 font-bold uppercase w-24 shrink-0">• {sk}:</span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-red-400 line-through bg-red-950/40 px-1 rounded font-mono">{siguranString(o[sk])}</span>
                                <span className="text-slate-500">➔</span>
                                <span className="text-emerald-400 font-black bg-emerald-900/40 px-1 rounded font-mono">{siguranString(n[sk])}</span>
                            </div>
                        </div>
                    );
                }
            });

            if (unutrašnjePromjene.length > 0) {
                subDiffs.push(
                    <div key={`mod-${kljuc}`} className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-[10px] my-1">
                        <span className="text-amber-400 font-black uppercase block mb-1.5">✏️ Izmjena unutar stavke: {nazivArtikla}</span>
                        <div className="space-y-1">{unutrašnjePromjene}</div>
                    </div>
                );
            }
        }
    });

    return subDiffs.length > 0 ? <div className="space-y-2 mt-2">{subDiffs}</div> : null;
};

const PrikazIzmjena = ({ log }) => {
    const stari = log.stari_podaci || {};
    const novi = log.novi_podaci || {};

    const svaPoljaZaAnalizu = Array.from(new Set([...Object.keys(stari), ...Object.keys(novi)]));
    let ispisSvihIzmjena = [];

    svaPoljaZaAnalizu.forEach(k => {
        const staroVal = stari[k];
        const novoVal = novi[k];

        if (JSON.stringify(staroVal) === JSON.stringify(novoVal)) return;

        if (typeof novoVal === 'object' || typeof staroVal === 'object' || k.includes('jsonb') || k.includes('ids') || Array.isArray(novoVal)) {
            const listaDiff = renderStavkeDiff(staroVal, novoVal);
            if (listaDiff) {
                ispisSvihIzmjena.push(
                    <div key={k} className="mb-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800 shadow-inner animate-in fade-in">
                        <span className="text-[10px] text-slate-400 font-black uppercase mb-2 block border-b border-slate-800/80 pb-1.5 tracking-wider">📦 Izmjena u strukturi liste polja: {k.toUpperCase()}</span>
                        {listaDiff}
                    </div>
                );
            }
            return;
        }

        ispisSvihIzmjena.push(
            <div key={k} className="flex flex-col md:flex-row md:items-center gap-2 text-[11px] py-2 border-b border-theme-border/30 last:border-0 hover:bg-theme-panel/40 px-2 rounded transition-all">
                <span className="text-slate-400 uppercase w-32 shrink-0 font-bold">• {k.replace(/_/g, ' ')}:</span>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-red-400 line-through bg-red-950/30 px-2 py-0.5 rounded font-mono truncate max-w-[45%]">{siguranString(staroVal)}</span>
                    <span className="text-slate-600 font-black shrink-0">➔</span>
                    <span className="text-emerald-400 font-black bg-emerald-900/30 px-2 py-0.5 rounded font-mono truncate flex-1 shadow-sm">{siguranString(novoVal)}</span>
                </div>
            </div>
        );
    });

    if (ispisSvihIzmjena.length === 0) {
        return (
            <div className="mt-2 p-3 bg-theme-panel rounded-xl border border-theme-border shadow-inner">
                <p className="text-[11px] text-slate-300 leading-relaxed italic">{log.detalji}</p>
            </div>
        );
    }
    
    return <div className="mt-3 space-y-2">{ispisSvihIzmjena}</div>;
};

export default function KontrolniToranjModule({ user, header, setHeader, onExit }) {
    const saas = useSaaS('forenzika_toranj', { boja_kartice: '#1e293b', boja_naslova: 'text-indigo-400' });

    const [sken, setSken] = useState('');
    const [loading, setLoading] = useState(false);
    const [forenzika, setForenzika] = useState(null);
    const [sviDokumenti, setSviDokumenti] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [otvoreniLogovi, setOtvoreniLogovi] = useState(new Set());

    const [reklamacijskiAlarmi, setReklamacijskiAlarmi] = useState([]);
    const [istorijaKrojenjaMajke, setIstorijaKrojenjaMajke] = useState(null);
    const [katalog, setKatalog] = useState([]);

    const toggleLog = (id) => {
        const newSet = new Set(otvoreniLogovi);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setOtvoreniLogovi(newSet);
    };

    // 🟢 DEEP LINKING LOGIKA ZA AUTOMATSKO OTVARANJE
    useEffect(() => {
        const ucitajSveReference = async () => {
            const [pon, rn, otp, rac, pak, trup, kat] = await Promise.all([
                supabase.from('ponude').select('id, kupac_naziv, status'),
                supabase.from('radni_nalozi').select('id, kupac_naziv, status'),
                supabase.from('otpremnice').select('id, kupac_naziv, status'),
                supabase.from('racuni').select('id, kupac_naziv, status'),
                supabase.from('paketi').select('paket_id, naziv_proizvoda, closed_at, otpremnica_id'),
                supabase.from('trupci').select('id, vrsta, status'),
                supabase.from('katalog_proizvoda').select('*')
            ]);
            
            if(kat.data) setKatalog(kat.data);

            const unikatniPaks = []; const pakSet = new Set();
            if (pak.data) {
                pak.data.forEach(p => {
                    if(!pakSet.has(p.paket_id)) {
                        pakSet.add(p.paket_id);
                        let st = p.otpremnica_id ? 'ISPORUČENO' : (p.closed_at ? 'NA STANJU' : 'U PROIZVODNJI');
                        unikatniPaks.push({ id: p.paket_id, meta: p.naziv_proizvoda, tip: 'Paket', status: st, active: p.otpremnica_id ? 0 : 1 });
                    }
                });
            }

            setSviDokumenti([
                ...unikatniPaks,
                ...(pon.data || []).map(d => ({ id: d.id, meta: d.kupac_naziv, tip: 'Ponuda', status: d.status, active: d.status.includes('REALIZ') ? 0 : 1 })),
                ...(rn.data || []).map(d => ({ id: d.id, meta: d.kupac_naziv, tip: 'Radni Nalog', status: d.status, active: d.status === 'ZAVRŠENO' ? 0 : 1 })),
                ...(otp.data || []).map(d => ({ id: d.id, meta: d.kupac_naziv, tip: 'Otpremnica', status: d.status, active: d.status === 'ISPORUČENO' ? 0 : 1 })),
                ...(rac.data || []).map(d => ({ id: d.id, meta: d.kupac_naziv, tip: 'Račun', status: d.status, active: d.status === 'NAPLAĆENO' ? 0 : 1 })),
                ...(trup.data || []).map(d => ({ id: String(d.id), meta: d.vrsta || 'Trupac', tip: 'Trupac', status: d.status?.toUpperCase(), active: d.status === 'prorezano' ? 0 : 1 }))
            ]);
        };
        ucitajSveReference();

        // Čitanje namjere (intent) sa početnog ekrana
        const autoOpenId = localStorage.getItem('erp_auto_open_id');
        if (autoOpenId) {
            setSken(autoOpenId);
            analizirajSve(autoOpenId);
            localStorage.removeItem('erp_auto_open_id'); // Očisti nakon upotrebe da ne smeta sljedeći put
        }

    }, []);

    const preporuke = useMemo(() => {
        if (!sken) return [];
        const pojam = sken.toUpperCase();
        return sviDokumenti.filter(d => d.id.toUpperCase().includes(pojam)).slice(0, 15);
    }, [sken, sviDokumenti]);

    const analizirajSve = async (tačanBroj) => {
        const val = tačanBroj.toUpperCase().trim();
        if (!val) return;
        setLoading(true); setForenzika(null); setShowDropdown(false); setOtvoreniLogovi(new Set());
        setReklamacijskiAlarmi([]); setIstorijaKrojenjaMajke(null);

        const { data: rekPodaci } = await supabase.from('reklamacije').select('*').or(`paket_id.eq.${val},broj_otpremnice.eq.${val}`);
        if (rekPodaci && rekPodaci.length > 0) setReklamacijskiAlarmi(rekPodaci);

        const { data: trupacBaza } = await supabase.from('trupci').select('*').eq('id', val).maybeSingle();
        if (trupacBaza && trupacBaza.parent_id) {
            const { data: majkaBaza } = await supabase.from('trupci').select('*').eq('id', trupacBaza.parent_id).maybeSingle();
            if (majkaBaza) setIstorijaKrojenjaMajke({ dijete: trupacBaza, majka: majkaBaza });
        }

        let nalogIdZaLanac = null; let otpremnicaIdZaLanac = null; let racunIdZaLanac = null; let ponudaIdZaLanac = null;

        if (val.startsWith('RN-')) nalogIdZaLanac = val;
        else if (val.startsWith('OTP-')) otpremnicaIdZaLanac = val;
        else if (val.startsWith('RAC-')) racunIdZaLanac = val;
        else if (val.startsWith('PON-')) ponudaIdZaLanac = val;
        else {
            const { data: pData } = await supabase.from('paketi').select('broj_veze, otpremnica_id').eq('paket_id', val).limit(1).maybeSingle();
            if (pData) {
                if (pData.broj_veze && pData.broj_veze.startsWith('RN-')) nalogIdZaLanac = pData.broj_veze;
                if (pData.otpremnica_id) otpremnicaIdZaLanac = pData.otpremnica_id;
            }
        }

        if (otpremnicaIdZaLanac && !nalogIdZaLanac) {
            const { data: otpDb } = await supabase.from('otpremnice').select('broj_veze').eq('id', otpremnicaIdZaLanac).maybeSingle();
            if (otpDb && otpDb.broj_veze?.startsWith('RN-')) nalogIdZaLanac = otpDb.broj_veze;
        }

        if (nalogIdZaLanac) {
            const { data: rnDb } = await supabase.from('radni_nalozi').select('broj_ponude').eq('id', nalogIdZaLanac).maybeSingle();
            if (rnDb?.broj_ponude) ponudaIdZaLanac = rnDb.broj_ponude;
            if (!otpremnicaIdZaLanac) {
                const { data: otpDb } = await supabase.from('otpremnice').select('id').eq('broj_veze', nalogIdZaLanac).maybeSingle();
                if (otpDb) otpremnicaIdZaLanac = otpDb.id;
            }
        }

        if (otpremnicaIdZaLanac && !racunIdZaLanac) {
            const { data: racDb } = await supabase.from('racuni').select('id').eq('broj_veze', otpremnicaIdZaLanac).maybeSingle();
            if (racDb) racunIdZaLanac = racDb.id;
        }

        const cistiIdovi = [val, nalogIdZaLanac, otpremnicaIdZaLanac, racunIdZaLanac, ponudaIdZaLanac].filter(Boolean);

        const [naloziDB, ponudeDB, otpremniceDB, racuniDB, paketiDB] = await Promise.all([
            supabase.from('radni_nalozi').select('*').in('id', cistiIdovi),
            supabase.from('ponude').select('*').in('id', cistiIdovi),
            supabase.from('otpremnice').select('*').in('id', cistiIdovi),
            supabase.from('racuni').select('*').in('id', cistiIdovi),
            supabase.from('paketi').select('*').or(`paket_id.eq.${val},broj_veze.eq.${nalogIdZaLanac}`).order('created_at', { ascending: true })
        ]);

        let dataChain = {
            paketHistory: paketiDB.data?.filter(p => p.paket_id === val) || [], paketSadrzaj: [], paketUkupnoM3: 0, 
            nalozi: naloziDB.data || [], ponuda: (ponudeDB.data && ponudeDB.data.length > 0) ? ponudeDB.data[0] : null, 
            otpremnice: otpremniceDB.data || [], racuni: racuniDB.data || [],
            kupac: null, logovi: [], finansijska_analiza: [], ulazniTrupci: [], ulazniPaketi: [], izlazniPaketi: []
        };

        let glavniPaketId = paketiDB.data?.find(p => p.paket_id.includes(val))?.paket_id || (paketiDB.data && paketiDB.data.length > 0 ? paketiDB.data[0].paket_id : null);
        
        if (glavniPaketId) {
            const fokusiraniPaketi = paketiDB.data.filter(p => p.paket_id === glavniPaketId);
            dataChain.paketHistory = fokusiraniPaketi;
            
            const agregacija = {}; let ukupnoM3 = 0;
            fokusiraniPaketi.forEach(p => {
                const kljuc = p.naziv_proizvoda + '_' + p.debljina + '_' + p.sirina + '_' + p.duzina;
                if (!agregacija[kljuc]) { agregacija[kljuc] = { naziv: p.naziv_proizvoda, debljina: p.debljina, sirina: p.sirina, duzina: p.duzina, kolicina_final: 0, jm: p.jm || 'kom', oznake: new Set(p.oznake || []) }; }
                const finalDodato = parseFloat(p.kolicina_final || 0);
                agregacija[kljuc].kolicina_final += finalDodato;
                if (p.oznake) p.oznake.forEach(o => agregacija[kljuc].oznake.add(o));
                ukupnoM3 += finalDodato;
            });
            dataChain.paketSadrzaj = Object.values(agregacija).map(s => ({...s, oznake: [...s.oznake]}));
            dataChain.paketUkupnoM3 = ukupnoM3;

            let trupciIds = []; let paketiIds = [];
            fokusiraniPaketi.forEach(p => {
                if (p.ulaz_trupci_ids) trupciIds.push(...(Array.isArray(p.ulaz_trupci_ids) ? p.ulaz_trupci_ids : [p.ulaz_trupci_ids]));
                if (p.ai_sirovina_ids) paketiIds.push(...(Array.isArray(p.ai_sirovina_ids) ? p.ai_sirovina_ids : [p.ai_sirovina_ids]));
            });
            if (trupciIds.length > 0) {
                const { data } = await supabase.from('trupci').select('*').in('id', [...new Set(trupciIds)]);
                if (data) dataChain.ulazniTrupci = data;
            }
            if (paketiIds.length > 0) {
                const { data } = await supabase.from('paketi').select('paket_id, naziv_proizvoda, kolicina_final, masina').in('paket_id', [...new Set(paketiIds)]);
                if (data) dataChain.ulazniPaketi = [...new Map(data.map(i => [i.paket_id, i])).values()];
            }
            const { data: forward } = await supabase.from('paketi').select('paket_id, naziv_proizvoda, kolicina_final, masina').ilike('ai_sirovina_ids', `%${val}%`);
            if (forward) dataChain.izlazniPaketi = [...new Map(forward.map(i => [i.paket_id, i])).values()];
        }

        let targetKupacIme = dataChain.ponuda?.kupac_naziv || dataChain.nalozi[0]?.kupac_naziv || dataChain.racuni[0]?.kupac_naziv || dataChain.otpremnice[0]?.kupac_naziv;
        if (targetKupacIme) {
            const { data: kupacPodaci } = await supabase.from('kupci').select('*').eq('naziv', targetKupacIme).limit(1);
            if (kupacPodaci && kupacPodaci.length > 0) dataChain.kupac = kupacPodaci[0];
        }

        if (dataChain.ponuda && dataChain.kupac) {
            const sistemskiRabati = dataChain.kupac.rabati_jsonb || {};
            const stavkePonude = dataChain.ponuda.stavke_jsonb || [];
            dataChain.finansijska_analiza = stavkePonude.map(st => {
                let defaultRabat = 0;
                if (sistemskiRabati.proizvodi && sistemskiRabati.proizvodi[st.sifra]) defaultRabat = parseFloat(sistemskiRabati.proizvodi[st.sifra]);
                else if (sistemskiRabati.ukupni) defaultRabat = parseFloat(sistemskiRabati.ukupni);
                const primijenjeniRabat = parseFloat(st.rabat_procenat || 0);
                const odstupanje = primijenjeniRabat - defaultRabat;
                return {
                    sifra: st.sifra, naziv: st.naziv, kolicina: st.kolicina_obracun, cijena_baza: st.cijena_baza,
                    sistemski_rabat: defaultRabat, primijenjeni_rabat: primijenjeniRabat, odstupanje: odstupanje,
                    upozorenje: odstupanje > 0 ? `⚠️ Ručno povećan rabat za ${odstupanje}%!` : `U skladu sa bazom`
                };
            });
        }

        let sysLogsRaw = [];
        const orConditions = cistiIdovi.map(id => `detalji.ilike.%${id}%,akcija.ilike.%${id}%`).join(',');
        
        const { data: sLogs } = await (orConditions ? supabase.from('sistem_audit_log').select('*').or(orConditions) : { data: [] });
        if (sLogs) sysLogsRaw = sLogs;

        const reklamacijskiLogovi = (rekPodaci || []).map(r => ({
            id: 'rek_log_' + r.id, created_at: new Date(r.created_at).getTime(), datum_prikaz: formatirajTacanDatum(r.created_at),
            korisnik: r.snimio_korisnik, akcija: `⚠️ STATUS REKLAMACIJE: [${r.status}]`,
            detalji: `Zahtjev za povrat/otpis. Količina: ${r.kolicina} m³. Razlog: ${r.razlog}. ${r.napomena || '-'}`
        }));

        const sviLogovi = [
            ...sysLogsRaw.map(l => ({ id: 'sys_' + l.id, created_at: getSortableTime(l.created_at, l.vrijeme, l.datum), datum_prikaz: formatirajTacanDatum(l.created_at, l.vrijeme, l.datum), korisnik: l.korisnik, akcija: l.akcija, detalji: l.detalji || 'Zapis sistema.', stari_podaci: l.stari_podaci || null, novi_podaci: l.novi_podaci || null })),
            ...reklamacijskiLogovi
        ];

        dataChain.logovi = Array.from(new Map(sviLogovi.map(item => [item.id, item])).values()).filter(l => l.created_at > 0).sort((a, b) => a.created_at - b.created_at);
        setForenzika(dataChain); setLoading(false); setSken(val); 
    };

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6 font-bold animate-in fade-in" style={{ backgroundColor: saas.ui.boja_pozadine }}>
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-indigo-500" user={user} hideMasina={true} modulIme="forenzika" saas={saas} />

            <div className="p-6 rounded-[2rem] border border-theme-border shadow-2xl text-center bg-theme-card relative z-50">
                <h3 className={`${saas.ui.boja_naslova || 'text-indigo-400'} font-black uppercase text-xs mb-4 tracking-widest flex items-center justify-center gap-2`}><span>🕵️‍♂️ FORENZIČKI SKENER / X-RAY DOKUMENTA</span></h3>
                <div className="flex gap-2 max-w-2xl mx-auto relative">
                    <div className="flex-1 relative">
                        <input type="text" value={sken} onChange={(e) => { setSken(e.target.value.toUpperCase()); setShowDropdown(true); }} onKeyDown={e => e.key === 'Enter' && analizirajSve(sken)} onFocus={()=>setShowDropdown(true)} placeholder="UPIŠI ID ILI SKENIRAJ..." className="w-full p-5 bg-theme-panel rounded-2xl text-center font-black text-2xl text-theme-text border-2 border-indigo-500/50 uppercase outline-none focus:border-indigo-400 shadow-inner tracking-widest relative z-10" />
                        {showDropdown && sken && preporuke.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-theme-panel border border-slate-600 rounded-xl shadow-2xl overflow-hidden z-[100] text-left max-h-60 overflow-y-auto custom-scrollbar">
                                {preporuke.map(p => (
                                    <div key={p.id} onClick={() => { setSken(p.id); analizirajSve(p.id); }} className="p-4 border-b border-theme-border hover:bg-slate-700 cursor-pointer flex justify-between items-center group">
                                        <div className="flex items-center gap-3"><span className="text-theme-text font-black">{p.id}</span> <span className="text-[9px] text-indigo-400 uppercase font-bold border border-indigo-500/30 px-2 py-0.5 rounded bg-indigo-900/20">{p.tip}</span></div>
                                        <div className="text-right"><div className="text-slate-300 text-xs font-bold">{p.meta}</div><div className="text-[9px] text-emerald-400 font-bold uppercase mt-1">{p.status}</div></div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <button onClick={() => { analizirajSve(sken); setShowDropdown(false); }} className="bg-indigo-600 px-8 rounded-2xl text-theme-text font-black hover:bg-indigo-500 shadow-xl text-xl flex items-center justify-center">📷</button>
                </div>
            </div>

            {reklamacijskiAlarmi.length > 0 && (
                <div className="bg-red-950/40 border-2 border-red-500 p-6 rounded-[2rem] shadow-[0_0_40px_rgba(239,68,68,0.25)] space-y-4 animate-in zoom-in-95">
                    <h3 className="text-red-400 font-black uppercase text-xs md:text-sm tracking-widest flex items-center gap-2"><AlertTriangle className="animate-pulse"/> DETEKTOVAN ALARM: PREDMET REKLAMACIJE KUPCA</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {reklamacijskiAlarmi.map(rek => {
                            const kat = katalog.find(k => k.naziv === rek.naziv_proizvoda || k.sifra === rek.naziv_proizvoda);
                            let jedinicaDim = 'mm';
                            if (kat && parseFloat(kat.duzina) < 1000 && parseFloat(kat.duzina) > 0) jedinicaDim = 'cm';
                            const dimStr = kat ? `${kat.visina}x${kat.sirina}x${kat.duzina} ${jedinicaDim}` : 'N/A';
                            const originalniUnosUtaknut = rek.napomena?.match(/\[Unos:\s*\d+\s*\w+\]/i)?.[0] || 'N/A';

                            return (
                                <div key={rek.id} className="p-4 bg-black/40 rounded-xl border border-red-500/20 text-xs text-slate-300 space-y-2">
                                    <div className="flex justify-between items-center border-b border-red-500/20 pb-2">
                                        <span className="text-white font-black uppercase text-sm">Paket: {rek.paket_id}</span>
                                        <span className="bg-red-900/40 text-red-400 border border-red-500/30 px-2 py-0.5 rounded font-black uppercase">{rek.status}</span>
                                    </div>
                                    <p className="font-bold text-white uppercase">Kupac: <span className="text-red-400">{rek.kupac_naziv}</span></p>
                                    <p className="font-medium text-slate-200">Artikal: {rek.naziv_proizvoda}</p>
                                    {kat && <p className="text-emerald-400 font-mono font-black text-[11px]">📏 DIMENZIJE ARTIKLA: {dimStr}</p>}
                                    <div className="flex justify-between items-center bg-red-950/20 p-2 rounded border border-red-500/10 font-bold text-[11px]">
                                        <span>Zapremina: <b className="text-red-400">{rek.kolicina} m³</b></span>
                                        <span className="text-blue-400">Izvorni Unos: <b className="text-white">{originalniUnosUtaknut.replace(/[\[\]]/g, '')}</b></span>
                                    </div>
                                    <p className="text-amber-400 font-black">Razlog: {rek.razlog}</p>
                                    {rek.napomena && <p className="text-[10px] text-slate-500 italic">Opis: "{rek.napomena.replace(/\[Unos:\s*\d+\s*\w+\]/i, '').trim()}"</p>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {istorijaKrojenjaMajke && (
                <div className="bg-amber-950/30 border-2 border-amber-500/50 p-6 rounded-[2rem] shadow-xl space-y-3 animate-in slide-in-from-top-4">
                    <h3 className="text-amber-500 font-black uppercase text-xs tracking-widest flex items-center gap-2"><History size={16}/> LANAC KROJENJA TRUPACA (Sljedivost sirovine)</h3>
                    <div className="p-4 bg-black/30 rounded-xl border border-theme-border flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                        <div>
                            <p className="text-white font-black text-sm">Trupac <span className="text-amber-400">{istorijaKrojenjaMajke.dijete.id}</span></p>
                            <p className="text-slate-400 mt-1 uppercase">Ovaj komad je nastao fizičkim prekrajanjem/krojenjem na placu.</p>
                        </div>
                        <div className="flex items-center gap-3 bg-amber-900/10 border border-amber-500/20 p-3 rounded-xl shrink-0">
                            <span className="text-slate-400 font-bold uppercase text-[10px]">Izvorna Majka:</span>
                            <span className="text-white font-black font-mono text-base">{istorijaKrojenjaMajke.majka.id}</span>
                            <span className="text-slate-500">|</span>
                            <span className="text-emerald-400 font-black">{istorijaKrojenjaMajke.majka.zapremina} m³</span>
                        </div>
                    </div>
                </div>
            )}

            {loading && <div className="flex flex-col items-center justify-center py-20 animate-pulse text-indigo-400 font-black text-xs uppercase tracking-widest">Skeniram bazu poslova...</div>}

            {forenzika && !loading && (
                <div className="space-y-6 animate-in slide-in-from-bottom">
                    {/* LANAC MAKRO PREGLEDA */}
                    <div className="p-6 bg-theme-card rounded-[2rem] border border-theme-border shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
                        <h2 className="text-indigo-400 font-black uppercase text-xs mb-6 ml-4 tracking-widest">1. Hronološki lanac sljedivosti posla</h2>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 ml-4">
                            <div className={`p-4 rounded-xl border-2 text-center flex flex-col justify-center ${forenzika.ponuda ? 'border-pink-500 bg-pink-900/10' : 'border-slate-800 text-slate-600 bg-black/10'}`}>
                                <span className="text-[9px] uppercase font-black mb-1">Korijen (Ponuda)</span>
                                {forenzika.ponuda ? <b className="text-white text-base">{forenzika.ponuda.id}</b> : <span>Nema</span>}
                            </div>
                            <div className={`p-4 rounded-xl border-2 text-center flex flex-col justify-center ${forenzika.nalozi.length > 0 ? 'border-purple-500 bg-purple-900/10' : 'border-slate-800 text-slate-600 bg-black/10'}`}>
                                <span className="text-[9px] uppercase font-black mb-1">Proizvodnja (Nalozi)</span>
                                {forenzika.nalozi.map(n => <b key={n.id} className="text-white text-xs block">{n.id} ({n.status})</b>)}
                            </div>
                            <div className={`p-4 rounded-xl border-2 text-center flex flex-col justify-center ${forenzika.otpremnice.length > 0 ? 'border-orange-500 bg-orange-900/10' : 'border-slate-800 text-slate-600 bg-black/10'}`}>
                                <span className="text-[9px] uppercase font-black mb-1">Logistika (Utovar)</span>
                                {forenzika.otpremnice.map(o => <b key={o.id} className="text-white text-xs block">{o.id}</b>)}
                            </div>
                            <div className={`p-4 rounded-xl border-2 text-center flex flex-col justify-center ${forenzika.racuni.length > 0 ? 'border-emerald-500 bg-emerald-900/10' : 'border-slate-800 text-slate-600 bg-black/10'}`}>
                                <span className="text-[9px] uppercase font-black mb-1">Finansije (Fakture)</span>
                                {forenzika.racuni.map(r => <b key={r.id} className="text-emerald-400 text-xs block">{r.id}</b>)}
                            </div>
                        </div>

                        {forenzika.paketSadrzaj.length > 0 && (
                            <div className="mt-6 p-5 bg-theme-panel border border-indigo-500/20 rounded-2xl ml-4">
                                <p className="text-[10px] text-indigo-400 uppercase font-black mb-3">Trenutni sadržaj i zapremina u paketu:</p>
                                {forenzika.paketSadrzaj.map((p, i) => (
                                    <div key={i} className="flex justify-between items-center p-3 bg-black/20 border border-theme-border rounded-xl text-xs mb-2">
                                        <div><p className="text-white font-black uppercase">{p.naziv}</p><p className="text-[10px] text-slate-500 font-mono mt-0.5">{p.debljina}x{p.sirina}x{p.duzina} mm</p></div>
                                        <b className="text-emerald-400 text-base font-mono">{p.kolicina_final.toFixed(3)} m³</b>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-theme-card rounded-[2rem] border border-theme-border shadow-2xl">
                        <h3 className="text-blue-400 font-black uppercase text-xs mb-4">🌳 Sljedivost materijala i procesa paketa</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-theme-panel rounded-xl border border-slate-700">
                                <h4 className="text-[10px] text-slate-400 font-black uppercase mb-2">⬅️ Ulazne Sirovine paketa:</h4>
                                {forenzika.ulazniTrupci.map(t => <p key={t.id} className="text-xs text-emerald-400 font-mono">• Trupac ID: {t.id} ({t.zapremina} m³)</p>)}
                                {forenzika.ulazniPaketi.map(p => <p key={p.paket_id} className="text-xs text-blue-400 font-mono">• Iz paketa: {p.paket_id} ({p.kolicina_final} m³)</p>)}
                                {forenzika.ulazniTrupci.length === 0 && forenzika.ulazniPaketi.length === 0 && <p className="text-xs italic text-slate-500">Nema evidentirane ulazne sirovine.</p>}
                            </div>
                            <div className="p-4 bg-theme-panel rounded-xl border border-slate-700">
                                <h4 className="text-[10px] text-slate-400 font-black uppercase mb-2">➡️ Izvedeni proizvodi (Dalja Prerada):</h4>
                                {forenzika.izlazniPaketi.map(izv => <p key={izv.paket_id} className="text-xs text-purple-400 font-mono">• Prerađen u paket: {izv.paket_id} ({izv.kolicina_final} m³)</p>)}
                                {forenzika.izlazniPaketi.length === 0 && <p className="text-xs italic text-slate-500">Paket nije dalje prerađivan.</p>}
                            </div>
                        </div>
                    </div>

                    {forenzika.finansijska_analiza.length > 0 && (
                        <div className="p-6 bg-theme-card rounded-[2rem] border border-emerald-500/30 shadow-2xl">
                            <h3 className="text-emerald-400 font-black uppercase text-xs mb-4">💸 Finansijska Kontrola Cijena i Rabata</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-black/40 text-slate-400 uppercase font-black">
                                        <tr><th className="p-3">Proizvod</th><th className="p-3 text-center">Količina</th><th className="p-3 text-right">Cijena Baza</th><th className="p-3 text-center">Sistemski Rabat</th><th className="p-3 text-center">Ukucani Rabat</th><th className="p-3">Status Kontrole</th></tr>
                                    </thead>
                                    <tbody className="text-white font-bold">
                                        {forenzika.finansijska_analiza.map((f, i) => (
                                            <tr key={i} className="border-b border-theme-border hover:bg-white/5">
                                                <td className="p-3">{f.sifra} - {f.naziv}</td>
                                                <td className="p-3 text-center">{f.kolicina}</td>
                                                <td className="p-3 text-right">{f.cijena_baza} KM</td>
                                                <td className="p-3 text-center text-slate-400">{f.sistemski_rabat}%</td>
                                                <td className="p-3 text-center text-amber-400">{f.primijenjeni_rabat}%</td>
                                                <td className={`p-3 text-[10px] font-black uppercase ${f.odstupanje > 0 ? 'text-red-400 bg-red-950/20' : 'text-slate-500'}`}>{f.upozorenje}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* DNEVNIK LOGOVA I HISTORIJE IZMJENA */}
                    <div className="p-6 bg-theme-card rounded-[2rem] border border-theme-border shadow-2xl relative">
                        <h2 className="text-amber-500 font-black uppercase text-xs mb-6 tracking-widest">3. Skala Izmjena i hronologija događaja (Uključujući Reklamacije)</h2>
                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar relative pl-10 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-800 z-0">
                            {forenzika.logovi.map(log => {
                                const jeOtvoren = otvoreniLogovi.has(log.id);
                                const jeReklamacija = log.id.startsWith('rek_log_');

                                return (
                                    <div key={log.id} className="relative z-10">
                                        <div onClick={() => toggleLog(log.id)} className={`p-4 rounded-xl border cursor-pointer transition-all ${jeOtvoren ? 'bg-theme-card border-amber-500/40' : 'bg-theme-panel border-theme-border hover:border-slate-700'} ${jeReklamacija ? 'border-red-500/40 bg-red-950/10' : ''}`}>
                                            <div className="flex justify-between items-center text-xs border-b border-theme-border/60 pb-2 mb-2">
                                                <span className={`font-black uppercase tracking-wider ${jeReklamacija ? 'text-red-400 animate-pulse' : 'text-white'}`}>{log.akcija}</span>
                                                <span className="text-slate-400 text-[10px] font-mono bg-black px-2 py-0.5 rounded">{log.datum_prikaz} by {log.korisnik}</span>
                                            </div>
                                            {jeReklamacija ? (
                                                <p className="text-slate-200 font-mono text-[11px] leading-relaxed border-l-2 border-red-500 pl-2 mt-1">{log.detalji}</p>
                                            ) : (
                                                <PrikazIzmjena log={log} />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}