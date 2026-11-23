import { supabase } from './supabaseClient';
import { toast } from 'sonner';
import { toLocalIso, escapeHtml, prikazDatumaBHS, formatirajHtmlBHS } from './dateHelpers';

export const POSTAVKE = {
    imeAplikacije: "TTM DOO ERP",
    imeFirme: "TTM d.o.o.",
    bojaFirme: "#3b82f6" 
};

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
export const printDokument = async (tipDokumenta, brojDokumenta, datum, htmlSadrzajTabela, themeColor = '#3b82f6', totaliHtml = null, options = {}) => {
    const datumBhs = datum ? prikazDatumaBHS(datum) : prikazDatumaBHS(toLocalIso(new Date()));
    const htmlSadrzajBhs = formatirajHtmlBHS(htmlSadrzajTabela || '');
    const totaliBhs = totaliHtml ? formatirajHtmlBHS(totaliHtml) : null;
    const originalTitle = document.title;
    const nazivFajla = `${datumBhs} ${tipDokumenta} ${brojDokumenta}`;
    document.title = nazivFajla;
    const autoFitSinglePage = options?.singlePage !== false;

    let trazenaLokacija = 'Svi PDF Dokumenti';
    if (tipDokumenta === 'PONUDA') trazenaLokacija = 'PDF Ponuda';
    else if (tipDokumenta === 'RADNI NALOG') trazenaLokacija = 'PDF Radni Nalog';
    else if (tipDokumenta === 'OTPREMNICA') trazenaLokacija = 'PDF Otpremnica';
    else if (tipDokumenta === 'RAČUN') trazenaLokacija = 'PDF Račun';
    else if (tipDokumenta.includes('POTVRDA')) trazenaLokacija = 'PDF Blagajna';

    const { brending, firmaInfo } = await fetchPrintSettings();

    const nazivFirme = escapeHtml(firmaInfo?.app_name || POSTAVKE.imeFirme);
    let topBannerHtml = '';
    let leftLogoHtml = `<div class="company-name">${nazivFirme}</div>`;

    const logoObj = brending.find(b => (b.lokacije_jsonb || []).includes(trazenaLokacija)) || 
                    brending.find(b => (b.lokacije_jsonb || []).includes('Svi PDF Dokumenti')) ||
                    brending.find(b => (b.lokacije_jsonb || []).includes('GLAVNI MENI / SIDEBAR (GORE LIJEVO)'));
    
    if (logoObj && logoObj.url_slike) {
        if (logoObj.full_width) {
            topBannerHtml = `
                <div class="full-width-banner">
                    <img src="${escapeHtml(logoObj.url_slike)}" alt="Banner Firme" />
                </div>`;
            leftLogoHtml = ''; 
        } else {
            leftLogoHtml = `<img src="${escapeHtml(logoObj.url_slike)}" class="left-logo" alt="Logo Firme" />`;
        }
    }

    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-pilana-print-frame', 'true');
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(brojDokumenta || '')}`;
    const autoFitFnBody = `
        (function() {
            var AUTO_FIT = ${autoFitSinglePage ? 'true' : 'false'};
            var printed = false;

            function izracunajJednuStranicu() {
                var pc = document.querySelector('.page-container');
                if (!pc) return;
                if (!AUTO_FIT) {
                    pc.setAttribute('data-fit-mode', 'multi-page');
                    return;
                }
                // A4 visina na 96dpi je 1122.5px; koristimo 1108px kao sigurnu granicu bez prelaza na stranu 2
                var A4_PX = 1108;
                pc.style.zoom = '';
                pc.style.width = '210mm';
                pc.style.maxWidth = '210mm';
                pc.classList.remove('fit-compact', 'single-page-locked');

                var h1 = Math.ceil(pc.scrollHeight);
                if (h1 <= A4_PX) {
                    pc.classList.add('single-page-locked');
                    pc.setAttribute('data-fit-mode', 'single-natural');
                    pc.setAttribute('data-fit-scale', '1');
                    pc.setAttribute('data-measured-height', String(h1));
                    return;
                }

                // Korak 1: kompaktni raspored (bez umanjenja slova ispod čitljive granice)
                pc.classList.add('fit-compact');
                void pc.offsetHeight;
                var h2 = Math.ceil(pc.scrollHeight);
                if (h2 <= A4_PX) {
                    pc.classList.add('single-page-locked');
                    pc.setAttribute('data-fit-mode', 'single-compact');
                    pc.setAttribute('data-fit-scale', '1');
                    pc.setAttribute('data-measured-height', String(h2));
                    return;
                }

                // Korak 2: precizno skaliranje za standardne izvještaje do ~1.65 stranice da stanu na tačno 1 A4 list pune širine
                if (h2 <= A4_PX * 1.65) {
                    var scale = Math.max(0.62, Math.floor((A4_PX / h2) * 985) / 1000);
                    pc.style.width = (210 / scale).toFixed(2) + 'mm';
                    pc.style.maxWidth = 'none';
                    pc.style.zoom = String(scale);
                    void pc.offsetHeight;
                    var visualH = Math.ceil(pc.scrollHeight * scale);
                    if (visualH > A4_PX && scale > 0.60) {
                        var scale2 = Math.max(0.58, Math.floor((A4_PX / visualH) * scale * 985) / 1000);
                        scale = scale2;
                        pc.style.width = (210 / scale).toFixed(2) + 'mm';
                        pc.style.zoom = String(scale);
                        void pc.offsetHeight;
                        visualH = Math.ceil(pc.scrollHeight * scale);
                    }
                    pc.style.height = (294.5 / scale).toFixed(2) + 'mm';
                    pc.style.maxHeight = (294.5 / scale).toFixed(2) + 'mm';
                    pc.style.overflow = 'hidden';
                    pc.setAttribute('data-fit-mode', 'single-scaled');
                    pc.setAttribute('data-fit-scale', String(scale));
                    pc.setAttribute('data-measured-height', String(visualH));
                    return;
                }

                // Vrlo dugi zbirni izvještaji (>1.65 stranice) ostaju čitljivi kroz više stranica sa ponavljajućim zaglavljem tabele
                pc.setAttribute('data-fit-mode', 'multi-page');
                pc.setAttribute('data-fit-scale', '1');
                pc.setAttribute('data-measured-height', String(h2));
            }

            function pokreniPrint() {
                if (printed) return;
                printed = true;
                try { izracunajJednuStranicu(); } catch (e) {}
                setTimeout(function() {
                    try { window.print(); } catch (e) {}
                }, 180);
            }

            window.addEventListener('load', function() {
                setTimeout(pokreniPrint, 700);
            });
            // Sigurnosni fallback ako vanjski QR/font kasni
            setTimeout(pokreniPrint, 2200);
        })();
    `;
    const printSkripta = '<scr' + 'ipt>' + autoFitFnBody + '</scr' + 'ipt>';

    const donjiDioHtml = totaliBhs ? `
        <div class="totals-section">
            ${totaliBhs}
        </div>
    ` : '';

    const html = `
        <html>
        <head>
            <title>${nazivFajla}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
                @page { size: A4 portrait; margin: 0; }
                html, body {
                    padding: 0;
                    margin: 0;
                    background: #ffffff;
                }
                body { 
                    font-family: 'Inter', sans-serif; 
                    color: #1e293b; 
                    -webkit-print-color-adjust: exact; 
                    print-color-adjust: exact; 
                }
                .page-container { 
                    width: 210mm;
                    max-width: 210mm;
                    padding: 10mm 12mm 9mm 12mm; 
                    min-height: auto; 
                    box-sizing: border-box;
                    display: flex; 
                    flex-direction: column; 
                    position: relative;
                }
                .page-container.single-page-locked {
                    height: 294.5mm !important;
                    max-height: 294.5mm !important;
                    overflow: hidden !important;
                    page-break-after: avoid !important;
                    break-after: avoid !important;
                }
                .top-bar { 
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 8px; 
                    background-color: ${themeColor}; 
                    width: 100%; 
                }
                .full-width-banner {
                    width: 100%;
                    margin-bottom: 4mm;
                    text-align: center;
                }
                .full-width-banner img {
                    width: 100%;
                    max-height: 82px;
                    object-fit: contain;
                }
                .header { 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: flex-start;
                    padding-bottom: 3.5mm; 
                    border-bottom: 2px solid #e2e8f0; 
                    margin-bottom: 4mm; 
                }
                .logo-area { display: flex; flex-direction: column; max-width: 74%; }
                .company-name { font-size: 17px; font-weight: 900; color: #0f172a; }
                .left-logo { 
                    max-height: 52px; 
                    max-width: 240px; 
                    object-fit: contain; 
                    margin-bottom: 3px; 
                }
                .doc-title-area { margin-top: 6px; }
                .doc-title { 
                    font-size: 22px; 
                    font-weight: 900; 
                    color: ${themeColor}; 
                    text-transform: uppercase; 
                    margin: 0; 
                    line-height: 1.05; 
                }
                .doc-subtitle { color: #64748b; font-size: 10px; font-weight: 600; margin-top: 3px; }
                .qr-wrapper { 
                    text-align: right; 
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                }
                .qr-wrapper img { width: 58px; height: 58px; margin-bottom: 2px; }
                .qr-text { font-family: monospace; font-size: 8.5px; font-weight: 800; color: #475569; }
                .info-grid { 
                    display: flex; 
                    justify-content: space-between; 
                    background: #f8fafc; 
                    padding: 3mm 4mm; 
                    border-radius: 7px; 
                    border: 1px solid #cbd5e1;
                    border-left: 4px solid ${themeColor}; 
                    margin-bottom: 4mm; 
                }
                .info-col-left h4 { margin: 0 0 2px 0; font-size: 8.5px; text-transform: uppercase; color: #64748b; font-weight: 800; }
                .info-col-left h2 { margin: 0 0 2px 0; font-size: 14px; color: #0f172a; font-weight: 900; text-transform: uppercase; }
                .info-col-left p { margin: 0; font-size: 9.5px; color: #475569; line-height: 1.35; }
                .info-col-right { text-align: right; font-size: 9.5px; color: #475569; display: flex; flex-direction: column; justify-content: center; gap: 2px; }
                .info-col-right p { margin: 0; }
                .info-col-right b { color: #0f172a; font-weight: 800;}
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-top: 4px; 
                    font-size: 9.5px; 
                    page-break-inside: auto; 
                }
                thead { display: table-header-group; }
                tr { page-break-inside: avoid; page-break-after: auto; }
                th { 
                    background-color: ${themeColor}; 
                    color: white; 
                    padding: 5.5px 5px; 
                    text-transform: uppercase; 
                    font-size: 8.5px; 
                    font-weight: 800;
                    text-align: left; 
                }
                th.num { text-align: right; }
                td { padding: 5px 5px; border-bottom: 1px solid #cbd5e1; color: #334155; vertical-align: top;}
                td.num { text-align: right; font-weight: 800; font-size: 10px; color: #0f172a;}
                .prod-sifra { font-size: 8.5px; color: #94a3b8; font-weight: 600; display: block; margin-bottom: 1px;}
                .prod-naziv { font-size: 10.5px; color: #0f172a; font-weight: 900; text-transform: uppercase; display: block;}
                .prod-dim { font-size: 9px; color: #475569; font-weight: 600; display: block; margin-top: 1px;}
                .totals-section {
                    display: flex;
                    justify-content: flex-end;
                    margin-top: 4mm;
                    padding-right: 4px;
                    page-break-inside: avoid;
                }
                .totals-table {
                    width: auto;
                    min-width: 240px;
                    border-collapse: collapse;
                }
                .totals-table td {
                    padding: 3px 0 3px 14px;
                    border-bottom: none;
                    font-size: 10px;
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
                    padding-top: 6px;
                    border-top: 2px solid ${themeColor};
                    font-size: 12.5px;
                    font-weight: 900;
                    text-transform: uppercase;
                }
                .totals-table tr.grand-total td.val {
                    color: ${themeColor};
                }
                .global-footer-custom { 
                    text-align: center; 
                    margin-top: auto;
                    padding-top: 6px; 
                    border-top: 1px solid #e2e8f0; 
                    color: ${firmaInfo.footer_boja}; 
                    font-size: ${firmaInfo.footer_velicina}px; 
                    font-weight: 600; 
                    page-break-inside: avoid;
                }

                /* Automatski kompaktni režim kada izvještaj malo prelazi 1 A4 stranicu */
                .page-container.fit-compact {
                    padding: 7.5mm 9.5mm 7mm 9.5mm;
                }
                .page-container.fit-compact .full-width-banner { margin-bottom: 2.5mm; }
                .page-container.fit-compact .full-width-banner img { max-height: 62px; }
                .page-container.fit-compact .header { padding-bottom: 2.5mm; margin-bottom: 3mm; }
                .page-container.fit-compact .left-logo { max-height: 40px; }
                .page-container.fit-compact .doc-title-area { margin-top: 3px; }
                .page-container.fit-compact .doc-title { font-size: 18px; }
                .page-container.fit-compact .doc-subtitle { font-size: 9px; }
                .page-container.fit-compact .qr-wrapper img { width: 46px; height: 46px; }
                .page-container.fit-compact .info-grid { padding: 2.2mm 3.2mm; margin-bottom: 3mm; }
                .page-container.fit-compact .info-col-left h2 { font-size: 12.5px; }
                .page-container.fit-compact .info-col-left p,
                .page-container.fit-compact .info-col-right { font-size: 8.5px; }
                .page-container.fit-compact table { font-size: 8.5px; margin-top: 3px; }
                .page-container.fit-compact th { padding: 3.5px 4px !important; font-size: 7.8px !important; }
                .page-container.fit-compact td { padding: 3px 4px !important; }
                .page-container.fit-compact td.num { font-size: 8.8px !important; }
                .page-container.fit-compact .prod-naziv { font-size: 9.5px; }
                .page-container.fit-compact .totals-section { margin-top: 3mm; }
                .page-container.fit-compact .totals-table td { padding: 2px 0 2px 10px !important; font-size: 9px; }
                .page-container.fit-compact .totals-table tr.grand-total td { font-size: 11px; padding-top: 4px !important; }
                .page-container.fit-compact svg { max-height: 165px !important; }
                .page-container.fit-compact .smartchart-print-box { padding: 6px 8px !important; margin: 6px 0 !important; }
                .page-container.fit-compact h2,
                .page-container.fit-compact h3 { margin-top: 6px !important; margin-bottom: 4px !important; }
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
                                Broj: <span style="color: #0f172a; font-weight: 800;">${brojDokumenta}</span> &nbsp;|&nbsp; Datum: ${datumBhs}
                            </div>
                        </div>
                    </div>
                    <div class="qr-wrapper">
                        <img src="${qrCodeUrl}" alt="QR" />
                        <div class="qr-text">${brojDokumenta}</div>
                    </div>
                </div>
                ${htmlSadrzajBhs}
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
// 2. STANDARDNA A5 DEKLARACIJA PAKETA (Dimenzije u cm)
// ==========================================
export const printDeklaracijaPaketa = async (paketId, items, vezniDokument = '') => {
    if (!items || items.length === 0) return;

    const originalTitle = document.title;
    document.title = `Deklaracija_${paketId}`;

    const { brending, firmaInfo } = await fetchPrintSettings();

    let logoUrl = '';
    const logoObj = brending.find(b => (b.lokacije_jsonb || []).includes('Svi PDF Dokumenti')) || 
                    brending.find(b => (b.lokacije_jsonb || []).includes('GLAVNI MENI / SIDEBAR (GORE LIJEVO)')) ||
                    brending.find(b => (b.lokacije_jsonb || []).includes('Glavni Meni (Dashboard Vrh)'));
    
    if (logoObj && logoObj.url_slike) {
        logoUrl = logoObj.url_slike;
    }

    const qrPaket = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(paketId || '')}`;
    const qrVeza = vezniDokument ? `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(vezniDokument)}` : '';
    const nazivFirme = escapeHtml(firmaInfo?.app_name || POSTAVKE.imeFirme);

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const datum = items[0].datum_yyyy_mm ? prikazDatumaBHS(items[0].datum_yyyy_mm) : prikazDatumaBHS(toLocalIso(new Date()));
    const woodType = escapeHtml((items[0].naziv_proizvoda || 'Rezana').split(' ')[0] || 'Rezana'); 
    let totalLengthM = 0;

    const redoviStavki = items.map(item => {
        let pcs = parseFloat(item.kolicina_ulaz || 0);
        const v = parseFloat(item.debljina) || 0;
        const s = parseFloat(item.sirina) || 0;
        const d = parseFloat(item.duzina) || 0;
        const jmNorm = String(item.jm || 'kom').toLowerCase();
        
        if (jmNorm === 'm3' && v > 0 && s > 0 && d > 0) {
            pcs = Math.round(pcs / ((v / 100) * (s / 100) * (d / 100)));
        } else if (jmNorm === 'm2' && s > 0 && d > 0) {
            pcs = Math.round(pcs / ((s / 100) * (d / 100)));
        } else if (jmNorm === 'm1' && d > 0) {
            pcs = Math.round(pcs / (d / 100));
        }
        
        totalLengthM += (pcs * (d / 100));

        return `
            <div class="row">
                <div class="col"><div class="lbl-wrap"><span class="lbl">Thickness (cm)</span></div><div class="box">${escapeHtml(item.debljina)}</div></div>
                <div class="col"><div class="lbl-wrap"><span class="lbl">Width (cm)</span></div><div class="box">${escapeHtml(item.sirina)}</div></div>
                <div class="col"><div class="lbl-wrap"><span class="lbl">Length (cm)</span></div><div class="box">${escapeHtml(item.duzina)}</div></div>
                <div class="col"><div class="lbl-wrap"><span class="lbl">PCS</span></div><div class="box">${pcs}</div></div>
                <div class="col"><div class="lbl-wrap"><span class="lbl">Volume (m³)</span></div><div class="box">${escapeHtml(item.kolicina_final)}</div></div>
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
                        <div class="col"><span class="lbl">Total Length (m)</span><div class="box">${Math.round(totalLengthM)}</div></div>
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
    const originalTitle = document.title;
    document.title = `FAZA_${paketId}`;

    const { brending, firmaInfo } = await fetchPrintSettings();
    let logoUrl = '';
    const logoObj = brending.find(b => (b.lokacije_jsonb || []).includes('Svi PDF Dokumenti')) ||
                    brending.find(b => (b.lokacije_jsonb || []).includes('GLAVNI MENI / SIDEBAR (GORE LIJEVO)')) ||
                    brending.find(b => (b.lokacije_jsonb || []).includes('Glavni Meni (Dashboard Vrh)'));
    if (logoObj && logoObj.url_slike) logoUrl = logoObj.url_slike;

    const nazivFirme = escapeHtml(firmaInfo?.app_name || POSTAVKE.imeFirme);
    const qrPaket = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(paketId || '')}`;
    const datum = stavke?.[0]?.datum_yyyy_mm ? prikazDatumaBHS(stavke[0].datum_yyyy_mm) : prikazDatumaBHS(toLocalIso(new Date()));

    let redovi = (stavke || []).map((s, i) => `
        <tr>
            <td style="font-weight: bold; border-bottom: 1px solid #cbd5e1; padding: 6px;">${i+1}.</td>
            <td style="border-bottom: 1px solid #cbd5e1; padding: 6px;"><b style="font-size: 16px;">${escapeHtml(s.sifra_proizvoda || s.naziv_proizvoda)}</b></td>
            <td style="border-bottom: 1px solid #cbd5e1; padding: 6px; font-weight: 900; font-size: 20px;">${escapeHtml(s.debljina)}x${escapeHtml(s.sirina)}x${escapeHtml(s.duzina)} cm</td>
            <td style="text-align: right; border-bottom: 1px solid #cbd5e1; padding: 6px; font-size: 24px; font-weight: 900; color: #d97706;">${escapeHtml(s.kolicina_final)} <span style="font-size: 14px; color: #475569;">m³</span></td>
        </tr>
    `).join('');

    let tehnologijaHtml = '<p style="font-size: 12px; color: #64748b;">Nema definisanih faza.</p>';
    if (tehnologija && tehnologija.length > 0) {
        const fazaIndex = tehnologija.findIndex(f => String(f?.masina || '').toUpperCase() === String(masina || '').toUpperCase());
        
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
                    <span style="font-size: 10px;">Cilj: ${f.dimenzija} cm | ${f.kolicina} ${f.jm}</span>
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
                                <tr><th>#</th><th>Proizvod</th><th>Radna Dimenzija (cm)</th><th style="text-align: right;">Količina</th></tr>
                            </thead>
                            <tbody>${redovi}</tbody>
                        </table>
                        <div class="qr-area">
                            <div class="logo">${logoUrl ? `<img src="${escapeHtml(logoUrl)}" />` : `<h3 style="margin:0;">${nazivFirme}</h3>`}</div>
                            <div style="text-align:center;">
                                <img src="${qrPaket}" class="qr-img" />
                                <div style="font-family:monospace; font-size:14px; font-weight:900; letter-spacing: 2px;">${escapeHtml(paketId)}</div>
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
    const stavkeArr = Array.isArray(rn?.stavke_jsonb) ? rn.stavke_jsonb : [];
    const tehObj = rn?.tehnologija_jsonb || {};

    const stavkeZaMasinu = stavkeArr.map((s, i) => {
        const faza = (tehObj[s.id] || []).find(f => String(f?.masina || '').toUpperCase() === String(masina || '').toUpperCase()); 
        if (!faza) return null;
        return `
            <tr>
                <td style="font-weight: bold; border-bottom: 1px solid #cbd5e1; vertical-align: top;">${i+1}.</td>
                <td style="border-bottom: 1px solid #cbd5e1; vertical-align: top;">
                    <span class="prod-sifra">${escapeHtml(s.sifra)}</span>
                    <span class="prod-naziv">${escapeHtml(s.naziv)}</span>
                </td>
                <td style="text-align: center; border-bottom: 1px solid #cbd5e1; font-weight: 800; font-size: 13px; color: #d97706; vertical-align: top;">${escapeHtml(faza.dimenzija)} cm</td>
                <td style="text-align: center; border-bottom: 1px solid #cbd5e1; font-weight: 800; font-size: 13px; vertical-align: top;">${escapeHtml(faza.kolicina)} <span style="font-size: 10px; color: #64748b;">${escapeHtml(faza.jm)}</span></td>
                <td style="border-bottom: 1px solid #cbd5e1; font-size: 10px; vertical-align: top; color: #475569;">
                    <b>${escapeHtml(faza.oznake?.join(', ') || '')}</b><br/> 
                    <i>${escapeHtml(faza.napomena || '')}</i>
                </td>
            </tr>
        `;
    }).filter(s => s !== null).join('');
    
    if (!stavkeZaMasinu) return toast.warning(`Nema definisanih zadataka za mašinu: ${masina}`);
    
    const htmlSadrzaj = `
        <div class="info-grid">
            <div class="info-col-left">
                <h4>Kupac / Klijent</h4>
                <h2>${escapeHtml(rn.kupac_naziv)}</h2>
                <p>Detalji nisu uneseni</p>
            </div>
            <div class="info-col-right">
                <p>Rok Isporuke: <b>${prikazDatumaBHS(rn.rok_isporuke)}</b></p>
            </div>
        </div>

        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr>
                    <th style="width: 5%;">#</th>
                    <th style="width: 45%;">Proizvod za Obradu</th>
                    <th style="text-align: center;">Radna Dimenzija (cm)</th>
                    <th style="text-align: center;">Količina</th>
                    <th>Zadatak / Oznake</th>
                </tr>
            </thead>
            <tbody>${stavkeZaMasinu}</tbody>
        </table>
    `;
    
    await printDokument(`PROIZVODNI NALOG: ${masina}`, rn.id, prikazDatumaBHS(rn.datum), htmlSadrzaj, '#0f172a');
};

// ==========================================
// 5. RADNI NALOG KOMPLETNA RAZRADA (SVE FAZE)
// ==========================================
export const printRadniNalogSveFaze = async (rn) => {
    const stavkeArr = Array.isArray(rn?.stavke_jsonb) ? rn.stavke_jsonb : [];
    const tehObj = rn?.tehnologija_jsonb || {};

    let redovi = stavkeArr.map((s, i) => {
        const faze = tehObj[s.id] || [];
        const fazeHtml = faze.map((f, fi) => `
            <div style="font-size: 9px; border-left: 2px solid #d97706; padding-left: 5px; margin-bottom: 3px; color: #475569;">
                <b style="color: #0f172a;">${fi+1}. ${escapeHtml(f.masina)}</b> &mdash; Dimenzija: <b>${escapeHtml(f.dimenzija)} cm</b> | Target: <b>${escapeHtml(f.kolicina)} ${escapeHtml(f.jm)}</b>
            </div>
        `).join('');
        
        return `
            <tr>
                <td style="font-weight: bold; border-bottom: 1px solid #cbd5e1; padding: 6px; vertical-align: top;">${i+1}.</td>
                <td style="border-bottom: 1px solid #cbd5e1; padding: 6px; vertical-align: top;">
                    <span class="prod-sifra">${escapeHtml(s.sifra)}</span>
                    <span class="prod-naziv">${escapeHtml(s.naziv)}</span>
                    <div style="margin-top: 6px; background: #f8fafc; padding: 6px; border-radius: 4px;">
                        <span style="display: block; font-size: 8px; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; font-weight: 800;">Tehnološki proces (BOM):</span>
                        ${fazeHtml}
                    </div>
                </td>
                <td class="num" style="border-bottom: 1px solid #cbd5e1; vertical-align: top; font-weight: 900; font-size: 14px; color: #a855f7; padding: 6px;">
                    ${escapeHtml(s.kolicina_obracun)} <span style="font-size: 10px; color: #64748b;">${escapeHtml(s.jm_obracun)}</span>
                </td>
            </tr>
        `;
    }).join('');
    
    const htmlSadrzaj = `
        <div class="info-grid" style="border-left-color: #a855f7;">
            <div class="info-col-left">
                <h4>Naručilac Projekta</h4>
                <h2>${escapeHtml(rn.kupac_naziv)}</h2>
            </div>
            <div class="info-col-right">
                <p>Tip naloga: <b>FAZNI (VIŠE MAŠINA)</b></p>
                <p>Rok Isporuke: <b>${prikazDatumaBHS(rn.rok_isporuke)}</b></p>
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
    
    await printDokument('GLAVNI RADNI NALOG', rn.id, prikazDatumaBHS(rn.datum), htmlSadrzaj, '#a855f7');
};