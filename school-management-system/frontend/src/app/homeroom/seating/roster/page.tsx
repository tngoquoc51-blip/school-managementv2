'use client';

import { useMemo, useState } from 'react';
import { useQ, useSeating } from '@/components/hr-seating/Shell';
import { Avatar, Badge, Card, Drawer, Empty, ErrorBox, Field, Icon, Kpi, PageHeader, Seg, Skeleton, useToast } from '@/components/hr-seating/ui';
import { Flags, LEVEL_TONE, OFFICER_SHORT, Student, Summary, downloadCsv, errText, fixed, hrSend, num } from '@/lib/hr-seating';

type Filter = 'all' | 'vision' | 'hearing' | 'tall' | 'avoid' | 'unseated' | 'officer' | 'weak' | 'absent';
const FILTERS: { v: Filter; t: string }[] = [
    { v: 'all', t: 'Tất cả học sinh' }, { v: 'vision', t: 'Cận thị / cần ngồi trước' }, { v: 'hearing', t: 'Nghe kém' }, { v: 'tall', t: 'Học sinh cao' },
    { v: 'avoid', t: 'Có ràng buộc "không ngồi cạnh"' }, { v: 'unseated', t: 'Chưa có chỗ ngồi' }, { v: 'officer', t: 'Ban cán sự' }, { v: 'weak', t: 'Học lực Chưa đạt' }, { v: 'absent', t: 'Nghỉ từ 3 buổi / 30 ngày' },
];

