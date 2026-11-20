'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { downloadCsv, errMsg, get } from '@/modules/accountant/finance/api';
import { fdate, initials, num, vnd, vndShort } from '@/modules/accountant/finance/format';
import { useSession } from '@/modules/accountant/finance/session';
import { BASE, notifyChanged } from '@/modules/accountant/finance/Shell';
import { useToast } from '@/modules/accountant/finance/Toast';
import type { ListResp } from '@/modules/accountant/finance/types';
import { Bar, Empty, FinChip, Icon, Skeleton } from '@/modules/accountant/finance/ui';

const STATUS_CHIPS: { v: string; label: string; key?: 'students' | 'overdue_students' | 'debt_students' | 'paid_students' | 'none_students' }[] = [
    { v: '', label: 'Tất cả', key: 'students' }, { v: 'overdue', label: 'Quá hạn', key: 'overdue_students' },
    { v: 'debt', label: 'Còn nợ', key: 'debt_students' }, { v: 'paid', label: 'Đã đủ', key: 'paid_students' },
    { v: 'none', label: 'Chưa có hóa đơn', key: 'none_students' },
];

export default function StudentsFinancePage() {
    const { meta } = useSession();
    const toast = useToast();
    const router = useRouter();
    const path = usePathname();
    const sp = useSearchParams();

    const q = sp.get('q') || '';
    const status = sp.get('status') || '';
    const grade = sp.get('grade') || '';
    const classId = sp.get('class_id') || '';
    const yearId = sp.get('year_id') || String(meta.current_year_id);
    const sort = sp.get('sort') || 'name';
    const dir = sp.get('dir') || 'asc';
    const page = Number(sp.get('page') || 1);
    const perPage = Number(sp.get('per_page') || 20);

    const [data, setData] = useState<ListResp | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [text, setText] = useState(q);
    const [exporting, setExporting] = useState(false);

    const setParams = useCallback((patch: Record<string, string | number | null>, resetPage = true) => {
        const n = new URLSearchParams(sp.toString());
        Object.entries(patch).forEach(([k, v]) => (v === null || v === '' ? n.delete(k) : n.set(k, String(v))));
        if (resetPage) n.delete('page');
        router.replace(`${path}${n.toString() ? '?' + n.toString() : ''}`);
    }, [sp, router, path]);

    // gõ tìm kiếm: chờ 350ms mới gọi API
    const first = useRef(true);
    useEffect(() => {
        if (first.current) { first.current = false; return; }
        const t = setTimeout(() => setParams({ q: text.trim() || null }), 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text]);
    useEffect(() => setText(q), [q]);

    const params = useMemo(() => ({ year_id: yearId, grade, class_id: classId, q, status, sort, dir, page, per_page: perPage }), [yearId, grade, classId, q, status, sort, dir, page, perPage]);

    const load = useCallback(() => {
        setLoading(true); setError('');
        get<ListResp>('/students', params).then(setData).catch((e) => setError(errMsg(e))).finally(() => setLoading(false));
    }, [params]);
    useEffect(load, [load]);

    const classes = meta.classes.filter((c) => String(c.school_year_id) === yearId && (!grade || String(c.grade) === grade));
    const k = data?.kpi;
    const m = data?.meta;
    const yearLabel = meta.years.find((y) => String(y.id) === yearId)?.label;

    const doExport = async () => {
        setExporting(true);
        try { await downloadCsv({ year_id: yearId, grade, class_id: classId, q, status, sort: 'class' }, 'ho-so-tai-chinh.csv'); toast.success('Đã xuất file', 'Mở bằng Excel để xem danh sách.'); }
        catch (e) { toast.error('Không xuất được file', errMsg(e)); } finally { setExporting(false); }
    };
    const sortBy = (key: string) => setParams({ sort: key, dir: sort === key && dir === 'asc' ? 'desc' : 'asc' });
    const arrow = (key: string) => (sort === key ? (dir === 'asc' ? ' ▲' : ' ▼') : '');

    const dist = k && k.students > 0 ? [
        { v: k.paid_students, c: '#10b981', l: 'Đã đủ' }, { v: k.debt_students, c: '#f59e0b', l: 'Còn nợ' },
        { v: k.overdue_students, c: '#f43f5e', l: 'Quá hạn' }, { v: k.none_students, c: '#9aa4c0', l: 'Chưa có hóa đơn' },
    ] : [];

    return (
        <>
            <div className="fx-between">
                <div>
                    <h1 className="fx-h1">Hồ sơ tài chính học sinh</h1>
                    <p className="fx-sub">Năm học {yearLabel} · theo dõi công nợ, thu tiền, miễn giảm và nhắc nợ từng học sinh</p>
                </div>
                <div className="fx-row">
                    <button className="fx-btn" onClick={() => { load(); notifyChanged(); }}><Icon name="refresh" /> Làm mới</button>
                    <button className="fx-btn pri" onClick={doExport} disabled={exporting}><Icon name="download" /> Xuất Excel</button>
                </div>
            </div>

            {/* KPI */}
            <div className="fx-kpis">
                {[
                    { l: 'Tổng phải thu', v: k ? vnd(k.total) : '', s: k ? `${num(k.students)} học sinh` : '', i: 'trend', c: '#4f46e5', t: 'rgba(79,70,229,.12)' },
                    { l: 'Đã thu', v: k ? vnd(k.paid) : '', s: k ? `Tỷ lệ thu ${k.rate}%` : '', i: 'check', c: '#059669', t: 'rgba(5,150,105,.14)' },
                    { l: 'Còn nợ', v: k ? vnd(k.debt) : '', s: k ? `${num(k.debt_students + k.overdue_students)} học sinh còn nợ` : '', i: 'wallet', c: '#d97706', t: 'rgba(217,119,6,.14)' },
                    { l: 'Nợ quá hạn', v: k ? vnd(k.overdue) : '', s: k ? `${num(k.overdue_students)} học sinh quá hạn` : '', i: 'alert', c: '#e11d48', t: 'rgba(225,29,72,.13)' },
                    { l: 'Chờ xác nhận / Miễn giảm', v: k ? `${k.pending_payments} / ${k.waiver_students}` : '', s: 'phiếu thu chờ · học sinh được miễn giảm', i: 'gift', c: '#0ea5a4', t: 'rgba(14,165,164,.14)' },
                ].map((x) => (
                    <div key={x.l} className="fx-card fx-kpi lift" style={{ ['--tint' as string]: x.t, ['--c' as string]: x.c }}>
                        <small><span className="ic"><Icon name={x.i} size={16} /></span>{x.l}</small>
                        {k ? <div className="v">{x.v}</div> : <Skeleton h={30} w="70%" style={{ margin: '10px 0' }} />}
                        <div className="s">{x.s}</div>
                    </div>
                ))}
            </div>

            {k && k.students > 0 && (
                <div className="fx-card fx-pad">
                    <div className="fx-between"><span className="fx-h2">Phân bố tình trạng đóng tiền</span><span className="fx-muted fx-small">Đã thu {vndShort(k.paid)} / {vndShort(k.total)}</span></div>
                    <div className="fx-stack" style={{ marginTop: 12 }}>{dist.map((d) => <i key={d.l} style={{ width: `${(d.v / k.students) * 100}%`, background: d.c }} title={`${d.l}: ${d.v}`} />)}</div>
                    <div className="fx-legend">{dist.map((d) => <span key={d.l} style={{ ['--c' as string]: d.c }}>{d.l}: <b style={{ color: 'var(--text)' }}>{d.v}</b></span>)}</div>
                </div>
            )}

            {/* Bộ lọc */}
            <div className="fx-card fx-pad fx-col">
                <div className="fx-row">
                    <div className="fx-search"><Icon name="search" /><input className="fx-in" placeholder="Tìm theo họ tên hoặc mã học sinh…" value={text} onChange={(e) => setText(e.target.value)} /></div>
                    <select className="fx-sel" style={{ width: 170 }} value={yearId} onChange={(e) => setParams({ year_id: e.target.value, class_id: null })}>
                        {meta.years.map((y) => <option key={y.id} value={y.id}>Năm học {y.label}</option>)}
                    </select>
                    <select className="fx-sel" style={{ width: 130 }} value={grade} onChange={(e) => setParams({ grade: e.target.value, class_id: null })}>
                        <option value="">Mọi khối</option><option value="10">Khối 10</option><option value="11">Khối 11</option><option value="12">Khối 12</option>
                    </select>
                    <select className="fx-sel" style={{ width: 130 }} value={classId} onChange={(e) => setParams({ class_id: e.target.value })}>
                        <option value="">Mọi lớp</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="fx-seg">
                    {STATUS_CHIPS.map((s) => (
                        <button key={s.v} className={`fx-pill ${status === s.v ? 'on' : ''}`} onClick={() => setParams({ status: s.v })}>
                            {s.label}{k && s.key && <b>{k[s.key]}</b>}
                        </button>
                    ))}
                    {['pending', 'promise', 'waiver'].includes(status) && (
                        <button className="fx-pill on" onClick={() => setParams({ status: null })}>
                            {({ pending: 'Chờ xác nhận thu', promise: 'Có lịch hẹn trả', waiver: 'Được miễn giảm' } as Record<string, string>)[status]} ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Bảng */}
            <div className="fx-card" style={{ overflow: 'hidden' }}>
                {error ? (
                    <Empty icon="alert" title="Không tải được dữ liệu" text={error} action={<button className="fx-btn pri" onClick={load}>Thử lại</button>} />
                ) : (
                    <div className="fx-tw">
                        <table className="fx-table">
                            <thead><tr>
                                <th className="s" onClick={() => sortBy('name')}>Học sinh{arrow('name')}</th>
                                <th className="s" onClick={() => sortBy('class')}>Lớp{arrow('class')}</th>
                                <th className="s fx-r" onClick={() => sortBy('total')}>Phải thu{arrow('total')}</th>
                                <th className="s" onClick={() => sortBy('paid')}>Đã thu{arrow('paid')}</th>
                                <th className="s fx-r" onClick={() => sortBy('debt')}>Còn nợ{arrow('debt')}</th>
                                <th className="s" onClick={() => sortBy('days')}>Tình trạng{arrow('days')}</th>
                                <th>Ghi chú</th><th />
                            </tr></thead>
                            <tbody>
                            {loading && !data && Array.from({ length: 8 }).map((_, i) => <tr key={i}><td colSpan={8}><Skeleton h={34} /></td></tr>)}
                            {data?.items.map((s) => (
                                <tr key={s.id} className="click" style={{ opacity: loading ? 0.55 : 1 }} onClick={() => router.push(`${BASE}/${s.id}?year_id=${yearId}`)}>
                                    <td><div className="fx-who"><div className="fx-ava">{initials(s.full_name)}</div><div><b>{s.full_name}</b><small>{s.code}</small></div></div></td>
                                    <td><b>{s.class_name}</b></td>
                                    <td className="fx-r fx-num">{vnd(s.total)}</td>
                                    <td style={{ minWidth: 150 }}><div className="fx-num fx-small" style={{ marginBottom: 4 }}>{vnd(s.paid)} <span className="fx-muted">({s.rate}%)</span></div><Bar pct={s.rate} /></td>
                                    <td className="fx-r fx-num fx-strong" style={{ color: s.debt > 0 ? (s.overdue > 0 ? 'var(--bad)' : 'var(--warn)') : 'var(--ok)' }}>{vnd(s.debt)}</td>
                                    <td><FinChip s={s.fin_status} days={s.max_overdue_days} />{s.next_due && s.debt > 0 && s.overdue === 0 && <div className="fx-muted fx-small">Hạn {fdate(s.next_due)}</div>}</td>
                                    <td>
                                        <div className="fx-row" style={{ gap: 6 }}>
                                            {s.waiver_count > 0 && <span className="fx-tag g">Miễn giảm {s.waiver_percent}%</span>}
                                            {s.pending_count > 0 && <span className="fx-tag w">{s.pending_count} chờ xác nhận</span>}
                                            {s.open_promises > 0 && <span className="fx-tag">Hẹn trả</span>}
                                        </div>
                                    </td>
                                    <td className="fx-r" onClick={(e) => e.stopPropagation()}>
                                        <div className="fx-row" style={{ justifyContent: 'flex-end', gap: 6, flexWrap: 'nowrap' }}>
                                            {s.debt > 0 && <button className="fx-btn sm ok" onClick={() => router.push(`${BASE}/${s.id}?year_id=${yearId}&tab=invoices&action=collect`)}>Thu tiền</button>}
                                            <button className="fx-btn sm" onClick={() => router.push(`${BASE}/${s.id}?year_id=${yearId}`)}>Hồ sơ <Icon name="arrow" size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                        {data && data.items.length === 0 && <Empty icon="users" title="Không có học sinh phù hợp" text="Thử đổi bộ lọc hoặc từ khóa tìm kiếm." action={<button className="fx-btn" onClick={() => router.replace(BASE)}>Xóa bộ lọc</button>} />}
                    </div>
                )}
                {m && m.total > 0 && (
                    <div className="fx-pager">
                        <span>Hiển thị {(m.page - 1) * m.per_page + 1}–{Math.min(m.page * m.per_page, m.total)} / {num(m.total)} học sinh</span>
                        <div className="fx-row">
                            <select className="fx-sel" style={{ width: 120, height: 34 }} value={perPage} onChange={(e) => setParams({ per_page: e.target.value })}>
                                {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} / trang</option>)}
                            </select>
                            <div className="fx-pages">
                                <button disabled={m.page <= 1} onClick={() => setParams({ page: m.page - 1 }, false)}>‹</button>
                                {pageList(m.page, m.last_page).map((p, i) => p === 0 ? <span key={i} style={{ padding: '6px' }}>…</span> :
                                    <button key={p} className={p === m.page ? 'on' : ''} onClick={() => setParams({ page: p }, false)}>{p}</button>)}
                                <button disabled={m.page >= m.last_page} onClick={() => setParams({ page: m.page + 1 }, false)}>›</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

function pageList(cur: number, last: number): number[] {
    if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
    const s = new Set([1, 2, cur - 1, cur, cur + 1, last - 1, last].filter((n) => n >= 1 && n <= last));
    const a = [...s].sort((x, y) => x - y); const out: number[] = [];
    a.forEach((n, i) => { if (i && n - a[i - 1] > 1) out.push(0); out.push(n); });
    return out;
}