"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    X, Printer, FileSpreadsheet, ArrowRight, RefreshCw,
    TrendingUp, DollarSign, AlertTriangle, Flame, Bell, Wrench, CheckCircle2, User
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { toLocalIso, prikazDatumaBHS, escapeHtml, getEfektivnaZapreminaTrupca } from '../utils/dateHelpers';
import { jeQaTestniZapis } from '../utils/smartReminders';
import { deduplicirajNotifikacije, izvuciPromjenuStanja, ocistiTekstDetalja } from '../utils/notificationHelpers';
import { printDokument } from '../utils/printHelpers';
import { exportToExcel } from '../utils/exportHelpers';
import SmartChart, { uhvatiSmartChartSvgHtml } from './SmartChart';

const TIP_META = {
    prorez: {
        naslov: 'Izvještaj Proreza & Izlaza Pilane',
        podnaslov: 'Jučerašnji učinak i 7-dnevni trend prerade (m³ i Yield %)',
        ikona: TrendingUp,
        boja: '#10b981',
        modul: 'analitika',
        modulLabel: 'Otvori Analitiku',
    },
    kes: {
        naslov: 'Izvještaj Keš Toka & Blagajne',
        podnaslov: 'Jučerašnji prilivi, odlivi i 7-dnevno kretanje gotovine',
        ikona: DollarSign,
        boja: '#3b82f6',
        modul: 'blagajna',
        modulLabel: 'Otvori Blagajnu',
    },
    dospjeli: {
        naslov: 'Izvještaj Dospjelih Računa & Aging Analiza',
        podnaslov: 'Nenaplaćene dospjele fakture, kašnjenja i struktura duga po kupcima',
        ikona: AlertTriangle,
        boja: '#ef4444',
        modul: 'racuni',
        modulLabel: 'Otvori Račune',
    },
    susare: {
        naslov: 'Izvještaj Sušara, Servisa Pila & Zastoja',
        podnaslov: 'Aktivne šarže u sušenju, iskorištenost pila i zastoji mašina (7 dana)',
        ikona: Flame,
        boja: '#f59e0b',
        modul: 'planiranje',
        modulLabel: 'Otvori Sušare & Servis',
    },
    alarmi: {
        naslov: 'Izvještaj Aktivnih Alarma & Kontrolnog Tornja',
        podnaslov: 'Neriješeni kritični alarmi, upozorenja i pregled izmjena stanja',
        ikona: Bell,
        boja: '#f59e0b',
        modul: 'toranj',
        modulLabel: 'Otvori Kontrolni Toranj',
    },
};

