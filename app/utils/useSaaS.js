"use client";
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from './supabaseClient';

export function useSaaS(modulIme, defaultPostavke) {
    const [ui, setUi] = useState(defaultPostavke);
    const [isEditMode, setIsEditMode] = useState(false);
    const [backup, setBackup] = useState(null);

    useEffect(() => {
        if (!modulIme) return;
        const load = async () => {
            try {
                const { data } = await supabase
                    .from('ui_postavke')
                    .select('postavke_jsonb')
                    .eq('modul_ime', modulIme)
                    .maybeSingle();
                if (data && data.postavke_jsonb) {
                    setUi({ ...defaultPostavke, ...data.postavke_jsonb });
                }
            } catch (e) {
                console.error(`Greška pri učitavanju dizajna za ${modulIme}:`, e);
            }
        };
        load();
    }, [modulIme]);

    const pokreniEdit = () => {
        setBackup(JSON.parse(JSON.stringify(ui)));
        setIsEditMode(true);
    };

    const odustani = () => {
        if (backup) setUi(backup);
        setBackup(null);
        setIsEditMode(false);
    };

    const spasiDizajn = async () => {
        const { error } = await supabase
            .from('ui_postavke')
            .upsert([{ modul_ime: modulIme, postavke_jsonb: ui }], { onConflict: 'modul_ime' });
        if (error) {
            toast.error('Greška pri snimanju dizajna', { description: error.message });
        } else {
            toast.success(`Dizajn modula '${modulIme}' je uspješno spašen!`);
            setIsEditMode(false);
            setBackup(null);
        }
    };

    return { ui, setUi, isEditMode, pokreniEdit, odustani, spasiDizajn, defaultConfig: defaultPostavke };
}
