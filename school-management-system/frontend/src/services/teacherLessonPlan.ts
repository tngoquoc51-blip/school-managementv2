import api from '@/services/api';
import { cfg } from '@/services/teacherAttendance';

const d = (p: Promise<any>): Promise<any> =>
    p.then((r) => (r && typeof r === 'object' && 'status' in r && 'data' in r ? r.data : r));

export const errMsg = (err: any): string => {
    if (!err) return 'Đã xảy ra lỗi.';
    if (typeof err === 'string') return err;
    const msg = err.response?.data?.message || err.message;
    return msg || 'Đã xảy ra lỗi.';
};

export type PlanStatus = 'draft' | 'submitted' | 'approved' | 'returned';

export interface Overview {
    plans: {
        total: number;
        submitted: number;
        returned: number;
        approved: number;
        draft: number;
    };
    progress: {
        lessons: number;
        taught: number;
        periods: number;
        taught_periods: number;
    };
    this_week: Array<{
        id: number;
        plan_id: number;
        class_name: string;
        title: string;
        planned_date: string;
        week_no: number;
        periods: number;
    }>;
    returned: Array<{
        id: number;
        class_name: string;
        title: string;
        review_note?: string;
    }>;
}

export interface PlanRow {
    id: number;
    class_subject_id: number;
    class_name: string;
    subject: string;
    title: string;
    semester: number;
    status: PlanStatus;
    lessons: number;
    taught: number;
    total_periods: number;
    updated_at?: string;
}

export interface Item {
    id: number;
    plan_id: number;
    title: string;
    position: number;
    week_no: number;
    periods: number;
    status?: 'planned' | 'taught' | string;
    planned_date: string | null;
    taught_date?: string | null;
    is_taught?: boolean;
    taught_at?: string | null;
    objectives_knowledge: string | null;
    objectives_competence: string | null;
    objectives_quality: string | null;
    equipment: string | null;
    act_start: string | null;
    act_learn: string | null;
    act_practice: string | null;
    act_apply: string | null;
    assessment: string | null;
    notes: string | null;
}

export interface ItemBody {
    title: string;
    week_no?: number;
    periods?: number;
    planned_date?: string | null;
    objectives_knowledge?: string | null;
    objectives_competence?: string | null;
    objectives_quality?: string | null;
    equipment?: string | null;
    act_start?: string | null;
    act_learn?: string | null;
    act_practice?: string | null;
    act_apply?: string | null;
    assessment?: string | null;
    notes?: string | null;
}

export interface PlanEvent {
    id: number;
    action: string;
    actor_type?: string;
    actor_name: string;
    note: string | null;
    created_at: string;
}

export interface PlanDetail {
    id: number;
    class_subject_id: number;
    class_name: string;
    subject: string;
    title: string;
    semester: number;
    status: PlanStatus;
    description: string | null;
    total_periods: number;
    lessons: number;
    taught: number;
    updated_at: string;
    reviewed_at?: string | null;
    reviewer_name?: string | null;
    review_note?: string | null;
    items: Item[];
    events: PlanEvent[];
    can_edit: boolean;
}

const B = '/gv/teacher/lesson-plans';

export const lessonPlans = {
    overview: () => d(api.get(`${B}/overview`, cfg())),
    list: (params?: { class_subject_id?: number; semester?: number; status?: string }) =>
        d(api.get(B, { ...cfg(), params })),
    show: (id: number) => d(api.get(`${B}/${id}`, cfg())),
    create: (data: { class_subject_id: number; semester: number; title: string; description?: string }) =>
        d(api.post(B, data, cfg())),
    update: (id: number, data: Partial<{ title: string; description: string }>) =>
        d(api.put(`${B}/${id}`, data, cfg())),
    remove: (id: number) => d(api.delete(`${B}/${id}`, cfg())),
    delete: (id: number) => d(api.delete(`${B}/${id}`, cfg())),
    submit: (id: number) => d(api.post(`${B}/${id}/submit`, {}, cfg())),
    reopen: (id: number) => d(api.post(`${B}/${id}/reopen`, {}, cfg())),
    clone: (id: number, target_class_subject_ids: number[]) =>
        d(api.post(`${B}/${id}/clone`, { target_class_subject_ids }, cfg())),
    reorder: (id: number, item_ids: number[]) =>
        d(api.post(`${B}/${id}/reorder`, { item_ids }, cfg())),
    addItem: (planId: number, data: ItemBody) =>
        d(api.post(`${B}/${planId}/items`, data, cfg())),
    updateItem: (itemId: number, data: ItemBody) =>
        d(api.put(`${B}/items/${itemId}`, data, cfg())),
    removeItem: (itemId: number) => d(api.delete(`${B}/items/${itemId}`, cfg())),
    deleteItem: (itemId: number) => d(api.delete(`${B}/items/${itemId}`, cfg())),
    taught: (itemId: number, taught: boolean) =>
        d(api.post(`${B}/items/${itemId}/taught`, { taught }, cfg())),
    setTaught: (itemId: number, taught: boolean) =>
        d(api.post(`${B}/items/${itemId}/taught`, { taught }, cfg())),
};
