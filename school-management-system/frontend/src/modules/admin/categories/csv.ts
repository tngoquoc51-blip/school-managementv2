/** Đọc CSV/TSV đơn giản (hỗ trợ ngoặc kép, dấu phẩy / chấm phẩy / tab). */
export function parseDelimited(text: string): string[][] {
    const clean = text.replace(/^﻿/, '');
    const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
    const counts = { ',': 0, ';': 0, '\t': 0 } as Record<string, number>;
    let inQ = false;
    for (const ch of firstLine) {
        if (ch === '"') inQ = !inQ;
        else if (!inQ && ch in counts) counts[ch]++;
    }
    const delim = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    inQ = false;
    for (let i = 0; i < clean.length; i++) {
        const ch = clean[i];
        if (inQ) {
            if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
            else if (ch === '"') inQ = false;
            else cell += ch;
        } else if (ch === '"') inQ = true;
        else if (ch === delim) { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && clean[i + 1] === '\n') i++;
            row.push(cell); cell = '';
            if (row.some((c) => c.trim() !== '')) rows.push(row);
            row = [];
        } else cell += ch;
    }
    row.push(cell);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    return rows;
}

const HEADER_MAP: Record<string, string> = {
    ma: 'code', code: 'code',
    ten: 'name', name: 'name',
    'viet tat': 'short_name', 'ten viet tat': 'short_name', short_name: 'short_name', shortname: 'short_name',
    'gia tri': 'value', value: 'value',
    'mo ta': 'description', description: 'description',
};

const normalize = (h: string) =>
    h.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();

/** Chuyển bảng thô thành mảng đối tượng {code,name,...}. Nhận dòng tiêu đề tiếng Việt hoặc tiếng Anh. */
export function rowsToItems(table: string[][]): { rows: Record<string, string>[]; unknownHeaders: string[] } {
    if (table.length === 0) return { rows: [], unknownHeaders: [] };
    const headers = table[0].map((h) => HEADER_MAP[normalize(h)] ?? '');
    const hasHeader = headers.includes('code') || headers.includes('name');
    const cols = hasHeader ? headers : ['code', 'name', 'short_name', 'value', 'description'];
    const body = hasHeader ? table.slice(1) : table;
    const unknownHeaders = hasHeader ? table[0].filter((_, i) => !headers[i]) : [];

    const rows = body.map((cells) => {
        const o: Record<string, string> = {};
        cols.forEach((key, i) => { if (key) o[key] = (cells[i] ?? '').trim(); });
        return o;
    });
    return { rows, unknownHeaders };
}

export const TEMPLATE_CSV = '﻿Mã,Tên,Tên viết tắt,Giá trị,Mô tả\nVD01,Ví dụ mục thứ nhất,VD1,,Ghi chú tùy chọn\nVD02,Ví dụ mục thứ hai,VD2,,\n';