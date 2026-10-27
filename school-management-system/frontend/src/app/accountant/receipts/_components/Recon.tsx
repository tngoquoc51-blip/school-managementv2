'use client';
import { useEffect, useState } from 'react';
import { api, KtError, METHOD_TONE, qs, quickRange, Receipt, RegisterRes, RMeta, vnd } from '../_lib/rc';
import { Card, Chip, Empty, ErrorBox, Field, Loading, Modal, Pager, Progress, useApi } from '../../periods/_components/ui';
import { ReceiptModal } from '../../collection/_components/Receipt';

type Props = { meta: RMeta; refreshKey: number; onChanged: () => void; toast: { ok: (m: string) => void; fail: (m: string) => void } };

/** Đối soát chuyển khoản / POS / ví điện tử với sao kê ngân hàng. Tiền mặt đối chiếu ở Tổng kết ngày (trang Thu học phí). */
export function Recon({ meta, refreshKey, onChanged, toast }: Props) {
    const [q, setQ] = useState('');
    const [dq, setDq] = useState('');
    const [mode, setMode] = useState<'todo' | 'done' | 'noncash'>('todo');
    const [method, setMethod] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [page, setPage] = useState(1);
    const [sel, setSel] = useState<number[]>([]);
    const [noteFor, setNoteFor] = useState<'mark' | null>(null);
    const [note, setNote] = useState('');
    const [paste, setPaste] = useState(false);
    const [codes, setCodes] = useState('');
    const [matchMsg, setMatchMsg] = useState('');
    const [view, setView] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 350); return () => clearTimeout(t); }, [q]);
    const base = { q: dq, method, from, to };
    const key = JSON.stringify({ ...base, mode });
    useEffect(() => { setPage(1); }, [key]);
    const res = useApi<RegisterRes>(`receipts${qs({ ...base, recon: mode, page, per_page: 20 })}`);
    useEffect(() => { if (refreshKey) res.reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [refreshKey]);
    const d = res.data;
    const items = d?.items || [];
    const rc = d?.summary.recon;
    const nTodo = rc?.todo.count ?? 0; const nDone = rc?.done.count ?? 0;
    const aTodo = rc?.todo.amount ?? 0; const aDone = rc?.done.amount ?? 0;
    const allOn = items.length > 0 && items.every((r) => sel.includes(r.id));
    const selSum = items.filter((r) => sel.includes(r.id)).reduce((s, r) => s + r.amount, 0);
    const selectable = (r: Receipt) => r.needs_recon;

    const mark = async () => {
        setBusy(true); setErr('');
        try {
            const r = await api<{ reconciled: number; amount: number }>('receipts/reconcile', { method: 'POST', body: { ids: sel, note } });
            toast.ok(`Đã đối soát ${r.reconciled} phiếu, tổng ${vnd(r.amount)}.`); setNoteFor(null); setNote(''); setSel([]); res.reload(); onChanged();
        } catch (e) { setErr((e as KtError).message); } finally { setBusy(false); }
    };
    const unmark = async (ids: number[]) => {
        setBusy(true);
        try { await api('receipts/unreconcile', { method: 'POST', body: { ids } }); toast.ok('Đã bỏ đánh dấu đối soát.'); setSel([]); res.reload(); onChanged(); }
        catch (e) { toast.fail((e as KtError).message); } finally { setBusy(false); }
    };

    /** Dán mã giao dịch từ sao kê → tự chọn các phiếu khớp */
    const match = async () => {
        const list = Array.from(new Set(codes.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter((x) => x.length >= 4)));
        if (list.length === 0) { setMatchMsg('Chưa có mã nào hợp lệ (mỗi mã từ 4 ký tự).'); return; }
        setBusy(true); setMatchMsg('');
        try {
            const all: Receipt[] = [];
            let p = 1; let pages = 1;
            do {
                const r = await api<RegisterRes>(`receipts${qs({ recon: 'todo', page: p, per_page: 500 })}`);
                pages = r.pages; all.push(...r.items); p++;
            } while (p <= pages && p <= 10);
            const byRef = new Map(all.filter((x) => x.reference).map((x) => [String(x.reference).toUpperCase(), x]));
            const hit = list.filter((c) => byRef.has(c));
            const miss = list.filter((c) => !byRef.has(c));
            const ids = hit.map((c) => (byRef.get(c) as Receipt).id);
            setSel(ids);
            setMatchMsg(`Khớp ${hit.length}/${list.length} mã${miss.length ? `. Không có trong hệ thống hoặc đã đối soát: ${miss.slice(0, 6).join(', ')}${miss.length > 6 ? '…' : ''}` : '.'}`);
            if (hit.length) { setMode('todo'); toast.ok(`Đã chọn ${hit.length} phiếu khớp sao kê. Kiểm tra rồi bấm "Đánh dấu đã đối soát".`); setPaste(false); }
        } catch (e) { setMatchMsg((e as KtError).message); } finally { setBusy(false); }
    };

    const total = nTodo + nDone;
    return (
        <>
            <div className="pd-alert info rc-howto">
                <b>Cách đối soát:</b>
                <span>Mở sao kê ngân hàng, so từng khoản với danh sách dưới đây (theo mã giao dịch và số tiền), tích chọn các phiếu khớp rồi bấm “Đánh dấu đã đối soát”. Hoặc dán nhanh danh sách mã giao dịch từ sao kê để hệ thống tự chọn.</span>
            </div>
            <div className="pd-stats rc-recon-stats">
                <div className="pd-stat warn"><div><span>Chưa đối soát</span><b>{nTodo.toLocaleString('vi-VN')} phiếu</b><em>{vnd(aTodo)}</em></div></div>
                <div className="pd-stat ok"><div><span>Đã đối soát</span><b>{nDone.toLocaleString('vi-VN')} phiếu</b><em>{vnd(aDone)}</em></div></div>
                <div className="pd-stat info rc-progress"><div><span>Tiến độ đối soát (theo bộ lọc)</span><b>{total ? Math.round((nDone / total) * 100) : 100}%</b><Progress paid={nDone} total={Math.max(total, 1)} /></div></div>
            </div>

            <Card pad={false} title="Phiếu chuyển khoản, POS, ví điện tử"
                  right={<button className="pd-btn ghost sm" onClick={() => { setMatchMsg(''); setPaste(true); }}>Dán mã từ sao kê</button>}>
                <div className="pd-inv-bar rc-filters">
                    <div className="pd-filters" style={{ flex: '1 1 100%' }}>
                        <input className="pd-in" aria-label="Tìm phiếu cần đối soát" placeholder="Tìm mã giao dịch, số phiếu, tên hoặc mã học sinh…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '3 1 300px' }} />
                        <select className="pd-in" aria-label="Hình thức" value={method} onChange={(e) => setMethod(e.target.value)}><option value="">Mọi hình thức không dùng tiền mặt</option>{meta.methods.filter((m) => m.needs_ref).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select>
                        <input className="pd-in" type="date" aria-label="Từ ngày" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
                        <input className="pd-in" type="date" aria-label="Đến ngày" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
                    </div>
                    <div className="rc-row">
                        <div className="pd-chips" role="group" aria-label="Trạng thái đối soát">
                            {([['todo', 'Chưa đối soát', nTodo], ['done', 'Đã đối soát', nDone], ['noncash', 'Tất cả', undefined]] as [typeof mode, string, number | undefined][]).map(([k, l, n]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => { setMode(k); setSel([]); }}>{l}{n !== undefined ? <em>{n.toLocaleString('vi-VN')}</em> : null}</button>)}
                        </div>
                        <div className="pd-quick" style={{ marginTop: 0 }}>
                            {(['today', '7d', 'month'] as const).map((k) => <button key={k} onClick={() => { const [a, b] = quickRange(k); setFrom(a); setTo(b); }}>{k === 'today' ? 'Hôm nay' : k === '7d' ? '7 ngày qua' : 'Tháng này'}</button>)}
                            {(from || to || method || dq) && <button onClick={() => { setQ(''); setMethod(''); setFrom(''); setTo(''); }}>Xóa bộ lọc</button>}
                        </div>
                    </div>
                </div>
                {matchMsg && <div className={`pd-alert ${matchMsg.startsWith('Khớp') ? 'info' : 'warn'} rc-match`} role="status">{matchMsg}</div>}
                {sel.length > 0 && (
                    <div className="rc-selbar" role="status">
                        <span><b>{sel.length}</b> phiếu đã chọn · tổng <b>{vnd(selSum)}</b> <small>(so với tổng trên sao kê)</small></span>
                        <div>
                            <button className="pd-btn sm" disabled={busy} onClick={() => { setErr(''); setNoteFor('mark'); }}>Đánh dấu đã đối soát</button>
                            {mode === 'done' && <button className="pd-btn ghost sm" disabled={busy} onClick={() => unmark(sel)}>Bỏ đối soát</button>}
                            <button className="pd-btn ghost sm" onClick={() => setSel([])}>Bỏ chọn</button>
                        </div>
                    </div>
                )}
                {res.loading && !d && <Loading />}
                {res.err && <ErrorBox msg={res.err} retry={res.reload} />}
                {d && (items.length === 0 ? <Empty text={mode === 'todo' ? 'Không còn phiếu nào chờ đối soát. Mọi phiếu chuyển khoản trong bộ lọc đã khớp sao kê.' : 'Không có phiếu nào khớp bộ lọc.'} /> : (
                    <div className="pd-tw">
                        <table className="pd-table rc-table">
                            <thead><tr>
                                <th style={{ width: 34 }}><input type="checkbox" aria-label="Chọn tất cả phiếu trên trang" checked={allOn} onChange={() => setSel(allOn ? [] : items.filter(selectable).map((r) => r.id))} /></th>
                                <th>Mã giao dịch</th><th>Số phiếu</th><th>Học sinh</th><th className="n">Số tiền</th><th>Hình thức</th><th>Ghi nhận lúc</th><th>Đối soát</th><th style={{ width: 90 }} /></tr></thead>
                            <tbody>
                            {items.map((r) => (
                                <tr key={r.id}>
                                    <td><input type="checkbox" aria-label={`Chọn phiếu ${r.receipt_code}`} disabled={!selectable(r)} checked={sel.includes(r.id)} onChange={() => setSel((s) => s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id])} /></td>
                                    <td><b className="pd-mono">{r.reference || '—'}</b></td>
                                    <td><button className="cl-link mono" onClick={() => setView(r.id)}>{r.receipt_code}</button></td>
                                    <td><b>{r.student.name}</b><small>{r.student.code} · {r.student.class || '—'}</small></td>
                                    <td className="n"><b>{vnd(r.amount)}</b></td>
                                    <td><Chip tone={METHOD_TONE[r.method] || 'mut'}>{r.method_label}</Chip></td>
                                    <td>{r.confirmed_at || r.paid_at}<small>{r.cashier}</small></td>
                                    <td>{r.status === 'voided' ? <Chip tone="mut">Phiếu đã hủy</Chip> : r.recon ? <><Chip tone="ok">Đã đối soát</Chip><small>{r.recon.by} · {r.recon.at}</small>{r.recon.note && <small>“{r.recon.note}”</small>}</> : <Chip tone="warn">Chưa đối soát</Chip>}</td>
                                    <td>{r.recon && r.status === 'valid' && <button className="cl-link" disabled={busy} onClick={() => unmark([r.id])}>Bỏ đối soát</button>}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                ))}
                {d && <div className="pd-tfoot"><span>{d.total.toLocaleString('vi-VN')} phiếu · tổng <b>{vnd(d.filtered_amount)}</b></span><Pager page={page} pages={d.pages} onChange={setPage} /></div>}
            </Card>

            {noteFor && (
                <Modal title="Đánh dấu đã đối soát" onClose={() => !busy && setNoteFor(null)}
                       foot={<><button className="pd-btn ghost" disabled={busy} onClick={() => setNoteFor(null)}>Hủy</button><button className="pd-btn" disabled={busy} onClick={mark}>{busy ? 'Đang lưu…' : `Xác nhận ${sel.length} phiếu`}</button></>}>
                    <p>Xác nhận <b>{sel.length}</b> phiếu, tổng <b>{vnd(selSum)}</b>, đã khớp với sao kê ngân hàng.</p>
                    <Field label="Ghi chú (không bắt buộc)" hint="Ví dụ: Sao kê Vietcombank ngày 25/10. Tối đa 200 ký tự." htmlFor="rc-note"><input id="rc-note" className="pd-in" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
                    {err && <div className="pd-alert err" role="alert">{err}</div>}
                </Modal>
            )}
            {paste && (
                <Modal title="Khớp nhanh với sao kê" onClose={() => !busy && setPaste(false)}
                       foot={<><button className="pd-btn ghost" disabled={busy} onClick={() => setPaste(false)}>Đóng</button><button className="pd-btn" disabled={busy || !codes.trim()} onClick={match}>{busy ? 'Đang khớp…' : 'Khớp và chọn phiếu'}</button></>}>
                    <p>Dán các mã giao dịch trên sao kê (mỗi mã một dòng, hoặc cách nhau bằng dấu phẩy). Hệ thống tìm các phiếu chưa đối soát có cùng mã và chọn sẵn cho anh/chị.</p>
                    <Field label="Danh sách mã giao dịch" htmlFor="rc-codes"><textarea id="rc-codes" className="pd-in" rows={7} value={codes} onChange={(e) => setCodes(e.target.value)} placeholder={'FT26298123456\nFT26298654321'} /></Field>
                    {matchMsg && <div className="pd-alert warn" role="alert">{matchMsg}</div>}
                </Modal>
            )}
            {view && <ReceiptModal ids={[view]} onClose={() => setView(null)} />}
        </>
    );
}