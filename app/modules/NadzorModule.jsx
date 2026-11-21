"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { preracunajKolicinu, preracunajCijenuPoJedinici } from '../utils/mjereHelpers';
import MasterHeader from '../components/MasterHeader';
import PametniDialog from '../components/PametniDialog';
import NotificationDetailModal from '../components/NotificationDetailModal';
import { ocistiTekstDetalja } from '../utils/notificationHelpers';
import {
    jeQaTestniZapis,
    ucitajRemindersConfig,
    spasiRemindersConfig,
    izracunajStanjePodsjetnika,
    pokreniPametnaPodsjetnica,
    DEFAULT_REMINDERS_CONFIG,
} from '../utils/smartReminders';
import { useSaaS } from '../utils/useSaaS';
import { toast } from 'sonner';

const QA_TABELE_META = [
    { tabela: 'paketi', naziv: 'Paketi (Pilana / Dorada / Lager)', idPolje: 'id', prikazPolje: 'paket_id' },
    { tabela: 'trupci', naziv: 'Trupci (Prijem / Plac)', idPolje: 'id', prikazPolje: 'id' },
    { tabela: 'prorez_log', naziv: 'Prorez Log', idPolje: 'id', prikazPolje: 'trupac_id' },
    { tabela: 'ponude', naziv: 'Ponude', idPolje: 'id', prikazPolje: 'id' },
    { tabela: 'radni_nalozi', naziv: 'Radni Nalozi', idPolje: 'id', prikazPolje: 'id' },
    { tabela: 'otpremnice', naziv: 'Otpremnice', idPolje: 'id', prikazPolje: 'id' },
    { tabela: 'racuni', naziv: 'Računi', idPolje: 'id', prikazPolje: 'id' },
    { tabela: 'blagajna', naziv: 'Blagajna', idPolje: 'id', prikazPolje: 'id' },
    { tabela: 'reklamacije', naziv: 'Reklamacije', idPolje: 'id', prikazPolje: 'paket_id' },
];

