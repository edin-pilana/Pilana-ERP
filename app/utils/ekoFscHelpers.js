"use client";
import { supabase } from './supabaseClient';
import { toLocalIso } from './dateHelpers';

export const FSC_POSTAVKE_KEY = 'fsc_postavke';
export const BIOMASA_POSTAVKE_KEY = 'biomasa_postavke';
export const CBAM_ENERGENTI_KEY = 'cbam_energenti';

export const DEFAULT_FSC_POSTAVKE = {
    firmaFscCoc: '',
    firmaNaziv: 'TTM d.o.o.',
    defaultClaim: 'FSC Mix Credit',
    defaultConversionFactor: 0.62,
    kreditPocetniM3: 0,
    sumarijeMeta: {}, // { [nazivSumarije]: { fscStatus, certBroj, vaziDo, gpsLokacija, eudrOdjel, napomena } }
};

export const DEFAULT_BIOMASA_POSTAVKE = {
    koeficijenti: {
        piljevinaProc: 12,
        okorakProc: 18,
        koraProc: 8,
        cijenaUstedePoM3: 45, // KM uštede po m3 biomase ložene umjesto fosilnog goriva / peleta
    },
    utrosakLista: [],
};

export const DEFAULT_CBAM_ENERGENTI = {
    lista: [],
};

// Standardne gustoće drveta za proračun tonaže kamiona (kg/m3)
export const GUSTOCA_DRVETA_KG_M3 = {
    CETINARI: { label: 'Četinari (Smrča / Jela / Bor)', SIROVO: 750, PROSUSENO: 560, SUSENO: 470 },
    LISCARI: { label: 'Lišćari (Bukva / Hrast / Jasen)', SIROVO: 1050, PROSUSENO: 820, SUSENO: 720 },
    MJESOVITO: { label: 'Mješovita građa', SIROVO: 860, PROSUSENO: 660, SUSENO: 560 },
};

let fscCache = { data: null, loadedAt: 0 };

export async function ucitajFscPostavke(force = false) {
    if (!force && fscCache.data && Date.now() - fscCache.loadedAt < 60000) {
        return fscCache.data;
    }
    try {
        const { data } = await supabase
            .from('ui_postavke')
            .select('postavke_jsonb')
            .eq('modul_ime', FSC_POSTAVKE_KEY)
            .maybeSingle();
        const merged = {
            ...DEFAULT_FSC_POSTAVKE,
            ...(data?.postavke_jsonb || {}),
            sumarijeMeta: { ...(data?.postavke_jsonb?.sumarijeMeta || {}) },
        };
        fscCache = { data: merged, loadedAt: Date.now() };
        return merged;
    } catch (e) {
        return { ...DEFAULT_FSC_POSTAVKE };
    }
}

export async function spasiFscPostavke(postavke) {
    const clean = {
        ...DEFAULT_FSC_POSTAVKE,
        ...(postavke || {}),
        sumarijeMeta: { ...(postavke?.sumarijeMeta || {}) },
    };
    const { error } = await supabase
        .from('ui_postavke')
        .upsert([{ modul_ime: FSC_POSTAVKE_KEY, postavke_jsonb: clean }], { onConflict: 'modul_ime' });
    if (!error) fscCache = { data: clean, loadedAt: Date.now() };
    return { error, data: clean };
}

export async function ucitajBiomasaPostavke() {
    try {
        const { data } = await supabase
            .from('ui_postavke')
            .select('postavke_jsonb')
            .eq('modul_ime', BIOMASA_POSTAVKE_KEY)
            .maybeSingle();
        return {
            koeficijenti: { ...DEFAULT_BIOMASA_POSTAVKE.koeficijenti, ...(data?.postavke_jsonb?.koeficijenti || {}) },
            utrosakLista: Array.isArray(data?.postavke_jsonb?.utrosakLista) ? data.postavke_jsonb.utrosakLista : [],
        };
    } catch (e) {
        return { ...DEFAULT_BIOMASA_POSTAVKE };
    }
}

export async function spasiBiomasaPostavke(postavke) {
    const { error } = await supabase
        .from('ui_postavke')
        .upsert([{ modul_ime: BIOMASA_POSTAVKE_KEY, postavke_jsonb: postavke }], { onConflict: 'modul_ime' });
    return { error };
}

export async function ucitajCbamPostavke() {
    try {
        const { data } = await supabase
            .from('ui_postavke')
            .select('postavke_jsonb')
            .eq('modul_ime', CBAM_ENERGENTI_KEY)
            .maybeSingle();
        return {
            lista: Array.isArray(data?.postavke_jsonb?.lista) ? data.postavke_jsonb.lista : [],
        };
    } catch (e) {
        return { ...DEFAULT_CBAM_ENERGENTI };
    }
}

export async function spasiCbamPostavke(postavke) {
    const { error } = await supabase
        .from('ui_postavke')
        .upsert([{ modul_ime: CBAM_ENERGENTI_KEY, postavke_jsonb: postavke }], { onConflict: 'modul_ime' });
    return { error };
}

/**
 * Izračunava procijenjenu težinu tereta na kamionu (kg / t) za izvoz i Packing List.
 */
export function izracunajTezinuTereta(ukupnoM3, vrsta = 'CETINARI', vlaga = 'SIROVO', taraPakovanjaKg = 150) {
    const m3 = parseFloat(ukupnoM3 || 0) || 0;
    const tip = GUSTOCA_DRVETA_KG_M3[vrsta] || GUSTOCA_DRVETA_KG_M3.CETINARI;
    const gustoca = tip[vlaga] || tip.SIROVO;
    const netoKg = Math.round(m3 * gustoca);
    const brutoKg = m3 > 0 ? netoKg + Math.round(taraPakovanjaKg) : 0;
    const brutoTone = parseFloat((brutoKg / 1000).toFixed(2));
    return {
        gustoca,
        netoKg,
        brutoKg,
        brutoTone,
        pretovar: brutoTone > 24.0,
        blizuLimita: brutoTone > 21.5 && brutoTone <= 24.0,
    };
}

