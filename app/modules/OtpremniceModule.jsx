"use client";
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import MasterSearch from '../components/MasterSearch'; 
import PametniDialog from '../components/PametniDialog'; 
import ScannerOverlay from '../components/ScannerOverlay';
import { printDokument } from '../utils/printHelpers';
import { useSaaS } from '../utils/useSaaS';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function OtpremniceModule({ user, header, setHeader, onExit }) {
    const currentUser = user?.ime_prezime ? user : JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');
    const isSuperadmin = currentUser.uloga === 'superadmin' || currentUser.uloga === 'admin';
    const [tab, setTab] = useState('nova'); 

    const saas = useSaaS('otpremnice_zaglavlje', {
        boja_kartice: '#1e293b',
        polja: [
            { id: 'veza', label: 'Vezni Dokument (Istorija)', span: 'col-span-2' }, { id: 'broj', label: 'BROJ OTPREMNICE', span: 'col-span-2' },
            { id: 'kupac', label: '* KUPAC', span: 'col-span-2' }, { id: 'datum', label: 'Datum isporuke', span: 'col-span-1' },
            { id: 'status', label: 'Status', span: 'col-span-1' }, { id: 'vozac', label: 'Vozač', span: 'col-span-2' },
            { id: 'registracija', label: 'Vozilo', span: 'col-span-2' }
        ]
    });

    const aktivnaPolja = saas.ui.polja?.length > 0 ? saas.ui.polja : saas.defaultConfig.polja;
    const dragItem = useRef(null); const dragOverItem = useRef(null);
    const handleDragStart = (e, index) => { dragItem.current = index; }; const handleDragEnter = (e, index) => { dragOverItem.current = index; };
    const handleDrop = () => { if(dragItem.current === null || dragOverItem.current === null) return; const novaLista = [...aktivnaPolja]; const premjesteniItem = novaLista[dragItem.current]; novaLista.splice(dragItem.current, 1); novaLista.splice(dragOverItem.current, 0, premjesteniItem); dragItem.current = null; dragOverItem.current = null; saas.setUi({...saas.ui, polja: novaLista}); };
    const updatePolje = (index, key, val) => { const novaLista = [...aktivnaPolja]; novaLista[index][key] = val; saas.setUi({...saas.ui, polja: novaLista}); };
    const toggleVelicinaPolja = (index) => { const novaLista = [...aktivnaPolja]; const trenutno = novaLista[index].span; novaLista[index].span = trenutno === 'col-span-1' ? 'col-span-2' : (trenutno === 'col-span-2' ? 'col-span-4' : 'col-span-1'); saas.setUi({...saas.ui, polja: novaLista}); };
    const spremiDimenzije = (e, index) => { if (!saas.isEditMode) return; const w = e.currentTarget.style.width; const h = e.currentTarget.style.height; if (w || h) { const novaLista = [...aktivnaPolja]; if (w) novaLista[index].customWidth = w; if (h) novaLista[index].customHeight = h; saas.setUi({...saas.ui, polja: novaLista}); } };

    const [kupci, setKupci] = useState([]);
    const [katalog, setKatalog] = useState([]);
    const [otpremnice, setOtpremnice] = useState([]);
    const [izdatnice, setIzdatnice] = useState([]); 
    const [zahtjeviOdobrenja, setZahtjeviOdobrenja] = useState([]); 

    const generisiID = () => `OTP-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;

    const [form, setForm] = useState({ id: generisiID(), broj_veze: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0], vozac: '', registracija: '', napomena: '', status: 'KREIRANA' });
    const [stavke, setStavke] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    
    const [dostupniDokumenti, setDostupniDokumenti] = useState([]);
    const [isScanningOverlay, setIsScanningOverlay] = useState(false);
    
    // PAMETNI DIJALOG STATE
    const [dialog, setDialog] = useState({ isOpen: false });
    const prikaziDialog = (opcije) => setDialog({ isOpen: true, confirmText: 'POTVRDI', cancelText: 'ZATVORI', ...opcije });
    const zatvoriDialog = () => setDialog({ isOpen: false });

    const [stavkaForm, setStavkaForm] = useState({ id: null, sifra_unos: '', kolicina_obracun: '', jm_obracun: 'm3' });
    const [trenutniProizvod, setTrenutniProizvod] = useState(null);
    const [prosirenaIzdatnicaId, setProsirenaIzdatnicaId] = useState(null);
    const [ucitaneStavkeIzdatnice, setUcitaneStavkeIzdatnice] = useState([]);
    const [wmsIzdatnica, setWmsIzdatnica] = useState(null); 
    const [wmsStavke, setWmsStavke] = useState([]); 
    const [wmsNovaSifra, setWmsNovaSifra] = useState(''); 
    const [wmsNovaKol, setWmsNovaKol] = useState('');

    useEffect(() => { load(); }, []);
// 🟢 PREMIUM DEEP LINKING: Automatsko učitavanje robe sa lagera u novu otpremnicu
useEffect(() => {
    const autoId = localStorage.getItem('erp_auto_open_id');
    const autoAction = localStorage.getItem('erp_auto_action');
    if (autoId && autoAction === 'nova' && dostupniDokumenti.length > 0) {
        skenirajVezu(autoId);
        localStorage.removeItem('erp_auto_open_id');
        localStorage.removeItem('erp_auto_action');
    }
}, [dostupniDokumenti]);
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

        if (isSuperadmin) {
            const { data: zahtjevi } = await supabase.from('sistem_audit_log').select('*').eq('akcija', 'ZAHTJEV_IZMJENA_OTPREMNICE').order('vrijeme', { ascending: false });
            setZahtjeviOdobrenja(zahtjevi || []);
        }
    };

    const zapisiU_Log = async (akcija, detalji) => { await supabase.from('sistem_audit_log').insert([{ korisnik: currentUser.ime_prezime || 'Nepoznat', akcija, detalji }]); };

    const skenirajVezu = async (brojRaw) => {
        const broj = (brojRaw || '').toUpperCase().trim();
        if(!broj) return;
        
        // --- BLOKADA 1: Da li OTPREMNICA već postoji? ---
        const { data: postojeceOtpData } = await supabase.from('otpremnice').select('*').eq('broj_veze', broj).limit(1);
        if (postojeceOtpData && postojeceOtpData.length > 0) {
            const otp = postojeceOtpData[0];
            const { data: racun } = await supabase.from('racuni').select('id').eq('broj_veze', otp.id).limit(1);
            const hasRacun = racun && racun.length > 0;
            
            prikaziDialog({
                tip: 'upozorenje',
                naslov: 'Otpremnica već postoji!',
                poruka: `Za ovaj nalog je već izdata otpremnica ${otp.id}.\nŠta želite uraditi?`,
                confirmText: '🖨️ Isprintaj PDF Kopiju',
                cancelText: '✏️ Uredi',
                onConfirm: () => { setForm(otp); setStavke(otp.stavke_jsonb); setTimeout(() => kreirajPDFPrivremeni(otp), 300); zatvoriDialog(); },
                onCancel: () => {
                    if (hasRacun) prikaziDialog({ tip: 'greska', naslov: 'Zabranjeno', poruka: 'Za ovu otpremnicu je izdat račun. Mijenjanje nije dozvoljeno.', onCancel: zatvoriDialog });
                    else { pokreniIzmjenu(otp); zatvoriDialog(); }
                }
            });
            return;
        }

        // --- BLOKADA 2: Da li IZDATNICA već postoji ---
        if (broj.startsWith('PON-') || broj.startsWith('RN-')) {
            const { data: postojeceIzdData } = await supabase.from('izdatnice').select('*').eq('izvor_id', broj).limit(1);
            if (postojeceIzdData && postojeceIzdData.length > 0) {
                return prikaziDialog({ tip: 'greska', naslov: 'Zaustavite rad!', poruka: `Za ovaj dokument već postoji nalog za utovar (${postojeceIzdData[0].broj_izdatnice})!\nPrebacite se na tab "Izdatnice (WMS)" da ga završite.`, onCancel: zatvoriDialog });
            }
        }

        let dokument = null; let prepravljeneStavke = [];

        if (broj.startsWith('PON-')) {
            const { data: ponuda } = await supabase.from('ponude').select('*').eq('id', broj).maybeSingle();
            if(!ponuda) return prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: `Ponuda ${broj} nije pronađena!`, onCancel: zatvoriDialog });
            dokument = ponuda;
            prepravljeneStavke = (dokument.stavke_jsonb || []).map(s => ({ id: Math.random().toString(), sifra: s.sifra, naziv: s.naziv, kolicina_obracun: s.kolicina_obracun, jm_obracun: s.jm_obracun }));
        } 
        else if (broj.startsWith('RN-')) {
            const { data: nalog } = await supabase.from('radni_nalozi').select('*').eq('id', broj).maybeSingle();
            if(!nalog) return prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: `Radni nalog ${broj} nije pronađen!`, onCancel: zatvoriDialog });
            if (nalog.status !== 'ZAVRŠENO' && nalog.status !== 'ISPORUČENO') { 
                return prikaziDialog({ tip: 'greska', naslov: 'Nalog Nije Završen', poruka: `Radni nalog ${broj} je u statusu "${nalog.status}".\nNe možete isporučiti robu dok se proizvodnja ne označi kao ZAVRŠENO!`, onCancel: zatvoriDialog }); 
            }
            dokument = nalog;
            prepravljeneStavke = (dokument.stavke_jsonb || []).map(s => ({ id: Math.random().toString(), sifra: s.sifra, naziv: s.naziv, kolicina_obracun: s.kolicina_obracun, jm_obracun: s.jm_obracun }));
        } 
        else if (broj.startsWith('IZD-')) {
            const { data: izdatnica } = await supabase.from('izdatnice').select('*').eq('broj_izdatnice', broj).maybeSingle();
            if(!izdatnica) return prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: `Izdatnica ${broj} nije pronađena!`, onCancel: zatvoriDialog });
            if (izdatnica.status !== 'utovareno') { 
                return prikaziDialog({ tip: 'upozorenje', naslov: 'Utovar Nije Završen', poruka: `Izdatnica ${broj} je u statusu "${izdatnica.status}".\nSačekajte da skladište potvrdi utovar prije kreiranja Otpremnice!`, onCancel: zatvoriDialog }); 
            }
            const { data: izdStavke } = await supabase.from('izdatnice_stavke').select('*').eq('izdatnica_id', izdatnica.id);
            dokument = izdatnica;
            prepravljeneStavke = (izdStavke || []).map(s => ({ id: Math.random().toString(), sifra: s.proizvod_sifra, naziv: s.proizvod_naziv, kolicina_obracun: s.izdata_kolicina > 0 ? s.izdata_kolicina : s.planirana_kolicina, jm_obracun: s.mjerna_jedinica }));
        } 
        else { return prikaziDialog({ tip: 'greska', naslov: 'Nepoznat Format', poruka: "Format mora početi sa PON-, RN- ili IZD-", onCancel: zatvoriDialog }); }

        setForm({ ...form, kupac_naziv: dokument.kupac_naziv, broj_veze: broj, napomena: dokument.napomena || '' });
        setStavke(prepravljeneStavke); 
        prikaziDialog({ tip: 'uspjeh', naslov: 'Učitano', poruka: `✅ Uspješno preuzeti podaci iz: ${broj}`, onCancel: zatvoriDialog });
    };

    const dodajStavku = () => {
        if(!trenutniProizvod || !stavkaForm.kolicina_obracun) return prikaziDialog({ tip: 'upozorenje', naslov: 'Fale Podaci', poruka: "Odaberite proizvod i unesite količinu!", onCancel: zatvoriDialog });
        const novaStavka = { id: stavkaForm.id || Math.random().toString(), sifra: trenutniProizvod.sifra, naziv: trenutniProizvod.naziv, kolicina_obracun: parseFloat(stavkaForm.kolicina_obracun), jm_obracun: stavkaForm.jm_obracun };
        if (stavkaForm.id) setStavke(stavke.map(s => s.id === stavkaForm.id ? novaStavka : s)); else setStavke([...stavke, novaStavka]);
        setStavkaForm({ id: null, sifra_unos: '', kolicina_obracun: '', jm_obracun: 'm3' }); setTrenutniProizvod(null);
    };

    const urediStavku = (stavka) => {
        const nadjeni = katalog.find(k => k.sifra === stavka.sifra); setTrenutniProizvod(nadjeni || null);
        setStavkaForm({ id: stavka.id, sifra_unos: nadjeni ? nadjeni.naziv : stavka.sifra, kolicina_obracun: stavka.kolicina_obracun, jm_obracun: stavka.jm_obracun });
    };

    const ukloniStavku = (id) => setStavke(stavke.filter(s => s.id !== id));
    const formatirajDatum = (isoString) => { if(!isoString) return ''; const [y, m, d] = isoString.split('T')[0].split('-'); return `${d}.${m}.${y}.`; };

    const stampajIzdatnicu = async (izdId, kupacNaziv, izvorId, datumIzd, napomena, stavkeZaPrint) => {
        const odabraniKupac = kupci.find(k => k.naziv === kupacNaziv) || null;
        let redovi = stavkeZaPrint.map((s, i) => {
            const kat = katalog.find(k => k.sifra === (s.proizvod_sifra || s.sifra));
            const dimenzije = kat ? `${kat.visina}x${kat.sirina}x${kat.duzina}` : 'N/A';
            return `<tr><td style="font-weight: bold; color: #64748b; text-align: center; font-size:16px;">${i+1}.</td><td style="padding: 10px 5px;"><b style="color: #0f172a; font-size: 18px;">${s.proizvod_sifra || s.sifra}</b><br/><span style="color: #475569; font-size: 14px;">${s.proizvod_naziv || s.naziv}</span><br/><span style="color: #dc2626; font-size: 16px; font-weight: 900; display: inline-block; margin-top: 4px; border: 1px solid #fca5a5; background-color: #fef2f2; padding: 2px 8px; border-radius: 4px;">DIM: ${dimenzije}</span></td><td style="text-align: center; font-size: 22px; font-weight: 900; color: #f59e0b; background-color:#fffbeb;">${s.planirana_kolicina || s.kolicina_obracun} <span style="color: #64748b; font-size: 14px; font-weight: 600;">${s.mjerna_jedinica || s.jm_obracun}</span></td><td style="text-align: center; font-size: 14px; font-weight: bold; color: #cbd5e1; border-left: 2px dashed #cbd5e1; vertical-align: middle;">________________</td></tr>`
        }).join('');
        const htmlSadrzajTabela = `<div class="info-grid" style="margin-bottom: 30px; border-bottom: 2px solid #f59e0b; padding-bottom: 20px;"><div class="info-col"><h4 style="color:#f59e0b; font-size: 14px; margin-bottom:10px; letter-spacing:1px;">NALOG ZA UTOVAR</h4><p style="font-size: 16px; font-weight: 900; margin-bottom: 5px; color:#0f172a;">Kupac: <span style="font-size: 20px;">${kupacNaziv}</span></p><p style="font-size: 12px; font-weight: 400; color: #475569;">Adresa: ${odabraniKupac?.adresa || 'N/A'}</p></div><div class="info-col" style="text-align: right;"><p style="font-size: 12px; margin-bottom:5px;">Izvor naloga: <span style="font-weight: 600; color: #0f172a;">${izvorId || 'RUČNI UNOS'}</span></p><p style="font-size: 12px;">Status: <span style="font-weight: 900; color: #f59e0b; padding: 4px 8px; background-color: #fffbeb; border-radius: 4px;">ČEKA UTOVAR</span></p></div></div><div style="text-align: right; margin-top: -80px; margin-bottom: 20px;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${izdId}" alt="QR Kod" style="border: 2px solid #f8fafc; border-radius: 4px;" /></div><table style="width: 100%; border-collapse: collapse;"><thead><tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;"><th style="width: 5%; text-align: center; padding: 10px;">R.B.</th><th style="text-align: left; padding: 10px; font-size: 12px;">ŠIFRA I NAZIV PROIZVODA</th><th style="text-align:center; padding: 10px; font-size: 12px; background-color:#fef3c7;">PLANIRANO</th><th style="text-align:center; width:25%; padding: 10px; font-size: 12px;">STVARNO UTOVARENO</th></tr></thead><tbody>${redovi}</tbody></table><div style="margin-top: 40px; padding: 15px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 8px;"><b style="color: #0f172a; font-size:12px;">Napomena / Instrukcija za viljuškaristu:</b><br/><span style="font-size: 12px; color: #475569;">${napomena || 'Pažljivo provjeriti količine i pakete prilikom utovara.'}</span></div><div style="display: flex; justify-content: space-between; margin-top: 100px; text-align: center; color: #0f172a; font-weight: 600;"><div style="width: 35%;"><div style="border-bottom: 1px solid #94a3b8; margin-bottom: 10px; height: 20px;"></div>Odgovorno lice (Prodaja)</div><div style="width: 35%;"><div style="border-bottom: 1px solid #94a3b8; margin-bottom: 10px; height: 20px;"></div>Potpisuje radnik (Skladište)</div></div>`;
        printDokument('IZDATNICA', izdId, formatirajDatum(datumIzd), htmlSadrzajTabela, '#f59e0b');
    };

    const kreirajIzdatnicu = async () => {
        if(!form.kupac_naziv) return prikaziDialog({ tip: 'upozorenje', naslov: 'Kupac Obavezan', poruka: "Kupac je obavezan da biste poslali nalog za utovar!", onCancel: zatvoriDialog });
        if(stavke.length === 0) return prikaziDialog({ tip: 'upozorenje', naslov: 'Nema Stavki', poruka: "Izdatnica mora imati stavke!", onCancel: zatvoriDialog });
        
        const brojIzd = `IZD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const { data: izdData, error: izdErr } = await supabase.from('izdatnice').insert([{ broj_izdatnice: brojIzd, kupac_naziv: form.kupac_naziv, status: 'u_pripremi', izvor_tip: form.broj_veze ? (form.broj_veze.startsWith('PON') ? 'ponuda' : 'radni_nalog') : 'rucno', izvor_id: form.broj_veze, napomena: form.napomena, kreirao_korisnik: currentUser.ime_prezime || 'Nepoznat' }]).select().single();
        if(izdErr) return prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: "Greška pri kreiranju izdatnice: " + izdErr.message, onCancel: zatvoriDialog });
        
        const stavkePayload = stavke.map(s => ({ izdatnica_id: izdData.id, proizvod_sifra: s.sifra, proizvod_naziv: s.naziv, planirana_kolicina: s.kolicina_obracun, mjerna_jedinica: s.jm_obracun }));
        const { error: stavkeErr } = await supabase.from('izdatnice_stavke').insert(stavkePayload);
        if(stavkeErr) return prikaziDialog({ tip: 'greska', naslov: 'Greška kod stavki', poruka: stavkeErr.message, onCancel: zatvoriDialog });

        stampajIzdatnicu(brojIzd, form.kupac_naziv, form.broj_veze, new Date().toISOString(), form.napomena, stavkePayload);
        resetFormu(); load(); setTab('izdatnice');
    };

    const printIzdatnicaFromList = async (e, izd) => {
        e.stopPropagation();
        const { data: st } = await supabase.from('izdatnice_stavke').select('*').eq('izdatnica_id', izd.id);
        if(st) stampajIzdatnicu(izd.broj_izdatnice, izd.kupac_naziv, izd.izvor_id, izd.datum, izd.napomena, st); else prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: "Nije moguće učitati stavke izdatnice.", onCancel: zatvoriDialog });
    };

    const otvoriZatvoriIzdatnicu = async (izdId) => {
        if(prosirenaIzdatnicaId === izdId) { setProsirenaIzdatnicaId(null); setUcitaneStavkeIzdatnice([]); } 
        else { setProsirenaIzdatnicaId(izdId); const { data } = await supabase.from('izdatnice_stavke').select('*').eq('izdatnica_id', izdId); setUcitaneStavkeIzdatnice(data || []); }
    };

    const otvoriWmsUtovar = async (izd) => {
        const { data } = await supabase.from('izdatnice_stavke').select('*').eq('izdatnica_id', izd.id);
        const pripremljeneStavke = (data || []).map(s => ({ ...s, izdata_kolicina: parseFloat(s.izdata_kolicina) > 0 ? s.izdata_kolicina : s.planirana_kolicina }));
        setWmsIzdatnica(izd); setWmsStavke(pripremljeneStavke); window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const zatvoriWmsUtovar = () => { setWmsIzdatnica(null); setWmsStavke([]); };
    const handleWmsKolicina = (id, val) => { setWmsStavke(wmsStavke.map(s => s.id === id ? { ...s, izdata_kolicina: val } : s)); };
    
    const obrisiWmsStavku = (id) => { setWmsStavke(wmsStavke.filter(s => s.id !== id)); };

    const dodajWmsStavkuNovu = () => {
        if (!wmsNovaSifra || !wmsNovaKol) return;
        const [sifra, naziv] = wmsNovaSifra.split(' | ');
        const noviId = `novo_${Date.now()}`;
        setWmsStavke([...wmsStavke, { id: noviId, izdatnica_id: wmsIzdatnica.id, proizvod_sifra: sifra, proizvod_naziv: naziv, planirana_kolicina: 0, izdata_kolicina: parseFloat(wmsNovaKol), mjerna_jedinica: 'm3' }]);
        setWmsNovaSifra(''); setWmsNovaKol('');
    };

    const zavrsiIPotvrdiUtovar = async () => {
        prikaziDialog({
            tip: 'info',
            naslov: 'Potvrda Utovara',
            poruka: 'Da li ste sigurni da želite potvrditi unesene količine i završiti utovar?',
            onConfirm: async () => {
                const zaInsert = []; const zaUpdate = [];
                wmsStavke.forEach(s => {
                    const payload = { izdatnica_id: wmsIzdatnica.id, proizvod_sifra: s.proizvod_sifra, proizvod_naziv: s.proizvod_naziv, planirana_kolicina: s.planirana_kolicina || 0, izdata_kolicina: parseFloat(s.izdata_kolicina) || 0, mjerna_jedinica: s.mjerna_jedinica };
                    if(String(s.id).startsWith('novo_')) zaInsert.push(payload); else zaUpdate.push({ ...payload, id: s.id });
                });
                if(zaInsert.length > 0) await supabase.from('izdatnice_stavke').insert(zaInsert);
                if(zaUpdate.length > 0) await supabase.from('izdatnice_stavke').upsert(zaUpdate);
                await supabase.from('izdatnice').update({ status: 'utovareno' }).eq('id', wmsIzdatnica.id);
                await zapisiU_Log('UTOVAR_ZAVRSEN', `Nalog ${wmsIzdatnica.broj_izdatnice} potvrdio: ${currentUser.ime_prezime}`);
                
                zatvoriWmsUtovar(); load();
                prikaziDialog({ tip: 'uspjeh', naslov: 'Utovareno!', poruka: "✅ UTOVAR POTVRĐEN! Spreman za fakturisanje i otpremu.", onCancel: zatvoriDialog });
            },
            onCancel: zatvoriDialog
        });
    };

    const snimiOtpremnicu = async () => {
        if(!form.kupac_naziv) return prikaziDialog({ tip: 'upozorenje', naslov: 'Kupac Obavezan', poruka: "Morate odabrati kupca da biste snimili otpremnicu.", onCancel: zatvoriDialog });
        if(stavke.length === 0) return prikaziDialog({ tip: 'upozorenje', naslov: 'Nema stavki', poruka: "Otpremnica mora imati barem jednu stavku!", onCancel: zatvoriDialog });

        // --- BLOKADA DUPLIKATA PRI SNIMANJU ---
        if (!isEditing && form.broj_veze) {
            const { data: postojeceOtp } = await supabase.from('otpremnice').select('id').eq('broj_veze', form.broj_veze).maybeSingle();
            if (postojeceOtp) {
                return prikaziDialog({ tip: 'greska', naslov: 'Duplikat', poruka: `Za dokument ${form.broj_veze} je VEĆ KREIRANA OTPREMNICA (${postojeceOtp.id})! Nije dozvoljeno kreiranje duplih otpremnica.`, onCancel: zatvoriDialog });
            }
        }
        // ----------------------------------------------------------------------

        let needsApproval = false; let diffDetails = [];

        if (form.broj_veze && form.broj_veze.startsWith('IZD-')) {
            const { data: izd } = await supabase.from('izdatnice').select('id').eq('broj_izdatnice', form.broj_veze).maybeSingle();
            if (izd) {
                const { data: izdStavke } = await supabase.from('izdatnice_stavke').select('*').eq('izdatnica_id', izd.id);
                (izdStavke || []).forEach(og => {
                    const curr = stavke.find(s => s.sifra === og.proizvod_sifra);
                    const origKol = parseFloat(og.izdata_kolicina) > 0 ? parseFloat(og.izdata_kolicina) : parseFloat(og.planirana_kolicina);
                    if (!curr) { needsApproval = true; diffDetails.push(`Obrisana stavka: ${og.proizvod_sifra} (Bilo utovareno: ${origKol})`); } 
                    else if (parseFloat(curr.kolicina_obracun) < origKol) { needsApproval = true; diffDetails.push(`Smanjeno za ${og.proizvod_sifra}: sa ${origKol} na ${curr.kolicina_obracun}`); }
                });
            }
        }

        const finalStatus = needsApproval ? 'ČEKA ODOBRENJE' : form.status;
        const payload = { id: form.id.toUpperCase(), broj_veze: form.broj_veze, kupac_naziv: form.kupac_naziv, datum: form.datum, vozac: form.vozac, registracija: form.registracija, napomena: form.napomena, stavke_jsonb: stavke, status: finalStatus, snimio_korisnik: currentUser.ime_prezime };
        
        if (isEditing) {
            const { error } = await supabase.from('otpremnice').update(payload).eq('id', form.id);
            if(error) return prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: error.message, onCancel: zatvoriDialog }); 
            if(needsApproval) { 
                await zapisiU_Log('ZAHTJEV_IZMJENA_OTPREMNICE', `Korisnik traži smanjenje na otpremnici ${form.id}. Razlog: ${diffDetails.join(' | ')}`); 
            } else { 
                await zapisiU_Log('IZMJENA_OTPREMNICE', `Ažurirana otpremnica ${form.id}`); 
            }
        } else {
            const { error } = await supabase.from('otpremnice').insert([payload]);
            if(error) return prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: error.message, onCancel: zatvoriDialog }); 
            if(needsApproval) { 
                await zapisiU_Log('ZAHTJEV_IZMJENA_OTPREMNICE', `Korisnik traži kreiranje sa manjom količinom na OTP ${form.id}. Razlog: ${diffDetails.join(' | ')}`); 
            } else { 
                await zapisiU_Log('KREIRANA_OTPREMNICA', `Otpremnica ${form.id} za ${form.kupac_naziv}`); 
            }
        }

        // --- NOVO: AŽURIRANJE PAKETA U BAZI DA SU OTPREMLJENI ---
        if (!needsApproval) {
            let parentId = form.broj_veze;
            if (parentId && parentId.startsWith('IZD-')) {
                const {data: izd} = await supabase.from('izdatnice').select('izvor_id').eq('broj_izdatnice', parentId).maybeSingle();
                if (izd && izd.izvor_id) parentId = izd.izvor_id;
            }
            if (parentId) {
                await supabase.from('paketi').update({ otpremnica_id: form.id.toUpperCase() }).eq('broj_veze', parentId).is('otpremnica_id', null);
            }
        }
        // --------------------------------------------------------

        resetFormu(); load(); setTab('lista');

        prikaziDialog({
            tip: needsApproval ? 'upozorenje' : 'uspjeh',
            naslov: needsApproval ? 'Snimljeno (Čeka Odobrenje)' : 'Uspješno Snimljeno!',
            poruka: needsApproval 
                ? "⚠️ Količina je manja od fizički utovarene! Otpremnica je snimljena, ali je stavljena na 'ČEKA ODOBRENJE' kod Superadmina." 
                : "Otpremnica je uspješno pohranjena u bazu. Želite li isprintati PDF?",
            confirmText: needsApproval ? null : '🖨️ DA, ŠTAMPAJ PDF',
            onConfirm: needsApproval ? null : () => { kreirajPDFPrivremeni(payload); zatvoriDialog(); },
            onCancel: zatvoriDialog
        });
    };

    const odobriOtpremnicu = async (logId, text) => {
        const otpMatch = text.match(/OTP-\d{4}-\d+/);
        if (otpMatch) { 
            const otpId = otpMatch[0];
            await supabase.from('otpremnice').update({ status: 'KREIRANA' }).eq('id', otpId); 
            await zapisiU_Log('OTPREMNICA_ODOBRENA', `Superadmin odobrio izmjenu za: ${otpId}`); 
            
            // NOVO: Ažuriraj pakete nakon odobrenja
            const { data: otp } = await supabase.from('otpremnice').select('broj_veze').eq('id', otpId).maybeSingle();
            let parentId = otp?.broj_veze;
            if (parentId && parentId.startsWith('IZD-')) {
                const {data: izd} = await supabase.from('izdatnice').select('izvor_id').eq('broj_izdatnice', parentId).maybeSingle();
                if (izd && izd.izvor_id) parentId = izd.izvor_id;
            }
            if (parentId) {
                await supabase.from('paketi').update({ otpremnica_id: otpId.toUpperCase() }).eq('broj_veze', parentId).is('otpremnica_id', null);
            }
        }
        await supabase.from('sistem_audit_log').delete().eq('id', logId); 
        prikaziDialog({ tip: 'uspjeh', naslov: 'Odobreno', poruka: 'Zabrana je skinuta. Paketi su otpremljeni.', onCancel: zatvoriDialog });
        load();
    };

    const kreirajPDF = () => { kreirajPDFPrivremeni(form); };

    // --- NOVA LOGIKA ZA ŠTAMPANJE SA PAKETIMA ---
    const kreirajPDFPrivremeni = async (podaci) => {
        
        // Povezujemo pakete sa otpremnicom (preko njene veze ili izvora)
        let parentId = podaci.broj_veze || podaci.id;
        if (parentId && parentId.startsWith('IZD-')) {
            const {data: izd} = await supabase.from('izdatnice').select('izvor_id').eq('broj_izdatnice', parentId).maybeSingle();
            if (izd && izd.izvor_id) parentId = izd.izvor_id;
        }
        
        let paketiPrikaz = {};
        if (parentId) {
            const { data: paks } = await supabase.from('paketi').select('paket_id, naziv_proizvoda').eq('broj_veze', parentId);
            if (paks) {
                paks.forEach(p => {
                    if (!paketiPrikaz[p.naziv_proizvoda]) paketiPrikaz[p.naziv_proizvoda] = [];
                    paketiPrikaz[p.naziv_proizvoda].push(p.paket_id);
                });
            }
        }

        const odabraniKupac = kupci.find(k => k.naziv === podaci.kupac_naziv) || null;
        let redovi = (podaci.stavke_jsonb || stavke).map((s, i) => {
            const kat = katalog.find(k => k.sifra === s.sifra);
            const dimenzije = kat ? `${kat.visina}x${kat.sirina}x${kat.duzina}` : '';
            const paketiStr = paketiPrikaz[s.naziv] && paketiPrikaz[s.naziv].length > 0 ? `<br/><span style="color: #3b82f6; font-size: 10px; font-weight: bold;">📦 Sadrži pakete: ${paketiPrikaz[s.naziv].join(', ')}</span>` : '';
            
            return `<tr><td style="font-weight: bold; color: #64748b; text-align: center;">${i+1}.</td><td><b style="color: #0f172a; font-size: 14px;">${dimenzije ? `${dimenzije} | ` : ''}${s.naziv}</b><br/><span style="color: #64748b; font-size: 11px;">Šifra: ${s.sifra}</span>${paketiStr}</td><td style="text-align: center; font-size: 18px; font-weight: 900; color: #f97316;">${s.kolicina_obracun} <span style="color: #64748b; font-size: 12px; font-weight: 600;">${s.jm_obracun}</span></td></tr>`
        }).join('');

        const htmlSadrzajTabela = `<div class="info-grid"><div class="info-col"><h4>Kupac / Primalac robe</h4><p style="font-size: 18px; font-weight: 900; margin-bottom: 5px;">${podaci.kupac_naziv}</p><p style="font-weight: 400; color: #475569;">${odabraniKupac?.adresa || ''}</p><p style="font-weight: 600; color: #0f172a; font-size: 12px; margin-top: 6px;">PDV / ID: ${odabraniKupac?.pdv_broj || 'N/A'}</p></div><div class="info-col" style="text-align: right;"><h4>Detalji Transporta</h4><p>Vezni Dokument: <span style="font-weight: 600; color: #0f172a;">${podaci.broj_veze || '-'}</span></p><p>Ime Vozača: <span style="font-weight: 600; color: #0f172a;">${podaci.vozac || '-'}</span></p><p>Vozilo (Reg): <span style="font-weight: 900; color: #f97316;">${podaci.registracija || '-'}</span></p></div></div><table><thead><tr><th style="width: 5%; text-align: center;">R.B.</th><th>Dimenzija i Naziv Proizvoda</th><th style="text-align:center;">Isporučena Količina</th></tr></thead><tbody>${redovi}</tbody></table><div style="display: flex; justify-content: space-between; margin-top: 100px; text-align: center; color: #0f172a; font-weight: 600;"><div style="width: 25%;"><div style="border-bottom: 1px solid #94a3b8; margin-bottom: 10px; height: 20px;"></div>Isporučio (Vozač)</div><div style="width: 25%;"><div style="border-bottom: 1px solid #94a3b8; margin-bottom: 10px; height: 20px;"></div>Izdao (Magacin)</div><div style="width: 25%;"><div style="border-bottom: 1px solid #94a3b8; margin-bottom: 10px; height: 20px;"></div>Primio (Kupac)</div></div><div class="footer"><div style="width: 100%;"><b style="color: #0f172a;">Napomena uz isporuku:</b><br/>${podaci.napomena || 'Roba isporučena bez oštećenja.'}</div></div>`;
        printDokument('OTPREMNICA', podaci.id, formatirajDatum(podaci.datum), htmlSadrzajTabela, '#f97316');
    };

    const pokreniIzmjenu = (o) => { setForm({ id: o.id, broj_veze: o.broj_veze || '', kupac_naziv: o.kupac_naziv, datum: o.datum, vozac: o.vozac || '', registracija: o.registracija || '', napomena: o.napomena || '', status: o.status || 'KREIRANA' }); setStavke(o.stavke_jsonb || []); setIsEditing(true); setTab('nova'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

    const renderPoljeHeader = (polje) => {
        if (polje.id === 'veza') return <input value={form.broj_veze} onChange={e=>setForm({...form, broj_veze:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-theme-card rounded-xl text-theme-text outline-none border border-theme-border focus:border-orange-500" placeholder="Nema veznog dokumenta" />;
        if (polje.id === 'broj') return <input value={form.id} disabled className="w-full h-full min-h-[45px] p-4 bg-theme-panel rounded-xl text-theme-text border border-theme-border font-black disabled:opacity-50" />;
        
        // ZAMJENA: SearchableInput je postao MasterSearch
        if (polje.id === 'kupac') return (
            <div className="h-full min-h-[45px]">
                <MasterSearch data={kupci} poljaZaPretragu={['naziv']} value={form.kupac_naziv} onSelect={k => setForm({...form, kupac_naziv: k.naziv})} placeholder="Odaberi kupca..." />
            </div>
        );

        if (polje.id === 'datum') return <input type="date" value={form.datum} onChange={e=>setForm({...form, datum:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none" />;
        if (polje.id === 'status') return <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-theme-panel rounded-xl text-theme-accent font-black border border-orange-500/50 outline-none"><option value="KREIRANA">Kreirana</option><option value="ISPORUČENO">Isporučeno</option><option value="ČEKA ODOBRENJE">Čeka Odobrenje</option></select>;
        if (polje.id === 'vozac') return <input value={form.vozac} onChange={e=>setForm({...form, vozac:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-theme-panel rounded-xl text-theme-text border border-theme-border outline-none focus:border-orange-500" placeholder="Ime vozača..." />;
        if (polje.id === 'registracija') return <input value={form.registracija} onChange={e=>setForm({...form, registracija:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-theme-panel rounded-xl text-theme-text border border-theme-border outline-none focus:border-orange-500" placeholder="npr. A12-B-345" />;
        return null;
    };

    const resetFormu = () => { setForm({ id: generisiID(), broj_veze: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0], vozac: '', registracija: '', napomena: '', status: 'KREIRANA' }); setStavke([]); setIsEditing(false); };

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 font-bold animate-in fade-in pb-20">
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-orange-500" user={user} modulIme="otpremnice" saas={saas} />

            <PametniDialog {...dialog} />

            {isSuperadmin && zahtjeviOdobrenja.length > 0 && (
                <div className="bg-red-950/50 border-2 border-red-500 p-6 rounded-[2rem] shadow-lg animate-pulse w-full">
                    <h3 className="text-red-500 font-black uppercase text-sm mb-4 flex items-center gap-2 tracking-widest"><span>🚨</span> WMS ZAHTJEVI: ODOBRENJE SMANJENJA UTOVARA</h3>
                    <div className="space-y-3">
                        {zahtjeviOdobrenja.map(l => (
                            <div key={l.id} className="bg-black/30 p-4 rounded-xl border border-red-500/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="text-xs text-slate-300">
                                    <p className="font-bold text-red-400 mb-1">Korisnik: {l.korisnik}</p>
                                    <p>{l.detalji}</p>
                                </div>
                                <button onClick={() => odobriOtpremnicu(l.id, l.detalji)} className="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] shadow-lg">✓ Odobri Izmjenu</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex bg-theme-panel p-1.5 rounded-2xl border border-theme-border shadow-inner">
                <button onClick={() => {setTab('nova'); if(!isEditing) resetFormu();}} className={`flex-1 py-3 rounded-xl text-[10px] uppercase font-black transition-all ${tab === 'nova' ? 'bg-orange-600 text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-theme-text'}`}>{isEditing ? '✏️ Izmjena' : '➕ Nova Otpremnica / Nalog'}</button>
                <button onClick={() => setTab('izdatnice')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase font-black transition-all ${tab === 'izdatnice' ? 'bg-amber-600 text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-theme-text'}`}>🚚 Izdatnice (WMS Nalozi)</button>
                <button onClick={() => setTab('lista')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase font-black transition-all ${tab === 'lista' ? 'bg-emerald-600 text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-theme-text'}`}>📋 Arhiva Otpremnica</button>
            </div>

            {tab === 'nova' ? (
                <div className="space-y-4 animate-in slide-in-from-left max-w-4xl mx-auto">
                    {!isEditing && (
                        <div className="bg-theme-card border border-orange-500/50 p-6 rounded-box shadow-2xl relative z-[60]">
                            <label className="text-[10px] text-theme-accent uppercase font-black block mb-2 ml-2">Pametni unos (Skeniraj Nalog za utovar, Ponudu ili Radni Nalog)</label>
                            
                            {/* ZAMJENA: Pametni unos koristi MasterSearch */}
                            <MasterSearch 
                                data={dostupniDokumenti} 
                                poljaZaPretragu={['id', 'kupac']} 
                                onSelect={(d) => skenirajVezu(d.id)} 
                                placeholder="Skeniraj ili ukucaj broj (npr. PON-123)..."
                                onScanClick={() => setIsScanningOverlay(true)}
                                renderItem={(item) => (
                                    <div className="flex justify-between items-center w-full">
                                        <div><span className="text-theme-text font-black">{item.id}</span> <span className="text-[10px] text-orange-300 ml-2 font-bold">{item.tip}</span></div>
                                        <div className="text-slate-300 text-[10px] font-bold">{item.kupac} | <span className={item.status === 'ZAVRŠENO' || item.status === 'utovareno' ? 'text-emerald-400' : 'text-amber-400'}>{item.status}</span></div>
                                    </div>
                                )}
                            />
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
                        <div className="relative mb-3">
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Pronađi proizvod (Ili unesi ručno pakete bez naloga)</label>
                            
                            {/* ZAMJENA: Pretraga proizvoda koristi MasterSearch */}
                            <MasterSearch 
                                data={katalog} 
                                poljaZaPretragu={['sifra', 'naziv']} 
                                value={stavkaForm.sifra_unos}
                                onSelect={(k) => { setTrenutniProizvod(k); setStavkaForm({ ...stavkaForm, id: null, sifra_unos: `${k.sifra} | ${k.naziv}`, jm_obracun: k.default_jedinica || 'm3' }); }} 
                                placeholder="Pronađi proizvod..."
                                renderItem={(k) => (
                                    <div>
                                        <div className="text-theme-text text-xs font-black">{k.visina}x{k.sirina}x{k.duzina} | {k.naziv} <span className="text-orange-400 ml-2">(Šifra: {k.sifra})</span></div>
                                        <div className="text-[10px] text-slate-400 mt-1 uppercase">Kat: {k.kategorija} | Baza: {k.default_jedinica}</div>
                                    </div>
                                )}
                            />
                        </div>
                        {trenutniProizvod && (
                            <div className="p-4 bg-blue-900/10 border border-blue-500/30 rounded-2xl animate-in zoom-in-95 space-y-4 shadow-inner">
                                <div className="border-b border-theme-border pb-3"><p className="text-theme-text text-sm font-black">{trenutniProizvod.visina}x{trenutniProizvod.sirina}x{trenutniProizvod.duzina} | {trenutniProizvod.naziv}</p><p className="text-[10px] text-slate-400 mt-1">Šifra: <span className="text-theme-text">{trenutniProizvod.sifra}</span></p></div>
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
                                {stavke.map((s, i) => {
                                    const katItem = katalog.find(k => k.sifra === s.sifra);
                                    const dim = katItem ? `${katItem.visina}x${katItem.sirina}x${katItem.duzina}` : '';
                                    return (
                                    <div key={s.id} onClick={() => urediStavku(s)} className="flex justify-between items-center p-4 bg-theme-card border border-theme-border rounded-xl cursor-pointer hover:border-orange-500 transition-all group shadow-md">
                                        <div className="flex items-center gap-4"><span className="text-slate-500 text-sm font-black">{i+1}.</span><div><p className="text-theme-text text-sm font-black">{dim ? `${dim} | ` : ''}{s.naziv}</p><p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest">{s.sifra}</p></div></div>
                                        <div className="flex items-center gap-6 text-right"><p className="text-orange-500 font-black text-xl">{s.kolicina_obracun} <span className="text-xs text-slate-400">{s.jm_obracun}</span></p><button onClick={(e)=>{e.stopPropagation(); ukloniStavku(s.id);}} className="text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 p-2 rounded-lg transition-all font-black">✕</button></div>
                                    </div>
                                )})}
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
            ) : tab === 'izdatnice' ? (
                <div className="bg-theme-card p-8 rounded-box border border-amber-500/50 shadow-2xl animate-in zoom-in-95">
                    {/* WMS UTOVAR ILI LISTA */}
                    {wmsIzdatnica ? (
                        <>
                            <div className="flex justify-between items-start border-b border-theme-border pb-6 mb-6">
                                <div>
                                    <button onClick={zatvoriWmsUtovar} className="text-slate-400 font-black uppercase text-[10px] hover:text-white bg-slate-800 px-4 py-2 rounded-lg mb-4">← Nazad na listu</button>
                                    <h2 className="text-3xl text-amber-500 font-black">{wmsIzdatnica.broj_izdatnice}</h2>
                                    <p className="text-theme-text text-sm font-bold uppercase tracking-widest mt-1">Kupac: <span className="text-amber-400">{wmsIzdatnica.kupac_naziv}</span></p>
                                </div>
                                <div className="text-right"><span className="bg-amber-900/40 text-amber-500 px-4 py-2 rounded-xl text-xs font-black uppercase border border-amber-500/40">Utovar u toku</span><p className="text-[10px] text-slate-500 uppercase font-black mt-3">{formatirajDatum(wmsIzdatnica.datum)}</p></div>
                            </div>
                            <div className="space-y-4 mb-8">
                                {wmsStavke.map(s => {
                                    const kat = katalog.find(k => k.sifra === s.proizvod_sifra);
                                    const dim = kat ? `${kat.visina}x${kat.sirina}x${kat.duzina}` : '';
                                    return (
                                        <div key={s.id} className="bg-theme-panel p-5 rounded-2xl border border-theme-border flex flex-col md:flex-row justify-between items-center gap-4">
                                            <div className="flex-1"><p className="text-theme-text font-black text-lg uppercase">{dim ? `${dim} | ` : ''}{s.proizvod_naziv}</p><p className="text-slate-400 text-xs font-bold mt-1">Šifra: {s.proizvod_sifra}</p></div>
                                            <div className="flex items-center gap-6 bg-black/40 p-4 rounded-xl border border-slate-700">
                                                <div className="text-center"><p className="text-[9px] text-slate-500 uppercase font-black mb-1">Planirano (Nalog)</p><p className="text-slate-300 font-black text-xl">{s.planirana_kolicina} <span className="text-xs">{s.mjerna_jedinica}</span></p></div>
                                                <div className="text-center"><p className="text-[9px] text-amber-500 uppercase font-black mb-1">Utovareno (Stvarno)</p><input type="number" value={s.izdata_kolicina} onChange={(e) => handleWmsKolicina(s.id, e.target.value)} className="w-24 p-3 bg-amber-900/30 border border-amber-500 rounded-xl text-amber-400 font-black text-xl text-center outline-none" /></div>
                                                <button onClick={() => obrisiWmsStavku(s.id)} className="text-red-500 hover:bg-red-500/20 p-3 rounded-xl transition-all font-black ml-2">✕</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="bg-blue-900/10 p-6 rounded-2xl border border-blue-500/30 mb-8">
                                <h4 className="text-[10px] text-blue-400 uppercase font-black mb-4">➕ Dodatni utovar (Kupac uzeo još nešta)</h4>
                                <div className="flex gap-4 items-end z-50 relative">
                                    <div className="flex-1">
                                        <MasterSearch 
                                            data={katalog} 
                                            poljaZaPretragu={['sifra', 'naziv']} 
                                            onSelect={(k) => setWmsNovaSifra(`${k.sifra} | ${k.naziv}`)} 
                                            placeholder="Pronađi proizvod za dodavanje..."
                                        />
                                    </div>
                                    <input type="number" value={wmsNovaKol} onChange={e=>setWmsNovaKol(e.target.value)} placeholder="Kol..." className="w-24 p-4 bg-theme-card rounded-xl text-theme-text font-black text-center border border-theme-border outline-none focus:border-blue-500" />
                                    <button onClick={dodajWmsStavkuNovu} className="bg-blue-600 text-white px-6 py-4 rounded-xl font-black uppercase text-xs hover:bg-blue-500 transition-all">Dodaj stavku</button>
                                </div>
                            </div>
                            <button onClick={zavrsiIPotvrdiUtovar} className="w-full py-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-lg uppercase shadow-[0_0_20px_rgba(16,185,129,0.5)] tracking-widest transition-all">✅ ZAVRŠI I POTVRDI UTOVAR</button>
                        </>
                    ) : (
                        <>
                            <div className="flex justify-between items-center mb-6 border-b border-theme-border pb-4">
                                <h3 className="text-theme-accent font-black uppercase text-xs tracking-widest">📋 Aktivni Nalozi za Utovar (WMS Izdatnice)</h3>
                                <div className="flex gap-2">
                                    <span className="bg-amber-900/30 text-amber-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase border border-amber-500/30">Utovar u toku</span>
                                    <span className="bg-emerald-900/30 text-emerald-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase border border-emerald-500/30">Spremno za kasu</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                {izdatnice.map(izd => (
                                    <div key={izd.id} className="bg-theme-panel border border-theme-border p-5 rounded-2xl shadow-xl hover:border-amber-500 transition-all group relative overflow-hidden">
                                        <div className="flex justify-between items-start mb-4 border-b border-slate-700 pb-3 cursor-pointer" onClick={() => otvoriWmsUtovar(izd)}>
                                            <div><p className="text-theme-accent font-black text-lg">{izd.broj_izdatnice}</p><p className="text-theme-text text-xs font-bold uppercase mt-1">{izd.kupac_naziv}</p></div>
                                            <span className={`text-[9px] px-2 py-1 rounded font-black uppercase border ${izd.status === 'u_pripremi' ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' : izd.status === 'na_utovaru' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>{izd.status.replace('_', ' ')}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] text-slate-400 font-black uppercase mb-4 cursor-pointer" onClick={() => otvoriZatvoriIzdatnicu(izd.id)}>
                                            <span>Izvor: <span className="text-theme-text">{izd.izvor_id || 'RUČNO'}</span></span><span>{formatirajDatum(izd.datum)}</span>
                                        </div>
                                        {prosirenaIzdatnicaId === izd.id && (
                                            <div className="mb-4 bg-black/30 p-3 rounded-xl border border-slate-700">
                                                <p className="text-[9px] text-theme-muted uppercase mb-2 font-black border-b border-slate-700 pb-1">Brzi Pregled:</p>
                                                {ucitaneStavkeIzdatnice.map(st => (<div key={st.id} className="flex justify-between items-center text-[10px] text-slate-300 py-1 border-b border-slate-800 last:border-0"><span className="truncate mr-2 uppercase">{st.proizvod_sifra}</span><span className="text-amber-500 font-black whitespace-nowrap">{st.planirana_kolicina} {st.mjerna_jedinica}</span></div>))}
                                            </div>
                                        )}
                                        <div className="flex gap-2">
                                            <button onClick={(e) => printIzdatnicaFromList(e, izd)} className="flex-1 bg-theme-card py-3 rounded-xl text-[10px] font-black uppercase border border-slate-600 hover:bg-white hover:text-black transition-all shadow-md">🖨️ Štampaj</button>
                                            {izd.status === 'utovareno' && <button onClick={(e) => { e.stopPropagation(); skenirajVezu(izd.broj_izdatnice); setTab('nova'); }} className="flex-1 bg-emerald-600 py-3 rounded-xl text-[10px] font-black uppercase text-white hover:bg-emerald-500 transition-all shadow-md">📑 Napravi Otpremnicu</button>}
                                        </div>
                                    </div>
                                ))}
                                {izdatnice.length === 0 && <p className="col-span-full text-center text-slate-500 py-10 font-bold italic">Nema aktivnih izdatnica.</p>}
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <div className="bg-theme-card p-6 rounded-[2rem] border border-theme-border shadow-2xl animate-in slide-in-from-right">
                    <h3 className="text-slate-400 uppercase text-[10px] mb-6 tracking-widest">Arhiva izdatih otpremnica</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {otpremnice.map(o => (
                            <div key={o.id} onClick={() => pokreniIzmjenu(o)} className="p-5 bg-theme-panel border border-theme-border rounded-2xl hover:border-emerald-500 transition-all group cursor-pointer shadow-lg">
                                <div className="flex justify-between items-start border-b border-slate-700 pb-3 mb-3">
                                    <div><p className="text-emerald-500 font-black text-sm">{o.id}</p><p className="text-theme-text text-[10px] font-bold uppercase mt-1">{o.kupac_naziv}</p></div>
                                    <span className={`text-[9px] px-2 py-1 rounded font-black uppercase border ${o.status === 'ČEKA ODOBRENJE' ? 'bg-red-900/30 text-red-500 border-red-500/30 animate-pulse' : 'bg-slate-800 text-slate-400 border-slate-600'}`}>{o.status}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-slate-400 font-black uppercase">
                                    <span>Vozilo: {o.registracija || 'N/A'}</span>
                                    <span>Stavki: {o.stavke_jsonb?.length}</span>
                                    <button onClick={(e)=>{e.stopPropagation(); setForm(o); setStavke(o.stavke_jsonb||[]); setTimeout(() => kreirajPDFPrivremeni(o), 100);}} className="text-emerald-400 font-black px-2 py-1 rounded bg-emerald-900/30 hover:bg-emerald-500 hover:text-white transition-all">PDF</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {isScanningOverlay && <ScannerOverlay onScan={(text) => { skenirajVezu(text); setIsScanningOverlay(false); }} onClose={() => setIsScanningOverlay(false)} />}
        </div>
    );
}