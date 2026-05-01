import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://awaxwejrhmjeqohrgidm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3YXh3ZWpyaG1qZXFvaHJnaWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NDcsImV4cCI6MjA5MDQzODU0N30.gOBhZkUQfKvUFBzk329zl4KEgZTl5y10Cnsp989y8hY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const POSTAVKE = {
    imeAplikacije: "TTM DOO ERP",
    imeFirme: "TTM d.o.o.",
    bojaFirme: "#3b82f6" 
};

// Pomoćna funkcija za centralno preuzimanje iz baze u trenutku printa
const fetchPrintSettings = async () => {
    let brending = [];
    let firmaInfo = { adresa: '', telefon: '', email: '', footer_tekst: '', footer_boja: '#64748b', footer_velicina: '12' };
    try {
        const [bRes, fRes] = await Promise.all([
            supabase.from('brending').select('*'),
            supabase.from('postavke_firme').select('*').eq('id', 1).maybeSingle()
        ]);
        if (bRes.data) brending = bRes.data;
        if (fRes.data) firmaInfo = fRes.data;
    } catch(e) { console.log(e); }
    return { brending, firmaInfo };
};

export const printDokument = async (tipDokumenta, brojDokumenta, datum, htmlSadrzajTabela, themeColor = '#3b82f6') => {
    const originalTitle = document.title;
    const nazivFajla = `${datum} ${tipDokumenta} ${brojDokumenta}`;
    document.title = nazivFajla; 

    let trazenaLokacija = 'Svi PDF Dokumenti';
    if (tipDokumenta === 'PONUDA') trazenaLokacija = 'PDF Ponuda';
    if (tipDokumenta === 'RADNI NALOG') trazenaLokacija = 'PDF Radni Nalog';
    if (tipDokumenta === 'OTPREMNICA') trazenaLokacija = 'PDF Otpremnica';
    if (tipDokumenta === 'RAČUN') trazenaLokacija = 'PDF Račun';
    if (tipDokumenta.includes('POTVRDA')) trazenaLokacija = 'PDF Blagajna';

    const { brending, firmaInfo } = await fetchPrintSettings();

    let topBannerHtml = '';
    let leftLogoHtml = '<div class="company-name">SmartTimber ERP</div>';

    const logoObj = brending.find(b => (b.lokacije_jsonb || []).includes(trazenaLokacija)) || brending.find(b => (b.lokacije_jsonb || []).includes('Svi PDF Dokumenti'));
    
    if (logoObj && logoObj.url_slike) {
        if (logoObj.full_width) {
            topBannerHtml = `<div style="width: 100%; margin-bottom: 25px; text-align: center;"><img src="${logoObj.url_slike}" style="width: 100%; max-height: 180px; object-fit: contain; display: block;" alt="Banner Firme" /></div>`;
            leftLogoHtml = ''; 
        } else {
            leftLogoHtml = `<img src="${logoObj.url_slike}" style="max-height: 65px; max-width: 250px; object-fit: contain; margin-bottom: 8px;" alt="Logo Firme" />`;
        }
    }

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${brojDokumenta}`;
    const printSkripta = decodeURIComponent('%3Cscript%3Ewindow.onload%3Dfunction()%7BsetTimeout(function()%7Bwindow.print()%3B%7D%2C800)%3B%7D%3B%3C%2Fscript%3E');

    const html = `
        <html>
        <head>
            <title>${nazivFajla}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
                body { font-family: 'Inter', sans-serif; padding: 0; margin: 0; color: #1e293b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .page-container { padding: 40px; min-height: 90vh; display: flex; flex-direction: column; }
                .top-bar { height: 14px; background-color: ${themeColor}; width: 100%; }
                .header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; margin-bottom: 30px; }
                .logo-area { display: flex; flex-direction: column; }
                .company-name { font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; opacity: 0.8;}
                .doc-title { font-size: 42px; font-weight: 900; color: ${themeColor}; text-transform: uppercase; margin: 5px 0 0px 0; letter-spacing: -1.5px; line-height: 1; }
                .qr-wrapper { text-align: center; background: #f8fafc; padding: 12px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                .qr-wrapper img { width: 90px; height: 90px; }
                .qr-text { font-family: monospace; font-size: 11px; font-weight: 800; margin-top: 8px; color: #475569; letter-spacing: 1px;}
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
                th { background-color: ${themeColor}; color: white; padding: 14px 12px; text-transform: uppercase; font-size: 10px; letter-spacing: 1px; text-align: left; }
                td { padding: 14px 12px; border-bottom: 1px solid #e2e8f0; color: #334155; }
                tr:nth-child(even) td { background-color: #f8fafc; }
                .summary-box { width: 320px; float: right; background: #f8fafc; border-radius: 16px; padding: 25px; margin-top: 30px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
                .summary-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; color: #64748b; }
                .summary-row b { color: #0f172a; }
                .summary-total { display: flex; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 2px dashed #cbd5e1; font-size: 22px; font-weight: 900; color: ${themeColor}; align-items: center; }
                .info-grid { display: flex; justify-content: space-between; background: #f1f5f9; padding: 25px; border-radius: 16px; border-left: 6px solid ${themeColor}; margin-bottom: 30px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }
                .info-col h4 { margin: 0 0 10px 0; font-size: 10px; text-transform: uppercase; color: #64748b; letter-spacing: 1px; font-weight: 800; }
                .info-col p { margin: 0; font-size: 14px; font-weight: 600; color: #0f172a; line-height: 1.5; }
                .footer { clear: both; padding-top: 30px; margin-top: 50px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; }
                
                /* Prilagođeni Footer na dnu svake stranice */
                .global-footer-custom {
                    text-align: center;
                    margin-top: auto;
                    padding-top: 20px;
                    border-top: 1px solid #e2e8f0;
                    color: ${firmaInfo.footer_boja};
                    font-size: ${firmaInfo.footer_velicina}px;
                    font-weight: 600;
                }
            </style>
        </head>
        <body>
            <div class="top-bar"></div>
            <div class="page-container">
                <div>
                    ${topBannerHtml}
                    <div class="header">
                        <div class="logo-area">
                            ${leftLogoHtml}
                            <div class="doc-title">${tipDokumenta}</div>
                            <div style="color: #64748b; font-size: 14px; font-weight: 600; margin-top: 8px; letter-spacing: 0.5px;">Broj: <span style="color: #0f172a;">${brojDokumenta}</span> &nbsp;|&nbsp; Datum: ${datum}</div>
                        </div>
                        <div class="qr-wrapper">
                            <img src="${qrCodeUrl}" alt="QR" />
                            <div class="qr-text">${brojDokumenta}</div>
                        </div>
                    </div>
                    ${htmlSadrzajTabela}
                </div>
                
                ${firmaInfo.footer_tekst ? `<div class="global-footer-custom">${firmaInfo.footer_tekst}</div>` : ''}
            </div>
            ${printSkripta}
        </body>
        </html>
    `;
    
    iframe.contentWindow.document.open(); iframe.contentWindow.document.write(html); iframe.contentWindow.document.close();
    setTimeout(() => { document.title = originalTitle; }, 3000);
    setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 300000);
};

export const printDeklaracijaPaketa = async (paketId, items, vezniDokument = '') => {
    if (!items || items.length === 0) return;

    const originalTitle = document.title;
    document.title = `Deklaracija_${paketId}`;

    const { brending, firmaInfo } = await fetchPrintSettings();

    let logoUrl = '';
    const logoObj = brending.find(b => (b.lokacije_jsonb || []).includes('Svi PDF Dokumenti')) || brending.find(b => (b.lokacije_jsonb || []).includes('Glavni Meni (Dashboard Vrh)'));
    if (logoObj && logoObj.url_slike) logoUrl = logoObj.url_slike;

    const qrPaket = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${paketId}`;
    const qrVeza = vezniDokument ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${vezniDokument}` : '';

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const formatDatumTacke = (iso) => {
        if(!iso) return '';
        const [y, m, d] = iso.split('-');
        return `${d}.${m}.${y}.`;
    };
    const datum = items[0].datum_yyyy_mm ? formatDatumTacke(items[0].datum_yyyy_mm) : formatDatumTacke(new Date().toISOString().split('T')[0]);
    const woodType = items[0].naziv_proizvoda.split(' ')[0] || 'Rezana'; 
    let totalLengthM = 0;

    const redoviStavki = items.map(item => {
        let pcs = parseFloat(item.kolicina_ulaz || 0);
        const v = parseFloat(item.debljina)||1; const s = parseFloat(item.sirina)||1; const d = parseFloat(item.duzina)||1;
        if (item.jm === 'm3') pcs = Math.round(pcs / ((v/100)*(s/100)*(d/100)));
        
        totalLengthM += (pcs * (d/100));

        return `
        <div class="row">
            <div class="col"><div class="lbl-wrap"><span class="lbl">Tickness mm</span></div><div class="box">${item.debljina}</div></div>
            <div class="col"><div class="lbl-wrap"><span class="lbl">Width mm</span></div><div class="box">${item.sirina}</div></div>
            <div class="col"><div class="lbl-wrap"><span class="lbl">Length mm</span></div><div class="box">${item.duzina * 10}</div></div>
            <div class="col"><div class="lbl-wrap"><span class="lbl">PCS</span></div><div class="box">${pcs}</div></div>
            <div class="col"><div class="lbl-wrap"><span class="lbl">Volume (m³)</span></div><div class="box">${item.kolicina_final}</div></div>
        </div>
        `;
    }).join('');

    const html = `
        <html>
        <head>
            <title>Deklaracija ${paketId}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                @page { size: 210mm 148mm landscape; margin: 0; }
                html, body { margin: 0 !important; padding: 0 !important; background: #fff; width: 210mm; height: 148mm; overflow: hidden; }
                .page-container { font-family: 'Inter', sans-serif; width: 210mm; height: 148mm; padding: 8mm 10mm; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; display: flex; flex-direction: column; justify-content: space-between; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; }
                .logo img { max-width: 280px; max-height: 55px; object-fit: contain; }
                .logo h1 { margin: 0; font-size: 26px; font-weight: 900; color: #1e3a8a; }
                .header-info { text-align: right; font-size: 13px; font-weight: bold; }
                .info-row { display: flex; justify-content: flex-end; align-items: center; margin-bottom: 4px; gap: 8px;}
                .info-lbl { border: 1px dotted #666; padding: 2px 6px; font-weight: normal;}
                .info-val { border: 1px dotted #666; padding: 2px 10px; min-width: 110px; text-align: center; }
                .pkg-row { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 8px; margin-bottom: 5px;}
                .pkg-lbl { border: 1px dotted #666; padding: 2px 6px; font-size: 13px;}
                .pkg-val { font-size: 38px; font-weight: 900; letter-spacing: 0.5px; line-height: 1;}
                .content-area { flex: 1; display: flex; flex-direction: column; justify-content: flex-start; margin-top: 5px;}
                .row { display: flex; justify-content: space-between; gap: 10px; width: 100%; margin-top: 6px;}
                .col { flex: 1; text-align: center; display: flex; flex-direction: column;}
                .lbl-wrap { text-align: center; margin-bottom: 2px; }
                .lbl { font-size: 11px; border-bottom: 1px dotted #000; padding-bottom: 2px; display: inline-block; }
                .box { border: 3px solid #000; font-size: 22px; font-weight: 900; flex: 1; display: flex; align-items: center; justify-content: center; min-height: 34px; padding: 2px;}
                .qr-area { display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; padding-top: 10px;}
                .qr-left { display: flex; gap: 6px; align-items: center; }
                .qr-left-text { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 11px; letter-spacing: 1px; font-weight: bold; margin-bottom: 2px;}
                .qr-img-small { width: 85px; height: 85px; }
                .qr-right { display: flex; flex-direction: column; align-items: center;}
                .qr-img-large { width: 95px; height: 95px; }
                .qr-number { font-family: monospace; font-size: 11px; font-weight: bold; letter-spacing: 2px; margin-top: 2px; }
                .footer { border-top: 4px solid #000; padding-top: 4px; margin-top: 8px; display: flex; justify-content: space-between; font-size: 11px; line-height: 1.4; }
                .footer b { font-size: 13px; }
                .footer-links { text-align: right; color: blue; text-decoration: underline; }
            </style>
        </head>
        <body>
            <div class="page-container">
                <div class="header">
                    <div class="logo">
                        ${logoUrl ? `<img src="${logoUrl}" />` : `<h1>${POSTAVKE.imeFirme}</h1><p style="margin:0; font-size:11px;">TIMBER TRADING & MANUFACTURING</p>`}
                    </div>
                    <div class="header-info">
                        <div class="info-row"><span class="info-lbl">PLACE:</span><span class="info-val">Brčko, BiH</span></div>
                        <div class="info-row"><span class="info-lbl">DATE:</span><span class="info-val">${datum}</span></div>
                        <div class="pkg-row"><span class="pkg-lbl">Package number:</span><span class="pkg-val">${paketId}</span></div>
                    </div>
                </div>
                <div class="content-area">
                    <div class="row">
                        <div class="col"><div class="lbl-wrap"><span class="lbl">Wood Type</span></div><div class="box">${woodType}</div></div>
                        <div class="col"><div class="lbl-wrap"><span class="lbl">Treatment</span></div><div class="box">0</div></div>
                        <div class="col"><div class="lbl-wrap"><span class="lbl">MC</span></div><div class="box">8-11%</div></div>
                        <div class="col"><div class="lbl-wrap"><span class="lbl">Quality</span></div><div class="box">A/B</div></div>
                        <div class="col"><div class="lbl-wrap"><span class="lbl">Total Length (m)</span></div><div class="box">${Math.round(totalLengthM)}</div></div>
                    </div>
                    ${redoviStavki}
                </div>
                <div class="qr-area">
                    <div class="qr-left">
                        ${vezniDokument ? `
                            <img src="${qrVeza}" class="qr-img-small" />
                            <span class="qr-left-text">${vezniDokument}</span>
                        ` : ''} 
                    </div>
                    <div class="qr-right">
                        <img src="${qrPaket}" class="qr-img-large" />
                        <div class="qr-number">${paketId}</div>
                    </div>
                </div>
                <div class="footer">
                    <div>
                        <b>${POSTAVKE.imeFirme}</b><br>
                        ${firmaInfo.adresa || 'Rijeka bb, 75328 Doborovci, Bosnia and Herzegovina'}<br>
                        Tel: ${firmaInfo.telefon || '+387 49 591 900'}
                    </div>
                    <div class="footer-links">
                        E-mail: ${firmaInfo.email || 'info@ttmdoo.com'}<br>
                        ${firmaInfo.footer_tekst ? `<span style="color: ${firmaInfo.footer_boja}; font-size: ${firmaInfo.footer_velicina}px; text-decoration: none;">${firmaInfo.footer_tekst}</span>` : ''}
                    </div>
                </div>
            </div>
            ${decodeURIComponent('%3Cscript%3Ewindow.onload%3Dfunction()%7BsetTimeout(function()%7Bwindow.print()%3B%7D%2C800)%3B%7D%3B%3C%2Fscript%3E')}
        </body>
        </html>
    `;

    iframe.contentWindow.document.open(); iframe.contentWindow.document.write(html); iframe.contentWindow.document.close();
    setTimeout(() => { document.title = originalTitle; }, 3000);
    setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 60000);
};

export const printFaznaDeklaracijaPaketa = async (paketId, stavke, rn, masina, tehnologija) => {
    const stariNaslov = document.title;
    document.title = `FAZA_${paketId}`;

    let redovi = stavke.map((s, i) => `
        <tr>
            <td style="font-weight: bold; border-bottom: 1px solid #cbd5e1; padding: 4px;">${i+1}.</td>
            <td style="border-bottom: 1px solid #cbd5e1; padding: 4px;"><b style="font-size: 14px;">${s.sifra_proizvoda || s.naziv_proizvoda}</b></td>
            <td style="border-bottom: 1px solid #cbd5e1; padding: 4px; font-weight: 800; font-size: 16px;">${s.debljina}x${s.sirina}x${s.duzina}</td>
            <td style="text-align: right; border-bottom: 1px solid #cbd5e1; padding: 4px; font-size: 18px; font-weight: 900; color: #d97706;">${s.kolicina_final} <span style="font-size: 12px; color: #475569;">m³</span></td>
        </tr>
    `).join('');

    let tehnologijaHtml = '<p style="font-size: 10px; color: #64748b;">Nema definisanih faza.</p>';
    if (tehnologija && tehnologija.length > 0) {
        tehnologijaHtml = tehnologija.map((f, i) => {
            const isTrenutna = f.masina.toUpperCase() === masina.toUpperCase();
            return `
                <div style="padding: 4px; margin-bottom: 4px; border-left: 4px solid ${isTrenutna ? '#d97706' : '#cbd5e1'}; background: ${isTrenutna ? '#fffbeb' : 'transparent'};">
                    <b style="color: ${isTrenutna ? '#d97706' : '#475569'};">${i+1}. ${f.masina} ${isTrenutna ? '(TRENUTNI KORAK)' : ''}</b><br/>
                    <span style="font-size: 10px;">Cilj: ${f.dimenzija} | Faktor: ${f.kolicina} ${f.jm}</span>
                </div>
            `;
        }).join('');
    }

    const htmlSadrzaj = `
        <div style="border: 4px solid #d97706; padding: 15px; border-radius: 10px; background: #fff8f1;">
            <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #d97706; padding-bottom: 10px; margin-bottom: 10px;">
                <div>
                    <h2 style="color: #d97706; margin: 0; font-size: 24px; text-transform: uppercase;">⚠️ FAZNA PROIZVODNJA</h2>
                    <p style="margin: 5px 0 0 0; font-size: 12px; font-weight: bold; color: #0f172a;">NE IDE NA LAGER GOTOVE ROBE!</p>
                </div>
                <div style="text-align: right;">
                    <p style="margin: 0; font-size: 10px; color: #475569;">Radni Nalog:</p>
                    <p style="margin: 0; font-size: 18px; font-weight: 900;">${rn || 'Interno'}</p>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                <div style="width: 65%;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8fafc; color: #475569; font-size: 10px; text-align: left;">
                                <th style="padding: 4px;">#</th><th>Proizvod</th><th>Radna Dimenzija</th><th style="text-align: right;">Količina</th>
                            </tr>
                        </thead>
                        <tbody>${redovi}</tbody>
                    </table>
                </div>
                <div style="width: 30%; border-left: 2px dashed #cbd5e1; padding-left: 10px;">
                    <h4 style="margin: 0 0 5px 0; font-size: 12px; color: #0f172a; text-transform: uppercase;">Proizvodni Procesi:</h4>
                    ${tehnologijaHtml}
                </div>
            </div>
        </div>
    `;

    await printDokument('FAZNI PAKET', paketId, new Date().toLocaleDateString('de-DE'), htmlSadrzaj, '#d97706');
    setTimeout(() => { document.title = stariNaslov; }, 2000);
};

export const printRadniNalogZaMasinu = async (rn, masina) => {
    const stariNaslov = document.title;
    document.title = `RN_${rn.id}_${masina}`;
    
    const stavkeZaMasinu = rn.stavke_jsonb.map((s, i) => {
        const faza = (rn.tehnologija_jsonb[s.id] || []).find(f => f.masina === masina);
        if (!faza) return null;
        return `
            <tr>
                <td style="font-weight: bold; border-bottom: 1px solid #cbd5e1;">${i+1}.</td>
                <td style="border-bottom: 1px solid #cbd5e1;"><b style="font-size: 13px;">${s.sifra}</b><br/><span style="font-size: 10px; color: #475569;">${s.naziv}</span></td>
                <td style="text-align: center; border-bottom: 1px solid #cbd5e1; font-weight: 800; font-size: 14px; color: #d97706;">${faza.dimenzija}</td>
                <td style="text-align: center; border-bottom: 1px solid #cbd5e1; font-weight: 800; font-size: 14px;">${faza.kolicina} <span style="font-size: 10px;">${faza.jm}</span></td>
                <td style="border-bottom: 1px solid #cbd5e1; font-size: 10px;">${faza.oznake?.join(', ') || ''} <br/> <i>${faza.napomena || ''}</i></td>
            </tr>
        `;
    }).filter(s => s !== null).join('');

    if (!stavkeZaMasinu) return alert(`Nema definisanih zadataka za mašinu: ${masina}`);

    const htmlSadrzaj = `
        <div style="border-bottom: 3px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
                <h2 style="margin: 0; color: #0f172a; font-size: 20px; text-transform: uppercase;">PROIZVODNI NALOG: <span style="color: #d97706;">${masina}</span></h2>
                <p style="margin: 5px 0 0 0; font-size: 12px; color: #475569;">Samo obaveze za odabranu mašinu</p>
            </div>
            <div style="text-align: right;">
                <p style="margin: 0; font-size: 10px;">Kupac: <b style="font-size: 14px;">${rn.kupac_naziv}</b></p>
                <p style="margin: 2px 0 0 0; font-size: 10px; color: #ec4899;">Rok: <b>${new Date(rn.rok_isporuke).toLocaleDateString('de-DE')}</b></p>
            </div>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #f8fafc; font-size: 10px; text-align: left; color: #475569;">
                    <th style="padding: 4px; width: 5%;">#</th><th style="padding: 4px;">Konačni Proizvod</th><th style="padding: 4px; text-align: center;">Radna Dimenzija</th><th style="padding: 4px; text-align: center;">Zadatak</th><th style="padding: 4px;">Obrada / Napomena</th>
                </tr>
            </thead>
            <tbody>${stavkeZaMasinu}</tbody>
        </table>
    `;

    await printDokument(`NALOG - ${masina}`, rn.id, new Date(rn.datum).toLocaleDateString('de-DE'), htmlSadrzaj, '#0f172a');
    setTimeout(() => { document.title = stariNaslov; }, 2000);
};

export const printRadniNalogSveFaze = async (rn) => {
    const stariNaslov = document.title;
    document.title = `RN_SVE_FAZE_${rn.id}`;
    
    let redovi = rn.stavke_jsonb.map((s, i) => {
        const faze = rn.tehnologija_jsonb[s.id] || [];
        const fazeHtml = faze.map((f, fi) => `
            <div style="font-size: 9px; border-left: 2px solid #d97706; padding-left: 4px; margin-bottom: 2px;">
                <b>Faza ${fi+1}: ${f.masina}</b> | Dim: ${f.dimenzija} | Kol: ${f.kolicina} ${f.jm}
            </div>
        `).join('');

        return `
            <tr>
                <td style="font-weight: bold; border-bottom: 1px solid #cbd5e1; padding: 4px; vertical-align: top;">${i+1}.</td>
                <td style="border-bottom: 1px solid #cbd5e1; padding: 4px; vertical-align: top;">
                    <b style="font-size: 13px;">${s.sifra}</b><br/><span style="font-size: 10px; color: #475569;">${s.naziv}</span>
                    <div style="margin-top: 5px;">${fazeHtml}</div>
                </td>
                <td style="text-align: center; border-bottom: 1px solid #cbd5e1; vertical-align: top; font-weight: 800; font-size: 14px; color: #a855f7; padding: 4px;">${s.kolicina_obracun} <span style="font-size: 10px;">${s.jm_obracun}</span></td>
            </tr>
        `;
    }).join('');

    const htmlSadrzaj = `
        <div style="margin-bottom: 15px; display: flex; justify-content: space-between;">
            <div><h4 style="margin: 0; color: #64748b;">Naručilac</h4><p style="font-size: 18px; font-weight: 900; margin: 0;">${rn.kupac_naziv}</p></div>
            <div style="text-align: right;"><h4 style="margin: 0; color: #64748b;">Detalji</h4><p style="margin: 0; color: #a855f7; font-weight: bold;">Rok: ${new Date(rn.rok_isporuke).toLocaleDateString('de-DE')}</p></div>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
            <thead><tr style="background: #f8fafc; font-size: 10px; text-align: left;"><th style="padding: 4px; width: 5%;">#</th><th style="padding: 4px;">Proizvod i Procesi (BOM)</th><th style="padding: 4px; text-align: center;">Ciljna Količina</th></tr></thead>
            <tbody>${redovi}</tbody>
        </table>
    `;

    await printDokument('KOMPLETAN RADNI NALOG', rn.id, new Date(rn.datum).toLocaleDateString('de-DE'), htmlSadrzaj, '#a855f7');
    setTimeout(() => { document.title = stariNaslov; }, 2000);
};