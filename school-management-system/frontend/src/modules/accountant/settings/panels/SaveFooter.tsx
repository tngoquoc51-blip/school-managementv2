'use client';

export default function SaveFooter({ dirty, busy, onSave, onReset }: {
    dirty: boolean; busy: boolean; onSave: () => void; onReset: () => void;
}) {
    return (
        <div className="acs-foot">
            {dirty && <span className="acs-dirty">● Có thay đổi chưa lưu</span>}
            <button className="acs-btn ghost" disabled={!dirty || busy} onClick={onReset}>Hoàn tác</button>
            <button className="acs-btn" disabled={!dirty || busy} onClick={onSave}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
        </div>
    );
}