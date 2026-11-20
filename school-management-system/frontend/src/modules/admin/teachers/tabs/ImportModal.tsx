'use client';
import { useRef, useState } from 'react';
import Modal from '../../subjects/ui/Modal';
import Icon from '../../subjects/ui/Icon';
import { useToast } from '../../subjects/ui/Toast';
import { errMsg, teacherApi } from '../api';
import { download, parseCsv, toCsv } from '../../subjects/csv';
import type { ImportReport } from '../types';

export const COLS = ['code', 'full_name', 'gender', 'subject_code', 'birth_date', 'phone', 'email', 'degree', 'position', 'hire_date', 'contract', 'status'];

export default function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
    const toast = useToast();
    const [rows, setRows] = useState<Record<string, string>[]>([]);
    const [report, setReport] = useState<ImportReport | null>(null);
    const [busy, setBusy] = useState(false);
    const [over, setOver] = useState(false);
    const input = useRef<HTMLInputElement>(null);

    const template = () => download('mau-nhap-giao-vien.csv', toCsv([
        { code: 'GV260001', full_name: 'Nguyễn Văn An', gender: 'Nam', subject_code: 'TOAN', birth_date: '1990-05-20', phone: '0912345678', email: 'an@truong.edu.vn', degree: 'master', position: 'Giáo viên', hire_date: '2018-09-01', contract: 'permanent', status: 'active' },
    ], COLS));

    const check = async (data: Record<string, string>[]) => {
        setBusy(true);
        try { setReport(await teacherApi.importRows(data, true)); } catch (e) { toast.error('Không kiểm tra được tệp', errMsg(e)); } finally { setBusy(false); }
    };
    const read = async (file?: File | null) => {
        if (!file) return;
        if (!/\.(csv|txt)$/i.test(file.name)) { toast.warning('Sai định dạng', 'Vui lòng chọn tệp .csv (Excel: Save As → CSV UTF-8).'); return; }
        const data = parseCsv(await file.text());
        if (!data.length) { toast.warning('Tệp trống', 'Không đọc được dòng nào. Hãy dùng tệp mẫu.'); return; }
        if (data.length > 500) { toast.warning('Quá nhiều dòng', 'Mỗi lần nhập tối đa 500 dòng.'); return; }
        setRows(data); setReport(null); check(data);
    };
    const apply = async () => {
        setBusy(true);
        try {
            const r = await teacherApi.importRows(rows, false);
            toast.success('Nhập dữ liệu thành công', `${r.created} thêm mới • ${r.updated} cập nhật`);
            onDone();
        } catch (e) { toast.error('Nhập thất bại', errMsg(e)); } finally { setBusy(false); }
    };
    const ok = report ? report.created + report.updated : 0;

    return (
        <Modal size="lg" onClose={onClose} title="Nhập giáo viên từ tệp CSV" subtitle="Hệ thống kiểm tra trước, chỉ ghi vào CSDL khi bạn xác nhận."
               footer={<><button className="sj-btn ghost" onClick={onClose}>Đóng</button>
                   <button className="sj-btn primary" disabled={busy || !report || ok === 0} onClick={apply}><Icon name="upload" size={16} /> Nhập {ok} dòng hợp lệ</button></>}>
            <div className="sj-hint"><Icon name="info" /><div>Cột bắt buộc: <b>code, full_name</b>. <b>subject_code</b> là mã môn chính (TOAN, VAN…). Mã GV đã tồn tại sẽ được <b>cập nhật</b>.
                {' '}<button className="sj-btn sm" style={{ marginLeft: 6 }} onClick={template}><Icon name="download" size={14} /> Tải tệp mẫu</button></div></div>
            <div className={`sj-drop sj-mt ${over ? 'over' : ''}`} onClick={() => input.current?.click()}
                 onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); read(e.dataTransfer.files[0]); }}>
                <Icon name="upload" size={30} /><p><b>Kéo thả tệp CSV vào đây</b> hoặc bấm để chọn</p>
                <input ref={input} type="file" accept=".csv,.txt" hidden onChange={(e) => { read(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            {busy && !report && <p className="sj-muted sj-mt">Đang kiểm tra…</p>}
            {report && (
                <div className="sj-mt">
                    <p><span className="sj-badge ok">{report.created} thêm mới</span> <span className="sj-badge warn">{report.updated} cập nhật</span> {report.errors.length > 0 && <span className="sj-badge bad">{report.errors.length} lỗi</span>}</p>
                    {report.errors.length > 0 && <ul className="sj-muted" style={{ maxHeight: 200, overflow: 'auto' }}>{report.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
                </div>)}
        </Modal>
    );
}