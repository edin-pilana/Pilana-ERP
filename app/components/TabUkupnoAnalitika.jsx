"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ComposedChart, Line } from 'recharts';
import { Card, Metric, Text, Title, Badge } from '@tremor/react';

const supabase = createClient('https://awaxwejrhmjeqohrgidm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY');

const PALETA = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

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

export default function TabUkupnoAnalitika({ datumOd, datumDo, saas, header }) {
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
        ucitajUkupnuAnalitiku();
    }, [datumOd, datumDo]);

    const ucitajUkupnuAnalitiku = async () => {
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

            // --- 1. MATERIJALNI BILANS (Pilana + Dorada) ---
            let ulazTrupciM3 = 0;
            const iskoristeniTrupci = new Set();
            logovi.forEach(l => {
                if(!iskoristeniTrupci.has(l.trupac_id)) {
                    iskoristeniTrupci.add(l.trupac_id);
                    const t = trupciDB.find(tr => tr.id === l.trupac_id);
                    if(t) ulazTrupciM3 += parseFloat(t.zapremina || 0);
                }
            });

            let pilanaIzlazM3 = 0;
            let doradaIzlazM3 = 0;
            let doradaUlazSirovineM3 = 0;
            
            const kategorijeMap = {};
            let ukupnaVrijednostRobe = 0;

            paketi.forEach(p => {
                const m3 = parseFloat(p.kolicina_final || 0);
                const isDorada = imaSirovinu(p.ai_sirovina_ids);

                if (isDorada) {
                    doradaIzlazM3 += m3;
                    doradaUlazSirovineM3 += parseFloat(p.kolicina_ulaz || m3); 
                } else {
                    pilanaIzlazM3 += m3;
                }

                // Finansijska evaluacija prema katalogu
                const kat = katalogDB.find(k => k.sifra === p.naziv_proizvoda || k.naziv === p.naziv_proizvoda);
                const cijenaBaza = kat ? parseFloat(kat.cijena || 0) : 0;
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

                const kategorija = kat?.kategorija || (isDorada ? 'Dorada Ostalo' : 'Pilana Ostalo');
                if(!kategorijeMap[kategorija]) kategorijeMap[kategorija] = { ime: kategorija, m3: 0, vrijednost: 0 };
                kategorijeMap[kategorija].m3 += m3;
                kategorijeMap[kategorija].vrijednost += izracunataVr;
            });

            const pilanaKaloM3 = Math.max(0, ulazTrupciM3 - pilanaIzlazM3);
            const doradaKaloM3 = Math.max(0, doradaUlazSirovineM3 - doradaIzlazM3);
            const ukupnoKaloM3 = pilanaKaloM3 + doradaKaloM3;
            const ukupanIzlazGOTOVE_ROBE = pilanaIzlazM3 + doradaIzlazM3;

            // --- 2. TROŠKOVI (Zbirno) ---
            let trosakMasina = 0;
            paketi.forEach(p => {
                if(p.masina) {
                    const masina = masineDB.find(m => m.naziv === p.masina);
                    const cijenaM3 = masina ? parseFloat(masina.cijena_m3 || 0) : 0;
                    trosakMasina += parseFloat(p.kolicina_final || 0) * cijenaM3;
                }
            });

            const radniciDnevniceMap = {}; 
            logovi.forEach(l => {
                if(l.brentista) { if(!radniciDnevniceMap[l.brentista]) radniciDnevniceMap[l.brentista] = new Set(); radniciDnevniceMap[l.brentista].add(l.datum); }
                if(l.viljuskarista) { if(!radniciDnevniceMap[l.viljuskarista]) radniciDnevniceMap[l.viljuskarista] = new Set(); radniciDnevniceMap[l.viljuskarista].add(l.datum); }
            });
            paketi.forEach(p => {
                if(p.snimio_korisnik) { if(!radniciDnevniceMap[p.snimio_korisnik]) radniciDnevniceMap[p.snimio_korisnik] = new Set(); radniciDnevniceMap[p.snimio_korisnik].add(p.datum_yyyy_mm); }
                if(p.brentista) { if(!radniciDnevniceMap[p.brentista]) radniciDnevniceMap[p.brentista] = new Set(); radniciDnevniceMap[p.brentista].add(p.datum_yyyy_mm); }
            });

            let trosakRadnika = 0;
            Object.keys(radniciDnevniceMap).forEach(rIme => {
                const radnik = radniciDB.find(r => r.ime_prezime === rIme);
                const satnica = radnik ? parseFloat(radnik.bruto_satnica || 0) : 0;
                trosakRadnika += (radniciDnevniceMap[rIme].size * 8 * satnica);
            });

            const ukupniTrosak = trosakMasina + trosakRadnika;
            const brutoProfit = ukupnaVrijednostRobe - ukupniTrosak;

            // --- 3. GRAFIKONI ---
            const grafikonKategorija = Object.values(kategorijeMap).map(k => ({
                name: k.ime,
                M3: parseFloat(k.m3.toFixed(2)),
                Vrijednost: parseFloat(k.vrijednost.toFixed(2))
            })).sort((a,b) => b.Vrijednost - a.Vrijednost);

            const grafikonTokMaterijala = [
                { name: 'Sirovina (Ulaz)', M3: parseFloat(ulazTrupciM3.toFixed(2)) },
                { name: 'Proizvedeno (Izlaz)', M3: parseFloat(ukupanIzlazGOTOVE_ROBE.toFixed(2)) },
                { name: 'Otpad (Kalo)', M3: parseFloat(ukupnoKaloM3.toFixed(2)) }
            ];

            const grafikonFinansija = [
                { name: 'Vrijednost Robe', Iznos: parseFloat(ukupnaVrijednostRobe.toFixed(2)) },
                { name: 'Trošak Proizvodnje', Iznos: parseFloat(ukupniTrosak.toFixed(2)) },
                { name: 'Bruto Profit', Iznos: parseFloat(brutoProfit.toFixed(2)) }
            ];

            setData({
                kpi: {
                    ulazTrupci: ulazTrupciM3.toFixed(2),
                    izlazGotoveRobe: ukupanIzlazGOTOVE_ROBE.toFixed(2),
                    ukupnoKalo: ukupnoKaloM3.toFixed(2),
                    pilanaUcesce: pilanaIzlazM3.toFixed(2),
                    doradaUcesce: doradaIzlazM3.toFixed(2),
                    vrijednostRobe: ukupnaVrijednostRobe.toFixed(2),
                    trosakProizvodnje: ukupniTrosak.toFixed(2),
                    brutoProfit: brutoProfit.toFixed(2),
                    brojRadnika: Object.keys(radniciDnevniceMap).length
                },
                grafikonKategorija,
                grafikonTokMaterijala,
                grafikonFinansija,
                tabelaKategorija: Object.values(kategorijeMap).sort((a,b) => b.vrijednost - a.vrijednost)
            });
            setLoading(false);

        } catch (error) {
            console.error("Greška u zbirnoj analitici:", error);
            setLoading(false);
        }
    };

    const pokreniPrint = () => {
        const title = `${datumOd}_Direktorski_Izvjestaj_Fabrike`;
        document.title = title;
        window.print();
        setTimeout(() => document.title = "TTM ERP", 2000);
    };

    if (loading) return <div className="p-20 text-center text-indigo-500 animate-pulse font-black text-xl uppercase tracking-widest">Sastavljam direktorski izvještaj...</div>;
    if (!data) return <div className="p-20 text-center text-slate-500 font-bold">Nema podataka.</div>;

    const marzaBoja = parseFloat(data.kpi.brutoProfit) >= 0 ? 'text-emerald-400 print:text-emerald-700' : 'text-red-500 print:text-red-600';

    return (
        <div className="space-y-6 bg-white print:bg-white print:text-black text-slate-200 w-full max-w-[210mm] mx-auto print:max-w-none">
            
            {/* PRINT HEADER */}
            <div className="hidden print:flex justify-between items-end border-b-2 border-slate-800 pb-4 mb-6 pt-4">
                <div className="flex items-center gap-4">
                    {logoUrl ? <img src={logoUrl} alt="Logo" className="max-h-16 object-contain" /> : <h1 className="text-3xl font-black text-slate-900">{imeFirme}</h1>}
                    <div className="border-l-2 border-slate-300 pl-4 ml-2">
                        <h2 className="text-xl font-black uppercase text-slate-800 tracking-widest">Direktorski Izvještaj</h2>
                        <p className="text-sm text-slate-500 font-bold">Ptičiji pogled (Prorez, Dorada, Finansije)</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm font-black text-slate-800 uppercase">Mjesto: <span className="font-normal">{header?.mjesto || 'Fabrika'}</span></p>
                    <p className="text-sm font-black text-slate-800 uppercase">Period: <span className="font-normal">{formatDatum(datumOd)} {datumOd !== datumDo ? `- ${formatDatum(datumDo)}` : ''}</span></p>
                </div>
            </div>

            {/* EKRAN KONTROLE */}
            <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg print:hidden">
                <div>
                    <h3 className="text-indigo-400 font-black uppercase text-sm tracking-widest">Direktorski Dashboard (Sveukupno)</h3>
                    <p className="text-xs text-slate-400">Zbirni bilans materijala i novca na nivou cijele fabrike.</p>
                </div>
                <button onClick={pokreniPrint} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                    🖨️ Isprintaj PDF
                </button>
            </div>

            {/* 1. TOP KPI KARTICE */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:gap-2">
                <Card decoration="top" decorationColor="blue" className="bg-[#1e293b] print:bg-white print:border-slate-300 border-slate-700 p-4 print:p-3 shadow-xl">
                    <Text className="text-slate-400 print:text-slate-500 font-bold text-[9px] uppercase">Ulaz Sirovine (Trupci)</Text>
                    <Metric className="text-white print:text-black mt-1 text-lg font-mono">{data.kpi.ulazTrupci} m³</Metric>
                    <Text className="text-slate-500 text-[9px] mt-1 font-bold uppercase">Prorezano u periodu</Text>
                </Card>
                
                <Card decoration="top" decorationColor="emerald" className="bg-[#1e293b] print:bg-white print:border-slate-300 border-slate-700 p-4 print:p-3 shadow-xl">
                    <Text className="text-slate-400 print:text-slate-500 font-bold text-[9px] uppercase">Ukupno Proizvedeno</Text>
                    <Metric className="text-emerald-400 print:text-emerald-600 mt-1 text-lg font-mono">{data.kpi.izlazGotoveRobe} m³</Metric>
                    <Text className="text-slate-500 text-[9px] mt-1 font-bold uppercase">Pilana: {data.kpi.pilanaUcesce} | Dorada: {data.kpi.doradaUcesce}</Text>
                </Card>

                <Card decoration="top" decorationColor="amber" className="bg-[#1e293b] print:bg-white print:border-slate-300 border-slate-700 p-4 print:p-3 shadow-xl">
                    <Text className="text-slate-400 print:text-slate-500 font-bold text-[9px] uppercase">Ukupna Vrijednost Robe</Text>
                    <Metric className="text-amber-400 print:text-amber-600 mt-1 text-lg font-mono">{parseFloat(data.kpi.vrijednostRobe).toLocaleString('bs-BA')} KM</Metric>
                    <Text className="text-slate-500 text-[9px] mt-1 font-bold uppercase">Tržišna procjena</Text>
                </Card>

                <Card decoration="top" decorationColor="indigo" className="bg-[#1e293b] print:bg-white print:border-slate-300 border-slate-700 p-4 print:p-3 shadow-xl">
                    <Text className="text-slate-400 print:text-slate-500 font-bold text-[9px] uppercase">Bruto Profit Fabrike</Text>
                    <Metric className={`${marzaBoja} mt-1 text-lg font-mono`}>{parseFloat(data.kpi.brutoProfit).toLocaleString('bs-BA')} KM</Metric>
                    <Text className="text-slate-500 text-[9px] mt-1 font-bold uppercase">Vrijednost - (Mašine + Ljudi)</Text>
                </Card>
            </div>

            {/* 2. ZBIRNA TABELA PROIZVODNJE PO KATEGORIJAMA */}
            <Card className="bg-[#1e293b] print:bg-transparent print:border-slate-300 border-slate-700 shadow-xl p-0 overflow-hidden page-break-avoid mt-6">
                <div className="p-4 border-b border-slate-700 print:border-slate-300">
                    <Title className="text-slate-300 print:text-slate-800 font-black text-[10px] uppercase">Struktura Proizvodnje po Kategorijama (Zbirno)</Title>
                </div>
                <table className="w-full text-left text-[10px]">
                    <thead className="bg-slate-900 print:bg-slate-100 text-slate-400 print:text-slate-600 uppercase font-black border-b border-slate-700 print:border-slate-300">
                        <tr>
                            <th className="w-[50%] p-3">Kategorija Proizvoda</th>
                            <th className="w-[25%] p-3 text-center whitespace-nowrap">Volumen (m³)</th>
                            <th className="w-[25%] p-3 text-right whitespace-nowrap">Vrijednost (KM)</th>
                        </tr>
                    </thead>
                    <tbody className="text-white print:text-black font-bold">
                        {data.tabelaKategorija.length === 0 && <tr><td colSpan="3" className="p-4 text-center italic text-slate-500">Nema evidentirane proizvodnje.</td></tr>}
                        {data.tabelaKategorija.map((k, i) => (
                            <tr key={i} className="border-b border-slate-800/50 print:border-slate-200">
                                <td className="p-3 text-blue-400 print:text-blue-800 uppercase">{k.ime}</td>
                                <td className="p-3 text-center">{k.m3.toFixed(3)}</td>
                                <td className="p-3 text-right text-emerald-400 print:text-black font-black whitespace-nowrap">{k.vrijednost.toLocaleString('bs-BA')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            {/* 3. GRAFIKONI NA DNU - SIGURNOSNO FIKSIRANI ZA PRINT */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:gap-4 mt-6 print:mt-8 page-break-avoid">
                
                {/* Tok Materijala */}
                <Card className="bg-[#1e293b] print:bg-transparent print:border-slate-300 border-slate-700 shadow-xl h-[300px] print:h-[260px] flex flex-col">
                    <Title className="text-slate-300 print:text-slate-800 font-black text-[10px] uppercase mb-4 text-center">Bilans Materijala (Ulaz / Izlaz / Kalo)</Title>
                    <div className="flex-1 flex justify-center items-center w-full">
                        <BarChart width={350} height={220} data={data.grafikonTokMaterijala} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{backgroundColor: '#0f172a', border:'none', borderRadius:'8px', color:'#fff'}} cursor={{fill: '#1e293b'}} formatter={(v) => `${v} m³`} />
                            <Bar isAnimationActive={false} animationDuration={0} dataKey="M3" radius={[4, 4, 0, 0]} barSize={40}>
                                {data.grafikonTokMaterijala.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.name === 'Otpad (Kalo)' ? '#ef4444' : (entry.name === 'Sirovina (Ulaz)' ? '#3b82f6' : '#10b981')} />
                                ))}
                            </Bar>
                        </BarChart>
                    </div>
                </Card>

                {/* Finansijski Zbir */}
                <Card className="bg-[#1e293b] print:bg-transparent print:border-slate-300 border-slate-700 shadow-xl h-[300px] print:h-[260px] flex flex-col">
                    <Title className="text-slate-300 print:text-slate-800 font-black text-[10px] uppercase mb-4 text-center">Sveukupni Finansijski Rezultat (KM)</Title>
                    <div className="flex-1 flex justify-center items-center w-full">
                        <BarChart width={350} height={220} data={data.grafikonFinansija} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
                            <Tooltip contentStyle={{backgroundColor: '#0f172a', border:'none', borderRadius:'8px', color:'#fff'}} cursor={{fill: '#1e293b'}} formatter={(v) => `${v.toLocaleString('bs-BA')} KM`} />
                            <Bar isAnimationActive={false} animationDuration={0} dataKey="Iznos" radius={[4, 4, 0, 0]} barSize={40}>
                                {data.grafikonFinansija.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.name === 'Trošak Proizvodnje' ? '#ef4444' : (entry.name === 'Bruto Profit' ? '#10b981' : '#f59e0b')} />
                                ))}
                            </Bar>
                        </BarChart>
                    </div>
                </Card>
            </div>

            {/* PRINT FOOTER */}
            <div className="hidden print:flex justify-between items-end border-t-2 border-slate-800 pt-4 mt-10 page-break-avoid">
                <div className="text-[8px] text-slate-500">
                    Sveukupni izvještaj generisan iz SmartTimber ERP softvera - {new Date().toLocaleString('bs-BA')}
                </div>
                <div className="w-[30%] text-center">
                    <div className="border-b border-black mb-1 h-8"></div>
                    <p className="text-xs font-bold text-black uppercase">Direktor / Vlasnik</p>
                </div>
            </div>
            
        </div>
    );
}