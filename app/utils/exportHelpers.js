"use client";
import { toast } from 'sonner';

const escapeXml = (str) =>
    String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

const sanitizeFilename = (name) =>
    String(name || 'izvoz')
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 80);

function triggerDownload(blob, filename) {
    if (typeof window === 'undefined') return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 500);
}

/**
 * Izvozi podatke kao pravi formatirani Excel SpreadsheetML (.xls) fajl
 * sa podebljanim zaglavljem, ispravnim tipovima brojeva, našim dijakriticima (Č,Ć,Š,Ž,Đ)
 * i opcionim zbirnim redom na dnu.
 *
 * @param {object} opts
 * @param {string} opts.filename - naziv fajla bez ekstenzije
 * @param {string} opts.sheetName - naziv radnog lista u Excelu
 * @param {string} [opts.title] - naslov na vrhu dokumenta
 * @param {Array<{key: string, label: string, type?: 'string'|'number', format?: function}>} opts.columns
 * @param {Array<object>} opts.rows
 * @param {object} [opts.summaryRow] - opcioni sumarni red na dnu { [key]: value }
 */
export function exportToExcel({ filename, sheetName = 'Izvještaj', title = '', columns = [], rows = [], summaryRow = null }) {
    if (!rows || rows.length === 0) {
        toast.warning('Nema podataka za izvoz u Excel.');
        return false;
    }

    const safeSheet = escapeXml(String(sheetName).replace(/[\\/*?:[\]]/g, '').slice(0, 31) || 'Izvjestaj');
    const colDefs = columns.map((c) => `<Column ss:AutoFitWidth="1" ss:Width="${c.width || (c.type === 'number' ? 105 : 145)}"/>`).join('');

    const titleRowXml = title
        ? `<Row ss:Height="26"><Cell ss:MergeAcross="${Math.max(0, columns.length - 1)}" ss:StyleID="Title"><Data ss:Type="String">${escapeXml(title)}</Data></Cell></Row><Row ss:Height="10"></Row>`
        : '';

    const headerRowXml = `<Row ss:Height="22">${columns
        .map((c) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(c.label)}</Data></Cell>`)
        .join('')}</Row>`;

    const bodyRowsXml = rows
        .map((row) => {
            const cells = columns
                .map((col) => {
                    const rawVal = typeof col.format === 'function' ? col.format(row[col.key], row) : row[col.key];
                    if (col.type === 'number') {
                        const num = parseFloat(rawVal);
                        if (!isNaN(num) && isFinite(num)) {
                            return `<Cell ss:StyleID="Number"><Data ss:Type="Number">${num}</Data></Cell>`;
                        }
                    }
                    return `<Cell ss:StyleID="Cell"><Data ss:Type="String">${escapeXml(rawVal ?? '')}</Data></Cell>`;
                })
                .join('');
            return `<Row ss:Height="19">${cells}</Row>`;
        })
        .join('');

    const summaryXml = summaryRow
        ? `<Row ss:Height="22">${columns
              .map((col) => {
                  const val = summaryRow[col.key];
                  if (val === undefined || val === null || val === '') {
                      return `<Cell ss:StyleID="Summary"><Data ss:Type="String"></Data></Cell>`;
                  }
                  if (col.type === 'number' && !isNaN(parseFloat(val))) {
                      return `<Cell ss:StyleID="SummaryNum"><Data ss:Type="Number">${parseFloat(val)}</Data></Cell>`;
                  }
                  return `<Cell ss:StyleID="Summary"><Data ss:Type="String">${escapeXml(val)}</Data></Cell>`;
              })
              .join('')}</Row>`
        : '';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Title">
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#0F172A"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="Cell">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#0F172A"/>
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="Number">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#0F172A"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="Summary">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#334155"/>
   </Borders>
  </Style>
  <Style ss:ID="SummaryNum">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#047857"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0.00"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#334155"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="${safeSheet}">
  <Table>
   ${colDefs}
   ${titleRowXml}
   ${headerRowXml}
   ${bodyRowsXml}
   ${summaryXml}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob(['\uFEFF', xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const fullFilename = `${sanitizeFilename(filename)}.xls`;
    triggerDownload(blob, fullFilename);
    toast.success(`Excel fajl "${fullFilename}" (${rows.length} redova) je preuzet!`);
    return true;
}

/**
 * Izvozi podatke kao čisti UTF-8 BOM CSV (sa ; separatorom za evropski Excel).
 */
export function exportToCsv({ filename, columns = [], rows = [] }) {
    if (!rows || rows.length === 0) {
        toast.warning('Nema podataka za izvoz u CSV.');
        return false;
    }
    const esc = (v) => {
        const s = String(v ?? '').replace(/\r?\n/g, ' ');
        return /[";,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = columns.map((c) => esc(c.label)).join(';');
    const lines = rows.map((row) =>
        columns
            .map((c) => {
                const val = typeof c.format === 'function' ? c.format(row[c.key], row) : row[c.key];
                return esc(val);
            })
            .join(';')
    );
    const csv = [header, ...lines].join('\r\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
    const fullFilename = `${sanitizeFilename(filename)}.csv`;
    triggerDownload(blob, fullFilename);
    toast.success(`CSV fajl "${fullFilename}" je preuzet!`);
    return true;
}
