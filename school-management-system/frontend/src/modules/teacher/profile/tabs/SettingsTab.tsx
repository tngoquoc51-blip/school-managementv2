'use client';

import { useEffect, useState } from 'react';
import { apiError, profileApi } from '@/services/teacherProfileService';
import { useToast } from '@/components/Toast';
import { ErrorBox, Icon, Skeleton, Spin, Switch, useFetch } from '../ui';
import type { Settings } from '../types';
import s from '../profile.module.css';

const NOTI: [keyof Settings['notification_prefs'], string, string][] = [
    ['system', 'Thông báo hệ thống', 'Bảo trì, cập nhật, thông báo từ nhà trường'], ['grades', 'Điểm số & kiểm tra', 'Nhắc hạn nhập điểm, lịch kiểm tra'],
    ['attendance', 'Điểm danh', 'Nhắc điểm danh, học sinh vắng nhiều'], ['security', 'Cảnh báo bảo mật', 'Đăng nhập lạ, đổi mật khẩu'],
    ['email', 'Gửi qua email', 'Nhận bản sao thông báo qua email'], ['push', 'Thông báo đẩy trên trình duyệt', 'Hiện ngay khi có thông báo mới'],
];
const TZ = ['Asia/Ho_Chi_Minh', 'Asia/Bangkok', 'Asia/Singapore', 'UTC'];

export default function SettingsTab({ onApply }: { onApply: (st: Settings) => void }) {
    const toast = useToast();
    const { data, loading, error, reload } = useFetch(() => profileApi.settings());
    const [f, setF] = useState<Settings | null>(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => { if (data) setF(data); }, [data]);
    if (loading || !f) return error ? <ErrorBox message={error} onRetry={reload} /> : <Skeleton h={200} n={2} />;
    const dirty = JSON.stringify(f) !== JSON.stringify(data);
    const upd = (p: Partial<Settings>) => { const n = { ...f, ...p }; setF(n); if (p.theme || p.density) onApply(n); }; // xem trước ngay

    async function save() {
        setBusy(true);
        try { const r = await profileApi.updateSettings(f!); toast.success('Đã lưu cài đặt'); onApply(r); await reload(); }
        catch (e) { toast.error('Không lưu được', apiError(e).message); } finally { setBusy(false); }
    }

    return (
        <div className={s.panel}>
            <div className={s.g2}>
                <section className={s.card}>
                    <div className={s.cardHead}><h3 className={s.cardTitle}><Icon n="cog" /> Giao diện & khu vực</h3></div>
                    <div className={s.field}><label className={s.label}>Chế độ màu</label>
                        <div className={s.seg}>{([['light', '☀️ Sáng'], ['dark', '🌙 Tối'], ['system', '💻 Theo máy']] as const).map(([k, l]) => <button key={k} className={f.theme === k ? s.segOn : ''} onClick={() => upd({ theme: k })}>{l}</button>)}</div></div>
                    <div className={s.field}><label className={s.label}>Mật độ hiển thị</label>
                        <div className={s.seg}>{([['comfortable', 'Thoải mái'], ['compact', 'Gọn']] as const).map(([k, l]) => <button key={k} className={f.density === k ? s.segOn : ''} onClick={() => upd({ density: k })}>{l}</button>)}</div></div>
                    <div className={s.row2}>
                        <div className={s.field}><label className={s.label}>Ngôn ngữ</label><select className={s.select} value={f.language} onChange={(e) => upd({ language: e.target.value as any })}><option value="vi">Tiếng Việt</option><option value="en">English</option></select></div>
                        <div className={s.field}><label className={s.label}>Định dạng ngày</label><select className={s.select} value={f.date_format} onChange={(e) => upd({ date_format: e.target.value })}><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option></select></div>
                    </div>
                    <div className={s.field}><label className={s.label}>Múi giờ</label><select className={s.select} value={f.timezone} onChange={(e) => upd({ timezone: e.target.value })}>{TZ.map((t) => <option key={t}>{t}</option>)}</select></div>
                </section>

                <section className={s.card}>
                    <div className={s.cardHead}><h3 className={s.cardTitle}><Icon n="mail" /> Thông báo</h3></div>
                    {NOTI.map(([k, t, d]) => (
                        <div key={k} className={s.prefRow}><div><b>{t}</b><div className={s.cardSub}>{d}</div></div>
                            <Switch label={t} on={f.notification_prefs[k]} onChange={(v) => upd({ notification_prefs: { ...f.notification_prefs, [k]: v } })} /></div>))}
                </section>
            </div>
            {dirty && (
                <div className={s.saveBar}><span>Cài đặt chưa được lưu</span>
                    <div style={{ display: 'flex', gap: 8 }}><button className={s.btn} onClick={() => { setF(data); onApply(data!); }}>Hoàn tác</button>
                        <button className={`${s.btn} ${s.btnP}`} disabled={busy} onClick={save}>{busy ? <Spin /> : <Icon n="check" size={16} />} Lưu cài đặt</button></div></div>)}
        </div>
    );
}