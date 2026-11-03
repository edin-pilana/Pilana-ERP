"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { preracunajKolicinu } from '../utils/mjereHelpers';
import MasterHeader from '../components/MasterHeader';
import MasterSearch from '../components/MasterSearch';
import PametniDialog from '../components/PametniDialog';
import ScannerOverlay from '../components/ScannerOverlay';
import SettingsModule from './SettingsModule';
import { printDokument } from '../utils/printHelpers';
import { useSaaS } from '../utils/useSaaS';
import { toast } from 'sonner';

function OTP_SearchableNalog({ nalozi, ponude, value, onChange, onScanClick }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const wrapperRef = useRef(null);

    useEffect(() => { setSearch(value || ''); }, [value]);
    useEffect(() => { setSelectedIndex(0); }, [search]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const kombinovanaLista = useMemo(() => {
        const rnList = (nalozi || []).map(n => ({ id: n.id, kupac_naziv: n.kupac_naziv, status: n.status, tip: 'RADNI NALOG' }));
        const ponList = (ponude || []).map(p => ({ id: p.id, kupac_naziv: p.kupac_naziv, status: p.status, tip: 'PONUDA' }));
        return [...rnList, ...ponList];
    }, [nalozi, ponude]);

    const q = (search || '').toString().toUpperCase();
    const filtered = kombinovanaLista.filter(item =>
        (item.id || '').toUpperCase().includes(q) ||
        (item.kupac_naziv || '').toUpperCase().includes(q)
    );

    const handleKeyDown = (e) => {
        if (!open) {
            if (e.key === 'ArrowDown') setOpen(true);
            else if (e.key === 'Enter' && search) { onChange(search, true); setOpen(false); }
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered.length > 0 && filtered[selectedIndex]) {
                const sel = filtered[selectedIndex];
                onChange(sel.id, true);
                setSearch(sel.id);
                setOpen(false);
            } else if (search) {
                onChange(search, true);
                setOpen(false);
            }
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    return (
        <div ref={wrapperRef} className="relative font-black w-full flex bg-theme-panel border-2 border-orange-500 rounded-xl overflow-visible focus-within:border-orange-400 transition-all shadow-inner min-h-[45px]">
            <input
                value={search}
                onFocus={() => setOpen(true)}
                onClick={() => setOpen(true)}
                onChange={e => { setSearch(e.target.value); setOpen(true); onChange(e.target.value, false); }}
                onKeyDown={handleKeyDown}
                placeholder="Skeniraj ili upiši broj Radnog Naloga / Ponude..."
                className="flex-1 min-w-0 p-4 bg-transparent text-sm text-theme-text outline-none uppercase font-black tracking-widest relative z-10"
            />
            <button onClick={onScanClick} className="shrink-0 px-6 bg-orange-600 text-white text-xl hover:bg-orange-500 transition-all border-l border-orange-500/50 relative z-10">📷</button>
            {open && search && (
                <div className="absolute top-full left-0 z-[100] w-full mt-2 bg-theme-panel border border-theme-border rounded-xl shadow-2xl max-h-60 overflow-y-auto text-left custom-scrollbar">
                    {filtered.length === 0 && <div className="p-3 text-xs text-slate-500 text-center italic">Nema rezultata...</div>}
                    {filtered.map((item, idx) => (
                        <div
                            key={item.id}
                            onMouseDown={(e) => { e.preventDefault(); onChange(item.id, true); setSearch(item.id); setOpen(false); }}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            className={`p-3 border-b border-theme-border cursor-pointer transition-colors ${idx === selectedIndex ? 'bg-orange-600 text-white' : 'hover:bg-theme-card text-theme-text'}`}
                        >
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-black">{item.id}</span>
                                <span className="text-[9px] px-2 py-0.5 rounded bg-black/30 uppercase">{item.tip}</span>
                            </div>
                            <div className="text-[10px] text-slate-300 mt-1">{item.kupac_naziv} | Status: {item.status}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function OtpremniceModule({ user, header, setHeader, onExit }) {
    const loggedUser = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');
    const currentUser = user?.ime_prezime ? user : loggedUser;
    const hasKupacEdit = currentUser.uloga === 'admin' || currentUser.uloga === 'superadmin' || (currentUser.dozvole && currentUser.dozvole.includes('Baza Kupaca (Edit)'));
    const hasKatalogEdit = currentUser.uloga === 'admin' || currentUser.uloga === 'superadmin' || (currentUser.dozvole && currentUser.dozvole.includes('Katalog Proizvoda (Edit)'));

    const saas = useSaaS('otpremnice_zaglavlje', {
        boja_kartice: '#1e293b',
        boja_slova: '#ffffff',
        velicina_naslova: '16',
        boja_naslova: 'text-orange-500',
        polja: [
            { id: 'kupac', label: '* KUPAC (Primalac robe)', span: 'col-span-2' },
            { id: 'broj', label: 'BROJ OTPREMNICE', span: 'col-span-1' },
            { id: 'veza', label: 'Vezni RN / Ponuda', span: 'col-span-1' },
            { id: 'datum', label: 'Datum Otpreme', span: 'col-span-1' },
            { id: 'vozac', label: 'Ime Vozača / Prevoznik', span: 'col-span-1' },
            { id: 'registracija', label: 'Registarske Tablice', span: 'col-span-1' },
            { id: 'status', label: 'Status Otpremnice', span: 'col-span-1' }
        ]
    });

    const aktivnaPolja = saas.ui.polja?.length > 0 ? saas.ui.polja : saas.defaultConfig.polja;
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    const handleDragStart = (e, index) => { dragItem.current = index; };
    const handleDragEnter = (e, index) => { dragOverItem.current = index; };
    const handleDrop = () => {
        if (dragItem.current === null || dragOverItem.current === null) return;
        const novaLista = [...aktivnaPolja];
        const premjesteni = novaLista[dragItem.current];
        novaLista.splice(dragItem.current, 1);
        novaLista.splice(dragOverItem.current, 0, premjesteni);
        dragItem.current = null;
        dragOverItem.current = null;
        saas.setUi({ ...saas.ui, polja: novaLista });
    };
    const updatePolje = (index, key, val) => {
        const novaLista = [...aktivnaPolja];
        novaLista[index][key] = val;
        saas.setUi({ ...saas.ui, polja: novaLista });
    };
    const toggleVelicinaPolja = (index) => {
        const novaLista = [...aktivnaPolja];
        const tr = novaLista[index].span;
        novaLista[index].span = tr === 'col-span-1' ? 'col-span-2' : (tr === 'col-span-2' ? 'col-span-4' : 'col-span-1');
        saas.setUi({ ...saas.ui, polja: novaLista });
    };
    const spremiDimenzije = (e, index) => {
        if (!saas.isEditMode) return;
        const w = e.currentTarget.style.width;
        const h = e.currentTarget.style.height;
        if (w || h) {
            const novaLista = [...aktivnaPolja];
            if (w) novaLista[index].customWidth = w;
            if (h) novaLista[index].customHeight = h;
            saas.setUi({ ...saas.ui, polja: novaLista });
        }
    };

    const [tab, setTab] = useState('nova');
    const [kupci, setKupci] = useState([]);
    const [katalog, setKatalog] = useState([]);
    const [nalozi, setNalozi] = useState([]);
    const [ponude, setPonude] = useState([]);
    const [otpremnice, setOtpremnice] = useState([]);
    const [slobodniPaketi, setSlobodniPaketi] = useState([]);
    const [loadingData, setLoadingData] = useState(false);

    const [showBrziKupac, setShowBrziKupac] = useState(false);
    const [showBrziKatalog, setShowBrziKatalog] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanTarget, setScanTarget] = useState('nalog'); // 'nalog' | 'paket'

    const [dialog, setDialog] = useState({ isOpen: false });
    const prikaziDialog = (opcije) => setDialog({ isOpen: true, confirmText: 'POTVRDI', cancelText: 'ZATVORI', ...opcije });
    const zatvoriDialog = () => setDialog({ isOpen: false });

    // Modal za odabir paketa sa lagera i djelimično skidanje (rasturanje paketa)
    const [showLagerModal, setShowLagerModal] = useState(false);
    const [pretragaLagera, setPretragaLagera] = useState('');
    const [odabraniPaketZaUtovar, setOdabraniPaketZaUtovar] = useState(null);
    const [modUtovaraPaketa, setModUtovaraPaketa] = useState('CIJELI'); // 'CIJELI' | 'DJELIMICNO'
    const [djelimicnaKolicina, setDjelimicnaKolicina] = useState('');
    const [djelimicnaJm, setDjelimicnaJm] = useState('kom');

    const generisiID = () => `OTP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const [form, setForm] = useState({
        id: generisiID(),
        broj_veze: '',
        kupac_naziv: '',
        datum: new Date().toISOString().split('T')[0],
        vozac: '',
        registracija: '',
        napomena: '',
        status: 'ISPORUČENO'
    });

    const [stavke, setStavke] = useState([]);
    const [isEditingOtpremnica, setIsEditingOtpremnica] = useState(false);
    const [skenerInput, setSkenerInput] = useState('');
    const [paketScanInput, setPaketScanInput] = useState('');

    const [stavkaForm, setStavkaForm] = useState({
        id: null,
        sifra_unos: '',
        kolicina_unos: '',
        jm_unos: 'kom',
        kolicina_obracun: '',
        jm_obracun: 'm3'
    });
    const [trenutniProizvod, setTrenutniProizvod] = useState(null);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        setLoadingData(true);
        try {
            const [kRes, catRes, rnRes, ponRes, otpRes, pakRes] = await Promise.all([
                supabase.from('kupci').select('*').order('naziv'),
                supabase.from('katalog_proizvoda').select('*').order('sifra'),
                supabase.from('radni_nalozi').select('*').neq('status', 'OBRISANO').order('datum', { ascending: false }),
                supabase.from('ponude').select('*').neq('status', 'OBRISANO').order('datum', { ascending: false }),
                supabase.from('otpremnice').select('*').order('datum', { ascending: false }),
                supabase.from('paketi').select('*').not('closed_at', 'is', null).is('otpremnica_id', null).gt('kolicina_final', 0).order('created_at', { ascending: false })
            ]);

            setKupci(kRes.data || []);
            setKatalog(catRes.data || []);
            setNalozi(rnRes.data || []);
            setPonude(ponRes.data || []);
            const sveOtp = otpRes.data || [];
            setOtpremnice(sveOtp);

            // Grupiši slobodne pakete na lageru po paket_id
            const siroviPaketi = pakRes.data || [];
            const mapaPaketa = {};
            siroviPaketi.forEach(p => {
                const pid = p.paket_id;
                if (!pid) return;
                const deb = parseFloat(p.debljina || 0);
                const sir = parseFloat(p.sirina || 0);
                const duz = parseFloat(p.duzina || 0);
                const vol1Kom = (deb > 0 && sir > 0 && duz > 0) ? (deb / 100) * (sir / 100) * (duz / 100) : 0;
                const m3Red = parseFloat(p.kolicina_final || 0);
                let komRed = parseFloat(p.kolicina_ulaz ?? p.komada ?? 0);
                if ((p.jm || 'kom').toLowerCase() !== 'kom' && vol1Kom > 0) {
                    komRed = Math.round(m3Red / vol1Kom);
                }

                if (!mapaPaketa[pid]) {
                    mapaPaketa[pid] = {
                        ...p,
                        ukupno_m3: m3Red,
                        ukupno_kom: komRed,
                        redovi_baze: [p]
                    };
                } else {
                    mapaPaketa[pid].ukupno_m3 += m3Red;
                    mapaPaketa[pid].ukupno_kom += komRed;
                    mapaPaketa[pid].redovi_baze.push(p);
                }
            });
            setSlobodniPaketi(Object.values(mapaPaketa));

        } catch (err) {
            console.error("Greška pri učitavanju otpremnica:", err);
        } finally {
            setLoadingData(false);
        }
    };

    const zapisiU_Log = async (akcija, detalji, nivo = 'INFO') => {
        await supabase.from('sistem_audit_log').insert([{
            korisnik: currentUser.ime_prezime || 'Sistem',
            akcija,
            detalji,
            nivo_alarma: nivo,
            pregledano: false,
            vrijeme: new Date().toISOString()
        }]);
    };

    const handleVezaInput = (val, isEnter = false) => {
        setSkenerInput(val);
        if (isEnter && val) ucitajVezniDokument(val);
    };

    const ucitajVezniDokument = async (broj) => {
        const cist = (broj || '').toUpperCase().trim();
        if (!cist) return;

        let dok = nalozi.find(n => n.id === cist) || ponude.find(p => p.id === cist);
        if (!dok) {
            if (cist.startsWith('RN-')) {
                const { data } = await supabase.from('radni_nalozi').select('*').ilike('id', cist).maybeSingle();
                dok = data;
            } else if (cist.startsWith('PON-')) {
                const { data } = await supabase.from('ponude').select('*').ilike('id', cist).maybeSingle();
                dok = data;
            }
        }

        if (!dok) {
            return prikaziDialog({ tip: 'greska', naslov: 'Nije pronađeno', poruka: `Dokument ${cist} nije pronađen u bazi!`, onCancel: zatvoriDialog });
        }

        const stavkeDok = (dok.stavke_jsonb || []).map(s => ({
            id: Math.random().toString(),
            sifra: s.sifra,
            naziv: s.naziv,
            dimenzije: s.dimenzije || '',
            kolicina_unos: parseFloat(s.kolicina_unos || s.kolicina_obracun || 0),
            jm_unos: s.jm_unos || 'kom',
            kolicina_obracun: parseFloat(s.kolicina_obracun || 0),
            jm_obracun: s.jm_obracun || 'm3'
        }));

        setForm(prev => ({
            ...prev,
            broj_veze: dok.id,
            kupac_naziv: dok.kupac_naziv || prev.kupac_naziv,
            napomena: dok.napomena || prev.napomena
        }));
        setStavke(stavkeDok);
        setSkenerInput('');
        toast.success(`Učitani podaci iz dokumenta ${dok.id}!`);
    };

    // 🟢 OTVARANJE PAKETA SA LAGERA (CIJELI ILI DJELIMIČNO RASTURANJE)
    const klikniNaPaketSaLagera = (paket) => {
        setOdabraniPaketZaUtovar(paket);
        setModUtovaraPaketa('CIJELI');
        setDjelimicnaKolicina('');
        setDjelimicnaJm(paket.jm || 'kom');
    };

    const izracunajDjelimicniM3 = useMemo(() => {
        if (!odabraniPaketZaUtovar || !djelimicnaKolicina) return 0;
        const kol = parseFloat(djelimicnaKolicina);
        if (isNaN(kol) || kol <= 0) return 0;
        const pr = preracunajKolicinu(
            kol,
            djelimicnaJm,
            'm3',
            odabraniPaketZaUtovar.debljina,
            odabraniPaketZaUtovar.sirina,
            odabraniPaketZaUtovar.duzina
        );
        return pr.m3 > 0 ? pr.m3 : kol;
    }, [odabraniPaketZaUtovar, djelimicnaKolicina, djelimicnaJm]);

    const potvrdiUtovarPaketa = () => {
        if (!odabraniPaketZaUtovar) return;
        const p = odabraniPaketZaUtovar;
        const dimStr = `${p.debljina}x${p.sirina}x${p.duzina}`;

        if (modUtovaraPaketa === 'CIJELI') {
            const novaStavka = {
                id: Math.random().toString(),
                paket_id: p.paket_id,
                tip_utovara: 'CIJELI',
                lager_umanjen: false,
                sifra: p.sifra_proizvoda || p.paket_id,
                naziv: `${p.naziv_proizvoda} [Paket: ${p.paket_id}]`,
                dimenzije: dimStr,
                debljina: p.debljina,
                sirina: p.sirina,
                duzina: p.duzina,
                kolicina_unos: p.ukupno_kom || p.kolicina_ulaz || 1,
                jm_unos: p.jm || 'kom',
                kolicina_obracun: parseFloat(p.ukupno_m3.toFixed(4)),
                jm_obracun: 'm3'
            };
            setStavke(prev => [...prev, novaStavka]);
            setOdabraniPaketZaUtovar(null);
            setShowLagerModal(false);
            toast.success(`Cijeli paket ${p.paket_id} (${p.ukupno_m3.toFixed(3)} m³) dodan na otpremnicu!`);
        } else {
            const kol = parseFloat(djelimicnaKolicina);
            const m3ZaSkinuti = izracunajDjelimicniM3;

            if (isNaN(kol) || kol <= 0 || m3ZaSkinuti <= 0) {
                return toast.error("Unesite ispravnu količinu veću od 0 za djelimično preuzimanje!");
            }
            if (m3ZaSkinuti > p.ukupno_m3 + 0.001) {
                return toast.error(`Ne možete skinuti ${m3ZaSkinuti.toFixed(3)} m³ jer paket ima ukupno ${p.ukupno_m3.toFixed(3)} m³!`);
            }

            const jeZapravoCijeli = Math.abs(m3ZaSkinuti - p.ukupno_m3) < 0.0005;

            const novaStavka = {
                id: Math.random().toString(),
                paket_id: p.paket_id,
                tip_utovara: jeZapravoCijeli ? 'CIJELI' : 'DJELIMICNO',
                lager_umanjen: false,
                sifra: p.sifra_proizvoda || p.paket_id,
                naziv: `${p.naziv_proizvoda} [Dio paketa: ${p.paket_id}]`,
                dimenzije: dimStr,
                debljina: p.debljina,
                sirina: p.sirina,
                duzina: p.duzina,
                kolicina_unos: kol,
                jm_unos: djelimicnaJm,
                kolicina_obracun: parseFloat(m3ZaSkinuti.toFixed(4)),
                jm_obracun: 'm3'
            };

            setStavke(prev => [...prev, novaStavka]);
            setOdabraniPaketZaUtovar(null);
            setShowLagerModal(false);
            toast.success(`Dodano ${kol} ${djelimicnaJm} (${m3ZaSkinuti.toFixed(3)} m³) iz paketa ${p.paket_id}!`);
        }
    };

    const skenirajPaketDirektno = async (kod) => {
        const pid = (kod || '').toUpperCase().trim();
        if (!pid) return;
        const nadjeni = slobodniPaketi.find(p => p.paket_id.toUpperCase() === pid);
        if (nadjeni) {
            klikniNaPaketSaLagera(nadjeni);
            setShowLagerModal(true);
            setPaketScanInput('');
        } else {
            prikaziDialog({ tip: 'greska', naslov: 'Paket nije na stanju', poruka: `Paket "${pid}" nije pronađen među slobodnim zaključanim paketima na lageru!`, onCancel: zatvoriDialog });
            setPaketScanInput('');
        }
    };

    const handleProizvodSelect = (nadjeni) => {
        setTrenutniProizvod(nadjeni || null);
        if (nadjeni) {
            setStavkaForm({
                id: null,
                sifra_unos: `${nadjeni.sifra} | ${nadjeni.naziv}`,
                kolicina_unos: '',
                jm_unos: 'kom',
                kolicina_obracun: '',
                jm_obracun: nadjeni.default_jedinica || 'm3'
            });
        }
    };

    useEffect(() => {
        if (!trenutniProizvod || !stavkaForm.kolicina_unos) return;
        const pr = preracunajKolicinu(
            stavkaForm.kolicina_unos,
            stavkaForm.jm_unos,
            stavkaForm.jm_obracun,
            trenutniProizvod.visina,
            trenutniProizvod.sirina,
            trenutniProizvod.duzina
        );
        setStavkaForm(prev => ({
            ...prev,
            kolicina_obracun: pr.ciljnaKolicina > 0 ? pr.ciljnaKolicina.toFixed(4) : stavkaForm.kolicina_unos
        }));
    }, [stavkaForm.kolicina_unos, stavkaForm.jm_unos, stavkaForm.jm_obracun, trenutniProizvod]);

    const dodajRucnuStavku = () => {
        if (!trenutniProizvod || !stavkaForm.kolicina_obracun || parseFloat(stavkaForm.kolicina_obracun) <= 0 || parseFloat(stavkaForm.kolicina_unos) <= 0) {
            return prikaziDialog({ tip: 'upozorenje', naslov: 'Neispravna Količina', poruka: "Odaberite proizvod i unesite pozitivnu količinu veću od 0!", onCancel: zatvoriDialog });
        }

        const nova = {
            id: stavkaForm.id || Math.random().toString(),
            sifra: trenutniProizvod.sifra,
            naziv: trenutniProizvod.naziv,
            dimenzije: `${trenutniProizvod.visina}x${trenutniProizvod.sirina}x${trenutniProizvod.duzina}`,
            kolicina_unos: parseFloat(stavkaForm.kolicina_unos),
            jm_unos: stavkaForm.jm_unos,
            kolicina_obracun: parseFloat(stavkaForm.kolicina_obracun),
            jm_obracun: stavkaForm.jm_obracun
        };

        if (stavkaForm.id) {
            setStavke(stavke.map(s => s.id === stavkaForm.id ? nova : s));
        } else {
            setStavke([...stavke, nova]);
        }

        setStavkaForm({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3' });
        setTrenutniProizvod(null);
    };

    const urediStavku = (s) => {
        const kat = katalog.find(k => k.sifra === s.sifra) || null;
        setTrenutniProizvod(kat);
        setStavkaForm({
            id: s.id,
            sifra_unos: kat ? `${kat.sifra} | ${kat.naziv}` : s.naziv,
            kolicina_unos: s.kolicina_unos,
            jm_unos: s.jm_unos || 'kom',
            kolicina_obracun: s.kolicina_obracun,
            jm_obracun: s.jm_obracun || 'm3'
        });
    };

    const ukloniStavku = (id) => {
        setStavke(stavke.filter(s => s.id !== id));
        if (stavkaForm.id === id) {
            setStavkaForm({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3' });
            setTrenutniProizvod(null);
        }
    };

    // Pomoćna funkcija koja nepogrešivo izvlači paket_id iz stavke (bilo iz st.paket_id ili iz teksta "[Paket: ...]" / "[Dio paketa: ...]")
    const izvuciPaketIdIzStavke = (st) => {
        if (st.paket_id) return String(st.paket_id).trim();
        const m = String(st.naziv || '').match(/\[(?:Dio paketa|Paket):\s*([^\]]+)\]/i);
        if (m && m[1]) return m[1].trim();
        if (st.sifra && slobodniPaketi.some(sp => sp.paket_id === st.sifra)) return String(st.sifra).trim();
        return null;
    };

    // 🟢 1. SKIDANJE SA LAGERA KADA JE OTPREMNICA 'ISPORUČENO'
    const izvrsiSkidanjeSaLageraZaStavke = async (otpId, listaStavki) => {
        const azuriraneStavke = [];

        for (let st of listaStavki) {
            const pid = izvuciPaketIdIzStavke(st);

            if (!pid || st.lager_umanjen === true) {
                azuriraneStavke.push(pid ? { ...st, paket_id: pid } : st);
                continue;
            }

            const { data: redoviPaketa } = await supabase
                .from('paketi')
                .select('*')
                .eq('paket_id', pid)
                .is('otpremnica_id', null)
                .gt('kolicina_final', 0)
                .order('created_at', { ascending: true });

            if (!redoviPaketa || redoviPaketa.length === 0) {
                azuriraneStavke.push({ ...st, paket_id: pid, lager_umanjen: true });
                continue;
            }

            const ukupnoUBaziM3 = redoviPaketa.reduce((s, r) => s + parseFloat(r.kolicina_final || 0), 0);
            const uzetoM3 = parseFloat(st.kolicina_obracun || 0);

            if (st.tip_utovara === 'CIJELI' || Math.abs(uzetoM3 - ukupnoUBaziM3) < 0.0005 || uzetoM3 >= ukupnoUBaziM3) {
                await supabase.from('paketi').update({ otpremnica_id: otpId, status: 'ISPORUČENO' }).eq('paket_id', pid).is('otpremnica_id', null);
                await supabase.from('sistem_audit_log').insert([{
                    korisnik: currentUser.ime_prezime || 'Otprema',
                    akcija: 'OTPREMA_CIJELOG_PAKETA',
                    detalji: `Paket ${pid}: Cijeli paket (${ukupnoUBaziM3.toFixed(3)} m³) isporučen na otpremnici ${otpId} (${form.kupac_naziv}).`,
                    stari_podaci: { paket_id: pid, status: 'NA STANJU', kolicina_final: ukupnoUBaziM3 },
                    novi_podaci: { paket_id: pid, status: 'ISPORUČENO', otpremnica_id: otpId }
                }]);
                azuriraneStavke.push({ ...st, paket_id: pid, tip_utovara: 'CIJELI', lager_umanjen: true });
            } else {
                const prviRed = redoviPaketa[0];
                const deb = parseFloat(prviRed.debljina || st.debljina || 0);
                const sir = parseFloat(prviRed.sirina || st.sirina || 0);
                const duz = parseFloat(prviRed.duzina || st.duzina || 0);
                const vol1Kom = (deb > 0 && sir > 0 && duz > 0) ? (deb / 100) * (sir / 100) * (duz / 100) : 0;

                const noviM3 = parseFloat(Math.max(0.001, ukupnoUBaziM3 - uzetoM3).toFixed(4));
                let stariKom = parseFloat(prviRed.kolicina_ulaz ?? prviRed.komada ?? 0);
                if (stariKom <= 0 && vol1Kom > 0) stariKom = Math.round(ukupnoUBaziM3 / vol1Kom);

                let uzetoKom = parseFloat(st.kolicina_unos || 0);
                if ((st.jm_unos || 'kom').toLowerCase() !== 'kom' && vol1Kom > 0) {
                    uzetoKom = Math.round(uzetoM3 / vol1Kom);
                }
                const noviKom = Math.max(0.01, parseFloat((stariKom - uzetoKom).toFixed(2)));
                await supabase.from('paketi').update({
                    kolicina_final: noviM3,
                    kubikaza: noviM3,
                    kolicina_m3: noviM3,
                    kolicina_ulaz: noviKom,
                    komada: noviKom,
                    last_modified_by: currentUser.ime_prezime || 'Otprema',
                    last_modified_at: new Date().toISOString()
                }).eq('id', prviRed.id);

                await supabase.from('sistem_audit_log').insert([{
                    korisnik: currentUser.ime_prezime || 'Otprema',
                    akcija: 'DJELIMIČNA_OTPREMA_PAKETA',
                    detalji: `Paket ${pid}: Djelimična otprema na otpremnici ${otpId} (${form.kupac_naziv}). Isporučeno: ${uzetoKom} kom (${uzetoM3.toFixed(3)} m³). Stanje paketa umanjeno sa ${stariKom} kom (${ukupnoUBaziM3.toFixed(3)} m³) na ${noviKom} kom (${noviM3.toFixed(3)} m³).`,
                    stari_podaci: { paket_id: pid, kolicina_ulaz: stariKom, kolicina_final: ukupnoUBaziM3 },
                    novi_podaci: { paket_id: pid, kolicina_ulaz: noviKom, kolicina_final: noviM3, otpremnica_id: otpId }
                }]);

                azuriraneStavke.push({ ...st, paket_id: pid, tip_utovara: 'DJELIMICNO', lager_umanjen: true });
            }
        }

        return azuriraneStavke;
    };

    // 🟢 2. VRAĆANJE ZALIHE NA LAGER KADA SE OTPREMNICA VRATI IZ 'ISPORUČENO' U 'KREIRANA'
    const vratiSkidanjeSaLageraZaStavke = async (otpId, listaStavki, prethodniStatusOtpremnice) => {
        const azuriraneStavke = [];

        for (let st of listaStavki) {
            const pid = izvuciPaketIdIzStavke(st);
            const trebaVratiti = Boolean(pid && (st.lager_umanjen === true || prethodniStatusOtpremnice === 'ISPORUČENO'));

            if (!trebaVratiti) {
                azuriraneStavke.push({ ...st, lager_umanjen: false });
                continue;
            }

            const uzetoM3 = parseFloat(st.kolicina_obracun || 0);

            if (st.tip_utovara === 'CIJELI') {
                await supabase.from('paketi').update({ otpremnica_id: null, status: 'NA STANJU' }).eq('paket_id', pid);
                await zapisiU_Log(
                    'ALARM_POVRAT_OTPREMNICE_U_PRIPREMU',
                    `🚨 Paket ${pid}: Otpremnica ${otpId} (${form.kupac_naziv}) vraćena iz ISPORUČENO u KREIRANA! Cijeli paket (${uzetoM3.toFixed(3)} m³) vraćen na stanje lagera.`,
                    'CRVENO'
                );
            } else {
                const { data: redoviPaketa } = await supabase.from('paketi').select('*').eq('paket_id', pid).order('created_at', { ascending: true });
                if (redoviPaketa && redoviPaketa.length > 0) {
                    const prviRed = redoviPaketa[0];
                    const deb = parseFloat(prviRed.debljina || st.debljina || 0);
                    const sir = parseFloat(prviRed.sirina || st.sirina || 0);
                    const duz = parseFloat(prviRed.duzina || st.duzina || 0);
                    const vol1Kom = (deb > 0 && sir > 0 && duz > 0) ? (deb / 100) * (sir / 100) * (duz / 100) : 0;

                    const trenutniM3 = parseFloat(prviRed.kolicina_final || 0);
                    const vraceniM3 = parseFloat((trenutniM3 + uzetoM3).toFixed(4));

                    let trenutniKom = parseFloat(prviRed.kolicina_ulaz ?? prviRed.komada ?? 0);
                    if (trenutniKom <= 0 && vol1Kom > 0) trenutniKom = Math.round(trenutniM3 / vol1Kom);

                    let uzetoKom = parseFloat(st.kolicina_unos || 0);
                    if ((st.jm_unos || 'kom').toLowerCase() !== 'kom' && vol1Kom > 0) {
                        uzetoKom = Math.round(uzetoM3 / vol1Kom);
                    }
                    const vraceniKom = parseFloat((trenutniKom + uzetoKom).toFixed(2));
                    await supabase.from('paketi').update({
                        otpremnica_id: null,
                        status: 'NA STANJU',
                        kolicina_final: vraceniM3,
                        kubikaza: vraceniM3,
                        kolicina_m3: vraceniM3,
                        kolicina_ulaz: vraceniKom,
                        komada: vraceniKom,
                        last_modified_by: currentUser.ime_prezime || 'Otprema',
                        last_modified_at: new Date().toISOString()
                    }).eq('id', prviRed.id);

                    await zapisiU_Log(
                        'ALARM_POVRAT_DJELIMIČNE_OTPREME',
                        `🚨 Paket ${pid}: Otpremnica ${otpId} (${form.kupac_naziv}) vraćena iz ISPORUČENO u KREIRANA! Vraćeno ${uzetoKom} kom (${uzetoM3.toFixed(3)} m³) na lager -> Novo stanje paketa: ${vraceniKom} kom (${vraceniM3.toFixed(3)} m³).`,
                        'CRVENO'
                    );
                }
            }

            azuriraneStavke.push({ ...st, paket_id: pid, lager_umanjen: false });
        }

        return azuriraneStavke;
    };

    const snimiOtpremnicu = async () => {
        if (!form.kupac_naziv) return prikaziDialog({ tip: 'upozorenje', naslov: 'Kupac Obavezan', poruka: "Morate odabrati kupca!", onCancel: zatvoriDialog });
        if (stavke.length === 0) return prikaziDialog({ tip: 'upozorenje', naslov: 'Nema Stavki', poruka: "Otpremnica mora imati stavke!", onCancel: zatvoriDialog });

        const otpId = form.id.toUpperCase().trim();
        let konacneStavke = [...stavke];

        // Provjeri prethodni status ove otpremnice u bazi (ako se uređuje postojeća)
        let prethodniStatus = null;
        if (isEditingOtpremnica) {
            const postojeca = otpremnice.find(o => o.id === otpId);
            prethodniStatus = postojeca?.status || null;
        }

        if (form.status === 'ISPORUČENO') {
            konacneStavke = await izvrsiSkidanjeSaLageraZaStavke(otpId, konacneStavke);
        } else if (form.status === 'KREIRANA') {
            if (prethodniStatus === 'ISPORUČENO' || konacneStavke.some(s => s.lager_umanjen)) {
                konacneStavke = await vratiSkidanjeSaLageraZaStavke(otpId, konacneStavke, prethodniStatus);
            }
        }

        const payload = {
            id: otpId,
            broj_veze: form.broj_veze || null,
            kupac_naziv: form.kupac_naziv,
            datum: form.datum || new Date().toISOString().split('T')[0],
            vozac: form.vozac || '',
            registracija: form.registracija || '',
            napomena: form.napomena || '',
            stavke_jsonb: konacneStavke,
            status: form.status,
            snimio_korisnik: currentUser.ime_prezime || 'Sistem'
        };

        let res;
        if (isEditingOtpremnica) {
            res = await supabase.from('otpremnice').update(payload).eq('id', otpId);
        } else {
            res = await supabase.from('otpremnice').insert([payload]);
        }

        if (res.error) {
            return prikaziDialog({ tip: 'greska', naslov: 'Greška pri snimanju', poruka: res.error.message, onCancel: zatvoriDialog });
        }

        await zapisiU_Log(isEditingOtpremnica ? 'IZMJENA_OTPREMNICE' : 'KREIRANA_OTPREMNICA', `Otpremnica ${otpId} (${form.kupac_naziv}) - Status: ${form.status}`);

        await load();
        resetFormu();
        setTab('lista');

        prikaziDialog({
            tip: 'uspjeh',
            naslov: isEditingOtpremnica ? 'Otpremnica Ažurirana!' : 'Otpremnica Kreirana!',
            poruka: `Otpremnica ${otpId} je uspješno sačuvana${form.status === 'ISPORUČENO' ? ' i stanje lagera je ažurirano' : ''}. Želite li isprintati otpremnicu?`,
            confirmText: '🖨️ DA, ŠTAMPAJ',
            cancelText: '✕ ZATVORI',
            onConfirm: () => { kreirajPDFPrivremeni(payload); zatvoriDialog(); },
            onCancel: zatvoriDialog
        });
    };

    const pokreniIzmjenuOtpremnice = (o) => {
        setForm({
            id: o.id,
            broj_veze: o.broj_veze || '',
            kupac_naziv: o.kupac_naziv || '',
            datum: o.datum || new Date().toISOString().split('T')[0],
            vozac: o.vozac || '',
            registracija: o.registracija || '',
            napomena: o.napomena || '',
            status: o.status || 'ISPORUČENO'
        });
        setStavke(o.stavke_jsonb || []);
        setIsEditingOtpremnica(true);
        setTab('nova');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetFormu = () => {
        setForm({
            id: generisiID(),
            broj_veze: '',
            kupac_naziv: '',
            datum: new Date().toISOString().split('T')[0],
            vozac: '',
            registracija: '',
            napomena: '',
            status: 'ISPORUČENO'
        });
        setStavke([]);
        setIsEditingOtpremnica(false);
        setSkenerInput('');
    };

    const formatirajDatum = (isoString) => {
        if (!isoString) return '';
        const [y, m, d] = isoString.split('T')[0].split('-');
        return `${d}.${m}.${y}.`;
    };

    const kreirajPDF = () => kreirajPDFPrivremeni({ ...form, stavke_jsonb: stavke });

    const kreirajPDFPrivremeni = (podaci) => {
        const stariNaslov = document.title;
        document.title = `otpremnica_${podaci.id}_${(podaci.kupac_naziv || 'Kupac').replace(/\s+/g, '_')}`;
        const listaStavki = podaci.stavke_jsonb || [];
        const ukupnoM3 = listaStavki.reduce((s, x) => s + parseFloat(x.kolicina_obracun || 0), 0);

        const redovi = listaStavki.map((s, i) => {
            const kolUnosPrikaz = s.kolicina_unos ?? s.kolicina_obracun ?? s.kolicina ?? 0;
            const jmUnosPrikaz = s.jm_unos || s.jm_obracun || s.jm || 'm3';
            return `
            <tr>
                <td style="text-align:center; font-weight:bold;">${i + 1}.</td>
                <td><b>${s.sifra || '-'}</b> - ${s.naziv} ${s.dimenzije ? `<br/><span style="font-size:10px; color:#64748b;">Dimenzije: ${s.dimenzije} cm</span>` : ''}</td>
                <td style="text-align:center;">${kolUnosPrikaz} ${jmUnosPrikaz}</td>
                <td class="num" style="font-weight:900;">${parseFloat(s.kolicina_obracun || s.kolicina || 0).toFixed(3)} ${s.jm_obracun || 'm3'}</td>
            </tr>
            `;
        }).join('');

        const html = `
            <div class="info-grid">
                <div class="info-col-left">
                    <h4>Kupac / Primalac</h4>
                    <h2>${podaci.kupac_naziv}</h2>
                    <p>Vezni dokument: <b>${podaci.broj_veze || 'N/A'}</b></p>
                </div>
                <div class="info-col-right">
                    <p>Vozač / Prevoznik: <b>${podaci.vozac || '-'}</b></p>
                    <p>Registracija: <b>${podaci.registracija || '-'}</b></p>
                    <p>Status: <b>${podaci.status || 'ISPORUČENO'}</b></p>
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="width:6%; text-align:center;">R.B.</th>
                        <th>Proizvod / Paket (Dimenzije u cm)</th>
                        <th style="text-align:center;">Količina (Unos)</th>
                        <th class="num">Obračun (m³)</th>
                    </tr>
                </thead>
                <tbody>${redovi}</tbody>
            </table>
            <div style="margin-top:15px; text-align:right; font-size:14px; font-weight:900;">
                UKUPNO OTPREMLJENO: ${ukupnoM3.toFixed(3)} m³
            </div>
            <div class="footer" style="margin-top:30px; display:flex; justify-content:space-between;">
                <div style="width:45%;"><b>Napomena:</b><br/>${podaci.napomena || 'Nema napomene.'}</div>
                <div style="width:25%; text-align:center;"><div style="border-bottom:1px solid #94a3b8; height:35px; margin-bottom:5px;"></div>Robu izdao</div>
                <div style="width:25%; text-align:center;"><div style="border-bottom:1px solid #94a3b8; height:35px; margin-bottom:5px;"></div>Robu preuzeo (Vozač)</div>
            </div>
        `;
        printDokument('OTPREMNICA', podaci.id, formatirajDatum(podaci.datum), html, '#f97316');
        setTimeout(() => { document.title = stariNaslov; }, 2000);
    };

    const renderPoljeZaglavlja = (polje) => {
        if (polje.id === 'kupac') return (
            <div className="flex gap-2 items-center w-full min-w-0 h-full">
                <div className="flex-1 min-w-0 h-full">
                    <MasterSearch data={kupci} poljaZaPretragu={['naziv']} value={form.kupac_naziv} onSelect={k => setForm({ ...form, kupac_naziv: k.naziv })} placeholder="Odaberi kupca..." />
                </div>
                {hasKupacEdit && <button onClick={() => setShowBrziKupac(true)} className="bg-orange-600 hover:bg-orange-500 text-white px-3 h-full min-h-[45px] rounded-xl shadow-lg shrink-0 text-[10px] font-black">➕ NOVI</button>}
            </div>
        );
        if (polje.id === 'broj') return <input value={form.id} disabled={isEditingOtpremnica} onChange={e => setForm({ ...form, id: e.target.value.toUpperCase() })} className="w-full min-w-0 h-full min-h-[45px] p-3 bg-theme-card rounded-xl text-xs text-theme-text outline-none border border-theme-border font-black uppercase disabled:opacity-50" />;
        if (polje.id === 'veza') return <input value={form.broj_veze} onChange={e => setForm({ ...form, broj_veze: e.target.value.toUpperCase() })} placeholder="RN-... ili PON-..." className="w-full min-w-0 h-full min-h-[45px] p-3 bg-theme-card rounded-xl text-xs text-orange-400 outline-none border border-orange-500/30 font-black uppercase" />;
        if (polje.id === 'datum') return <input type="date" value={form.datum} onChange={e => setForm({ ...form, datum: e.target.value })} className="w-full min-w-0 h-full min-h-[45px] p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border" />;
        if (polje.id === 'vozac') return <input value={form.vozac} onChange={e => setForm({ ...form, vozac: e.target.value })} placeholder="Ime vozača / Firma" className="w-full min-w-0 h-full min-h-[45px] p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border" />;
        if (polje.id === 'registracija') return <input value={form.registracija} onChange={e => setForm({ ...form, registracija: e.target.value.toUpperCase() })} placeholder="npr. A12-K-345" className="w-full min-w-0 h-full min-h-[45px] p-3 bg-theme-panel rounded-xl text-xs text-theme-text outline-none border border-theme-border uppercase" />;
        if (polje.id === 'status') return (
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full min-w-0 h-full min-h-[45px] p-3 bg-orange-900/20 rounded-xl text-xs text-orange-400 font-black outline-none border border-orange-500/50 cursor-pointer">
                <option value="KREIRANA">⏳ KREIRANA (U pripremi)</option>
                <option value="ISPORUČENO">✅ ISPORUČENO (Razduži lager)</option>
            </select>
        );
        return null;
    };

    const filtriraniSlobodniPaketi = useMemo(() => {
        if (!pretragaLagera.trim()) return slobodniPaketi;
        const q = pretragaLagera.toUpperCase().trim();
        return slobodniPaketi.filter(p =>
            (p.paket_id || '').toUpperCase().includes(q) ||
            (p.naziv_proizvoda || '').toUpperCase().includes(q) ||
            `${p.debljina}X${p.sirina}X${p.duzina}`.includes(q)
        );
    }, [slobodniPaketi, pretragaLagera]);

    const ukupnoOtpremnicaM3 = useMemo(() => stavke.reduce((s, x) => s + parseFloat(x.kolicina_obracun || 0), 0), [stavke]);

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 font-bold animate-in fade-in pb-24" style={{ color: saas.ui.boja_slova }}>
            {showBrziKupac && <div className="fixed inset-0 z-[200] bg-[#090e17]/95 flex flex-col p-4 overflow-y-auto backdrop-blur-md"><SettingsModule onExit={() => { setShowBrziKupac(false); load(); }} lockedTab="kupci" /></div>}
            {showBrziKatalog && <div className="fixed inset-0 z-[200] bg-[#090e17]/95 flex flex-col p-4 overflow-y-auto backdrop-blur-md"><SettingsModule onExit={() => { setShowBrziKatalog(false); load(); }} lockedTab="katalog" /></div>}
            <PametniDialog {...dialog} />
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-orange-500" user={user} modulIme="otpremnice" saas={saas} hideMasina={true} />

            {/* MODAL ZA ODABIR PAKETA SA LAGERA I DJELIMIČNO RASTURANJE */}
            {showLagerModal && (
                <div className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-theme-card border-2 border-orange-500/50 rounded-[2rem] max-w-3xl w-full p-6 shadow-2xl max-h-[90vh] flex flex-col relative">
                        <button onClick={() => { setShowLagerModal(false); setOdabraniPaketZaUtovar(null); }} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-theme-panel border border-theme-border text-slate-400 hover:text-white flex items-center justify-center font-black">✕</button>
                        <h3 className="text-orange-400 font-black uppercase text-sm mb-4">📦 Odaberi paket sa lagera za utovar (Dimenzije u cm)</h3>

                        {!odabraniPaketZaUtovar ? (
                            <>
                                <input
                                    type="text"
                                    value={pretragaLagera}
                                    onChange={e => setPretragaLagera(e.target.value)}
                                    placeholder="🔍 Pretraži pakete po ID-u, nazivu ili dimenziji (npr. 2.4x10x400)..."
                                    className="w-full p-3.5 bg-theme-panel border border-theme-border rounded-xl text-xs text-theme-text font-black uppercase outline-none focus:border-orange-500 mb-4"
                                />
                                <div className="flex-1 overflow-y-auto space-y-2.5 pr-2 custom-scrollbar">
                                    {filtriraniSlobodniPaketi.length === 0 && <p className="text-center text-slate-500 text-xs py-10">Nema slobodnih paketa na lageru za ovaj upit.</p>}
                                    {filtriraniSlobodniPaketi.map(p => (
                                        <div key={p.paket_id} onClick={() => klikniNaPaketSaLagera(p)} className="p-4 bg-theme-panel border border-theme-border hover:border-orange-500 rounded-2xl cursor-pointer flex justify-between items-center transition-all shadow-md">
                                            <div>
                                                <span className="text-orange-400 font-black text-sm">{p.paket_id}</span>
                                                <span className="text-theme-text font-bold text-xs ml-2">{p.naziv_proizvoda}</span>
                                                <p className="text-[10px] text-amber-400 font-mono mt-1">Dimenzije: {p.debljina}x{p.sirina}x{p.duzina} cm | Na stanju: <b>{p.ukupno_kom} kom</b></p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-emerald-400 font-black text-lg">{p.ukupno_m3.toFixed(3)} m³</p>
                                                <span className="text-[9px] text-slate-400 uppercase font-black">Klikni za odabir →</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="space-y-5 animate-in zoom-in-95">
                                <div className="p-4 bg-theme-panel rounded-2xl border border-orange-500/30 flex justify-between items-center">
                                    <div>
                                        <p className="text-orange-400 font-black text-base">{odabraniPaketZaUtovar.paket_id}</p>
                                        <p className="text-xs text-theme-text font-bold">{odabraniPaketZaUtovar.naziv_proizvoda} ({odabraniPaketZaUtovar.debljina}x{odabraniPaketZaUtovar.sirina}x{odabraniPaketZaUtovar.duzina} cm)</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-emerald-400 font-black text-xl">{odabraniPaketZaUtovar.ukupno_m3.toFixed(3)} m³</p>
                                        <p className="text-[10px] text-slate-400 font-bold">Na stanju: {odabraniPaketZaUtovar.ukupno_kom} kom</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setModUtovaraPaketa('CIJELI')}
                                        className={`py-4 rounded-xl font-black text-xs uppercase border transition-all ${modUtovaraPaketa === 'CIJELI' ? 'bg-orange-600 text-white border-orange-400 shadow-lg' : 'bg-theme-panel text-slate-400 border-theme-border'}`}
                                    >
                                        📦 Uzimam cijeli paket ({odabraniPaketZaUtovar.ukupno_m3.toFixed(3)} m³)
                                    </button>
                                    <button
                                        onClick={() => setModUtovaraPaketa('DJELIMICNO')}
                                        className={`py-4 rounded-xl font-black text-xs uppercase border transition-all ${modUtovaraPaketa === 'DJELIMICNO' ? 'bg-amber-600 text-white border-amber-400 shadow-lg' : 'bg-theme-panel text-slate-400 border-theme-border'}`}
                                    >
                                        ✂️ Rasturam (Djelimično)
                                    </button>
                                </div>

                                {modUtovaraPaketa === 'DJELIMICNO' && (
                                    <div className="p-4 bg-amber-950/20 border border-amber-500/40 rounded-2xl space-y-3">
                                        <label className="text-[10px] text-amber-400 uppercase font-black block">Koliko skidate sa ovog paketa?</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                value={djelimicnaKolicina}
                                                onChange={e => setDjelimicnaKolicina(e.target.value)}
                                                placeholder="Unesi količinu (npr. 5)..."
                                                className="flex-1 min-w-0 p-3.5 bg-theme-panel border border-amber-500/50 rounded-xl text-sm text-theme-text font-black text-center outline-none"
                                            />
                                            <select
                                                value={djelimicnaJm}
                                                onChange={e => setDjelimicnaJm(e.target.value)}
                                                className="w-28 shrink-0 p-3.5 bg-theme-panel border border-amber-500/50 rounded-xl text-xs text-amber-400 font-black uppercase outline-none"
                                            >
                                                <option value="kom">kom</option>
                                                <option value="m3">m³</option>
                                                <option value="m2">m²</option>
                                                <option value="m1">m1</option>
                                            </select>
                                        </div>
                                        <div className="flex justify-between text-xs pt-2 border-t border-amber-500/20">
                                            <span className="text-slate-400">Obračun za otpremu: <b className="text-emerald-400">{izracunajDjelimicniM3.toFixed(3)} m³</b></span>
                                            <span className="text-slate-400">Ostaje na lageru: <b className="text-amber-400">{Math.max(0, odabraniPaketZaUtovar.ukupno_m3 - izracunajDjelimicniM3).toFixed(3)} m³</b></span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setOdabraniPaketZaUtovar(null)} className="flex-1 py-3.5 bg-theme-panel text-slate-400 rounded-xl font-black text-xs uppercase border border-theme-border">← Nazad na listu</button>
                                    <button onClick={potvrdiUtovarPaketa} className="flex-[2] py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase shadow-lg">✅ Dodaj na Otpremnicu</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="flex bg-theme-panel p-1.5 rounded-2xl border border-theme-border shadow-inner">
                <button onClick={() => { setTab('nova'); if (!isEditingOtpremnica) resetFormu(); }} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all font-black ${tab === 'nova' ? 'bg-orange-600 text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-theme-text'}`}>{isEditingOtpremnica ? '✏️ Ažuriranje Otpremnice' : '➕ Nova Otpremnica'}</button>
                <button onClick={() => { setTab('lista'); load(); }} className={`flex-1 py-3 rounded-xl text-[10px] uppercase transition-all font-black ${tab === 'lista' ? 'bg-orange-600 text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-theme-text'}`}>📋 Arhiva Otpremnica ({otpremnice.length})</button>
            </div>

            {tab === 'nova' ? (
                <div className="space-y-4 animate-in slide-in-from-left max-w-4xl mx-auto">
                    {!isEditingOtpremnica && (
                        <div className="bg-theme-card border border-orange-500/40 p-6 rounded-box shadow-xl relative z-[60]" style={{ backgroundColor: saas.ui.boja_kartice }}>
                            <label className="text-[10px] text-orange-400 uppercase font-black mb-2 block ml-2">⚡ Povuci podatke iz Radnog Naloga ili Ponude</label>
                            <OTP_SearchableNalog nalozi={nalozi} ponude={ponude} value={skenerInput} onChange={handleVezaInput} onScanClick={() => { setScanTarget('nalog'); setIsScanning(true); }} />
                        </div>
                    )}

                    <div className={`p-6 rounded-box border-2 shadow-2xl space-y-4 transition-all relative z-[40] ${saas.isEditMode ? 'border-dashed border-amber-500 bg-black/20' : 'border-orange-500/30 bg-theme-card'}`} style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <div className="flex justify-between items-center mb-2 border-b border-theme-border/50 pb-2">
                            <h3 className="text-orange-500 font-black uppercase text-xs">1. Zaglavlje Otpremnice i Prevoz</h3>
                            <div className="flex gap-2">
                                {isEditingOtpremnica && <button onClick={kreirajPDF} className="text-[10px] bg-theme-panel text-theme-text border border-slate-600 px-4 py-1.5 rounded-xl uppercase hover:bg-white hover:text-black transition-all font-black">🖨️ Isprintaj PDF</button>}
                                {isEditingOtpremnica && <button onClick={resetFormu} className="text-[10px] bg-red-900/30 text-red-400 px-3 py-1.5 rounded-xl uppercase">Odustani ✕</button>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
                            {aktivnaPolja.map((polje, index) => {
                                const responsiveSpan = polje.span === 'col-span-4' ? 'col-span-1 md:col-span-4' : (polje.span === 'col-span-2' ? 'col-span-1 md:col-span-2' : 'col-span-1');
                                return (
                                    <div
                                        key={polje.id}
                                        className={`relative flex flex-col ${responsiveSpan} min-w-0 transition-all ${saas.isEditMode ? 'border-2 border-dashed border-amber-500 p-2 rounded-xl bg-black/20' : ''}`}
                                        style={{ zIndex: 50 - index }}
                                        draggable={saas.isEditMode}
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragEnter={(e) => handleDragEnter(e, index)}
                                        onDragEnd={handleDrop}
                                        onDragOver={(e) => e.preventDefault()}
                                        onMouseUp={(e) => spremiDimenzije(e, index)}
                                    >
                                        {polje.label && <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">{polje.label}</label>}
                                        <div className="w-full min-w-0 flex-1">{renderPoljeZaglavlja(polje)}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* DODAVANJE SA LAGERA ILI RUČNO */}
                    <div className="bg-theme-card p-6 rounded-box border border-theme-border shadow-2xl space-y-4 relative z-[30]" style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-theme-border pb-4">
                            <h3 className="text-orange-400 font-black uppercase text-xs">2. Utovar Paketa sa Lagera ili Ručni Unos (cm)</h3>
                            <button onClick={() => setShowLagerModal(true)} className="px-5 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-black text-xs uppercase shadow-lg transition-all">
                                📦 + Dodaj sa lagera ({slobodniPaketi.length} slobodnih)
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <input
                                value={paketScanInput}
                                onChange={e => setPaketScanInput(e.target.value.toUpperCase())}
                                onKeyDown={e => { if (e.key === 'Enter') skenirajPaketDirektno(paketScanInput); }}
                                placeholder="Ili direktno skeniraj / upiši ID paketa sa lagera (npr. RUČNO-2026-...) i pritisni Enter"
                                className="flex-1 min-w-0 p-3.5 bg-theme-panel border border-theme-border rounded-xl text-xs text-theme-text font-black uppercase outline-none focus:border-orange-500"
                            />
                            <button onClick={() => skenirajPaketDirektno(paketScanInput)} className="px-5 bg-theme-panel border border-orange-500/40 text-orange-400 hover:bg-orange-600 hover:text-white rounded-xl text-xs font-black uppercase">Pronađi</button>
                            <button onClick={() => { setScanTarget('paket'); setIsScanning(true); }} className="px-4 bg-orange-600/20 text-orange-400 rounded-xl text-lg">📷</button>
                        </div>

                        <div className="pt-2 border-t border-theme-border/50">
                            <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Ručni odabir artikla iz kataloga (Dimenzije u cm)</label>
                            <div className="flex gap-2 items-center w-full min-w-0">
                                <div className="flex-1 min-w-0">
                                    <MasterSearch
                                        data={katalog}
                                        poljaZaPretragu={['sifra', 'naziv']}
                                        value={stavkaForm.sifra_unos}
                                        onSelect={handleProizvodSelect}
                                        placeholder="Pronađi šifru ili naziv..."
                                    />
                                </div>
                                {hasKatalogEdit && <button onClick={() => setShowBrziKatalog(true)} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-3 rounded-xl text-[10px] font-black shrink-0">➕ NOVI</button>}
                            </div>

                            {trenutniProizvod && (
                                <div className="mt-3 p-4 bg-orange-950/10 border border-orange-500/30 rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                    <div className="md:col-span-5 min-w-0">
                                        <label className="text-[8px] text-slate-400 uppercase block mb-1">Unos: Količina i Jedinica</label>
                                        <div className="flex gap-1.5">
                                            <input type="number" value={stavkaForm.kolicina_unos} onChange={e => setStavkaForm({ ...stavkaForm, kolicina_unos: e.target.value })} placeholder="Količina" className="flex-1 min-w-0 p-3 bg-theme-panel rounded-xl text-sm text-theme-text font-black text-center border border-theme-border outline-none" />
                                            <select value={stavkaForm.jm_unos} onChange={e => setStavkaForm({ ...stavkaForm, jm_unos: e.target.value })} className="w-24 shrink-0 p-3 bg-theme-panel rounded-xl text-xs text-theme-text font-black border border-theme-border uppercase">
                                                <option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="md:col-span-5 min-w-0">
                                        <label className="text-[8px] text-slate-400 uppercase block mb-1">Obračun (m³)</label>
                                        <div className="flex gap-1.5">
                                            <input type="number" value={stavkaForm.kolicina_obracun} onChange={e => setStavkaForm({ ...stavkaForm, kolicina_obracun: e.target.value })} className="flex-1 min-w-0 p-3 bg-theme-panel rounded-xl text-sm text-emerald-400 font-black text-center border border-theme-border outline-none" />
                                            <select value={stavkaForm.jm_obracun} onChange={e => setStavkaForm({ ...stavkaForm, jm_obracun: e.target.value })} className="w-24 shrink-0 p-3 bg-theme-panel rounded-xl text-xs text-theme-text font-black border border-theme-border uppercase">
                                                <option value="m3">m³</option><option value="kom">kom</option><option value="m2">m²</option><option value="m1">m1</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <button onClick={dodajRucnuStavku} className="w-full py-3.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-black text-xs uppercase shadow-lg">Dodaj +</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {stavke.length > 0 && (
                        <div className="bg-theme-card p-6 rounded-box border border-orange-500/30 shadow-2xl space-y-4" style={{ backgroundColor: saas.ui.boja_kartice }}>
                            <div className="flex justify-between items-center">
                                <h3 className="text-orange-400 font-black uppercase text-xs">3. Stavke na Otpremnici ({stavke.length})</h3>
                                <span className="text-emerald-400 font-black text-base">Ukupno: {ukupnoOtpremnicaM3.toFixed(3)} m³</span>
                            </div>

                            <div className="space-y-2">
                                {stavke.map((s, idx) => (
                                    <div key={s.id || idx} onClick={() => urediStavku(s)} className="p-3.5 bg-theme-panel border border-theme-border rounded-xl flex justify-between items-center cursor-pointer hover:border-orange-500 transition-all group">
                                        <div>
                                            <p className="text-theme-text text-xs font-black">{s.naziv}</p>
                                            <p className="text-[10px] text-slate-400 uppercase mt-0.5">
                                                Šifra/Paket: <b>{s.paket_id || s.sifra}</b> {s.dimenzije ? `| Dimenzije: ${s.dimenzije} cm` : ''} | Unos: {s.kolicina_unos} {s.jm_unos}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-emerald-400 font-black text-sm">{parseFloat(s.kolicina_obracun || 0).toFixed(3)} {s.jm_obracun || 'm3'}</span>
                                            <button onClick={(e) => { e.stopPropagation(); ukloniStavku(s.id); }} className="text-red-500 hover:bg-red-500/20 px-2.5 py-1 rounded-lg font-black">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <textarea value={form.napomena} onChange={e => setForm({ ...form, napomena: e.target.value })} placeholder="Napomena uz otpremnicu..." className="w-full p-4 bg-theme-panel border border-theme-border rounded-xl text-xs text-theme-text outline-none" rows="2"></textarea>
                            <button onClick={snimiOtpremnicu} className="w-full py-5 bg-orange-600 hover:bg-orange-500 text-white font-black rounded-2xl uppercase text-sm shadow-xl tracking-widest transition-all">
                                {isEditingOtpremnica ? '✅ Snimi Izmjene Otpremnice' : '🚛 Snimi i Zaključi Otpremnicu'}
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-theme-card p-6 rounded-box border border-theme-border shadow-2xl space-y-4 animate-in slide-in-from-right">
                    <h3 className="text-orange-400 font-black uppercase text-xs mb-4">📋 Arhiva Otpremnica ({otpremnice.length})</h3>
                    {loadingData && <p className="text-center text-orange-400 text-xs py-6 animate-pulse">Učitavam otpremnice...</p>}
                    {!loadingData && otpremnice.length === 0 && <p className="text-center text-slate-500 text-xs py-10 border-2 border-dashed border-theme-border rounded-xl">Nema evidentiranih otpremnica.</p>}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {otpremnice.map(o => {
                            const ukM3 = (o.stavke_jsonb || []).reduce((s, x) => s + parseFloat(x.kolicina_obracun || 0), 0);
                            return (
                                <div key={o.id} onClick={() => pokreniIzmjenuOtpremnice(o)} className="p-4 bg-theme-panel border border-theme-border hover:border-orange-500 rounded-2xl cursor-pointer transition-all shadow-md flex flex-col justify-between">
                                    <div className="flex justify-between items-start border-b border-theme-border pb-2 mb-2">
                                        <div>
                                            <p className="text-orange-400 font-black text-sm">{o.id}</p>
                                            <p className="text-theme-text font-bold text-xs mt-1">{o.kupac_naziv}</p>
                                            {o.vozac && <p className="text-[10px] text-slate-400 mt-0.5">🚛 Vozač: {o.vozac} {o.registracija ? `(${o.registracija})` : ''}</p>}
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase ${o.status === 'ISPORUČENO' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' : 'bg-amber-900/30 text-amber-400 border border-amber-500/30'}`}>{o.status || 'ISPORUČENO'}</span>
                                            <p className="text-emerald-400 font-black text-base mt-1">{ukM3.toFixed(3)} m³</p>
                                            <p className="text-[9px] text-slate-500">{formatirajDatum(o.datum)}</p>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2 mt-2">
                                        <button onClick={(e) => { e.stopPropagation(); kreirajPDFPrivremeni(o); }} className="px-3 py-1.5 bg-theme-card border border-theme-border text-theme-text hover:bg-white hover:text-black rounded-lg text-[9px] font-black uppercase">🖨️ PDF</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {isScanning && <ScannerOverlay onScan={(text) => {
                if (scanTarget === 'paket') skenirajPaketDirektno(text);
                else ucitajVezniDokument(text);
                setIsScanning(false);
            }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}