export default function RosterPage() {
    const { params } = useSeating();
    const toast = useToast();
    const q = useQ<{ students: Student[]; summary: Summary }>('/roster');
    const [search, setSearch] = useState('');
    const [gender, setGender] = useState<'all' | 'Nam' | 'Nữ'>('all');
    const [group, setGroup] = useState('all');
    const [filter, setFilter] = useState<Filter>('all');
    const [sort, setSort] = useState<'name' | 'score' | 'age' | 'group'>('name');
    const [open, setOpen] = useState<Student | null>(null);
    const [form, setForm] = useState<Flags | null>(null);
    const [busy, setBusy] = useState(false);

    const all = useMemo(() => q.data?.students || [], [q.data]);
    const sum = q.data?.summary;
    const rows = useMemo(() => {
        const t = search.trim().toLowerCase();
        const list = all.filter((s) =>
            (!t || s.full_name.toLowerCase().includes(t) || s.code.toLowerCase().includes(t)) &&
            (gender === 'all' || s.gender === gender) &&
            (group === 'all' || (group === 'none' ? !s.group : String(s.group?.id) === group)) &&
            (filter === 'all' ||
                (filter === 'vision' && (s.flags.vision || s.flags.front_required)) || (filter === 'hearing' && s.flags.hearing) || (filter === 'tall' && s.flags.tall) ||
                (filter === 'avoid' && s.flags.avoid_ids.length > 0) || (filter === 'unseated' && !s.seat) || (filter === 'officer' && s.officer_roles.length > 0) ||
                (filter === 'weak' && s.level === 'Chưa đạt') || (filter === 'absent' && (s.absent_30d ?? 0) >= 3)));
        const arr = [...list];
        if (sort === 'score') arr.sort((a, b) => (b.avg_score ?? -1) - (a.avg_score ?? -1));
        if (sort === 'age') arr.sort((a, b) => b.age - a.age);
        if (sort === 'group') arr.sort((a, b) => (a.group?.number ?? 99) - (b.group?.number ?? 99));
        return arr;
    }, [all, search, gender, group, filter, sort]);
    const groups = useMemo(() => Array.from(new Map(all.filter((s) => s.group).map((s) => [String(s.group!.id), s.group!.name])).entries()), [all]);

    const openStudent = (s: Student) => { setOpen(s); setForm({ ...s.flags, avoid_ids: [...s.flags.avoid_ids] }); };
    const save = async () => {
        if (!open || !form) return;
        setBusy(true);
        try { await hrSend('PUT', `/flags/${open.id}`, form, params); toast.success('Đã lưu lưu ý chỗ ngồi', open.full_name); setOpen(null); q.reload(); }
        catch (e) { toast.error('Không lưu được', errText(e)); } finally { setBusy(false); }
    };
    const exportCsv = () => downloadCsv('danh-sach-lop.csv', [
        ['Mã HS', 'Họ và tên', 'Giới tính', 'Ngày sinh', 'Tổ', 'Chỗ ngồi', 'Điểm TB', 'Học lực', 'Hạnh kiểm', 'Cán sự', 'Lưu ý'],
        ...rows.map((s) => [s.code, s.full_name, s.gender, s.birth_date, s.group?.name || '', s.seat ? `Hàng ${s.seat.row + 1} - Dãy ${s.seat.col + 1} - Chỗ ${s.seat.pos + 1}` : '', s.avg_score ?? '', s.level || '', s.conduct || '',
            s.officer_roles.map((r) => OFFICER_SHORT[r] || r).join('; '), [s.flags.vision && 'Cận thị', s.flags.hearing && 'Nghe kém', s.flags.tall && 'Cao', s.flags.note].filter(Boolean).join('; ')]),
    ]);

    if (q.error && !q.data) return <ErrorBox error={q.error} onRetry={q.reload} />;
    if (!q.data || !sum) return <Skeleton h={60} n={8} />;
    const others = all.filter((s) => s.id !== open?.id);

    return (
        <>
            <PageHeader title="Danh sách & lưu ý chỗ ngồi" desc="Hồ sơ nhanh của cả lớp, kết hợp điểm, hạnh kiểm, điểm danh và lưu ý khi xếp chỗ.">
                <button className="hs-btn" onClick={exportCsv}><Icon name="download" size={16} /> Xuất CSV ({rows.length})</button>
            </PageHeader>

            <div className="hs-grid hs-g4" style={{ marginBottom: 16 }}>
                <Kpi icon="grad" tone="primary" label="Sĩ số" value={sum.total} sub={<span className="hs-muted">{sum.male} nam · {sum.female} nữ</span>} />
                <Kpi icon="eye" tone="info" label="Có lưu ý chỗ ngồi" value={sum.flagged} />
                <Kpi icon="layers" tone={sum.unseated ? 'warn' : 'ok'} label="Chưa có chỗ" value={sum.unseated} />
                <Kpi icon="clipboard" tone={sum.attendance_linked ? 'primary' : 'info'} label="Vắng hôm nay" value={sum.attendance_linked ? num(sum.absent_today) : '–'} sub={<span className="hs-muted">{sum.attendance_linked ? 'Từ điểm danh' : 'Chưa kết nối điểm danh'}</span>} />
            </div>

            <div className="hs-row hs-wrap" style={{ marginBottom: 14 }}>
                <input className="hs-input" style={{ maxWidth: 280 }} placeholder="Tìm tên hoặc mã học sinh…" value={search} onChange={(e) => setSearch(e.target.value)} />
                <Seg value={gender} onChange={setGender} options={[{ value: 'all', label: 'Tất cả' }, { value: 'Nam', label: 'Nam' }, { value: 'Nữ', label: 'Nữ' }]} />
                <select className="hs-select inline" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Tổ"><option value="all">Mọi tổ</option>{groups.map(([id, n]) => <option key={id} value={id}>{n}</option>)}<option value="none">Chưa vào tổ</option></select>
                <select className="hs-select inline" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Bộ lọc">{FILTERS.map((f) => <option key={f.v} value={f.v}>{f.t}</option>)}</select>
                <select className="hs-select inline" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sắp xếp"><option value="name">Xếp theo tên</option><option value="score">Điểm cao → thấp</option><option value="age">Tuổi lớn → nhỏ</option><option value="group">Theo tổ</option></select>
                <span className="hs-muted hs-small hs-right">{rows.length} học sinh</span>
            </div>

            {rows.length === 0 ? <Empty icon="users" title="Không có học sinh phù hợp" /> : (
                <Card flush>
                    <div className="hs-table-wrap"><table className="hs-table">
                        <thead><tr><th>Học sinh</th><th>Tổ</th><th>Chỗ ngồi</th><th>Điểm TB</th><th>Học lực</th><th>Hạnh kiểm</th><th>Lưu ý</th><th>Cán sự</th>{sum.attendance_linked && <th>Vắng 30 ngày</th>}</tr></thead>
                        <tbody>{rows.map((s) => (
                            <tr key={s.id} className="click" onClick={() => openStudent(s)}>
                                <td><div className="hs-row"><Avatar name={s.full_name} size={34} /><div><div className="hs-b">{s.full_name}</div><div className="hs-small hs-muted">{s.code} · {s.gender} · {s.age} tuổi</div></div></div></td>
                                <td>{s.group ? <Badge tone="muted"><i className="hs-dot" style={{ background: s.group.color }} />{s.group.name}</Badge> : <span className="hs-muted">–</span>}</td>
                                <td className="hs-small">{s.seat ? `Hàng ${s.seat.row + 1} · Dãy ${s.seat.col + 1} · Chỗ ${s.seat.pos + 1}` : <Badge tone="warn">Chưa xếp</Badge>}</td>
                                <td className="hs-b hs-num">{fixed(s.avg_score, 2)}</td>
                                <td>{s.level ? <Badge tone={LEVEL_TONE[s.level]}>{s.level}</Badge> : '–'}</td>
                                <td>{s.conduct ? <Badge tone={LEVEL_TONE[s.conduct] || 'muted'}>{s.conduct}</Badge> : '–'}</td>
                                <td><span className="hs-row" style={{ gap: 6 }}>{s.flags.vision && <Icon name="glasses" size={15} />}{s.flags.hearing && <Icon name="ear" size={15} />}{s.flags.tall && <Icon name="ruler" size={15} />}{s.flags.avoid_ids.length > 0 && <Icon name="ban" size={15} />}{!(s.flags.vision || s.flags.hearing || s.flags.tall || s.flags.avoid_ids.length) && <span className="hs-muted">–</span>}</span></td>
                                <td>{s.officer_roles.length ? s.officer_roles.map((r) => <Badge key={r} tone="warn">{OFFICER_SHORT[r] || r}</Badge>) : <span className="hs-muted">–</span>}</td>
                                {sum.attendance_linked && <td className="hs-num">{s.absent_30d === null ? '–' : <Badge tone={(s.absent_30d ?? 0) >= 5 ? 'bad' : (s.absent_30d ?? 0) >= 3 ? 'warn' : 'muted'}>{s.absent_30d}</Badge>}{s.absent_today ? <Badge tone="bad">Vắng hôm nay</Badge> : null}</td>}
                            </tr>))}</tbody></table></div>
                </Card>
            )}

            <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.full_name || ''} subtitle={open ? `${open.code} · ${open.gender} · ${open.age} tuổi` : undefined}>
                {open && form && (
                    <div className="hs-grid" style={{ gap: 18 }}>
                        <div className="hs-grid hs-g2" style={{ gap: 10 }}>
                            <div className="hs-card hs-card-b"><div className="hs-small hs-muted">Điểm trung bình</div><div style={{ fontSize: 24, fontWeight: 800 }}>{fixed(open.avg_score, 2)}</div><div className="hs-small hs-muted">Thấp nhất {fixed(open.min_score)} · {open.level || 'Chưa có điểm'}</div></div>
                            <div className="hs-card hs-card-b"><div className="hs-small hs-muted">Hạnh kiểm</div><div style={{ fontSize: 24, fontWeight: 800 }}>{open.conduct || '–'}</div><div className="hs-small hs-muted">{open.group ? open.group.name : 'Chưa vào tổ'}{open.absent_30d !== null ? ` · vắng ${open.absent_30d} buổi/30 ngày` : ''}</div></div>
                        </div>
                        <Card title="Lưu ý khi xếp chỗ">
                            <div className="hs-grid" style={{ gap: 8 }}>
                                {([['vision', 'Cận thị', 'glasses'], ['hearing', 'Nghe kém', 'ear'], ['tall', 'Học sinh cao (nên ngồi cuối)', 'ruler'], ['front_required', 'Bắt buộc ngồi bàn đầu', 'layers']] as const).map(([k, label, icon]) => (
                                    <label key={k} className={`hs-check ${form[k] ? 'on' : ''}`}><input type="checkbox" checked={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} /><Icon name={icon} size={16} /><div className="hs-b">{label}</div></label>
                                ))}
                            </div>
                            <Field label="Không nên ngồi cạnh">
                                <div className="hs-row hs-wrap" style={{ marginBottom: 8 }}>
                                    {form.avoid_ids.map((id) => { const s = all.find((x) => x.id === id); return s ? <Badge key={id} tone="bad">{s.full_name} <button className="hs-iconbtn" style={{ width: 18, height: 18, border: 0 }} onClick={() => setForm({ ...form, avoid_ids: form.avoid_ids.filter((x) => x !== id) })} aria-label="Bỏ"><Icon name="x" size={11} /></button></Badge> : null; })}
                                    {form.avoid_ids.length === 0 && <span className="hs-small hs-muted">Chưa có.</span>}
                                </div>
                                <select className="hs-select" value="" onChange={(e) => { const id = Number(e.target.value); if (id && !form.avoid_ids.includes(id)) setForm({ ...form, avoid_ids: [...form.avoid_ids, id] }); }}>
                                    <option value="">+ Thêm bạn cùng lớp…</option>{others.filter((s) => !form.avoid_ids.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                                </select>
                            </Field>
                            <Field label="Ghi chú"><textarea className="hs-textarea" value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ví dụ: hay nói chuyện riêng, cần ngồi gần cửa sổ…" /></Field>
                            <div className="hs-row" style={{ justifyContent: 'flex-end' }}><button className="hs-btn" onClick={() => setOpen(null)}>Đóng</button><button className="hs-btn primary" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu lưu ý'}</button></div>
                        </Card>
                    </div>
                )}
            </Drawer>
        </>
    );
}