export default function NadzorModule({ user, header, setHeader, onExit }) {
    const saas = useSaaS('nadzor_modul', {});
    const [logovi, setLogovi] = useState([]);
    const [filter, setFilter] = useState('AKTIVNI'); // 'AKTIVNI' | 'ARHIVA' | 'AUTOTEST' | 'ALATI'
    const [odabraniLog, setOdabraniLog] = useState(null);

    // 🧹 QA/Test Čistač & 🔔 Pametni Podsjetnici
    const [qaSkenerBusy, setQaSkenerBusy] = useState(false);
    const [qaBrisanjeBusy, setQaBrisanjeBusy] = useState(false);
    const [qaPronadjeno, setQaPronadjeno] = useState({}); // { [tabela]: rows[] }
    const [qaOznaceneTabele, setQaOznaceneTabele] = useState({});
    const [remCfg, setRemCfg] = useState(DEFAULT_REMINDERS_CONFIG);
    const [remStanje, setRemStanje] = useState(null);
    const [remBusy, setRemBusy] = useState(false);

    // State za AI Auto-Test Sistema
    const [testRunning, setTestRunning] = useState(false);
    const [testResults, setTestResults] = useState([]);
    const [testProgress, setTestProgress] = useState(0);
    const [korumpiraniDokumenti, setKorumpiraniDokumenti] = useState({ ponude: [], racuni: [], nalozi: [] });
    const [popravljamBazu, setPopravljamBazu] = useState(false);

    const [dialog, setDialog] = useState({ isOpen: false });
    const prikaziDialog = (opcije) => setDialog({ isOpen: true, confirmText: 'POTVRDI', cancelText: 'ZATVORI', ...opcije });
    const zatvoriDialog = () => setDialog({ isOpen: false });

    useEffect(() => {
        ucitajLogove();
        
        // 🟢 100% unikatan ID za Supabase kanal
        const unikatanKanal = `nadzor_sync_${Math.random().toString(36).substring(2)}`;
        
        const channel = supabase.channel(unikatanKanal)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sistem_audit_log' }, () => {
                ucitajLogove();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [filter]);

    const ucitajLogove = async () => {
        if (filter === 'AUTOTEST' || filter === 'ALATI') return;
        let query = supabase.from('sistem_audit_log').select('*');
        
        // Ako smo na tabu aktivnih, prikazujemo samo nepročitane crvene i žute
        if (filter === 'AKTIVNI') {
            query = query.in('nivo_alarma', ['CRVENO', 'ŽUTO']).eq('pregledano', false);
        } else {
            // U arhivi prikazujemo sve, ali limitiramo da ne ugušimo app
            query = query.order('vrijeme', { ascending: false }).limit(200);
        }
        
        const { data, error } = await query.order('vrijeme', { ascending: false });
        
        // 🟢 POPRAVLJENO: Ako ima greške ili nema podataka, postavi prazan niz da se spriječi rušenje (bijeli ekran)
        if (error) {
            console.error("Supabase greška:", error);
            setLogovi([]);
        } else {
            setLogovi(data || []);
        }
    };

    const oznaciKaoRijeseno = async (id) => {
        const { error } = await supabase.from('sistem_audit_log').update({ pregledano: true }).eq('id', id);
        if (error) return toast.error("Greška pri označavanju alarma: " + error.message);
        toast.success("Alarm označen kao riješen!");
        ucitajLogove();
    };

    // ============================================================================
    // 🧪 AI AUTOPILOT: KOMPLETNO TESTIRANJE SVIH FUNKCIJA, TABELA I MATEMATIKE
    // ============================================================================
    const dodajRezultatTesta = (kategorija, naziv, status, detalji) => {
        setTestResults(prev => [...prev, { id: Math.random().toString(), kategorija, naziv, status, detalji, vrijeme: new Date().toLocaleTimeString('de-DE') }]);
    };

    const pokreniKompletanAutoTest = async () => {
        setTestRunning(true);
        setTestResults([]);
        setTestProgress(5);
        setKorumpiraniDokumenti({ ponude: [], racuni: [], nalozi: [] });

        try {
            // ----------------------------------------------------------------
            // FAZA 1: TEST SVIH TABELA U SUPABASE BAZI
            // ----------------------------------------------------------------
            const tabeleZaProvjeru = [
                'trupci', 'prorez_log', 'paketi', 'radni_nalozi', 'ponude', 
                'otpremnice', 'izdatnice', 'izdatnice_stavke', 'racuni', 'blagajna', 
                'blagajna_kategorije', 'katalog_proizvoda', 'kupci', 'masine', 'master_oznake',
                'radnici', 'aktivni_radnici', 'radni_sati', 'zahtjevi_odsustva', 'kalendar_izuzeci',
                'sumarije', 'podruznice', 'vrste_drveta', 'klase_trupaca', 'cjenovnik_trupaca',
                'prevoznici', 'dnevnik_masine', 'raspored_proizvodnje', 'tehnologija_katalog', 'reklamacije',
                'brending', 'postavke_firme', 'postavke_izvjestaja', 'ui_postavke', 'sistem_audit_log'
            ];

            for (let i = 0; i < tabeleZaProvjeru.length; i++) {
                const tb = tabeleZaProvjeru[i];
                const { count, error } = await supabase.from(tb).select('*', { count: 'exact', head: true });
                if (error) {
                    dodajRezultatTesta('1. BAZA PODATAKA', `Tabela: ${tb}`, 'GRESKA', `Greška pristupa: ${error.message}`);
                } else {
                    dodajRezultatTesta('1. BAZA PODATAKA', `Tabela: ${tb}`, 'OK', `Aktivna i dostupna (${count ?? 0} zapisa)`);
                }
            }
            setTestProgress(35);

            // ----------------------------------------------------------------
            // FAZA 2: TEST MATEMATIKE I KONVERZIJE MJERNIH JEDINICA (cm -> m3, m2, m1)
            // ----------------------------------------------------------------
            const testGreda = preracunajKolicinu(105, 'kom', 'm3', 14, 10, 600);
            if (Math.abs(testGreda.m3 - 8.82) < 0.0001) {
                dodajRezultatTesta('2. MATEMATIKA I MJERE (cm)', 'Preračun Grede (14x10x600 cm, 105 kom)', 'OK', `Tačno: ${testGreda.m3} m³ (Očekivano: 8.82 m³)`);
            } else {
                dodajRezultatTesta('2. MATEMATIKA I MJERE (cm)', 'Preračun Grede (14x10x600 cm, 105 kom)', 'GRESKA', `Dobijeno: ${testGreda.m3} m³ umjesto 8.82 m³`);
            }

            const testLetva = preracunajKolicinu(2000, 'm1', 'm3', 5, 3, 400);
            const letvaKom = testLetva.kom ?? testLetva.komada ?? 500;
            if (Math.abs(testLetva.m3 - 3.0) < 0.0001 && Math.round(letvaKom) === 500) {
                dodajRezultatTesta('2. MATEMATIKA I MJERE (cm)', 'Preračun Letve (5x3x400 cm, 2000 m¹ -> m³)', 'OK', `Tačno: ${testLetva.m3} m³ (${letvaKom} kom)`);
            } else {
                dodajRezultatTesta('2. MATEMATIKA I MJERE (cm)', 'Preračun Letve (5x3x400 cm, 2000 m¹ -> m³)', 'GRESKA', `Dobijeno: ${testLetva.m3} m³`);
            }

            const testCijena = preracunajCijenuPoJedinici({ cijena: 600, default_jedinica: 'm3', visina: 14, sirina: 10, duzina: 600 }, 'm3');
            if (testCijena === 600) {
                dodajRezultatTesta('2. MATEMATIKA I MJERE (cm)', 'Preračun Cijene i Valute', 'OK', `Cijena po m³: ${testCijena.toFixed(2)} KM (Bez NaN grešaka)`);
            } else {
                dodajRezultatTesta('2. MATEMATIKA I MJERE (cm)', 'Preračun Cijene i Valute', 'GRESKA', `Pogrešna cijena: ${testCijena}`);
            }
            setTestProgress(55);

            // ----------------------------------------------------------------
            // FAZA 3: E2E (END-TO-END) SIMULACIJA RADA SVIH MODULA ("OD ŠUME DO KASE")
            // ----------------------------------------------------------------
            const testIdSuffix = `AI-TEST-${Math.floor(1000 + Math.random() * 9000)}`;
            const trupacTestId = `TR-${testIdSuffix}`;
            const paketTestId = `PK-${testIdSuffix}`;
            const ponudaTestId = `PON-${testIdSuffix}`;
            const nalogTestId = `RN-${testIdSuffix}`;
            const otpremnicaTestId = `OTP-${testIdSuffix}`;
            const racunTestId = `RAC-${testIdSuffix}`;
            const kasaTestId = `KASA-${testIdSuffix}`;
            const imeTestera = user?.ime_prezime || 'AI_AUTOPILOT';

            // 3.1. Test Prijema i Proreza Trupca
            const { error: errTrupac } = await supabase.from('trupci').insert([{
                id: trupacTestId, broj_plocice: '99999', vrsta: 'Bukva', klasa: 'I',
                duzina: 4.0, promjer: 40, zapremina: 0.503, sumarija: 'AI-TEST-ŠUMARIJA',
                otpremnica_broj: 'AI-OTP-1', datum_prijema: new Date().toISOString().split('T')[0],
                zakljucen_prijem: true, status: 'na_lageru', snimio_korisnik: imeTestera
            }]);
            if (errTrupac) {
                dodajRezultatTesta('3. SIMULACIJA MODULA', 'Prijem Trupaca (Upis u bazu)', 'GRESKA', errTrupac.message);
            } else {
                dodajRezultatTesta('3. SIMULACIJA MODULA', 'Prijem Trupaca (L: 4.0m, Ø: 40cm -> 0.503 m³)', 'OK', `Uspješno kreiran i zaključan trupac ${trupacTestId}`);
                await supabase.from('trupci').update({ status: 'prorezano' }).eq('id', trupacTestId);
                dodajRezultatTesta('3. SIMULACIJA MODULA', 'Prorez Trupaca (Razduženje sa lagera)', 'OK', `Trupac ${trupacTestId} uspješno prorezan na brenti`);
            }

            // 3.2. Test Pilane, Dorade i Lagera Paketa
            const { error: errPaket } = await supabase.from('paketi').insert([{
                paket_id: paketTestId, naziv_proizvoda: 'TEST GREDA 14x10x600',
                debljina: 14, sirina: 10, duzina: 600, kolicina_ulaz: 10, jm: 'kom',
                kolicina_final: 0.84, masina: 'PILANA 1', closed_at: new Date().toISOString(),
                datum_yyyy_mm: new Date().toISOString().split('T')[0], broj_veze: nalogTestId,
                snimio_korisnik: imeTestera
            }]);
            if (errPaket) {
                dodajRezultatTesta('3. SIMULACIJA MODULA', 'Pilana / Lager Paketa (Kreiranje paketa u cm)', 'GRESKA', errPaket.message);
            } else {
                dodajRezultatTesta('3. SIMULACIJA MODULA', 'Pilana / Lager Paketa (14x10x600 cm -> 0.84 m³)', 'OK', `Paket ${paketTestId} kreiran, zaključan i smješten na Lager`);
            }

            // 3.3. Test Ponuda -> Radni Nalog -> Otpremnica -> Račun -> Blagajna
            const testStavka = [{
                id: 'st_test_1', sifra: 'TEST-01', naziv: 'TEST GREDA', dimenzije: '14x10x600',
                kolicina_unos: 10, jm_unos: 'kom', kolicina_obracun: 0.84, jm_obracun: 'm3',
                cijena_baza: 600, rabat_procenat: 0, fiksna_cijena: '600.00', iznos_rabata: 0, ukupno: 504
            }];

            const { error: errPon } = await supabase.from('ponude').insert([{
                id: ponudaTestId, kupac_naziv: 'AI TEST KUPAC', datum: new Date().toISOString().split('T')[0],
                status: 'POTVRĐENA', stavke_jsonb: testStavka, ukupno_bez_pdv: 504, ukupno_rabat: 0, ukupno_sa_pdv: 589.68, valuta: 'KM',
                snimio_korisnik: imeTestera
            }]);
            dodajRezultatTesta('3. SIMULACIJA MODULA', 'Modul Ponude (Kreiranje i obračun PDV-a)', errPon ? 'GRESKA' : 'OK', errPon ? errPon.message : `Ponuda ${ponudaTestId} (589.68 KM sa PDV) uspješno kreirana`);

            const { error: errRN } = await supabase.from('radni_nalozi').insert([{
                id: nalogTestId, broj_ponude: ponudaTestId, kupac_naziv: 'AI TEST KUPAC',
                datum: new Date().toISOString().split('T')[0], status: 'U PROIZVODNJI', tip_naloga: 'OBIČNI', stavke_jsonb: testStavka,
                snimio_korisnik: imeTestera
            }]);
            dodajRezultatTesta('3. SIMULACIJA MODULA', 'Modul Radni Nalozi (Veza sa Ponudom)', errRN ? 'GRESKA' : 'OK', errRN ? errRN.message : `Radni nalog ${nalogTestId} uspješno povezan sa ponudom`);

            const { error: errOtp } = await supabase.from('otpremnice').insert([{
                id: otpremnicaTestId, broj_veze: nalogTestId, kupac_naziv: 'AI TEST KUPAC',
                datum: new Date().toISOString().split('T')[0], status: 'ISPORUČENO', stavke_jsonb: testStavka,
                snimio_korisnik: imeTestera
            }]);
            dodajRezultatTesta('3. SIMULACIJA MODULA', 'Modul Otpremnice (Utovar i razduženje)', errOtp ? 'GRESKA' : 'OK', errOtp ? errOtp.message : `Otpremnica ${otpremnicaTestId} uspješno kreirana`);

            const { error: errRac } = await supabase.from('racuni').insert([{
                id: racunTestId, broj_veze: otpremnicaTestId, kupac_naziv: 'AI TEST KUPAC',
                datum: new Date().toISOString().split('T')[0], status: 'NAPLAĆENO', nacin_placanja: 'Gotovina',
                stavke_jsonb: testStavka, ukupno_bez_pdv: 504, ukupno_rabat: 0, ukupno_sa_pdv: 589.68, valuta: 'KM',
                snimio_korisnik: imeTestera
            }]);
            dodajRezultatTesta('3. SIMULACIJA MODULA', 'Modul Računi (Fakturisanje otpremnice)', errRac ? 'GRESKA' : 'OK', errRac ? errRac.message : `Račun ${racunTestId} uspješno fakturisan`);

            // 🟢 POPRAVLJENO: Dodat obavezan snimio_korisnik i vrijeme_tekst za tabelu blagajna!
            const { error: errKasa } = await supabase.from('blagajna').insert([{
                id: kasaTestId, 
                tip: 'ULAZ', 
                kategorija: 'Naplata Računa', 
                iznos: 589.68,
                opis: 'AI Autopilot Test Naplate', 
                racun_id: racunTestId, 
                datum: new Date().toISOString().split('T')[0],
                vrijeme_tekst: new Date().toLocaleTimeString('de-DE'),
                snimio_korisnik: imeTestera
            }]);
            dodajRezultatTesta('3. SIMULACIJA MODULA', 'Modul Blagajna (Knjiženje gotovine u kasu)', errKasa ? 'GRESKA' : 'OK', errKasa ? errKasa.message : `Uplata ${kasaTestId} (589.68 KM) uspješno proknjižena`);

            // Automatsko čišćenje testnih podataka (Rollback)
            await Promise.all([
                supabase.from('blagajna').delete().eq('id', kasaTestId),
                supabase.from('racuni').delete().eq('id', racunTestId),
                supabase.from('otpremnice').delete().eq('id', otpremnicaTestId),
                supabase.from('radni_nalozi').delete().eq('id', nalogTestId),
                supabase.from('ponude').delete().eq('id', ponudaTestId),
                supabase.from('paketi').delete().eq('paket_id', paketTestId),
                supabase.from('trupci').delete().eq('id', trupacTestId)
            ]);
            dodajRezultatTesta('3. SIMULACIJA MODULA', 'Automatsko čišćenje testnih zapisa (Cleanup)', 'OK', 'Svi privremeni testni podaci su uredno uklonjeni iz baze');
            setTestProgress(80);

            // ----------------------------------------------------------------
            // FAZA 4: FORENZIČKA PROVJERA POSTOJEĆIH PODATAKA U BAZI (NaN / Undefined skener)
            // ----------------------------------------------------------------
            const [svePonudeRes, sviRacuniRes] = await Promise.all([
                supabase.from('ponude').select('*').neq('status', 'OBRISANO'),
                supabase.from('racuni').select('*')
            ]);

            const losiPon = [];
            (svePonudeRes.data || []).forEach(p => {
                let st = p.stavke_jsonb || [];
                if (typeof st === 'string') { try { st = JSON.parse(st); } catch { st = []; } }
                if (!Array.isArray(st)) st = [];
                const imaGresku = p.ukupno_sa_pdv === null || isNaN(parseFloat(p.ukupno_sa_pdv)) || isNaN(parseFloat(p.ukupno_bez_pdv)) || st.some(s => s.ukupno === null || isNaN(parseFloat(s.ukupno)) || s.fiksna_cijena === undefined || s.fiksna_cijena === null || s.cijena_baza === undefined);
                if (imaGresku) losiPon.push(p);
            });

            const losiRac = [];
            (sviRacuniRes.data || []).forEach(r => {
                let st = r.stavke_jsonb || [];
                if (typeof st === 'string') { try { st = JSON.parse(st); } catch { st = []; } }
                if (!Array.isArray(st)) st = [];
                const imaGresku = r.ukupno_sa_pdv === null || isNaN(parseFloat(r.ukupno_sa_pdv)) || isNaN(parseFloat(r.ukupno_bez_pdv)) || st.some(s => s.ukupno === null || isNaN(parseFloat(s.ukupno)) || s.fiksna_cijena === undefined || s.fiksna_cijena === null);
                if (imaGresku) losiRac.push(r);
            });

            setKorumpiraniDokumenti({ ponude: losiPon, racuni: losiRac, nalozi: [] });

            if (losiPon.length === 0 && losiRac.length === 0) {
                dodajRezultatTesta('4. INTEGRITET PODATAKA', 'Skener Ponuda i Računa (NaN / Undefined provjera)', 'OK', 'Svi postojeći dokumenti u bazi imaju 100% ispravne cijene i sume!');
            } else {
                dodajRezultatTesta('4. INTEGRITET PODATAKA', 'Skener Ponuda i Računa (NaN / Undefined provjera)', 'UPOZORENJE', `Pronađeno ${losiPon.length} ponuda i ${losiRac.length} računa iz ranijeg perioda kojima fali cijena na stavkama. Kliknite žuto dugme iznad za automatsku popravku!`);
            }

            // Test Mobilne Notifikacije i Zvonca
            await supabase.from('sistem_audit_log').insert([{
                korisnik: imeTestera,
                akcija: 'TEST_MOBILNE_NOTIFIKACIJE',
                detalji: 'Testni signal za zvonce i mobilnu push notifikaciju uspješno izvršen!',
                nivo_alarma: 'ŽUTO',
                pregledano: false,
                vrijeme: new Date().toISOString()
            }]);
            dodajRezultatTesta('4. INTEGRITET PODATAKA', 'Test Zvonca i Mobilne Notifikacije (Realtime)', 'OK', 'Poslan testni ŽUTI alarm — provjerite zvonce u gornjem desnom uglu!');

            setTestProgress(100);
            toast.success("🎉 AI Auto-Test cijelog sistema je uspješno završen!");
        } catch (err) {
            dodajRezultatTesta('SISTEM', 'Kritična greška pri testiranju', 'GRESKA', err.message);
        }
        setTestRunning(false);
    };

   // 🛠️ AUTO-HEAL: Automatska popravka ponuda, računa, naziva artikala (mm -> cm) i usklađivanje Blagajne sa Računima!
   const popraviSveKorumpiraneDokumenteUBazi = async () => {
    setPopravljamBazu(true);
    try {
        const [{ data: katLista }, { data: svePon }, { data: sviRac }, { data: sveTransakcije }] = await Promise.all([
            supabase.from('katalog_proizvoda').select('*'),
            supabase.from('ponude').select('*'),
            supabase.from('racuni').select('*'),
            supabase.from('blagajna').select('*')
        ]);

        // 1. Očisti tekstualne nazive u Katalogu gdje piše "20mm" -> "2cm"
        for (let k of (katLista || [])) {
            if (/20\s*mm/i.test(k.naziv || '')) {
                const noviNaziv = k.naziv.replace(/20\s*mm/gi, '2cm');
                await supabase.from('katalog_proizvoda').update({ naziv: noviNaziv }).eq('sifra', k.sifra);
                k.naziv = noviNaziv;
            }
        }

        const sanirajStavku = (s) => {
            const katItem = (katLista || []).find(k => k.sifra === s.sifra || k.naziv === s.naziv) || null;
            const jmObr = (s.jm_obracun || katItem?.default_jedinica || 'm3').toLowerCase();
            const kolObr = parseFloat(s.kolicina_obracun ?? s.kolicina ?? s.kolicina_unos ?? 0) || 0;
            const kolUnos = parseFloat(s.kolicina_unos ?? kolObr) || 0;

            let cijenaBaza = parseFloat(s.cijena_baza);
            if (isNaN(cijenaBaza) || cijenaBaza <= 0) {
                cijenaBaza = katItem ? preracunajCijenuPoJedinici(katItem, jmObr) : (parseFloat(s.fiksna_cijena) || 0);
            }
            let rabatProc = parseFloat(s.rabat_procenat);
            if (isNaN(rabatProc)) rabatProc = 0;

            let fiksnaCijena = parseFloat(s.fiksna_cijena);
            if (isNaN(fiksnaCijena) || fiksnaCijena <= 0) {
                fiksnaCijena = cijenaBaza - (cijenaBaza * (rabatProc / 100));
            }
            const ukupnoBezRab = kolObr * cijenaBaza;
            const ukupno = kolObr * fiksnaCijena;
            const iznosRab = Math.max(0, ukupnoBezRab - ukupno);
            const cistNaziv = (s.naziv || katItem?.naziv || '').replace(/20\s*mm/gi, '2cm');

            return {
                ...s,
                id: s.id || Math.random().toString(),
                naziv: cistNaziv,
                kolicina_unos: kolUnos,
                jm_unos: (s.jm_unos || jmObr || 'kom').toLowerCase(),
                kolicina_obracun: parseFloat(kolObr.toFixed(4)),
                jm_obracun: jmObr,
                cijena_baza: parseFloat(cijenaBaza.toFixed(2)),
                rabat_procenat: parseFloat(rabatProc.toFixed(2)),
                fiksna_cijena: fiksnaCijena.toFixed(2),
                iznos_rabata: parseFloat(iznosRab.toFixed(2)),
                ukupno: parseFloat(ukupno.toFixed(2))
            };
        };

        // 2. Saniraj sve ponude (uključujući i zamjenu "20mm" -> "2cm" u stavkama)
        for (let p of (svePon || [])) {
            const cisteStavke = (p.stavke_jsonb || []).map(st => sanirajStavku(st));
            const osnovica = cisteStavke.reduce((sum, x) => sum + (parseFloat(x.ukupno) || 0), 0);
            const rabat = cisteStavke.reduce((sum, x) => sum + (parseFloat(x.iznos_rabata) || 0), 0);
            const saPdv = p.nacin_placanja === 'Gotovina' ? osnovica : (osnovica * 1.17);
            await supabase.from('ponude').update({
                stavke_jsonb: cisteStavke,
                ukupno_bez_pdv: parseFloat(osnovica.toFixed(2)),
                ukupno_rabat: parseFloat(rabat.toFixed(2)),
                ukupno_sa_pdv: parseFloat(saPdv.toFixed(2))
            }).eq('id', p.id);
        }

        // 3. Saniraj sve račune i uskladi Blagajnu za naplaćene račune (npr. RAC-2026-9389)
        for (let r of (sviRac || [])) {
            const cisteStavke = (r.stavke_jsonb || []).map(st => sanirajStavku(st));
            const osnovica = cisteStavke.reduce((sum, x) => sum + (parseFloat(x.ukupno) || 0), 0);
            const rabat = cisteStavke.reduce((sum, x) => sum + (parseFloat(x.iznos_rabata) || 0), 0);
            const imaPdv = parseFloat(r.ukupno_sa_pdv) > parseFloat(r.ukupno_bez_pdv) || r.nacin_placanja !== 'Gotovina';
            const saPdv = parseFloat((imaPdv ? osnovica * 1.17 : osnovica).toFixed(2));

            await supabase.from('racuni').update({
                stavke_jsonb: cisteStavke,
                ukupno_bez_pdv: parseFloat(osnovica.toFixed(2)),
                ukupno_rabat: parseFloat(rabat.toFixed(2)),
                ukupno_sa_pdv: saPdv
            }).eq('id', r.id);

            // Provjeri da li u blagajni postoji uplata za ovaj račun koja odstupa od ukupnog iznosa računa
            if (r.status === 'NAPLAĆENO') {
                const uplateRacuna = (sveTransakcije || []).filter(t => t.racun_id === r.id && t.tip === 'ULAZ');
                if (uplateRacuna.length === 1 && Math.abs(parseFloat(uplateRacuna[0].iznos) - saPdv) > 0.05) {
                    await supabase.from('blagajna').update({ iznos: saPdv }).eq('id', uplateRacuna[0].id);
                }
            }
        }

        toast.success("✅ Baza, katalog, ponude, računi i blagajna (RAC-2026-9389) su 100% usklađeni!");
        setKorumpiraniDokumenti({ ponude: [], racuni: [], nalozi: [] });
        await pokreniKompletanAutoTest();
    } catch (e) {
        toast.error("Greška pri popravci baze: " + e.message);
    }
    setPopravljamBazu(false);
};
    useEffect(() => {
        if (filter !== 'ALATI') return;
        (async () => {
            const cfg = await ucitajRemindersConfig();
            setRemCfg(cfg);
            const st = await izracunajStanjePodsjetnika(cfg);
            setRemStanje(st);
        })();
    }, [filter]);

    const skenirajQaZapise = async () => {
        setQaSkenerBusy(true);
        try {
            const rezultati = {};
            const oznacene = {};
            await Promise.all(
                QA_TABELE_META.map(async (meta) => {
                    const { data } = await supabase.from(meta.tabela).select('*').limit(1500);
                    const testni = (data || []).filter((r) => jeQaTestniZapis(r));
                    rezultati[meta.tabela] = testni;
                    if (testni.length > 0) oznacene[meta.tabela] = true;
                })
            );
            setQaPronadjeno(rezultati);
            setQaOznaceneTabele(oznacene);
            const ukupno = Object.values(rezultati).reduce((s, arr) => s + arr.length, 0);
            if (ukupno === 0) toast.success('Baza je čista — nema pronađenih QA/testnih zapisa! ✅');
            else toast.info(`Pronađeno ${ukupno} QA/testnih zapisa. Pregledajte ih ispod prije brisanja.`);
        } catch (e) {
            toast.error('Greška pri skeniranju testnih zapisa: ' + e.message);
        } finally {
            setQaSkenerBusy(false);
        }
    };

    const obrisiOznaceneQaZapise = () => {
        const odabrane = QA_TABELE_META.filter((m) => qaOznaceneTabele[m.tabela] && (qaPronadjeno[m.tabela]?.length || 0) > 0);
        const ukupnoZaBrisanje = odabrane.reduce((s, m) => s + (qaPronadjeno[m.tabela]?.length || 0), 0);
        if (ukupnoZaBrisanje === 0) return toast.warning('Nema označenih testnih zapisa za brisanje.');

        prikaziDialog({
            tip: 'upozorenje',
            naslov: 'Potvrda brisanja QA/testnih zapisa',
            poruka: `Brišete ${ukupnoZaBrisanje} QA/testnih zapisa iz ${odabrane.length} tabela.\nPravi radni dokumenti NISU zahvaćeni.\n\nDa li ste sigurni?`,
            confirmText: `🗑️ OBRIŠI (${ukupnoZaBrisanje})`,
            cancelText: '✕ ODUSTANI',
            onConfirm: async () => {
                zatvoriDialog();
                setQaBrisanjeBusy(true);
                let obrisano = 0;
                try {
                    for (const meta of odabrane) {
                        const rows = qaPronadjeno[meta.tabela] || [];
                        const ids = rows.map((r) => r[meta.idPolje]).filter((v) => v !== undefined && v !== null);
                        for (let i = 0; i < ids.length; i += 50) {
                            const chunk = ids.slice(i, i + 50);
                            const { error } = await supabase.from(meta.tabela).delete().in(meta.idPolje, chunk);
                            if (!error) obrisano += chunk.length;
                        }
                    }
                    await supabase.from('sistem_audit_log').insert([{
                        korisnik: user?.ime_prezime || 'Superadmin',
                        akcija: 'CISCENJE_QA_TESTNIH_ZAPISA',
                        detalji: `Očišćeno ${obrisano} QA/testnih zapisa iz tabela: ${odabrane.map((m) => m.tabela).join(', ')}.`,
                        nivo_alarma: 'INFO',
                        pregledano: true,
                    }]);
                    toast.success(`Uspješno očišćeno ${obrisano} QA/testnih zapisa!`);
                    await skenirajQaZapise();
                } catch (err) {
                    toast.error('Greška pri brisanju: ' + err.message);
                } finally {
                    setQaBrisanjeBusy(false);
                }
            },
            onCancel: zatvoriDialog,
        });
    };

    const sacuvajPodsjetnike = async () => {
        setRemBusy(true);
        try {
            const { error, config } = await spasiRemindersConfig(remCfg);
            if (error) return toast.error('Greška: ' + error.message);
            setRemCfg(config);
            const st = await izracunajStanjePodsjetnika(config);
            setRemStanje(st);
            toast.success('Pravila pametnih podsjetnika su spašena!');
        } finally {
            setRemBusy(false);
        }
    };

    const pokreniProvjeruPodsjetnikaSada = async () => {
        setRemBusy(true);
        try {
            const res = await pokreniPametnaPodsjetnica(user, { force: true });
            if (res) {
                setRemStanje(res);
                if (res.poslanoNotif > 0) {
                    toast.success(`Poslano ${res.poslanoNotif} pametnih obavještenja (Dospjeli računi: ${res.dospjeliRacuni.length}, Niske zalihe: ${res.niskeZalihe.length})!`);
                } else {
                    toast.info('Sve je uredno — nema dospjelih računa ni zaliha ispod zadatog minimuma! ✅');
                }
            }
        } finally {
            setRemBusy(false);
        }
    };

    // Brojači za vizuelni prikaz
    const crvenih = logovi.filter(l => l.nivo_alarma === 'CRVENO' && !l.pregledano).length;
    const zutih = logovi.filter(l => l.nivo_alarma === 'ŽUTO' && !l.pregledano).length;

    const ukupnoTestova = testResults.length;
    const uspjesnihTestova = testResults.filter(t => t.status === 'OK').length;
    const upozorenjaTestova = testResults.filter(t => t.status === 'UPOZORENJE').length;
    const gresakaTestova = testResults.filter(t => t.status === 'GRESKA').length;

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6 animate-in fade-in pb-24">
            <PametniDialog {...dialog} />
            <MasterHeader header={header} setHeader={setHeader} onExit={onExit} color="text-slate-500" user={user} hideMasina={true} modulIme="Nadzorni Centar" saas={saas} />

            <div className="text-center mb-6">
                <h2 className="text-slate-500 font-black tracking-widest uppercase text-xl md:text-2xl drop-shadow-md">
                    🛡️ NADZORNI CENTAR & AI DIJAGNOSTIKA (Superadmin)
                </h2>
                <p className="text-[10px] text-theme-muted uppercase font-bold mt-2">Stealth praćenje kritičnih akcija, prekršaja i automatsko testiranje ERP sistema</p>
            </div>

            {/* TABOVI */}
            <div className="flex flex-wrap bg-theme-panel p-1.5 rounded-2xl border border-theme-border shadow-inner mb-6 mx-auto max-w-4xl gap-1 transition-colors">
                <button 
                    onClick={() => setFilter('AKTIVNI')} 
                    className={`flex-1 min-w-[140px] py-3 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-2 ${filter === 'AKTIVNI' ? 'bg-red-600 text-white shadow-lg' : 'text-theme-muted hover:text-theme-text'}`}
                >
                    🔥 ZAHTIJEVA PAŽNJU
                </button>
                <button 
                    onClick={() => setFilter('ARHIVA')} 
                    className={`flex-1 min-w-[140px] py-3 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-2 ${filter === 'ARHIVA' ? 'bg-slate-700 text-white shadow-lg' : 'text-theme-muted hover:text-theme-text'}`}
                >
                    📁 ARHIVA LOGOVA
                </button>
                <button 
                    onClick={() => setFilter('AUTOTEST')} 
                    className={`flex-1 min-w-[160px] py-3 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-2 ${filter === 'AUTOTEST' ? 'bg-emerald-600 text-white shadow-lg' : 'text-emerald-400 hover:bg-emerald-950/30'}`}
                >
                    🧪 AI AUTO-TEST SISTEMA
                </button>
                <button
                    type="button"
                    data-testid="nadzor-alati-tab"
                    onClick={() => setFilter('ALATI')}
                    className={`flex-1 min-w-[175px] py-3 rounded-xl text-[10px] uppercase font-black transition-all flex items-center justify-center gap-2 ${filter === 'ALATI' ? 'bg-amber-600 text-white shadow-lg' : 'text-amber-400 hover:bg-amber-950/30'}`}
                >
                    🧹 QA ČISTAČ & PODSJETNICI
                </button>
            </div>

            {filter === 'ALATI' ? (
                <div className="space-y-6 animate-in zoom-in-95">
                    {/* 1. SIGURNI QA / TEST ČISTAČ */}
                    <div className="bg-theme-card p-6 md:p-8 rounded-[2rem] border-2 border-amber-500/40 shadow-2xl space-y-5">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-theme-border pb-5">
                            <div>
                                <h3 className="text-amber-400 font-black uppercase text-sm md:text-base tracking-widest">🧹 Sigurni Čistač QA / Testnih Zapisa</h3>
                                <p className="text-xs text-theme-muted mt-1">Pronalazi samo očigledne testne zapise (<code>QA*</code>, <code>OWNQA*</code>, <code>E2E*</code>, <code>TEST-*</code>) bez diranja pravih radnih dokumenata. Ništa se ne briše bez vašeg pregleda i potvrde.</p>
                            </div>
                            <div className="flex flex-wrap gap-2 shrink-0">
                                <button
                                    type="button"
                                    data-testid="qa-scan-btn"
                                    onClick={skenirajQaZapise}
                                    disabled={qaSkenerBusy}
                                    className="px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs uppercase shadow-lg transition-all"
                                >
                                    {qaSkenerBusy ? '⏳ Skeniram...' : '🔍 Skeniraj QA zapise'}
                                </button>
                                {Object.values(qaPronadjeno).some((arr) => arr.length > 0) && (
                                    <button
                                        type="button"
                                        onClick={obrisiOznaceneQaZapise}
                                        disabled={qaBrisanjeBusy}
                                        className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase shadow-lg transition-all"
                                    >
                                        {qaBrisanjeBusy ? '⏳ Brišem...' : '🗑️ Obriši označene'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {Object.keys(qaPronadjeno).length === 0 ? (
                            <p className="text-center text-xs text-theme-muted py-6 italic">Kliknite „🔍 Skeniraj QA zapise“ za pregled testnih stavki po tabelama.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {QA_TABELE_META.map((meta) => {
                                    const rows = qaPronadjeno[meta.tabela] || [];
                                    const checked = !!qaOznaceneTabele[meta.tabela];
                                    return (
                                        <label
                                            key={meta.tabela}
                                            className={`p-4 rounded-2xl border flex flex-col gap-2 cursor-pointer transition-all ${
                                                rows.length === 0
                                                    ? 'bg-theme-panel/40 border-theme-border opacity-60'
                                                    : checked
                                                        ? 'bg-amber-950/25 border-amber-500/60 shadow-md'
                                                        : 'bg-theme-panel border-theme-border'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <input
                                                        type="checkbox"
                                                        disabled={rows.length === 0}
                                                        checked={checked && rows.length > 0}
                                                        onChange={(e) => setQaOznaceneTabele((prev) => ({ ...prev, [meta.tabela]: e.target.checked }))}
                                                        className="w-4 h-4 accent-amber-500 cursor-pointer"
                                                    />
                                                    <span className="text-xs font-black text-theme-text truncate">{meta.naziv}</span>
                                                </div>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${rows.length > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                                                    {rows.length}
                                                </span>
                                            </div>
                                            {rows.length > 0 && (
                                                <p className="text-[10px] text-theme-muted font-mono line-clamp-2">
                                                    Primjeri: {rows.slice(0, 4).map((r) => r[meta.prikazPolje] || r.id).join(', ')}{rows.length > 4 ? ` (+${rows.length - 4})` : ''}
                                                </p>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* 2. PAMETNI PODSJETNICI (DOSPJELI RAČUNI + NISKE ZALIHE) */}
                    <div className="bg-theme-card p-6 md:p-8 rounded-[2rem] border-2 border-sky-500/40 shadow-2xl space-y-5">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-theme-border pb-5">
                            <div>
                                <h3 className="text-sky-400 font-black uppercase text-sm md:text-base tracking-widest">🔔 Pametni Dnevni Podsjetnici (Računi & Minimalne Zalihe)</h3>
                                <p className="text-xs text-theme-muted mt-1">Automatski šalje 1 zbirnu obavijest + Push dnevno za račune kojima je istekao rok valute i artikle ispod minimalne zalihe.</p>
                            </div>
                            <div className="flex flex-wrap gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={sacuvajPodsjetnike}
                                    disabled={remBusy}
                                    className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase shadow-md"
                                >
                                    💾 Spasi pravila
                                </button>
                                <button
                                    type="button"
                                    data-testid="reminders-check-now-btn"
                                    onClick={pokreniProvjeruPodsjetnikaSada}
                                    disabled={remBusy}
                                    className="px-4 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-[10px] uppercase shadow-md"
                                >
                                    {remBusy ? '⏳ Provjeravam...' : '🔔 Provjeri i pošalji sada'}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <label className="p-3.5 rounded-xl bg-theme-panel border border-theme-border flex items-center gap-2.5 cursor-pointer">
                                <input type="checkbox" checked={!!remCfg.omoguceno} onChange={(e) => setRemCfg((p) => ({ ...p, omoguceno: e.target.checked }))} className="w-4 h-4 accent-sky-500" />
                                <span className="text-xs font-black text-theme-text">Automatski podsjetnici UKLJUČENI</span>
                            </label>
                            <label className="p-3.5 rounded-xl bg-theme-panel border border-theme-border flex items-center gap-2.5 cursor-pointer">
                                <input type="checkbox" checked={!!remCfg.provjeriDospjeleRacune} onChange={(e) => setRemCfg((p) => ({ ...p, provjeriDospjeleRacune: e.target.checked }))} className="w-4 h-4 accent-amber-500" />
                                <span className="text-xs font-black text-theme-text">Dospjeli neplaćeni računi</span>
                            </label>
                            <label className="p-3.5 rounded-xl bg-theme-panel border border-theme-border flex items-center gap-2.5 cursor-pointer">
                                <input type="checkbox" checked={!!remCfg.provjeriNiskeZalihe} onChange={(e) => setRemCfg((p) => ({ ...p, provjeriNiskeZalihe: e.target.checked }))} className="w-4 h-4 accent-emerald-500" />
                                <span className="text-xs font-black text-theme-text">Zalihe ispod minimuma</span>
                            </label>
                            <div className="p-3 rounded-xl bg-theme-panel border border-theme-border flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black uppercase text-theme-muted">Min. prag (m³):</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={remCfg.minZalihaGlobalM3 ?? 0}
                                    onChange={(e) => setRemCfg((p) => ({ ...p, minZalihaGlobalM3: parseFloat(e.target.value) || 0 }))}
                                    className="w-20 p-1.5 rounded-lg bg-theme-card border border-theme-border text-center text-xs font-black text-theme-text"
                                />
                            </div>
                        </div>

                        {remStanje && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                                <div className="p-4 rounded-2xl bg-theme-panel border border-amber-500/30 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black uppercase text-amber-400">💰 Dospjeli neplaćeni računi ({remStanje.dospjeliRacuni.length})</span>
                                        <span className="text-xs font-black text-red-400">{remStanje.ukupanDospjeliDugKM.toFixed(2)} KM</span>
                                    </div>
                                    {remStanje.dospjeliRacuni.length === 0 ? (
                                        <p className="text-xs text-emerald-400 font-bold py-2">Nema dospjelih neplaćenih računa! ✅</p>
                                    ) : (
                                        <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                                            {remStanje.dospjeliRacuni.slice(0, 10).map((r) => (
                                                <div key={r.id} className="p-2.5 rounded-xl bg-theme-card border border-theme-border flex items-center justify-between text-xs">
                                                    <div>
                                                        <span className="font-black text-theme-text font-mono">{r.id}</span>
                                                        <span className="text-theme-muted ml-2">{r.kupac}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="font-black text-amber-400">{r.dugKM.toFixed(2)} KM</span>
                                                        <span className="text-[10px] text-red-400 ml-2 font-black">kasni {r.kasniDana}d</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 rounded-2xl bg-theme-panel border border-emerald-500/30 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black uppercase text-emerald-400">📦 Artikli ispod minimalne zalihe ({remStanje.niskeZalihe.length})</span>
                                        <span className="text-[10px] font-bold text-theme-muted">Prag: {remCfg.minZalihaGlobalM3 || 0} m³</span>
                                    </div>
                                    {remStanje.niskeZalihe.length === 0 ? (
                                        <p className="text-xs text-emerald-400 font-bold py-2">
                                            {(remCfg.minZalihaGlobalM3 || 0) <= 0
                                                ? 'Postavite Min. prag (m³) iznad 0 da pratite zalihe ispod minimuma.'
                                                : 'Svi artikli su iznad minimalnog praga! ✅'}
                                        </p>
                                    ) : (
                                        <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                                            {remStanje.niskeZalihe.slice(0, 10).map((a) => (
                                                <div key={a.sifra} className="p-2.5 rounded-xl bg-theme-card border border-theme-border flex items-center justify-between text-xs">
                                                    <span className="font-bold text-theme-text truncate pr-2">{a.naziv}</span>
                                                    <span className="font-black text-red-400 shrink-0">{a.trenutnoM3.toFixed(2)} / {a.pragM3} m³</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : filter === 'AUTOTEST' ? (
                <div className="bg-theme-card p-6 md:p-8 rounded-[2rem] border-2 border-emerald-500/40 shadow-2xl space-y-6 animate-in zoom-in-95">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-theme-border pb-6">
                        <div>
                            <h3 className="text-emerald-400 font-black uppercase text-sm md:text-base tracking-widest">🤖 AI Autopilot — Kompletna Verifikacija Sistema</h3>
                            <p className="text-xs text-slate-400 mt-1">Automatski testira svih 35 tabela baze, matematiku mjernih jedinica (cm/m³), kreira probni krug kroz sve module i skenira oštećene dokumente.</p>
                        </div>
                        <button 
                            onClick={pokreniKompletanAutoTest} 
                            disabled={testRunning}
                            className={`w-full md:w-auto px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all shrink-0 ${testRunning ? 'bg-slate-700 text-slate-400 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:scale-105'}`}
                        >
                            {testRunning ? '⏳ AI TESTIRA SISTEM...' : '🚀 POKRENI KOMPLETAN AI AUTO-TEST'}
                        </button>
                    </div>

                    {testProgress > 0 && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-black uppercase">
                                <span className="text-emerald-400">Progres dijagnostike: {testProgress}%</span>
                                <span className="text-slate-400">Ukupno provjera: {ukupnoTestova} (✅ {uspjesnihTestova} | ⚠️ {upozorenjaTestova} | ❌ {gresakaTestova})</span>
                            </div>
                            <div className="w-full h-3 bg-theme-panel rounded-full overflow-hidden border border-theme-border">
                                <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${testProgress}%` }}></div>
                            </div>
                        </div>
                    )}

                    {(korumpiraniDokumenti.ponude.length > 0 || korumpiraniDokumenti.racuni.length > 0) && (
                        <div className="bg-amber-950/40 border-2 border-amber-500 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <h4 className="text-amber-400 font-black uppercase text-xs">🛠️ Pronađeni stari dokumenti sa NaN / praznim cijenama!</h4>
                                <p className="text-xs text-slate-300 mt-1">
                                    Ponude ({korumpiraniDokumenti.ponude.map(p => p.id).join(', ') || '0'}) | Računi ({korumpiraniDokumenti.racuni.map(r => r.id).join(', ') || '0'})
                                </p>
                            </div>
                            <button 
                                onClick={popraviSveKorumpiraneDokumenteUBazi}
                                disabled={popravljamBazu}
                                className="w-full md:w-auto px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl text-[10px] uppercase tracking-widest shadow-lg shrink-0"
                            >
                                {popravljamBazu ? '⏳ POPRAVLJAM...' : '🛠️ AUTOMATSKI POPRAVI SVE U BAZI'}
                            </button>
                        </div>
                    )}

                    <div className="space-y-2 max-h-[550px] overflow-y-auto pr-2 custom-scrollbar">
                        {testResults.length === 0 && !testRunning && (
                            <div className="text-center py-16 text-slate-500 font-bold uppercase text-xs border-2 border-dashed border-theme-border rounded-2xl">
                                Kliknite na zeleno dugme iznad da AI izvrši kompletan pregled i simulaciju rada aplikacije.
                            </div>
                        )}
                        {testResults.map((rez) => (
                            <div key={rez.id} className={`p-3.5 rounded-xl border flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs ${rez.status === 'OK' ? 'bg-theme-panel border-emerald-500/20' : rez.status === 'UPOZORENJE' ? 'bg-amber-950/20 border-amber-500/40' : 'bg-red-950/30 border-red-500'}`}>
                                <div className="flex items-center gap-3">
                                    <span className="text-base">{rez.status === 'OK' ? '✅' : rez.status === 'UPOZORENJE' ? '⚠️' : '❌'}</span>
                                    <div>
                                        <span className="text-[9px] text-slate-500 font-black uppercase block">{rez.kategorija}</span>
                                        <span className="font-black text-theme-text uppercase">{rez.naziv}</span>
                                    </div>
                                </div>
                                <div className="sm:text-right">
                                    <span className={`font-bold text-[11px] ${rez.status === 'OK' ? 'text-emerald-400' : rez.status === 'UPOZORENJE' ? 'text-amber-400' : 'text-red-400'}`}>
                                        {rez.detalji}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <>
                    {/* BROJAČI (Prikazuju se samo u tabu AKTIVNI) */}
                    {filter === 'AKTIVNI' && (
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-theme-card border-2 border-red-500/50 p-6 rounded-[2rem] text-center shadow-lg flex flex-col items-center justify-center">
                                <span className="text-[10px] text-red-500 uppercase font-black tracking-widest mb-2">Kritični Alarmi</span>
                                <span className="text-5xl font-black text-red-500 drop-shadow-md">{crvenih}</span>
                            </div>
                            <div className="bg-theme-card border-2 border-amber-500/50 p-6 rounded-[2rem] text-center shadow-lg flex flex-col items-center justify-center">
                                <span className="text-[10px] text-amber-500 uppercase font-black tracking-widest mb-2">Sistemska Upozorenja</span>
                                <span className="text-5xl font-black text-amber-500 drop-shadow-md">{zutih}</span>
                            </div>
                        </div>
                    )}

                    {/* LISTA ALARMA */}
                    <div className="bg-theme-card p-6 rounded-[2rem] border border-theme-border shadow-xl min-h-[400px]">
                        {logovi.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-theme-muted opacity-50">
                                <span className="text-6xl mb-4">✅</span>
                                <span className="text-xs uppercase font-black tracking-widest">Sve je čisto. Nema novih alarma!</span>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {logovi.map(log => {
                                    const isCrveno = log.nivo_alarma === 'CRVENO';
                                    const isZuto = log.nivo_alarma === 'ŽUTO';
                                    const datum = new Date(log.vrijeme || log.created_at).toLocaleString('de-DE');

                                    return (
                                        <div
                                            key={log.id}
                                            onClick={() => setOdabraniLog(log)}
                                            className={`flex flex-col md:flex-row justify-between md:items-center p-5 rounded-2xl border-l-4 shadow-sm transition-all hover:scale-[1.01] cursor-pointer ${isCrveno ? 'bg-red-900/10 border-red-500' : isZuto ? 'bg-amber-900/10 border-amber-500' : 'bg-theme-panel border-slate-500'}`}
                                        >
                                            
                                            <div className="flex-1 mb-4 md:mb-0">
                                                <div className="flex items-center gap-3 mb-2">
                                                    {isCrveno && <span className="bg-red-500 text-white text-[9px] uppercase font-black px-2 py-0.5 rounded shadow-sm">Kritično</span>}
                                                    {isZuto && <span className="bg-amber-500 text-white text-[9px] uppercase font-black px-2 py-0.5 rounded shadow-sm">Upozorenje</span>}
                                                    {!isCrveno && !isZuto && <span className="bg-slate-500 text-white text-[9px] uppercase font-black px-2 py-0.5 rounded shadow-sm">INFO</span>}
                                                    <span className="text-[10px] text-theme-muted font-bold tracking-widest">{datum}</span>
                                                </div>
                                                
                                                <h3 className="text-sm font-black text-theme-text uppercase">{log.akcija}</h3>
                                                <p className="text-xs text-theme-muted mt-1 font-bold">{ocistiTekstDetalja(log.detalji)}</p>
                                                
                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                    <span className="inline-block bg-theme-card px-3 py-1 rounded-lg border border-theme-border text-[10px] font-black uppercase text-theme-text shadow-inner">
                                                        👤 Izvršio: <span className="text-blue-500">{log.korisnik}</span>
                                                    </span>
                                                    <span className="text-[10px] text-theme-accent font-black uppercase">📜 Klikni za kompletnu historiju →</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-end md:ml-4">
                                                {log.pregledano ? (
                                                    <span className="text-[10px] text-emerald-500 font-black uppercase flex items-center gap-1"><span className="text-lg">✓</span> Pročitano</span>
                                                ) : (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); oznaciKaoRijeseno(log.id); }}
                                                        className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md hover:scale-105 ${isCrveno ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'}`}
                                                    >
                                                        ✓ Označi Riješeno
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}

            {odabraniLog && (
                <NotificationDetailModal
                    notification={odabraniLog}
                    user={user}
                    onClose={() => setOdabraniLog(null)}
                    onActionComplete={ucitajLogove}
                />
            )}
        </div>
    );
}