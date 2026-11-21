"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase, formatDbError } from '../utils/supabaseClient';
import { posaljiNotifikaciju, oznacPovezaneNotifikacijeRijesenim } from '../utils/notificationHelpers';
import MasterHeader from '../components/MasterHeader';
import PametniDialog from '../components/PametniDialog';
import ScannerOverlay from '../components/ScannerOverlay';
import { useSaaS } from '../utils/useSaaS';
import { AlertTriangle, CheckCircle2, XCircle, Search, ArrowRight, ShieldAlert, ScanLine, Package, ChevronDown, Check, Banknote, Receipt } from 'lucide-react';
import { toast } from 'sonner';

const TIP_REKLAMACIJE_OPCIJE = [
    { value: 'POVRAT', label: 'Fizički Povrat Robe', desc: 'Roba se vraća nazad u magacin firme', ikona: '📦' },
    { value: 'OTPIS_BEZ_POVRATA', label: 'Rasknjižavanje bez povrata', desc: 'Kupac zadržava ili baca robu (otpis)', ikona: '🗑️' },
];

const RAZLOG_OPCIJE = [
    { value: 'LOŠA KLASA', label: 'Loša Klasa / Kvalitet', desc: 'Odstupanje kvaliteta drveta od naručene klase', ikona: '🪵' },
    { value: 'POGREŠNA DIMENZIJA', label: 'Pogrešna Dimenzija', desc: 'Greška pri rezanju ili mjerenju (cm)', ikona: '📏' },
    { value: 'OSTECENJE TRANSPORT', label: 'Oštećenje u transportu', desc: 'Fizičko oštećenje tokom utovara ili prevoza', ikona: '🚚' },
    { value: 'OSTALO', label: 'Ostalo', desc: 'Detaljno opisati razlog u napomeni ispod', ikona: '📝' },
];

const JM_OPCIJE = [
    { value: 'kom', label: 'kom', desc: 'Komada' },
    { value: 'm3', label: 'm³', desc: 'Kubni metar' },
    { value: 'm2', label: 'm²', desc: 'Kvadratni metar' },
    { value: 'm1', label: 'm1', desc: 'Dužni metar' },
];

const FIN_NACIN_OPCIJE = [
    { value: 'AUTO', label: 'Automatski (Po statusu računa)', desc: 'Ako račun nije plaćen umanjuje dug; ako je plaćen vraća iz Blagajne', ikona: '⚡' },
    { value: 'KOREKCIJA_RACUNA', label: 'Samo knjižno odobrenje (Račun)', desc: 'Umanjuje zaduženje kupca na računu bez isplate iz kase', ikona: '🧾' },
    { value: 'POVRAT_BLAGAJNA', label: 'Povrat gotovine (Blagajna + Račun)', desc: 'Umanjuje račun i evidentira IZLAZ gotovine u Blagajni', ikona: '💵' },
];

