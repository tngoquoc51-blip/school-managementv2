'use client';
import { useState } from 'react';
import Modal from '../../subjects/ui/Modal';
import Icon from '../../subjects/ui/Icon';
import { useToast } from '../../subjects/ui/Toast';
import { useConfirm } from '../../subjects/ui/Confirm';
import { tcls } from '../../subjects/theme';
import { ErrorBox, useLoad } from '../../subjects/tabs/shared';
import { errMsg, teacherApi } from '../api';
import type { Meta, TeacherDetail } from '../types';
import { Avatar, LEAVE_STATUS, LEAVE_TYPES, LoadBar, WEEKDAYS, fmtD } from './bits';

export default function TeacherDrawer({ id, yearId, meta, onClose, onEdit }: { id: number; yearId: number; meta: Meta; onClose: () => void; onEdit: (t: TeacherDetail) => void }) {
    const toast = useToast();
    const confirm = useConfirm();
    const q = useLoad(() => teacherApi.detail(id, yearId), [id, yearId]);
    const sc = useLoad(() => teacherApi.schedule(id, yearId), [id, yearId]);
    const t = q.data;
    const [cert, setCert] = useState({ name: '', issuer: '', issued_at: '', expires_at: '' });
    const [adding, setAdding] = useState(false);

    const addCert = async () => {
        if (!cert.name.trim()) { toast.warning('Thiếu tên chứng chỉ'); return; }
        try { await teacherApi.addCert(id, cert); toast.success('Đã thêm chứng chỉ', cert.name); setCert({ name: '', issuer: '', issued_at: '', expires_at: '' }); setAdding(false); q.reload(true); }
        catch (e) { toast.error('Không thêm được', errMsg(e)); }
    };
    const delCert = async (cid: number, name: string) => {
        if (!(await confirm({ title: `Xóa chứng chỉ “${name}”?`, tone: 'danger', confirmText: 'Xóa' }))) return;
        try { await teacherApi.removeCert(cid); toast.success('Đã xóa chứng chỉ'); q.reload(true); } catch (e) { toast.error('Không xóa được', errMsg(e)); }
    };
    const today = new Date().toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
    const subjName = (sid: number) => meta.subjects.find((s) => s.id === sid);

    return (
        <Modal side onClose={onClose} title={t ? <span className="tc-person"><Avatar name={t.full_name} gender={t.gender} />{t.full_name}</span> : 'Đang tải…'}
               subtitle={t ? `${t.code} • ${t.position}${t.homeroom_class ? ` • GVCN ${t.homeroom_class}` : ''}` : undefined}
               footer={t && <><button className="sj-btn" onClick={() => { onClose(); }}>Đóng</button><button className="sj-btn primary" onClick={() => onEdit(t)}><Icon name="edit" size={15} /> Chỉnh sửa</button></>}>
            {q.loading && !t && <div className="sj-skel" style={{ height: 160 }} />}
            {q.error && <ErrorBox msg={q.error} retry={q.reload} />}
            {t && (
                <div>
                    <div className="sj-chips">
                        <span className={`sj-badge ${t.status === 'active' ? 'ok' : 'warn'}`}>{meta.statuses[t.status]}</span>
                        <span className="sj-badge">{meta.contracts[t.contract]}</span><span className="sj-badge">{meta.degrees[t.degree]}</span>
                        {t.gender && <span className="sj-badge">{t.gender}</span>}
                    </div>
                    <div className="sj-grid sj-g2 sj-mt" style={{ gap: 10 }}>
                        <div className="sj-card" style={{ padding: 12 }}><LoadBar periods={t.periods} quota={t.quota} status={t.periods > t.quota ? 'over' : t.periods < t.quota * 0.6 ? 'under' : 'ok'} /></div>
                        <div className="sj-card" style={{ padding: 12 }}><b style={{ fontSize: 22 }}>{t.students}</b><div className="sj-muted">học sinh phụ trách</div></div>
                    </div>

                    <h4 className="sj-sec">Thông tin liên hệ</h4>
                    <dl className="sj-kv">
                        <div><dt>Điện thoại</dt><dd>{t.phone || '—'}</dd></div><div><dt>Email</dt><dd>{t.email || '—'}</dd></div>
                        <div><dt>Ngày sinh</dt><dd>{fmtD(t.birth_date)}</dd></div><div><dt>Vào trường</dt><dd>{fmtD(t.hire_date)}</dd></div>
                        <div><dt>Địa chỉ</dt><dd>{t.address || '—'}</dd></div>
                    </dl>
                    {t.note && <p className="sj-muted">{t.note}</p>}

                    <h4 className="sj-sec">Chuyên môn</h4>
                    <div className="sj-chips">{t.subject_ids.map((sid) => { const s = subjName(sid); return s ? <span key={sid} className={`tc-sub ${tcls(s.color)} ${sid === t.main_subject_id ? 'main' : ''}`}>{s.name}{sid === t.main_subject_id && ' ★'}</span> : null; })}</div>

                    <h4 className="sj-sec">Phân công giảng dạy ({t.assignments.length})</h4>
                    {t.assignments.length === 0 ? <p className="sj-muted">Chưa được phân công lớp nào.</p> :
                        <div className="sj-chips">{t.assignments.map((a) => <span key={a.id} className={`tc-sub ${tcls(a.color)}`}>{a.class_name} · {a.subject_name} · {a.periods}t</span>)}</div>}

                    <h4 className="sj-sec">Lịch dạy trong tuần</h4>
                    {sc.data && (
                        <div className="tc-sched" style={{ gridTemplateColumns: '50px repeat(6,minmax(70px,1fr))' }}>
                            <div className="h" />{[2, 3, 4, 5, 6, 7].map((d) => <div className="h" key={d}>{WEEKDAYS[d]}</div>)}
                            {[1, 2, 3, 4, 5].map((p) => (<div key={p} style={{ display: 'contents' }}><div className="h">T{p}</div>
                                {[2, 3, 4, 5, 6, 7].map((d) => { const c = sc.data!.cells[`${d}-${p}`]; return c ? <div key={d} className={`lesson ${c.length > 1 ? 'clash' : ''}`}><b>{c[0].class_name}</b>{c[0].subject}</div> : <div key={d} className="free">·</div>; })}</div>))}
                        </div>)}

                    <h4 className="sj-sec" style={{ display: 'flex', justifyContent: 'space-between' }}>Bằng cấp & chứng chỉ <button className="sj-btn sm" onClick={() => setAdding(!adding)}><Icon name="plus" size={14} /> Thêm</button></h4>
                    {adding && (
                        <div className="sj-form" style={{ marginBottom: 12 }}>
                            <label className="sj-field full"><span>Tên chứng chỉ *</span><input className="sj-input" value={cert.name} onChange={(e) => setCert({ ...cert, name: e.target.value })} /></label>
                            <label className="sj-field"><span>Nơi cấp</span><input className="sj-input" value={cert.issuer} onChange={(e) => setCert({ ...cert, issuer: e.target.value })} /></label>
                            <label className="sj-field"><span>Ngày cấp</span><input type="date" className="sj-input" value={cert.issued_at} onChange={(e) => setCert({ ...cert, issued_at: e.target.value })} /></label>
                            <label className="sj-field"><span>Hết hạn</span><input type="date" className="sj-input" value={cert.expires_at} onChange={(e) => setCert({ ...cert, expires_at: e.target.value })} /></label>
                            <div className="sj-field"><span>&nbsp;</span><button className="sj-btn primary" onClick={addCert}>Lưu chứng chỉ</button></div>
                        </div>)}
                    {t.certs.length === 0 ? <p className="sj-muted">Chưa có chứng chỉ nào.</p> : t.certs.map((c) => {
                        const e = c.expires_at?.slice(0, 10);
                        return (
                            <div key={c.id} className={`tc-cert ${e && e < today ? 'dead' : e && e <= soon ? 'soon' : ''}`}>
                                <span><b>{c.name}</b><br /><small>{c.issuer || '—'} • {fmtD(c.issued_at)}{e ? ` → ${fmtD(e)}` : ''}{e && e < today ? ' (đã hết hạn)' : ''}</small></span>
                                <button className="sj-btn icon danger-h" onClick={() => delCert(c.id, c.name)} title="Xóa"><Icon name="trash" size={14} /></button>
                            </div>);
                    })}

                    <h4 className="sj-sec">Lịch sử nghỉ phép</h4>
                    {t.leaves.length === 0 ? <p className="sj-muted">Chưa có đơn nghỉ nào.</p> : t.leaves.map((l) => (
                        <div key={l.id} className="tc-cert"><span><b>{LEAVE_TYPES[l.leave_type] ?? l.leave_type}</b><br /><small>{fmtD(l.from_date)} → {fmtD(l.to_date)}</small></span><span className={`sj-badge ${LEAVE_STATUS[l.status].cls}`}>{LEAVE_STATUS[l.status].label}</span></div>))}
                </div>
            )}
        </Modal>
    );
}