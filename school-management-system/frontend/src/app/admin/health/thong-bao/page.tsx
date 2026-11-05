'use client';

import { useState } from 'react';
import { Card, Confirm, Empty, ErrorBox, Field, Loading, Modal, Pill, WriteNote, dt, fromLocalInput, mon, toLocalInput, useLoad, useMon } from '../_hl';

const LV: Record<string, { label: string; tone: string; icon: string }> = {
    info: { label: 'Thông tin', tone: 'blue', icon: 'i' }, success: { label: 'Tin vui', tone: 'green', icon: '✓' },
    warning: { label: 'Lưu ý', tone: 'amber', icon: '!' }, critical: { label: 'Khẩn cấp', tone: 'red', icon: '⚠' },
};
const AUD: Record<string, string> = { all: 'Tất cả', staff: 'Nhân viên', student: 'Học sinh' };
const ST: Record<string, { label: string; tone: string }> = { live: { label: 'Đang hiển thị', tone: 'green' }, scheduled: { label: 'Đã lên lịch', tone: 'blue' }, ended: { label: 'Đã hết hạn', tone: 'gray' }, off: { label: 'Đang tắt', tone: 'gray' } };
const PRESETS = [
    { t: 'Bảo trì hệ thống', b: 'Hệ thống sẽ tạm ngừng để bảo trì. Vui lòng lưu công việc và đăng nhập lại sau khi hoàn tất.', l: 'warning' },
    { t: 'Nhập điểm học kỳ', b: 'Giáo viên hoàn tất nhập điểm trước hạn quy định của nhà trường.', l: 'info' },
    { t: 'Sự cố đang được xử lý', b: 'Một số chức năng có thể chậm hoặc gián đoạn. Chúng tôi đang khắc phục và sẽ thông báo ngay khi xong.', l: 'critical' },
];
const blank = { title: '', body: '', level: 'info', audience: 'all', starts_at: '', ends_at: '', active: true };

export default function Announcements() {
    const { canWrite, toast } = useMon();
    const { data, err, loading, reload } = useLoad<any[]>('announcements', 60);
    const [f, setF] = useState<any>(null);
    const [id, setId] = useState<number | null>(null);
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [del, setDel] = useState<any>(null);

    const open = (x?: any) => {
        setErrs({}); setId(x?.id ?? null);
        setF(x ? { title: x.title, body: x.body || '', level: x.level, audience: x.audience, starts_at: toLocalInput(x.starts_at), ends_at: toLocalInput(x.ends_at), active: !!x.active } : { ...blank });
    };
    const save = async () => {
        const body = { ...f, starts_at: fromLocalInput(f.starts_at), ends_at: fromLocalInput(f.ends_at) };
        try { await mon(id ? `announcements/${id}` : 'announcements', { method: id ? 'PUT' : 'POST', body }); toast('Đã lưu thông báo.'); setF(null); reload(); }
        catch (e: any) { setErrs(e.errors || {}); toast(e.message, 'err'); }
    };
    const toggle = async (x: any) => { try { const r: any = await mon(`announcements/${x.id}/toggle`, { method: 'POST' }); toast(r.message); reload(); } catch (e: any) { toast(e.message, 'err'); } };

    if (loading && !data) return <Loading rows={4} />;
    if (err && !data) return <ErrorBox msg={err} retry={reload} />;

    return (
        <div className="hl-stack">
            <WriteNote />
            <div className="hl-bar"><p className="hl-p m0">Thông báo hiển thị thành banner trên các cổng (cần gắn <code>SystemBanner</code> vào layout – xem hướng dẫn).</p>
                {canWrite && <button className="hl-btn primary" onClick={() => open()}>＋ Tạo thông báo</button>}</div>

            {!data!.length ? <Card><Empty icon="📢" title="Chưa có thông báo hệ thống" text="Dùng để báo lịch bảo trì, sự cố hoặc tin quan trọng tới toàn trường." /></Card> : (
                <div className="hl-annlist">{data!.map((x) => (
                    <article key={x.id} className={`hl-ann lv-${x.level}${x.state === 'off' || x.state === 'ended' ? ' dim' : ''}`}>
                        <span className="ic">{LV[x.level].icon}</span>
                        <div className="bd"><div className="hd"><b>{x.title}</b><Pill tone={ST[x.state].tone} dot>{ST[x.state].label}</Pill></div>
                            {x.body && <p>{x.body}</p>}
                            <small>{LV[x.level].label} · Gửi tới: {AUD[x.audience]} · {dt(x.starts_at)} → {x.ends_at ? dt(x.ends_at) : 'không giới hạn'} · bởi {x.created_by}</small></div>
                        {canWrite && <div className="ac"><button className="hl-btn sm" onClick={() => toggle(x)}>{x.active ? 'Tắt' : 'Bật'}</button><button className="hl-btn sm" onClick={() => open(x)}>Sửa</button><button className="hl-btn sm danger-o" onClick={() => setDel(x)}>Xóa</button></div>}
                    </article>))}</div>
            )}

            {f && (
                <Modal wide title={id ? 'Sửa thông báo' : 'Tạo thông báo hệ thống'} onClose={() => setF(null)} foot={<><button className="hl-btn" onClick={() => setF(null)}>Hủy</button><button className="hl-btn primary" onClick={save}>Lưu thông báo</button></>}>
                    {!id && <div className="hl-presets">{PRESETS.map((p) => <button key={p.t} className="hl-chip" onClick={() => setF({ ...f, title: p.t, body: p.b, level: p.l })}>{p.t}</button>)}</div>}
                    <Field label="Tiêu đề *" error={errs.title}><input className="hl-in" value={f.title} maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
                    <Field label="Nội dung" error={errs.body} hint={`${f.body.length}/600`}><textarea className="hl-in" rows={3} maxLength={600} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
                    <div className="hl-cols">
                        <Field label="Mức độ" error={errs.level}><select className="hl-in" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>{Object.entries(LV).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
                        <Field label="Gửi tới" error={errs.audience}><select className="hl-in" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>{Object.entries(AUD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                        <Field label="Bắt đầu" error={errs.starts_at} hint="Để trống = ngay bây giờ"><input className="hl-in" type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} /></Field>
                        <Field label="Kết thúc" error={errs.ends_at} hint="Để trống = không giới hạn"><input className="hl-in" type="datetime-local" value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} /></Field>
                    </div>
                    <label className="hl-check"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Bật hiển thị</label>
                    <div className="hl-prev"><small>Xem trước</small><div className={`hl-ann lv-${f.level}`}><span className="ic">{LV[f.level].icon}</span><div className="bd"><div className="hd"><b>{f.title || 'Tiêu đề thông báo'}</b></div>{f.body && <p>{f.body}</p>}</div></div></div>
                </Modal>
            )}
            {del && <Confirm danger title="Xóa thông báo?" okText="Xóa" text={<>Xóa vĩnh viễn thông báo “{del.title}”?</>} onClose={() => setDel(null)}
                             onOk={async () => { try { const r: any = await mon(`announcements/${del.id}`, { method: 'DELETE' }); toast(r.message); setDel(null); reload(); } catch (e: any) { toast(e.message, 'err'); } }} />}
        </div>
    );
}