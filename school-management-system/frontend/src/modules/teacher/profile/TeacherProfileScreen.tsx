'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ToastProvider, useToast } from '@/components/Toast';
import { apiError, profileApi } from '@/services/teacherProfileService';
import { Icon, Skeleton, ErrorBox, fmtDate, initials, Spin } from '@/modules/teacher/profile/ui';
import type { Overview, Settings, TabKey } from '@/modules/teacher/profile/types';
import OverviewTab from '@/modules/teacher/profile/tabs/OverviewTab';
import PersonalTab from '@/modules/teacher/profile/tabs/PersonalTab';
import TeachingTab from '@/modules/teacher/profile/tabs/TeachingTab';
import QualificationsTab from '@/modules/teacher/profile/tabs/QualificationsTab';
import RequestsTab from '@/modules/teacher/profile/tabs/RequestsTab';
import SecurityTab from '@/modules/teacher/profile/tabs/SecurityTab';
import SettingsTab from '@/modules/teacher/profile/tabs/SettingsTab';
import ActivityTab from '@/modules/teacher/profile/tabs/ActivityTab';
import s from '@/modules/teacher/profile/profile.module.css';

const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'overview', label: 'Tổng quan', icon: 'home' }, { key: 'personal', label: 'Thông tin cá nhân', icon: 'user' },
    { key: 'teaching', label: 'Giảng dạy', icon: 'book' }, { key: 'qualifications', label: 'Bằng cấp & chứng chỉ', icon: 'award' },
    { key: 'requests', label: 'Yêu cầu chỉnh sửa', icon: 'send' }, { key: 'security', label: 'Bảo mật', icon: 'shield' },
    { key: 'settings', label: 'Cài đặt', icon: 'cog' }, { key: 'activity', label: 'Nhật ký', icon: 'clock' },
];
const isTab = (v: string): v is TabKey => TABS.some((t) => t.key === v);

/** Ảnh từ backend: đã là URL đầy đủ thì dùng luôn, nếu là đường dẫn tương đối thì ghép với địa chỉ backend */
const assetUrl = (p?: string | null) => {
    if (!p) return null;
    if (/^https?:/.test(p)) return p;
    return (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/api(\/v1)?\/?$/, '') + p;
};

