"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { Card, Metric, Text, Title } from '@tremor/react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const supabase = createClient('https://awaxwejrhmjeqohrgidm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY');

const PALETA = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e'];

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
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    
    const [logoUrl, setLogoUrl] = useState('');
    const [imeFirme, setImeFirme] = useState('SMART TIMBER');

    useEffect(() => {
        const logo = localStorage.getItem('saas_app_logo');
        if(logo) setLogoUrl(logo);
    }, []);

    useEffect(() => { ucitajDoradaAnalitiku(); }, [datumOd, datumDo, masinaFilter, radnikFilter]);

    const ucitajDoradaAnalitiku = async () => {
        setLoading(true);
        try {
            const d60 = new Date(new Date(datumOd).getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const d30 = new Date(new Date(datumOd).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const [paketiRes, zastojiRes] = await Promise.all([
                supabase.from('paketi').select('*').gte('datum_yyyy_mm', d60), 
                supabase.from('dnevnik_masine').select('*').gte('datum', datumOd).lte('datum', datumDo).eq('modul', 'Dorada')
            ]);

            const sviPaketiBaza = paketiRes.data || [];
            const sviDanDorada = sviPaketiBaza.filter(p => p.datum_yyyy_mm >= datumOd && p.datum_yyyy_mm <= datumDo && imaSirovinu(p.ai_sirovina_ids) && (masinaFilter === 'SVE' || p.masina === masinaFilter));
            const dostupniRadnici = [...new Set(sviDanDorada.map(p => p.snimio_korisnik).filter(Boolean))];

            const danDorada = sviDanDorada.filter(p => radnikFilter === 'SVI' || p.snimio_korisnik === radnikFilter);
            const danZastoji = (zastojiRes.data || []).filter(z => (masinaFilter === 'SVE' || z.masina === masinaFilter) && (radnikFilter === 'SVI' || z.snimio?.includes(radnikFilter)));

            let totalUlazM3 = 0; let totalIzlazM3 = 0;
            const operacijeMap = {}; const yieldPoProizvodu = {}; const traceBlokovi = [];

            danDorada.forEach(p => {
                const izlaz = parseFloat(p.kolicina_final || 0);
                let stvarniUlazM3 = 0;
                const idsSirovine = getSirovineNiz(p.ai_sirovina_ids);
                let sirovineTekst = [];

                if (idsSirovine.length > 0) {
                    idsSirovine.forEach(id => {
                        const orig = sviPaketiBaza.find(r => r.paket_id === id);
                        if (orig) {
                            stvarniUlazM3 += parseFloat(orig.kolicina_final || 0);
                            sirovineTekst.push(`P. ${orig.paket_id}`);
                        } else {
                            sirovineTekst.push(`P. ${id}`);
                        }
                    });
                }
                
                if (stvarniUlazM3 === 0) stvarniUlazM3 = izlaz * 1.05; 
                totalUlazM3 += stvarniUlazM3; totalIzlazM3 += izlaz;

                const operacije = p.oznake && Array.isArray(p.oznake) && p.oznake.length > 0 ? p.oznake : ['Dorada'];
                operacije.forEach(o => { operacijeMap[o] = (operacijeMap[o] || 0) + izlaz; });

                const naziv = p.naziv_proizvoda || 'Nepoznato';
                if (!yieldPoProizvodu[naziv]) yieldPoProizvodu[naziv] = { u: 0, i: 0 };
                yieldPoProizvodu[naziv].u += stvarniUlazM3; yieldPoProizvodu[naziv].i += izlaz;

                traceBlokovi.push({
                    out_id: p.paket_id, out_naziv: naziv, out_dim: `${p.debljina}x${p.sirina}x${p.duzina}`,
                    out_m3: izlaz.toFixed(3), in_m3: stvarniUlazM3.toFixed(3), kalo_m3: Math.max(0, stvarniUlazM3 - izlaz).toFixed(3),
                    in_ids: sirovineTekst.join(', '), operacije: operacije.join(', '), radnik: p.snimio_korisnik, rn: p.broj_veze || '-'
                });
            });

            const chartDoradaYield = Object.keys(yieldPoProizvodu).map(naziv => ({
                name: naziv, Yield: yieldPoProizvodu[naziv].u > 0 ? parseFloat(((yieldPoProizvodu[naziv].i / yieldPoProizvodu[naziv].u) * 100).toFixed(1)) : 0,
            })).sort((a,b) => b.Yield - a.Yield).slice(0, 8);

            const grafikonOperacija = Object.keys(operacijeMap).map(k => ({ name: k, value: parseFloat(operacijeMap[k].toFixed(2)) })).sort((a,b)=>b.value-a.value);

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
                    ulazM3: totalUlazM3.toFixed(2), izlazM3: totalIzlazM3.toFixed(2), kaloM3: Math.max(0, totalUlazM3 - totalIzlazM3).toFixed(2), 
                    yieldProcenat: totalUlazM3 > 0 ? ((totalIzlazM3 / totalUlazM3) * 100).toFixed(1) : "0.0", ukupnoZastojMin
                },
                grafikonOperacija, yieldChart: chartDoradaYield, trendChartData, trace_blokovi: traceBlokovi.sort((a,b) => b.out_m3 - a.out_m3), zastoji: danZastoji,
                smjenaInfo: { sviRadnici: dostupniRadnici, glavniRadnik: radnikZaTrend }
            });
            setLoading(false);
        } catch (error) { setLoading(false); }
    };

    const generisiUltimativniPDF = async (nazivModula, nazivKoloneFolder) => {
        setIsGeneratingPDF(true);
        try {
            // 1. RENDERIRANJE (Slikanje ekrana)
            const pdfElement = document.getElementById('savrseni-pdf-dokument');
            pdfElement.style.opacity = '1';
            pdfElement.style.zIndex = '9999';
            pdfElement.style.left = '0px';
            const canvas = await html2canvas(pdfElement, { scale: 2, useCORS: true, logging: false });
            pdfElement.style.opacity = '0';
            pdfElement.style.zIndex = '-1';
            pdfElement.style.left = '-10000px';

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            const pdfBlob = pdf.output('blob');

            // 2. LOGIKA ZA PERIOD (Ime fajla)
            // Ako su datumi isti, piše jedan datum, ako su različiti piše OD-DO
            const formatiranoOd = datumOd ? formatDatum(datumOd).replace(/\./g, '') : '';
            const formatiranoDo = datumDo ? formatDatum(datumDo).replace(/\./g, '') : '';
            const periodStr = formatiranoOd === formatiranoDo ? formatiranoOd : `${formatiranoOd}_do_${formatiranoDo}`;
            
            // 3. DOHVATANJE PUTANJE IZ POSTAVKI
            const { data: postavke } = await supabase.from('postavke_izvjestaja').select(nazivKoloneFolder).eq('id', 1).maybeSingle();
            const cistFolder = (postavke?.[nazivKoloneFolder] || 'Ostalo').replace(/\//g, '---');
            const timestamp = new Date().getTime();
            
            // Finalno ime za Make.com: FOLDER___MODUL_PERIOD_ID.pdf
            const fileName = `${cistFolder}___${nazivModula}_${periodStr}_${timestamp}.pdf`;

            // =========================================================
            // UBRZANJE: PRVO DAJEMO FAJL KORISNIKU
            // =========================================================
            pdf.save(`${nazivModula}_${periodStr}.pdf`);
            window.open(URL.createObjectURL(pdfBlob), '_blank');
            
            // =========================================================
            // ONDA ŠALJEMO U POZADINI U SUPABASE
            // =========================================================
            const { error: uploadError } = await supabase.storage
                .from('izvjestaji_buffer')
                .upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true });

            if (uploadError) {
                console.error("Greška pri slanju u Cloud:", uploadError);
            } else {
                console.log("🚀 Poslano u arhivu u pozadini.");
            }
            
        } catch (error) {
            console.error("Greška:", error);
            alert("Greška prilikom generisanja PDF-a.");
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    if (loading) return <div className="p-20 text-center text-blue-500 animate-pulse font-black text-xl uppercase tracking-widest">Analiziram doradu...</div>;
    if (!data) return <div className="p-20 text-center text-slate-500 font-bold">Nema podataka.</div>;

    return (
        <div className="w-full relative">
            <div className="space-y-6 text-slate-200">
                <div className="flex justify-between items-center bg-theme-card p-4 rounded-2xl border border-theme-border shadow-lg">
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 font-black uppercase">Filtriraj po Operateru:</span>
                        <select value={radnikFilter} onChange={e => setRadnikFilter(e.target.value)} className="bg-theme-panel text-blue-400 px-4 py-2 rounded-lg text-sm font-black outline-none border border-slate-700 uppercase tracking-widest cursor-pointer">
                            <option value="SVI">SVI ZAPOSLENI</option>
                            {data.smjenaInfo.sviRadnici.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    {/* OVDJE JE NOVI ONCLICK */}
                    <button onClick={() => generisiUltimativniPDF('Izvjestaj_Dorade', 'folder_dorada')} disabled={isGeneratingPDF} className={`${isGeneratingPDF ? 'bg-slate-600' : 'bg-blue-600 hover:bg-blue-500'} text-white px-6 py-2.5 rounded-xl text-sm font-black uppercase shadow-lg transition-all`}>
                        {isGeneratingPDF ? '⌛ Generisanje...' : '🖨️ Isprintaj PDF'}
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Card decoration="top" decorationColor="blue" className="bg-theme-card">
                        <Text className="text-slate-400 font-bold text-[9px] uppercase">Ulaz Sirovina</Text>
                        <Metric className="text-white text-xl mt-1">{data.kpi.ulazM3} <span className="text-sm">m³</span></Metric>
                    </Card>
                    <Card decoration="top" decorationColor="emerald" className="bg-theme-card">
                        <Text className="text-slate-400 font-bold text-[9px] uppercase">Izlaz Gotove Robe</Text>
                        <Metric className="text-emerald-400 text-xl mt-1">{data.kpi.izlazM3} <span className="text-sm">m³</span></Metric>
                    </Card>
                    <Card decoration="top" decorationColor="amber" className="bg-theme-card">
                        <Text className="text-slate-400 font-bold text-[9px] uppercase">Efikasnost Konverzije</Text>
                        <Metric className="text-amber-400 text-xl mt-1">{data.kpi.yieldProcenat} <span className="text-sm">%</span></Metric>
                    </Card>
                    <Card decoration="top" decorationColor="rose" className="bg-theme-card">
                        <Text className="text-slate-400 font-bold text-[9px] uppercase">Stvarni Kalo</Text>
                        <Metric className="text-rose-400 text-xl mt-1">{data.kpi.kaloM3} <span className="text-sm">m³</span></Metric>
                    </Card>
                    <Card decoration="top" decorationColor="red" className="bg-theme-card">
                        <Text className="text-slate-400 font-bold text-[9px] uppercase">Zastoji u smjeni</Text>
                        <Metric className="text-red-400 text-xl mt-1">{data.kpi.ukupnoZastojMin} <span className="text-sm">min</span></Metric>
                    </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-theme-card h-[300px]">
                        <Title className="text-slate-300 font-black text-[10px] uppercase mb-2 text-center">Prinos (Yield %) po obrađenom artiklu</Title>
                        <ResponsiveContainer width="100%" height="85%">
                            <BarChart data={data.yieldChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} unit="%" />
                                <Tooltip contentStyle={{backgroundColor: '#0f172a', border:'none', borderRadius:'12px', color:'#fff'}} cursor={{fill: '#1e293b'}} />
                                <Bar isAnimationActive={false} dataKey="Yield" fill={saas?.ui?.boja_akcenta_dorada || '#3b82f6'} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>

                    <Card className="bg-theme-card h-[300px]">
                        <Title className="text-slate-300 font-black text-[10px] uppercase mb-2 text-center">Raspodjela Operacija (m³)</Title>
                        <ResponsiveContainer width="100%" height="85%">
                            <PieChart>
                                <Pie isAnimationActive={false} data={data.grafikonOperacija} innerRadius="40%" outerRadius="80%" paddingAngle={2} dataKey="value" stroke="none">
                                    {data.grafikonOperacija.map((e, i) => <Cell key={`c-${i}`} fill={PALETA[i % PALETA.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={{backgroundColor: '#0f172a', border:'none', borderRadius:'12px', color:'#fff'}} formatter={(v) => `${v} m³`} />
                                <Legend wrapperStyle={{fontSize:'9px', fontWeight:'bold', color: '#fff'}} />
                            </PieChart>
                        </ResponsiveContainer>
                    </Card>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <Card className="bg-theme-card h-[250px]">
                        <Title className="text-slate-300 font-black text-[10px] uppercase mb-2 text-center">Dinamika rada (30 Dana): Volumen dorade (m³)</Title>
                        <ResponsiveContainer width="100%" height="85%">
                            <AreaChart data={data.trendChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                                <XAxis dataKey="dan" stroke="#64748b" fontSize={9} tickLine={false} />
                                <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                                <Tooltip contentStyle={{backgroundColor: '#0f172a', border:'none', borderRadius:'8px', color:'#fff'}} />
                                <Area isAnimationActive={false} type="monotone" dataKey="M3" name={data.smjenaInfo.glavniRadnik} stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </Card>

                    <Card className="bg-theme-card border-none">
                        <Title className="text-blue-400 font-black text-[10px] uppercase mb-2 border-b border-slate-700 pb-1">Forenzička Sljedivost (Odakle je proizvod nastao)</Title>
                        <table className="w-full text-left text-[9px]">
                            <thead className="text-slate-500 uppercase border-b border-slate-700">
                                <tr>
                                    <th className="py-1.5">Novi Paket (Izlaz)</th>
                                    <th className="py-1.5 text-center">Final m³</th>
                                    <th className="py-1.5 text-center">Ulaz m³ / Kalo</th>
                                    <th className="py-1.5">Sirovina</th>
                                    <th className="py-1.5">Operacije</th>
                                </tr>
                            </thead>
                            <tbody className="text-slate-200">
                            {data.trace_blokovi?.length === 0 && <tr><td colSpan="5" className="py-4 text-center italic text-slate-500">Nema evidentirane dorade.</td></tr>}
                            {(data.trace_blokovi || []).map((tb, i) => (
                                <tr key={i} className="border-b border-theme-border/50">
                                    <td className="py-1.5"><span className="font-black text-white">{tb.out_id}</span><span className="text-blue-400 ml-1">{tb.out_naziv} ({tb.out_dim})</span></td>
                                    <td className="py-1.5 text-center font-black text-emerald-400">{tb.out_m3}</td>
                                    <td className="py-1.5 text-center text-slate-300">{tb.in_m3} <span className="text-rose-400 text-[8px] ml-1">Kalo: {tb.kalo_m3}</span></td>
                                    <td className="py-1.5 text-[8px] text-slate-400 truncate max-w-[120px]">{tb.in_ids}</td>
                                    <td className="py-1.5 text-[8px] uppercase truncate max-w-[120px]">{tb.operacije}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </Card>
                </div>
            </div>

            {/* NEVIDLJIVI PDF KONTEJNER */}
            <div id="savrseni-pdf-dokument" style={{
                position: 'absolute', top: 0, left: '-9999px',
                width: '210mm', minHeight: '297mm',
                backgroundColor: 'white', color: '#0f172a',
                padding: '12mm', boxSizing: 'border-box',
                opacity: 0, zIndex: -1, fontFamily: 'sans-serif'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #0f172a', paddingBottom: '10px', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        {logoUrl ? <img src={logoUrl} style={{ maxHeight: '50px', maxWidth: '200px', objectFit: 'contain' }} alt="Logo" crossOrigin="anonymous" /> : <h1 style={{ fontSize: '24px', fontWeight: '900', margin: 0, color: '#0f172a' }}>{imeFirme}</h1>}
                        <div style={{ borderLeft: '2px solid #cbd5e1', paddingLeft: '15px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0, textTransform: 'uppercase', letterSpacing: '1px', color: '#0f172a' }}>Izvještaj Dorade</h2>
                            <p style={{ fontSize: '10px', color: '#475569', margin: '4px 0 0 0', fontWeight: 'bold' }}>{masinaFilter === 'SVE' ? 'Sve mašine' : masinaFilter} | Operater: {radnikFilter}</p>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: '#0f172a' }}>
                        <p style={{ margin: '0 0 4px 0' }}>Mjesto: <span style={{ fontWeight: 'normal' }}>{header?.mjesto || 'N/A'}</span></p>
                        <p style={{ margin: 0 }}>Datum: <span style={{ fontWeight: 'normal' }}>{formatDatum(datumOd)}</span></p>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    {[
                        { title: 'Ulaz Sirovina', val: data.kpi.ulazM3, unit: 'm³', color: '#3b82f6' },
                        { title: 'Izlaz Gotove Robe', val: data.kpi.izlazM3, unit: 'm³', color: '#10b981' },
                        { title: 'Efikasnost Konverzije', val: data.kpi.yieldProcenat, unit: '%', color: '#f59e0b' },
                        { title: 'Stvarni Kalo', val: data.kpi.kaloM3, unit: 'm³', color: '#f43f5e' },
                        { title: 'Zastoji u smjeni', val: data.kpi.ukupnoZastojMin, unit: 'min', color: '#ef4444' }
                    ].map((kpi, i) => (
                        <div key={i} style={{ width: '19%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px', borderTop: `4px solid ${kpi.color}` }}>
                            <div style={{ fontSize: '8px', color: '#475569', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>{kpi.title}</div>
                            <div style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a' }}>{kpi.val} <span style={{ fontSize: '10px', fontWeight: 'normal' }}>{kpi.unit}</span></div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <div style={{ width: '48%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px' }}>
                        <div style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', textAlign: 'center', marginBottom: '10px' }}>Prinos (Yield %) po obrađenom artiklu</div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <BarChart width={320} height={160} data={data.yieldChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={7} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={7} tickLine={false} axisLine={false} unit="%" />
                                <Bar isAnimationActive={false} dataKey="Yield" fill={saas?.ui?.boja_akcenta_dorada || '#3b82f6'} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </div>
                    </div>

                    <div style={{ width: '48%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px' }}>
                        <div style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', textAlign: 'center', marginBottom: '10px' }}>Raspodjela Operacija (m³)</div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <PieChart width={320} height={160}>
                                <Pie isAnimationActive={false} data={data.grafikonOperacija} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                                    {data.grafikonOperacija.map((e, i) => <Cell key={`c-${i}`} fill={PALETA[i % PALETA.length]} />)}
                                </Pie>
                                <Legend wrapperStyle={{fontSize:'8px', fontWeight:'bold', color: '#000'}} />
                            </PieChart>
                        </div>
                    </div>
                </div>

                <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px', marginBottom: '15px', pageBreakInside: 'avoid' }}>
                    <div style={{ fontSize: '9px', color: '#0f172a', fontWeight: '900', textTransform: 'uppercase', textAlign: 'center', marginBottom: '10px' }}>Dinamika rada (30 Dana): Volumen dorade (m³)</div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <AreaChart width={680} height={150} data={data.trendChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                            <XAxis dataKey="dan" stroke="#64748b" fontSize={7} tickLine={false} />
                            <YAxis stroke="#64748b" fontSize={7} tickLine={false} />
                            <Area isAnimationActive={false} type="monotone" dataKey="M3" name={data.smjenaInfo.glavniRadnik} stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} strokeWidth={2} />
                        </AreaChart>
                    </div>
                </div>

                <div style={{ width: '100%', marginBottom: '15px', pageBreakInside: 'auto' }}>
                    <div style={{ fontSize: '9px', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', borderBottom: '1px solid #0f172a', paddingBottom: '4px', marginBottom: '4px' }}>Forenzička Sljedivost (Traceability)</div>
                    <table style={{ width: '100%', fontSize: '8px', borderCollapse: 'collapse', color: '#0f172a' }}>
                        <thead>
                            <tr style={{ color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                                <th style={{ textAlign: 'left', padding: '4px 0' }}>Novi Paket (Izlaz)</th><th style={{ textAlign: 'center', padding: '4px 0' }}>Final m³</th><th style={{ textAlign: 'center', padding: '4px 0' }}>Ulaz m³ / Kalo</th><th style={{ textAlign: 'left', padding: '4px 0' }}>Korištena Sirovina</th><th style={{ textAlign: 'left', padding: '4px 0' }}>Operacije</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.trace_blokovi.length === 0 && <tr><td colSpan="5" style={{ padding: '4px', textAlign: 'center', color: '#475569' }}>Nema evidentirane dorade.</td></tr>}
                            {data.trace_blokovi.map((tb, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '4px 0', fontWeight: 'bold' }}>{tb.out_id} <span style={{ color: '#475569' }}>({tb.out_dim})</span></td>
                                    <td style={{ padding: '4px 0', textAlign: 'center', fontWeight: '900' }}>{tb.out_m3}</td>
                                    <td style={{ padding: '4px 0', textAlign: 'center' }}>{tb.in_m3} <span style={{ color: '#f43f5e', fontSize: '7px' }}>Kalo: {tb.kalo_m3}</span></td>
                                    <td style={{ padding: '4px 0', color: '#475569' }}>{tb.in_ids}</td>
                                    <td style={{ padding: '4px 0', textTransform: 'uppercase' }}>{tb.operacije}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #1e293b', paddingTop: '15px', pageBreakInside: 'avoid' }}>
                    <div style={{ width: '60%' }}>
                        <div style={{ fontSize: '10px', color: '#0f172a', fontWeight: '900', textTransform: 'uppercase', marginBottom: '6px' }}>Dnevnik Zastoja i Napomene</div>
                        {data.zastoji.length === 0 ? (
                            <p style={{ fontSize: '9px', color: '#64748b', fontStyle: 'italic', margin: 0 }}>Smjena je protekla bez zastoja.</p>
                        ) : (
                            <ul style={{ margin: 0, paddingLeft: '15px', fontSize: '9px', color: '#0f172a' }}>
                                {data.zastoji.map(z => (
                                    <li key={z.id} style={{ marginBottom: '4px' }}>
                                        <strong>{z.vrijeme_od} - {z.vrijeme_do || '...'}</strong> 
                                        {z.zastoj_min > 0 && <span style={{ color: '#ef4444', fontWeight: '900', margin: '0 6px' }}>({z.zastoj_min}m)</span>}
                                        <span>{z.napomena || 'Nema opisa'}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    
                    <div style={{ width: '35%', textAlign: 'right', fontSize: '9px', color: '#475569' }}>
                        <div style={{ textTransform: 'uppercase', color: '#0f172a', fontWeight: '900', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '6px' }}>Detalji Smjene</div>
                        <p style={{ margin: '0 0 4px 0' }}>Vrijeme rada: <strong style={{ color: '#0f172a' }}>{data.smjenaInfo.start} - {data.smjenaInfo.end}</strong></p>
                        <p style={{ margin: '0 0 4px 0' }}>Operateri: <strong style={{ color: '#0f172a' }}>{data.smjenaInfo.sviRadnici.join(', ') || 'Nema'}</strong></p>
                        
                        <div style={{ marginTop: '30px', paddingTop: '10px', borderTop: '1px solid #0f172a', textAlign: 'center', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase' }}>
                            Potpis Rukovodioca
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}