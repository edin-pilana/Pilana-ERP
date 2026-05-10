import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PametniDialog({ isOpen, tip = 'info', naslov, poruka, onConfirm, onCancel, confirmText = 'POTVRDI', cancelText = 'ZATVORI' }) {
    if (!isOpen) return null;

    const config = {
        greska: { ikona: '🛑', boja: 'red', border: 'border-red-500', bg: 'bg-red-900/20', text: 'text-red-400', shadow: 'shadow-[0_0_50px_rgba(239,68,68,0.3)]' },
        upozorenje: { ikona: '⚠️', boja: 'amber', border: 'border-amber-500', bg: 'bg-amber-900/20', text: 'text-amber-400', shadow: 'shadow-[0_0_50px_rgba(245,158,11,0.3)]' },
        uspjeh: { ikona: '✅', boja: 'emerald', border: 'border-emerald-500', bg: 'bg-emerald-900/20', text: 'text-emerald-400', shadow: 'shadow-[0_0_50px_rgba(16,185,129,0.3)]' },
        info: { ikona: 'ℹ️', boja: 'blue', border: 'border-blue-500', bg: 'bg-blue-900/20', text: 'text-blue-400', shadow: 'shadow-[0_0_50px_rgba(59,130,246,0.3)]' }
    };

    const c = config[tip] || config.info;

    return (
        <div className="fixed inset-0 z-[9999] bg-[#090e17]/90 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className={`bg-theme-card border-2 ${c.border} p-8 rounded-[2rem] ${c.shadow} max-w-lg w-full text-center`}>
                <span className="text-6xl mb-4 block animate-bounce">{c.ikona}</span>
                <h2 className="text-2xl font-black text-theme-text uppercase mb-2 tracking-widest">{naslov}</h2>
                <p className="text-slate-400 text-sm mb-8 whitespace-pre-wrap leading-relaxed">{poruka}</p>
                
                <div className="flex gap-4 flex-col md:flex-row justify-center">
                    {onCancel && (
                        <button onClick={onCancel} className="flex-1 py-4 bg-theme-panel text-slate-300 rounded-xl uppercase font-black hover:bg-slate-700 transition-all border border-slate-600">
                            ✕ {cancelText}
                        </button>
                    )}
                    {onConfirm && (
                        <button onClick={onConfirm} className={`flex-1 py-4 bg-${c.boja}-600 text-white rounded-xl uppercase font-black shadow-lg hover:bg-${c.boja}-500 transition-all`}>
                            {confirmText}
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
}