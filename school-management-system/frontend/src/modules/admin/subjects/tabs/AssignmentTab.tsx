'use client';
import { Fragment, useMemo, useState } from 'react';
import type { Ctx } from '../SubjectsPage';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/Confirm';
import { errMsg, subjectApi } from '../api';
import { initials, shortName, tcls } from '../theme';
import type { AutoPlan, Cell, Matrix, MatrixClass, MatrixSubject } from '../types';
import { Empty, ErrorBox, Loading, useLoad } from './shared';

export default function AssignmentTab({ ctx }: { ctx: Ctx }) {
    const confirm = useConfirm();
    const [grade, setGrade] = useState<number | undefined>(undefined);
    const [find, setFind] = useState('');
    const m = useLoad(() => subjectApi.matrix(ctx.yearId, grade), [ctx.yearId, grade]);
    const [pick, setPick] = useState<{ cls: MatrixClass; sub: MatrixSubject; cell?: Cell } | null>(null);
    const [auto, setAuto] = useState(false);
    const [bulk, setBulk] = useState(false);
    const [copy, setCopy] = useState(false);

    const d = m.data;
    const cellMap = useMemo(() => { const x = new Map<string, Cell>(); d?.cells.forEach((c) => x.set(`${c.class_id}:${c.subject_id}`, c)); return x; }, [d]);
    const stats = useMemo(() => {
        if (!d) return { need: 0, have: 0 };
        let need = 0, have = 0;
        d.classes.forEach((c) => d.subjects.forEach((s) => { if (s.grades.includes(c.grade)) { need++; if (cellMap.has(`${c.id}:${s.id}`)) have++; } }));
        return { need, have };
    }, [d, cellMap]);
    const after = () => { m.reload(true); ctx.refreshMeta(); };

    if (m.loading && !d) return <Loading />;
    if (m.error || !d) return <ErrorBox msg={m.error} retry={m.reload} />;
    const classes = d.classes.filter((c) => !find || c.name.toLowerCase().includes(find.toLowerCase()));
    const missing = stats.need - stats.have;

    return (
        <>
            <div className="sj-bar">
                <div className="sj-seg">{[undefined, 10, 11, 12].map((g) => <button key={g ?? 'all'} className={grade === g ? 'on' : ''} onClick={() => setGrade(g)}>{g ? `Khối ${g}` : 'Tất cả'}</button>)}</div>
                <div className="sj-search" style={{ maxWidth: 240, minWidth: 160 }}><Icon name="search" size={16} /><input className="sj-input" placeholder="Tìm lớp…" value={find} onChange={(e) => setFind(e.target.value)} /></div>
                <span className={`sj-badge ${missing ? 'warn' : 'ok'}`}>{stats.have}/{stats.need} đã phân công{missing ? ` • thiếu ${missing}` : ''}</span>
                <span className="sj-spacer" />
                <button className="sj-btn" onClick={() => setCopy(true)}><Icon name="copy" size={16} /> Sao chép từ năm khác</button>
                <button className="sj-btn" onClick={() => setBulk(true)}><Icon name="users" size={16} /> Phân công hàng loạt</button>
                <button className="sj-btn primary" onClick={() => setAuto(true)}><Icon name="wand" size={16} /> Tự động phân công</button>
            </div>

            {d.classes.length === 0 ? <div className="sj-card"><Empty icon="layers" title="Năm học này chưa có lớp nào" /></div> : (
                <>
                    <div className="sj-matrix-wrap">
                        <table className="sj-matrix">
                            <thead><tr><th className="corner">Lớp \ Môn</th>
                                {d.subjects.map((s) => <th key={s.id} className={tcls(s.color)}><span><b>{s.name}</b><small>{s.periods_per_week} tiết</small></span></th>)}</tr></thead>
                            <tbody>
                            {classes.map((c, i) => (
                                <Fragment key={c.id}>
                                    {(i === 0 || classes[i - 1].grade !== c.grade) && <tr className="gap" key={`g${c.grade}`}><td className="rowh" colSpan={d.subjects.length + 1}>KHỐI {c.grade}</td></tr>}
                                    <tr key={c.id}>
                                        <td className="rowh"><b>{c.name}</b><small>{c.homeroom_name ? `GVCN: ${shortName(c.homeroom_name)}` : 'Chưa có GVCN'}</small></td>
                                        {d.subjects.map((s) => {
                                            const applicable = s.grades.includes(c.grade);
                                            const cell = cellMap.get(`${c.id}:${s.id}`);
                                            if (!applicable) return <td key={s.id} className={tcls(s.color)}><span className="sj-cellbtn na" title={`${s.name} không áp dụng cho khối ${c.grade}`}>—</span></td>;
                                            const off = cell && cell.main_subject_id !== s.id && !(s.kind === 'pass' && c.homeroom_teacher_id === cell.teacher_id);
                                            return (
                                                <td key={s.id} className={tcls(s.color)}>
                                                    {cell ? <button className={`sj-cellbtn ${off ? 'warnc' : ''}`} onClick={() => setPick({ cls: c, sub: s, cell })} title={off ? 'Giáo viên dạy trái chuyên môn' : cell.teacher_name}>
                                                            {shortName(cell.teacher_name)}<small>{cell.teacher_code}{off ? ' • trái CM' : ''}</small></button>
                                                        : <button className="sj-cellbtn gap" onClick={() => setPick({ cls: c, sub: s })}><Icon name="plus" size={13} /> Gán</button>}
                                                </td>);
                                        })}
                                    </tr>
                                </Fragment>))}
                            </tbody>
                        </table>
                    </div>
                    <div className="sj-legend-row">
                        <span><i style={{ background: 'color-mix(in srgb,#0369a1 25%,transparent)' }} /> Đã phân công</span>
                        <span><i style={{ border: '1.5px dashed var(--bad)' }} /> Chưa phân công</span>
                        <span><i style={{ boxShadow: 'inset 0 0 0 2px var(--warn)' }} /> Dạy trái chuyên môn</span>
                        <span><i style={{ background: 'repeating-linear-gradient(45deg,transparent 0 3px,var(--line) 3px 4px)' }} /> Không áp dụng cho khối</span>
                    </div>
                </>)}

            {pick && <AssignModal data={d} pick={pick} yearId={ctx.yearId} onClose={() => setPick(null)} onDone={() => { setPick(null); after(); }} />}
            {auto && <AutoModal yearId={ctx.yearId} grade={grade} onClose={() => setAuto(false)} onDone={() => { setAuto(false); after(); }} />}
            {bulk && <BulkModal data={d} onClose={() => setBulk(false)} onDone={() => { setBulk(false); after(); }} />}
            {copy && <CopyModal ctx={ctx} onClose={() => setCopy(false)} onDone={() => { setCopy(false); after(); }} confirm={confirm} />}
        </>
    );
}

