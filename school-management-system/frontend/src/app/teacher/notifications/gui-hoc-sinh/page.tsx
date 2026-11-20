'use client';
// Gửi thông báo cho học sinh của lớp (/teacher/notifications/gui-hoc-sinh)
import React, { useState } from 'react';
import { Btn, Confirm, Drawer, Empty, ErrorBox, Field, Ico, Loading, Pill, Prio, PRIO, Seg, ago, dt, inHours, nt, num, tomorrowAt, useLoad, useTa } from '../_nt';

type Cls = { id: number; name: string; grade: number; total: number; is_home: boolean };
type Sent = { id: number; class_id: number; class_name: string; title: string; body: string; priority: Prio; status: 'sent' | 'scheduled' | 'cancelled'; send_at: string | null; sent_at: string | null; recipients: number; read_n: number; created_at: string };
type Detail = { data: { id: number; title: string; body: string; status: string; recipients: number; send_at: string | null; sent_at: string | null }; students: { id: number; name: string; code: string; read_at: string | null }[] };
const TPL: [string, string, string][] = [
    ['Nhắc nộp bài', 'Nhắc nộp bài tập', 'Các em nhớ hoàn thành và nộp bài tập đúng hạn. Em nào gặp khó khăn hãy liên hệ thầy/cô trước hạn nộp.'],
    ['Thông báo kiểm tra', 'Thông báo kiểm tra', 'Lớp sẽ có bài kiểm tra vào tiết học tới. Các em ôn lại nội dung đã học và mang theo đầy đủ dụng cụ.'],
    ['Thay đổi lịch học', 'Thay đổi lịch học', 'Tiết học sắp tới có thay đổi về thời gian/phòng học. Các em theo dõi thời khóa biểu và có mặt đúng giờ.'],
    ['Nhắc vắng mặt', 'Nhắc nhở chuyên cần', 'Một số em nghỉ học chưa có lý do. Các em/phụ huynh vui lòng liên hệ giáo viên chủ nhiệm để xác nhận.'],
    ['Khen ngợi', 'Lời khen lớp', 'Cả lớp đã làm rất tốt trong tuần qua. Cô/thầy rất tự hào, các em hãy tiếp tục phát huy nhé!'],
];
const STATUS: Record<string, { l: string; t: string }> = { sent: { l: 'Đã gửi', t: 'green' }, scheduled: { l: 'Hẹn giờ', t: 'sky' }, cancelled: { l: 'Đã hủy', t: 'slate' } };

