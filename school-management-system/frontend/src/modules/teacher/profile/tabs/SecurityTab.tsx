'use client';

import { useState } from 'react';
import { apiError, profileApi } from '@/services/teacherProfileService';
import { useToast } from '@/components/Toast';
import { Empty, Field, Icon, Skeleton, Spin, ago, fmtDateTime, useFetch } from '../ui';
import s from '../profile.module.css';

const rules = (p: string) => [
    ['Tối thiểu 8 ký tự', p.length >= 8], ['Có chữ cái', /[A-Za-z]/.test(p)], ['Có chữ số', /\d/.test(p)], ['Có ký tự đặc biệt / chữ hoa (khuyến nghị)', /[^A-Za-z0-9]/.test(p) || /[A-Z]/.test(p)],
] as [string, boolean][];

export default function SecurityTab({ passwordChangedAt }: { passwordChangedAt: string | null }) {
    const toast = useToast();
    const sessions = useFetch(() => profileApi.sessions());
    const history = useFetch(() => profileApi.loginHistory());
    const [f, setF] = useState({ current_password: '', password: '', password_confirmation: '' });
    const [show, setShow] = useState(false);
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const r = rules(f.password); const score = r.filter((x) => x[1]).length;
    const ok = r[0][1] && r[1][1] && r[2][1] && f.password === f.password_confirmation && f.current_password;
    const color = ['#e11d48', '#e11d48', '#f59e0b', '#16a34a', '#16a34a'][score];

    async function submit() {
        setBusy(true); setErrs({});
        try {
            await profileApi.changePassword(f);
            toast.success('Đổi mật khẩu thành công', 'Các thiết bị khác đã được đăng xuất.');
            setF({ current_password: '', password: '', password_confirmation: '' }); sessions.reload();
        } catch (e) { const x = apiError(e); setErrs(x.fields); toast.error('Không đổi được mật khẩu', x.message); } finally { setBusy(false); }
    }
    async function revoke(id: number) {
        try { await profileApi.revokeSession(id); toast.success('Đã đăng xuất thiết bị'); sessions.reload(); } catch (e) { toast.error('Thất bại', apiError(e).message); }
    }
    async function revokeAll() {
        try { await profileApi.revokeOthers(); toast.success('Đã đăng xuất các thiết bị khác'); sessions.reload(); } catch (e) { toast.error('Thất bại', apiError(e).message); }
    }
    const type = show ? 'text' : 'password';

    return (
        <div className={`${s.panel} ${s.g2}`}>
            <section className={s.card}>
                <div className={s.cardHead}><div><h3 className={s.cardTitle}><Icon n="lock" /> Đổi mật khẩu</h3><div className={s.cardSub}>Lần đổi gần nhất: {passwordChangedAt ? ago(passwordChangedAt) : 'chưa có dữ liệu'}</div></div></div>
                <Field label="Mật khẩu hiện tại" required error={errs.current_password}><input type={type} className={`${s.input} ${errs.current_password ? s.invalid : ''}`} value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} autoComplete="current-password" /></Field>
                <Field label="Mật khẩu mới" required error={errs.password}>
                    <input type={type} className={`${s.input} ${errs.password ? s.invalid : ''}`} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" />
                    <div className={s.meter}>{[0, 1, 2, 3].map((i) => <i key={i} style={i < score ? { background: color } : undefined} />)}</div>
                    {r.map(([t, v]) => <div key={t} className={`${s.rule} ${v ? s.ok : ''}`}><Icon n={v ? 'check' : 'x'} size={14} /> {t}</div>)}
                </Field>
                <Field label="Nhập lại mật khẩu mới" required error={f.password_confirmation && f.password !== f.password_confirmation ? 'Mật khẩu xác nhận chưa khớp' : undefined}><input type={type} className={s.input} value={f.password_confirmation} onChange={(e) => setF({ ...f, password_confirmation: e.target.value })} autoComplete="new-password" /></Field>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, cursor: 'pointer' }}><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Hiện mật khẩu</label>
                <button className={`${s.btn} ${s.btnP}`} disabled={!ok || busy} onClick={submit}>{busy ? <Spin /> : <Icon n="shield" size={16} />} Cập nhật mật khẩu</button>
            </section>

            <div className={s.stack}>
                <section className={s.card}>
                    <div className={s.cardHead}>
                        <div><h3 className={s.cardTitle}><Icon n="device" /> Thiết bị đang đăng nhập</h3><div className={s.cardSub}>Phát hiện thiết bị lạ? Hãy đăng xuất và đổi mật khẩu ngay.</div></div>
                        {(sessions.data?.length ?? 0) > 1 && <button className={`${s.btn} ${s.btnS} ${s.btnD}`} onClick={revokeAll}><Icon n="logout" size={14} /> Đăng xuất thiết bị khác</button>}
                    </div>
                    {sessions.loading ? <Skeleton h={60} n={2} /> : !sessions.data?.length ? <Empty text="Không có phiên nào." /> : (
                        <div className={s.stack} style={{ gap: 10 }}>{sessions.data.map((x) => (
                            <div key={x.id} className={s.item}>
                                <div className={s.itemIco} style={{ background: x.current ? '#dcfce7' : '#e0f4fa', color: x.current ? '#16a34a' : '#0891b2' }}><Icon n="device" /></div>
                                <div style={{ flex: 1 }}><b>Phiên #{x.id}</b> {x.current && <span className={`${s.badge} ${s.bOk}`}>Thiết bị này</span>}
                                    <div className={s.cardSub}>Đăng nhập {fmtDateTime(x.created_at)} • {x.last_used_at ? `Hoạt động ${ago(x.last_used_at)}` : `Hết hạn ${fmtDateTime(x.expires_at)}`}</div></div>
                                {!x.current && <button className={`${s.btn} ${s.btnS} ${s.btnD}`} onClick={() => revoke(x.id)}>Đăng xuất</button>}
                            </div>))}</div>)}
                </section>

                <section className={s.card}>
                    <div className={s.cardHead}><h3 className={s.cardTitle}><Icon n="clock" /> Lịch sử đăng nhập</h3></div>
                    {history.loading ? <Skeleton h={50} n={3} /> : !history.data?.length ? <Empty text="Chưa có lịch sử đăng nhập." /> : (
                        <div className={s.scroll}><table className={s.table}><thead><tr><th>Thời gian</th><th>Thiết bị</th><th>IP</th><th>Kết quả</th></tr></thead>
                            <tbody>{history.data.map((h) => (
                                <tr key={h.id}><td>{fmtDateTime(h.created_at)}</td><td>{[h.browser, h.platform].filter(Boolean).join(' • ') || h.device || '—'}</td><td>{h.ip_address || '—'}</td>
                                    <td><span className={`${s.badge} ${h.status === 'success' ? s.bOk : s.bBad}`}>{h.status === 'success' ? 'Thành công' : 'Thất bại'}</span></td></tr>))}</tbody></table></div>)}
                </section>
            </div>
        </div>
    );
}