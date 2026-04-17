"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function KontrolniToranjModule({ onExit }) {
    const [sken, setSken] = useState('');
    const [timeline, setTimeline] = useState(null);
    const [loading, setLoading] = useState(false);
    
    const [sviDokumenti, setSviDokumenti] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [kucanjeTimer, setKucanjeTimer] = useState(null);

    useEffect(() => {
        const ucitajSve = async () => {
            const { data: pon } = await supabase.from('ponude').select('id, kupac_naziv');
            const { data: rn } = await supabase.from('radni_nalozi').select('id, kupac_naziv');
            const { data: otp } = await supabase.from('otpremnice').select('id, kupac_naziv');
            const { data: rac } = await supabase.from('racuni').select('id, kupac_naziv');
            
            const svi = [
                ...(pon || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Ponuda' })),
                ...(rn || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Radni Nalog' })),
                ...(otp || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Otpremnica' })),
                ...(rac || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Račun' }))
            ];
            setSviDokumenti(svi);
        };
        ucitajSve();
    }, []);

    const analizirajDokument = async (trazeniBroj) => {
        const val = (trazeniBroj || sken).toUpperCase().trim();
        if (!val) return;
        setLoading(true); setShowDropdown(false); setTimeline(null);

        let pronadjenaPonuda = null;

        if (val.startsWith('PON-')) {
            const {data} = await supabase.from('ponude').select('*').eq('id', val).maybeSingle();
            pronadjenaPonuda = data;
        } else if (val.startsWith('RN-')) {
            const {data: rn} = await supabase.from('radni_nalozi').select('broj_ponude').eq('id', val).maybeSingle();
            if (rn && rn.broj_ponude) { const {data} = await supabase.from('ponude').select('*').eq('id', rn.broj_ponude).maybeSingle(); pronadjenaPonuda = data; }
        } else if (val.startsWith('OTP-')) {
            const {data: otp} = await supabase.from('otpremnice').select('broj_veze').eq('id', val).maybeSingle();
            if (otp && otp.broj_veze && otp.broj_veze.startsWith('RN-')) {
                const {data: rn} = await supabase.from('radni_nalozi').select('broj_ponude').eq('id', otp.broj_veze).maybeSingle();
                if (rn && rn.broj_ponude) { const {data} = await supabase.from('ponude').select('*').eq('id', rn.broj_ponude).maybeSingle(); pronadjenaPonuda = data; }
            } else if (otp && otp.broj_veze && otp.broj_veze.startsWith('PON-')) {
                const {data} = await supabase.from('ponude').select('*').eq('id', otp.broj_veze).maybeSingle(); pronadjenaPonuda = data;
            }
        } else if (val.startsWith('RAC-')) {
            const {data: rac} = await supabase.from('racuni').select('broj_veze').eq('id', val).maybeSingle();
            if (rac && rac.broj_veze && rac.broj_veze.startsWith('OTP-')) {
                 const {data: otp} = await supabase.from('otpremnice').select('broj_veze').eq('id', rac.broj_veze).maybeSingle();
                 if(otp && otp.broj_veze && otp.broj_veze.startsWith('RN-')) {
                     const {data: rn} = await supabase.from('radni_nalozi').select('broj_ponude').eq('id', otp.broj_veze).maybeSingle();
                     if(rn) { const {data} = await supabase.from('ponude').select('*').eq('id', rn.broj_ponude).maybeSingle(); pronadjenaPonuda = data; }
                 }
            }
        }

        if (!pronadjenaPonuda) {
            setLoading(false);
            return alert("Sistem ne može uspostaviti lanac sljedivosti za ovaj dokument.");
        }

        const podaci = { ponuda: pronadjenaPonuda, nalozi: [], otpremnice: [], uplate: [] };
        const {data: nalozi} = await supabase.from('radni_nalozi').select('*').eq('broj_ponude', pronadjenaPonuda.id);
        if (nalozi) podaci.nalozi = nalozi;

        const naloziIds = nalozi?.map(n => n.id) || [];
        const sviVezniBrojevi = [pronadjenaPonuda.id, ...naloziIds];
        if (sviVezniBrojevi.length > 0) {
            const {data: otpremnice} = await supabase.from('otpremnice').select('*').in('broj_veze', sviVezniBrojevi);
            if (otpremnice) podaci.otpremnice = otpremnice;
        }

        const {data: uplate} = await supabase.from('blagajna').select('*').eq('racun_id', pronadjenaPonuda.id).eq('tip', 'ULAZ');
        if (uplate) podaci.uplate = uplate;

        setTimeline(podaci); setLoading(false); setSken(val);
    };

    const handleSkenUnos = (e) => {
        const val = e.target.value.toUpperCase();
        setSken(val);
        setShowDropdown(true);

        if (kucanjeTimer) clearTimeout(kucanjeTimer);
        
        if (val) {
            const noviTimer = setTimeout(() => {
                analizirajDokument(val);
            }, 2000);
            setKucanjeTimer(noviTimer);
        }
    };

    const preporuke = sviDokumenti.filter(d => d.id.includes(sken) || (d.kupac && d.kupac.toUpperCase().includes(sken))).slice(0, 5);

    return (
        <div className="p-4 max-w-5xl mx-auto space-y-6 font-bold">
            <div className="flex justify-between items-center bg-[#1e293b] p-4 rounded-3xl border border-blue-500/30 shadow-lg">
                <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase hover:bg-slate-700">← Meni</button>
                <h2 className="text-blue-400 font-black tracking-widest uppercase text-xs">📡 KONTROLNI TORANJ (SLJEDIVOST)</h2>
            </div>

            <div className="bg-[#1e293b] p-8 rounded-[2.5rem] border border-slate-700 shadow-2xl text-center relative z-50">
                <h3 className="text-slate-400 font-black uppercase text-xs mb-4">Skeniraj ili pretraži dokument (Ime kupca ili Broj)</h3>
                <div className="flex gap-2 max-w-2xl mx-auto relative">
                    <div className="flex-1 relative">
                        <input type="text" value={sken} onChange={handleSkenUnos} onFocus={()=>setShowDropdown(true)} placeholder="Npr. OTP-2026-123 ili MARIĆ BAU" className="w-full p-5 bg-[#0f172a] rounded-2xl text-center font-black text-xl text-white border border-blue-500/50 uppercase outline-none focus:border-blue-400" />
                        
                        {showDropdown && sken && preporuke.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden z-50 text-left">
                                {preporuke.map(p => (
                                    <div key={p.id} onClick={() => { setSken(p.id); analizirajDokument(p.id); }} className="p-4 border-b border-slate-700 hover:bg-slate-700 cursor-pointer flex justify-between items-center">
                                        <div><span className="text-white font-black">{p.id}</span> <span className="text-xs text-slate-400 ml-2">({p.tip})</span></div>
                                        <div className="text-blue-400 text-xs">{p.kupac}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <button onClick={() => analizirajDokument(sken)} className="bg-blue-600 px-8 rounded-2xl text-white font-black hover:bg-blue-500 shadow-xl flex items-center gap-2">📷 SKEN</button>
                </div>
            </div>

            {loading && <p className="text-center text-blue-400 animate-pulse mt-10">Pretraga i građenje sljedivosti u toku...</p>}

            {timeline && (
                <div className="bg-[#0f172a] p-8 rounded-[2.5rem] border-2 border-slate-700 shadow-2xl space-y-8 animate-in slide-in-from-bottom">
                    <div className="flex justify-between items-start border-b border-slate-800 pb-6">
                        <div>
                            <h2 className="text-3xl text-white font-black">{timeline.ponuda.kupac_naziv}</h2>
                            <p className="text-slate-400 mt-1">Status posla: <span className="text-pink-400 font-black">{timeline.ponuda.status}</span></p>
                        </div>
                        <div className="text-right bg-slate-900 p-4 rounded-2xl border border-slate-800">
                            <p className="text-[10px] uppercase text-slate-500">Ukupna vrijednost posla</p>
                            <p className="text-3xl text-emerald-400 font-black">{timeline.ponuda.ukupno_sa_pdv.toFixed(2)} KM</p>
                        </div>
                    </div>
                    <div className="relative border-l-4 border-slate-700 ml-6 pl-8 space-y-10 py-4">
                        <div className="relative">
                            <div className="absolute -left-[42px] top-0 w-6 h-6 bg-pink-500 rounded-full border-4 border-[#0f172a]"></div>
                            <h4 className="text-pink-500 font-black text-xs uppercase mb-1">Početak: Kreirana Ponuda</h4>
                            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                                <p className="text-white font-bold text-lg">{timeline.ponuda.id}</p>
                                <p className="text-xs text-slate-400 mt-2">Zabilježio: <span className="text-slate-300">{timeline.ponuda.snimio_korisnik}</span> (Datum: {new Date(timeline.ponuda.datum).toLocaleDateString('bs-BA')})</p>
                            </div>
                        </div>
                        {timeline.nalozi.length > 0 && (
                            <div className="relative">
                                <div className="absolute -left-[42px] top-0 w-6 h-6 bg-purple-500 rounded-full border-4 border-[#0f172a]"></div>
                                <h4 className="text-purple-500 font-black text-xs uppercase mb-1">Faza proizvodnje: Radni Nalozi</h4>
                                <div className="space-y-2">
                                    {timeline.nalozi.map(n => (
                                        <div key={n.id} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-between items-center">
                                            <div><p className="text-white font-bold">{n.id}</p><p className="text-xs text-slate-400">Izdao: {n.snimio_korisnik} | Status: <span className="text-purple-400">{n.status}</span></p></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {timeline.otpremnice.length > 0 && (
                            <div className="relative">
                                <div className="absolute -left-[42px] top-0 w-6 h-6 bg-orange-500 rounded-full border-4 border-[#0f172a]"></div>
                                <h4 className="text-orange-500 font-black text-xs uppercase mb-1">Faza Isporuke: Otpremnice</h4>
                                <div className="space-y-2">
                                    {timeline.otpremnice.map(o => (
                                        <div key={o.id} className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                                            <p className="text-white font-bold">{o.id}</p><p className="text-xs text-slate-400">Vozač: {o.vozac || '-'} | Vozilo: {o.registracija || '-'}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="relative">
                            <div className="absolute -left-[42px] top-0 w-6 h-6 bg-emerald-500 rounded-full border-4 border-[#0f172a] shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                            <h4 className="text-emerald-500 font-black text-xs uppercase mb-1">Status Naplate (Blagajna)</h4>
                            {timeline.uplate.length > 0 ? (
                                <div className="space-y-2">
                                    {timeline.uplate.map((u, i) => (
                                        <div key={u.id} className="bg-emerald-900/20 p-4 rounded-2xl border border-emerald-500/30 flex justify-between items-center">
                                            <div><p className="text-emerald-400 font-bold">{i===0?'Avansna Uplata':'Uplata'} ({u.id})</p><p className="text-[10px] text-slate-400">Blagajnik: {u.snimio_korisnik}</p></div>
                                            <p className="text-xl text-emerald-400 font-black">+{parseFloat(u.iznos).toFixed(2)} KM</p>
                                        </div>
                                    ))}
                                    {(() => {
                                        const dug = timeline.ponuda.ukupno_sa_pdv - timeline.uplate.reduce((a, b) => a + parseFloat(b.iznos), 0);
                                        if (dug <= 0) return <div className="mt-4 p-3 bg-emerald-600 text-white text-center rounded-xl font-black shadow-lg">✅ ISPLAĆENO U POTPUNOSTI</div>;
                                        return <div className="mt-4 p-3 bg-red-900/50 border border-red-500 text-red-400 text-center rounded-xl font-black shadow-lg">⚠️ KUPAC DUGUJE JOŠ: {dug.toFixed(2)} KM</div>;
                                    })()}
                                </div>
                            ) : (
                                <div className="bg-slate-900 p-6 rounded-2xl border border-red-500/50 text-center"><p className="text-red-400 font-black">Nema evidentiranih uplata!</p></div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}