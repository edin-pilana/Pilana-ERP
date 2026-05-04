"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { Card, Metric, Text, Title } from '@tremor/react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const supabase = createClient('https://awaxwejrhmjeqohrgidm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY');
const formatDatum = (iso) => { if(!iso) return ''; const [y, m, d] = iso.split('T')[0].split('-'); return `${d}.${m}.${y}.`; };

export default function TabFinansijeAnalitika({ datumOd, datumDo, saas, header }) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [logoUrl, setLogoUrl] = useState('');
    const [imeFirme, setImeFirme] = useState('SMART TIMBER');

    useEffect(() => { const logo = localStorage.getItem('saas_app_logo'); if(logo) setLogoUrl(logo); }, []);
    useEffect(() => { ucitajObrazacProizvodnje(); }, [datumOd, datumDo]);

    const ucitajObrazacProizvodnje = async () => {
        setLoading(true);
        try {
            const [prorezRes, paketiRes, masineRes, radniciRes, katalogRes] = await Promise.all([
                supabase.from('prorez_log').select('*').gte('datum', datumOd).lte('datum', datumDo),
                supabase.from('paketi').select('*').gte('datum_yyyy_mm', datumOd).lte('datum_yyyy_mm', datumDo),
                supabase.from('masine').select('*'),
                supabase.from('radnici').select('*'),
                supabase.from('katalog_proizvoda').select('*')
            ]);

            const logovi = prorezRes.data || [];
            const paketi = paketiRes.data || [];
            const masineDB = masineRes.data || [];
            const radniciDB = radniciRes.data || [];
            const katalogDB = katalogRes.data || [];

            let ukupnaVrijednostRobe = 0;
            const proizvodnjaTabelaMap = {};

            paketi.forEach(p => {
                const m3 = parseFloat(p.kolicina_final || 0);
                const kat = katalogDB.find(k => k.sifra === p.naziv_proizvoda || k.naziv === p.naziv_proizvoda);
                let cijenaBaza = kat ? parseFloat(kat.cijena || 0) : 0;
                
                let izracunataVr = 0;
                if(kat && kat.default_jedinica !== 'm3' && kat.default_jedinica !== 'M3') {
                    const v = parseFloat(p.debljina)||1; const s = parseFloat(p.sirina)||1; const d = parseFloat(p.duzina)||1;
                    const vol1kom = (v/100) * (s/100) * (d/100);
                    izracunataVr = vol1kom > 0 ? (m3 / vol1kom) * cijenaBaza : 0;
                } else {
                    izracunataVr = m3 * cijenaBaza;
                }
                ukupnaVrijednostRobe += izracunataVr;

                const kljuc = p.naziv_proizvoda || 'Nepoznato';
                if(!proizvodnjaTabelaMap[kljuc]) proizvodnjaTabelaMap[kljuc] = { naziv: kljuc, m3: 0, vrijednost: 0, cijenaPrikaz: `${cijenaBaza} KM/${kat?.default_jedinica || 'm³'}` };
                proizvodnjaTabelaMap[kljuc].m3 += m3;
                proizvodnjaTabelaMap[kljuc].vrijednost += izracunataVr;
            });

            let ukupniTrosakPrerade = 0;
            const tabelaTroskova = [];

            // --- NOVO: TROŠAK SIROVINE (NABAVNA CIJENA TRUPACA) ---
            const trupacIds = logovi.map(l => l.trupac_id);
            let trosakSirovine = 0;
            let zapreminaSirovine = 0;

            if (trupacIds.length > 0) {
                const { data: trupciData } = await supabase.from('trupci').select('id, zapremina, kontrolna_zapremina, nabavna_vrijednost').in('id', trupacIds);
                if (trupciData) {
                    trupciData.forEach(t => {
                        trosakSirovine += parseFloat(t.nabavna_vrijednost || 0);
                        zapreminaSirovine += parseFloat(t.kontrolna_zapremina || t.zapremina || 0);
                    });
                }
            }

            if (trosakSirovine > 0) {
                ukupniTrosakPrerade += trosakSirovine;
                tabelaTroskova.push({ tip: '1_Sirovina', naziv: 'Sirovina (Zaduženje trupaca)', kolicina: `${zapreminaSirovine.toFixed(2)} m³`, cijena: '-', ukupno: trosakSirovine });
            }
            // --------------------------------------------------------

            const masineTrosakMap = {};
            paketi.forEach(p => {
                const masinaNaziv = p.masina;
                if(!masinaNaziv) return;
                if(!masineTrosakMap[masinaNaziv]) masineTrosakMap[masinaNaziv] = 0;
                masineTrosakMap[masinaNaziv] += parseFloat(p.kolicina_final || 0);
            });

            Object.keys(masineTrosakMap).forEach(mNaziv => {
                const masina = masineDB.find(m => m.naziv === mNaziv);
                const cijenaM3 = masina ? parseFloat(masina.cijena_m3 || 0) : 0;
                const m3Ucinak = masineTrosakMap[mNaziv];
                const trosak = m3Ucinak * cijenaM3;
                
                ukupniTrosakPrerade += trosak;
                if(trosak > 0 || m3Ucinak > 0) {
                    tabelaTroskova.push({ tip: '2_Mašina', naziv: mNaziv, kolicina: `${m3Ucinak.toFixed(2)} m³`, cijena: `${cijenaM3} KM/m³`, ukupno: trosak });
                }
            });

            const radniciDnevniceMap = {}; 
            logovi.forEach(l => {
                if(l.brentista) radniciDnevniceMap[l.brentista] = (radniciDnevniceMap[l.brentista]||new Set()).add(l.datum);
                if(l.viljuskarista) radniciDnevniceMap[l.viljuskarista] = (radniciDnevniceMap[l.viljuskarista]||new Set()).add(l.datum);
            });
            paketi.forEach(p => {
                if(p.snimio_korisnik) radniciDnevniceMap[p.snimio_korisnik] = (radniciDnevniceMap[p.snimio_korisnik]||new Set()).add(p.datum_yyyy_mm);
            });

            let ukupnoSatiRadnika = 0; let ukupnoTrosakRadnika = 0;
            Object.keys(radniciDnevniceMap).forEach(rIme => {
                const radnik = radniciDB.find(r => r.ime_prezime === rIme);
                const sati = radniciDnevniceMap[rIme].size * 8; 
                ukupnoSatiRadnika += sati;
                ukupnoTrosakRadnika += (sati * (radnik ? parseFloat(radnik.bruto_satnica || 0) : 0));
            });

            if (ukupnoTrosakRadnika > 0) {
                ukupniTrosakPrerade += ukupnoTrosakRadnika;
                tabelaTroskova.push({ tip: '3_Radnici', naziv: `Zaposleni (${Object.keys(radniciDnevniceMap).length})`, kolicina: `${ukupnoSatiRadnika} sati`, cijena: `-`, ukupno: ukupnoTrosakRadnika });
            }

            const brutoProfit = ukupnaVrijednostRobe - ukupniTrosakPrerade;

            setData({
                kpi: { 
                    vrijednostRobe: ukupnaVrijednostRobe.toFixed(2), trosakPrerade: ukupniTrosakPrerade.toFixed(2), dodataVrijednost: brutoProfit.toFixed(2)
                },
                tabelaProizvodnje: Object.values(proizvodnjaTabelaMap).sort((a,b) => b.vrijednost - a.vrijednost),
                tabelaTroskova: tabelaTroskova.sort((a, b) => a.tip.localeCompare(b.tip)),
                grafikonFinansija: [
                    { name: 'Vrijednost Robe', Iznos: parseFloat(ukupnaVrijednostRobe.toFixed(2)) },
                    { name: 'Totalni Trošak', Iznos: parseFloat(ukupniTrosakPrerade.toFixed(2)) },
                    { name: 'Čisti Profit', Iznos: parseFloat(brutoProfit.toFixed(2)) }
                ]
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
            
            const { error: uploadError } = await supabase.storage.from('izvjestaji_buffer').upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true });
            if (uploadError) console.error("Greška pri slanju u Cloud:", uploadError);
            
        } catch (error) {
            alert("Greška prilikom generisanja PDF-a.");
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    if (loading) return <div className="p-20 text-center text-emerald-500 animate-pulse font-black text-xl uppercase tracking-widest">Slažem finansije...</div>;
    if (!data) return <div className="p-20 text-center text-slate-500 font-bold">Nema podataka.</div>;

    const marzaBojaText = parseFloat(data.kpi.dodataVrijednost) >= 0 ? 'text-emerald-400' : 'text-red-500';
    const marzaBojaPDF = parseFloat(data.kpi.dodataVrijednost) >= 0 ? '#10b981' : '#ef4444';

    return (
        <div className="w-full relative text-slate-200">
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-theme-card p-4 rounded-2xl border border-theme-border shadow-lg">
                    <div>
                        <h3 className="text-emerald-500 font-black uppercase text-sm tracking-widest">Finansijska Analitika</h3>
                        <p className="text-xs text-slate-400">Pregled prodajne vrijednosti i svih troškova (uključujući nabavku trupaca).</p>
                    </div>
                    <button onClick={() => generisiUltimativniPDF('Izvjestaj_Finansije', 'folder_finansije')} disabled={isGeneratingPDF} className={`${isGeneratingPDF ? 'bg-slate-600' : 'bg-emerald-600 hover:bg-emerald-500'} text-white px-6 py-2.5 rounded-xl text-sm font-black uppercase shadow-lg transition-all`}>
                        {isGeneratingPDF ? '⌛ Generisanje...' : '🖨️ Isprintaj PDF'}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card decoration="top" decorationColor="blue" className="bg-theme-card">
                        <Text className="text-slate-400 font-bold text-[9px] uppercase">Tržišna Vrijednost Robe</Text>
                        <Metric className="text-white mt-1 text-2xl">{parseFloat(data.kpi.vrijednostRobe).toLocaleString('bs-BA')} <span className="text-sm">KM</span></Metric>
                    </Card>
                    <Card decoration="top" decorationColor="rose" className="bg-theme-card">
                        <Text className="text-slate-400 font-bold text-[9px] uppercase">Trošak (Sirovina + Prerada)</Text>
                        <Metric className="text-rose-400 mt-1 text-2xl">- {parseFloat(data.kpi.trosakPrerade).toLocaleString('bs-BA')} <span className="text-sm">KM</span></Metric>
                    </Card>
                    <Card decoration="top" decorationColor="emerald" className="bg-theme-card">
                        <Text className="text-slate-400 font-bold text-[9px] uppercase">Čisti Profit</Text>
                        <Metric className={`${marzaBojaText} mt-1 text-2xl`}>{parseFloat(data.kpi.dodataVrijednost).toLocaleString('bs-BA')} <span className="text-sm">KM</span></Metric>
                    </Card>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <Card className="bg-theme-card border-none p-0 overflow-hidden">
                        <div className="p-4 border-b border-slate-700">
                            <Title className="text-slate-300 font-black text-[10px] uppercase">1. Vrijednost Proizvedene Robe</Title>
                        </div>
                        <table className="w-full text-left text-[10px]">
                            <thead className="bg-theme-card text-slate-500 uppercase font-black border-b border-slate-700">
                                <tr><th className="w-[45%] py-2 pl-4">Proizvod / Vrsta</th><th className="w-[15%] py-2 text-center">m³</th><th className="w-[20%] py-2 text-center">Cijena (Baza)</th><th className="w-[20%] py-2 pr-4 text-right">Ukupno (KM)</th></tr>
                            </thead>
                            <tbody className="text-white font-bold">
                                {data.tabelaProizvodnje.map((p, i) => (
                                    <tr key={i} className="border-b border-theme-border/50">
                                        <td className="py-2 pl-4 text-blue-400 uppercase">{p.naziv}</td><td className="py-2 text-center">{p.m3.toFixed(3)}</td><td className="py-2 text-center text-slate-400">{p.cijenaPrikaz}</td><td className="py-2 pr-4 text-right text-emerald-400 font-black text-[11px]">{p.vrijednost.toLocaleString('bs-BA')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>

                    <Card className="bg-theme-card border-none p-0 overflow-hidden">
                        <div className="p-4 border-b border-slate-700">
                            <Title className="text-slate-300 font-black text-[10px] uppercase">2. Troškovi (Sirovina + Rad + Mašine)</Title>
                        </div>
                        <table className="w-full text-left text-[10px]">
                            <thead className="bg-theme-card text-slate-500 uppercase font-black border-b border-slate-700">
                                <tr><th className="w-[45%] py-2 pl-4">Resurs</th><th className="w-[15%] py-2 text-center">Učinak</th><th className="w-[20%] py-2 text-center">Jed. Cijena</th><th className="w-[20%] py-2 pr-4 text-right">Trošak (KM)</th></tr>
                            </thead>
                            <tbody className="text-white font-bold">
                                {data.tabelaTroskova.map((t, i) => (
                                    <tr key={i} className="border-b border-theme-border/50">
                                        <td className="py-2 pl-4 uppercase">{t.naziv}</td><td className="py-2 text-center text-slate-300">{t.kolicina}</td><td className="py-2 text-center text-slate-400">{t.cijena}</td><td className="py-2 pr-4 text-right text-rose-400 font-black text-[11px]">- {t.ukupno.toLocaleString('bs-BA')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>

                    <Card className="bg-theme-card h-[300px] flex flex-col">
                        <Title className="text-slate-300 font-black text-[10px] uppercase mb-4 text-center">Sveukupni Finansijski Rezultat (KM)</Title>
                        <div className="flex-1 flex justify-center items-center w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.grafikonFinansija} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} tickFormatter={v => `${v/1000}k`} />
                                    <Tooltip contentStyle={{backgroundColor: '#0f172a', border:'none', borderRadius:'8px', color:'#fff'}} cursor={{fill: '#1e293b'}} formatter={(v) => `${v.toLocaleString('bs-BA')} KM`} />
                                    <Bar isAnimationActive={false} dataKey="Iznos" radius={[4, 4, 0, 0]} barSize={40}>
                                        {data.grafikonFinansija.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.name === 'Totalni Trošak' ? '#ef4444' : (entry.name === 'Čisti Profit' ? '#10b981' : '#f59e0b')} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>
            </div>

            <div id="savrseni-pdf-dokument" style={{ position: 'absolute', top: '-10000px', left: 0, width: '210mm', minHeight: '297mm', backgroundColor: 'white', color: '#0f172a', padding: '12mm', boxSizing: 'border-box', fontFamily: 'sans-serif' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #0f172a', paddingBottom: '10px', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        {logoUrl ? <img src={logoUrl} style={{ maxHeight: '50px', maxWidth: '200px', objectFit: 'contain' }} alt="Logo" crossOrigin="anonymous" /> : <h1 style={{ fontSize: '24px', fontWeight: '900', margin: 0, color: '#0f172a' }}>{imeFirme}</h1>}
                        <div style={{ borderLeft: '2px solid #cbd5e1', paddingLeft: '15px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0, textTransform: 'uppercase', letterSpacing: '1px', color: '#0f172a' }}>Finansijski Obračun</h2>
                            <p style={{ fontSize: '10px', color: '#475569', margin: '4px 0 0 0', fontWeight: 'bold' }}>Vrijednost robe, troškovi i profit</p>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: '#0f172a' }}>
                        <p style={{ margin: '0 0 4px 0' }}>Mjesto: <span style={{ fontWeight: 'normal' }}>{header?.mjesto || 'Fabrika'}</span></p>
                        <p style={{ margin: 0 }}>Period: <span style={{ fontWeight: 'normal' }}>{formatDatum(datumOd)} {datumOd !== datumDo ? `- ${formatDatum(datumDo)}` : ''}</span></p>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    {[
                        { title: 'Tržišna Vrijednost Robe', val: parseFloat(data.kpi.vrijednostRobe).toLocaleString('bs-BA'), unit: 'KM', color: '#3b82f6' },
                        { title: 'Trošak (Sirovina + Prerada)', val: `- ${parseFloat(data.kpi.trosakPrerade).toLocaleString('bs-BA')}`, unit: 'KM', color: '#ef4444' },
                        { title: 'Čisti Profit', val: parseFloat(data.kpi.dodataVrijednost).toLocaleString('bs-BA'), unit: 'KM', color: marzaBojaPDF }
                    ].map((kpi, i) => (
                        <div key={i} style={{ width: '31%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px', borderTop: `4px solid ${kpi.color}` }}>
                            <div style={{ fontSize: '9px', color: '#475569', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px' }}>{kpi.title}</div>
                            <div style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>{kpi.val} <span style={{ fontSize: '10px', fontWeight: 'normal' }}>{kpi.unit}</span></div>
                        </div>
                    ))}
                </div>

                <div style={{ width: '100%', marginBottom: '20px', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: '900', fontSize: '10px', textTransform: 'uppercase', color: '#0f172a' }}>1. Vrijednost Proizvedene Robe</div>
                    <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse', color: '#0f172a' }}>
                        <thead style={{ backgroundColor: '#f1f5f9' }}>
                            <tr style={{ color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                                <th style={{ textAlign: 'left', padding: '6px 12px' }}>Proizvod / Vrsta</th><th style={{ textAlign: 'center', padding: '6px 12px' }}>m³</th><th style={{ textAlign: 'right', padding: '6px 12px' }}>Ukupno (KM)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.tabelaProizvodnje.map((k, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '6px 12px', fontWeight: 'bold', textTransform: 'uppercase' }}>{k.naziv}</td>
                                    <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 'bold' }}>{k.m3.toFixed(3)}</td>
                                    <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: '900' }}>{k.vrijednost.toLocaleString('bs-BA')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ width: '100%', marginBottom: '20px', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: '900', fontSize: '10px', textTransform: 'uppercase', color: '#0f172a' }}>2. Troškovi (Sirovina + Radnici + Mašine)</div>
                    <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse', color: '#0f172a' }}>
                        <thead style={{ backgroundColor: '#f1f5f9' }}>
                            <tr style={{ color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                                <th style={{ textAlign: 'left', padding: '6px 12px' }}>Resurs</th><th style={{ textAlign: 'center', padding: '6px 12px' }}>Učinak</th><th style={{ textAlign: 'right', padding: '6px 12px' }}>Trošak (KM)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.tabelaTroskova.map((t, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '6px 12px', fontWeight: 'bold', textTransform: 'uppercase' }}>{t.naziv}</td>
                                    <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 'bold', color: '#475569' }}>{t.kolicina}</td>
                                    <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: '900', color: '#ef4444' }}>- {t.ukupno.toLocaleString('bs-BA')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px' }}>
                    <div style={{ fontSize: '9px', color: '#0f172a', fontWeight: '900', textTransform: 'uppercase', textAlign: 'center', marginBottom: '10px' }}>Sveukupni Finansijski Rezultat (KM)</div>
                    <div style={{ display: 'flex', justifyItems: 'center' }}>
                        <BarChart width={600} height={200} data={data.grafikonFinansija} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={8} tickLine={false} axisLine={false} />
                            <YAxis stroke="#64748b" fontSize={8} tickLine={false} axisLine={false} tickFormatter={v => `${v/1000}k`} />
                            <Bar isAnimationActive={false} dataKey="Iznos" radius={[4, 4, 0, 0]} barSize={50}>
                                {data.grafikonFinansija.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.name === 'Totalni Trošak' ? '#ef4444' : (entry.name === 'Čisti Profit' ? '#10b981' : '#f59e0b')} />
                                ))}
                            </Bar>
                        </BarChart>
                    </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #1e293b', paddingTop: '15px', marginTop: '20px', pageBreakInside: 'avoid' }}>
                    <div style={{ width: '60%', fontSize: '8px', color: '#475569' }}>Dokument generisan iz SmartTimber ERP softvera - {new Date().toLocaleString('bs-BA')}</div>
                    <div style={{ width: '35%', textAlign: 'center', fontSize: '9px', color: '#475569' }}><div style={{ paddingTop: '10px', borderTop: '1px solid #1e293b', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase' }}>Direktor / Vlasnik</div></div>
                </div>
            </div>
        </div>
    );
}