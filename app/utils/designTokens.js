"use client";
import { supabase } from './supabaseClient';

export const GLOBAL_DESIGN_KEY = 'global_design_tokens';

export const DEFAULT_DESIGN_TOKENS = {
    // 1. Kartice, Paneli & Osnova
    pageBg: '',
    cardBg: '',
    cardBorder: '',
    panelBg: '',
    panelBorder: '',
    borderRadius: '',

    // 2. Slova & Naslovi
    accentColor: '',
    textColor: '',
    mutedColor: '',
    headingSize: '',
    bodySize: '',
    labelSize: '',

    // 3. Opći Dropdowni & Polja za unos
    inputBg: '',
    inputBorder: '',
    inputFocusBorder: '',
    inputText: '',
    inputFontSize: '',
    dropdownMenuBg: '',
    dropdownMenuBorder: '',
    dropdownItemText: '',
    dropdownItemSize: '',
    dropdownActiveBg: '',
    dropdownActiveText: '',

    // 4. Ekipa na mašini & Proizvod (opcionalni override iznad općih dropdowna)
    teamBg: '',
    teamBorder: '',
    teamText: '',
    teamFontSize: '',
    teamMenuBg: '',
    productBg: '',
    productBorder: '',
    productText: '',
    productFontSize: '',
    productMenuBg: '',

    // 5. Dimenzije, Započeti paketi & Dugmad
    dimBg: '',
    dimBorder: '',
    dimText: '',
    dimFontSize: '',
    dimLabelColor: '',
    pkgBg: '',
    pkgBorder: '',
    pkgText: '',
    pkgSubText: '',
    pkgSelectedBg: '',
    pkgSelectedBorder: '',
    pkgSelectedText: '',
    pkgSelectedGlow: '',
    btnPrimaryBg: '',
    btnPrimaryText: '',
};