function ModernDropdown({ value, onChange, options, placeholder = 'Odaberi...', compact = false, buttonClassName = '' }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onOut = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onOut);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onOut);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const selected = options.find((o) => String(o.value).toLowerCase() === String(value || '').toLowerCase()) || options[0];

    return (
        <div ref={ref} className={`relative ${compact ? 'shrink-0' : 'w-full'}`}>
            <button
                type="button"
                data-ds="dropdown-field"
                onClick={() => setOpen((v) => !v)}
                className={`w-full flex items-center justify-between gap-2 bg-theme-panel border-2 rounded-xl text-theme-text font-black transition-all text-left ${
                    open ? 'border-theme-accent shadow-md' : 'border-theme-border hover:border-slate-500'
                } ${compact ? 'px-4 py-3 md:py-4 min-w-[116px] text-xs md:text-sm' : 'px-4 py-3.5 min-h-[60px] text-xs'} ${buttonClassName}`}
            >
                <div className="min-w-0 flex items-center gap-2">
                    {selected?.ikona && <span className="text-base shrink-0">{selected.ikona}</span>}
                    <div className="min-w-0">
                        <span className="block truncate whitespace-nowrap">{selected?.label || placeholder}</span>
                        {!compact && selected?.desc && (
                            <span className="block text-[10px] font-semibold text-theme-muted truncate">{selected.desc}</span>
                        )}
                    </div>
                </div>
                <ChevronDown size={16} className={`shrink-0 text-theme-muted transition-transform ${open ? 'rotate-180 text-theme-accent' : ''}`} />
            </button>

            {open && (
                <div data-ds="dropdown-menu" className={`absolute ${compact ? 'right-0 min-w-[175px]' : 'left-0 right-0'} top-[calc(100%+6px)] bg-theme-card border-2 border-theme-border rounded-2xl shadow-2xl z-[300] overflow-hidden p-1.5 space-y-1 animate-in fade-in slide-in-from-top-1`}>
                    {options.map((opt) => {
                        const isSel = String(opt.value).toLowerCase() === String(value || '').toLowerCase();
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                data-ds="dropdown-item"
                                data-ds-selected={isSel ? 'true' : 'false'}
                                onClick={() => { onChange(opt.value); setOpen(false); }}
                                className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-2 transition-all ${
                                    isSel
                                        ? 'bg-theme-accent/15 border border-theme-accent/50 text-theme-text'
                                        : 'hover:bg-theme-panel text-theme-text border border-transparent'
                                }`}
                            >
                                <div className="min-w-0 flex items-center gap-2.5">
                                    {opt.ikona && <span className="text-base shrink-0">{opt.ikona}</span>}
                                    <div className="min-w-0">
                                        <span className="block text-xs font-black whitespace-nowrap">{opt.label}</span>
                                        {opt.desc && <span className="block text-[10px] text-theme-muted font-medium leading-tight">{opt.desc}</span>}
                                    </div>
                                </div>
                                {isSel && <Check size={14} className="text-theme-accent shrink-0" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function ReklamacijeModule({ user, header, setHeader, onExit }) {
    
    const saas = useSaaS('reklamacije_modul', { boja_kartice: '', boja_slova: '' });
    const imaPravoNadzora = user && (user.uloga === 'superadmin' || user.uloga === 'admin' || (user.dozvole || []).includes('Reklamacije i Povrati'));

    const [tab, setTab] = useState('unos'); // 'unos' ili 'nadzor'
    const [dialog, setDialog] = useState({ isOpen: false });
    const prikaziDialog = (opcije) => setDialog({ isOpen: true, confirmText: 'POTVRDI', cancelText: 'ZATVORI', ...opcije });
    const zatvoriDialog = () => setDialog({ isOpen: false });

    const [scan, setScan] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [activeIdx, setActiveIdx] = useState(0);
    const [isporuceniPaketi, setIsporuceniPaketi] = useState([]);
    const searchBoxRef = useRef(null);

    const [paket, setPaket] = useState(null);
    const [katalog, setKatalog] = useState([]);
    const [trenutniProizvod, setTrenutniProizvod] = useState(null);
    const [imeKupca, setImeKupca] = useState('Nepoznat Kupac');
    const [povezaniRacun, setPovezaniRacun] = useState(null);
    const [jedinicnaCijenaM3, setJedinicnaCijenaM3] = useState(0);

    const [kolicinaGreska, setKolicinaGreska] = useState(false);
    const [porukaGreske, setPorukaGreske] = useState('');

    const [prethodnoReklamiranoM3, setPrethodnoReklamiranoM3] = useState(0);
    const [stvarnoPreostaloM3, setStvarnoPreostaloM3] = useState(0);
    const [stvarnoPreostaloOrig, setStvarnoPreostaloOrig] = useState(0);
    const [prethodnoReklamiranoOrig, setPrethodnoReklamiranoOrig] = useState(0);

    const [form, setForm] = useState({ 
        kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '',
        razlog: 'LOŠA KLASA', napomena: '', tip_reklamacije: 'POVRAT', nova_isporuka: true,
        fin_nacin: 'AUTO', fin_iznos: ''
    });

    const [reklamacijeLista, setReklamacijeLista] = useState([]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        loadReklamacije();
        const channel = supabase.channel(`reklamacije_sync_${Math.random()}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reklamacije' }, () => {
                loadReklamacije();
            }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const loadReklamacije = async () => {
        const [rekRes, katRes, pakRes, otpRes, rnRes] = await Promise.all([
            supabase.from('reklamacije').select('*').order('created_at', { ascending: false }),
            supabase.from('katalog_proizvoda').select('*'),
            supabase.from('paketi')
                .select('paket_id, naziv_proizvoda, debljina, sirina, duzina, kolicina_final, kolicina_ulaz, jm, otpremnica_id, broj_veze, status, created_at')
                .not('otpremnica_id', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1000),
            supabase.from('otpremnice').select('id, kupac_naziv, datum'),
            supabase.from('radni_nalozi').select('id, kupac_naziv'),
        ]);

        if (rekRes.data) setReklamacijeLista(rekRes.data);
        if (katRes.data) setKatalog(katRes.data);

        const otpMap = {};
        (otpRes.data || []).forEach((o) => { otpMap[o.id] = o; });
        const rnMap = {};
        (rnRes.data || []).forEach((n) => { rnMap[n.id] = n; });

        const grouped = new Map();
        (pakRes.data || []).forEach((p) => {
            if (!p.paket_id) return;
            if (p.status === 'POVRAT_REKLAMACIJA' || p.status === 'POTROŠENO_U_DORADI') return;
            const otpIdStr = String(p.otpremnica_id || '').toUpperCase();
            if (otpIdStr.startsWith('REKLAMACIJA-') || otpIdStr.startsWith('POTROSENO-')) return;

            const existing = grouped.get(p.paket_id);
            const m3 = parseFloat(p.kolicina_final || 0);
            const kom = parseFloat(p.kolicina_ulaz || 0);
            if (existing) {
                existing.kolicina_final = parseFloat((existing.kolicina_final + m3).toFixed(4));
                existing.kolicina_ulaz = parseFloat((existing.kolicina_ulaz + kom).toFixed(2));
            } else {
                const otpInfo = otpMap[p.otpremnica_id];
                const rnInfo = rnMap[p.broj_veze];
                const dim = (p.debljina && p.sirina && p.duzina) ? `${p.debljina}x${p.sirina}x${p.duzina}` : '';
                grouped.set(p.paket_id, {
                    paket_id: p.paket_id,
                    naziv_proizvoda: p.naziv_proizvoda || '',
                    dimenzije: dim,
                    kolicina_final: parseFloat(m3.toFixed(4)),
                    kolicina_ulaz: kom,
                    jm: p.jm || 'kom',
                    otpremnica_id: p.otpremnica_id || '',
                    broj_veze: p.broj_veze || '',
                    kupac_naziv: otpInfo?.kupac_naziv || rnInfo?.kupac_naziv || 'Nepoznat Kupac',
                    datum_otpreme: otpInfo?.datum || (p.created_at ? p.created_at.slice(0, 10) : ''),
                });
            }
        });
        setIsporuceniPaketi(Array.from(grouped.values()));
    };

    const filtriraniIsporuceni = useMemo(() => {
        const q = scan.trim().toLowerCase();
        if (!q) return isporuceniPaketi.slice(0, 30);
        const tokeni = q.split(/\s+/).filter(Boolean);
        return isporuceniPaketi
            .filter((p) => {
                const haystack = `${p.paket_id} ${p.naziv_proizvoda} ${p.kupac_naziv} ${p.otpremnica_id} ${p.broj_veze} ${p.dimenzije} ${p.datum_otpreme}`.toLowerCase();
                return tokeni.every((t) => haystack.includes(t));
            })
            .slice(0, 40);
    }, [isporuceniPaketi, scan]);

    const handleScanInput = (val, isEnter = false) => {
        setScan(val);
        setActiveIdx(0);
        if (isEnter) {
            setDropdownOpen(false);
            const cist = val.trim().toUpperCase();
            if (!cist) return;
            const exact = isporuceniPaketi.find((p) => p.paket_id.toUpperCase() === cist);
            if (exact) {
                processScan(exact.paket_id);
            } else if (dropdownOpen && filtriraniIsporuceni[activeIdx]) {
                processScan(filtriraniIsporuceni[activeIdx].paket_id);
            } else {
                processScan(val);
            }
        } else {
            setDropdownOpen(true);
        }
    };

    const handleSearchKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setDropdownOpen(true);
            setActiveIdx((prev) => (filtriraniIsporuceni.length > 0 ? Math.min(prev + 1, filtriraniIsporuceni.length - 1) : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIdx((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Escape') {
            setDropdownOpen(false);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handleScanInput(scan, true);
        }
    };

    const processScan = async (val) => {
        const id = val.toUpperCase().trim();
        if (id.length < 1) return;

        const { data: redoviPaketa } = await supabase.from('paketi').select('*').eq('paket_id', id);
        if (redoviPaketa && redoviPaketa.length > 0) {
            const ukupniKapacitetM3 = redoviPaketa.reduce((s, r) => s + parseFloat(r.kolicina_final || 0), 0);
            const ukupnoKom = redoviPaketa.reduce((s, r) => s + parseFloat(r.kolicina_ulaz || 0), 0);
            const paketZaReklamaciju = {
                ...redoviPaketa[0],
                kolicina_final: parseFloat(ukupniKapacitetM3.toFixed(4)),
                kolicina_ulaz: ukupnoKom
            };
            
            const { data: istorijaRek } = await supabase.from('reklamacije')
                .select('kolicina, status, tip_reklamacije')
                .eq('paket_id', id)
                .in('status', ['CEKA_ODOBRENJE', 'ODOBRENO']);
            
            // Odobreni POVRAT je već umanjio kolicina_final na izvornom paketu -> ne oduzimaj ga dva puta!
            const ukupnoPotrosenoM3 = (istorijaRek || [])
                .filter(r => !(r.status === 'ODOBRENO' && r.tip_reklamacije === 'POVRAT'))
                .reduce((acc, r) => acc + parseFloat(r.kolicina || 0), 0);
            const preostaliKapacitetM3 = Math.max(0, ukupniKapacitetM3 - ukupnoPotrosenoM3);

            const kat = katalog.find(k => k.naziv === paketZaReklamaciju.naziv_proizvoda || k.sifra === paketZaReklamaciju.naziv_proizvoda);
            setTrenutniProizvod(kat || null);

            if (preostaliKapacitetM3 <= 0.0001) {
                prikaziDialog({ tip: 'greska', naslov: 'Paket Potpuno Reklamiran', poruka: `Za paket ${id} je već iskorišten sav isporučeni volumen (${ukupniKapacitetM3} m³).\nNije moguće unijeti nove reklamacije!`, onCancel: zatvoriDialog });
                setScan('');
                return;
            }

            setPrethodnoReklamiranoM3(ukupnoPotrosenoM3);
            setStvarnoPreostaloM3(preostaliKapacitetM3);

            // Izračunaj preostalo stanje i u ORIGINALNOJ jedinici mjere (kom / m2 / m1 / m3)
            const origJm = String(paketZaReklamaciju.jm || 'kom').toLowerCase();
            const vP = parseFloat(paketZaReklamaciju.debljina || kat?.visina || 0);
            const sP = parseFloat(paketZaReklamaciju.sirina || kat?.sirina || 0);
            const dP = parseFloat(paketZaReklamaciju.duzina || kat?.duzina || 0);
            const m3ToOrig = (m3Val) => {
                if (origJm === 'kom' && vP > 0 && sP > 0 && dP > 0) return m3Val / ((vP / 100) * (sP / 100) * (dP / 100));
                if (origJm === 'm2' && vP > 0) return m3Val / (vP / 100);
                if (origJm === 'm1' && vP > 0 && sP > 0) return m3Val / ((vP / 100) * (sP / 100));
                if (ukupniKapacitetM3 > 0 && ukupnoKom > 0) return (m3Val / ukupniKapacitetM3) * ukupnoKom;
                return m3Val;
            };
            setStvarnoPreostaloOrig(parseFloat(m3ToOrig(preostaliKapacitetM3).toFixed(2)));
            setPrethodnoReklamiranoOrig(parseFloat(m3ToOrig(ukupnoPotrosenoM3).toFixed(2)));

            setPaket(paketZaReklamaciju);
            setKolicinaGreska(false);

            let nadjeniKupac = 'Nepoznat Kupac';
            let pronadjeniRacun = null;
            if (paketZaReklamaciju.otpremnica_id) {
                const { data: otp } = await supabase.from('otpremnice').select('id, kupac_naziv, broj_veze').eq('id', paketZaReklamaciju.otpremnica_id).maybeSingle();
                if (otp?.kupac_naziv) nadjeniKupac = otp.kupac_naziv;
                const { data: racPoOtp } = await supabase.from('racuni').select('*').eq('broj_veze', paketZaReklamaciju.otpremnica_id).neq('status', 'OBRISANO').limit(1);
                if (racPoOtp && racPoOtp[0]) pronadjeniRacun = racPoOtp[0];
            } 
            if (nadjeniKupac === 'Nepoznat Kupac' && paketZaReklamaciju.broj_veze) {
                const { data: rn } = await supabase.from('radni_nalozi').select('kupac_naziv').eq('id', paketZaReklamaciju.broj_veze).maybeSingle();
                if (rn?.kupac_naziv) nadjeniKupac = rn.kupac_naziv;
            }
            if (!pronadjeniRacun && paketZaReklamaciju.broj_veze) {
                const { data: racPoRn } = await supabase.from('racuni').select('*').eq('broj_veze', paketZaReklamaciju.broj_veze).neq('status', 'OBRISANO').limit(1);
                if (racPoRn && racPoRn[0]) pronadjeniRacun = racPoRn[0];
            }
            setImeKupca(nadjeniKupac);
            setPovezaniRacun(pronadjeniRacun);

            // Odredi tačnu jediničnu cijenu po m³ (prvo iz povezanog računa, fallback katalog)
            let cijenaM3 = parseFloat(kat?.cijena || 0);
            if (pronadjeniRacun && Array.isArray(pronadjeniRacun.stavke_jsonb)) {
                const st = pronadjeniRacun.stavke_jsonb.find((x) =>
                    String(x.naziv || '').toLowerCase() === String(paketZaReklamaciju.naziv_proizvoda || '').toLowerCase() ||
                    (kat?.sifra && x.sifra === kat.sifra)
                );
                if (st) {
                    const kolObr = parseFloat(st.kolicina_obracun || 0);
                    const ukSt = parseFloat(st.ukupno || 0);
                    if (kolObr > 0 && ukSt > 0) {
                        cijenaM3 = ukSt / kolObr;
                    } else if (parseFloat(st.fiksna_cijena || st.cijena_baza || 0) > 0) {
                        cijenaM3 = parseFloat(st.fiksna_cijena || st.cijena_baza);
                    }
                }
            }
            setJedinicnaCijenaM3(parseFloat((cijenaM3 || 0).toFixed(4)));

            setForm(f => ({ 
                ...f, 
                kolicina_unos: '',
                jm_unos: paketZaReklamaciju.jm || 'kom',
                kolicina_obracun: '',
                fin_nacin: 'AUTO',
                fin_iznos: ''
            }));
            setScan('');
        } else {
            prikaziDialog({ tip: 'greska', naslov: 'Nepoznat Paket', poruka: `Paket ${id} ne postoji u bazi!`, onCancel: zatvoriDialog });
            setScan('');
        }
    };
    // 🟢 SVE DIMENZIJE SU U CENTIMETRIMA (cm) -> dijelimo sa 100
    useEffect(() => {
        if (!form.kolicina_unos || !paket) {
            setForm(f => ({ ...f, kolicina_obracun: '' }));
            setKolicinaGreska(false);
            setPorukaGreske('');
            return;
        }
        const kol = parseFloat(form.kolicina_unos);
        if (!Number.isFinite(kol) || kol <= 0) {
            setKolicinaGreska(true);
            setPorukaGreske("Količina za reklamaciju mora biti pozitivan broj veći od 0!");
            setForm(f => ({ ...f, kolicina_obracun: 0 }));
            return;
        }

        let obracun = kol;
        const v = parseFloat(paket?.debljina || trenutniProizvod?.visina) || 0;
        const s = parseFloat(paket?.sirina || trenutniProizvod?.sirina) || 0;
        const d = parseFloat(paket?.duzina || trenutniProizvod?.duzina) || 0;
        
        const jmNorm = String(form.jm_unos || 'kom').toLowerCase();
        if (jmNorm === 'kom') {
            if (v <= 0 || s <= 0 || d <= 0) {
                setKolicinaGreska(true);
                setPorukaGreske("Paket nema upisane sve dimenzije (Debljina/Širina/Dužina u cm) — odaberite jedinicu m³!");
                setForm(f => ({ ...f, kolicina_obracun: 0 }));
                return;
            }
            obracun = kol * (v / 100) * (s / 100) * (d / 100);
        } else if (jmNorm === 'm2') {
            if (v <= 0) {
                setKolicinaGreska(true);
                setPorukaGreske("Paket nema upisanu debljinu (cm) za preračun m² u m³ — odaberite jedinicu m³!");
                setForm(f => ({ ...f, kolicina_obracun: 0 }));
                return;
            }
            obracun = kol * (v / 100);
        } else if (jmNorm === 'm1') {
            if (v <= 0 || s <= 0) {
                setKolicinaGreska(true);
                setPorukaGreske("Paket nema upisanu debljinu i širinu (cm) za preračun m1 u m³ — odaberite jedinicu m³!");
                setForm(f => ({ ...f, kolicina_obracun: 0 }));
                return;
            }
            obracun = kol * (v / 100) * (s / 100);
        }
        
        const konacniM3 = parseFloat(obracun.toFixed(4));

        if (konacniM3 > stvarnoPreostaloM3 + 0.0001) {
            setKolicinaGreska(true);
            setPorukaGreske(`Maksimalni preostali volumen paketa iznosi: ${stvarnoPreostaloM3.toFixed(3)} m³. Vaš unos daje: ${konacniM3.toFixed(3)} m³!`);
        } else {
            setKolicinaGreska(false);
            setPorukaGreske('');
        }
        
        const imaPdvNaRacunu = povezaniRacun
            ? parseFloat(povezaniRacun.ukupno_sa_pdv || 0) > parseFloat(povezaniRacun.ukupno_bez_pdv || 0) + 0.01
            : true;
        const predlozeniIznos = jedinicnaCijenaM3 > 0
            ? parseFloat((konacniM3 * jedinicnaCijenaM3 * (imaPdvNaRacunu ? 1.17 : 1)).toFixed(2))
            : '';

        setForm(f => ({ ...f, kolicina_obracun: konacniM3, fin_iznos: predlozeniIznos !== '' ? String(predlozeniIznos) : f.fin_iznos }));
    }, [form.kolicina_unos, form.jm_unos, trenutniProizvod, paket, stvarnoPreostaloM3, jedinicnaCijenaM3, povezaniRacun]);

    const podnesiReklamaciju = async () => {
        if (!paket) return;
        const kolUnosNum = parseFloat(form.kolicina_unos);
        const kolObrNum = parseFloat(form.kolicina_obracun);
        if (!Number.isFinite(kolUnosNum) || kolUnosNum <= 0 || !Number.isFinite(kolObrNum) || kolObrNum <= 0 || kolObrNum > stvarnoPreostaloM3 + 0.0001) {
            return prikaziDialog({ tip: 'upozorenje', naslov: 'Količina', poruka: `Unesite ispravnu pozitivnu količinu (Maksimalno: ${stvarnoPreostaloM3.toFixed(3)} m³)`, onCancel: zatvoriDialog });
        }

        const v = parseFloat(paket.debljina || trenutniProizvod?.visina || 0);
        const s = parseFloat(paket.sirina || trenutniProizvod?.sirina || 0);
        const d = parseFloat(paket.duzina || trenutniProizvod?.duzina || 0);
        const dimTag = (v > 0 && s > 0 && d > 0) ? `[Dim: ${v}x${s}x${d} cm]` : '';

        const valutaRacuna = povezaniRacun?.valuta || 'KM';
        const finIznosNum = parseFloat(form.fin_iznos || 0);
        const finTag = !form.nova_isporuka && finIznosNum > 0
            ? `[FinIznos: ${finIznosNum.toFixed(2)} ${valutaRacuna}] [FinNacin: ${form.fin_nacin || 'AUTO'}]`
            : '';

        const payload = {
            broj_otpremnice: paket.otpremnica_id || paket.broj_veze || 'NEPOZNATO',
            kupac_naziv: imeKupca, 
            paket_id: paket.paket_id,
            naziv_proizvoda: paket.naziv_proizvoda,
            kolicina: kolObrNum,
            jm: 'm3',
            razlog: form.razlog,
            napomena: `[Unos: ${form.kolicina_unos} ${form.jm_unos}] ${dimTag} ${finTag} ${form.napomena}`.trim(),
            tip_reklamacije: form.tip_reklamacije,
            nova_isporuka: form.nova_isporuka,
            snimio_korisnik: user?.ime_prezime || 'Nepoznat'
        };

        const { data: insertedRek, error } = await supabase.from('reklamacije').insert([payload]).select('id');
        if (error) return prikaziDialog({ tip: 'greska', naslov: 'Greška', poruka: formatDbError(error, 'Reklamacija'), onCancel: zatvoriDialog });

        await posaljiNotifikaciju({
            korisnik: user?.ime_prezime || 'Nepoznat',
            akcija: 'NOVA_REKLAMACIJA',
            detalji: `Podnesena reklamacija za paket ${paket.paket_id} (${payload.kolicina} m³). Razlog: ${form.razlog}`,
            nivo_alarma: 'CRVENO',
            meta: {
                modul: 'reklamacije',
                entity_type: 'reklamacija',
                entity_id: paket.paket_id,
                paket_id: paket.paket_id,
                approval_type: 'REKLAMACIJA',
                approval_id: insertedRek?.[0]?.id,
                target_permission: 'Reklamacije i Povrati',
            },
        });

        setPaket(null); setTrenutniProizvod(null); setPovezaniRacun(null); setJedinicnaCijenaM3(0);
        setForm({ kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', razlog: 'LOŠA KLASA', napomena: '', tip_reklamacije: 'POVRAT', nova_isporuka: true, fin_nacin: 'AUTO', fin_iznos: '' });
        await loadReklamacije();
        prikaziDialog({ tip: 'uspjeh', naslov: 'Poslano na odobrenje', poruka: "Reklamacija je uspješno kreirana i čeka odobrenje Superadmina.", onCancel: zatvoriDialog });
    };

    const odobriReklamaciju = async (rek) => {
        prikaziDialog({
            tip: 'info', naslov: 'Odobravanje Reklamacije',
            poruka: `Odobravate reklamaciju za paket ${rek.paket_id}.\n\nDa li ste sigurni? Sistem će automatski korigovati zalihe i naloge po potrebi!`,
            confirmText: '✅ ODOBRI I PROCESUIRAJ', cancelText: '✕ ODUSTANI',
            onConfirm: async () => {
                zatvoriDialog();
                
                try {
                    // Atomična provjera statusa sprječava duplo odobravanje na dupli klik
                    const { data: claimRek, error: claimErr } = await supabase
                        .from('reklamacije')
                        .update({ status: 'ODOBRENO', procitano: true, odobrio_korisnik: user?.ime_prezime || 'Admin' })
                        .eq('id', rek.id)
                        .eq('status', 'CEKA_ODOBRENJE')
                        .select('id');

                    if (claimErr) throw claimErr;
                    if (!claimRek || claimRek.length === 0) {
                        await loadReklamacije();
                        return prikaziDialog({ tip: 'upozorenje', naslov: 'Već obrađeno', poruka: 'Ova reklamacija je već obrađena.', onCancel: zatvoriDialog });
                    }

                    const { data: redoviPaketa } = await supabase.from('paketi').select('*').eq('paket_id', rek.paket_id).order('created_at', { ascending: true });
                    const orig = redoviPaketa && redoviPaketa.length > 0 ? redoviPaketa[0] : null;
                    const kat = katalog.find(k => k.naziv === rek.naziv_proizvoda || k.sifra === rek.naziv_proizvoda);
                    const v = parseFloat(orig?.debljina || kat?.visina || 0);
                    const s = parseFloat(orig?.sirina || kat?.sirina || 0);
                    const d = parseFloat(orig?.duzina || kat?.duzina || 0);
                    const vol1Kom = (v > 0 && s > 0 && d > 0) ? (v / 100) * (s / 100) * (d / 100) : 0;
                    const rekM3 = parseFloat(rek.kolicina || 0);

                    if (rek.tip_reklamacije === 'POVRAT' && redoviPaketa && redoviPaketa.length > 0) {
                        // FIFO umanjenje preko svih redova paketa (podržava i 100% povrat i višeredne pakete!)
                        let preostaloZaSkinuti = rekM3;
                        for (const red of redoviPaketa) {
                            if (preostaloZaSkinuti <= 0.0001) break;
                            const redM3 = parseFloat(red.kolicina_final || 0);
                            if (redM3 <= 0) continue;
                            if (preostaloZaSkinuti >= redM3 - 0.0004) {
                                const { error: e1 } = await supabase.from('paketi').update({
                                    status: 'POVRAT_REKLAMACIJA',
                                    otpremnica_id: red.otpremnica_id || `REKLAMACIJA-${rek.paket_id}`
                                }).eq('id', red.id);
                                if (e1) throw e1;
                                preostaloZaSkinuti = Math.max(0, preostaloZaSkinuti - redM3);
                            } else {
                                const preostaloOrigM3 = parseFloat((redM3 - preostaloZaSkinuti).toFixed(4));
                                const noviKomOrig = vol1Kom > 0 ? parseFloat((preostaloOrigM3 / vol1Kom).toFixed(2)) : red.kolicina_ulaz;
                                const { error: e2 } = await supabase.from('paketi').update({
                                    kolicina_final: preostaloOrigM3,
                                    kubikaza: preostaloOrigM3,
                                    kolicina_m3: preostaloOrigM3,
                                    kolicina_ulaz: noviKomOrig,
                                    komada: noviKomOrig,
                                    jm: 'kom'
                                }).eq('id', red.id);
                                if (e2) throw e2;
                                preostaloZaSkinuti = 0;
                            }
                        }

                        const { id: _oldId, created_at: _oldCreated, ...cleanOrig } = orig;
                        const povratSuffix = String(rek.id || Date.now()).slice(-4);
                        const noviPaket = {
                            ...cleanOrig,
                            paket_id: `${rek.paket_id}-R${povratSuffix}`,
                            kolicina_ulaz: rekM3,
                            kolicina_final: rekM3,
                            kubikaza: rekM3,
                            kolicina_m3: rekM3,
                            jm: 'm3',
                            status: 'NA STANJU',
                            masina: 'MAGACIN_REKLAMACIJA',
                            oznake: ['REKLAMACIJA'],
                            closed_at: null,
                            otpremnica_id: null,
                            broj_veze: 'POVRAT'
                        };
                        const { error: eIns } = await supabase.from('paketi').insert([noviPaket]);
                        if (eIns) throw eIns;
                    }

                    if (rek.nova_isporuka && rek.broj_otpremnice && rek.broj_otpremnice !== 'NEPOZNATO') {
                        let targetRnId = rek.broj_otpremnice;
                        if (String(targetRnId).toUpperCase().startsWith('OTP-')) {
                            const { data: otpVeza } = await supabase.from('otpremnice').select('broj_veze').eq('id', targetRnId).maybeSingle();
                            if (otpVeza?.broj_veze) targetRnId = otpVeza.broj_veze;
                        }
                        const { data: rn } = await supabase.from('radni_nalozi').select('stavke_jsonb').eq('id', targetRnId).maybeSingle();
                        if (rn && Array.isArray(rn.stavke_jsonb)) {
                            const dimStr = (v > 0 && s > 0 && d > 0) ? `${v}x${s}x${d}` : (rn.stavke_jsonb[0]?.dimenzije || '');
                            const unosMatch = (rek.napomena || '').match(/\[Unos:\s*([0-9.,]+)\s*(\w+)\]/i);
                            const izracunatoKom = vol1Kom > 0 ? parseFloat((rekM3 / vol1Kom).toFixed(2)) : rekM3;
                            const kolUnosZaRN = unosMatch ? parseFloat(unosMatch[1].replace(',', '.')) : izracunatoKom;
                            const jmUnosZaRN = unosMatch ? unosMatch[2].toLowerCase() : (vol1Kom > 0 ? 'kom' : 'm3');

                            const novaStavka = {
                                id: `rek-${Date.now()}`,
                                sifra: kat ? kat.sifra : (rn.stavke_jsonb[0]?.sifra || 'REK-ZAMJENA'),
                                naziv: `${rek.naziv_proizvoda} (ZAMJENA REKLAMACIJE)`,
                                dimenzije: dimStr,
                                visina: v || undefined,
                                sirina: s || undefined,
                                duzina: d || undefined,
                                kolicina_unos: kolUnosZaRN,
                                jm_unos: jmUnosZaRN,
                                kolicina_obracun: rekM3,
                                jm_obracun: 'm3',
                                status: 'ZA_IZRADU',
                                napravljeno: 0
                            };
                            const noveStavke = [...rn.stavke_jsonb, novaStavka];
                            const { error: eRn } = await supabase.from('radni_nalozi').update({ stavke_jsonb: noveStavke, status: 'U PROIZVODNJI' }).eq('id', targetRnId);
                            if (eRn) throw eRn;
                        }
                    }

                    // 💰 AUTOMATSKO FINANSIJSKO PORAVNANJE KADA NE REŽEMO ZAMJENSKU ROBU (nova_isporuka === false)
                    let finPorukaRezime = '';
                    if (!rek.nova_isporuka) {
                        const finIznosMatch = (rek.napomena || '').match(/\[FinIznos:\s*([0-9.,]+)\s*(\w+)\]/i);
                        const finNacinMatch = (rek.napomena || '').match(/\[FinNacin:\s*([A-Z_]+)\]/i);
                        const finNacin = finNacinMatch ? finNacinMatch[1] : 'AUTO';

                        // Pronađi povezani račun (po otpremnici iz paketa ili iz reklamacije)
                        let racunRow = null;
                        const kandidatVeze = Array.from(new Set([orig?.otpremnica_id, rek.broj_otpremnice, orig?.broj_veze].filter((x) => x && x !== 'NEPOZNATO')));
                        for (const veza of kandidatVeze) {
                            const { data: rList } = await supabase.from('racuni').select('*').eq('broj_veze', veza).neq('status', 'OBRISANO').limit(1);
                            if (rList && rList[0]) { racunRow = rList[0]; break; }
                        }

                        const valutaRac = String(racunRow?.valuta || (finIznosMatch?.[2]) || 'KM').toUpperCase();
                        const kursKM = (valutaRac === 'EUR' || valutaRac === '€') ? 1.95583 : 1;
                        const imaPdv = racunRow
                            ? parseFloat(racunRow.ukupno_sa_pdv || 0) > parseFloat(racunRow.ukupno_bez_pdv || 0) + 0.01
                            : true;

                        let iznosSaPdvValuta = finIznosMatch ? parseFloat(finIznosMatch[1].replace(',', '.')) : 0;
                        if (!(iznosSaPdvValuta > 0)) {
                            let cijenaM3 = parseFloat(kat?.cijena || 0);
                            if (racunRow && Array.isArray(racunRow.stavke_jsonb)) {
                                const st = racunRow.stavke_jsonb.find((x) => String(x.naziv || '').toLowerCase() === String(rek.naziv_proizvoda || '').toLowerCase());
                                if (st && parseFloat(st.kolicina_obracun || 0) > 0 && parseFloat(st.ukupno || 0) > 0) {
                                    cijenaM3 = parseFloat(st.ukupno) / parseFloat(st.kolicina_obracun);
                                }
                            }
                            if (cijenaM3 > 0) {
                                iznosSaPdvValuta = parseFloat((rekM3 * cijenaM3 * (imaPdv ? 1.17 : 1)).toFixed(2));
                            }
                        }

                        if (iznosSaPdvValuta > 0) {
                            const iznosBezPdvValuta = parseFloat((imaPdv ? iznosSaPdvValuta / 1.17 : iznosSaPdvValuta).toFixed(2));
                            let iznosZaBlagajnuKM = 0;

                            // 1. Umanji povezani račun (Knjižno odobrenje)
                            if (racunRow) {
                                const stariBezPdv = parseFloat(racunRow.ukupno_bez_pdv || 0);
                                const stariSaPdv = parseFloat(racunRow.ukupno_sa_pdv || 0);
                                const noviBezPdv = Math.max(0, parseFloat((stariBezPdv - iznosBezPdvValuta).toFixed(2)));
                                const noviSaPdv = Math.max(0, parseFloat((stariSaPdv - iznosSaPdvValuta).toFixed(2)));
                                const knjiznaStavka = {
                                    id: `knj-rek-${Date.now()}`,
                                    sifra: 'KNJ-ODOB',
                                    naziv: `KNJIŽNO ODOBRENJE — REKLAMACIJA (${rek.paket_id})`,
                                    dimenzije: '',
                                    kolicina_unos: -rekM3,
                                    jm_unos: 'm3',
                                    kolicina_obracun: -rekM3,
                                    jm_obracun: 'm3',
                                    cijena_baza: parseFloat((iznosBezPdvValuta / Math.max(0.0001, rekM3)).toFixed(2)),
                                    rabat_procenat: 0,
                                    fiksna_cijena: parseFloat((iznosBezPdvValuta / Math.max(0.0001, rekM3)).toFixed(2)).toFixed(2),
                                    iznos_rabata: 0,
                                    ukupno: -iznosBezPdvValuta,
                                };

                                // Provjeri koliko je kupac već uplatio za ovaj račun u blagajni
                                const { data: uplateRac } = await supabase.from('blagajna').select('iznos, tip, racun_id, opis').eq('tip', 'ULAZ');
                                const ridUp = String(racunRow.id || '').toUpperCase().trim();
                                const uplacenoKM = (uplateRac || [])
                                    .filter((u) => (u.racun_id && String(u.racun_id).toUpperCase().trim() === ridUp) || (u.opis && String(u.opis).toUpperCase().includes(ridUp)))
                                    .reduce((s, u) => s + parseFloat(u.iznos || 0), 0);

                                const noviSaPdvKM = parseFloat((noviSaPdv * kursKM).toFixed(2));
                                const racunVecNaplacen = String(racunRow.status || '').toUpperCase() === 'NAPLAĆENO' || uplacenoKM >= noviSaPdvKM - 0.01;
                                const noviStatusRac = racunVecNaplacen ? 'NAPLAĆENO' : (uplacenoKM > 0.009 ? 'DJELIMIČNO' : racunRow.status);

                                await supabase.from('racuni').update({
                                    stavke_jsonb: [...(racunRow.stavke_jsonb || []), knjiznaStavka],
                                    ukupno_bez_pdv: noviBezPdv,
                                    ukupno_sa_pdv: noviSaPdv,
                                    status: noviStatusRac,
                                }).eq('id', racunRow.id);

                                finPorukaRezime += `\n🧾 Račun ${racunRow.id} umanjen (knjižno odobrenje) za ${iznosSaPdvValuta.toFixed(2)} ${valutaRac} (novo stanje: ${noviSaPdv.toFixed(2)} ${valutaRac}).`;

                                // Ako je kupac već platio više od novog iznosa računa (ili je izabran direktan povrat gotovine) -> vrati razliku iz Blagajne!
                                if (finNacin === 'POVRAT_BLAGAJNA') {
                                    iznosZaBlagajnuKM = parseFloat((iznosSaPdvValuta * kursKM).toFixed(2));
                                } else if (finNacin === 'AUTO') {
                                    if (uplacenoKM > noviSaPdvKM + 0.009) {
                                        iznosZaBlagajnuKM = parseFloat(Math.min(iznosSaPdvValuta * kursKM, uplacenoKM - noviSaPdvKM).toFixed(2));
                                    } else if (String(racunRow.status || '').toUpperCase() === 'NAPLAĆENO') {
                                        iznosZaBlagajnuKM = parseFloat((iznosSaPdvValuta * kursKM).toFixed(2));
                                    }
                                }
                            } else if (finNacin !== 'KOREKCIJA_RACUNA') {
                                // Nema povezanog računa -> evidentiraj direktan povrat iz Blagajne
                                iznosZaBlagajnuKM = parseFloat((iznosSaPdvValuta * kursKM).toFixed(2));
                            }

                            // 2. Evidentiraj povrat gotovine (IZLAZ) u Blagajni ako treba vratiti novac kupcu
                            if (iznosZaBlagajnuKM >= 0.01) {
                                const kasaId = `KASA-REK-${Date.now().toString().slice(-6)}`;
                                const danasIso = new Date().toISOString().split('T')[0];
                                const { error: kasaErr } = await supabase.from('blagajna').insert([{
                                    id: kasaId,
                                    tip: 'IZLAZ',
                                    kategorija: 'Povrat novca — Reklamacija',
                                    iznos: iznosZaBlagajnuKM,
                                    opis: `Povrat novca (${rek.kupac_naziv}) za reklamaciju paketa ${rek.paket_id} (${rekM3.toFixed(3)} m³)${racunRow ? ` • Račun ${racunRow.id}` : ''}`,
                                    racun_id: racunRow?.id || null,
                                    datum: danasIso,
                                    vrijeme_tekst: new Date().toLocaleTimeString('de-DE'),
                                    snimio_korisnik: user?.ime_prezime || 'Admin',
                                }]);
                                if (!kasaErr) {
                                    finPorukaRezime += `\n💵 Blagajna (${kasaId}): evidentiran povrat kupcu -${iznosZaBlagajnuKM.toFixed(2)} KM.`;
                                }
                            }
                        }
                    }

                    // Automatski označi povezano obavještenje NOVA_REKLAMACIJA kao pročitano!
                    await oznacPovezaneNotifikacijeRijesenim({
                        akcije: ['NOVA_REKLAMACIJA'],
                        tokeni: [rek.id, rek.paket_id],
                    });

                    await posaljiNotifikaciju({
                        korisnik: user?.ime_prezime || 'Admin',
                        akcija: 'ODOBRENA_REKLAMACIJA',
                        detalji: `Odobrena reklamacija (${rek.tip_reklamacije}) za paket ${rek.paket_id} (${rekM3.toFixed(3)} m³).${finPorukaRezime.replace(/\n/g, ' ')}`,
                        nivo_alarma: 'INFO',
                        meta: {
                            modul: 'reklamacije',
                            entity_type: 'reklamacija',
                            entity_id: rek.paket_id,
                            paket_id: rek.paket_id,
                            approval_id: rek.id,
                            target_user: rek.snimio_korisnik && rek.snimio_korisnik !== (user?.ime_prezime || 'Admin') ? rek.snimio_korisnik : undefined,
                        },
                    });

                    await loadReklamacije();
                    prikaziDialog({ tip: 'uspjeh', naslov: 'Odobreno', poruka: `Reklamacija je uspješno obrađena! Zalihe, nalozi i finansije su ažurirani.${finPorukaRezime}`, onCancel: zatvoriDialog });
                } catch (error) {
                    prikaziDialog({ tip: 'greska', naslov: 'Sistemska Greška', poruka: formatDbError(error, 'Odobravanje reklamacije'), onCancel: zatvoriDialog });
                }
            },
            onCancel: zatvoriDialog
        });
    };

    const odbijReklamaciju = (rek) => {
        prikaziDialog({
            tip: 'upozorenje',
            naslov: 'Odbijanje Reklamacije',
            poruka: `Da li ste sigurni da želite ODBITI reklamaciju za paket ${rek.paket_id} (${rek.kolicina} m³)?`,
            confirmText: '❌ DA, ODBIJ',
            cancelText: '✕ ODUSTANI',
            onConfirm: async () => {
                const { data: updated, error } = await supabase.from('reklamacije').update({ 
                    status: 'ODBIJENO', 
                    procitano: true,
                    odobrio_korisnik: user?.ime_prezime || 'Admin' 
                }).eq('id', rek.id).eq('status', 'CEKA_ODOBRENJE').select('id');
                zatvoriDialog();
                if (error) return toast.error(formatDbError(error, 'Odbijanje reklamacije'));
                if (!updated || updated.length === 0) {
                    toast.warning('Ova reklamacija je već obrađena.');
                    return loadReklamacije();
                }
                await oznacPovezaneNotifikacijeRijesenim({
                    akcije: ['NOVA_REKLAMACIJA'],
                    tokeni: [rek.id, rek.paket_id],
                });
                const imaPrimaocaOdbijene = rek.snimio_korisnik && rek.snimio_korisnik !== (user?.ime_prezime || 'Admin');
                await posaljiNotifikaciju({
                    korisnik: user?.ime_prezime || 'Admin',
                    akcija: 'ODBIJENA_REKLAMACIJA',
                    detalji: `Odbijena reklamacija (${rek.tip_reklamacije}) za paket ${rek.paket_id} (${rek.kolicina} m³).`,
                    nivo_alarma: imaPrimaocaOdbijene ? 'ŽUTO' : 'INFO',
                    pregledano: !imaPrimaocaOdbijene,
                    meta: {
                        modul: 'reklamacije',
                        entity_type: 'reklamacija',
                        entity_id: rek.paket_id,
                        paket_id: rek.paket_id,
                        approval_id: rek.id,
                        target_user: imaPrimaocaOdbijene ? rek.snimio_korisnik : undefined,
                    },
                });
                toast.info(`Reklamacija za paket ${rek.paket_id} je odbijena.`);
                loadReklamacije();
            },
            onCancel: zatvoriDialog
        });
    };

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6 animate-in fade-in font-sans pb-24" style={{ color: saas.ui.boja_slova || undefined }}>
            <PametniDialog {...dialog} />
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} user={user} modulIme="reklamacije" saas={saas} hideMasina={true} />

            {saas.isEditMode && (
                <div className="bg-black/60 p-6 rounded-2xl border-2 border-amber-500/50 mb-6 shadow-2xl">
                    <h3 className="text-amber-500 font-black uppercase text-sm mb-4">God Mode - Kontrole Dizajna Reklamacija</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="text-[10px] text-amber-500 uppercase font-black">Boja Kartica: <input type="color" value={saas.ui.boja_kartice} onChange={e => saas.setUi({...saas.ui, boja_kartice: e.target.value})} className="w-full h-10 mt-1 cursor-pointer rounded bg-transparent" /></label>
                        <label className="text-[10px] text-amber-500 uppercase font-black">Boja Slova: <input type="color" value={saas.ui.boja_slova} onChange={e => saas.setUi({...saas.ui, boja_slova: e.target.value})} className="w-full h-10 mt-1 cursor-pointer rounded bg-transparent" /></label>
                    </div>
                </div>
            )}

            <div className="text-center mb-6">
                <h2 className="text-red-500 font-black tracking-widest uppercase text-xl md:text-2xl drop-shadow-md flex items-center justify-center gap-3">
                    <AlertTriangle /> MODUL REKLAMACIJE I POVRATI (Dimenzije u cm)
                </h2>
            </div>

            <div className="flex bg-theme-panel p-1.5 rounded-2xl border border-theme-border shadow-inner mb-6 mx-auto max-w-xl">
                <button onClick={() => setTab('unos')} className={`flex-1 py-3 md:py-4 rounded-xl text-[10px] md:text-xs uppercase font-black transition-all flex items-center justify-center gap-2 ${tab === 'unos' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>📥 PRIJAVA REKLAMACIJE</button>
                <button onClick={() => setTab('nadzor')} className={`flex-1 py-3 md:py-4 rounded-xl text-[10px] md:text-xs uppercase font-black transition-all flex items-center justify-center gap-2 ${tab === 'nadzor' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>👑 NADZOR I ODOBRAVANJE</button>
            </div>

            {tab === 'unos' && (
                <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-left">
                    <div className="bg-theme-card p-6 md:p-8 rounded-[var(--radius-box)] border-2 border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.15)]" style={{ backgroundColor: saas.ui.boja_kartice }}>
                        
                        <div ref={searchBoxRef} className="relative mb-6 w-full">
                            <div data-ds="dropdown-field" className="flex bg-theme-panel border-2 border-red-500/40 rounded-2xl overflow-hidden shadow-inner focus-within:border-red-500 transition-all h-20 w-full">
                                <input
                                    data-ds="dropdown-input"
                                    value={scan}
                                    onFocus={() => setDropdownOpen(true)}
                                    onChange={(e) => handleScanInput(e.target.value)}
                                    onKeyDown={handleSearchKeyDown}
                                    className="flex-1 min-w-0 px-5 sm:px-6 bg-transparent text-base sm:text-xl md:text-2xl text-center text-red-400 outline-none uppercase placeholder:text-slate-600 font-black tracking-wider"
                                    placeholder="SKENIRAJ ILI PRETRAŽI ISPORUČENI PAKET (ID, KUPAC, PROIZVOD, OTP)..."
                                />
                                <button
                                    type="button"
                                    onClick={() => setDropdownOpen((v) => !v)}
                                    title="Prikaži / sakrij listu isporučenih paketa"
                                    className="shrink-0 px-4 bg-theme-card/60 text-theme-muted hover:text-theme-text transition-colors flex items-center justify-center border-l border-red-500/20"
                                >
                                    <ChevronDown className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} size={20} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setDropdownOpen(false); setIsScanning(true); }}
                                    title="Skeniraj kamerom (QR / Barkod)"
                                    className="shrink-0 px-6 sm:px-8 bg-red-600/20 text-red-500 font-black hover:bg-red-500 hover:text-white transition-colors text-2xl flex items-center justify-center shadow-lg border-l border-red-500/30"
                                >
                                    <ScanLine />
                                </button>
                            </div>

                            {dropdownOpen && (
                                <div
                                    data-ds="dropdown-menu"
                                    data-testid="reklamacije-paketi-dropdown"
                                    className="absolute left-0 right-0 top-[calc(100%+8px)] bg-theme-card border-2 border-red-500/50 rounded-2xl shadow-2xl z-[200] overflow-hidden animate-in fade-in slide-in-from-top-1"
                                >
                                    <div className="px-4 py-2.5 bg-theme-panel/80 border-b border-theme-border flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider">
                                        <span className="text-red-400 flex items-center gap-1.5">
                                            <Search size={12} /> Isporučeni paketi ({filtriraniIsporuceni.length} / {isporuceniPaketi.length})
                                        </span>
                                        <span className="text-theme-muted hidden sm:inline">↑↓ navigacija • Enter ili klik za odabir</span>
                                    </div>

                                    <div className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-theme-border/60">
                                        {filtriraniIsporuceni.length === 0 ? (
                                            <div className="p-6 text-center text-xs text-theme-muted font-bold">
                                                Nema isporučenih paketa koji odgovaraju pretrazi "{scan}".
                                                {scan.trim() && (
                                                    <button
                                                        type="button"
                                                        onClick={() => { setDropdownOpen(false); processScan(scan); }}
                                                        className="block mx-auto mt-3 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase"
                                                    >
                                                        Traži direktno ID "{scan.toUpperCase()}" u bazi
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            filtriraniIsporuceni.map((item, idx) => (
                                                <button
                                                    key={item.paket_id}
                                                    type="button"
                                                    data-ds="dropdown-item"
                                                    data-ds-selected={idx === activeIdx ? 'true' : 'false'}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        setDropdownOpen(false);
                                                        processScan(item.paket_id);
                                                    }}
                                                    onMouseEnter={() => setActiveIdx(idx)}
                                                    className={`w-full text-left px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                                                        idx === activeIdx ? 'bg-red-600/15 border-l-4 border-l-red-500' : 'hover:bg-theme-panel'
                                                    }`}
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-black text-sm text-red-400 tracking-wide flex items-center gap-1.5">
                                                                <Package size={14} className="shrink-0" /> {item.paket_id}
                                                            </span>
                                                            <span className="text-[10px] font-black uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-lg truncate max-w-[200px]">
                                                                {item.kupac_naziv}
                                                            </span>
                                                            {item.otpremnica_id && (
                                                                <span className="text-[9px] font-mono font-bold bg-theme-panel text-theme-muted border border-theme-border px-2 py-0.5 rounded-lg">
                                                                    {item.otpremnica_id}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-theme-text font-bold mt-1 truncate">
                                                            {item.naziv_proizvoda}
                                                            {item.dimenzije && <span className="text-emerald-400 font-mono ml-2">({item.dimenzije} cm)</span>}
                                                            {item.broj_veze && <span className="text-theme-muted ml-2">• RN: {item.broj_veze}</span>}
                                                        </p>
                                                    </div>
                                                    <div className="text-left sm:text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between gap-1">
                                                        <span className="text-sm font-black text-emerald-400">{item.kolicina_final.toFixed(3)} m³</span>
                                                        <span className="text-[10px] text-theme-muted font-bold">
                                                            {item.kolicina_ulaz} {item.jm}{item.datum_otpreme ? ` • ${item.datum_otpreme}` : ''}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {paket && (
                            <div className="bg-black/40 p-6 rounded-2xl border border-red-500/30 shadow-inner mt-6 animate-in zoom-in-95">
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-3 border-b border-theme-border pb-4 mb-6">
                                    <div>
                                        <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest block mb-1">Fokusirani Paket</span>
                                        <h3 className="text-2xl text-theme-text font-black drop-shadow-md">{paket.paket_id}</h3>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-lg">KUPAC: {imeKupca}</span>
                                            <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/30 px-3 py-1 rounded-lg">
                                                STANJE PAKETA: {Number(paket.kolicina_ulaz || 0).toLocaleString('bs-BA', { maximumFractionDigits: 2 })} {paket.jm || 'kom'} • {Number(paket.kolicina_final || 0).toFixed(3)} m³
                                            </span>
                                            {povezaniRacun && (
                                                <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-lg">
                                                    🧾 RAČUN: {povezaniRacun.id} ({povezaniRacun.status})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right bg-red-950/40 border border-red-500/40 p-3.5 rounded-xl shrink-0">
                                        <span className="text-[9px] text-red-400 uppercase font-black tracking-widest block mb-1">Maksimalno preostalo</span>
                                        <div className="flex items-baseline justify-end gap-2 flex-wrap">
                                            {String(paket.jm || 'kom').toLowerCase() !== 'm3' && (
                                                <>
                                                    <h3 className="text-2xl text-amber-400 font-black drop-shadow-md">
                                                        {stvarnoPreostaloOrig.toLocaleString('bs-BA', { maximumFractionDigits: 2 })} <span className="text-xs uppercase">{paket.jm || 'kom'}</span>
                                                    </h3>
                                                    <span className="text-slate-500 font-black">/</span>
                                                </>
                                            )}
                                            <h3 className="text-2xl text-red-400 font-black drop-shadow-md">
                                                {stvarnoPreostaloM3.toFixed(3)} <span className="text-xs">m³</span>
                                            </h3>
                                        </div>
                                        {prethodnoReklamiranoM3 > 0 && (
                                            <span className="text-[9px] font-black uppercase text-pink-400 block mt-1">
                                                Već reklamirano: {String(paket.jm || 'kom').toLowerCase() !== 'm3' ? `${prethodnoReklamiranoOrig} ${paket.jm || 'kom'} (` : ''}{prethodnoReklamiranoM3.toFixed(3)} m³{String(paket.jm || 'kom').toLowerCase() !== 'm3' ? ')' : ''}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-6">
                                    <span>{paket.naziv_proizvoda}</span> | <span className="text-amber-500">Radni Nalog: {paket.broj_veze || 'Nepoznat'}</span>
                                    {trenutniProizvod ? (
                                        <p className="text-emerald-400 font-black mt-2 text-xs md:text-sm bg-emerald-950/40 border border-emerald-500/20 px-3 py-1.5 rounded-lg w-fit">📏 DIMENZIJE: {trenutniProizvod.visina}x{trenutniProizvod.sirina}x{trenutniProizvod.duzina} cm</p>
                                    ) : (
                                        paket.debljina && <p className="text-emerald-400 font-black mt-2 text-xs md:text-sm bg-emerald-950/40 border border-emerald-500/20 px-3 py-1.5 rounded-lg w-fit">📏 DIMENZIJE: {paket.debljina}x{paket.sirina}x{paket.duzina} cm</p>
                                    )}
                                </div>

                                {/* 🟢 RESPONZIVNI OKVIR BEZ PROBIJANJA DESNE IVICE (min-w-0 + shrink-0) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div className="bg-theme-panel p-4 rounded-xl border border-theme-border shadow-inner flex flex-col justify-between min-w-0">
                                        <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-2 font-black">1. Količina za reklamaciju (UNOS)</label>
                                        <div className="flex gap-2 w-full min-w-0 items-stretch">
                                            <input type="number" value={form.kolicina_unos} onChange={e => setForm({...form, kolicina_unos: e.target.value})} className={`flex-1 min-w-0 p-3 md:p-4 bg-theme-card rounded-xl text-lg md:text-xl font-black text-center outline-none border-2 ${kolicinaGreska ? 'border-red-600 text-red-500 bg-red-950/20' : 'border-theme-border text-theme-text focus:border-red-400'}`} placeholder="0" />
                                            <ModernDropdown
                                                compact={true}
                                                value={form.jm_unos}
                                                onChange={(val) => setForm({ ...form, jm_unos: val })}
                                                options={JM_OPCIJE}
                                                buttonClassName="bg-theme-card h-full uppercase"
                                            />
                                        </div>
                                    </div>
                                    <div className="bg-theme-panel p-4 rounded-xl border border-emerald-500/30 shadow-inner relative overflow-hidden min-w-0">
                                        <label className="text-[9px] md:text-[10px] text-emerald-500 uppercase tracking-widest block mb-2 font-black">2. Preračunato u Kubike (Default m³)</label>
                                        <div className="relative w-full min-w-0">
                                            <input type="number" value={form.kolicina_obracun} readOnly className={`w-full min-w-0 p-3 md:p-4 bg-emerald-900/10 border-2 rounded-xl text-center text-lg md:text-xl font-black outline-none cursor-not-allowed shadow-inner ${kolicinaGreska ? 'border-red-600 text-red-500' : 'border-emerald-500/30 text-emerald-400'}`} />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-xs">m³</span>
                                        </div>
                                    </div>
                                </div>
                                {kolicinaGreska && (
                                    <div className="bg-red-950/50 border border-red-500 p-4 rounded-xl flex items-center gap-3 animate-in shake duration-300 mb-6">
                                        <span className="text-xl">🛑</span>
                                        <p className="text-[10px] md:text-xs text-red-400 font-black uppercase leading-tight">{porukaGreske}</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-2 font-black">Tip Reklamacije</label>
                                        <ModernDropdown
                                            value={form.tip_reklamacije}
                                            onChange={(val) => setForm({ ...form, tip_reklamacije: val })}
                                            options={TIP_REKLAMACIJE_OPCIJE}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-2 font-black">Razlog (Kategorija)</label>
                                        <ModernDropdown
                                            value={form.razlog}
                                            onChange={(val) => setForm({ ...form, razlog: val })}
                                            options={RAZLOG_OPCIJE}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-2 font-black">Detaljna napomena</label>
                                        <input type="text" value={form.napomena} onChange={e => setForm({...form, napomena: e.target.value})} className="w-full p-4 bg-theme-panel border-2 border-theme-border rounded-xl text-theme-text font-bold outline-none focus:border-red-400" placeholder="Opiši problem..." />
                                    </div>
                                </div>

                                <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl mb-6 flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-[10px] text-blue-400 uppercase font-black tracking-widest">PONOVNA IZRADA (ZAMJENA)</p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {form.nova_isporuka
                                                ? 'Sistem će ovu količinu automatski dodati nazad na Radni nalog kako bi se proizvela nova roba za kupca.'
                                                : 'Zamjenska roba SE NE REŽE — pri odobrenju sistem automatski vrši finansijsko poravnanje (umanjuje račun / vraća razliku iz Blagajne)!'}
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                        <input type="checkbox" checked={form.nova_isporuka} onChange={e => setForm({...form, nova_isporuka: e.target.checked})} className="sr-only peer" />
                                        <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>

                                {/* 💰 FINANSIJSKO PORAVNANJE KADA NE REŽEMO ZAMJENSKU ROBU */}
                                {!form.nova_isporuka && (
                                    <div className="bg-emerald-950/25 border-2 border-emerald-500/40 p-5 rounded-2xl mb-6 space-y-4 animate-in fade-in">
                                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
                                            <span className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                                                <Banknote size={16} /> Finansijsko Poravnanje (Knjižno Odobrenje / Povrat Novca)
                                            </span>
                                            {povezaniRacun ? (
                                                <span className="text-[10px] font-black uppercase bg-theme-card border border-emerald-500/40 text-emerald-300 px-3 py-1 rounded-lg flex items-center gap-1.5">
                                                    <Receipt size={12} /> {povezaniRacun.id} • {povezaniRacun.status} ({povezaniRacun.ukupno_sa_pdv} {povezaniRacun.valuta || 'KM'})
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-black uppercase bg-amber-500/15 border border-amber-500/30 text-amber-300 px-3 py-1 rounded-lg">
                                                    Nema povezanog računa — ide direktno kroz Blagajnu
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] text-emerald-400 uppercase tracking-widest block mb-2 font-black">
                                                    Iznos za poravnanje / povrat ({povezaniRacun?.valuta || 'KM'} sa PDV)
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={form.fin_iznos}
                                                        onChange={(e) => setForm({ ...form, fin_iznos: e.target.value })}
                                                        placeholder="0.00"
                                                        className="w-full p-4 pr-14 bg-theme-panel border-2 border-emerald-500/40 rounded-xl text-emerald-400 font-black text-lg outline-none focus:border-emerald-400"
                                                    />
                                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-emerald-500">
                                                        {povezaniRacun?.valuta || 'KM'}
                                                    </span>
                                                </div>
                                                {jedinicnaCijenaM3 > 0 && (
                                                    <p className="text-[10px] text-theme-muted font-bold mt-1">
                                                        Baza cijene: {jedinicnaCijenaM3.toFixed(2)} {povezaniRacun?.valuta || 'KM'}/m³ (možete ručno korigovati dogovoreni iznos)
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-emerald-400 uppercase tracking-widest block mb-2 font-black">Način knjiženja pri odobrenju</label>
                                                <ModernDropdown
                                                    value={form.fin_nacin}
                                                    onChange={(val) => setForm({ ...form, fin_nacin: val })}
                                                    options={FIN_NACIN_OPCIJE}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col sm:flex-row gap-4">
                                    <button onClick={() => { setPaket(null); setTrenutniProizvod(null); setPovezaniRacun(null); setJedinicnaCijenaM3(0); setScan(''); setKolicinaGreska(false); setPorukaGreske(''); setForm({ kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', razlog: 'LOŠA KLASA', napomena: '', tip_reklamacije: 'POVRAT', nova_isporuka: true, fin_nacin: 'AUTO', fin_iznos: '' }); }} className="flex-1 py-4 bg-theme-panel text-slate-400 font-black rounded-xl uppercase hover:bg-slate-800 transition-all border border-theme-border text-xs tracking-widest">✕ ODUSTANI</button>
                                    <button onClick={podnesiReklamaciju} disabled={kolicinaGreska} className={`flex-[2] py-4 text-white font-black rounded-xl uppercase tracking-widest transition-all text-xs border ${kolicinaGreska ? 'bg-slate-700 border-slate-600 opacity-40 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)] hover:scale-[1.02]'}`}>📤 PODNESI ZAHTJEV ZA ODOBRENJE</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: NADZOR I ODOBRAVANJE */}
            {tab === 'nadzor' && (
                <div className="animate-in slide-in-from-right space-y-6">
                    <div className="bg-theme-card p-6 rounded-[var(--radius-box)] border border-theme-border shadow-2xl" style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <h3 className="text-blue-400 font-black uppercase text-sm mb-6 border-b border-theme-border pb-4 flex items-center gap-2">👑 Lista Reklamacija (Kontrolni Panel)</h3>
                        
                        <div className="space-y-4">
                            {reklamacijeLista.length === 0 && <div className="text-center p-10 border border-dashed border-theme-border rounded-2xl text-slate-500 font-bold uppercase tracking-widest text-sm">Nema evidentiranih reklamacija.</div>}
                            {reklamacijeLista.map(rek => {
                                const kat = katalog.find(k => k.naziv === rek.naziv_proizvoda || k.sifra === rek.naziv_proizvoda);
                                const dimIzNapomene = rek.napomena?.match(/\[Dim:\s*([^\]]+)\]/i)?.[1];
                                const dimIzNaziva = rek.naziv_proizvoda?.match(/(\d+(?:[.,]\d+)?\s*[xX*]\s*\d+(?:[.,]\d+)?\s*[xX*]\s*\d+(?:[.,]\d+)?)/)?.[1];
                                const dimenzijeTekst = kat ? `${kat.visina}x${kat.sirina}x${kat.duzina} cm` : (dimIzNapomene || (dimIzNaziva ? `${dimIzNaziva} cm` : `${rek.kolicina} m³`));
                                const originalniUnosUtaknut = rek.napomena?.match(/\[Unos:\s*[0-9.,]+\s*\w+\]/i)?.[0]?.replace(/[\[\]]/g, '') || `Unos: ${rek.kolicina} ${rek.jm || 'm3'}`;

                                return (
                                <div key={rek.id} className={`p-5 rounded-2xl border flex flex-col md:flex-row gap-6 justify-between items-start md:items-center shadow-lg transition-all ${rek.status === 'CEKA_ODOBRENJE' ? 'bg-theme-panel border-amber-500/50 ring-1 ring-amber-500/20' : (rek.status === 'ODOBRENO' ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-red-900/10 border-red-500/30')}`}>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-3 mb-2">
                                            <span className={`text-[10px] px-2 py-1 rounded font-black uppercase tracking-widest ${rek.status === 'CEKA_ODOBRENJE' ? 'bg-amber-500 text-black' : (rek.status === 'ODOBRENO' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400')}`}>
                                                {(rek.status || 'NEPOZNATO').replace('_', ' ')}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase">{new Date(rek.created_at).toLocaleString('bs-BA')} | Podnosilac: {rek.snimio_korisnik}</span>
                                        </div>
                                        <div className="text-xl font-black text-theme-text flex items-center gap-3 drop-shadow-md">
                                            <span>Paket: {rek.paket_id}</span> <ArrowRight className="w-5 h-5 text-slate-500"/> <span className="text-red-400">{rek.kolicina} m³</span>
                                        </div>
                                        
                                        <div className="bg-black/30 p-3 rounded-lg border border-slate-700/50 my-3">
                                            <p className="text-[10px] text-amber-500 font-black uppercase mb-1">Kupac: <span className="text-theme-text font-bold">{rek.kupac_naziv}</span></p>
                                            <p className="text-[11px] text-slate-300 font-bold uppercase tracking-widest leading-relaxed">{rek.naziv_proizvoda} <span className="text-blue-400 ml-2">(Nalog: {rek.broj_otpremnice})</span></p>
                                            
                                            <div className="pt-2 mt-2 border-t border-slate-700/40 flex flex-wrap gap-4 text-[10px]">
                                                <p className="text-emerald-400 font-mono font-black">📏 DIMENZIJE: {dimenzijeTekst}</p>
                                                <p className="text-blue-400 font-black">📦 IZVORNI UNOS: <span className="text-white bg-blue-950 px-2 py-0.5 rounded border border-blue-500/30 font-mono font-black">{originalniUnosUtaknut}</span></p>
                                            </div>
                                        </div>

                                        <div className="mt-3 flex gap-2 flex-wrap">
                                            <span className="text-[9px] bg-slate-800 border border-slate-600 px-2 py-1 rounded text-slate-300 font-black uppercase">TIP: {(rek.tip_reklamacije || 'POVRAT').replace('_', ' ')}</span>
                                            <span className="text-[9px] bg-slate-800 border border-slate-600 px-2 py-1 rounded text-slate-300 font-black uppercase">RAZLOG: {rek.razlog}</span>
                                            {rek.nova_isporuka && <span className="text-[9px] bg-blue-900/40 border border-blue-500/50 px-2 py-1 rounded text-blue-400 font-black uppercase">ZAHTJEVA NOVU IZRADU</span>}
                                        </div>
                                        {rek.napomena && <p className="text-[10px] text-slate-400 mt-3 italic border-l-2 border-slate-600 pl-2 leading-relaxed">Napomena: "{rek.napomena.replace(/\[Unos:\s*[0-9.,]+\s*\w+\]/i, '').trim()}"</p>}
                                    </div>

                                    {rek.status === 'CEKA_ODOBRENJE' && imaPravoNadzora && (
                                        <div className="flex gap-2 w-full md:w-auto shrink-0">
                                            <button onClick={() => odbijReklamaciju(rek)} className="flex-1 md:flex-none px-6 py-3 bg-theme-card border border-red-500/50 hover:bg-red-600 hover:text-white text-red-400 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm flex items-center justify-center gap-2"><XCircle className="w-4 h-4"/> Odbij</button>
                                            <button onClick={() => odobriReklamaciju(rek)} className="flex-[2] md:flex-none px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 border border-emerald-400"><CheckCircle2 className="w-4 h-4"/> ODOBRI I KNJIŽI</button>
                                        </div>
                                    )}

                                    {rek.status !== 'CEKA_ODOBRENJE' && (
                                        <div className="text-right w-full md:w-auto">
                                            <p className="text-[9px] text-slate-500 uppercase font-bold mb-1">Obradio / Odobrio:</p>
                                            <p className="text-sm font-black text-white bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">{rek.odobrio_korisnik || 'N/A'}</p>
                                        </div>
                                    )}

                                </div>
                            )})}
                        </div>
                    </div>
                </div>
            )}

            {isScanning && <ScannerOverlay onScan={(text) => { handleScanInput(text, true); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}