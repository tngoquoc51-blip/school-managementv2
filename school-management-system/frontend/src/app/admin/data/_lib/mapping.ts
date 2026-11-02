import type { FieldMeta } from './types';

export const unaccent = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Tự ghép cột trong file với trường của hệ thống theo tên / từ đồng nghĩa (độ tin cậy 0–1). */
export function autoMap(headers: string[], fields: FieldMeta[]): { map: Record<number, string | null>; conf: Record<number, number> } {
    const cands: { i: number; key: string; score: number }[] = [];

    headers.forEach((h, i) => {
        const nh = unaccent(h);
        if (!nh) return;
        fields.filter((f) => f.usable).forEach((f) => {
            const names = [f.key, f.label, ...f.aliases].map(unaccent).filter(Boolean);
            let best = 0;
            for (const n of names) {
                if (n === nh) best = Math.max(best, 1);
                else if (n.includes(nh) || nh.includes(n)) best = Math.max(best, (Math.min(n.length, nh.length) / Math.max(n.length, nh.length)) * 0.9);
                else {
                    const a = Array.from(new Set(n.split(' ')));
                    const b = Array.from(new Set(nh.split(' ')));
                    const inter = a.filter((x) => b.includes(x)).length;
                    const jac = inter / (a.length + b.length - inter);
                    best = Math.max(best, jac * 0.8);
                }
            }
            if (best >= 0.5) cands.push({ i, key: f.key, score: best });
        });
    });

    cands.sort((a, b) => b.score - a.score);
    const map: Record<number, string | null> = {};
    const conf: Record<number, number> = {};
    const usedCol = new Set<number>();
    const usedField = new Set<string>();
    for (const c of cands) {
        if (usedCol.has(c.i) || usedField.has(c.key)) continue;
        usedCol.add(c.i);
        usedField.add(c.key);
        map[c.i] = c.key;
        conf[c.i] = c.score;
    }
    headers.forEach((_, i) => { if (!(i in map)) map[i] = null; });
    return { map, conf };
}

/** Giá trị minh họa cho file mẫu. */
export function sampleValue(f: FieldMeta): string {
    switch (f.type) {
        case 'date': return '15/03/2010';
        case 'email': return 'ten@gmail.com';
        case 'phone': return '0912345678';
        case 'number': return '10';
        case 'checkbox': return 'Có';
        case 'select': return f.key === 'gender' ? 'Nam' : '';
        case 'lookup': return f.key === 'class_id' ? '10A1' : '';
        default: return f.key.includes('code') ? 'HS0001' : '';
    }
}