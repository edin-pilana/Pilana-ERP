"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import SearchableInput from '../components/SearchableInput';
import { printDokument } from '../utils/printHelpers';

const supabase = createClient('https://awaxwejrhmjeqohrgidm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY');

function RN_SearchableProizvod({ katalog, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value);
    useEffect(() => { setSearch(value); }, [value]);

    const filtered = katalog.filter(k => k.sifra.toUpperCase().includes(search.toUpperCase()) || k.naziv.toUpperCase().includes(search.toUpperCase()));

    return (
        <div className="relative font-black w-full">
            <input value={search} onFocus={() => setOpen(true)} onChange={e => { setSearch(e.target.value); setOpen(true); }} placeholder="Pronađi šifru ili naziv..." className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-purple-500" />
            {open && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    {filtered.map(k => {
                        const tekstZaPolje = `${k.sifra} | ${k.naziv} | Dim: ${k.visina}x${k.sirina}x${k.duzina}`;
                        return (
                            <div key={k.sifra} onClick={() => { onChange(k.sifra, tekstZaPolje); setSearch(tekstZaPolje); setOpen(false); }} className="p-3 border-b border-slate-700 hover:bg-purple-600 cursor-pointer transition-all">
                                <div className="text-white text-xs font-black">{k.sifra} <span className="text-purple-300 ml-1">{k.naziv}</span></div>
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

export default function RadniNaloziModule({ onExit }) {
    const loggedUser = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');

    const [tab, setTab] = useState('novi');
    const [kupci, setKupci] = useState([]);
    const [katalog, setKatalog] = useState([]);
    const [nalozi, setNalozi] = useState([]);

    const generisiID = () => `RN-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;

    const [form, setForm] = useState({ id: generisiID(), broj_ponude: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0], rok_isporuke: '', napomena: '', status: 'U PROIZVODNJI', modifikovan: false });
    const [stavke, setStavke] = useState([]);
    const [originalneStavke, setOriginalneStavke] = useState(null); 
    const [isEditingNalog, setIsEditingNalog] = useState(false);
    
    const [stavkaForm, setStavkaForm] = useState({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3' });
    const [trenutniProizvod, setTrenutniProizvod] = useState(null);

    const [skenerInput, setSkenerInput] = useState('');

    useEffect(() => { load(); }, []);

    const load = async () => {
        const {data: k} = await supabase.from('kupci').select('*').order('naziv'); setKupci(k||[]);
        const {data: cat} = await supabase.from('katalog_proizvoda').select('*').order('sifra'); setKatalog(cat||[]);
        const {data: rn} = await supabase.from('radni_nalozi').select('*').order('datum', { ascending: false }); setNalozi(rn||[]);
    };

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]);
    };

    const skenirajPonudu = async (e) => {
        if (e.key === 'Enter' || e.type === 'click') {
            const broj = skenerInput.toUpperCase().trim();
            if(!broj) return;
            
            const { data: ponuda } = await supabase.from('ponude').select('*').eq('id', broj).maybeSingle();
            if(!ponuda) return alert(`❌ Ponuda ${broj} nije pronađena u bazi!`);

            if (ponuda.status === 'NA ODLUČIVANJU') {
                return alert(`⛔ STOP: Ponuda ${broj} je još uvijek "NA ODLUČIVANJU".\nKupac je nije odobrio. Morate je prvo prebaciti u "POTVRĐENA" da biste započeli proizvodnju!`);
            }

            const prepravljeneStavke = (ponuda.stavke_jsonb || []).map(s => ({
                id: Math.random().toString(), sifra: s.sifra, naziv: s.naziv, 
                kolicina_unos: s.kolicina_unos, jm_unos: s.jm_unos,
                kolicina_obracun: s.kolicina_obracun, jm_obracun: s.jm_obracun
            }));

            setForm({ ...form, kupac_naziv: ponuda.kupac_naziv, broj_ponude: ponuda.id, napomena: ponuda.napomena });
            setStavke(prepravljeneStavke);
            setOriginalneStavke(JSON.stringify(prepravljeneStavke)); 
            setSkenerInput('');
            alert(`✅ Uspješno preuzeti podaci iz ponude ${broj}`);
        }
    };

    const provjeriModifikacije = (noveStavke) => {
        if(originalneStavke && JSON.stringify(noveStavke) !== originalneStavke) {
            setForm(f => ({...f, modifikovan: true}));
        }
    };

    const handleProizvodSelect = (sifraVal, tekstZaPolje) => {
        const nadjeni = katalog.find(k => k.sifra === sifraVal);
        setTrenutniProizvod(nadjeni || null);
        if (nadjeni) setStavkaForm({ ...stavkaForm, id: null, sifra_unos: tekstZaPolje, jm_unos: 'kom', jm_obracun: nadjeni.default_jedinica || 'm3' });
    };

    useEffect(() => {
        if(!trenutniProizvod || !stavkaForm.kolicina_unos) return;
        const kol = parseFloat(stavkaForm.kolicina_unos);
        let obracun = kol;
        if (stavkaForm.jm_unos === 'kom' && stavkaForm.jm_obracun !== 'kom') {
            const v = parseFloat(trenutniProizvod.visina) || 1;
            const s = parseFloat(trenutniProizvod.sirina) || 1;
            const d = parseFloat(trenutniProizvod.duzina) || 1;
            if (stavkaForm.jm_obracun === 'm3') obracun = kol * (v/100) * (s/100) * (d/100);
            if (stavkaForm.jm_obracun === 'm2') obracun = kol * (s/100) * (d/100);
            if (stavkaForm.jm_obracun === 'm1') obracun = kol * (d/100);
        }
        setStavkaForm(prev => ({...prev, kolicina_obracun: obracun > 0 ? obracun.toFixed(4) : kol}));
    }, [stavkaForm.kolicina_unos, stavkaForm.jm_unos, stavkaForm.jm_obracun, trenutniProizvod]);

    const dodajStavku = () => {
        if(!trenutniProizvod || !stavkaForm.kolicina_obracun) return alert("Odaberite proizvod i provjerite količine!");

        const novaStavka = {
            id: stavkaForm.id || Math.random().toString(), 
            sifra: trenutniProizvod.sifra, naziv: trenutniProizvod.naziv,
            kolicina_unos: parseFloat(stavkaForm.kolicina_unos), jm_unos: stavkaForm.jm_unos,
            kolicina_obracun: parseFloat(stavkaForm.kolicina_obracun), jm_obracun: stavkaForm.jm_obracun
        };

        let noveStavke = [];
        if (stavkaForm.id) noveStavke = stavke.map(s => s.id === stavkaForm.id ? novaStavka : s);
        else noveStavke = [...stavke, novaStavka];
        
        setStavke(noveStavke);
        provjeriModifikacije(noveStavke); 

        setStavkaForm({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3' });
        setTrenutniProizvod(null);
    };

    const urediStavku = (stavka) => {
        const nadjeni = katalog.find(k => k.sifra === stavka.sifra);
        setTrenutniProizvod(nadjeni || null);
        const tekstZaPolje = nadjeni ? `${nadjeni.sifra} | ${nadjeni.naziv}` : stavka.sifra;
        setStavkaForm({ id: stavka.id, sifra_unos: tekstZaPolje, kolicina_unos: stavka.kolicina_unos, jm_unos: stavka.jm_unos, kolicina_obracun: stavka.kolicina_obracun, jm_obracun: stavka.jm_obracun });
    };

    const ukloniStavku = (id) => {
        const noveStavke = stavke.filter(s => s.id !== id);
        setStavke(noveStavke);
        provjeriModifikacije(noveStavke);
    };

    const snimiNalog = async () => {
        if(!form.kupac_naziv) return alert("Kupac je obavezan!");
        if(stavke.length === 0) return alert("Nalog mora imati stavke!");
        
        const payload = {
            id: form.id.toUpperCase(), broj_ponude: form.broj_ponude, kupac_naziv: form.kupac_naziv, 
            datum: form.datum, rok_isporuke: form.rok_isporuke, napomena: form.napomena, 
            stavke_jsonb: stavke, status: form.status, modifikovan: form.modifikovan,
            snimio_korisnik: loggedUser.ime_prezime
        };

        if (isEditingNalog) {
            const { error } = await supabase.from('radni_nalozi').update(payload).eq('id', form.id);
            if(error) return alert("Greška: " + error.message);
            await zapisiU_Log('IZMJENA_RN', `Ažuriran Radni Nalog ${form.id}`);
            alert("✅ Nalog uspješno ažuriran!");
        } else {
            const { error } = await supabase.from('radni_nalozi').insert([payload]);
            if(error) return alert("Greška pri snimanju: " + error.message);
            await zapisiU_Log('KREIRAN_RN', `Nalog ${form.id} za ${form.kupac_naziv}`);
            alert("✅ Radni Nalog uspješno kreiran!");
        }
        
        resetFormu(); load(); setTab('lista');
    };

    const resetFormu = () => {
        setForm({ id: generisiID(), broj_ponude: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0], rok_isporuke: '', napomena: '', status: 'U PROIZVODNJI', modifikovan: false });
        setStavke([]); setOriginalneStavke(null); setSkenerInput(''); setIsEditingNalog(false);
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
                <td><b style="color: #0f172a; font-size: 13px;">${s.sifra}</b><br/><span style="color: #64748b; font-size: 11px;">${s.naziv}</span></td>
                <td style="text-align: center; font-size: 16px; font-weight: 900; color: #a855f7;">${s.kolicina_obracun} <span style="color: #64748b; font-size: 11px; font-weight: 600;">${s.jm_obracun}</span></td>
                <td style="text-align: center; font-weight: 600; color: #475569;">${s.kolicina_unos} <span style="font-size: 10px;">${s.jm_unos}</span></td>
            </tr>
        `).join('');

        const htmlSadrzajTabela = `
            <div class="info-grid">
                <div class="info-col">
                    <h4>Naručilac / Kupac</h4>
                    <p style="font-size: 18px; font-weight: 900; margin-bottom: 5px;">${form.kupac_naziv}</p>
                    <p style="font-weight: 400; color: #475569;">${odabraniKupac?.adresa || 'Adresa nije unesena u bazu'}</p>
                </div>
                <div class="info-col" style="text-align: right;">
                    <h4>Detalji Proizvodnje</h4>
                    <p>Vezana Ponuda: <span style="font-weight: 600; color: #0f172a;">${form.broj_ponude || '-'}</span></p>
                    <p>Status: <span style="font-weight: 900; color: #a855f7;">${form.status}</span></p>
                    <p style="color: #0f172a; margin-top: 8px; font-weight: 800;">Rok Isporuke: ${formatirajDatum(form.rok_isporuke)}</p>
                </div>
            </div>
            
            <table>
                <thead><tr><th style="width: 5%; text-align: center;">R.B.</th><th>Šifra i Naziv Proizvoda</th><th style="text-align:center;">Proizvesti (Cilj)</th><th style="text-align:center;">Norma / Ulaz</th></tr></thead>
                <tbody>${redovi}</tbody>
            </table>
            
            <div class="footer">
                <div style="width: 60%;">
                    <b style="color: #0f172a;">Uputstva za proizvodnju:</b><br/>
                    ${form.napomena || 'Nema posebnih uputstava. Proizvesti prema standardu.'}
                </div>
                <div style="text-align: right; width: 30%;">
                    <div style="border-bottom: 1px solid #cbd5e1; margin-bottom: 5px; height: 40px;"></div>
                    Rukovodilac proizvodnje
                </div>
            </div>
        `;
        printDokument('RADNI NALOG', form.id, formatirajDatum(form.datum), htmlSadrzajTabela, '#a855f7');
    };

    const pokreniIzmjenuNaloga = (n) => {
        setForm({ id: n.id, broj_ponude: n.broj_ponude || '', kupac_naziv: n.kupac_naziv, datum: n.datum, rok_isporuke: n.rok_isporuke || '', napomena: n.napomena || '', status: n.status || 'U PROIZVODNJI', modifikovan: n.modifikovan || false });
        setStavke(n.stavke_jsonb || []);
        setIsEditingNalog(true); setTab('novi'); window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 font-bold">
            <div className="flex justify-between items-center bg-[#1e293b] p-4 rounded-3xl border border-purple-500/30 shadow-lg">
                <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase hover:bg-slate-700">← Meni</button>
                <h2 className="text-purple-400 font-black tracking-widest uppercase text-xs">🛠️ RADNI NALOZI (PROIZVODNJA)</h2>
            </div>

            <div className="flex bg-[#1e293b] p-1 rounded-2xl border border-slate-700">
                <button onClick={() => {setTab('novi'); if(!isEditingNalog) resetFormu();}} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'novi' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500'}`}>{isEditingNalog ? '✏️ Ažuriranje Naloga' : '➕ Novi Nalog'}</button>
                <button onClick={() => setTab('lista')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'lista' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500'}`}>📋 Pregled Naloga</button>
            </div>

            {tab === 'novi' ? (
                <div className="space-y-4 animate-in slide-in-from-left max-w-4xl mx-auto">
                    
                    {!isEditingNalog && (
                        <div className="bg-slate-900 border border-blue-500/50 p-6 rounded-3xl flex gap-3 items-center shadow-2xl">
                            <div className="text-2xl">📷</div>
                            <div className="flex-1">
                                <label className="text-[10px] text-blue-400 uppercase font-black block mb-1">Skener QR Koda ili Ručni unos ponude</label>
                                <input value={skenerInput} onChange={e=>setSkenerInput(e.target.value)} onKeyDown={skenirajPonudu} placeholder="npr. PON-2026-1234 (i pritisni Enter)" className="w-full p-4 bg-[#0f172a] rounded-xl text-sm text-white outline-none border border-blue-500 focus:border-blue-400 uppercase font-black tracking-widest shadow-inner" />
                            </div>
                            <button onClick={skenirajPonudu} className="bg-blue-600 text-white px-6 py-4 rounded-xl text-xs uppercase font-black hover:bg-blue-500 self-end mb-1">Učitaj</button>
                        </div>
                    )}

                    <div className={`bg-[#1e293b] p-6 rounded-[2.5rem] border-2 shadow-2xl space-y-4 ${form.modifikovan ? 'border-amber-500' : 'border-purple-500/30'}`}>
                        <div className="flex justify-between items-center">
                            <h3 className="text-purple-400 font-black uppercase text-xs">1. Parametri Radnog Naloga</h3>
                            {isEditingNalog && <button onClick={resetFormu} className="text-[10px] bg-red-900/30 text-red-400 px-3 py-1 rounded-xl uppercase hover:bg-red-900/50">Odustani od izmjena ✕</button>}
                        </div>

                        {form.modifikovan && (
                            <div className="bg-amber-900/40 border border-amber-500 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
                                <span className="text-2xl">⚠️</span>
                                <div className="text-[10px] text-amber-400 uppercase font-black leading-tight">
                                    PAŽNJA: Ovaj radni nalog je ručno izmijenjen i više se ne poklapa 100% sa originalnom ponudom.<br/>
                                    <span className="text-white font-normal mt-1 block">Ova informacija će biti poslana u računovodstvo za otpremnicu i račun!</span>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border-b border-slate-700 pb-4">
                            <div className="col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Broj Ponude (Vezni dokument)</label>
                                <input value={form.broj_ponude} onChange={e=>setForm({...form, broj_ponude:e.target.value})} className="w-full p-3 bg-slate-900 rounded-xl text-xs text-white outline-none border border-slate-700 uppercase" placeholder="Nema vezane ponude" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">BROJ NALOGA</label>
                                <input value={form.id} disabled={isEditingNalog} onChange={e=>setForm({...form, id:e.target.value})} className="w-full p-3 bg-slate-900 rounded-xl text-xs text-white outline-none border border-slate-700 font-black uppercase disabled:opacity-50" />
                            </div>
                            <div className="relative z-50 col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">* KUPAC (Za koga proizvodimo)</label>
                                <SearchableInput value={form.kupac_naziv} onChange={v=>setForm({...form, kupac_naziv:v})} list={kupci.map(k=>k.naziv)} />
                            </div>
                            <div>
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Datum izdavanja</label>
                                <input type="date" value={form.datum} onChange={e=>setForm({...form, datum:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700" />
                            </div>
                            <div>
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Rok Isporuke</label>
                                <input type="date" value={form.rok_isporuke} onChange={e=>setForm({...form, rok_isporuke:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Status Proizvodnje</label>
                                <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-purple-500/50 text-purple-400 font-black">
                                    <option value="U PROIZVODNJI">U proizvodnji</option><option value="ZAVRŠENO">Završeno (Spremno za isporuku)</option><option value="ISPORUČENO">Isporučeno</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-4">
                        <h3 className="text-blue-500 font-black uppercase text-xs mb-4">2. Unos stavki za proizvodnju (BEZ CIJENA)</h3>
                        
                        <div className="relative z-40 mb-3">
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Pronađi proizvod</label>
                            <RN_SearchableProizvod katalog={katalog} value={stavkaForm.sifra_unos} onChange={handleProizvodSelect} />
                        </div>

                        {trenutniProizvod && (
                            <div className="p-4 bg-blue-900/10 border border-blue-500/30 rounded-2xl animate-in zoom-in-95 space-y-4">
                                <div className="border-b border-slate-700 pb-3">
                                    <p className="text-white text-sm font-black">{trenutniProizvod.sifra} - {trenutniProizvod.naziv}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">Dim: <span className="text-white">{trenutniProizvod.visina}x{trenutniProizvod.sirina}x{trenutniProizvod.duzina}</span> | Kat: {trenutniProizvod.kategorija}</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Zahtijevana Količina (Unos)</label>
                                        <div className="flex gap-1">
                                            <input type="number" value={stavkaForm.kolicina_unos} onChange={e=>setStavkaForm({...stavkaForm, kolicina_unos:e.target.value})} placeholder="0" className="flex-1 p-3 bg-[#0f172a] rounded-xl text-lg text-white font-black text-center outline-none border border-slate-700 focus:border-blue-500" />
                                            <select value={stavkaForm.jm_unos} onChange={e=>setStavkaForm({...stavkaForm, jm_unos:e.target.value})} className="w-24 p-3 bg-slate-800 rounded-xl text-xs text-white outline-none border border-slate-700"><option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option></select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Kalkulacija proizvodnje</label>
                                        <div className="flex gap-1">
                                            <input type="number" value={stavkaForm.kolicina_obracun} onChange={e=>setStavkaForm({...stavkaForm, kolicina_obracun:e.target.value})} className="flex-1 p-3 bg-blue-900/20 rounded-xl text-sm text-blue-400 font-black text-center outline-none border border-blue-500/50" />
                                            <select value={stavkaForm.jm_obracun} onChange={e=>setStavkaForm({...stavkaForm, jm_obracun:e.target.value})} className="w-24 p-3 bg-slate-800 rounded-xl text-xs text-white outline-none border border-slate-700"><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option><option value="kom">kom</option></select>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={dodajStavku} className={`w-full py-4 text-white font-black rounded-xl text-xs shadow-lg uppercase mt-2 ${stavkaForm.id ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                                    {stavkaForm.id ? '✅ Ažuriraj ovu stavku' : '➕ Dodaj u radni nalog'}
                                </button>
                            </div>
                        )}
                    </div>

                    {stavke.length > 0 && (
                        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-purple-500/30 shadow-2xl animate-in slide-in-from-bottom">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-purple-400 font-black uppercase text-xs">3. Pregled Radnog Naloga</h3>
                                <button onClick={kreirajPDF} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-[10px] uppercase font-black border border-slate-600 hover:bg-white hover:text-black transition-all">🖨️ Kreiraj PDF</button>
                            </div>
                            <div className="space-y-2 mb-6">
                                {stavke.map((s, i) => (
                                    <div key={s.id} onClick={() => urediStavku(s)} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-purple-500 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-black">{i+1}</div>
                                            <div>
                                                <p className="text-white text-xs font-black">{s.sifra} <span className="text-slate-400 font-normal ml-1">{s.naziv}</span></p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <p className="text-xs text-slate-400 uppercase">Proizvesti:</p>
                                                <p className="text-purple-400 font-black text-sm">{s.kolicina_obracun} {s.jm_obracun} <span className="text-slate-500 text-[10px]">({s.kolicina_unos} {s.jm_unos})</span></p>
                                            </div>
                                            <button onClick={(e)=>{e.stopPropagation(); ukloniStavku(s.id);}} className="text-red-500 font-black p-2 hover:bg-red-500/20 rounded-lg">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <textarea value={form.napomena} onChange={e=>setForm({...form, napomena:e.target.value})} placeholder="Uputa za radnike na mašinama (opciono)..." className="w-full mt-4 p-4 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-purple-500" rows="3"></textarea>
                            <button onClick={snimiNalog} className={`w-full mt-4 py-5 text-white font-black rounded-2xl uppercase text-sm shadow-xl transition-all ${isEditingNalog ? 'bg-amber-600 hover:bg-amber-500' : 'bg-purple-600 hover:bg-purple-500'}`}>
                                {isEditingNalog ? '✅ Snimi izmjene naloga' : '🖨️ Kreiraj Radni Nalog'}
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl animate-in slide-in-from-right">
                    <h3 className="text-slate-400 font-black uppercase text-[10px] mb-4">Arhiva radnih naloga</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2">
                        {nalozi.length === 0 && <p className="text-center text-slate-500 text-xs col-span-2">Nema kreiranih radnih naloga.</p>}
                        {nalozi.map(n => (
                            <div key={n.id} onClick={() => pokreniIzmjenuNaloga(n)} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl cursor-pointer hover:border-purple-500 transition-all relative overflow-hidden">
                                {n.modifikovan && <div className="absolute top-0 right-0 bg-amber-500 text-black text-[8px] px-2 py-1 font-black rounded-bl-lg uppercase">Mijenjan</div>}
                                <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-2">
                                    <div><p className="text-purple-400 font-black text-sm">{n.id}</p><p className="text-white text-xs font-bold mt-1">{n.kupac_naziv}</p></div>
                                    <div className="text-right"><p className={`text-[9px] px-2 py-1 rounded font-black uppercase ${n.status === 'ZAVRŠENO' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-purple-900/30 text-purple-400'}`}>{n.status}</p><p className="text-[9px] text-slate-500 uppercase mt-2">Rok: {n.rok_isporuke}</p></div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] text-slate-400">Vezano za: {n.broj_ponude || 'Nema ponude'}</span>
                                    <span className="text-[9px] text-slate-500">Stavki za izradu: {n.stavke_jsonb ? n.stavke_jsonb.length : 0}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}