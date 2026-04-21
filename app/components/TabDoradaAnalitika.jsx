"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { Card, Metric, Text, Grid, Flex, Badge, Title } from '@tremor/react';

const supabase = createClient('https://awaxwejrhmjeqohrgidm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY');

const PALETA = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e'];

// Pomoćne funkcije
const imaSirovinu = (val) => {
    if (!val) return false;
    if (Array.isArray(val) && val.length > 0) return true;
    if (typeof val === 'string') return val.replace(/[{}"[\]\s]/g, '').length > 0;
    return false;
};

const getSirovineNiz = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') return val.replace(/[{}"[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean);
    return [];
};

const formatDatum = (iso) => {
    if(!iso) return '';
    const [y, m, d] = iso.split('T')[0].split('-'); return `${d}.${m}.${y}.`;
};

export default function TabDoradaAnalitika({ datumOd, datumDo, masinaFilter, saas, header }) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [radnikFilter, setRadnikFilter] = useState('SVI');
    
    // Podaci za Print
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
        ucitajDoradaAnalitiku();
    }, [datumOd, datumDo, masinaFilter, radnikFilter]);

    const ucitajDoradaAnalitiku = async () => {
        setLoading(true);
        try {
            // Povlačimo podatke zadnjih 60 dana da bismo našli "izvorne" pakete od kojih je dorada nastala
            const d60 = new Date(new Date(datumOd).getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const d30 = new Date(new Date(datumOd).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const [paketiRes, zastojiRes] = await Promise.all([
                supabase.from('paketi').select('*').gte('datum_yyyy_mm', d60), // Ne limitiramo datumDo za izvorne
                supabase.from('dnevnik_masine').select('*').gte('datum', datumOd).lte('datum', datumDo).eq('modul', 'Dorada')
            ]);

            const sviPaketiBaza = paketiRes.data || [];
            
            // --- FILTRIRANJE PAKETA DORADE ZA ODABRANI PERIOD ---
            const sviDanDorada = sviPaketiBaza.filter(p => p.datum_yyyy_mm >= datumOd && p.datum_yyyy_mm <= datumDo && imaSirovinu(p.ai_sirovina_ids) && (masinaFilter === 'SVE' || p.masina === masinaFilter));
            
            // Izdvajamo sve radnike koji su knjižili doradu taj dan
            const dostupniRadnici = [...new Set(sviDanDorada.map(p => p.snimio_korisnik).filter(Boolean))];

            // Primjena filtera radnika
            const danDorada = sviDanDorada.filter(p => radnikFilter === 'SVI' || p.snimio_korisnik === radnikFilter);
            const danZastoji = (zastojiRes.data || []).filter(z => (masinaFilter === 'SVE' || z.masina === masinaFilter) && (radnikFilter === 'SVI' || z.snimio?.includes(radnikFilter)));

            // --- KALKULACIJA ULAZA, IZLAZA I KALA ---
            let totalUlazM3 = 0; let totalIzlazM3 = 0;
            const operacijeMap = {}; const yieldPoProizvodu = {}; const traceBlokovi = [];

            danDorada.forEach(p => {
                const izlaz = parseFloat(p.kolicina_final || 0);
                
                // PAMETNO TRAŽENJE ULAZA (Tražimo originalne pakete iz baze da dobijemo tačnu kubikažu sirovine)
                let stvarniUlazM3 = 0;
                const idsSirovine = getSirovineNiz(p.ai_sirovina_ids);
                let sirovineTekst = [];

                if (idsSirovine.length > 0) {
                    idsSirovine.forEach(id => {
                        const orig = sviPaketiBaza.find(r => r.paket_id === id);
                        if (orig) {
                            // Ako nismo potrošili cijeli paket, onda je ulaz bio jednak onome što je izračunato u izlazu + neki procijenjeni kalo
                            // Za filigransku tačnost, Dorada modul bi trebao knjižiti koliko je tačno M3 uzeo sa ulaznog paketa.
                            // Ovdje koristimo ukupni finalni iznos starog paketa kao worst-case (pretpostavka da je cijeli utrošen).
                            const vol = parseFloat(orig.kolicina_final || 0);
                            stvarniUlazM3 += vol;
                            sirovineTekst.push(`Paket ${orig.paket_id} (${orig.naziv_proizvoda})`);
                        } else {
                            sirovineTekst.push(`Paket ${id} (Arhiviran)`);
                        }
                    });
                }
                
                // Ako nismo uspjeli naći originalni M3 u bazi, radimo sigurnosnu aproksimaciju
                if (stvarniUlazM3 === 0) stvarniUlazM3 = izlaz * 1.05; // Pretpostavka 5% kala

                totalUlazM3 += stvarniUlazM3;
                totalIzlazM3 += izlaz;

                // Grupisanje po operacijama (Oznake)
                const operacije = p.oznake && Array.isArray(p.oznake) && p.oznake.length > 0 ? p.oznake : ['Standardna Dorada'];
                operacije.forEach(o => { operacijeMap[o] = (operacijeMap[o] || 0) + izlaz; });

                // Grupisanje prinosa po proizvodu
                const naziv = p.naziv_proizvoda || 'Nepoznato';
                if (!yieldPoProizvodu[naziv]) yieldPoProizvodu[naziv] = { u: 0, i: 0 };
                yieldPoProizvodu[naziv].u += stvarniUlazM3;
                yieldPoProizvodu[naziv].i += izlaz;

                // Traceability Tabela
                traceBlokovi.push({
                    out_id: p.paket_id,
                    out_naziv: naziv,
                    out_dim: `${p.debljina}x${p.sirina}x${p.duzina}`,
                    out_m3: izlaz.toFixed(3),
                    in_m3: stvarniUlazM3.toFixed(3),
                    kalo_m3: Math.max(0, stvarniUlazM3 - izlaz).toFixed(3),
                    in_ids: sirovineTekst.join(', '),
                    operacije: operacije.join(', '),
                    radnik: p.snimio_korisnik,
                    rn: p.broj_veze || '-',
                    vrijeme: p.vrijeme_tekst
                });
            });

            // Formatiranje za grafikone
            const chartDoradaYield = Object.keys(yieldPoProizvodu).map(naziv => ({
                name: naziv,
                Yield: yieldPoProizvodu[naziv].u > 0 ? parseFloat(((yieldPoProizvodu[naziv].i / yieldPoProizvodu[naziv].u) * 100).toFixed(1)) : 0,
                IzlazM3: parseFloat(yieldPoProizvodu[naziv].i.toFixed(2))
            })).sort((a,b) => b.Yield - a.Yield).slice(0, 10); // Top 10

            const grafikonOperacija = Object.keys(operacijeMap).map(k => ({ name: k, value: parseFloat(operacijeMap[k].toFixed(2)) })).sort((a,b)=>b.value-a.value);

            // --- 30 DNEVNI TREND ---
            const trendDaniMap = {};
            const dDanas = new Date(datumDo);
            for (let i = 29; i >= 0; i--) {
                const d = new Date(dDanas.getTime() - i * 24 * 60 * 60 * 1000);
                const iso = d.toISOString().split('T')[0];
                trendDaniMap[iso] = { dan: `${d.getDate()}.${d.getMonth()+1}`, doradaM3: 0 };
            }

            const radnikZaTrend = radnikFilter !== 'SVI' ? radnikFilter : (dostupniRadnici[0] || 'Svi');

            sviPaketiBaza.filter(p => p.datum_yyyy_mm >= d30 && p.datum_yyyy_mm <= datumDo && imaSirovinu(p.ai_sirovina_ids)).forEach(p => {
                const iso = p.datum_yyyy_mm;
                if(trendDaniMap[iso] && (radnikFilter === 'SVI' || p.snimio_korisnik === radnikZaTrend)) {
                    trendDaniMap[iso].doradaM3 += parseFloat(p.kolicina_final || 0);
                }
            });

            const trendChartData = Object.values(trendDaniMap).map(d => ({ dan: d.dan, M3: parseFloat(d.doradaM3.toFixed(2)) }));

            const ukupnoZastojMin = danZastoji.reduce((sum, z) => sum + (parseInt(z.zastoj_min) || 0), 0);

            setData({
                kpi: { 
                    ulazM3: totalUlazM3.toFixed(2), 
                    izlazM3: totalIzlazM3.toFixed(2), 
                    kaloM3: Math.max(0, totalUlazM3 - totalIzlazM3).toFixed(2), 
                    yieldProcenat: totalUlazM3 > 0 ? ((totalIzlazM3 / totalUlazM3) * 100).toFixed(1) : "0.0", 
                    ukupnoZastojMin,
                    brojOperacija: traceBlokovi.length
                },
                grafikonOperacija, yieldChart: chartDoradaYield, trendChartData, trace_blokovi: traceBlokovi.sort((a,b) => b.out_m3 - a.out_m3), zastoji: danZastoji,
                smjenaInfo: { sviRadnici: dostupniRadnici, glavniRadnik: radnikZaTrend }
            });
            setLoading(false);

        } catch (error) {
            console.error("Kritična greška u analitici dorade:", error);
            setLoading(false);
        }
    };

    if (loading) return <div className="p-20 text-center text-blue-500 animate-pulse font-black text-xl uppercase tracking-widest">Analiziram doradu i zastoje...</div>;
    if (!data) return <div className="p-20 text-center text-slate-500 font-bold">Nema podataka.</div>;

    const pokreniPrint = () => {
        const title = `${datumOd}_${radnikFilter === 'SVI' ? 'SviRadnici' : radnikFilter.replace(/\s+/g, '')}_Dorada`;
        document.title = title;
        window.print();
        setTimeout(() => document.title = "TTM ERP", 2000);
    };

    return (
        <div className="space-y-6 bg-white print:bg-white print:text-black text-slate-200">
            
            {/* PRINT HEADER */}
            <div className="hidden print:flex justify-between items-end border-b-2 border-slate-800 pb-4 mb-6 pt-4">
                <div className="flex items-center gap-4">
                    {logoUrl ? <img src={logoUrl} alt="Logo" className="max-h-16 object-contain" /> : <h1 className="text-3xl font-black text-slate-900">{imeFirme}</h1>}
                    <div className="border-l-2 border-slate-300 pl-4 ml-2">
                        <h2 className="text-xl font-black uppercase text-slate-800 tracking-widest">Izvještaj Dorade (Prerada)</h2>
                        <p className="text-sm text-slate-500 font-bold">{masinaFilter === 'SVE' ? 'Sve mašine' : masinaFilter} | Operater: {radnikFilter}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm font-black text-slate-800 uppercase">Mjesto: <span className="font-normal">{header?.mjesto || 'N/A'}</span></p>
                    <p className="text-sm font-black text-slate-800 uppercase">Datum: <span className="font-normal">{formatDatum(datumOd)}</span></p>
                </div>
            </div>

            {/* EKRAN KONTROLE */}
            <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg print:hidden">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400 font-black uppercase">Filtriraj po Operateru:</span>
                    <select value={radnikFilter} onChange={e => setRadnikFilter(e.target.value)} className="bg-slate-800 text-blue-400 px-4 py-2 rounded-lg text-xs font-black outline-none border border-slate-700 uppercase tracking-widest [&>option]:bg-slate-900 [&>option]:text-white cursor-pointer">
                        <option value="SVI">SVI ZAPOSLENI</option>
                        {data.smjenaInfo.sviRadnici.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                <button onClick={pokreniPrint} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)]">
                    🖨️ Isprintaj PDF
                </button>
            </div>

            {/* 1. TOP KPI KARTICE (5 u redu) */}
            <div className="grid grid-cols-5 gap-3">
                <Card decoration="top" decorationColor="blue" className="bg-[#1e293b] print:bg-white print:border-slate-300 border-slate-700 p-4 shadow-xl">
                    <Text className="text-slate-400 print:text-slate-500 font-bold text-[9px] uppercase">Ulaz Sirovina</Text>
                    <Metric className="text-white print:text-black text-xl mt-1">{data.kpi.ulazM3} <span className="text-sm">m³</span></Metric>
                </Card>
                <Card decoration="top" decorationColor="emerald" className="bg-[#1e293b] print:bg-white print:border-slate-300 border-slate-700 p-4 shadow-xl">
                    <Text className="text-slate-400 print:text-slate-500 font-bold text-[9px] uppercase">Izlaz Gotove Robe</Text>
                    <Metric className="text-emerald-400 print:text-black text-xl mt-1">{data.kpi.izlazM3} <span className="text-sm">m³</span></Metric>
                </Card>
                <Card decoration="top" decorationColor="amber" className="bg-[#1e293b] print:bg-white print:border-slate-300 border-slate-700 p-4 shadow-xl">
                    <Text className="text-slate-400 print:text-slate-500 font-bold text-[9px] uppercase">Efikasnost Konverzije</Text>
                    <Metric className="text-amber-400 print:text-black text-xl mt-1">{data.kpi.yieldProcenat} <span className="text-sm">%</span></Metric>
                </Card>
                <Card decoration="top" decorationColor="rose" className="bg-[#1e293b] print:bg-white print:border-slate-300 border-slate-700 p-4 shadow-xl">
                    <Text className="text-slate-400 print:text-slate-500 font-bold text-[9px] uppercase">Stvarni Kalo (Otpad)</Text>
                    <Metric className="text-rose-400 print:text-black text-xl mt-1">{data.kpi.kaloM3} <span className="text-sm">m³</span></Metric>
                </Card>
                <Card decoration="top" decorationColor="red" className="bg-[#1e293b] print:bg-white print:border-slate-300 border-slate-700 p-4 shadow-xl">
                    <Text className="text-slate-400 print:text-slate-500 font-bold text-[9px] uppercase">Zastoji u smjeni</Text>
                    <Metric className="text-red-400 print:text-black text-xl mt-1">{data.kpi.ukupnoZastojMin} <span className="text-sm">min</span></Metric>
                </Card>
            </div>

            {/* 2. GRAFIKONI (Sa page-break-avoid za print) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:gap-4 page-break-avoid print:mt-6">
                <Card className="bg-[#1e293b] print:bg-transparent print:border-slate-300 border-slate-700 shadow-xl h-[300px] print:h-[250px]">
                    <Title className="text-slate-300 print:text-slate-800 font-black text-[10px] uppercase mb-4 text-center">Prinos (Yield %) po obrađenom artiklu</Title>
                    {data.yieldChart.length === 0 ? <div className="flex h-full items-center justify-center text-slate-500 text-xs">Nema podataka</div> : (
                    <ResponsiveContainer width="100%" height="85%">
                        <BarChart data={data.yieldChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} unit="%" />
                            <Tooltip contentStyle={{backgroundColor: '#0f172a', border:'none', borderRadius:'12px', color:'#fff'}} cursor={{fill: '#1e293b'}} />
                            <Bar isAnimationActive={false} dataKey="Yield" fill={saas?.ui?.boja_akcenta_dorada || '#3b82f6'} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                    )}
                </Card>

                <Card className="bg-[#1e293b] print:bg-transparent print:border-slate-300 border-slate-700 shadow-xl h-[300px] print:h-[250px]">
                    <Title className="text-slate-300 print:text-slate-800 font-black text-[10px] uppercase mb-2 text-center">Raspodjela Operacija (m³ prerađeno kroz oznake)</Title>
                    {data.grafikonOperacija.length === 0 ? <div className="flex h-full items-center justify-center text-slate-500 text-xs">Nema specifičnih operacija (Hoblano, Sušara...)</div> : (
                    <ResponsiveContainer width="100%" height="85%">
                        <PieChart>
                            <Pie isAnimationActive={false} data={data.grafikonOperacija} innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                                {data.grafikonOperacija.map((e, i) => <Cell key={`c-${i}`} fill={PALETA[i % PALETA.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{backgroundColor: '#0f172a', border:'none', borderRadius:'12px', color:'#fff'}} formatter={(v) => `${v} m³`} />
                            <Legend wrapperStyle={{fontSize:'9px', fontWeight:'bold', color: '#000'}} />
                        </PieChart>
                    </ResponsiveContainer>
                    )}
                </Card>
            </div>

            {/* 3. TREND I SLJEDIVOST */}
            <div className="grid grid-cols-1 gap-6 page-break-avoid">
                <Card className="bg-[#1e293b] print:bg-transparent print:border-slate-300 border-slate-700 shadow-xl h-[300px] print:h-[250px]">
                    <Title className="text-slate-300 print:text-slate-800 font-black text-[10px] uppercase mb-4 text-center">Dinamika rada (30 Dana): Volumen dorade (m³)</Title>
                    <ResponsiveContainer width="100%" height="85%">
                        <AreaChart data={data.trendChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorDorada" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={saas?.ui?.boja_akcenta_dorada || '#3b82f6'} stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor={saas?.ui?.boja_akcenta_dorada || '#3b82f6'} stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                            <XAxis dataKey="dan" stroke="#94a3b8" fontSize={9} tickLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                            <Tooltip contentStyle={{backgroundColor: '#0f172a', border:'none', borderRadius:'8px', color:'#fff'}} />
                            <Area isAnimationActive={false} type="monotone" dataKey="M3" name={data.smjenaInfo.glavniRadnik} stroke={saas?.ui?.boja_akcenta_dorada || '#3b82f6'} fill="url(#colorDorada)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </Card>

                {/* DETALJNA TABELA SLJEDIVOSTI */}
                <Card className="bg-[#1e293b] print:bg-transparent print:border-slate-300 border-slate-700 shadow-xl">
                    <Title className="text-blue-400 print:text-slate-800 font-black text-[10px] uppercase mb-4 border-b border-slate-700 print:border-slate-300 pb-2">Forenzička Sljedivost (Traceability) - Odakle je proizvod nastao</Title>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[10px]">
                            <thead className="text-slate-500 print:text-slate-600 uppercase border-b border-slate-700 print:border-slate-300">
                                <tr>
                                    <th className="py-2">Novi Paket (Izlaz)</th>
                                    <th className="py-2 text-center">Final m³</th>
                                    <th className="py-2 text-center print:border-slate-300">Ulaz m³ / Kalo</th>
                                    <th className="py-2">Korištena Sirovina</th>
                                    <th className="py-2 text-center">Yield</th>
                                    <th className="py-2">Operacije</th>
                                    <th className="py-2">Radnik / RN</th>
                                </tr>
                            </thead>
                            <tbody className="text-slate-200 print:text-slate-800 font-bold">
                            {data.trace_blokovi?.length === 0 && <tr><td colSpan="7" className="p-4 text-center italic text-slate-500">Nema podataka o doradi.</td></tr>}
                                         {(data.trace_blokovi || []).map((tb, i) => (
                                    <tr key={i} className="border-b border-slate-800/50 print:border-slate-200 hover:bg-slate-800/30">
                                        <td className="py-2">
                                            <div className="font-black text-white print:text-black text-xs">{tb.out_id}</div>
                                            <div className="text-blue-400 print:text-slate-700 mt-1">{tb.out_naziv} <span className="text-slate-500 ml-1">({tb.out_dim})</span></div>
                                        </td>
                                        <td className="py-2 text-center font-black text-emerald-400 print:text-black text-sm">{tb.out_m3}</td>
                                        <td className="py-2 text-center text-slate-300 print:text-slate-800">
                                            {tb.in_m3} <span className="text-rose-400 text-[8px] block mt-1">Kalo: {tb.kalo_m3}</span>
                                        </td>
                                        <td className="py-2 whitespace-pre-line text-[9px] text-slate-400 print:text-slate-600 font-mono">{tb.in_ids}</td>
                                        <td className="py-2 text-center font-black text-blue-400 print:text-black">{tb.yield}%</td>
                                        <td className="py-2 text-[8px] uppercase">{tb.operacije}</td>
                                        <td className="py-2 text-[9px] text-slate-400 print:text-slate-600">{tb.radnik}<br/>{tb.rn !== '-' && <span className="text-purple-400 font-black">RN: {tb.rn}</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            {/* ZASTOJI I FOOTER */}
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
                    <div className="mt-8 pt-8 border-t border-slate-700 print:border-slate-400 text-center font-bold">
                        Potpis operatera / rukovodioca
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