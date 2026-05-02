"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { Card, Metric, Text, Title } from '@tremor/react';

const supabase = createClient('https://awaxwejrhmjeqohrgidm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY');

const PALETA = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e'];

const formatDatum = (iso) => {
    if(!iso) return '';
    const [y, m, d] = iso.split('T')[0].split('-'); return `${d}.${m}.${y}.`;
};

const imaSirovinu = (val) => {
    if (!val) return false;
    if (Array.isArray(val) && val.length > 0) return true;
    if (typeof val === 'string') return val.replace(/[{}"[\]\s]/g, '').length > 0;
    return false;
};

export default function TabFinansijeAnalitika({ datumOd, datumDo, saas, header }) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    
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
        ucitajObrazacProizvodnje();
    }, [datumOd, datumDo]);

    const ucitajObrazacProizvodnje = async () => {
        setLoading(true);
        try {
            const [trupciRes, prorezRes, paketiRes, masineRes, radniciRes, katalogRes] = await Promise.all([
                supabase.from('trupci').select('*').gte('datum_prijema', '2020-01-01'), 
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
            const trupciDB = trupciRes.data || [];

            // --- 1. KALKULACIJA MATERIJALA ---
            let ulazM3 = 0;
            const iskoristeniTrupci = new Set();
            logovi.forEach(l => {
                if(!iskoristeniTrupci.has(l.trupac_id)) {
                    iskoristeniTrupci.add(l.trupac_id);
                    const t = trupciDB.find(tr => tr.id === l.trupac_id);
                    if(t) ulazM3 += parseFloat(t.zapremina || 0);
                }
            });
            paketi.filter(p => imaSirovinu(p.ai_sirovina_ids)).forEach(p => {
                ulazM3 += parseFloat(p.kolicina_ulaz || p.kolicina_final || 0);
            });

            let izlazM3 = 0;
            let ukupnaVrijednostRobe = 0;
            const proizvodnjaTabelaMap = {};

            paketi.forEach(p => {
                const m3 = parseFloat(p.kolicina_final || 0);
                izlazM3 += m3;

                const kat = katalogDB.find(k => k.sifra === p.naziv_proizvoda || k.naziv === p.naziv_proizvoda);
                let cijenaBaza = kat ? parseFloat(kat.cijena || 0) : 0;
                let jedCijenaTabela = `${cijenaBaza} KM/${kat?.default_jedinica || 'm³'}`;
                
                let izracunataVr = 0;
                if(kat && kat.default_jedinica !== 'm3' && kat.default_jedinica !== 'M3') {
                    const v = parseFloat(p.debljina)||1; const s = parseFloat(p.sirina)||1; const d = parseFloat(p.duzina)||1;
                    const vol1kom = (v/100) * (s/100) * (d/100);
                    const komada = vol1kom > 0 ? (m3 / vol1kom) : 0;
                    izracunataVr = komada * cijenaBaza;
                } else {
                    izracunataVr = m3 * cijenaBaza;
                }
                ukupnaVrijednostRobe += izracunataVr;

                const kljuc = p.naziv_proizvoda || 'Nepoznato';
                if(!proizvodnjaTabelaMap[kljuc]) proizvodnjaTabelaMap[kljuc] = { naziv: kljuc, m3: 0, vrijednost: 0, cijenaPrikaz: jedCijenaTabela };
                proizvodnjaTabelaMap[kljuc].m3 += m3;
                proizvodnjaTabelaMap[kljuc].vrijednost += izracunataVr;
            });

            const kaloM3 = Math.max(0, ulazM3 - izlazM3);
            const tabelaProizvodnje = Object.values(proizvodnjaTabelaMap).sort((a,b) => b.vrijednost - a.vrijednost);
            const grafikonVrijednosti = tabelaProizvodnje.map(p => ({ name: p.naziv, value: parseFloat(p.vrijednost.toFixed(2)) })).slice(0, 10); 

            // --- 2. TROŠKOVI PRERADE ---
            let ukupniTrosakPrerade = 0;
            const tabelaTroskova = [];

            // A) Mašine (odvojeno po mašini)
            const masineTrosakMap = {};
            paketi.forEach(p => {
                const masinaNaziv = p.masina;
                if(!masinaNaziv) return;
                const m3 = parseFloat(p.kolicina_final || 0);
                if(!masineTrosakMap[masinaNaziv]) masineTrosakMap[masinaNaziv] = 0;
                masineTrosakMap[masinaNaziv] += m3;
            });

            Object.keys(masineTrosakMap).forEach(mNaziv => {
                const masina = masineDB.find(m => m.naziv === mNaziv);
                const cijenaM3 = masina ? parseFloat(masina.cijena_m3 || 0) : 0;
                const m3Ucinak = masineTrosakMap[mNaziv];
                const trosak = m3Ucinak * cijenaM3;
                
                ukupniTrosakPrerade += trosak;
                if(trosak > 0 || m3Ucinak > 0) {
                    tabelaTroskova.push({ tip: 'Mašina', naziv: mNaziv, kolicina: `${m3Ucinak.toFixed(2)} m³`, cijena: `${cijenaM3} KM/m³`, ukupno: trosak });
                }
            });

            // B) ZBIRNI Radnici
            const radniciDnevniceMap = {}; 
            
            logovi.forEach(l => {
                if(l.brentista) { if(!radniciDnevniceMap[l.brentista]) radniciDnevniceMap[l.brentista] = new Set(); radniciDnevniceMap[l.brentista].add(l.datum); }
                if(l.viljuskarista) { if(!radniciDnevniceMap[l.viljuskarista]) radniciDnevniceMap[l.viljuskarista] = new Set(); radniciDnevniceMap[l.viljuskarista].add(l.datum); }
            });

            paketi.forEach(p => {
                if(p.snimio_korisnik) { if(!radniciDnevniceMap[p.snimio_korisnik]) radniciDnevniceMap[p.snimio_korisnik] = new Set(); radniciDnevniceMap[p.snimio_korisnik].add(p.datum_yyyy_mm); }
                if(p.brentista) { if(!radniciDnevniceMap[p.brentista]) radniciDnevniceMap[p.brentista] = new Set(); radniciDnevniceMap[p.brentista].add(p.datum_yyyy_mm); }
                if(p.radnici_pilana) {
                    p.radnici_pilana.split(',').forEach(r => {
                        const ime = r.trim();
                        if(ime) { if(!radniciDnevniceMap[ime]) radniciDnevniceMap[ime] = new Set(); radniciDnevniceMap[ime].add(p.datum_yyyy_mm); }
                    });
                }
            });

            let ukupnoSatiRadnika = 0;
            let ukupnoTrosakRadnika = 0;
            let brojRadnika = Object.keys(radniciDnevniceMap).length;

            Object.keys(radniciDnevniceMap).forEach(rIme => {
                const radnik = radniciDB.find(r => r.ime_prezime === rIme);
                const satnica = radnik ? parseFloat(radnik.bruto_satnica || 0) : 0;
                const brojDana = radniciDnevniceMap[rIme].size;
                const sati = brojDana * 8; // Pretpostavka 8h radnog vremena
                ukupnoSatiRadnika += sati;
                ukupnoTrosakRadnika += (sati * satnica);
            });

            if (brojRadnika > 0) {
                ukupniTrosakPrerade += ukupnoTrosakRadnika;
                const prosjecnaSatnica = ukupnoSatiRadnika > 0 ? (ukupnoTrosakRadnika / ukupnoSatiRadnika).toFixed(2) : "0.00";
                
                // Samo JEDAN zbirni red za sve radnike
                tabelaTroskova.push({ 
                    tip: 'Radnici', 
                    naziv: `Zaposleni (Ukupno: ${brojRadnika})`, 
                    kolicina: `${ukupnoSatiRadnika} sati`, 
                    cijena: `Prosjek: ${prosjecnaSatnica} KM/h`, 
                    ukupno: ukupnoTrosakRadnika 
                });
            }

            tabelaTroskova.sort((a, b) => a.tip.localeCompare(b.tip));

            const dodataVrijednost = ukupnaVrijednostRobe - ukupniTrosakPrerade;

            const grafikonTroskovi = [
                { name: 'Vrijednost Robe', Iznos: parseFloat(ukupnaVrijednostRobe.toFixed(2)) },
                { name: 'Trošak Prerade', Iznos: parseFloat(ukupniTrosakPrerade.toFixed(2)) },
                { name: 'Bruto Marža', Iznos: Math.max(0, parseFloat(dodataVrijednost.toFixed(2))) }
            ];

            setData({
                kpi: { 
                    ulazM3: ulazM3.toFixed(2), 
                    izlazM3: izlazM3.toFixed(2), 
                    kaloM3: kaloM3.toFixed(2), 
                    vrijednostRobe: ukupnaVrijednostRobe.toFixed(2), 
                    trosakPrerade: ukupniTrosakPrerade.toFixed(2),
                    dodataVrijednost: dodataVrijednost.toFixed(2)
                },
                tabelaProizvodnje,
                tabelaTroskova,
                grafikonVrijednosti,
                grafikonTroskovi
            });
            setLoading(false);

        } catch (error) {
            console.error("Greška u proizvodnoj analitici:", error);
            setLoading(false);
        }
    };

    const pokreniPrint = () => {
        const title = `${datumOd}_finansije`;
        document.title = title;
        window.print();
        setTimeout(() => document.title = "TTM ERP", 2000);
    };

    if (loading) return <div className="p-20 text-center text-emerald-500 animate-pulse font-black text-xl uppercase tracking-widest">Slažem proizvodni obračun...</div>;
    if (!data) return <div className="p-20 text-center text-slate-500 font-bold">Nema podataka.</div>;

    const marzaBoja = parseFloat(data.kpi.dodataVrijednost) >= 0 ? 'text-emerald-400 print:text-emerald-700' : 'text-red-500 print:text-red-600';

    return (
        <div className="space-y-6 bg-white print:bg-white print:text-black text-slate-200 w-full max-w-[210mm] mx-auto print:max-w-none">
            
            {/* ======================================================== */}
            {/* PRINT HEADER */}
            {/* ======================================================== */}
            <div className="hidden print:flex justify-between items-end border-b-2 border-theme-border pb-4 mb-6 pt-4">
                <div className="flex items-center gap-4">
                    {logoUrl ? <img src={logoUrl} alt="Logo" className="max-h-16 object-contain" /> : <h1 className="text-3xl font-black text-slate-900">{imeFirme}</h1>}
                    <div className="border-l-2 border-slate-300 pl-4 ml-2">
                        <h2 className="text-xl font-black uppercase text-slate-800 tracking-widest">Proizvodni Obračun</h2>
                        <p className="text-sm text-slate-500 font-bold">Vrijednost robe, troškovi i kalo</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm font-black text-slate-800 uppercase">Mjesto: <span className="font-normal">{header?.mjesto || 'Fabrika'}</span></p>
                    <p className="text-sm font-black text-slate-800 uppercase">Period: <span className="font-normal">{formatDatum(datumOd)} {datumOd !== datumDo ? `- ${formatDatum(datumDo)}` : ''}</span></p>
                </div>
            </div>

            {/* EKRAN KONTROLE */}
            <div className="flex justify-between items-center bg-theme-card p-4 rounded-2xl border border-theme-border shadow-lg print:hidden">
                <div>
                    <h3 className="text-emerald-500 font-black uppercase text-sm tracking-widest">Proizvodni Obračun (Cijena Koštanja)</h3>
                    <p className="text-xs text-slate-400">Puni pregled prerađenog materijala, utrošenih mašina, radnika i tržišne vrijednosti robe.</p>
                </div>
                <button onClick={pokreniPrint} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                    🖨️ Isprintaj PDF
                </button>
            </div>

            {/* 1. TOP KPI KARTICE */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:gap-2">
                <Card decoration="top" decorationColor="blue" className="bg-theme-card print:bg-white print:border-slate-300 border-slate-700 p-4 print:p-3 shadow-xl">
                    <Text className="text-slate-400 print:text-slate-500 font-bold text-[9px] uppercase">Tržišna Vrijednost Robe</Text>
                    <Metric className="text-white print:text-black mt-1 text-lg font-mono">{parseFloat(data.kpi.vrijednostRobe).toLocaleString('bs-BA')} KM</Metric>
                    <Text className="text-slate-500 text-[9px] mt-1 font-bold uppercase">Proizvedeno: {data.kpi.izlazM3} m³</Text>
                </Card>
                
                <Card decoration="top" decorationColor="rose" className="bg-theme-card print:bg-white print:border-slate-300 border-slate-700 p-4 print:p-3 shadow-xl">
                    <Text className="text-slate-400 print:text-slate-500 font-bold text-[9px] uppercase">Trošak Prerade (COGS)</Text>
                    <Metric className="text-rose-400 print:text-rose-600 mt-1 text-lg font-mono">- {parseFloat(data.kpi.trosakPrerade).toLocaleString('bs-BA')} KM</Metric>
                    <Text className="text-slate-500 text-[9px] mt-1 font-bold uppercase">Mašine + Radnici</Text>
                </Card>

                <Card decoration="top" decorationColor="amber" className="bg-theme-card print:bg-white print:border-slate-300 border-slate-700 p-4 print:p-3 shadow-xl">
                    <Text className="text-slate-400 print:text-slate-500 font-bold text-[9px] uppercase">Generisani Otpad (Kalo)</Text>
                    <Metric className="text-amber-400 print:text-amber-600 mt-1 text-lg font-mono">{data.kpi.kaloM3} m³</Metric>
                    <Text className="text-slate-500 text-[9px] mt-1 font-bold uppercase">Ulaz: {data.kpi.ulazM3} m³</Text>
                </Card>

                <Card decoration="top" decorationColor="emerald" className="bg-theme-card print:bg-white print:border-slate-300 border-slate-700 p-4 print:p-3 shadow-xl">
                    <Text className="text-slate-400 print:text-slate-500 font-bold text-[9px] uppercase">Neto Dodata Vrijednost</Text>
                    <Metric className={`${marzaBoja} mt-1 text-lg font-mono`}>{parseFloat(data.kpi.dodataVrijednost).toLocaleString('bs-BA')} KM</Metric>
                    <Text className="text-slate-500 text-[9px] mt-1 font-bold uppercase">Vrijednost - Trošak</Text>
                </Card>
            </div>

            {/* 2. TABELE: VRIJEDNOST ROBE I TROŠKOVI (Zagreban CSS problem riješen!) */}
            <div className="grid grid-cols-1 gap-6 print:gap-4 page-break-avoid">
                
                {/* Tabela Proizvedene Robe */}
                <Card className="bg-theme-card print:bg-transparent print:border-slate-300 border-slate-700 shadow-xl p-0 overflow-hidden">
                    <div className="p-4 border-b border-slate-700 print:border-slate-300">
                        <Title className="text-slate-300 print:text-slate-800 font-black text-[10px] uppercase">1. Vrijednost Proizvedene Robe</Title>
                    </div>
                    <table className="w-full text-left text-[10px]">
                        <thead className="bg-theme-card print:bg-slate-100 text-slate-400 print:text-slate-600 uppercase font-black border-b border-slate-700 print:border-slate-300">
                            <tr>
                                <th className="w-[45%] p-3">Proizvod / Vrsta</th>
                                <th className="w-[15%] p-3 text-center whitespace-nowrap">Proizvedeno (m³)</th>
                                <th className="w-[20%] p-3 text-center whitespace-nowrap">Cijena (Baza)</th>
                                <th className="w-[20%] p-3 text-right whitespace-nowrap">Ukupno (KM)</th>
                            </tr>
                        </thead>
                        <tbody className="text-white print:text-black font-bold">
                            {data.tabelaProizvodnje.length === 0 && <tr><td colSpan="4" className="p-4 text-center italic text-slate-500">Nema proizvedene robe u periodu.</td></tr>}
                            {data.tabelaProizvodnje.map((p, i) => (
                                <tr key={i} className="border-b border-theme-border/50 print:border-slate-200">
                                    <td className="p-3 text-blue-400 print:text-blue-800 uppercase">{p.naziv}</td>
                                    <td className="p-3 text-center">{p.m3.toFixed(3)}</td>
                                    <td className="p-3 text-center text-slate-400 print:text-slate-600">{p.cijenaPrikaz}</td>
                                    <td className="p-3 text-right text-emerald-400 print:text-black font-black text-[11px] whitespace-nowrap">{p.vrijednost.toLocaleString('bs-BA')}</td>
                                </tr>
                            ))}
                            <tr className="border-t-2 border-slate-600 print:border-slate-400 bg-theme-card/50 print:bg-transparent text-[11px]">
                                <td colSpan="3" className="p-3 text-right text-slate-400 print:text-slate-700 uppercase font-black">UKUPNA VRIJEDNOST:</td>
                                <td className="p-3 text-right text-white print:text-black font-black whitespace-nowrap">{parseFloat(data.kpi.vrijednostRobe).toLocaleString('bs-BA')}</td>
                            </tr>
                        </tbody>
                    </table>
                </Card>

                {/* Tabela Troškova Prerade */}
                <Card className="bg-theme-card print:bg-transparent print:border-slate-300 border-slate-700 shadow-xl p-0 overflow-hidden">
                    <div className="p-4 border-b border-slate-700 print:border-slate-300">
                        <Title className="text-slate-300 print:text-slate-800 font-black text-[10px] uppercase">2. Troškovi Prerade (Zbirno Radnici i Mašine)</Title>
                    </div>
                    <table className="w-full text-left text-[10px]">
                        <thead className="bg-theme-card print:bg-slate-100 text-slate-400 print:text-slate-600 uppercase font-black border-b border-slate-700 print:border-slate-300">
                            <tr>
                                <th className="w-[45%] p-3">Resurs</th>
                                <th className="w-[15%] p-3 text-center whitespace-nowrap">Učinak / Vrijeme</th>
                                <th className="w-[20%] p-3 text-center whitespace-nowrap">Jed. Cijena</th>
                                <th className="w-[20%] p-3 text-right whitespace-nowrap">Trošak (KM)</th>
                            </tr>
                        </thead>
                        <tbody className="text-white print:text-black font-bold">
                            {data.tabelaTroskova.length === 0 && <tr><td colSpan="4" className="p-4 text-center italic text-slate-500">Nema zabilježenih troškova.</td></tr>}
                            {data.tabelaTroskova.map((t, i) => (
                                <tr key={i} className="border-b border-theme-border/50 print:border-slate-200">
                                    <td className="p-3 uppercase">
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] mr-2 print:border ${t.tip==='Mašina' ? 'bg-amber-900/30 text-amber-400 border-amber-500/30 print:border-amber-600 print:text-amber-800' : 'bg-indigo-900/30 text-indigo-400 border-indigo-500/30 print:border-indigo-600 print:text-indigo-800'}`}>{t.tip}</span>
                                        {t.naziv}
                                    </td>
                                    <td className="p-3 text-center text-slate-300 print:text-slate-700 whitespace-nowrap">{t.kolicina}</td>
                                    <td className="p-3 text-center text-slate-400 print:text-slate-600 whitespace-nowrap">{t.cijena}</td>
                                    <td className="p-3 text-right text-rose-400 print:text-rose-600 font-black text-[11px] whitespace-nowrap">- {t.ukupno.toLocaleString('bs-BA')}</td>
                                </tr>
                            ))}
                            <tr className="border-t-2 border-slate-600 print:border-slate-400 bg-theme-card/50 print:bg-transparent text-[11px]">
                                <td colSpan="3" className="p-3 text-right text-slate-400 print:text-slate-700 uppercase font-black">UKUPNI TROŠAK:</td>
                                <td className="p-3 text-right text-rose-400 print:text-black font-black whitespace-nowrap">- {parseFloat(data.kpi.trosakPrerade).toLocaleString('bs-BA')}</td>
                            </tr>
                        </tbody>
                    </table>
                </Card>

            </div>

            {/* 3. GRAFIKONI NA DNU - SIGURNOSNO FIKSIRANI ZA PRINT DA NE PUKNU */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:gap-4 mt-8 print:mt-8 page-break-avoid">
                <Card className="bg-theme-card print:bg-transparent print:border-slate-300 border-slate-700 shadow-xl h-[300px] print:h-[260px] flex flex-col">
                    <Title className="text-slate-300 print:text-slate-800 font-black text-[10px] uppercase mb-2 text-center">Učešće Proizvoda u Vrijednosti (Top 10)</Title>
                    {data.grafikonVrijednosti.length === 0 ? <div className="flex h-full items-center justify-center text-slate-500 text-xs">Nema podataka</div> : (
                    <div className="flex-1 flex justify-center items-center w-full">
                        <PieChart width={350} height={220}>
                            <Pie isAnimationActive={false} animationDuration={0} data={data.grafikonVrijednosti} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                                {data.grafikonVrijednosti.map((e, i) => <Cell key={`c-${i}`} fill={PALETA[i % PALETA.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{backgroundColor: '#0f172a', border:'none', borderRadius:'12px', color:'#fff'}} formatter={(v) => `${v.toLocaleString('bs-BA')} KM`} />
                            <Legend wrapperStyle={{fontSize:'9px', fontWeight:'bold', color: '#000'}} />
                        </PieChart>
                    </div>
                    )}
                </Card>

                <Card className="bg-theme-card print:bg-transparent print:border-slate-300 border-slate-700 shadow-xl h-[300px] print:h-[260px] flex flex-col">
                    <Title className="text-slate-300 print:text-slate-800 font-black text-[10px] uppercase mb-4 text-center">Finansijski Bilans Proizvodnje (KM)</Title>
                    <div className="flex-1 flex justify-center items-center w-full">
                        <BarChart width={350} height={220} data={data.grafikonTroskovi} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
                            <Tooltip contentStyle={{backgroundColor: '#0f172a', border:'none', borderRadius:'8px', color:'#fff'}} cursor={{fill: '#1e293b'}} formatter={(v) => `${v.toLocaleString('bs-BA')} KM`} />
                            <Bar isAnimationActive={false} animationDuration={0} dataKey="Iznos" radius={[4, 4, 0, 0]} barSize={40}>
                                {data.grafikonTroskovi.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.name === 'Trošak Prerade' ? '#ef4444' : (entry.name === 'Bruto Marža' ? '#10b981' : '#3b82f6')} />
                                ))}
                            </Bar>
                        </BarChart>
                    </div>
                </Card>
            </div>

            {/* PRINT FOOTER */}
            <div className="hidden print:flex justify-between items-end border-t-2 border-theme-border pt-4 mt-10 page-break-avoid">
                <div className="text-[8px] text-slate-500">
                    Dokument generisan iz SmartTimber ERP softvera - {new Date().toLocaleString('bs-BA')}
                </div>
                <div className="w-[30%] text-center">
                    <div className="border-b border-black mb-1 h-8"></div>
                    <p className="text-xs font-bold text-black uppercase">Potpis Finansijskog Rukovodioca</p>
                </div>
            </div>
            
        </div>
    );
}