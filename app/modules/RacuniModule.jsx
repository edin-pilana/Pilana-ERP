"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import MasterHeader from '../components/MasterHeader';
import MasterSearch from '../components/MasterSearch';
import PametniDialog from '../components/PametniDialog';
import ScannerOverlay from '../components/ScannerOverlay';
import SettingsModule from './SettingsModule';
import { printDokument } from '../utils/printHelpers';
import { useSaaS } from '../utils/useSaaS';
import { toast } from 'sonner';

function Racuni_SearchableOtpremnica({ otpremnice, value, onChange, onScanClick }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const wrapperRef = useRef(null);

    useEffect(() => { setSearch(value || ''); }, [value]);
    useEffect(() => { setSelectedIndex(0); }, [search]);

    useEffect(() => {
        function handleClickOutside(event) { if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false); }
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);
        return () => { document.removeEventListener("mousedown", handleClickOutside); document.removeEventListener("touchstart", handleClickOutside); };
    }, []);

    const safeSearch = (search || '').toString().toUpperCase();
    const filtered = otpremnice.filter(o => (o.id || '').toUpperCase().includes(safeSearch) || (o.kupac_naziv || '').toUpperCase().includes(safeSearch));

    const handleKeyDown = (e) => {
        if (!open) { 
            if (e.key === 'ArrowDown') setOpen(true); 
            else if (e.key === 'Enter' && search) { onChange(search, true); setOpen(false); }
            return; 
        }
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0)); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered.length > 0 && filtered[selectedIndex]) { const sel = filtered[selectedIndex]; onChange(sel.id, true); setSearch(sel.id); setOpen(false); }
            else if (search) { onChange(search, true); setOpen(false); }
        } else if (e.key === 'Escape') { setOpen(false); }
    };

    return (
        <div ref={wrapperRef} className="relative font-black w-full flex bg-theme-panel border-2 border-emerald-500 rounded-xl overflow-visible focus-within:border-emerald-400 transition-all shadow-inner min-h-[45px]">
            <input value={search} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onChange={e => { setSearch(e.target.value); setOpen(true); onChange(e.target.value, false); }} onKeyDown={handleKeyDown} placeholder="Skeniraj otpremnicu ili upiši broj/kupca..." className="flex-1 p-4 bg-transparent text-sm text-theme-text outline-none uppercase font-black tracking-widest relative z-10 min-w-0" />
            <button onClick={onScanClick} className="px-6 bg-emerald-600 text-white text-xl hover:bg-emerald-500 transition-all border-l border-emerald-500/50 relative z-10 shrink-0">📷</button>
            {open && search && (
                <div className="absolute top-full left-0 z-[5000] w-full mt-2 bg-theme-card border border-theme-border rounded-xl shadow-2xl max-h-60 overflow-y-auto text-left custom-scrollbar">
                    {filtered.length === 0 && <div className="p-3 text-xs text-slate-500 text-center italic">Nema rezultata...</div>}
                    {filtered.map((o, idx) => (
                        <div key={o.id} onMouseDown={(e) => { e.preventDefault(); onChange(o.id, true); setSearch(o.id); setOpen(false); }} onMouseEnter={() => setSelectedIndex(idx)} className={`p-3 border-b border-theme-border cursor-pointer transition-colors ${idx === selectedIndex ? 'bg-emerald-600 text-white' : 'hover:bg-theme-panel text-theme-text'}`}>
                            <div className="text-sm font-black">{o.id}</div>
                            <div className="text-[10px] text-slate-400 mt-1">{o.kupac_naziv} | Datum: {o.datum}</div>
                        </div>
                    ))}
                    <div onMouseDown={(e) => { e.preventDefault(); setOpen(false); }} className="p-3 text-center text-[9px] text-red-500 font-black uppercase cursor-pointer hover:bg-red-500 hover:text-white bg-theme-panel rounded-b-xl tracking-widest mt-1 transition-colors">✕ Zatvori</div>
                </div>
            )}
        </div>
    );
}

