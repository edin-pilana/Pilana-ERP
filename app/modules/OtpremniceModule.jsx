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

    const generisiID = () => `OTP-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;

    const [form, setForm] = useState({ id: generisiID(), broj_veze: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0], vozac: '', registracija: '', napomena: '', status: 'KREIRANA' });
    const [stavke, setStavke] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    
    // 🟢 SLOBODNA PRODAJA STATE
    const [isSlobodnaProdaja, setIsSlobodnaProdaja] = useState(false);
    const [dostupniPaketiLager, setDostupniPaketiLager] = useState([]);
    const [prikaziLagerModal, setPrikaziLagerModal] = useState(false);
    const [pretragaLagera, setPretragaLagera] = useState('');

    const [dostupniDokumenti, setDostupniDokumenti] = useState([]);
    
    // 🟢 SKENER STATE
    const [isScanningOverlay, setIsScanningOverlay] = useState(false);
    const [scanTarget, setScanTarget] = useState('');
    const [pretragaWms, setPretragaWms] = useState('');
    
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
    };

    const zapisiU_Log = async (akcija, detalji) => { 
        await supabase.from('sistem_audit_log').insert([{ korisnik: currentUser.ime_prezime || 'Nepoznat', akcija, detalji }]); 
    };

    // 🟢 FUNKCIJA ZA PAMETNE ALARME
    const zapisiU_LogSaAlarmom = async (akcija, detalji, nivo = 'INFO') => { 
        await supabase.from('sistem_audit_log').insert([{ 
            korisnik: currentUser.ime_prezime || 'Nepoznat', 
            akcija, 
            detalji, 
            nivo_alarma: nivo, 
            pregledano: false 
        }]); 
    };

    const skenirajVezu = async (brojRaw) => {
        const broj = (brojRaw || '').toUpperCase().trim();
        if(!broj) return;
        
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

    // 🟢 FUNKCIJE ZA SLOBODNU PRODAJU I LAGER PAKETE
    const otvoriLagerZaSlobodnuProdaju = async () => {
        const { data, error } = await supabase.from('paketi').select('*').not('closed_at', 'is', null).is('otpremnica_id', null).order('created_at', { ascending: false });
        if (error) return alert("Greška pri učitavanju lagera: " + error.message);
        
        const vecDodaniPaketi = stavke.map(s => s.paket_id).filter(Boolean);
        const dostupni = (data || []).filter(p => !vecDodaniPaketi.includes(p.paket_id));
        
        setDostupniPaketiLager(dostupni);
        setPrikaziLagerModal(true);
    };

    const dodajPaketSaLagera = (paket) => {
        const kat = katalog.find(k => k.naziv === paket.naziv_proizvoda || k.sifra === paket.naziv_proizvoda);
        const novaStavka = {
            id: Math.random().toString(),
            paket_id: paket.paket_id,
            sifra: kat ? kat.sifra : 'NEPOZNATO',
            naziv: paket.naziv_proizvoda,
            kolicina_obracun: paket.kolicina_final,
            jm_obracun: 'm3',
            originalni_paket: paket
        };
        setStavke([...stavke, novaStavka]);
        setDostupniPaketiLager(dostupniPaketiLager.filter(p => p.id !== paket.id));
    };

    const dodajStavku = () => {
        if(!trenutniProizvod || !stavkaForm.kolicina_obracun) return prikaziDialog({ tip: 'upozorenje', naslov: 'Fale Podaci', poruka: "Odaberite proizvod i unesite količinu!", onCancel: zatvoriDialog });
        const novaStavka = { id: stavkaForm.id || Math.random().toString(), sifra: trenutniProizvod.sifra, naziv: trenutniProizvod.naziv, kolicina_obracun: parseFloat(stavkaForm.kolicina_obracun), jm_obracun: stavkaForm.jm_obracun };
        if (stavkaForm.id) setStavke(stavke.map(s => s.id === stavkaForm.id ? novaStavka : s)); else setStavke([...stavke, novaStavka]);
        setStavkaForm({ id: null, sifra_unos: '', kolicina_obracun: '', jm_obracun: 'm3' }); setTrenutniProizvod(null);
    };

    const urediStavku = (stavka) => {
        if(stavka.paket_id) return alert("Paket povučen sa lagera ne može se uređivati. Možete ga samo ukloniti i izabrati drugi.");
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

    // 🟢 NEBLOKIRAJUĆE SNIMANJE UTOVARA SA ALARMOM
    const zavrsiIPotvrdiUtovar = async () => {
        prikaziDialog({
            tip: 'info',
            naslov: 'Potvrda Utovara',
            poruka: 'Da li ste sigurni da želite potvrditi unesene količine i završiti utovar?',
            onConfirm: async () => {
                const zaInsert = []; const zaUpdate = [];
                let odstupanjeText = [];
                
                wmsStavke.forEach(s => {
                    const izdata = parseFloat(s.izdata_kolicina) || 0;
                    const planirana = parseFloat(s.planirana_kolicina) || 0;
                    
                    if (izdata !== planirana) {
                        odstupanjeText.push(`${s.proizvod_sifra} (Planirano: ${planirana} ➔ Utovareno: ${izdata})`);
                    }
                    
                    const payload = { izdatnica_id: wmsIzdatnica.id, proizvod_sifra: s.proizvod_sifra, proizvod_naziv: s.proizvod_naziv, planirana_kolicina: planirana, izdata_kolicina: izdata, mjerna_jedinica: s.mjerna_jedinica };
                    if(String(s.id).startsWith('novo_')) zaInsert.push(payload); else zaUpdate.push({ ...payload, id: s.id });
                });
                
                if(zaInsert.length > 0) await supabase.from('izdatnice_stavke').insert(zaInsert);
                if(zaUpdate.length > 0) await supabase.from('izdatnice_stavke').upsert(zaUpdate);
                await supabase.from('izdatnice').update({ status: 'utovareno' }).eq('id', wmsIzdatnica.id);
                
                if (odstupanjeText.length > 0) {
                    await zapisiU_LogSaAlarmom('ODSTUPANJE_UTOVAR_WMS', `Skladištar prijavio odstupanje za nalog ${wmsIzdatnica.broj_izdatnice}: ${odstupanjeText.join(', ')}`, 'ŽUTO');
                } else {
                    await zapisiU_Log('UTOVAR_ZAVRSEN', `Nalog ${wmsIzdatnica.broj_izdatnice} potvrdio: ${currentUser.ime_prezime}`);
                }
                
                zatvoriWmsUtovar(); load();
                zatvoriDialog(); 
                
                setTimeout(() => {
                    prikaziDialog({ tip: 'uspjeh', naslov: 'Utovareno!', poruka: "✅ UTOVAR POTVRĐEN! Spreman za fakturisanje i otpremu.", cancelText: 'ZATVORI', confirmText: null, onCancel: zatvoriDialog });
                }, 100);
            },
            onCancel: zatvoriDialog
        });
    };

    // 🟢 100% BEZBLOKADNA REALIZACIJA OTPREMNICE SA AUTOMATSKIM ALARMIMA
    const snimiOtpremnicu = async () => {
        if(!form.kupac_naziv) return prikaziDialog({ tip: 'upozorenje', naslov: 'Kupac Obavezan', poruka: "Morate odabrati kupca da biste snimili otpremnicu.", onCancel: zatvoriDialog });
        if(stavke.length === 0) return prikaziDialog({ tip: 'upozorenje', naslov: 'Nema stavki', poruka: "Otpremnica mora imati barem jednu stavku!", onCancel: zatvoriDialog });

        // BLOKADA DUPLIKATA PRI SNIMANJU (osim za slobodnu prodaju)
        if (!isEditing && form.broj_veze && !isSlobodnaProdaja) {
            const { data: postojeceOtp } = await supabase.from('otpremnice').select('id').eq('broj_veze', form.broj_veze).maybeSingle();
            if (postojeceOtp) {
                return prikaziDialog({ tip: 'greska', naslov: 'Duplikat', poruka: `Za dokument ${form.broj_veze} je VEĆ KREIRANA OTPREMNICA (${postojeceOtp.id})! Nije dozvoljeno kreiranje duplih otpremnica.`, onCancel: zatvoriDialog });
            }
        }

        let detektovanoOdstupanje = false;
        let diffDetails = [];

        // Kontrola i komparacija sa originalnim WMS utovarom
        if (form.broj_veze && form.broj_veze.startsWith('IZD-')) {
            const { data: izd } = await supabase.from('izdatnice').select('id').eq('broj_izdatnice', form.broj_veze).maybeSingle();
            if (izd) {
                const { data: izdStavke } = await supabase.from('izdatnice_stavke').select('*').eq('izdatnica_id', izd.id);
                (izdStavke || []).forEach(og => {
                    const curr = stavke.find(s => s.sifra === og.proizvod_sifra);
                    const origKol = parseFloat(og.izdata_kolicina) > 0 ? parseFloat(og.izdata_kolicina) : parseFloat(og.planirana_kolicina);
                    if (!curr) { detektovanoOdstupanje = true; diffDetails.push(`Obrisana stavka: ${og.proizvod_sifra} (Bilo: ${origKol})`); } 
                    else if (parseFloat(curr.kolicina_obracun) !== origKol) { detektovanoOdstupanje = true; diffDetails.push(`Izmijenjeno za ${og.proizvod_sifra}: sa ${origKol} na ${curr.kolicina_obracun}`); }
                });
            }
        }

        const izvrsiSnimanje = async () => {
            const upisniId = form.id.toUpperCase();
            const payload = { 
                id: upisniId, 
                broj_veze: isSlobodnaProdaja ? 'SLOBODNA PRODAJA' : form.broj_veze, 
                kupac_naziv: form.kupac_naziv, 
                datum: form.datum, 
                vozac: form.vozac, 
                registracija: form.registracija, 
                napomena: form.napomena, 
                stavke_jsonb: stavke, 
                status: 'KREIRANA', // 🟢 TRENUTNO I UVIJEK PROHODNA, NEMA BLOKADE
                snimio_korisnik: currentUser.ime_prezime 
            };
            
            if (isEditing) {
                const { error } = await supabase.from('otpremnice').update(payload).eq('id', form.id);
                if(error) return prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: error.message, onCancel: zatvoriDialog }); 
            } else {
                const { error } = await supabase.from('otpremnice').insert([payload]);
                if(error) return prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: error.message, onCancel: zatvoriDialog }); 
            }

            if (detektovanoOdstupanje) {
                await zapisiU_LogSaAlarmom('ALARM_ODSTUPANJE_OTPREMNICE', `Faktura/Otpremnica ${upisniId} odstupila od utovara: ${diffDetails.join(' | ')}`, 'CRVENO');
            } else {
                await zapisiU_Log('IZMJENA_OTPREMNICE', `Snimljena otpremnica ${upisniId}`);
            }

            // Skidanje paketa sa lagera (WMS ili ručni paketi)
            const paketiKojiSuDodani = stavke.map(s => s.paket_id).filter(Boolean);
            if (paketiKojiSuDodani.length > 0) {
                await supabase.from('paketi').update({ otpremnica_id: upisniId }).in('paket_id', paketiKojiSuDodani);
            } else if (!isSlobodnaProdaja && form.broj_veze) {
                let parentId = form.broj_veze;
                if (parentId.startsWith('IZD-')) {
                    const {data: izd} = await supabase.from('izdatnice').select('izvor_id').eq('broj_izdatnice', parentId).maybeSingle();
                    if (izd && izd.izvor_id) parentId = izd.izvor_id;
                }
                await supabase.from('paketi').update({ otpremnica_id: upisniId }).eq('broj_veze', parentId).is('otpremnica_id', null);
            }

            resetFormu(); load(); setTab('lista');
            prikaziDialog({ tip: 'uspjeh', naslov: 'Uspješno isporučeno', poruka: "Otpremnica je uspješno kreirana! Želite li isprintati PDF?", confirmText: '🖨️ ŠTAMPAJ PDF', cancelText: 'ZATVORI', onConfirm: () => { kreirajPDFPrivremeni(payload); zatvoriDialog(); }, onCancel: zatvoriDialog });
        };

        if (detektovanoOdstupanje) {
            prikaziDialog({
                tip: 'upozorenje',
                naslov: '⚠️ DETEKTOVANO ODSTUPANJE!',
                poruka: `Količine ne odgovaraju originalnom utovaru iz skladišta!\nSistem će pustiti otpremnicu kao prohodnu, ali će Superadmin dobiti crvenu obavijest u Nadzornom Centru. Nastaviti?`,
                confirmText: '🚀 DA, SNIMI OTPREMNICU',
                cancelText: '✕ KORIGUJ',
                onConfirm: () => { zatvoriDialog(); izvrsiSnimanje(); },
                onCancel: zatvoriDialog
            });
        } else {
            await izvrsiSnimanje();
        }
    };

    const kreirajPDF = () => { kreirajPDFPrivremeni(form); };

    const kreirajPDFPrivremeni = async (podaci) => {
        let parentId = podaci.broj_veze === 'SLOBODNA PRODAJA' ? null : (podaci.broj_veze || podaci.id);
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
            
            let paketiStr = '';
            if (s.paket_id) {
                paketiStr = `<br/><span style="color: #3b82f6; font-size: 10px; font-weight: bold;">📦 Paket: ${s.paket_id}</span>`;
            } else if (paketiPrikaz[s.naziv] && paketiPrikaz[s.naziv].length > 0) {
                paketiStr = `<br/><span style="color: #3b82f6; font-size: 10px; font-weight: bold;">📦 Sadrži pakete: ${paketiPrikaz[s.naziv].join(', ')}</span>`;
            }
            
            return `<tr><td style="font-weight: bold; color: #64748b; text-align: center;">${i+1}.</td><td><b style="color: #0f172a; font-size: 14px;">${dimenzije ? `${dimenzije} | ` : ''}${s.naziv}</b><br/><span style="color: #64748b; font-size: 11px;">Šifra: ${s.sifra}</span>${paketiStr}</td><td style="text-align: center; font-size: 18px; font-weight: 900; color: #f97316;">${s.kolicina_obracun} <span style="color: #64748b; font-size: 12px; font-weight: 600;">${s.jm_obracun}</span></td></tr>`
        }).join('');

        const htmlSadrzajTabela = `<div class="info-grid"><div class="info-col"><h4>Kupac / Primalac robe</h4><p style="font-size: 18px; font-weight: 900; margin-bottom: 5px;">${podaci.kupac_naziv}</p><p style="font-weight: 400; color: #475569;">${odabraniKupac?.adresa || ''}</p><p style="font-weight: 600; color: #0f172a; font-size: 12px; margin-top: 6px;">PDV / ID: ${odabraniKupac?.pdv_broj || 'N/A'}</p></div><div class="info-col" style="text-align: right;"><h4>Detalji Transporta</h4><p>Vezni Dokument: <span style="font-weight: 600; color: #0f172a;">${podaci.broj_veze || '-'}</span></p><p>Ime Vozača: <span style="font-weight: 600; color: #0f172a;">${podaci.vozac || '-'}</span></p><p>Vozilo (Reg): <span style="font-weight: 900; color: #f97316;">${podaci.registracija || '-'}</span></p></div></div><table><thead><tr><th style="width: 5%; text-align: center;">R.B.</th><th>Dimenzija i Naziv Proizvoda</th><th style="text-align:center;">Isporučena Količina</th></tr></thead><tbody>${redovi}</tbody></table><div style="display: flex; justify-content: space-between; margin-top: 100px; text-align: center; color: #0f172a; font-weight: 600;"><div style="width: 25%;"><div style="border-bottom: 1px solid #94a3b8; margin-bottom: 10px; height: 20px;"></div>Isporučio (Vozač)</div><div style="width: 25%;"><div style="border-bottom: 1px solid #94a3b8; margin-bottom: 10px; height: 20px;"></div>Izdao (Magacin)</div><div style="width: 25%;"><div style="border-bottom: 1px solid #94a3b8; margin-bottom: 10px; height: 20px;"></div>Primio (Kupac)</div></div><div class="footer"><div style="width: 100%;"><b style="color: #0f172a;">Napomena uz isporuku:</b><br/>${podaci.napomena || 'Roba isporučena bez oštećenja.'}</div></div>`;
        printDokument('OTPREMNICA', podaci.id, formatirajDatum(podaci.datum), htmlSadrzajTabela, '#f97316');
    };

    const pokreniIzmjenu = (o) => { 
        setForm({ id: o.id, broj_veze: o.broj_veze || '', kupac_naziv: o.kupac_naziv, datum: o.datum, vozac: o.vozac || '', registracija: o.registracija || '', napomena: o.napomena || '', status: o.status || 'KREIRANA' }); 
        setStavke(o.stavke_jsonb || []); 
        setIsEditing(true); 
        setIsSlobodnaProdaja(o.broj_veze === 'SLOBODNA PRODAJA');
        setTab('nova'); 
        window.scrollTo({ top: 0, behavior: 'smooth' }); 
    };

    const renderPoljeHeader = (polje) => {
        if (polje.id === 'veza') return (
            <input 
                value={isSlobodnaProdaja ? 'SLOBODNA_ROBA' : form.broj_veze} 
                onChange={e=>setForm({...form, broj_veze:e.target.value})} 
                disabled={isSlobodnaProdaja}
                className="w-full h-full min-h-[45px] p-4 bg-theme-card rounded-xl text-theme-text outline-none border border-theme-border focus:border-orange-500 disabled:opacity-50" 
                placeholder="Nema veznog dokumenta" 
            />
        );
        if (polje.id === 'broj') return <input value={form.id} disabled className="w-full h-full min-h-[45px] p-4 bg-theme-panel rounded-xl text-theme-text border border-theme-border font-black disabled:opacity-50" />;
        
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

    const resetFormu = () => { 
        setForm({ id: generisiID(), broj_veze: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0], vozac: '', registracija: '', napomena: '', status: 'KREIRANA' }); 
        setStavke([]); 
        setIsEditing(false); 
        setIsSlobodnaProdaja(false);
    };

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 font-bold animate-in fade-in pb-20">
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-orange-500" user={user} modulIme="otpremnice" saas={saas} />

            <PametniDialog {...dialog} />

            {/* MODAL ZA LAGER KOD SLOBODNE PRODAJE */}
            {prikaziLagerModal && (
                <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-theme-card border-2 border-orange-500 p-6 rounded-[2.5rem] shadow-2xl max-w-4xl w-full relative max-h-[85vh] flex flex-col">
                        <button onClick={() => setPrikaziLagerModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-white font-black text-xl z-10">✕</button>
                        <h3 className="text-orange-500 font-black uppercase text-sm mb-4 border-b border-theme-border pb-3">📦 Odaberi pakete sa stanja lagera</h3>
                        <div className="relative mb-4">
                            <input type="text" value={pretragaLagera} onChange={e => setPretragaLagera(e.target.value.toUpperCase())} placeholder="Pretraži paket ili proizvod..." className="w-full p-4 bg-theme-panel border border-theme-border rounded-xl text-theme-text outline-none focus:border-orange-500 pr-16 text-xs" />
                            <button onClick={() => { setScanTarget('lager'); setIsScanningOverlay(true); }} className="absolute right-2 top-2 bottom-2 px-4 bg-orange-600 rounded-xl text-white font-bold hover:bg-orange-500 transition-all text-xl shadow-md">📷</button>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {dostupniPaketiLager.filter(p => (p.paket_id||'').toUpperCase().includes(pretragaLagera) || (p.naziv_proizvoda||'').toUpperCase().includes(pretragaLagera)).map(p => (
                                <div key={p.id} onClick={() => { dodajPaketSaLagera(p); setPrikaziLagerModal(false); }} className="p-4 bg-theme-panel border border-theme-border rounded-xl cursor-pointer hover:border-orange-500 transition-all shadow-md group">
                                   <div className="flex justify-between items-start mb-2">
    <p className="text-orange-400 font-black text-xs font-mono">{p.paket_id}</p>
    <div className="text-right">
        <p className="text-theme-text font-black text-sm">{p.kolicina_final} <span className="text-[10px] text-slate-500">m³</span></p>
        <p className="text-emerald-400 text-[9px] font-bold mt-0.5 bg-emerald-900/20 px-1.5 py-0.5 rounded border border-emerald-500/20 inline-block">{p.kolicina_ulaz} {p.jm}</p>
    </div>
</div>
<p className="text-theme-text text-[10px] font-black uppercase mb-1 line-clamp-1">{p.naziv_proizvoda}</p>
<p className="text-slate-400 text-[10px] font-bold">Dim: {p.debljina}x{p.sirina}x{p.duzina} cm</p>
<button className="w-full mt-3 py-2 bg-orange-950/40 text-orange-400 font-black text-[9px] uppercase rounded-lg group-hover:bg-orange-600 group-hover:text-white transition-colors">Izaberi robu →</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* NAVIGACIONI TABOVI */}
            <div className="grid grid-cols-3 bg-theme-panel p-1 rounded-2xl border border-theme-border shadow-inner w-full gap-1">
                <button onClick={() => {setTab('nova'); if(!isEditing) resetFormu();}} className={`py-3.5 rounded-xl text-[10px] uppercase font-black transition-all ${tab === 'nova' ? 'bg-orange-600 text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card'}`}>➕ Nova Otprema</button>
                <button onClick={() => setTab('izdatnice')} className={`py-3.5 rounded-xl text-[10px] uppercase font-black transition-all ${tab === 'izdatnice' ? 'bg-amber-600 text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card'}`}>🚚 Skladište (WMS)</button>
                <button onClick={() => setTab('lista')} className={`py-3.5 rounded-xl text-[10px] uppercase font-black transition-all ${tab === 'lista' ? 'bg-emerald-600 text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card'}`}>📋 Arhiva</button>
            </div>

            {tab === 'nova' ? (
                <div className="space-y-4 animate-in slide-in-from-left max-w-4xl mx-auto w-full">
                    
                    {/* SKLOPKA ZA SLOBODNU PRODAJU */}
                    <div className="bg-orange-900/10 border-2 border-orange-500/20 p-4 rounded-xl flex items-center justify-between shadow-inner mb-4">
                        <div><p className="text-orange-400 font-black uppercase text-xs">📦 SLOBODNA PRODAJA DIREKTNO SA LAGERA</p><p className="text-[9px] text-slate-400 mt-1 uppercase">Uključite ako kupac tovari gotovu robu bez prethodnog kreiranja radnog naloga.</p></div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={isSlobodnaProdaja} onChange={(e) => { setIsSlobodnaProdaja(e.target.checked); if(e.target.checked) setForm({...form, broj_veze: ''}); setStavke([]); }} className="sr-only peer" disabled={isEditing} />
                            <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                    </div>

                    {!isEditing && !isSlobodnaProdaja && (
                        <div className="bg-theme-card border border-orange-500/30 p-6 rounded-box shadow-2xl relative z-[60] animate-in fade-in mb-4">
                            <label className="text-[10px] text-theme-accent uppercase font-black block mb-2 ml-2">Pametni unos (Skeniraj Nalog za utovar, Ponudu ili Radni Nalog)</label>
                            <MasterSearch 
                                data={dostupniDokumenti} 
                                poljaZaPretragu={['id', 'kupac']} 
                                onSelect={(d) => skenirajVezu(d.id)} 
                                placeholder="Skeniraj ili ukucaj broj (npr. PON-123)..."
                                onScanClick={() => { setScanTarget('veza'); setIsScanningOverlay(true); }}
                                renderItem={(item) => (
                                    <div className="flex justify-between items-center w-full">
                                        <div><span className="text-theme-text font-black">{item.id}</span> <span className="text-[10px] text-orange-300 ml-2 font-bold">{item.tip}</span></div>
                                        <div className="text-slate-300 text-[10px] font-bold">{item.kupac} | <span className={item.status === 'ZAVRŠENO' || item.status === 'utovareno' ? 'text-emerald-400' : 'text-amber-400'}>{item.status}</span></div>
                                    </div>
                                )}
                            />
                        </div>
                    )}

                    {/* GLAVNA FORMA ZAGLAVLJA */}
                    <div className="p-4 sm:p-6 rounded-box border bg-theme-card shadow-2xl border-theme-border/60" style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <div className="flex flex-col sm:grid sm:grid-cols-4 gap-4">
                            {aktivnaPolja.map((polje, index) => (
                                <div key={polje.id} className={`flex flex-col w-full ${polje.span === 'col-span-4' ? 'sm:col-span-4' : polje.span === 'col-span-2' ? 'sm:col-span-2' : 'sm:col-span-1'}`}>
                                    <label className="text-[8px] text-slate-500 uppercase ml-1 block mb-1">{polje.label}</label>
                                    <div className="w-full h-full min-h-[45px]">{renderPoljeHeader(polje)}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* LISTA STAVKI / ODABIR SA LAGER */}
                    <div className="bg-theme-card p-4 sm:p-6 rounded-box border border-theme-border/60 shadow-xl w-full">
                        <h3 className="text-orange-500 font-black uppercase text-xs mb-3">2. Robni sadržaj isporuke</h3>
                        {isSlobodnaProdaja ? (
                            <button onClick={otvoriLagerZaSlobodnuProdaju} className="w-full py-5 bg-orange-600/10 border-2 border-dashed border-orange-500 text-orange-400 font-black rounded-xl uppercase text-xs hover:bg-orange-500 hover:text-white transition-all shadow-md">
                                📦 Klikni ovdje za odabir slobodnih paketa sa zaliha
                            </button>
                        ) : (
                            <div className="space-y-4">
                                <MasterSearch data={katalog} poljaZaPretragu={['sifra', 'naziv']} value={stavkaForm.sifra_unos} onSelect={(k) => { setTrenutniProizvod(k); setStavkaForm({ ...stavkaForm, id: null, sifra_unos: `${k.sifra} | ${k.naziv}`, jm_obracun: k.default_jedinica || 'm3' }); }} placeholder="Dodaj vanrednu stavku..." />
                                {trenutniProizvod && (
                                    <div className="p-4 bg-theme-panel border border-theme-border rounded-xl space-y-3 animate-in zoom-in-95">
                                        <div className="flex flex-col sm:flex-row gap-3"><input type="number" value={stavkaForm.kolicina_obracun} onChange={e=>setStavkaForm({...stavkaForm, kolicina_obracun:e.target.value})} placeholder="Količina..." className="flex-1 p-3 bg-black text-white font-black text-center rounded-xl outline-none border border-theme-border" /><select value={stavkaForm.jm_obracun} onChange={e=>setStavkaForm({...stavkaForm, jm_obracun:e.target.value})} className="w-24 p-3 bg-black text-white font-black rounded-xl outline-none"><option value="m3">m³</option><option value="kom">kom</option></select></div>
                                        <button onClick={dodajStavku} className="w-full py-3 bg-orange-600 text-white text-xs uppercase font-black rounded-xl">Dodaj na dokument</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* PREGLED I SNIMANJE */}
                    {stavke.length > 0 && (
                        <div className="bg-theme-card p-4 sm:p-6 rounded-box border border-theme-border shadow-2xl space-y-4 animate-in fade-in">
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Stavke spremne za otpremu:</span>
                            <div className="space-y-2">
                                {stavke.map((s, i) => (
                                    <div key={s.id} className={`flex justify-between items-center p-3 rounded-xl border border-theme-border/60 ${s.paket_id ? 'bg-orange-950/20 border-orange-500/40' : 'bg-theme-panel'}`}>
                                        <div className="flex items-center gap-3"><span className="text-slate-500 text-xs">{i+1}.</span><div><p className="text-theme-text text-xs font-black">{s.naziv}</p><p className="text-[9px] text-slate-500 mt-0.5">{s.sifra} {s.paket_id && `| 📦 PAKET: ${s.paket_id}`}</p></div></div>
                                        <div className="flex items-center gap-4"><span className="text-orange-400 font-black text-base">{s.kolicina_obracun} {s.jm_obracun}</span><button onClick={()=>ukloniStavku(s.id)} className="text-red-500 p-2 text-xs">✕</button></div>
                                    </div>
                                ))}
                            </div>
                            <textarea value={form.napomena} onChange={e=>setForm({...form, napomena:e.target.value})} placeholder="Unesite internu napomenu za isporuku..." className="w-full p-4 bg-theme-panel border border-theme-border rounded-xl text-xs text-theme-text outline-none focus:border-orange-500 shadow-inner" rows="2" />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                <button onClick={kreirajIzdatnicu} disabled={isSlobodnaProdaja} className="w-full py-4 bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl text-xs uppercase tracking-wider">📦 Generiši Nalog za utovar (Izdatnica)</button>
                                <button onClick={snimiOtpremnicu} className="w-full py-4 bg-orange-600 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md">🏁 ZAVRŠI I SNIMI OTPREMNICU</button>
                            </div>
                        </div>
                    )}
                </div>
            ) : tab === 'izdatnice' ? (
                // WMS MODUL ZA SKLADIŠTE (Skeniranje i korekcije na terenu)
                <div className="bg-theme-card p-4 sm:p-6 rounded-box border border-theme-border shadow-xl max-w-4xl mx-auto w-full">
                    {wmsIzdatnica ? (
                        <div className="space-y-4 animate-in zoom-in-95">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-theme-border pb-4 gap-2">
                                <div><button onClick={()=>setWmsIzdatnica(null)} className="text-[9px] uppercase bg-slate-800 text-slate-400 px-3 py-1.5 rounded-lg mb-2 block">← Vrati se nazad</button><h2 className="text-2xl text-amber-500 font-black">{wmsIzdatnica.broj_izdatnice}</h2></div>
                                <div className="text-left sm:text-right"><span className="bg-amber-900/30 text-amber-500 border border-amber-500/30 px-3 py-1 rounded-xl text-[10px] font-black uppercase">Utovar na kamionu</span></div>
                            </div>
                            <div className="space-y-2">
                                {wmsStavke.map(s => (
                                    <div key={s.id} className="bg-theme-panel p-4 rounded-xl border border-theme-border flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                        <div><p className="text-theme-text text-sm font-black uppercase">{s.proizvod_naziv}</p><p className="text-[10px] text-slate-500 mt-1">Šifra artikla: {s.proizvod_sifra}</p></div>
                                        <div className="flex items-center gap-4 justify-between sm:justify-end w-full sm:w-auto border-t sm:border-none pt-2 sm:pt-0">
                                            <div className="text-center"><p className="text-[8px] text-slate-500 uppercase font-black mb-1">Plan</p><p className="text-slate-400 font-bold text-sm">{s.planirana_kolicina} {s.mjerna_jedinica}</p></div>
                                            <div className="text-center"><p className="text-[8px] text-amber-500 uppercase font-black mb-1">Utovareno</p><input type="number" value={s.izdata_kolicina} onChange={(e) => handleWmsKolicina(s.id, e.target.value)} className="w-20 p-2 bg-black text-amber-400 border border-amber-500/50 rounded-xl text-center font-black" /></div>
                                            <button onClick={() => obrisiWmsStavku(s.id)} className="text-red-500 hover:bg-red-500/20 p-3 rounded-xl transition-all font-black ml-2">✕</button>
                                        </div>
                                    </div>
                                ))}
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
                                    <input type="number" value={wmsNovaKol} onChange={e=>setWmsNovaKol(e.target.value)} placeholder="Kol" className="w-24 p-4 bg-theme-card rounded-xl text-theme-text font-black text-center border border-theme-border outline-none focus:border-blue-500" />
                                    <button onClick={dodajWmsStavkuNovu} className="bg-blue-600 text-white px-5 rounded-xl font-black uppercase text-[10px]">Dodaj</button>
                                </div>
                            </div>
                            <button onClick={zavrsiIPotvrdiUtovar} className="w-full py-5 bg-emerald-600 text-white font-black rounded-xl uppercase text-xs tracking-widest mt-4 shadow-lg">✅ ZAVRŠI I POTVRDI UTOVAR SVE ROBE</button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="w-full">
                                <label className="text-[10px] text-slate-500 uppercase font-black mb-2 block">Skeniraj QR Kod ili unesi broj sa utovarnog lista:</label>
                                <div className="relative">
                                    <input type="text" value={pretragaWms} onChange={e => setPretragaWms(e.target.value.toUpperCase())} placeholder="Pretraži aktivne utovare..." className="w-full p-4 bg-theme-panel border border-theme-border rounded-xl text-theme-text outline-none focus:border-amber-500 pr-16 text-xs" />
                                    <button onClick={() => { setScanTarget('wms'); setIsScanningOverlay(true); }} className="absolute right-2 top-2 bottom-2 px-4 bg-amber-600 rounded-xl text-white font-bold hover:bg-amber-500 transition-all text-xl shadow-md">📷</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                                {izdatnice.filter(i => i.broj_izdatnice.includes(pretragaWms) || i.kupac_naziv.toUpperCase().includes(pretragaWms)).map(izd => (
                                    <div key={izd.id} className="bg-theme-panel border border-theme-border p-4 rounded-xl shadow-sm hover:border-amber-500 transition-all flex flex-col justify-between">
                                        <div className="border-b border-slate-700 pb-2 mb-2"><p className="text-theme-accent font-mono text-base font-black">{izd.broj_izdatnice}</p><p className="text-theme-text text-[11px] font-black uppercase mt-1 break-words line-clamp-1">{izd.kupac_naziv}</p></div>
                                        <div className="flex justify-between items-center text-[9px] text-slate-500 uppercase font-bold mb-3"><span>Izvor: {izd.izvor_id || 'RUČNO'}</span><span>{formatirajDatum(izd.created_at)}</span></div>
                                        <div className="flex gap-2 mt-auto">{izd.status === 'utovareno' ? <button onClick={() => { skenirajVezu(izd.broj_izdatnice); setTab('nova'); }} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg text-[9px] uppercase tracking-wider">📑 Fakturiši</button> : <button onClick={() => otvoriWmsUtovar(izd)} className="w-full py-2.5 bg-amber-600/20 border border-amber-500/30 text-amber-400 font-black rounded-lg text-[9px] uppercase tracking-wider hover:bg-amber-500 hover:text-black">🚚 Pokreni utovar</button>}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                // ARHIVA OTPREMNICA
                <div className="bg-theme-card p-4 sm:p-6 rounded-box border border-theme-border shadow-2xl animate-in slide-in-from-right w-full">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {otpremnice.map(o => (
                            <div key={o.id} onClick={() => pokreniIzmjenu(o)} className="p-4 bg-theme-panel border border-theme-border rounded-xl hover:border-emerald-500 transition-all cursor-pointer shadow-md flex flex-col justify-between">
                                <div className="flex justify-between items-start border-b border-slate-700 pb-2 mb-2"><div className="min-w-0 flex-1"><p className="text-emerald-500 font-black text-sm">{o.id}</p><p className="text-theme-text text-[10px] font-black uppercase mt-1 truncate">{o.kupac_naziv}</p></div><span className="bg-slate-800 text-slate-400 border border-slate-600 text-[8px] px-2 py-0.5 rounded font-black uppercase shadow-inner h-fit shrink-0 ml-2">{o.status}</span></div>
                                <div className="flex justify-between items-center text-[9px] text-slate-500 uppercase font-bold mt-2"><span>Kamion: {o.registracija || 'N/A'}</span><button onClick={(e)=>{e.stopPropagation(); setForm(o); setStavke(o.stavke_jsonb||[]); setTimeout(() => kreirajPDFPrivremeni(o), 100);}} className="text-emerald-400 font-black px-3 py-1 rounded bg-emerald-950/40 hover:bg-emerald-600 hover:text-white border border-emerald-500/20 transition-all shadow-sm">PDF 🖨️</button></div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* USMJERAVANJE SKENERA ZAVISNO OD TOGA ŠTA JE PRITISNUTO */}
            {isScanningOverlay && <ScannerOverlay onScan={(text) => { 
                if (scanTarget === 'lager') {
                    setPretragaLagera(text.toUpperCase());
                } else if (scanTarget === 'wms') {
                    setPretragaWms(text.toUpperCase());
                    const ekspresna = izdatnice.find(i => i.broj_izdatnice === text.toUpperCase());
                    if (ekspresna) otvoriWmsUtovar(ekspresna);
                } else {
                    skenirajVezu(text); 
                }
                setIsScanningOverlay(false); 
            }} onClose={() => setIsScanningOverlay(false)} />}
        </div>
    );
}