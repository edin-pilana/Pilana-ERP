"use client";
import { supabase } from './supabaseClient';
import { toast } from 'sonner';

const QUEUE_STORAGE_KEY = 'pilana_erp_offline_queue_v1';

export function ucitajOfflineRed() {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function sacuvajOfflineRed(lista) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(lista));
        window.dispatchEvent(new CustomEvent('offline_queue_updated', { detail: lista }));
    } catch (e) {}
}

export function daLiJeOffline() {
    if (typeof navigator === 'undefined') return false;
    return navigator.onLine === false;
}

export function daLiJeMreznaGreska(error) {
    if (!error) return false;
    const msg = String(error.message || error || '').toLowerCase();
    return (
        daLiJeOffline() ||
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('network request failed') ||
        msg.includes('load failed') ||
        msg.includes('err_internet_disconnected')
    );
}

/**
 * Dodaje operaciju iz hale u lokalni red čekanja kad nestane interneta.
 * Tipovi: 'PROREZ_TRUPAC' | 'PILANA_PAKET_INSERT'
 */
export function dodajUOfflineRed(stavka) {
    const lista = ucitajOfflineRed();
    const zapis = {
        queueId: `OFF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
        ...stavka,
    };
    const nova = [...lista, zapis];
    sacuvajOfflineRed(nova);
    toast.warning(`📶 Nema interneta — "${zapis.opis || zapis.tip}" je sigurno sačuvano lokalno i poslaće se automatski čim se signal vrati!`);
    return zapis;
}

export function ukloniIzOfflineReda(queueId) {
    const lista = ucitajOfflineRed().filter((x) => x.queueId !== queueId);
    sacuvajOfflineRed(lista);
    return lista;
}

let syncInProgress = false;

/**
 * Pokušava sinhronizovati sve stavke iz offline reda čim se konekcija vrati.
 */
export async function sinhronizujOfflineRed({ silentIfEmpty = true } = {}) {
    if (typeof window === 'undefined' || syncInProgress) return { synced: 0, remaining: ucitajOfflineRed().length };
    if (daLiJeOffline()) return { synced: 0, remaining: ucitajOfflineRed().length };

    const lista = ucitajOfflineRed();
    if (lista.length === 0) {
        if (!silentIfEmpty) toast.info('Offline red je prazan — sve je sinhronizovano! ✅');
        return { synced: 0, remaining: 0 };
    }

    syncInProgress = true;
    let synced = 0;
    const preostalo = [];

    try {
        for (const item of lista) {
            try {
                if (item.tip === 'PROREZ_TRUPAC') {
                    const { logPayload } = item.data || {};
                    const { error: e1 } = await supabase
                        .from('trupci')
                        .update({ status: 'prorezano' })
                        .eq('id', logPayload.trupac_id)
                        .eq('status', 'na_lageru');
                    if (e1 && daLiJeMreznaGreska(e1)) {
                        preostalo.push(item);
                        continue;
                    }
                    const { error: e2 } = await supabase.from('prorez_log').insert([logPayload]);
                    if (e2 && daLiJeMreznaGreska(e2)) {
                        preostalo.push(item);
                        continue;
                    }
                    synced++;
                } else if (item.tip === 'PILANA_PAKET_INSERT') {
                    const { payload } = item.data || {};
                    const { error } = await supabase.from('paketi').insert([payload]);
                    if (error && daLiJeMreznaGreska(error)) {
                        preostalo.push(item);
                        continue;
                    }
                    synced++;
                } else {
                    // Nepoznat tip — preskoči i očisti
                }
            } catch (err) {
                if (daLiJeMreznaGreska(err)) preostalo.push(item);
            }
        }

        sacuvajOfflineRed(preostalo);
        if (synced > 0) {
            toast.success(`🔄 Sinhronizovano ${synced} offline zapisa iz hale u bazu!`);
        }
    } finally {
        syncInProgress = false;
    }

    return { synced, remaining: preostalo.length };
}
