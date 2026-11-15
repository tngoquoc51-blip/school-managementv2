import type { AxiosError, AxiosResponse } from 'axios';
import api from '@/services/api';
import type {
    AuditLog, BulkResult, CatalogGroup, CatalogItem, Department, Envelope, ImportResult, ListParams, Overview,
    Paged, ResourceApi, Room, Subject, AccountStatus, AccountType, RoleRow, UserBulkResult, UserRow, UserSummary,
} from './types';

const unwrap = <T,>(res: AxiosResponse<Envelope<T>>): T => res.data.data;

/** Lấy thông điệp lỗi thân thiện từ phản hồi API (hoặc lỗi mạng). */
export function getErrorMessage(error: unknown, fallback = 'Có lỗi xảy ra, vui lòng thử lại.'): string {
    const e = error as AxiosError<Envelope<unknown>>;
    if (e?.response?.data?.message) return e.response.data.message;
    if (e?.code === 'ERR_NETWORK') return 'Không kết nối được máy chủ API. Hãy kiểm tra Laragon/Apache và địa chỉ NEXT_PUBLIC_API_URL.';
    if (e?.response?.status === 401) return 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';
    if (e?.response?.status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
    if (e?.response?.status === 404) return 'Không tìm thấy dữ liệu (API chưa có route hoặc bản ghi đã bị xóa).';
    return fallback;
}

/** Lỗi theo từng trường (HTTP 422). */
export function getFieldErrors(error: unknown): Record<string, string[]> {
    const e = error as AxiosError<Envelope<unknown>>;
    return e?.response?.status === 422 ? (e.response.data.errors ?? {}) : {};
}

async function download(url: string, params: ListParams, fallbackName: string) {
    const res = await api.get(url, { params, responseType: 'blob' });
    const disposition = String(res.headers['content-disposition'] ?? '');
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    const name = match ? decodeURIComponent(match[1]) : fallbackName;
    const href = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
}

function clean(params: ListParams): ListParams {
    return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')) as ListParams;
}

/** CRUD chuẩn cho /catalog/{resource}. */
function makeResourceApi<T>(resource: string, exportName: string): ResourceApi<T> {
    const base = `/catalog/${resource}`;
    return {
        list: async (params) => unwrap<Paged<T>>(await api.get(base, { params: clean(params) })),
        create: async (body) => unwrap<T>(await api.post(base, body)),
        update: async (id, body) => unwrap<T>(await api.put(`${base}/${id}`, body)),
        toggle: async (id) => unwrap<T>(await api.patch(`${base}/${id}/toggle`)),
        remove: async (id, force) => unwrap<{ audit_id: number }>(await api.delete(`${base}/${id}`, { params: force ? { force: 1 } : undefined })),
        bulk: async (action, ids) => unwrap<BulkResult>(await api.post(`${base}/bulk`, { action, ids })),
        exportCsv: (params) => download(`${base}/export`, clean({ ...params, page: undefined, per_page: undefined }), `${exportName}.csv`),
    };
}

export const subjectApi = makeResourceApi<Subject>('subjects', 'mon_hoc');
export const departmentApi = makeResourceApi<Department>('departments', 'to_chuyen_mon');
export const roomApi = makeResourceApi<Room>('rooms', 'phong_hoc');
export const groupApi = makeResourceApi<CatalogGroup>('groups', 'nhom_danh_muc');

/** Các mục của một nhóm danh mục dùng chung. */
export function makeItemApi(groupId: number): ResourceApi<CatalogItem> {
    const generic = makeResourceApi<CatalogItem>('items', 'danh_muc');
    return {
        ...generic,
        list: async (params) => unwrap<Paged<CatalogItem>>(await api.get(`/catalog/groups/${groupId}/items`, { params: clean(params) })),
        create: async (body) => unwrap<CatalogItem>(await api.post(`/catalog/groups/${groupId}/items`, body)),
        exportCsv: (params) => download(`/catalog/groups/${groupId}/items/export`, clean({ ...params, page: undefined, per_page: undefined }), 'danh_muc.csv'),
    };
}

export const catalogService = {
    overview: async () => unwrap<Overview>(await api.get('/catalog/overview')),

    auditLogs: async (params: Record<string, string | number | undefined>) =>
        unwrap<Paged<AuditLog>>(await api.get('/catalog/audit-logs', { params: clean(params as ListParams) })),

    restore: async (logId: number) => unwrap<{ entity_id: number; label: string }>(await api.post(`/catalog/audit-logs/${logId}/restore`)),

    importItems: async (groupId: number, rows: Record<string, string>[], mode: 'skip' | 'update') =>
        unwrap<ImportResult>(await api.post(`/catalog/groups/${groupId}/items/import`, { rows, mode })),

    // ── Người dùng & chức năng ──
    userSummary: async () => unwrap<UserSummary>(await api.get('/catalog/users/summary')),
    users: async (params: Record<string, string | number | undefined>) =>
        unwrap<Paged<UserRow>>(await api.get('/catalog/users', { params: clean(params as ListParams) })),
    exportUsers: (params: Record<string, string | undefined>) => download('/catalog/users/export', clean(params as ListParams), 'nguoi_dung.csv'),
    userRoles: async () => unwrap<{ roles: RoleRow[]; permissions: string[] }>(await api.get('/catalog/users/roles')),
    setUserStatus: async (type: AccountType, id: number, status: Exclude<AccountStatus, 'pending'>) =>
        unwrap<{ status: string }>(await api.patch(`/catalog/users/${type}/${id}/status`, { status })),
    resetUserPassword: async (type: AccountType, id: number) =>
        unwrap<{ temporary_password: string; username: string | null }>(await api.post(`/catalog/users/${type}/${id}/reset-password`)),
    setUserRoles: async (type: AccountType, id: number, roles: string[]) =>
        unwrap<{ roles: string[] }>(await api.put(`/catalog/users/${type}/${id}/roles`, { roles })),
    bulkUsers: async (action: 'lock' | 'unlock' | 'deactivate', keys: string[]) =>
        unwrap<UserBulkResult>(await api.post('/catalog/users/bulk', { action, keys })),
    setRolePermissions: async (roleId: number, permissions: string[]) =>
        unwrap<{ permissions: string[] }>(await api.put(`/catalog/users/roles/${roleId}/permissions`, { permissions })),
};