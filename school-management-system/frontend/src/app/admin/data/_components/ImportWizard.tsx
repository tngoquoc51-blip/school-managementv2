'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { hub, RowPayload } from '../_lib/api';
import { autoMap, sampleValue } from '../_lib/mapping';
import { downloadFile, parseDelimited, toCsv } from '../_lib/csv';
import { useToast } from '../_lib/toast';
import { MODE_LABEL } from '../_lib/types';
import type { Batch, Dataset, Limits, Mode, RowIssue, SavedMapping } from '../_lib/types';
import { Bar, Icon, Pill, Stepper, num } from './ui';

interface Props { datasets: Dataset[]; limits: Limits; preset: string; onDone: () => void }

const STEPS = ['Loại dữ liệu', 'Tải file', 'Ghép cột', 'Kiểm tra', 'Nhập'];
const MODES: { id: Mode; desc: string }[] = [
    { id: 'upsert', desc: 'Có rồi thì cập nhật, chưa có thì thêm mới. Phù hợp nhất cho danh sách đầu năm.' },
    { id: 'insert', desc: 'Chỉ thêm bản ghi mới; dòng trùng khóa bị bỏ qua và báo lỗi.' },
    { id: 'update', desc: 'Chỉ cập nhật bản ghi đã có (theo khóa); không tạo mới.' },
];
const IDLE = { status: 'idle' as 'idle' | 'running' | 'done', processed: 0, total: 0, inserted: 0, updated: 0, unchanged: 0, failed: 0, batchId: null as number | null, cancelled: false };

