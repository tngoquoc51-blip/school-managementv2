'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent } from 'react';
import { Modal, useConfirm } from '@/modules/homeroom/awards/components/Overlay';
import { useToast } from '@/modules/homeroom/awards/components/Toast';
import { Avatar, Skel } from '@/modules/homeroom/awards/components/ui';
import { cx, downloadCsv, fmtDate } from '@/modules/homeroom/awards/utils';
import { errMsg, examApi } from '../examsService';
import type { Ctx, Sheet } from '../types';
import { StatusBadge, kindLabel, scoreColor } from './shared';
import { Histogram } from './xcharts';
import X from './xicons';

interface Row { student_id: number; code: string; full_name: string; score: string; absent: boolean; note: string; current: number | null }

const parse = (s: string): number | null => {
    const t = s.trim().replace(',', '.');
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
};

export default function ScoreSheet({ ctx, id, onClose, onChanged }: { ctx: Ctx; id: number; onClose: () => void; onChanged: () => void }) {
    const { meta } = ctx;
    const toast = useToast();
    const confirm = useConfirm();
    const [sheet, setSheet] = useState<Sheet | null>(null);
    const [rows, setRows] = useState<Row[]>([]);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [paste, setPaste] = useState<string | null>(null);
    const refs = useRef<(HTMLInputElement | null)[]>([]);

    const load = useCallback(async () => {
        try {
            const s = await examApi.sheet(id);
            setSheet(s);
            setRows(s.students.map((x) => ({ student_id: x.student_id, code: x.code, full_name: x.full_name, score: x.score === null ? '' : String(x.score), absent: x.absent, note: x.note ?? '', current: x.current })));
            setDirty(false);
        } catch (e) { toast.error('Không mở được bảng điểm', errMsg(e)); onClose(); }
    }, [id, toast, onClose]);
    useEffect(() => { load(); }, [load]);

    const t = sheet?.test;
    const locked = t?.status === 'done';
    const max = t?.max_score ?? 10;

    const stats = useMemo(() => {
        const vals = rows.filter((r) => !r.absent).map((r) => parse(r.score)).filter((v): v is number => v !== null && !Number.isNaN(v));
        const v10 = vals.map((v) => (v / max) * 10);
        const bins = Array(10).fill(0);
        v10.forEach((v) => { bins[Math.min(9, Math.floor(v))]++; });
        const invalid = rows.filter((r) => { const v = parse(r.score); return !r.absent && v !== null && (Number.isNaN(v) || v < 0 || v > max); }).length;
        const absent = rows.filter((r) => r.absent).length;
        return {
            entered: vals.length, absent, missing: rows.length - vals.length - absent, invalid,
            avg: v10.length ? v10.reduce((a, b) => a + b, 0) / v10.length : null,
            max: v10.length ? Math.max(...v10) : null, min: v10.length ? Math.min(...v10) : null,
            pass: v10.length ? (v10.filter((v) => v >= 5).length / v10.length) * 100 : null, bins,
        };
    }, [rows, max]);

    const update = (i: number, p: Partial<Row>) => { setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x))); setDirty(true); };
    const focus = (i: number) => { const el = refs.current[i]; if (el) { el.focus(); el.select(); } };

    const onKey = (e: RKeyboardEvent, i: number) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focus(i + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); focus(i - 1); }
    };

    const payload = () => rows.map((r) => ({ student_id: r.student_id, score: r.absent ? null : parse(r.score), absent: r.absent, note: r.note || null }));

    const save = async (silent = false): Promise<boolean> => {
        if (stats.invalid) { toast.warning('Có điểm không hợp lệ', `Điểm phải từ 0 đến ${max}. Kiểm tra các ô đỏ.`); return false; }
        setBusy(true);
        try {
            await examApi.saveScores(id, payload());
            if (!silent) toast.success('Đã lưu điểm', `${stats.entered} bài đã nhập · ${stats.absent} vắng`);
            setDirty(false); onChanged(); await load();
            return true;
        } catch (e) { toast.error('Không lưu được điểm', errMsg(e)); return false; }
        finally { setBusy(false); }
    };

    const finalize = async () => {
        if (dirty && !(await save(true))) return;
        if (stats.missing > 0) { toast.warning(`Còn ${stats.missing} học sinh chưa có điểm`, 'Nhập điểm hoặc đánh dấu vắng trước khi hoàn tất.'); return; }
        setBusy(true);
        try { await examApi.setStatus(id, 'done'); toast.success('Đã hoàn tất bài kiểm tra', 'Bạn có thể đồng bộ điểm vào sổ điểm.'); onChanged(); await load(); }
        catch (e) { toast.error('Không hoàn tất được', errMsg(e)); }
        finally { setBusy(false); }
    };

    const reopen = async () => {
        if (!(await confirm({ title: 'Mở lại bài để sửa điểm?', message: t?.synced_at ? 'Bài đã đồng bộ vào sổ điểm. Sau khi sửa bạn cần đồng bộ lại.' : 'Bài sẽ chuyển về trạng thái Đang chấm.', confirmText: 'Mở lại' }))) return;
        try { await examApi.setStatus(id, 'grading'); toast.info('Đã mở lại bài'); onChanged(); await load(); } catch (e) { toast.error('Không mở lại được', errMsg(e)); }
    };

    const diffCount = useMemo(() => rows.filter((r) => { const v = parse(r.score); return !r.absent && v !== null && !Number.isNaN(v) && r.current !== null && Math.abs(r.current - Math.round((v / max) * 100) / 10) > 0.05; }).length, [rows, max]);

    const sync = async () => {
        if (!t) return;
        const ok = await confirm({
            title: 'Đồng bộ vào sổ điểm?',
            message: `Điểm (quy về thang 10) sẽ được ghi vào cột «${meta.columns[t.grade_column]}» của ${stats.entered} học sinh lớp ${t.class_name}, môn ${t.subject_name}.${diffCount ? ` Có ${diffCount} học sinh đang có điểm khác trong sổ và sẽ bị ghi đè.` : ''} Điểm trung bình môn sẽ được tính lại nếu đủ điểm giữa kỳ và cuối kỳ.`,
            confirmText: 'Đồng bộ ngay',
        });
        if (!ok) return;
        setBusy(true);
        try { const r = await examApi.sync(id); toast.success('Đã đồng bộ vào sổ điểm', `${r.updated} cập nhật · ${r.inserted} thêm mới`); onChanged(); await load(); }
        catch (e) { toast.error('Không đồng bộ được', errMsg(e)); }
        finally { setBusy(false); }
    };

    const applyPaste = () => {
        const lines = (paste ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
        if (!lines.length) { setPaste(null); return; }
        setRows((r) => r.map((x, i) => {
            const raw = lines[i]; if (raw === undefined) return x;
            const v = raw.split(/\t|;/).pop()!.trim().toUpperCase();
            return v === 'V' || v === 'VẮNG' ? { ...x, absent: true, score: '' } : { ...x, absent: false, score: v.replace(',', '.') };
        }));
        setDirty(true); setPaste(null);
        toast.info(`Đã dán ${Math.min(lines.length, rows.length)} điểm`, 'Kiểm tra lại rồi bấm Lưu điểm.');
    };

    const close = async () => {
        if (dirty && !(await confirm({ title: 'Đóng mà chưa lưu?', message: 'Các điểm vừa nhập sẽ bị mất.', confirmText: 'Đóng, không lưu', tone: 'danger' }))) return;
        onClose();
    };

    const exportCsv = () => {
        if (!t) return;
        downloadCsv(`bang-diem-${t.subject_name}-${t.class_name}-${t.title}.csv`, [
            ['STT', 'Mã HS', 'Họ tên', `Điểm (/${t.max_score})`, 'Vắng', 'Ghi chú'],
            ...rows.map((r, i) => [i + 1, r.code, r.full_name, r.score, r.absent ? 'Vắng' : '', r.note]),
        ]);
    };

    useEffect(() => {
        const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (!locked && dirty) save(); } };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="ex-sheet" role="dialog" aria-modal="true">
            <div className="ex-sheet-top">
                <button className="emu-btn icon" onClick={close} aria-label="Đóng"><X name="back" /></button>
                {t ? (
                    <div style={{ minWidth: 0 }}>
                        <div className="emu-row"><b style={{ fontSize: 17 }}>{t.title}</b><StatusBadge meta={meta} status={t.status} />{dirty && <span className="emu-badge gold">Chưa lưu</span>}{t.synced_at && <span className="emu-badge info"><X name="sync" size={11} /> Đã vào sổ điểm</span>}</div>
                        <div className="emu-muted" style={{ fontSize: 12.5 }}>{t.subject_name} · lớp {t.class_name} · {kindLabel(meta, t.kind)} → {meta.columns[t.grade_column]} · {fmtDate(t.test_date)} · thang /{t.max_score}</div>
                    </div>
                ) : <Skel h={36} w={320} />}
                <span className="emu-spacer" />
                <button className="emu-btn" onClick={() => setPaste('')} disabled={locked}><X name="clipboard" size={15} /> Dán điểm</button>
                <button className="emu-btn" onClick={exportCsv}><X name="download" size={15} /> CSV</button>
                {locked ? <button className="emu-btn" onClick={reopen}><X name="lock" size={15} /> Mở lại bài</button>
                    : <button className="emu-btn primary" disabled={busy || !dirty} onClick={() => save()}><X name="save" size={15} /> Lưu điểm</button>}
            </div>

            <div className="ex-sheet-body">
                <div className="emu-card ex-sheet-table">
                    {!t ? <div style={{ padding: 18 }}><Skel h={300} /></div> : (
                        <table className="emu-table">
                            <thead><tr><th style={{ width: 46 }}>#</th><th>Học sinh</th><th className="c" style={{ width: 120 }}>Điểm /{max}</th><th className="c" style={{ width: 70 }}>Vắng</th><th>Ghi chú</th><th className="c" style={{ width: 90 }}>Sổ điểm</th></tr></thead>
                            <tbody>
                            {rows.map((r, i) => {
                                const v = parse(r.score);
                                const bad = !r.absent && v !== null && (Number.isNaN(v) || v < 0 || v > max);
                                const v10 = v !== null && !Number.isNaN(v) ? (v / max) * 10 : null;
                                const scaled = v10 !== null ? Math.round(v10 * 10) / 10 : null;
                                const differs = r.current !== null && scaled !== null && Math.abs(r.current - scaled) > 0.05;
                                return (
                                    <tr key={r.student_id}>
                                        <td className="emu-muted emu-num">{i + 1}</td>
                                        <td><div className="emu-row"><Avatar name={r.full_name} size="sm" /><div><b>{r.full_name}</b><div className="emu-muted" style={{ fontSize: 11.5 }}>{r.code}</div></div></div></td>
                                        <td className="c">
                                            <input ref={(el) => { refs.current[i] = el; }} className={cx('ex-score', bad && 'bad', v10 !== null && (v10 < 5 ? 'low' : v10 >= 8 ? 'high' : ''))}
                                                   inputMode="decimal" value={r.absent ? '' : r.score} disabled={locked || r.absent} placeholder={r.absent ? 'Vắng' : ''}
                                                   onChange={(e) => update(i, { score: e.target.value })} onKeyDown={(e) => onKey(e, i)} onFocus={(e) => e.target.select()} aria-label={`Điểm ${r.full_name}`} />
                                        </td>
                                        <td className="c"><input type="checkbox" className="emu-check" disabled={locked} checked={r.absent} onChange={(e) => update(i, { absent: e.target.checked, score: e.target.checked ? '' : r.score })} /></td>
                                        <td><input className="emu-input" style={{ height: 32 }} maxLength={120} disabled={locked} value={r.note} onChange={(e) => update(i, { note: e.target.value })} placeholder="Nhận xét ngắn…" /></td>
                                        <td className="c emu-num">{r.current ?? '—'}{differs && <div className="ex-diff">khác</div>}</td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="emu-col" style={{ gap: 14, alignContent: 'start' }}>
                    <div className="emu-card"><div className="emu-card-h"><h3>Thống kê trực tiếp</h3></div>
                        <div className="emu-card-b emu-col" style={{ gap: 9 }}>
                            <div className="emu-row"><span className="emu-muted">Đã nhập</span><span className="emu-spacer" /><b>{stats.entered}/{rows.length}</b></div>
                            <div className="emu-bar"><i style={{ width: `${rows.length ? ((stats.entered + stats.absent) / rows.length) * 100 : 0}%`, background: 'var(--brand)' }} /></div>
                            <div className="emu-row"><span className="emu-muted">Điểm trung bình (hệ 10)</span><span className="emu-spacer" /><b style={{ color: scoreColor(stats.avg), fontSize: 18 }}>{stats.avg !== null ? stats.avg.toFixed(2) : '—'}</b></div>
                            <div className="emu-row"><span className="emu-muted">Cao nhất / Thấp nhất</span><span className="emu-spacer" /><b>{stats.max !== null ? stats.max.toFixed(1) : '—'} / {stats.min !== null ? stats.min.toFixed(1) : '—'}</b></div>
                            <div className="emu-row"><span className="emu-muted">Tỉ lệ đạt (≥ 5)</span><span className="emu-spacer" /><b>{stats.pass !== null ? `${stats.pass.toFixed(0)}%` : '—'}</b></div>
                            <div className="emu-row"><span className="emu-muted">Vắng · Chưa nhập</span><span className="emu-spacer" /><b>{stats.absent} · {stats.missing}</b></div>
                            {stats.invalid > 0 && <span className="emu-badge bad"><X name="alert" size={12} /> {stats.invalid} ô điểm không hợp lệ</span>}
                            <Histogram bins={stats.bins} height={150} />
                        </div>
                    </div>

                    <div className="emu-card"><div className="emu-card-h"><h3>Quy trình</h3></div>
                        <div className="emu-card-b emu-col">
                            <button className="emu-btn" disabled={locked || busy || !dirty} onClick={() => save()}><X name="save" size={15} /> 1 · Lưu điểm <span className="emu-muted" style={{ marginLeft: 'auto', fontSize: 11 }}>Ctrl+S</span></button>
                            <button className="emu-btn" disabled={locked || busy || !t || stats.entered + stats.absent === 0} onClick={finalize}><X name="check" size={15} /> 2 · Hoàn tất bài</button>
                            <button className="emu-btn gold" disabled={!locked || busy} onClick={sync}><X name="sync" size={15} /> 3 · Đồng bộ vào sổ điểm</button>
                            {t && locked && <span className="emu-muted" style={{ fontSize: 12 }}>Ghi vào cột «{meta.columns[t.grade_column]}», quy về thang 10{diffCount ? ` · ${diffCount} học sinh sẽ bị ghi đè` : ''}.</span>}
                            {t && !locked && <span className="emu-muted" style={{ fontSize: 12 }}>Enter hoặc ↓ để sang học sinh kế tiếp. Có thể dán một cột điểm từ Excel.</span>}
                            {t && locked && <button className="emu-btn ghost sm" onClick={() => ctx.analyzeTest(t)}><X name="chart" size={14} /> Xem phân tích chi tiết</button>}
                        </div>
                    </div>
                </div>
            </div>

            <Modal open={paste !== null} onClose={() => setPaste(null)} title="Dán điểm từ Excel" subtitle={`Mỗi dòng một học sinh theo đúng thứ tự trong bảng (${rows.length} học sinh). Gõ V cho học sinh vắng.`}
                   footer={<><button className="emu-btn" onClick={() => setPaste(null)}>Hủy</button><button className="emu-btn primary" onClick={applyPaste}>Áp dụng</button></>}>
                <textarea className="emu-textarea" style={{ minHeight: 220, fontFamily: 'monospace' }} value={paste ?? ''} onChange={(e) => setPaste(e.target.value)} placeholder={'8.5\n7\nV\n9.25'} autoFocus />
            </Modal>
        </div>
    );
}