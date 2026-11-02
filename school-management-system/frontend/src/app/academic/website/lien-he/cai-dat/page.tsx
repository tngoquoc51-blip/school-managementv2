'use client';
import { useEffect, useState } from 'react';
import { api } from '@/app/academic/_lib/api';
import { Field, useList, useToast } from '@/app/academic/website/_wm';
import { ST } from '../_lh';

/** Cài đặt: thời hạn phản hồi cam kết và chữ ký chèn vào mẫu trả lời. */
export default function Settings() {
    const { data, err, loading, reload } = useList<any>('website/inbox/settings');
    const [sla, setSla] = useState('24');
    const [sig, setSig] = useState('');
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const toast = useToast();
    useEffect(() => { if (data) { setSla(String(data.sla_hours)); setSig(data.signature || ''); } }, [data]);

    async function save() {
        setBusy(true); setErrs({});
        try { await api('website/inbox/settings', { method: 'PUT', body: { sla_hours: Number(sla), signature: sig } }); toast.ok('Đã lưu cài đặt.'); reload(); } catch (e: any) { setErrs(e.errors || {}); toast.fail(e.message); } finally { setBusy(false); }
    }
    if (err) return <div className="wm-state err">{err} <button className="wm-btn sm" onClick={reload}>Thử lại</button></div>;
    if (loading && !data) return <div className="wm-state">Đang tải…</div>;
    return (
        <>
            {toast.node}
            <div className="lh-cols">
                <section className="wm-card lh-pad">
                    <h2 className="lh-h">Cài đặt chung</h2>
                    <Field label="Thời hạn phản hồi cam kết (giờ)" req err={errs.sla_hours} hint="Tin chưa được trả lời quá thời hạn này sẽ bị gắn nhãn “Quá hạn” và hiện ở màn hình Tổng quan."><input className="wm-in" type="number" min={1} max={168} value={sla} onChange={(e) => setSla(e.target.value)} style={{ maxWidth: 180 }} /></Field>
                    <Field label="Chữ ký chèn kèm mẫu trả lời" err={errs.signature} hint="Dòng cuối mỗi lần chèn mẫu. Ví dụ tên văn phòng, số điện thoại."><textarea className="wm-ta" maxLength={300} value={sig} onChange={(e) => setSig(e.target.value)} /></Field>
                    <button className="wm-btn" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu cài đặt'}</button>
                </section>
                <section className="wm-card lh-pad">
                    <h2 className="lh-h">Quy trình xử lý tin nhắn</h2>
                    <ol className="lh-flow">
                        <li><b>{ST.new}</b><span>Tin vừa gửi từ website. Hệ thống tự gán trạng thái này.</span></li>
                        <li><b>{ST.working}</b><span>Có người nhận việc (tự chuyển khi giao việc cho nhân viên).</span></li>
                        <li><b>{ST.done}</b><span>Đã trả lời xong. Hệ thống ghi lại thời gian phản hồi lần đầu.</span></li>
                        <li><b>{ST.spam}</b><span>Tin quảng cáo, không liên quan. Không tính vào báo cáo.</span></li>
                    </ol>
                    <p className="wm-sub" style={{ marginTop: 12 }}>Mọi thay đổi trạng thái, phân công, ghi chú và trả lời đều lưu lại tên người làm và giờ làm trong Nhật ký xử lý của từng tin.</p>
                </section>
            </div>
        </>
    );
}