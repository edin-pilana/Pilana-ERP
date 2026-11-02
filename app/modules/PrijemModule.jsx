"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import MasterHeader from '../components/MasterHeader';
import PametniDialog from '../components/PametniDialog';
import ScannerOverlay from '../components/ScannerOverlay';
import { useSaaS } from '../utils/useSaaS';
import { toast } from 'sonner';

const shiftDateString = (isoStr, days) => {
    if(!isoStr) return new Date().toISOString().split('T')[0];
    const d = new Date(isoStr); d.setDate(d.getDate() + days); return d.toISOString().split('T')[0];
};

// Pomoćna funkcija koja pretvara stare span vrijednosti (col-span-1, col-span-2) u 12-kolonski sistem (1/4, 1/3, 1/2, FULL)
const normalizujSpan12 = (span) => {
    if (!span) return 'col-span-6';
    if (span === 'col-span-12' || span === 'col-span-4' && false) return 'col-span-12';
    if (span === 'col-span-12') return 'col-span-12'; // 100% (FULL)
    if (span === 'col-span-6') return 'col-span-6';   // 50% (1/2)
    if (span === 'col-span-4') return 'col-span-4';   // 33.3% (1/3)
    if (span === 'col-span-3') return 'col-span-3';   // 25% (1/4)
    // Mapiranje starih vrijednosti iz baze ako su ostale iz 2-kolonskog ili 4-kolonskog grida:
    if (span === 'col-span-1') return 'col-span-6';
    if (span === 'col-span-2') return 'col-span-6';
    return 'col-span-6';
};