const kreirajZadnjihNDana = (n = 7) => {
    const danas = new Date();
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(danas.getFullYear(), danas.getMonth(), danas.getDate() - i);
        const iso = toLocalIso(d);
        out.push({
            iso,
            label: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`,
        });
    }
    return out;
};

const izracunajRokIso = (r) => {
    const raw = String(r?.rok_placanja || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    if (r?.datum) {
        const dana = parseInt(raw, 10);
        const base = new Date(`${String(r.datum).slice(0, 10)}T12:00:00`);
        if (!isNaN(base.getTime())) {
            base.setDate(base.getDate() + (isNaN(dana) ? 15 : dana));
            return toLocalIso(base);
        }
    }
    return '';
};

const KPI_COLOR_MAP = {
    emerald: 'border-emerald-500/40 text-emerald-400',
    blue: 'border-blue-500/40 text-blue-400',
    amber: 'border-amber-500/40 text-amber-400',
    red: 'border-red-500/40 text-red-400',
    purple: 'border-purple-500/40 text-purple-400',
    slate: 'border-theme-border text-theme-text',
};

export default function BrifingIzvjestajModal({ tip, onClose, onNavigateModule }) {
    const [loading, setLoading] = useState(true);
    const [report, setReport] = useState(null);
    const [chartDataset, setChartDataset] = useState('primary');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!tip) return;
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [tip, onClose]);

    const loadReport = async () => {
        if (!tip) return;
        setLoading(true);
        setChartDataset('primary');
        try {
            const danasObj = new Date();
            const juceObj = new Date(danasObj.getFullYear(), danasObj.getMonth(), danasObj.getDate() - 1);
            const danasIso = toLocalIso(danasObj);
            const juceIso = toLocalIso(juceObj);
            const dani7 = kreirajZadnjihNDana(7);
            const od7Iso = dani7[0].iso;

            if (tip === 'prorez') {
                const [prRes, pkRes] = await Promise.all([
                    supabase.from('prorez_log').select('*').gte('datum', od7Iso).order('datum', { ascending: false }),
                    supabase.from('paketi').select('*').gte('datum_yyyy_mm', od7Iso).order('created_at', { ascending: false }),
                ]);
                const prorez = (prRes.data || []).filter((x) => !jeQaTestniZapis(x));
                const paketi = (pkRes.data || []).filter((x) => !jeQaTestniZapis(x) && parseFloat(x.kolicina_final || 0) > 0);

                const jucePr = prorez.filter((x) => String(x.datum || '').slice(0, 10) === juceIso);
                const jucePk = paketi.filter((x) => String(x.datum_yyyy_mm || '').slice(0, 10) === juceIso);

                const jucePrM3 = jucePr.reduce((s, r) => s + (parseFloat(r.zapremina || 0) || 0), 0);
                const juceIzM3 = jucePk.reduce((s, p) => s + (parseFloat(p.kolicina_final || 0) || 0), 0);
                const juceYield = jucePrM3 > 0 ? Math.min(100, (juceIzM3 / jucePrM3) * 100) : 0;

                const uk7PrM3 = prorez.reduce((s, r) => s + (parseFloat(r.zapremina || 0) || 0), 0);
                const uk7IzM3 = paketi.reduce((s, p) => s + (parseFloat(p.kolicina_final || 0) || 0), 0);
                const uk7Yield = uk7PrM3 > 0 ? Math.min(100, (uk7IzM3 / uk7PrM3) * 100) : 0;

                const dnevniPodaci = dani7.map((d) => {
                    const pM3 = prorez.filter((x) => String(x.datum || '').slice(0, 10) === d.iso).reduce((s, r) => s + (parseFloat(r.zapremina || 0) || 0), 0);
                    const iM3 = paketi.filter((x) => String(x.datum_yyyy_mm || '').slice(0, 10) === d.iso).reduce((s, p) => s + (parseFloat(p.kolicina_final || 0) || 0), 0);
                    return {
                        dan: d.label,
                        prorez: parseFloat(pM3.toFixed(3)),
                        izlaz: parseFloat(iM3.toFixed(3)),
                        yield: pM3 > 0 ? parseFloat(Math.min(100, (iM3 / pM3) * 100).toFixed(1)) : 0,
                    };
                });

                const poMasiniMapa = {};
                paketi.forEach((p) => {
                    const m = (p.masina || 'Ostalo').trim();
                    poMasiniMapa[m] = (poMasiniMapa[m] || 0) + (parseFloat(p.kolicina_final || 0) || 0);
                });
                const poMasini = Object.entries(poMasiniMapa)
                    .map(([naziv, m3]) => ({ naziv, m3: parseFloat(m3.toFixed(3)) }))
                    .sort((a, b) => b.m3 - a.m3)
                    .slice(0, 10);

                const redovi = paketi.slice(0, 40).map((p) => ({
                    datum: prikazDatumaBHS(p.datum_yyyy_mm),
                    id: p.paket_id || '-',
                    proizvod: p.naziv_proizvoda || '-',
                    dimenzije: p.debljina && p.sirina && p.duzina ? `${p.debljina}×${p.sirina}×${p.duzina}` : '-',
                    masina: p.masina || '-',
                    m3: parseFloat((parseFloat(p.kolicina_final || 0) || 0).toFixed(3)),
                }));

                setReport({
                    kpis: [
                        { label: `Juče Prorez (${prikazDatumaBHS(juceIso)})`, value: `${jucePrM3.toFixed(2)} m³`, sub: `${jucePr.length} trupaca prorezano`, color: 'amber' },
                        { label: 'Juče Izlaz / Yield', value: `${juceIzM3.toFixed(2)} m³`, sub: `Iskorištenje: ${juceYield.toFixed(1)}% (${jucePk.length} stavki)`, color: 'emerald' },
                        { label: '7-Dnevni Prorez', value: `${uk7PrM3.toFixed(2)} m³`, sub: `${prorez.length} trupaca zadnjih 7 dana`, color: 'blue' },
                        { label: '7-Dnevni Izlaz & Yield', value: `${uk7IzM3.toFixed(2)} m³`, sub: `Prosječni Yield: ${uk7Yield.toFixed(1)}%`, color: 'purple' },
                    ],
                    charts: {
                        primary: {
                            label: '7-Dnevni Trend (Prorez vs Izlaz)',
                            title: '🪵 7-Dnevni Trend: Ulaz Proreza vs Gotovi Izlaz (m³)',
                            subtitle: `${prikazDatumaBHS(od7Iso)} – ${prikazDatumaBHS(danasIso)}`,
                            type: 'bar',
                            xKey: 'dan',
                            unit: 'm³',
                            data: dnevniPodaci,
                            series: [
                                { key: 'prorez', name: 'Prorez (Ulaz)', color: '#f59e0b', unit: 'm³' },
                                { key: 'izlaz', name: 'Izlaz (Paketi)', color: '#10b981', unit: 'm³' },
                            ],
                        },
                        secondary: {
                            label: 'Učinak po Mašinama (7d)',
                            title: '⚙️ Proizvodnja po Mašinama (Zadnjih 7 dana)',
                            subtitle: 'Ukupna proizvedena zapremina po pogonu/mašini',
                            type: 'hbar',
                            xKey: 'naziv',
                            unit: 'm³',
                            data: poMasini,
                            series: [{ key: 'm3', name: 'Izlaz', color: '#3b82f6', unit: 'm³' }],
                        },
                    },
                    tabelaNaslov: `Proizvedeni Paketi & Stavke (Zadnjih 7 dana — prikazano ${redovi.length})`,
                    kolone: [
                        { key: 'datum', label: 'Datum', type: 'string' },
                        { key: 'id', label: 'Paket ID', type: 'string' },
                        { key: 'proizvod', label: 'Proizvod', type: 'string' },
                        { key: 'dimenzije', label: 'Dimenzije', type: 'string' },
                        { key: 'masina', label: 'Mašina', type: 'string' },
                        { key: 'm3', label: 'Količina (m³)', type: 'number', align: 'right', suffix: ' m³' },
                    ],
                    redovi,
                });
            } else if (tip === 'kes') {
                const { data: blRaw } = await supabase.from('blagajna').select('*').order('datum', { ascending: false });
                const sve = (blRaw || []).filter((x) => !jeQaTestniZapis(x));
                const isUlaz = (b) => String(b.tip || '').toUpperCase().includes('ULAZ');

                const ukupnoUlaz = sve.filter(isUlaz).reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);
                const ukupnoIzlaz = sve.filter((b) => !isUlaz(b)).reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);
                const stanjeKase = ukupnoUlaz - ukupnoIzlaz;

                const juceTx = sve.filter((b) => String(b.datum || '').slice(0, 10) === juceIso);
                const juceUlaz = juceTx.filter(isUlaz).reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);
                const juceIzlaz = juceTx.filter((b) => !isUlaz(b)).reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);

                const zadnjih7 = sve.filter((b) => String(b.datum || '').slice(0, 10) >= od7Iso);
                const uk7Ulaz = zadnjih7.filter(isUlaz).reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);
                const uk7Izlaz = zadnjih7.filter((b) => !isUlaz(b)).reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);

                const dnevniPodaci = dani7.map((d) => {
                    const dnevne = zadnjih7.filter((b) => String(b.datum || '').slice(0, 10) === d.iso);
                    const u = dnevne.filter(isUlaz).reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);
                    const i = dnevne.filter((b) => !isUlaz(b)).reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);
                    return { dan: d.label, ulaz: parseFloat(u.toFixed(2)), izlaz: parseFloat(i.toFixed(2)), neto: parseFloat((u - i).toFixed(2)) };
                });

                const katMapa = {};
                zadnjih7.filter((b) => !isUlaz(b)).forEach((b) => {
                    const k = (b.kategorija || 'Ostali troškovi').trim();
                    katMapa[k] = (katMapa[k] || 0) + (parseFloat(b.iznos || 0) || 0);
                });
                const poKat = Object.entries(katMapa)
                    .map(([kategorija, iznos]) => ({ kategorija, iznos: parseFloat(iznos.toFixed(2)) }))
                    .sort((a, b) => b.iznos - a.iznos);

                const redovi = sve.slice(0, 45).map((b) => ({
                    datum: prikazDatumaBHS(b.datum),
                    tip: isUlaz(b) ? 'ULAZ (+)' : 'IZLAZ (-)',
                    kategorija: b.kategorija || '-',
                    opis: b.opis || '-',
                    iznos: parseFloat((parseFloat(b.iznos || 0) || 0).toFixed(2)),
                    _isUlaz: isUlaz(b),
                }));

                setReport({
                    kpis: [
                        { label: `Juče Priliv (${prikazDatumaBHS(juceIso)})`, value: `+${juceUlaz.toFixed(2)} KM`, sub: `${juceTx.filter(isUlaz).length} uplata`, color: 'emerald' },
                        { label: 'Juče Odliv / Neto', value: `-${juceIzlaz.toFixed(2)} KM`, sub: `Juče neto: ${(juceUlaz - juceIzlaz).toFixed(2)} KM`, color: juceUlaz >= juceIzlaz ? 'blue' : 'red' },
                        { label: '7-Dnevni Neto Tok', value: `${(uk7Ulaz - uk7Izlaz).toFixed(2)} KM`, sub: `+${uk7Ulaz.toFixed(0)} / -${uk7Izlaz.toFixed(0)} KM`, color: uk7Ulaz >= uk7Izlaz ? 'emerald' : 'amber' },
                        { label: 'Trenutno Stanje Kase', value: `${stanjeKase.toFixed(2)} KM`, sub: `${sve.length} ukupno transakcija`, color: 'purple' },
                    ],
                    charts: {
                        primary: {
                            label: '7-Dnevni Keš Tok',
                            title: '💵 7-Dnevni Keš Tok: Prilivi vs Odlivi (KM)',
                            subtitle: `${prikazDatumaBHS(od7Iso)} – ${prikazDatumaBHS(danasIso)}`,
                            type: 'bar',
                            xKey: 'dan',
                            unit: 'KM',
                            data: dnevniPodaci,
                            series: [
                                { key: 'ulaz', name: 'Ulaz (Priliv)', color: '#10b981', unit: 'KM' },
                                { key: 'izlaz', name: 'Izlaz (Odliv)', color: '#ef4444', unit: 'KM' },
                            ],
                        },
                        secondary: {
                            label: 'Struktura Troškova (7d)',
                            title: '📉 Odlivi po Kategorijama (Zadnjih 7 dana)',
                            subtitle: 'Raspodjela isplata iz blagajne',
                            type: 'donut',
                            xKey: 'kategorija',
                            unit: 'KM',
                            data: poKat,
                            series: [{ key: 'iznos', name: 'Iznos', color: '#ef4444', unit: 'KM' }],
                        },
                    },
                    tabelaNaslov: `Zadnje Transakcije Blagajne (prikazano ${redovi.length})`,
                    kolone: [
                        { key: 'datum', label: 'Datum', type: 'string' },
                        { key: 'tip', label: 'Smjer', type: 'string' },
                        { key: 'kategorija', label: 'Kategorija', type: 'string' },
                        { key: 'opis', label: 'Opis', type: 'string' },
                        { key: 'iznos', label: 'Iznos (KM)', type: 'number', align: 'right', suffix: ' KM' },
                    ],
                    redovi,
                });
            } else if (tip === 'dospjeli') {
                const [racRes, blRes] = await Promise.all([
                    supabase.from('racuni').select('*').order('datum', { ascending: false }),
                    supabase.from('blagajna').select('tip, iznos, racun_id, opis').eq('tip', 'ULAZ'),
                ]);
                const uplate = (blRes.data || []).filter((x) => !jeQaTestniZapis(x));
                const danasMs = new Date(`${danasIso}T12:00:00`).getTime();

                const aging = { d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
                const kupciMapa = {};
                const dospjeliLista = [];

                (racRes.data || []).forEach((r) => {
                    if (jeQaTestniZapis(r)) return;
                    const st = String(r.status || '').toUpperCase().trim();
                    if (st === 'NAPLAĆENO' || st === 'NAPLACENO' || st === 'PLAĆENO' || st === 'STORNIRANO' || st === 'OBRISANO') return;
                    const rokIso = izracunajRokIso(r);
                    if (!rokIso || rokIso >= danasIso) return;

                    const val = String(r.valuta || 'KM').toUpperCase();
                    const kurs = (val === 'EUR' || val === '€') ? 1.95583 : 1;
                    const ukupnoKM = (parseFloat(r.ukupno_sa_pdv || 0) || 0) * kurs;
                    if (ukupnoKM <= 0.01) return;

                    const ridUp = String(r.id || '').toUpperCase().trim();
                    const uplBl = uplate
                        .filter((u) => (u.racun_id && String(u.racun_id).toUpperCase().trim() === ridUp) || (u.opis && String(u.opis).toUpperCase().includes(ridUp)))
                        .reduce((s, u) => s + (parseFloat(u.iznos || 0) || 0), 0);
                    const upl = Math.max(uplBl, parseFloat(r.uplaceno || 0) || 0);
                    const dugKM = parseFloat(Math.max(0, ukupnoKM - upl).toFixed(2));
                    if (dugKM <= 0.5) return;

                    const rokMs = new Date(`${rokIso}T12:00:00`).getTime();
                    const kasniDana = Math.max(1, Math.round((danasMs - rokMs) / 86400000));
                    if (kasniDana <= 30) aging.d1_30 += dugKM;
                    else if (kasniDana <= 60) aging.d31_60 += dugKM;
                    else if (kasniDana <= 90) aging.d61_90 += dugKM;
                    else aging.d90plus += dugKM;

                    const kupac = r.kupac_naziv || 'Nepoznat kupac';
                    kupciMapa[kupac] = (kupciMapa[kupac] || 0) + dugKM;

                    dospjeliLista.push({
                        id: r.id,
                        kupac,
                        datum: prikazDatumaBHS(r.datum),
                        rok: prikazDatumaBHS(rokIso),
                        kasniDana,
                        ukupnoKM: parseFloat(ukupnoKM.toFixed(2)),
                        uplacenoKM: parseFloat(upl.toFixed(2)),
                        dugKM,
                    });
                });

                dospjeliLista.sort((a, b) => b.kasniDana - a.kasniDana);
                const ukDug = dospjeliLista.reduce((s, r) => s + r.dugKM, 0);
                const maxKasni = dospjeliLista[0]?.kasniDana || 0;
                const topDuznici = Object.entries(kupciMapa)
                    .map(([kupac, dug]) => ({ kupac: kupac.slice(0, 26), dug: parseFloat(dug.toFixed(2)) }))
                    .sort((a, b) => b.dug - a.dug)
                    .slice(0, 10);

                const agingData = [
                    { bucket: '1–30 dana', dug: parseFloat(aging.d1_30.toFixed(2)) },
                    { bucket: '31–60 dana', dug: parseFloat(aging.d31_60.toFixed(2)) },
                    { bucket: '61–90 dana', dug: parseFloat(aging.d61_90.toFixed(2)) },
                    { bucket: '90+ dana', dug: parseFloat(aging.d90plus.toFixed(2)) },
                ];

                setReport({
                    kpis: [
                        { label: 'Dospjelih Računa', value: `${dospjeliLista.length} kom`, sub: `${Object.keys(kupciMapa).length} kupaca u kašnjenju`, color: dospjeliLista.length > 0 ? 'red' : 'emerald' },
                        { label: 'Ukupni Dospjeli Dug', value: `${ukDug.toFixed(2)} KM`, sub: 'Stvarni saldo nakon uplata', color: ukDug > 0 ? 'red' : 'emerald' },
                        { label: 'Najstarije Kašnjenje', value: `${maxKasni} dana`, sub: dospjeliLista[0] ? `${dospjeliLista[0].id} (${dospjeliLista[0].kupac})` : 'Svi računi u roku', color: maxKasni > 30 ? 'red' : 'amber' },
                        { label: 'Kritično (> 60 dana)', value: `${(aging.d61_90 + aging.d90plus).toFixed(2)} KM`, sub: `90+ dana: ${aging.d90plus.toFixed(2)} KM`, color: (aging.d61_90 + aging.d90plus) > 0 ? 'red' : 'emerald' },
                    ],
                    charts: {
                        primary: {
                            label: 'Top Dužnici (KM)',
                            title: '🚨 Top Dužnici po Dospjelom Saldu (KM)',
                            subtitle: 'Klikni na ime kupca u tabeli ispod za otvaranje finansijske kartice',
                            type: 'hbar',
                            xKey: 'kupac',
                            unit: 'KM',
                            data: topDuznici,
                            series: [{ key: 'dug', name: 'Dospjeli dug', color: '#ef4444', unit: 'KM' }],
                        },
                        secondary: {
                            label: 'Aging Struktura (30/60/90+)',
                            title: '⏳ Aging Struktura Dospjelih Potraživanja',
                            subtitle: 'Starost duga u danima preko roka valute',
                            type: 'bar',
                            xKey: 'bucket',
                            unit: 'KM',
                            data: agingData,
                            colorMap: { '1–30 dana': '#f59e0b', '31–60 dana': '#f97316', '61–90 dana': '#ef4444', '90+ dana': '#991b1b' },
                            series: [{ key: 'dug', name: 'Iznos duga', color: '#ef4444', unit: 'KM' }],
                        },
                    },
                    tabelaNaslov: `Lista Dospjelih Nenaplaćenih Računa (${dospjeliLista.length})`,
                    kolone: [
                        { key: 'id', label: 'Račun', type: 'string' },
                        { key: 'kupac', label: 'Kupac (klik za karticu)', type: 'string', clickableKupac: true },
                        { key: 'rok', label: 'Rok valute', type: 'string' },
                        { key: 'kasniDana', label: 'Kasni (dana)', type: 'number', align: 'right', suffix: ' d' },
                        { key: 'uplacenoKM', label: 'Uplaćeno', type: 'number', align: 'right', suffix: ' KM' },
                        { key: 'dugKM', label: 'Preostali Dug', type: 'number', align: 'right', suffix: ' KM' },
                    ],
                    redovi: dospjeliLista,
                });
            } else if (tip === 'susare') {
                const [susRes, srvRes, dnRes] = await Promise.all([
                    supabase.from('ui_postavke').select('postavke_jsonb').eq('modul_ime', 'susare_sarze').maybeSingle(),
                    supabase.from('ui_postavke').select('postavke_jsonb').eq('modul_ime', 'servis_masina_pila').maybeSingle(),
                    supabase.from('dnevnik_masine').select('*').gte('datum', od7Iso).order('datum', { ascending: false }),
                ]);

                const sarze = Array.isArray(susRes.data?.postavke_jsonb?.lista)
                    ? susRes.data.postavke_jsonb.lista
                    : (Array.isArray(susRes.data?.postavke_jsonb?.sarze) ? susRes.data.postavke_jsonb.sarze : []);
                const aktivneSarze = sarze.filter((s) => s.status === 'U SUŠENJU' || s.status === 'SUŠENJE');
                const spremne = aktivneSarze.filter((s) => {
                    const kraj = s.plan_zavrsetak || s.planirani_kraj;
                    if (!kraj) return false;
                    return Math.ceil((new Date(kraj).getTime() - new Date(danasIso).getTime()) / 86400000) <= 1;
                });
                const ukSusareM3 = aktivneSarze.reduce((s, x) => s + (parseFloat(x.kolicina_m3 || x.zapremina || 0) || 0), 0);

                const servisi = Array.isArray(srvRes.data?.postavke_jsonb?.lista) ? srvRes.data.postavke_jsonb.lista : [];
                const zaServis = servisi.filter((s) => s.status === 'POTREBAN_SERVIS' || (parseFloat(s.odradjeno_m3 || 0) >= parseFloat(s.prag_m3 || 999999)));

                const zastoji = (dnRes.data || []).filter((z) => !jeQaTestniZapis(z));
                const ukZastojMin = zastoji.reduce((s, z) => s + (parseFloat(z.trajanje_min || z.trajanje_minuta || 0) || 0), 0);

                const sarzeChart = (aktivneSarze.length > 0 ? aktivneSarze : sarze.slice(0, 8)).map((s, idx) => ({
                    komora: s.komora || s.naziv || `Šarža #${idx + 1}`,
                    m3: parseFloat((parseFloat(s.kolicina_m3 || s.zapremina || 0) || 0).toFixed(2)),
                }));

                const servisChart = servisi.map((s) => ({
                    masina: s.masina || s.naziv || 'Mašina',
                    odradjeno: parseFloat((parseFloat(s.odradjeno_m3 || 0) || 0).toFixed(1)),
                    prag: parseFloat((parseFloat(s.prag_m3 || 0) || 0).toFixed(1)),
                }));

                const redovi = [
                    ...sarze.slice(0, 20).map((s) => ({
                        tip: '🔥 Sušara',
                        naziv: `${s.komora || 'Komora'} — ${s.artikal || s.vrsta || s.napomena || '-'}`,
                        status: s.status || 'U SUŠENJU',
                        vrijednost: `${(parseFloat(s.kolicina_m3 || s.zapremina || 0) || 0).toFixed(2)} m³`,
                        rok: prikazDatumaBHS(s.plan_zavrsetak || s.planirani_kraj),
                        detalj: s.ciljna_vlaga ? `Ciljna vlaga: ${s.ciljna_vlaga}%` : (s.napomena || '-'),
                    })),
                    ...servisi.map((s) => ({
                        tip: '🪚 Servis Pile',
                        naziv: s.masina || s.naziv || 'Mašina',
                        status: s.status || 'OK',
                        vrijednost: `${(parseFloat(s.odradjeno_m3 || 0) || 0).toFixed(1)} / ${(parseFloat(s.prag_m3 || 0) || 0).toFixed(0)} m³`,
                        rok: prikazDatumaBHS(s.zadnji_servis),
                        detalj: s.napomena || 'Praćenje oštrenja i zamjene pile',
                    })),
                ];

                setReport({
                    kpis: [
                        { label: 'Aktivnih Šarži', value: `${aktivneSarze.length} kom`, sub: `Ukupno ${ukSusareM3.toFixed(2)} m³ u sušenju`, color: 'amber' },
                        { label: 'Spremno / Pri Kraju', value: `${spremne.length} šarži`, sub: 'Završetak danas ili sutra', color: spremne.length > 0 ? 'emerald' : 'blue' },
                        { label: 'Servis Pila / Mašina', value: `${zaServis.length} za servis`, sub: `Praćeno ukupno ${servisi.length} mašina`, color: zaServis.length > 0 ? 'red' : 'emerald' },
                        { label: 'Zastoji (7 dana)', value: `${ukZastojMin} min`, sub: `${zastoji.length} evidentiranih zapisa`, color: ukZastojMin > 120 ? 'red' : 'blue' },
                    ],
                    charts: {
                        primary: {
                            label: 'Sušare po Komorama (m³)',
                            title: '🔥 Zapremina Šarži u Sušarama (m³)',
                            subtitle: 'Pregled opterećenja sušarskih komora',
                            type: 'bar',
                            xKey: 'komora',
                            unit: 'm³',
                            data: sarzeChart,
                            series: [{ key: 'm3', name: 'Količina', color: '#f59e0b', unit: 'm³' }],
                        },
                        secondary: {
                            label: 'Servis Pila (Odradjeno vs Prag)',
                            title: '🪚 Iskorištenost Pila vs Prag Servisa (m³)',
                            subtitle: 'Poređenje prorezane kubikaže sa servisnim limitom',
                            type: 'bar',
                            xKey: 'masina',
                            unit: 'm³',
                            data: servisChart,
                            series: [
                                { key: 'odradjeno', name: 'Odrađeno', color: '#ef4444', unit: 'm³' },
                                { key: 'prag', name: 'Servisni prag', color: '#3b82f6', unit: 'm³' },
                            ],
                        },
                    },
                    tabelaNaslov: `Pregled Sušara i Servisnog Rasporeda (${redovi.length} stavki)`,
                    kolone: [
                        { key: 'tip', label: 'Tip', type: 'string' },
                        { key: 'naziv', label: 'Komora / Mašina', type: 'string' },
                        { key: 'status', label: 'Status', type: 'string' },
                        { key: 'vrijednost', label: 'Kubikaža / Opterećenje', type: 'string' },
                        { key: 'rok', label: 'Plan / Zadnji servis', type: 'string' },
                        { key: 'detalj', label: 'Napomena', type: 'string' },
                    ],
                    redovi,
                });
            } else if (tip === 'alarmi') {
                const { data: logRaw } = await supabase
                    .from('sistem_audit_log')
                    .select('*')
                    .eq('pregledano', false)
                    .order('vrijeme', { ascending: false })
                    .limit(120);

                const svi = deduplicirajNotifikacije(logRaw || []);
                const aktivni = svi.filter((l) => l.nivo_alarma === 'CRVENO' || l.nivo_alarma === 'ŽUTO');
                const crveni = aktivni.filter((l) => l.nivo_alarma === 'CRVENO');
                const zuti = aktivni.filter((l) => l.nivo_alarma === 'ŽUTO');

                const akcijeMapa = {};
                aktivni.forEach((l) => {
                    const a = String(l.akcija || 'OSTALO').replace(/_/g, ' ').slice(0, 26);
                    akcijeMapa[a] = (akcijeMapa[a] || 0) + 1;
                });
                const poAkciji = Object.entries(akcijeMapa)
                    .map(([akcija, broj]) => ({ akcija, broj }))
                    .sort((a, b) => b.broj - a.broj)
                    .slice(0, 10);

                const poNivou = [
                    { nivo: 'Kritični (CRVENO)', broj: crveni.length },
                    { nivo: 'Upozorenja (ŽUTO)', broj: zuti.length },
                ];

                const redovi = aktivni.slice(0, 40).map((l) => {
                    const prom = izvuciPromjenuStanja(l);
                    const vr = l.vrijeme || l.created_at || '';
                    return {
                        vrijeme: vr ? `${prikazDatumaBHS(vr)} ${String(vr).slice(11, 16)}` : '-',
                        nivo: l.nivo_alarma || 'ŽUTO',
                        korisnik: prom.ko || l.korisnik || 'Sistem',
                        akcija: String(l.akcija || '').replace(/_/g, ' '),
                        promjena: prom.prethodno && prom.novo ? `${prom.prethodno} → ${prom.novo}` : prom.opisPromjene,
                        detalji: ocistiTekstDetalja(l.detalji || '').slice(0, 140),
                    };
                });

                setReport({
                    kpis: [
                        { label: 'Ukupno Aktivnih Alarma', value: `${aktivni.length}`, sub: 'Deduplicirano iz Kontrolnog Tornja', color: aktivni.length > 0 ? 'amber' : 'emerald' },
                        { label: 'Kritični (CRVENO)', value: `${crveni.length}`, sub: 'Zahtijevaju hitnu pažnju uprave', color: crveni.length > 0 ? 'red' : 'emerald' },
                        { label: 'Upozorenja (ŽUTO)', value: `${zuti.length}`, sub: 'Kontrola rabata, rokova i izmjena', color: 'amber' },
                        { label: 'Najčešći Događaj', value: poAkciji[0]?.akcija?.slice(0, 18) || 'Sve čisto', sub: poAkciji[0] ? `${poAkciji[0].broj}x zabilježeno` : 'Nema aktivnih alarma', color: 'blue' },
                    ],
                    charts: {
                        primary: {
                            label: 'Alarmi po Tipu Događaja',
                            title: '🔔 Raspodjela Aktivnih Alarma po Tipu',
                            subtitle: 'Najčešći uzroci upozorenja u sistemu',
                            type: 'hbar',
                            xKey: 'akcija',
                            unit: 'kom',
                            data: poAkciji,
                            series: [{ key: 'broj', name: 'Broj alarma', color: '#f59e0b', unit: 'kom' }],
                        },
                        secondary: {
                            label: 'Omjer Kritični vs Upozorenja',
                            title: '🚦 Kritičnost Aktivnih Alarma',
                            subtitle: 'CRVENO vs ŽUTO',
                            type: 'donut',
                            xKey: 'nivo',
                            unit: 'kom',
                            data: poNivou,
                            colorMap: { 'Kritični (CRVENO)': '#ef4444', 'Upozorenja (ŽUTO)': '#f59e0b' },
                            series: [{ key: 'broj', name: 'Alarma', color: '#ef4444', unit: 'kom' }],
                        },
                    },
                    tabelaNaslov: `Aktivni Neriješeni Alarmi sa Promjenama Stanja (${redovi.length})`,
                    kolone: [
                        { key: 'vrijeme', label: 'Vrijeme', type: 'string' },
                        { key: 'nivo', label: 'Nivo', type: 'string' },
                        { key: 'korisnik', label: 'Ko', type: 'string' },
                        { key: 'akcija', label: 'Akcija', type: 'string' },
                        { key: 'promjena', label: 'Promjena (Prije → Poslije)', type: 'string' },
                        { key: 'detalji', label: 'Detalji', type: 'string' },
                    ],
                    redovi,
                });
            }
        } catch (err) {
            console.error('Greška pri učitavanju brifing izvještaja:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReport();
    }, [tip]);

    const meta = TIP_META[tip];
    const activeChart = useMemo(() => {
        if (!report?.charts) return null;
        return report.charts[chartDataset] || report.charts.primary;
    }, [report, chartDataset]);

    if (!tip || !meta || !mounted) return null;

    const IconComp = meta.ikona;
    const chartId = `brifing_modal_chart_${tip}_${chartDataset}`;

    const handlePrintPdf = () => {
        if (!report) return;
        const chartSvgHtml = activeChart ? uhvatiSmartChartSvgHtml(chartId, activeChart.title, activeChart.subtitle) : '';
        const kpiHtml = `
            <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:14px;">
                ${(report.kpis || []).map((k) => `
                    <div style="border:1px solid #cbd5e1; border-radius:8px; padding:10px; background:#f8fafc;">
                        <div style="font-size:8px; font-weight:800; text-transform:uppercase; color:#64748b;">${escapeHtml(k.label)}</div>
                        <div style="font-size:15px; font-weight:900; color:#0f172a; margin-top:4px;">${escapeHtml(k.value)}</div>
                        <div style="font-size:8px; color:#475569; margin-top:2px;">${escapeHtml(k.sub || '')}</div>
                    </div>
                `).join('')}
            </div>
        `;

        const thHtml = (report.kolone || []).map((c) => `<th class="${c.align === 'right' ? 'num' : ''}">${escapeHtml(c.label)}</th>`).join('');
        const trHtml = (report.redovi || []).map((r) => `
            <tr>
                ${(report.kolone || []).map((c) => {
                    const val = r[c.key] ?? '-';
                    const disp = c.suffix && val !== '-' ? `${val}${c.suffix}` : val;
                    return `<td class="${c.align === 'right' ? 'num' : ''}">${escapeHtml(disp)}</td>`;
                }).join('')}
            </tr>
        `).join('');

        const bodyHtml = `
            ${kpiHtml}
            ${chartSvgHtml}
            <div style="font-size:11px; font-weight:900; text-transform:uppercase; color:#0f172a; margin:14px 0 6px 0;">${escapeHtml(report.tabelaNaslov || '')}</div>
            <table>
                <thead><tr>${thHtml}</tr></thead>
                <tbody>${trHtml || `<tr><td colspan="${(report.kolone || []).length}" style="text-align:center;color:#64748b;">Nema stavki u ovom periodu.</td></tr>`}</tbody>
            </table>
        `;

        printDokument(
            meta.naslov.toUpperCase(),
            `BRIFING-${tip.toUpperCase()}-${toLocalIso(new Date())}`,
            prikazDatumaBHS(toLocalIso(new Date())),
            bodyHtml,
            meta.boja
        );
    };

    const handleExportExcel = () => {
        if (!report?.redovi?.length) return;
        exportToExcel({
            filename: `Brifing_${tip}_${toLocalIso(new Date())}`,
            sheetName: meta.naslov.slice(0, 28),
            title: `${meta.naslov} (${prikazDatumaBHS(toLocalIso(new Date()))})`,
            columns: (report.kolone || []).map((c) => ({ key: c.key, label: c.label, type: c.type || 'string' })),
            rows: report.redovi,
        });
    };

    const handleOpenModule = () => {
        if (tip === 'susare') {
            try { localStorage.setItem('planiranje_auto_tab', 'susare'); } catch (e) {}
        }
        onClose?.();
        onNavigateModule?.(meta.modul);
    };

    return createPortal(
        <div
            data-testid="brifing-izvjestaj-modal"
            className="fixed inset-0 z-[9500] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-5 overflow-y-auto"
            onClick={onClose}
        >
            <div
                className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-theme-card border-2 border-theme-accent/40 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-theme-border bg-gradient-to-r from-theme-panel via-theme-card to-theme-panel flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div
                            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border"
                            style={{ backgroundColor: `${meta.boja}20`, borderColor: `${meta.boja}66`, color: meta.boja }}
                        >
                            <IconComp size={22} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-theme-text truncate">
                                    {meta.naslov}
                                </h2>
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-theme-accent/20 text-theme-accent border border-theme-accent/40 font-black uppercase">
                                    Direktorski Izvještaj
                                </span>
                            </div>
                            <p className="text-[11px] text-theme-muted font-bold truncate mt-0.5">{meta.podnaslov}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={handlePrintPdf}
                            disabled={loading || !report}
                            data-testid="brifing-modal-print-btn"
                            className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[10px] font-black uppercase flex items-center gap-1.5 shadow-lg transition-all"
                        >
                            <Printer size={14} /> Isprintaj PDF
                        </button>
                        <button
                            type="button"
                            onClick={handleExportExcel}
                            disabled={loading || !report?.redovi?.length}
                            data-testid="brifing-modal-excel-btn"
                            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] font-black uppercase flex items-center gap-1.5 shadow-lg transition-all"
                        >
                            <FileSpreadsheet size={14} /> Excel
                        </button>
                        <button
                            type="button"
                            onClick={handleOpenModule}
                            className="px-3 py-2 rounded-xl bg-theme-panel hover:bg-theme-accent hover:text-white border border-theme-border text-theme-text text-[10px] font-black uppercase flex items-center gap-1 transition-all"
                        >
                            {meta.modulLabel} <ArrowRight size={13} />
                        </button>
                        <button
                            type="button"
                            onClick={loadReport}
                            title="Osvježi podatke"
                            className="p-2 rounded-xl bg-theme-panel border border-theme-border text-theme-muted hover:text-theme-text transition-colors"
                        >
                            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            data-testid="brifing-modal-close-btn"
                            aria-label="Zatvori izvještaj"
                            className="p-2 rounded-xl bg-theme-panel border border-theme-border text-theme-muted hover:text-red-400 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar bg-theme-main/60">
                    {loading || !report ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-2xl bg-theme-panel/70 animate-pulse border border-theme-border" />)}
                            </div>
                            <div className="h-64 rounded-2xl bg-theme-panel/70 animate-pulse border border-theme-border" />
                            <div className="h-44 rounded-2xl bg-theme-panel/70 animate-pulse border border-theme-border" />
                        </div>
                    ) : (
                        <>
                            {/* KPI Strip */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                {(report.kpis || []).map((k, idx) => (
                                    <div
                                        key={idx}
                                        className={`bg-theme-card p-4 rounded-2xl border shadow-md ${KPI_COLOR_MAP[k.color] || KPI_COLOR_MAP.slate}`}
                                    >
                                        <span className="text-[9px] font-black uppercase tracking-wider text-theme-muted block">
                                            {k.label}
                                        </span>
                                        <p className={`text-lg sm:text-xl font-black mt-1 ${KPI_COLOR_MAP[k.color]?.split(' ')[1] || 'text-theme-text'}`}>
                                            {k.value}
                                        </p>
                                        {k.sub && <p className="text-[10px] text-theme-muted font-bold mt-1 truncate">{k.sub}</p>}
                                    </div>
                                ))}
                            </div>

                            {/* Interactive SmartChart */}
                            {activeChart && (
                                <div className="bg-theme-card border border-theme-border rounded-2xl p-4 shadow-lg">
                                    <SmartChart
                                        chartId={chartId}
                                        title={activeChart.title}
                                        subtitle={activeChart.subtitle}
                                        data={activeChart.data}
                                        xKey={activeChart.xKey}
                                        series={activeChart.series}
                                        defaultType={activeChart.type || 'bar'}
                                        colorMap={activeChart.colorMap || null}
                                        unit={activeChart.unit || ''}
                                        height={265}
                                        datasetSelector={report.charts?.secondary ? {
                                            value: chartDataset,
                                            options: [
                                                { id: 'primary', label: report.charts.primary.label },
                                                { id: 'secondary', label: report.charts.secondary.label },
                                            ],
                                            onChange: setChartDataset,
                                        } : null}
                                    />
                                </div>
                            )}

                            {/* Detail Table */}
                            <div className="bg-theme-card border border-theme-border rounded-2xl overflow-hidden shadow-lg">
                                <div className="px-4 py-3 border-b border-theme-border bg-theme-panel/60 flex items-center justify-between gap-2">
                                    <h3 className="text-xs font-black uppercase tracking-wider text-theme-text">
                                        {report.tabelaNaslov}
                                    </h3>
                                    <span className="text-[10px] font-bold text-theme-muted">
                                        {report.redovi?.length || 0} stavki
                                    </span>
                                </div>

                                <div className="overflow-x-auto max-h-[300px] overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead className="sticky top-0 bg-theme-panel text-[10px] uppercase font-black text-theme-muted border-b border-theme-border z-10">
                                            <tr>
                                                {(report.kolone || []).map((c) => (
                                                    <th key={c.key} className={`p-3 whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}>
                                                        {c.label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-theme-border/60">
                                            {(!report.redovi || report.redovi.length === 0) ? (
                                                <tr>
                                                    <td colSpan={(report.kolone || []).length || 1} className="p-8 text-center text-theme-muted italic">
                                                        Nema evidentiranih stavki za ovaj izvještaj.
                                                    </td>
                                                </tr>
                                            ) : (
                                                report.redovi.map((row, rIdx) => (
                                                    <tr key={rIdx} className="hover:bg-theme-panel/50 transition-colors">
                                                        {(report.kolone || []).map((c) => {
                                                            const rawVal = row[c.key];
                                                            const disp = rawVal !== undefined && rawVal !== null && rawVal !== ''
                                                                ? `${rawVal}${c.suffix || ''}`
                                                                : '-';
                                                            if (c.clickableKupac && rawVal) {
                                                                return (
                                                                    <td key={c.key} className="p-3 font-black text-blue-400">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                window.dispatchEvent(new CustomEvent('otvori_karticu_kupca', { detail: { kupacNaziv: rawVal } }));
                                                                            }}
                                                                            className="hover:underline inline-flex items-center gap-1 text-left"
                                                                        >
                                                                            <User size={12} /> {rawVal}
                                                                        </button>
                                                                    </td>
                                                                );
                                                            }
                                                            const isCrit = c.key === 'nivo' && rawVal === 'CRVENO';
                                                            const isWarn = c.key === 'nivo' && rawVal === 'ŽUTO';
                                                            const isUlazCell = c.key === 'tip' && row._isUlaz === true;
                                                            const isIzlazCell = c.key === 'tip' && row._isUlaz === false;
                                                            return (
                                                                <td
                                                                    key={c.key}
                                                                    className={`p-3 ${c.align === 'right' ? 'text-right font-mono font-black' : 'font-bold'} ${
                                                                        isCrit ? 'text-red-400 font-black' :
                                                                        isWarn ? 'text-amber-400 font-black' :
                                                                        isUlazCell ? 'text-emerald-400 font-black' :
                                                                        isIzlazCell ? 'text-red-400 font-black' :
                                                                        'text-theme-text'
                                                                    }`}
                                                                >
                                                                    {disp}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
