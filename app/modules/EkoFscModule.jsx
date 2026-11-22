"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import MasterHeader from '../components/MasterHeader';
import SmartChart, { uhvatiSmartChartSvgHtml } from '../components/SmartChart';
import { useSaaS } from '../utils/useSaaS';
import { printDokument } from '../utils/printHelpers';
import { exportToExcel } from '../utils/exportHelpers';
import { toLocalIso, prikazDatumaBHS, escapeHtml } from '../utils/dateHelpers';
import { jeQaTestniZapis } from '../utils/smartReminders';
import {
    DEFAULT_FSC_POSTAVKE,
    DEFAULT_BIOMASA_POSTAVKE,
    ucitajFscPostavke,
    spasiFscPostavke,
    ucitajBiomasaPostavke,
    spasiBiomasaPostavke,
    ucitajCbamPostavke,
    spasiCbamPostavke,
    statusIstekaCertifikata,
} from '../utils/ekoFscHelpers';
import { Leaf, Flame, Globe, Truck, Printer, FileSpreadsheet, Save, Plus, Trash2, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const formatMjesec = (iso) => (iso || '').slice(0, 7);

export default function EkoFscModule({ user, header, setHeader, onExit }) {
    const saas = useSaaS('eko_fsc_modul', {
        boja_kartice: '',
        boja_slova: '',
        boja_akcenta: '#16a34a',
    });

    const danas = toLocalIso(new Date());
    const prviUGodini = `${danas.slice(0, 4)}-01-01`;

    const [tab, setTab] = useState(() => {
        if (typeof window !== 'undefined') {
            const auto = localStorage.getItem('eko_fsc_auto_tab');
            if (auto) {
                localStorage.removeItem('eko_fsc_auto_tab');
                if (['FSC', 'CBAM', 'BIOMASA', 'DOBAVLJACI'].includes(auto)) return auto;
            }
        }
        return 'FSC';
    });

    const [datumOd, setDatumOd] = useState(prviUGodini);
    const [datumDo, setDatumDo] = useState(danas);
    const [loading, setLoading] = useState(true);

    // Baza
    const [sumarijeBaza, setSumarijeBaza] = useState([]);
    const [podruzniceBaza, setPodruzniceBaza] = useState([]);
    const [trupciBaza, setTrupciBaza] = useState([]);
    const [prorezBaza, setProrezBaza] = useState([]);
    const [paketiBaza, setPaketiBaza] = useState([]);
    const [otpremniceBaza, setOtpremniceBaza] = useState([]);
    const [blagajnaBaza, setBlagajnaBaza] = useState([]);
    const [susareSarze, setSusareSarze] = useState([]);

    // Postavke iz ui_postavke
    const [fscPostavke, setFscPostavke] = useState(DEFAULT_FSC_POSTAVKE);
    const [biomasaPostavke, setBiomasaPostavke] = useState(DEFAULT_BIOMASA_POSTAVKE);
    const [cbamLista, setCbamLista] = useState([]);

    // Forme za unos
    const [noviUtrosak, setNoviUtrosak] = useState({
        datum: danas,
        vrsta: 'PILJEVINA',
        kolicinaM3: '',
        namjena: 'SUŠARA',
        sarzaId: '',
        prihodKM: '',
        kupac: '',
        napomena: '',
    });

    const [noviCbam, setNoviCbam] = useState({
        mjesec: danas.slice(0, 7),
        strujaKwh: '',
        dizelL: '',
        lozUljeL: '',
        plinM3: '',
        faktorStruja: '0.72',
        faktorDizel: '2.68',
        trosakStrujaKM: '',
        trosakDizelKM: '',
        trosakOstaloKM: '',
        napomena: '',
    });

    const ucitajSve = async () => {
        setLoading(true);
        try {
            const [sRes, podRes, tRes, prRes, pkRes, oRes, blRes, susRes, fscP, bioP, cbamP] = await Promise.all([
                supabase.from('sumarije').select('*').order('naziv'),
                supabase.from('podruznice').select('*'),
                supabase.from('trupci').select('id, sumarija, podruznica, prevoznik, vrsta, datum_prijema, created_at, zapremina, kontrolna_zapremina, nabavna_vrijednost, trosak_prevoza, status'),
                supabase.from('prorez_log').select('id, trupac_id, datum, created_at, zapremina, masina'),
                supabase.from('paketi').select('paket_id, naziv_proizvoda, datum_yyyy_mm, created_at, kolicina_final, ulaz_trupci_ids, ulaz_paketi_ids, otpremnica_id, status'),
                supabase.from('otpremnice').select('id, kupac_naziv, datum, status, stavke_jsonb').order('datum', { ascending: false }).limit(200),
                supabase.from('blagajna').select('id, datum, tip, iznos, kategorija, opis, created_at'),
                supabase.from('ui_postavke').select('postavke_jsonb').eq('modul_ime', 'susare_sarze').maybeSingle(),
                ucitajFscPostavke(true),
                ucitajBiomasaPostavke(),
                ucitajCbamPostavke(),
            ]);

            setSumarijeBaza(sRes.data || []);
            setPodruzniceBaza(podRes.data || []);
            setTrupciBaza((tRes.data || []).filter((x) => !jeQaTestniZapis(x)));
            setProrezBaza((prRes.data || []).filter((x) => !jeQaTestniZapis(x)));
            setPaketiBaza((pkRes.data || []).filter((x) => !jeQaTestniZapis(x)));
            setOtpremniceBaza((oRes.data || []).filter((x) => !jeQaTestniZapis(x)));
            setBlagajnaBaza((blRes.data || []).filter((x) => !jeQaTestniZapis(x)));
            setSusareSarze(Array.isArray(susRes.data?.postavke_jsonb?.lista) ? susRes.data.postavke_jsonb.lista : []);

            setFscPostavke(fscP);
            setBiomasaPostavke(bioP);
            setCbamLista(cbamP.lista || []);
        } catch (e) {
            console.error('EKO/FSC load error:', e);
            toast.error('Greška pri učitavanju EKO/FSC podataka.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { ucitajSve(); }, []);

    const uOpsegu = (datumStr, createdAt) => {
        const d = String(datumStr || createdAt || '').slice(0, 10);
        if (!d) return false;
        return d >= datumOd && d <= datumDo;
    };

    // =========================================================================
    // 1. FSC & EUDR OBRAČUN (MASENI BILANS, KONVERZIJSKI FAKTOR, SLJEDIVOST)
    // =========================================================================
    const fscAnalitika = useMemo(() => {
        const meta = fscPostavke.sumarijeMeta || {};
        const trupciUPeriodu = trupciBaza.filter((t) => uOpsegu(t.datum_prijema, t.created_at));
        const trupciMap = new Map(trupciBaza.map((t) => [t.id, t]));

        let ulazFsc100M3 = 0;
        let ulazFscMixM3 = 0;
        let ulazControlledM3 = 0;
        let ulazBezFscM3 = 0;

        trupciUPeriodu.forEach((t) => {
            const vol = parseFloat(t.kontrolna_zapremina || t.zapremina || 0) || 0;
            const st = meta[t.sumarija]?.fscStatus || 'BEZ_FSC';
            if (st === 'FSC 100%') ulazFsc100M3 += vol;
            else if (st === 'FSC Mix') ulazFscMixM3 += vol;
            else if (st === 'FSC Controlled Wood') ulazControlledM3 += vol;
            else ulazBezFscM3 += vol;
        });

        const ukupnoFscUlazM3 = ulazFsc100M3 + ulazFscMixM3 + ulazControlledM3;
        const ukupnoUlazM3 = ukupnoFscUlazM3 + ulazBezFscM3;

        // Proizvedeni paketi u periodu — automatsko određivanje FSC statusa iz ulaznih trupaca
        const paketiUPeriodu = paketiBaza.filter((p) => uOpsegu(p.datum_yyyy_mm, p.created_at));
        let izlazFscM3 = 0;
        let izlazBezFscM3 = 0;
        let mijesaniPaketi = 0;

        paketiUPeriodu.forEach((p) => {
            const vol = parseFloat(p.kolicina_final || 0) || 0;
            const tIds = Array.isArray(p.ulaz_trupci_ids) ? p.ulaz_trupci_ids : [];
            if (tIds.length === 0) {
                // Ako nije vezan konkretan trupac, prati udio FSC ulaza
                if (ukupnoUlazM3 > 0 && ukupnoFscUlazM3 / ukupnoUlazM3 >= 0.99) izlazFscM3 += vol;
                else izlazBezFscM3 += vol;
                return;
            }
            const statusi = new Set(tIds.map((id) => meta[trupciMap.get(id)?.sumarija]?.fscStatus || 'BEZ_FSC'));
            const imaFsc = [...statusi].some((s) => s !== 'BEZ_FSC');
            const imaNeFsc = statusi.has('BEZ_FSC');
            if (imaFsc && imaNeFsc) {
                mijesaniPaketi += 1;
                izlazBezFscM3 += vol;
            } else if (imaFsc) {
                izlazFscM3 += vol;
            } else {
                izlazBezFscM3 += vol;
            }
        });

        // Isporučena FSC roba na otpremnicama u periodu
        let isporucenoM3 = 0;
        otpremniceBaza
            .filter((o) => o.status === 'ISPORUČENO' && uOpsegu(o.datum))
            .forEach((o) => {
                (o.stavke_jsonb || []).forEach((st) => {
                    isporucenoM3 += parseFloat(st.kolicina_obracun || st.kolicina || 0) || 0;
                });
            });

        const konverzijskiFaktor = ukupnoUlazM3 > 0
            ? parseFloat(Math.min(1, (izlazFscM3 + izlazBezFscM3) / ukupnoUlazM3).toFixed(3))
            : (parseFloat(fscPostavke.defaultConversionFactor || 0.62) || 0.62);

        const pocetniKredit = parseFloat(fscPostavke.kreditPocetniM3 || 0) || 0;
        const zaradjeniFscKreditM3 = ukupnoFscUlazM3 * (konverzijskiFaktor > 0 ? konverzijskiFaktor : 0.62);
        const fscKreditSaldoM3 = pocetniKredit + zaradjeniFscKreditM3 - izlazFscM3;

        // Alarmi certifikata šumarija
        const certAlarmi = sumarijeBaza
            .map((s) => {
                const m = meta[s.naziv] || {};
                const st = statusIstekaCertifikata(m.vaziDo);
                return { naziv: s.naziv, ...m, istek: st };
            })
            .filter((x) => x.fscStatus && x.fscStatus !== 'BEZ_FSC' && (x.istek.status === 'ISTEKAO' || x.istek.status === 'USKORO'));

        return {
            ulazFsc100M3,
            ulazFscMixM3,
            ulazControlledM3,
            ulazBezFscM3,
            ukupnoFscUlazM3,
            ukupnoUlazM3,
            fscUdioProc: ukupnoUlazM3 > 0 ? (ukupnoFscUlazM3 / ukupnoUlazM3) * 100 : 0,
            izlazFscM3,
            izlazBezFscM3,
            mijesaniPaketi,
            isporucenoM3,
            konverzijskiFaktor,
            fscKreditSaldoM3,
            certAlarmi,
        };
    }, [fscPostavke, trupciBaza, paketiBaza, otpremniceBaza, sumarijeBaza, datumOd, datumDo]);

    // =========================================================================
    // 2. BIOMASA & UTROŠAK OTPADA (PEĆI ZA SUŠARE, GRIJANJE OBJEKATA, PRODAJA)
    // =========================================================================
    const biomasaAnalitika = useMemo(() => {
        const koef = biomasaPostavke.koeficijenti || DEFAULT_BIOMASA_POSTAVKE.koeficijenti;
        const prorezUPeriodu = prorezBaza.filter((p) => uOpsegu(p.datum, p.created_at));
        const paketiUPeriodu = paketiBaza.filter((p) => uOpsegu(p.datum_yyyy_mm, p.created_at));

        const ulazProrezM3 = prorezUPeriodu.reduce((s, r) => s + (parseFloat(r.zapremina || 0) || 0), 0);
        const izlazGradjaM3 = paketiUPeriodu.reduce((s, p) => s + (parseFloat(p.kolicina_final || 0) || 0), 0);
        const stvarniUkupniOtpadM3 = Math.max(0, ulazProrezM3 - izlazGradjaM3);

        // Procijenjeni prirast po frakcijama na bazi ulaza trupaca i koeficijenata
        const prirastPiljevina = ulazProrezM3 * ((parseFloat(koef.piljevinaProc) || 12) / 100);
        const prirastOkorak = ulazProrezM3 * ((parseFloat(koef.okorakProc) || 18) / 100);
        const prirastKora = ulazProrezM3 * ((parseFloat(koef.koraProc) || 8) / 100);
        const ukupniPrirastM3 = prirastPiljevina + prirastOkorak + prirastKora;

        const utrosakUPeriodu = (biomasaPostavke.utrosakLista || []).filter((u) => uOpsegu(u.datum));

        const poNamjeni = {
            SUŠARA: 0,
            GRIJANJE_OBJEKATA: 0,
            PRODAJA: 0,
            OTPAD_KOREKCIJA: 0,
        };
        const utrosenoPoVrsti = { PILJEVINA: 0, OKORAK: 0, SJEČKA: 0, KORA: 0 };
        let prihodOdProdajeKM = 0;

        utrosakUPeriodu.forEach((u) => {
            const kol = parseFloat(u.kolicinaM3 || 0) || 0;
            poNamjeni[u.namjena] = (poNamjeni[u.namjena] || 0) + kol;
            utrosenoPoVrsti[u.vrsta] = (utrosenoPoVrsti[u.vrsta] || 0) + kol;
            if (u.namjena === 'PRODAJA') prihodOdProdajeKM += parseFloat(u.prihodKM || 0) || 0;
        });

        const lozenoUkupnoM3 = poNamjeni.SUŠARA + poNamjeni.GRIJANJE_OBJEKATA;
        const cijenaUstede = parseFloat(koef.cijenaUstedePoM3 || 45) || 45;
        const ustedaEnergijeKM = lozenoUkupnoM3 * cijenaUstede;
        const izbjegnutiCo2Kg = lozenoUkupnoM3 * 365; // ~365 kg fosilnog CO2e ušteđeno po m3 drvne biomase umjesto lož-ulja

        const ukupnoUtrosenoM3 = Object.values(poNamjeni).reduce((s, v) => s + v, 0);
        const stanjeNaPlacuM3 = Math.max(0, ukupniPrirastM3 - ukupnoUtrosenoM3);

        // Prosječni utrošak po sušari / šarži
        const ukupnoSusenoM3 = susareSarze.reduce((s, sz) => s + (parseFloat(sz.m3 || 0) || 0), 0);
        const cijenaSusenjaPoM3 = ukupnoSusenoM3 > 0 ? (poNamjeni.SUŠARA * cijenaUstede) / ukupnoSusenoM3 : 0;

        const chartData = [
            { stavka: 'Piljevina', Prirast: parseFloat(prirastPiljevina.toFixed(2)), Utrosak: parseFloat((utrosenoPoVrsti.PILJEVINA || 0).toFixed(2)) },
            { stavka: 'Okorak / Sječka', Prirast: parseFloat(prirastOkorak.toFixed(2)), Utrosak: parseFloat(((utrosenoPoVrsti.OKORAK || 0) + (utrosenoPoVrsti.SJEČKA || 0)).toFixed(2)) },
            { stavka: 'Kora', Prirast: parseFloat(prirastKora.toFixed(2)), Utrosak: parseFloat((utrosenoPoVrsti.KORA || 0).toFixed(2)) },
        ];

        return {
            ulazProrezM3,
            stvarniUkupniOtpadM3,
            prirastPiljevina,
            prirastOkorak,
            prirastKora,
            ukupniPrirastM3,
            poNamjeni,
            lozenoUkupnoM3,
            prihodOdProdajeKM,
            ustedaEnergijeKM,
            izbjegnutiCo2Kg,
            stanjeNaPlacuM3,
            cijenaSusenjaPoM3,
            utrosakUPeriodu,
            chartData,
        };
    }, [biomasaPostavke, prorezBaza, paketiBaza, susareSarze, datumOd, datumDo]);

    // =========================================================================
    // 3. CBAM & CO₂ OTISAK + REŽIJSKI TROŠKOVI PO m³
    // =========================================================================
    const cbamAnalitika = useMemo(() => {
        const mjesecOd = formatMjesec(datumOd);
        const mjesecDo = formatMjesec(datumDo);

        const filtrirani = (cbamLista || [])
            .filter((x) => x.mjesec >= mjesecOd && x.mjesec <= mjesecDo)
            .sort((a, b) => a.mjesec.localeCompare(b.mjesec));

        const paketiUPeriodu = paketiBaza.filter((p) => uOpsegu(p.datum_yyyy_mm, p.created_at));
        const ukupnoProizvedenoM3 = paketiUPeriodu.reduce((s, p) => s + (parseFloat(p.kolicina_final || 0) || 0), 0);

        let scope1Kg = 0;
        let scope2Kg = 0;
        let ukupniTroskoviEnergijeKM = 0;

        const redovi = filtrirani.map((r) => {
            const kwh = parseFloat(r.strujaKwh || 0) || 0;
            const dizel = parseFloat(r.dizelL || 0) || 0;
            const loz = parseFloat(r.lozUljeL || 0) || 0;
            const plin = parseFloat(r.plinM3 || 0) || 0;
            const fStruja = parseFloat(r.faktorStruja || 0.72) || 0.72;
            const fDizel = parseFloat(r.faktorDizel || 2.68) || 2.68;

            const s1 = (dizel + loz) * fDizel + plin * 2.02;
            const s2 = kwh * fStruja;
            const totCo2 = s1 + s2;

            const trosakKM = (parseFloat(r.trosakStrujaKM || 0) || 0)
                + (parseFloat(r.trosakDizelKM || 0) || 0)
                + (parseFloat(r.trosakOstaloKM || 0) || 0);

            const m3Mjesec = paketiBaza
                .filter((p) => String(p.datum_yyyy_mm || p.created_at || '').startsWith(r.mjesec))
                .reduce((s, p) => s + (parseFloat(p.kolicina_final || 0) || 0), 0);

            scope1Kg += s1;
            scope2Kg += s2;
            ukupniTroskoviEnergijeKM += trosakKM;

            return {
                ...r,
                scope1Kg: parseFloat(s1.toFixed(1)),
                scope2Kg: parseFloat(s2.toFixed(1)),
                ukupnoCo2Kg: parseFloat(totCo2.toFixed(1)),
                trosakKM: parseFloat(trosakKM.toFixed(2)),
                m3Mjesec: parseFloat(m3Mjesec.toFixed(2)),
                co2PoM3: m3Mjesec > 0 ? parseFloat((totCo2 / m3Mjesec).toFixed(2)) : 0,
                trosakPoM3: m3Mjesec > 0 ? parseFloat((trosakKM / m3Mjesec).toFixed(2)) : 0,
            };
        });

        const ukupnoCo2Kg = scope1Kg + scope2Kg;
        const ukupnoCo2Tone = ukupnoCo2Kg / 1000;
        const co2PoM3 = ukupnoProizvedenoM3 > 0 ? ukupnoCo2Kg / ukupnoProizvedenoM3 : 0;
        // Prosječna masa 1 m3 građe ~0.62 t → t CO2e po toni proizvoda (CBAM jedinica)
        const tCo2PoToni = ukupnoProizvedenoM3 > 0 ? (ukupnoCo2Tone / (ukupnoProizvedenoM3 * 0.62)) : 0;
        const rezijaPoM3KM = ukupnoProizvedenoM3 > 0 ? ukupniTroskoviEnergijeKM / ukupnoProizvedenoM3 : 0;

        const chartData = redovi.map((r) => ({
            mjesec: r.mjesec,
            Scope1_kg: r.scope1Kg,
            Scope2_kg: r.scope2Kg,
            Trosak_KM: r.trosakKM,
        }));

        return {
            redovi,
            ukupnoProizvedenoM3,
            scope1Kg,
            scope2Kg,
            ukupnoCo2Kg,
            ukupnoCo2Tone,
            co2PoM3,
            tCo2PoToni,
            ukupniTroskoviEnergijeKM,
            rezijaPoM3KM,
            chartData,
        };
    }, [cbamLista, paketiBaza, datumOd, datumDo]);

    // =========================================================================
    // 4. DOBAVLJAČI: FINANSIJSKA KARTICA ŠUMARIJA I PREVOZNIKA (DUGOVANJA)
    // =========================================================================
    const dobavljaciAnalitika = useMemo(() => {
        const podMap = {};
        podruzniceBaza.forEach((p) => {
            podMap[`${String(p.sumarija_naziv || '').toUpperCase()}__${String(p.naziv || '').toUpperCase()}`] = parseFloat(p.cijena_prevoza_po_m3 || 0) || 0;
        });

        const izlaziBlagajne = blagajnaBaza.filter((b) => String(b.tip || '').toUpperCase() === 'IZLAZ');
        const sumMapa = {};
        const prevMapa = {};

        trupciBaza.forEach((t) => {
            const vol = parseFloat(t.kontrolna_zapremina || t.zapremina || 0) || 0;
            const nabavna = parseFloat(t.nabavna_vrijednost || 0) || 0;
            const sumIme = String(t.sumarija || 'NEPOZNATA ŠUMARIJA').trim().toUpperCase();

            if (!sumMapa[sumIme]) sumMapa[sumIme] = { naziv: sumIme, tip: 'ŠUMARIJA', m3: 0, kom: 0, zaduzenjeKM: 0, uplacenoKM: 0 };
            sumMapa[sumIme].m3 += vol;
            sumMapa[sumIme].kom += 1;
            sumMapa[sumIme].zaduzenjeKM += nabavna;

            const prevIme = String(t.prevoznik || '').trim().toUpperCase();
            if (prevIme) {
                if (!prevMapa[prevIme]) prevMapa[prevIme] = { naziv: prevIme, tip: 'PREVOZNIK', m3: 0, kom: 0, zaduzenjeKM: 0, uplacenoKM: 0 };
                prevMapa[prevIme].m3 += vol;
                prevMapa[prevIme].kom += 1;
                let cijenaPrev = parseFloat(t.trosak_prevoza || 0) || 0;
                if (cijenaPrev === 0) {
                    const poM3 = podMap[`${sumIme}__${String(t.podruznica || '').toUpperCase()}`] || 0;
                    cijenaPrev = vol * poM3;
                }
                prevMapa[prevIme].zaduzenjeKM += cijenaPrev;
            }
        });

        // Poveži uplate iz blagajne (po nazivu šumarije/prevoznika u opisu ili kategoriji)
        const upariUplate = (mapa) => {
            Object.values(mapa).forEach((item) => {
                const kljuc = item.naziv.toUpperCase();
                if (kljuc.length < 3) return;
                const placeno = izlaziBlagajne
                    .filter((b) => String(`${b.opis || ''} ${b.kategorija || ''}`).toUpperCase().includes(kljuc))
                    .reduce((s, b) => s + (parseFloat(b.iznos || 0) || 0), 0);
                item.uplacenoKM = parseFloat(placeno.toFixed(2));
                item.zaduzenjeKM = parseFloat(item.zaduzenjeKM.toFixed(2));
                item.m3 = parseFloat(item.m3.toFixed(3));
                item.saldoDugKM = parseFloat((item.zaduzenjeKM - item.uplacenoKM).toFixed(2));
            });
        };
        upariUplate(sumMapa);
        upariUplate(prevMapa);

        const sumarije = Object.values(sumMapa).sort((a, b) => b.saldoDugKM - a.saldoDugKM);
        const prevoznici = Object.values(prevMapa).sort((a, b) => b.saldoDugKM - a.saldoDugKM);
        const ukupnoDugSumarije = sumarije.reduce((s, x) => s + Math.max(0, x.saldoDugKM), 0);
        const ukupnoDugPrevoznici = prevoznici.reduce((s, x) => s + Math.max(0, x.saldoDugKM), 0);

        return { sumarije, prevoznici, ukupnoDugSumarije, ukupnoDugPrevoznici };
    }, [trupciBaza, podruzniceBaza, blagajnaBaza]);

    // =========================================================================
    // AKCIJE SPAŠAVANJA
    // =========================================================================
    const updateSumarijaMeta = (naziv, polje, val) => {
        setFscPostavke((prev) => ({
            ...prev,
            sumarijeMeta: {
                ...(prev.sumarijeMeta || {}),
                [naziv]: {
                    ...(prev.sumarijeMeta?.[naziv] || { fscStatus: 'BEZ_FSC', certBroj: '', vaziDo: '', gpsLokacija: '', eudrOdjel: '' }),
                    [polje]: val,
                },
            },
        }));
    };

    const handleSpasiFsc = async () => {
        const { error } = await spasiFscPostavke(fscPostavke);
        if (error) return toast.error('Greška pri spašavanju FSC postavki: ' + error.message);
        toast.success('✅ FSC & EUDR postavke su uspješno spašene!');
    };

    const handleDodajUtrosakBiomase = async () => {
        const kol = parseFloat(noviUtrosak.kolicinaM3);
        if (!Number.isFinite(kol) || kol <= 0) return toast.warning('Unesite validnu količinu otpada (m³) veću od 0!');
        const sarzaObj = susareSarze.find((s) => s.id === noviUtrosak.sarzaId);
        const zapis = {
            id: `BIO-${Date.now().toString().slice(-6)}`,
            ...noviUtrosak,
            kolicinaM3: parseFloat(kol.toFixed(2)),
            prihodKM: noviUtrosak.namjena === 'PRODAJA' ? parseFloat(noviUtrosak.prihodKM || 0) || 0 : 0,
            komora: sarzaObj ? `${sarzaObj.komora} (${sarzaObj.paket_id})` : '',
            snimio: user?.ime_prezime || 'Operater',
            created_at: new Date().toISOString(),
        };
        const novo = {
            ...biomasaPostavke,
            utrosakLista: [zapis, ...(biomasaPostavke.utrosakLista || [])],
        };
        setBiomasaPostavke(novo);
        const { error } = await spasiBiomasaPostavke(novo);
        if (error) return toast.error('Greška pri snimanju: ' + error.message);
        setNoviUtrosak({ datum: danas, vrsta: 'PILJEVINA', kolicinaM3: '', namjena: 'SUŠARA', sarzaId: '', prihodKM: '', kupac: '', napomena: '' });
        toast.success('✅ Evidencija utroška/prodaje biomase je spašena!');
    };

    const handleObrisiUtrosakBiomase = async (id) => {
        const novo = {
            ...biomasaPostavke,
            utrosakLista: (biomasaPostavke.utrosakLista || []).filter((x) => x.id !== id),
        };
        setBiomasaPostavke(novo);
        await spasiBiomasaPostavke(novo);
        toast.info('Zapis biomase obrisan.');
    };

    const handleSpasiKoeficijenteBiomase = async () => {
        const { error } = await spasiBiomasaPostavke(biomasaPostavke);
        if (error) return toast.error('Greška pri snimanju koeficijenata: ' + error.message);
        toast.success('✅ Koeficijenti prirasta i uštede biomase spašeni!');
    };

    const handleDodajCbam = async () => {
        if (!noviCbam.mjesec) return toast.warning('Odaberite mjesec (GGGG-MM)!');
        const zapis = {
            id: `CBAM-${noviCbam.mjesec}`,
            ...noviCbam,
            snimio: user?.ime_prezime || 'Admin',
            updated_at: new Date().toISOString(),
        };
        const bezIstog = (cbamLista || []).filter((x) => x.mjesec !== noviCbam.mjesec);
        const novaLista = [zapis, ...bezIstog].sort((a, b) => b.mjesec.localeCompare(a.mjesec));
        setCbamLista(novaLista);
        const { error } = await spasiCbamPostavke({ lista: novaLista });
        if (error) return toast.error('Greška pri snimanju CBAM energenata: ' + error.message);
        toast.success(`✅ Energenti i CBAM podaci za ${noviCbam.mjesec} spašeni!`);
    };

    const handleObrisiCbam = async (id) => {
        const novaLista = (cbamLista || []).filter((x) => x.id !== id);
        setCbamLista(novaLista);
        await spasiCbamPostavke({ lista: novaLista });
        toast.info('Mjesečni zapis energenata uklonjen.');
    };

    // =========================================================================
    // PDF & EXCEL IZVOZI ZA SVA 4 TABA
    // =========================================================================
    const stampajPdf = () => {
        const periodTxt = `${prikazDatumaBHS(datumOd)} – ${prikazDatumaBHS(datumDo)}`;
        if (tab === 'FSC') {
            const redoviSum = sumarijeBaza.map((s, i) => {
                const m = fscPostavke.sumarijeMeta?.[s.naziv] || {};
                return `<tr><td>${i + 1}.</td><td><b>${escapeHtml(s.naziv)}</b></td><td>${escapeHtml(m.fscStatus || 'BEZ_FSC')}</td><td>${escapeHtml(m.certBroj || '-')}</td><td>${escapeHtml(m.vaziDo || '-')}</td><td>${escapeHtml(m.gpsLokacija || m.eudrOdjel || '-')}</td></tr>`;
            }).join('');
            const html = `
                <div class="info-grid">
                    <div class="info-col-left"><h4>FSC® Chain of Custody & EUDR Izvještaj</h4><h2>Period: ${periodTxt}</h2><p>Firma FSC CoC: <b>${escapeHtml(fscPostavke.firmaFscCoc || 'Nije unesen')}</b> | Claim: <b>${escapeHtml(fscPostavke.defaultClaim)}</b></p></div>
                    <div class="info-col-right"><p>FSC Ulaz Trupaca: <b>${fscAnalitika.ukupnoFscUlazM3.toFixed(3)} m³ (${fscAnalitika.fscUdioProc.toFixed(1)}%)</b></p><p>FSC Izlaz Građe: <b>${fscAnalitika.izlazFscM3.toFixed(3)} m³</b></p><p>Konverzijski Faktor (Yield): <b>${(fscAnalitika.konverzijskiFaktor * 100).toFixed(1)}%</b></p><p>FSC Kreditni Saldo: <b>${fscAnalitika.fscKreditSaldoM3.toFixed(3)} m³</b></p></div>
                </div>
                <table>
                    <thead><tr><th>#</th><th>Šumarija / Dobavljač</th><th>FSC Status</th><th>Broj Certifikata</th><th>Važi do</th><th>EUDR GPS / Odjel</th></tr></thead>
                    <tbody>${redoviSum}</tbody>
                </table>
            `;
            printDokument('FSC & EUDR AUDIT IZVJEŠTAJ', `FSC-${datumOd}`, prikazDatumaBHS(danas), html, '#16a34a');
        } else if (tab === 'CBAM') {
            const chartHtml = uhvatiSmartChartSvgHtml('eko_cbam_chart', 'Mjesečne CO₂e Emisije i Troškovi Energije', periodTxt);
            const redovi = cbamAnalitika.redovi.map((r) => `
                <tr><td><b>${escapeHtml(r.mjesec)}</b></td><td class="num">${r.strujaKwh || 0} kWh</td><td class="num">${r.dizelL || 0} L</td><td class="num">${r.scope1Kg} kg</td><td class="num">${r.scope2Kg} kg</td><td class="num"><b>${r.ukupnoCo2Kg} kg</b></td><td class="num">${r.co2PoM3} kg/m³</td></tr>
            `).join('');
            const html = `
                <div class="info-grid">
                    <div class="info-col-left"><h4>CBAM / Carbon Footprint Izvještaj (Scope 1 & 2)</h4><h2>Period: ${periodTxt}</h2><p>Proizvedeno gotove građe: <b>${cbamAnalitika.ukupnoProizvedenoM3.toFixed(3)} m³</b></p></div>
                    <div class="info-col-right"><p>Ukupne emisije: <b>${cbamAnalitika.ukupnoCo2Tone.toFixed(3)} t CO₂e</b></p><p>Specifična emisija: <b>${cbamAnalitika.co2PoM3.toFixed(2)} kg CO₂e / m³</b> (${cbamAnalitika.tCo2PoToni.toFixed(3)} t/t)</p><p>Biogena ušteda (vlastiti otpad): <b>-${(biomasaAnalitika.izbjegnutiCo2Kg / 1000).toFixed(2)} t CO₂e</b></p></div>
                </div>
                ${chartHtml}
                <table>
                    <thead><tr><th>Mjesec</th><th class="num">Struja</th><th class="num">Dizel</th><th class="num">Scope 1</th><th class="num">Scope 2</th><th class="num">Ukupno CO₂e</th><th class="num">kg/m³</th></tr></thead>
                    <tbody>${redovi}</tbody>
                </table>
            `;
            printDokument('CBAM / CO2 IZVJEŠTAJ', `CBAM-${datumOd}`, prikazDatumaBHS(danas), html, '#0284c7');
        } else if (tab === 'BIOMASA') {
            const chartHtml = uhvatiSmartChartSvgHtml('eko_biomasa_chart', 'Bilans Drvnog Otpada i Biomase (m³)', periodTxt);
            const redovi = biomasaAnalitika.utrosakUPeriodu.map((u, i) => `
                <tr><td>${i + 1}.</td><td>${prikazDatumaBHS(u.datum)}</td><td><b>${escapeHtml(u.vrsta)}</b></td><td>${escapeHtml(u.namjena)}</td><td>${escapeHtml(u.komora || u.kupac || u.napomena || '-')}</td><td class="num"><b>${u.kolicinaM3} m³</b></td><td class="num">${u.prihodKM ? `${u.prihodKM} KM` : '-'}</td></tr>
            `).join('');
            const html = `
                <div class="info-grid">
                    <div class="info-col-left"><h4>Bilans Drvnog Otpada & Biomase (Peći / Sušare)</h4><h2>Period: ${periodTxt}</h2></div>
                    <div class="info-col-right"><p>Prirast Biomase: <b>${biomasaAnalitika.ukupniPrirastM3.toFixed(2)} m³</b></p><p>Loženo (Sušare + Grijanje): <b>${biomasaAnalitika.lozenoUkupnoM3.toFixed(2)} m³</b></p><p>Ušteda Energije: <b>${biomasaAnalitika.ustedaEnergijeKM.toFixed(2)} KM</b> | Prodaja: <b>${biomasaAnalitika.prihodOdProdajeKM.toFixed(2)} KM</b></p></div>
                </div>
                ${chartHtml}
                <table>
                    <thead><tr><th>#</th><th>Datum</th><th>Vrsta</th><th>Namjena</th><th>Komora / Kupac / Napomena</th><th class="num">Količina</th><th class="num">Prihod</th></tr></thead>
                    <tbody>${redovi}</tbody>
                </table>
            `;
            printDokument('BILANS BIOMASE I PEĆI', `BIO-${datumOd}`, prikazDatumaBHS(danas), html, '#ea580c');
        } else {
            const svi = [...dobavljaciAnalitika.sumarije, ...dobavljaciAnalitika.prevoznici];
            const redovi = svi.map((d, i) => `
                <tr><td>${i + 1}.</td><td><b>${escapeHtml(d.naziv)}</b></td><td>${d.tip}</td><td class="num">${d.m3.toFixed(3)} m³</td><td class="num">${d.zaduzenjeKM.toFixed(2)} KM</td><td class="num">${d.uplacenoKM.toFixed(2)} KM</td><td class="num"><b>${d.saldoDugKM.toFixed(2)} KM</b></td></tr>
            `).join('');
            const html = `
                <div class="info-grid">
                    <div class="info-col-left"><h4>Finansijska Kartica Dobavljača (Šumarije & Prevoznici)</h4><h2>Stanje na dan: ${prikazDatumaBHS(danas)}</h2></div>
                    <div class="info-col-right"><p>Otvoreni dug Šumarijama: <b>${dobavljaciAnalitika.ukupnoDugSumarije.toFixed(2)} KM</b></p><p>Otvoreni dug Prevoznicima: <b>${dobavljaciAnalitika.ukupnoDugPrevoznici.toFixed(2)} KM</b></p></div>
                </div>
                <table>
                    <thead><tr><th>#</th><th>Dobavljač</th><th>Tip</th><th class="num">Zapremina</th><th class="num">Zaduženje</th><th class="num">Isplaćeno</th><th class="num">Saldo (Dug)</th></tr></thead>
                    <tbody>${redovi}</tbody>
                </table>
            `;
            printDokument('KARTICA DOBAVLJAČA', `DOB-${danas}`, prikazDatumaBHS(danas), html, '#7c3aed');
        }
    };

    const izveziExcel = () => {
        if (tab === 'FSC') {
            exportToExcel({
                filename: `FSC_EUDR_Bilans_${datumOd}_${datumDo}`,
                sheetName: 'FSC & EUDR',
                title: `FSC Chain of Custody & EUDR (${datumOd} - ${datumDo}) | CoC: ${fscPostavke.firmaFscCoc || '-'}`,
                columns: [
                    { key: 'naziv', label: 'Šumarija', width: 190 },
                    { key: 'fscStatus', label: 'FSC Status', width: 130 },
                    { key: 'certBroj', label: 'Broj FSC Certifikata', width: 150 },
                    { key: 'vaziDo', label: 'Važi do', width: 100 },
                    { key: 'gpsLokacija', label: 'EUDR GPS / Poligon', width: 180 },
                    { key: 'eudrOdjel', label: 'Odjel / DDS Ref.', width: 140 },
                ],
                rows: sumarijeBaza.map((s) => ({ naziv: s.naziv, ...(fscPostavke.sumarijeMeta?.[s.naziv] || { fscStatus: 'BEZ_FSC' }) })),
            });
        } else if (tab === 'CBAM') {
            exportToExcel({
                filename: `CBAM_CO2_Izvjestaj_${datumOd}_${datumDo}`,
                sheetName: 'CBAM CO2',
                title: `CBAM / CO₂ Emisije i Energenti (${datumOd} - ${datumDo})`,
                columns: [
                    { key: 'mjesec', label: 'Mjesec', width: 90 },
                    { key: 'strujaKwh', label: 'Struja (kWh)', type: 'number', width: 110 },
                    { key: 'dizelL', label: 'Dizel (L)', type: 'number', width: 95 },
                    { key: 'scope1Kg', label: 'Scope 1 (kg CO₂e)', type: 'number', width: 130 },
                    { key: 'scope2Kg', label: 'Scope 2 (kg CO₂e)', type: 'number', width: 130 },
                    { key: 'ukupnoCo2Kg', label: 'Ukupno CO₂e (kg)', type: 'number', width: 130 },
                    { key: 'm3Mjesec', label: 'Proizvedeno (m³)', type: 'number', width: 115 },
                    { key: 'co2PoM3', label: 'kg CO₂e / m³', type: 'number', width: 110 },
                    { key: 'trosakKM', label: 'Trošak energije (KM)', type: 'number', width: 130 },
                ],
                rows: cbamAnalitika.redovi,
                summaryRow: { mjesec: 'UKUPNO', ukupnoCo2Kg: parseFloat(cbamAnalitika.ukupnoCo2Kg.toFixed(1)), trosakKM: parseFloat(cbamAnalitika.ukupniTroskoviEnergijeKM.toFixed(2)) },
            });
        } else if (tab === 'BIOMASA') {
            exportToExcel({
                filename: `Biomasa_Otpad_Peci_${datumOd}_${datumDo}`,
                sheetName: 'Biomasa i Peći',
                title: `Utrošak Drvnog Otpada i Biomase (${datumOd} - ${datumDo})`,
                columns: [
                    { key: 'datum', label: 'Datum', width: 95 },
                    { key: 'vrsta', label: 'Vrsta otpada', width: 110 },
                    { key: 'namjena', label: 'Namjena', width: 140 },
                    { key: 'kolicinaM3', label: 'Količina (m³)', type: 'number', width: 105 },
                    { key: 'komora', label: 'Sušara / Šarža', width: 150 },
                    { key: 'kupac', label: 'Kupac (prodaja)', width: 140 },
                    { key: 'prihodKM', label: 'Prihod (KM)', type: 'number', width: 100 },
                    { key: 'napomena', label: 'Napomena', width: 180 },
                ],
                rows: biomasaAnalitika.utrosakUPeriodu,
            });
        } else {
            const svi = [...dobavljaciAnalitika.sumarije, ...dobavljaciAnalitika.prevoznici];
            exportToExcel({
                filename: `Kartica_Dobavljaca_${danas}`,
                sheetName: 'Dobavljači',
                title: `Kartica Dugovanja — Šumarije i Prevoznici (${danas})`,
                columns: [
                    { key: 'naziv', label: 'Dobavljač', width: 190 },
                    { key: 'tip', label: 'Tip', width: 105 },
                    { key: 'kom', label: 'Broj trupaca', type: 'number', width: 100 },
                    { key: 'm3', label: 'Zapremina (m³)', type: 'number', width: 115 },
                    { key: 'zaduzenjeKM', label: 'Zaduženje (KM)', type: 'number', width: 125 },
                    { key: 'uplacenoKM', label: 'Isplaćeno (KM)', type: 'number', width: 125 },
                    { key: 'saldoDugKM', label: 'Otvoreni Saldo (KM)', type: 'number', width: 135 },
                ],
                rows: svi,
            });
        }
    };

    return (
        <div data-testid="eko-fsc-module" className="p-4 max-w-7xl mx-auto space-y-6 font-bold animate-in fade-in pb-24" style={{ color: saas.ui.boja_slova || undefined }}>
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-emerald-500" user={user} modulIme="eko_fsc" saas={saas} hideMasina={true} />

            {/* GLAVNI TABOVI */}
            <div className="flex flex-wrap bg-theme-panel p-1.5 rounded-2xl border border-theme-border shadow-inner gap-1.5">
                <button type="button" data-testid="eko-tab-fsc" onClick={() => setTab('FSC')} className={`flex-1 min-w-[140px] py-3 px-3 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all ${tab === 'FSC' ? 'bg-emerald-600 text-white shadow-lg' : 'text-theme-muted hover:text-theme-text'}`}>
                    <Leaf size={15} /> FSC & EUDR
                </button>
                <button type="button" data-testid="eko-tab-cbam" onClick={() => setTab('CBAM')} className={`flex-1 min-w-[140px] py-3 px-3 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all ${tab === 'CBAM' ? 'bg-sky-600 text-white shadow-lg' : 'text-theme-muted hover:text-theme-text'}`}>
                    <Globe size={15} /> CBAM & CO₂
                </button>
                <button type="button" data-testid="eko-tab-biomasa" onClick={() => setTab('BIOMASA')} className={`flex-1 min-w-[150px] py-3 px-3 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all ${tab === 'BIOMASA' ? 'bg-orange-600 text-white shadow-lg' : 'text-theme-muted hover:text-theme-text'}`}>
                    <Flame size={15} /> Biomasa & Peći
                </button>
                <button type="button" data-testid="eko-tab-dobavljaci" onClick={() => setTab('DOBAVLJACI')} className={`flex-1 min-w-[150px] py-3 px-3 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all ${tab === 'DOBAVLJACI' ? 'bg-purple-600 text-white shadow-lg' : 'text-theme-muted hover:text-theme-text'}`}>
                    <Truck size={15} /> Dobavljači (Dug)
                </button>
            </div>

            {/* PERIOD & IZVOZ TRAKA */}
            <div className="bg-theme-card p-4 rounded-2xl border border-theme-border shadow-xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase font-black text-theme-muted">Period izvještaja:</span>
                    <input type="date" value={datumOd} onChange={(e) => setDatumOd(e.target.value)} className="p-2.5 bg-theme-panel border border-theme-border rounded-xl text-xs font-black text-theme-text outline-none" />
                    <span className="text-theme-muted">→</span>
                    <input type="date" value={datumDo} onChange={(e) => setDatumDo(e.target.value)} className="p-2.5 bg-theme-panel border border-theme-border rounded-xl text-xs font-black text-theme-text outline-none" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" data-testid="eko-excel-btn" onClick={izveziExcel} className="px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/40 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 transition-all">
                        <FileSpreadsheet size={14} /> Excel Izvještaj
                    </button>
                    <button type="button" data-testid="eko-pdf-btn" onClick={stampajPdf} className="px-4 py-2.5 bg-theme-panel hover:bg-white hover:text-black text-theme-text border border-slate-600 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 transition-all">
                        <Printer size={14} /> Isprintaj PDF
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="p-16 text-center text-xs uppercase font-black text-theme-muted animate-pulse">Učitavam podatke za EKO, FSC, CBAM i Biomasu...</div>
            ) : (
                <>
                    {/* ========================================================= */}
                    {/* TAB 1: FSC CHAIN OF CUSTODY & EUDR                        */}
                    {/* ========================================================= */}
                    {tab === 'FSC' && (
                        <div data-testid="eko-fsc-panel" className="space-y-6 animate-in fade-in">
                            {fscAnalitika.certAlarmi.length > 0 && (
                                <div className="p-4 rounded-2xl bg-red-950/35 border-2 border-red-500/60 flex items-start gap-3">
                                    <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
                                    <div className="text-xs text-red-200 space-y-1">
                                        <p className="font-black uppercase text-red-400">⚠️ Alarm FSC Certifikata Šumarija!</p>
                                        {fscAnalitika.certAlarmi.map((a) => (
                                            <p key={a.naziv}>
                                                <b>{a.naziv}</b> ({a.certBroj || 'bez broja'}) — {a.istek.status === 'ISTEKAO' ? `ISTEKAO prije ${Math.abs(a.istek.dana)} dana!` : `Ističe za ${a.istek.dana} dana (${a.vaziDo})`}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* KPI KARTICE */}
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                <div className="bg-theme-card p-5 rounded-2xl border border-emerald-500/40 shadow-xl">
                                    <span className="text-[9px] text-emerald-400 uppercase font-black block">FSC Ulaz Trupaca</span>
                                    <p className="text-2xl font-black text-emerald-400 mt-1">{fscAnalitika.ukupnoFscUlazM3.toFixed(2)} <span className="text-xs">m³</span></p>
                                    <span className="text-[10px] text-theme-muted">{fscAnalitika.fscUdioProc.toFixed(1)}% ukupnog ulaza</span>
                                </div>
                                <div className="bg-theme-card p-5 rounded-2xl border border-blue-500/40 shadow-xl">
                                    <span className="text-[9px] text-blue-400 uppercase font-black block">FSC Proizvedena Građa</span>
                                    <p className="text-2xl font-black text-blue-400 mt-1">{fscAnalitika.izlazFscM3.toFixed(2)} <span className="text-xs">m³</span></p>
                                    <span className="text-[10px] text-theme-muted">Ne-FSC izlaz: {fscAnalitika.izlazBezFscM3.toFixed(2)} m³</span>
                                </div>
                                <div className="bg-theme-card p-5 rounded-2xl border border-amber-500/40 shadow-xl">
                                    <span className="text-[9px] text-amber-400 uppercase font-black block">Konverzijski Faktor</span>
                                    <p className="text-2xl font-black text-amber-400 mt-1">{(fscAnalitika.konverzijskiFaktor * 100).toFixed(1)}%</p>
                                    <span className="text-[10px] text-theme-muted">Stvarni FSC Yield</span>
                                </div>
                                <div className="bg-theme-card p-5 rounded-2xl border border-purple-500/40 shadow-xl">
                                    <span className="text-[9px] text-purple-400 uppercase font-black block">FSC Kreditni Saldo</span>
                                    <p className={`text-2xl font-black mt-1 ${fscAnalitika.fscKreditSaldoM3 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fscAnalitika.fscKreditSaldoM3.toFixed(2)} <span className="text-xs">m³</span></p>
                                    <span className="text-[10px] text-theme-muted">FSC Mix Credit račun</span>
                                </div>
                                <div className="bg-theme-card p-5 rounded-2xl border border-theme-border shadow-xl col-span-2 lg:col-span-1">
                                    <span className="text-[9px] text-theme-muted uppercase font-black block">Miješani Paketi (Upoz.)</span>
                                    <p className={`text-2xl font-black mt-1 ${fscAnalitika.mijesaniPaketi > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{fscAnalitika.mijesaniPaketi}</p>
                                    <span className="text-[10px] text-theme-muted">{fscAnalitika.mijesaniPaketi === 0 ? 'Čista sljedivost ✅' : 'FSC + ne-FSC trupci'}</span>
                                </div>
                            </div>

                            {/* POSTAVKE FIRME ZA FSC COC */}
                            <div className="bg-theme-card p-6 rounded-2xl border border-emerald-500/30 shadow-xl space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-theme-border pb-3">
                                    <h3 className="text-xs font-black uppercase text-emerald-400 flex items-center gap-2"><ShieldCheck size={16} /> Vaš FSC® CoC Certifikat (Automatski ispis na Otpremnici i Računu)</h3>
                                    <button type="button" data-testid="save-fsc-btn" onClick={handleSpasiFsc} className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase flex items-center gap-1.5 shadow-md">
                                        <Save size={14} /> Spasi FSC & EUDR Postavke
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div>
                                        <label className="text-[9px] text-theme-muted uppercase block mb-1">Vaš FSC CoC Broj</label>
                                        <input value={fscPostavke.firmaFscCoc} onChange={(e) => setFscPostavke((p) => ({ ...p, firmaFscCoc: e.target.value.toUpperCase() }))} placeholder="npr. FSC-C184920" className="w-full p-3 rounded-xl bg-theme-panel border border-theme-border text-xs font-black text-theme-text" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-theme-muted uppercase block mb-1">Default FSC Claim</label>
                                        <select value={fscPostavke.defaultClaim} onChange={(e) => setFscPostavke((p) => ({ ...p, defaultClaim: e.target.value }))} className="w-full p-3 rounded-xl bg-theme-panel border border-theme-border text-xs font-black text-theme-text">
                                            <option value="FSC 100%">FSC 100%</option>
                                            <option value="FSC Mix Credit">FSC Mix Credit</option>
                                            <option value="FSC Mix 70%">FSC Mix 70%</option>
                                            <option value="FSC Controlled Wood">FSC Controlled Wood</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-theme-muted uppercase block mb-1">Početni FSC Kredit (m³)</label>
                                        <input type="number" step="0.1" value={fscPostavke.kreditPocetniM3} onChange={(e) => setFscPostavke((p) => ({ ...p, kreditPocetniM3: e.target.value }))} className="w-full p-3 rounded-xl bg-theme-panel border border-theme-border text-xs font-black text-theme-text" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-theme-muted uppercase block mb-1">Zadani Konv. Faktor</label>
                                        <input type="number" step="0.01" min="0.1" max="1" value={fscPostavke.defaultConversionFactor} onChange={(e) => setFscPostavke((p) => ({ ...p, defaultConversionFactor: e.target.value }))} className="w-full p-3 rounded-xl bg-theme-panel border border-theme-border text-xs font-black text-theme-text" />
                                    </div>
                                </div>
                            </div>

                            {/* ŠUMARIJE: FSC CERTIFIKATI I EUDR GPS GEOLOKACIJA */}
                            <div className="bg-theme-card p-6 rounded-2xl border border-theme-border shadow-xl space-y-4">
                                <h3 className="text-xs font-black uppercase text-theme-accent">🌲 Registar Šumarija — FSC Certifikati & EUDR Geolokacija (GPS / Odjel)</h3>
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left text-xs min-w-[820px]">
                                        <thead className="bg-theme-panel text-slate-400 uppercase text-[10px]">
                                            <tr>
                                                <th className="p-3">Šumarija</th>
                                                <th className="p-3">FSC Status</th>
                                                <th className="p-3">Broj FSC Certifikata</th>
                                                <th className="p-3">Važi do</th>
                                                <th className="p-3">EUDR GPS Koordinate / Poligon</th>
                                                <th className="p-3">Odjel / DDS Ref.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-theme-border">
                                            {sumarijeBaza.length === 0 && (
                                                <tr><td colSpan="6" className="p-6 text-center text-theme-muted italic">Nema unesenih šumarija u Podešavanjima.</td></tr>
                                            )}
                                            {sumarijeBaza.map((s) => {
                                                const m = fscPostavke.sumarijeMeta?.[s.naziv] || {};
                                                const istek = statusIstekaCertifikata(m.vaziDo);
                                                return (
                                                    <tr key={s.id} className="hover:bg-theme-panel/40">
                                                        <td className="p-3 font-black text-theme-text uppercase">{s.naziv}</td>
                                                        <td className="p-2">
                                                            <select value={m.fscStatus || 'BEZ_FSC'} onChange={(e) => updateSumarijaMeta(s.naziv, 'fscStatus', e.target.value)} className="w-full p-2 rounded-lg bg-theme-panel border border-theme-border text-[11px] font-black text-theme-text">
                                                                <option value="BEZ_FSC">Bez FSC</option>
                                                                <option value="FSC 100%">FSC 100%</option>
                                                                <option value="FSC Mix">FSC Mix</option>
                                                                <option value="FSC Controlled Wood">FSC Controlled Wood</option>
                                                            </select>
                                                        </td>
                                                        <td className="p-2">
                                                            <input value={m.certBroj || ''} onChange={(e) => updateSumarijaMeta(s.naziv, 'certBroj', e.target.value.toUpperCase())} placeholder="npr. SGS-FM/COC-..." className="w-full p-2 rounded-lg bg-theme-panel border border-theme-border text-[11px] text-theme-text font-mono" />
                                                        </td>
                                                        <td className="p-2">
                                                            <input type="date" value={m.vaziDo || ''} onChange={(e) => updateSumarijaMeta(s.naziv, 'vaziDo', e.target.value)} className={`w-full p-2 rounded-lg bg-theme-panel border text-[11px] text-theme-text ${istek.status === 'ISTEKAO' ? 'border-red-500' : istek.status === 'USKORO' ? 'border-amber-500' : 'border-theme-border'}`} />
                                                        </td>
                                                        <td className="p-2">
                                                            <input value={m.gpsLokacija || ''} onChange={(e) => updateSumarijaMeta(s.naziv, 'gpsLokacija', e.target.value)} placeholder="npr. 44.7068, 18.4882" className="w-full p-2 rounded-lg bg-theme-panel border border-theme-border text-[11px] text-theme-text font-mono" />
                                                        </td>
                                                        <td className="p-2">
                                                            <input value={m.eudrOdjel || ''} onChange={(e) => updateSumarijaMeta(s.naziv, 'eudrOdjel', e.target.value)} placeholder="Odjel 42 / DDS..." className="w-full p-2 rounded-lg bg-theme-panel border border-theme-border text-[11px] text-theme-text" />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ========================================================= */}
                    {/* TAB 2: CBAM & CO₂ OTISAK + REŽIJSKI TROŠKOVI ENERGIJE     */}
                    {/* ========================================================= */}
                    {tab === 'CBAM' && (
                        <div data-testid="eko-cbam-panel" className="space-y-6 animate-in fade-in">
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                <div className="bg-theme-card p-5 rounded-2xl border border-sky-500/40 shadow-xl">
                                    <span className="text-[9px] text-sky-400 uppercase font-black block">Ukupno CO₂e (Scope 1+2)</span>
                                    <p className="text-2xl font-black text-sky-400 mt-1">{cbamAnalitika.ukupnoCo2Tone.toFixed(2)} <span className="text-xs">t</span></p>
                                    <span className="text-[10px] text-theme-muted">S1: {(cbamAnalitika.scope1Kg / 1000).toFixed(2)}t | S2: {(cbamAnalitika.scope2Kg / 1000).toFixed(2)}t</span>
                                </div>
                                <div className="bg-theme-card p-5 rounded-2xl border border-blue-500/40 shadow-xl">
                                    <span className="text-[9px] text-blue-400 uppercase font-black block">Specifična Emisija / m³</span>
                                    <p className="text-2xl font-black text-theme-text mt-1">{cbamAnalitika.co2PoM3.toFixed(1)} <span className="text-xs text-blue-400">kg/m³</span></p>
                                    <span className="text-[10px] text-theme-muted">CBAM: {cbamAnalitika.tCo2PoToni.toFixed(3)} t CO₂e / t</span>
                                </div>
                                <div className="bg-theme-card p-5 rounded-2xl border border-emerald-500/40 shadow-xl">
                                    <span className="text-[9px] text-emerald-400 uppercase font-black block">Biogena Ušteda (Peći)</span>
                                    <p className="text-2xl font-black text-emerald-400 mt-1">-{(biomasaAnalitika.izbjegnutiCo2Kg / 1000).toFixed(2)} <span className="text-xs">t CO₂e</span></p>
                                    <span className="text-[10px] text-theme-muted">CO₂-neutralna piljevina/okorak</span>
                                </div>
                                <div className="bg-theme-card p-5 rounded-2xl border border-amber-500/40 shadow-xl">
                                    <span className="text-[9px] text-amber-400 uppercase font-black block">Trošak Energenata</span>
                                    <p className="text-2xl font-black text-amber-400 mt-1">{cbamAnalitika.ukupniTroskoviEnergijeKM.toFixed(0)} <span className="text-xs">KM</span></p>
                                    <span className="text-[10px] text-theme-muted">Struja + Dizel + Režije</span>
                                </div>
                                <div className="bg-theme-card p-5 rounded-2xl border border-purple-500/40 shadow-xl col-span-2 lg:col-span-1">
                                    <span className="text-[9px] text-purple-400 uppercase font-black block">Režija / m³ Građe</span>
                                    <p className="text-2xl font-black text-purple-400 mt-1">{cbamAnalitika.rezijaPoM3KM.toFixed(2)} <span className="text-xs">KM/m³</span></p>
                                    <span className="text-[10px] text-theme-muted">Za realnu cijenu koštanja</span>
                                </div>
                            </div>

                            {/* UNOS MJESEČNIH ENERGENATA */}
                            <div className="bg-theme-card p-6 rounded-2xl border border-sky-500/30 shadow-xl space-y-4">
                                <h3 className="text-xs font-black uppercase text-sky-400">⚡ Mjesečni Unos Energenata & Režija (Struja, Dizel, Održavanje)</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                                    <div>
                                        <label className="text-[9px] text-theme-muted uppercase block mb-1">Mjesec</label>
                                        <input type="month" value={noviCbam.mjesec} onChange={(e) => setNoviCbam((p) => ({ ...p, mjesec: e.target.value }))} className="w-full p-2.5 rounded-xl bg-theme-panel border border-theme-border text-xs font-black text-theme-text" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-theme-muted uppercase block mb-1">Struja (kWh)</label>
                                        <input type="number" value={noviCbam.strujaKwh} onChange={(e) => setNoviCbam((p) => ({ ...p, strujaKwh: e.target.value }))} placeholder="npr. 18500" className="w-full p-2.5 rounded-xl bg-theme-panel border border-theme-border text-xs font-black text-theme-text" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-theme-muted uppercase block mb-1">Račun Struja (KM)</label>
                                        <input type="number" value={noviCbam.trosakStrujaKM} onChange={(e) => setNoviCbam((p) => ({ ...p, trosakStrujaKM: e.target.value }))} placeholder="KM" className="w-full p-2.5 rounded-xl bg-theme-panel border border-theme-border text-xs font-black text-amber-400" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-theme-muted uppercase block mb-1">Dizel (L)</label>
                                        <input type="number" value={noviCbam.dizelL} onChange={(e) => setNoviCbam((p) => ({ ...p, dizelL: e.target.value }))} placeholder="npr. 1200" className="w-full p-2.5 rounded-xl bg-theme-panel border border-theme-border text-xs font-black text-theme-text" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-theme-muted uppercase block mb-1">Trošak Dizel (KM)</label>
                                        <input type="number" value={noviCbam.trosakDizelKM} onChange={(e) => setNoviCbam((p) => ({ ...p, trosakDizelKM: e.target.value }))} placeholder="KM" className="w-full p-2.5 rounded-xl bg-theme-panel border border-theme-border text-xs font-black text-amber-400" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-theme-muted uppercase block mb-1">Ostale Režije (KM)</label>
                                        <input type="number" value={noviCbam.trosakOstaloKM} onChange={(e) => setNoviCbam((p) => ({ ...p, trosakOstaloKM: e.target.value }))} placeholder="Ulje, trake..." className="w-full p-2.5 rounded-xl bg-theme-panel border border-theme-border text-xs font-black text-theme-text" />
                                    </div>
                                    <div className="flex items-end">
                                        <button type="button" onClick={handleDodajCbam} className="w-full py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-black uppercase flex items-center justify-center gap-1 shadow-md">
                                            <Plus size={14} /> Snimi Mjesec
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[10px] text-theme-muted">
                                    Faktori emisije: Električna energija BiH grid <b>{noviCbam.faktorStruja} kg CO₂e/kWh</b> • Dizel <b>{noviCbam.faktorDizel} kg CO₂e/L</b> • Vlastita biomasa u pećima = <b>0 kg fosilnog CO₂e (biogena energija)</b>.
                                </p>
                            </div>

                            {cbamAnalitika.chartData.length > 0 && (
                                <div className="bg-theme-card p-6 rounded-2xl border border-theme-border shadow-xl">
                                    <SmartChart
                                        chartId="eko_cbam_chart"
                                        title="🌍 Mjesečne CO₂e Emisije (Scope 1 Dizel vs Scope 2 Struja)"
                                        subtitle="Automatski se ugrađuje u CBAM / CO₂ PDF izvještaj"
                                        data={cbamAnalitika.chartData}
                                        xKey="mjesec"
                                        series={[
                                            { key: 'Scope1_kg', name: 'Scope 1 (Dizel)', color: '#f59e0b', unit: 'kg' },
                                            { key: 'Scope2_kg', name: 'Scope 2 (Struja)', color: '#0284c7', unit: 'kg' },
                                        ]}
                                        defaultType="bar"
                                        unit="kg"
                                        height={260}
                                    />
                                </div>
                            )}

                            <div className="bg-theme-card p-6 rounded-2xl border border-theme-border shadow-xl">
                                <h3 className="text-xs font-black uppercase text-theme-text mb-3">📋 Mjesečni Registar CBAM & Energenata</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-theme-panel text-slate-400 uppercase text-[10px]">
                                            <tr>
                                                <th className="p-3">Mjesec</th>
                                                <th className="p-3 text-right">Struja</th>
                                                <th className="p-3 text-right">Dizel</th>
                                                <th className="p-3 text-right">Scope 1</th>
                                                <th className="p-3 text-right">Scope 2</th>
                                                <th className="p-3 text-right">Ukupno CO₂e</th>
                                                <th className="p-3 text-right">kg CO₂e/m³</th>
                                                <th className="p-3 text-right">Trošak (KM)</th>
                                                <th className="p-3 text-center">Akcija</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-theme-border">
                                            {cbamAnalitika.redovi.length === 0 && (
                                                <tr><td colSpan="9" className="p-6 text-center text-theme-muted italic">Nema unesenih mjesečnih energenata u ovom periodu. Unesite prvi mjesec iznad.</td></tr>
                                            )}
                                            {cbamAnalitika.redovi.map((r) => (
                                                <tr key={r.id} className="hover:bg-theme-panel/50">
                                                    <td className="p-3 font-black text-sky-400">{r.mjesec}</td>
                                                    <td className="p-3 text-right">{r.strujaKwh || 0} kWh</td>
                                                    <td className="p-3 text-right">{r.dizelL || 0} L</td>
                                                    <td className="p-3 text-right text-amber-400">{r.scope1Kg} kg</td>
                                                    <td className="p-3 text-right text-sky-400">{r.scope2Kg} kg</td>
                                                    <td className="p-3 text-right font-black text-theme-text">{r.ukupnoCo2Kg} kg</td>
                                                    <td className="p-3 text-right font-black text-emerald-400">{r.co2PoM3}</td>
                                                    <td className="p-3 text-right font-black text-amber-400">{r.trosakKM.toFixed(2)} KM</td>
                                                    <td className="p-3 text-center">
                                                        <button type="button" onClick={() => handleObrisiCbam(r.id)} className="p-1.5 rounded-lg bg-red-900/20 text-red-400 hover:bg-red-600 hover:text-white"><Trash2 size={13} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ========================================================= */}
                    {/* TAB 3: BIOMASA & UTROŠAK OTPADA (PEĆI / SUŠARE / PRODAJA) */}
                    {/* ========================================================= */}
                    {tab === 'BIOMASA' && (
                        <div data-testid="eko-biomasa-panel" className="space-y-6 animate-in fade-in">
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                <div className="bg-theme-card p-5 rounded-2xl border border-amber-500/40 shadow-xl">
                                    <span className="text-[9px] text-amber-400 uppercase font-black block">Prirast Otpada (Prorez)</span>
                                    <p className="text-2xl font-black text-amber-400 mt-1">{biomasaAnalitika.ukupniPrirastM3.toFixed(1)} <span className="text-xs">m³</span></p>
                                    <span className="text-[10px] text-theme-muted">Piljev. {biomasaAnalitika.prirastPiljevina.toFixed(1)} | Okor. {biomasaAnalitika.prirastOkorak.toFixed(1)}</span>
                                </div>
                                <div className="bg-theme-card p-5 rounded-2xl border border-orange-500/40 shadow-xl">
                                    <span className="text-[9px] text-orange-400 uppercase font-black block">Loženo u Pećima (Sušare)</span>
                                    <p className="text-2xl font-black text-orange-400 mt-1">{biomasaAnalitika.poNamjeni.SUŠARA.toFixed(1)} <span className="text-xs">m³</span></p>
                                    <span className="text-[10px] text-theme-muted">Grijanje objekata: {biomasaAnalitika.poNamjeni.GRIJANJE_OBJEKATA.toFixed(1)} m³</span>
                                </div>
                                <div className="bg-theme-card p-5 rounded-2xl border border-emerald-500/40 shadow-xl">
                                    <span className="text-[9px] text-emerald-400 uppercase font-black block">Ušteda Energije (Peći)</span>
                                    <p className="text-2xl font-black text-emerald-400 mt-1">{biomasaAnalitika.ustedaEnergijeKM.toFixed(0)} <span className="text-xs">KM</span></p>
                                    <span className="text-[10px] text-theme-muted">Sušenje: ~{biomasaAnalitika.cijenaSusenjaPoM3.toFixed(1)} KM/m³</span>
                                </div>
                                <div className="bg-theme-card p-5 rounded-2xl border border-blue-500/40 shadow-xl">
                                    <span className="text-[9px] text-blue-400 uppercase font-black block">Prodaja Otpada</span>
                                    <p className="text-2xl font-black text-blue-400 mt-1">{biomasaAnalitika.prihodOdProdajeKM.toFixed(0)} <span className="text-xs">KM</span></p>
                                    <span className="text-[10px] text-theme-muted">{biomasaAnalitika.poNamjeni.PRODAJA.toFixed(1)} m³ prodato</span>
                                </div>
                                <div className="bg-theme-card p-5 rounded-2xl border border-theme-border shadow-xl col-span-2 lg:col-span-1">
                                    <span className="text-[9px] text-theme-muted uppercase font-black block">Lager Biomase na Placu</span>
                                    <p className="text-2xl font-black text-theme-text mt-1">{biomasaAnalitika.stanjeNaPlacuM3.toFixed(1)} <span className="text-xs">m³</span></p>
                                    <span className="text-[10px] text-theme-muted">Procijenjena zaliha</span>
                                </div>
                            </div>

                            {/* FORMA ZA EVIDENCIJU LOŽENJA U PEĆI / PRODAJE */}
                            <div className="bg-theme-card p-6 rounded-2xl border border-orange-500/40 shadow-xl space-y-4">
                                <h3 className="text-xs font-black uppercase text-orange-400 flex items-center gap-2"><Flame size={16} /> Evidentiraj Utrošak u Peći (Sušare / Grijanje Objekata) ili Prodaju Otpada</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div>
                                        <label className="text-[9px] text-theme-muted uppercase block mb-1">Datum</label>
                                        <input type="date" value={noviUtrosak.datum} onChange={(e) => setNoviUtrosak((p) => ({ ...p, datum: e.target.value }))} className="w-full p-2.5 rounded-xl bg-theme-panel border border-theme-border text-xs font-black text-theme-text" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-theme-muted uppercase block mb-1">Vrsta Otpada / Biomase</label>
                                        <select value={noviUtrosak.vrsta} onChange={(e) => setNoviUtrosak((p) => ({ ...p, vrsta: e.target.value }))} className="w-full p-2.5 rounded-xl bg-theme-panel border border-theme-border text-xs font-black text-theme-text">
                                            <option value="PILJEVINA">Piljevina</option>
                                            <option value="OKORAK">Okorak</option>
                                            <option value="SJEČKA">Sječka</option>
                                            <option value="KORA">Kora</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-theme-muted uppercase block mb-1">Namjena</label>
                                        <select value={noviUtrosak.namjena} onChange={(e) => setNoviUtrosak((p) => ({ ...p, namjena: e.target.value }))} className="w-full p-2.5 rounded-xl bg-theme-panel border border-theme-border text-xs font-black text-theme-text">
                                            <option value="SUŠARA">🔥 Peć — Grijanje Sušara</option>
                                            <option value="GRIJANJE_OBJEKATA">🏠 Peć — Grijanje Objekata / Hala</option>
                                            <option value="PRODAJA">💵 Prodaja Otpada (Peletara / Ogrjev)</option>
                                            <option value="OTPAD_KOREKCIJA">🧹 Odvoz / Korekcija</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-theme-muted uppercase block mb-1">Količina (m³ / prm)</label>
                                        <input type="number" step="0.1" value={noviUtrosak.kolicinaM3} onChange={(e) => setNoviUtrosak((p) => ({ ...p, kolicinaM3: e.target.value }))} placeholder="npr. 4.5" className="w-full p-2.5 rounded-xl bg-theme-panel border border-orange-500/50 text-xs font-black text-orange-400" />
                                    </div>
                                    {noviUtrosak.namjena === 'SUŠARA' && (
                                        <div className="sm:col-span-2">
                                            <label className="text-[9px] text-theme-muted uppercase block mb-1">Poveži sa Šaržom Sušare (Opcionalno)</label>
                                            <select value={noviUtrosak.sarzaId} onChange={(e) => setNoviUtrosak((p) => ({ ...p, sarzaId: e.target.value }))} className="w-full p-2.5 rounded-xl bg-theme-panel border border-theme-border text-xs font-black text-theme-text">
                                                <option value="">-- Opće loženje kotlovnice za sušare --</option>
                                                {susareSarze.map((sz) => (
                                                    <option key={sz.id} value={sz.id}>{sz.komora} — Paket {sz.paket_id} ({sz.m3} m³, {sz.status})</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {noviUtrosak.namjena === 'PRODAJA' && (
                                        <>
                                            <div>
                                                <label className="text-[9px] text-theme-muted uppercase block mb-1">Kupac Otpada</label>
                                                <input value={noviUtrosak.kupac} onChange={(e) => setNoviUtrosak((p) => ({ ...p, kupac: e.target.value }))} placeholder="Naziv kupca..." className="w-full p-2.5 rounded-xl bg-theme-panel border border-theme-border text-xs text-theme-text" />
                                            </div>
                                            <div>
                                                <label className="text-[9px] text-theme-muted uppercase block mb-1">Prihod (KM)</label>
                                                <input type="number" value={noviUtrosak.prihodKM} onChange={(e) => setNoviUtrosak((p) => ({ ...p, prihodKM: e.target.value }))} placeholder="KM" className="w-full p-2.5 rounded-xl bg-theme-panel border border-emerald-500/40 text-xs font-black text-emerald-400" />
                                            </div>
                                        </>
                                    )}
                                    <div className={noviUtrosak.namjena === 'SUŠARA' || noviUtrosak.namjena === 'PRODAJA' ? 'sm:col-span-1' : 'sm:col-span-3'}>
                                        <label className="text-[9px] text-theme-muted uppercase block mb-1">Napomena (Peć 1/2, smjena...)</label>
                                        <input value={noviUtrosak.napomena} onChange={(e) => setNoviUtrosak((p) => ({ ...p, napomena: e.target.value }))} placeholder="npr. Noćna smjena kotao 1..." className="w-full p-2.5 rounded-xl bg-theme-panel border border-theme-border text-xs text-theme-text" />
                                    </div>
                                    <div className="flex items-end">
                                        <button type="button" data-testid="save-biomasa-btn" onClick={handleDodajUtrosakBiomase} className="w-full py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-black uppercase flex items-center justify-center gap-1.5 shadow-md">
                                            <Plus size={14} /> Evidentiraj
                                        </button>
                                    </div>
                                </div>

                                {/* Podesivi koeficijenti prirasta */}
                                <div className="pt-3 border-t border-theme-border/60 flex flex-wrap items-end gap-3">
                                    <span className="text-[9px] uppercase font-black text-theme-muted">Koeficijenti prirasta iz trupca:</span>
                                    <label className="text-[9px] text-theme-muted flex items-center gap-1">Piljevina %: <input type="number" value={biomasaPostavke.koeficijenti.piljevinaProc} onChange={(e) => setBiomasaPostavke((p) => ({ ...p, koeficijenti: { ...p.koeficijenti, piljevinaProc: e.target.value } }))} className="w-14 p-1.5 rounded-lg bg-theme-panel border border-theme-border text-center text-theme-text font-black" /></label>
                                    <label className="text-[9px] text-theme-muted flex items-center gap-1">Okorak %: <input type="number" value={biomasaPostavke.koeficijenti.okorakProc} onChange={(e) => setBiomasaPostavke((p) => ({ ...p, koeficijenti: { ...p.koeficijenti, okorakProc: e.target.value } }))} className="w-14 p-1.5 rounded-lg bg-theme-panel border border-theme-border text-center text-theme-text font-black" /></label>
                                    <label className="text-[9px] text-theme-muted flex items-center gap-1">Kora %: <input type="number" value={biomasaPostavke.koeficijenti.koraProc} onChange={(e) => setBiomasaPostavke((p) => ({ ...p, koeficijenti: { ...p.koeficijenti, koraProc: e.target.value } }))} className="w-14 p-1.5 rounded-lg bg-theme-panel border border-theme-border text-center text-theme-text font-black" /></label>
                                    <label className="text-[9px] text-theme-muted flex items-center gap-1">Ušteda KM/m³: <input type="number" value={biomasaPostavke.koeficijenti.cijenaUstedePoM3} onChange={(e) => setBiomasaPostavke((p) => ({ ...p, koeficijenti: { ...p.koeficijenti, cijenaUstedePoM3: e.target.value } }))} className="w-16 p-1.5 rounded-lg bg-theme-panel border border-theme-border text-center text-emerald-400 font-black" /></label>
                                    <button type="button" onClick={handleSpasiKoeficijenteBiomase} className="px-3 py-1.5 rounded-lg bg-theme-panel hover:bg-emerald-600 hover:text-white border border-theme-border text-[9px] font-black uppercase">💾 Spasi Koef.</button>
                                </div>
                            </div>

                            <div className="bg-theme-card p-6 rounded-2xl border border-theme-border shadow-xl">
                                <SmartChart
                                    chartId="eko_biomasa_chart"
                                    title="🔥 Prirast vs Utrošak Biomase po Frakcijama (m³)"
                                    subtitle="Usporedba nastalog otpada sa loženjem u pećima i prodajom"
                                    data={biomasaAnalitika.chartData}
                                    xKey="stavka"
                                    series={[
                                        { key: 'Prirast', name: 'Nastali Otpad', color: '#f59e0b', unit: 'm³' },
                                        { key: 'Utrosak', name: 'Loženo / Prodato', color: '#ea580c', unit: 'm³' },
                                    ]}
                                    defaultType="bar"
                                    unit="m³"
                                    height={250}
                                />
                            </div>

                            <div className="bg-theme-card p-6 rounded-2xl border border-theme-border shadow-xl">
                                <h3 className="text-xs font-black uppercase text-orange-400 mb-3">📋 Dnevnik Loženja Peći i Prodaje Otpada ({biomasaAnalitika.utrosakUPeriodu.length})</h3>
                                <div className="overflow-x-auto max-h-80 custom-scrollbar">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-theme-panel text-slate-400 uppercase text-[10px] sticky top-0">
                                            <tr>
                                                <th className="p-3">Datum</th>
                                                <th className="p-3">Vrsta</th>
                                                <th className="p-3">Namjena</th>
                                                <th className="p-3">Komora / Kupac / Napomena</th>
                                                <th className="p-3 text-right">Količina</th>
                                                <th className="p-3 text-right">Prihod</th>
                                                <th className="p-3 text-center">Akcija</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-theme-border">
                                            {biomasaAnalitika.utrosakUPeriodu.length === 0 && (
                                                <tr><td colSpan="7" className="p-6 text-center text-theme-muted italic">Još nema evidentiranih loženja ili prodaje biomase u ovom periodu.</td></tr>
                                            )}
                                            {biomasaAnalitika.utrosakUPeriodu.map((u) => (
                                                <tr key={u.id} className="hover:bg-theme-panel/50">
                                                    <td className="p-3">{prikazDatumaBHS(u.datum)}</td>
                                                    <td className="p-3 font-black text-amber-400">{u.vrsta}</td>
                                                    <td className="p-3 font-bold">{u.namjena}</td>
                                                    <td className="p-3 text-theme-muted">{[u.komora, u.kupac, u.napomena].filter(Boolean).join(' • ') || '-'}</td>
                                                    <td className="p-3 text-right font-black text-orange-400">{u.kolicinaM3} m³</td>
                                                    <td className="p-3 text-right font-black text-emerald-400">{u.prihodKM ? `${u.prihodKM} KM` : '-'}</td>
                                                    <td className="p-3 text-center">
                                                        <button type="button" onClick={() => handleObrisiUtrosakBiomase(u.id)} className="p-1.5 rounded-lg bg-red-900/20 text-red-400 hover:bg-red-600 hover:text-white"><Trash2 size={13} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ========================================================= */}
                    {/* TAB 4: DOBAVLJAČI — KARTICA ŠUMARIJA & PREVOZNIKA (DUG)   */}
                    {/* ========================================================= */}
                    {tab === 'DOBAVLJACI' && (
                        <div data-testid="eko-dobavljaci-panel" className="space-y-6 animate-in fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-theme-card p-5 rounded-2xl border border-purple-500/40 shadow-xl">
                                    <span className="text-[10px] text-purple-400 uppercase font-black block">Otvoreni Saldo — Šumarije</span>
                                    <p className="text-2xl font-black text-purple-400 mt-1">{dobavljaciAnalitika.ukupnoDugSumarije.toFixed(2)} <span className="text-xs">KM</span></p>
                                    <span className="text-[10px] text-theme-muted">{dobavljaciAnalitika.sumarije.length} aktivnih šumarija u evidenciji</span>
                                </div>
                                <div className="bg-theme-card p-5 rounded-2xl border border-amber-500/40 shadow-xl">
                                    <span className="text-[10px] text-amber-400 uppercase font-black block">Otvoreni Saldo — Prevoznici</span>
                                    <p className="text-2xl font-black text-amber-400 mt-1">{dobavljaciAnalitika.ukupnoDugPrevoznici.toFixed(2)} <span className="text-xs">KM</span></p>
                                    <span className="text-[10px] text-theme-muted">{dobavljaciAnalitika.prevoznici.length} prevoznika trupaca</span>
                                </div>
                                <div className="bg-theme-card p-5 rounded-2xl border border-red-500/40 shadow-xl">
                                    <span className="text-[10px] text-red-400 uppercase font-black block">Ukupne Obaveze (Dobavljači)</span>
                                    <p className="text-2xl font-black text-red-400 mt-1">{(dobavljaciAnalitika.ukupnoDugSumarije + dobavljaciAnalitika.ukupnoDugPrevoznici).toFixed(2)} <span className="text-xs">KM</span></p>
                                    <span className="text-[10px] text-theme-muted">Automatski: Prijem trupaca − Isplate u Blagajni</span>
                                </div>
                            </div>

                            {[
                                { naslov: '🌲 Kartica Šumarija (Nabavka Trupaca)', lista: dobavljaciAnalitika.sumarije, boja: 'text-emerald-400' },
                                { naslov: '🚚 Kartica Prevoznika Trupaca', lista: dobavljaciAnalitika.prevoznici, boja: 'text-amber-400' },
                            ].map((sekcija) => (
                                <div key={sekcija.naslov} className="bg-theme-card p-6 rounded-2xl border border-theme-border shadow-xl">
                                    <h3 className={`text-xs font-black uppercase ${sekcija.boja} mb-4`}>{sekcija.naslov}</h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-theme-panel text-slate-400 uppercase text-[10px]">
                                                <tr>
                                                    <th className="p-3">Dobavljač</th>
                                                    <th className="p-3 text-right">Trupaca</th>
                                                    <th className="p-3 text-right">Zapremina</th>
                                                    <th className="p-3 text-right">Zaduženje (Prijem)</th>
                                                    <th className="p-3 text-right">Isplaćeno (Blagajna)</th>
                                                    <th className="p-3 text-right">Otvoreni Saldo</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-theme-border">
                                                {sekcija.lista.length === 0 && (
                                                    <tr><td colSpan="6" className="p-6 text-center text-theme-muted italic">Nema evidentiranih stavki.</td></tr>
                                                )}
                                                {sekcija.lista.map((d) => (
                                                    <tr key={d.naziv} className="hover:bg-theme-panel/50">
                                                        <td className="p-3 font-black text-theme-text uppercase">{d.naziv}</td>
                                                        <td className="p-3 text-right">{d.kom} kom</td>
                                                        <td className="p-3 text-right font-mono text-sky-400">{d.m3.toFixed(3)} m³</td>
                                                        <td className="p-3 text-right font-bold">{d.zaduzenjeKM.toFixed(2)} KM</td>
                                                        <td className="p-3 text-right text-emerald-400 font-bold">-{d.uplacenoKM.toFixed(2)} KM</td>
                                                        <td className={`p-3 text-right font-black ${d.saldoDugKM > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{d.saldoDugKM.toFixed(2)} KM</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
