export function parseCsv(text: string): Record<string, string>[] {
    const src = text.replace(/^﻿/, '');
    const first = src.split(/\r?\n/, 1)[0] ?? '';
    const delim = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ',';
    const rows: string[][] = [];
    let cur: string[] = [], cell = '', q = false;
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (q) {
            if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
            else if (c === '"') q = false;
            else cell += c;
        } else if (c === '"') q = true;
        else if (c === delim) { cur.push(cell); cell = ''; }
        else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; cur.push(cell); rows.push(cur); cur = []; cell = ''; }
        else cell += c;
    }
    if (cell !== '' || cur.length) { cur.push(cell); rows.push(cur); }
    const clean = rows.filter((r) => r.some((x) => x.trim() !== ''));
    if (clean.length < 2) return [];
    const head = clean[0].map((h) => h.trim().toLowerCase());
    return clean.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

export function toCsv(rows: Record<string, unknown>[], cols: string[]): string {
    const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n');
}

export function download(name: string, content: string, mime = 'text/csv;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}