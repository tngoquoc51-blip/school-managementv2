'use client';

import { useEffect, useState } from 'react';
import s from '../../logs/logs.module.css';
import e from '../evaluations.module.css';
import { Card, ErrorBox, Skeleton, useAsync, useToast } from '../../logs/components/ui';
import { errorMessage, evApi } from '../api';
import { Field } from '../components/bits';
import { useEv } from '../components/ctx';
import type { RubricFull, Settings } from '../types';

const WEIGHTS: [keyof Settings, string][] = [['weight_observation', 'Dự giờ'], ['weight_professional', 'Chuyên môn nghiệp vụ'], ['weight_results', 'Kết quả giảng dạy'], ['weight_conduct', 'Phẩm chất, kỷ luật'], ['weight_innovation', 'Đổi mới, ứng dụng CNTT']];

export default function SettingsTab() {
    const ev = useEv(); const toast = useToast();
    const st = useAsync<{ settings: Settings; rubrics: RubricFull[] }>();
    const [f, setF] = useState<Settings | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
    useEffect(() => { st.run(() => evApi.settings()).then(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (st.data) setF(st.data.settings); }, [st.data]);
    if (st.error) return <ErrorBox message={st.error} onRetry={() => st.run(() => evApi.settings())} />;
    if (!f || !st.data) return <Skeleton h={360} />;
    const set = (k: keyof Settings, v: string) => setF({ ...f, [k]: v });
    const sum = WEIGHTS.reduce((a, [k]) => a + (Number(f[k]) || 0), 0);
    const admin = ev.me.user.can_admin;
    const save = async () => {
        setBusy(true); setErr('');
        try { const r = await evApi.saveSettings(f); toast('ok', r.changed.length ? 'Đã lưu cấu hình (' + r.changed.length + ' mục thay đổi)' : 'Không có thay đổi'); ev.reload(); }
        catch (x) { setErr(errorMessage(x)); } finally { setBusy(false); }
    };
    return (
        <div className={s.stack}>
            {!admin && <div className={e.errLine} style={{ background: 'var(--warnSoft)', color: 'var(--warn)' }}>Bạn đang xem với vai trò Phó Hiệu trưởng — chỉ Hiệu trưởng / Quản trị được thay đổi cấu hình.</div>}
            {err && <div className={e.errLine}>{err}</div>}
            <div className={`${s.grid} ${s.g2}`}>
                <Card title="Yêu cầu dự giờ" sub="Dùng để cảnh báo giáo viên chưa đủ số lượt">
                    <div className={e.form}>
                        <Field label="Số lượt dự giờ tối thiểu / giáo viên / học kỳ"><input type="number" min={1} max={20} className={e.input} disabled={!admin} value={f.min_obs_per_semester} onChange={(x) => set('min_obs_per_semester', x.target.value)} /></Field>
                        <Field label="Học kỳ hiện tại (mặc định khi mở trang)"><select className={e.input} disabled={!admin} value={f.current_semester} onChange={(x) => set('current_semester', x.target.value)}><option value="1">Học kỳ 1</option><option value="2">Học kỳ 2</option></select></Field>
                        <Field label="Mẫu phiếu mặc định"><select className={e.input} disabled={!admin} value={f.default_rubric_id} onChange={(x) => set('default_rubric_id', x.target.value)}>{st.data.rubrics.filter((r) => r.is_active).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
                    </div>
                </Card>
                <Card title="Ngưỡng xếp loại (thang 100)" sub="Phải giảm dần: Tốt > Khá > Đạt; dưới ngưỡng Đạt là Chưa đạt">
                    <div className={e.form}>
                        <div className={e.fg3}>
                            <Field label="Tốt từ"><input type="number" className={e.input} disabled={!admin} value={f.rating_excellent} onChange={(x) => set('rating_excellent', x.target.value)} /></Field>
                            <Field label="Khá từ"><input type="number" className={e.input} disabled={!admin} value={f.rating_good} onChange={(x) => set('rating_good', x.target.value)} /></Field>
                            <Field label="Đạt từ"><input type="number" className={e.input} disabled={!admin} value={f.rating_pass} onChange={(x) => set('rating_pass', x.target.value)} /></Field>
                        </div>
                        <div className={e.hint}>Thay đổi ngưỡng chỉ áp dụng cho phiếu nộp từ bây giờ; phiếu cũ giữ nguyên xếp loại đã lưu.</div>
                    </div>
                </Card>
            </div>
            <Card title="Trọng số đánh giá định kỳ" sub={`Tổng phải bằng 100 — hiện tại ${sum}`} right={<span className={`${s.chip} ${sum === 100 ? e.c_ok : e.c_crit}`}>{sum === 100 ? 'Hợp lệ' : 'Chưa đủ 100'}</span>}>
                <div className={e.fg3} style={{ gridTemplateColumns: 'repeat(5, minmax(0,1fr))' }}>
                    {WEIGHTS.map(([k, l]) => <Field key={k} label={l + ' (%)'}><input type="number" min={0} max={100} className={e.input} disabled={!admin} value={f[k]} onChange={(x) => set(k, x.target.value)} /></Field>)}
                </div>
            </Card>
            {admin && <div className={e.flex}><button className={`${s.btn} ${s.primary}`} disabled={busy || sum !== 100} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu cấu hình'}</button><button className={s.btn} onClick={() => setF(st.data!.settings)}>Hoàn tác</button></div>}
        </div>
    );
}