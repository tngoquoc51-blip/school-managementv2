'use client';
// Cài đặt thông báo (/teacher/notifications/cai-dat)
import React, { useEffect, useState } from 'react';
import { Btn, ErrorBox, Ico, Loading, Switch, KIND, KINDS, Kind, nt, useLoad, useTa } from '../_nt';

type Prefs = { muted: Kind[]; quiet_from: string | null; quiet_to: string | null; sound: boolean; desktop: boolean; auto_read: boolean };

export default function Settings() {
    const { toast, refresh } = useTa();
    const { data, err, loading, reload } = useLoad(() => nt<{ data: Prefs }>('prefs'), []);
    const [p, setP] = useState<Prefs | null>(null); const [busy, setBusy] = useState(false);
    useEffect(() => { if (data) setP(data.data); }, [data]);
    if (loading && !p) return <div className="ta-page"><Loading /></div>;
    if (err || !p) return <div className="ta-page"><ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} /></div>;
    const set = (v: Partial<Prefs>) => setP({ ...p, ...v });
    const toggleKind = (k: Kind) => set({ muted: p.muted.includes(k) ? p.muted.filter((x) => x !== k) : [...p.muted, k] });
    const save = async () => {
        setBusy(true);
        try { await nt('prefs', { method: 'PUT', body: { ...p, quiet_from: p.quiet_from || null, quiet_to: p.quiet_to || null } }); toast('Đã lưu cài đặt thông báo.'); refresh(); } catch (e) { toast((e as Error).message, 'err'); }
        setBusy(false);
    };
    const desktop = async (on: boolean) => {
        if (on && typeof Notification !== 'undefined') { const r = await Notification.requestPermission(); if (r !== 'granted') { toast('Trình duyệt chưa cho phép hiện thông báo.', 'err'); return; } }
        set({ desktop: on });
    };
    const test = () => {
        if (p.sound) { try { const c = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); const o = c.createOscillator(); const g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 880; g.gain.value = 0.08; o.start(); o.stop(c.currentTime + 0.15); } catch { /* bỏ qua */ } }
        if (p.desktop && typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('Thông báo thử', { body: 'Đây là thông báo thử từ hệ thống THPT Ngô Sỹ Liên.' });
        toast('Đã gửi thông báo thử.');
    };
    return (
        <div className="ta-page">
            <div className="ta-card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800 }}>Loại thông báo muốn nhận</h3>
                <p className="ta-mute" style={{ margin: '4px 0 12px' }}>Tắt một loại sẽ ẩn nó khỏi hộp thư. Thông báo khẩn cấp và thông báo được ghim vẫn luôn hiển thị.</p>
                {KINDS.map((k) => (<div key={k} className="nt-set"><div className="nt-row2"><span style={{ color: KIND[k].c }}><Ico n={KIND[k].icon} size={18} /></span><b>{KIND[k].label}</b></div><Switch on={!p.muted.includes(k)} onChange={() => toggleKind(k)} label={KIND[k].label} /></div>))}
            </div>
            <div className="ta-card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Giờ yên lặng & hành vi</h3>
                <div className="nt-set"><div><b>Giờ yên lặng</b><p className="ta-mute">Không phát âm thanh / bật thông báo trình duyệt trong khoảng này.</p></div>
                    <div className="nt-row2"><input type="time" value={p.quiet_from || ''} onChange={(e) => set({ quiet_from: e.target.value || null })} /><span>→</span><input type="time" value={p.quiet_to || ''} onChange={(e) => set({ quiet_to: e.target.value || null })} /></div></div>
                <div className="nt-set"><div><b>Âm báo</b><p className="ta-mute">Phát tiếng “ting” khi có thông báo mới.</p></div><Switch on={p.sound} onChange={(v) => set({ sound: v })} label="Âm báo" /></div>
                <div className="nt-set"><div><b>Thông báo trên trình duyệt</b><p className="ta-mute">Hiện cửa sổ nhỏ ngay cả khi bạn đang ở tab khác.</p></div><Switch on={p.desktop} onChange={(v) => { void desktop(v); }} label="Thông báo trình duyệt" /></div>
                <div className="nt-set"><div><b>Tự đánh dấu đã đọc khi mở</b><p className="ta-mute">Mở một thông báo là tự coi như đã đọc.</p></div><Switch on={p.auto_read} onChange={(v) => set({ auto_read: v })} label="Tự đánh dấu đã đọc" /></div>
                <div className="nt-row2" style={{ marginTop: 16 }}><Btn tone="primary" busy={busy} onClick={save}>Lưu cài đặt</Btn><Btn onClick={test}><Ico n="bell" size={15} />Gửi thông báo thử</Btn><Btn onClick={() => setP(data!.data)}>Hoàn tác</Btn></div>
            </div>
        </div>
    );
}