export const DESIGN_PRESETS = [
    {
        id: 'theme_default',
        naziv: 'Prati Aktivnu Temu',
        opis: 'Bez nadjačavanja — koristi čistu aktivnu temu',
        preview: ['#0f172a', '#1e293b', '#3b82f6'],
        tokens: {},
    },
    {
        id: 'industrial_pro',
        naziv: 'Industrijski Plavi Pro',
        opis: 'Jasni plavi okviri, tamni dropdowni, izrazit aktivni paket',
        preview: ['#0f172a', '#1e293b', '#38bdf8'],
        tokens: {
            cardBg: '#162033',
            cardBorder: '#2a3f5f',
            panelBg: '#0c1424',
            panelBorder: '#1f3352',
            accentColor: '#38bdf8',
            textColor: '#f8fafc',
            mutedColor: '#94a3b8',
            inputBg: '#0b1322',
            inputBorder: '#38bdf8',
            inputFocusBorder: '#7dd3fc',
            inputText: '#f8fafc',
            dropdownMenuBg: '#0f1c33',
            dropdownMenuBorder: '#38bdf8',
            dropdownItemText: '#e2e8f0',
            dropdownActiveBg: '#0284c7',
            dropdownActiveText: '#ffffff',
            dimBg: '#0b1526',
            dimBorder: '#38bdf8',
            dimText: '#ffffff',
            dimLabelColor: '#7dd3fc',
            pkgBg: '#132038',
            pkgBorder: '#2c466e',
            pkgText: '#f8fafc',
            pkgSubText: '#7dd3fc',
            pkgSelectedBg: '#0284c7',
            pkgSelectedBorder: '#7dd3fc',
            pkgSelectedText: '#ffffff',
            pkgSelectedGlow: '#38bdf8',
            btnPrimaryBg: '#0284c7',
            btnPrimaryText: '#ffffff',
        },
    },
    {
        id: 'emerald_sawmill',
        naziv: 'Smaragdna Pilana',
        opis: 'Kontrastni zeleni akcenti i jasna polja za proizvodnju',
        preview: ['#091512', '#112621', '#10b981'],
        tokens: {
            cardBg: '#11221e',
            cardBorder: '#1f493e',
            panelBg: '#0a1714',
            panelBorder: '#1b3d34',
            accentColor: '#10b981',
            textColor: '#ecfdf5',
            mutedColor: '#94b8ad',
            inputBg: '#091512',
            inputBorder: '#10b981',
            inputFocusBorder: '#34d399',
            inputText: '#ecfdf5',
            dropdownMenuBg: '#0d201b',
            dropdownMenuBorder: '#10b981',
            dropdownItemText: '#d1fae5',
            dropdownActiveBg: '#059669',
            dropdownActiveText: '#ffffff',
            dimBg: '#091915',
            dimBorder: '#34d399',
            dimText: '#ffffff',
            dimLabelColor: '#6ee7b7',
            pkgBg: '#0e221d',
            pkgBorder: '#235347',
            pkgText: '#ecfdf5',
            pkgSubText: '#6ee7b7',
            pkgSelectedBg: '#059669',
            pkgSelectedBorder: '#6ee7b7',
            pkgSelectedText: '#ffffff',
            pkgSelectedGlow: '#10b981',
            btnPrimaryBg: '#059669',
            btnPrimaryText: '#ffffff',
        },
    },
    {
        id: 'executive_gold',
        naziv: 'Zlatni Executive',
        opis: 'Tamni luksuzni tonovi sa zlatnim okvirima i selekcijom',
        preview: ['#14111b', '#221d2d', '#d4af37'],
        tokens: {
            cardBg: '#1e1a28',
            cardBorder: '#574727',
            panelBg: '#13101a',
            panelBorder: '#3d3320',
            accentColor: '#e5be4f',
            textColor: '#f6efe4',
            mutedColor: '#b5a68e',
            inputBg: '#120f19',
            inputBorder: '#b89437',
            inputFocusBorder: '#f3d26b',
            inputText: '#f6efe4',
            dropdownMenuBg: '#1b1726',
            dropdownMenuBorder: '#d4af37',
            dropdownItemText: '#f6efe4',
            dropdownActiveBg: '#b88e22',
            dropdownActiveText: '#110e17',
            dimBg: '#15111e',
            dimBorder: '#d4af37',
            dimText: '#fef3c7',
            dimLabelColor: '#e5be4f',
            pkgBg: '#1c1826',
            pkgBorder: '#54462a',
            pkgText: '#f6efe4',
            pkgSubText: '#e5be4f',
            pkgSelectedBg: '#c59b27',
            pkgSelectedBorder: '#fde68a',
            pkgSelectedText: '#110e17',
            pkgSelectedGlow: '#d4af37',
            btnPrimaryBg: '#c59b27',
            btnPrimaryText: '#110e17',
        },
    },
    {
        id: 'high_contrast_hall',
        naziv: 'Hala Visoki Kontrast',
        opis: 'Velika čitljiva slova i jaki okviri za rad na ekranima u hali',
        preview: ['#05080f', '#111827', '#f59e0b'],
        tokens: {
            cardBg: '#111827',
            cardBorder: '#475569',
            panelBg: '#030712',
            panelBorder: '#334155',
            accentColor: '#f59e0b',
            textColor: '#ffffff',
            mutedColor: '#cbd5e1',
            headingSize: '20',
            bodySize: '14',
            labelSize: '11',
            inputBg: '#030712',
            inputBorder: '#f59e0b',
            inputFocusBorder: '#fde047',
            inputText: '#ffffff',
            inputFontSize: '16',
            dropdownMenuBg: '#0f172a',
            dropdownMenuBorder: '#f59e0b',
            dropdownItemText: '#ffffff',
            dropdownItemSize: '14',
            dropdownActiveBg: '#d97706',
            dropdownActiveText: '#ffffff',
            dimBg: '#030712',
            dimBorder: '#f59e0b',
            dimText: '#fde047',
            dimFontSize: '24',
            dimLabelColor: '#fbbf24',
            pkgBg: '#0f172a',
            pkgBorder: '#64748b',
            pkgText: '#ffffff',
            pkgSubText: '#fbbf24',
            pkgSelectedBg: '#d97706',
            pkgSelectedBorder: '#fde047',
            pkgSelectedText: '#ffffff',
            pkgSelectedGlow: '#f59e0b',
            btnPrimaryBg: '#d97706',
            btnPrimaryText: '#ffffff',
        },
    },
];

