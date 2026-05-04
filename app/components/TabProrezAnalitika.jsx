"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { Card, Metric, Text, Title } from '@tremor/react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    
    const [logoUrl, setLogoUrl] = useState('');
    const [imeFirme, setImeFirme] = useState('SMART TIMBER');

    useEffect(() => {
        // Pouzdano povlačenje logotipa
        const logo = localStorage.getItem('saas_app_logo');
        if(logo) setLogoUrl(logo);
    }, []);

    useEffect(() => { ucitajDubokuAnalitiku(); }, [datumOd, datumDo, masinaFilter, brentistaFilter]);

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

            const sviDanLogovi = (logResData || []).filter(l => l.datum >= datumOd && l.datum <= datumDo && (masinaFilter === 'SVE' || l.masina === masinaFilter));
            const sviDanPaketi = paketiResData.filter(p => p.datum_yyyy_mm >= datumOd && p.datum_yyyy_mm <= datumDo && (masinaFilter === 'SVE' || p.masina === masinaFilter) && !imaSirovinu(p.ai_sirovina_ids));
            
            const dostupniBrentiste = [...new Set([...sviDanLogovi.map(l => l.brentista), ...sviDanPaketi.map(p => p.brentista)].filter(Boolean))];
            const danLogovi = sviDanLogovi.filter(l => brentistaFilter === 'SVI' || l.brentista === brentistaFilter);
            const danPaketi = sviDanPaketi.filter(p => brentistaFilter === 'SVI' || p.brentista === brentistaFilter);
            const danZastoji = zastojiResData.filter(z => (masinaFilter === 'SVE' || z.masina === masinaFilter) && (brentistaFilter === 'SVI' || z.snimio?.includes(brentistaFilter)));

            let ulazM3 = 0; let ulazKom = 0; let sumTotalPrecnik = 0;
            const trupciMap = {};

            danLogovi.forEach(l => {
                const t = trupciResData.find(tr => tr.id === l.trupac_id);
                if (t) {
                    const m3 = parseFloat(t.zapremina || 0); const precnik = parseFloat(t.promjer || 0); const duzina = parseFloat(t.duzina || 0).toFixed(1);
                    ulazM3 += m3; ulazKom += 1; sumTotalPrecnik += precnik;
                    if(!trupciMap[duzina]) trupciMap[duzina] = { duzina, kom: 0, m3: 0, sumPrecnik: 0 };
                    trupciMap[duzina].kom += 1; trupciMap[duzina].m3 += m3; trupciMap[duzina].sumPrecnik += precnik;
                }
            });

            const trupciStruktura = Object.values(trupciMap).map(t => ({ ...t, avgPrecnik: (t.sumPrecnik / t.kom).toFixed(1) })).sort((a,b) => parseFloat(b.duzina) - parseFloat(a.duzina));
            const prosjecanPrecnikGlavni = ulazKom > 0 ? (sumTotalPrecnik / ulazKom).toFixed(1) : 0;

            let izlazM3 = 0; const proizvodiMap = {};

            danPaketi.forEach(p => {
                const vol = parseFloat(p.kolicina_final || 0);
                izlazM3 += vol;
                const kljuc = p.naziv_proizvoda || 'Nepoznato';
                if(!proizvodiMap[kljuc]) proizvodiMap[kljuc] = { naziv: kljuc, m3: 0, kom: 0, paketi: [] };
                proizvodiMap[kljuc].m3 += vol;
                if ((p.jm || 'kom').toLowerCase() === 'kom') proizvodiMap[kljuc].kom += parseFloat(p.kolicina_ulaz || 0);
                proizvodiMap[kljuc].paketi.push(p);
            });

            const proizvodiStruktura = Object.values(proizvodiMap).sort((a,b) => b.m3 - a.m3);
            const grafikonProizvoda = proizvodiStruktura.map(p => ({ name: p.naziv, value: parseFloat(p.m3.toFixed(2)) }));
            const yieldProcenat = ulazM3 > 0 ? ((izlazM3 / ulazM3) * 100).toFixed(1) : 0;

            const svaVremena = [...danLogovi.map(l => l.vrijeme_unosa), ...danPaketi.map(p => p.vrijeme_tekst)].filter(Boolean).sort();
            let smjenaStart = 'N/A'; let smjenaEnd = 'N/A';
            if (svaVremena.length > 0) { smjenaStart = svaVremena[0].substring(0, 5); smjenaEnd = svaVremena[svaVremena.length - 1].substring(0, 5); }

            const sviViljuskaristi = [...new Set([...danLogovi.map(l => l.viljuskarista), ...danPaketi.map(p => p.viljuskarista)].filter(Boolean))].join(', ');
            const sviPomocni = [...new Set(danPaketi.map(p => p.radnici_pilana).filter(Boolean))].join(', ');
            const ukupnoZastojMin = danZastoji.reduce((sum, z) => sum + (parseInt(z.zastoj_min) || 0), 0);
            const efektivnoSati = Math.max(0.1, 8 - (ukupnoZastojMin / 60)); 
            const m3PoSatu = ulazM3 > 0 ? (ulazM3 / efektivnoSati).toFixed(2) : "0.00";

            const trendDaniMap = {}; const dDanas = new Date(datumDo);
            for (let i = 29; i >= 0; i--) {
                const d = new Date(dDanas.getTime() - i * 24 * 60 * 60 * 1000);
                const iso = d.toISOString().split('T')[0];
                trendDaniMap[iso] = { dan: `${d.getDate()}.${d.getMonth()+1}`, pilanaUlaz: 0, pilanaIzlaz: 0, brentistaUlaz: 0, brentistaIzlaz: 0 };
            }
            const targetBrentista = brentistaFilter !== 'SVI' ? brentistaFilter : (dostupniBrentiste[0] || 'Svi radnici');

            (logResData || []).forEach(l => {
                if(trendDaniMap[l.datum]) {
                    const t = trupciResData.find(tr => tr.id === l.trupac_id);
                    if(t) {
                        const m3 = parseFloat(t.zapremina || 0);
                        trendDaniMap[l.datum].pilanaUlaz += m3;
                        if(l.brentista === targetBrentista || brentistaFilter === 'SVI') trendDaniMap[l.datum].brentistaUlaz += m3;
                    }
                }
            });

            paketiResData.filter(p => !imaSirovinu(p.ai_sirovina_ids)).forEach(p => {
                if(trendDaniMap[p.datum_yyyy_mm]) {
                    const m3 = parseFloat(p.kolicina_final || 0);
                    trendDaniMap[p.datum_yyyy_mm].pilanaIzlaz += m3;
                    if(p.brentista === targetBrentista || brentistaFilter === 'SVI') trendDaniMap[p.datum_yyyy_mm].brentistaIzlaz += m3;
                }
            });

            const trendChartData = Object.values(trendDaniMap).map(d => ({
                dan: d.dan,
                PilanaYield: d.pilanaUlaz > 0 ? parseFloat(((d.pilanaIzlaz / d.pilanaUlaz) * 100).toFixed(1)) : 0,
                BrentistaYield: d.brentistaUlaz > 0 ? parseFloat(((d.brentistaIzlaz / d.brentistaUlaz) * 100).toFixed(1)) : 0,
            }));

            setData({
                kpi: { ulazM3: ulazM3.toFixed(2), ulazKom, prosjecanPrecnik: prosjecanPrecnikGlavni, izlazM3: izlazM3.toFixed(2), yieldProcenat, m3PoSatu, ukupnoZastojMin },
                trupciStruktura, proizvodiStruktura, grafikonProizvoda, trendChartData, zastoji: danZastoji,
                smjenaInfo: { sviBrentiste: dostupniBrentiste, viljuskaristi: sviViljuskaristi, pomocniRadnici: sviPomocni, start: smjenaStart, end: smjenaEnd, glavniBrentista: targetBrentista }
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

    if (loading) return <div className="p-20 text-center text-emerald-500 animate-pulse font-black text-xl uppercase tracking-widest">Slažem podatke...</div>;
    if (!data) return <div className="p-20 text-center text-slate-500 font-bold">Nema podataka.</div>;

    return (
        <div className="w-full relative text-slate-200">
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-theme-card p-4 rounded-2xl border border-theme-border shadow-lg">
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 font-black uppercase">Filtriraj po Brentisti:</span>
                        <select value={brentistaFilter} onChange={e => setBrentistaFilter(e.target.value)} className="bg-theme-panel text-emerald-400 px-4 py-2 rounded-lg text-sm font-black outline-none border border-slate-700 uppercase tracking-widest cursor-pointer">
                            <option value="SVI">SVI ZAPOSLENI</option>
                            {data.smjenaInfo.sviBrentiste.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                    {/* OVDJE JE NOVI ONCLICK */}
                    <button onClick={() => generisiUltimativniPDF('Izvjestaj_Proreza', 'folder_prorez')} disabled={isGeneratingPDF} className={`${isGeneratingPDF ? 'bg-slate-600' : 'bg-emerald-600 hover:bg-emerald-500'} text-white px-6 py-2.5 rounded-xl text-sm font-black uppercase shadow-lg transition-all`}>
                        {isGeneratingPDF ? '⌛ Generisanje...' : '🖨️ Isprintaj PDF'}
                    </button>
                </div>

                {/* SVE OSTALO OSTAJE ISTO ZA EKRAN */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Card decoration="top" decorationColor="emerald" className="bg-theme-card">
                        <Text className="text-slate-400 font-bold text-[9px] uppercase">Izrezano Trupaca</Text>
                        <Metric className="text-white text-xl mt-1">{data.kpi.ulazM3} <span className="text-sm">m³</span></Metric>
                    </Card>
                    <Card decoration="top" decorationColor="blue" className="bg-theme-card">
                        <Text className="text-slate-400 font-bold text-[9px] uppercase">Proizvedeno (Izlaz)</Text>
                        <Metric className="text-white text-xl mt-1">{data.kpi.izlazM3} <span className="text-sm">m³</span></Metric>
                    </Card>
                    <Card decoration="top" decorationColor="amber" className="bg-theme-card">
                        <Text className="text-slate-400 font-bold text-[9px] uppercase">Iskorištenost (Yield)</Text>
                        <Metric className="text-amber-400 text-xl mt-1">{data.kpi.yieldProcenat} <span className="text-sm">%</span></Metric>
                    </Card>
                    <Card decoration="top" decorationColor="purple" className="bg-theme-card">
                        <Text className="text-slate-400 font-bold text-[9px] uppercase">Brzina Rezanja</Text>
                        <Metric className="text-purple-400 text-xl mt-1">{data.kpi.m3PoSatu} <span className="text-sm">m³/h</span></Metric>
                    </Card>
                    <Card decoration="top" decorationColor="red" className="bg-theme-card">
                        <Text className="text-slate-400 font-bold text-[9px] uppercase">Zastoji u smjeni</Text>
                        <Metric className="text-red-400 text-xl mt-1">{data.kpi.ukupnoZastojMin} <span className="text-sm">min</span></Metric>
                    </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-5 bg-theme-card border border-slate-700 rounded-2xl p-5">
                        <Title className="text-slate-300 font-black text-[10px] uppercase mb-2 border-b border-slate-700 pb-1">Trupci po dužinama (Sirovina)</Title>
                        <table className="w-full text-left text-[10px]">
                            <thead className="text-slate-500 uppercase border-b border-slate-700">
                                <tr><th className="py-1.5">L (m)</th><th className="py-1.5 text-center">Kom</th><th className="py-1.5 text-center">Ø Prosjek</th><th className="py-1.5 text-right">m³</th></tr>
                            </thead>
                            <tbody className="text-slate-200 font-bold">
                                {data.trupciStruktura.length === 0 && <tr><td colSpan="4" className="py-2 text-center italic text-slate-500">Nema evidentiranih trupaca.</td></tr>}
                                {data.trupciStruktura.map(t => (
                                    <tr key={t.duzina} className="border-b border-theme-border/50">
                                        <td className="py-1.5 text-emerald-400">{t.duzina} m</td>
                                        <td className="py-1.5 text-center">{t.kom}</td>
                                        <td className="py-1.5 text-center text-slate-400">Ø {t.avgPrecnik} cm</td>
                                        <td className="py-1.5 text-right font-black">{t.m3.toFixed(2)}</td>
                                    </tr>
                                ))}
                                <tr className="border-t-2 border-slate-600 font-black text-xs">
                                    <td className="py-2 text-white">UKUPNO:</td>
                                    <td className="py-2 text-center text-white">{data.kpi.ulazKom}</td>
                                    <td className="py-2 text-center text-slate-400">Ø {data.kpi.prosjecanPrecnik}</td>
                                    <td className="py-2 text-right text-emerald-400">{data.kpi.ulazM3}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="md:col-span-7 bg-theme-card border border-slate-700 rounded-2xl p-5">
                        <Title className="text-slate-300 font-black text-[10px] uppercase mb-2 border-b border-slate-700 pb-1">Proizvedeno (Gotova Roba)</Title>
                        <table className="w-full text-left text-[10px]">
                            <thead className="text-slate-500 uppercase border-b border-slate-700">
                                <tr><th className="py-1.5">Artikal (Vrsta)</th><th className="py-1.5 text-center">Kom / m1 / m2</th><th className="py-1.5 text-right">m³ (Volumen)</th></tr>
                            </thead>
                            <tbody className="text-slate-200">
                                {data.proizvodiStruktura.length === 0 && <tr><td colSpan="3" className="py-2 text-center italic text-slate-500">Nema proizvedene građe.</td></tr>}
                                {data.proizvodiStruktura.map((p, i) => (
                                    <React.Fragment key={i}>
                                        <tr className="bg-theme-panel/30 border-y border-slate-700/50">
                                            <td className="py-1.5 font-black text-blue-400 text-[10px] uppercase" colSpan="3">{p.naziv}</td>
                                        </tr>
                                        {(p.paketi || []).map(paket => (
                                            <tr key={paket.id} className="border-b border-theme-border/30">
                                                <td className="py-1 pl-2 font-bold">{paket.paket_id} <span className="text-slate-500 ml-1">({paket.debljina}x{paket.sirina}x{paket.duzina})</span></td>
                                                <td className="py-1 text-center font-bold">{paket.kolicina_ulaz} {paket.jm}</td>
                                                <td className="py-1 text-right font-black text-xs">{paket.kolicina_final}</td>
                                            </tr>
                                        ))}
                                        <tr className="border-b-2 border-slate-700/50 font-black">
                                            <td className="py-1.5 text-slate-400 text-right pr-4" colSpan="2">Ukupno:</td>
                                            <td className="py-1.5 text-right text-blue-500 text-[11px]">{p.m3.toFixed(3)}</td>
                                        </tr>
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-theme-card h-[300px]">
                        <Title className="text-slate-300 font-black text-[10px] uppercase mb-2 text-center">Učešće proizvoda u prorezu</Title>
                        <ResponsiveContainer width="100%" height="85%">
                            <PieChart>
                                <Pie isAnimationActive={false} data={data.grafikonProizvoda} innerRadius="40%" outerRadius="80%" paddingAngle={2} dataKey="value" stroke="none">
                                    {data.grafikonProizvoda.map((e, i) => <Cell key={`c-${i}`} fill={PALETA[i % PALETA.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={{backgroundColor: '#0f172a', border:'none', borderRadius:'12px', color:'#fff'}} formatter={(v) => `${v} m³`} />
                                <Legend wrapperStyle={{fontSize:'9px', fontWeight:'bold', color: '#fff'}} />
                            </PieChart>
                        </ResponsiveContainer>
                    </Card>

                    <Card className="bg-theme-card h-[300px]">
                        <Title className="text-slate-300 font-black text-[10px] uppercase mb-2 text-center">Trend Iskorištenja (30 Dana)</Title>
                        <ResponsiveContainer width="100%" height="85%">
                            <LineChart data={data.trendChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                                <XAxis dataKey="dan" stroke="#64748b" fontSize={9} tickLine={false} />
                                <YAxis stroke="#64748b" fontSize={9} tickLine={false} unit="%" />
                                <Tooltip contentStyle={{backgroundColor: '#0f172a', border:'none', borderRadius:'8px', color:'#fff'}} />
                                <Legend wrapperStyle={{fontSize:'9px'}} />
                                <Line isAnimationActive={false} type="monotone" dataKey="PilanaYield" name="Prosjek Pilane" stroke="#94a3b8" strokeWidth={2} dot={false} />
                                <Line isAnimationActive={false} type="monotone" dataKey="BrentistaYield" name={brentistaFilter === 'SVI' ? 'Svi radnici' : brentistaFilter} stroke="#10b981" strokeWidth={3} dot={{r:2}} />
                            </LineChart>
                        </ResponsiveContainer>
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
                            <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0, textTransform: 'uppercase', letterSpacing: '1px', color: '#0f172a' }}>Izvještaj Proreza</h2>
                            <p style={{ fontSize: '10px', color: '#475569', margin: '4px 0 0 0', fontWeight: 'bold' }}>{masinaFilter === 'SVE' ? 'Sve mašine' : masinaFilter} | Brentista: {brentistaFilter}</p>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: '#0f172a' }}>
                        <p style={{ margin: '0 0 4px 0' }}>Mjesto: <span style={{ fontWeight: 'normal' }}>{header?.mjesto || 'N/A'}</span></p>
                        <p style={{ margin: 0 }}>Datum: <span style={{ fontWeight: 'normal' }}>{formatDatum(datumOd)}</span></p>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    {[
                        { title: 'Izrezano Trupaca', val: data.kpi.ulazM3, unit: 'm³', color: '#10b981' },
                        { title: 'Proizvedeno (Izlaz)', val: data.kpi.izlazM3, unit: 'm³', color: '#3b82f6' },
                        { title: 'Iskorištenost (Yield)', val: data.kpi.yieldProcenat, unit: '%', color: '#f59e0b' },
                        { title: 'Brzina Rezanja', val: data.kpi.m3PoSatu, unit: 'm³/h', color: '#8b5cf6' },
                        { title: 'Zastoji u smjeni', val: data.kpi.ukupnoZastojMin, unit: 'min', color: '#ef4444' }
                    ].map((kpi, i) => (
                        <div key={i} style={{ width: '19%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px', borderTop: `4px solid ${kpi.color}` }}>
                            <div style={{ fontSize: '8px', color: '#475569', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>{kpi.title}</div>
                            <div style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a' }}>{kpi.val} <span style={{ fontSize: '10px', fontWeight: 'normal' }}>{kpi.unit}</span></div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <div style={{ width: '38%' }}>
                        <div style={{ fontSize: '9px', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', borderBottom: '1px solid #0f172a', paddingBottom: '4px', marginBottom: '4px' }}>Trupci po dužinama (Sirovina)</div>
                        <table style={{ width: '100%', fontSize: '9px', borderCollapse: 'collapse', color: '#0f172a' }}>
                            <thead>
                                <tr style={{ color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                                    <th style={{ textAlign: 'left', padding: '4px 0' }}>L (m)</th><th style={{ padding: '4px 0' }}>Kom</th><th style={{ padding: '4px 0' }}>Ø Prosjek</th><th style={{ textAlign: 'right', padding: '4px 0' }}>m³</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.trupciStruktura.map(t => (
                                    <tr key={t.duzina} style={{ borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>
                                        <td style={{ padding: '4px 0' }}>{t.duzina}</td><td style={{ textAlign: 'center', padding: '4px 0' }}>{t.kom}</td><td style={{ textAlign: 'center', padding: '4px 0', color: '#475569' }}>Ø {t.avgPrecnik}</td><td style={{ textAlign: 'right', padding: '4px 0' }}>{t.m3.toFixed(2)}</td>
                                    </tr>
                                ))}
                                <tr style={{ fontWeight: '900', borderTop: '2px solid #0f172a' }}>
                                    <td style={{ padding: '6px 0' }}>UKUPNO:</td><td style={{ textAlign: 'center', padding: '6px 0' }}>{data.kpi.ulazKom}</td><td style={{ textAlign: 'center', padding: '6px 0' }}>Ø {data.kpi.prosjecanPrecnik}</td><td style={{ textAlign: 'right', padding: '6px 0' }}>{data.kpi.ulazM3}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div style={{ width: '58%' }}>
                        <div style={{ fontSize: '9px', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', borderBottom: '1px solid #0f172a', paddingBottom: '4px', marginBottom: '4px' }}>Proizvedeno (Gotova Roba)</div>
                        <table style={{ width: '100%', fontSize: '9px', borderCollapse: 'collapse', color: '#0f172a' }}>
                            <thead>
                                <tr style={{ color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                                    <th style={{ textAlign: 'left', padding: '4px 0' }}>Artikal (Vrsta)</th><th style={{ textAlign: 'center', padding: '4px 0' }}>Kom / m1 / m2</th><th style={{ textAlign: 'right', padding: '4px 0' }}>m³ (Volumen)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.proizvodiStruktura.map((p, i) => (
                                    <React.Fragment key={i}>
                                        <tr style={{ backgroundColor: '#f1f5f9' }}><td colSpan="3" style={{ padding: '4px', fontWeight: '900', fontSize: '9px', textTransform: 'uppercase' }}>{p.naziv}</td></tr>
                                        {(p.paketi || []).map(paket => (
                                            <tr key={paket.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={{ padding: '4px', fontWeight: 'bold' }}>{paket.paket_id} <span style={{ color: '#475569', marginLeft: '4px' }}>({paket.debljina}x{paket.sirina}x{paket.duzina})</span></td>
                                                <td style={{ textAlign: 'center', padding: '4px', fontWeight: 'bold' }}>{paket.kolicina_ulaz} {paket.jm}</td>
                                                <td style={{ textAlign: 'right', padding: '4px', fontWeight: '900' }}>{paket.kolicina_final}</td>
                                            </tr>
                                        ))}
                                        <tr style={{ borderBottom: '2px solid #0f172a', fontWeight: '900' }}>
                                            <td colSpan="2" style={{ textAlign: 'right', padding: '4px', color: '#475569' }}>Ukupno:</td>
                                            <td style={{ textAlign: 'right', padding: '4px' }}>{p.m3.toFixed(3)}</td>
                                        </tr>
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <div style={{ width: '48%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px' }}>
                        <div style={{ fontSize: '9px', color: '#0f172a', fontWeight: '900', textTransform: 'uppercase', textAlign: 'center', marginBottom: '10px' }}>Učešće proizvoda u prorezu</div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <PieChart width={320} height={180}>
                                <Pie isAnimationActive={false} data={data.grafikonProizvoda} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                                    {data.grafikonProizvoda.map((e, i) => <Cell key={`c-${i}`} fill={PALETA[i % PALETA.length]} />)}
                                </Pie>
                                <Legend wrapperStyle={{fontSize:'8px', fontWeight:'bold', color: '#000'}} />
                            </PieChart>
                        </div>
                    </div>

                    <div style={{ width: '48%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px' }}>
                        <div style={{ fontSize: '9px', color: '#0f172a', fontWeight: '900', textTransform: 'uppercase', textAlign: 'center', marginBottom: '10px' }}>Trend Iskorištenja (30 Dana)</div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <LineChart width={320} height={180} data={data.trendChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                                <XAxis dataKey="dan" stroke="#64748b" fontSize={8} tickLine={false} />
                                <YAxis stroke="#64748b" fontSize={8} tickLine={false} unit="%" />
                                <Legend wrapperStyle={{fontSize:'8px'}} />
                                <Line isAnimationActive={false} type="monotone" dataKey="PilanaYield" name="Prosjek Pilane" stroke="#94a3b8" strokeWidth={2} dot={false} />
                                <Line isAnimationActive={false} type="monotone" dataKey="BrentistaYield" name={brentistaFilter === 'SVI' ? 'Svi radnici' : brentistaFilter} stroke="#10b981" strokeWidth={3} dot={{r:2}} />
                            </LineChart>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', paddingTop: '15px', pageBreakInside: 'avoid' }}>
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
                        <p style={{ margin: '0 0 4px 0' }}>Brentisti: <strong style={{ color: '#0f172a' }}>{data.smjenaInfo.sviBrentiste.join(', ') || 'Nema'}</strong></p>
                        <p style={{ margin: '0 0 4px 0' }}>Viljuškaristi: <strong style={{ color: '#0f172a' }}>{data.smjenaInfo.viljuskaristi || 'Nema'}</strong></p>
                        <p style={{ margin: '0 0 4px 0' }}>Pomoćni: <strong style={{ color: '#0f172a' }}>{data.smjenaInfo.pomocniRadnici || 'Nema'}</strong></p>
                        
                        <div style={{ marginTop: '30px', paddingTop: '10px', borderTop: '1px solid #0f172a', textAlign: 'center', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase' }}>
                            Potpis Rukovodioca
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}