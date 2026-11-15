import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/services/api';

/** Tất cả endpoint của khu vực Chuyên môn – BGH nằm dưới /api/v1/academic/bgh */
const BASE = '/academic/bgh';

export type Params = Record<string, string | number | undefined | null>;

export function errMsg(e: any): string {
  const d = e?.response?.data;
  if (d?.errors && typeof d.errors === 'object') {
    const first = Object.values(d.errors)[0] as any;
    if (Array.isArray(first) && first[0]) return String(first[0]);
  }
  return d?.message || e?.message || 'Có lỗi xảy ra, vui lòng thử lại.';
}

export async function apiGet<T>(path: string, params?: Params): Promise<T> {
  const clean: Params = {};
  Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') clean[k] = v; });
  const res = await api.get(BASE + path, { params: clean });
  return res.data.data as T;
}

export async function apiSend<T = any>(method: 'post' | 'put' | 'delete', path: string, body?: unknown): Promise<{ data: T; message: string }> {
  const res = await api.request({ method, url: BASE + path, data: body });
  return { data: res.data.data as T, message: res.data.message as string };
}

/** Tải dữ liệu có trạng thái loading / error và hàm reload. Tự tải lại khi path hoặc params đổi. */
export function useApi<T>(path: string | null, params: Params = {}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path);
  const [error, setError] = useState<any>(null);
  const seq = useRef(0);
  const key = path + '|' + JSON.stringify(params);

  const load = useCallback(async () => {
    if (!path) return;
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<T>(path, params);
      if (id === seq.current) setData(d);
    } catch (e) {
      if (id === seq.current) setError(e);
    } finally {
      if (id === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load, setData };
}

// ---------- Tiện ích hiển thị ----------
export const num = (v: unknown): number => (v === null || v === undefined || v === '' ? 0 : Number(v));
export const fixed = (v: unknown, d = 1): string => (v === null || v === undefined || v === '' ? '–' : Number(v).toFixed(d).replace('.', ','));
export const WEEKDAYS: Record<number, string> = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7' };
export const LEVELS = ['Tốt', 'Khá', 'Đạt', 'Chưa đạt'] as const;
export const LEVEL_COLOR: Record<string, string> = { 'Tốt': '#10b981', 'Khá': '#0ea5e9', 'Đạt': '#f59e0b', 'Chưa đạt': '#f43f5e' };
export const LEVEL_TONE: Record<string, string> = { 'Tốt': 'ok', 'Khá': 'info', 'Đạt': 'warn', 'Chưa đạt': 'bad' };

export function fmtDate(s?: string | null): string {
  if (!s) return '–';
  const d = new Date(s.replace(' ', 'T'));
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('vi-VN');
}
export function timeAgo(s?: string | null): string {
  if (!s) return '';
  const t = new Date(s.replace(' ', 'T')).getTime();
  if (isNaN(t)) return s;
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'vừa xong';
  if (m < 60) return `${m} phút trước`;
  if (m < 1440) return `${Math.floor(m / 60)} giờ trước`;
  return `${Math.floor(m / 1440)} ngày trước`;
}
export function hueOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
  return h;
}

// ---------- Kiểu dữ liệu chính ----------
export interface Meta {
  years: { id: number; label: string; is_current: number; status: string }[];
  current_year_id: number;
  classes: { id: number; school_year_id: number; grade: number; name: string }[];
  subjects: { id: number; code: string; name: string; kind: string; periods_per_week: number }[];
  teachers: { id: number; code: string; full_name: string; main_subject_id: number }[];
  periods: { id: number; start_time: string; end_time: string }[];
  quota: number;
}
export interface Overview {
  year_id: number; semester: number;
  kpi: {
    students: number; teachers: number; classes: number; subjects: number; avg_score: number | null; pass_rate: number | null;
    pending_plans: number; pending_requests: number; observations_30d: number; timetable_conflicts: number;
  };
  distribution: Record<string, number>;
  subjects: { code: string; name: string; avg_score: string }[];
  workload: { quota: number; overloaded: { id: number; full_name: string; periods: string }[]; max: string | number; items: { id: number; full_name: string; periods: string }[] };
  pending_requests: { id: number; type: string; title: string; priority: string; requested_by: string; created_at: string }[];
  recent: { kind: string; text: string; at_time: string }[];
}
export interface TeacherRow {
  id: number; code: string; full_name: string; gender: string; main_subject_id: number; main_subject: string; subject_code: string;
  group_id: number | null; group_name: string | null; group_color: string | null;
  periods_per_week: string; class_count: string; homeroom_class: string | null; avg_score: string | null; pending_plans: string; obs_score: string | null;
}
