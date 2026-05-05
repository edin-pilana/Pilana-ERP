"use client";
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import SearchableInput from '../components/SearchableInput';
import ScannerOverlay from '../components/ScannerOverlay';
import { printDokument } from '../utils/printHelpers';
import { useSaaS } from '../utils/useSaaS';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// POMOĆNA KOMPONENTA ZA PRETRAGU PROIZVODA
// ==========================================
function OTP_SearchableProizvod({ katalog, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value);
    useEffect(() => { setSearch(value); }, [value]);

    const filtered = katalog.filter(k => k.sifra.toUpperCase().includes(search.toUpperCase()) || k.naziv.toUpperCase().includes(search.toUpperCase()));

    return (
        <div className="relative font-black w-full">
            <input value={search} onFocus={() => setOpen(true)} onChange={e => { setSearch(e.target.value); setOpen(true); }} placeholder="Pronađi šifru ili naziv..." className="w-full p-4 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none focus:border-orange-500 shadow-inner" />
            {open && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-theme-panel border border-theme-border rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    {filtered.map(k => {
                        const tekstZaPolje = `${k.sifra} | ${k.naziv} | Dim: ${k.visina}x${k.sirina}x${k.duzina}`;
                        return (
                            <div key={k.sifra} onClick={() => { onChange(k.sifra, tekstZaPolje); setSearch(tekstZaPolje); setOpen(false); }} className="p-3 border-b border-theme-border hover:bg-theme-card cursor-pointer transition-all">
                                <div className="text-theme-text text-xs font-black">{k.sifra} <span className="text-orange-300 ml-1">{k.naziv}</span></div>
                                <div className="text-[9px] text-slate-400 mt-1 uppercase">Kat: {k.kategorija} | Dim: {k.visina}x{k.sirina}x{k.duzina}</div>
                            </div>
                        )
                    })}
                    <div onClick={() => setOpen(false)} className="p-2 text-center text-[8px] text-slate-500 cursor-pointer hover:text-theme-text bg-theme-card sticky bottom-0">Zatvori</div>
                </div>
            )}
        </div>
    );
}

