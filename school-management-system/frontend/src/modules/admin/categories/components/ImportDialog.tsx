'use client';

import { ChangeEvent, DragEvent, useState } from 'react';
import s from '../categories.module.css';
import { catalogService, getErrorMessage } from '../catalogApi';
import { TEMPLATE_CSV, parseDelimited, rowsToItems } from '../csv';
import type { ImportResult } from '../types';
import { useFeedback } from './Feedback';
import Icon from './Icon';
import { Modal } from './ui';

interface Props {
    open: boolean;
    groupId: number;
    groupName: string;
    onClose: () => void;
    onDone: () => void;
}

export default function ImportDialog({ open, groupId, groupName, onClose, onDone }: Props) {
    const fb = useFeedback();
    const [rows, setRows] = useState<Record<string, string>[]>([]);
    const [fileName, setFileName] = useState('');
    const [mode, setMode] = useState<'skip' | 'update'>('skip');
    const [busy, setBusy] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [warn, setWarn] = useState('');

    const reset = () => { setRows([]); setFileName(''); setResult(null); setWarn(''); };
    const close = () => { reset(); onClose(); };

    const readFile = async (file: File) => {
        if (file.size > 2 * 1024 * 1024) return fb.error('File quá lớn', 'Chỉ nhận file CSV tối đa 2MB.');
        const { rows: parsed, unknownHeaders } = rowsToItems(parseDelimited(await file.text()));
        if (parsed.length === 0) return fb.warning('File trống', 'Không tìm thấy dòng dữ liệu nào.');
        if (parsed.length > 1000) return fb.error('Quá nhiều dòng', 'Mỗi lần nhập tối đa 1.000 dòng.');
        setRows(parsed);
        setFileName(file.name);
        setResult(null);
        setWarn(unknownHeaders.length ? `Bỏ qua cột không nhận diện được: ${unknownHeaders.join(', ')}` : '');
    };

    const onPick = (e: ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) void readFile(f);
        e.target.value = '';
    };
    const onDrop = (e: DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void readFile(f);
    };

    const downloadTemplate = () => {
        const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mau_nhap_danh_muc.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const run = async () => {
        setBusy(true);
        try {
            const res = await catalogService.importItems(groupId, rows, mode);
            setResult(res);
            onDone();
            if (res.errors.length) fb.warning('Nhập xong, có dòng lỗi', `Thêm ${res.created}, cập nhật ${res.updated}, lỗi ${res.errors.length}.`);
            else fb.success('Nhập dữ liệu thành công', `Thêm ${res.created}, cập nhật ${res.updated}, bỏ qua ${res.skipped}.`);
        } catch (e) {
            fb.error('Không nhập được', getErrorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal open={open} onClose={close} title={`Nhập dữ liệu vào “${groupName}”`} wide>
            {!result && (
                <>
                    <label className={`${s.drop} ${dragging ? s.dropOn : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
                        <input type="file" accept=".csv,.tsv,.txt,text/csv" onChange={onPick} hidden />
                        <Icon name="upload" size={26} />
                        <strong>{fileName || 'Kéo thả file CSV vào đây hoặc bấm để chọn'}</strong>
                        <small>Cột: Mã, Tên, Tên viết tắt, Giá trị, Mô tả • Lưu từ Excel bằng “CSV UTF-8”</small>
                    </label>
                    <button className={s.linkBtn} onClick={downloadTemplate}><Icon name="download" size={14} /> Tải file mẫu</button>
                    {warn && <p className={s.inlineWarn}><Icon name="alert" size={14} /> {warn}</p>}

                    {rows.length > 0 && (
                        <>
                            <div className={s.previewHead}>Xem trước <b>{rows.length}</b> dòng</div>
                            <div className={s.previewWrap}>
                                <table className={s.table}>
                                    <thead><tr><th>#</th><th>Mã</th><th>Tên</th><th>Viết tắt</th><th>Giá trị</th></tr></thead>
                                    <tbody>
                                    {rows.slice(0, 8).map((r, i) => (
                                        <tr key={i}><td>{i + 1}</td><td><code>{r.code}</code></td><td>{r.name}</td><td>{r.short_name}</td><td>{r.value}</td></tr>
                                    ))}
                                    </tbody>
                                </table>
                                {rows.length > 8 && <p className={s.muted}>… và {rows.length - 8} dòng nữa</p>}
                            </div>

                            <div className={s.radioRow}>
                                <label><input type="radio" checked={mode === 'skip'} onChange={() => setMode('skip')} /> Bỏ qua mã đã có</label>
                                <label><input type="radio" checked={mode === 'update'} onChange={() => setMode('update')} /> Cập nhật mục trùng mã</label>
                            </div>
                            <div className={s.dialogActions}>
                                <button className={s.btnGhost} onClick={close}>Hủy</button>
                                <button className={s.btnPrimary} onClick={run} disabled={busy}>
                                    {busy ? <><span className={s.spinner} /> Đang nhập…</> : <><Icon name="upload" size={16} /> Nhập {rows.length} dòng</>}
                                </button>
                            </div>
                        </>
                    )}
                </>
            )}

            {result && (
                <div>
                    <div className={s.resultGrid}>
                        <div><b>{result.created}</b><span>Thêm mới</span></div>
                        <div><b>{result.updated}</b><span>Cập nhật</span></div>
                        <div><b>{result.skipped}</b><span>Bỏ qua</span></div>
                        <div className={result.errors.length ? s.resultBad : ''}><b>{result.errors.length}</b><span>Dòng lỗi</span></div>
                    </div>
                    {result.errors.length > 0 && (
                        <ul className={s.errorList}>
                            {result.errors.slice(0, 30).map((e) => <li key={e.row}><b>Dòng {e.row}:</b> {e.message}</li>)}
                            {result.errors.length > 30 && <li>… và {result.errors.length - 30} lỗi khác</li>}
                        </ul>
                    )}
                    <div className={s.dialogActions}>
                        <button className={s.btnGhost} onClick={reset}>Nhập file khác</button>
                        <button className={s.btnPrimary} onClick={close}>Xong</button>
                    </div>
                </div>
            )}
        </Modal>
    );
}