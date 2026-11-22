// Centralizovani pomoćnici za lokalne datume (bez UTC pomaka u 3. smjeni),
// sigurno HTML escape-ovanje u štampi, efektivnu zapreminu trupca
// i jedinstveno BHS formatiranje datuma (DD.MM.YYYY.) i brojeva (1.234,56).

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
    if (isoStr instanceof Date) {
        if (isNaN(isoStr.getTime())) return '-';
        const d = String(isoStr.getDate()).padStart(2, '0');
        const m = String(isoStr.getMonth() + 1).padStart(2, '0');
        const y = isoStr.getFullYear();
        return `${d}.${m}.${y}.`;
    }
    const raw = String(isoStr).trim();
    if (!raw) return '-';
    // Već DD.MM.YYYY ili D. M. YYYY.
    const dotMatch = raw.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?$/);
    if (dotMatch) {
        return `${dotMatch[1].padStart(2, '0')}.${dotMatch[2].padStart(2, '0')}.${dotMatch[3]}.`;
    }
    const clean = raw.split('T')[0].split(' ')[0];
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2].padStart(2, '0')}.${parts[1].padStart(2, '0')}.${parts[0]}.`;
    }
    if (parts.length === 2 && parts[0].length === 4) {
        return `${parts[1].padStart(2, '0')}.${parts[0]}.`;
    }
    return raw;
};

export const prikazDatumaVremenaBHS = (isoStr) => {
    if (!isoStr) return '-';
    const d = isoStr instanceof Date ? isoStr : new Date(isoStr);
    if (isNaN(d.getTime())) return prikazDatumaBHS(isoStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}.${mm}.${yyyy}. ${hh}:${mi}`;
};

export const prikazMjesecaBHS = (ymStr) => {
    if (!ymStr) return '-';
    const clean = String(ymStr).trim();
    const m = clean.match(/^(\d{4})-(\d{2})$/);
    if (m) return `${m[2]}.${m[1]}.`;
    return clean;
};

export const pomjeriDatumDana = (isoStr, deltaDana = 0) => {
    const base = isoStr && /^\d{4}-\d{2}-\d{2}/.test(String(isoStr).trim())
        ? parseISODateLocal(isoStr)
        : new Date();
    const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + Number(deltaDana || 0));
    return toLocalIso(next);
};

