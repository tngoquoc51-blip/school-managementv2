'use client';
import { useRef, useState } from 'react';
import Modal from '../ui/Modal';
import Icon from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { errMsg, subjectApi } from '../api';
import { download, parseCsv, toCsv } from '../csv';
import type { ImportReport } from '../types';

const COLS = ['code', 'name', 'kind', 'category', 'periods_per_week', 'group_code', 'grades', 'status', 'description'];

export default function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
    const toast = useToast();
    const [rows, setRows] = useState<Record<string, string>[]>([]);
    const [report, setReport] = useState<ImportReport | null>(null);
    const [busy, setBusy] = useState(false);
    const [over, setOver] = useState(false);
    const input = useRef<HTMLInputElement>(null);

    const template = () => download('mau-nhap-mon-hoc.csv', toCsv([
        { code: 'NGHE', name: 'Giáo dục nghề phổ thông', kind: 'score', category: 'elective', periods_per_week: 2, group_code: 'KHTN', grades: '10,11', status: 'active', description: 'Môn tự chọn' },
    ], COLS));

    const check = async (data: Record<string, string>[]) => {
        setBusy(true);
        try { setReport(await subjectApi.importRows(data, true)); } catch (e) { toast.error('Không kiểm tra được tệp', errMsg(e)); } finally { setBusy(false); }
    };
    const read = async (file?: File | null) => {
        if (!file) return;
        if (!/\.(csv|txt)$/i.test(file.name)) { toast.warning('Sai định dạng', 'Vui lòng chọn tệp .csv (có thể xuất từ Excel: Save As → CSV UTF-8).'); return; }
        const data = parseCsv(await file.text());
        if (!data.length) { toast.warning('Tệp trống', 'Không đọc được dòng dữ liệu nào. Hãy dùng tệp mẫu.'); return; }
        if (data.length > 500) { toast.warning('Quá nhiều dòng', 'Mỗi lần nhập tối đa 500 dòng.'); return; }
        setRows(data); setReport(null); check(data);
    };
    const apply = async () => {
        setBusy(true);
        try {
            const r = await subjectApi.importRows(rows, false);
            toast.success('Nhập dữ liệu thành công', `${r.valid} môn đã được thêm/cập nhật.`);
            onDone();
        } catch (e) { toast.error('Nhập thất bại', errMsg(e)); } finally { setBusy(false); }
    };

    return (
        <Modal size="lg" onClose={onClose} title="Nhập môn học từ tệp CSV" subtitle="Hệ thống kiểm tra trước toàn bộ dòng, chỉ ghi vào CSDL khi bạn xác nhận."
               footer={<><button className="sj-btn ghost" onClick={onClose}>Đóng</button>
                   <button className="sj-btn primary" disabled={busy || !report || report.valid === 0} onClick={apply}><Icon name="upload" size={16} /> Nhập {report?.valid ?? 0} dòng hợp lệ</button></>}>
            <div className="sj-hint"><Icon name="info" /><div>Cột bắt buộc: <b>code, name, kind</b> (score/pass), <b>periods_per_week</b>. Mã đã tồn tại sẽ được <b>cập nhật</b>, mã mới sẽ được <b>tạo</b>.
                {' '}<button className="sj-btn sm" style={{ marginLeft: 6 }} onClick={template}><Icon name="download" size={14} /> Tải tệp mẫu</button></div></div>
            <div className={`sj-drop sj-mt ${over ? 'over' : ''}`} onClick={() => input.current?.click()}
                 onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); read(e.dataTransfer.files[0]); }}>
                <Icon name="upload" size={30} /><p><b>Kéo thả tệp CSV vào đây</b> hoặc bấm để chọn</p>
                <input ref={input} type="file" accept=".csv,.txt" hidden onChange={(e) => { read(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            {busy && !report && <p className="sj-muted sj-mt">Đang kiểm tra…</p>}
            {report && (
                <div className="sj-mt">
                    <p><span className="sj-badge ok">{report.valid} hợp lệ</span> {report.errors > 0 && <span className="sj-badge bad">{report.errors} lỗi</span>}</p>
                    <div className="sj-tablewrap sj-mt" style={{ maxHeight: 280 }}>
                        <table className="sj-table" style={{ minWidth: 560 }}>
                            <thead><tr><th>Dòng</th><th>Mã</th><th>Tên môn</th><th>Kết quả</th></tr></thead>
                            <tbody>{report.rows.map((r) => (
                                <tr key={r.line}><td>{r.line}</td><td><b>{r.code || '—'}</b></td><td>{r.name || '—'}</td>
                                    <td>{r.action === 'error' ? <span className="sj-badge bad">{r.error}</span> : r.action === 'create' ? <span className="sj-badge ok">Tạo mới</span> : <span className="sj-badge warn">Cập nhật</span>}</td></tr>))}</tbody>
                        </table>
                    </div>
                </div>
            )}
        </Modal>
    );
}