function AssignModal({ data, pick, yearId, onClose, onDone }: { data: Matrix; pick: { cls: MatrixClass; sub: MatrixSubject; cell?: Cell }; yearId: number; onClose: () => void; onDone: () => void }) {
    void yearId;
    const toast = useToast();
    const confirm = useConfirm();
    const [sel, setSel] = useState<number | null>(pick.cell?.teacher_id ?? null);
    const [kw, setKw] = useState('');
    const [onlySpec, setOnlySpec] = useState(true);
    const [busy, setBusy] = useState(false);
    const list = data.teachers
        .filter((t) => (!onlySpec || t.main_subject_id === pick.sub.id) && (!kw || t.full_name.toLowerCase().includes(kw.toLowerCase()) || t.code.toLowerCase().includes(kw.toLowerCase())))
        .sort((a, b) => (data.load[a.id]?.periods ?? 0) - (data.load[b.id]?.periods ?? 0));

    const save = async () => {
        if (!sel) return;
        setBusy(true);
        try {
            const r = await subjectApi.assign({ class_id: pick.cls.id, subject_id: pick.sub.id, teacher_id: sel });
            toast.success('Đã lưu phân công', `${pick.sub.name} • lớp ${pick.cls.name}`);
            r.warnings.forEach((w) => toast.warning('Lưu ý', w));
            onDone();
        } catch (e) { toast.error('Không lưu được', errMsg(e)); } finally { setBusy(false); }
    };
    const unassign = async () => {
        if (!pick.cell) return;
        if (!(await confirm({ title: 'Gỡ phân công này?', tone: 'warning', confirmText: 'Gỡ phân công', message: `${pick.cell.teacher_name} sẽ không còn dạy ${pick.sub.name} lớp ${pick.cls.name}.` }))) return;
        try { await subjectApi.unassign(pick.cell.id); toast.success('Đã gỡ phân công'); onDone(); }
        catch (e) {
            const needs = (e as { response?: { data?: { errors?: { needs_force?: boolean } } } }).response?.data?.errors?.needs_force;
            if (needs && (await confirm({ title: 'Môn đang có tiết trong thời khóa biểu', tone: 'danger', confirmText: 'Gỡ và xóa các tiết TKB', message: errMsg(e) }))) {
                try { const r = await subjectApi.unassign(pick.cell.id, true); toast.success('Đã gỡ phân công', `Đã xóa ${r.removed_slots} tiết khỏi thời khóa biểu.`); onDone(); } catch (x) { toast.error('Không gỡ được', errMsg(x)); }
            } else if (!needs) toast.error('Không gỡ được', errMsg(e));
        }
    };

    return (
        <Modal onClose={onClose} title={<>Phân công: <span className={tcls(pick.sub.color)} style={{ color: 'var(--t)' }}>{pick.sub.name}</span> — lớp {pick.cls.name}</>} subtitle={`Khối ${pick.cls.grade} • ${pick.sub.periods_per_week} tiết/tuần`}
               footer={<>{pick.cell && <button className="sj-btn danger-h" onClick={unassign} style={{ marginRight: 'auto' }}><Icon name="trash" size={15} /> Gỡ phân công</button>}
                   <button className="sj-btn ghost" onClick={onClose}>Hủy</button><button className="sj-btn primary" disabled={!sel || busy} onClick={save}><Icon name="check" size={16} /> Lưu phân công</button></>}>
            <div className="sj-bar" style={{ marginBottom: 10 }}>
                <div className="sj-search"><Icon name="search" size={16} /><input className="sj-input" placeholder="Tìm giáo viên…" value={kw} onChange={(e) => setKw(e.target.value)} autoFocus /></div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" className="sj-check" checked={onlySpec} onChange={(e) => setOnlySpec(e.target.checked)} /> Chỉ GV đúng chuyên môn</label>
            </div>
            <div className="sj-pick">
                {list.length === 0 && <Empty icon="users" title="Không có giáo viên phù hợp"><p>Bỏ chọn “Chỉ GV đúng chuyên môn” để xem tất cả.</p></Empty>}
                {list.map((t) => {
                    const l = data.load[t.id]; const periods = l?.periods ?? 0; const quota = 17 - (l?.homeroom ? 4 : 0); const pct = Math.min(100, (periods / quota) * 100);
                    return (
                        <button key={t.id} className={sel === t.id ? 'on' : ''} onClick={() => setSel(t.id)}>
                            <span className="sj-avatar t-indigo">{initials(t.full_name)}</span>
                            <span><b>{t.full_name}</b><br /><small>{t.code}{t.main_subject_id !== pick.sub.id ? ' • khác chuyên môn' : ''}{l?.homeroom ? ' • GVCN' : ''}</small></span>
                            <span><small>{periods}/{quota} tiết</small><div className={`sj-prog ${periods > quota ? 'bad' : pct > 85 ? 'warn' : 'ok'}`}><i style={{ width: `${pct}%` }} /></div></span>
                        </button>);
                })}
            </div>
        </Modal>
    );
}

