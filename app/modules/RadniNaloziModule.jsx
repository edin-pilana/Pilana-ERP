"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import SearchableInput from '../components/SearchableInput';
import ScannerOverlay from '../components/ScannerOverlay';
import { printDokument } from '../utils/printHelpers';
import { useSaaS } from '../utils/useSaaS';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function RN_SearchablePonuda({ ponude, value, onChange, onScanClick }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value || '');

    useEffect(() => { setSearch(value || ''); }, [value]);

    const safeSearch = (search || '').toString().toUpperCase();
    const filtered = ponude.filter(p => 
        p.id.toUpperCase().includes(safeSearch) || 
        p.kupac_naziv.toUpperCase().includes(safeSearch)
    );

    return (
        <div className="relative font-black w-full flex bg-[#0f172a] border-2 border-blue-500 rounded-xl overflow-visible focus-within:border-blue-400 transition-all shadow-inner">
            <input
                value={search}
                onFocus={() => setOpen(true)}
                onChange={e => { 
                    setSearch(e.target.value); 
                    setOpen(true); 
                    onChange(e.target.value, false); 
                }}
                onKeyDown={e => { 
                    if(e.key === 'Enter' && search) { 
                        onChange(search, true); 
                        setOpen(false); 
                    } 
                }}
                placeholder="Upiši broj ponude, ime kupca ili skeniraj..."
                className="flex-1 p-4 bg-transparent text-sm text-white outline-none uppercase font-black tracking-widest relative z-10"
            />
            <button 
                onClick={onScanClick} 
                className="px-6 bg-blue-600 text-white text-xl hover:bg-blue-500 transition-all border-l border-blue-500/50 relative z-10"
            >
                📷
            </button>
            
            {open && search && (
                <div className="absolute top-full left-0 z-[100] w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto text-left">
                    {filtered.length === 0 && <div className="p-3 text-xs text-slate-500 text-center">Nema rezultata...</div>}
                    {filtered.map(p => (
                        <div 
                            key={p.id} 
                            onClick={() => { onChange(p.id, true); setSearch(p.id); setOpen(false); }} 
                            className="p-3 border-b border-slate-700 hover:bg-blue-600 cursor-pointer transition-colors"
                        >
                            <div className="text-white text-xs font-black">{p.id}</div>
                            <div className="text-[10px] text-slate-400 mt-1">
                                {p.kupac_naziv} | Status: <span className={p.status === 'POTVRĐENA' ? 'text-emerald-400' : 'text-amber-400'}>{p.status}</span>
                            </div>
                        </div>
                    ))}
                    <div 
                        onClick={() => setOpen(false)} 
                        className="p-2 text-center text-[9px] text-slate-500 cursor-pointer hover:text-white bg-slate-900 rounded-b-xl uppercase font-bold tracking-widest mt-1"
                    >
                        Zatvori
                    </div>
                </div>
            )}
        </div>
    );
}

function RN_SearchableProizvod({ katalog, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value);
    
    useEffect(() => { setSearch(value); }, [value]);

    const filtered = katalog.filter(k => 
        k.sifra.toUpperCase().includes((search || '').toUpperCase()) || 
        k.naziv.toUpperCase().includes((search || '').toUpperCase())
    );

    return (
        <div className="relative font-black w-full">
            <input 
                value={search} 
                onFocus={() => setOpen(true)} 
                onChange={e => { setSearch(e.target.value); setOpen(true); }} 
                placeholder="Pronađi šifru ili naziv..." 
                className="w-full p-4 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-purple-500 shadow-inner" 
            />
            {open && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    {filtered.map(k => {
                        const tekstZaPolje = `${k.sifra} | ${k.naziv}`;
                        return (
                            <div 
                                key={k.sifra} 
                                onClick={() => { onChange(k.sifra, tekstZaPolje); setSearch(tekstZaPolje); setOpen(false); }} 
                                className="p-3 border-b border-slate-700 hover:bg-purple-600 cursor-pointer transition-all"
                            >
                                <div className="text-white text-xs font-black">{k.sifra} <span className="text-purple-300 ml-1">{k.naziv}</span></div>
                                <div className="text-[9px] text-slate-400 mt-1 uppercase">Kat: {k.kategorija} | Dim: {k.visina}x{k.sirina}x{k.duzina}</div>
                            </div>
                        )
                    })}
                    <div 
                        onClick={() => setOpen(false)} 
                        className="p-2 text-center text-[8px] text-slate-500 cursor-pointer hover:text-white bg-slate-900 sticky bottom-0"
                    >
                        Zatvori
                    </div>
                </div>
            )}
        </div>
    );
}

