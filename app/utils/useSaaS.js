"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from './supabaseClient';
import {
    cleanDesignTokens,
    isUserDesignAdmin,
    primijeniDesignCss,
    ucitajGlobalniDizajn,
    spasiGlobalniDizajn,
} from './designTokens';

export function useSaaS(modulIme, defaultPostavke = {}) {
    const [ui, setUi] = useState(defaultPostavke);
    const [isEditMode, setIsEditMode] = useState(false);
    const [backup, setBackup] = useState(null);
    const [globalTokens, setGlobalTokens] = useState({});
    const defaultRef = useRef(defaultPostavke);

    useEffect(() => {
        if (!modulIme) return;
        let cancelled = false;

        const load = async () => {
            try {
                const [gTokens, { data }] = await Promise.all([
                    ucitajGlobalniDizajn(),
                    supabase
                        .from('ui_postavke')
                        .select('postavke_jsonb')
                        .eq('modul_ime', modulIme)
                        .maybeSingle(),
                ]);

                if (cancelled) return;
                setGlobalTokens(gTokens || {});

                if (data && data.postavke_jsonb) {
                    setUi({ ...defaultRef.current, ...data.postavke_jsonb });
                } else {
                    setUi(defaultRef.current);
                }
            } catch (e) {
                console.error(`Greška pri učitavanju dizajna za ${modulIme}:`, e);
            }
        };

        load();

        const onGlobalUpdated = (e) => {
            if (!cancelled) setGlobalTokens(e?.detail || {});
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('global_design_updated', onGlobalUpdated);
        }

        return () => {
            cancelled = true;
            if (typeof window !== 'undefined') {
                window.removeEventListener('global_design_updated', onGlobalUpdated);
            }
            // Čistimo modul-specifični CSS kad napustimo modul da stil ne procuri u drugi modul
            primijeniDesignCss('module', {});
        };
    }, [modulIme]);

    // Live sinhronizacija CSS design tokena u <head> za aktivni modul
    const designTokens = ui?.design_tokens || {};
    useEffect(() => {
        if (!modulIme) return;
        primijeniDesignCss('module', designTokens);
    }, [modulIme, designTokens]);

    const pokreniEdit = useCallback(() => {
        if (!isUserDesignAdmin()) {
            toast.error('Samo Admin ili Superadmin može uređivati dizajn sistema.');
            return;
        }
        setBackup(JSON.parse(JSON.stringify(ui)));
        setIsEditMode(true);
    }, [ui]);

    const odustani = useCallback(() => {
        if (backup) {
            setUi(backup);
            primijeniDesignCss('module', backup?.design_tokens || {});
        }
        setBackup(null);
        setIsEditMode(false);
    }, [backup]);

    const setDesignToken = useCallback((key, value) => {
        setUi((prev) => {
            const nextTokens = { ...(prev?.design_tokens || {}) };
            if (value === '' || value === null || value === undefined) {
                delete nextTokens[key];
            } else {
                nextTokens[key] = String(value);
            }
            return { ...prev, design_tokens: nextTokens };
        });
    }, []);

    const setDesignTokens = useCallback((newTokens) => {
        const clean = cleanDesignTokens(newTokens);
        setUi((prev) => ({
            ...prev,
            design_tokens: clean,
            // Ako preset ili reset mijenja stilove, očisti stare konfliktne ključeve
            ...(Object.keys(clean).length === 0 ? { boja_kartice: '', boja_slova: '' } : {}),
        }));
    }, []);

    const resetujDizajnModula = useCallback(() => {
        setUi((prev) => ({
            ...prev,
            boja_kartice: '',
            boja_slova: '',
            design_tokens: {},
        }));
        primijeniDesignCss('module', {});
        toast.info('Lokalne boje modula su očišćene. Kliknite "Spasi" da potvrdite.');
    }, []);

    const spasiDizajn = useCallback(async () => {
        if (!isUserDesignAdmin()) {
            toast.error('Samo Admin ili Superadmin može spasiti dizajn.');
            return;
        }
        const payload = {
            ...ui,
            design_tokens: cleanDesignTokens(ui?.design_tokens || {}),
        };
        const { error } = await supabase
            .from('ui_postavke')
            .upsert([{ modul_ime: modulIme, postavke_jsonb: payload }], { onConflict: 'modul_ime' });
        if (error) {
            toast.error('Greška pri snimanju dizajna', { description: error.message });
        } else {
            setUi(payload);
            toast.success(`Dizajn modula '${modulIme}' je uspješno spašen!`);
            setIsEditMode(false);
            setBackup(null);
        }
    }, [modulIme, ui]);

    const spasiKaoGlobalniDizajn = useCallback(async (tokensOverride = null) => {
        if (!isUserDesignAdmin()) {
            toast.error('Samo Admin ili Superadmin može spasiti globalni dizajn.');
            return false;
        }
        const merged = cleanDesignTokens(tokensOverride !== null ? tokensOverride : { ...globalTokens, ...(ui?.design_tokens || {}) });
        const { error } = await spasiGlobalniDizajn(merged);
        if (error) {
            toast.error('Greška pri snimanju globalnog dizajna', { description: error.message });
            return false;
        }
        setGlobalTokens(merged);
        toast.success('Globalni dizajn je spašen i automatski primijenjen na SVE module!');
        return true;
    }, [globalTokens, ui]);

    const resetujGlobalniDizajn = useCallback(async () => {
        if (!isUserDesignAdmin()) {
            toast.error('Samo Admin ili Superadmin može resetovati globalni dizajn.');
            return false;
        }
        const { error } = await spasiGlobalniDizajn({});
        if (error) {
            toast.error('Greška pri resetovanju globalnog dizajna', { description: error.message });
            return false;
        }
        setGlobalTokens({});
        toast.success('Globalni dizajn je vraćen na fabričke teme za sve module!');
        return true;
    }, []);

    return {
        modulIme,
        ui,
        setUi,
        isEditMode,
        pokreniEdit,
        odustani,
        spasiDizajn,
        defaultConfig: defaultPostavke,
        // Novi Design Studio API
        designTokens,
        globalTokens,
        setDesignToken,
        setDesignTokens,
        resetujDizajnModula,
        spasiKaoGlobalniDizajn,
        resetujGlobalniDizajn,
    };
}
