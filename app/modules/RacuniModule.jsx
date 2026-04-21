"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import SearchableInput from '../components/SearchableInput';
import SettingsModule from './SettingsModule';
import { printDokument } from '../utils/printHelpers';
import { useSaaS } from '../utils/useSaaS';

const supabase = createClient('https://awaxwejrhmjeqohrgidm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY');

function RAC_SearchableProizvod({ katalog, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value);
    useEffect(() => { setSearch(value); }, [value]);

    const filtered = katalog.filter(k => k.sifra.toUpperCase().includes(search.toUpperCase()) || k.naziv.toUpperCase().includes(search.toUpperCase()));

    return (
        <div className="relative font-black w-full">
            <input value={search} onFocus={() => setOpen(true)} onChange={e => { setSearch(e.target.value); setOpen(true); }} placeholder="Pronađi šifru ili naziv..." className="w-full p-4 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-red-500 shadow-inner" />
            {open && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    {filtered.map(k => {
                        const tekstZaPolje = `${k.sifra} | ${k.naziv} | Dim: ${k.visina}x${k.sirina}x${k.duzina}`;
                        return (
                            <div key={k.sifra} onClick={() => { onChange(k.sifra, tekstZaPolje); setSearch(tekstZaPolje); setOpen(false); }} className="p-3 border-b border-slate-700 hover:bg-red-600 cursor-pointer transition-all">
                                <div className="text-white text-xs font-black">{k.sifra} <span className="text-red-300 ml-1">{k.naziv}</span></div>
                                <div className="text-[9px] text-slate-400 mt-1 uppercase">Cijena: {k.cijena} KM</div>
                            </div>
                        )
                    })}
                    <div onClick={() => setOpen(false)} className="p-2 text-center text-[8px] text-slate-500 cursor-pointer hover:text-white bg-slate-900 sticky bottom-0">Zatvori</div>
                </div>
            )}
        </div>
    );
}

