"use client";
import React, { useState, useMemo } from 'react';

export default function SmartSearchableInput({ label, value, onChange, list = [], storageKey }) {
    const [open, setOpen] = useState(false);
    
    const sortedList = useMemo(() => {
        if (!storageKey) return list;
        const freqs = JSON.parse(localStorage.getItem(`freq_${storageKey}`) || '{}');
        return [...list].sort((a, b) => (freqs[b] || 0) - (freqs[a] || 0));
    }, [list, storageKey, open]);

    const handleSelect = (item) => {
        onChange(item);
        setOpen(false);
        if (storageKey) {
            const freqs = JSON.parse(localStorage.getItem(`freq_${storageKey}`) || '{}');
            freqs[item] = (freqs[item] || 0) + 1;
            localStorage.setItem(`freq_${storageKey}`, JSON.stringify(freqs));
        }
    };

    return (
        <div className="relative font-black">
            <label className="text-[8px] text-slate-500 uppercase ml-3 block mb-1">{label}</label>
            <input type="text" value={value} onFocus={() => setOpen(true)} onChange={e => { onChange(e.target.value.toUpperCase()); setOpen(true); }} className="w-full p-3 bg-[#0f172a] border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-indigo-500 uppercase" />
            {open && sortedList.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-40 overflow-y-auto z-50">
                    {sortedList.filter(i => i.includes(value.toUpperCase())).map((item, idx) => (
                        <div key={idx} onClick={() => handleSelect(item)} className="p-3 text-[10px] border-b border-slate-700 hover:bg-indigo-600 uppercase cursor-pointer text-white flex justify-between">
                            <span>{item}</span>
                            {idx === 0 && !value && <span className="text-[8px] text-indigo-300">Najčešće</span>}
                        </div>
                    ))}
                    <div onClick={() => setOpen(false)} className="p-2 text-center text-[8px] text-slate-500 cursor-pointer">Zatvori</div>
                </div>
            )}
        </div>
    );
}