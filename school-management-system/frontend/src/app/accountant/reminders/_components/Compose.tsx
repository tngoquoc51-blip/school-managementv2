'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, CHANNEL_ICON, KtError, LEVEL_TONE, PreviewItem, RMeta, SendRes, SKIP_LABEL } from '../_lib/rm';
import { Chip, Field, Modal } from '../../periods/_components/ui';

type Props = { meta: RMeta; ids: number[]; onClose: () => void; onDone: (batchId: number, instant: boolean) => void; toast: { ok: (m: string) => void; fail: (m: string) => void } };

/** Soạn và gửi nhắc nợ: chọn kênh, mẫu, sửa nội dung, xem trước theo từng học sinh rồi gửi. */
export function Compose({ meta, ids, onClose, onDone, toast }: Props) {
    const active = useMemo(() => meta.templates.filter((t) => t.active), [meta]);
    const [tid, setTid] = useState<number>(active[0]?.id ?? 0);
    const [channel, setChannel] = useState('inapp');
    const [subject, setSubject] = useState(active[0]?.subject ?? '');
    const [body, setBody] = useState(active[0]?.body ?? '');
    const [name, setName] = useState('');
    const [force, setForce] = useState(false);
    const [prev, setPrev] = useState<PreviewItem[]>([]);
    const [pi, setPi] = useState(0);
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState(false);
    const [res, setRes] = useState<SendRes | null>(null);
    const [fail, setFail] = useState<string | null>(null);
    const focus = useRef<'subject' | 'body'>('body');
    const subjRef = useRef<HTMLInputElement>(null);
    const bodyRef = useRef<HTMLTextAreaElement>(null);
    const tpl = meta.templates.find((t) => t.id === tid);
    const ch = meta.channels.find((c) => c.key === channel);

    const pickTemplate = (id: number) => { const t = meta.templates.find((x) => x.id === id); setTid(id); if (t) { setSubject(t.subject); setBody(t.body); } };
    const insert = (k: string) => {
        const tag = `{${k}}`;
        const el = focus.current === 'subject' ? subjRef.current : bodyRef.current;
        const cur = focus.current === 'subject' ? subject : body;
        const s = el?.selectionStart ?? cur.length; const e = el?.selectionEnd ?? cur.length;
        const next = cur.slice(0, s) + tag + cur.slice(e);
        (focus.current === 'subject' ? setSubject : setBody)(next);
        setTimeout(() => { el?.focus(); el?.setSelectionRange(s + tag.length, s + tag.length); }, 0);
    };

    // xem trước (có độ trễ)
    useEffect(() => {
        let live = true;
        const t = setTimeout(async () => {
            try {
                const r = await api<{ items: PreviewItem[] }>('reminders/preview', { method: 'POST', body: { subject, body, student_ids: ids.slice(0, 3) } });
                if (live) { setPrev(r.items); setErrs({}); setPi(0); }
            } catch (e) { if (live) setErrs((e as KtError).errors || { body: (e as KtError).message }); }
        }, 500);
        return () => { live = false; clearTimeout(t); };
    }, [subject, body, ids]);

    const send = async () => {
        setBusy(true); setFail(null);
        try {
            const r = await api<SendRes>('reminders/send', { method: 'POST', body: { template_id: tid || undefined, level: tpl?.level, subject, body, channel, student_ids: ids, force, name } });
            setRes(r); setConfirm(false); toast.ok(r.instant ? `Đã gửi ${r.created} thông báo.` : `Đã tạo ${r.created} tin chờ gửi.`);
        } catch (e) {
            const x = e as KtError;
            setConfirm(false); setFail(x.errors?.students ? `${x.message} ${x.errors.students}` : x.message);
            if (x.errors?.subject || x.errors?.body) setErrs(x.errors);
        } finally { setBusy(false); }
    };

    if (res) {
        return (
            <Modal title="Kết quả gửi nhắc" onClose={() => onDone(res.batch_id, res.instant)}
                   foot={<><button className="pd-btn ghost" onClick={onClose}>Đóng</button><button className="pd-btn" onClick={() => onDone(res.batch_id, res.instant)}>{res.instant ? 'Xem đợt gửi' : 'Mở đợt để xuất danh sách'}</button></>}>
                <div className="rmd-result">
                    <div className="rmd-ok"><b>{res.created}</b><span>{res.instant ? 'thông báo đã gửi đến cổng học sinh' : 'tin đang chờ gửi'}</span></div>
                    {!res.instant && <div className="pd-alert info">Mở đợt này, bấm <b>Xuất danh sách</b> (hoặc <b>In giấy báo</b>), gửi tin đi, rồi bấm <b>Đánh dấu đã gửi</b> để hệ thống ghi nhận.</div>}
                    {res.skipped_count > 0 && (
                        <div>
                            <div className="pd-alert warn"><b>{res.skipped_count}</b> học sinh bị bỏ qua:</div>
                            <ul className="rmd-skip">{res.skipped.map((s) => <li key={s.id}><b>{s.name}</b> <small>{s.code}</small><Chip tone="mut">{SKIP_LABEL[s.reason] || s.reason}</Chip><small>{s.detail}</small></li>)}</ul>
                            {res.skipped_count > res.skipped.length && <small className="pd-muted">…và {res.skipped_count - res.skipped.length} học sinh khác.</small>}
                        </div>
                    )}
                </div>
            </Modal>
        );
    }

    return (
        <Modal wide title={`Soạn tin nhắc nợ · ${ids.length} học sinh`} onClose={() => !busy && onClose()}
               foot={confirm
                   ? <><span className="rmd-confirm">Gửi cho <b>{ids.length}</b> học sinh qua <b>{ch?.label}</b>?</span><button className="pd-btn ghost" disabled={busy} onClick={() => setConfirm(false)}>Quay lại</button><button className="pd-btn" disabled={busy} onClick={send}>{busy ? 'Đang gửi…' : 'Xác nhận gửi'}</button></>
                   : <><button className="pd-btn ghost" onClick={onClose}>Hủy</button><button className="pd-btn" disabled={busy || Object.keys(errs).length > 0 || subject.trim().length < 3 || body.trim().length < 20} onClick={() => setConfirm(true)}>Gửi {ids.length} học sinh</button></>}>
            <div className="rmd-compose">
                <div className="rmd-left">
                    <Field label="Kênh gửi">
                        <div className="rmd-channels" role="radiogroup" aria-label="Kênh gửi">
                            {meta.channels.map((c) => (
                                <button key={c.key} role="radio" aria-checked={channel === c.key} className={channel === c.key ? 'on' : ''} onClick={() => setChannel(c.key)}>
                                    <i aria-hidden>{CHANNEL_ICON[c.key]}</i><b>{c.label}</b><small>{c.hint}</small>
                                </button>
                            ))}
                        </div>
                    </Field>
                    <Field label="Mẫu tin nhắn" htmlFor="rmd-tpl">
                        <select id="rmd-tpl" className="pd-in" value={tid} onChange={(e) => pickTemplate(Number(e.target.value))}>
                            {active.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.level_label})</option>)}
                        </select>
                    </Field>
                    <Field label="Tiêu đề" error={errs.subject} htmlFor="rmd-sj"><input id="rmd-sj" ref={subjRef} className="pd-in" maxLength={120} value={subject} onFocus={() => (focus.current = 'subject')} onChange={(e) => setSubject(e.target.value)} /></Field>
                    <Field label="Nội dung" error={errs.body} hint={`${body.length}/1500 ký tự. Các {biến} sẽ được thay bằng thông tin của từng học sinh.`} htmlFor="rmd-bd"><textarea id="rmd-bd" ref={bodyRef} className="pd-in" rows={9} maxLength={1500} value={body} onFocus={() => (focus.current = 'body')} onChange={(e) => setBody(e.target.value)} /></Field>
                    <div className="rmd-vars" aria-label="Chèn biến">
                        <span>Chèn thông tin:</span>
                        {meta.placeholders.map((p) => <button key={p.key} type="button" title={p.label} onClick={() => insert(p.key)}>{p.label}</button>)}
                    </div>
                    <Field label="Tên đợt gửi (không bắt buộc)" htmlFor="rmd-nm"><input id="rmd-nm" className="pd-in" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Nhắc nợ học kỳ 2 – khối 10" /></Field>
                    <label className="rmd-force"><input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> Vẫn gửi cho học sinh vừa được nhắc trong {meta.settings.gap_days} ngày qua</label>
                    {fail && <div className="pd-alert err" role="alert">{fail}</div>}
                </div>

                <div className="rmd-right">
                    <h4>Xem trước</h4>
                    {prev.length > 1 && <div className="pd-seg" role="tablist" aria-label="Học sinh xem trước">{prev.map((p, i) => <button key={p.student.id} className={pi === i ? 'on' : ''} onClick={() => setPi(i)}>{p.student.name}</button>)}</div>}
                    {prev[pi] ? (
                        <article className={`rmd-phone ${channel}`}>
                            <header><span aria-hidden>{CHANNEL_ICON[channel]}</span><div><b>{ch?.label}</b><small>Gửi đến phụ huynh {prev[pi].student.name} ({prev[pi].student.code})</small></div>{tpl && <Chip tone={LEVEL_TONE[tpl.level]}>{tpl.level_label}</Chip>}</header>
                            <h5>{prev[pi].subject}</h5>
                            <p>{prev[pi].body}</p>
                        </article>
                    ) : <p className="pd-muted">{Object.keys(errs).length ? 'Sửa lỗi ở nội dung để xem trước.' : 'Đang tạo bản xem trước…'}</p>}
                    <p className="pd-muted">Bản xem trước dùng số liệu công nợ thật của học sinh tại thời điểm này. Mỗi học sinh nhận tin với thông tin riêng của mình.</p>
                </div>
            </div>
        </Modal>
    );
}