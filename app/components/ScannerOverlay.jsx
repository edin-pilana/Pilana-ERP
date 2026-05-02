"use client";
import React, { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function ScannerOverlay({ onScan, onClose }) {
    useEffect(() => {
        const config = { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true,
            videoConstraints: { facingMode: "environment" }
        };
        const sc = new Html5QrcodeScanner("global-reader", config, false);
        sc.render(onScan, () => {});
        return () => sc.clear();
    }, [onScan]);

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-6 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
            <h3 className="text-white font-black mb-4 uppercase tracking-widest text-xs">Kamera aktivna</h3>
            <div id="global-reader" className="w-full max-w-md bg-theme-card rounded-box border-4 border-blue-500 overflow-hidden shadow-2xl [&_select]:bg-theme-panel [&_select]:text-white [&_select]:p-2 [&_select]:rounded-lg [&_select]:mb-2 [&_select]:w-full [&_button]:bg-blue-600 [&_button]:text-white [&_button]:p-2 [&_button]:rounded-lg"></div>
            <button onClick={onClose} className="mt-10 px-12 py-4 bg-red-600 text-white font-black rounded-2xl uppercase shadow-lg hover:bg-red-500">Odustani</button>
        </div>
    );
}