export const pomjeriMjesec = (ymStr, deltaMjeseci = 0) => {
    let y;
    let m;
    const match = String(ymStr || '').trim().match(/^(\d{4})-(\d{2})$/);
    if (match) {
        y = parseInt(match[1], 10);
        m = parseInt(match[2], 10) - 1;
    } else {
        const now = new Date();
        y = now.getFullYear();
        m = now.getMonth();
    }
    const next = new Date(y, m + Number(deltaMjeseci || 0), 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Determinističko formatiranje brojeva po BHS/evropskom standardu:
 * tačka (.) za hiljade, zarez (,) za decimale. (npr. 12345.67 -> "12.345,67")
 */
export const formatBrojBHS = (val, decimale = 2, { minDecimale = null } = {}) => {
    const n = typeof val === 'number' ? val : parseFloat(String(val ?? '').replace(',', '.'));
    if (!Number.isFinite(n)) {
        return decimale > 0 ? `0,${'0'.repeat(decimale)}` : '0';
    }
    const neg = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    const fixed = abs.toFixed(Math.max(0, decimale));
    const [intPart, decPart] = fixed.split('.');
    const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (decimale <= 0 || !decPart) return `${neg}${intFormatted}`;
    if (minDecimale !== null && minDecimale < decimale) {
        let trimmed = decPart.replace(/0+$/, '');
        while (trimmed.length < minDecimale) trimmed += '0';
        return trimmed ? `${neg}${intFormatted},${trimmed}` : `${neg}${intFormatted}`;
    }
    return `${neg}${intFormatted},${decPart}`;
};

const INTEGER_ONLY_UNITS_RE = /^\s*(kg|kom|komada|min|minuta|kWh|pcs|paketa|pak\.|trupaca|dana|dan)\b/i;
const UNIT_THOUSANDS_RE = /(?<![A-Za-z0-9.,/:_-])([+-]?\d{4,})(?=\s*(?:KM|BAM|EUR|€|RSD|m³|m3|m²|m2|m1|kg|kWh|min|kom|pcs|L|t|%)(?![A-Za-z0-9]))/g;

/**
 * Sigurno formatira tekstualne sadržaje u BHS standard:
 * - ISO datume (2026-11-22 -> 22.11.2026., 2026-11-22T14:30 -> 22.11.2026. 14:30, 2026-11 -> 11.2026.)
 * - Razmaknute/nepopunjene datume (5. 3. 2026. -> 05.03.2026.)
 * - Decimalne brojeve (12345.67 -> 12.345,67) i hiljade uz jedinice (12500 KM -> 12.500 KM)
 * Ne dira dokument ID-jeve (RN-2026-01), URL-ove, godine (2026), telefone ni JIB/PDV brojeve.
 */
export const formatirajTekstBHS = (text) => {
    if (typeof text !== 'string' || text.length === 0) return text;
    // Brzi izlaz ako nema nijedne cifre
    if (!/\d/.test(text)) return text;

    let out = text;

    // 1. ISO datetime: 2026-11-22T14:35(:00...)
    out = out.replace(
        /(?<![A-Za-z0-9_-])(19\d{2}|20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?/g,
        '$3.$2.$1. $4:$5'
    );

    // 2. Standalone ISO date: 2026-11-22 -> 22.11.2026.
    out = out.replace(
        /(?<![A-Za-z0-9_-])(19\d{2}|20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])(?![A-Za-z0-9_-])/g,
        '$3.$2.$1.'
    );

    // 3. Standalone ISO month: 2026-11 -> 11.2026.
    out = out.replace(
        /(?<![A-Za-z0-9_-])(19\d{2}|20\d{2})-(0[1-9]|1[0-2])(?![A-Za-z0-9_-])/g,
        '$2.$1.'
    );

    // 4. Razmaknuti ili nepopunjeni datumi iz toLocaleDateString: "5. 3. 2026." -> "05.03.2026."
    out = out.replace(
        /(?<![A-Za-z0-9.])(\d{1,2})\.\s*(\d{1,2})\.\s*(19\d{2}|20\d{2})\.?(?!\d)/g,
        (_, d, m, y) => `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}.`
    );

    // 5. Decimalni brojevi sa tačkom: 12345.67 -> 12.345,67
    out = out.replace(
        /(?<![A-Za-z0-9.,/:_-])([+-]?\d+)\.(\d+)(?![A-Za-z0-9.,/:_-])/g,
        (match, intPart, decPart, offset, fullStr) => {
            // Ako je npr. "12.500 kg" (već formatiran cijeli broj sa tačkom za hiljade)
            const absInt = intPart.replace(/^[+-]/, '');
            const after = fullStr.slice(offset + match.length);
            if (absInt.length >= 1 && absInt.length <= 3 && decPart.length === 3 && INTEGER_ONLY_UNITS_RE.test(after)) {
                return match;
            }
            const sign = intPart.startsWith('-') ? '-' : (intPart.startsWith('+') ? '+' : '');
            const intFmt = absInt.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            return `${sign}${intFmt},${decPart}`;
        }
    );

    // 6. Cijeli brojevi >= 1000 praćeni eksplicitnom mjernom jedinicom (12500 KM -> 12.500 KM)
    out = out.replace(UNIT_THOUSANDS_RE, (match, numStr) => {
        const sign = numStr.startsWith('-') ? '-' : (numStr.startsWith('+') ? '+' : '');
        const digits = numStr.replace(/^[+-]/, '');
        return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
    });

    return out;
};

/**
 * Formatira samo vidljivi tekst unutar HTML stringa (za PDF print),
 * ne dirajući HTML tagove, atribute, <style> ni <script> blokove.
 */
export const formatirajHtmlBHS = (html) => {
    if (typeof html !== 'string' || !html) return html;
    const parts = html.split(/(<[^>]+>)/g);
    let skipDepth = 0;
    return parts
        .map((part) => {
            if (part.startsWith('<')) {
                const lower = part.toLowerCase();
                if (/^<(script|style|code|pre)\b/.test(lower) && !lower.endsWith('/>')) {
                    skipDepth++;
                } else if (/^<\/(script|style|code|pre)\b/.test(lower)) {
                    skipDepth = Math.max(0, skipDepth - 1);
                }
                return part;
            }
            if (skipDepth > 0) return part;
            return formatirajTekstBHS(part);
        })
        .join('');
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
