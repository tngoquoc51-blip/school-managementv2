'use client';

import { useCallback, useEffect, useState } from 'react';
import cat from '@/modules/admin/categories/categories.module.css';
import { catalogService, getErrorMessage } from '@/modules/admin/categories/catalogApi';
import { useFeedback } from '@/modules/admin/categories/components/Feedback';
import Icon from '@/modules/admin/categories/components/Icon';
import { Badge, Drawer, ErrorState, Modal, formatDateTime, timeAgo } from '@/modules/admin/categories/components/ui';
import s from '../roster.module.css';
import { ACCOUNT_LABEL, CONDUCT_TONE, PII_FIELDS, PROFILE_FIELDS, fmtDate, initials, money } from '../constants';
import { rosterApi } from '../rosterApi';
import type { ClassRow, StudentDetail } from '../types';
import PickClassModal from './PickClassModal';
import StudentFormModal from './StudentFormModal';

type Tab = 'info' | 'family' | 'study' | 'account';
const TABS: { id: Tab; label: string }[] = [
    { id: 'info', label: 'Tổng quan' }, { id: 'family', label: 'Gia đình & liên hệ' }, { id: 'study', label: 'Học tập' }, { id: 'account', label: 'Tài khoản' },
];

interface Props {
    studentId: number | null;
    yearId: number;
    classes: ClassRow[];
    onClose: () => void;
    onChanged: () => void;
}

const dash = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));
const scoreCls = (v: unknown) => (typeof v === 'number' ? (v < 5 ? s.gradeLow : v >= 8 ? s.gradeHigh : '') : '');

