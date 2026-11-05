'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Card, Confirm, Empty, ErrorBox, Field, LEVEL, Loading, Modal, Pager, Pill, Tabs, WriteNote, ago, dt, downloadCsv, mon, qs, useDebounced, useLoad, useMon } from '../_hl';

export default function Logs() { return <Suspense fallback={<Loading rows={4} />}><LogsInner /></Suspense>; }

const SRC: Record<string, string> = { audit: 'Thao tác người dùng', auth: 'Đăng nhập', api: 'API / lỗi', admin: 'Quản trị giám sát', system: 'Hệ thống' };

function LogsInner() {
    const [tab, setTab] = useState('he-thong');
    return (
        <div className="hl-stack">
            <Tabs value={tab} onChange={setTab} items={[{ key: 'he-thong', label: 'Nhật ký hệ thống' }, { key: 'laravel', label: 'Log ứng dụng (Laravel)' }]} />
            {tab === 'he-thong' ? <SysLogs /> : <AppLog />}
        </div>
    );
}

function SysLogs() {
    const { canWrite, toast } = useMon();
    const sp = useSearchParams();
    const [actor, setActor] = useState(sp.get('actor') || '');
    const [source, setSource] = useState(sp.get('source') || '');
    const [level, setLevel] = useState('');
    const [action, setAction] = useState('');
    const [hours, setHours] = useState('24');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const dq = useDebounced(q);
    const { data, err, loading, reload } = useLoad<any>(`logs${qs({ level, action, source, actor, hours, q: dq, page })}`, 30);
    const [sel, setSel] = useState<any>(null);
    const [purge, setPurge] = useState(false);
    const [days, setDays] = useState('90');

    const exportCsv = async () => {
        try {
            const rows = await mon<any[]>(`logs/export${qs({ level, action, source, actor, hours, q: dq })}`);
            downloadCsv(`nhat-ky-he-thong-${new Date().toISOString().slice(0, 10)}.csv`, ['ID', 'Thời gian', 'Mức', 'Nguồn', 'Hành động', 'Nội dung', 'Người thực hiện', 'IP', 'Route'],
                rows.map((r) => [r.id, dt(r.created_at), LEVEL[r.level]?.label, r.source, r.action, r.message, r.actor, r.ip, r.route]));
            toast(`Đã xuất ${rows.length} dòng.`);
        } catch (e: any) { toast(e.message, 'err'); }
    };
    const open = async (id: number) => { try { setSel(await mon(`logs/${id}`)); } catch (e: any) { toast(e.message, 'err'); } };
    const c = data?.counts_24h || {};
    const set = (f: () => void) => { f(); setPage(1); };

    return (
        <>
            <WriteNote />
            <div className="hl-chips">
                {[['', 'Tất cả', (c.info || 0) + (c.warn || 0) + (c.error || 0) + (c.security || 0)], ['info', 'Thông tin', c.info], ['warn', 'Cảnh báo', c.warn], ['error', 'Lỗi', c.error], ['security', 'Bảo mật', c.security]].map(([k, l, n]) => (
                    <button key={String(k)} className={`hl-chip${level === k ? ' on' : ''} lv-${k || 'all'}`} onClick={() => set(() => setLevel(k as string))}>{l as string}<i>{n ?? 0}</i></button>))}
                <small>Số liệu 24 giờ gần nhất</small>
            </div>
            {actor && <div className="hl-chips"><button className="hl-chip on" onClick={() => set(() => setActor(''))}>Người dùng: {actor}<i>×</i></button><small>Đang xem toàn bộ hoạt động của người này</small></div>}
            <Card flush>
                <div className="hl-filters">
                    <input className="hl-in grow" placeholder="Tìm theo nội dung, người dùng, IP, route…" value={q} onChange={(e) => set(() => setQ(e.target.value))} />
                    <select className="hl-in" value={source} onChange={(e) => set(() => setSource(e.target.value))}>
                        <option value="">Mọi nguồn</option>{(data?.sources || []).map((x: string) => <option key={x} value={x}>{SRC[x] || x}</option>)}
                    </select>
                    <select className="hl-in" value={action} onChange={(e) => set(() => setAction(e.target.value))}>
                        <option value="">Mọi hành động</option>{(data?.actions || []).map((a: string) => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <select className="hl-in" value={hours} onChange={(e) => set(() => setHours(e.target.value))}>
                        <option value="1">1 giờ qua</option><option value="24">24 giờ qua</option><option value="168">7 ngày qua</option><option value="720">30 ngày qua</option><option value="">Toàn bộ</option>
                    </select>
                    <button className="hl-btn" onClick={exportCsv}>⭳ Xuất CSV</button>
                    {canWrite && <button className="hl-btn danger-o" onClick={() => setPurge(true)}>Dọn nhật ký cũ</button>}
                </div>
                {loading && !data ? <div className="pad"><Loading rows={6} /></div> : err && !data ? <div className="pad"><ErrorBox msg={err} retry={reload} /></div> : !data!.items.length ? <Empty icon="∅" title="Không có dòng nhật ký nào" text="Thử đổi bộ lọc hoặc khoảng thời gian." /> : (
                    <div className="hl-tw"><table className="hl-table clk">
                        <thead><tr><th style={{ width: 140 }}>Thời gian</th><th style={{ width: 96 }}>Mức</th><th>Nội dung</th><th style={{ width: 120 }}>Người dùng</th><th style={{ width: 120 }}>IP</th></tr></thead>
                        <tbody>{data!.items.map((l: any) => (
                            <tr key={l.id} onClick={() => open(l.id)}>
                                <td><b>{dt(l.created_at).split(' ')[0]}</b><small>{ago(l.created_at)}</small></td>
                                <td><Pill tone={LEVEL[l.level]?.tone}>{LEVEL[l.level]?.label}</Pill></td>
                                <td><span className="msg">{l.message}</span><small>{SRC[l.source] || l.source} · {l.action}</small></td>
                                <td onClick={(e) => { if (l.actor) { e.stopPropagation(); set(() => setActor(l.actor)); } }}>{l.actor ? <span className="hl-ulink" title="Xem hoạt động của người này">{l.actor}</span> : '—'}</td><td className="mono">{l.ip || '—'}</td>
                            </tr>))}</tbody>
                    </table></div>
                )}
                {data && data.total > 0 && <Pager page={data.page} last={data.last_page} total={data.total} onPage={setPage} />}
            </Card>

            {sel && (
                <Modal title={`Chi tiết nhật ký #${sel.id}`} onClose={() => setSel(null)} wide>
                    <dl className="hl-dl">
                        <dt>Thời gian</dt><dd>{dt(sel.created_at)}</dd>
                        <dt>Mức độ</dt><dd><Pill tone={LEVEL[sel.level]?.tone}>{LEVEL[sel.level]?.label}</Pill></dd>
                        <dt>Nguồn / hành động</dt><dd>{sel.source} · {sel.action}</dd>
                        <dt>Người thực hiện</dt><dd>{sel.actor || '—'}</dd>
                        <dt>Địa chỉ IP</dt><dd className="mono">{sel.ip || '—'}</dd>
                        <dt>Route</dt><dd className="mono">{sel.route || '—'}</dd>
                    </dl>
                    <div className="hl-quote">{sel.message}</div>
                    {sel.context && <pre className="hl-code">{JSON.stringify(sel.context, null, 2)}</pre>}
                </Modal>
            )}
            {purge && (
                <Modal title="Dọn nhật ký cũ" onClose={() => setPurge(false)} foot={<>
                    <button className="hl-btn" onClick={() => setPurge(false)}>Hủy</button>
                    <button className="hl-btn danger" onClick={async () => { try { const r: any = await mon('logs/purge', { method: 'POST', body: { older_than_days: Number(days) } }); toast(r.message || 'Đã dọn.'); setPurge(false); reload(); } catch (e: any) { toast(e.message, 'err'); } }}>Xóa vĩnh viễn</button></>}>
                    <Field label="Xóa các dòng cũ hơn (ngày)" hint="Hành động này được ghi lại trong nhật ký bảo mật và không thể hoàn tác."><input className="hl-in" type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} /></Field>
                </Modal>
            )}
        </>
    );
}

function AppLog() {
    const { canWrite, toast } = useMon();
    const [level, setLevel] = useState('');
    const { data, err, loading, reload } = useLoad<any>(`app-log${qs({ level })}`);
    const [open, setOpen] = useState<number | null>(null);
    const [clear, setClear] = useState(false);
    if (loading && !data) return <Loading rows={5} />;
    if (err && !data) return <ErrorBox msg={err} retry={reload} />;
    const d = data!;
    if (!d.file) return <Card><Empty title="Chưa có file log nào" text="Laravel chưa ghi lỗi nào vào storage/logs." /></Card>;
    const by = d.by_level || {};
    const tone = (l: string) => (['error', 'critical', 'alert', 'emergency'].includes(l) ? 'red' : l === 'warning' ? 'amber' : 'blue');
    return (
        <>
            <div className="hl-bar">
                <div className="hl-summary"><Pill tone="gray">{d.file}</Pill><Pill tone="gray">{d.size_h}</Pill>
                    {Object.keys(by).map((k) => <Pill key={k} tone={tone(k)}>{k}: {by[k]}</Pill>)}</div>
                <div className="hl-row">
                    <select className="hl-in" value={level} onChange={(e) => setLevel(e.target.value)}><option value="">Mọi mức</option><option value="error">error</option><option value="warning">warning</option><option value="info">info</option></select>
                    <button className="hl-btn" onClick={reload}>⟳ Làm mới</button>
                    {canWrite && <button className="hl-btn danger-o" onClick={() => setClear(true)}>Làm trống log</button>}
                </div>
            </div>
            <Card flush>
                {!d.entries.length ? <Empty title="Không có mục nào" text="Không có lỗi trong phần cuối của file log." /> : (
                    <ul className="hl-applog">{d.entries.map((e: any, i: number) => (
                        <li key={i} className={`lv-${tone(e.level)}`}>
                            <div onClick={() => setOpen(open === i ? null : i)} role="button" tabIndex={0} onKeyDown={(k) => k.key === 'Enter' && setOpen(open === i ? null : i)}>
                                <Pill tone={tone(e.level)}>{e.level}</Pill><span>{e.message}</span><small>{e.time}</small>
                            </div>
                            {open === i && <pre className="hl-code">{e.trace || '(không có stack trace)'}</pre>}
                        </li>))}</ul>
                )}
            </Card>
            <p className="hl-hint">Chỉ đọc phần cuối (~400 KB) của file log mới nhất. Hiển thị tối đa 80 mục, mới nhất ở trên.</p>
            {clear && <Confirm danger title="Làm trống log ứng dụng?" text="Toàn bộ nội dung các file log Laravel sẽ bị xóa. Hành động được ghi vào nhật ký bảo mật." okText="Làm trống"
                               onClose={() => setClear(false)} onOk={async () => { try { const r: any = await mon('app-log/clear', { method: 'POST' }); toast(r.message); setClear(false); reload(); } catch (e: any) { toast(e.message, 'err'); } }} />}
        </>
    );
}