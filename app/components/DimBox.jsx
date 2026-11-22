"use client";
import React from 'react';

export default function DimBox({ label, val, set, disabled = false, inputRef = null, onKeyDown = null, accentClass = 'focus-within:border-theme-accent' }) {
    return (
        <div
            data-ds="dim-box"
            className={`bg-theme-panel p-2.5 sm:p-3 rounded-xl border border-theme-border shadow-inner font-bold text-center flex flex-col items-center justify-center ${accentClass} transition-colors min-w-0 ${disabled ? 'opacity-50' : ''}`}
        >
            <span data-ds="dim-label" className="text-[9px] text-theme-muted uppercase block mb-1 font-black tracking-widest">
                {label}
            </span>
            <input
                data-ds="dim-input"
                ref={inputRef}
                onKeyDown={onKeyDown}
                type="number"
                value={val}
                onChange={(e) => set(e.target.value)}
                disabled={disabled}
                className="w-full min-w-0 px-2 py-1.5 bg-transparent text-theme-text font-black outline-none text-base sm:text-xl md:text-2xl text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="0"
            />
        </div>
    );
}
