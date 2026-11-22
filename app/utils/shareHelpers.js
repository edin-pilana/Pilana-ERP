"use client";
import { toast } from 'sonner';

const cleanPhone = (tel) => {
    const digits = String(tel || '').replace(/[^\d+]/g, '');
    if (!digits) return '';
    if (digits.startsWith('+')) return digits.slice(1);
    if (digits.startsWith('00')) return digits.slice(2);
    if (digits.startsWith('0')) return `387${digits.slice(1)}`;
    return digits;
};

export function generisiTekstDokumenta({ tip, broj, datum, kupac, stavke = [], ukupnoTekst = '', rok = '', napomena = '' }) {
    const redovi = (stavke || [])
        .slice(0, 12)
        .map((s, i) => {
            const kol = s.kolicina_obracun ?? s.kolicina_unos ?? s.kolicina ?? '';
            const jm = s.jm_obracun || s.jm_unos || s.jm || 'm³';
            return `${i + 1}. ${s.naziv || s.sifra || 'Artikal'} — ${kol} ${jm}`;
        })
        .join('\n');

    const viseStavki = (stavke || []).length > 12 ? `\n... i još ${stavke.length - 12} stavki` : '';

    return [
        `Poštovani ${kupac || ''},`,
        ``,
        `Šaljemo vam pregled dokumenta: *${tip} ${broj}*`,
        datum ? `Datum: ${datum}` : '',
        rok ? `Rok plaćanja: ${rok}` : '',
        ``,
        redovi ? `Stavke:\n${redovi}${viseStavki}` : '',
        ukupnoTekst ? `\nUkupno: *${ukupnoTekst}*` : '',
        napomena ? `Napomena: ${napomena}` : '',
        ``,
        `Srdačan pozdrav,`,
        `TTM d.o.o.`,
    ]
        .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
        .join('\n');
}

export function posaljiDokumentWhatsApp(podaci, telefon = '') {
    if (typeof window === 'undefined') return;
    const tekst = generisiTekstDokumenta(podaci);
    const broj = cleanPhone(telefon);
    const url = broj
        ? `https://wa.me/${broj}?text=${encodeURIComponent(tekst)}`
        : `https://wa.me/?text=${encodeURIComponent(tekst)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    toast.success('WhatsApp poruka je pripremljena!');
}

export function posaljiDokumentEmail(podaci, email = '') {
    if (typeof window === 'undefined') return;
    const subject = `${podaci.tip || 'Dokument'} ${podaci.broj || ''} — TTM d.o.o.`;
    const body = generisiTekstDokumenta(podaci).replace(/\*/g, '');
    const mailto = `mailto:${encodeURIComponent(email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    toast.success('Email nacrt je otvoren!');
}
