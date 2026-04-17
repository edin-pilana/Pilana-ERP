"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function useSaaS(modulIme, defaultPostavke) {
    const [ui, setUi] = useState(defaultPostavke);
    const [isEditMode, setIsEditMode] = useState(false);
    const [backup, setBackup] = useState(null);

    // Učitavanje dizajna iz baze kada se modul otvori
    useEffect(() => {
        if (!modulIme) return;
        const load = async () => {
            const { data } = await supabase.from('ui_postavke').select('postavke_jsonb').eq('modul_ime', modulIme).maybeSingle();
            if (data && data.postavke_jsonb) {
                setUi({ ...defaultPostavke, ...data.postavke_jsonb });
            }
        };
        load();
    }, [modulIme]);

    // Kontrole za Edit mod
    const pokreniEdit = () => { 
        setBackup(JSON.parse(JSON.stringify(ui))); // Čuvamo staro stanje za "Odustani"
        setIsEditMode(true); 
    };
    
    const odustani = () => { 
        if (backup) setUi(backup); // Vraćamo na staro
        setIsEditMode(false); 
    };

    const spasiDizajn = async () => {
        // Upsert: Ako modul ne postoji u bazi, dodaj ga. Ako postoji, ažuriraj ga.
        const { error } = await supabase.from('ui_postavke').upsert([{ modul_ime: modulIme, postavke_jsonb: ui }], { onConflict: 'modul_ime' });
        if (error) {
            alert("Greška pri snimanju dizajna: " + error.message);
        } else {
            alert(`Dizajn modula '${modulIme}' je uspješno spašen!`);
            setIsEditMode(false);
            setBackup(null);
        }
    };

    return { ui, setUi, isEditMode, pokreniEdit, odustani, spasiDizajn };
}