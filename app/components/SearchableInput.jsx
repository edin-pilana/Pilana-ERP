import React, { useState, useEffect, useRef } from 'react';

export default function SearchableInput({ value, onChange, list = [], placeholder = "Pronađi..." }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    const [selectedIndex, setSelectedIndex] = useState(0); 
    const wrapperRef = useRef(null);

    // Sinhronizacija vanjske vrijednosti
    useEffect(() => { setSearch(value || ''); }, [value]);
    
    // Resetuj selekciju na početak kad god se promijeni tekst
    useEffect(() => { setSelectedIndex(0); }, [search]); 

    // Zatvori dropdown ako se klikne van njega
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Filtriranje liste
    const filtered = list.filter(item => 
        (item || '').toString().toUpperCase().includes((search || '').toString().toUpperCase())
    );

    // Upravljanje strelicama i Enter tipkom
    const handleKeyDown = (e) => {
        if (!open) {
            // Ako je zatvoreno, na strelicu dole otvori
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
            if (filtered.length > 0) {
                selectItem(filtered[selectedIndex]);
            }
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
                className="w-full h-full min-h-[45px] p-3 bg-transparent text-xs text-white outline-none font-black uppercase"
            />
            
            {open && filtered.length > 0 && (
                <div className="absolute z-[100] w-full mt-1 bg-theme-panel border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto text-left custom-scrollbar">
                    {filtered.map((item, index) => (
                        <div 
                            key={index} 
                            onClick={() => selectItem(item)} 
                            onMouseEnter={() => setSelectedIndex(index)} // Prati miša ako neko ipak koristi miša
                            className={`p-3 border-b border-slate-700 cursor-pointer text-xs font-black uppercase transition-colors ${index === selectedIndex ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                        >
                            {item}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}