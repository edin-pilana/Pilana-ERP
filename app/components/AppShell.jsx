"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Scissors, ArrowRightLeft, Settings, Menu, X, User, MonitorSmartphone, Sun, Crown, Palette, Cpu, TreePine, Axe, Package, FileText, Wrench, Truck, Receipt, Wallet, Radar, BarChart3, AlignJustify } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Toaster } from 'sonner';

export default function AppShell({ children, userName = "Edin", activeModule = "home", onModuleChange, accentColor }) {
    const { theme, layout, setTheme, setLayout, initSettings } = useAppStore();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // --- PAMĆENJE IMENA I LOGOTIPA ---
    const [menuLabels, setMenuLabels] = useState({});
    const [appBranding, setAppBranding] = useState({ name: 'SmartERP', logo: '' });

    useEffect(() => {
        const fetchSaaSSettings = () => {
            setMenuLabels({
                home: localStorage.getItem('saas_dashboard_analitika_naslov') || 'Početna',
                prijem: localStorage.getItem('saas_prijem_trupaca_naslov') || 'Prijem',
                prorez: localStorage.getItem('saas_prorez_trupaca_naslov') || 'Prorez',
                pilana: localStorage.getItem('saas_pilana_izlaz_naslov') || 'Pilana',
                dorada: localStorage.getItem('saas_dorada_modul_naslov') || 'Dorada',
                lager: localStorage.getItem('saas_lager_paketa_naslov') || 'Lager',
                ponude: localStorage.getItem('saas_ponude_naslov') || 'Ponude',
                radni_nalozi: localStorage.getItem('saas_radni_nalozi_naslov') || 'Nalozi',
                otpremnice: localStorage.getItem('saas_otpremnice_naslov') || 'Otpremnice',
                racuni: localStorage.getItem('saas_racuni_naslov') || 'Računi',
                blagajna: localStorage.getItem('saas_blagajna_naslov') || 'Blagajna',
                toranj: localStorage.getItem('saas_kontrolni_toranj_naslov') || 'Kontrola',
                analitika: localStorage.getItem('saas_analitika_naslov') || 'Analitika'
            });
            setAppBranding({
                name: localStorage.getItem('saas_app_name') || 'SmartERP',
                logo: localStorage.getItem('saas_app_logo') || ''
            });
        };

        fetchSaaSSettings(); 
        window.addEventListener('saas_updated', fetchSaaSSettings);
        return () => window.removeEventListener('saas_updated', fetchSaaSSettings);
    }, []);

    useEffect(() => {
        initSettings(userName);
    }, [userName, initSettings]);

    const menuItems = [
        { id: 'home', label: menuLabels.home, icon: LayoutDashboard },
        { id: 'prijem', label: menuLabels.prijem, icon: TreePine },
        { id: 'prorez', label: menuLabels.prorez, icon: Axe },
        { id: 'pilana', label: menuLabels.pilana, icon: Scissors },
        { id: 'dorada', label: menuLabels.dorada, icon: ArrowRightLeft },
        { id: 'lager', label: menuLabels.lager, icon: Package },
        { id: 'ponude', label: menuLabels.ponude, icon: FileText },
        { id: 'radni_nalozi', label: menuLabels.radni_nalozi, icon: Wrench },
        { id: 'otpremnice', label: menuLabels.otpremnice, icon: Truck },
        { id: 'racuni', label: menuLabels.racuni, icon: Receipt },
        { id: 'blagajna', label: menuLabels.blagajna, icon: Wallet },
        { id: 'toranj', label: menuLabels.toranj, icon: Radar },
        { id: 'analitika', label: menuLabels.analitika, icon: BarChart3 },
    ];

    const LogoDisplay = ({ mobile = false }) => (
        <div className={`flex items-center gap-3 ${mobile ? 'flex-shrink-0' : 'mb-10 px-2 mt-4'}`}>
            {appBranding.logo ? (
                <img src={appBranding.logo} alt="ERP Logo" className={`${mobile ? 'h-8' : 'h-12'} object-contain`} />
            ) : (
                <>
                    <div className={`${mobile ? 'w-7 h-7 text-sm' : 'w-8 h-8 text-base'} rounded-lg bg-theme-accent flex items-center justify-center font-black text-white`}>
                        {appBranding.name.charAt(0).toUpperCase()}
                    </div>
                    <h1 className={`${mobile ? 'text-sm hidden sm:block' : 'text-xl'} font-black tracking-widest text-theme-text`}>
                        {appBranding.name}
                    </h1>
                </>
            )}
        </div>
    );

    const renderSettingsPanel = () => (
        <AnimatePresence>
            {isSettingsOpen && (
                <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} className="fixed top-0 right-0 h-full w-80 bg-theme-card border-l border-theme-border shadow-2xl z-[5000] p-6 flex flex-col backdrop-blur-[var(--glass-blur)]">
                    <div className="flex justify-between items-center mb-8 border-b border-theme-border pb-4">
                        <h2 className="text-lg font-black text-theme-text uppercase tracking-widest flex items-center gap-2"><Settings size={20}/> Postavke</h2>
                        <button onClick={() => setIsSettingsOpen(false)} className="text-theme-muted hover:text-red-500 transition-colors"><X size={24}/></button>
                    </div>
                    <div className="space-y-6 flex-1 overflow-y-auto">
                        <div>
                            <h3 className="text-[10px] font-black text-theme-muted mb-3 uppercase tracking-widest">Tema / Boje</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setTheme('industrial')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${theme==='industrial' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><Cpu size={24}/> <span className="text-[10px] font-black uppercase">Industrial</span></button>
                                <button onClick={() => setTheme('aurora')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${theme==='aurora' ? 'bg-purple-600 border-purple-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><Palette size={24}/> <span className="text-[10px] font-black uppercase">Aurora Glass</span></button>
                                <button onClick={() => setTheme('light')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${theme==='light' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><Sun size={24}/> <span className="text-[10px] font-black uppercase">Clinical Light</span></button>
                                <button onClick={() => setTheme('executive')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${theme==='executive' ? 'bg-yellow-700 border-yellow-500 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><Crown size={24}/> <span className="text-[10px] font-black uppercase">Executive Gold</span></button>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-[10px] font-black text-theme-muted mb-3 uppercase tracking-widest mt-6">Izgled Ekrana (Školjka)</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setLayout('sidebar')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${layout==='sidebar' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><MonitorSmartphone size={24}/> <span className="text-[10px] font-black uppercase">Sidebar</span></button>
                                <button onClick={() => setLayout('topnav')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${layout==='topnav' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><AlignJustify size={24}/> <span className="text-[10px] font-black uppercase">Top Nav</span></button>
                                <button onClick={() => setLayout('bento')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${layout==='bento' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><Menu size={24}/> <span className="text-[10px] font-black uppercase text-center">Bento</span></button>
                                <button onClick={() => setLayout('kiosk')} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${layout==='kiosk' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}><LayoutDashboard size={24}/> <span className="text-[10px] font-black uppercase">Kiosk</span></button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    const renderSidebarLayout = () => (
        <div className="flex w-full min-h-screen relative">
            <motion.aside initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="w-64 fixed h-screen bg-theme-card border-r border-theme-border flex flex-col p-4 backdrop-blur-[var(--glass-blur)] z-40 hidden md:flex">
                <LogoDisplay />
                <nav className="flex flex-col gap-2 flex-1">
                    {menuItems.map(item => {
                        const Icon = item.icon;
                        const isActive = activeModule === item.id;
                        return (
                            <button key={item.id} onClick={() => onModuleChange(item.id)} className={`flex items-center gap-3 p-4 rounded-xl font-bold uppercase transition-all text-xs tracking-widest ${isActive ? 'bg-theme-accent text-white shadow-glow' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text'}`}>
                                <Icon size={18} /> {item.label}
                            </button>
                        );
                    })}
                </nav>
                <div className="border-t border-theme-border pt-4 mt-auto">
                    <div className="flex items-center gap-3 p-3 mb-4 bg-theme-panel rounded-xl border border-theme-border shadow-inner">
                        <div className="w-8 h-8 rounded-full bg-theme-accent flex items-center justify-center text-white font-black"><User size={16}/></div>
                        <div className="text-left"><p className="text-[9px] text-theme-muted uppercase font-black tracking-widest">Prijavljen</p><p className="text-xs text-theme-text font-black">{userName}</p></div>
                    </div>
                    <button onClick={() => setIsSettingsOpen(true)} className="flex w-full items-center justify-center gap-2 p-4 bg-theme-panel rounded-xl text-theme-text hover:bg-theme-accent hover:text-white transition-all text-xs font-black uppercase border border-theme-border"><Settings size={16}/> Postavke</button>
                </div>
            </motion.aside>
            <main className="flex-1 md:ml-64 p-4 md:p-8 min-h-screen relative z-10 w-full overflow-x-hidden">{children}</main>
        </div>
    );

    const renderKioskLayout = () => (
        <div className="flex flex-col w-full min-h-screen relative">
            <motion.header initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="h-20 w-full bg-theme-card border-b border-theme-border px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur-[var(--glass-blur)] shadow-sm">
                <LogoDisplay mobile={true} />
                <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
                    {menuItems.map(item => {
                        const isActive = activeModule === item.id;
                        return (
                            <button key={item.id} onClick={() => onModuleChange(item.id)} className={`px-4 py-3 rounded-xl font-black uppercase transition-all text-xs tracking-widest border whitespace-nowrap ${isActive ? 'bg-theme-accent border-theme-accent text-white shadow-glow' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text hidden sm:block'}`}>
                                {item.label}
                            </button>
                        );
                    })}
                    <div className="h-8 w-px bg-theme-border mx-2"></div>
                    <button onClick={() => setIsSettingsOpen(true)} className="w-12 h-12 flex items-center justify-center bg-theme-panel border border-theme-border rounded-xl text-theme-text hover:bg-theme-accent hover:text-white transition-all shadow-sm"><Settings size={20}/></button>
                </div>
            </motion.header>
            <main className="flex-1 p-2 sm:p-6 relative z-10 w-full overflow-x-hidden">{children}</main>
        </div>
    );

    const renderBentoLayout = () => (
        <div className="flex flex-col w-full min-h-screen relative pb-24">
            <main className="flex-1 p-4 md:p-8 relative z-10 w-full max-w-7xl mx-auto">{children}</main>
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-theme-card border border-theme-border p-2 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 flex items-center gap-2 backdrop-blur-2xl">
                {menuItems.map(item => {
                    const Icon = item.icon;
                    const isActive = activeModule === item.id;
                    return (
                        <button key={item.id} onClick={() => onModuleChange(item.id)} className={`flex items-center gap-2 px-6 py-4 rounded-2xl font-black uppercase transition-all text-xs tracking-widest ${isActive ? 'bg-theme-accent text-white shadow-glow scale-105' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text'}`}>
                            <Icon size={18} /> <span className="hidden sm:inline">{item.label}</span>
                        </button>
                    );
                })}
                <div className="w-px h-8 bg-theme-border mx-2"></div>
                <button onClick={() => setIsSettingsOpen(true)} className="p-4 rounded-2xl text-theme-muted hover:bg-theme-panel hover:text-theme-text transition-all"><Settings size={20}/></button>
            </motion.div>
        </div>
    );

    const TopNavLayout = () => {
        const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
        return (
            <div className="flex flex-col w-full min-h-screen relative">
                <motion.header initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="h-14 w-full bg-theme-card border-b border-theme-border px-4 flex items-center justify-between sticky top-0 z-40 backdrop-blur-[var(--glass-blur)]">
                    <LogoDisplay mobile={true} />
                    <nav className="hidden md:flex items-center gap-1 flex-1 justify-center px-4 overflow-x-auto">
                        {menuItems.map(item => {
                            const Icon = item.icon;
                            const isActive = activeModule === item.id;
                            return (
                                <button key={item.id} onClick={() => onModuleChange(item.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold uppercase transition-all text-[10px] tracking-widest whitespace-nowrap flex-shrink-0 ${isActive ? 'bg-theme-accent text-white' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text'}`}>
                                    <Icon size={13} /> {item.label}
                                </button>
                            );
                        })}
                    </nav>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-theme-panel rounded-lg border border-theme-border">
                            <div className="w-5 h-5 rounded-full bg-theme-accent flex items-center justify-center text-white"><User size={11}/></div>
                            <span className="text-[10px] font-black text-theme-text uppercase tracking-widest">{userName}</span>
                        </div>
                        <button onClick={() => setIsSettingsOpen(true)} className="w-8 h-8 flex items-center justify-center bg-theme-panel border border-theme-border rounded-lg text-theme-muted hover:text-white hover:bg-theme-accent transition-all"><Settings size={15}/></button>
                        <button onClick={() => setMobileMenuOpen(v => !v)} className="md:hidden w-8 h-8 flex items-center justify-center bg-theme-panel border border-theme-border rounded-lg text-theme-muted">
                            {mobileMenuOpen ? <X size={16}/> : <Menu size={16}/>}
                        </button>
                    </div>
                </motion.header>

                <AnimatePresence>
                    {mobileMenuOpen && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="md:hidden w-full bg-theme-card border-b border-theme-border px-4 py-3 grid grid-cols-3 gap-2 z-30 sticky top-14 shadow-2xl">
                            {menuItems.map(item => {
                                const Icon = item.icon;
                                const isActive = activeModule === item.id;
                                return (
                                    <button key={item.id} onClick={() => { onModuleChange(item.id); setMobileMenuOpen(false); }} className={`flex items-center gap-1.5 px-2 py-2 rounded-lg font-bold uppercase transition-all text-[9px] tracking-widest ${isActive ? 'bg-theme-accent text-white' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text'}`}>
                                        <Icon size={12} /> {item.label}
                                    </button>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>
                <main className="flex-1 p-4 md:p-8 relative z-10 w-full overflow-x-hidden">{children}</main>
            </div>
        );
    };

    return (
        <div style={accentColor ? { '--theme-accent': accentColor } : {}} className="w-full min-h-screen bg-theme-main text-theme-text transition-colors duration-300 relative font-sans">
            {layout === 'sidebar' && renderSidebarLayout()}
            {layout === 'kiosk' && renderKioskLayout()}
            {layout === 'bento' && renderBentoLayout()}
            {layout === 'topnav' && <TopNavLayout />}
            
            <Toaster theme={theme === 'light' ? 'light' : 'dark'} richColors position="top-right" expand={true}/>
            
            {renderSettingsPanel()}
            
            <AnimatePresence>
                {isSettingsOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSettingsOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[4000]" />
                )}
            </AnimatePresence>
        </div>
    );
}