export default function PrijemModule({ user, header, setHeader, onExit }) {
    
    // 🟢 SUPER GOD MODE - DEFAULTS (12-kolonski sistem: 12 = FULL, 6 = 1/2, 4 = 1/3, 3 = 1/4)
    const saas = useSaaS('prijem_trupaca', {
        boja_kartice: '', 
        boja_slova: '', 
        velicina_naslova: '16',
        naslov_zaglavlja: 'ZAGLAVLJE OTPREMNICE', 
        naslov_skenera: 'SKENIRAJ QR KOD TRUPCA', 
        
        font_family: 'Inter, sans-serif',
        label_color: '', 
        label_size: '9',
        label_weight: '900',
        input_color: '',
        input_bg: '',
        input_size: '12',
        input_weight: '900',
        input_border_color: '',
        input_radius: '12',

        polja_zaglavlje: [
            { id: 'sumarija', label: 'ŠUMARIJA', span: 'col-span-6' }, 
            { id: 'podruznica', label: 'PODRUŽNICA', span: 'col-span-6' },
            { id: 'prevoznik', label: 'PREVOZNIK', span: 'col-span-6' }, 
            { id: 'odjel', label: 'ODJEL', span: 'col-span-6' },
            { id: 'otpremnica_datum', label: 'DATUM OTPR.', span: 'col-span-6' }, 
            { id: 'otpremnica_broj', label: 'BROJ OTPREMNICE', span: 'col-span-6' }
        ],
        polja_unos: [
            { id: 'plocica', label: 'BROJ PLOČICE', span: 'col-span-6' }, 
            { id: 'redni', label: 'REDNI BROJ (OPCIONO)', span: 'col-span-6' },
            { id: 'vrsta', label: 'VRSTA DRVETA', span: 'col-span-6' }, 
            { id: 'klasa', label: 'KLASA', span: 'col-span-6' },
            { id: 'duzina', label: 'DUŽINA (M)', span: 'col-span-6' }, 
            { id: 'promjer', label: 'PREČNIK (CM)', span: 'col-span-6' }
        ]
    });

    // Stilovi za naprednu tipografiju
    const labelStyle = {
        color: saas.ui.label_color || 'var(--text-muted)',
        fontSize: saas.ui.label_size ? `${saas.ui.label_size}px` : '9px',
        fontWeight: saas.ui.label_weight || '900',
        fontFamily: saas.ui.font_family || 'inherit',
    };

    const inputStyle = {
        color: saas.ui.input_color || 'var(--text-primary)',
        backgroundColor: saas.ui.input_bg || 'var(--bg-panel)',
        borderColor: saas.ui.input_border_color || 'var(--border-color)',
        fontSize: saas.ui.input_size ? `${saas.ui.input_size}px` : '12px',
        fontWeight: saas.ui.input_weight || '900',
        fontFamily: saas.ui.font_family || 'inherit',
        borderRadius: saas.ui.input_radius ? `${saas.ui.input_radius}px` : '12px',
    };
    
    const scannerStyle = {
        color: saas.ui.input_color || 'var(--text-primary)',
        fontFamily: saas.ui.font_family || 'inherit',
    };

    const resetToThemeDefaults = () => {
        saas.setUi({
            ...saas.ui,
            boja_kartice: '', boja_slova: '', label_color: '', input_color: '', input_bg: '', input_border_color: ''
        });
    };

    const aktivnaPoljaZaglavlja = saas.ui.polja_zaglavlje?.length > 0 ? saas.ui.polja_zaglavlje : saas.defaultConfig.polja_zaglavlje;
    const aktivnaPoljaUnosa = saas.ui.polja_unos?.length > 0 ? saas.ui.polja_unos : saas.defaultConfig.polja_unos;

    // 🟢 DRAG & DROP I PROMJENA VELIČINE POLJA (1/4, 1/3, 1/2, FULL) ZA SVE SEKCIJE
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    const handleDragStart = (e, index, listaIme) => {
        dragItem.current = { index, listaIme };
    };
    const handleDragEnter = (e, index) => {
        dragOverItem.current = index;
    };
    const handleDrop = (listaIme) => {
        if (!dragItem.current || dragOverItem.current === null || dragItem.current.listaIme !== listaIme) return;
        const izvornaLista = listaIme === 'polja_zaglavlje' ? aktivnaPoljaZaglavlja : aktivnaPoljaUnosa;
        const novaLista = [...izvornaLista];
        const premjesteni = novaLista[dragItem.current.index];
        novaLista.splice(dragItem.current.index, 1);
        novaLista.splice(dragOverItem.current, 0, premjesteni);
        dragItem.current = null;
        dragOverItem.current = null;
        saas.setUi({ ...saas.ui, [listaIme]: novaLista });
    };

    const promijeniSirinuPolja = (listaIme, index, noviSpan) => {
        const izvornaLista = listaIme === 'polja_zaglavlje' ? aktivnaPoljaZaglavlja : aktivnaPoljaUnosa;
        const novaLista = [...izvornaLista];
        novaLista[index] = { ...novaLista[index], span: noviSpan };
        saas.setUi({ ...saas.ui, [listaIme]: novaLista });
    };

    const promijeniNazivPolja = (listaIme, index, noviLabel) => {
        const izvornaLista = listaIme === 'polja_zaglavlje' ? aktivnaPoljaZaglavlja : aktivnaPoljaUnosa;
        const novaLista = [...izvornaLista];
        novaLista[index] = { ...novaLista[index], label: noviLabel };
        saas.setUi({ ...saas.ui, [listaIme]: novaLista });
    };

    const [tab, setTab] = useState('prijem');
    const [sumarijeList, setSumarijeList] = useState([]);
    const [podruzniceList, setPodruzniceList] = useState([]);
    const [prevozniciList, setPrevozniciList] = useState([]);
    const [odjeliList, setOdjeliList] = useState([]);
    const [vrsteList, setVrsteList] = useState([]);
    const [klaseList, setKlaseList] = useState([]);
    const [podruzniceBaza, setPodruzniceBaza] = useState([]);
    const [cjenovnikBaza, setCjenovnikBaza] = useState([]);

    const [dialog, setDialog] = useState({ isOpen: false });
    const prikaziDialog = (opcije) => setDialog({ isOpen: true, confirmText: 'POTVRDI', cancelText: 'ZATVORI', ...opcije });
    const zatvoriDialog = () => setDialog({ isOpen: false });

    const [pHeader, setPHeader] = useState({
        sumarija: typeof window !== 'undefined' ? localStorage.getItem('pr_sumarija') || '' : '',
        podruznica: typeof window !== 'undefined' ? localStorage.getItem('pr_podruznica') || '' : '',
        prevoznik: typeof window !== 'undefined' ? localStorage.getItem('pr_prevoznik') || '' : '',
        odjel: typeof window !== 'undefined' ? localStorage.getItem('pr_odjel') || '' : '',
        otpremnica_broj: typeof window !== 'undefined' ? localStorage.getItem('pr_otpr_broj') || '' : '',
        otpremnica_datum: typeof window !== 'undefined' ? localStorage.getItem('pr_otpr_datum') || new Date().toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    });

    const [scan, setScan] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('pr_scan') || '';
        return '';
    });
    
    const [form, setForm] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('pr_form');
            if (saved) {
                try { return JSON.parse(saved); } catch(e) {}
            }
        }
        return { broj_plocice: '', redni_broj: '', vrsta: '', klasa: '', duzina: '', promjer: '', isKontrola: false, kontrolna_duzina: '', kontrolni_promjer: '' };
    });

    useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('pr_scan', scan); }, [scan]);
    useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('pr_form', JSON.stringify(form)); }, [form]);

    const [isScanning, setIsScanning] = useState(false);
    const [scanTarget, setScanTarget] = useState('unos'); 
    const [listaPrijema, setListaPrijema] = useState([]);
    const scanTimerRef = useRef(null);

    const [krojenjeScan, setKrojenjeScan] = useState('');
    const [majkaTrupac, setMajkaTrupac] = useState(null);
    const [brojDjece, setBrojDjece] = useState(2);
    const [djecaTrupci, setDjecaTrupci] = useState([]);
    const [dodajKaloKaoTrupac, setDodajKaloKaoTrupac] = useState(false);
    const [kaloPlocica, setKaloPlocica] = useState('');

    const refs = {
        sumarija: useRef(null), podruznica: useRef(null), prevoznik: useRef(null), odjel: useRef(null),
        otpremnica_datum: useRef(null), otpremnica_broj: useRef(null), scan: useRef(null), plocica: useRef(null),
        redni: useRef(null), duzina: useRef(null), promjer: useRef(null), btn_dodaj: useRef(null)
    };

    const zapisiU_Log = async (akcija, detalji, stari = null, novi = null) => { 
        await supabase.from('sistem_audit_log').insert([{ korisnik: user?.ime_prezime || 'Nepoznat', akcija, detalji, stari_podaci: stari, novi_podaci: novi }]); 
    };

    const handleEnter = (e, nextRef) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            nextRef?.current?.focus();
        }
    };

    useEffect(() => {
        if (majkaTrupac) {
            const arr = Array.from({ length: brojDjece }).map((_, i) => djecaTrupci[i] || { id: '', duzina: '', promjer: '' });
            setDjecaTrupci(arr);
        }
    }, [brojDjece, majkaTrupac]);

    const calcVol = (l, d) => {
        if (!l || !d) return 0;
        const r = parseFloat(d) / 200;
        return (r * r * Math.PI * parseFloat(l));
    };

    const trenutnaDjecaVolume = useMemo(() => { return djecaTrupci.reduce((sum, dj) => sum + calcVol(dj.duzina, dj.promjer), 0); }, [djecaTrupci]);
    const kaloVolume = useMemo(() => {
        if (!majkaTrupac) return 0;
        const vol = parseFloat(majkaTrupac.zapremina || 0) - trenutnaDjecaVolume;
        return vol > 0 ? vol : 0;
    }, [majkaTrupac, trenutnaDjecaVolume]);

    useEffect(() => {
        const channel = supabase.channel(`prijem_live_sync_${Math.random()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'trupci' }, () => { loadPrijemList(); }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [pHeader.otpremnica_broj]);

    useEffect(() => {
        const fetchMostUsed = async () => {
            const { data } = await supabase.from('trupci').select('sumarija, podruznica, prevoznik').order('created_at', { ascending: false }).limit(100);
            if (data && data.length > 0) {
                const sCounts = {}; const pCounts = {}; const prvCounts = {};
                data.forEach(d => {
                    if (d.sumarija) sCounts[d.sumarija] = (sCounts[d.sumarija] || 0) + 1;
                    if (d.podruznica) pCounts[d.podruznica] = (pCounts[d.podruznica] || 0) + 1;
                    if (d.prevoznik) prvCounts[d.prevoznik] = (prvCounts[d.prevoznik] || 0) + 1;
                });
                
                const topSumarija = Object.keys(sCounts).sort((a,b) => sCounts[b] - sCounts[a])[0];
                const topPodruznica = Object.keys(pCounts).sort((a,b) => pCounts[b] - pCounts[a])[0];
                const topPrevoznik = Object.keys(prvCounts).sort((a,b) => prvCounts[b] - prvCounts[a])[0];

                setPHeader(prev => {
                    let hasChanges = false;
                    const newHeader = { ...prev };
                    if (!prev.sumarija && topSumarija) { newHeader.sumarija = topSumarija; hasChanges = true; }
                    if (!prev.podruznica && topPodruznica) { newHeader.podruznica = topPodruznica; hasChanges = true; }
                    if (!prev.prevoznik && topPrevoznik) { newHeader.prevoznik = topPrevoznik; hasChanges = true; }
                    return hasChanges ? newHeader : prev;
                });
            }
        };

        supabase.from('sumarije').select('naziv').then(({data}) => { if(data) setSumarijeList(data.map(d=>({naziv: d.naziv}))); });
        supabase.from('prevoznici').select('naziv').then(({data}) => { if(data) setPrevozniciList(data.map(d=>({naziv: d.naziv}))); });
        supabase.from('trupci').select('odjel').neq('odjel', null).then(({data}) => { if(data) setOdjeliList([...new Set(data.map(d => d.odjel).filter(Boolean))].map(o=>({naziv: o}))); });
        supabase.from('vrste_drveta').select('naziv').then(({data}) => { if(data && data.length > 0) { setVrsteList(data.map(d=>d.naziv)); if(!form.vrsta) setForm(f => ({...f, vrsta: data[0].naziv})); } });
        supabase.from('klase_trupaca').select('naziv').then(({data}) => { if(data && data.length > 0) { setKlaseList(data.map(d=>d.naziv)); if(!form.klasa) setForm(f => ({...f, klasa: data[0].naziv})); } });
        supabase.from('cjenovnik_trupaca').select(`cijena_po_m3, sumarije(naziv), vrste_drveta(naziv), klase_trupaca(naziv)`).then(({data}) => setCjenovnikBaza(data || []));
        
        fetchMostUsed();
    }, []);

    useEffect(() => { loadPrijemList(); }, [pHeader.otpremnica_broj]);
    
    useEffect(() => { 
        if(pHeader.sumarija) {
            supabase.from('podruznice').select('*').eq('sumarija_naziv', pHeader.sumarija).then(({data}) => {
                const list = data || []; setPodruzniceBaza(list); setPodruzniceList(list.map(d=>({naziv: d.naziv})));
            });
        }
    }, [pHeader.sumarija]);

    const loadPrijemList = async () => {
        if(!pHeader.otpremnica_broj) return;
        const cleanBroj = pHeader.otpremnica_broj.trim();
        const { data } = await supabase.from('trupci').select('*').eq('otpremnica_broj', cleanBroj).eq('zakljucen_prijem', false).order('created_at', { ascending: false });
        setListaPrijema(data || []);
    };

    const updateHeader = (key, val) => {
        const updated = { ...pHeader, [key]: val };
        setPHeader(updated); 
        localStorage.setItem(`pr_${key}`, val);
    };

    const provjeriOtpremnicu = async (broj) => {
        if (!broj || !pHeader.sumarija) return;
        let query = supabase.from('trupci').select('zakljucen_prijem').eq('otpremnica_broj', broj).eq('sumarija', pHeader.sumarija);
        if (pHeader.podruznica) query = query.eq('podruznica', pHeader.podruznica);
        else query = query.is('podruznica', null);
        const { data } = await query.limit(1);

        if (data && data.length > 0 && data[0].zakljucen_prijem) {
            prikaziDialog({
                tip: 'upozorenje', naslov: 'Otpremnica Zaključena!',
                poruka: `Otpremnica broj ${broj} iz odabrane šumarije je VEĆ UNESENA I ZAKLJUČENA!\n\nDa li želite da je OTKLJUČATE kako biste naknadno vršili izmjene (Edit mod)?\nOva akcija će biti prijavljena Superadminu.`,
                confirmText: '🔓 OTKLJUČAJ (EDIT MOD)', cancelText: '✕ ODUSTANI',
                onConfirm: async () => {
                    let updateQuery = supabase.from('trupci').update({ zakljucen_prijem: false }).eq('otpremnica_broj', broj).eq('sumarija', pHeader.sumarija);
                    if (pHeader.podruznica) updateQuery = updateQuery.eq('podruznica', pHeader.podruznica);
                    else updateQuery = updateQuery.is('podruznica', null);
                    await updateQuery;
                    await zapisiU_Log('OTKLJUČAN_ZAVRŠEN_PRIJEM', `Otključana otpremnica ${broj} (${pHeader.sumarija}) radi naknadnih izmjena.`, null, { otpremnica: broj, sumarija: pHeader.sumarija });
                    loadPrijemList(); zatvoriDialog();
                },
                onCancel: () => { updateHeader('otpremnica_broj', ''); zatvoriDialog(); }
            });
        }
    };

    const calculatedZapremina = useMemo(() => {
        if(!form.duzina || !form.promjer) return "0.00";
        return calcVol(form.duzina, form.promjer).toFixed(2);
    }, [form.duzina, form.promjer]);

    const calculatedKontrolnaZapremina = useMemo(() => {
        if(!form.kontrolna_duzina || !form.kontrolni_promjer) return "0.00";
        return calcVol(form.kontrolna_duzina, form.kontrolni_promjer).toFixed(2);
    }, [form.kontrolna_duzina, form.kontrolni_promjer]);

    const processScanValue = async (val) => {
        const id = val.toUpperCase().trim();
        const { data: existing } = await supabase.from('trupci').select('*').eq('id', id).maybeSingle();
        
        if(existing) {
            const isEditingMode = listaPrijema.some(t => t.id === id);
            if (isEditingMode) {
                const trupacIzListe = listaPrijema.find(t => t.id === id);
                prikaziDialog({
                    tip: 'info', naslov: 'Trupac već skeniran',
                    poruka: `Trupac sa QR kodom ${id} je već dodan na ovu otpremnicu.\n\nŽelite li uređivati njegove podatke?`,
                    confirmText: '✏️ DA, UREDI', cancelText: '✕ ODUSTANI',
                    onConfirm: () => { pokreniIzmjenuTrupca(trupacIzListe); zatvoriDialog(); },
                    onCancel: () => { setScan(''); zatvoriDialog(); setTimeout(() => refs.scan.current?.focus(), 100); }
                });
            } else {
                prikaziDialog({ 
                    tip: 'greska', naslov: 'Iskorišten Kod', 
                    poruka: `QR KOD JE VEĆ ISKORIŠTEN!\nTrenutni status: ${existing.status}\nOtpremnica: ${existing.otpremnica_broj}\nSkenirajte drugu pločicu.`, 
                    onCancel: () => { setScan(''); zatvoriDialog(); setTimeout(() => refs.scan.current?.focus(), 100); } 
                });
            }
        } else {
            refs.plocica.current?.focus(); 
        }
    };

    const handleScanInput = (val, isEnter = false) => {
        setScan(val);
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        if (!val) return;
        if (isEnter) { processScanValue(val); } else if (val.length >= 3) { scanTimerRef.current = setTimeout(() => processScanValue(val), 1000); }
    };

    const handleKrojenjeScanInput = (val, isEnter = false) => {
        setKrojenjeScan(val);
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        if (!val) return;
        if (isEnter) ucitajMajkuTrupac(val); else scanTimerRef.current = setTimeout(() => ucitajMajkuTrupac(val), 1500);
    };

    const ucitajMajkuTrupac = async (val) => {
        const id = val.toUpperCase().trim();
        const { data } = await supabase.from('trupci').select('*').eq('id', id).maybeSingle();
        if (data) {
            if (data.status === 'PREKROJENO') return prikaziDialog({ tip: 'upozorenje', naslov: 'Već Prekrojen', poruka: `Trupac ${id} je već ranije prekrojen!`, onCancel: zatvoriDialog });
            if (data.status === 'PROREZANO') return prikaziDialog({ tip: 'greska', naslov: 'Već na brenti', poruka: `Trupac ${id} je izrezan na brenti i ne može se krojiti!`, onCancel: zatvoriDialog });
            setMajkaTrupac(data); setKrojenjeScan('');
        } else {
            prikaziDialog({ tip: 'greska', naslov: 'Nepoznat trupac', poruka: `Trupac ${id} ne postoji u bazi.`, onCancel: zatvoriDialog }); setKrojenjeScan('');
        }
    };

    const pokreniIzmjenuTrupca = (t) => {
        setScan(t.id);
        setForm(prev => ({
            ...prev,
            broj_plocice: t.broj_plocice || '', redni_broj: t.redni_broj || '',
            vrsta: t.vrsta || vrsteList[0] || '', klasa: t.klasa || klaseList[0] || '',
            duzina: t.duzina || '', promjer: t.promjer || '',
            isKontrola: !!t.kontrolna_zapremina,
            kontrolna_duzina: t.kontrolna_duzina || '', kontrolni_promjer: t.kontrolni_promjer || ''
        }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => refs.plocica.current?.focus(), 100);
    };

    const isEditingTrupac = listaPrijema.some(t => t.id === scan.toUpperCase().trim());

    const snimiTrupac = async () => {
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        if(!pHeader.otpremnica_broj || !pHeader.sumarija) return prikaziDialog({ tip: 'upozorenje', naslov: 'Fale podaci', poruka: "Popunite Šumariju i Broj Otpremnice u Zaglavlju!", onCancel: zatvoriDialog });
        if(!scan || !form.duzina || !form.promjer) return prikaziDialog({ tip: 'upozorenje', naslov: 'Fale podaci', poruka: "Skeniraj QR, unesi dužinu (m) i prečnik (cm).", onCancel: zatvoriDialog });
        if (form.isKontrola && (!form.kontrolna_duzina || !form.kontrolni_promjer)) {
            return prikaziDialog({ tip: 'upozorenje', naslov: 'Fale kontrolni podaci', poruka: "Uključili ste kontrolno mjerenje. Morate unijeti stvarnu dužinu (m) i prečnik (cm)!", onCancel: zatvoriDialog });
        }

        const trupacID = scan.toUpperCase();
        const zapreminaZaObracun = form.isKontrola ? parseFloat(calculatedKontrolnaZapremina) : parseFloat(calculatedZapremina);
        const podrObj = podruzniceBaza.find(p => p.naziv === pHeader.podruznica && p.sumarija_naziv === pHeader.sumarija);
        const prevozPoKubiku = podrObj ? parseFloat(podrObj.cijena_prevoza_po_m3 || 0) : 0;
        const cjenObj = cjenovnikBaza.find(c => c.sumarije?.naziv === pHeader.sumarija && c.vrste_drveta?.naziv === form.vrsta && c.klase_trupaca?.naziv === form.klasa);
        const cijenaTrupcaPoKubiku = cjenObj ? parseFloat(cjenObj.cijena_po_m3 || 0) : 0;
        const konacna_nabavna_vrijednost = (cijenaTrupcaPoKubiku + prevozPoKubiku) * zapreminaZaObracun;

        const trupacData = {
            id: trupacID, broj_plocice: form.broj_plocice || null, redni_broj: form.redni_broj || null, 
            vrsta: form.vrsta, klasa: form.klasa, duzina: parseFloat(form.duzina), promjer: parseFloat(form.promjer), 
            zapremina: parseFloat(calculatedZapremina), kontrolna_duzina: form.isKontrola ? parseFloat(form.kontrolna_duzina) : null,
            kontrolni_promjer: form.isKontrola ? parseFloat(form.kontrolni_promjer) : null, kontrolna_zapremina: form.isKontrola ? parseFloat(calculatedKontrolnaZapremina) : null,
            sumarija: pHeader.sumarija, podruznica: pHeader.podruznica || null, otpremnica_broj: pHeader.otpremnica_broj.trim(),
            otpremnica_datum: pHeader.otpremnica_datum, prevoznik: pHeader.prevoznik || null, odjel: pHeader.odjel || null,         
            snimio_korisnik: user?.ime_prezime || 'Nepoznat', datum_prijema: new Date().toISOString().split('T')[0], 
            zakljucen_prijem: false, status: 'na_lageru', nabavna_vrijednost: konacna_nabavna_vrijednost
        };

        const isUpdate = listaPrijema.some(t => t.id === trupacID);
        const stariPodaci = isUpdate ? listaPrijema.find(t => t.id === trupacID) : null;

        const { error } = await supabase.from('trupci').upsert([trupacData]);
        if (error) return prikaziDialog({ tip: 'greska', naslov: 'Baza Greška', poruka: error.message, onCancel: zatvoriDialog });

        if (isUpdate) { await zapisiU_Log('IZMJENA_TRUPCA_NA_PRIJEMU', `Izmijenjen trupac ${trupacID} na otpremnici ${pHeader.otpremnica_broj}.`, stariPodaci, trupacData); }

        if (typeof window !== 'undefined' && window.navigator.vibrate) window.navigator.vibrate(100); 
        setScan(''); 
        setForm(prev => ({ ...prev, broj_plocice: '', redni_broj: '', duzina: '', promjer: '', isKontrola: false, kontrolna_duzina: '', kontrolni_promjer: '' })); 
        await loadPrijemList();
        refs.scan.current?.focus();
    };

    const obrisiTrupacSaPrijema = (t, e) => {
        e.stopPropagation();
        prikaziDialog({
            tip: 'upozorenje',
            naslov: 'Brisanje Trupca sa Otpremnice',
            poruka: `Da li ste sigurni da želite obrisati trupac ${t.id} (Pločica: ${t.broj_plocice || '-'}, ${t.zapremina} m³) sa ove otpremnice?`,
            confirmText: '🗑️ OBRIŠI TRUPAC',
            cancelText: '✕ ODUSTANI',
            onConfirm: async () => {
                await zapisiU_Log('BRISANJE_TRUPCA_SA_PRIJEMA', `Obrisan trupac ${t.id} sa otpremnice ${pHeader.otpremnica_broj}.`, t, null);
                await supabase.from('trupci').delete().eq('id', t.id);
                loadPrijemList();
                zatvoriDialog();
                toast.info(`Trupac ${t.id} obrisan.`);
            },
            onCancel: zatvoriDialog
        });
    };

    const izvrsiKrojenje = async () => {
        if (!majkaTrupac) return;
        for (let i = 0; i < djecaTrupci.length; i++) {
            const dj = djecaTrupci[i];
            if (!dj.id || !dj.duzina || !dj.promjer) { return prikaziDialog({ tip: 'upozorenje', naslov: 'Nepotpuni podaci', poruka: `Molimo popunite QR KOD (ID), Dužinu (m) i Prečnik (cm) za trupac broj ${i+1}!`, onCancel: zatvoriDialog }); }
        }
        if (dodajKaloKaoTrupac && (!kaloPlocica || kaloPlocica.trim() === '')) { return prikaziDialog({ tip: 'upozorenje', naslov: 'Nepotpuni podaci', poruka: `Odabrali ste da zadužite kalo kao trupac. Skenirajte QR pločicu za kalo!`, onCancel: zatvoriDialog }); }

        const sviIdjevi = djecaTrupci.map(d => d.id.toUpperCase());
        if (dodajKaloKaoTrupac) sviIdjevi.push(kaloPlocica.toUpperCase());
        if (new Set(sviIdjevi).size !== sviIdjevi.length) { return prikaziDialog({ tip: 'greska', naslov: 'Dupli Kodovi', poruka: "Imate iste QR kodove unutar ove forme za krojenje. Skenirajte različite pločice!", onCancel: zatvoriDialog }); }

        prikaziDialog({
            tip: 'info', naslov: 'Potvrdi Krojenje',
            poruka: `Da li ste sigurni da želite prekrati trupac ${majkaTrupac.id} na ${brojDjece} komada?\n(Kalo/otpad je ${kaloVolume.toFixed(2)} m³)\n\nOva akcija će arhivirati majku i zadužiti nove komade na lager.`,
            confirmText: '✅ PREKROJI I ZADUŽI', cancelText: '✕ ODUSTANI',
            onConfirm: async () => {
                const ukupnaNovaKubikaza = trenutnaDjecaVolume + (dodajKaloKaoTrupac ? kaloVolume : 0);
                const majkaVrijednost = parseFloat(majkaTrupac.nabavna_vrijednost || 0);
                const noviTrupciPayload = [];

                djecaTrupci.forEach(dj => {
                    const vol = calcVol(dj.duzina, dj.promjer);
                    const cijena = ukupnaNovaKubikaza > 0 ? (vol / ukupnaNovaKubikaza) * majkaVrijednost : 0;
                    noviTrupciPayload.push({
                        id: dj.id.toUpperCase(), parent_id: majkaTrupac.id, vrsta: majkaTrupac.vrsta, klasa: majkaTrupac.klasa,
                        duzina: parseFloat(dj.duzina), promjer: parseFloat(dj.promjer), zapremina: parseFloat(vol.toFixed(3)),
                        sumarija: majkaTrupac.sumarija, podruznica: majkaTrupac.podruznica, otpremnica_broj: majkaTrupac.otpremnica_broj,
                        otpremnica_datum: majkaTrupac.otpremnica_datum, prevoznik: majkaTrupac.prevoznik, odjel: majkaTrupac.odjel,
                        snimio_korisnik: user?.ime_prezime || 'Nepoznat', datum_prijema: new Date().toISOString().split('T')[0],
                        zakljucen_prijem: true, status: 'na_lageru', nabavna_vrijednost: parseFloat(cijena.toFixed(2)),
                        broj_plocice: 'PREKROJENO', redni_broj: 'IZVEDENO'
                    });
                });

                if (dodajKaloKaoTrupac && kaloVolume > 0) {
                    const cijenaKalo = ukupnaNovaKubikaza > 0 ? (kaloVolume / ukupnaNovaKubikaza) * majkaVrijednost : 0;
                    noviTrupciPayload.push({
                        id: kaloPlocica.toUpperCase(), parent_id: majkaTrupac.id, vrsta: majkaTrupac.vrsta, klasa: 'KALO/OGRJEV',
                        duzina: 0, promjer: 0, zapremina: parseFloat(kaloVolume.toFixed(3)),
                        sumarija: majkaTrupac.sumarija, podruznica: majkaTrupac.podruznica, otpremnica_broj: majkaTrupac.otpremnica_broj,
                        otpremnica_datum: majkaTrupac.otpremnica_datum, prevoznik: majkaTrupac.prevoznik, odjel: majkaTrupac.odjel,
                        snimio_korisnik: user?.ime_prezime || 'Nepoznat', datum_prijema: new Date().toISOString().split('T')[0],
                        zakljucen_prijem: true, status: 'na_lageru', nabavna_vrijednost: parseFloat(cijenaKalo.toFixed(2)),
                        broj_plocice: 'KALO', redni_broj: 'OSTATAK'
                    });
                }

                const { error: err1 } = await supabase.from('trupci').update({ status: 'PREKROJENO' }).eq('id', majkaTrupac.id);
                if (err1) return prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: err1.message, onCancel: zatvoriDialog });

                const { error: err2 } = await supabase.from('trupci').insert(noviTrupciPayload);
                if (err2) return prikaziDialog({ tip: 'greska', naslov: 'Greška kod snimanja novih komada', poruka: err2.message, onCancel: zatvoriDialog });

                setMajkaTrupac(null); setBrojDjece(2); setDjecaTrupci([]); setDodajKaloKaoTrupac(false); setKaloPlocica('');
                zatvoriDialog();
                prikaziDialog({ tip: 'uspjeh', naslov: 'Uspješno Prekrojeno', poruka: `Trupac je uspješno razdužen i pretvoren u ${noviTrupciPayload.length} novih komada na lageru.`, onCancel: zatvoriDialog });
            },
            onCancel: zatvoriDialog
        });
    };

    const zakljuciOtpremnicu = async () => {
        if(listaPrijema.length === 0) return prikaziDialog({ tip: 'upozorenje', naslov: 'Prazno', poruka: "Nema trupaca na listi za zaključavanje.", onCancel: zatvoriDialog });
        prikaziDialog({
            tip: 'info',
            naslov: 'Zaključi Otpremnicu?',
            poruka: `Da li ste sigurni da želite ZAKLJUČITI OTPREMNICU ${pHeader.otpremnica_broj}?\nOvo će trajno potvrditi sve dodane trupce.`,
            confirmText: '✅ ZAKLJUČI',
            cancelText: '✕ ODUSTANI',
            onConfirm: async () => {
                for(let trupac of listaPrijema) await supabase.from('trupci').update({ zakljucen_prijem: true }).eq('id', trupac.id);
                ['pr_sumarija', 'pr_podruznica', 'pr_prevoznik', 'pr_odjel', 'pr_otpr_broj', 'pr_scan', 'pr_form'].forEach(k => localStorage.removeItem(k));
                setPHeader({...pHeader, sumarija: '', podruznica: '', prevoznik: '', odjel: '', otpremnica_broj: ''});
                setScan(''); setForm(prev => ({...prev, broj_plocice: '', redni_broj: '', duzina: '', promjer: '', isKontrola: false, kontrolna_duzina: '', kontrolni_promjer: ''}));
                setListaPrijema([]); zatvoriDialog();
                prikaziDialog({ tip: 'uspjeh', naslov: 'Zaključeno', poruka: "Otpremnica je uspješno zaključena i trupci su evidentirani.", onCancel: zatvoriDialog });
            },
            onCancel: zatvoriDialog
        });
    };

    const renderPolje = (polje, formData, setFormData) => {
        const actualId = polje.id === 'datum' ? 'otpremnica_datum' : (polje.id === 'broj' ? 'otpremnica_broj' : (polje.id === 'plocica' ? 'broj_plocice' : (polje.id === 'redni' ? 'redni_broj' : polje.id)));
        const val = formData[actualId] || '';
        const setVal = (v) => setFormData(actualId, v);

        const nextMap = { 'sumarija': refs.podruznica, 'podruznica': refs.prevoznik, 'prevoznik': refs.odjel, 'odjel': refs.otpremnica_datum, 'otpremnica_datum': refs.otpremnica_broj, 'otpremnica_broj': refs.scan, 'broj_plocice': refs.duzina, 'redni_broj': refs.duzina, 'duzina': refs.promjer, 'promjer': refs.btn_dodaj };

        if (['sumarija', 'podruznica', 'prevoznik'].includes(actualId)) {
            let listToUse = [];
            if(actualId === 'sumarija') listToUse = sumarijeList;
            if(actualId === 'podruznica') listToUse = podruzniceList;
            if(actualId === 'prevoznik') listToUse = prevozniciList;

            return (
                <div className="w-full h-full min-h-[45px] min-w-0">
                    <select ref={refs[actualId]} value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => handleEnter(e, nextMap[actualId])} className="w-full h-full min-h-[45px] min-w-0 px-3 bg-theme-panel border border-theme-border outline-none focus:border-theme-accent cursor-pointer uppercase shadow-inner transition-colors" style={inputStyle}>
                        <option value="">-- Odaberi --</option>
                        {listToUse.map(s => <option key={s.naziv} value={s.naziv}>{s.naziv}</option>)}
                    </select>
                </div>
            );
        }
        
        if (actualId === 'odjel') {
            return (
                <div className="w-full h-full min-h-[45px] min-w-0 relative">
                    <input list="odjeli-list" ref={refs[actualId]} value={val} onChange={e => setVal(e.target.value.toUpperCase())} onKeyDown={e => handleEnter(e, nextMap[actualId])} className="w-full h-full min-h-[45px] min-w-0 px-3 bg-theme-panel border border-theme-border outline-none focus:border-theme-accent uppercase shadow-inner transition-colors" style={inputStyle} placeholder="Unesi ili odaberi..." />
                    <datalist id="odjeli-list">{odjeliList.map(o => <option key={o.naziv} value={o.naziv} />)}</datalist>
                </div>
            );
        }
        
        if (actualId === 'otpremnica_datum') return (
            <div className="flex items-center gap-1 bg-theme-panel border border-theme-border p-1 focus-within:border-theme-accent h-full w-full min-w-0 shadow-inner transition-colors" style={{ ...inputStyle, padding: '4px' }}>
                <button type="button" onClick={() => setVal(shiftDateString(val, -1))} className="w-7 h-8 bg-black/20 rounded hover:bg-theme-accent text-theme-text font-black shrink-0 transition-colors">-</button>
                <input ref={refs.otpremnica_datum} type="date" value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => handleEnter(e, nextMap[actualId])} className="flex-1 min-w-0 w-full bg-transparent text-xs text-theme-text outline-none text-center uppercase [&::-webkit-calendar-picker-indicator]:invert font-black" style={{ fontFamily: saas.ui.font_family || 'inherit', color: saas.ui.input_color || 'inherit' }} />
                <button type="button" onClick={() => setVal(shiftDateString(val, 1))} className="w-7 h-8 bg-black/20 rounded hover:bg-theme-accent text-theme-text font-black shrink-0 transition-colors">+</button>
            </div>
        );
        
        if (actualId === 'otpremnica_broj') return <input ref={refs.otpremnica_broj} type="text" value={val} onChange={e => setVal(e.target.value.toUpperCase())} onBlur={(e) => provjeriOtpremnicu(e.target.value.toUpperCase())} onKeyDown={e => handleEnter(e, nextMap[actualId])} className="w-full h-full min-h-[45px] min-w-0 p-3 bg-theme-panel border border-theme-border outline-none focus:border-theme-accent shadow-inner uppercase transition-colors" style={inputStyle} placeholder="Unesi broj..." />;
        if (actualId === 'broj_plocice') return <input ref={refs.plocica} type="text" value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => handleEnter(e, nextMap[actualId])} className="w-full h-full min-h-[45px] min-w-0 p-3 bg-theme-panel border border-theme-border outline-none focus:border-theme-accent text-center shadow-inner transition-colors" style={inputStyle} placeholder="12345" />;
        if (actualId === 'redni_broj') return <input ref={refs.redni} type="text" value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => handleEnter(e, nextMap[actualId])} className="w-full h-full min-h-[45px] min-w-0 p-3 bg-theme-panel border border-theme-border outline-none focus:border-theme-accent text-center shadow-inner transition-colors" style={inputStyle} placeholder="npr. 1" />;
        
        if (actualId === 'vrsta') return <select tabIndex="-1" ref={refs.vrsta} value={val} onChange={e => setVal(e.target.value)} className="w-full h-full min-h-[45px] min-w-0 px-3 py-0 bg-theme-panel border border-theme-border outline-none uppercase text-center shadow-inner cursor-pointer transition-colors" style={inputStyle}>{vrsteList.map(v => <option key={v} value={v} className="bg-theme-panel text-theme-text">{v}</option>)}</select>;
        if (actualId === 'klasa') return <select tabIndex="-1" ref={refs.klasa} value={val} onChange={e => setVal(e.target.value)} className="w-full h-full min-h-[45px] min-w-0 px-3 py-0 bg-theme-panel border border-theme-border outline-none uppercase text-center shadow-inner cursor-pointer transition-colors" style={inputStyle}>{klaseList.map(k => <option key={k} value={k} className="bg-theme-panel text-theme-text">{k}</option>)}</select>;
        
        if (actualId === 'duzina') return <input ref={refs.duzina} type="number" value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => handleEnter(e, nextMap[actualId])} className="w-full h-full min-h-[45px] min-w-0 p-3 bg-theme-panel border border-theme-border outline-none focus:border-theme-accent text-center shadow-inner transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" style={inputStyle} placeholder="0" />;
        if (actualId === 'promjer') return <input ref={refs.promjer} type="number" value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => handleEnter(e, nextMap[actualId])} className="w-full h-full min-h-[45px] min-w-0 p-3 bg-theme-panel border border-theme-border outline-none focus:border-theme-accent text-center shadow-inner transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" style={inputStyle} placeholder="0" />;
        
        return null;
    };

    // Pomoćna komponenta za kontrolu širine polja (1/4, 1/3, 1/2, FULL) u God Mode-u
    const renderGodModeKontrolePolja = (listaIme, polje, index) => {
        const trenutniSpan = normalizujSpan12(polje.span);
        const opcije = [
            { label: '1/4', span: 'col-span-3' },
            { label: '1/3', span: 'col-span-4' },
            { label: '1/2', span: 'col-span-6' },
            { label: 'FULL', span: 'col-span-12' }
        ];
        return (
            <div className="mb-2 space-y-1.5 bg-black/60 p-2 rounded-xl border border-amber-500/40">
                <div className="flex items-center justify-between gap-1">
                    <span className="text-[9px] text-amber-400 font-black uppercase cursor-grab active:cursor-grabbing px-1">☰ Pomjeri</span>
                    <div className="flex gap-1">
                        {opcije.map(op => (
                            <button
                                key={op.span}
                                type="button"
                                onClick={() => promijeniSirinuPolja(listaIme, index, op.span)}
                                className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all ${trenutniSpan === op.span ? 'bg-amber-500 text-black shadow-md' : 'bg-theme-panel text-slate-400 hover:text-white border border-slate-700'}`}
                            >
                                {op.label}
                            </button>
                        ))}
                    </div>
                </div>
                <input
                    type="text"
                    value={polje.label || ''}
                    onChange={(e) => promijeniNazivPolja(listaIme, index, e.target.value)}
                    placeholder="Naziv polja..."
                    className="w-full p-1 bg-theme-card text-amber-300 text-[9px] font-black uppercase text-center rounded border border-amber-500/30 outline-none"
                />
            </div>
        );
    };

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6 animate-in fade-in pb-24 overflow-visible" style={{ fontFamily: saas.ui.font_family || 'inherit' }}>
            <PametniDialog {...dialog} />
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-indigo-500" user={user} modulIme="prijem" saas={saas} hideMasina={true} />

            {saas.isEditMode && (
                <div className="bg-theme-card/90 backdrop-blur-md p-6 rounded-2xl border-2 border-amber-500/50 mb-6 shadow-2xl space-y-4">
                    <div className="flex flex-wrap justify-between items-center border-b border-amber-500/20 pb-4 gap-2">
                        <div>
                            <h3 className="text-amber-500 font-black uppercase text-sm flex items-center gap-2">🛠️ Super God Mode - Napredni UI Editor</h3>
                            <p className="text-[10px] text-amber-300/80 font-bold mt-1">Ispod na svakom polju kliknite na [1/4], [1/3], [1/2] ili [FULL] da podesite širinu polja, ili prevucite polje mišem (☰) za promjenu redoslijeda!</p>
                        </div>
                        <button onClick={resetToThemeDefaults} className="text-[10px] bg-red-900/30 text-red-400 px-3 py-1.5 rounded-lg font-black uppercase border border-red-500/30 hover:bg-red-500 hover:text-white transition-colors">🧹 Očisti boje (Tema)</button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {/* Sekcija 1: Glavne Boje */}
                        <div className="space-y-3 p-3 bg-black/10 rounded-xl border border-theme-border shadow-inner">
                            <h4 className="text-[10px] text-amber-500 uppercase font-black">1. Glavne Boje</h4>
                            <label className="text-[9px] text-theme-muted uppercase flex items-center justify-between font-bold">Boja Kartice <input type="color" value={saas.ui.boja_kartice || '#ffffff'} onChange={e => saas.setUi({...saas.ui, boja_kartice: e.target.value})} className="w-6 h-6 rounded cursor-pointer border-none bg-transparent" /></label>
                            <label className="text-[9px] text-theme-muted uppercase flex items-center justify-between font-bold">Boja Glavnog Slova <input type="color" value={saas.ui.boja_slova || '#0f172a'} onChange={e => saas.setUi({...saas.ui, boja_slova: e.target.value})} className="w-6 h-6 rounded cursor-pointer border-none bg-transparent" /></label>
                            <label className="text-[9px] text-theme-muted uppercase flex items-center justify-between font-bold">Boja Akcenta <input type="color" value={saas.ui.boja_teksta || '#4f46e5'} onChange={e => saas.setUi({...saas.ui, boja_teksta: e.target.value})} className="w-6 h-6 rounded cursor-pointer border-none bg-transparent" /></label>
                        </div>
                        
                        {/* Sekcija 2: Tipografija */}
                        <div className="space-y-3 p-3 bg-black/10 rounded-xl border border-theme-border shadow-inner">
                            <h4 className="text-[10px] text-amber-500 uppercase font-black">2. Tipografija (Font)</h4>
                            <select value={saas.ui.font_family || 'Inter, sans-serif'} onChange={e=>saas.setUi({...saas.ui, font_family:e.target.value})} className="w-full bg-theme-panel text-theme-text border border-theme-border p-2 rounded text-xs outline-none cursor-pointer font-bold">
                                <option value="Inter, sans-serif">Inter (Modern)</option>
                                <option value="Arial, sans-serif">Arial (Classic)</option>
                                <option value="'Courier New', monospace">Courier (Kasa/Terminal)</option>
                                <option value="'Times New Roman', serif">Times New Roman</option>
                            </select>
                            <label className="text-[9px] text-theme-muted uppercase font-bold mt-2 block">Veličina Glavnog Naslova</label>
                            <input type="number" value={saas.ui.velicina_naslova} onChange={e=>saas.setUi({...saas.ui, velicina_naslova:e.target.value})} className="w-full bg-theme-panel text-theme-text border border-theme-border p-2 rounded text-xs outline-none font-bold" />
                        </div>

                        {/* Sekcija 3: Labela */}
                        <div className="space-y-3 p-3 bg-black/10 rounded-xl border border-theme-border shadow-inner">
                            <h4 className="text-[10px] text-amber-500 uppercase font-black">3. Natpisi iznad polja</h4>
                            <div className="flex gap-2">
                                <input type="number" value={saas.ui.label_size || 9} onChange={e=>saas.setUi({...saas.ui, label_size:e.target.value})} placeholder="Size px" className="w-1/2 min-w-0 bg-theme-panel text-theme-text border border-theme-border p-2 rounded text-xs outline-none font-bold text-center" />
                                <select value={saas.ui.label_weight || '900'} onChange={e=>saas.setUi({...saas.ui, label_weight:e.target.value})} className="w-1/2 min-w-0 bg-theme-panel text-theme-text border border-theme-border p-2 rounded text-xs outline-none cursor-pointer font-bold">
                                    <option value="400">Normal</option><option value="700">Bold</option><option value="900">Black</option>
                                </select>
                            </div>
                            <label className="text-[9px] text-theme-muted uppercase flex items-center justify-between font-bold">Boja Natpisa <input type="color" value={saas.ui.label_color || '#64748b'} onChange={e => saas.setUi({...saas.ui, label_color: e.target.value})} className="w-6 h-6 rounded cursor-pointer border-none bg-transparent" /></label>
                        </div>

                        {/* Sekcija 4: Inputi */}
                        <div className="space-y-3 p-3 bg-black/10 rounded-xl border border-theme-border shadow-inner">
                            <h4 className="text-[10px] text-amber-500 uppercase font-black">4. Polja za Unos</h4>
                            <div className="flex gap-2 mb-2">
                                <input type="number" value={saas.ui.input_size || 12} onChange={e=>saas.setUi({...saas.ui, input_size:e.target.value})} placeholder="Size px" className="w-1/2 min-w-0 bg-theme-panel text-theme-text border border-theme-border p-2 rounded text-xs outline-none font-bold text-center" />
                                <select value={saas.ui.input_weight || '900'} onChange={e=>saas.setUi({...saas.ui, input_weight:e.target.value})} className="w-1/2 min-w-0 bg-theme-panel text-theme-text border border-theme-border p-2 rounded text-xs outline-none cursor-pointer font-bold">
                                    <option value="400">Normal</option><option value="700">Bold</option><option value="900">Black</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <label className="text-[8px] text-theme-muted uppercase text-center font-bold">Tekst <input type="color" value={saas.ui.input_color || '#ffffff'} onChange={e => saas.setUi({...saas.ui, input_color: e.target.value})} className="w-full h-6 rounded cursor-pointer border-none mt-1" /></label>
                                <label className="text-[8px] text-theme-muted uppercase text-center font-bold">Pozadina <input type="color" value={saas.ui.input_bg || '#000000'} onChange={e => saas.setUi({...saas.ui, input_bg: e.target.value})} className="w-full h-6 rounded cursor-pointer border-none mt-1" /></label>
                                <label className="text-[8px] text-theme-muted uppercase text-center font-bold">Okvir <input type="color" value={saas.ui.input_border_color || '#334155'} onChange={e => saas.setUi({...saas.ui, input_border_color: e.target.value})} className="w-full h-6 rounded cursor-pointer border-none mt-1" /></label>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="text-center mb-6">
                <h2 className="text-theme-accent font-black tracking-widest uppercase text-xl md:text-2xl drop-shadow-md flex items-center justify-center gap-3" style={{ color: saas.ui.boja_teksta || 'var(--theme-accent)' }}>
                    🌳 PRIJEM TRUPACA (Dužina u m, Prečnik u cm)
                </h2>
            </div>

            <div className="flex bg-theme-panel p-1.5 rounded-2xl border border-theme-border shadow-inner mb-6 mx-auto max-w-xl transition-colors">
                <button onClick={() => setTab('prijem')} className={`flex-1 py-3 md:py-4 rounded-xl text-[10px] md:text-xs uppercase font-black transition-all flex items-center justify-center gap-2 ${tab === 'prijem' ? 'bg-theme-accent text-white shadow-lg' : 'text-theme-muted hover:text-theme-text hover:bg-theme-card'}`}>📥 STANDARDNI PRIJEM</button>
                <button onClick={() => setTab('krojenje')} className={`flex-1 py-3 md:py-4 rounded-xl text-[10px] md:text-xs uppercase font-black transition-all flex items-center justify-center gap-2 ${tab === 'krojenje' ? 'bg-amber-600 text-white shadow-lg border border-amber-500' : 'text-theme-muted hover:text-theme-text hover:bg-theme-card'}`}>✂️ KROJENJE TRUPACA</button>
            </div>

            {tab === 'prijem' && (
                <div className="animate-in fade-in space-y-6">

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-visible">
                        <div className="lg:col-span-5 space-y-6 overflow-visible">
                            <div className="p-6 rounded-[var(--radius-box)] shadow-2xl transition-colors border border-theme-border backdrop-blur-[var(--glass-blur)] relative overflow-visible bg-theme-card" style={{ backgroundColor: saas.ui.boja_kartice || undefined }}>
                                <div className="text-center font-black relative mb-6 border-b border-theme-border pb-4">
                                    {saas.isEditMode ? (
                                        <input
                                            type="text"
                                            value={saas.ui.naslov_zaglavlja || ''}
                                            onChange={e => saas.setUi({ ...saas.ui, naslov_zaglavlja: e.target.value })}
                                            className="w-full p-2 bg-black/40 border border-amber-500/50 rounded-xl text-center text-amber-400 font-black uppercase text-xs outline-none"
                                        />
                                    ) : (
                                        <span className="uppercase tracking-widest flex items-center justify-center gap-2" style={{ color: saas.ui.boja_teksta || 'var(--theme-accent)', fontSize: `${saas.ui.velicina_naslova || 16}px` }}><span className="w-2 h-2 rounded-full bg-theme-accent"></span> {saas.ui.naslov_zaglavlja}</span>
                                    )}
                                </div>

                                {/* 🟢 12-KOLONSKA SIMETRIČNA MREŽA ZA ZAGLAVLJE OTPREMNICE (1/4, 1/3, 1/2, FULL) */}
                                <div className="grid grid-cols-12 gap-3.5 relative overflow-visible items-end">
                                    {aktivnaPoljaZaglavlja.map((polje, index) => {
                                        const cistSpan = normalizujSpan12(polje.span);
                                        return (
                                            <div 
                                                key={polje.id} 
                                                className={`relative ${cistSpan} min-w-0 transition-all overflow-visible ${saas.isEditMode ? 'p-2 rounded-2xl border-2 border-dashed border-amber-500/60 bg-amber-950/10' : ''}`} 
                                                style={{ zIndex: 50 - index }}
                                                draggable={saas.isEditMode}
                                                onDragStart={(e) => handleDragStart(e, index, 'polja_zaglavlje')}
                                                onDragEnter={(e) => handleDragEnter(e, index)}
                                                onDragEnd={() => handleDrop('polja_zaglavlje')}
                                                onDragOver={(e) => e.preventDefault()}
                                            >
                                                {saas.isEditMode ? (
                                                    renderGodModeKontrolePolja('polja_zaglavlje', polje, index)
                                                ) : (
                                                    polje.label && <label className="block mb-1.5 ml-1 uppercase transition-colors truncate" style={labelStyle}>{polje.label}</label>
                                                )}
                                                <div className={`h-12 w-full min-w-0 overflow-visible ${saas.isEditMode ? 'opacity-70 pointer-events-none' : ''}`}>
                                                    {renderPolje(polje, pHeader, updateHeader)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-7 space-y-6 overflow-visible">
                            <div className="p-6 md:p-8 rounded-[var(--radius-box)] shadow-[0_0_40px_rgba(0,0,0,0.1)] border border-theme-accent/30 backdrop-blur-[var(--glass-blur)] relative overflow-visible group bg-theme-card transition-colors" style={{ backgroundColor: saas.ui.boja_kartice || undefined }}>
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-theme-accent to-transparent opacity-50"></div>
                                {saas.isEditMode ? (
                                    <input
                                        type="text"
                                        value={saas.ui.naslov_skenera || ''}
                                        onChange={e => saas.setUi({ ...saas.ui, naslov_skenera: e.target.value })}
                                        className="w-full p-2 mb-4 bg-black/40 border border-amber-500/50 rounded-xl text-center text-amber-400 font-black uppercase text-xs outline-none"
                                    />
                                ) : (
                                    <label className="uppercase block mb-4 tracking-widest text-center transition-colors" style={{ color: saas.ui.boja_teksta || 'var(--theme-accent)', fontSize: `${saas.ui.velicina_naslova || 16}px`, fontWeight: 900 }}>{saas.ui.naslov_skenera}</label>
                                )}
                                
                                <div className="flex bg-theme-panel border-2 border-theme-accent/40 rounded-2xl overflow-hidden shadow-inner focus-within:border-theme-accent transition-colors h-20 mb-6 w-full">
                                    <input 
                                        ref={refs.scan} 
                                        value={scan} 
                                        onChange={e => handleScanInput(e.target.value)} 
                                        onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); handleScanInput(scan, true); } }} 
                                        className="flex-1 w-full min-w-0 px-2 md:px-6 bg-transparent text-center outline-none uppercase placeholder:text-theme-muted/30 tracking-widest transition-colors" 
                                        style={{...scannerStyle, fontSize: '24px', fontWeight: '900'}}
                                        placeholder="ČEKAM SKEN..." 
                                    />
                                    <button onClick={() => {setScanTarget('unos'); setIsScanning(true);}} className="shrink-0 w-16 md:w-24 bg-theme-accent text-white font-black hover:opacity-80 transition-colors text-2xl flex items-center justify-center shadow-lg border-l border-theme-accent/50">📷</button>
                                </div>
                                
                                {/* 🟢 12-KOLONSKA SIMETRIČNA MREŽA ZA POLJA UNOSA TRUPCA (1/4, 1/3, 1/2, FULL) */}
                                <div className="grid grid-cols-12 gap-3.5 relative mb-6 overflow-visible items-end">
                                    {aktivnaPoljaUnosa.map((polje, index) => {
                                        const cistSpan = normalizujSpan12(polje.span);
                                        return (
                                            <div 
                                                key={polje.id} 
                                                className={`relative ${cistSpan} min-w-0 transition-all overflow-visible ${saas.isEditMode ? 'p-2 rounded-2xl border-2 border-dashed border-amber-500/60 bg-amber-950/10' : ''}`} 
                                                style={{ zIndex: 50 - index }}
                                                draggable={saas.isEditMode}
                                                onDragStart={(e) => handleDragStart(e, index, 'polja_unos')}
                                                onDragEnter={(e) => handleDragEnter(e, index)}
                                                onDragEnd={() => handleDrop('polja_unos')}
                                                onDragOver={(e) => e.preventDefault()}
                                            >
                                                {saas.isEditMode ? (
                                                    renderGodModeKontrolePolja('polja_unos', polje, index)
                                                ) : (
                                                    polje.label && <label className="block mb-1.5 text-center transition-colors uppercase truncate" style={labelStyle}>{polje.label}</label>
                                                )}
                                                <div className={`h-14 w-full min-w-0 overflow-visible ${saas.isEditMode ? 'opacity-70 pointer-events-none' : ''}`}>
                                                    {renderPolje(polje, form, (key, val) => setForm(prev => ({...prev, [key]: val})))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                
                                {/* DEKLARISANO (PAPIR) */}
                                <div className="flex justify-between items-center bg-theme-panel p-5 rounded-2xl border border-theme-border shadow-inner mb-4 transition-colors">
                                    <span className="text-[10px] text-theme-muted uppercase font-black tracking-widest">Deklarisano (Papir):</span>
                                    <span className="text-3xl text-theme-accent font-black drop-shadow-md">{calculatedZapremina} <span className="text-lg">m³</span></span>
                                </div>

                                {/* PREKIDAČ I POLJA ZA KONTROLNO MJERENJE */}
                                <div className="mb-6">
                                    <button 
                                        onClick={() => setForm({...form, isKontrola: !form.isKontrola})}
                                        className={`w-full py-3 rounded-xl uppercase text-[10px] font-black tracking-widest border transition-all flex items-center justify-center gap-2 ${form.isKontrola ? 'bg-amber-600 border-amber-500 text-white shadow-lg' : 'bg-transparent border-theme-border text-theme-muted hover:text-theme-text hover:border-theme-accent'}`}
                                    >
                                        ⚖️ {form.isKontrola ? 'Poništi kontrolno mjerenje' : 'Unesi kontrolno mjerenje'}
                                    </button>

                                    {form.isKontrola && (
                                        <div className="mt-4 p-4 bg-amber-900/10 border border-amber-500/30 rounded-2xl animate-in slide-in-from-top-2">
                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                <div className="min-w-0">
                                                    <label className="text-[9px] text-amber-500 uppercase block mb-1 font-black tracking-widest text-center">Stvarna Dužina (M)</label>
                                                    <input type="number" value={form.kontrolna_duzina} onChange={e => setForm({...form, kontrolna_duzina: e.target.value})} className="w-full min-w-0 h-12 p-3 bg-theme-panel border border-amber-500/30 rounded-xl text-amber-500 outline-none focus:border-amber-400 text-center text-lg font-black shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0" />
                                                </div>
                                                <div className="min-w-0">
                                                    <label className="text-[9px] text-amber-500 uppercase block mb-1 font-black tracking-widest text-center">Stvarni Prečnik (CM)</label>
                                                    <input type="number" value={form.kontrolni_promjer} onChange={e => setForm({...form, kontrolni_promjer: e.target.value})} className="w-full min-w-0 h-12 p-3 bg-theme-panel border border-amber-500/30 rounded-xl text-amber-500 outline-none focus:border-amber-400 text-center text-lg font-black shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0" />
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center bg-theme-panel p-4 rounded-xl border border-amber-500/20 shadow-inner">
                                                <span className="text-[10px] text-amber-500 uppercase font-black tracking-widest">Stvarno (Kontrola):</span>
                                                <span className="text-2xl text-amber-500 font-black drop-shadow-md">{calculatedKontrolnaZapremina} <span className="text-sm">m³</span></span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button ref={refs.btn_dodaj} onClick={snimiTrupac} className={`w-full py-6 text-white font-black rounded-2xl uppercase shadow-xl hover:opacity-90 transition-all text-sm tracking-widest ${isEditingTrupac ? 'bg-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.4)] border border-amber-400' : 'bg-theme-accent border border-transparent'}`}>
                                    {isEditingTrupac ? '✅ SAČUVAJ IZMJENE TRUPCA' : '➕ DODAJ NA OTPREMNICU'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {pHeader.otpremnica_broj && (
                        <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-[var(--radius-box)] border border-theme-border shadow-xl animate-in fade-in transition-colors" style={{ backgroundColor: saas.ui.boja_kartice || undefined }}>
                            <div className="flex flex-col md:flex-row justify-between items-center mb-6 px-2 border-b border-theme-border pb-4 gap-4">
                                <div>
                                    <span className="text-[10px] text-theme-muted uppercase font-black tracking-widest block">Otpremnica: <span className="text-theme-accent text-sm">{pHeader.otpremnica_broj}</span></span>
                                    <span className="text-xs text-theme-text font-black mt-1 block">Ukupno trupaca: {listaPrijema.length} kom ({listaPrijema.reduce((s,t) => s + parseFloat(t.kontrolna_zapremina || t.zapremina || 0), 0).toFixed(2)} m³)</span>
                                </div>
                                <button onClick={zakljuciOtpremnicu} disabled={listaPrijema.length === 0} className={`w-full md:w-auto px-8 py-4 text-white font-black rounded-xl text-xs uppercase shadow-lg transition-all ${listaPrijema.length === 0 ? 'bg-slate-500 opacity-50 cursor-not-allowed' : 'bg-theme-accent hover:opacity-80'}`}>🏁 ZAKLJUČI OTPREMNICU</button>
                            </div>

                            <div className="space-y-3 max-h-[500px] overflow-y-auto mb-4 custom-scrollbar pr-2">
                                {listaPrijema.length === 0 && <div className="text-center p-8 border-2 border-dashed border-theme-border rounded-2xl text-theme-muted font-bold uppercase tracking-widest text-xs bg-theme-panel">Nema skeniranih trupaca za ovu otpremnicu.</div>}
                                {listaPrijema.map(t => (
                                    <div key={t.id} onClick={() => pokreniIzmjenuTrupca(t)} className={`cursor-pointer flex flex-col p-5 bg-theme-panel border rounded-2xl shadow-md transition-all hover:scale-[1.01] hover:border-theme-accent/50 ${t.kontrolna_zapremina ? 'border-amber-500/50 bg-amber-500/10' : 'border-theme-border'} ${scan.toUpperCase() === t.id ? 'ring-2 ring-amber-500 bg-theme-card' : ''}`}>
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm text-theme-text font-black flex flex-wrap items-center gap-2">
                                                    <span className="text-theme-accent text-lg drop-shadow-md">{t.id}</span> 
                                                    <span className="text-theme-text text-[10px] bg-theme-card px-3 py-1 rounded-lg border border-theme-border shadow-inner">Pločica: {t.broj_plocice || '-'}</span>
                                                    {t.kontrolna_zapremina && <span className="text-[8px] bg-amber-500 text-white px-2 py-0.5 rounded uppercase font-black tracking-widest">Kontrola</span>}
                                                </div>
                                                <div className="text-[10px] text-theme-muted uppercase mt-2 font-bold tracking-widest">
                                                    {t.vrsta} | Klasa {t.klasa} | Papir: L: {t.duzina} m, Ø: {t.promjer} cm
                                                    {t.kontrolna_duzina && <span className="text-amber-500 ml-2 block sm:inline mt-1 sm:mt-0">| Stvarno: L: {t.kontrolna_duzina} m, Ø: {t.kontrolni_promjer} cm</span>}
                                                </div>
                                            </div>
                                            <div className="text-right flex flex-col items-end shrink-0">
                                                <div className="text-2xl text-theme-text font-black drop-shadow-md">{t.kontrolna_zapremina ? t.kontrolna_zapremina : t.zapremina} <span className="text-sm text-theme-accent">m³</span></div>
                                                <button onClick={(e) => obrisiTrupacSaPrijema(t, e)} className="text-[10px] text-red-500 uppercase font-black hover:text-white bg-red-500/10 hover:bg-red-600 px-4 py-1.5 rounded-lg mt-2 transition-all shadow-sm">Obriši ×</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: KROJENJE TRUPACA */}
            {tab === 'krojenje' && (
                <div className="animate-in slide-in-from-right space-y-6 max-w-4xl mx-auto">
                    
                    <div className="bg-theme-card p-6 md:p-8 rounded-[var(--radius-box)] border-2 border-amber-500/50 shadow-xl transition-colors" style={{ backgroundColor: saas.ui.boja_kartice || undefined }}>
                        <div className="text-center font-black relative mb-6 border-b border-theme-border pb-4">
                            <span className="text-amber-500 uppercase tracking-widest flex items-center justify-center gap-2 text-xl"><span className="w-2 h-2 rounded-full bg-amber-500"></span> 1. SKENIRAJ ORIGINALNI TRUPAC (MAJKU)</span>
                        </div>
                        
                        <div className="flex bg-theme-panel border-2 border-amber-500/40 rounded-2xl overflow-hidden shadow-inner focus-within:border-amber-500 transition-all h-20 mb-6 w-full">
                            <input value={krojenjeScan} onChange={e => handleKrojenjeScanInput(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') handleKrojenjeScanInput(krojenjeScan, true) }} className="flex-1 min-w-0 px-6 bg-transparent text-xl md:text-2xl text-center text-amber-500 outline-none uppercase placeholder:text-theme-muted/50 font-black tracking-widest" placeholder="SKENIRAJ ILI UKUCAJ ID..." />
                            <button onClick={() => {setScanTarget('krojenje_majka'); setIsScanning(true);}} className="shrink-0 px-8 bg-amber-500/10 text-amber-500 font-black hover:bg-amber-500 hover:text-white transition-colors text-2xl flex items-center justify-center shadow-lg border-l border-amber-500/30">📷</button>
                        </div>

                        {majkaTrupac && (
                            <div className="bg-theme-panel p-5 rounded-2xl border border-theme-border shadow-inner relative overflow-hidden animate-in zoom-in-95">
                                <div className="absolute -right-5 -top-5 text-8xl opacity-10">🪵</div>
                                <div className="flex justify-between items-start border-b border-theme-border pb-3 mb-3 relative z-10">
                                    <div><span className="text-[9px] text-theme-muted uppercase font-black tracking-widest block mb-1">Pronađen Trupac</span><h3 className="text-2xl text-theme-text font-black drop-shadow-md">{majkaTrupac.id}</h3></div>
                                    <div className="text-right"><span className="text-[9px] text-theme-muted uppercase font-black tracking-widest block mb-1">Izvorna Zapremina</span><h3 className="text-2xl text-emerald-500 font-black drop-shadow-md">{majkaTrupac.zapremina} <span className="text-xs">m³</span></h3></div>
                                </div>
                                <div className="flex flex-wrap gap-4 text-xs font-bold text-theme-muted uppercase tracking-widest relative z-10">
                                    <span>{majkaTrupac.vrsta}</span> | <span>Klasa: {majkaTrupac.klasa}</span> | <span>Dužina: {majkaTrupac.duzina} m</span> | <span>Prečnik: Ø {majkaTrupac.promjer} cm</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {majkaTrupac && (
                        <div className="bg-theme-card p-6 md:p-8 rounded-[var(--radius-box)] border border-theme-border shadow-2xl animate-in slide-in-from-bottom transition-colors" style={{ backgroundColor: saas.ui.boja_kartice || undefined }}>
                            <div className="text-center font-black relative mb-6 border-b border-theme-border pb-4 flex flex-wrap justify-between items-center gap-3">
                                <span className="text-amber-500 uppercase tracking-widest flex items-center gap-2 text-lg"><span className="w-2 h-2 rounded-full bg-amber-500"></span> 2. KROJENJE (NOVI KOMADI)</span>
                                <div className="flex items-center gap-3">
                                    <label className="text-[10px] text-theme-muted uppercase tracking-widest">Na koliko komada siječeš?</label>
                                    <select value={brojDjece} onChange={e => setBrojDjece(parseInt(e.target.value))} className="bg-theme-panel text-amber-500 font-black text-lg px-3 py-1 rounded-xl outline-none border border-theme-border cursor-pointer shadow-inner">
                                        {[2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4 mb-6">
                                {djecaTrupci.map((dj, idx) => (
                                    <div key={idx} className="bg-theme-panel p-4 rounded-2xl border border-theme-border shadow-md flex flex-col md:flex-row gap-4 items-center">
                                        <div className="bg-amber-500/10 text-amber-500 w-8 h-8 flex items-center justify-center rounded-full font-black text-xs shrink-0 border border-amber-500/30">{idx+1}</div>
                                        <div className="flex-1 w-full min-w-0 relative">
                                            <label className="text-[8px] text-theme-muted uppercase block mb-1 font-black tracking-widest ml-1">QR KOD (Nova Pločica)</label>
                                            <input type="text" value={dj.id} onChange={e => { const arr = [...djecaTrupci]; arr[idx].id = e.target.value.toUpperCase(); setDjecaTrupci(arr); }} className="w-full min-w-0 p-3 bg-theme-card border border-theme-border rounded-xl text-theme-text font-black outline-none focus:border-amber-500 text-center uppercase shadow-inner" placeholder="SKENIRAJ ILI UKUCAJ..." />
                                        </div>
                                        <div className="w-full md:w-32 min-w-0 relative">
                                            <label className="text-[8px] text-theme-muted uppercase block mb-1 font-black tracking-widest ml-1">Dužina (m)</label>
                                            <input type="number" value={dj.duzina} onChange={e => { const arr = [...djecaTrupci]; arr[idx].duzina = e.target.value; setDjecaTrupci(arr); }} className="w-full min-w-0 p-3 bg-theme-card border border-theme-border rounded-xl text-amber-500 font-black outline-none focus:border-amber-500 text-center text-lg shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0" />
                                        </div>
                                        <div className="w-full md:w-32 min-w-0 relative">
                                            <label className="text-[8px] text-theme-muted uppercase block mb-1 font-black tracking-widest ml-1">Prečnik (cm)</label>
                                            <input type="number" value={dj.promjer} onChange={e => { const arr = [...djecaTrupci]; arr[idx].promjer = e.target.value; setDjecaTrupci(arr); }} className="w-full min-w-0 p-3 bg-theme-card border border-theme-border rounded-xl text-amber-500 font-black outline-none focus:border-amber-500 text-center text-lg shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0" />
                                        </div>
                                        <div className="w-full md:w-28 text-center bg-theme-card p-2 rounded-xl border border-theme-border shrink-0">
                                            <span className="text-[8px] text-theme-muted uppercase block mb-0.5 font-black">Zapremina (m³)</span>
                                            <span className="text-sm font-black text-emerald-500">{calcVol(dj.duzina, dj.promjer).toFixed(3)} m³</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-theme-panel p-6 rounded-2xl border-2 border-dashed border-theme-border mb-6">
                                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl">🪚</span>
                                        <div>
                                            <p className="text-[10px] text-theme-muted uppercase font-black tracking-widest">Kalo / Ostatak Prilikom Rezanja</p>
                                            <p className={`text-2xl font-black mt-1 drop-shadow-md ${kaloVolume > 0 ? 'text-orange-500' : 'text-slate-400'}`}>{kaloVolume.toFixed(3)} <span className="text-xs">m³</span></p>
                                        </div>
                                    </div>
                                    
                                    {kaloVolume > 0 && (
                                        <div className="bg-theme-card p-3 rounded-xl border border-theme-border flex flex-wrap items-center gap-3">
                                            <label className="text-[9px] text-theme-muted uppercase font-black tracking-widest cursor-pointer flex items-center gap-2">
                                                <input type="checkbox" checked={dodajKaloKaoTrupac} onChange={e => setDodajKaloKaoTrupac(e.target.checked)} className="w-4 h-4 accent-orange-500" />
                                                Zaduži ostatak na lager
                                            </label>
                                            {dodajKaloKaoTrupac && (
                                                <input type="text" value={kaloPlocica} onChange={e => setKaloPlocica(e.target.value.toUpperCase())} className="w-36 p-2 bg-theme-panel border border-orange-500/50 rounded-lg text-orange-500 text-xs text-center uppercase font-black outline-none shadow-inner" placeholder="QR ZA KALO..." />
                                            )}
                                        </div>
                                    )}
                                </div>
                                <p className="text-[9px] text-theme-muted uppercase font-bold tracking-widest text-center">Ukupna vrijednost "Majke" bit će prenesena na novonastale komade srazmjerno njihovoj kubikaži.</p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <button onClick={() => {setMajkaTrupac(null); setBrojDjece(2); setDjecaTrupci([]);}} className="flex-1 py-4 bg-theme-panel text-theme-muted font-black rounded-xl uppercase hover:bg-slate-500 hover:text-white transition-all border border-theme-border text-xs tracking-widest">✕ ODUSTANI</button>
                                <button onClick={izvrsiKrojenje} className="flex-[2] py-4 bg-amber-600 text-white font-black rounded-xl uppercase shadow-lg hover:bg-amber-500 transition-all text-xs tracking-widest hover:scale-[1.02] border border-amber-500">✂️ ZAVRŠI KROJENJE I ZADUŽI</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {isScanning && <ScannerOverlay onScan={(text) => { 
                if(scanTarget === 'krojenje_majka') handleKrojenjeScanInput(text, true); 
                else handleScanInput(text, true); 
                setIsScanning(false); 
            }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}