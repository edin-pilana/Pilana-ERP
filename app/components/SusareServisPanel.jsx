"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { Flame, Wrench, Plus, CheckCircle2, AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { toast } from 'sonner';
import { toLocalIso, prikazDatumaBHS } from '../utils/dateHelpers';
import MasterSearch, { normalizujZaPretragu } from './MasterSearch';
import DatumInput from './DatumInput';

const SUSARE_KEY = 'susare_sarze';
const SERVIS_KEY = 'servis_masina_pila';

export default function SusareServisPanel({ user }) {
    const [subTab, setSubTab] = useState('susare'); // 'susare' | 'servis'
    const [loading, setLoading] = useState(true);

    // Sušare state
    const [sarze, setSarze] = useState([]);
    const [paketiLager, setPaketiLager] = useState([]);
    const [novaSarza, setNovaSarza] = useState({
        komora: 'SUŠARA 1',
        paket_id: '',
        datum_ulaska: toLocalIso(new Date()),
        plan_zavrsetak: toLocalIso(new Date(Date.now() + 7 * 86400000)),
        pocetna_vlaga: '35',
        ciljna_vlaga: '10',
        napomena: '',
    });

    // Servis mašina & oštrenje pila state
    const [masine, setMasine] = useState([]);
    const [prorezLog, setProrezLog] = useState([]);
    const [servisZapisi, setServisZapisi] = useState([]);
    const [noviServis, setNoviServis] = useState({
        masina: '',
        tip: 'OŠTRENJE / ZAMJENA PILE',
        interval_m3: '50',
        interval_dana: '14',
        napomena: '',
    });

    const ucitajSve = async () => {
        setLoading(true);
        try {
            const [sRes, srvRes, pkRes, mRes, prRes] = await Promise.all([
                supabase.from('ui_postavke').select('postavke_jsonb').eq('modul_ime', SUSARE_KEY).maybeSingle(),
                supabase.from('ui_postavke').select('postavke_jsonb').eq('modul_ime', SERVIS_KEY).maybeSingle(),
                supabase.from('paketi').select('paket_id, naziv_proizvoda, debljina, sirina, duzina, kolicina_final, status, otpremnica_id').is('otpremnica_id', null).gt('kolicina_final', 0).limit(500),
                supabase.from('masine').select('id, naziv').order('naziv'),
                supabase.from('prorez_log').select('masina, zapremina, datum, created_at').limit(1500),
            ]);

            setSarze(Array.isArray(sRes.data?.postavke_jsonb?.lista) ? sRes.data.postavke_jsonb.lista : []);
            setServisZapisi(Array.isArray(srvRes.data?.postavke_jsonb?.lista) ? srvRes.data.postavke_jsonb.lista : []);

            const pkMap = {};
            (pkRes.data || []).forEach((p) => {
                if (!p.paket_id) return;
                const st = String(p.status || '').toUpperCase();
                if (st === 'POTROŠENO_U_DORADI' || st === 'POVRAT_REKLAMACIJA') return;
                if (!pkMap[p.paket_id]) {
                    pkMap[p.paket_id] = { paket_id: p.paket_id, naziv_proizvoda: p.naziv_proizvoda, dim: `${p.debljina}x${p.sirina}x${p.duzina} cm`, m3: 0 };
                }
                pkMap[p.paket_id].m3 += parseFloat(p.kolicina_final || 0) || 0;
            });
            setPaketiLager(Object.values(pkMap));
            setMasine(mRes.data || []);
            setProrezLog(prRes.data || []);
            if (mRes.data?.[0]?.naziv && !noviServis.masina) {
                setNoviServis((prev) => ({ ...prev, masina: mRes.data[0].naziv }));
            }
        } catch (e) {
            console.error('Greška pri učitavanju sušara/servisa:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { ucitajSve(); }, []);

    const sacuvajSarze = async (novaLista) => {
        setSarze(novaLista);
        const { error } = await supabase
            .from('ui_postavke')
            .upsert([{ modul_ime: SUSARE_KEY, postavke_jsonb: { lista: novaLista } }], { onConflict: 'modul_ime' });
        if (error) toast.error('Greška pri snimanju sušare: ' + error.message);
    };

    const dodajSarzu = async () => {
        if (!novaSarza.komora.trim() || !novaSarza.paket_id.trim()) {
            return toast.warning('Unesite komoru sušare i odaberite paket!');
        }
        const pk = paketiLager.find((p) => p.paket_id === novaSarza.paket_id);
        const zapis = {
            id: `SUS-${Date.now().toString().slice(-6)}`,
            ...novaSarza,
            proizvod: pk?.naziv_proizvoda || '',
            m3: pk ? parseFloat(pk.m3.toFixed(3)) : 0,
            status: 'U SUŠENJU',
            snimio: user?.ime_prezime || 'Operater',
            created_at: new Date().toISOString(),
        };
        await sacuvajSarze([zapis, ...sarze]);
        setNovaSarza((prev) => ({ ...prev, paket_id: '', napomena: '' }));
        toast.success(`Paket ${zapis.paket_id} ubačen u ${zapis.komora}!`);
    };

    const zavrsiSarzu = async (id) => {
        const nova = sarze.map((s) => (s.id === id ? { ...s, status: 'ZAVRŠENO', datum_zavrsetka: toLocalIso(new Date()) } : s));
        await sacuvajSarze(nova);
        toast.success('Šarža označena kao završena (spremna za vađenje)!');
    };

    const obrisiSarzu = async (id) => {
        await sacuvajSarze(sarze.filter((s) => s.id !== id));
        toast.info('Zapis sušare uklonjen.');
    };

    // SERVIS MAŠINA & OŠTRENJE PILA
    const sacuvajServise = async (novaLista) => {
        setServisZapisi(novaLista);
        const { error } = await supabase
            .from('ui_postavke')
            .upsert([{ modul_ime: SERVIS_KEY, postavke_jsonb: { lista: novaLista } }], { onConflict: 'modul_ime' });
        if (error) toast.error('Greška pri snimanju servisa: ' + error.message);
    };

    const evidentirajServis = async () => {
        if (!noviServis.masina) return toast.warning('Odaberite mašinu!');
        const zapis = {
            id: `SRV-${Date.now().toString().slice(-6)}`,
            masina: noviServis.masina,
            tip: noviServis.tip,
            datum: toLocalIso(new Date()),
            interval_m3: Math.max(0, parseFloat(noviServis.interval_m3) || 50),
            interval_dana: Math.max(0, parseInt(noviServis.interval_dana, 10) || 14),
            napomena: noviServis.napomena,
            izvrsio: user?.ime_prezime || 'Operater',
            created_at: new Date().toISOString(),
        };
        await sacuvajServise([zapis, ...servisZapisi]);
        setNoviServis((p) => ({ ...p, napomena: '' }));
        toast.success(`Evidentiran servis (${zapis.tip}) za mašinu ${zapis.masina}!`);
    };

    // Izračun stanja po svakoj mašini (koliko m³ i dana je prošlo od zadnjeg oštrenja/servisa!)
    const statusMasina = useMemo(() => {
        const danasIso = toLocalIso(new Date());
        const danasMs = new Date(`${danasIso}T12:00:00`).getTime();

        return masine.map((m) => {
            const zadnji = servisZapisi.find((s) => String(s.masina || '').toUpperCase() === String(m.naziv || '').toUpperCase());
            const odDatuma = zadnji?.datum || '2025-01-01';
            const mUp = String(m.naziv || '').toUpperCase();
            const mAlt = mUp.includes('PILANA') ? mUp.replace('PILANA', 'BRENTA') : mUp;

            const prorezOdServisa = prorezLog
                .filter((l) => {
                    const lm = String(l.masina || '').toUpperCase();
                    const d = String(l.datum || l.created_at || '').slice(0, 10);
                    return (lm === mUp || lm === mAlt) && d >= odDatuma;
                })
                .reduce((s, l) => s + (parseFloat(l.zapremina || 0) || 0), 0);

            const danaOdServisa = zadnji?.datum
                ? Math.max(0, Math.round((danasMs - new Date(`${zadnji.datum}T12:00:00`).getTime()) / 86400000))
                : null;

            const pragM3 = parseFloat(zadnji?.interval_m3 || 50) || 50;
            const pragDana = parseInt(zadnji?.interval_dana || 14, 10) || 14;
            const alarmM3 = prorezOdServisa >= pragM3;
            const alarmDani = danaOdServisa !== null && danaOdServisa >= pragDana;
            const upozorenje = !alarmM3 && !alarmDani && (prorezOdServisa >= pragM3 * 0.8 || (danaOdServisa !== null && danaOdServisa >= pragDana * 0.8));

            return {
                naziv: m.naziv,
                zadnji,
                prorezOdServisa: parseFloat(prorezOdServisa.toFixed(2)),
                danaOdServisa,
                pragM3,
                pragDana,
                stanje: alarmM3 || alarmDani ? 'ALARM' : upozorenje ? 'USKORO' : 'OK',
            };
        });
    }, [masine, servisZapisi, prorezLog]);

    const danasIso = toLocalIso(new Date());

    return (
        <div data-testid="susare-servis-panel" className="space-y-6 animate-in fade-in">
            <div className="flex flex-wrap gap-2 bg-theme-panel p-1.5 rounded-2xl border border-theme-border max-w-xl mx-auto">
                <button
                    type="button"
                    onClick={() => setSubTab('susare')}
                    className={`flex-1 py-3 px-4 rounded-xl text-[11px] font-black uppercase flex items-center justify-center gap-2 transition-all ${subTab === 'susare' ? 'bg-orange-600 text-white shadow-lg' : 'text-theme-muted hover:text-theme-text'}`}
                >
                    <Flame size={15} /> Sušare ({sarze.filter((s) => s.status === 'U SUŠENJU').length} aktivnih)
                </button>
                <button
                    type="button"
                    onClick={() => setSubTab('servis')}
                    className={`flex-1 py-3 px-4 rounded-xl text-[11px] font-black uppercase flex items-center justify-center gap-2 transition-all ${subTab === 'servis' ? 'bg-blue-600 text-white shadow-lg' : 'text-theme-muted hover:text-theme-text'}`}
                >
                    <Wrench size={15} /> Održavanje Mašina & Pila ({statusMasina.filter((m) => m.stanje === 'ALARM').length} alarma)
                </button>
            </div>

            {subTab === 'susare' ? (
                <div className="space-y-5">
                    <div className="bg-theme-card p-6 rounded-2xl border border-orange-500/40 shadow-xl space-y-4">
                        <h3 className="text-orange-400 font-black uppercase text-xs tracking-widest flex items-center gap-2">
                            <Flame size={16} /> Ubaci Paket u Komoru Sušare
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="text-[9px] text-theme-muted uppercase font-black block mb-1">Komora Sušare</label>
                                <input value={novaSarza.komora} onChange={(e) => setNovaSarza((p) => ({ ...p, komora: e.target.value.toUpperCase() }))} className="w-full p-3 rounded-xl bg-theme-panel border border-theme-border text-xs font-black text-theme-text" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[9px] text-theme-muted uppercase font-black block mb-1">Paket sa lagera (neisporučeni)</label>
                                <MasterSearch
                                    data={paketiLager}
                                    poljaZaPretragu={['paket_id', 'naziv_proizvoda', 'dim']}
                                    value={novaSarza.paket_id}
                                    onChange={(v) => setNovaSarza((p) => ({ ...p, paket_id: v }))}
                                    onSelect={(pk) => setNovaSarza((p) => ({ ...p, paket_id: pk.paket_id }))}
                                    placeholder="Pronađi paket po ID-u ili nazivu..."
                                    renderItem={(pk) => (
                                        <div className="flex justify-between text-xs">
                                            <span className="font-black">{pk.paket_id} — {pk.naziv_proizvoda} ({pk.dim})</span>
                                            <span className="font-black text-emerald-400">{pk.m3.toFixed(3)} m³</span>
                                        </div>
                                    )}
                                />
                            </div>
                            <div>
                                <label className="text-[9px] text-theme-muted uppercase font-black block mb-1">Datum ulaska</label>
                                <DatumInput value={novaSarza.datum_ulaska} onChange={(e) => setNovaSarza((p) => ({ ...p, datum_ulaska: e.target.value }))} className="w-full" />
                            </div>
                            <div>
                                <label className="text-[9px] text-theme-muted uppercase font-black block mb-1">Planirani završetak</label>
                                <DatumInput value={novaSarza.plan_zavrsetak} onChange={(e) => setNovaSarza((p) => ({ ...p, plan_zavrsetak: e.target.value }))} className="w-full" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[9px] text-theme-muted uppercase font-black block mb-1">Ulazna vlaga %</label>
                                    <input type="number" value={novaSarza.pocetna_vlaga} onChange={(e) => setNovaSarza((p) => ({ ...p, pocetna_vlaga: e.target.value }))} className="w-full p-3 rounded-xl bg-theme-panel border border-theme-border text-xs font-black text-center text-theme-text" />
                                </div>
                                <div>
                                    <label className="text-[9px] text-theme-muted uppercase font-black block mb-1">Ciljna vlaga %</label>
                                    <input type="number" value={novaSarza.ciljna_vlaga} onChange={(e) => setNovaSarza((p) => ({ ...p, ciljna_vlaga: e.target.value }))} className="w-full p-3 rounded-xl bg-theme-panel border border-theme-border text-xs font-black text-center text-emerald-400" />
                                </div>
                            </div>
                        </div>
                        <button type="button" onClick={dodajSarzu} className="w-full py-3.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg">
                            <Plus size={15} /> Pokreni Šaržu Sušenja
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sarze.length === 0 ? (
                            <div className="col-span-full p-10 text-center bg-theme-card rounded-2xl border border-dashed border-theme-border text-xs text-theme-muted italic">
                                Trenutno nema evidentiranih šarži u sušarama.
                            </div>
                        ) : sarze.map((s) => {
                            const spremno = s.status === 'U SUŠENJU' && s.plan_zavrsetak && s.plan_zavrsetak <= danasIso;
                            return (
                                <div key={s.id} className={`p-5 rounded-2xl border-2 bg-theme-card space-y-2.5 shadow-lg ${s.status === 'ZAVRŠENO' ? 'border-emerald-500/30 opacity-75' : spremno ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-orange-500/40'}`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-black uppercase text-orange-400">🔥 {s.komora}</span>
                                        <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${s.status === 'ZAVRŠENO' ? 'bg-emerald-500/20 text-emerald-400' : spremno ? 'bg-amber-500 text-black animate-pulse' : 'bg-orange-500/20 text-orange-300'}`}>
                                            {spremno ? '🔔 SPREMNO ZA VAĐENJE' : s.status}
                                        </span>
                                    </div>
                                    <div className="text-sm font-black text-theme-text font-mono">{s.paket_id} <span className="text-xs font-sans text-theme-muted font-bold ml-1">{s.proizvod}</span></div>
                                    <div className="flex flex-wrap gap-3 text-[11px] font-bold text-theme-muted">
                                        <span>📅 Ulaz: <b className="text-theme-text">{prikazDatumaBHS(s.datum_ulaska)}</b></span>
                                        <span>🏁 Plan kraj: <b className="text-amber-400">{prikazDatumaBHS(s.plan_zavrsetak)}</b></span>
                                        <span>💧 Vlaga: <b className="text-sky-400">{s.pocetna_vlaga}% → {s.ciljna_vlaga}%</b></span>
                                        {s.m3 > 0 && <span>📦 <b className="text-emerald-400">{s.m3} m³</b></span>}
                                    </div>
                                    <div className="flex gap-2 pt-2 border-t border-theme-border">
                                        {s.status === 'U SUŠENJU' && (
                                            <button type="button" onClick={() => zavrsiSarzu(s.id)} className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase flex items-center justify-center gap-1">
                                                <CheckCircle2 size={13} /> Izvadi / Završi
                                            </button>
                                        )}
                                        <button type="button" onClick={() => obrisiSarzu(s.id)} className="px-3 py-2 rounded-xl bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white text-[10px] font-black uppercase">
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="space-y-5">
                    {/* STATUS SVIH MAŠINA PO PROIZVODNJI I DANIMA OD ZADNJEG OŠTRENJA / SERVISA */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {statusMasina.map((m) => (
                            <div key={m.naziv} className={`p-4 rounded-2xl border-2 bg-theme-card space-y-2 ${m.stanje === 'ALARM' ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : m.stanje === 'USKORO' ? 'border-amber-500/60' : 'border-theme-border'}`}>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-black uppercase text-theme-text">⚙️ {m.naziv}</span>
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${m.stanje === 'ALARM' ? 'bg-red-600 text-white' : m.stanje === 'USKORO' ? 'bg-amber-500 text-black' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                        {m.stanje === 'ALARM' ? '🚨 VRIJEME ZA SERVIS' : m.stanje === 'USKORO' ? '⚠️ USKORO' : '✅ UREDNO'}
                                    </span>
                                </div>
                                <div className="text-[11px] text-theme-muted font-bold space-y-1">
                                    <div>Prorez od zadnjeg servisa: <b className="text-theme-text">{m.prorezOdServisa} / {m.pragM3} m³</b></div>
                                    <div>Zadnji servis: <b className="text-theme-text">{m.zadnji ? `${prikazDatumaBHS(m.zadnji.datum)} (${m.zadnji.tip})` : 'Nije evidentiran'}</b></div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* UNOS NOVOG SERVISA / OŠTRENJA PILE */}
                    <div className="bg-theme-card p-6 rounded-2xl border border-blue-500/40 shadow-xl space-y-4">
                        <h3 className="text-blue-400 font-black uppercase text-xs tracking-widest flex items-center gap-2">
                            <Wrench size={16} /> Evidentiraj Oštrenje Pile / Servis Mašine
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                                <label className="text-[9px] text-theme-muted uppercase font-black block mb-1">Mašina</label>
                                <select value={noviServis.masina} onChange={(e) => setNoviServis((p) => ({ ...p, masina: e.target.value }))} className="w-full p-3 rounded-xl bg-theme-panel border border-theme-border text-xs font-black text-theme-text">
                                    {masine.map((m) => <option key={m.id} value={m.naziv}>{m.naziv}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[9px] text-theme-muted uppercase font-black block mb-1">Vrsta Zahvata</label>
                                <select value={noviServis.tip} onChange={(e) => setNoviServis((p) => ({ ...p, tip: e.target.value }))} className="w-full p-3 rounded-xl bg-theme-panel border border-theme-border text-xs font-black text-theme-text">
                                    <option value="OŠTRENJE / ZAMJENA PILE">Oštrenje / Zamjena lista pile</option>
                                    <option value="PODMAZIVANJE I PREGLED">Podmazivanje i pregled</option>
                                    <option value="VELIKI SERVIS / REMENI">Veliki servis / Remeni / Ležajevi</option>
                                    <option value="POPRAVKA KVARA">Popravka kvara</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[9px] text-theme-muted uppercase font-black block mb-1">Alarm nakon (m³ proreza)</label>
                                <input type="number" value={noviServis.interval_m3} onChange={(e) => setNoviServis((p) => ({ ...p, interval_m3: e.target.value }))} className="w-full p-3 rounded-xl bg-theme-panel border border-theme-border text-xs font-black text-center text-theme-text" />
                            </div>
                            <div>
                                <label className="text-[9px] text-theme-muted uppercase font-black block mb-1">Alarm nakon (dana)</label>
                                <input type="number" value={noviServis.interval_dana} onChange={(e) => setNoviServis((p) => ({ ...p, interval_dana: e.target.value }))} className="w-full p-3 rounded-xl bg-theme-panel border border-theme-border text-xs font-black text-center text-theme-text" />
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input value={noviServis.napomena} onChange={(e) => setNoviServis((p) => ({ ...p, napomena: e.target.value }))} placeholder="Napomena (npr. zamijenjen list 120mm, stavljen novi ležaj)..." className="flex-1 p-3 rounded-xl bg-theme-panel border border-theme-border text-xs text-theme-text" />
                            <button type="button" onClick={evidentirajServis} className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase shadow-lg shrink-0">
                                ✅ Snimi Servis
                            </button>
                        </div>
                    </div>

                    {servisZapisi.length > 0 && (
                        <div className="bg-theme-card p-5 rounded-2xl border border-theme-border space-y-2">
                            <h4 className="text-[10px] font-black uppercase text-theme-muted tracking-widest mb-2">Historija Servisa i Oštrenja ({servisZapisi.length})</h4>
                            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                                {servisZapisi.slice(0, 25).map((s) => (
                                    <div key={s.id} className="p-3 rounded-xl bg-theme-panel border border-theme-border flex items-center justify-between gap-2 text-xs">
                                        <div>
                                            <span className="font-black text-blue-400">{s.masina}</span>
                                            <span className="font-bold text-theme-text ml-2">{s.tip}</span>
                                            {s.napomena && <p className="text-[10px] text-theme-muted mt-0.5">{s.napomena}</p>}
                                        </div>
                                        <div className="text-right shrink-0 text-[10px] text-theme-muted font-bold">
                                            <div>{prikazDatumaBHS(s.datum)}</div>
                                            <div>👤 {s.izvrsio}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