export function isUserDesignAdmin(userObj = null) {
    let u = userObj;
    if (!u && typeof window !== 'undefined') {
        try {
            u = JSON.parse(localStorage.getItem('smart_timber_user') || '{}');
        } catch (e) {
            u = {};
        }
    }
    const uloga = String(u?.uloga || '').toLowerCase().trim();
    return uloga === 'superadmin' || uloga === 'admin';
}

export function sanitizeHexColor(val) {
    if (!val || typeof val !== 'string') return '';
    const trimmed = val.trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
    if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)$/.test(trimmed)) return trimmed;
    return '';
}

export function sanitizePx(val, min = 6, max = 64) {
    if (val === '' || val === null || val === undefined) return '';
    const n = parseFloat(val);
    if (isNaN(n) || !isFinite(n)) return '';
    return `${Math.min(max, Math.max(min, Math.round(n)))}px`;
}

export function hexToRgbString(hex) {
    const clean = sanitizeHexColor(hex);
    if (!clean.startsWith('#')) return null;
    let h = clean.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (h.length < 6) return null;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if ([r, g, b].some((v) => isNaN(v))) return null;
    return `${r}, ${g}, ${b}`;
}

export function cleanDesignTokens(raw = {}) {
    if (!raw || typeof raw !== 'object') return {};
    const out = {};
    Object.keys(DEFAULT_DESIGN_TOKENS).forEach((k) => {
        const v = raw[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') {
            out[k] = String(v).trim();
        }
    });
    return out;
}

/**
 * Generiše deterministički, čisti CSS isključivo za tokene koje je Admin eksplicitno postavio.
 * Skopiran je strogo na `html[data-theme] main` (sadržaj modula), tako da:
 * - NIKAD ne kvari sam Design Studio (koji je u Portalu na document.body)
 * - NIKAD ne kvari Sonner toastove ni sidebar
 * - Pouzdano nadjačava globalne `!important` stilove i u tamnim i u Light temama!
 */
