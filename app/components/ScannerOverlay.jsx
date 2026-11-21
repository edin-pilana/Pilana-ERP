"use client";
import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function ScannerOverlay({ onScan, onClose }) {
    const onScanRef = useRef(onScan);
    useEffect(() => { onScanRef.current = onScan; }, [onScan]);

    useEffect(() => {
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true,
            videoConstraints: { facingMode: "environment" }
        };
        const sc = new Html5QrcodeScanner("global-reader", config, false);
        sc.render((decodedText, decodedResult) => {
            if (onScanRef.current) onScanRef.current(decodedText, decodedResult);
        }, () => {});

        const handleEsc = (e) => {
            if (e.key === 'Escape' && onClose) onClose();
        };
        window.addEventListener('keydown', handleEsc);

        return () => {
            window.removeEventListener('keydown', handleEsc);
            try {
                Promise.resolve(sc.clear()).catch(() => {});
            } catch (e) {}
        };
    }, [onClose]);

    return (
        <div className="erp-modal-backdrop fixed inset-0 z-[99990] bg-slate-950/90 flex flex-col items-center justify-center p-6 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
            <h3 className="text-white font-black mb-4 uppercase tracking-widest text-xs">📷 Kamera aktivna — skenirajte QR / barkod</h3>
            <div id="global-reader" className="w-full max-w-md bg-theme-card rounded-box border-4 border-blue-500 overflow-hidden shadow-2xl [&_select]:bg-theme-panel [&_select]:text-theme-text [&_select]:p-2 [&_select]:rounded-lg [&_select]:mb-2 [&_select]:w-full [&_button]:bg-blue-600 [&_button]:text-white [&_button]:p-2 [&_button]:rounded-lg"></div>
            <button type="button" onClick={onClose} className="mt-8 px-12 py-4 bg-gradient-to-r from-red-600 to-rose-600 text-white font-black rounded-2xl uppercase shadow-lg hover:from-red-500 hover:to-rose-500 transition-all">✕ Odustani</button>
        </div>
    );
}
