'use client';

import { useEffect, useState } from 'react';
import { ll } from '../_lib/api';
import { useToast } from '../_lib/toast';
import { RATING_TONE, STATUS_LABEL, STATUS_TONE } from '../_lib/types';
import type { ListFilters, Log, Meta } from '../_lib/types';
import { Icon, Pill, dmy, num } from './ui';

interface Props { meta: Meta; mine: boolean; initStatus: string; onOpen: (id: number) => void }
const EMPTY: ListFilters = { q: '', class_id: '', subject: '', status: '', rating: '', teacher_id: '', from: '', to: '', page: 1 };

export default function EntryList({ meta, mine, initStatus, onOpen }: Props) {
    const toast = useToast();
    const [f, setF] = useState<ListFilters>({ ...EMPTY, status: initStatus });
    const [qIn, setQIn] = useState('');
    const [rows, setRows] = useState<Log[]>([]);
    const [m, setM] = useState<{ current_page: number; last_page: number; total: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    useEffect(() => { const t = setTimeout(() => setF((x) => (x.q === qIn ? x : { ...x, q: qIn, page: 1 })), 350); return () => clearTimeout(t); }, [qIn]);
    useEffect(() => {
        let alive = true;
        setLoading(true);
        ll.list({ ...f, mine, per_page: 12 })
            .then((r) => { if (alive) { setRows(r.rows); setM(r.meta); setErr(''); } })
            .catch((e) => alive && setErr(e instanceof Error ? e.message : 'Không tải được danh sách.'))
            .finally(() => alive && setLoading(false));
        return () => { alive = false; };
    }, [f, mine]);

    const set = (k: keyof ListFilters, v: string) => setF((x) => ({ ...x, [k]: v, page: 1 }));

    const exportCsv = async () => {
        try {
            const r = await ll.list({ ...f, mine, all: true });
            const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
            const head = ['Ngày', 'Tiết', 'Lớp', 'Môn', 'Tiết PPCT', 'Tên bài', 'Giáo viên', 'Xếp loại', 'Sĩ số', 'Vắng có phép', 'Vắng không phép', 'Đi muộn', 'Nhận xét', 'Trạng thái'];
            const lines = r.rows.map((x) => [x.lesson_date, x.period, x.class_name, x.subject_name, x.lesson_no, x.title, x.teacher_name, x.rating ? meta.ratings[x.rating] : '', x.total_students, x.absent_excused, x.absent_unexcused, x.late_count, x.remark, STATUS_LABEL[x.status]]);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob(['\ufeff' + [head, ...lines].map((l) => l.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
            a.download = `so-dau-bai-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a); a.click(); a.remove();
            toast({ tone: 'success', title: 'Đã xuất sổ đầu bài', text: `${num(r.rows.length)} bản ghi` });
        } catch (e) { toast({ tone: 'error', title: 'Xuất thất bại', text: e instanceof Error ? e.message : '' }); }
    };

    return (
        <div className="ll-stack" style={{ opacity: loading ? 0.7 : 1 }}>
            <div className="ll-toolbar" style={{ gridTemplateColumns: mine ? '2fr repeat(5,1fr) auto' : '2fr repeat(6,1fr) auto' }}>
                <input className="ll-in" type="search" placeholder="Tìm theo tên bài, môn, giáo viên, lớp…" value={qIn} onChange={(e) => setQIn(e.target.value)} />
                <select className="ll-in" value={f.class_id} onChange={(e) => set('class_id', e.target.value)}><option value="">Mọi lớp</option>{meta.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <select className="ll-in" value={f.subject} onChange={(e) => set('subject', e.target.value)}><option value="">Mọi môn</option>{meta.subjects.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                <select className="ll-in" value={f.status} onChange={(e) => set('status', e.target.value)}><option value="">Mọi trạng thái</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <select className="ll-in" value={f.rating} onChange={(e) => set('rating', e.target.value)}><option value="">Mọi xếp loại</option>{Object.entries(meta.ratings).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                {!mine && <select className="ll-in" value={f.teacher_id} onChange={(e) => set('teacher_id', e.target.value)}><option value="">Mọi giáo viên</option>{meta.teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}
                <input className="ll-in" type="date" value={f.from} max={f.to || undefined} onChange={(e) => set('from', e.target.value)} title="Từ ngày" />
                <button className="ll-btn ghost" onClick={exportCsv}><Icon n="download" s={15} />CSV</button>
            </div>
            {err && <div className="ll-alert err"><Icon n="alert" s={18} /><span>{err}</span></div>}

            <div className="ll-tw">
                <table className="ll-table">
                    <thead><tr><th>Ngày</th><th>Tiết</th><th>Lớp</th><th>Môn / Tên bài</th><th>Giáo viên</th><th>Xếp loại</th><th>Vắng / muộn</th><th>Trạng thái</th></tr></thead>
                    <tbody>
                    {rows.map((x) => (
                        <tr key={x.id} onClick={() => onOpen(x.id)}>
                            <td>{dmy(x.lesson_date)}</td><td><b>{x.period}</b></td><td>{x.class_name}</td>
                            <td><div className="ll-t"><b>{x.subject_name}</b><small>{x.title || 'Chưa nhập tên bài'}</small></div></td>
                            <td>{x.teacher_name ?? '—'}</td>
                            <td>{x.rating ? <Pill tone={RATING_TONE[x.rating] ?? 'mut'}>{meta.ratings[x.rating]}</Pill> : <span className="ll-mu">—</span>}</td>
                            <td>{x.absent || x.late_count ? <span><b style={{ color: '#b91c1c' }}>{x.absent}</b> / <b style={{ color: '#b45309' }}>{x.late_count}</b></span> : <span className="ll-mu">0</span>}</td>
                            <td><Pill tone={STATUS_TONE[x.status] ?? 'mut'}>{STATUS_LABEL[x.status] ?? x.status}</Pill></td>
                        </tr>
                    ))}
                    {!rows.length && !loading && <tr><td colSpan={8} className="ll-empty">Không có bản ghi nào. Bấm “Ghi sổ tiết học” hoặc chọn ô trống trong “Sổ tuần” để bắt đầu.</td></tr>}
                    </tbody>
                </table>
            </div>
            {m && m.last_page > 1 && (
                <div className="ll-pager">
                    <button className="ll-btn ghost sm" disabled={f.page <= 1} onClick={() => setF((x) => ({ ...x, page: x.page - 1 }))}>‹ Trước</button>
                    <span>Trang {m.current_page} / {m.last_page} · {num(m.total)} bản ghi</span>
                    <button className="ll-btn ghost sm" disabled={f.page >= m.last_page} onClick={() => setF((x) => ({ ...x, page: x.page + 1 }))}>Sau ›</button>
                </div>
            )}
        </div>
    );
}