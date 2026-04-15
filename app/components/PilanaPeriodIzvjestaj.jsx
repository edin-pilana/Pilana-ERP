"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function PilanaPeriodIzvjestaj({ data, datumOd, datumDo, lokacija, brentistaFilter }) {
  const tamnoPlava = "#25254A";
  const limetaZelena = "#9EC642";
  const sivaOtpad = "#94a3b8";
  const PALETA = [limetaZelena, '#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899'];

  const [logoUrl, setLogoUrl] = useState('');

  // Učitavanje logotipa iz memorije
  useEffect(() => {
    try {
      const brending = JSON.parse(localStorage.getItem('erp_brending') || '[]');
      const logoObj = brending.find(b => (b.lokacije_jsonb || []).includes('Svi PDF Dokumenti')) || 
                      brending.find(b => (b.lokacije_jsonb || []).includes('Glavni Meni (Dashboard Vrh)'));
      if (logoObj && logoObj.url_slike) setLogoUrl(logoObj.url_slike);
    } catch (e) {}
  }, []);

  if (!data || !data.kpi) return <div className="text-center p-10 font-bold text-slate-500">Učitavam periodične podatke...</div>;

  const formatDatum = (iso) => {
    if(!iso) return '';
    const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}.`;
  };

  // Custom Legenda za Pie Chart (kao na dnevnom)
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

  // Sigurnosno povlačenje podataka (ako nešto fali da ne pukne app)
  const kpi = data.kpi || { ulaz_m3: 0, izlaz_m3: 0, yield_proc: 0, dnevni_prosjek: 0 };
  const ulazStruktura = data.ulaz_struktura || [];
  const izlazStruktura = data.izlaz_struktura || [];
  const leaderboard = data.leaderboard || [];
  const dinamika = data.dinamika || [];
  const zastojiChart = data.zastoji_analiza || [];

  return (
    <div className="bg-white text-black p-6 mx-auto max-w-[210mm] min-h-[297mm] shadow-2xl print:shadow-none print:p-0 relative font-sans flex flex-col justify-between">
      
      <div>
        {/* 1. HEADER */}
        <div className="flex justify-between items-start border-b-2 pb-3 mb-4" style={{ borderColor: tamnoPlava }}>
          <div className="w-48 h-20 flex items-center justify-start">
            {logoUrl ? <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" /> : <span className="text-gray-400 font-bold border-2 border-dashed p-4 text-xs">[ TTM LOGO ]</span>}
          </div>
          <div className="text-right text-[11px] leading-relaxed max-w-[60%]">
            <h1 className="text-[14px] font-black uppercase tracking-widest mb-1" style={{ color: tamnoPlava }}>Menadžerski Izvještaj Pilane</h1>
            <p><strong>Period:</strong> {formatDatum(datumOd)} - {formatDatum(datumDo)}</p>
            <p><strong>Filter Brentiste:</strong> {brentistaFilter || 'SVI'} | <strong>Lokacija:</strong> {lokacija === 'SVE' ? 'Sve lokacije' : lokacija}</p>
          </div>
        </div>

        {/* 2. KPI DASHBOARD (4 Kartice) */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="p-3 rounded shadow-sm flex flex-col justify-between" style={{ backgroundColor: tamnoPlava, borderBottom: `4px solid ${limetaZelena}` }}>
            <h3 className="text-[9px] text-gray-300 font-bold leading-tight">PROSJEČNI<br/>YIELD</h3>
            <p className="text-2xl font-black text-white my-1">{kpi.yield_proc} %</p>
            <p className="text-[8px]" style={{ color: limetaZelena }}>Iskorištenje materijala</p>
          </div>
          <div className="p-3 rounded shadow-sm flex flex-col justify-between" style={{ backgroundColor: tamnoPlava, borderBottom: `4px solid ${limetaZelena}` }}>
            <h3 className="text-[9px] text-gray-300 font-bold leading-tight">UKUPNO<br/>TRUPACA</h3>
            <p className="text-2xl font-black text-white my-1">{kpi.ulaz_m3} <span className="text-xs">m³</span></p>
            <p className="text-[8px]" style={{ color: limetaZelena }}>Ulazna Sirovina</p>
          </div>
          <div className="p-3 rounded shadow-sm flex flex-col justify-between" style={{ backgroundColor: tamnoPlava, borderBottom: `4px solid ${limetaZelena}` }}>
            <h3 className="text-[9px] text-gray-300 font-bold leading-tight">GOTOVA<br/>ROBA</h3>
            <p className="text-2xl font-black text-white my-1">{kpi.izlaz_m3} <span className="text-xs">m³</span></p>
            <p className="text-[8px]" style={{ color: limetaZelena }}>Svi proizvedeni paketi</p>
          </div>
          <div className="p-3 rounded shadow-sm flex flex-col justify-between" style={{ backgroundColor: tamnoPlava, borderBottom: `4px solid ${limetaZelena}` }}>
            <h3 className="text-[9px] text-gray-300 font-bold leading-tight">DNEVNI<br/>PROSJEK</h3>
            <p className="text-2xl font-black text-white my-1">{kpi.dnevni_prosjek} <span className="text-xs">m³/dan</span></p>
            <p className="text-[8px]" style={{ color: limetaZelena }}>Dinamika prerade</p>
          </div>
        </div>

        {/* 3. TABELE STRUKTURE */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* ULAZ */}
          <div>
            <h3 className="font-bold text-white text-[11px] p-1.5 px-2 mb-2 rounded-t" style={{ backgroundColor: tamnoPlava }}>STRUKTURA ULAZA (SIROVINA)</h3>
            <table className="w-full text-[10px] text-left border-collapse">
              <thead><tr className="border-b-2 border-gray-400"><th className="p-1.5 font-bold">Vrsta drveta</th><th className="p-1.5 font-bold text-right">Komada</th><th className="p-1.5 font-bold text-right">m³</th></tr></thead>
              <tbody>
                {ulazStruktura.length === 0 && <tr><td colSpan="3" className="p-2 text-center text-gray-400 italic">Nema podataka.</td></tr>}
                {ulazStruktura.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-200"><td className="p-1.5">{item.vrsta}</td><td className="p-1.5 text-right">{item.kom}</td><td className="p-1.5 font-bold text-right">{item.m3}</td></tr>
                ))}
                <tr className="font-black bg-gray-100 border-t-2 border-gray-400"><td className="p-1.5">SVEUKUPNO:</td><td className="p-1.5 text-right">{kpi.ulaz_kom}</td><td className="p-1.5 text-right">{kpi.ulaz_m3}</td></tr>
              </tbody>
            </table>
          </div>
          {/* IZLAZ */}
          <div>
            <h3 className="font-bold text-white text-[11px] p-1.5 px-2 mb-2 rounded-t" style={{ backgroundColor: tamnoPlava }}>STRUKTURA IZLAZA (PROIZVODI)</h3>
            <table className="w-full text-[10px] text-left border-collapse">
              <thead><tr className="border-b-2 border-gray-400"><th className="p-1.5 font-bold">Kategorija</th><th className="p-1.5 font-bold text-right">m³</th><th className="p-1.5 font-bold text-right">Udio %</th></tr></thead>
              <tbody>
                {izlazStruktura.length === 0 && <tr><td colSpan="3" className="p-2 text-center text-gray-400 italic">Nema podataka.</td></tr>}
                {izlazStruktura.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-200"><td className="p-1.5">{item.name}</td><td className="p-1.5 font-bold text-right">{item.value}</td><td className="p-1.5 text-right">{item.proc}%</td></tr>
                ))}
                <tr className="font-black bg-gray-100 border-t-2 border-gray-400"><td className="p-1.5">UKUPNO IZLAZ:</td><td className="p-1.5 text-right">{kpi.izlaz_m3}</td><td className="p-1.5 text-right">100%</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. RANG LISTA RADNIKA */}
        <h3 className="font-bold text-white text-[11px] p-1.5 px-2 mb-2 rounded-t" style={{ backgroundColor: tamnoPlava }}>RANG LISTA BRENTISTA (UČINAK U PERIODU)</h3>
        <div className="space-y-2 mb-6">
          {leaderboard.length === 0 && <p className="text-[10px] text-center text-gray-500 py-4">Nema evidentiranih radnika u ovom periodu.</p>}
          {leaderboard.map((radnik, idx) => (
            <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border-l-4" style={{ borderColor: idx === 0 ? limetaZelena : tamnoPlava }}>
              <div className="flex items-center gap-3">
                <span className="text-xl font-black" style={{ color: idx === 0 ? limetaZelena : tamnoPlava }}>{idx + 1}.</span>
                <div>
                  <p className="text-[12px] font-black uppercase text-gray-800">{radnik.ime} {idx === 0 && <span className="text-[8px] text-white bg-amber-500 px-1.5 py-0.5 rounded ml-1">TOP 1</span>}</p>
                  <p className="text-[9px] text-gray-500 mt-0.5">Udio u proizvodnji pilane: <strong className="text-gray-700">{radnik.udio_firme}%</strong></p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[14px] font-black" style={{ color: tamnoPlava }}>{radnik.izlaz_m3} m³</p>
                <p className="text-[9px] font-bold" style={{ color: limetaZelena }}>Lični Yield: {radnik.yield_proc}%</p>
              </div>
            </div>
          ))}
        </div>

        {/* 5. VIZUELNA ANALITIKA PERIODA */}
        <h3 className="font-bold text-white text-[11px] p-1.5 px-2 mb-3 rounded-t print:mt-4" style={{ backgroundColor: tamnoPlava }}>VIZUELNA ANALIZA PERIODA</h3>
        <div className="grid grid-cols-3 gap-4 h-48">
          
          {/* Dinamika (Line Chart) */}
          <div className="border border-gray-200 p-2 flex flex-col items-center justify-center rounded bg-white">
            <h4 className="text-[9px] font-bold mb-1 text-center text-gray-600">Dinamika Proizvodnje (m³ / dan)</h4>
            <div style={{ width: '100%', height: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dinamika} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="dan" fontSize={7} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis fontSize={8} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => `${value} m³`} />
                  <Line type="monotone" dataKey="m3" stroke={tamnoPlava} strokeWidth={2} dot={{ r: 2, fill: limetaZelena }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Mix Proizvoda (Donut) */}
          <div className="border border-gray-200 p-2 flex flex-col items-center justify-center rounded bg-white">
            <h4 className="text-[9px] font-bold mb-1 text-center text-gray-600">Mix Proizvoda (Udio Kategorija)</h4>
            <div style={{ width: '100%', height: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={izlazStruktura} innerRadius={30} outerRadius={50} dataKey="value" stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                    {izlazStruktura.map((entry, index) => (<Cell key={`cell-${index}`} fill={PALETA[index % PALETA.length]} />))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} m³`} />
                  <Legend content={renderCustomLegend} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Zastoji (Bar Chart) */}
          <div className="border border-gray-200 p-2 flex flex-col items-center justify-center rounded bg-white">
            <h4 className="text-[9px] font-bold mb-1 text-center text-gray-600">Analiza Zastoja (Izgubljene minute)</h4>
            <div style={{ width: '100%', height: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={zastojiChart} margin={{ top: 5, right: 5, left: -25, bottom: 0 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" fontSize={7} tickLine={false} axisLine={false} />
                  <YAxis dataKey="razlog" type="category" fontSize={7} tickLine={false} axisLine={false} width={50} />
                  <Tooltip formatter={(value) => `${value} min`} />
                  <Bar dataKey="minute" fill="#ef4444" radius={[0, 4, 4, 0]} isAnimationActive={false} barSize={15} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>

      {/* FOOTER (Napomena i Potpis) */}
      <div className="mt-8 pt-4 border-t border-gray-300 text-[10px] flex justify-between items-end">
        <div className="w-[60%] text-gray-600">
           <strong>Napomene menadžmenta:</strong> 
           <p className="mt-1 border-b border-dotted border-gray-400 h-4"></p>
           <p className="mt-1 border-b border-dotted border-gray-400 h-4"></p>
        </div>
        <div className="w-[30%] text-center">
            <div className="border-b border-gray-800 mb-1 h-8"></div>
            <p className="text-gray-500 font-bold">Odgovorno lice (Potpis)</p>
        </div>
      </div>
      
      {/* Print dugme */}
      <div className="mt-8 text-center print:hidden">
        <button onClick={() => window.print()} className="px-6 py-2.5 text-white font-bold rounded-xl shadow-lg hover:opacity-90" style={{ backgroundColor: tamnoPlava }}>
          🖨️ Isprintaj Menadžerski Izvještaj
        </button>
      </div>

    </div>
  );
}