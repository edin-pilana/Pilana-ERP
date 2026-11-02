"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import MasterHeader from '../components/MasterHeader';
import TabAiAnalitika from '../components/TabAiAnalitika';
import { printDokument } from '../utils/printHelpers';
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

    if (deb > 0 && sir > 0 && duz > 0 && kolUlaz > 0) {
        const vol1Kom = (deb / 100) * (sir / 100) * (duz / 100);
        if (jm === 'kom') {
            return parseFloat((kolUlaz * vol1Kom).toFixed(4));
        }
        if (jm === 'm2') {
            const area1Kom = (sir / 100) * (duz / 100);
            const kom = area1Kom > 0 ? kolUlaz / area1Kom : 0;
            return parseFloat((kom * vol1Kom).toFixed(4));
        }
        if (jm === 'm1') {
            const len1Kom = duz / 100;
            const kom = len1Kom > 0 ? kolUlaz / len1Kom : 0;
            return parseFloat((kom * vol1Kom).toFixed(4));
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
        boja_kartice: '#1e293b',
        boja_slova: '#ffffff',
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
    const [masineBaza, setMasineBaza] = useState([]);
    const [trupciBaza, setTrupciBaza] = useState([]);
    const [prorezLogBaza, setProrezLogBaza] = useState([]);
    const [paketiBaza, setPaketiBaza] = useState([]);
    const [dnevnikMasineBaza, setDnevnikMasineBaza] = useState([]);
    const [katalogBaza, setKatalogBaza] = useState([]);
    const [reklamacijeBaza, setReklamacijeBaza] = useState([]);
    const [blagajnaBaza, setBlagajnaBaza] = useState([]);
    const [radniSatiBaza, setRadniSatiBaza] = useState([]);
    const [radniciBaza, setRadniciBaza] = useState([]);

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
            const [mRes, tRes, prRes, pkRes, dmRes, katRes, rekRes, blRes, rsRes, radRes] = await Promise.all([
                supabase.from('masine').select('*').order('naziv'),
                supabase.from('trupci').select('*'),
                supabase.from('prorez_log').select('*'),
                supabase.from('paketi').select('*').gt('kolicina_final', 0),
                supabase.from('dnevnik_masine').select('*'),
                supabase.from('katalog_proizvoda').select('*'),
                supabase.from('reklamacije').select('*'),
                supabase.from('blagajna').select('*'),
                supabase.from('radni_sati').select('*'),
                supabase.from('radnici').select('*')
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
            setDatumDo('2026-12-31');
        }
    };

    const efektivniOd = datumOd;
    const efektivniDo = modVremena === 'DAN' ? datumOd : datumDo;

    const uOpseguDatuma = (datumStr, createdAtStr) => {
        let d = (datumStr || '').split('T')[0];
        if (!d && createdAtStr) d = createdAtStr.split('T')[0];
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

        // Paketi proizvedeni na Pilani u istom periodu
        const paketiPilanaSirovi = paketiBaza.filter(p => {
            const m = (p.masina || '').toUpperCase();
            const jePilana = m.includes('PILANA') || m.includes('BRENTA') || !p.ai_sirovina_ids || (Array.isArray(p.ai_sirovina_ids) && p.ai_sirovina_ids.length === 0);
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
        const ukupnoZastojaMin = zastojiLista.reduce((s, z) => s + parseInt(z.zastoj_min || 0), 0);

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
        // Svi izlazni paketi sa mašina dorade (koji prate i datum i masinaFilter!)
        const paketiDorade = paketiBaza.filter(p => {
            const m = (p.masina || '').toUpperCase();
            const jeDorada = (!m.includes('PILANA') && !m.includes('BRENTA') && m !== '') || (Array.isArray(p.ai_sirovina_ids) && p.ai_sirovina_ids.length > 0);
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

        const stvarniKaloM3 = Math.max(0, ukupnoUlazSirovineM3 - izlazDoradaM3);
        const efikasnostProc = ukupnoUlazSirovineM3 > 0 ? ((izlazDoradaM3 / ukupnoUlazSirovineM3) * 100) : 0;

        const zastojiDorada = dnevnikMasineBaza.filter(d => {
            if (d.modul !== 'Dorada') return false;
            if (!uOpseguDatuma(d.datum, d.created_at)) return false;
            if (masinaFilter !== 'SVE' && (d.masina || '').toUpperCase() !== masinaFilter.toUpperCase()) return false;
            return true;
        });
        const zastojiMin = zastojiDorada.reduce((s, z) => s + parseInt(z.zastoj_min || 0), 0);

        // 🟢 POPRAVLJEN GRAFIKON DORADE: Ako je za odabranu mašinu KPI 0.00 m3, i grafikon je 100% prazan/nula za tu mašinu!
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
            const kat = katalogBaza.find(k => k.sifra === p.sifra_proizvoda || k.naziv === p.naziv_proizvoda);
            const cijenaPoM3 = parseFloat(kat?.cijena || 600);
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

        // Trošak blagajne (IZLAZ u periodu)
        const izlazBlagajnaKM = blagajnaBaza
            .filter(b => b.tip === 'IZLAZ' && uOpseguDatuma(b.datum, b.created_at))
            .reduce((s, b) => s + parseFloat(b.iznos || 0), 0);

        const ukupniTrosakKM = parseFloat((trosakSirovineKM + izlazBlagajnaKM).toFixed(2));

        // Udar od odobrenih reklamacija
        const reklamacijeUPeriodu = reklamacijeBaza.filter(r => r.status === 'ODOBRENO' && uOpseguDatuma(null, r.created_at));
        let gubitakReklamacijeKM = 0;
        reklamacijeUPeriodu.forEach(r => {
            const kat = katalogBaza.find(k => k.naziv === r.naziv_proizvoda || k.sifra === r.naziv_proizvoda);
            const cijena = parseFloat(kat?.cijena || 600);
            gubitakReklamacijeKM += (parseFloat(r.kolicina || 0) * cijena);
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

    const stampajIzvjestaj = () => {
        const periodTekst = `${formatDatumBHS(efektivniOd)} - ${formatDatumBHS(efektivniDo)}`;
        let html = '';

        if (tab === 'PROREZ') {
            const redovi = analitikaProrez.gotovaRobaLista.map((r, i) => `
                <tr>
                    <td>${i + 1}.</td>
                    <td><b>${r.paket_id}</b></td>
                    <td>${r.naziv_proizvoda}</td>
                    <td style="text-align:center;"><b>${r.dimenzije}</b></td>
                    <td style="text-align:center;">${r.komada} kom</td>
                    <td class="num">${r.m3.toFixed(3)} m³</td>
                </tr>
            `).join('');

            html = `
                <div class="info-grid">
                    <div class="info-col-left"><h4>Izvještaj Proreza i Pilane</h4><h2>Period: ${periodTekst}</h2><p>Mašina: <b>${masinaFilter}</b></p></div>
                    <div class="info-col-right"><p>Izrezano Trupaca: <b>${analitikaProrez.izrezanoM3.toFixed(3)} m³ (${analitikaProrez.brojTrupaca} kom)</b></p><p>Proizvedeno Građe: <b>${analitikaProrez.proizvedenoM3.toFixed(3)} m³</b></p><p>Iskorištenost (Yield): <b>${analitikaProrez.yieldProc.toFixed(1)}%</b></p></div>
                </div>
                <table>
                    <thead><tr><th>#</th><th>Paket ID</th><th>Proizvod</th><th style="text-align:center;">Dimenzije (cm)</th><th style="text-align:center;">Komada</th><th class="num">Volumen (m³)</th></tr></thead>
                    <tbody>${redovi}</tbody>
                </table>
            `;
            printDokument('IZVJEŠTAJ PROREZA', `PROREZ-${efektivniOd}`, formatDatumBHS(danas), html, '#ef4444');
        } else if (tab === 'DORADA') {
            const redovi = analitikaDorada.sljedivostLista.map((r, i) => `
                <tr>
                    <td>${i + 1}.</td>
                    <td><b>${r.paket_id}</b></td>
                    <td>${r.naziv} (${r.dimenzije})</td>
                    <td>${r.ulazniPaketi}</td>
                    <td>${r.masina}</td>
                    <td class="num">${r.izlazM3.toFixed(3)} m³</td>
                </tr>
            `).join('');

            html = `
                <div class="info-grid">
                    <div class="info-col-left"><h4>Izvještaj Dorade</h4><h2>Period: ${periodTekst}</h2><p>Mašina: <b>${masinaFilter}</b></p></div>
                    <div class="info-col-right"><p>Ulaz Sirovine: <b>${analitikaDorada.ulazSirovinaM3.toFixed(3)} m³</b></p><p>Izlaz Gotove Robe: <b>${analitikaDorada.izlazGotovoM3.toFixed(3)} m³</b></p><p>Stvarni Kalo: <b>${analitikaDorada.stvarniKaloM3.toFixed(3)} m³</b></p></div>
                </div>
                <table>
                    <thead><tr><th>#</th><th>Izlazni Paket</th><th>Proizvod (cm)</th><th>Ulazna Sirovina</th><th>Mašina</th><th class="num">Izlaz (m³)</th></tr></thead>
                    <tbody>${redovi}</tbody>
                </table>
            `;
            printDokument('IZVJEŠTAJ DORADE', `DORADA-${efektivniOd}`, formatDatumBHS(danas), html, '#f59e0b');
        } else {
            html = `
                <div class="info-grid">
                    <div class="info-col-left"><h4>Finansijski i Materijalni Bilans</h4><h2>Period: ${periodTekst}</h2></div>
                    <div class="info-col-right"><p>Čisti Profit: <b>${analitikaFinansije.cistiProfitKM.toFixed(2)} KM</b></p></div>
                </div>
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

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6 font-bold animate-in fade-in pb-24" style={{ color: saas.ui.boja_slova }}>
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-blue-500" user={user} modulIme="analitika" saas={saas} hideMasina={true} />

            {/* GLAVNI TABOVI ANALITIKE */}
            <div className="flex flex-wrap bg-theme-panel p-1.5 rounded-2xl border border-theme-border shadow-inner gap-1">
                <button onClick={() => setTab('PROREZ')} className={`flex-1 min-w-[120px] py-3 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-1.5 ${tab === 'PROREZ' ? 'bg-red-600 text-white shadow-lg' : 'text-theme-muted hover:text-theme-text'}`}>🪚 PROREZ</button>
                <button onClick={() => setTab('DORADA')} className={`flex-1 min-w-[120px] py-3 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-1.5 ${tab === 'DORADA' ? 'bg-amber-600 text-white shadow-lg' : 'text-theme-muted hover:text-theme-text'}`}>🔄 DORADA</button>
                <button onClick={() => setTab('UKUPNO')} className={`flex-1 min-w-[120px] py-3 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-1.5 ${tab === 'UKUPNO' ? 'bg-blue-600 text-white shadow-lg' : 'text-theme-muted hover:text-theme-text'}`}>📊 UKUPNO</button>
                <button onClick={() => setTab('FINANSIJE')} className={`flex-1 min-w-[120px] py-3 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-1.5 ${tab === 'FINANSIJE' ? 'bg-emerald-600 text-white shadow-lg' : 'text-theme-muted hover:text-theme-text'}`}>💰 FINANSIJE</button>
                <button onClick={() => setTab('AI')} className={`flex-1 min-w-[140px] py-3 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-1.5 ${tab === 'AI' ? 'bg-indigo-600 text-white shadow-lg' : 'text-indigo-400 hover:bg-indigo-950/30'}`}>🤖 AI KONTROLOR</button>
            </div>

            {/* FILTER TRAKA (Prikazuje se za sve tabove osim AI Kontrolora) */}
            {tab !== 'AI' && (
                <div className="bg-theme-card p-4 rounded-2xl border border-theme-border shadow-xl flex flex-col lg:flex-row justify-between items-center gap-4">
                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                        <div className="flex bg-theme-panel p-1 rounded-xl border border-theme-border">
                            <button onClick={() => setModVremena('DAN')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ${modVremena === 'DAN' ? 'bg-theme-accent text-white' : 'text-slate-400'}`}>Dan</button>
                            <button onClick={() => setModVremena('PERIOD')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ${modVremena === 'PERIOD' ? 'bg-theme-accent text-white' : 'text-slate-400'}`}>Period</button>
                        </div>

                        <input type="date" value={datumOd} onChange={e => setDatumOd(e.target.value)} className="p-2.5 bg-theme-panel border border-theme-border rounded-xl text-xs text-theme-text font-black outline-none" />
                        {modVremena === 'PERIOD' && (
                            <>
                                <span className="text-slate-500 font-black">→</span>
                                <input type="date" value={datumDo} onChange={e => setDatumDo(e.target.value)} className="p-2.5 bg-theme-panel border border-theme-border rounded-xl text-xs text-theme-text font-black outline-none" />
                            </>
                        )}

                        <div className="flex gap-1">
                            <button onClick={() => postaviBrziPeriod('DANAS')} className="px-2.5 py-2 bg-theme-panel hover:bg-slate-700 text-slate-300 rounded-lg text-[9px] font-black uppercase border border-theme-border">Danas</button>
                            <button onClick={() => postaviBrziPeriod('7DANA')} className="px-2.5 py-2 bg-theme-panel hover:bg-slate-700 text-slate-300 rounded-lg text-[9px] font-black uppercase border border-theme-border">7 Dana</button>
                            <button onClick={() => postaviBrziPeriod('OVAJ_MJ')} className="px-2.5 py-2 bg-theme-panel hover:bg-slate-700 text-slate-300 rounded-lg text-[9px] font-black uppercase border border-theme-border">Ovaj Mj</button>
                            <button onClick={() => postaviBrziPeriod('SVE')} className="px-2.5 py-2 bg-theme-panel hover:bg-slate-700 text-amber-400 rounded-lg text-[9px] font-black uppercase border border-amber-500/30">Sve</button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
                        {(tab === 'PROREZ' || tab === 'DORADA') && (
                            <select value={masinaFilter} onChange={e => setMasinaFilter(e.target.value)} className="p-2.5 bg-theme-panel border border-theme-border rounded-xl text-xs text-theme-text font-black uppercase outline-none cursor-pointer">
                                <option value="SVE">Sve Mašine ({tab})</option>
                                {masineZaDropdown.map(m => <option key={m.id} value={m.naziv}>{m.naziv}</option>)}
                            </select>
                        )}
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

                    {/* GRAFIKON PROREZA */}
                    <div className="bg-theme-card p-6 rounded-2xl border border-theme-border shadow-2xl">
                        <h3 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-widest">📈 Dnevni Trend Proreza ({masinaFilter})</h3>
                        <div className="h-72 w-full">
                            {analitikaProrez.chartData.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-xs text-slate-500 italic border border-dashed border-theme-border rounded-xl">Nema podataka za odabrani period i mašinu ({masinaFilter}).</div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={analitikaProrez.chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                        <XAxis dataKey="datum" stroke="#94a3b8" fontSize={10} />
                                        <YAxis stroke="#94a3b8" fontSize={10} />
                                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
                                        <Legend />
                                        <Area type="monotone" dataKey="Ulaz_Trupci" name="Ulaz Trupci (m³)" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
                                        <Area type="monotone" dataKey="Izlaz_Daska" name="Izlaz Građa (m³)" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
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

                    {/* 🟢 GRAFIKON DORADE KOJI 100% PRATI FILTER MAŠINE */}
                    <div className="bg-theme-card p-6 rounded-2xl border border-theme-border shadow-2xl">
                        <h3 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-widest">📊 Proizvodnja Dorade po danima ({masinaFilter})</h3>
                        <div className="h-72 w-full">
                            {analitikaDorada.chartData.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-xs text-slate-500 italic border border-dashed border-theme-border rounded-xl">
                                    Nema evidentirane proizvodnje za mašinu "{masinaFilter}" u odabranom periodu (0.00 m³).
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analitikaDorada.chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                        <XAxis dataKey="datum" stroke="#94a3b8" fontSize={10} />
                                        <YAxis stroke="#94a3b8" fontSize={10} />
                                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
                                        <Legend />
                                        <Bar dataKey="Ulaz_Sirovina" name="Ulaz Sirovina (m³)" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                                        <Bar dataKey="Izlaz_Gotovo" name="Izlaz Gotovo (m³)" fill="#10b981" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
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
                </div>
            )}

            {/* TAB 5: AI KONTROLOR */}
            {tab === 'AI' && <TabAiAnalitika saas={saas} />}
        </div>
    );
}