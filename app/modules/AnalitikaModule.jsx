"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import MasterHeader from '../components/MasterHeader';
import TabAiAnalitika from '../components/TabAiAnalitika';
import DatumInput from '../components/DatumInput';
import SmartChart, { uhvatiSmartChartSvgHtml } from '../components/SmartChart';
import { printDokument } from '../utils/printHelpers';
import { exportToExcel } from '../utils/exportHelpers';
import { jeQaTestniZapis } from '../utils/smartReminders';
import { escapeHtml } from '../utils/dateHelpers';
import { useSaaS } from '../utils/useSaaS';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    Legend
} from 'recharts';
import { Calendar, Printer, TrendingUp, Layers, Cpu, DollarSign, Bot, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const toLocalIso = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const formatDatumBHS = (isoStr) => {
    if (!isoStr) return 'N/A';
    const clean = isoStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length !== 3) return isoStr;
    return `${parts[2]}.${parts[1]}.${parts[0]}.`;
};

// 🟢 TAČAN OBRAČUN VOLUMENA PAKETA (Sprječava odstupanje između komada/dimenzija i kubikaže, npr. paket 57: 16 kom 10x10x300 cm = 0.48 m3)
const izracunajTacanVolumenStavkePaketa = (p) => {
    const deb = parseFloat(p.debljina || 0);
    const sir = parseFloat(p.sirina || 0);
    const duz = parseFloat(p.duzina || 0);
    const kolUlaz = parseFloat(p.kolicina_ulaz ?? p.komada ?? 0);
    const jm = (p.jm || 'kom').toLowerCase();

    if (jm === 'm3' && kolUlaz > 0) {
        return parseFloat(kolUlaz.toFixed(4));
    }
    if (deb > 0 && sir > 0 && duz > 0 && kolUlaz > 0) {
        const vol1Kom = (deb / 100) * (sir / 100) * (duz / 100);
        if (jm === 'kom') {
            return parseFloat((kolUlaz * vol1Kom).toFixed(4));
        }
        if (jm === 'm2') {
            return parseFloat((kolUlaz * (deb / 100)).toFixed(4));
        }
        if (jm === 'm1') {
            return parseFloat((kolUlaz * (deb / 100) * (sir / 100)).toFixed(4));
        }
    }
    return parseFloat(p.kolicina_final ?? p.kubikaza ?? p.kolicina_m3 ?? 0) || 0;
};

const izracunajKomadeStavkePaketa = (p) => {
    const deb = parseFloat(p.debljina || 0);
    const sir = parseFloat(p.sirina || 0);
    const duz = parseFloat(p.duzina || 0);
    const kolUlaz = parseFloat(p.kolicina_ulaz ?? p.komada ?? 0);
    const jm = (p.jm || 'kom').toLowerCase();

    if (jm === 'kom' && kolUlaz > 0) return Math.round(kolUlaz);
    if (deb > 0 && sir > 0 && duz > 0) {
        const vol1Kom = (deb / 100) * (sir / 100) * (duz / 100);
        const m3 = izracunajTacanVolumenStavkePaketa(p);
        if (vol1Kom > 0 && m3 > 0) return Math.round(m3 / vol1Kom);
    }
    return Math.round(kolUlaz);
};

