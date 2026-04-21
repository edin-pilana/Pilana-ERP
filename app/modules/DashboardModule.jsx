"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { Card, Text, Metric, Flex, Badge, Grid, Divider } from '@tremor/react';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import PilanaIzvjestaj from '../components/PilanaIzvjestaj';
import PilanaPeriodIzvjestaj from '../components/PilanaPeriodIzvjestaj';
import { useSaaS } from '../utils/useSaaS';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Pomoćne funkcije (Neprobojne)
const fmtBS = (iso) => {
    if(!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}.`;
};
  
const imaSirovinu = (val) => {
    if (!val) return false;
    if (Array.isArray(val) && val.length > 0) return true;
    if (typeof val === 'string') {
        const clean = val.replace(/[{}"[\]\s]/g, '');
        return clean.length > 0;
    }
    return false;
};
  
const getSirovineNiz = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') return val.replace(/[{}"[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean);
    return [];
};

export default function DashboardModule({ user, onExit }) {
    // === SaaS KONTROLE ===
    const saas = useSaaS('dashboard_analitika', {
        boja_pozadine: '#090e17',
        boja_kartice: '#111827',
        boja_akcenta_pilana: '#10b981', // Emerald
        boja_akcenta_dorada: '#3b82f6', // Blue
        boja_akcenta_finansije: '#f59e0b', // Amber
    });

    const danasnjiDatum = new Date().toISOString().split('T')[0];
    const [activeTab, setActiveTab] = useState('pilana');
    const [tipDatuma, setTipDatuma] = useState('dan'); 
    const [datumOd, setDatumOd] = useState(danasnjiDatum);
    const [datumDo, setDatumDo] = useState(danasnjiDatum);
    const [isPeriodic, setIsPeriodic] = useState(false);
    
    const [dostupnaMjesta, setDostupnaMjesta] = useState([]);
    const [filterMjesto, setFilterMjesto] = useState('SVE');
    const [filterSmjena, setFilterSmjena] = useState('SVE');
  
    const [loading, setLoading] = useState(true);
  
    // FULL STATE OBJEKTI
    const [pilanaData, setPilanaData] = useState({ kpi: { ulaz_m3: 0, ulaz_kom: 0, avg_d: 0, izlaz_m3: 0, yield_proc: 0, trend_7d_proc: 0, trend_30d_proc: 0 }, trupci_duzine: [], izlaz_struktura: [], ucinak_brentista: [], trend_7d: [], trend_30d: [], glavna_tabela: [], zastoji: [], posada: '', trend_godisnji: [] });
    const [doradaData, setDoradaData] = useState({ kpi: { ulaz_m3: 0, izlaz_m3: 0, kalo_m3: 0, yield_proc: 0, trend_7d_proc: 0, operacije_count: 0 }, operacije: [], trend_7d: [], trace_blokovi: [], yieldChart: [] });
    const [finansijeKPI, setFinansijeKPI] = useState({ ukupnoFakturisano: 0, naplacenoGotovina: 0, naplacenoVirman: 0, nenaplacenoDug: 0, ocekivaniPDV: 0 });
    const [strukturaNaplate, setStrukturaNaplate] = useState([]);
    const [topDuznici, setTopDuznici] = useState([]);
  
    useEffect(() => { ucitajAnalitiku(); }, [datumOd, datumDo, isPeriodic, filterMjesto, filterSmjena]);
  
    const setBrziDatum = (tip) => {
      const danas = new Date();
      setTipDatuma('period'); setIsPeriodic(true);
      if (tip === '7d') { setDatumOd(new Date(danas.getTime() - 6*24*60*60*1000).toISOString().split('T')[0]); setDatumDo(danasnjiDatum); } 
      else if (tip === 'mjesec') { setDatumOd(new Date(danas.getFullYear(), danas.getMonth(), 1).toISOString().split('T')[0]); setDatumDo(new Date(danas.getFullYear(), danas.getMonth() + 1, 0).toISOString().split('T')[0]); } 
      else if (tip === 'prosli_mjesec') { setDatumOd(new Date(danas.getFullYear(), danas.getMonth() - 1, 1).toISOString().split('T')[0]); setDatumDo(new Date(danas.getFullYear(), danas.getMonth(), 0).toISOString().split('T')[0]); }
    };
  
    const shiftDate = (n) => { const d = new Date(datumOd); d.setDate(d.getDate()+n); const iso = d.toISOString().split('T')[0]; setDatumOd(iso); setDatumDo(iso); };
  
    const provjeriSmjenu = (vrijemeStr) => {
        if (filterSmjena === 'SVE' || !vrijemeStr) return true;
        const hour = parseInt(vrijemeStr.substring(0, 2));
        if (filterSmjena === '1' && hour >= 7 && hour < 15) return true;
        if (filterSmjena === '2' && hour >= 15 && hour < 23) return true;
        if (filterSmjena === '3' && (hour >= 23 || hour < 7)) return true;
        return false;
    };
  
    const ucitajAnalitiku = async () => {
      setLoading(true);
      try {
        const d60 = new Date(new Date(datumOd).getTime() - 60*24*60*60*1000).toISOString().split('T')[0];
        const d395 = new Date(new Date(datumOd).getTime() - 395*24*60*60*1000).toISOString().split('T')[0];
        
        const [tRes, pRes, plRes, dnRes, p395Res, ponRes, rnRes, otpRes, racRes, blaRes] = await Promise.all([
          supabase.from('trupci').select('*').gte('datum_prijema', d60).lte('datum_prijema', datumDo),
          supabase.from('paketi').select('*').gte('datum_yyyy_mm', d60).lte('datum_yyyy_mm', datumDo),
          supabase.from('prorez_log').select('*').gte('datum', d60).lte('datum', datumDo),
          supabase.from('dnevnik_masine').select('*').gte('datum', datumOd).lte('datum', datumDo),
          supabase.from('paketi').select('datum_yyyy_mm, kolicina_final, ai_sirovina_ids, brentista').gte('datum_yyyy_mm', d395).lte('datum_yyyy_mm', datumDo),
          supabase.from('ponude').select('*').gte('datum', datumOd).lte('datum', datumDo),
          supabase.from('radni_nalozi').select('*').gte('datum', datumOd).lte('datum', datumDo),
          supabase.from('otpremnice').select('*').gte('datum', datumOd).lte('datum', datumDo),
          supabase.from('racuni').select('*').gte('datum', datumOd).lte('datum', datumDo),
          supabase.from('blagajna').select('*').gte('datum', datumOd).lte('datum', datumDo)
        ]);

        const svaMjesta = [...new Set([...(plRes.data || []).map(x => x.mjesto), ...(pRes.data || []).map(x => x.mjesto)])].filter(Boolean);
        if (svaMjesta.length > 0) setDostupnaMjesta(svaMjesta);

        // ==========================================
        // 1. PILANA (Zadržana sva duboka logika)
        // ==========================================
        const logSve = plRes.data?.filter(pl => pl.datum >= datumOd && pl.datum <= datumDo && (filterMjesto === 'SVE' || pl.mjesto === filterMjesto) && provjeriSmjenu(pl.vrijeme_unosa)) || [];
        const paketiSvi = pRes.data?.filter(p => p.datum_yyyy_mm >= datumOd && p.datum_yyyy_mm <= datumDo && !imaSirovinu(p.ai_sirovina_ids) && (filterMjesto === 'SVE' || p.mjesto === filterMjesto) && provjeriSmjenu(p.vrijeme_tekst)) || [];

        let p_ulaz_m3 = 0; let p_ulaz_kom = 0;
        const duzineMap = {}; const radniciStats = {};

        logSve.forEach(log => {
            const trupac = tRes.data?.find(t => t.id === log.trupac_id);
            if (trupac) {
                const m3 = parseFloat(trupac.zapremina || 0);
                p_ulaz_m3 += m3; p_ulaz_kom++;
                const d = parseFloat(trupac.duzina || 0).toFixed(1);
                duzineMap[d] = (duzineMap[d] || { kom: 0, m3: 0 });
                duzineMap[d].kom++; duzineMap[d].m3 += parseFloat(m3.toFixed(2));
                const b = log.brentista || 'Nepoznat';
                if (!radniciStats[b]) radniciStats[b] = { ime: b, ulaz_m3: 0, izlaz_m3: 0 };
                radniciStats[b].ulaz_m3 += m3;
            }
        });

        let p_izlaz_m3 = 0;
        const izlazStrukturaMap = {}; const dinamikaMap = {}; const ulazStrukturaMap = {};

        logSve.forEach(log => {
            const trupac = tRes.data?.find(t => t.id === log.trupac_id);
            if (trupac) {
               const vrsta = trupac.vrsta || 'Ostalo';
               ulazStrukturaMap[vrsta] = (ulazStrukturaMap[vrsta] || { kom: 0, m3: 0 });
               ulazStrukturaMap[vrsta].kom++; ulazStrukturaMap[vrsta].m3 += parseFloat(trupac.zapremina || 0);
            }
        });

        paketiSvi.forEach(p => {
            const m3 = parseFloat(p.kolicina_final || 0);
            p_izlaz_m3 += m3;
            izlazStrukturaMap[p.naziv_proizvoda] = (izlazStrukturaMap[p.naziv_proizvoda] || 0) + m3;
            dinamikaMap[p.datum_yyyy_mm] = (dinamikaMap[p.datum_yyyy_mm] || 0) + m3;
            const b = p.brentista || 'Nepoznat';
            if (radniciStats[b]) radniciStats[b].izlaz_m3 += m3;
        });

        const leaderboard = Object.values(radniciStats).map(r => ({
            ...r, izlaz_m3: r.izlaz_m3.toFixed(2),
            yield_proc: r.ulaz_m3 > 0 ? ((r.izlaz_m3 / r.ulaz_m3) * 100).toFixed(1) : 0,
            udio_firme: p_izlaz_m3 > 0 ? ((r.izlaz_m3 / p_izlaz_m3) * 100).toFixed(1) : 0
        })).sort((a, b) => b.izlaz_m3 - a.izlaz_m3);

        const zastojiMap = {};
        (dnRes.data || []).filter(d => (d.modul === 'Prorez' || d.modul === 'Pilana') && (filterMjesto === 'SVE' || d.masina?.includes(filterMjesto)))
        .forEach(z => { const r = z.napomena || 'Ostalo'; zastojiMap[r] = (zastojiMap[r] || 0) + (parseInt(z.zastoj_min) || 0); });
        const zastojiAnaliza = Object.keys(zastojiMap).map(r => ({ razlog: r, minute: zastojiMap[r] })).sort((a,b) => b.minute - a.minute).slice(0, 5);

        const dinamikaChart = Object.keys(dinamikaMap).sort().map(d => ({ dan: d.substring(8, 10) + '.' + d.substring(5, 7), m3: parseFloat(dinamikaMap[d].toFixed(2)) }));
        const ulazStrukturaArr = Object.keys(ulazStrukturaMap).map(k => ({ vrsta: k, kom: ulazStrukturaMap[k].kom, m3: parseFloat(ulazStrukturaMap[k].m3.toFixed(2)) })).sort((a,b) => b.m3 - a.m3);
        const ukupniIzlazStruktura = Object.keys(izlazStrukturaMap).map(k => ({ name: k, value: parseFloat(izlazStrukturaMap[k].toFixed(2)), proc: p_izlaz_m3 > 0 ? ((izlazStrukturaMap[k] / p_izlaz_m3) * 100).toFixed(1) : 0 }));
        const brojDana = isPeriodic ? (new Set(paketiSvi.map(p => p.datum_yyyy_mm)).size || 1) : 1;
        const glavniBrentista = Object.keys(radniciStats).sort((a,b) => radniciStats[b].izlaz_m3 - radniciStats[a].izlaz_m3)[0] || 'Nepoznat';
        
        const trend_godisnji = [];
        const imenaMjeseci = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];
        const odabraniDatumObj = new Date(datumOd);

        for (let i = 12; i >= 0; i--) {
            const d = new Date(odabraniDatumObj.getFullYear(), odabraniDatumObj.getMonth() - i, 1);
            const targetMj = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const paketiUMjesecu = (p395Res.data || []).filter(p => p.datum_yyyy_mm?.startsWith(targetMj) && !imaSirovinu(p.ai_sirovina_ids));
            const paketiBrentiste = paketiUMjesecu.filter(p => p.brentista === glavniBrentista);
            const ukupnoPilana = paketiUMjesecu.reduce((s, p) => s + parseFloat(p.kolicina_final || 0), 0);
            const ukupnoBrentista = paketiBrentiste.reduce((s, p) => s + parseFloat(p.kolicina_final || 0), 0);
            const radniDaniPilana = new Set(paketiUMjesecu.map(p => p.datum_yyyy_mm)).size || 1;
            const radniDaniBrentista = new Set(paketiBrentiste.map(p => p.datum_yyyy_mm)).size || 1;

            trend_godisnji.push({ name: `${imenaMjeseci[d.getMonth()]} ${String(d.getFullYear()).substring(2)}`, Pilana: parseFloat((ukupnoPilana / radniDaniPilana).toFixed(1)), Brentista: parseFloat((ukupnoBrentista / radniDaniBrentista).toFixed(1)) });
        }

        setPilanaData({
            kpi: { ulaz_m3: p_ulaz_m3.toFixed(2), ulaz_kom: p_ulaz_kom, izlaz_m3: p_izlaz_m3.toFixed(2), yield_proc: p_ulaz_m3 > 0 ? ((p_izlaz_m3 / p_ulaz_m3) * 100).toFixed(1) : 0, dnevni_prosjek: (p_izlaz_m3 / brojDana).toFixed(1) },
            trupci_duzine: Object.keys(duzineMap).map(d => ({ duzina: d, kom: duzineMap[d].kom, m3: duzineMap[d].m3.toFixed(2) })).sort((a,b)=>b.duzina-a.duzina),
            izlaz_struktura: ukupniIzlazStruktura, ulaz_struktura: ulazStrukturaArr,
            glavna_tabela: paketiSvi.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)),
            leaderboard, zastoji: dnRes.data || [], zastoji_analiza: zastojiAnaliza, dinamika: dinamikaChart,
            posada: leaderboard.map(l => l.ime).join(', '), trend_godisnji: trend_godisnji, glavni_brentista: glavniBrentista
        });

        // ==========================================
        // 2. DORADA (Detaljan obračun i Kalo)
        // ==========================================
        const paketiDoradaTrenutno = pRes.data?.filter(p => {
          if (p.datum_yyyy_mm < datumOd || p.datum_yyyy_mm > datumDo) return false;
          if (!imaSirovinu(p.ai_sirovina_ids)) return false; 
          if (filterMjesto !== 'SVE' && p.mjesto !== filterMjesto) return false;
          if (!provjeriSmjenu(p.vrijeme_tekst)) return false;
          return true;
        }) || [];
  
        let d_ulaz_m3 = 0; let d_izlaz_m3 = 0; const operacijeMap = {}; const traceBlokovi = [];
        const globalProductYieldMap = {}; 
        const svaDorada60d = pRes.data?.filter(p => imaSirovinu(p.ai_sirovina_ids)) || [];
        
        svaDorada60d.forEach(p => { 
            const u = parseFloat(p.kolicina_ulaz || p.kolicina_final || 0); 
            const i = parseFloat(p.kolicina_final || 0); 
            if(!globalProductYieldMap[p.naziv_proizvoda]) globalProductYieldMap[p.naziv_proizvoda] = { u: 0, i: 0 }; 
            globalProductYieldMap[p.naziv_proizvoda].u += u; 
            globalProductYieldMap[p.naziv_proizvoda].i += i; 
        });
  
        paketiDoradaTrenutno.forEach(p => {
            const izlaz = parseFloat(p.kolicina_final || 0); 
            const ulaz = parseFloat(p.kolicina_ulaz || izlaz); 
            d_izlaz_m3 += izlaz; d_ulaz_m3 += ulaz;
            if(p.oznake && Array.isArray(p.oznake)) p.oznake.forEach(o => { operacijeMap[o] = (operacijeMap[o] || 0) + izlaz; });
  
            let sirovineTekst = []; const idsSirovine = getSirovineNiz(p.ai_sirovina_ids);
            if (idsSirovine.length > 0) {
                idsSirovine.forEach(id => {
                    const orig = pRes.data?.find(r => r.paket_id === id);
                    if (orig) { const ostalo = parseFloat(orig.kolicina_final || 0); sirovineTekst.push(`Paket ${orig.paket_id} (${orig.naziv_proizvoda} ${orig.debljina}x${orig.sirina}x${orig.duzina}) ${ostalo > 0 ? `| Preostalo: ${ostalo}m³` : '| Utrošen'}`); } else sirovineTekst.push(`Paket ${id}`);
                });
            }
  
            const currYield = ulaz > 0 ? ((izlaz / ulaz) * 100).toFixed(1) : 100;
            const avg60d = globalProductYieldMap[p.naziv_proizvoda]?.u > 0 ? ((globalProductYieldMap[p.naziv_proizvoda].i / globalProductYieldMap[p.naziv_proizvoda].u) * 100).toFixed(1) : '-';
            const brzinaM3h = (paketiDoradaTrenutno.reduce((s, dPkg) => s + parseFloat(dPkg.kolicina_final||0), 0) / 8).toFixed(2);
  
            traceBlokovi.push({ out_id: p.paket_id, out_naziv: p.naziv_proizvoda, out_dim: `${p.debljina}x${p.sirina}x${p.duzina}`, out_m3: izlaz.toFixed(2), in_m3: ulaz.toFixed(2), in_ids: sirovineTekst.join(' \n '), operacije: p.oznake ? p.oznake.join(', ') : 'Prerada', yield: currYield, avg_60d: avg60d, brzina: brzinaM3h, radnik: p.snimio_korisnik, vrijeme: p.vrijeme_tekst, masina: p.masina || '-' });
        });

        // Novi grafikon specifičan za Dorada Yield
        const chartDoradaYield = Object.keys(globalProductYieldMap).map(naziv => ({
            name: naziv,
            Yield: ((globalProductYieldMap[naziv].i / globalProductYieldMap[naziv].u) * 100).toFixed(1)
        })).filter(x => x.Yield > 0).sort((a,b) => b.Yield - a.Yield).slice(0, 10); // Top 10
  
        setDoradaData({ 
            kpi: { ulaz_m3: d_ulaz_m3.toFixed(2), izlaz_m3: d_izlaz_m3.toFixed(2), kalo_m3: (d_ulaz_m3 - d_izlaz_m3).toFixed(2), yield_proc: d_ulaz_m3 > 0 ? ((d_izlaz_m3 / d_ulaz_m3) * 100).toFixed(1) : 0, operacije_count: paketiDoradaTrenutno.length }, 
            operacije: Object.keys(operacijeMap).map(k => ({ name: k, value: parseFloat(operacijeMap[k].toFixed(2)) })).sort((a,b)=>b.value-a.value), 
            yieldChart: chartDoradaYield,
            trace_blokovi: traceBlokovi.sort((a,b) => b.out_m3 - a.out_m3) 
        });

        // ==========================================
        // 3. FINANSIJE
        // ==========================================
        const racuni = racRes.data || [];
        let fGotovina = 0; let fVirman = 0; let fDug = 0; let fPdv = 0;
        let kupciDugovanja = {};

        racuni.forEach(r => {
            fPdv += (r.ukupno_sa_pdv - r.ukupno_bez_pdv);
            if (r.status.includes('NAPLAĆENO')) {
                if (r.nacin_placanja === 'Gotovina') fGotovina += r.ukupno_sa_pdv;
                else fVirman += r.ukupno_sa_pdv;
            } else {
                fDug += r.ukupno_sa_pdv;
                kupciDugovanja[r.kupac_naziv] = (kupciDugovanja[r.kupac_naziv] || 0) + r.ukupno_sa_pdv;
            }
        });

        setFinansijeKPI({ ukupnoFakturisano: fGotovina + fVirman + fDug, naplacenoGotovina: fGotovina, naplacenoVirman: fVirman, nenaplacenoDug: fDug, ocekivaniPDV: fPdv });
        setTopDuznici(Object.keys(kupciDugovanja).map(k => ({ name: k, dug: parseFloat(kupciDugovanja[k].toFixed(2)) })).sort((a,b) => b.dug - a.dug).slice(0,5));
        setStrukturaNaplate([ { name: 'Gotovina (Kasa)', value: parseFloat(fGotovina.toFixed(2)) }, { name: 'Virman (Banka)', value: parseFloat(fVirman.toFixed(2)) }, { name: 'Nenaplaćeno (Dug)', value: parseFloat(fDug.toFixed(2)) } ]);

      } catch (e) { console.error("Greška u analitici:", e); }
      setLoading(false);
    };

    // Paleta za PieCharts
    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  
    return (
      <div className="min-h-screen text-slate-300 font-sans p-4 md:p-8 pb-24 print:bg-white print:p-0 transition-colors duration-500" style={{ backgroundColor: saas.ui.boja_pozadine }}>
        
        {/* GLAVNI HEADER */}
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center p-4 rounded-2xl shadow-xl mb-6 gap-4 border transition-colors duration-500 print:hidden" style={{ backgroundColor: saas.ui.boja_kartice, borderColor: saas.isEditMode ? saas.ui.boja_akcenta_pilana : '#1e293b' }}>
          <div className="flex items-center gap-6 overflow-x-auto">
            <h1 className="text-white font-black text-2xl tracking-tighter hidden md:block">TTM<span style={{ color: saas.ui.boja_akcenta_pilana }}>.ERP</span></h1>
            <nav className="flex gap-2 bg-black/20 p-1.5 rounded-xl border border-white/5 overflow-x-auto whitespace-nowrap shadow-inner">
              {['pilana', 'dorada', 'finansije'].map(t => (
                <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase transition-all ${activeTab === t ? 'text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`} style={{ backgroundColor: activeTab === t ? (t === 'pilana' ? saas.ui.boja_akcenta_pilana : t === 'dorada' ? saas.ui.boja_akcenta_dorada : saas.ui.boja_akcenta_finansije) : 'transparent' }}>
                    {t}
                </button>
              ))}
            </nav>
          </div>
  
          <div className="flex flex-col md:flex-row items-center gap-4">
            {/* KONTROLA DATUMA I FILTERA - Netaknuta stara moćna logika */}
            <Flex className="bg-black/20 p-1.5 rounded-xl border border-white/5 gap-1 w-full md:w-auto justify-center shadow-inner">
              <button onClick={() => { setTipDatuma('dan'); setIsPeriodic(false); setDatumDo(datumOd); }} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${!isPeriodic?'bg-slate-700 text-white':'text-slate-500 hover:text-white'}`}>Dnevni</button>
              <button onClick={() => { setTipDatuma('period'); setIsPeriodic(true); }} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${isPeriodic?'bg-slate-700 text-white':'text-slate-500 hover:text-white'}`}>Period</button>
            </Flex>
  
            <Flex className="bg-black/20 p-1.5 rounded-xl border border-white/5 gap-2 w-full md:w-auto justify-center flex-wrap shadow-inner">
              {!isPeriodic ? (
                <>
                  <button onClick={()=>shiftDate(-1)} className="w-8 h-8 bg-slate-800 rounded hover:bg-slate-600 font-black text-white flex items-center justify-center transition-all"><ChevronLeft size={16}/></button>
                  <div className="flex items-center justify-center bg-slate-900 px-3 py-1.5 rounded border border-slate-700 h-8 hover:border-slate-500 transition-all">
                    <input type="date" value={datumOd} onChange={e=>{setDatumOd(e.target.value); setDatumDo(e.target.value);}} className="bg-transparent text-slate-300 font-bold text-sm tracking-widest outline-none cursor-pointer uppercase [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:invert" />
                  </div>
                  <button onClick={()=>shiftDate(1)} className="w-8 h-8 bg-slate-800 rounded hover:bg-slate-600 font-black text-white flex items-center justify-center transition-all"><ChevronRight size={16}/></button>
                </>
              ) : (
                <>
                  <div className="flex items-center bg-slate-900 rounded border border-slate-700 px-2 hover:border-slate-500 transition-all">
                    <input type="date" value={datumOd} onChange={e=>setDatumOd(e.target.value)} className="bg-transparent text-slate-300 font-bold text-xs tracking-widest outline-none cursor-pointer h-8 uppercase [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:invert" />
                  </div>
                  <span className="text-slate-600 font-black">-</span>
                  <div className="flex items-center bg-slate-900 rounded border border-slate-700 px-2 hover:border-slate-500 transition-all">
                    <input type="date" value={datumDo} onChange={e=>setDatumDo(e.target.value)} className="bg-transparent text-slate-300 font-bold text-xs tracking-widest outline-none cursor-pointer h-8 uppercase [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:invert" />
                  </div>
                  <div className="flex gap-1 ml-2 border-l border-slate-800 pl-2 items-center">
                    <button onClick={()=>setBrziDatum('7d')} className="px-2 py-1.5 h-8 bg-slate-800 hover:bg-slate-600 hover:text-white rounded text-[9px] font-black uppercase text-slate-300 transition-colors shadow">7 Dana</button>
                    <button onClick={()=>setBrziDatum('mjesec')} className="px-2 py-1.5 h-8 bg-slate-800 hover:bg-slate-600 hover:text-white rounded text-[9px] font-black uppercase text-slate-300 transition-colors shadow">Ovaj Mj</button>
                  </div>
                </>
              )}
            </Flex>

            {/* SAAS KONTROLE */}
            {user?.uloga === 'superadmin' && (
                saas.isEditMode ? (
                    <div className="flex gap-2">
                        <button onClick={saas.odustani} className="px-3 py-2 bg-red-900/40 text-red-400 border border-red-500/50 rounded-xl text-[9px] font-black uppercase hover:bg-red-500 hover:text-white transition-all shadow-md">✕ Odustani</button>
                        <button onClick={saas.spasiDizajn} className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:bg-emerald-500 transition-all">💾 Spasi Dizajn</button>
                    </div>
                ) : (
                    <button onClick={saas.pokreniEdit} className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded-xl text-[9px] font-black uppercase hover:bg-amber-500 hover:text-white transition-all shadow-md">
                        <Settings size={14} /> Uredi Izgled
                    </button>
                )
            )}
            <button onClick={onExit} className="bg-slate-800 text-slate-400 hover:bg-red-500 hover:text-white px-5 h-10 rounded-xl text-[10px] font-black uppercase border border-slate-700 transition-all shadow-md">Izlaz</button>
          </div>
        </div>

        {/* SAAS EDITOR OVERLAY */}
        {saas.isEditMode && (
            <div className="max-w-[1600px] mx-auto mb-6 bg-black/40 p-4 rounded-2xl flex flex-wrap gap-4 items-center border border-amber-500/30 shadow-2xl">
                <label className="text-[10px] text-amber-500 uppercase font-black flex items-center gap-2">Boja Pozadine: <input type="color" value={saas.ui.boja_pozadine} onChange={e => saas.setUi({...saas.ui, boja_pozadine: e.target.value})} className="w-8 h-8 cursor-pointer rounded border-none bg-transparent" /></label>
                <label className="text-[10px] text-amber-500 uppercase font-black flex items-center gap-2">Boja Kartica: <input type="color" value={saas.ui.boja_kartice} onChange={e => saas.setUi({...saas.ui, boja_kartice: e.target.value})} className="w-8 h-8 cursor-pointer rounded border-none bg-transparent" /></label>
                <label className="text-[10px] text-amber-500 uppercase font-black flex items-center gap-2">Akcent Pilana: <input type="color" value={saas.ui.boja_akcenta_pilana} onChange={e => saas.setUi({...saas.ui, boja_akcenta_pilana: e.target.value})} className="w-8 h-8 cursor-pointer rounded border-none bg-transparent" /></label>
                <label className="text-[10px] text-amber-500 uppercase font-black flex items-center gap-2">Akcent Dorada: <input type="color" value={saas.ui.boja_akcenta_dorada} onChange={e => saas.setUi({...saas.ui, boja_akcenta_dorada: e.target.value})} className="w-8 h-8 cursor-pointer rounded border-none bg-transparent" /></label>
                <label className="text-[10px] text-amber-500 uppercase font-black flex items-center gap-2">Akcent Finansije: <input type="color" value={saas.ui.boja_akcenta_finansije} onChange={e => saas.setUi({...saas.ui, boja_akcenta_finansije: e.target.value})} className="w-8 h-8 cursor-pointer rounded border-none bg-transparent" /></label>
            </div>
        )}

        {/* LOKACIJA I SMJENA FILTERI ZA PROIZVODNJU */}
        {(activeTab === 'pilana' || activeTab === 'dorada') && (
            <div className="max-w-[1600px] mx-auto flex gap-4 mb-6 print:hidden">
               <div className="flex flex-col">
                   <span className="text-[10px] text-slate-500 uppercase font-bold ml-1 mb-1">Lokacija / Mjesto</span>
                   <select value={filterMjesto} onChange={e => setFilterMjesto(e.target.value)} className="text-white p-3 rounded-xl text-xs font-bold border border-slate-700 outline-none shadow-inner" style={{ backgroundColor: saas.ui.boja_kartice }}>
                       <option value="SVE">Sva Mjesta</option>
                       {dostupnaMjesta.map(m => <option key={m} value={m}>{m}</option>)}
                   </select>
               </div>
               <div className="flex flex-col">
                   <span className="text-[10px] text-slate-500 uppercase font-bold ml-1 mb-1">Smjena (Vrijeme)</span>
                   <select value={filterSmjena} onChange={e => setFilterSmjena(e.target.value)} className="text-white p-3 rounded-xl text-xs font-bold border border-slate-700 outline-none shadow-inner" style={{ backgroundColor: saas.ui.boja_kartice }}>
                       <option value="SVE">Sve Smjene (00-24h)</option>
                       <option value="1">1. Smjena (07-15h)</option>
                       <option value="2">2. Smjena (15-23h)</option>
                       <option value="3">3. Smjena (23-07h)</option>
                   </select>
               </div>
            </div>
        )}
  
        {loading ? ( <div className="text-center p-20 animate-pulse text-white font-black tracking-widest uppercase text-xl">Dekodiranje Baze Podataka...</div> ) : (
          <div className="max-w-[1600px] mx-auto space-y-6">
            
            {/* ==================================== */}
            {/* 1. PILANA TAB                        */}
            {/* ==================================== */}
            {activeTab === 'pilana' && (
              <div className="animate-in fade-in space-y-6">
                 {isPeriodic ? (
                    <PilanaPeriodIzvjestaj data={pilanaData} datumOd={datumOd} datumDo={datumDo} lokacija={filterMjesto} brentistaFilter="SVI" />
                 ) : (
                    <PilanaIzvjestaj data={pilanaData} datum={datumOd} lokacija={filterMjesto} smjena={filterSmjena} />
                 )}
              </div>
            )}

            {/* ==================================== */}
            {/* 2. DORADA TAB (NOVO I MOĆNO)         */}
            {/* ==================================== */}
            {activeTab === 'dorada' && (
                <div className="animate-in fade-in space-y-6">
                    <Grid numItemsMd={2} numItemsLg={4} className="gap-6">
                        <Card decoration="top" className="border-slate-800 shadow-xl" style={{ backgroundColor: saas.ui.boja_kartice, decorationColor: saas.ui.boja_akcenta_dorada }}>
                            <Text className="text-slate-400 uppercase text-[10px] font-black">Ulaz Sirovina</Text>
                            <Metric className="text-white">{doradaData.kpi.ulaz_m3} m³</Metric>
                            <Text className="text-slate-500 text-xs mt-2">Zapremina primljenih paketa</Text>
                        </Card>
                        <Card decoration="top" className="border-slate-800 shadow-xl" style={{ backgroundColor: saas.ui.boja_kartice, decorationColor: saas.ui.boja_akcenta_dorada }}>
                            <Text className="text-slate-400 uppercase text-[10px] font-black">Izlaz Gotove Robe</Text>
                            <Metric className="text-white">{doradaData.kpi.izlaz_m3} m³</Metric>
                            <Text className="text-slate-500 text-xs mt-2">Novi paketi nakon dorade</Text>
                        </Card>
                        <Card decoration="top" decorationColor="red" className="border-slate-800 shadow-xl" style={{ backgroundColor: saas.ui.boja_kartice }}>
                            <Text className="text-slate-400 uppercase text-[10px] font-black">Stvarni Kalo (Otpad)</Text>
                            <Metric className="text-red-400">{doradaData.kpi.kalo_m3} m³</Metric>
                            <Text className="text-slate-500 text-xs mt-2">Gubitak pri obradi</Text>
                        </Card>
                        <Card decoration="top" className="border-slate-800 shadow-xl" style={{ backgroundColor: saas.ui.boja_kartice, decorationColor: saas.ui.boja_akcenta_dorada }}>
                            <Text className="text-slate-400 uppercase text-[10px] font-black">Efikasnost Konverzije (Yield)</Text>
                            <Metric className="text-white">{doradaData.kpi.yield_proc} %</Metric>
                            <Badge color="blue" className="mt-2">Evidentirano operacija: {doradaData.kpi.operacije_count}</Badge>
                        </Card>
                    </Grid>

                    <Grid numItemsMd={1} numItemsLg={2} className="gap-6">
                        <Card className="border-slate-800 shadow-xl h-[400px]" style={{ backgroundColor: saas.ui.boja_kartice }}>
                            <Text className="text-slate-400 uppercase text-[10px] font-black mb-6">Prinos (Yield %) po proizvedenom artiklu</Text>
                            <ResponsiveContainer width="100%" height="85%">
                                <BarChart data={doradaData.yieldChart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} unit="%" />
                                    <RechartsTooltip contentStyle={{backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '10px'}} itemStyle={{color: '#fff'}} />
                                    <Bar dataKey="Yield" fill={saas.ui.boja_akcenta_dorada} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Card>

                        <Card className="border-slate-800 shadow-xl h-[400px]" style={{ backgroundColor: saas.ui.boja_kartice }}>
                            <Text className="text-slate-400 uppercase text-[10px] font-black mb-2">Raspodjela Operacija (m³ prerađeno kroz oznake)</Text>
                            {doradaData.operacije.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-slate-500 text-sm">Nema zabilježenih specifičnih operacija (okrajčivanje, kraćenje...)</div>
                            ) : (
                                <ResponsiveContainer width="100%" height="90%">
                                    <PieChart>
                                        <Pie data={doradaData.operacije} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none">
                                            {doradaData.operacije.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                        </Pie>
                                        <RechartsTooltip contentStyle={{backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '10px'}} formatter={(value) => `${value} m³`} />
                                        <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </Card>
                    </Grid>

                    {/* SLJEDIVOST TABELA */}
                    <Card className="border-slate-800 shadow-xl" style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <Text className="text-slate-400 uppercase text-[10px] font-black mb-4">Forenzička Sljedivost (Traceability) - Odakle je proizvod nastao</Text>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-[11px]">
                                <thead className="bg-black/20 text-slate-400 uppercase font-black">
                                    <tr>
                                        <th className="p-3 rounded-tl-lg">Novi Paket (Izlaz)</th>
                                        <th className="p-3 text-center">Final m³</th>
                                        <th className="p-3 text-center border-l border-slate-700">Ulaz m³</th>
                                        <th className="p-3">Korištena Sirovina (Paketi ulaza)</th>
                                        <th className="p-3 text-center border-l border-slate-700">Yield</th>
                                        <th className="p-3">Operacije</th>
                                        <th className="p-3 rounded-tr-lg">Radnik / Vrijeme</th>
                                    </tr>
                                </thead>
                                <tbody className="text-slate-200">
                                    {doradaData.trace_blokovi.length === 0 && <tr><td colSpan="7" className="p-4 text-center italic text-slate-500">Nema podataka o doradi.</td></tr>}
                                    {doradaData.trace_blokovi.map((tb, i) => (
                                        <tr key={i} className="border-b border-slate-800/50 hover:bg-white/5 transition-colors">
                                            <td className="p-3">
                                                <div className="font-black text-white">{tb.out_id}</div>
                                                <div className="text-blue-400 mt-1">{tb.out_naziv} <span className="text-slate-500 ml-1">({tb.out_dim})</span></div>
                                            </td>
                                            <td className="p-3 text-center font-black text-emerald-400 text-sm bg-emerald-900/10">{tb.out_m3}</td>
                                            <td className="p-3 text-center font-bold text-red-400 bg-red-900/10 border-l border-slate-800/50">{tb.in_m3}</td>
                                            <td className="p-3 whitespace-pre-line text-[9px] text-slate-400 font-mono leading-relaxed">{tb.in_ids}</td>
                                            <td className="p-3 text-center font-black border-l border-slate-800/50" style={{ color: saas.ui.boja_akcenta_dorada }}>{tb.yield}%</td>
                                            <td className="p-3 text-[9px] uppercase font-bold text-slate-300">{tb.operacije}</td>
                                            <td className="p-3 text-[9px] text-slate-400">{tb.radnik}<br/>{tb.vrijeme}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            {/* ==================================== */}
            {/* 3. FINANSIJE TAB (NOVO I MOĆNO)      */}
            {/* ==================================== */}
            {activeTab === 'finansije' && (
                <div className="animate-in fade-in space-y-6">
                    <Grid numItemsMd={2} numItemsLg={4} className="gap-6">
                        <Card decoration="top" className="border-slate-800 shadow-xl" style={{ backgroundColor: saas.ui.boja_kartice, decorationColor: saas.ui.boja_akcenta_finansije }}>
                            <Text className="text-slate-400 uppercase text-[10px] font-black">Ukupno Fakturisano</Text>
                            <Metric className="text-white">{parseFloat(finansijeKPI.ukupnoFakturisano).toLocaleString('bs-BA')} KM</Metric>
                            <Text className="text-slate-500 text-xs mt-2">Izdati računi u periodu</Text>
                        </Card>
                        <Card decoration="top" decorationColor="emerald" className="border-slate-800 shadow-xl" style={{ backgroundColor: saas.ui.boja_kartice }}>
                            <Text className="text-slate-400 uppercase text-[10px] font-black">Naplaćeno (Gotovina + Virman)</Text>
                            <Metric className="text-emerald-400">{(parseFloat(finansijeKPI.naplacenoGotovina) + parseFloat(finansijeKPI.naplacenoVirman)).toLocaleString('bs-BA')} KM</Metric>
                            <Text className="text-slate-500 text-[10px] mt-2 uppercase font-bold">Gotovina: {finansijeKPI.naplacenoGotovina} | Virman: {finansijeKPI.naplacenoVirman}</Text>
                        </Card>
                        <Card decoration="top" decorationColor="red" className="border-slate-800 shadow-xl" style={{ backgroundColor: saas.ui.boja_kartice }}>
                            <Text className="text-slate-400 uppercase text-[10px] font-black">Nenaplaćena Potraživanja</Text>
                            <Metric className="text-red-400">{parseFloat(finansijeKPI.nenaplacenoDug).toLocaleString('bs-BA')} KM</Metric>
                            <Text className="text-slate-500 text-xs mt-2">Otvoreni dug kupaca</Text>
                        </Card>
                        <Card decoration="top" decorationColor="purple" className="border-slate-800 shadow-xl" style={{ backgroundColor: saas.ui.boja_kartice }}>
                            <Text className="text-slate-400 uppercase text-[10px] font-black">Obračunati PDV (17%)</Text>
                            <Metric className="text-purple-400">{parseFloat(finansijeKPI.ocekivaniPDV).toLocaleString('bs-BA')} KM</Metric>
                            <Text className="text-slate-500 text-xs mt-2">Obaveza prema državi</Text>
                        </Card>
                    </Grid>

                    <Grid numItemsMd={1} numItemsLg={2} className="gap-6">
                        {/* STRUKTURA NAPLATE */}
                        <Card className="border-slate-800 shadow-xl h-[400px]" style={{ backgroundColor: saas.ui.boja_kartice }}>
                            <Text className="text-slate-400 uppercase text-[10px] font-black mb-2">Struktura realizacije i potraživanja</Text>
                            <ResponsiveContainer width="100%" height="90%">
                                <PieChart>
                                    <Pie data={strukturaNaplate} innerRadius={70} outerRadius={110} paddingAngle={5} dataKey="value" stroke="none">
                                        <Cell fill="#10b981" /> {/* Gotovina */}
                                        <Cell fill="#3b82f6" /> {/* Virman */}
                                        <Cell fill="#ef4444" /> {/* Dug */}
                                    </Pie>
                                    <RechartsTooltip contentStyle={{backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '10px'}} formatter={(value) => `${value.toLocaleString('bs-BA')} KM`} />
                                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '20px', fontWeight: 'bold' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </Card>

                        {/* TOP DUŽNICI */}
                        <Card className="border-slate-800 shadow-xl h-[400px]" style={{ backgroundColor: saas.ui.boja_kartice }}>
                            <Text className="text-slate-400 uppercase text-[10px] font-black mb-6">Top 5 Dužnika (Otvoreni Saldo)</Text>
                            {topDuznici.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-emerald-500 font-bold text-sm">Nema otvorenih dugovanja u ovom periodu ✅</div>
                            ) : (
                                <ResponsiveContainer width="100%" height="85%">
                                    <BarChart data={topDuznici} layout="vertical" margin={{ top: 0, right: 20, left: 40, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                        <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} width={100} />
                                        <RechartsTooltip contentStyle={{backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '10px'}} formatter={(value) => `${value.toLocaleString('bs-BA')} KM`} />
                                        <Bar dataKey="dug" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </Card>
                    </Grid>
                </div>
            )}
          </div>
        )}
      </div>
    );
}