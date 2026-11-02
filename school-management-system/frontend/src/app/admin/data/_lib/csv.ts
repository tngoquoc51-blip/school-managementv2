/** Đọc CSV / TSV (dán từ Excel): tự nhận dấu tách (tab, chấm phẩy, phẩy), ô có ngoặc kép, BOM. */
export function parseDelimited(input: string): string[][] {
    const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
    const first = text.split(/\r?\n/, 1)[0] ?? '';
    const count = (ch: string) => first.split(ch).length - 1;
    const tab = count('\t');
    const semi = count(';');
    const comma = count(',');
    const delim = tab > 0 && tab >= semi && tab >= comma ? '\t' : semi > comma ? ';' : ',';

    const rows: string[][] = [];
    let row: string[] = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) {
            if (c === '"') {
                if (text[i + 1] === '"') { cur += '"'; i++; } else q = false;
            } else cur += c;
        } else if (c === '"') q = true;
        else if (c === delim) { row.push(cur); cur = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(cur);
            cur = '';
            if (row.some((x) => x.trim() !== '')) rows.push(row);
            row = [];
        } else cur += c;
    }
    row.push(cur);
    if (row.some((x) => x.trim() !== '')) rows.push(row);
    return rows;
}

const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(esc).join(',')).join('\r\n');

const xml = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Excel 2003 XML (đuôi .xls) – mở trực tiếp bằng Excel, không cần thư viện. */
export function toExcelXml(sheet: string, rows: unknown[][]): string {
    const body = rows
        .map((r) => `<Row>${r.map((v) => `<Cell><Data ss:Type="${typeof v === 'number' ? 'Number' : 'String'}">${xml(v)}</Data></Cell>`).join('')}</Row>`)
        .join('');
    return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>` +
        `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
        `<Worksheet ss:Name="${xml(sheet).slice(0, 30)}"><Table>${body}</Table></Worksheet></Workbook>`;
}

export function downloadFile(name: string, mime: string, content: string, bom = false) {
    const blob = new Blob([bom ? '\ufeff' + content : content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
}