export function generateDesignCss(tokens = {}) {
    const t = cleanDesignTokens(tokens);
    if (Object.keys(t).length === 0) return '';

    const M = 'html[data-theme] main';
    const rules = [];

    // 1. OSNOVA, KARTICE I PANELI
    const pageBg = sanitizeHexColor(t.pageBg);
    if (pageBg) {
        rules.push(`${M} { background-color: ${pageBg} !important; }`);
    }

    const cardBg = sanitizeHexColor(t.cardBg);
    const cardBorder = sanitizeHexColor(t.cardBorder);
    const radius = sanitizePx(t.borderRadius, 4, 36);
    if (cardBg || cardBorder || radius) {
        const decls = [];
        if (cardBg) decls.push(`background-color: ${cardBg} !important;`);
        if (cardBorder) decls.push(`border-color: ${cardBorder} !important;`);
        if (radius) decls.push(`border-radius: ${radius} !important;`);
        rules.push(
            `${M} .bg-theme-card, ${M} [class*="bg-theme-card"], ${M} [data-ds="card"] { ${decls.join(' ')} }`
        );
    }

    const panelBg = sanitizeHexColor(t.panelBg);
    const panelBorder = sanitizeHexColor(t.panelBorder);
    if (panelBg || panelBorder) {
        const decls = [];
        if (panelBg) decls.push(`background-color: ${panelBg} !important;`);
        if (panelBorder) decls.push(`border-color: ${panelBorder} !important;`);
        rules.push(
            `${M} .bg-theme-panel:not([data-ds="pkg-card"]):not([data-ds="dim-box"]):not([data-ds="dropdown-field"]):not([data-ds="dropdown-menu"]), ` +
            `${M} [class*="bg-theme-panel"]:not([data-ds="pkg-card"]):not([data-ds="dim-box"]):not([data-ds="dropdown-field"]):not([data-ds="dropdown-menu"]) { ${decls.join(' ')} }`
        );
    }

    if (cardBorder) {
        rules.push(`${M} .border-theme-border:not([data-ds="pkg-card"]):not([data-ds="dim-box"]):not([data-ds="dropdown-field"]):not([data-ds="dropdown-menu"]) { border-color: ${cardBorder} !important; }`);
    }

    // 2. SLOVA, AKCENT I NASLOVI
    const accentColor = sanitizeHexColor(t.accentColor);
    if (accentColor) {
        const rgb = hexToRgbString(accentColor);
        rules.push(`${M} { --theme-accent: ${accentColor}; ${rgb ? `--theme-accent-rgb: ${rgb};` : ''} }`);
        rules.push(`${M} .text-theme-accent { color: ${accentColor} !important; }`);
        rules.push(`${M} .border-theme-accent { border-color: ${accentColor} !important; }`);
        rules.push(`${M} .bg-theme-accent:not([data-ds="pkg-card"]):not([data-ds="primary-btn"]) { background-color: ${accentColor} !important; }`);
    }

    const textColor = sanitizeHexColor(t.textColor);
    if (textColor) {
        rules.push(`${M} { --text-primary: ${textColor}; color: ${textColor} !important; }`);
        rules.push(`${M} .text-theme-text:not([data-ds="pkg-card"] *):not([data-ds="dropdown-menu"] *):not([data-ds="dim-input"]) { color: ${textColor} !important; }`);
    }

    const mutedColor = sanitizeHexColor(t.mutedColor);
    if (mutedColor) {
        rules.push(`${M} { --text-muted: ${mutedColor}; }`);
        rules.push(`${M} .text-theme-muted:not([data-ds="pkg-card"] *):not([data-ds="dim-label"]) { color: ${mutedColor} !important; }`);
    }

    const headingSize = sanitizePx(t.headingSize, 12, 42);
    if (headingSize) {
        rules.push(`${M} h1, ${M} h2 { font-size: ${headingSize} !important; }`);
    }

    const bodySize = sanitizePx(t.bodySize, 10, 22);
    if (bodySize) {
        rules.push(`${M} { font-size: ${bodySize}; }`);
    }

    const labelSize = sanitizePx(t.labelSize, 8, 18);
    if (labelSize) {
        rules.push(`${M} label:not([data-ds="dim-label"]) { font-size: ${labelSize} !important; }`);
    }

    // 3. OPĆI DROPDOWNI I POLJA ZA UNOS
    const inputBg = sanitizeHexColor(t.inputBg);
    const inputBorder = sanitizeHexColor(t.inputBorder);
    const inputFocusBorder = sanitizeHexColor(t.inputFocusBorder);
    const inputText = sanitizeHexColor(t.inputText);
    const inputFontSize = sanitizePx(t.inputFontSize, 10, 28);

    const fieldDecls = [];
    if (inputBg) fieldDecls.push(`background-color: ${inputBg} !important;`);
    if (inputBorder) fieldDecls.push(`border-color: ${inputBorder} !important;`);
    if (inputText) fieldDecls.push(`color: ${inputText} !important;`);
    if (inputFontSize) fieldDecls.push(`font-size: ${inputFontSize} !important;`);

    if (fieldDecls.length > 0) {
        rules.push(
            `${M} input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([data-ds="dim-input"]):not([data-ds="dropdown-input"]), ` +
            `${M} select, ${M} textarea, ${M} [data-ds="dropdown-field"] { ${fieldDecls.join(' ')} }`
        );
        // Unutar MasterSearch / SearchableInput input je providan da prikaže pozadinu wrappera, ali prima boju i veličinu slova!
        const innerInputDecls = ['background-color: transparent !important;', 'border: none !important;', 'box-shadow: none !important;'];
        if (inputText) innerInputDecls.push(`color: ${inputText} !important;`);
        if (inputFontSize) innerInputDecls.push(`font-size: ${inputFontSize} !important;`);
        rules.push(`${M} [data-ds="dropdown-input"] { ${innerInputDecls.join(' ')} }`);
    }

    if (inputFocusBorder) {
        rules.push(
            `${M} input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([data-ds="dropdown-input"]):focus, ` +
            `${M} select:focus, ${M} textarea:focus, ${M} [data-ds="dropdown-field"]:focus-within { border-color: ${inputFocusBorder} !important; }`
        );
    }

    // Padaći meni (Dropdown lista)
    const menuBg = sanitizeHexColor(t.dropdownMenuBg);
    const menuBorder = sanitizeHexColor(t.dropdownMenuBorder);
    const itemText = sanitizeHexColor(t.dropdownItemText);
    const itemSize = sanitizePx(t.dropdownItemSize, 9, 22);
    const activeBg = sanitizeHexColor(t.dropdownActiveBg);
    const activeText = sanitizeHexColor(t.dropdownActiveText);

    if (menuBg || menuBorder) {
        const d = [];
        if (menuBg) d.push(`background-color: ${menuBg} !important;`);
        if (menuBorder) d.push(`border-color: ${menuBorder} !important;`);
        rules.push(`${M} [data-ds="dropdown-menu"], ${M} .custom-dropdown-menu { ${d.join(' ')} }`);
        if (menuBg) {
            rules.push(`${M} select option { background-color: ${menuBg} !important; ${itemText ? `color: ${itemText} !important;` : ''} }`);
        }
    }

    if (itemText || itemSize) {
        const d = [];
        if (itemText) d.push(`color: ${itemText} !important;`);
        if (itemSize) d.push(`font-size: ${itemSize} !important;`);
        rules.push(`${M} [data-ds="dropdown-item"]:not([data-ds-selected="true"]) { ${d.join(' ')} }`);
        if (itemText) {
            rules.push(`${M} [data-ds="dropdown-item"]:not([data-ds-selected="true"]) .text-theme-text { color: ${itemText} !important; }`);
        }
        if (itemSize) {
            rules.push(`${M} [data-ds="dropdown-item"] > span, ${M} [data-ds="dropdown-item"] > div > div:first-child { font-size: ${itemSize} !important; }`);
        }
    }

    if (activeBg || activeText) {
        const d = [];
        if (activeBg) d.push(`background-color: ${activeBg} !important;`);
        if (activeText) d.push(`color: ${activeText} !important;`);
        rules.push(`${M} [data-ds="dropdown-item"][data-ds-selected="true"], ${M} [data-ds="dropdown-item"]:hover { ${d.join(' ')} }`);
        if (activeText) {
            rules.push(`${M} [data-ds="dropdown-item"][data-ds-selected="true"] *, ${M} [data-ds="dropdown-item"]:hover * { color: ${activeText} !important; }`);
        }
    }

    // 4. EKIPA NA MAŠINI & ODABIR PROIZVODA (SPECIJALNI OVERRIDE)
    const teamBg = sanitizeHexColor(t.teamBg);
    const teamBorder = sanitizeHexColor(t.teamBorder);
    const teamText = sanitizeHexColor(t.teamText);
    const teamFontSize = sanitizePx(t.teamFontSize, 10, 26);
    const teamMenuBg = sanitizeHexColor(t.teamMenuBg);

    if (teamBg || teamBorder) {
        const d = [];
        if (teamBg) d.push(`background-color: ${teamBg} !important;`);
        if (teamBorder) d.push(`border-color: ${teamBorder} !important;`);
        rules.push(`${M} [data-ds="team-section"] [data-ds="dropdown-field"], ${M} [data-ds="team-section"] select { ${d.join(' ')} }`);
    }
    if (teamText || teamFontSize) {
        const d = [];
        if (teamText) d.push(`color: ${teamText} !important;`);
        if (teamFontSize) d.push(`font-size: ${teamFontSize} !important;`);
        rules.push(`${M} [data-ds="team-section"] [data-ds="dropdown-input"], ${M} [data-ds="team-section"] select { ${d.join(' ')} }`);
    }
    if (teamMenuBg) {
        rules.push(`${M} [data-ds="team-section"] [data-ds="dropdown-menu"] { background-color: ${teamMenuBg} !important; }`);
    }

    const prodBg = sanitizeHexColor(t.productBg);
    const prodBorder = sanitizeHexColor(t.productBorder);
    const prodText = sanitizeHexColor(t.productText);
    const prodFontSize = sanitizePx(t.productFontSize, 10, 26);
    const prodMenuBg = sanitizeHexColor(t.productMenuBg);

    if (prodBg || prodBorder) {
        const d = [];
        if (prodBg) d.push(`background-color: ${prodBg} !important;`);
        if (prodBorder) d.push(`border-color: ${prodBorder} !important;`);
        rules.push(`${M} [data-ds="product-section"] [data-ds="dropdown-field"] { ${d.join(' ')} }`);
    }
    if (prodText || prodFontSize) {
        const d = [];
        if (prodText) d.push(`color: ${prodText} !important;`);
        if (prodFontSize) d.push(`font-size: ${prodFontSize} !important;`);
        rules.push(`${M} [data-ds="product-section"] [data-ds="dropdown-input"] { ${d.join(' ')} }`);
    }
    if (prodMenuBg) {
        rules.push(`${M} [data-ds="product-section"] [data-ds="dropdown-menu"] { background-color: ${prodMenuBg} !important; }`);
    }

    // 5. DIMENZIJE (DEB / ŠIR / DUŽ)
    const dimBg = sanitizeHexColor(t.dimBg);
    const dimBorder = sanitizeHexColor(t.dimBorder);
    const dimText = sanitizeHexColor(t.dimText);
    const dimFontSize = sanitizePx(t.dimFontSize, 12, 38);
    const dimLabelColor = sanitizeHexColor(t.dimLabelColor);

    if (dimBg || dimBorder) {
        const d = [];
        if (dimBg) d.push(`background-color: ${dimBg} !important;`);
        if (dimBorder) d.push(`border-color: ${dimBorder} !important;`);
        rules.push(`${M} [data-ds="dim-box"] { ${d.join(' ')} }`);
    }
    if (dimText || dimFontSize) {
        const d = ['background-color: transparent !important;', 'border: none !important;', 'box-shadow: none !important;'];
        if (dimText) d.push(`color: ${dimText} !important;`);
        if (dimFontSize) d.push(`font-size: ${dimFontSize} !important;`);
        rules.push(`${M} [data-ds="dim-input"] { ${d.join(' ')} }`);
    }
    if (dimLabelColor) {
        rules.push(`${M} [data-ds="dim-label"] { color: ${dimLabelColor} !important; }`);
    }

    // 6. ZAPOČETI PAKETI (NESELEKTOVANI vs SELEKTOVANI)
    const pkgBg = sanitizeHexColor(t.pkgBg);
    const pkgBorder = sanitizeHexColor(t.pkgBorder);
    const pkgText = sanitizeHexColor(t.pkgText);
    const pkgSubText = sanitizeHexColor(t.pkgSubText);

    if (pkgBg || pkgBorder || pkgText) {
        const d = [];
        if (pkgBg) d.push(`background-color: ${pkgBg} !important;`);
        if (pkgBorder) d.push(`border-color: ${pkgBorder} !important;`);
        if (pkgText) d.push(`color: ${pkgText} !important;`);
        rules.push(`${M} [data-ds="pkg-card"][data-ds-selected="false"] { ${d.join(' ')} }`);
        if (pkgText) {
            rules.push(`${M} [data-ds="pkg-card"][data-ds-selected="false"] [data-ds="pkg-title"], ${M} [data-ds="pkg-card"][data-ds-selected="false"] [data-ds="pkg-total"] { color: ${pkgText} !important; }`);
        }
    }
    if (pkgSubText) {
        rules.push(`${M} [data-ds="pkg-card"][data-ds-selected="false"] [data-ds="pkg-sub"] { color: ${pkgSubText} !important; }`);
    }

    const pkgSelBg = sanitizeHexColor(t.pkgSelectedBg);
    const pkgSelBorder = sanitizeHexColor(t.pkgSelectedBorder);
    const pkgSelText = sanitizeHexColor(t.pkgSelectedText);
    const pkgSelGlow = sanitizeHexColor(t.pkgSelectedGlow);

    if (pkgSelBg || pkgSelBorder || pkgSelText || pkgSelGlow) {
        const d = [];
        if (pkgSelBg) d.push(`background-color: ${pkgSelBg} !important;`);
        if (pkgSelBorder) d.push(`border-color: ${pkgSelBorder} !important;`);
        if (pkgSelText) d.push(`color: ${pkgSelText} !important;`);
        if (pkgSelGlow) {
            const rgb = hexToRgbString(pkgSelGlow);
            d.push(`box-shadow: 0 0 20px ${rgb ? `rgba(${rgb}, 0.6)` : pkgSelGlow} !important;`);
        }
        rules.push(`${M} [data-ds="pkg-card"][data-ds-selected="true"] { ${d.join(' ')} }`);
        if (pkgSelText) {
            rules.push(`${M} [data-ds="pkg-card"][data-ds-selected="true"] * { color: ${pkgSelText} !important; }`);
        }
    }

    // 7. GLAVNA AKCIJSKA DUGMAD
    const btnBg = sanitizeHexColor(t.btnPrimaryBg);
    const btnText = sanitizeHexColor(t.btnPrimaryText);
    if (btnBg || btnText) {
        const d = [];
        if (btnBg) d.push(`background-color: ${btnBg} !important; border-color: ${btnBg} !important;`);
        if (btnText) d.push(`color: ${btnText} !important;`);
        rules.push(`${M} [data-ds="primary-btn"] { ${d.join(' ')} }`);
        if (btnText) {
            rules.push(`${M} [data-ds="primary-btn"] * { color: ${btnText} !important; }`);
        }
    }

    return rules.join('\n');
}