function AutoModal({ yearId, grade, onClose, onDone }: { yearId: number; grade?: number; onClose: () => void; onDone: () => void }) {
    const toast = useToast();
    const q = useLoad<AutoPlan>(() => subjectApi.auto(yearId, grade, true), [yearId, grade]);
    const [busy, setBusy] = useState(false);
    const run = async () => {
        setBusy(true);
        try { const r = await subjectApi.auto(yearId, grade, false); toast.success('Đã tự động phân công', `${r.count} mục giảng dạy được tạo.`); onDone(); }
        catch (e) { toast.error('Không thực hiện được', errMsg(e)); } finally { setBusy(false); }
    };
    const p = q.data;
    return (
        <Modal size="lg" onClose={onClose} title="Tự động phân công giáo viên" subtitle={`Xem trước kết quả${grade ? ` — khối ${grade}` : ' — toàn trường'}. Chỉ điền vào ô còn trống, không ghi đè phân công hiện có.`}
               footer={<><button className="sj-btn ghost" onClick={onClose}>Đóng</button><button className="sj-btn primary" disabled={!p || p.count === 0 || busy} onClick={run}><Icon name="wand" size={16} /> Áp dụng {p?.count ?? 0} phân công</button></>}>
            {q.loading ? <div className="sj-skel" style={{ height: 120 }} /> : q.error ? <ErrorBox msg={q.error} retry={q.reload} /> : p && (
                <>
                    <div className="sj-hint"><Icon name="info" /><span>Thuật toán chọn giáo viên đúng <b>chuyên môn</b>, ưu tiên <b>GVCN của lớp</b> nếu cùng môn, sau đó chọn người có <b>ít tiết nhất</b> để cân bằng tải.</span></div>
                    {p.count === 0 && <p className="sj-muted sj-mt">Không còn ô trống nào có thể phân công tự động.</p>}
                    {p.count > 0 && <div className="sj-tablewrap sj-mt" style={{ maxHeight: 300 }}><table className="sj-table" style={{ minWidth: 480 }}><thead><tr><th>Lớp</th><th>Môn</th><th>Giáo viên đề xuất</th></tr></thead>
                        <tbody>{p.plan.map((x, i) => <tr key={i}><td><b>{x.class}</b></td><td>{x.subject}</td><td>{x.teacher}</td></tr>)}</tbody></table></div>}
                    {p.count > p.plan.length && <p className="sj-muted">… và {p.count - p.plan.length} mục khác.</p>}
                    {p.skipped.length > 0 && <div className="sj-hint warn sj-mt"><Icon name="alert" /><div><b>{p.skipped.length} ô không thể tự động</b> (thiếu giáo viên chuyên môn): {p.skipped.slice(0, 5).map((s) => `${s.class}-${s.subject}`).join(', ')}{p.skipped.length > 5 ? '…' : ''}</div></div>}
                </>)}
        </Modal>
    );
}