export default function SendStudents() {
    const { toast, refresh } = useTa();
    const cl = useLoad(() => nt<{ data: Cls[] }>('classes'), []); const hs = useLoad(() => nt<{ data: Sent[] }>('outbox'), []);
    const [cid, setCid] = useState(0); const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [prio, setPrio] = useState<Prio>('normal'); const [mode, setMode] = useState<'now' | 'later'>('now'); const [at, setAt] = useState(tomorrowAt(7));
    const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [view, setView] = useState<number | null>(null); const [cancel, setCancel] = useState<Sent | null>(null);
    const classes = cl.data?.data || []; const cur = classes.find((c) => c.id === (cid || classes[0]?.id)); const classId = cur?.id || 0;
    const send = async () => {
        setErr('');
        if (!classId) { setErr('Hãy chọn lớp nhận thông báo.'); return; } if (title.trim().length < 3) { setErr('Tiêu đề tối thiểu 3 ký tự.'); return; } if (body.trim().length < 3) { setErr('Hãy nhập nội dung thông báo.'); return; }
        setBusy(true);
        try { const r = await nt<{ message: string }>('outbox', { method: 'POST', body: { class_id: classId, title: title.trim(), body: body.trim(), priority: prio, send_at: mode === 'later' ? at : null } }); toast(r.message); setTitle(''); setBody(''); setPrio('normal'); setMode('now'); hs.reload(); refresh(); } catch (e) { setErr((e as Error).message); }
        setBusy(false);
    };
    return (
        <div className="ta-page">
            <div className="nt-comp">
                <div className="ta-card" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Soạn thông báo cho lớp</h3>
                    {cl.loading && !cl.data ? <Loading /> : cl.err ? <ErrorBox msg={cl.err} retry={cl.reload} /> : classes.length === 0 ? <Empty icon="users" title="Bạn chưa được phân công lớp nào" text="Chỉ giáo viên chủ nhiệm hoặc giáo viên bộ môn của lớp mới gửi được thông báo." /> : (<>
                        <Field label="Lớp nhận *"><select value={classId} onChange={(e) => setCid(Number(e.target.value))}>{classes.map((c) => <option key={c.id} value={c.id}>Lớp {c.name} · {c.total} học sinh{c.is_home ? ' · chủ nhiệm' : ''}</option>)}</select></Field>
                        <div className="nt-tpl">{TPL.map(([l, t, b]) => <button key={l} type="button" className="nt-chip" onClick={() => { setTitle(t); setBody(b); }}><Ico n="tpl" size={13} />{l}</button>)}</div>
                        <Field label="Tiêu đề *"><input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Nhắc nộp bài tập chương 3" /></Field>
                        <Field label={`Nội dung * (${body.length}/2000)`}><textarea rows={6} value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} placeholder="Nội dung gửi tới từng học sinh của lớp…" /></Field>
                        <div className="nt-row2"><Field label="Mức độ"><select value={prio} onChange={(e) => setPrio(e.target.value as Prio)}>{(Object.keys(PRIO) as Prio[]).map((p) => <option key={p} value={p}>{PRIO[p].label}</option>)}</select></Field>
                            <Field label="Thời điểm gửi"><Seg value={mode} onChange={(v) => setMode(v as 'now' | 'later')} items={[['now', 'Gửi ngay'], ['later', 'Hẹn giờ']]} /></Field></div>
                        {mode === 'later' && <Field label="Gửi lúc" hint="Tối đa 30 ngày. Thông báo hẹn giờ được gửi khi đến hạn."><input type="datetime-local" value={at} min={inHours(0.02)} onChange={(e) => setAt(e.target.value)} /></Field>}
                        {err && <p className="ta-ferr">{err}</p>}
                        <div className="nt-row2" style={{ marginTop: 14 }}><Btn tone="primary" busy={busy} onClick={send}><Ico n="send" size={16} />{mode === 'now' ? `Gửi cho ${cur ? num(cur.total) : 0} học sinh` : 'Hẹn giờ gửi'}</Btn><Btn onClick={() => { setTitle(''); setBody(''); setErr(''); }}>Xóa nội dung</Btn></div>
                    </>)}
                </div>
                <div>
                    <div className="nt-phone"><div className="st"><span>Học sinh · {cur ? `Lớp ${cur.name}` : ''}</span><span>{new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span></div>
                        <div className={`nt-bub p-${prio}`}><small>{prio !== 'normal' ? PRIO[prio].label.toUpperCase() + ' · ' : ''}Thông báo từ giáo viên</small><h4>{title || 'Tiêu đề thông báo'}</h4><p>{body || 'Nội dung thông báo sẽ hiển thị như thế này trên màn hình học sinh.'}</p></div></div>
                    <p className="ta-mute" style={{ textAlign: 'center', marginTop: 10 }}>Xem trước hiển thị cho học sinh</p>
                </div>
            </div>
            <div className="ta-card">
                <header><div><h3>Lịch sử đã gửi</h3><p>Bấm vào một thông báo để xem học sinh nào đã đọc</p></div></header>
                <div style={{ marginTop: 10 }}>{hs.loading && !hs.data ? <Loading /> : hs.err || !hs.data ? <ErrorBox msg={hs.err || 'Không có dữ liệu'} retry={hs.reload} /> : hs.data.data.length === 0 ? <Empty icon="send" title="Chưa gửi thông báo nào" /> : hs.data.data.map((s) => (
                    <div key={s.id} className="nt-sent" onClick={() => setView(s.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setView(s.id); }}>
                        <div><div className="nt-row2"><b>{s.title}</b><Pill tone={STATUS[s.status].t} dot>{STATUS[s.status].l}</Pill>{s.priority !== 'normal' && <Pill tone={PRIO[s.priority].tone}>{PRIO[s.priority].label}</Pill>}</div>
                            <small>Lớp {s.class_name} · {s.status === 'scheduled' ? `gửi lúc ${dt(s.send_at)}` : s.status === 'sent' ? `${dt(s.sent_at)} (${ago(s.sent_at)})` : 'đã hủy'}</small></div>
                        <div style={{ textAlign: 'right', minWidth: 150 }}>{s.status === 'sent' ? <><small style={{ color: 'var(--mute)' }}>{s.read_n}/{s.recipients} đã đọc</small><div className="nt-prog"><i style={{ width: `${s.recipients ? (s.read_n / s.recipients) * 100 : 0}%` }} /></div></> : s.status === 'scheduled' ? <Btn size="sm" tone="danger" onClick={(e) => { e.stopPropagation(); setCancel(s); }}>Hủy hẹn giờ</Btn> : null}</div>
                    </div>))}</div>
            </div>
            {view !== null && <DetailDrawer id={view} onClose={() => setView(null)} />}
            {cancel && <Confirm title="Hủy thông báo hẹn giờ?" tone="danger" okText="Hủy hẹn giờ" text={<>Thông báo “{cancel.title}” sẽ không được gửi.</>} onClose={() => setCancel(null)} onOk={async () => { await nt(`outbox/${cancel.id}/cancel`, { method: 'POST' }); toast('Đã hủy thông báo hẹn giờ.'); setCancel(null); hs.reload(); }} />}
        </div>
    );
}

function DetailDrawer({ id, onClose }: { id: number; onClose: () => void }) {
    const { data, err, loading, reload } = useLoad(() => nt<Detail>(`outbox/${id}`), [id]);
    const read = data?.students.filter((s) => s.read_at).length || 0;
    return (
        <Drawer title="Chi tiết thông báo đã gửi" onClose={onClose}>
            {loading && !data ? <Loading /> : err || !data ? <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} /> : (<>
                <h3 style={{ fontSize: 17, fontWeight: 800 }}>{data.data.title}</h3><p style={{ margin: '8px 0 14px', whiteSpace: 'pre-wrap' }}>{data.data.body}</p>
                <div className="nt-prog" style={{ marginBottom: 6 }}><i style={{ width: `${data.students.length ? (read / data.students.length) * 100 : 0}%` }} /></div>
                <p className="ta-mute" style={{ marginBottom: 12 }}>{read}/{data.students.length} học sinh đã đọc · chưa đọc hiển thị trước</p>
                <div className="ta-tablewrap"><table className="ta-tbl"><thead><tr><th>Học sinh</th><th>Mã</th><th>Trạng thái</th></tr></thead><tbody>{data.students.map((s) => <tr key={s.id}><td><b>{s.name}</b></td><td>{s.code}</td><td>{s.read_at ? <Pill tone="green" dot>Đã đọc {ago(s.read_at)}</Pill> : <Pill tone="slate">Chưa đọc</Pill>}</td></tr>)}</tbody></table></div>
            </>)}
        </Drawer>
    );
}