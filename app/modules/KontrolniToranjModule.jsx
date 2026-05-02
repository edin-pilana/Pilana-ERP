"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import { useSaaS } from '../utils/useSaaS';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- UNIVERZALNI PARSER DATUMA ---
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
                const ss = String(d.getSeconds()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
            }
        } catch(e) {}
    }
    return 'Nepoznato vrijeme';
};

const getSortableTime = (d1, d2, d3) => {
    const moguciDatumi = [d1, d2, d3].filter(Boolean);
    for (let dt of moguciDatumi) {
        try { const d = new Date(dt); if (!isNaN(d.getTime())) return d.getTime(); } catch(e) {}
    }
    return 0;
};

// --- DUBINSKA ANALIZA STAVKI (MOLEKULARNA PRECIZNOST) ---
const renderStavkeDiff = (stareRaw, noveRaw, isCreation) => {
    let stare = []; let nove = [];
    try { stare = typeof stareRaw === 'string' ? JSON.parse(stareRaw) : (stareRaw || []); } catch(e) { stare = []; }
    try { nove = typeof noveRaw === 'string' ? JSON.parse(noveRaw) : (noveRaw || []); } catch(e) { nove = []; }

    if (!Array.isArray(stare)) stare = [];
    if (!Array.isArray(nove)) nove = [];

    if (isCreation || stare.length === 0) {
        if (nove.length === 0) return <span className="text-slate-500 italic text-[10px]">Lista je prazna.</span>;
        return (
            <div className="space-y-1 mt-2">
                {nove.map((n, i) => {
                    const naziv = n.naziv || n.naziv_proizvoda || n.sifra || 'Stavka';
                    const kol = n.kolicina_obracun || n.kolicina_unos || n.kolicina_final || n.kolicina || '';
                    const jm = n.jm_obracun || n.jm_unos || n.jm || '';
                    return <div key={i} className="text-emerald-400 font-bold text-[11px] truncate bg-emerald-900/10 px-2 py-1 rounded border border-emerald-500/20">➕ Dodano: <span className="text-theme-text">{naziv}</span> {kol && `(${kol} ${jm})`}</div>;
                })}
            </div>
        );
    }

    let diffs = [];
    const getKljuc = (s) => s.id || s.sifra || s.naziv || s.paket_id || JSON.stringify(s);

    // Analiza novog stanja i upoređivanje
    nove.forEach(n => {
        const kljuc = getKljuc(n);
        const o = stare.find(s => getKljuc(s) === kljuc);
        const naziv = n.naziv || n.naziv_proizvoda || n.sifra || n.paket_id || 'Nepoznat proizvod';

        if (!o) {
            const kolN = n.kolicina_obracun || n.kolicina_unos || n.kolicina_final || n.kolicina || '';
            const jm = n.jm_obracun || n.jm_unos || n.jm || '';
            diffs.push(<div key={`add-${kljuc}`} className="text-emerald-400 font-bold bg-emerald-900/10 p-2 rounded mb-1 border border-emerald-500/20 text-[10px]">➕ Dodana nova stavka: <span className="text-theme-text">{naziv}</span> {kolN && `(${kolN} ${jm})`}</div>);
        } else {
            let promjeneNaStavci = [];
            
            // Prolazimo kroz sve pod-ključeve te stavke da vidimo šta je mijenjano
            const subKeys = Array.from(new Set([...Object.keys(o), ...Object.keys(n)])).filter(sk => !['id', 'sifra', 'naziv', 'naziv_proizvoda', 'paket_id'].includes(sk));
            
            subKeys.forEach(sk => {
                if (JSON.stringify(o[sk]) !== JSON.stringify(n[sk])) {
                    let staroVal = o[sk] === null || o[sk] === undefined ? 'prazno' : String(o[sk]);
                    let novoVal = n[sk] === null || n[sk] === undefined ? 'prazno' : String(n[sk]);
                    promjeneNaStavci.push(
                        <div key={sk} className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 text-[10px] ml-4 mt-1 border-b border-theme-border/50 pb-1 last:border-0">
                            <span className="text-slate-400 uppercase w-28 shrink-0">• {sk.replace(/_/g, ' ')}:</span>
                            <div className="flex items-center gap-2">
                                <span className="text-red-400 line-through bg-red-900/10 px-1 rounded">{staroVal}</span>
                                <span className="text-slate-500">➔</span>
                                <span className="text-emerald-400 font-black bg-emerald-900/10 px-1 rounded">{novoVal}</span>
                            </div>
                        </div>
                    );
                }
            });

            if (promjeneNaStavci.length > 0) {
                 diffs.push(
                     <div key={`mod-${kljuc}`} className="text-amber-400 font-bold bg-theme-panel p-2 rounded mb-1 border border-theme-border text-[10px] shadow-sm">
                         ✏️ Izmjena na stavci: <span className="text-theme-text bg-theme-panel px-2 py-0.5 rounded ml-1">{naziv}</span>
                         <div className="mt-2 space-y-1">{promjeneNaStavci}</div>
                     </div>
                 );
            }
        }
    });

    // Pronađi obrisano
    stare.forEach(o => {
        const kljuc = getKljuc(o);
        const n = nove.find(s => getKljuc(s) === kljuc);
        if (!n) {
             const naziv = o.naziv || o.naziv_proizvoda || o.sifra || o.paket_id || 'Stavka';
             const kolO = o.kolicina_obracun || o.kolicina_unos || o.kolicina_final || o.kolicina || '';
             const jm = o.jm_obracun || o.jm_unos || o.jm || '';
             diffs.push(<div key={`rem-${kljuc}`} className="text-red-400 font-bold bg-red-900/10 p-2 rounded mb-1 border border-red-500/20 text-[10px]">❌ Uklonjena stavka: <span className="text-slate-300 line-through">{naziv}</span> {kolO && `(Bilo je: ${kolO} ${jm})`}</div>);
        }
    });

    if (diffs.length === 0) return <div className="text-slate-500 text-[10px] italic mt-2 border-t border-theme-border pt-2">Sistem nije detektovao mikroskopske promjene unutar ove liste.</div>;
    return <div className="mt-2 space-y-2">{diffs}</div>;
};

