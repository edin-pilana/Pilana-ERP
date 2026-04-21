"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { Card, Metric, Text, Grid, Flex, Badge, Title } from '@tremor/react';

const supabase = createClient('https://awaxwejrhmjeqohrgidm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY');

const PALETA = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e'];

const imaSirovinu = (val) => {
    if (!val) return false;
    if (Array.isArray(val) && val.length > 0) return true;
    if (typeof val === 'string') return val.replace(/[{}"[\]\s]/g, '').length > 0;
    return false;
};

const formatDatum = (iso) => {
    if(!iso) return '';
    const [y, m, d] = iso.split('T')[0].split('-'); return `${d}.${m}.${y}.`;
};

export default function TabProrezAnalitika({ datumOd, datumDo, masinaFilter, saas, header }) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [brentistaFilter, setBrentistaFilter] = useState('SVI');
    
    const [logoUrl, setLogoUrl] = useState('');
    const [imeFirme, setImeFirme] = useState('SMART TIMBER');

    useEffect(() => {
        try {
            const brending = JSON.parse(localStorage.getItem('erp_brending') || '[]');
            const logoObj = brending.find(b => (b.lokacije_jsonb || []).includes('Svi PDF Dokumenti')) || 
                            brending.find(b => (b.lokacije_jsonb || []).includes('Glavni Meni (Dashboard Vrh)'));
            if (logoObj && logoObj.url_slike) setLogoUrl(logoObj.url_slike);
            if (logoObj && logoObj.naziv) setImeFirme(logoObj.naziv);
        } catch (e) {}
    }, []);

    useEffect(() => {
        ucitajDubokuAnalitiku();
    }, [datumOd, datumDo, masinaFilter, brentistaFilter]);

    const ucitajDubokuAnalitiku = async () => {
        setLoading(true);
        try {
            const d30 = new Date(new Date(datumOd).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const { data: logResData } = await supabase.from('prorez_log').select('*').gte('datum', d30).lte('datum', datumDo);
            const trupacIds = [...new Set((logResData || []).map(l => l.trupac_id).filter(Boolean))];
            
            let trupciResData = [];
            if (trupacIds.length > 0) {
                for (let i = 0; i < trupacIds.length; i += 500) {
                    const chunk = trupacIds.slice(i, i + 500);
                    const { data: tData } = await supabase.from('trupci').select('*').in('id', chunk);
                    if (tData) trupciResData = [...trupciResData, ...tData];
                }
            }

            const [paketiRes, zastojiRes] = await Promise.all([
                supabase.from('paketi').select('*').gte('datum_yyyy_mm', d30).lte('datum_yyyy_mm', datumDo),
                supabase.from('dnevnik_masine').select('*').gte('datum', datumOd).lte('datum', datumDo).eq('modul', 'Prorez')
            ]);

            const paketiResData = paketiRes.data || [];
            const zastojiResData = zastojiRes.data || [];

            // --- EKSTRAKCIJA RADNIKA (I iz Proreza i iz Pilane) ---
            const sviDanLogovi = (logResData || []).filter(l => l.datum >= datumOd && l.datum <= datumDo && (masinaFilter === 'SVE' || l.masina === masinaFilter));
            const sviDanPaketi = paketiResData.filter(p => p.datum_yyyy_mm >= datumOd && p.datum_yyyy_mm <= datumDo && (masinaFilter === 'SVE' || p.masina === masinaFilter) && !imaSirovinu(p.ai_sirovina_ids));
            
            const dostupniBrentiste = [...new Set([
                ...sviDanLogovi.map(l => l.brentista),
                ...sviDanPaketi.map(p => p.brentista)
            ].filter(Boolean))];

            const danLogovi = sviDanLogovi.filter(l => brentistaFilter === 'SVI' || l.brentista === brentistaFilter);
            const danPaketi = sviDanPaketi.filter(p => brentistaFilter === 'SVI' || p.brentista === brentistaFilter);
            const danZastoji = zastojiResData.filter(z => (masinaFilter === 'SVE' || z.masina === masinaFilter) && (brentistaFilter === 'SVI' || z.snimio?.includes(brentistaFilter)));

            // --- KALKULACIJA ULAZA ---
            let ulazM3 = 0; let ulazKom = 0; let sumTotalPrecnik = 0;
            const trupciMap = {};

            danLogovi.forEach(l => {
                const t = trupciResData.find(tr => tr.id === l.trupac_id);
                if (t) {
                    const m3 = parseFloat(t.zapremina || 0);
                    const precnik = parseFloat(t.promjer || 0);
                    const duzina = parseFloat(t.duzina || 0).toFixed(1);

                    ulazM3 += m3; ulazKom += 1; sumTotalPrecnik += precnik;
                    
                    if(!trupciMap[duzina]) trupciMap[duzina] = { duzina, kom: 0, m3: 0, sumPrecnik: 0 };
                    trupciMap[duzina].kom += 1;
                    trupciMap[duzina].m3 += m3;
                    trupciMap[duzina].sumPrecnik += precnik;
                }
            });

            const trupciStruktura = Object.values(trupciMap).map(t => ({
                ...t, avgPrecnik: (t.sumPrecnik / t.kom).toFixed(1)
            })).sort((a,b) => parseFloat(b.duzina) - parseFloat(a.duzina));

            const prosjecanPrecnikGlavni = ulazKom > 0 ? (sumTotalPrecnik / ulazKom).toFixed(1) : 0;

            // --- KALKULACIJA IZLAZA ---
            let izlazM3 = 0;
            const proizvodiMap = {};

            danPaketi.forEach(p => {
                const vol = parseFloat(p.kolicina_final || 0);
                izlazM3 += vol;
                
                const kljuc = p.naziv_proizvoda || 'Nepoznato';
                if(!proizvodiMap[kljuc]) proizvodiMap[kljuc] = { naziv: kljuc, m3: 0, kom: 0, m2: 0, m1: 0, paketi: [] };
                
                proizvodiMap[kljuc].m3 += vol;
                
                const jm = (p.jm || 'kom').toLowerCase();
                const u = parseFloat(p.kolicina_ulaz || 0);
                if (jm === 'kom') proizvodiMap[kljuc].kom += u;
                if (jm === 'm2') proizvodiMap[kljuc].m2 += u;
                if (jm === 'm1') proizvodiMap[kljuc].m1 += u;

                proizvodiMap[kljuc].paketi.push(p);
            });

            const proizvodiStruktura = Object.values(proizvodiMap).sort((a,b) => b.m3 - a.m3);
            const grafikonProizvoda = proizvodiStruktura.map(p => ({ name: p.naziv, value: parseFloat(p.m3.toFixed(2)) }));

            // --- YIELD I ZASTOJI ---
            const yieldProcenat = ulazM3 > 0 ? ((izlazM3 / ulazM3) * 100).toFixed(1) : 0;
            const grafikonYield = ulazM3 > 0 || izlazM3 > 0 ? [
                ...grafikonProizvoda,
                { name: 'Kalo / Piljevina', value: Math.max(0, ulazM3 - izlazM3), isWaste: true }
            ] : [];

            // --- RADNICI I VRIJEME ---
            const svaVremena = [
                ...danLogovi.map(l => l.vrijeme_unosa),
                ...danPaketi.map(p => p.vrijeme_tekst)
            ].filter(Boolean).sort();

            let smjenaStart = 'N/A'; let smjenaEnd = 'N/A';
            if (svaVremena.length > 0) {
                smjenaStart = svaVremena[0].substring(0, 5); 
                smjenaEnd = svaVremena[svaVremena.length - 1].substring(0, 5); 
            }

            const sviViljuskaristi = [...new Set([
                ...danLogovi.map(l => l.viljuskarista),
                ...danPaketi.map(p => p.viljuskarista)
            ].filter(Boolean))].join(', ');

            const sviPomocni = [...new Set(danPaketi.map(p => p.radnici_pilana).filter(Boolean))].join(', ');

            const ukupnoZastojMin = danZastoji.reduce((sum, z) => sum + (parseInt(z.zastoj_min) || 0), 0);
            const efektivnoSati = Math.max(0.1, 8 - (ukupnoZastojMin / 60)); 
            const m3PoSatu = ulazM3 > 0 ? (ulazM3 / efektivnoSati).toFixed(2) : "0.00";

            // --- TRENDOVI (ZADNJIH 30 DANA) ---
            const trendDaniMap = {};
            const dDanas = new Date(datumDo);
            for (let i = 29; i >= 0; i--) {
                const d = new Date(dDanas.getTime() - i * 24 * 60 * 60 * 1000);
                const iso = d.toISOString().split('T')[0];
                trendDaniMap[iso] = { dan: `${d.getDate()}.${d.getMonth()+1}`, pilanaUlaz: 0, pilanaIzlaz: 0, brentistaUlaz: 0, brentistaIzlaz: 0 };
            }

            const targetBrentista = brentistaFilter !== 'SVI' ? brentistaFilter : (dostupniBrentiste[0] || 'Svi radnici');

            (logResData || []).forEach(l => {
                const iso = l.datum;
                if(trendDaniMap[iso]) {
                    const t = trupciResData.find(tr => tr.id === l.trupac_id);
                    if(t) {
                        const m3 = parseFloat(t.zapremina || 0);
                        trendDaniMap[iso].pilanaUlaz += m3;
                        if(l.brentista === targetBrentista || brentistaFilter === 'SVI') trendDaniMap[iso].brentistaUlaz += m3;
                    }
                }
            });

            paketiResData.filter(p => !imaSirovinu(p.ai_sirovina_ids)).forEach(p => {
                const iso = p.datum_yyyy_mm;
                if(trendDaniMap[iso]) {
                    const m3 = parseFloat(p.kolicina_final || 0);
                    trendDaniMap[iso].pilanaIzlaz += m3;
                    if(p.brentista === targetBrentista || brentistaFilter === 'SVI') trendDaniMap[iso].brentistaIzlaz += m3;
                }
            });

            const trendChartData = Object.values(trendDaniMap).map(d => ({
                dan: d.dan,
                PilanaYield: d.pilanaUlaz > 0 ? parseFloat(((d.pilanaIzlaz / d.pilanaUlaz) * 100).toFixed(1)) : 0,
                BrentistaYield: d.brentistaUlaz > 0 ? parseFloat(((d.brentistaIzlaz / d.brentistaUlaz) * 100).toFixed(1)) : 0,
                PilanaM3: parseFloat(d.pilanaUlaz.toFixed(1)),
                BrentistaM3: parseFloat(d.brentistaUlaz.toFixed(1)),
            }));

            setData({
                kpi: { ulazM3: ulazM3.toFixed(2), ulazKom, prosjecanPrecnik: prosjecanPrecnikGlavni, izlazM3: izlazM3.toFixed(2), yieldProcenat, m3PoSatu, ukupnoZastojMin },
                trupciStruktura, proizvodiStruktura, grafikonProizvoda, grafikonYield, trendChartData, zastoji: danZastoji,
                smjenaInfo: { 
                    sviBrentiste: dostupniBrentiste, 
                    viljuskaristi: sviViljuskaristi,
                    pomocniRadnici: sviPomocni,
                    start: smjenaStart, end: smjenaEnd,
                    glavniBrentista: targetBrentista
                }
            });
            setLoading(false);

        } catch (error) {
            console.error("Kritična greška u analitici:", error);
            setData({
                kpi: { ulazM3: "0.00", ulazKom: 0, prosjecanPrecnik: 0, izlazM3: "0.00", yieldProcenat: 0, m3PoSatu: "0.00", ukupnoZastojMin: 0 },
                trupciStruktura: [], proizvodiStruktura: [], grafikonProizvoda: [], grafikonYield: [], trendChartData: [], zastoji: [], smjenaInfo: { sviBrentiste: [], viljuskaristi: '', pomocniRadnici: '', start: 'N/A', end: 'N/A', glavniBrentista: '' }
            });
            setLoading(false);
        }
    };

    const pokreniPrint = () => {
        const title = `${datumOd}_${brentistaFilter === 'SVI' ? 'SviRadnici' : brentistaFilter.replace(/\s+/g, '')}_Prorez`;
        document.title = title;
        window.print();
        setTimeout(() => document.title = "TTM ERP", 2000);
    };

    const renderKaloCell = (entry, index) => <Cell key={`cell-${index}`} fill={entry.isWaste ? '#334155' : PALETA[index % PALETA.length]} />;
    
    if (loading) return <div className="p-20 text-center text-emerald-500 animate-pulse font-black text-xl uppercase tracking-widest">Slažem podatke...</div>;
    if (!data) return <div className="p-20 text-center text-slate-500 font-bold">Nema podataka.</div>;

    return (
        <div className="space-y-6 bg-white print:bg-white print:text-black text-slate-200">
            
            {/* ======================================================== */}
            {/* PRINT HEADER (Vidljiv samo na papiru - sakriven na ekranu) */}
            {/* ======================================================== */}
            <div className="hidden print:flex justify-between items-end border-b-2 border-slate-800 pb-4 mb-6 pt-4">
                <div className="flex items-center gap-4">
                    {logoUrl ? <img src={logoUrl} alt="Logo" className="max-h-16 object-contain" /> : <h1 className="text-3xl font-black text-slate-900">{imeFirme}</h1>}
                    <div className="border-l-2 border-slate-300 pl-4 ml-2">
                        <h2 className="text-xl font-black uppercase text-slate-800 tracking-widest">Izvještaj Proreza (Pilana)</h2>
                        <p className="text-sm text-slate-500 font-bold">{masinaFilter === 'SVE' ? 'Sve mašine' : masinaFilter} | Brentista: {brentistaFilter}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm font-black text-slate-800 uppercase">Mjesto: <span className="font-normal">{header?.mjesto || 'N/A'}</span></p>
                    <p className="text-sm font-black text-slate-800 uppercase">Datum: <span className="font-normal">{formatDatum(datumOd)}</span></p>
                </div>
            </div>

            {/* EKRAN KONTROLE (Skrivene na printu) */}
            <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg print:hidden">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400 font-black uppercase">Filtriraj po Brentisti:</span>
                    <select value={brentistaFilter} onChange={e => setBrentistaFilter(e.target.value)} className="bg-slate-800 text-emerald-400 px-4 py-2 rounded-lg text-xs font-black outline-none border border-slate-700 uppercase tracking-widest [&>option]:bg-slate-900 [&>option]:text-white cursor-pointer">
                        <option value="SVI">SVI ZAPOSLENI</option>
                        {data.smjenaInfo.sviBrentiste.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>
                <button onClick={pokreniPrint} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                    🖨️ Isprintaj PDF
                </button>
            </div>

            {/* 1. TOP KPI KARTICE (5 u redu) */}
            <div className="grid grid-cols-5 gap-3">
                <Card decoration="top" decorationColor="emerald" className="bg-[#1e293b] print:bg-white print:border-slate-300 border-slate-700 p-4">
                    <Text className="text-slate-400 print:text-slate-500 font-bold text-[9px] uppercase">Izrezano Trupaca (Ulaz)</Text>
                    <Metric className="text-white print:text-black text-xl mt-1">{data.kpi.ulazM3} <span className="text-sm">m³</span></Metric>
                </Card>
                <Card decoration="top" decorationColor="blue" className="bg-[#1e293b] print:bg-white print:border-slate-300 border-slate-700 p-4">
                    <Text className="text-slate-400 print:text-slate-500 font-bold text-[9px] uppercase">Proizvedeno (Izlaz)</Text>
                    <Metric className="text-white print:text-black text-xl mt-1">{data.kpi.izlazM3} <span className="text-sm">m³</span></Metric>
                </Card>
                <Card decoration="top" decorationColor="amber" className="bg-[#1e293b] print:bg-white print:border-slate-300 border-slate-700 p-4">
                    <Text className="text-slate-400 print:text-slate-500 font-bold text-[9px] uppercase">Iskorištenost (Yield)</Text>
                    <Metric className="text-amber-400 print:text-black text-xl mt-1">{data.kpi.yieldProcenat} <span className="text-sm">%</span></Metric>
                </Card>
                <Card decoration="top" decorationColor="purple" className="bg-[#1e293b] print:bg-white print:border-slate-300 border-slate-700 p-4">
                    <Text className="text-slate-400 print:text-slate-500 font-bold text-[9px] uppercase">Brzina Rezanja</Text>
                    <Metric className="text-purple-400 print:text-black text-xl mt-1">{data.kpi.m3PoSatu} <span className="text-sm">m³/h</span></Metric>
                </Card>
                <Card decoration="top" decorationColor="red" className="bg-[#1e293b] print:bg-white print:border-slate-300 border-slate-700 p-4">
                    <Text className="text-slate-400 print:text-slate-500 font-bold text-[9px] uppercase">Zastoji u smjeni</Text>
                    <Metric className="text-red-400 print:text-black text-xl mt-1">{data.kpi.ukupnoZastojMin} <span className="text-sm">min</span></Metric>
                </Card>
            </div>

            {/* 2. TABELE PODATAKA */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 print:gap-4 page-break-avoid">
                {/* ULAZ TRUPACA */}
                <div className="md:col-span-5 bg-[#1e293b] print:bg-transparent print:border-none border border-slate-700 rounded-2xl p-5">
                    <Title className="text-slate-300 print:text-slate-800 font-black text-[10px] uppercase mb-3 border-b border-slate-700 print:border-slate-300 pb-2">Trupci po dužinama (Sirovina)</Title>
                    <table className="w-full text-left text-xs">
                        <thead className="text-slate-500 print:text-slate-600 uppercase border-b border-slate-700 print:border-slate-300">
                            <tr><th className="py-2">L (m)</th><th className="py-2 text-center">Kom</th><th className="py-2 text-center">Ø Prosjek</th><th className="py-2 text-right">m³</th></tr>
                        </thead>
                        <tbody className="text-slate-200 print:text-slate-800 font-bold">
                            {data.trupciStruktura.length === 0 && <tr><td colSpan="4" className="py-4 text-center italic text-slate-500">Nema evidentiranih trupaca.</td></tr>}
                            {data.trupciStruktura.map(t => (
                                <tr key={t.duzina} className="border-b border-slate-800/50 print:border-slate-200">
                                    <td className="py-2 text-emerald-400 print:text-black">{t.duzina} m</td>
                                    <td className="py-2 text-center">{t.kom}</td>
                                    <td className="py-2 text-center text-slate-400 print:text-slate-600">Ø {t.avgPrecnik} cm</td>
                                    <td className="py-2 text-right font-black">{t.m3.toFixed(2)}</td>
                                </tr>
                            ))}
                            <tr className="border-t-2 border-slate-600 print:border-slate-400 font-black text-sm">
                                <td className="py-3 text-white print:text-black">UKUPNO:</td>
                                <td className="py-3 text-center text-white print:text-black">{data.kpi.ulazKom}</td>
                                <td className="py-3 text-center text-slate-400 print:text-slate-600">Ø {data.kpi.prosjecanPrecnik} cm</td>
                                <td className="py-3 text-right text-emerald-400 print:text-black">{data.kpi.ulazM3}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* IZLAZ GOTOVE ROBE */}
                <div className="md:col-span-7 bg-[#1e293b] print:bg-transparent print:border-none border border-slate-700 rounded-2xl p-5">
                    <Title className="text-slate-300 print:text-slate-800 font-black text-[10px] uppercase mb-3 border-b border-slate-700 print:border-slate-300 pb-2">Proizvedeno (Gotova Roba)</Title>
                    <table className="w-full text-left text-[10px]">
                        <thead className="text-slate-500 print:text-slate-600 uppercase border-b border-slate-700 print:border-slate-300">
                            <tr><th className="py-2">Artikal (Vrsta)</th><th className="py-2 text-center">Kom / m1 / m2</th><th className="py-2 text-right">m³ (Volumen)</th></tr>
                        </thead>
                        <tbody className="text-slate-200 print:text-slate-800">
                            {data.proizvodiStruktura.length === 0 && <tr><td colSpan="3" className="py-4 text-center italic text-slate-500">Nema proizvedene građe.</td></tr>}
                            {data.proizvodiStruktura.map((p, i) => (
                                <React.Fragment key={i}>
                                    <tr className="bg-slate-800/30 print:bg-slate-100 border-y border-slate-700/50 print:border-slate-300">
                                        <td className="py-2 font-black text-blue-400 print:text-black text-xs uppercase" colSpan="3">{p.naziv}</td>
                                    </tr>
                                    {(p.paketi || []).map(paket => (
                                        <tr key={paket.id} className="border-b border-slate-800/30 print:border-slate-200">
                                            <td className="py-1.5 pl-2 font-bold">{paket.paket_id} <span className="text-slate-500 print:text-slate-600 ml-1">({paket.debljina}x{paket.sirina}x{paket.duzina})</span>
                                                {paket.broj_veze && <span className="ml-2 text-[8px] bg-slate-800 print:bg-slate-200 px-1 rounded">RN: {paket.broj_veze}</span>}
                                            </td>
                                            <td className="py-1.5 text-center font-bold">{paket.kolicina_ulaz} {paket.jm}</td>
                                            <td className="py-1.5 text-right font-black text-sm">{paket.kolicina_final}</td>
                                        </tr>
                                    ))}
                                    <tr className="border-b-2 border-slate-700/50 print:border-slate-400 font-black">
                                        <td className="py-2 text-slate-400 print:text-slate-600 text-right pr-4" colSpan="2">Ukupno za vrstu:</td>
                                        <td className="py-2 text-right text-blue-400 print:text-black text-sm">{p.m3.toFixed(3)}</td>
                                    </tr>
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 3. GRAFIKONI (Sa isAnimationActive={false} zbog Printa i fiksnim height) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:gap-4 page-break-avoid print:mt-6">
                <Card className="bg-[#1e293b] print:bg-transparent print:border-slate-300 border-slate-700 shadow-xl">
                    <Title className="text-slate-300 print:text-slate-800 font-black text-[10px] uppercase mb-2 text-center">Učešće proizvoda u prorezu</Title>
                    {data.grafikonProizvoda.length === 0 ? <div className="flex h-[220px] items-center justify-center text-slate-500 text-xs">Nema podataka</div> : (
                    <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                            <Pie isAnimationActive={false} data={data.grafikonProizvoda} innerRadius={40} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                                {data.grafikonProizvoda.map((e, i) => <Cell key={`c-${i}`} fill={PALETA[i % PALETA.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{backgroundColor: '#0f172a', border:'none', borderRadius:'12px', color:'#fff'}} formatter={(v) => `${v} m³`} />
                            <Legend wrapperStyle={{fontSize:'9px', fontWeight:'bold', color: '#000'}} />
                        </PieChart>
                    </ResponsiveContainer>
                    )}
                </Card>

                <Card className="bg-[#1e293b] print:bg-transparent print:border-slate-300 border-slate-700 shadow-xl">
                    <Title className="text-slate-300 print:text-slate-800 font-black text-[10px] uppercase mb-4 text-center">Trend Iskorištenja (30 Dana): {brentistaFilter} vs Pilana</Title>
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={data.trendChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                            <XAxis dataKey="dan" stroke="#94a3b8" fontSize={8} tickLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={8} tickLine={false} unit="%" />
                            <Tooltip contentStyle={{backgroundColor: '#0f172a', border:'none', borderRadius:'8px', color:'#fff'}} />
                            <Legend wrapperStyle={{fontSize:'9px'}} />
                            <Line isAnimationActive={false} type="monotone" dataKey="PilanaYield" name="Prosjek Pilane" stroke="#64748b" strokeWidth={2} dot={false} />
                            <Line isAnimationActive={false} type="monotone" dataKey="BrentistaYield" name={brentistaFilter === 'SVI' ? 'Svi radnici' : brentistaFilter} stroke="#10b981" strokeWidth={3} dot={{r:2}} />
                        </LineChart>
                    </ResponsiveContainer>
                </Card>
            </div>

            {/* 4. ZASTOJI I SMJENA (FOOTER) */}
            <div className="border-t-4 border-slate-800 print:border-slate-300 pt-4 mt-6 page-break-avoid flex justify-between items-start">
                <div className="w-[60%]">
                    <h3 className="text-xs font-black uppercase text-slate-400 print:text-slate-800 mb-2">Dnevnik Zastoja i Napomene</h3>
                    {data.zastoji.length === 0 ? (
                        <p className="text-[10px] text-slate-500 italic">Smjena je protekla bez zabilježenih zastoja.</p>
                    ) : (
                        <ul className="space-y-1">
                            {data.zastoji.map(z => (
                                <li key={z.id} className="text-[10px] text-slate-300 print:text-black">
                                    <span className="font-bold">{z.vrijeme_od} - {z.vrijeme_do || '...'}</span>
                                    {z.zastoj_min > 0 && <span className="font-black text-red-500 mx-2">({z.zastoj_min} min)</span>}
                                    <span className="italic">{z.napomena || 'Nema opisa'}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                
                <div className="w-[35%] text-right text-[10px] text-slate-400 print:text-black space-y-1">
                    <p className="uppercase font-black mb-1 text-slate-500 print:text-slate-700 border-b border-slate-700 print:border-slate-300 pb-1">Detalji Smjene</p>
                    <p>Vrijeme rada (Od - Do): <b className="text-white print:text-black">{data.smjenaInfo.start} - {data.smjenaInfo.end}</b></p>
                    <p>Prijavljeni Brentisti: <b className="text-white print:text-black">{data.smjenaInfo.sviBrentiste.join(', ') || 'Nisu evidentirani'}</b></p>
                    <p>Viljuškaristi: <b className="text-white print:text-black">{data.smjenaInfo.viljuskaristi || 'Nisu evidentirani'}</b></p>
                    <p>Pomoćni radnici: <b className="text-white print:text-black">{data.smjenaInfo.pomocniRadnici || 'Nisu evidentirani'}</b></p>
                    
                    <div className="mt-8 pt-8 border-t border-slate-700 print:border-slate-400 text-center font-bold">
                        Potpis rukovodioca
                    </div>
                </div>
            </div>

            {/* PRINT FOOTER */}
            <div className="hidden print:block mt-4 text-center text-[8px] text-slate-500 pt-2 border-t border-slate-300">
                Dokument generisan iz SmartTimber ERP softvera - {new Date().toLocaleString('bs-BA')}
            </div>
            
        </div>
    );
}