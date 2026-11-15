'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ApiError, Audience, Btn, CAT_ICON, CAT_TONE, Card, Confirm, Empty, Field, Ico, Link as NLink, Loading, Modal, Notice, PRIORITY, Pill, Switch, addDaysInput, dt,
    fromLocalInput, nt, num, toLocalInput, useDebounced, useNt,
} from '../_nt';

type Tpl = { id: number; name: string; category: string; category_label: string; priority: string; title: string; body: string; uses: number };
type Form = {
    title: string; body: string; category: string; priority: 'normal' | 'high' | 'urgent';
    to_teachers: boolean; to_students: boolean; to_parents: boolean; to_staff: boolean; grades: number[]; class_ids: number[];
    pinned: boolean; require_ack: boolean; links: NLink[]; mode: 'now' | 'later'; scheduled: string; expiry: 'none' | 'custom'; expires: string;
};
const EMPTY: Form = {
    title: '', body: '', category: 'general', priority: 'normal', to_teachers: false, to_students: false, to_parents: false, to_staff: false, grades: [], class_ids: [],
    pinned: false, require_ack: false, links: [], mode: 'now', scheduled: '', expiry: 'none', expires: '',
};
const PRESETS: { label: string; icon: string; v: Partial<Form> }[] = [
    { label: 'Toàn trường', icon: 'users', v: { to_teachers: true, to_students: true, to_parents: true, to_staff: true } },
    { label: 'Học sinh & phụ huynh', icon: 'book', v: { to_teachers: false, to_students: true, to_parents: true, to_staff: false } },
    { label: 'Giáo viên', icon: 'pen', v: { to_teachers: true, to_students: false, to_parents: false, to_staff: false, grades: [], class_ids: [] } },
    { label: 'Giáo viên & nhân viên', icon: 'shield', v: { to_teachers: true, to_students: false, to_parents: false, to_staff: true, grades: [], class_ids: [] } },
];

