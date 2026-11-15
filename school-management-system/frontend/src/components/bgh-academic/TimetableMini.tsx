'use client';

import { WEEKDAYS, hueOf } from '@/lib/bgh-academic';

/** Lưới lịch dạy thu nhỏ (6 thứ × 5 tiết) cho hồ sơ giáo viên. */
export function TimetableMini({ slots }: { slots: { weekday: number; period: number; class_name: string; subject: string; code: string }[] }) {
  const map = new Map(slots.map((s) => [`${s.weekday}-${s.period}`, s]));
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '44px repeat(6,minmax(70px,1fr))', gap: 5, minWidth: 520 }}>
        <div />
        {[2, 3, 4, 5, 6, 7].map((d) => <div key={d} className="ac-small ac-muted ac-b" style={{ textAlign: 'center' }}>{WEEKDAYS[d].replace('Thứ ', 'T')}</div>)}
        {[1, 2, 3, 4, 5].map((p) => (
          <div key={p} style={{ display: 'contents' }}>
            <div className="ac-small ac-muted" style={{ display: 'grid', placeItems: 'center' }}>Tiết {p}</div>
            {[2, 3, 4, 5, 6, 7].map((d) => {
              const s = map.get(`${d}-${p}`);
              const h = s ? hueOf(s.code) : 0;
              return s
                ? <div key={d} title={`${s.subject} – ${s.class_name}`} style={{ borderRadius: 8, padding: '5px 6px', fontSize: 11.5, textAlign: 'center', background: `hsl(${h} 80% 92%)`, color: `hsl(${h} 60% 25%)` }}><b>{s.class_name}</b></div>
                : <div key={d} style={{ borderRadius: 8, background: 'var(--surface-2)', border: '1px dashed var(--border)', minHeight: 26 }} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
