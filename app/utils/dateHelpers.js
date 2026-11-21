// Centralizovani pomoćnici za lokalne datume (bez UTC pomaka u 3. smjeni),
// sigurno HTML escape-ovanje u štampi i efektivnu zapreminu trupca.

export const toLocalIso = (dateObj = new Date()) => {
    const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

export const parseISODateLocal = (isoStr) => {
    if (!isoStr) return new Date();
    if (isoStr instanceof Date) return new Date(isoStr.getFullYear(), isoStr.getMonth(), isoStr.getDate());
    const clean = String(isoStr).split('T')[0];
    const parts = clean.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return new Date();
    return new Date(parts[0], parts[1] - 1, parts[2]);
};

export const prikazDatumaBHS = (isoStr) => {
    if (!isoStr) return '-';
    const clean = String(isoStr).split('T')[0];
    const parts = clean.split('-');
    if (parts.length !== 3) return String(isoStr);
    return `${parts[2]}.${parts[1]}.${parts[0]}.`;
};

export const escapeHtml = (val) => {
    if (val === null || val === undefined) return '';
    return String(val)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

export const getEfektivnaZapreminaTrupca = (t) => {
    if (!t) return 0;
    const kz = parseFloat(t.kontrolna_zapremina);
    if (!isNaN(kz) && kz > 0) return kz;
    return parseFloat(t.zapremina) || 0;
};