// ==========================================
// GLAVNI MODUL
// ==========================================
export default function OtpremniceModule({ user, header, setHeader, onExit }) {
    const currentUser = user?.ime_prezime ? user : JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');
    const [tab, setTab] = useState('nova'); 

    const saas = useSaaS('otpremnice_zaglavlje', {
        boja_kartice: '#1e293b',
        polja: [
            { id: 'veza', label: 'Vezni Dokument (Istorija)', span: 'col-span-2' },
            { id: 'broj', label: 'BROJ OTPREMNICE', span: 'col-span-2' },
            { id: 'kupac', label: '* KUPAC (Za koga isporučujemo)', span: 'col-span-2' },
            { id: 'datum', label: 'Datum isporuke', span: 'col-span-1' },
            { id: 'status', label: 'Status', span: 'col-span-1' },
            { id: 'vozac', label: 'Ime i Prezime Vozača', span: 'col-span-2' },
            { id: 'registracija', label: 'Registracija Vozila', span: 'col-span-2' }
        ]
    });

    const aktivnaPolja = saas.ui.polja?.length > 0 ? saas.ui.polja : saas.defaultConfig.polja;
    const dragItem = useRef(null); const dragOverItem = useRef(null);
    const handleDragStart = (e, index) => { dragItem.current = index; };
    const handleDragEnter = (e, index) => { dragOverItem.current = index; };
    const handleDrop = () => {
        if(dragItem.current === null || dragOverItem.current === null) return;
        const novaLista = [...aktivnaPolja];
        const premjesteniItem = novaLista[dragItem.current];
        novaLista.splice(dragItem.current, 1);
        novaLista.splice(dragOverItem.current, 0, premjesteniItem);
        dragItem.current = null; dragOverItem.current = null;
        saas.setUi({...saas.ui, polja: novaLista});
    };
    const updatePolje = (index, key, val) => { const novaLista = [...aktivnaPolja]; novaLista[index][key] = val; saas.setUi({...saas.ui, polja: novaLista}); };
    const toggleVelicinaPolja = (index) => { const novaLista = [...aktivnaPolja]; const trenutno = novaLista[index].span; novaLista[index].span = trenutno === 'col-span-1' ? 'col-span-2' : (trenutno === 'col-span-2' ? 'col-span-4' : 'col-span-1'); saas.setUi({...saas.ui, polja: novaLista}); };
    const spremiDimenzije = (e, index) => { if (!saas.isEditMode) return; const w = e.currentTarget.style.width; const h = e.currentTarget.style.height; if (w || h) { const novaLista = [...aktivnaPolja]; if (w) novaLista[index].customWidth = w; if (h) novaLista[index].customHeight = h; saas.setUi({...saas.ui, polja: novaLista}); } };

    const [kupci, setKupci] = useState([]);
    const [katalog, setKatalog] = useState([]);
    const [otpremnice, setOtpremnice] = useState([]);
    const [izdatnice, setIzdatnice] = useState([]); 

    const generisiID = () => `OTP-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;

    const [form, setForm] = useState({ id: generisiID(), broj_veze: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0], vozac: '', registracija: '', napomena: '', status: 'KREIRANA' });
    const [stavke, setStavke] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    
    const [dostupniDokumenti, setDostupniDokumenti] = useState([]);
    const [prikaziDrop, setPrikaziDrop] = useState(false);
    const [kucanjeTimer, setKucanjeTimer] = useState(null);
    const [isScanningOverlay, setIsScanningOverlay] = useState(false);
    
    const [stavkaForm, setStavkaForm] = useState({ id: null, sifra_unos: '', kolicina_obracun: '', jm_obracun: 'm3' });
    const [trenutniProizvod, setTrenutniProizvod] = useState(null);
    const [skenerInput, setSkenerInput] = useState('');

    // --- STATE ZA WMS IZDATNICE ---
    const [wmsIzdatnica, setWmsIzdatnica] = useState(null); // Čuva aktivnu izdatnicu koja se obrađuje
    const [wmsStavke, setWmsStavke] = useState([]); // Čuva stavke aktivne izdatnice za izmjenu
    const [wmsNovaSifra, setWmsNovaSifra] = useState(''); // Za dodavanje na terenu
    const [wmsNovaKol, setWmsNovaKol] = useState('');

    useEffect(() => { load(); }, []);

    const load = async () => {
        const {data: k} = await supabase.from('kupci').select('*').order('naziv'); setKupci(k||[]);
        const {data: cat} = await supabase.from('katalog_proizvoda').select('*').order('sifra'); setKatalog(cat||[]);
        const {data: otp} = await supabase.from('otpremnice').select('*').order('datum', { ascending: false }); setOtpremnice(otp||[]);
        const {data: izd} = await supabase.from('izdatnice').select('*').order('created_at', { ascending: false }); setIzdatnice(izd||[]);

        const { data: rn } = await supabase.from('radni_nalozi').select('id, kupac_naziv, status').neq('status', 'ZAVRŠENO');
        const { data: pon } = await supabase.from('ponude').select('id, kupac_naziv, status').in('status', ['POTVRĐENA', 'REALIZOVANA ✅']);
        const { data: izdDrop } = await supabase.from('izdatnice').select('broj_izdatnice, kupac_naziv, status').eq('status', 'utovareno');

        setDostupniDokumenti([
            ...(rn || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Radni Nalog', status: d.status })),
            ...(pon || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Ponuda', status: d.status })),
            ...(izdDrop || []).map(d => ({ id: d.broj_izdatnice, kupac: d.kupac_naziv, tip: 'Izdatnica', status: d.status }))
        ]);
    };

    const zapisiU_Log = async (akcija, detalji) => { await supabase.from('sistem_audit_log').insert([{ korisnik: currentUser.ime_prezime || 'Nepoznat', akcija, detalji }]); };

    const skenirajVezu = async (e, forcedVal = null) => {
        if (e?.key === 'Enter' || e?.type === 'click' || forcedVal) {
            const broj = (forcedVal || skenerInput).toUpperCase().trim();
            if(!broj) return;
            let dokument = null; let prepravljeneStavke = [];

            if (broj.startsWith('PON-')) {
                const { data: ponuda } = await supabase.from('ponude').select('*').eq('id', broj).maybeSingle();
                if(!ponuda) return alert(`❌ Ponuda ${broj} nije pronađena!`);
                dokument = ponuda;
                prepravljeneStavke = (dokument.stavke_jsonb || []).map(s => ({ id: Math.random().toString(), sifra: s.sifra, naziv: s.naziv, kolicina_obracun: s.kolicina_obracun, jm_obracun: s.jm_obracun }));
            } 
            else if (broj.startsWith('RN-')) {
                const { data: nalog } = await supabase.from('radni_nalozi').select('*').eq('id', broj).maybeSingle();
                if(!nalog) return alert(`❌ Radni nalog ${broj} nije pronađen!`);
                if (nalog.status !== 'ZAVRŠENO' && nalog.status !== 'ISPORUČENO') { setSkenerInput(''); return alert(`⛔ STOP: Radni nalog ${broj} je u statusu "${nalog.status}".\nNe možete isporučiti robu dok se proizvodnja ne označi kao ZAVRŠENO!`); }
                dokument = nalog;
                prepravljeneStavke = (dokument.stavke_jsonb || []).map(s => ({ id: Math.random().toString(), sifra: s.sifra, naziv: s.naziv, kolicina_obracun: s.kolicina_obracun, jm_obracun: s.jm_obracun }));
            } 
            else if (broj.startsWith('IZD-')) {
                const { data: izdatnica } = await supabase.from('izdatnice').select('*').eq('broj_izdatnice', broj).maybeSingle();
                if(!izdatnica) return alert(`❌ Izdatnica ${broj} nije pronađena!`);
                if (izdatnica.status !== 'utovareno') { setSkenerInput(''); return alert(`⚠️ PAŽNJA: Izdatnica ${broj} je u statusu "${izdatnica.status}".\nSačekajte da skladište potvrdi utovar prije kreiranja Otpremnice!`); }
                const { data: izdStavke } = await supabase.from('izdatnice_stavke').select('*').eq('izdatnica_id', izdatnica.id);
                dokument = izdatnica;
                prepravljeneStavke = (izdStavke || []).map(s => ({ id: Math.random().toString(), sifra: s.proizvod_sifra, naziv: s.proizvod_naziv, kolicina_obracun: s.izdata_kolicina > 0 ? s.izdata_kolicina : s.planirana_kolicina, jm_obracun: s.mjerna_jedinica }));
            } 
            else { return alert("❌ Nepoznat format! Mora početi sa PON-, RN- ili IZD-"); }

            setForm({ ...form, kupac_naziv: dokument.kupac_naziv, broj_veze: broj, napomena: dokument.napomena || '' });
            setStavke(prepravljeneStavke); setSkenerInput(''); alert(`✅ Uspješno preuzeti podaci iz: ${broj}`);
        }
    };

    const handleSkenUnos = (e) => {
        const val = e.target.value.toUpperCase(); setSkenerInput(val); setPrikaziDrop(true); 
        if (kucanjeTimer) clearTimeout(kucanjeTimer);
        if (val) { setKucanjeTimer(setTimeout(() => { setPrikaziDrop(false); skenirajVezu(null, val); }, 2000)); }
    };
    const odaberiIzDropdowna = (id) => { setSkenerInput(id); setPrikaziDrop(false); if (kucanjeTimer) clearTimeout(kucanjeTimer); skenirajVezu(null, id); };

    const handleProizvodSelect = (sifraVal, tekstZaPolje) => {
        const nadjeni = katalog.find(k => k.sifra === sifraVal); setTrenutniProizvod(nadjeni || null);
        if (nadjeni) setStavkaForm({ ...stavkaForm, id: null, sifra_unos: tekstZaPolje, jm_obracun: nadjeni.default_jedinica || 'm3' });
    };

    const dodajStavku = () => {
        if(!trenutniProizvod || !stavkaForm.kolicina_obracun) return alert("Odaberite proizvod i unesite količinu!");
        const novaStavka = { id: stavkaForm.id || Math.random().toString(), sifra: trenutniProizvod.sifra, naziv: trenutniProizvod.naziv, kolicina_obracun: parseFloat(stavkaForm.kolicina_obracun), jm_obracun: stavkaForm.jm_obracun };
        if (stavkaForm.id) setStavke(stavke.map(s => s.id === stavkaForm.id ? novaStavka : s)); else setStavke([...stavke, novaStavka]);
        setStavkaForm({ id: null, sifra_unos: '', kolicina_obracun: '', jm_obracun: 'm3' }); setTrenutniProizvod(null);
    };

    const urediStavku = (stavka) => {
        const nadjeni = katalog.find(k => k.sifra === stavka.sifra); setTrenutniProizvod(nadjeni || null);
        const tekstZaPolje = nadjeni ? `${nadjeni.sifra} | ${nadjeni.naziv}` : stavka.sifra;
        setStavkaForm({ id: stavka.id, sifra_unos: tekstZaPolje, kolicina_obracun: stavka.kolicina_obracun, jm_obracun: stavka.jm_obracun });
    };

    const ukloniStavku = (id) => setStavke(stavke.filter(s => s.id !== id));
    const formatirajDatum = (isoString) => { if(!isoString) return ''; const [y, m, d] = isoString.split('T')[0].split('-'); return `${d}.${m}.${y}.`; };

    // ==========================================
    // FUNKCIJE ZA IZDATNICU I PRINT (NOVI DIZAJN)
    // ==========================================
    const stampajIzdatnicu = async (izdId, kupacNaziv, izvorId, datumIzd, napomena, stavkeZaPrint) => {
        const odabraniKupac = kupci.find(k => k.naziv === kupacNaziv) || null;
        
        let redovi = stavkeZaPrint.map((s, i) => {
            const kat = katalog.find(k => k.sifra === (s.proizvod_sifra || s.sifra));
            const dimenzije = kat ? `${kat.visina}x${kat.sirina}x${kat.duzina}` : 'N/A';
            return `
            <tr>
                <td style="font-weight: bold; color: #64748b; text-align: center; font-size:16px;">${i+1}.</td>
                <td style="padding: 10px 5px;">
                    <b style="color: #0f172a; font-size: 18px;">${s.proizvod_sifra || s.sifra}</b><br/>
                    <span style="color: #475569; font-size: 14px;">${s.proizvod_naziv || s.naziv}</span><br/>
                    <span style="color: #dc2626; font-size: 16px; font-weight: 900; display: inline-block; margin-top: 4px; border: 1px solid #fca5a5; background-color: #fef2f2; padding: 2px 8px; border-radius: 4px;">DIM: ${dimenzije}</span>
                </td>
                <td style="text-align: center; font-size: 22px; font-weight: 900; color: #f59e0b; background-color:#fffbeb;">${s.planirana_kolicina || s.kolicina_obracun} <span style="color: #64748b; font-size: 14px; font-weight: 600;">${s.mjerna_jedinica || s.jm_obracun}</span></td>
                <td style="text-align: center; font-size: 14px; font-weight: bold; color: #cbd5e1; border-left: 2px dashed #cbd5e1; vertical-align: middle;">________________</td>
            </tr>
        `}).join('');

        const htmlSadrzajTabela = `
            <div class="info-grid" style="margin-bottom: 30px; border-bottom: 2px solid #f59e0b; padding-bottom: 20px;">
                <div class="info-col">
                    <h4 style="color:#f59e0b; font-size: 14px; margin-bottom:10px; letter-spacing:1px;">NALOG ZA UTOVAR</h4>
                    <p style="font-size: 16px; font-weight: 900; margin-bottom: 5px; color:#0f172a;">Kupac: <span style="font-size: 20px;">${kupacNaziv}</span></p>
                    <p style="font-size: 12px; font-weight: 400; color: #475569;">Adresa: ${odabraniKupac?.adresa || 'N/A'}</p>
                </div>
                <div class="info-col" style="text-align: right;">
                    <p style="font-size: 12px; margin-bottom:5px;">Izvor naloga: <span style="font-weight: 600; color: #0f172a;">${izvorId || 'RUČNI UNOS'}</span></p>
                    <p style="font-size: 12px;">Status: <span style="font-weight: 900; color: #f59e0b; padding: 4px 8px; background-color: #fffbeb; border-radius: 4px;">ČEKA UTOVAR</span></p>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                        <th style="width: 5%; text-align: center; padding: 10px;">R.B.</th>
                        <th style="text-align: left; padding: 10px; font-size: 12px;">ŠIFRA, NAZIV I DIMENZIJA</th>
                        <th style="text-align:center; padding: 10px; font-size: 12px; background-color:#fef3c7;">PLANIRANO</th>
                        <th style="text-align:center; width:25%; padding: 10px; font-size: 12px;">STVARNO UTOVARENO</th>
                    </tr>
                </thead>
                <tbody>${redovi}</tbody>
            </table>
            
            <div style="margin-top: 40px; padding: 15px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 8px;">
                <b style="color: #0f172a; font-size:12px;">Napomena / Instrukcija za viljuškaristu:</b><br/>
                <span style="font-size: 12px; color: #475569;">${napomena || 'Pažljivo provjeriti količine i pakete prilikom utovara.'}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-top: 100px; text-align: center; color: #0f172a; font-weight: 600;">
                <div style="width: 35%;"><div style="border-bottom: 1px solid #94a3b8; margin-bottom: 10px; height: 20px;"></div>Odgovorno lice (Prodaja)</div>
                <div style="width: 35%;"><div style="border-bottom: 1px solid #94a3b8; margin-bottom: 10px; height: 20px;"></div>Potpisuje radnik (Skladište)</div>
            </div>
        `;
        printDokument('IZDATNICA', izdId, formatirajDatum(datumIzd), htmlSadrzajTabela, '#f59e0b');
    };

    const kreirajIzdatnicu = async () => {
        if(!form.kupac_naziv) return alert("Kupac je obavezan!");
        if(stavke.length === 0) return alert("Izdatnica mora imati stavke!");
        const brojIzd = `IZD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const { data: izdData, error: izdErr } = await supabase.from('izdatnice').insert([{ broj_izdatnice: brojIzd, kupac_naziv: form.kupac_naziv, status: 'u_pripremi', izvor_tip: form.broj_veze ? (form.broj_veze.startsWith('PON') ? 'ponuda' : 'radni_nalog') : 'rucno', izvor_id: form.broj_veze, napomena: form.napomena, kreirao_korisnik: currentUser.ime_prezime || 'Nepoznat' }]).select().single();
        if(izdErr) return alert("Greška pri kreiranju izdatnice: " + izdErr.message);

        const stavkePayload = stavke.map(s => ({ izdatnica_id: izdData.id, proizvod_sifra: s.sifra, proizvod_naziv: s.naziv, planirana_kolicina: s.kolicina_obracun, mjerna_jedinica: s.jm_obracun }));
        const { error: stavkeErr } = await supabase.from('izdatnice_stavke').insert(stavkePayload);
        if(stavkeErr) return alert("Greška kod stavki: " + stavkeErr.message);

        stampajIzdatnicu(brojIzd, form.kupac_naziv, form.broj_veze, new Date().toISOString(), form.napomena, stavkePayload);
        resetFormu(); load(); setTab('izdatnice');
    };

    const printIzdatnicaFromList = async (e, izd) => {
        e.stopPropagation();
        const { data: st } = await supabase.from('izdatnice_stavke').select('*').eq('izdatnica_id', izd.id);
        if(st) stampajIzdatnicu(izd.broj_izdatnice, izd.kupac_naziv, izd.izvor_id, izd.datum, izd.napomena, st); else alert("Nije moguće učitati stavke.");
    };

    // ==========================================
    // LOGIKA ZA WMS UTOVAR (FULL SCREEN PROZOR)
    // ==========================================
    const otvoriWmsUtovar = async (izd) => {
        const { data } = await supabase.from('izdatnice_stavke').select('*').eq('izdatnica_id', izd.id);
        const pripremljeneStavke = (data || []).map(s => ({
            ...s, 
            izdata_kolicina: parseFloat(s.izdata_kolicina) > 0 ? s.izdata_kolicina : s.planirana_kolicina 
        }));
        setWmsIzdatnica(izd);
        setWmsStavke(pripremljeneStavke);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const zatvoriWmsUtovar = () => { setWmsIzdatnica(null); setWmsStavke([]); };

    const handleWmsKolicina = (id, val) => {
        setWmsStavke(wmsStavke.map(s => s.id === id ? { ...s, izdata_kolicina: val } : s));
    };

    const dodajWmsStavkuNovu = () => {
        const katItem = katalog.find(k => k.sifra === wmsNovaSifra.split(' |')[0].trim());
        if(!katItem || !wmsNovaKol) return alert("Odaberite proizvod i količinu!");
        
        const novaStavka = {
            id: `novo_${Date.now()}`,
            izdatnica_id: wmsIzdatnica.id,
            proizvod_sifra: katItem.sifra,
            proizvod_naziv: katItem.naziv,
            planirana_kolicina: 0, 
            izdata_kolicina: parseFloat(wmsNovaKol),
            mjerna_jedinica: katItem.default_jedinica || 'm3'
        };
        setWmsStavke([...wmsStavke, novaStavka]);
        setWmsNovaSifra(''); setWmsNovaKol('');
    };

    const obrisiWmsStavku = (id) => { setWmsStavke(wmsStavke.filter(s => s.id !== id)); };

    const zavrsiIPotvrdiUtovar = async () => {
        if(!window.confirm("Da li ste sigurni da želite potvrditi količine i završiti utovar?")) return;
        
        const zaInsert = [];
        const zaUpdate = [];
        
        wmsStavke.forEach(s => {
            const payload = {
                izdatnica_id: wmsIzdatnica.id, proizvod_sifra: s.proizvod_sifra, proizvod_naziv: s.proizvod_naziv,
                planirana_kolicina: s.planirana_kolicina || 0, izdata_kolicina: parseFloat(s.izdata_kolicina) || 0, mjerna_jedinica: s.mjerna_jedinica
            };
            if(String(s.id).startsWith('novo_')) zaInsert.push(payload);
            else zaUpdate.push({ ...payload, id: s.id });
        });

        if(zaInsert.length > 0) await supabase.from('izdatnice_stavke').insert(zaInsert);
        if(zaUpdate.length > 0) await supabase.from('izdatnice_stavke').upsert(zaUpdate);

        await supabase.from('izdatnice').update({ status: 'utovareno' }).eq('id', wmsIzdatnica.id);
        await zapisiU_Log('UTOVAR_ZAVRSEN', `Nalog ${wmsIzdatnica.broj_izdatnice} potvrdio: ${currentUser.ime_prezime}`);
        
        alert("✅ UTOVAR POTVRĐEN! Spreman za fakturisanje.");
        zatvoriWmsUtovar(); load();
    };

    // ==========================================
    // KLASIČNE OTPREMNICE (KREIRANJE IZ KANCELARIJE)
    // ==========================================
    const snimiOtpremnicu = async () => {
        if(!form.kupac_naziv) return alert("Kupac je obavezan!");
        if(stavke.length === 0) return alert("Otpremnica mora imati stavke!");
        const payload = { id: form.id.toUpperCase(), broj_veze: form.broj_veze, kupac_naziv: form.kupac_naziv, datum: form.datum, vozac: form.vozac, registracija: form.registracija, napomena: form.napomena, stavke_jsonb: stavke, status: form.status, snimio_korisnik: currentUser.ime_prezime };
        if (isEditing) {
            const { error } = await supabase.from('otpremnice').update(payload).eq('id', form.id);
            if(error) return alert("Greška: " + error.message); await zapisiU_Log('IZMJENA_OTPREMNICE', `Ažurirana otpremnica ${form.id}`); alert("✅ Otpremnica uspješno ažurirana!");
        } else {
            const { error } = await supabase.from('otpremnice').insert([payload]);
            if(error) return alert("Greška pri snimanju: " + error.message); await zapisiU_Log('KREIRANA_OTPREMNICA', `Otpremnica ${form.id} za ${form.kupac_naziv}`); alert("✅ Otpremnica uspješno kreirana!");
        }
        resetFormu(); load(); setTab('lista');
    };

    const resetFormu = () => { setForm({ id: generisiID(), broj_veze: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0], vozac: '', registracija: '', napomena: '', status: 'KREIRANA' }); setStavke([]); setSkenerInput(''); setIsEditing(false); };

    const kreirajPDF = () => {
        const odabraniKupac = kupci.find(k => k.naziv === form.kupac_naziv) || null;
        let redovi = stavke.map((s, i) => `<tr><td style="font-weight: bold; color: #64748b; text-align: center;">${i+1}.</td><td><b style="color: #0f172a; font-size: 14px;">${s.sifra}</b><br/><span style="color: #64748b; font-size: 11px;">${s.naziv}</span></td><td style="text-align: center; font-size: 18px; font-weight: 900; color: #f97316;">${s.kolicina_obracun} <span style="color: #64748b; font-size: 12px; font-weight: 600;">${s.jm_obracun}</span></td></tr>`).join('');
        const htmlSadrzajTabela = `<div class="info-grid"><div class="info-col"><h4>Kupac / Primalac robe</h4><p style="font-size: 18px; font-weight: 900; margin-bottom: 5px;">${form.kupac_naziv}</p><p style="font-weight: 400; color: #475569;">${odabraniKupac?.adresa || ''}</p><p style="font-weight: 600; color: #0f172a; font-size: 12px; margin-top: 6px;">PDV / ID: ${odabraniKupac?.pdv_broj || 'N/A'}</p></div><div class="info-col" style="text-align: right;"><h4>Detalji Transporta</h4><p>Vezni Dokument: <span style="font-weight: 600; color: #0f172a;">${form.broj_veze || '-'}</span></p><p>Ime Vozača: <span style="font-weight: 600; color: #0f172a;">${form.vozac || '-'}</span></p><p>Vozilo (Reg): <span style="font-weight: 900; color: #f97316;">${form.registracija || '-'}</span></p></div></div><table><thead><tr><th style="width: 5%; text-align: center;">R.B.</th><th>Šifra i Naziv Proizvoda</th><th style="text-align:center;">Isporučena Količina</th></tr></thead><tbody>${redovi}</tbody></table><div style="display: flex; justify-content: space-between; margin-top: 100px; text-align: center; color: #0f172a; font-weight: 600;"><div style="width: 25%;"><div style="border-bottom: 1px solid #94a3b8; margin-bottom: 10px; height: 20px;"></div>Isporučio (Vozač)</div><div style="width: 25%;"><div style="border-bottom: 1px solid #94a3b8; margin-bottom: 10px; height: 20px;"></div>Izdao (Magacin)</div><div style="width: 25%;"><div style="border-bottom: 1px solid #94a3b8; margin-bottom: 10px; height: 20px;"></div>Primio (Kupac)</div></div><div class="footer"><div style="width: 100%;"><b style="color: #0f172a;">Napomena uz isporuku:</b><br/>${form.napomena || 'Roba isporučena bez oštećenja.'}</div></div>`;
        printDokument('OTPREMNICA', form.id, formatirajDatum(form.datum), htmlSadrzajTabela, '#f97316');
    };

    const pokreniIzmjenu = (o) => {
        setForm({ id: o.id, broj_veze: o.broj_veze || '', kupac_naziv: o.kupac_naziv, datum: o.datum, vozac: o.vozac || '', registracija: o.registracija || '', napomena: o.napomena || '', status: o.status || 'KREIRANA' });
        setStavke(o.stavke_jsonb || []); setIsEditing(true); setTab('nova'); window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const renderPoljeHeader = (polje) => {
        if (polje.id === 'veza') return <input value={form.broj_veze} onChange={e=>setForm({...form, broj_veze:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-theme-card rounded-xl text-theme-text outline-none border border-theme-border uppercase focus:border-orange-500" placeholder="Nema veznog dokumenta" />;
        if (polje.id === 'broj') return <input value={form.id} disabled className="w-full h-full min-h-[45px] p-4 bg-theme-panel rounded-xl text-theme-text border border-theme-border font-black disabled:opacity-50" />;
        if (polje.id === 'kupac') return <div className="h-full min-h-[45px]"><SearchableInput value={form.kupac_naziv} onChange={v=>setForm({...form, kupac_naziv:v})} list={kupci.map(k=>k.naziv)} /></div>;
        if (polje.id === 'datum') return <input type="date" value={form.datum} onChange={e=>setForm({...form, datum:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none" />;
        if (polje.id === 'status') return <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-theme-panel rounded-xl text-theme-accent font-black border border-orange-500/50 outline-none uppercase"><option value="KREIRANA">Kreirana</option><option value="ISPORUČENO">Isporučeno</option></select>;
        if (polje.id === 'vozac') return <input value={form.vozac} onChange={e=>setForm({...form, vozac:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-theme-panel rounded-xl text-theme-text border border-theme-border outline-none focus:border-orange-500" placeholder="npr. Marko Marković" />;
        if (polje.id === 'registracija') return <input value={form.registracija} onChange={e=>setForm({...form, registracija:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-theme-panel rounded-xl text-theme-text border border-theme-border outline-none uppercase focus:border-orange-500" placeholder="npr. A12-B-345" />;
        return null;
    };

    // ==========================================
    // RENDERI TABOVA
    // ==========================================
    const renderTabIzdatnice = () => {
        if (wmsIzdatnica) {
            return (
                <div className="bg-theme-card p-8 rounded-box border border-amber-500/50 shadow-2xl animate-in zoom-in-95">
                    <div className="flex justify-between items-start border-b border-theme-border pb-6 mb-6">
                        <div>
                            <button onClick={zatvoriWmsUtovar} className="text-slate-400 font-black uppercase text-[10px] hover:text-white bg-slate-800 px-4 py-2 rounded-lg mb-4">← Nazad na listu</button>
                            <h2 className="text-3xl text-amber-500 font-black">{wmsIzdatnica.broj_izdatnice}</h2>
                            <p className="text-theme-text text-sm font-bold uppercase tracking-widest mt-1">Kupac: <span className="text-amber-400">{wmsIzdatnica.kupac_naziv}</span></p>
                        </div>
                        <div className="text-right">
                            <span className="bg-amber-900/40 text-amber-500 px-4 py-2 rounded-xl text-xs font-black uppercase border border-amber-500/40">Status: Utovar u toku</span>
                            <p className="text-[10px] text-slate-500 uppercase font-black mt-3">Datum: {formatirajDatum(wmsIzdatnica.datum)}</p>
                        </div>
                    </div>

                    <div className="space-y-4 mb-8">
                        {wmsStavke.map((s, i) => {
                            const kat = katalog.find(k => k.sifra === s.proizvod_sifra);
                            return (
                                <div key={s.id} className="bg-theme-panel p-5 rounded-2xl border border-theme-border flex flex-col md:flex-row justify-between items-center gap-4">
                                    <div className="flex-1">
                                        <p className="text-theme-text font-black text-lg uppercase">{s.proizvod_sifra}</p>
                                        <p className="text-slate-400 text-xs font-bold">{s.proizvod_naziv}</p>
                                        <p className="text-[10px] text-red-400 font-black mt-2 bg-red-900/20 inline-block px-2 py-1 rounded border border-red-500/30">DIM: {kat ? `${kat.visina}x${kat.sirina}x${kat.duzina}` : 'N/A'}</p>
                                    </div>
                                    <div className="flex items-center gap-6 bg-black/40 p-4 rounded-xl border border-slate-700">
                                        <div className="text-center">
                                            <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Planirano (Nalog)</p>
                                            <p className="text-slate-300 font-black text-xl">{s.planirana_kolicina} <span className="text-xs">{s.mjerna_jedinica}</span></p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[9px] text-amber-500 uppercase font-black mb-1">Utovareno (Stvarno)</p>
                                            <input type="number" value={s.izdata_kolicina} onChange={(e) => handleWmsKolicina(s.id, e.target.value)} className="w-24 p-3 bg-amber-900/30 border border-amber-500 rounded-xl text-amber-400 font-black text-xl text-center outline-none" />
                                        </div>
                                        <button onClick={() => obrisiWmsStavku(s.id)} className="text-red-500 hover:bg-red-500/20 p-3 rounded-xl transition-all font-black ml-2">✕</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="bg-blue-900/10 p-6 rounded-2xl border border-blue-500/30 mb-8">
                        <h4 className="text-[10px] text-blue-400 uppercase font-black mb-4">➕ Dodatni utovar (Kupac uzeo još nešta)</h4>
                        <div className="flex gap-4 items-end">
                            <div className="flex-1"><OTP_SearchableProizvod katalog={katalog} value={wmsNovaSifra} onChange={(val, txt) => setWmsNovaSifra(txt)} /></div>
                            <input type="number" value={wmsNovaKol} onChange={e=>setWmsNovaKol(e.target.value)} placeholder="Kol..." className="w-24 p-4 bg-theme-card rounded-xl text-theme-text font-black text-center border border-theme-border outline-none focus:border-blue-500" />
                            <button onClick={dodajWmsStavkuNovu} className="bg-blue-600 text-white px-6 py-4 rounded-xl font-black uppercase text-xs hover:bg-blue-500 transition-all">Dodaj stavku</button>
                        </div>
                    </div>

                    <button onClick={zavrsiIPotvrdiUtovar} className="w-full py-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-lg uppercase shadow-[0_0_20px_rgba(16,185,129,0.5)] tracking-widest transition-all">
                        ✅ ZAVRŠI I POTVRDI UTOVAR
                    </button>
                </div>
            );
        }

        return (
            <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-theme-border shadow-2xl animate-in slide-in-from-bottom">
                <div className="flex justify-between items-center mb-6 border-b border-theme-border pb-4">
                    <h3 className="text-theme-accent font-black uppercase text-xs tracking-widest">📋 Aktivni Nalozi za Utovar (WMS Izdatnice)</h3>
                    <div className="flex gap-2">
                        <span className="bg-amber-900/30 text-amber-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase border border-amber-500/30">Utovar u toku</span>
                        <span className="bg-emerald-900/30 text-emerald-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase border border-emerald-500/30">Spremno za kasu</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {izdatnice.map(izd => (
                        <div key={izd.id} onClick={() => otvoriWmsUtovar(izd)} className="bg-theme-panel border border-theme-border p-5 rounded-2xl shadow-xl hover:border-amber-500 transition-all group cursor-pointer relative overflow-hidden">
                            <div className="flex justify-between items-start mb-4 border-b border-slate-700 pb-3">
                                <div><p className="text-theme-accent font-black text-lg">{izd.broj_izdatnice}</p><p className="text-theme-text text-xs font-bold uppercase mt-1">{izd.kupac_naziv}</p></div>
                                <span className={`text-[9px] px-2 py-1 rounded font-black uppercase border ${izd.status === 'u_pripremi' ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' : izd.status === 'na_utovaru' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>{izd.status.replace('_', ' ')}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-slate-400 font-black uppercase mb-4">
                                <span>Izvor: <span className="text-theme-text">{izd.izvor_id || 'RUČNO'}</span></span><span>{formatirajDatum(izd.datum)}</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={(e) => printIzdatnicaFromList(e, izd)} className="flex-1 bg-theme-card py-3 rounded-xl text-[10px] font-black uppercase border border-slate-600 hover:bg-white hover:text-black transition-all shadow-md">🖨️ Štampaj Nalog</button>
                                {izd.status === 'utovareno' && <button onClick={(e) => { e.stopPropagation(); setSkenerInput(izd.broj_izdatnice); setTab('nova'); setTimeout(()=>skenirajVezu(null, izd.broj_izdatnice), 500); }} className="flex-1 bg-emerald-600 py-3 rounded-xl text-[10px] font-black uppercase text-white hover:bg-emerald-500 transition-all shadow-md">📑 Napravi Otpremnicu</button>}
                            </div>
                        </div>
                    ))}
                    {izdatnice.length === 0 && <p className="col-span-full text-center text-slate-500 py-10 font-bold italic">Nema aktivnih izdatnica.</p>}
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 font-bold animate-in fade-in pb-20">
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-orange-500" user={user} modulIme="otpremnice" saas={saas} />

            <div className="flex bg-theme-panel p-1.5 rounded-2xl border border-theme-border shadow-inner">
                <button onClick={() => {setTab('nova'); if(!isEditing) resetFormu();}} className={`flex-1 py-3 rounded-xl text-[10px] uppercase font-black transition-all ${tab === 'nova' ? 'bg-orange-600 text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-theme-text'}`}>
                    {isEditing ? '✏️ Izmjena' : '➕ Nova Otpremnica / Nalog'}
                </button>
                <button onClick={() => setTab('izdatnice')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase font-black transition-all ${tab === 'izdatnice' ? 'bg-amber-600 text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-theme-text'}`}>
                    🚚 Izdatnice (WMS Nalozi)
                </button>
                <button onClick={() => setTab('lista')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase font-black transition-all ${tab === 'lista' ? 'bg-emerald-600 text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-theme-text'}`}>
                    📋 Arhiva Otpremnica
                </button>
            </div>

            {tab === 'nova' ? (
                <div className="space-y-4 animate-in slide-in-from-left max-w-4xl mx-auto">
                    {!isEditing && (
                        <div className="bg-theme-card border border-orange-500/50 p-6 rounded-box shadow-2xl relative z-[60]">
                            <label className="text-[10px] text-theme-accent uppercase font-black block mb-2 ml-2">Pametni unos (Skeniraj Nalog za utovar, Ponudu ili Radni Nalog)</label>
                            <div className="flex bg-theme-panel border-2 border-orange-500 rounded-xl overflow-visible focus-within:border-orange-400 transition-all shadow-inner">
                                <input value={skenerInput} onChange={handleSkenUnos} onFocus={() => setPrikaziDrop(true)} placeholder="Skeniraj ili ukucaj broj..." className="flex-1 p-4 bg-transparent text-sm text-theme-text outline-none uppercase font-black tracking-widest relative z-10" />
                                <button onClick={() => setIsScanningOverlay(true)} className="px-6 bg-theme-card border-b border-theme-border text-theme-text text-xl hover:opacity-80 transition-all border-l border-orange-500/50 relative z-10">📷</button>
                                {prikaziDrop && skenerInput && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-theme-panel border border-slate-600 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden z-[100] max-h-60 overflow-y-auto text-left">
                                        {dostupniDokumenti.filter(d => d.id.includes(skenerInput) || (d.kupac && d.kupac.toUpperCase().includes(skenerInput))).length === 0 && <div className="p-3 text-xs text-slate-500 text-center">Nema rezultata...</div>}
                                        {dostupniDokumenti.filter(d => d.id.includes(skenerInput) || (d.kupac && d.kupac.toUpperCase().includes(skenerInput))).map(p => (
                                            <div key={p.id} onClick={() => odaberiIzDropdowna(p.id)} className="p-3 border-b border-theme-border hover:bg-theme-card cursor-pointer flex justify-between items-center transition-colors">
                                                <div><span className="text-theme-text font-black">{p.id}</span> <span className="text-[10px] text-orange-300 ml-2 uppercase font-bold">{p.tip}</span></div>
                                                <div className="text-slate-300 text-[10px] font-bold">{p.kupac} | <span className={p.status === 'ZAVRŠENO' || p.status === 'utovareno' ? 'text-emerald-400' : 'text-amber-400'}>{p.status}</span></div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className={`p-6 rounded-box border-2 shadow-2xl space-y-4 transition-all relative z-[40] ${saas.isEditMode ? 'border-dashed border-amber-500 bg-black/20' : 'border-orange-500/30 bg-theme-card backdrop-blur-[var(--glass-blur)]'}`} >
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-theme-accent font-black uppercase text-xs">1. Parametri Otpremnice / Izdatnice</h3>
                            {isEditing && <button onClick={resetFormu} className="text-[10px] bg-red-900/30 text-red-400 px-3 py-1 rounded-xl uppercase hover:bg-red-900/50 transition-all">Odustani od izmjena ✕</button>}
                        </div>
                        {saas.isEditMode && (<div className="bg-black/40 p-3 rounded-xl flex flex-wrap gap-4 items-center mb-4 border border-amber-500/30"><label className="text-[10px] text-amber-500 uppercase font-black flex items-center gap-2">Boja Pozadine: <input type="color" value={saas.ui.boja_kartice || '#1e293b'} onChange={e => saas.setUi({...saas.ui, boja_kartice: e.target.value})} className="w-8 h-8 cursor-pointer rounded border-none bg-transparent" /></label></div>)}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border-b border-theme-border pb-4 items-start">
                            {aktivnaPolja.map((polje, index) => (
                                <div key={polje.id} className={`relative flex flex-col ${polje.span} transition-all ${saas.isEditMode ? 'border-2 border-dashed border-amber-500 p-2 rounded-xl bg-black/20 resize overflow-auto' : ''}`} style={{ maxWidth: '100%', ...(saas.isEditMode ? { minWidth: '100px', minHeight: '80px' } : {}), width: polje.customWidth || undefined, height: polje.customHeight || undefined }} draggable={saas.isEditMode} onDragStart={(e) => handleDragStart(e, index)} onDragEnter={(e) => handleDragEnter(e, index)} onDragEnd={handleDrop} onDragOver={(e) => e.preventDefault()} onMouseUp={(e) => spremiDimenzije(e, index)}>
                                    {saas.isEditMode && (<div className="flex justify-between items-center mb-2 shrink-0"><span className="text-[9px] text-amber-500 uppercase font-black cursor-move">☰</span><button onClick={() => toggleVelicinaPolja(index)} className="text-[8px] text-amber-500 font-black bg-amber-500/20 px-2 py-1 rounded">ŠIRINA: {polje.span==='col-span-4'?'100%':polje.span==='col-span-2'?'50%':'25%'}</button></div>)}
                                    {saas.isEditMode ? (<input value={polje.label} onChange={(e) => updatePolje(index, 'label', e.target.value)} className="w-full bg-theme-card text-amber-400 p-1 mb-1 rounded border border-amber-500/50 text-[8px] uppercase font-black text-center shrink-0" placeholder="Naslov polja" />) : (polje.label && <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1 shrink-0">{polje.label}</label>)}
                                    <div className={`flex-1 ${saas.isEditMode ? 'opacity-50 pointer-events-none' : ''}`}>{renderPoljeHeader(polje)}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-theme-card p-6 rounded-box border border-theme-border space-y-4 shadow-xl relative z-[30]">
                        <h3 className="text-theme-accent uppercase text-xs">2. Dodaj stavke</h3>
                        <div className="relative mb-3"><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Pronađi proizvod</label><OTP_SearchableProizvod katalog={katalog} value={stavkaForm.sifra_unos} onChange={handleProizvodSelect} /></div>
                        {trenutniProizvod && (
                            <div className="p-4 bg-blue-900/10 border border-blue-500/30 rounded-2xl animate-in zoom-in-95 space-y-4 shadow-inner">
                                <div className="border-b border-theme-border pb-3"><p className="text-theme-text text-sm font-black">{trenutniProizvod.sifra} - {trenutniProizvod.naziv}</p><p className="text-[10px] text-slate-400 mt-1">Dimenzije: <span className="text-theme-text">{trenutniProizvod.visina}x{trenutniProizvod.sirina}x{trenutniProizvod.duzina}</span></p></div>
                                <div className="flex gap-4">
                                    <div className="flex-1"><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Količina za isporuku</label><input type="number" value={stavkaForm.kolicina_obracun} onChange={e=>setStavkaForm({...stavkaForm, kolicina_obracun:e.target.value})} placeholder="0.00" className="w-full p-4 bg-black rounded-xl text-lg text-theme-text font-black text-center outline-none border border-theme-border focus:border-blue-500" /></div>
                                    <div className="w-32"><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Jedinica</label><select value={stavkaForm.jm_obracun} onChange={e=>setStavkaForm({...stavkaForm, jm_obracun:e.target.value})} className="w-full p-4 bg-theme-panel rounded-xl text-sm text-theme-text font-black outline-none border border-theme-border uppercase"><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option><option value="kom">kom</option></select></div>
                                </div>
                                <button onClick={dodajStavku} className={`w-full py-4 text-theme-text font-black rounded-xl text-xs shadow-lg uppercase mt-2 transition-all ${stavkaForm.id ? 'bg-amber-600 hover:bg-amber-500' : 'bg-theme-accent hover:opacity-80'}`}>{stavkaForm.id ? '✅ Ažuriraj ovu stavku' : '➕ Dodaj na otpremnicu'}</button>
                            </div>
                        )}
                    </div>

                    {stavke.length > 0 && (
                        <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-orange-500/30 shadow-2xl animate-in slide-in-from-bottom">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-theme-accent font-black uppercase text-xs">3. Pregled Dokumenta</h3>
                            </div>
                            <div className="space-y-3 mb-6">
                                {stavke.map((s, i) => (
                                    <div key={s.id} onClick={() => urediStavku(s)} className="flex justify-between items-center p-4 bg-theme-card border border-theme-border rounded-xl cursor-pointer hover:border-orange-500 transition-all group shadow-md">
                                        <div className="flex items-center gap-4"><span className="text-slate-500 text-sm font-black">{i+1}.</span><div><p className="text-theme-text text-sm font-black">{s.naziv}</p><p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest">{s.sifra}</p></div></div>
                                        <div className="flex items-center gap-6 text-right"><p className="text-orange-500 font-black text-xl">{s.kolicina_obracun} <span className="text-xs text-slate-400">{s.jm_obracun}</span></p><button onClick={(e)=>{e.stopPropagation(); ukloniStavku(s.id);}} className="text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 p-2 rounded-lg transition-all font-black">✕</button></div>
                                    </div>
                                ))}
                            </div>
                            <textarea value={form.napomena} onChange={e=>setForm({...form, napomena:e.target.value})} placeholder="Napomena na isporuci (opciono)..." className="w-full mt-4 p-4 bg-theme-card border border-theme-border rounded-xl text-xs text-theme-text outline-none focus:border-orange-500 shadow-inner" rows="3"></textarea>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                <button onClick={kreirajIzdatnicu} className="w-full py-5 bg-amber-600 text-white font-black rounded-2xl uppercase shadow-[0_0_20px_rgba(245,158,11,0.5)] hover:bg-amber-500 transition-all text-[11px] tracking-widest flex items-center justify-center gap-2">
                                    <span className="text-lg">📦</span> POŠALJI NALOG ZA UTOVAR (IZDATNICA)
                                </button>
                                <button onClick={snimiOtpremnicu} className={`w-full py-5 text-theme-text font-black rounded-2xl uppercase shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all text-[11px] tracking-widest flex items-center justify-center gap-2 ${isEditing ? 'bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.4)]' : 'bg-theme-card border border-theme-border hover:opacity-80'}`}>
                                    <span className="text-lg">🏁</span> {isEditing ? 'SNIMI IZMJENE OTPREMNICE' : 'KREIRAJ ZVANIČNU OTPREMNICU'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : tab === 'izdatnice' ? renderTabIzdatnice() : (
                <div className="bg-theme-card p-6 rounded-[2rem] border border-theme-border shadow-2xl animate-in slide-in-from-right">
                    <h3 className="text-slate-400 uppercase text-[10px] mb-6 tracking-widest">Arhiva izdatih otpremnica</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {otpremnice.map(o => (
                            <div key={o.id} onClick={() => pokreniIzmjenu(o)} className="p-5 bg-theme-panel border border-theme-border rounded-2xl hover:border-emerald-500 transition-all group cursor-pointer shadow-lg">
                                <div className="flex justify-between items-start border-b border-slate-700 pb-3 mb-3">
                                    <div><p className="text-emerald-500 font-black text-sm">{o.id}</p><p className="text-theme-text text-[10px] font-bold uppercase mt-1">{o.kupac_naziv}</p></div>
                                    <span className="text-[9px] text-slate-500 font-black">{formatirajDatum(o.datum)}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-slate-400 font-black uppercase">
                                    <span>Vozilo: {o.registracija || 'N/A'}</span>
                                    <span>Stavki: {o.stavke_jsonb?.length}</span>
                                    <button onClick={(e)=>{e.stopPropagation(); setForm(o); setStavke(o.stavke_jsonb||[]); setTimeout(kreirajPDF, 100);}} className="text-emerald-400 font-black px-2 py-1 rounded bg-emerald-900/30 hover:bg-emerald-500 hover:text-white transition-all">PDF</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {isScanningOverlay && <ScannerOverlay onScan={(text) => { skenirajVezu(null, text); setIsScanningOverlay(false); }} onClose={() => setIsScanningOverlay(false)} />}
        </div>
    );
}