export default function RacuniModule({ user, header, setHeader, onExit }) {
    const loggedUser = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');
    const currentUser = user?.ime_prezime ? user : loggedUser;

    const hasKupacEdit = currentUser.uloga === 'admin' || (currentUser.dozvole && currentUser.dozvole.includes('Baza Kupaca (Edit)'));
    const hasKatalogEdit = currentUser.uloga === 'admin' || (currentUser.dozvole && currentUser.dozvole.includes('Katalog Proizvoda (Edit)'));

    // === SaaS ALAT (Konfiguracija za zaglavlje računa) ===
    const saas = useSaaS('racuni_zaglavlje', {
        boja_kartice: '#1e293b',
        boja_naslova: 'text-red-500',
        polja: [
            { id: 'veza', label: 'Vezni Dokument (Istorija)', span: 'col-span-2' },
            { id: 'broj', label: 'BROJ RAČUNA', span: 'col-span-2' },
            { id: 'kupac', label: '* KUPAC', span: 'col-span-2' },
            { id: 'datum', label: 'Datum izdavanja', span: 'col-span-1' },
            { id: 'rok', label: 'Rok plaćanja', span: 'col-span-1' },
            { id: 'placanje', label: 'Način Plaćanja', span: 'col-span-1' },
            { id: 'valuta', label: 'Valuta', span: 'col-span-1' },
            { id: 'status', label: 'Status Računa', span: 'col-span-2' }
        ]
    });

    const aktivnaPolja = saas.ui.polja?.length > 0 ? saas.ui.polja : saas.defaultConfig.polja;

    // Drag & Drop i Resize Logika
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

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

    const updatePolje = (index, key, val) => {
        const novaLista = [...aktivnaPolja];
        novaLista[index][key] = val;
        saas.setUi({...saas.ui, polja: novaLista});
    };

    const toggleVelicinaPolja = (index) => {
        const novaLista = [...aktivnaPolja];
        const trenutno = novaLista[index].span;
        novaLista[index].span = trenutno === 'col-span-1' ? 'col-span-2' : (trenutno === 'col-span-2' ? 'col-span-4' : 'col-span-1');
        saas.setUi({...saas.ui, polja: novaLista});
    };

    const spremiDimenzije = (e, index) => {
        if (!saas.isEditMode) return;
        const w = e.currentTarget.style.width;
        const h = e.currentTarget.style.height;
        if (w || h) {
            const novaLista = [...aktivnaPolja];
            if (w) novaLista[index].customWidth = w;
            if (h) novaLista[index].customHeight = h;
            saas.setUi({...saas.ui, polja: novaLista});
        }
    };
    // ===========================

    const [tab, setTab] = useState('novi');
    const [kupci, setKupci] = useState([]);
    const [katalog, setKatalog] = useState([]);
    const [racuni, setRacuni] = useState([]);

    const generisiID = () => `RAC-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;

    const formatirajDatum = (isoString) => {
        if(!isoString) return '';
        if(isoString.includes('.')) return isoString; 
        const [y, m, d] = isoString.split('T')[0].split('-');
        return `${d}.${m}.${y}.`;
    };

    const [form, setForm] = useState({
        id: generisiID(), broj_veze: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0],
        rok_placanja: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString().split('T')[0],
        nacin_placanja: 'Virmanski', valuta: 'KM', napomena: '', status: 'NENAPLAĆENO', originalna_ponuda: null
    });

    const [isEditing, setIsEditing] = useState(false);
    const [odabraniKupac, setOdabraniKupac] = useState(null);
    const [stavke, setStavke] = useState([]);
    
    const [showBrziKupac, setShowBrziKupac] = useState(false);
    const [showBrziKatalog, setShowBrziKatalog] = useState(false);

    const [dostupniDokumenti, setDostupniDokumenti] = useState([]);
    const [prikaziDrop, setPrikaziDrop] = useState(false);
    const [kucanjeTimer, setKucanjeTimer] = useState(null);
    const [skenerInput, setSkenerInput] = useState('');

    const [stavkaForm, setStavkaForm] = useState({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3', sistemski_rabat: 0, konacni_rabat: '' });
    const [trenutniProizvod, setTrenutniProizvod] = useState(null);

    useEffect(() => { load(); }, []);

    const load = async () => {
        const {data: k} = await supabase.from('kupci').select('*').order('naziv'); setKupci(k||[]);
        const {data: cat} = await supabase.from('katalog_proizvoda').select('*').order('sifra'); setKatalog(cat||[]);
        const {data: r} = await supabase.from('racuni').select('*').order('datum', { ascending: false }); setRacuni(r||[]);
        
        const { data: rn } = await supabase.from('radni_nalozi').select('id, kupac_naziv, status').neq('status', 'ZAVRŠENO');
        const { data: pon } = await supabase.from('ponude').select('id, kupac_naziv, status').in('status', ['POTVRĐENA', 'REALIZOVANA ✅']);
        const { data: otp } = await supabase.from('otpremnice').select('id, kupac_naziv, status');
        
        setDostupniDokumenti([
            ...(otp || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Otpremnica' })),
            ...(rn || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Radni Nalog' })),
            ...(pon || []).map(d => ({ id: d.id, kupac: d.kupac_naziv, tip: 'Ponuda' }))
        ]);
    };

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: currentUser.ime_prezime || 'Nepoznat', akcija, detalji }]);
    };

    const sinhronizujKasu = async (racunId, status, nacinPlacanja, kupacNaziv, ukupnoZaNaplatu) => {
        const { data: transakcije } = await supabase.from('blagajna').select('*').eq('racun_id', racunId);
        const uplate = (transakcije || []).filter(t => t.tip === 'ULAZ').reduce((acc, t) => acc + parseFloat(t.iznos), 0);
        const storna = (transakcije || []).filter(t => t.tip === 'IZLAZ' && t.kategorija === 'Storno Naplate').reduce((acc, t) => acc + parseFloat(t.iznos), 0);
        const netoUplaceno = uplate - storna;

        if (status === 'NAPLAĆENO' && nacinPlacanja === 'Gotovina') {
            const zaUplatu = ukupnoZaNaplatu - netoUplaceno;
            if (zaUplatu > 0) {
                await supabase.from('blagajna').insert([{
                    id: `KASA-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000)}`, tip: 'ULAZ', kategorija: 'Naplata Računa',
                    iznos: parseFloat(zaUplatu.toFixed(2)), opis: `Automatska gotovinska naplata računa: ${racunId} (${kupacNaziv})`,
                    racun_id: racunId, datum: new Date().toISOString().split('T')[0], vrijeme_tekst: new Date().toLocaleTimeString('de-DE'), snimio_korisnik: currentUser.ime_prezime || 'Sistem'
                }]);
                await zapisiU_Log('KASA_AUTO_UNOS', `Automatska gotovinska naplata za račun ${racunId}`);
            }
        } else {
            if (netoUplaceno > 0) {
                await supabase.from('blagajna').insert([{
                    id: `KASA-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000)}`, tip: 'IZLAZ', kategorija: 'Storno Naplate',
                    iznos: parseFloat(netoUplaceno.toFixed(2)), opis: `STORNO: Poništena/Izmijenjena naplata računa: ${racunId} (${kupacNaziv})`,
                    racun_id: racunId, datum: new Date().toISOString().split('T')[0], vrijeme_tekst: new Date().toLocaleTimeString('de-DE'), snimio_korisnik: currentUser.ime_prezime || 'Sistem'
                }]);
                await zapisiU_Log('KASA_STORNO', `Automatski storno u blagajni za račun ${racunId} (Stornirano: ${netoUplaceno} KM)`);
            }
        }
    };

    const izracunajRabat = (proizvod, kupac) => {
        if(!kupac || !kupac.rabati_jsonb) return 0;
        const rabati = kupac.rabati_jsonb;
        if (rabati.proizvodi && rabati.proizvodi[proizvod.sifra]) return parseFloat(rabati.proizvodi[proizvod.sifra]);
        if (rabati.kategorije && rabati.kategorije[proizvod.kategorija]) return parseFloat(rabati.kategorije[proizvod.kategorija]);
        if (rabati.ukupni) return parseFloat(rabati.ukupni);
        return 0;
    };

    const skenirajVezu = async (trazeniBroj) => {
        const broj = trazeniBroj.toUpperCase().trim();
        if(!broj) return;
        
        let dokument = null; let baznaPonuda = null; let napomenaTekst = `Povezano sa: ${broj}`;

        let { data: otp } = await supabase.from('otpremnice').select('*').eq('id', broj).maybeSingle();
        if (otp) {
            if (otp.status !== 'ISPORUČENO') {
                const proceed = window.confirm(`⚠️ UPOZORENJE:\nOtpremnica ${broj} je u statusu "${otp.status}".\nRoba još uvijek nije fizički isporučena kupcu!\n\nDa li ste sigurni da želite unaprijed napraviti račun?`);
                if (!proceed) { setSkenerInput(''); return; }
            }
            dokument = otp;
            if (otp.broj_veze) {
                let { data: rn } = await supabase.from('radni_nalozi').select('*').eq('id', otp.broj_veze).maybeSingle();
                if (rn) {
                    napomenaTekst += ` -> ${otp.broj_veze}`;
                    if (rn.broj_ponude) {
                        let { data: pon } = await supabase.from('ponude').select('*').eq('id', rn.broj_ponude).maybeSingle();
                        baznaPonuda = pon; napomenaTekst += ` -> ${rn.broj_ponude}`;
                    }
                } else {
                    let { data: pon } = await supabase.from('ponude').select('*').eq('id', otp.broj_veze).maybeSingle();
                    if(pon) { baznaPonuda = pon; napomenaTekst += ` -> ${otp.broj_veze}`; }
                }
            }
        }
        
        if (!dokument) {
            let { data: rn } = await supabase.from('radni_nalozi').select('*').eq('id', broj).maybeSingle();
            if (rn) {
                dokument = rn;
                if (rn.broj_ponude) {
                    let { data: pon } = await supabase.from('ponude').select('*').eq('id', rn.broj_ponude).maybeSingle();
                    baznaPonuda = pon; napomenaTekst += ` -> ${rn.broj_ponude}`;
                }
            }
        }

        if (!dokument) {
            let { data: pon } = await supabase.from('ponude').select('*').eq('id', broj).maybeSingle();
            if (pon) { dokument = pon; baznaPonuda = pon; }
        }

        if(!dokument) return alert(`❌ Dokument ${broj} nije pronađen nigdje u bazi!`);

        const kupacIzBaze = kupci.find(k => k.naziv === dokument.kupac_naziv);
        setOdabraniKupac(kupacIzBaze || null);

        const stavkeKolicine = dokument.stavke_jsonb || [];
        const stavkeFinansije = baznaPonuda ? (baznaPonuda.stavke_jsonb || []) : [];

        const konacneStavke = stavkeKolicine.map(sk => {
            const proizvod = katalog.find(k => k.sifra === sk.sifra);
            let cijena_baza = proizvod ? parseFloat(proizvod.cijena) : (sk.cijena_baza || 0);
            let rabat_procenat = proizvod && kupacIzBaze ? izracunajRabat(proizvod, kupacIzBaze) : 0;

            const nadjenoUPonudi = stavkeFinansije.find(sf => sf.sifra === sk.sifra);
            if (nadjenoUPonudi) {
                cijena_baza = nadjenoUPonudi.cijena_baza;
                rabat_procenat = nadjenoUPonudi.rabat_procenat;
            }

            const kolicina = sk.kolicina_obracun || sk.kolicina || 0;
            const ukupno_bez_rabata = kolicina * cijena_baza;
            const iznos_rabata = ukupno_bez_rabata * (rabat_procenat / 100);
            const ukupno = ukupno_bez_rabata - iznos_rabata;

            return {
                id: Math.random().toString(), sifra: sk.sifra, naziv: sk.naziv,
                kolicina_unos: sk.kolicina_unos || kolicina, jm_unos: sk.jm_unos || sk.jm_obracun || 'kom',
                kolicina_obracun: kolicina, jm_obracun: sk.jm_obracun || sk.jm || 'kom',
                cijena_baza, rabat_procenat, iznos_rabata, ukupno
            };
        });

        setForm({ ...form, kupac_naziv: dokument.kupac_naziv, broj_veze: broj, napomena: napomenaTekst, originalna_ponuda: baznaPonuda ? baznaPonuda.id : null });
        setStavke(konacneStavke); setSkenerInput('');
        alert(`✅ Učitane količine sa: ${broj}\n${baznaPonuda ? '✅ Primijenjene cijene iz originalne ponude: ' + baznaPonuda.id : '⚠️ Nema bazne ponude, primijenjene standardne cijene.'}`);
    };

    const handleSkenUnos = (e) => {
        const val = e.target.value.toUpperCase();
        setSkenerInput(val); setPrikaziDrop(true); 
        if (kucanjeTimer) clearTimeout(kucanjeTimer);
        if (val) { setKucanjeTimer(setTimeout(() => { setPrikaziDrop(false); skenirajVezu(val); }, 2000)); }
    };

    const handleProizvodSelect = (sifraVal, tekstZaPolje) => {
        const nadjeni = katalog.find(k => k.sifra === sifraVal);
        setTrenutniProizvod(nadjeni || null);
        if (nadjeni) {
            const predlozeniRabat = izracunajRabat(nadjeni, odabraniKupac);
            setStavkaForm({ ...stavkaForm, id: null, sifra_unos: tekstZaPolje, jm_unos: 'kom', jm_obracun: nadjeni.default_jedinica || 'm3', sistemski_rabat: predlozeniRabat, konacni_rabat: predlozeniRabat });
        }
    };

    useEffect(() => {
        if(!trenutniProizvod || !stavkaForm.kolicina_unos) return;
        const kol = parseFloat(stavkaForm.kolicina_unos);
        let obracun = kol;
        if (stavkaForm.jm_unos === 'kom' && stavkaForm.jm_obracun !== 'kom') {
            const v = parseFloat(trenutniProizvod.visina) || 1; const s = parseFloat(trenutniProizvod.sirina) || 1; const d = parseFloat(trenutniProizvod.duzina) || 1;
            if (stavkaForm.jm_obracun === 'm3') obracun = kol * (v/100) * (s/100) * (d/100);
            if (stavkaForm.jm_obracun === 'm2') obracun = kol * (s/100) * (d/100);
            if (stavkaForm.jm_obracun === 'm1') obracun = kol * (d/100);
        }
        setStavkaForm(prev => ({...prev, kolicina_obracun: obracun > 0 ? obracun.toFixed(4) : kol}));
    }, [stavkaForm.kolicina_unos, stavkaForm.jm_unos, stavkaForm.jm_obracun, trenutniProizvod]);

    const dodajStavku = async () => {
        if(!trenutniProizvod || !stavkaForm.kolicina_obracun) return alert("Odaberite proizvod i količinu!");
        if(!odabraniKupac) return alert("Prvo odaberite kupca za pravilan obračun!");

        const kolicina = parseFloat(stavkaForm.kolicina_obracun);
        const cijena_baza = parseFloat(trenutniProizvod.cijena);
        const rabat_konacni = parseFloat(stavkaForm.konacni_rabat) || 0;
        
        const ukupno_bez_rabata = kolicina * cijena_baza;
        const iznos_rabata = ukupno_bez_rabata * (rabat_konacni / 100);
        const ukupno_sa_rabatom = ukupno_bez_rabata - iznos_rabata;

        const novaStavka = {
            id: stavkaForm.id || Math.random().toString(), sifra: trenutniProizvod.sifra, naziv: trenutniProizvod.naziv,
            kolicina_unos: parseFloat(stavkaForm.kolicina_unos), jm_unos: stavkaForm.jm_unos, kolicina_obracun: kolicina, jm_obracun: stavkaForm.jm_obracun,
            cijena_baza, rabat_procenat: rabat_konacni, iznos_rabata, ukupno: ukupno_sa_rabatom
        };

        if (stavkaForm.id) setStavke(stavke.map(s => s.id === stavkaForm.id ? novaStavka : s)); else setStavke([...stavke, novaStavka]);
        setStavkaForm({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3', sistemski_rabat: 0, konacni_rabat: '' }); setTrenutniProizvod(null);
    };

    const urediStavku = (stavka) => {
        const nadjeni = katalog.find(k => k.sifra === stavka.sifra);
        setTrenutniProizvod(nadjeni || null);
        const tekstZaPolje = nadjeni ? `${nadjeni.sifra} | ${nadjeni.naziv}` : stavka.sifra;
        setStavkaForm({ 
            id: stavka.id, sifra_unos: tekstZaPolje, kolicina_unos: stavka.kolicina_unos, jm_unos: stavka.jm_unos, 
            kolicina_obracun: stavka.kolicina_obracun, jm_obracun: stavka.jm_obracun, sistemski_rabat: izracunajRabat(nadjeni, odabraniKupac), konacni_rabat: stavka.rabat_procenat 
        });
    };

    const ukloniStavku = (id) => setStavke(stavke.filter(s => s.id !== id));

    const totals = useMemo(() => {
        let suma_bez_rabata = 0, suma_rabata = 0, suma_krajnja = 0;
        stavke.forEach(s => { suma_bez_rabata += (s.kolicina_obracun * s.cijena_baza); suma_rabata += s.iznos_rabata; suma_krajnja += s.ukupno; });
        const pdv = suma_krajnja * 0.17; 
        return { bez_rabata: suma_bez_rabata.toFixed(2), rabat: suma_rabata.toFixed(2), osnovica: suma_krajnja.toFixed(2), pdv: pdv.toFixed(2), za_naplatu: (suma_krajnja + pdv).toFixed(2) };
    }, [stavke]);

    const snimiRacun = async () => {
        if(!form.kupac_naziv) return alert("Kupac je obavezan!");
        if(stavke.length === 0) return alert("Račun mora imati stavke!");
        
        const payload = {
            id: form.id.toUpperCase(), broj_veze: form.broj_veze, kupac_naziv: form.kupac_naziv, datum: form.datum, rok_placanja: form.rok_placanja, nacin_placanja: form.nacin_placanja, valuta: form.valuta, napomena: form.napomena, stavke_jsonb: stavke, status: form.status,
            ukupno_bez_pdv: parseFloat(totals.osnovica), ukupno_rabat: parseFloat(totals.rabat), ukupno_sa_pdv: parseFloat(totals.za_naplatu),
            snimio_korisnik: currentUser.ime_prezime
        };

        if (isEditing) {
            const { error } = await supabase.from('racuni').update(payload).eq('id', form.id);
            if(error) return alert("Greška: " + error.message);
            await zapisiU_Log('IZMJENA_RACUNA', `Ažuriran račun ${form.id}`);
            alert("✅ Račun uspješno ažuriran!");
        } else {
            const { error } = await supabase.from('racuni').insert([payload]);
            if(error) return alert("Greška pri snimanju: " + error.message);
            
            if (form.originalna_ponuda) {
                await supabase.from('ponude').update({ status: 'REALIZOVANA ✅' }).eq('id', form.originalna_ponuda);
                await zapisiU_Log('ZATVARANJE_PONUDE', `Ponuda ${form.originalna_ponuda} zatvorena kreiranjem računa ${form.id}`);
            }

            await zapisiU_Log('KREIRAN_RACUN', `Račun ${form.id} za ${form.kupac_naziv}`);
            alert("✅ Račun uspješno kreiran!");
        }

        await sinhronizujKasu(form.id, form.status, form.nacin_placanja, form.kupac_naziv, totals.za_naplatu);

        resetFormu(); load(); setTab('otvoreni');
    };

    const kreirajPDF = () => {
        const odabraniKupac = kupci.find(k => k.naziv === form.kupac_naziv) || null;
        let redovi = stavke.map((s, i) => `
            <tr>
                <td style="font-weight: bold; color: #64748b; text-align: center;">${i+1}.</td>
                <td><b style="color: #0f172a; font-size: 13px;">${s.sifra}</b><br/><span style="color: #64748b; font-size: 11px;">${s.naziv}</span></td>
                <td style="text-align: center; font-weight: 800; color: #0f172a;">${s.kolicina_obracun} <span style="color: #64748b; font-size: 10px; font-weight: 600;">${s.jm_obracun}</span></td>
                <td style="text-align: right; font-weight: 600;">${s.cijena_baza.toFixed(2)}</td>
                <td style="text-align: right; color: #ec4899; font-weight: 800;">${s.rabat_procenat > 0 ? s.rabat_procenat + '%' : '-'}</td>
                <td style="text-align: right; font-weight: 800; color: #0f172a; font-size: 13px;">${s.ukupno.toFixed(2)}</td>
            </tr>
        `).join('');

        const htmlSadrzajTabela = `
            <div class="info-grid">
                <div class="info-col">
                    <h4>Kupac / Primalac usluge</h4>
                    <p style="font-size: 18px; font-weight: 900; margin-bottom: 5px;">${form.kupac_naziv}</p>
                    <p style="font-weight: 400; color: #475569;">${odabraniKupac?.adresa || ''}</p>
                    <p style="font-weight: 600; color: #0f172a; font-size: 12px; margin-top: 6px;">PDV / ID: ${odabraniKupac?.pdv_broj || 'N/A'}</p>
                </div>
                <div class="info-col" style="text-align: right;">
                    <h4>Detalji Računa</h4>
                    <p>Vezni Dokument: <span style="font-weight: 600; color: #0f172a;">${form.broj_veze || '-'}</span></p>
                    <p>Plaćanje: <span style="font-weight: 600; color: #0f172a;">${form.nacin_placanja}</span></p>
                    <p style="color: #ef4444; margin-top: 8px; font-weight: 800;">Rok plaćanja: ${formatirajDatum(form.rok_placanja)}</p>
                </div>
            </div>
            <table>
                <thead><tr><th style="width: 5%; text-align: center;">R.B.</th><th>Šifra i Naziv Proizvoda</th><th style="text-align:center;">Količina</th><th style="text-align:right;">Cijena</th><th style="text-align:right;">Rabat</th><th style="text-align:right;">Ukupno (${form.valuta})</th></tr></thead>
                <tbody>${redovi}</tbody>
            </table>
            
            <div class="summary-box">
                <div class="summary-row"><span>Iznos bez rabata:</span> <b>${totals.bez_rabata}</b></div>
                <div class="summary-row"><span style="color: #ec4899; font-weight: bold;">Uračunati rabat:</span> <b style="color: #ec4899;">- ${totals.rabat}</b></div>
                <div class="summary-row"><span>Osnovica za PDV:</span> <b>${totals.osnovica}</b></div>
                <div class="summary-row"><span>PDV iznos (17%):</span> <b>${totals.pdv}</b></div>
                <div class="summary-total">
                    <span style="font-size: 14px; letter-spacing: 1px; padding-top:4px;">ZA NAPLATU:</span>
                    <span>${totals.za_naplatu} ${form.valuta}</span>
                </div>
            </div>
            <div class="footer"><div style="width: 100%;"><b style="color: #0f172a;">Napomena uz račun:</b><br/>${form.napomena || 'Zahvaljujemo se na povjerenju.'}</div></div>
        `;
        printDokument('RAČUN', form.id, formatirajDatum(form.datum), htmlSadrzajTabela, '#ef4444');
    };

    const resetFormu = () => {
        setForm({ id: generisiID(), broj_veze: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0], rok_placanja: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString().split('T')[0], nacin_placanja: 'Virmanski', valuta: 'KM', napomena: '', status: 'NENAPLAĆENO', originalna_ponuda: null });
        setStavke([]); setSkenerInput(''); setIsEditing(false); setOdabraniKupac(null); setStavkaForm({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3', sistemski_rabat: 0, konacni_rabat: '' });
    };

    const handleKupacSelect = (naziv) => {
        setForm({...form, kupac_naziv: naziv});
        setOdabraniKupac(kupci.find(k => k.naziv === naziv) || null);
    };

    const pokreniIzmjenu = (r) => {
        setForm({ id: r.id, broj_veze: r.broj_veze || '', kupac_naziv: r.kupac_naziv, datum: r.datum, rok_placanja: r.rok_placanja || '', nacin_placanja: r.nacin_placanja || 'Virmanski', valuta: r.valuta || 'KM', napomena: r.napomena || '', status: r.status || 'NENAPLAĆENO', originalna_ponuda: null });
        setStavke(r.stavke_jsonb || []);
        setOdabraniKupac(kupci.find(k => k.naziv === r.kupac_naziv) || null);
        setIsEditing(true); setTab('novi'); window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const promijeniStatusBrzo = async (r, noviStatus) => {
        await supabase.from('racuni').update({ status: noviStatus }).eq('id', r.id);
        await zapisiU_Log('STATUS_RACUNA', `Račun ${r.id} prebačen u ${noviStatus}`);
        await sinhronizujKasu(r.id, noviStatus, r.nacin_placanja, r.kupac_naziv, r.ukupno_sa_pdv);
        load();
    };

    const neplaceni = racuni.filter(r => r.status === 'NENAPLAĆENO');
    const placeni = racuni.filter(r => r.status === 'NAPLAĆENO');

    const renderPoljeHeader = (polje) => {
        if (polje.id === 'veza') return <input value={form.broj_veze} onChange={e=>setForm({...form, broj_veze:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-slate-900 rounded-xl text-white outline-none border border-slate-700 uppercase focus:border-red-500 shadow-inner" placeholder="Nema veze" />;
        if (polje.id === 'broj') return <input value={form.id} disabled className="w-full h-full min-h-[45px] p-4 bg-slate-800 rounded-xl text-white border border-slate-700 font-black disabled:opacity-50" />;
        if (polje.id === 'kupac') return (
            <div className="flex gap-2 items-center w-full h-full">
                <div className="flex-1 min-w-0 h-full"><SearchableInput value={form.kupac_naziv} onChange={handleKupacSelect} list={kupci.map(k=>k.naziv)} /></div>
                {hasKupacEdit && <button onClick={() => setShowBrziKupac(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 h-full min-h-[45px] rounded-xl shadow-lg shrink-0 text-[10px] font-black">➕ NOVI</button>}
            </div>
        );
        if (polje.id === 'datum') return <input type="date" value={form.datum} onChange={e=>setForm({...form, datum:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-red-500 shadow-inner" />;
        if (polje.id === 'rok') return <input type="date" value={form.rok_placanja} onChange={e=>setForm({...form, rok_placanja:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-red-500 shadow-inner" />;
        if (polje.id === 'placanje') return <select value={form.nacin_placanja} onChange={e=>setForm({...form, nacin_placanja:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-red-500 shadow-inner"><option value="Virmanski">Virmanski</option><option value="Gotovina">Gotovina</option><option value="Kartica">Kartica</option></select>;
        if (polje.id === 'valuta') return <select value={form.valuta} onChange={e=>setForm({...form, valuta:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700 focus:border-red-500 shadow-inner"><option value="KM">KM</option><option value="EUR">EUR</option></select>;
        if (polje.id === 'status') return <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-red-900/20 rounded-xl text-xs text-red-400 font-black border border-red-500/50 outline-none"><option value="NENAPLAĆENO">Nenaplaćeno</option><option value="NAPLAĆENO">NAPLAĆENO</option></select>;
        return null;
    };

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 font-bold animate-in fade-in">
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-red-500" user={user} modulIme="računi" saas={saas} />

            <div className="flex bg-[#1e293b] p-1 rounded-2xl border border-slate-700 shadow-xl">
                <button onClick={() => {setTab('novi'); if(!isEditing) resetFormu();}} className={`flex-1 py-3 rounded-xl text-[10px] uppercase font-black transition-all ${tab === 'novi' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}>
                    {isEditing ? '✏️ Ažuriranje Računa' : '➕ Kreiraj Račun'}
                </button>
                <button onClick={() => setTab('otvoreni')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-2 ${tab === 'otvoreni' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}>
                    ⏳ Otvoreni Računi <span className="bg-red-900/40 text-white px-2 rounded-full">{neplaceni.length}</span>
                </button>
                <button onClick={() => setTab('arhiva')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-2 ${tab === 'arhiva' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}>
                    🔐 Arhiva (Naplaćeno) <span className="bg-emerald-900/40 text-emerald-400 px-2 rounded-full">{placeni.length}</span>
                </button>
            </div>

            {tab === 'novi' ? (
                <div className="space-y-4 animate-in slide-in-from-left max-w-4xl mx-auto">
                    {showBrziKupac && (
                        <div className="fixed inset-0 z-[200] bg-[#090e17]/95 flex flex-col p-4 overflow-y-auto backdrop-blur-md animate-in fade-in">
                            <SettingsModule onExit={() => { setShowBrziKupac(false); load(); }} lockedTab="kupci" />
                        </div>
                    )}
                    {showBrziKatalog && (
                        <div className="fixed inset-0 z-[200] bg-[#090e17]/95 flex flex-col p-4 overflow-y-auto backdrop-blur-md animate-in fade-in">
                            <SettingsModule onExit={() => { setShowBrziKatalog(false); load(); }} lockedTab="katalog" />
                        </div>
                    )}

                    {!isEditing && (
                        <div className="bg-slate-900 border border-red-500/50 p-6 rounded-3xl shadow-2xl relative z-[60]">
                            <div className="flex gap-3 items-center">
                                <div className="text-2xl hidden md:block">📷</div>
                                <div className="flex-1 relative">
                                    <label className="text-[10px] text-red-400 uppercase font-black block mb-1 ml-2">Pametni unos (Skeniraj OTP, RN ili PON)</label>
                                    <input value={skenerInput} onChange={handleSkenUnos} onFocus={() => setPrikaziDrop(true)} placeholder="Skeniraj ili ukucaj broj..." className="w-full p-4 bg-[#0f172a] border-2 border-red-500 rounded-xl text-sm text-white outline-none focus:border-red-400 uppercase font-black shadow-inner relative z-10" />
                                    
                                    {prikaziDrop && skenerInput && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden z-[100] max-h-60 overflow-y-auto text-left">
                                            {dostupniDokumenti.filter(d => d.id.includes(skenerInput) || (d.kupac && d.kupac.toUpperCase().includes(skenerInput))).length === 0 && <div className="p-3 text-xs text-slate-500 text-center">Nema rezultata...</div>}
                                            {dostupniDokumenti
                                                .filter(d => d.id.includes(skenerInput) || (d.kupac && d.kupac.toUpperCase().includes(skenerInput)))
                                                .map(p => (
                                                <div key={p.id} onClick={() => {
                                                    setSkenerInput(p.id); setPrikaziDrop(false);
                                                    if (kucanjeTimer) clearTimeout(kucanjeTimer);
                                                    skenirajVezu(p.id);
                                                }} className="p-3 border-b border-slate-700 hover:bg-red-600 cursor-pointer flex justify-between items-center transition-all">
                                                    <div><span className="text-white font-black">{p.id}</span> <span className="text-[10px] text-red-300 ml-2 uppercase font-bold">{p.tip}</span></div>
                                                    <div className="text-slate-400 text-xs font-bold">{p.kupac}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={`p-6 rounded-[2.5rem] border-2 shadow-2xl space-y-4 transition-all relative z-[40] ${saas.isEditMode ? 'border-dashed border-amber-500 bg-black/20' : (isEditing ? 'border-amber-500/50 bg-[#1e293b]' : 'border-red-500/30 bg-[#1e293b]')}`} style={{ backgroundColor: saas.isEditMode ? '' : saas.ui.boja_kartice }}>
                        <div className="flex justify-between items-center mb-2">
                            <h3 className={`${isEditing ? 'text-amber-500' : saas.ui.boja_naslova} font-black uppercase text-xs`}>1. Parametri Računa</h3>
                            {isEditing && <button onClick={resetFormu} className="text-[10px] bg-red-900/30 text-red-400 px-3 py-1 rounded-xl uppercase hover:bg-red-900/50 transition-all">Odustani od izmjena ✕</button>}
                        </div>

                        {saas.isEditMode && (
                            <div className="bg-black/40 p-3 rounded-xl flex flex-wrap gap-4 items-center mb-4 border border-amber-500/30">
                                <label className="text-[10px] text-amber-500 uppercase font-black flex items-center gap-2">Boja Pozadine: <input type="color" value={saas.ui.boja_kartice || '#1e293b'} onChange={e => saas.setUi({...saas.ui, boja_kartice: e.target.value})} className="w-8 h-8 cursor-pointer rounded border-none bg-transparent" /></label>
                                <label className="text-[10px] text-amber-500 uppercase font-black flex items-center gap-2">Boja Naslova: <input type="text" value={saas.ui.boja_naslova || 'text-red-500'} onChange={e => saas.setUi({...saas.ui, boja_naslova: e.target.value})} className="w-32 p-1 bg-slate-900 border border-slate-700 rounded text-white font-mono" placeholder="text-red-500" /></label>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border-b border-slate-700 pb-4 items-start">
                            {aktivnaPolja.map((polje, index) => (
                                <div key={polje.id} className={`relative flex flex-col ${polje.span} transition-all ${saas.isEditMode ? 'border-2 border-dashed border-amber-500 p-2 rounded-xl bg-black/20 resize overflow-auto' : ''}`} style={{ maxWidth: '100%', ...(saas.isEditMode ? { minWidth: '100px', minHeight: '80px' } : {}), width: polje.customWidth || undefined, height: polje.customHeight || undefined }} draggable={saas.isEditMode} onDragStart={(e) => handleDragStart(e, index)} onDragEnter={(e) => handleDragEnter(e, index)} onDragEnd={handleDrop} onDragOver={(e) => e.preventDefault()} onMouseUp={(e) => spremiDimenzije(e, index)}>
                                    {saas.isEditMode && (<div className="flex justify-between items-center mb-2 shrink-0"><span className="text-[9px] text-amber-500 uppercase font-black cursor-move">☰</span><button onClick={() => toggleVelicinaPolja(index)} className="text-[8px] text-amber-500 font-black bg-amber-500/20 px-2 py-1 rounded">ŠIRINA: {polje.span==='col-span-4'?'100%':polje.span==='col-span-2'?'50%':'25%'}</button></div>)}
                                    {saas.isEditMode ? (<input value={polje.label} onChange={(e) => updatePolje(index, 'label', e.target.value)} className="w-full bg-slate-900 text-amber-400 p-1 mb-1 rounded border border-amber-500/50 text-[8px] uppercase font-black text-center shrink-0" placeholder="Naslov polja" />) : (polje.label && <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1 shrink-0">{polje.label}</label>)}
                                    <div className={`flex-1 ${saas.isEditMode ? 'opacity-50 pointer-events-none' : ''}`}>{renderPoljeHeader(polje)}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-4 relative z-[30]">
                        <h3 className="text-blue-500 font-black uppercase text-xs mb-4">2. Dinamički dodaj / uredi stavke</h3>
                        
                        <div className="relative z-40 mb-3">
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Pronađi proizvod za dodavanje</label>
                            <div className="flex gap-2 items-center w-full">
                                <div className="flex-1 min-w-0">
                                    <RAC_SearchableProizvod katalog={katalog} value={stavkaForm.sifra_unos} onChange={handleProizvodSelect} />
                                </div>
                                {hasKatalogEdit && <button onClick={() => setShowBrziKatalog(true)} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-3 rounded-xl shadow-lg shrink-0 text-[10px] font-black">➕ NOVI</button>}
                            </div>
                        </div>

                        {trenutniProizvod && (
                            <div className="p-4 bg-blue-900/10 border border-blue-500/30 rounded-2xl animate-in zoom-in-95 space-y-4 shadow-inner">
                                <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                                    <div><p className="text-white text-sm font-black">{trenutniProizvod.sifra} - {trenutniProizvod.naziv}</p><p className="text-[10px] text-slate-400">Dim: {trenutniProizvod.visina}x{trenutniProizvod.sirina}x{trenutniProizvod.duzina}</p></div>
                                    <div className="text-right"><p className="text-[10px] text-slate-400 uppercase">Baza</p><p className="text-red-400 font-black text-lg">{trenutniProizvod.cijena} {form.valuta}</p></div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                                    <div className="col-span-2">
                                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Unos: Količina i Jedinica</label>
                                        <div className="flex gap-1">
                                            <input type="number" value={stavkaForm.kolicina_unos} onChange={e=>setStavkaForm({...stavkaForm, kolicina_unos:e.target.value})} placeholder="0" className="flex-1 p-3 bg-[#0f172a] rounded-xl text-sm text-white font-black text-center outline-none border border-slate-700 focus:border-red-500 shadow-inner" />
                                            <select value={stavkaForm.jm_unos} onChange={e=>setStavkaForm({...stavkaForm, jm_unos:e.target.value})} className="w-20 p-3 bg-slate-800 rounded-xl text-xs text-white outline-none border border-slate-700 shadow-inner"><option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option></select>
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Obračun po</label>
                                        <div className="flex gap-1">
                                            <input type="number" value={stavkaForm.kolicina_obracun} onChange={e=>setStavkaForm({...stavkaForm, kolicina_obracun:e.target.value})} className="flex-1 p-3 bg-red-900/20 rounded-xl text-sm text-red-400 font-black text-center outline-none border border-red-500/50 shadow-inner" />
                                            <select value={stavkaForm.jm_obracun} onChange={e=>setStavkaForm({...stavkaForm, jm_obracun:e.target.value})} className="w-20 p-3 bg-slate-800 rounded-xl text-xs text-white outline-none border border-slate-700 shadow-inner"><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option><option value="kom">kom</option></select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[8px] text-pink-500 uppercase ml-2 block mb-1 font-black">Rabat %</label>
                                        <input type="number" value={stavkaForm.konacni_rabat} onChange={e=>setStavkaForm({...stavkaForm, konacni_rabat:e.target.value})} className="w-full p-3 bg-pink-900/20 rounded-xl text-sm text-pink-400 font-black text-center outline-none border border-pink-500/50 shadow-inner" title={`Sistemski predloženo: ${stavkaForm.sistemski_rabat}%`} />
                                    </div>
                                </div>
                                <button onClick={dodajStavku} className={`w-full py-4 text-white font-black rounded-xl text-xs shadow-lg uppercase mt-2 transition-all ${stavkaForm.id ? 'bg-amber-600 hover:bg-amber-500' : 'bg-red-600 hover:bg-red-500'}`}>
                                    {stavkaForm.id ? '✅ Ažuriraj ovu stavku' : '➕ Dodaj stavku na račun'}
                                </button>
                            </div>
                        )}
                    </div>

                    {stavke.length > 0 && (
                        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-red-500/30 shadow-2xl animate-in slide-in-from-bottom">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-red-400 font-black uppercase text-xs">3. Konačni obračun</h3>
                                <button onClick={kreirajPDF} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-[10px] uppercase font-black border border-slate-600 hover:bg-white hover:text-black transition-all shadow-md">
                                    🖨️ Kreiraj PDF
                                </button>
                            </div>
                            
                            <div className="space-y-2 mb-6">
                                {stavke.map((s, i) => (
                                    <div key={s.id} onClick={() => urediStavku(s)} className="flex justify-between items-center p-4 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden cursor-pointer hover:border-red-500 transition-all group shadow-md">
                                        {s.rabat_procenat > 0 && <div className="absolute top-0 left-0 h-full w-1 bg-pink-500"></div>}
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-black">{i+1}</div>
                                            <div>
                                                <p className="text-white text-xs font-black">{s.sifra} <span className="text-slate-400 font-normal ml-1">{s.naziv}</span></p>
                                                <p className="text-[9px] text-slate-500 uppercase mt-1">Količina: <b className="text-white">{s.kolicina_obracun} {s.jm_obracun}</b> x {s.cijena_baza} {form.valuta}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                {s.rabat_procenat > 0 && <p className="text-[9px] text-pink-500 font-bold line-through">{(s.kolicina_obracun * s.cijena_baza).toFixed(2)}</p>}
                                                <p className="text-red-400 font-black text-sm">{s.ukupno.toFixed(2)} {form.valuta} {s.rabat_procenat > 0 && <span className="text-pink-500 text-[8px] ml-1">(-{s.rabat_procenat}%)</span>}</p>
                                            </div>
                                            <button onClick={(e)=>{e.stopPropagation(); ukloniStavku(s.id);}} className="text-red-500 font-black p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded-lg transition-all">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700 space-y-2 shadow-inner">
                                <div className="flex justify-between text-xs text-slate-400"><span>Iznos bez rabata:</span><span>{totals.bez_rabata} {form.valuta}</span></div>
                                <div className="flex justify-between text-xs text-pink-500 font-bold"><span>Uračunat rabat:</span><span>- {totals.rabat} {form.valuta}</span></div>
                                <div className="flex justify-between text-xs text-slate-400 border-b border-slate-800 pb-2 mb-2"><span>Osnovica za PDV:</span><span>{totals.osnovica} {form.valuta}</span></div>
                                <div className="flex justify-between text-xs text-slate-400"><span>PDV (17%):</span><span>{totals.pdv} {form.valuta}</span></div>
                                <div className="flex justify-between text-xl text-white font-black pt-2 mt-2 border-t border-slate-700"><span>ZA NAPLATU:</span><span className="text-red-400">{totals.za_naplatu} {form.valuta}</span></div>
                            </div>

                            <textarea value={form.napomena} onChange={e=>setForm({...form, napomena:e.target.value})} placeholder="Napomena na računu..." className="w-full mt-4 p-4 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-red-500 shadow-inner" rows="2"></textarea>
                            <button onClick={snimiRacun} className={`w-full mt-4 py-6 text-white font-black rounded-2xl uppercase shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all text-sm tracking-widest ${isEditing ? 'bg-amber-600 hover:bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.4)]' : 'bg-red-600 hover:bg-red-500'}`}>
                                {isEditing ? '✅ Snimi izmjene računa' : '🏁 ZAKLJUČI I KREIRAJ RAČUN'}
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="animate-in slide-in-from-right max-w-5xl mx-auto">
                    
                    {tab === 'otvoreni' && (
                        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-red-500/30 shadow-2xl w-full">
                            <h3 className="text-red-500 font-black uppercase text-xs mb-4 flex justify-between"><span>⏳ ČEKA NAPLATU (OTVORENO)</span></h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2">
                                {neplaceni.length === 0 && <p className="text-center text-slate-500 text-xs col-span-full py-10 border-2 border-dashed border-slate-800 rounded-3xl">Nema otvorenih računa.</p>}
                                {neplaceni.map(r => (
                                    <div key={r.id} className="p-5 bg-slate-900 border border-red-500/20 rounded-[2rem] cursor-pointer hover:border-red-500 transition-all shadow-lg group">
                                        <div className="flex justify-between items-start border-b border-slate-800 pb-3 mb-3" onClick={() => pokreniIzmjenu(r)}>
                                            <div><p className="text-white text-base font-black">{r.id}</p><p className="text-slate-400 text-xs font-bold mt-1 uppercase">{r.kupac_naziv}</p></div>
                                            <div className="text-right"><p className="text-red-400 font-black text-lg">{r.ukupno_sa_pdv} {r.valuta}</p><p className="text-[9px] text-slate-500 uppercase mt-1">Rok: {formatirajDatum(r.rok_placanja)}</p></div>
                                        </div>
                                        <div className="flex justify-between items-center mt-2">
                                            <button onClick={()=>promijeniStatusBrzo(r, 'NAPLAĆENO')} className="text-[9px] text-white font-black bg-emerald-600 px-4 py-2 rounded-xl hover:bg-emerald-500 transition-all shadow-md">Označi kao naplaćeno 💰</button>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${r.nacin_placanja === 'Gotovina' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' : 'bg-blue-900/30 text-blue-400 border border-blue-500/30'}`}>{r.nacin_placanja}</span>
                                                <span className="text-[9px] text-slate-500 font-bold">Veza: {r.broj_veze || '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {tab === 'arhiva' && (
                        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-emerald-500/30 shadow-2xl w-full">
                            <h3 className="text-emerald-500 font-black uppercase text-xs mb-4 flex justify-between"><span>✅ NAPLAĆENO (ARHIVA)</span></h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2">
                                {placeni.length === 0 && <p className="text-center text-slate-500 text-xs col-span-full py-10 border-2 border-dashed border-slate-800 rounded-3xl">Arhiva je prazna.</p>}
                                {placeni.map(r => (
                                    <div key={r.id} className="p-5 bg-slate-900 border border-emerald-500/20 rounded-[2rem] cursor-pointer hover:border-emerald-500 transition-all shadow-lg group">
                                        <div className="flex justify-between items-start border-b border-slate-800 pb-3 mb-3" onClick={() => pokreniIzmjenu(r)}>
                                            <div><p className="text-white text-base font-black">{r.id}</p><p className="text-slate-400 text-xs font-bold mt-1 uppercase">{r.kupac_naziv}</p></div>
                                            <div className="text-right"><p className="text-emerald-400 font-black text-lg">{r.ukupno_sa_pdv} {r.valuta}</p><p className="text-[9px] text-slate-500 uppercase mt-1">Izdano: {formatirajDatum(r.datum)}</p></div>
                                        </div>
                                        <div className="flex justify-between items-center mt-2">
                                            <button onClick={()=>promijeniStatusBrzo(r, 'NENAPLAĆENO')} className="text-[9px] text-slate-400 bg-slate-800 px-4 py-2 rounded-xl hover:bg-red-900/50 hover:text-red-400 transition-all border border-slate-700">Vrati u dugovanje ↩</button>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-emerald-900/40 text-emerald-400 border border-emerald-500/30`}>{r.nacin_placanja}</span>
                                                <span className="text-[9px] text-slate-500 font-bold">Veza: {r.broj_veze || '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}