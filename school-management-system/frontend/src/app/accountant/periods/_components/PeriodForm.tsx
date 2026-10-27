'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Chip, ErrorBox, Field, ICON, Ico, Loading, Stat, Toast, useApi, useToast } from './ui';
import { CATEGORY, KtError, TERM_TITLE, addDays, api, fmtDate, vnd, vndShort } from '../_lib/api';

type Item = { fee_item_id: number; amount: number };
type Form = { name: string; school_year_id: string; term: string; grade: string; open_date: string; due_date: string; note: string; items: Item[] };

const STEPS = ['Thông tin', 'Khoản thu', 'Xem trước', 'Xác nhận'];
const ymd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Form tạo / sửa đợt thu, 4 bước. Dùng cho trang tạo mới và sửa bản nháp. */
export default function PeriodForm({ editId }: { editId?: number }) {
    const router = useRouter();
    const meta = useApi<any>('meta');
    const edit = useApi<any>(editId ? `periods/${editId}/edit` : null);
    const toast = useToast();
    const [step, setStep] = useState(0);
    const [f, setF] = useState<Form | null>(null);
    const [nameTouched, setNameTouched] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const [prev, setPrev] = useState<any>(null);
    const [prevErr, setPrevErr] = useState('');
    const [prevLoading, setPrevLoading] = useState(false);
    const [agree, setAgree] = useState(false);

    /* khởi tạo giá trị mặc định khi đã có danh mục */
    useEffect(() => {
        if (f || !meta.data) return;
        if (editId) {
            if (!edit.data) return;
            const d = edit.data;
            setF({ name: d.name, school_year_id: String(d.school_year_id), term: d.term, grade: d.grade ? String(d.grade) : '', open_date: d.open_date, due_date: d.due_date, note: d.note || '', items: d.items });
            setNameTouched(true);
            return;
        }
        const y = meta.data.years.find((x: any) => x.is_current) ?? meta.data.years[0];
        const today = meta.data.today || ymd();
        setF({ name: `${TERM_TITLE.HK1} (${y?.label ?? ''})`, school_year_id: String(y?.id ?? ''), term: 'HK1', grade: '', open_date: today, due_date: addDays(today, 30), note: '', items: [] });
    }, [meta.data, edit.data, editId, f]);

    const yearLabel = useMemo(() => meta.data?.years.find((y: any) => String(y.id) === f?.school_year_id)?.label ?? '', [meta.data, f?.school_year_id]);
    const set = (patch: Partial<Form>) => setF((cur) => {
        if (!cur) return cur;
        const next = { ...cur, ...patch };
        if (!nameTouched && ('term' in patch || 'school_year_id' in patch)) {
            const yl = meta.data?.years.find((y: any) => String(y.id) === next.school_year_id)?.label ?? '';
            next.name = `${TERM_TITLE[next.term]} (${yl})`;
        }
        return next;
    });
    useEffect(() => { setPrev(null); setAgree(false); }, [f?.name, f?.school_year_id, f?.term, f?.grade, f?.due_date, f?.open_date, f?.items]);

    if (meta.err || edit.err) return <ErrorBox msg={meta.err || edit.err} retry={() => { meta.reload(); edit.reload(); }} />;
    if (!f || !meta.data) return <Loading />;
    if (editId && edit.data && edit.data.status !== 'draft') return <ErrorBox msg="Chỉ sửa được đợt thu ở trạng thái bản nháp." />;

    const items: any[] = meta.data.items;
    const selected = (id: number) => f.items.find((i) => i.fee_item_id === id);
    const toggle = (it: any) => set({ items: selected(it.id) ? f.items.filter((x) => x.fee_item_id !== it.id) : [...f.items, { fee_item_id: it.id, amount: it.amount }] });
    const setAmount = (id: number, v: string) => set({ items: f.items.map((x) => (x.fee_item_id === id ? { ...x, amount: Math.max(0, parseInt(v.replace(/\D/g, '') || '0', 10)) } : x)) });
    const suggest = () => {
        const unit = (u: string) => (f.term === 'YEAR' ? ['năm', 'lần'].includes(u) : u === 'học kỳ');
        set({ items: items.filter((i) => i.mandatory && unit(i.unit)).map((i) => ({ fee_item_id: i.id, amount: i.amount })) });
    };
    const perStudent = (grade: number) => f.items.reduce((s, x) => { const it = items.find((i) => i.id === x.fee_item_id); return it && (it.grade === null || it.grade === grade) ? s + x.amount : s; }, 0);
    const grades = f.grade ? [Number(f.grade)] : [10, 11, 12];
    const count = (g: number) => meta.data.student_counts?.[f.school_year_id]?.[g] ?? 0;
    const estTotal = grades.reduce((s, g) => s + perStudent(g) * count(g), 0);

    const body = () => ({ ...f, school_year_id: Number(f.school_year_id), grade: f.grade ? Number(f.grade) : null });
    const fieldErr = (e: KtError) => { setErrors(e.errors || {}); toast.fail(e.message); };

    /* kiểm tra từng bước ở phía trình duyệt (máy chủ vẫn kiểm tra lại) */
    const checkStep = (s: number) => {
        const e: Record<string, string> = {};
        if (s >= 0) {
            if (f.name.trim().length < 5) e.name = 'Tên đợt thu từ 5 ký tự trở lên.';
            if (!f.school_year_id) e.school_year_id = 'Chọn năm học.';
            if (!f.open_date) e.open_date = 'Chọn ngày mở.';
            if (!f.due_date) e.due_date = 'Chọn hạn nộp.';
            else if (f.open_date && f.due_date < f.open_date) e.due_date = 'Hạn nộp phải sau hoặc bằng ngày mở.';
        }
        if (s >= 1 && f.items.length === 0) e.items = 'Chọn ít nhất một khoản thu.';
        setErrors(e);
        return Object.keys(e).length === 0;
    };
    const go = (n: number) => {
        if (n > step) for (let s = step; s < n; s++) if (!checkStep(s)) { setStep(s); return; }
        setErrors({}); setStep(n);
        if (n >= 2) loadPreview();
    };
    const loadPreview = async () => {
        setPrevLoading(true); setPrevErr('');
        try { setPrev(await api('periods/preview', { method: 'POST', body: body() })); } catch (x: any) { setPrevErr(x.message); setErrors(x.errors || {}); } finally { setPrevLoading(false); }
    };

    const save = async (issue: boolean) => {
        if (!checkStep(1)) { setStep(f.items.length ? 0 : 1); return; }
        setBusy(true);
        try {
            const r = editId ? await api<any>(`periods/${editId}`, { method: 'PUT', body: body() }) : await api<any>('periods', { method: 'POST', body: body() });
            const id = r.id ?? editId;
            if (issue) {
                const x = await api<any>(`periods/${id}/issue`, { method: 'POST' });
                toast.ok(x.message || 'Đã phát hành.');
            } else toast.ok('Đã lưu bản nháp.');
            setTimeout(() => router.push(`/accountant/periods/${id}`), 700);
        } catch (x: any) { fieldErr(x); setBusy(false); }
    };

    const today = meta.data.today || ymd();
    const pastDue = f.due_date < today;
    const cats = Object.keys(CATEGORY).filter((c) => items.some((i) => i.category === c));
    const hasBlocking = !prev || prev.summary.to_create === 0 || pastDue;

    return (
        <>
            <div className="pd-head">
                <div>
                    <nav className="pd-crumb" aria-label="Đường dẫn"><a href="/accountant/periods">Đợt thu / Kỳ thu</a><i>›</i><b>{editId ? 'Sửa bản nháp' : 'Tạo đợt thu'}</b></nav>
                    <h1>{editId ? 'Sửa bản nháp đợt thu' : 'Tạo đợt thu mới'}</h1>
                    <p>Làm lần lượt 4 bước. Hóa đơn chỉ được tạo cho học sinh khi anh/chị bấm “Phát hành” ở bước cuối.</p>
                </div>
            </div>

            <ol className="pd-steps" aria-label="Các bước">
                {STEPS.map((s, i) => (
                    <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>
                        <button type="button" onClick={() => go(i)} aria-current={i === step ? 'step' : undefined}><span>{i < step ? '✓' : i + 1}</span>{s}</button>
                    </li>
                ))}
            </ol>

            {/* ---------- BƯỚC 1 ---------- */}
            {step === 0 && (
                <Card title="Thông tin đợt thu">
                    <div className="pd-form">
                        <Field label="Tên đợt thu" error={errors.name} htmlFor="p-name" hint="Tên này hiển thị làm tiêu đề hóa đơn của học sinh.">
                            <input id="p-name" className="pd-in" value={f.name} maxLength={160} onChange={(e) => { setNameTouched(true); set({ name: e.target.value }); }} />
                        </Field>
                        <div className="pd-row">
                            <Field label="Năm học" error={errors.school_year_id} htmlFor="p-year">
                                <select id="p-year" className="pd-in" value={f.school_year_id} onChange={(e) => set({ school_year_id: e.target.value })}>{meta.data.years.map((y: any) => <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' (hiện tại)' : ''}</option>)}</select>
                            </Field>
                            <Field label="Học kỳ" error={errors.term} htmlFor="p-term">
                                <select id="p-term" className="pd-in" value={f.term} onChange={(e) => set({ term: e.target.value })}>{Object.entries(meta.data.terms).map(([k, l]) => <option key={k} value={k}>{l as string}</option>)}</select>
                            </Field>
                        </div>
                        <Field label="Phạm vi áp dụng" error={errors.grade}>
                            <div className="pd-seg" role="radiogroup" aria-label="Phạm vi">
                                {[['', 'Toàn trường'], ['10', 'Khối 10'], ['11', 'Khối 11'], ['12', 'Khối 12']].map(([k, l]) => (
                                    <button key={k} type="button" role="radio" aria-checked={f.grade === k} className={f.grade === k ? 'on' : ''} onClick={() => set({ grade: k })}>
                                        {l}<em>{(k ? count(Number(k)) : count(10) + count(11) + count(12)).toLocaleString('vi-VN')} HS</em>
                                    </button>
                                ))}
                            </div>
                        </Field>
                        <div className="pd-row">
                            <Field label="Ngày mở đợt" error={errors.open_date} htmlFor="p-open" hint="Nếu chọn ngày trong tương lai, hóa đơn vẫn được ghi ngày phát hành thực tế.">
                                <input id="p-open" type="date" className="pd-in" value={f.open_date} onChange={(e) => set({ open_date: e.target.value })} />
                            </Field>
                            <Field label="Hạn nộp" error={errors.due_date} htmlFor="p-due" hint={pastDue ? 'Hạn nộp đã qua: chỉ lưu nháp được, chưa phát hành được.' : undefined}>
                                <input id="p-due" type="date" className="pd-in" value={f.due_date} onChange={(e) => set({ due_date: e.target.value })} />
                                <div className="pd-quick">{[15, 30, 45].map((n) => <button key={n} type="button" onClick={() => set({ due_date: addDays(f.open_date || today, n) })}>+{n} ngày</button>)}</div>
                            </Field>
                        </div>
                        <Field label="Ghi chú nội bộ (không bắt buộc)" error={errors.note} htmlFor="p-note">
                            <textarea id="p-note" className="pd-in" rows={2} maxLength={255} value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder="Ví dụ: Thu theo thông báo số 12/TB-THPT" />
                        </Field>
                    </div>
                </Card>
            )}

            {/* ---------- BƯỚC 2 ---------- */}
            {step === 1 && (
                <Card title="Chọn khoản thu" right={<button type="button" className="pd-btn ghost sm" onClick={suggest}>Gợi ý theo {f.term === 'YEAR' ? 'đầu năm học' : 'học kỳ'}</button>}>
                    {errors.items && <div className="pd-alert err" role="alert">{errors.items}</div>}
                    <p className="pd-note">Chỉ khoản <b>bắt buộc</b> mới thu tự động cho cả đợt. Khoản <b>tự nguyện</b> (bảo hiểm tai nạn, quỹ hội phụ huynh, lớp tăng cường…) học sinh tự đăng ký nên không đưa vào đợt. Có thể sửa đơn giá riêng cho đợt này.</p>
                    {cats.map((c) => (
                        <div key={c} className="pd-cat">
                            <h3>{CATEGORY[c]}</h3>
                            {items.filter((i) => i.category === c).map((it) => {
                                const sel = selected(it.id);
                                const off = !it.mandatory;
                                const wrongGrade = it.grade !== null && f.grade && Number(f.grade) !== it.grade;
                                return (
                                    <div key={it.id} className={`pd-fee ${sel ? 'sel' : ''} ${off ? 'off' : ''}`}>
                                        <label>
                                            <input type="checkbox" checked={!!sel} disabled={off} onChange={() => toggle(it)} />
                                            <span className="pd-fee-name"><b>{it.name}</b><small>{it.code} · {it.unit ? `thu theo ${it.unit}` : ''}{it.note ? ` · ${it.note}` : ''}</small></span>
                                        </label>
                                        <div className="pd-fee-tags">
                                            {it.grade !== null && <Chip tone={wrongGrade ? 'err' : 'info'}>Chỉ khối {it.grade}</Chip>}
                                            {off && <Chip tone="mut">Tự nguyện</Chip>}
                                        </div>
                                        <div className="pd-fee-amt">
                                            {sel ? (
                                                <>
                                                    <input className="pd-in" inputMode="numeric" aria-label={`Đơn giá ${it.name}`} value={sel.amount.toLocaleString('vi-VN')} onChange={(e) => setAmount(it.id, e.target.value)} />
                                                    <span>đ</span>
                                                    {sel.amount !== it.amount && <button type="button" className="pd-link" onClick={() => setAmount(it.id, String(it.amount))}>Đặt lại {vnd(it.amount)}</button>}
                                                </>
                                            ) : <b className="pd-fee-price">{vnd(it.amount)}</b>}
                                        </div>
                                        {wrongGrade && sel && <p className="pd-fee-warn">Khoản này chỉ dành cho khối {it.grade} nhưng phạm vi đang chọn là khối {f.grade}, nên sẽ không có hóa đơn nào chứa khoản này.</p>}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                    <div className="pd-sum">
                        <div><span>Đã chọn</span><b>{f.items.length} khoản</b></div>
                        {grades.map((g) => <div key={g}><span>Mỗi học sinh khối {g}</span><b>{vnd(perStudent(g))}</b></div>)}
                        <div className="tot"><span>Ước tính tổng (chưa trừ miễn giảm)</span><b>{vndShort(estTotal)}</b></div>
                    </div>
                </Card>
            )}

            {/* ---------- BƯỚC 3 ---------- */}
            {step === 2 && (
                <>
                    {prevLoading && <Loading text="Đang tính toán hóa đơn sẽ tạo…" />}
                    {prevErr && <ErrorBox msg={prevErr} retry={loadPreview} />}
                    {prev && (
                        <>
                            <div className="pd-stats">
                                <Stat label="Học sinh trong phạm vi" value={prev.summary.students.toLocaleString('vi-VN')} tone="info" icon={<Ico d={ICON.users} />} />
                                <Stat label="Hóa đơn sẽ tạo" value={prev.summary.to_create.toLocaleString('vi-VN')} hint={prev.summary.already ? `${prev.summary.already} học sinh đã có` : undefined} tone="pri" icon={<Ico d={ICON.doc} />} />
                                <Stat label="Tổng phải thu" value={vndShort(prev.summary.total)} hint={vnd(prev.summary.total)} tone="ok" icon={<Ico d={ICON.cash} />} />
                                <Stat label="Miễn giảm tự động" value={vndShort(prev.summary.discount)} hint={`${prev.summary.waived_students} học sinh được giảm`} tone="warn" icon={<Ico d={ICON.percent} />} />
                            </div>
                            {prev.warnings.length > 0 && <div className="pd-alert warn" role="alert"><b>Cần lưu ý</b><ul>{prev.warnings.map((w: string) => <li key={w}>{w}</li>)}</ul></div>}
                            <div className="pd-cols">
                                <Card title="Theo khối" pad={false}>
                                    <div className="pd-tw"><table className="pd-table"><thead><tr><th>Khối</th><th className="n">Học sinh</th><th className="n">Mỗi học sinh</th><th className="n">Phải thu</th></tr></thead><tbody>
                                    {prev.by_grade.map((g: any) => <tr key={g.grade}><td>Khối {g.grade}</td><td className="n">{g.students}</td><td className="n">{vnd(g.per_student)}</td><td className="n"><b>{vnd(g.total)}</b></td></tr>)}
                                    {prev.by_grade.length === 0 && <tr><td colSpan={4} className="pd-muted">Chưa có học sinh nào được tạo hóa đơn.</td></tr>}
                                    </tbody></table></div>
                                </Card>
                                <Card title="Khoản thu trong hóa đơn" pad={false}>
                                    <div className="pd-tw"><table className="pd-table"><thead><tr><th>Khoản thu</th><th>Áp dụng</th><th className="n">Đơn giá</th></tr></thead><tbody>
                                    {prev.lines.map((l: any) => <tr key={l.id}><td>{l.name}</td><td>{l.grade ? `Khối ${l.grade}` : 'Mọi khối'}</td><td className="n">{vnd(l.price)}</td></tr>)}
                                    </tbody></table></div>
                                </Card>
                            </div>
                            <p className="pd-note">Miễn giảm lấy từ danh sách đã duyệt của năm học này và chỉ trừ vào khoản <b>học phí</b>. Hóa đơn của học sinh được giảm sẽ ghi rõ số tiền giảm.</p>
                        </>
                    )}
                </>
            )}

            {/* ---------- BƯỚC 4 ---------- */}
            {step === 3 && (
                <Card title="Xác nhận trước khi phát hành">
                    {prevLoading && <Loading text="Đang tính toán…" />}
                    {prevErr && <ErrorBox msg={prevErr} retry={loadPreview} />}
                    {prev && (
                        <>
                            <dl className="pd-dl">
                                <div><dt>Tên đợt thu</dt><dd>{f.name}</dd></div>
                                <div><dt>Năm học · học kỳ</dt><dd>{yearLabel} · {meta.data.terms[f.term]}</dd></div>
                                <div><dt>Phạm vi</dt><dd>{f.grade ? `Khối ${f.grade}` : 'Toàn trường'}</dd></div>
                                <div><dt>Ngày mở → hạn nộp</dt><dd>{fmtDate(f.open_date)} → <b className={pastDue ? 'bad' : ''}>{fmtDate(f.due_date)}</b></dd></div>
                                <div><dt>Khoản thu</dt><dd>{f.items.map((x) => items.find((i) => i.id === x.fee_item_id)?.name).filter(Boolean).join(', ')}</dd></div>
                                <div><dt>Hóa đơn sẽ tạo</dt><dd><b>{prev.summary.to_create.toLocaleString('vi-VN')}</b> hóa đơn · tổng <b>{vnd(prev.summary.total)}</b></dd></div>
                            </dl>
                            {prev.warnings.length > 0 && <div className="pd-alert warn"><ul>{prev.warnings.map((w: string) => <li key={w}>{w}</li>)}</ul></div>}
                            <label className="pd-check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> Tôi đã kiểm tra khoản thu, số tiền và hạn nộp. Sau khi phát hành, học sinh sẽ thấy hóa đơn ngay trong cổng học sinh.</label>
                        </>
                    )}
                </Card>
            )}

            <div className="pd-foot">
                <button type="button" className="pd-btn ghost" disabled={busy || step === 0} onClick={() => go(step - 1)}>‹ Quay lại</button>
                <span className="pd-foot-sp" />
                {step < 3 ? (
                    <>
                        <button type="button" className="pd-btn ghost" disabled={busy} onClick={() => save(false)}>Lưu bản nháp</button>
                        <button type="button" className="pd-btn" disabled={busy} onClick={() => go(step + 1)}>Tiếp tục ›</button>
                    </>
                ) : (
                    <>
                        <button type="button" className="pd-btn ghost" disabled={busy} onClick={() => save(false)}>{editId ? 'Lưu thay đổi' : 'Lưu bản nháp'}</button>
                        <button type="button" className="pd-btn" disabled={busy || hasBlocking || !agree} onClick={() => save(true)} title={!agree ? 'Hãy tích xác nhận bên trên' : undefined}>{busy ? 'Đang xử lý…' : 'Phát hành ngay'}</button>
                    </>
                )}
            </div>
            <Toast t={toast.t} clear={toast.clear} />
        </>
    );
}