export default function RadniNaloziModule({ user, header, setHeader, onExit }) {
    const saas = useSaaS('radni_nalozi_zaglavlje', {
        boja_kartice: '#1e293b',
        polja: [
            { id: 'ponuda', label: 'Broj Ponude (Vezni dokument)', span: 'col-span-2' },
            { id: 'broj', label: 'BROJ NALOGA', span: 'col-span-2' },
            { id: 'kupac', label: '* KUPAC (Za koga proizvodimo)', span: 'col-span-2' },
            { id: 'datum', label: 'Datum izdavanja', span: 'col-span-1' },
            { id: 'rok', label: 'Rok Isporuke', span: 'col-span-1' },
            { id: 'status', label: 'Status Proizvodnje', span: 'col-span-2' }
        ]
    });

    const aktivnaPolja = saas.ui.polja?.length > 0 ? saas.ui.polja : saas.defaultConfig.polja;
    const currentUser = user?.ime_prezime ? user : JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('smart_timber_user') || '{}' : '{}');

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

    const [tab, setTab] = useState('novi');
    const [kupci, setKupci] = useState([]);
    const [katalog, setKatalog] = useState([]);
    const [nalozi, setNalozi] = useState([]);
    const [aktivnePonude, setAktivnePonude] = useState([]);
    
    const [masineList, setMasineList] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    
    const generisiID = () => `RN-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;

    const [form, setForm] = useState({ 
        id: generisiID(), 
        broj_ponude: '', 
        kupac_naziv: '', 
        datum: new Date().toISOString().split('T')[0], 
        rok_isporuke: '', 
        napomena: '', 
        status: 'U PROIZVODNJI', 
        modifikovan: false 
    });

    const [stavke, setStavke] = useState([]);
    const [originalneStavke, setOriginalneStavke] = useState(null); 
    const [isEditingNalog, setIsEditingNalog] = useState(false);
    
    const [stavkaForm, setStavkaForm] = useState({ 
        id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3' 
    });
    
    const [trenutniProizvod, setTrenutniProizvod] = useState(null);
    const [skenerInput, setSkenerInput] = useState('');
    const [tehnologija, setTehnologija] = useState({}); 
    const timerRef = useRef(null);

    useEffect(() => { load(); }, []);

    const load = async () => {
        supabase.from('kupci').select('naziv').order('naziv').then(({data}) => setKupci(data||[]));
        supabase.from('katalog_proizvoda').select('*').order('sifra').then(({data}) => setKatalog(data||[]));
        supabase.from('masine').select('naziv, atributi_paketa').order('naziv').then(({data}) => setMasineList(data||[]));
        supabase.from('radni_nalozi').select('*').order('datum', { ascending: false }).then(({data}) => setNalozi(data||[]));
        supabase.from('ponude').select('id, kupac_naziv, status, stavke_jsonb, napomena').neq('status', 'REALIZOVANA ✅').then(({data}) => setAktivnePonude(data||[]));
    };

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: currentUser.ime_prezime || 'Sistem', akcija, detalji }]);
    };

    const handlePonudaInput = (val, isEnterOrClick = false) => {
        setSkenerInput(val);
        if (timerRef.current) clearTimeout(timerRef.current);
        if (!val) return;
        
        if (isEnterOrClick) ucitajPonuduIzBaze(val);
        else timerRef.current = setTimeout(() => ucitajPonuduIzBaze(val), 2000);
    };

    const ucitajPonuduIzBaze = async (broj) => {
        const cistBroj = broj.toUpperCase().trim();
        const ponuda = aktivnePonude.find(p => p.id === cistBroj);
        
        if(!ponuda) return; 

        if (ponuda.status === 'NA ODLUČIVANJU') {
            alert(`⛔ UPOZORENJE: Ponuda ${cistBroj} je još uvijek "NA ODLUČIVANJU".\nMorate je prvo prebaciti u "POTVRĐENA" da biste započeli proizvodnju!`);
            return;
        }

        const prepravljeneStavke = (ponuda.stavke_jsonb || []).map(s => {
            const katItem = katalog.find(k => k.sifra === s.sifra) || {};
            const v = parseFloat(katItem.visina) || 0;
            const sir = parseFloat(katItem.sirina) || 0;
            const d = parseFloat(katItem.duzina) || 0;
            
            let m3 = 0;
            const unosKol = parseFloat(s.kolicina_unos) || 0;
            const jmUnos = (s.jm_unos || 'kom').toLowerCase();

            if (jmUnos === 'kom') m3 = unosKol * (v/100) * (sir/100) * (d/100);
            else if (jmUnos === 'm2') m3 = unosKol * (v/100);
            else if (jmUnos === 'm1') m3 = unosKol * (v/100) * (sir/100);
            else if (jmUnos === 'm3') m3 = unosKol;

            return {
                id: Math.random().toString(), 
                sifra: s.sifra, 
                naziv: s.naziv, 
                kolicina_unos: unosKol, 
                jm_unos: s.jm_unos,
                kolicina_obracun: m3 > 0 ? parseFloat(m3.toFixed(4)) : 0, 
                jm_obracun: 'm3',
                dimenzije: v > 0 ? `${v}x${sir}x${d}` : ''
            };
        });

        setForm({ ...form, kupac_naziv: ponuda.kupac_naziv, broj_ponude: ponuda.id, napomena: ponuda.napomena });
        setStavke(prepravljeneStavke);
        setOriginalneStavke(JSON.stringify(prepravljeneStavke)); 
        setSkenerInput('');
        alert(`✅ Uspješno preuzeti podaci iz ponude: ${cistBroj}`);
    };

    const provjeriModifikacije = (noveStavke) => {
        if(originalneStavke && JSON.stringify(noveStavke) !== originalneStavke) setForm(f => ({...f, modifikovan: true}));
    };

    const handleProizvodSelect = (sifraVal, tekstZaPolje) => {
        const nadjeni = katalog.find(k => k.sifra === sifraVal);
        setTrenutniProizvod(nadjeni || null);
        if (nadjeni) setStavkaForm({ ...stavkaForm, id: null, sifra_unos: tekstZaPolje, jm_unos: 'kom', jm_obracun: nadjeni.default_jedinica || 'm3' });
    };

    useEffect(() => {
        if(!trenutniProizvod || !stavkaForm.kolicina_unos) return;
        const kol = parseFloat(stavkaForm.kolicina_unos);
        const v = parseFloat(trenutniProizvod.visina) || 0;
        const s = parseFloat(trenutniProizvod.sirina) || 0;
        const d = parseFloat(trenutniProizvod.duzina) || 0;
        
        let m3 = 0;
        if (stavkaForm.jm_unos === 'kom') m3 = kol * (v/100) * (s/100) * (d/100);
        else if (stavkaForm.jm_unos === 'm2') m3 = kol * (v/100);
        else if (stavkaForm.jm_unos === 'm1') m3 = kol * (v/100) * (s/100);
        else m3 = kol; 

        setStavkaForm(prev => ({...prev, kolicina_obracun: m3 > 0 ? m3.toFixed(4) : "0.0000"}));
    }, [stavkaForm.kolicina_unos, stavkaForm.jm_unos, trenutniProizvod]);

    const dodajStavku = () => {
        if(!trenutniProizvod || !stavkaForm.kolicina_obracun) return alert("Odaberite proizvod i provjerite količine!");

        const dim = trenutniProizvod ? `${parseFloat(trenutniProizvod.visina)||0}x${parseFloat(trenutniProizvod.sirina)||0}x${parseFloat(trenutniProizvod.duzina)||0}` : '';

        const novaStavka = {
            id: stavkaForm.id || Math.random().toString(), 
            sifra: trenutniProizvod.sifra, 
            naziv: trenutniProizvod.naziv,
            kolicina_unos: parseFloat(stavkaForm.kolicina_unos), 
            jm_unos: stavkaForm.jm_unos,
            kolicina_obracun: parseFloat(stavkaForm.kolicina_obracun), 
            jm_obracun: 'm3',
            dimenzije: dim
        };

        let noveStavke = [];
        if (stavkaForm.id) noveStavke = stavke.map(s => s.id === stavkaForm.id ? novaStavka : s);
        else noveStavke = [...stavke, novaStavka];
        
        setStavke(noveStavke); provjeriModifikacije(noveStavke); 
        setStavkaForm({ id: null, sifra_unos: '', kolicina_unos: '', jm_unos: 'kom', kolicina_obracun: '', jm_obracun: 'm3' }); setTrenutniProizvod(null);
    };

    const urediStavku = (stavka) => {
        const nadjeni = katalog.find(k => k.sifra === stavka.sifra); setTrenutniProizvod(nadjeni || null);
        const tekstZaPolje = nadjeni ? `${nadjeni.sifra} | ${nadjeni.naziv}` : stavka.sifra;
        setStavkaForm({ 
            id: stavka.id, 
            sifra_unos: tekstZaPolje, 
            kolicina_unos: stavka.kolicina_unos, 
            jm_unos: stavka.jm_unos, 
            kolicina_obracun: stavka.kolicina_obracun, 
            jm_obracun: stavka.jm_obracun 
        });
    };

    const ukloniStavku = (id) => {
        const noveStavke = stavke.filter(s => s.id !== id); 
        setStavke(noveStavke); 
        provjeriModifikacije(noveStavke);
    };

    const otvoriRazradu = async () => {
        setTab('razrada');
        const noveTeh = { ...tehnologija };
        for (let s of stavke) {
            if (!noveTeh[s.id] || noveTeh[s.id].length === 0) {
                const { data } = await supabase.from('tehnologija_katalog').select('faze_jsonb').eq('finalna_sifra', s.sifra).maybeSingle();
                if (data && data.faze_jsonb && data.faze_jsonb.length > 0) {
                    noveTeh[s.id] = data.faze_jsonb;
                } else {
                    noveTeh[s.id] = [{ id: Math.random().toString(), masina: '', dimenzija: '', napomena: '', kolicina: '', jm: 'kom', oznake: [] }];
                }
            }
        }
        setTehnologija(noveTeh);
    };

    const dodajFazu = (stavkaId) => {
        const trenutne = tehnologija[stavkaId] || [];
        setTehnologija({ ...tehnologija, [stavkaId]: [...trenutne, { id: Math.random().toString(), masina: '', dimenzija: '', napomena: '', kolicina: '', jm: 'kom', oznake: [] }] });
    };

    const ukloniFazu = (stavkaId, fazaId) => {
        const trenutne = tehnologija[stavkaId] || [];
        setTehnologija({ ...tehnologija, [stavkaId]: trenutne.filter(f => f.id !== fazaId) });
    };

    const updateFazu = (stavkaId, fazaId, field, value) => {
        const trenutne = tehnologija[stavkaId] || [];
        if (field === 'masina') {
            setTehnologija({ ...tehnologija, [stavkaId]: trenutne.map(f => f.id === fazaId ? { ...f, masina: value, oznake: [] } : f) });
        } else {
            setTehnologija({ ...tehnologija, [stavkaId]: trenutne.map(f => f.id === fazaId ? { ...f, [field]: value } : f) });
        }
    };

    const toggleOznakaUFazi = (stavkaId, fazaId, oznaka) => {
        const trenutne = tehnologija[stavkaId] || [];
        setTehnologija({ ...tehnologija, [stavkaId]: trenutne.map(f => {
            if (f.id === fazaId) {
                const postojeca = f.oznake || [];
                const nove = postojeca.includes(oznaka) ? postojeca.filter(x => x !== oznaka) : [...postojeca, oznaka];
                return { ...f, oznake: nove };
            }
            return f;
        })});
    };

    const spasiSamoU_Nalog = () => {
        alert("✅ Faze privremeno sačuvane za ovaj Radni Nalog.");
        setTab('novi'); 
    };

    const snimiPraviloKaoSablon = async (sifra, faze) => {
        if(faze.length === 0 || !faze[0].masina || !faze[0].dimenzija) return alert("Unesite bar jednu ispravnu fazu prije snimanja šablona!");
        const { error } = await supabase.from('tehnologija_katalog').upsert({ finalna_sifra: sifra, faze_jsonb: faze }, { onConflict: 'finalna_sifra' });
        if (error) alert("Greška: " + error.message);
        else {
            await zapisiU_Log('KREIRAN_ŠABLON_TEHNOLOGIJE', `Kreiran šablon za proizvod ${sifra}`);
            alert("💾 Trajno pravilo uspješno snimljeno u bazu!");
        }
    };

    const snimiNalog = async () => {
        if(!form.kupac_naziv) return alert("Kupac je obavezan!");
        if(stavke.length === 0) return alert("Nalog mora imati stavke!");
        
        const isFazni = Object.values(tehnologija).some(faze => faze.length > 1);

        const payload = {
            id: form.id.toUpperCase(), broj_ponude: form.broj_ponude, kupac_naziv: form.kupac_naziv, 
            datum: form.datum, rok_isporuke: form.rok_isporuke, napomena: form.napomena, 
            stavke_jsonb: stavke, tehnologija_jsonb: tehnologija, status: form.status, 
            modifikovan: form.modifikovan, tip_naloga: isFazni ? 'FAZNI' : 'OBIČNI',
            snimio_korisnik: currentUser.ime_prezime
        };

        let res;
        if (isEditingNalog) {
            res = await supabase.from('radni_nalozi').update(payload).eq('id', form.id);
        } else {
            res = await supabase.from('radni_nalozi').insert([payload]);
        }

        if(res.error) return alert("Greška: " + res.error.message);

        if (form.broj_ponude && form.modifikovan) {
            await supabase
                .from('ponude')
                .update({ rn_modifikovan: true })
                .eq('id', form.broj_ponude.toUpperCase());
            
            await zapisiU_Log('ALARM_PONUDE', `Ponuda ${form.broj_ponude} označena kao neusklađena sa RN ${form.id}`);
        }

        await zapisiU_Log(isEditingNalog ? 'IZMJENA_RN' : 'KREIRAN_RN', `Radni Nalog ${form.id}`);
        
        if (window.confirm("✅ Nalog snimljen! Da li želite PDF?")) {
            kreirajPDF();
        }

        resetFormu(); load(); setTab('lista');
    };

    const resetFormu = () => {
        setForm({ id: generisiID(), broj_ponude: '', kupac_naziv: '', datum: new Date().toISOString().split('T')[0], rok_isporuke: '', napomena: '', status: 'U PROIZVODNJI', modifikovan: false });
        setStavke([]); setOriginalneStavke(null); setSkenerInput(''); setIsEditingNalog(false); setTehnologija({});
    };

    const formatirajDatum = (isoString) => {
        if(!isoString) return ''; const [y, m, d] = isoString.split('-'); return `${d}.${m}.${y}.`;
    };

    const pokreniIzmjenuNaloga = (n) => {
        setForm({ 
            id: n.id, 
            broj_ponude: n.broj_ponude || '', 
            kupac_naziv: n.kupac_naziv, 
            datum: n.datum, 
            rok_isporuke: n.rok_isporuke || '', 
            napomena: n.napomena || '', 
            status: n.status || 'U PROIZVODNJI', 
            modifikovan: n.modifikovan || false 
        });
        setStavke(n.stavke_jsonb || []);
        setTehnologija(n.tehnologija_jsonb || {});
        setIsEditingNalog(true); 
        setTab('novi'); 
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const kreirajPDF = async () => {
        if (form.broj_ponude && form.modifikovan) {
            const { data } = await supabase.from('ponude').select('rn_modifikovan').eq('id', form.broj_ponude).maybeSingle();
            if (data && data.rn_modifikovan) {
                alert("⛔ ZABRANJENO ŠTAMPANJE!\n\nOvaj Radni Nalog je izmijenjen u odnosu na ponudu. Prodaja/Finansije moraju prvo ODOBRITI ili ODBITI izmjene unutar modula 'PONUDE' da biste mogli štampati!");
                return;
            }
        }
    
        const stariNaslov = document.title;
        const cistiKupac = (form.kupac_naziv || 'Interno').replace(/\s+/g, '_');
        document.title = `radni_nalog_${form.id}_${cistiKupac}`;
        const odabraniKupac = kupci.find(k => k.naziv === form.kupac_naziv) || null;
        
        let redovi = stavke.map((s, i) => `
            <tr>
                <td style="font-weight: bold; color: #64748b; text-align: center;">${i+1}.</td>
                <td><b style="color: #0f172a; font-size: 13px;">${s.sifra}</b><br/><span style="color: #64748b; font-size: 11px;">${s.naziv}</span></td>
                <td style="text-align: center; font-size: 16px; font-weight: 900; color: #a855f7;">${s.kolicina_obracun} <span style="color: #64748b; font-size: 11px; font-weight: 600;">${s.jm_obracun}</span></td>
                <td style="text-align: center; font-weight: 600; color: #475569;">${s.kolicina_unos} <span style="font-size: 10px;">${s.jm_unos}</span></td>
            </tr>
        `).join('');

        const htmlSadrzajTabela = `
            <div class="info-grid">
                <div class="info-col">
                    <h4>Naručilac / Kupac</h4>
                    <p style="font-size: 18px; font-weight: 900; margin-bottom: 5px;">${form.kupac_naziv}</p>
                    <p style="font-weight: 400; color: #475569;">${odabraniKupac?.adresa || 'Adresa nije unesena u bazu'}</p>
                </div>
                <div class="info-col" style="text-align: right;">
                    <h4>Detalji Proizvodnje</h4>
                    <p>Vezana Ponuda: <span style="font-weight: 600; color: #0f172a;">${form.broj_ponude || '-'}</span></p>
                    <p>Status: <span style="font-weight: 900; color: #a855f7;">${form.status}</span></p>
                    <p style="color: #0f172a; margin-top: 8px; font-weight: 800;">Rok Isporuke: ${formatirajDatum(form.rok_isporuke)}</p>
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 5%; text-align: center;">R.B.</th>
                        <th>Šifra i Naziv Proizvoda</th>
                        <th style="text-align:center;">Proizvesti (Cilj)</th>
                        <th style="text-align:center;">Norma / Ulaz</th>
                    </tr>
                </thead>
                <tbody>${redovi}</tbody>
            </table>
            <div class="footer">
                <div style="width: 60%;"><b style="color: #0f172a;">Uputstva za proizvodnju:</b><br/>${form.napomena || 'Nema posebnih uputstava. Proizvesti prema standardu.'}</div>
                <div style="text-align: right; width: 30%;"><div style="border-bottom: 1px solid #cbd5e1; margin-bottom: 5px; height: 40px;"></div>Rukovodilac proizvodnje</div>
            </div>
        `;
        printDokument('RADNI NALOG', form.id, formatirajDatum(form.datum), htmlSadrzajTabela, '#a855f7');
        setTimeout(() => { document.title = stariNaslov; }, 2000);
    };

    const printDirektnoIzListe = async (rn, e) => {
        e.stopPropagation(); 
        if (rn.broj_ponude && rn.modifikovan) {
            const { data } = await supabase.from('ponude').select('rn_modifikovan').eq('id', rn.broj_ponude).maybeSingle();
            if (data && data.rn_modifikovan) {
                alert("⛔ ŠTAMPA BLOKIRANA!\n\nIdite u modul 'PONUDE' i riješite neslaganje količina za ovaj nalog.");
                return;
            }
        }
    
        const stariNaslov = document.title;
        const cistiKupac = (rn.kupac_naziv || 'Interno').replace(/\s+/g, '_');
        document.title = `radni_nalog_${rn.id}_${cistiKupac}`;

        const stavkeRN = rn.stavke_jsonb || [];
        
        let redovi = stavkeRN.map((s, i) => `
            <tr>
                <td style="font-weight: bold; color: #64748b;">${i+1}.</td>
                <td><b style="color: #0f172a; font-size: 13px;">${s.sifra}</b><br/><span style="color: #64748b; font-size: 11px;">${s.naziv}</span></td>
                <td style="text-align: center; font-weight: 800; color: #0f172a; font-size: 14px;">${s.kolicina_obracun || s.kolicina_unos} <span style="color: #64748b; font-size: 10px; font-weight: 600;">${s.jm_obracun || s.jm_unos}</span></td>
                <td>${s.napomena || ''}</td>
            </tr>
        `).join('');
        
        const htmlSadrzaj = `
            <div class="info-grid">
                <div class="info-col">
                    <h4>Naručilac / Kupac</h4>
                    <p style="font-size: 18px; font-weight: 900; margin-bottom: 5px;">${rn.kupac_naziv || 'Interni Nalog'}</p>
                </div>
                <div class="info-col" style="text-align: right;">
                    <h4>Detalji Naloga</h4>
                    <p>Datum izdavanja: <span style="font-weight: 400; color: #475569;">${formatirajDatum(rn.datum)}</span></p>
                    <p style="color: #3b82f6; margin-top: 8px; font-weight: 800;">Rok isporuke: ${formatirajDatum(rn.rok_isporuke || rn.rok_zavrsetka)}</p>
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 5%;">R.B.</th>
                        <th>Šifra i Naziv Proizvoda</th>
                        <th style="text-align:center;">Zahtijevana Količina</th>
                        <th>Napomena uz stavku / Tehnologija</th>
                    </tr>
                </thead>
                <tbody>${redovi}</tbody>
            </table>
            <div class="footer">
                <div style="width: 60%;">
                    <b style="color: #0f172a;">Glavna napomena za proizvodnju:</b><br/>${rn.napomena || 'Nema dodatnih napomena.'}
                </div>
                <div style="text-align: right; width: 30%;">
                    <div style="border-bottom: 1px solid #cbd5e1; margin-bottom: 5px; height: 40px;"></div>
                    Potpis Rukovodioca Proizvodnje
                </div>
            </div>
        `;
        
        printDokument('RADNI NALOG', rn.id, formatirajDatum(rn.datum), htmlSadrzaj, '#3b82f6'); 
        setTimeout(() => { document.title = stariNaslov; }, 2000);
    };

    const renderPoljeHeader = (polje) => {
        if (polje.id === 'ponuda') return <input value={form.broj_ponude} onChange={e=>setForm({...form, broj_ponude: e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-slate-900 rounded-xl text-white outline-none border border-slate-700 uppercase focus:border-purple-500" placeholder="Npr. PON-2026..." />;
        if (polje.id === 'broj') return <input value={form.id} disabled className="w-full h-full min-h-[45px] p-4 bg-slate-800 rounded-xl text-white border border-slate-700 font-black disabled:opacity-50" />;
        if (polje.id === 'kupac') return <div className="h-full min-h-[45px]"><SearchableInput value={form.kupac_naziv} onChange={v=>setForm({...form, kupac_naziv: v})} list={kupci.map(k=>k.naziv)} /></div>;
        if (polje.id === 'datum') return <input type="date" value={form.datum} onChange={e=>setForm({...form, datum:e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 font-black outline-none" />;
        if (polje.id === 'rok') return <input type="date" value={form.rok_isporuke} onChange={e=>setForm({...form, rok_isporuke: e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-[#0f172a] rounded-xl text-white border border-slate-700 outline-none" />;
        if (polje.id === 'status') return <select value={form.status} onChange={e=>setForm({...form, status: e.target.value})} className="w-full h-full min-h-[45px] p-4 bg-[#0f172a] rounded-xl text-purple-400 font-black border border-purple-500/50 uppercase outline-none"><option value="U PROIZVODNJI">U proizvodnji</option><option value="ZAVRŠENO">Završeno</option></select>;
        return null;
    };

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 font-bold animate-in fade-in">
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-purple-500" user={user} modulIme="radni_nalog" saas={saas} />

            <div className="flex bg-[#1e293b] p-1 rounded-2xl border border-slate-700">
                <button 
                    onClick={() => {setTab('novi'); if(!isEditingNalog) resetFormu();}} 
                    className={`flex-1 py-3 rounded-xl text-[10px] uppercase font-black transition-all ${tab === 'novi' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}
                >
                    ➕ Glavni Nalog
                </button>
                <button 
                    onClick={otvoriRazradu} 
                    className={`flex-1 py-3 rounded-xl text-[10px] uppercase font-black transition-all ${tab === 'razrada' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}
                >
                    🧪 Razrada Tehnologije
                </button>
                <button 
                    onClick={() => setTab('lista')} 
                    className={`flex-1 py-3 rounded-xl text-[10px] uppercase font-black transition-all ${tab === 'lista' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}
                >
                    📋 Arhiva
                </button>
            </div>

            {tab === 'novi' && (
                <div className="space-y-4 animate-in slide-in-from-left max-w-4xl mx-auto">
                    
                    {!isEditingNalog && (
                        <div className="bg-slate-900 border border-blue-500/50 p-6 rounded-3xl shadow-2xl relative z-[60]">
                            <label className="text-[10px] text-blue-400 uppercase font-black block mb-2 ml-2">Učitaj podatke iz ponude (Zadrška 2s ili skeniraj)</label>
                            <RN_SearchablePonuda ponude={aktivnePonude} value={skenerInput} onChange={handlePonudaInput} onScanClick={() => setIsScanning(true)} />
                        </div>
                    )}

                    <div className={`p-6 rounded-[2.5rem] border-2 shadow-2xl space-y-4 transition-all relative z-[40] ${saas.isEditMode ? 'border-dashed border-amber-500 bg-black/20' : (form.modifikovan ? 'border-amber-500 bg-[#1e293b]' : 'border-purple-500/30 bg-[#1e293b]')}`} style={{ backgroundColor: saas.isEditMode ? '' : saas.ui.boja_kartice }}>
                        <div className="flex justify-between items-center mb-2 border-b border-slate-700/50 pb-2">
                            <h3 className="text-purple-400 font-black uppercase text-xs">1. Parametri Radnog Naloga</h3>
                            <div className="flex gap-2">
                                {isEditingNalog && (
                                    <button onClick={kreirajPDF} className="text-[10px] bg-slate-800 text-white border border-slate-600 px-4 py-1.5 rounded-xl uppercase hover:bg-white hover:text-black transition-all shadow-md font-black">
                                        🖨️ Isprintaj PDF
                                    </button>
                                )}
                                {isEditingNalog && <button onClick={resetFormu} className="text-[10px] bg-red-900/30 text-red-400 px-3 py-1.5 rounded-xl uppercase hover:bg-red-900/50">Odustani ✕</button>}
                            </div>
                        </div>

                        {saas.isEditMode && (
                            <div className="bg-black/40 p-3 rounded-xl flex flex-wrap gap-4 items-center mb-4 border border-amber-500/30">
                                <label className="text-[10px] text-amber-500 uppercase font-black flex items-center gap-2">
                                    Boja Pozadine: 
                                    <input type="color" value={saas.ui.boja_kartice || '#1e293b'} onChange={e => saas.setUi({...saas.ui, boja_kartice: e.target.value})} className="w-8 h-8 cursor-pointer rounded border-none bg-transparent" />
                                </label>
                            </div>
                        )}

                        {form.modifikovan && (
                            <div className="bg-amber-900/40 border border-amber-500 p-4 rounded-2xl flex items-center gap-3 animate-pulse mb-4">
                                <span className="text-2xl">⚠️</span>
                                <div className="text-[10px] text-amber-400 uppercase font-black leading-tight">
                                    PAŽNJA: Ovaj radni nalog je ručno izmijenjen i više se ne poklapa 100% sa originalnom ponudom.<br/>
                                    <span className="text-white font-normal mt-1 block">Ova informacija će biti poslana u računovodstvo za otpremnicu i račun!</span>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border-b border-slate-700 pb-4 items-start">
                            {aktivnaPolja.map((polje, index) => (
                                <div 
                                    key={polje.id} 
                                    className={`relative flex flex-col ${polje.span} transition-all ${saas.isEditMode ? 'border-2 border-dashed border-amber-500 p-2 rounded-xl bg-black/20 resize overflow-auto' : ''}`} 
                                    style={{ maxWidth: '100%', ...(saas.isEditMode ? { minWidth: '100px', minHeight: '80px' } : {}), width: polje.customWidth || undefined, height: polje.customHeight || undefined }} 
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
                                            <button onClick={() => toggleVelicinaPolja(index)} className="text-[8px] text-amber-500 font-black bg-amber-500/20 px-2 py-1 rounded">ŠIRINA: {polje.span==='col-span-4'?'100%':polje.span==='col-span-2'?'50%':'25%'}</button>
                                        </div>
                                    )}
                                    {saas.isEditMode ? (
                                        <input value={polje.label} onChange={(e) => updatePolje(index, 'label', e.target.value)} className="w-full bg-slate-900 text-amber-400 p-1 mb-1 rounded border border-amber-500/50 text-[8px] uppercase font-black text-center shrink-0" placeholder="Naslov polja" />
                                    ) : (
                                        polje.label && <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1 shrink-0">{polje.label}</label>
                                    )}
                                    <div className={`flex-1 ${saas.isEditMode ? 'opacity-50 pointer-events-none' : ''}`}>
                                        {renderPoljeHeader(polje)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 space-y-4 shadow-xl relative z-[30]">
                        <h3 className="text-blue-400 uppercase text-xs">2. Dodaj proizvode u nalog (Nus-proizvodi ili ručni unos)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            <div className="md:col-span-6">
                                <RN_SearchableProizvod katalog={katalog} value={stavkaForm.sifra_unos} onChange={handleProizvodSelect} />
                            </div>
                            <div className="md:col-span-4 flex gap-2">
                                <input 
                                    type="number" 
                                    value={stavkaForm.kolicina_unos} 
                                    onChange={e=>setStavkaForm({...stavkaForm, kolicina_unos:e.target.value})} 
                                    placeholder="Kol." 
                                    className="w-1/2 min-w-0 p-4 bg-black rounded-xl text-lg text-white font-black text-center border border-slate-700 outline-none focus:border-purple-500" 
                                />
                                <select 
                                    value={stavkaForm.jm_unos} 
                                    onChange={e=>setStavkaForm({...stavkaForm, jm_unos:e.target.value})} 
                                    className="w-1/2 min-w-0 p-4 bg-slate-800 rounded-xl text-xs text-white border border-slate-700 outline-none cursor-pointer"
                                >
                                    <option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <button 
                                    onClick={dodajStavku} 
                                    className="w-full h-full min-h-[56px] bg-blue-600 text-white p-4 rounded-xl font-black hover:bg-blue-500 shadow-lg transition-all flex items-center justify-center"
                                >
                                    DODAJ +
                                </button>
                            </div>
                        </div>
                        {trenutniProizvod && stavkaForm.kolicina_unos && (
                            <div className="text-[10px] text-emerald-400 bg-emerald-900/20 p-2 rounded-lg border border-emerald-500/20 text-center uppercase animate-in zoom-in-95">
                                Automatski preračunato: <span className="text-white text-sm ml-1 font-black">{stavkaForm.kolicina_obracun} m³</span>
                            </div>
                        )}
                    </div>

                    {stavke.length > 0 && (
                        <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-purple-500/30 shadow-2xl animate-in slide-in-from-bottom">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-purple-400 font-black uppercase text-xs">3. Pregled stavki naloga</h3>
                                <button onClick={kreirajPDF} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-[10px] uppercase font-black border border-slate-600 hover:bg-white hover:text-black transition-all">🖨️ Kreiraj PDF</button>
                            </div>
                            <div className="space-y-3 mb-6">
                                {stavke.map((s, i) => (
                                    <div key={s.id} onClick={() => urediStavku(s)} className="flex justify-between items-center p-4 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-purple-500 transition-all group shadow-md">
                                        <div className="flex items-center gap-4">
                                            <span className="text-slate-500 text-sm font-black">{i+1}.</span>
                                            <div>
                                                <p className="text-white text-sm font-black">{s.naziv}</p>
                                                <p className="text-xs text-blue-300 font-bold mt-1 tracking-wider uppercase">
                                                    ŠIFRA: {s.sifra} {s.dimenzije && <span className="ml-2 text-emerald-400">| DIM: {s.dimenzije}</span>}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right flex items-center gap-4">
                                            <div>
                                                <p className="text-purple-400 text-lg font-black tracking-widest">{s.kolicina_obracun} m³</p>
                                                <p className="text-[10px] text-slate-500 uppercase bg-black px-2 py-1 rounded mt-1 inline-block font-bold">{s.kolicina_unos} {s.jm_unos}</p>
                                            </div>
                                            <button onClick={(e)=>{e.stopPropagation(); ukloniStavku(s.id);}} className="text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 p-2 rounded-lg transition-all font-black">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <textarea 
                                value={form.napomena} 
                                onChange={e=>setForm({...form, napomena:e.target.value})} 
                                placeholder="Uputa za radnike na mašinama (opciono)..." 
                                className="w-full mt-4 p-4 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-purple-500 shadow-inner" 
                                rows="3"
                            ></textarea>
                            <button 
                                onClick={snimiNalog} 
                                className={`w-full mt-4 py-6 text-white font-black rounded-[2rem] uppercase shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all text-sm tracking-widest ${isEditingNalog ? 'bg-amber-600 hover:bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.4)]' : 'bg-purple-600 hover:bg-purple-500'}`}
                            >
                                {isEditingNalog ? '✅ Snimi izmjene naloga' : '🏁 KREIRAJ RADNI NALOG'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {tab === 'razrada' && (
                <div className="space-y-6 animate-in slide-in-from-right max-w-4xl mx-auto">
                    <div className="bg-amber-900/20 border-2 border-amber-500/50 p-6 rounded-[2.5rem] shadow-2xl">
                        <h3 className="text-amber-500 font-black uppercase text-sm mb-2">🧪 VIŠEFAZNA TEHNOLOŠKA RAZRADA (BOM)</h3>
                        <p className="text-[10px] text-slate-400 mb-6 uppercase tracking-wider">Definišite tačne korake i mašine kroz koje ovaj proizvod mora proći prije finalizacije.</p>
                        
                        {stavke.length === 0 && <div className="text-center text-amber-500/50 p-10 border border-dashed border-amber-500/30 rounded-2xl font-bold">Prvo dodajte proizvode u Glavnom nalogu.</div>}

                        <div className="space-y-8">
                            {stavke.map(s => {
                                const faze = tehnologija[s.id] || [];
                                return (
                                <div key={s.id} className="bg-slate-900 p-6 rounded-[2rem] border border-slate-700 flex flex-col gap-4 shadow-lg">
                                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                                        <div>
                                            <span className="text-slate-400 text-[10px] block font-black uppercase mb-1">Ciljni (prodajni) proizvod:</span>
                                            <span className="text-blue-400 text-base font-black">{s.sifra} - {s.naziv}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-slate-500 text-[10px] block uppercase">Ciljna količina:</span>
                                            <span className="text-white font-black text-xl">{s.kolicina_unos} <span className="text-sm text-slate-400">{s.jm_unos}</span></span>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {faze.map((faza, index) => {
                                            const odabranaMasinaObj = masineList.find(m => m.naziv === faza.masina);
                                            const dostupneOznake = odabranaMasinaObj?.atributi_paketa || [];

                                            return (
                                            <div key={faza.id} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end bg-[#0f172a] p-5 rounded-2xl border border-slate-800 relative group">
                                                <div className="absolute -left-3 -top-3 w-6 h-6 bg-amber-500 text-black font-black text-[10px] flex items-center justify-center rounded-full border-2 border-slate-900 z-10">{index + 1}</div>
                                                
                                                <div className="lg:col-span-3 w-full">
                                                    <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Mašina</label>
                                                    <select 
                                                        value={faza.masina || ''} 
                                                        onChange={e=>updateFazu(s.id, faza.id, 'masina', e.target.value)} 
                                                        className="w-full p-3 bg-slate-800 rounded-xl text-xs text-white border border-slate-700 outline-none uppercase font-bold focus:border-amber-500 cursor-pointer"
                                                    >
                                                        <option value="">Odaberi mašinu...</option>
                                                        {masineList.map(m => <option key={m.naziv} value={m.naziv}>{m.naziv}</option>)}
                                                    </select>
                                                </div>
                                                
                                                <div className="lg:col-span-3 w-full">
                                                    <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Ulazna (radna) dimenzija</label>
                                                    <input 
                                                        value={faza.dimenzija || ''} 
                                                        onChange={e=>updateFazu(s.id, faza.id, 'dimenzija', e.target.value)} 
                                                        placeholder="npr. 23x163x4000" 
                                                        className="w-full p-3 bg-slate-800 rounded-xl text-xs text-white border border-slate-700 outline-none uppercase font-black focus:border-amber-500" 
                                                    />
                                                </div>

                                                <div className="lg:col-span-2 w-full">
                                                    <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Faktor/Količina</label>
                                                    <div className="flex gap-1">
                                                        <input 
                                                            type="number" 
                                                            value={faza.kolicina || ''} 
                                                            onChange={e=>updateFazu(s.id, faza.id, 'kolicina', e.target.value)} 
                                                            placeholder="Kol." 
                                                            className="flex-1 p-3 bg-slate-800 rounded-xl text-xs text-white border border-slate-700 outline-none font-black focus:border-amber-500 text-center" 
                                                        />
                                                        <select 
                                                            value={faza.jm || 'kom'} 
                                                            onChange={e=>updateFazu(s.id, faza.id, 'jm', e.target.value)} 
                                                            className="w-16 p-3 bg-slate-800 rounded-xl text-[10px] text-white border border-slate-700 outline-none focus:border-amber-500 cursor-pointer"
                                                        >
                                                            <option value="kom">kom</option><option value="m3">m³</option><option value="m2">m²</option><option value="m1">m1</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="lg:col-span-3 w-full">
                                                    <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">Napomena (Opciono)</label>
                                                    <input 
                                                        value={faza.napomena || ''} 
                                                        onChange={e=>updateFazu(s.id, faza.id, 'napomena', e.target.value)} 
                                                        placeholder="Npr. pazi na čvorove..." 
                                                        className="w-full p-3 bg-slate-800 rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-amber-500" 
                                                    />
                                                </div>

                                                <div className="lg:col-span-1 flex items-center justify-end md:justify-center w-full mt-2 lg:mt-0">
                                                    <button 
                                                        onClick={() => ukloniFazu(s.id, faza.id)} 
                                                        className="w-full lg:w-auto bg-red-900/30 text-red-500 p-3 rounded-xl font-black hover:bg-red-500 hover:text-white transition-all opacity-100 lg:opacity-0 group-hover:opacity-100 border border-red-500/20"
                                                    >
                                                        ✕ Ukloni
                                                    </button>
                                                </div>

                                                {dostupneOznake.length > 0 && (
                                                    <div className="col-span-1 md:col-span-2 lg:col-span-12 mt-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                                                        <label className="text-[10px] text-slate-500 uppercase block mb-2 font-black ml-1">Opcije obrade za ovu fazu:</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {dostupneOznake.map(o => {
                                                                const isSelected = faza.oznake?.includes(o);
                                                                return (
                                                                    <button 
                                                                        key={o} 
                                                                        onClick={() => toggleOznakaUFazi(s.id, faza.id, o)} 
                                                                        className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all border ${isSelected ? 'bg-amber-600 border-amber-400 text-white shadow-[0_0_10px_rgba(217,119,6,0.4)] scale-105' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white hover:border-slate-500'}`}
                                                                    >
                                                                        {isSelected ? '✓ ' : '+ '} {o}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )})}
                                    </div>
                                    
                                    <div className="flex flex-col md:flex-row justify-between items-center mt-2 border-t border-slate-800 pt-4 gap-3">
                                        <button 
                                            onClick={() => dodajFazu(s.id)} 
                                            className="text-[10px] text-amber-500 font-black uppercase hover:bg-amber-500/10 px-4 py-2 rounded-xl transition-all border border-amber-500/30 w-full md:w-auto"
                                        >
                                            + Dodaj sljedeću fazu obrade
                                        </button>
                                        
                                        <div className="flex gap-2 w-full md:w-auto">
                                            <button 
                                                onClick={spasiSamoU_Nalog} 
                                                className="flex-1 px-4 py-3 bg-slate-800 text-white rounded-xl text-[10px] uppercase font-black hover:bg-slate-700 border border-slate-600 transition-all"
                                            >
                                                Sačuvaj u Nalog
                                            </button>
                                            <button 
                                                onClick={() => snimiPraviloKaoSablon(s.sifra, faze)} 
                                                className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl text-[10px] uppercase font-black hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 transition-all border border-emerald-400"
                                            >
                                                💾 Snimi kao Šablon
                                            </button>
                                        </div>
                                    </div>

                                    {faze.length > 0 && faze[0].masina && (
                                        <div className="flex items-center gap-2 mt-2 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                                            <span className="text-[9px] text-amber-400 uppercase font-black">Ova roba će kroz pogon biti označena i knjižena kao "FAZNA PROIZVODNJA".</span>
                                        </div>
                                    )}
                                </div>
                            )})}
                        </div>
                    </div>
                </div>
            )}

            {tab === 'lista' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto animate-in slide-in-from-right">
                    {nalozi.length === 0 && <p className="text-center text-slate-500 text-xs col-span-full">Nema kreiranih radnih naloga.</p>}
                    {nalozi.map(n => (
                        <div 
                            key={n.id} 
                            onClick={() => pokreniIzmjenuNaloga(n)} 
                            className="bg-[#1e293b] border border-slate-700 p-5 rounded-[2rem] shadow-lg cursor-pointer hover:border-purple-500 hover:-translate-y-1 transition-all relative overflow-hidden group"
                        >
                            {n.tip_naloga === 'FAZNI' && <div className="absolute top-0 right-0 bg-amber-500 text-black text-[8px] px-3 py-1 font-black rounded-bl-lg uppercase shadow-md flex items-center gap-1">🔄 FAZNI</div>}
                            {n.modifikovan && n.tip_naloga !== 'FAZNI' && <div className="absolute top-0 right-0 bg-red-500 text-white text-[8px] px-3 py-1 font-black rounded-bl-lg uppercase shadow-md">MIJENJAN</div>}
                            
                            <div className="flex justify-between items-start border-b border-slate-800 pb-3 mb-3 cursor-pointer">
                                <div>
                                    <p className="text-purple-400 text-base font-black flex items-center gap-2">
                                        {n.id}
                                        <button 
                                            onClick={(e) => printDirektnoIzListe(n, e)} 
                                            className="bg-slate-800 border border-slate-600 text-[9px] text-white px-2 py-1 rounded uppercase hover:bg-white hover:text-black transition-all shadow-md"
                                        >
                                            🖨️ PDF
                                        </button>
                                    </p>
                                    <p className="text-white text-xs font-bold mt-1">{n.kupac_naziv}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`text-[9px] px-2 py-1 rounded font-black uppercase inline-block ${n.status === 'ZAVRŠENO' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-purple-900/30 text-purple-400'}`}>{n.status}</p>
                                    <p className="text-[9px] text-slate-500 uppercase mt-2">Rok: {formatirajDatum(n.rok_isporuke)}</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] text-slate-400 font-bold bg-slate-900 px-2 py-1 rounded">Vezano: {n.broj_ponude || 'Nema'}</span>
                                <span className="text-[10px] text-slate-300 font-black">Stavki: {n.stavke_jsonb ? n.stavke_jsonb.length : 0}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {isScanning && <ScannerOverlay onScan={(text) => { ucitajPonuduIzBaze(text); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}