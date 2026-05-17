"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { Card, Metric, Text, Title } from '@tremor/react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const supabase = createClient('https://awaxwejrhmjeqohrgidm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY');
const PALETA = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

const formatDatum = (iso) => { if(!iso) return ''; const [y, m, d] = iso.split('T')[0].split('-'); return `${d}.${m}.${y}.`; };
const imaSirovinu = (val) => { if (!val) return false; if (Array.isArray(val) && val.length > 0) return true; if (typeof val === 'string') return val.replace(/[{}"[\]\s]/g, '').length > 0; return false; };

export default function TabUkupnoAnalitika({ datumOd, datumDo, saas, header }) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [logoUrl, setLogoUrl] = useState('');
    const [imeFirme, setImeFirme] = useState('SMART TIMBER');

    useEffect(() => {
        const logo = localStorage.getItem('saas_app_logo');
        if(logo) setLogoUrl(logo);
    }, []);

    useEffect(() => { ucitajUkupnuAnalitiku(); }, [datumOd, datumDo]);

    const ucitajUkupnuAnalitiku = async () => {
        setLoading(true);
        try {
            const [trupciRes, prorezRes, paketiRes] = await Promise.all([
                // 🟢 ZADRŽANA SVA LOGIKA: Povlačimo trupce od početka za tačan bilans zaliha
                supabase.from('trupci').select('*').gte('datum_prijema', '2020-01-01'),
                supabase.from('prorez_log').select('*').gte('datum', datumOd).lte('datum', datumDo),
                supabase.from('paketi').select('*').gte('datum_yyyy_mm', datumOd).lte('datum_yyyy_mm', datumDo)
            ]);

            const logovi = prorezRes.data || [];
            const paketi = paketiRes.data || [];
            const trupciDB = trupciRes.data || [];

            let ulazTrupciM3 = 0; const iskoristeniTrupci = new Set();
            logovi.forEach(l => {
                if(!iskoristeniTrupci.has(l.trupac_id)) {
                    iskoristeniTrupci.add(l.trupac_id);
                    const t = trupciDB.find(tr => tr.id === l.trupac_id);
                    if(t) ulazTrupciM3 += parseFloat(t.zapremina || 0);
                }
            });

            // 🟢 DODATO: Racunamo koliko je prijavljeno kala na placu (krojenje) za odabrani period
            let kaloKrojenjeM3 = 0;
            trupciDB.forEach(t => {
                if (t.klasa === 'KALO/OGRJEV' && t.datum_prijema >= datumOd && t.datum_prijema <= datumDo) {
                    kaloKrojenjeM3 += parseFloat(t.zapremina || 0);
                }
            });

            let pilanaIzlazM3 = 0; let doradaIzlazM3 = 0; let doradaUlazSirovineM3 = 0;
            const proizvodiMap = {};

            paketi.forEach(p => {
                const m3 = parseFloat(p.kolicina_final || 0);
                const isDorada = imaSirovinu(p.ai_sirovina_ids);

                if (isDorada) { doradaIzlazM3 += m3; doradaUlazSirovineM3 += parseFloat(p.kolicina_ulaz || m3); } 
                else { pilanaIzlazM3 += m3; }

                const naziv = p.naziv_proizvoda || 'Ostalo';
                proizvodiMap[naziv] = (proizvodiMap[naziv] || 0) + m3;
            });

            const pilanaKaloM3 = Math.max(0, ulazTrupciM3 - pilanaIzlazM3);
            const doradaKaloM3 = Math.max(0, doradaUlazSirovineM3 - doradaIzlazM3);
            const ukupanIzlazGOTOVE_ROBE = pilanaIzlazM3 + doradaIzlazM3;

            const grafikonTokMaterijala = [
                { name: 'Sirovina (Ulaz)', M3: parseFloat(ulazTrupciM3.toFixed(2)) },
                { name: 'Proizvedeno (Izlaz)', M3: parseFloat(ukupanIzlazGOTOVE_ROBE.toFixed(2)) },
                { name: 'Otpad od Rezova', M3: parseFloat((pilanaKaloM3 + doradaKaloM3).toFixed(2)) },
                { name: 'Kalo (Krojenje)', M3: parseFloat(kaloKrojenjeM3.toFixed(2)) } // 🟢 Dodano na grafikon
            ];

            const grafikonProizvoda = Object.keys(proizvodiMap).map(k => ({ name: k, value: parseFloat(proizvodiMap[k].toFixed(2)) })).sort((a,b) => b.value - a.value).slice(0,10);

            setData({
                kpi: {
                    ulazTrupci: ulazTrupciM3.toFixed(2), izlazGotoveRobe: ukupanIzlazGOTOVE_ROBE.toFixed(2),
                    ukupnoKalo: (pilanaKaloM3 + doradaKaloM3).toFixed(2), 
                    iskoristenost: ulazTrupciM3 > 0 ? ((ukupanIzlazGOTOVE_ROBE / ulazTrupciM3) * 100).toFixed(1) : 0,
                    kaloKrojenje: kaloKrojenjeM3.toFixed(2)
                },
                grafikonTokMaterijala, grafikonProizvoda,
                tabelaProizvodnje: Object.keys(proizvodiMap).map(k => ({ naziv: k, m3: proizvodiMap[k] })).sort((a,b) => b.m3 - a.m3)
            });
            setLoading(false);

        } catch (error) { setLoading(false); }
    };

    const generisiUltimativniPDF = async (nazivModula, nazivKoloneFolder) => {
        setIsGeneratingPDF(true);
        try {
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

            const formatiranoOd = datumOd ? formatDatum(datumOd).replace(/\./g, '') : '';
            const formatiranoDo = datumDo ? formatDatum(datumDo).replace(/\./g, '') : '';
            const periodStr = formatiranoOd === formatiranoDo ? formatiranoOd : `${formatiranoOd}_do_${formatiranoDo}`;
            
            const { data: postavke } = await supabase.from('postavke_izvjestaja').select(nazivKoloneFolder).eq('id', 1).maybeSingle();
            const cistFolder = (postavke?.[nazivKoloneFolder] || 'Ostalo').replace(/\//g, '---');
            const timestamp = new Date().getTime();
            
            const fileName = `${cistFolder}___${nazivModula}_${periodStr}_${timestamp}.pdf`;

            pdf.save(`${nazivModula}_${periodStr}.pdf`);
            window.open(URL.createObjectURL(pdfBlob), '_blank');
            
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

    if (loading) return <div className="p-20 text-center text-indigo-500 animate-pulse font-black text-xl uppercase tracking-widest">Sastavljam analitiku...</div>;
    if (!data) return <div className="p-20 text-center text-slate-500 font-bold">Nema podataka.</div>;

    return (
        <div className="w-full relative text-slate-200">
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-theme-card p-4 rounded-2xl border border-theme-border shadow-lg">
                    <div>
                        <h3 className="text-blue-400 font-black uppercase text-sm tracking-widest">Analitika Materijala (Kubici)</h3>
                        <p className="text-xs text-slate-400">Prikaz ulaza sirovine, izlaza robe i stvarnog kala u proizvodnji.</p>
                    </div>
                    <button onClick={() => generisiUltimativniPDF('Analitika_Materijala', 'folder_ukupno')} disabled={isGeneratingPDF} className={`${isGeneratingPDF ? 'bg-slate-600' : 'bg-blue-600 hover:bg-blue-500'} text-white px-6 py-2.5 rounded-xl text-sm font-black uppercase shadow-lg transition-all`}>
                        {isGeneratingPDF ? '⌛ Generisanje...' : '🖨️ Isprintaj PDF'}
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <Card decoration="top" decorationColor="blue" className="bg-theme-card">
                        <Text className="text-slate-400 font-bold text-[9px] uppercase">Ulaz Sirovine (Trupci)</Text>
                        <Metric className="text-white mt-1 text-xl">{data.kpi.ulazTrupci} <span className="text-sm">m³</span></Metric>
                    </Card>
                    <Card decoration="top" decorationColor="emerald" className="bg-theme-card">
                        <Text className="text-slate-400 font-bold text-[9px] uppercase">Ukupno Proizvedeno</Text>
                        <Metric className="text-emerald-400 mt-1 text-xl">{data.kpi.izlazGotoveRobe} <span className="text-sm">m³</span></Metric>
                    </Card>
                    <Card decoration="top" decorationColor="amber" className="bg-theme-card">
                        <Text className="text-slate-400 font-bold text-[9px] uppercase">Efikasnost Fabrike (Yield)</Text>
                        <Metric className="text-amber-400 mt-1 text-xl">{data.kpi.iskoristenost} <span className="text-sm">%</span></Metric>
                    </Card>
                    <Card decoration="top" decorationColor="rose" className="bg-theme-card">
                        <Text className="text-slate-400 font-bold text-[9px] uppercase">Stvarni Otpad (Rezovi)</Text>
                        <Metric className="text-rose-400 mt-1 text-xl">{data.kpi.ukupnoKalo} <span className="text-sm">m³</span></Metric>
                    </Card>
                    <Card decoration="top" decorationColor="orange" className="bg-theme-card border-orange-500/30">
                        <Text className="text-slate-400 font-bold text-[9px] uppercase">Kalo od krojenja</Text>
                        <Metric className="text-orange-400 mt-1 text-xl">{data.kpi.kaloKrojenje} <span className="text-sm">m³</span></Metric>
                    </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-theme-card h-[300px] flex flex-col">
                        <Title className="text-slate-300 font-black text-[10px] uppercase mb-4 text-center">Bilans Materijala (Ulaz / Izlaz / Kalo)</Title>
                        <div className="flex-1 flex justify-center items-center w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.grafikonTokMaterijala} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{backgroundColor: '#0f172a', border:'none', borderRadius:'8px', color:'#fff'}} cursor={{fill: '#1e293b'}} formatter={(v) => `${v} m³`} />
                                    <Bar isAnimationActive={false} dataKey="M3" radius={[4, 4, 0, 0]} barSize={40}>
                                        {data.grafikonTokMaterijala.map((entry, index) => {
                                            let boja = '#10b981';
                                            if (entry.name === 'Otpad od Rezova') boja = '#ef4444';
                                            if (entry.name === 'Sirovina (Ulaz)') boja = '#3b82f6';
                                            if (entry.name === 'Kalo (Krojenje)') boja = '#f97316';
                                            return <Cell key={`cell-${index}`} fill={boja} />;
                                        })}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <Card className="bg-theme-card h-[300px] flex flex-col">
                        <Title className="text-slate-300 font-black text-[10px] uppercase mb-4 text-center">Učešće Gotovih Proizvoda (m³)</Title>
                        <div className="flex-1 flex justify-center items-center w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie isAnimationActive={false} data={data.grafikonProizvoda} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                                        {data.grafikonProizvoda.map((e, i) => <Cell key={`c-${i}`} fill={PALETA[i % PALETA.length]} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{backgroundColor: '#0f172a', border:'none', borderRadius:'12px', color:'#fff'}} formatter={(v) => `${v} m³`} />
                                    <Legend wrapperStyle={{fontSize:'9px', fontWeight:'bold', color: '#fff'}} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>
            </div>

            {/* NEVIDLJIVI PDF KONTEJNER */}
            <div id="savrseni-pdf-dokument" style={{
                position: 'absolute', top: '-10000px', left: 0,
                width: '210mm', minHeight: '297mm',
                backgroundColor: 'white', color: '#0f172a',
                padding: '12mm', boxSizing: 'border-box',
                fontFamily: 'sans-serif'
             }}>
                <div style={{ display: 'flex', justifyItems: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #0f172a', paddingBottom: '10px', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        {logoUrl ? <img src={logoUrl} style={{ maxHeight: '50px', maxWidth: '200px', objectFit: 'contain' }} alt="Logo" crossOrigin="anonymous" /> : <h1 style={{ fontSize: '24px', fontWeight: '900', margin: 0, color: '#0f172a' }}>{imeFirme}</h1>}
                        <div style={{ borderLeft: '2px solid #cbd5e1', paddingLeft: '15px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0, textTransform: 'uppercase', letterSpacing: '1px', color: '#0f172a' }}>Analitika Materijala</h2>
                            <p style={{ fontSize: '10px', color: '#475569', margin: '4px 0 0 0', fontWeight: 'bold' }}>Zbirni bilans ulaza i izlaza</p>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: '#0f172a' }}>
                        <p style={{ margin: '0 0 4px 0' }}>Mjesto: <span style={{ fontWeight: 'normal' }}>{header?.mjesto || 'Fabrika'}</span></p>
                        <p style={{ margin: 0 }}>Period: <span style={{ fontWeight: 'normal' }}>{formatDatum(datumOd)} {datumOd !== datumDo ? `- ${formatDatum(datumDo)}` : ''}</span></p>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    {[
                        { title: 'Ulaz Sirovine', val: data.kpi.ulazTrupci, unit: 'm³', color: '#3b82f6' },
                        { title: 'Ukupno Proizvedeno', val: data.kpi.izlazGotoveRobe, unit: 'm³', color: '#10b981' },
                        { title: 'Efikasnost Fabrike', val: data.kpi.iskoristenost, unit: '%', color: '#f59e0b' },
                        { title: 'Stvarni Otpad', val: data.kpi.ukupnoKalo, unit: 'm³', color: '#f43f5e' },
                        { title: 'Kalo (Krojenje)', val: data.kpi.kaloKrojenje, unit: 'm³', color: '#f97316' }
                    ].map((kpi, i) => (
                        <div key={i} style={{ width: '19%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px', borderTop: `4px solid ${kpi.color}` }}>
                            <div style={{ fontSize: '7px', color: '#475569', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px' }}>{kpi.title}</div>
                            <div style={{ fontSize: '14px', fontWeight: '900', color: '#0f172a' }}>{kpi.val} <span style={{ fontSize: '8px', fontWeight: 'normal' }}>{kpi.unit}</span></div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div style={{ width: '48%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px' }}>
                        <div style={{ fontSize: '9px', color: '#0f172a', fontWeight: '900', textTransform: 'uppercase', textAlign: 'center', marginBottom: '10px' }}>Bilans Materijala (Ulaz / Izlaz / Kalo)</div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <BarChart width={320} height={180} data={data.grafikonTokMaterijala} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={8} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={8} tickLine={false} axisLine={false} />
                                <Bar isAnimationActive={false} dataKey="M3" radius={[4, 4, 0, 0]} barSize={40}>
                                    {data.grafikonTokMaterijala.map((entry, index) => {
                                        let boja = '#10b981';
                                        if (entry.name === 'Otpad od Rezova') boja = '#ef4444';
                                        if (entry.name === 'Sirovina (Ulaz)') boja = '#3b82f6';
                                        if (entry.name === 'Kalo (Krojenje)') boja = '#f97316';
                                        return <Cell key={`cell-${index}`} fill={boja} />;
                                    })}
                                </Bar>
                            </BarChart>
                        </div>
                    </div>

                    <div style={{ width: '48%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px' }}>
                        <div style={{ fontSize: '9px', color: '#0f172a', fontWeight: '900', textTransform: 'uppercase', textAlign: 'center', marginBottom: '10px' }}>Učešće Gotovih Proizvoda (m³)</div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <PieChart width={320} height={180}>
                                <Pie isAnimationActive={false} data={data.grafikonProizvoda} cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={2} dataKey="value" stroke="none">
                                    {data.grafikonProizvoda.map((e, i) => <Cell key={`c-${i}`} fill={PALETA[i % PALETA.length]} />)}
                                </Pie>
                                <Legend wrapperStyle={{fontSize:'8px', fontWeight:'bold', color: '#000'}} />
                            </PieChart>
                        </div>
                    </div>
                </div>

                <div style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: '900', fontSize: '10px', textTransform: 'uppercase', color: '#0f172a' }}>Lista Proizvedene Robe</div>
                    <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse', color: '#0f172a' }}>
                        <thead style={{ backgroundColor: '#f1f5f9' }}>
                            <tr style={{ color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                                <th style={{ textAlign: 'left', padding: '6px 12px' }}>Naziv Proizvoda</th><th style={{ textAlign: 'right', padding: '6px 12px' }}>Volumen (m³)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.tabelaProizvodnje.map((k, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '6px 12px', fontWeight: 'bold', textTransform: 'uppercase' }}>{k.naziv}</td>
                                    <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: '900' }}>{k.m3.toFixed(3)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #1e293b', paddingTop: '15px', marginTop: '20px' }}>
                    <div style={{ width: '60%', fontSize: '8px', color: '#475569' }}>
                        Dokument generisan iz SmartTimber ERP softvera - {new Date().toLocaleString('bs-BA')}
                    </div>
                    <div style={{ width: '35%', textAlign: 'center', fontSize: '9px', color: '#475569' }}>
                        <div style={{ paddingTop: '10px', borderTop: '1px solid #1e293b', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase' }}>
                            Direktor / Vlasnik
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}