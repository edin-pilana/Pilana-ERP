"use client";
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://awaxwejrhmjeqohrgidm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY');

const GEMINI_API_KEY = "AIzaSyCE7adoYNwq9tM-xJLS-2_Q_IvsAKEs13M";
// Fiksiramo najbolji i najbrži model sa tvoje liste za analizu velike količine podataka
const ODABRANI_MODEL = "gemini-2.5-flash"; 

export default function TabAiAnalitika({ saas }) {
    const [messages, setMessages] = useState([
        { role: 'ai', text: 'Zdravo šefe! Ja sam tvoj AI ERP Asistent (Gemini 2.5 Flash). Imam **neograničen pristup cijeloj bazi podataka** (svi proizvodi, paketi, trupci, računi). Šta te zanima?' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    
    const chatEndRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // FUNKCIJA ZA DOHVAĆANJE CIJELE BAZE (BEZ OGRANIČENJA DATUMA)
    const fetchCijelaBaza = async () => {
        try {
            // Povlačimo SVE podatke iz baze kako bi AI imao puni pregled
            const [trupciRes, paketiRes, racuniRes, blagajnaRes, radniciRes, katalogRes] = await Promise.all([
                supabase.from('trupci').select('*'),
                supabase.from('paketi').select('*'),
                supabase.from('racuni').select('*'),
                supabase.from('blagajna').select('*'),
                supabase.from('radnici').select('*'),
                supabase.from('katalog_proizvoda').select('*')
            ]);

            // Pakujemo sve u jedan ogroman JSON objekat
            const kompletnaBaza = {
                informacija: "Ovo je kompletan ispis (dump) baze podataka ERP sistema kompanije.",
                tabela_trupci: trupciRes.data || [],
                tabela_paketi_proizvodnja: paketiRes.data || [],
                tabela_izdati_racuni: racuniRes.data || [],
                tabela_blagajna_troskovi: blagajnaRes.data || [],
                tabela_radnici: radniciRes.data || [],
                tabela_katalog_artikala: katalogRes.data || []
            };

            return JSON.stringify(kompletnaBaza);
        } catch (error) {
            console.error("Greška pri čitanju baze:", error);
            return JSON.stringify({ greska: "Došlo je do greške pri čitanju baze podataka." });
        }
    };

    const posaljiPoruku = async () => {
        if (!input.trim()) return;

        const userText = input.trim();
        setMessages(prev => [...prev, { role: 'user', text: userText }]);
        setInput('');
        setIsTyping(true);

        try {
            // 1. Čitamo cijelu bazu
            const dbDump = await fetchCijelaBaza();
            
            // 2. Pripremamo prompt sa striktnim uputama
            const prompt = `
            Ti si ekspertni poslovni i finansijski AI analitičar za pilanu i drvnu industriju.
            Ispod ti je proslijeđen KOMPLETAN JSON DUMP cijele ERP baze podataka klijenta.
            
            Tvoj zadatak je da pažljivo analiziraš ove sirove podatke i tačno odgovoriš na korisnikovo pitanje.
            Slobodno navedi konkretne nazive proizvoda, šifre, imena radnika, datume i sume novca koje pronađeš u podacima.
            
            PODACI IZ BAZE:
            ${dbDump}

            PITANJE KORISNIKA:
            ${userText}
            
            UPUTE ZA ODGOVOR:
            - Odgovaraj isključivo na bosanskom jeziku.
            - Budi direktan, profesionalan i precizan.
            - Koristi markdown za formatiranje (podebljaj bitne brojeve, koristi liste nabrajanja).
            `;

            // 3. Poziv prema Gemini API-ju (Koristimo model gemini-2.5-flash)
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${ODABRANI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    contents: [{ parts: [{ text: prompt }] }], 
                    generationConfig: { temperature: 0.1 } // Vrlo niska temperatura (0.1) osigurava da AI ne izmišlja podatke, već strogo čita iz baze
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errText}`);
            }

            const data = await response.json();
            const aiOdgovor = data.candidates[0].content.parts[0].text;

            setMessages(prev => [...prev, { role: 'ai', text: aiOdgovor }]);

        } catch (error) {
            setMessages(prev => [...prev, { role: 'ai', text: `❌ **Greška:** Nije moguće analizirati podatke u ovom trenutku. Detalji: ${error.message}` }]);
        }
        
        setIsTyping(false);
    };

    const renderMarkdown = (text) => {
        const lines = text.split('\n');
        return lines.map((line, index) => {
            let formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            if (formattedLine.trim().startsWith('* ')) return <li key={index} className="ml-4 list-disc" dangerouslySetInnerHTML={{ __html: formattedLine.substring(2) }} />;
            if (formattedLine.trim() === '') return <br key={index} />;
            return <p key={index} className="mb-1" dangerouslySetInnerHTML={{ __html: formattedLine }} />;
        });
    };

    const bojaAkcenta = saas?.ui?.boja_akcenta || '#3b82f6';

    return (
        <div className="relative max-w-4xl mx-auto h-[750px] flex flex-col bg-theme-card rounded-box border border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95">
            
            <div className="p-5 border-b border-theme-border flex justify-between items-center bg-theme-card z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-theme-card border border-slate-700 flex items-center justify-center text-2xl shadow-inner">🤖</div>
                    <div>
                        <h3 className="text-white font-black uppercase tracking-widest text-sm">TTM AI Kontrolor</h3>
                        <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span> 
                            Puni pristup bazi | Model: {ODABRANI_MODEL}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-theme-main custom-scrollbar">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] md:max-w-[75%] p-5 rounded-2xl shadow-md ${msg.role === 'user' ? 'bg-theme-panel text-white rounded-tr-sm border border-slate-700' : 'bg-theme-card text-slate-200 rounded-tl-sm border border-blue-500/20'}`}>
                            {msg.role === 'ai' && <div className="text-[10px] text-blue-400 font-black mb-2 uppercase tracking-widest border-b border-slate-700/50 pb-1">AI Asistent</div>}
                            <div className="text-sm font-medium leading-relaxed">{msg.role === 'user' ? msg.text : renderMarkdown(msg.text)}</div>
                        </div>
                    </div>
                ))}
                
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="max-w-[75%] p-5 rounded-2xl rounded-tl-sm bg-theme-card border border-blue-500/20 flex items-center gap-2">
                            <span className="text-xs text-blue-400 font-bold ml-2 animate-pulse">Čitam cijelu bazu podataka i analiziram...</span>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            <div className="p-4 bg-theme-card border-t border-theme-border shrink-0">
                <div className="relative flex items-center">
                    <input 
                        type="text" 
                        value={input} 
                        onChange={(e) => setInput(e.target.value)} 
                        onKeyDown={(e) => { if (e.key === 'Enter') posaljiPoruku(); }} 
                        placeholder="Pitaj nešto, npr: Nabroj mi sve proizvode koje smo proizveli ovog mjeseca..." 
                        disabled={isTyping} 
                        className="w-full p-5 pr-20 bg-theme-card rounded-2xl text-sm text-white font-bold outline-none border border-slate-700 focus:border-blue-500 transition-all disabled:opacity-50" 
                    />
                    <button 
                        onClick={posaljiPoruku} 
                        disabled={!input.trim() || isTyping} 
                        className="absolute right-2 top-2 bottom-2 px-5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-xl font-black transition-all"
                        style={{ backgroundColor: input.trim() ? bojaAkcenta : '' }}
                    >➤</button>
                </div>
            </div>
            
        </div>
    );
}