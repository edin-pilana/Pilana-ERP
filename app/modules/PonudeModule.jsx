"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import SearchableInput from '../components/SearchableInput';
import SettingsModule from './SettingsModule';
import { printDokument } from '../utils/printHelpers';
import { useSaaS } from '../utils/useSaaS';

const supabase = createClient('https://awaxwejrhmjeqohrgidm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY');

// PRETRAGA PROIZVODA SA PODRŠKOM ZA TASTATURU (STRELICE I ENTER)
function PonudeSearchableProizvod({ katalog, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const wrapperRef = useRef(null);
    
    useEffect(() => { setSearch(value || ''); }, [value]);
    useEffect(() => { setSelectedIndex(0); }, [search]);
    
    useEffect(() => {
        function handleClickOutside(e) { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false); }
        document.addEventListener("mousedown", handleClickOutside); 
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filtered = katalog.filter(k => k.sifra.toUpperCase().includes(search.toUpperCase()) || k.naziv.toUpperCase().includes(search.toUpperCase()));

    const handleKeyDown = (e) => {
        if (!open) { if (e.key === 'ArrowDown') setOpen(true); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0)); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered.length > 0) {
                const k = filtered[selectedIndex];
                const tekstZaPolje = `${k.sifra} | ${k.naziv} | Dim: ${k.visina}x${k.sirina}x${k.duzina}`;
                onChange(k.sifra, tekstZaPolje); setSearch(tekstZaPolje); setOpen(false);
            }
        } else if (e.key === 'Escape') setOpen(false);
    };

    return (
        <div ref={wrapperRef} className="relative font-black w-full">
            <input 
                value={search} 
                onFocus={() => setOpen(true)} 
                onKeyDown={handleKeyDown} 
                onChange={e => { setSearch(e.target.value); setOpen(true); }} 
                placeholder="Pronađi šifru ili naziv..." 
                className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-blue-500" 
            />
            {open && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    {filtered.map((k, index) => {
                        const tekstZaPolje = `${k.sifra} | ${k.naziv} | Dim: ${k.visina}x${k.sirina}x${k.duzina}`;
                        return (
                            <div 
                                key={k.sifra} 
                                onMouseEnter={()=>setSelectedIndex(index)} 
                                onClick={() => { onChange(k.sifra, tekstZaPolje); setSearch(tekstZaPolje); setOpen(false); }} 
                                className={`p-3 border-b border-slate-700 cursor-pointer transition-all ${index === selectedIndex ? 'bg-blue-600' : 'hover:bg-slate-700'}`}
                            >
                                <div className="text-white text-xs font-black">{k.sifra} <span className="text-blue-300 ml-1">{k.naziv}</span></div>
                                <div className="text-[9px] text-slate-400 mt-1 uppercase">Kat: {k.kategorija} | Cijena: <b className="text-white">{k.cijena} KM/{k.default_jedinica}</b></div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
}

export default function PonudeModule({ onExit }) {
    const loggedUser = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');

    const hasKupacEdit = loggedUser.uloga === 'admin' || loggedUser.uloga === 'superadmin' || (loggedUser.dozvole && loggedUser.dozvole.includes('Baza Kupaca (Edit)'));
    const hasKatalogEdit = loggedUser.uloga === 'admin' || loggedUser.uloga === 'superadmin' || (loggedUser.dozvole && loggedUser.dozvole.includes('Katalog Proizvoda (Edit)'));

    const saas = useSaaS('ponude_zaglavlje', {
        boja_kartice: '#1e293b', boja_naslova: 'text-pink-500',
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

    const generisiID = () => `PON-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;

    const [form, setForm] = useState({
        id: generisiID(), kupac_naziv: '', datum: new Date().toISOString().split('T')[0],
        rok_vazenja: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
        nacin_placanja: 'Virmanski', valuta: 'KM', paritet: 'FCA Srebrenik', depozit: '', napomena: '', status: 'NA ODLUČIVANJU', rn_modifikovan: false
    });

    const [isEditingPonuda, setIsEditingPonuda] = useState(false);
    const [odabraniKupac, setOdabraniKupac] = useState(null);
    const [stavke, setStavke] = useState([]);
    const [povezaniRN, setPovezaniRN] = useState(null);
    const [globalRabat, setGlobalRabat] = useState('');

    const razlikeUOdnosuNaRN = useMemo(() => {
        if (!povezaniRN || !povezaniRN.stavke_jsonb) return [];
        const razlike = [];
        const rnStavke = povezaniRN.stavke_jsonb;
        
        stavke.forEach(ps => {
            const rs = rnStavke.find(r => r.sifra === ps.sifra);
            if (!rs) {
                razlike.push({ sifra: ps.sifra, naziv: ps.naziv, tip: 'obrisano', poruka: `Obrisano (Bilo: ${ps.kolicina_unos} ${ps.jm_unos})` });
            } else if (parseFloat(rs.kolicina_obracun) !== parseFloat(ps.kolicina_obracun) || parseFloat(rs.kolicina_unos) !== parseFloat(ps.kolicina_unos)) {
                razlike.push({ sifra: ps.sifra, naziv: ps.naziv, tip: 'mijenjano', poruka: `Mijenjano sa ${ps.kolicina_unos} ${ps.jm_unos} na ${rs.kolicina_unos} ${rs.jm_unos}` });
            }
        });
        rnStavke.forEach(rs => {
            if (!stavke.find(p => p.sifra === rs.sifra)) {
                razlike.push({ sifra: rs.sifra, naziv: rs.naziv, tip: 'dodato', poruka: `Dodato naknadno (${rs.kolicina_unos} ${rs.jm_unos})` });
            }
        });
        return razlike;
    }, [stavke, povezaniRN]);

    const prihvatiIzmjene = async () => {
        if(!povezaniRN) return;
        const noveStavke = povezaniRN.stavke_jsonb.map(rs => {
            const postojeca = stavke.find(ps => ps.sifra === rs.sifra);
            const cijena_baza = postojeca ? postojeca.cijena_baza : 0; 
            const rabat = postojeca ? postojeca.rabat_procenat : 0;
            const kolicina = parseFloat(rs.kolicina_obracun) || 0;
            const ukupno_bez_rabata = kolicina * cijena_baza;
            const iznos_rabata = ukupno_bez_rabata * (rabat / 100);
            
            return {
                id: postojeca ? postojeca.id : Math.random().toString(),
                sifra: rs.sifra, naziv: rs.naziv,
                kolicina_unos: rs.kolicina_unos, jm_unos: rs.jm_unos,
                kolicina_obracun: kolicina, jm_obracun: rs.jm_obracun,
                cijena_baza: cijena_baza, rabat_procenat: rabat,
                iznos_rabata: iznos_rabata, ukupno: ukupno_bez_rabata - iznos_rabata
            };
        });
        
        setStavke(noveStavke); setForm({...form, rn_modifikovan: false});
        await supabase.from('ponude').update({ rn_modifikovan: false, stavke_jsonb: noveStavke }).eq('id', form.id);
        await supabase.from('radni_nalozi').update({ modifikovan: false }).eq('id', povezaniRN.id);
        setPovezaniRN(null); alert("✅ Izmjene iz proizvodnje su PRIHVAĆENE! Ponuda je usklađena.");
    };

    const odbijIzmjene = async () => {
        if(!povezaniRN) return;
        if(!window.confirm("Da li ste sigurni? Radni nalog će biti PREPISAN nazad na originalne količine iz ove ponude i vraćen u proizvodnju!")) return;
        
        setForm({...form, rn_modifikovan: false});
        await supabase.from('ponude').update({ rn_modifikovan: false }).eq('id', form.id);
        await supabase.from('radni_nalozi').update({ stavke_jsonb: stavke, modifikovan: false }).eq('id', povezaniRN.id);
        setPovezaniRN(null); alert("❌ Izmjene su ODBIJENE! Radni nalog je vraćen na staro stanje i može se printati.");
    };

    const [showBrziKupac, setShowBrziKupac] = useState(false);
    const [showBrziKatalog, setShowBrziKatalog] = useState(false);
    const [stavkaForm, setStavkaForm] = useState({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3', sistemski_rabat: 0, konacni_rabat: '' });
    const [trenutniProizvod, setTrenutniProizvod] = useState(null);

    useEffect(() => { load(); }, []);

    const load = async () => {
        const {data: k} = await supabase.from('kupci').select('*').order('naziv'); setKupci(k||[]);
        const {data: cat} = await supabase.from('katalog_proizvoda').select('*').order('sifra'); setKatalog(cat||[]);
        const {data: p} = await supabase.from('ponude').select('*').order('datum', { ascending: false }); setPonude(p||[]);
        
        // SUPERADMIN UČITAVANJE LOGOVA
        if (loggedUser.uloga === 'superadmin') {
            const {data: logs} = await supabase.from('sistem_audit_log').select('*').eq('akcija', 'RUČNA_IZMJENA_RABATA').order('vrijeme', { ascending: false }).limit(10);
            setSuperadminLogs(logs || []);
        }
    };

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: loggedUser.ime_prezime || 'Nepoznat', akcija, detalji }]);
    };

    const handleKupacSelect = (naziv) => {
        setForm({...form, kupac_naziv: naziv});
        setOdabraniKupac(kupci.find(k => k.naziv === naziv) || null);
    };

    const izracunajRabat = (proizvod, kupac) => {
        if(!kupac || !kupac.rabati_jsonb) return 0;
        const rabati = kupac.rabati_jsonb;
        if (rabati.proizvodi && rabati.proizvodi[proizvod.sifra]) return parseFloat(rabati.proizvodi[proizvod.sifra]);
        if (rabati.kategorije && rabati.kategorije[proizvod.kategorija]) return parseFloat(rabati.kategorije[proizvod.kategorija]);
        if (rabati.ukupni) return parseFloat(rabati.ukupni);
        return 0;
    };

    const izracunajDinamickuCijenu = (proizvod, jm_cilj) => {
        if (!proizvod) return 0;
        const p_baza = parseFloat(proizvod.cijena) || 0;
        const jm_baza = (proizvod.default_jedinica || 'm3').toLowerCase();
        const cilj = (jm_cilj || 'm3').toLowerCase();
        if (jm_baza === cilj) return p_baza;
        const v = (parseFloat(proizvod.visina) || 1) / 100; const s = (parseFloat(proizvod.sirina) || 1) / 100; const d = (parseFloat(proizvod.duzina) || 1) / 100;
        let faktor_baza = 1;
        if (jm_baza === 'm3') faktor_baza = v * s * d; else if (jm_baza === 'm2') faktor_baza = s * d; else if (jm_baza === 'm1') faktor_baza = d;
        const cijena_komad = p_baza * faktor_baza;
        let faktor_cilj = 1;
        if (cilj === 'm3') faktor_cilj = v * s * d; else if (cilj === 'm2') faktor_cilj = s * d; else if (cilj === 'm1') faktor_cilj = d;
        return cijena_komad / (faktor_cilj || 1);
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
        
        const v = (parseFloat(trenutniProizvod.visina) || 1) / 100; 
        const s = (parseFloat(trenutniProizvod.sirina) || 1) / 100; 
        const d = (parseFloat(trenutniProizvod.duzina) || 1) / 100;

        let komada = kol;
        if (stavkaForm.jm_unos === 'm3') komada = kol / (v * s * d);
        if (stavkaForm.jm_unos === 'm2') komada = kol / (s * d);
        if (stavkaForm.jm_unos === 'm1') komada = kol / d;
        
        if (stavkaForm.jm_obracun === 'm3') obracun = komada * (v * s * d);
        else if (stavkaForm.jm_obracun === 'm2') obracun = komada * (s * d);
        else if (stavkaForm.jm_obracun === 'm1') obracun = komada * d;
        else if (stavkaForm.jm_obracun === 'kom') obracun = komada;

        setStavkaForm(prev => ({...prev, kolicina_obracun: obracun > 0 ? obracun.toFixed(4) : kol}));
    }, [stavkaForm.kolicina_unos, stavkaForm.jm_unos, stavkaForm.jm_obracun, trenutniProizvod]);

    const dinamickaCijena = trenutniProizvod ? izracunajDinamickuCijenu(trenutniProizvod, stavkaForm.jm_obracun) : 0;

    const dodajStavku = async () => {
        if(!trenutniProizvod || !stavkaForm.kolicina_obracun || parseFloat(stavkaForm.kolicina_obracun) <= 0) return alert("Odaberite proizvod i provjerite količine!");
        if(!odabraniKupac) return alert("Prvo odaberite kupca!");

        const kolicina_za_naplatu = parseFloat(stavkaForm.kolicina_obracun);
        const cijena_baza = dinamickaCijena; 
        const rabat_konacni = parseFloat(stavkaForm.konacni_rabat) || 0;
        
        // LOGIKANJE ZA SUPERADMINA
        if (rabat_konacni > stavkaForm.sistemski_rabat) {
            await zapisiU_Log('RUČNA_IZMJENA_RABATA', `Za "${trenutniProizvod.naziv}" kupcu "${form.kupac_naziv}" na ponudi ${form.id}, rabat ručno povećan na ${rabat_konacni}% (Sistem davao: ${stavkaForm.sistemski_rabat}%).`);
        }

        const ukupno_bez_rabata = kolicina_za_naplatu * cijena_baza;
        const iznos_rabata = ukupno_bez_rabata * (rabat_konacni / 100);
        const ukupno_sa_rabatom = ukupno_bez_rabata - iznos_rabata;

        const novaStavka = {
            id: stavkaForm.id || Math.random().toString(), sifra: trenutniProizvod.sifra, naziv: trenutniProizvod.naziv,
            kolicina_unos: parseFloat(stavkaForm.kolicina_unos), jm_unos: stavkaForm.jm_unos, kolicina_obracun: kolicina_za_naplatu, jm_obracun: stavkaForm.jm_obracun,
            cijena_baza: cijena_baza, rabat_procenat: rabat_konacni, iznos_rabata: iznos_rabata, ukupno: ukupno_sa_rabatom
        };

        if (stavkaForm.id) setStavke(stavke.map(s => s.id === stavkaForm.id ? novaStavka : s)); else setStavke([...stavke, novaStavka]);
        setStavkaForm({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3', sistemski_rabat: 0, konacni_rabat: '' });
        setTrenutniProizvod(null);
    };

    // --- PRIMJENA GLOBALNOG RABATA NA SVE STAVKE ---
    const primijeniGlobalniRabat = async () => {
        const rabat = parseFloat(globalRabat);
        if (isNaN(rabat) || rabat < 0 || rabat > 100) return alert("Unesite validan procenat rabata (0-100)!");
        
        const noveStavke = stavke.map(s => {
            const kolicina_za_naplatu = parseFloat(s.kolicina_obracun);
            const cijena_baza = parseFloat(s.cijena_baza);
            const ukupno_bez_rabata = kolicina_za_naplatu * cijena_baza;
            const iznos_rabata = ukupno_bez_rabata * (rabat / 100);
            const ukupno_sa_rabatom = ukupno_bez_rabata - iznos_rabata;
            return { ...s, rabat_procenat: rabat, iznos_rabata: iznos_rabata, ukupno: ukupno_sa_rabatom };
        });
        
        setStavke(noveStavke);
        setGlobalRabat('');
        await zapisiU_Log('RUČNA_IZMJENA_RABATA', `Globalni rabat od ${rabat}% primijenjen na cijelu ponudu ${form.id} za kupca ${form.kupac_naziv}`);
        alert(`✅ Rabat od ${rabat}% je uspješno primijenjen na sve stavke u ponudi!`);
    };

    const urediStavku = (stavka) => {
        const nadjeni = katalog.find(k => k.sifra === stavka.sifra);
        setTrenutniProizvod(nadjeni || null);
        const tekstZaPolje = nadjeni ? `${nadjeni.sifra} | ${nadjeni.naziv}` : stavka.sifra;
        setStavkaForm({
            id: stavka.id, sifra_unos: tekstZaPolje, kolicina_unos: stavka.kolicina_unos, jm_unos: stavka.jm_unos,
            kolicina_obracun: stavka.kolicina_obracun, jm_obracun: stavka.jm_obracun,
            sistemski_rabat: izracunajRabat(nadjeni, odabraniKupac), konacni_rabat: stavka.rabat_procenat
        });
        window.scrollTo({ top: 300, behavior: 'smooth' });
    };

    const ukloniStavku = (id) => setStavke(stavke.filter(s => s.id !== id));

    const totals = useMemo(() => {
        let suma_bez_rabata = 0, suma_rabata = 0, suma_krajnja = 0;
        stavke.forEach(s => { suma_bez_rabata += (s.kolicina_obracun * s.cijena_baza); suma_rabata += s.iznos_rabata; suma_krajnja += s.ukupno; });
        const pdv = suma_krajnja * 0.17; 
        return { bez_rabata: suma_bez_rabata.toFixed(2), rabat: suma_rabata.toFixed(2), osnovica: suma_krajnja.toFixed(2), pdv: pdv.toFixed(2), za_naplatu: (suma_krajnja + pdv).toFixed(2) };
    }, [stavke]);

    const snimiPonudu = async () => {
        if(!form.kupac_naziv) return alert("Kupac je obavezan!");
        if(stavke.length === 0) return alert("Ponuda mora imati barem jednu stavku!");
        
        const payload = {
            id: form.id.toUpperCase(), kupac_naziv: form.kupac_naziv, datum: form.datum, rok_vazenja: form.rok_vazenja,
            nacin_placanja: form.nacin_placanja, valuta: form.valuta, paritet: form.paritet, depozit: parseFloat(form.depozit) || 0,
            napomena: form.napomena, stavke_jsonb: stavke, status: form.status,
            ukupno_bez_pdv: parseFloat(totals.osnovica), ukupno_rabat: parseFloat(totals.rabat), ukupno_sa_pdv: parseFloat(totals.za_naplatu),
            snimio_korisnik: loggedUser.ime_prezime, rn_modifikovan: form.rn_modifikovan
        };

        if (isEditingPonuda) {
            const { error } = await supabase.from('ponude').update(payload).eq('id', form.id);
            if(error) return alert("Greška: " + error.message);
            await zapisiU_Log('IZMJENA_PONUDE', `Ažurirana ponuda ${form.id}`); alert("✅ Ponuda uspješno ažurirana!");
        } else {
            const { error } = await supabase.from('ponude').insert([payload]);
            if(error) return alert("Greška pri snimanju: " + error.message);
            await zapisiU_Log('KREIRANA_PONUDA', `Ponuda ${form.id} za ${form.kupac_naziv}`); alert("✅ Ponuda uspješno kreirana!");
        }

        if ((form.status === 'POTVRĐENA' || form.status === 'REALIZOVANA ✅') && parseFloat(form.depozit) > 0) {
            const { data: postojiAvans } = await supabase.from('blagajna').select('id').eq('racun_id', form.id).maybeSingle();
            if (!postojiAvans) {
                await supabase.from('blagajna').insert([{
                    id: `KASA-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000)}`, tip: 'ULAZ', kategorija: 'Avans po Ponudi',
                    iznos: parseFloat(form.depozit), opis: `Automatski depozit po ponudi: ${form.id} (${form.kupac_naziv})`, racun_id: form.id, datum: new Date().toISOString().split('T')[0], vrijeme_tekst: new Date().toLocaleTimeString('de-DE'), snimio_korisnik: loggedUser.ime_prezime || 'Sistem'
                }]);
            }
        }
        if (window.confirm("✅ Uspješno snimljeno! Da li želite odmah isprintati / sačuvati PDF ove ponude?")) { kreirajPDF(); }
        resetFormu(); load(); setTab('lista');
    };

    const pokreniIzmjenuPonude = async (p) => {
        setForm({ id: p.id, kupac_naziv: p.kupac_naziv, datum: p.datum, rok_vazenja: p.rok_vazenja, nacin_placanja: p.nacin_placanja || 'Virmanski', valuta: p.valuta || 'KM', paritet: p.paritet || 'FCA Srebrenik', depozit: p.depozit || '', napomena: p.napomena || '', status: p.status || 'NA ODLUČIVANJU', rn_modifikovan: p.rn_modifikovan || false });
        setOdabraniKupac(kupci.find(k => k.naziv === p.kupac_naziv) || null); 
        setStavke(p.stavke_jsonb || []); 
        setIsEditingPonuda(true); setTab('nova'); window.scrollTo({ top: 0, behavior: 'smooth' });
        setPovezaniRN(null);
        if (p.rn_modifikovan) {
            const { data } = await supabase.from('radni_nalozi').select('id, stavke_jsonb').eq('broj_ponude', p.id).limit(1);
            if (data && data.length > 0) setPovezaniRN(data[0]);
        }
    };

    const promijeniStatusBrzo = async (p, noviStatus) => { await supabase.from('ponude').update({ status: noviStatus }).eq('id', p.id); await zapisiU_Log('STATUS_PONUDE', `Ponuda ${p.id} prebačena u ${noviStatus}`); load(); };
    const resetFormu = () => { setForm({ id: generisiID(), kupac_naziv: '', datum: new Date().toISOString().split('T')[0], rok_vazenja: '', nacin_placanja: 'Virmanski', valuta: 'KM', paritet: 'FCA Srebrenik', depozit: '', napomena: '', status: 'NA ODLUČIVANJU', rn_modifikovan: false }); setStavke([]); setOdabraniKupac(null); setIsEditingPonuda(false); setPovezaniRN(null); setGlobalRabat(''); };
    const formatirajDatum = (isoString) => { if(!isoString) return ''; const [y, m, d] = isoString.split('-'); return `${d}.${m}.${y}.`; };

    // PDF Optimizovan za 20 stavki na jednoj strani
    const kreirajPDF = () => {
        const stariNaslov = document.title; 
        document.title = `ponuda_${form.id}_${(form.kupac_naziv || 'Nepoznat_Kupac').replace(/\s+/g, '_')}`;
        const ukupnoSaPDV = parseFloat(totals.za_naplatu); 
        const depozit = parseFloat(form.depozit) || 0; 
        const preostaloZaNaplatu = (ukupnoSaPDV - depozit).toFixed(2);
        
        let redovi = stavke.map((s, i) => `
            <tr>
                <td style="padding: 2px 4px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #64748b;">${i+1}.</td>
                <td style="padding: 2px 4px; border-bottom: 1px solid #e2e8f0;">
                    <b style="color: #0f172a; font-size: 10px;">${s.sifra}</b><br/>
                    <span style="color: #64748b; font-size: 9px;">${s.naziv}</span>
                </td>
                <td style="padding: 2px 4px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 800; color: #0f172a; font-size: 10px;">
                    ${s.kolicina_obracun} <span style="color: #64748b; font-size: 8px;">${s.jm_obracun}</span>
                </td>
                <td style="padding: 2px 4px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; font-size: 10px;">${s.cijena_baza.toFixed(2)}</td>
                <td style="padding: 2px 4px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #ec4899; font-weight: 800; font-size: 10px;">${s.rabat_procenat > 0 ? s.rabat_procenat + '%' : '-'}</td>
                <td style="padding: 2px 4px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 800; color: #0f172a; font-size: 11px;">${s.ukupno.toFixed(2)}</td>
            </tr>
        `).join('');

        const htmlSadrzajTabela = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; line-height: 1.2;">
                <div>
                    <h4 style="margin: 0 0 3px 0; font-size: 11px; color: #64748b;">Kupac / Klijent</h4>
                    <p style="font-size: 16px; font-weight: 900; margin: 0 0 2px 0;">${form.kupac_naziv}</p>
                    <p style="font-size: 10px; color: #475569; margin: 0;">${odabraniKupac?.adresa || 'Adresa nije unesena'}</p>
                    <p style="font-size: 10px; color: #0f172a; font-weight: bold; margin: 4px 0 0 0;">PDV / ID: ${odabraniKupac?.pdv_broj || 'N/A'}</p>
                </div>
                <div style="text-align: right;">
                    <h4 style="margin: 0 0 3px 0; font-size: 11px; color: #64748b;">Detalji Ponude</h4>
                    <p style="font-size: 10px; margin: 0 0 2px 0;">Paritet: <b>${form.paritet}</b></p>
                    <p style="font-size: 10px; margin: 0 0 2px 0;">Plaćanje: <b>${form.nacin_placanja}</b></p>
                    <p style="font-size: 10px; margin: 0 0 2px 0;">Valuta: <b>${form.valuta}</b></p>
                    <p style="font-size: 11px; color: #ec4899; font-weight: bold; margin: 4px 0 0 0;">Važi do: ${formatirajDatum(form.rok_vazenja)}</p>
                </div>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
                <thead>
                    <tr style="background: #f8fafc;">
                        <th style="padding: 4px; border-bottom: 2px solid #cbd5e1; text-align: left; font-size: 9px; width: 5%;">R.B.</th>
                        <th style="padding: 4px; border-bottom: 2px solid #cbd5e1; text-align: left; font-size: 9px;">Šifra i Naziv Proizvoda</th>
                        <th style="padding: 4px; border-bottom: 2px solid #cbd5e1; text-align: center; font-size: 9px;">Količina</th>
                        <th style="padding: 4px; border-bottom: 2px solid #cbd5e1; text-align: right; font-size: 9px;">Cijena</th>
                        <th style="padding: 4px; border-bottom: 2px solid #cbd5e1; text-align: right; font-size: 9px;">Rabat</th>
                        <th style="padding: 4px; border-bottom: 2px solid #cbd5e1; text-align: right; font-size: 9px;">Ukupno (${form.valuta})</th>
                    </tr>
                </thead>
                <tbody>${redovi}</tbody>
            </table>
            
            <div style="width: 45%; margin-left: auto; font-size: 10px;">
                <div style="display: flex; justify-content: space-between; padding: 2px 0;"><span>Iznos bez rabata:</span> <b>${totals.bez_rabata}</b></div>
                <div style="display: flex; justify-content: space-between; padding: 2px 0; color: #ec4899;"><span>Uračunati rabat:</span> <b>- ${totals.rabat}</b></div>
                <div style="display: flex; justify-content: space-between; padding: 2px 0;"><span>Osnovica za PDV:</span> <b>${totals.osnovica}</b></div>
                <div style="display: flex; justify-content: space-between; padding: 2px 0;"><span>PDV iznos (17%):</span> <b>${totals.pdv}</b></div>
                <div style="display: flex; justify-content: space-between; padding: 4px 0; margin-top: 4px; border-top: 1px solid #cbd5e1; font-size: 11px;"><span>UKUPNO SA PDV:</span> <b>${ukupnoSaPDV.toFixed(2)}</b></div>
                ${depozit > 0 ? `<div style="display: flex; justify-content: space-between; padding: 2px 0; color: #10b981;"><span>Uplaćen depozit:</span> <b>- ${depozit.toFixed(2)}</b></div>` : ''}
                <div style="display: flex; justify-content: space-between; padding: 4px 0; margin-top: 4px; border-top: 2px solid #cbd5e1; font-size: 13px; font-weight: bold;">
                    <span>ZA NAPLATU:</span><span>${preostaloZaNaplatu} ${form.valuta}</span>
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-top: 15px; font-size: 9px; line-height: 1.3;">
                <div style="width: 60%;">
                    <b style="color: #0f172a;">Napomena uz ponudu:</b><br/>
                    ${form.napomena || 'Nema dodatnih napomena.'}
                </div>
                <div style="text-align: right; width: 30%;">
                    <div style="border-bottom: 1px solid #cbd5e1; margin-bottom: 5px; height: 30px;"></div>
                    Potpis ovlaštenog lica
                </div>
            </div>
        `;
        printDokument('PONUDA', form.id, formatirajDatum(form.datum), htmlSadrzajTabela, '#ec4899');
        setTimeout(() => { document.title = stariNaslov; }, 2000);
    };

    const renderPoljeZaglavlja = (polje) => {
        if (polje.id === 'kupac') return (<div className="flex gap-2 items-center w-full h-full"><div className="flex-1 min-w-0 h-full"><SearchableInput value={form.kupac_naziv} onChange={handleKupacSelect} list={kupci.map(k=>k.naziv)} /></div>{hasKupacEdit && <button onClick={() => setShowBrziKupac(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 h-full min-h-[45px] rounded-xl shadow-lg shrink-0 text-[10px] font-black">➕ NOVI</button>}</div>);
        if (polje.id === 'broj') return <input value={form.id} disabled={isEditingPonuda} onChange={e=>setForm({...form, id:e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-slate-900 rounded-xl text-xs text-white outline-none border border-slate-700 font-black uppercase disabled:opacity-50" />;
        if (polje.id === 'datum') return <input type="date" value={form.datum} onChange={e=>setForm({...form, datum:e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700" />;
        if (polje.id === 'rok') return <input type="date" value={form.rok_vazenja} onChange={e=>setForm({...form, rok_vazenja:e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700" />;
        if (polje.id === 'placanje') return <select value={form.nacin_placanja} onChange={e=>setForm({...form, nacin_placanja:e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700"><option value="Virmanski">Virmanski</option><option value="Gotovina">Gotovina</option><option value="Kartica">Kartica</option></select>;
        if (polje.id === 'valuta') return <select value={form.valuta} onChange={e=>setForm({...form, valuta:e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700"><option value="KM">BAM (KM)</option><option value="EUR">EUR (€)</option><option value="RSD">RSD</option></select>;
        if (polje.id === 'paritet') return <input value={form.paritet} onChange={e=>setForm({...form, paritet:e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-[#0f172a] rounded-xl text-xs text-white outline-none border border-slate-700" placeholder="npr. FCA Srebrenik" />;
        if (polje.id === 'depozit') return <input type="number" value={form.depozit} onChange={e=>setForm({...form, depozit:e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-emerald-900/20 rounded-xl text-xs text-emerald-400 font-black outline-none border border-emerald-500/30" placeholder="0.00" />;
        if (polje.id === 'status') return <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-pink-900/20 rounded-xl text-xs text-pink-400 font-black outline-none border border-pink-500/50"><option value="NA ODLUČIVANJU">Na odlučivanju</option><option value="POTVRĐENA">POTVRĐENA ✅</option><option value="REALIZOVANA ✅">REALIZOVANA (Zatvorena)</option></select>;
        return null;
    };

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 font-bold">
            {showBrziKupac && <div className="fixed inset-0 z-[200] bg-[#090e17]/95 flex flex-col p-4 overflow-y-auto backdrop-blur-md animate-in fade-in"><SettingsModule onExit={() => { setShowBrziKupac(false); load(); }} lockedTab="kupci" /></div>}
            {showBrziKatalog && <div className="fixed inset-0 z-[200] bg-[#090e17]/95 flex flex-col p-4 overflow-y-auto backdrop-blur-md animate-in fade-in"><SettingsModule onExit={() => { setShowBrziKatalog(false); load(); }} lockedTab="katalog" /></div>}

            <div className={`flex flex-col md:flex-row justify-between items-center p-4 rounded-3xl border shadow-lg gap-4 transition-all ${saas.isEditMode ? 'bg-amber-950/30 border-amber-500 ring-2 ring-amber-500' : 'bg-[#1e293b] border-pink-500/30'}`}>
                <div className="flex items-center gap-3"><button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase hover:bg-slate-700 text-white font-black transition-all">← Meni</button><h2 className={`${saas.ui.boja_naslova} font-black tracking-widest uppercase text-xs hidden md:block`}>📝 UPRAVLJANJE PONUDAMA</h2></div>
            </div>

            <div className="flex bg-[#1e293b] p-1 rounded-2xl border border-slate-700">
                <button onClick={() => {setTab('nova'); if(!isEditingPonuda) resetFormu();}} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all font-black ${tab === 'nova' ? 'bg-pink-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}>{isEditingPonuda ? '✏️ Ažuriranje Ponude' : '➕ Nova Ponuda'}</button>
                <button onClick={() => setTab('lista')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all font-black ${tab === 'lista' ? 'bg-pink-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}>📋 Lista Ponuda</button>
            </div>

            {tab === 'nova' ? (
                <div className="space-y-4 animate-in slide-in-from-left max-w-4xl mx-auto">
                    
                    {form.rn_modifikovan && (
                        <div className="bg-red-900/40 border-2 border-red-500 p-6 rounded-[2.5rem] flex flex-col gap-4 shadow-2xl animate-in slide-in-from-top w-full">
                            <div className="flex items-center gap-4 border-b border-red-500/20 pb-3"><span className="text-4xl animate-pulse">🚫</span><div><p className="text-red-400 font-black uppercase text-sm">Ova ponuda je blokirala proizvodnju!</p><p className="text-white text-xs mt-1">Radni Nalog {povezaniRN ? `(${povezaniRN.id})` : ''} je izmijenjen u pogonu. Dok ne odobrite ili odbijete izmjene, <b className="text-red-400">štampanje radnog naloga je zabranjeno.</b></p></div></div>
                            {razlikeUOdnosuNaRN.length > 0 ? (
                                <div className="w-full">
                                    <div className="bg-black/30 rounded-xl p-3 border border-red-500/30 space-y-2 mb-4">
                                        {razlikeUOdnosuNaRN.map((r, idx) => (
                                            <div key={idx} className="flex flex-col md:flex-row justify-between md:items-center text-xs gap-2 border-b border-red-500/10 pb-2 last:border-0 last:pb-0">
                                                <div><span className="text-white font-bold">{r.sifra}</span> <span className="text-slate-400 ml-1">{r.naziv}</span></div>
                                                <div className={`font-black px-3 py-1 rounded uppercase tracking-widest ${r.tip === 'obrisano' ? 'bg-red-500/20 text-red-400' : r.tip === 'dodato' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{r.poruka}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex flex-col md:flex-row gap-3"><button onClick={prihvatiIzmjene} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 py-4 rounded-2xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] uppercase text-xs">✅ Prihvati (Ažuriraj Ponudu)</button><button onClick={odbijIzmjene} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black px-6 py-4 rounded-2xl transition-all shadow-[0_0_15px_rgba(220,38,38,0.4)] uppercase text-xs">❌ Odbij (Vrati RN na staro)</button></div>
                                </div>
                            ) : (<div className="text-xs text-slate-400 italic">Učitavam detalje razlika...</div>)}
                        </div>
                    )}

                    <div className={`p-6 rounded-[2.5rem] border-2 shadow-2xl space-y-4 transition-all ${saas.isEditMode ? 'border-dashed border-amber-500 bg-black/20' : (isEditingPonuda ? 'border-amber-500/50 bg-[#1e293b]' : 'border-pink-500/30 bg-[#1e293b]')}`} style={{ backgroundColor: saas.isEditMode ? '' : saas.ui.boja_kartice }}>
                        <div className="flex justify-between items-center mb-2 border-b border-slate-700/50 pb-2">
                            <h3 className={`${isEditingPonuda ? 'text-amber-500' : saas.ui.boja_naslova} font-black uppercase text-xs`}>1. Podaci o kupcu i parametrima ponude</h3>
                            <div className="flex gap-2">
                                {isEditingPonuda && <button onClick={kreirajPDF} className="text-[10px] bg-slate-800 text-white border border-slate-600 px-4 py-1.5 rounded-xl uppercase hover:bg-white hover:text-black transition-all shadow-md font-black">🖨️ Isprintaj PDF</button>}
                                {isEditingPonuda && <button onClick={resetFormu} className="text-[10px] bg-red-900/30 text-red-400 px-3 py-1.5 rounded-xl uppercase hover:bg-red-900/50">Odustani ✕</button>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border-b border-slate-700 pb-4 items-start">
                            {aktivnaPolja.map((polje, index) => (
                                <div key={polje.id} className={`relative flex flex-col ${polje.span}`}>{polje.label && <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1 shrink-0">{polje.label}</label>}<div className="flex-1">{renderPoljeZaglavlja(polje)}</div></div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-4">
                        <h3 className="text-blue-500 font-black uppercase text-xs mb-4">2. Dinamički unos stavki</h3>
                        <div className="relative z-40 mb-3"><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Pronađi proizvod (Koristi strelice i Enter)</label><div className="flex gap-2 items-center w-full"><div className="flex-1 min-w-0"><PonudeSearchableProizvod katalog={katalog} value={stavkaForm.sifra_unos} onChange={handleProizvodSelect} /></div>{hasKatalogEdit && <button onClick={() => setShowBrziKatalog(true)} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-3 rounded-xl shadow-lg shrink-0 text-[10px] font-black">➕ NOVI</button>}</div></div>

                        {trenutniProizvod && (
                            <div className="p-4 bg-blue-900/10 border border-blue-500/30 rounded-2xl animate-in zoom-in-95 space-y-4">
                                <div className="flex justify-between items-center border-b border-slate-700 pb-3"><div><p className="text-white text-sm font-black">{trenutniProizvod.sifra} - {trenutniProizvod.naziv}</p><p className="text-[10px] text-slate-400">Dim: {trenutniProizvod.visina}x{trenutniProizvod.sirina}x{trenutniProizvod.duzina}</p></div><div className="text-right"><p className="text-[10px] text-slate-400 uppercase">Cijena po {stavkaForm.jm_obracun}</p><p className="text-emerald-400 font-black text-lg">{dinamickaCijena.toFixed(2)} {form.valuta}</p></div></div>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                                    <div className="col-span-2"><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Unos: Količina i Jedinica</label><div className="flex gap-1"><input type="number" value={stavkaForm.kolicina_unos} onChange={e=>setStavkaForm({...stavkaForm, kolicina_unos:e.target.value})} placeholder="Količina" className="flex-1 p-3 bg-[#0f172a] rounded-xl text-sm text-white font-black text-center outline-none border border-slate-700 focus:border-blue-500" /><select value={stavkaForm.jm_unos} onChange={e=>setStavkaForm({...stavkaForm, jm_unos:e.target.value})} className="w-20 p-3 bg-slate-800 rounded-xl text-xs text-white outline-none border border-slate-700 cursor-pointer"><option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option></select></div></div>
                                    
                                    {/* BLOKIRANO POLJE KOLIČINE OBRACUNA + SLOBODAN SELECT */}
                                    <div className="col-span-2">
                                        <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Obračunava se po (Preračunato)</label>
                                        <div className="flex gap-1">
                                            <input type="number" value={stavkaForm.kolicina_obracun} readOnly className="flex-1 p-3 bg-blue-900/10 rounded-xl text-sm text-blue-400 font-black text-center border border-blue-500/20 outline-none cursor-not-allowed pointer-events-none opacity-80" />
                                            <select value={stavkaForm.jm_obracun} onChange={e=>setStavkaForm({...stavkaForm, jm_obracun:e.target.value})} className="w-20 p-3 bg-slate-800 rounded-xl text-xs text-white outline-none border border-slate-700 hover:border-blue-500 cursor-pointer transition-all">
                                                <option value="m3">m³</option>
                                                <option value="m2">m²</option>
                                                <option value="m1">m1</option>
                                                <option value="kom">kom</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div><label className="text-[8px] text-pink-500 uppercase ml-2 block mb-1 font-black">Konačni Rabat %</label><input type="number" value={stavkaForm.konacni_rabat} onChange={e=>setStavkaForm({...stavkaForm, konacni_rabat:e.target.value})} className="w-full p-3 bg-pink-900/20 rounded-xl text-sm text-pink-400 font-black text-center outline-none border border-pink-500/50" /></div>
                                </div>
                                <button onClick={dodajStavku} className={`w-full py-4 text-white font-black rounded-xl text-xs shadow-lg uppercase mt-2 ${stavkaForm.id ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'}`}>{stavkaForm.id ? '✅ Ažuriraj ovu stavku' : '➕ Dodaj stavku na ponudu'}</button>
                            </div>
                        )}
                    </div>

                    {stavke.length > 0 && (
                        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-emerald-500/30 shadow-2xl animate-in slide-in-from-bottom">
                            <div className="flex justify-between items-center mb-4"><h3 className="text-emerald-500 font-black uppercase text-xs">3. Pregled Ponude i PDF</h3><button onClick={kreirajPDF} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-[10px] uppercase font-black border border-slate-600 hover:bg-white hover:text-black transition-all">🖨️ Kreiraj PDF</button></div>
                            
                            <div className="space-y-2 mb-6">
                                {stavke.map((s) => (
                                    <div key={s.id} onClick={() => urediStavku(s)} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden cursor-pointer hover:border-blue-500 transition-all">
                                        {s.rabat_procenat > 0 && <div className="absolute top-0 left-0 h-full w-1 bg-pink-500"></div>}
                                        <div className="ml-2"><p className="text-white text-xs font-black">{s.sifra} <span className="text-slate-400 font-normal ml-1">{s.naziv}</span></p><p className="text-[9px] text-slate-500 uppercase mt-1">Unos: {s.kolicina_unos} {s.jm_unos} | Obr: <b className="text-white">{s.kolicina_obracun} {s.jm_obracun}</b> x {s.cijena_baza.toFixed(2)} {form.valuta}</p></div>
                                        <div className="flex items-center gap-4"><div className="text-right">{s.rabat_procenat > 0 && <p className="text-[9px] text-pink-500 font-bold line-through">{(s.kolicina_obracun * s.cijena_baza).toFixed(2)}</p>}<p className="text-emerald-400 font-black text-sm">{s.ukupno.toFixed(2)} {form.valuta} {s.rabat_procenat > 0 && <span className="text-pink-500 text-[8px] ml-1">(-{s.rabat_procenat}%)</span>}</p></div><button onClick={(e)=>{e.stopPropagation(); ukloniStavku(s.id);}} className="text-red-500 font-black p-2 hover:bg-red-500/20 rounded-lg">✕</button></div>
                                    </div>
                                ))}
                            </div>

                            {/* GLOBALNI RABAT NA SVE STAVKE */}
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-700 pb-4 mb-4">
                                <div className="flex gap-2 items-center bg-pink-900/20 p-2 rounded-xl border border-pink-500/30 w-full md:w-auto">
                                    <label className="text-[9px] text-pink-400 font-black uppercase ml-2">Postavi rabat za SVE stavke (%):</label>
                                    <input type="number" value={globalRabat} onChange={e=>setGlobalRabat(e.target.value)} className="w-16 p-2 bg-black text-white text-center rounded-lg outline-none border border-pink-500/50 font-black" placeholder="0" />
                                    <button onClick={primijeniGlobalniRabat} className="bg-pink-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-pink-500 transition-all shadow-md">Primijeni</button>
                                </div>
                            </div>

                            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700 space-y-2">
                                <div className="flex justify-between text-xs text-slate-400"><span>Iznos bez rabata:</span><span>{totals.bez_rabata} {form.valuta}</span></div>
                                <div className="flex justify-between text-xs text-pink-500 font-bold"><span>Uračunat rabat:</span><span>- {totals.rabat} {form.valuta}</span></div>
                                <div className="flex justify-between text-xs text-slate-400 border-b border-slate-800 pb-2 mb-2"><span>Osnovica za PDV:</span><span>{totals.osnovica} {form.valuta}</span></div>
                                <div className="flex justify-between text-xs text-slate-400 border-b border-slate-800 pb-2 mb-2"><span>PDV (17%):</span><span>{totals.pdv} {form.valuta}</span></div>
                                <div className="flex justify-between text-sm text-white font-bold"><span>UKUPNO SA PDV:</span><span>{totals.za_naplatu} {form.valuta}</span></div>
                                {parseFloat(form.depozit) > 0 && <div className="flex justify-between text-sm text-emerald-400 font-bold mt-1"><span>Uplaćen depozit / Avans:</span><span>- {parseFloat(form.depozit).toFixed(2)} {form.valuta}</span></div>}
                                <div className="flex justify-between text-xl text-white font-black pt-2 mt-2 border-t border-slate-700"><span>PREOSTALO ZA NAPLATU:</span><span className="text-pink-400">{(totals.za_naplatu - (parseFloat(form.depozit)||0)).toFixed(2)} {form.valuta}</span></div>
                            </div>

                            <textarea value={form.napomena} onChange={e=>setForm({...form, napomena:e.target.value})} placeholder="Dodatna napomena na ponudi (opciono)..." className="w-full mt-4 p-4 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-emerald-500" rows="2"></textarea>
                            <button onClick={snimiPonudu} className={`w-full mt-4 py-5 text-white font-black rounded-2xl uppercase text-sm shadow-xl transition-all ${isEditingPonuda ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>{isEditingPonuda ? '✅ Snimi izmjene ponude' : '✅ Kreiraj Ponudu'}</button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-right">
                    
                    {/* SUPERADMIN ALARM ZA MANIPULACIJU RABATIMA */}
                    {loggedUser?.uloga === 'superadmin' && superadminLogs.length > 0 && (
                        <div className="bg-red-950/50 border-2 border-red-500 p-4 rounded-2xl mb-2 shadow-lg col-span-full animate-pulse">
                            <h3 className="text-red-500 font-black uppercase text-[10px] mb-3 flex items-center gap-2 tracking-widest"><span>🚨</span> SUPERADMIN UPOZORENJA: RUČNA KOREKCIJA RABATA (Posljednjih 10)</h3>
                            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                {superadminLogs.map(l => (
                                    <div key={l.id} className="text-[10px] text-slate-300 flex flex-col md:flex-row md:justify-between border-b border-red-500/20 pb-2">
                                        <span><b className="text-red-400">{l.korisnik}</b>: {l.detalji}</span>
                                        <span className="text-slate-500 shrink-0 md:ml-4">{new Date(l.vrijeme).toLocaleString('de-DE')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-emerald-500/30 shadow-2xl">
                        <h3 className="text-emerald-500 font-black uppercase text-xs mb-4 flex justify-between"><span>✅ POTVRĐENE PONUDE</span> <span className="bg-emerald-900/40 px-2 rounded">{ponude.filter(p => p.status === 'POTVRĐENA').length}</span></h3>
                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                            {ponude.filter(p => p.status === 'POTVRĐENA').length === 0 && <p className="text-center text-slate-500 text-xs">Nema potvrđenih ponuda.</p>}
                            {ponude.filter(p => p.status === 'POTVRĐENA').map(p => (
                                <div key={p.id} className="p-4 bg-slate-900 border border-emerald-500/20 rounded-2xl cursor-pointer hover:border-emerald-500 transition-all">
                                    <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-2 cursor-pointer" onClick={() => pokreniIzmjenuPonude(p)}>
                                        <div><p className="text-white text-sm font-black">{p.id}</p><p className="text-slate-400 text-xs font-bold mt-1">{p.kupac_naziv}</p></div>
                                        <div className="text-right"><p className="text-emerald-400 font-black text-lg">{p.ukupno_sa_pdv} {p.valuta}</p><p className="text-[9px] text-slate-500 uppercase">{formatirajDatum(p.datum)}</p></div>
                                    </div>
                                    <div className="flex justify-between items-center mt-2"><button onClick={()=>promijeniStatusBrzo(p, 'NA ODLUČIVANJU')} className="text-[9px] text-slate-400 bg-slate-800 px-3 py-1 rounded hover:bg-amber-900/50 hover:text-amber-400 transition-all">Vrati na odlučivanje ↩</button><span className="text-[9px] text-slate-500">Stavki: {p.stavke_jsonb ? p.stavke_jsonb.length : 0}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-amber-500/30 shadow-2xl">
                            <h3 className="text-amber-500 font-black uppercase text-xs mb-4 flex justify-between"><span>⏳ NA ODLUČIVANJU</span> <span className="bg-amber-900/40 px-2 rounded">{ponude.filter(p => p.status === 'NA ODLUČIVANJU').length}</span></h3>
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {ponude.filter(p => p.status === 'NA ODLUČIVANJU').map(p => (
                                    <div key={p.id} className="p-4 bg-slate-900 border border-amber-500/20 rounded-2xl cursor-pointer hover:border-amber-500 transition-all">
                                        <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-2 cursor-pointer" onClick={() => pokreniIzmjenuPonude(p)}>
                                            <div><p className="text-white text-sm font-black">{p.id}</p><p className="text-slate-400 text-xs font-bold mt-1">{p.kupac_naziv}</p></div>
                                            <div className="text-right"><p className="text-emerald-400 font-black text-lg">{p.ukupno_sa_pdv} {p.valuta}</p><p className="text-[9px] text-slate-500 uppercase">{formatirajDatum(p.datum)}</p></div>
                                        </div>
                                        <div className="flex justify-between items-center mt-2"><button onClick={()=>promijeniStatusBrzo(p, 'POTVRĐENA')} className="text-[9px] text-white font-black bg-emerald-600 px-3 py-1 rounded hover:bg-emerald-500 transition-all">Potvrdi Ponudu ✅</button></div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {ponude.filter(p => p.status === 'REALIZOVANA ✅').length > 0 && (
                            <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-blue-500/30 shadow-2xl opacity-70 hover:opacity-100 transition-all">
                                <h3 className="text-blue-500 font-black uppercase text-xs mb-4">🔐 REALIZOVANO (ZATVORENO)</h3>
                                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                    {ponude.filter(p => p.status === 'REALIZOVANA ✅').map(p => (
                                        <div key={p.id} onClick={() => pokreniIzmjenuPonude(p)} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl cursor-pointer">
                                            <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-2 cursor-pointer" onClick={() => pokreniIzmjenuPonude(p)}>
                                                <div><p className="text-white text-sm font-black">{p.id}</p><p className="text-slate-400 text-xs font-bold mt-1">{p.kupac_naziv}</p></div>
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