// --- GLAVNI PREVODILAC SIROVOG JSON KODA ---
const PrikazIzmjena = ({ log }) => {
    const stari = log.stari_podaci || {};
    const novi = log.novi_podaci || {};

    const isCreation = Object.keys(stari).length === 0 && Object.keys(novi).length > 0;

    if (Object.keys(stari).length === 0 && Object.keys(novi).length === 0) {
        return <div className="mt-3 p-3 bg-theme-panel rounded-xl border border-theme-border shadow-inner">
            <p className="text-[11px] text-slate-300 leading-relaxed italic">{log.detalji}</p>
        </div>;
    }

    const ignorisanaPolja = ['id', 'created_at', 'vrijeme', 'datum', 'snimio_korisnik', 'vrijeme_tekst', 'broj_veze', 'broj_ponude'];
    const kljucevi = Array.from(new Set([...Object.keys(stari), ...Object.keys(novi)])).filter(k => !ignorisanaPolja.includes(k));
    
    let ispisIzmjena = [];

    // Jasan ispis kreiranja
    if (isCreation) {
        ispisIzmjena.push(
            <div key="init" className="mb-3 bg-emerald-900/10 border border-emerald-500/30 p-3 rounded-xl shadow-sm">
                <span className="text-emerald-400 font-black text-[11px] block">✨ Dokument je inicijalno kreiran sa sljedećim parametrima:</span>
            </div>
        );
    }

    kljucevi.forEach(k => {
        const staraVr = stari[k];
        const novaVr = novi[k];

        // Ako se nije promijenilo (a nije kreiranje), preskoči
        if (!isCreation && JSON.stringify(staraVr) === JSON.stringify(novaVr)) return;

        // OBRADA STATUSA
        if (k === 'status') {
            ispisIzmjena.push(
                <div key="status" className="mb-3 bg-blue-900/20 border border-blue-500/30 p-3 rounded-xl shadow-inner">
                    <span className="text-theme-accent uppercase text-[10px] font-black mb-1 block">🔔 Promjena Statusa Dokumenta:</span>
                    <div className="flex items-center gap-3">
                        {!isCreation && <span className="text-red-400 line-through font-bold text-xs">{staraVr || 'Nedefinisano'}</span>}
                        {!isCreation && <span className="text-slate-400 font-black">➔</span>}
                        <span className="text-emerald-400 font-black text-sm uppercase">{novaVr}</span>
                    </div>
                </div>
            );
            return;
        }

        // OBRADA LISTA I KOMPLEKSNIH JSONB POLJA
        if (k === 'stavke_jsonb' || k === 'rabati_jsonb' || k === 'ulaz_trupci_ids' || k === 'ai_sirovina_ids' || Array.isArray(novaVr)) {
            ispisIzmjena.push(
                <div key={k} className="mb-3 bg-theme-panel p-4 rounded-xl border border-theme-border/50 shadow-inner">
                    <span className="text-[10px] text-slate-400 font-black uppercase mb-2 block border-b border-theme-border pb-2">📦 Detaljna analiza liste / Sadržaj ({k.replace(/_jsonb|_ids/g, '')}):</span>
                    {renderStavkeDiff(staraVr, novaVr, isCreation)}
                </div>
            );
            return;
        }

        // OBRADA OBIČNIH POLJA (Tekst, Brojevi)
        const formatStaro = staraVr === null || staraVr === '' || staraVr === undefined ? 'Prazno' : String(staraVr);
        const formatNovo = novaVr === null || novaVr === '' || novaVr === undefined ? 'Prazno' : String(novaVr);

        ispisIzmjena.push(
            <div key={k} className="flex flex-col md:flex-row md:items-center gap-2 text-[11px] py-1.5 border-b border-theme-border/50 last:border-0 hover:bg-theme-panel/30 px-2 rounded transition-colors">
                <span className="text-slate-400 uppercase w-32 shrink-0 font-bold">• {k.replace(/_/g, ' ')}:</span>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {!isCreation && <span className="text-red-400 line-through truncate max-w-[40%] bg-red-900/10 px-2 py-0.5 rounded">{formatStaro}</span>}
                    {!isCreation && <span className="text-slate-600 font-black shrink-0">➔</span>}
                    <span className="text-emerald-400 font-bold truncate flex-1 bg-emerald-900/10 px-2 py-0.5 rounded shadow-sm">{formatNovo}</span>
                </div>
            </div>
        );
    });

    if (ispisIzmjena.length === 0 && !isCreation) return <p className="text-[11px] text-slate-500 italic mt-3 border-t border-theme-border pt-3">Korisnik je kliknuo "Sačuvaj", ali sistem nije pronašao promjene u poljima dokumenta.</p>;
    
    return <div className="mt-4">{ispisIzmjena}</div>;
};


