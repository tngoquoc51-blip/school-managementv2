
'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, Session, SettingsApi } from '../api';
import { Card, Confirm, Field, Skeleton, dt, useToast } from '../ui';

function strength(pw: string) {
    let s = 0;
    if (pw.length >= 8) s++; if (pw.length >= 12) s++;
    if (/[A-Za-z]/.test(pw) && /[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw) && /[A-Z]/.test(pw)) s++;
    return s;
}

export default function SecurityPanel({ onChanged }: { onChanged: () => void }) {
    const toast = useToast();
    const [cur, setCur] = useState(''); const [nw, setNw] = useState(''); const [cf, setCf] = useState('');
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const [sess, setSess] = useState<Session[] | null>(null);
    const [confirmAll, setConfirmAll] = useState(false);

    const load = useCallback(() => {
        SettingsApi.sessions().then((r) => setSess(r.data)).catch((e) => toast('error', 'Không tải được phiên đăng nhập', e.message));
    }, [toast]);
    useEffect(() => { load(); }, [load]);

    const st = strength(nw);
    const labels = ['Quá yếu', 'Yếu', 'Trung bình', 'Khá', 'Mạnh'];
    const colors = ['#dc2626', '#dc2626', '#d97706', '#2563eb', '#16a34a'];

    const submit = async () => {
        const e: Record<string, string> = {};
        if (!cur) e.current_password = 'Nhập mật khẩu hiện tại.';
        if (nw.length < 8) e.new_password = 'Mật khẩu mới tối thiểu 8 ký tự.';
        if (cf !== nw) e.confirm = 'Mật khẩu nhập lại chưa khớp.';
        setErrs(e);
        if (Object.keys(e).length) return;
        setBusy(true);
        try {
            const r: any = await SettingsApi.changePassword({ current_password: cur, new_password: nw });
            toast('success', r.message); setCur(''); setNw(''); setCf(''); load(); onChanged();
        } catch (x) {
            const err = x as ApiError;
            if (err.errors) setErrs(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])));
            toast('error', 'Chưa đổi được mật khẩu', err.message);
        } finally { setBusy(false); }
    };

    const revoke = async (id: number) => {
        try { const r: any = await SettingsApi.revokeSession(id); toast('success', r.message); load(); onChanged(); }
        catch (e) { toast('error', 'Không thực hiện được', (e as Error).message); }
    };
    const revokeAll = async () => {
        setBusy(true);
        try { const r: any = await SettingsApi.revokeOthers(); toast('success', r.message); setConfirmAll(false); load(); onChanged(); }
        catch (e) { toast('error', 'Không thực hiện được', (e as Error).message); }
        finally { setBusy(false); }
    };

    return (
        <>
            <Card title="Đổi mật khẩu" desc="Sau khi đổi, các thiết bị khác sẽ bị đăng xuất."
                  footer={<div className="acs-foot"><button className="acs-btn" disabled={busy} onClick={submit}>{busy ? 'Đang xử lý…' : 'Đổi mật khẩu'}</button></div>}>
                <div className="acs-pad acs-grid">
                    <Field label="Mật khẩu hiện tại" error={errs.current_password} span>
                        <input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
                    </Field>
                    <Field label="Mật khẩu mới" error={errs.new_password} hint="Tối thiểu 8 ký tự, gồm cả chữ và số">
                        <input type="password" autoComplete="new-password" value={nw} onChange={(e) => setNw(e.target.value)} />
                        {nw && <><div className="acs-bar"><i style={{ width: `${(st / 4) * 100}%`, background: colors[st] }} /></div><div className="hint" style={{ color: colors[st] }}>{labels[st]}</div></>}
                    </Field>
                    <Field label="Nhập lại mật khẩu mới" error={errs.confirm}>
                        <input type="password" autoComplete="new-password" value={cf} onChange={(e) => setCf(e.target.value)} />
                    </Field>
                </div>
            </Card>

            <Card title="Phiên đăng nhập đang hoạt động" desc="Các thiết bị đang đăng nhập bằng tài khoản của bạn.">
                <div className="acs-tools" style={{ justifyContent: 'flex-end' }}>
                    <button className="acs-btn danger" disabled={!sess || sess.length < 2} onClick={() => setConfirmAll(true)}>Đăng xuất tất cả thiết bị khác</button>
                </div>
                {!sess ? <Skeleton rows={3} /> : (
                    <div className="acs-wrap">
                        <table className="acs-table">
                            <thead><tr><th>Phiên</th><th>Đăng nhập lúc</th><th>Hết hạn</th><th /></tr></thead>
                            <tbody>
                            {sess.map((s) => (
                                <tr key={s.id}>
                                    <td>#{s.id} {s.current && <span className="acs-tag ok">Thiết bị này</span>}</td>
                                    <td>{dt(s.created_at)}</td><td>{dt(s.expires_at)}</td>
                                    <td>{!s.current && <button className="acs-btn danger sm" onClick={() => revoke(s.id)}>Đăng xuất</button>}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
            {confirmAll && <Confirm title="Đăng xuất thiết bị khác" danger busy={busy} okText="Đăng xuất" onOk={revokeAll} onCancel={() => setConfirmAll(false)} text="Mọi phiên đăng nhập khác của tài khoản này sẽ bị đóng. Phiên hiện tại vẫn giữ nguyên." />}
        </>
    );
}