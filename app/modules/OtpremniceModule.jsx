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
    
    // LAGER MODAL I DJELIMIČNO UZIMANJE
    const [dostupniPaketiLager, setDostupniPaketiLager] = useState([]);
    const [prikaziLagerModal, setPrikaziLagerModal] = useState(false);
    const [pretragaLagera, setPretragaLagera] = useState('');
    const [samoSlobodnoFilter, setSamoSlobodnoFilter] = useState(true);
    
    const [paketModal, setPaketModal] = useState({ isOpen: false, paket: null, isWms: false });
    const [djelimicnaKolicina, setDjelimicnaKolicina] = useState('');
    const [djelimicnaJm, setDjelimicnaJm] = useState('m3');

    const [dostupniDokumenti, setDostupniDokumenti] = useState([]);
    
    const [isScanningOverlay, setIsScanningOverlay] = useState(false);
    const [scanTarget, setScanTarget] = useState('');
    const [pretragaWms, setPretragaWms] = useState('');
    
    const [dialog, setDialog] = useState({ isOpen: false });
    const prikaziDialog = (opcije) => setDialog({ isOpen: true, confirmText: 'POTVRDI', cancelText: 'ZATVORI', ...opcije });
    const zatvoriDialog = () => setDialog({ isOpen: false });

    const [stavkaForm, setStavkaForm] = useState({ id: null, sifra_unos: '', kolicina_obracun: '', jm_obracun: 'm3' });
    const [trenutniProizvod, setTrenutniProizvod] = useState(null);
    const [prosirenaIzdatnicaId, setProsirenaIzdatnicaId] = useState(null);
    const [ucitaneStavkeIzdatnice, setUcitaneStavkeIzdatnice] = useState([]);
    const [wmsIzdatnica, setWmsIzdatnica] = useState(null); 
    const [wmsStavke, setWmsStavke] = useState([]); 

    useEffect(() => { load(); }, []);

    useEffect(() => {
        const autoId = localStorage.getItem('erp_auto_open_id');
        const autoAction = localStorage.getItem('erp_auto_action');
        if (autoId && autoAction === 'nova' && dostupniDokumenti.length > 0) {
            obradiSkeniraniKod(autoId);
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

    const zapisiU_Log = async (akcija, detalji, nivo = 'INFO') => { 
        await supabase.from('sistem_audit_log').insert([{ korisnik: currentUser.ime_prezime || 'Nepoznat', akcija, detalji, nivo_alarma: nivo, pregledano: false }]); 
    };

    // 🟢 PAMETNI SKENER (Učitava dokumente ILI pakete)
    const obradiSkeniraniKod = async (kodRaw, isWmsContext = false) => {
        const kod = (kodRaw || '').toUpperCase().trim();
        if(!kod) return;
        
        // Da li je ovo paket?
        const { data: paket } = await supabase.from('paketi').select('*').eq('paket_id', kod).is('otpremnica_id', null).maybeSingle();
        if (paket) {
            setPaketModal({ isOpen: true, paket, isWms: isWmsContext });
            return;
        }

        // Ako nije paket, idemo klasično na učitavanje dokumenta (RN, PON, IZD)
        if (isWmsContext) return prikaziDialog({ tip: 'greska', naslov: 'Nepoznat Kod', poruka: "Skenirani kod ne pripada dostupnom paketu sa lagera.", onCancel: zatvoriDialog });
        
        const { data: postojeceOtpData } = await supabase.from('otpremnice').select('*').eq('broj_veze', kod).limit(1);
        if (postojeceOtpData && postojeceOtpData.length > 0) {
            const otp = postojeceOtpData[0];
            const { data: racun } = await supabase.from('racuni').select('id').eq('broj_veze', otp.id).limit(1);
            return prikaziDialog({
                tip: 'upozorenje', naslov: 'Otpremnica već postoji!', poruka: `Za ovaj nalog je već izdata otpremnica ${otp.id}.`,
                confirmText: '🖨️ Isprintaj PDF', cancelText: '✏️ Uredi',
                onConfirm: () => { setForm(otp); setStavke(otp.stavke_jsonb); setTimeout(() => kreirajPDFPrivremeni(otp), 300); zatvoriDialog(); },
                onCancel: () => { if (racun && racun.length > 0) prikaziDialog({ tip: 'greska', naslov: 'Zabranjeno', poruka: 'Izdat račun. Mijenjanje zabranjeno.', onCancel: zatvoriDialog }); else { pokreniIzmjenu(otp); zatvoriDialog(); } }
            });
        }

        let dokument = null; let prepravljeneStavke = [];

        if (kod.startsWith('PON-')) {
            const { data: ponuda } = await supabase.from('ponude').select('*').eq('id', kod).maybeSingle();
            if(!ponuda) return prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: `Ponuda nije pronađena!`, onCancel: zatvoriDialog });
            dokument = ponuda; prepravljeneStavke = (dokument.stavke_jsonb || []).map(s => ({ id: Math.random().toString(), sifra: s.sifra, naziv: s.naziv, kolicina_obracun: s.kolicina_obracun, jm_obracun: s.jm_obracun }));
        } 
        else if (kod.startsWith('RN-')) {
            const { data: nalog } = await supabase.from('radni_nalozi').select('*').eq('id', kod).maybeSingle();
            if(!nalog) return prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: `Radni nalog nije pronađen!`, onCancel: zatvoriDialog });
            dokument = nalog; prepravljeneStavke = (dokument.stavke_jsonb || []).map(s => ({ id: Math.random().toString(), sifra: s.sifra, naziv: s.naziv, kolicina_obracun: s.kolicina_obracun, jm_obracun: s.jm_obracun }));
        } 
        else if (kod.startsWith('IZD-')) {
            const { data: izdatnica } = await supabase.from('izdatnice').select('*').eq('broj_izdatnice', kod).maybeSingle();
            if(!izdatnica) return prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: `Izdatnica nije pronađena!`, onCancel: zatvoriDialog });
            if (izdatnica.status !== 'utovareno') return prikaziDialog({ tip: 'upozorenje', naslov: 'Utovar Nije Završen', poruka: `Sačekajte da skladište potvrdi utovar prije kreiranja Otpremnice!`, onCancel: zatvoriDialog }); 
            const { data: izdStavke } = await supabase.from('izdatnice_stavke').select('*').eq('izdatnica_id', izdatnica.id);
            dokument = izdatnica; prepravljeneStavke = (izdStavke || []).map(s => ({ id: Math.random().toString(), sifra: s.proizvod_sifra, naziv: s.proizvod_naziv, kolicina_obracun: s.izdata_kolicina > 0 ? s.izdata_kolicina : s.planirana_kolicina, jm_obracun: s.mjerna_jedinica }));
        } 
        else { return prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: "Nepoznat format koda.", onCancel: zatvoriDialog }); }

        setForm({ ...form, kupac_naziv: dokument.kupac_naziv, broj_veze: kod, napomena: dokument.napomena || '' });
        setStavke(prepravljeneStavke); 
        prikaziDialog({ tip: 'uspjeh', naslov: 'Učitano', poruka: `✅ Preuzeti podaci iz: ${kod}`, onCancel: zatvoriDialog });
    };

    // 🟢 OTVARANJE LAGER MODALA
    const otvoriLagerZaDodavanje = async () => {
        const { data, error } = await supabase.from('paketi').select('*').not('closed_at', 'is', null).is('otpremnica_id', null).order('created_at', { ascending: false });
        if (error) return alert("Greška pri učitavanju lagera.");
        
        const vecDodaniPaketi = stavke.map(s => s.originalni_paket?.paket_id || s.paket_id).filter(Boolean);
        setDostupniPaketiLager((data || []).filter(p => !vecDodaniPaketi.includes(p.paket_id)));
        setPrikaziLagerModal(true);
    };

    // 🟢 RASTURANJE ILI CIJELI PAKET
    const izvrsiDodavanjePaketa = (isPartial) => {
        const { paket, isWms } = paketModal;
        const kolicinaUnos = parseFloat(djelimicnaKolicina);
        const kolicinaFinalna = isPartial ? kolicinaUnos : paket.kolicina_final;
        const jmFinalna = isPartial ? djelimicnaJm : 'm3';

        if (isPartial && (!kolicinaUnos || isNaN(kolicinaUnos))) return alert("Unesite ispravnu količinu!");
        
        const kat = katalog.find(k => k.naziv === paket.naziv_proizvoda || k.sifra === paket.naziv_proizvoda);
        
        if (isWms) {
            // Dodavanje na WMS Izdatnicu
            const noviId = `novo_paket_${Date.now()}`;
            setWmsStavke([...wmsStavke, { 
                id: noviId, izdatnica_id: wmsIzdatnica.id, proizvod_sifra: kat ? kat.sifra : 'NEPOZNATO', 
                proizvod_naziv: paket.naziv_proizvoda, planirana_kolicina: 0, 
                izdata_kolicina: kolicinaFinalna, mjerna_jedinica: jmFinalna,
                is_partial: isPartial, paket_ref_id: paket.paket_id, original_paket: paket
            }]);
        } else {
            // Dodavanje na Novu Otpremnicu
            const novaStavka = {
                id: Math.random().toString(),
                paket_id: isPartial ? `${paket.paket_id} (DIO)` : paket.paket_id,
                originalni_paket_id: paket.paket_id,
                is_partial: isPartial,
                sifra: kat ? kat.sifra : 'NEPOZNATO',
                naziv: paket.naziv_proizvoda,
                kolicina_obracun: kolicinaFinalna,
                jm_obracun: jmFinalna,
                originalni_paket: paket
            };
            setStavke([...stavke, novaStavka]);
        }

        setDostupniPaketiLager(dostupniPaketiLager.filter(p => p.id !== paket.id));
        setPaketModal({ isOpen: false, paket: null, isWms: false });
        setPrikaziLagerModal(false);
        setDjelimicnaKolicina('');
    };

    const dodajStavkuRucno = () => {
        if(!trenutniProizvod || !stavkaForm.kolicina_obracun) return;
        const novaStavka = { id: stavkaForm.id || Math.random().toString(), sifra: trenutniProizvod.sifra, naziv: trenutniProizvod.naziv, kolicina_obracun: parseFloat(stavkaForm.kolicina_obracun), jm_obracun: stavkaForm.jm_obracun };
        if (stavkaForm.id) setStavke(stavke.map(s => s.id === stavkaForm.id ? novaStavka : s)); else setStavke([...stavke, novaStavka]);
        setStavkaForm({ id: null, sifra_unos: '', kolicina_obracun: '', jm_obracun: 'm3' }); setTrenutniProizvod(null);
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
        const htmlSadrzajTabela = `<div class="info-grid" style="margin-bottom: 30px; border-bottom: 2px solid #f59e0b; padding-bottom: 20px;"><div class="info-col"><h4 style="color:#f59e0b; font-size: 14px; margin-bottom:10px; letter-spacing:1px;">NALOG ZA UTOVAR</h4><p style="font-size: 16px; font-weight: 900; margin-bottom: 5px; color:#0f172a;">Kupac: <span style="font-size: 20px;">${kupacNaziv}</span></p><p style="font-size: 12px; font-weight: 400; color: #475569;">Adresa: ${odabraniKupac?.adresa || 'N/A'}</p></div><div class="info-col" style="text-align: right;"><p style="font-size: 12px; margin-bottom:5px;">Izvor naloga: <span style="font-weight: 600; color: #0f172a;">${izvorId || 'MJEŠOVITI UNOS'}</span></p><p style="font-size: 12px;">Status: <span style="font-weight: 900; color: #f59e0b; padding: 4px 8px; background-color: #fffbeb; border-radius: 4px;">ČEKA UTOVAR</span></p></div></div><div style="text-align: right; margin-top: -80px; margin-bottom: 20px;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${izdId}" alt="QR Kod" style="border: 2px solid #f8fafc; border-radius: 4px;" /></div><table style="width: 100%; border-collapse: collapse;"><thead><tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;"><th style="width: 5%; text-align: center; padding: 10px;">R.B.</th><th style="text-align: left; padding: 10px; font-size: 12px;">ŠIFRA I NAZIV PROIZVODA</th><th style="text-align:center; padding: 10px; font-size: 12px; background-color:#fef3c7;">PLANIRANO</th><th style="text-align:center; width:25%; padding: 10px; font-size: 12px;">STVARNO UTOVARENO</th></tr></thead><tbody>${redovi}</tbody></table><div style="margin-top: 40px; padding: 15px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 8px;"><b style="color: #0f172a; font-size:12px;">Napomena / Instrukcija:</b><br/><span style="font-size: 12px; color: #475569;">${napomena || 'Pažljivo provjeriti količine.'}</span></div>`;
        printDokument('IZDATNICA', izdId, formatirajDatum(datumIzd), htmlSadrzajTabela, '#f59e0b');
    };

    const kreirajIzdatnicu = async () => {
        if(!form.kupac_naziv || stavke.length === 0) return prikaziDialog({ tip: 'upozorenje', naslov: 'Podaci Obavezni', poruka: "Unesite kupca i stavke!", onCancel: zatvoriDialog });
        const brojIzd = `IZD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const { data: izdData } = await supabase.from('izdatnice').insert([{ broj_izdatnice: brojIzd, kupac_naziv: form.kupac_naziv, status: 'u_pripremi', izvor_tip: form.broj_veze ? 'veza' : 'rucno', izvor_id: form.broj_veze, napomena: form.napomena, kreirao_korisnik: currentUser.ime_prezime }]).select().single();
        if(izdData) {
            const stavkePayload = stavke.map(s => ({ izdatnica_id: izdData.id, proizvod_sifra: s.sifra, proizvod_naziv: s.naziv, planirana_kolicina: s.kolicina_obracun, mjerna_jedinica: s.jm_obracun }));
            await supabase.from('izdatnice_stavke').insert(stavkePayload);
            stampajIzdatnicu(brojIzd, form.kupac_naziv, form.broj_veze, new Date().toISOString(), form.napomena, stavkePayload);
            resetFormu(); load(); setTab('izdatnice');
        }
    };

    const otvoriWmsUtovar = async (izd) => {
        const { data } = await supabase.from('izdatnice_stavke').select('*').eq('izdatnica_id', izd.id);
        setWmsIzdatnica(izd); setWmsStavke((data || []).map(s => ({ ...s, izdata_kolicina: parseFloat(s.izdata_kolicina) > 0 ? s.izdata_kolicina : s.planirana_kolicina })));
    };

    const obrisiWmsStavku = (id) => setWmsStavke(wmsStavke.filter(s => s.id !== id));

    // 🟢 ZAVRŠETAK WMS UTOVARA SA AŽURIRANJEM PAKETA
    const zavrsiIPotvrdiUtovar = async () => {
        prikaziDialog({
            tip: 'info', naslov: 'Potvrda Utovara', poruka: 'Želite li potvrditi unesene količine?',
            onConfirm: async () => {
                const zaInsert = []; const zaUpdate = [];
                let odstupanjeText = [];
                
                // Procesuiranje stavki i ažuriranje lagera ako je povučen gotov paket
                for (let s of wmsStavke) {
                    const izdata = parseFloat(s.izdata_kolicina) || 0;
                    const planirana = parseFloat(s.planirana_kolicina) || 0;
                    if (izdata !== planirana) odstupanjeText.push(`${s.proizvod_sifra} (Planirano: ${planirana} ➔ Utovareno: ${izdata})`);
                    
                    const payload = { izdatnica_id: wmsIzdatnica.id, proizvod_sifra: s.proizvod_sifra, proizvod_naziv: s.proizvod_naziv, planirana_kolicina: planirana, izdata_kolicina: izdata, mjerna_jedinica: s.mjerna_jedinica };
                    if(String(s.id).startsWith('novo_')) zaInsert.push(payload); else zaUpdate.push({ ...payload, id: s.id });

                    // Ažuriranje paketa odmah na izdatnici!
                    if (s.is_partial && s.original_paket) {
                        const newKolM3 = Math.max(0, parseFloat(s.original_paket.kolicina_final) - izdata);
                        await supabase.from('paketi').update({ kolicina_final: newKolM3 }).eq('paket_id', s.original_paket.paket_id);
                        await zapisiU_Log('PAKET_RASTUREN', `Iz paketa ${s.original_paket.paket_id} izuzeto ${izdata} ${s.mjerna_jedinica} za nalog ${wmsIzdatnica.broj_izdatnice}`);
                    } else if (!s.is_partial && s.original_paket) {
                        // Oznaci ga kao utovarenog (rezervisan), na otpremnici će se trajno otpisati
                        await supabase.from('paketi').update({ broj_veze: wmsIzdatnica.broj_izdatnice }).eq('paket_id', s.original_paket.paket_id);
                    }
                }
                
                if(zaInsert.length > 0) await supabase.from('izdatnice_stavke').insert(zaInsert);
                if(zaUpdate.length > 0) await supabase.from('izdatnice_stavke').upsert(zaUpdate);
                await supabase.from('izdatnice').update({ status: 'utovareno' }).eq('id', wmsIzdatnica.id);
                
                if (odstupanjeText.length > 0) await zapisiU_Log('ODSTUPANJE_UTOVAR_WMS', `Skladištar prijavio odstupanje za nalog ${wmsIzdatnica.broj_izdatnice}: ${odstupanjeText.join(', ')}`, 'ŽUTO');
                else await zapisiU_Log('UTOVAR_ZAVRSEN', `Nalog ${wmsIzdatnica.broj_izdatnice} potvrdio: ${currentUser.ime_prezime}`);
                
                setWmsIzdatnica(null); load(); zatvoriDialog(); 
            },
            onCancel: zatvoriDialog
        });
    };

    // 🟢 SNIMANJE OTPREMNICE
    const snimiOtpremnicu = async () => {
        if(!form.kupac_naziv || stavke.length === 0) return prikaziDialog({ tip: 'upozorenje', naslov: 'Podaci Obavezni', poruka: "Unesite kupca i stavke!", onCancel: zatvoriDialog });

        let detektovanoOdstupanje = false; let diffDetails = [];

        if (form.broj_veze && form.broj_veze.startsWith('IZD-')) {
            const { data: izd } = await supabase.from('izdatnice').select('id').eq('broj_izdatnice', form.broj_veze).maybeSingle();
            if (izd) {
                const { data: izdStavke } = await supabase.from('izdatnice_stavke').select('*').eq('izdatnica_id', izd.id);
                (izdStavke || []).forEach(og => {
                    const curr = stavke.find(s => s.sifra === og.proizvod_sifra);
                    const origKol = parseFloat(og.izdata_kolicina) > 0 ? parseFloat(og.izdata_kolicina) : parseFloat(og.planirana_kolicina);
                    if (!curr) { detektovanoOdstupanje = true; diffDetails.push(`Uklonjeno: ${og.proizvod_sifra} (Bilo: ${origKol})`); } 
                    else if (parseFloat(curr.kolicina_obracun) !== origKol) { detektovanoOdstupanje = true; diffDetails.push(`Izmjena za ${og.proizvod_sifra}: sa ${origKol} na ${curr.kolicina_obracun}`); }
                });
            }
        }

        const izvrsiSnimanje = async () => {
            const upisniId = form.id.toUpperCase();
            const payload = { id: upisniId, broj_veze: form.broj_veze, kupac_naziv: form.kupac_naziv, datum: form.datum, vozac: form.vozac, registracija: form.registracija, napomena: form.napomena, stavke_jsonb: stavke, status: 'KREIRANA', snimio_korisnik: currentUser.ime_prezime };
            
            if (isEditing) await supabase.from('otpremnice').update(payload).eq('id', form.id);
            else await supabase.from('otpremnice').insert([payload]);

            if (detektovanoOdstupanje) await zapisiU_Log('ALARM_ODSTUPANJE_OTPREMNICE', `Faktura/Otpremnica ${upisniId} odstupila od utovara: ${diffDetails.join(' | ')}`, 'CRVENO');
            else await zapisiU_Log('IZMJENA_OTPREMNICE', `Snimljena otpremnica ${upisniId}`);

            // 🟢 AŽURIRANJE LAGERA (RASTURANJE ILI CIJELI PAKETI)
            for (let s of stavke) {
                if (s.is_partial && s.original_paket_id) {
                    // Djelimično uzimanje sa same otpremnice
                    const pkt = s.originalni_paket;
                    const newKolM3 = Math.max(0, parseFloat(pkt.kolicina_final) - parseFloat(s.kolicina_obracun));
                    await supabase.from('paketi').update({ kolicina_final: newKolM3 }).eq('paket_id', s.original_paket_id);
                    await zapisiU_Log('PAKET_RASTUREN', `Iz paketa ${s.original_paket_id} izuzeto ${s.kolicina_obracun} ${s.jm_obracun} direktno na Otpremnici ${upisniId}`);
                } else if (s.original_paket_id) {
                    // Preuzet cijeli paket, skini ga trajno
                    await supabase.from('paketi').update({ otpremnica_id: upisniId }).eq('paket_id', s.original_paket_id);
                }
            }

            // Ako je učitan RN, skini njegove originalne pakete
            if (form.broj_veze) {
                let pId = form.broj_veze;
                if (pId.startsWith('IZD-')) {
                    const {data: zIzd} = await supabase.from('izdatnice').select('izvor_id').eq('broj_izdatnice', pId).maybeSingle();
                    if (zIzd && zIzd.izvor_id) pId = zIzd.izvor_id;
                }
                await supabase.from('paketi').update({ otpremnica_id: upisniId }).eq('broj_veze', pId).is('otpremnica_id', null);
            }

            resetFormu(); load(); setTab('lista');
            prikaziDialog({ tip: 'uspjeh', naslov: 'Uspješno snimljeno', poruka: "Otpremnica prohodna i sačuvana! Štampati PDF?", confirmText: '🖨️ ŠTAMPAJ PDF', cancelText: 'ZATVORI', onConfirm: () => { kreirajPDFPrivremeni(payload); zatvoriDialog(); }, onCancel: zatvoriDialog });
        };

        if (detektovanoOdstupanje) {
            prikaziDialog({
                tip: 'upozorenje', naslov: '⚠️ ODSTUPANJE!', poruka: `Količine se ne slažu sa skladištem! Sistem će poslati alarm Superadminu. Nastaviti?`, confirmText: '🚀 DA, SNIMI OTPREMNICU', cancelText: '✕ KORIGUJ', onConfirm: () => { zatvoriDialog(); izvrsiSnimanje(); }, onCancel: zatvoriDialog
            });
        } else { await izvrsiSnimanje(); }
    };

    const kreirajPDFPrivremeni = async (podaci) => {
        let parentId = podaci.broj_veze;
        if (parentId && parentId.startsWith('IZD-')) {
            const {data: izd} = await supabase.from('izdatnice').select('izvor_id').eq('broj_izdatnice', parentId).maybeSingle();
            if (izd && izd.izvor_id) parentId = izd.izvor_id;
        }
        
        let paketiPrikaz = {};
        if (parentId) {
            const { data: paks } = await supabase.from('paketi').select('paket_id, naziv_proizvoda').eq('broj_veze', parentId);
            if (paks) { paks.forEach(p => { if (!paketiPrikaz[p.naziv_proizvoda]) paketiPrikaz[p.naziv_proizvoda] = []; paketiPrikaz[p.naziv_proizvoda].push(p.paket_id); }); }
        }

        const odabraniKupac = kupci.find(k => k.naziv === podaci.kupac_naziv) || null;
        let redovi = (podaci.stavke_jsonb || stavke).map((s, i) => {
            const kat = katalog.find(k => k.sifra === s.sifra);
            const dimenzije = kat ? `${kat.visina}x${kat.sirina}x${kat.duzina}` : '';
            let paketiStr = '';
            if (s.paket_id) paketiStr = `<br/><span style="color: #3b82f6; font-size: 10px; font-weight: bold;">📦 Paket: ${s.paket_id}</span>`;
            else if (paketiPrikaz[s.naziv] && paketiPrikaz[s.naziv].length > 0) paketiStr = `<br/><span style="color: #3b82f6; font-size: 10px; font-weight: bold;">📦 Sadrži pakete: ${paketiPrikaz[s.naziv].join(', ')}</span>`;
            
            return `<tr><td style="font-weight: bold; color: #64748b; text-align: center;">${i+1}.</td><td><b style="color: #0f172a; font-size: 14px;">${dimenzije ? `${dimenzije} | ` : ''}${s.naziv}</b><br/><span style="color: #64748b; font-size: 11px;">Šifra: ${s.sifra}</span>${paketiStr}</td><td style="text-align: center; font-size: 18px; font-weight: 900; color: #f97316;">${s.kolicina_obracun} <span style="color: #64748b; font-size: 12px; font-weight: 600;">${s.jm_obracun}</span></td></tr>`
        }).join('');

        const htmlSadrzajTabela = `<div class="info-grid"><div class="info-col"><h4>Kupac / Primalac robe</h4><p style="font-size: 18px; font-weight: 900; margin-bottom: 5px;">${podaci.kupac_naziv}</p><p style="font-weight: 400; color: #475569;">${odabraniKupac?.adresa || ''}</p><p style="font-weight: 600; color: #0f172a; font-size: 12px; margin-top: 6px;">PDV / ID: ${odabraniKupac?.pdv_broj || 'N/A'}</p></div><div class="info-col" style="text-align: right;"><h4>Detalji Transporta</h4><p>Vezni Dokument: <span style="font-weight: 600; color: #0f172a;">${podaci.broj_veze || '-'}</span></p><p>Ime Vozača: <span style="font-weight: 600; color: #0f172a;">${podaci.vozac || '-'}</span></p><p>Vozilo (Reg): <span style="font-weight: 900; color: #f97316;">${podaci.registracija || '-'}</span></p></div></div><table><thead><tr><th style="width: 5%; text-align: center;">R.B.</th><th>Dimenzija i Naziv Proizvoda</th><th style="text-align:center;">Isporučena Količina</th></tr></thead><tbody>${redovi}</tbody></table><div style="display: flex; justify-content: space-between; margin-top: 100px; text-align: center; color: #0f172a; font-weight: 600;"><div style="width: 25%;"><div style="border-bottom: 1px solid #94a3b8; margin-bottom: 10px; height: 20px;"></div>Isporučio (Vozač)</div><div style="width: 25%;"><div style="border-bottom: 1px solid #94a3b8; margin-bottom: 10px; height: 20px;"></div>Izdao (Magacin)</div><div style="width: 25%;"><div style="border-bottom: 1px solid #94a3b8; margin-bottom: 10px; height: 20px;"></div>Primio (Kupac)</div></div><div class="footer"><div style="width: 100%;"><b style="color: #0f172a;">Napomena uz isporuku:</b><br/>${podaci.napomena || 'Roba isporučena bez oštećenja.'}</div></div>`;
        printDokument('OTPREMNICA', podaci.id, formatirajDatum(podaci.datum), htmlSadrzajTabela, '#f97316');
    };

    const pokreniIzmjenu = (o) => { setForm({ id: o.id, broj_veze: o.broj_veze || '', kupac_naziv: o.kupac_naziv, datum: o.datum, vozac: o.vozac || '', registracija: o.registracija || '', napomena: o.napomena || '', status: o.status || 'KREIRANA' }); setStavke(o.stavke_jsonb || []); setIsEditing(true); setTab('nova'); };
    const resetFormu = () => { setForm({ id: generisiID(), broj_veze: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0], vozac: '', registracija: '', napomena: '', status: 'KREIRANA' }); setStavke([]); setIsEditing(false); };

    const renderPoljeHeader = (polje) => {
        if (polje.id === 'veza') return <input value={form.broj_veze} onChange={e=>setForm({...form, broj_veze:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-theme-card rounded-xl text-theme-text outline-none border border-theme-border focus:border-orange-500" placeholder="Nema veznog dokumenta" />;
        if (polje.id === 'broj') return <input value={form.id} disabled className="w-full h-full min-h-[45px] p-4 bg-theme-panel rounded-xl text-theme-text border border-theme-border font-black disabled:opacity-50" />;
        if (polje.id === 'kupac') return <div className="h-full min-h-[45px]"><MasterSearch data={kupci} poljaZaPretragu={['naziv']} value={form.kupac_naziv} onSelect={k => setForm({...form, kupac_naziv: k.naziv})} placeholder="Odaberi kupca..." /></div>;
        if (polje.id === 'datum') return <input type="date" value={form.datum} onChange={e=>setForm({...form, datum:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none" />;
        if (polje.id === 'status') return <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-theme-panel rounded-xl text-theme-accent font-black border border-orange-500/50 outline-none"><option value="KREIRANA">Kreirana</option><option value="ISPORUČENO">Isporučeno</option></select>;
        if (polje.id === 'vozac') return <input value={form.vozac} onChange={e=>setForm({...form, vozac:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-theme-panel rounded-xl text-theme-text border border-theme-border outline-none focus:border-orange-500" placeholder="Ime vozača..." />;
        if (polje.id === 'registracija') return <input value={form.registracija} onChange={e=>setForm({...form, registracija:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-theme-panel rounded-xl text-theme-text border border-theme-border outline-none focus:border-orange-500" placeholder="npr. A12-B-345" />;
        return null;
    };

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 font-bold animate-in fade-in pb-20">
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-orange-500" user={user} modulIme="otpremnice" saas={saas} />
            <PametniDialog {...dialog} />

            {/* 🟢 MODAL ZA ODABIR: CIJELI ILI DJELIMIČNO RASTURANJE */}
            {paketModal.isOpen && paketModal.paket && (
                <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-theme-card border-2 border-orange-500 p-8 rounded-[2.5rem] shadow-2xl max-w-lg w-full relative">
                        <button onClick={() => setPaketModal({ isOpen: false, paket: null, isWms: false })} className="absolute top-6 right-6 text-slate-400 hover:text-white font-black text-xl z-10">✕</button>
                        <h3 className="text-orange-500 font-black uppercase text-base mb-6 border-b border-theme-border pb-3">📦 Šta uzimate iz paketa?</h3>
                        
                        <div className="bg-theme-panel p-4 rounded-xl border border-theme-border mb-6">
                            <p className="text-orange-400 font-black font-mono text-sm">{paketModal.paket.paket_id}</p>
                            <p className="text-theme-text font-black uppercase mt-1">{paketModal.paket.naziv_proizvoda}</p>
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-700">
                                <span className="text-xs text-slate-400 font-bold">Trenutno stanje u paketu:</span>
                                <span className="text-lg text-emerald-400 font-black">{paketModal.paket.kolicina_final} <span className="text-xs">m³</span></span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button onClick={() => izvrsiDodavanjePaketa(false)} className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase text-xs shadow-lg transition-all border border-emerald-400">
                                📦 Uzimam cijeli paket
                            </button>
                            <div className="w-full bg-orange-900/10 p-4 rounded-xl border border-orange-500/30 flex flex-col gap-3">
                                <label className="text-[10px] text-orange-400 font-black uppercase text-center">✂️ Rasturam (Djelimično)</label>
                                <div className="flex gap-2">
                                    <input type="number" value={djelimicnaKolicina} onChange={e=>setDjelimicnaKolicina(e.target.value)} placeholder="0.00" className="w-full p-3 bg-black text-white font-black text-center outline-none rounded-lg border border-orange-500/50" />
                                    <select value={djelimicnaJm} onChange={e=>setDjelimicnaJm(e.target.value)} className="bg-theme-card text-white font-black rounded-lg border border-theme-border px-2 outline-none">
                                        <option value="m3">m³</option><option value="kom">kom</option>
                                    </select>
                                </div>
                                <button onClick={() => izvrsiDodavanjePaketa(true)} className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-black uppercase text-[10px] transition-all">Dodaj Samo Ovo</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL LAGER (Odabir dostupnih) */}
            {prikaziLagerModal && (
                <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-theme-card border-2 border-orange-500 p-6 rounded-[2.5rem] shadow-2xl max-w-5xl w-full relative max-h-[85vh] flex flex-col">
                        <button onClick={() => setPrikaziLagerModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-white font-black text-xl z-10">✕</button>
                        <h3 className="text-orange-500 font-black uppercase text-sm mb-4 border-b border-theme-border pb-3">📦 Dodaj robu sa stanja lagera</h3>
                        <div className="flex flex-col sm:flex-row gap-4 mb-4">
                            <div className="relative flex-1">
                                <input type="text" value={pretragaLagera} onChange={e => setPretragaLagera(e.target.value.toUpperCase())} placeholder="Pretraži paket ili proizvod..." className="w-full p-4 bg-theme-panel border border-theme-border rounded-xl text-theme-text outline-none focus:border-orange-500 pr-16 text-xs" />
                                <button onClick={() => { setScanTarget('lager'); setIsScanningOverlay(true); }} className="absolute right-2 top-2 bottom-2 px-4 bg-orange-600 rounded-xl text-white font-bold hover:bg-orange-500 transition-all text-xl shadow-md">📷</button>
                            </div>
                            <label className="flex items-center gap-2 bg-theme-panel border border-theme-border px-4 py-3 rounded-xl cursor-pointer">
                                <input type="checkbox" checked={samoSlobodnoFilter} onChange={e => setSamoSlobodnoFilter(e.target.checked)} className="w-5 h-5 accent-orange-500" />
                                <span className="text-[10px] text-slate-300 font-black uppercase tracking-widest">Samo Slobodna Roba (Zeleno)</span>
                            </label>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {dostupniPaketiLager.filter(p => {
                                const srch = (p.paket_id||'').toUpperCase().includes(pretragaLagera) || (p.naziv_proizvoda||'').toUpperCase().includes(pretragaLagera);
                                const isSlobodan = p.broj_veze === 'SLOBODNA_ROBA';
                                return samoSlobodnoFilter ? (srch && isSlobodan) : srch;
                            }).map(p => {
                                const isSlobodan = p.broj_veze === 'SLOBODNA_ROBA';
                                return (
                                <div key={p.id} onClick={() => setPaketModal({ isOpen: true, paket: p, isWms: false })} className={`p-4 bg-theme-panel border-2 rounded-xl cursor-pointer transition-all shadow-md group ${isSlobodan ? 'border-emerald-500/50 hover:border-emerald-400' : 'border-slate-700 hover:border-orange-500'}`}>
                                    <div className="flex justify-between items-start mb-2"><p className="text-theme-text font-black text-xs font-mono">{p.paket_id}</p><p className="text-theme-text font-black text-sm">{p.kolicina_final} <span className="text-[10px] text-slate-500">m³</span></p></div>
                                    <p className="text-theme-text text-[10px] font-black uppercase mb-2 line-clamp-1">{p.naziv_proizvoda}</p>
                                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-700">
                                        {isSlobodan ? <span className="text-[8px] bg-emerald-900/40 text-emerald-400 px-2 py-1 rounded font-black uppercase">✅ SLOBODNO</span> : <span className="text-[8px] bg-amber-900/40 text-amber-500 px-2 py-1 rounded font-black uppercase">🔒 RN: {p.broj_veze}</span>}
                                        <button className="bg-theme-card border border-theme-border px-3 py-1 text-white font-black text-[9px] uppercase rounded-lg group-hover:bg-orange-600 transition-colors">Odaberi →</button>
                                    </div>
                                </div>
                            )})}
                        </div>
                    </div>
                </div>
            )}

            {/* TABOVI GLAVNI */}
            <div className="grid grid-cols-3 bg-theme-panel p-1 rounded-2xl border border-theme-border shadow-inner w-full gap-1">
                <button onClick={() => {setTab('nova'); if(!isEditing) resetFormu();}} className={`py-3.5 rounded-xl text-[10px] uppercase font-black transition-all ${tab === 'nova' ? 'bg-orange-600 text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card'}`}>➕ Nova Otprema</button>
                <button onClick={() => setTab('izdatnice')} className={`py-3.5 rounded-xl text-[10px] uppercase font-black transition-all ${tab === 'izdatnice' ? 'bg-amber-600 text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card'}`}>🚚 Skladište (WMS)</button>
                <button onClick={() => setTab('lista')} className={`py-3.5 rounded-xl text-[10px] uppercase font-black transition-all ${tab === 'lista' ? 'bg-emerald-600 text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card'}`}>📋 Arhiva</button>
            </div>

            {tab === 'nova' ? (
                <div className="space-y-4 animate-in slide-in-from-left max-w-4xl mx-auto w-full">
                    {!isEditing && (
                        <div className="bg-theme-card border border-orange-500/30 p-4 rounded-box shadow-2xl w-full">
                            <label className="text-[10px] text-theme-accent uppercase font-black block mb-2 ml-1">Pretraga/Skeniranje WMS Izdatnica i Naloga:</label>
                            <MasterSearch data={dostupniDokumenti} poljaZaPretragu={['id', 'kupac']} onSelect={(d) => obradiSkeniraniKod(d.id)} placeholder="Ukucaj npr. IZD-2026-..." onScanClick={() => { setScanTarget('veza'); setIsScanningOverlay(true); }} />
                        </div>
                    )}

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

                    <div className="bg-theme-card p-4 sm:p-6 rounded-box border border-theme-border/60 shadow-xl w-full">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-orange-500 font-black uppercase text-xs">2. Robni sadržaj isporuke</h3>
                            <button onClick={otvoriLagerZaDodavanje} className="bg-orange-900/30 text-orange-400 border border-orange-500/30 px-4 py-2 rounded-xl text-[9px] uppercase font-black hover:bg-orange-500 hover:text-white transition-all shadow-md">
                                📦 + Dodaj sa lagera
                            </button>
                        </div>
                        <div className="space-y-4 border-t border-slate-700 pt-4">
                            <MasterSearch data={katalog} poljaZaPretragu={['sifra', 'naziv']} value={stavkaForm.sifra_unos} onSelect={(k) => { setTrenutniProizvod(k); setStavkaForm({ ...stavkaForm, id: null, sifra_unos: `${k.sifra} | ${k.naziv}`, jm_obracun: k.default_jedinica || 'm3' }); }} placeholder="Dodaj vanrednu stavku..." />
                            {trenutniProizvod && (
                                <div className="p-4 bg-theme-panel border border-theme-border rounded-xl space-y-3 animate-in zoom-in-95">
                                    <div className="flex flex-col sm:flex-row gap-3"><input type="number" value={stavkaForm.kolicina_obracun} onChange={e=>setStavkaForm({...stavkaForm, kolicina_obracun:e.target.value})} placeholder="Količina..." className="flex-1 p-3 bg-black text-white font-black text-center rounded-xl outline-none border border-theme-border" /><select value={stavkaForm.jm_obracun} onChange={e=>setStavkaForm({...stavkaForm, jm_obracun:e.target.value})} className="w-24 p-3 bg-black text-white font-black rounded-xl outline-none"><option value="m3">m³</option><option value="kom">kom</option></select></div>
                                    <button onClick={dodajStavkuRucno} className="w-full py-3 bg-orange-600 text-white text-xs uppercase font-black rounded-xl hover:bg-orange-500 transition-all">Dodaj na dokument</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {stavke.length > 0 && (
                        <div className="bg-theme-card p-4 sm:p-6 rounded-box border border-theme-border shadow-2xl space-y-4 animate-in fade-in">
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Stavke spremne za otpremu:</span>
                            <div className="space-y-2">
                                {stavke.map((s, i) => (
                                    <div key={s.id} className={`flex justify-between items-center p-3 rounded-xl border border-theme-border/60 ${s.paket_id ? 'bg-orange-950/20 border-orange-500/40' : 'bg-theme-panel'}`}>
                                        <div className="flex items-center gap-3"><span className="text-slate-500 text-xs">{i+1}.</span><div><p className="text-theme-text text-xs font-black">{s.naziv}</p><p className="text-[9px] text-slate-500 mt-0.5">{s.sifra} {s.paket_id && `| 📦 ${s.paket_id}`}</p></div></div>
                                        <div className="flex items-center gap-4"><span className="text-orange-400 font-black text-base">{s.kolicina_obracun} {s.jm_obracun}</span><button onClick={()=>ukloniStavku(s.id)} className="text-red-500 p-2 text-xs">✕</button></div>
                                    </div>
                                ))}
                            </div>
                            <textarea value={form.napomena} onChange={e=>setForm({...form, napomena:e.target.value})} placeholder="Unesite internu napomenu za isporuku..." className="w-full p-4 bg-theme-panel border border-theme-border rounded-xl text-xs text-theme-text outline-none focus:border-orange-500 shadow-inner" rows="2" />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                <button onClick={kreirajIzdatnicu} className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md transition-all">📦 Generiši Nalog (Izdatnica)</button>
                                <button onClick={snimiOtpremnicu} className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all">🏁 SNIMI OTPREMNICU</button>
                            </div>
                        </div>
                    )}
                </div>
            ) : tab === 'izdatnice' ? (
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
                                        <div>
                                            <p className="text-theme-text text-sm font-black uppercase">{s.proizvod_naziv}</p>
                                            <p className="text-[10px] text-slate-500 mt-1">Šifra: {s.proizvod_sifra} {s.paket_ref_id && <span className="ml-2 text-amber-500 font-black">📦 {s.paket_ref_id}</span>}</p>
                                        </div>
                                        <div className="flex items-center gap-4 justify-between sm:justify-end w-full sm:w-auto border-t sm:border-none pt-2 sm:pt-0">
                                            <div className="text-center"><p className="text-[8px] text-slate-500 uppercase font-black">Plan</p><p className="text-slate-400 font-bold text-sm">{s.planirana_kolicina} {s.mjerna_jedinica}</p></div>
                                            <div className="text-center"><p className="text-[8px] text-amber-500 uppercase font-black">Utovareno</p><input type="number" value={s.izdata_kolicina} onChange={(e) => handleWmsKolicina(s.id, e.target.value)} className="w-20 p-2 bg-black text-amber-400 border border-amber-500/50 rounded-xl text-center font-black outline-none" /></div>
                                            <button onClick={() => obrisiWmsStavku(s.id)} className="text-red-500 hover:bg-red-500/20 p-3 rounded-xl transition-all font-black ml-2">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-blue-900/10 p-6 rounded-2xl border border-blue-500/20 mt-4 flex flex-col gap-4">
                                <div className="flex justify-between items-center"><span className="text-[10px] text-blue-400 font-black uppercase">➕ Dodatni utovar (Kupac uzeo još nešta):</span><button onClick={() => { setScanTarget('wms_paket'); setIsScanningOverlay(true); }} className="bg-blue-600/30 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-lg text-[9px] uppercase font-black hover:bg-blue-500 hover:text-white transition-all">📷 Skeniraj Paket</button></div>
                                <div className="flex gap-2 w-full flex-wrap sm:flex-nowrap"><div className="flex-1 min-w-[200px]"><MasterSearch data={katalog} poljaZaPretragu={['sifra', 'naziv']} onSelect={(k) => setWmsNovaSifra(`${k.sifra} | ${k.naziv}`)} placeholder="Ručna pretraga proizvoda..." /></div><input type="number" value={wmsNovaKol} onChange={e=>setWmsNovaKol(e.target.value)} placeholder="Kol" className="w-20 p-3 bg-black border border-theme-border rounded-xl text-center font-black text-white outline-none focus:border-blue-500" /><button onClick={dodajWmsStavkuNovu} className="bg-blue-600 text-white px-5 rounded-xl font-black uppercase text-[10px] hover:bg-blue-500 transition-all">Dodaj</button></div>
                            </div>
                            <button onClick={zavrsiIPotvrdiUtovar} className="w-full py-5 bg-emerald-600 text-white font-black rounded-xl uppercase text-xs tracking-widest mt-4 shadow-lg hover:bg-emerald-500 transition-all">✅ ZAVRŠI I POTVRDI UTOVAR SVE ROBE</button>
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
                                        <div className="flex gap-2 mt-auto">{izd.status === 'utovareno' ? <button onClick={() => { skenirajVezu(izd.broj_izdatnice); setTab('nova'); }} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg text-[9px] uppercase tracking-wider transition-all shadow-md">📑 Fakturiši</button> : <button onClick={() => otvoriWmsUtovar(izd)} className="w-full py-2.5 bg-amber-600/20 border border-amber-500/30 text-amber-400 font-black rounded-lg text-[9px] uppercase tracking-wider hover:bg-amber-500 hover:text-black transition-all">🚚 Pokreni utovar</button>}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-theme-card p-4 sm:p-6 rounded-box border border-theme-border shadow-2xl animate-in slide-in-from-right w-full">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {otpremnice.map(o => (
                            <div key={o.id} onClick={() => pokreniIzmjenu(o)} className="p-4 bg-theme-panel border border-theme-border rounded-xl hover:border-emerald-500 transition-all cursor-pointer shadow-md flex flex-col justify-between group">
                                <div className="flex justify-between items-start border-b border-slate-700 pb-2 mb-2"><div className="min-w-0 flex-1"><p className="text-emerald-500 font-black text-sm">{o.id}</p><p className="text-theme-text text-[10px] font-black uppercase mt-1 truncate">{o.kupac_naziv}</p></div><span className="bg-slate-800 text-slate-400 border border-slate-600 text-[8px] px-2 py-0.5 rounded font-black uppercase shadow-inner h-fit shrink-0 ml-2">{o.status}</span></div>
                                <div className="flex justify-between items-center text-[9px] text-slate-500 uppercase font-bold mt-2"><span>Kamion: {o.registracija || 'N/A'}</span><button onClick={(e)=>{e.stopPropagation(); setForm(o); setStavke(o.stavke_jsonb||[]); setTimeout(() => kreirajPDFPrivremeni(o), 100);}} className="text-emerald-400 font-black px-3 py-1 rounded bg-emerald-950/40 group-hover:bg-emerald-600 group-hover:text-white border border-emerald-500/20 transition-all shadow-sm">PDF 🖨️</button></div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {isScanningOverlay && <ScannerOverlay onScan={(text) => { 
                if (scanTarget === 'lager') {
                    setPretragaLagera(text.toUpperCase());
                } else if (scanTarget === 'wms') {
                    setPretragaWms(text.toUpperCase());
                    const ekspresna = izdatnice.find(i => i.broj_izdatnice === text.toUpperCase());
                    if (ekspresna) otvoriWmsUtovar(ekspresna);
                } else if (scanTarget === 'wms_paket') {
                    obradiSkeniraniKod(text.toUpperCase(), true);
                } else {
                    obradiSkeniraniKod(text.toUpperCase()); 
                }
                setIsScanningOverlay(false); 
            }} onClose={() => setIsScanningOverlay(false)} />}
        </div>
    );
}