export default function KontrolniToranjModule({ user, header, setHeader, onExit }) {
    
    // --- SAAS INTEGRACIJA ---
    const saas = useSaaS('forenzika_toranj', {
        boja_kartice: '#1e293b',
        boja_naslova: 'text-indigo-400',
    });

    const [sken, setSken] = useState('');
    const [loading, setLoading] = useState(false);
    const [forenzika, setForenzika] = useState(null);
    const [sviDokumenti, setSviDokumenti] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);

    const [otvoreniLogovi, setOtvoreniLogovi] = useState(new Set());
    const toggleLog = (id) => {
        const newSet = new Set(otvoreniLogovi);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setOtvoreniLogovi(newSet);
    };

    useEffect(() => {
        const ucitajSve = async () => {
            const { data: pon } = await supabase.from('ponude').select('id, kupac_naziv, status');
            const { data: rn } = await supabase.from('radni_nalozi').select('id, kupac_naziv, status');
            const { data: otp } = await supabase.from('otpremnice').select('id, kupac_naziv, status');
            const { data: rac } = await supabase.from('racuni').select('id, kupac_naziv, status');
            const { data: pak } = await supabase.from('paketi').select('paket_id, naziv_proizvoda, closed_at, otpremnica_id');
            
            const unikatniPaketi = [];
            const pakSet = new Set();
            if (pak) {
                pak.forEach(p => {
                    if(!pakSet.has(p.paket_id)) {
                        pakSet.add(p.paket_id);
                        let status = 'U PROIZVODNJI'; let active = 1;
                        if (p.otpremnica_id) { status = 'ISPORUČENO'; active = 0; }
                        else if (p.closed_at) { status = 'NA STANJU'; active = 1; }
                        unikatniPaketi.push({ id: p.paket_id, meta: p.naziv_proizvoda, tip: 'Paket', status, active });
                    }
                });
            }

            setSviDokumenti([
                ...unikatniPaketi,
                ...(pon || []).map(d => ({ id: d.id, meta: d.kupac_naziv, tip: 'Ponuda', status: d.status, active: d.status === 'REALIZOVANA ✅' ? 0 : 1 })),
                ...(rn || []).map(d => ({ id: d.id, meta: d.kupac_naziv, tip: 'Radni Nalog', status: d.status, active: d.status === 'ZAVRŠENO' ? 0 : 1 })),
                ...(otp || []).map(d => ({ id: d.id, meta: d.kupac_naziv, tip: 'Otpremnica', status: d.status, active: d.status === 'ISPORUČENO' ? 0 : 1 })),
                ...(rac || []).map(d => ({ id: d.id, meta: d.kupac_naziv, tip: 'Račun', status: d.status, active: d.status === 'NAPLAĆENO' ? 0 : 1 }))
            ]);
        };
        ucitajSve();
    }, []);

    const preporuke = useMemo(() => {
        if (!sken) return [];
        const pojam = sken.toUpperCase();
        return sviDokumenti
            .filter(d => d.id.toUpperCase().includes(pojam))
            .sort((a, b) => {
                const aTačno = a.id.toUpperCase() === pojam ? 1 : 0;
                const bTačno = b.id.toUpperCase() === pojam ? 1 : 0;
                if (aTačno !== bTačno) return bTačno - aTačno;
                if (a.active !== b.active) return b.active - a.active;
                return 0;
            }).slice(0, 15);
    }, [sken, sviDokumenti]);

    // =======================================================
    // 🕸️ DVOSMJERNA RADARSKA PRETRAGA (BI-DIRECTIONAL GRAPH)
    // =======================================================
    const analizirajSve = async (tačanBroj) => {
        const val = tačanBroj.toUpperCase().trim();
        if (!val) return;
        
        setLoading(true); setForenzika(null); setShowDropdown(false); setOtvoreniLogovi(new Set());

        let SVI_IDOVI_Lanca = new Set([val]);

        // 1. REKURZIVNO TRAŽENJE SVIH POVEZANIH DOKUMENATA GORE I DOLJE
        let proslaVelicina = 0;
        while (SVI_IDOVI_Lanca.size > proslaVelicina) {
            proslaVelicina = SVI_IDOVI_Lanca.size;
            const trenutniNiz = Array.from(SVI_IDOVI_Lanca);

            // Tražimo roditelje (Gledamo broj_veze i broj_ponude)
            const { data: otpP } = await supabase.from('otpremnice').select('broj_veze').in('id', trenutniNiz);
            if (otpP) otpP.forEach(x => { if(x.broj_veze) SVI_IDOVI_Lanca.add(x.broj_veze); });
            
            const { data: racP } = await supabase.from('racuni').select('broj_veze').in('id', trenutniNiz);
            if (racP) racP.forEach(x => { if(x.broj_veze) SVI_IDOVI_Lanca.add(x.broj_veze); });
            
            const { data: rnP1 } = await supabase.from('radni_nalozi').select('broj_veze').in('id', trenutniNiz);
            if (rnP1) rnP1.forEach(x => { if(x.broj_veze) SVI_IDOVI_Lanca.add(x.broj_veze); });
            
            const { data: rnP2 } = await supabase.from('radni_nalozi').select('broj_ponude').in('id', trenutniNiz);
            if (rnP2) rnP2.forEach(x => { if(x.broj_ponude) SVI_IDOVI_Lanca.add(x.broj_ponude); });

            const { data: pakP } = await supabase.from('paketi').select('broj_veze').in('paket_id', trenutniNiz);
            if (pakP) pakP.forEach(x => { if(x.broj_veze) SVI_IDOVI_Lanca.add(x.broj_veze); });

            // Tražimo djecu (Gdje sam ja broj_veze)
            const { data: otpC } = await supabase.from('otpremnice').select('id').in('broj_veze', trenutniNiz);
            if (otpC) otpC.forEach(x => SVI_IDOVI_Lanca.add(x.id));
            
            const { data: racC } = await supabase.from('racuni').select('id').in('broj_veze', trenutniNiz);
            if (racC) racC.forEach(x => SVI_IDOVI_Lanca.add(x.id));
            
            const { data: rnC1 } = await supabase.from('radni_nalozi').select('id').in('broj_veze', trenutniNiz);
            if (rnC1) rnC1.forEach(x => SVI_IDOVI_Lanca.add(x.id));
            
            const { data: rnC2 } = await supabase.from('radni_nalozi').select('id').in('broj_ponude', trenutniNiz);
            if (rnC2) rnC2.forEach(x => SVI_IDOVI_Lanca.add(x.id));

            const { data: pakC } = await supabase.from('paketi').select('paket_id').in('broj_veze', trenutniNiz);
            if (pakC) pakC.forEach(x => SVI_IDOVI_Lanca.add(x.paket_id));
        }

        // 2. SKIDANJE KONKRETNIH PODATAKA IZ BAZE NA OSNOVU PRONAĐENIH ID-ova
        const cistiIdovi = Array.from(SVI_IDOVI_Lanca);
        
        const { data: naloziDB } = await supabase.from('radni_nalozi').select('*').in('id', cistiIdovi);
        const { data: ponudeDB } = await supabase.from('ponude').select('*').in('id', cistiIdovi);
        const { data: otpremniceDB } = await supabase.from('otpremnice').select('*').in('id', cistiIdovi);
        const { data: racuniDB } = await supabase.from('racuni').select('*').in('id', cistiIdovi);
        const { data: paketiDB } = await supabase.from('paketi').select('*').in('paket_id', cistiIdovi).order('created_at', { ascending: true });

        // Pravimo dataChain objekat za UI
        let dataChain = {
            paketHistory: paketiDB || [], paketSadrzaj: [], paketUkupnoM3: 0, 
            nalozi: naloziDB || [], ponuda: (ponudeDB && ponudeDB.length > 0) ? ponudeDB[0] : null, 
            otpremnice: otpremniceDB || [], racuni: racuniDB || [],
            kupac: null, logovi: [], finansijska_analiza: [],
            ulazniTrupci: [], ulazniPaketi: [], izlazniPaketi: []
        };

        // Obrada ako imamo Pakete u lancu (Fokus na prvi skenirani ako je paket)
        let glavniPaketId = paketiDB?.find(p => p.paket_id.includes(val))?.paket_id || (paketiDB && paketiDB.length > 0 ? paketiDB[0].paket_id : null);
        
        if (glavniPaketId) {
            const fokusiraniPaketi = paketiDB.filter(p => p.paket_id === glavniPaketId);
            dataChain.paketHistory = fokusiraniPaketi;
            
            const agregacija = {};
            let ukupnoM3 = 0;
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
            const { data: forward } = await supabase.from('paketi').select('paket_id, naziv_proizvoda, kolicina_final, masina').ilike('ai_sirovina_ids', `%${glavniPaketId}%`);
            if (forward) dataChain.izlazniPaketi = [...new Map(forward.map(i => [i.paket_id, i])).values()];
        }

        // KUPAC I FINANSIJE
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
                    upozorenje: odstupanje > 0 ? `⚠️ Rucno povećan rabat za ${odstupanje}%!` : (odstupanje < 0 ? `Manji rabat od sistemskog` : `U skladu sa bazom`)
                };
            });
        }

        if (cistiIdovi.length === 0) {
            setLoading(false); return alert(`Sistem ne može pronaći dokument niti paket sa tačnim brojem: ${val}`);
        }

        // 3. MIKRO-FORENZIKA (LOG IZMJENA ZA SVE DOKUMENTE U LANCU)
        let sysLogsRaw = []; let auditLogsRaw = [];

        // Sistemski audit log
        // Razdvajamo uslove zbog limita URL-a
        const orConditions = cistiIdovi.map(id => `detalji.ilike.%${id}%,akcija.ilike.%${id}%`).join(',');
        if (orConditions) {
            const { data: sLogs } = await supabase.from('sistem_audit_log').select('*').or(orConditions);
            if (sLogs) sysLogsRaw = sLogs;
        }

        // Paketni audit log
        if (cistiIdovi.length > 0) {
            const { data: aLogs } = await supabase.from('audit_log').select('*').in('zapis_id', cistiIdovi);
            if (aLogs) auditLogsRaw = aLogs;
        }

        const sviLogovi = [
            ...sysLogsRaw.map(l => ({
                id: 'sys_' + l.id,
                created_at: getSortableTime(l.created_at, l.vrijeme, l.datum),
                datum_prikaz: formatirajTacanDatum(l.created_at, l.vrijeme, l.datum),
                korisnik: l.korisnik, akcija: l.akcija, detalji: l.detalji || 'Sistemski zapis.',
                stari_podaci: l.stari_podaci || null, novi_podaci: l.novi_podaci || null, raw: l
            })),
            ...auditLogsRaw.map(l => ({
                id: 'aud_' + l.id,
                created_at: getSortableTime(l.vrijeme, l.created_at, l.datum),
                datum_prikaz: formatirajTacanDatum(l.vrijeme, l.created_at, l.datum),
                korisnik: l.korisnik, akcija: l.akcija, detalji: l.detalji || l.opis || 'Ažuriranje dokumenta.',
                stari_podaci: l.stari_podaci || null, novi_podaci: l.novi_podaci || null, raw: l
            }))
        ];

        const unikatniLogovi = Array.from(new Map(sviLogovi.map(item => [item.id, item])).values());
        const validniLogovi = unikatniLogovi.filter(l => l.created_at > 0);
        dataChain.logovi = validniLogovi.sort((a, b) => a.created_at - b.created_at);

        setForenzika(dataChain);
        setLoading(false);
        setSken(val); 
    };

    const pokreniSkenKucanje = (e) => {
        if (e.key === 'Enter') {
            if (kucanjeTimer) clearTimeout(kucanjeTimer);
            analizirajSve(sken);
            setShowDropdown(false);
        }
    };

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 font-bold animate-in fade-in" style={{ backgroundColor: saas.isEditMode ? '' : saas.ui.boja_pozadine }}>
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-indigo-500" user={user} hideMasina={true} modulIme="forenzika" saas={saas} />

            <div className={`p-8 rounded-box border border-theme-border shadow-2xl text-center relative z-50 transition-colors ${saas.isEditMode ? 'border-dashed border-amber-500 bg-black/20' : 'bg-theme-card backdrop-blur-[var(--glass-blur)]'}`} >
                <h3 className={`${saas.ui.boja_naslova || 'text-indigo-400'} font-black uppercase text-xs mb-4 tracking-widest flex items-center justify-center gap-2`}><span>🕵️‍♂️ FORENZIČKI SKENER / X-RAY DOKUMENTA</span></h3>
                
                {saas.isEditMode && (
                    <div className="bg-black/40 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-center mb-6 border border-amber-500/30">
                        <label className="text-[10px] text-amber-500 uppercase font-black flex items-center gap-2">Boja Kartica: <input type="color" value={saas.ui.boja_kartice || '#1e293b'} onChange={e => saas.setUi({...saas.ui, boja_kartice: e.target.value})} className="w-10 h-10 cursor-pointer rounded border-none bg-transparent" /></label>
                        <label className="text-[10px] text-amber-500 uppercase font-black flex items-center gap-2">Boja Naslova (Tailwind): <input type="text" value={saas.ui.boja_naslova || 'text-indigo-400'} onChange={e => saas.setUi({...saas.ui, boja_naslova: e.target.value})} className="w-40 p-2 bg-theme-card border border-theme-border rounded text-theme-text font-mono shadow-inner" placeholder="text-indigo-400" /></label>
                    </div>
                )}

                <p className="text-[10px] text-slate-500 mb-4 max-w-lg mx-auto">Skeniraj Paket, Radni Nalog, Ponudu, Otpremnicu ili Račun. Algoritam će pretražiti cijelu bazu u oba smjera i rekonstruisati apsolutno cijelo genetsko stablo posla.</p>
                <div className="flex gap-2 max-w-2xl mx-auto relative">
                    <div className="flex-1 relative">
                        <input 
                            type="text" 
                            value={sken} 
                            onChange={(e) => { setSken(e.target.value.toUpperCase()); setShowDropdown(true); }} 
                            onKeyDown={pokreniSkenKucanje}
                            onFocus={()=>setShowDropdown(true)} 
                            placeholder="Skeniraj barkod ili upiši tačan ID (pa stisni ENTER)..." 
                            className="w-full p-5 bg-theme-panel rounded-2xl text-center font-black text-2xl text-theme-text border-2 border-indigo-500/50 uppercase outline-none focus:border-indigo-400 shadow-inner tracking-widest relative z-10" 
                        />
                        
                        {showDropdown && sken && preporuke.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-theme-panel border border-slate-600 rounded-xl shadow-2xl overflow-hidden z-[100] text-left max-h-80 overflow-y-auto">
                                {preporuke.map(p => (
                                    <div key={p.id} onClick={() => { setSken(p.id); analizirajSve(p.id); setShowDropdown(false); }} className="p-4 border-b border-theme-border hover:bg-slate-700 cursor-pointer flex justify-between items-center group">
                                        <div className="flex items-center gap-3">
                                            <span className="text-theme-text font-black">{p.id}</span> 
                                            <span className="text-[9px] text-indigo-400 uppercase font-bold border border-indigo-500/30 px-2 py-0.5 rounded bg-indigo-900/20">{p.tip}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-slate-300 text-xs font-bold">{p.meta}</div>
                                            <div className={`text-[9px] uppercase mt-1 ${p.active ? 'text-emerald-400' : 'text-slate-500'}`}>{p.status}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <button onClick={() => { analizirajSve(sken); setShowDropdown(false); }} className="bg-indigo-600 px-8 rounded-2xl text-theme-text font-black hover:bg-indigo-500 shadow-xl flex items-center gap-2 text-xl transition-all">📷</button>
                </div>
            </div>

            {loading && (
                <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-box animate-spin mb-4"></div>
                    <p className="text-center text-indigo-400 font-black uppercase tracking-widest">Skeniram u oba smjera i dekodiram izmjene...</p>
                </div>
            )}

            {forenzika && !loading && (
                <div className="space-y-6 animate-in slide-in-from-bottom">
                    
                    {/* MAKRO SLIKA - STABLO */}
                    <div className={`p-8 rounded-box border-2 border-theme-border shadow-2xl relative overflow-hidden`} >
                        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
                        <h2 className={`${saas.ui.boja_naslova || 'text-indigo-400'} font-black uppercase text-sm mb-6 ml-4 tracking-widest`}>1. Genetsko stablo posla (Makro pregled)</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 ml-4">
                            <div className={`p-5 rounded-2xl border-2 flex flex-col items-center text-center justify-center transition-all ${forenzika.ponuda ? 'border-pink-500 bg-pink-900/10 shadow-lg' : 'border-theme-border bg-theme-panel/50 text-slate-600'}`}>
                                <span className="text-[10px] uppercase font-black mb-2">Korijen (Ponuda)</span>
                                {forenzika.ponuda ? (
                                    <>
                                        <span className="text-theme-accent font-black text-lg">{forenzika.ponuda.id}</span>
                                        <span className="text-[9px] text-slate-400 mt-2 bg-theme-panel px-2 py-1 rounded border border-theme-border">Kupac: {forenzika.ponuda.kupac_naziv}</span>
                                    </>
                                ) : <span>Nema Ponude</span>}
                            </div>
                            <div className={`p-5 rounded-2xl border-2 flex flex-col items-center text-center justify-center transition-all ${forenzika.nalozi.length>0 ? 'border-purple-500 bg-purple-900/10 shadow-lg' : 'border-theme-border bg-theme-panel/50 text-slate-600'}`}>
                                <span className="text-[10px] uppercase font-black mb-2">Proizvodnja (Radni Nalozi)</span>
                                {forenzika.nalozi.length>0 ? forenzika.nalozi.map(rn => (
                                    <div key={rn.id} className="mb-2">
                                        <span className="text-theme-accent font-black text-base block">{rn.id}</span>
                                        <span className="text-[9px] text-purple-300 uppercase bg-purple-950 px-2 py-0.5 rounded border border-purple-500/20">{rn.status}</span>
                                    </div>
                                )) : <span>Nema Naloga</span>}
                            </div>
                            <div className={`p-5 rounded-2xl border-2 flex flex-col items-center text-center justify-center transition-all ${forenzika.otpremnice.length>0 ? 'border-orange-500 bg-orange-900/10 shadow-lg' : 'border-theme-border bg-theme-panel/50 text-slate-600'}`}>
                                <span className="text-[10px] uppercase font-black mb-2">Isporuka (Otpremnice)</span>
                                {forenzika.otpremnice.length>0 ? forenzika.otpremnice.map(o=><span key={o.id} className="text-theme-accent font-black text-sm my-0.5">{o.id}</span>) : <span>Nema Otpremnice</span>}
                            </div>
                            <div className={`p-5 rounded-2xl border-2 flex flex-col items-center text-center justify-center transition-all ${forenzika.racuni.length>0 ? 'border-emerald-500 bg-emerald-900/10 shadow-lg' : 'border-theme-border bg-theme-panel/50 text-slate-600'}`}>
                                <span className="text-[10px] uppercase font-black mb-2">Naplata (Računi)</span>
                                {forenzika.racuni.length>0 ? forenzika.racuni.map(r=><span key={r.id} className="text-emerald-400 font-black text-sm my-0.5">{r.id}</span>) : <span>Nema Računa</span>}
                            </div>
                        </div>

                        {/* UKUPNI SADRŽAJ PAKETA AKO JE SKENIRAN PAKET */}
                        {forenzika.paketSadrzaj && forenzika.paketSadrzaj.length > 0 && (
                            <div className="mt-8 p-8 bg-theme-panel border border-blue-500/50 rounded-box flex flex-col items-start ml-4 shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-box"></div>
                                <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-center border-b border-theme-border pb-4 mb-5 gap-4 relative z-10">
                                    <div>
                                        <p className="text-[10px] text-theme-accent uppercase font-black bg-blue-900/20 inline-block px-3 py-1 rounded-lg border border-blue-500/30">Skenirani Fokus: Paket</p>
                                        <p className="text-theme-text text-3xl font-black mt-3">{forenzika.paketHistory[0].paket_id}</p>
                                    </div>
                                    <div className="text-left md:text-right w-full md:w-auto bg-emerald-900/10 border border-emerald-500/20 p-4 rounded-2xl">
                                        <p className="text-[10px] text-emerald-400 uppercase font-black mb-1">Trenutno stanje u paketu (Sveukupno)</p>
                                        <p className="text-emerald-400 font-black text-3xl">{forenzika.paketUkupnoM3.toFixed(4)} <span className="text-xs">m³</span></p>
                                    </div>
                                </div>
                                <div className="w-full space-y-2 relative z-10">
                                    <p className="text-[10px] text-slate-400 uppercase font-black mb-3">Svi evidentirani proizvodi u ovom paketu:</p>
                                    {forenzika.paketSadrzaj.map((p, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-sm font-bold bg-theme-card border border-theme-border p-4 rounded-xl shadow-md hover:border-slate-600 transition-all">
                                            <div>
                                                <span className="text-theme-text text-base">{p.naziv} <span className="text-slate-400 text-xs ml-1">({p.debljina}x{p.sirina}x{p.duzina})</span></span>
                                                {p.oznake && p.oznake.length > 0 && <span className="ml-3 text-[9px] bg-blue-900/20 px-2 py-1 rounded text-theme-accent border border-blue-500/30">{p.oznake.join(', ')}</span>}
                                            </div>
                                            <div className="text-right">
                                                <span className="text-emerald-400 font-black text-xl">{p.kolicina_final.toFixed(4)} m³</span>
                                                <span className="text-xs text-slate-500 ml-2">({p.kolicina_ulaz} {p.jm})</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* MIKRO SLIKA PAKETA (Sljedivost materijala) */}
                    {forenzika.paketHistory && forenzika.paketHistory.length > 0 && (
                        <div className={`p-8 rounded-box border border-theme-border shadow-2xl`} >
                            <div className="border-b border-theme-border pb-4 mb-6">
                                <h2 className="text-theme-accent font-black uppercase text-sm tracking-widest flex items-center gap-2"><span>📦 Historija materijala (Odakle je došao, kako se punio i gdje je otišao)</span></h2>
                            </div>

                            {/* ULAZNA SIROVINA */}
                            <div className="mb-8 space-y-3">
                                <h4 className="text-emerald-500 font-black text-xs uppercase flex items-center gap-2">⬅️ 1. Ulazna sirovina (Od čega je nastao)</h4>
                                
                                {forenzika.ulazniTrupci.length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {forenzika.ulazniTrupci.map(t => (
                                            <div key={t.id} className="bg-emerald-900/10 border border-emerald-500/30 p-4 rounded-2xl shadow-inner">
                                                <p className="text-emerald-400 font-black text-xs">Trupac: {t.id}</p>
                                                <p className="text-[9px] text-slate-400 uppercase mt-2 font-bold">{t.vrsta_drveta} | {t.zapremina} m³ | Klasa {t.klasa}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : forenzika.ulazniPaketi.length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {forenzika.ulazniPaketi.map(p => (
                                            <div key={p.paket_id} onClick={() => {setSken(p.paket_id); analizirajSve(p.paket_id); window.scrollTo(0,0);}} className="bg-blue-900/10 border border-blue-500/30 p-4 rounded-2xl cursor-pointer hover:bg-blue-900/30 transition-all shadow-md">
                                                <p className="text-theme-accent font-black text-xs">Iz paketa: {p.paket_id}</p>
                                                <p className="text-[9px] text-slate-400 uppercase mt-2 font-bold">{p.naziv_proizvoda}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500 bg-theme-card p-4 rounded-xl border border-theme-border shadow-inner">Sirovina nije specificirana u bazi podataka.</p>
                                )}
                            </div>

                            {/* KORACI ZIDANJA */}
                            <div className="mb-8 space-y-3">
                                <h4 className="text-theme-accent font-black text-xs uppercase flex items-center gap-2">🧱 2. Hronološko zidanje (Kako se paket punio ili praznio)</h4>
                                {forenzika.paketHistory.map((red, index) => {
                                    const iznos = parseFloat(red.kolicina_final || 0);
                                    const isDodavanje = iznos >= 0;
                                    const predznak = isDodavanje ? '+' : '';
                                    const bojaZnak = isDodavanje ? 'text-emerald-400' : 'text-red-400';
                                    const tekstZnak = isDodavanje ? 'DODATO:' : 'ODUZETO:';
                                    const datumZ = formatirajTacanDatum(red.created_at, red.vrijeme, red.datum);

                                    return (
                                        <div key={index} className="bg-theme-panel p-5 rounded-2xl border border-theme-border flex flex-col md:flex-row justify-between items-start md:items-center shadow-lg hover:border-blue-500/50 transition-all gap-4">
                                            <div className="flex items-start md:items-center gap-4 w-full">
                                                <div className={`w-10 h-10 rounded-box flex items-center justify-center font-black text-sm border-2 shrink-0 shadow-md ${isDodavanje ? 'bg-emerald-900/20 text-emerald-400 border-emerald-500/30' : 'bg-red-900/20 text-red-400 border-red-500/30'}`}>{index + 1}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between w-full">
                                                        <p className="text-theme-text text-base font-black">{tekstZnak} <span className={bojaZnak}>{predznak}{iznos} m³</span> <span className="text-slate-500 text-xs font-bold ml-1">({red.kolicina_ulaz} {red.jm || 'kom'})</span></p>
                                                        <div className="text-right shrink-0 ml-4 hidden md:block">
                                                            <p className="text-[10px] text-slate-500 font-black uppercase bg-black px-3 py-1.5 rounded border border-theme-border">{datumZ}</p>
                                                        </div>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 uppercase mt-2">Proizvod: <span className="text-theme-text font-bold">{red.naziv_proizvoda} ({red.debljina}x{red.sirina}x{red.duzina})</span></p>
                                                    <p className="text-[9px] text-slate-500 uppercase mt-1 border-t border-theme-border/50 pt-2 mt-2">Zabilježio: <span className="text-slate-300 font-bold">{red.snimio_korisnik || 'Nepoznat'}</span> | Mašina: <span className="text-amber-400 font-bold">{red.masina || 'N/A'}</span></p>
                                                </div>
                                            </div>
                                            <div className="text-left w-full border-t border-theme-border/50 pt-3 mt-2 md:hidden">
                                                <span className="text-[10px] text-slate-400 font-black uppercase bg-black px-3 py-1.5 rounded-lg border border-theme-border">{datumZ}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* IZLAZNA PRERADA */}
                            {forenzika.izlazniPaketi.length > 0 && (
                                <div className="space-y-3 pt-6 border-t border-theme-border">
                                    <h4 className="text-theme-accent font-black text-xs uppercase flex items-center gap-2">➡️ 3. Izlazna prerada (U šta je dalje prerađen)</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {forenzika.izlazniPaketi.map(p => (
                                            <div key={p.paket_id} onClick={() => {setSken(p.paket_id); analizirajSve(p.paket_id); window.scrollTo(0,0);}} className="bg-purple-900/10 border border-purple-500/30 p-4 rounded-2xl cursor-pointer hover:bg-purple-900/30 transition-all shadow-md">
                                                <p className="text-theme-accent font-black text-xs">Nastao paket: {p.paket_id}</p>
                                                <p className="text-[9px] text-slate-400 uppercase mt-2 font-bold">{p.naziv_proizvoda}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* FINANSIJSKA ANALIZA I KONTROLA RABATA */}
                    {forenzika.finansijska_analiza.length > 0 && (
                        <div className={`p-8 rounded-box border border-theme-border shadow-2xl`} >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-emerald-400 font-black uppercase text-sm tracking-widest flex items-center gap-2"><span>💸 Finansijski Rendgen (Kontrola cijena)</span></h2>
                                <span className="text-[10px] bg-theme-panel text-slate-400 px-3 py-1 rounded-lg uppercase font-black">Kupac: {forenzika.kupac?.naziv || 'Nepoznat'}</span>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-theme-card text-slate-400 uppercase font-black">
                                        <tr><th className="p-4 rounded-tl-xl">Proizvod</th><th className="p-4 text-right">Količina</th><th className="p-4 text-right">Osnovna Cijena</th><th className="p-4 text-center">Sistemski Rabat (Baza)</th><th className="p-4 text-center">Ukucani Rabat</th><th className="p-4 rounded-tr-xl">Nadzor</th></tr>
                                    </thead>
                                    <tbody className="text-theme-text font-bold">
                                        {forenzika.finansijska_analiza.map((f, i) => (
                                            <tr key={i} className="border-b border-theme-border hover:bg-theme-panel/30">
                                                <td className="p-4">{f.sifra} <span className="text-slate-400 font-normal ml-1">{f.naziv}</span></td>
                                                <td className="p-4 text-right text-theme-accent">{f.kolicina}</td>
                                                <td className="p-4 text-right">{f.cijena_baza} KM</td>
                                                <td className="p-4 text-center text-slate-400">{f.sistemski_rabat}%</td>
                                                <td className="p-4 text-center text-theme-text">{f.primijenjeni_rabat}%</td>
                                                <td className={`p-4 font-black text-[10px] uppercase ${f.odstupanje > 0 ? 'text-red-400 bg-red-900/10' : (f.odstupanje < 0 ? 'text-emerald-400' : 'text-slate-500')}`}>{f.upozorenje}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* MIKRO-FORENZIKA (SVI KLIKOVI - LJUDSKI PRIKAZ) */}
                    <div className={`p-8 rounded-box border border-theme-border shadow-2xl relative`} >
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 sticky top-0 pt-2 pb-4 z-10 border-b border-theme-border gap-4" >
                            <h2 className="text-amber-500 font-black uppercase text-sm tracking-widest flex items-center gap-2"><span>🔬 Skala Izmjena (Apsolutna Hronologija Logova)</span></h2>
                            <span className="text-[10px] bg-theme-panel text-slate-400 px-3 py-1.5 rounded-lg uppercase font-black border border-theme-border shadow-inner">Ukupno zabilježenih događaja: {forenzika.logovi.length}</span>
                        </div>

                        <div className="space-y-4 max-h-[700px] overflow-y-auto pr-4 custom-scrollbar pb-6 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-theme-panel z-0">
                            {forenzika.logovi.length === 0 ? (
                                <p className="text-center text-slate-500 py-10 border-2 border-dashed border-theme-border rounded-box font-bold bg-theme-card/50 relative z-10">Nema zapisa o izmjenama u logu.</p>
                            ) : (
                                forenzika.logovi.map((log) => {
                                    const isOtvoren = otvoreniLogovi.has(log.id);
                                    
                                    return (
                                        <div key={log.id} className="flex gap-4 items-start relative group z-10">
                                            <div className={`w-10 h-10 rounded-box border-4 flex items-center justify-center z-10 shrink-0 shadow-lg text-[12px] transition-all ${isOtvoren ? 'bg-amber-500 text-theme-text border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-theme-panel border-slate-600 group-hover:border-amber-500/50'}`}>🕒</div>
                                            <div 
                                                onClick={() => toggleLog(log.id)} 
                                                className={`p-6 rounded-[1.5rem] flex-1 cursor-pointer transition-all shadow-md border ${isOtvoren ? 'bg-theme-card border-amber-500/50 ring-1 ring-amber-500/20' : 'bg-theme-panel border-theme-border group-hover:border-slate-600'}`}
                                            >
                                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-3 border-b border-theme-border/80 pb-3 gap-3">
                                                    <p className={`text-sm font-black uppercase tracking-widest ${log.akcija.includes('IZMJEN') || log.akcija.includes('BRISANJ') ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                        {log.akcija.replace('PAKET_AKCIJA:', '')}
                                                    </p>
                                                    <p className="text-[10px] text-slate-300 font-black uppercase bg-black px-4 py-2 rounded-xl border border-theme-border shadow-inner tracking-widest">
                                                        {log.datum_prikaz} <span className="text-slate-600 mx-2">|</span> 👤 <span className="text-theme-text">{log.korisnik || 'Sistem'}</span>
                                                    </p>
                                                </div>
                                                
                                                {/* Prevedeni, jasan prikaz izmjena */}
                                                <PrikazIzmjena log={log} />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}