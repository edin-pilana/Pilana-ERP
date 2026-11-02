"use client";
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import MasterHeader from '../components/MasterHeader';
import MasterSearch from '../components/MasterSearch';
import PametniDialog from '../components/PametniDialog';
import ScannerOverlay from '../components/ScannerOverlay';
import { printDokument } from '../utils/printHelpers';
import { useSaaS } from '../utils/useSaaS';

function RN_SearchablePonuda({ ponude, value, onChange, onScanClick }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const wrapperRef = useRef(null);

    useEffect(() => { setSearch(value || ''); }, [value]);
    useEffect(() => { setSelectedIndex(0); }, [search]);

    useEffect(() => {
        function handleClickOutside(event) { if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false); }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const safeSearch = (search || '').toString().toUpperCase();
    const filtered = ponude.filter(p => p.id.toUpperCase().includes(safeSearch) || p.kupac_naziv.toUpperCase().includes(safeSearch));

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
            if (filtered.length > 0) {
                const sel = filtered[selectedIndex];
                onChange(sel.id, true); setSearch(sel.id); setOpen(false);
            } else if (search) {
                onChange(search, true); setOpen(false);
            }
        } else if (e.key === 'Escape') { setOpen(false); }
    };

    return (
        <div ref={wrapperRef} className="relative font-black w-full flex bg-theme-panel border-2 border-blue-500 rounded-xl overflow-visible focus-within:border-blue-400 transition-all shadow-inner min-h-[45px]">
            <input value={search} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onChange={e => { setSearch(e.target.value); setOpen(true); onChange(e.target.value, false); }} onKeyDown={handleKeyDown} placeholder="Upiši broj ponude, ime kupca ili skeniraj..." className="flex-1 p-4 bg-transparent text-sm text-theme-text outline-none uppercase font-black tracking-widest relative z-10 min-w-0" />
            <button onClick={onScanClick} className="px-6 bg-theme-accent text-white text-xl hover:opacity-80 transition-all border-l border-blue-500/50 relative z-10 shrink-0">📷</button>
            {open && search && (
                <div className="absolute top-full left-0 z-[100] w-full mt-2 bg-theme-panel border border-theme-border rounded-xl shadow-2xl max-h-60 overflow-y-auto text-left custom-scrollbar">
                    {filtered.length === 0 && <div className="p-3 text-xs text-theme-muted text-center italic">Nema rezultata...</div>}
                    {filtered.map((p, idx) => (
                        <div key={p.id} onMouseDown={(e) => { e.preventDefault(); onChange(p.id, true); setSearch(p.id); setOpen(false); }} onMouseEnter={() => setSelectedIndex(idx)} className={`p-3 border-b border-theme-border cursor-pointer transition-colors ${idx === selectedIndex ? 'bg-theme-accent text-white' : 'hover:bg-theme-card text-theme-text'}`}>
                            <div className="text-sm font-black">{p.id}</div>
                            <div className="text-[10px] text-slate-400 mt-1">{p.kupac_naziv} | Status: <span className={p.status === 'POTVRĐENA' ? 'text-emerald-400' : 'text-amber-400'}>{p.status}</span></div>
                        </div>
                    ))}
                    <div onMouseDown={(e) => { e.preventDefault(); setOpen(false); }} className="p-2 text-center text-[9px] text-slate-500 cursor-pointer hover:text-theme-text bg-theme-card rounded-b-xl uppercase font-bold tracking-widest mt-1">Zatvori</div>
                </div>
            )}
        </div>
    );
}

function RN_SearchableProizvod({ katalog, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const wrapperRef = useRef(null);

    useEffect(() => { setSearch(value || ''); }, [value]);
    useEffect(() => { setSelectedIndex(0); }, [search]);

    useEffect(() => {
        function handleClickOutside(event) { if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false); }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filtered = katalog.filter(k => k.sifra.toUpperCase().includes((search || '').toUpperCase()) || k.naziv.toUpperCase().includes((search || '').toUpperCase()));

    const handleKeyDown = (e) => {
        if (!open) { if (e.key === 'ArrowDown') setOpen(true); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0)); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered.length > 0) {
                const k = filtered[selectedIndex];
                const tekstZaPolje = `${k.sifra} | ${k.naziv}`;
                onChange(k.sifra, tekstZaPolje); setSearch(tekstZaPolje); setOpen(false);
            }
        } else if (e.key === 'Escape') { setOpen(false); }
    };

    return (
        <div ref={wrapperRef} className="relative font-black w-full min-h-[45px]">
            <input value={search} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onChange={e => { setSearch(e.target.value.toUpperCase()); setOpen(true); }} onKeyDown={handleKeyDown} placeholder="Pronađi šifru ili naziv..." className="w-full p-4 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none focus:border-purple-500 shadow-inner" />
            {open && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-theme-panel border border-theme-border rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar">
                    {filtered.map((k, idx) => (
                        <div key={k.sifra} onMouseDown={(e) => { e.preventDefault(); const tekstZaPolje = `${k.sifra} | ${k.naziv}`; onChange(k.sifra, tekstZaPolje); setSearch(tekstZaPolje); setOpen(false); }} onMouseEnter={() => setSelectedIndex(idx)} className={`p-3 border-b border-theme-border cursor-pointer transition-all ${idx === selectedIndex ? 'bg-purple-600 text-white' : 'hover:bg-theme-card text-theme-text'}`}>
                            <div className="text-sm font-black">{k.sifra} <span className="text-purple-300 ml-1">{k.naziv}</span></div>
                            <div className="text-[9px] text-slate-400 mt-1 uppercase">Kat: {k.kategorija} | Dim: {k.visina}x{k.sirina}x{k.duzina} cm</div>
                        </div>
                    ))}
                    <div onMouseDown={(e) => { e.preventDefault(); setOpen(false); }} className="p-2 text-center text-[8px] text-slate-500 cursor-pointer hover:text-theme-text bg-theme-card sticky bottom-0">Zatvori</div>
                </div>
            )}
        </div>
    );
}