/**
 * Sigurno injektira ili uklanja <style data-erp-design="..."> u <head>.
 * Redoslijed: 'global' uvijek stoji PRIJE 'module', tako da modul-specifični stil
 * uvijek ima prednost nad globalnim, a oba nadjačavaju osnovnu temu samo tamo gdje je postavljeno!
 */
export function primijeniDesignCss(scope = 'module', tokens = {}) {
    if (typeof document === 'undefined') return;
    const selector = `style[data-erp-design="${scope}"]`;
    const css = generateDesignCss(tokens);
    let el = document.head.querySelector(selector);

    if (!css) {
        if (el) el.remove();
        return;
    }

    if (!el) {
        el = document.createElement('style');
        el.setAttribute('data-erp-design', scope);
        if (scope === 'global') {
            const modStyle = document.head.querySelector('style[data-erp-design="module"]');
            if (modStyle) document.head.insertBefore(el, modStyle);
            else document.head.appendChild(el);
        } else {
            document.head.appendChild(el);
        }
    }

    if (el.textContent !== css) {
        el.textContent = css;
    }
}

let cachedGlobalTokens = null;

export async function ucitajGlobalniDizajn(force = false) {
    if (cachedGlobalTokens !== null && !force) {
        primijeniDesignCss('global', cachedGlobalTokens);
        return cachedGlobalTokens;
    }
    try {
        const { data } = await supabase
            .from('ui_postavke')
            .select('postavke_jsonb')
            .eq('modul_ime', GLOBAL_DESIGN_KEY)
            .maybeSingle();
        const tokens = cleanDesignTokens(data?.postavke_jsonb?.design_tokens || data?.postavke_jsonb || {});
        cachedGlobalTokens = tokens;
        primijeniDesignCss('global', tokens);
        return tokens;
    } catch (e) {
        console.error('Greška pri učitavanju globalnog dizajna:', e);
        return {};
    }
}

export async function spasiGlobalniDizajn(tokens, user = null) {
    if (!isUserDesignAdmin(user)) {
        return { error: { message: 'Samo Admin ili Superadmin može mijenjati globalni dizajn.' } };
    }
    const clean = cleanDesignTokens(tokens);
    const { error } = await supabase
        .from('ui_postavke')
        .upsert([{ modul_ime: GLOBAL_DESIGN_KEY, postavke_jsonb: { design_tokens: clean } }], { onConflict: 'modul_ime' });

    if (!error) {
        cachedGlobalTokens = clean;
        primijeniDesignCss('global', clean);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('global_design_updated', { detail: clean }));
        }
    }
    return { error, tokens: clean };
}
