"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Settings, Menu, X, User, MonitorSmartphone, Sun, Crown, Palette, Cpu, AlignJustify, LogOut, Move, Eye, EyeOff, Save, Sliders, Bell } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Toaster, toast } from 'sonner';
import { supabase } from '../utils/supabaseClient';
import PametniDialog from './PametniDialog';
import NotificationDetailModal from './NotificationDetailModal';
import {
    MODUL_META,
    odrediModuleNotifikacije,
    getNazivModula,
    ocistiTekstDetalja,
    daLiJeNotifikacijaZaKorisnika,
    daLiJeLicnaNotifikacijaZaKorisnika,
    daLiJeProcitanoZaKorisnika,
    ucitajNotifikacijeZaKorisnika,
    oznaciNotifikacijuProcitanom,
    oznaciNotifikacijeProcitanim,
} from '../utils/notificationHelpers';

const DEFAULT_MENU_STYLE = {
    sidebarWidth: 260,
    btnHeight: 'normal',
    fontSize: 11,
    iconSize: 18
};

export default function AppShell({
    children,
    user,
    activeModule = "home",
    onModuleChange,
    accentColor,
    dynamicModules = [],
    menuConfig = {},
    onSaveMenuConfig
}) {
    const { theme: storeTheme, layout: storeLayout, initSettings, setTheme, setLayout } = useAppStore();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [appBranding, setAppBranding] = useState({ name: 'SmartERP', logo: '' });

    const [isLoaded, setIsLoaded] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true));
    const [logoutDialog, setLogoutDialog] = useState(false);

    // 🔔 Lični centar obavještenja za svakog prijavljenog korisnika (strogo izolovano po korisniku)
    const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);
    const [notifTab, setNotifTab] = useState('AKTIVNA'); // 'AKTIVNA' | 'ARHIVA'
    const [mojeNotifikacije, setMojeNotifikacije] = useState([]);
    const [brojMojeNotif, setBrojMojeNotif] = useState(0);
    const [selectedNotif, setSelectedNotif] = useState(null);
    const seenToastIdsRef = useRef(new Set());
    const initialNotifLoadedRef = useRef(false);

    // State za uređivanje menija sa backup snapshotom (da Odustani zaista vrati prethodno stanje)
    const [isMenuEditMode, setIsMenuEditMode] = useState(false);
    const [editableModules, setEditableModules] = useState([]);
    const [menuStyle, setMenuStyle] = useState(DEFAULT_MENU_STYLE);
    const backupModulesRef = useRef(null);
    const backupMenuStyleRef = useRef(null);

    const dragMenuIdx = useRef(null);
    const dragOverMenuIdx = useRef(null);

    const isAdmin = user?.uloga === 'superadmin' || user?.uloga === 'admin';
    const localLayout = storeLayout || 'sidebar';
    const localTheme = storeTheme || 'industrial';

    useEffect(() => {
        if (!isMenuEditMode) {
            setEditableModules((dynamicModules || []).map(m => ({ ...m })));
        }
    }, [dynamicModules, isMenuEditMode]);

    useEffect(() => {
        if (isMenuEditMode) return;
        if (menuConfig && Object.keys(menuConfig).length > 0) {
            setMenuStyle(prev => ({ ...prev, ...menuConfig }));
        } else if (typeof window !== 'undefined') {
            const savedMenuStyle = localStorage.getItem('erp_menu_style');
            if (savedMenuStyle) {
                try { setMenuStyle(prev => ({ ...prev, ...JSON.parse(savedMenuStyle) })); } catch (e) {}
            }
        }
    }, [menuConfig, isMenuEditMode]);

    useEffect(() => {
        const fetchGlobalBranding = async () => {
            let nameToUse = localStorage.getItem('saas_app_name') || 'SmartERP';
            let logoToUse = localStorage.getItem('saas_app_logo') || '';

            try {
                const { data: bData } = await supabase.from('brending').select('*');
                if (bData && bData.length > 0) {
                    const logoObj = bData.find(b => (b.lokacije_jsonb || []).includes('GLAVNI MENI / SIDEBAR (GORE LIJEVO)'))
                        || bData.find(b => (b.lokacije_jsonb || []).includes('Glavni Meni (Dashboard Vrh)'));

                    if (logoObj && logoObj.url_slike) {
                        logoToUse = logoObj.url_slike;
                        localStorage.setItem('saas_app_logo', logoToUse);
                    } else {
                        logoToUse = '';
                        localStorage.removeItem('saas_app_logo');
                    }
                } else {
                    logoToUse = '';
                    localStorage.removeItem('saas_app_logo');
                }
                const { data: fData } = await supabase.from('postavke_firme').select('*').eq('id', 1).maybeSingle();
                if (fData && fData.app_name) {
                    nameToUse = fData.app_name;
                    localStorage.setItem('saas_app_name', nameToUse);
                }
            } catch (e) {}

            setAppBranding({ name: nameToUse, logo: logoToUse });
        };

        fetchGlobalBranding();
        window.addEventListener('saas_updated', fetchGlobalBranding);
        setIsLoaded(true);

        return () => window.removeEventListener('saas_updated', fetchGlobalBranding);
    }, []);

    useEffect(() => {
        initSettings(user?.ime_prezime || 'Korisnik');
    }, [user, initSettings]);

    const prikaziInAppNotifikaciju = useCallback((novi) => {
        if (!novi || !novi.id || !daLiJeNotifikacijaZaKorisnika(novi, user)) return;
        if (seenToastIdsRef.current.has(novi.id)) return;
        seenToastIdsRef.current.add(novi.id);
        if (seenToastIdsRef.current.size > 150) {
            const first = seenToastIdsRef.current.values().next().value;
            seenToastIdsRef.current.delete(first);
        }

        if (typeof window !== 'undefined' && window.navigator?.vibrate) {
            window.navigator.vibrate([180, 90, 180]);
        }

        const tekst = ocistiTekstDetalja(novi.detalji);
        const jeLicno = daLiJeLicnaNotifikacijaZaKorisnika(novi, user);
        const toastOpts = {
            duration: novi.nivo_alarma === 'CRVENO' ? 8500 : 6500,
            action: {
                label: 'Otvori',
                onClick: () => setSelectedNotif(novi),
            },
        };

        if (novi.nivo_alarma === 'CRVENO') {
            toast.error(`🚨 ${novi.akcija}: ${tekst}`, toastOpts);
        } else if (novi.nivo_alarma === 'ŽUTO') {
            toast.warning(`⚠️ ${novi.akcija}: ${tekst}`, toastOpts);
        } else if (jeLicno) {
            toast.info(`🔔 ${novi.akcija}: ${tekst}`, toastOpts);
        }
    }, [user]);

    const ucitajMojeNotifikacije = useCallback(async ({ emitNewToasts = false } = {}) => {
        if (!user || (!user.ime_prezime && !user.username)) {
            setMojeNotifikacije([]);
            setBrojMojeNotif(0);
            return;
        }
        const neprocitane = await ucitajNotifikacijeZaKorisnika(user, null, { includeRead: false, limit: 50 });

        if (!initialNotifLoadedRef.current) {
            // Na prvom učitavanju zapamti postojeće ID-eve da prijava ne zatrpa ekran starim popupovima
            neprocitane.forEach((n) => { if (n?.id) seenToastIdsRef.current.add(n.id); });
            initialNotifLoadedRef.current = true;
        } else if (emitNewToasts) {
            const nove = neprocitane.filter((n) => n?.id && !seenToastIdsRef.current.has(n.id));
            if (nove.length > 0) {
                nove.slice(0, 3).forEach((n) => prikaziInAppNotifikaciju(n));
                window.dispatchEvent(new CustomEvent('notifikacije_updated'));
            }
        }

        setBrojMojeNotif(neprocitane.length);
        if (notifTab === 'ARHIVA') {
            const sve = await ucitajNotifikacijeZaKorisnika(user, null, { includeRead: true, limit: 50 });
            setMojeNotifikacije(sve);
        } else {
            setMojeNotifikacije(neprocitane);
        }
    }, [user, notifTab, prikaziInAppNotifikaciju]);

    // Resetuj praćenje kad se promijeni prijavljeni korisnik
    useEffect(() => {
        seenToastIdsRef.current = new Set();
        initialNotifLoadedRef.current = false;
    }, [user?.id, user?.username, user?.ime_prezime]);

    // 🔔 JEDAN globalni Realtime + pouzdani pozadinski sync za trenutno prijavljenog korisnika
    useEffect(() => {
        if (!user || (!user.ime_prezime && !user.username)) return;

        ucitajMojeNotifikacije({ emitNewToasts: false });

        const kanalIme = `user_notif_global_${Math.random().toString(36).substring(2)}`;
        const channel = supabase.channel(kanalIme)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sistem_audit_log' }, (payload) => {
                const novi = payload?.new;
                if (!novi || !daLiJeNotifikacijaZaKorisnika(novi, user)) return;
                prikaziInAppNotifikaciju(novi);
                ucitajMojeNotifikacije({ emitNewToasts: false });
                window.dispatchEvent(new CustomEvent('notifikacije_updated'));
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sistem_audit_log' }, () => {
                ucitajMojeNotifikacije({ emitNewToasts: false });
            })
            .subscribe();

        // Pouzdani fallback sync svakih 5s dok je tab aktivan (radi i ako Supabase Realtime publication nije uključen ili pukne WiFi)
        const intervalId = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
            ucitajMojeNotifikacije({ emitNewToasts: true });
        }, 5000);

        const handleSync = () => ucitajMojeNotifikacije({ emitNewToasts: false });
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') ucitajMojeNotifikacije({ emitNewToasts: true });
        };
        window.addEventListener('notifikacije_updated', handleSync);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearInterval(intervalId);
            supabase.removeChannel(channel);
            window.removeEventListener('notifikacije_updated', handleSync);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [user, ucitajMojeNotifikacije, prikaziInAppNotifikaciju]);

    const handleMarkOneRead = async (notif, e) => {
        if (e) e.stopPropagation();
        const { error } = await oznaciNotifikacijuProcitanom(notif, user);
        if (error) return toast.error('Greška pri označavanju obavještenja.');
        ucitajMojeNotifikacije();
    };

    const handleMarkAllRead = async () => {
        const neprocitane = mojeNotifikacije.filter((n) => !daLiJeProcitanoZaKorisnika(n, user));
        if (neprocitane.length === 0) return;
        const { error } = await oznaciNotifikacijeProcitanim(neprocitane, user);
        if (error) return toast.error('Greška pri označavanju obavještenja.');
        toast.success('Sva vaša obavještenja su označena kao pročitana.');
        ucitajMojeNotifikacije();
    };

    const changeLayout = (noviLayout) => {
        setLayout(noviLayout);
        toast.info(`Prikaz navigacije promijenjen na: ${noviLayout.toUpperCase()}`);
    };

    const changeTheme = (novaTema) => {
        setTheme(novaTema);
        const nazivi = { industrial: 'Industrial Dark', aurora: 'Aurora Glass', light: 'Clinical Light', executive: 'Executive Gold' };
        toast.info(`Aktivna tema: ${nazivi[novaTema] || novaTema}`);
    };

    const handleLogout = () => {
        setLogoutDialog(true);
    };

    const potvrdiOdjavu = () => {
        try {
            const keysToClear = ['smart_timber_user', 'last_masina', 'last_loc', 'erp_auto_open_id', 'erp_auto_action'];
            keysToClear.forEach(k => localStorage.removeItem(k));
        } catch (e) {}
        window.location.reload();
    };

    useEffect(() => {
        const handlePopState = () => { if (activeModule !== 'home') onModuleChange('home'); };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [activeModule, onModuleChange]);

    useEffect(() => {
        if (activeModule !== 'home' && !window.history.state?.modulOtvoren) {
            window.history.pushState({ modulOtvoren: true }, '');
        }
    }, [activeModule]);

    const hasPermission = (item) => {
        if (!user) return false;
        const modulId = typeof item === 'string' ? item : item.id;
        const modulObj = typeof item === 'object' ? item : editableModules.find(m => m.id === modulId);

        if (modulObj?.hiddenInMenu && !isMenuEditMode) return false;
        if (modulId === 'nadzor') return user.uloga === 'superadmin';
        if (user.uloga === 'superadmin' || user.uloga === 'admin') return true;
        if (modulId === 'home') return true;

        if (modulObj?.allowedRoles && Array.isArray(modulObj.allowedRoles)) {
            if (!modulObj.allowedRoles.includes(user.uloga)) return false;
        }

        const radnikDozvole = Array.isArray(user.dozvole) ? user.dozvole : [];
        if (modulId === 'planiranje') {
            return radnikDozvole.includes('Planiranje Proizvodnje') || radnikDozvole.includes('Planiranje (Samo Pregled)');
        }

        const mapaDozvola = {
            'prijem': 'Prijem trupaca',
            'prorez': 'Prorez (Trupci)',
            'pilana': 'Pilana (Izlaz)',
            'dorada': 'Dorada (Ulaz/Izlaz)',
            'lager': 'Lager Paketa',
            'ponude': 'Ponude',
            'radni_nalozi': 'Radni Nalozi',
            'otpremnice': 'Otpremnice i Izdatnice',
            'racuni': 'Računi',
            'blagajna': 'Blagajna (Keš)',
            'toranj': 'Kontrolni Toranj',
            'analitika': 'Analitika',
            'podesavanja': 'Podešavanja',
            'kiosk': 'Prijava na Rad',
            'hr': 'HR Dashboard',
            'reklamacije': 'Reklamacije i Povrati'
        };

        return radnikDozvole.includes(mapaDozvola[modulId]);
    };

    const pokreniUredjivanjeMenija = () => {
        backupModulesRef.current = JSON.parse(JSON.stringify(editableModules));
        backupMenuStyleRef.current = JSON.parse(JSON.stringify(menuStyle));
        setIsMenuEditMode(true);
    };

    const odustaniOdUredjivanjaMenija = () => {
        if (backupModulesRef.current) setEditableModules(backupModulesRef.current);
        if (backupMenuStyleRef.current) setMenuStyle(backupMenuStyleRef.current);
        backupModulesRef.current = null;
        backupMenuStyleRef.current = null;
        setIsMenuEditMode(false);
        toast.info("Izmjene menija su poništene.");
    };

    const handleMenuDragStart = (index) => { dragMenuIdx.current = index; };
    const handleMenuDragEnter = (index) => { dragOverMenuIdx.current = index; };
    const handleMenuDrop = (e) => {
        if (e) e.preventDefault();
        const fromIdx = dragMenuIdx.current;
        const toIdx = dragOverMenuIdx.current;
        dragMenuIdx.current = null;
        dragOverMenuIdx.current = null;
        if (fromIdx === null || toIdx === null || fromIdx === toIdx) return;

        setEditableModules(prev => {
            const copy = prev.map(item => ({ ...item }));
            const [moved] = copy.splice(fromIdx, 1);
            if (!moved) return prev;
            copy.splice(toIdx, 0, moved);
            return copy;
        });
    };
    const handleMenuDragEnd = () => {
        dragMenuIdx.current = null;
        dragOverMenuIdx.current = null;
    };

    const toggleMenuSpan = (modulId, e) => {
        e.stopPropagation();
        setEditableModules(prev => prev.map(item => {
            if (item.id !== modulId) return item;
            const curr = item.menuSpan || 'col-span-6';
            const next = curr === 'col-span-6' ? 'col-span-3' : (curr === 'col-span-3' ? 'col-span-2' : 'col-span-6');
            return { ...item, menuSpan: next };
        }));
    };

    const toggleMenuHidden = (modulId, e) => {
        e.stopPropagation();
        setEditableModules(prev => prev.map(item => (
            item.id === modulId ? { ...item, hiddenInMenu: !item.hiddenInMenu } : item
        )));
    };

    const spasiIzmjeneMenija = async () => {
        try {
            localStorage.setItem('erp_menu_style', JSON.stringify(menuStyle));
        } catch (e) {}

        if (onSaveMenuConfig) {
            const result = await onSaveMenuConfig(editableModules, menuStyle);
            if (result === false) return;
        }
        backupModulesRef.current = null;
        backupMenuStyleRef.current = null;
        setIsMenuEditMode(false);
        toast.success("Izgled i redoslijed menija su uspješno sačuvani!");
    };

    const renderIcon = (ikona, size = 18) => {
        if (ikona === 'LayoutDashboard') return <LayoutDashboard size={size} />;
        if (ikona === 'Settings') return <Settings size={size} />;
        return <span style={{ fontSize: `${size}px`, lineHeight: 1 }}>{ikona}</span>;
    };

    // U edit modu i dalje poštuje superadmin ograničenje za 'nadzor'
    const visibleMenuItems = isMenuEditMode
        ? editableModules.filter(item => item.id !== 'nadzor' || user?.uloga === 'superadmin')
        : editableModules.filter(item => hasPermission(item));

    const getPaddingClass = () => {
        if (menuStyle.btnHeight === 'compact') return 'py-2 px-2.5';
        if (menuStyle.btnHeight === 'large') return 'py-5 px-4';
        return 'py-3.5 px-3.5';
    };

    const renderLogoDisplay = (mobile = false, collapsed = false) => (
        <div className={`flex items-center gap-3 ${mobile ? 'flex-shrink-0' : (collapsed ? 'mb-6 px-0 mt-2 justify-center w-full' : 'mb-6 px-2 mt-2')}`}>
            {appBranding.logo ? (
                <img src={appBranding.logo} alt="ERP Logo" className={`${mobile ? 'h-7' : (collapsed ? 'h-6' : 'h-11')} object-contain transition-all`} crossOrigin="anonymous" />
            ) : (
                <>
                    <div className={`${mobile ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-base'} rounded-lg bg-theme-accent flex items-center justify-center font-black text-white shrink-0`}>
                        {appBranding.name.charAt(0).toUpperCase()}
                    </div>
                    {!collapsed && (
                        <h1 className={`${mobile ? 'text-xs hidden sm:block' : 'text-xl'} font-black tracking-widest text-theme-text whitespace-nowrap overflow-hidden`}>
                            {appBranding.name}
                        </h1>
                    )}
                </>
            )}
        </div>
    );

    const renderMenuContent = (isMobile = false) => {
        const isCollapsed = !isSidebarOpen && localLayout === 'sidebar' && !isMobile;
        const padClass = getPaddingClass();

        return (
            <div className={isCollapsed ? "flex flex-col gap-2" : "grid grid-cols-6 gap-2"}>
                <button
                    type="button"
                    title={isCollapsed ? 'POČETNA' : ''}
                    onClick={() => { onModuleChange('home'); setMobileMenuOpen(false); }}
                    style={{ fontSize: `${menuStyle.fontSize}px` }}
                    className={`col-span-6 flex items-center gap-3 ${padClass} rounded-xl font-bold uppercase transition-all tracking-widest ${activeModule === 'home' ? 'bg-blue-600 text-white shadow-glow' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text'} ${isCollapsed ? 'justify-center px-0' : ''}`}
                >
                    <div className="shrink-0"><LayoutDashboard size={menuStyle.iconSize} /></div>
                    {!isCollapsed && <span className="truncate">POČETNA</span>}
                </button>

                {visibleMenuItems.map((item) => {
                    const realIdx = editableModules.findIndex(m => m.id === item.id);
                    const spanClass = isCollapsed ? 'col-span-6' : (item.menuSpan || 'col-span-6');
                    const isCompactTile = !isCollapsed && (spanClass === 'col-span-3' || spanClass === 'col-span-2');
                    const isThirdTile = !isCollapsed && spanClass === 'col-span-2';
                    const spanLabel = spanClass === 'col-span-6' ? '1/1' : (spanClass === 'col-span-3' ? '1/2' : '1/3');

                    if (isMenuEditMode && !isCollapsed) {
                        return (
                            <div
                                key={item.id}
                                draggable
                                onDragStart={() => handleMenuDragStart(realIdx)}
                                onDragEnter={() => handleMenuDragEnter(realIdx)}
                                onDrop={handleMenuDrop}
                                onDragEnd={handleMenuDragEnd}
                                onDragOver={(e) => e.preventDefault()}
                                className={`${spanClass} relative flex flex-col justify-between ${isThirdTile ? 'p-1.5 gap-1' : 'p-2 gap-1.5'} rounded-xl border-2 border-dashed ${item.hiddenInMenu ? 'border-red-500/50 bg-red-950/20 opacity-60' : 'border-amber-500 bg-theme-panel/80'} cursor-move select-none transition-all overflow-hidden min-w-0`}
                            >
                                <div className={`flex items-center justify-between gap-1 ${isThirdTile ? 'flex-wrap justify-center' : ''}`}>
                                    {!isThirdTile && <span className="text-[9px] text-amber-400 font-black flex items-center gap-0.5 shrink-0"><Move size={10} /></span>}
                                    <div className="flex items-center gap-1 min-w-0">
                                        <button
                                            type="button"
                                            onClick={(e) => toggleMenuSpan(item.id, e)}
                                            className="text-[8px] bg-amber-500/20 text-amber-400 border border-amber-500/40 px-1 py-0.5 rounded font-black hover:bg-amber-500 hover:text-black leading-none"
                                            title="Broj dugmadi u redu (1/1, 1/2, 1/3)"
                                        >
                                            {spanLabel}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => toggleMenuHidden(item.id, e)}
                                            className={`text-[8px] p-0.5 rounded font-black border leading-none ${item.hiddenInMenu ? 'bg-red-600 text-white border-red-400' : 'bg-theme-card text-theme-text border-theme-border'}`}
                                            title="Prikaži / Sakrij u meniju"
                                        >
                                            {item.hiddenInMenu ? <EyeOff size={10} /> : <Eye size={10} />}
                                        </button>
                                    </div>
                                </div>
                                <div className={`flex items-center gap-1 overflow-hidden min-w-0 ${isThirdTile ? 'flex-col text-center' : ''}`}>
                                    <div className="shrink-0">{renderIcon(item.ikona, isThirdTile ? 13 : 14)}</div>
                                    <span className={`${isThirdTile ? 'text-[8px] w-full text-center' : 'text-[9px]'} font-black text-theme-text uppercase truncate`}>{item.naziv}</span>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <button
                            type="button"
                            title={isCollapsed || isCompactTile ? item.naziv : ''}
                            key={item.id}
                            onClick={() => { onModuleChange(item.id); setMobileMenuOpen(false); }}
                            style={{
                                backgroundColor: activeModule === item.id ? (item.hex_boja || 'var(--theme-accent)') : '',
                                color: activeModule === item.id ? '#ffffff' : undefined,
                                fontSize: `${menuStyle.fontSize}px`
                            }}
                            className={`${spanClass} flex ${spanClass === 'col-span-2' ? 'flex-col justify-center text-center gap-1 px-1 py-2.5' : 'items-center gap-2.5 ' + padClass} rounded-xl font-bold uppercase transition-all tracking-wider overflow-hidden min-w-0 ${activeModule === item.id ? 'text-white shadow-glow' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text border border-transparent hover:border-theme-border/60'} ${isCollapsed ? 'justify-center px-0' : ''}`}
                        >
                            <div className="shrink-0">
                                {item.slika_url ? <img src={item.slika_url} className="w-5 h-5 object-contain" alt={item.naziv} /> : renderIcon(item.ikona, menuStyle.iconSize)}
                            </div>
                            {!isCollapsed && (
                                <span className={`truncate ${spanClass === 'col-span-2' ? 'text-[9px] w-full text-center' : ''}`}>
                                    {item.naziv}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        );
    };

    const renderNotifBellButton = (extraClass = '', iconSize = 18) => (
        <button
            type="button"
            data-testid="user-profile-bell"
            onClick={() => {
                setIsNotifDrawerOpen(true);
                setMobileMenuOpen(false);
                ucitajMojeNotifikacije();
            }}
            className={`relative flex items-center justify-center bg-theme-panel border border-theme-border rounded-xl text-theme-text hover:bg-theme-accent hover:text-white transition-all shadow-sm ${extraClass}`}
            title={`Moja obavještenja (${brojMojeNotif})`}
        >
            <Bell size={iconSize} />
            {brojMojeNotif > 0 && (
                <span data-testid="user-profile-bell-badge" className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full border-2 border-theme-card shadow-[0_0_8px_rgba(239,68,68,0.8)]">
                    {brojMojeNotif > 99 ? '99+' : brojMojeNotif}
                </span>
            )}
        </button>
    );

    const renderNotifDrawer = () => (
        <AnimatePresence>
            {isNotifDrawerOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsNotifDrawerOpen(false)}
                        className="erp-modal-backdrop fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[5050]"
                    />
                    <motion.div
                        data-testid="user-notif-drawer"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 50 }}
                        className="fixed top-0 right-0 h-full w-full max-w-[100vw] sm:w-[26rem] bg-theme-card border-l border-theme-border shadow-2xl z-[5060] p-4 sm:p-5 flex flex-col backdrop-blur-[var(--glass-blur)] overflow-x-hidden"
                    >
                        <div className="flex justify-between items-start gap-2 mb-4 border-b border-theme-border pb-4">
                            <div className="min-w-0">
                                <h2 className="text-sm font-black text-theme-text uppercase tracking-widest flex items-center gap-2">
                                    <Bell size={17} className="text-theme-accent shrink-0" />
                                    <span className="truncate">Moja Obavještenja ({brojMojeNotif})</span>
                                </h2>
                                <p className="text-[10px] text-theme-muted font-bold mt-1 truncate">
                                    Profil: {user?.ime_prezime || user?.username || 'Korisnik'} • Samo vaše notifikacije i odobrenja
                                </p>
                            </div>
                            <button type="button" onClick={() => setIsNotifDrawerOpen(false)} className="shrink-0 p-1 text-theme-muted hover:text-red-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="flex gap-1.5 flex-1">
                                <button
                                    type="button"
                                    onClick={() => setNotifTab('AKTIVNA')}
                                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-colors ${notifTab === 'AKTIVNA' ? 'bg-theme-accent text-white' : 'bg-theme-panel text-theme-muted border border-theme-border hover:text-theme-text'}`}
                                >
                                    Nepročitana ({brojMojeNotif})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNotifTab('ARHIVA')}
                                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-colors ${notifTab === 'ARHIVA' ? 'bg-theme-accent text-white' : 'bg-theme-panel text-theme-muted border border-theme-border hover:text-theme-text'}`}
                                >
                                    Historija
                                </button>
                            </div>
                            {brojMojeNotif > 0 && (
                                <button
                                    type="button"
                                    onClick={handleMarkAllRead}
                                    className="px-2.5 py-2 rounded-xl bg-theme-panel border border-theme-border text-[9px] font-black uppercase text-theme-muted hover:text-emerald-500 hover:border-emerald-500 transition-colors shrink-0"
                                >
                                    ✓ Sve
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                            {mojeNotifikacije.length === 0 ? (
                                <div className="p-10 text-center text-theme-muted text-[11px] font-black uppercase border-2 border-dashed border-theme-border rounded-2xl">
                                    Nemate novih obavještenja za vaš profil. ✅
                                </div>
                            ) : (
                                mojeNotifikacije.map((notif) => {
                                    const jeLicno = daLiJeLicnaNotifikacijaZaKorisnika(notif, user);
                                    const jeProcitano = daLiJeProcitanoZaKorisnika(notif, user);
                                    const modKeys = odrediModuleNotifikacije(notif);
                                    const modKey = modKeys[0];
                                    const borderTone = notif.nivo_alarma === 'CRVENO'
                                        ? 'border-l-red-500'
                                        : notif.nivo_alarma === 'ŽUTO'
                                            ? 'border-l-amber-500'
                                            : 'border-l-blue-500';

                                    return (
                                        <div
                                            key={notif.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => {
                                                setSelectedNotif(notif);
                                                setIsNotifDrawerOpen(false);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    setSelectedNotif(notif);
                                                    setIsNotifDrawerOpen(false);
                                                }
                                            }}
                                            className={`p-3.5 rounded-2xl bg-theme-panel border border-theme-border border-l-4 ${borderTone} hover:border-theme-accent transition-all cursor-pointer relative group ${jeProcitano ? 'opacity-70' : ''}`}
                                        >
                                            <div className="flex flex-wrap items-center gap-1.5 mb-1.5 pr-8">
                                                {jeLicno && (
                                                    <span className="text-[8px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                                                        🎯 Za mene
                                                    </span>
                                                )}
                                                {modKey && (
                                                    <span className="text-[8px] font-black uppercase bg-theme-card text-theme-accent border border-theme-border px-2 py-0.5 rounded-full">
                                                        {MODUL_META[modKey]?.ikona || '📌'} {getNazivModula(modKey)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex justify-between items-center gap-2 mb-1">
                                                <span className="text-[11px] font-black text-theme-text uppercase truncate">{notif.akcija}</span>
                                                <span className="text-[9px] text-theme-muted shrink-0">
                                                    {notif.vrijeme ? new Date(notif.vrijeme).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : ''}
                                                </span>
                                            </div>
                                            <p className="text-xs text-theme-muted leading-snug line-clamp-2">{ocistiTekstDetalja(notif.detalji)}</p>
                                            <div className="flex items-center justify-between mt-2 text-[9px] font-bold text-theme-muted">
                                                <span>👤 {notif.korisnik}</span>
                                                <span className="text-theme-accent font-black uppercase group-hover:underline">Detalji / Odobrenje →</span>
                                            </div>
                                            {!jeProcitano && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleMarkOneRead(notif, e)}
                                                    className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg bg-theme-card border border-theme-border text-theme-muted hover:text-emerald-500 hover:border-emerald-500 transition-colors"
                                                    title="Označi pročitano"
                                                >
                                                    ✓
                                                </button>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    const renderSettingsPanel = () => (
        <AnimatePresence>
            {isSettingsOpen && (
                <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} className="fixed top-0 right-0 h-full w-full max-w-[100vw] sm:w-96 bg-theme-card border-l border-theme-border shadow-2xl z-[5000] p-4 sm:p-6 flex flex-col backdrop-blur-[var(--glass-blur)] overflow-x-hidden">
                    <div className="flex justify-between items-center gap-2 mb-6 border-b border-theme-border pb-4">
                        <h2 className="text-sm sm:text-base font-black text-theme-text uppercase tracking-widest flex items-center gap-2 min-w-0 truncate"><Settings size={18} className="shrink-0" /> <span className="truncate">Postavke Ekrana</span></h2>
                        <button type="button" onClick={() => setIsSettingsOpen(false)} className="shrink-0 p-1 text-theme-muted hover:text-red-500 transition-colors"><X size={22} /></button>
                    </div>
                    <div className="space-y-6 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                        <div>
                            <h3 className="text-[10px] font-black text-theme-muted mb-3 uppercase tracking-widest">1. Tema / Boje</h3>
                            <div className="grid grid-cols-2 gap-2.5">
                                <button type="button" onClick={() => changeTheme('industrial')} className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${localTheme === 'industrial' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><Cpu size={20} /> <span className="text-[9px] font-black uppercase">Industrial</span></button>
                                <button type="button" onClick={() => changeTheme('aurora')} className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${localTheme === 'aurora' ? 'bg-purple-600 border-purple-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><Palette size={20} /> <span className="text-[9px] font-black uppercase">Aurora Glass</span></button>
                                <button type="button" onClick={() => changeTheme('light')} className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${localTheme === 'light' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><Sun size={20} /> <span className="text-[9px] font-black uppercase">Clinical Light</span></button>
                                <button type="button" onClick={() => changeTheme('executive')} className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${localTheme === 'executive' ? 'bg-amber-700 border-amber-500 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><Crown size={20} /> <span className="text-[9px] font-black uppercase">Executive Gold</span></button>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-[10px] font-black text-theme-muted mb-3 uppercase tracking-widest">2. Tip Navigacije (Layout)</h3>
                            <div className="grid grid-cols-2 gap-2.5">
                                <button type="button" onClick={() => changeLayout('sidebar')} className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${localLayout === 'sidebar' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><MonitorSmartphone size={20} /> <span className="text-[9px] font-black uppercase">Sidebar (Bočni)</span></button>
                                <button type="button" onClick={() => changeLayout('topnav')} className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${localLayout === 'topnav' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><AlignJustify size={20} /> <span className="text-[9px] font-black uppercase">Top Nav (Gornji)</span></button>
                                <button type="button" onClick={() => changeLayout('bento')} className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${localLayout === 'bento' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><Menu size={20} /> <span className="text-[9px] font-black uppercase text-center">Bento (Donji)</span></button>
                                <button type="button" onClick={() => changeLayout('kiosk')} className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${localLayout === 'kiosk' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><LayoutDashboard size={20} /> <span className="text-[9px] font-black uppercase">Kiosk</span></button>
                            </div>
                        </div>

                        <div className="border-t border-theme-border pt-5 space-y-4">
                            <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5"><Sliders size={14} /> 3. Dimenzije i Raspored Menija</h3>

                            <div>
                                <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                                    <span className="text-theme-muted">Širina Bočnog Menija:</span>
                                    <span className="text-theme-accent">{menuStyle.sidebarWidth} px</span>
                                </div>
                                <input type="range" min="210" max="380" step="10" value={menuStyle.sidebarWidth} onChange={e => setMenuStyle({ ...menuStyle, sidebarWidth: parseInt(e.target.value) })} className="w-full accent-amber-500 cursor-pointer" />
                            </div>

                            <div>
                                <span className="text-[10px] text-theme-muted font-black uppercase block mb-2">Visina Dugmadi u Meniju:</span>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'compact', label: 'Kompaktno' },
                                        { id: 'normal', label: 'Standard' },
                                        { id: 'large', label: 'Veliko' }
                                    ].map(h => (
                                        <button type="button" key={h.id} onClick={() => setMenuStyle({ ...menuStyle, btnHeight: h.id })} className={`py-2 rounded-xl text-[9px] font-black uppercase border ${menuStyle.btnHeight === h.id ? 'bg-amber-600 text-white border-amber-400' : 'bg-theme-panel text-theme-muted border-theme-border'}`}>
                                            {h.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] text-theme-muted font-black uppercase block mb-1">Slova ({menuStyle.fontSize}px)</label>
                                    <input type="range" min="9" max="15" value={menuStyle.fontSize} onChange={e => setMenuStyle({ ...menuStyle, fontSize: parseInt(e.target.value) })} className="w-full accent-amber-500 cursor-pointer" />
                                </div>
                                <div>
                                    <label className="text-[9px] text-theme-muted font-black uppercase block mb-1">Ikone ({menuStyle.iconSize}px)</label>
                                    <input type="range" min="14" max="26" value={menuStyle.iconSize} onChange={e => setMenuStyle({ ...menuStyle, iconSize: parseInt(e.target.value) })} className="w-full accent-amber-500 cursor-pointer" />
                                </div>
                            </div>

                            {isAdmin && (
                                <div className="pt-2 space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (isMenuEditMode) odustaniOdUredjivanjaMenija();
                                            else pokreniUredjivanjeMenija();
                                            setIsSettingsOpen(false);
                                            setIsSidebarOpen(true);
                                        }}
                                        className="w-full py-3.5 bg-amber-500/20 text-amber-500 border border-amber-500/40 rounded-xl text-[10px] font-black uppercase hover:bg-amber-500 hover:text-black transition-all"
                                    >
                                        {isMenuEditMode ? '✕ Odustani od uređivanja menija' : '✏️ Preuredi redoslijed i redove u meniju'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={spasiIzmjeneMenija}
                                        className="w-full py-3.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-500 transition-all flex items-center justify-center gap-2 shadow-lg"
                                    >
                                        <Save size={14} /> Spasi izgled menija za sve
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    const renderMobileDrawer = () => (
        <AnimatePresence>
            {mobileMenuOpen && (
                <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileMenuOpen(false)} className="erp-modal-backdrop fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[9000] md:hidden" />
                    <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-theme-card border-r border-theme-border z-[9001] p-4 flex flex-col md:hidden shadow-2xl">
                        <div className="flex justify-between items-center mb-4 border-b border-theme-border pb-3">
                            {renderLogoDisplay(true)}
                            <button type="button" onClick={() => setMobileMenuOpen(false)} className="p-2 bg-theme-panel rounded-lg text-theme-muted hover:text-theme-text border border-theme-border"><X size={20} /></button>
                        </div>
                        <div className="flex items-center gap-3 p-3 mb-4 bg-theme-panel rounded-xl border border-theme-border shadow-inner">
                            <div className="w-8 h-8 rounded-full bg-theme-accent flex items-center justify-center text-white font-black"><User size={16} /></div>
                            <div className="text-left"><p className="text-[9px] text-theme-muted uppercase font-black tracking-widest">Prijavljen</p><p className="text-xs text-theme-text font-black truncate max-w-[150px]">{user?.ime_prezime || 'Korisnik'}</p></div>
                        </div>

                        <div className="flex gap-2 mb-4">
                            <button type="button" onClick={() => { setIsSettingsOpen(true); setMobileMenuOpen(false); }} className="flex-1 flex items-center justify-center gap-1.5 p-2.5 bg-theme-panel rounded-xl text-theme-text hover:bg-theme-accent hover:text-white transition-all text-[9px] font-black uppercase border border-theme-border"><Settings size={14} /> Postavke</button>
                            <button type="button" onClick={handleLogout} className="flex-1 flex items-center justify-center gap-1.5 p-2.5 bg-red-900/20 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all text-[9px] font-black uppercase border border-red-500/30"><LogOut size={14} /> Odjava</button>
                        </div>

                        <nav className="flex-1 overflow-y-auto custom-scrollbar pb-10">
                            {renderMenuContent(true)}
                        </nav>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    if (!isLoaded) return <div className="min-h-screen bg-theme-main flex items-center justify-center"><div className="animate-pulse text-slate-500 font-bold tracking-widest uppercase">Učitavam interfejs...</div></div>;

    // Izračun klasa za JEDAN JEDINI <main> element koji se NIKADA ne unmount-a (ni na resize, ni na promjenu layouta!)
    const mainStyle = localLayout === 'sidebar'
        ? { marginLeft: isSidebarOpen ? `${menuStyle.sidebarWidth}px` : '80px' }
        : undefined;

    const mainClass = localLayout === 'sidebar'
        ? 'flex-1 min-w-0 pt-20 md:pt-8 p-4 md:p-8 min-h-screen relative z-10 w-full overflow-x-hidden transition-all duration-300 max-md:!ml-0'
        : localLayout === 'bento'
            ? 'flex-1 min-w-0 p-4 md:p-8 pb-28 relative z-10 w-full max-w-7xl mx-auto overflow-x-hidden'
            : localLayout === 'kiosk'
                ? 'flex-1 min-w-0 p-2 sm:p-6 relative z-10 w-full overflow-x-hidden'
                : 'flex-1 min-w-0 p-4 md:p-8 relative z-10 w-full overflow-x-hidden';

    return (
        <div style={accentColor ? { '--theme-accent': accentColor } : {}} className="w-full min-h-screen bg-theme-main text-theme-text transition-colors duration-300 relative font-sans">
            <PametniDialog
                isOpen={logoutDialog}
                tip="upozorenje"
                naslov="Odjava sa sistema"
                poruka="Da li ste sigurni da se želite odjaviti sa ERP sistema?"
                confirmText="🚪 ODJAVI ME"
                cancelText="OSTANI PRIJAVLJEN"
                onConfirm={potvrdiOdjavu}
                onCancel={() => setLogoutDialog(false)}
            />

            <div className={`w-full min-h-screen relative flex ${localLayout === 'sidebar' ? 'flex-row' : 'flex-col'}`}>
                {/* SIDEBAR CHROME */}
                {localLayout === 'sidebar' && (
                    <>
                        <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-theme-card border-b border-theme-border flex items-center justify-between px-4 z-40 backdrop-blur-md">
                            <button type="button" onClick={() => setMobileMenuOpen(true)} className="p-2 bg-theme-panel text-theme-text rounded-xl border border-theme-border"><Menu size={20} /></button>
                            {renderLogoDisplay(true)}
                            <div className="flex items-center gap-2">
                                {renderNotifBellButton('w-10 h-10', 18)}
                                <button type="button" onClick={() => setIsSettingsOpen(true)} className="p-2 bg-theme-panel text-theme-text rounded-xl border border-theme-border"><Settings size={20} /></button>
                            </div>
                        </div>

                        <motion.aside
                            initial={{ x: -60, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            style={{ width: isSidebarOpen ? `${menuStyle.sidebarWidth}px` : '80px' }}
                            className={`fixed h-screen bg-theme-card border-r ${isMenuEditMode ? 'border-2 border-amber-500' : 'border-theme-border'} flex flex-col p-3.5 backdrop-blur-[var(--glass-blur)] z-40 hidden md:flex transition-all duration-300`}
                        >
                            <div className={`flex items-start ${isSidebarOpen ? 'justify-between' : 'justify-center flex-col items-center'}`}>
                                {renderLogoDisplay(false, !isSidebarOpen)}
                                <button type="button" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-xl text-theme-muted hover:bg-theme-panel hover:text-theme-text transition-all ${isSidebarOpen ? 'mt-1' : 'mb-6'}`} title={isSidebarOpen ? "Skupi meni" : "Proširi meni"}>
                                    <Menu size={20} />
                                </button>
                            </div>

                            {isMenuEditMode && isSidebarOpen && (
                                <div className="mb-3 p-2.5 bg-amber-950/30 border border-amber-500/50 rounded-xl space-y-2">
                                    <p className="text-[9px] text-amber-500 font-black uppercase text-center leading-tight">
                                        Prevuci za redoslijed • Klikni 1/1, 1/2 ili 1/3
                                    </p>
                                    <div className="flex gap-1.5">
                                        <button type="button" onClick={odustaniOdUredjivanjaMenija} className="flex-1 py-2 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white rounded-lg text-[9px] font-black uppercase border border-red-500/30 transition-colors">Odustani</button>
                                        <button type="button" onClick={spasiIzmjeneMenija} className="flex-[2] py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase shadow-md transition-colors">💾 Spasi Meni</button>
                                    </div>
                                </div>
                            )}

                            <nav className={`flex-1 overflow-y-auto custom-scrollbar ${isSidebarOpen ? 'pr-1' : ''}`}>
                                {renderMenuContent(false)}
                            </nav>

                            <div className="border-t border-theme-border pt-3 mt-3">
                                {isAdmin && isSidebarOpen && !isMenuEditMode && (
                                    <button
                                        type="button"
                                        onClick={pokreniUredjivanjeMenija}
                                        className="w-full mb-2 py-2 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-black border border-amber-500/30 rounded-xl text-[9px] font-black uppercase transition-all"
                                    >
                                        ✏️ Uredi Meni (Redoslijed / Redovi)
                                    </button>
                                )}
                                <div className={`flex items-center gap-2 p-2.5 mb-2.5 bg-theme-panel rounded-xl border border-theme-border shadow-inner ${!isSidebarOpen ? 'flex-col justify-center' : 'justify-between'}`}>
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-7 h-7 rounded-full bg-theme-accent flex items-center justify-center text-white font-black shrink-0"><User size={14} /></div>
                                        {isSidebarOpen && (
                                            <div className="text-left overflow-hidden"><p className="text-[8px] text-theme-muted uppercase font-black tracking-widest">Prijavljen</p><p className="text-xs text-theme-text font-black truncate">{user?.ime_prezime || 'Korisnik'}</p></div>
                                        )}
                                    </div>
                                    {renderNotifBellButton('w-8 h-8 shrink-0', 15)}
                                </div>
                                <div className={`flex ${isSidebarOpen ? 'gap-2' : 'flex-col gap-2'}`}>
                                    <button type="button" onClick={() => setIsSettingsOpen(true)} className={`flex-1 flex items-center justify-center gap-1.5 p-2.5 bg-theme-panel rounded-xl text-theme-text hover:bg-theme-accent hover:text-white transition-all text-[9px] font-black uppercase border border-theme-border ${!isSidebarOpen ? 'px-0' : ''}`} title="Postavke"><Settings size={14} /> {isSidebarOpen && "Postavke"}</button>
                                    <button type="button" onClick={handleLogout} className={`flex-1 flex items-center justify-center gap-1.5 p-2.5 bg-red-900/20 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all text-[9px] font-black uppercase border border-red-500/30 ${!isSidebarOpen ? 'px-0' : ''}`} title="Odjava"><LogOut size={14} /> {isSidebarOpen && "Odjava"}</button>
                                </div>
                            </div>
                        </motion.aside>
                    </>
                )}

                {/* TOPNAV CHROME */}
                {localLayout === 'topnav' && (
                    <motion.header initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="h-16 w-full max-w-[100vw] bg-theme-card border-b border-theme-border px-2 sm:px-4 flex items-center justify-between sticky top-0 z-40 backdrop-blur-[var(--glass-blur)] shadow-sm overflow-x-hidden">
                        <div className="flex items-center gap-1.5 sm:gap-3 w-full justify-between md:w-auto md:justify-start min-w-0">
                            <button type="button" onClick={() => setMobileMenuOpen(true)} className="md:hidden shrink-0 p-2 bg-theme-panel text-theme-text rounded-xl border border-theme-border shadow-sm"><Menu size={18} /></button>
                            <div className="min-w-0 truncate">{renderLogoDisplay(true)}</div>
                            <div className="md:hidden flex items-center gap-1.5 shrink-0">
                                {renderNotifBellButton('w-9 h-9 shrink-0', 16)}
                                <button type="button" onClick={() => setIsSettingsOpen(true)} className="w-9 h-9 shrink-0 flex items-center justify-center bg-theme-panel border border-theme-border rounded-xl text-theme-muted hover:text-white hover:bg-theme-accent transition-all shadow-sm"><Settings size={16} /></button>
                                <button type="button" onClick={handleLogout} className="w-9 h-9 shrink-0 flex items-center justify-center bg-red-900/20 border border-red-500/30 rounded-xl text-red-500 hover:text-white hover:bg-red-500 transition-all shadow-sm"><LogOut size={16} /></button>
                            </div>
                        </div>

                        <nav className="hidden md:flex items-center gap-1 flex-1 justify-start px-4 overflow-x-auto custom-scrollbar">
                            <button type="button" onClick={() => onModuleChange('home')} style={{ fontSize: `${menuStyle.fontSize}px` }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold uppercase transition-all tracking-widest whitespace-nowrap flex-shrink-0 ${activeModule === 'home' ? 'bg-blue-600 text-white' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text'}`}>
                                <LayoutDashboard size={14} /> POČETNA
                            </button>
                            {visibleMenuItems.map((item) => {
                                const realIdx = editableModules.findIndex(m => m.id === item.id);
                                return (
                                    <button
                                        type="button"
                                        key={item.id}
                                        draggable={isMenuEditMode}
                                        onDragStart={() => handleMenuDragStart(realIdx)}
                                        onDragEnter={() => handleMenuDragEnter(realIdx)}
                                        onDrop={handleMenuDrop}
                                        onDragEnd={handleMenuDragEnd}
                                        onDragOver={(e) => e.preventDefault()}
                                        onClick={() => !isMenuEditMode && onModuleChange(item.id)}
                                        style={{
                                            backgroundColor: activeModule === item.id ? (item.hex_boja || 'var(--theme-accent)') : '',
                                            color: activeModule === item.id ? '#ffffff' : undefined,
                                            fontSize: `${menuStyle.fontSize}px`
                                        }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold uppercase transition-all tracking-widest whitespace-nowrap flex-shrink-0 ${isMenuEditMode ? 'border border-dashed border-amber-500 cursor-move' : ''} ${activeModule === item.id ? 'text-white' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text'}`}
                                    >
                                        {item.slika_url ? <img src={item.slika_url} className="w-3.5 h-3.5 object-contain" alt={item.naziv} /> : renderIcon(item.ikona, 14)} {item.naziv}
                                    </button>
                                );
                            })}
                        </nav>

                        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                            {isMenuEditMode && (
                                <>
                                    <button type="button" onClick={odustaniOdUredjivanjaMenija} className="px-3 py-1.5 bg-red-600/20 text-red-500 border border-red-500/30 rounded-lg text-[10px] font-black uppercase">Odustani</button>
                                    <button type="button" onClick={spasiIzmjeneMenija} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase">💾 Spasi Meni</button>
                                </>
                            )}
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-theme-panel rounded-lg border border-theme-border shadow-sm">
                                <div className="w-5 h-5 rounded-full bg-theme-accent flex items-center justify-center text-white"><User size={11} /></div>
                                <span className="text-[10px] font-black text-theme-text uppercase tracking-widest truncate max-w-[100px]">{user?.ime_prezime || 'Korisnik'}</span>
                            </div>
                            {renderNotifBellButton('w-10 h-10 shrink-0', 18)}
                            <button type="button" onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 flex items-center justify-center bg-theme-panel border border-theme-border rounded-xl text-theme-muted hover:text-white hover:bg-theme-accent transition-all shadow-sm" title="Postavke"><Settings size={18} /></button>
                            <button type="button" onClick={handleLogout} className="w-10 h-10 flex items-center justify-center bg-red-900/20 border border-red-500/30 rounded-xl text-red-500 hover:text-white hover:bg-red-500 transition-all shadow-sm" title="Odjava"><LogOut size={18} /></button>
                        </div>
                    </motion.header>
                )}

                {/* KIOSK CHROME (sa mobilnim menijem da nikad ne zaključa mobitel!) */}
                {localLayout === 'kiosk' && (
                    <motion.header initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="h-20 w-full bg-theme-card border-b border-theme-border px-3 sm:px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur-[var(--glass-blur)] shadow-sm gap-2">
                        <div className="flex items-center gap-2 shrink-0">
                            <button type="button" onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2.5 bg-theme-panel text-theme-text rounded-xl border border-theme-border"><Menu size={18} /></button>
                            {renderLogoDisplay(true)}
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto custom-scrollbar pb-1">
                            <button type="button" onClick={() => onModuleChange('home')} style={{ fontSize: `${menuStyle.fontSize}px` }} className={`px-3 sm:px-4 py-3 rounded-xl font-black uppercase transition-all tracking-widest border whitespace-nowrap ${activeModule === 'home' ? 'bg-theme-accent border-theme-accent text-white shadow-glow' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}>
                                POČETNA
                            </button>
                            {visibleMenuItems.map((item) => {
                                const realIdx = editableModules.findIndex(m => m.id === item.id);
                                return (
                                    <button
                                        type="button"
                                        key={item.id}
                                        draggable={isMenuEditMode}
                                        onDragStart={() => handleMenuDragStart(realIdx)}
                                        onDragEnter={() => handleMenuDragEnter(realIdx)}
                                        onDrop={handleMenuDrop}
                                        onDragEnd={handleMenuDragEnd}
                                        onDragOver={(e) => e.preventDefault()}
                                        onClick={() => !isMenuEditMode && onModuleChange(item.id)}
                                        style={{ backgroundColor: activeModule === item.id ? (item.hex_boja || 'var(--theme-accent)') : '', fontSize: `${menuStyle.fontSize}px` }}
                                        className={`px-4 py-3 rounded-xl font-black uppercase transition-all tracking-widest border whitespace-nowrap flex items-center gap-2 ${isMenuEditMode ? 'border-dashed border-amber-500 cursor-move' : ''} ${activeModule === item.id ? 'text-white shadow-glow border-transparent' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text hidden sm:flex'}`}
                                    >
                                        {item.slika_url ? <img src={item.slika_url} className="w-4 h-4 object-contain" alt={item.naziv} /> : renderIcon(item.ikona, menuStyle.iconSize)} {item.naziv}
                                    </button>
                                );
                            })}
                            {isMenuEditMode && (
                                <>
                                    <button type="button" onClick={odustaniOdUredjivanjaMenija} className="px-3 py-3 bg-red-600/20 text-red-500 border border-red-500/30 rounded-xl text-[10px] font-black uppercase">Odustani</button>
                                    <button type="button" onClick={spasiIzmjeneMenija} className="px-4 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase">💾 Spasi</button>
                                </>
                            )}
                            <div className="h-8 w-px bg-theme-border mx-1 hidden sm:block"></div>
                            {renderNotifBellButton('w-11 h-11 shrink-0', 20)}
                            <button type="button" onClick={() => setIsSettingsOpen(true)} className="w-11 h-11 shrink-0 flex items-center justify-center bg-theme-panel border border-theme-border rounded-xl text-theme-text hover:bg-theme-accent hover:text-white transition-all shadow-sm"><Settings size={20} /></button>
                            <button type="button" onClick={handleLogout} className="w-11 h-11 shrink-0 flex items-center justify-center bg-red-900/20 border border-red-500/30 rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm" title="Odjava"><LogOut size={20} /></button>
                        </div>
                    </motion.header>
                )}

                {/* JEDAN STABILAN <main> ZA SVE LAYOUTE — NACRTI SE NIKADA NE BRIŠU! */}
                <main style={mainStyle} className={mainClass}>
                    {children}
                </main>

                {/* BENTO BOTTOM DOCK */}
                {localLayout === 'bento' && (
                    <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed bottom-4 left-0 right-0 mx-auto w-fit max-w-[95vw] overflow-x-auto custom-scrollbar bg-theme-card border border-theme-accent/50 p-2 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.45)] z-50 flex items-center gap-2 backdrop-blur-2xl">
                        <button type="button" onClick={() => onModuleChange('home')} className={`shrink-0 flex items-center gap-2 px-5 py-3.5 rounded-2xl font-black uppercase transition-all text-xs tracking-widest ${activeModule === 'home' ? 'bg-theme-accent text-white shadow-glow scale-105' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text'}`}>
                            <LayoutDashboard size={menuStyle.iconSize} /> <span className="hidden sm:inline">Početna</span>
                        </button>
                        {visibleMenuItems.map((item) => {
                            const realIdx = editableModules.findIndex(m => m.id === item.id);
                            return (
                                <button
                                    type="button"
                                    key={item.id}
                                    draggable={isMenuEditMode}
                                    onDragStart={() => handleMenuDragStart(realIdx)}
                                    onDragEnter={() => handleMenuDragEnter(realIdx)}
                                    onDrop={handleMenuDrop}
                                    onDragEnd={handleMenuDragEnd}
                                    onDragOver={(e) => e.preventDefault()}
                                    onClick={() => !isMenuEditMode && onModuleChange(item.id)}
                                    style={{ backgroundColor: activeModule === item.id ? (item.hex_boja || 'var(--theme-accent)') : '', fontSize: `${menuStyle.fontSize}px` }}
                                    className={`shrink-0 flex items-center gap-2 px-5 py-3.5 rounded-2xl font-black uppercase transition-all tracking-widest ${isMenuEditMode ? 'border border-dashed border-amber-500 cursor-move' : ''} ${activeModule === item.id ? 'text-white shadow-glow scale-105' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text'}`}
                                >
                                    {item.slika_url ? <img src={item.slika_url} className="w-5 h-5 object-contain" alt={item.naziv} /> : renderIcon(item.ikona, menuStyle.iconSize)} <span className="hidden sm:inline">{item.naziv}</span>
                                </button>
                            );
                        })}
                        {isMenuEditMode && (
                            <>
                                <button type="button" onClick={odustaniOdUredjivanjaMenija} className="shrink-0 px-3 py-3 bg-red-600/20 text-red-500 border border-red-500/30 rounded-2xl text-[10px] font-black uppercase">Odustani</button>
                                <button type="button" onClick={spasiIzmjeneMenija} className="shrink-0 px-4 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase">💾 Spasi</button>
                            </>
                        )}
                        <div className="shrink-0 w-px h-8 bg-theme-border mx-2"></div>
                        {renderNotifBellButton('shrink-0 w-12 h-12 rounded-2xl', 20)}
                        <button type="button" onClick={() => setIsSettingsOpen(true)} className="shrink-0 p-4 rounded-2xl text-theme-muted hover:bg-theme-panel hover:text-theme-text transition-all" title="Postavke"><Settings size={20} /></button>
                        <button type="button" onClick={handleLogout} className="shrink-0 p-4 rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all" title="Odjava sa sistema"><LogOut size={20} /></button>
                    </motion.div>
                )}

                {renderMobileDrawer()}
            </div>

            <Toaster
                theme={localTheme === 'light' ? 'light' : 'dark'}
                richColors
                closeButton
                position="top-right"
                expand={true}
                gap={10}
                toastOptions={{
                    duration: 4200,
                }}
            />

            {renderSettingsPanel()}
            {renderNotifDrawer()}

            {selectedNotif && (
                <NotificationDetailModal
                    notification={selectedNotif}
                    user={user}
                    onClose={() => setSelectedNotif(null)}
                    onActionComplete={ucitajMojeNotifikacije}
                />
            )}
        </div>
    );
}
