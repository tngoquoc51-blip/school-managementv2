'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, SettingsApi } from './api';
import { useToast } from './ui';

/** Tải + lưu nhóm khóa trong sm_fee_settings, biết form đã sửa hay chưa. */
export function useFeeSettings(keys: string[], onSaved?: () => void) {
    const toast = useToast();
    const [saved, setSaved] = useState<Record<string, string>>({});
    const [form, setForm] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await SettingsApi.feeSettings();
            const pick = Object.fromEntries(keys.map((k) => [k, data[k] ?? '']));
            setSaved(pick); setForm(pick);
        } catch (e) {
            toast('error', 'Không tải được cài đặt', (e as Error).message);
        } finally { setLoading(false); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { load(); }, [load]);

    const dirty = useMemo(() => keys.some((k) => (form[k] ?? '') !== (saved[k] ?? '')), [form, saved, keys]);
    const set = (k: string, v: string) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })); };

    const save = async () => {
        setBusy(true);
        try {
            const res: any = await SettingsApi.saveFeeSettings(form);
            setSaved(form); setErrors({});
            toast('success', res.message || 'Đã lưu');
            onSaved?.();
        } catch (e) {
            const err = e as ApiError;
            if (err.errors) setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])));
            toast('error', 'Chưa lưu được', err.message);
        } finally { setBusy(false); }
    };

    return { form, set, errors, dirty, loading, busy, save, reset: () => { setForm(saved); setErrors({}); } };
}