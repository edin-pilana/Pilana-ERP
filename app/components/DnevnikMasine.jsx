"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { toast } from 'sonner';
import PametniDialog from './PametniDialog';

export default function DnevnikMasine({ modul, header, user }) {
    const [logovi, setLogovi] = useState([]);
    const t = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const [form, setForm] = useState({ vrijeme_od: t, vrijeme_do: '', zastoj_min: '', napomena: '' });
    const [dialog, setDialog] = useState({ isOpen: false });

    useEffect(() => { loadLogove(); }, [header]);

    const loadLogove = async () => {
        if(!header || !header.datum || !header.masina) return;
        const { data } = await supabase.from('dnevnik_masine').select('*').eq('datum', header.datum).eq('masina', header.masina).eq('modul', modul).order('vrijeme_od', { ascending: false });
        if (data) setLogovi(data);
    };

    const snimiZastojIliRad = async () => {
        if (!header?.masina) return toast.warning("Prvo odaberite mašinu u zaglavlju!");
        if (!form.vrijeme_od) return toast.warning("Vrijeme početka je obavezno!");
        const payload = {
            datum: header.datum, masina: header.masina, modul: modul,
            vrijeme_od: form.vrijeme_od, vrijeme_do: form.vrijeme_do || null,
            zastoj_min: parseInt(form.zastoj_min) || 0, napomena: form.napomena, snimio: user?.ime_prezime || 'Nepoznat'
        };
        const { error } = await supabase.from('dnevnik_masine').insert([payload]);
        if (error) return toast.error("Greška pri snimanju: " + error.message);
        toast.success("Zapis o radu/zastoju uspješno dodan!");
        setForm({ vrijeme_od: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), vrijeme_do: '', zastoj_min: '', napomena: '' });
        loadLogove();
    };

    const obrisiLog = (id) => {
        setDialog({
            isOpen: true,
            tip: 'opasnost',
            naslov: 'Brisanje zapisa zastoja',
            poruka: 'Da li ste sigurni da želite trajno obrisati ovaj zapis iz dnevnika mašine?',
            confirmText: '🗑️ OBRIŠI',
            cancelText: 'ODUSTANI',
            onConfirm: async () => {
                await supabase.from('dnevnik_masine').delete().eq('id', id);
                setDialog({ isOpen: false });
                toast.success("Zapis obrisan iz dnevnika.");
                loadLogove();
            },
            onCancel: () => setDialog({ isOpen: false })
        });
    };

    return (
        <div className="bg-theme-card p-6 rounded-box border border-theme-border shadow-2xl space-y-4 mt-6">
            <PametniDialog {...dialog} />
            <h3 className="text-amber-500 font-black uppercase text-xs tracking-widest">⚙️ EVIDENCIJA RADA I ZASTOJA MAŠINE</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-12 gap-4 bg-theme-panel p-4 rounded-2xl border border-theme-border items-end shadow-inner">
                <div className="sm:col-span-1 md:col-span-2">
                    <label className="text-[9px] text-slate-400 font-black uppercase ml-1 block mb-1.5">Početak (Sati)</label>
                    <input type="time" value={form.vrijeme_od} onChange={e => setForm({...form, vrijeme_od: e.target.value})} className="w-full min-h-[46px] p-3 bg-theme-card rounded-xl text-xs text-theme-text font-bold border border-theme-border outline-none focus:border-amber-500" />
                </div>
                <div className="sm:col-span-1 md:col-span-2">
                    <label className="text-[9px] text-slate-400 font-black uppercase ml-1 block mb-1.5">Završetak (Sati)</label>
                    <input type="time" value={form.vrijeme_do} onChange={e => setForm({...form, vrijeme_do: e.target.value})} className="w-full min-h-[46px] p-3 bg-theme-card rounded-xl text-xs text-theme-text font-bold border border-theme-border outline-none focus:border-amber-500" />
                </div>
                <div className="sm:col-span-1 md:col-span-2">
                    <label className="text-[9px] text-red-400 font-black uppercase ml-1 block mb-1.5">Zastoj (min)</label>
                    <input type="number" value={form.zastoj_min} onChange={e => setForm({...form, zastoj_min: e.target.value})} placeholder="0 min" className="w-full min-h-[46px] p-3 bg-red-900/20 rounded-xl text-sm text-red-400 font-black border border-red-500/50 outline-none text-center" />
                </div>
                <div className="sm:col-span-2 md:col-span-4">
                    <label className="text-[9px] text-slate-400 font-black uppercase ml-1 block mb-1.5">Napomena / Razlog zastoja</label>
                    <input type="text" value={form.napomena} onChange={e => setForm({...form, napomena: e.target.value})} placeholder="Održavanje, zamjena žage, kvar..." className="w-full min-h-[46px] p-3 bg-theme-card rounded-xl text-xs text-theme-text font-bold border border-theme-border outline-none focus:border-amber-500" />
                </div>
                <div className="sm:col-span-1 md:col-span-2">
                    <button onClick={snimiZastojIliRad} className="w-full min-h-[46px] py-3 bg-amber-600 text-white font-black rounded-xl text-[10px] uppercase shadow-lg hover:bg-amber-500 transition-all">➕ Dodaj Zapis</button>
                </div>
            </div>
            <div className="space-y-2 mt-4 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {logovi.length === 0 && <p className="text-center text-slate-500 text-[10px] uppercase py-2">Nema unesenih zastoja za danas.</p>}
                {logovi.map(l => (
                    <div key={l.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 bg-theme-panel border border-theme-border rounded-xl gap-2">
                        <div>
                            <p className="text-[10px] text-slate-400 font-black">
                                <span className="text-emerald-400">{l.vrijeme_od}</span> - {l.vrijeme_do ? <span className="text-amber-400">{l.vrijeme_do}</span> : <span className="text-slate-500">...</span>}
                            </p>
                            <p className="text-theme-text text-xs font-bold mt-1">{l.napomena || 'Nema napomene'}</p>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-4">
                            {l.zastoj_min > 0 && <span className="text-red-400 text-xs font-black bg-red-900/30 px-2.5 py-1 rounded-lg border border-red-500/30">Zastoj: {l.zastoj_min} min</span>}
                            <button onClick={() => obrisiLog(l.id)} className="text-red-500 font-black hover:bg-red-500/20 px-2.5 py-1.5 rounded-lg transition-colors">✕</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}