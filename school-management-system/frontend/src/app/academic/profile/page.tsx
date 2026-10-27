'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, getStaff, saveSession, type Staff } from '../_lib/api';
import {
    Card,
    Empty,
    ErrorBox,
    Loading,
    Modal,
    PageHead,
    Toast,
    useToast,
} from '../_components/ui';
import './profile.css';

type Tab = 'info' | 'security' | 'sessions' | 'activity';

const TABS: { key: Tab; label: string; desc: string }[] = [
    { key: 'info', label: 'Thông tin cá nhân', desc: 'Họ tên, liên hệ, đơn vị công tác' },
    { key: 'security', label: 'Bảo mật', desc: 'Đổi mật khẩu, xác thực' },
    { key: 'sessions', label: 'Phiên đăng nhập', desc: 'Thiết bị đang đăng nhập' },
    { key: 'activity', label: 'Nhật ký hoạt động', desc: 'Thao tác gần đây trên hệ thống' },
];

export default function AcademicProfilePage() {
    const toast = useToast();
    const [tab, setTab] = useState<Tab>('info');
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);

    const [profile, setProfile] = useState<any>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [activity, setActivity] = useState<any[]>([]);

    // form liên hệ
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');

    // đổi mật khẩu
    const [curPw, setCurPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [newPw2, setNewPw2] = useState('');
    const [showPw, setShowPw] = useState(false);

    const load = async () => {
        setLoading(true);
        setErr('');
        try {
            const me = await api<any>('me');
            // hỗ trợ cả {staff} lẫn data phẳng
            const p = me?.staff ?? me?.user ?? me;
            setProfile(p);
            setPhone(p?.phone || '');
            setEmail(p?.email || '');

            try {
                const sec = await api<any>('security');
                setSessions(sec?.sessions || sec?.items || []);
            } catch {
                setSessions([]);
            }
            try {
                const act = await api<any>('activity?limit=20');
                setActivity(act?.items || act || []);
            } catch {
                setActivity([]);
            }
        } catch (e: any) {
            setErr(e?.message || 'Không tải được hồ sơ.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const saveContact = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            const res = await api<any>('profile/contact', {
                method: 'PUT',
                body: { phone: phone.trim(), email: email.trim() },
            });
            const p = res?.staff ?? res?.user ?? res ?? profile;
            setProfile((prev: any) => ({ ...prev, ...p, phone, email }));
            // cập nhật localStorage nếu có
            const st = getStaff();
            if (st) {
                saveSession(localStorage.getItem('gv_token') || '', {
                    ...st,
                    name: p?.name || st.name,
                } as Staff);
            }
            toast.ok('Đã cập nhật thông tin liên hệ.');
        } catch (ex: any) {
            toast.fail(ex?.message || 'Cập nhật thất bại.');
        } finally {
            setBusy(false);
        }
    };

    const changePassword = async (e: FormEvent) => {
        e.preventDefault();
        if (newPw.length < 6) {
            toast.fail('Mật khẩu mới tối thiểu 6 ký tự.');
            return;
        }
        if (newPw !== newPw2) {
            toast.fail('Nhập lại mật khẩu không khớp.');
            return;
        }
        setBusy(true);
        try {
            await api('change-password', {
                method: 'POST',
                body: {
                    current_password: curPw,
                    new_password: newPw,
                    new_password_confirmation: newPw2,
                },
            });
            setCurPw('');
            setNewPw('');
            setNewPw2('');
            toast.ok('Đổi mật khẩu thành công.');
        } catch (ex: any) {
            toast.fail(ex?.message || 'Đổi mật khẩu thất bại.');
        } finally {
            setBusy(false);
        }
    };

    const revokeSession = async (id: number) => {
        if (!confirm('Thu hồi phiên đăng nhập này?')) return;
        try {
            await api(`security/sessions/${id}/revoke`, { method: 'POST' });
            toast.ok('Đã thu hồi phiên.');
            load();
        } catch (ex: any) {
            toast.fail(ex?.message || 'Không thu hồi được.');
        }
    };

    const revokeOthers = async () => {
        if (!confirm('Đăng xuất tất cả thiết bị khác?')) return;
        try {
            await api('security/revoke-others', { method: 'POST' });
            toast.ok('Đã thu hồi các phiên khác.');
            load();
        } catch (ex: any) {
            toast.fail(ex?.message || 'Thất bại.');
        }
    };

    if (loading) {
        return (
            <div className="apf">
                <PageHead title="Hồ sơ của tôi" sub="Thông tin tài khoản Giáo vụ / Ban giám hiệu" />
                <Loading />
            </div>
        );
    }

    if (err) {
        return (
            <div className="apf">
                <PageHead title="Hồ sơ của tôi" sub="Thông tin tài khoản Giáo vụ / Ban giám hiệu" />
                <ErrorBox msg={err} retry={load} />
            </div>
        );
    }

    const name = profile?.name || 'Cán bộ';
    const roleLabel = profile?.role_label || profile?.role || 'Giáo vụ';
    const username = profile?.username || '—';
    const initial = (name.trim().charAt(0) || 'G').toUpperCase();

    return (
        <div className="apf">
            <PageHead
                title="Hồ sơ của tôi"
                sub="Quản lý thông tin cá nhân, bảo mật và phiên đăng nhập trên Cổng Giáo vụ."
            />

            {/* Banner */}
            <section className="apf-banner">
                <div className="apf-avatar">{initial}</div>
                <div className="apf-banner-text">
                    <h2>{name}</h2>
                    <p>
                        <span className="apf-chip">{roleLabel}</span>
                        <span className="apf-muted">@{username}</span>
                        {profile?.email && <span className="apf-muted">{profile.email}</span>}
                    </p>
                </div>
                <div className="apf-banner-meta">
                    <div>
                        <small>Trạng thái</small>
                        <b className="ok">{profile?.status === 'locked' ? 'Bị khóa' : 'Đang hoạt động'}</b>
                    </div>
                    <div>
                        <small>Đăng nhập gần nhất</small>
                        <b>{profile?.last_login_at || profile?.last_login || '—'}</b>
                    </div>
                </div>
            </section>

            {/* Chức năng con */}
            <div className="apf-features">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        className={`apf-feat ${tab === t.key ? 'on' : ''}`}
                        onClick={() => setTab(t.key)}
                    >
                        <b>{t.label}</b>
                        <span>{t.desc}</span>
                    </button>
                ))}
            </div>

            {/* Tab: Thông tin */}
            {tab === 'info' && (
                <div className="apf-grid">
                    <Card>
                        <h3 className="apf-card-title">Thông tin cơ bản</h3>
                        <dl className="apf-dl">
                            <div>
                                <dt>Họ và tên</dt>
                                <dd>{name}</dd>
                            </div>
                            <div>
                                <dt>Tên đăng nhập</dt>
                                <dd>
                                    <code>{username}</code>
                                </dd>
                            </div>
                            <div>
                                <dt>Vai trò</dt>
                                <dd>{roleLabel}</dd>
                            </div>
                            <div>
                                <dt>Mã nhân sự</dt>
                                <dd>{profile?.staff_code || profile?.code || '—'}</dd>
                            </div>
                            <div>
                                <dt>Đơn vị / Tổ</dt>
                                <dd>{profile?.department || profile?.unit || 'Văn phòng Giáo vụ'}</dd>
                            </div>
                            <div>
                                <dt>Ngày tạo tài khoản</dt>
                                <dd>{profile?.created_at || '—'}</dd>
                            </div>
                        </dl>
                    </Card>

                    <Card>
                        <h3 className="apf-card-title">Thông tin liên hệ</h3>
                        <form className="apf-form" onSubmit={saveContact}>
                            <label>
                                <span>Email công vụ</span>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="vd: giaovu@thpt.edu.vn"
                                />
                            </label>
                            <label>
                                <span>Số điện thoại</span>
                                <input
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="09xx xxx xxx"
                                />
                            </label>
                            <div className="apf-form-actions">
                                <button type="submit" className="apf-btn pri" disabled={busy}>
                                    {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
                                </button>
                            </div>
                        </form>
                        <p className="apf-hint">
                            Đổi họ tên / ngày sinh cần gửi đề nghị qua Quản trị hệ thống (dữ liệu nhân sự).
                        </p>
                    </Card>
                </div>
            )}

            {/* Tab: Bảo mật */}
            {tab === 'security' && (
                <div className="apf-grid">
                    <Card>
                        <h3 className="apf-card-title">Đổi mật khẩu</h3>
                        <form className="apf-form" onSubmit={changePassword}>
                            <label>
                                <span>Mật khẩu hiện tại</span>
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    value={curPw}
                                    onChange={(e) => setCurPw(e.target.value)}
                                    required
                                />
                            </label>
                            <label>
                                <span>Mật khẩu mới</span>
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    value={newPw}
                                    onChange={(e) => setNewPw(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </label>
                            <label>
                                <span>Nhập lại mật khẩu mới</span>
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    value={newPw2}
                                    onChange={(e) => setNewPw2(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </label>
                            <label className="apf-check">
                                <input
                                    type="checkbox"
                                    checked={showPw}
                                    onChange={(e) => setShowPw(e.target.checked)}
                                />
                                Hiện mật khẩu
                            </label>
                            <div className="apf-form-actions">
                                <button type="submit" className="apf-btn pri" disabled={busy}>
                                    {busy ? 'Đang đổi…' : 'Đổi mật khẩu'}
                                </button>
                            </div>
                        </form>
                    </Card>

                    <Card>
                        <h3 className="apf-card-title">Khuyến nghị bảo mật</h3>
                        <ul className="apf-tips">
                            <li>Dùng mật khẩu ≥ 8 ký tự, có chữ hoa, số và ký tự đặc biệt.</li>
                            <li>Không chia sẻ tài khoản Giáo vụ với người khác.</li>
                            <li>Đăng xuất trên máy dùng chung sau khi làm việc.</li>
                            <li>Thu hồi phiên lạ trong tab « Phiên đăng nhập ».</li>
                        </ul>
                    </Card>
                </div>
            )}

            {/* Tab: Phiên đăng nhập */}
            {tab === 'sessions' && (
                <Card pad={false}>
                    <div className="apf-card-bar">
                        <h3 className="apf-card-title">Thiết bị / phiên đang mở</h3>
                        <button type="button" className="apf-btn ghost" onClick={revokeOthers}>
                            Đăng xuất thiết bị khác
                        </button>
                    </div>
                    {!sessions.length ? (
                        <Empty text="Chưa có dữ liệu phiên (API security chưa trả về danh sách)." />
                    ) : (
                        <ul className="apf-session-list">
                            {sessions.map((s: any) => (
                                <li key={s.id}>
                                    <div>
                                        <b>{s.device || s.user_agent || 'Thiết bị'}</b>
                                        <span>
                                            {s.ip || '—'} · {s.last_active_at || s.created_at || '—'}
                                        </span>
                                        {s.is_current && <em className="apf-chip ok">Hiện tại</em>}
                                    </div>
                                    {!s.is_current && (
                                        <button
                                            type="button"
                                            className="apf-btn danger"
                                            onClick={() => revokeSession(s.id)}
                                        >
                                            Thu hồi
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            )}

            {/* Tab: Nhật ký */}
            {tab === 'activity' && (
                <Card pad={false}>
                    <div className="apf-card-bar">
                        <h3 className="apf-card-title">Hoạt động gần đây</h3>
                        <button type="button" className="apf-btn ghost" onClick={load}>
                            Làm mới
                        </button>
                    </div>
                    {!activity.length ? (
                        <Empty text="Chưa có nhật ký hoạt động." />
                    ) : (
                        <ul className="apf-activity">
                            {activity.map((a: any, i: number) => (
                                <li key={a.id || i}>
                                    <time>{a.created_at || a.time || '—'}</time>
                                    <div>
                                        <b>{a.action || a.title}</b>
                                        <span>{a.detail || a.description || ''}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            )}

            <Toast t={toast.t} clear={toast.clear} />
        </div>
    );
}