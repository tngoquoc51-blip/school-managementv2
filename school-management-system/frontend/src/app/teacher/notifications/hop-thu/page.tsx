'use client';
// Hộp thư thông báo (/teacher/notifications/hop-thu)
import { useSearchParams } from 'next/navigation';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Btn, Drawer, Empty, ErrorBox, Ico, Item, ItemDetail, KIND, KINDS, Kind, Loading, Pager, Row, SnoozeModal, Counts, Page as PageInfo, Tabs, act, groupOf, nt, qs, useDebounced, useLoad, useTa } from '../_nt';

type Res = { meta: PageInfo; counts: Counts; by_kind: Record<string, number>; kinds: Record<string, string>; data: Item[] };
type TabKey = 'all' | 'unread' | 'starred' | 'snoozed' | 'archived';
const TABS: TabKey[] = ['all', 'unread', 'starred', 'snoozed', 'archived'];

export default function Page() { return <Suspense fallback={<Loading />}><Inbox /></Suspense>; }

function Inbox() {
    const sp = useSearchParams(); const { toast, refresh } = useTa();
    const t0 = sp.get('tab') as TabKey; const [tab, setTab] = useState<TabKey>(TABS.includes(t0) ? t0 : 'all');
    const [kind, setKind] = useState(sp.get('kind') || ''); const [prio, setPrio] = useState(sp.get('priority') || ''); const [q, setQ] = useState(''); const [page, setPage] = useState(1);
    const dq = useDebounced(q);
    const { data, err, loading, reload } = useLoad(() => nt<Res>(`feed${qs({ tab, kind, priority: prio, q: dq, page })}`), [tab, kind, prio, dq, page]);
    const [sel, setSel] = useState<string | null>(null); const [checked, setChecked] = useState<Set<string>>(new Set()); const [snz, setSnz] = useState<string[] | null>(null);
    const [autoRead, setAutoRead] = useState(false); const [narrow, setNarrow] = useState(false); const [busy, setBusy] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => { nt<{ data: { auto_read: boolean } }>('prefs').then((r) => setAutoRead(r.data.auto_read)).catch(() => { /* mặc định */ }); }, []);
    useEffect(() => { const f = () => setNarrow(window.innerWidth < 1100); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
    useEffect(() => { setPage(1); setChecked(new Set()); }, [tab, kind, prio, dq]);

    const items = useMemo(() => data?.data || [], [data]);
    const cur = items.find((i) => i.key === sel) || null;
    const groups = useMemo(() => { const m: [string, Item[]][] = []; items.forEach((i) => { const g = i.pinned ? 'Đã ghim' : groupOf(i.created_at); const last = m[m.length - 1]; if (last && last[0] === g) last[1].push(i); else m.push([g, [i]]); }); return m; }, [items]);

    const run = useCallback(async (keys: string[], a: Parameters<typeof act>[1], msg?: string) => {
        setBusy(true); try { const r = await act(keys, a); toast(msg || r.message); setChecked(new Set()); refresh(); reload(); } catch (e) { toast((e as Error).message, 'err'); } setBusy(false);
    }, [toast, refresh, reload]);

    const open = (it: Item) => { setSel(it.key); if (autoRead && !it.read) run([it.key], 'read', 'Đã đánh dấu đã đọc.'); };

    // phím tắt: j/k chọn, s sao, e lưu trữ, u đổi đã đọc/chưa đọc
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement; if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return; if (e.ctrlKey || e.metaKey || e.altKey) return;
            const i = items.findIndex((x) => x.key === sel);
            if (e.key === 'j') { const n = items[Math.min(items.length - 1, i + 1)]; if (n) open(n); } else if (e.key === 'k') { const n = items[Math.max(0, i - 1)]; if (n) open(n); }
            else if (cur && e.key === 's') run([cur.key], cur.starred ? 'unstar' : 'star'); else if (cur && e.key === 'e') run([cur.key], cur.archived ? 'unarchive' : 'archive'); else if (cur && e.key === 'u') run([cur.key], cur.read ? 'unread' : 'read');
        };
        window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
    });

    const c = data?.counts; const allChecked = items.length > 0 && items.every((i) => checked.has(i.key));
    const toggle = (k: string, v: boolean) => setChecked((p) => { const n = new Set(p); if (v) n.add(k); else n.delete(k); return n; });
    const ks = Array.from(checked);

    const list = (
        <div className="nt-pane list">
            <div className="nt-bar">
                <label className="ta-search" style={{ flex: 1, minWidth: 180 }}><Ico n="search" size={16} /><input placeholder="Tìm tiêu đề, nội dung, người gửi…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
                <select value={prio} onChange={(e) => setPrio(e.target.value)} aria-label="Mức độ"><option value="">Mọi mức độ</option><option value="urgent">Khẩn cấp</option><option value="high">Quan trọng</option><option value="normal">Bình thường</option></select>
            </div>
            {checked.size > 0 ? (
                <div className="nt-bulk"><b>Đã chọn {checked.size}</b>
                    <Btn size="sm" disabled={busy} onClick={() => run(ks, 'read')}>Đã đọc</Btn><Btn size="sm" disabled={busy} onClick={() => run(ks, 'unread')}>Chưa đọc</Btn><Btn size="sm" disabled={busy} onClick={() => run(ks, 'star')}>Gắn sao</Btn>
                    <Btn size="sm" disabled={busy} onClick={() => setSnz(ks)}>Nhắc lại</Btn><Btn size="sm" disabled={busy} onClick={() => run(ks, tab === 'archived' ? 'unarchive' : 'archive')}>{tab === 'archived' ? 'Bỏ lưu trữ' : 'Lưu trữ'}</Btn><Btn size="sm" onClick={() => setChecked(new Set())}>Bỏ chọn</Btn></div>
            ) : (
                <div className="nt-bar" style={{ paddingTop: 8, paddingBottom: 8 }}>
                    <label className="nt-chk" style={{ padding: 0 }}><input type="checkbox" checked={allChecked} onChange={(e) => setChecked(e.target.checked ? new Set(items.map((i) => i.key)) : new Set())} aria-label="Chọn tất cả" /></label>
                    <span className="nt-kbd"><kbd>J</kbd>/<kbd>K</kbd> chọn · <kbd>S</kbd> sao · <kbd>E</kbd> lưu trữ · <kbd>U</kbd> đã/chưa đọc</span>
                </div>
            )}
            <div className="nt-scroll" ref={listRef}>
                {loading && !data ? <Loading /> : err || !data ? <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} /> : items.length === 0 ? (
                    <Empty icon="bell" title={tab === 'unread' ? 'Không có thông báo chưa đọc' : tab === 'starred' ? 'Chưa có thông báo gắn sao' : tab === 'snoozed' ? 'Không có thông báo nào đang hoãn' : tab === 'archived' ? 'Chưa lưu trữ thông báo nào' : 'Hộp thư trống'} text={q || kind || prio ? 'Thử bỏ bớt bộ lọc.' : 'Thông báo mới sẽ hiện ở đây.'} />
                ) : (
                    <div className="nt-list">{groups.map(([g, rows]) => (
                        <div key={g}><div className="nt-group">{g}</div>{rows.map((it) => <Row key={it.key} it={it} active={it.key === sel} checked={checked.has(it.key)} onCheck={(v) => toggle(it.key, v)} onOpen={() => open(it)} onStar={() => run([it.key], it.starred ? 'unstar' : 'star', it.starred ? 'Đã bỏ gắn sao.' : 'Đã gắn sao.')} />)}</div>))}</div>
                )}
            </div>
            {data && data.meta.pages > 1 && <Pager page={data.meta.page} pages={data.meta.pages} total={data.meta.total} onPage={setPage} />}
        </div>
    );

    return (
        <div className="ta-page">
            <Tabs value={tab} onChange={setTab} items={[{ key: 'all', label: 'Hộp thư', count: c?.all }, { key: 'unread', label: 'Chưa đọc', count: c?.unread, tone: 'rose' }, { key: 'starred', label: 'Gắn sao', count: c?.starred }, { key: 'snoozed', label: 'Tạm hoãn', count: c?.snoozed }, { key: 'archived', label: 'Lưu trữ', count: c?.archived }]} />
            <div className="nt-chips">
                <button type="button" className={`nt-chip${kind === '' ? ' on' : ''}`} onClick={() => setKind('')}>Tất cả loại</button>
                {KINDS.map((k: Kind) => <button key={k} type="button" className={`nt-chip${kind === k ? ' on' : ''}`} onClick={() => setKind(kind === k ? '' : k)}><Ico n={KIND[k].icon} size={14} />{KIND[k].label}{(data?.by_kind[k] || 0) > 0 && <em>{data?.by_kind[k]}</em>}</button>)}
                <span style={{ flex: 1 }} />
                <Btn size="sm" disabled={!c || c.unread === 0} onClick={async () => { try { const r = await nt<{ message: string }>('read-all', { method: 'POST', body: { kind: kind || undefined } }); toast(r.message); refresh(); reload(); } catch (e) { toast((e as Error).message, 'err'); } }}><Ico n="checks" size={15} />Đánh dấu {kind ? KIND[kind as Kind].label.toLowerCase() : 'tất cả'} đã đọc</Btn>
            </div>
            <div className="nt-split">
                {list}
                {!narrow && <div className="nt-pane view">{cur ? <ItemDetail it={cur} onChange={reload} /> : <Empty icon="bell" title="Chọn một thông báo để xem" text="Bấm vào thông báo ở bên trái. Dùng phím J/K để chuyển nhanh." />}</div>}
            </div>
            {narrow && cur && <Drawer title="Chi tiết thông báo" onClose={() => setSel(null)}><ItemDetail compact it={cur} onChange={reload} /></Drawer>}
            {snz && <SnoozeModal keys={snz} onClose={() => setSnz(null)} onDone={() => { setSnz(null); setChecked(new Set()); refresh(); reload(); }} />}
        </div>
    );
}