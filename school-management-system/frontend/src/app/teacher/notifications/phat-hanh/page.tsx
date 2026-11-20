'use client';
// Phát hành thông báo toàn trường / tới giáo viên (/teacher/notifications/phat-hanh) – chỉ Ban giám hiệu & giáo vụ
import React, { useState } from 'react';
import { Btn, Confirm, Empty, ErrorBox, Field, Ico, KIND, KINDS, Kind, Loading, Pill, Prio, PRIO, Switch, ago, dt, nt, num, useDebounced, useLoad, useTa } from '../_nt';

type P = { id: number; kind: Kind; priority: Prio; title: string; body: string; link: string | null; audience: 'all' | 'teacher'; teacher_name: string | null; sender: string | null; pinned: boolean; status: 'active' | 'revoked'; read_n: number; expires_at: string | null; created_at: string };
type Res = { teachers: number; data: P[] };
const ADMIN = ['academic', 'principal', 'vice_principal', 'super_admin'];
const LINKS: [string, string][] = [['', 'Không đính kèm liên kết'], ['/teacher/schedule', 'Thời khóa biểu'], ['/teacher/attendance', 'Điểm danh'], ['/teacher/notifications/hop-thu', 'Hộp thư']];

export default function Publish() {
    const { staff, toast, refresh } = useTa();
    const isAdmin = ADMIN.includes(staff.role);
    const { data, err, loading, reload } = useLoad(() => (isAdmin ? nt<Res>('published') : Promise.resolve(null as unknown as Res)), [isAdmin]);
    const [kind, setKind] = useState<Kind>('announcement'); const [prio, setPrio] = useState<Prio>('normal'); const [title, setTitle] = useState(''); const [body, setBody] = useState('');
    const [aud, setAud] = useState<'all' | 'teacher'>('all'); const [tq, setTq] = useState(''); const [tid, setTid] = useState<{ id: number; name: string } | null>(null);
    const [link, setLink] = useState(''); const [pinned, setPinned] = useState(false); const [exp, setExp] = useState('');
    const [busy, setBusy] = useState(false); const [errM, setErrM] = useState(''); const [rev, setRev] = useState<P | null>(null);
    const q = useDebounced(tq, 300);
    const ts = useLoad(() => (isAdmin && aud === 'teacher' && !tid ? nt<{ data: { id: number; name: string }[] }>(`teachers?q=${encodeURIComponent(q)}`) : Promise.resolve({ data: [] })), [aud, q, tid, isAdmin]);

    if (!isAdmin) return <div className="ta-page"><div className="ta-card"><Empty icon="lock" title="Chỉ dành cho Ban giám hiệu và giáo vụ" text="Tài khoản giáo viên chỉ nhận thông báo. Nếu cần gửi tới học sinh, hãy dùng mục “Gửi học sinh”." /></div></div>;

    const submit = async () => {
        setErrM('');
        if (title.trim().length < 3) { setErrM('Tiêu đề tối thiểu 3 ký tự.'); return; } if (body.trim().length < 3) { setErrM('Hãy nhập nội dung.'); return; } if (aud === 'teacher' && !tid) { setErrM('Hãy chọn giáo viên nhận.'); return; }
        setBusy(true);
        try { await nt('publish', { method: 'POST', body: { kind, priority: prio, title: title.trim(), body: body.trim(), link: link || null, audience: aud, teacher_id: tid?.id ?? null, pinned, expires_at: exp || null } }); toast('Đã phát hành thông báo.'); setTitle(''); setBody(''); setLink(''); setPinned(false); setExp(''); setTid(null); setTq(''); setPrio('normal'); reload(); refresh(); } catch (e) { setErrM((e as Error).message); }
        setBusy(false);
    };
    return (
        <div className="ta-page">
            <div className="ta-card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Phát hành thông báo mới</h3>
                <div className="nt-row2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                    <Field label="Loại"><select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>{KINDS.filter((k) => k !== 'reminder').map((k) => <option key={k} value={k}>{KIND[k].label}</option>)}</select></Field>
                    <Field label="Mức độ"><select value={prio} onChange={(e) => setPrio(e.target.value as Prio)}>{(Object.keys(PRIO) as Prio[]).map((p) => <option key={p} value={p}>{PRIO[p].label}</option>)}</select></Field>
                    <Field label="Người nhận"><select value={aud} onChange={(e) => { setAud(e.target.value as 'all' | 'teacher'); setTid(null); }}><option value="all">Toàn bộ giáo viên{data ? ` (${num(data.teachers)})` : ''}</option><option value="teacher">Một giáo viên</option></select></Field>
                </div>
                {aud === 'teacher' && <Field label="Giáo viên nhận *">{tid ? <div className="nt-row2"><Pill tone="sky" dot>{tid.name}</Pill><Btn size="sm" onClick={() => setTid(null)}>Đổi</Btn></div> : <>
                    <input value={tq} placeholder="Gõ tên giáo viên để tìm…" onChange={(e) => setTq(e.target.value)} />
                    <div className="nt-tpl" style={{ marginTop: 8 }}>{(ts.data?.data || []).map((t) => <button key={t.id} type="button" className="nt-chip" onClick={() => setTid(t)}><Ico n="user" size={13} />{t.name}</button>)}</div></>}</Field>}
                <Field label="Tiêu đề *"><input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Họp hội đồng sư phạm tháng 11" /></Field>
                <Field label={`Nội dung * (${body.length}/5000)`}><textarea rows={5} value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} /></Field>
                <div className="nt-row2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <Field label="Liên kết đến chức năng"><select value={link} onChange={(e) => setLink(e.target.value)}>{LINKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
                    <Field label="Tự hết hạn (không bắt buộc)"><input type="datetime-local" value={exp} onChange={(e) => setExp(e.target.value)} /></Field>
                </div>
                <div className="nt-row2" style={{ marginTop: 6 }}><Switch on={pinned} onChange={setPinned} label="Ghim lên đầu hộp thư" /></div>
                {errM && <p className="ta-ferr">{errM}</p>}
                <div style={{ marginTop: 14 }}><Btn tone="primary" busy={busy} onClick={submit}><Ico n="mega" size={16} />Phát hành</Btn></div>
            </div>
            <div className="ta-card">
                <header><div><h3>Đã phát hành</h3><p>Theo dõi số giáo viên đã đọc và thu hồi khi cần</p></div></header>
                <div style={{ marginTop: 10 }}>{loading && !data ? <Loading /> : err || !data ? <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} /> : data.data.length === 0 ? <Empty icon="mega" title="Chưa phát hành thông báo nào" /> : data.data.map((p) => {
                    const tot = p.audience === 'all' ? data.teachers : 1;
                    return (
                        <div key={p.id} className="nt-sent" style={{ cursor: 'default', opacity: p.status === 'revoked' ? 0.55 : 1 }}>
                            <div><div className="nt-row2"><b>{p.title}</b><Pill tone="sky">{KIND[p.kind]?.label || p.kind}</Pill>{p.priority !== 'normal' && <Pill tone={PRIO[p.priority].tone}>{PRIO[p.priority].label}</Pill>}{p.pinned && <Pill tone="amber">Ghim</Pill>}{p.status === 'revoked' && <Pill tone="slate">Đã thu hồi</Pill>}</div>
                                <small>{p.audience === 'all' ? 'Toàn bộ giáo viên' : p.teacher_name || 'Một giáo viên'} · {p.sender || 'Nhà trường'} · {dt(p.created_at)} ({ago(p.created_at)}){p.expires_at ? ` · hết hạn ${dt(p.expires_at)}` : ''}</small></div>
                            <div style={{ textAlign: 'right', minWidth: 160 }}>{p.status === 'active' && <><small style={{ color: 'var(--mute)' }}>{p.read_n}/{tot} đã đọc</small><div className="nt-prog"><i style={{ width: `${tot ? Math.min(100, (p.read_n / tot) * 100) : 0}%` }} /></div><Btn size="sm" tone="danger" onClick={() => setRev(p)}>Thu hồi</Btn></>}</div>
                        </div>); })}</div>
            </div>
            {rev && <Confirm title="Thu hồi thông báo?" tone="danger" okText="Thu hồi" text={<>“{rev.title}” sẽ biến mất khỏi hộp thư của giáo viên.</>} onClose={() => setRev(null)} onOk={async () => { await nt(`published/${rev.id}/revoke`, { method: 'POST' }); toast('Đã thu hồi thông báo.'); setRev(null); reload(); }} />}
        </div>
    );
}