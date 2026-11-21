"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import MasterHeader from '../components/MasterHeader';
import MasterSearch from '../components/MasterSearch';
import PametniDialog from '../components/PametniDialog';
import ScannerOverlay from '../components/ScannerOverlay';
import { printDeklaracijaPaketa } from '../utils/printHelpers';
import { useSaaS } from '../utils/useSaaS';

export default function LagerPaketaModule({ onExit, user, header, setHeader }) {
    const saas = useSaaS('lager_modul', {
        boja_kartice: '#1e293b',
        boja_slova: '#ffffff',
        velicina_naslova: '16',
        boja_teksta: '#3b82f6'
    });

    const [glavniTab, setGlavniTab] = useState('paketi');
    const [subTabPaketi, setSubTabPaketi] = useState('NA STANJU');

    const [paketi, setPaketi] = useState([]);
    const [sviPaketiRaw, setSviPaketiRaw] = useState([]);
    const [trupci, setTrupci] = useState([]);
    const [aktivniNalozi, setAktivniNalozi] = useState([]);
    const [katalog, setKatalog] = useState([]);

    const [loading, setLoading] = useState(false);
    const [pretraga, setPretraga] = useState('');
    const [isScanning, setIsScanning] = useState(false);

    const [selektovaniPaket, setSelektovaniPaket] = useState(null);
    const [historija, setHistorija] = useState([]);
    const [izvedeniPaketi, setIzvedeniPaketi] = useState([]);
    const [isPrinting, setIsPrinting] = useState(false);

    const [fPaket, setFPaket] = useState({ rn: '', debljinaOd: '', debljinaDo: '', sirinaOd: '', sirinaDo: '', duzinaOd: '', duzinaDo: '' });

    // --- ZOOM: smanjivanje i povećavanje cijelog lagera ---
    // Prije nije bilo zoom-outa: moglo se samo povećati (font u God Mode-u, min 8px),
    // a točkić / pinch su samo scrollali. Sad zoom ide 40% - 200%, koliko želiš.
    // Način: Ctrl + točkić (standard, radi svugdje) + pinch na mobitelu (2 prsta) +
    // tipke - / + / Reset + klizač. Ako uključiš "Točkić = zoom", onda i običan točkić
    // bez Ctrl-a zumira, a ne scrolla. Inače običan točkić normalno scrolla.
    const [zoom, setZoom] = useState(() => { try { const v = parseFloat(localStorage.getItem('lager_zoom') || '1'); return Number.isFinite(v) ? Math.min(2, Math.max(0.4, v)) : 1; } catch { return 1; } });
    const [zoomWheelZoom, setZoomWheelZoom] = useState(() => { try { return localStorage.getItem('lager_zoom_wheel') === '1'; } catch { return false; } });
    const zoomRef = useRef(null);
    const pinchRef = useRef({ dist: 0, zoom: 1 });
    const clampZoom = (v) => Math.min(2, Math.max(0.4, v));
    useEffect(() => { try { localStorage.setItem('lager_zoom', String(zoom)); } catch {} }, [zoom]);
    useEffect(() => { try { localStorage.setItem('lager_zoom_wheel', zoomWheelZoom ? '1' : '0'); } catch {} }, [zoomWheelZoom]);
    useEffect(() => {
        const el = zoomRef.current;
        if (!el) return;
        const onWheel = (e) => {
            if (!(e.ctrlKey || e.metaKey || zoomWheelZoom)) return;
            e.preventDefault();
            // Gore (deltaY < 0) = povećaj, dolje (deltaY > 0) = smanji. Korak je mali da ne preskače.
            setZoom(z => clampZoom(z - e.deltaY * 0.0012));
        };
        const dist2 = (t0, t1) => Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        const onTouchStart = (e) => {
            if (e.touches.length === 2) { pinchRef.current = { dist: dist2(e.touches[0], e.touches[1]), zoom }; }
        };
        const onTouchMove = (e) => {
            if (e.touches.length !== 2) return;
            e.preventDefault();
            const d = dist2(e.touches[0], e.touches[1]);
            if (pinchRef.current.dist > 0 && d > 0) setZoom(() => clampZoom(pinchRef.current.zoom * (d / pinchRef.current.dist)));
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        return () => { el.removeEventListener('wheel', onWheel); el.removeEventListener('touchstart', onTouchStart); el.removeEventListener('touchmove', onTouchMove); };
    }, [zoomWheelZoom, zoom]);

    // --- Podesavanja Lagera (Uredi / God Mode) ---
    // Uredi sada uredjuje i ovaj modul, ne samo header: labele filtera, vidljivost,
    // te velicina i boja slova za SVAKU stavku na plocici (dimenzije, naziv, RN...).
    // Cuva se u localStorage, pa ostaje i nakon reloada.
    const [lagerPodesavanja, setLagerPodesavanja] = useState(() => {
        try { return JSON.parse(localStorage.getItem('lager_podesavanja') || '{}') || {}; } catch { return {}; }
    });
    const pod = {
        labelBrza: lagerPodesavanja.labelBrza ?? 'Brza pretraga po ID-u ili Nazivu...',
        labelRN: lagerPodesavanja.labelRN ?? 'Radni Nalog — univerzalna pretraga',
        labelDebljina: lagerPodesavanja.labelDebljina ?? 'Debljina (cm od-do)',
        labelSirina: lagerPodesavanja.labelSirina ?? 'Širina (cm od-do)',
        labelDuzina: lagerPodesavanja.labelDuzina ?? 'Dužina (cm od-do)',
        labelPretragaPlaceholder: lagerPodesavanja.labelPretragaPlaceholder ?? 'Kupac, broj RN-a, proizvod, dimenzija, ponuda ili status...',
        prikaziFiltere: lagerPodesavanja.prikaziFiltere ?? true,
        prikaziRNPanel: lagerPodesavanja.prikaziRNPanel ?? true,
        prikaziKupacNaPlocici: lagerPodesavanja.prikaziKupacNaPlocici ?? true,
        prikaziMasinaNaPlocici: lagerPodesavanja.prikaziMasinaNaPlocici ?? true,
        prikaziJMNaPlocici: lagerPodesavanja.prikaziJMNaPlocici ?? true,
        prikaziProgresNaPlocici: lagerPodesavanja.prikaziProgresNaPlocici ?? true,
    };
    // Stil po stavci na plocici: velicina (px) + boja. Prazna boja = automatska (default klasa).
    // Dimenzije su po defaultu vece (18px) jer je to najvazniji podatak na plocici.
    const defaultTileStil = {
        paketId: { size: 18, color: '' },
        naziv: { size: 14, color: '' },
        dimenzija: { size: 18, color: '#fbbf24' },
        rn: { size: 9, color: '' },
        kupac: { size: 9, color: '' },
        masina: { size: 9, color: '' },
        ukupno: { size: 20, color: '#34d399' },
        komadi: { size: 14, color: '' },
        progres: { size: 12, color: '' },
        info: { size: 9, color: '' },
    };
    const tileStil = {};
    Object.keys(defaultTileStil).forEach(k => {
        const s = (lagerPodesavanja.tileStil || {})[k] || {};
        tileStil[k] = { size: s.size ?? defaultTileStil[k].size, color: s.color ?? defaultTileStil[k].color };
    });
    const stilZa = (kljuc) => ({ fontSize: `${tileStil[kljuc]?.size ?? 14}px`, ...(tileStil[kljuc]?.color ? { color: tileStil[kljuc].color } : {}) });
    useEffect(() => { try { localStorage.setItem('lager_podesavanja', JSON.stringify(lagerPodesavanja)); } catch {} }, [lagerPodesavanja]);
    const promijeniPod = (kljuc, vrijednost) => setLagerPodesavanja(prev => ({ ...prev, [kljuc]: vrijednost }));
    const promijeniTileStil = (kljuc, polje, vrijednost) => setLagerPodesavanja(prev => ({ ...prev, tileStil: { ...(prev.tileStil || {}), [kljuc]: { ...(prev.tileStil?.[kljuc] || {}), [polje]: vrijednost } } }));
    // Dual JM: default JM iz kataloga + JM iz RN-a/ponude. Ako su isti, prikazi samo jedan.
    // Primjer: katalog default = kom, RN = m3 -> "1.500 m3 (= 25.00 kom)". Ako su oba m3 -> samo "1.500 m3".
    const dualJMInfo = (stavka) => {
        const kat = katalog.find(kk => kk.sifra === stavka?.sifra);
        const jmDefault = String(kat?.default_jedinica || kat?.jm || kat?.jedinica || '').toLowerCase() || null;
        const jmRN = String(stavka?.jm_obracun || stavka?.jm_unos || 'm3').toLowerCase();
        const isti = jmDefault && jmDefault === jmRN;
        return { jmDefault, jmRN, isti, kat };
    };
    const vrijednostUJm = (komada, dim, ciljJM) => komadiUKolicinu(komada, dim, ciljJM);

    // STATE ZA RUČNI (SLOBODNI) ULAZ
    const [rucniUlazForm, setRucniUlazForm] = useState({ naziv: '', debljina: '', sirina: '', duzina: '', kolicina: '', jm: 'kom', klasa: 'Standard' });
    const generisiIDPaketa = () => `RUČNO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const livePreracunRucniM3 = useMemo(() => {
        if(!rucniUlazForm.kolicina || isNaN(rucniUlazForm.kolicina)) return 0;
        const v = parseFloat(rucniUlazForm.debljina) || 1;
        const s = parseFloat(rucniUlazForm.sirina) || 1;
        const d = parseFloat(rucniUlazForm.duzina) || 1;
        const unosKol = parseFloat(rucniUlazForm.kolicina);
        
        let komada = unosKol;
        if (rucniUlazForm.jm === 'm3') komada = unosKol / ((v/100) * (s/100) * (d/100));
        else if (rucniUlazForm.jm === 'm2') komada = unosKol / ((s/100) * (d/100));
        else if (rucniUlazForm.jm === 'm1') komada = unosKol / (d/100);
        
        return (komada * (v/100) * (s/100) * (d/100)).toFixed(3);
    }, [rucniUlazForm]);

    const [dialog, setDialog] = useState({ isOpen: false });
    const prikaziDialog = (opcije) => setDialog({ isOpen: true, confirmText: 'POTVRDI', cancelText: 'ZATVORI', ...opcije });
    const zatvoriDialog = () => setDialog({ isOpen: false });

    // 🟢 SVE DIMENZIJE SE NORMALIZUJU U CENTIMETRE (cm)
    // Napomena: u bazi su dimenzije paketa vec u cm (Pilana/Dorada/katalog rade u cm),
    // pa ova funkcija samo parsira. Da je negdje bilo mm ili m, ovdje bi morala i konverzija.
    const normalizujDimenzije = (p) => {
        let d = parseFloat(p.debljina) || 0;
        let s = parseFloat(p.sirina) || 0;
        let l = parseFloat(p.duzina) || 0;
        return { debljina: d, sirina: s, duzina: l };
    };

    // ============ UNIVERZALNA PRETRAGA ZA POLJE "RADNI NALOG" ============
    // Jedno polje pretrazuje SVE: broj RN-a, kupca, status, broj ponude, datum,
    // rok, napomenu, tip naloga, te po svakoj stavci: sifru, naziv, dimenziju, JM i kolicine.
    // Kucanje samo po sebi filtrira, odabir iz dropdowna samo suzava na jedan konkretan RN.
    const normalizujZaPretragu = (v) => String(v ?? '')
        .toUpperCase()
        .replace(/Ć/g, 'C').replace(/Č/g, 'C').replace(/Š/g, 'S').replace(/Ž/g, 'Z').replace(/Đ/g, 'D')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    const parseDimenzijeTekst = (txt) => {
        if (!txt) return null;
        const m = String(txt).match(/(\d+(?:[.,]\d+)?)\s*[xX*]\s*(\d+(?:[.,]\d+)?)\s*[xX*]\s*(\d+(?:[.,]\d+)?)/);
        if (!m) return null;
        return { debljina: parseFloat(m[1].replace(',', '.')), sirina: parseFloat(m[2].replace(',', '.')), duzina: parseFloat(m[3].replace(',', '.')) };
    };
    const dimenzijeKljuc = (d, s, l) => `${parseFloat(d) || 0}x${parseFloat(s) || 0}x${parseFloat(l) || 0}`;
    const vol1Kom = (d, s, l) => ((parseFloat(d) || 0) / 100) * ((parseFloat(s) || 0) / 100) * ((parseFloat(l) || 0) / 100);
    const area1Kom = (s, l) => ((parseFloat(s) || 0) / 100) * ((parseFloat(l) || 0) / 100);

    const redUKomade = (red) => {
        const jm = String(red?.jm || 'kom').toLowerCase();
        const ulaz = parseFloat(red?.kolicina_ulaz ?? red?.komada ?? 0) || 0;
        const v = vol1Kom(red?.debljina, red?.sirina, red?.duzina);
        const a = area1Kom(red?.sirina, red?.duzina);
        const duzM = (parseFloat(red?.duzina) || 0) / 100;
        if (jm === 'kom') return ulaz;
        if (jm === 'm3') return v > 0 ? ulaz / v : (parseFloat(red?.kolicina_final || 0) / (v || 1));
        if (jm === 'm2') return a > 0 ? ulaz / a : 0;
        if (jm === 'm1') return duzM > 0 ? ulaz / duzM : 0;
        return ulaz;
    };
    const komadiUKolicinu = (komada, dim, ciljJM) => {
        const jm = String(ciljJM || 'm3').toLowerCase();
        if (!dim) return komada;
        if (jm === 'kom') return komada;
        if (jm === 'm3') return komada * vol1Kom(dim.debljina, dim.sirina, dim.duzina);
        if (jm === 'm2') return komada * area1Kom(dim.sirina, dim.duzina);
        if (jm === 'm1') return komada * ((parseFloat(dim.duzina) || 0) / 100);
        return komada;
    };

    const tekstZaPretraguRN = (nalog) => {
        const stavke = Array.isArray(nalog?.stavke_jsonb) ? nalog.stavke_jsonb : [];
        const stavkeTekst = stavke.map(st => [
            st.sifra, st.naziv, st.dimenzije, st.dimenzija,
            st.jm_unos, st.jm_obracun, st.jm,
            st.kolicina_unos, st.kolicina_obracun, st.kolicina,
        ].filter(x => x !== undefined && x !== null && x !== '').join(' ')).join(' | ');
        const katZaStavku = stavke.map(st => {
            const k = katalog.find(kk => kk.sifra === st.sifra);
            return k ? `${k.visina}x${k.sirina}x${k.duzina} ${k.naziv} ${k.kategorija}` : '';
        }).join(' ');
        return [
            nalog?.id, nalog?.kupac_naziv, nalog?.status, nalog?.broj_ponude,
            nalog?.datum, nalog?.rok_isporuke, nalog?.napomena, nalog?.tip_naloga,
            stavkeTekst, katZaStavku,
        ].filter(Boolean).join(' | ');
    };

    const daLiNalogOdgovara = (nalog, upit) => {
        const q = normalizujZaPretragu(upit);
        if (!q) return false;
        const idNorm = normalizujZaPretragu(nalog?.id);
        if (idNorm && q === idNorm) return true;
        const tekst = normalizujZaPretragu(tekstZaPretraguRN(nalog));
        const tekstBezRazmaka = tekst.replace(/\s+/g, '');
        const tokeni = q.split(/[\s,;]+/).filter(Boolean);
        return tokeni.every(tok => {
            const tokBezRazmaka = tok.replace(/\s+/g, '');
            return tekst.includes(tok) || tekstBezRazmaka.includes(tokBezRazmaka);
        });
    };

    const pronadjiNalogeZaUpit = (upit, nalozi) => {
        const q = normalizujZaPretragu(upit);
        if (!q) return [];
        const tacan = (nalozi || []).find(n => normalizujZaPretragu(n.id) === q);
        if (tacan) return [tacan];
        const nadjeni = (nalozi || []).filter(n => daLiNalogOdgovara(n, upit));
        nadjeni.sort((a, b) => {
            const aKupac = normalizujZaPretragu(a.kupac_naziv).startsWith(q) ? 0 : 1;
            const bKupac = normalizujZaPretragu(b.kupac_naziv).startsWith(q) ? 0 : 1;
            if (aKupac !== bKupac) return aKupac - bKupac;
            return String(b.datum || '').localeCompare(String(a.datum || ''));
        });
        return nadjeni;
    };

    const mapaNaloziPoId = useMemo(() => {
        const m = new Map();
        (aktivniNalozi || []).forEach(n => { if (n?.id) m.set(String(n.id).toUpperCase(), n); });
        return m;
    }, [aktivniNalozi]);

    const kupacZaPaket = (paket) => {
        const ids = [paket?.broj_veze, paket?.rn_id, ...(paket?.brojVezeSet || []), ...(paket?.rnIdSet || [])].filter(Boolean);
        for (const id of ids) {
            const n = mapaNaloziPoId.get(String(id).toUpperCase());
            if (n?.kupac_naziv) return n.kupac_naziv;
        }
        return '';
    };


    useEffect(() => {
        loadData();
        const channel = supabase.channel(`lager_realtime_channel_${Math.random()}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'paketi' }, () => loadData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'trupci' }, () => loadData())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [glavniTab, subTabPaketi]);

    const grupirajPakete = (redovi) => {
        const mapa = {};
        (redovi || []).forEach(p => {
            const pid = (p.paket_id !== undefined && p.paket_id !== null && String(p.paket_id).trim() !== '') ? String(p.paket_id) : `__RED__${p.id}`;
            if (!mapa[pid]) {
                mapa[pid] = {
                    ...p,
                    paket_id: pid,
                    jeBezIdPaketa: String(p.paket_id || '').trim() === '',
                    redovi: [],
                    dimenzijeSet: new Set(),
                    dimenzijeLista: [],
                    brojVezeSet: new Set(),
                    rnIdSet: new Set(),
                    jmSet: new Set(),
                    kolicina_final: 0,
                    kolicina_ulaz_po_jm: {},
                    kolicina_ulaz_kom_procjena: 0,
                };
            }
            const g = mapa[pid];
            g.redovi.push(p);
            g.dimenzijeSet.add(dimenzijeKljuc(p.debljina, p.sirina, p.duzina));
            if (p.broj_veze) g.brojVezeSet.add(String(p.broj_veze).toUpperCase());
            if (p.rn_id) g.rnIdSet.add(String(p.rn_id).toUpperCase());
            if (p.jm) g.jmSet.add(String(p.jm).toLowerCase());
            g.kolicina_final += parseFloat(p.kolicina_final || 0);
            const jmNorm = String(p.jm || 'kom').toLowerCase();
            g.kolicina_ulaz_po_jm[jmNorm] = (g.kolicina_ulaz_po_jm[jmNorm] || 0) + (parseFloat(p.kolicina_ulaz ?? p.komada ?? 0) || 0);
            g.kolicina_ulaz_kom_procjena += redUKomade(p);
            if (p.created_at && (!g.created_at || p.created_at < g.created_at)) g.created_at = p.created_at;
        });
        const grupirani = Object.values(mapa).map(g => {
            const dimenzijeLista = Array.from(g.dimenzijeSet);
            const jeDoradaPotrosenRed = (r) =>
                String(r.status || '').toUpperCase() === 'POTROŠENO_U_DORADI' ||
                String(r.otpremnica_id || '').toUpperCase().startsWith('POTROSENO-DORADA');
            const jeOtpremljenKupcuRed = (r) =>
                !jeDoradaPotrosenRed(r) &&
                r.otpremnica_id !== null && r.otpremnica_id !== undefined && String(r.otpremnica_id) !== '';
            const jeZatvorenIzlazRed = (r) => jeDoradaPotrosenRed(r) || jeOtpremljenKupcuRed(r);

            const imaOtpremljen = g.redovi.some(jeZatvorenIzlazRed);
            const sviOtpremljeni = g.redovi.length > 0 && g.redovi.every(jeZatvorenIzlazRed);
            const sviPotroseniUDoradi = g.redovi.length > 0 && g.redovi.every(jeDoradaPotrosenRed);
            const imaOtvoren = g.redovi.some(r => (r.closed_at === null || r.closed_at === undefined) && !jeZatvorenIzlazRed(r));
            const aktivniRedovi = g.redovi.filter(r => !jeZatvorenIzlazRed(r));
            const imaNaStanju = aktivniRedovi.some(r => r.closed_at !== null && r.closed_at !== undefined);

            let tab = 'NA STANJU';
            let statusOznaka = 'ZAVRŠEN';
            if (sviPotroseniUDoradi) { tab = 'OTPREMLJENO'; statusOznaka = 'POTROŠENO U DORADI'; }
            else if (sviOtpremljeni) { tab = 'OTPREMLJENO'; statusOznaka = 'OTPREMLJEN'; }
            else if (imaOtpremljen && imaNaStanju) { tab = 'NA STANJU'; statusOznaka = 'DJELIMIČNO OTPREMLJEN'; }
            else if (imaOtvoren) { tab = 'U PROIZVODNJI'; statusOznaka = 'U PROIZVODNJI'; }
            else if (imaOtpremljen) { tab = 'OTPREMLJENO'; statusOznaka = 'OTPREMLJEN'; }

            // Za NA STANJU / U PROIZVODNJI sabiraj samo aktivne (neotpremljene i nepotrošene) redove!
            const redoviZaZbir = (tab === 'NA STANJU' || tab === 'U PROIZVODNJI') && aktivniRedovi.length > 0 ? aktivniRedovi : g.redovi;
            const zbirM3 = redoviZaZbir.reduce((s, r) => s + (parseFloat(r.kolicina_final || 0) || 0), 0);
            const zbirKom = redoviZaZbir.reduce((s, r) => s + redUKomade(r), 0);

            const prviOtpremljen = g.redovi.find(r => r.otpremnica_id);
            return {
                ...g,
                dimenzijeLista,
                viseDimenzija: dimenzijeLista.length > 1 ? dimenzijeLista.join(', ') : null,
                kolicina_ulaz: parseFloat(zbirKom.toFixed(2)),
                kolicina_final: parseFloat(zbirM3.toFixed(4)),
                jm: 'kom',
                tabPaketa: tab,
                statusOznaka,
                jePotrosenoUDoradi: sviPotroseniUDoradi,
                otpremnica_id: prviOtpremljen ? prviOtpremljen.otpremnica_id : (g.redovi[0]?.otpremnica_id ?? null),
                closed_at: imaOtvoren ? null : (g.redovi[0]?.closed_at ?? null),
                dimenzijeSet: undefined,
            };
        });
        grupirani.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        return grupirani;
    };

    const ucitajSveSaPaginacijom = async (tabela, kolone, orderKolona, dodatniFilter) => {
        let sve = [];
        let od = 0;
        const korak = 1000;
        while (true) {
            let q = supabase.from(tabela).select(kolone).order(orderKolona, { ascending: false }).range(od, od + korak - 1);
            if (typeof dodatniFilter === 'function') q = dodatniFilter(q);
            const { data, error } = await q;
            if (error) { console.error(`Greška pri učitavanju ${tabela}:`, error); break; }
            if (!data || data.length === 0) break;
            sve = sve.concat(data);
            if (data.length < korak) break;
            od += korak;
        }
        return sve;
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [nalozi, katal, paketiSvi, trupciSvi] = await Promise.all([
                ucitajSveSaPaginacijom('radni_nalozi', 'id, kupac_naziv, status, stavke_jsonb, broj_ponude, datum, rok_isporuke, napomena, tip_naloga', 'datum'),
                ucitajSveSaPaginacijom('katalog_proizvoda', '*', 'created_at'),
                ucitajSveSaPaginacijom('paketi', '*', 'created_at'),
                ucitajSveSaPaginacijom('trupci', '*', 'created_at', (q) => q.eq('zakljucen_prijem', true).eq('status', 'na_lageru')),
            ]);
            setAktivniNalozi(nalozi || []);
            setKatalog(katal || []);
            setSviPaketiRaw(paketiSvi || []);
            setPaketi(grupirajPakete(paketiSvi || []));
            setTrupci(trupciSvi || []);
        } finally {
            setLoading(false);
        }
    };


    // ============ UNIVERZALNI RN: pronadjeni nalozi + realizacija (useMemo, bez trke) ============
    const upitRN = (fPaket.rn || '').trim();
    const pronadjeniNalozi = useMemo(() => pronadjiNalogeZaUpit(upitRN, aktivniNalozi), [upitRN, aktivniNalozi]);
    const pronadjeniRnIdSet = useMemo(() => new Set(pronadjeniNalozi.map(n => String(n.id).toUpperCase())), [pronadjeniNalozi]);

    // Realizacija po nalogu: spajanje paketa sa stavkom PO stavka_id (kao Pilana/Dorada).
    // Fallback po nazivu + dimenziji samo za redove bez stavka_id, i svaki red se
    // dodijeli najviše jednoj stavci, da se ne double-counta.
    // Realizacija po nalogu: spajanje paketa sa stavkom PO stavka_id (kao Pilana/Dorada).
    // FIX za duplikate (RN-2026-7646): kad RN ima 2 stavke sa istom sifrom + dimenzijom
    // (npr. 2x 1012500 12x10x500), stari "grab-all" fallback je SVE redove davao prvoj
    // stavci (5.141 / 0.605 = 850%), a druga je ostajala na 0. Sad se redovi bez
    // stavka_id raspodjeljuju REDOM: prva stavka dobija do svog trazenog, ostatak ide
    // drugoj, visak ide zadnjoj. Ukupno se i dalje slaze (5.141 = 0.605 + 4.536).
    // Procenat se vise ne cap-uje na 100% - visak se prikazuje kao VISAK.
    const rnDetaljiLista = useMemo(() => {
        if (!upitRN || pronadjeniNalozi.length === 0) return [];
        return pronadjeniNalozi.slice(0, 50).map(nalog => {
            const mojiRedovi = (sviPaketiRaw || []).filter(p =>
                String(p.broj_veze || '').toUpperCase() === String(nalog.id).toUpperCase() ||
                String(p.rn_id || '').toUpperCase() === String(nalog.id).toUpperCase()
            );
            // Priprema po stavci: dimenzija, JM default (katalog) + JM iz RN-a, trazeno
            const stavkePrep = (nalog.stavke_jsonb || []).map(st => {
                // DIMENZIJA: lanac fallbacka, ne samo RN + katalog po striktnoj sifri.
                // 1) RN stavka (dimenzije / dimenzija) 2) katalog po sifri (String poredjenje,
                //    jer je u jednoj tabeli sifra broj 1220700, u drugoj string "1220700")
                // 3) katalog po nazivu 4) paket redovi za ovaj RN + istu sifru/naziv.
                // Ako ni to ne nadje dim, dimStavke ostaje null i NE prikazujemo 0.00 kom,
                // nego "—" sa upozorenjem - konverzija m3 <-> kom bez dimenzije nije moguca.
                const kat = katalog.find(kk => String(kk.sifra ?? '') === String(st.sifra ?? '')) || katalog.find(kk => String(kk.naziv || '').toUpperCase() === String(st.naziv || '').toUpperCase()) || null;
                let dimStavke = parseDimenzijeTekst(st.dimenzije || st.dimenzija) || parseDimenzijeTekst(kat?.dimenzije || kat?.dimenzija || '');
                if (!dimStavke && kat && (parseFloat(kat.visina) > 0 || parseFloat(kat.sirina) > 0 || parseFloat(kat.duzina) > 0)) {
                    dimStavke = { debljina: parseFloat(kat.visina) || 0, sirina: parseFloat(kat.sirina) || 0, duzina: parseFloat(kat.duzina) || 0 };
                }
                if (!dimStavke) {
                    const redZaDim = (sviPaketiRaw || []).find(rr => (String(rr.broj_veze || '').toUpperCase() === String(nalog.id).toUpperCase() || String(rr.rn_id || '').toUpperCase() === String(nalog.id).toUpperCase()) && (String(rr.sifra || '') === String(st.sifra || '') || String(rr.naziv_proizvoda || '').toUpperCase() === String(st.naziv || '').toUpperCase()) && parseFloat(rr.debljina) > 0);
                    if (redZaDim) dimStavke = { debljina: parseFloat(redZaDim.debljina) || 0, sirina: parseFloat(redZaDim.sirina) || 0, duzina: parseFloat(redZaDim.duzina) || 0 };
                }
                const dimTekst = dimStavke ? dimenzijeKljuc(dimStavke.debljina, dimStavke.sirina, dimStavke.duzina) : '';
                const dimNedostaje = !dimStavke || !(parseFloat(dimStavke.debljina) > 0 && parseFloat(dimStavke.sirina) > 0 && parseFloat(dimStavke.duzina) > 0);
                const jmDefault = kat ? String(kat.default_jedinica || kat.jm || kat.jedinica || '').toLowerCase() || null : null;
                const jmUnosRaw = String(st.jm_unos || '').toLowerCase() || null;
                const jmObracunRaw = String(st.jm_obracun || '').toLowerCase() || null;
                const jmRN = jmObracunRaw || jmUnosRaw || 'm3';
                const jmTrazeni = jmRN;
                const jmUnos = String(st.jm_unos || 'kom');
                // TRAZENO: koristi OBA izvora direktno, ne samo konverziju.
                // Ako je korisnik u ponudi/RN-u upisao 50 kom (kolicina_unos, jm_unos=kom),
                // a obracun je 5.880 m3, onda je trazeno u kom TACNO 50, a ne 5.880/vol
                // (sto je 0 kad dimenzija nedostaje). Zato prvo gledamo direktne vrijednosti.
                const kolUnos = parseFloat(st.kolicina_unos ?? 0) || 0;
                const kolObracun = parseFloat(st.kolicina_obracun ?? 0) || 0;
                const trazenoUJM = kolObracun || kolUnos || 0;
                const vrijednostUJmDirektno = (cilj) => {
                    if (cilj === jmUnosRaw && kolUnos) return kolUnos;
                    if (cilj === jmObracunRaw && kolObracun) return kolObracun;
                    return null;
                };
                const konvertuj = (vrijednost, izJM, uJM) => {
                    if (!vrijednost || izJM === uJM) return vrijednost;
                    if (dimNedostaje) return null;
                    // Preko komada: izJM -> kom -> uJM
                    const kom = izJM === 'kom' ? vrijednost : izJM === 'm3' ? (vol1Kom(dimStavke.debljina, dimStavke.sirina, dimStavke.duzina) > 0 ? vrijednost / vol1Kom(dimStavke.debljina, dimStavke.sirina, dimStavke.duzina) : 0)
                        : izJM === 'm2' ? (area1Kom(dimStavke.sirina, dimStavke.duzina) > 0 ? vrijednost / area1Kom(dimStavke.sirina, dimStavke.duzina) : 0)
                        : izJM === 'm1' ? (((parseFloat(dimStavke.duzina) || 0) / 100) > 0 ? vrijednost / ((parseFloat(dimStavke.duzina) || 0) / 100) : 0) : vrijednost;
                    return komadiUKolicinu(kom, dimStavke, uJM);
                };
                // KORIGOVANO vs UPISANO: unos (ono sto je korisnik ukucao) je autoritativan.
                // Ako je unos 35 kom, a obracun 5.880 m3, a dim 14x12x500 daje vol 0.084,
                // onda je 35 kom = 2.940 m3, a ne 5.880. 5.880 je 70 kom - vjerovatno zbir
                // obje duplikat stavke, a ne jedne. Zato racunamo PRERACUNATO i flagiramo
                // neslaganje, a progres/ostatak/distribucija koriste PRERACUNATO, ne upisano.
                // Inace bi Trazeno bilo 5.880 m3 (=35 kom), Napravljeno 2.940 m3 (=35 kom),
                // a Ostatak 2.940 m3 (=0.00 kom) - sto je nemoguce i zbunjuje.
                const volKom = dimNedostaje ? null : vol1Kom(dimStavke.debljina, dimStavke.sirina, dimStavke.duzina);
                const ocekivanoObracun = (kolUnos > 0 && kolObracun > 0 && jmUnosRaw && jmObracunRaw && jmUnosRaw !== jmObracunRaw && !dimNedostaje) ? konvertuj(kolUnos, jmUnosRaw, jmObracunRaw) : null;
                const neslaganjeUnosObracun = ocekivanoObracun != null && kolObracun > 0 && Math.abs(ocekivanoObracun - kolObracun) / kolObracun > 0.01;
                const faktorNeslaganja = neslaganjeUnosObracun && ocekivanoObracun > 0 ? kolObracun / ocekivanoObracun : null;
                // Korigovano trazeno: iz unosa (autor) preracunato u sve JM. Ako nema neslaganja,
                // korigovano == upisano. Ako ima, korigovano je ispravno, upisano je pogresno.
                const trazenoKomKorigovano = !dimNedostaje && jmUnosRaw ? konvertuj(kolUnos, jmUnosRaw, 'kom') : (vrijednostUJmDirektno('kom') ?? null);
                const trazenoM3Korigovano = !dimNedostaje && jmUnosRaw ? konvertuj(kolUnos, jmUnosRaw, 'm3') : (vrijednostUJmDirektno('m3') ?? null);
                const trazenoUJKorigovano = !dimNedostaje && jmUnosRaw ? konvertuj(kolUnos, jmUnosRaw, jmTrazeni) : trazenoUJM;
                const trazenoUDefaultKorigovano = jmDefault ? (!dimNedostaje && jmUnosRaw ? konvertuj(kolUnos, jmUnosRaw, jmDefault) : (vrijednostUJmDirektno(jmDefault) ?? null)) : null;
                // Za kompatibilnost: trazenoKom/M3/UDefault sada su KORIGOVANI (ispravni).
                // Upisane vrijednosti cuvamo posebno za prikaz "Upisano u RN-u".
                const trazenoKom = trazenoKomKorigovano;
                const trazenoM3 = trazenoM3Korigovano;
                const trazenoUDefault = trazenoUDefaultKorigovano;
                const trazenoUJMkorigovano = trazenoUJKorigovano;
                const katalogDimTekst = kat ? dimenzijeKljuc(kat.visina, kat.sirina, kat.duzina) : null;
                const dimenzijaNeslaganje = !!(dimStavke && katalogDimTekst && dimenzijeKljuc(dimStavke.debljina, dimStavke.sirina, dimStavke.duzina) !== katalogDimTekst);
                return { st, dimStavke, dimTekst, dimNedostaje, kat, jmDefault, jmRN, jmTrazeni, jmUnos, jmUnosRaw, jmObracunRaw, kolUnos, kolObracun, trazenoUJM: trazenoUJMkorigovano, trazenoUJMUpisano: trazenoUJM, trazenoKom, trazenoM3, trazenoUDefault, katalogDimTekst, dimenzijaNeslaganje, volKom, ocekivanoObracun, neslaganjeUnosObracun, faktorNeslaganja };
            });
            // Faza 1: tacno po stavka_id
            const dodeljeno = new Map();
            const iskoristeniRedovi = new Set();
            stavkePrep.forEach(sp => {
                const redovi = mojiRedovi.filter(rr => rr.stavka_id && String(rr.stavka_id) === String(sp.st.id) && !iskoristeniRedovi.has(rr.id));
                redovi.forEach(rr => iskoristeniRedovi.add(rr.id));
                dodeljeno.set(sp.st.id, { redovi, m3: redovi.reduce((s, rr) => s + (parseFloat(rr.kolicina_final || 0) || 0), 0), kom: redovi.reduce((s, rr) => s + redUKomade(rr), 0), raspodeljeno: false });
            });
            // Faza 2: redovi bez stavka_id -> grupisi po naziv + dimenzija, pa raspodijeli redom
            const preostali = mojiRedovi.filter(rr => !iskoristeniRedovi.has(rr.id));
            const grupeRedovi = {};
            preostali.forEach(rr => {
                const key = `${String(rr.naziv_proizvoda || '').toUpperCase()}|${dimenzijeKljuc(rr.debljina, rr.sirina, rr.duzina)}`;
                if (!grupeRedovi[key]) grupeRedovi[key] = [];
                grupeRedovi[key].push(rr);
            });
            const grupeStavke = {};
            stavkePrep.forEach(sp => {
                if ((dodeljeno.get(sp.st.id)?.redovi.length || 0) > 0) return;
                const key = `${String(sp.st.naziv || '').toUpperCase()}|${sp.dimTekst}`;
                if (!grupeStavke[key]) grupeStavke[key] = [];
                grupeStavke[key].push(sp);
            });
            Object.keys(grupeStavke).forEach(key => {
                const redoviGrupe = grupeRedovi[key] || [];
                if (redoviGrupe.length === 0) return;
                const totalM3 = redoviGrupe.reduce((s, rr) => s + (parseFloat(rr.kolicina_final || 0) || 0), 0);
                const totalKom = redoviGrupe.reduce((s, rr) => s + redUKomade(rr), 0);
                let preostaloM3 = totalM3;
                let preostaloKom = totalKom;
                const stavkeGrupe = grupeStavke[key];
                stavkeGrupe.forEach((sp, idx) => {
                    const jePoslednja = idx === stavkeGrupe.length - 1;
                    let allocM3, allocKom;
                    if (jePoslednja) { allocM3 = preostaloM3; allocKom = preostaloKom; }
                    else if (sp.trazenoKom == null && sp.trazenoM3 != null) {
                        // Dimenzija nedostaje, kom se ne moze izracunati - raspodijeli po m3 (JM iz RN-a)
                        allocM3 = Math.min(preostaloM3, sp.trazenoM3);
                        allocKom = null;
                    } else if (sp.trazenoM3 == null && sp.trazenoKom != null) {
                        allocKom = Math.min(preostaloKom, sp.trazenoKom);
                        allocM3 = null;
                    } else {
                        allocKom = Math.min(preostaloKom, sp.trazenoKom);
                        allocM3 = Math.min(preostaloM3, sp.trazenoM3);
                        if (sp.dimStavke && !sp.dimNedostaje) allocM3 = komadiUKolicinu(allocKom, sp.dimStavke, 'm3');
                    }
                    const post = dodeljeno.get(sp.st.id);
                    post.redovi = redoviGrupe;
                    post.m3 = allocM3;
                    post.kom = allocKom;
                    post.raspodeljeno = true;
                    preostaloM3 = Math.max(0, preostaloM3 - allocM3);
                    preostaloKom = Math.max(0, preostaloKom - allocKom);
                });
                redoviGrupe.forEach(rr => iskoristeniRedovi.add(rr.id));
            });
            const stavke = stavkePrep.map(sp => {
                const dod = dodeljeno.get(sp.st.id) || { redovi: [], m3: 0, kom: 0, raspodeljeno: false };
                const napravljenoM3 = dod.m3 ?? 0;
                const napravljenoKom = dod.kom ?? 0;
                // TAČNOST: otvoreni paket se NE broji kao gotov. Dijelimo na Zaključeno (closed_at != null)
                // i U izradi (closed_at == null). Prije je sve išlo u "Napravljeno", pa je RN-2026-2340
                // izgledao 100% gotov iako je paket 65 još bio U PROIZVODNJI.
                // Za raspodijeljene (Faza 2) dijelimo alloc proporcionalno udjelu zatvorenih redova u grupi.
                const redoviDod = dod.redovi || [];
                const ukM3Redovi = redoviDod.reduce((s, rr) => s + (parseFloat(rr.kolicina_final || 0) || 0), 0);
                const ukKomRedovi = redoviDod.reduce((s, rr) => s + redUKomade(rr), 0);
                const zakM3Redovi = redoviDod.filter(rr => rr.closed_at != null).reduce((s, rr) => s + (parseFloat(rr.kolicina_final || 0) || 0), 0);
                const zakKomRedovi = redoviDod.filter(rr => rr.closed_at != null).reduce((s, rr) => s + redUKomade(rr), 0);
                let napravljenoZakljucenoM3, napravljenoZakljucenoKom, napravljenoUIzradiM3, napravljenoUIzradiKom;
                if (!dod.raspodeljeno) {
                    napravljenoZakljucenoM3 = zakM3Redovi; napravljenoZakljucenoKom = zakKomRedovi;
                    napravljenoUIzradiM3 = Math.max(0, napravljenoM3 - zakM3Redovi); napravljenoUIzradiKom = Math.max(0, napravljenoKom - zakKomRedovi);
                } else {
                    const udioZak = ukM3Redovi > 0 ? zakM3Redovi / ukM3Redovi : (ukKomRedovi > 0 ? zakKomRedovi / ukKomRedovi : 0);
                    napravljenoZakljucenoM3 = napravljenoM3 * udioZak; napravljenoZakljucenoKom = napravljenoKom * udioZak;
                    napravljenoUIzradiM3 = napravljenoM3 - napravljenoZakljucenoM3; napravljenoUIzradiKom = napravljenoKom - napravljenoZakljucenoKom;
                }
                const faliZakljucenoM3 = sp.trazenoM3 == null ? null : Math.max(0, sp.trazenoM3 - napravljenoZakljucenoM3);
                const faliZakljucenoKom = sp.trazenoKom == null ? null : Math.max(0, sp.trazenoKom - napravljenoZakljucenoKom);
                const napravljenoZakljucenoUJM = sp.jmTrazeni === 'm3' ? napravljenoZakljucenoM3 : sp.jmTrazeni === 'kom' ? napravljenoZakljucenoKom : (sp.dimNedostaje ? null : komadiUKolicinu(napravljenoZakljucenoKom, sp.dimStavke, sp.jmTrazeni));
                const procenatGotovo = (sp.trazenoUJM > 0 && napravljenoZakljucenoUJM != null) ? (napravljenoZakljucenoUJM / sp.trazenoUJM) * 100 : 0;
                const napravljenoUJM = sp.jmTrazeni === 'm3' ? napravljenoM3 : sp.jmTrazeni === 'kom' ? napravljenoKom : (sp.dimNedostaje ? null : komadiUKolicinu(napravljenoKom, sp.dimStavke, sp.jmTrazeni));
                const napravljenoUDefault = !sp.jmDefault ? null : sp.jmDefault === 'm3' ? napravljenoM3 : sp.jmDefault === 'kom' ? napravljenoKom : (sp.dimNedostaje ? null : komadiUKolicinu(napravljenoKom, sp.dimStavke, sp.jmDefault));
                const faliUJM = napravljenoUJM == null ? null : Math.max(0, sp.trazenoUJM - napravljenoUJM);
                const faliM3 = sp.trazenoM3 == null ? null : Math.max(0, sp.trazenoM3 - napravljenoM3);
                const faliKom = sp.trazenoKom == null ? null : Math.max(0, sp.trazenoKom - napravljenoKom);
                const visakUJM = napravljenoUJM == null ? null : Math.max(0, napravljenoUJM - sp.trazenoUJM);
                const visakM3 = sp.trazenoM3 == null ? null : Math.max(0, napravljenoM3 - sp.trazenoM3);
                const visakKom = sp.trazenoKom == null ? null : Math.max(0, napravljenoKom - sp.trazenoKom);
                const visakUDefault = !sp.jmDefault ? null : sp.jmDefault === 'm3' ? visakM3 : sp.jmDefault === 'kom' ? visakKom : (sp.dimNedostaje || visakKom == null ? null : komadiUKolicinu(visakKom, sp.dimStavke, sp.jmDefault));
                const procenat = (sp.trazenoUJM > 0 && napravljenoUJM != null) ? (napravljenoUJM / sp.trazenoUJM) * 100 : 0;
                const imaOtvorenRed = (dod.redovi || []).some(rr => rr.closed_at === null || rr.closed_at === undefined);
                const imaZakljucenRed = (dod.redovi || []).some(rr => rr.closed_at !== null && rr.closed_at !== undefined);
                return {
                    ...sp.st,
                    dimenzijeTekst: sp.dimTekst,
                    dimStavke: sp.dimStavke,
                    volKom: sp.volKom,
                    ocekivanoObracun: sp.ocekivanoObracun,
                    neslaganjeUnosObracun: sp.neslaganjeUnosObracun,
                    faktorNeslaganja: sp.faktorNeslaganja,
                    trazenoUJMUpisano: sp.trazenoUJMUpisano,
                    jmTrazeni: sp.jmTrazeni,
                    jmUnos: sp.jmUnos,
                    jmDefault: sp.jmDefault,
                    jmRN: sp.jmRN,
                    trazenoUDefault: sp.trazenoUDefault,
                    napravljenoUDefault,
                    napravljenoM3: parseFloat(napravljenoM3.toFixed(4)),
                    napravljenoKom: parseFloat(napravljenoKom.toFixed(2)),
                    napravljenoZakljucenoM3: parseFloat(napravljenoZakljucenoM3.toFixed(4)),
                    napravljenoZakljucenoKom: parseFloat(napravljenoZakljucenoKom.toFixed(2)),
                    napravljenoUIzradiM3: parseFloat(napravljenoUIzradiM3.toFixed(4)),
                    napravljenoUIzradiKom: parseFloat(napravljenoUIzradiKom.toFixed(2)),
                    faliZakljucenoM3: faliZakljucenoM3 == null ? null : parseFloat(faliZakljucenoM3.toFixed(4)),
                    faliZakljucenoKom: faliZakljucenoKom == null ? null : parseFloat(faliZakljucenoKom.toFixed(2)),
                    procenatGotovo: parseFloat(procenatGotovo.toFixed(1)),
                    napravljenoUJM: napravljenoUJM == null ? null : parseFloat(napravljenoUJM.toFixed(4)),
                    trazenoUJM: sp.trazenoUJM,
                    trazenoM3: sp.trazenoM3 == null ? null : parseFloat(sp.trazenoM3.toFixed(4)),
                    trazenoKom: sp.trazenoKom == null ? null : parseFloat(sp.trazenoKom.toFixed(2)),
                    dimNedostaje: sp.dimNedostaje,
                    kolUnos: sp.kolUnos,
                    kolObracun: sp.kolObracun,
                    jmUnosRaw: sp.jmUnosRaw,
                    jmObracunRaw: sp.jmObracunRaw,
                    faliUJM: faliUJM == null ? null : parseFloat(faliUJM.toFixed(4)),
                    faliM3: faliM3 == null ? null : parseFloat(faliM3.toFixed(4)),
                    faliKom: faliKom == null ? null : parseFloat(faliKom.toFixed(2)),
                    visakUJM: visakUJM == null ? null : parseFloat(visakUJM.toFixed(4)),
                    visakM3: visakM3 == null ? null : parseFloat(visakM3.toFixed(4)),
                    visakKom: visakKom == null ? null : parseFloat(visakKom.toFixed(2)),
                    visakUDefault,
                    procenat,
                    brojRedova: dod.redovi.length,
                    redoviPaketIdi: [...new Set((dod.redovi || []).map(rr => String(rr.paket_id || rr.id)))],
                    paketiLista: (() => { const m = {}; (dod.redovi || []).forEach(rr => { const pid = String(rr.paket_id || rr.id); if (!m[pid]) m[pid] = { paket_id: pid, m3: 0, kom: 0, redovi: 0, closed: rr.closed_at != null, masina: rr.masina || '', otpremnica_id: rr.otpremnica_id || null }; m[pid].m3 += parseFloat(rr.kolicina_final || 0) || 0; m[pid].kom += redUKomade(rr); m[pid].redovi += 1; if (rr.closed_at == null) m[pid].closed = false; }); return Object.values(m); })(),
                    imaOtvorenRed,
                    imaZakljucenRed,
                    katalogDimTekst: sp.katalogDimTekst,
                    dimenzijaNeslaganje: sp.dimenzijaNeslaganje,
                    raspodeljenoIzGrupe: dod.raspodeljeno,
                };
            });
            // GRUPE za duplikate: npr. 2x 1220700 14x12x500. Grupa pokazuje UKUPNO:
            // 70 kom = 5.880 m3, a ne 35 kom = 5.880 m3. To je odgovor na "valjda je 70 kom".
            const grupeMapa = {};
            stavke.forEach((st, idx) => {
                const kljuc = `${st.sifra}|${st.dimenzijeTekst || '—'}`;
                if (!grupeMapa[kljuc]) grupeMapa[kljuc] = { kljuc, sifra: st.sifra, naziv: st.naziv, dimenzijeTekst: st.dimenzijeTekst, jmTrazeni: st.jmTrazeni, jmDefault: st.jmDefault, stavke: [], ukupnoTrazenoM3: 0, ukupnoTrazenoKom: 0, ukupnoNapravljenoM3: 0, ukupnoNapravljenoKom: 0, ukupnoFaliM3: 0, ukupnoFaliKom: 0, imaNeslaganje: false };
                const g = grupeMapa[kljuc];
                g.stavke.push({ ...st, redniBrojUGrupi: idx });
                g.ukupnoTrazenoM3 += st.trazenoM3 ?? 0;
                g.ukupnoTrazenoKom += st.trazenoKom ?? 0;
                g.ukupnoNapravljenoM3 += st.napravljenoM3 ?? 0;
                g.ukupnoNapravljenoKom += st.napravljenoKom ?? 0;
                g.ukupnoFaliM3 += st.faliM3 ?? 0;
                g.ukupnoFaliKom += st.faliKom ?? 0;
                if (st.neslaganjeUnosObracun) g.imaNeslaganje = true;
            });
            const grupe = Object.values(grupeMapa).map(g => ({ ...g, procenat: g.ukupnoTrazenoM3 > 0 ? (g.ukupnoNapravljenoM3 / g.ukupnoTrazenoM3) * 100 : 0 }));
            const ukupnoTrazenoM3 = stavke.reduce((s, st) => s + (st.trazenoM3 || 0), 0);
            const ukupnoNapravljenoM3 = stavke.reduce((s, st) => s + (st.napravljenoM3 || 0), 0);
            // METODIČAN IZVJEŠTAJ ZA RN: izračunati status, a ne samo status iz baze.
            // RN je ZAVRŠEN samo ako su SVE stavke gotove (fali ~0) I SVI paketi zaključeni.
            // Ako je u bazi ZAVRŠENO, a izračunato je DJELIMIČNO, to je neslaganje koje se mora flagirati.
            // Primjer RN-2026-2340: u bazi ZAVRŠENO, a RN ima 3 dimenzije (8x12x7, 5x3x300, 10x10x300)
            // i gornja pločica je pokazivala samo 10x10x300 kao gotovu - zato sad pokazujemo SVE stavke
            // + pakete bez stavke (orphan) + izračunati status.
            const ukupnoTrazenoKom = stavke.reduce((s, st) => s + (st.trazenoKom ?? 0), 0);
            const ukupnoNapravljenoKom = stavke.reduce((s, st) => s + (st.napravljenoKom ?? 0), 0);
            const ukupnoFaliM3 = stavke.reduce((s, st) => s + (st.faliM3 ?? 0), 0);
            const ukupnoFaliKom = stavke.reduce((s, st) => s + (st.faliKom ?? 0), 0);
            const ukupnoZakljucenoM3 = stavke.reduce((s, st) => s + (st.napravljenoZakljucenoM3 ?? 0), 0);
            const ukupnoZakljucenoKom = stavke.reduce((s, st) => s + (st.napravljenoZakljucenoKom ?? 0), 0);
            const ukupnoUIzradiM3 = stavke.reduce((s, st) => s + (st.napravljenoUIzradiM3 ?? 0), 0);
            const ukupnoUIzradiKom = stavke.reduce((s, st) => s + (st.napravljenoUIzradiKom ?? 0), 0);
            const brojStavki = stavke.length;
            // Gotovo = Zaključeno == Traženo I nema otvorenih redova. U izradi = ima otvorenih redova ili Zaključeno < Traženo a nešto je početo.
            const brojGotovih = stavke.filter(st => (st.faliZakljucenoM3 ?? st.faliM3 ?? 999) <= 0.0005 && (st.napravljenoUIzradiM3 ?? 0) <= 0.0005 && !st.imaOtvorenRed).length;
            const brojUizradi = stavke.filter(st => !((st.faliZakljucenoM3 ?? st.faliM3 ?? 999) <= 0.0005 && (st.napravljenoUIzradiM3 ?? 0) <= 0.0005 && !st.imaOtvorenRed) && ((st.napravljenoM3 ?? 0) > 0 || st.imaOtvorenRed)).length;
            const brojNijePoceto = stavke.filter(st => (st.napravljenoM3 ?? 0) <= 0.0005 && !st.imaOtvorenRed).length;
            const brojDimenzija = new Set(stavke.map(st => st.dimenzijeTekst || '—')).size;
            const brojPaketaRN = new Set(mojiRedovi.map(rr => rr.paket_id || rr.id)).size;
            const brojZakljucenihPaketaRN = new Set(mojiRedovi.filter(rr => rr.closed_at != null).map(rr => rr.paket_id || rr.id)).size;
            const brojOtvorenihPaketaRN = brojPaketaRN - brojZakljucenihPaketaRN;
            const procenatRN = ukupnoTrazenoM3 > 0 ? (ukupnoNapravljenoM3 / ukupnoTrazenoM3) * 100 : 0;
            const izracunatiStatus = brojStavki === 0 ? 'NEMA STAVKI' : (brojGotovih === brojStavki && brojOtvorenihPaketaRN === 0 ? 'ZAVRŠENO' : (brojGotovih === 0 && ukupnoNapravljenoM3 <= 0.0005 ? 'NIJE POČETO' : (brojGotovih > 0 ? `DJELIMIČNO (${brojGotovih}/${brojStavki})` : 'U PROIZVODNJI')));
            const normStatus = (s) => String(s || '').toUpperCase().trim().replace(/^ZAVRŠEN$/, 'ZAVRŠENO');
            // Neslaganje je kritično samo u dva smjera: baza kaže ZAVRŠENO, a izračunato nije (npr. DJELIMIČNO),
            // ili je izračunato ZAVRŠENO, a baza kaže da nije. DJELIMIČNO vs U PROIZVODNJI nije neslaganje.
            const statusNeslaganje = (normStatus(nalog.status) === 'ZAVRŠENO' && izracunatiStatus !== 'ZAVRŠENO') || (normStatus(nalog.status) !== 'ZAVRŠENO' && izracunatiStatus === 'ZAVRŠENO');
            // Orphan paketi: paketi vezani za RN, ali ni jedna stavka ih ne pokriva (ni po stavka_id, ni po šifri+dim).
            // To objašnjava RN-2026-2340: paketi 66 (8x12x7) i 65 (5x3x300) su na RN-u, ali stavka za njih
            // ne postoji u stavke_jsonb (samo 1010300 10x10x300) - pa gornji panel nije imao šta da prikaže.
            const orphanPaketiMapa = {};
            mojiRedovi.forEach(rr => {
                const pid = rr.paket_id || rr.id;
                if (!orphanPaketiMapa[pid]) orphanPaketiMapa[pid] = { paket_id: pid, sifra: rr.sifra || '', naziv: rr.naziv_proizvoda || '', dim: dimenzijeKljuc(rr.debljina, rr.sirina, rr.duzina), m3: 0, kom: 0, redovi: 0, closed: rr.closed_at != null, masina: rr.masina || '', otpremnica_id: rr.otpremnica_id || null, stavka_id: rr.stavka_id || null };
                orphanPaketiMapa[pid].m3 += parseFloat(rr.kolicina_final || 0) || 0;
                orphanPaketiMapa[pid].kom += redUKomade(rr);
                orphanPaketiMapa[pid].redovi += 1;
                if (rr.closed_at == null) orphanPaketiMapa[pid].closed = false;
            });
            // Paket je orphan ako ni jedna stavka nema redove iz tog paketa (dodeljeno)
            const pokriveniPaketIdSet = new Set();
            stavke.forEach(st => (st.redoviPaketIdi || []).forEach(pid => pokriveniPaketIdSet.add(String(pid))));
            // redoviPaketIdi ćemo dodati ispod - za sad, orphan = paket čija dimenzija ne odgovara ni jednoj stavci
            const orphanPaketi = Object.values(orphanPaketiMapa).filter(op => {
                // Orphan = ni jedna stavka ga ne pokriva: ni po stavka_id, ni po šifra+dimenzija.
                // Prije se gledala samo dimenzija, pa je paket 66 (8x12x7) mogao biti pogrešno
                // proglašen pokrivenim ako je neka druga šifra imala istu dimenziju.
                const poStavkaId = op.stavka_id && stavke.some(st => String(st.id) === String(op.stavka_id));
                const poSifraDim = stavke.some(st => String(st.sifra || '') === String(op.sifra || '') && st.dimenzijeTekst && st.dimenzijeTekst === op.dim);
                const poNazivDim = !op.sifra && stavke.some(st => String(st.naziv || '').toUpperCase() === String(op.naziv || '').toUpperCase() && st.dimenzijeTekst && st.dimenzijeTekst === op.dim);
                return !(poStavkaId || poSifraDim || poNazivDim);
            });
            return {
                id: nalog.id,
                kupac: nalog.kupac_naziv,
                status: nalog.status,
                datum: nalog.datum,
                rok_isporuke: nalog.rok_isporuke,
                broj_ponude: nalog.broj_ponude,
                napomena: nalog.napomena,
                tip_naloga: nalog.tip_naloga,
                stavke,
                grupe,
                ukupnoTrazenoM3,
                ukupnoNapravljenoM3,
                ukupnoTrazenoKom,
                ukupnoNapravljenoKom,
                ukupnoFaliM3,
                ukupnoFaliKom,
                ukupnoZakljucenoM3,
                ukupnoZakljucenoKom,
                ukupnoUIzradiM3,
                ukupnoUIzradiKom,
                brojStavki,
                brojGotovih,
                brojUizradi,
                brojNijePoceto,
                brojDimenzija,
                brojPaketaRN,
                brojZakljucenihPaketaRN,
                brojOtvorenihPaketaRN,
                procenatRN,
                izracunatiStatus,
                statusNeslaganje,
                orphanPaketi,
            };
        });
    }, [upitRN, pronadjeniNalozi, pronadjeniRnIdSet, sviPaketiRaw, katalog]);

    // Tražene dimenzije iz svih pronađenih naloga, za highlight na pločicama
    const trazeneDimenzijeSet = useMemo(() => {
        const s = new Set();
        (rnDetaljiLista || []).forEach(rn => (rn.stavke || []).forEach(st => { if (st.dimenzijeTekst) s.add(normalizujZaPretragu(st.dimenzijeTekst)); }));
        return s;
    }, [rnDetaljiLista]);

    const filtriraniPaketi = useMemo(() => {
        const q = normalizujZaPretragu(upitRN);
        const qPretraga = normalizujZaPretragu(pretraga);
        return paketi.filter(p => {
            // 1. Tab: 1 paket = 1 plocica, tab se odredjuje po cijelom paketu.
            // Kad je RN upit aktivan, tab se IGNORISE - RN pretraga prikazuje pakete iz svih tabova.
            // Inace bi paket jos otvoren (U PROIZVODNJI) bio nevidljiv na NA STANJU, a panel bi govorio da je napravljen.
            if (glavniTab === 'paketi' && !q && p.tabPaketa !== subTabPaketi) return false;
            // 2. Univerzalni RN filter
            if (q) {
                if (pronadjeniNalozi.length > 0) {
                    const imaRN = [...(p.brojVezeSet || []), ...(p.rnIdSet || [])].some(id => pronadjeniRnIdSet.has(String(id).toUpperCase()));
                    if (!imaRN) return false;
                } else {
                    // Nema naloga za upit -> probaj slobodan tekst na samom paketu
                    // (npr. "SLOBODNA", naziv proizvoda, paket_id, mašina, dimenzija)
                    const tekstPaketa = normalizujZaPretragu([p.paket_id, p.naziv_proizvoda, p.broj_veze, p.rn_id, p.masina, (p.dimenzijeLista || []).join(' '), p.statusOznaka, kupacZaPaket(p)].filter(Boolean).join(' | '));
                    const tekstBezRazmaka = tekstPaketa.replace(/\s+/g, '');
                    const ok = q.split(/[\s,;]+/).filter(Boolean).every(tok => tekstPaketa.includes(tok) || tekstBezRazmaka.includes(tok.replace(/\s+/g, '')));
                    if (!ok) return false;
                }
            }
            // 3. Gornja brza pretraga (sada i po kupcu i RN-u, ne samo po ID-u i nazivu)
            if (qPretraga) {
                const tekstPaketa = normalizujZaPretragu([p.paket_id, p.naziv_proizvoda, p.broj_veze, p.rn_id, p.masina, (p.dimenzijeLista || []).join(' '), kupacZaPaket(p)].filter(Boolean).join(' | '));
                if (!tekstPaketa.includes(qPretraga)) return false;
            }
            // 4. Filter dimenzija: paket prolazi ako BILO KOJA njegova dimenzija upada u opseg
            const fDebOd = fPaket.debljinaOd === '' ? null : parseFloat(fPaket.debljinaOd);
            const fDebDo = fPaket.debljinaDo === '' ? null : parseFloat(fPaket.debljinaDo);
            const fSirOd = fPaket.sirinaOd === '' ? null : parseFloat(fPaket.sirinaOd);
            const fSirDo = fPaket.sirinaDo === '' ? null : parseFloat(fPaket.sirinaDo);
            const fDuzOd = fPaket.duzinaOd === '' ? null : parseFloat(fPaket.duzinaOd);
            const fDuzDo = fPaket.duzinaDo === '' ? null : parseFloat(fPaket.duzinaDo);
            if (fDebOd !== null || fDebDo !== null || fSirOd !== null || fSirDo !== null || fDuzOd !== null || fDuzDo !== null) {
                const lista = p.dimenzijeLista && p.dimenzijeLista.length > 0 ? p.dimenzijeLista : [dimenzijeKljuc(p.debljina, p.sirina, p.duzina)];
                const okDim = lista.some(dimTxt => {
                    const dd = parseDimenzijeTekst(dimTxt);
                    if (!dd) return false;
                    if (fDebOd !== null && dd.debljina < fDebOd) return false;
                    if (fDebDo !== null && dd.debljina > fDebDo) return false;
                    if (fSirOd !== null && dd.sirina < fSirOd) return false;
                    if (fSirDo !== null && dd.sirina > fSirDo) return false;
                    if (fDuzOd !== null && dd.duzina < fDuzOd) return false;
                    if (fDuzDo !== null && dd.duzina > fDuzDo) return false;
                    return true;
                });
                if (!okDim) return false;
            }
            return true;
        });
    }, [paketi, pretraga, fPaket, upitRN, pronadjeniNalozi, pronadjeniRnIdSet, glavniTab, subTabPaketi, mapaNaloziPoId, rnDetaljiLista]);

    // Paketi za pronadjene RN-ove, BEZ tab filtera - za brojac u RN panelu.
    const paketiZaRN = useMemo(() => {
        if (!upitRN || pronadjeniNalozi.length === 0) return [];
        return paketi.filter(p => [...(p.brojVezeSet || []), ...(p.rnIdSet || [])].some(id => pronadjeniRnIdSet.has(String(id).toUpperCase())));
    }, [paketi, upitRN, pronadjeniNalozi, pronadjeniRnIdSet]);
    const paketiZaRNPoTabu = useMemo(() => {
        const m2 = { 'U PROIZVODNJI': 0, 'NA STANJU': 0, 'OTPREMLJENO': 0 };
        paketiZaRN.forEach(pp => { if (m2[pp.tabPaketa] !== undefined) m2[pp.tabPaketa]++; });
        return m2;
    }, [paketiZaRN]);

    const filtriraniTrupci = useMemo(() => {
        return trupci.filter(item => {
            if (!pretraga) return true;
            const s = normalizujZaPretragu(pretraga);
            const tekst = normalizujZaPretragu([item.id, item.sumarija, item.otpremnica_broj, item.vrsta, item.klasa].filter(Boolean).join(' '));
            return tekst.includes(s);
        });
    }, [trupci, pretraga]);


    const zapisiU_Log = async (akcija, detalji) => {
        await supabase.from('sistem_audit_log').insert([{ korisnik: user?.ime_prezime || 'Sistem', akcija, detalji }]);
    };

    const spasiSlobodniUlaz = async () => {
        if(!rucniUlazForm.naziv || !rucniUlazForm.kolicina) return prikaziDialog({ tip: 'upozorenje', naslov: 'Fali Podataka', poruka: "Odaberite proizvod i upišite količinu!", onCancel: zatvoriDialog });
        
        const v = parseFloat(rucniUlazForm.debljina) || 0;
        const s = parseFloat(rucniUlazForm.sirina) || 0;
        const d = parseFloat(rucniUlazForm.duzina) || 0;
        if (v <= 0 || s <= 0 || d <= 0) return prikaziDialog({ tip: 'upozorenje', naslov: 'Neispravne dimenzije', poruka: "Sve dimenzije (debljina, širina, dužina) moraju biti veće od 0. Ranije je prazno polje tiho postajalo 1 cm i računalo pogrešan m³.", onCancel: zatvoriDialog });
        const unosKol = parseFloat(rucniUlazForm.kolicina) || 0;
        if (unosKol <= 0) return prikaziDialog({ tip: 'upozorenje', naslov: 'Neispravna količina', poruka: "Količina mora biti pozitivan broj veći od 0!", onCancel: zatvoriDialog });

        let komada = unosKol;
        if (rucniUlazForm.jm === 'm3') komada = unosKol / ((v/100) * (s/100) * (d/100));
        else if (rucniUlazForm.jm === 'm2') komada = unosKol / ((s/100) * (d/100));
        else if (rucniUlazForm.jm === 'm1') komada = unosKol / (d/100);
        
        const izracunatM3 = parseFloat((komada * (v/100) * (s/100) * (d/100)).toFixed(3));
        let noviIdPaketa = generisiIDPaketa();
        for (let pokusaj = 0; pokusaj < 5; pokusaj++) {
            const { data: postojeci } = await supabase.from('paketi').select('id').eq('paket_id', noviIdPaketa).limit(1);
            if (!postojeci || postojeci.length === 0) break;
            noviIdPaketa = generisiIDPaketa();
        }

        const payload = {
            paket_id: noviIdPaketa,
            naziv_proizvoda: rucniUlazForm.naziv,
            debljina: v, sirina: s, duzina: d,
            kolicina_ulaz: unosKol, jm: rucniUlazForm.jm,
            kolicina_final: izracunatM3,
            broj_veze: 'SLOBODNA_ROBA',
            mjesto: header?.mjesto || 'Lager',
            masina: 'Ručni Unos',
            snimio_korisnik: user?.ime_prezime || 'Nepoznat',
            datum_yyyy_mm: new Date().toISOString().split('T')[0],
            vrijeme_tekst: new Date().toLocaleTimeString('de-DE'),
            closed_at: new Date().toISOString(),
            oznake: [rucniUlazForm.klasa]
        };

        const { error } = await supabase.from('paketi').insert([payload]);
        if (error) {
            return prikaziDialog({ tip: 'greska', naslov: 'Greška baze', poruka: error.message, onCancel: zatvoriDialog });
        }

        await zapisiU_Log('SLOBODNI_ULAZ_LAGER', `Ubačen paket: ${noviIdPaketa} (${izracunatM3} m³). Proizvod: ${rucniUlazForm.naziv}`);
        
        setRucniUlazForm({ naziv: '', debljina: '', sirina: '', duzina: '', kolicina: '', jm: 'kom', klasa: 'Standard' });
        loadData();
        
        prikaziDialog({
            tip: 'uspjeh',
            naslov: 'Stanje Ažurirano',
            poruka: `Paket ${noviIdPaketa} je uspješno smješten na lager.\nŽelite li isprintati deklaraciju za ovaj paket?`,
            confirmText: '🖨️ DA, ŠTAMPAJ',
            cancelText: 'ZATVORI',
            onConfirm: () => { printDeklaracijaPaketa(noviIdPaketa, [payload], 'SLOBODNA_ROBA'); zatvoriDialog(); },
            onCancel: zatvoriDialog
        });
    };

    const ucitajHistoriju = async (paket) => {
        setSelektovaniPaket(paket);
        setHistorija('load'); setIzvedeniPaketi([]);
        const sid = String(paket.paket_id || '').trim();

        const [auditRes, sveOtpRes, sviPaketiRes] = await Promise.all([
            supabase.from('sistem_audit_log').select('*').ilike('detalji', `%${sid}%`).order('vrijeme', { ascending: true }),
            supabase.from('otpremnice').select('id, kupac_naziv, datum, status, stavke_jsonb, created_at, snimio_korisnik'),
            supabase.from('paketi').select('*')
        ]);

        const rawAuditData = auditRes.data || [];
        const auditData = rawAuditData.filter(a => {
            if ((a.akcija || '').startsWith('KASA_')) return false;
            const tekst = `${a.akcija || ''} ${a.detalji || ''} ${JSON.stringify(a.stari_podaci || '')} ${JSON.stringify(a.novi_podaci || '')}`;
            const escaped = sid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Ne dozvoljava tačku ili zarez ispred kratkog broja (da iznos "10200.65 KM" ne bi bio prepoznat kao paket "65")!
            const regex = new RegExp(`(^|[^0-9A-Za-z.,-])${escaped}([^0-9A-Za-z.,-]|$)`, 'i');
            return regex.test(tekst);
        });

        let dogadjaji = auditData.map(a => {
            let detaljanOpis = a.detalji || "Izmjena unutrašnjih parametara paketa.";
            if (a.akcija === 'DODAVANJE') detaljanOpis = `Kreiran paket na mašini: ${paket.masina || 'N/A'}. Količina: ${paket.kolicina_ulaz} kom (${paket.kolicina_final} m³).`;
            if (a.stari_podaci && a.novi_podaci) {
                try {
                    const s = typeof a.stari_podaci === 'string' ? JSON.parse(a.stari_podaci) : a.stari_podaci;
                    const n = typeof a.novi_podaci === 'string' ? JSON.parse(a.novi_podaci) : a.novi_podaci;
                    const promjene = [];
                    Object.keys(n).forEach(k => {
                        if (JSON.stringify(s[k]) !== JSON.stringify(n[k]) && !['created_at', 'vrijeme_tekst', 'id', 'last_modified_at'].includes(k)) {
                            promjene.push(`${k.toUpperCase()}: ${s[k] ?? 'prazno'} ➔ ${n[k]}`);
                        }
                    });
                    if (promjene.length > 0) {
                        detaljanOpis = a.detalji ? `${a.detalji}\n(${promjene.join(' | ')})` : promjene.join(' | ');
                    }
                } catch(e) {}
            }
            return { vrijeme: a.vrijeme || a.created_at || paket.created_at, naslov: a.akcija, opis: detaljanOpis, korisnik: a.korisnik || 'Sistem' };
        });

        const sviPaketi = sviPaketiRes.data || [];
        const forwardData = sviPaketi.filter(p => {
            if (!p.ai_sirovina_ids) return false;
            const niz = Array.isArray(p.ai_sirovina_ids) ? p.ai_sirovina_ids : String(p.ai_sirovina_ids).replace(/[{}"[\]]/g, '').split(',').map(x => x.trim());
            return niz.some(id => id.toUpperCase() === sid.toUpperCase());
        });

        if (forwardData.length > 0) {
            setIzvedeniPaketi([...new Map(forwardData.map(item => [item.paket_id, item])).values()]);
            forwardData.forEach(izv => {
                const vecUpisano = dogadjaji.some(d => d.opis.includes(izv.paket_id) || d.naslov.includes('DORADA'));
                if (!vecUpisano) {
                    dogadjaji.push({
                        vrijeme: izv.created_at || paket.created_at,
                        naslov: 'PRERADA / POTROŠNJA U DORADI',
                        opis: `Paket korišten kao ulazna sirovina u Doradi (${izv.masina || 'Dorada'}) za izradu izlaznog paketa ${izv.paket_id} (${izv.kolicina_ulaz || ''} ${izv.jm || 'kom'} / ${izv.kolicina_final} m³). Trenutno preostalo na ovom paketu: ${paket.kolicina_ulaz} ${paket.jm || 'kom'} (${paket.kolicina_final} m³).`,
                        korisnik: izv.snimio_korisnik || 'Dorada'
                    });
                }
            });
        }

        const sveOtpremnice = sveOtpRes.data || [];
        sveOtpremnice.forEach(otp => {
            const stavkeOtp = Array.isArray(otp.stavke_jsonb) ? otp.stavke_jsonb : [];
            stavkeOtp.forEach(st => {
                const stPid = st.paket_id || (st.sifra === sid ? st.sifra : null) || ((st.naziv || '').toUpperCase().includes(sid.toUpperCase()) ? sid : null);
                if (stPid && String(stPid).toUpperCase() === sid.toUpperCase()) {
                    const vecUpisanaOtp = dogadjaji.some(d => d.opis.includes(otp.id));
                    if (!vecUpisanaOtp) {
                        dogadjaji.push({
                            vrijeme: otp.created_at || otp.datum || paket.created_at,
                            naslov: st.tip_utovara === 'DJELIMICNO' ? 'DJELIMIČNA_OTPREMA_PAKETA' : 'OTPREMA_PAKETA',
                            opis: `Otpremnica ${otp.id} (Kupac: ${otp.kupac_naziv}, Status: ${otp.status}): Isporučeno ${st.kolicina_unos} ${st.jm_unos || 'kom'} (${parseFloat(st.kolicina_obracun || 0).toFixed(3)} m³). Trenutno na paketu: ${paket.kolicina_ulaz} ${paket.jm || 'kom'} (${paket.kolicina_final} m³).`,
                            korisnik: otp.snimio_korisnik || 'Otprema'
                        });
                    }
                }
            });
        });

        const sveStavkePaketa = sviPaketi.filter(p => p.paket_id === sid);
        if (sveStavkePaketa.length > 0) {
            let sviTrupciId = [];
            sveStavkePaketa.forEach(red => { if (red.ulaz_trupci_ids && Array.isArray(red.ulaz_trupci_ids)) sviTrupciId = [...sviTrupciId, ...red.ulaz_trupci_ids]; });
            const unikatniTrupci = [...new Set(sviTrupciId)];

            if (unikatniTrupci.length > 0) {
                const { data: trupciPodaci } = await supabase.from('trupci').select('*').in('id', unikatniTrupci);
                if (trupciPodaci && trupciPodaci.length > 0) {
                    const totalV = trupciPodaci.reduce((s, t) => s + parseFloat(t.kontrolna_zapremina || t.zapremina || 0), 0);
                    const sumarijeMap = {};
                    trupciPodaci.forEach(t => { const s = t.sumarija || 'Nepoznato'; sumarijeMap[s] = (sumarijeMap[s] || 0) + parseFloat(t.kontrolna_zapremina || t.zapremina || 0); });
                    const infoText = totalV > 0 ? Object.keys(sumarijeMap).map(k => `${k}: ${((sumarijeMap[k]/totalV)*100).toFixed(1)}%`).join(' | ') : 'N/A';
                    dogadjaji.push({ vrijeme: paket.created_at, naslov: 'SASTAV SIROVINE (TRUPCI)', opis: `Povezano sa ${unikatniTrupci.length} trupaca iz šume.\nUdio šumarija:\n${infoText}`, korisnik: 'Sistem' });
                }
            }
        }
        // FIX: prvo dopuni listu (unshift/push), pa tek onda setHistorija.
        // Ranije se setHistorija zvao PRIJE ovih dopuna, pa su se "Kreiran" i "Zaključen"
        // događaji nekad gubili ili mutirali state nakon seta.
        if (!dogadjaji.some(d => d.naslov.includes('DODANA') || d.naslov.includes('SLOBODNI') || d.naslov.includes('KREIRAN'))) {
            dogadjaji.unshift({
                vrijeme: paket.created_at || new Date().toISOString(),
                naslov: 'DODANA_STAVKA_U_PAKET',
                opis: `Kreiran paket ${sid} na mašini: ${paket.masina || 'Pogon'}. Proizvod: ${paket.naziv_proizvoda} (${paket.debljina}x${paket.sirina}x${paket.duzina} cm), Količina: ${paket.kolicina_ulaz} ${paket.jm || 'kom'} (${paket.kolicina_final} m³).`,
                korisnik: paket.snimio_korisnik || 'Sistem'
            });
        }
        if (paket.closed_at && !dogadjaji.some(d => d.naslov.includes('ZAKLJUČEN'))) {
            dogadjaji.push({
                vrijeme: paket.closed_at,
                naslov: 'ZAKLJUČEN_PAKET',
                opis: `Paket ${sid} je zaključen i spreman na lageru (${paket.kolicina_ulaz} ${paket.jm || 'kom'} / ${paket.kolicina_final} m³).`,
                korisnik: paket.snimio_korisnik || 'Sistem'
            });
        }
        setHistorija(dogadjaji.length > 0 ? [...dogadjaji].sort((a,b) => new Date(a.vrijeme) - new Date(b.vrijeme)) : 'none');
    };

    const isprintajAutomatski = async (paket) => {
        setIsPrinting(true);
        let vezniDokument = paket.broj_veze; 
        if (vezniDokument && vezniDokument.startsWith('RN-')) {
            const nalog = aktivniNalozi.find(n => n.id === vezniDokument);
            if (nalog && nalog.broj_ponude) vezniDokument = nalog.broj_ponude;
        }
        printDeklaracijaPaketa(paket.paket_id, (paket.redovi && paket.redovi.length > 0) ? paket.redovi : [paket], vezniDokument || '');
        setIsPrinting(false);
    };



    const stats = useMemo(() => {
        let count = 0; let m3 = 0;
        if (glavniTab === 'paketi') {
            count = filtriraniPaketi.length;
            m3 = filtriraniPaketi.reduce((s, p) => s + parseFloat(p.kolicina_final || 0), 0);
        } else if (glavniTab === 'trupci') {
            count = filtriraniTrupci.length;
            m3 = filtriraniTrupci.reduce((s, t) => s + parseFloat(t.kontrolna_zapremina || t.zapremina || 0), 0);
        }
        return { count, m3: m3.toFixed(3) };
    }, [filtriraniPaketi, filtriraniTrupci, glavniTab]);

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6 font-bold animate-in fade-in" style={{ color: saas.ui.boja_slova }}>
            <PametniDialog {...dialog} />
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-blue-500" user={user} modulIme="lager" saas={saas} hideMasina={true} />

            {/* ZOOM TRAKA - smanji / povećaj koliko želiš (40% - 200%) */}
            <div className="flex flex-wrap items-center gap-2 bg-white text-slate-900 rounded-xl border border-slate-200 px-3 py-2 shadow-sm">
                <span className="text-[13px] font-bold">Prikaz:</span>
                <button onClick={() => setZoom(z => clampZoom(z - 0.1))} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-[18px] font-black leading-none" title="Smanji (Ctrl + točkić dolje, pinch skupljanje)">−</button>
                <input type="range" min="40" max="200" step="5" value={Math.round(zoom * 100)} onChange={e => setZoom(clampZoom(parseInt(e.target.value) / 100))} className="w-36 accent-slate-900" title="Klizač za zoom 40% - 200%" />
                <button onClick={() => setZoom(z => clampZoom(z + 0.1))} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-[18px] font-black leading-none" title="Povećaj (Ctrl + točkić gore, pinch širenje)">+</button>
                <span className="text-[13px] font-bold tabular-nums min-w-[52px] text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(1)} className="px-3 h-8 rounded-lg bg-slate-900 text-white text-[12px] font-bold">Reset 100%</button>
                <button onClick={() => setZoomWheelZoom(v => !v)} className={`px-3 h-8 rounded-lg text-[12px] font-bold border ${zoomWheelZoom ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-300'}`} title="Kad je uključeno, običan točkić bez Ctrl-a zumira. Kad je isključeno, običan točkić scrolla, a Ctrl + točkić zumira.">Točkić = {zoomWheelZoom ? 'zoom ✓' : 'scroll'}</button>
                <span className="text-[12px] text-slate-500">Ctrl + točkić = zoom • Pinch (2 prsta) = zoom • Točkić bez Ctrl-a = {zoomWheelZoom ? 'zoom' : 'scroll'}</span>
            </div>
            <div ref={zoomRef} style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: `${100 / zoom}%`, touchAction: 'pan-x pan-y' }}>

            {saas.isEditMode && (
                <div className="bg-black/60 p-6 rounded-2xl border-2 border-amber-500/50 mb-6 shadow-2xl space-y-6">
                    <div>
                        <h3 className="text-amber-500 font-black uppercase text-sm mb-1">God Mode - Kontrole Dizajna Lagera</h3>
                        <p className="text-slate-400 text-[11px]">Ovo sada uređuje i ovaj modul, ne samo header: labele filtera, vidljivost, te veličina i boja slova za svaku stavku na pločici. Promjene se čuvaju odmah.</p>
                    </div>
                    <div>
                        <h4 className="text-amber-400 font-black uppercase text-[11px] mb-2">1. Filteri — labele</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <label className="text-[10px] text-amber-500 uppercase font-black">Labela: RN filter <input value={pod.labelRN} onChange={e => promijeniPod('labelRN', e.target.value)} className="w-full p-2 mt-1 bg-black text-amber-200 rounded border border-amber-500/40 text-xs font-bold normal-case" /></label>
                            <label className="text-[10px] text-amber-500 uppercase font-black">Placeholder: RN pretraga <input value={pod.labelPretragaPlaceholder} onChange={e => promijeniPod('labelPretragaPlaceholder', e.target.value)} className="w-full p-2 mt-1 bg-black text-amber-200 rounded border border-amber-500/40 text-xs font-bold normal-case" /></label>
                            <label className="text-[10px] text-amber-500 uppercase font-black">Placeholder: brza pretraga <input value={pod.labelBrza} onChange={e => promijeniPod('labelBrza', e.target.value)} className="w-full p-2 mt-1 bg-black text-amber-200 rounded border border-amber-500/40 text-xs font-bold normal-case" /></label>
                            <label className="text-[10px] text-amber-500 uppercase font-black">Labela: Debljina <input value={pod.labelDebljina} onChange={e => promijeniPod('labelDebljina', e.target.value)} className="w-full p-2 mt-1 bg-black text-amber-200 rounded border border-amber-500/40 text-xs font-bold normal-case" /></label>
                            <label className="text-[10px] text-amber-500 uppercase font-black">Labela: Širina <input value={pod.labelSirina} onChange={e => promijeniPod('labelSirina', e.target.value)} className="w-full p-2 mt-1 bg-black text-amber-200 rounded border border-amber-500/40 text-xs font-bold normal-case" /></label>
                            <label className="text-[10px] text-amber-500 uppercase font-black">Labela: Dužina <input value={pod.labelDuzina} onChange={e => promijeniPod('labelDuzina', e.target.value)} className="w-full p-2 mt-1 bg-black text-amber-200 rounded border border-amber-500/40 text-xs font-bold normal-case" /></label>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-amber-400 font-black uppercase text-[11px] mb-2">2. Vidljivost — ovaj modul</h4>
                        <div className="flex flex-wrap gap-2">
                            {[
                                ['prikaziFiltere', 'Prikaži filtere (RN + dimenzije)'],
                                ['prikaziRNPanel', 'Prikaži RN panel'],
                                ['prikaziKupacNaPlocici', 'Pločica: Kupac'],
                                ['prikaziMasinaNaPlocici', 'Pločica: Mašina'],
                                ['prikaziJMNaPlocici', 'Pločica: Komadi / po JM'],
                                ['prikaziProgresNaPlocici', 'Pločica: Realizacija stavke'],
                            ].map(([kljuc, tekst]) => (
                                <button key={kljuc} onClick={() => promijeniPod(kljuc, !pod[kljuc])} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase border ${pod[kljuc] ? 'bg-emerald-900/40 text-emerald-300 border-emerald-500/40' : 'bg-red-900/40 text-red-300 border-red-500/40'}`}>{pod[kljuc] ? '✓ ' : '✕ '}{tekst}</button>
                            ))}
                            <button onClick={() => setLagerPodesavanja({})} className="px-3 py-2 rounded-xl text-[10px] font-black uppercase bg-slate-800 text-slate-200 border border-slate-600">Vrati sve na početno</button>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-amber-400 font-black uppercase text-[11px] mb-2">3. Pločice — veličina i boja slova po stavci</h4>
                        <p className="text-slate-500 text-[10px] mb-2 uppercase">Dimenzije su po defaultu veće (18px). Za svaku stavku posebno biraš veličinu (px) i boju. Prazna boja = automatska.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {[
                                ['paketId', 'Paket ID (npr. 00000004)'],
                                ['naziv', 'Naziv proizvoda'],
                                ['dimenzija', 'Dimenzija (npr. 14X12X600)'],
                                ['rn', 'RN oznaka'],
                                ['kupac', 'Kupac'],
                                ['masina', 'Mašina'],
                                ['ukupno', 'Ukupno u paketu (m³)'],
                                ['komadi', 'Komadi / po JM'],
                                ['progres', 'Realizacija stavke'],
                                ['info', 'Info red (Mašina | Redova)'],
                            ].map(([kljuc, tekst]) => (
                                <div key={kljuc} className="bg-black/40 rounded-xl border border-amber-500/20 p-3 flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] text-amber-400 font-black uppercase truncate">{tekst}</p>
                                        <p className="text-[11px] text-slate-300 truncate mt-1" style={stilZa(kljuc)}>Aa 14X12X600</p>
                                    </div>
                                    <label className="text-[9px] text-slate-400 font-black uppercase shrink-0">Veličina<input type="number" min="8" max="32" value={tileStil[kljuc]?.size} onChange={e => promijeniTileStil(kljuc, 'size', parseInt(e.target.value) || 14)} className="w-16 block p-1 mt-1 bg-black text-amber-200 rounded border border-amber-500/40 text-center font-black" /></label>
                                    <label className="text-[9px] text-slate-400 font-black uppercase shrink-0">Boja<input type="color" value={tileStil[kljuc]?.color || '#ffffff'} onChange={e => promijeniTileStil(kljuc, 'color', e.target.value)} className="w-10 h-8 block mt-1 cursor-pointer rounded bg-transparent" /></label>
                                    <button onClick={() => promijeniTileStil(kljuc, 'color', '')} title="Vrati automatsku boju" className="text-[9px] px-2 py-1 rounded bg-slate-800 text-slate-300 font-black uppercase shrink-0">Auto</button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h4 className="text-amber-400 font-black uppercase text-[11px] mb-2">4. Boje i naslov</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <label className="text-[10px] text-amber-500 uppercase font-black">Boja Pozadine (Kartice): <input type="color" value={saas.ui.boja_kartice || '#1e293b'} onChange={e => saas.setUi({...saas.ui, boja_kartice: e.target.value})} className="w-full h-10 mt-1 cursor-pointer rounded bg-transparent" /></label>
                            <label className="text-[10px] text-amber-500 uppercase font-black">Boja SVIH slova: <input type="color" value={saas.ui.boja_slova || '#ffffff'} onChange={e => saas.setUi({...saas.ui, boja_slova: e.target.value})} className="w-full h-10 mt-1 cursor-pointer rounded bg-transparent" /></label>
                            <label className="text-[10px] text-amber-500 uppercase font-black">Veličina naslova (px): <input type="number" value={saas.ui.velicina_naslova || 16} onChange={e => saas.setUi({...saas.ui, velicina_naslova: e.target.value})} className="w-full p-2 mt-1 bg-black text-amber-400 font-mono rounded" /></label>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row bg-theme-panel p-1.5 rounded-2xl border border-theme-border shadow-inner gap-1 overflow-x-auto custom-scrollbar">
                <button onClick={() => setGlavniTab('paketi')} className={`flex-1 py-4 px-4 rounded-xl text-xs uppercase font-black transition-all whitespace-nowrap flex items-center justify-center gap-2 ${glavniTab === 'paketi' ? 'bg-theme-accent text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-white'}`}>📦 Lager Gotovih Paketa</button>
                <button onClick={() => setGlavniTab('rucni_ulaz')} className={`flex-1 py-4 px-4 rounded-xl text-xs uppercase font-black transition-all whitespace-nowrap flex items-center justify-center gap-2 ${glavniTab === 'rucni_ulaz' ? 'bg-amber-600 text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-white'}`}>➕ Slobodni Ulaz</button>
                <button onClick={() => setGlavniTab('trupci')} className={`flex-1 py-4 px-4 rounded-xl text-xs uppercase font-black transition-all whitespace-nowrap flex items-center justify-center gap-2 ${glavniTab === 'trupci' ? 'bg-emerald-600 text-white shadow-lg' : 'text-theme-muted hover:bg-theme-card hover:text-white'}`}>🪵 Lager Trupaca na Placu</button>
            </div>

            {glavniTab === 'rucni_ulaz' && (
                <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-8 rounded-[2rem] border-2 border-amber-500/50 shadow-2xl space-y-6 animate-in slide-in-from-top-4 max-w-4xl mx-auto" style={{ backgroundColor: saas.ui.boja_kartice }}>
                    <div className="flex items-center gap-3 border-b border-theme-border pb-4 mb-4">
                        <span className="text-3xl">📥</span>
                        <div>
                            <h3 className="text-amber-500 font-black uppercase tracking-widest text-lg">Zaduženje Lagera (Slobodna Roba)</h3>
                            <p className="text-[10px] text-slate-400 mt-1 uppercase">Ovi paketi nemaju vezu sa Radnim Nalogom. Odmah će biti dostupni za prodaju.</p>
                        </div>
                    </div>
                    
                    <div className="relative overflow-visible z-50">
                        <label className="text-[9px] text-slate-400 uppercase font-black tracking-widest ml-1 mb-2 block">Pronađi Artikal iz Kataloga:</label>
                        <MasterSearch 
                            data={katalog} 
                            poljaZaPretragu={['sifra', 'naziv']} 
                            value={rucniUlazForm.naziv}
                            onSelect={(k) => setRucniUlazForm({...rucniUlazForm, naziv: k.naziv, debljina: k.visina, sirina: k.sirina, duzina: k.duzina})} 
                            placeholder="Pretraži po šifri ili nazivu..."
                            renderItem={(k) => (
                                <div>
                                    <div className="text-white text-xs font-black">{k.visina}x{k.sirina}x{k.duzina} cm | {k.naziv}</div>
                                    <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold text-amber-400">Kat: {k.kategorija} | Baza: {k.default_jedinica}</div>
                                </div>
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3 relative z-10">
                        <div className="bg-theme-panel p-3 rounded-xl border border-theme-border shadow-inner text-center">
                            <label className="text-[9px] text-slate-400 uppercase font-black block mb-2">Debljina (cm)</label>
                            <input type="number" value={rucniUlazForm.debljina} onChange={e=>setRucniUlazForm({...rucniUlazForm, debljina:e.target.value})} className="w-full bg-transparent text-theme-text text-xl font-black text-center outline-none" placeholder="0" />
                        </div>
                        <div className="bg-theme-panel p-3 rounded-xl border border-theme-border shadow-inner text-center">
                            <label className="text-[9px] text-slate-400 uppercase font-black block mb-2">Širina (cm)</label>
                            <input type="number" value={rucniUlazForm.sirina} onChange={e=>setRucniUlazForm({...rucniUlazForm, sirina:e.target.value})} className="w-full bg-transparent text-theme-text text-xl font-black text-center outline-none" placeholder="0" />
                        </div>
                        <div className="bg-theme-panel p-3 rounded-xl border border-theme-border shadow-inner text-center">
                            <label className="text-[9px] text-slate-400 uppercase font-black block mb-2">Dužina (cm)</label>
                            <input type="number" value={rucniUlazForm.duzina} onChange={e=>setRucniUlazForm({...rucniUlazForm, duzina:e.target.value})} className="w-full bg-transparent text-theme-text text-xl font-black text-center outline-none" placeholder="0" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
                        <div className="md:col-span-2 bg-amber-900/10 p-4 rounded-xl border border-amber-500/30 text-center flex flex-col justify-center">
                            <label className="text-[9px] text-amber-500 uppercase font-black block mb-2">Količina</label>
                            <input type="number" value={rucniUlazForm.kolicina} onChange={e=>setRucniUlazForm({...rucniUlazForm, kolicina:e.target.value})} className="w-full bg-transparent text-amber-400 text-3xl font-black text-center outline-none" placeholder="0" />
                        </div>
                        <div className="md:col-span-1 bg-theme-panel p-4 rounded-xl border border-theme-border text-center flex flex-col justify-center shadow-inner">
                            <label className="text-[9px] text-slate-400 uppercase font-black block mb-2">Jedinica</label>
                            <select value={rucniUlazForm.jm} onChange={e=>setRucniUlazForm({...rucniUlazForm, jm:e.target.value})} className="w-full py-1 bg-transparent text-theme-text font-black outline-none text-center uppercase cursor-pointer text-xl">
                                <option value="kom">kom</option>
                                <option value="m3">m³</option>
                                <option value="m2">m²</option>
                                <option value="m1">m1</option>
                            </select>
                        </div>
                        <div className="md:col-span-1 bg-theme-panel p-4 rounded-xl border border-theme-border text-center flex flex-col justify-center shadow-inner">
                            <label className="text-[9px] text-slate-400 uppercase font-black block mb-2">Klasa</label>
                            <select value={rucniUlazForm.klasa} onChange={e=>setRucniUlazForm({...rucniUlazForm, klasa:e.target.value})} className="w-full py-1 bg-transparent text-theme-text font-black outline-none text-center uppercase cursor-pointer text-xl">
                                <option value="I Klasa">I Klasa</option>
                                <option value="II Klasa">II Klasa</option>
                                <option value="III Klasa">III Klasa</option>
                                <option value="Standard">Standard</option>
                            </select>
                        </div>
                    </div>

                    {rucniUlazForm.kolicina && (
                        <div className="text-[10px] text-emerald-400 bg-emerald-900/20 p-2 rounded-lg border border-emerald-500/20 text-center uppercase animate-in zoom-in-95 mt-2 relative z-10">
                            Automatski preračunato: <span className="text-theme-text text-sm ml-1 font-black">{livePreracunRucniM3} m³</span>
                        </div>
                    )}

                    <button onClick={spasiSlobodniUlaz} className="w-full bg-amber-600 hover:bg-amber-500 text-theme-text font-black px-6 py-5 rounded-xl uppercase text-sm shadow-xl transition-all border border-amber-400 tracking-widest relative z-10">
                        ✅ Snimi paket na Lager
                    </button>
                </div>
            )}

            {(glavniTab === 'paketi' || glavniTab === 'trupci') && (
                <div className="bg-theme-card backdrop-blur-[var(--glass-blur)] p-6 rounded-box border border-theme-border shadow-2xl space-y-5 relative z-40" style={{ backgroundColor: saas.ui.boja_kartice }}>
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <input value={pretraga} onChange={e => setPretraga(e.target.value.toUpperCase())} placeholder={glavniTab === 'paketi' ? pod.labelBrza : "Pretraga po ID-u, Šumariji, Otpremnici, Vrsti..."} className="w-full p-4 bg-theme-panel border border-theme-border rounded-2xl text-theme-text outline-none focus:border-blue-500 font-black uppercase shadow-inner" />
                            <button onClick={() => setIsScanning(true)} className="absolute right-2 top-2 bottom-2 px-4 bg-theme-accent rounded-xl text-white font-bold hover:opacity-80 transition-all shadow-lg text-xl">📷</button>
                        </div>
                        {glavniTab === 'paketi' && (
                            <div className="flex bg-theme-card p-1 rounded-2xl border border-theme-border shrink-0 overflow-x-auto custom-scrollbar">
                                {['U PROIZVODNJI', 'NA STANJU', 'OTPREMLJENO'].map(t => (
                                    <button key={t} onClick={() => setSubTabPaketi(t)} className={`px-4 py-2 shrink-0 rounded-xl text-[9px] font-black uppercase transition-all ${subTabPaketi === t ? 'bg-theme-accent text-white shadow-md' : 'text-slate-500 hover:text-theme-text'}`}>{t}</button>
                                ))}
                            </div>
                        )}
                    </div>

                    {saas.isEditMode && !pod.prikaziFiltere && glavniTab === 'paketi' && (
                        <div className="bg-amber-900/20 border-2 border-dashed border-amber-500/60 rounded-2xl p-3 mt-4 text-center text-[10px] text-amber-300 font-black uppercase">Filteri su SKRIVENI u podešavanjima (Uredi) — ovdje se vidi samo ova oznaka</div>
                    )}
                    {saas.isEditMode && pod.prikaziFiltere && glavniTab === 'paketi' && <div className="bg-amber-500/20 border border-dashed border-amber-500 rounded-xl px-3 py-1 mt-4 text-[9px] text-amber-300 font-black uppercase tracking-widest">✎ Uređivanje: filteri Lagera — labele se mijenjaju gore u God Mode panelu</div>}
                    {glavniTab === 'paketi' && pod.prikaziFiltere && (
                        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-4 border-t ${saas.isEditMode ? 'border-dashed border-amber-500/50 rounded-xl p-2' : 'border-theme-border'}`}>
                            <div>
                                <label className="text-[9px] text-slate-400 uppercase ml-2 mb-1 block font-black">{pod.labelRN}</label>
                                <div className="h-[45px]"><MasterSearch data={aktivniNalozi} poljaZaPretragu={['id', 'kupac_naziv']} value={fPaket.rn} onChange={(v) => setFPaket(prev => ({ ...prev, rn: v }))} onSelect={n => setFPaket(prev => ({ ...prev, rn: n.id }))} filterFn={(nalog, upitNorm) => daLiNalogOdgovara(nalog, upitNorm)} placeholder={pod.labelPretragaPlaceholder} renderItem={(n) => (<div><div className="text-white text-xs font-black">{n.id} <span className="text-[10px] text-purple-300 ml-1 uppercase">{n.status}</span></div><div className="text-[10px] text-slate-300 mt-1">Kupac: {n.kupac_naziv}{n.broj_ponude ? ` | Ponuda: ${n.broj_ponude}` : ''}{n.datum ? ` | ${n.datum}` : ''}</div><div className="text-[10px] text-slate-500 mt-0.5 truncate">{(n.stavke_jsonb || []).map(st => `${st.naziv} ${st.dimenzije || ''}`).join(' | ')}</div></div>)} /></div>
                                <p className="text-[9px] text-slate-500 mt-1 ml-2 uppercase">Kucanje već filtrira — ne moraš kliknuti. Klik sužava na taj jedan nalog.</p>
                            </div>
                            <div>
                                <label className="text-[9px] text-slate-400 uppercase ml-2 mb-1 block font-black">{pod.labelDebljina}</label>
                                <div className="grid grid-cols-2 gap-1.5">
                                    <input type="number" value={fPaket.debljinaOd} onChange={e=>setFPaket({...fPaket, debljinaOd: e.target.value})} placeholder="Od cm" className="w-full min-h-[45px] px-2 bg-theme-panel border border-theme-border rounded-xl text-xs text-center text-theme-text outline-none focus:border-blue-500" />
                                    <input type="number" value={fPaket.debljinaDo} onChange={e=>setFPaket({...fPaket, debljinaDo: e.target.value})} placeholder="Do cm" className="w-full min-h-[45px] px-2 bg-theme-panel border border-theme-border rounded-xl text-xs text-center text-theme-text outline-none focus:border-blue-500" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[9px] text-slate-400 uppercase ml-2 mb-1 block font-black">{pod.labelSirina}</label>
                                <div className="grid grid-cols-2 gap-1.5">
                                    <input type="number" value={fPaket.sirinaOd} onChange={e=>setFPaket({...fPaket, sirinaOd: e.target.value})} placeholder="Od cm" className="w-full min-h-[45px] px-2 bg-theme-panel border border-theme-border rounded-xl text-xs text-center text-theme-text outline-none focus:border-blue-500" />
                                    <input type="number" value={fPaket.sirinaDo} onChange={e=>setFPaket({...fPaket, sirinaDo: e.target.value})} placeholder="Do cm" className="w-full min-h-[45px] px-2 bg-theme-panel border border-theme-border rounded-xl text-xs text-center text-theme-text outline-none focus:border-blue-500" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[9px] text-slate-400 uppercase ml-2 mb-1 block font-black">{pod.labelDuzina}</label>
                                <div className="grid grid-cols-2 gap-1.5">
                                    <input type="number" value={fPaket.duzinaOd} onChange={e=>setFPaket({...fPaket, duzinaOd: e.target.value})} placeholder="Od cm" className="w-full min-h-[45px] px-2 bg-theme-panel border border-theme-border rounded-xl text-xs text-center text-theme-text outline-none focus:border-blue-500" />
                                    <input type="number" value={fPaket.duzinaDo} onChange={e=>setFPaket({...fPaket, duzinaDo: e.target.value})} placeholder="Do cm" className="w-full min-h-[45px] px-2 bg-theme-panel border border-theme-border rounded-xl text-xs text-center text-theme-text outline-none focus:border-blue-500" />
                                </div>
                            </div>
                            <div className="flex flex-col justify-end">
                                <button onClick={() => { setPretraga(''); setFPaket({ rn: '', debljinaOd: '', debljinaDo: '', sirinaOd: '', sirinaDo: '', duzinaOd: '', duzinaDo: '' }); }} className="w-full min-h-[45px] p-3 bg-theme-panel text-slate-400 rounded-xl text-[10px] uppercase font-black hover:bg-red-900/30 hover:text-red-400 border border-theme-border transition-colors">
                                    Poništi filtere ✕
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ============ UNIVERZALNI RN PANEL ============ */}
            {/* Ranije: jedan RN + crash na `item`. Sada: lista svih naloga koji odgovaraju
                upitu (kupac / RN / proizvod / dimenzija / status / ponuda / napomena),
                sa realizacijom po stavci u TRAŽENOM JM-u, ne samo u m3. */}
            {saas.isEditMode && !pod.prikaziRNPanel && glavniTab === 'paketi' && upitRN && (
                <div className="bg-amber-900/20 border-2 border-dashed border-amber-500/60 rounded-2xl p-3 text-center text-[10px] text-amber-300 font-black uppercase">RN panel je SKRIVEN u podešavanjima (Uredi) — ovdje se vidi samo ova oznaka</div>
            )}
            {glavniTab === 'paketi' && upitRN && pod.prikaziRNPanel && (
                <div className={`bg-white text-slate-900 rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative z-30 ${saas.isEditMode ? 'outline outline-2 outline-dashed outline-amber-500' : ''}`}>
                    {saas.isEditMode && <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-[12px] text-amber-800 font-semibold">Uređivanje: RN panel — vidljivost se mijenja gore u God Mode panelu</div>}
                    <div className="flex justify-between items-start gap-3 px-5 pt-4 pb-3 border-b border-slate-200">
                        <div>
                            <p className="text-[14px] font-bold text-slate-900">Pretraga: <span className="font-mono">{upitRN}</span></p>
                            <p className="text-[13px] text-slate-600 mt-1">
                                Pronađeno naloga: <b className="text-slate-900">{pronadjeniNalozi.length}</b>
                                {pronadjeniNalozi.length > 50 ? ' (prikazano prvih 50)' : ''} · Paketi za ovaj RN (svi tabovi): <b className="text-slate-900">{paketiZaRN.length}</b>
                                {pronadjeniNalozi.length === 0 && ' — nema naloga, ali su prikazani paketi koji sami odgovaraju upitu (npr. slobodna roba).'}
                            </p>
                            {paketiZaRN.length > 0 && (
                                <p className="text-[13px] text-slate-600 mt-1">
                                    Od toga: <span className="font-bold text-amber-700">U proizvodnji: {paketiZaRNPoTabu['U PROIZVODNJI'] || 0}</span> · <span className="font-bold text-emerald-700">Na stanju: {paketiZaRNPoTabu['NA STANJU'] || 0}</span> · <span className="font-bold text-orange-700">Otpremljeno: {paketiZaRNPoTabu['OTPREMLJENO'] || 0}</span>
                                </p>
                            )}
                            <p className="text-[12px] text-slate-500 mt-1">RN pretraga prikazuje pakete iz svih tabova — tab filter je privremeno isključen dok je RN upit aktivan. Kucanje već filtrira. Klik na nalog sužava na taj jedan nalog.</p>
                        </div>
                        <button onClick={() => setFPaket(prev => ({ ...prev, rn: '' }))} className="text-[13px] px-3 py-2 rounded-lg font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 shrink-0">Poništi RN filter ✕</button>
                    </div>
                    {rnDetaljiLista.length === 0 && pronadjeniNalozi.length === 0 && (
                        <p className="text-[13px] text-slate-500 italic px-5 py-3">Nema naloga za ovaj upit. Probaj: ime kupca, broj RN-a, šifru / naziv proizvoda, dimenziju, status ili broj ponude.</p>
                    )}
                    <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1 px-5 py-4">
                        {rnDetaljiLista.map(rn => (
                            <div key={rn.id} className="bg-white text-slate-900 border border-slate-200 rounded-2xl p-5 shadow-sm">
                                <div className="flex flex-wrap justify-between items-start gap-3">
                                    <div>
                                        <p className="font-mono font-bold text-[16px] text-slate-900">{rn.id}</p>
                                        <p className="text-[14px] font-semibold text-slate-900 mt-1">Kupac: {rn.kupac || '—'}{rn.broj_ponude ? ` · Ponuda: ${rn.broj_ponude}` : ''}</p>
                                        <p className="text-[13px] text-slate-600 mt-1">{rn.datum ? `Datum: ${rn.datum}` : ''}{rn.rok_isporuke ? ` · Rok: ${rn.rok_isporuke}` : ''}{rn.tip_naloga ? ` · Tip: ${rn.tip_naloga}` : ''}{rn.napomena ? ` · Napomena: ${rn.napomena}` : ''}</p>
                                    </div>
                                    <div className="text-right shrink-0 space-y-1">
                                        <div className="text-[13px]"><span className="text-slate-500 mr-2">Status u bazi:</span><span className={`inline-block px-2 py-1 rounded-md text-[13px] font-bold ${String(rn.status || '').toUpperCase().includes('ZAVRŠ') ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>{rn.status || '—'}</span></div>
                                        <div className="text-[13px]"><span className="text-slate-500 mr-2">Izračunato:</span><span className={`inline-block px-2 py-1 rounded-md text-[13px] font-bold ${rn.izracunatiStatus === 'ZAVRŠENO' ? 'bg-emerald-600 text-white' : rn.izracunatiStatus.startsWith('DJELIMIČNO') ? 'bg-amber-100 text-amber-900' : rn.izracunatiStatus === 'NIJE POČETO' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'}`}>{rn.izracunatiStatus}</span></div>
                                        <p className="text-[13px] font-semibold text-slate-700 tabular-nums">Zaključeno {rn.ukupnoZakljucenoM3.toFixed(3)} / Traženo {rn.ukupnoTrazenoM3.toFixed(3)} m³</p>
                                    </div>
                                </div>
                                {rn.statusNeslaganje && (
                                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 mt-3">
                                        <p className="text-[13px] font-bold text-red-800">⚠️ Neslaganje statusa — status iz baze nije tačan</p>
                                        <p className="text-[13px] text-red-700 mt-1 leading-relaxed">U bazi piše <b>{rn.status}</b>, a izračunato po svim stavkama i paketima je <b>{rn.izracunatiStatus}</b>. RN je završen samo kad su <b>sve</b> stavke zaključene <b>i</b> svi paketi zaključeni. Ovdje je gotovo <b>{rn.brojGotovih}/{rn.brojStavki} stavki</b>, {rn.brojDimenzija} dimenzije, paketa {rn.brojPaketaRN} (zaključeno {rn.brojZakljucenihPaketaRN}, otvoreno {rn.brojOtvorenihPaketaRN}).</p>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3"><p className="text-[11px] text-slate-500 font-semibold">Traženo — cijeli RN</p><p className="text-[15px] font-bold text-slate-900 tabular-nums mt-1">{rn.ukupnoTrazenoM3.toFixed(3)} m³</p><p className="text-[13px] text-slate-700 tabular-nums">{rn.ukupnoTrazenoKom.toFixed(2)} kom</p><p className="text-[12px] text-slate-500 mt-1">{rn.brojStavki} stavki · {rn.brojDimenzija} dimenzije</p></div>
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3"><p className="text-[11px] text-emerald-700 font-semibold">Zaključeno — gotovo</p><p className="text-[15px] font-bold text-emerald-800 tabular-nums mt-1">{rn.ukupnoZakljucenoM3.toFixed(3)} m³</p><p className="text-[13px] text-emerald-700 tabular-nums">{rn.ukupnoZakljucenoKom.toFixed(2)} kom</p><p className="text-[12px] text-emerald-600 mt-1">Samo zaključeni paketi</p></div>
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3"><p className="text-[11px] text-amber-700 font-semibold">U izradi — otvoreni paketi</p><p className="text-[15px] font-bold text-amber-800 tabular-nums mt-1">{rn.ukupnoUIzradiM3.toFixed(3)} m³</p><p className="text-[13px] text-amber-700 tabular-nums">{rn.ukupnoUIzradiKom.toFixed(2)} kom</p><p className="text-[12px] text-amber-600 mt-1">Nije gotovo dok se ne zaključi</p></div>
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3"><p className="text-[11px] text-slate-500 font-semibold">Ostatak — još za napraviti</p><p className="text-[15px] font-bold text-slate-900 tabular-nums mt-1">{Math.max(0, rn.ukupnoTrazenoM3 - rn.ukupnoZakljucenoM3 - rn.ukupnoUIzradiM3).toFixed(3)} m³</p><p className="text-[13px] text-slate-700 tabular-nums">{Math.max(0, rn.ukupnoTrazenoKom - rn.ukupnoZakljucenoKom - rn.ukupnoUIzradiKom).toFixed(2)} kom</p><p className="text-[12px] text-slate-500 mt-1">Traženo − Zaključeno − U izradi</p></div>
                                </div>
                                <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 mt-3">
                                    <div className="bg-emerald-500" style={{ width: `${rn.ukupnoTrazenoM3 > 0 ? Math.min(100, (rn.ukupnoZakljucenoM3 / rn.ukupnoTrazenoM3) * 100) : 0}%` }} />
                                    <div className="bg-amber-400" style={{ width: `${rn.ukupnoTrazenoM3 > 0 ? Math.min(100 - Math.min(100, (rn.ukupnoZakljucenoM3 / rn.ukupnoTrazenoM3) * 100), (rn.ukupnoUIzradiM3 / rn.ukupnoTrazenoM3) * 100) : 0}%` }} />
                                </div>
                                <p className="text-[12px] text-slate-500 mt-1 text-right tabular-nums">Zaključeno {rn.ukupnoTrazenoM3 > 0 ? Math.round((rn.ukupnoZakljucenoM3 / rn.ukupnoTrazenoM3) * 100) : 0}% · U izradi {rn.ukupnoTrazenoM3 > 0 ? Math.round((rn.ukupnoUIzradiM3 / rn.ukupnoTrazenoM3) * 100) : 0}% · Ostatak {rn.ukupnoTrazenoM3 > 0 ? Math.max(0, 100 - Math.round(((rn.ukupnoZakljucenoM3 + rn.ukupnoUIzradiM3) / rn.ukupnoTrazenoM3) * 100)) : 100}%</p>
                                <p className="text-[12px] text-slate-500 mt-2">Kako se čita: <b className="text-slate-700">Traženo</b> je iz RN-a. <b className="text-emerald-700">Zaključeno</b> je samo zaključeni paket. <b className="text-amber-700">U izradi</b> je otvoreni paket — nije gotovo. <b className="text-slate-700">Ostatak</b> je ono što još treba napraviti. Ispod su <b className="text-slate-700">sve</b> stavke RN-a, red po red.</p>
                                {(rn.grupe || []).filter(g => g.stavke.length > 1).length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        <p className="text-[13px] font-bold text-slate-900">Ukupno po dimenziji — kad se ista šifra + dimenzija ponavlja</p>
                                        {(rn.grupe || []).filter(g => g.stavke.length > 1).map(g => (
                                            <div key={g.kljuc} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                                <p className="text-[14px] font-bold text-slate-900">{g.sifra} · {g.naziv} <span className="text-[12px] font-normal text-slate-500">— {g.stavke.length} stavke, dimenzija {g.dimenzijeTekst || '—'}</span></p>
                                                <p className="text-[13px] text-slate-700 mt-1 tabular-nums">Traženo: {g.ukupnoTrazenoM3.toFixed(3)} m³ / {g.ukupnoTrazenoKom.toFixed(2)} kom · Napravljeno: {g.ukupnoNapravljenoM3.toFixed(3)} m³ / {g.ukupnoNapravljenoKom.toFixed(2)} kom · Ostatak: {g.ukupnoFaliM3.toFixed(3)} m³ / {g.ukupnoFaliKom.toFixed(2)} kom · {g.procenat.toFixed(0)}% gotovo (grupa)</p>
                                                {g.imaNeslaganje && <p className="text-[12px] text-amber-700 mt-1">U ovoj grupi je u RN-u upisano više m³ nego što kom × vol daje — vidi upozorenje na stavci ispod.</p>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="mt-4 overflow-x-auto border border-slate-200 rounded-xl">
                                    <table className="w-full text-left text-[13px] leading-relaxed">
                                        <thead className="bg-slate-100 text-slate-700">
                                            <tr><th className="px-3 py-2 font-semibold">Šifra · Naziv</th><th className="px-3 py-2 font-semibold">Dimenzija</th><th className="px-3 py-2 font-semibold text-right tabular-nums">Traženo</th><th className="px-3 py-2 font-semibold text-right tabular-nums">Zaključeno</th><th className="px-3 py-2 font-semibold text-right tabular-nums">U izradi</th><th className="px-3 py-2 font-semibold text-right tabular-nums">Ostatak</th><th className="px-3 py-2 font-semibold text-right tabular-nums">%</th><th className="px-3 py-2 font-semibold">Status</th></tr>
                                        </thead>
                                        <tbody>
                                            {rn.stavke.map((st, i) => {
                                                const jeGotovo = (st.faliZakljucenoM3 ?? st.faliM3 ?? 999) <= 0.0005 && (st.napravljenoUIzradiM3 ?? 0) <= 0.0005 && !st.imaOtvorenRed;
                                                const jeUIzradi = !jeGotovo && ((st.napravljenoM3 ?? 0) > 0 || st.imaOtvorenRed);
                                                const statusTxt = jeGotovo ? 'Gotovo' : jeUIzradi ? 'U izradi' : 'Nije početo';
                                                const statusCls = jeGotovo ? 'bg-emerald-100 text-emerald-800' : jeUIzradi ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-800';
                                                const borderCls = jeGotovo ? 'border-l-4 border-l-emerald-500' : jeUIzradi ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-red-500';
                                                const ostatakM3 = Math.max(0, (st.trazenoM3 ?? 0) - (st.napravljenoZakljucenoM3 ?? 0) - (st.napravljenoUIzradiM3 ?? 0));
                                                const ostatakKom = Math.max(0, (st.trazenoKom ?? 0) - (st.napravljenoZakljucenoKom ?? 0) - (st.napravljenoUIzradiKom ?? 0));
                                                return (
                                                    <tr key={st.id || i} className={`border-t border-slate-100 ${borderCls}`}>
                                                        <td className="px-3 py-2"><span className="font-mono font-bold text-slate-900">{st.sifra}</span><br /><span className="text-slate-700">{st.naziv}</span>{st.neslaganjeUnosObracun && <span className="block text-[12px] text-amber-700 mt-1">Upozorenje: upisano {st.trazenoUJMUpisano} {st.jmUnos}, obračun {st.kolObracun} {st.jmObracunRaw} — ne slaže se po dimenziji.</span>}</td>
                                                        <td className="px-3 py-2 font-mono font-bold text-slate-900 tabular-nums">{st.dimenzijeTekst || '—'}{st.dimNedostaje && <span className="block text-[12px] text-red-600 font-sans font-normal">Dimenzija nedostaje — kom se ne može tačno izračunati.</span>}</td>
                                                        <td className="px-3 py-2 text-right tabular-nums">{st.trazenoM3 == null ? '—' : `${st.trazenoM3.toFixed(3)} m³`}<br /><span className="text-slate-500">{st.trazenoKom == null ? '—' : `${st.trazenoKom.toFixed(2)} kom`}</span></td>
                                                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-800">{st.napravljenoZakljucenoM3.toFixed(3)} m³<br /><span className="font-normal text-slate-500">{st.napravljenoZakljucenoKom.toFixed(2)} kom</span></td>
                                                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-800">{st.napravljenoUIzradiM3.toFixed(3)} m³<br /><span className="font-normal text-slate-500">{st.napravljenoUIzradiKom.toFixed(2)} kom</span></td>
                                                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{ostatakM3.toFixed(3)} m³<br /><span className="font-normal text-slate-500">{ostatakKom.toFixed(2)} kom</span></td>
                                                        <td className="px-3 py-2 text-right tabular-nums font-bold">{st.procenatGotovo != null ? `${st.procenatGotovo.toFixed(0)}%` : `${st.procenat.toFixed(0)}%`}</td>
                                                        <td className="px-3 py-2"><span className={`inline-block px-2 py-1 rounded-md text-[12px] font-bold ${statusCls}`}>{statusTxt}</span>{(st.visakM3 ?? 0) > 0.0005 && <span className="block text-[12px] text-orange-700 mt-1">Višak: +{st.visakM3.toFixed(3)} m³</span>}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-slate-50 font-bold">
                                            <tr className="border-t border-slate-200"><td className="px-3 py-2" colSpan="2">Ukupno — cijeli RN</td><td className="px-3 py-2 text-right tabular-nums">{rn.ukupnoTrazenoM3.toFixed(3)} m³<br /><span className="font-normal text-slate-500">{rn.ukupnoTrazenoKom.toFixed(2)} kom</span></td><td className="px-3 py-2 text-right tabular-nums text-emerald-800">{rn.ukupnoZakljucenoM3.toFixed(3)} m³<br /><span className="font-normal text-slate-500">{rn.ukupnoZakljucenoKom.toFixed(2)} kom</span></td><td className="px-3 py-2 text-right tabular-nums text-amber-800">{rn.ukupnoUIzradiM3.toFixed(3)} m³<br /><span className="font-normal text-slate-500">{rn.ukupnoUIzradiKom.toFixed(2)} kom</span></td><td className="px-3 py-2 text-right tabular-nums">{Math.max(0, rn.ukupnoTrazenoM3 - rn.ukupnoZakljucenoM3 - rn.ukupnoUIzradiM3).toFixed(3)} m³<br /><span className="font-normal text-slate-500">{Math.max(0, rn.ukupnoTrazenoKom - rn.ukupnoZakljucenoKom - rn.ukupnoUIzradiKom).toFixed(2)} kom</span></td><td className="px-3 py-2 text-right tabular-nums">{rn.ukupnoTrazenoM3 > 0 ? ((rn.ukupnoZakljucenoM3 / rn.ukupnoTrazenoM3) * 100).toFixed(0) : 0}%</td><td className="px-3 py-2">{rn.brojGotovih}/{rn.brojStavki} gotovo</td></tr>
                                        </tfoot>
                                    </table>
                                </div>
                                <div className="mt-3 space-y-2">
                                    <p className="text-[13px] font-bold text-slate-900">Paketi po stavci — koji paket pripada kojoj stavci</p>
                                    {rn.stavke.map((st, i) => (
                                        <div key={st.id || i} className="text-[13px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                            <span className="font-mono font-bold text-slate-900">{st.sifra}</span> · {st.dimenzijeTekst || '—'} — {(st.paketiLista || []).length === 0 ? 'Nema paketa — zato je Nije početo.' : (st.paketiLista || []).map(pk => `Paket ${pk.paket_id} (${pk.m3.toFixed(3)} m³ / ${pk.kom.toFixed(2)} kom, ${pk.closed ? 'zaključen' : 'otvoren'}, mašina ${pk.masina || '—'}${pk.otpremnica_id ? `, otpremnica ${pk.otpremnica_id}` : ''}`).join(' · ')}
                                            {st.dimenzijeTekst && <span className="block text-[12px] text-slate-500 mt-1">Računica: 1 kom = {st.volKom ? st.volKom.toFixed(4) : '—'} m³ (dimenzija {st.dimenzijeTekst}). Traženo {st.trazenoKom != null ? `${st.trazenoKom.toFixed(2)} kom` : '—'} × {st.volKom ? st.volKom.toFixed(4) : '—'} = {st.trazenoM3 != null ? `${st.trazenoM3.toFixed(3)} m³` : '—'}.</span>}
                                        </div>
                                    ))}
                                </div>
                                {(rn.orphanPaketi || []).length > 0 && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3">
                                        <p className="text-[13px] font-bold text-amber-900">Paketi vezani za RN, ali nisu u stavkama RN-a ({rn.orphanPaketi.length}) — provjeri da li stavka fali ili je paket višak</p>
                                        {rn.orphanPaketi.map(op => (
                                            <p key={op.paket_id} className="text-[13px] text-amber-800 mt-1">Paket <b>{op.paket_id}</b> — {op.sifra ? `šifra ${op.sifra} · ` : ''}dimenzija {op.dim} — {op.m3.toFixed(3)} m³ / {op.kom.toFixed(2)} kom — {op.closed ? 'zaključen' : 'otvoren'} — Mašina: {op.masina || '—'}{op.otpremnica_id ? ` — Otpremnica ${op.otpremnica_id}` : ''} — Nema stavke za ovu šifru + dimenziju u RN-u, pa se ne broji u Traženo, ali se broji u paketima.</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {(glavniTab === 'paketi' || glavniTab === 'trupci') && (
                <>
                    <div className="flex justify-between items-center bg-theme-card p-4 rounded-2xl border border-theme-border" style={{ backgroundColor: saas.ui.boja_kartice }}>
                        <p className="text-slate-500 text-xs uppercase">Prikazano: <span className="text-theme-text font-black ml-1">{stats.count}</span></p>
                        <p className="text-emerald-500 text-sm font-black uppercase">Ukupna zapremina: <span className="text-2xl ml-2 text-emerald-400">{stats.m3} m³</span></p>
                    </div>

                    {saas.isEditMode && <div className="bg-amber-500/20 border border-dashed border-amber-500 rounded-xl px-3 py-1 text-[9px] text-amber-300 font-black uppercase tracking-widest col-span-full">✎ Uređivanje: pločice — veličina i boja slova po stavci se mijenjaju gore u God Mode panelu (sekcija 3)</div>}
                    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${saas.isEditMode ? 'border-2 border-dashed border-amber-500/50 rounded-2xl p-2' : ''}`}>
                        {loading ? (
                            <div className="col-span-full text-center py-20 animate-pulse text-theme-accent font-black tracking-widest uppercase">Učitavam lager...</div>
                        ) : (glavniTab === 'paketi' ? filtriraniPaketi : filtriraniTrupci).map(item => {
                            if (glavniTab === 'trupci') {
                                return (
                                    <div key={item.id} onClick={() => { if(glavniTab==='paketi') ucitajHistoriju(item); }} className="p-5 rounded-box border border-theme-border bg-theme-panel hover:border-theme-accent hover:-translate-y-1 cursor-pointer transition-all shadow-xl group relative overflow-hidden">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex-1 pr-2">
                                                <p className="text-amber-500 font-black text-lg font-mono">QR: {item.id}</p>
                                                <p className="text-theme-text font-bold text-xs uppercase mt-1">{item.vrsta} | Klasa: {item.klasa}</p>
                                                <div className="flex gap-2 mt-2">
                                                    <span className="text-[9px] bg-theme-card text-theme-text px-2 py-1 rounded border border-theme-border font-black uppercase shadow-inner">Dužina: {item.kontrolna_duzina || item.duzina} m</span>
                                                    <span className="text-[9px] bg-theme-card text-theme-text px-2 py-1 rounded border border-theme-border font-black uppercase shadow-inner">Prečnik: Ø {item.kontrolni_promjer || item.promjer} cm</span>
                                                </div>
                                                <p className="text-[9px] text-slate-500 mt-3 font-bold uppercase">Šumarija: <span className="text-theme-text">{item.sumarija}</span></p>
                                                <p className="text-[9px] text-slate-500 mt-1 font-bold uppercase">Otpremnica: <span className="text-theme-text">{item.otpremnica_broj}</span></p>
                                            </div>
                                            <div className="text-right flex flex-col items-end shrink-0">
                                                <div className="bg-emerald-900/20 border border-emerald-500/30 px-3 py-2 rounded-xl text-right">
                                                    <p className="text-emerald-400 font-black text-xl font-mono leading-none">{parseFloat(item.kontrolna_zapremina || item.zapremina || 0).toFixed(3)} <span className="text-[10px]">m³</span></p>
                                                </div>
                                                <p className="text-[8px] text-slate-500 mt-3 font-bold uppercase">Prijem: <br/>{item.datum_prijema ? new Date(item.datum_prijema).toLocaleDateString('bs-BA') : '—'}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                            // ---- PAKETI: 1 paket_id = 1 pločica ----
                            const kupac = kupacZaPaket(item);
                            // FIX za "70.00 kom + 86.00 m1" + "≈ 86 kom": staro je grupisalo samo po JM-u,
                            // pa je zbrajalo razlicite dimenzije (12x10x500 + 14x12x600) u jedan broj.
                            // Sad se grupise po dimenzija + JM, a ukupna procjena u komadima je suma
                            // redUKomade (konverzija m1/m2/m3 -> kom), ne suma kolicina_ulaz.
                            const jmPoDim = {};
                            (item.redovi || []).forEach(rr => {
                                const key = `${dimenzijeKljuc(rr.debljina, rr.sirina, rr.duzina)}|${String(rr.jm || 'kom').toLowerCase()}`;
                                if (!jmPoDim[key]) jmPoDim[key] = { dim: dimenzijeKljuc(rr.debljina, rr.sirina, rr.duzina), jm: String(rr.jm || 'kom').toLowerCase(), kol: 0, m3: 0, kom: 0 };
                                jmPoDim[key].kol += parseFloat(rr.kolicina_ulaz ?? rr.komada ?? 0) || 0;
                                jmPoDim[key].m3 += parseFloat(rr.kolicina_final || 0) || 0;
                                jmPoDim[key].kom += redUKomade(rr);
                            });
                            const jmTekstLista = Object.values(jmPoDim).map(e => `${e.kol.toFixed(2)} ${e.jm} — ${e.dim} (= ${e.kom.toFixed(2)} kom / ${e.m3.toFixed(3)} m³)`);
                            const jmTekst = jmTekstLista.join(' | ') || `${item.kolicina_ulaz || 0} ${item.jm || 'kom'}`;
                            let progresStavka = null;
                            if (upitRN && rnDetaljiLista.length > 0) {
                                for (const rn of rnDetaljiLista) {
                                    const st = (rn.stavke || []).find(s => (sviPaketiRaw || []).some(r => (String(r.broj_veze || '').toUpperCase() === String(rn.id).toUpperCase() || String(r.rn_id || '').toUpperCase() === String(rn.id).toUpperCase()) && String(r.stavka_id || '') === String(s.id || '') && String(r.paket_id || '') === String(item.paket_id || '')));
                                    if (st) { progresStavka = { rnId: rn.id, stavka: st }; break; }
                                }
                            }
                            return (
                                <div key={item.paket_id} onClick={() => { if(glavniTab==='paketi') ucitajHistoriju(item); }} className={`p-5 rounded-2xl border-2 shadow-md cursor-pointer hover:-translate-y-1 transition-all group relative overflow-hidden ${item.otpremnica_id ? 'bg-orange-900/10 border-orange-500/30' : item.closed_at ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-amber-900/10 border-amber-500/30'}`}>
                                    {item.jeBezIdPaketa && <div className="absolute bottom-0 right-0 bg-red-900/70 text-red-200 text-[8px] px-2 py-1 font-black rounded-tl-xl uppercase">Bez paket ID-a (red {item.id})</div>}
                                    <div className="flex justify-between items-start mb-3">
                                        <p className="text-theme-text font-black truncate" style={stilZa('paketId')}>{item.paket_id} <span className="opacity-50 mx-1">|</span> <span style={stilZa('naziv')}>{item.naziv_proizvoda}</span></p>
                                        <span className={`text-[9px] px-2 py-1 rounded font-black uppercase tracking-widest shrink-0 ${item.jePotrosenoUDoradi ? 'bg-purple-600 text-white' : item.statusOznaka === 'DJELIMIČNO OTPREMLJEN' ? 'bg-blue-600 text-white' : item.otpremnica_id ? 'bg-orange-500 text-white' : item.closed_at ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-black'}`}>
                                            {item.jePotrosenoUDoradi ? 'POTROŠENO U DORADI 🔄' : item.statusOznaka === 'DJELIMIČNO OTPREMLJEN' ? 'DJELIMIČNO OTPREMLJEN' : item.otpremnica_id ? `OTPREMLJEN (${item.otpremnica_id})` : item.closed_at ? 'ZAVRŠEN ✅' : 'U PROIZVODNJI ⏳'}
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        {(item.dimenzijeLista && item.dimenzijeLista.length > 0 ? item.dimenzijeLista : [dimenzijeKljuc(item.debljina, item.sirina, item.duzina)]).map(dimTxt => {
                                            const jeTrazena = trazeneDimenzijeSet.has(normalizujZaPretragu(dimTxt));
                                            return <p key={dimTxt} className="text-amber-400 font-black uppercase tracking-widest font-mono" style={stilZa('dimenzija')}>Dimenzija: {dimTxt} <span className="lowercase text-slate-400" style={{ fontSize: `${Math.max(9, (tileStil.dimenzija?.size || 18) - 6)}px` }}>cm</span>{jeTrazena && <span className="bg-amber-900/40 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded ml-2" style={{ fontSize: `${Math.max(9, (tileStil.dimenzija?.size || 18) - 6)}px` }}>TRAŽENA ✓</span>}</p>;
                                        })}
                                    </div>
                                    {progresStavka && (
                                        <>
                                            <div className="w-full h-2 bg-slate-800 rounded-full mt-2 overflow-hidden"><div className={`h-full ${progresStavka.stavka.procenat > 100 ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, progresStavka.stavka.procenat)}%` }} /></div>
                                            <p className="text-[10px] text-slate-400 mt-1 text-right font-bold">{progresStavka.stavka.procenat.toFixed(0)}% gotovo — Realizacija stavke {progresStavka.rnId} ({progresStavka.stavka.sifra}){(progresStavka.stavka.visakUJM ?? 0) > 0.0005 ? ` — višak +${progresStavka.stavka.visakUJM.toFixed(3)} ${progresStavka.stavka.jmTrazeni}` : ''}</p>
                                        </>
                                    )}
                                    <div className="space-y-2 mt-2">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400 font-bold">Ukupno u paketu:</span>
                                            <span className="text-emerald-400 font-black" style={stilZa('ukupno')}>{item.kolicina_final} <span className="text-[10px]">m³</span></span>
                                        </div>
                                        {pod.prikaziJMNaPlocici && (
                                            <div className="flex justify-between items-start text-xs">
                                                <span className="text-slate-400 font-bold shrink-0 mr-2">Komadi / po JM:</span>
                                                <span className="text-right space-y-1">{jmTekstLista.map((t, idx) => <span key={idx} className="block text-theme-text font-black leading-tight" style={stilZa('komadi')}>{t}</span>)}<span className="block text-[10px] text-slate-500 mt-1">Ukupno: {item.kolicina_final?.toFixed(3)} m³ (= {item.kolicina_ulaz?.toFixed(2)} kom)</span></span>
                                            </div>
                                        )}
                                        {pod.prikaziProgresNaPlocici && progresStavka && (
                                            <>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-400 font-bold">Napravljeno (stavka):</span>
                                                    <span className="text-theme-text font-black" style={stilZa('progres')}>{progresStavka.stavka.napravljenoUJM == null ? '—' : progresStavka.stavka.napravljenoUJM.toFixed(3)} {progresStavka.stavka.jmTrazeni}{progresStavka.stavka.jmDefault && progresStavka.stavka.jmDefault !== progresStavka.stavka.jmTrazeni ? (progresStavka.stavka.napravljenoUDefault == null ? ` = — ${progresStavka.stavka.jmDefault}` : ` = ${progresStavka.stavka.napravljenoUDefault.toFixed(3)} ${progresStavka.stavka.jmDefault}`) : ''}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-400 font-bold">Traženo (stavka):</span>
                                                    <span className="text-theme-text font-black" style={stilZa('progres')}>{progresStavka.stavka.trazenoUJM.toFixed(3)} {progresStavka.stavka.jmTrazeni}{progresStavka.stavka.jmDefault && progresStavka.stavka.jmDefault !== progresStavka.stavka.jmTrazeni ? (progresStavka.stavka.trazenoUDefault == null ? ` = — ${progresStavka.stavka.jmDefault}` : ` = ${progresStavka.stavka.trazenoUDefault.toFixed(3)} ${progresStavka.stavka.jmDefault}`) : ''}</span>
                                                </div>
                                            </>
                                        )}
                                        <div className="flex justify-between items-center pt-3 border-t border-theme-border/50 mt-2 text-xs">
                                            <span className="text-slate-300 font-black uppercase">RN / Kupac / Mašina:</span>
                                            <span className="text-theme-text font-black text-right" style={stilZa('info')}>{item.broj_veze === 'SLOBODNA_ROBA' ? 'SLOBODNA ROBA' : item.broj_veze || '—'}{pod.prikaziKupacNaPlocici && kupac ? ` | ${kupac}` : ''}<br />{pod.prikaziMasinaNaPlocici ? (item.masina || '—') : ''} | Redova: {item.redovi ? item.redovi.length : 1}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
            </div>

            {selektovaniPaket && (
                <div onClick={(e) => { if (e.target === e.currentTarget) setSelektovaniPaket(null); }} className="erp-modal-backdrop fixed inset-0 z-[150] bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-theme-card border-2 border-blue-500 p-8 rounded-[2rem] shadow-2xl max-w-2xl w-full relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <button onClick={() => setSelektovaniPaket(null)} className="absolute top-6 right-6 text-theme-muted hover:text-theme-text text-2xl font-black transition-all">✕</button>
                        <div className="mb-6">
                            <h3 className="text-blue-400 text-xs uppercase tracking-widest mb-1">Forenzika i Hronologija izmjena paketa</h3>
                            <p className="text-theme-text text-base uppercase font-black">{selektovaniPaket.paket_id} - {selektovaniPaket.naziv_proizvoda}</p>
                            <p className="text-amber-500 font-black text-sm tracking-widest mt-1 font-mono">DIMENZIJE U BAZI: {normalizujDimenzije(selektovaniPaket).debljina}x{normalizujDimenzije(selektovaniPaket).sirina}x{normalizujDimenzije(selektovaniPaket).duzina} cm</p>
                        </div>

                        {selektovaniPaket.broj_veze === 'SLOBODNA_ROBA' ? (
                            <div className="mb-4 bg-amber-900/10 border border-amber-500/30 p-4 rounded-xl">
                                <h4 className="text-amber-500 font-black uppercase text-[10px] mb-2">📦 Ručni Unos (Slobodna Roba)</h4>
                                <p className="text-xs text-theme-muted">Ovaj paket nije potekao iz radnog naloga. Unešen je ručno na stanje i predviđen je za slobodnu prodaju.</p>
                            </div>
                        ) : selektovaniPaket.ai_sirovina_ids && (
                            <div className="mb-4 bg-blue-900/10 border border-blue-500/30 p-4 rounded-xl">
                                <h4 className="text-blue-400 font-black uppercase text-[10px] mb-2">⬅️ Sljedivost unazad (Izvorna sirovina)</h4>
                                <p className="text-xs text-theme-muted">Ovaj paket je nastao preradom sirovine iz paketa: <span className="text-theme-text font-mono bg-theme-panel px-2 py-0.5 rounded">{String(selektovaniPaket.ai_sirovina_ids)}</span></p>
                            </div>
                        )}

                        {izvedeniPaketi.length > 0 && (
                            <div className="mb-4 bg-purple-900/10 border border-purple-500/30 p-4 rounded-xl">
                                <h4 className="text-purple-400 font-black uppercase text-[10px] mb-2">➡️ Sljedivost unaprijed (Dalja Prerada)</h4>
                                <div className="flex flex-wrap gap-2">
                                    {izvedeniPaketi.map(izv => (
                                        <span key={izv.paket_id} className="text-[10px] bg-theme-panel text-theme-text px-2 py-1 rounded border border-purple-500/30">Potrošen za: <b>{izv.paket_id}</b> ({izv.kolicina_final} m³)</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-4 mb-8">
                            <h4 className="text-theme-muted font-black uppercase text-[10px] border-b border-theme-border pb-2">Hronologija i detaljne razlike izmjena (Audit):</h4>
                            {historija === 'load' ? <p className="animate-pulse text-xs text-theme-accent">Generiram timeline...</p> : 
                            historija === 'none' ? <p className="text-xs text-theme-muted">Nema zapisa o izmjenama.</p> : (
                                <div className="space-y-4">
                                    {historija.map((h, i) => (
                                        <div key={i} className="bg-theme-panel p-3 rounded-xl border border-theme-border/60">
                                            <div className="flex justify-between text-[10px] text-theme-muted">
                                                <span>⏳ {new Date(h.vrijeme).toLocaleString('bs-BA')}</span>
                                                <span className="uppercase font-black text-amber-500">Korisnik: {h.korisnik}</span>
                                            </div>
                                            <p className="text-blue-400 uppercase font-black text-[10px] mt-1">Akcija: {h.naslov}</p>
                                            <p className="text-theme-text font-mono text-[11px] leading-relaxed border-l-2 border-blue-500 pl-2 mt-1 whitespace-pre-wrap">{h.opis}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button onClick={() => isprintajAutomatski(selektovaniPaket)} disabled={isPrinting} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl uppercase shadow-lg text-xs tracking-widest">🖨️ Isprintaj deklaraciju (Auto QR + cm)</button>
                    </div>
                </div>
            )}

            {isScanning && <ScannerOverlay onScan={(text) => { setPretraga(text.toUpperCase()); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
        </div>
    );
}
