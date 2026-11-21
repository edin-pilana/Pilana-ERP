"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { toast } from 'sonner';
import SearchableInput from './SearchableInput';
import ScannerOverlay from './ScannerOverlay';
import PametniDialog from './PametniDialog';

export default function WorkerModal({ masina, onClose }) {
    const [workers, setWorkers] = useState([]);
    const [allRadnici, setAllRadnici] = useState([]);
    const [scanCode, setScanCode] = useState('');
    const [isScanningWorkers, setIsScanningWorkers] = useState(false);
    const [dialog, setDialog] = useState({ isOpen: false });
    
    useEffect(() => { loadWorkers(); loadAllRadnici(); }, [masina]);

    const loadWorkers = async () => { 
        const { data } = await supabase.from('aktivni_radnici').select('*').eq('masina_naziv', masina).is('vrijeme_odjave', null); 
        setWorkers(data || []); 
    };
    
    const loadAllRadnici = async () => { 
        const { data } = await supabase.from('radnici').select('ime_prezime, qr_kod, username').order('ime_prezime'); 
        setAllRadnici(data || []); 
    };

    const handleWorkerAction = async (unos) => {
        if(!unos) return;
        const cistUnos = unos.trim();
        const pronadjen = allRadnici.find(r =>
            r.ime_prezime?.toLowerCase() === cistUnos.toLowerCase() ||
            (r.qr_kod && r.qr_kod.toLowerCase() === cistUnos.toLowerCase()) ||
            (r.username && r.username.toLowerCase() === cistUnos.toLowerCase())
        );
        const ime = pronadjen ? pronadjen.ime_prezime : cistUnos;
        const vecTu = workers.find(w => w.radnik_ime.toLowerCase() === ime.toLowerCase());
        
        if (vecTu) {
            await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('id', vecTu.id);
            toast.info(`Radnik ${ime} odjavljen sa mašine ${masina}.`);
        } else {
            const { data: aktivanDrugdje } = await supabase.from('aktivni_radnici').select('*').ilike('radnik_ime', ime).is('vrijeme_odjave', null).maybeSingle();
            if (aktivanDrugdje) {
                setDialog({
                    isOpen: true,
                    tip: 'pitanje',
                    naslov: 'Prebacivanje radnika',
                    poruka: `Radnik ${ime} je već aktivan na mašini: ${aktivanDrugdje.masina_naziv}.\nŽelite li ga prebaciti na ${masina}?`,
                    confirmText: '✅ PREBACI RADNIKA',
                    cancelText: '✕ ODUSTANI',
                    onConfirm: async () => {
                        await supabase.from('aktivni_radnici').update({ vrijeme_odjave: new Date().toISOString() }).eq('id', aktivanDrugdje.id);
                        await supabase.from('aktivni_radnici').insert([{ radnik_ime: ime, masina_naziv: masina }]);
                        setDialog({ isOpen: false });
                        toast.success(`Radnik ${ime} prebačen na ${masina}.`);
                        setScanCode(''); loadWorkers();
                    },
                    onCancel: () => setDialog({ isOpen: false })
                });
                return;
            } else {
                await supabase.from('aktivni_radnici').insert([{ radnik_ime: ime, masina_naziv: masina }]);
                toast.success(`Radnik ${ime} prijavljen na ${masina}.`);
            }
        }
        setScanCode(''); loadWorkers();
    };

    return (
        <div className="absolute top-0 left-0 w-full bg-theme-main p-6 rounded-box border border-blue-500 shadow-2xl z-50 animate-in zoom-in-95">
            <PametniDialog {...dialog} />
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-blue-500 text-xs tracking-widest uppercase font-black">Prijava na mašinu</h3>
                    <p className="text-[9px] text-slate-500 uppercase">{masina}</p>
                </div>
                <button onClick={onClose} className="text-slate-500 text-xl font-black hover:text-red-500 transition-all">✕</button>
            </div>

            <div className="flex gap-2 mb-6 items-end relative z-50">
                <div className="flex-1">
                    <SearchableInput label="Ime ili QR Radnika" value={scanCode} onChange={v => setScanCode(v)} list={allRadnici.map(r => r.ime_prezime)} />
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