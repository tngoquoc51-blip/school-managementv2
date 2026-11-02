'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/app/academic/_lib/api';
import { Field, dt, useList, useToast } from '@/app/academic/website/_wm';
import { Av, BASE, Crumb, ST, StPill, ago, span } from '../../_lh';

const EV: Record<string, string> = { reply: 'Đã trả lời', note: 'Ghi chú nội bộ', status: 'Đổi trạng thái', assign: 'Phân công', priority: 'Ưu tiên' };

/** Chi tiết một tin nhắn: nội dung, nhật ký xử lý, soạn trả lời, người gửi và hồ sơ liên quan. */
export default function Detail() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { data: d, err, loading, reload } = useList<any>(`website/inbox/${id}`);
    const staff = useList<any[]>('website/staff');
    const toast = useToast();
    const [tab, setTab] = useState<'reply' | 'note'>('reply');
    const [body, setBody] = useState('');
    const [channel, setChannel] = useState('Điện thoại');
    const [close, setClose] = useState(true);
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    if (err) return <div className="wm-state err">{err} <Link className="wm-btn sm" href={`${BASE}/hop-thu`}>Về hộp thư</Link></div>;
    if (loading || !d) return <div className="wm-state">Đang tải…</div>;
    const m = d.item;
    const patch = async (b: Record<string, any>, ok = 'Đã cập nhật.') => { try { await api(`website/inbox/${id}`, { method: 'PUT', body: b }); toast.ok(ok); reload(); } catch (e: any) { toast.fail(e.message); } };
    const useTpl = (t: any) => { setBody((b) => (b.trim() ? b + '\n\n' : '') + t.body + (d.signature ? `\n\n${d.signature}` : '')); setTab('reply'); };
    const mailto = m.email ? `mailto:${m.email}?subject=${encodeURIComponent('Phản hồi liên hệ: ' + m.topic)}&body=${encodeURIComponent(body)}` : '';

    async function send() {
        setBusy(true); setErrs({});
        try {
            await api(`website/inbox/${id}/events`, { method: 'POST', body: { kind: tab, body, channel, close } });
            toast.ok(tab === 'reply' ? 'Đã ghi nhận trả lời.' : 'Đã thêm ghi chú.'); setBody(''); reload();
        } catch (e: any) { setErrs(e.errors || { body: e.message }); } finally { setBusy(false); }
    }
    async function remove() {
        if (!confirm('Xóa vĩnh viễn tin nhắn này cùng nhật ký xử lý?')) return;
        try { await api(`website/inbox/${id}`, { method: 'DELETE' }); router.replace(`${BASE}/hop-thu`); } catch (e: any) { toast.fail(e.message); }
    }
    const waited = Math.round((Date.now() - new Date(String(m.created_at).replace(' ', 'T')).getTime()) / 60000);
    const answered = m.first_response_at ? Math.round((new Date(String(m.first_response_at).replace(' ', 'T')).getTime() - new Date(String(m.created_at).replace(' ', 'T')).getTime()) / 60000) : null;

    return (
        <>
            {toast.node}
            <Crumb items={[['Hộp thư', `${BASE}/hop-thu`], `Tin của ${m.full_name}`]} />
            <div className="lh-dhead">
                <div className="lh-who"><Av name={m.full_name} /><div><h2>{m.full_name}</h2><span className="wm-sub">Gửi {dt(m.created_at)} · {ago(m.created_at)}</span></div></div>
                <div className="wm-act">
                    {d.prev_id && <Link className="wm-btn ghost sm" href={`${BASE}/hop-thu/${d.prev_id}`}>‹ Tin trước</Link>}
                    {d.next_id && <Link className="wm-btn ghost sm" href={`${BASE}/hop-thu/${d.next_id}`}>Tin sau ›</Link>}
                    <Link className="wm-btn ghost sm" href={`${BASE}/hop-thu`}>Về hộp thư</Link>
                </div>
            </div>

            <div className="lh-ctl">
                <Field label="Trạng thái"><select className="wm-sel" value={m.status} onChange={(e) => patch({ status: e.target.value }, 'Đã đổi trạng thái.')}>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                <Field label="Người phụ trách"><select className="wm-sel" value={m.assigned_to || ''} onChange={(e) => patch({ assigned_to: e.target.value }, 'Đã phân công.')}><option value="">Chưa giao</option>{(staff.data ?? []).map((s: any) => <option key={s.username} value={s.username}>{s.full_name}</option>)}</select></Field>
                <Field label="Chủ đề"><select className="wm-sel" value={m.topic} onChange={(e) => patch({ topic: e.target.value }, 'Đã đổi chủ đề.')}>{d.topics.map((t: string) => <option key={t}>{t}</option>)}</select></Field>
                <div className="lh-ctl-b">
                    <button className={`wm-btn sm ${m.priority ? '' : 'ghost'}`} onClick={() => patch({ priority: !m.priority }, m.priority ? 'Đã bỏ ưu tiên.' : 'Đã đánh dấu ưu tiên.')}>{m.priority ? '⚑ Ưu tiên cao' : '⚐ Đặt ưu tiên'}</button>
                    <button className={`wm-btn sm ${m.is_starred ? '' : 'ghost'}`} onClick={() => patch({ is_starred: !m.is_starred }, m.is_starred ? 'Đã bỏ sao.' : 'Đã gắn sao.')}>{m.is_starred ? '★ Đã gắn sao' : '☆ Gắn sao'}</button>
                </div>
            </div>

            <div className="lh-dgrid">
                <div>
                    <section className="wm-card lh-pad">
                        <p className="lh-meta"><span className="lh-topic">{m.topic}</span> <StPill s={m.status} overdue={m.overdue} /></p>
                        <p className="lh-msg">{m.message}</p>
                    </section>

                    <section className="wm-card lh-pad">
                        <h2 className="lh-h">Nhật ký xử lý</h2>
                        {d.events.length === 0 ? <p className="wm-sub">Chưa có hoạt động nào. Hãy trả lời hoặc ghi chú bên dưới.</p> : (
                            <ol className="lh-tl">
                                {d.events.map((e: any) => (
                                    <li key={e.id} className={`ev-${e.kind}`}>
                                        <div className="lh-tl-h"><b>{EV[e.kind] ?? e.kind}{e.channel ? ` · ${e.channel}` : ''}</b><span>{e.actor_name} · {dt(e.created_at)}</span></div>
                                        <p>{e.body}</p>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>

                    <section className="wm-card lh-pad">
                        <div className="lh-ctabs">
                            <button className={tab === 'reply' ? 'on' : ''} onClick={() => setTab('reply')}>Trả lời người gửi</button>
                            <button className={tab === 'note' ? 'on' : ''} onClick={() => setTab('note')}>Ghi chú nội bộ</button>
                        </div>
                        {tab === 'reply' && (
                            <>
                                <p className="wm-sub" style={{ marginBottom: 10 }}>Nhà trường trả lời qua kênh bên ngoài (gọi điện, email, Zalo). Ghi lại nội dung ở đây để cả nhóm cùng theo dõi.</p>
                                <div className="lh-tpls">{d.templates.map((t: any) => <button key={t.id} className="wm-chip" onClick={() => useTpl(t)} title={t.body}>{t.title}</button>)}{d.templates.length === 0 && <span className="wm-sub">Chưa có mẫu trả lời. Tạo ở mục “Mẫu trả lời”.</span>}</div>
                                <Field label="Kênh đã dùng" req err={errs.channel}><select className="wm-sel" value={channel} onChange={(e) => setChannel(e.target.value)}>{d.channels.map((c: string) => <option key={c}>{c}</option>)}</select></Field>
                            </>
                        )}
                        <Field label={tab === 'reply' ? 'Nội dung trả lời' : 'Nội dung ghi chú'} req err={errs.body}><textarea className="wm-ta" style={{ minHeight: 140 }} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder={tab === 'reply' ? 'Nội dung đã nói hoặc sẽ gửi cho người gửi…' : 'Chỉ nhân viên nhà trường thấy ghi chú này.'} /></Field>
                        {tab === 'reply' && <label className="wm-chk"><input type="checkbox" checked={close} onChange={(e) => setClose(e.target.checked)} />Đánh dấu đã xử lý xong (chuyển sang “Đã trả lời”)</label>}
                        <div className="wm-act">
                            <button className="wm-btn" disabled={busy || body.trim().length < 3} onClick={send}>{busy ? 'Đang lưu…' : tab === 'reply' ? 'Ghi nhận đã trả lời' : 'Lưu ghi chú'}</button>
                            {tab === 'reply' && mailto && <a className="wm-btn ghost" href={mailto}>Mở email để gửi</a>}
                            {tab === 'reply' && m.phone && <a className="wm-btn ghost" href={`tel:${m.phone}`}>Gọi {m.phone}</a>}
                        </div>
                    </section>
                </div>

                <aside>
                    <section className="wm-card lh-pad">
                        <h2 className="lh-h">Người gửi</h2>
                        <dl className="wm-dl">
                            <dt>Họ tên</dt><dd>{m.full_name}</dd>
                            <dt>Điện thoại</dt><dd>{m.phone ? <a href={`tel:${m.phone}`}>{m.phone}</a> : 'Không có'}</dd>
                            <dt>Email</dt><dd>{m.email ? <a href={`mailto:${m.email}`}>{m.email}</a> : 'Không có'}</dd>
                        </dl>
                    </section>
                    <section className="wm-card lh-pad">
                        <h2 className="lh-h">Thời gian phản hồi</h2>
                        <dl className="wm-dl">
                            <dt>Cam kết</dt><dd>{d.sla_hours} giờ</dd>
                            <dt>Đã chờ</dt><dd>{answered === null ? span(waited) : '—'}</dd>
                            <dt>Trả lời lần đầu</dt><dd>{answered === null ? 'Chưa' : span(answered)}</dd>
                            {m.closed_at && <><dt>Đóng lúc</dt><dd>{dt(m.closed_at)}</dd></>}
                        </dl>
                        {m.overdue && <p className="wm-warn" style={{ marginTop: 10 }}>Tin này đã quá hạn phản hồi cam kết.</p>}
                    </section>
                    {d.admissions.length > 0 && (
                        <section className="wm-card lh-pad">
                            <h2 className="lh-h">Hồ sơ tuyển sinh cùng số điện thoại</h2>
                            {d.admissions.map((a: any) => <p key={a.id} className="lh-rel"><Link href="/academic/website/tuyen-sinh"><b>{a.code}</b> · {a.full_name}</Link><span className="wm-sub">Đăng ký {dt(a.created_at)}</span></p>)}
                        </section>
                    )}
                    {d.same_sender.length > 0 && (
                        <section className="wm-card lh-pad">
                            <h2 className="lh-h">Tin khác của người này</h2>
                            {d.same_sender.map((s: any) => <p key={s.id} className="lh-rel"><Link href={`${BASE}/hop-thu/${s.id}`}>{s.topic} · <StPill s={s.status} /></Link><span className="wm-sub">{s.message.slice(0, 70)}{s.message.length > 70 ? '…' : ''} · {ago(s.created_at)}</span></p>)}
                        </section>
                    )}
                    <button className="wm-btn danger" style={{ width: '100%' }} onClick={remove}>Xóa tin nhắn này</button>
                </aside>
            </div>
        </>
    );
}