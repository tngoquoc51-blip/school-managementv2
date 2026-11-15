'use client';

import { FormEvent, useEffect, useState } from 'react';
import { pl } from '../_lib/api';
import { useToast } from '../_lib/toast';
import type { Options, Plan } from '../_lib/types';
import { Icon, Modal } from './ui';

const today = () => new Date().toISOString().slice(0, 10);

export function PlanForm({ opts, plan, onClose, onSaved }: { opts: Options; plan?: Plan; onClose: () => void; onSaved: (id: number) => void }) {
    const toast = useToast();
    const [v, setV] = useState<Record<string, string>>({
        title: plan?.title ?? '', level: plan?.level ?? 'project', category: plan?.category ?? 'other', priority: plan?.priority ?? 'normal',
        school_year: plan?.school_year ?? opts.current_year, term: plan?.term ?? '', parent_id: plan?.parent_id ? String(plan.parent_id) : '',
        owner_name: plan?.owner_name ?? '', department: plan?.department ?? '', start_date: plan?.start_date ?? '', end_date: plan?.end_date ?? '',
        budget: plan?.budget != null ? String(plan.budget) : '', spent: plan ? String(plan.spent) : '', progress: plan ? String(plan.progress) : '',
        objectives: plan?.objectives ?? '', content: plan?.content ?? '', result: plan?.result ?? '',
    });
    const [parents, setParents] = useState<Plan[]>([]);
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const set = (k: string) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

    useEffect(() => { pl.list({ all: true }).then((r) => setParents(r.rows.filter((p) => ['year', 'semester'].includes(p.level) && p.id !== plan?.id))).catch(() => {}); }, [plan?.id]);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setErr('');
        if (!v.title.trim()) return setErr('Vui lòng nhập tên kế hoạch.');
        if (v.start_date && v.end_date && v.end_date < v.start_date) return setErr('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.');
        const n = (s: string) => (s === '' ? null : Number(s));
        const body: Record<string, unknown> = {
            title: v.title.trim(), level: v.level, category: v.category, priority: v.priority, school_year: v.school_year || null, term: v.term || null,
            parent_id: v.parent_id ? Number(v.parent_id) : null, owner_name: v.owner_name || null, department: v.department || null,
            start_date: v.start_date || null, end_date: v.end_date || null, budget: n(v.budget), objectives: v.objectives || null, content: v.content || null,
        };
        if (plan) { body.spent = n(v.spent) ?? 0; body.result = v.result || null; if (!plan.tasks_total && v.progress !== '') body.progress = Number(v.progress); }
        setBusy(true);
        try {
            if (plan) { await pl.update(plan.id, body as Partial<Plan>); toast({ tone: 'success', title: 'Đã lưu kế hoạch' }); onSaved(plan.id); }
            else { const id = await pl.create(body as Partial<Plan>); toast({ tone: 'success', title: 'Đã tạo kế hoạch', text: v.title }); onSaved(id); }
        } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Không lưu được.'); } finally { setBusy(false); }
    };

    return (
        <Modal wide title={plan ? `Sửa kế hoạch ${plan.code}` : 'Kế hoạch mới'} onClose={onClose}
               footer={<><button type="button" className="pl-btn ghost" onClick={onClose}>Hủy</button><button form="plform" className="pl-btn" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu kế hoạch'}</button></>}>
            <form id="plform" className="pl-form" onSubmit={submit}>
                {err && <div className="pl-alert full err"><Icon n="alert" s={16} /><span>{err}</span></div>}
                <label className="full">Tên kế hoạch *<input className="pl-in" value={v.title} onChange={set('title')} maxLength={255} autoFocus /></label>
                <label>Cấp kế hoạch<select className="pl-in" value={v.level} onChange={set('level')}>{Object.entries(opts.levels).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
                <label>Lĩnh vực<select className="pl-in" value={v.category} onChange={set('category')}>{Object.entries(opts.categories).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
                <label>Năm học<select className="pl-in" value={v.school_year} onChange={set('school_year')}><option value="">—</option>{opts.school_years.map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
                <label>Học kỳ<select className="pl-in" value={v.term} onChange={set('term')}><option value="">—</option><option value="HK1">Học kỳ I</option><option value="HK2">Học kỳ II</option><option value="CN">Cả năm</option></select></label>
                <label className="full">Thuộc kế hoạch cha<select className="pl-in" value={v.parent_id} onChange={set('parent_id')}><option value="">— Không có —</option>{parents.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.title}</option>)}</select></label>
                <label>Người phụ trách<input className="pl-in" list="pl-owners" value={v.owner_name} onChange={set('owner_name')} /><datalist id="pl-owners">{opts.owners.map((o) => <option key={o} value={o} />)}</datalist></label>
                <label>Tổ / Phòng ban<input className="pl-in" value={v.department} onChange={set('department')} /></label>
                <label>Bắt đầu<input className="pl-in" type="date" value={v.start_date} onChange={set('start_date')} /></label>
                <label>Kết thúc<input className="pl-in" type="date" value={v.end_date} min={v.start_date || undefined} onChange={set('end_date')} /></label>
                <label>Mức ưu tiên<select className="pl-in" value={v.priority} onChange={set('priority')}>{Object.entries(opts.priorities).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
                <label>Dự toán (đồng)<input className="pl-in" type="number" min={0} value={v.budget} onChange={set('budget')} /></label>
                {plan && <label>Đã chi (đồng)<input className="pl-in" type="number" min={0} value={v.spent} onChange={set('spent')} /></label>}
                {plan && !plan.tasks_total && <label>Tiến độ (%)<input className="pl-in" type="number" min={0} max={100} value={v.progress} onChange={set('progress')} /></label>}
                <label className="full">Mục tiêu<textarea className="pl-in" rows={2} value={v.objectives} onChange={set('objectives')} /></label>
                <label className="full">Nội dung thực hiện<textarea className="pl-in" rows={4} value={v.content} onChange={set('content')} /></label>
                {plan && <label className="full">Kết quả đạt được<textarea className="pl-in" rows={2} value={v.result} onChange={set('result')} /></label>}
            </form>
        </Modal>
    );
}

export function TemplateModal({ opts, onClose, onCreated }: { opts: Options; onClose: () => void; onCreated: (id: number) => void }) {
    const toast = useToast();
    const [key, setKey] = useState(opts.templates[0]?.key ?? '');
    const [start, setStart] = useState(today());
    const [title, setTitle] = useState('');
    const [owner, setOwner] = useState('');
    const [year, setYear] = useState(opts.current_year);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const t = opts.templates.find((x) => x.key === key);

    const go = async () => {
        setBusy(true); setErr('');
        try {
            const id = await pl.fromTemplate({ template: key, start_date: start, title: title || undefined, owner_name: owner || undefined, school_year: year || undefined });
            toast({ tone: 'success', title: 'Đã tạo kế hoạch từ mẫu', text: `${t?.tasks ?? 0} nhiệm vụ được tạo sẵn` });
            onCreated(id);
        } catch (e) { setErr(e instanceof Error ? e.message : 'Không tạo được.'); } finally { setBusy(false); }
    };

    return (
        <Modal wide title="Tạo kế hoạch từ mẫu" onClose={onClose}
               footer={<><button className="pl-btn ghost" onClick={onClose}>Hủy</button><button className="pl-btn" onClick={go} disabled={busy || !key || !start}>{busy ? 'Đang tạo…' : 'Tạo kế hoạch'}</button></>}>
            <div className="pl-tpl">
                {opts.templates.map((x) => (
                    <button key={x.key} type="button" className={key === x.key ? 'on' : ''} onClick={() => setKey(x.key)}>
                        <b>{x.title}</b><small>{x.desc}</small><small>{opts.categories[x.category]} · {x.tasks} nhiệm vụ · {x.duration_days} ngày</small>
                    </button>
                ))}
            </div>
            {err && <div className="pl-alert err"><Icon n="alert" s={16} /><span>{err}</span></div>}
            <div className="pl-form" style={{ marginTop: 14 }}>
                <label>Ngày bắt đầu *<input className="pl-in" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
                <label>Năm học<select className="pl-in" value={year} onChange={(e) => setYear(e.target.value)}>{opts.school_years.map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
                <label>Tên kế hoạch (để trống = tên mẫu)<input className="pl-in" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t?.title} /></label>
                <label>Người phụ trách<input className="pl-in" value={owner} onChange={(e) => setOwner(e.target.value)} /></label>
            </div>
            <p className="pl-note" style={{ marginTop: 12 }}>Hạn của từng nhiệm vụ được tính tự động từ ngày bắt đầu. Bạn có thể sửa lại sau khi tạo.</p>
        </Modal>
    );
}