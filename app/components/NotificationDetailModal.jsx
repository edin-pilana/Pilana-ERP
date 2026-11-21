"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { X, History, CheckCircle2, XCircle, ExternalLink, ShieldCheck, Clock, User, AlertTriangle, Bell, FileSearch } from 'lucide-react';
import { supabase, formatDbError } from '../utils/supabaseClient';
import { toast } from 'sonner';
import {
    MODUL_META,
    odrediModuleNotifikacije,
    getNazivModula,
    izvuciEntiteteNotifikacije,
    ocistiTekstDetalja,
    daLiJeLicnaNotifikacijaZaKorisnika,
    daLiKorisnikImaDozvoluZaModul,
    daLiKorisnikMozeOdobriti,
    daLiJeProcitanoZaKorisnika,
    oznaciNotifikacijuProcitanom,
    posaljiNotifikaciju,
} from '../utils/notificationHelpers';

const formatDatumVrijeme = (iso) => {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso);
        return d.toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch (e) {
        return String(iso);
    }
};

const sanitizeOrToken = (val) => String(val || '').replace(/[,()%*'"]/g, '').trim();

export default function NotificationDetailModal({ notification, user, onClose, onActionComplete }) {
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [historija, setHistorija] = useState([]);
    const [povezaniZapis, setPovezaniZapis] = useState(null);
    const [actionBusy, setActionBusy] = useState(false);

    const parsed = notification ? izvuciEntiteteNotifikacije(notification) : null;
    const moduli = notification ? odrediModuleNotifikacije(notification) : [];
    const primarniModul = moduli[0] || null;
    const isPersonalForMe = notification ? daLiJeLicnaNotifikacijaZaKorisnika(notification, user) : false;
    const isAdminOrSuper = user?.uloga === 'superadmin' || user?.uloga === 'admin';
    const jeProcitano = notification ? daLiJeProcitanoZaKorisnika(notification, user) : true;

    const ucitajDetaljeIHistoriju = useCallback(async () => {
        if (!notification || !parsed) return;
        setLoadingHistory(true);
        try {
            const { ponudaId, rnId, otpremnicaId, racunId, paketId, trupacId, zahtjevId, reklamacijaId, radnikIme, allTokens, approvalType, meta } = parsed;

            // 1. Dohvati živo stanje povezanog dokumenta/zahtjeva iz baze
            let liveEntity = null;
            const chainTokens = new Set(allTokens);

            if (approvalType === 'ZAHTJEV_ODMOR' || meta.entity_type === 'zahtjev_odsustva' || zahtjevId) {
                let zRow = null;
                if (zahtjevId) {
                    const { data } = await supabase.from('zahtjevi_odsustva').select('*').eq('id', zahtjevId).maybeSingle();
                    zRow = data;
                }
                if (!zRow && radnikIme) {
                    const { data } = await supabase
                        .from('zahtjevi_odsustva')
                        .select('*')
                        .eq('radnik_ime', radnikIme)
                        .order('created_at', { ascending: false })
                        .limit(1);
                    if (data && data.length > 0) zRow = data[0];
                }
                if (zRow) {
                    liveEntity = { tip: 'ZAHTJEV_ODMOR', data: zRow };
                    chainTokens.add(String(zRow.id));
                }
            } else if (approvalType === 'REKLAMACIJA' || meta.entity_type === 'reklamacija' || reklamacijaId) {
                let rRow = null;
                if (reklamacijaId) {
                    const { data } = await supabase.from('reklamacije').select('*').eq('id', reklamacijaId).maybeSingle();
                    rRow = data;
                }
                if (!rRow && paketId) {
                    const { data } = await supabase
                        .from('reklamacije')
                        .select('*')
                        .eq('paket_id', paketId)
                        .order('created_at', { ascending: false })
                        .limit(1);
                    if (data && data.length > 0) rRow = data[0];
                }
                if (rRow) {
                    liveEntity = { tip: 'REKLAMACIJA', data: rRow };
                    if (rRow.paket_id) chainTokens.add(rRow.paket_id);
                    if (rRow.broj_otpremnice && rRow.broj_otpremnice !== 'NEPOZNATO') chainTokens.add(rRow.broj_otpremnice);
                }
            } else if (ponudaId || rnId) {
                const [ponRes, rnRes] = await Promise.all([
                    ponudaId ? supabase.from('ponude').select('*').eq('id', ponudaId).maybeSingle() : Promise.resolve({ data: null }),
                    rnId ? supabase.from('radni_nalozi').select('*').eq('id', rnId).maybeSingle() : Promise.resolve({ data: null }),
                ]);
                let ponData = ponRes.data;
                let rnData = rnRes.data;

                if (!rnData && ponData) {
                    const { data } = await supabase.from('radni_nalozi').select('*').eq('broj_ponude', ponData.id).neq('status', 'OBRISANO').limit(1);
                    if (data && data[0]) rnData = data[0];
                }
                if (!ponData && rnData?.broj_ponude) {
                    const { data } = await supabase.from('ponude').select('*').eq('id', rnData.broj_ponude).maybeSingle();
                    ponData = data;
                }

                if (ponData?.id) chainTokens.add(ponData.id);
                if (rnData?.id) chainTokens.add(rnData.id);

                if (ponData || rnData) {
                    liveEntity = { tip: 'PONUDA_RN', data: { ponuda: ponData, rn: rnData } };
                }
            } else if (otpremnicaId) {
                const { data } = await supabase.from('otpremnice').select('*').eq('id', otpremnicaId).maybeSingle();
                if (data) {
                    liveEntity = { tip: 'OTPREMNICA', data };
                    if (data.broj_veze) chainTokens.add(data.broj_veze);
                }
            } else if (racunId) {
                const { data } = await supabase.from('racuni').select('*').eq('id', racunId).maybeSingle();
                if (data) {
                    liveEntity = { tip: 'RACUN', data };
                    if (data.broj_veze) chainTokens.add(data.broj_veze);
                }
            } else if (paketId) {
                const { data } = await supabase.from('paketi').select('*').eq('paket_id', paketId).limit(1);
                if (data && data[0]) {
                    liveEntity = { tip: 'PAKET', data: data[0] };
                    if (data[0].broj_veze) chainTokens.add(data[0].broj_veze);
                    if (data[0].otpremnica_id) chainTokens.add(data[0].otpremnica_id);
                }
            } else if (trupacId) {
                const { data } = await supabase.from('trupci').select('*').eq('id', trupacId).maybeSingle();
                if (data) {
                    liveEntity = { tip: 'TRUPAC', data };
                }
            }

            setPovezaniZapis(liveEntity);

            // 2. Dohvati kompletnu hronološku historiju za ovaj entitet/problem iz sistem_audit_log
            const safeTokens = Array.from(chainTokens)
                .map(sanitizeOrToken)
                .filter((t) => t.length >= 3)
                .slice(0, 6);

            let historyRows = [];

            if (safeTokens.length > 0) {
                const orCond = safeTokens.map((t) => `detalji.ilike.%${t}%`).join(',');
                const { data } = await supabase
                    .from('sistem_audit_log')
                    .select('*')
                    .or(orCond)
                    .order('vrijeme', { ascending: true })
                    .limit(60);
                historyRows = data || [];
            } else if (radnikIme && (primarniModul === 'hr_modul' || isPersonalForMe)) {
                const safeRadnik = sanitizeOrToken(radnikIme);
                if (safeRadnik.length >= 2) {
                    const { data } = await supabase
                        .from('sistem_audit_log')
                        .select('*')
                        .or(`detalji.ilike.%${safeRadnik}%,korisnik.ilike.%${safeRadnik}%`)
                        .order('vrijeme', { ascending: true })
                        .limit(40);
                    historyRows = (data || []).filter((r) => odrediModuleNotifikacije(r).includes('hr_modul'));
                }
            } else {
                // Fallback: ista akcija ili isti korisnik u istom modulu (zadnjih 15 zapisa)
                const { data } = await supabase
                    .from('sistem_audit_log')
                    .select('*')
                    .eq('akcija', notification.akcija)
                    .order('vrijeme', { ascending: true })
                    .limit(15);
                historyRows = data || [];
            }

            // Zaštita privatnosti: običan korisnik koji otvara svoju ličnu notifikaciju vidi samo stavke vezane za sebe ili taj konkretan entitet
            if (!isAdminOrSuper && isPersonalForMe) {
                const uImeLower = String(user?.ime_prezime || '').toLowerCase();
                historyRows = historyRows.filter((row) => {
                    if (row.id === notification.id) return true;
                    if (daLiJeLicnaNotifikacijaZaKorisnika(row, user)) return true;
                    if (uImeLower && String(row.korisnik || '').toLowerCase() === uImeLower) return true;
                    if (uImeLower && String(row.detalji || '').toLowerCase().includes(uImeLower)) return true;
                    return false;
                });
            }

            // Osiguraj da je sama kliknuta notifikacija uvijek u vremenskoj liniji
            if (!historyRows.some((r) => r.id === notification.id)) {
                historyRows.push(notification);
            }

            historyRows.sort((a, b) => new Date(a.vrijeme || 0).getTime() - new Date(b.vrijeme || 0).getTime());
            setHistorija(historyRows);
        } catch (err) {
            setHistorija([notification]);
        } finally {
            setLoadingHistory(false);
        }
    }, [notification?.id]);

    useEffect(() => {
        if (notification) {
            ucitajDetaljeIHistoriju();
        }
    }, [notification, ucitajDetaljeIHistoriju]);

    if (!notification || !parsed) return null;

    const handleMarkRead = async () => {
        setActionBusy(true);
        const { error } = await oznaciNotifikacijuProcitanom(notification, user);
        setActionBusy(false);
        if (error) return toast.error('Greška pri označavanju: ' + error.message);
        toast.success('Obavještenje označeno kao pročitano.');
        if (onActionComplete) onActionComplete();
        onClose();
    };

    const handleNavigateModule = (modulKey, autoOpenId = null, autoAction = null) => {
        const meta = MODUL_META[modulKey];
        if (!meta?.appId) return;
        if (!daLiKorisnikImaDozvoluZaModul(user, modulKey)) {
            return toast.error('Nemate dozvolu za otvaranje tog modula.');
        }
        window.dispatchEvent(new CustomEvent('navigacija_na_modul', {
            detail: { modul: meta.appId, autoOpenId, autoAction }
        }));
        onClose();
    };

    // ✅ INLINE ODOBRENJE / ODBIJANJE ZAHTJEVA ZA ODMOR (HR)
    const handleObradiZahtjevOdmor = async (status, inicijativa) => {
        const z = povezaniZapis?.data;
        if (!z || !daLiKorisnikMozeOdobriti('ZAHTJEV_ODMOR', user)) return;
        setActionBusy(true);
        try {
            const { data: azuriran, error: errZ } = await supabase
                .from('zahtjevi_odsustva')
                .update({ status, inicijativa, odobrio_korisnik: user?.ime_prezime || 'Admin' })
                .eq('id', z.id)
                .eq('status', 'NA ČEKANJU')
                .select('id');

            if (errZ) throw errZ;
            if (!azuriran || azuriran.length === 0) {
                toast.warning('Ovaj zahtjev je već obrađen.');
                await ucitajDetaljeIHistoriju();
                return;
            }

            if (status === 'ODOBRENO' && z.tip_odsustva === 'GODIŠNJI') {
                const { data: radnik } = await supabase
                    .from('radnici')
                    .select('id, godisnji_ukupno, preostalo_godisnjeg, godisnji_iskoristeno_radnik, godisnji_iskoristeno_poslodavac')
                    .eq('ime_prezime', z.radnik_ime)
                    .maybeSingle();

                if (radnik) {
                    const poljeUpdate = inicijativa === 'RADNIK' ? 'godisnji_iskoristeno_radnik' : 'godisnji_iskoristeno_poslodavac';
                    const dana = parseInt(z.broj_radnih_dana, 10) || 0;
                    const novaKvota = (radnik[poljeUpdate] || 0) + dana;
                    const drugoPolje = inicijativa === 'RADNIK' ? (radnik.godisnji_iskoristeno_poslodavac || 0) : (radnik.godisnji_iskoristeno_radnik || 0);
                    const ukupno = radnik.godisnji_ukupno ?? ((radnik.preostalo_godisnjeg ?? 20) + (radnik.godisnji_iskoristeno_radnik || 0) + (radnik.godisnji_iskoristeno_poslodavac || 0));
                    const preostalo = Math.max(0, ukupno - novaKvota - drugoPolje);
                    await supabase.from('radnici').update({
                        [poljeUpdate]: novaKvota,
                        godisnji_ukupno: ukupno,
                        preostalo_godisnjeg: preostalo
                    }).eq('id', radnik.id);
                }
            }

            await oznaciNotifikacijuProcitanom(notification, user);

            // Pošalji ličnu notifikaciju direktno radniku koji je podnio zahtjev!
            await posaljiNotifikaciju({
                korisnik: user?.ime_prezime || 'HR Admin',
                akcija: status === 'ODOBRENO' ? 'ODOBREN_ZAHTJEV_ODMOR' : 'ODBIJEN_ZAHTJEV_ODMOR',
                detalji: `Vaš zahtjev za ${z.tip_odsustva} (${z.datum_od} → ${z.datum_do}, ${z.broj_radnih_dana} radnih dana) je ${status === 'ODOBRENO' ? 'ODOBREN' : 'ODBIJEN'} od strane ${user?.ime_prezime || 'Admina'}.`,
                nivo_alarma: status === 'ODOBRENO' ? 'INFO' : 'ŽUTO',
                meta: {
                    modul: 'hr_modul',
                    target_user: z.radnik_ime,
                    entity_type: 'zahtjev_odsustva',
                    entity_id: String(z.id),
                    radnik_ime: z.radnik_ime,
                    status,
                },
            });

            toast.success(`Zahtjev radnika ${z.radnik_ime} je označen kao ${status}! Radniku je poslana lična notifikacija.`);
            await ucitajDetaljeIHistoriju();
            if (onActionComplete) onActionComplete();
        } catch (err) {
            toast.error(formatDbError(err, 'Obrada zahtjeva'));
        } finally {
            setActionBusy(false);
        }
    };

    // ✅ INLINE ODOBRENJE IZMJENE PONUDE / RN
    const handleOdobriIzmjenuPonude = async () => {
        const ponuda = povezaniZapis?.data?.ponuda;
        const rn = povezaniZapis?.data?.rn;
        if (!ponuda || !daLiKorisnikMozeOdobriti('ODOBRENJE_PONUDE', user)) return;
        setActionBusy(true);
        try {
            const { error } = await supabase.from('ponude').update({ rn_modifikovan: false }).eq('id', ponuda.id);
            if (error) throw error;

            await oznaciNotifikacijuProcitanom(notification, user);

            const targetWorker = notification.korisnik && notification.korisnik !== user?.ime_prezime ? notification.korisnik : null;
            await posaljiNotifikaciju({
                korisnik: user?.ime_prezime || 'Admin',
                akcija: 'ODOBRENA_IZMJENA_PONUDE',
                detalji: `Odobrena izmjena na Radnom Nalogu ${rn?.id || parsed.rnId || ''} za Ponudu ${ponuda.id} (${ponuda.kupac_naziv || ''}).`,
                nivo_alarma: 'INFO',
                meta: {
                    modul: 'ponude',
                    moduli: ['ponude', 'radni_nalog'],
                    entity_type: 'ponuda',
                    entity_id: ponuda.id,
                    rn_id: rn?.id || parsed.rnId || undefined,
                    target_user: targetWorker || undefined,
                },
            });

            toast.success(`Izmjena na Ponudi ${ponuda.id} je odobrena!`);
            await ucitajDetaljeIHistoriju();
            if (onActionComplete) onActionComplete();
        } catch (err) {
            toast.error(formatDbError(err, 'Odobrenje ponude'));
        } finally {
            setActionBusy(false);
        }
    };

    // ❌ INLINE ODBIJANJE REKLAMACIJE
    const handleOdbijReklamaciju = async () => {
        const rek = povezaniZapis?.data;
        if (!rek || !daLiKorisnikMozeOdobriti('REKLAMACIJA', user)) return;
        setActionBusy(true);
        try {
            const { data: updated, error } = await supabase
                .from('reklamacije')
                .update({ status: 'ODBIJENO', odobrio_korisnik: user?.ime_prezime || 'Admin' })
                .eq('id', rek.id)
                .eq('status', 'CEKA_ODOBRENJE')
                .select('id');

            if (error) throw error;
            if (!updated || updated.length === 0) {
                toast.warning('Ova reklamacija je već obrađena.');
                await ucitajDetaljeIHistoriju();
                return;
            }

            await oznaciNotifikacijuProcitanom(notification, user);

            await posaljiNotifikaciju({
                korisnik: user?.ime_prezime || 'Admin',
                akcija: 'ODBIJENA_REKLAMACIJA',
                detalji: `Reklamacija za paket ${rek.paket_id} (${rek.kolicina} m³) je ODBIJENA od strane ${user?.ime_prezime || 'Admina'}.`,
                nivo_alarma: 'ŽUTO',
                meta: {
                    modul: 'reklamacije',
                    entity_type: 'reklamacija',
                    entity_id: rek.paket_id,
                    approval_id: rek.id,
                    target_user: rek.snimio_korisnik && rek.snimio_korisnik !== user?.ime_prezime ? rek.snimio_korisnik : undefined,
                },
            });

            toast.info(`Reklamacija za paket ${rek.paket_id} je odbijena.`);
            await ucitajDetaljeIHistoriju();
            if (onActionComplete) onActionComplete();
        } catch (err) {
            toast.error(formatDbError(err, 'Odbijanje reklamacije'));
        } finally {
            setActionBusy(false);
        }
    };

    const isCrveno = notification.nivo_alarma === 'CRVENO';
    const isZuto = notification.nivo_alarma === 'ŽUTO';

    const canApproveHr = povezaniZapis?.tip === 'ZAHTJEV_ODMOR' && povezaniZapis.data?.status === 'NA ČEKANJU' && daLiKorisnikMozeOdobriti('ZAHTJEV_ODMOR', user);
    const canApprovePonuda = povezaniZapis?.tip === 'PONUDA_RN' && povezaniZapis.data?.ponuda?.rn_modifikovan === true && daLiKorisnikMozeOdobriti('ODOBRENJE_PONUDE', user);
    const canActionReklamacija = povezaniZapis?.tip === 'REKLAMACIJA' && povezaniZapis.data?.status === 'CEKA_ODOBRENJE' && daLiKorisnikMozeOdobriti('REKLAMACIJA', user);

    const xRayTargetId = parsed.ponudaId || parsed.rnId || parsed.otpremnicaId || parsed.racunId || parsed.paketId || parsed.trupacId || null;

    return (
        <div
            className="erp-modal-backdrop fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[10050] flex items-center justify-center p-3 sm:p-6 animate-in fade-in"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl max-h-[90vh] bg-theme-card border-2 border-theme-border rounded-[2rem] shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ZAGLAVLJE MODALA */}
                <div className={`p-5 border-b border-theme-border flex items-start justify-between gap-3 ${isCrveno ? 'bg-red-950/25' : isZuto ? 'bg-amber-950/25' : 'bg-theme-panel/70'}`}>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            {isCrveno && <span className="bg-red-500 text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full">🚨 Kritično</span>}
                            {isZuto && <span className="bg-amber-500 text-black text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full">⚠️ Upozorenje</span>}
                            {!isCrveno && !isZuto && <span className="bg-blue-600 text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full">🔔 Obavještenje</span>}

                            {isPersonalForMe && (
                                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full">
                                    🎯 Lično za vas
                                </span>
                            )}

                            {moduli.map((m) => (
                                <span key={m} className="bg-theme-panel text-theme-accent border border-theme-border text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full">
                                    {MODUL_META[m]?.ikona || '📌'} {getNazivModula(m)}
                                </span>
                            ))}
                        </div>
                        <h3 className="text-base sm:text-lg font-black text-theme-text uppercase tracking-wide break-words">
                            {notification.akcija}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[10px] text-theme-muted font-bold">
                            <span className="flex items-center gap-1"><User size={12} /> Pokrenuo: <strong className="text-theme-text">{notification.korisnik || 'Sistem'}</strong></span>
                            <span className="flex items-center gap-1"><Clock size={12} /> {formatDatumVrijeme(notification.vrijeme || notification.created_at)}</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl bg-theme-panel border border-theme-border text-theme-muted hover:text-red-500 hover:border-red-500 transition-colors shrink-0"
                        title="Zatvori"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* TIJELO MODALA */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                    {/* OPIS OBAVJEŠTENJA */}
                    <div className="bg-theme-panel p-4 rounded-2xl border border-theme-border">
                        <p className="text-[10px] text-theme-muted font-black uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                            <Bell size={12} className="text-theme-accent" /> Opis događaja / problema
                        </p>
                        <p className="text-sm text-theme-text font-semibold leading-relaxed whitespace-pre-wrap break-words">
                            {parsed.cleanDetalji || 'Nema dodatnog opisa.'}
                        </p>
                    </div>

                    {/* ŽIVI STATUS POVEZANOG DOKUMENTA / ZAHTJEVA */}
                    {povezaniZapis && (
                        <div className="bg-theme-panel/70 p-4 rounded-2xl border border-theme-accent/30 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-theme-accent flex items-center gap-1.5">
                                    <ShieldCheck size={14} /> Trenutno stanje u bazi
                                </span>
                                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                                    ['ODOBRENO', 'POTVRĐENA', 'NAPLAĆENO', 'ISPORUČENO', 'ZAVRŠENO'].includes(povezaniZapis.data?.status || povezaniZapis.data?.ponuda?.status)
                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                        : ['ODBIJENO', 'STORNIRANO'].includes(povezaniZapis.data?.status)
                                            ? 'bg-red-500/20 text-red-400 border-red-500/40'
                                            : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                }`}>
                                    {povezaniZapis.tip === 'PONUDA_RN'
                                        ? (povezaniZapis.data?.ponuda?.rn_modifikovan ? 'ČEKA ODOBRENJE IZMJENE' : (povezaniZapis.data?.ponuda?.status || povezaniZapis.data?.rn?.status || 'AKTIVNO'))
                                        : (povezaniZapis.data?.status || 'AKTIVNO')}
                                </span>
                            </div>

                            {povezaniZapis.tip === 'ZAHTJEV_ODMOR' && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                                    <div className="bg-theme-card p-2.5 rounded-xl border border-theme-border"><span className="text-[9px] text-theme-muted block uppercase font-black">Radnik</span><strong className="text-theme-text">{povezaniZapis.data.radnik_ime}</strong></div>
                                    <div className="bg-theme-card p-2.5 rounded-xl border border-theme-border"><span className="text-[9px] text-theme-muted block uppercase font-black">Tip</span><strong className="text-theme-text">{povezaniZapis.data.tip_odsustva}</strong></div>
                                    <div className="bg-theme-card p-2.5 rounded-xl border border-theme-border"><span className="text-[9px] text-theme-muted block uppercase font-black">Period</span><strong className="text-theme-text">{povezaniZapis.data.datum_od} → {povezaniZapis.data.datum_do}</strong></div>
                                    <div className="bg-theme-card p-2.5 rounded-xl border border-theme-border"><span className="text-[9px] text-theme-muted block uppercase font-black">Radnih dana</span><strong className="text-theme-accent">{povezaniZapis.data.broj_radnih_dana}</strong></div>
                                    {povezaniZapis.data.razlog && (
                                        <div className="col-span-2 sm:col-span-4 bg-theme-card p-2.5 rounded-xl border border-theme-border text-xs text-theme-muted">
                                            <strong className="text-theme-text">Razlog:</strong> {povezaniZapis.data.razlog}
                                        </div>
                                    )}
                                </div>
                            )}

                            {povezaniZapis.tip === 'REKLAMACIJA' && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                                    <div className="bg-theme-card p-2.5 rounded-xl border border-theme-border"><span className="text-[9px] text-theme-muted block uppercase font-black">Paket</span><strong className="text-theme-text">{povezaniZapis.data.paket_id}</strong></div>
                                    <div className="bg-theme-card p-2.5 rounded-xl border border-theme-border"><span className="text-[9px] text-theme-muted block uppercase font-black">Kupac</span><strong className="text-theme-text truncate block">{povezaniZapis.data.kupac_naziv}</strong></div>
                                    <div className="bg-theme-card p-2.5 rounded-xl border border-theme-border"><span className="text-[9px] text-theme-muted block uppercase font-black">Količina</span><strong className="text-red-400">{povezaniZapis.data.kolicina} m³</strong></div>
                                    <div className="bg-theme-card p-2.5 rounded-xl border border-theme-border"><span className="text-[9px] text-theme-muted block uppercase font-black">Tip / Razlog</span><strong className="text-theme-text">{povezaniZapis.data.tip_reklamacije} • {povezaniZapis.data.razlog}</strong></div>
                                </div>
                            )}

                            {povezaniZapis.tip === 'PONUDA_RN' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                                    {povezaniZapis.data.ponuda && (
                                        <div className="bg-theme-card p-3 rounded-xl border border-theme-border">
                                            <span className="text-[9px] text-theme-muted block uppercase font-black">Ponuda</span>
                                            <strong className="text-theme-text">{povezaniZapis.data.ponuda.id}</strong> — {povezaniZapis.data.ponuda.kupac_naziv}
                                            <span className="block text-[10px] text-theme-muted mt-0.5">Ukupno: {povezaniZapis.data.ponuda.ukupno_sa_pdv} {povezaniZapis.data.ponuda.valuta || 'KM'}</span>
                                        </div>
                                    )}
                                    {povezaniZapis.data.rn && (
                                        <div className="bg-theme-card p-3 rounded-xl border border-theme-border">
                                            <span className="text-[9px] text-theme-muted block uppercase font-black">Radni Nalog</span>
                                            <strong className="text-theme-text">{povezaniZapis.data.rn.id}</strong> — {povezaniZapis.data.rn.status}
                                            <span className="block text-[10px] text-theme-muted mt-0.5">Kupac: {povezaniZapis.data.rn.kupac_naziv}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {(povezaniZapis.tip === 'OTPREMNICA' || povezaniZapis.tip === 'RACUN' || povezaniZapis.tip === 'PAKET' || povezaniZapis.tip === 'TRUPAC') && (
                                <div className="bg-theme-card p-3 rounded-xl border border-theme-border text-xs flex flex-wrap justify-between gap-2">
                                    <strong className="text-theme-text">{povezaniZapis.data.id || povezaniZapis.data.paket_id}</strong>
                                    <span className="text-theme-muted">{povezaniZapis.data.kupac_naziv || povezaniZapis.data.naziv_proizvoda || povezaniZapis.data.vrsta || ''}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* AKCIJE ZA ODOBRENJE (SAMO AKO TRENUTNI KORISNIK IMA PRAVO I AKO JE NA ČEKANJU!) */}
                    {(canApproveHr || canApprovePonuda || canActionReklamacija) && (
                        <div className="bg-amber-950/20 border-2 border-amber-500/40 p-4 rounded-2xl space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                                <AlertTriangle size={14} /> Potrebno vaše odobrenje
                            </p>

                            {canApproveHr && (
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        disabled={actionBusy}
                                        onClick={() => handleObradiZahtjevOdmor('ODOBRENO', 'RADNIK')}
                                        className="flex-1 min-w-[140px] py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                                    >
                                        <CheckCircle2 size={14} /> Odobri (Radnik)
                                    </button>
                                    <button
                                        type="button"
                                        disabled={actionBusy}
                                        onClick={() => handleObradiZahtjevOdmor('ODOBRENO', 'POSLODAVAC')}
                                        className="flex-1 min-w-[140px] py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                                    >
                                        <CheckCircle2 size={14} /> Odobri (Poslodavac)
                                    </button>
                                    <button
                                        type="button"
                                        disabled={actionBusy}
                                        onClick={() => handleObradiZahtjevOdmor('ODBIJENO', 'POSLODAVAC')}
                                        className="py-2.5 px-4 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/40 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                                    >
                                        <XCircle size={14} /> Odbij
                                    </button>
                                </div>
                            )}

                            {canApprovePonuda && (
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        disabled={actionBusy}
                                        onClick={handleOdobriIzmjenuPonude}
                                        className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                                    >
                                        <CheckCircle2 size={14} /> Odobri izmjenu na Ponudi {povezaniZapis.data.ponuda.id}
                                    </button>
                                </div>
                            )}

                            {canActionReklamacija && (
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        disabled={actionBusy}
                                        onClick={() => handleNavigateModule('reklamacije')}
                                        className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all"
                                    >
                                        <ExternalLink size={14} /> Otvori u Reklamacijama za FIFO odobrenje
                                    </button>
                                    <button
                                        type="button"
                                        disabled={actionBusy}
                                        onClick={handleOdbijReklamaciju}
                                        className="py-2.5 px-4 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/40 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                                    >
                                        <XCircle size={14} /> Odbij
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* KOMPLETNA HRONOLOŠKA HISTORIJA PROBLEMA / DOKUMENTA */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-theme-text flex items-center gap-2">
                                <History size={15} className="text-theme-accent" />
                                Kompletna historija problema / dokumenta ({historija.length})
                            </h4>
                            {parsed.primaryId && (
                                <span className="text-[10px] font-mono font-bold text-theme-accent bg-theme-panel px-2.5 py-0.5 rounded-lg border border-theme-border">
                                    ID: {parsed.primaryId}
                                </span>
                            )}
                        </div>

                        {loadingHistory ? (
                            <div className="p-8 text-center text-xs text-theme-muted font-bold animate-pulse uppercase">
                                Učitavam kompletnu hronologiju iz baze...
                            </div>
                        ) : (
                            <div className="relative pl-5 space-y-3 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-theme-border">
                                {historija.map((item, idx) => {
                                    const isCurrent = item.id === notification.id;
                                    const dotColor = item.nivo_alarma === 'CRVENO'
                                        ? 'bg-red-500 ring-red-500/30'
                                        : item.nivo_alarma === 'ŽUTO'
                                            ? 'bg-amber-500 ring-amber-500/30'
                                            : 'bg-blue-500 ring-blue-500/30';

                                    return (
                                        <div
                                            key={item.id || idx}
                                            className={`relative p-3.5 rounded-2xl border transition-all ${
                                                isCurrent
                                                    ? 'bg-theme-accent/10 border-theme-accent shadow-md'
                                                    : 'bg-theme-panel/60 border-theme-border/70'
                                            }`}
                                        >
                                            <span className={`absolute -left-[18px] top-4 w-3 h-3 rounded-full ring-4 ${dotColor}`}></span>
                                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-mono font-black text-theme-muted">#{idx + 1}</span>
                                                    <span className="text-[11px] font-black text-theme-text uppercase">{item.akcija}</span>
                                                    {isCurrent && (
                                                        <span className="text-[8px] font-black uppercase bg-theme-accent text-white px-2 py-0.5 rounded-full">
                                                            Aktuelno
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-mono text-theme-muted">
                                                    {formatDatumVrijeme(item.vrijeme || item.created_at)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-theme-muted leading-snug break-words">
                                                {ocistiTekstDetalja(item.detalji)}
                                            </p>
                                            <div className="flex items-center justify-between mt-2 text-[10px] text-theme-muted font-bold">
                                                <span>👤 {item.korisnik || 'Sistem'}</span>
                                                <span className={item.pregledano ? 'text-emerald-500' : 'text-amber-500'}>
                                                    {item.pregledano ? '✓ Pregledano' : '● Aktivno'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* PODNOŽJE MODALA — NAVIGACIJA I POTVRDA ČITANJA */}
                <div className="p-4 border-t border-theme-border bg-theme-panel/60 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        {primarniModul && daLiKorisnikImaDozvoluZaModul(user, primarniModul) && (
                            <button
                                type="button"
                                onClick={() => handleNavigateModule(
                                    primarniModul,
                                    primarniModul === 'ponude' ? parsed.ponudaId : (primarniModul === 'radni_nalog' ? parsed.rnId : null),
                                    primarniModul === 'radni_nalog' ? 'uredi' : null
                                )}
                                className="px-3.5 py-2.5 bg-theme-card hover:bg-theme-accent hover:text-white text-theme-text border border-theme-border rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 transition-all"
                            >
                                <ExternalLink size={13} /> Otvori {getNazivModula(primarniModul)}
                            </button>
                        )}

                        {xRayTargetId && daLiKorisnikImaDozvoluZaModul(user, 'forenzika') && (
                            <button
                                type="button"
                                onClick={() => handleNavigateModule('forenzika', xRayTargetId, 'skeniraj')}
                                className="px-3.5 py-2.5 bg-indigo-600/15 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 transition-all"
                            >
                                <FileSearch size={13} /> X-Ray Forenzika
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        {!jeProcitano && (
                            <button
                                type="button"
                                disabled={actionBusy}
                                onClick={handleMarkRead}
                                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-50"
                            >
                                ✓ Označi pročitano
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 bg-theme-card hover:bg-theme-panel text-theme-text border border-theme-border rounded-xl text-[10px] font-black uppercase transition-all"
                        >
                            Zatvori
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
