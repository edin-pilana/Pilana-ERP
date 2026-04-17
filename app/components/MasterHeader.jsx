"use client";
import React from 'react';

export default function MasterHeader({ header, setHeader, onExit, color, user, hideMasina, modulIme, saas }) {
    return (
        <div className={`flex flex-col md:flex-row justify-between items-center bg-[#1e293b] p-4 rounded-3xl border border-slate-700 shadow-lg gap-4 ${saas?.isEditMode ? 'ring-2 ring-amber-500' : ''}`}>
            <div className="flex items-center gap-3">
                <button onClick={onExit} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl uppercase text-white font-black hover:bg-red-500 transition-all">← Meni</button>
                {/* Ako smo proslijedili ime modula, ispisujemo ga */}
                {modulIme && <span className={`${color} font-black tracking-widest uppercase text-xs hidden md:inline-block`}>Modul: {modulIme}</span>}
            </div>
            
            <div className="flex items-center gap-2">
                <input type="date" value={header.datum} onChange={e => setHeader({...header, datum: e.target.value})} className="bg-slate-900 text-xs text-white p-3 rounded-xl border border-slate-700 outline-none" />
                
                {!hideMasina && (
                    <select value={header.masina} onChange={e => { setHeader({...header, masina: e.target.value}); localStorage.setItem('last_masina', e.target.value); }} className="bg-slate-900 text-xs text-white p-3 rounded-xl border border-slate-700 outline-none w-32 md:w-auto">
                        <option value="">Odaberi mašinu...</option>
                        <option value="BRENTA 1">BRENTA 1</option>
                        <option value="BRENTA 2">BRENTA 2</option>
                        <option value="VIŠELIST 1">VIŠELIST 1</option>
                        <option value="KRAJAC 1">KRAJAC 1</option>
                    </select>
                )}
            </div>

            <div className="flex items-center gap-3">
                {/* SUPERADMIN SaaS KONTROLE */}
                {user?.uloga === 'superadmin' && saas && (
                    saas.isEditMode ? (
                        <div className="flex gap-2">
                            <button onClick={saas.odustani} className="px-3 py-2 bg-red-900/40 text-red-400 border border-red-500/50 rounded-xl text-[9px] font-black uppercase hover:bg-red-500 hover:text-white transition-all">✕ Odustani</button>
                            <button onClick={saas.spasiDizajn} className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:bg-emerald-500 transition-all">💾 Spasi Dizajn</button>
                        </div>
                    ) : (
                        <button onClick={saas.pokreniEdit} className="px-3 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded-xl text-[9px] font-black uppercase hover:bg-amber-500 hover:text-white transition-all shadow-md">✏️ Uredi Modul</button>
                    )
                )}

                <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-700 flex flex-col items-end">
                    <span className="text-[9px] text-slate-500 uppercase font-black">Prijavljeni radnik</span>
                    <span className="text-xs text-white font-bold">{user?.ime_prezime || 'Nepoznat'}</span>
                </div>
            </div>
        </div>
    );
}