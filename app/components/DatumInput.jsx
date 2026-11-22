"use client";
import React, { useRef, forwardRef } from 'react';
import { Calendar, Minus, Plus } from 'lucide-react';
import {
    prikazDatumaBHS,
    prikazMjesecaBHS,
    pomjeriDatumDana,
    pomjeriMjesec,
    toLocalIso,
} from '../utils/dateHelpers';

/**
 * Univerzalni BHS DatumInput:
 * - Uvijek prikazuje datum u formatu DD.MM.YYYY. (ili MM.YYYY. za type="month")
 * - Ima dugmad "-" i "+" za pomicanje po 1 dan (ili 1 mjesec) naprijed/nazad
 * - Klik na datum otvara nativni kalendar (radi na desktopu i mobitelu)
 * - Interno čuva i emituje standardni ISO format (YYYY-MM-DD ili YYYY-MM)
 */
const DatumInput = forwardRef(function DatumInput(
    {
        value = '',
        onChange,
        type = 'date',
        min,
        max,
        disabled = false,
        className = '',
        style = undefined,
        onKeyDown = undefined,
        title = '',
        placeholder = 'Odaberi datum',
        'data-testid': dataTestId = undefined,
        compact = false,
        ...rest
    },
    forwardedRef
) {
    const innerInputRef = useRef(null);

    const setRefs = (el) => {
        innerInputRef.current = el;
        if (typeof forwardedRef === 'function') forwardedRef(el);
        else if (forwardedRef && typeof forwardedRef === 'object') forwardedRef.current = el;
    };

    const isMonth = type === 'month';

    const emitValue = (nextVal) => {
        if (disabled || !onChange) return;
        if (min && nextVal && nextVal < min) return;
        if (max && nextVal && nextVal > max) return;
        onChange({ target: { value: nextVal } });
    };

    const handleStep = (delta) => {
        if (disabled) return;
        if (isMonth) {
            const base = value && /^\d{4}-\d{2}$/.test(value) ? value : toLocalIso(new Date()).slice(0, 7);
            emitValue(pomjeriMjesec(base, delta));
        } else {
            const base = value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : toLocalIso(new Date());
            emitValue(pomjeriDatumDana(base, delta));
        }
    };

    const openPicker = () => {
        if (disabled) return;
        const el = innerInputRef.current;
        if (!el) return;
        try {
            if (typeof el.showPicker === 'function') {
                el.showPicker();
            } else {
                el.focus();
                el.click();
            }
        } catch (e) {
            try { el.focus(); } catch (e2) {}
        }
    };

    const handleKey = (e) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            handleStep(1);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            handleStep(-1);
            return;
        }
        onKeyDown?.(e);
    };

    const displayText = value
        ? (isMonth ? prikazMjesecaBHS(value) : prikazDatumaBHS(value))
        : placeholder;

    const minDisabled = disabled || Boolean(min && value && (isMonth ? pomjeriMjesec(value, -1) < min : pomjeriDatumDana(value, -1) < min));
    const maxDisabled = disabled || Boolean(max && value && (isMonth ? pomjeriMjesec(value, 1) > max : pomjeriDatumDana(value, 1) > max));

    return (
        <div
            data-testid={dataTestId || 'datum-input'}
            data-no-bhs-format="true"
            style={style}
            title={title || (isMonth ? 'Mjesec (−/+ mijenja za 1 mjesec)' : 'Datum (−/+ mijenja za 1 dan)')}
            className={`inline-flex items-center justify-between gap-1 bg-theme-panel border border-theme-border rounded-xl text-theme-text focus-within:border-theme-accent transition-colors select-none ${
                compact ? 'p-0.5 min-h-[34px]' : 'p-1 min-h-[40px]'
            } ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}
        >
            <button
                type="button"
                tabIndex={-1}
                disabled={minDisabled}
                data-testid="datum-minus-btn"
                aria-label={isMonth ? 'Prethodni mjesec' : 'Prethodni dan'}
                title={isMonth ? 'Prethodni mjesec (-1)' : 'Prethodni dan (-1)'}
                onClick={(e) => {
                    e.stopPropagation();
                    handleStep(-1);
                }}
                className={`${compact ? 'w-6 h-6' : 'w-7 h-7 sm:w-8 sm:h-8'} rounded-lg bg-theme-card/90 hover:bg-theme-accent hover:text-white border border-theme-border/80 text-theme-text font-black flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:opacity-30 cursor-pointer`}
            >
                <Minus size={compact ? 11 : 13} strokeWidth={3} />
            </button>

            <div
                onClick={openPicker}
                className="relative flex-1 min-w-[92px] flex items-center justify-center gap-1.5 px-1.5 py-1 cursor-pointer group"
            >
                <Calendar size={compact ? 11 : 13} className="text-theme-accent shrink-0 opacity-80 group-hover:opacity-100" />
                <span
                    data-testid="datum-display-bhs"
                    className={`${compact ? 'text-[11px]' : 'text-xs'} font-black tracking-wide whitespace-nowrap ${
                        value ? 'text-theme-text' : 'text-theme-muted font-bold'
                    }`}
                >
                    {displayText}
                </span>

                {/* Nativni date/month picker potpuno prekriven preko srednjeg dijela za 100% kompatibilnost na svim browserima/mobitelima */}
                <input
                    ref={setRefs}
                    type={isMonth ? 'month' : 'date'}
                    value={value || ''}
                    min={min}
                    max={max}
                    disabled={disabled}
                    onChange={(e) => onChange?.(e)}
                    onKeyDown={handleKey}
                    aria-label={title || (isMonth ? 'Odaberi mjesec' : 'Odaberi datum')}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    {...rest}
                />
            </div>

            <button
                type="button"
                tabIndex={-1}
                disabled={maxDisabled}
                data-testid="datum-plus-btn"
                aria-label={isMonth ? 'Sljedeći mjesec' : 'Sljedeći dan'}
                title={isMonth ? 'Sljedeći mjesec (+1)' : 'Sljedeći dan (+1)'}
                onClick={(e) => {
                    e.stopPropagation();
                    handleStep(1);
                }}
                className={`${compact ? 'w-6 h-6' : 'w-7 h-7 sm:w-8 sm:h-8'} rounded-lg bg-theme-card/90 hover:bg-theme-accent hover:text-white border border-theme-border/80 text-theme-text font-black flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:opacity-30 cursor-pointer`}
            >
                <Plus size={compact ? 11 : 13} strokeWidth={3} />
            </button>
        </div>
    );
});

export default DatumInput;