export default function RacuniModule({ user, header, setHeader, onExit }) {
    const loggedUser = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');
    const currentUser = user?.ime_prezime ? user : loggedUser;
    const hasKupacEdit = currentUser.uloga === 'admin' || currentUser.uloga === 'superadmin' || (currentUser.dozvole && currentUser.dozvole.includes('Baza Kupaca (Edit)'));
    const hasKatalogEdit = currentUser.uloga === 'admin' || currentUser.uloga === 'superadmin' || (currentUser.dozvole && currentUser.dozvole.includes('Katalog Proizvoda (Edit)'));
    
    const saas = useSaaS('racuni_zaglavlje', {
        boja_kartice: '#1e293b', boja_slova: '#ffffff', velicina_naslova: '16', boja_naslova: 'text-emerald-500',
        polja: [
            { id: 'kupac', label: '* KUPAC', span: 'col-span-2' }, { id: 'broj', label: 'BROJ RAČUNA', span: 'col-span-1' },
            { id: 'otpremnica', label: 'Vezna Otpremnica', span: 'col-span-1' }, { id: 'datum', label: 'Datum Izdavanja', span: 'col-span-1' },
            { id: 'rok', label: 'Rok Plaćanja', span: 'col-span-1' }, { id: 'placanje', label: 'Način Plaćanja', span: 'col-span-1' },
            { id: 'valuta', label: 'Valuta', span: 'col-span-1' }, { id: 'status', label: 'Status Naplate', span: 'col-span-4' }
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
    const toggleVelicinaPolja = (index) => {
        const novaLista = [...aktivnaPolja];
        const trenutno = novaLista[index].span;
        novaLista[index].span = trenutno === 'col-span-1' ? 'col-span-2' : (trenutno === 'col-span-2' ? 'col-span-4' : 'col-span-1');
        saas.setUi({...saas.ui, polja: novaLista});
    };
    const spremiDimenzije = (e, index) => {
        if (!saas.isEditMode) return;
        const w = e.currentTarget.style.width; const h = e.currentTarget.style.height;
        if (w || h) {
            const novaLista = [...aktivnaPolja];
            if (w) novaLista[index].customWidth = w;
            if (h) novaLista[index].customHeight = h;
            saas.setUi({...saas.ui, polja: novaLista});
        }
    };

    const [tab, setTab] = useState('novi');
    const [kupci, setKupci] = useState([]);
    const [katalog, setKatalog] = useState([]);
    const [racuni, setRacuni] = useState([]);
    const [blagajnaUplate, setBlagajnaUplate] = useState([]);
    const [otpremniceZaIzbor, setOtpremniceZaIzbor] = useState([]);
    const [showBrziKupac, setShowBrziKupac] = useState(false);
    const [showBrziKatalog, setShowBrziKatalog] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    const [dialog, setDialog] = useState({ isOpen: false });
    const prikaziDialog = (opcije) => setDialog({ isOpen: true, confirmText: 'POTVRDI', cancelText: 'ZATVORI', ...opcije });
    const zatvoriDialog = () => setDialog({ isOpen: false });

    const generisiID = () => `RAC-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;
    const [form, setForm] = useState({
        id: generisiID(), broj_veze: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0],
        rok_placanja: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString().split('T')[0],
        nacin_placanja: 'Virmanski', valuta: 'KM', napomena: '', status: 'NENAPLAĆENO', ukljuciPDV: true
    });
    const [odabraniKupac, setOdabraniKupac] = useState(null);
    const [stavke, setStavke] = useState([]);
    const [isEditingRacun, setIsEditingRacun] = useState(false);
    const [globalRabat, setGlobalRabat] = useState('');
    const [skenerInput, setSkenerInput] = useState('');
    
    const [stavkaForm, setStavkaForm] = useState({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3', sistemski_rabat: 0, konacni_rabat: '', fiksna_cijena: '' });
    const [trenutniProizvod, setTrenutniProizvod] = useState(null);
    const timerRef = useRef(null);

    useEffect(() => { load(); }, []);

    const load = async () => {
        const {data: k} = await supabase.from('kupci').select('*').order('naziv'); setKupci(k||[]);
        const {data: cat} = await supabase.from('katalog_proizvoda').select('*').order('sifra'); setKatalog(cat||[]);
        const {data: r} = await supabase.from('racuni').select('*').order('datum', { ascending: false }); setRacuni(r||[]);
        const {data: bData} = await supabase.from('blagajna').select('id, racun_id, iznos, tip').eq('tip', 'ULAZ'); setBlagajnaUplate(bData || []);
        const {data: o} = await supabase.from('otpremnice').select('id, kupac_naziv, datum, broj_veze, stavke_jsonb, stavke').order('datum', { ascending: false }); setOtpremniceZaIzbor(o||[]);
    };

    const zapisiU_Log = async (akcija, detalji) => { await supabase.from('sistem_audit_log').insert([{ korisnik: currentUser.ime_prezime || 'Nepoznat', akcija, detalji }]); };

    // 🟢 POPRAVLJENA SINHRONIZACIJA KASE: Ažurira postojeću uplatu ako se iznos računa promijeni (nema dupliranja ni razlika!)
    const sinhronizujKasu = async (racunId, status, nacinPlacanja, iznos, kupac) => {
        const { data: postojeceUplate } = await supabase.from('blagajna').select('*').eq('racun_id', racunId).eq('tip', 'ULAZ');
        const cistIznos = parseFloat(iznos) || 0;

        if (status === 'NAPLAĆENO' && nacinPlacanja === 'Gotovina') {
            if (!postojeceUplate || postojeceUplate.length === 0) {
                await supabase.from('blagajna').insert([{
                    id: `KASA-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000)}`, tip: 'ULAZ', kategorija: 'Naplata Računa',
                    iznos: cistIznos, opis: `Automatska gotovinska naplata računa: ${racunId} (${kupac})`, racun_id: racunId,
                    datum: new Date().toISOString().split('T')[0], vrijeme_tekst: new Date().toLocaleTimeString('de-DE'), snimio_korisnik: currentUser.ime_prezime || 'Sistem'
                }]);
            } else if (postojeceUplate.length === 1) {
                if (Math.abs(parseFloat(postojeceUplate[0].iznos) - cistIznos) > 0.01) {
                    await supabase.from('blagajna').update({ iznos: cistIznos }).eq('id', postojeceUplate[0].id);
                }
            }
        } else {
            if (postojeceUplate && postojeceUplate.length === 1 && (postojeceUplate[0].opis || '').includes('Automatska gotovinska naplata') && status === 'NENAPLAĆENO') {
                await supabase.from('blagajna').delete().eq('id', postojeceUplate[0].id);
            }
        }
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

    const izracunajRabat = (proizvod, kupac) => {
        if(!proizvod || !kupac || !kupac.rabati_jsonb) return 0; const rabati = kupac.rabati_jsonb;
        if (rabati.proizvodi && rabati.proizvodi[proizvod.sifra]) return parseFloat(rabati.proizvodi[proizvod.sifra]);
        if (rabati.kategorije && rabati.kategorije[proizvod.kategorija]) return parseFloat(rabati.kategorije[proizvod.kategorija]);
        if (rabati.ukupni) return parseFloat(rabati.ukupni); return 0;
    };

    const normalizujStavkuRacuna = (s, katLista = katalog, kupacObj = odabraniKupac) => {
        const katItem = (katLista || []).find(k => k.sifra === s.sifra) || null;
        const jmObr = (s.jm_obracun || katItem?.default_jedinica || 'm3').toLowerCase();
        const jmUnos = (s.jm_unos || jmObr || 'kom').toLowerCase();
        const kolObr = parseFloat(s.kolicina_obracun ?? s.kolicina ?? 0) || 0;
        const kolUnos = parseFloat(s.kolicina_unos ?? kolObr) || 0;

        let cijenaBaza = parseFloat(s.cijena_baza);
        if (isNaN(cijenaBaza) || cijenaBaza <= 0) {
            cijenaBaza = katItem ? izracunajDinamickuCijenu(katItem, jmObr) : (parseFloat(s.fiksna_cijena) || 0);
        }

        let rabatProc = parseFloat(s.rabat_procenat);
        if (isNaN(rabatProc)) {
            rabatProc = katItem && kupacObj ? izracunajRabat(katItem, kupacObj) : 0;
        }

        let fiksnaCijena = parseFloat(s.fiksna_cijena);
        if (isNaN(fiksnaCijena) || fiksnaCijena <= 0) {
            fiksnaCijena = cijenaBaza - (cijenaBaza * (rabatProc / 100));
        }

        const ukupnoBezRabata = kolObr * cijenaBaza;
        let ukupno = parseFloat(s.ukupno);
        if (isNaN(ukupno) || (ukupno === 0 && kolObr > 0 && fiksnaCijena > 0)) {
            ukupno = kolObr * fiksnaCijena;
        }
        const iznosRabata = Math.max(0, ukupnoBezRabata - ukupno);

        return {
            ...s,
            id: s.id || Math.random().toString(),
            sifra: s.sifra || '',
            naziv: s.naziv || katItem?.naziv || '',
            kolicina_unos: kolUnos,
            jm_unos: jmUnos,
            kolicina_obracun: parseFloat(kolObr.toFixed(4)),
            jm_obracun: jmObr,
            cijena_baza: parseFloat(cijenaBaza.toFixed(2)),
            rabat_procenat: parseFloat(rabatProc.toFixed(2)),
            fiksna_cijena: fiksnaCijena.toFixed(2),
            iznos_rabata: parseFloat(iznosRabata.toFixed(2)),
            ukupno: parseFloat(ukupno.toFixed(2))
        };
    };

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

    const handleOtpremnicaInput = (val, isEnterOrClick = false) => {
        setSkenerInput(val); if (timerRef.current) clearTimeout(timerRef.current); if (!val) return;
        if (isEnterOrClick) ucitajOtpremnicu(val); else timerRef.current = setTimeout(() => ucitajOtpremnicu(val), 2000);
    };

    const ucitajOtpremnicu = async (broj) => {
        try {
            const cistBroj = broj.toUpperCase().trim();
            let otp = otpremniceZaIzbor.find(o => o.id === cistBroj);
            if (!otp) {
                const { data: dbOtp } = await supabase.from('otpremnice').select('*').ilike('id', cistBroj).maybeSingle();
                if (dbOtp) otp = dbOtp;
            }
            if(!otp) { prikaziDialog({ tip: 'greska', naslov: 'Nije pronađeno', poruka: `Otpremnica ${cistBroj} nije pronađena!`, onCancel: zatvoriDialog }); setSkenerInput(''); return; }
            
            const { data: postojeciRacun } = await supabase.from('racuni').select('id').eq('broj_veze', otp.id).limit(1);
            if (postojeciRacun && postojeciRacun.length > 0) { prikaziDialog({ tip: 'upozorenje', naslov: 'Već Fakturisano', poruka: `Otpremnica ${cistBroj} je VEĆ FAKTURISANA na računu: ${postojeciRacun[0].id}!`, onCancel: zatvoriDialog }); setSkenerInput(''); return; }
            
            const kupacIzBaze = kupci.find(k => k.naziv === otp.kupac_naziv);
            setOdabraniKupac(kupacIzBaze || null);

            let ponudaStavke = [];
            if (otp.broj_veze && otp.broj_veze.startsWith('PON-')) {
                const {data: pon} = await supabase.from('ponude').select('stavke_jsonb').eq('id', otp.broj_veze).maybeSingle(); if(pon) ponudaStavke = pon.stavke_jsonb || [];
            } else if (otp.broj_veze && otp.broj_veze.startsWith('RN-')) {
                const {data: rn} = await supabase.from('radni_nalozi').select('broj_ponude').eq('id', otp.broj_veze).maybeSingle();
                if (rn && rn.broj_ponude) { const {data: pon} = await supabase.from('ponude').select('stavke_jsonb').eq('id', rn.broj_ponude).maybeSingle(); if(pon) ponudaStavke = pon.stavke_jsonb || []; }
            }

            let ucitaneOtpStavke = otp.stavke_jsonb || otp.stavke || [];
            if (typeof ucitaneOtpStavke === 'string') { try { ucitaneOtpStavke = JSON.parse(ucitaneOtpStavke); } catch(e) { ucitaneOtpStavke = []; } }

            const grupisaneOtpStavke = [];
            ucitaneOtpStavke.forEach(s => {
                const kolicina = parseFloat(s.kolicina_obracun || s.kolicina || 0);
                const jm = s.jm_obracun || s.jm || 'm3';
                const postojeca = grupisaneOtpStavke.find(g => g.sifra === s.sifra && g.jm_obracun === jm);
                if (postojeca) { postojeca.kolicina_obracun = parseFloat((postojeca.kolicina_obracun + kolicina).toFixed(4)); postojeca.kolicina_unos = postojeca.kolicina_obracun; } 
                else { grupisaneOtpStavke.push({ sifra: s.sifra, naziv: s.naziv, kolicina_unos: kolicina, jm_unos: jm, kolicina_obracun: kolicina, jm_obracun: jm }); }
            });

            const obracunateStavke = grupisaneOtpStavke.map(s => {
                const proizvod = katalog.find(k => k.sifra === s.sifra);
                const kolicina = s.kolicina_obracun; const jm = s.jm_obracun;
                const cijena_baza = proizvod ? izracunajDinamickuCijenu(proizvod, jm) : 0;
                const dogovorenaStavka = ponudaStavke.find(ps => ps.sifra === s.sifra);
                const rabat = dogovorenaStavka ? parseFloat(dogovorenaStavka.rabat_procenat) : (proizvod ? izracunajRabat(proizvod, kupacIzBaze) : 0);
                const fiksna_cijena = dogovorenaStavka && dogovorenaStavka.fiksna_cijena ? parseFloat(dogovorenaStavka.fiksna_cijena) : (cijena_baza - (cijena_baza * (rabat / 100)));
                const ukupno_bez_rabata = kolicina * cijena_baza; const ukupno_sa_rabatom = kolicina * fiksna_cijena;
                return normalizujStavkuRacuna({ id: Math.random().toString(), sifra: s.sifra, naziv: s.naziv, kolicina_unos: kolicina, jm_unos: jm, kolicina_obracun: kolicina, jm_obracun: jm, cijena_baza, rabat_procenat: rabat.toFixed(2), fiksna_cijena: fiksna_cijena.toFixed(2), iznos_rabata: ukupno_bez_rabata - ukupno_sa_rabatom, ukupno: ukupno_sa_rabatom }, katalog, kupacIzBaze);
            });

            setForm({ ...form, kupac_naziv: otp.kupac_naziv, broj_veze: otp.id, napomena: `Povezano sa: ${otp.id}` });
            setStavke(obracunateStavke); setSkenerInput('');
        } catch (err) {
            prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: err.message, onCancel: zatvoriDialog });
            setSkenerInput('');
        }
    };

    const dodajStavku = async () => {
        if(!trenutniProizvod || !stavkaForm.kolicina_obracun || parseFloat(stavkaForm.kolicina_obracun) <= 0) return prikaziDialog({ tip: 'upozorenje', naslov: 'Fale Podaci', poruka: "Odaberite proizvod i provjerite količine!", onCancel: zatvoriDialog });
        if(!odabraniKupac && !form.kupac_naziv) return prikaziDialog({ tip: 'upozorenje', naslov: 'Fale Podaci', poruka: "Prvo odaberite kupca!", onCancel: zatvoriDialog });
        const kolicina = parseFloat(stavkaForm.kolicina_obracun);
        const fiksna_cijena = parseFloat(stavkaForm.fiksna_cijena) || dinamickaCijena;
        const rabat_konacni = dinamickaCijena > 0 ? ((dinamickaCijena - fiksna_cijena) / dinamickaCijena) * 100 : 0;
        if (rabat_konacni > stavkaForm.sistemski_rabat) { await zapisiU_Log('RUČNA_IZMJENA_RABATA', `Na računu ${form.id}, rabat za "${trenutniProizvod.naziv}" ručno povećan na ${rabat_konacni.toFixed(2)}%`); }
        const ukupno_bez_rabata = kolicina * dinamickaCijena; const ukupno_sa_rabatom = kolicina * fiksna_cijena;
        const novaStavka = normalizujStavkuRacuna({ id: stavkaForm.id || Math.random().toString(), sifra: trenutniProizvod.sifra, naziv: trenutniProizvod.naziv, kolicina_unos: parseFloat(stavkaForm.kolicina_unos), jm_unos: stavkaForm.jm_unos, kolicina_obracun: kolicina, jm_obracun: stavkaForm.jm_obracun, cijena_baza: dinamickaCijena, rabat_procenat: rabat_konacni.toFixed(2), fiksna_cijena: fiksna_cijena.toFixed(2), iznos_rabata: ukupno_bez_rabata - ukupno_sa_rabatom, ukupno: ukupno_sa_rabatom });
        if (stavkaForm.id) setStavke(stavke.map(s => s.id === stavkaForm.id ? novaStavka : s)); else setStavke([...stavke, novaStavka]);
        setStavkaForm({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3', sistemski_rabat: 0, konacni_rabat: '', fiksna_cijena: '' }); setTrenutniProizvod(null);
    };

    const primijeniGlobalniRabat = async () => {
        const rabat = parseFloat(globalRabat); if (isNaN(rabat) || rabat < 0 || rabat > 100) return prikaziDialog({ tip: 'upozorenje', naslov: 'Pogrešan unos', poruka: "Unesite validan procenat (0-100)!", onCancel: zatvoriDialog });
        
        prikaziDialog({
            tip: 'info', naslov: 'Masovna Izmjena',
            poruka: `Da li ste sigurni da želite postaviti popust od ${rabat}% na SVE stavke na ovom računu?`,
            confirmText: '✅ PRIMIJENI', cancelText: '✕ ODUSTANI',
            onConfirm: async () => {
                const noveStavke = stavke.map(raw => {
                    const s = normalizujStavkuRacuna(raw);
                    const fiksna_cijena = s.cijena_baza - (s.cijena_baza * (rabat / 100));
                    const ukupno_bez_rabata = s.kolicina_obracun * s.cijena_baza;
                    const ukupno_sa_rabatom = s.kolicina_obracun * fiksna_cijena;
                    return { ...s, rabat_procenat: rabat.toFixed(2), fiksna_cijena: fiksna_cijena.toFixed(2), iznos_rabata: ukupno_bez_rabata - ukupno_sa_rabatom, ukupno: ukupno_sa_rabatom };
                });
                setStavke(noveStavke); setGlobalRabat(''); await zapisiU_Log('RUČNA_IZMJENA_RABATA', `Globalni rabat ${rabat}% primijenjen na računu ${form.id}`); 
                prikaziDialog({ tip: 'uspjeh', naslov: 'Uspješno', poruka: `Rabat od ${rabat}% je uspješno primijenjen!`, onCancel: zatvoriDialog });
            },
            onCancel: zatvoriDialog
        });
    };

    const urediStavku = (stavka) => {
        const cista = normalizujStavkuRacuna(stavka);
        const nadjeni = katalog.find(k => k.sifra === cista.sifra); setTrenutniProizvod(nadjeni || null);
        const tekstZaPolje = nadjeni ? `${nadjeni.sifra} | ${nadjeni.naziv}` : cista.sifra;
        setStavkaForm({ id: cista.id, sifra_unos: tekstZaPolje, kolicina_unos: cista.kolicina_unos, jm_unos: cista.jm_unos, kolicina_obracun: cista.kolicina_obracun, jm_obracun: cista.jm_obracun, sistemski_rabat: izracunajRabat(nadjeni, odabraniKupac), konacni_rabat: cista.rabat_procenat, fiksna_cijena: cista.fiksna_cijena }); window.scrollTo({ top: 300, behavior: 'smooth' });
    };

    const ukloniStavku = (id) => setStavke(stavke.filter(s => s.id !== id));

    const totals = useMemo(() => {
        let suma_bez_rabata = 0, suma_rabata = 0, suma_krajnja = 0;
        stavke.forEach(raw => { 
            const s = normalizujStavkuRacuna(raw);
            suma_bez_rabata += (s.kolicina_obracun * s.cijena_baza); 
            suma_rabata += s.iznos_rabata; 
            suma_krajnja += s.ukupno; 
        });
        const pdv = form.ukljuciPDV ? suma_krajnja * 0.17 : 0;
        return { bez_rabata: suma_bez_rabata.toFixed(2), rabat: suma_rabata.toFixed(2), osnovica: suma_krajnja.toFixed(2), pdv: pdv.toFixed(2), za_naplatu: (suma_krajnja + pdv).toFixed(2) };
    }, [stavke, form.ukljuciPDV, katalog, odabraniKupac]);

    const snimiRacun = async () => {
        if(!form.kupac_naziv) return prikaziDialog({ tip: 'upozorenje', naslov: 'Kupac Obavezan', poruka: "Kupac je obavezan!", onCancel: zatvoriDialog }); 
        if(stavke.length === 0) return prikaziDialog({ tip: 'upozorenje', naslov: 'Nema Stavki', poruka: "Račun mora imati stavke!", onCancel: zatvoriDialog });
        
        if (!isEditingRacun && form.broj_veze) {
            const { data: postojece } = await supabase.from('racuni').select('id').eq('broj_veze', form.broj_veze).limit(1);
            if (postojece && postojece.length > 0) {
                return prikaziDialog({ tip: 'greska', naslov: 'Već Fakturisano', poruka: `Otpremnica ${form.broj_veze} je VEĆ FAKTURISANA na računu: ${postojece[0].id}!`, onCancel: zatvoriDialog });
            }
        }

        const cisteStavke = stavke.map(s => normalizujStavkuRacuna(s));

        const payload = {
            id: form.id.toUpperCase(), broj_veze: form.broj_veze, kupac_naziv: form.kupac_naziv, datum: form.datum, rok_placanja: form.rok_placanja || null, nacin_placanja: form.nacin_placanja, valuta: form.valuta, napomena: form.napomena, stavke_jsonb: cisteStavke, status: form.status,
            ukupno_bez_pdv: parseFloat(totals.osnovica), ukupno_rabat: parseFloat(totals.rabat), ukupno_sa_pdv: parseFloat(totals.za_naplatu), snimio_korisnik: currentUser.ime_prezime
        };
        
        if (isEditingRacun) {
            const { error } = await supabase.from('racuni').update(payload).eq('id', form.id);
            if(error) return prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: error.message, onCancel: zatvoriDialog });
            await zapisiU_Log('IZMJENA_RAČUNA', `Ažuriran račun ${form.id}`); 
        } else {
            const { error } = await supabase.from('racuni').insert([payload]);
            if(error) return prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: error.message, onCancel: zatvoriDialog });
            await zapisiU_Log('KREIRAN_RAČUN', `Račun ${form.id}`); 
        }
        
        await sinhronizujKasu(form.id.toUpperCase(), form.status, form.nacin_placanja, totals.za_naplatu, form.kupac_naziv);
        
        resetFormu(); load(); setTab('lista');

        prikaziDialog({
            tip: 'uspjeh',
            naslov: isEditingRacun ? "Račun Ažuriran!" : "Račun Kreiran!",
            poruka: "Račun je uspješno pohranjen u sistem. Želite li odmah isprintati ovaj račun?",
            confirmText: '🖨️ DA, ŠTAMPAJ',
            cancelText: '✕ ZATVORI',
            onConfirm: () => { kreirajPDFPrivremeni(payload); zatvoriDialog(); },
            onCancel: zatvoriDialog
        });
    };

    const pokreniIzmjenuRacuna = (r) => {
        const kupObj = kupci.find(k => k.naziv === r.kupac_naziv) || null;
        setOdabraniKupac(kupObj);
        const ukljuciPDV = parseFloat(r.ukupno_sa_pdv) > parseFloat(r.ukupno_bez_pdv);
        setForm({ id: r.id, broj_veze: r.broj_veze || '', kupac_naziv: r.kupac_naziv, datum: r.datum, rok_placanja: r.rok_placanja, nacin_placanja: r.nacin_placanja || 'Virmanski', valuta: r.valuta || 'KM', napomena: r.napomena || '', status: r.status || 'NENAPLAĆENO', ukljuciPDV });
        setStavke((r.stavke_jsonb || []).map(st => normalizujStavkuRacuna(st, katalog, kupObj))); 
        setIsEditingRacun(true); setTab('novi'); window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const promijeniStatusBrzo = async (r, noviStatus) => {
        await supabase.from('racuni').update({ status: noviStatus }).eq('id', r.id);
        await sinhronizujKasu(r.id, noviStatus, r.nacin_placanja, r.ukupno_sa_pdv, r.kupac_naziv);
        await zapisiU_Log('STATUS_RAČUNA', `Račun ${r.id} prebačen u ${noviStatus}`); load();
    };

    const resetFormu = () => {
        setForm({ id: generisiID(), broj_veze: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0], rok_placanja: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString().split('T')[0], nacin_placanja: 'Virmanski', valuta: 'KM', napomena: '', status: 'NENAPLAĆENO', ukljuciPDV: true });
        setStavke([]); setOdabraniKupac(null); setIsEditingRacun(false); setSkenerInput(''); setGlobalRabat('');
    };

    const formatirajDatum = (isoString) => { if(!isoString) return ''; const [y, m, d] = isoString.split('T')[0].split('-'); return `${d}.${m}.${y}.`; };

    const kreirajPDF = () => { kreirajPDFPrivremeni(form); };

    const kreirajPDFPrivremeni = (podaci) => {
        const stariNaslov = document.title; document.title = `racuni_${podaci.id}_${(podaci.kupac_naziv || 'Nepoznat_Kupac').replace(/\s+/g, '_')}`;
        const kupacZaPdf = kupci.find(k => k.naziv === podaci.kupac_naziv) || odabraniKupac || null;
        const cisteStavkeZaPdf = (podaci.stavke_jsonb || stavke || []).map(st => normalizujStavkuRacuna(st, katalog, kupacZaPdf));

        let sumaBezRabata = 0; let sumaRabata = 0; let sumaOsnovica = 0;

        let redovi = cisteStavkeZaPdf.map((s, i) => {
            const kat = katalog.find(k => k.sifra === s.sifra);
            let dimenzijeTekst = ''; 
            if (kat) dimenzijeTekst = `<span class="prod-dim">Dimenzije: ${kat.visina}x${kat.sirina}x${kat.duzina} cm</span>`;
            const kol = parseFloat(s.kolicina_obracun) || 0;
            const cBaza = parseFloat(s.cijena_baza) || 0;
            const rabatP = parseFloat(s.rabat_procenat) || 0;
            const uk = parseFloat(s.ukupno) || 0;

            sumaBezRabata += (kol * cBaza);
            sumaRabata += Math.max(0, (kol * cBaza) - uk);
            sumaOsnovica += uk;

            return `<tr><td style="font-weight: bold; color: #64748b; vertical-align: top; padding-top: 8px;">${i+1}.</td><td style="vertical-align: top; padding-top: 8px;"><span class="prod-sifra">ŠIFRA: ${s.sifra}</span><span class="prod-naziv">${s.naziv}</span>${dimenzijeTekst}</td><td class="num" style="color: #0f172a; text-align: center; vertical-align: top; padding-top: 8px;">${kol} <span style="color: #64748b; font-size: 9px; font-weight: 600;">${s.jm_obracun}</span></td><td class="num" style="font-weight: 600; vertical-align: top; padding-top: 8px;">${cBaza.toFixed(2)}</td><td class="num" style="color: #10b981; font-weight: 800; vertical-align: top; padding-top: 8px;">${rabatP > 0 ? rabatP + '%' : '-'}</td><td class="num" style="font-weight: 900; color: #0f172a; font-size: 13px; vertical-align: top; padding-top: 8px;">${uk.toFixed(2)}</td></tr>`;
        }).join('');

        const imaPdv = podaci.ukljuciPDV !== undefined ? podaci.ukljuciPDV : (parseFloat(podaci.ukupno_sa_pdv || 0) > parseFloat(podaci.ukupno_bez_pdv || 0));
        const pdvIznos = imaPdv ? (sumaOsnovica * 0.17) : 0;
        const ukupnoSaPDV = sumaOsnovica + pdvIznos;
        const val = podaci.valuta || 'KM';

        const htmlSadrzajTabela = `<style>table th, table td { padding: 4px 6px !important; } .footer { margin-top: 25px !important; font-size: 11px !important; display: flex; justify-content: space-between; } .napomena { width: 60%; color: #475569; line-height: 1.4; } .potpis { width: 30%; text-align: center; color: #64748b; }</style><div class="info-grid"><div class="info-col-left"><h4>Kupac / Klijent</h4><h2>${podaci.kupac_naziv}</h2><p>${kupacZaPdf?.adresa || 'Adresa nije unesena'}</p><p style="margin-top: 3px;">PDV / ID: <b style="color: #0f172a;">${kupacZaPdf?.pdv_broj || 'N/A'}</b></p></div><div class="info-col-right"><p>Vezni dokument: <b>${podaci.broj_veze || 'N/A'}</b></p><p style="margin-top: 2px;">Plaćanje: <b>${podaci.nacin_placanja}</b></p><p style="margin-top: 2px;">Valuta: <b>${val}</b></p><p style="color: #10b981; margin-top: 8px;">Rok plaćanja: <b>${formatirajDatum(podaci.rok_placanja)}</b></p></div></div><table><thead><tr><th style="width: 5%;">R.B.</th><th>Naziv Proizvoda i Šifra (Dimenzije u cm)</th><th style="text-align:center;">Količina</th><th class="num">Cijena</th><th class="num">Rabat</th><th class="num">Ukupno (${val})</th></tr></thead><tbody>${redovi}</tbody></table><div class="footer"><div class="napomena"><b style="color: #0f172a; text-transform: uppercase;">Napomena uz račun:</b><br/>${podaci.napomena || 'Nema dodatnih napomena.'}</div><div class="potpis"><div style="border-bottom: 1px solid #cbd5e1; margin-bottom: 5px; height: 40px;"></div>Potpis i pečat izdavaoca</div></div>`;

        const donjiTotaliHtml = `<table class="totals-table"><tr><td class="lbl">Iznos bez rabata:</td><td class="val">${sumaBezRabata.toFixed(2)} ${val}</td></tr>${sumaRabata > 0 ? `<tr><td class="lbl" style="color: #10b981;">Uračunati rabat:</td><td class="val" style="color: #10b981;">- ${sumaRabata.toFixed(2)} ${val}</td></tr>` : ''}${imaPdv ? `<tr><td class="lbl">Osnovica za PDV:</td><td class="val">${sumaOsnovica.toFixed(2)} ${val}</td></tr><tr><td class="lbl">PDV iznos (17%):</td><td class="val">${pdvIznos.toFixed(2)} ${val}</td></tr>` : ''}<tr class="grand-total"><td class="lbl">ZA NAPLATU:</td><td class="val">${ukupnoSaPDV.toFixed(2)} ${val}</td></tr></table>`;

        printDokument('RAČUN', podaci.id, formatirajDatum(podaci.datum), htmlSadrzajTabela, '#10b981', donjiTotaliHtml); setTimeout(() => { document.title = stariNaslov; }, 2000);
    };

    const renderPoljeZaglavlja = (polje) => {
        if (polje.id === 'kupac') return (
            <div className="flex gap-2 items-center w-full min-w-0 h-full">
                <div className="flex-1 min-w-0 h-full">
                    <MasterSearch data={kupci} poljaZaPretragu={['naziv']} value={form.kupac_naziv} onSelect={k => { setForm({...form, kupac_naziv: k.naziv}); setOdabraniKupac(k); }} placeholder="Odaberi kupca..." />
                </div>
                {hasKupacEdit && <button onClick={() => setShowBrziKupac(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 h-full min-h-[45px] rounded-xl shadow-lg shrink-0 text-[10px] font-black">➕ NOVI</button>}
            </div>
        );
        if (polje.id === 'broj') return <input value={form.id} disabled={isEditingRacun} onChange={e=>setForm({...form, id:e.target.value})} className="w-full min-w-0 h-full min-h-[45px] p-3 bg-theme-card rounded-xl text-xs text-theme-text outline-none border border-theme-border font-black uppercase disabled:opacity-50" />;
        if (polje.id === 'otpremnica') return <input value={form.broj_veze} onChange={e=>setForm({...form, broj_veze:e.target.value.toUpperCase()})} className="w-full min-w-0 h-full min-h-[45px] p-3 bg-theme-card rounded-xl text-xs text-emerald-400 outline-none border border-emerald-500/30 font-black uppercase" />;
        if (polje.id === 'datum') return <input type="date" value={form.datum} onChange={e=>setForm({...form, datum:e.target.value})} className="w-full min-w-0 h-full min-h-[45px] p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border" />;
        if (polje.id === 'rok') return <input type="date" value={form.rok_placanja} onChange={e=>setForm({...form, rok_placanja:e.target.value})} className="w-full min-w-0 h-full min-h-[45px] p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border" />;
        if (polje.id === 'valuta') return <select value={form.valuta} onChange={e=>setForm({...form, valuta:e.target.value})} className="w-full min-w-0 h-full min-h-[45px] p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border cursor-pointer"><option value="KM">BAM (KM)</option><option value="EUR">EUR (€)</option><option value="RSD">RSD</option></select>;
        if (polje.id === 'status') return <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})} className="w-full min-w-0 h-full min-h-[45px] p-3 bg-emerald-900/20 rounded-xl text-xs text-emerald-400 font-black outline-none border border-emerald-500/50 cursor-pointer"><option value="NENAPLAĆENO">⏳ NENAPLAĆENO</option><option value="DJELIMIČNO PLAĆENO">🌗 DJELIMIČNO PLAĆENO</option><option value="NAPLAĆENO">✅ NAPLAĆENO</option></select>;
        
        if (polje.id === 'placanje') return (
            <div className="flex flex-col gap-2 h-full w-full min-w-0">
                <select value={form.nacin_placanja} onChange={e => {
                    const val = e.target.value;
                    setForm({...form, nacin_placanja: val, ukljuciPDV: val === 'Virmanski'});
                }} className="w-full min-w-0 p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border cursor-pointer">
                    <option value="Virmanski">Virmanski (Sa PDV)</option><option value="Gotovina">Gotovina (Bez PDV)</option><option value="Kartica">Kartica</option>
                </select>
                <div className="flex flex-wrap items-center gap-4 text-[10px] uppercase font-black text-slate-400 pl-1">
                    <label className="flex items-center gap-1 cursor-pointer hover:text-white"><input type="radio" name="pdv_racun" checked={form.ukljuciPDV} onChange={() => setForm({...form, ukljuciPDV: true})} /> + Obračunaj PDV</label>
                    <label className="flex items-center gap-1 cursor-pointer hover:text-white"><input type="radio" name="pdv_racun" checked={!form.ukljuciPDV} onChange={() => setForm({...form, ukljuciPDV: false})} /> Bez PDV-a</label>
                </div>
            </div>
        );
        return null;
    };

    // 🟢 Pomoćna funkcija za izračun uplaćenog iznosa i preostalog duga po računu
    const izracunajDugRacuna = (r) => {
        const uplate = blagajnaUplate.filter(b => b.racun_id === r.id);
        const uplaceno = uplate.reduce((s, b) => s + parseFloat(b.iznos || 0), 0);
        const ukupno = parseFloat(r.ukupno_sa_pdv || 0);
        const preostalo = Math.max(0, ukupno - uplaceno);
        return { uplaceno, preostalo };
    };

    const otvoreniRacuniLista = racuni.filter(r => r.status !== 'NAPLAĆENO');
    const naplaceniRacuniLista = racuni.filter(r => r.status === 'NAPLAĆENO');

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 font-bold animate-in fade-in" style={{ color: saas.ui.boja_slova }}>
            {showBrziKupac && <div className="fixed inset-0 z-[200] bg-[#090e17]/95 flex flex-col p-4 overflow-y-auto backdrop-blur-md animate-in fade-in"><SettingsModule onExit={() => { setShowBrziKupac(false); load(); }} lockedTab="kupci" /></div>}
            {showBrziKatalog && <div className="fixed inset-0 z-[200] bg-[#090e17]/95 flex flex-col p-4 overflow-y-auto backdrop-blur-md animate-in fade-in"><SettingsModule onExit={() => { setShowBrziKatalog(false); load(); }} lockedTab="katalog" /></div>}
            <PametniDialog {...dialog} />
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-emerald-500" user={user} modulIme="racuni" saas={saas} hideMasina={true} />

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
                <button onClick={() => {setTab('novi'); if(!isEditingRacun) resetFormu();}} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all font-black ${tab === 'novi' ? 'bg-emerald-600 text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-theme-text'}`}>{isEditingRacun ? '✏️ Ažuriranje Računa' : '➕ Novi Račun'}</button>
                <button onClick={() => setTab('lista')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all font-black ${tab === 'lista' ? 'bg-emerald-600 text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-theme-text'}`}>📋 Lista Računa ({racuni.length})</button>
            </div>

            {tab === 'novi' ? (
                <div className="space-y-4 animate-in slide-in-from-left max-w-4xl mx-auto">
                    {!isEditingRacun && (
                        <div className="bg-emerald-950/30 border border-emerald-500/50 p-6 rounded-box shadow-xl relative z-[60]" style={{ backgroundColor: saas.ui.boja_kartice }}>
                            <label className="text-[10px] text-emerald-400 uppercase font-black mb-2 block ml-2">⚡ Povuci podatke iz Otpremnice</label>
                            <Racuni_SearchableOtpremnica otpremnice={otpremniceZaIzbor} value={skenerInput} onChange={handleOtpremnicaInput} onScanClick={() => setIsScanning(true)} />
                        </div>
                    )}

                    <div className={`p-6 rounded-box border-2 shadow-2xl space-y-4 transition-all relative z-[40] ${saas.isEditMode ? 'border-dashed border-amber-500 bg-black/20' : (isEditingRacun ? 'border-amber-500/50 bg-theme-card backdrop-blur-[var(--glass-blur)]' : 'border-emerald-500/30 bg-theme-card backdrop-blur-[var(--glass-blur)]')}`} style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <div className="flex justify-between items-center mb-2 border-b border-theme-border/50 pb-2">
                            <h3 className={`${isEditingRacun ? 'text-amber-500' : saas.ui.boja_naslova} font-black uppercase text-xs`} style={{ fontSize: `${saas.ui.velicina_naslova}px` }}>1. Podaci o kupcu i fakturi</h3>
                            <div className="flex gap-2">
                                {isEditingRacun && <button onClick={kreirajPDF} className="text-[10px] bg-theme-panel text-theme-text border border-slate-600 px-4 py-1.5 rounded-xl uppercase hover:bg-white hover:text-black transition-all shadow-md font-black">🖨️ Isprintaj PDF</button>}
                                {isEditingRacun && <button onClick={resetFormu} className="text-[10px] bg-red-900/30 text-red-400 px-3 py-1.5 rounded-xl uppercase hover:bg-red-900/50">Odustani ✕</button>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border-b border-theme-border pb-4 items-start">
                            {aktivnaPolja.map((polje, index) => {
                                const responsiveSpan = polje.span === 'col-span-4' ? 'col-span-1 md:col-span-4' : (polje.span === 'col-span-2' ? 'col-span-1 md:col-span-2' : 'col-span-1');
                                return (
                                    <div 
                                        key={polje.id} 
                                        className={`relative flex flex-col ${responsiveSpan} min-w-0 transition-all ${saas.isEditMode ? 'border-2 border-dashed border-amber-500 p-2 rounded-xl bg-black/20 resize overflow-auto' : ''}`}
                                        style={{ zIndex: 50 - index, maxWidth: '100%', ...(saas.isEditMode ? { minWidth: '100px', minHeight: '80px', width: polje.customWidth || undefined, height: polje.customHeight || undefined } : {}) }}
                                        draggable={saas.isEditMode}
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragEnter={(e) => handleDragEnter(e, index)}
                                        onDragEnd={handleDrop}
                                        onDragOver={(e) => e.preventDefault()}
                                        onMouseUp={(e) => spremiDimenzije(e, index)}
                                    >
                                        {saas.isEditMode && (
                                            <div className="flex justify-between items-center mb-2 shrink-0">
                                                <span className="text-[9px] text-amber-500 uppercase font-black cursor-move">☰</span>
                                                <button onClick={() => toggleVelicinaPolja(index)} className="text-[8px] text-amber-500 font-black bg-amber-500/20 px-2 py-1 rounded">
                                                    ŠIRINA: {polje.span==='col-span-4'?'100%':polje.span==='col-span-2'?'50%':'25%'}
                                                </button>
                                            </div>
                                        )}
                                        {saas.isEditMode ? (
                                            <input value={polje.label} onChange={(e) => updatePolje(index, 'label', e.target.value)} className="w-full bg-theme-card text-amber-400 p-1 mb-1 rounded border border-amber-500/50 text-[8px] uppercase font-black text-center shrink-0" placeholder="Naslov polja" />
                                        ) : (
                                            polje.label && <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1 shrink-0">{polje.label}</label>
                                        )}
                                        <div className={`flex-1 w-full min-w-0 ${saas.isEditMode ? 'opacity-50 pointer-events-none' : ''}`}>{renderPoljeZaglavlja(polje)}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-4 sm:p-6 rounded-box border border-theme-border shadow-2xl space-y-4" style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <h3 className="text-blue-500 font-black uppercase text-xs mb-4">2. Ručni unos stavki na račun (Dimenzije u cm)</h3>
                        
                        <div className="relative z-40 mb-3">
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Pronađi proizvod (Dimenzije u cm)</label>
                            <div className="flex gap-2 items-center w-full min-w-0">
                                <div className="flex-1 min-w-0">
                                    <MasterSearch 
                                        data={katalog} 
                                        poljaZaPretragu={['sifra', 'naziv']} 
                                        value={stavkaForm.sifra_unos}
                                        onSelect={(k) => handleProizvodSelect(k)} 
                                        placeholder="Pronađi šifru ili naziv..."
                                        renderItem={(k) => (
                                            <div>
                                                <div className="text-theme-text text-xs font-black">{k.visina}x{k.sirina}x{k.duzina} cm | {k.naziv} <span className="text-blue-400 ml-2">(Šifra: {k.sifra})</span></div>
                                                <div className="text-[10px] text-slate-400 mt-1 uppercase">Kat: {k.kategorija} | Baza: {k.default_jedinica} | {k.cijena} KM</div>
                                            </div>
                                        )}
                                    />
                                </div>
                                {hasKatalogEdit && <button onClick={() => setShowBrziKatalog(true)} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-3 rounded-xl shadow-lg shrink-0 text-[10px] font-black">➕ NOVI</button>}
                            </div>
                        </div>

                        {trenutniProizvod && (
                            <div className="p-4 bg-blue-900/10 border border-blue-500/30 rounded-2xl animate-in zoom-in-95 space-y-4 overflow-hidden">
                                <div className="flex justify-between items-start gap-2 border-b border-theme-border pb-3"><div><p className="text-theme-text text-sm font-black">{trenutniProizvod.visina}x{trenutniProizvod.sirina}x{trenutniProizvod.duzina} cm | {trenutniProizvod.naziv}</p><p className="text-[10px] text-slate-400 mt-1">Šifra: {trenutniProizvod.sifra}</p></div><div className="text-right shrink-0"><p className="text-[10px] text-slate-400 uppercase">Cijena po {stavkaForm.jm_obracun}</p><p className="text-emerald-400 font-black text-lg">{dinamickaCijena.toFixed(2)} {form.valuta}</p></div></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end w-full min-w-0">
                                    <div className="w-full min-w-0"><label className="text-[8px] text-slate-400 uppercase ml-2 block mb-1 font-black">Unos: Količina i Jedinica</label><div className="flex gap-1.5 w-full min-w-0"><input type="number" value={stavkaForm.kolicina_unos} onChange={e=>setStavkaForm({...stavkaForm, kolicina_unos:e.target.value})} placeholder="Količina" className="flex-1 min-w-0 p-3 bg-theme-panel rounded-xl text-sm text-theme-text font-black text-center outline-none border border-theme-border focus:border-blue-500 shadow-inner" /><select value={stavkaForm.jm_unos} onChange={e=>setStavkaForm({...stavkaForm, jm_unos:e.target.value})} className="w-24 shrink-0 p-3 bg-theme-panel rounded-xl text-xs text-theme-text font-black outline-none border border-theme-border cursor-pointer shadow-inner uppercase text-center"><option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option></select></div></div>
                                    <div className="w-full min-w-0"><label className="text-[8px] text-slate-400 uppercase ml-2 block mb-1 font-black">Obračunava se po</label><div className="flex gap-1.5 w-full min-w-0"><input type="number" value={stavkaForm.kolicina_obracun} readOnly className="flex-1 min-w-0 p-3 bg-theme-panel/50 rounded-xl text-sm text-slate-300 font-black text-center border border-theme-border outline-none cursor-not-allowed pointer-events-none opacity-90 shadow-inner" /><select value={stavkaForm.jm_obracun} onChange={e=>setStavkaForm({...stavkaForm, jm_obracun:e.target.value})} className="w-24 shrink-0 p-3 bg-theme-panel rounded-xl text-xs text-theme-text font-black outline-none border border-theme-border hover:border-blue-500 cursor-pointer transition-all shadow-inner uppercase text-center"><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option><option value="kom">kom</option></select></div></div>
                                    <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-3 bg-black/20 p-3 rounded-xl border border-theme-border mt-1 shadow-inner w-full min-w-0">
                                        <div className="min-w-0"><label className="text-[8px] text-emerald-500 uppercase ml-1 block mb-1 font-black truncate">Konačna Cijena ({form.valuta})</label><input type="number" value={stavkaForm.fiksna_cijena} onChange={e => { const val = e.target.value; const cijena = parseFloat(val) || 0; const rabat = dinamickaCijena > 0 ? ((dinamickaCijena - cijena) / dinamickaCijena) * 100 : 0; setStavkaForm({...stavkaForm, fiksna_cijena: val, konacni_rabat: rabat.toFixed(2)}); }} className="w-full min-w-0 p-3 bg-emerald-900/20 rounded-xl text-sm text-emerald-400 font-black text-center outline-none border border-emerald-500/50 shadow-inner" /></div>
                                        <div className="min-w-0"><label className="text-[8px] text-blue-400 uppercase ml-1 block mb-1 font-black truncate">Ili Popust %</label><input type="number" value={stavkaForm.konacni_rabat} onChange={e => { const val = e.target.value; const rabat = parseFloat(val) || 0; const cijena = dinamickaCijena - (dinamickaCijena * (rabat / 100)); setStavkaForm({...stavkaForm, konacni_rabat: val, fiksna_cijena: cijena.toFixed(2)}); }} className="w-full min-w-0 p-3 bg-blue-900/20 rounded-xl text-sm text-blue-400 font-black text-center outline-none border border-blue-500/50 shadow-inner" /></div>
                                    </div>
                                </div>
                                <button onClick={dodajStavku} className={`w-full py-4 text-white font-black rounded-xl text-xs shadow-lg uppercase mt-2 transition-all ${stavkaForm.id ? 'bg-amber-600 hover:bg-amber-500' : 'bg-theme-accent hover:opacity-80'}`}>{stavkaForm.id ? '✅ Ažuriraj ovu stavku' : '➕ Dodaj stavku na račun'}</button>
                            </div>
                        )}
                    </div>

                    {stavke.length > 0 && (
                        <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-emerald-500/30 shadow-2xl animate-in slide-in-from-bottom" style={{ backgroundColor: saas.ui.boja_kartice }}>
                            <div className="flex justify-between items-center mb-4"><h3 className="text-emerald-500 font-black uppercase text-xs">3. Stavke na računu i obračun</h3><button onClick={kreirajPDF} className="bg-theme-panel text-theme-text px-4 py-2 rounded-xl text-[10px] uppercase font-black border border-slate-600 hover:bg-white hover:text-black transition-all shadow-md">🖨️ Kreiraj PDF</button></div>
                            <div className="space-y-2 mb-6">
                                {stavke.map((raw) => {
                                    const s = normalizujStavkuRacuna(raw);
                                    const katItem = katalog.find(k => k.sifra === s.sifra);
                                    const dim = katItem ? `${katItem.visina}x${katItem.sirina}x${katItem.duzina} cm` : '';
                                    return (
                                    <div key={s.id} onClick={() => urediStavku(s)} className="flex justify-between items-center p-3 bg-theme-card border border-theme-border rounded-xl relative overflow-hidden cursor-pointer hover:border-emerald-500 transition-all shadow-md group">
                                        {parseFloat(s.rabat_procenat) > 0 && <div className="absolute top-0 left-0 h-full w-1 bg-emerald-500"></div>}
                                        <div className="ml-2"><p className="text-theme-text text-xs font-black">{dim ? `${dim} | ` : ''}{s.naziv}</p><p className="text-[9px] text-slate-500 uppercase mt-1">Šifra: {s.sifra} | Obračun: <b className="text-theme-text">{s.kolicina_obracun} {s.jm_obracun}</b> x {s.fiksna_cijena} {form.valuta}</p></div>
                                        <div className="flex items-center gap-4"><div className="text-right">{parseFloat(s.rabat_procenat) > 0 && <p className="text-[9px] text-emerald-500 font-bold line-through">{(s.kolicina_obracun * s.cijena_baza).toFixed(2)}</p>}<p className="text-emerald-400 font-black text-sm">{(parseFloat(s.ukupno) || 0).toFixed(2)} {form.valuta} {parseFloat(s.rabat_procenat) > 0 && <span className="text-emerald-500 text-[8px] ml-1">(-{s.rabat_procenat}%)</span>}</p></div><button onClick={(e)=>{e.stopPropagation(); ukloniStavku(s.id);}} className="text-red-500 font-black p-2 hover:bg-red-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">✕</button></div>
                                    </div>
                                )})}
                            </div>
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-theme-border pb-4 mb-4">
                                <div className="flex gap-2 items-center bg-emerald-900/20 p-2 rounded-xl border border-emerald-500/30 w-full md:w-auto shadow-inner"><label className="text-[9px] text-emerald-400 font-black uppercase ml-2">Postavi rabat za SVE stavke (%):</label><input type="number" value={globalRabat} onChange={e=>setGlobalRabat(e.target.value)} className="w-16 p-2 bg-theme-panel text-theme-text text-center rounded-lg outline-none border border-emerald-500/50 font-black" placeholder="0" /><button onClick={primijeniGlobalniRabat} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-500 transition-all shadow-md">Primijeni</button></div>
                            </div>
                            <div className="bg-theme-card p-5 rounded-2xl border border-theme-border space-y-2 shadow-inner">
                                <div className="flex justify-between text-xs text-slate-400"><span>Iznos bez rabata:</span><span>{totals.bez_rabata} {form.valuta}</span></div>
                                {parseFloat(totals.rabat) > 0 && <div className="flex justify-between text-xs text-emerald-500 font-bold"><span>Uračunat rabat:</span><span>- {totals.rabat} {form.valuta}</span></div>}
                                {form.ukljuciPDV ? (
                                    <>
                                        <div className="flex justify-between text-xs text-slate-400 border-b border-theme-border pb-2 mb-2"><span>Osnovica za PDV:</span><span>{totals.osnovica} {form.valuta}</span></div>
                                        <div className="flex justify-between text-xs text-slate-400 border-b border-theme-border pb-2 mb-2"><span>PDV (17%):</span><span>{totals.pdv} {form.valuta}</span></div>
                                    </>
                                ) : null}
                                <div className="flex justify-between text-xl text-theme-text font-black pt-2"><span>ZA NAPLATU:</span><span className="text-emerald-400">{totals.za_naplatu} {form.valuta}</span></div>
                            </div>
                            <textarea value={form.napomena} onChange={e=>setForm({...form, napomena:e.target.value})} placeholder="Napomena na računu..." className="w-full mt-4 p-4 bg-theme-card border border-theme-border rounded-xl text-xs text-theme-text outline-none focus:border-emerald-500 shadow-inner" rows="2"></textarea>
                            <button onClick={snimiRacun} className={`w-full mt-4 py-5 text-white font-black rounded-2xl uppercase text-sm shadow-xl transition-all tracking-widest ${isEditingRacun ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>{isEditingRacun ? '✅ Snimi izmjene računa' : '✅ Kreiraj Račun'}</button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-right">
                    {/* 🟢 POPRAVLJENO: Prikazuje sve NENAPLAĆENE i DJELIMIČNO PLAĆENE račune sa tačnim preostalim dugom! */}
                    <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-amber-500/30 shadow-2xl" style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <h3 className="text-amber-500 font-black uppercase text-xs mb-4 flex justify-between"><span>⏳ OTVORENI RAČUNI (Čekaju naplatu / Djelimični)</span> <span className="bg-amber-900/40 px-2 rounded">{otvoreniRacuniLista.length}</span></h3>
                        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            {otvoreniRacuniLista.length === 0 && <p className="text-center text-slate-500 text-xs py-10 border-2 border-dashed border-theme-border rounded-xl">Svi računi su naplaćeni!</p>}
                            {otvoreniRacuniLista.map(r => {
                                const { uplaceno, preostalo } = izracunajDugRacuna(r);
                                const jeDjelimicno = r.status === 'DJELIMIČNO PLAĆENO' || (uplaceno > 0 && preostalo > 0);
                                return (
                                    <div key={r.id} className="p-4 bg-theme-panel border border-amber-500/20 rounded-2xl hover:border-amber-500 transition-all shadow-md">
                                        <div className="flex justify-between items-start border-b border-theme-border pb-2 mb-2 cursor-pointer" onClick={() => pokreniIzmjenuRacuna(r)}>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-theme-text text-sm font-black">{r.id}</p>
                                                    {jeDjelimicno && <span className="text-[8px] bg-blue-900/40 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-black uppercase">🌗 DJELIMIČNO PLAĆENO</span>}
                                                </div>
                                                <p className="text-slate-400 text-xs font-bold mt-1">{r.kupac_naziv}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-amber-400 font-black text-lg">{r.ukupno_sa_pdv} {r.valuta}</p>
                                                <p className="text-[9px] text-red-400 uppercase font-bold">Rok: {formatirajDatum(r.rok_placanja)}</p>
                                            </div>
                                        </div>
                                        {uplaceno > 0 && (
                                            <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg border border-theme-border/60 text-[10px] mb-2">
                                                <span className="text-emerald-400 font-black">Uplaćeno: {uplaceno.toFixed(2)} {r.valuta}</span>
                                                <span className="text-amber-400 font-black">Preostali dug: {preostalo.toFixed(2)} {r.valuta}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center mt-2"><button onClick={()=>promijeniStatusBrzo(r, 'NAPLAĆENO')} className="text-[9px] text-white font-black bg-emerald-600 px-3 py-2 rounded-lg hover:bg-emerald-500 transition-all w-full uppercase tracking-widest shadow-md">Označi kao NAPLAĆENO ✅</button></div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-emerald-500/30 shadow-2xl opacity-80 hover:opacity-100 transition-all" style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <h3 className="text-emerald-500 font-black uppercase text-xs mb-4 flex justify-between"><span>🔐 ARHIVA (NAPLAĆENO)</span> <span className="bg-emerald-900/40 px-2 rounded">{naplaceniRacuniLista.length}</span></h3>
                        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            {naplaceniRacuniLista.map(r => (
                                <div key={r.id} className="p-4 bg-theme-panel border border-emerald-500/20 rounded-2xl shadow-sm">
                                    <div className="flex justify-between items-start border-b border-theme-border pb-2 mb-2 cursor-pointer" onClick={() => pokreniIzmjenuRacuna(r)}>
                                        <div><p className="text-theme-text text-sm font-black">{r.id}</p><p className="text-slate-400 text-xs font-bold mt-1">{r.kupac_naziv}</p></div>
                                        <div className="text-right"><p className="text-emerald-400 font-black text-lg">{r.ukupno_sa_pdv} {r.valuta}</p><p className="text-[9px] text-slate-500 uppercase">Izdato: {formatirajDatum(r.datum)}</p></div>
                                    </div>
                                    <div className="flex justify-between items-center mt-2"><button onClick={()=>promijeniStatusBrzo(r, 'NENAPLAĆENO')} className="text-[9px] text-slate-400 bg-theme-card border border-theme-border px-3 py-1 rounded hover:bg-amber-900/50 hover:text-amber-400 transition-all shadow-sm">Vrati u nenaplaćeno ↩</button></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {isScanning && <ScannerOverlay onScan={(text) => { ucitajOtpremnicu(text); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}