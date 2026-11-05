'use client';

import React, { useEffect, useState } from 'react';
import { BASE, Btn, Card, ErrorBox, Field, Ico, Loading, Settings, Switch, copyText, nt, useLoad, useNt } from '../_nt';

export default function SettingsPage() {
    const { canApprove, toast, refresh } = useNt();
    const { data, err, loading, reload } = useLoad(async () => (await nt<Settings>('settings')).data);
    const [f, setF] = useState<Settings | null>(null); const [busy, setBusy] = useState(false);
    useEffect(() => { if (data) setF(data); }, [data]);
    if (loading && !data) return <Loading />;
    if (err && !data) return <ErrorBox msg={err} retry={reload} />;
    if (!f) return null;
    const dirty = JSON.stringify(f) !== JSON.stringify(data);
    const save = async () => {
        setBusy(true);
        try { const r = await nt<Settings>('settings', { method: 'PUT', body: { ...f, require_approval: f.require_approval === '1' } }); toast(r.message || 'Đã lưu.'); refresh(); reload(); } catch (e) { toast((e as Error).message, 'err'); }
        setBusy(false);
    };
    const feed = `${BASE}/public/notices?audience=student&key=<mã học sinh>`;

    return (
        <div className="nt-page">
            <div className="nt-ptitle"><div><h2>Cài đặt thông báo</h2><p>Quy trình duyệt, thời hạn hiển thị và chữ ký mặc định của nhà trường.</p></div>
                <div className="acts"><Btn tone="primary" busy={busy} disabled={!canApprove || !dirty} onClick={save}>Lưu cài đặt</Btn></div></div>
            {!canApprove && <div className="nt-note"><Ico n="lock" size={18} /><div><b>Chỉ xem</b><p>Chỉ Hiệu trưởng hoặc Quản trị mới được đổi cài đặt.</p></div></div>}

            <div className="nt-grid g2">
                <Card title="Quy trình duyệt" sub="Kiểm soát nội dung trước khi tới phụ huynh, học sinh">
                    <Switch on={f.require_approval === '1'} disabled={!canApprove} onChange={(v) => setF({ ...f, require_approval: v ? '1' : '0' })} label="Phó hiệu trưởng cần Hiệu trưởng duyệt" sub="Khi bật, thông báo do Phó hiệu trưởng gửi sẽ ở trạng thái “Chờ duyệt” cho đến khi Hiệu trưởng duyệt. Hiệu trưởng và Quản trị gửi trực tiếp." />
                </Card>
                <Card title="Chữ ký & thời hạn">
                    <Field label="Chữ ký mặc định" hint="Hiện ở bản xem trước và khi bấm “Chèn chữ ký”."><input disabled={!canApprove} value={f.signature} maxLength={80} onChange={(e) => setF({ ...f, signature: e.target.value })} /></Field>
                    <div className="nt-two">
                        <Field label="Hạn hiển thị gợi ý (ngày)" hint="0 = không đặt hạn"><input type="number" min={0} max={365} disabled={!canApprove} value={f.default_expire_days} onChange={(e) => setF({ ...f, default_expire_days: e.target.value })} /></Field>
                        <Field label="Tự thu hồi sau (ngày)" hint="0 = không tự thu hồi. Thông báo ghim được giữ lại."><input type="number" min={0} max={1000} disabled={!canApprove} value={f.auto_archive_days} onChange={(e) => setF({ ...f, auto_archive_days: e.target.value })} /></Field>
                    </div>
                </Card>
            </div>

            <Card title="Liên kết với các cổng khác" sub="Cách thông báo đến tay giáo viên, học sinh, phụ huynh">
                <ol className="nt-steps">
                    <li><b>Các cổng lấy thông báo</b> qua đường dẫn công khai dưới đây. Tham số <code>audience</code> là <code>student</code>, <code>parent</code>, <code>teacher</code> hoặc <code>staff</code>; <code>key</code> là mã học sinh (phụ huynh dùng mã của con), mã giáo viên hoặc tên đăng nhập nhân viên.
                        <div className="nt-code"><code>{feed}</code><Btn size="sm" onClick={async () => toast((await copyText(feed)) ? 'Đã chép đường dẫn.' : 'Không chép được.')}><Ico n="copy" size={14} />Chép</Btn></div></li>
                    <li><b>Học sinh / phụ huynh chỉ nhận đúng thông báo của mình</b>: hệ thống tự lọc theo khối và lớp của học sinh trong năm học hiện tại.</li>
                    <li><b>Ghi nhận đã đọc</b>: cổng gọi <code>POST /api/public/notices/&#123;id&#125;/read</code> khi người dùng mở thông báo (và <code>ack: true</code> nếu họ bấm “Tôi đã đọc”). Số liệu hiện ở Thống kê.</li>
                    <li><b>Thành phần có sẵn</b>: chép file <code>NoticeBell.tsx</code> vào <code>frontend/src/components/</code> và đặt <code>&lt;NoticeBell audience="student" userKey={'{mã học sinh}'} /&gt;</code> vào thanh đầu của cổng. Chuông sẽ hiện số chưa đọc, danh sách và nút xác nhận.</li>
                    <li><b>Hẹn giờ</b> được gửi tự động mỗi khi có người dùng mở hệ thống (không cần cài thêm tác vụ định kỳ).</li>
                </ol>
            </Card>
        </div>
    );
}