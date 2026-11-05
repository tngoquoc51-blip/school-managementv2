'use client';

import { ReactNode, useEffect } from 'react';
import { Icon } from './Icons';

interface Props {
  open: boolean; onClose: () => void; title: string; subtitle?: string; size?: 'sm' | 'md' | 'lg';
  children: ReactNode; footer?: ReactNode;
}

export function Modal({ open, onClose, title, subtitle, size = 'md', children, footer }: Props) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="a-ov" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`a-modal ${size === 'md' ? '' : size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="a-modal-h">
          <div style={{ flex: 1 }}><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
          <button className="a-icon-btn" onClick={onClose} aria-label="Đóng"><Icon name="x" /></button>
        </div>
        <div className="a-modal-b">{children}</div>
        {footer && <div className="a-modal-f">{footer}</div>}
      </div>
    </div>
  );
}

interface ConfirmProps {
  open: boolean; title: string; message: ReactNode; confirmText?: string; danger?: boolean; loading?: boolean;
  onConfirm: () => void; onClose: () => void;
}

export function ConfirmDialog({ open, title, message, confirmText = 'Xác nhận', danger, loading, onConfirm, onClose }: ConfirmProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" footer={
      <>
        <button className="a-btn" onClick={onClose}>Hủy</button>
        <button className={`a-btn ${danger ? 'dng' : 'pri'}`} onClick={onConfirm} disabled={loading}>
          {loading && <span className="a-spin" />} {confirmText}
        </button>
      </>
    }>
      <div style={{ display: 'flex', gap: 14 }}>
        <div className="a-stat" style={{ padding: 0 }}>
          <div className="ic" style={{ background: danger ? 'var(--danger-soft)' : 'var(--primary-soft)', color: danger ? 'var(--danger)' : 'var(--primary)' }}>
            <Icon name={danger ? 'trash' : 'alert'} size={22} />
          </div>
        </div>
        <div className="a-muted" style={{ paddingTop: 4 }}>{message}</div>
      </div>
    </Modal>
  );
}
