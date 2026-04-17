"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import SearchableInput from '../components/SearchableInput';
import { printDokument } from '../utils/printHelpers';

const supabase = createClient('https://awaxwejrhmjeqohrgidm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY');

function OTP_SearchableProizvod({ katalog, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value);
    useEffect(() => { setSearch(value); }, [value]);

    const filtered = katalog.filter(k => k.sifra.toUpperCase().includes(search.toUpperCase()) || k.naziv.toUpperCase().includes(search.toUpperCase()));

    return (
        <div className="relative font-black w-full">
            <input value={search} onFocus={() => setOpen(true)} onChange={e => { setSearch(e.target.value); setOpen(true); }} placeholder="Pronađi šifru ili naziv..." className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-orange-500" />
            {open && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    {filtered.map(k => {
                        const tekstZaPolje = `${k.sifra} | ${k.naziv} | Dim: ${k.visina}x${k.sirina}x${k.duzina}`;
                        return (
                            <div key={k.sifra} onClick={() => { onChange(k.sifra, tekstZaPolje); setSearch(tekstZaPolje); setOpen(false); }} className="p-3 border-b border-slate-700 hover:bg-orange-600 cursor-pointer transition-all">
                                <div className="text-white text-xs font-black">{k.sifra} <span className="text-orange-300 ml-1">{k.naziv}</span></div>
                                <div className="text-[9px] text-slate-400 mt-1 uppercase">Kat: {k.kategorija} | Dim: {k.visina}x{k.sirina}x{k.duzina}</div>
                            </div>
                        )
                    })}
                    <div onClick={() => setOpen(false)} className="p-2 text-center text-[8px] text-slate-500 cursor-pointer hover:text-white">Zatvori</div>
                </div>
            )}
        </div>
    );
}

