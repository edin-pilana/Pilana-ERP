"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import PametniDialog from '../components/PametniDialog';
import { useSaaS } from '../utils/useSaaS';
import { ChevronLeft, ChevronRight, X, CheckCircle2 } from 'lucide-react';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function PlaniranjeModule({ user, header, setHeader, onExit }) {
    const saas = useSaaS('planiranje_modul', {
        boja_kartice: '#1e293b', boja_slova: '#ffffff', boja_akcenta: '#f59e0b'
    });

    const danasnjiDatum = new Date().toISOString().split('T')[0];
    const isReadOnly = user?.uloga !== 'admin' && user?.uloga !== 'superadmin' && !(user?.dozvole || []).includes('Planiranje Proizvodnje');

    const [loading, setLoading] = useState(true);
    const [masine, setMasine] = useState([]);
    const [odabranaMasina, setOdabranaMasina] = useState('');
    const [kapacitetMasine, setKapacitetMasine] = useState(30);

    const [nerasporedjeniNalozi, setNerasporedjeniNalozi] = useState([]);
    const [raspored, setRaspored] = useState([]);
    const [sviPlanoviGlobal, setSviPlanoviGlobal] = useState([]); 
    
    const [pocetakSedmice, setPocetakSedmice] = useState(getStartOfWeek(new Date()));

    const [dialog, setDialog] = useState({ isOpen: false });
    const prikaziDialog = (opcije) => setDialog({ isOpen: true, confirmText: 'POTVRDI', cancelText: 'ZATVORI', ...opcije });
    const zatvoriDialog = () => setDialog({ isOpen: false });

    const [pregledNaloga, setPregledNaloga] = useState(null); 
    const [planiranjeModal, setPlaniranjeModal] = useState(null); 
    const [stavkeZaPlaniranje, setStavkeZaPlaniranje] = useState([]); 

    useEffect(() => { loadInitialData(); }, []);
    useEffect(() => { if (odabranaMasina) loadRaspored(); }, [odabranaMasina, pocetakSedmice]);

    function getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    const shiftWeek = (smjer) => {
        const d = new Date(pocetakSedmice);
        d.setDate(d.getDate() + (smjer * 7));
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
    };

    const loadRaspored = async () => {
        setLoading(true);
        const krajSedmice = new Date(pocetakSedmice);
        krajSedmice.setDate(krajSedmice.getDate() + 6);
        const dOd = pocetakSedmice.toISOString().split('T')[0];
        const dDo = krajSedmice.toISOString().split('T')[0];

        const { data: raspData } = await supabase.from('raspored_proizvodnje')
            .select('*').eq('masina', odabranaMasina).gte('datum_plana', dOd).lte('datum_plana', dDo);
        setRaspored(raspData || []);

        const { data: sviPlanovi } = await supabase.from('raspored_proizvodnje').select('*').eq('masina', odabranaMasina);
        setSviPlanoviGlobal(sviPlanovi || []);

        const { data: rnData } = await supabase.from('radni_nalozi').select('*').neq('status', 'ZAVRŠENO');
        
        let naloziZaLijevuStranu = [];

        (rnData || []).forEach(rn => {
            let imaNerasporedjeno = false;
            let stavkeZaMasinu = [];

            (rn.stavke_jsonb || []).forEach(st => {
                let ukupnoZaUraditi = 0;
                let jm_unos = st.jm_unos || 'kom';
                let originalKol = parseFloat(st.kolicina_unos || 0);

                if (rn.tip_naloga === 'FAZNI') {
                    const faza = (rn.tehnologija_jsonb?.[st.id] || []).find(f => f.masina === odabranaMasina);
                    if (faza) {
                        ukupnoZaUraditi = parseFloat(faza.kolicina || 0);
                        originalKol = ukupnoZaUraditi; 
                        jm_unos = faza.jm || jm_unos;
                    }
                } else {
                    ukupnoZaUraditi = parseFloat(st.kolicina_obracun || 0);
                }

                if (ukupnoZaUraditi > 0) {
                    // Oduzimamo ono što je ISPLANIRANO i ono što je već PROIZVEDENO na ovoj stavci
                    const vecZauzetoIliGotovo = (sviPlanovi || []).filter(p => p.rn_id === rn.id && p.stavka_id === st.id).reduce((s, p) => s + parseFloat(p.planirano_m3 || 0) + parseFloat(p.proizvedeno_m3 || 0), 0);
                    const preostalo = ukupnoZaUraditi - vecZauzetoIliGotovo;

                    if (preostalo > 0.001) {
                        imaNerasporedjeno = true;
                        const ratio = preostalo / ukupnoZaUraditi;
                        const preostaloOriginal = (originalKol * ratio).toFixed(2);
                        const dim = st.dimenzije || (st.visina ? `${st.visina}x${st.sirina}x${st.duzina}` : '') || (st.debljina ? `${st.debljina}x${st.sirina}x${st.duzina}` : 'BEZ DIMENZIJE');

                        stavkeZaMasinu.push({ 
                            ...st, 
                            preostalo: preostalo.toFixed(3), 
                            preostaloOriginal,
                            jm_unos, 
                            dimenzije_prikaz: dim,
                            ukupnoZaUraditi 
                        });
                    }
                }
            });

            if (imaNerasporedjeno) {
                naloziZaLijevuStranu.push({ ...rn, stavkeZaPlaniranje: stavkeZaMasinu });
            }
        });

        setNerasporedjeniNalozi(naloziZaLijevuStranu.sort((a,b) => new Date(a.rok_isporuke) - new Date(b.rok_isporuke)));
        setLoading(false);
    };

    const izracunajPreporuku = (rok_isporuke) => {
        const rokDate = new Date(rok_isporuke);
        const preporukaDate = new Date(rokDate);
        preporukaDate.setDate(preporukaDate.getDate() - 2);
        const danas = new Date(danasnjiDatum);
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
            maxKolicina: st.preostalo, preostaloOriginal: st.preostaloOriginal, kolicinaZaUnos: st.preostalo, checked: true 
        }));
        let finalniDatum = datum;
        if (!finalniDatum) { finalniDatum = izracunajPreporuku(nalog.rok_isporuke).toISOString().split('T')[0]; }
        setStavkeZaPlaniranje(pocetnoStanjeStavki);
        setPlaniranjeModal({ nalog, datum: finalniDatum });
    };

    const toggleStavkaPlaniranje = (id) => { setStavkeZaPlaniranje(prev => prev.map(s => s.id === id ? { ...s, checked: !s.checked } : s)); };
    const promjeniKolicinuPlaniranja = (id, novaKol) => { setStavkeZaPlaniranje(prev => prev.map(s => s.id === id ? { ...s, kolicinaZaUnos: novaKol } : s)); };

    const potvrdiPlaniranje = async () => {
        const stavkeZaBazu = stavkeZaPlaniranje.filter(s => s.checked);
        if (stavkeZaBazu.length === 0) return alert("Morate odabrati bar jednu stavku za planiranje!");
        if (!planiranjeModal.datum) return alert("Morate odabrati datum!");
        if (planiranjeModal.datum < danasnjiDatum) return alert("⛔ Greška: Ne možete planirati proizvodnju za datum koji je već prošao!");

        let validno = true; let ukupnoNovihKubika = 0;
        stavkeZaBazu.forEach(s => {
            const kol = parseFloat(s.kolicinaZaUnos);
            if (isNaN(kol) || kol <= 0) { alert(`Količina za ${s.naziv} nije ispravna!`); validno = false; }
            if (kol > parseFloat(s.maxKolicina)) { if(!window.confirm(`Stavka ${s.naziv}:\nUnijeli ste više nego što je preostalo (${s.maxKolicina}). Sigurno želite nastaviti?`)) validno = false; }
            ukupnoNovihKubika += kol;
        });
        if(!validno) return;

        const danStr = planiranjeModal.datum;
        const trenutnoPlaniranoNaDan = raspored.filter(r => r.datum_plana === danStr).reduce((s, r) => s + parseFloat(r.planirano_m3 || 0), 0);
        
        if (trenutnoPlaniranoNaDan + ukupnoNovihKubika > kapacitetMasine) {
            if(!window.confirm(`⚠️ KAPACITET PREMAŠEN!\nNa dan ${danStr} je već planirano ${trenutnoPlaniranoNaDan.toFixed(2)} m³.\nSa ovim dodajete još ${ukupnoNovihKubika.toFixed(2)} m³ čime prelazite dnevni limit od ${kapacitetMasine} m³.\n\nDa li ste sigurni da želite preopteretiti smjenu?`)) return;
        }

        const payload = stavkeZaBazu.map(s => ({
            rn_id: planiranjeModal.nalog.id, stavka_id: s.id, proizvod_naziv: s.naziv, dimenzije: s.dimenzije,
            masina: odabranaMasina, datum_plana: planiranjeModal.datum, planirano_m3: parseFloat(s.kolicinaZaUnos), proizvedeno_m3: 0, status: 'ZAKAZANO', snimio_korisnik: user?.ime_prezime || 'Nepoznat'
        }));

        await supabase.from('raspored_proizvodnje').insert(payload);
        setPlaniranjeModal(null); loadRaspored(); 
    };

    const obrisiIzPlana = async (id, e) => {
        e.stopPropagation();
        if(window.confirm("Ukloniti ovu stavku iz rasporeda? Ona će se vratiti nazad na listu neraspoređenih.")) {
            await supabase.from('raspored_proizvodnje').delete().eq('id', id); loadRaspored();
        }
    };

    const DaniUSedmici = useMemo(() => {
        const dani = []; const imena = ['PONEDJELJAK', 'UTORAK', 'SRIJEDA', 'ČETVRTAK', 'PETAK', 'SUBOTA', 'NEDJELJA'];
        for(let i=0; i<7; i++) {
            const d = new Date(pocetakSedmice); d.setDate(d.getDate() + i);
            dani.push({ datum: d, ime: imena[i], iso: d.toISOString().split('T')[0] });
        }
        return dani;
    }, [pocetakSedmice]);

    const isNalogDijeljen = (rn_id) => {
        const jedinstveniDani = new Set(sviPlanoviGlobal.filter(p => p.rn_id === rn_id).map(p => p.datum_plana));
        return jedinstveniDani.size > 1;
    };
    const imenaDanaBHS = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];

    return (
        <div className="p-2 md:p-4 max-w-[1800px] mx-auto space-y-4 md:space-y-6 font-bold animate-in fade-in h-screen flex flex-col overflow-hidden" style={{ color: saas.ui.boja_slova }}>
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-amber-500" user={user} modulIme="planiranje" saas={saas} hideMasina={true} />
            <PametniDialog {...dialog} />

            {isReadOnly && (
                <div className="bg-blue-900/30 border border-blue-500/50 p-3 md:p-4 rounded-xl md:rounded-2xl flex items-center justify-center gap-3 shrink-0">
                    <span className="text-xl md:text-2xl">👁️</span>
                    <p className="text-blue-400 uppercase tracking-widest text-[10px] md:text-xs font-black text-center">Nalazite se u "Samo Pregled" načinu rada.</p>
                </div>
            )}

            {/* MODAL 1: PREGLED NALOGA */}
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
                                <span className={`text-[9px] md:text-[10px] px-2 md:px-3 py-1 md:py-1.5 rounded-lg font-black uppercase tracking-widest ${new Date(pregledNaloga.rok_isporuke) <= new Date(DaniUSedmici[6].datum) ? 'bg-red-900/30 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-300'}`}>Rok: {new Date(pregledNaloga.rok_isporuke).toLocaleDateString('de-DE')}</span>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
                            <p className="text-[9px] md:text-[10px] text-slate-500 uppercase font-black mb-3">Stavke na čekanju za mašinu: <span className="text-amber-400">{odabranaMasina}</span></p>
                            <div className="space-y-2 md:space-y-3">
                                {pregledNaloga.stavkeZaPlaniranje.map((st, idx) => (
                                    <div key={idx} className="bg-theme-panel p-3 md:p-4 rounded-xl md:rounded-2xl border border-theme-border flex flex-col sm:flex-row justify-between sm:items-center shadow-md gap-3">
                                        <div>
                                            <p className="text-theme-text text-sm md:text-lg font-black uppercase leading-tight">
                                                <span className="text-amber-500">{st.dimenzije_prikaz || 'N/A'}</span> <span className="opacity-50 mx-1">|</span> {st.naziv}
                                            </p>
                                            <p className="text-[9px] md:text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">Šifra: <span className="text-white">{st.sifra}</span></p>
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

            {/* MODAL 2: PLANIRANJE */}
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
                                <input type="date" min={danasnjiDatum} value={planiranjeModal.datum} onChange={e => setPlaniranjeModal({...planiranjeModal, datum: e.target.value})} className="w-full p-2 md:p-3 bg-black text-amber-400 rounded-lg outline-none border border-amber-500/50 focus:border-amber-400 font-black text-xs md:text-sm uppercase cursor-pointer" />
                            </div>
                        </div>
                        
                        <p className="text-[9px] md:text-[10px] text-slate-400 uppercase font-black mb-2 md:mb-3 border-b border-theme-border/50 pb-2">Stavke za mašinu (odčekirajte šta nećete):</p>
                        
                        <div className="flex-1 overflow-y-auto pr-1 md:pr-2 custom-scrollbar space-y-2 md:space-y-3 mb-4 md:mb-6">
                            {stavkeZaPlaniranje.map(st => (
                                <div key={st.id} className={`p-3 md:p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm ${st.checked ? 'bg-theme-panel border-amber-500/50' : 'bg-black/40 border-slate-800 opacity-50'}`}>
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" checked={st.checked} onChange={() => toggleStavkaPlaniranje(st.id)} className="w-5 h-5 md:w-6 md:h-6 accent-amber-500 cursor-pointer shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs md:text-sm text-theme-text font-black uppercase truncate leading-tight" title={st.naziv}>
                                                <span className="text-amber-500">{st.dimenzije}</span> <span className="opacity-50 mx-1">|</span> {st.naziv}
                                            </p>
                                            <p className="text-[8px] md:text-[10px] text-emerald-400 font-bold uppercase mt-1 tracking-widest">
                                                Na čekanju: <span className="text-white bg-emerald-900/40 px-1 md:px-2 py-0.5 rounded border border-emerald-500/30">{st.maxKolicina} m³</span> <span className="text-slate-500 ml-1">(~ {st.preostaloOriginal} {st.jm_unos})</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="w-full sm:w-28 shrink-0 bg-black/30 p-2 rounded-lg sm:bg-transparent sm:p-0">
                                        <label className="text-[7px] md:text-[8px] text-slate-400 uppercase block mb-1 text-center font-bold">Količina (m³)</label>
                                        <input type="number" disabled={!st.checked} value={st.kolicinaZaUnos} onChange={(e) => promjeniKolicinuPlaniranja(st.id, e.target.value)} className="w-full p-2 md:p-3 bg-black border border-theme-border rounded-lg text-center font-black text-amber-400 outline-none focus:border-amber-500 disabled:opacity-50 text-base md:text-xl shadow-inner" />
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

            {/* HEADER CONTROLS */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-theme-card backdrop-blur-[var(--glass-blur)] p-3 md:p-4 rounded-xl md:rounded-2xl border border-theme-border shadow-lg gap-3 md:gap-4 shrink-0">
                <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-start">
                    <h2 className="text-amber-500 font-black tracking-widest uppercase text-xs md:text-sm flex items-center gap-2"><span>📅</span> Planer Proizvodnje</h2>
                </div>
                
                <div className="flex flex-col sm:flex-row w-full md:w-auto items-center gap-3">
                    <div className="flex items-center justify-between w-full sm:w-auto bg-theme-panel rounded-xl border border-theme-border p-1 shadow-inner">
                        <button onClick={()=>shiftWeek(-1)} className="px-3 py-1.5 md:py-2 hover:bg-slate-700 rounded-lg text-white font-black"><ChevronLeft size={16}/></button>
                        <span className="px-2 md:px-4 text-[9px] md:text-[10px] font-black uppercase text-amber-400 text-center whitespace-nowrap">{DaniUSedmici[0].iso.substring(5)} do {DaniUSedmici[6].iso.substring(5)}</span>
                        <button onClick={()=>shiftWeek(1)} className="px-3 py-1.5 md:py-2 hover:bg-slate-700 rounded-lg text-white font-black"><ChevronRight size={16}/></button>
                    </div>

                    <select value={odabranaMasina} onChange={e => {setOdabranaMasina(e.target.value); setKapacitetMasine(parseFloat(masine.find(m=>m.naziv===e.target.value)?.dnevni_kapacitet_m3)||30); }} className="w-full sm:w-auto bg-theme-panel text-theme-text px-3 py-2 md:py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase outline-none border border-theme-border shadow-inner focus:border-amber-500 cursor-pointer truncate">
                        {masine.map(m => <option key={m.naziv} value={m.naziv}>{m.naziv} (Kapacitet: {m.dnevni_kapacitet_m3}m³)</option>)}
                    </select>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex flex-col lg:flex-row gap-4 md:gap-6 flex-1 min-h-0 overflow-hidden">
                
                {/* LIJEVI PANEL - NERASPOREĐENO */}
                <div className="w-full lg:w-[350px] max-h-[40vh] lg:max-h-none bg-theme-card backdrop-blur-[var(--glass-blur)] border border-theme-border rounded-xl md:rounded-2xl flex flex-col shadow-2xl shrink-0">
                    <div className="p-3 md:p-4 border-b border-theme-border bg-theme-card/90 sticky top-0 z-10">
                        <h3 className="text-[10px] md:text-xs text-slate-400 font-black uppercase tracking-widest flex justify-between items-center">
                            Neraspoređeno <span className="bg-theme-panel px-2 py-0.5 rounded text-white">{nerasporedjeniNalozi.length}</span>
                        </h3>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2 md:p-3 space-y-2 md:space-y-3 custom-scrollbar">
                        {loading && <div className="text-center text-amber-500 text-[10px] md:text-xs animate-pulse p-4 font-black">Učitavam...</div>}
                        {!loading && nerasporedjeniNalozi.length === 0 && <div className="text-center text-slate-500 text-[9px] md:text-[10px] p-4 border border-dashed border-theme-border rounded-xl font-bold mt-2">Nema neraspoređenih naloga!</div>}
                        
                        {!loading && nerasporedjeniNalozi.map((rn) => {
                            const isHitno = new Date(rn.rok_isporuke) <= new Date(DaniUSedmici[6].datum);
                            const preostaloM3 = rn.stavkeZaPlaniranje.reduce((s, st) => s + parseFloat(st.preostalo), 0).toFixed(2);
                            const preporuceniDatum = izracunajPreporuku(rn.rok_isporuke);
                            const preporukaText = `${imenaDanaBHS[preporuceniDatum.getDay()]} (${preporuceniDatum.toLocaleDateString('de-DE').substring(0, 5)})`;

                            return (
                                <div 
                                    key={rn.id} 
                                    draggable={!isReadOnly}
                                    onDragStart={(e) => !isReadOnly && handleDragStart(e, rn)}
                                    className={`bg-theme-panel border ${isHitno ? 'border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.1)]' : 'border-theme-border'} p-3 md:p-4 rounded-xl md:rounded-2xl ${!isReadOnly ? 'cursor-grab active:cursor-grabbing hover:border-blue-500/50 hover:bg-slate-800' : 'opacity-90'} transition-all group`}
                                >
                                    <div className="flex justify-between items-start mb-2 gap-2">
                                        <span className="text-[10px] md:text-[11px] text-blue-400 font-black uppercase bg-blue-900/20 px-2 py-0.5 md:py-1 rounded border border-blue-500/30 truncate">{rn.id}</span>
                                        <span className={`text-[8px] md:text-[9px] font-black uppercase px-2 py-0.5 md:py-1 rounded whitespace-nowrap ${isHitno ? 'bg-rose-900/30 text-rose-400' : 'bg-black text-slate-400'}`}>Rok: {new Date(rn.rok_isporuke).toLocaleDateString('de-DE')}</span>
                                    </div>
                                    <p className="text-slate-300 text-xs md:text-sm font-bold uppercase truncate">{rn.kupac_naziv}</p>
                                    
                                    <div className="mt-2 md:mt-4 flex justify-between items-center border-t border-theme-border/50 pt-2 md:pt-3">
                                        <span className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest">Stavki: <span className="text-white">{rn.stavkeZaPlaniranje.length}</span></span>
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

                {/* DESNI PANEL - KANBAN / GANTT SEDMICA */}
                <div className="flex-1 bg-theme-card/50 backdrop-blur-[var(--glass-blur)] border border-theme-border rounded-xl md:rounded-2xl shadow-2xl flex overflow-x-auto snap-x snap-mandatory custom-scrollbar min-h-[300px]">
                    {DaniUSedmici.map((dan) => {
                        const stavkeZaDan = raspored.filter(r => r.datum_plana === dan.iso);
                        const ukupnoDanas = stavkeZaDan.reduce((sum, r) => sum + parseFloat(r.planirano_m3 || 0), 0); // Planirano se smanjuje kad se proizvodi!
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
                                    <h3 className={`text-sm md:text-base font-black mt-0.5 md:mt-1 ${dan.iso === danasnjiDatum ? 'text-blue-400' : 'text-theme-text'}`}>{dan.datum.toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit'})}</h3>
                                    
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
                                            <div key={st.id} className={`bg-theme-panel p-2 md:p-3 rounded-xl border ${jeZavrseno ? 'border-emerald-500/50 bg-emerald-900/20' : 'border-slate-700 hover:border-amber-500/50'} shadow-md group transition-all`}>
                                                <div className="flex justify-between items-start mb-2 md:mb-3">
                                                    <span className="text-[8px] md:text-[10px] text-blue-300 uppercase font-black bg-blue-900/20 px-2 py-0.5 rounded border border-blue-500/30 truncate max-w-[80%]">{st.rn_id}</span>
                                                    {!isReadOnly && <button onClick={(e) => obrisiIzPlana(st.id, e)} className="text-red-500 bg-red-900/30 w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-md md:rounded-lg text-[9px] md:text-[10px] opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity font-black hover:bg-red-500 hover:text-white shrink-0">✕</button>}
                                                </div>
                                                
                                                {dijeljen && <span className="text-[7px] md:text-[8px] bg-amber-900/40 text-amber-400 px-1.5 md:px-2 py-0.5 rounded uppercase font-black border border-amber-500/30 mb-1 md:mb-2 inline-block">✂️ DIJELJEN NALOG</span>}
                                                
                                                <p className="text-[10px] md:text-[11px] text-theme-text font-black uppercase leading-tight truncate mb-1" title={st.proizvod_naziv}>
                                                    <span className="text-amber-500">{st.dimenzije || 'N/A'}</span> <span className="opacity-50 mx-1">|</span> {st.proizvod_naziv}
                                                </p>
                                                
                                                {/* VIZUELNI LOADING BAR ZA ZAVRŠENOST ZADATKA */}
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
                                                    <span className="text-xs md:text-sm text-slate-300 font-black px-2 py-0.5">Ostatak: <span className="text-amber-400">{plan.toFixed(2)}</span> <span className="text-[8px] md:text-[9px] text-slate-500">m³</span></span>
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