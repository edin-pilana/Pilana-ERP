"use client";
import React, { useState, useEffect } from 'react';

export default function SearchableInput({ label, value, onChange, list }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    useEffect(() => { setSearch(value || ''); }, [value]);
    const filtered = list.filter(item => item.toUpperCase().includes(search.toUpperCase()));

    return (
        <div className="relative w-full font-black">
            {label && <label className="text-[8px] text-slate-500 uppercase ml-2 block mb-1">{label}</label>}
            <input 
                value={search} 
                onFocus={() => setOpen(true)} 
                onChange={e => { setSearch(e.target.value); setOpen(true); onChange(e.target.value); }} 
                className="w-full p-3 bg-[#0f172a] rounded-xl text-xs text-white border border-slate-700 outline-none focus:border-blue-500 uppercase" 
                placeholder="Pronađi..." 
            />
            {open && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl max-h-40 overflow-y-auto shadow-2xl">
                    {filtered.map((item, idx) => (
                        <div key={idx} onClick={() => { onChange(item); setSearch(item); setOpen(false); }} className="p-3 border-b border-slate-700 hover:bg-blue-600 cursor-pointer text-xs text-white uppercase">
                            {item}
                        </div>
                    ))}
                    <div onClick={() => setOpen(false)} className="p-2 text-center text-[8px] text-slate-500 cursor-pointer hover:text-white bg-slate-900 rounded-b-xl">ZATVORI</div>
                </div>
            )}
        </div>
    );
}