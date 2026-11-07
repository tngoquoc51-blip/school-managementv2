'use client';

import Link from 'next/link';
import { Icon } from '../ui/Icons';
import type { QuickLink } from '../../config/links';

export interface Tile {
  key: string; title: string; desc: string; icon: string; tone?: string; badge?: string | number;
  active?: boolean; onClick?: () => void; href?: string;
}

/** Lưới thẻ chức năng — nút bấm (mở giao diện trong trang) hoặc liên kết (sang trang khác). */
export function TileGrid({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="a-tiles">
      {tiles.map((t) => {
        const cls = `a-tile t-${t.tone ?? 'blue'} ${t.active ? 'on' : ''}`;
        const body = (
          <>
            <span className="ti"><Icon name={t.icon} size={22} /></span>
            <span style={{ minWidth: 0 }}><b>{t.title}</b><small>{t.desc}</small></span>
            <span className="go" style={{ transform: 'rotate(180deg)' }}><Icon name="back" size={16} /></span>
            {t.badge !== undefined && t.badge !== '' && <span className="bd">{t.badge}</span>}
          </>
        );
        return t.href
          ? <Link key={t.key} href={t.href} className={cls}>{body}</Link>
          : <button key={t.key} type="button" className={cls} onClick={t.onClick}>{body}</button>;
      })}
    </div>
  );
}

/** Hàng liên kết liên quan, đặt cuối mỗi khu làm việc. */
export function Related({ items, title = 'Mở trang liên quan' }: { items: QuickLink[]; title?: string }) {
  return (
    <div className="a-links">
      <span className="lbl">{title}</span>
      {items.map((l) => (
        <Link key={l.href} href={l.href} className="a-link" title={l.desc}><span className="ic"><Icon name={l.icon} size={16} /></span>{l.label}</Link>
      ))}
    </div>
  );
}

/** Đầu khu làm việc: tiêu đề + mô tả + vùng nút. */
export function WsHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="a-ws-h">
      <div className="a-sp"><h3>{title}</h3>{sub && <span className="a-muted">{sub}</span>}</div>
      {children}
    </div>
  );
}