export default function RadniNaloziModule({ user, header, setHeader, onExit }) {
    const saas = useSaaS('radni_nalozi_zaglavlje', {
        boja_kartice: '#1e293b',
        polja: [
            { id: 'ponuda', label: 'Broj Ponude (Vezni dokument)', span: 'col-span-2' }, { id: 'broj', label: 'BROJ NALOGA', span: 'col-span-2' },
            { id: 'kupac', label: '* KUPAC (Za koga proizvodimo)', span: 'col-span-2' }, { id: 'datum', label: 'Datum izdavanja', span: 'col-span-1' },
            { id: 'rok', label: 'Rok Isporuke', span: 'col-span-1' }, { id: 'status', label: 'Status Proizvodnje', span: 'col-span-2' }
        ]
    });
    
    const aktivnaPolja = saas.ui.polja?.length > 0 ? saas.ui.polja : saas.defaultConfig.polja;
    const currentUser = user?.ime_prezime ? user : JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');
    const dragItem = useRef(null); const dragOverItem = useRef(null);
    const handleDragStart = (e, index) => { dragItem.current = index; }; const handleDragEnter = (e, index) => { dragOverItem.current = index; };
    const handleDrop = () => { if(dragItem.current === null || dragOverItem.current === null) return; const novaLista = [...aktivnaPolja]; const premjesteniItem = novaLista[dragItem.current]; novaLista.splice(dragItem.current, 1); novaLista.splice(dragOverItem.current, 0, premjesteniItem); dragItem.current = null; dragOverItem.current = null; saas.setUi({...saas.ui, polja: novaLista}); };
    const updatePolje = (index, key, val) => { const novaLista = [...aktivnaPolja]; novaLista[index][key] = val; saas.setUi({...saas.ui, polja: novaLista}); };
    const toggleVelicinaPolja = (index) => { const novaLista = [...aktivnaPolja]; const trenutno = novaLista[index].span; novaLista[index].span = trenutno === 'col-span-1' ? 'col-span-2' : (trenutno === 'col-span-2' ? 'col-span-4' : 'col-span-1'); saas.setUi({...saas.ui, polja: novaLista}); };
    const spremiDimenzije = (e, index) => { if (!saas.isEditMode) return; const w = e.currentTarget.style.width; const h = e.currentTarget.style.height; if (w || h) { const novaLista = [...aktivnaPolja]; if (w) novaLista[index].customWidth = w; if (h) novaLista[index].customHeight = h; saas.setUi({...saas.ui, polja: novaLista}); } };

    const [tab, setTab] = useState('novi');
    const [subTab, setSubTab] = useState('U PROIZVODNJI');
    const [kupci, setKupci] = useState([]);
    const [katalog, setKatalog] = useState([]);
    const [nalozi, setNalozi] = useState([]);
    const [aktivnePonude, setAktivnePonude] = useState([]);
    const [masineList, setMasineList] = useState([]);
    const [isScanning, setIsScanning] = useState(false);

    const [dialog, setDialog] = useState({ isOpen: false });
    const prikaziDialog = (opcije) => setDialog({ isOpen: true, confirmText: 'POTVRDI', cancelText: 'ZATVORI', ...opcije });
    const zatvoriDialog = () => setDialog({ isOpen: false });

    const [brisanjeNaloga, setBrisanjeNaloga] = useState(null);
    const [razlogBrisanja, setRazlogBrisanja] = useState('');

    const generisiID = () => `RN-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;
    const [form, setForm] = useState({ id: generisiID(), broj_ponude: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0], rok_isporuke: '', napomena: '', status: 'U PROIZVODNJI', tip_naloga: 'OBIČNI' });
    const [stavke, setStavke] = useState([]);
    const [originalneStavke, setOriginalneStavke] = useState(null);
    const [isEditingNalog, setIsEditingNalog] = useState(false);
    const [stavkaForm, setStavkaForm] = useState({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3' });
    const [trenutniProizvod, setTrenutniProizvod] = useState(null);
    const [skenerInput, setSkenerInput] = useState('');
    const [tehnologija, setTehnologija] = useState({});
    const timerRef = useRef(null);
    const [autoEditTriggered, setAutoEditTriggered] = useState(false);
    
    useEffect(() => {
        const autoId = localStorage.getItem('erp_auto_open_id');
        const autoAction = localStorage.getItem('erp_auto_action');
        
        if (autoId && autoAction === 'uredi' && nalozi.length > 0 && !autoEditTriggered) {
            const nToEdit = nalozi.find(n => n.id === autoId);
            if (nToEdit) {
                setAutoEditTriggered(true);
                pokreniIzmjenuNaloga(nToEdit);
                localStorage.removeItem('erp_auto_open_id');
                localStorage.removeItem('erp_auto_action');
            }
        }
    }, [nalozi, autoEditTriggered]);

    useEffect(() => {
        load();
        const channel = supabase.channel(`rn_global_realtime_${Math.random()}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'radni_nalozi' }, () => load())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);
    
    const load = async () => {
        supabase.from('kupci').select('naziv').order('naziv').then(({data}) => setKupci(data||[]));
        supabase.from('katalog_proizvoda').select('*').order('sifra').then(({data}) => setKatalog(data||[]));
        supabase.from('masine').select('naziv, atributi_paketa').order('naziv').then(({data}) => setMasineList(data||[]));
        supabase.from('radni_nalozi').select('*').order('datum', { ascending: false }).then(({data}) => setNalozi(data||[]));
        supabase.from('ponude').select('id, kupac_naziv, status, stavke_jsonb, stavke, napomena').neq('status', 'REALIZOVANA ✅').then(({data}) => setAktivnePonude(data||[]));
    };

    const zapisiU_Log = async (akcija, detalji) => { await supabase.from('sistem_audit_log').insert([{ korisnik: currentUser.ime_prezime || 'Sistem', akcija, detalji }]); };

    const handlePonudaInput = (val, isEnterOrClick = false) => {
        setSkenerInput(val); if (timerRef.current) clearTimeout(timerRef.current); if (!val) return;
        if (isEnterOrClick) ucitajPonuduIzBaze(val); else timerRef.current = setTimeout(() => ucitajPonuduIzBaze(val), 2000);
    };

    const ucitajPonuduIzBaze = async (broj) => {
        try {
            const cistBroj = broj.toUpperCase().trim();
            const ponuda = aktivnePonude.find(p => p.id === cistBroj);

            if(!ponuda) {
                prikaziDialog({ tip: 'greska', naslov: 'Nije pronađeno', poruka: `Ponuda ${cistBroj} nije pronađena! Moguće da je već realizovana, ili je broj pogrešan.`, onCancel: zatvoriDialog });
                setSkenerInput('');
                return;
            }

            const { data: postojeciRN } = await supabase.from('radni_nalozi').select('id').eq('broj_ponude', cistBroj).limit(1);
            if (postojeciRN && postojeciRN.length > 0) {
                prikaziDialog({ tip: 'upozorenje', naslov: 'Duplikat', poruka: `Za ovu ponudu je VEĆ KREIRAN Radni Nalog (${postojeciRN[0].id})!`, onCancel: zatvoriDialog });
                setSkenerInput('');
                return;
            }

            if (ponuda.status === 'NA ODLUČIVANJU') {
                prikaziDialog({ tip: 'upozorenje', naslov: 'Upozorenje', poruka: `Ponuda ${cistBroj} je još uvijek u statusu "NA ODLUČIVANJU".\n\nMorate je prvo prebaciti u "POTVRĐENA ✅" unutar modula Ponuda da biste započeli proizvodnju!`, onCancel: zatvoriDialog });
                setSkenerInput('');
                return;
            }

            let currentKatalog = katalog;
            if (!currentKatalog || currentKatalog.length === 0) {
                const { data: kData } = await supabase.from('katalog_proizvoda').select('*');
                if (kData) { setKatalog(kData); currentKatalog = kData; }
            }

            let ponudaStavke = ponuda.stavke_jsonb || ponuda.stavke || [];
            if (typeof ponudaStavke === 'string') {
                try { ponudaStavke = JSON.parse(ponudaStavke); } catch(e) { ponudaStavke = []; }
            }
            if (!Array.isArray(ponudaStavke)) {
                ponudaStavke = typeof ponudaStavke === 'object' && ponudaStavke !== null ? Object.values(ponudaStavke) : [];
            }

            const prepravljeneStavke = ponudaStavke.map((s, index) => {
                const katItem = currentKatalog.find(k => k.sifra === s.sifra) || {};
                const v = parseFloat(katItem.visina) || 0; 
                const sir = parseFloat(katItem.sirina) || 0; 
                const d = parseFloat(katItem.duzina) || 0;
                
                const vol1kom = (v > 0 && sir > 0 && d > 0) ? (v/100) * (sir/100) * (d/100) : 0;
                const area1kom = (sir > 0 && d > 0) ? (sir/100) * (d/100) : 0;
                const len1kom = (d > 0) ? (d/100) : 0;

                const unosKol = parseFloat(s.kolicina_unos !== undefined ? s.kolicina_unos : s.kolicina) || 0; 
                const jmUnos = (s.jm_unos || s.jm || 'kom').toLowerCase();
                
                let komada = unosKol;
                if (jmUnos === 'm3' && vol1kom > 0) komada = unosKol / vol1kom;
                else if (jmUnos === 'm2' && area1kom > 0) komada = unosKol / area1kom;
                else if (jmUnos === 'm1' && len1kom > 0) komada = unosKol / len1kom;

                let obracunM3 = unosKol;
                if (jmUnos === 'm3') obracunM3 = unosKol;
                else if (vol1kom > 0) obracunM3 = komada * vol1kom;
                
                return { 
                    id: `stavka_${index}_${Math.random().toString(36).substring(7)}`, 
                    sifra: s.sifra, 
                    naziv: s.naziv || katItem.naziv, 
                    kolicina_unos: unosKol, 
                    jm_unos: jmUnos, 
                    kolicina_obracun: obracunM3 > 0 ? parseFloat(obracunM3.toFixed(4)) : 0, 
                    jm_obracun: 'm3', 
                    dimenzije: v > 0 ? `${v}x${sir}x${d}` : '' 
                };
            });

            setForm({ ...form, kupac_naziv: ponuda.kupac_naziv, broj_ponude: ponuda.id, napomena: ponuda.napomena });
            setStavke(prepravljeneStavke); 
            
            const orgStavke = prepravljeneStavke.map(s => ({ sifra: s.sifra, kolicina_obracun: s.kolicina_obracun }));
            setOriginalneStavke(JSON.stringify(orgStavke)); 
            setSkenerInput('');
        } catch (error) {
            prikaziDialog({ tip: 'greska', naslov: 'Kritična greška', poruka: error.message, onCancel: zatvoriDialog });
            setSkenerInput('');
        }
    };
    
    const handleProizvodSelect = (sifraVal, tekstZaPolje) => { 
        const nadjeni = katalog.find(k => k.sifra === sifraVal); 
        setTrenutniProizvod(nadjeni || null); 
        if (nadjeni) {
            setStavkaForm({ 
                ...stavkaForm, 
                id: null, 
                sifra_unos: tekstZaPolje, 
                kolicina_unos: '', 
                kolicina_obracun: '', 
                jm_unos: 'kom', 
                jm_obracun: nadjeni.default_jedinica || 'm3' 
            }); 
        }
    };
    
    useEffect(() => {
        if(!trenutniProizvod || !stavkaForm.kolicina_unos) return;
        const kol = parseFloat(stavkaForm.kolicina_unos); 
        
        const v = parseFloat(trenutniProizvod.visina) || 0; 
        const s = parseFloat(trenutniProizvod.sirina) || 0; 
        const d = parseFloat(trenutniProizvod.duzina) || 0;
        
        const vol1kom = (v > 0 && s > 0 && d > 0) ? (v/100) * (s/100) * (d/100) : 0;
        const area1kom = (s > 0 && d > 0) ? (s/100) * (d/100) : 0;
        const len1kom = (d > 0) ? (d/100) : 0;

        let komada = kol;
        if (stavkaForm.jm_unos === 'm3' && vol1kom > 0) komada = kol / vol1kom;
        else if (stavkaForm.jm_unos === 'm2' && area1kom > 0) komada = kol / area1kom;
        else if (stavkaForm.jm_unos === 'm1' && len1kom > 0) komada = kol / len1kom;

        let obracun = kol;
        if (stavkaForm.jm_obracun === 'm3') obracun = komada * vol1kom;
        else if (stavkaForm.jm_obracun === 'm2') obracun = komada * area1kom;
        else if (stavkaForm.jm_obracun === 'm1') obracun = komada * len1kom;
        else if (stavkaForm.jm_obracun === 'kom') obracun = komada;
        
        setStavkaForm(prev => ({...prev, kolicina_obracun: obracun > 0 ? obracun.toFixed(4) : "0.0000"}));
    }, [stavkaForm.kolicina_unos, stavkaForm.jm_unos, stavkaForm.jm_obracun, trenutniProizvod]);

    const zavrsiDodavanjeStavke = (novaStavka) => {
        let noveStavke = []; 
        if (stavkaForm.id) {
            noveStavke = stavke.map(s => s.id === stavkaForm.id ? novaStavka : s); 
            if (tehnologija[stavkaForm.id]) {
                const noveFaze = tehnologija[stavkaForm.id].map(f => ({
                    ...f,
                    kolicina: novaStavka.kolicina_unos,
                    jm: novaStavka.jm_unos
                }));
                setTehnologija(prev => ({...prev, [stavkaForm.id]: noveFaze}));
            }
        } 
        else {
            noveStavke = [...stavke, novaStavka];
        }
        
        setStavke(noveStavke); 
        setStavkaForm({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3' }); 
        setTrenutniProizvod(null);
    };

    const dodajStavku = () => {
        if(!trenutniProizvod || !stavkaForm.kolicina_obracun) return prikaziDialog({ tip: 'upozorenje', naslov: 'Greška', poruka: "Odaberite proizvod i provjerite količine!", onCancel: zatvoriDialog });
        const dim = trenutniProizvod ? `${parseFloat(trenutniProizvod.visina)||0}x${parseFloat(trenutniProizvod.sirina)||0}x${parseFloat(trenutniProizvod.duzina)||0}` : '';
        const novaStavka = { 
            id: stavkaForm.id || `stavka_nova_${Math.random().toString(36).substring(7)}`, 
            sifra: trenutniProizvod.sifra, 
            naziv: trenutniProizvod.naziv, 
            kolicina_unos: parseFloat(stavkaForm.kolicina_unos), 
            jm_unos: stavkaForm.jm_unos, 
            kolicina_obracun: parseFloat(stavkaForm.kolicina_obracun), 
            jm_obracun: stavkaForm.jm_obracun, 
            dimenzije: dim 
        };

        const orgStavka = originalneStavke ? JSON.parse(originalneStavke).find(o => o.sifra === trenutniProizvod.sifra) : null;
        if (form.broj_ponude && orgStavka) {
            const vecDodato = stavke.filter(s => s.sifra === trenutniProizvod.sifra && s.id !== stavkaForm.id).reduce((sum, s) => sum + parseFloat(s.kolicina_obracun), 0);
            const pokusaj = vecDodato + novaStavka.kolicina_obracun;
            
            if (pokusaj > parseFloat(orgStavka.kolicina_obracun) + 0.001) {
                return prikaziDialog({
                    tip: 'upozorenje',
                    naslov: 'Prekoračenje količine iz Ponude!',
                    poruka: `U originalnoj ponudi stoji: ${orgStavka.kolicina_obracun} m³.\nVi pokušavate dodati ukupno: ${pokusaj.toFixed(4)} m³.\n\nDa li ste sigurni da želite prekršiti dogovorenu količinu iz ponude?`,
                    confirmText: '✅ DA, NASTAVI',
                    cancelText: '✕ ODUSTANI',
                    onConfirm: () => { zavrsiDodavanjeStavke(novaStavka); zatvoriDialog(); },
                    onCancel: zatvoriDialog
                });
            }
        }
        zavrsiDodavanjeStavke(novaStavka);
    };

    const urediStavku = (stavka) => { const nadjeni = katalog.find(k => k.sifra === stavka.sifra); setTrenutniProizvod(nadjeni || null); const tekstZaPolje = nadjeni ? `${nadjeni.sifra} | ${nadjeni.naziv}` : stavka.sifra; setStavkaForm({ id: stavka.id, sifra_unos: tekstZaPolje, kolicina_unos: stavka.kolicina_unos, jm_unos: stavka.jm_unos, kolicina_obracun: stavka.kolicina_obracun, jm_obracun: stavka.jm_obracun }); window.scrollTo({ top: 300, behavior: 'smooth' }); };
    const ukloniStavku = (id) => { const noveStavke = stavke.filter(s => s.id !== id); setStavke(noveStavke); };

    const otvoriRazradu = async () => {
        setTab('razrada'); const noveTeh = { ...tehnologija };
        for (let s of stavke) {
            if (!noveTeh[s.id] || noveTeh[s.id].length === 0) {
                const { data } = await supabase.from('tehnologija_katalog').select('faze_jsonb, faze').eq('finalna_sifra', s.sifra).maybeSingle();
                
                let dbFaze = data?.faze_jsonb || data?.faze;
                if (typeof dbFaze === 'string') { try { dbFaze = JSON.parse(dbFaze); } catch(e) { dbFaze = []; } }
                
                if (dbFaze && Array.isArray(dbFaze) && dbFaze.length > 0) { 
                    noveTeh[s.id] = dbFaze.map(f => ({ ...f, id: Math.random().toString(), kolicina: f.kolicina || s.kolicina_unos, dimenzija: f.dimenzija || s.dimenzije, jm: f.jm || s.jm_unos })); 
                } 
                else { 
                    noveTeh[s.id] = [{ id: Math.random().toString(), masina: '', dimenzija: s.dimenzije, napomena: '', kolicina: s.kolicina_unos, jm: s.jm_unos, oznake: [] }]; 
                }
            }
        }
        setTehnologija(noveTeh);
    };

    const dodajFazu = (stavkaId) => { const trenutne = tehnologija[stavkaId] || []; setTehnologija({ ...tehnologija, [stavkaId]: [...trenutne, { id: Math.random().toString(), masina: '', dimenzija: '', napomena: '', kolicina: '', jm: 'kom', oznake: [] }] }); };
    const ukloniFazu = (stavkaId, fazaId) => { const trenutne = tehnologija[stavkaId] || []; setTehnologija({ ...tehnologija, [stavkaId]: trenutne.filter(f => f.id !== fazaId) }); };
    const updateFazu = (stavkaId, fazaId, field, value) => { const trenutne = tehnologija[stavkaId] || []; if (field === 'masina') { setTehnologija({ ...tehnologija, [stavkaId]: trenutne.map(f => f.id === fazaId ? { ...f, masina: value, oznake: [] } : f) }); } else { setTehnologija({ ...tehnologija, [stavkaId]: trenutne.map(f => f.id === fazaId ? { ...f, [field]: value } : f) }); } };
    const toggleOznakaUFazi = (stavkaId, fazaId, oznaka) => { const trenutne = tehnologija[stavkaId] || []; setTehnologija({ ...tehnologija, [stavkaId]: trenutne.map(f => { if (f.id === fazaId) { const postojeca = f.oznake || []; const nove = postojeca.includes(oznaka) ? postojeca.filter(x => x !== oznaka) : [...postojeca, oznaka]; return { ...f, oznake: nove }; } return f; })}); };
    const spasiSamoU_Nalog = () => { prikaziDialog({ tip: 'uspjeh', naslov: 'Sačuvano', poruka: "Faze su privremeno sačuvane za ovaj Radni Nalog.", onCancel: zatvoriDialog }); setTab('novi'); };

    const snimiPraviloKaoSablon = async (sifra, faze) => {
        if(faze.length === 0 || !faze[0].masina || !faze[0].dimenzija) return prikaziDialog({ tip: 'upozorenje', naslov: 'Fali Podataka', poruka: "Unesite bar jednu ispravnu fazu prije snimanja šablona!", onCancel: zatvoriDialog });
        const { error } = await supabase.from('tehnologija_katalog').upsert({ finalna_sifra: sifra, faze_jsonb: faze }, { onConflict: 'finalna_sifra' });
        if (error) prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: error.message, onCancel: zatvoriDialog }); 
        else { await zapisiU_Log('KREIRAN_ŠABLON_TEHNOLOGIJE', `Kreiran šablon za proizvod ${sifra}`); prikaziDialog({ tip: 'uspjeh', naslov: 'Šablon Snimljen', poruka: "Trajno pravilo uspješno snimljeno u bazu!", onCancel: zatvoriDialog }); }
    };

    const snimiNalog = async () => {
        if(!form.kupac_naziv) return prikaziDialog({ tip: 'upozorenje', naslov: 'Kupac Obavezan', poruka: "Ime kupca je obavezno!", onCancel: zatvoriDialog });
        if(stavke.length === 0) return prikaziDialog({ tip: 'upozorenje', naslov: 'Nema Stavki', poruka: "Radni nalog mora imati stavke!", onCancel: zatvoriDialog });

        if (form.tip_naloga === 'FAZNI') {
            let imaFaze = false;
            let upozorenjeM3 = 0;
            let prekrsenaStavka = '';
            
            let orgList = [];
            try { if (originalneStavke) orgList = JSON.parse(originalneStavke); } catch(e) { }

            for (let s of stavke) {
                const faze = tehnologija[s.id] || [];
                if (faze.length > 0 && faze[0].masina) {
                    imaFaze = true;
                    const orgStavka = orgList.find(o => o.sifra === s.sifra);
                    if (orgStavka && form.broj_ponude) {
                        const zadnjaFaza = faze[faze.length - 1];
                        const katItem = katalog.find(k => k.sifra === s.sifra) || {};
                        const v = parseFloat(katItem.visina) || 0; const sir = parseFloat(katItem.sirina) || 0; const d = parseFloat(katItem.duzina) || 0;
                        const vol1kom = (v > 0 && sir > 0 && d > 0) ? (v/100) * (sir/100) * (d/100) : 0;
                        const area1kom = (sir > 0 && d > 0) ? (sir/100) * (d/100) : 0;
                        const len1kom = (d > 0) ? (d/100) : 0;

                        let komada = parseFloat(zadnjaFaza.kolicina || 0);
                        const jm = (zadnjaFaza.jm || 'kom').toLowerCase();
                        
                        if (jm === 'm3' && vol1kom > 0) komada = parseFloat(zadnjaFaza.kolicina) / vol1kom;
                        else if (jm === 'm2' && area1kom > 0) komada = parseFloat(zadnjaFaza.kolicina) / area1kom;
                        else if (jm === 'm1' && len1kom > 0) komada = parseFloat(zadnjaFaza.kolicina) / len1kom;

                        let zadnjaFazaM3 = komada * vol1kom;
                        if (jm === 'm3') zadnjaFazaM3 = parseFloat(zadnjaFaza.kolicina);

                        if (zadnjaFazaM3 > parseFloat(orgStavka.kolicina_obracun) + 0.001) {
                            upozorenjeM3 = zadnjaFazaM3;
                            prekrsenaStavka = s.naziv;
                        }
                    }
                }
            }
            if (!imaFaze) {
                return prikaziDialog({ tip: 'upozorenje', naslov: 'Nema faza u BOM', poruka: "Odabrali ste FAZNI nalog, ali niste definisali faze (BOM) ni za jednu stavku!\n\nIdite na tab '🧪 Razrada Tehnologije' i definišite korake i mašine za proizvodnju.", onCancel: zatvoriDialog });
            }

            if (upozorenjeM3 > 0) {
                return prikaziDialog({
                    tip: 'upozorenje',
                    naslov: 'Prekoračenje količine u BOM-u!',
                    poruka: `U fazi razrade tehnologije za "${prekrsenaStavka}", zadnja faza proizvodi ${upozorenjeM3.toFixed(4)} m³, što je VIŠE nego što je naručeno na ponudi!\n\nDa li ste sigurni da želite sačuvati ovaj nalog sa prekomjernom količinom?`,
                    confirmText: '✅ DA, SAČUVAJ',
                    cancelText: '✕ ODUSTANI',
                    onConfirm: () => { zavrsiSnimanjeNaloga(); zatvoriDialog(); },
                    onCancel: zatvoriDialog
                });
            }
        }

        if (!isEditingNalog && form.broj_ponude) {
            const { data: postojece } = await supabase.from('radni_nalozi').select('id').eq('broj_ponude', form.broj_ponude).limit(1);
            if (postojece && postojece.length > 0) {
                return prikaziDialog({ tip: 'greska', naslov: 'Nalog Već Postoji', poruka: `Za ponudu ${form.broj_ponude} je VEĆ KREIRAN RADNI NALOG (${postojece[0].id})!`, onCancel: zatvoriDialog });
            }
        }

        zavrsiSnimanjeNaloga();
    };

    const zavrsiSnimanjeNaloga = async () => {
        let jeModifikovan = false;
        if (form.broj_ponude && originalneStavke) {
            const trenutneSifreIKol = JSON.stringify(stavke.map(s => ({ sifra: s.sifra, kolicina_obracun: parseFloat(s.kolicina_obracun || 0) })));
            if (trenutneSifreIKol !== originalneStavke) {
                jeModifikovan = true;
            }
        }

        const payload = {
            id: form.id.toUpperCase(), broj_ponude: form.broj_ponude, kupac_naziv: form.kupac_naziv, datum: form.datum, rok_isporuke: form.rok_isporuke, napomena: form.napomena,
            stavke_jsonb: stavke, tehnologija_jsonb: form.tip_naloga === 'FAZNI' ? tehnologija : {}, status: form.status, tip_naloga: form.tip_naloga, snimio_korisnik: currentUser.ime_prezime,
            modifikovan: jeModifikovan
        };

        let res; if (isEditingNalog) { res = await supabase.from('radni_nalozi').update(payload).eq('id', form.id); } else { res = await supabase.from('radni_nalozi').insert([payload]); }
        if(res.error) return prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: res.error.message, onCancel: zatvoriDialog });
        
        if (jeModifikovan && form.broj_ponude) {
            await supabase.from('ponude').update({ rn_modifikovan: true }).eq('id', form.broj_ponude);
            await supabase.from('sistem_audit_log').insert([{
                korisnik: currentUser.ime_prezime || 'Pogon',
                akcija: 'TRAŽI_ODOBRENJE_PONUDE',
                detalji: `Radni Nalog ${form.id} je izmijenjen u pogonu i odstupa od Ponude ${form.broj_ponude} (${form.kupac_naziv}). Potrebno odobrenje Admina!`,
                nivo_alarma: 'CRVENO',
                pregledano: false,
                vrijeme: new Date().toISOString()
            }]);
        } else {
            await zapisiU_Log(isEditingNalog ? 'IZMJENA_RN' : 'KREIRAN_RN', `Radni Nalog ${form.id}`);
        }

        prikaziDialog({ tip: 'uspjeh', naslov: 'Uspješno', poruka: isEditingNalog ? "Radni nalog uspješno ažuriran!" : "Radni nalog uspješno kreiran!", onConfirm: zatvoriDialog, onCancel: zatvoriDialog });
        resetFormu(); load(); setTab('lista');
    };

    const zavrsiNalogDirektno = async (n, e) => {
        e.stopPropagation(); 
        const stavkeNaloga = n.stavke_jsonb || [];
        let faliRobe = false;
        let tekstUpozorenja = `Da li ste sigurni da želite označiti nalog ${n.id} kao ZAVRŠEN?`;

        stavkeNaloga.forEach(st => {
            const cilj = parseFloat(st.kolicina_obracun || st.kolicina_unos || 0);
            const uradjeno = parseFloat(st.napravljeno || 0);
            if (uradjeno < cilj) { faliRobe = true; }
        });

        if (faliRobe) {
            tekstUpozorenja = `⚠️ UPOZORENJE ZA PROIZVODNJU:\nNeki proizvodi u nalogu ${n.id} NISU u potpunosti izrezani (urađena količina na lageru je manja od naručene)!\n\nDa li ste sigurni da želite prisilno ZAVRŠITI ovaj nalog?`;
        }

        prikaziDialog({
            tip: faliRobe ? 'upozorenje' : 'info',
            naslov: 'Završavanje Naloga',
            poruka: tekstUpozorenja,
            confirmText: '🏁 DA, ZAVRŠI',
            cancelText: '✕ ODUSTANI',
            onConfirm: async () => {
                const { error } = await supabase.from('radni_nalozi').update({ status: 'ZAVRŠENO' }).eq('id', n.id);
                if (error) {
                    prikaziDialog({ tip: 'greska', naslov: 'Greška baze', poruka: error.message, onCancel: zatvoriDialog });
                } else {
                    await zapisiU_Log('ZAVRŠEN_RN_DIREKTNO', `Radni Nalog ${n.id} označen kao završen direktno sa pločice.`);
                    load();
                    prikaziDialog({ tip: 'uspjeh', naslov: 'Uspješno', poruka: `Radni nalog ${n.id} je prebačen u završene!`, onCancel: zatvoriDialog });
                }
            },
            onCancel: zatvoriDialog
        });
    };

    const potvrdiBrisanjeNaloga = async () => {
        if (!razlogBrisanja.trim()) {
            return prikaziDialog({ tip: 'upozorenje', naslov: 'Razlog obavezan', poruka: "Morate unijeti razlog brisanja radnog naloga!", onCancel: zatvoriDialog });
        }
        const { error } = await supabase.from('radni_nalozi').update({ status: 'OBRISANO' }).eq('id', brisanjeNaloga.id);
        if (error) {
            return prikaziDialog({ tip: 'greska', naslov: 'Greška baze', poruka: error.message, onCancel: zatvoriDialog });
        }
        
        await zapisiU_Log('OBRISAN_RADNI_NALOG', `Korisnik je obrisao Radni Nalog ${brisanjeNaloga.id}. Razlog: ${razlogBrisanja}`);
        
        setBrisanjeNaloga(null);
        setRazlogBrisanja('');
        load();
        prikaziDialog({ tip: 'uspjeh', naslov: 'Nalog Obrisan', poruka: `Radni nalog ${brisanjeNaloga.id} je uspješno uklonjen iz prikaza.`, onCancel: zatvoriDialog });
    };

    const pokreniIzmjenuNaloga = async (n) => { 
        try {
            setForm({ id: n.id, broj_ponude: n.broj_ponude || '', kupac_naziv: n.kupac_naziv, datum: n.datum, rok_isporuke: n.rok_isporuke || '', napomena: n.napomena || '', status: n.status || 'U PROIZVODNJI', tip_naloga: n.tip_naloga || 'OBIČNI' }); 
            
            let currentKatalog = katalog;
            if (!currentKatalog || currentKatalog.length === 0) {
                const { data } = await supabase.from('katalog_proizvoda').select('*');
                currentKatalog = data || [];
                setKatalog(currentKatalog);
            }

            let loadedStavke = n.stavke_jsonb || n.stavke || [];
            if (typeof loadedStavke === 'string') { try { loadedStavke = JSON.parse(loadedStavke); } catch(e) { loadedStavke = []; } }
            if (!Array.isArray(loadedStavke)) { loadedStavke = typeof loadedStavke === 'object' && loadedStavke !== null ? Object.values(loadedStavke) : []; }

            const safeStavke = loadedStavke.map((s, i) => ({ ...s, id: s.id || `stavka_${i}` }));

            let loadedTeh = n.tehnologija_jsonb || n.tehnologija || {};
            if (typeof loadedTeh === 'string') { try { loadedTeh = JSON.parse(loadedTeh); } catch(e) { loadedTeh = {}; } }

            const safeTeh = {};
            if (Array.isArray(loadedTeh)) {
                safeStavke.forEach((s, i) => {
                    safeTeh[s.id] = i === 0 ? loadedTeh.map((f, fi) => ({ ...f, id: f.id || `faza_${fi}` })) : [];
                });
            } else {
                safeStavke.forEach((s, i) => {
                    let faze = loadedTeh[s.id];
                    if (!faze || faze.length === 0) faze = loadedTeh[s.sifra];
                    if (!faze || faze.length === 0) {
                        const keys = Object.keys(loadedTeh);
                        if (keys.length > i) faze = loadedTeh[keys[i]];
                    }
                    if (!Array.isArray(faze)) faze = [];
                    
                    safeTeh[s.id] = faze.map((f, fi) => ({ ...f, id: f.id || `faza_${fi}` }));
                });
            }

            if (n.broj_ponude) {
                const { data: ponuda } = await supabase.from('ponude').select('stavke_jsonb, stavke').eq('id', n.broj_ponude).maybeSingle();
                let ponudaStavke = ponuda?.stavke_jsonb || ponuda?.stavke || [];
                if (typeof ponudaStavke === 'string') { try { ponudaStavke = JSON.parse(ponudaStavke); } catch(e) { ponudaStavke = []; } }
                if (!Array.isArray(ponudaStavke)) { ponudaStavke = typeof ponudaStavke === 'object' && ponudaStavke !== null ? Object.values(ponudaStavke) : []; }

                const org = ponudaStavke.map(s => {
                    const katItem = currentKatalog.find(k => k.sifra === s.sifra) || {};
                    const v = parseFloat(katItem.visina) || 0; const sir = parseFloat(katItem.sirina) || 0; const d = parseFloat(katItem.duzina) || 0;
                    const vol1kom = (v > 0 && sir > 0 && d > 0) ? (v/100) * (sir/100) * (d/100) : 0;
                    
                    const unosKol = parseFloat(s.kolicina_unos !== undefined ? s.kolicina_unos : s.kolicina) || 0; 
                    const jmUnos = (s.jm_unos || s.jm || 'kom').toLowerCase();
                    
                    let obracunM3 = parseFloat(s.kolicina_obracun || 0);
                    if (jmUnos === 'kom' && vol1kom > 0 && Math.abs(obracunM3 - unosKol) < 0.01) {
                        obracunM3 = unosKol * vol1kom;
                    }
                    return { sifra: s.sifra, kolicina_obracun: obracunM3 > 0 ? parseFloat(obracunM3.toFixed(4)) : 0 };
                });
                setOriginalneStavke(JSON.stringify(org));
            } else {
                setOriginalneStavke(null);
            }

            setStavke(safeStavke);
            setTehnologija(safeTeh);
            setIsEditingNalog(true); 
            setTab('novi'); 
            window.scrollTo({ top: 0, behavior: 'smooth' }); 
        } catch (error) {
            prikaziDialog({ tip: 'greska', naslov: 'Kritična Greška', poruka: error.message, onCancel: zatvoriDialog });
        }
    };

    const kreirajPDF = async () => {
        if (form.tip_naloga === 'FAZNI') {
            printRadniNalogSveFaze({...form, stavke_jsonb: stavke, tehnologija_jsonb: tehnologija});
        } else {
            printDirektnoIzListe({...form, stavke_jsonb: stavke}, {stopPropagation: ()=>{}});
        }
    };

    const printRadniNalogZaMasinu = (rn, masinaIme) => {
        const stariNaslov = document.title; document.title = `faza_${masinaIme}_${rn.id}`;
        let redovi = ''; let brojac = 1;
        
        (rn.stavke_jsonb || []).forEach(s => {
            const faze = rn.tehnologija_jsonb?.[s.id] || [];
            const fazaIndex = faze.findIndex(f => f.masina === masinaIme);
            if (fazaIndex !== -1) {
                const fazaZaMasinu = faze[fazaIndex];
                const naredneFaze = faze.slice(fazaIndex + 1).map((f, i) => `<span style="background: #f1f5f9; padding: 2px 4px; border-radius: 4px; border: 1px solid #cbd5e1;">${i+1}. ${f.masina}</span>`).join(' ➔ ');
                const naredneHtml = naredneFaze ? `<div style="margin-top: 6px; font-size: 10px; color: #475569;"><b>Naredne faze:</b> ${naredneFaze}</div>` : '<div style="margin-top: 6px; font-size: 10px; color: #10b981; font-weight: bold;">Ovo je zadnja faza obrade.</div>';
                
                redovi += `
                    <tr>
                        <td style="text-align:center; vertical-align: top; padding: 8px;">${brojac++}.</td>
                        <td style="vertical-align: top; padding: 8px;"><b>${s.sifra}</b> - <span style="color: #475569;">${s.naziv}</span>${naredneHtml}</td>
                        <td style="text-align:center; font-weight:900; color:#d97706; vertical-align: top; padding: 8px; font-size: 14px;">${fazaZaMasinu.dimenzija || s.dimenzije} cm</td>
                        <td style="text-align:center; font-weight:900; vertical-align: top; padding: 8px; font-size: 14px;">${fazaZaMasinu.kolicina} <span style="font-size: 10px;">${fazaZaMasinu.jm || 'kom'}</span></td>
                        <td style="vertical-align: top; padding: 8px; font-size: 11px;"><b>${fazaZaMasinu.oznake?.join(', ') || ''}</b><br/><i>${fazaZaMasinu.napomena || '-'}</i></td>
                    </tr>
                `;
            }
        });

        const html = `
            <div style="border:3px solid #d97706; padding:20px; border-radius:15px; margin-bottom: 20px;">
                <h2 style="margin-top: 0; color: #d97706;">POGONSKI REZNI NALOG (FAZA: ${masinaIme.toUpperCase()})</h2>
                <p style="font-size: 16px;">Glavni Nalog: <b style="font-size: 20px;">${rn.id}</b> | Kupac: <b style="font-size: 20px;">${rn.kupac_naziv}</b></p>
                <p>Rok isporuke: <b>${formatirajDatum(rn.rok_isporuke)}</b></p>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f1f5f9; text-transform: uppercase; font-size: 11px; color: #475569;">
                        <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">R.B.</th><th style="padding: 8px; border-bottom: 2px solid #cbd5e1; text-align: left;">Artikal i Naredne Faze</th><th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">Radna Dimenzija (cm)</th><th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">Količina</th><th style="padding: 8px; border-bottom: 2px solid #cbd5e1; text-align: left;">Uputstvo / Oznake</th>
                    </tr>
                </thead>
                <tbody>${redovi}</tbody>
            </table>
        `;
        printDokument(`FAZA_${masinaIme}`, rn.id, rn.datum, html, '#d97706');
        setTimeout(() => { document.title = stariNaslov; }, 2000);
    };

    const printRadniNalogSveFaze = (rn) => {
        const stariNaslov = document.title; document.title = `bom_karta_${rn.id}`;
        let sadrzaj = '';
        (rn.stavke_jsonb || []).forEach(s => {
            let fRedovi = (rn.tehnologija_jsonb?.[s.id] || []).map((f, idx) => `<tr><td>${idx+1}. korak</td><td><b>${f.masina}</b></td><td>${f.dimenzija} cm</td><td>${f.kolicina} ${f.jm || 'kom'}</td><td>${f.napomena || '-'}</td></tr>`).join('');
            sadrzaj += `<div style="margin-bottom:30px; border:1px solid #cbd5e1; padding:15px; border-radius:8px;"><h4 style="margin:0 0 10px 0; color:#a855f7;">PROIZVOD: ${s.sifra} - ${s.naziv} (Ukupno: ${s.kolicina_obracun} ${s.jm_obracun || 'm3'})</h4><table><thead><tr><th>Korak</th><th>Mašina / Lokacija</th><th>Radna Dimenzija (cm)</th><th>Količina</th><th>Napomena</th></tr></thead><tbody>${fRedovi}</tbody></table></div>`;
        });
        const html = `<h2>TEHNOLOŠKA BOM KARTA NALOGA: ${rn.id}</h2><p>Kupac: <b>${rn.kupac_naziv}</b> | Datum: ${formatirajDatum(rn.datum)}</p>${sadrzaj}`;
        printDokument('BOM KARTA', rn.id, rn.datum, html, '#a855f7');
        setTimeout(() => { document.title = stariNaslov; }, 2000);
    };

    const printDirektnoIzListe = async (rn, e) => {
        e.stopPropagation();
        const stariNaslov = document.title;
        const cistiKupac = (rn.kupac_naziv || 'Interno').replace(/\s+/g, '_');
        document.title = `radni_nalozi_${rn.id}_${cistiKupac}`;
        
        let redovi = (rn.stavke_jsonb || []).map((s, i) => `
            <tr>
                <td style="font-weight: bold; color: #64748b; text-align: center;">${i+1}.</td>
                <td><b style="color: #0f172a; font-size: 14px;">${s.sifra}</b><br/><span style="color: #64748b; font-size: 11px;">${s.naziv} ${s.dimenzije ? `(${s.dimenzije} cm)` : ''}</span></td>
                <td style="text-align: center; font-weight: 800; color: #0f172a; font-size: 16px;">${s.kolicina_obracun || s.kolicina_unos} <span style="color: #64748b; font-size: 11px; font-weight: 600;">${s.jm_obracun || 'm3'}</span></td>
                <td style="text-align: center; font-weight: 600; color: #475569;">${s.kolicina_unos} <span style="font-size: 10px;">${s.jm_unos || 'kom'}</span></td>
            </tr>
        `).join('');

        const htmlSadrzaj = `<div class="info-grid"><div class="info-col"><h4>Naručilac / Kupac</h4><p style="font-size: 18px; font-weight: 900; margin-bottom: 5px;">${rn.kupac_naziv || 'Interni Nalog'}</p></div><div class="info-col" style="text-align: right;"><h4>Detalji Naloga</h4><p>Datum izdavanja: <span style="font-weight: 400; color: #475569;">${formatirajDatum(rn.datum)}</span></p><p style="color: #a855f7; margin-top: 8px; font-weight: 800;">Rok isporuke: ${formatirajDatum(rn.rok_isporuke)}</p></div></div><table><thead><tr><th style="width: 5%; text-align: center;">R.B.</th><th>Šifra, Naziv i Dimenzije (cm)</th><th style="text-align:center;">Proizvesti (Cilj)</th><th style="text-align:center;">Norma / Ulaz</th></tr></thead><tbody>${redovi}</tbody></table><div class="footer"><div style="width: 60%;"><b style="color: #0f172a;">Glavna napomena za proizvodnju:</b><br/>${rn.napomena || 'Nema dodatnih napomena.'}</div><div style="text-align: right; width: 30%;"><div style="border-bottom: 1px solid #cbd5e1; margin-bottom: 5px; height: 40px;"></div>Potpis Rukovodioca Proizvodnje</div></div>`;
        printDokument('RADNI NALOG', rn.id, formatirajDatum(rn.datum), htmlSadrzaj, '#a855f7');
        setTimeout(() => { document.title = stariNaslov; }, 2000);
    };

    const renderPoljeHeader = (polje) => {
        if (polje.id === 'ponuda') return <input value={form.broj_ponude} onChange={e => setForm({...form, broj_ponude: e.target.value.toUpperCase()})} className="w-full h-full min-h-[45px] p-3.5 bg-theme-card rounded-xl text-theme-text outline-none border border-theme-border uppercase focus:border-purple-500 shadow-inner" placeholder="Npr. PON-2026..." />;
        if (polje.id === 'broj') return <input value={form.id} disabled className="w-full h-full min-h-[45px] p-3.5 bg-theme-panel rounded-xl text-theme-text border border-theme-border font-black disabled:opacity-50" />;
        if (polje.id === 'kupac') return <div className="h-full min-h-[45px]"><MasterSearch data={kupci} poljaZaPretragu={['naziv']} value={form.kupac_naziv} onSelect={k => setForm({...form, kupac_naziv: k.naziv})} placeholder="Odaberi kupca..." /></div>;
        if (polje.id === 'datum') return <input type="date" value={form.datum} onChange={e=>setForm({...form, datum:e.target.value})} className="w-full h-full min-h-[45px] p-3.5 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border font-black outline-none shadow-inner" />;
        if (polje.id === 'rok') return <input type="date" value={form.rok_isporuke} onChange={e=>setForm({...form, rok_isporuke: e.target.value})} className="w-full h-full min-h-[45px] p-3.5 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none shadow-inner" />;
        if (polje.id === 'status') return <select value={form.status} onChange={e=>setForm({...form, status: e.target.value})} className="w-full h-full min-h-[45px] p-3.5 bg-theme-panel rounded-xl text-theme-accent font-black border border-purple-500/50 uppercase outline-none"><option value="U PROIZVODNJI">U proizvodnji</option><option value="ZAVRŠENO">Završeno</option></select>;
        return null;
    };

    const formatirajDatum = (isoString) => { if(!isoString) return ''; const [y, m, d] = isoString.split('-')[0].length === 4 ? isoString.split('-') : isoString.split('T')[0].split('-'); return `${d}.${m}.${y}.`; };
    const resetFormu = () => { setForm({ id: generisiID(), broj_ponude: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0], rok_isporuke: '', napomena: '', status: 'U PROIZVODNJI', tip_naloga: 'OBIČNI' }); setStavke([]); setOriginalneStavke(null); setSkenerInput(''); setIsEditingNalog(false); setTehnologija({}); };

    const naloziZaPrikaz = nalozi.filter(n => n.status !== 'OBRISANO' && (
        (subTab === 'U PROIZVODNJI' && n.status === 'U PROIZVODNJI') ||
        (subTab === 'ZAVRŠENO' && n.status === 'ZAVRŠENO') ||
        (subTab === 'NA ČEKANJU' && n.status !== 'U PROIZVODNJI' && n.status !== 'ZAVRŠENO')
    ));

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6 font-bold animate-in fade-in pb-20">
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-purple-500" user={user} modulIme="radni_nalog" saas={saas} hideMasina={true} />
            <PametniDialog {...dialog} />

            {brisanjeNaloga && (
                <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-theme-card border border-red-500 p-6 rounded-[2.5rem] shadow-2xl max-w-sm w-full relative">
                        <button onClick={() => {setBrisanjeNaloga(null); setRazlogBrisanja('');}} className="absolute top-4 right-4 bg-slate-800 text-slate-400 hover:text-theme-text hover:bg-red-500 w-8 h-8 rounded-box font-black flex items-center justify-center transition-all">✕</button>
                        <h3 className="text-red-400 font-black uppercase text-sm mb-4 border-b border-theme-border pb-3">🗑️ Brisanje Radnog Naloga</h3>
                        <div className="mb-4 text-xs text-slate-300">
                            <p className="mb-2">Da li ste sigurni da želite obrisati radni nalog <b className="text-white">{brisanjeNaloga.id}</b>?</p>
                            <p className="text-red-400 font-bold mb-4">Nalog neće biti trajno izbrisan iz baze podataka (ostaće sačuvan u arhivi), ali će biti uklonjen sa svih ekrana za proizvodnju.</p>
                            <label className="text-[10px] text-slate-400 uppercase font-black mb-2 block">Obavezan razlog brisanja (za Superadmina):</label>
                            <textarea 
                                value={razlogBrisanja} 
                                onChange={e => setRazlogBrisanja(e.target.value)} 
                                placeholder="Npr. Pogrešno unesene dimenzije, pogrešan unos..." 
                                className="w-full p-3 bg-theme-panel border border-red-500/50 rounded-xl text-theme-text outline-none focus:border-red-400 text-xs"
                                rows="3"
                            ></textarea>
                        </div>
                        <button onClick={potvrdiBrisanjeNaloga} className="w-full py-4 bg-red-600 text-white font-black rounded-xl text-xs uppercase shadow-lg hover:bg-red-500 transition-all border border-red-400">🚨 Potvrdi Brisanje</button>
                    </div>
                </div>
            )}

            <div className="flex bg-theme-panel p-1.5 rounded-2xl border border-theme-border shadow-inner">
                <button onClick={() => setTab('novi')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase font-black transition-all ${tab === 'novi' ? 'bg-theme-accent text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-theme-text'}`}>➕ Glavni Nalog</button>
                <button onClick={otvoriRazradu} className={`flex-1 py-3 rounded-xl text-[10px] uppercase font-black transition-all ${tab === 'razrada' ? 'bg-theme-accent text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-theme-text'}`}>🧪 Razrada Tehnologije</button>
                <button onClick={() => setTab('lista')} className={`flex-1 py-3 rounded-xl text-[10px] uppercase font-black transition-all ${tab === 'lista' ? 'bg-theme-accent text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-theme-text'}`}>📋 Arhiva Radnih Naloga</button>
            </div>
            
            {tab === 'novi' && (
                <div className="space-y-4 animate-in slide-in-from-left max-w-4xl mx-auto">
                    {!isEditingNalog && (
                        <div className="bg-theme-card border border-blue-500/50 p-6 rounded-box shadow-2xl relative z-[60]" style={{ backgroundColor: saas.ui.boja_kartice }}>
                            <label className="text-[10px] text-theme-accent uppercase font-black block mb-2 ml-2">Učitaj podatke iz ponude</label>
                            <RN_SearchablePonuda ponude={aktivnePonude} value={skenerInput} onChange={handlePonudaInput} onScanClick={() => setIsScanning(true)} />
                        </div>
                    )}

                    <div className={`p-6 rounded-box border-2 shadow-2xl space-y-4 transition-all relative z-[40] ${saas.isEditMode ? 'border-dashed border-amber-500 bg-black/20' : 'border-purple-500/30 bg-theme-card'}`} style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <div className="flex justify-between items-center mb-4 pb-4 border-b border-theme-border/50">
                            <div>
                                <h3 className="text-theme-accent font-black uppercase text-xs">1. Parametri Radnog Naloga</h3>
                                <div className="mt-3 flex flex-col md:flex-row md:items-center gap-3">
                                    <span className="text-[10px] text-slate-400 uppercase font-black">Vrsta proizvodnje:</span>
                                    <div className="flex bg-theme-card rounded-lg p-1 border border-theme-border">
                                        <button onClick={() => setForm({...form, tip_naloga: 'OBIČNI'})} className={`px-4 py-2 rounded-md text-[10px] font-black uppercase transition-all ${form.tip_naloga === 'OBIČNI' ? 'bg-theme-card text-theme-text shadow-md' : 'text-slate-500 hover:text-theme-text'}`}>Obična (Direktna)</button>
                                        <button onClick={() => setForm({...form, tip_naloga: 'FAZNI'})} className={`px-4 py-2 rounded-md text-[10px] font-black uppercase transition-all ${form.tip_naloga === 'FAZNI' ? 'bg-amber-500 text-black shadow-md' : 'text-slate-500 hover:text-theme-text'}`}>Fazna (BOM)</button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 self-start items-end">
                                <div className="flex gap-2">
                                    {isEditingNalog && <button onClick={kreirajPDF} className="text-[10px] bg-theme-panel text-theme-text border border-slate-600 px-4 py-2 rounded-xl uppercase hover:bg-white hover:text-black transition-all shadow-md font-black">🖨️ Isprintaj PDF</button>}
                                    {isEditingNalog && <button onClick={resetFormu} className="text-[10px] bg-red-900/30 text-red-400 px-3 py-2 rounded-xl uppercase hover:bg-red-900/50">Odustani ✕</button>}
                                </div>
                            </div>
                        </div>
                        
                        {/* 🟢 POPRAVLJENO ZAGLAVLJE: min-h-[48px] umjesto h-12 i aktivirane God Mode kontrole */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-start">
                            {aktivnaPolja.map((polje, index) => {
                                const responsiveSpan = polje.span === 'col-span-4' ? 'col-span-1 sm:col-span-2 md:col-span-4' : (polje.span === 'col-span-2' ? 'col-span-1 sm:col-span-2' : 'col-span-1');
                                return (
                                    <div 
                                        key={polje.id} 
                                        className={`relative ${responsiveSpan} flex flex-col w-full transition-all ${saas.isEditMode ? 'border-2 border-dashed border-amber-500 p-2 rounded-xl bg-black/20 resize overflow-auto' : ''}`}
                                        style={{ maxWidth: '100%', ...(saas.isEditMode ? { minWidth: '100px', minHeight: '80px', width: polje.customWidth || undefined, height: polje.customHeight || undefined } : {}) }}
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
                                            polje.label && <label className="text-[9px] text-slate-500 uppercase block mb-1 ml-1 shrink-0">{polje.label}</label>
                                        )}
                                        <div className={`min-h-[48px] w-full flex-1 ${saas.isEditMode ? 'opacity-50 pointer-events-none' : ''}`}>{renderPoljeHeader(polje)}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-theme-card p-6 rounded-box border border-theme-border space-y-4 shadow-xl relative z-[30]" style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <h3 className="text-theme-accent uppercase text-xs">2. Dodaj proizvode u nalog (dimenzije u cm)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            <div className="md:col-span-12">
                                <RN_SearchableProizvod katalog={katalog} value={stavkaForm.sifra_unos} onChange={handleProizvodSelect} />
                            </div>
                            
                            <div className="md:col-span-5">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Količina i Jedinica (Unos)</label>
                                <div className="flex gap-1">
                                    <input type="number" value={stavkaForm.kolicina_unos} onChange={e=>setStavkaForm({...stavkaForm, kolicina_unos:e.target.value})} placeholder="Kol." className="w-1/2 min-w-0 p-4 bg-theme-panel rounded-xl text-lg text-theme-text font-black text-center border border-theme-border outline-none focus:border-purple-500" />
                                    <select value={stavkaForm.jm_unos} onChange={e=>setStavkaForm({...stavkaForm, jm_unos:e.target.value})} className="w-1/2 min-w-0 p-4 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none cursor-pointer uppercase">
                                        <option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="md:col-span-5">
                                <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Količina (Proizvesti / Cilj)</label>
                                <div className="flex gap-1">
                                    <input type="number" value={stavkaForm.kolicina_obracun} onChange={e=>setStavkaForm({...stavkaForm, kolicina_obracun:e.target.value})} className="w-1/2 min-w-0 p-4 bg-purple-900/20 rounded-xl text-lg text-purple-400 font-black text-center border border-purple-500/50 outline-none focus:border-purple-400 shadow-inner" />
                                    <select value={stavkaForm.jm_obracun} onChange={e=>setStavkaForm({...stavkaForm, jm_obracun:e.target.value})} className="w-1/2 min-w-0 p-4 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none cursor-pointer uppercase">
                                        <option value="m3">m³</option><option value="kom">kom</option><option value="m2">m²</option><option value="m1">m1</option>
                                    </select>
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <button onClick={dodajStavku} className="w-full h-[58px] bg-theme-accent text-white p-4 rounded-xl font-black hover:opacity-80 shadow-lg transition-all flex items-center justify-center">DODAJ +</button>
                            </div>
                        </div>
                    </div>

                    {stavke.length > 0 && (
                        <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-purple-500/30 shadow-2xl animate-in slide-in-from-bottom" style={{ backgroundColor: saas.ui.boja_kartice }}>
                            <div className="flex justify-between items-center mb-4"><h3 className="text-theme-accent font-black uppercase text-xs">3. Pregled stavki naloga</h3></div>
                            <div className="space-y-3 mb-6">
                                {stavke.map((s, i) => (
                                    <div key={s.id} onClick={() => urediStavku(s)} className="flex justify-between items-center p-4 bg-theme-card border border-theme-border rounded-xl cursor-pointer hover:border-purple-500 transition-all group shadow-md">
                                        <div className="flex items-center gap-4">
                                            <span className="text-slate-500 text-sm font-black">{i+1}.</span>
                                            <div>
                                                <p className="text-theme-text text-sm font-black">{s.naziv}</p>
                                                <p className="text-xs text-blue-300 font-bold mt-1 tracking-wider uppercase">ŠIFRA: {s.sifra} {s.dimenzije && <span className="ml-2 text-amber-500">| DIM: {s.dimenzije} cm</span>}</p>
                                            </div>
                                        </div>
                                        <div className="text-right flex items-center gap-4">
                                            <div>
                                                <p className="text-theme-accent text-2xl font-black tracking-widest">{s.kolicina_obracun} <span className="text-xs">{s.jm_obracun}</span></p>
                                                <p className="text-[10px] text-slate-400 uppercase mt-1 font-bold">Unos: {s.kolicina_unos} {s.jm_unos}</p>
                                            </div>
                                            <button onClick={(e)=>{e.stopPropagation(); ukloniStavku(s.id);}} className="text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 p-2 rounded-lg transition-all font-black">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <textarea value={form.napomena} onChange={e=>setForm({...form, napomena:e.target.value})} placeholder="Uputa za radnike..." className="w-full mt-4 p-4 bg-theme-card border border-theme-border rounded-xl text-xs text-theme-text outline-none focus:border-purple-500 shadow-inner" rows="3"></textarea>
                            <button onClick={snimiNalog} className="w-full mt-4 py-6 bg-purple-600 text-white font-black rounded-xl uppercase text-sm shadow-xl hover:bg-purple-500 tracking-widest">🏁 SPREMI I PROSLIJEDI RADNI NALOG</button>
                        </div>
                    )}
                </div>
            )}

            {tab === 'razrada' && (
                <div className="space-y-6 animate-in slide-in-from-right max-w-4xl mx-auto">
                    {form.tip_naloga === 'OBIČNI' ? (
                        <div className="bg-theme-card border border-amber-500/50 p-10 rounded-box text-center shadow-2xl"><span className="text-5xl block mb-4">ℹ️</span><h2 className="text-xl text-amber-400 font-black uppercase">Obična Proizvodnja</h2><p className="text-slate-400 mt-3 text-sm">Ovaj nalog je označen kao "Obični". Da biste definisali faze, promijenite tip u <b className="text-amber-500">"Fazna (BOM)"</b>.</p><button onClick={() => setTab('novi')} className="mt-6 bg-theme-panel hover:bg-white hover:text-black text-slate-300 px-6 py-3 rounded-xl font-black uppercase transition-all border border-slate-600">← Nazad na nalog</button></div>
                    ) : (
                        <div className="bg-theme-card p-6 rounded-box border border-theme-border space-y-6" style={{ backgroundColor: saas.ui.boja_kartice }}>
                            <h3 className="text-amber-500 font-black uppercase text-sm mb-2">🧪 VIŠEFAZNA TEHNOLOŠKA RAZRADA (BOM - Sve dimenzije u cm)</h3>
                            <div className="space-y-8">
                                {stavke.map(s => {
                                    const faze = tehnologija[s.id] || [];
                                    
                                    let orgList = [];
                                    try { if (originalneStavke) orgList = JSON.parse(originalneStavke); } catch(e) {}
                                    const orgStavka = orgList.find(o => o.sifra === s.sifra);

                                    return (
                                        <div key={s.id} className="bg-theme-panel p-4 md:p-6 rounded-2xl border border-theme-border space-y-4">
                                            <div className="flex justify-between items-center border-b border-theme-border pb-3"><div><span className="text-slate-400 text-[10px] block font-black uppercase mb-1">Ciljni proizvod:</span><span className="text-theme-accent text-base font-black">{s.sifra} - {s.naziv}</span></div><div className="text-right"><span className="text-slate-500 text-[10px] block uppercase">Količina:</span><span className="text-theme-text font-black text-xl">{s.kolicina_unos} <span className="text-sm text-slate-400">{s.jm_unos}</span></span></div></div>
                                            <div className="space-y-3">
                                                {faze.map((faza, index) => {
                                                    const odabranaMasinaObj = masineList.find(m => m.naziv === faza.masina);
                                                    const dostupneOznake = odabranaMasinaObj?.atributi_paketa || [];
                                                    const isZadnja = index === faze.length - 1;
                                                    
                                                    let visualWarning = false;
                                                    if (isZadnja && orgStavka && form.broj_ponude) {
                                                        const katItem = katalog.find(k => k.sifra === s.sifra) || {};
                                                        const v = parseFloat(katItem.visina) || 0; const sir = parseFloat(katItem.sirina) || 0; const d = parseFloat(katItem.duzina) || 0;
                                                        const vol1kom = (v > 0 && sir > 0 && d > 0) ? (v/100) * (sir/100) * (d/100) : 0;
                                                        const area1kom = (sir > 0 && d > 0) ? (sir/100) * (d/100) : 0;
                                                        const len1kom = (d > 0) ? (d/100) : 0;

                                                        let komada = parseFloat(faza.kolicina || 0);
                                                        const jm = (faza.jm || 'kom').toLowerCase();
                                                        
                                                        if (jm === 'm3' && vol1kom > 0) komada = parseFloat(faza.kolicina) / vol1kom;
                                                        else if (jm === 'm2' && area1kom > 0) komada = parseFloat(faza.kolicina) / area1kom;
                                                        else if (jm === 'm1' && len1kom > 0) komada = parseFloat(faza.kolicina) / len1kom;

                                                        let zadnjaFazaM3 = komada * vol1kom;
                                                        if (jm === 'm3') zadnjaFazaM3 = parseFloat(faza.kolicina);

                                                        if (zadnjaFazaM3 > parseFloat(orgStavka.kolicina_obracun) + 0.001) visualWarning = true;
                                                    }

                                                    return (
                                                        <div key={faza.id} className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end p-5 rounded-2xl border relative group ${visualWarning ? 'bg-red-950/20 border-red-500/50' : 'bg-black/30 border-theme-border'}`}>
                                                            <div className="absolute -left-3 -top-3 w-6 h-6 bg-amber-500 text-black font-black text-[10px] flex items-center justify-center rounded-box border-2 border-slate-900 z-10">{index + 1}</div>
                                                            <div className="lg:col-span-3 w-full"><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Mašina</label><select value={faza.masina || ''} onChange={e=>updateFazu(s.id, faza.id, 'masina', e.target.value)} className="w-full p-3 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none font-bold uppercase cursor-pointer"><option value="">Odaberi mašinu...</option>{masineList.map(m => <option key={m.naziv} value={m.naziv}>{m.naziv}</option>)}</select></div>
                                                            <div className="lg:col-span-3 w-full"><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Ulazna dimenzija (cm)</label><input value={faza.dimenzija || ''} onChange={e=>updateFazu(s.id, faza.id, 'dimenzija', e.target.value)} placeholder="npr. 5x16x400 cm" className="w-full p-3 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none font-black uppercase" /></div>
                                                            <div className="lg:col-span-3 w-full"><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Količina</label><div className="flex gap-1"><input type="number" value={faza.kolicina || ''} onChange={e=>updateFazu(s.id, faza.id, 'kolicina', e.target.value)} className="flex-1 min-w-0 p-3 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none font-black text-center" /><select value={faza.jm || 'kom'} onChange={e=>updateFazu(s.id, faza.id, 'jm', e.target.value)} className="w-16 shrink-0 p-3 bg-theme-panel rounded-xl text-[10px] text-theme-text border border-theme-border outline-none cursor-pointer uppercase"><option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option></select></div>
                                                            {visualWarning && <p className="text-red-400 text-[9px] mt-1 font-black text-center animate-pulse">⚠️ Više od ponude!</p>}
                                                            </div>
                                                            <div className="lg:col-span-2 w-full"><label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Napomena</label><input value={faza.napomena || ''} onChange={e=>setTehnologija({...tehnologija, [s.id]: tehnologija[s.id].map(f=>f.id===faza.id?{...f, napomena: e.target.value}:f)})} placeholder="Uputstvo..." className="w-full p-3 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none" /></div>
                                                            <div className="lg:col-span-1 w-full flex items-center justify-end"><button onClick={() => ukloniFazu(s.id, faza.id)} className="w-full bg-red-900/30 text-red-500 p-3 rounded-xl font-black hover:bg-red-500 hover:text-white transition-all border border-red-500/20">✕</button></div>
                                                            {dostupneOznake.length > 0 && (
                                                                <div className="col-span-full mt-2 bg-theme-panel p-3 rounded-xl border border-theme-border"><label className="text-[10px] text-slate-500 uppercase block mb-2 font-black ml-1">Opcije obrade za ovu fazu:</label><div className="flex flex-wrap gap-2">{dostupneOznake.map(o => { const isSelected = faza.oznake?.includes(o); return ( <button key={o} onClick={() => toggleOznakaUFazi(s.id, faza.id, o)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all border ${isSelected ? 'bg-amber-600 border-amber-400 text-white shadow-lg' : 'bg-theme-panel border-theme-border text-slate-400 hover:bg-slate-700'}`}>{isSelected ? '✓ ' : '+ '} {o}</button> )})}</div></div>
                                                            )}
                                                        </div>
                                                    )})}
                                            </div>
                                            <div className="flex flex-col md:flex-row justify-between items-center mt-2 border-t border-theme-border pt-4 gap-3"><button onClick={() => dodajFazu(s.id)} className="text-[10px] text-amber-500 font-black uppercase hover:bg-amber-500/10 px-4 py-2 rounded-xl transition-all border border-amber-500/30 w-full md:w-auto">+ Dodaj korak obrade</button><div className="flex gap-2 w-full md:w-auto"><button onClick={spasiSamoU_Nalog} className="flex-1 px-4 py-3 bg-theme-panel text-theme-text rounded-xl text-[10px] uppercase font-black hover:bg-slate-700 border border-slate-600 transition-all">Sačuvaj u Nalog</button><button onClick={() => snimiPraviloKaoSablon(s.sifra, faze)} className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl text-[10px] uppercase font-black hover:bg-emerald-500 transition-all border border-emerald-400">💾 Snimi kao Šablon</button></div></div>
                                        </div>
                                    )})}
                            </div>
                            <button onClick={snimiNalog} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl uppercase tracking-wider text-xs transition-all">Sačuvaj sve sa tehnološkim koracima 💾</button>
                        </div>
                    )}
                </div>
            )}

            {tab === 'lista' && (
                <div className="bg-theme-card p-6 rounded-box border border-theme-border space-y-6" style={{ backgroundColor: saas.ui.boja_kartice }}>
                    
                    <div className="flex bg-black/30 p-1.5 rounded-xl border border-slate-700 max-w-lg shadow-inner">
                        {['U PROIZVODNJI', 'NA ČEKANJU', 'ZAVRŠENO'].map(st => (
                            <button 
                                key={st} 
                                onClick={() => setSubTab(st)} 
                                className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase transition-all tracking-wider ${subTab === st ? 'bg-purple-600 text-white shadow-md scale-105' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                            >
                                {st} ({
                                    st === 'U PROIZVODNJI' ? naloziZaPrikaz.filter(n => n.status === 'U PROIZVODNJI').length :
                                    st === 'ZAVRŠENO' ? naloziZaPrikaz.filter(n => n.status === 'ZAVRŠENO').length :
                                    naloziZaPrikaz.filter(n => n.status !== 'U PROIZVODNJI' && n.status !== 'ZAVRŠENO').length
                                })
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto custom-scrollbar pt-2">
                        {naloziZaPrikaz.length === 0 && <p className="text-center text-slate-500 text-xs col-span-full py-12 border-2 border-dashed border-theme-border rounded-xl uppercase font-black tracking-widest">Nema radnih naloga u ovoj rubrici.</p>}
                        
                        {naloziZaPrikaz.map(n => (
                            <div key={n.id} onClick={() => pokreniIzmjenuNaloga(n)} className="bg-theme-panel border border-theme-border p-5 rounded-xl hover:border-purple-500 transition-all cursor-pointer relative group flex flex-col justify-between min-h-[180px] shadow-lg">
                                {n.tip_naloga === 'FAZNI' && <div className="absolute top-0 right-0 bg-amber-500 text-black text-[8px] px-3 py-1 font-black rounded-bl-lg uppercase shadow-md flex items-center gap-1">🔄 FAZNI</div>}
                                <div className="flex justify-between items-start mb-3">
                                    <div><p className="text-purple-400 font-black text-sm font-mono">{n.id}</p><p className="text-theme-text text-xs font-bold mt-1 uppercase leading-tight">{n.kupac_naziv}</p></div>
                                    <span className={`text-[9px] px-2 py-0.5 rounded font-black border uppercase ${n.status === 'ZAVRŠENO' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/20' : 'bg-purple-900/30 text-purple-400 border-purple-500/20'}`}>{n.status}</span>
                                </div>
                   
                                <div className="flex flex-col gap-2 mt-auto pt-3 border-t border-theme-border/50">
                                    <div className="flex gap-1 flex-wrap">
                                        <button onClick={(e) => { e.stopPropagation(); pokreniIzmjenuNaloga(n); }} className="flex-1 min-w-[70px] bg-blue-600 hover:bg-blue-500 text-white py-1.5 rounded text-[8px] font-black uppercase transition-colors shadow-md">✏️ Uredi</button>

                                        {n.tip_naloga === 'FAZNI' ? (
                                            <>
                                                <button onClick={(e) => { e.stopPropagation(); printRadniNalogSveFaze(n); }} className="w-full bg-amber-600 hover:bg-amber-500 text-white py-2 rounded-lg text-[9px] font-black uppercase shadow-md transition-colors mt-1">🖨️ SVE FAZE (BOM KARTA)</button>
                                                {[...new Set(Object.values(n.tehnologija_jsonb || {}).flat().map(f => f.masina))].filter(Boolean).map(m => (
                                                    <button key={m} onClick={(e) => { e.stopPropagation(); printRadniNalogZaMasinu(n, m); }} className="flex-1 min-w-[70px] bg-theme-card hover:bg-white hover:text-black text-slate-300 py-1.5 rounded text-[8px] font-black uppercase border border-slate-700 transition-colors mt-1">🖨️ {m}</button>
                                                ))}
                                            </>
                                        ) : (
                                            <button onClick={(e) => printDirektnoIzListe(n, e)} className="flex-1 min-w-[70px] bg-theme-card hover:bg-white hover:text-black text-theme-text py-1.5 rounded text-[8px] font-black uppercase border border-slate-700 transition-colors">🖨️ PRINTAJ</button>
                                        )}
                                    </div>

                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setBrisanjeNaloga(n); }} 
                                        className="w-full bg-red-900/40 hover:bg-red-600 text-red-400 hover:text-white py-2 rounded-lg text-[9px] font-black uppercase transition-all shadow-md mt-1 border border-red-500/30"
                                    >
                                        🗑️ OBRIŠI NALOG
                                    </button>

                                    {n.status !== 'ZAVRŠENO' && (
                                        <button 
                                            onClick={(e) => zavrsiNalogDirektno(n, e)} 
                                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-md mt-1 border border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                        >
                                            🏁 OZNAČI KAO ZAVRŠENO
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {isScanning && <ScannerOverlay onScan={(text) => { ucitajPonuduIzBaze(text); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}