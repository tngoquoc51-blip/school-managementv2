'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConfirm } from '@/modules/homeroom/awards/components/Overlay';
import { useToast } from '@/modules/homeroom/awards/components/Toast';
import { Empty, Skel } from '@/modules/homeroom/awards/components/ui';
import { cx, downloadCsv, fmtDate, useDebounced } from '@/modules/homeroom/awards/utils';
import { errMsg, examApi } from '../examsService';
import type { Ctx, TestRow } from '../types';
import { StatusBadge, kindLabel, scoreColor } from './shared';
import X from './xicons';

export default function TestsView({ ctx }: { ctx: Ctx }) {
    const { meta, semester, tick, refresh, openSheet, newTest, editTest, analyzeTest } = ctx;
    const toast = useToast();
    const confirm = useConfirm();
    const [rows, setRows] = useState<TestRow[] | null>(null);
    const [asg, setAsg] = useState('');
    const [status, setStatus] = useState('');
    const [q, setQ] = useState('');
    const dq = useDebounced(q, 300);

    const load = useCallback(async () => {
        const [c, s] = asg ? asg.split(':').map(Number) : [0, 0];
        try { setRows(await examApi.tests({ semester: semester || undefined, class_id: c || undefined, subject_id: s || undefined, status: status || undefined, q: dq || undefined })); }
        catch (e) { toast.error('Không tải được danh sách', errMsg(e)); }
    }, [semester, asg, status, dq, toast]);
    useEffect(() => { load(); }, [load, tick]);

    const stats = useMemo(() => {
        const r = rows ?? [];
        return { total: r.length, avg: r.filter((x) => x.avg !== null).length ? r.reduce((a, x) => a + (x.avg ?? 0), 0) / r.filter((x) => x.avg !== null).length : null };
    }, [rows]);

    const del = async (t: TestRow) => {
        if (!(await confirm({ title: `Xóa «${t.title}»?`, message: `Toàn bộ điểm đã nhập của lớp ${t.class_name} cho bài này sẽ bị xóa.`, confirmText: 'Xóa bài', tone: 'danger' }))) return;
        try { await examApi.deleteTest(t.id); toast.success('Đã xóa bài kiểm tra'); refresh(); } catch (e) { toast.error('Không xóa được', errMsg(e)); }
    };

    const exportCsv = () => {
        if (!rows) return;
        downloadCsv('danh-sach-bai-kiem-tra.csv', [
            ['Tên bài', 'Lớp', 'Môn', 'Loại', 'Ngày', 'Thang điểm', 'Đã nhập', 'Vắng', 'Sĩ số', 'ĐTB (hệ 10)', 'Trạng thái'],
            ...rows.map((t) => [t.title, t.class_name, t.subject_name, kindLabel(meta, t.kind), fmtDate(t.test_date), t.max_score, t.scored, t.absent, t.student_count, t.avg, meta.statuses[t.status]]),
        ]);
        toast.success('Đã xuất file CSV');
    };

    return (
        <div className="emu-page">
            <div className="emu-card">
                <div className="emu-card-h" style={{ flexWrap: 'wrap' }}>
                    <h3>Bài kiểm tra</h3><span className="emu-sub">{stats.total} bài{stats.avg !== null ? ` · ĐTB chung ${stats.avg.toFixed(2)}` : ''}</span><span className="emu-spacer" />
                    <div className="emu-search" style={{ width: 200 }}><X name="search" size={15} /><input className="emu-input" style={{ height: 32 }} placeholder="Tìm tên bài…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
                    <select className="emu-select" style={{ width: 200, height: 32 }} value={asg} onChange={(e) => setAsg(e.target.value)}>
                        <option value="">Mọi lớp – môn</option>{meta.assignments.map((a) => <option key={a.cs_id} value={`${a.class_id}:${a.subject_id}`}>Lớp {a.class_name} — {a.subject_name}</option>)}
                    </select>
                    <select className="emu-select" style={{ width: 150, height: 32 }} value={status} onChange={(e) => setStatus(e.target.value)}>
                        <option value="">Mọi trạng thái</option>{Object.entries(meta.statuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <button className="emu-btn sm" onClick={exportCsv}><X name="download" size={14} /> CSV</button>
                    <button className="emu-btn primary sm" onClick={() => newTest()}><X name="plus" size={14} /> Tạo bài</button>
                </div>
                <div className="emu-tw" style={{ marginTop: 12 }}>
                    {!rows ? <div style={{ padding: 18 }}><Skel h={200} /></div> : (
                        <table className="emu-table">
                            <thead><tr><th>Bài kiểm tra</th><th>Lớp – Môn</th><th>Ngày</th><th>Tiến độ nhập điểm</th><th className="c">ĐTB</th><th>Trạng thái</th><th /></tr></thead>
                            <tbody>
                            {rows.map((t) => {
                                const done = t.scored + t.absent;
                                const pct = t.student_count ? (done / t.student_count) * 100 : 0;
                                return (
                                    <tr key={t.id}>
                                        <td><b>{t.title}</b><div className="emu-muted" style={{ fontSize: 11.5 }}>{kindLabel(meta, t.kind)} → cột {meta.columns[t.grade_column]} · /{t.max_score}</div></td>
                                        <td>Lớp {t.class_name}<div className="emu-muted" style={{ fontSize: 11.5 }}>{t.subject_name}</div></td>
                                        <td className="emu-num">{fmtDate(t.test_date)}<div className="emu-muted" style={{ fontSize: 11.5 }}>{t.start_time ?? ''}</div></td>
                                        <td style={{ minWidth: 150 }}><div className="emu-bar"><i style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--ok)' : 'var(--gold)' }} /></div><div className="emu-muted" style={{ fontSize: 11.5, marginTop: 3 }}>{done}/{t.student_count} học sinh{t.absent ? ` · ${t.absent} vắng` : ''}</div></td>
                                        <td className="c"><b className="emu-num" style={{ color: scoreColor(t.avg) }}>{t.avg ?? '—'}</b></td>
                                        <td><StatusBadge meta={meta} status={t.status} />{t.synced_at && <span className="emu-badge info" style={{ marginLeft: 6 }} title="Đã ghi vào sổ điểm"><X name="sync" size={11} /> Sổ điểm</span>}</td>
                                        <td className="r" style={{ whiteSpace: 'nowrap' }}>
                                            <button className={cx('emu-btn sm', t.status !== 'done' && 'primary')} onClick={() => openSheet(t.id)}><X name="edit" size={13} /> {t.status === 'done' ? 'Xem điểm' : 'Nhập điểm'}</button>{' '}
                                            {t.scored > 0 && <button className="emu-btn ghost sm icon" title="Phân tích" onClick={() => analyzeTest(t)}><X name="chart" size={14} /></button>}
                                            {t.status !== 'done' && <button className="emu-btn ghost sm icon" title="Sửa" onClick={() => editTest(t)}><X name="sliders" size={14} /></button>}
                                            {t.status !== 'done' && !t.synced_at && <button className="emu-btn ghost sm icon" title="Xóa" onClick={() => del(t)}><X name="trash" size={14} /></button>}
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    )}
                    {rows && rows.length === 0 && <Empty icon="clipboard" title="Chưa có bài kiểm tra nào" text="Tạo bài kiểm tra 15 phút, 1 tiết, giữa kỳ hoặc cuối kỳ cho các lớp bạn dạy." action={<button className="emu-btn primary" onClick={() => newTest()}><X name="plus" /> Tạo bài đầu tiên</button>} />}
                </div>
            </div>
        </div>
    );
}