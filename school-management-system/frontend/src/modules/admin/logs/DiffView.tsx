import type { DiffRow } from './types';
import { fmtValue } from './utils';

const TYPE_LABEL = { added: 'Thêm', removed: 'Xóa', changed: 'Đổi' } as const;

/** So sánh giá trị TRƯỚC / SAU của từng trường. */
export default function DiffView({ rows, compact }: { rows: DiffRow[]; compact?: boolean }) {
    if (!rows.length) return <p className="lg-muted">Không có trường nào thay đổi.</p>;
    return (
        <div className={`lg-diff${compact ? ' lg-diff--compact' : ''}`} role="table" aria-label="So sánh trước và sau">
            <div className="lg-diff__head" role="row"><span>Trường</span><span>Trước</span><span>Sau</span></div>
            {rows.map((r) => (
                <div key={r.key} className={`lg-diff__row lg-diff__row--${r.type}`} role="row">
                    <span className="lg-diff__key" role="cell"><code>{r.key}</code><em>{TYPE_LABEL[r.type]}</em></span>
                    <span className="lg-diff__before" role="cell">{r.type === 'added' ? <i>—</i> : <del>{fmtValue(r.before)}</del>}</span>
                    <span className="lg-diff__after" role="cell">{r.type === 'removed' ? <i>—</i> : <ins>{fmtValue(r.after)}</ins>}</span>
                </div>
            ))}
        </div>
    );
}