'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { emuApi, errMsg } from '../awardsService';
import type { Criterion, Ctx, RecordPage } from '../types';
import { clampDate, cx, fmtDate, removeAccents, signed, useDebounced } from '../utils';
import Icon from './icons';
import { useConfirm } from './Overlay';
import { useToast } from './Toast';
import { Avatar, CatIcon, Empty, Field, Points } from './ui';

export interface ScoringPreset { studentIds?: number[]; criterionId?: number; nonce: number }

export default function ScoringTab({ ctx, preset }: { ctx: Ctx; preset: ScoringPreset | null }) {
    const { meta, scope, students, refresh, tick, openStudent } = ctx;
    const toast = useToast();
    const confirm = useConfirm();

    const active = useMemo(() => meta.criteria.filter((c) => c.is_active), [meta.criteria]);
    const [kind, setKind] = useState<'plus' | 'minus'>('plus');
    const [crit, setCrit] = useState<Criterion | null>(null);
    const [points, setPoints] = useState(0);
    const [picked, setPicked] = useState<number[]>([]);
    const [q, setQ] = useState('');
    const [date, setDate] = useState(() => clampDate(meta.school_year.start_date, meta.school_year.end_date));
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    /* Bộ lọc nhật ký ghi nhận */
    const [fKind, setFKind] = useState('');
    const [fCrit, setFCrit] = useState('');
    const [fQ, setFQ] = useState('');
    const [fStatus, setFStatus] = useState<'active' | 'voided'>('active');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<RecordPage | null>(null);
    const [loadingRec, setLoadingRec] = useState(false);
    const dq = useDebounced(fQ, 350);

    useEffect(() => {
        if (!preset) return;
        if (preset.studentIds) setPicked(preset.studentIds);
        const c = active.find((x) => x.id === preset.criterionId);
        if (c) { setKind(c.points > 0 ? 'plus' : 'minus'); setCrit(c); setPoints(c.points); }
    }, [preset, active]);

    const list = useMemo(() => {
        const k = removeAccents(q.trim());
        return students.filter((s) => !k || removeAccents(s.full_name).includes(k) || s.code.toLowerCase().includes(k));
    }, [students, q]);

    const groups = useMemo(() => {
        const g: Record<string, Criterion[]> = {};
        active.filter((c) => (kind === 'plus' ? c.points > 0 : c.points < 0)).forEach((c) => (g[c.category] ||= []).push(c));
        return g;
    }, [active, kind]);

    const loadRecords = useCallback(async () => {
        setLoadingRec(true);
        try {
            setData(await emuApi.records(scope, { page, per_page: 12, kind: fKind, criterion_id: fCrit, q: dq, status: fStatus }));
        } catch (e) { toast.error('Không tải được nhật ký', errMsg(e)); }
        finally { setLoadingRec(false); }
    }, [scope, page, fKind, fCrit, dq, fStatus, toast]);

    useEffect(() => { loadRecords(); }, [loadRecords, tick]);
    useEffect(() => { setPage(1); }, [fKind, fCrit, dq, fStatus, scope.semester]);

    const chooseCrit = (c: Criterion) => { setCrit(c); setPoints(c.points); };
    const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    const allShown = list.length > 0 && list.every((s) => picked.includes(s.id));
    const toggleAll = () => setPicked((p) => (allShown ? p.filter((id) => !list.some((s) => s.id === id)) : Array.from(new Set([...p, ...list.map((s) => s.id)]))));

    const submit = async () => {
        if (!crit || !picked.length) return;
        if (crit.points < 0 && !note.trim()) { toast.warning('Cần ghi lý do', 'Điểm trừ bắt buộc nhập lý do để minh bạch với phụ huynh.'); return; }
        if (crit.points < 0 && picked.length > 5 && !(await confirm({
            title: `Trừ điểm ${picked.length} học sinh?`, message: `Bạn sắp trừ ${Math.abs(points)} điểm "${crit.name}" cho ${picked.length} học sinh cùng lúc.`, confirmText: 'Xác nhận trừ điểm', tone: 'danger',
        }))) return;
        setSaving(true);
        try {
            const r = await emuApi.addRecords(scope, { student_ids: picked, criterion_id: crit.id, points, record_date: date, note: note.trim() });
            toast.success(`Đã ghi nhận ${signed(r.points)} điểm`, `${crit.name} · ${r.created} học sinh`);
            setPicked([]); setNote('');
            refresh();
        } catch (e) { toast.error('Không ghi nhận được', errMsg(e)); }
        finally { setSaving(false); }
    };

    const voidIt = async (id: number) => {
        try {
            await emuApi.voidRecord(scope, id);
            toast.show({ kind: 'info', title: 'Đã thu hồi bản ghi', message: 'Điểm đã được hoàn lại cho học sinh.', action: { label: 'Hoàn tác', onClick: async () => { try { await emuApi.restoreRecord(scope, id); refresh(); } catch (e) { toast.error('Không khôi phục được', errMsg(e)); } } } });
            refresh();
        } catch (e) { toast.error('Không thu hồi được', errMsg(e)); }
    };
    const restore = async (id: number) => {
        try { await emuApi.restoreRecord(scope, id); toast.success('Đã khôi phục bản ghi'); refresh(); } catch (e) { toast.error('Không khôi phục được', errMsg(e)); }
    };

    const pages = data ? Math.max(1, Math.ceil(data.total / data.per_page)) : 1;

    return (
        <div className="emu-page">
            <div className="emu-split">
                <div className="emu-card">
                    <div className="emu-card-h"><h3>1 · Chọn học sinh</h3><span className="emu-spacer" /><span className="emu-badge brand">{picked.length} đã chọn</span></div>
                    <div className="emu-card-b emu-col">
                        <div className="emu-search"><Icon name="search" size={16} /><input className="emu-input" placeholder="Tìm theo tên hoặc mã…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
                        <label className="emu-row" style={{ cursor: 'pointer', fontWeight: 600, fontSize: 12.5 }}>
                            <input type="checkbox" className="emu-check" checked={allShown} onChange={toggleAll} /> Chọn tất cả ({list.length})
                            {picked.length > 0 && <button className="emu-btn ghost sm" style={{ marginLeft: 'auto' }} onClick={(e) => { e.preventDefault(); setPicked([]); }}>Bỏ chọn</button>}
                        </label>
                        <div className="emu-slist">
                            {list.map((s) => (
                                <div key={s.id} className={cx('emu-srow', picked.includes(s.id) && 'on')} onClick={() => toggle(s.id)}>
                                    <input type="checkbox" className="emu-check" checked={picked.includes(s.id)} readOnly />
                                    <Avatar name={s.full_name} size="sm" />
                                    <div style={{ flex: 1, minWidth: 0 }}><div className="emu-clip emu-strong">{s.full_name}</div><div className="emu-muted" style={{ fontSize: 11.5 }}>{s.code}</div></div>
                                    <span className="emu-badge emu-num">{s.score}</span>
                                </div>
                            ))}
                            {list.length === 0 && <Empty icon="search" title="Không tìm thấy học sinh" />}
                        </div>
                    </div>
                </div>

                <div className="emu-card">
                    <div className="emu-card-h"><h3>2 · Chọn tiêu chí & ghi nhận</h3>
                        <span className="emu-spacer" />
                        <div className="emu-seg">
                            <button className={cx(kind === 'plus' && 'on')} onClick={() => { setKind('plus'); setCrit(null); }}>＋ Điểm cộng</button>
                            <button className={cx(kind === 'minus' && 'on')} onClick={() => { setKind('minus'); setCrit(null); }}>－ Điểm trừ</button>
                        </div>
                    </div>
                    <div className="emu-card-b emu-col" style={{ gap: 16 }}>
                        {Object.entries(groups).map(([cat, items]) => (
                            <div key={cat}>
                                <div className="emu-row" style={{ marginBottom: 8 }}><CatIcon cat={cat} size={24} /><b style={{ fontSize: 12.5 }}>{meta.categories[cat] ?? cat}</b></div>
                                <div className="emu-chips">
                                    {items.map((c) => (
                                        <button key={c.id} className={cx('emu-chip', kind, crit?.id === c.id && 'on')} onClick={() => chooseCrit(c)}>
                                            {c.name} <em>{signed(c.points)}</em>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {Object.keys(groups).length === 0 && <Empty icon="list" title="Chưa có tiêu chí" text="Quản trị cần thêm tiêu chí ở tab Tiêu chí & quy tắc." />}

                        {crit && (
                            <div className="emu-grid emu-g3" style={{ alignItems: 'end', borderTop: '1px dashed var(--line-2)', paddingTop: 16 }}>
                                <Field label="Số điểm">
                                    <div className="emu-stepper">
                                        <button onClick={() => setPoints((p) => (crit.points > 0 ? Math.max(1, p - 1) : Math.min(-1, p + 1)))}><Icon name="minus" size={14} /></button>
                                        <b className={points > 0 ? 'emu-pos' : 'emu-neg'}>{signed(points)}</b>
                                        <button onClick={() => setPoints((p) => (crit.points > 0 ? Math.min(50, p + 1) : Math.max(-50, p - 1)))}><Icon name="plus" size={14} /></button>
                                    </div>
                                </Field>
                                <Field label="Ngày ghi nhận" hint={`Trong năm học ${meta.school_year.label}`}>
                                    <input type="date" className="emu-input" value={date} min={meta.school_year.start_date} max={meta.school_year.end_date} onChange={(e) => setDate(e.target.value)} />
                                </Field>
                                <div className="emu-muted" style={{ fontSize: 12.5 }}>Tiêu chí: <b style={{ color: 'var(--ink)' }}>{crit.name}</b></div>
                            </div>
                        )}
                        {crit && (
                            <Field label={crit.points < 0 ? 'Lý do (bắt buộc)' : 'Ghi chú (không bắt buộc)'}>
                                <textarea className="emu-textarea" value={note} maxLength={255} placeholder={crit.points < 0 ? 'Mô tả ngắn sự việc…' : 'Ví dụ: Phát biểu hay môn Văn…'} onChange={(e) => setNote(e.target.value)} />
                            </Field>
                        )}
                    </div>
                    <div className="emu-sticky-bar">
                        <span className="emu-muted" style={{ fontSize: 12.5 }}>
                            {crit && picked.length ? <>Sẽ ghi <b className={points > 0 ? 'emu-pos' : 'emu-neg'}>{signed(points)}</b> điểm cho <b>{picked.length}</b> học sinh</> : 'Chọn học sinh và tiêu chí để ghi nhận'}
                        </span>
                        <span className="emu-spacer" />
                        <button className={cx('emu-btn', kind === 'plus' ? 'primary' : 'danger solid')} disabled={!crit || !picked.length || saving} onClick={submit}>
                            <Icon name="check" size={16} /> {saving ? 'Đang lưu…' : 'Ghi nhận'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="emu-card">
                <div className="emu-card-h" style={{ flexWrap: 'wrap' }}>
                    <h3>Nhật ký chấm điểm</h3><span className="emu-sub">{data?.total ?? 0} bản ghi</span><span className="emu-spacer" />
                    <div className="emu-search" style={{ width: 210 }}><Icon name="search" size={15} /><input className="emu-input" style={{ height: 32 }} placeholder="Tên, mã, ghi chú…" value={fQ} onChange={(e) => setFQ(e.target.value)} /></div>
                    <select className="emu-select" style={{ width: 130, height: 32 }} value={fKind} onChange={(e) => setFKind(e.target.value)}><option value="">Cộng & trừ</option><option value="plus">Chỉ cộng</option><option value="minus">Chỉ trừ</option></select>
                    <select className="emu-select" style={{ width: 200, height: 32 }} value={fCrit} onChange={(e) => setFCrit(e.target.value)}><option value="">Mọi tiêu chí</option>{meta.criteria.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <div className="emu-seg"><button className={cx(fStatus === 'active' && 'on')} onClick={() => setFStatus('active')}>Hiệu lực</button><button className={cx(fStatus === 'voided' && 'on')} onClick={() => setFStatus('voided')}>Đã thu hồi</button></div>
                </div>
                <div className="emu-tw" style={{ marginTop: 12, opacity: loadingRec ? .55 : 1, transition: '.15s' }}>
                    <table className="emu-table">
                        <thead><tr><th>Học sinh</th><th>Tiêu chí</th><th className="c">Điểm</th><th>Ngày</th><th>Ghi chú</th><th>Người ghi</th><th /></tr></thead>
                        <tbody>
                        {data?.items.map((r) => (
                            <tr key={r.id} className={cx(r.voided_at && 'void')}>
                                <td><button className="emu-btn ghost sm" style={{ padding: 0, height: 'auto' }} onClick={() => openStudent(r.student_id)}><b>{r.student_name}</b></button><div className="emu-muted" style={{ fontSize: 11.5 }}>{r.student_code}</div></td>
                                <td><div className="emu-row"><CatIcon cat={r.category} size={26} />{r.criterion_name}</div></td>
                                <td className="c"><Points value={r.points} /></td>
                                <td className="emu-num">{fmtDate(r.record_date)}</td>
                                <td className="emu-muted" style={{ maxWidth: 220 }}><div className="emu-clip">{r.note ?? '—'}</div></td>
                                <td className="emu-muted">{r.created_by_name ?? '—'}</td>
                                <td className="r">{fStatus === 'active'
                                    ? <button className="emu-btn danger sm" onClick={() => voidIt(r.id)}><Icon name="undo" size={14} /> Thu hồi</button>
                                    : <button className="emu-btn sm" onClick={() => restore(r.id)}><Icon name="undo" size={14} /> Khôi phục</button>}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                    {data && data.items.length === 0 && <Empty icon="list" title="Chưa có bản ghi nào" text="Thử đổi bộ lọc hoặc chấm điểm ở khung phía trên." />}
                </div>
                {pages > 1 && (
                    <div className="emu-row" style={{ justifyContent: 'center', padding: 12 }}>
                        <button className="emu-btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button>
                        <span className="emu-muted">Trang {page}/{pages}</span>
                        <button className="emu-btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Sau</button>
                    </div>
                )}
            </div>
        </div>
    );
}