function ProfileScreen() {
    const toast = useToast();
    const [ov, setOv] = useState<Overview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<TabKey>('overview');
    const [prefill, setPrefill] = useState<string | undefined>();
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [density, setDensity] = useState('comfortable');
    const [pwdAt, setPwdAt] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [imgOk, setImgOk] = useState(true);
    const fileRef = useRef<HTMLInputElement>(null);

    const applySettings = useCallback((st: Settings) => {
        const dark = st.theme === 'dark' || (st.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        setTheme(dark ? 'dark' : 'light'); setDensity(st.density); setPwdAt(st.password_changed_at);
    }, []);

    const load = useCallback(async () => {
        try { setOv(await profileApi.overview()); setError(null); } catch (e) { setError(apiError(e).message); }
    }, []);

    useEffect(() => { load(); profileApi.settings().then(applySettings).catch(() => {}); }, [load, applySettings]);
    useEffect(() => {
        const read = () => { const h = window.location.hash.slice(1); if (isTab(h)) setTab(h); };
        read(); window.addEventListener('hashchange', read); return () => window.removeEventListener('hashchange', read);
    }, []);

    const go = useCallback((t: TabKey, pre?: string) => {
        setPrefill(pre); setTab(t); history.replaceState(null, '', `#${t}`); window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    async function onAvatar(file?: File) {
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) return toast.error('Ảnh quá lớn', 'Vui lòng chọn ảnh dưới 2MB.');
        setUploading(true);
        try { await profileApi.uploadAvatar(file); toast.success('Đã đổi ảnh đại diện'); setImgOk(true); await load(); }
        catch (e) { toast.error('Tải ảnh thất bại', apiError(e).message); } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
    }

    if (error && !ov) return <div style={{ padding: 24 }}><ErrorBox message={error} onRetry={load} /></div>;
    if (!ov) return <div style={{ padding: 24 }}><Skeleton h={200} /><Skeleton h={90} n={2} /></div>;

    const name = ov.teacher?.full_name || ov.user.name;
    const avatar = assetUrl(ov.user.avatar);
    const st = ov.stats;
    const p = ov.profile;
    const roleLabel = (st.homeroom.length ? `Giáo viên chủ nhiệm ${st.homeroom.join(', ')}` : 'Giáo viên bộ môn') + (ov.teacher?.subject_name ? ` · ${ov.teacher.subject_name}` : '');
    const hd = ov.homeroom_detail?.[0];
    const years = st.years_of_service !== null ? `${st.years_of_service} năm` : '—';
    const MINI = [
        { n: st.teaching_classes, l: 'Lớp đang dạy' }, { n: st.periods_per_week, l: 'Tiết / tuần' },
        { n: years, l: 'Thâm niên' }, { n: st.qualifications, l: 'Bằng cấp / CC' },
    ];
    const HERO = hd
        ? [{ n: `Lớp ${hd.name}`, l: 'Lớp chủ nhiệm' }, { n: `${hd.students}/${hd.capacity}`, l: 'Sĩ số' }, { n: `${hd.male} / ${hd.female}`, l: 'Nam / Nữ' }, { n: hd.pending_leaves, l: 'Đơn nghỉ chờ duyệt' }]
        : [{ n: st.teaching_classes, l: 'Lớp đang dạy' }, { n: st.periods_per_week, l: 'Tiết / tuần' }, { n: years, l: 'Thâm niên' }];
    const INFO = [
        { i: 'shield', t: ov.user.username ? `@${ov.user.username}` : '—', l: 'Tên đăng nhập' },
        { i: 'phone', t: ov.user.phone || 'Chưa cập nhật', l: 'Điện thoại' },
        { i: 'users', t: p?.department || 'Chưa cập nhật', l: 'Tổ chuyên môn' },
        { i: 'calendar', t: p?.joined_at ? fmtDate(p.joined_at) : 'Chưa cập nhật', l: 'Ngày vào trường' },
    ];

    return (
        <div className={s.root} data-theme={theme} data-density={density}>
            <div className={s.cover}>
                <div className={s.coverIn}>
                    <div className={s.coverTitle}>Hồ sơ cá nhân</div>
                    <div className={s.coverSub}>Quản lý thông tin cá nhân, giảng dạy, bảo mật và cài đặt tài khoản của bạn</div>
                    <div className={s.heroStats}>{HERO.map((x) => <div key={x.l} className={s.heroStat}><b>{x.n}</b><span>{x.l}</span></div>)}</div>
                </div>
            </div>

            <div className={s.layout}>
                <aside className={s.pc}>
                    <div className={s.pcBand} />
                    <div className={s.pcBody}>
                        <div className={s.avatarWrap}>
                            {avatar && imgOk ? <img className={s.avatar} src={avatar} alt={name} onError={() => setImgOk(false)} /> : <div className={s.avatar}>{initials(name)}</div>}
                            <button className={s.avatarBtn} onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Đổi ảnh đại diện">{uploading ? <Spin /> : <Icon n="camera" size={16} />}</button>
                            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => onAvatar(e.target.files?.[0])} />
                        </div>
                        <h1 className={s.name}>{name}</h1>
                        <div className={s.role}>{roleLabel}</div>
                        <div className={s.chips}>
                            {ov.teacher && <span className={s.chip}><Icon n="user" size={13} /> {ov.teacher.code}</span>}
                            <span className={s.chip} style={ov.user.status === 'active' ? undefined : { background: 'var(--badSoft)', color: 'var(--bad)' }}>{ov.user.status === 'active' ? '● Đang hoạt động' : 'Tạm khóa'}</span>
                        </div>

                        <div className={s.pcSec}>
                            <div className={s.pcLbl}><span>Độ hoàn thiện hồ sơ</span><span style={{ color: 'var(--brand2)' }}>{ov.completion.percent}%</span></div>
                            <div className={s.bar}><div className={s.barFill} style={{ width: `${ov.completion.percent}%` }} /></div>
                            <div className={s.pcHint}>{ov.completion.missing.length ? <>Còn {ov.completion.missing.length} mục cần bổ sung · <a href="#personal" onClick={(e) => { e.preventDefault(); go(ov.completion.missing[0].tab); }} style={{ color: 'var(--brand)', fontWeight: 650 }}>Bổ sung ngay</a></> : 'Hồ sơ đã hoàn thiện 🎉'}</div>
                        </div>

                        <div className={s.pcSec}>
                            {INFO.map((x) => <div key={x.l} className={s.pcRow}><Icon n={x.i} size={17} /><div>{x.t}<small>{x.l}</small></div></div>)}
                        </div>

                        <div className={s.pcSec}>
                            <div className={s.mini}>{MINI.map((x) => <div key={x.l} className={s.miniItem}><b style={{ fontSize: String(x.n).length > 6 ? 15 : undefined }}>{x.n}</b><span>{x.l}</span></div>)}</div>
                        </div>

                        <div className={s.pcBtns}>
                            <button className={`${s.btn} ${s.btnP}`} onClick={() => go('personal')}><Icon n="edit" size={16} /> Chỉnh sửa hồ sơ</button>
                            <button className={s.btn} onClick={() => go('security')}><Icon n="lock" size={16} /> Bảo mật tài khoản</button>
                        </div>
                    </div>
                </aside>

                <section className={s.main}>
                    {!ov.teacher && <div className={s.card} style={{ marginBottom: 16, borderColor: 'var(--warn)' }}>⚠️ Tài khoản này chưa liên kết với hồ sơ giáo viên nên chưa có dữ liệu giảng dạy.</div>}
                    <nav className={s.tabs} role="tablist">
                        {TABS.map((t) => (
                            <button key={t.key} role="tab" aria-selected={tab === t.key} className={`${s.tab} ${tab === t.key ? s.tabOn : ''}`} onClick={() => go(t.key)}>
                                <Icon n={t.icon} size={16} /> {t.label}{t.key === 'personal' && ov.completion.missing.some((m) => m.tab === 'personal') && tab !== 'personal' && <i className={s.dot} />}
                            </button>))}
                    </nav>
                    <main>
                        {tab === 'overview' && <OverviewTab ov={ov} go={go} />}
                        {tab === 'personal' && <PersonalTab ov={ov} reload={load} go={go} />}
                        {tab === 'teaching' && <TeachingTab />}
                        {tab === 'qualifications' && <QualificationsTab onChanged={load} />}
                        {tab === 'requests' && <RequestsTab ov={ov} prefill={prefill} onChanged={load} />}
                        {tab === 'security' && <SecurityTab passwordChangedAt={pwdAt} />}
                        {tab === 'settings' && <SettingsTab onApply={applySettings} />}
                        {tab === 'activity' && <ActivityTab />}
                    </main>
                </section>
            </div>
        </div>
    );
}

export default function TeacherProfilePage() {
    return <ToastProvider><ProfileScreen /></ToastProvider>;
}