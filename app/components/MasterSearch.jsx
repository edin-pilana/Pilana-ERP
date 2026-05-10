"use client";
import React, { useState, useEffect, useRef } from 'react';

export default function MasterSearch({ data = [], value, onSelect, placeholder = "Pronađi...", poljaZaPretragu = ['id', 'naziv'], renderItem, onScanClick }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const wrapperRef = useRef(null);

    useEffect(() => { setSearch(value || ''); }, [value]);
    useEffect(() => { setSelectedIndex(0); }, [search]);

    useEffect(() => {
        function handleClickOutside(event) { if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false); }
        document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const safeSearch = (search || '').toString().toUpperCase().trim();
    
    // Pametno filtriranje
    const filtered = data.filter(item => {
        return poljaZaPretragu.some(polje => {
            const val = item[polje];
            if (!val) return false;
            return val.toString().toUpperCase().includes(safeSearch);
        });
    });

    const handleKeyDown = (e) => {
        if (!open) { if (e.key === 'ArrowDown') setOpen(true); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev)); } 
        else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0)); } 
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered.length > 0) {
                const sel = filtered[selectedIndex];
                onSelect(sel); setOpen(false);
            } else { setOpen(false); }
        } else if (e.key === 'Escape') setOpen(false);
    };

    return (
        <div ref={wrapperRef} className="relative font-black w-full flex bg-theme-panel border border-theme-border rounded-xl overflow-visible focus-within:border-theme-accent transition-all shadow-inner min-h-[45px]">
            <input 
                value={search} 
                onFocus={() => setOpen(true)} 
                onKeyDown={handleKeyDown} 
                onChange={e => { setSearch(e.target.value.toUpperCase()); setOpen(true); }} 
                placeholder={placeholder} 
                className="flex-1 px-4 bg-transparent text-sm text-theme-text outline-none uppercase font-black tracking-widest relative z-10 min-w-0" 
            />
            {onScanClick && (
                <button onClick={onScanClick} className="px-5 bg-theme-accent/20 text-theme-accent text-lg hover:bg-theme-accent hover:text-white transition-all border-l border-theme-accent/30 relative z-10 shrink-0">📷</button>
            )}
            
            {open && search && (
                <div className="absolute top-full left-0 z-[9999] w-full mt-2 custom-dropdown-menu rounded-xl max-h-60 overflow-y-auto text-left custom-scrollbar">
                    {filtered.length === 0 && <div className="p-4 text-xs text-theme-muted text-center italic">Nema rezultata...</div>}
                    {filtered.map((item, index) => (
                        <div 
                            key={index} 
                            onClick={() => { onSelect(item); setOpen(false); }} 
                            onMouseEnter={()=>setSelectedIndex(index)} 
                            className={`p-3 border-b border-slate-700 cursor-pointer transition-colors ${index === selectedIndex ? 'bg-theme-accent text-white' : 'hover:bg-slate-800 text-theme-text'}`}
                        >
                            {/* Ako nismo poslali custom render, samo ispiši prvo polje iz pretrage */}
                            {renderItem ? renderItem(item) : <span className="font-black text-xs uppercase">{item[poljaZaPretragu[0]]}</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}