export default function Compose() {
    const { meta, toast, refresh, staff } = useNt();
    const router = useRouter();
    const [f, setF] = useState<Form>(EMPTY);
    const [editId, setEditId] = useState<number | null>(null);
    const [orig, setOrig] = useState<Notice | null>(null);
    const [loading, setLoading] = useState(true);
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState<'draft' | 'send' | null>(null);
    const [confirm, setConfirm] = useState(false);
    const [tplOpen, setTplOpen] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [aud, setAud] = useState<Audience | null>(null);

    const set = useCallback(<K extends keyof Form>(k: K, v: Form[K]) => { setF((p) => ({ ...p, [k]: v })); setDirty(true); setErrs((e) => { if (!(k in e)) return e; const c = { ...e }; delete c[k as string]; return c; }); }, []);

    // ---- nạp bản sửa / mẫu từ địa chỉ ----
    useEffect(() => {
        const sp = new URLSearchParams(window.location.search);
        const id = Number(sp.get('id') || 0), tpl = Number(sp.get('tpl') || 0);
        (async () => {
            try {
                if (id) {
                    const n = (await nt<{ notice: Notice }>(`${id}`)).data.notice;
                    setOrig(n); setEditId(n.id);
                    setF({
                        title: n.title, body: n.body || '', category: n.category, priority: n.priority, to_teachers: !!n.to_teachers, to_students: !!n.to_students, to_parents: !!n.to_parents, to_staff: !!n.to_staff,
                        grades: n.grades, class_ids: n.class_ids, pinned: !!n.pinned, require_ack: !!n.require_ack, links: n.links || [],
                        mode: n.scheduled_at ? 'later' : 'now', scheduled: toLocalInput(n.scheduled_at), expiry: n.expires_at ? 'custom' : 'none', expires: toLocalInput(n.expires_at),
                    });
                } else if (tpl) {
                    const t = (await nt<Tpl[]>('templates')).data.find((x) => x.id === tpl);
                    if (t) { applyTpl(t); }
                }
            } catch (e) { toast((e as Error).message, 'err'); }
            setLoading(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!dirty) return;
        const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', h);
        return () => window.removeEventListener('beforeunload', h);
    }, [dirty]);

    const applyTpl = (t: Tpl) => {
        setF((p) => ({ ...p, title: t.title, body: t.body, category: t.category, priority: t.priority as Form['priority'] }));
        setDirty(true);
        nt(`templates/${t.id}/use`, { method: 'POST' }).catch(() => { /* bỏ qua */ });
    };

    // ---- số người nhận (cập nhật trực tiếp) ----
    const key = useDebounced(JSON.stringify([f.to_teachers, f.to_students, f.to_parents, f.to_staff, f.grades, f.class_ids]), 300);
    useEffect(() => {
        const [t, s, p, st, g, c] = JSON.parse(key) as [boolean, boolean, boolean, boolean, number[], number[]];
        if (!(t || s || p || st)) { setAud(null); return; }
        nt<Audience>('audience', { method: 'POST', body: { to_teachers: t, to_students: s, to_parents: p, to_staff: st, grades: g, class_ids: c } }).then((r) => setAud(r.data)).catch(() => setAud(null));
    }, [key]);

    const classesByGrade = useMemo(() => {
        const m = new Map<number, { id: number; name: string; students: number }[]>();
        (meta?.classes ?? []).forEach((c) => { if (!m.has(c.grade)) m.set(c.grade, []); m.get(c.grade)!.push(c); });
        return Array.from(m.entries()).sort((a, b) => a[0] - b[0]);
    }, [meta]);

    const needsApproval = meta?.settings.require_approval === '1' && staff.role === 'vice_principal';
    const later = f.mode === 'later' && !!f.scheduled;
    const sendLabel = needsApproval ? 'Gửi chờ duyệt' : later ? 'Hẹn giờ gửi' : 'Gửi ngay';

    const payload = (action: 'draft' | 'send') => ({
        title: f.title.trim(), body: f.body.trim(), category: f.category, priority: f.priority,
        to_teachers: f.to_teachers, to_students: f.to_students, to_parents: f.to_parents, to_staff: f.to_staff,
        grades: f.to_students || f.to_parents ? f.grades : [], class_ids: f.to_students || f.to_parents ? f.class_ids : [],
        pinned: f.pinned, require_ack: f.require_ack, links: f.links.filter((l) => l.url.trim()),
        scheduled_at: f.mode === 'later' ? fromLocalInput(f.scheduled) : null, expires_at: f.expiry === 'custom' ? fromLocalInput(f.expires) : null, action,
    });

    const validate = (forSend: boolean) => {
        const e: Record<string, string> = {};
        if (f.title.trim().length < 3) e.title = 'Tiêu đề cần ít nhất 3 ký tự.';
        if (forSend && f.body.trim().length < 5) e.body = 'Nội dung cần ít nhất 5 ký tự.';
        if (!forSend && !f.body.trim()) e.body = 'Nhập nội dung trước khi lưu nháp.';
        if (forSend && !(f.to_teachers || f.to_students || f.to_parents || f.to_staff)) e.audience = 'Hãy chọn ít nhất một nhóm người nhận.';
        if (f.mode === 'later') {
            if (!f.scheduled) e.scheduled = 'Chọn thời điểm gửi.';
            else if (new Date(f.scheduled).getTime() < Date.now() + 60000) e.scheduled = 'Thời điểm gửi phải ở tương lai (ít nhất 1 phút).';
        }
        if (f.expiry === 'custom') {
            if (!f.expires) e.expires = 'Chọn thời điểm hết hạn.';
            else if (new Date(f.expires).getTime() <= (f.mode === 'later' && f.scheduled ? new Date(f.scheduled).getTime() : Date.now())) e.expires_at = 'Thời điểm hết hạn phải sau thời điểm gửi.';
        }
        if (f.links.some((l) => l.url.trim() && !/^https?:\/\//i.test(l.url.trim()))) e.links = 'Liên kết phải bắt đầu bằng http:// hoặc https://';
        setErrs(e);
        return Object.keys(e).length === 0;
    };

    const submit = async (action: 'draft' | 'send') => {
        setBusy(action);
        try {
            const r = editId ? await nt<Notice>(`${editId}`, { method: 'PUT', body: payload(action) }) : await nt<Notice>('', { method: 'POST', body: payload(action) });
            toast(r.message || 'Đã lưu.'); setDirty(false); refresh();
            router.push(`/bgh/notices/danh-sach?open=${r.data.id}`);
        } catch (e) {
            const er = e as ApiError; setErrs(er.errors || {}); toast(er.message, 'err'); setBusy(null); setConfirm(false);
        }
    };
    const onSend = () => { if (validate(true)) setConfirm(true); else toast('Vui lòng kiểm tra lại các mục màu đỏ.', 'err'); };
    const onDraft = () => { if (validate(false)) void submit('draft'); else toast('Cần có tiêu đề và nội dung để lưu nháp.', 'err'); };

    const sig = meta?.settings.signature || 'Ban Giám hiệu';
    const insert = (t: string) => set('body', (f.body ? f.body.replace(/\s+$/, '') + '\n' : '') + t);
    const tg = (arr: number[], v: number) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
    const hasStudents = f.to_students || f.to_parents;
    const locked = orig && !['draft', 'rejected', 'scheduled'].includes(orig.status);

    if (loading) return <Loading />;
    if (locked) return <Empty icon="lock" title="Thông báo này không sửa được" text="Thông báo đã gửi hoặc đang chờ duyệt. Hãy nhân bản để soạn bản mới." action={<Link className="nt-btn primary" href="/bgh/notices/danh-sach">Về danh sách</Link>} />;

    const chips = [{ k: 'to_teachers', l: 'Giáo viên', i: 'pen', s: 'Toàn bộ giáo viên' }, { k: 'to_students', l: 'Học sinh', i: 'book', s: 'Theo khối / lớp' }, { k: 'to_parents', l: 'Phụ huynh', i: 'users', s: 'Theo khối / lớp của con' }, { k: 'to_staff', l: 'Nhân viên', i: 'shield', s: 'Giáo vụ, kế toán…' }] as const;

    return (
        <div className="nt-page nt-compose">
            <div className="nt-ptitle">
                <div><h2>{editId ? `Sửa thông báo ${orig?.code ?? ''}` : 'Soạn thông báo mới'}</h2><p>Điền nội dung, chọn người nhận rồi gửi ngay hoặc hẹn giờ. Bản xem trước hiển thị ngay bên phải.</p></div>
                <div className="acts"><Btn onClick={() => setTplOpen(true)}><Ico n="tpl" size={16} />Dùng mẫu</Btn></div>
            </div>

            {orig?.status === 'rejected' && orig.review_note && <div className="nt-note bad"><Ico n="alert" size={18} /><div><b>Thông báo bị từ chối{orig.approved_by ? ` · ${orig.approved_by}` : ''}</b><p>{orig.review_note}</p></div></div>}

            <div className="nt-cols">
                <div className="nt-form">
                    <Card title="1 · Nội dung">
                        <Field label="Tiêu đề" error={errs.title} hint={`${f.title.length}/150 ký tự`}>
                            <input value={f.title} maxLength={150} onChange={(e) => set('title', e.target.value)} placeholder="VD: Thông báo lịch nghỉ Tết Dương lịch" />
                        </Field>
                        <div className="nt-lab">Danh mục</div>
                        <div className="nt-chips">
                            {(meta?.categories ?? []).map((c) => (
                                <button key={c.key} type="button" className={`nt-chip t-${CAT_TONE[c.key] || 'indigo'}${f.category === c.key ? ' on' : ''}`} onClick={() => set('category', c.key)}><Ico n={CAT_ICON[c.key] || 'bell'} size={15} />{c.label}</button>
                            ))}
                        </div>
                        <div className="nt-lab">Mức độ</div>
                        <div className="nt-seg">
                            {(['normal', 'high', 'urgent'] as const).map((p) => (
                                <button key={p} type="button" className={`${f.priority === p ? 'on ' : ''}p-${p}`} onClick={() => set('priority', p)}>{p === 'urgent' ? '⚡ ' : ''}{PRIORITY[p].label}</button>
                            ))}
                        </div>
                        <Field label="Nội dung" error={errs.body} hint={`${f.body.length}/8000 ký tự`}>
                            <textarea rows={11} value={f.body} maxLength={8000} onChange={(e) => set('body', e.target.value)} placeholder={'Kính gửi quý thầy cô, các em học sinh và quý phụ huynh,\n\n…'} />
                        </Field>
                        <div className="nt-tools">
                            <button type="button" onClick={() => insert('- ')}>• Gạch đầu dòng</button>
                            <button type="button" onClick={() => insert(`Trân trọng cảm ơn.\n\n— ${sig}`)}>✍ Chèn chữ ký</button>
                            <button type="button" onClick={() => insert(`Thời gian: \nĐịa điểm: `)}>🗓 Thời gian · địa điểm</button>
                        </div>
                    </Card>

                    <Card title="2 · Người nhận" right={aud ? <Pill tone="indigo">≈ {num(aud.total)} người nhận</Pill> : undefined}>
                        <div className="nt-presets">{PRESETS.map((p) => <button key={p.label} type="button" onClick={() => { setF((x) => ({ ...x, ...p.v })); setDirty(true); setErrs((e) => { const c = { ...e }; delete c.audience; return c; }); }}><Ico n={p.icon} size={14} />{p.label}</button>)}</div>
                        <div className={`nt-aud${errs.audience ? ' bad' : ''}`}>
                            {chips.map((c) => (
                                <button key={c.k} type="button" className={f[c.k] ? 'on' : ''} onClick={() => set(c.k, !f[c.k])}>
                                    <span className="ic"><Ico n={c.i} size={18} /></span><b>{c.l}</b><small>{c.s}</small>
                                    {f[c.k] && aud && <em>{num({ to_teachers: aud.teachers, to_students: aud.students, to_parents: aud.parents, to_staff: aud.staff }[c.k])}</em>}
                                    <i className="tick"><Ico n="check" size={13} /></i>
                                </button>
                            ))}
                        </div>
                        {errs.audience && <p className="nt-ferr">{errs.audience}</p>}
                        {hasStudents && (
                            <div className="nt-target">
                                <div className="nt-lab">Giới hạn theo khối / lớp <small>(bỏ trống = tất cả)</small></div>
                                <div className="nt-chips sm">
                                    {[10, 11, 12].map((g) => <button key={g} type="button" className={`nt-chip t-indigo${f.grades.includes(g) ? ' on' : ''}`} onClick={() => set('grades', tg(f.grades, g).sort())}>Khối {g}</button>)}
                                    {(f.grades.length > 0 || f.class_ids.length > 0) && <button type="button" className="nt-link" onClick={() => { set('grades', []); set('class_ids', []); }}>Bỏ chọn</button>}
                                </div>
                                {classesByGrade.map(([g, list]) => (
                                    <div key={g} className="nt-clsrow"><span>Khối {g}</span>
                                        <div className="nt-chips sm">{list.map((c) => {
                                            const byGrade = f.grades.includes(g);
                                            return <button key={c.id} type="button" title={`${c.students} học sinh`} className={`nt-chip t-sky${f.class_ids.includes(c.id) || byGrade ? ' on' : ''}${byGrade ? ' auto' : ''}`} onClick={() => !byGrade && set('class_ids', tg(f.class_ids, c.id))}>{c.name}</button>;
                                        })}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card title="3 · Lịch gửi & tùy chọn">
                        <div className="nt-lab">Thời điểm gửi</div>
                        <div className="nt-seg wide">
                            <button type="button" className={f.mode === 'now' ? 'on' : ''} onClick={() => set('mode', 'now')}><Ico n="send" size={14} />Gửi ngay</button>
                            <button type="button" className={f.mode === 'later' ? 'on' : ''} onClick={() => { set('mode', 'later'); if (!f.scheduled) set('scheduled', addDaysInput(0.0417)); }}><Ico n="clock" size={14} />Hẹn giờ gửi</button>
                        </div>
                        {f.mode === 'later' && <Field label="Gửi vào lúc" error={errs.scheduled}><input type="datetime-local" value={f.scheduled} onChange={(e) => set('scheduled', e.target.value)} /></Field>}
                        <div className="nt-lab">Hết hạn hiển thị</div>
                        <div className="nt-seg wide">
                            <button type="button" className={f.expiry === 'none' ? 'on' : ''} onClick={() => set('expiry', 'none')}>Không giới hạn</button>
                            <button type="button" className={f.expiry === 'custom' ? 'on' : ''} onClick={() => { set('expiry', 'custom'); if (!f.expires) set('expires', addDaysInput(Number(meta?.settings.default_expire_days) || 30)); }}>Đặt thời hạn</button>
                        </div>
                        {f.expiry === 'custom' && (
                            <>
                                <Field label="Hết hạn lúc" error={errs.expires || errs.expires_at}><input type="datetime-local" value={f.expires} onChange={(e) => set('expires', e.target.value)} /></Field>
                                <div className="nt-quick">{[1, 7, 14, 30].map((d) => <button key={d} type="button" onClick={() => set('expires', addDaysInput(d))}>+{d} ngày</button>)}</div>
                            </>
                        )}
                        <div className="nt-opts">
                            <Switch on={f.pinned} onChange={(v) => set('pinned', v)} label="Ghim lên đầu" sub="Luôn nằm trên cùng trong danh sách của người nhận" />
                            <Switch on={f.require_ack} onChange={(v) => set('require_ack', v)} label="Yêu cầu xác nhận đã đọc" sub="Người nhận bấm “Tôi đã đọc”; BGH xem được ai đã xác nhận" />
                        </div>
                        <div className="nt-lab">Liên kết đính kèm <small>(tối đa 5)</small></div>
                        {f.links.map((l, i) => (
                            <div key={i} className="nt-linkrow">
                                <input placeholder="Tên hiển thị" value={l.label} onChange={(e) => set('links', f.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                                <input placeholder="https://…" value={l.url} onChange={(e) => set('links', f.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                                <button type="button" aria-label="Xóa liên kết" onClick={() => set('links', f.links.filter((_, j) => j !== i))}><Ico n="x" size={15} /></button>
                            </div>
                        ))}
                        {errs.links && <p className="nt-ferr">{errs.links}</p>}
                        {f.links.length < 5 && <button type="button" className="nt-addlink" onClick={() => set('links', [...f.links, { label: '', url: '' }])}><Ico n="plus" size={14} />Thêm liên kết</button>}
                    </Card>
                </div>

                <aside className="nt-side">
                    <Card title="Xem trước" sub="Hiển thị trên cổng của người nhận">
                        <div className={`nt-prev p-${f.priority}`}>
                            <div className="top"><span className={`ic t-${CAT_TONE[f.category] || 'indigo'}`}><Ico n={CAT_ICON[f.category] || 'bell'} size={18} /></span>
                                <div><b>{f.title.trim() || 'Tiêu đề thông báo'}</b><small>{sig} · {later ? dt(fromLocalInput(f.scheduled)) : 'vừa xong'}</small></div></div>
                            {f.priority !== 'normal' && <Pill tone={PRIORITY[f.priority].tone}>{f.priority === 'urgent' ? '⚡ ' : ''}{PRIORITY[f.priority].label}</Pill>}
                            <p className={f.body.trim() ? '' : 'ph'}>{f.body.trim() || 'Nội dung thông báo sẽ hiện ở đây…'}</p>
                            {f.links.filter((l) => l.url.trim()).map((l, i) => <span key={i} className="lk"><Ico n="link" size={13} />{l.label || l.url}</span>)}
                            {f.require_ack && <div className="ack"><Ico n="check" size={14} />Tôi đã đọc và hiểu</div>}
                        </div>
                    </Card>
                    <Card title="Tóm tắt gửi">
                        <ul className="nt-sum">
                            <li><span>Người nhận</span><b>{aud ? `${num(aud.total)} người` : '—'}</b></li>
                            <li><span>Nhóm</span><b>{[f.to_teachers && 'Giáo viên', f.to_students && 'Học sinh', f.to_parents && 'Phụ huynh', f.to_staff && 'Nhân viên'].filter(Boolean).join(', ') || '—'}</b></li>
                            {hasStudents && <li><span>Phạm vi</span><b>{f.grades.length || f.class_ids.length ? [f.grades.length ? `Khối ${f.grades.join(', ')}` : '', f.class_ids.length ? `${f.class_ids.length} lớp` : ''].filter(Boolean).join(' + ') : 'Tất cả khối, lớp'}</b></li>}
                            <li><span>Gửi</span><b>{needsApproval ? 'Chờ Hiệu trưởng duyệt' : later ? dt(fromLocalInput(f.scheduled)) : 'Ngay lập tức'}</b></li>
                            <li><span>Hết hạn</span><b>{f.expiry === 'custom' && f.expires ? dt(fromLocalInput(f.expires)) : 'Không'}</b></li>
                        </ul>
                        {needsApproval && <p className="nt-tip">Nhà trường đang bật chế độ duyệt: thông báo của Phó hiệu trưởng sẽ gửi sau khi Hiệu trưởng duyệt.</p>}
                    </Card>
                </aside>
            </div>

            <div className="nt-bar-bottom">
                <span className="nt-mute">{dirty ? '● Có thay đổi chưa lưu' : 'Chưa có thay đổi'}</span>
                <div>
                    <Link className="nt-btn ghost" href="/bgh/notices/danh-sach">Hủy</Link>
                    <Btn busy={busy === 'draft'} onClick={onDraft}>Lưu nháp</Btn>
                    <Btn tone="primary" busy={busy === 'send'} onClick={onSend}><Ico n={later ? 'clock' : 'send'} size={15} />{sendLabel}</Btn>
                </div>
            </div>

            {confirm && (
                <Confirm title={`${sendLabel}?`} okText={sendLabel} tone="primary"
                         text={<>Thông báo <b>“{f.title.trim()}”</b> sẽ {needsApproval ? 'được gửi lên Hiệu trưởng duyệt' : later ? <>được gửi tự động lúc <b>{dt(fromLocalInput(f.scheduled))}</b></> : 'được gửi ngay'} tới <b>{aud ? num(aud.total) : '—'}</b> người nhận.</>}
                         onOk={async () => { await submit('send'); }} onClose={() => { setConfirm(false); }} />
            )}
            {tplOpen && <TemplatePicker onPick={(t) => { applyTpl(t); setTplOpen(false); toast(`Đã áp dụng mẫu “${t.name}”.`); }} onClose={() => setTplOpen(false)} />}
        </div>
    );
}

function TemplatePicker({ onPick, onClose }: { onPick: (t: Tpl) => void; onClose: () => void }) {
    const [list, setList] = useState<Tpl[] | null>(null);
    useEffect(() => { nt<Tpl[]>('templates').then((r) => setList(r.data)).catch(() => setList([])); }, []);
    return (
        <Modal title="Chọn mẫu thông báo" wide onClose={onClose} foot={<Link className="nt-btn ghost" href="/bgh/notices/mau">Quản lý mẫu</Link>}>
            {!list ? <Loading /> : list.length === 0 ? <Empty icon="tpl" title="Chưa có mẫu nào" /> : (
                <div className="nt-tplpick">
                    {list.map((t) => (
                        <button key={t.id} type="button" onClick={() => onPick(t)}>
                            <span className={`ic t-${CAT_TONE[t.category] || 'indigo'}`}><Ico n={CAT_ICON[t.category] || 'bell'} size={17} /></span>
                            <div><b>{t.name}</b><small>{t.category_label}{t.uses ? ` · đã dùng ${t.uses} lần` : ''}</small><p>{t.body.slice(0, 110)}…</p></div>
                        </button>
                    ))}
                </div>
            )}
        </Modal>
    );
}