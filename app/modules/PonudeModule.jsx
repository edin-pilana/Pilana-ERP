"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import MasterSearch from '../components/MasterSearch';
import PametniDialog from '../components/PametniDialog';
import SettingsModule from './SettingsModule';
import { printDokument } from '../utils/printHelpers';
import { useSaaS } from '../utils/useSaaS';

const supabase = createClient('https://awaxwejrhmjeqohrgidm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY');

export default function PonudeModule({ user, header, setHeader, onExit }) {
    const loggedUser = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');
    const currentUser = user?.ime_prezime ? user : loggedUser;
    const hasKupacEdit = currentUser.uloga === 'admin' || currentUser.uloga === 'superadmin' || (currentUser.dozvole && currentUser.dozvole.includes('Baza Kupaca (Edit)'));
    const hasKatalogEdit = currentUser.uloga === 'admin' || currentUser.uloga === 'superadmin' || (currentUser.dozvole && currentUser.dozvole.includes('Katalog Proizvoda (Edit)'));
    
    const saas = useSaaS('ponude_zaglavlje', {
        boja_kartice: '#1e293b', boja_slova: '#ffffff', velicina_naslova: '16', boja_naslova: 'text-pink-500',
        polja: [
            { id: 'kupac', label: '* KUPAC', span: 'col-span-2' }, { id: 'broj', label: 'BROJ PONUDE', span: 'col-span-2' },
            { id: 'datum', label: 'Datum izdavanja', span: 'col-span-1' }, { id: 'rok', label: 'Rok Važenja', span: 'col-span-1' },
            { id: 'placanje', label: 'Način Plaćanja', span: 'col-span-1' }, { id: 'valuta', label: 'Valuta', span: 'col-span-1' },
            { id: 'paritet', label: 'Paritet (Mjesto isporuke)', span: 'col-span-2' }, { id: 'depozit', label: 'Uplaćen Depozit', span: 'col-span-1' },
            { id: 'status', label: 'Status Ponude', span: 'col-span-1' }
        ]
    });
    
    const aktivnaPolja = saas.ui.polja?.length > 0 ? saas.ui.polja : saas.defaultConfig.polja;
    const [tab, setTab] = useState('nova');
    const [kupci, setKupci] = useState([]);
    const [katalog, setKatalog] = useState([]);
    const [ponude, setPonude] = useState([]);
    const [superadminLogs, setSuperadminLogs] = useState([]);
    
    // PAMETNI DIJALOZI
    const [dialog, setDialog] = useState({ isOpen: false });
    const prikaziDialog = (opcije) => setDialog({ isOpen: true, confirmText: 'POTVRDI', cancelText: 'ZATVORI', ...opcije });
    const zatvoriDialog = () => setDialog({ isOpen: false });

    const generisiID = () => `PON-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;
    const [form, setForm] = useState({
        id: generisiID(), kupac_naziv: '', datum: new Date().toISOString().split('T')[0], rok_vazenja: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
        nacin_placanja: 'Virmanski', valuta: 'KM', paritet: 'FCA Srebrenik', depozit: '', napomena: '', status: 'NA ODLUČIVANJU', rn_modifikovan: false, ukljuciPDV: true
    });
    
    const [isEditingPonuda, setIsEditingPonuda] = useState(false);
    const [odabraniKupac, setOdabraniKupac] = useState(null);
    const [stavke, setStavke] = useState([]);
    const [povezaniRN, setPovezaniRN] = useState(null);
    const [globalRabat, setGlobalRabat] = useState('');
    const [showBrziKupac, setShowBrziKupac] = useState(false);
    const [showBrziKatalog, setShowBrziKatalog] = useState(false);
    
    const [stavkaForm, setStavkaForm] = useState({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3', sistemski_rabat: 0, konacni_rabat: '', fiksna_cijena: '' });
    const [trenutniProizvod, setTrenutniProizvod] = useState(null);

    useEffect(() => { load(); }, []);

    const load = async () => {
        const {data: k} = await supabase.from('kupci').select('*').order('naziv'); setKupci(k||[]);
        const {data: cat} = await supabase.from('katalog_proizvoda').select('*').order('sifra'); setKatalog(cat||[]);
        const {data: p} = await supabase.from('ponude').select('*').order('datum', { ascending: false }); setPonude(p||[]);
        if (currentUser.uloga === 'superadmin') { const {data: logs} = await supabase.from('sistem_audit_log').select('*').eq('akcija', 'RUČNA_IZMJENA_RABATA').order('vrijeme', { ascending: false }).limit(10); setSuperadminLogs(logs || []); }
    };

    const zapisiU_Log = async (akcija, detalji) => { await supabase.from('sistem_audit_log').insert([{ korisnik: currentUser.ime_prezime || 'Nepoznat', akcija, detalji }]); };
    const potvrdiUpozorenje = async (logId) => { await supabase.from('sistem_audit_log').update({ akcija: 'RUČNA_IZMJENA_RABATA_PROČITANO' }).eq('id', logId); setSuperadminLogs(prev => prev.filter(l => l.id !== logId)); };
    
    const izracunajRabat = (proizvod, kupac) => {
        if(!kupac || !kupac.rabati_jsonb) return 0; const rabati = kupac.rabati_jsonb;
        if (rabati.proizvodi && rabati.proizvodi[proizvod.sifra]) return parseFloat(rabati.proizvodi[proizvod.sifra]);
        if (rabati.kategorije && rabati.kategorije[proizvod.kategorija]) return parseFloat(rabati.kategorije[proizvod.kategorija]);
        if (rabati.ukupni) return parseFloat(rabati.ukupni); return 0;
    };

    const izracunajDinamickuCijenu = (proizvod, jm_cilj) => {
        if (!proizvod) return 0;
        const p_baza = parseFloat(proizvod.cijena) || 0; const jm_baza = (proizvod.default_jedinica || 'm3').toLowerCase(); const cilj = (jm_cilj || 'm3').toLowerCase();
        if (jm_baza === cilj) return p_baza;
        const v = (parseFloat(proizvod.visina) || 1) / 100; const s = (parseFloat(proizvod.sirina) || 1) / 100; const d = (parseFloat(proizvod.duzina) || 1) / 100;
        let faktor_baza = 1; if (jm_baza === 'm3') faktor_baza = v * s * d; else if (jm_baza === 'm2') faktor_baza = s * d; else if (jm_baza === 'm1') faktor_baza = d;
        const cijena_komad = p_baza * faktor_baza;
        let faktor_cilj = 1; if (cilj === 'm3') faktor_cilj = v * s * d; else if (cilj === 'm2') faktor_cilj = s * d; else if (cilj === 'm1') faktor_cilj = d;
        return cijena_komad / (faktor_cilj || 1);
    };

    const dinamickaCijena = trenutniProizvod ? izracunajDinamickuCijenu(trenutniProizvod, stavkaForm.jm_obracun) : 0;

    const handleProizvodSelect = (nadjeni) => {
        setTrenutniProizvod(nadjeni || null);
        if (nadjeni) {
            const tekstZaPolje = `${nadjeni.sifra} | ${nadjeni.naziv}`;
            const predlozeniRabat = izracunajRabat(nadjeni, odabraniKupac);
            const bazna = izracunajDinamickuCijenu(nadjeni, nadjeni.default_jedinica || 'm3');
            const predlozenaFiksna = bazna - (bazna * (predlozeniRabat / 100));
            setStavkaForm({ ...stavkaForm, id: null, sifra_unos: tekstZaPolje, jm_unos: 'kom', jm_obracun: nadjeni.default_jedinica || 'm3', sistemski_rabat: predlozeniRabat, konacni_rabat: predlozeniRabat, fiksna_cijena: predlozenaFiksna.toFixed(2) });
        }
    };

    useEffect(() => {
        if(trenutniProizvod) {
            const rabat = parseFloat(stavkaForm.konacni_rabat) || 0;
            const novaFiksna = dinamickaCijena - (dinamickaCijena * (rabat/100));
            setStavkaForm(prev => ({...prev, fiksna_cijena: novaFiksna.toFixed(2)}));
        }
    }, [stavkaForm.jm_obracun]);

    useEffect(() => {
        if(!trenutniProizvod || !stavkaForm.kolicina_unos) return;
        const kol = parseFloat(stavkaForm.kolicina_unos); let obracun = kol;
        const v = (parseFloat(trenutniProizvod.visina) || 1) / 100; const s = (parseFloat(trenutniProizvod.sirina) || 1) / 100; const d = (parseFloat(trenutniProizvod.duzina) || 1) / 100;
        let komada = kol; if (stavkaForm.jm_unos === 'm3') komada = kol / (v * s * d); if (stavkaForm.jm_unos === 'm2') komada = kol / (s * d); if (stavkaForm.jm_unos === 'm1') komada = kol / d;
        if (stavkaForm.jm_obracun === 'm3') obracun = komada * (v * s * d); else if (stavkaForm.jm_obracun === 'm2') obracun = komada * (s * d); else if (stavkaForm.jm_obracun === 'm1') obracun = komada * d; else if (stavkaForm.jm_obracun === 'kom') obracun = komada;
        setStavkaForm(prev => ({...prev, kolicina_obracun: obracun > 0 ? obracun.toFixed(4) : kol}));
    }, [stavkaForm.kolicina_unos, stavkaForm.jm_unos, stavkaForm.jm_obracun, trenutniProizvod]);

    const dodajStavku = async () => {
        if(!trenutniProizvod || !stavkaForm.kolicina_obracun || parseFloat(stavkaForm.kolicina_obracun) <= 0) return prikaziDialog({ tip: 'upozorenje', naslov: 'Fale Podaci', poruka: "Odaberite proizvod i provjerite količine!", onCancel: zatvoriDialog });
        if(!odabraniKupac) return prikaziDialog({ tip: 'upozorenje', naslov: 'Fale Podaci', poruka: "Prvo odaberite kupca!", onCancel: zatvoriDialog });
        
        const kolicina = parseFloat(stavkaForm.kolicina_obracun);
        const fiksna_cijena = parseFloat(stavkaForm.fiksna_cijena) || dinamickaCijena;
        const rabat_konacni = dinamickaCijena > 0 ? ((dinamickaCijena - fiksna_cijena) / dinamickaCijena) * 100 : 0;
        
        if (rabat_konacni > stavkaForm.sistemski_rabat) { await zapisiU_Log('RUČNA_IZMJENA_RABATA', `Za "${trenutniProizvod.naziv}" kupcu "${form.kupac_naziv}" na ponudi ${form.id}, rabat ručno povećan na ${rabat_konacni.toFixed(2)}% (Sistem davao: ${stavkaForm.sistemski_rabat}%).`); }
        
        const ukupno_bez_rabata = kolicina * dinamickaCijena;
        const ukupno_sa_rabatom = kolicina * fiksna_cijena;
        const iznos_rabata = ukupno_bez_rabata - ukupno_sa_rabatom;

        const novaStavka = {
            id: stavkaForm.id || Math.random().toString(), sifra: trenutniProizvod.sifra, naziv: trenutniProizvod.naziv,
            kolicina_unos: parseFloat(stavkaForm.kolicina_unos), jm_unos: stavkaForm.jm_unos, kolicina_obracun: kolicina, jm_obracun: stavkaForm.jm_obracun,
            cijena_baza: dinamickaCijena, rabat_procenat: rabat_konacni.toFixed(2), fiksna_cijena: fiksna_cijena.toFixed(2), iznos_rabata, ukupno: ukupno_sa_rabatom
        };
        if (stavkaForm.id) setStavke(stavke.map(s => s.id === stavkaForm.id ? novaStavka : s)); else setStavke([...stavke, novaStavka]);
        setStavkaForm({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3', sistemski_rabat: 0, konacni_rabat: '', fiksna_cijena: '' }); setTrenutniProizvod(null);
    };

    const primijeniGlobalniRabat = async () => {
        const rabat = parseFloat(globalRabat); 
        if (isNaN(rabat) || rabat < 0 || rabat > 100) return prikaziDialog({ tip: 'upozorenje', naslov: 'Pogrešan unos', poruka: "Unesite validan procenat (0-100)!", onCancel: zatvoriDialog });
        
        prikaziDialog({
            tip: 'info', naslov: 'Masovna Izmjena',
            poruka: `Da li ste sigurni da želite postaviti popust od ${rabat}% na SVE stavke u ovoj ponudi?`,
            confirmText: '✅ PRIMIJENI', cancelText: '✕ ODUSTANI',
            onConfirm: async () => {
                const noveStavke = stavke.map(s => {
                    const fiksna_cijena = s.cijena_baza - (s.cijena_baza * (rabat / 100));
                    const ukupno_bez_rabata = s.kolicina_obracun * s.cijena_baza;
                    const ukupno_sa_rabatom = s.kolicina_obracun * fiksna_cijena;
                    return { ...s, rabat_procenat: rabat.toFixed(2), fiksna_cijena: fiksna_cijena.toFixed(2), iznos_rabata: ukupno_bez_rabata - ukupno_sa_rabatom, ukupno: ukupno_sa_rabatom };
                });
                setStavke(noveStavke); setGlobalRabat(''); await zapisiU_Log('RUČNA_IZMJENA_RABATA', `Globalni rabat ${rabat}% primijenjen na ponudi ${form.id}`); 
                prikaziDialog({ tip: 'uspjeh', naslov: 'Uspješno', poruka: `Rabat od ${rabat}% je uspješno primijenjen na sve stavke!`, onCancel: zatvoriDialog });
            },
            onCancel: zatvoriDialog
        });
    };

    const urediStavku = (stavka) => {
        const nadjeni = katalog.find(k => k.sifra === stavka.sifra); setTrenutniProizvod(nadjeni || null);
        const tekstZaPolje = nadjeni ? `${nadjeni.sifra} | ${nadjeni.naziv}` : stavka.sifra;
        setStavkaForm({ id: stavka.id, sifra_unos: tekstZaPolje, kolicina_unos: stavka.kolicina_unos, jm_unos: stavka.jm_unos, kolicina_obracun: stavka.kolicina_obracun, jm_obracun: stavka.jm_obracun, sistemski_rabat: izracunajRabat(nadjeni, odabraniKupac), konacni_rabat: stavka.rabat_procenat, fiksna_cijena: stavka.fiksna_cijena }); window.scrollTo({ top: 300, behavior: 'smooth' });
    };

    const ukloniStavku = (id) => setStavke(stavke.filter(s => s.id !== id));

    const totals = useMemo(() => {
        let suma_bez_rabata = 0, suma_rabata = 0, suma_krajnja = 0;
        stavke.forEach(s => { suma_bez_rabata += (s.kolicina_obracun * s.cijena_baza); suma_rabata += s.iznos_rabata; suma_krajnja += s.ukupno; });
        const pdv = form.ukljuciPDV ? suma_krajnja * 0.17 : 0;
        return { bez_rabata: suma_bez_rabata.toFixed(2), rabat: suma_rabata.toFixed(2), osnovica: suma_krajnja.toFixed(2), pdv: pdv.toFixed(2), za_naplatu: (suma_krajnja + pdv).toFixed(2) };
    }, [stavke, form.ukljuciPDV]);

    const snimiPonudu = async () => {
        if(!form.kupac_naziv) return prikaziDialog({ tip: 'upozorenje', naslov: 'Kupac Obavezan', poruka: "Kupac je obavezan!", onCancel: zatvoriDialog }); 
        if(stavke.length === 0) return prikaziDialog({ tip: 'upozorenje', naslov: 'Nema Stavki', poruka: "Ponuda mora imati stavke!", onCancel: zatvoriDialog });
        
        const payload = {
            id: form.id.toUpperCase(), kupac_naziv: form.kupac_naziv, datum: form.datum, rok_vazenja: form.rok_vazenja, nacin_placanja: form.nacin_placanja, valuta: form.valuta, paritet: form.paritet, depozit: parseFloat(form.depozit) || 0, napomena: form.napomena, stavke_jsonb: stavke, status: form.status,
            ukupno_bez_pdv: parseFloat(totals.osnovica), ukupno_rabat: parseFloat(totals.rabat), ukupno_sa_pdv: parseFloat(totals.za_naplatu), snimio_korisnik: currentUser.ime_prezime, rn_modifikovan: form.rn_modifikovan
        };
        
        if (isEditingPonuda) {
            const { error } = await supabase.from('ponude').update(payload).eq('id', form.id);
            if(error) return prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: error.message, onCancel: zatvoriDialog }); 
            await zapisiU_Log('IZMJENA_PONUDE', `Ažurirana ponuda ${form.id}`); 
        } else {
            const { error } = await supabase.from('ponude').insert([payload]);
            if(error) return prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: error.message, onCancel: zatvoriDialog }); 
            await zapisiU_Log('KREIRANA_PONUDA', `Ponuda ${form.id}`); 
        }

        if ((form.status === 'POTVRĐENA' || form.status === 'REALIZOVANA ✅') && parseFloat(form.depozit) > 0) {
            const { data: postojiAvans } = await supabase.from('blagajna').select('id').eq('racun_id', form.id).maybeSingle();
            if (!postojiAvans) { await supabase.from('blagajna').insert([{ id: `KASA-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000)}`, tip: 'ULAZ', kategorija: 'Avans po Ponudi', iznos: parseFloat(form.depozit), opis: `Automatski depozit: ${form.id}`, racun_id: form.id, datum: new Date().toISOString().split('T')[0], vrijeme_tekst: new Date().toLocaleTimeString('de-DE'), snimio_korisnik: currentUser.ime_prezime || 'Sistem' }]); }
        }
        
        resetFormu(); load(); setTab('lista');

        prikaziDialog({
            tip: 'uspjeh',
            naslov: isEditingPonuda ? "Ponuda Ažurirana!" : "Ponuda Kreirana!",
            poruka: "Ponuda je uspješno pohranjena. Želite li isprintati PDF?",
            confirmText: '🖨️ DA, ŠTAMPAJ',
            cancelText: '✕ ZATVORI',
            onConfirm: () => { kreirajPDFPrivremeni(payload); zatvoriDialog(); },
            onCancel: zatvoriDialog
        });
    };

    const pokreniIzmjenuPonude = async (p) => {
        const ukljuciPDV = parseFloat(p.ukupno_sa_pdv) > parseFloat(p.ukupno_bez_pdv);
        setForm({ id: p.id, kupac_naziv: p.kupac_naziv, datum: p.datum, rok_vazenja: p.rok_vazenja, nacin_placanja: p.nacin_placanja || 'Virmanski', valuta: p.valuta || 'KM', paritet: p.paritet || 'FCA Srebrenik', depozit: p.depozit || '', napomena: p.napomena || '', status: p.status || 'NA ODLUČIVANJU', rn_modifikovan: p.rn_modifikovan || false, ukljuciPDV });
        setOdabraniKupac(kupci.find(k => k.naziv === p.kupac_naziv) || null); setStavke(p.stavke_jsonb || []); setIsEditingPonuda(true); setTab('nova'); window.scrollTo({ top: 0, behavior: 'smooth' });
        setPovezaniRN(null); if (p.rn_modifikovan) { const { data } = await supabase.from('radni_nalozi').select('id, stavke_jsonb').eq('broj_ponude', p.id).limit(1); if (data && data.length > 0) setPovezaniRN(data[0]); }
    };

    const promijeniStatusBrzo = async (p, noviStatus) => { await supabase.from('ponude').update({ status: noviStatus }).eq('id', p.id); await zapisiU_Log('STATUS_PONUDE', `Ponuda ${p.id} prebačena u ${noviStatus}`); load(); };
    const resetFormu = () => { setForm({ id: generisiID(), kupac_naziv: '', datum: new Date().toISOString().split('T')[0], rok_vazenja: '', nacin_placanja: 'Virmanski', valuta: 'KM', paritet: 'FCA Srebrenik', depozit: '', napomena: '', status: 'NA ODLUČIVANJU', rn_modifikovan: false, ukljuciPDV: true }); setStavke([]); setOdabraniKupac(null); setIsEditingPonuda(false); setPovezaniRN(null); setGlobalRabat(''); };
    const formatirajDatum = (isoString) => { if(!isoString) return ''; const [y, m, d] = isoString.split('T')[0].split('-'); return `${d}.${m}.${y}.`; };

    const razlikeUOdnosuNaRN = useMemo(() => {
        if (!povezaniRN || !povezaniRN.stavke_jsonb) return []; const razlike = []; const rnStavke = povezaniRN.stavke_jsonb;
        stavke.forEach(ps => { const rs = rnStavke.find(r => r.sifra === ps.sifra); if (!rs) { razlike.push({ sifra: ps.sifra, naziv: ps.naziv, tip: 'obrisano', poruka: `Obrisano (Bilo: ${ps.kolicina_unos} ${ps.jm_unos})` }); } else if (parseFloat(rs.kolicina_obracun) !== parseFloat(ps.kolicina_obracun) || parseFloat(rs.kolicina_unos) !== parseFloat(ps.kolicina_unos)) { razlike.push({ sifra: ps.sifra, naziv: ps.naziv, tip: 'mijenjano', poruka: `Mijenjano sa ${ps.kolicina_unos} ${ps.jm_unos} na ${rs.kolicina_unos} ${rs.jm_unos}` }); } });
        rnStavke.forEach(rs => { if (!stavke.find(p => p.sifra === rs.sifra)) { razlike.push({ sifra: rs.sifra, naziv: rs.naziv, tip: 'dodato', poruka: `Dodato naknadno (${rs.kolicina_unos} ${rs.jm_unos})` }); } }); return razlike;
    }, [stavke, povezaniRN]);

    const prihvatiIzmjene = async () => {
        if(!povezaniRN) return;
        const noveStavke = povezaniRN.stavke_jsonb.map(rs => {
            const postojeca = stavke.find(ps => ps.sifra === rs.sifra);
            const cijena_baza = postojeca ? postojeca.cijena_baza : 0; const fiksna_cijena = postojeca ? postojeca.fiksna_cijena : 0;
            const rabat = postojeca ? postojeca.rabat_procenat : 0; const kolicina = parseFloat(rs.kolicina_obracun) || 0;
            const ukupno_bez_rabata = kolicina * cijena_baza; const ukupno_sa_rabatom = kolicina * fiksna_cijena; const iznos_rabata = ukupno_bez_rabata - ukupno_sa_rabatom;
            return { id: postojeca ? postojeca.id : Math.random().toString(), sifra: rs.sifra, naziv: rs.naziv, kolicina_unos: rs.kolicina_unos, jm_unos: rs.jm_unos, kolicina_obracun: kolicina, jm_obracun: rs.jm_obracun, cijena_baza, rabat_procenat: rabat, fiksna_cijena, iznos_rabata, ukupno: ukupno_sa_rabatom };
        });
        setStavke(noveStavke); setForm({...form, rn_modifikovan: false}); await supabase.from('ponude').update({ rn_modifikovan: false, stavke_jsonb: noveStavke }).eq('id', form.id); await supabase.from('radni_nalozi').update({ modifikovan: false }).eq('id', povezaniRN.id); setPovezaniRN(null); 
        prikaziDialog({ tip: 'uspjeh', naslov: 'Prihvaćeno', poruka: "✅ Izmjene iz proizvodnje su PRIHVAĆENE!", onCancel: zatvoriDialog });
    };

    const odbijIzmjene = async () => {
        if(!povezaniRN) return; 
        prikaziDialog({
            tip: 'upozorenje', naslov: 'Odbijanje Izmjena',
            poruka: "Radni nalog će biti vraćen na originalne količine! Da li ste sigurni?",
            confirmText: '✅ ODBIJ IZMJENE', cancelText: '✕ ODUSTANI',
            onConfirm: async () => {
                setForm({...form, rn_modifikovan: false}); await supabase.from('ponude').update({ rn_modifikovan: false }).eq('id', form.id); await supabase.from('radni_nalozi').update({ stavke_jsonb: stavke, modifikovan: false }).eq('id', povezaniRN.id); setPovezaniRN(null); 
                zatvoriDialog();
                prikaziDialog({ tip: 'info', naslov: 'Odbijeno', poruka: "❌ Izmjene su ODBIJENE i vraćene na staro!", onCancel: zatvoriDialog });
            },
            onCancel: zatvoriDialog
        });
    };

    const kreirajPDF = () => { kreirajPDFPrivremeni(form); };

    const kreirajPDFPrivremeni = (podaci) => {
        const stariNaslov = document.title; document.title = `ponuda_${podaci.id}_${(podaci.kupac_naziv || 'Nepoznat_Kupac').replace(/\s+/g, '_')}`;
        const ukupnoSaPDV = parseFloat(podaci.ukupno_sa_pdv); const depozit = parseFloat(podaci.depozit) || 0; const preostaloZaNaplatu = (ukupnoSaPDV - depozit).toFixed(2);

        let redovi = (podaci.stavke_jsonb || stavke).map((s, i) => {
            const kat = katalog.find(k => k.sifra === s.sifra);
            let dimenzijeTekst = ''; 
            if (kat) dimenzijeTekst = `<span class="prod-dim">Dimenzije: ${kat.visina}x${kat.sirina}x${kat.duzina} cm</span>`; 
            return `<tr><td style="font-weight: bold; color: #64748b; vertical-align: top; padding-top: 8px;">${i+1}.</td><td style="vertical-align: top; padding-top: 8px;"><span class="prod-sifra">ŠIFRA: ${s.sifra}</span><span class="prod-naziv">${s.naziv}</span>${dimenzijeTekst}</td><td class="num" style="color: #0f172a; text-align: center; vertical-align: top; padding-top: 8px;">${s.kolicina_obracun} <span style="color: #64748b; font-size: 9px; font-weight: 600;">${s.jm_obracun}</span></td><td class="num" style="font-weight: 600; vertical-align: top; padding-top: 8px;">${s.cijena_baza.toFixed(2)}</td><td class="num" style="color: #ec4899; font-weight: 800; vertical-align: top; padding-top: 8px;">${s.rabat_procenat > 0 ? s.rabat_procenat + '%' : '-'}</td><td class="num" style="font-weight: 900; color: #0f172a; font-size: 13px; vertical-align: top; padding-top: 8px;">${s.ukupno.toFixed(2)}</td></tr>`;
        }).join('');

        const htmlSadrzajTabela = `<style>table th, table td { padding: 4px 6px !important; } .footer { margin-top: 25px !important; font-size: 11px !important; display: flex; justify-content: space-between; } .napomena { width: 60%; color: #475569; line-height: 1.4; } .potpis { width: 30%; text-align: center; color: #64748b; }</style><div class="info-grid"><div class="info-col-left"><h4>Kupac / Klijent</h4><h2>${podaci.kupac_naziv}</h2><p>${odabraniKupac?.adresa || 'Adresa nije unesena'}</p><p style="margin-top: 3px;">PDV / ID: <b style="color: #0f172a;">${odabraniKupac?.pdv_broj || 'N/A'}</b></p></div><div class="info-col-right"><p>Paritet: <b>${podaci.paritet}</b></p><p style="margin-top: 2px;">Plaćanje: <b>${podaci.nacin_placanja}</b></p><p style="margin-top: 2px;">Valuta: <b>${podaci.valuta}</b></p><p style="color: #ec4899; margin-top: 8px;">Važi do: <b>${formatirajDatum(podaci.rok_vazenja)}</b></p></div></div><table><thead><tr><th style="width: 5%;">R.B.</th><th>Naziv Proizvoda i Šifra</th><th style="text-align:center;">Količina</th><th class="num">Cijena</th><th class="num">Rabat</th><th class="num">Ukupno (${podaci.valuta})</th></tr></thead><tbody>${redovi}</tbody></table><div class="footer"><div class="napomena"><b style="color: #0f172a; text-transform: uppercase;">Napomena uz ponudu:</b><br/>${podaci.napomena || 'Nema dodatnih napomena.'}</div><div class="potpis"><div style="border-bottom: 1px solid #cbd5e1; margin-bottom: 5px; height: 40px;"></div>Potpis ovlaštenog lica</div></div>`;

        const donjiTotaliHtml = `<table class="totals-table"><tr><td class="lbl">Iznos bez rabata:</td><td class="val">${podaci.ukupno_bez_pdv}</td></tr>${parseFloat(podaci.ukupno_rabat) > 0 ? `<tr><td class="lbl" style="color: #ec4899;">Uračunati rabat:</td><td class="val" style="color: #ec4899;">- ${podaci.ukupno_rabat}</td></tr>` : ''}${podaci.ukljuciPDV ? `<tr><td class="lbl">Osnovica za PDV:</td><td class="val">${podaci.ukupno_bez_pdv}</td></tr><tr><td class="lbl">PDV iznos (17%):</td><td class="val">${(parseFloat(podaci.ukupno_sa_pdv) - parseFloat(podaci.ukupno_bez_pdv)).toFixed(2)}</td></tr><tr><td class="lbl" style="padding-top: 6px; border-top: 1px solid #cbd5e1;">UKUPNO SA PDV:</td><td class="val" style="padding-top: 6px; border-top: 1px solid #cbd5e1;">${ukupnoSaPDV.toFixed(2)}</td></tr>` : `<tr><td class="lbl" style="padding-top: 6px; border-top: 1px solid #cbd5e1;">UKUPNO:</td><td class="val" style="padding-top: 6px; border-top: 1px solid #cbd5e1;">${ukupnoSaPDV.toFixed(2)}</td></tr>`}${depozit > 0 ? `<tr><td class="lbl" style="color: #10b981;">Uplaćen depozit:</td><td class="val" style="color: #10b981;">- ${depozit.toFixed(2)}</td></tr>` : ''}<tr class="grand-total"><td class="lbl">ZA NAPLATU:</td><td class="val">${preostaloZaNaplatu} ${podaci.valuta}</td></tr></table>`;
        printDokument('PONUDA', podaci.id, formatirajDatum(podaci.datum), htmlSadrzajTabela, '#ec4899', donjiTotaliHtml); setTimeout(() => { document.title = stariNaslov; }, 2000);
    };

    const renderPoljeZaglavlja = (polje) => {
        if (polje.id === 'kupac') return (
            <div className="flex gap-2 items-center w-full h-full">
                <div className="flex-1 min-w-0 h-full">
                <MasterSearch data={kupci} poljaZaPretragu={['naziv']} value={form.kupac_naziv} onSelect={k => { setForm({...form, kupac_naziv: k.naziv}); setOdabraniKupac(k); }} placeholder="Odaberi kupca..." />
                </div>
                {hasKupacEdit && <button onClick={() => setShowBrziKupac(true)} className="bg-theme-accent hover:opacity-80 text-theme-text px-3 h-full min-h-[45px] rounded-xl shadow-lg shrink-0 text-[10px] font-black">➕ NOVI</button>}
            </div>
        );
        if (polje.id === 'broj') return <input value={form.id} disabled={isEditingPonuda} onChange={e=>setForm({...form, id:e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-theme-card rounded-xl text-xs text-theme-text outline-none border border-theme-border font-black uppercase disabled:opacity-50" />;
        if (polje.id === 'datum') return <input type="date" value={form.datum} onChange={e=>setForm({...form, datum:e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border" />;
        if (polje.id === 'rok') return <input type="date" value={form.rok_vazenja} onChange={e=>setForm({...form, rok_vazenja:e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border" />;
        if (polje.id === 'valuta') return <select value={form.valuta} onChange={e=>setForm({...form, valuta:e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border cursor-pointer"><option value="KM">BAM (KM)</option><option value="EUR">EUR (€)</option><option value="RSD">RSD</option></select>;
        if (polje.id === 'paritet') return <input value={form.paritet} onChange={e=>setForm({...form, paritet:e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border" placeholder="npr. FCA Srebrenik" />;
        if (polje.id === 'depozit') return <input type="number" value={form.depozit} onChange={e=>setForm({...form, depozit:e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-emerald-900/20 rounded-xl text-xs text-emerald-400 font-black outline-none border border-emerald-500/30" placeholder="0.00" />;
        if (polje.id === 'status') return <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-pink-900/20 rounded-xl text-xs text-theme-accent font-black outline-none border border-pink-500/50 cursor-pointer"><option value="NA ODLUČIVANJU">Na odlučivanju</option><option value="POTVRĐENA">POTVRĐENA ✅</option><option value="REALIZOVANA ✅">REALIZOVANA (Zatvorena)</option></select>;
        if (polje.id === 'placanje') return (
            <div className="flex flex-col gap-2 h-full">
                <select value={form.nacin_placanja} onChange={e => { const val = e.target.value; setForm({...form, nacin_placanja: val, ukljuciPDV: val === 'Virmanski'}); }} className="w-full p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border cursor-pointer">
                    <option value="Virmanski">Virmanski (Sa PDV)</option><option value="Gotovina">Gotovina (Bez PDV)</option><option value="Kartica">Kartica</option>
                </select>
                <div className="flex items-center gap-4 text-[10px] uppercase font-black text-slate-400 pl-1">
                    <label className="flex items-center gap-1 cursor-pointer hover:text-white"><input type="radio" name="pdv_ponuda" checked={form.ukljuciPDV} onChange={() => setForm({...form, ukljuciPDV: true})} /> + Obračunaj PDV</label>
                    <label className="flex items-center gap-1 cursor-pointer hover:text-white"><input type="radio" name="pdv_ponuda" checked={!form.ukljuciPDV} onChange={() => setForm({...form, ukljuciPDV: false})} /> Bez PDV-a</label>
                </div>
            </div>
        );
        return null;
    };

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 font-bold animate-in fade-in" style={{ color: saas.ui.boja_slova }}>
            <PametniDialog {...dialog} />
            {showBrziKupac && <div className="fixed inset-0 z-[200] bg-[#090e17]/95 flex flex-col p-4 overflow-y-auto backdrop-blur-md animate-in fade-in"><SettingsModule onExit={() => { setShowBrziKupac(false); load(); }} lockedTab="kupci" /></div>}
            {showBrziKatalog && <div className="fixed inset-0 z-[200] bg-[#090e17]/95 flex flex-col p-4 overflow-y-auto backdrop-blur-md animate-in fade-in"><SettingsModule onExit={() => { setShowBrziKatalog(false); load(); }} lockedTab="katalog" /></div>}
            
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-pink-500" user={user} modulIme="ponude" saas={saas} hideMasina={true} />

            {saas.isEditMode && (
                <div className="bg-black/60 p-6 rounded-2xl border-2 border-amber-500/50 mb-6 shadow-2xl">
                    <h3 className="text-amber-500 font-black uppercase text-sm mb-4">God Mode - Kontrole Dizajna</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="text-[10px] text-amber-500 uppercase font-black">Boja Pozadine (Kartice): <input type="color" value={saas.ui.boja_kartice} onChange={e => saas.setUi({...saas.ui, boja_kartice: e.target.value})} className="w-full h-10 mt-1 cursor-pointer rounded bg-transparent" /></label>
                        <label className="text-[10px] text-amber-500 uppercase font-black">Boja SVIH slova: <input type="color" value={saas.ui.boja_slova} onChange={e => saas.setUi({...saas.ui, boja_slova: e.target.value})} className="w-full h-10 mt-1 cursor-pointer rounded bg-transparent" /></label>
                    </div>
                </div>
            )}

            <div className="flex bg-theme-panel p-1.5 rounded-2xl border border-theme-border shadow-inner">
                <button onClick={() => {setTab('nova'); if(!isEditingPonuda) resetFormu();}} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all font-black ${tab === 'nova' ? 'bg-theme-accent text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-theme-text'}`}>{isEditingPonuda ? '✏️ Ažuriranje Ponude' : '➕ Nova Ponuda'}</button>
                <button onClick={() => setTab('lista')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all font-black ${tab === 'lista' ? 'bg-theme-accent text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-theme-text'}`}>📋 Lista Ponuda</button>
            </div>
            {tab === 'nova' ? (
                <div className="space-y-4 animate-in slide-in-from-left max-w-4xl mx-auto">
                    {form.rn_modifikovan && (
                        <div className="bg-red-900/40 border-2 border-red-500 p-6 rounded-box flex flex-col gap-4 shadow-2xl animate-in slide-in-from-top w-full">
                            <div className="flex items-center gap-4 border-b border-red-500/20 pb-3"><span className="text-4xl animate-pulse">🚫</span><div><p className="text-red-400 font-black uppercase text-sm">Ova ponuda je blokirala proizvodnju!</p><p className="text-theme-text text-xs mt-1">Radni Nalog {povezaniRN ? `(${povezaniRN.id})` : ''} je izmijenjen u pogonu. Dok ne odobrite ili odbijete izmjene, <b className="text-red-400">štampanje radnog naloga je zabranjeno.</b></p></div></div>
                            {razlikeUOdnosuNaRN.length > 0 ? (
                                <div className="w-full">
                                    <div className="bg-black/30 rounded-xl p-3 border border-red-500/30 space-y-2 mb-4">
                                        {razlikeUOdnosuNaRN.map((r, idx) => (
                                            <div key={idx} className="flex flex-col md:flex-row justify-between md:items-center text-xs gap-2 border-b border-red-500/10 pb-2 last:border-0 last:pb-0">
                                                <div><span className="text-theme-text font-bold">{r.sifra}</span> <span className="text-slate-400 ml-1">{r.naziv}</span></div>
                                                <div className={`font-black px-3 py-1 rounded uppercase tracking-widest ${r.tip === 'obrisano' ? 'bg-red-500/20 text-red-400' : r.tip === 'dodato' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{r.poruka}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex flex-col md:flex-row gap-3"><button onClick={prihvatiIzmjene} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-theme-text font-black px-6 py-4 rounded-2xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] uppercase text-xs">✅ Prihvati (Ažuriraj Ponudu)</button><button onClick={odbijIzmjene} className="flex-1 bg-red-600 hover:bg-red-500 text-theme-text font-black px-6 py-4 rounded-2xl transition-all shadow-[0_0_15px_rgba(220,38,38,0.4)] uppercase text-xs">❌ Odbij (Vrati RN na staro)</button></div>
                                </div>
                            ) : (<div className="text-xs text-slate-400 italic">Učitavam detalje razlika...</div>)}
                        </div>
                    )}
                    <div className={`p-6 rounded-box border-2 shadow-2xl space-y-4 transition-all relative z-[40] ${saas.isEditMode ? 'border-dashed border-amber-500 bg-black/20' : (isEditingPonuda ? 'border-amber-500/50 bg-theme-card backdrop-blur-[var(--glass-blur)]' : 'border-pink-500/30 bg-theme-card backdrop-blur-[var(--glass-blur)]')}`} style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <div className="flex justify-between items-center mb-2 border-b border-theme-border/50 pb-2">
                            <h3 className={`${isEditingPonuda ? 'text-amber-500' : saas.ui.boja_naslova} font-black uppercase text-xs`} style={{ fontSize: `${saas.ui.velicina_naslova}px` }}>1. Podaci o kupcu i parametrima ponude</h3>
                            <div className="flex gap-2">
                                {isEditingPonuda && <button onClick={kreirajPDF} className="text-[10px] bg-theme-panel text-theme-text border border-slate-600 px-4 py-1.5 rounded-xl uppercase hover:bg-white hover:text-black transition-all shadow-md font-black">🖨️ Isprintaj PDF</button>}
                                {isEditingPonuda && <button onClick={resetFormu} className="text-[10px] bg-red-900/30 text-red-400 px-3 py-1.5 rounded-xl uppercase hover:bg-red-900/50">Odustani ✕</button>}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border-b border-theme-border pb-4 items-start">
                            {aktivnaPolja.map((polje, index) => (
                                <div key={polje.id} className={`relative flex flex-col ${polje.span}`}>{polje.label && <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1 shrink-0">{polje.label}</label>}<div className="flex-1">{renderPoljeZaglavlja(polje)}</div></div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-theme-border shadow-2xl space-y-4" style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <h3 className="text-blue-500 font-black uppercase text-xs mb-4">2. Dinamički unos stavki</h3>
                        <div className="relative z-40 mb-3">
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Pronađi proizvod</label>
                            <div className="flex gap-2 items-center w-full">
                                <div className="flex-1 min-w-0">
                                    <MasterSearch 
                                        data={katalog} 
                                        poljaZaPretragu={['sifra', 'naziv']} 
                                        value={stavkaForm.sifra_unos}
                                        onSelect={(k) => handleProizvodSelect(k)} 
                                        placeholder="Pronađi šifru ili naziv..."
                                        renderItem={(k) => (
                                            <div>
                                                <div className="text-theme-text text-xs font-black">{k.visina}x{k.sirina}x{k.duzina} | {k.naziv} <span className="text-blue-400 ml-2">(Šifra: {k.sifra})</span></div>
                                                <div className="text-[10px] text-slate-400 mt-1 uppercase">Kat: {k.kategorija} | Baza: {k.default_jedinica} | {k.cijena} KM</div>
                                            </div>
                                        )}
                                    />
                                </div>
                                {hasKatalogEdit && <button onClick={() => setShowBrziKatalog(true)} className="bg-amber-600 hover:bg-amber-500 text-theme-text px-3 py-3 rounded-xl shadow-lg shrink-0 text-[10px] font-black">➕ NOVI</button>}
                            </div>
                        </div>
                        {trenutniProizvod && (
                            <div className="p-4 bg-blue-900/10 border border-blue-500/30 rounded-2xl animate-in zoom-in-95 space-y-4">
                                <div className="flex justify-between items-center border-b border-theme-border pb-3"><div><p className="text-theme-text text-sm font-black">{trenutniProizvod.visina}x{trenutniProizvod.sirina}x{trenutniProizvod.duzina} | {trenutniProizvod.naziv}</p><p className="text-[10px] text-slate-400 mt-1">Šifra: {trenutniProizvod.sifra}</p></div><div className="text-right"><p className="text-[10px] text-slate-400 uppercase">Cijena po {stavkaForm.jm_obracun}</p><p className="text-emerald-400 font-black text-lg">{dinamickaCijena.toFixed(2)} {form.valuta}</p></div></div>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                                    <div className="col-span-2"><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Unos: Količina i Jedinica</label><div className="flex gap-1"><input type="number" value={stavkaForm.kolicina_unos} onChange={e=>setStavkaForm({...stavkaForm, kolicina_unos:e.target.value})} placeholder="Količina" className="flex-1 p-3 bg-theme-panel rounded-xl text-sm text-theme-text font-black text-center outline-none border border-theme-border focus:border-blue-500 shadow-inner" /><select value={stavkaForm.jm_unos} onChange={e=>setStavkaForm({...stavkaForm, jm_unos:e.target.value})} className="w-20 p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border cursor-pointer shadow-inner uppercase"><option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option></select></div></div>
                                    <div className="col-span-2"><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Obračunava se po</label><div className="flex gap-1"><input type="number" value={stavkaForm.kolicina_obracun} readOnly className="flex-1 p-3 bg-theme-panel/50 rounded-xl text-sm text-slate-400 font-black text-center border border-theme-border outline-none cursor-not-allowed pointer-events-none opacity-80 shadow-inner" /><select value={stavkaForm.jm_obracun} onChange={e=>setStavkaForm({...stavkaForm, jm_obracun:e.target.value})} className="w-20 p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border hover:border-blue-500 cursor-pointer transition-all shadow-inner uppercase"><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option><option value="kom">kom</option></select></div></div>
                                    <div className="col-span-2 md:col-span-5 grid grid-cols-2 gap-3 bg-black/20 p-3 rounded-xl border border-theme-border mt-2 shadow-inner">
                                        <div>
                                            <label className="text-[8px] text-emerald-500 uppercase ml-2 block mb-1 font-black">Konačna Cijena</label>
                                            <input type="number" value={stavkaForm.fiksna_cijena} onChange={e => { const val = e.target.value; const cijena = parseFloat(val) || 0; const rabat = dinamickaCijena > 0 ? ((dinamickaCijena - cijena) / dinamickaCijena) * 100 : 0; setStavkaForm({...stavkaForm, fiksna_cijena: val, konacni_rabat: rabat.toFixed(2)}); }} className="w-full p-3 bg-emerald-900/20 rounded-xl text-sm text-emerald-400 font-black text-center outline-none border border-emerald-500/50 shadow-inner" />
                                        </div>
                                        <div>
                                            <label className="text-[8px] text-pink-500 uppercase ml-2 block mb-1 font-black">Ili Popust %</label>
                                            <input type="number" value={stavkaForm.konacni_rabat} onChange={e => { const val = e.target.value; const rabat = parseFloat(val) || 0; const cijena = dinamickaCijena - (dinamickaCijena * (rabat / 100)); setStavkaForm({...stavkaForm, konacni_rabat: val, fiksna_cijena: cijena.toFixed(2)}); }} className="w-full p-3 bg-pink-900/20 rounded-xl text-sm text-theme-accent font-black text-center outline-none border border-pink-500/50 shadow-inner" />
                                        </div>
                                    </div>
                                </div>
                                <button onClick={dodajStavku} className={`w-full py-4 text-theme-text font-black rounded-xl text-xs shadow-lg uppercase mt-2 transition-all ${stavkaForm.id ? 'bg-amber-600 hover:bg-amber-500' : 'bg-theme-accent hover:opacity-80'}`}>{stavkaForm.id ? '✅ Ažuriraj ovu stavku' : '➕ Dodaj stavku na ponudu'}</button>
                            </div>
                        )}
                    </div>
                    {stavke.length > 0 && (
                        <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-emerald-500/30 shadow-2xl animate-in slide-in-from-bottom" style={{ backgroundColor: saas.ui.boja_kartice }}>
                            <div className="flex justify-between items-center mb-4"><h3 className="text-emerald-500 font-black uppercase text-xs">3. Pregled Ponude i PDF</h3><button onClick={kreirajPDF} className="bg-theme-panel text-theme-text px-4 py-2 rounded-xl text-[10px] uppercase font-black border border-slate-600 hover:bg-white hover:text-black transition-all shadow-md">🖨️ Kreiraj PDF</button></div>
                            <div className="space-y-2 mb-6">
                                {stavke.map((s) => {
                                    const katItem = katalog.find(k => k.sifra === s.sifra);
                                    const dim = katItem ? `${katItem.visina}x${katItem.sirina}x${katItem.duzina}` : '';
                                    return (
                                    <div key={s.id} onClick={() => urediStavku(s)} className="flex justify-between items-center p-3 bg-theme-card border border-theme-border rounded-xl relative overflow-hidden cursor-pointer hover:border-blue-500 transition-all shadow-md group">
                                        {s.rabat_procenat > 0 && <div className="absolute top-0 left-0 h-full w-1 bg-pink-500"></div>}
                                        <div className="ml-2"><p className="text-theme-text text-xs font-black">{dim ? `${dim} | ` : ''}{s.naziv}</p><p className="text-[9px] text-slate-500 uppercase mt-1">Šifra: {s.sifra} | Unos: {s.kolicina_unos} {s.jm_unos} | Obr: <b className="text-theme-text">{s.kolicina_obracun} {s.jm_obracun}</b> x {s.fiksna_cijena} {form.valuta}</p></div>
                                        <div className="flex items-center gap-4"><div className="text-right">{s.rabat_procenat > 0 && <p className="text-[9px] text-pink-500 font-bold line-through">{(s.kolicina_obracun * s.cijena_baza).toFixed(2)}</p>}<p className="text-emerald-400 font-black text-sm">{s.ukupno.toFixed(2)} {form.valuta} {s.rabat_procenat > 0 && <span className="text-pink-500 text-[8px] ml-1">(-{s.rabat_procenat}%)</span>}</p></div><button onClick={(e)=>{e.stopPropagation(); ukloniStavku(s.id);}} className="text-red-500 font-black p-2 hover:bg-red-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">✕</button></div>
                                    </div>
                                )})}
                            </div>
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-theme-border pb-4 mb-4">
                                <div className="flex gap-2 items-center bg-pink-900/20 p-2 rounded-xl border border-pink-500/30 w-full md:w-auto shadow-inner"><label className="text-[9px] text-theme-accent font-black uppercase ml-2">Postavi rabat za SVE stavke (%):</label><input type="number" value={globalRabat} onChange={e=>setGlobalRabat(e.target.value)} className="w-16 p-2 bg-black text-theme-text text-center rounded-lg outline-none border border-pink-500/50 font-black" placeholder="0" /><button onClick={primijeniGlobalniRabat} className="bg-theme-accent text-theme-text px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:opacity-80 transition-all shadow-md">Primijeni</button></div>
                            </div>
                            <div className="bg-theme-card p-5 rounded-2xl border border-theme-border space-y-2 shadow-inner">
                                <div className="flex justify-between text-xs text-slate-400"><span>Iznos bez rabata:</span><span>{totals.bez_rabata} {form.valuta}</span></div>
                                {parseFloat(totals.rabat) > 0 && <div className="flex justify-between text-xs text-pink-500 font-bold"><span>Uračunat rabat:</span><span>- {totals.rabat} {form.valuta}</span></div>}
                                {form.ukljuciPDV ? (
                                    <>
                                        <div className="flex justify-between text-xs text-slate-400 border-b border-theme-border pb-2 mb-2"><span>Osnovica za PDV:</span><span>{totals.osnovica} {form.valuta}</span></div>
                                        <div className="flex justify-between text-xs text-slate-400 border-b border-theme-border pb-2 mb-2"><span>PDV (17%):</span><span>{totals.pdv} {form.valuta}</span></div>
                                        <div className="flex justify-between text-sm text-theme-text font-bold"><span>UKUPNO SA PDV:</span><span>{totals.za_naplatu} {form.valuta}</span></div>
                                    </>
                                ) : (
                                    <div className="flex justify-between text-sm text-theme-text font-bold"><span>UKUPNO:</span><span>{totals.za_naplatu} {form.valuta}</span></div>
                                )}
                                {parseFloat(form.depozit) > 0 && <div className="flex justify-between text-sm text-emerald-400 font-bold mt-1"><span>Uplaćen depozit / Avans:</span><span>- {parseFloat(form.depozit).toFixed(2)} {form.valuta}</span></div>}
                                <div className="flex justify-between text-xl text-theme-text font-black pt-2 mt-2 border-t border-theme-border"><span>PREOSTALO ZA NAPLATU:</span><span className="text-theme-accent">{(totals.za_naplatu - (parseFloat(form.depozit)||0)).toFixed(2)} {form.valuta}</span></div>
                            </div>
                            <textarea value={form.napomena} onChange={e=>setForm({...form, napomena:e.target.value})} placeholder="Dodatna napomena na ponudi (opciono)..." className="w-full mt-4 p-4 bg-theme-card border border-theme-border rounded-xl text-xs text-theme-text outline-none focus:border-emerald-500 shadow-inner" rows="2"></textarea>
                            <button onClick={snimiPonudu} className={`w-full mt-4 py-5 text-theme-text font-black rounded-2xl uppercase text-sm shadow-xl transition-all tracking-widest ${isEditingPonuda ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>{isEditingPonuda ? '✅ Snimi izmjene ponude' : '✅ Kreiraj Ponudu'}</button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-right">
                    {currentUser?.uloga === 'superadmin' && superadminLogs.length > 0 && (
                        <div className="bg-red-950/50 border-2 border-red-500 p-4 rounded-2xl mb-2 shadow-lg col-span-full animate-pulse">
                            <h3 className="text-red-500 font-black uppercase text-[10px] mb-3 flex items-center gap-2 tracking-widest"><span>🚨</span> SUPERADMIN UPOZORENJA: RUČNA KOREKCIJA RABATA</h3>
                            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                {superadminLogs.map(l => (
                                    <div key={l.id} className="text-[10px] text-slate-300 flex flex-col md:flex-row md:justify-between md:items-center border-b border-red-500/20 pb-2">
                                        <span className="flex-1"><b className="text-red-400">{l.korisnik}</b>: {l.detalji}</span>
                                        <div className="flex items-center gap-4 mt-2 md:mt-0 shrink-0">
                                            <span className="text-slate-500">{new Date(l.vrijeme).toLocaleString('de-DE')}</span>
                                            <button onClick={() => potvrdiUpozorenje(l.id)} className="bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-theme-text px-3 py-1 rounded transition-all font-black uppercase border border-red-500/30 shadow-md">✓ Pročitano</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-emerald-500/30 shadow-2xl" style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <h3 className="text-emerald-500 font-black uppercase text-xs mb-4 flex justify-between"><span>✅ POTVRĐENE PONUDE</span> <span className="bg-emerald-900/40 px-2 rounded">{ponude.filter(p => p.status === 'POTVRĐENA').length}</span></h3>
                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                            {ponude.filter(p => p.status === 'POTVRĐENA').length === 0 && <p className="text-center text-slate-500 text-xs py-10 border-2 border-dashed border-theme-border rounded-xl">Nema potvrđenih ponuda.</p>}
                            {ponude.filter(p => p.status === 'POTVRĐENA').map(p => (
                                <div key={p.id} className="p-4 bg-theme-panel border border-emerald-500/20 rounded-2xl cursor-pointer hover:border-emerald-500 transition-all shadow-md">
                                    <div className="flex justify-between items-start border-b border-theme-border pb-2 mb-2 cursor-pointer" onClick={() => pokreniIzmjenuPonude(p)}>
                                        <div><p className="text-theme-text text-sm font-black">{p.id}</p><p className="text-slate-400 text-xs font-bold mt-1">{p.kupac_naziv}</p></div>
                                        <div className="text-right"><p className="text-emerald-400 font-black text-lg">{p.ukupno_sa_pdv} {p.valuta}</p><p className="text-[9px] text-slate-500 uppercase">{formatirajDatum(p.datum)}</p></div>
                                    </div>
                                    <div className="flex justify-between items-center mt-2"><button onClick={()=>promijeniStatusBrzo(p, 'NA ODLUČIVANJU')} className="text-[9px] text-slate-400 bg-theme-card border border-theme-border px-3 py-1 rounded hover:bg-amber-900/50 hover:text-amber-400 transition-all shadow-sm">Vrati na odlučivanje ↩</button><span className="text-[9px] text-slate-500">Stavki: {p.stavke_jsonb ? p.stavke_jsonb.length : 0}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-6">
                        <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-amber-500/30 shadow-2xl" style={{ backgroundColor: saas.ui.boja_kartice }}>
                            <h3 className="text-amber-500 font-black uppercase text-xs mb-4 flex justify-between"><span>⏳ NA ODLUČIVANJU</span> <span className="bg-amber-900/40 px-2 rounded">{ponude.filter(p => p.status === 'NA ODLUČIVANJU').length}</span></h3>
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {ponude.filter(p => p.status === 'NA ODLUČIVANJU').length === 0 && <p className="text-center text-slate-500 text-xs py-5">Sve ponude su obrađene.</p>}
                                {ponude.filter(p => p.status === 'NA ODLUČIVANJU').map(p => (
                                    <div key={p.id} className="p-4 bg-theme-panel border border-amber-500/20 rounded-2xl cursor-pointer hover:border-amber-500 transition-all shadow-md">
                                        <div className="flex justify-between items-start border-b border-theme-border pb-2 mb-2 cursor-pointer" onClick={() => pokreniIzmjenuPonude(p)}>
                                            <div><p className="text-theme-text text-sm font-black">{p.id}</p><p className="text-slate-400 text-xs font-bold mt-1">{p.kupac_naziv}</p></div>
                                            <div className="text-right"><p className="text-emerald-400 font-black text-lg">{p.ukupno_sa_pdv} {p.valuta}</p><p className="text-[9px] text-slate-500 uppercase">{formatirajDatum(p.datum)}</p></div>
                                        </div>
                                        <div className="flex justify-between items-center mt-2"><button onClick={()=>promijeniStatusBrzo(p, 'POTVRĐENA')} className="text-[9px] text-theme-text font-black bg-emerald-600 px-3 py-1 rounded hover:bg-emerald-500 transition-all shadow-md uppercase tracking-widest w-full">Potvrdi Ponudu ✅</button></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {ponude.filter(p => p.status === 'REALIZOVANA ✅').length > 0 && (
                            <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-blue-500/30 shadow-2xl opacity-70 hover:opacity-100 transition-all" style={{ backgroundColor: saas.ui.boja_kartice }}>
                                <h3 className="text-blue-500 font-black uppercase text-xs mb-4">🔐 REALIZOVANO (ZATVORENO)</h3>
                                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                    {ponude.filter(p => p.status === 'REALIZOVANA ✅').map(p => (
                                        <div key={p.id} onClick={() => pokreniIzmjenuPonude(p)} className="p-4 bg-theme-panel border border-theme-border rounded-2xl cursor-pointer shadow-sm">
                                            <div className="flex justify-between items-start cursor-pointer">
                                                <div><p className="text-theme-text text-sm font-black">{p.id}</p><p className="text-slate-400 text-xs font-bold mt-1">{p.kupac_naziv}</p></div>
                                                <div className="text-right"><p className="text-emerald-400 font-black text-lg">{p.ukupno_sa_pdv} {p.valuta}</p><p className="text-[9px] text-slate-500 uppercase">{formatirajDatum(p.datum)}</p></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}