"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { supabase, formatDbError } from '../utils/supabaseClient';
import MasterHeader from '../components/MasterHeader';
import PametniDialog from '../components/PametniDialog';
import SusareServisPanel from '../components/SusareServisPanel';
import DatumInput from '../components/DatumInput';
import { useSaaS } from '../utils/useSaaS';
import {
    toLocalIso,
    parseISODateLocal,
    prikazDatumaBHS,
    formatBrojBHS,
    escapeHtml,
} from '../utils/dateHelpers';
import { printDokument } from '../utils/printHelpers';
import {
    ChevronLeft, ChevronRight, X, CheckCircle2, AlertTriangle,
    Calendar, ArrowRight, History, Printer, Search, Zap, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';

const IMENA_DANA_PUNO = ['NEDJELJA', 'PONEDJELJAK', 'UTORAK', 'SRIJEDA', 'ČETVRTAK', 'PETAK', 'SUBOTA'];
const IMENA_DANA_BHS = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];

const razlikaDana = (odIso, doIso) => {
    const a = parseISODateLocal(odIso);
    const b = parseISODateLocal(doIso);
    return Math.round((b.getTime() - a.getTime()) / 86400000);
};

export default function PlaniranjeModule({ user, header, setHeader, onExit }) {
    const saas = useSaaS('planiranje_modul', {
        boja_kartice: '', boja_slova: '', boja_akcenta: '#f59e0b'
    });

    const danasnjiDatum = toLocalIso(new Date());
    const sutrasnjiDatum = useMemo(() => {
        const d = parseISODateLocal(danasnjiDatum);
        return toLocalIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
    }, [danasnjiDatum]);

    const isReadOnly = user?.uloga !== 'admin' && user?.uloga !== 'superadmin' && !(user?.dozvole || []).includes('Planiranje Proizvodnje');

    const [loading, setLoading] = useState(true);
    const [planPodTab, setPlanPodTab] = useState(() => {
        if (typeof window !== 'undefined' && localStorage.getItem('planiranje_auto_tab') === 'susare') {
            localStorage.removeItem('planiranje_auto_tab');
            return 'susare';
        }
        return 'raspored';
    });
    const [masine, setMasine] = useState([]);
    const [odabranaMasina, setOdabranaMasina] = useState('');
    const [kapacitetMasine, setKapacitetMasine] = useState(30);
    const [katalog, setKatalog] = useState([]);

    const [nerasporedjeniNalozi, setNerasporedjeniNalozi] = useState([]);
    const [raspored, setRaspored] = useState([]);
    const [sviPlanoviGlobal, setSviPlanoviGlobal] = useState([]);

    // 🟢 Po defaultu krećemo od DANAŠNJEG datuma (7 dana unaprijed), nikad od prošlih dana!
    const [pocetakPerioda, setPocetakPerioda] = useState(() => parseISODateLocal(toLocalIso(new Date())));
    const [prikaziHistoriju, setPrikaziHistoriju] = useState(false);
    const [zaostatciProsireno, setZaostatciProsireno] = useState(true);
    const [pretragaNaloga, setPretragaNaloga] = useState('');

    const [highlightedRN, setHighlightedRN] = useState(null);
    const [dialog, setDialog] = useState({ isOpen: false });
    const prikaziDialog = (opcije) => setDialog({ isOpen: true, confirmText: 'POTVRDI', cancelText: 'ZATVORI', ...opcije });
    const zatvoriDialog = () => setDialog({ isOpen: false });

    const [pregledNaloga, setPregledNaloga] = useState(null);
    const [planiranjeModal, setPlaniranjeModal] = useState(null);
    const [stavkeZaPlaniranje, setStavkeZaPlaniranje] = useState([]);
    const [premjestiModal, setPremjestiModal] = useState(null); // { stavka, noviDatum }

    useEffect(() => {
        const autoId = localStorage.getItem('erp_auto_open_id');
        const autoAction = localStorage.getItem('erp_auto_action');

        if (autoId && autoAction === 'planiraj' && nerasporedjeniNalozi.length > 0) {
            setHighlightedRN(autoId);

            const nToPlan = nerasporedjeniNalozi.find(n => n.id === autoId);
            if (nToPlan) {
                otvoriPlaniranjeModal(nToPlan);
            }

            localStorage.removeItem('erp_auto_open_id');
            localStorage.removeItem('erp_auto_action');

            setTimeout(() => {
                const el = document.getElementById(`rn_card_${autoId}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);

            setTimeout(() => { setHighlightedRN(null); }, 4000);
        }
    }, [nerasporedjeniNalozi]);

    useEffect(() => { loadInitialData(); }, []);
    useEffect(() => { if (odabranaMasina) loadRaspored(); }, [odabranaMasina, pocetakPerioda, katalog]);

    const pocetakIso = toLocalIso(pocetakPerioda);
    const jeNaDanas = pocetakIso === danasnjiDatum;
    const mozeNazad = prikaziHistoriju || pocetakIso > danasnjiDatum;

    const shiftPeriod = (dana) => {
        const danasDate = parseISODateLocal(danasnjiDatum);
        const target = new Date(pocetakPerioda.getFullYear(), pocetakPerioda.getMonth(), pocetakPerioda.getDate() + dana);
        if (!prikaziHistoriju && target < danasDate) {
            setPocetakPerioda(danasDate);
            return;
        }
        setPocetakPerioda(target);
    };

    const skociNaDanas = () => {
        setPrikaziHistoriju(false);
        setPocetakPerioda(parseISODateLocal(danasnjiDatum));
    };

    const toggleHistorija = () => {
        if (prikaziHistoriju) {
            setPrikaziHistoriju(false);
            setPocetakPerioda(parseISODateLocal(danasnjiDatum));
        } else {
            setPrikaziHistoriju(true);
            const danasDate = parseISODateLocal(danasnjiDatum);
            setPocetakPerioda(new Date(danasDate.getFullYear(), danasDate.getMonth(), danasDate.getDate() - 7));
        }
    };

    const loadInitialData = async () => {
        const { data: mData } = await supabase.from('masine').select('naziv, dnevni_kapacitet_m3, dozvoljeni_moduli').order('naziv');
        if (mData && mData.length > 0) {
            setMasine(mData);
            setOdabranaMasina(mData[0].naziv);
            const cap = parseFloat(mData[0].dnevni_kapacitet_m3);
            setKapacitetMasine(Number.isFinite(cap) && cap > 0 ? cap : 30);
        } else {
            setMasine([]);
            setLoading(false);
        }
        const { data: kData } = await supabase.from('katalog_proizvoda').select('*');
        if (kData) setKatalog(kData);
    };

    const loadRaspored = async () => {
        setLoading(true);
        const krajPerioda = new Date(pocetakPerioda.getFullYear(), pocetakPerioda.getMonth(), pocetakPerioda.getDate() + 6);
        const dOd = toLocalIso(pocetakPerioda);
        const dDo = toLocalIso(krajPerioda);

        const [raspRes, sviRes, rnRes] = await Promise.all([
            supabase.from('raspored_proizvodnje').select('*').eq('masina', odabranaMasina).gte('datum_plana', dOd).lte('datum_plana', dDo),
            supabase.from('raspored_proizvodnje').select('*').eq('masina', odabranaMasina),
            supabase.from('radni_nalozi').select('*').neq('status', 'ZAVRŠENO').neq('status', 'OBRISANO'),
        ]);

        const raspData = raspRes.data || [];
        const sviPlanovi = sviRes.data || [];
        const rnData = rnRes.data || [];

        setRaspored(raspData);
        setSviPlanoviGlobal(sviPlanovi);

        let naloziZaLijevuStranu = [];

        rnData.forEach(rn => {
            let imaNerasporedjeno = false;
            let stavkeZaMasinu = [];

            (rn.stavke_jsonb || []).forEach(st => {
                let ukupnoZaUraditiM3 = 0;
                let jm_unos = String(st.jm_unos || 'kom').toLowerCase();
                let originalKol = parseFloat(st.kolicina_unos || 0);

                const katItem = katalog.find(k => k.sifra === st.sifra) || {};
                let v = parseFloat(katItem.visina) || 0;
                let sir = parseFloat(katItem.sirina) || 0;
                let d = parseFloat(katItem.duzina) || 0;
                let dimPrikaz = st.dimenzije || (v > 0 ? `${v}x${sir}x${d}` : 'BEZ DIMENZIJE');

                if (rn.tip_naloga === 'FAZNI') {
                    const faza = (rn.tehnologija_jsonb?.[st.id] || []).find(f => (f.masina || '').toUpperCase().trim() === (odabranaMasina || '').toUpperCase().trim());
                    if (faza) {
                        originalKol = parseFloat(faza.kolicina || 0);
                        jm_unos = (faza.jm || jm_unos || 'kom').toLowerCase();

                        const fazaDimStr = faza.dimenzija || faza.ulazne_dimenzije || '';
                        const matchDim = fazaDimStr.match(/(\d+(?:[.,]\d+)?)\s*[xX*]\s*(\d+(?:[.,]\d+)?)\s*[xX*]\s*(\d+(?:[.,]\d+)?)/);
                        if (matchDim) {
                            v = parseFloat(matchDim[1].replace(',', '.'));
                            sir = parseFloat(matchDim[2].replace(',', '.'));
                            d = parseFloat(matchDim[3].replace(',', '.'));
                            dimPrikaz = `${v}x${sir}x${d}`;
                        }
                    } else return;
                }

                const vol1kom = (v > 0 && sir > 0 && d > 0) ? (v / 100) * (sir / 100) * (d / 100) : 0;
                const area1kom = (sir > 0 && d > 0) ? (sir / 100) * (d / 100) : 0;
                const len1kom = (d > 0) ? (d / 100) : 0;

                if (rn.tip_naloga === 'FAZNI') {
                    let komada = originalKol;
                    if (jm_unos === 'm3' && vol1kom > 0) komada = originalKol / vol1kom;
                    else if (jm_unos === 'm2' && area1kom > 0) komada = originalKol / area1kom;
                    else if (jm_unos === 'm1' && len1kom > 0) komada = originalKol / len1kom;

                    ukupnoZaUraditiM3 = komada * vol1kom;
                    if (jm_unos === 'm3') ukupnoZaUraditiM3 = originalKol;
                } else {
                    const jmObr = String(st.jm_obracun || 'm3').toLowerCase();
                    ukupnoZaUraditiM3 = jmObr === 'm3' ? parseFloat(st.kolicina_obracun || 0) : 0;
                    if (jm_unos === 'm3') {
                        ukupnoZaUraditiM3 = originalKol;
                    } else if (vol1kom > 0) {
                        if (jm_unos === 'kom') ukupnoZaUraditiM3 = originalKol * vol1kom;
                        else if (jm_unos === 'm2' && area1kom > 0) ukupnoZaUraditiM3 = (originalKol / area1kom) * vol1kom;
                        else if (jm_unos === 'm1' && len1kom > 0) ukupnoZaUraditiM3 = (originalKol / len1kom) * vol1kom;
                    }
                }

                if (ukupnoZaUraditiM3 > 0) {
                    const vecZauzetoIliGotovo = sviPlanovi
                        .filter(p => p.rn_id === rn.id && p.stavka_id === st.id)
                        .reduce((s, p) => s + parseFloat(p.planirano_m3 || 0) + parseFloat(p.proizvedeno_m3 || 0), 0);
                    const preostaloM3 = ukupnoZaUraditiM3 - vecZauzetoIliGotovo;

                    if (preostaloM3 > 0.0001) {
                        imaNerasporedjeno = true;
                        const ratio = preostaloM3 / ukupnoZaUraditiM3;
                        const preostaloOriginal = parseFloat((originalKol * ratio).toFixed(2));

                        stavkeZaMasinu.push({
                            ...st,
                            preostalo: preostaloM3.toFixed(4),
                            preostaloOriginal,
                            jm_unos,
                            dimenzije_prikaz: dimPrikaz,
                            ukupnoZaUraditiM3,
                            vol1kom, area1kom, len1kom,
                            maxKolicinaM3: ukupnoZaUraditiM3
                        });
                    }
                }
            });

            if (imaNerasporedjeno) {
                naloziZaLijevuStranu.push({ ...rn, stavkeZaPlaniranje: stavkeZaMasinu });
            }
        });

        setNerasporedjeniNalozi(naloziZaLijevuStranu.sort((a, b) => parseISODateLocal(a.rok_isporuke) - parseISODateLocal(b.rok_isporuke)));
        setLoading(false);
    };

    // 🔴 MES/APS CARRYOVER: Nezavršene zakazane stavke iz prošlih dana (< danasnjiDatum)
    const zaostatciProsliDani = useMemo(() => {
        return (sviPlanoviGlobal || [])
            .filter((p) => {
                const dp = String(p.datum_plana || '').slice(0, 10);
                if (!dp || dp >= danasnjiDatum) return false;
                const plan = parseFloat(p.planirano_m3 || 0);
                const proizv = parseFloat(p.proizvedeno_m3 || 0);
                const ukupno = plan + proizv;
                const pct = ukupno > 0 ? Math.round((proizv / ukupno) * 100) : 0;
                const jeZavrseno = p.status === 'ZAVRŠENO' || pct >= 100 || plan <= 0.0001;
                return !jeZavrseno;
            })
            .sort((a, b) => String(a.datum_plana || '').localeCompare(String(b.datum_plana || '')));
    }, [sviPlanoviGlobal, danasnjiDatum]);

    const ukupnoZaostatakM3 = useMemo(
        () => zaostatciProsliDani.reduce((s, z) => s + (parseFloat(z.planirano_m3 || 0) || 0), 0),
        [zaostatciProsliDani]
    );

    const izracunajPreporuku = (rok_isporuke) => {
        const rokDate = parseISODateLocal(rok_isporuke);
        const preporukaDate = new Date(rokDate.getFullYear(), rokDate.getMonth(), rokDate.getDate() - 2);
        const danas = parseISODateLocal(danasnjiDatum);
        return preporukaDate < danas ? danas : preporukaDate;
    };

    const handleDragStart = (e, nalog) => { e.dataTransfer.setData('nalogId', nalog.id); };
    const handleDragOver = (e) => { e.preventDefault(); e.currentTarget.classList.add('bg-white/5'); };
    const handleDragLeave = (e) => { e.currentTarget.classList.remove('bg-white/5'); };

    const handleDrop = (e, ciljniDatum) => {
        e.preventDefault();
        e.currentTarget.classList.remove('bg-white/5');
        if (ciljniDatum < danasnjiDatum) {
            return toast.error('⛔ Nije moguće planirati proizvodnju u prošlosti! Odaberite današnji ili budući dan.');
        }
        const nalogId = e.dataTransfer.getData('nalogId');
        if (!nalogId) return;
        const nalog = nerasporedjeniNalozi.find(n => n.id === nalogId);
        if (!nalog) return;
        otvoriPlaniranjeModal(nalog, ciljniDatum);
    };

    const otvoriPlaniranjeModal = (nalog, datum = '') => {
        if (isReadOnly) return;
        const pocetnoStanjeStavki = nalog.stavkeZaPlaniranje.map(st => ({
            id: st.id, naziv: st.naziv, dimenzije: st.dimenzije_prikaz, sifra: st.sifra, jm_unos: st.jm_unos,
            maxKolicina: st.preostalo,
            preostaloOriginal: st.preostaloOriginal,
            kolicinaZaUnos: st.preostaloOriginal,
            kolicinaM3: st.preostalo,
            vol1kom: st.vol1kom, area1kom: st.area1kom, len1kom: st.len1kom,
            checked: true
        }));
        let finalniDatum = datum;
        if (!finalniDatum || finalniDatum < danasnjiDatum) {
            finalniDatum = toLocalIso(izracunajPreporuku(nalog.rok_isporuke));
        }
        setStavkeZaPlaniranje(pocetnoStanjeStavki);
        setPlaniranjeModal({ nalog, datum: finalniDatum });
    };

    const toggleStavkaPlaniranje = (id) => { setStavkeZaPlaniranje(prev => prev.map(s => s.id === id ? { ...s, checked: !s.checked } : s)); };

    const promjeniKolicinuPlaniranja = (id, novaKolOriginal) => {
        setStavkeZaPlaniranje(prev => prev.map(s => {
            if (s.id === id) {
                const unos = parseFloat(novaKolOriginal);
                if (!Number.isFinite(unos) || unos <= 0) {
                    return { ...s, kolicinaZaUnos: novaKolOriginal, kolicinaM3: 0 };
                }
                let komada = unos;
                if (s.jm_unos === 'm3' && s.vol1kom > 0) komada = unos / s.vol1kom;
                else if (s.jm_unos === 'm2' && s.area1kom > 0) komada = unos / s.area1kom;
                else if (s.jm_unos === 'm1' && s.len1kom > 0) komada = unos / s.len1kom;

                let novim3 = (komada * s.vol1kom).toFixed(4);
                if (s.jm_unos === 'm3') novim3 = unos.toFixed(4);

                if (s.vol1kom === 0 && s.jm_unos !== 'm3') {
                    const origPreostalo = parseFloat(s.preostaloOriginal) || 0;
                    const ratio = origPreostalo > 0 ? (unos / origPreostalo) : 0;
                    novim3 = (parseFloat(s.maxKolicina || 0) * ratio).toFixed(4);
                }

                const parsedM3 = parseFloat(novim3);
                return { ...s, kolicinaZaUnos: novaKolOriginal, kolicinaM3: (!Number.isFinite(parsedM3) || parsedM3 < 0) ? 0 : novim3 };
            }
            return s;
        }));
    };

    const isSubmittingPlanRef = React.useRef(false);

    const izvrsiUpisPlanaUBazu = async (stavkeZaBazu, modalSnapshot) => {
        if (isSubmittingPlanRef.current) return;
        isSubmittingPlanRef.current = true;
        const aktivniModal = modalSnapshot || planiranjeModal;
        if (!aktivniModal) {
            isSubmittingPlanRef.current = false;
            return;
        }
        setPlaniranjeModal(null);

        try {
            const payload = stavkeZaBazu.map(s => ({
                rn_id: aktivniModal.nalog.id, stavka_id: s.id, proizvod_naziv: s.naziv, dimenzije: s.dimenzije,
                masina: odabranaMasina, datum_plana: aktivniModal.datum,
                planirano_m3: parseFloat(s.kolicinaM3), proizvedeno_m3: 0, status: 'ZAKAZANO', snimio_korisnik: user?.ime_prezime || 'Nepoznat'
            }));

            const { error } = await supabase.from('raspored_proizvodnje').insert(payload);
            if (error) {
                toast.error(formatDbError(error, 'Zakazivanje plana'));
            } else {
                toast.success(`Radni nalog ${aktivniModal.nalog.id} uspješno zakazan za ${prikazDatumaBHS(aktivniModal.datum)}!`);
            }
            await loadRaspored();
        } finally {
            isSubmittingPlanRef.current = false;
        }
    };

    const potvrdiPlaniranje = async () => {
        if (isSubmittingPlanRef.current || !planiranjeModal) return;
        const stavkeZaBazu = stavkeZaPlaniranje.filter(s => s.checked);
        if (stavkeZaBazu.length === 0) return toast.warning("Morate odabrati bar jednu stavku za planiranje!");
        if (!planiranjeModal.datum) return toast.warning("Morate odabrati datum!");
        if (planiranjeModal.datum < danasnjiDatum) return toast.error("⛔ Greška: Ne možete planirati proizvodnju za datum koji je već prošao!");

        let neispravanUnos = false;
        let prekoracenaStavka = null;
        let ukupnoNovihKubika = 0;

        stavkeZaBazu.forEach(s => {
            const kol = parseFloat(s.kolicinaZaUnos);
            const m3ZaDodati = parseFloat(s.kolicinaM3);
            if (!Number.isFinite(kol) || kol <= 0 || !Number.isFinite(m3ZaDodati) || m3ZaDodati <= 0) {
                toast.warning(`Količina za ${s.naziv} mora biti pozitivan broj veći od 0!`);
                neispravanUnos = true;
            }
            if (Number.isFinite(kol) && kol > parseFloat(s.preostaloOriginal) + 0.01) { prekoracenaStavka = s; }
            if (Number.isFinite(m3ZaDodati)) ukupnoNovihKubika += m3ZaDodati;
        });
        if (neispravanUnos) return;

        const danStr = planiranjeModal.datum;
        const trenutnoPlaniranoNaDan = sviPlanoviGlobal.filter(r => r.datum_plana === danStr).reduce((s, r) => s + parseFloat(r.planirano_m3 || 0), 0);
        const prelaziKapacitet = (trenutnoPlaniranoNaDan + ukupnoNovihKubika) > kapacitetMasine;

        if (prekoracenaStavka || prelaziKapacitet) {
            let porukaUpozorenja = '';
            if (prekoracenaStavka) {
                porukaUpozorenja += `• Za stavku "${prekoracenaStavka.naziv}" unijeli ste više nego što je preostalo u nalogu.\n\n`;
            }
            if (prelaziKapacitet) {
                porukaUpozorenja += `• KAPACITET PREMAŠEN: Na dan ${prikazDatumaBHS(danStr)} je već planirano ${formatBrojBHS(trenutnoPlaniranoNaDan, 2)} m³. Sa ovim dodajete još ${formatBrojBHS(ukupnoNovihKubika, 2)} m³, čime prelazite dnevni limit od ${formatBrojBHS(kapacitetMasine, 0)} m³.\n\n`;
            }
            porukaUpozorenja += `Da li ste sigurni da želite nastaviti i zakazati proizvodnju?`;

            const modalKopija = { ...planiranjeModal };
            return prikaziDialog({
                tip: 'upozorenje',
                naslov: '⚠️ Prekoračenje Norme / Kapaciteta',
                poruka: porukaUpozorenja,
                confirmText: '✅ DA, ZAKAŽI',
                cancelText: '✕ KORIGUJ',
                onConfirm: () => {
                    zatvoriDialog();
                    izvrsiUpisPlanaUBazu(stavkeZaBazu, modalKopija);
                },
                onCancel: zatvoriDialog
            });
        }

        await izvrsiUpisPlanaUBazu(stavkeZaBazu, { ...planiranjeModal });
    };

    // ⚡ Premjesti zakazanu / zaostalu stavku na novi datum (default: danas)
    const premjestiStavkuNaDatum = async (stavka, noviDatum) => {
        if (isReadOnly || !stavka?.id) return;
        if (!noviDatum || noviDatum < danasnjiDatum) {
            return toast.error('⛔ Novi datum mora biti današnji ili budući!');
        }
        const { error } = await supabase
            .from('raspored_proizvodnje')
            .update({ datum_plana: noviDatum })
            .eq('id', stavka.id);
        if (error) return toast.error(formatDbError(error, 'Premještanje u rasporedu'));
        toast.success(`Stavka ${stavka.rn_id} prebačena na ${prikazDatumaBHS(noviDatum)}!`);
        setPremjestiModal(null);
        await loadRaspored();
    };

    const prebaciSveZaostatkeNaDanas = () => {
        if (isReadOnly || zaostatciProsliDani.length === 0) return;
        prikaziDialog({
            tip: 'upozorenje',
            naslov: '⚡ Prebaci sve zaostatke na danas?',
            poruka: `Prebacujete ${zaostatciProsliDani.length} nezavršenih stavki (${formatBrojBHS(ukupnoZaostatakM3, 2)} m³) iz prošlih dana na današnji raspored (${prikazDatumaBHS(danasnjiDatum)}) za mašinu ${odabranaMasina}. Nastaviti?`,
            confirmText: '⚡ PREBACI SVE NA DANAS',
            cancelText: 'ODUSTANI',
            onConfirm: async () => {
                zatvoriDialog();
                const ids = zaostatciProsliDani.map((z) => z.id);
                const { error } = await supabase
                    .from('raspored_proizvodnje')
                    .update({ datum_plana: danasnjiDatum })
                    .in('id', ids);
                if (error) return toast.error(formatDbError(error, 'Masovno prebacivanje zaostataka'));
                toast.success(`Uspješno prebačeno ${ids.length} zaostalih stavki na današnji dan!`);
                skociNaDanas();
                await loadRaspored();
            },
            onCancel: zatvoriDialog,
        });
    };

    const oznaciZaostatakZavrsenim = (stavka) => {
        if (isReadOnly || !stavka?.id) return;
        prikaziDialog({
            tip: 'upozorenje',
            naslov: '✅ Zatvori zaostalu stavku',
            poruka: `Označiti stavku "${stavka.proizvod_naziv}" (${stavka.rn_id}) kao ZAVRŠENU u rasporedu? Preostali neizvršeni dio (${formatBrojBHS(parseFloat(stavka.planirano_m3 || 0), 2)} m³) bit će zatvoren.`,
            confirmText: '✅ OZNAČI ZAVRŠENO',
            cancelText: 'ODUSTANI',
            onConfirm: async () => {
                zatvoriDialog();
                const { error } = await supabase
                    .from('raspored_proizvodnje')
                    .update({ status: 'ZAVRŠENO', planirano_m3: 0 })
                    .eq('id', stavka.id);
                if (error) return toast.error(formatDbError(error, 'Zatvaranje stavke'));
                toast.success(`Stavka ${stavka.rn_id} označena kao završena.`);
                await loadRaspored();
            },
            onCancel: zatvoriDialog,
        });
    };

    const obrisiIzPlana = (id, e) => {
        e?.stopPropagation?.();
        if (isReadOnly) return;
        const stavkaPlana = sviPlanoviGlobal.find(r => r.id === id) || raspored.find(r => r.id === id);
        if (stavkaPlana && parseFloat(stavkaPlana.proizvedeno_m3 || 0) > 0) {
            return toast.error("Nije moguće ukloniti stavku plana na kojoj već postoji evidentirana proizvodnja!");
        }
        prikaziDialog({
            tip: 'upozorenje',
            naslov: 'Uklanjanje iz rasporeda',
            poruka: 'Ukloniti ovu stavku iz rasporeda? Ona će se automatski vratiti nazad na listu neraspoređenih naloga.',
            confirmText: '🗑️ UKLONI IZ PLANA',
            cancelText: '✕ ZADRŽI',
            onConfirm: async () => {
                const { error } = await supabase.from('raspored_proizvodnje').delete().eq('id', id);
                zatvoriDialog();
                if (error) return toast.error(formatDbError(error, 'Brisanje iz plana'));
                toast.info("Stavka uklonjena iz rasporeda.");
                loadRaspored();
            },
            onCancel: zatvoriDialog
        });
    };

    const DaniUPeriodu = useMemo(() => {
        const dani = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(pocetakPerioda.getFullYear(), pocetakPerioda.getMonth(), pocetakPerioda.getDate() + i);
            const iso = toLocalIso(d);
            dani.push({
                datum: d,
                ime: IMENA_DANA_PUNO[d.getDay()],
                iso,
                prikaz: prikazDatumaBHS(iso),
                jeDanas: iso === danasnjiDatum,
                jeSutra: iso === sutrasnjiDatum,
                jeProslost: iso < danasnjiDatum,
            });
        }
        return dani;
    }, [pocetakPerioda, danasnjiDatum, sutrasnjiDatum]);

    const filtriraniNerasporedjeni = useMemo(() => {
        const q = pretragaNaloga.trim().toLowerCase();
        if (!q) return nerasporedjeniNalozi;
        return nerasporedjeniNalozi.filter((rn) =>
            String(rn.id || '').toLowerCase().includes(q) ||
            String(rn.kupac_naziv || '').toLowerCase().includes(q) ||
            (rn.stavkeZaPlaniranje || []).some((st) => String(st.naziv || '').toLowerCase().includes(q))
        );
    }, [nerasporedjeniNalozi, pretragaNaloga]);

    const kpiPlaniranja = useMemo(() => {
        const danasM3 = (sviPlanoviGlobal || [])
            .filter((r) => r.datum_plana === danasnjiDatum)
            .reduce((s, r) => s + (parseFloat(r.planirano_m3 || 0) || 0), 0);
        const sedmicaM3 = (raspored || []).reduce((s, r) => s + (parseFloat(r.planirano_m3 || 0) || 0), 0);
        const neraspM3 = nerasporedjeniNalozi.reduce(
            (s, rn) => s + (rn.stavkeZaPlaniranje || []).reduce((ss, st) => ss + (parseFloat(st.preostalo || 0) || 0), 0),
            0
        );
        const hitniNalozi = nerasporedjeniNalozi.filter((rn) => rn.rok_isporuke && rn.rok_isporuke <= DaniUPeriodu[6].iso).length;
        return {
            danasM3,
            danasPct: kapacitetMasine > 0 ? Math.min(999, (danasM3 / kapacitetMasine) * 100) : 0,
            sedmicaM3,
            sedmicaPct: kapacitetMasine > 0 ? Math.min(999, (sedmicaM3 / (kapacitetMasine * 7)) * 100) : 0,
            neraspM3,
            hitniNalozi,
        };
    }, [sviPlanoviGlobal, raspored, nerasporedjeniNalozi, danasnjiDatum, kapacitetMasine, DaniUPeriodu]);

    const isNalogDijeljen = (rn_id) => {
        const jedinstveniDani = new Set(sviPlanoviGlobal.filter(p => p.rn_id === rn_id).map(p => p.datum_plana));
        return jedinstveniDani.size > 1;
    };

    const stampajRasporedPdf = () => {
        const zaostHtml = zaostatciProsliDani.length > 0 ? `
            <div style="border:1px solid #ef4444; background:#fef2f2; border-radius:8px; padding:10px; margin-bottom:14px;">
                <div style="font-size:10px; font-weight:900; color:#b91c1c; text-transform:uppercase; margin-bottom:6px;">
                    ⚠️ ZAOSTATCI IZ PROŠLIH DANA (${zaostatciProsliDani.length} stavki • ${formatBrojBHS(ukupnoZaostatakM3, 2)} m³)
                </div>
                <table>
                    <thead><tr><th>Planirano</th><th>Kasni</th><th>Nalog</th><th>Dimenzije / Proizvod</th><th class="num">Ostatak m³</th></tr></thead>
                    <tbody>
                        ${zaostatciProsliDani.map((z) => `
                            <tr>
                                <td>${escapeHtml(prikazDatumaBHS(z.datum_plana))}</td>
                                <td style="color:#b91c1c;font-weight:800;">${razlikaDana(z.datum_plana, danasnjiDatum)} d</td>
                                <td><b>${escapeHtml(z.rn_id)}</b></td>
                                <td>${escapeHtml(z.dimenzije || '')} cm | ${escapeHtml(z.proizvod_naziv || '')}</td>
                                <td class="num">${escapeHtml(formatBrojBHS(parseFloat(z.planirano_m3 || 0), 2))}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : '';

        const daniHtml = DaniUPeriodu.map((dan) => {
            const stavke = raspored.filter((r) => r.datum_plana === dan.iso);
            const uk = stavke.reduce((s, r) => s + (parseFloat(r.planirano_m3 || 0) || 0), 0);
            if (stavke.length === 0) return '';
            return `
                <div style="margin-bottom:12px; page-break-inside:avoid;">
                    <div style="background:#f1f5f9; padding:6px 10px; border-left:4px solid #f59e0b; font-size:10px; font-weight:900; display:flex; justify-content:space-between;">
                        <span>${escapeHtml(dan.ime)} — ${escapeHtml(dan.prikaz)}</span>
                        <span>Ukupno: ${escapeHtml(formatBrojBHS(uk, 2))} / ${escapeHtml(formatBrojBHS(kapacitetMasine, 0))} m³</span>
                    </div>
                    <table>
                        <thead><tr><th>Radni Nalog</th><th>Dimenzije & Proizvod</th><th class="num">Odrađeno</th><th class="num">Preostalo</th><th>Status</th></tr></thead>
                        <tbody>
                            ${stavke.map((st) => `
                                <tr>
                                    <td><b>${escapeHtml(st.rn_id)}</b></td>
                                    <td>${escapeHtml(st.dimenzije || '-')} cm | ${escapeHtml(st.proizvod_naziv || '')}</td>
                                    <td class="num">${escapeHtml(formatBrojBHS(parseFloat(st.proizvedeno_m3 || 0), 2))} m³</td>
                                    <td class="num">${escapeHtml(formatBrojBHS(parseFloat(st.planirano_m3 || 0), 2))} m³</td>
                                    <td>${escapeHtml(st.status || 'ZAKAZANO')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }).join('');

        const bodyHtml = `
            <div class="info-grid">
                <div class="info-col-left">
                    <h4>Mašina / Pogon</h4>
                    <h2>${escapeHtml(odabranaMasina || 'Sve mašine')}</h2>
                    <p>Dnevni kapacitet: <b>${escapeHtml(formatBrojBHS(kapacitetMasine, 0))} m³</b></p>
                </div>
                <div class="info-col-right">
                    <p>Period plana: <b>${escapeHtml(DaniUPeriodu[0].prikaz)} – ${escapeHtml(DaniUPeriodu[6].prikaz)}</b></p>
                    <p>Ukupno zakazano (7d): <b>${escapeHtml(formatBrojBHS(kpiPlaniranja.sedmicaM3, 2))} m³</b></p>
                </div>
            </div>
            ${zaostHtml}
            ${daniHtml || '<p style="text-align:center;color:#64748b;padding:20px;">Nema zakazanih stavki u odabranom 7-dnevnom periodu.</p>'}
        `;

        printDokument(
            `PLAN PROIZVODNJE — ${odabranaMasina}`,
            `PLAN-${danasnjiDatum}`,
            prikazDatumaBHS(danasnjiDatum),
            bodyHtml,
            '#f59e0b'
        );
    };

    return (
        <div className="p-2 md:p-4 max-w-[1800px] mx-auto space-y-4 md:space-y-5 font-bold animate-in fade-in min-h-screen flex flex-col" style={{ color: saas.ui.boja_slova || undefined }}>
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-amber-500" user={user} modulIme="planiranje" saas={saas} hideMasina={true} />
            <PametniDialog {...dialog} />

            {saas.isEditMode && (
                <div className="bg-black/60 p-6 rounded-2xl border-2 border-amber-500/50 shadow-2xl shrink-0">
                    <h3 className="text-amber-500 font-black uppercase text-sm mb-4">God Mode - Kontrole Dizajna Planiranja</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <label className="text-[10px] text-amber-500 uppercase font-black">Boja Kartica: <input type="color" value={saas.ui.boja_kartice} onChange={e => saas.setUi({ ...saas.ui, boja_kartice: e.target.value })} className="w-full h-10 mt-1 cursor-pointer rounded bg-transparent" /></label>
                        <label className="text-[10px] text-amber-500 uppercase font-black">Boja Slova: <input type="color" value={saas.ui.boja_slova} onChange={e => saas.setUi({ ...saas.ui, boja_slova: e.target.value })} className="w-full h-10 mt-1 cursor-pointer rounded bg-transparent" /></label>
                        <label className="text-[10px] text-amber-500 uppercase font-black">Boja Akcenta: <input type="color" value={saas.ui.boja_akcenta} onChange={e => saas.setUi({ ...saas.ui, boja_akcenta: e.target.value })} className="w-full h-10 mt-1 cursor-pointer rounded bg-transparent" /></label>
                    </div>
                </div>
            )}

            {isReadOnly && (
                <div className="bg-blue-900/30 border border-blue-500/50 p-3 md:p-4 rounded-xl md:rounded-2xl flex items-center justify-center gap-3 shrink-0">
                    <span className="text-xl md:text-2xl">👁️</span>
                    <p className="text-blue-400 uppercase tracking-widest text-[10px] md:text-xs font-black text-center">Nalazite se u "Samo Pregled" načinu rada.</p>
                </div>
            )}

            {/* MODAL: PREMJESTI STAVKU NA NOVI DATUM */}
            {premjestiModal && !isReadOnly && (
                <div
                    data-testid="planiranje-premjesti-modal"
                    className="fixed inset-0 z-[10010] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
                    onClick={() => setPremjestiModal(null)}
                >
                    <div
                        className="bg-theme-card border-2 border-amber-500/70 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-2 border-b border-theme-border pb-3">
                            <div>
                                <p className="text-[10px] font-black uppercase text-amber-400 tracking-widest">📅 Premjesti u Rasporedu</p>
                                <h3 className="text-base font-black text-theme-text mt-0.5">{premjestiModal.stavka.rn_id}</h3>
                                <p className="text-xs text-theme-muted font-bold mt-0.5 truncate">{premjestiModal.stavka.dimenzije} cm • {premjestiModal.stavka.proizvod_naziv}</p>
                            </div>
                            <button type="button" onClick={() => setPremjestiModal(null)} className="p-1.5 rounded-xl bg-theme-panel text-theme-muted hover:text-red-400"><X size={16} /></button>
                        </div>

                        <div className="space-y-2">
                            <p className="text-[10px] uppercase font-black text-theme-muted">
                                Trenutni datum plana: <span className="text-theme-text">{prikazDatumaBHS(premjestiModal.stavka.datum_plana)}</span>
                            </p>
                            <label className="text-[10px] uppercase font-black text-amber-400 block">Novi datum proizvodnje (od danas nadalje):</label>
                            <DatumInput
                                min={danasnjiDatum}
                                value={premjestiModal.noviDatum}
                                onChange={(e) => setPremjestiModal((p) => ({ ...p, noviDatum: e.target.value }))}
                                className="w-full border-amber-500/50"
                            />
                            <div className="flex gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setPremjestiModal((p) => ({ ...p, noviDatum: danasnjiDatum }))}
                                    className="flex-1 py-1.5 rounded-lg bg-theme-panel hover:bg-blue-600 hover:text-white border border-theme-border text-[10px] font-black uppercase text-theme-text transition-colors"
                                >
                                    Danas ({prikazDatumaBHS(danasnjiDatum)})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPremjestiModal((p) => ({ ...p, noviDatum: sutrasnjiDatum }))}
                                    className="flex-1 py-1.5 rounded-lg bg-theme-panel hover:bg-blue-600 hover:text-white border border-theme-border text-[10px] font-black uppercase text-theme-text transition-colors"
                                >
                                    Sutra ({prikazDatumaBHS(sutrasnjiDatum)})
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-theme-border">
                            <button type="button" onClick={() => setPremjestiModal(null)} className="flex-1 py-3 rounded-xl bg-theme-panel border border-theme-border text-theme-muted text-[10px] font-black uppercase">Odustani</button>
                            <button
                                type="button"
                                onClick={() => premjestiStavkuNaDatum(premjestiModal.stavka, premjestiModal.noviDatum)}
                                className="flex-[2] py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black uppercase shadow-lg"
                            >
                                ✅ Premjesti na {prikazDatumaBHS(premjestiModal.noviDatum)}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {pregledNaloga && (
                <div className="fixed inset-0 z-[10000] bg-[#090e17]/95 flex items-start sm:items-center justify-center p-2 md:p-4 backdrop-blur-md animate-in zoom-in-95 overflow-y-auto">
                    <div className="bg-theme-card border-2 border-blue-500 p-4 md:p-8 rounded-2xl md:rounded-[2rem] shadow-[0_0_50px_rgba(59,130,246,0.5)] max-w-2xl w-full max-h-[calc(100dvh-1.5rem)] md:max-h-[90vh] flex flex-col relative my-auto">
                        <button onClick={() => setPregledNaloga(null)} className="absolute top-2 right-2 md:top-4 md:right-4 bg-slate-800 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-500 transition-colors z-50"><X size={18} /></button>

                        <div className="flex flex-col sm:flex-row justify-between sm:items-start border-b border-theme-border pb-4 mb-4 gap-2">
                            <div>
                                <h3 className="text-blue-400 font-black uppercase text-[10px] md:text-xs tracking-widest mb-1">Detalji Radnog Naloga</h3>
                                <p className="text-theme-text text-xl md:text-3xl font-black mt-1">{pregledNaloga.id}</p>
                                <p className="text-slate-300 text-xs md:text-sm font-bold bg-theme-panel inline-block px-2 md:px-3 py-1 md:py-1.5 rounded-lg mt-2 border border-theme-border">{pregledNaloga.kupac_naziv}</p>
                            </div>
                            <div className="sm:text-right sm:pt-6">
                                <span className={`text-[9px] md:text-[10px] px-2 md:px-3 py-1 md:py-1.5 rounded-lg font-black uppercase tracking-widest ${parseISODateLocal(pregledNaloga.rok_isporuke) <= DaniUPeriodu[6].datum ? 'bg-red-900/30 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-300'}`}>Rok: {prikazDatumaBHS(pregledNaloga.rok_isporuke)}</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
                            <p className="text-[9px] md:text-[10px] text-slate-500 uppercase font-black mb-3">Stavke na čekanju za mašinu: <span className="text-amber-400">{odabranaMasina}</span></p>
                            <div className="space-y-2 md:space-y-3">
                                {pregledNaloga.stavkeZaPlaniranje.map((st, idx) => (
                                    <div key={idx} className="bg-theme-panel p-3 md:p-4 rounded-xl md:rounded-2xl border border-theme-border flex flex-col sm:flex-row justify-between sm:items-center shadow-md gap-3">
                                        <div>
                                            <p className="text-theme-text text-sm md:text-lg font-black uppercase leading-tight">
                                                <span className="text-amber-500">{st.dimenzije_prikaz || 'N/A'} cm</span> <span className="opacity-50 mx-1">|</span> {st.naziv}
                                            </p>
                                            <p className="text-[9px] md:text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">Šifra: <span className="text-theme-text">{st.sifra}</span></p>
                                        </div>
                                        <div className="sm:text-right bg-black/20 p-2 rounded-lg sm:bg-transparent sm:p-0">
                                            <p className="text-emerald-400 font-black text-xl md:text-3xl">{formatBrojBHS(parseFloat(st.preostalo), 3)} <span className="text-xs md:text-sm">m³</span></p>
                                            <p className="text-[8px] md:text-[10px] text-slate-400 uppercase mt-1 font-bold">~ {formatBrojBHS(st.preostaloOriginal, 2, { minDecimale: 0 })} {st.jm_unos}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {pregledNaloga.napomena && (
                                <div className="mt-4 p-3 md:p-4 bg-amber-900/10 border border-amber-500/20 rounded-xl">
                                    <p className="text-[9px] md:text-[10px] text-amber-500 uppercase font-black mb-1">Napomena na nalogu:</p>
                                    <p className="text-[10px] md:text-xs text-slate-300 leading-relaxed">{pregledNaloga.napomena}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 mt-4 md:mt-6 border-t border-theme-border pt-4">
                            <button onClick={() => setPregledNaloga(null)} className="flex-1 py-3 md:py-4 bg-theme-panel hover:bg-slate-700 text-slate-300 rounded-xl uppercase font-black transition-all border border-slate-600 text-xs">✕ ZATVORI</button>
                            {!isReadOnly && <button onClick={() => { setPregledNaloga(null); otvoriPlaniranjeModal(pregledNaloga); }} className="flex-1 py-3 md:py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl uppercase font-black transition-all shadow-lg text-xs">📅 ZAKAŽI ODMAH</button>}
                        </div>
                    </div>
                </div>
            )}

            {planiranjeModal && !isReadOnly && (
                <div className="fixed inset-0 z-[9999] bg-[#090e17]/90 flex items-start sm:items-center justify-center p-2 md:p-4 backdrop-blur-md animate-in zoom-in-95 overflow-y-auto">
                    <div className="bg-theme-card border-2 border-amber-500 p-4 md:p-8 rounded-2xl md:rounded-[2rem] shadow-[0_0_50px_rgba(245,158,11,0.3)] max-w-2xl w-full max-h-[calc(100dvh-1.5rem)] md:max-h-[90vh] flex flex-col my-auto relative">
                        <button onClick={() => setPlaniranjeModal(null)} className="absolute top-2 right-2 md:top-4 md:right-4 bg-slate-800 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-500 transition-colors z-50"><X size={16} /></button>

                        <div className="flex flex-col sm:flex-row justify-between sm:items-start border-b border-theme-border pb-4 mb-4 gap-4">
                            <div>
                                <h3 className="text-amber-500 font-black uppercase text-[10px] md:text-xs mb-1 tracking-widest">Planiranje Naloga</h3>
                                <p onClick={() => setPregledNaloga(planiranjeModal.nalog)} className="text-blue-400 hover:text-blue-300 cursor-pointer transition-colors text-xl md:text-3xl font-black mb-1 underline decoration-blue-500/50 underline-offset-4" title="Klikni za detaljan pregled naloga">{planiranjeModal.nalog.id}</p>
                                <p className="text-slate-300 text-[10px] md:text-xs font-bold uppercase bg-theme-panel inline-block px-2 py-1 rounded border border-theme-border mt-1 shadow-inner">{planiranjeModal.nalog.kupac_naziv}</p>
                            </div>
                            <div className="w-full sm:w-auto bg-amber-900/10 border border-amber-500/30 p-2 md:p-3 rounded-xl shadow-inner">
                                <label className="text-[9px] md:text-[10px] text-amber-500 uppercase font-black block mb-1 md:mb-2">Odaberi Datum</label>
                                <DatumInput min={danasnjiDatum} value={planiranjeModal.datum} onChange={e => setPlaniranjeModal({ ...planiranjeModal, datum: e.target.value })} className="w-full border-amber-500/50" />
                            </div>
                        </div>

                        <p className="text-[9px] md:text-[10px] text-slate-400 uppercase font-black mb-2 md:mb-3 border-b border-theme-border/50 pb-2">Stavke za mašinu (odčekirajte šta nećete):</p>

                        <div className="flex-1 overflow-y-auto pr-1 md:pr-2 custom-scrollbar space-y-2 md:space-y-3 mb-4 md:mb-6">
                            {stavkeZaPlaniranje.map(st => (
                                <div key={st.id} className={`p-3 md:p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm ${st.checked ? 'bg-theme-panel border-amber-500/50' : 'bg-black/40 border-slate-800 opacity-50'}`}>
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <input type="checkbox" checked={st.checked} onChange={() => toggleStavkaPlaniranje(st.id)} className="w-5 h-5 md:w-6 md:h-6 accent-amber-500 cursor-pointer shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs md:text-sm text-theme-text font-black uppercase truncate leading-tight" title={st.naziv}>
                                                <span className="text-amber-500">{st.dimenzije} cm</span> <span className="opacity-50 mx-1">|</span> {st.naziv}
                                            </p>
                                            <p className="text-[8px] md:text-[10px] text-emerald-400 font-bold uppercase mt-1 tracking-widest">
                                                Na čekanju: <span className="text-white bg-emerald-900/40 px-1 md:px-2 py-0.5 rounded border border-emerald-500/30">{formatBrojBHS(st.preostaloOriginal, 2, { minDecimale: 0 })} {st.jm_unos}</span> <span className="text-slate-500 ml-1">(~ {formatBrojBHS(parseFloat(st.maxKolicina), 3)} m³)</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="w-full sm:w-36 shrink-0 bg-black/30 p-2 rounded-lg sm:bg-transparent sm:p-0">
                                        <label className="text-[7px] md:text-[8px] text-slate-400 uppercase block mb-1 text-center font-bold">Količina ({st.jm_unos})</label>
                                        <input type="number" min="0" step="any" disabled={!st.checked} value={st.kolicinaZaUnos} onChange={(e) => promjeniKolicinuPlaniranja(st.id, e.target.value)} className="w-full min-w-0 p-2 md:p-3 bg-theme-card border border-theme-border rounded-lg text-center font-black text-amber-400 outline-none focus:border-amber-500 disabled:opacity-50 text-base md:text-xl shadow-inner" />
                                        <div className="text-center text-[9px] text-slate-500 mt-1 font-mono">Preračunato: <b className="text-amber-300">~ {formatBrojBHS(parseFloat(st.kolicinaM3 || 0), 3)} m³</b></div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 md:gap-3 pt-4 border-t border-theme-border">
                            <button onClick={() => setPlaniranjeModal(null)} className="flex-1 bg-theme-panel text-slate-300 py-3 md:py-4 rounded-xl uppercase text-[10px] font-black hover:bg-slate-800 border border-slate-600 transition-colors">Odustani</button>
                            <button onClick={potvrdiPlaniranje} className="flex-[2] bg-amber-600 text-white py-3 md:py-4 rounded-xl uppercase text-[10px] font-black hover:bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-all">✅ ZAKAŽI ODABRANO</button>
                        </div>
                    </div>
                </div>
            )}

            {/* GLAVNI TABOVI PLANIRANJA: RASPORED PROIZVODNJE | SUŠARE & SERVIS PILA */}
            <div className="flex bg-theme-panel p-1.5 rounded-2xl border border-theme-border shadow-inner gap-1.5 shrink-0">
                <button
                    type="button"
                    data-testid="planiranje-tab-raspored"
                    onClick={() => setPlanPodTab('raspored')}
                    className={`flex-1 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase transition-all ${planPodTab === 'raspored' ? 'bg-amber-600 text-white shadow-lg' : 'text-theme-muted hover:text-theme-text hover:bg-theme-card'}`}
                >
                    📅 Raspored Proizvodnje
                </button>
                <button
                    type="button"
                    data-testid="planiranje-tab-susare"
                    onClick={() => setPlanPodTab('susare')}
                    className={`flex-1 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase transition-all ${planPodTab === 'susare' ? 'bg-orange-600 text-white shadow-lg' : 'text-theme-muted hover:text-theme-text hover:bg-theme-card'}`}
                >
                    🔥 Sušare & Servis Pila / Mašina
                </button>
            </div>

            {planPodTab === 'susare' ? (
                <SusareServisPanel user={user} />
            ) : (
            <>
            {/* KONTROLNA TRAKA PLANERA (SA BHS DATUMIMA DD.MM.YYYY., DANAS, HISTORIJA, PRINT & MAŠINA) */}
            <div className="flex flex-wrap justify-between items-center bg-theme-card backdrop-blur-[var(--glass-blur)] p-3 md:p-4 rounded-xl md:rounded-2xl border border-theme-border shadow-lg gap-3 shrink-0 w-full max-w-full" style={{ backgroundColor: saas.ui.boja_kartice || undefined }}>
                <div className="flex items-center gap-2.5 min-w-0">
                    <h2 className="text-amber-500 font-black tracking-widest uppercase text-xs md:text-sm flex items-center gap-2 truncate">
                        <span>📅</span> Planer Proizvodnje
                    </h2>
                    {prikaziHistoriju && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[9px] font-black uppercase">
                            Arhiva / Historija
                        </span>
                    )}
                </div>

                <div className="flex flex-wrap w-full xl:w-auto items-center justify-end gap-2 min-w-0">
                    {/* Brzi povratak na Danas */}
                    <button
                        type="button"
                        data-testid="planiranje-danas-btn"
                        onClick={skociNaDanas}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase border transition-all flex items-center gap-1 ${
                            jeNaDanas && !prikaziHistoriju
                                ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                                : 'bg-theme-panel text-theme-text border-theme-border hover:border-blue-500'
                        }`}
                    >
                        🎯 Danas
                    </button>

                    {/* Navigacija perioda (strict DD.MM.YYYY. — zabranjuje prošlost u aktivnom modu) */}
                    <div
                        data-testid="planiranje-range-bar"
                        className="flex items-center justify-between bg-theme-panel rounded-xl border border-theme-border p-1 shadow-inner shrink-0 gap-1"
                    >
                        <button
                            type="button"
                            data-testid="planiranje-prev-btn"
                            disabled={!mozeNazad}
                            onClick={() => shiftPeriod(-7)}
                            title={mozeNazad ? 'Prethodnih 7 dana' : 'Aktivni plan počinje od danas (uključi Historiju za prošle dane)'}
                            className="px-2 py-1.5 hover:bg-theme-card rounded-lg text-theme-text font-black disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={15} />
                        </button>
                        <span
                            data-testid="planiranje-range-label"
                            className="px-2 text-[10px] md:text-xs font-black text-amber-400 text-center whitespace-nowrap"
                        >
                            {DaniUPeriodu[0].prikaz} – {DaniUPeriodu[6].prikaz}
                        </span>
                        <button
                            type="button"
                            data-testid="planiranje-next-btn"
                            onClick={() => shiftPeriod(7)}
                            title="Sljedećih 7 dana"
                            className="px-2 py-1.5 hover:bg-theme-card rounded-lg text-theme-text font-black transition-colors"
                        >
                            <ChevronRight size={15} />
                        </button>
                    </div>

                    {/* Dugme za pregled prošlih dana (samo za uvid / arhivu) */}
                    <button
                        type="button"
                        data-testid="planiranje-historija-btn"
                        onClick={toggleHistorija}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase border transition-all flex items-center gap-1.5 ${
                            prikaziHistoriju
                                ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                                : 'bg-theme-panel text-theme-muted hover:text-theme-text border-theme-border'
                        }`}
                        title="Pregledaj završenu proizvodnju iz prošlih dana (Samo pregled)"
                    >
                        <History size={13} /> Historija
                    </button>

                    {/* Print 7-dnevnog plana */}
                    <button
                        type="button"
                        data-testid="planiranje-print-btn"
                        onClick={stampajRasporedPdf}
                        className="px-3 py-2 rounded-xl bg-theme-panel hover:bg-blue-600 hover:text-white border border-theme-border text-theme-text text-[10px] font-black uppercase flex items-center gap-1.5 transition-all"
                        title="Isprintaj 7-dnevni plan za operatera (A4 PDF)"
                    >
                        <Printer size={13} /> Print Plan
                    </button>

                    {/* Izbor mašine */}
                    <select
                        value={odabranaMasina}
                        onChange={e => {
                            setOdabranaMasina(e.target.value);
                            const cap = parseFloat(masine.find(m => m.naziv === e.target.value)?.dnevni_kapacitet_m3);
                            setKapacitetMasine(Number.isFinite(cap) && cap > 0 ? cap : 30);
                        }}
                        className="flex-1 sm:flex-initial max-w-full sm:max-w-[260px] min-w-0 bg-theme-panel text-theme-text px-3 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase outline-none border border-theme-border shadow-inner focus:border-amber-500 cursor-pointer truncate"
                    >
                        {masine.map(m => (
                            <option key={m.naziv} value={m.naziv}>
                                {m.naziv} (Kap: {formatBrojBHS(m.dnevni_kapacitet_m3 || 30, 0)} m³)
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* OPERATIVNA KPI TRAKA (MES PREGLED) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
                <div className={`p-3.5 rounded-2xl border shadow-md bg-theme-card ${zaostatciProsliDani.length > 0 ? 'border-red-500/60 bg-red-950/15' : 'border-emerald-500/35'}`}>
                    <span className="text-[9px] uppercase font-black text-theme-muted block">⚠️ Zaostatci od Ranije</span>
                    <p className={`text-lg font-black mt-0.5 ${zaostatciProsliDani.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {zaostatciProsliDani.length} stavki • {formatBrojBHS(ukupnoZaostatakM3, 2)} m³
                    </p>
                    <span className="text-[10px] text-theme-muted font-bold">
                        {zaostatciProsliDani.length > 0 ? 'Nezavršeni zadaci prije danas' : 'Nema kašnjenja u proizvodnji'}
                    </span>
                </div>
                <div className="p-3.5 rounded-2xl border border-blue-500/40 shadow-md bg-theme-card">
                    <span className="text-[9px] uppercase font-black text-theme-muted block">🎯 Danas Zakazano ({prikazDatumaBHS(danasnjiDatum)})</span>
                    <p className="text-lg font-black text-blue-400 mt-0.5">
                        {formatBrojBHS(kpiPlaniranja.danasM3, 2)} m³ <span className="text-xs text-theme-muted">/ {formatBrojBHS(kapacitetMasine, 0)} m³</span>
                    </p>
                    <span className="text-[10px] text-theme-muted font-bold">Opterećenje: {formatBrojBHS(kpiPlaniranja.danasPct, 1)}%</span>
                </div>
                <div className="p-3.5 rounded-2xl border border-amber-500/40 shadow-md bg-theme-card">
                    <span className="text-[9px] uppercase font-black text-theme-muted block">📊 Vidljivih 7 Dana</span>
                    <p className="text-lg font-black text-amber-400 mt-0.5">
                        {formatBrojBHS(kpiPlaniranja.sedmicaM3, 2)} m³
                    </p>
                    <span className="text-[10px] text-theme-muted font-bold">Prosječna popunjenost: {formatBrojBHS(kpiPlaniranja.sedmicaPct, 1)}%</span>
                </div>
                <div className="p-3.5 rounded-2xl border border-emerald-500/40 shadow-md bg-theme-card">
                    <span className="text-[9px] uppercase font-black text-theme-muted block">📋 Neraspoređeno Čeka</span>
                    <p className="text-lg font-black text-emerald-400 mt-0.5">
                        {nerasporedjeniNalozi.length} naloga • {formatBrojBHS(kpiPlaniranja.neraspM3, 2)} m³
                    </p>
                    <span className="text-[10px] text-theme-muted font-bold">
                        {kpiPlaniranja.hitniNalozi > 0 ? `🔥 ${kpiPlaniranja.hitniNalozi} hitnih u narednih 7 dana` : 'Svi rokovi pod kontrolom'}
                    </span>
                </div>
            </div>

            {/* 🔴 MES / APS CARRYOVER PANEL: NEZAVRŠENE RADNJE IZ PROŠLIH DANA */}
            {zaostatciProsliDani.length > 0 && (
                <div
                    data-testid="planiranje-zaostatci-panel"
                    className="bg-gradient-to-r from-red-950/35 via-theme-card to-amber-950/25 border-2 border-red-500/50 rounded-2xl p-3.5 md:p-4 shadow-xl shrink-0"
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={() => setZaostatciProsireno((v) => !v)}
                            className="flex items-center gap-2.5 text-left"
                        >
                            <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/50 text-red-400 flex items-center justify-center shrink-0">
                                <AlertTriangle size={18} />
                            </div>
                            <div>
                                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-red-400 flex items-center gap-2">
                                    Nezavršeni Zaostatci od Ranije (Carryover)
                                    <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px]">
                                        {zaostatciProsliDani.length}
                                    </span>
                                </h3>
                                <p className="text-[10px] text-theme-muted font-bold">
                                    Stavke zakazane prije {prikazDatumaBHS(danasnjiDatum)} koje još nisu završene ({formatBrojBHS(ukupnoZaostatakM3, 2)} m³) — prebacite ih jednim klikom na današnji ili novi termin.
                                </p>
                            </div>
                        </button>

                        <div className="flex items-center gap-2">
                            {!isReadOnly && (
                                <button
                                    type="button"
                                    data-testid="planiranje-prebaci-sve-danas-btn"
                                    onClick={prebaciSveZaostatkeNaDanas}
                                    className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black uppercase flex items-center gap-1.5 shadow-lg transition-all"
                                >
                                    <Zap size={13} /> Prebaci Sve na Danas
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setZaostatciProsireno((v) => !v)}
                                className="p-2 rounded-xl bg-theme-panel border border-theme-border text-theme-muted hover:text-theme-text"
                            >
                                {zaostatciProsireno ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                        </div>
                    </div>

                    {zaostatciProsireno && (
                        <div className="mt-3 pt-3 border-t border-red-500/25 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                            {zaostatciProsliDani.map((st) => {
                                const kasni = Math.max(1, razlikaDana(st.datum_plana, danasnjiDatum));
                                const plan = parseFloat(st.planirano_m3 || 0);
                                const proizvedeno = parseFloat(st.proizvedeno_m3 || 0);
                                const uk = plan + proizvedeno;
                                const pct = uk > 0 ? Math.round((proizvedeno / uk) * 100) : 0;

                                return (
                                    <div key={st.id} className="bg-theme-card/90 border border-red-500/40 rounded-xl p-3 flex flex-col justify-between gap-2.5 shadow-md">
                                        <div>
                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                                <span className="text-[10px] font-black text-blue-400 bg-blue-950/40 border border-blue-500/30 px-2 py-0.5 rounded-lg truncate">{st.rn_id}</span>
                                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg bg-red-600/25 text-red-300 border border-red-500/40 whitespace-nowrap">
                                                    ⏳ Kasni {kasni} d ({prikazDatumaBHS(st.datum_plana)})
                                                </span>
                                            </div>
                                            <p className="text-xs font-black text-theme-text uppercase truncate" title={st.proizvod_naziv}>
                                                <span className="text-amber-400">{st.dimenzije || 'N/A'} cm</span> | {st.proizvod_naziv}
                                            </p>
                                            <div className="mt-2 flex items-center justify-between text-[10px] text-theme-muted font-bold">
                                                <span>Odrađeno: <b className="text-emerald-400">{formatBrojBHS(proizvedeno, 2)} m³</b> ({pct}%)</span>
                                                <span>Ostatak: <b className="text-red-400">{formatBrojBHS(plan, 2)} m³</b></span>
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                                                <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>

                                        {!isReadOnly && (
                                            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-theme-border/60">
                                                <button
                                                    type="button"
                                                    onClick={() => premjestiStavkuNaDatum(st, danasnjiDatum)}
                                                    className="flex-1 py-1.5 px-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[9px] font-black uppercase transition-colors whitespace-nowrap"
                                                >
                                                    ⚡ Na Danas
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setPremjestiModal({ stavka: st, noviDatum: danasnjiDatum })}
                                                    className="flex-1 py-1.5 px-2 rounded-lg bg-theme-panel hover:bg-blue-600 hover:text-white border border-theme-border text-theme-text text-[9px] font-black uppercase transition-colors whitespace-nowrap"
                                                >
                                                    📅 Novi Datum
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => oznaciZaostatakZavrsenim(st)}
                                                    title="Označi stavku završenom"
                                                    className="py-1.5 px-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/40 text-[9px] font-black uppercase transition-colors"
                                                >
                                                    ✓
                                                </button>
                                                {proizvedeno <= 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => obrisiIzPlana(st.id, e)}
                                                        title="Vrati u neraspoređene naloge"
                                                        className="py-1.5 px-2 rounded-lg bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white text-[9px] font-black uppercase transition-colors"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-4 md:gap-5 flex-1 min-h-[540px]">

                {/* LIJEVA KOLONA: NERASPOREDJENI NALOZI SA PRETRAGOM */}
                <div className="w-full lg:w-[340px] max-h-[48vh] lg:max-h-[75vh] bg-theme-card backdrop-blur-[var(--glass-blur)] border border-theme-border rounded-xl md:rounded-2xl flex flex-col shadow-2xl shrink-0" style={{ backgroundColor: saas.ui.boja_kartice || undefined }}>
                    <div className="p-3 md:p-4 border-b border-theme-border bg-theme-card/90 sticky top-0 z-10 rounded-t-2xl space-y-2.5">
                        <h3 className="text-[10px] md:text-xs text-slate-400 font-black uppercase tracking-widest flex justify-between items-center">
                            Neraspoređeno <span className="bg-theme-panel px-2 py-0.5 rounded text-theme-text">{filtriraniNerasporedjeni.length}</span>
                        </h3>
                        <div className="relative">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                            <input
                                type="text"
                                value={pretragaNaloga}
                                onChange={(e) => setPretragaNaloga(e.target.value)}
                                placeholder="Traži RN, kupca ili artikal..."
                                className="w-full pl-8 pr-3 py-2 bg-theme-panel border border-theme-border rounded-xl text-[11px] text-theme-text font-bold outline-none focus:border-amber-500"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 md:p-3 space-y-2 md:space-y-3 custom-scrollbar">
                        {loading && <div className="text-center text-amber-500 text-[10px] md:text-xs animate-pulse p-4 font-black">Učitavam...</div>}
                        {!loading && filtriraniNerasporedjeni.length === 0 && (
                            <div className="text-center text-slate-500 text-[10px] p-5 border border-dashed border-theme-border rounded-xl font-bold mt-2">
                                {pretragaNaloga ? 'Nema naloga za traženi pojam.' : 'Nema neraspoređenih naloga!'}
                            </div>
                        )}

                        {!loading && filtriraniNerasporedjeni.map((rn) => {
                            const jeProsaoRok = Boolean(rn.rok_isporuke && rn.rok_isporuke < danasnjiDatum);
                            const isHitno = jeProsaoRok || parseISODateLocal(rn.rok_isporuke) <= DaniUPeriodu[6].datum;
                            const preostaloM3Num = rn.stavkeZaPlaniranje.reduce((s, st) => s + parseFloat(st.preostalo), 0);
                            const preporuceniDatum = izracunajPreporuku(rn.rok_isporuke);
                            const preporukaText = `${IMENA_DANA_BHS[preporuceniDatum.getDay()]} (${prikazDatumaBHS(preporuceniDatum)})`;

                            return (
                                <div
                                    id={`rn_card_${rn.id}`}
                                    key={rn.id}
                                    draggable={!isReadOnly}
                                    onDragStart={(e) => !isReadOnly && handleDragStart(e, rn)}
                                    className={`p-3 md:p-4 rounded-xl md:rounded-2xl transition-all group ${highlightedRN === rn.id
                                            ? 'bg-amber-900/40 border-2 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.6)] animate-pulse scale-[1.02] z-50 relative'
                                            : 'bg-theme-panel border ' + (jeProsaoRok ? 'border-red-500/70 shadow-[0_0_12px_rgba(239,68,68,0.18)]' : isHitno ? 'border-rose-500/50' : 'border-theme-border') + ' ' + (!isReadOnly ? 'cursor-grab active:cursor-grabbing hover:border-blue-500/50 hover:bg-slate-800/60' : 'opacity-90')
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2 gap-2">
                                        <span className="text-[10px] md:text-[11px] text-blue-400 font-black uppercase bg-blue-900/20 px-2 py-0.5 md:py-1 rounded border border-blue-500/30 truncate">{rn.id}</span>
                                        <span className={`text-[8px] md:text-[9px] font-black uppercase px-2 py-0.5 md:py-1 rounded whitespace-nowrap ${jeProsaoRok ? 'bg-red-600 text-white' : isHitno ? 'bg-rose-900/30 text-rose-400' : 'bg-theme-card text-slate-400 border border-theme-border'}`}>
                                            {jeProsaoRok ? '🔥 KASNI: ' : 'Rok: '}{prikazDatumaBHS(rn.rok_isporuke)}
                                        </span>
                                    </div>
                                    <p className="text-theme-text text-xs md:text-sm font-bold uppercase truncate">{rn.kupac_naziv}</p>

                                    <div className="mt-2 md:mt-3 flex justify-between items-center border-t border-theme-border/50 pt-2 md:pt-3">
                                        <span className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest">Stavki: <span className="text-theme-text">{rn.stavkeZaPlaniranje.length}</span></span>
                                        <span className="text-sm md:text-lg text-emerald-400 font-black bg-emerald-900/10 px-2 md:px-3 py-0.5 md:py-1 rounded-lg border border-emerald-500/20 shadow-sm">
                                            {formatBrojBHS(preostaloM3Num, 2)} <span className="text-[9px] text-emerald-600">m³</span>
                                        </span>
                                    </div>

                                    {!isReadOnly && (
                                        <div className="mt-2 bg-blue-900/10 border border-blue-500/20 p-1.5 md:p-2 rounded-lg flex items-center justify-between gap-1 shadow-inner">
                                            <span className="text-[8px] md:text-[9px] text-blue-400 uppercase font-black tracking-widest shrink-0">💡 Preporuka:</span>
                                            <span className="text-[9px] text-white font-bold bg-blue-600/40 px-1.5 py-0.5 rounded truncate">{preporukaText}</span>
                                        </div>
                                    )}

                                    <div className="mt-2 md:mt-3 flex gap-2">
                                        <button onClick={() => setPregledNaloga(rn)} className="flex-[1] bg-theme-card text-blue-400 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase border border-theme-border hover:bg-slate-700 hover:text-white transition-colors">👁️ Detalji</button>
                                        {!isReadOnly && <button onClick={() => otvoriPlaniranjeModal(rn)} className="flex-[2] bg-amber-600 text-white py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase hover:bg-amber-500 transition-colors shadow-md">📅 Zakaži</button>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* DESNA STRANA: 7-DNEVNI RASPORED (POČINJE OD DANAS!) */}
                <div
                    data-testid="planiranje-calendar-grid"
                    className="flex-1 bg-theme-card/50 backdrop-blur-[var(--glass-blur)] border border-theme-border rounded-xl md:rounded-2xl shadow-2xl flex overflow-x-auto snap-x snap-mandatory custom-scrollbar min-h-[450px] max-h-[75vh]"
                >
                    {DaniUPeriodu.map((dan) => {
                        const stavkeZaDan = raspored.filter(r => r.datum_plana === dan.iso);
                        const ukupnoDanas = stavkeZaDan.reduce((sum, r) => sum + parseFloat(r.planirano_m3 || 0), 0);
                        const isPrekoKapaciteta = ukupnoDanas > kapacitetMasine;
                        const procenat = kapacitetMasine > 0 ? Math.min(100, (ukupnoDanas / kapacitetMasine) * 100) : 0;

                        return (
                            <div
                                key={dan.iso}
                                data-testid={`planiranje-day-col-${dan.iso}`}
                                onDragOver={!isReadOnly && !dan.jeProslost ? handleDragOver : undefined}
                                onDragLeave={!isReadOnly && !dan.jeProslost ? handleDragLeave : undefined}
                                onDrop={!isReadOnly && !dan.jeProslost ? (e) => handleDrop(e, dan.iso) : undefined}
                                className={`flex-1 min-w-[255px] md:min-w-[245px] border-r border-theme-border last:border-0 flex flex-col transition-colors snap-center ${
                                    dan.jeDanas
                                        ? 'bg-blue-950/20 ring-1 ring-inset ring-blue-500/40'
                                        : dan.jeProslost
                                        ? 'bg-slate-950/35 opacity-85'
                                        : ''
                                }`}
                            >
                                <div className="p-2.5 md:p-3 border-b border-theme-border/60 text-center shrink-0 bg-theme-panel/70 sticky top-0 z-10 backdrop-blur-md">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <h4 className="text-[9px] md:text-[10px] text-slate-400 uppercase font-black tracking-widest">{dan.ime}</h4>
                                        {dan.jeDanas && (
                                            <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[8px] font-black uppercase">DANAS</span>
                                        )}
                                        {dan.jeSutra && (
                                            <span className="px-1.5 py-0.5 rounded bg-amber-600/30 text-amber-300 border border-amber-500/40 text-[8px] font-black uppercase">SUTRA</span>
                                        )}
                                        {dan.jeProslost && (
                                            <span className="px-1.5 py-0.5 rounded bg-purple-600/25 text-purple-300 border border-purple-500/40 text-[8px] font-black uppercase">ARHIVA</span>
                                        )}
                                    </div>
                                    <h3 className={`text-sm md:text-base font-black mt-0.5 ${dan.jeDanas ? 'text-blue-400' : 'text-theme-text'}`}>
                                        {dan.prikaz}
                                    </h3>

                                    <div className="mt-2 bg-black/30 p-1.5 md:p-2 rounded-lg md:rounded-xl border border-theme-border/50 shadow-inner">
                                        <div className="flex justify-between text-[8px] font-black uppercase mb-1">
                                            <span className={isPrekoKapaciteta ? 'text-red-400' : 'text-emerald-400'}>
                                                {formatBrojBHS(ukupnoDanas, 2)} m³ ({formatBrojBHS(procenat, 0)}%)
                                            </span>
                                            <span className="text-slate-500">MAX {formatBrojBHS(kapacitetMasine, 0)}</span>
                                        </div>
                                        <div className="w-full h-1.5 md:h-2 bg-black rounded-full overflow-hidden border border-slate-700">
                                            <div className={`h-full transition-all ${isPrekoKapaciteta ? 'bg-red-500' : (procenat > 85 ? 'bg-amber-500' : 'bg-emerald-500')}`} style={{ width: `${procenat}%` }}></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                                    {stavkeZaDan.length === 0 && (
                                        <div className="text-[9px] text-slate-500 text-center uppercase font-bold mt-6 p-3 border border-dashed border-theme-border/50 rounded-xl">
                                            {dan.jeProslost ? 'Nema zapisa' : 'Slobodno — prevuci nalog'}
                                        </div>
                                    )}
                                    {stavkeZaDan.map(st => {
                                        const dijeljen = isNalogDijeljen(st.rn_id);
                                        const plan = parseFloat(st.planirano_m3 || 0);
                                        const proizvedeno = parseFloat(st.proizvedeno_m3 || 0);
                                        const ukupniBlok = plan + proizvedeno;
                                        const procenatBloka = ukupniBlok > 0 ? Math.round((proizvedeno / ukupniBlok) * 100) : 0;

                                        const jeZavrseno = st.status === 'ZAVRŠENO' || procenatBloka >= 100;
                                        const jeKasniArhiva = dan.jeProslost && !jeZavrseno;

                                        return (
                                            <div
                                                key={st.id}
                                                className={`bg-theme-panel p-2.5 md:p-3 rounded-xl border ${
                                                    jeZavrseno
                                                        ? 'border-emerald-500/50 bg-emerald-900/20'
                                                        : jeKasniArhiva
                                                        ? 'border-red-500/60 bg-red-950/25'
                                                        : 'border-theme-border hover:border-amber-500/50'
                                                } shadow-md group transition-all`}
                                            >
                                                <div className="flex justify-between items-start mb-2 gap-1">
                                                    <span className="text-[9px] md:text-[10px] text-blue-300 uppercase font-black bg-blue-900/20 px-2 py-0.5 rounded border border-blue-500/30 truncate max-w-[70%]">{st.rn_id}</span>
                                                    {!isReadOnly && (
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            {!jeZavrseno && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPremjestiModal({ stavka: st, noviDatum: dan.jeProslost ? danasnjiDatum : dan.iso })}
                                                                    title="Premjesti na drugi datum"
                                                                    className="text-amber-400 bg-amber-900/30 hover:bg-amber-500 hover:text-white w-6 h-6 flex items-center justify-center rounded-md text-[10px] font-black transition-colors"
                                                                >
                                                                    <Calendar size={11} />
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={(e) => obrisiIzPlana(st.id, e)}
                                                                title="Ukloni iz plana"
                                                                className="text-red-500 bg-red-900/30 w-6 h-6 flex items-center justify-center rounded-md text-[10px] font-black hover:bg-red-500 hover:text-white"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {dijeljen && <span className="text-[7px] md:text-[8px] bg-amber-900/40 text-amber-400 px-1.5 py-0.5 rounded uppercase font-black border border-amber-500/30 mb-1.5 inline-block">✂️ DIJELJEN NALOG</span>}
                                                {jeKasniArhiva && <span className="text-[7px] md:text-[8px] bg-red-600 text-white px-1.5 py-0.5 rounded uppercase font-black mb-1.5 ml-1 inline-block">⚠️ NEZAVRŠENO</span>}

                                                <p className="text-[10px] md:text-[11px] text-theme-text font-black uppercase leading-tight truncate mb-1" title={st.proizvod_naziv}>
                                                    <span className="text-amber-500">{st.dimenzije || 'N/A'} cm</span> <span className="opacity-50 mx-1">|</span> {st.proizvod_naziv}
                                                </p>

                                                <div className="mt-2.5 bg-black/40 p-1.5 rounded-lg border border-slate-700/50">
                                                    <div className="flex justify-between text-[8px] text-slate-400 uppercase font-black mb-1">
                                                        <span>{formatBrojBHS(proizvedeno, 2)} m³ ODRADIO</span>
                                                        <span className={jeZavrseno ? 'text-emerald-400' : 'text-amber-400'}>{procenatBloka}%</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${procenatBloka}%` }}></div>
                                                    </div>
                                                </div>

                                                <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-slate-700/50">
                                                    <span className={`text-[8px] uppercase font-black px-1.5 py-0.5 rounded flex items-center gap-1 ${jeZavrseno ? 'bg-emerald-500/20 text-emerald-400' : jeKasniArhiva ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                        {jeZavrseno && <CheckCircle2 size={10} />}
                                                        {jeZavrseno ? 'ZAVRŠENO' : jeKasniArhiva ? 'ZAOSTATAK' : 'ZAKAZANO'}
                                                    </span>
                                                    <span className="text-xs text-theme-text font-black">
                                                        Ostatak: <span className="text-amber-400">{formatBrojBHS(plan, 2)}</span> <span className="text-[9px] text-slate-500">m³</span>
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            </>
            )}
        </div>
    );
}
