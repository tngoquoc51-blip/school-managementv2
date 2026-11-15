'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import s from '../categories.module.css';
import type { BaseRow, FieldDef } from '../types';
import { PALETTE } from '../constants';
import { Drawer, Switch } from './ui';
import Icon from './Icon';

interface Props<T extends BaseRow> {
    open: boolean;
    singular: string;
    fields: FieldDef[];
    /** null = thêm mới */
    row: T | null;
    initial: Record<string, unknown>;
    saving: boolean;
    errors: Record<string, string[]>;
    onClose: () => void;
    onSubmit: (body: Record<string, unknown>) => void;
}

/** Form dựng tự động từ danh sách FieldDef — dùng chung cho mọi danh mục. */
export default function FormDrawer<T extends BaseRow>({ open, singular, fields, row, initial, saving, errors, onClose, onSubmit }: Props<T>) {
    const [values, setValues] = useState<Record<string, unknown>>(initial);
    const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
    const isEdit = row !== null;

    useEffect(() => {
        if (open) {
            setValues(initial);
            setClientErrors({});
        }
    }, [open, initial]);

    const set = (name: string, v: unknown) => {
        setValues((prev) => ({ ...prev, [name]: v }));
        setClientErrors((prev) => ({ ...prev, [name]: '' }));
    };

    const locked = useMemo(
        () => (f: FieldDef) => (isEdit && f.lockOnEdit) || (row?.is_system && f.lockWhenSystem),
        [isEdit, row]
    );

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const problems: Record<string, string> = {};
        const body: Record<string, unknown> = {};

        for (const f of fields) {
            let v = values[f.name];
            if (f.type === 'number') {
                v = v === '' || v === null || v === undefined ? null : Number(v);
                if (v !== null && Number.isNaN(v)) problems[f.name] = `${f.label} phải là số`;
                else if (v !== null && f.min !== undefined && (v as number) < f.min) problems[f.name] = `${f.label} tối thiểu là ${f.min}`;
                else if (v !== null && f.max !== undefined && (v as number) > f.max) problems[f.name] = `${f.label} tối đa là ${f.max}`;
            } else if (f.type === 'text' || f.type === 'textarea') {
                v = String(v ?? '').trim();
                if (f.uppercase) v = (v as string).toUpperCase();
                if (v === '' && !f.required) v = null;
            } else if (f.type === 'select' && v === '') {
                v = null;
            }
            if (f.required && (v === null || v === '' || v === undefined || (Array.isArray(v) && v.length === 0))) {
                problems[f.name] = `${f.label} không được để trống`;
            }
            body[f.name] = v;
        }

        setClientErrors(problems);
        if (Object.keys(problems).length === 0) onSubmit(body);
    };

    const errorOf = (name: string) => clientErrors[name] || errors[name]?.[0] || '';

    const renderField = (f: FieldDef) => {
        const id = `f-${f.name}`;
        const err = errorOf(f.name);
        const disabled = Boolean(locked(f));
        const v = values[f.name];

        let control;
        switch (f.type) {
            case 'select':
                control = (
                    <select id={id} value={(v as string | number | null) ?? ''} disabled={disabled} onChange={(e) => set(f.name, e.target.value)}>
                        <option value="">{f.placeholder ?? '— Chọn —'}</option>
                        {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                );
                break;
            case 'textarea':
                control = <textarea id={id} rows={3} value={String(v ?? '')} placeholder={f.placeholder} disabled={disabled} onChange={(e) => set(f.name, e.target.value)} />;
                break;
            case 'number':
                control = (
                    <input id={id} type="number" inputMode="decimal" value={v === null || v === undefined ? '' : String(v)} min={f.min} max={f.max} step={f.step ?? 1}
                           placeholder={f.placeholder} disabled={disabled} onChange={(e) => set(f.name, e.target.value)} />
                );
                break;
            case 'color':
                control = (
                    <div className={s.colorPick}>
                        {PALETTE.map((c) => (
                            <button type="button" key={c} className={`${s.swatch} ${v === c ? s.swatchOn : ''}`} style={{ background: c }} onClick={() => set(f.name, c)} aria-label={`Màu ${c}`}>
                                {v === c && <Icon name="check" size={12} />}
                            </button>
                        ))}
                        <button type="button" className={s.swatchClear} onClick={() => set(f.name, null)} disabled={!v}>Bỏ chọn</button>
                    </div>
                );
                break;
            case 'switch':
                control = (
                    <div className={s.switchRow}>
                        <Switch checked={Boolean(v)} onChange={(x) => set(f.name, x)} label={f.label} />
                        <span>{v ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span>
                    </div>
                );
                break;
            case 'multicheck': {
                const selected = (Array.isArray(v) ? v : []) as (string | number)[];
                control = (
                    <div className={s.chips}>
                        {f.options?.map((o) => {
                            const on = selected.includes(o.value);
                            return (
                                <button type="button" key={o.value} className={`${s.chip} ${on ? s.chipOn : ''}`}
                                        onClick={() => set(f.name, on ? selected.filter((x) => x !== o.value) : [...selected, o.value])}>
                                    {on && <Icon name="check" size={12} />} {o.label}
                                </button>
                            );
                        })}
                    </div>
                );
                break;
            }
            default:
                control = (
                    <input id={id} type="text" value={String(v ?? '')} placeholder={f.placeholder} disabled={disabled} autoComplete="off"
                           style={f.uppercase ? { textTransform: 'uppercase' } : undefined} onChange={(e) => set(f.name, e.target.value)} />
                );
        }

        return (
            <div key={f.name} className={`${s.field} ${f.span === 2 ? s.fieldWide : ''} ${err ? s.fieldError : ''}`}>
                <label htmlFor={id}>{f.label}{f.required && <em>*</em>}{disabled && <Icon name="lock" size={12} />}</label>
                {control}
                {err ? <small className={s.fieldMsg}>{err}</small> : f.hint ? <small className={s.fieldHint}>{f.hint}</small> : null}
            </div>
        );
    };

    return (
        <Drawer
            open={open}
            onClose={onClose}
            title={isEdit ? `Sửa ${singular}` : `Thêm ${singular}`}
            subtitle={isEdit ? (row?.is_system ? 'Mục hệ thống: một số trường bị khóa để tránh lỗi dữ liệu.' : `Đang chỉnh sửa “${row?.name}”`) : 'Điền thông tin bên dưới rồi bấm Lưu.'}
            footer={
                <>
                    <button type="button" className={s.btnGhost} onClick={onClose} disabled={saving}>Hủy</button>
                    <button type="submit" form="catalog-form" className={s.btnPrimary} disabled={saving}>
                        {saving ? <><span className={s.spinner} /> Đang lưu…</> : <><Icon name="check" size={16} /> Lưu</>}
                    </button>
                </>
            }
        >
            <form id="catalog-form" className={s.formGrid} onSubmit={submit} noValidate>
                {fields.map(renderField)}
            </form>
        </Drawer>
    );
}