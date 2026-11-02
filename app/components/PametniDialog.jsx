"use client";
import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, Trash2, HelpCircle, X } from 'lucide-react';

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

    if (!isOpen) return null;

    const getTheme = () => {
        switch (tip) {
            case 'opasnost':
            case 'greska':
                return {
                    border: 'border-red-500/50',
                    glow: 'shadow-[0_0_50px_rgba(239,68,68,0.25)]',
                    iconBg: 'bg-red-500/20 text-red-500 border-red-500/40',
                    btnBg: 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30',
                    icon: <Trash2 size={28} />
                };
            case 'uspjeh':
                return {
                    border: 'border-emerald-500/50',
                    glow: 'shadow-[0_0_50px_rgba(16,185,129,0.25)]',
                    iconBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
                    btnBg: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30',
                    icon: <CheckCircle2 size={28} />
                };
            case 'info':
                return {
                    border: 'border-blue-500/50',
                    glow: 'shadow-[0_0_50px_rgba(59,130,246,0.25)]',
                    iconBg: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
                    btnBg: 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30',
                    icon: <Info size={28} />
                };
            case 'pitanje':
                return {
                    border: 'border-purple-500/50',
                    glow: 'shadow-[0_0_50px_rgba(168,85,247,0.25)]',
                    iconBg: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
                    btnBg: 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30',
                    icon: <HelpCircle size={28} />
                };
            default:
                return {
                    border: 'border-amber-500/50',
                    glow: 'shadow-[0_0_50px_rgba(245,158,11,0.25)]',
                    iconBg: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
                    btnBg: 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30',
                    icon: <AlertTriangle size={28} />
                };
        }
    };

    const t = getTheme();

    // 🟢 OSIGURAČ: Ako prozor nema onConfirm (samo obavještenje), klik na glavno dugme poziva onCancel i zatvara modal!
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
        <div className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className={`bg-theme-card border-2 ${t.border} ${t.glow} rounded-[2rem] max-w-md w-full p-6 md:p-8 relative overflow-hidden animate-in zoom-in-95 duration-200`}>
                {onCancel && (
                    <button
                        onClick={onCancel}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-theme-panel border border-theme-border text-theme-muted hover:text-white flex items-center justify-center transition-colors"
                    >
                        <X size={16} />
                    </button>
                )}

                <div className="flex flex-col items-center text-center">
                    <div className={`w-16 h-16 rounded-2xl border ${t.iconBg} flex items-center justify-center mb-4`}>
                        {t.icon}
                    </div>

                    <h3 className="text-lg md:text-xl font-black text-theme-text uppercase tracking-wider mb-2">
                        {naslov}
                    </h3>

                    <p className="text-xs md:text-sm text-theme-muted font-bold leading-relaxed whitespace-pre-line mb-6">
                        {poruka}
                    </p>

                    {requireInput && (
                        <div className="w-full mb-6">
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

                    <div className="flex flex-col-reverse sm:flex-row gap-3 w-full">
                        {imaObjeAkcije && (
                            <button
                                onClick={onCancel}
                                className="flex-1 py-3.5 px-4 rounded-xl bg-theme-panel hover:bg-slate-800 text-theme-muted hover:text-white border border-theme-border font-black text-xs uppercase tracking-widest transition-all"
                            >
                                {cancelText}
                            </button>
                        )}
                        <button
                            onClick={handleConfirmClick}
                            disabled={requireInput && !inputVal.trim()}
                            className={`flex-1 py-3.5 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${t.btnBg} ${requireInput && !inputVal.trim() ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                            {onConfirm ? confirmText : (cancelText === 'ZATVORI' ? '✓ U REDU' : cancelText)}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}