'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { Btn, Card, Empty, ErrorBox, Field, Ico, Loading, Pager, Settings, Switch, ca, dt, useCa, useLoad } from '../_ca';

type Hist = { id: number; kind: string; summary: string; actor_name: string; created_at: string };
const KIND: Record<string, string> = { mark: 'Điểm danh', leave: 'Đơn nghỉ', case: 'Hồ sơ', setting: 'Cài đặt' };

export default function Config() {
    const { canApprove, toast, refresh } = useCa();
    const { data, err, loading, reload } = useLoad(async () => (await ca<Settings>('settings')).data);
    const [f, setF] = useState<Settings | null>(null); const [busy, setBusy] = useState(false); const [page, setPage] = useState(1);
    useEffect(() => { if (data) setF(data); }, [data]);
    const hist = useLoad(() => ca<Hist[]>(`history?page=${page}`), [page]);

    const set = (k: keyof Settings, v: string) => setF((x) => (x ? { ...x, [k]: v } : x));
    const save = async () => {
        if (!f) return; setBusy(true);
        try { const r = await ca<Settings>('settings', { method: 'PUT', body: { ...f, late_counts_present: f.late_counts_present === '1' } }); toast(r.message || 'Đã lưu.'); reload(); hist.reload(); refresh(); }
        catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
    };
    if (loading && !data) return <Loading />;
    if (err && !data) return <ErrorBox msg={err} retry={reload} />;
    if (!f) return null;
    const ro = !canApprove;
    const num = (k: keyof Settings, label: string, hint: string, min = 0, max = 365) => <Field label={label} hint={hint}><input type="number" min={min} max={max} disabled={ro} value={f[k]} onChange={(e) => set(k, e.target.value)} /></Field>;

    return (
        <div className="ca-page">
            <div className="ca-ptitle"><div><h2>Cài đặt chuyên cần</h2><p>Quy tắc tính tỉ lệ, ngưỡng cảnh báo và thời hạn chỉnh sửa điểm danh.</p></div>
                {!ro && <div className="acts"><Btn tone="primary" busy={busy} onClick={save}><Ico n="save" size={16} />Lưu cài đặt</Btn></div>}</div>
            {ro && <div className="ca-note"><Ico n="lock" size={18} /><div><b>Chỉ xem</b><p>Chỉ Hiệu trưởng hoặc Quản trị mới đổi được cài đặt.</p></div></div>}

            <div className="ca-grid g2">
                <Card title="Ngưỡng cảnh báo" sub="Học sinh vượt một trong các ngưỡng sẽ xuất hiện ở mục Cảnh báo">
                    <div className="ca-two">{num('alert_absent', 'Nghỉ từ (buổi)', 'Tổng số buổi vắng trong khoảng xem', 1, 60)}{num('alert_streak', 'Nghỉ liên tiếp từ (buổi)', 'Vắng nhiều buổi liền nhau', 1, 30)}</div>
                    <div className="ca-two">{num('alert_late', 'Đi muộn từ (lần)', 'Số lần đi muộn trong khoảng xem', 1, 60)}<div /></div>
                </Card>
                <Card title="Mức đánh giá tỉ lệ" sub="Quyết định màu hiển thị xanh / vàng / đỏ">
                    <div className="ca-two">{num('good_rate', 'Tốt từ (%)', 'Màu xanh', 50, 100)}{num('warn_rate', 'Cần chú ý dưới (%)', 'Dưới mức này hiện màu đỏ', 0, 100)}</div>
                    <Switch on={f.late_counts_present === '1'} disabled={ro} onChange={(v) => set('late_counts_present', v ? '1' : '0')} label="Đi muộn vẫn tính là đi học" sub="Tỉ lệ = (có mặt + đi muộn) / tổng lượt. Tắt đi thì chỉ tính “có mặt”." />
                </Card>
            </div>
            <Card title="Khóa chỉnh sửa" sub="Hạn chế sửa số liệu cũ để báo cáo không bị thay đổi">
                <div className="ca-two">{num('lock_days', 'Phó hiệu trưởng chỉ sửa trong (ngày)', 'Nhập 0 nếu không muốn khóa. Hiệu trưởng và Quản trị luôn sửa được.', 0, 365)}<div /></div>
            </Card>

            <div className="ca-grid g2">
                <Card title="Liên kết với phần khác" pad={false}>
                    <div className="ca-linklist">
                        <Link href="/bgh/notices/soan"><Ico n="mega" size={18} /><div><b>Thông báo cho phụ huynh</b><small>Soạn thông báo nhắc nhở học sinh nghỉ nhiều.</small></div><Ico n="chevR" size={14} /></Link>
                        <Link href="/bgh/notices"><Ico n="bell" size={18} /><div><b>Trung tâm thông báo</b><small>Theo dõi ai đã đọc thông báo.</small></div><Ico n="chevR" size={14} /></Link>
                    </div>
                </Card>
                <Card title="Cách tính" sub="Để các con số thống nhất giữa mọi báo cáo">
                    <ol className="ca-steps"><li>Mỗi học sinh có <b>một trạng thái mỗi ngày</b>: có mặt, đi muộn, vắng có phép hoặc vắng không phép.</li><li>Đơn nghỉ đã duyệt tự chuyển các buổi “vắng không phép” thành “vắng có phép”.</li><li>Cảnh báo được tính tự động từ dữ liệu, không cần nhập tay.</li></ol>
                </Card>
            </div>

            <Card title="Nhật ký thay đổi" sub="Ai điểm danh, sửa đơn nghỉ, đổi cài đặt" pad={false}>
                {hist.loading && !hist.data ? <Loading /> : (hist.data?.data.length ?? 0) === 0 ? <Empty icon="list" title="Chưa có thao tác nào" /> : (
                    <div className="ca-tablewrap"><table className="ca-tbl"><thead><tr><th>Thời gian</th><th>Loại</th><th>Nội dung</th><th>Người làm</th></tr></thead>
                        <tbody>{hist.data!.data.map((h) => <tr key={h.id}><td className="ca-time">{dt(h.created_at)}</td><td><span className="ca-mini">{KIND[h.kind] ?? h.kind}</span></td><td>{h.summary}</td><td>{h.actor_name}</td></tr>)}</tbody></table></div>
                )}
                {hist.data?.meta && (hist.data.data.length > 0) && <Pager page={hist.data.meta.page} pages={hist.data.meta.pages} total={hist.data.meta.total} onPage={setPage} />}
            </Card>
        </div>
    );
}