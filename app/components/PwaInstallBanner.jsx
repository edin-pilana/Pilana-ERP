"use client";
import React, { useState, useEffect } from 'react';
import { Smartphone, Download, CheckCircle2, Share, PlusSquare, X } from 'lucide-react';
import { toast } from 'sonner';

const DISMISS_KEY = 'pwa_install_banner_dismissed_until';

/**
 * Ujednačena Android / Desktop Chrome-Edge / iOS Safari PWA instalaciona kartica & banner.
 * mode: 'card' (u Postavkama / Zvoncu — uvijek prikazuje status i akciju) | 'banner' (nenametljiva donja traka za mobilne)
 */
export default function PwaInstallBanner({ mode = 'card' }) {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isStandalone, setIsStandalone] = useState(false);
    const [isIos, setIsIos] = useState(false);
    const [showIosGuide, setShowIosGuide] = useState(false);
    const [dismissed, setDismissed] = useState(true);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const standalone =
            window.matchMedia?.('(display-mode: standalone)')?.matches ||
            window.navigator?.standalone === true;
        setIsStandalone(Boolean(standalone));

        const ua = window.navigator.userAgent || '';
        const ios = /iPad|iPhone|iPod/i.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
        setIsIos(ios);

        try {
            const until = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
            setDismissed(Date.now() < until);
        } catch (e) {
            setDismissed(false);
        }

        // Ako je beforeinstallprompt već bio uhvaćen globalno
        if (window.__erpDeferredPwaPrompt) {
            setDeferredPrompt(window.__erpDeferredPwaPrompt);
        }

        const onBeforeInstall = (e) => {
            e.preventDefault();
            window.__erpDeferredPwaPrompt = e;
            setDeferredPrompt(e);
        };
        const onAppInstalled = () => {
            window.__erpDeferredPwaPrompt = null;
            setDeferredPrompt(null);
            setIsStandalone(true);
            toast.success('Aplikacija je uspješno instalirana na uređaj!');
        };

        window.addEventListener('beforeinstallprompt', onBeforeInstall);
        window.addEventListener('appinstalled', onAppInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', onBeforeInstall);
            window.removeEventListener('appinstalled', onAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            try {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    setDeferredPrompt(null);
                    window.__erpDeferredPwaPrompt = null;
                }
            } catch (e) {
                toast.info('Otvorite meni preglednika (⋮) i izaberite "Instaliraj aplikaciju".');
            }
            return;
        }
        if (isIos) {
            setShowIosGuide((v) => !v);
            return;
        }
        toast.info('U pregledniku kliknite meni (⋮) ili ikonu u adresnoj traci → "Instaliraj aplikaciju / Dodaj na početni ekran".');
    };

    const dismissForWeek = () => {
        setDismissed(true);
        try {
            localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
        } catch (e) {}
    };

    if (mode === 'banner') {
        if (isStandalone || dismissed) return null;
        if (!deferredPrompt && !isIos) return null;

        return (
            <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:max-w-sm z-[4500] bg-theme-card border-2 border-theme-accent/60 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-4">
                <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-theme-accent text-white flex items-center justify-center shrink-0 shadow-md">
                            <Smartphone size={18} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase text-theme-text">Instaliraj ERP na ekran</p>
                            <p className="text-[10px] text-theme-muted leading-tight mt-0.5">
                                {isIos ? 'Dodaj na početni ekran iOS-a za brzi rad i Push notifikacije.' : 'Instaliraj kao aplikaciju za rad bez adresne trake i brzi Push.'}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={dismissForWeek} className="p-1 text-theme-muted hover:text-theme-text shrink-0" title="Podsjeti me kasnije">
                        <X size={15} />
                    </button>
                </div>

                {showIosGuide ? (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-theme-panel border border-theme-border text-[10px] text-theme-text space-y-1.5 font-semibold">
                        <div className="flex items-center gap-1.5"><Share size={13} className="text-sky-400 shrink-0" /> 1. Dodirnite ikonu <strong>Podijeli (Share ↑)</strong> na dnu Safarija.</div>
                        <div className="flex items-center gap-1.5"><PlusSquare size={13} className="text-emerald-400 shrink-0" /> 2. Izaberite <strong>„Dodaj na početni ekran“</strong>.</div>
                        <div>3. Otvorite aplikaciju iz ikone na ekranu i uključite <strong>Push</strong> u zvoncu!</div>
                    </div>
                ) : (
                    <div className="mt-2.5 flex gap-2">
                        <button
                            type="button"
                            onClick={handleInstallClick}
                            className="flex-1 py-2 px-3 rounded-xl bg-theme-accent text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md"
                        >
                            <Download size={13} /> {isIos ? 'Prikaži iOS uputstvo' : 'Instaliraj odmah'}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // mode === 'card' (unutar Postavki / Zvonca)
    return (
        <div className="p-3.5 rounded-2xl bg-theme-panel border border-theme-border space-y-2.5">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <Smartphone size={15} className="text-theme-accent shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-theme-text truncate">
                        Instalacija aplikacije (PWA)
                    </span>
                </div>
                {isStandalone ? (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1 shrink-0">
                        <CheckCircle2 size={11} /> Instalirano
                    </span>
                ) : (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0">
                        {isIos ? 'iOS Safari' : deferredPrompt ? 'Spremno' : 'Preglednik'}
                    </span>
                )}
            </div>

            {isStandalone ? (
                <p className="text-[10px] text-theme-muted leading-snug">
                    Aplikacija radi u punom <strong>PWA režimu</strong> sa podrškom za pozadinske Push obavijesti.
                </p>
            ) : (
                <>
                    <p className="text-[10px] text-theme-muted leading-snug">
                        {isIos
                            ? 'Na iPhone/iPad uređaju dodajte aplikaciju na početni ekran kako biste primali pozadinske Push notifikacije.'
                            : 'Instalirajte ERP na početni ekran mobitela ili računara za brži rad i pouzdane pozadinske Push notifikacije.'}
                    </p>
                    <button
                        type="button"
                        onClick={handleInstallClick}
                        data-testid="pwa-install-btn"
                        className="w-full py-2.5 px-3 rounded-xl bg-theme-accent hover:opacity-90 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition-all"
                    >
                        <Download size={13} /> {isIos ? 'Kako instalirati na iPhone / iPad' : '📲 Dodaj na početni ekran (Instaliraj)'}
                    </button>
                    {showIosGuide && (
                        <div className="p-2.5 rounded-xl bg-theme-card border border-theme-border text-[10px] text-theme-text space-y-1.5 font-semibold animate-in fade-in">
                            <div className="flex items-center gap-1.5"><Share size={13} className="text-sky-400 shrink-0" /> 1. Dodirnite <strong>Podijeli (Share ↑)</strong> u dnu Safarija.</div>
                            <div className="flex items-center gap-1.5"><PlusSquare size={13} className="text-emerald-400 shrink-0" /> 2. Kliknite <strong>„Dodaj na početni ekran“</strong> → <strong>Dodaj</strong>.</div>
                            <div>3. Otvorite novu ikonu sa početnog ekrana i u zvoncu kliknite <strong>„Uključi Push“</strong>.</div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
