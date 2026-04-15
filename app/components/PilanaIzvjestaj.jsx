"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function PilanaIzvjestaj({ data, datum, lokacija, smjena }) {
  const tamnoPlava = "#25254A";
  const limetaZelena = "#9EC642";
  const sivaOtpad = "#94a3b8";
  const PALETA = [limetaZelena, '#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899'];

  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    try {
      const brending = JSON.parse(localStorage.getItem('erp_brending') || '[]');
      const logoObj = brending.find(b => (b.lokacije_jsonb || []).includes('Svi PDF Dokumenti')) || 
                      brending.find(b => (b.lokacije_jsonb || []).includes('Glavni Meni (Dashboard Vrh)'));
      if (logoObj && logoObj.url_slike) setLogoUrl(logoObj.url_slike);
    } catch (e) {}
  }, []);

  if (!data || !data.kpi) return <div className="text-center p-10 font-bold text-slate-500">Učitavam podatke za izvještaj...</div>;

  const grupisaniIzlaz = useMemo(() => {
    const groups = {};
    (data.glavna_tabela || []).forEach(p => {
      const vrsta = p.naziv_proizvoda || 'Ostalo';
      if (!groups[vrsta]) groups[vrsta] = { items: [], totalM3: 0, totalKom: 0 };
      groups[vrsta].items.push(p);
      groups[vrsta].totalM3 += parseFloat(p.kolicina_final || 0);
      groups[vrsta].totalKom += parseFloat(p.kolicina_ulaz || 0);
    });
    return groups;
  }, [data.glavna_tabela]);

  const yieldPieData = useMemo(() => {
    const ulaz = parseFloat(data.kpi.ulaz_m3 || 0);
    const izlaz = parseFloat(data.kpi.izlaz_m3 || 0);
    const otpad = Math.max(0, ulaz - izlaz);
    
    const chartData = (data.izlaz_struktura || []).map(item => ({
      name: item.name,
      value: parseFloat(item.m3),
      proc: ulaz > 0 ? ((item.m3 / ulaz) * 100).toFixed(1) : 0
    }));
    
    if (otpad > 0) chartData.push({ name: 'Otpad / Piljevina', value: otpad, proc: ulaz > 0 ? ((otpad / ulaz) * 100).toFixed(1) : 0, isWaste: true });
    return chartData;
  }, [data]);

  const mixPieData = useMemo(() => {
    const izlaz = parseFloat(data.kpi.izlaz_m3 || 0);
    return (data.izlaz_struktura || []).map(item => ({
      name: item.name,
      value: parseFloat(item.m3),
      proc: izlaz > 0 ? ((item.m3 / izlaz) * 100).toFixed(1) : 0
    }));
  }, [data]);

  const formatDatum = (iso) => {
    if(!iso) return '';
    const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}.`;
  };

  const renderCustomLegend = (props) => {
    const { payload } = props;
    return (
      <ul className="text-[8px] flex flex-wrap justify-center gap-1.5 mt-2 leading-tight">
        {payload.map((entry, index) => (
          <li key={`item-${index}`} className="flex items-center font-bold">
            <span className="w-2 h-2 rounded-full inline-block mr-1" style={{ backgroundColor: entry.color }}></span>
            {entry.value}: {entry.payload.proc}%
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="bg-white text-black p-6 mx-auto max-w-[210mm] min-h-[297mm] shadow-2xl print:shadow-none print:p-0 relative font-sans flex flex-col justify-between">
      
      <div>
        {/* 1. HEADER */}
        <div className="flex justify-between items-start border-b-2 pb-3 mb-4" style={{ borderColor: tamnoPlava }}>
          <div className="w-48 h-20 flex items-center justify-start">
            {logoUrl ? <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" /> : <span className="text-gray-400 font-bold border-2 border-dashed p-4 text-xs">[ TTM LOGO ]</span>}
          </div>
          <div className="text-right text-[11px] leading-relaxed max-w-[60%]">
            <p><strong>Datum:</strong> {formatDatum(datum)} | <strong>Lokacija:</strong> {lokacija === 'SVE' ? 'Sve lokacije' : lokacija}</p>
            <p><strong>Smjena:</strong> {smjena === 'SVE' ? 'Sve smjene (00-24h)' : smjena}</p>
            <p className="text-[10px] mt-1 text-slate-600"><strong>Posada na pilani:</strong> {data.posada || 'Nije evidentirano'}</p>
          </div>
        </div>

        {/* 2. KPI DASHBOARD */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="p-2.5 rounded shadow-sm flex flex-col justify-between" style={{ backgroundColor: tamnoPlava, borderBottom: `3px solid ${limetaZelena}` }}>
            <h3 className="text-[9px] text-gray-300 font-bold leading-tight">ISKORIŠTENJE<br/>(Yield)</h3>
            <p className="text-xl font-black text-white my-1">{data.kpi.yield_proc} %</p>
            <p className="text-[8px]" style={{ color: limetaZelena }}>(Izlaz / Ulaz)</p>
          </div>
          <div className="p-2.5 rounded shadow-sm flex flex-col justify-between" style={{ backgroundColor: tamnoPlava, borderBottom: `3px solid ${limetaZelena}` }}>
            <h3 className="text-[9px] text-gray-300 font-bold leading-tight">BRZINA<br/>REZANJA</h3>
            <p className="text-xl font-black text-white my-1">{(data.kpi.ulaz_m3 / 8).toFixed(1)} <span className="text-xs">m³/h</span></p>
            <p className="text-[8px]" style={{ color: limetaZelena }}>(Trupci / 8h smjena)</p>
          </div>
          <div className="p-2.5 rounded shadow-sm flex flex-col justify-between" style={{ backgroundColor: tamnoPlava, borderBottom: `3px solid ${limetaZelena}` }}>
            <h3 className="text-[9px] text-gray-300 font-bold leading-tight">UKUPNO<br/>TRUPACA</h3>
            <p className="text-xl font-black text-white my-1">{data.kpi.ulaz_m3} <span className="text-xs">m³</span></p>
            <p className="text-[8px]" style={{ color: limetaZelena }}>(Ulazna Sirovina)</p>
          </div>
          <div className="p-2.5 rounded shadow-sm flex flex-col justify-between" style={{ backgroundColor: tamnoPlava, borderBottom: `3px solid ${limetaZelena}` }}>
            <h3 className="text-[9px] text-gray-300 font-bold leading-tight">UKUPNI<br/>VOLUMEN</h3>
            <p className="text-xl font-black text-white my-1">{data.kpi.izlaz_m3} <span className="text-xs">m³</span></p>
            <p className="text-[8px]" style={{ color: limetaZelena }}>(Svi gotovi paketi)</p>
          </div>
        </div>

        {/* 3. TABELE SA PODACIMA */}
        <div className="grid grid-cols-12 gap-6 mb-6">
          <div className="col-span-5">
            <h3 className="font-bold text-white text-[11px] p-1.5 px-2 mb-2" style={{ backgroundColor: tamnoPlava }}>LOG INPUT (Ulaz Trupaca)</h3>
            <table className="w-full text-[10px] text-left border-collapse">
              <thead><tr className="border-b-2 border-gray-400"><th className="p-1.5 font-bold">Dužina (m)</th><th className="p-1.5 font-bold">Kom</th><th className="p-1.5 font-bold">m³</th></tr></thead>
              <tbody>
                {data.trupci_duzine.length === 0 && <tr><td colSpan="3" className="p-2 text-center text-gray-400 italic">Nema unosa.</td></tr>}
                {data.trupci_duzine.map((t, idx) => (<tr key={idx} className="border-b border-gray-200"><td className="p-1.5">{t.duzina}</td><td className="p-1.5">{t.kom}</td><td className="p-1.5 font-bold">{t.m3}</td></tr>))}
                <tr className="font-black bg-gray-100 border-t-2 border-gray-400"><td className="p-1.5">UKUPNO:</td><td className="p-1.5">{data.kpi.ulaz_kom}</td><td className="p-1.5">{data.kpi.ulaz_m3}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="col-span-7">
            <h3 className="font-bold text-white text-[11px] p-1.5 px-2 mb-2" style={{ backgroundColor: tamnoPlava }}>PRODUCT OUTPUT (Izlaz Gotove Robe)</h3>
            <div className="max-h-[300px] overflow-y-auto print:max-h-none print:overflow-visible">
              <table className="w-full text-[9px] text-left border-collapse">
                <thead><tr className="border-b-2 border-gray-400"><th className="p-1 font-bold">ID</th><th className="p-1 font-bold">Vrsta</th><th className="p-1 font-bold">Dimenzije</th><th className="p-1 font-bold text-right">Kom</th><th className="p-1 font-bold text-right">m³</th></tr></thead>
                <tbody>
                  {Object.keys(grupisaniIzlaz).length === 0 && <tr><td colSpan="5" className="p-2 text-center text-gray-400 italic">Nema proizvedenih paketa.</td></tr>}
                  {Object.keys(grupisaniIzlaz).map((vrsta, idx) => (
                    <React.Fragment key={idx}>
                      <tr className="bg-gray-100 border-y border-gray-300"><td colSpan="3" className="p-1 pl-2 font-black text-[10px]" style={{ color: tamnoPlava }}>{vrsta.toUpperCase()}</td><td className="p-1 font-bold text-right">{grupisaniIzlaz[vrsta].totalKom}</td><td className="p-1 font-black text-right text-[10px]">{grupisaniIzlaz[vrsta].totalM3.toFixed(3)}</td></tr>
                      {grupisaniIzlaz[vrsta].items.map((p, pIdx) => (
                        <tr key={pIdx} className="border-b border-gray-100"><td className="p-1">{p.paket_id}</td><td className="p-1">{p.naziv_proizvoda}</td><td className="p-1">{p.debljina}x{p.sirina}x{p.duzina}</td><td className="p-1 text-right">{p.kolicina_ulaz} {p.jm}</td><td className="p-1 font-bold text-right">{p.kolicina_final}</td></tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 4. GRAFIKONI */}
        <h3 className="font-bold text-white text-[11px] p-1.5 px-2 mb-3 print:mt-4" style={{ backgroundColor: tamnoPlava }}>VIZUELNA ANALIZA PROREZA</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="border border-gray-200 p-2 flex flex-col items-center justify-center rounded bg-white">
            <h4 className="text-[9px] font-bold mb-1 text-center">Iskorištenost iz trupca (%)</h4>
            <div style={{ width: '100%', height: '140px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={yieldPieData} innerRadius={30} outerRadius={50} dataKey="value" stroke="#fff" strokeWidth={2} isAnimationActive={false}>{yieldPieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.isWaste ? sivaOtpad : PALETA[index % PALETA.length]} />))}</Pie><Tooltip formatter={(value) => `${value} m³`} /><Legend content={renderCustomLegend} /></PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="border border-gray-200 p-2 flex flex-col items-center justify-center rounded bg-white">
            <h4 className="text-[9px] font-bold mb-1 text-center">Učešće proizvoda u prorezu (%)</h4>
            <div style={{ width: '100%', height: '140px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={mixPieData} outerRadius={50} dataKey="value" stroke="#fff" strokeWidth={2} isAnimationActive={false}>{mixPieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={PALETA[index % PALETA.length]} />))}</Pie><Tooltip formatter={(value) => `${value} m³`} /><Legend content={renderCustomLegend} /></PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="border border-gray-200 p-2 flex flex-col items-center justify-center rounded bg-white">
            <h4 className="text-[9px] font-bold mb-1 text-center">Prosječni dnevni učinak po mjesecima (m³)</h4>
            <div style={{ width: '100%', height: '140px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.trend_godisnji} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={7} tickLine={false} axisLine={false} interval={1} />
                  <YAxis fontSize={8} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => `${value} m³`} />
                  <Legend wrapperStyle={{ fontSize: '8px' }} />
                  <Bar dataKey="Pilana" name="Prosjek Pilane" fill={tamnoPlava} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="Brentista" name={`{data.glavni_brentista || 'Brentista'} (Prosjek)`} fill={limetaZelena} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* 5. ZASTOJI I NAPOMENE (DNO STRANICE) */}
      <div className="mt-6 pt-4 border-t-2 border-dashed border-gray-300">
         <h3 className="font-bold text-black text-[11px] mb-2">DNEVNIK MAŠINE (Zastoji i napomene):</h3>
         {(!data.zastoji || data.zastoji.length === 0) ? (
            <p className="text-[10px] text-gray-500 italic">Nije bilo evidentiranih zastoja u odabranom periodu.</p>
         ) : (
            <ul className="text-[9px] space-y-1">
              {data.zastoji.map((z, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-bold text-gray-700 w-24">{z.vrijeme_od} - {z.vrijeme_do || '...'}</span>
                  {z.zastoj_min > 0 && <span className="font-black text-red-600 bg-red-100 px-1 rounded">Zastoj: {z.zastoj_min} min</span>}
                  <span className="text-gray-800">- {z.napomena || 'Nema napomene'} (Prijavio: {z.snimio})</span>
                </li>
              ))}
            </ul>
         )}
      </div>
      
      {/* Print dugme */}
      <div className="mt-8 text-center print:hidden">
        <button onClick={() => window.print()} className="px-6 py-2.5 text-white font-bold rounded-xl shadow-lg hover:opacity-90" style={{ backgroundColor: limetaZelena }}>
          🖨️ Isprintaj Dnevni Izvještaj
        </button>
      </div>
    </div>
  );
}