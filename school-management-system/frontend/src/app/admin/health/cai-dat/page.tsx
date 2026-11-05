'use client';

import { useEffect, useState } from 'react';
import { Card, ErrorBox, Field, Loading, WriteNote, mon, useLoad, useMon } from '../_hl';

const F: { k: string; label: string; hint: string; unit: string }[] = [
    { k: 'slow_ms', label: 'Ngưỡng “request chậm”', hint: 'Request mất từ mức này trở lên được tính là chậm (100–20000).', unit: 'ms' },
    { k: 'refresh_sec', label: 'Tự làm mới dữ liệu', hint: 'Chu kỳ làm mới trang Tổng quan (10–600).', unit: 'giây' },
    { k: 'retention_requests_days', label: 'Lưu số liệu request', hint: 'Số liệu thô cũ hơn sẽ tự xóa mỗi ngày (1–90).', unit: 'ngày' },
    { k: 'retention_logs_days', label: 'Lưu nhật ký hệ thống', hint: 'Dòng nhật ký cũ hơn sẽ tự xóa mỗi ngày (7–730).', unit: 'ngày' },
];

export default function SettingsPage() {
    const { canWrite, toast } = useMon();
    const { data, err, loading, reload } = useLoad<Record<string, number>>('settings');
    const [v, setV] = useState<Record<string, string>>({});
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    useEffect(() => { if (data) setV(Object.fromEntries(Object.entries(data).map(([k, x]) => [k, String(x)]))); }, [data]);

    if (loading && !data) return <Loading rows={4} />;
    if (err && !data) return <ErrorBox msg={err} retry={reload} />;

    const save = async () => {
        setBusy(true); setErrs({});
        try { await mon('settings', { method: 'PUT', body: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === '' ? null : Number(x)])) }); toast('Đã lưu cài đặt.'); reload(); }
        catch (e: any) { setErrs(e.errors || {}); toast(e.message, 'err'); } finally { setBusy(false); }
    };

    return (
        <div className="hl-stack narrow">
            <WriteNote />
            <Card title="Cài đặt giám sát" sub="Áp dụng cho toàn bộ khu Giám sát hệ thống">
                <div className="hl-form">
                    {F.map((f) => (
                        <Field key={f.k} label={`${f.label} (${f.unit})`} hint={f.hint} error={errs[f.k]}>
                            <input className="hl-in" type="number" disabled={!canWrite} value={v[f.k] ?? ''} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} />
                        </Field>))}
                </div>
                {canWrite && <div className="hl-form-f"><button className="hl-btn primary" onClick={save} disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu cài đặt'}</button></div>}
            </Card>
            <Card title="Ghi chú vận hành">
                <ul className="hl-notes">
                    <li>Dữ liệu giám sát chỉ chứa metadata (route, mã trạng thái, thời gian, IP). <b>Không</b> lưu mật khẩu, token hay nội dung request.</li>
                    <li>Quy tắc cảnh báo và ngưỡng chi tiết chỉnh ở mục <b>Cảnh báo → Quy tắc cảnh báo</b>.</li>
                    <li>Mọi thao tác thay đổi của Quản trị (thu hồi phiên, mở khóa, dọn dữ liệu, sửa cài đặt) đều ghi vào Nhật ký với mức “Bảo mật” hoặc “Thông tin”.</li>
                </ul>
            </Card>
        </div>
    );
}