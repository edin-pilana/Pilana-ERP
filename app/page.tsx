"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from './utils/supabaseClient';
import { toLocalIso } from './utils/dateHelpers';
import { ocistiTekstDetalja } from './utils/notificationHelpers';
import { toast, Toaster } from 'sonner';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Settings, Plus, X, Move, Eye, AlertTriangle, CheckCircle2, Clock, Truck, Hammer } from 'lucide-react';

import AppShell from './components/AppShell';
import PametniDialog from './components/PametniDialog';
import SmartChart from './components/SmartChart';
import JutarnjiBrifingCard from './components/JutarnjiBrifingCard';
import { useAppStore } from './store/useAppStore'; 

// 🚀 Lazy-loading svih 18 modula za 3-4× brže početno učitavanje (code-splitting po modulu)
const ModuleLoadingFallback = () => (
    <div className="p-8 flex items-center justify-center min-h-[55vh]">
        <div className="bg-theme-card border border-theme-border rounded-2xl px-6 py-5 shadow-xl flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-theme-accent animate-ping" />
            <span className="text-xs font-black uppercase tracking-widest text-theme-muted">Učitavam modul...</span>
        </div>
    </div>
);

const ProrezModule = dynamic(() => import('./modules/ProrezModule'), { ssr: false, loading: ModuleLoadingFallback });
const PrijemModule = dynamic(() => import('./modules/PrijemModule'), { ssr: false, loading: ModuleLoadingFallback });
const PilanaModule = dynamic(() => import('./modules/PilanaModule'), { ssr: false, loading: ModuleLoadingFallback });
const DoradaModule = dynamic(() => import('./modules/DoradaModule'), { ssr: false, loading: ModuleLoadingFallback });
const SettingsModule = dynamic(() => import('./modules/SettingsModule'), { ssr: false, loading: ModuleLoadingFallback });
const PonudeModule = dynamic(() => import('./modules/PonudeModule'), { ssr: false, loading: ModuleLoadingFallback });
const RadniNaloziModule = dynamic(() => import('./modules/RadniNaloziModule'), { ssr: false, loading: ModuleLoadingFallback });
const OtpremniceModule = dynamic(() => import('./modules/OtpremniceModule'), { ssr: false, loading: ModuleLoadingFallback });
const RacuniModule = dynamic(() => import('./modules/RacuniModule'), { ssr: false, loading: ModuleLoadingFallback });
const BlagajnaModule = dynamic(() => import('./modules/BlagajnaModule'), { ssr: false, loading: ModuleLoadingFallback });
const KontrolniToranjModule = dynamic(() => import('./modules/KontrolniToranjModule'), { ssr: false, loading: ModuleLoadingFallback });
const AnalitikaModule = dynamic(() => import('./modules/AnalitikaModule'), { ssr: false, loading: ModuleLoadingFallback });
const LagerPaketaModule = dynamic(() => import('./modules/LagerPaketaModule'), { ssr: false, loading: ModuleLoadingFallback });
const PlaniranjeModule = dynamic(() => import('./modules/PlaniranjeModule'), { ssr: false, loading: ModuleLoadingFallback });
const ReklamacijeModule = dynamic(() => import('./modules/ReklamacijeModule'), { ssr: false, loading: ModuleLoadingFallback });
const KioskModule = dynamic(() => import('./modules/KioskModule'), { ssr: false, loading: ModuleLoadingFallback });
const HrDashboardModule = dynamic(() => import('./modules/HrDashboardModule'), { ssr: false, loading: ModuleLoadingFallback });
const NadzorModule = dynamic(() => import('./modules/NadzorModule'), { ssr: false, loading: ModuleLoadingFallback });

const PALETA = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const defaultModuli = [
    { id: 'prijem', naziv: 'Prijem Trupaca', ikona: '🌲', hex_boja: '#10b981' },
    { id: 'prorez', naziv: 'Prorez', ikona: '🪚', hex_boja: '#ef4444' },
    { id: 'pilana', naziv: 'Pilana', ikona: '🪵', hex_boja: '#10b981' },
    { id: 'dorada', naziv: 'Dorada', ikona: '🔄', hex_boja: '#3b82f6' },
    { id: 'planiranje', naziv: 'Planiranje', ikona: '📅', hex_boja: '#f59e0b' },
    { id: 'lager', naziv: 'Lager', ikona: '📦', hex_boja: '#3b82f6' },
    { id: 'ponude', naziv: 'Ponude', ikona: '📝', hex_boja: '#ec4899' },
    { id: 'radni_nalozi', naziv: 'Nalozi', ikona: '⚙️', hex_boja: '#a855f7' },
    { id: 'otpremnice', naziv: 'Otpremnice', ikona: '🚚', hex_boja: '#f97316' },
    { id: 'racuni', naziv: 'Računi', ikona: '🧾', hex_boja: '#ef4444' },
    { id: 'blagajna', naziv: 'Blagajna', ikona: '💵', hex_boja: '#10b981' },
    { id: 'toranj', naziv: 'Kontrola', ikona: '🕵️', hex_boja: '#6366f1' },
    { id: 'analitika', naziv: 'Analitika', ikona: '📊', hex_boja: '#8b5cf6' },
    { id: 'podesavanja', naziv: 'Postavke', ikona: '⚙️', hex_boja: '#64748b' },
    { id: 'kiosk', naziv: 'Prijava na Rad', ikona: '🕒', hex_boja: '#2563eb' },
    { id: 'hr', naziv: 'HR Dashboard', ikona: '👥', hex_boja: '#f59e0b' },
    { id: 'reklamacije', naziv: 'Reklamacije', ikona: '⚠️', hex_boja: '#ef4444' },
    // 🟢 DODAN TAJNI NADZORNI CENTAR
    { id: 'nadzor', naziv: 'Nadzorni Centar', ikona: '🛡️', hex_boja: '#dc2626' }
];

const DOSTUPNI_WIDGETI = [
    { type: 'brzi_moduli', name: '🚀 Brzi Moduli (Katalog)' },
    { type: 'rezime_finansije', name: '💰 Finansije (Cashflow)' },
    { type: 'rezime_proizvodnja', name: '🏭 Proizvodnja (OEE)' },
    { type: 'nalozi_progres', name: '🔥 Progres Naloga' },
    { type: 'spremno_isporuka', name: '🚚 Spremno za Isporuku' },
    { type: 'nalozi_cekanje', name: '⏳ Nalozi na Čekanju' },
    { type: 'trend_proizvodnje', name: '📈 Trend Proizvodnje' },
    { type: 'live_feed', name: '⚡ Live Feed Pogon' },
    { type: 'stanje_trupaca', name: '🪵 Trupci na Placu' },
    { type: 'stanje_daske', name: '📦 Gotova Roba (Lager)' },
    { type: 'top_duznici', name: '🚨 Top 5 Dužnika' },
    { type: 'prilagodjeni_dijagram', name: '🎨 Prilagođeni Dijagram (Studio)' },
];

const defaultWidgetLayout = [
    { id: `w_${Date.now()}_1`, type: 'rezime_proizvodnja', span: 'col-span-12', allowedRoles: ['superadmin', 'admin', 'manager'] },
    { id: `w_${Date.now()}_2`, type: 'nalozi_progres', span: 'col-span-12 lg:col-span-8', allowedRoles: ['superadmin', 'admin', 'manager'] },
    { id: `w_${Date.now()}_3`, type: 'spremno_isporuka', span: 'col-span-12 lg:col-span-4', allowedRoles: ['superadmin', 'admin', 'manager', 'operater'] },
    { id: `w_${Date.now()}_4`, type: 'brzi_moduli', span: 'col-span-12', allowedRoles: ['superadmin', 'admin', 'manager', 'operater'] }
];

