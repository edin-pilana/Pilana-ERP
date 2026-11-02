"use client";
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Settings, Menu, X, User, MonitorSmartphone, Sun, Crown, Palette, Cpu, AlignJustify, LogOut, Move, Eye, EyeOff, Save, Sliders } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Toaster, toast } from 'sonner';
import { supabase } from '../utils/supabaseClient';
import PametniDialog from './PametniDialog';

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
    const { initSettings, setTheme, setLayout } = useAppStore();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false); 
    const [appBranding, setAppBranding] = useState({ name: 'SmartERP', logo: '' });

    const [localLayout, setLocalLayout] = useState('sidebar'); 
    const [localTheme, setLocalTheme] = useState('industrial'); 
    const [isLoaded, setIsLoaded] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [logoutDialog, setLogoutDialog] = useState(false);

    // 🟢 STATE ZA UREĐIVANJE MENIJA (DRAG & DROP, VELIČINE, VIŠE DUGMADI U REDU, VIDLJIVOST)
    const [isMenuEditMode, setIsMenuEditMode] = useState(false);
    const [editableModules, setEditableModules] = useState([]);
    const [menuStyle, setMenuStyle] = useState({
        sidebarWidth: 260,     // px (210 - 380)
        btnHeight: 'normal',   // 'compact', 'normal', 'large'
        fontSize: 11,          // px (9 - 15)
        iconSize: 18           // px (14 - 26)
    });

    const dragMenuIdx = useRef(null);
    const dragOverMenuIdx = useRef(null);

    const isAdmin = user?.uloga === 'superadmin' || user?.uloga === 'admin';

    useEffect(() => {
        setEditableModules(dynamicModules);
    }, [dynamicModules]);

    useEffect(() => {
        if (menuConfig && Object.keys(menuConfig).length > 0) {
            setMenuStyle(prev => ({ ...prev, ...menuConfig }));
        } else {
            const savedMenuStyle = localStorage.getItem('erp_menu_style');
            if (savedMenuStyle) {
                try { setMenuStyle(prev => ({ ...prev, ...JSON.parse(savedMenuStyle) })); } catch (e) {}
            }
        }
    }, [menuConfig]);

    useEffect(() => {
        const fetchGlobalBranding = async () => {
            let nameToUse = localStorage.getItem('saas_app_name') || 'SmartERP';
            let logoToUse = localStorage.getItem('saas_app_logo') || '';
            
            try {
                const { data: bData } = await supabase.from('brending').select('*');
                if (bData && bData.length > 0) {
                    let logoObj = bData.find(b => (b.lokacije_jsonb || []).includes('GLAVNI MENI / SIDEBAR (GORE LIJEVO)'));
                    if (!logoObj) logoObj = bData[0]; 
                    
                    if (logoObj && logoObj.url_slike) {
                        logoToUse = logoObj.url_slike;
                        localStorage.setItem('saas_app_logo', logoToUse);
                    }
                }
                const { data: fData } = await supabase.from('postavke_firme').select('*').eq('id', 1).maybeSingle();
                if (fData && fData.app_name) {
                    nameToUse = fData.app_name;
                    localStorage.setItem('saas_app_name', nameToUse);
                }
            } catch(e) {}

            setAppBranding({ name: nameToUse, logo: logoToUse });
        };
        
        fetchGlobalBranding(); 
        window.addEventListener('saas_updated', fetchGlobalBranding);

        const savedLayout = localStorage.getItem('erp_device_layout');
        if (savedLayout) setLocalLayout(savedLayout);
        
        const savedTheme = localStorage.getItem('erp_device_theme');
        if (savedTheme) setLocalTheme(savedTheme);

        setIsLoaded(true);

        return () => window.removeEventListener('saas_updated', fetchGlobalBranding);
    }, []);

    const changeLayout = (noviLayout) => {
        setLocalLayout(noviLayout);
        localStorage.setItem('erp_device_layout', noviLayout);
        setLayout(noviLayout); 
    };

    const changeTheme = (novaTema) => {
        setLocalTheme(novaTema);
        localStorage.setItem('erp_device_theme', novaTema);
        setTheme(novaTema);
    };

    const handleLogout = () => {
        setLogoutDialog(true);
    };

    useEffect(() => { initSettings(user?.ime_prezime || 'Korisnik'); }, [user, initSettings]);

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

    // 🟢 STROGA PROVJERA DOZVOLA RADNIKA I SAKRIVANJE MODULA
    const hasPermission = (item) => {
        if (!user) return false;
        const modulId = typeof item === 'string' ? item : item.id;
        const modulObj = typeof item === 'object' ? item : editableModules.find(m => m.id === modulId);

        // 1. Ako je Admin ručno sakrio modul iz menija za sve
        if (modulObj?.hiddenInMenu && !isMenuEditMode) return false;

        // 2. Nadzorni centar vidi isključivo Superadmin
        if (modulId === 'nadzor') return user.uloga === 'superadmin';

        // 3. Superadmin i Admin vide sve ostalo
        if (user.uloga === 'superadmin' || user.uloga === 'admin') return true;
        if (modulId === 'home') return true;

        // 4. Ako je Admin na samom modulu isključio ulogu ovog radnika (npr. operater ili manager)
        if (modulObj?.allowedRoles && Array.isArray(modulObj.allowedRoles)) {
            if (!modulObj.allowedRoles.includes(user.uloga)) return false;
        }

        // 5. Provjera pojedinačnih dozvola radnika iz baze (Settings -> Radnici -> Dozvole)
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

    // 🟢 FUNKCIJE ZA DRAG & DROP I UREĐIVANJE MENIJA
    const handleMenuDragStart = (index) => { dragMenuIdx.current = index; };
    const handleMenuDragEnter = (index) => { dragOverMenuIdx.current = index; };
    const handleMenuDrop = () => {
        if (dragMenuIdx.current === null || dragOverMenuIdx.current === null) return;
        const copy = [...editableModules];
        const moved = copy[dragMenuIdx.current];
        copy.splice(dragMenuIdx.current, 1);
        copy.splice(dragOverMenuIdx.current, 0, moved);
        dragMenuIdx.current = null;
        dragOverMenuIdx.current = null;
        setEditableModules(copy);
    };

    const toggleMenuSpan = (index, e) => {
        e.stopPropagation();
        const copy = [...editableModules];
        const curr = copy[index].menuSpan || 'col-span-6';
        // Ciklus: 1 u redu (col-span-6) -> 2 u redu (col-span-3) -> 3 u redu (col-span-2)
        copy[index].menuSpan = curr === 'col-span-6' ? 'col-span-3' : (curr === 'col-span-3' ? 'col-span-2' : 'col-span-6');
        setEditableModules(copy);
    };

    const toggleMenuHidden = (index, e) => {
        e.stopPropagation();
        const copy = [...editableModules];
        copy[index].hiddenInMenu = !copy[index].hiddenInMenu;
        setEditableModules(copy);
    };

    const spasiIzmjeneMenija = async () => {
        localStorage.setItem('erp_menu_style', JSON.stringify(menuStyle));
        if (onSaveMenuConfig) {
            await onSaveMenuConfig(editableModules, menuStyle);
        }
        setIsMenuEditMode(false);
        toast.success("Izgled i redoslijed menija su uspješno sačuvani!");
    };

    const renderIcon = (ikona, size = 18) => {
        if (ikona === 'LayoutDashboard') return <LayoutDashboard size={size}/>;
        if (ikona === 'Settings') return <Settings size={size}/>;
        return <span style={{ fontSize: `${size}px`, lineHeight: 1 }}>{ikona}</span>;
    };

    const visibleMenuItems = isMenuEditMode 
        ? editableModules 
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

    // 🟢 RENDEROVANJE STAVKI MENIJA SA PODRŠKOM ZA VIŠE DUGMADI U REDU I DRAG & DROP
    const renderMenuContent = (isMobile = false) => {
        const isCollapsed = !isSidebarOpen && localLayout === 'sidebar' && !isMobile;
        const padClass = getPaddingClass();

        return (
            <div className={isCollapsed ? "flex flex-col gap-2" : "grid grid-cols-6 gap-2"}>
                <button 
                    title={isCollapsed ? 'POČETNA' : ''} 
                    onClick={() => { onModuleChange('home'); setMobileMenuOpen(false); }} 
                    style={{ fontSize: `${menuStyle.fontSize}px` }}
                    className={`col-span-6 flex items-center gap-3 ${padClass} rounded-xl font-bold uppercase transition-all tracking-widest ${activeModule === 'home' ? 'bg-theme-accent text-white shadow-glow' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text'} ${isCollapsed ? 'justify-center px-0' : ''}`}
                >
                    <div className="shrink-0"><LayoutDashboard size={menuStyle.iconSize} /></div>
                    {!isCollapsed && <span className="truncate">POČETNA</span>}
                </button>

                {visibleMenuItems.map((item, idx) => {
                    const spanClass = isCollapsed ? 'col-span-6' : (item.menuSpan || 'col-span-6');
                    const isCompactTile = !isCollapsed && (spanClass === 'col-span-3' || spanClass === 'col-span-2');
                    const spanLabel = spanClass === 'col-span-6' ? '1/1' : (spanClass === 'col-span-3' ? '1/2' : '1/3');

                    if (isMenuEditMode && !isCollapsed) {
                        return (
                            <div
                                key={item.id}
                                draggable
                                onDragStart={() => handleMenuDragStart(idx)}
                                onDragEnter={() => handleMenuDragEnter(idx)}
                                onDragEnd={handleMenuDrop}
                                onDragOver={(e) => e.preventDefault()}
                                className={`${spanClass} relative flex flex-col justify-between p-2 rounded-xl border-2 border-dashed ${item.hiddenInMenu ? 'border-red-500/50 bg-red-950/20 opacity-60' : 'border-amber-500 bg-black/30'} cursor-move select-none transition-all`}
                            >
                                <div className="flex justify-between items-center gap-1 mb-1">
                                    <span className="text-[9px] text-amber-400 font-black flex items-center gap-0.5"><Move size={10}/></span>
                                    <div className="flex gap-1">
                                        <button onClick={(e) => toggleMenuSpan(idx, e)} className="text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-black hover:bg-amber-500 hover:text-black" title="Broj dugmadi u redu (1/1 = cijeli red, 1/2 = dva u redu, 1/3 = tri u redu)">
                                            {spanLabel}
                                        </button>
                                        <button onClick={(e) => toggleMenuHidden(idx, e)} className={`text-[8px] px-1.5 py-0.5 rounded font-black border ${item.hiddenInMenu ? 'bg-red-600 text-white border-red-400' : 'bg-slate-800 text-slate-300 border-slate-600'}`} title="Prikaži / Sakrij u meniju">
                                            {item.hiddenInMenu ? <EyeOff size={10}/> : <Eye size={10}/>}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                    <div className="shrink-0">{renderIcon(item.ikona, 14)}</div>
                                    <span className="text-[9px] font-black text-white uppercase truncate">{item.naziv}</span>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <button 
                            title={isCollapsed || isCompactTile ? item.naziv : ''} 
                            key={item.id} 
                            onClick={() => { onModuleChange(item.id); setMobileMenuOpen(false); }} 
                            style={{ 
                                backgroundColor: activeModule === item.id ? (item.hex_boja || 'var(--theme-accent)') : '',
                                fontSize: `${menuStyle.fontSize}px`
                            }}
                            className={`${spanClass} flex ${spanClass === 'col-span-2' ? 'flex-col justify-center text-center gap-1 px-1 py-2.5' : 'items-center gap-2.5 ' + padClass} rounded-xl font-bold uppercase transition-all tracking-wider overflow-hidden ${activeModule === item.id ? 'text-white shadow-glow' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text border border-transparent hover:border-theme-border/60'} ${isCollapsed ? 'justify-center px-0' : ''}`}
                        >
                            <div className="shrink-0">
                                {item.slika_url ? <img src={item.slika_url} className="w-5 h-5 object-contain" alt={item.naziv}/> : renderIcon(item.ikona, menuStyle.iconSize)}
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

    const renderSettingsPanel = () => (
        <AnimatePresence>
            {isSettingsOpen && (
                <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} className="fixed top-0 right-0 h-full w-80 sm:w-96 bg-theme-card border-l border-theme-border shadow-2xl z-[5000] p-6 flex flex-col backdrop-blur-[var(--glass-blur)]">
                    <div className="flex justify-between items-center mb-6 border-b border-theme-border pb-4">
                        <h2 className="text-base font-black text-theme-text uppercase tracking-widest flex items-center gap-2"><Settings size={20}/> Postavke Ekrana i Menija</h2>
                        <button onClick={() => setIsSettingsOpen(false)} className="text-theme-muted hover:text-red-500 transition-colors"><X size={24}/></button>
                    </div>
                    <div className="space-y-6 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                        <div>
                            <h3 className="text-[10px] font-black text-theme-muted mb-3 uppercase tracking-widest">1. Tema / Boje</h3>
                            <div className="grid grid-cols-2 gap-2.5">
                                <button onClick={() => changeTheme('industrial')} className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${localTheme==='industrial' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><Cpu size={20}/> <span className="text-[9px] font-black uppercase">Industrial</span></button>
                                <button onClick={() => changeTheme('aurora')} className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${localTheme==='aurora' ? 'bg-purple-600 border-purple-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><Palette size={20}/> <span className="text-[9px] font-black uppercase">Aurora Glass</span></button>
                                <button onClick={() => changeTheme('light')} className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${localTheme==='light' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><Sun size={20}/> <span className="text-[9px] font-black uppercase">Clinical Light</span></button>
                                <button onClick={() => changeTheme('executive')} className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${localTheme==='executive' ? 'bg-yellow-700 border-yellow-500 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><Crown size={20}/> <span className="text-[9px] font-black uppercase">Executive Gold</span></button>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-[10px] font-black text-theme-muted mb-3 uppercase tracking-widest">2. Tip Navigacije (Layout)</h3>
                            <div className="grid grid-cols-2 gap-2.5">
                                <button onClick={() => changeLayout('sidebar')} className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${localLayout==='sidebar' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><MonitorSmartphone size={20}/> <span className="text-[9px] font-black uppercase">Sidebar (Bočni)</span></button>
                                <button onClick={() => changeLayout('topnav')} className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${localLayout==='topnav' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><AlignJustify size={20}/> <span className="text-[9px] font-black uppercase">Top Nav (Gornji)</span></button>
                                <button onClick={() => changeLayout('bento')} className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${localLayout==='bento' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><Menu size={20}/> <span className="text-[9px] font-black uppercase text-center">Bento (Donji)</span></button>
                                <button onClick={() => changeLayout('kiosk')} className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${localLayout==='kiosk' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><LayoutDashboard size={20}/> <span className="text-[9px] font-black uppercase">Kiosk</span></button>
                            </div>
                        </div>

                        {/* 🟢 KONTROLE ZA VELIČINU POLJA, ŠIRINU MENIJA I UREĐIVANJE REDOSLIJEDA */}
                        <div className="border-t border-theme-border pt-5 space-y-4">
                            <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5"><Sliders size={14}/> 3. Dimenzije i Raspored Menija</h3>
                            
                            <div>
                                <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                                    <span className="text-theme-muted">Širina Bočnog Menija:</span>
                                    <span className="text-theme-accent">{menuStyle.sidebarWidth} px</span>
                                </div>
                                <input type="range" min="210" max="380" step="10" value={menuStyle.sidebarWidth} onChange={e => setMenuStyle({...menuStyle, sidebarWidth: parseInt(e.target.value)})} className="w-full accent-amber-500 cursor-pointer" />
                            </div>

                            <div>
                                <span className="text-[10px] text-theme-muted font-black uppercase block mb-2">Visina Dugmadi u Meniju:</span>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'compact', label: 'Kompaktno' },
                                        { id: 'normal', label: 'Standard' },
                                        { id: 'large', label: 'Veliko' }
                                    ].map(h => (
                                        <button key={h.id} onClick={() => setMenuStyle({...menuStyle, btnHeight: h.id})} className={`py-2 rounded-xl text-[9px] font-black uppercase border ${menuStyle.btnHeight === h.id ? 'bg-amber-600 text-white border-amber-400' : 'bg-theme-panel text-theme-muted border-theme-border'}`}>
                                            {h.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] text-theme-muted font-black uppercase block mb-1">Slova ({menuStyle.fontSize}px)</label>
                                    <input type="range" min="9" max="15" value={menuStyle.fontSize} onChange={e => setMenuStyle({...menuStyle, fontSize: parseInt(e.target.value)})} className="w-full accent-amber-500 cursor-pointer" />
                                </div>
                                <div>
                                    <label className="text-[9px] text-theme-muted font-black uppercase block mb-1">Ikone ({menuStyle.iconSize}px)</label>
                                    <input type="range" min="14" max="26" value={menuStyle.iconSize} onChange={e => setMenuStyle({...menuStyle, iconSize: parseInt(e.target.value)})} className="w-full accent-amber-500 cursor-pointer" />
                                </div>
                            </div>

                            {isAdmin && (
                                <div className="pt-2 space-y-2">
                                    <button 
                                        onClick={() => { setIsMenuEditMode(!isMenuEditMode); setIsSettingsOpen(false); setIsSidebarOpen(true); }} 
                                        className="w-full py-3.5 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-xl text-[10px] font-black uppercase hover:bg-amber-500 hover:text-black transition-all"
                                    >
                                        {isMenuEditMode ? '✕ Zatvori uređivanje menija' : '✏️ Preuredi redoslijed i redove u meniju'}
                                    </button>
                                    <button 
                                        onClick={spasiIzmjeneMenija} 
                                        className="w-full py-3.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-500 transition-all flex items-center justify-center gap-2 shadow-lg"
                                    >
                                        <Save size={14}/> Spasi izgled menija za sve
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    const renderSidebarLayout = () => (
        <div className="flex w-full min-h-screen relative">
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-theme-card border-b border-theme-border flex items-center justify-between px-4 z-40 backdrop-blur-md">
                <button onClick={() => setMobileMenuOpen(true)} className="p-2 bg-theme-panel text-theme-text rounded-xl border border-theme-border"><Menu size={20}/></button>
                {renderLogoDisplay(true)}
                <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-theme-panel text-theme-text rounded-xl border border-theme-border"><Settings size={20}/></button>
            </div>

            <motion.aside 
                initial={{ x: -100, opacity: 0 }} 
                animate={{ x: 0, opacity: 1 }} 
                style={{ width: isSidebarOpen ? `${menuStyle.sidebarWidth}px` : '80px' }}
                className={`fixed h-screen bg-theme-card border-r ${isMenuEditMode ? 'border-2 border-amber-500' : 'border-theme-border'} flex flex-col p-3.5 backdrop-blur-[var(--glass-blur)] z-40 hidden md:flex transition-all duration-300`}
            >
                <div className={`flex items-start ${isSidebarOpen ? 'justify-between' : 'justify-center flex-col items-center'}`}>
                    {renderLogoDisplay(false, !isSidebarOpen)}
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-xl text-theme-muted hover:bg-theme-panel hover:text-theme-text transition-all ${isSidebarOpen ? 'mt-1' : 'mb-6'}`} title={isSidebarOpen ? "Skupi meni" : "Proširi meni"}>
                        <Menu size={20}/>
                    </button>
                </div>

                {isMenuEditMode && isSidebarOpen && (
                    <div className="mb-3 p-2.5 bg-amber-950/40 border border-amber-500/50 rounded-xl space-y-2">
                        <p className="text-[9px] text-amber-400 font-black uppercase text-center leading-tight">
                            Prevuci za redoslijed • Klikni 1/1, 1/2 ili 1/3 za više dugmadi u redu
                        </p>
                        <div className="flex gap-1.5">
                            <button onClick={() => setIsMenuEditMode(false)} className="flex-1 py-2 bg-red-900/40 text-red-400 rounded-lg text-[9px] font-black uppercase border border-red-500/30">Odustani</button>
                            <button onClick={spasiIzmjeneMenija} className="flex-[2] py-2 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase shadow-md">💾 Spasi Meni</button>
                        </div>
                    </div>
                )}

                <nav className={`flex-1 overflow-y-auto custom-scrollbar ${isSidebarOpen ? 'pr-1' : ''}`}>
                    {renderMenuContent(false)}
                </nav>

                <div className="border-t border-theme-border pt-3 mt-3">
                    {isAdmin && isSidebarOpen && !isMenuEditMode && (
                        <button 
                            onClick={() => setIsMenuEditMode(true)} 
                            className="w-full mb-2 py-2 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-black border border-amber-500/30 rounded-xl text-[9px] font-black uppercase transition-all"
                        >
                            ✏️ Uredi Meni (Redoslijed / Redovi)
                        </button>
                    )}
                    <div className={`flex items-center gap-3 p-2.5 mb-2.5 bg-theme-panel rounded-xl border border-theme-border shadow-inner ${!isSidebarOpen ? 'justify-center' : ''}`}>
                        <div className="w-7 h-7 rounded-full bg-theme-accent flex items-center justify-center text-white font-black shrink-0"><User size={14}/></div>
                        {isSidebarOpen && (
                            <div className="text-left overflow-hidden"><p className="text-[8px] text-theme-muted uppercase font-black tracking-widest">Prijavljen</p><p className="text-xs text-theme-text font-black truncate">{user?.ime_prezime || 'Korisnik'}</p></div>
                        )}
                    </div>
                    <div className={`flex ${isSidebarOpen ? 'gap-2' : 'flex-col gap-2'}`}>
                        <button onClick={() => setIsSettingsOpen(true)} className={`flex-1 flex items-center justify-center gap-1.5 p-2.5 bg-theme-panel rounded-xl text-theme-text hover:bg-theme-accent hover:text-white transition-all text-[9px] font-black uppercase border border-theme-border ${!isSidebarOpen ? 'px-0' : ''}`} title="Postavke"><Settings size={14}/> {isSidebarOpen && "Postavke"}</button>
                        <button onClick={handleLogout} className={`flex-1 flex items-center justify-center gap-1.5 p-2.5 bg-red-900/20 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all text-[9px] font-black uppercase border border-red-500/30 ${!isSidebarOpen ? 'px-0' : ''}`} title="Odjava"><LogOut size={14}/> {isSidebarOpen && "Odjava"}</button>
                    </div>
                </div>
            </motion.aside>

            <AnimatePresence>
                {mobileMenuOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9000] md:hidden" />
                        <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-theme-card border-r border-theme-border z-[9001] p-4 flex flex-col md:hidden shadow-2xl">
                            <div className="flex justify-between items-center mb-4 border-b border-theme-border pb-3">
                                {renderLogoDisplay(true)}
                                <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-theme-panel rounded-lg text-theme-muted hover:text-white border border-theme-border"><X size={20}/></button>
                            </div>
                            <div className="flex items-center gap-3 p-3 mb-4 bg-theme-panel rounded-xl border border-theme-border shadow-inner">
                                <div className="w-8 h-8 rounded-full bg-theme-accent flex items-center justify-center text-white font-black"><User size={16}/></div>
                                <div className="text-left"><p className="text-[9px] text-theme-muted uppercase font-black tracking-widest">Prijavljen</p><p className="text-xs text-theme-text font-black truncate max-w-[150px]">{user?.ime_prezime || 'Korisnik'}</p></div>
                            </div>
                            
                            <div className="flex gap-2 mb-4">
                                <button onClick={() => { setIsSettingsOpen(true); setMobileMenuOpen(false); }} className="flex-1 flex items-center justify-center gap-1.5 p-2.5 bg-theme-panel rounded-xl text-theme-text hover:bg-theme-accent hover:text-white transition-all text-[9px] font-black uppercase border border-theme-border"><Settings size={14}/> Postavke</button>
                                <button onClick={handleLogout} className="flex-1 flex items-center justify-center gap-1.5 p-2.5 bg-red-900/20 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all text-[9px] font-black uppercase border border-red-500/30"><LogOut size={14}/> Odjava</button>
                            </div>

                            <nav className="flex-1 overflow-y-auto custom-scrollbar pb-10">
                                {renderMenuContent(true)}
                            </nav>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <main 
                style={{ marginLeft: isSidebarOpen ? `${menuStyle.sidebarWidth}px` : '80px' }}
                className="flex-1 pt-20 md:pt-8 p-4 md:p-8 min-h-screen relative z-10 w-full overflow-x-hidden transition-all duration-300 max-md:!ml-0"
            >
                {children}
            </main>
        </div>
    );

    const renderTopNavLayout = () => (
        <div className="flex flex-col w-full min-h-screen relative">
            <motion.header initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="h-16 w-full bg-theme-card border-b border-theme-border px-4 flex items-center justify-between sticky top-0 z-40 backdrop-blur-[var(--glass-blur)] shadow-sm">
                <div className="flex items-center gap-3 w-full justify-between md:w-auto md:justify-start">
                    <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2.5 bg-theme-panel text-theme-text rounded-xl border border-theme-border shadow-sm active:scale-95 transition-transform"><Menu size={20}/></button>
                    {renderLogoDisplay(true)}
                    <div className="md:hidden flex items-center gap-2">
                        <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 flex items-center justify-center bg-theme-panel border border-theme-border rounded-xl text-theme-muted hover:text-white hover:bg-theme-accent transition-all shadow-sm"><Settings size={18}/></button>
                        <button onClick={handleLogout} className="w-10 h-10 flex items-center justify-center bg-red-900/20 border border-red-500/30 rounded-xl text-red-500 hover:text-white hover:bg-red-500 transition-all shadow-sm"><LogOut size={18}/></button>
                    </div>
                </div>
                
                <nav className="hidden md:flex items-center gap-1 flex-1 justify-center px-4 overflow-x-auto custom-scrollbar">
                    <button onClick={() => onModuleChange('home')} style={{ fontSize: `${menuStyle.fontSize}px` }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold uppercase transition-all tracking-widest whitespace-nowrap flex-shrink-0 ${activeModule === 'home' ? 'bg-theme-accent text-white' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text'}`}>
                        <LayoutDashboard size={14} /> POČETNA
                    </button>
                    {visibleMenuItems.map((item, idx) => (
                        <button 
                            key={item.id} 
                            draggable={isMenuEditMode}
                            onDragStart={() => handleMenuDragStart(idx)}
                            onDragEnter={() => handleMenuDragEnter(idx)}
                            onDragEnd={handleMenuDrop}
                            onDragOver={(e) => e.preventDefault()}
                            onClick={() => !isMenuEditMode && onModuleChange(item.id)} 
                            style={{ 
                                backgroundColor: activeModule === item.id ? (item.hex_boja || 'var(--theme-accent)') : '',
                                fontSize: `${menuStyle.fontSize}px`
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold uppercase transition-all tracking-widest whitespace-nowrap flex-shrink-0 ${isMenuEditMode ? 'border border-dashed border-amber-500 cursor-move' : ''} ${activeModule === item.id ? 'text-white' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text'}`} 
                        >
                            {item.slika_url ? <img src={item.slika_url} className="w-3.5 h-3.5 object-contain" alt={item.naziv}/> : renderIcon(item.ikona, 14)} {item.naziv}
                        </button>
                    ))}
                </nav>
                
                <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                    {isMenuEditMode && (
                        <button onClick={spasiIzmjeneMenija} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase">💾 Spasi Meni</button>
                    )}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-theme-panel rounded-lg border border-theme-border shadow-sm">
                        <div className="w-5 h-5 rounded-full bg-theme-accent flex items-center justify-center text-white"><User size={11}/></div>
                        <span className="text-[10px] font-black text-theme-text uppercase tracking-widest truncate max-w-[100px]">{user?.ime_prezime || 'Korisnik'}</span>
                    </div>
                    <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 flex items-center justify-center bg-theme-panel border border-theme-border rounded-xl text-theme-muted hover:text-white hover:bg-theme-accent transition-all shadow-sm" title="Postavke"><Settings size={18}/></button>
                    <button onClick={handleLogout} className="w-10 h-10 flex items-center justify-center bg-red-900/20 border border-red-500/30 rounded-xl text-red-500 hover:text-white hover:bg-red-500 transition-all shadow-sm" title="Odjava"><LogOut size={18}/></button>
                </div>
            </motion.header>

            <AnimatePresence>
                {mobileMenuOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9000] md:hidden" />
                        <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-theme-card border-r border-theme-border z-[9001] p-4 flex flex-col md:hidden shadow-2xl">
                            <div className="flex justify-between items-center mb-4 border-b border-theme-border pb-3">
                                {renderLogoDisplay(true)}
                                <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-theme-panel rounded-lg text-theme-muted hover:text-white border border-theme-border"><X size={20}/></button>
                            </div>
                            <div className="flex items-center gap-3 p-3 mb-4 bg-theme-panel rounded-xl border border-theme-border shadow-inner">
                                <div className="w-8 h-8 rounded-full bg-theme-accent flex items-center justify-center text-white font-black"><User size={16}/></div>
                                <div className="text-left"><p className="text-[9px] text-theme-muted uppercase font-black tracking-widest">Prijavljen</p><p className="text-xs text-theme-text font-black truncate max-w-[150px]">{user?.ime_prezime || 'Korisnik'}</p></div>
                            </div>
                            <nav className="flex-1 overflow-y-auto custom-scrollbar pb-10">
                                {renderMenuContent(true)}
                            </nav>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <main className="flex-1 p-4 md:p-8 relative z-10 w-full overflow-x-hidden">{children}</main>
        </div>
    );

    const renderBentoLayout = () => (
        <div className="flex flex-col w-full min-h-screen relative pb-24">
            <main className="flex-1 p-4 md:p-8 relative z-10 w-full max-w-7xl mx-auto">{children}</main>
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed bottom-4 left-0 right-0 mx-auto w-fit max-w-[95vw] overflow-x-auto custom-scrollbar bg-theme-card border border-theme-accent/50 p-2 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 flex items-center gap-2 backdrop-blur-2xl">
                <button onClick={() => onModuleChange('home')} className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl font-black uppercase transition-all text-xs tracking-widest ${activeModule === 'home' ? 'bg-theme-accent text-white shadow-glow scale-105' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text'}`}>
                    <LayoutDashboard size={menuStyle.iconSize} /> <span className="hidden sm:inline">Početna</span>
                </button>
                {visibleMenuItems.map((item, idx) => (
                    <button 
                        key={item.id} 
                        draggable={isMenuEditMode}
                        onDragStart={() => handleMenuDragStart(idx)}
                        onDragEnter={() => handleMenuDragEnter(idx)}
                        onDragEnd={handleMenuDrop}
                        onDragOver={(e) => e.preventDefault()}
                        onClick={() => !isMenuEditMode && onModuleChange(item.id)} 
                        style={{ backgroundColor: activeModule === item.id ? (item.hex_boja || 'var(--theme-accent)') : '', fontSize: `${menuStyle.fontSize}px` }}
                        className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl font-black uppercase transition-all tracking-widest ${isMenuEditMode ? 'border border-dashed border-amber-500 cursor-move' : ''} ${activeModule === item.id ? 'text-white shadow-glow scale-105' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text'}`} 
                    >
                        {item.slika_url ? <img src={item.slika_url} className="w-5 h-5 object-contain" alt={item.naziv}/> : renderIcon(item.ikona, menuStyle.iconSize)} <span className="hidden sm:inline">{item.naziv}</span>
                    </button>
                ))}
                {isMenuEditMode && (
                    <button onClick={spasiIzmjeneMenija} className="px-4 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase">💾 Spasi</button>
                )}
                <div className="w-px h-8 bg-theme-border mx-2"></div>
                <button onClick={() => setIsSettingsOpen(true)} className="p-4 rounded-2xl text-theme-muted hover:bg-theme-panel hover:text-theme-text transition-all" title="Postavke"><Settings size={20}/></button>
                <button onClick={handleLogout} className="p-4 rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all" title="Odjava sa sistema"><LogOut size={20}/></button>
            </motion.div>
        </div>
    );

    const renderKioskLayout = () => (
        <div className="flex flex-col w-full min-h-screen relative">
            <motion.header initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="h-20 w-full bg-theme-card border-b border-theme-border px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur-[var(--glass-blur)] shadow-sm">
                {renderLogoDisplay(true)}
                <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto custom-scrollbar pb-1">
                    <button onClick={() => onModuleChange('home')} style={{ fontSize: `${menuStyle.fontSize}px` }} className={`px-4 py-3 rounded-xl font-black uppercase transition-all tracking-widest border whitespace-nowrap ${activeModule === 'home' ? 'bg-theme-accent border-theme-accent text-white shadow-glow' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text hidden sm:block'}`}>
                        POČETNA
                    </button>
                    {visibleMenuItems.map((item, idx) => (
                        <button 
                            key={item.id} 
                            draggable={isMenuEditMode}
                            onDragStart={() => handleMenuDragStart(idx)}
                            onDragEnter={() => handleMenuDragEnter(idx)}
                            onDragEnd={handleMenuDrop}
                            onDragOver={(e) => e.preventDefault()}
                            onClick={() => !isMenuEditMode && onModuleChange(item.id)} 
                            style={{ backgroundColor: activeModule === item.id ? (item.hex_boja || 'var(--theme-accent)') : '', fontSize: `${menuStyle.fontSize}px` }}
                            className={`px-4 py-3 rounded-xl font-black uppercase transition-all tracking-widest border whitespace-nowrap flex items-center gap-2 ${isMenuEditMode ? 'border-dashed border-amber-500 cursor-move' : ''} ${activeModule === item.id ? 'text-white shadow-glow border-transparent' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text hidden sm:flex'}`} 
                        >
                            {item.slika_url ? <img src={item.slika_url} className="w-4 h-4 object-contain" alt={item.naziv}/> : renderIcon(item.ikona, menuStyle.iconSize)} {item.naziv}
                        </button>
                    ))}
                    {isMenuEditMode && (
                        <button onClick={spasiIzmjeneMenija} className="px-4 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase">💾 Spasi</button>
                    )}
                    <div className="h-8 w-px bg-theme-border mx-2"></div>
                    <button onClick={() => setIsSettingsOpen(true)} className="w-12 h-12 flex items-center justify-center bg-theme-panel border border-theme-border rounded-xl text-theme-text hover:bg-theme-accent hover:text-white transition-all shadow-sm"><Settings size={20}/></button>
                    <button onClick={handleLogout} className="w-12 h-12 flex items-center justify-center bg-red-900/20 border border-red-500/30 rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm" title="Odjava"><LogOut size={20}/></button>
                </div>
            </motion.header>
            <main className="flex-1 p-2 sm:p-6 relative z-10 w-full overflow-x-hidden">{children}</main>
        </div>
    );

    if (!isLoaded) return <div className="min-h-screen bg-theme-main flex items-center justify-center"><div className="animate-pulse text-slate-500 font-bold tracking-widest uppercase">Učitavam interfejs...</div></div>;

    return (
        <div style={accentColor ? { '--theme-accent': accentColor } : {}} className="w-full min-h-screen bg-theme-main text-theme-text transition-colors duration-300 relative font-sans">
            <PametniDialog
                isOpen={logoutDialog}
                tip="upozorenje"
                naslov="Odjava sa sistema"
                poruka="Da li ste sigurni da se želite odjaviti sa ERP sistema?"
                confirmText="🚪 ODJAVI ME"
                cancelText="OSTANI PRIJAVLJEN"
                onConfirm={() => { localStorage.removeItem('smart_timber_user'); window.location.reload(); }}
                onCancel={() => setLogoutDialog(false)}
            />

            <div className="hidden md:block">
                {localLayout === 'sidebar' && renderSidebarLayout()}
                {localLayout === 'kiosk' && renderKioskLayout()}
                {localLayout === 'bento' && renderBentoLayout()}
                {localLayout === 'topnav' && renderTopNavLayout()}
            </div>
            
            <div className="md:hidden">
                {renderTopNavLayout()}
            </div>
            
            <Toaster theme={localTheme === 'light' ? 'light' : 'dark'} richColors position="top-right" expand={true}/>
            
            {renderSettingsPanel()}
        </div>
    );
}