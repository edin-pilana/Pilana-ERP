"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import MasterHeader from '../components/MasterHeader';
import PametniDialog from '../components/PametniDialog';
import { useSaaS } from '../utils/useSaaS';
import { ChevronLeft, ChevronRight, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

// 🟢 ČISTO FORMATIRANJE DATUMA BEZ UTC POMAKA (06.11.2026. ostaje 06.11.2026.)
const formatirajDatumBezPomaka = (isoStr) => {
    if (!isoStr) return 'N/A';
    const clean = isoStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length !== 3) return isoStr;
    return `${parts[2]}.${parts[1]}.${parts[0]}.`;
};

const parseLocalIsoDate = (isoStr) => {
    if (!isoStr) return new Date();
    const clean = isoStr.split('T')[0];
    const [y, m, d] = clean.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
};

const toLocalIsoString = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export default function PlaniranjeModule({ user, header, setHeader, onExit }) {
    const saas = useSaaS('planiranje_modul', {
        boja_kartice: '#1e293b', boja_slova: '#ffffff', boja_akcenta: '#f59e0b'
    });

    const danasnjiDatum = toLocalIsoString(new Date());
    const isReadOnly = user?.uloga !== 'admin' && user?.uloga !== 'superadmin' && !(user?.dozvole || []).includes('Planiranje Proizvodnje');

    const [loading, setLoading] = useState(true);
    const [masine, setMasine] = useState([]);
    const [odabranaMasina, setOdabranaMasina] = useState('');
    const [kapacitetMasine, setKapacitetMasine] = useState(30);
    const [katalog, setKatalog] = useState([]);

    const [nerasporedjeniNalozi, setNerasporedjeniNalozi] = useState([]);
    const [raspored, setRaspored] = useState([]);
    const [sviPlanoviGlobal, setSviPlanoviGlobal] = useState([]); 
    
    const [pocetakSedmice, setPocetakSedmice] = useState(getStartOfWeek(new Date()));
    const [highlightedRN, setHighlightedRN] = useState(null);
    const [dialog, setDialog] = useState({ isOpen: false });
    const prikaziDialog = (opcije) => setDialog({ isOpen: true, confirmText: 'POTVRDI', cancelText: 'ZATVORI', ...opcije });
    const zatvoriDialog = () => setDialog({ isOpen: false });

    const [pregledNaloga, setPregledNaloga] = useState(null); 
    const [planiranjeModal, setPlaniranjeModal] = useState(null); 
    const [stavkeZaPlaniranje, setStavkeZaPlaniranje] = useState([]); 

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
    useEffect(() => { if (odabranaMasina && katalog.length > 0) loadRaspored(); }, [odabranaMasina, pocetakSedmice, katalog]);

    function getStartOfWeek(date) {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.getFullYear(), d.getMonth(), diff);
    }

    const shiftWeek = (smjer) => {
        const d = new Date(pocetakSedmice.getFullYear(), pocetakSedmice.getMonth(), pocetakSedmice.getDate() + (smjer * 7));
        setPocetakSedmice(d);
    };

    const loadInitialData = async () => {
        const { data: mData } = await supabase.from('masine').select('naziv, dnevni_kapacitet_m3, dozvoljeni_moduli').order('naziv');
        if (mData) {
            setMasine(mData);
            if (mData.length > 0) {
                setOdabranaMasina(mData[0].naziv);
                setKapacitetMasine(parseFloat(mData[0].dnevni_kapacitet_m3) || 30);
            }
        }
        const { data: kData } = await supabase.from('katalog_proizvoda').select('*');
        if (kData) setKatalog(kData);
    };

    const loadRaspored = async () => {
        setLoading(true);
        const krajSedmice = new Date(pocetakSedmice.getFullYear(), pocetakSedmice.getMonth(), pocetakSedmice.getDate() + 6);
        const dOd = toLocalIsoString(pocetakSedmice);
        const dDo = toLocalIsoString(krajSedmice);

        const { data: raspData } = await supabase.from('raspored_proizvodnje')
            .select('*').eq('masina', odabranaMasina).gte('datum_plana', dOd).lte('datum_plana', dDo);
        setRaspored(raspData || []);

        const { data: sviPlanovi } = await supabase.from('raspored_proizvodnje').select('*').eq('masina', odabranaMasina);
        setSviPlanoviGlobal(sviPlanovi || []);

        const { data: rnData } = await supabase.from('radni_nalozi').select('*').neq('status', 'ZAVRŠENO').neq('status', 'OBRISANO');
        
        let naloziZaLijevuStranu = [];

        (rnData || []).forEach(rn => {
            let imaNerasporedjeno = false;
            let stavkeZaMasinu = [];

            (rn.stavke_jsonb || []).forEach(st => {
                let ukupnoZaUraditiM3 = 0;
                let jm_unos = st.jm_unos || 'kom';
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

                        // 🟢 Koristi ulazne dimenzije FAZE (npr. 2.4x17x420 cm) ako su unesene u BOM-u!
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
                    ukupnoZaUraditiM3 = parseFloat(st.kolicina_obracun || 0);
                    if (vol1kom > 0) {
                        if (jm_unos === 'kom') ukupnoZaUraditiM3 = originalKol * vol1kom;
                        else if (jm_unos === 'm2' && area1kom > 0) ukupnoZaUraditiM3 = (originalKol / area1kom) * vol1kom;
                        else if (jm_unos === 'm1' && len1kom > 0) ukupnoZaUraditiM3 = (originalKol / len1kom) * vol1kom;
                    }
                }

                if (ukupnoZaUraditiM3 > 0) {
                    const vecZauzetoIliGotovo = (sviPlanovi || []).filter(p => p.rn_id === rn.id && p.stavka_id === st.id).reduce((s, p) => s + parseFloat(p.planirano_m3 || 0) + parseFloat(p.proizvedeno_m3 || 0), 0);
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

        setNerasporedjeniNalozi(naloziZaLijevuStranu.sort((a,b) => parseLocalIsoDate(a.rok_isporuke) - parseLocalIsoDate(b.rok_isporuke)));
        setLoading(false);
    };

    const izracunajPreporuku = (rok_isporuke) => {
        const rokDate = parseLocalIsoDate(rok_isporuke);
        const preporukaDate = new Date(rokDate.getFullYear(), rokDate.getMonth(), rokDate.getDate() - 2);
        const danas = parseLocalIsoDate(danasnjiDatum);
        return preporukaDate < danas ? danas : preporukaDate;
    };

    const handleDragStart = (e, nalog) => { e.dataTransfer.setData('nalogId', nalog.id); };
    const handleDragOver = (e) => { e.preventDefault(); e.currentTarget.classList.add('bg-white/5'); };
    const handleDragLeave = (e) => { e.currentTarget.classList.remove('bg-white/5'); };

    const handleDrop = (e, ciljniDatum) => {
        e.preventDefault();
        e.currentTarget.classList.remove('bg-white/5');
        const nalogId = e.dataTransfer.getData('nalogId');
        if (!nalogId) return;
        const nalog = nerasporedjeniNalozi.find(n => n.id === nalogId);
        if(!nalog) return;
        otvoriPlaniranjeModal(nalog, ciljniDatum);
    };

    const otvoriPlaniranjeModal = (nalog, datum = '') => {
        if(isReadOnly) return;
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
        if (!finalniDatum) { finalniDatum = toLocalIsoString(izracunajPreporuku(nalog.rok_isporuke)); }
        setStavkeZaPlaniranje(pocetnoStanjeStavki);
        setPlaniranjeModal({ nalog, datum: finalniDatum });
    };

    const toggleStavkaPlaniranje = (id) => { setStavkeZaPlaniranje(prev => prev.map(s => s.id === id ? { ...s, checked: !s.checked } : s)); };
    
    const promjeniKolicinuPlaniranja = (id, novaKolOriginal) => { 
        setStavkeZaPlaniranje(prev => prev.map(s => {
            if (s.id === id) {
                const unos = parseFloat(novaKolOriginal) || 0;
                let komada = unos;
                if (s.jm_unos === 'm3' && s.vol1kom > 0) komada = unos / s.vol1kom;
                else if (s.jm_unos === 'm2' && s.area1kom > 0) komada = unos / s.area1kom;
                else if (s.jm_unos === 'm1' && s.len1kom > 0) komada = unos / s.len1kom;

                let novim3 = (komada * s.vol1kom).toFixed(4);
                if (s.jm_unos === 'm3') novim3 = unos.toFixed(4);
                
                if (s.vol1kom === 0 && s.jm_unos === 'kom') {
                    const ratio = unos / parseFloat(s.preostaloOriginal);
                    novim3 = (parseFloat(s.maxKolicina) * ratio).toFixed(4);
                }

                return { ...s, kolicinaZaUnos: novaKolOriginal, kolicinaM3: isNaN(novim3) ? 0 : novim3 };
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
        // Odmah zatvori modal da spriječiš bilo kakav dupli klik!
        setPlaniranjeModal(null);

        try {
            const payload = stavkeZaBazu.map(s => ({
                rn_id: aktivniModal.nalog.id, stavka_id: s.id, proizvod_naziv: s.naziv, dimenzije: s.dimenzije,
                masina: odabranaMasina, datum_plana: aktivniModal.datum, 
                planirano_m3: parseFloat(s.kolicinaM3), proizvedeno_m3: 0, status: 'ZAKAZANO', snimio_korisnik: user?.ime_prezime || 'Nepoznat'
            }));

            const { error } = await supabase.from('raspored_proizvodnje').insert(payload);
            if (error) {
                toast.error("Greška pri zakazivanju: " + error.message);
            } else {
                toast.success(`Radni nalog ${aktivniModal.nalog.id} uspješno zakazan za ${formatirajDatumBezPomaka(aktivniModal.datum)}!`);
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
            if (isNaN(kol) || kol <= 0) { toast.warning(`Količina za ${s.naziv} nije ispravna!`); neispravanUnos = true; }
            if (kol > parseFloat(s.preostaloOriginal) + 0.01) { prekoracenaStavka = s; }
            ukupnoNovihKubika += m3ZaDodati;
        });
        if (neispravanUnos) return;

        const danStr = planiranjeModal.datum;
        const trenutnoPlaniranoNaDan = raspored.filter(r => r.datum_plana === danStr).reduce((s, r) => s + parseFloat(r.planirano_m3 || 0), 0);
        const prelaziKapacitet = (trenutnoPlaniranoNaDan + ukupnoNovihKubika) > kapacitetMasine;

        if (prekoracenaStavka || prelaziKapacitet) {
            let porukaUpozorenja = '';
            if (prekoracenaStavka) {
                porukaUpozorenja += `• Za stavku "${prekoracenaStavka.naziv}" unijeli ste više nego što je preostalo u nalogu.\n\n`;
            }
            if (prelaziKapacitet) {
                porukaUpozorenja += `• KAPACITET PREMAŠEN: Na dan ${formatirajDatumBezPomaka(danStr)} je već planirano ${trenutnoPlaniranoNaDan.toFixed(2)} m³. Sa ovim dodajete još ${ukupnoNovihKubika.toFixed(2)} m³, čime prelazite dnevni limit od ${kapacitetMasine} m³.\n\n`;
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

    const obrisiIzPlana = (id, e) => {
        e.stopPropagation();
        prikaziDialog({
            tip: 'upozorenje',
            naslov: 'Uklanjanje iz rasporeda',
            poruka: 'Ukloniti ovu stavku iz rasporeda? Ona će se automatski vratiti nazad na listu neraspoređenih naloga.',
            confirmText: '🗑️ UKLONI IZ PLANA',
            cancelText: '✕ ZADRŽI',
            onConfirm: async () => {
                await supabase.from('raspored_proizvodnje').delete().eq('id', id);
                zatvoriDialog();
                toast.info("Stavka uklonjena iz rasporeda.");
                loadRaspored();
            },
            onCancel: zatvoriDialog
        });
    };

    const DaniUSedmici = useMemo(() => {
        const dani = []; const imena = ['PONEDJELJAK', 'UTORAK', 'SRIJEDA', 'ČETVRTAK', 'PETAK', 'SUBOTA', 'NEDJELJA'];
        for(let i=0; i<7; i++) {
            const d = new Date(pocetakSedmice.getFullYear(), pocetakSedmice.getMonth(), pocetakSedmice.getDate() + i);
            dani.push({ datum: d, ime: imena[i], iso: toLocalIsoString(d) });
        }
        return dani;
    }, [pocetakSedmice]);

    const isNalogDijeljen = (rn_id) => {
        const jedinstveniDani = new Set(sviPlanoviGlobal.filter(p => p.rn_id === rn_id).map(p => p.datum_plana));
        return jedinstveniDani.size > 1;
    };
    const imenaDanaBHS = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];

    return (
        <div className="p-2 md:p-4 max-w-[1800px] mx-auto space-y-4 md:space-y-6 font-bold animate-in fade-in min-h-screen flex flex-col" style={{ color: saas.ui.boja_slova }}>
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-amber-500" user={user} modulIme="planiranje" saas={saas} hideMasina={true} />
            <PametniDialog {...dialog} />

            {saas.isEditMode && (
                <div className="bg-black/60 p-6 rounded-2xl border-2 border-amber-500/50 shadow-2xl shrink-0">
                    <h3 className="text-amber-500 font-black uppercase text-sm mb-4">God Mode - Kontrole Dizajna Planiranja</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <label className="text-[10px] text-amber-500 uppercase font-black">Boja Kartica: <input type="color" value={saas.ui.boja_kartice} onChange={e => saas.setUi({...saas.ui, boja_kartice: e.target.value})} className="w-full h-10 mt-1 cursor-pointer rounded bg-transparent" /></label>
                        <label className="text-[10px] text-amber-500 uppercase font-black">Boja Slova: <input type="color" value={saas.ui.boja_slova} onChange={e => saas.setUi({...saas.ui, boja_slova: e.target.value})} className="w-full h-10 mt-1 cursor-pointer rounded bg-transparent" /></label>
                        <label className="text-[10px] text-amber-500 uppercase font-black">Boja Akcenta: <input type="color" value={saas.ui.boja_akcenta} onChange={e => saas.setUi({...saas.ui, boja_akcenta: e.target.value})} className="w-full h-10 mt-1 cursor-pointer rounded bg-transparent" /></label>
                    </div>
                </div>
            )}

            {isReadOnly && (
                <div className="bg-blue-900/30 border border-blue-500/50 p-3 md:p-4 rounded-xl md:rounded-2xl flex items-center justify-center gap-3 shrink-0">
                    <span className="text-xl md:text-2xl">👁️</span>
                    <p className="text-blue-400 uppercase tracking-widest text-[10px] md:text-xs font-black text-center">Nalazite se u "Samo Pregled" načinu rada.</p>
                </div>
            )}

            {pregledNaloga && (
                <div className="fixed inset-0 z-[10000] bg-[#090e17]/95 flex items-center justify-center p-2 md:p-4 backdrop-blur-md animate-in zoom-in-95">
                    <div className="bg-theme-card border-2 border-blue-500 p-4 md:p-8 rounded-2xl md:rounded-[2rem] shadow-[0_0_50px_rgba(59,130,246,0.5)] max-w-2xl w-full max-h-[95vh] md:max-h-[90vh] flex flex-col relative mt-10 md:mt-0">
                        <button onClick={() => setPregledNaloga(null)} className="absolute top-2 right-2 md:top-4 md:right-4 bg-slate-800 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-500 transition-colors z-50"><X size={18}/></button>
                        
                        <div className="flex flex-col sm:flex-row justify-between sm:items-start border-b border-theme-border pb-4 mb-4 gap-2">
                            <div>
                                <h3 className="text-blue-400 font-black uppercase text-[10px] md:text-xs tracking-widest mb-1">Detalji Radnog Naloga</h3>
                                <p className="text-theme-text text-xl md:text-3xl font-black mt-1">{pregledNaloga.id}</p>
                                <p className="text-slate-300 text-xs md:text-sm font-bold bg-theme-panel inline-block px-2 md:px-3 py-1 md:py-1.5 rounded-lg mt-2 border border-theme-border">{pregledNaloga.kupac_naziv}</p>
                            </div>
                            <div className="sm:text-right sm:pt-6">
                                <span className={`text-[9px] md:text-[10px] px-2 md:px-3 py-1 md:py-1.5 rounded-lg font-black uppercase tracking-widest ${parseLocalIsoDate(pregledNaloga.rok_isporuke) <= DaniUSedmici[6].datum ? 'bg-red-900/30 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-300'}`}>Rok: {formatirajDatumBezPomaka(pregledNaloga.rok_isporuke)}</span>
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
                                            <p className="text-emerald-400 font-black text-xl md:text-3xl">{st.preostalo} <span className="text-xs md:text-sm">m³</span></p>
                                            <p className="text-[8px] md:text-[10px] text-slate-400 uppercase mt-1 font-bold">~ {st.preostaloOriginal} {st.jm_unos}</p>
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
                <div className="fixed inset-0 z-[9999] bg-[#090e17]/90 flex items-center justify-center p-2 md:p-4 backdrop-blur-md animate-in zoom-in-95">
                    <div className="bg-theme-card border-2 border-amber-500 p-4 md:p-8 rounded-2xl md:rounded-[2rem] shadow-[0_0_50px_rgba(245,158,11,0.3)] max-w-2xl w-full max-h-[95vh] md:max-h-[90vh] flex flex-col mt-10 md:mt-0 relative">
                        <button onClick={() => setPlaniranjeModal(null)} className="absolute top-2 right-2 md:hidden bg-slate-800 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-500 z-50"><X size={16}/></button>

                        <div className="flex flex-col sm:flex-row justify-between sm:items-start border-b border-theme-border pb-4 mb-4 gap-4">
                            <div>
                                <h3 className="text-amber-500 font-black uppercase text-[10px] md:text-xs mb-1 tracking-widest">Planiranje Naloga</h3>
                                <p onClick={() => setPregledNaloga(planiranjeModal.nalog)} className="text-blue-400 hover:text-blue-300 cursor-pointer transition-colors text-xl md:text-3xl font-black mb-1 underline decoration-blue-500/50 underline-offset-4" title="Klikni za detaljan pregled naloga">{planiranjeModal.nalog.id}</p>
                                <p className="text-slate-300 text-[10px] md:text-xs font-bold uppercase bg-theme-panel inline-block px-2 py-1 rounded border border-theme-border mt-1 shadow-inner">{planiranjeModal.nalog.kupac_naziv}</p>
                            </div>
                            <div className="w-full sm:w-auto bg-amber-900/10 border border-amber-500/30 p-2 md:p-3 rounded-xl shadow-inner">
                                <label className="text-[9px] md:text-[10px] text-amber-500 uppercase font-black block mb-1 md:mb-2">Odaberi Datum</label>
                                <input type="date" min={danasnjiDatum} value={planiranjeModal.datum} onChange={e => setPlaniranjeModal({...planiranjeModal, datum: e.target.value})} className="w-full p-2 md:p-3 bg-theme-panel text-amber-400 rounded-lg outline-none border border-amber-500/50 focus:border-amber-400 font-black text-xs md:text-sm uppercase cursor-pointer" />
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
                                                Na čekanju: <span className="text-white bg-emerald-900/40 px-1 md:px-2 py-0.5 rounded border border-emerald-500/30">{st.preostaloOriginal} {st.jm_unos}</span> <span className="text-slate-500 ml-1">(~ {st.maxKolicina} m³)</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="w-full sm:w-36 shrink-0 bg-black/30 p-2 rounded-lg sm:bg-transparent sm:p-0">
                                        <label className="text-[7px] md:text-[8px] text-slate-400 uppercase block mb-1 text-center font-bold">Količina ({st.jm_unos})</label>
                                        <input type="number" disabled={!st.checked} value={st.kolicinaZaUnos} onChange={(e) => promjeniKolicinuPlaniranja(st.id, e.target.value)} className="w-full min-w-0 p-2 md:p-3 bg-theme-card border border-theme-border rounded-lg text-center font-black text-amber-400 outline-none focus:border-amber-500 disabled:opacity-50 text-base md:text-xl shadow-inner" />
                                        <div className="text-center text-[9px] text-slate-500 mt-1 font-mono">Preračunato: <b className="text-amber-300">~ {st.kolicinaM3} m³</b></div>
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

<div className="flex flex-wrap justify-between items-center bg-theme-card backdrop-blur-[var(--glass-blur)] p-3 md:p-4 rounded-xl md:rounded-2xl border border-theme-border shadow-lg gap-3 shrink-0 w-full max-w-full overflow-hidden" style={{ backgroundColor: saas.ui.boja_kartice || undefined }}>
                <div className="flex items-center gap-2 min-w-0">
                    <h2 className="text-amber-500 font-black tracking-widest uppercase text-xs md:text-sm flex items-center gap-2 truncate"><span>📅</span> Planer Proizvodnje (Dimenzije u cm)</h2>
                </div>
                
                <div className="flex flex-wrap w-full xl:w-auto items-center justify-end gap-2 sm:gap-3 min-w-0">
                    <div className="flex items-center justify-between bg-theme-panel rounded-xl border border-theme-border p-1 shadow-inner shrink-0">
                        <button onClick={()=>shiftWeek(-1)} className="px-2.5 py-1.5 hover:bg-slate-700 rounded-lg text-theme-text font-black"><ChevronLeft size={16}/></button>
                        <span className="px-2 text-[9px] md:text-[10px] font-black uppercase text-amber-400 text-center whitespace-nowrap">{DaniUSedmici[0].iso.substring(5)} do {DaniUSedmici[6].iso.substring(5)}</span>
                        <button onClick={()=>shiftWeek(1)} className="px-2.5 py-1.5 hover:bg-slate-700 rounded-lg text-theme-text font-black"><ChevronRight size={16}/></button>
                    </div>

                    <select value={odabranaMasina} onChange={e => {setOdabranaMasina(e.target.value); setKapacitetMasine(parseFloat(masine.find(m=>m.naziv===e.target.value)?.dnevni_kapacitet_m3)||30); }} className="flex-1 sm:flex-initial max-w-full sm:max-w-[260px] min-w-0 bg-theme-panel text-theme-text px-3 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase outline-none border border-theme-border shadow-inner focus:border-amber-500 cursor-pointer truncate">
                        {masine.map(m => <option key={m.naziv} value={m.naziv}>{m.naziv} (Kapacitet: {m.dnevni_kapacitet_m3}m³)</option>)}
                    </select>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 md:gap-6 flex-1 min-h-[550px]">
                
                <div className="w-full lg:w-[350px] max-h-[45vh] lg:max-h-[75vh] bg-theme-card backdrop-blur-[var(--glass-blur)] border border-theme-border rounded-xl md:rounded-2xl flex flex-col shadow-2xl shrink-0" style={{ backgroundColor: saas.ui.boja_kartice || undefined }}>
                    <div className="p-3 md:p-4 border-b border-theme-border bg-theme-card/90 sticky top-0 z-10 rounded-t-2xl">
                        <h3 className="text-[10px] md:text-xs text-slate-400 font-black uppercase tracking-widest flex justify-between items-center">
                            Neraspoređeno <span className="bg-theme-panel px-2 py-0.5 rounded text-theme-text">{nerasporedjeniNalozi.length}</span>
                        </h3>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2 md:p-3 space-y-2 md:space-y-3 custom-scrollbar">
                        {loading && <div className="text-center text-amber-500 text-[10px] md:text-xs animate-pulse p-4 font-black">Učitavam...</div>}
                        {!loading && nerasporedjeniNalozi.length === 0 && <div className="text-center text-slate-500 text-[9px] md:text-[10px] p-4 border border-dashed border-theme-border rounded-xl font-bold mt-2">Nema neraspoređenih naloga!</div>}
                        
                        {!loading && nerasporedjeniNalozi.map((rn) => {
                            const isHitno = parseLocalIsoDate(rn.rok_isporuke) <= DaniUSedmici[6].datum;
                            const preostaloM3 = rn.stavkeZaPlaniranje.reduce((s, st) => s + parseFloat(st.preostalo), 0).toFixed(2);
                            const preporuceniDatum = izracunajPreporuku(rn.rok_isporuke);
                            const preporukaText = `${imenaDanaBHS[preporuceniDatum.getDay()]} (${String(preporuceniDatum.getDate()).padStart(2,'0')}.${String(preporuceniDatum.getMonth()+1).padStart(2,'0')}.)`;

                            return (
                                <div 
                                    id={`rn_card_${rn.id}`}
                                    key={rn.id} 
                                    draggable={!isReadOnly}
                                    onDragStart={(e) => !isReadOnly && handleDragStart(e, rn)}
                                    className={`p-3 md:p-4 rounded-xl md:rounded-2xl transition-all group ${
                                        highlightedRN === rn.id 
                                        ? 'bg-amber-900/40 border-2 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.6)] animate-pulse scale-[1.02] z-50 relative' 
                                        : 'bg-theme-panel border ' + (isHitno ? 'border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.1)]' : 'border-theme-border') + ' ' + (!isReadOnly ? 'cursor-grab active:cursor-grabbing hover:border-blue-500/50 hover:bg-slate-800/60' : 'opacity-90')
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-2 gap-2">
                                        <span className="text-[10px] md:text-[11px] text-blue-400 font-black uppercase bg-blue-900/20 px-2 py-0.5 md:py-1 rounded border border-blue-500/30 truncate">{rn.id}</span>
                                        <span className={`text-[8px] md:text-[9px] font-black uppercase px-2 py-0.5 md:py-1 rounded whitespace-nowrap ${isHitno ? 'bg-rose-900/30 text-rose-400' : 'bg-theme-card text-slate-400 border border-theme-border'}`}>Rok: {formatirajDatumBezPomaka(rn.rok_isporuke)}</span>
                                    </div>
                                    <p className="text-theme-text text-xs md:text-sm font-bold uppercase truncate">{rn.kupac_naziv}</p>
                                    
                                    <div className="mt-2 md:mt-4 flex justify-between items-center border-t border-theme-border/50 pt-2 md:pt-3">
                                        <span className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest">Stavki: <span className="text-theme-text">{rn.stavkeZaPlaniranje.length}</span></span>
                                        <span className="text-sm md:text-xl text-emerald-400 font-black bg-emerald-900/10 px-2 md:px-3 py-0.5 md:py-1 rounded-lg border border-emerald-500/20 shadow-sm">{preostaloM3} <span className="text-[8px] md:text-[10px] text-emerald-600">m³</span></span>
                                    </div>

                                    {!isReadOnly && (
                                        <div className="mt-2 md:mt-3 bg-blue-900/10 border border-blue-500/20 p-1.5 md:p-2 rounded-lg flex items-center justify-between shadow-inner">
                                            <span className="text-[8px] md:text-[9px] text-blue-400 uppercase font-black tracking-widest">💡 Preporuka:</span>
                                            <span className="text-[9px] md:text-[10px] text-white font-bold bg-blue-600/40 px-1.5 md:px-2 py-0.5 rounded">{preporukaText}</span>
                                        </div>
                                    )}
                                    
                                    <div className="mt-2 md:mt-3 flex gap-2">
                                        <button onClick={() => setPregledNaloga(rn)} className="flex-[1] bg-theme-card text-blue-400 py-2 md:py-3 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase border border-theme-border hover:bg-slate-700 hover:text-white transition-colors">👁️ Detalji</button>
                                        {!isReadOnly && <button onClick={() => otvoriPlaniranjeModal(rn)} className="flex-[2] bg-amber-600 text-white py-2 md:py-3 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase hover:bg-amber-500 transition-colors shadow-md">📅 Zakaži</button>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex-1 bg-theme-card/50 backdrop-blur-[var(--glass-blur)] border border-theme-border rounded-xl md:rounded-2xl shadow-2xl flex overflow-x-auto snap-x snap-mandatory custom-scrollbar min-h-[450px] max-h-[75vh]">
                    {DaniUSedmici.map((dan) => {
                        const stavkeZaDan = raspored.filter(r => r.datum_plana === dan.iso);
                        const ukupnoDanas = stavkeZaDan.reduce((sum, r) => sum + parseFloat(r.planirano_m3 || 0), 0);
                        const isPrekoKapaciteta = ukupnoDanas > kapacitetMasine;
                        const procenat = Math.min(100, (ukupnoDanas / kapacitetMasine) * 100);

                        return (
                            <div 
                                key={dan.iso}
                                onDragOver={!isReadOnly ? handleDragOver : undefined}
                                onDragLeave={!isReadOnly ? handleDragLeave : undefined}
                                onDrop={!isReadOnly ? (e) => handleDrop(e, dan.iso) : undefined}
                                className={`flex-1 min-w-[260px] md:min-w-[240px] border-r border-theme-border last:border-0 flex flex-col transition-colors snap-center ${dan.iso === danasnjiDatum ? 'bg-blue-900/10' : ''}`}
                            >
                                <div className="p-2 md:p-3 border-b border-theme-border/50 text-center shrink-0 bg-theme-panel/50 sticky top-0 z-10 backdrop-blur-md">
                                    <h4 className="text-[9px] md:text-[10px] text-slate-400 uppercase font-black tracking-widest">{dan.ime}</h4>
                                    <h3 className={`text-sm md:text-base font-black mt-0.5 md:mt-1 ${dan.iso === danasnjiDatum ? 'text-blue-400' : 'text-theme-text'}`}>{String(dan.datum.getDate()).padStart(2,'0')}.{String(dan.datum.getMonth()+1).padStart(2,'0')}.</h3>
                                    
                                    <div className="mt-2 bg-black/30 p-1.5 md:p-2 rounded-lg md:rounded-xl border border-theme-border/50 shadow-inner">
                                        <div className="flex justify-between text-[7px] md:text-[8px] font-black uppercase mb-1">
                                            <span className={isPrekoKapaciteta ? 'text-red-400' : 'text-emerald-400'}>{ukupnoDanas.toFixed(2)} m³ Rezervisano</span>
                                            <span className="text-slate-500">MAX {kapacitetMasine}</span>
                                        </div>
                                        <div className="w-full h-1.5 md:h-2 bg-black rounded-full overflow-hidden border border-slate-700">
                                            <div className={`h-full transition-all ${isPrekoKapaciteta ? 'bg-red-500' : (procenat > 85 ? 'bg-amber-500' : 'bg-emerald-500')}`} style={{ width: `${procenat}%` }}></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                                    {stavkeZaDan.length === 0 && <div className="text-[9px] text-slate-600 text-center uppercase font-bold mt-4">Slobodno</div>}
                                    {stavkeZaDan.map(st => {
                                        const dijeljen = isNalogDijeljen(st.rn_id);
                                        const plan = parseFloat(st.planirano_m3 || 0);
                                        const proizvedeno = parseFloat(st.proizvedeno_m3 || 0);
                                        const ukupniBlok = plan + proizvedeno;
                                        const procenatBloka = ukupniBlok > 0 ? Math.round((proizvedeno / ukupniBlok) * 100) : 0;
                                        
                                        const jeZavrseno = st.status === 'ZAVRŠENO' || procenatBloka >= 100;

                                        return (
                                            <div key={st.id} className={`bg-theme-panel p-2 md:p-3 rounded-xl border ${jeZavrseno ? 'border-emerald-500/50 bg-emerald-900/20' : 'border-theme-border hover:border-amber-500/50'} shadow-md group transition-all`}>
                                                <div className="flex justify-between items-start mb-2 md:mb-3 gap-1">
                                                    <span className="text-[8px] md:text-[10px] text-blue-300 uppercase font-black bg-blue-900/20 px-2 py-0.5 rounded border border-blue-500/30 truncate max-w-[80%]">{st.rn_id}</span>
                                                    {!isReadOnly && <button onClick={(e) => obrisiIzPlana(st.id, e)} className="text-red-500 bg-red-900/30 w-6 h-6 flex items-center justify-center rounded-md text-[10px] transition-opacity font-black hover:bg-red-500 hover:text-white shrink-0">✕</button>}
                                                </div>
                                                
                                                {dijeljen && <span className="text-[7px] md:text-[8px] bg-amber-900/40 text-amber-400 px-1.5 md:px-2 py-0.5 rounded uppercase font-black border border-amber-500/30 mb-1 md:mb-2 inline-block">✂️ DIJELJEN NALOG</span>}
                                                
                                                <p className="text-[10px] md:text-[11px] text-theme-text font-black uppercase leading-tight truncate mb-1" title={st.proizvod_naziv}>
                                                    <span className="text-amber-500">{st.dimenzije || 'N/A'} cm</span> <span className="opacity-50 mx-1">|</span> {st.proizvod_naziv}
                                                </p>
                                                
                                                <div className="mt-3 bg-black/40 p-1.5 rounded-lg border border-slate-700/50">
                                                    <div className="flex justify-between text-[7px] md:text-[8px] text-slate-400 uppercase font-black mb-1">
                                                        <span>{proizvedeno.toFixed(2)} m³ ODRADIO</span>
                                                        <span className={jeZavrseno ? 'text-emerald-400' : 'text-amber-400'}>{procenatBloka}%</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${procenatBloka}%` }}></div>
                                                    </div>
                                                </div>

                                                <div className="flex justify-between items-center mt-2 md:mt-3 pt-2 md:pt-3 border-t border-slate-700/50">
                                                    <span className={`text-[7px] md:text-[8px] uppercase font-black px-1.5 md:px-2 py-0.5 md:py-1 rounded flex items-center gap-1 ${jeZavrseno ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                        {jeZavrseno && <CheckCircle2 size={10} />}
                                                        {jeZavrseno ? 'ZAVRŠENO' : 'ZAKAZANO'}
                                                    </span>
                                                    <span className="text-xs md:text-sm text-theme-text font-black px-2 py-0.5">Ostatak: <span className="text-amber-400">{plan.toFixed(2)}</span> <span className="text-[8px] md:text-[9px] text-slate-500">m³</span></span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}