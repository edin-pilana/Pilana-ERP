"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Scissors, ArrowRightLeft, Settings, Menu, X, User, MonitorSmartphone, Sun, Crown, Palette, Cpu, TreePine, Axe, Package, FileText, Wrench, Truck, Receipt, Wallet, Radar, BarChart3, AlignJustify } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Toaster, toast } from 'sonner';

export default function AppShell({ children, userName = "Edin", activeModule = "home", onModuleChange, accentColor }) {
    const { theme, layout, setTheme, setLayout, initSettings } = useAppStore();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Inicijalizacija postavki kada se komponenta učita (pamti korisnika)
    useEffect(() => {
        initSettings(userName);
    }, [userName, initSettings]);

    const menuItems = [
        { id: 'home', label: 'Početna', icon: LayoutDashboard },
        { id: 'prijem', label: 'Prijem', icon: TreePine },
        { id: 'prorez', label: 'Prorez', icon: Axe },
        { id: 'pilana', label: 'Pilana', icon: Scissors },
        { id: 'dorada', label: 'Dorada', icon: ArrowRightLeft },
        { id: 'lager', label: 'Lager', icon: Package },
        { id: 'ponude', label: 'Ponude', icon: FileText },
        { id: 'radni_nalozi', label: 'Nalozi', icon: Wrench },
        { id: 'otpremnice', label: 'Otpremnice', icon: Truck },
        { id: 'racuni', label: 'Računi', icon: Receipt },
        { id: 'blagajna', label: 'Blagajna', icon: Wallet },
        { id: 'toranj', label: 'Toranj', icon: Radar },
        { id: 'analitika', label: 'Analitika', icon: BarChart3 },
    ];

    // ==========================================
    // ⚙️ PANEL ZA POSTAVKE TEMA I LAYOUTA
    // ==========================================
    const SettingsPanel = () => (
        <AnimatePresence>
            {isSettingsOpen && (
                <motion.div 
                    initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }}
                    className="fixed top-0 right-0 h-full w-80 bg-theme-card border-l border-theme-border shadow-2xl z-[5000] p-6 flex flex-col backdrop-blur-[var(--glass-blur)]"
                >
                    <div className="flex justify-between items-center mb-8 border-b border-theme-border pb-4">
                        <h2 className="text-lg font-black text-theme-text uppercase tracking-widest flex items-center gap-2">
                            <Settings size={20}/> Postavke
                        </h2>
                        <button onClick={() => setIsSettingsOpen(false)} className="text-theme-muted hover:text-red-500 transition-colors">
                            <X size={24}/>
                        </button>
                    </div>
    
                    <div className="space-y-6 flex-1 overflow-y-auto">
                        {/* TEME */}
                        <div>
                            <h3 className="text-[10px] font-black text-theme-muted mb-3 uppercase tracking-widest">Tema / Boje</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => setTheme('industrial')} 
                                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${theme==='industrial' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}
                                >
                                    <Cpu size={24}/> 
                                    <span className="text-[10px] font-black uppercase">Industrial</span>
                                </button>
                                <button 
                                    onClick={() => setTheme('aurora')} 
                                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${theme==='aurora' ? 'bg-purple-600 border-purple-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}
                                >
                                    <Palette size={24}/> 
                                    <span className="text-[10px] font-black uppercase">Aurora Glass</span>
                                </button>
                                <button 
                                    onClick={() => setTheme('light')} 
                                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${theme==='light' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}
                                >
                                    <Sun size={24}/> 
                                    <span className="text-[10px] font-black uppercase">Clinical Light</span>
                                </button>
                                <button 
                                    onClick={() => setTheme('executive')} 
                                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${theme==='executive' ? 'bg-yellow-700 border-yellow-500 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}
                                >
                                    <Crown size={24}/> 
                                    <span className="text-[10px] font-black uppercase">Executive Gold</span>
                                </button>
                            </div>
                        </div>
    
                        {/* ŠKOLJKE */}
                        <div>
                            <h3 className="text-[10px] font-black text-theme-muted mb-3 uppercase tracking-widest mt-6">Izgled Ekrana (Školjka)</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => setLayout('sidebar')} 
                                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${layout==='sidebar' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}
                                >
                                    <MonitorSmartphone size={24}/> 
                                    <span className="text-[10px] font-black uppercase">Sidebar</span>
                                </button>
                                <button 
                                    onClick={() => setLayout('topnav')} 
                                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${layout==='topnav' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}
                                >
                                    <AlignJustify size={24}/> 
                                    <span className="text-[10px] font-black uppercase">Top Nav</span>
                                </button>
                                <button 
                                    onClick={() => setLayout('bento')} 
                                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${layout==='bento' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}
                                >
                                    <Menu size={24}/> 
                                    <span className="text-[10px] font-black uppercase text-center">Bento</span>
                                </button>
                                <button 
                                    onClick={() => setLayout('kiosk')} 
                                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all hover:scale-105 ${layout==='kiosk' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text'}`}
                                >
                                    <LayoutDashboard size={24}/> 
                                    <span className="text-[10px] font-black uppercase">Kiosk</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    // ==========================================
    // 1. SIDEBAR LAYOUT (Za kancelariju / PC)
    // ==========================================
    const SidebarLayout = () => (
        <div className="flex w-full min-h-screen relative">
            <motion.aside initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="w-64 fixed h-screen bg-theme-card border-r border-theme-border flex flex-col p-4 backdrop-blur-[var(--glass-blur)] z-40 hidden md:flex">
                <div className="flex items-center gap-3 mb-10 px-2 mt-4">
                    <div className="w-8 h-8 rounded-lg bg-theme-accent flex items-center justify-center font-black text-white">S</div>
                    <h1 className="text-xl font-black tracking-widest text-theme-text">Smart<span className="text-theme-accent">ERP</span></h1>
                </div>
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
            <main className="flex-1 md:ml-64 p-4 md:p-8 min-h-screen relative z-10 w-full overflow-x-hidden">
                {children}
            </main>
        </div>
    );

    // ==========================================
    // 2. KIOSK LAYOUT (Za tablete u pogonu)
    // ==========================================
    const KioskLayout = () => (
        <div className="flex flex-col w-full min-h-screen relative">
            <motion.header initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="h-20 w-full bg-theme-card border-b border-theme-border px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur-[var(--glass-blur)] shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-theme-accent flex items-center justify-center font-black text-white text-xl">S</div>
                    <h1 className="text-2xl font-black tracking-widest text-theme-text hidden sm:block">Smart<span className="text-theme-accent">ERP</span></h1>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                    {menuItems.map(item => {
                        const isActive = activeModule === item.id;
                        return (
                            <button key={item.id} onClick={() => onModuleChange(item.id)} className={`px-4 py-3 rounded-xl font-black uppercase transition-all text-xs tracking-widest border ${isActive ? 'bg-theme-accent border-theme-accent text-white shadow-glow' : 'bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text hidden sm:block'}`}>
                                {item.label}
                            </button>
                        );
                    })}
                    <div className="h-8 w-px bg-theme-border mx-2"></div>
                    <button onClick={() => setIsSettingsOpen(true)} className="w-12 h-12 flex items-center justify-center bg-theme-panel border border-theme-border rounded-xl text-theme-text hover:bg-theme-accent hover:text-white transition-all shadow-sm"><Settings size={20}/></button>
                </div>
            </motion.header>
            <main className="flex-1 p-2 sm:p-6 relative z-10 w-full overflow-x-hidden">
                {children}
            </main>
        </div>
    );

    // ==========================================
    // 3. BENTO LAYOUT (Plutajući meni na dnu)
    // ==========================================
    const BentoLayout = () => (
        <div className="flex flex-col w-full min-h-screen relative pb-24">
            <main className="flex-1 p-4 md:p-8 relative z-10 w-full max-w-7xl mx-auto">
                {children}
            </main>
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

    // ==========================================
    // 4. TOP NAV LAYOUT (Horizontalna navigacija — SaaS stil)
    // ==========================================
    const TopNavLayout = () => {
        const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
        
        return (
            <div className="flex flex-col w-full min-h-screen relative">
                {/* HEADER — gornja traka s logom i navigacijom */}
                <motion.header 
                    initial={{ y: -60, opacity: 0 }} 
                    animate={{ y: 0, opacity: 1 }}
                    className="h-14 w-full bg-theme-card border-b border-theme-border px-4 flex items-center justify-between sticky top-0 z-40 backdrop-blur-[var(--glass-blur)]"
                >
                    {/* Logo */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="w-7 h-7 rounded-md bg-theme-accent flex items-center justify-center font-black text-white text-sm">S</div>
                        <span className="text-sm font-black tracking-widest text-theme-text hidden sm:block">
                            Smart<span className="text-theme-accent">ERP</span>
                        </span>
                    </div>

                    {/* Nav dugmad — desktop */}
                    <nav className="hidden md:flex items-center gap-1 flex-1 justify-center px-4 overflow-x-auto">
                        {menuItems.map(item => {
                            const Icon = item.icon;
                            const isActive = activeModule === item.id;
                            return (
                                <button 
                                    key={item.id} 
                                    onClick={() => onModuleChange(item.id)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold uppercase transition-all text-[10px] tracking-widest whitespace-nowrap flex-shrink-0 ${
                                        isActive 
                                            ? 'bg-theme-accent text-white' 
                                            : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text'
                                    }`}
                                >
                                    <Icon size={13} /> {item.label}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Desna strana — korisnik + settings */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-theme-panel rounded-lg border border-theme-border">
                            <div className="w-5 h-5 rounded-full bg-theme-accent flex items-center justify-center text-white">
                                <User size={11}/>
                            </div>
                            <span className="text-[10px] font-black text-theme-text uppercase tracking-widest">{userName}</span>
                        </div>
                        <button 
                            onClick={() => setIsSettingsOpen(true)} 
                            className="w-8 h-8 flex items-center justify-center bg-theme-panel border border-theme-border rounded-lg text-theme-muted hover:text-white hover:bg-theme-accent transition-all"
                        >
                            <Settings size={15}/>
                        </button>
                        {/* Mobile hamburger */}
                        <button 
                            onClick={() => setMobileMenuOpen(v => !v)} 
                            className="md:hidden w-8 h-8 flex items-center justify-center bg-theme-panel border border-theme-border rounded-lg text-theme-muted"
                        >
                            {mobileMenuOpen ? <X size={16}/> : <Menu size={16}/>}
                        </button>
                    </div>
                </motion.header>

                {/* MOBILE DROPDOWN MENI */}
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <motion.div 
                            initial={{ opacity: 0, y: -10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            exit={{ opacity: 0, y: -10 }}
                            className="md:hidden w-full bg-theme-card border-b border-theme-border px-4 py-3 grid grid-cols-3 gap-2 z-30 sticky top-14"
                        >
                            {menuItems.map(item => {
                                const Icon = item.icon;
                                const isActive = activeModule === item.id;
                                return (
                                    <button 
                                        key={item.id} 
                                        onClick={() => { onModuleChange(item.id); setMobileMenuOpen(false); }}
                                        className={`flex items-center gap-1.5 px-2 py-2 rounded-lg font-bold uppercase transition-all text-[9px] tracking-widest ${
                                            isActive ? 'bg-theme-accent text-white' : 'text-theme-muted hover:bg-theme-panel hover:text-theme-text'
                                        }`}
                                    >
                                        <Icon size={12} /> {item.label}
                                    </button>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* MAIN CONTENT */}
                <main className="flex-1 p-4 md:p-8 relative z-10 w-full overflow-x-hidden">
                    {children}
                </main>
            </div>
        );
    };

    // ==========================================
    // RENDER: Povezivanje odabrane školjke
    // ==========================================
    return (
        <div 
            style={accentColor ? { '--theme-accent': accentColor } : {}}
            className="w-full min-h-screen bg-theme-main text-theme-text transition-colors duration-300 relative font-sans"
        >
            {layout === 'sidebar' && <SidebarLayout />}
            {layout === 'kiosk' && <KioskLayout />}
            {layout === 'bento' && <BentoLayout />}
            {layout === 'topnav' && <TopNavLayout />}
            <Toaster 
                theme={theme === 'light' ? 'light' : 'dark'} 
                richColors 
                position="top-right" 
                expand={true}
            />

            <SettingsPanel />
            
            {/* Globalni mračni overlay kada je settings otvoren */}
            <AnimatePresence>
                {isSettingsOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSettingsOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[4000]" />
                )}
            </AnimatePresence>
        </div>
    );
}