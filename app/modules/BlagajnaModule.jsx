"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import { printDokument } from '../utils/printHelpers';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function BlagajnaModule({ user, header, setHeader, onExit }) {
    const loggedUser = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');

    const [tab, setTab] = useState('unos');
    const [sveTransakcije, setSveTransakcije] = useState([]); 
    const [kategorije, setKategorije] = useState([]);
    const [masine, setMasine] = useState([]);
    const [radnici, setRadnici] = useState([]);

    const generisiID = () => `KASA-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000)}`;

    const formatirajDatum = (isoString) => {
        if(!isoString) return '';
        if(isoString.includes('.')) return isoString; 
        const [y, m, d] = isoString.split('T')[0].split('-');
        return `${d}.${m}.${y}.`;
    };

    const [kucanjeTimer, setKucanjeTimer] = useState(null);
    const [showSkenerDrop, setShowSkenerDrop] = useState(false);
    const [sviDokumenti, setSviDokumenti] = useState([]);
    
    const [skenDetalji, setSkenDetalji] = useState(null); 
    
    const [prikazDokumenta, setPrikazDokumenta] = useState(null);

    const [form, setForm] = useState({
        id: generisiID(), tip: 'ULAZ', kategorija: '', iznos: '', opis: '',
        racun_id: '', masina_naziv: '', radnik_ime: '', datum: new Date().toISOString().split('T')[0]
    });

    const [skener, setSkener] = useState('');

    useEffect(() => { load(); }, []); 

    const load = async () => {
        const { data: kat } = await supabase.from('blagajna_kategorije').select('*');
        setKategorije(kat || []);
        if (kat && kat.length > 0 && !form.kategorija) {
            setForm(f => ({ ...f, kategorija: kat.find(k => k.tip === f.tip)?.naziv || '' }));
        }

        const { data: rn } = await supabase.from('radni_nalozi').select('id, kupac_naziv, status').neq('status', 'ZAVRŠENO');
        const { data: otp } = await supabase.from('otpremnice').select('id, kupac_naziv, status').neq('status', 'ISPORUČENO');
        const { data: pon } = await supabase.from('ponude').select('id, kupac_naziv, status').in('status', ['POTVRĐENA', 'REALIZOVANA ✅']);
        const { data: rac } = await supabase.from('racuni').select('id, kupac_naziv, status').neq('status', 'NAPLAĆENO');
        
        setSviDokumenti([
            ...(rac || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Račun' })),
            ...(pon || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Ponuda' })),
            ...(rn || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Radni Nalog' })),
            ...(otp || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Otpremnica' }))
        ]);

        const { data: b } = await supabase.from('blagajna').select('*').order('created_at', { ascending: false });
        setSveTransakcije(b || []);

        const { data: m } = await supabase.from('masine').select('naziv'); setMasine(m || []);
        const { data: rad } = await supabase.from('radnici').select('ime_prezime'); setRadnici(rad || []);
    };

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]);
    };

    const otvoriDokument = async (docId) => {
        if(!docId) return;
        if(docId.startsWith('RAC-')) {
            const {data} = await supabase.from('racuni').select('*').eq('id', docId).maybeSingle();
            if(data) setPrikazDokumenta({ tip: 'RAČUN', data }); else alert('Dokument nije pronađen u bazi.');
        } else if(docId.startsWith('PON-')) {
            const {data} = await supabase.from('ponude').select('*').eq('id', docId).maybeSingle();
            if(data) setPrikazDokumenta({ tip: 'PONUDA', data }); else alert('Dokument nije pronađen u bazi.');
        } else {
            alert("Sistem za sada može prikazati samo Račune i Ponude direktno iz blagajne.");
        }
    };

    const handleTipChange = (noviTip) => {
        const defKat = kategorije.find(k => k.tip === noviTip)?.naziv || '';
        setForm({ ...form, tip: noviTip, kategorija: defKat, racun_id: '', masina_naziv: '', radnik_ime: '', iznos: '', opis: '' });
        setSkenDetalji(null);
    };

    const handleSkenUnos = (e) => {
        const val = e.target.value.toUpperCase();
        setSkener(val);
        setShowSkenerDrop(true);

        if (kucanjeTimer) clearTimeout(kucanjeTimer);
        if (val) {
            const timer = setTimeout(() => {
                izvrsiSkeniranje(val);
                setShowSkenerDrop(false); 
            }, 2000);
            setKucanjeTimer(timer);
        }
    };

    const izvrsiSkeniranje = async (trazeniBroj) => {
        const val = trazeniBroj.trim();
        if (!val) return;
        setSkenDetalji(null); 

        let glavnaVeza = null; let ukupnoZaPlatiti = 0; let kupac = ''; let tipSkenera = '';

        let { data: rac } = await supabase.from('racuni').select('id, ukupno_sa_pdv, kupac_naziv').eq('id', val).maybeSingle();
        if (rac) { glavnaVeza = rac.id; ukupnoZaPlatiti = rac.ukupno_sa_pdv; kupac = rac.kupac_naziv; tipSkenera = 'RAČUN'; }

        if (!glavnaVeza) {
            let { data: pon } = await supabase.from('ponude').select('id, ukupno_sa_pdv, kupac_naziv').eq('id', val).maybeSingle();
            if (pon) { glavnaVeza = pon.id; ukupnoZaPlatiti = pon.ukupno_sa_pdv; kupac = pon.kupac_naziv; tipSkenera = 'PONUDA'; }
        }

        if (!glavnaVeza) {
            let { data: rn } = await supabase.from('radni_nalozi').select('broj_ponude').eq('id', val).maybeSingle();
            if (rn && rn.broj_ponude) {
                let { data: pon } = await supabase.from('ponude').select('id, ukupno_sa_pdv, kupac_naziv').eq('id', rn.broj_ponude).maybeSingle();
                if (pon) { glavnaVeza = pon.id; ukupnoZaPlatiti = pon.ukupno_sa_pdv; kupac = pon.kupac_naziv; tipSkenera = 'RADNI NALOG'; }
            }
        }

        if (!glavnaVeza) {
            let { data: otp } = await supabase.from('otpremnice').select('broj_veze').eq('id', val).maybeSingle();
            if (otp && otp.broj_veze) {
                let veza = otp.broj_veze;
                let { data: rn } = await supabase.from('radni_nalozi').select('broj_ponude').eq('id', veza).maybeSingle();
                if (rn && rn.broj_ponude) veza = rn.broj_ponude;
                let { data: pon } = await supabase.from('ponude').select('id, ukupno_sa_pdv, kupac_naziv').eq('id', veza).maybeSingle();
                if (pon) { glavnaVeza = pon.id; ukupnoZaPlatiti = pon.ukupno_sa_pdv; kupac = pon.kupac_naziv; tipSkenera = 'OTPREMNICA'; }
            }
        }

        if (ukupnoZaPlatiti > 0) {
            const vecUplaceno = sveTransakcije.filter(t => t.racun_id === glavnaVeza && t.tip === 'ULAZ').reduce((a, b) => a + parseFloat(b.iznos), 0);
            let preostalo = (ukupnoZaPlatiti - vecUplaceno).toFixed(2);
            
            setSkenDetalji({ tip: tipSkenera, skenirano: val, glavna_veza: glavnaVeza, kupac, ukupno: ukupnoZaPlatiti, placeno: vecUplaceno, preostalo });

            if (preostalo <= 0) {
                setSkener(''); 
                return alert(`✅ Dugovanje nula! Ovaj dokument je već u potpunosti isplaćen.`);
            }

            setForm({
                ...form, tip: 'ULAZ', 
                kategorija: kategorije.find(k=>k.naziv.includes('Račun') || k.naziv.includes('Avans'))?.naziv || kategorije[0]?.naziv,
                iznos: preostalo, racun_id: glavnaVeza, 
                opis: `Naplata po skeniranom: ${tipSkenera} (${val})`
            });
            setSkener(''); 
        } else {
            alert(`❌ Sistem nije uspio pronaći finansijski trag za dokument: ${val}.`);
        }
    };

    const snimiTransakciju = async () => {
        if (!form.iznos || parseFloat(form.iznos) <= 0) return alert("Unesite ispravan iznos!");
        if (!form.kategorija) return alert("Odaberite kategoriju!");

        const payload = {
            id: form.id, tip: form.tip, kategorija: form.kategorija,
            iznos: parseFloat(form.iznos), opis: form.opis || null,
            racun_id: form.racun_id || null, masina_naziv: form.masina_naziv || null,
            radnik_ime: form.radnik_ime || null, datum: form.datum,
            vrijeme_tekst: new Date().toLocaleTimeString('de-DE'),
            snimio_korisnik: loggedUser.ime_prezime || 'Nepoznat'
        };

        const { error } = await supabase.from('blagajna').insert([payload]);
        if (error) return alert("Greška pri upisu u kasu: " + error.message);

        if (payload.tip === 'ULAZ' && payload.racun_id && payload.racun_id.startsWith('RAC-')) {
            const {data: r} = await supabase.from('racuni').select('ukupno_sa_pdv').eq('id', payload.racun_id).maybeSingle();
            if (r) {
                const sveUplate = sveTransakcije.filter(t => t.racun_id === payload.racun_id).reduce((a,b)=>a+parseFloat(b.iznos), 0) + payload.iznos;
                if (sveUplate >= r.ukupno_sa_pdv) {
                    await supabase.from('racuni').update({ status: 'NAPLAĆENO' }).eq('id', payload.racun_id);
                } else {
                    await supabase.from('racuni').update({ status: 'DJELOMIČNO PLAĆENO' }).eq('id', payload.racun_id);
                }
            }
        }

        await zapisiU_Log('KASA_UNOS', `Upisan ${payload.tip} od ${payload.iznos} KM u blagajnu (${payload.kategorija}).`);
        alert("✅ Transakcija uspješno snimljena u blagajnu!");
        
        if (window.confirm("Da li želite isprintati Potvrdu o Uplati/Isplati?")) {
            printPotvrda(payload);
        }
        
        setForm({ ...form, id: generisiID(), iznos: '', opis: '', racun_id: '', masina_naziv: '', radnik_ime: '' });
        setSkenDetalji(null);
        load(); setTab('pregled');
    };

    const obrisiTransakciju = async (t) => {
        if(window.confirm(`Da li ste sigurni da želite OBRISATI ovu transakciju od ${t.iznos} KM?\nUkoliko je greška u unosu uplaćenog računa, napravite STORNIRANJE umjesto brisanja.`)) {
            await supabase.from('blagajna').delete().eq('id', t.id);
            await zapisiU_Log('KASA_BRISANJE', `Obrisana transakcija ${t.id} od ${t.iznos} KM (${t.kategorija}).`);
            load();
        }
    };

    const printPotvrda = (t) => {
        const title = t.tip === 'ULAZ' ? 'POTVRDA O UPLATI' : 'POTVRDA O ISPLATI';
        const color = t.tip === 'ULAZ' ? '#10b981' : '#ef4444';
        
        const html = `
            <div style="font-family: Arial, sans-serif; padding: 40px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 2px solid ${color}; border-radius: 12px; margin-top: 50px;">
                <div style="text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 20px; margin-bottom: 30px;">
                    <h1 style="color: ${color}; margin: 0; font-size: 28px;">${title}</h1>
                    <p style="color: #64748b; font-weight: bold; margin-top: 5px;">Broj: ${t.id}</p>
                </div>
                <table style="width: 100%; font-size: 16px; margin-bottom: 40px; line-height: 2;">
                    <tr><td style="color:#64748b; width:40%;">Datum i Vrijeme:</td><td style="font-weight:bold;">${formatirajDatum(t.datum)} u ${t.vrijeme_tekst}</td></tr>
                    <tr><td style="color:#64748b;">Kategorija:</td><td style="font-weight:bold;">${t.kategorija}</td></tr>
                    ${t.racun_id ? `<tr><td style="color:#64748b;">Vezni Dokument:</td><td style="font-weight:bold;">${t.racun_id}</td></tr>` : ''}
                    ${t.radnik_ime ? `<tr><td style="color:#64748b;">Zaposlenik:</td><td style="font-weight:bold;">${t.radnik_ime}</td></tr>` : ''}
                    <tr><td style="color:#64748b; vertical-align: top;">Opis / Svrha:</td><td style="font-weight:bold; border: 1px solid #e2e8f0; padding: 10px; background: #f8fafc; border-radius: 8px;">${t.opis || '-'}</td></tr>
                </table>
                <div style="background: ${color}20; padding: 20px; text-align: center; border-radius: 12px; border: 1px solid ${color}; margin-bottom: 50px;">
                    <span style="font-size: 14px; color: #475569; text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 5px;">Iznos transakcije</span>
                    <span style="font-size: 36px; font-weight: 900; color: ${color};">${parseFloat(t.iznos).toFixed(2)} KM</span>
                </div>
                <div style="display: flex; justify-content: space-between; text-align: center; margin-top: 60px;">
                    <div style="width: 40%;"><div style="border-bottom: 1px solid #94a3b8; height: 30px; margin-bottom: 10px;"></div><span style="font-size: 12px; font-weight: bold;">Blagajnik ( ${t.snimio_korisnik} )</span></div>
                    <div style="width: 40%;"><div style="border-bottom: 1px solid #94a3b8; height: 30px; margin-bottom: 10px;"></div><span style="font-size: 12px; font-weight: bold;">Uplatilac / Primalac</span></div>
                </div>
            </div>
        `;
        printDokument(title, t.id, formatirajDatum(t.datum), html, color);
    };

    const aktivniDatum = header?.datum || new Date().toISOString().split('T')[0];
    const prikazaneTransakcije = sveTransakcije.filter(t => t.datum === aktivniDatum);
    
    const periodUlaz = prikazaneTransakcije.filter(t => t.tip === 'ULAZ').reduce((acc, t) => acc + parseFloat(t.iznos), 0);
    const periodIzlaz = prikazaneTransakcije.filter(t => t.tip === 'IZLAZ').reduce((acc, t) => acc + parseFloat(t.iznos), 0);
    const periodPromet = periodUlaz - periodIzlaz;
    
    const apsolutnoStanjeKase = sveTransakcije.filter(t => t.tip === 'ULAZ').reduce((a,b)=>a+parseFloat(b.iznos),0) - sveTransakcije.filter(t => t.tip === 'IZLAZ').reduce((a,b)=>a+parseFloat(b.iznos),0);

    const unikatneKatUlaz = [...new Set(prikaneTransakcije.filter(t => t.tip === 'ULAZ').map(t => t.kategorija))];
    const unikatneKatIzlaz = [...new Set(prikaneTransakcije.filter(t => t.tip === 'IZLAZ').map(t => t.kategorija))];

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 font-bold">
            {prikazDokumenta && (
                <div className="fixed inset-0 z-[100] bg-[#090e17]/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-[#1e293b] border-2 border-emerald-500 p-8 rounded-[2.5rem] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center border-b border-slate-700 pb-4 mb-4">
                            <div>
                                <h3 className="text-emerald-400 font-black uppercase text-xs">Detalji: {prikazDokumenta.tip}</h3>
                                <p className="text-white text-xl font-black mt-1">{prikazDokumenta.data.id}</p>
                            </div>
                            <button onClick={() => setPrikazDokumenta(null)} className="text-red-400 bg-slate-800 hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl text-xs font-black uppercase transition-all">✕ Zatvori</button>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                                <p className="text-[10px] text-slate-500 uppercase font-black">Kupac</p>
                                <p className="text-white font-black text-lg">{prikazDokumenta.data.kupac_naziv}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                                    <p className="text-[10px] text-slate-500 uppercase font-black">Datum</p>
                                    <p className="text-white font-bold">{formatirajDatum(prikazDokumenta.data.datum)}</p>
                                </div>
                                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                                    <p className="text-[10px] text-slate-500 uppercase font-black">Status</p>
                                    <p className={`font-black uppercase ${prikazDokumenta.data.status.includes('NAPLAĆENO') || prikazDokumenta.data.status.includes('POTVRĐ') ? 'text-emerald-400' : 'text-red-400'}`}>{prikazDokumenta.data.status}</p>
                                </div>
                            </div>

                            {prikazDokumenta.data.stavke_jsonb && (
                                <div className="mt-4">
                                    <p className="text-[10px] text-slate-400 uppercase font-black mb-2">Stavke na dokumentu:</p>
                                    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-800 text-slate-400">
                                                <tr><th className="p-3">Šifra i Proizvod</th><th className="p-3 text-center">Količina</th><th className="p-3 text-right">Ukupno</th></tr>
                                            </thead>
                                            <tbody className="text-white">
                                                {prikazDokumenta.data.stavke_jsonb.map((s,i) => (
                                                    <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/50">
                                                        <td className="p-3 font-bold">{s.sifra} <span className="text-slate-400 font-normal ml-1 block mt-1">{s.naziv}</span></td>
                                                        <td className="p-3 text-center text-blue-400 font-bold">{s.kolicina_obracun} {s.jm_obracun}</td>
                                                        <td className="p-3 text-right font-black text-emerald-400">{s.ukupno?.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <div className="bg-emerald-900/20 p-4 rounded-xl border border-emerald-500/30 text-center mt-4">
                                <p className="text-[10px] text-emerald-400 uppercase font-black">Ukupno za naplatu</p>
                                <p className="text-3xl text-white font-black">{prikazDokumenta.data.ukupno_sa_pdv} {prikazDokumenta.data.valuta || 'KM'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {tab === 'analitika' || tab === 'pregled' ? (
                <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-emerald-500" user={user} hideMasina={true} modulIme="blagajna" />
            ) : (
                <div className="flex justify-between items-center bg-[#1e293b] p-4 rounded-3xl border border-emerald-500/30 shadow-lg">
                    <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase hover:bg-slate-700">← Meni</button>
                    <h2 className="text-emerald-400 font-black tracking-widest uppercase text-xs">💵 BLAGAJNA I FINANSIJE</h2>
                </div>
            )}

            <div className="flex bg-[#1e293b] p-1 rounded-2xl border border-slate-700">
                <button onClick={() => setTab('unos')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'unos' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500'}`}>➕ Unos u Kasu</button>
                <button onClick={() => setTab('pregled')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'pregled' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500'}`}>📋 Dnevnik Kase</button>
                <button onClick={() => setTab('analitika')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all ${tab === 'analitika' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500'}`}>📊 Analiza Troškova</button>
            </div>

            {tab === 'unos' && (
                <div className="space-y-6 max-w-4xl mx-auto animate-in slide-in-from-left">
                    <div className="bg-slate-900 border border-blue-500/50 p-6 rounded-3xl flex gap-3 items-center shadow-2xl relative">
                        <div className="text-2xl">📷</div>
                        <div className="flex-1 relative">
                            <label className="text-[10px] text-blue-400 uppercase font-black block mb-1">Brzi sken (Učitaj PONUDU, RN ili RAČUN za naplatu)</label>
                            <input value={skener} onChange={handleSkenUnos} onFocus={() => setShowSkenerDrop(true)} placeholder="Skeniraj ili ukucaj broj..." className="w-full p-4 bg-[#0f172a] rounded-xl text-sm text-white outline-none border border-blue-500 focus:border-blue-400 uppercase font-black tracking-widest shadow-inner" />
                            
                            {showSkenerDrop && skener && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden z-50 max-h-60 overflow-y-auto text-left">
                                    {sviDokumenti
                                        .filter(d => d.id.includes(skener) || (d.kupac && d.kupac.toUpperCase().includes(skener)))
                                        .map(p => (
                                        <div key={p.id} onClick={() => {
                                            setSkener(p.id); setShowSkenerDrop(false);
                                            if (kucanjeTimer) clearTimeout(kucanjeTimer);
                                            izvrsiSkeniranje(p.id);
                                        }} className="p-3 border-b border-slate-700 hover:bg-slate-700 cursor-pointer flex justify-between items-center transition-all">
                                            <div><span className="text-white font-black">{p.id}</span> <span className="text-[10px] text-emerald-400 ml-2 uppercase font-bold">{p.tip}</span></div>
                                            <div className="text-slate-400 text-xs font-bold">{p.kupac}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {skenDetalji && (
                        <div className="bg-slate-900 border-2 border-emerald-500/50 p-6 rounded-3xl shadow-2xl animate-in zoom-in-95">
                            <div className="flex justify-between items-start border-b border-slate-700 pb-3 mb-4">
                                <div>
                                    <h3 className="text-emerald-400 font-black text-sm uppercase">Pronađen finansijski trag</h3>
                                    <p className="text-white text-lg font-black mt-1">{skenDetalji.kupac}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-slate-400 text-[10px] uppercase">Glavna Veza</p>
                                    <p className="text-blue-400 font-bold">{skenDetalji.glavna_veza}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="bg-slate-800 p-3 rounded-xl"><p className="text-[9px] text-slate-400 uppercase">Ukupno</p><p className="text-white font-black">{skenDetalji.ukupno} KM</p></div>
                                <div className="bg-emerald-900/30 border border-emerald-500/30 p-3 rounded-xl"><p className="text-[9px] text-emerald-400 uppercase">Već Uplaćeno</p><p className="text-emerald-400 font-black">{skenDetalji.placeno} KM</p></div>
                                <div className="bg-red-900/30 border border-red-500/30 p-3 rounded-xl shadow-inner"><p className="text-[9px] text-red-400 uppercase">Preostali Dug</p><p className="text-red-400 font-black text-xl">{skenDetalji.preostalo} KM</p></div>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-4">
                        <button onClick={() => handleTipChange('ULAZ')} className={`flex-1 py-6 rounded-[2rem] text-xl font-black uppercase transition-all border-4 ${form.tip === 'ULAZ' ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-slate-900 border-slate-800 text-slate-600 hover:border-emerald-900'}`}>+ ULAZ NOVCA</button>
                        <button onClick={() => handleTipChange('IZLAZ')} className={`flex-1 py-6 rounded-[2rem] text-xl font-black uppercase transition-all border-4 ${form.tip === 'IZLAZ' ? 'bg-red-900/30 border-red-500 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-slate-900 border-slate-800 text-slate-600 hover:border-red-900'}`}>- IZLAZ NOVCA</button>
                    </div>

                    <div className={`bg-[#1e293b] p-8 rounded-[2.5rem] border-2 shadow-2xl space-y-6 ${form.tip === 'ULAZ' ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-slate-500 uppercase ml-2 block mb-1">Kategorija Transakcije</label>
                                <select value={form.kategorija} onChange={e=>setForm({...form, kategorija:e.target.value})} className="w-full p-4 bg-[#0f172a] rounded-xl text-sm text-white outline-none border border-slate-700 font-bold">
                                    {kategorije.filter(k=>k.tip===form.tip).map(k => <option key={k.id} value={k.naziv}>{k.naziv}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 uppercase ml-2 block mb-1">Iznos (KM)</label>
                                <input type="number" value={form.iznos} onChange={e=>setForm({...form, iznos:e.target.value})} placeholder="0.00" className={`w-full p-4 bg-[#0f172a] rounded-xl text-2xl font-black text-center outline-none border-2 shadow-inner ${form.tip === 'ULAZ' ? 'border-emerald-500/50 text-emerald-400 focus:border-emerald-400' : 'border-red-500/50 text-red-400 focus:border-red-400'}`} />
                            </div>
                        </div>

                        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
                            {(form.kategorija.toLowerCase().includes('račun') || form.kategorija.toLowerCase().includes('ponud') || form.kategorija.toLowerCase().includes('avans')) && (
                                <div className="relative">
                                    <label className="text-[10px] text-emerald-400 uppercase font-black ml-2 block mb-1">Vezni Dokument (Kucaj ako unosiš ručno bez skenera na vrhu)</label>
                                    <input 
                                        value={form.racun_id} 
                                        onChange={(e) => {
                                            const val = e.target.value.toUpperCase(); setForm({...form, racun_id: val}); setShowSkenerDrop(true);
                                            if (kucanjeTimer) clearTimeout(kucanjeTimer);
                                            if (val) { setKucanjeTimer(setTimeout(() => { setShowSkenerDrop(false); izvrsiSkeniranje(val); }, 2000)); }
                                        }} 
                                        onFocus={() => setShowSkenerDrop(true)} placeholder="npr. RAC-123" 
                                        className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-emerald-500 focus:border-emerald-400 uppercase font-black shadow-inner" 
                                    />
                                    
                                    {showSkenerDrop && form.racun_id && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden z-50 max-h-60 overflow-y-auto text-left">
                                            {sviDokumenti.filter(d => (d.tip === 'Račun' || d.tip === 'Ponuda') && (d.id.includes(form.racun_id) || (d.kupac && d.kupac.toUpperCase().includes(form.racun_id)))).map(p => (
                                                <div key={p.id} onClick={() => { setForm({...form, racun_id: p.id}); setShowSkenerDrop(false); if (kucanjeTimer) clearTimeout(kucanjeTimer); izvrsiSkeniranje(p.id); }} className="p-3 border-b border-slate-700 hover:bg-slate-700 cursor-pointer flex justify-between items-center transition-all">
                                                    <div><span className="text-white font-black">{p.id}</span> <span className="text-[10px] text-emerald-400 ml-2 uppercase font-bold">{p.tip}</span></div>
                                                    <div className="text-slate-400 text-xs font-bold">{p.kupac}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {form.kategorija.toLowerCase().includes('mašin') && (
                                <div>
                                    <label className="text-[10px] text-amber-500 uppercase font-black ml-2 block mb-1">Za koju mašinu se plaća?</label>
                                    <select value={form.masina_naziv} onChange={e=>setForm({...form, masina_naziv:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700">
                                        <option value="">-- Odaberi mašinu --</option>{masine.map(m => <option key={m.naziv} value={m.naziv}>{m.naziv}</option>)}
                                    </select>
                                </div>
                            )}

                            {form.kategorija.toLowerCase().includes('radnic') && (
                                <div>
                                    <label className="text-[10px] text-blue-400 uppercase font-black ml-2 block mb-1">Za kojeg radnika je isplata?</label>
                                    <select value={form.radnik_ime} onChange={e=>setForm({...form, radnik_ime:e.target.value})} className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700">
                                        <option value="">-- Odaberi radnika --</option>{radnici.map(r => <option key={r.ime_prezime} value={r.ime_prezime}>{r.ime_prezime}</option>)}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="text-[10px] text-slate-500 uppercase ml-2 block mb-1">Svrha / Detaljan opis</label>
                                <textarea value={form.opis} onChange={e=>setForm({...form, opis:e.target.value})} placeholder="Upiši detalje..." className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700" rows="2"></textarea>
                            </div>
                        </div>

                        <button onClick={snimiTransakciju} className={`w-full py-5 text-white font-black rounded-2xl uppercase text-sm shadow-xl transition-all ${form.tip === 'ULAZ' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}>✅ Proknjiži i Štampaj</button>
                    </div>
                </div>
            )}

            {tab === 'pregled' && (
                <div className="space-y-6 animate-in slide-in-from-right">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 text-center"><p className="text-[10px] text-slate-500 uppercase font-black mb-1">Ulaz u periodu</p><p className="text-2xl text-emerald-400 font-black">{periodUlaz.toFixed(2)}</p></div>
                        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 text-center"><p className="text-[10px] text-slate-500 uppercase font-black mb-1">Izlaz u periodu</p><p className="text-2xl text-red-400 font-black">{periodIzlaz.toFixed(2)}</p></div>
                        <div className="bg-slate-900 p-6 rounded-3xl border border-blue-500/30 text-center"><p className="text-[10px] text-blue-400 uppercase font-black mb-1">Promet u periodu</p><p className="text-2xl text-white font-black">{periodPromet.toFixed(2)}</p></div>
                        <div className="bg-blue-900/20 p-6 rounded-3xl border border-blue-500 text-center"><p className="text-[10px] text-blue-400 uppercase font-black mb-1">STVARNO STANJE KASE</p><p className="text-3xl text-white font-black">{apsolutnoStanjeKase.toFixed(2)} <span className="text-xs">KM</span></p></div>
                    </div>

                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl">
                        <div className="flex flex-wrap justify-between items-end mb-6 gap-4">
                            <h3 className="text-slate-400 font-black uppercase text-[10px]">Knjiga Blagajne za: <span className="text-white text-sm bg-slate-800 px-3 py-1 rounded ml-2">{formatirajDatum(aktivniDatum)}</span></h3>
                            <div className="flex gap-2">
                                <select onChange={(e) => setHeader({...header, blagajnaFilterKat: e.target.value})} className="bg-slate-900 text-xs text-white p-3 rounded-xl border border-slate-700 outline-none">
                                    <option value="SVE">Sve Kategorije</option>
                                    {kategorije.map(k => <option key={k.id} value={k.naziv}>{k.naziv}</option>)}
                                </select>
                                <input type="text" onChange={(e) => setHeader({...header, blagajnaPretraga: e.target.value})} placeholder="Pretraži opis..." className="bg-slate-900 text-xs text-white p-3 rounded-xl border border-slate-700 outline-none w-48" />
                            </div>
                        </div>

                        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                            {prikazaneTransakcije.length === 0 && <p className="text-center text-slate-500 py-10 font-bold">Nema transakcija za odabrani datum.</p>}
                            {prikazaneTransakcije
                                .filter(t => (header?.blagajnaFilterKat && header.blagajnaFilterKat !== 'SVE') ? t.kategorija === header.blagajnaFilterKat : true)
                                .filter(t => (header?.blagajnaPretraga) ? (t.opis || '').toLowerCase().includes(header.blagajnaPretraga.toLowerCase()) || (t.racun_id || '').toLowerCase().includes(header.blagajnaPretraga.toLowerCase()) : true)
                                .map(t => (
                                <div key={t.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex justify-between items-center hover:border-slate-600 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl border-4 shadow-lg shrink-0 ${t.tip === 'ULAZ' ? 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30' : 'bg-red-900/40 text-red-400 border-red-500/30'}`}>
                                            {t.tip === 'ULAZ' ? '+' : '-'}
                                        </div>
                                        <div>
                                            <p className="text-white text-xs font-black uppercase">{t.kategorija}</p>
                                            <p className="text-[10px] text-slate-400 mt-1">{t.opis || 'Nema opisa'}</p>
                                            <div className="flex flex-wrap gap-2 mt-2 items-center">
                                                <span className="text-[8px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-bold">{formatirajDatum(t.datum)} {t.vrijeme_tekst}</span>
                                                <span className="text-[8px] bg-blue-900/30 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-bold">👤 {t.snimio_korisnik}</span>
                                                {t.racun_id && (
                                                    <span onClick={() => otvoriDokument(t.racun_id)} className="cursor-pointer hover:bg-emerald-800 text-[8px] bg-emerald-900/30 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold transition-all shadow-md">
                                                        📄 Prikaži {t.racun_id}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className={`text-xl font-black font-mono ${t.tip === 'ULAZ' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {t.tip === 'ULAZ' ? '+' : '-'}{t.iznos.toFixed(2)}
                                            </p>
                                            <button onClick={() => printPotvrda(t)} className="text-[8px] uppercase font-black text-slate-500 hover:text-white mt-1">🖨️ Print Potvrdu</button>
                                        </div>
                                        <button onClick={() => obrisiTransakciju(t)} className="text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 p-2 rounded-xl transition-all">✕</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {tab === 'analitika' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-right">
                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-emerald-500/30 shadow-2xl">
                        <h3 className="text-emerald-500 font-black uppercase text-xs mb-4">📥 Struktura Ulaza na dan: {formatirajDatum(aktivniDatum)}</h3>
                        <div className="space-y-3">
                            {unikatneKatUlaz.length === 0 && <p className="text-slate-500 text-xs">Nema ulaznih transakcija za odabrani dan.</p>}
                            {unikatneKatUlaz.map(katNaziv => {
                                const suma = prikazaneTransakcije.filter(t => t.tip === 'ULAZ' && t.kategorija === katNaziv).reduce((a, t) => a + parseFloat(t.iznos), 0);
                                if (suma === 0) return null;
                                return (
                                    <div key={katNaziv} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                                        <span className="text-white text-sm font-bold">{katNaziv}</span>
                                        <span className="text-emerald-400 font-black font-mono">+ {suma.toFixed(2)} KM</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-red-500/30 shadow-2xl">
                        <h3 className="text-red-500 font-black uppercase text-xs mb-4">📤 Struktura Izlaza na dan: {formatirajDatum(aktivniDatum)}</h3>
                        <div className="space-y-3">
                            {unikatneKatIzlaz.length === 0 && <p className="text-slate-500 text-xs">Nema izlaznih transakcija za odabrani dan.</p>}
                            {unikatneKatIzlaz.map(katNaziv => {
                                const suma = prikazaneTransakcije.filter(t => t.tip === 'IZLAZ' && t.kategorija === katNaziv).reduce((a, t) => a + parseFloat(t.iznos), 0);
                                if (suma === 0) return null;
                                return (
                                    <div key={katNaziv} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                                        <span className="text-white text-sm font-bold">{katNaziv}</span>
                                        <span className="text-red-400 font-black font-mono">- {suma.toFixed(2)} KM</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-amber-500/30 shadow-2xl">
                        <h3 className="text-amber-500 font-black uppercase text-xs mb-4">⚙️ Troškovi Mašina na dan: {formatirajDatum(aktivniDatum)}</h3>
                        <div className="space-y-3">
                            {masine.map(m => {
                                const trosakMasine = prikazaneTransakcije.filter(t => t.masina_naziv === m.naziv).reduce((a, t) => a + parseFloat(t.iznos), 0);
                                if (trosakMasine === 0) return null;
                                return (
                                    <div key={m.naziv} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                                        <span className="text-white text-sm font-bold">{m.naziv}</span><span className="text-red-400 font-black font-mono">- {trosakMasine.toFixed(2)} KM</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-blue-500/30 shadow-2xl">
                        <h3 className="text-blue-400 font-black uppercase text-xs mb-4">👷 Isplate Radnicima na dan: {formatirajDatum(aktivniDatum)}</h3>
                        <div className="space-y-3">
                            {radnici.map(r => {
                                const radnikIsplate = prikazaneTransakcije.filter(t => t.radnik_ime === r.ime_prezime).reduce((a, t) => a + parseFloat(t.iznos), 0);
                                if (radnikIsplate === 0) return null;
                                return (
                                    <div key={r.ime_prezime} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                                        <span className="text-white text-sm font-bold">{r.ime_prezime}</span><span className="text-blue-400 font-black font-mono">{radnikIsplate.toFixed(2)} KM</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}