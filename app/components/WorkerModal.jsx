"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import SearchableInput from './SearchableInput';
import ScannerOverlay from './ScannerOverlay';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function WorkerModal({ masina, onClose }) {
    const [workers, setWorkers] = useState([]);
    const [allRadnici, setAllRadnici] = useState([]);
    const [scanCode, setScanCode] = useState('');
    const [isScanningWorkers, setIsScanningWorkers] = useState(false);
    
    useEffect(() => { loadWorkers(); loadAllRadnici(); }, [masina]);

    const loadWorkers = async () => { 
        const { data } = await supabase.from('aktivni_radnici').select('*').eq('masina_naziv', masina).is('vrijeme_odjave', null); 
        setWorkers(data || []); 
    };
    
    const loadAllRadnici = async () => { 
        const { data } = await supabase.from('radnici').select('ime_prezime').order('ime_prezime'); 
        setAllRadnici(data ? data.map(r => r.ime_prezime) : []); 
    };

    const handleWorkerAction = async (imeRadnika) => {
        if(!imeRadnika) return;
        const ime = imeRadnika.trim();
        const vecTu = workers.find(w => w.radnik_ime.toLowerCase() === ime.toLowerCase());
        
        if (vecTu) {
            await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('id', vecTu.id);
        } else {
            const { data: aktivanDrugdje } = await supabase.from('aktivni_radnici').select('*').ilike('radnik_ime', ime).is('vrijeme_odjave', null).maybeSingle();
            if (aktivanDrugdje) {
                if (window.confirm(`Radnik ${ime} je već aktivan na: ${aktivanDrugdje.masina_naziv}. Prebaciti ga ovdje?`)) {
                    await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('id', aktivanDrugdje.id);
                    await supabase.from('aktivni_radnici').insert([{ radnik_ime: ime, masina_naziv: masina }]);
                }
            } else {
                await supabase.from('aktivni_radnici').insert([{ radnik_ime: ime, masina_naziv: masina }]);
            }
        }
        setScanCode(''); loadWorkers();
    };

    return (
        <div className="absolute top-0 left-0 w-full bg-[#0f172a] p-6 rounded-[2.5rem] border border-blue-500 shadow-2xl z-50 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-blue-500 text-xs tracking-widest uppercase font-black">Prijava na mašinu</h3>
                    <p className="text-[9px] text-slate-500 uppercase">{masina}</p>
                </div>
                <button onClick={onClose} className="text-slate-500 text-xl font-black hover:text-red-500 transition-all">✕</button>
            </div>

            <div className="flex gap-2 mb-6 items-end relative z-50">
                <div className="flex-1">
                    <SearchableInput label="Ime ili QR Radnika" value={scanCode} onChange={v => setScanCode(v)} list={allRadnici} />
                </div>
                <button onClick={() => handleWorkerAction(scanCode)} className="bg-blue-600 px-6 rounded-xl font-black text-white h-[46px] mb-[2px] hover:bg-blue-500 shadow-lg active:scale-95 transition-all">OK</button>
                <button onClick={() => setIsScanningWorkers(true)} className="bg-amber-600 px-4 rounded-xl font-black text-white h-[46px] mb-[2px] hover:bg-amber-500 shadow-lg">📷</button>
            </div>

            <div className="border-t border-slate-700 pt-4 relative z-0">
                <span className="text-[10px] text-slate-500 uppercase block mb-3 font-black">Trenutno rade na mašini ({workers.length}):</span>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2">
                    {workers.length === 0 && <span className="text-xs text-slate-600 font-bold italic">Nema prijavljenih radnika.</span>}
                    {workers.map(w => (
                        <div key={w.id} className="bg-emerald-900/30 text-emerald-400 border border-emerald-500/30 pl-4 pr-1 py-1 rounded-full text-[10px] flex items-center gap-3 font-bold shadow-lg animate-in fade-in">
                            <div>
                                <span>{w.radnik_ime}</span>
                                <span className="text-[8px] opacity-60 ml-2 italic">od {new Date(w.vrijeme_prijave).toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'})}</span>
                            </div>
                            <button onClick={() => handleWorkerAction(w.radnik_ime)} className="bg-red-900/50 text-red-500 w-6 h-6 rounded-full hover:bg-red-500 hover:text-white transition-all font-black flex items-center justify-center" title="Odjavi radnika">✕</button>
                        </div>
                    ))}
                </div>
            </div>
            
            {isScanningWorkers && <ScannerOverlay onScan={(text) => { handleWorkerAction(text); setIsScanningWorkers(false); }} onClose={() => setIsScanningWorkers(false)} />}
        </div>
    );
}