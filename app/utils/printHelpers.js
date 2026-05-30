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
    let firmaInfo = { adresa: '', telefon: '', email: '', footer_tekst: '', footer_boja: '#64748b', footer_velicina: '10' };
    
    try {
        const [bRes, fRes] = await Promise.all([
            supabase.from('brending').select('*'),
            supabase.from('postavke_firme').select('*').eq('id', 1).maybeSingle()
        ]);
        if (bRes.data) brending = bRes.data;
        if (fRes.data) firmaInfo = fRes.data;
    } catch(e) {
        console.log("Greška pri učitavanju postavki za print", e);
    }
    
    return { brending, firmaInfo };
};

// ==========================================
// 1. STANDARDNI DOKUMENTI (NALOZI, PONUDE, RAČUNI...)
// ==========================================
export const printDokument = async (tipDokumenta, brojDokumenta, datum, htmlSadrzajTabela, themeColor = '#3b82f6', totaliHtml = null) => {
    const originalTitle = document.title;
    const nazivFajla = `${datum} ${tipDokumenta} ${brojDokumenta}`;
    document.title = nazivFajla; 

    let trazenaLokacija = 'Svi PDF Dokumenti';
    if (tipDokumenta === 'PONUDA') trazenaLokacija = 'PDF Ponuda';
    else if (tipDokumenta === 'RADNI NALOG') trazenaLokacija = 'PDF Radni Nalog';
    else if (tipDokumenta === 'OTPREMNICA') trazenaLokacija = 'PDF Otpremnica';
    else if (tipDokumenta === 'RAČUN') trazenaLokacija = 'PDF Račun';
    else if (tipDokumenta.includes('POTVRDA')) trazenaLokacija = 'PDF Blagajna';

    const { brending, firmaInfo } = await fetchPrintSettings();

    let topBannerHtml = '';
    let leftLogoHtml = `<div class="company-name">${POSTAVKE.imeFirme}</div>`;

    const logoObj = brending.find(b => (b.lokacije_jsonb || []).includes(trazenaLokacija)) || 
                    brending.find(b => (b.lokacije_jsonb || []).includes('Svi PDF Dokumenti'));
    
    if (logoObj && logoObj.url_slike) {
        if (logoObj.full_width) {
            topBannerHtml = `
                <div class="full-width-banner">
                    <img src="${logoObj.url_slike}" alt="Banner Firme" />
                </div>`;
            leftLogoHtml = ''; 
        } else {
            leftLogoHtml = `<img src="${logoObj.url_slike}" class="left-logo" alt="Logo Firme" />`;
        }
    }

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${brojDokumenta}`;
    const printSkripta = decodeURIComponent('%3Cscript%3Ewindow.onload%3Dfunction()%7BsetTimeout(function()%7Bwindow.print()%3B%7D%2C2000)%3B%7D%3B%3C%2Fscript%3E');

    // UBACENA LOGIKA ZA TOTAL NA DNU
    const donjiDioHtml = totaliHtml ? `
        <div class="totals-section">
            ${totaliHtml}
        </div>
    ` : '';

    const html = `
        <html>
        <head>
            <title>${nazivFajla}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
                @page { size: A4; margin: 0; }
                body { 
                    font-family: 'Inter', sans-serif; 
                    padding: 0; 
                    margin: 0; 
                    color: #1e293b; 
                    -webkit-print-color-adjust: exact; 
                    print-color-adjust: exact; 
                }
                .page-container { 
                    /* Ujednacene margine za header i sadrzaj ispod */
                    padding: 20mm; 
                    min-height: 297mm; 
                    box-sizing: border-box;
                    display: flex; 
                    flex-direction: column; 
                    position: relative;
                }
                .top-bar { 
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 12px; 
                    background-color: ${themeColor}; 
                    width: 100%; 
                }
                .full-width-banner {
                    width: 100%;
                    margin-bottom: 8mm;
                    text-align: center;
                }
                .full-width-banner img {
                    width: 100%;
                    max-height: 120px;
                    object-fit: contain;
                }
                .header { 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: flex-start; /* Poravnano na vrh umjesto dno */
                    padding-bottom: 5mm; 
                    border-bottom: 2px solid #e2e8f0; 
                    margin-bottom: 6mm; 
                }
                .logo-area { display: flex; flex-direction: column; max-width: 70%; }
                .company-name { font-size: 20px; font-weight: 900; color: #0f172a; }
                .left-logo { 
                    /* Povecan logo */
                    max-height: 70px; 
                    max-width: 300px; 
                    object-fit: contain; 
                    margin-bottom: 5px; 
                }
                
                .doc-title-area { margin-top: 15px; }
                .doc-title { 
                    font-size: 32px; 
                    font-weight: 900; 
                    color: ${themeColor}; 
                    text-transform: uppercase; 
                    margin: 0; 
                    line-height: 1; 
                }
                .doc-subtitle { color: #64748b; font-size: 11px; font-weight: 600; margin-top: 4px; }
                
                .qr-wrapper { 
                    text-align: right; 
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                }
                .qr-wrapper img { width: 75px; height: 75px; margin-bottom: 3px; }
                .qr-text { font-family: monospace; font-size: 9px; font-weight: 800; color: #475569; }
                
                /* KUTIJA ZA INFO O KUPCU (Sa slike) */
                .info-grid { 
                    display: flex; 
                    justify-content: space-between; 
                    background: #f8fafc; 
                    padding: 4mm; 
                    border-radius: 8px; 
                    border: 1px solid #cbd5e1;
                    border-left: 5px solid ${themeColor}; 
                    margin-bottom: 6mm; 
                }
                .info-col-left h4 { margin: 0 0 2px 0; font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 800; }
                .info-col-left h2 { margin: 0 0 2px 0; font-size: 16px; color: #0f172a; font-weight: 900; text-transform: uppercase; }
                .info-col-left p { margin: 0; font-size: 10px; color: #475569; line-height: 1.4; }
                
                .info-col-right { text-align: right; font-size: 10px; color: #475569; display: flex; flex-direction: column; justify-content: center;}
                .info-col-right b { color: #0f172a; font-weight: 800;}
                
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-top: 5px; 
                    font-size: 10px; 
                    page-break-inside: auto; 
                }
                tr { page-break-inside: avoid; page-break-after: auto; }
                th { 
                    background-color: ${themeColor}; 
                    color: white; 
                    padding: 8px 6px; 
                    text-transform: uppercase; 
                    font-size: 9px; 
                    font-weight: 800;
                    text-align: left; 
                }
                th.num { text-align: right; }
                td { padding: 8px 6px; border-bottom: 1px solid #cbd5e1; color: #334155; vertical-align: top;}
                td.num { text-align: right; font-weight: 800; font-size: 11px; color: #0f172a;}
                
                /* IZGLED ZA REDOVE PROIZVODA (Dominira naziv, sifra blijeda) */
                .prod-sifra { font-size: 9px; color: #94a3b8; font-weight: 600; display: block; margin-bottom: 2px;}
                .prod-naziv { font-size: 12px; color: #0f172a; font-weight: 900; text-transform: uppercase; display: block;}
                .prod-dim { font-size: 10px; color: #475569; font-weight: 600; display: block; margin-top: 2px;}
                
                /* ZAKUCANI TOTALI UZ DESNU MARGINU */
                .totals-section {
                    display: flex;
                    justify-content: flex-end;
                    margin-top: 6mm;
                    padding-right: 6px;
                }
                .totals-table {
                    width: auto;
                    min-width: 250px;
                    border-collapse: collapse;
                }
                .totals-table td {
                    padding: 4px 0 4px 15px;
                    border-bottom: none;
                    font-size: 11px;
                }
                .totals-table td.lbl {
                    text-align: right;
                    color: #475569;
                    font-weight: 600;
                }
                .totals-table td.val {
                    text-align: right;
                    color: #0f172a;
                    font-weight: 800;
                }
                .totals-table tr.grand-total td {
                    padding-top: 8px;
                    border-top: 2px solid ${themeColor};
                    font-size: 14px;
                    font-weight: 900;
                    text-transform: uppercase;
                }
                .totals-table tr.grand-total td.val {
                    color: ${themeColor};
                }

                .global-footer-custom { 
                    text-align: center; 
                    margin-top: auto; /* Gura ga na dno stranice */
                    padding-top: 10px; 
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
                
                ${topBannerHtml}
                
                <div class="header">
                    <div class="logo-area">
                        ${leftLogoHtml}
                        <div class="doc-title-area">
                            <div class="doc-title">${tipDokumenta}</div>
                            <div class="doc-subtitle">
                                Broj: <span style="color: #0f172a; font-weight: 800;">${brojDokumenta}</span> &nbsp;|&nbsp; Datum: ${datum}
                            </div>
                        </div>
                    </div>
                    <div class="qr-wrapper">
                        <img src="${qrCodeUrl}" alt="QR" />
                        <div class="qr-text">${brojDokumenta}</div>
                    </div>
                </div>
                
                ${htmlSadrzajTabela}
                
                ${donjiDioHtml}

                ${firmaInfo.footer_tekst ? `<div class="global-footer-custom">${firmaInfo.footer_tekst}</div>` : ''}
            </div>
            ${printSkripta}
        </body>
        </html>
    `;
    
    iframe.contentWindow.document.open(); 
    iframe.contentWindow.document.write(html); 
    iframe.contentWindow.document.close();
    
    setTimeout(() => { document.title = originalTitle; }, 3000);
    setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 300000);
};

// ==========================================
// 2. STANDARDNA A5 DEKLARACIJA PAKETA
// ==========================================
export const printDeklaracijaPaketa = async (paketId, items, vezniDokument = '') => {
    if (!items || items.length === 0) return;

    const originalTitle = document.title;
    document.title = `Deklaracija_${paketId}`;

    const { brending, firmaInfo } = await fetchPrintSettings();

    let logoUrl = '';
    const logoObj = brending.find(b => (b.lokacije_jsonb || []).includes('Svi PDF Dokumenti')) || 
                    brending.find(b => (b.lokacije_jsonb || []).includes('Glavni Meni (Dashboard Vrh)'));
    
    if (logoObj && logoObj.url_slike) {
        logoUrl = logoObj.url_slike;
    }

    const qrPaket = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${paketId}`;
    const qrVeza = vezniDokument ? `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${vezniDokument}` : '';

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
        const v = parseFloat(item.debljina)||1; 
        const s = parseFloat(item.sirina)||1; 
        const d = parseFloat(item.duzina)||1;
        
        if (item.jm === 'm3') {
            pcs = Math.round(pcs / ((v/100)*(s/100)*(d/100)));
        }
        
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
                html, body { 
                    margin: 0 !important; 
                    padding: 0 !important; 
                    background: #fff; 
                    width: 210mm; 
                    height: 148mm; 
                    overflow: hidden; 
                    font-family: 'Inter', sans-serif;
                }
                .page-container { 
                    width: 210mm; 
                    height: 148mm; 
                    padding: 8mm; 
                    box-sizing: border-box; 
                    display: flex; 
                    flex-direction: column; 
                    justify-content: space-between; 
                }
                .header { display: flex; justify-content: space-between; align-items: flex-start; }
                .logo img { max-width: 250px; max-height: 45px; object-fit: contain; }
                .logo h1 { margin: 0; font-size: 26px; font-weight: 900; color: #1e3a8a; }
                .header-info { text-align: right; font-size: 11px; font-weight: bold; }
                .info-row { display: flex; justify-content: flex-end; align-items: center; margin-bottom: 2px; gap: 8px;}
                .info-lbl { border: 1px dotted #666; padding: 2px 4px; font-weight: normal;}
                .info-val { border: 1px dotted #666; padding: 2px 8px; min-width: 100px; text-align: center; }
                .pkg-row { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 6px; margin-bottom: 2px;}
                .pkg-val { font-size: 30px; font-weight: 900;}
                .content-area { flex: 1; margin-top: 5px;}
                .row { display: flex; justify-content: space-between; gap: 8px; width: 100%; margin-top: 4px;}
                .col { flex: 1; text-align: center; display: flex; flex-direction: column;}
                .lbl { font-size: 10px; border-bottom: 1px dotted #000; padding-bottom: 2px; }
                .box { border: 2px solid #000; font-size: 18px; font-weight: 900; flex: 1; display: flex; align-items: center; justify-content: center; min-height: 28px; }
                .qr-area { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 5px;}
                .qr-left-text { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 9px; font-weight: bold;}
                .qr-img-small { width: 70px; height: 70px; } 
                .qr-img-large { width: 80px; height: 80px; }
                .qr-number { font-family: monospace; font-size: 10px; font-weight: bold; text-align:center;}
                .footer { border-top: 3px solid #000; padding-top: 4px; margin-top: 6px; display: flex; justify-content: space-between; font-size: 10px; line-height: 1.3; }
            </style>
        </head>
        <body>
            <div class="page-container">
                <div class="header">
                    <div class="logo">
                        ${logoUrl ? `<img src="${logoUrl}" />` : `<h1>${POSTAVKE.imeFirme}</h1>`}
                    </div>
                    <div class="header-info">
                        <div class="info-row"><span class="info-lbl">DATE:</span><span class="info-val">${datum}</span></div>
                        <div class="pkg-row"><span class="info-lbl">Package:</span><span class="pkg-val">${paketId}</span></div>
                    </div>
                </div>
                <div class="content-area">
                    <div class="row">
                        <div class="col"><span class="lbl">Wood Type</span><div class="box">${woodType}</div></div>
                        <div class="col"><span class="lbl">MC</span><div class="box">8-11%</div></div>
                        <div class="col"><span class="lbl">Quality</span><div class="box">A/B</div></div>
                        <div class="col"><span class="lbl">Total Length</span><div class="box">${Math.round(totalLengthM)}</div></div>
                    </div>
                    ${redoviStavki}
                </div>
                <div class="qr-area">
                    <div style="display:flex;gap:4px;">
                        ${vezniDokument ? `<img src="${qrVeza}" class="qr-img-small" /><span class="qr-left-text">${vezniDokument}</span>` : ''}
                    </div>
                    <div>
                        <img src="${qrPaket}" class="qr-img-large" />
                        <div class="qr-number">${paketId}</div>
                    </div>
                </div>
                <div class="footer">
                    <div>
                        <b>${POSTAVKE.imeFirme}</b><br>
                        ${firmaInfo.adresa}<br>
                        Tel: ${firmaInfo.telefon}
                    </div>
                    <div style="text-align:right">
                        E-mail: ${firmaInfo.email}<br>
                        ${firmaInfo.footer_tekst}
                    </div>
                </div>
            </div>
            ${decodeURIComponent('%3Cscript%3Ewindow.onload%3Dfunction()%7BsetTimeout(function()%7Bwindow.print()%3B%7D%2C2000)%3B%7D%3B%3C%2Fscript%3E')}
        </body>
        </html>
    `;

    iframe.contentWindow.document.open(); 
    iframe.contentWindow.document.write(html); 
    iframe.contentWindow.document.close();
    
    setTimeout(() => { document.title = originalTitle; }, 3000);
    setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 60000);
};

// ==========================================
// 3. FAZNA A5 DEKLARACIJA PAKETA (SA NAREDNIM KORACIMA)
// ==========================================
export const printFaznaDeklaracijaPaketa = async (paketId, stavke, rn, masina, tehnologija) => {
    const stariNaslov = document.title;
    document.title = `FAZA_${paketId}`;

    const { brending, firmaInfo } = await fetchPrintSettings();
    let logoUrl = '';
    const logoObj = brending.find(b => (b.lokacije_jsonb || []).includes('Svi PDF Dokumenti')) || brending.find(b => (b.lokacije_jsonb || []).includes('Glavni Meni (Dashboard Vrh)'));
    if (logoObj && logoObj.url_slike) logoUrl = logoObj.url_slike;

    const qrPaket = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${paketId}`;
    const formatDatumTacke = (iso) => { if(!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}.`; };
    const datum = stavke[0]?.datum_yyyy_mm ? formatDatumTacke(stavke[0].datum_yyyy_mm) : formatDatumTacke(new Date().toISOString().split('T')[0]);

    let redovi = stavke.map((s, i) => `
        <tr>
            <td style="font-weight: bold; border-bottom: 1px solid #cbd5e1; padding: 6px;">${i+1}.</td>
            <td style="border-bottom: 1px solid #cbd5e1; padding: 6px;"><b style="font-size: 16px;">${s.sifra_proizvoda || s.naziv_proizvoda}</b></td>
            <td style="border-bottom: 1px solid #cbd5e1; padding: 6px; font-weight: 900; font-size: 20px;">${s.debljina}x${s.sirina}x${s.duzina}</td>
            <td style="text-align: right; border-bottom: 1px solid #cbd5e1; padding: 6px; font-size: 24px; font-weight: 900; color: #d97706;">${s.kolicina_final} <span style="font-size: 14px; color: #475569;">m³</span></td>
        </tr>
    `).join('');

    let tehnologijaHtml = '<p style="font-size: 12px; color: #64748b;">Nema definisanih faza.</p>';
    if (tehnologija && tehnologija.length > 0) {
        const fazaIndex = tehnologija.findIndex(f => f.masina.toUpperCase() === masina.toUpperCase());
        
        tehnologijaHtml = tehnologija.map((f, i) => {
            const isTrenutna = i === fazaIndex;
            const isBuduca = i > fazaIndex;
            const isProsla = i < fazaIndex;
            
            let boja = '#cbd5e1';
            let bg = 'transparent';
            let dodatak = '';
            
            if (isTrenutna) { boja = '#d97706'; bg = '#fffbeb'; dodatak = '(TRENUTNI KORAK)'; }
            else if (isBuduca) { boja = '#3b82f6'; dodatak = '(SLJEDEĆA FAZA)'; }
            else if (isProsla) { boja = '#10b981'; dodatak = '(ZAVRŠENO)'; }

            return `
                <div style="padding: 6px; margin-bottom: 4px; border-left: 4px solid ${boja}; background: ${bg}; opacity: ${isProsla ? '0.6' : '1'};">
                    <b style="color: ${boja}; font-size: 12px;">${i+1}. ${f.masina} <span style="font-size: 9px; margin-left: 4px;">${dodatak}</span></b><br/>
                    <span style="font-size: 10px;">Cilj: ${f.dimenzija} | ${f.kolicina} ${f.jm}</span>
                </div>
            `;
        }).join('');
    }

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const html = `
        <html>
        <head>
            <title>Fazna Deklaracija ${paketId}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                @page { size: 210mm 148mm landscape; margin: 0; }
                html, body { margin: 0 !important; padding: 0 !important; background: #fff; width: 210mm; height: 148mm; overflow: hidden; font-family: 'Inter', sans-serif;}
                .page-container { width: 210mm; height: 148mm; padding: 8mm 10mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; border-bottom: 3px solid #d97706; padding-bottom: 5px;}
                .logo img { max-width: 200px; max-height: 40px; object-fit: contain; }
                .header-info { text-align: right; }
                .main-content { display: flex; gap: 20px; flex: 1; }
                .left-pane { flex: 2; display: flex; flex-direction: column; }
                .right-pane { flex: 1; border-left: 2px dashed #cbd5e1; padding-left: 15px; display: flex; flex-direction: column; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th { background: #f8fafc; color: #475569; font-size: 11px; text-align: left; padding: 6px; text-transform: uppercase; border-bottom: 2px solid #cbd5e1;}
                .qr-area { display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto;}
                .qr-img { width: 100px; height: 100px; }
                .footer { border-top: 3px solid #d97706; padding-top: 4px; margin-top: 5px; display: flex; justify-content: space-between; font-size: 10px; line-height: 1.3; }
            </style>
        </head>
        <body>
            <div class="page-container">
                <div class="header">
                    <div>
                        <h2 style="color: #d97706; margin: 0; font-size: 28px; text-transform: uppercase;">⚠️ FAZNI PAKET</h2>
                        <p style="margin: 2px 0 0 0; font-size: 12px; font-weight: bold; color: #0f172a;">OVO NIJE GOTOVA ROBA ZA KUPCA!</p>
                    </div>
                    <div class="header-info">
                        <p style="margin: 0; font-size: 12px; color: #475569;">Radni Nalog:</p>
                        <p style="margin: 0; font-size: 24px; font-weight: 900;">${rn || 'Interno'}</p>
                        <p style="margin: 4px 0 0 0; font-size: 10px;">Datum: ${datum}</p>
                    </div>
                </div>
                
                <div class="main-content">
                    <div class="left-pane">
                        <table>
                            <thead>
                                <tr><th>#</th><th>Proizvod</th><th>Radna Dimenzija</th><th style="text-align: right;">Količina</th></tr>
                            </thead>
                            <tbody>${redovi}</tbody>
                        </table>
                        <div class="qr-area">
                            <div>${logoUrl ? `<img src="${logoUrl}" class="logo" />` : `<h3 style="margin:0;">${POSTAVKE.imeFirme}</h3>`}</div>
                            <div style="text-align:center;">
                                <img src="${qrPaket}" class="qr-img" />
                                <div style="font-family:monospace; font-size:14px; font-weight:900; letter-spacing: 2px;">${paketId}</div>
                            </div>
                        </div>
                    </div>
                    <div class="right-pane">
                        <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #0f172a; text-transform: uppercase;">Hronologija obrade:</h4>
                        ${tehnologijaHtml}
                    </div>
                </div>
                
                <div class="footer">
                    <div><b>${POSTAVKE.imeFirme}</b><br>${firmaInfo.adresa}<br>Tel: ${firmaInfo.telefon}</div>
                    <div style="text-align:right">E-mail: ${firmaInfo.email}<br>${firmaInfo.footer_tekst}</div>
                </div>
            </div>
            ${decodeURIComponent('%3Cscript%3Ewindow.onload%3Dfunction()%7BsetTimeout(function()%7Bwindow.print()%3B%7D%2C2000)%3B%7D%3B%3C%2Fscript%3E')}
        </body>
        </html>
    `;

    iframe.contentWindow.document.open(); 
    iframe.contentWindow.document.write(html); 
    iframe.contentWindow.document.close();
    
    setTimeout(() => { document.title = originalTitle; }, 3000);
    setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 60000);
};

// ==========================================
// 4. RADNI NALOG ZA SPECIFIČNU MAŠINU (WIP)
// ==========================================
export const printRadniNalogZaMasinu = async (rn, masina) => {
    const stariNaslov = document.title; 
    document.title = `RN_${rn.id}_${masina}`;
    
    const stavkeZaMasinu = rn.stavke_jsonb.map((s, i) => {
        const faza = (rn.tehnologija_jsonb[s.id] || []).find(f => f.masina === masina); 
        if (!faza) return null;
        return `
            <tr>
                <td style="font-weight: bold; border-bottom: 1px solid #cbd5e1; vertical-align: top;">${i+1}.</td>
                <td style="border-bottom: 1px solid #cbd5e1; vertical-align: top;">
                    <span class="prod-sifra">${s.sifra}</span>
                    <span class="prod-naziv">${s.naziv}</span>
                </td>
                <td style="text-align: center; border-bottom: 1px solid #cbd5e1; font-weight: 800; font-size: 13px; color: #d97706; vertical-align: top;">${faza.dimenzija}</td>
                <td style="text-align: center; border-bottom: 1px solid #cbd5e1; font-weight: 800; font-size: 13px; vertical-align: top;">${faza.kolicina} <span style="font-size: 10px; color: #64748b;">${faza.jm}</span></td>
                <td style="border-bottom: 1px solid #cbd5e1; font-size: 10px; vertical-align: top; color: #475569;">
                    <b>${faza.oznake?.join(', ') || ''}</b><br/> 
                    <i>${faza.napomena || ''}</i>
                </td>
            </tr>
        `;
    }).filter(s => s !== null).join('');
    
    if (!stavkeZaMasinu) return alert(`Nema definisanih zadataka za mašinu: ${masina}`);
    
    const htmlSadrzaj = `
        <div class="info-grid">
            <div class="info-col-left">
                <h4>Kupac / Klijent</h4>
                <h2>${rn.kupac_naziv}</h2>
                <p>Detalji nisu uneseni</p>
            </div>
            <div class="info-col-right">
                <p>Rok Isporuke: <b>${new Date(rn.rok_isporuke).toLocaleDateString('de-DE')}</b></p>
            </div>
        </div>

        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr>
                    <th style="width: 5%;">#</th>
                    <th style="width: 45%;">Proizvod za Obradu</th>
                    <th style="text-align: center;">Radna Dimenzija</th>
                    <th style="text-align: center;">Količina</th>
                    <th>Zadatak / Oznake</th>
                </tr>
            </thead>
            <tbody>${stavkeZaMasinu}</tbody>
        </table>
    `;
    
    await printDokument(`PROIZVODNI NALOG: ${masina}`, rn.id, new Date(rn.datum).toLocaleDateString('de-DE'), htmlSadrzaj, '#0f172a');
    setTimeout(() => { document.title = stariNaslov; }, 2000);
};

// ==========================================
// 5. RADNI NALOG KOMPLETNA RAZRADA (SVE FAZE)
// ==========================================
export const printRadniNalogSveFaze = async (rn) => {
    const stariNaslov = document.title; 
    document.title = `RN_SVE_FAZE_${rn.id}`;
    
    let redovi = rn.stavke_jsonb.map((s, i) => {
        const faze = rn.tehnologija_jsonb[s.id] || [];
        const fazeHtml = faze.map((f, fi) => `
            <div style="font-size: 9px; border-left: 2px solid #d97706; padding-left: 5px; margin-bottom: 3px; color: #475569;">
                <b style="color: #0f172a;">${fi+1}. ${f.masina}</b> &mdash; Dimenzija: <b>${f.dimenzija}</b> | Target: <b>${f.kolicina} ${f.jm}</b>
            </div>
        `).join('');
        
        return `
            <tr>
                <td style="font-weight: bold; border-bottom: 1px solid #cbd5e1; padding: 6px; vertical-align: top;">${i+1}.</td>
                <td style="border-bottom: 1px solid #cbd5e1; padding: 6px; vertical-align: top;">
                    <span class="prod-sifra">${s.sifra}</span>
                    <span class="prod-naziv">${s.naziv}</span>
                    <div style="margin-top: 6px; background: #f8fafc; padding: 6px; border-radius: 4px;">
                        <span style="display: block; font-size: 8px; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; font-weight: 800;">Tehnološki proces (BOM):</span>
                        ${fazeHtml}
                    </div>
                </td>
                <td class="num" style="border-bottom: 1px solid #cbd5e1; vertical-align: top; font-weight: 900; font-size: 14px; color: #a855f7; padding: 6px;">
                    ${s.kolicina_obracun} <span style="font-size: 10px; color: #64748b;">${s.jm_obracun}</span>
                </td>
            </tr>
        `;
    }).join('');
    
    const htmlSadrzaj = `
        <div class="info-grid" style="border-left-color: #a855f7;">
            <div class="info-col-left">
                <h4>Naručilac Projekta</h4>
                <h2>${rn.kupac_naziv}</h2>
            </div>
            <div class="info-col-right">
                <p>Tip naloga: <b>FAZNI (VIŠE MAŠINA)</b></p>
                <p>Rok Isporuke: <b>${new Date(rn.rok_isporuke).toLocaleDateString('de-DE')}</b></p>
            </div>
        </div>

        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr>
                    <th style="background: #a855f7; width: 5%;">#</th>
                    <th style="background: #a855f7; width: 70%;">Proizvod i Planirani Procesi (BOM)</th>
                    <th class="num" style="background: #a855f7;">Ukupna Ciljna Količina</th>
                </tr>
            </thead>
            <tbody>${redovi}</tbody>
        </table>
    `;
    
    await printDokument('GLAVNI RADNI NALOG', rn.id, new Date(rn.datum).toLocaleDateString('de-DE'), htmlSadrzaj, '#a855f7');
    setTimeout(() => { document.title = stariNaslov; }, 2000);
};