'use client';

import { DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQ, useSeating } from '@/components/hr-seating/Shell';
import SeatCanvas, { ColorMode, DragSource, SeatMap, decodeDrag, encodeDrag } from '@/components/hr-seating/SeatCanvas';
import { Avatar, Badge, Card, Empty, ErrorBox, Field, Icon, Modal, PageHeader, Seg, Skeleton, useToast } from '@/components/hr-seating/ui';
import { Layout, OFFICER_SHORT, Seat, Student, clientCheck, downloadCsv, errText, fixed, hrGet, hrSend, seatKey } from '@/lib/hr-seating';

type Snap = { seats: SeatMap; blocked: string[] };
type Proposal = { seats: Seat[]; unplaced?: number[]; conflicts?: number; mode: string };
type ModalKind = null | 'new' | 'meta' | 'auto' | 'rotate' | 'publish' | 'delete';

const toMap = (seats: Seat[]): SeatMap => { const m: SeatMap = {}; seats.forEach((s) => { m[seatKey(s.row, s.col, s.pos)] = { student_id: s.student_id, locked: s.locked, note: s.note }; }); return m; };
const toList = (m: SeatMap): Seat[] => Object.entries(m).map(([k, v]) => { const [row, col, pos] = k.split('-').map(Number); return { row, col, pos, student_id: v.student_id, locked: v.locked, note: v.note ?? null }; });

const MODES = [
    { v: 'alpha', t: 'Theo tên A–Z', d: 'Xếp theo thứ tự tên. Em cận thị lên bàn đầu, em cao xuống bàn cuối.' },
    { v: 'gender_mix', t: 'Xen kẽ nam – nữ', d: 'Mỗi bàn một nam một nữ khi có thể.' },
    { v: 'score_mix', t: 'Xen kẽ học lực', d: 'Em học khá giỏi ngồi cạnh em cần hỗ trợ để kèm cặp.' },
    { v: 'group', t: 'Theo tổ học tập', d: 'Mỗi dãy bàn là một tổ.' },
    { v: 'random', t: 'Ngẫu nhiên', d: 'Xáo trộn, vẫn tuân thủ quy tắc chỗ ngồi.' },
];