export default function Page() {
    const { layout } = useAppStore(); 
    const [loggedUser, setLoggedUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [loginBusy, setLoginBusy] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [activeModule, setActiveModule] = useState('home');
    
    const [dialog, setDialog] = useState({ isOpen: false });
    const prikaziDialog = (opcije) => setDialog({ isOpen: true, confirmText: 'POTVRDI', cancelText: 'ZATVORI', ...opcije });
    const zatvoriDialog = () => setDialog({ isOpen: false });

    const [kontekstniMeni, setKontekstniMeni] = useState(null);
    const [header, setHeader] = useState({
        mjesto: typeof window !== 'undefined' ? localStorage.getItem('last_loc') || '' : '',
        datum: toLocalIso(new Date()),
        masina: typeof window !== 'undefined' ? localStorage.getItem('last_masina') || '' : ''
    });

    const [loginLogoUrl, setLoginLogoUrl] = useState('');
    const [uiPostavke, setUiPostavke] = useState({
        glavni_naslov: "Operativni Centar",
        pozdravna_poruka: "Odaberi modul — isti tok rada, novi izgled.",
        login_naslov_1: "Smart",
        login_naslov_2: "Timber",
        login_user_label: "Username",
        login_pass_label: "Password",
        login_btn_tekst: "Pristupi sistemu",
        login_boja_akcenta: "#2563eb",
        moduli: [],
        menu_style: {},
        widget_layout: defaultWidgetLayout
    });

    const [isEditMode, setIsEditMode] = useState(false);
    const [backupPostavke, setBackupPostavke] = useState(null);

    const dragItem = useRef(null); const dragOverItem = useRef(null);
    const widgetDragItem = useRef(null);
    const widgetDragOverItem = useRef(null);
    const [isDraggingWidget, setIsDraggingWidget] = useState(false); 

    const [customDatasetMap, setCustomDatasetMap] = useState({});

    const [dashboardData, setDashboardData] = useState({ 
        kpi: {}, feed: [], trend: [], trupciChart: [], paketiChart: [], 
        naloziCekanje: [], naloziProgres: [], spremnoZaIsporuku: [], topDuznici: [] 
    });
    const [dashLoading, setDashLoading] = useState(true);

    // 🟢 GLOBALNI SLUŠAOC ZA ZVONCE (NADZORNI CENTAR + DEEP-LINK NA BILO KOJI MODUL)
    useEffect(() => {
        const handleNadzorNavigacija = () => {
            setActiveModule('nadzor');
        };
        const handleModulNavigacija = (ev) => {
            const detail = ev?.detail || {};
            if (!detail.modul) return;
            localStorage.removeItem('erp_auto_open_id');
            localStorage.removeItem('erp_auto_action');
            if (detail.autoOpenId) localStorage.setItem('erp_auto_open_id', detail.autoOpenId);
            if (detail.autoAction) localStorage.setItem('erp_auto_action', detail.autoAction);
            setActiveModule(detail.modul);
        };
        window.addEventListener('navigacija_na_nadzor', handleNadzorNavigacija);
        window.addEventListener('navigacija_na_modul', handleModulNavigacija);
        return () => {
            window.removeEventListener('navigacija_na_nadzor', handleNadzorNavigacija);
            window.removeEventListener('navigacija_na_modul', handleModulNavigacija);
        };
    }, []);

    const ucitajDashboardPodatke = async () => {
        setDashLoading(true);
        const sada = new Date();
        const danas = toLocalIso(sada);
        const sedamDanaObj = new Date(sada.getFullYear(), sada.getMonth(), sada.getDate() - 7);
        const sedamDanaNazad = toLocalIso(sedamDanaObj);
        try {
            const [trupciRes, paketiRes, racuniRes, blagajnaRes, naloziRes, feedRes, trendRes, trupciLagerRes, paketiLagerRes] = await Promise.all([
                supabase.from('trupci').select('zapremina, kontrolna_zapremina').eq('datum_prijema', danas),
                supabase.from('paketi').select('kolicina_final').eq('datum_yyyy_mm', danas),
                supabase.from('racuni').select('*').neq('status', 'NAPLAĆENO'), 
                supabase.from('blagajna').select('racun_id, iznos, tip, opis').eq('tip', 'ULAZ'),
                supabase.from('radni_nalozi').select('*').neq('status', 'ISPORUČENO'), 
                supabase.from('sistem_audit_log').select('*').order('vrijeme', { ascending: false }).limit(8),
                supabase.from('paketi').select('datum_yyyy_mm, kolicina_final').gte('datum_yyyy_mm', sedamDanaNazad).lte('datum_yyyy_mm', danas),
                supabase.from('trupci').select('duzina, zapremina, kontrolna_zapremina').eq('status', 'na_lageru').eq('zakljucen_prijem', true),
                supabase.from('paketi').select('broj_veze, naziv_proizvoda, kolicina_final').not('closed_at', 'is', null).is('otpremnica_id', null)
            ]);
            const sumUlaz = (trupciRes.data || []).reduce((a,b)=>a+parseFloat(b.kontrolna_zapremina || b.zapremina || 0), 0);
            const sumIzlaz = (paketiRes.data || []).reduce((a,b)=>a+parseFloat(b.kolicina_final||0), 0);
            
            const sviRacuni = racuniRes.data || [];
            const sveUplate = blagajnaRes.data || [];
            let sumOtvoreniDug = 0;
            const kupciDug = {};

            sviRacuni.forEach(r => {
                const rid = (r.id || '').toUpperCase().trim();
                const valNorm = String(r.valuta || 'KM').toUpperCase().trim();
                const ukupnoOrig = parseFloat(r.ukupno_sa_pdv || 0);
                const ukupnoRacun = (valNorm === 'EUR' || valNorm === '€') ? parseFloat((ukupnoOrig * 1.95583).toFixed(2)) : ukupnoOrig;
                const uplacenoZaRacun = sveUplate
                    .filter(u => (u.racun_id && u.racun_id.toUpperCase().trim() === rid) || (u.opis && u.opis.toUpperCase().includes(rid)))
                    .reduce((s, u) => s + parseFloat(u.iznos || 0), 0);
                const preostalo = Math.max(0, parseFloat((ukupnoRacun - uplacenoZaRacun).toFixed(2)));
                if (preostalo > 0.009) {
                    sumOtvoreniDug += preostalo;
                    kupciDug[r.kupac_naziv] = (kupciDug[r.kupac_naziv] || 0) + preostalo;
                }
            });

            const topDuznici = Object.keys(kupciDug).map(k => ({ name: k, dug: parseFloat(kupciDug[k].toFixed(2)) })).sort((a,b) => b.dug - a.dug).slice(0, 5);

            const trendMap = {};
            for(let i=6; i>=0; i--) { const dt = new Date(sada.getFullYear(), sada.getMonth(), sada.getDate() - i); const d = toLocalIso(dt);
            trendMap[d] = { dan: d.substring(5,10).replace('-', '.'), m3: 0 }; }
            (trendRes.data || []).forEach(p => { if(trendMap[p.datum_yyyy_mm]) trendMap[p.datum_yyyy_mm].m3 += parseFloat(p.kolicina_final||0); });
            const trupciMap = {};
            (trupciLagerRes.data || []).forEach(t => { const l = parseFloat(t.duzina).toFixed(1); trupciMap[l] = (trupciMap[l] || 0) + parseFloat(t.kontrolna_zapremina || t.zapremina || 0); });
            const trupciChart = Object.keys(trupciMap).map(k => ({ duzina: k + 'm', m3: parseFloat(trupciMap[k].toFixed(2)) })).sort((a,b) => parseFloat(a.duzina) - parseFloat(b.duzina));
            const paketiMap = {};
            (paketiLagerRes.data || []).forEach(p => { const n = p.naziv_proizvoda; paketiMap[n] = (paketiMap[n] || 0) + parseFloat(p.kolicina_final || 0); });
            const paketiChart = Object.keys(paketiMap).map(k => ({ naziv: k, m3: parseFloat(paketiMap[k].toFixed(2)) })).sort((a,b) => b.m3 - a.m3).slice(0, 8);
            const sviNalozi = naloziRes.data || [];
            
            const naloziCekanje = sviNalozi.filter(n => n.status !== 'U PROIZVODNJI' && n.status !== 'ZAVRŠENO' && n.status !== 'OBRISANO').map(n => ({
                id: n.id, kupac: n.kupac_naziv, rok: n.rok_isporuke, status: n.status, stavki: (n.stavke_jsonb||[]).length
            })).sort((a,b) => new Date(a.rok).getTime() - new Date(b.rok).getTime());
            const naloziProgres = sviNalozi.filter(n => n.status === 'U PROIZVODNJI').map(n => {
                const stavke = n.stavke_jsonb || [];
                const cilj = stavke.reduce((s, st) => s + parseFloat(st.kolicina_obracun || st.kolicina_unos || 0), 0);
                const uradjeno = stavke.reduce((s, st) => s + parseFloat(st.napravljeno || 0), 0);
                const procenat = cilj > 0 ? Math.min(100, Math.round((uradjeno / cilj) * 100)) : 0;
                return { id: n.id, kupac: n.kupac_naziv, cilj: cilj.toFixed(2), uradjeno: uradjeno.toFixed(2), procenat };
            }).sort((a,b) => b.procenat - a.procenat);
            const spremnoMap = {};
            (paketiLagerRes.data || []).filter(p => p.broj_veze).forEach(p => {
                spremnoMap[p.broj_veze] = (spremnoMap[p.broj_veze] || 0) + parseFloat(p.kolicina_final || 0);
            });
            const spremnoZaIsporuku = Object.keys(spremnoMap).map(rn => {
                const nalogInfo = sviNalozi.find(n => n.id === rn);
                return { id: rn, kupac: nalogInfo ? nalogInfo.kupac_naziv : 'Nepoznat Kupac', kolicina: spremnoMap[rn].toFixed(2) };
            }).sort((a,b) => parseFloat(b.kolicina) - parseFloat(a.kolicina));
            setDashboardData({
                kpi: { ulaz: sumUlaz.toFixed(1), izlaz: sumIzlaz.toFixed(1), potrazivanja: sumOtvoreniDug.toLocaleString('bs-BA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
                feed: feedRes.data || [], trend: Object.values(trendMap), trupciChart, paketiChart, naloziCekanje, naloziProgres, spremnoZaIsporuku, topDuznici
            });
        } catch(e) {}
        setDashLoading(false);
    };
    
    useEffect(() => { if (activeModule === 'home' && loggedUser) ucitajDashboardPodatke(); }, [activeModule, loggedUser]);

    const pokreniEdit = () => { setBackupPostavke(JSON.parse(JSON.stringify(uiPostavke))); setIsEditMode(true); };
    const odustaniOdEdita = () => { if (backupPostavke) setUiPostavke(backupPostavke); setIsEditMode(false); };
    
    const handleDeepLink = (modulId, targetId, action = null) => {
        localStorage.removeItem('erp_auto_open_id');
        localStorage.removeItem('erp_auto_action');
        if (targetId) localStorage.setItem('erp_auto_open_id', targetId);
        if (action) localStorage.setItem('erp_auto_action', action);
        setActiveModule(modulId);
        setKontekstniMeni(null);
    };

    const handleWidgetDragStart = (e, index) => { widgetDragItem.current = index; setIsDraggingWidget(true); };
    const handleWidgetDragEnter = (e, index) => { widgetDragOverItem.current = index; };
    const handleWidgetDrop = () => {
        setIsDraggingWidget(false);
        if(widgetDragItem.current === null || widgetDragOverItem.current === null) return;
        const novaLista = [...(uiPostavke.widget_layout || [])];
        const premjesteniItem = novaLista[widgetDragItem.current];
        novaLista.splice(widgetDragItem.current, 1);
        novaLista.splice(widgetDragOverItem.current, 0, premjesteniItem); 
        widgetDragItem.current = null; widgetDragOverItem.current = null;
        setUiPostavke({ ...uiPostavke, widget_layout: novaLista });
    };
    
    const addWidget = (type) => {
        const noviWidget = { id: `w_${Date.now()}_${Math.random()}`, type, span: 'col-span-12 lg:col-span-6', allowedRoles: ['superadmin', 'admin'] };
        setUiPostavke(prev => ({ ...prev, widget_layout: [...(prev.widget_layout || []), noviWidget] }));
    };
    
    const updateWidgetSpan = (index) => {
        const novaLista = [...(uiPostavke.widget_layout || [])];
        const curr = novaLista[index].span;
        novaLista[index].span = curr === 'col-span-12 lg:col-span-4' ? 'col-span-12 lg:col-span-6' : (curr === 'col-span-12 lg:col-span-6' ? 'col-span-12' : 'col-span-12 lg:col-span-4');
        setUiPostavke({ ...uiPostavke, widget_layout: novaLista });
    };
    
    const deleteWidget = (index) => {
        prikaziDialog({
            tip: 'upozorenje', naslov: 'Uklanjanje Widgeta',
            poruka: 'Da li ste sigurni da želite ukloniti ovaj informacijski prozor sa početnog ekrana?',
            confirmText: '🗑️ UKLONI', cancelText: '✕ ODUSTANI',
            onConfirm: () => {
                const novaLista = [...(uiPostavke.widget_layout || [])];
                novaLista.splice(index, 1);
                setUiPostavke({ ...uiPostavke, widget_layout: novaLista });
                zatvoriDialog();
            },
            onCancel: zatvoriDialog
        });
    };

    const toggleWidgetRole = (index, uloga) => {
        const novaLista = [...(uiPostavke.widget_layout || [])];
        const roles = novaLista[index].allowedRoles || [];
        novaLista[index].allowedRoles = roles.includes(uloga) ? roles.filter(r => r !== uloga) : [...roles, uloga];
        setUiPostavke({ ...uiPostavke, widget_layout: novaLista });
    };

    const handleDragStart = (e, index) => { dragItem.current = index; };
    const handleDragEnter = (e, index) => { dragOverItem.current = index; };
    const handleDrop = () => {
        if(dragItem.current === null || dragOverItem.current === null) return;
        const novaLista = [...(uiPostavke.moduli || [])];
        const premjesteniItem = novaLista[dragItem.current];
        novaLista.splice(dragItem.current, 1); 
        novaLista.splice(dragOverItem.current, 0, premjesteniItem); 
        dragItem.current = null;
        dragOverItem.current = null;
        setUiPostavke({ ...uiPostavke, moduli: novaLista });
    };
    
    const updateModul = (index, polje, vrijednost) => { 
        const novaLista = [...(uiPostavke.moduli || [])];
        novaLista[index][polje] = vrijednost; setUiPostavke({ ...uiPostavke, moduli: novaLista }); 
    };
    
    const obrisiModulPotpuno = (index) => {
        prikaziDialog({
            tip: 'upozorenje', naslov: 'Uklanjanje Prečice',
            poruka: 'Da li želite ukloniti ovu karticu iz prečica na početnom ekranu? (Kartica će i dalje ostati dostupna u glavnom bočnom meniju)',
            confirmText: '🗑️ UKLONI PREČICU', cancelText: '✕ ZADRŽI',
            onConfirm: () => {
                const novaLista = [...(uiPostavke.moduli || [])];
                novaLista.splice(index, 1);
                setUiPostavke({ ...uiPostavke, moduli: novaLista });
                zatvoriDialog();
            },
            onCancel: zatvoriDialog
        });
    };
    
    const spasiDizajn = async () => {
        localStorage.setItem('erp_dashboard_ui_backup', JSON.stringify(uiPostavke));
        const { error } = await supabase
            .from('ui_postavke')
            .upsert([{ modul_ime: 'dashboard', postavke_jsonb: uiPostavke }], { onConflict: 'modul_ime' });
            
        if(error) { 
            toast.error("Greška pri snimanju dizajna: " + error.message); 
        } else { 
            toast.success("Dizajn i dozvole uspješno spašeni!"); 
            setIsEditMode(false); 
            setBackupPostavke(null); 
        }
    };

    useEffect(() => {
        const initApp = async () => {
            const userJson = localStorage.getItem('smart_timber_user');
            if (userJson) { try { setLoggedUser(JSON.parse(userJson)); } catch (e) { localStorage.removeItem('smart_timber_user'); } }
            try {
                const [uiRes, brendRes] = await Promise.all([
                    supabase.from('ui_postavke').select('postavke_jsonb').eq('modul_ime', 'dashboard').maybeSingle(),
                    supabase.from('brending').select('*')
                ]);

                if (brendRes.data && brendRes.data.length > 0) {
                    let logoObj = brendRes.data.find(b => (b.lokacije_jsonb || []).includes('GLAVNI MENI / SIDEBAR (GORE LIJEVO)')) || brendRes.data[0];
                    if (logoObj?.url_slike) {
                        setLoginLogoUrl(logoObj.url_slike);
                        localStorage.setItem('saas_app_logo', logoObj.url_slike);
                    }
                } else {
                    const cachedLogo = localStorage.getItem('saas_app_logo');
                    if (cachedLogo) setLoginLogoUrl(cachedLogo);
                }

                // Prvo gledamo bazu, a ako baza nema zapis, čitamo iz localStorage bekapa
                let localBackup = null;
                try {
                    const rawBackup = localStorage.getItem('erp_dashboard_ui_backup');
                    if (rawBackup) localBackup = JSON.parse(rawBackup);
                } catch (e) {}

                let fetchedSettings = uiRes.data?.postavke_jsonb || localBackup || { 
                    glavni_naslov: "Operativni Centar", 
                    pozdravna_poruka: "Odaberi modul — isti tok rada, novi izgled.", 
                    moduli: [], 
                    menu_style: {},
                    widget_layout: defaultWidgetLayout 
                };
                
                if (!fetchedSettings.widget_layout) fetchedSettings.widget_layout = defaultWidgetLayout;
                if (fetchedSettings.login_naslov_1 === undefined) fetchedSettings.login_naslov_1 = "Smart";
                if (fetchedSettings.login_naslov_2 === undefined) fetchedSettings.login_naslov_2 = "Timber";
                if (!fetchedSettings.login_user_label) fetchedSettings.login_user_label = "Username";
                if (!fetchedSettings.login_pass_label) fetchedSettings.login_pass_label = "Password";
                if (!fetchedSettings.login_btn_tekst) fetchedSettings.login_btn_tekst = "Pristupi sistemu";
                if (!fetchedSettings.login_boja_akcenta) fetchedSettings.login_boja_akcenta = "#2563eb";
                if (!Array.isArray(fetchedSettings.moduli)) fetchedSettings.moduli = [];

                let changed = false;
                defaultModuli.forEach(dm => {
                    if (!fetchedSettings.moduli.some(m => m.id === dm.id)) { 
                        fetchedSettings.moduli.push(dm); 
                        changed = true; 
                    }
                });

                setUiPostavke(fetchedSettings);
                localStorage.setItem('erp_dashboard_ui_backup', JSON.stringify(fetchedSettings));

                if (changed || !uiRes.data) {
                    supabase.from('ui_postavke').upsert([{ modul_ime: 'dashboard', postavke_jsonb: fetchedSettings }], { onConflict: 'modul_ime' }).then();
                }
            } catch(e) {}
            setAuthLoading(false);
        };
        initApp();
    }, []);
    
    const handleLogin = async (e) => {
        e.preventDefault();
        if (loginBusy) return;
        const username = e.target.user.value.trim();
        const password = e.target.pass.value.trim();
        if (!username || !password) {
            setLoginError('Unesite korisničko ime i lozinku.');
            return;
        }
        setLoginBusy(true);
        setLoginError('');
        try {
            const lowerUser = username.toLowerCase();
            let { data, error } = await supabase.rpc('provjeri_login', { uneseni_user: lowerUser, unesena_sifra: password });
            if (!error && !data && username !== lowerUser) {
                const retry = await supabase.rpc('provjeri_login', { uneseni_user: username, unesena_sifra: password });
                data = retry.data;
                error = retry.error;
            }
            if (error) {
                const msg = "Greška pri komunikaciji sa serverom: " + error.message;
                setLoginError(msg);
                toast.error(msg);
            } else if (data) {
                localStorage.setItem('smart_timber_user', JSON.stringify(data));
                setLoggedUser(data);
                setLoginError('');
                toast.success(`Dobrodošli nazad, ${data.ime_prezime}!`);
            } else {
                const msg = "Pogrešan Username ili Password! Provjerite podatke i pokušajte ponovo.";
                setLoginError(msg);
                toast.error(msg);
            }
        } catch (err) {
            const msg = "Greška pri prijavi: " + (err?.message || 'Pokušajte ponovo.');
            setLoginError(msg);
            toast.error(msg);
        } finally {
            setLoginBusy(false);
        }
    };

    const hasPermission = (modulId) => {
        if (!loggedUser) return false;
        if (modulId === 'nadzor') return loggedUser.uloga === 'superadmin';
        if (loggedUser.uloga === 'superadmin' || loggedUser.uloga === 'admin') return true;
        const mapaDozvola = {
            'prijem': 'Prijem trupaca', 'prorez': 'Prorez (Trupci)', 'pilana': 'Pilana (Izlaz)', 'dorada': 'Dorada (Ulaz/Izlaz)',
            'planiranje': 'Planiranje Proizvodnje', 'lager': 'Lager Paketa', 'ponude': 'Ponude', 'radni_nalozi': 'Radni Nalozi',
            'otpremnice': 'Otpremnice i Izdatnice', 'racuni': 'Računi', 'blagajna': 'Blagajna (Keš)', 'toranj': 'Kontrolni Toranj',
            'analitika': 'Analitika', 'podesavanja': 'Podešavanja', 'kiosk': 'Prijava na Rad', 'hr': 'HR Dashboard', 'reklamacije': 'Reklamacije i Povrati',
            'nadzor': 'Superadmin'
        };
        if (modulId === 'planiranje' && (loggedUser.dozvole || []).includes('Planiranje (Samo Pregled)')) return true;
        return (loggedUser.dozvole || []).includes(mapaDozvola[modulId]);
    };

    const renderWidgetContent = (widget, index) => {
        if (dashLoading && widget.type !== 'brzi_moduli') return <div className="h-full w-full flex items-center justify-center animate-pulse text-slate-500 font-bold text-xs uppercase">Učitavam podatke...</div>;
        switch (widget.type) {
            case 'rezime_proizvodnja':
                return (
                    <div className="grid grid-cols-2 gap-4 h-full">
                        <div className="bg-emerald-900/10 border border-emerald-500/20 p-4 rounded-xl flex flex-col justify-center shadow-inner cursor-pointer hover:border-emerald-500/50 transition-colors" onClick={() => handleDeepLink('analitika', null)}>
                            <p className="text-[10px] text-emerald-500 font-black uppercase mb-1">🌲 Ulaz Sirovine</p>
                            <p className="text-2xl lg:text-3xl font-black text-theme-text">{dashboardData.kpi.ulaz} <span className="text-xs text-slate-500">m³</span></p>
                        </div>
                        <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-xl flex flex-col justify-center shadow-inner cursor-pointer hover:border-blue-500/50 transition-colors" onClick={() => handleDeepLink('analitika', null)}>
                            <p className="text-[10px] text-blue-500 font-black uppercase mb-1">🪚 Proizvedeno</p>
                            <p className="text-2xl lg:text-3xl font-black text-theme-text">{dashboardData.kpi.izlaz} <span className="text-xs text-slate-500">m³</span></p>
                        </div>
                    </div>
                );
            case 'rezime_finansije':
                return (
                    <div className="bg-red-900/10 border border-red-500/20 p-4 rounded-xl flex flex-col justify-center shadow-inner h-full cursor-pointer hover:border-red-500/50 transition-colors" onClick={() => handleDeepLink('racuni', null,'otvoreni')}>
                        <p className="text-[10px] text-red-500 font-black uppercase mb-1">🚨 Otvorena Potraživanja</p>
                        <p className="text-2xl lg:text-4xl font-black text-theme-text">{dashboardData.kpi.potrazivanja} <span className="text-sm text-slate-500">KM</span></p>
                        <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase">Nenaplaćeni računi u sistemu</p>
                    </div>
                );
            case 'nalozi_progres':
                return (
                    <div className="flex flex-col h-full">
                        <h3 className="text-[10px] text-orange-500 font-black uppercase mb-4 flex items-center gap-2">🔥 Progres Aktivnih Naloga</h3>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                            {dashboardData.naloziProgres.length === 0 && <p className="text-xs text-slate-500 italic text-center py-4">Nema naloga u proizvodnji.</p>}
                            {dashboardData.naloziProgres.map(n => (
                                <div key={n.id} onClick={() => setKontekstniMeni({ id: n.id, title: 'Aktivni Nalog', subtitle: n.kupac, actions: [{ label: '⚙️ Uredi Nalog', module: 'radni_nalozi', action: 'uredi' }, { label: '🕵️ X-Ray Forenzika', module: 'toranj', action: 'skeniraj' }]})} className="w-full p-2 rounded-lg hover:bg-theme-panel cursor-pointer transition-colors group">
                                    <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                                        <span className="text-theme-text group-hover:text-amber-500 transition-colors">{n.id} <span className="text-slate-500 ml-1">({n.kupac})</span></span>
                                        <span className={n.procenat > 80 ? 'text-emerald-400' : 'text-orange-400'}>{n.uradjeno} / {n.cilj} m³ ({n.procenat}%)</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                                        <div className={`h-full transition-all duration-1000 ${n.procenat > 80 ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${n.procenat}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'nalozi_cekanje':
                return (
                    <div className="flex flex-col h-full">
                        <h3 className="text-[10px] text-slate-400 font-black uppercase mb-4 flex items-center gap-2">⏳ Nalozi na Čekanju</h3>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                            {dashboardData.naloziCekanje.length === 0 && <p className="text-xs text-slate-500 italic text-center py-4">Svi nalozi su u proizvodnji ili završeni.</p>}
                            {dashboardData.naloziCekanje.map(n => (
                                <div key={n.id} onClick={() => setKontekstniMeni({ id: n.id, title: 'Nalog na čekanju', subtitle: n.kupac, actions: [{ label: '📅 Otvori u Planiranju', module: 'planiranje', action: 'planiraj' }, { label: '⚙️ Uredi Nalog', module: 'radni_nalozi', action: 'uredi' }, { label: '🕵️ X-Ray Forenzika', module: 'toranj', action: 'skeniraj' }]})} className="bg-theme-panel p-3 rounded-lg border border-theme-border flex justify-between items-center shadow-sm hover:border-amber-500/50 cursor-pointer transition-colors group">
                                    <div><p className="text-xs font-black text-theme-text group-hover:text-amber-500 transition-colors">{n.id}</p><p className="text-[9px] text-slate-400 uppercase font-bold mt-1">Rok: <span className="text-amber-400">{new Date(n.rok).toLocaleDateString('de-DE')}</span></p></div>
                                    <span className="text-[8px] bg-slate-800 text-slate-300 px-2 py-1 rounded font-black uppercase border border-slate-600">{n.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'spremno_isporuka':
                return (
                    <div className="flex flex-col h-full">
                        <h3 className="text-[10px] text-emerald-500 font-black uppercase mb-4 flex items-center gap-2">🚚 Spremno za isporuku</h3>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                            {dashboardData.spremnoZaIsporuku.length === 0 && <p className="text-xs text-slate-500 italic text-center py-4">Lager je prazan ili je sve isporučeno.</p>}
                            {dashboardData.spremnoZaIsporuku.map(n => (
                                <div key={n.id} onClick={() => setKontekstniMeni({ id: n.id, title: 'Spremno za Otpremu', subtitle: n.kupac, actions: [{ label: '🚚 Kreiraj Otpremnicu', module: 'otpremnice', action: 'nova' }, { label: '📦 Pregledaj Lager', module: 'lager', action: 'lager' }, { label: '🕵️ X-Ray Forenzika', module: 'toranj', action: 'skeniraj' }]})} className="bg-emerald-900/10 p-3 rounded-lg border border-emerald-500/20 flex justify-between items-center shadow-sm hover:border-emerald-500/50 cursor-pointer transition-colors group">
                                    <div><p className="text-xs font-black text-theme-text group-hover:text-emerald-400 transition-colors">{n.id}</p><p className="text-[9px] text-slate-400 uppercase font-bold mt-1">{n.kupac}</p></div>
                                    <span className="text-sm font-black text-emerald-400">{n.kolicina} <span className="text-[9px] text-emerald-600">m³</span></span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'top_duznici':
                return (
                    <div className="flex flex-col h-full">
                        <SmartChart
                            chartId="dash_top_duznici"
                            title="🚨 Top Dužnici"
                            data={dashboardData.topDuznici}
                            xKey="name"
                            series={[{ key: 'dug', name: 'Otvoreni dug', color: '#ef4444', unit: 'KM' }]}
                            defaultType="hbar"
                            unit="KM"
                            height={190}
                            compact={true}
                            onItemClick={() => handleDeepLink('racuni', null, 'otvoreni')}
                        />
                    </div>
                );
            case 'trend_proizvodnje':
                return (
                    <div className="flex flex-col h-full">
                        <SmartChart
                            chartId="dash_trend_proizvodnje"
                            title="📈 Trend Proizvodnje (Zadnjih 7 dana)"
                            data={dashboardData.trend}
                            xKey="dan"
                            series={[{ key: 'm3', name: 'Proizvedeno', color: '#3b82f6', unit: 'm³' }]}
                            defaultType="area"
                            unit="m³"
                            height={190}
                            compact={true}
                            onItemClick={() => handleDeepLink('analitika', null)}
                        />
                    </div>
                );
            case 'stanje_trupaca':
                return (
                    <div className="flex flex-col h-full">
                        <SmartChart
                            chartId="dash_stanje_trupaca"
                            title="🪵 Trupci na stanju (po dužinama)"
                            data={dashboardData.trupciChart}
                            xKey="duzina"
                            series={[{ key: 'm3', name: 'Volumen trupaca', color: '#10b981', unit: 'm³' }]}
                            defaultType="bar"
                            unit="m³"
                            height={190}
                            compact={true}
                            onItemClick={() => handleDeepLink('lager', null)}
                        />
                    </div>
                );
            case 'stanje_daske':
                return (
                    <div className="flex flex-col h-full">
                        <SmartChart
                            chartId="dash_stanje_daske"
                            title="📦 Gotova roba na stanju"
                            data={dashboardData.paketiChart}
                            xKey="naziv"
                            series={[{ key: 'm3', name: 'Na lageru', color: '#8b5cf6', unit: 'm³' }]}
                            defaultType="donut"
                            unit="m³"
                            height={210}
                            compact={true}
                            onItemClick={() => handleDeepLink('lager', null)}
                        />
                    </div>
                );
            case 'prilagodjeni_dijagram': {
                const odabraniIzvor = customDatasetMap[widget.id] || widget.dataset || 'trend';
                const izvori = {
                    trend: { label: 'Proizvodnja (7 dana)', data: dashboardData.trend, xKey: 'dan', series: [{ key: 'm3', name: 'Proizvedeno', color: '#3b82f6', unit: 'm³' }], unit: 'm³', defaultType: 'area' },
                    trupci: { label: 'Trupci po dužinama', data: dashboardData.trupciChart, xKey: 'duzina', series: [{ key: 'm3', name: 'Trupci na placu', color: '#10b981', unit: 'm³' }], unit: 'm³', defaultType: 'bar' },
                    lager: { label: 'Gotova roba (Lager)', data: dashboardData.paketiChart, xKey: 'naziv', series: [{ key: 'm3', name: 'Lager', color: '#8b5cf6', unit: 'm³' }], unit: 'm³', defaultType: 'donut' },
                    duznici: { label: 'Top dužnici (KM)', data: dashboardData.topDuznici, xKey: 'name', series: [{ key: 'dug', name: 'Dug', color: '#ef4444', unit: 'KM' }], unit: 'KM', defaultType: 'hbar' },
                    nalozi: {
                        label: 'Progres naloga (%)',
                        data: (dashboardData.naloziProgres || []).map(n => ({ id: n.id, uradjeno: parseFloat(n.uradjeno || 0), cilj: parseFloat(n.cilj || 0), procenat: n.procenat || 0 })),
                        xKey: 'id',
                        series: [
                            { key: 'uradjeno', name: 'Urađeno', color: '#10b981', unit: 'm³' },
                            { key: 'cilj', name: 'Cilj', color: '#3b82f6', unit: 'm³' },
                        ],
                        unit: 'm³',
                        defaultType: 'composed',
                    },
                    spremno: {
                        label: 'Spremno za isporuku',
                        data: (dashboardData.spremnoZaIsporuku || []).map(s => ({ id: s.id, kolicina: parseFloat(s.kolicina || 0) })),
                        xKey: 'id',
                        series: [{ key: 'kolicina', name: 'Spremno', color: '#f59e0b', unit: 'm³' }],
                        unit: 'm³',
                        defaultType: 'bar',
                    },
                };
                const aktivni = izvori[odabraniIzvor] || izvori.trend;
                return (
                    <div className="flex flex-col h-full">
                        <SmartChart
                            chartId={`dash_custom_${widget.id}`}
                            title="🎨 Dijagram Studio"
                            data={aktivni.data}
                            xKey={aktivni.xKey}
                            series={aktivni.series}
                            defaultType={aktivni.defaultType}
                            unit={aktivni.unit}
                            height={220}
                            datasetSelector={{
                                value: odabraniIzvor,
                                options: Object.entries(izvori).map(([id, v]) => ({ id, label: v.label })),
                                onChange: (val) => setCustomDatasetMap(prev => ({ ...prev, [widget.id]: val })),
                            }}
                        />
                    </div>
                );
            }
            case 'live_feed':
                return (
                    <div className="flex flex-col h-full">
                        <h3 className="text-[10px] text-theme-accent font-black uppercase mb-4 tracking-widest flex justify-between items-center">
                            <span>⚡ Live Feed Pogon</span> <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        </h3>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                            {dashboardData.feed.length === 0 && <p className="text-xs text-slate-500 italic">Sistem miruje.</p>}
                            {dashboardData.feed.map(log => (
                                <div key={log.id} className="bg-theme-panel p-3 rounded-xl border border-theme-border/50 text-xs shadow-sm">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-black text-white">{log.korisnik}</span>
                                        <span className="text-[8px] text-slate-500 font-mono">{new Date(log.vrijeme).toLocaleTimeString('bs-BA')}</span>
                                    </div>
                                    <p className="text-slate-400 text-[10px] leading-tight line-clamp-2">{log.akcija}: {ocistiTekstDetalja(log.detalji)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'brzi_moduli':
                if (layout === 'sidebar' && !isEditMode) return null;
                return (
                    <div className="flex flex-col h-full border-t border-theme-border pt-4">
                        <h3 className="text-[10px] text-slate-500 font-black uppercase mb-4 tracking-widest">🚀 Brze Prečice</h3>
                        <div className="grid grid-cols-12 gap-4">
                            {(uiPostavke.moduli || []).map((modul, modIndex) => {
                                const imaDozvolu = hasPermission(modul.id) && !modul.hiddenInMenu;
                                if (!imaDozvolu && !isEditMode) return null; 

                                const cardSpan = modul.cardSpan || 'col-span-6 md:col-span-3 lg:col-span-2';
                                const spanLabel = cardSpan.includes('lg:col-span-12') ? '1/1 (Red)' : cardSpan.includes('lg:col-span-6') ? '1/2' : cardSpan.includes('lg:col-span-4') ? '1/3' : cardSpan.includes('lg:col-span-3') ? '1/4' : '1/6';

                                const toggleCardSpan = () => {
                                    const spans = [
                                        'col-span-6 md:col-span-3 lg:col-span-2', // 6 u redu
                                        'col-span-6 md:col-span-3 lg:col-span-3', // 4 u redu
                                        'col-span-6 md:col-span-4 lg:col-span-4', // 3 u redu
                                        'col-span-12 md:col-span-6 lg:col-span-6', // 2 u redu
                                        'col-span-12 lg:col-span-12'               // 1 u redu (puna širina)
                                    ];
                                    const nextIdx = (spans.indexOf(cardSpan) + 1) % spans.length;
                                    updateModul(modIndex, 'cardSpan', spans[nextIdx]);
                                };

                                return (
                                    <div 
                                        key={`${modul.id}_${modIndex}`}
                                        draggable={isEditMode}
                                        onDragStart={(e) => handleDragStart(e, modIndex)}
                                        onDragEnter={(e) => handleDragEnter(e, modIndex)}
                                        onDragEnd={handleDrop}
                                        onDragOver={(e) => e.preventDefault()}
                                        className={`${cardSpan} relative ${isEditMode ? 'cursor-move animate-in zoom-in duration-200' : ''}`}
                                    >
                                        {isEditMode ? (
                                            <div className={`bg-theme-card border-2 border-dashed p-3 rounded-2xl flex flex-col gap-2 transition-all shadow-xl relative ${modul.hiddenInMenu ? 'border-red-500 opacity-60' : 'border-amber-500'}`}>
                                                <div className="flex justify-between items-center gap-1">
                                                    <span className="text-amber-500 font-black text-[9px] uppercase flex items-center gap-1">☰</span>
                                                    <div className="flex gap-1">
                                                        <button onClick={toggleCardSpan} className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded text-[8px] font-black uppercase hover:bg-amber-500 hover:text-black" title="Promijeni širinu kartice u redu">
                                                            Širina: {spanLabel}
                                                        </button>
                                                        <button onClick={() => updateModul(modIndex, 'hiddenInMenu', !modul.hiddenInMenu)} className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${modul.hiddenInMenu ? 'bg-red-600 text-white border-red-400' : 'bg-slate-800 text-slate-300 border-slate-600'}`} title="Sakrij/Prikaži modul">
                                                            {modul.hiddenInMenu ? 'Skriveno' : 'Vidljivo'}
                                                        </button>
                                                    </div>
                                                </div>
                                                <input value={modul.naziv} onChange={(e) => updateModul(modIndex, 'naziv', e.target.value)} className="p-2 bg-theme-main text-white text-xs font-bold rounded-lg border border-slate-700 outline-none focus:border-amber-500 text-center" placeholder="Naziv" />
                                                <div className="flex items-center justify-between gap-2">
                                                    <input value={modul.ikona || ''} onChange={(e) => updateModul(modIndex, 'ikona', e.target.value)} className="w-12 p-1.5 bg-theme-main text-white text-xs font-bold rounded-lg border border-slate-700 outline-none focus:border-amber-500 text-center" placeholder="Ikona" />
                                                    <input type="color" value={modul.hex_boja || '#1e293b'} onChange={(e) => updateModul(modIndex, 'hex_boja', e.target.value)} className="flex-1 h-8 rounded cursor-pointer bg-transparent border border-slate-700" title="Boja kartice" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div 
                                                onClick={() => setActiveModule(modul.id)}
                                                className="p-5 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 hover:-translate-y-1 shadow-lg h-28 relative overflow-hidden group border border-white/10"
                                                style={{ backgroundColor: modul.hex_boja || '#1e293b' }}
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/50 pointer-events-none"></div>
                                                <div className="relative z-10 flex flex-col items-center gap-2">
                                                    <span className="text-2xl drop-shadow-xl">{modul.ikona}</span>
                                                    <h3 className="text-white font-black tracking-widest text-[10px] uppercase drop-shadow-md text-center leading-tight">{modul.naziv}</h3>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            default:
                return <div className="text-slate-500 text-xs text-center p-4">Nepoznat widget format.</div>;
        }
    };

    // 🟢 MENI SADA PRATI TAČAN REDOSLIJED I ŠIRINE KOJE ADMIN SPASI (iznad early return-a zbog React Rules of Hooks)
    const finalniModuliZaMeni = useMemo(() => (
        (uiPostavke.moduli && uiPostavke.moduli.length > 0)
            ? uiPostavke.moduli.map(m => {
                const def = defaultModuli.find(d => d.id === m.id) || {};
                return { ...def, ...m };
            })
            : defaultModuli
    ), [uiPostavke.moduli]);

    const stableMenuConfig = useMemo(() => uiPostavke.menu_style || {}, [uiPostavke.menu_style]);

    if (authLoading) return <div className="min-h-screen bg-theme-main" />;
    if (!loggedUser) {
        return (
            <div className="min-h-screen bg-theme-main flex items-center justify-center p-6 font-bold relative z-50">
                <Toaster richColors closeButton position="top-right" />
                <form onSubmit={handleLogin} className="w-full max-w-sm bg-theme-card p-10 rounded-[2rem] border border-slate-700 shadow-2xl space-y-6">
                    <div className="text-center mb-8 flex flex-col items-center justify-center gap-3">
                        {loginLogoUrl && (
                            <img src={loginLogoUrl} alt="ERP Logo" className="max-h-24 max-w-[220px] object-contain mb-2 drop-shadow-xl" crossOrigin="anonymous" />
                        )}
                        {(uiPostavke.login_naslov_1 || uiPostavke.login_naslov_2) && (
                            <h1 className="text-4xl font-black text-theme-text tracking-tighter">
                                {uiPostavke.login_naslov_1}<span style={{ color: uiPostavke.login_boja_akcenta || '#3b82f6' }}>{uiPostavke.login_naslov_2}</span>
                            </h1>
                        )}
                    </div>
                    {loginError && (
                        <div role="alert" className="p-3.5 rounded-2xl bg-red-950/60 border border-red-500/60 text-red-200 text-xs font-bold text-center">
                            ⚠️ {loginError}
                        </div>
                    )}
                    <div className="space-y-4">
                        <input name="user" autoComplete="username" onChange={() => loginError && setLoginError('')} placeholder={uiPostavke.login_user_label || "Username"} required className="w-full p-4 bg-theme-main border border-theme-border rounded-2xl text-theme-text outline-none text-center focus:border-blue-500 transition-colors" />
                        <input name="pass" type="password" autoComplete="current-password" onChange={() => loginError && setLoginError('')} placeholder={uiPostavke.login_pass_label || "Password"} required className="w-full p-4 bg-theme-main border border-theme-border rounded-2xl text-theme-text outline-none text-center focus:border-blue-500 transition-colors" />
                        <button type="submit" disabled={loginBusy} style={{ backgroundColor: uiPostavke.login_boja_akcenta || '#2563eb' }} className="w-full py-5 text-white font-black rounded-2xl uppercase shadow-lg hover:opacity-90 transition-all disabled:opacity-60">
                            {loginBusy ? '⏳ Provjeravam...' : (uiPostavke.login_btn_tekst || "Pristupi sistemu")}
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    const aktivniModulKonfig = (uiPostavke.moduli || []).find(m => m.id === activeModule);
    const modulBoja = aktivniModulKonfig?.hex_boja || '';

    const handleSaveMenuFromShell = async (noviModuli, noviMenuStyle) => {
        const novePostavke = { ...uiPostavke, moduli: noviModuli, menu_style: noviMenuStyle };
        setUiPostavke(novePostavke);
        try { localStorage.setItem('erp_dashboard_ui_backup', JSON.stringify(novePostavke)); } catch (e) {}
        const { error } = await supabase
            .from('ui_postavke')
            .upsert([{ modul_ime: 'dashboard', postavke_jsonb: novePostavke }], { onConflict: 'modul_ime' });
        if (error) {
            toast.error("Greška pri snimanju u bazu: " + error.message);
            return false;
        }
        return true;
    };

    return (
        <AppShell 
            user={loggedUser} 
            activeModule={activeModule} 
            onModuleChange={setActiveModule} 
            accentColor={modulBoja} 
            dynamicModules={finalniModuliZaMeni}
            menuConfig={stableMenuConfig}
            onSaveMenuConfig={handleSaveMenuFromShell}
        >
            <PametniDialog {...dialog} />
            
            {/* ACTION HUB / KONTEKSTNI MENI MODAL */}
            {kontekstniMeni && (
                <div className="erp-modal-backdrop fixed inset-0 z-[99999] bg-slate-950/75 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-theme-card border-2 border-theme-accent p-6 md:p-8 rounded-[2rem] shadow-[0_0_50px_rgba(var(--theme-accent-rgb),0.3)] max-w-sm w-full relative">
                        <button onClick={() => setKontekstniMeni(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 w-8 h-8 rounded-full flex items-center justify-center transition-colors">✕</button>
                        <h3 className="text-theme-accent font-black uppercase text-[10px] tracking-widest mb-1">{kontekstniMeni.title}</h3>
                        <p className="text-2xl text-white font-black">{kontekstniMeni.id}</p>
                        <p className="text-xs text-slate-400 font-bold mb-6">{kontekstniMeni.subtitle}</p>

                        <div className="space-y-3">
                            {kontekstniMeni.actions.map(akcija => {
                                if (!hasPermission(akcija.module)) return null;
                                return (
                                    <button 
                                        key={akcija.module} 
                                        onClick={() => handleDeepLink(akcija.module, kontekstniMeni.id, akcija.action)} 
                                        className="w-full py-4 bg-theme-panel hover:bg-theme-accent hover:text-white border border-slate-700 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 shadow-sm"
                                    >
                                        {akcija.label}
                                    </button>
                                );
                            })}
                            <button onClick={async () => { try { await navigator.clipboard.writeText(kontekstniMeni.id); toast.success("ID kopiran u međuspremnik!"); } catch (e) { toast.info(`ID: ${kontekstniMeni.id}`); } setKontekstniMeni(null); }} className="w-full py-3 bg-transparent text-theme-muted hover:text-theme-text rounded-xl text-[10px] font-black uppercase transition-all mt-2">📋 Kopiraj ID</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="w-full min-h-full transition-colors duration-700 font-sans">
                {activeModule === 'home' ? (
                    <div className="p-4 md:p-8 selection:bg-emerald-500/30 w-full animate-in fade-in">
                        <div className="max-w-7xl mx-auto space-y-6">
                            
                            <div className={`border border-theme-border p-6 md:p-8 rounded-[var(--radius-box)] flex flex-col md:flex-row gap-4 justify-between items-center shadow-2xl transition-colors duration-500 bg-theme-card backdrop-blur-[var(--glass-blur)] ${isEditMode ? 'ring-4 ring-amber-500' : ''}`}>
                                <div className="w-full md:flex-1 text-center md:text-left">
                                    {isEditMode ? (
                                        <div className="flex flex-col gap-3 w-full">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[8px] text-amber-500 uppercase font-black block mb-1">Mali Naslov (Iznad pozdrava)</label>
                                                    <input value={uiPostavke.glavni_naslov} onChange={e => setUiPostavke({...uiPostavke, glavni_naslov: e.target.value})} className="bg-black/40 text-blue-400 text-xs uppercase font-black tracking-widest p-2.5 rounded-lg outline-none w-full border border-slate-700 focus:border-amber-500" />
                                                </div>
                                                <div>
                                                    <label className="text-[8px] text-amber-500 uppercase font-black block mb-1">Pozdravna Poruka</label>
                                                    <input value={uiPostavke.pozdravna_poruka} onChange={e => setUiPostavke({...uiPostavke, pozdravna_poruka: e.target.value})} className="bg-black/40 text-slate-300 text-xs p-2.5 rounded-lg outline-none w-full border border-slate-700 focus:border-amber-500" />
                                                </div>
                                            </div>
                                            <div className="border-t border-amber-500/30 pt-3 mt-1">
                                                <label className="text-[9px] text-amber-400 uppercase font-black block mb-2">🔐 Postavke Login Ekrana (Pristup Sistemu)</label>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 items-end">
                                                    <div>
                                                        <label className="text-[8px] text-slate-400 uppercase block mb-1">Naziv 1 (Bijelo)</label>
                                                        <input value={uiPostavke.login_naslov_1 ?? ''} onChange={e => setUiPostavke({...uiPostavke, login_naslov_1: e.target.value})} placeholder="Smart" className="bg-black/40 text-white text-xs font-black p-2 rounded-lg outline-none w-full border border-slate-700 focus:border-amber-500" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] text-slate-400 uppercase block mb-1">Naziv 2 (U boji)</label>
                                                        <input value={uiPostavke.login_naslov_2 ?? ''} onChange={e => setUiPostavke({...uiPostavke, login_naslov_2: e.target.value})} placeholder="Timber" className="bg-black/40 text-blue-400 text-xs font-black p-2 rounded-lg outline-none w-full border border-slate-700 focus:border-amber-500" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] text-slate-400 uppercase block mb-1">Polje Korisnik</label>
                                                        <input value={uiPostavke.login_user_label || ''} onChange={e => setUiPostavke({...uiPostavke, login_user_label: e.target.value})} className="bg-black/40 text-slate-200 text-xs p-2 rounded-lg outline-none w-full border border-slate-700 focus:border-amber-500" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] text-slate-400 uppercase block mb-1">Polje Šifra</label>
                                                        <input value={uiPostavke.login_pass_label || ''} onChange={e => setUiPostavke({...uiPostavke, login_pass_label: e.target.value})} className="bg-black/40 text-slate-200 text-xs p-2 rounded-lg outline-none w-full border border-slate-700 focus:border-amber-500" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] text-slate-400 uppercase block mb-1">Tekst Dugmeta</label>
                                                        <input value={uiPostavke.login_btn_tekst || ''} onChange={e => setUiPostavke({...uiPostavke, login_btn_tekst: e.target.value})} className="bg-black/40 text-slate-200 text-xs p-2 rounded-lg outline-none w-full border border-slate-700 focus:border-amber-500" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] text-slate-400 uppercase block mb-1">Boja Login-a</label>
                                                        <input type="color" value={uiPostavke.login_boja_akcenta || '#2563eb'} onChange={e => setUiPostavke({...uiPostavke, login_boja_akcenta: e.target.value})} className="w-full h-8 rounded cursor-pointer bg-transparent border border-slate-700" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-theme-muted text-[10px] uppercase font-black tracking-widest mb-1">{uiPostavke.glavni_naslov}</p>
                                            <h1 className="text-3xl md:text-4xl text-theme-text font-black">Zdravo, {loggedUser?.ime_prezime || 'Korisnik'}</h1>
                                            <p className="text-theme-muted text-sm mt-2">{uiPostavke.pozdravna_poruka}</p>
                                        </>
                                    )}
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3 items-center w-full md:w-auto justify-end shrink-0">
                                    <div className="bg-theme-panel border border-theme-border px-4 py-2 rounded-xl text-center md:text-right hidden md:block shadow-inner">
                                        <p className="text-[10px] uppercase font-black text-slate-500">Današnji Datum</p>
                                        <p className="text-theme-text font-black text-sm">{new Date().toLocaleDateString('bs-BA')}</p>
                                    </div>
                                    {(loggedUser?.uloga === 'superadmin' || loggedUser?.uloga === 'admin') && (
                                        isEditMode ? (
                                            <div className="flex gap-2 w-full sm:w-auto">
                                                <button onClick={odustaniOdEdita} className="flex-1 px-4 py-3 rounded-xl bg-red-900/30 text-red-400 font-black text-[10px] uppercase hover:bg-red-500 hover:text-white transition-all shadow-lg border border-red-500/30">✕ ODUSTANI</button>
                                                <button onClick={spasiDizajn} className="flex-[2] px-6 py-3 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase hover:bg-emerald-500 transition-all shadow-[0_0_20px_rgba(16,185,129,0.5)]">💾 SPASI EKRAN</button>
                                            </div>
                                        ) : (
                                            <button onClick={pokreniEdit} className="w-full sm:w-auto px-4 py-3 rounded-xl bg-amber-500/10 text-amber-500 font-black text-[10px] uppercase border border-amber-500/30 hover:bg-amber-500 hover:text-white transition-all shadow-lg">✏️ UREDI EKRAN</button>
                                        )
                                    )}
                                </div>
                            </div>

                            {!isEditMode && (
                                <JutarnjiBrifingCard user={loggedUser} onNavigateModule={setActiveModule} />
                            )}

                            {isEditMode && (
                               <div className="bg-amber-950/20 border-2 border-amber-600 p-4 sm:p-6 rounded-[2rem] shadow-2xl space-y-4">
                               <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-amber-500/30 pb-4 gap-3">
                                   <h3 className="text-amber-700 dark:text-amber-400 font-black uppercase text-xs">🛠️ Enterprise Dashboard Builder</h3>
                                   <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto min-w-0">
                                       <select id="newWidgetSelect" className="flex-1 min-w-0 w-full sm:w-auto bg-theme-panel text-theme-text p-2.5 rounded-lg text-[10px] font-black uppercase outline-none border border-amber-600 cursor-pointer truncate">
                                           <option value="">-- Odaberi novi Widget --</option>
                                           {DOSTUPNI_WIDGETI.map(w => <option key={w.type} value={w.type}>{w.name}</option>)}
                                       </select>
                                       <button onClick={() => { const sel = (document.getElementById('newWidgetSelect') as HTMLSelectElement)?.value; if(sel) addWidget(sel); }} className="shrink-0 bg-amber-600 text-white px-4 py-2.5 rounded-lg text-[10px] font-black uppercase shadow-lg hover:bg-amber-500 transition-colors">➕ DODAJ</button>
                                   </div>
                               </div>
                               <p className="text-[10px] text-slate-900 dark:text-amber-300 bg-amber-500/20 py-2 px-3 rounded-xl font-black uppercase tracking-widest text-center border border-amber-500/40">Prevucite blokove (☰) ispod da biste im promijenili redoslijed na ekranu.</p>
                           </div>
                            )}

                            <div className="grid grid-cols-12 gap-6 relative z-10 items-stretch">
                                {(uiPostavke.widget_layout || []).map((widget, index) => {
                                    if (!isEditMode && loggedUser.uloga !== 'superadmin' && loggedUser.uloga !== 'admin') {
                                        if (!widget.allowedRoles?.includes(loggedUser.uloga)) return null;
                                    }

                                    const content = renderWidgetContent(widget, index);
                                    if (!content && !isEditMode) return null;

                                    return (
                                        <div 
                                            key={widget.id} 
                                            className={`${widget.span} relative flex flex-col h-full min-h-[150px] transition-all duration-300 ${isEditMode ? 'border-2 border-dashed border-amber-500 p-3 bg-black/20 rounded-[2rem]' : 'bg-theme-card rounded-[2rem] border border-theme-border shadow-xl overflow-hidden'} ${isDraggingWidget && widgetDragItem.current === index ? 'opacity-40 scale-95' : ''}`}
                                            draggable={isEditMode}
                                            onDragStart={(e) => handleWidgetDragStart(e, index)}
                                            onDragEnter={(e) => handleWidgetDragEnter(e, index)}
                                            onDragEnd={handleWidgetDrop}
                                            onDragOver={(e) => e.preventDefault()}
                                        >
                                            {isEditMode && (
                                                <div className="absolute top-2 right-2 left-2 flex flex-col sm:flex-row justify-between sm:items-center gap-2 z-[100] bg-black/80 p-2 sm:p-3 rounded-xl backdrop-blur-md border border-amber-500/50 shadow-xl">
                                                    <span className="text-[10px] text-amber-500 font-black cursor-grab active:cursor-grabbing flex items-center gap-1 uppercase tracking-widest px-2 py-1 hover:bg-amber-900/50 rounded transition-colors self-start sm:self-auto">
                                                        <Move size={12}/> Pomicaj
                                                    </span>
                                                    
                                                    <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center justify-between w-full sm:w-auto">
                                                        <div className="flex items-center gap-1 sm:gap-2 sm:border-r border-slate-700 sm:pr-3 sm:mr-1 flex-1 sm:flex-none justify-center">
                                                            <span className="text-[8px] text-slate-400 uppercase font-black hidden sm:block"><Eye size={10} className="inline mr-1"/> Vide:</span>
                                                            {['superadmin', 'admin', 'manager', 'operater'].map(uloga => (
                                                                <label key={uloga} className="flex items-center gap-1 text-[7px] sm:text-[8px] text-slate-300 font-bold cursor-pointer hover:text-white transition-colors">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={(widget.allowedRoles || []).includes(uloga) || uloga === 'superadmin' || uloga === 'admin'} 
                                                                        onChange={() => toggleWidgetRole(index, uloga)} 
                                                                        className="w-2.5 h-2.5 sm:w-3 sm:h-3 accent-amber-500" 
                                                                        disabled={uloga === 'superadmin' || uloga === 'admin'} 
                                                                    />
                                                                    {uloga.substring(0,3).toUpperCase()}
                                                                </label>
                                                            ))}
                                                        </div>
                                                        
                                                        <div className="flex gap-1.5 items-center shrink-0">
                                                            <button onClick={() => updateWidgetSpan(index)} className="bg-theme-panel text-amber-400 px-2 sm:px-3 py-1.5 rounded text-[7px] sm:text-[8px] font-black uppercase border border-amber-500/50 hover:bg-amber-500 hover:text-black transition-colors shadow-sm">
                                                                ŠIRINA: {widget.span.includes('col-span-4') ? '1/3' : (widget.span.includes('col-span-6') ? '1/2' : 'FULL')}
                                                            </button>
                                                            <button onClick={() => deleteWidget(index)} className="bg-red-900/50 text-red-500 w-6 h-6 sm:w-7 sm:h-7 rounded flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors border border-red-500/30">
                                                                <X size={12}/>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div className={`flex-1 h-full w-full relative ${isEditMode ? (widget.type === 'brzi_moduli' ? 'mt-14 pt-2' : 'mt-12 pointer-events-none opacity-50') : 'p-6'}`}>
                                                {content}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : activeModule === 'prijem' ? <PrijemModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('home')} />
                : activeModule === 'prorez' ? <ProrezModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('home')} />
                : activeModule === 'pilana' ? <PilanaModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('home')} />
                : activeModule === 'dorada' ? <DoradaModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('home')} />
                : activeModule === 'planiranje' ? <PlaniranjeModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('home')} />
                : activeModule === 'lager' ? <LagerPaketaModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('home')} />
                : activeModule === 'ponude' ? <PonudeModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('home')} />
                : activeModule === 'radni_nalozi' ? <RadniNaloziModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('home')} />
                : activeModule === 'otpremnice' ? <OtpremniceModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('home')} />
                : activeModule === 'racuni' ? <RacuniModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('home')} />
                : activeModule === 'blagajna' ? <BlagajnaModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('home')} />
                : activeModule === 'toranj' ? <KontrolniToranjModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('home')} />
                : (activeModule === 'analitika' || activeModule === 'dashboard') ? <AnalitikaModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('home')} />
                : activeModule === 'kiosk' ? <KioskModule />
                : activeModule === 'hr' ? <HrDashboardModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('home')} />
                : activeModule === 'reklamacije' ? <ReklamacijeModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('home')} />
                : activeModule === 'podesavanja' ? <SettingsModule user={loggedUser} onExit={() => setActiveModule('home')} />
                : activeModule === 'nadzor' && loggedUser?.uloga === 'superadmin' ? <NadzorModule user={loggedUser} header={header} setHeader={setHeader} onExit={() => setActiveModule('home')} />
                : null}
            </div>
        </AppShell>
    );
}