export default function StudentDrawer({ studentId, yearId, classes, onClose, onChanged }: Props) {
    const fb = useFeedback();
    const [d, setD] = useState<StudentDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>('info');
    const [edit, setEdit] = useState(false);
    const [pick, setPick] = useState(false);
    const [secret, setSecret] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async (reveal = false) => {
        if (studentId === null) return;
        setError(null);
        try { setD(await rosterApi.student(studentId, yearId, reveal)); } catch (e) { setError(getErrorMessage(e)); }
    }, [studentId, yearId]);

    useEffect(() => { setD(null); setTab('info'); setSecret(null); void load(); }, [load]);

    const changed = () => { onChanged(); void load(d?.revealed ?? false); };

    const enroll = async (classId: number) => {
        if (!d) return;
        try {
            const r = await rosterApi.enroll(d.student.id, classId, yearId);
            fb.success(r.result === 'transferred' ? 'Đã chuyển lớp' : 'Đã xếp lớp', d.student.full_name);
            setPick(false);
            changed();
        } catch (e) { fb.error('Không xếp được lớp', getErrorMessage(e)); }
    };

    const unenroll = async () => {
        if (!d) return;
        const ok = await fb.confirm({ title: 'Gỡ khỏi lớp?', message: `${d.student.full_name} sẽ chưa có lớp trong năm học này.`, confirmLabel: 'Gỡ khỏi lớp', tone: 'danger' });
        if (!ok) return;
        try { await rosterApi.unenroll(d.student.id, yearId); fb.success('Đã gỡ khỏi lớp'); changed(); } catch (e) { fb.error('Không gỡ được', getErrorMessage(e)); }
    };

    const remove = async () => {
        if (!d) return;
        const ok = await fb.confirm({ title: 'Xóa học sinh?', message: `Xóa vĩnh viễn hồ sơ và tài khoản của ${d.student.full_name}. Chỉ làm được khi chưa có điểm hoặc hóa đơn.`, confirmLabel: 'Xóa học sinh', tone: 'danger' });
        if (!ok) return;
        try { await rosterApi.deleteStudent(d.student.id); fb.success('Đã xóa học sinh', d.student.full_name); onChanged(); onClose(); } catch (e) { fb.error('Không xóa được', getErrorMessage(e)); }
    };

    const reveal = async () => {
        const ok = await fb.confirm({ title: 'Xem thông tin nhạy cảm?', message: 'Số điện thoại, địa chỉ và ghi chú sức khỏe sẽ được hiển thị đầy đủ. Hành động này được ghi vào nhật ký.', confirmLabel: 'Hiện thông tin' });
        if (ok) await load(true);
    };

    const setStatus = async (status: 'active' | 'locked') => {
        if (!d?.account) return;
        setBusy(true);
        try { await catalogService.setUserStatus('student', d.account.id, status); fb.success(status === 'locked' ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản', d.student.full_name); changed(); }
        catch (e) { fb.error('Không thực hiện được', getErrorMessage(e)); } finally { setBusy(false); }
    };

    const resetPw = async () => {
        if (!d?.account) return;
        const ok = await fb.confirm({ title: 'Đặt lại mật khẩu?', message: 'Mật khẩu tạm thời chỉ hiện một lần và học sinh phải đổi khi đăng nhập.', confirmLabel: 'Đặt lại' });
        if (!ok) return;
        setBusy(true);
        try { const r = await catalogService.resetUserPassword('student', d.account.id); setSecret(r.temporary_password); changed(); }
        catch (e) { fb.error('Không đặt lại được', getErrorMessage(e)); } finally { setBusy(false); }
    };

    const st = d?.student;
    const acc = d?.account;
    const accMeta = acc ? ACCOUNT_LABEL[acc.status] : null;

    return (
        <>
            <Drawer open={studentId !== null} title={st ? st.full_name : 'Hồ sơ học sinh'} subtitle={st ? `${st.code} · ${d?.current_class ? 'Lớp ' + d.current_class.class_name : 'Chưa xếp lớp'}` : undefined} onClose={onClose}>
                {error && <ErrorState message={error} onRetry={() => void load()} />}
                {!d && !error && <div className={cat.skelCard} style={{ height: 220 }} />}
                {d && st && (
                    <>
                        <div className={s.profileHead}>
                            <span className={`${s.avatar} ${s.avatarLg} ${st.gender === 'Nữ' ? s.avatarF : ''}`}>{initials(st.full_name)}</span>
                            <div style={{ flex: 1 }}>
                                <h3>{st.full_name}</h3>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <Badge tone="info">{st.code}</Badge>
                                    <Badge tone="neutral">{st.gender}</Badge>
                                    {d.current_class ? <Badge tone="success" dot>Lớp {d.current_class.class_name}</Badge> : <Badge tone="warning" dot>Chưa xếp lớp</Badge>}
                                    {accMeta && <Badge tone={accMeta.tone} dot>{accMeta.label}</Badge>}
                                </div>
                            </div>
                            <button className={cat.btnSoft} onClick={() => setEdit(true)}><Icon name="edit" size={15} /> Sửa hồ sơ</button>
                        </div>

                        <div className={s.subTabs} role="tablist">
                            {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={`${s.subTab} ${tab === t.id ? s.subTabOn : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
                        </div>

                        {tab === 'info' && (
                            <>
                                <dl className={s.kv}>
                                    <div><dt>Ngày sinh</dt><dd>{fmtDate(st.birth_date)}</dd></div>
                                    <div><dt>Giới tính</dt><dd>{st.gender}</dd></div>
                                    <div><dt>Năm nhập học</dt><dd>{st.admission_year}</dd></div>
                                    <div><dt>Ngày tạo hồ sơ</dt><dd>{fmtDate(st.created_at)}</dd></div>
                                    <div><dt>Dân tộc</dt><dd>{dash(d.profile.ethnicity)}</dd></div>
                                    <div><dt>Tôn giáo</dt><dd>{dash(d.profile.religion)}</dd></div>
                                </dl>
                                <div className={s.section}>
                                    <span>Lớp học theo năm</span>
                                    <span style={{ display: 'flex', gap: 8 }}>
                    <button className={cat.btnSoft} onClick={() => setPick(true)}><Icon name="restore" size={15} /> {d.current_class ? 'Chuyển lớp' : 'Xếp lớp'}</button>
                                        {d.current_class && <button className={cat.btnDangerSoft} onClick={unenroll}><Icon name="x" size={15} /> Gỡ</button>}
                  </span>
                                </div>
                                {d.enrollments.length === 0 ? <p className={cat.muted}>Chưa từng được xếp lớp.</p> : (
                                    <ul className={s.timelineY}>
                                        {d.enrollments.map((e) => (
                                            <li key={e.school_year_id}><Icon name="calendar" size={16} /> {e.year_label}<span style={{ flex: 1 }} /><Badge tone={e.school_year_id === yearId ? 'success' : 'neutral'}>Lớp {e.class_name}</Badge><span className={cat.muted}>Khối {e.grade}</span></li>
                                        ))}
                                    </ul>
                                )}
                                <div className={s.section}><span>Học phí</span></div>
                                <p style={{ fontWeight: 800 }}>{d.invoices.count} hóa đơn · tổng {money(d.invoices.total)}</p>
                                <div style={{ marginTop: 22, display: 'flex', justifyContent: 'flex-end' }}>
                                    <button className={cat.btnDangerSoft} onClick={remove}><Icon name="trash" size={15} /> Xóa học sinh</button>
                                </div>
                            </>
                        )}

                        {tab === 'family' && (
                            <>
                                {!d.revealed ? (
                                    <div className={s.revealBox}>
                                        <span><Icon name="lock" size={15} /> Số điện thoại, địa chỉ và ghi chú sức khỏe đang được ẩn.</span>
                                        <button className={cat.btnPrimary} onClick={reveal}>Hiện thông tin</button>
                                    </div>
                                ) : <p className={cat.inlineWarn}>Đang hiển thị thông tin nhạy cảm — việc xem đã được ghi nhật ký.</p>}
                                {(['basic', 'family', 'health'] as const).map((g) => (
                                    <div key={g}>
                                        <div className={s.section}><span>{{ basic: 'Hồ sơ cá nhân', family: 'Gia đình', health: 'Sức khỏe' }[g]}</span></div>
                                        <dl className={s.kv}>
                                            {PROFILE_FIELDS.filter((p) => p.group === g).map((p) => <div key={p.key}><dt>{p.label}</dt><dd>{dash(d.profile[p.key])}</dd></div>)}
                                            {g === 'family' && PII_FIELDS.filter((p) => p.key.endsWith('_phone') || p.key === 'phone').map((p) => <div key={p.key}><dt>{p.label}</dt><dd>{dash(d.profile[p.key])}</dd></div>)}
                                            {g === 'basic' && PII_FIELDS.filter((p) => p.wide && p.key !== 'health_note').map((p) => <div key={p.key} className={s.kvWide}><dt>{p.label}</dt><dd>{dash(d.profile[p.key])}</dd></div>)}
                                            {g === 'health' && <div className={s.kvWide}><dt>Ghi chú sức khỏe</dt><dd>{dash(d.profile.health_note)}</dd></div>}
                                        </dl>
                                    </div>
                                ))}
                            </>
                        )}

                        {tab === 'study' && (
                            <>
                                <div className={s.section}><span>Điểm trung bình môn (năm đang chọn)</span></div>
                                {d.grades.rows.length === 0 ? <p className={cat.muted}>Chưa có điểm trong năm học này.</p> : (
                                    <table className={s.miniTable}>
                                        <thead><tr><th>Môn học</th><th>HK1</th><th>HK2</th></tr></thead>
                                        <tbody>
                                        {d.grades.rows.map((r) => <tr key={r.subject}><td>{r.subject}</td><td className={`${s.gradeNum} ${scoreCls(r.hk1)}`}>{dash(r.hk1)}</td><td className={`${s.gradeNum} ${scoreCls(r.hk2)}`}>{dash(r.hk2)}</td></tr>)}
                                        <tr><th>Trung bình</th><th className={s.gradeNum}>{dash(d.grades.avg_hk1)}</th><th className={s.gradeNum}>{dash(d.grades.avg_hk2)}</th></tr>
                                        </tbody>
                                    </table>
                                )}
                                <div className={s.section}><span>Hạnh kiểm</span></div>
                                {d.conduct.length === 0 ? <p className={cat.muted}>Chưa có đánh giá hạnh kiểm.</p> : (
                                    <table className={s.miniTable}>
                                        <thead><tr><th>Năm học</th><th>HK1</th><th>HK2</th><th>Cả năm</th></tr></thead>
                                        <tbody>{d.conduct.map((c) => <tr key={c.year_label}><td>{c.year_label}</td>{[c.hk1, c.hk2, c.year_result].map((v, i) => <td key={i}><Badge tone={CONDUCT_TONE[v] ?? 'neutral'}>{v}</Badge></td>)}</tr>)}</tbody>
                                    </table>
                                )}
                            </>
                        )}

                        {tab === 'account' && (
                            !acc ? <p className={cat.muted}>Học sinh này chưa có tài khoản đăng nhập.</p> : (
                                <>
                                    <dl className={s.kv}>
                                        <div><dt>Tên đăng nhập</dt><dd>{acc.username}</dd></div>
                                        <div><dt>Email</dt><dd>{acc.email}</dd></div>
                                        <div><dt>Trạng thái</dt><dd>{accMeta && <Badge tone={accMeta.tone} dot>{accMeta.label}</Badge>}</dd></div>
                                        <div><dt>Đăng nhập gần nhất</dt><dd>{acc.last_login_at ? `${timeAgo(acc.last_login_at)} (${formatDateTime(acc.last_login_at)})` : 'Chưa từng'}</dd></div>
                                        <div><dt>Đổi mật khẩu lần cuối</dt><dd>{acc.password_changed_at ? formatDateTime(acc.password_changed_at) : 'Chưa đổi'}</dd></div>
                                        <div><dt>Bắt buộc đổi mật khẩu</dt><dd>{acc.must_change_password ? 'Có' : 'Không'}</dd></div>
                                    </dl>
                                    <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
                                        <button className={cat.btnSoft} onClick={resetPw} disabled={busy}><Icon name="restore" size={15} /> Đặt lại mật khẩu</button>
                                        {acc.status === 'active'
                                            ? <button className={cat.btnDangerSoft} onClick={() => setStatus('locked')} disabled={busy}><Icon name="lock" size={15} /> Khóa tài khoản</button>
                                            : <button className={cat.btnSoft} onClick={() => setStatus('active')} disabled={busy}><Icon name="power" size={15} /> Mở khóa</button>}
                                    </div>
                                </>
                            )
                        )}
                    </>
                )}
            </Drawer>

            <PickClassModal open={pick} title={d?.current_class ? 'Chuyển lớp' : 'Xếp lớp'} hint={st ? `Chọn lớp cho ${st.full_name}. Điểm đã nhập sẽ chuyển theo lớp mới.` : undefined}
                            classes={classes} currentClassId={d?.current_class?.class_id} confirmLabel={d?.current_class ? 'Chuyển lớp' : 'Xếp lớp'} onClose={() => setPick(false)} onSubmit={enroll} />
            <StudentFormModal open={edit} yearId={yearId} classes={classes} editing={d} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); changed(); }} />
            <Modal open={secret !== null} title="Mật khẩu tạm thời" onClose={() => setSecret(null)}>
                <p>Hãy gửi mật khẩu này cho học sinh — <b>hệ thống sẽ không hiển thị lại</b>.</p>
                <div className={s.secretBox}>{secret}</div>
                <div className={cat.dialogActions}>
                    <button className={cat.btnSoft} onClick={() => { void navigator.clipboard?.writeText(secret ?? ''); fb.success('Đã sao chép'); }}><Icon name="clipboard" size={16} /> Sao chép</button>
                    <button className={cat.btnPrimary} onClick={() => setSecret(null)}>Đã ghi lại</button>
                </div>
            </Modal>
        </>
    );
}