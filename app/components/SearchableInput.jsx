"use client";
import React, { useState, useEffect, useRef } from 'react';
import { normalizujZaPretragu } from './MasterSearch';

export default function SearchableInput({ value, onChange, list = [], placeholder = "Pronađi..." }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const wrapperRef = useRef(null);

    useEffect(() => { setSearch(value || ''); }, [value]);
    useEffect(() => { setSelectedIndex(0); }, [search]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const safeQuery = normalizujZaPretragu(search);
    const filtered = list.filter(item => normalizujZaPretragu(item).includes(safeQuery));

    const handleKeyDown = (e) => {
        if (!open) {
            if (e.key === 'ArrowDown') setOpen(true);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const chosen = filtered[selectedIndex] ?? filtered[0];
            if (chosen !== undefined) selectItem(chosen);
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    const selectItem = (item) => {
        onChange(item);
        setSearch(item);
        setOpen(false);
    };

    return (
        <div ref={wrapperRef} className="relative w-full h-full">
            <input
                value={search}
                onChange={e => { setSearch(e.target.value); setOpen(true); onChange(e.target.value); }}
                onFocus={() => setOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full h-full min-h-[45px] p-3 bg-transparent text-xs text-theme-text outline-none font-black uppercase"
            />
            {open && filtered.length > 0 && (
                <div className="absolute z-[100] w-full mt-1 bg-theme-panel border border-theme-border rounded-xl shadow-2xl max-h-60 overflow-y-auto text-left custom-scrollbar">
                    {filtered.map((item, index) => (
                        <div
                            key={index}
                            onMouseDown={(e) => { e.preventDefault(); selectItem(item); }}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={`p-3 border-b border-theme-border cursor-pointer text-xs font-black uppercase transition-colors ${index === selectedIndex ? 'bg-blue-600 text-white' : 'text-theme-text hover:bg-theme-card'}`}
                        >
                            {item}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
