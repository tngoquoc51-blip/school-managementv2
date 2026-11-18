'use client';

import { DragEvent, useEffect, useMemo, useState } from 'react';
import { useQ, useSeating } from '@/components/hr-seating/Shell';
import { Avatar, Badge, Card, Empty, ErrorBox, Field, Icon, Modal, PageHeader, Skeleton, useToast } from '@/components/hr-seating/ui';
import { Group, OFFICER_SHORT, Student, errText, hrSend, num } from '@/lib/hr-seating';

const PALETTE = ['#2563eb', '#0891b2', '#059669', '#f97316', '#7c3aed', '#475569'];
const ROLES = ['monitor', 'deputy_study', 'deputy_labor', 'deputy_culture', 'secretary', 'treasurer'];
const ROLE_LABEL: Record<string, string> = { monitor: 'Lớp trưởng', deputy_study: 'Lớp phó học tập', deputy_labor: 'Lớp phó lao động', deputy_culture: 'Lớp phó văn thể', secretary: 'Bí thư chi đoàn', treasurer: 'Thủ quỹ' };

export default function GroupsPage() {
    const { params } = useSeating();
    const toast = useToast();
    const groupsQ = useQ<Group[]>('/groups');
    const rosterQ = useQ<{ students: Student[] }>('/roster');
    const offQ = useQ<{ roles: Record<string, string>; assigned: Record<string, number | null> }>('/officers');

    const [groups, setGroups] = useState<Group[]>([]);
    const [dirty, setDirty] = useState(false);
    const [over, setOver] = useState<number | 'none' | null>(null);
    const [splitN, setSplitN] = useState(4);
    const [modal, setModal] = useState(false);
    const [busy, setBusy] = useState(false);
    const [officers, setOfficers] = useState<Record<string, number | null>>({});
    const [offDirty, setOffDirty] = useState(false);

    const students = useMemo(() => rosterQ.data?.students || [], [rosterQ.data]);
    const sMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

    useEffect(() => { if (groupsQ.data) { setGroups(groupsQ.data.map((g) => ({ ...g }))); setDirty(false); } }, [groupsQ.data]);
    useEffect(() => { if (offQ.data) { setOfficers({ ...offQ.data.assigned }); setOffDirty(false); } }, [offQ.data]);

    const assigned = new Set(groups.flatMap((g) => g.members));
    const free = students.filter((s) => !assigned.has(s.id));

    const mutate = (fn: (g: Group[]) => Group[]) => { setGroups(fn(groups)); setDirty(true); };
    const move = (sid: number, to: number | 'none') => mutate((gs) => gs.map((g, i) => {
        const members = g.members.filter((m) => m !== sid);
        if (to === i) members.push(sid);
        return { ...g, members, leader_student_id: g.leader_student_id === sid && to !== i ? null : g.leader_student_id };
    }));
    const onDrop = (e: DragEvent, to: number | 'none') => {
        e.preventDefault(); setOver(null);
        try { const { sid } = JSON.parse(e.dataTransfer.getData('text/plain')) as { sid: number }; move(sid, to); } catch { /* bỏ qua */ }
    };
    const setLeader = (gi: number, sid: number) => mutate((gs) => gs.map((g, i) => (i === gi ? { ...g, leader_student_id: g.leader_student_id === sid ? null : sid } : g)));
    const addGroup = () => { if (groups.length >= 8) return; mutate((gs) => [...gs, { number: gs.length + 1, name: `Tổ ${gs.length + 1}`, color: PALETTE[gs.length % PALETTE.length], leader_student_id: null, members: [] }]); };
    const removeGroup = (gi: number) => { if (groups.length <= 1) return; mutate((gs) => gs.filter((_, i) => i !== gi).map((g, i) => ({ ...g, number: i + 1 }))); };

    const autoSplit = async () => {
        setBusy(true);
        try {
            const r = await hrSend<Group[]>('POST', '/groups/auto', { count: splitN }, params);
            setGroups(r.data); setDirty(true); setModal(false);
            toast.info('Đã chia tổ cân bằng nam – nữ và học lực', 'Kiểm tra rồi bấm Lưu để ghi vào hệ thống.');
        } catch (e) { toast.error('Không chia được tổ', errText(e)); } finally { setBusy(false); }
    };
    const saveGroups = async () => {
        setBusy(true);
        try {
            const r = await hrSend<Group[]>('PUT', '/groups', { groups: groups.map((g) => ({ name: g.name, color: g.color, leader_student_id: g.leader_student_id, members: g.members })) }, params);
            setGroups(r.data); setDirty(false); toast.success('Đã lưu các tổ', `${r.data.length} tổ học tập`); rosterQ.reload();
        } catch (e) { toast.error('Không lưu được', errText(e)); } finally { setBusy(false); }
    };
    const saveOfficers = async () => {
        setBusy(true);
        try { await hrSend('PUT', '/officers', { assigned: officers }, params); setOffDirty(false); toast.success('Đã lưu ban cán sự lớp'); rosterQ.reload(); }
        catch (e) { toast.error('Không lưu được', errText(e)); } finally { setBusy(false); }
    };

    if ((groupsQ.error && !groupsQ.data) || (rosterQ.error && !rosterQ.data)) return <ErrorBox error={groupsQ.error || rosterQ.error} onRetry={() => { groupsQ.reload(); rosterQ.reload(); }} />;
    if (!groupsQ.data || !rosterQ.data) return <Skeleton h={140} n={3} />;

    const chip = (sid: number, gi: number | 'none') => {
        const s = sMap.get(sid);
        if (!s) return null;
        const isLeader = gi !== 'none' && groups[gi]?.leader_student_id === sid;
        return (
            <div key={sid} className="hs-member" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ sid }))}>
                <Avatar name={s.full_name} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}><div className="hs-b" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.full_name}</div><div className="hs-small hs-muted">{s.gender}{s.level ? ` · ${s.level}` : ''}</div></div>
                {gi !== 'none' && <button className="hs-iconbtn" style={{ width: 28, height: 28, color: isLeader ? 'var(--accent)' : undefined }} onClick={() => setLeader(gi as number, sid)} title={isLeader ? 'Bỏ tổ trưởng' : 'Đặt làm tổ trưởng'}><Icon name="star" size={14} /></button>}
                {gi !== 'none' && <button className="hs-iconbtn" style={{ width: 28, height: 28 }} onClick={() => move(sid, 'none')} title="Gỡ khỏi tổ"><Icon name="x" size={14} /></button>}
            </div>
        );
    };

    return (
        <>
            <PageHeader title="Tổ học tập & ban cán sự" desc="Chia lớp thành các tổ, chọn tổ trưởng và ban cán sự. Kéo học sinh giữa các cột để chuyển tổ.">
                <button className="hs-btn" onClick={() => setModal(true)}><Icon name="wand" size={16} /> Chia tổ tự động</button>
                <button className="hs-btn" onClick={addGroup} disabled={groups.length >= 8}><Icon name="plus" size={16} /> Thêm tổ</button>
                {dirty && <span className="hs-dirty"><Icon name="alert" size={13} /> Chưa lưu</span>}
                <button className="hs-btn primary" disabled={!dirty || busy} onClick={saveGroups}><Icon name="check" size={16} /> {busy ? 'Đang lưu…' : 'Lưu các tổ'}</button>
            </PageHeader>

            <div className="hs-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 14, alignItems: 'start' }}>
                {groups.map((g, gi) => (
                    <section key={gi} className="hs-card" style={{ borderTop: `4px solid ${g.color}` }}>
                        <div className="hs-card-b">
                            <div className="hs-row">
                                <input className="hs-input" style={{ fontWeight: 700 }} value={g.name} onChange={(e) => mutate((gs) => gs.map((x, i) => (i === gi ? { ...x, name: e.target.value } : x)))} aria-label="Tên tổ" />
                                <button className="hs-iconbtn" onClick={() => removeGroup(gi)} disabled={groups.length <= 1} title="Xóa tổ"><Icon name="trash" size={15} /></button>
                            </div>
                            <div className="hs-row" style={{ margin: '10px 0' }}>
                                {PALETTE.map((c) => <button key={c} onClick={() => mutate((gs) => gs.map((x, i) => (i === gi ? { ...x, color: c } : x)))} aria-label={`Màu ${c}`}
                                                            style={{ width: 20, height: 20, borderRadius: 6, background: c, border: g.color === c ? '2px solid var(--text)' : '2px solid transparent', cursor: 'pointer' }} />)}
                                <span className="hs-right"><Badge tone="primary">{g.members.length} em</Badge></span>
                            </div>
                            <div className={`hs-col ${over === gi ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(gi); }} onDragLeave={() => setOver(null)} onDrop={(e) => onDrop(e, gi)}>
                                <div className="hs-grid" style={{ gap: 6 }}>{g.members.length === 0 ? <div className="hs-small hs-muted" style={{ textAlign: 'center', padding: 14 }}>Kéo học sinh vào đây</div> : g.members.map((sid) => chip(sid, gi))}</div>
                            </div>
                        </div>
                    </section>
                ))}
                <section className="hs-card" style={{ borderTop: '4px solid var(--border-strong)' }}>
                    <div className="hs-card-b">
                        <div className="hs-row"><b>Chưa vào tổ</b><span className="hs-right"><Badge tone={free.length ? 'warn' : 'ok'}>{free.length} em</Badge></span></div>
                        <div className={`hs-col ${over === 'none' ? 'over' : ''}`} style={{ marginTop: 10 }} onDragOver={(e) => { e.preventDefault(); setOver('none'); }} onDragLeave={() => setOver(null)} onDrop={(e) => onDrop(e, 'none')}>
                            <div className="hs-grid" style={{ gap: 6 }}>{free.length === 0 ? <div className="hs-small hs-muted" style={{ textAlign: 'center', padding: 14 }}>Tất cả đã vào tổ ✓</div> : free.map((s) => chip(s.id, 'none'))}</div>
                        </div>
                    </div>
                </section>
            </div>

            <div className="hs-mt" />
            <Card title="Ban cán sự lớp" extra={<div className="hs-row">{offDirty && <span className="hs-dirty">Chưa lưu</span>}<button className="hs-btn primary sm" disabled={!offDirty || busy} onClick={saveOfficers}><Icon name="check" size={14} /> Lưu ban cán sự</button></div>}>
                <div className="hs-grid hs-g3">
                    {ROLES.map((r) => (
                        <Field key={r} label={ROLE_LABEL[r]}>
                            <select className="hs-select" value={officers[r] ?? ''} onChange={(e) => { setOfficers({ ...officers, [r]: e.target.value ? Number(e.target.value) : null }); setOffDirty(true); }}>
                                <option value="">— Chưa bầu —</option>
                                {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}{s.group ? ` (${s.group.name})` : ''}</option>)}
                            </select>
                        </Field>
                    ))}
                </div>
                <div className="hs-small hs-muted">Học sinh giữ chức danh sẽ có biểu tượng ngôi sao trên sơ đồ chỗ ngồi và trong danh sách lớp. ({Object.values(officers).filter(Boolean).length}/{ROLES.length} chức danh)</div>
            </Card>

            <Modal open={modal} onClose={() => setModal(false)} title="Chia tổ tự động"
                   footer={<><button className="hs-btn" onClick={() => setModal(false)}>Hủy</button><button className="hs-btn primary" disabled={busy} onClick={autoSplit}>{busy ? 'Đang chia…' : 'Chia tổ'}</button></>}>
                <Field label="Số tổ"><input type="number" min={2} max={8} className="hs-input" value={splitN} onChange={(e) => setSplitN(Math.min(8, Math.max(2, num(e.target.value))))} /></Field>
                <p className="hs-small hs-muted">Hệ thống chia đều sĩ số, cân bằng nam – nữ và xen kẽ học lực giữa các tổ; tổ trưởng tạm là em có điểm cao nhất tổ. Bạn có thể chỉnh lại bằng cách kéo thả trước khi lưu.</p>
            </Modal>
        </>
    );
}