"use client";
import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, Trash2, HelpCircle, X, XCircle } from 'lucide-react';

export default function PametniDialog({
    isOpen,
    tip = 'upozorenje', // 'upozorenje' | 'opasnost' | 'greska' | 'info' | 'uspjeh' | 'pitanje'
    naslov = 'Potvrda akcije',
    poruka = '',
    confirmText = 'POTVRDI',
    cancelText = 'ZATVORI',
    showCancel = true,
    requireInput = false,
    inputPlaceholder = 'Unesite razlog ili napomenu...',
    defaultInputValue = '',
    onConfirm,
    onCancel
}) {
    const [inputVal, setInputVal] = useState(defaultInputValue || '');

    useEffect(() => {
        if (isOpen) setInputVal(defaultInputValue || '');
    }, [isOpen, defaultInputValue]);

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e) => {
            if (e.key === 'Escape' && onCancel) {
                e.preventDefault();
                onCancel();
            }
        };
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    const getTheme = () => {
        switch (tip) {
            case 'opasnost':
                return {
                    accentBar: 'from-red-500 via-rose-500 to-red-600',
                    border: 'border-red-500/40',
                    glow: 'shadow-[0_25px_70px_-15px_rgba(239,68,68,0.38)]',
                    iconBg: 'bg-gradient-to-br from-red-500/25 to-rose-600/10 text-red-500 border-red-500/40 ring-4 ring-red-500/10',
                    badge: 'bg-red-500/15 text-red-400 border-red-500/30',
                    badgeText: 'OPASNOST',
                    btnBg: 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-600/30',
                    icon: <Trash2 size={26} />
                };
            case 'greska':
                return {
                    accentBar: 'from-rose-500 via-red-500 to-orange-500',
                    border: 'border-red-500/40',
                    glow: 'shadow-[0_25px_70px_-15px_rgba(239,68,68,0.35)]',
                    iconBg: 'bg-gradient-to-br from-red-500/25 to-orange-500/10 text-red-500 border-red-500/40 ring-4 ring-red-500/10',
                    badge: 'bg-red-500/15 text-red-400 border-red-500/30',
                    badgeText: 'GREŠKA',
                    btnBg: 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-600/30',
                    icon: <XCircle size={26} />
                };
            case 'uspjeh':
                return {
                    accentBar: 'from-emerald-400 via-emerald-500 to-teal-500',
                    border: 'border-emerald-500/40',
                    glow: 'shadow-[0_25px_70px_-15px_rgba(16,185,129,0.35)]',
                    iconBg: 'bg-gradient-to-br from-emerald-500/25 to-teal-500/10 text-emerald-500 border-emerald-500/40 ring-4 ring-emerald-500/10',
                    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                    badgeText: 'USPJEŠNO',
                    btnBg: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/30',
                    icon: <CheckCircle2 size={26} />
                };
            case 'info':
                return {
                    accentBar: 'from-sky-400 via-blue-500 to-indigo-500',
                    border: 'border-blue-500/40',
                    glow: 'shadow-[0_25px_70px_-15px_rgba(59,130,246,0.35)]',
                    iconBg: 'bg-gradient-to-br from-blue-500/25 to-indigo-500/10 text-blue-500 border-blue-500/40 ring-4 ring-blue-500/10',
                    badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
                    badgeText: 'OBAVIJEST',
                    btnBg: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/30',
                    icon: <Info size={26} />
                };
            case 'pitanje':
                return {
                    accentBar: 'from-violet-400 via-purple-500 to-fuchsia-500',
                    border: 'border-purple-500/40',
                    glow: 'shadow-[0_25px_70px_-15px_rgba(168,85,247,0.35)]',
                    iconBg: 'bg-gradient-to-br from-purple-500/25 to-fuchsia-500/10 text-purple-500 border-purple-500/40 ring-4 ring-purple-500/10',
                    badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
                    badgeText: 'POTVRDA',
                    btnBg: 'bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white shadow-lg shadow-purple-600/30',
                    icon: <HelpCircle size={26} />
                };
            default:
                return {
                    accentBar: 'from-amber-400 via-amber-500 to-orange-500',
                    border: 'border-amber-500/40',
                    glow: 'shadow-[0_25px_70px_-15px_rgba(245,158,11,0.35)]',
                    iconBg: 'bg-gradient-to-br from-amber-500/25 to-orange-500/10 text-amber-500 border-amber-500/40 ring-4 ring-amber-500/10',
                    badge: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
                    badgeText: 'UPOZORENJE',
                    btnBg: 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-lg shadow-amber-600/30',
                    icon: <AlertTriangle size={26} />
                };
        }
    };

    const t = getTheme();

    const handleConfirmClick = () => {
        if (requireInput && !inputVal.trim()) return;
        if (onConfirm) {
            onConfirm(inputVal.trim());
        } else if (onCancel) {
            onCancel();
        }
    };

    const imaObjeAkcije = Boolean(onConfirm && onCancel && showCancel);

    return (
        <div
            onClick={(e) => { if (e.target === e.currentTarget && onCancel) onCancel(); }}
            className="erp-modal-backdrop fixed inset-0 z-[999999] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
            <div className={`bg-theme-card border ${t.border} ${t.glow} rounded-[1.75rem] max-w-md w-full relative overflow-hidden animate-in zoom-in-95 duration-200`}>
                <div className={`h-1.5 w-full bg-gradient-to-r ${t.accentBar}`} />

                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        aria-label="Zatvori"
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-theme-panel/80 border border-theme-border text-theme-muted hover:text-theme-text hover:scale-105 flex items-center justify-center transition-all"
                    >
                        <X size={15} />
                    </button>
                )}

                <div className="p-6 md:p-7 flex flex-col items-center text-center">
                    <div className={`w-16 h-16 rounded-2xl border ${t.iconBg} flex items-center justify-center mb-3.5 shadow-inner`}>
                        {t.icon}
                    </div>

                    <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-0.5 rounded-full border mb-2.5 ${t.badge}`}>
                        {t.badgeText}
                    </span>

                    <h3 className="text-lg md:text-xl font-black text-theme-text tracking-tight mb-2">
                        {naslov}
                    </h3>

                    <p className="text-xs md:text-sm text-theme-muted font-medium leading-relaxed whitespace-pre-line mb-6 max-h-[45vh] overflow-y-auto custom-scrollbar w-full">
                        {poruka}
                    </p>

                    {requireInput && (
                        <div className="w-full mb-5">
                            <input
                                type="text"
                                autoFocus
                                value={inputVal}
                                onChange={(e) => setInputVal(e.target.value)}
                                placeholder={inputPlaceholder}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmClick(); }}
                                className="w-full min-h-[46px] p-3.5 bg-theme-panel border border-theme-border rounded-xl text-xs font-bold text-theme-text outline-none focus:border-amber-500 text-center"
                            />
                        </div>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row gap-2.5 w-full">
                        {imaObjeAkcije && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="flex-1 py-3 px-4 rounded-xl bg-theme-panel hover:opacity-90 text-theme-text border border-theme-border font-black text-xs uppercase tracking-wider transition-all"
                            >
                                {cancelText}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleConfirmClick}
                            disabled={requireInput && !inputVal.trim()}
                            className={`flex-1 py-3 px-5 rounded-xl font-black text-xs uppercase tracking-wider transition-all active:scale-[0.98] ${t.btnBg} ${requireInput && !inputVal.trim() ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                            {onConfirm ? confirmText : (cancelText === 'ZATVORI' ? '✓ U REDU' : cancelText)}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