export default function ImportWizard({ datasets, limits, preset, onDone }: Props) {
    const toast = useToast();
    const [step, setStep] = useState(1);
    const [dsId, setDsId] = useState(preset);
    const [mode, setMode] = useState<Mode>('upsert');
    const [accounts, setAccounts] = useState(false);
    const [fileName, setFileName] = useState('');
    const [table, setTable] = useState<string[][]>([]);
    const [hasHeader, setHasHeader] = useState(true);
    const [paste, setPaste] = useState('');
    const [drag, setDrag] = useState(false);
    const [mapping, setMapping] = useState<Record<number, string | null>>({});
    const [conf, setConf] = useState<Record<number, number>>({});
    const [saved, setSaved] = useState<SavedMapping[]>([]);
    const [saveName, setSaveName] = useState('');
    const [issues, setIssues] = useState<Record<number, RowIssue>>({});
    const [counts, setCounts] = useState({ insert: 0, update: 0, error: 0 });
    const [validating, setValidating] = useState(false);
    const [vProg, setVProg] = useState(0);
    const [validated, setValidated] = useState(false);
    const [run, setRun] = useState(IDLE);
    const [final, setFinal] = useState<Batch | null>(null);
    const [undone, setUndone] = useState(false);
    const cancelRef = useRef(false);

    const ds = datasets.find((d) => d.id === dsId) ?? null;
    const fields = useMemo(() => ds?.fields.filter((f) => f.usable) ?? [], [ds]);
    const keyLabel = ds ? ds.fields.find((f) => f.key === ds.upsert)?.label ?? ds.upsert : '';

    const headers = useMemo(() => (table.length ? (hasHeader ? table[0] : table[0].map((_, i) => `Cột ${i + 1}`)) : []), [table, hasHeader]);
    const dataRows = useMemo(() => (hasHeader ? table.slice(1) : table), [table, hasHeader]);

    const mappedCount = useMemo(() => {
        const m: Record<string, number> = {};
        Object.values(mapping).forEach((k) => { if (k) m[k] = (m[k] ?? 0) + 1; });
        return m;
    }, [mapping]);
    const missing = fields.filter((f) => (f.required || f.key === ds?.upsert) && !mappedCount[f.key]);
    const twice = Object.keys(mappedCount).filter((k) => mappedCount[k] > 1);

    const rows: RowPayload[] = useMemo(() => dataRows.map((cells, i) => {
        const d: Record<string, string | null> = {};
        Object.entries(mapping).forEach(([ci, key]) => {
            if (!key) return;
            const v = (cells[Number(ci)] ?? '').trim();
            d[key] = v === '' ? null : v;
        });
        return { n: i + (hasHeader ? 2 : 1), d };
    }), [dataRows, mapping, hasHeader]);

    const validRows = rows.filter((r) => issues[r.n] && !issues[r.n].errors.length);
    const errorList = Object.values(issues).filter((x) => x.errors.length).sort((a, b) => a.n - b.n);

    /* ---------- bước 1 ---------- */
    const pick = (id: string) => {
        setDsId(id); setTable([]); setFileName(''); setPaste(''); setMapping({}); setValidated(false); setIssues({}); setAccounts(false);
        hub.mappings(id).then(setSaved).catch(() => setSaved([]));
    };
    useEffect(() => { if (preset) pick(preset); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

    const template = () => {
        if (!ds) return;
        downloadFile(`${ds.id}-file-mau.csv`, 'text/csv;charset=utf-8', toCsv([fields.map((f) => f.label), fields.map(sampleValue)]), true);
    };

    /* ---------- bước 2 ---------- */
    const ingest = (text: string, name: string) => {
        if (text.includes('\uFFFD')) toast({ tone: 'warn', title: 'File có thể sai mã hóa', text: 'Hãy lưu CSV dạng “CSV UTF-8” để không lỗi dấu tiếng Việt.', ms: 8000 });
        const t = parseDelimited(text);
        if (t.length < 1 || t[0].length < 1) return toast({ tone: 'error', title: 'Không đọc được dữ liệu', text: 'File trống hoặc sai định dạng.' });
        setTable(t); setFileName(name); setMapping({}); setValidated(false); setIssues({});
        toast({ tone: 'success', title: 'Đã đọc dữ liệu', text: `${num(Math.max(0, t.length - 1))} dòng · ${t[0].length} cột` });
    };
    const onFile = async (f?: File | null) => {
        if (!f) return;
        if (/\.xlsx?$/i.test(f.name)) return toast({ tone: 'warn', title: 'Chưa đọc trực tiếp file Excel', text: 'Lưu thành CSV UTF-8, hoặc chọn vùng dữ liệu trong Excel → Copy → dán vào ô bên dưới.', ms: 9000 });
        if (f.size > 15 * 1024 * 1024) return toast({ tone: 'error', title: 'File quá lớn', text: 'Tối đa 15MB.' });
        ingest(await f.text(), f.name);
    };

    /* ---------- bước 3 ---------- */
    useEffect(() => {
        if (step === 3 && ds && headers.length && !Object.keys(mapping).length) {
            const r = autoMap(headers, ds.fields);
            setMapping(r.map); setConf(r.conf);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]);
    const applySaved = (id: string) => {
        const s = saved.find((x) => String(x.id) === id);
        if (!s) return;
        const m: Record<number, string | null> = {};
        headers.forEach((h, i) => { m[i] = s.mapping[h] && fields.some((f) => f.key === s.mapping[h]) ? s.mapping[h] : null; });
        setMapping(m); setConf({});
        toast({ tone: 'info', title: `Đã áp dụng mẫu “${s.name}”` });
    };
    const saveMap = async () => {
        if (!ds || !saveName.trim()) return toast({ tone: 'warn', title: 'Hãy đặt tên cho mẫu ghép cột' });
        const by: Record<string, string> = {};
        headers.forEach((h, i) => { const k = mapping[i]; if (k) by[h] = k; });
        try {
            await hub.saveMapping(ds.id, saveName.trim(), by);
            setSaved(await hub.mappings(ds.id)); setSaveName('');
            toast({ tone: 'success', title: 'Đã lưu mẫu ghép cột' });
        } catch (e) { toast({ tone: 'error', title: 'Không lưu được', text: e instanceof Error ? e.message : '' }); }
    };

    /* ---------- bước 4 ---------- */
    const validateAll = async () => {
        if (!ds) return;
        setValidating(true); setValidated(false); setVProg(0);
        const result: Record<number, RowIssue> = {};
        const c = { insert: 0, update: 0, error: 0 };
        const seen = new Map<string, number>();
        const send: RowPayload[] = [];
        rows.forEach((r) => {
            const k = (r.d[ds.upsert] ?? '').toLowerCase();
            if (k && seen.has(k)) {
                result[r.n] = { n: r.n, action: null, errors: [`${keyLabel} trùng với dòng ${seen.get(k)} trong cùng file`] };
                c.error++;
                return;
            }
            if (k) seen.set(k, r.n);
            send.push(r);
        });
        try {
            for (let i = 0; i < send.length; i += limits.chunk) {
                const part = send.slice(i, i + limits.chunk);
                const res = await hub.validate(ds.id, mode, part);
                res.results.forEach((x) => { result[x.n] = x; });
                c.insert += res.counts.insert; c.update += res.counts.update; c.error += res.counts.error;
                setVProg(Math.round(((i + part.length) / send.length) * 100));
            }
            setIssues(result); setCounts(c); setValidated(true);
            toast(c.error ? { tone: 'warn', title: 'Đã kiểm tra xong', text: `${num(c.error)} dòng có lỗi sẽ bị bỏ qua.` } : { tone: 'success', title: 'Dữ liệu hợp lệ', text: 'Không phát hiện lỗi.' });
        } catch (e) { toast({ tone: 'error', title: 'Kiểm tra thất bại', text: e instanceof Error ? e.message : '' }); }
        finally { setValidating(false); }
    };
    useEffect(() => { if (step === 4 && !validated && !validating) validateAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [step]);

    const errorReport = () => downloadFile(`bao-cao-loi-${ds?.id}.csv`, 'text/csv;charset=utf-8', toCsv([['Dòng', 'Lỗi'], ...errorList.map((x) => [x.n, x.errors.join('; ')])]), true);

    /* ---------- bước 5 ---------- */
    const start = async () => {
        if (!ds || !validRows.length) return;
        cancelRef.current = false; setUndone(false); setFinal(null);
        setRun({ ...IDLE, status: 'running', total: validRows.length });
        let id: number | null = null;
        let a = 0, b = 0, c = 0, d = 0, p = 0;
        try {
            id = await hub.start({ dataset: ds.id, mode, filename: fileName || 'Dán từ Excel', total: validRows.length, options: { create_accounts: accounts } });
            for (let i = 0; i < validRows.length; i += limits.chunk) {
                if (cancelRef.current) break;
                const part = validRows.slice(i, i + limits.chunk);
                const r = await hub.chunk(id, part);
                a += r.inserted; b += r.updated; c += r.unchanged; d += r.failed; p += part.length;
                setRun((s) => ({ ...s, processed: p, inserted: a, updated: b, unchanged: c, failed: d, batchId: id }));
            }
            const batch = await hub.finish(id, cancelRef.current);
            setFinal(batch);
            setRun((s) => ({ ...s, status: 'done', batchId: id, cancelled: cancelRef.current }));
            toast({ tone: d ? 'warn' : 'success', title: cancelRef.current ? 'Đã dừng giữa chừng' : 'Nhập dữ liệu hoàn tất', text: `Thêm ${num(a)} · cập nhật ${num(b)} · không đổi ${num(c)} · lỗi ${num(d)}`, ms: 8000 });
            onDone();
        } catch (e) {
            toast({ tone: 'error', title: 'Nhập dữ liệu bị gián đoạn', text: e instanceof Error ? e.message : '', ms: 9000 });
            if (id) await hub.finish(id, true).catch(() => null);
            setRun((s) => ({ ...s, status: 'done', batchId: id, cancelled: true }));
            onDone();
        }
    };
    const undo = async () => {
        if (!run.batchId || !confirm('Hoàn tác toàn bộ lô nhập này? Bản ghi thêm mới sẽ bị xóa, bản ghi cập nhật được khôi phục giá trị cũ.')) return;
        try {
            const r = await hub.undo(run.batchId);
            setUndone(true);
            toast({ tone: r.blocked ? 'warn' : 'success', title: 'Đã hoàn tác', text: `Xóa ${num(r.removed)} · khôi phục ${num(r.restored)}${r.blocked ? ` · ${r.blocked} bản ghi đang được dùng nên giữ lại` : ''}` });
            onDone();
        } catch (e) { toast({ tone: 'error', title: 'Không hoàn tác được', text: e instanceof Error ? e.message : '' }); }
    };
    const reset = () => { setStep(1); setTable([]); setFileName(''); setPaste(''); setMapping({}); setValidated(false); setIssues({}); setRun(IDLE); setFinal(null); };

    const canNext = step === 1 ? !!ds : step === 2 ? dataRows.length > 0 : step === 3 ? missing.length === 0 && twice.length === 0 : step === 4 ? validated && validRows.length > 0 : false;

    return (
        <div className="dh-wiz">
            <Stepper steps={STEPS} current={step} onGo={run.status === 'running' ? undefined : setStep} />

            {step === 1 && (
                <section className="dh-card">
                    <header><h2>1. Chọn loại dữ liệu cần nhập</h2></header>
                    <div className="dh-ds-grid">
                        {datasets.map((d) => (
                            <button key={d.id} type="button" disabled={!d.table_exists} className={`dh-ds${d.id === dsId ? ' on' : ''}`} onClick={() => pick(d.id)}>
                                <span className="dh-ds-ic"><Icon n={d.icon} s={22} /></span>
                                <b>{d.title}</b>
                                <small>{d.table_exists ? `${num(d.count)} bản ghi hiện có` : 'Chưa có bảng trong CSDL'}</small>
                            </button>
                        ))}
                    </div>

                    {ds && (
                        <>
                            {ds.missing.length > 0 && (
                                <div className="dh-alert warn"><Icon n="alert" s={18} /><span>Bảng chưa có cột: <b>{ds.missing.join(', ')}</b>. Các cột này sẽ bị bỏ qua khi nhập. Có thể sửa trong <code>config/data_hub.php</code>.</span></div>
                            )}
                            <h3 className="dh-h3">Cách xử lý bản ghi</h3>
                            <div className="dh-radio">
                                {MODES.map((m) => (
                                    <label key={m.id} className={mode === m.id ? 'on' : ''}>
                                        <input type="radio" name="mode" checked={mode === m.id} onChange={() => setMode(m.id)} />
                                        <b>{MODE_LABEL[m.id]}</b><small>{m.desc}</small>
                                    </label>
                                ))}
                            </div>
                            <p className="dh-mut">Nhận diện bản ghi theo <b>{keyLabel}</b> (không phân biệt hoa/thường).</p>
                            {ds.has_account && mode !== 'update' && (
                                <label className="dh-check"><input type="checkbox" checked={accounts} onChange={(e) => setAccounts(e.target.checked)} />
                                    <span><b>Tạo tài khoản đăng nhập</b> cho học sinh thêm mới (mật khẩu ban đầu theo cấu hình, bắt buộc đổi khi đăng nhập lần đầu)</span></label>
                            )}
                            <h3 className="dh-h3">Các cột hệ thống nhận</h3>
                            <div className="dh-chips">
                                {fields.map((f) => <span key={f.key} className={`dh-chip${f.required || f.key === ds.upsert ? ' req' : ''}`}>{f.label}{(f.required || f.key === ds.upsert) && ' *'}</span>)}
                            </div>
                            <button className="dh-btn ghost" onClick={template}><Icon n="download" s={16} />Tải file mẫu (CSV)</button>
                        </>
                    )}
                </section>
            )}

            {step === 2 && ds && (
                <section className="dh-card">
                    <header><h2>2. Tải file hoặc dán dữ liệu từ Excel</h2></header>
                    <label className={`dh-drop${drag ? ' over' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
                           onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]); }}>
                        <Icon n="upload" s={30} />
                        <b>Kéo thả file CSV vào đây</b>
                        <small>hoặc bấm để chọn file (.csv, .txt, .tsv – tối đa 15MB, tối đa {num(limits.total)} dòng)</small>
                        <input type="file" accept=".csv,.txt,.tsv,.xlsx,.xls" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                    <div className="dh-or"><span>hoặc dán trực tiếp từ Excel</span></div>
                    <textarea className="dh-ta" rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Chọn vùng dữ liệu trong Excel (gồm cả dòng tiêu đề) → Ctrl+C → dán vào đây" />
                    <button className="dh-btn ghost" disabled={!paste.trim()} onClick={() => ingest(paste, 'Dán từ Excel')}>Dùng dữ liệu đã dán</button>

                    {table.length > 0 && (
                        <>
                            <div className="dh-alert ok"><Icon n="check" s={18} /><span><b>{fileName}</b> — {num(dataRows.length)} dòng dữ liệu, {table[0].length} cột.
                                {dataRows.length > limits.total && <> Vượt giới hạn {num(limits.total)} dòng/lần, hãy tách file.</>}</span></div>
                            <label className="dh-check"><input type="checkbox" checked={hasHeader} onChange={(e) => { setHasHeader(e.target.checked); setMapping({}); setValidated(false); }} /><span>Dòng đầu tiên là dòng tiêu đề</span></label>
                            <div className="dh-tw"><table className="dh-table">
                                <thead><tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                                <tbody>{dataRows.slice(0, 6).map((r, i) => <tr key={i}>{headers.map((_, j) => <td key={j}>{r[j]}</td>)}</tr>)}</tbody>
                            </table></div>
                            {dataRows.length > 6 && <p className="dh-mut">Hiển thị 6 / {num(dataRows.length)} dòng.</p>}
                        </>
                    )}
                </section>
            )}

            {step === 3 && ds && (
                <section className="dh-card">
                    <header><h2>3. Ghép cột trong file với trường của hệ thống</h2></header>
                    <div className="dh-toolbar">
                        <select className="dh-in" defaultValue="" onChange={(e) => applySaved(e.target.value)} disabled={!saved.length}>
                            <option value="">{saved.length ? 'Áp dụng mẫu đã lưu…' : 'Chưa có mẫu đã lưu'}</option>
                            {saved.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <input className="dh-in" placeholder="Đặt tên để lưu mẫu ghép cột này" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
                        <button className="dh-btn ghost" onClick={saveMap}><Icon n="save" s={16} />Lưu mẫu</button>
                    </div>
                    {missing.length > 0 && <div className="dh-alert err"><Icon n="alert" s={18} /><span>Chưa ghép cột bắt buộc: <b>{missing.map((f) => f.label).join(', ')}</b></span></div>}
                    {twice.length > 0 && <div className="dh-alert warn"><Icon n="alert" s={18} /><span>Có trường được ghép cho nhiều cột: <b>{twice.map((k) => fields.find((f) => f.key === k)?.label ?? k).join(', ')}</b></span></div>}
                    <div className="dh-tw"><table className="dh-table">
                        <thead><tr><th>Cột trong file</th><th>Dữ liệu mẫu</th><th>Trường hệ thống</th><th></th></tr></thead>
                        <tbody>
                        {headers.map((h, i) => (
                            <tr key={i}>
                                <td><b>{h || `Cột ${i + 1}`}</b></td>
                                <td className="dh-mut">{dataRows.slice(0, 3).map((r) => r[i]).filter(Boolean).join(' · ') || '—'}</td>
                                <td>
                                    <select className="dh-in" value={mapping[i] ?? ''} onChange={(e) => { setMapping({ ...mapping, [i]: e.target.value || null }); setValidated(false); }}>
                                        <option value="">— Bỏ qua cột này —</option>
                                        {fields.map((f) => <option key={f.key} value={f.key}>{f.label}{f.required || f.key === ds.upsert ? ' *' : ''}</option>)}
                                    </select>
                                </td>
                                <td>{mapping[i] && conf[i] !== undefined && (conf[i] >= 0.9 ? <Pill tone="ok">Tự nhận</Pill> : <Pill tone="warn">Gợi ý</Pill>)}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table></div>
                </section>
            )}

            {step === 4 && ds && (
                <section className="dh-card">
                    <header><h2>4. Kiểm tra trước khi ghi (chưa thay đổi dữ liệu)</h2>
                        <button className="dh-btn ghost sm" onClick={validateAll} disabled={validating}>Kiểm tra lại</button></header>
                    {validating && <div className="dh-run"><Bar value={vProg} label={`Đang kiểm tra… ${vProg}%`} /></div>}
                    {validated && (
                        <>
                            <div className="dh-grid4">
                                <div className="dh-stat ok"><span>Sẽ thêm mới</span><b>{num(counts.insert)}</b></div>
                                <div className="dh-stat"><span>Sẽ cập nhật</span><b>{num(counts.update)}</b></div>
                                <div className={`dh-stat ${counts.error ? 'err' : 'ok'}`}><span>Dòng lỗi (bỏ qua)</span><b>{num(counts.error)}</b></div>
                                <div className="dh-stat"><span>Tổng số dòng</span><b>{num(rows.length)}</b></div>
                            </div>
                            {errorList.length > 0 ? (
                                <>
                                    <div className="dh-bar-row"><h3 className="dh-h3">Danh sách dòng lỗi</h3>
                                        <button className="dh-btn ghost sm" onClick={errorReport}><Icon n="download" s={15} />Tải báo cáo lỗi</button></div>
                                    <div className="dh-tw"><table className="dh-table">
                                        <thead><tr><th style={{ width: 80 }}>Dòng</th><th>Nội dung lỗi</th></tr></thead>
                                        <tbody>{errorList.slice(0, 100).map((x) => <tr key={x.n}><td><b>{x.n}</b></td><td className="dh-err">{x.errors.join('; ')}</td></tr>)}</tbody>
                                    </table></div>
                                    {errorList.length > 100 && <p className="dh-mut">Hiển thị 100 / {num(errorList.length)} lỗi. Tải báo cáo để xem đầy đủ.</p>}
                                </>
                            ) : <div className="dh-alert ok"><Icon n="check" s={18} /><span>Tất cả các dòng đều hợp lệ.</span></div>}
                        </>
                    )}
                </section>
            )}

            {step === 5 && ds && (
                <section className="dh-card">
                    <header><h2>5. Nhập dữ liệu</h2></header>
                    {run.status === 'idle' && (
                        <>
                            <ul className="dh-sum">
                                <li><Icon n="file" s={16} />Tệp: <b>{fileName || 'Dán từ Excel'}</b></li>
                                <li><Icon n="table" s={16} />Loại dữ liệu: <b>{ds.title}</b> · {MODE_LABEL[mode]}</li>
                                <li><Icon n="check" s={16} />Sẽ ghi <b>{num(validRows.length)}</b> dòng hợp lệ ({num(counts.insert)} thêm mới, {num(counts.update)} cập nhật); bỏ qua <b>{num(counts.error)}</b> dòng lỗi.</li>
                                {accounts && <li><Icon n="shield" s={16} />Học sinh thêm mới sẽ được tạo tài khoản với mật khẩu ban đầu và phải đổi mật khẩu khi đăng nhập lần đầu.</li>}
                            </ul>
                            <div className="dh-alert info"><Icon n="info" s={18} /><span>Sau khi nhập vẫn có thể <b>hoàn tác</b> trong {limits.undo_days} ngày ở tab “Lịch sử & hoàn tác”.</span></div>
                            <button className="dh-btn lg" onClick={start} disabled={!validRows.length}><Icon n="bolt" s={18} />Bắt đầu nhập {num(validRows.length)} dòng</button>
                        </>
                    )}
                    {run.status !== 'idle' && (
                        <div className="dh-run">
                            <Bar value={run.total ? (run.processed / run.total) * 100 : 0} tone={run.status === 'done' ? (run.failed ? 'warn' : 'ok') : 'sky'} label={`${num(run.processed)} / ${num(run.total)} dòng`} />
                            <div className="dh-grid4">
                                <div className="dh-stat ok"><span>Thêm mới</span><b>{num(run.inserted)}</b></div>
                                <div className="dh-stat"><span>Cập nhật</span><b>{num(run.updated)}</b></div>
                                <div className="dh-stat"><span>Không đổi</span><b>{num(run.unchanged)}</b></div>
                                <div className={`dh-stat ${run.failed ? 'err' : ''}`}><span>Lỗi khi ghi</span><b>{num(run.failed)}</b></div>
                            </div>
                            {run.status === 'running' && <button className="dh-btn ghost" onClick={() => { cancelRef.current = true; }}>Dừng sau mảnh hiện tại</button>}
                            {run.status === 'done' && (
                                <>
                                    <div className={`dh-alert ${run.failed || run.cancelled ? 'warn' : 'ok'}`}><Icon n={run.failed || run.cancelled ? 'alert' : 'check'} s={18} />
                                        <span>{undone ? 'Lô nhập đã được hoàn tác.' : run.cancelled ? 'Đã dừng giữa chừng – phần đã ghi vẫn được giữ lại.' : run.failed ? 'Hoàn tất, một số dòng không ghi được.' : 'Hoàn tất, không có lỗi.'}
                                            {' '}Mã lô: <b>#{run.batchId}</b></span></div>
                                    {final?.errors && final.errors.length > 0 && (
                                        <button className="dh-btn ghost sm" onClick={() => downloadFile(`loi-khi-ghi-lo-${run.batchId}.csv`, 'text/csv;charset=utf-8', toCsv([['Dòng', 'Lỗi'], ...final.errors!.map((x) => [x.row, x.message])]), true)}>
                                            <Icon n="download" s={15} />Tải lỗi khi ghi ({final.errors.length})</button>
                                    )}
                                    <div className="dh-row">
                                        {!undone && (run.inserted + run.updated) > 0 && <button className="dh-btn ghost danger" onClick={undo}><Icon n="undo" s={16} />Hoàn tác lô này</button>}
                                        <button className="dh-btn" onClick={reset}>Nhập tiếp file khác</button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </section>
            )}

            {run.status !== 'running' && !(step === 5 && run.status === 'done') && (
                <div className="dh-nav">
                    <button className="dh-btn ghost" disabled={step === 1} onClick={() => setStep(step - 1)}><Icon n="arrowL" s={16} />Quay lại</button>
                    {step < 5 && <button className="dh-btn" disabled={!canNext} onClick={() => setStep(step + 1)}>{step === 4 ? 'Sang bước nhập' : 'Tiếp tục'}<Icon n="arrowR" s={16} /></button>}
                </div>
            )}

            <aside className="dh-card dh-side">
                <header><h2>Tóm tắt</h2></header>
                <ul className="dh-chk">
                    <li className={ds ? 'ok' : ''}><Icon n={ds ? 'check' : 'info'} s={15} /><div><b>Loại dữ liệu</b><small>{ds ? `${ds.title} · ${MODE_LABEL[mode]}` : 'Chưa chọn'}</small></div></li>
                    <li className={table.length ? 'ok' : ''}><Icon n={table.length ? 'check' : 'info'} s={15} /><div><b>Tệp dữ liệu</b><small>{table.length ? `${fileName || 'Dán từ Excel'} · ${num(dataRows.length)} dòng · ${table[0]?.length ?? 0} cột` : 'Chưa tải'}</small></div></li>
                    <li className={table.length && ds && missing.length === 0 && Object.keys(mapping).length ? 'ok' : ''}><Icon n={table.length && ds && missing.length === 0 && Object.keys(mapping).length ? 'check' : 'info'} s={15} /><div><b>Ghép cột</b><small>{Object.keys(mapping).length ? `${Object.values(mapping).filter(Boolean).length}/${headers.length} cột đã ghép${missing.length ? ` · thiếu ${missing.map((f) => f.label).join(', ')}` : ''}` : 'Chưa ghép'}</small></div></li>
                    <li className={validated && !counts.error ? 'ok' : validated ? 'warn' : ''}><Icon n={validated ? (counts.error ? 'alert' : 'check') : 'info'} s={15} /><div><b>Kiểm tra</b><small>{validated ? `${num(counts.insert)} thêm · ${num(counts.update)} cập nhật · ${num(counts.error)} lỗi` : 'Chưa kiểm tra'}</small></div></li>
                    <li className={run.status === 'done' ? 'ok' : ''}><Icon n={run.status === 'done' ? 'check' : 'info'} s={15} /><div><b>Nhập</b><small>{run.status === 'idle' ? 'Chưa bắt đầu' : `${num(run.processed)}/${num(run.total)} dòng`}</small></div></li>
                </ul>
                <div className="dh-sidebox">
                    <b>Giới hạn</b>
                    <small>Tối đa {num(limits.total)} dòng/lần · ghi {limits.chunk} dòng/mảnh · hoàn tác trong {limits.undo_days} ngày.</small>
                </div>
                <div className="dh-sidebox">
                    <b>Mẹo</b>
                    <small>Từ Excel: chọn vùng dữ liệu (kèm dòng tiêu đề) → Ctrl+C → dán ở bước 2. Lưu CSV dạng “CSV UTF-8” để không lỗi tiếng Việt.</small>
                </div>
            </aside>
        </div>
    );
}