export default function OtpremniceModule({ onExit }) {
    const loggedUser = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');

    const [tab, setTab] = useState('nova');
    const [kupci, setKupci] = useState([]);
    const [katalog, setKatalog] = useState([]);
    const [otpremnice, setOtpremnice] = useState([]);

    const generisiID = () => `OTP-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;

    const [form, setForm] = useState({ id: generisiID(), broj_veze: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0], vozac: '', registracija: '', napomena: '', status: 'KREIRANA' });
    const [stavke, setStavke] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    
    // SMART SEARCH STATE
    const [dostupniDokumenti, setDostupniDokumenti] = useState([]);
    const [prikaziDrop, setPrikaziDrop] = useState(false);
    const [kucanjeTimer, setKucanjeTimer] = useState(null);
    
    const [stavkaForm, setStavkaForm] = useState({ id: null, sifra_unos: '', kolicina_obracun: '', jm_obracun: 'm3' });
    const [trenutniProizvod, setTrenutniProizvod] = useState(null);

    const [skenerInput, setSkenerInput] = useState('');

    useEffect(() => { load(); }, []);

    const load = async () => {
        const {data: k} = await supabase.from('kupci').select('*').order('naziv'); setKupci(k||[]);
        const {data: cat} = await supabase.from('katalog_proizvoda').select('*').order('sifra'); setKatalog(cat||[]);
        const {data: otp} = await supabase.from('otpremnice').select('*').order('datum', { ascending: false }); setOtpremnice(otp||[]);
        
        // Učitavanje svih mogućih veza za pametni dropdown
        const { data: rn } = await supabase.from('radni_nalozi').select('id, kupac_naziv, status').neq('status', 'ZAVRŠENO');
        const { data: pon } = await supabase.from('ponude').select('id, kupac_naziv, status').in('status', ['POTVRĐENA', 'REALIZOVANA ✅']);
        setDostupniDokumenti([
            ...(rn || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Radni Nalog' })),
            ...(pon || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Ponuda' }))
        ]);
    };

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]);
    };

    const skenirajVezu = async (e, forcedVal = null) => {
        if (e?.key === 'Enter' || e?.type === 'click' || forcedVal) {
            const broj = (forcedVal || skenerInput).toUpperCase().trim();
            if(!broj) return;
            
            let dokument = null;
            if (broj.startsWith('PON-')) {
                const { data: ponuda } = await supabase.from('ponude').select('*').eq('id', broj).maybeSingle();
                if(!ponuda) return alert(`❌ Ponuda ${broj} nije pronađena!`);
                dokument = ponuda;
            } else if (broj.startsWith('RN-')) {
                const { data: nalog } = await supabase.from('radni_nalozi').select('*').eq('id', broj).maybeSingle();
                if(!nalog) return alert(`❌ Radni nalog ${broj} nije pronađen!`);
                
                // 🛑 ERP BLOKADA: Nalog mora biti ZAVRŠEN da bi roba izašla
                if (nalog.status !== 'ZAVRŠENO' && nalog.status !== 'ISPORUČENO') {
                    setSkenerInput('');
                    return alert(`⛔ STOP: Radni nalog ${broj} je u statusu "${nalog.status}".\nNe možete praviti otpremnicu i isporučiti robu dok se proizvodnja ne označi kao ZAVRŠENO!`);
                }
                
                dokument = nalog;
            } else {
                return alert("❌ Nepoznat format! Mora početi sa PON- ili RN-");
            }

            const prepravljeneStavke = (dokument.stavke_jsonb || []).map(s => ({
                id: Math.random().toString(), sifra: s.sifra, naziv: s.naziv, 
                kolicina_obracun: s.kolicina_obracun, jm_obracun: s.jm_obracun
            }));
            setForm({ ...form, kupac_naziv: dokument.kupac_naziv, broj_veze: broj, napomena: dokument.napomena || '' });
            setStavke(prepravljeneStavke);
            setSkenerInput('');
            alert(`✅ Uspješno preuzeti podaci iz dokumenta: ${broj}`);
        }
    };

    const handleSkenUnos = (e) => {
        const val = e.target.value.toUpperCase();
        setSkenerInput(val);
        setPrikaziDrop(true); 

        if (kucanjeTimer) clearTimeout(kucanjeTimer);
        if (val) {
            setKucanjeTimer(setTimeout(() => {
                setPrikaziDrop(false); 
                skenirajVezu(null, val); 
            }, 2000));
        }
    };

    const odaberiIzDropdowna = (id) => {
        setSkenerInput(id);
        setPrikaziDrop(false);
        if (kucanjeTimer) clearTimeout(kucanjeTimer);
        skenirajVezu(null, id);
    };

    const handleProizvodSelect = (sifraVal, tekstZaPolje) => {
        const nadjeni = katalog.find(k => k.sifra === sifraVal);
        setTrenutniProizvod(nadjeni || null);
        if (nadjeni) setStavkaForm({ ...stavkaForm, id: null, sifra_unos: tekstZaPolje, jm_obracun: nadjeni.default_jedinica || 'm3' });
    };

    const dodajStavku = () => {
        if(!trenutniProizvod || !stavkaForm.kolicina_obracun) return alert("Odaberite proizvod i unesite količinu!");
        const novaStavka = {
            id: stavkaForm.id || Math.random().toString(), 
            sifra: trenutniProizvod.sifra, naziv: trenutniProizvod.naziv,
            kolicina_obracun: parseFloat(stavkaForm.kolicina_obracun), jm_obracun: stavkaForm.jm_obracun
        };
        if (stavkaForm.id) setStavke(stavke.map(s => s.id === stavkaForm.id ? novaStavka : s));
        else setStavke([...stavke, novaStavka]);
        
        setStavkaForm({ id: null, sifra_unos: '', kolicina_obracun: '', jm_obracun: 'm3' });
        setTrenutniProizvod(null);
    };

    const urediStavku = (stavka) => {
        const nadjeni = katalog.find(k => k.sifra === stavka.sifra);
        setTrenutniProizvod(nadjeni || null);
        const tekstZaPolje = nadjeni ? `${nadjeni.sifra} | ${nadjeni.naziv}` : stavka.sifra;
        setStavkaForm({ id: stavka.id, sifra_unos: tekstZaPolje, kolicina_obracun: stavka.kolicina_obracun, jm_obracun: stavka.jm_obracun });
    };

    const ukloniStavku = (id) => setStavke(stavke.filter(s => s.id !== id));

    const snimiOtpremnicu = async () => {
        if(!form.kupac_naziv) return alert("Kupac je obavezan!");
        if(stavke.length === 0) return alert("Otpremnica mora imati stavke!");
        
        const payload = {
            id: form.id.toUpperCase(), broj_veze: form.broj_veze, kupac_naziv: form.kupac_naziv, 
            datum: form.datum, vozac: form.vozac, registracija: form.registracija, napomena: form.napomena, 
            stavke_jsonb: stavke, status: form.status, snimio_korisnik: loggedUser.ime_prezime
        };

        if (isEditing) {
            const { error } = await supabase.from('otpremnice').update(payload).eq('id', form.id);
            if(error) return alert("Greška: " + error.message);
            await zapisiU_Log('IZMJENA_OTPREMNICE', `Ažurirana otpremnica ${form.id}`);
            alert("✅ Otpremnica uspješno ažurirana!");
        } else {
            const { error } = await supabase.from('otpremnice').insert([payload]);
            if(error) return alert("Greška pri snimanju: " + error.message);
            await zapisiU_Log('KREIRANA_OTPREMNICA', `Otpremnica ${form.id} za ${form.kupac_naziv}`);
            alert("✅ Otpremnica uspješno kreirana!");
        }
        resetFormu(); load(); setTab('lista');
    };

    const resetFormu = () => {
        setForm({ id: generisiID(), broj_veze: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0], vozac: '', registracija: '', napomena: '', status: 'KREIRANA' });
        setStavke([]); setSkenerInput(''); setIsEditing(false);
    };

    const formatirajDatum = (isoString) => {
        if(!isoString) return '';
        const [y, m, d] = isoString.split('-');
        return `${d}.${m}.${y}.`;
    };

    const kreirajPDF = () => {
        const odabraniKupac = kupci.find(k => k.naziv === form.kupac_naziv) || null;
        let redovi = stavke.map((s, i) => `
            <tr>
                <td style="font-weight: bold; color: #64748b; text-align: center;">${i+1}.</td>
                <td><b style="color: #0f172a; font-size: 14px;">${s.sifra}</b><br/><span style="color: #64748b; font-size: 11px;">${s.naziv}</span></td>
                <td style="text-align: center; font-size: 18px; font-weight: 900; color: #f97316;">${s.kolicina_obracun} <span style="color: #64748b; font-size: 12px; font-weight: 600;">${s.jm_obracun}</span></td>
            </tr>
        `).join('');

        const htmlSadrzajTabela = `
            <div class="info-grid">
                <div class="info-col">
                    <h4>Kupac / Primalac robe</h4>
                    <p style="font-size: 18px; font-weight: 900; margin-bottom: 5px;">${form.kupac_naziv}</p>
                    <p style="font-weight: 400; color: #475569;">${odabraniKupac?.adresa || ''}</p>
                    <p style="font-weight: 600; color: #0f172a; font-size: 12px; margin-top: 6px;">PDV / ID: ${odabraniKupac?.pdv_broj || 'N/A'}</p>
                </div>
                <div class="info-col" style="text-align: right;">
                    <h4>Detalji Transporta</h4>
                    <p>Vezni Dokument: <span style="font-weight: 600; color: #0f172a;">${form.broj_veze || '-'}</span></p>
                    <p>Ime Vozača: <span style="font-weight: 600; color: #0f172a;">${form.vozac || '-'}</span></p>
                    <p>Vozilo (Reg): <span style="font-weight: 900; color: #f97316;">${form.registracija || '-'}</span></p>
                </div>
            </div>
            <table>
                <thead><tr><th style="width: 5%; text-align: center;">R.B.</th><th>Šifra i Naziv Proizvoda</th><th style="text-align:center;">Isporučena Količina</th></tr></thead>
                <tbody>${redovi}</tbody>
            </table>
            <div style="display: flex; justify-content: space-between; margin-top: 100px; text-align: center; color: #0f172a; font-weight: 600;">
                <div style="width: 25%;"><div style="border-bottom: 1px solid #94a3b8; margin-bottom: 10px; height: 20px;"></div>Isporučio (Vozač)</div>
                <div style="width: 25%;"><div style="border-bottom: 1px solid #94a3b8; margin-bottom: 10px; height: 20px;"></div>Izdao (Magacin)</div>
                <div style="width: 25%;"><div style="border-bottom: 1px solid #94a3b8; margin-bottom: 10px; height: 20px;"></div>Primio (Kupac)</div>
            </div>
            <div class="footer"><div style="width: 100%;"><b style="color: #0f172a;">Napomena uz isporuku:</b><br/>${form.napomena || 'Roba isporučena bez oštećenja.'}</div></div>
        `;
        printDokument('OTPREMNICA', form.id, formatirajDatum(form.datum), htmlSadrzajTabela, '#f97316');
    };

    const pokreniIzmjenu = (o) => {
        setForm({ id: o.id, broj_veze: o.broj_veze || '', kupac_naziv: o.kupac_naziv, datum: o.datum, vozac: o.vozac || '', registracija: o.registracija || '', napomena: o.napomena || '', status: o.status || 'KREIRANA' });
        setStavke(o.stavke_jsonb || []);
        setIsEditing(true); setTab('nova'); window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 font-bold">
            <div className="flex justify-between items-center bg-[#1e293b] p-4 rounded-3xl border border-orange-500/30 shadow-lg">
                <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase hover:bg-slate-700">← Meni</button>
                <h2 className="text-orange-400 font-black tracking-widest uppercase text-xs">🚚 OTPREMNICE (ISPORUKA)</h2>
            </div>

            <div className="flex bg-[#1e293b] p-1 rounded-2xl border border-slate-700">
                <button onClick={() => {setTab('nova'); if(!isEditing) resetFormu();}} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'nova' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500'}`}>{isEditing ? '✏️ Ažuriranje Otpremnice' : '➕ Nova Otpremnica'}</button>
                <button onClick={() => setTab('lista')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'lista' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500'}`}>📋 Pregled Otpremnica</button>
            </div>

            {tab === 'nova' ? (
                <div className="space-y-4 animate-in slide-in-from-left max-w-4xl mx-auto">
                    
                    {!isEditing && (
                        <div className="bg-slate-900 border border-orange-500/50 p-6 rounded-3xl flex gap-3 items-center shadow-2xl relative">
                            <div className="text-2xl">📷</div>
                            <div className="flex-1 relative">
                                <label className="text-[10px] text-orange-400 uppercase font-black block mb-1">Skener (Skeniraj Ponudu ili Radni Nalog)</label>
                                <input value={skenerInput} onChange={handleSkenUnos} onFocus={() => setPrikaziDrop(true)} placeholder="Skeniraj ili ukucaj broj..." className="w-full p-4 bg-[#0f172a] rounded-xl text-sm text-white outline-none border border-orange-500 focus:border-orange-400 uppercase font-black shadow-inner" />
                                
                                {prikaziDrop && skenerInput && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden z-50 max-h-60 overflow-y-auto text-left">
                                        {dostupniDokumenti
                                            .filter(d => d.id.includes(skenerInput) || (d.kupac && d.kupac.toUpperCase().includes(skenerInput)))
                                            .map(p => (
                                            <div key={p.id} onClick={() => odaberiIzDropdowna(p.id)} className="p-3 border-b border-slate-700 hover:bg-slate-700 cursor-pointer flex justify-between items-center">
                                                <div><span className="text-white font-black">{p.id}</span> <span className="text-[10px] text-orange-400 ml-2 uppercase font-bold">{p.tip}</span></div>
                                                <div className="text-slate-400 text-xs font-bold">{p.kupac}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border-2 border-orange-500/30 shadow-2xl space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-orange-400 font-black uppercase text-xs">1. Parametri Otpremnice</h3>
                            {isEditing && <button onClick={resetFormu} className="text-[10px] bg-red-900/30 text-red-400 px-3 py-1 rounded-xl uppercase hover:bg-red-900/50">Odustani od izmjena ✕</button>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border-b border-slate-700 pb-4">
                            <div className="col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Vezni Dokument (Istorija)</label>
                                <input value={form.broj_veze} onChange={e=>setForm({...form, broj_veze:e.target.value})} className="w-full p-3 bg-slate-900 rounded-xl text-xs text-white outline-none border border-slate-700 uppercase" placeholder="Nema veznog dokumenta" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">BROJ OTPREMNICE</label>
                                <input value={form.id} disabled={isEditing} onChange={e=>setForm({...form, id:e.target.value})} className="w-full p-3 bg-slate-900 rounded-xl text-xs text-white outline-none border border-slate-700 font-black uppercase disabled:opacity-50" />
                            </div>
                            <div className="relative z-40 col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* KUPAC (Za koga isporučujemo)</label>
                                <SearchableInput value={form.kupac_naziv} onChange={v=>setForm({...form, kupac_naziv:v})} list={kupci.map(k=>k.naziv)} />
                            </div>
                            <div>
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Datum isporuke</label>
                                <input type="date" value={form.datum} onChange={e=>setForm({...form, datum:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700" />
                            </div>
                            <div>
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Status</label>
                                <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-orange-500/50 text-orange-400 font-black">
                                    <option value="KREIRANA">Kreirana</option><option value="ISPORUČENO">Isporučeno</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Ime i Prezime Vozača</label>
                                <input value={form.vozac} onChange={e=>setForm({...form, vozac:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700" placeholder="npr. Marko Marković" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Registracija Vozila</label>
                                <input value={form.registracija} onChange={e=>setForm({...form, registracija:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 uppercase" placeholder="npr. A12-B-345" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-4">
                        <h3 className="text-blue-500 font-black uppercase text-xs mb-4">2. Stavke otpremnice (Samo Količina, bez cijena)</h3>
                        
                        <div className="relative z-30 mb-3">
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Pronađi proizvod</label>
                            <OTP_SearchableProizvod katalog={katalog} value={stavkaForm.sifra_unos} onChange={handleProizvodSelect} />
                        </div>

                        {trenutniProizvod && (
                            <div className="p-4 bg-blue-900/10 border border-blue-500/30 rounded-2xl animate-in zoom-in-95 space-y-4">
                                <div className="border-b border-slate-700 pb-3">
                                    <p className="text-white text-sm font-black">{trenutniProizvod.sifra} - {trenutniProizvod.naziv}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">Dim: <span className="text-white">{trenutniProizvod.visina}x{trenutniProizvod.sirina}x{trenutniProizvod.duzina}</span></p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Količina za isporuku</label>
                                        <input type="number" value={stavkaForm.kolicina_obracun} onChange={e=>setStavkaForm({...stavkaForm, kolicina_obracun:e.target.value})} placeholder="0" className="w-full p-3 bg-[#0f172a] rounded-xl text-lg text-white font-black text-center outline-none border border-slate-700 focus:border-blue-500" />
                                    </div>
                                    <div className="w-32">
                                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Jedinica Mjere</label>
                                        <select value={stavkaForm.jm_obracun} onChange={e=>setStavkaForm({...stavkaForm, jm_obracun:e.target.value})} className="w-full p-3 bg-slate-800 rounded-xl text-lg text-white font-black outline-none border border-slate-700"><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option><option value="kom">kom</option></select>
                                    </div>
                                </div>
                                <button onClick={dodajStavku} className={`w-full py-4 text-white font-black rounded-xl text-xs shadow-lg uppercase mt-2 ${stavkaForm.id ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                                    {stavkaForm.id ? '✅ Ažuriraj ovu stavku' : '➕ Dodaj na otpremnicu'}
                                </button>
                            </div>
                        )}
                    </div>

                    {stavke.length > 0 && (
                        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-orange-500/30 shadow-2xl animate-in slide-in-from-bottom">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-orange-400 font-black uppercase text-xs">3. Pregled Otpremnice</h3>
                                <button onClick={kreirajPDF} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-[10px] uppercase font-black border border-slate-600 hover:bg-white hover:text-black transition-all">🖨️ Kreiraj PDF</button>
                            </div>
                            <div className="space-y-2 mb-6">
                                {stavke.map((s, i) => (
                                    <div key={s.id} onClick={() => urediStavku(s)} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-orange-500 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-black">{i+1}</div>
                                            <div><p className="text-white text-xs font-black">{s.sifra} <span className="text-slate-400 font-normal ml-1">{s.naziv}</span></p></div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <p className="text-orange-400 font-black text-lg">{s.kolicina_obracun} {s.jm_obracun}</p>
                                            </div>
                                            <button onClick={(e)=>{e.stopPropagation(); ukloniStavku(s.id);}} className="text-red-500 font-black p-2 hover:bg-red-500/20 rounded-lg">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <textarea value={form.napomena} onChange={e=>setForm({...form, napomena:e.target.value})} placeholder="Napomena na isporuci (opciono)..." className="w-full mt-4 p-4 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-orange-500" rows="3"></textarea>
                            <button onClick={snimiOtpremnicu} className={`w-full mt-4 py-5 text-white font-black rounded-2xl uppercase text-sm shadow-xl transition-all ${isEditing ? 'bg-amber-600 hover:bg-amber-500' : 'bg-orange-600 hover:bg-orange-500'}`}>
                                {isEditing ? '✅ Snimi izmjene otpremnice' : '🖨️ Kreiraj Otpremnicu'}
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl animate-in slide-in-from-right">
                    <h3 className="text-slate-400 font-black uppercase text-[10px] mb-4">Arhiva Otpremnica</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2">
                        {otpremnice.length === 0 && <p className="text-center text-slate-500 text-xs col-span-2">Nema kreiranih otpremnica.</p>}
                        {otpremnice.map(o => (
                            <div key={o.id} onClick={() => pokreniIzmjenu(o)} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl cursor-pointer hover:border-orange-500 transition-all relative overflow-hidden">
                                <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-2">
                                    <div><p className="text-orange-400 font-black text-sm">{o.id}</p><p className="text-white text-xs font-bold mt-1">{o.kupac_naziv}</p></div>
                                    <div className="text-right"><p className={`text-[9px] px-2 py-1 rounded font-black uppercase ${o.status === 'ISPORUČENO' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-orange-900/30 text-orange-400'}`}>{o.status}</p><p className="text-[9px] text-slate-500 uppercase mt-2">{formatirajDatum(o.datum)}</p></div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] text-slate-400">Veza: {o.broj_veze || 'Nema'}</span>
                                    <span className="text-[9px] text-slate-500">Stavki: {o.stavke_jsonb ? o.stavke_jsonb.length : 0} | Vozilo: {o.registracija || 'Nepoznato'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}