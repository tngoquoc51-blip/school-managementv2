'use client';

import { useEffect, useMemo, useState } from 'react';
import { Prefs, SettingsApi } from '../api';
import { Card, Field, Skeleton, Switch, useToast } from '../ui';
import SaveFooter from './SaveFooter';

export default function PreferencesPanel({ onSaved }: { onSaved: () => void }) {
    const toast = useToast();
    const [saved, setSaved] = useState<Prefs | null>(null);
    const [p, setP] = useState<Prefs | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        SettingsApi.prefs().then(({ data }) => { setSaved(data); setP(data); })
            .catch((e) => toast('error', 'Không tải được tùy chọn', e.message));
    }, [toast]);

    const dirty = useMemo(() => !!p && !!saved && JSON.stringify(p) !== JSON.stringify(saved), [p, saved]);
    if (!p) return <Card title="Thông báo & giao diện"><Skeleton /></Card>;

    const flag = (k: keyof Prefs) => !!Number(p[k]);
    const setFlag = (k: keyof Prefs) => (v: boolean) => setP({ ...p, [k]: v ? 1 : 0 });

    const save = async () => {
        setBusy(true);
        try {
            const body = { ...p, digest_time: String(p.digest_time).slice(0, 5), overdue_after_days: Number(p.overdue_after_days) };
            const r: any = await SettingsApi.savePrefs(body as any);
            setSaved(r.data); setP(r.data); toast('success', r.message); onSaved();
        } catch (e) { toast('error', 'Chưa lưu được', (e as Error).message); }
        finally { setBusy(false); }
    };

    return (
        <>
            <Card title="Thông báo của tôi" desc="Chọn sự kiện bạn muốn được báo trong chuông thông báo của cổng Kế toán.">
                <div className="acs-pad">
                    <Switch checked={flag('notify_new_payment')} onChange={setFlag('notify_new_payment')} title="Có khoản thanh toán mới chờ xác nhận" desc="Phụ huynh/học sinh vừa gửi thanh toán cần kế toán đối soát" />
                    <Switch checked={flag('notify_overdue')} onChange={setFlag('notify_overdue')} title="Hóa đơn quá hạn" desc="Báo khi có hóa đơn qua hạn nộp mà chưa thanh toán" />
                    <Switch checked={flag('notify_dispute')} onChange={setFlag('notify_dispute')} title="Khiếu nại hóa đơn" desc="Có phụ huynh gửi khiếu nại về số tiền hoặc khoản thu" />
                    <Switch checked={flag('notify_wallet_topup')} onChange={setFlag('notify_wallet_topup')} title="Nạp ví học sinh" desc="Mỗi lần học sinh nạp tiền vào ví (MoMo, VNPay…)" />
                    <Switch checked={flag('daily_digest')} onChange={setFlag('daily_digest')} title="Tóm tắt hằng ngày" desc="Một bản tổng hợp thu – nợ gửi vào giờ bạn chọn" />
                    <div className="acs-grid" style={{ marginTop: 14 }}>
                        <Field label="Giờ nhận tóm tắt"><input type="time" disabled={!flag('daily_digest')} value={String(p.digest_time).slice(0, 5)} onChange={(e) => setP({ ...p, digest_time: e.target.value })} /></Field>
                        <Field label="Coi là quá hạn sau (ngày)" hint="Dùng để lọc cảnh báo nợ"><input type="number" min={1} max={30} value={p.overdue_after_days} onChange={(e) => setP({ ...p, overdue_after_days: Number(e.target.value) })} /></Field>
                    </div>
                </div>
            </Card>

            <Card title="Giao diện & trang mở đầu" footer={<SaveFooter dirty={dirty} busy={busy} onSave={save} onReset={() => setP(saved)} />}>
                <div className="acs-pad acs-grid">
                    <Field label="Mật độ hiển thị bảng">
                        <select value={p.density} onChange={(e) => setP({ ...p, density: e.target.value })}>
                            <option value="comfortable">Thoải mái</option><option value="compact">Gọn (nhiều dòng hơn)</option>
                        </select>
                    </Field>
                    <Field label="Trang mở đầu sau khi đăng nhập">
                        <select value={p.landing_page} onChange={(e) => setP({ ...p, landing_page: e.target.value })}>
                            <option value="dashboard">Tổng quan</option><option value="invoices">Hóa đơn</option><option value="payments">Thu phí</option>
                            <option value="debts">Công nợ</option><option value="reports">Báo cáo</option>
                        </select>
                    </Field>
                </div>
            </Card>
        </>
    );
}