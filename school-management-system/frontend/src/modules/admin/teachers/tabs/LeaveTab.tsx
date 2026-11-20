'use client';
import { useState } from 'react';
import type { Ctx } from '../TeachersPage';
import Modal from '../../subjects/ui/Modal';
import Icon from '../../subjects/ui/Icon';
import { useToast } from '../../subjects/ui/Toast';
import { useConfirm } from '../../subjects/ui/Confirm';
import { Empty, ErrorBox, Kpi, Loading, useLoad } from '../../subjects/tabs/shared';
import { errMsg, teacherApi } from '../api';
import type { Leave } from '../types';
import { Avatar, LEAVE_STATUS, LEAVE_TYPES, WEEKDAYS, fmtD } from './bits';

function LeaveForm({ ctx, onClose, onSaved }: { ctx: Ctx; onClose: () => void; onSaved: () => void }) {
    const toast = useToast();
    const teachers = useLoad(() => teacherApi.list({ status: 'active', school_year_id: ctx.yearId }), [ctx.yearId]);
    const today = new Date().toISOString().slice(0, 10);
    const [f, setF] = useState({ teacher_id: 0, leave_type: 'sick', from_date: today, to_date: today, reason: '' });
    const [busy, setBusy] = useState(false);
    const save = async () => {
        if (!f.teacher_id) { toast.warning('Chưa chọn giáo viên'); return; }
        if (f.to_date < f.from_date) { toast.warning('Ngày không hợp lệ', 'Ngày kết thúc phải sau ngày bắt đầu.'); return; }
        setBusy(true);
        try { await teacherApi.createLeave(f); toast.success('Đã tạo đơn nghỉ', 'Đơn đang chờ duyệt.'); onSaved(); } catch (e) { toast.error('Không tạo được đơn', errMsg(e)); } finally { setBusy(false); }
    };
    return (
        <Modal size="md" onClose={onClose} title="Tạo đơn nghỉ phép" subtitle="Sau khi duyệt, hệ thống liệt kê các tiết cần dạy thay."
               footer={<><button className="sj-btn ghost" onClick={onClose}>Hủy</button><button className="sj-btn primary" disabled={busy} onClick={save}><Icon name="check" size={16} /> Tạo đơn</button></>}>
            <div className="sj-form">
                <label className="sj-field full"><span>Giáo viên *</span><select className="sj-select" value={f.teacher_id} onChange={(e) => setF({ ...f, teacher_id: Number(e.target.value) })}><option value={0}>— Chọn giáo viên —</option>{teachers.data?.map((t) => <option key={t.id} value={t.id}>{t.full_name} ({t.code})</option>)}</select></label>
                <label className="sj-field"><span>Loại nghỉ</span><select className="sj-select" value={f.leave_type} onChange={(e) => setF({ ...f, leave_type: e.target.value })}>{Object.entries(LEAVE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <div />
                <label className="sj-field"><span>Từ ngày</span><input type="date" className="sj-input" value={f.from_date} onChange={(e) => setF({ ...f, from_date: e.target.value })} /></label>
                <label className="sj-field"><span>Đến ngày</span><input type="date" className="sj-input" value={f.to_date} min={f.from_date} onChange={(e) => setF({ ...f, to_date: e.target.value })} /></label>
                <label className="sj-field full"><span>Lý do</span><textarea className="sj-textarea" maxLength={300} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></label>
            </div>
        </Modal>
    );
}

function CoverageModal({ leave, onClose, onChanged }: { leave: Leave; onClose: () => void; onChanged: () => void }) {
    const toast = useToast();
    const q = useLoad(() => teacherApi.coverage(leave.id), [leave.id]);
    const [busy, setBusy] = useState(false);
    const act = async (fn: () => Promise<unknown>, ok: string) => {
        setBusy(true);
        try { await fn(); toast.success(ok); await q.reload(true); onChanged(); } catch (e) { toast.error('Không thực hiện được', errMsg(e)); } finally { setBusy(false); }
    };
    const L = q.data?.lessons ?? [];
    const done = L.filter((x) => x.substitute_id).length;
    const canAuto = leave.status === 'approved';

    return (
        <Modal size="xl" onClose={onClose} title={`Dạy thay: ${leave.full_name}`} subtitle={`${fmtD(leave.from_date)} → ${fmtD(leave.to_date)} • ${done}/${L.length} tiết đã có người dạy thay`}
               footer={<><button className="sj-btn ghost" onClick={onClose}>Đóng</button>
                   <button className="sj-btn primary" disabled={busy || !canAuto || done === L.length} onClick={() => act(async () => { const r = await teacherApi.autoCover(leave.id); toast.info(`Tự động phân công ${r.assigned} tiết`); }, 'Đã chạy phân công tự động')}><Icon name="wand" size={16} /> Tự động phân công</button></>}>
            {!canAuto && <div className="sj-hint warn sj-mb"><Icon name="alert" /><span>Chỉ phân công dạy thay được khi đơn đã <b>được duyệt</b>.</span></div>}
            {q.loading && !q.data ? <Loading rows={2} /> : q.error ? <ErrorBox msg={q.error} retry={q.reload} /> : L.length === 0 ? <Empty icon="check" title="Không có tiết dạy nào bị ảnh hưởng" /> : (
                <div>{L.map((x) => (
                    <div key={x.key} className="tc-cov">
                        <span><b>{fmtD(x.lesson_date)}</b><br /><small>{WEEKDAYS[x.weekday]}</small></span>
                        <span className="sj-badge">Tiết {x.period}</span>
                        <span><b>{x.class_name}</b><br /><small>{x.subject}</small></span>
                        {x.substitute_id ? (
                            <span style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}><span className="sj-badge ok">{x.substitute}</span>
                <button className="sj-btn sm" disabled={busy} onClick={() => act(() => teacherApi.unsubstitute(leave.id, x.lesson_date, x.timetable_id), 'Đã hủy dạy thay')}>Hủy</button></span>
                        ) : canAuto ? (
                            <select className="sj-select" disabled={busy} defaultValue="" onChange={(e) => e.target.value && act(() => teacherApi.substitute(leave.id, x.lesson_date, x.timetable_id, Number(e.target.value)), 'Đã phân công dạy thay')}>
                                <option value="">{x.candidates.length ? 'Chọn giáo viên dạy thay…' : 'Không có GV rảnh'}</option>
                                {x.candidates.map((c) => <option key={c.id} value={c.id}>{c.full_name}{c.same_subject ? ' ★ cùng chuyên môn' : ''}</option>)}
                            </select>) : <span className="sj-muted">—</span>}
                    </div>))}</div>)}
        </Modal>
    );
}

export default function LeaveTab({ ctx }: { ctx: Ctx }) {
    const toast = useToast();
    const confirm = useConfirm();
    const [status, setStatus] = useState('');
    const q = useLoad(() => teacherApi.leaves(status), [status]);
    const [form, setForm] = useState(false);
    const [cov, setCov] = useState<Leave | null>(null);
    const [note, setNote] = useState('');
    const [rev, setRev] = useState<{ l: Leave; d: 'approved' | 'rejected' } | null>(null);
    const all = useLoad(() => teacherApi.leaves(), []);
    const rows = q.data ?? [];
    const cnt = (s: string) => (all.data ?? []).filter((l) => l.status === s).length;
    const refresh = () => { q.reload(true); all.reload(true); ctx.refreshMeta(); };

    const review = async () => {
        if (!rev) return;
        try { await teacherApi.reviewLeave(rev.l.id, rev.d, note); toast.success(rev.d === 'approved' ? 'Đã duyệt đơn nghỉ' : 'Đã từ chối đơn', rev.l.full_name); const l = rev.l; const d = rev.d; setRev(null); setNote(''); refresh(); if (d === 'approved' && l.lessons > 0) setCov({ ...l, status: 'approved' }); }
        catch (e) { toast.error('Không xử lý được', errMsg(e)); }
    };
    const cancel = async (l: Leave) => {
        if (!(await confirm({ title: 'Hủy đơn nghỉ?', tone: 'warning', confirmText: 'Hủy đơn', message: 'Các phân công dạy thay của đơn này cũng sẽ bị hủy.' }))) return;
        try { await teacherApi.reviewLeave(l.id, 'cancelled'); toast.success('Đã hủy đơn'); refresh(); } catch (e) { toast.error('Không hủy được', errMsg(e)); }
    };
    const del = async (l: Leave) => {
        if (!(await confirm({ title: 'Xóa đơn nghỉ?', tone: 'danger', confirmText: 'Xóa' }))) return;
        try { await teacherApi.removeLeave(l.id); toast.success('Đã xóa đơn'); refresh(); } catch (e) { toast.error('Không xóa được', errMsg(e)); }
    };

    return (
        <>
            <div className="sj-kpis">
                <Kpi icon="clock" label="Chờ duyệt" value={cnt('pending')} color={cnt('pending') ? 'amber' : 'emerald'} />
                <Kpi icon="check" label="Đã duyệt" value={cnt('approved')} color="emerald" />
                <Kpi icon="x" label="Từ chối / hủy" value={cnt('rejected') + cnt('cancelled')} color="slate" />
                <Kpi icon="link" label="Tiết cần dạy thay còn trống" value={(all.data ?? []).filter((l) => l.status === 'approved').reduce((a, l) => a + (l.lessons - l.covered), 0)} color="sky" />
            </div>
            <div className="sj-bar sj-mt">
                <div className="sj-seg">{([['', 'Tất cả'], ['pending', 'Chờ duyệt'], ['approved', 'Đã duyệt'], ['rejected', 'Từ chối'], ['cancelled', 'Đã hủy']] as const).map(([k, l]) => <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}</button>)}</div>
                <span className="sj-spacer" /><button className="sj-btn primary" onClick={() => setForm(true)}><Icon name="plus" size={16} /> Tạo đơn nghỉ</button>
            </div>
            {q.loading && !q.data ? <Loading rows={3} /> : q.error ? <ErrorBox msg={q.error} retry={q.reload} /> : rows.length === 0 ? <div className="sj-card"><Empty icon="clock" title="Chưa có đơn nghỉ nào" /></div> : (
                <div className="sj-tablewrap"><table className="sj-table">
                    <thead><tr><th>Giáo viên</th><th>Loại</th><th>Thời gian</th><th>Tiết bị ảnh hưởng</th><th>Trạng thái</th><th /></tr></thead>
                    <tbody>{rows.map((l) => (
                        <tr key={l.id}>
                            <td><div className="tc-person"><Avatar name={l.full_name} /><div><b>{l.full_name}</b><small>{l.reason || l.code}</small></div></div></td>
                            <td>{LEAVE_TYPES[l.leave_type] ?? l.leave_type}</td>
                            <td>{fmtD(l.from_date)} → {fmtD(l.to_date)}<br /><small className="sj-muted">{l.days} ngày</small></td>
                            <td>{l.status === 'approved' ? <span className={`sj-badge ${l.covered >= l.lessons ? 'ok' : 'warn'}`}>{l.covered}/{l.lessons} đã có người dạy thay</span> : <span className="sj-muted">{l.lessons} tiết</span>}</td>
                            <td><span className={`sj-badge ${LEAVE_STATUS[l.status].cls}`}>{LEAVE_STATUS[l.status].label}</span>{l.review_note && <><br /><small className="sj-muted">{l.review_note}</small></>}</td>
                            <td><div className="sj-acts">
                                {l.status === 'pending' && <><button className="sj-btn sm primary" onClick={() => setRev({ l, d: 'approved' })}>Duyệt</button><button className="sj-btn sm" onClick={() => setRev({ l, d: 'rejected' })}>Từ chối</button></>}
                                {l.status === 'approved' && <><button className="sj-btn sm primary" onClick={() => setCov(l)}><Icon name="link" size={14} /> Dạy thay</button><button className="sj-btn sm" onClick={() => cancel(l)}>Hủy</button></>}
                                {(l.status === 'rejected' || l.status === 'cancelled') && <button className="sj-btn icon danger-h" onClick={() => del(l)} title="Xóa"><Icon name="trash" size={15} /></button>}
                            </div></td>
                        </tr>))}</tbody></table></div>)}

            {form && <LeaveForm ctx={ctx} onClose={() => setForm(false)} onSaved={() => { setForm(false); refresh(); }} />}
            {cov && <CoverageModal leave={cov} onClose={() => setCov(null)} onChanged={refresh} />}
            {rev && (
                <Modal size="sm" onClose={() => setRev(null)} title={rev.d === 'approved' ? 'Duyệt đơn nghỉ' : 'Từ chối đơn nghỉ'} subtitle={`${rev.l.full_name} • ${fmtD(rev.l.from_date)} → ${fmtD(rev.l.to_date)}`}
                       footer={<><button className="sj-btn ghost" onClick={() => setRev(null)}>Hủy</button><button className={`sj-btn ${rev.d === 'approved' ? 'primary' : 'danger'}`} onClick={review}>{rev.d === 'approved' ? 'Duyệt đơn' : 'Từ chối'}</button></>}>
                    {rev.d === 'approved' && rev.l.lessons > 0 && <div className="sj-hint warn sj-mb"><Icon name="alert" /><span>Đơn này làm trống <b>{rev.l.lessons} tiết</b>. Sau khi duyệt, hệ thống mở màn hình phân công dạy thay.</span></div>}
                    <label className="sj-field"><span>Ghi chú (tùy chọn)</span><textarea className="sj-textarea" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></label>
                </Modal>)}
        </>
    );
}