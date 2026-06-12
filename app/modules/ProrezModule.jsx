"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import MasterHeader from '../components/MasterHeader';
import MasterSearch from '../components/MasterSearch';
import PametniDialog from '../components/PametniDialog';
import ScannerOverlay from '../components/ScannerOverlay';
import { useSaaS } from '../utils/useSaaS';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function SaaS_DnevnikMasine({ modul, header, user, saas, updatePolje, toggleVelicina, spremiDimenzije, handleDragStart, handleDragEnter, handleDrop }) {
    const [logovi, setLogovi] = useState([]);
    const t = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const [form, setForm] = useState({ vrijeme_od: t, vrijeme_do: '', zastoj_min: '', napomena: '' });

    useEffect(() => { loadLogove(); }, [header]);
    const loadLogove = async () => {
        if(!header || !header.datum || !header.masina) return;
        const { data } = await supabase.from('dnevnik_masine').select('*').eq('datum', header.datum).eq('masina', header.masina).eq('modul', modul).order('vrijeme_od', { ascending: false });
        if (data) setLogovi(data);
    };
    const snimiZastojIliRad = async () => {
        if (!form.vrijeme_od) return alert("Vrijeme početka je obavezno!");
        const payload = { datum: header.datum, masina: header.masina, modul: modul, vrijeme_od: form.vrijeme_od, vrijeme_do: form.vrijeme_do || null, zastoj_min: parseInt(form.zastoj_min) || 0, napomena: form.napomena, snimio: user?.ime_prezime || 'Nepoznat' };
        await supabase.from('dnevnik_masine').insert([payload]);
        setForm({ vrijeme_od: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), vrijeme_do: '', zastoj_min: '', napomena: '' });
        loadLogove();
    };

    const obrisiLog = async (id) => { if(window.confirm("Obrisati ovaj zapis?")) { await supabase.from('dnevnik_masine').delete().eq('id', id); loadLogove(); } };
    const renderDnevnikPolje = (polje) => {
        if (polje.id === 'pocetak') return <input type="time" value={form.vrijeme_od} onChange={e => setForm({...form, vrijeme_od: e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none focus:border-red-500" />;
        if (polje.id === 'kraj') return <input type="time" value={form.vrijeme_do} onChange={e => setForm({...form, vrijeme_do: e.target.value})} className="w-full h-full min-h-[45px] p-3 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none focus:border-red-500" />;
        if (polje.id === 'zastoj') return <input type="number" value={form.zastoj_min} onChange={e => setForm({...form, zastoj_min: e.target.value})} placeholder="0" className="w-full h-full min-h-[45px] p-3 bg-red-900/20 rounded-xl text-xs text-red-400 font-black border border-red-500/50 outline-none" />;
        if (polje.id === 'napomena') return <input type="text" value={form.napomena} onChange={e => setForm({...form, napomena: e.target.value})} placeholder="Održavanje, kvar..." className="w-full h-full min-h-[45px] p-3 bg-theme-panel rounded-xl text-xs text-theme-text border border-theme-border outline-none focus:border-red-500" />;
        return null;
    };

    return (
        <div className={`bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-[2.5rem] border shadow-2xl space-y-4 transition-all ${saas.isEditMode ? 'ring-2 ring-amber-500 border-amber-500/50' : 'border-theme-border'}`}>
            <h3 className="text-red-500 font-black uppercase text-xs">⚙️ EVIDENCIJA RADA I ZASTOJA MAŠINE</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-theme-panel p-4 rounded-2xl border border-red-500/20 items-start shadow-inner">
                {(saas.ui.polja_dnevnik || []).map((polje, index) => (
                    <div key={polje.id} className={`relative flex flex-col ${polje.span} transition-all ${saas.isEditMode ? 'border-2 border-dashed border-amber-500 p-2 rounded-xl bg-black/20 resize overflow-auto' : ''}`} style={{ maxWidth: '100%', ...(saas.isEditMode ? { minWidth: '100px', minHeight: '80px' } : {}), width: polje.customWidth || undefined, height: polje.customHeight || undefined }} draggable={saas.isEditMode} onDragStart={(e) => handleDragStart(e, index, 'polja_dnevnik')} onDragEnter={(e) => handleDragEnter(e, index)} onDragEnd={() => handleDrop('polja_dnevnik')} onDragOver={(e) => e.preventDefault()} onMouseUp={(e) => spremiDimenzije(e, index, 'polja_dnevnik')}>
                        {saas.isEditMode && (<div className="flex justify-between items-center mb-2 shrink-0"><span className="text-[9px] text-amber-500 uppercase font-black cursor-move">☰</span><button onClick={() => toggleVelicina(index, 'polja_dnevnik')} className="text-[8px] text-amber-500 font-black bg-amber-500/20 px-2 py-1 rounded">ŠIRINA: {polje.span==='col-span-4'?'100%':polje.span==='col-span-2'?'50%':'25%'}</button></div>)}
                        {saas.isEditMode ? (<input value={polje.label} onChange={(e) => updatePolje(index, 'label', e.target.value, 'polja_dnevnik')} className="w-full bg-theme-card text-amber-400 p-1 mb-1 rounded border border-amber-500/50 text-[8px] uppercase font-black text-center shrink-0" placeholder="Ostavite prazno za bez naslova" />) : (polje.label && <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1 shrink-0">{polje.label}</label>)}
                        <div className={`flex-1 w-full ${saas.isEditMode ? 'opacity-50 pointer-events-none' : ''}`}>{renderDnevnikPolje(polje)}</div>
                    </div>
                ))}
                {/* 🟢 POPRAVLJENO: col-span-1 na mobitelu, col-span-4 na kompu za dugme */}
                <button onClick={snimiZastojIliRad} className={`w-full py-3 bg-red-600 text-theme-text font-black rounded-xl text-[10px] uppercase shadow-lg hover:bg-red-500 ${saas.isEditMode ? 'opacity-50 pointer-events-none col-span-1 sm:col-span-2 md:col-span-4' : 'col-span-1 sm:col-span-2 md:col-span-4 mt-2'}`}>➕ Dodaj Zapis</button>
            </div>
            
            <div className="space-y-2 mt-4 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {logovi.length === 0 && <p className="text-center text-slate-500 text-[10px] uppercase">Nema unesenih zastoja za danas.</p>}
                {logovi.map(l => (
                    <div key={l.id} className="flex justify-between items-center p-3 bg-slate-800 border border-theme-border rounded-xl">
                        <div>
                            <p className="text-[10px] text-slate-400 font-black"><span className="text-emerald-400">{l.vrijeme_od}</span> - {l.vrijeme_do ? <span className="text-amber-400">{l.vrijeme_do}</span> : <span className="text-slate-500">...</span>}</p>
                            <p className="text-theme-text text-xs font-bold mt-1">{l.napomena || 'Nema napomene'}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            {l.zastoj_min > 0 && <span className="text-red-400 text-xs font-black bg-red-900/30 px-2 py-1 rounded border border-red-500/30">Zastoj: {l.zastoj_min} min</span>}
                            <button onClick={() => obrisiLog(l.id)} className="text-red-500 font-black hover:bg-slate-700 p-2 rounded">✕</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function ProrezModule({ user, header, setHeader, onExit }) {
    
    useEffect(() => {
        const postaviMasinu = async () => {
            const { data } = await supabase.from('masine').select('naziv').ilike('dozvoljeni_moduli', '%Prorez%');
            const dozvoljene = data ? data.map(m => m.naziv) : [];
            const zadnja = localStorage.getItem('zadnja_masina_prorez');

            if (!header?.masina || !dozvoljene.includes(header.masina)) {
                const nova = (zadnja && dozvoljene.includes(zadnja)) ? zadnja : (dozvoljene[0] || 'BRENTA 1');
                setHeader(prev => ({ ...prev, masina: nova }));
                localStorage.setItem('zadnja_masina_prorez', nova);
            } else if (header.masina && dozvoljene.includes(header.masina)) {
                localStorage.setItem('zadnja_masina_prorez', header.masina);
            }
        };
        postaviMasinu();
    }, [header?.masina]);
    
    const saas = useSaaS('prorez_modul', {
        boja_kartice: '#1e293b', boja_slova: '#ffffff', velicina_naslova: '16', naslov_skenera: 'SKENIRAJ TRUPAC NA BRENTI',
        polja_radnici: [ 
            { id: 'brentista', label: '👨‍🔧 BRENTISTA (GLAVNI)', span: 'col-span-1' }, 
            { id: 'viljuskarista', label: '🚜 VILJUŠKARISTA', span: 'col-span-1' }
        ],
        polja_dnevnik: [ { id: 'pocetak', label: 'POČETAK', span: 'col-span-1' }, { id: 'kraj', label: 'ZAVRŠETAK', span: 'col-span-1' }, { id: 'zastoj', label: 'ZASTOJ (MINUTA)', span: 'col-span-1' }, { id: 'napomena', label: 'NAPOMENA / RAZLOG', span: 'col-span-1', customWidth: '100%', span: 'col-span-4' } ]
    });

    const dragItem = useRef(null);
    const dragOverItem = useRef(null);
    const handleDragStart = (e, index, lista) => { dragItem.current = { index, lista }; };
    const handleDragEnter = (e, index) => { dragOverItem.current = index; };
    const handleDrop = (listaIme) => { if(!dragItem.current || dragOverItem.current === null || dragItem.current.lista !== listaIme) return;
    const aktuelnaLista = saas.ui[listaIme]?.length > 0 ? saas.ui[listaIme] : saas.defaultConfig[listaIme]; const novaLista = [...aktuelnaLista]; const premjesteniItem = novaLista[dragItem.current.index]; novaLista.splice(dragItem.current.index, 1);
    novaLista.splice(dragOverItem.current, 0, premjesteniItem); dragItem.current = null; dragOverItem.current = null; saas.setUi({...saas.ui, [listaIme]: novaLista}); };
    const updatePolje = (index, key, val, listaIme) => { const aktuelnaLista = saas.ui[listaIme]?.length > 0 ? saas.ui[listaIme] : saas.defaultConfig[listaIme];
    const novaLista = [...aktuelnaLista]; novaLista[index][key] = val; saas.setUi({...saas.ui, [listaIme]: novaLista}); };
    const toggleVelicinaPolja = (index, listaIme) => { const aktuelnaLista = saas.ui[listaIme]?.length > 0 ? saas.ui[listaIme] : saas.defaultConfig[listaIme];
    const novaLista = [...aktuelnaLista]; const trenutno = novaLista[index].span; novaLista[index].span = trenutno === 'col-span-1' ?
    'col-span-2' : (trenutno === 'col-span-2' ? 'col-span-4' : 'col-span-1'); saas.setUi({...saas.ui, [listaIme]: novaLista}); };
    const spremiDimenzije = (e, index, listaIme) => { if (!saas.isEditMode) return; const w = e.currentTarget.style.width; const h = e.currentTarget.style.height;
    if (w || h) { const aktuelnaLista = saas.ui[listaIme]?.length > 0 ? saas.ui[listaIme] : saas.defaultConfig[listaIme]; const novaLista = [...aktuelnaLista];
    if (w) novaLista[index].customWidth = w; if (h) novaLista[index].customHeight = h; saas.setUi({...saas.ui, [listaIme]: novaLista}); } };

    const [scan, setScan] = useState('');
    const [trupac, setTrupac] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [prorezaniLista, setProrezaniLista] = useState([]);
    const [dialog, setDialog] = useState({ isOpen: false });
    const prikaziDialog = (opcije) => setDialog({ isOpen: true, confirmText: 'POTVRDI', cancelText: 'ZATVORI', ...opcije });
    const zatvoriDialog = () => setDialog({ isOpen: false });

    const scanTimerRef = useRef(null); 
    const inputRef = useRef(null);
    const btnPotvrdiRef = useRef(null); 

    const [brentista, setBrentista] = useState('');
    const [viljuskarista, setViljuskarista] = useState('');
    const [radniciList, setRadniciList] = useState([]);

    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ 
            korisnik: user?.ime_prezime || 'Nepoznat', 
            akcija: akcija, 
            detalji: detalji 
        }]);
    };

    const emitRadniciUpdate = (b, v) => {
        window.dispatchEvent(new CustomEvent('radnici_updated', {
            detail: { brentista: b, viljuskarista: v }
        }));
    };

    const handleBrentistaChange = async (novoIme) => {
        if (header?.masina) {
            await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('masina_naziv', header.masina).eq('uloga', 'brentista').is('vrijeme_odjave', null);
            if (novoIme) await supabase.from('aktivni_radnici').insert([{ radnik_ime: novoIme, masina_naziv: header.masina, vrijeme_prijave: new Date().toISOString(), uloga: 'brentista' }]);
            setBrentista(novoIme); localStorage.setItem('zajednicki_brentista', novoIme);
            emitRadniciUpdate(novoIme, viljuskarista);
        }
    };

    const handleViljuskaristaChange = async (novoIme) => {
        if (header?.masina) {
            await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('masina_naziv', header.masina).eq('uloga', 'viljuskarista').is('vrijeme_odjave', null);
            if (novoIme) await supabase.from('aktivni_radnici').insert([{ radnik_ime: novoIme, masina_naziv: header.masina, vrijeme_prijave: new Date().toISOString(), uloga: 'viljuskarista' }]);
            setViljuskarista(novoIme); localStorage.setItem('zajednicki_viljuskarista', novoIme);
            emitRadniciUpdate(brentista, novoIme);
        }
    };

    useEffect(() => {
        supabase.from('radnici').select('ime_prezime').then(({data}) => setRadniciList(data ? data.map(r=>({naziv: r.ime_prezime})) : []));
        if (header?.masina && header?.datum) loadProrezani();

        const ucitajDezurneRadnike = async () => {
            if (!header?.masina) return;
            const { data } = await supabase.from('aktivni_radnici').select('radnik_ime, uloga').eq('masina_naziv', header.masina).is('vrijeme_odjave', null);
            
            let locB = localStorage.getItem('zajednicki_brentista') || '';
            let locV = localStorage.getItem('zajednicki_viljuskarista') || '';

            if (data && data.length > 0) {
                const b = data.find(r => r.uloga === 'brentista');
                const v = data.find(r => r.uloga === 'viljuskarista');
                if (b) { locB = b.radnik_ime; localStorage.setItem('zajednicki_brentista', b.radnik_ime); }
                if (v) { locV = v.radnik_ime; localStorage.setItem('zajednicki_viljuskarista', v.radnik_ime); }
            }
            
            setBrentista(locB); setViljuskarista(locV);
            emitRadniciUpdate(locB, locV);
        };
        ucitajDezurneRadnike();

        const handleRadniciUpdate = (event) => { 
            if (event.detail) {
                setBrentista(event.detail.brentista); setViljuskarista(event.detail.viljuskarista);
            } else { ucitajDezurneRadnike(); }
        };
        window.addEventListener('radnici_updated', handleRadniciUpdate);
        return () => window.removeEventListener('radnici_updated', handleRadniciUpdate);
    }, [header?.masina, header?.datum]);

    const loadProrezani = async () => {
        if(!header?.masina) return;
        
        const { data, error } = await supabase.from('prorez_log')
            .select('*')
            .eq('masina', header.masina)
            .order('id', { ascending: false })
            .limit(200);
            
        if (error) {
            console.error("Greška pri povlačenju liste prorezanih:", error);
            return;
        }

        if (data) {
            const odabraniDatum = header.datum || new Date().toISOString().split('T')[0];
            const filtriranoZaDanas = data.filter(log => {
                if (log.datum) return log.datum === odabraniDatum;
                const logDate = new Date(log.created_at);
                const y = logDate.getFullYear();
                const m = String(logDate.getMonth() + 1).padStart(2, '0');
                const d = String(logDate.getDate()).padStart(2, '0');
                const logLokalniString = `${y}-${m}-${d}`;
                return logLokalniString === odabraniDatum;
            });
            
            const sessionTime = localStorage.getItem('prorez_session_start_' + header.masina);
            if (sessionTime) {
                const sessionDate = new Date(sessionTime);
                const filteredBySession = filtriranoZaDanas.filter(log => new Date(log.created_at) >= sessionDate);
                setProrezaniLista(filteredBySession);
            } else {
                setProrezaniLista(filtriranoZaDanas);
            }
        }
    };

    useEffect(() => {
        const channel = supabase.channel(`prorez_live_${Math.random()}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'prorez_log' }, () => {
                loadProrezani();
            }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [header?.masina, header?.datum]);

    const handleScanInput = (val, isEnter = false) => {
        setScan(val);
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        if (!val.trim()) return;
        
        if (isEnter) {
            processTrupacScan(val);
        } else {
            scanTimerRef.current = setTimeout(() => processTrupacScan(val), 1000);
        }
    };

    const processTrupacScan = async (val) => {
        const id = val.toUpperCase().trim();
        if (id.length < 1) return; 
        
        const { data } = await supabase.from('trupci').select('*').eq('id', id).maybeSingle();
        if (data) {
            if(data.status === 'prorezano' || data.status === 'PREKROJENO') {
                return prikaziDialog({ tip: 'upozorenje', naslov: 'Iskorišten Trupac', poruka: `Trupac ${id} je VEĆ PROREZAN!\nSkenirajte drugi.`, onCancel: zatvoriDialog });
            }
            
            setTrupac(data); 
            setScan('');
            if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(50);
            
            setTimeout(() => { btnPotvrdiRef.current?.focus(); }, 100);
        } else {
            prikaziDialog({ tip: 'greska', naslov: 'Nepoznat Trupac', poruka: `Trupac sa ID kodom "${id}" ne postoji na lageru!`, onCancel: zatvoriDialog });
            setScan('');
        }
    };

    const zavrsiProrez = async () => {
        if(!trupac) return;
        
        if(!brentista) {
            const odabraniDatum = header.datum || new Date().toISOString().split('T')[0];
            const { data: zadnjiLog } = await supabase.from('prorez_log')
                .select('*')
                .eq('masina', header.masina)
                .order('created_at', { ascending: false })
                .limit(1);

            if (zadnjiLog && zadnjiLog.length > 0 && zadnjiLog[0].datum === odabraniDatum) {
                const zadnji = zadnjiLog[0];
                return prikaziDialog({
                    tip: 'info',
                    naslov: 'Započeta Smjena',
                    poruka: `Pronađen je započet prorez za danas (Brentista: ${zadnji.brentista}).\n\nŽelite li nastaviti tu smjenu i učitati prethodnu listu, ili započeti novu smjenu od nule?`,
                    confirmText: '▶️ NASTAVI SMJENU',
                    cancelText: '🆕 NOVA SMJENA',
                    onConfirm: async () => {
                        localStorage.removeItem('prorez_session_start_' + header.masina);
                        await handleBrentistaChange(zadnji.brentista);
                        if (zadnji.viljuskarista) await handleViljuskaristaChange(zadnji.viljuskarista);
                        await loadProrezani(); 
                        zatvoriDialog();
                        zavrsiProrezPravi(zadnji.brentista, zadnji.viljuskarista); 
                    },
                    onCancel: () => {
                        zatvoriDialog();
                        setTimeout(() => {
                            prikaziDialog({ tip: 'upozorenje', naslov: 'Novi Brentista', poruka: "Započinjete novu smjenu. Molimo odaberite Brentistu iz padajućeg menija da biste potvrdili rezanje!", onCancel: zatvoriDialog });
                        }, 300);
                    }
                });
            } else {
                return prikaziDialog({ tip: 'upozorenje', naslov: 'Obavezno Polje', poruka: "ZABRANJENO:\nMorate odabrati Brentistu kako bi se prorez evidentirao!", onCancel: zatvoriDialog });
            }
        }
        
        zavrsiProrezPravi(brentista, viljuskarista);
    };

    const zavrsiProrezPravi = async (brentistaZaSpasiti, viljuskaristaZaSpasiti) => {
        const sviRadniciProrez = [brentistaZaSpasiti, viljuskaristaZaSpasiti].filter(Boolean).join(', ');
        
        const logPayload = {
            trupac_id: trupac.id, 
            zapremina: trupac.zapremina,
            mjesto: header.mjesto, 
            masina: header.masina,
            datum: header.datum || new Date().toISOString().split('T')[0], 
            brentista: brentistaZaSpasiti, 
            viljuskarista: viljuskaristaZaSpasiti, 
            svi_radnici_imena: sviRadniciProrez,
            snimio_korisnik: user?.ime_prezime || 'Sistem', 
            vrsta_drveta: trupac.vrsta || 'N/A'
        };

        const tempId = Date.now();
        const optimisticLog = { ...logPayload, id: tempId, created_at: new Date().toISOString() };
        setProrezaniLista(prev => [optimisticLog, ...prev]);
        
        setTrupac(null);
        setScan(''); 
        setTimeout(() => inputRef.current?.focus(), 100);

        await supabase.from('trupci').update({ status: 'prorezano' }).eq('id', logPayload.trupac_id);
        
        const { data: insertedData, error: errInsert } = await supabase.from('prorez_log').insert([logPayload]).select().single();
        
        if (errInsert) {
            setProrezaniLista(prev => prev.filter(p => p.id !== tempId));
            prikaziDialog({ tip: 'greska', naslov: 'Greška baze', poruka: errInsert.message, onCancel: zatvoriDialog });
        } else if (insertedData) {
            setProrezaniLista(prev => prev.map(p => p.id === tempId ? insertedData : p));
            zapisiU_Log('PROREZ_EVIDENTIRAN', `Izrezan trupac ${logPayload.trupac_id} (${logPayload.zapremina} m³). Brentista: ${brentistaZaSpasiti}`);
        }
    };

    const vratiNaStanje = async (p) => {
        prikaziDialog({
            tip: 'upozorenje',
            naslov: 'Vraćanje na zalihe',
            poruka: `Da li ste sigurni da želite poništiti prorez za trupac ${p.trupac_id} i vratiti ga na lager?`,
            confirmText: '✅ DA, VRATI NA STANJE',
            cancelText: '✕ ODUSTANI',
            onConfirm: async () => {
                setProrezaniLista(prev => prev.filter(item => item.id !== p.id));
                await supabase.from('prorez_log').delete().eq('id', p.id);
                await supabase.from('trupci').update({ status: 'na_lageru' }).eq('id', p.trupac_id);
                zapisiU_Log('STORNO_PROREZA', `Korisnik je poništio prorez za trupac ${p.trupac_id}. Trupac je vraćen nazad na zalihe.`);
                zatvoriDialog();
                setTimeout(() => inputRef.current?.focus(), 100);
            },
            onCancel: zatvoriDialog
        });
    };

    const zavrsiSmjenu = async () => {
        if(prorezaniLista.length === 0) return prikaziDialog({ tip: 'upozorenje', naslov: 'Prazno', poruka: "Nema izrezanih trupaca u trenutnoj smjeni.", onCancel: zatvoriDialog });
        
        prikaziDialog({
            tip: 'info',
            naslov: 'Završi Smjenu?',
            poruka: `U ovoj smjeni je izrezano: ${totalIzrezanoM3.toFixed(3)} m³ (${prorezaniLista.length} trupaca).\n\nDa li želite završiti smjenu i odjaviti radnike sa mašine? Lista će biti obrisana sa ekrana.`,
            confirmText: '🏁 ZAVRŠI SMJENU',
            cancelText: '✕ ODUSTANI',
            onConfirm: async () => {
                const now = new Date().toISOString();
                await supabase.from('aktivni_radnici').update({ vrijeme_odjave: now }).eq('masina_naziv', header.masina).is('vrijeme_odjave', null);
                
                setBrentista('');
                setViljuskarista('');
                localStorage.removeItem('zajednicki_brentista');
                localStorage.removeItem('zajednicki_viljuskarista');
                emitRadniciUpdate('', '');
                
                localStorage.setItem('prorez_session_start_' + header.masina, now);
                loadProrezani(); 
                
                zatvoriDialog();
                prikaziDialog({ tip: 'uspjeh', naslov: 'Smjena Završena', poruka: 'Radnici su odjavljeni i lista je očišćena za sljedeću smjenu.', onCancel: zatvoriDialog });
            },
            onCancel: zatvoriDialog
        });
    };

    const totalIzrezanoM3 = useMemo(() => prorezaniLista.reduce((s, p) => s + parseFloat(p.zapremina||0), 0), [prorezaniLista]);

    const renderRadnikPolje = (polje) => {
        if (polje.id === 'brentista') return <div className="h-full w-full min-w-0 bg-transparent text-theme-text font-black text-sm uppercase px-2 py-1 outline-none overflow-visible"><MasterSearch data={radniciList} poljaZaPretragu={['naziv']} value={brentista} onSelect={r => handleBrentistaChange(r.naziv)} placeholder="Odaberi..." /></div>;
        if (polje.id === 'viljuskarista') return <div className="h-full w-full min-w-0 bg-transparent text-theme-text font-black text-sm uppercase px-2 py-1 outline-none overflow-visible"><MasterSearch data={radniciList} poljaZaPretragu={['naziv']} value={viljuskarista} onSelect={r => handleViljuskaristaChange(r.naziv)} placeholder="Odaberi..." /></div>;
        return null;
    };

    if (!header?.masina) {
        return (
            <div className="p-4 max-w-2xl mx-auto space-y-6 font-bold animate-in fade-in">
                <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-red-500" user={user} saas={saas} />
                <div className="bg-red-900/30 border-2 border-red-500 p-10 rounded-[2.5rem] text-center shadow-2xl mt-10 backdrop-blur-[var(--glass-blur)]">
                    <span className="text-6xl block mb-4 animate-bounce">⚠️</span>
                    <h2 className="text-2xl text-red-400 font-black uppercase tracking-widest">Mašina nije odabrana!</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6 animate-in fade-in font-sans pb-24 overflow-visible" style={{ color: saas.ui.boja_slova }}>
            <PametniDialog {...dialog} />
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-red-500" user={user} modulIme="prorez" saas={saas} />

            {saas.isEditMode && (
                <div className="bg-black/60 p-6 rounded-2xl border-2 border-amber-500/50 mb-6 shadow-2xl">
                    <h3 className="text-amber-500 font-black uppercase text-sm mb-4">God Mode - Kontrole Dizajna</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <label className="text-[10px] text-amber-500 uppercase font-black">Boja Pozadine (Kartice): <input type="color" value={saas.ui.boja_kartice} onChange={e => saas.setUi({...saas.ui, boja_kartice: e.target.value})} className="w-full h-10 mt-1 cursor-pointer rounded bg-transparent" /></label>
                        <label className="text-[10px] text-amber-500 uppercase font-black">Boja SVIH slova: <input type="color" value={saas.ui.boja_slova} onChange={e => saas.setUi({...saas.ui, boja_slova: e.target.value})} className="w-full h-10 mt-1 cursor-pointer rounded bg-transparent" /></label>
                        <label className="text-[10px] text-amber-500 uppercase font-black">Veličina naslova (px): <input type="number" value={saas.ui.velicina_naslova} onChange={e => saas.setUi({...saas.ui, velicina_naslova: e.target.value})} className="w-full p-2 mt-1 bg-black text-amber-400 font-mono rounded" /></label>
                        <label className="text-[10px] text-amber-500 uppercase font-black md:col-span-3">Naslov Skenera: <input type="text" value={saas.ui.naslov_skenera} onChange={e => saas.setUi({...saas.ui, naslov_skenera: e.target.value})} className="w-full p-2 mt-1 bg-black text-amber-400 rounded" /></label>
                    </div>
                </div>
            )}

            <h2 className="text-red-500 text-center font-black tracking-widest uppercase text-xl md:text-2xl mt-2 mb-6 drop-shadow-md">🪚 PROREZ TRUPACA</h2>
            
            <div className="flex flex-col md:flex-row gap-4 bg-theme-card/60 backdrop-blur-[var(--glass-blur)] p-4 rounded-[2rem] border border-red-500/20 items-center justify-between shadow-lg relative z-[50]" style={{ backgroundColor: saas.ui.boja_kartice }}>
                {/* 🟢 POPRAVLJENO: Grid koji ide u 1 kolonu na mobitelu, 2 na desktopu */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                    {(saas.ui.polja_radnici || []).map((polje, index) => (
                        <div key={polje.id} className={`relative w-full flex flex-col sm:flex-row sm:items-center bg-black/40 rounded-xl border border-slate-800/50 p-3 overflow-visible transition-all ${saas.isEditMode ? 'border-dashed border-amber-500 bg-amber-900/20' : ''}`} draggable={saas.isEditMode} onDragStart={(e) => handleDragStart(e, index, 'polja_radnici')} onDragEnter={(e) => handleDragEnter(e, index)} onDragEnd={() => handleDrop('polja_radnici')} onDragOver={(e) => e.preventDefault()}>
                            {saas.isEditMode && (<div className="absolute -top-3 -right-2 z-[60] flex gap-1"><span className="text-[10px] text-amber-500 bg-theme-card px-2 py-1 rounded-box cursor-move border border-amber-500/50 shadow-lg">☰ POMICANJE</span></div>)}
                            <div className="flex-1 flex flex-col sm:flex-row sm:items-center w-full overflow-visible gap-2 sm:gap-0">
                                {saas.isEditMode ? (<input value={polje.label} onChange={(e) => updatePolje(index, 'label', e.target.value, 'polja_radnici')} className="w-full sm:w-24 bg-theme-card text-amber-400 p-1 rounded border border-amber-500/50 text-[8px] uppercase font-black shrink-0 mr-2" placeholder="Naslov..." />) : (polje.label && <label className="text-[8px] text-slate-500 uppercase sm:mx-2 whitespace-nowrap shrink-0 sm:w-24 overflow-hidden text-ellipsis mb-1 sm:mb-0">{polje.label}</label>)}
                                <div className="w-full sm:flex-1 sm:border-l border-theme-border/50 sm:pl-2 relative overflow-visible z-[100]">{renderRadnikPolje(polje)}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-theme-card/80 backdrop-blur-md p-8 rounded-[2.5rem] border border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.1)] relative group overflow-hidden" style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50"></div>
                        <label className="text-[9px] text-theme-muted uppercase block mb-4 font-black tracking-widest text-center" style={{ color: saas.ui.boja_teksta, fontSize: `${saas.ui.velicina_naslova}px` }}>{saas.ui.naslov_skenera}</label>
                        <div className={`flex bg-theme-panel border-2 rounded-2xl overflow-hidden shadow-inner transition-all h-20 mb-8 ${saas.isEditMode ? 'border-amber-500/50 opacity-50 pointer-events-none' : 'border-red-500/50 focus-within:border-red-500'}`}>
                            <input 
                                ref={inputRef}
                                value={scan} 
                                onChange={e => handleScanInput(e.target.value)} 
                                onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); handleScanInput(scan, true); } }} 
                                className="flex-1 min-w-0 px-4 md:px-6 bg-transparent text-xl md:text-2xl text-center text-theme-text outline-none uppercase font-black placeholder:text-theme-muted/30 tracking-widest" 
                                placeholder="ČEKAM SKEN..." 
                            />
                            <button onClick={() => setIsScanning(true)} className="shrink-0 px-6 md:px-8 bg-red-600/30 text-red-500 font-bold hover:bg-red-500 hover:text-white transition-all text-3xl border-l border-red-500/50">📷</button>
                        </div>

                        {trupac ? (
                            <div className="bg-theme-panel p-6 rounded-3xl border border-red-500/50 shadow-2xl relative overflow-hidden animate-in zoom-in-95">
                                <div className="absolute -right-10 -top-10 text-9xl opacity-5">🪵</div>
                                <div className="flex justify-between items-start mb-6 border-b border-theme-border/50 pb-4 relative z-10">
                                    <div>
                                        <span className="text-[10px] text-theme-muted uppercase font-black tracking-widest block mb-1">Skenirani Trupac</span>
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-3xl text-theme-text font-black drop-shadow-md">{trupac.id}</h3>
                                            {/* 🟢 EKSPLICITNI PRIKAZ PLOČICE (DODANO!) */}
                                            {trupac.broj_plocice && <span className="bg-red-900/30 border border-red-500/30 text-red-400 px-3 py-1 rounded-xl text-sm font-black uppercase">Pločica: {trupac.broj_plocice}</span>}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] text-theme-muted uppercase font-black tracking-widest block mb-1">Zapremina</span>
                                        <h3 className="text-4xl text-red-500 font-black drop-shadow-lg">{parseFloat(trupac.zapremina || 0).toFixed(3)} <span className="text-lg text-red-700">m³</span></h3>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 relative z-10">
                                    <div className="bg-black/30 p-4 rounded-2xl border border-theme-border/30 text-center"><span className="text-[9px] text-slate-500 uppercase block mb-1 font-bold">Vrsta</span><span className="text-sm font-black text-theme-text uppercase tracking-widest">{trupac.vrsta || 'N/A'}</span></div>
                                    <div className="bg-black/30 p-4 rounded-2xl border border-theme-border/30 text-center"><span className="text-[9px] text-slate-500 uppercase block mb-1 font-bold">Klasa</span><span className="text-sm font-black text-theme-text uppercase tracking-widest">{trupac.klasa || '-'}</span></div>
                                    <div className="bg-black/30 p-4 rounded-2xl border border-theme-border/30 text-center"><span className="text-[9px] text-slate-500 uppercase block mb-1 font-bold">Dužina</span><span className="text-sm font-black text-theme-text uppercase tracking-widest">{trupac.duzina} m</span></div>
                                    <div className="bg-black/30 p-4 rounded-2xl border border-theme-border/30 text-center"><span className="text-[9px] text-slate-500 uppercase block mb-1 font-bold">Prečnik</span><span className="text-sm font-black text-theme-text uppercase tracking-widest">Ø {trupac.promjer} cm</span></div>
                                </div>
                                {/* 🟢 POPRAVLJENO: flex-col na mobitelu za dugmad */}
                                <div className="flex flex-col sm:flex-row gap-4 relative z-10">
                                    <button onClick={() => {setTrupac(null); setScan(''); setTimeout(() => inputRef.current?.focus(), 100);}} className="flex-1 py-5 bg-theme-card text-slate-400 font-black rounded-2xl uppercase hover:bg-slate-800 transition-all border border-theme-border text-sm">✕ Otkazivanje</button>
                                    <button 
                                        ref={btnPotvrdiRef}
                                        onClick={zavrsiProrez} 
                                        className="flex-[2] py-5 bg-red-600 text-white font-black rounded-2xl uppercase shadow-[0_0_30px_rgba(220,38,38,0.4)] hover:bg-red-500 transition-all text-sm tracking-widest hover:scale-[1.02] focus:ring-4 ring-red-400 outline-none"
                                    >
                                        ✅ POTVRDI KAO IZREZANO
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="border-2 border-dashed border-theme-border p-10 rounded-3xl text-center text-slate-500 flex flex-col items-center justify-center bg-black/10">
                                <span className="text-5xl mb-4 opacity-50">🪵</span>
                                <p className="font-bold text-sm uppercase tracking-widest">Čekam skeniranje sljedećeg trupca...</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-theme-card/80 backdrop-blur-md p-6 rounded-[2.5rem] border border-theme-border shadow-xl flex flex-col h-full" style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <div className="flex flex-col sm:flex-row justify-between sm:items-end border-b border-theme-border pb-4 mb-4 gap-4">
                            <div>
                                <h3 className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Dnevni Učinak (Izrezano)</h3>
                                <p className="text-3xl font-black text-red-500 drop-shadow-md">{totalIzrezanoM3.toFixed(3)} <span className="text-sm text-red-700">m³</span></p>
                            </div>
                            <div className="text-left sm:text-right flex flex-col sm:items-end gap-2">
                                <div>
                                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Broj Trupaca</p>
                                    <p className="text-xl font-black text-theme-text">{prorezaniLista.length} <span className="text-xs text-slate-500">kom</span></p>
                                </div>
                                <button onClick={zavrsiSmjenu} className="bg-slate-800 hover:bg-red-600 hover:text-white text-slate-300 border border-slate-600 px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all shadow-md mt-2 w-full sm:w-auto">
                                    🏁 Završi Smjenu
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 max-h-[500px]">
                            {prorezaniLista.length === 0 && <div className="text-center text-xs text-slate-500 py-10 italic">Nema izrezanih trupaca u trenutnoj smjeni.</div>}
                            {prorezaniLista.map((p, i) => (
                                <div key={p.id} className="bg-theme-panel p-4 rounded-2xl border border-theme-border/50 flex flex-col md:flex-row justify-between md:items-center hover:border-red-500/50 transition-colors shadow-sm gap-3">
                                    <div className="flex items-center gap-4">
                                        <div className="text-[10px] font-black text-slate-500 w-4">{prorezaniLista.length - i}.</div>
                                        <div>
                                            <p className="text-theme-text text-sm font-black flex items-center gap-2">
                                                {p.trupac_id}
                                            </p>
                                            <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold tracking-widest">
                                                {p.created_at ? new Date(p.created_at).toLocaleTimeString('de-DE') : new Date().toLocaleTimeString('de-DE')} | {p.vrsta_drveta}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-none border-theme-border pt-3 md:pt-0">
                                        <div className="text-right"><p className="text-red-400 font-black text-lg">{parseFloat(p.zapremina||0).toFixed(3)}</p><p className="text-[8px] text-red-700 uppercase font-black">m³</p></div>
                                        
                                        <button onClick={() => vratiNaStanje(p)} className="text-amber-500 font-black px-4 py-3 bg-amber-900/20 rounded-xl hover:bg-amber-500 hover:text-black transition-all text-[10px] uppercase shadow-sm flex items-center gap-2">
                                            ↩ Vrati na stanje
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            
            <SaaS_DnevnikMasine modul="Prorez" header={header} user={user} saas={saas} updatePolje={updatePolje} toggleVelicina={toggleVelicinaPolja} spremiDimenzije={spremiDimenzije} handleDragStart={handleDragStart} handleDragEnter={handleDragEnter} handleDrop={handleDrop} />
            {isScanning && <ScannerOverlay onScan={(text) => { handleScanInput(text, true); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}