export default function ChartPage() {
    const { meta, classId, params } = useSeating();
    const toast = useToast();
    const layouts = useQ<Layout[]>('/layouts');
    const rosterQ = useQ<{ students: Student[] }>('/roster');

    const [layoutId, setLayoutId] = useState<number | null>(null);
    const [layout, setLayout] = useState<Layout | null>(null);
    const [seats, setSeats] = useState<SeatMap>({});
    const [blocked, setBlocked] = useState<string[]>([]);
    const [dirty, setDirty] = useState(false);
    const [past, setPast] = useState<Snap[]>([]);
    const [future, setFuture] = useState<Snap[]>([]);
    const [mode, setMode] = useState<ColorMode>('group');
    const [sel, setSel] = useState<string | null>(null);
    const [selStudent, setSelStudent] = useState<number | null>(null);
    const [over, setOver] = useState<string | null>(null);
    const [poolOver, setPoolOver] = useState(false);
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);
    const [modal, setModal] = useState<ModalKind>(null);
    const [proposal, setProposal] = useState<Proposal | null>(null);
    const [autoMode, setAutoMode] = useState('alpha');
    const [keepLocked, setKeepLocked] = useState(true);
    const [rot, setRot] = useState<{ dir: 'rows' | 'cols'; reverse: boolean }>({ dir: 'rows', reverse: false });
    const [form, setForm] = useState({ name: '', rows_n: 5, cols_n: 4, seats_per_desk: 2, from: 'blank', room_label: '', note: '' });
    const [noteDraft, setNoteDraft] = useState('');

    const students = useMemo(() => rosterQ.data?.students || [], [rosterQ.data]);
    const sMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

    const apply = useCallback((l: Layout) => {
        setLayout(l); setLayoutId(l.id); setSeats(toMap(l.seats || [])); setBlocked(l.blocked); setDirty(false);
        setPast([]); setFuture([]); setSel(null); setSelStudent(null); setProposal(null);
    }, []);
    const load = useCallback(async (id: number) => {
        try { apply(await hrGet<Layout>(`/layouts/${id}`, params)); } catch (e) { toast.error('Không mở được sơ đồ', errText(e)); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params, apply]);

    useEffect(() => { setLayoutId(null); setLayout(null); setSeats({}); }, [classId]);
    useEffect(() => {
        if (!layouts.data) return;
        if (layoutId && layouts.data.some((l) => l.id === layoutId)) return;
        const want = Number(new URLSearchParams(window.location.search).get('layout'));
        const pick = layouts.data.find((l) => l.id === want) || layouts.data.find((l) => l.is_active) || layouts.data[0];
        if (pick) load(pick.id); else { setLayout(null); setLayoutId(null); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layouts.data]);

    const dims = { rows: layout?.rows_n ?? 0, cols: layout?.cols_n ?? 0, per: layout?.seats_per_desk ?? 2 };
    const seatedIds = useMemo(() => new Set(Object.values(seats).map((s) => s.student_id)), [seats]);
    const pool = students.filter((s) => !seatedIds.has(s.id) && (!query.trim() || s.full_name.toLowerCase().includes(query.trim().toLowerCase())));
    const checks = useMemo(() => (layout ? clientCheck(seats, students, dims) : []), [seats, students, layout]); // eslint-disable-line react-hooks/exhaustive-deps
    const warnIds = useMemo(() => new Set(checks.filter((c) => c.level !== 'info').flatMap((c) => c.ids)), [checks]);
    const blockedSet = useMemo(() => new Set(blocked), [blocked]);
    const total = students.length;

    // ---------- chỉnh sửa có hoàn tác ----------
    const commit = (next: SeatMap, nextBlocked: string[] = blocked) => {
        setPast((p) => [...p.slice(-40), { seats, blocked }]);
        setFuture([]); setSeats(next); setBlocked(nextBlocked); setDirty(true);
    };
    const undo = () => { const p = past[past.length - 1]; if (!p) return; setFuture((f) => [{ seats, blocked }, ...f]); setPast(past.slice(0, -1)); setSeats(p.seats); setBlocked(p.blocked); setDirty(true); };
    const redo = () => { const f = future[0]; if (!f) return; setPast((p) => [...p, { seats, blocked }]); setFuture(future.slice(1)); setSeats(f.seats); setBlocked(f.blocked); setDirty(true); };

    const place = (key: string, id: number) => {
        if (seats[key]?.locked) { toast.warn('Chỗ này đang được khóa'); return; }
        const n = { ...seats };
        Object.keys(n).forEach((k) => { if (n[k].student_id === id) delete n[k]; });
        n[key] = { student_id: id, locked: false, note: null };
        commit(n);
    };
    const moveSeat = (from: string, to: string) => {
        if (from === to) return;
        const a = seats[from], b = seats[to];
        if (!a) return;
        if (a.locked || b?.locked) { toast.warn('Chỗ đã khóa, hãy mở khóa trước khi di chuyển'); return; }
        const n = { ...seats };
        delete n[from];
        n[to] = a;
        if (b) n[from] = b;
        commit(n);
    };
    const onDropSeat = (key: string, src: DragSource) => { if (src.kind === 'pool') place(key, src.id); else moveSeat(src.key, key); };
    const onSeatClick = (key: string) => {
        if (blockedSet.has(key) && !sel) { setSel(key); return; }
        if (selStudent !== null && !blockedSet.has(key)) { place(key, selStudent); setSelStudent(null); return; }
        if (sel && sel !== key && !blockedSet.has(sel) && !blockedSet.has(key) && (seats[sel] || seats[key])) { moveSeat(sel, key); setSel(null); return; }
        setSel(sel === key ? null : key);
        setNoteDraft(seats[key]?.note || '');
    };
    const removeSeat = (key: string) => {
        if (!seats[key]) return;
        if (seats[key].locked) { toast.warn('Hãy mở khóa chỗ trước khi gỡ'); return; }
        const n = { ...seats }; delete n[key]; commit(n);
    };
    const toggleLock = (key: string) => { if (!seats[key]) return; commit({ ...seats, [key]: { ...seats[key], locked: !seats[key].locked } }); };
    const toggleBlock = (key: string) => {
        if (seats[key]) { toast.warn('Hãy gỡ học sinh khỏi chỗ này trước khi khóa chỗ'); return; }
        commit(seats, blockedSet.has(key) ? blocked.filter((k) => k !== key) : [...blocked, key]);
    };
    const saveNote = (key: string) => { if (seats[key] && (seats[key].note || '') !== noteDraft) commit({ ...seats, [key]: { ...seats[key], note: noteDraft || null } }); };
    const dropPool = (e: DragEvent) => { e.preventDefault(); setPoolOver(false); const src = decodeDrag(e); if (src?.kind === 'seat') removeSeat(src.key); };

    // ---------- gọi máy chủ ----------
    const save = async (silent = false): Promise<boolean> => {
        if (!layout) return false;
        setBusy(true);
        try {
            const r = await hrSend<Layout>('PUT', `/layouts/${layout.id}/seats`, { seats: toList(seats), blocked, version: layout.version }, params);
            apply(r.data);
            if (!silent) toast.success('Đã lưu sơ đồ', `${r.data.seated} học sinh đã có chỗ`);
            layouts.reload();
            return true;
        } catch (e) { toast.error('Không lưu được', errText(e)); return false; } finally { setBusy(false); }
    };
    const ensureSaved = async () => (dirty ? save(true) : true);

    const runPreview = async (kind: 'auto' | 'rotate') => {
        if (!layout || !(await ensureSaved())) return;
        setBusy(true);
        try {
            const r = kind === 'auto'
                ? await hrSend<Proposal>('POST', `/layouts/${layout.id}/auto`, { mode: autoMode, keep_locked: keepLocked, seed: Math.floor(Math.random() * 100000) }, params)
                : await hrSend<Proposal>('POST', `/layouts/${layout.id}/rotate`, { direction: rot.dir, reverse: rot.reverse }, params);
            setProposal(r.data);
        } catch (e) { toast.error('Không tạo được bản xem trước', errText(e)); } finally { setBusy(false); }
    };
    const applyProposal = () => { if (!proposal) return; commit(toMap(proposal.seats)); setProposal(null); setModal(null); toast.info('Đã áp dụng bản xem trước', 'Nhớ bấm Lưu để ghi vào hệ thống.'); };

    const createLayout = async () => {
        setBusy(true);
        try {
            const r = await hrSend<Layout>('POST', '/layouts', { name: form.name || 'Sơ đồ mới', rows_n: form.rows_n, cols_n: form.cols_n, seats_per_desk: form.seats_per_desk, from: form.from, source_id: layout?.id, room_label: form.room_label || null, note: form.note || null }, params);
            apply(r.data); layouts.reload(); setModal(null); toast.success('Đã tạo sơ đồ', r.data.name);
        } catch (e) { toast.error('Không tạo được sơ đồ', errText(e)); } finally { setBusy(false); }
    };
    const saveMeta = async () => {
        if (!layout || !(await ensureSaved())) return;
        setBusy(true);
        try {
            const r = await hrSend<Layout & { removed?: number }>('PUT', `/layouts/${layout.id}`, { name: form.name, rows_n: form.rows_n, cols_n: form.cols_n, seats_per_desk: form.seats_per_desk, room_label: form.room_label || null, note: form.note || null }, params);
            apply(r.data); layouts.reload(); setModal(null);
            toast.success('Đã cập nhật sơ đồ', r.data.removed ? `Đã gỡ ${r.data.removed} em nằm ngoài vùng mới` : undefined);
        } catch (e) { toast.error('Không cập nhật được', errText(e)); } finally { setBusy(false); }
    };
    const publish = async () => {
        if (!layout || !(await ensureSaved())) return;
        setBusy(true);
        try { const r = await hrSend<Layout>('POST', `/layouts/${layout.id}/publish`, {}, params); apply(r.data); layouts.reload(); setModal(null); toast.success('Đã công bố sơ đồ', 'Sơ đồ này là bản đang áp dụng của lớp.'); }
        catch (e) { toast.error('Không công bố được', errText(e)); } finally { setBusy(false); }
    };
    const remove = async () => {
        if (!layout) return;
        setBusy(true);
        try { await hrSend('DELETE', `/layouts/${layout.id}`, undefined, params); setModal(null); setLayoutId(null); setLayout(null); layouts.reload(); toast.success('Đã xóa sơ đồ'); }
        catch (e) { toast.error('Không xóa được', errText(e)); } finally { setBusy(false); }
    };

    const exportCsv = () => {
        if (!layout) return;
        const rows = toList(seats).sort((a, b) => a.row - b.row || a.col - b.col || a.pos - b.pos).map((s) => {
            const st = sMap.get(s.student_id);
            return [s.row + 1, s.col + 1, s.pos + 1, st?.code, st?.full_name, st?.gender, st?.group?.name || ''];
        });
        downloadCsv(`so-do-${meta.class.name}-${layout.name}.csv`, [['Hàng bàn', 'Dãy', 'Chỗ', 'Mã HS', 'Họ và tên', 'Giới tính', 'Tổ'], ...rows]);
    };

    // phím tắt: Ctrl+Z / Ctrl+Y / Ctrl+S / Delete / Esc
    const hot = useRef({ undo, redo, save, removeSeat, sel });
    hot.current = { undo, redo, save, removeSeat, sel };
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); hot.current.undo(); }
            else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); hot.current.redo(); }
            else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); hot.current.save(); }
            else if (!typing && (e.key === 'Delete' || e.key === 'Backspace') && hot.current.sel) { hot.current.removeSeat(hot.current.sel); }
            else if (e.key === 'Escape') { setSel(null); setSelStudent(null); }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, []);

    const openMeta = () => { if (!layout) return; setForm({ name: layout.name, rows_n: layout.rows_n, cols_n: layout.cols_n, seats_per_desk: layout.seats_per_desk, from: 'blank', room_label: layout.room_label || '', note: layout.note || '' }); setModal('meta'); };
    const openNew = () => { setForm({ name: '', rows_n: layout?.rows_n ?? 5, cols_n: layout?.cols_n ?? 4, seats_per_desk: layout?.seats_per_desk ?? 2, from: 'alpha', room_label: '', note: '' }); setModal('new'); };
    const selStd = sel && seats[sel] ? sMap.get(seats[sel].student_id) : null;
    const capacity = dims.rows * dims.cols * dims.per - blocked.length;
    const sizeFields = (
        <div className="hs-grid hs-g3" style={{ gap: 10 }}>
            <Field label="Số hàng bàn"><input type="number" min={1} max={12} className="hs-input" value={form.rows_n} onChange={(e) => setForm({ ...form, rows_n: Number(e.target.value) })} /></Field>
            <Field label="Số dãy bàn"><input type="number" min={1} max={8} className="hs-input" value={form.cols_n} onChange={(e) => setForm({ ...form, cols_n: Number(e.target.value) })} /></Field>
            <Field label="Chỗ mỗi bàn"><input type="number" min={1} max={3} className="hs-input" value={form.seats_per_desk} onChange={(e) => setForm({ ...form, seats_per_desk: Number(e.target.value) })} /></Field>
        </div>
    );

    return (
        <>
            <PageHeader title="Sơ đồ chỗ ngồi" desc="Kéo học sinh vào chỗ ngồi hoặc bấm chọn rồi bấm vào vị trí. Ctrl+Z hoàn tác, Ctrl+S lưu.">
                <div className="hs-save-bar hs-no-print">
                    <button className="hs-btn sm" onClick={undo} disabled={!past.length} title="Hoàn tác (Ctrl+Z)"><Icon name="undo" size={15} /></button>
                    <button className="hs-btn sm" onClick={redo} disabled={!future.length} title="Làm lại (Ctrl+Y)"><Icon name="redo" size={15} /></button>
                    <button className="hs-btn" disabled={!layout} onClick={() => { setProposal(null); setModal('auto'); }}><Icon name="wand" size={16} /> Tự xếp</button>
                    <button className="hs-btn" disabled={!layout} onClick={() => { setProposal(null); setModal('rotate'); }}><Icon name="refresh" size={16} /> Xoay vòng</button>
                    <button className="hs-btn" disabled={!layout} onClick={() => window.print()}><Icon name="print" size={16} /> In</button>
                    <button className="hs-btn" disabled={!layout} onClick={exportCsv}><Icon name="download" size={16} /> Xuất CSV</button>
                    <button className="hs-btn primary" disabled={!layout || busy || !dirty} onClick={() => save()}><Icon name="check" size={16} /> {busy ? 'Đang lưu…' : 'Lưu'}</button>
                    <button className="hs-btn ok" disabled={!layout || busy} onClick={() => setModal('publish')}><Icon name="award" size={16} /> Công bố</button>
                </div>
            </PageHeader>

            <div className="hs-row hs-wrap hs-no-print" style={{ marginBottom: 14 }}>
                <select className="hs-select inline" style={{ minWidth: 260 }} value={layoutId ?? ''} onChange={(e) => { if (dirty && !confirmLeave()) return; load(Number(e.target.value)); }} aria-label="Phiên bản sơ đồ">
                    {(layouts.data || []).map((l) => <option key={l.id} value={l.id}>{l.is_active ? '★ ' : ''}{l.name}</option>)}
                </select>
                <button className="hs-btn sm" onClick={openNew}><Icon name="plus" size={14} /> Sơ đồ mới</button>
                <button className="hs-btn sm" disabled={!layout} onClick={openMeta}><Icon name="edit" size={14} /> Tên & kích thước</button>
                <button className="hs-btn sm bad" disabled={!layout || layout.is_active} onClick={() => setModal('delete')}><Icon name="trash" size={14} /> Xóa</button>
                <span className="hs-right hs-row">
          <Seg<ColorMode> value={mode} onChange={setMode} options={[{ value: 'group', label: 'Tô theo tổ' }, { value: 'gender', label: 'Giới tính' }, { value: 'level', label: 'Học lực' }, { value: 'none', label: 'Không tô' }]} />
                    {dirty && <span className="hs-dirty"><Icon name="alert" size={13} /> Chưa lưu</span>}
                    {layout?.is_active && <Badge tone="ok">Đang áp dụng</Badge>}
        </span>
            </div>

            {layouts.error && !layouts.data ? <ErrorBox error={layouts.error} onRetry={layouts.reload} /> : (layouts.loading && !layouts.data) || (rosterQ.loading && !rosterQ.data) ? <Skeleton h={120} n={3} /> : !layout ? (
                <Card><Empty icon="layers" title="Lớp chưa có sơ đồ nào" hint="Tạo sơ đồ đầu tiên, có thể xếp sẵn theo tên A–Z." />
                    <div style={{ textAlign: 'center', paddingBottom: 20 }}><button className="hs-btn primary" onClick={openNew}><Icon name="plus" size={16} /> Tạo sơ đồ</button></div></Card>
            ) : (
                <div className="hs-editor">
                    <aside className="hs-side hs-no-print">
                        <Card title={`Chưa xếp chỗ (${pool.length})`}>
                            <input className="hs-input" placeholder="Tìm học sinh…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ marginBottom: 10 }} />
                            <div className={`hs-dropzone ${poolOver ? 'over' : ''}`} style={{ marginBottom: 10 }}
                                 onDragOver={(e) => { e.preventDefault(); setPoolOver(true); }} onDragLeave={() => setPoolOver(false)} onDrop={dropPool}>
                                Kéo học sinh từ sơ đồ về đây để gỡ khỏi chỗ
                            </div>
                            <div className="hs-pool">
                                {pool.length === 0 ? <div className="hs-small hs-muted" style={{ textAlign: 'center', padding: 14 }}>{total ? 'Tất cả học sinh đã có chỗ ✓' : 'Chưa có danh sách lớp'}</div> : pool.map((s) => (
                                    <div key={s.id} className={`hs-pool-i ${selStudent === s.id ? 'sel' : ''}`} draggable onDragStart={(e) => encodeDrag(e, { kind: 'pool', id: s.id })}
                                         onClick={() => { setSelStudent(selStudent === s.id ? null : s.id); setSel(null); }}>
                                        <Avatar name={s.full_name} size={28} />
                                        <div style={{ flex: 1, minWidth: 0 }}><div className="hs-b" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.full_name}</div>
                                            <div className="hs-small hs-muted">{s.gender}{s.group ? ` · ${s.group.name}` : ''}</div></div>
                                        {s.flags.vision && <Icon name="glasses" size={14} />}{s.flags.tall && <Icon name="ruler" size={14} />}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </aside>

                    <section className="hs-card hs-print-area">
                        <div className="hs-card-b">
                            <div className="hs-print-head"><h2 style={{ margin: 0 }}>{layout.name}</h2><div>Lớp {meta.class.name} · Năm học {meta.year_label} · Giáo viên chủ nhiệm: {meta.staff.name}</div></div>
                            <SeatCanvas rows={dims.rows} cols={dims.cols} per={dims.per} blocked={blockedSet} seats={seats} students={sMap} mode={mode}
                                        selected={sel} warnIds={warnIds} overKey={over} onSeatClick={onSeatClick} onDropSeat={onDropSeat} onOver={setOver} />
                            <div className="hs-row hs-wrap hs-small hs-muted" style={{ marginTop: 12, justifyContent: 'space-between' }}>
                                <span>{seatedIds.size}/{total} học sinh đã xếp · {capacity} chỗ khả dụng{blocked.length ? ` (${blocked.length} chỗ khóa)` : ''}</span>
                                <span className="hs-row" style={{ gap: 12 }}><span><Icon name="glasses" size={12} /> cận thị</span><span><Icon name="ear" size={12} /> nghe kém</span><span><Icon name="ruler" size={12} /> cao</span><span><Icon name="lock" size={12} /> đã khóa</span><span><Icon name="star" size={12} /> cán sự</span></span>
                            </div>
                        </div>
                    </section>

                    <aside className="hs-side hs-no-print">
                        <div className="hs-grid" style={{ gap: 14 }}>
                            <Card title="Chi tiết chỗ ngồi">
                                {!sel ? <div className="hs-small hs-muted">Bấm vào một chỗ trong sơ đồ để xem, khóa, ghi chú hoặc gỡ học sinh.</div> : (
                                    <div className="hs-grid" style={{ gap: 10 }}>
                                        <div className="hs-small hs-muted">Hàng {Number(sel.split('-')[0]) + 1} · Dãy {Number(sel.split('-')[1]) + 1} · Chỗ {Number(sel.split('-')[2]) + 1}</div>
                                        {selStd ? (
                                            <>
                                                <div className="hs-row"><Avatar name={selStd.full_name} /><div><div className="hs-b">{selStd.full_name}</div><div className="hs-small hs-muted">{selStd.code} · {selStd.gender} · {selStd.age} tuổi</div></div></div>
                                                <div className="hs-row hs-wrap">
                                                    {selStd.group && <Badge tone="primary">{selStd.group.name}</Badge>}
                                                    {selStd.level && <Badge tone={selStd.level === 'Tốt' ? 'ok' : selStd.level === 'Chưa đạt' ? 'bad' : 'primary'}>{selStd.level} · {fixed(selStd.avg_score, 2)}</Badge>}
                                                    {selStd.officer_roles.map((r) => <Badge key={r} tone="warn"><Icon name="star" size={11} /> {OFFICER_SHORT[r] || r}</Badge>)}
                                                </div>
                                                {(selStd.flags.vision || selStd.flags.hearing || selStd.flags.tall || selStd.flags.note) && <div className="hs-alert hs-tone-info hs-small"><Icon name="info" size={15} /><div>{[selStd.flags.vision && 'Cận thị', selStd.flags.hearing && 'Nghe kém', selStd.flags.tall && 'Cao', selStd.flags.note].filter(Boolean).join(' · ')}</div></div>}
                                                <Field label="Ghi chú chỗ ngồi"><input className="hs-input" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} onBlur={() => saveNote(sel)} placeholder="Ví dụ: ngồi gần cửa sổ" /></Field>
                                                <div className="hs-row hs-wrap">
                                                    <button className="hs-btn sm" onClick={() => toggleLock(sel)}><Icon name={seats[sel].locked ? 'unlock' : 'lock'} size={14} /> {seats[sel].locked ? 'Mở khóa' : 'Khóa chỗ'}</button>
                                                    <button className="hs-btn sm bad" onClick={() => removeSeat(sel)}><Icon name="x" size={14} /> Gỡ khỏi chỗ</button>
                                                </div>
                                            </>
                                        ) : (
                                            <button className="hs-btn sm" onClick={() => toggleBlock(sel)}><Icon name="ban" size={14} /> {blockedSet.has(sel) ? 'Mở lại chỗ này' : 'Khóa chỗ (bàn hỏng / lối đi)'}</button>
                                        )}
                                    </div>
                                )}
                            </Card>
                            <Card title={`Kiểm tra sơ đồ ${checks.filter((c) => c.level !== 'info').length ? `(${checks.filter((c) => c.level !== 'info').length})` : ''}`}>
                                {checks.length === 0 ? <div className="hs-alert hs-tone-ok"><Icon name="check" /><div><b>Sơ đồ hợp lệ</b><div className="hs-small">Không có cảnh báo.</div></div></div> : (
                                    <div className="hs-grid" style={{ gap: 8 }}>{checks.map((c, i) => (
                                        <div key={i} className={`hs-alert hs-small hs-tone-${c.level === 'error' ? 'bad' : c.level === 'warn' ? 'warn' : 'info'}`}><Icon name={c.level === 'info' ? 'info' : 'alert'} size={15} /><div>{c.text}</div></div>
                                    ))}</div>
                                )}
                            </Card>
                        </div>
                    </aside>
                </div>
            )}

            {/* ---- Tự xếp ---- */}
            <Modal open={modal === 'auto'} onClose={() => setModal(null)} title="Tự xếp chỗ ngồi" width={proposal ? 920 : 560}
                   footer={<><button className="hs-btn" onClick={() => setModal(null)}>Đóng</button>
                       <button className="hs-btn" disabled={busy} onClick={() => runPreview('auto')}>{busy ? 'Đang tính…' : proposal ? 'Xếp lại' : 'Xem trước'}</button>
                       {proposal && <button className="hs-btn primary" onClick={applyProposal}>Áp dụng</button>}</>}>
                <div className="hs-grid" style={{ gap: 10 }}>
                    {MODES.map((m) => (
                        <label key={m.v} className={`hs-check ${autoMode === m.v ? 'on' : ''}`}>
                            <input type="radio" name="am" checked={autoMode === m.v} onChange={() => { setAutoMode(m.v); setProposal(null); }} /><div><div className="hs-b">{m.t}</div><div className="hs-small hs-muted">{m.d}</div></div>
                        </label>
                    ))}
                    <label className="hs-row"><input type="checkbox" checked={keepLocked} onChange={(e) => setKeepLocked(e.target.checked)} /> Giữ nguyên các chỗ đã khóa</label>
                    {proposal && layout && (
                        <>
                            <div className={`hs-alert ${proposal.conflicts || proposal.unplaced?.length ? 'hs-tone-warn' : 'hs-tone-ok'}`}><Icon name={proposal.conflicts || proposal.unplaced?.length ? 'alert' : 'check'} />
                                <div>{proposal.unplaced?.length ? `${proposal.unplaced.length} học sinh chưa có chỗ (thiếu chỗ). ` : ''}{proposal.conflicts ? `${proposal.conflicts} cặp không nên ngồi cạnh chưa tránh được.` : 'Không có xung đột. Bấm “Áp dụng” để dùng bản này.'}</div></div>
                            <SeatCanvas rows={dims.rows} cols={dims.cols} per={dims.per} blocked={blockedSet} seats={toMap(proposal.seats)} students={sMap} mode={mode} readOnly compact />
                        </>
                    )}
                </div>
            </Modal>

            {/* ---- Xoay vòng ---- */}
            <Modal open={modal === 'rotate'} onClose={() => setModal(null)} title="Xoay vòng chỗ ngồi" width={proposal ? 920 : 520}
                   footer={<><button className="hs-btn" onClick={() => setModal(null)}>Đóng</button>
                       <button className="hs-btn" disabled={busy} onClick={() => runPreview('rotate')}>{busy ? 'Đang tính…' : 'Xem trước'}</button>
                       {proposal && <button className="hs-btn primary" onClick={applyProposal}>Áp dụng</button>}</>}>
                <div className="hs-grid" style={{ gap: 10 }}>
                    <p className="hs-small hs-muted" style={{ margin: 0 }}>Dùng định kỳ (mỗi tuần hoặc mỗi tháng) để mọi em đều được ngồi các vị trí khác nhau. Em cận thị, em cao và các chỗ đã khóa giữ nguyên.</p>
                    <label className={`hs-check ${rot.dir === 'rows' ? 'on' : ''}`}><input type="radio" checked={rot.dir === 'rows'} onChange={() => { setRot({ ...rot, dir: 'rows' }); setProposal(null); }} /><div><div className="hs-b">Đổi hàng</div><div className="hs-small hs-muted">Mỗi em lùi một hàng bàn (hàng cuối lên đầu).</div></div></label>
                    <label className={`hs-check ${rot.dir === 'cols' ? 'on' : ''}`}><input type="radio" checked={rot.dir === 'cols'} onChange={() => { setRot({ ...rot, dir: 'cols' }); setProposal(null); }} /><div><div className="hs-b">Đổi dãy</div><div className="hs-small hs-muted">Mỗi em dịch sang bàn bên cạnh trong cùng hàng.</div></div></label>
                    <label className="hs-row"><input type="checkbox" checked={rot.reverse} onChange={(e) => { setRot({ ...rot, reverse: e.target.checked }); setProposal(null); }} /> Xoay ngược chiều</label>
                    {proposal && layout && <SeatCanvas rows={dims.rows} cols={dims.cols} per={dims.per} blocked={blockedSet} seats={toMap(proposal.seats)} students={sMap} mode={mode} readOnly compact />}
                </div>
            </Modal>

            {/* ---- Tạo / sửa thông tin ---- */}
            <Modal open={modal === 'new' || modal === 'meta'} onClose={() => setModal(null)} title={modal === 'new' ? 'Tạo sơ đồ mới' : 'Tên & kích thước sơ đồ'} width={560}
                   footer={<><button className="hs-btn" onClick={() => setModal(null)}>Hủy</button><button className="hs-btn primary" disabled={busy} onClick={modal === 'new' ? createLayout : saveMeta}>{busy ? 'Đang lưu…' : modal === 'new' ? 'Tạo sơ đồ' : 'Lưu thay đổi'}</button></>}>
                <Field label="Tên sơ đồ"><input className="hs-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ví dụ: Sơ đồ tháng 11" /></Field>
                {sizeFields}
                <div className="hs-grid hs-g2" style={{ gap: 10 }}>
                    <Field label="Phòng học (không bắt buộc)"><input className="hs-input" value={form.room_label} onChange={(e) => setForm({ ...form, room_label: e.target.value })} placeholder="Phòng 201" /></Field>
                    <Field label="Ghi chú"><input className="hs-input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
                </div>
                {modal === 'new' && (
                    <Field label="Bắt đầu từ"><select className="hs-select" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })}>
                        <option value="alpha">Xếp sẵn theo tên A–Z</option><option value="blank">Sơ đồ trống</option>{layout && <option value="copy">Sao chép sơ đồ đang mở</option>}</select></Field>
                )}
                <div className="hs-small hs-muted">Sức chứa: {form.rows_n * form.cols_n * form.seats_per_desk} chỗ · Lớp có {total} học sinh.{modal === 'meta' ? ' Thu nhỏ sơ đồ sẽ gỡ các em nằm ngoài vùng mới.' : ''}</div>
            </Modal>

            <Modal open={modal === 'publish'} onClose={() => setModal(null)} title="Công bố sơ đồ này?"
                   footer={<><button className="hs-btn" onClick={() => setModal(null)}>Hủy</button><button className="hs-btn ok" disabled={busy} onClick={publish}>{busy ? 'Đang xử lý…' : 'Công bố'}</button></>}>
                <p>Sơ đồ <b>{layout?.name}</b> sẽ trở thành bản đang áp dụng của lớp {meta.class.name}; bản hiện tại chuyển sang lưu trữ.</p>
                {checks.filter((c) => c.level !== 'info').length > 0 && <div className="hs-alert hs-tone-warn"><Icon name="alert" /><div><b>Còn {checks.filter((c) => c.level !== 'info').length} cảnh báo</b>{checks.filter((c) => c.level !== 'info').map((c, i) => <div key={i} className="hs-small">{c.text}</div>)}</div></div>}
            </Modal>
            <Modal open={modal === 'delete'} onClose={() => setModal(null)} title="Xóa sơ đồ này?"
                   footer={<><button className="hs-btn" onClick={() => setModal(null)}>Hủy</button><button className="hs-btn bad" disabled={busy} onClick={remove}>Xóa sơ đồ</button></>}>
                <p>Sơ đồ <b>{layout?.name}</b> sẽ bị xóa vĩnh viễn.</p>
            </Modal>
        </>
    );
}

function confirmLeave(): boolean {
    return typeof window === 'undefined' ? true : window.confirm('Sơ đồ có thay đổi chưa lưu. Bỏ thay đổi và chuyển sang phiên bản khác?');
}