function BulkModal({ data, onClose, onDone }: { data: Matrix; onClose: () => void; onDone: () => void }) {
    const toast = useToast();
    const [sid, setSid] = useState<number>(data.subjects[0]?.id ?? 0);
    const [tid, setTid] = useState<number | ''>('');
    const [cls, setCls] = useState<number[]>([]);
    const [busy, setBusy] = useState(false);
    const sub = data.subjects.find((s) => s.id === sid);
    const teachers = data.teachers.filter((t) => t.main_subject_id === sid);
    const classes = data.classes.filter((c) => sub?.grades.includes(c.grade));
    const save = async () => {
        if (!tid || cls.length === 0) return;
        setBusy(true);
        try {
            const r = await subjectApi.assignMany({ subject_id: sid, teacher_id: Number(tid), class_ids: cls });
            toast.success('Đã phân công hàng loạt', `${r.assigned} lớp được cập nhật.`);
            r.warnings.forEach((w) => toast.warning('Lưu ý', w)); r.errors.forEach((w) => toast.error('Lỗi', w)); onDone();
        } catch (e) { toast.error('Không thực hiện được', errMsg(e)); } finally { setBusy(false); }
    };
    return (
        <Modal onClose={onClose} title="Phân công hàng loạt" subtitle="Một giáo viên dạy một môn cho nhiều lớp cùng lúc."
               footer={<><button className="sj-btn ghost" onClick={onClose}>Hủy</button><button className="sj-btn primary" disabled={!tid || !cls.length || busy} onClick={save}>Phân công {cls.length} lớp</button></>}>
            <div className="sj-form">
                <label className="sj-field"><span>Môn học</span><select className="sj-select" value={sid} onChange={(e) => { setSid(Number(e.target.value)); setTid(''); setCls([]); }}>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                <label className="sj-field"><span>Giáo viên (đúng chuyên môn)</span><select className="sj-select" value={tid} onChange={(e) => setTid(e.target.value ? Number(e.target.value) : '')}><option value="">— Chọn giáo viên —</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name} ({t.code}) • {data.load[t.id]?.periods ?? 0} tiết</option>)}</select></label>
                <div className="sj-field full"><span>Chọn lớp ({cls.length})</span>
                    <div className="sj-chips">
                        <button type="button" className="sj-chip" onClick={() => setCls(cls.length === classes.length ? [] : classes.map((c) => c.id))}>{cls.length === classes.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</button>
                        {classes.map((c) => <button type="button" key={c.id} className={`sj-chip ${cls.includes(c.id) ? 'on' : ''}`} onClick={() => setCls(cls.includes(c.id) ? cls.filter((x) => x !== c.id) : [...cls, c.id])}>{c.name}</button>)}</div></div>
            </div>
        </Modal>
    );
}

function CopyModal({ ctx, onClose, onDone, confirm }: { ctx: Ctx; onClose: () => void; onDone: () => void; confirm: ReturnType<typeof useConfirm> }) {
    const toast = useToast();
    const others = ctx.meta.school_years.filter((y) => y.id !== ctx.yearId);
    const [from, setFrom] = useState<number | ''>(others[0]?.id ?? '');
    const to = ctx.meta.school_years.find((y) => y.id === ctx.yearId);
    const run = async () => {
        if (!from) return;
        if (!(await confirm({ title: 'Sao chép phân công?', confirmText: 'Sao chép', message: `Các lớp cùng tên của năm học ${to?.label} sẽ được gán giáo viên như năm đã chọn (chỉ điền vào ô còn trống).` }))) return;
        try { const r = await subjectApi.copyAssign(Number(from), ctx.yearId); toast.success('Đã sao chép phân công', `${r.copied} mục mới.`); onDone(); } catch (e) { toast.error('Không sao chép được', errMsg(e)); }
    };
    return (
        <Modal size="sm" onClose={onClose} title="Sao chép phân công" subtitle={`Vào năm học ${to?.label ?? ''}`} footer={<><button className="sj-btn ghost" onClick={onClose}>Hủy</button><button className="sj-btn primary" disabled={!from} onClick={run}>Sao chép</button></>}>
            <label className="sj-field"><span>Sao chép từ năm học</span><select className="sj-select" value={from} onChange={(e) => setFrom(Number(e.target.value))}>{others.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}</select></label>
        </Modal>
    );
}