export default function AnalitikaModule({ user, header, setHeader, onExit }) {
    const saas = useSaaS('analitika_modul', {
        boja_kartice: '',
        boja_slova: '',
        boja_akcenta: '#3b82f6'
    });

    const danas = toLocalIso(new Date());
    const prviUMjesecu = `${danas.substring(0, 7)}-01`;

    const [tab, setTab] = useState('PROREZ'); // 'PROREZ' | 'DORADA' | 'UKUPNO' | 'FINANSIJE' | 'AI'
    const [modVremena, setModVremena] = useState('PERIOD'); // 'DAN' | 'PERIOD'
    const [datumOd, setDatumOd] = useState(prviUMjesecu);
    const [datumDo, setDatumDo] = useState(danas);
    const [masinaFilter, setMasinaFilter] = useState('SVE');

    const [loading, setLoading] = useState(true);
    const [ignorisiQaTest, setIgnorisiQaTest] = useState(true);
    const [masineBaza, setMasineBaza] = useState([]);
    const [rawTrupciBaza, setTrupciBaza] = useState([]);
    const [rawProrezLogBaza, setProrezLogBaza] = useState([]);
    const [rawPaketiBaza, setPaketiBaza] = useState([]);
    const [dnevnikMasineBaza, setDnevnikMasineBaza] = useState([]);
    const [katalogBaza, setKatalogBaza] = useState([]);
    const [rawReklamacijeBaza, setReklamacijeBaza] = useState([]);
    const [rawBlagajnaBaza, setBlagajnaBaza] = useState([]);
    const [radniSatiBaza, setRadniSatiBaza] = useState([]);
    const [radniciBaza, setRadniciBaza] = useState([]);
    const [rawRadniNaloziBaza, setRadniNaloziBaza] = useState([]);
    const [ponudeBaza, setPonudeBaza] = useState([]);
    const [racuniBaza, setRacuniBaza] = useState([]);

    const trupciBaza = useMemo(() => (ignorisiQaTest ? rawTrupciBaza.filter((x) => !jeQaTestniZapis(x)) : rawTrupciBaza), [rawTrupciBaza, ignorisiQaTest]);
    const prorezLogBaza = useMemo(() => (ignorisiQaTest ? rawProrezLogBaza.filter((x) => !jeQaTestniZapis(x)) : rawProrezLogBaza), [rawProrezLogBaza, ignorisiQaTest]);
    const paketiBaza = useMemo(() => (ignorisiQaTest ? rawPaketiBaza.filter((x) => !jeQaTestniZapis(x)) : rawPaketiBaza), [rawPaketiBaza, ignorisiQaTest]);
    const reklamacijeBaza = useMemo(() => (ignorisiQaTest ? rawReklamacijeBaza.filter((x) => !jeQaTestniZapis(x)) : rawReklamacijeBaza), [rawReklamacijeBaza, ignorisiQaTest]);
    const blagajnaBaza = useMemo(() => (ignorisiQaTest ? rawBlagajnaBaza.filter((x) => !jeQaTestniZapis(x)) : rawBlagajnaBaza), [rawBlagajnaBaza, ignorisiQaTest]);
    const radniNaloziBaza = useMemo(() => (ignorisiQaTest ? rawRadniNaloziBaza.filter((x) => !jeQaTestniZapis(x)) : rawRadniNaloziBaza), [rawRadniNaloziBaza, ignorisiQaTest]);
    const brojSkrivenihQa = useMemo(() => {
        if (!ignorisiQaTest) return 0;
        return (rawPaketiBaza.length - paketiBaza.length) + (rawTrupciBaza.length - trupciBaza.length) + (rawReklamacijeBaza.length - reklamacijeBaza.length);
    }, [ignorisiQaTest, rawPaketiBaza, paketiBaza, rawTrupciBaza, trupciBaza, rawReklamacijeBaza, reklamacijeBaza]);

    useEffect(() => {
        ucitajPodatke();
    }, []);

    // Kada prebacujemo tab između PROREZ i DORADA, resetuj filter mašine na SVE da ne ostane zaglavljen na pogrešnom tipu mašine
    useEffect(() => {
        setMasinaFilter('SVE');
    }, [tab]);

    const ucitajPodatke = async () => {
        setLoading(true);
        try {
            const [mRes, tRes, prRes, pkRes, dmRes, katRes, rekRes, blRes, rsRes, radRes, rnRes, ponRes, racRes] = await Promise.all([
                supabase.from('masine').select('*').order('naziv'),
                supabase.from('trupci').select('*'),
                supabase.from('prorez_log').select('*'),
                supabase.from('paketi').select('*'),
                supabase.from('dnevnik_masine').select('*'),
                supabase.from('katalog_proizvoda').select('*'),
                supabase.from('reklamacije').select('*'),
                supabase.from('blagajna').select('*'),
                supabase.from('radni_sati').select('*'),
                supabase.from('radnici').select('id, ime_prezime, uloga, bruto_satnica, godisnji_ukupno, preostalo_godisnjeg'),
                supabase.from('radni_nalozi').select('*').order('datum', { ascending: false }),
                supabase.from('ponude').select('id, kupac_naziv, ukupno_sa_pdv, ukupno_bez_pdv, valuta, stavke_jsonb'),
                supabase.from('racuni').select('id, broj_veze, kupac_naziv, ukupno_sa_pdv, ukupno_bez_pdv, valuta, status')
            ]);

            setMasineBaza(mRes.data || []);
            setTrupciBaza(tRes.data || []);
            setProrezLogBaza(prRes.data || []);
            setPaketiBaza(pkRes.data || []);
            setDnevnikMasineBaza(dmRes.data || []);
            setKatalogBaza(katRes.data || []);
            setReklamacijeBaza(rekRes.data || []);
            setBlagajnaBaza(blRes.data || []);
            setRadniSatiBaza(rsRes.data || []);
            setRadniciBaza(radRes.data || []);
            setRadniNaloziBaza(rnRes.data || []);
            setPonudeBaza(ponRes.data || []);
            setRacuniBaza(racRes.data || []);
        } catch (e) {
            console.error("Greška pri učitavanju analitike:", e);
            toast.error("Greška pri učitavanju podataka analitike.");
        }
        setLoading(false);
    };

    const postaviBrziPeriod = (tip) => {
        const d = new Date();
        const danasStr = toLocalIso(d);
        if (tip === 'DANAS') {
            setModVremena('DAN');
            setDatumOd(danasStr);
            setDatumDo(danasStr);
        } else if (tip === '7DANA') {
            const prije7 = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6);
            setModVremena('PERIOD');
            setDatumOd(toLocalIso(prije7));
            setDatumDo(danasStr);
        } else if (tip === 'OVAJ_MJ') {
            setModVremena('PERIOD');
            setDatumOd(`${danasStr.substring(0, 7)}-01`);
            setDatumDo(danasStr);
        } else if (tip === 'SVE') {
            setModVremena('PERIOD');
            setDatumOd('2025-01-01');
            setDatumDo(`${d.getFullYear()}-12-31`);
        }
    };

    const rawDo = modVremena === 'DAN' ? datumOd : datumDo;
    const efektivniOd = rawDo && datumOd > rawDo ? rawDo : datumOd;
    const efektivniDo = rawDo && datumOd > rawDo ? datumOd : rawDo;

    const uOpseguDatuma = (datumStr, createdAtStr) => {
        let d = (datumStr || '').split('T')[0];
        if (!d && createdAtStr) d = toLocalIso(new Date(createdAtStr));
        if (!d) return false;
        return d >= efektivniOd && d <= efektivniDo;
    };

    // Mašine za dropdown filter zavisno od taba
    const masineZaDropdown = useMemo(() => {
        if (tab === 'PROREZ') {
            return masineBaza.filter(m => {
                const mod = (m.dozvoljeni_moduli || '').toLowerCase();
                return !mod || mod.includes('prorez') || mod.includes('pilana') || m.naziv.toUpperCase().includes('BRENTA') || m.naziv.toUpperCase().includes('PILANA');
            });
        }
        if (tab === 'DORADA') {
            return masineBaza.filter(m => {
                const mod = (m.dozvoljeni_moduli || '').toLowerCase();
                return !mod || mod.includes('dorada') || (!m.naziv.toUpperCase().includes('BRENTA') && !m.naziv.toUpperCase().includes('PILANA'));
            });
        }
        return masineBaza;
    }, [masineBaza, tab]);

    const daLiMasinaOdgovaraProrezu = (masinaIme, filterIme) => {
        if (!filterIme || filterIme === 'SVE') return true;
        const m = (masinaIme || '').toUpperCase().trim();
        const f = filterIme.toUpperCase().trim();
        if (m === f) return true;
        // Poveznica BRENTA 1 <-> PILANA 1
        const fAlt = f.includes('BRENTA') ? f.replace('BRENTA', 'PILANA') : f.replace('PILANA', 'BRENTA');
        return m === fAlt || (m === 'PILANA' && f.includes('BRENTA'));
    };

    // ========================================================================
    // 1. ANALITIKA PROREZA (TRUPCI -> IZLAZ PILANE)
    // ========================================================================
    const analitikaProrez = useMemo(() => {
        const logoviProreza = prorezLogBaza.filter(l => {
            if (!uOpseguDatuma(l.datum, l.created_at)) return false;
            return daLiMasinaOdgovaraProrezu(l.masina, masinaFilter);
        });

        // Poveži sa trupcima (koristi kontrolnu zapreminu ako postoji!)
        const trupciMap = new Map(trupciBaza.map(t => [t.id, t]));

        let izrezanoM3 = 0;
        const poDuzinamaMap = {};

        logoviProreza.forEach(l => {
            const tr = trupciMap.get(l.trupac_id);
            const vol = parseFloat(tr?.kontrolna_zapremina || l.zapremina || tr?.zapremina || 0);
            const duz = parseFloat(tr?.kontrolna_duzina || tr?.duzina || 4);
            izrezanoM3 += vol;

            const kljucDuz = `${duz} m`;
            if (!poDuzinamaMap[kljucDuz]) poDuzinamaMap[kljucDuz] = { duzina: kljucDuz, komada: 0, m3: 0 };
            poDuzinamaMap[kljucDuz].komada += 1;
            poDuzinamaMap[kljucDuz].m3 += vol;
        });

        // Paketi proizvedeni na Pilani u istom periodu (bez preklapanja sa Dorada mašinama!)
        const paketiPilanaSirovi = paketiBaza.filter(p => {
            if (parseFloat(p.kolicina_final || 0) <= 0) return false;
            const m = (p.masina || '').toUpperCase();
            const imaSirovinu = Array.isArray(p.ai_sirovina_ids) ? p.ai_sirovina_ids.length > 0 : (typeof p.ai_sirovina_ids === 'string' && p.ai_sirovina_ids.replace(/[{}"[\]\s]/g, '').length > 0);
            const jePilana = (m.includes('PILANA') || m.includes('BRENTA') || m === '') && !imaSirovinu;
            if (!jePilana) return false;
            if (!uOpseguDatuma(p.datum_yyyy_mm || p.datum, p.created_at)) return false;
            return daLiMasinaOdgovaraProrezu(p.masina, masinaFilter);
        });

        // 🟢 DEDUPLIKACIJA I TAČAN OBRAČUN PAKETA (Sprječava dupliranje paketa 57 na 0.93 m3 umjesto 0.48 m3!)
        const grupisaniPaketiMap = {};
        paketiPilanaSirovi.forEach(p => {
            const pId = p.paket_id || p.id;
            const dimStr = `${p.debljina}x${p.sirina}x${p.duzina}`;
            const kljuc = `${pId}_${dimStr}_${p.naziv_proizvoda}`;
            const tacanM3 = izracunajTacanVolumenStavkePaketa(p);
            const tacnoKom = izracunajKomadeStavkePaketa(p);
            const jmUnos = (p.jm || 'kom').toLowerCase();
            const ulazVal = parseFloat(p.kolicina_ulaz ?? p.komada ?? 0);

            if (!grupisaniPaketiMap[kljuc]) {
                grupisaniPaketiMap[kljuc] = {
                    paket_id: pId,
                    naziv_proizvoda: p.naziv_proizvoda || 'Rezana Građa',
                    dimenzije: `${dimStr} cm`,
                    debljina: p.debljina,
                    sirina: p.sirina,
                    duzina: p.duzina,
                    komada: tacnoKom,
                    dijeloviKolicine: [`${ulazVal} ${jmUnos}`],
                    jediniceSet: new Set([jmUnos]),
                    m3: tacanM3,
                    datum: (p.datum_yyyy_mm || p.datum || p.created_at || '').split('T')[0],
                    brentista: p.brentista || '-',
                    masina: p.masina || 'PILANA'
                };
            } else {
                grupisaniPaketiMap[kljuc].komada += tacnoKom;
                grupisaniPaketiMap[kljuc].dijeloviKolicine.push(`${ulazVal} ${jmUnos}`);
                grupisaniPaketiMap[kljuc].jediniceSet.add(jmUnos);
                grupisaniPaketiMap[kljuc].m3 += tacanM3;
            }
        });

        const cistiPaketiPilane = Object.values(grupisaniPaketiMap).map(g => ({
            ...g,
            prikazKolicine: g.jediniceSet.size > 1 ? g.dijeloviKolicine.join(' + ') : `${g.komada} kom`
        }));

        const proizvedenoM3 = cistiPaketiPilane.reduce((s, p) => s + p.m3, 0);
        const yieldProc = izrezanoM3 > 0 ? ((proizvedenoM3 / izrezanoM3) * 100) : 0;

        // Zastoji i radni sati mašine
        const zastojiLista = dnevnikMasineBaza.filter(d => {
            if (d.modul !== 'Prorez' && d.modul !== 'Pilana') return false;
            if (!uOpseguDatuma(d.datum, d.created_at)) return false;
            return daLiMasinaOdgovaraProrezu(d.masina, masinaFilter);
        });
        const ukupnoZastojaMin = zastojiLista.reduce((s, z) => s + Math.max(0, parseInt(z.zastoj_min || 0)), 0);
        const efektivniSati = Math.max(1, (logoviProreza.length * 0.15) - (ukupnoZastojaMin / 60));
        const brzinaM3Sat = izrezanoM3 > 0 ? (izrezanoM3 / efektivniSati) : 0;

        // Dnevni grafikon za Prorez (poštuje masinaFilter!)
        const poDanimaMap = {};
        logoviProreza.forEach(l => {
            const d = (l.datum || l.created_at || '').split('T')[0];
            if (!d) return;
            if (!poDanimaMap[d]) poDanimaMap[d] = { datum: d.substring(5), ulazM3: 0, izlazM3: 0 };
            const tr = trupciMap.get(l.trupac_id);
            poDanimaMap[d].ulazM3 += parseFloat(tr?.kontrolna_zapremina || l.zapremina || tr?.zapremina || 0);
        });
        cistiPaketiPilane.forEach(p => {
            const d = p.datum;
            if (!d) return;
            if (!poDanimaMap[d]) poDanimaMap[d] = { datum: d.substring(5), ulazM3: 0, izlazM3: 0 };
            poDanimaMap[d].izlazM3 += p.m3;
        });

        const chartData = Object.keys(poDanimaMap).sort().map(k => ({
            datum: poDanimaMap[k].datum,
            Ulaz_Trupci: parseFloat(poDanimaMap[k].ulazM3.toFixed(3)),
            Izlaz_Daska: parseFloat(poDanimaMap[k].izlazM3.toFixed(3))
        }));

        return {
            izrezanoM3,
            brojTrupaca: logoviProreza.length,
            proizvedenoM3,
            brojPaketa: cistiPaketiPilane.length,
            yieldProc,
            ukupnoZastojaMin,
            brzinaM3Sat,
            trupciPoDuzinama: Object.values(poDuzinamaMap),
            gotovaRobaLista: cistiPaketiPilane,
            chartData
        };
    }, [prorezLogBaza, trupciBaza, paketiBaza, dnevnikMasineBaza, efektivniOd, efektivniDo, masinaFilter]);

    // ========================================================================
    // 2. ANALITIKA DORADE (ULAZ PAKETA -> IZLAZ DORADE + GRAFIKON PRATI FILTER MAŠINE!)
    // ========================================================================
    const analitikaDorada = useMemo(() => {
        const paketiDorade = paketiBaza.filter(p => {
            if (parseFloat(p.kolicina_final || 0) <= 0) return false;
            const m = (p.masina || '').toUpperCase();
            const imaSirovinu = Array.isArray(p.ai_sirovina_ids) ? p.ai_sirovina_ids.length > 0 : (typeof p.ai_sirovina_ids === 'string' && p.ai_sirovina_ids.replace(/[{}"[\]\s]/g, '').length > 0);
            const jeDorada = (!m.includes('PILANA') && !m.includes('BRENTA') && m !== '') || imaSirovinu;
            if (!jeDorada) return false;
            if (!uOpseguDatuma(p.datum_yyyy_mm || p.datum, p.created_at)) return false;
            if (masinaFilter !== 'SVE' && m !== masinaFilter.toUpperCase().trim()) return false;
            return true;
        });

        const sveStavkePaketaMap = new Map();
        paketiBaza.forEach(p => {
            const pid = p.paket_id;
            if (!sveStavkePaketaMap.has(pid)) sveStavkePaketaMap.set(pid, 0);
            sveStavkePaketaMap.set(pid, sveStavkePaketaMap.get(pid) + izracunajTacanVolumenStavkePaketa(p));
        });

        let izlazDoradaM3 = 0;
        const ulazniPaketiSet = new Set();
        const poDanimaDoradaMap = {};
        const izlazPoUlazuMap = {};

        const sljedivostLista = paketiDorade.map(p => {
            const m3Izlaz = izracunajTacanVolumenStavkePaketa(p);
            const komIzlaz = izracunajKomadeStavkePaketa(p);
            izlazDoradaM3 += m3Izlaz;

            const d = (p.datum_yyyy_mm || p.datum || p.created_at || '').split('T')[0];
            if (d) {
                if (!poDanimaDoradaMap[d]) poDanimaDoradaMap[d] = { datum: d.substring(5), ulazM3: 0, izlazM3: 0 };
                poDanimaDoradaMap[d].izlazM3 += m3Izlaz;
            }

            let ulazIds = [];
            if (Array.isArray(p.ai_sirovina_ids)) ulazIds = p.ai_sirovina_ids;
            else if (typeof p.ai_sirovina_ids === 'string' && p.ai_sirovina_ids.trim()) ulazIds = p.ai_sirovina_ids.split(',').map(x => x.trim());

            ulazIds.forEach(uid => {
                const cistUid = (uid || '').trim();
                if (!cistUid) return;
                if (!ulazniPaketiSet.has(cistUid)) {
                    ulazniPaketiSet.add(cistUid);
                    const volUlaza = sveStavkePaketaMap.get(cistUid) || 0;
                    if (d && poDanimaDoradaMap[d]) {
                        poDanimaDoradaMap[d].ulazM3 += volUlaza;
                    }
                }
            });

            const kljucGrupe = `${p.masina}_${ulazIds.map(x => x.trim()).filter(Boolean).sort().join(',')}`;
            if (!izlazPoUlazuMap[kljucGrupe]) {
                let ulM3 = 0;
                ulazIds.forEach(id => { ulM3 += (sveStavkePaketaMap.get((id || '').trim()) || 0); });
                izlazPoUlazuMap[kljucGrupe] = { ulaz: ulM3, izlaz: 0 };
            }
            izlazPoUlazuMap[kljucGrupe].izlaz += m3Izlaz;

            return {
                paket_id: p.paket_id,
                naziv: p.naziv_proizvoda,
                dimenzije: `${p.debljina}x${p.sirina}x${p.duzina} cm`,
                komada: komIzlaz,
                izlazM3: m3Izlaz,
                ulazniPaketi: ulazIds.join(', ') || 'Bez veze',
                masina: p.masina || '-',
                datum: d
            };
        });

        let ukupnoUlazSirovineM3 = 0;
        ulazniPaketiSet.forEach(uid => {
            ukupnoUlazSirovineM3 += (sveStavkePaketaMap.get(uid) || 0);
        });
        if (ukupnoUlazSirovineM3 === 0 && izlazDoradaM3 > 0) {
            ukupnoUlazSirovineM3 = parseFloat((izlazDoradaM3 * 1.18).toFixed(3));
        }

        let zbirKalaPoOperacijama = 0;
        Object.values(izlazPoUlazuMap).forEach(gr => {
            if (gr.ulaz > gr.izlaz) zbirKalaPoOperacijama += (gr.ulaz - gr.izlaz);
        });

        const stvarniKaloM3 = Math.max(0, ukupnoUlazSirovineM3 - izlazDoradaM3, zbirKalaPoOperacijama);
        const efikasnostProc = ukupnoUlazSirovineM3 > 0 ? ((izlazDoradaM3 / ukupnoUlazSirovineM3) * 100) : 0;

        const zastojiDorada = dnevnikMasineBaza.filter(d => {
            if (d.modul !== 'Dorada') return false;
            if (!uOpseguDatuma(d.datum, d.created_at)) return false;
            if (masinaFilter !== 'SVE' && (d.masina || '').toUpperCase() !== masinaFilter.toUpperCase()) return false;
            return true;
        });
        const zastojiMin = zastojiDorada.reduce((s, z) => s + Math.max(0, parseInt(z.zastoj_min || 0)), 0);

        const chartData = Object.keys(poDanimaDoradaMap).sort().map(k => ({
            datum: poDanimaDoradaMap[k].datum,
            Ulaz_Sirovina: parseFloat(poDanimaDoradaMap[k].ulazM3.toFixed(3)),
            Izlaz_Gotovo: parseFloat(poDanimaDoradaMap[k].izlazM3.toFixed(3))
        }));

        return {
            ulazSirovinaM3: ukupnoUlazSirovineM3,
            izlazGotovoM3: izlazDoradaM3,
            stvarniKaloM3,
            efikasnostProc,
            zastojiMin,
            sljedivostLista,
            chartData
        };
    }, [paketiBaza, dnevnikMasineBaza, efektivniOd, efektivniDo, masinaFilter]);
    // ========================================================================
    // 3. UKUPNI BILANS FABRIKE (MATERIJALNO)
    // ========================================================================
    const analitikaUkupno = useMemo(() => {
        const ulazTrupacaM3 = analitikaProrez.izrezanoM3;
        const proizvedenoUkupnoM3 = analitikaProrez.proizvedenoM3 + analitikaDorada.izlazGotovoM3;
        const stvarniOtpadM3 = Math.max(0, ulazTrupacaM3 - analitikaProrez.proizvedenoM3) + analitikaDorada.stvarniKaloM3;
        const efikasnostFabrike = ulazTrupacaM3 > 0 ? ((analitikaProrez.proizvedenoM3 / ulazTrupacaM3) * 100) : 0;

        // Kalo od krojenja trupaca na placu
        const majkePrekrojene = trupciBaza.filter(t => t.status === 'PREKROJENO' && uOpseguDatuma(t.datum_prijema, t.created_at));
        let kaloKrojenjaM3 = 0;
        majkePrekrojene.forEach(majka => {
            const djeca = trupciBaza.filter(d => d.parent_id === majka.id);
            const volDjece = djeca.reduce((s, d) => s + parseFloat(d.zapremina || 0), 0);
            const razlika = parseFloat(majka.zapremina || 0) - volDjece;
            if (razlika > 0) kaloKrojenjaM3 += razlika;
        });

        return {
            ulazTrupacaM3,
            proizvedenoUkupnoM3,
            stvarniOtpadM3,
            efikasnostFabrike,
            kaloKrojenjaM3
        };
    }, [analitikaProrez, analitikaDorada, trupciBaza, efektivniOd, efektivniDo]);

    // ========================================================================
    // 4. FINANSIJSKA ANALITIKA (TRŽIŠNA VRIJEDNOST - TROŠAK - REKLAMACIJE = PROFIT)
    // ========================================================================
    const analitikaFinansije = useMemo(() => {
        const paketiUPeriodu = paketiBaza.filter(p => uOpseguDatuma(p.datum_yyyy_mm || p.datum, p.created_at));

        let trzisnaVrijednostKM = 0;
        paketiUPeriodu.forEach(p => {
            const m3 = izracunajTacanVolumenStavkePaketa(p);
            const deb = parseFloat(p.debljina || 0);
            const sir = parseFloat(p.sirina || 0);
            const duz = parseFloat(p.duzina || 0);

            // 1. Prvo traži u katalogu tačno poklapanje po šifri ili po (nazivu + dimenzijama) ili po tačnim dimenzijama (npr. 5x3x300 -> 666 KM/m3)
            let kat = katalogBaza.find(k => k.sifra === p.sifra_proizvoda) ||
                      katalogBaza.find(k => k.naziv === p.naziv_proizvoda && parseFloat(k.visina || 0) === deb && parseFloat(k.sirina || 0) === sir && parseFloat(k.duzina || 0) === duz) ||
                      katalogBaza.find(k => parseFloat(k.visina || 0) === deb && parseFloat(k.sirina || 0) === sir && parseFloat(k.duzina || 0) === duz) ||
                      katalogBaza.find(k => k.naziv === p.naziv_proizvoda);

            let cijenaPoM3 = parseFloat(kat?.cijena || 600);
            const katJm = (kat?.default_jedinica || 'm3').toLowerCase();
            if (kat && katJm !== 'm3' && deb > 0 && sir > 0 && duz > 0) {
                const vol1Kom = (deb / 100) * (sir / 100) * (duz / 100);
                if (katJm === 'kom' && vol1Kom > 0) cijenaPoM3 = cijenaPoM3 / vol1Kom;
                else if (katJm === 'm1' && (duz / 100) > 0 && vol1Kom > 0) cijenaPoM3 = (cijenaPoM3 * (duz / 100)) / vol1Kom;
                else if (katJm === 'm2' && ((sir / 100) * (duz / 100)) > 0 && vol1Kom > 0) cijenaPoM3 = (cijenaPoM3 * (sir / 100) * (duz / 100)) / vol1Kom;
            }
            trzisnaVrijednostKM += (m3 * cijenaPoM3);
        });

        // Trošak sirovine (prorezani trupci u periodu)
        const trupciMap = new Map(trupciBaza.map(t => [t.id, t]));
        const logoviUPeriodu = prorezLogBaza.filter(l => uOpseguDatuma(l.datum, l.created_at));
        let trosakSirovineKM = 0;
        logoviUPeriodu.forEach(l => {
            const tr = trupciMap.get(l.trupac_id);
            const nabavna = parseFloat(tr?.nabavna_vrijednost || 0);
            if (nabavna > 0) {
                trosakSirovineKM += nabavna;
            } else {
                const vol = parseFloat(tr?.kontrolna_zapremina || l.zapremina || tr?.zapremina || 0);
                trosakSirovineKM += (vol * 180);
            }
        });

        // Trošak blagajne (IZLAZ u periodu — izuzima povrat po reklamaciji da se ne bi duplo oduzeo jer je u stavci 3)
        const izlazBlagajnaKM = blagajnaBaza
            .filter(b => b.tip === 'IZLAZ' && b.kategorija !== 'Povrat novca — Reklamacija' && uOpseguDatuma(b.datum, b.created_at))
            .reduce((s, b) => s + parseFloat(b.iznos || 0), 0);

        const ukupniTrosakKM = parseFloat((trosakSirovineKM + izlazBlagajnaKM).toFixed(2));

        // Udar od odobrenih reklamacija (koristi tačan dogovoreni FinIznos ako postoji, inače katalošku cijenu)
        const reklamacijeUPeriodu = reklamacijeBaza.filter(r => r.status === 'ODOBRENO' && uOpseguDatuma(null, r.created_at));
        let gubitakReklamacijeKM = 0;
        reklamacijeUPeriodu.forEach(r => {
            const finMatch = (r.napomena || '').match(/\[FinIznos:\s*([0-9.,]+)\s*(\w+)\]/i);
            if (finMatch) {
                const val = parseFloat(finMatch[1].replace(',', '.')) || 0;
                const valuta = String(finMatch[2] || 'KM').toUpperCase();
                gubitakReklamacijeKM += (valuta === 'EUR' || valuta === '€') ? val * 1.95583 : val;
            } else {
                const kat = katalogBaza.find(k => k.naziv === r.naziv_proizvoda || k.sifra === r.naziv_proizvoda);
                const cijena = parseFloat(kat?.cijena || 600);
                gubitakReklamacijeKM += (parseFloat(r.kolicina || 0) * cijena);
            }
        });

        const tvZaokruzeno = parseFloat(trzisnaVrijednostKM.toFixed(2));
        const rekZaokruzeno = parseFloat(gubitakReklamacijeKM.toFixed(2));
        const cistiProfitKM = parseFloat((tvZaokruzeno - ukupniTrosakKM - rekZaokruzeno).toFixed(2));

        return {
            trzisnaVrijednostKM: tvZaokruzeno,
            ukupniTrosakKM,
            trosakSirovineKM: parseFloat(trosakSirovineKM.toFixed(2)),
            izlazBlagajnaKM: parseFloat(izlazBlagajnaKM.toFixed(2)),
            gubitakReklamacijeKM: rekZaokruzeno,
            cistiProfitKM
        };
    }, [paketiBaza, katalogBaza, prorezLogBaza, trupciBaza, blagajnaBaza, reklamacijeBaza, efektivniOd, efektivniDo]);

    // =========================================================================
    // 5. JOB COSTING — PROFIT PO RADNOM NALOGU (RN)
    // =========================================================================
    const analitikaProfitPoNalogu = useMemo(() => {
        const trupciMap = new Map(trupciBaza.map((t) => [t.id, t]));
        const ponudeMap = new Map(ponudeBaza.map((p) => [p.id, p]));
        const satnice = radniciBaza.map((r) => parseFloat(r.bruto_satnica || 0)).filter((v) => v > 0);
        const prosjecnaSatnicaKM = satnice.length > 0 ? satnice.reduce((s, v) => s + v, 0) / satnice.length : 12;

        const naloziUPeriodu = radniNaloziBaza.filter((rn) => uOpseguDatuma(rn.datum, rn.created_at));

        const redovi = naloziUPeriodu.map((rn) => {
            const vezaniPaketi = paketiBaza.filter((p) => p.rn_id === rn.id || p.broj_veze === rn.id);
            const proizvedenoM3 = vezaniPaketi.reduce((s, p) => s + izracunajTacanVolumenStavkePaketa(p), 0);

            let prihodKM = 0;
            let izvorPrihoda = 'Katalog';
            const vezanaPonuda = rn.ponuda_id ? ponudeMap.get(rn.ponuda_id) : null;
            const vezaniRacun = racuniBaza.find((r) => r.broj_veze === rn.id || (rn.ponuda_id && r.broj_veze === rn.ponuda_id));

            if (vezaniRacun && parseFloat(vezaniRacun.ukupno_bez_pdv || vezaniRacun.ukupno_sa_pdv || 0) > 0) {
                const raw = parseFloat(vezaniRacun.ukupno_bez_pdv || vezaniRacun.ukupno_sa_pdv || 0);
                prihodKM = String(vezaniRacun.valuta || 'KM').toUpperCase() === 'EUR' ? raw * 1.95583 : raw;
                izvorPrihoda = `Račun ${vezaniRacun.id}`;
            } else if (vezanaPonuda && parseFloat(vezanaPonuda.ukupno_bez_pdv || vezanaPonuda.ukupno_sa_pdv || 0) > 0) {
                const raw = parseFloat(vezanaPonuda.ukupno_bez_pdv || vezanaPonuda.ukupno_sa_pdv || 0);
                prihodKM = String(vezanaPonuda.valuta || 'KM').toUpperCase() === 'EUR' ? raw * 1.95583 : raw;
                izvorPrihoda = `Ponuda ${vezanaPonuda.id}`;
            } else {
                vezaniPaketi.forEach((p) => {
                    const m3 = izracunajTacanVolumenStavkePaketa(p);
                    const kat = katalogBaza.find((k) => k.naziv === p.naziv_proizvoda || k.sifra === p.naziv_proizvoda);
                    const cijena = parseFloat(kat?.cijena || 580);
                    prihodKM += m3 * cijena;
                });
                if (prihodKM === 0 && Array.isArray(rn.stavke_jsonb)) {
                    rn.stavke_jsonb.forEach((st) => {
                        const kat = katalogBaza.find((k) => k.sifra === st.sifra || k.naziv === st.naziv);
                        const kol = parseFloat(st.kolicina_obracun || st.kolicina || 0);
                        prihodKM += kol * parseFloat(kat?.cijena || 580);
                    });
                    if (prihodKM > 0) izvorPrihoda = 'Plan RN';
                }
            }

            const trupciIds = new Set();
            vezaniPaketi.forEach((p) => {
                if (Array.isArray(p.ulaz_trupci_ids)) p.ulaz_trupci_ids.forEach((tid) => trupciIds.add(tid));
            });

            let trosakSirovineKM = 0;
            if (trupciIds.size > 0) {
                trupciIds.forEach((tid) => {
                    const tr = trupciMap.get(tid);
                    const nab = parseFloat(tr?.nabavna_vrijednost || 0);
                    if (nab > 0) trosakSirovineKM += nab;
                    else trosakSirovineKM += (parseFloat(tr?.kontrolna_zapremina || tr?.zapremina || 0) * 185);
                });
            } else if (proizvedenoM3 > 0) {
                trosakSirovineKM = (proizvedenoM3 / 0.62) * 185;
            }

            const trosakRadaKM = proizvedenoM3 > 0 ? proizvedenoM3 * 1.6 * prosjecnaSatnicaKM : 0;

            const paketIdsSet = new Set(vezaniPaketi.map((p) => p.paket_id));
            let trosakReklamacijaKM = 0;
            reklamacijeBaza
                .filter((r) => r.status === 'ODOBRENO' && paketIdsSet.has(r.paket_id))
                .forEach((r) => {
                    const finMatch = (r.napomena || '').match(/\[FinIznos:\s*([0-9.,]+)\s*(\w+)\]/i);
                    if (finMatch) {
                        const val = parseFloat(finMatch[1].replace(',', '.')) || 0;
                        const valuta = String(finMatch[2] || 'KM').toUpperCase();
                        trosakReklamacijaKM += (valuta === 'EUR' || valuta === '€') ? val * 1.95583 : val;
                    } else {
                        trosakReklamacijaKM += parseFloat(r.kolicina || 0) * 580;
                    }
                });

            const ukupniTrosakKM = trosakSirovineKM + trosakRadaKM + trosakReklamacijaKM;
            const netoProfitKM = prihodKM - ukupniTrosakKM;
            const marzaProc = prihodKM > 0 ? (netoProfitKM / prihodKM) * 100 : 0;

            return {
                rn_id: rn.id,
                kupac: rn.kupac_naziv || 'Nepoznat kupac',
                datum: rn.datum || '',
                status: rn.status || 'U TOKU',
                izvorPrihoda,
                proizvedenoM3: parseFloat(proizvedenoM3.toFixed(3)),
                prihodKM: parseFloat(prihodKM.toFixed(2)),
                trosakSirovineKM: parseFloat(trosakSirovineKM.toFixed(2)),
                trosakRadaKM: parseFloat(trosakRadaKM.toFixed(2)),
                trosakReklamacijaKM: parseFloat(trosakReklamacijaKM.toFixed(2)),
                ukupniTrosakKM: parseFloat(ukupniTrosakKM.toFixed(2)),
                netoProfitKM: parseFloat(netoProfitKM.toFixed(2)),
                marzaProc: parseFloat(marzaProc.toFixed(1)),
            };
        }).sort((a, b) => b.netoProfitKM - a.netoProfitKM);

        const ukupnoPrihod = redovi.reduce((s, r) => s + r.prihodKM, 0);
        const ukupnoTrosak = redovi.reduce((s, r) => s + r.ukupniTrosakKM, 0);
        const ukupnoProfit = redovi.reduce((s, r) => s + r.netoProfitKM, 0);
        const prosjecnaMarza = ukupnoPrihod > 0 ? (ukupnoProfit / ukupnoPrihod) * 100 : 0;
        const chartData = redovi.slice(0, 12).map((r) => ({
            nalog: r.rn_id,
            Prihod: r.prihodKM,
            Trosak: r.ukupniTrosakKM,
            Profit: r.netoProfitKM,
        }));

        return {
            redovi,
            ukupnoPrihod: parseFloat(ukupnoPrihod.toFixed(2)),
            ukupnoTrosak: parseFloat(ukupnoTrosak.toFixed(2)),
            ukupnoProfit: parseFloat(ukupnoProfit.toFixed(2)),
            prosjecnaMarza: parseFloat(prosjecnaMarza.toFixed(1)),
            chartData,
        };
    }, [radniNaloziBaza, paketiBaza, ponudeBaza, racuniBaza, trupciBaza, katalogBaza, radniciBaza, reklamacijeBaza, efektivniOd, efektivniDo]);

    const stampajIzvjestaj = () => {
        const periodTekst = `${formatDatumBHS(efektivniOd)} - ${formatDatumBHS(efektivniDo)}`;
        let html = '';

        if (tab === 'PROREZ') {
            const redovi = analitikaProrez.gotovaRobaLista.map((r, i) => `
                <tr>
                    <td>${i + 1}.</td>
                    <td><b>${escapeHtml(r.paket_id)}</b></td>
                    <td>${escapeHtml(r.naziv_proizvoda)}</td>
                    <td style="text-align:center;"><b>${escapeHtml(r.dimenzije)}</b></td>
                    <td style="text-align:center;">${escapeHtml(r.prikazKolicine || `${r.komada} kom`)}</td>
                    <td class="num">${r.m3.toFixed(3)} m³</td>
                </tr>
            `).join('');

            const chartHtml = uhvatiSmartChartSvgHtml('analitika_prorez_trend', `Dnevni Trend Proreza (${masinaFilter})`, periodTekst);

            html = `
                <div class="info-grid">
                    <div class="info-col-left"><h4>Izvještaj Proreza i Pilane</h4><h2>Period: ${escapeHtml(periodTekst)}</h2><p>Mašina: <b>${escapeHtml(masinaFilter)}</b></p></div>
                    <div class="info-col-right"><p>Izrezano Trupaca: <b>${analitikaProrez.izrezanoM3.toFixed(3)} m³ (${analitikaProrez.brojTrupaca} kom)</b></p><p>Proizvedeno Građe: <b>${analitikaProrez.proizvedenoM3.toFixed(3)} m³</b></p><p>Iskorištenost (Yield): <b>${analitikaProrez.yieldProc.toFixed(1)}%</b></p></div>
                </div>
                ${chartHtml}
                <table>
                    <thead><tr><th>#</th><th>Paket ID</th><th>Proizvod</th><th style="text-align:center;">Dimenzije (cm)</th><th style="text-align:center;">Količina</th><th class="num">Volumen (m³)</th></tr></thead>
                    <tbody>${redovi}</tbody>
                </table>
            `;
            printDokument('IZVJEŠTAJ PROREZA', `PROREZ-${efektivniOd}`, formatDatumBHS(danas), html, '#ef4444');
        } else if (tab === 'DORADA') {
            const redovi = analitikaDorada.sljedivostLista.map((r, i) => `
                <tr>
                    <td>${i + 1}.</td>
                    <td><b>${escapeHtml(r.paket_id)}</b></td>
                    <td>${escapeHtml(r.naziv)} (${escapeHtml(r.dimenzije)})</td>
                    <td>${escapeHtml(r.ulazniPaketi)}</td>
                    <td>${escapeHtml(r.masina)}</td>
                    <td class="num">${r.izlazM3.toFixed(3)} m³</td>
                </tr>
            `).join('');
            const chartHtml = uhvatiSmartChartSvgHtml('analitika_dorada_trend', `Proizvodnja Dorade (${masinaFilter})`, periodTekst);

            html = `
                <div class="info-grid">
                    <div class="info-col-left"><h4>Izvještaj Dorade</h4><h2>Period: ${escapeHtml(periodTekst)}</h2><p>Mašina: <b>${escapeHtml(masinaFilter)}</b></p></div>
                    <div class="info-col-right"><p>Ulaz Sirovine: <b>${analitikaDorada.ulazSirovinaM3.toFixed(3)} m³</b></p><p>Izlaz Gotove Robe: <b>${analitikaDorada.izlazGotovoM3.toFixed(3)} m³</b></p><p>Stvarni Kalo: <b>${analitikaDorada.stvarniKaloM3.toFixed(3)} m³</b></p></div>
                </div>
                ${chartHtml}
                <table>
                    <thead><tr><th>#</th><th>Izlazni Paket</th><th>Proizvod (cm)</th><th>Ulazna Sirovina</th><th>Mašina</th><th class="num">Izlaz (m³)</th></tr></thead>
                    <tbody>${redovi}</tbody>
                </table>
            `;
            printDokument('IZVJEŠTAJ DORADE', `DORADA-${efektivniOd}`, formatDatumBHS(danas), html, '#f59e0b');
        } else if (tab === 'UKUPNO') {
            const chartHtml = uhvatiSmartChartSvgHtml('analitika_ukupno_bilans', 'Ukupni Materijalni Bilans Fabrike (m³)', periodTekst);
            html = `
                <div class="info-grid">
                    <div class="info-col-left"><h4>Ukupni Materijalni Bilans Fabrike</h4><h2>Period: ${periodTekst}</h2></div>
                    <div class="info-col-right"><p>Efikasnost Fabrike (Yield): <b>${analitikaUkupno.efikasnostFabrike.toFixed(1)}%</b></p></div>
                </div>
                ${chartHtml}
                <table>
                    <thead><tr><th>Stavka Materijalnog Bilansa</th><th class="num">Zapremina (m³)</th></tr></thead>
                    <tbody>
                        <tr><td>Ukupan Ulaz Sirovine (Prorezani Trupci)</td><td class="num">${analitikaUkupno.ulazTrupacaM3.toFixed(3)} m³</td></tr>
                        <tr><td>Ukupno Proizvedeno (Pilana + Dorada)</td><td class="num">${analitikaUkupno.proizvedenoUkupnoM3.toFixed(3)} m³</td></tr>
                        <tr><td>Efikasnost Fabrike (Iskorištenje)</td><td class="num">${analitikaUkupno.efikasnostFabrike.toFixed(1)} %</td></tr>
                        <tr><td>Stvarni Otpad (Piljevina / Okorak / Kalo Dorade)</td><td class="num">${analitikaUkupno.stvarniOtpadM3.toFixed(3)} m³</td></tr>
                        <tr><td>Kalo od Krojenja Trupaca na Placu</td><td class="num">${analitikaUkupno.kaloKrojenjaM3.toFixed(3)} m³</td></tr>
                    </tbody>
                </table>
            `;
            printDokument('MATERIJALNI BILANS', `UKUPNO-${efektivniOd}`, formatDatumBHS(danas), html, '#3b82f6');
        } else if (tab === 'PROFIT_NALOG') {
            const chartHtml = uhvatiSmartChartSvgHtml('analitika_profit_nalog', 'Profitabilnost po Radnom Nalogu (KM)', periodTekst);
            const redoviHtml = analitikaProfitPoNalogu.redovi.map((r, i) => `
                <tr>
                    <td>${i + 1}.</td>
                    <td><b>${escapeHtml(r.rn_id)}</b></td>
                    <td>${escapeHtml(r.kupac)}</td>
                    <td class="num">${r.proizvedenoM3.toFixed(3)} m³</td>
                    <td class="num">${r.prihodKM.toFixed(2)} KM</td>
                    <td class="num">${r.ukupniTrosakKM.toFixed(2)} KM</td>
                    <td class="num"><b>${r.netoProfitKM.toFixed(2)} KM</b></td>
                    <td class="num"><b>${r.marzaProc.toFixed(1)}%</b></td>
                </tr>
            `).join('');
            html = `
                <div class="info-grid">
                    <div class="info-col-left"><h4>Profitabilnost po Radnom Nalogu (Job Costing)</h4><h2>Period: ${periodTekst}</h2></div>
                    <div class="info-col-right"><p>Ukupni Profit: <b>${analitikaProfitPoNalogu.ukupnoProfit.toFixed(2)} KM</b></p><p>Prosječna Marža: <b>${analitikaProfitPoNalogu.prosjecnaMarza.toFixed(1)}%</b></p></div>
                </div>
                ${chartHtml}
                <table>
                    <thead><tr><th>#</th><th>Radni Nalog</th><th>Kupac</th><th class="num">Proizvedeno</th><th class="num">Prihod</th><th class="num">Trošak</th><th class="num">Neto Profit</th><th class="num">Marža</th></tr></thead>
                    <tbody>${redoviHtml}</tbody>
                </table>
            `;
            printDokument('PROFIT PO NALOGU', `JOB-${efektivniOd}`, formatDatumBHS(danas), html, '#8b5cf6');
        } else {
            const chartHtml = uhvatiSmartChartSvgHtml('analitika_finansije_bilans', 'Finansijski Bilans Proizvodnje (KM)', periodTekst);
            html = `
                <div class="info-grid">
                    <div class="info-col-left"><h4>Finansijski Bilans Proizvodnje</h4><h2>Period: ${periodTekst}</h2></div>
                    <div class="info-col-right"><p>Čisti Profit: <b>${analitikaFinansije.cistiProfitKM.toFixed(2)} KM</b></p></div>
                </div>
                ${chartHtml}
                <table>
                    <thead><tr><th>Stavka Bilansa</th><th class="num">Vrijednost</th></tr></thead>
                    <tbody>
                        <tr><td>Tržišna Vrijednost Proizvedene Robe</td><td class="num">${analitikaFinansije.trzisnaVrijednostKM.toFixed(2)} KM</td></tr>
                        <tr><td>Ukupan Trošak (Sirovina + Prerada)</td><td class="num">- ${analitikaFinansije.ukupniTrosakKM.toFixed(2)} KM</td></tr>
                        <tr><td>Udar od Reklamacija (Gubitak)</td><td class="num">- ${analitikaFinansije.gubitakReklamacijeKM.toFixed(2)} KM</td></tr>
                        <tr><td><b>ČISTI PROFIT</b></td><td class="num"><b>${analitikaFinansije.cistiProfitKM.toFixed(2)} KM</b></td></tr>
                    </tbody>
                </table>
            `;
            printDokument('FINANSIJSKI IZVJEŠTAJ', `FIN-${efektivniOd}`, formatDatumBHS(danas), html, '#10b981');
        }
    };

    const izveziExcel = () => {
        const periodTekst = `${formatDatumBHS(efektivniOd)} - ${formatDatumBHS(efektivniDo)}`;
        if (tab === 'PROREZ') {
            exportToExcel({
                filename: `Analitika_Prorez_${efektivniOd}_${efektivniDo}`,
                sheetName: 'Prorez',
                title: `Izvještaj Proreza i Pilane (${periodTekst} | Mašina: ${masinaFilter})`,
                columns: [
                    { key: 'paket_id', label: 'Paket ID', width: 130 },
                    { key: 'naziv_proizvoda', label: 'Proizvod', width: 200 },
                    { key: 'dimenzije', label: 'Dimenzije (cm)', width: 120 },
                    { key: 'prikazKolicine', label: 'Količina (unesena JM)', width: 145, format: (v, r) => v || `${r.komada || 0} kom` },
                    { key: 'm3', label: 'Volumen (m³)', type: 'number', width: 110, format: (v) => parseFloat(Number(v || 0).toFixed(3)) },
                ],
                rows: analitikaProrez.gotovaRobaLista,
                summaryRow: { paket_id: 'UKUPNO', m3: parseFloat(analitikaProrez.proizvedenoM3.toFixed(3)) },
            });
        } else if (tab === 'DORADA') {
            exportToExcel({
                filename: `Analitika_Dorada_${efektivniOd}_${efektivniDo}`,
                sheetName: 'Dorada',
                title: `Izvještaj Dorade (${periodTekst} | Mašina: ${masinaFilter})`,
                columns: [
                    { key: 'paket_id', label: 'Izlazni Paket', width: 130 },
                    { key: 'naziv', label: 'Proizvod', width: 190 },
                    { key: 'dimenzije', label: 'Dimenzije (cm)', width: 115 },
                    { key: 'ulazniPaketi', label: 'Ulazna Sirovina', width: 155 },
                    { key: 'masina', label: 'Mašina', width: 120 },
                    { key: 'izlazM3', label: 'Izlaz (m³)', type: 'number', width: 110, format: (v) => parseFloat(Number(v || 0).toFixed(3)) },
                ],
                rows: analitikaDorada.sljedivostLista,
                summaryRow: { paket_id: 'UKUPNO', izlazM3: parseFloat(analitikaDorada.izlazGotovoM3.toFixed(3)) },
            });
        } else if (tab === 'UKUPNO') {
            exportToExcel({
                filename: `Analitika_MaterijalniBilans_${efektivniOd}_${efektivniDo}`,
                sheetName: 'Materijalni Bilans',
                title: `Ukupni Materijalni Bilans Fabrike (${periodTekst})`,
                columns: [
                    { key: 'stavka', label: 'Stavka Materijalnog Bilansa', width: 290 },
                    { key: 'vrijednost', label: 'Vrijednost', type: 'number', width: 120 },
                    { key: 'jm', label: 'Jedinica', width: 70 },
                ],
                rows: [
                    { stavka: 'Ukupan Ulaz Sirovine (Prorezani Trupci)', vrijednost: parseFloat(analitikaUkupno.ulazTrupacaM3.toFixed(3)), jm: 'm³' },
                    { stavka: 'Ukupno Proizvedeno (Pilana + Dorada)', vrijednost: parseFloat(analitikaUkupno.proizvedenoUkupnoM3.toFixed(3)), jm: 'm³' },
                    { stavka: 'Efikasnost Fabrike (Yield)', vrijednost: parseFloat(analitikaUkupno.efikasnostFabrike.toFixed(1)), jm: '%' },
                    { stavka: 'Stvarni Otpad (Piljevina / Okorak / Kalo Dorade)', vrijednost: parseFloat(analitikaUkupno.stvarniOtpadM3.toFixed(3)), jm: 'm³' },
                    { stavka: 'Kalo od Krojenja Trupaca na Placu', vrijednost: parseFloat(analitikaUkupno.kaloKrojenjaM3.toFixed(3)), jm: 'm³' },
                ],
            });
        } else if (tab === 'PROFIT_NALOG') {
            exportToExcel({
                filename: `Analitika_ProfitPoNalogu_${efektivniOd}_${efektivniDo}`,
                sheetName: 'Profit po Nalogu',
                title: `Job Costing — Profit po Radnom Nalogu (${periodTekst})`,
                columns: [
                    { key: 'rn_id', label: 'Radni Nalog', width: 120 },
                    { key: 'kupac', label: 'Kupac', width: 185 },
                    { key: 'datum', label: 'Datum', width: 95 },
                    { key: 'status', label: 'Status', width: 95 },
                    { key: 'proizvedenoM3', label: 'Proizvedeno (m³)', type: 'number', width: 110 },
                    { key: 'prihodKM', label: 'Prihod (KM)', type: 'number', width: 115 },
                    { key: 'trosakSirovineKM', label: 'Sirovina (KM)', type: 'number', width: 115 },
                    { key: 'trosakRadaKM', label: 'Rad (KM)', type: 'number', width: 100 },
                    { key: 'trosakReklamacijaKM', label: 'Reklamacije (KM)', type: 'number', width: 115 },
                    { key: 'netoProfitKM', label: 'Neto Profit (KM)', type: 'number', width: 125 },
                    { key: 'marzaProc', label: 'Marža (%)', type: 'number', width: 85 },
                ],
                rows: analitikaProfitPoNalogu.redovi,
                summaryRow: {
                    rn_id: 'UKUPNO',
                    prihodKM: analitikaProfitPoNalogu.ukupnoPrihod,
                    netoProfitKM: analitikaProfitPoNalogu.ukupnoProfit,
                    marzaProc: analitikaProfitPoNalogu.prosjecnaMarza,
                },
            });
        } else {
            exportToExcel({
                filename: `Analitika_Finansije_${efektivniOd}_${efektivniDo}`,
                sheetName: 'Finansijski Bilans',
                title: `Finansijski Bilans Proizvodnje (${periodTekst})`,
                columns: [
                    { key: 'stavka', label: 'Stavka Bilansa', width: 280 },
                    { key: 'iznos', label: 'Iznos (KM)', type: 'number', width: 130 },
                ],
                rows: [
                    { stavka: 'Tržišna Vrijednost Proizvedene Robe', iznos: analitikaFinansije.trzisnaVrijednostKM },
                    { stavka: 'Trošak Sirovine (Prorezani Trupci)', iznos: -analitikaFinansije.trosakSirovineKM },
                    { stavka: 'Trošak Blagajne / Prerade', iznos: -analitikaFinansije.izlazBlagajnaKM },
                    { stavka: 'Udar od Reklamacija (Gubitak)', iznos: -analitikaFinansije.gubitakReklamacijeKM },
                ],
                summaryRow: { stavka: 'ČISTI PROFIT', iznos: analitikaFinansije.cistiProfitKM },
            });
        }
    };

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6 font-bold animate-in fade-in pb-24" style={{ color: saas.ui.boja_slova || undefined }}>
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-blue-500" user={user} modulIme="analitika" saas={saas} hideMasina={true} />

            {/* GLAVNI TABOVI ANALITIKE */}
            <div className="flex flex-wrap bg-theme-panel p-1.5 rounded-2xl border border-theme-border shadow-inner gap-1">
                <button onClick={() => setTab('PROREZ')} className={`flex-1 min-w-[120px] py-3 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-1.5 ${tab === 'PROREZ' ? 'bg-red-600 text-white shadow-lg' : 'text-theme-muted hover:text-theme-text'}`}>🪚 PROREZ</button>
                <button onClick={() => setTab('DORADA')} className={`flex-1 min-w-[120px] py-3 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-1.5 ${tab === 'DORADA' ? 'bg-amber-600 text-white shadow-lg' : 'text-theme-muted hover:text-theme-text'}`}>🔄 DORADA</button>
                <button onClick={() => setTab('UKUPNO')} className={`flex-1 min-w-[115px] py-3 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-1.5 ${tab === 'UKUPNO' ? 'bg-blue-600 text-white shadow-lg' : 'text-theme-muted hover:text-theme-text'}`}>📊 UKUPNO</button>
                <button onClick={() => setTab('FINANSIJE')} className={`flex-1 min-w-[115px] py-3 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-1.5 ${tab === 'FINANSIJE' ? 'bg-emerald-600 text-white shadow-lg' : 'text-theme-muted hover:text-theme-text'}`}>💰 FINANSIJE</button>
                <button data-testid="analitika-tab-profit-nalog" onClick={() => setTab('PROFIT_NALOG')} className={`flex-1 min-w-[135px] py-3 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-1.5 ${tab === 'PROFIT_NALOG' ? 'bg-purple-600 text-white shadow-lg' : 'text-purple-400 hover:bg-purple-950/30'}`}>💎 PROFIT PO NALOGU</button>
                <button onClick={() => setTab('AI')} className={`flex-1 min-w-[130px] py-3 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-1.5 ${tab === 'AI' ? 'bg-indigo-600 text-white shadow-lg' : 'text-indigo-400 hover:bg-indigo-950/30'}`}>🤖 AI KONTROLOR</button>
            </div>

            {/* FILTER TRAKA (Prikazuje se za sve tabove osim AI Kontrolora) */}
            {tab !== 'AI' && (
                <div className="bg-theme-card p-4 rounded-2xl border border-theme-border shadow-xl flex flex-col lg:flex-row justify-between items-center gap-4">
                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                        <div className="flex bg-theme-panel p-1 rounded-xl border border-theme-border">
                            <button onClick={() => setModVremena('DAN')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ${modVremena === 'DAN' ? 'bg-theme-accent text-white' : 'text-slate-400'}`}>Dan</button>
                            <button onClick={() => setModVremena('PERIOD')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ${modVremena === 'PERIOD' ? 'bg-theme-accent text-white' : 'text-slate-400'}`}>Period</button>
                        </div>

                        <DatumInput data-testid="analitika-datum-od" value={datumOd} onChange={e => setDatumOd(e.target.value)} />
                        {modVremena === 'PERIOD' && (
                            <>
                                <span className="text-slate-500 font-black">→</span>
                                <DatumInput data-testid="analitika-datum-do" value={datumDo} onChange={e => setDatumDo(e.target.value)} />
                            </>
                        )}

                        <div className="flex gap-1">
                            <button onClick={() => postaviBrziPeriod('DANAS')} className="px-2.5 py-2 bg-theme-panel hover:bg-slate-700 text-slate-300 rounded-lg text-[9px] font-black uppercase border border-theme-border">Danas</button>
                            <button onClick={() => postaviBrziPeriod('7DANA')} className="px-2.5 py-2 bg-theme-panel hover:bg-slate-700 text-slate-300 rounded-lg text-[9px] font-black uppercase border border-theme-border">7 Dana</button>
                            <button onClick={() => postaviBrziPeriod('OVAJ_MJ')} className="px-2.5 py-2 bg-theme-panel hover:bg-slate-700 text-slate-300 rounded-lg text-[9px] font-black uppercase border border-theme-border">Ovaj Mj</button>
                            <button onClick={() => postaviBrziPeriod('SVE')} className="px-2.5 py-2 bg-theme-panel hover:bg-slate-700 text-amber-400 rounded-lg text-[9px] font-black uppercase border border-amber-500/30">Sve</button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                        <button
                            type="button"
                            data-testid="analitika-qa-toggle"
                            onClick={() => setIgnorisiQaTest((v) => !v)}
                            title="Automatski isključuje QA/testne zapise (QA*, E2E*, TEST-*) radi realne statistike i Yield-a"
                            className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase border transition-all flex items-center gap-1.5 ${
                                ignorisiQaTest
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                                    : 'bg-theme-panel text-theme-muted border-theme-border hover:text-theme-text'
                            }`}
                        >
                            🧹 {ignorisiQaTest ? `Bez QA testa${brojSkrivenihQa > 0 ? ` (-${brojSkrivenihQa})` : ''}` : 'Uključeni i QA testovi'}
                        </button>
                        {(tab === 'PROREZ' || tab === 'DORADA') && (
                            <select value={masinaFilter} onChange={e => setMasinaFilter(e.target.value)} className="p-2.5 bg-theme-panel border border-theme-border rounded-xl text-xs text-theme-text font-black uppercase outline-none cursor-pointer">
                                <option value="SVE">Sve Mašine ({tab})</option>
                                {masineZaDropdown.map(m => <option key={m.id} value={m.naziv}>{m.naziv}</option>)}
                            </select>
                        )}
                        <button type="button" data-testid="analitika-excel-btn" onClick={izveziExcel} className="px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/40 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 shadow-md">
                            📊 Excel
                        </button>
                        <button onClick={stampajIzvjestaj} className="px-4 py-2.5 bg-theme-panel hover:bg-white hover:text-black text-theme-text border border-slate-600 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 shadow-md">
                            <Printer size={14} /> 🖨️ Isprintaj PDF
                        </button>
                    </div>
                </div>
            )}

            {/* TAB 1: PROREZ */}
            {tab === 'PROREZ' && (
                <div className="space-y-6 animate-in slide-in-from-left">
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="bg-theme-card p-5 rounded-2xl border border-red-500/30 shadow-xl">
                            <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Izrezano Trupaca (Ulaz)</span>
                            <p className="text-2xl font-black text-red-400">{analitikaProrez.izrezanoM3.toFixed(3)} <span className="text-xs">m³</span></p>
                            <span className="text-[10px] text-slate-500 font-bold">{analitikaProrez.brojTrupaca} kom trupaca</span>
                        </div>
                        <div className="bg-theme-card p-5 rounded-2xl border border-emerald-500/30 shadow-xl">
                            <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Proizvedeno (Izlaz Pilana)</span>
                            <p className="text-2xl font-black text-emerald-400">{analitikaProrez.proizvedenoM3.toFixed(3)} <span className="text-xs">m³</span></p>
                            <span className="text-[10px] text-slate-500 font-bold">{analitikaProrez.brojPaketa} paketa</span>
                        </div>
                        <div className="bg-theme-card p-5 rounded-2xl border border-blue-500/30 shadow-xl">
                            <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Iskorištenost (Yield)</span>
                            <p className="text-2xl font-black text-blue-400">{analitikaProrez.yieldProc.toFixed(1)}%</p>
                            <span className="text-[10px] text-slate-500 font-bold">Prinos daske iz trupca</span>
                        </div>
                        <div className="bg-theme-card p-5 rounded-2xl border border-amber-500/30 shadow-xl">
                            <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Brzina Rezanja</span>
                            <p className="text-2xl font-black text-amber-400">{analitikaProrez.brzinaM3Sat.toFixed(2)} <span className="text-xs">m³/h</span></p>
                            <span className="text-[10px] text-slate-500 font-bold">Prosjek aktivnog rada</span>
                        </div>
                        <div className="bg-theme-card p-5 rounded-2xl border border-theme-border shadow-xl col-span-2 lg:col-span-1">
                            <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Zastoji Mašine</span>
                            <p className="text-2xl font-black text-theme-text">{analitikaProrez.ukupnoZastojaMin} <span className="text-xs text-red-400">min</span></p>
                            <span className="text-[10px] text-slate-500 font-bold">Evidentirano u dnevniku</span>
                        </div>
                    </div>

                    {/* GRAFIKON PROREZA — SMARTCHART STUDIO */}
                    <div className="bg-theme-card p-6 rounded-2xl border border-theme-border shadow-2xl">
                        <SmartChart
                            chartId="analitika_prorez_trend"
                            title={`📈 Dnevni Trend Proreza (${masinaFilter})`}
                            subtitle="Odaberi tip dijagrama, metrike ili stavke — automatski se printa u izvještaju"
                            data={analitikaProrez.chartData}
                            xKey="datum"
                            series={[
                                { key: 'Ulaz_Trupci', name: 'Ulaz Trupci', color: '#ef4444', unit: 'm³' },
                                { key: 'Izlaz_Daska', name: 'Izlaz Građa', color: '#10b981', unit: 'm³' },
                            ]}
                            defaultType="area"
                            unit="m³"
                            height={280}
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-4 bg-theme-card p-6 rounded-2xl border border-theme-border shadow-xl">
                            <h3 className="text-xs font-black uppercase text-red-400 mb-4">🪵 Trupci po dužinama</h3>
                            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                                {analitikaProrez.trupciPoDuzinama.length === 0 && <p className="text-xs text-slate-500 italic py-6 text-center">Nema prorezanih trupaca u ovom periodu.</p>}
                                {analitikaProrez.trupciPoDuzinama.map((td, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-theme-panel rounded-xl border border-theme-border text-xs">
                                        <span className="font-black text-theme-text">Dužina: {td.duzina}</span>
                                        <span className="text-slate-400">{td.komada} kom</span>
                                        <span className="font-black text-red-400">{td.m3.toFixed(3)} m³</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="lg:col-span-8 bg-theme-card p-6 rounded-2xl border border-theme-border shadow-xl">
                            <h3 className="text-xs font-black uppercase text-emerald-400 mb-4">📦 Proizvedeno na Pilani (Dimenzije u cm)</h3>
                            <div className="overflow-x-auto max-h-80 custom-scrollbar">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-theme-panel text-slate-400 uppercase text-[10px]">
                                        <tr>
                                            <th className="p-3">Paket ID</th>
                                            <th className="p-3">Proizvod</th>
                                            <th className="p-3 text-center">Dimenzije (cm)</th>
                                            <th className="p-3 text-center">Količina</th>
                                            <th className="p-3 text-right">Volumen (m³)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-theme-border">
                                        {analitikaProrez.gotovaRobaLista.length === 0 && (
                                            <tr><td colSpan="5" className="p-6 text-center text-slate-500 italic">Nema proizvedenih paketa u ovom periodu.</td></tr>
                                        )}
                                        {analitikaProrez.gotovaRobaLista.map((p, i) => (
                                            <tr key={i} className="hover:bg-theme-panel/50">
                                                <td className="p-3 font-black text-theme-accent">{p.paket_id}</td>
                                                <td className="p-3 font-bold text-theme-text">{p.naziv_proizvoda}</td>
                                                <td className="p-3 text-center font-mono text-amber-400 font-black">{p.dimenzije}</td>
                                                <td className="p-3 text-center text-slate-300">{p.prikazKolicine || `${p.komada} kom`}</td>
                                                <td className="p-3 text-right font-black text-emerald-400">{p.m3.toFixed(3)} m³</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: DORADA */}
            {tab === 'DORADA' && (
                <div className="space-y-6 animate-in slide-in-from-right">
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="bg-theme-card p-5 rounded-2xl border border-amber-500/30 shadow-xl">
                            <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Ulaz Sirovina</span>
                            <p className="text-2xl font-black text-amber-400">{analitikaDorada.ulazSirovinaM3.toFixed(3)} <span className="text-xs">m³</span></p>
                        </div>
                        <div className="bg-theme-card p-5 rounded-2xl border border-emerald-500/30 shadow-xl">
                            <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Izlaz Gotove Robe</span>
                            <p className="text-2xl font-black text-emerald-400">{analitikaDorada.izlazGotovoM3.toFixed(3)} <span className="text-xs">m³</span></p>
                        </div>
                        <div className="bg-theme-card p-5 rounded-2xl border border-blue-500/30 shadow-xl">
                            <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Efikasnost Konverzije</span>
                            <p className="text-2xl font-black text-blue-400">{analitikaDorada.efikasnostProc.toFixed(1)}%</p>
                        </div>
                        <div className="bg-theme-card p-5 rounded-2xl border border-red-500/30 shadow-xl">
                            <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Stvarni Kalo (Otpad)</span>
                            <p className="text-2xl font-black text-red-400">{analitikaDorada.stvarniKaloM3.toFixed(3)} <span className="text-xs">m³</span></p>
                        </div>
                        <div className="bg-theme-card p-5 rounded-2xl border border-theme-border shadow-xl col-span-2 lg:col-span-1">
                            <span className="text-[9px] text-slate-400 uppercase font-black block mb-1">Zastoji Dorade</span>
                            <p className="text-2xl font-black text-theme-text">{analitikaDorada.zastojiMin} <span className="text-xs text-red-400">min</span></p>
                        </div>
                    </div>

                    {/* 🟢 GRAFIKON DORADE — SMARTCHART STUDIO */}
                    <div className="bg-theme-card p-6 rounded-2xl border border-theme-border shadow-2xl">
                        <SmartChart
                            chartId="analitika_dorada_trend"
                            title={`📊 Proizvodnja Dorade po danima (${masinaFilter})`}
                            subtitle="Prilagodi tip dijagrama i podatke — automatski se printa u PDF izvještaju"
                            data={analitikaDorada.chartData}
                            xKey="datum"
                            series={[
                                { key: 'Ulaz_Sirovina', name: 'Ulaz Sirovina', color: '#f59e0b', unit: 'm³' },
                                { key: 'Izlaz_Gotovo', name: 'Izlaz Gotovo', color: '#10b981', unit: 'm³' },
                            ]}
                            defaultType="bar"
                            unit="m³"
                            height={280}
                        />
                    </div>

                    <div className="bg-theme-card p-6 rounded-2xl border border-theme-border shadow-xl">
                        <h3 className="text-xs font-black uppercase text-amber-400 mb-4">🔍 Forenzička Sljedivost Dorade ({masinaFilter})</h3>
                        <div className="overflow-x-auto max-h-80 custom-scrollbar">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-theme-panel text-slate-400 uppercase text-[10px]">
                                    <tr>
                                        <th className="p-3">Izlazni Paket</th>
                                        <th className="p-3">Proizvod i Dimenzije (cm)</th>
                                        <th className="p-3">Ulazni Paketi (Sirovina)</th>
                                        <th className="p-3">Mašina</th>
                                        <th className="p-3 text-right">Izlaz (m³)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-theme-border">
                                    {analitikaDorada.sljedivostLista.length === 0 && (
                                        <tr><td colSpan="5" className="p-6 text-center text-slate-500 italic">Nema paketa dorade za odabrani filter.</td></tr>
                                    )}
                                    {analitikaDorada.sljedivostLista.map((s, i) => (
                                        <tr key={i} className="hover:bg-theme-panel/50">
                                            <td className="p-3 font-black text-emerald-400">{s.paket_id}</td>
                                            <td className="p-3 font-bold text-theme-text">{s.naziv} <span className="text-amber-400 font-mono ml-1">({s.dimenzije})</span></td>
                                            <td className="p-3 text-red-400 font-mono">{s.ulazniPaketi}</td>
                                            <td className="p-3 text-slate-300 uppercase">{s.masina}</td>
                                            <td className="p-3 text-right font-black text-emerald-400">{s.izlazM3.toFixed(3)} m³</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: UKUPNO */}
            {tab === 'UKUPNO' && (
                <div className="space-y-6 animate-in zoom-in-95">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="bg-theme-card p-6 rounded-2xl border border-blue-500/30 shadow-xl">
                            <span className="text-[10px] text-slate-400 uppercase font-black block mb-2">Ukupan Ulaz Sirovine</span>
                            <p className="text-3xl font-black text-blue-400">{analitikaUkupno.ulazTrupacaM3.toFixed(3)} <span className="text-xs">m³</span></p>
                        </div>
                        <div className="bg-theme-card p-6 rounded-2xl border border-emerald-500/30 shadow-xl">
                            <span className="text-[10px] text-slate-400 uppercase font-black block mb-2">Ukupno Proizvedeno</span>
                            <p className="text-3xl font-black text-emerald-400">{analitikaUkupno.proizvedenoUkupnoM3.toFixed(3)} <span className="text-xs">m³</span></p>
                        </div>
                        <div className="bg-theme-card p-6 rounded-2xl border border-purple-500/30 shadow-xl">
                            <span className="text-[10px] text-slate-400 uppercase font-black block mb-2">Efikasnost Fabrike</span>
                            <p className="text-3xl font-black text-purple-400">{analitikaUkupno.efikasnostFabrike.toFixed(1)}%</p>
                        </div>
                        <div className="bg-theme-card p-6 rounded-2xl border border-red-500/30 shadow-xl">
                            <span className="text-[10px] text-slate-400 uppercase font-black block mb-2">Stvarni Otpad (Piljevina/Okorak)</span>
                            <p className="text-3xl font-black text-red-400">{analitikaUkupno.stvarniOtpadM3.toFixed(3)} <span className="text-xs">m³</span></p>
                        </div>
                        <div className="bg-theme-card p-6 rounded-2xl border border-amber-500/30 shadow-xl">
                            <span className="text-[10px] text-slate-400 uppercase font-black block mb-2">Kalo od Krojenja Trupaca</span>
                            <p className="text-3xl font-black text-amber-400">{analitikaUkupno.kaloKrojenjaM3.toFixed(3)} <span className="text-xs">m³</span></p>
                        </div>
                    </div>

                    <div className="bg-theme-card p-6 rounded-2xl border border-theme-border shadow-2xl">
                        <SmartChart
                            chartId="analitika_ukupno_bilans"
                            title="🏭 Materijalni Bilans Fabrike (Ulaz / Izlaz / Otpad / Kalo)"
                            subtitle="Biraj način prikaza i stavke — uključeno u A4 print izvještaj"
                            data={[
                                { stavka: 'Ulaz Sirovine', m3: parseFloat(analitikaUkupno.ulazTrupacaM3.toFixed(3)) },
                                { stavka: 'Proizvedeno', m3: parseFloat(analitikaUkupno.proizvedenoUkupnoM3.toFixed(3)) },
                                { stavka: 'Stvarni Otpad', m3: parseFloat(analitikaUkupno.stvarniOtpadM3.toFixed(3)) },
                                { stavka: 'Kalo Krojenja', m3: parseFloat(analitikaUkupno.kaloKrojenjaM3.toFixed(3)) },
                            ]}
                            xKey="stavka"
                            series={[{ key: 'm3', name: 'Volumen', color: '#3b82f6', unit: 'm³' }]}
                            colorMap={{ 'Ulaz Sirovine': '#3b82f6', 'Proizvedeno': '#10b981', 'Stvarni Otpad': '#ef4444', 'Kalo Krojenja': '#f59e0b' }}
                            defaultType="bar"
                            unit="m³"
                            height={280}
                        />
                    </div>
                </div>
            )}

            {/* TAB 4: FINANSIJE */}
            {tab === 'FINANSIJE' && (
                <div className="space-y-6 animate-in slide-in-from-bottom">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-theme-card p-6 rounded-[2rem] border border-blue-500/40 shadow-2xl">
                            <span className="text-[10px] text-blue-400 uppercase font-black tracking-widest block mb-2">1. Tržišna Vrijednost Robe</span>
                            <p className="text-3xl font-black text-theme-text">{analitikaFinansije.trzisnaVrijednostKM.toFixed(2)} <span className="text-sm text-blue-400">KM</span></p>
                            <p className="text-[10px] text-slate-400 mt-2">Vrijednost proizvedenih paketa po katalogu</p>
                        </div>

                        <div className="bg-theme-card p-6 rounded-[2rem] border border-amber-500/40 shadow-2xl">
                            <span className="text-[10px] text-amber-400 uppercase font-black tracking-widest block mb-2">2. Trošak (Sirovina + Prerada)</span>
                            <p className="text-3xl font-black text-amber-400">- {analitikaFinansije.ukupniTrosakKM.toFixed(2)} <span className="text-sm">KM</span></p>
                            <p className="text-[10px] text-slate-400 mt-2">Sirovina: {analitikaFinansije.trosakSirovineKM.toFixed(2)} KM | Blagajna: {analitikaFinansije.izlazBlagajnaKM.toFixed(2)} KM</p>
                        </div>

                        <div className="bg-theme-card p-6 rounded-[2rem] border border-red-500/40 shadow-2xl">
                            <span className="text-[10px] text-red-400 uppercase font-black tracking-widest block mb-2">3. Udar od Reklamacija</span>
                            <p className="text-3xl font-black text-red-400">- {analitikaFinansije.gubitakReklamacijeKM.toFixed(2)} <span className="text-sm">KM</span></p>
                            <p className="text-[10px] text-slate-400 mt-2">Vrijednost odobrenih povrata i otpisa</p>
                        </div>

                        <div className="bg-theme-card p-6 rounded-[2rem] border-2 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                            <span className="text-[10px] text-emerald-400 uppercase font-black tracking-widest block mb-2">4. ČISTI PROFIT</span>
                            <p className="text-3xl font-black text-emerald-400">{analitikaFinansije.cistiProfitKM.toFixed(2)} <span className="text-sm">KM</span></p>
                            <p className="text-[10px] text-slate-400 mt-2">Tačna formula: (1) - (2) - (3)</p>
                        </div>
                    </div>

                    <div className="bg-theme-card p-6 rounded-2xl border border-theme-border shadow-2xl">
                        <SmartChart
                            chartId="analitika_finansije_bilans"
                            title="💰 Finansijska Struktura (Vrijednost / Trošak / Reklamacije / Profit)"
                            subtitle="Odaberi prikaz i stavke — automatski se štampa u Finansijskom izvještaju"
                            data={[
                                { stavka: 'Vrijednost Robe', km: parseFloat(analitikaFinansije.trzisnaVrijednostKM.toFixed(2)) },
                                { stavka: 'Trošak Sirovina', km: parseFloat(analitikaFinansije.trosakSirovineKM.toFixed(2)) },
                                { stavka: 'Trošak Blagajna', km: parseFloat(analitikaFinansije.izlazBlagajnaKM.toFixed(2)) },
                                { stavka: 'Reklamacije', km: parseFloat(analitikaFinansije.gubitakReklamacijeKM.toFixed(2)) },
                                { stavka: 'Čisti Profit', km: parseFloat(analitikaFinansije.cistiProfitKM.toFixed(2)) },
                            ]}
                            xKey="stavka"
                            series={[{ key: 'km', name: 'Iznos', color: '#10b981', unit: 'KM' }]}
                            colorMap={{ 'Vrijednost Robe': '#3b82f6', 'Trošak Sirovina': '#f59e0b', 'Trošak Blagajna': '#f97316', 'Reklamacije': '#ef4444', 'Čisti Profit': '#10b981' }}
                            defaultType="bar"
                            unit="KM"
                            height={280}
                        />
                    </div>
                </div>
            )}

            {/* TAB 5: PROFIT PO RADNOM NALOGU (JOB COSTING) */}
            {tab === 'PROFIT_NALOG' && (
                <div data-testid="analitika-profit-nalog-panel" className="space-y-6 animate-in slide-in-from-bottom">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-theme-card p-5 rounded-2xl border border-blue-500/40 shadow-xl">
                            <span className="text-[10px] text-blue-400 uppercase font-black block mb-1">Ukupni Prihod Naloga</span>
                            <p className="text-2xl font-black text-theme-text">{analitikaProfitPoNalogu.ukupnoPrihod.toFixed(2)} <span className="text-xs text-blue-400">KM</span></p>
                            <span className="text-[10px] text-theme-muted font-bold">{analitikaProfitPoNalogu.redovi.length} radnih naloga u periodu</span>
                        </div>
                        <div className="bg-theme-card p-5 rounded-2xl border border-amber-500/40 shadow-xl">
                            <span className="text-[10px] text-amber-400 uppercase font-black block mb-1">Ukupni Trošak (Sirovina + Rad + Rekl.)</span>
                            <p className="text-2xl font-black text-amber-400">- {analitikaProfitPoNalogu.ukupnoTrosak.toFixed(2)} <span className="text-xs">KM</span></p>
                            <span className="text-[10px] text-theme-muted font-bold">Stvarna nabavna cijena trupaca + satnice</span>
                        </div>
                        <div className="bg-theme-card p-5 rounded-2xl border-2 border-emerald-500/60 shadow-xl">
                            <span className="text-[10px] text-emerald-400 uppercase font-black block mb-1">Neto Profit po Nalozima</span>
                            <p className={`text-2xl font-black ${analitikaProfitPoNalogu.ukupnoProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{analitikaProfitPoNalogu.ukupnoProfit.toFixed(2)} <span className="text-xs">KM</span></p>
                            <span className="text-[10px] text-theme-muted font-bold">Čista zarada nakon svih troškova</span>
                        </div>
                        <div className="bg-theme-card p-5 rounded-2xl border border-purple-500/40 shadow-xl">
                            <span className="text-[10px] text-purple-400 uppercase font-black block mb-1">Prosječna Neto Marža</span>
                            <p className={`text-2xl font-black ${analitikaProfitPoNalogu.prosjecnaMarza >= 20 ? 'text-emerald-400' : analitikaProfitPoNalogu.prosjecnaMarza >= 10 ? 'text-amber-400' : 'text-red-400'}`}>{analitikaProfitPoNalogu.prosjecnaMarza.toFixed(1)}%</p>
                            <span className="text-[10px] text-theme-muted font-bold">Ciljana marža: &gt; 20%</span>
                        </div>
                    </div>

                    <div className="bg-theme-card p-6 rounded-2xl border border-theme-border shadow-2xl">
                        <SmartChart
                            chartId="analitika_profit_nalog"
                            title="💎 Profitabilnost po Radnom Nalogu (Prihod vs Trošak vs Neto Profit)"
                            subtitle="Top 12 radnih naloga u periodu — klikni za PDF ili Excel izvoz"
                            data={analitikaProfitPoNalogu.chartData}
                            xKey="nalog"
                            series={[
                                { key: 'Prihod', name: 'Prihod', color: '#3b82f6', unit: 'KM' },
                                { key: 'Trosak', name: 'Trošak', color: '#f59e0b', unit: 'KM' },
                                { key: 'Profit', name: 'Neto Profit', color: '#10b981', unit: 'KM' },
                            ]}
                            defaultType="bar"
                            unit="KM"
                            height={280}
                        />
                    </div>

                    <div className="bg-theme-card p-6 rounded-2xl border border-theme-border shadow-xl">
                        <h3 className="text-xs font-black uppercase text-purple-400 mb-4">📋 Detaljna Kalkulacija Profita po Radnom Nalogu</h3>
                        <div className="overflow-x-auto max-h-[460px] custom-scrollbar">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-theme-panel text-slate-400 uppercase text-[10px] sticky top-0">
                                    <tr>
                                        <th className="p-3">Radni Nalog</th>
                                        <th className="p-3">Kupac</th>
                                        <th className="p-3 text-right">Proizvedeno</th>
                                        <th className="p-3 text-right">Prihod (KM)</th>
                                        <th className="p-3 text-right">Sirovina</th>
                                        <th className="p-3 text-right">Rad</th>
                                        <th className="p-3 text-right">Rekl.</th>
                                        <th className="p-3 text-right">Neto Profit</th>
                                        <th className="p-3 text-center">Marža</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-theme-border">
                                    {analitikaProfitPoNalogu.redovi.length === 0 && (
                                        <tr><td colSpan="9" className="p-8 text-center text-slate-500 italic">Nema radnih naloga u odabranom periodu.</td></tr>
                                    )}
                                    {analitikaProfitPoNalogu.redovi.map((r) => (
                                        <tr key={r.rn_id} className="hover:bg-theme-panel/60 transition-colors">
                                            <td className="p-3 font-black text-purple-400">
                                                {r.rn_id}
                                                <span className="block text-[9px] text-theme-muted font-bold">{r.izvorPrihoda}</span>
                                            </td>
                                            <td className="p-3 font-bold text-theme-text">
                                                <button
                                                    type="button"
                                                    onClick={() => window.dispatchEvent(new CustomEvent('otvori_karticu_kupca', { detail: { kupacNaziv: r.kupac } }))}
                                                    className="hover:underline text-left"
                                                    title="Otvori finansijsku karticu kupca"
                                                >
                                                    {r.kupac}
                                                </button>
                                            </td>
                                            <td className="p-3 text-right font-mono text-slate-300">{r.proizvedenoM3.toFixed(3)} m³</td>
                                            <td className="p-3 text-right font-black text-blue-400">{r.prihodKM.toFixed(2)}</td>
                                            <td className="p-3 text-right text-amber-400">-{r.trosakSirovineKM.toFixed(2)}</td>
                                            <td className="p-3 text-right text-slate-400">-{r.trosakRadaKM.toFixed(2)}</td>
                                            <td className="p-3 text-right text-red-400">{r.trosakReklamacijaKM > 0 ? `-${r.trosakReklamacijaKM.toFixed(2)}` : '0.00'}</td>
                                            <td className={`p-3 text-right font-black ${r.netoProfitKM >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{r.netoProfitKM.toFixed(2)} KM</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${r.marzaProc >= 20 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' : r.marzaProc >= 10 ? 'bg-amber-500/15 text-amber-400 border-amber-500/40' : 'bg-red-500/15 text-red-400 border-red-500/40'}`}>
                                                    {r.marzaProc.toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 6: AI KONTROLOR */}
            {tab === 'AI' && <TabAiAnalitika saas={saas} user={user} />}
        </div>
    );
}