/**
 * Sljedivost paketa sa otpremnice -> trupci -> šumarije (FSC + EUDR GPS lokacije).
 */
export async function izracunajFscEudrZaOtpremnicu(stavke = []) {
    const fscPostavke = await ucitajFscPostavke();
    const paketIds = [...new Set(
        (stavke || [])
            .map((s) => {
                if (s?.paket_id) return String(s.paket_id).trim();
                const m = String(s?.naziv || '').match(/\[(?:Dio paketa|Paket):\s*([^\]]+)\]/i);
                return m?.[1]?.trim() || null;
            })
            .filter(Boolean)
    )];

    if (paketIds.length === 0) {
        return {
            fscCoc: fscPostavke.firmaFscCoc || '',
            claim: fscPostavke.firmaFscCoc ? fscPostavke.defaultClaim : '',
            sumarije: [],
            eudrLokacije: [],
            imaMijesanje: false,
            paketCount: 0,
        };
    }

    const { data: paketiRows } = await supabase
        .from('paketi')
        .select('paket_id, ulaz_trupci_ids, ulaz_paketi_ids')
        .in('paket_id', paketIds);

    const trupciIds = new Set();
    const ulazniPaketiIds = new Set();
    (paketiRows || []).forEach((p) => {
        if (Array.isArray(p.ulaz_trupci_ids)) p.ulaz_trupci_ids.forEach((id) => trupciIds.add(id));
        if (Array.isArray(p.ulaz_paketi_ids)) p.ulaz_paketi_ids.forEach((id) => ulazniPaketiIds.add(id));
    });

    // Ako je paket iz Dorade, povuci trupce iz njegovih ulaznih paketa (2-stepena sljedivost!)
    if (ulazniPaketiIds.size > 0) {
        const { data: ulazRows } = await supabase
            .from('paketi')
            .select('ulaz_trupci_ids')
            .in('paket_id', [...ulazniPaketiIds]);
        (ulazRows || []).forEach((u) => {
            if (Array.isArray(u.ulaz_trupci_ids)) u.ulaz_trupci_ids.forEach((id) => trupciIds.add(id));
        });
    }

    let sumarijeSet = new Set();
    if (trupciIds.size > 0) {
        const { data: trRows } = await supabase
            .from('trupci')
            .select('id, sumarija, podruznica, vrsta')
            .in('id', [...trupciIds].slice(0, 400));
        (trRows || []).forEach((t) => {
            if (t.sumarija) sumarijeSet.add(t.sumarija);
        });
    }

    const sumarijeLista = [...sumarijeSet].map((naziv) => {
        const meta = fscPostavke.sumarijeMeta?.[naziv] || {};
        return {
            naziv,
            fscStatus: meta.fscStatus || 'BEZ_FSC',
            certBroj: meta.certBroj || '',
            vaziDo: meta.vaziDo || '',
            gpsLokacija: meta.gpsLokacija || '',
            eudrOdjel: meta.eudrOdjel || '',
        };
    });

    const fscStatusi = new Set(sumarijeLista.map((s) => s.fscStatus));
    const imaFsc = [...fscStatusi].some((st) => st && st !== 'BEZ_FSC');
    const imaNeFsc = fscStatusi.has('BEZ_FSC');
    const imaMijesanje = imaFsc && imaNeFsc;

    let claim = '';
    if (fscPostavke.firmaFscCoc) {
        if (sumarijeLista.length > 0 && !imaNeFsc && fscStatusi.size === 1 && fscStatusi.has('FSC 100%')) {
            claim = 'FSC 100%';
        } else if (imaFsc || sumarijeLista.length === 0) {
            claim = fscPostavke.defaultClaim || 'FSC Mix Credit';
        }
    }

    return {
        fscCoc: fscPostavke.firmaFscCoc || '',
        claim,
        sumarije: sumarijeLista,
        eudrLokacije: sumarijeLista.filter((s) => s.gpsLokacija || s.eudrOdjel),
        imaMijesanje,
        paketCount: paketIds.length,
    };
}

/**
 * Izračunava HTML banner za FSC CoC Claim na PDF Otpremnici i Računu.
 */
export function generisiFscPdfHtml(fscPostavke, claimOverride = '') {
    const coc = String(fscPostavke?.firmaFscCoc || '').trim();
    if (!coc) return '';
    const claim = claimOverride || fscPostavke?.defaultClaim || 'FSC Mix Credit';
    return `
        <div style="margin-top:12px; padding:8px 12px; border:1.5px solid #16a34a; background:#f0fdf4; border-radius:6px; font-size:10px; color:#14532d; display:flex; justify-content:space-between; align-items:center;">
            <span><b>🌲 FSC® Chain of Custody:</b> ${claim}</span>
            <span>Certifikat br.: <b>${coc}</b></span>
        </div>
    `;
}

/**
 * Provjerava koliko dana je ostalo do isteka FSC certifikata šumarije.
 */
export function statusIstekaCertifikata(vaziDoIso) {
    if (!vaziDoIso) return { status: 'NEPOZNATO', dana: null };
    const danasIso = toLocalIso(new Date());
    const diff = Math.floor((new Date(`${vaziDoIso}T12:00:00`).getTime() - new Date(`${danasIso}T12:00:00`).getTime()) / 86400000);
    if (diff < 0) return { status: 'ISTEKAO', dana: diff };
    if (diff <= 30) return { status: 'USKORO', dana: diff };
    return { status: 'VAŽEĆI', dana: diff };
}
