"use client";
import React, { useState, useEffect, useRef } from 'react';

// Normalizacija za pretragu: velika slova, bez dijakritika (Ć->C, Č->C, Š->S, Ž->Z, Đ->D)
// Tako "aladin", "ALADIN" i "Aladin" nalaze isto, a "cacak" nalazi "ČAČAK".
export const normalizujZaPretragu = (v) => {
    return String(v ?? '')
        .toUpperCase()
        .replace(/Ć/g, 'C').replace(/Č/g, 'C').replace(/Š/g, 'S')
        .replace(/Ž/g, 'Z').replace(/Đ/g, 'D')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .trim();
};

export default function MasterSearch({
    data = [],
    value,
    onSelect,
    onChange,
    placeholder = "Pronađi...",
    poljaZaPretragu = ['id', 'naziv'],
    renderItem,
    onScanClick,
    // NOVO (opciono, unazad kompatibilno): ako se proslijedi, ova funkcija odlučuje
    // da li item odgovara upitu. Omogućava univerzalnu pretragu (kupac + RN + proizvod
    // + dimenzija + status + ponuda + napomena + stavke) bez mijenjanja ostalih modula.
    // Potpis: filterFn(item, normalizovaniUpit, originalniUpit) => boolean
    filterFn = null,
    // NOVO: koliko najviše redova se renderuje u dropdownu. Bez ovoga, prazan upit
    // je renderovao svih 1000+ naloga i zamrzavao mobitel. Default 100.
    maxPrikaz = 100,
    onEnterNoMatch = null,
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(value || '');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const wrapperRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => { setSearch(value || ''); }, [value]);
    useEffect(() => { setSelectedIndex(0); }, [search]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const safeSearch = normalizujZaPretragu(search);

    // Pametno filtriranje: ako je proslijeđen filterFn, on je jedini autoritet.
    // Inače staro ponašanje (poljaZaPretragu), ali sa normalizacijom dijakritika.
    const filtriranoSve = data.filter(item => {
        if (!safeSearch) return true;
        if (typeof filterFn === 'function') return filterFn(item, safeSearch, search);
        return poljaZaPretragu.some(polje => {
            const val = item?.[polje];
            if (val == null || val === '') return false;
            return normalizujZaPretragu(val).includes(safeSearch);
        });
    });

    const ukupnoPronadjeno = filtriranoSve.length;
    const filtered = filtriranoSve.slice(0, maxPrikaz);

    const selectItem = (item) => {
        const val = item?.[poljaZaPretragu[0]] ?? '';
        setSearch(val);
        setOpen(false);
        if (onChange) onChange(val);
        if (onSelect) onSelect(item);
        inputRef.current?.blur();
    };

    const handleKeyDown = (e) => {
        if (!open) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') setOpen(true);
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
            if (filtered.length > 0 && filtered[selectedIndex]) {
                selectItem(filtered[selectedIndex]);
            } else {
                // BITNO za univerzalnu pretragu: Enter bez odabira NE poništava kucanje.
                // Ako roditelj podržava direktan unos (npr. sken dokumenta u Blagajni), pozovi onEnterNoMatch.
                setOpen(false);
                if (typeof onEnterNoMatch === 'function' && String(search || '').trim()) {
                    onEnterNoMatch(String(search).trim());
                }
            }
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    return (
        <div ref={wrapperRef} className="relative font-black w-full flex bg-theme-panel border border-theme-border rounded-xl overflow-visible focus-within:border-theme-accent transition-all shadow-inner min-h-[45px]">
            <input
                ref={inputRef}
                value={search}
                onFocus={() => setOpen(true)}
                onClick={() => setOpen(true)}
                onKeyDown={handleKeyDown}
                onChange={e => {
                    const v = e.target.value.toUpperCase();
                    setSearch(v);
                    setOpen(true);
                    // BITNO: kucanje se ODMAH javlja roditelju. Ranije je Lager ovo
                    // propuštao jer nije proslijedio onChange, pa je filter ostajao prazan.
                    if (onChange) onChange(v);
                }}
                placeholder={placeholder}
                className="flex-1 px-4 bg-transparent text-sm text-theme-text outline-none uppercase font-black tracking-widest relative z-10 min-w-0"
                autoComplete="off"
            />
            {onScanClick && (
                <button type="button" onClick={onScanClick} className="px-5 bg-theme-accent/20 text-theme-accent text-lg hover:bg-theme-accent hover:text-white transition-all border-l border-theme-accent/30 relative z-10 shrink-0">📷</button>
            )}
            {open && (
                <div className="absolute top-full left-0 z-[9999] w-full mt-2 bg-theme-panel border border-theme-border shadow-2xl rounded-xl max-h-60 overflow-y-auto text-left custom-scrollbar">
                    {filtered.length === 0 && <div className="p-4 text-xs text-theme-muted text-center italic">Nema rezultata... Pritisni Enter ili klikni vani, kucani tekst će i dalje filtrirati.</div>}
                    {filtered.map((item, index) => (
                        <div
                            key={item?.id ?? item?.[poljaZaPretragu[0]] ?? index}
                            onMouseDown={(e) => { e.preventDefault(); selectItem(item); }}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={`p-3 border-b border-theme-border cursor-pointer transition-colors ${index === selectedIndex ? 'bg-theme-accent text-white' : 'hover:bg-theme-card text-theme-text'}`}
                        >
                            {renderItem ? renderItem(item) : <span className="font-black text-xs uppercase">{item[poljaZaPretragu[0]]}</span>}
                        </div>
                    ))}
                    {ukupnoPronadjeno > filtered.length && (
                        <div className="p-2 text-center text-[9px] text-slate-400 uppercase font-bold bg-theme-card sticky bottom-0">Prikazano {filtered.length} od {ukupnoPronadjeno} — suzi pretragu za ostale</div>
                    )}
                </div>
            )}
        </div>
    );
}
