"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Settings, Menu, X, User, MonitorSmartphone, Sun, Crown, Palette, Cpu, AlignJustify } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Toaster } from 'sonner';

export default function AppShell({ children, user, activeModule = "home", onModuleChange, accentColor, dynamicModules = [] }) {
    const { initSettings, setTheme, setLayout } = useAppStore();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false); 
    const [appBranding, setAppBranding] = useState({ name: 'SmartERP', logo: '' });

    // 🟢 LOKALNO ČUVANJE DIZAJNA ZA SVAKI UREĐAJ ZASEBNO
    const [localLayout, setLocalLayout] = useState('sidebar'); // ZAKUCAN DEFAULT
    const [localTheme, setLocalTheme] = useState('industrial'); 
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const fetchSaaSSettings = () => {
            setAppBranding({
                name: localStorage.getItem('saas_app_name') || 'SmartERP',
                logo: localStorage.getItem('saas_app_logo') || ''
            });
        };
        fetchSaaSSettings(); 
        window.addEventListener('saas_updated', fetchSaaSSettings);

        // Učitavanje dizajna sa specifičnog uređaja
        const savedLayout = localStorage.getItem('erp_device_layout');
        if (savedLayout) setLocalLayout(savedLayout);
        
        const savedTheme = localStorage.getItem('erp_device_theme');
        if (savedTheme) setLocalTheme(savedTheme);

        setIsLoaded(true);

        return () => window.removeEventListener('saas_updated', fetchSaaSSettings);
    }, []);

    // Funkcije za promjenu koje pamte izbor na uređaju
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

    useEffect(() => { initSettings(user?.ime_prezime || 'Korisnik'); }, [user, initSettings]);

    useEffect(() => {
        const handlePopState = (e) => { if (activeModule !== 'home') onModuleChange('home'); };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [activeModule, onModuleChange]);

    useEffect(() => {
        if (activeModule !== 'home' && !window.history.state?.modulOtvoren) {
            window.history.pushState({ modulOtvoren: true }, '');
        }
    }, [activeModule]);

    const hasPermission = (modulId) => {
        if (!user) return false;
        if (user.uloga === 'superadmin' || user.uloga === 'admin') return true;
        if (modulId === 'home') return true; 

        if (modulId === 'planiranje') {
            return (user.dozvole || []).includes('Planiranje Proizvodnje') || (user.dozvole || []).includes('Planiranje (Samo Pregled)');
        }
        
        const mapaDozvola = {
            'prijem': 'Prijem trupaca', 'prorez': 'Prorez (Trupci)', 'pilana': 'Pilana (Izlaz)', 'dorada': 'Dorada (Ulaz/Izlaz)',
            'lager': 'Lager Paketa', 'ponude': 'Ponude', 'radni_nalozi': 'Radni Nalozi', 'otpremnice': 'Otpremnice i Izdatnice', 
            'racuni': 'Računi', 'blagajna': 'Blagajna (Keš)', 'toranj': 'Kontrolni Toranj', 'analitika': 'Analitika',
            'podesavanja': 'Podešavanja', 'kiosk': 'Prijava na Rad', 'hr': 'HR Dashboard', 'reklamacije': 'Reklamacije i Povrati'
        };
        
        return (user.dozvole || []).includes(mapaDozvola[modulId]);
    };

    const renderIcon = (ikona, size = 18) => {
        if (ikona === 'LayoutDashboard') return <LayoutDashboard size={size}/>;
        if (ikona === 'Settings') return <Settings size={size}/>;
        return <span style={{ fontSize: `${size}px` }}>{ikona}</span>;
    };

    const visibleMenuItems = dynamicModules.filter(item => hasPermission(item.id));

    // 🟢 SVE ISPOD SU OBIČNE FUNKCIJE KOJE VRAĆAJU HTML (Rješenje za bijeli ekran na mobitelu)
    const renderLogoDisplay = (mobile = false) => (
        <div className={`flex items-center gap-3 ${mobile ? 'flex-shrink-0' : 'mb-10 px-2 mt-4'}`}>
            {appBranding.logo ? (
                <img src={appBranding.logo} alt="ERP Logo" className={`${mobile ? 'h-7' : 'h-12'} object-contain`} />
            ) : (
                <>
                    <div className={`${mobile ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-base'} rounded-lg bg-theme-accent flex items-center justify-center font-black text-white`}>
                        {appBranding.name.charAt(0).toUpperCase()}
                    </div>
                    <h1 className={`${mobile ? 'text-xs hidden sm:block' : 'text-xl'} font-black tracking-widest text-theme-text`}>
                        {appBranding.name}
                    </h1>
                </>
            )}
        </div>
    );

    const renderMenuContent = () => (
        <>
            <button onClick={() => { onModuleChange('home'); setMobileMenuOpen(false); }} className={`flex items-center gap-3 p-4 rounded-xl font-bold uppercase transition-all text-xs tracking-widest ${activeModule === 'home' ? 'bg-theme-accent text-white shadow-glow' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text'}`}>
                <LayoutDashboard size={18} /> POČETNA
            </button>
            {visibleMenuItems.map(item => (
                <button key={item.id} onClick={() => { onModuleChange(item.id); setMobileMenuOpen(false); }} className={`flex items-center gap-3 p-4 rounded-xl font-bold uppercase transition-all text-xs tracking-widest ${activeModule === item.id ? 'text-white shadow-glow' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text'}`} style={{ backgroundColor: activeModule === item.id ? (item.hex_boja || 'var(--theme-accent)') : '' }}>
                    {item.slika_url ? <img src={item.slika_url} className="w-5 h-5 object-contain" alt={item.naziv}/> : renderIcon(item.ikona, 18)} {item.naziv}
                </button>
            ))}
        </>
    );

    const renderSettingsPanel = () => (
        <AnimatePresence>
            {isSettingsOpen && (
                <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} className="fixed top-0 right-0 h-full w-80 bg-theme-card border-l border-theme-border shadow-2xl z-[5000] p-6 flex flex-col backdrop-blur-[var(--glass-blur)]">
                    <div className="flex justify-between items-center mb-8 border-b border-theme-border pb-4">
                        <h2 className="text-lg font-black text-theme-text uppercase tracking-widest flex items-center gap-2"><Settings size={20}/> Postavke uređaja</h2>
                        <button onClick={() => setIsSettingsOpen(false)} className="text-theme-muted hover:text-red-500 transition-colors"><X size={24}/></button>
                    </div>
                    <div className="space-y-6 flex-1 overflow-y-auto">
                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest text-center border-b border-theme-border pb-3">Ove postavke se pamte samo na ovom uređaju.</p>
                        <div>
                            <h3 className="text-[10px] font-black text-theme-muted mb-3 uppercase tracking-widest">Tema / Boje</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => changeTheme('industrial')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${localTheme==='industrial' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><Cpu size={24}/> <span className="text-[10px] font-black uppercase">Industrial</span></button>
                                <button onClick={() => changeTheme('aurora')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${localTheme==='aurora' ? 'bg-purple-600 border-purple-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><Palette size={24}/> <span className="text-[10px] font-black uppercase">Aurora Glass</span></button>
                                <button onClick={() => changeTheme('light')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${localTheme==='light' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><Sun size={24}/> <span className="text-[10px] font-black uppercase">Clinical Light</span></button>
                                <button onClick={() => changeTheme('executive')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${localTheme==='executive' ? 'bg-yellow-700 border-yellow-500 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><Crown size={24}/> <span className="text-[10px] font-black uppercase">Executive Gold</span></button>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-[10px] font-black text-theme-muted mb-3 uppercase tracking-widest mt-6">Izgled Ekrana</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => changeLayout('sidebar')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${localLayout==='sidebar' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><MonitorSmartphone size={24}/> <span className="text-[10px] font-black uppercase">Sidebar</span></button>
                                <button onClick={() => changeLayout('topnav')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${localLayout==='topnav' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><AlignJustify size={24}/> <span className="text-[10px] font-black uppercase">Top Nav</span></button>
                                <button onClick={() => changeLayout('bento')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${localLayout==='bento' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><Menu size={24}/> <span className="text-[10px] font-black uppercase text-center">Bento</span></button>
                                <button onClick={() => changeLayout('kiosk')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${localLayout==='kiosk' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><LayoutDashboard size={24}/> <span className="text-[10px] font-black uppercase">Kiosk</span></button>
                            </div>
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

            <motion.aside initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="w-64 fixed h-screen bg-theme-card border-r border-theme-border flex flex-col p-4 backdrop-blur-[var(--glass-blur)] z-40 hidden md:flex">
                {renderLogoDisplay()}
                <nav className="flex flex-col gap-2 flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {renderMenuContent()}
                </nav>
                <div className="border-t border-theme-border pt-4 mt-auto">
                    <div className="flex items-center gap-3 p-3 mb-4 bg-theme-panel rounded-xl border border-theme-border shadow-inner">
                        <div className="w-8 h-8 rounded-full bg-theme-accent flex items-center justify-center text-white font-black"><User size={16}/></div>
                        <div className="text-left"><p className="text-[9px] text-theme-muted uppercase font-black tracking-widest">Prijavljen</p><p className="text-xs text-theme-text font-black truncate max-w-[140px]">{user?.ime_prezime || 'Korisnik'}</p></div>
                    </div>
                    <button onClick={() => setIsSettingsOpen(true)} className="flex w-full items-center justify-center gap-2 p-4 bg-theme-panel rounded-xl text-theme-text hover:bg-theme-accent hover:text-white transition-all text-xs font-black uppercase border border-theme-border"><Settings size={16}/> Postavke uređaja</button>
                </div>
            </motion.aside>

            <AnimatePresence>
                {mobileMenuOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9000] md:hidden" />
                        <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed top-0 left-0 bottom-0 w-[80%] max-w-[300px] bg-theme-card border-r border-theme-border z-[9001] p-4 flex flex-col md:hidden shadow-2xl">
                            <div className="flex justify-between items-center mb-6 border-b border-theme-border pb-4">
                                {renderLogoDisplay(true)}
                                <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-theme-panel rounded-lg text-theme-muted hover:text-white border border-theme-border"><X size={20}/></button>
                            </div>
                            <div className="flex items-center gap-3 p-3 mb-6 bg-theme-panel rounded-xl border border-theme-border shadow-inner">
                                <div className="w-8 h-8 rounded-full bg-theme-accent flex items-center justify-center text-white font-black"><User size={16}/></div>
                                <div className="text-left"><p className="text-[9px] text-theme-muted uppercase font-black tracking-widest">Prijavljen</p><p className="text-xs text-theme-text font-black truncate max-w-[150px]">{user?.ime_prezime || 'Korisnik'}</p></div>
                            </div>
                            <nav className="flex flex-col gap-2 flex-1 overflow-y-auto custom-scrollbar pb-10">
                                {renderMenuContent()}
                            </nav>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <main className="flex-1 md:ml-64 pt-20 md:pt-8 p-4 md:p-8 min-h-screen relative z-10 w-full overflow-x-hidden">{children}</main>
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
                    </div>
                </div>
                
                <nav className="hidden md:flex items-center gap-1 flex-1 justify-center px-4 overflow-x-auto custom-scrollbar">
                    <button onClick={() => onModuleChange('home')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold uppercase transition-all text-[10px] tracking-widest whitespace-nowrap flex-shrink-0 ${activeModule === 'home' ? 'bg-theme-accent text-white' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text'}`}>
                        <LayoutDashboard size={13} /> POČETNA
                    </button>
                    {visibleMenuItems.map(item => (
                        <button key={item.id} onClick={() => onModuleChange(item.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold uppercase transition-all text-[10px] tracking-widest whitespace-nowrap flex-shrink-0 ${activeModule === item.id ? 'text-white' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text'}`} style={{ backgroundColor: activeModule === item.id ? (item.hex_boja || 'var(--theme-accent)') : '' }}>
                            {item.slika_url ? <img src={item.slika_url} className="w-3 h-3 object-contain" alt={item.naziv}/> : renderIcon(item.ikona, 13)} {item.naziv}
                        </button>
                    ))}
                </nav>
                
                <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-theme-panel rounded-lg border border-theme-border shadow-sm">
                        <div className="w-5 h-5 rounded-full bg-theme-accent flex items-center justify-center text-white"><User size={11}/></div>
                        <span className="text-[10px] font-black text-theme-text uppercase tracking-widest truncate max-w-[100px]">{user?.ime_prezime || 'Korisnik'}</span>
                    </div>
                    <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 flex items-center justify-center bg-theme-panel border border-theme-border rounded-xl text-theme-muted hover:text-white hover:bg-theme-accent transition-all shadow-sm"><Settings size={18}/></button>
                </div>
            </motion.header>

            <AnimatePresence>
                {mobileMenuOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9000] md:hidden" />
                        <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed top-0 left-0 bottom-0 w-[80%] max-w-[300px] bg-theme-card border-r border-theme-border z-[9001] p-4 flex flex-col md:hidden shadow-2xl">
                            <div className="flex justify-between items-center mb-6 border-b border-theme-border pb-4">
                                {renderLogoDisplay(true)}
                                <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-theme-panel rounded-lg text-theme-muted hover:text-white border border-theme-border"><X size={20}/></button>
                            </div>
                            <div className="flex items-center gap-3 p-3 mb-6 bg-theme-panel rounded-xl border border-theme-border shadow-inner">
                                <div className="w-8 h-8 rounded-full bg-theme-accent flex items-center justify-center text-white font-black"><User size={16}/></div>
                                <div className="text-left"><p className="text-[9px] text-theme-muted uppercase font-black tracking-widest">Prijavljen</p><p className="text-xs text-theme-text font-black truncate max-w-[150px]">{user?.ime_prezime || 'Korisnik'}</p></div>
                            </div>
                            <nav className="flex flex-col gap-2 flex-1 overflow-y-auto custom-scrollbar pb-10">
                                {renderMenuContent()}
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
                <button onClick={() => onModuleChange('home')} className={`flex items-center gap-2 px-6 py-4 rounded-2xl font-black uppercase transition-all text-xs tracking-widest ${activeModule === 'home' ? 'bg-theme-accent text-white shadow-glow scale-105' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text'}`}>
                    <LayoutDashboard size={18} /> <span className="hidden sm:inline">Početna</span>
                </button>
                {visibleMenuItems.map(item => (
                    <button key={item.id} onClick={() => onModuleChange(item.id)} className={`flex items-center gap-2 px-6 py-4 rounded-2xl font-black uppercase transition-all text-xs tracking-widest ${activeModule === item.id ? 'text-white shadow-glow scale-105' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text'}`} style={{ backgroundColor: activeModule === item.id ? (item.hex_boja || 'var(--theme-accent)') : '' }}>
                        {item.slika_url ? <img src={item.slika_url} className="w-5 h-5 object-contain" alt={item.naziv}/> : renderIcon(item.ikona, 18)} <span className="hidden sm:inline">{item.naziv}</span>
                    </button>
                ))}
                <div className="w-px h-8 bg-theme-border mx-2"></div>
                <button onClick={() => setIsSettingsOpen(true)} className="p-4 rounded-2xl text-theme-muted hover:bg-theme-panel hover:text-theme-text transition-all"><Settings size={20}/></button>
            </motion.div>
        </div>
    );

    const renderKioskLayout = () => (
        <div className="flex flex-col w-full min-h-screen relative">
            <motion.header initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="h-20 w-full bg-theme-card border-b border-theme-border px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur-[var(--glass-blur)] shadow-sm">
                {renderLogoDisplay(true)}
                <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto custom-scrollbar pb-1">
                    <button onClick={() => onModuleChange('home')} className={`px-4 py-3 rounded-xl font-black uppercase transition-all text-xs tracking-widest border whitespace-nowrap ${activeModule === 'home' ? 'bg-theme-accent border-theme-accent text-white shadow-glow' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text hidden sm:block'}`}>
                        POČETNA
                    </button>
                    {visibleMenuItems.map(item => (
                        <button key={item.id} onClick={() => onModuleChange(item.id)} className={`px-4 py-3 rounded-xl font-black uppercase transition-all text-xs tracking-widest border whitespace-nowrap flex items-center gap-2 ${activeModule === item.id ? 'text-white shadow-glow border-transparent' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text hidden sm:flex'}`} style={{ backgroundColor: activeModule === item.id ? (item.hex_boja || 'var(--theme-accent)') : '' }}>
                            {item.slika_url ? <img src={item.slika_url} className="w-4 h-4 object-contain" alt={item.naziv}/> : renderIcon(item.ikona, 14)} {item.naziv}
                        </button>
                    ))}
                    <div className="h-8 w-px bg-theme-border mx-2"></div>
                    <button onClick={() => setIsSettingsOpen(true)} className="w-12 h-12 flex items-center justify-center bg-theme-panel border border-theme-border rounded-xl text-theme-text hover:bg-theme-accent hover:text-white transition-all shadow-sm"><Settings size={20}/></button>
                </div>
            </motion.header>
            <main className="flex-1 p-2 sm:p-6 relative z-10 w-full overflow-x-hidden">{children}</main>
        </div>
    );

    if (!isLoaded) return <div className="min-h-screen bg-theme-main flex items-center justify-center"><div className="animate-pulse text-slate-500 font-bold tracking-widest uppercase">Učitavam interfejs...</div></div>;

    return (
        <div style={accentColor ? { '--theme-accent': accentColor } : {}} className="w-full min-h-screen bg-theme-main text-theme-text transition-colors duration-300 relative font-sans">
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