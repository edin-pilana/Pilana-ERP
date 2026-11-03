"use client";
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';

const DEFAULT_GEMINI_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const ODABRANI_MODEL = "gemini-2.5-flash"; 

export default function TabAiAnalitika({ saas }) {
    const [messages, setMessages] = useState([
        { role: 'ai', text: 'Zdravo šefe! Ja sam tvoj AI ERP Asistent. Imam **neograničen pristup cijeloj bazi podataka** (svi proizvodi, paketi, trupci, računi, nalozi i reklamacije). Šta te zanima?' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [customKey, setCustomKey] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('erp_gemini_key') || '' : ''));
    const [showKeyInput, setShowKeyInput] = useState(false);
    
    const chatEndRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // FUNKCIJA ZA DOHVAĆANJE CIJELE BAZE (BEZ OGRANIČENJA DATUMA)
    const fetchCijelaBaza = async () => {
        try {
            const [trupciRes, paketiRes, racuniRes, blagajnaRes, radniciRes, katalogRes, reklamacijeRes, naloziRes, otpremniceRes, prorezRes] = await Promise.all([
                supabase.from('trupci').select('*'),
                supabase.from('paketi').select('*'),
                supabase.from('racuni').select('*'),
                supabase.from('blagajna').select('*'),
                supabase.from('radnici').select('*'),
                supabase.from('katalog_proizvoda').select('*'),
                supabase.from('reklamacije').select('*'),
                supabase.from('radni_nalozi').select('*'),
                supabase.from('otpremnice').select('*'),
                supabase.from('prorez_log').select('*')
            ]);

            return {
                informacija: "Ovo je kompletan ispis (dump) baze podataka ERP sistema kompanije.",
                tabela_trupci: trupciRes.data || [],
                tabela_paketi_proizvodnja: paketiRes.data || [],
                tabela_izdati_racuni: racuniRes.data || [],
                tabela_blagajna_troskovi: blagajnaRes.data || [],
                tabela_radnici: radniciRes.data || [],
                tabela_katalog_artikala: katalogRes.data || [],
                tabela_reklamacije_i_povrati: reklamacijeRes.data || [],
                tabela_radni_nalozi: naloziRes.data || [],
                tabela_otpremnice: otpremniceRes.data || [],
                tabela_prorez_log: prorezRes.data || []
            };
        } catch (error) {
            console.error("Greška pri čitanju baze:", error);
            return null;
        }
    };

    // 🟢 PAMETNI LOKALNI ERP ANALITIČKI MOTOR (Odgovara sa 100% tačnim podacima iz baze čak i bez eksternog Gemini API ključa!)
    const generisiPametniLokalniOdgovor = (baza, pitanje) => {
        if (!baza) return "Došlo je do greške pri čitanju baze podataka.";

        const sviPaketi = (baza.tabela_paketi_proizvodnja || []).filter(p => parseFloat(p.kolicina_final || 0) > 0);
        const paketiNaStanju = sviPaketi.filter(p => p.closed_at !== null && p.otpremnica_id === null);
        const paketiURadu = sviPaketi.filter(p => p.closed_at === null && p.otpremnica_id === null);
        const paketiOtpremljeni = sviPaketi.filter(p => p.otpremnica_id !== null);

        const ukupnoPaketaM3 = sviPaketi.reduce((s, p) => s + parseFloat(p.kolicina_final || 0), 0);
        const naStanjuM3 = paketiNaStanju.reduce((s, p) => s + parseFloat(p.kolicina_final || 0), 0);

        const sviTrupci = baza.tabela_trupci || [];
        const trupciNaLageru = sviTrupci.filter(t => t.zakljucen_prijem && t.status === 'na_lageru');
        const prorezaniTrupci = sviTrupci.filter(t => t.status === 'prorezano');
        const ulazProrezanoM3 = prorezaniTrupci.reduce((s, t) => s + parseFloat(t.kontrolna_zapremina || t.zapremina || 0), 0);
        const trupciNaLageruM3 = trupciNaLageru.reduce((s, t) => s + parseFloat(t.kontrolna_zapremina || t.zapremina || 0), 0);

        // Prinos (Yield) Pilane (izlaz paketa sa Pilane / prorezani trupci) + omjer ukupnog inventara
        const paketiPilana = sviPaketi.filter(p => {
            const m = (p.masina || '').toUpperCase();
            return (m.includes('PILANA') || m.includes('BRENTA')) && (!p.ai_sirovina_ids || p.ai_sirovina_ids.length === 0);
        });
        const izlazPilanaM3 = paketiPilana.reduce((s, p) => s + parseFloat(p.kolicina_final || 0), 0);
        const prinosPilanaProc = ulazProrezanoM3 > 0 ? ((izlazPilanaM3 / ulazProrezanoM3) * 100).toFixed(1) : "0.0";
        const omjerUkupnoProc = ulazProrezanoM3 > 0 ? ((ukupnoPaketaM3 / ulazProrezanoM3) * 100).toFixed(1) : "0.0";

        const sveTransakcije = baza.tabela_blagajna_troskovi || [];
        const sviRacuni = baza.tabela_izdati_racuni || [];
        const placeniRacuni = sviRacuni.filter(r => r.status === 'NAPLAĆENO');
        const otvoreniRacuni = sviRacuni.filter(r => r.status !== 'NAPLAĆENO');

        const ukupnoSviRacuniIznos = sviRacuni.reduce((s, r) => s + parseFloat(r.ukupno_sa_pdv || 0), 0);
        const nominalnoOtvoreniIznos = otvoreniRacuni.reduce((s, r) => s + parseFloat(r.ukupno_sa_pdv || 0), 0);

        // 🟢 Tačan obračun stvarnog preostalog duga za svaki otvoreni račun (umanjen za sve uplate u Blagajni!)
        let stvarniPreostaliDug = 0;
        const detaljiOtvorenihRacuna = otvoreniRacuni.map(r => {
            const rid = (r.id || '').toUpperCase().trim();
            const ukupnoRacun = parseFloat(r.ukupno_sa_pdv || 0);
            const uplacenoUBlagajni = sveTransakcije
                .filter(t => t.tip === 'ULAZ' && (
                    (t.racun_id && t.racun_id.toUpperCase().trim() === rid) ||
                    (t.opis && t.opis.toUpperCase().includes(rid))
                ))
                .reduce((s, t) => s + parseFloat(t.iznos || 0), 0);
            const uplacenoPolje = parseFloat(r.uplaceno || 0);
            const stvarnoPlaceno = Math.max(uplacenoUBlagajni, uplacenoPolje);
            const preostalo = Math.max(0, parseFloat((ukupnoRacun - stvarnoPlaceno).toFixed(2)));
            stvarniPreostaliDug += preostalo;
            return `**${r.id}** (Kupac: **${r.kupac_naziv}**, Ukupno: ${ukupnoRacun.toFixed(2)} KM, Već uplaćeno: ${stvarnoPlaceno.toFixed(2)} KM, Stvarni preostali dug: **${preostalo.toFixed(2)} KM**)`;
        });

        const ukupnoNaplaceno = placeniRacuni.reduce((s, r) => s + parseFloat(r.ukupno_sa_pdv || 0), 0);

        const ulazKasa = sveTransakcije.filter(t => t.tip === 'ULAZ').reduce((s, t) => s + parseFloat(t.iznos || 0), 0);
        const izlazKasa = sveTransakcije.filter(t => t.tip === 'IZLAZ').reduce((s, t) => s + parseFloat(t.iznos || 0), 0);
        const stanjeKase = ulazKasa - izlazKasa;

        const sveReklamacije = baza.tabela_reklamacije_i_povrati || [];
        const odobreneReklamacije = sveReklamacije.filter(r => r.status === 'ODOBRENO');
        const reklamacijeM3 = odobreneReklamacije.reduce((s, r) => s + parseFloat(r.kolicina || 0), 0);
        const aktivniNalozi = (baza.tabela_radni_nalozi || []).filter(n => n.status !== 'ZAVRŠENO' && n.status !== 'OBRISANO');

        // 🟢 Ako korisnik pita za specifičan paket (npr. "57") ili dokument, prikaži pune detalje tog paketa na samom vrhu!
        let posebniDetalji = [];
        const rijeciUpita = (pitanje || '').toUpperCase().split(/[\s,?.!:;"'()]+/).filter(Boolean);
        const trazeniPaketi = sviPaketi.filter(p => rijeciUpita.includes(String(p.paket_id).toUpperCase()));
        if (trazeniPaketi.length > 0) {
            const pid = trazeniPaketi[0].paket_id;
            const m3Pak = trazeniPaketi.reduce((s, x) => s + parseFloat(x.kolicina_final || 0), 0);
            const komPak = trazeniPaketi.reduce((s, x) => s + parseFloat(x.kolicina_ulaz || 0), 0);
            const stPak = trazeniPaketi[0].otpremnica_id ? `OTPREMLJENO (${trazeniPaketi[0].otpremnica_id})` : (trazeniPaketi[0].closed_at ? 'NA STANJU (Završen paket na lageru)' : 'U PROIZVODNJI');
            const opisStavki = trazeniPaketi.map(x => `${x.naziv_proizvoda} — Dimenzije: **${x.debljina}x${x.sirina}x${x.duzina} cm**, Količina: **${x.kolicina_ulaz} ${x.jm || 'kom'}** (**${parseFloat(x.kolicina_final || 0).toFixed(3)} m³**), Mašina: ${x.masina || '-'}`).join(' | ');
            posebniDetalji.push(
                `**🔎 Detalji traženog paketa ${pid}:**`,
                `* Identitet paketa: **Paket ${pid}** | Status: **${stPak}**`,
                `* Sadržaj i dimenzije: ${opisStavki}`,
                `* Ukupna količina i volumen paketa ${pid}: **${komPak} ${trazeniPaketi[0].jm || 'kom'}** (**${m3Pak.toFixed(3)} m³**) | Vezni nalog: **${trazeniPaketi[0].broj_veze || 'Slobodna roba'}**`
            );
        }

        return [
            `Na osnovu trenutnog stanja u ERP bazi podataka, evo tačnog izvještaja za tvoj upit:`,
            ...(posebniDetalji.length > 0 ? [``, ...posebniDetalji] : []),
            ``,
            `**🧾 Računi i Stvarni Preostali Dug (Otvorena potraživanja):**`,
            `* Ukupno svih računa u bazi: **${sviRacuni.length} računa** (Ukupna vrijednost svih računa: **${ukupnoSviRacuniIznos.toFixed(2)} KM**)`,
            `* Plaćeni (arhivirani) računi: **${placeniRacuni.length} računa** (Ukupno naplaćeno u arhivi: **${ukupnoNaplaceno.toFixed(2)} KM**)`,
            `* Otvoreni (neplaćeni / djelimični) računi: **${otvoreniRacuni.length} računa**`,
            `* **Stvarni preostali dug na otvorenim računima (nakon uračunatih uplata): ${stvarniPreostaliDug.toFixed(2)} KM** (Nominalni zbir otvorenih računa prije oduzimanja uplata: ${nominalnoOtvoreniIznos.toFixed(2)} KM)`,
            `* Identiteti i detalji otvorenih računa: ${detaljiOtvorenihRacuna.join(' ; ') || 'Nema otvorenih računa'}`,
            ``,
            `**📦 Paketi i Proizvodnja (Prinos / Yield):**`,
            `* Ukupno paketa u bazi (svi statusi: lager + u proizvodnji + otpremljeno + ručni ulaz): **${sviPaketi.length} paketa** (ukupnog volumena **${ukupnoPaketaM3.toFixed(3)} m³**)`,
            `* Zaključani paketi trenutno na stanju (Lager): **${paketiNaStanju.length} paketa** (**${naStanjuM3.toFixed(3)} m³**)`,
            `* Otpremljeni paketi kupcima: **${paketiOtpremljeni.length} paketa** | U radu na mašinama: **${paketiURadu.length} paketa**`,
            `* Proizvodni prinos Pilane (izlaz Pilane ${izlazPilanaM3.toFixed(3)} m³ / prorezani trupci ${ulazProrezanoM3.toFixed(3)} m³): **${prinosPilanaProc}%** (Omjer ukupnog inventara svih paketa prema prorezanim trupcima: ${omjerUkupnoProc}%)`,
            ``,
            `**🪵 Sirovina (Trupci na placu):**`,
            `* Trupci spremni na lageru: **${trupciNaLageru.length} kom** (**${trupciNaLageruM3.toFixed(3)} m³**)`,
            `* Ukupno prorezano trupaca: **${prorezaniTrupci.length} kom** (**${ulazProrezanoM3.toFixed(3)} m³**)`,
            ``,
            `**💰 Blagajna (Gotovina):**`,
            `* Trenutno stanje gotovine u Blagajni: **${stanjeKase.toFixed(2)} KM** (Ulaz: **${ulazKasa.toFixed(2)} KM** | Izlaz: **${izlazKasa.toFixed(2)} KM**)`,
            ``,
            `**⚙️ Nalozi, Katalog i Reklamacije:**`,
            `* Aktivni radni nalozi: **${aktivniNalozi.length}** | Artikala u katalogu: **${(baza.tabela_katalog_artikala || []).length}**`,
            `* Evidentirane reklamacije: **${sveReklamacije.length}** (Odobreno: **${odobreneReklamacije.length}** — ukupno **${reklamacijeM3.toFixed(3)} m³**)`
        ].join('\n');
    };

    const posaljiPoruku = async () => {
        if (!input.trim()) return;

        const userText = input.trim();
        setMessages(prev => [...prev, { role: 'user', text: userText }]);
        setInput('');
        setIsTyping(true);

        try {
            const dbObject = await fetchCijelaBaza();
            // Uvijek koristi deterministički ERP analitički motor koji garantuje 100% tačne brojeve iz baze bez halucinacija!
            const lokalniOdgovor = generisiPametniLokalniOdgovor(dbObject, userText);
            setMessages(prev => [...prev, { role: 'ai', text: lokalniOdgovor }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'ai', text: 'Došlo je do greške pri analizi baze podataka.' }]);
        }
        
        setIsTyping(false);
    };
    const bojaAkcenta = saas?.ui?.boja_akcenta || '#3b82f6';

    return (
        <div className="relative max-w-4xl mx-auto h-[750px] flex flex-col bg-theme-card rounded-box border border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95">
            
            <div className="p-5 border-b border-theme-border flex flex-wrap justify-between items-center gap-3 bg-theme-card z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-theme-card border border-slate-700 flex items-center justify-center text-2xl shadow-inner">🤖</div>
                    <div>
                        <h3 className="text-theme-text font-black uppercase tracking-widest text-sm">TTM AI Kontrolor</h3>
                        <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span> 
                            Puni pristup bazi | Direktna ERP Analitika Aktivna
                        </p>
                    </div>
                </div>
                <button onClick={() => setShowKeyInput(!showKeyInput)} className="text-[9px] text-slate-400 hover:text-white bg-theme-panel px-3 py-1.5 rounded-lg border border-theme-border uppercase font-black">
                    🔑 API Ključ (Opciono)
                </button>
            </div>

            {showKeyInput && (
                <div className="p-3 bg-theme-panel border-b border-theme-border flex gap-2 items-center">
                    <input
                        type="password"
                        value={customKey}
                        onChange={e => { setCustomKey(e.target.value); localStorage.setItem('erp_gemini_key', e.target.value); }}
                        placeholder="Unesi opcioni Gemini API ključ (ili ostavi prazno za ugrađeni ERP analitički motor)..."
                        className="flex-1 min-w-0 p-2 bg-theme-card border border-theme-border rounded-lg text-xs text-theme-text outline-none"
                    />
                    <button onClick={() => setShowKeyInput(false)} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase">Sačuvaj</button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-theme-main custom-scrollbar">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] md:max-w-[75%] p-5 rounded-2xl shadow-md ${msg.role === 'user' ? 'bg-theme-panel text-theme-text rounded-tr-sm border border-theme-border' : 'bg-theme-card text-theme-text rounded-tl-sm border border-blue-500/20'}`}>
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
                        placeholder="Pitaj nešto, npr: Koji nam je ukupni prinos i koliko imamo paketa u bazi?" 
                        disabled={isTyping} 
                        className="w-full p-5 pr-20 bg-theme-panel rounded-2xl text-sm text-theme-text font-bold outline-none border border-theme-border focus:border-blue-500 transition-all disabled:opacity-50" 
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