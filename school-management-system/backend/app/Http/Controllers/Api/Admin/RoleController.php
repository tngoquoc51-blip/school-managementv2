<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    private function labels(): array
    {
        return [
            'super_admin' => 'Quản trị hệ thống',
            'principal' => 'Hiệu trưởng',
            'vice_principal' => 'Phó hiệu trưởng',
            'academic' => 'Giáo vụ',
            'accountant' => 'Kế toán',
            'teacher' => 'Giáo viên bộ môn',
            'homeroom_teacher' => 'Giáo viên chủ nhiệm',
            'department_head' => 'Tổ trưởng chuyên môn',
            'student' => 'Học sinh',
            'parent' => 'Phụ huynh',
        ];
    }

    private function permGroups(): array
    {
        return [
            'Hệ thống' => ['admin.access', 'users.view', 'users.create', 'users.update', 'users.lock', 'roles.manage', 'backup.manage'],
            'Học vụ' => ['students.view', 'students.update', 'classes.manage', 'timetable.manage', 'profile_requests.review'],
            'Điểm & Thi' => ['grades.view', 'grades.lock', 'exams.manage', 'promotion.manage'],
            'Kế toán' => ['fees.view', 'fees.collect', 'fees.report'],
            'Báo cáo' => ['reports.view'],
        ];
    }

    private function permLabel(string $name): string
    {
        $map = [
            'admin.access' => 'Vào cổng quản trị',
            'users.view' => 'Xem tài khoản',
            'users.create' => 'Tạo tài khoản',
            'users.update' => 'Sửa tài khoản',
            'users.lock' => 'Khóa / mở khóa',
            'roles.manage' => 'Quản lý vai trò & quyền',
            'students.view' => 'Xem hồ sơ học sinh',
            'students.update' => 'Cập nhật hồ sơ học sinh',
            'classes.manage' => 'Quản lý lớp',
            'timetable.manage' => 'Thời khóa biểu',
            'grades.view' => 'Xem điểm',
            'grades.lock' => 'Khóa điểm',
            'exams.manage' => 'Lịch thi',
            'promotion.manage' => 'Xét lên lớp',
            'profile_requests.review' => 'Duyệt đề nghị hồ sơ',
            'fees.view' => 'Xem khoản thu',
            'fees.collect' => 'Thu học phí',
            'fees.report' => 'Báo cáo thu',
            'reports.view' => 'Báo cáo thống kê',
            'backup.manage' => 'Sao lưu / phục hồi',
        ];
        return $map[$name] ?? $name;
    }

    /** GET /api/admin/roles */
    public function index()
    {
        $labels = $this->labels();
        $roles = Role::query()->orderBy('id')->get()->map(function (Role $r) use ($labels) {
            $userCount = DB::table('model_has_roles')
                ->where('role_id', $r->id)
                ->where('model_type', 'App\\Models\\User')
                ->count();
            $perms = $r->permissions->pluck('name')->values();
            return [
                'id' => $r->id,
                'name' => $r->name,
                'label' => $labels[$r->name] ?? $r->name,
                'guard' => $r->guard_name,
                'users_count' => $userCount,
                'permissions_count' => $perms->count(),
                'permissions' => $perms,
                'created_at' => optional($r->created_at)->format('d/m/Y'),
            ];
        });

        $permTree = [];
        foreach ($this->permGroups() as $group => $names) {
            $items = [];
            foreach ($names as $n) {
                $p = Permission::where('name', $n)->first();
                if ($p) {
                    $items[] = [
                        'id' => $p->id,
                        'name' => $p->name,
                        'label' => $this->permLabel($p->name),
                    ];
                }
            }
            if ($items) {
                $permTree[] = ['group' => $group, 'items' => $items];
            }
        }

        return response()->json([
            'data' => [
                'roles' => $roles,
                'permission_tree' => $permTree,
                'stats' => [
                    'roles' => $roles->count(),
                    'permissions' => Permission::count(),
                    'assigned' => (int) DB::table('model_has_roles')->count(),
                ],
            ],
        ]);
    }

    /** GET /api/admin/roles/{id} */
    public function show(int $id)
    {
        $r = Role::with('permissions')->find($id);
        if (!$r) {
            return response()->json(['message' => 'Không tìm thấy vai trò'], 404);
        }
        $labels = $this->labels();
        $users = DB::table('model_has_roles as m')
            ->join('users as u', 'u.id', '=', 'm.model_id')
            ->where('m.role_id', $r->id)
            ->where('m.model_type', 'App\\Models\\User')
            ->select('u.id', 'u.name', 'u.username', 'u.email', 'u.status')
            ->orderBy('u.name')
            ->limit(100)
            ->get();

        return response()->json([
            'data' => [
                'id' => $r->id,
                'name' => $r->name,
                'label' => $labels[$r->name] ?? $r->name,
                'permissions' => $r->permissions->pluck('name'),
                'users' => $users,
            ],
        ]);
    }

    /** POST /api/admin/roles */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:50|regex:/^[a-z0-9_]+$/|unique:roles,name',
            'label' => 'nullable|string|max:100',
            'permissions' => 'array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        $role = Role::create([
            'name' => $data['name'],
            'guard_name' => 'web',
        ]);
        if (!empty($data['permissions'])) {
            $role->syncPermissions($data['permissions']);
        }

        return response()->json([
            'message' => 'Đã tạo vai trò',
            'data' => ['id' => $role->id, 'name' => $role->name],
        ], 201);
    }

    /** PUT /api/admin/roles/{id}/permissions */
    public function syncPermissions(Request $request, int $id)
    {
        $role = Role::find($id);
        if (!$role) {
            return response()->json(['message' => 'Không tìm thấy vai trò'], 404);
        }
        if ($role->name === 'super_admin') {
            return response()->json(['message' => 'Không được chỉnh quyền Super Admin từ giao diện'], 422);
        }

        $data = $request->validate([
            'permissions' => 'required|array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);
        $role->syncPermissions($data['permissions']);

        return response()->json([
            'message' => 'Đã cập nhật quyền cho vai trò',
            'data' => ['permissions' => $role->fresh()->permissions->pluck('name')],
        ]);
    }

    /** DELETE /api/admin/roles/{id} */
    public function destroy(int $id)
    {
        $role = Role::find($id);
        if (!$role) {
            return response()->json(['message' => 'Không tìm thấy vai trò'], 404);
        }
        $protected = ['super_admin', 'teacher', 'student', 'parent', 'academic', 'accountant'];
        if (in_array($role->name, $protected, true)) {
            return response()->json(['message' => 'Không được xóa vai trò hệ thống'], 422);
        }
        $count = DB::table('model_has_roles')->where('role_id', $role->id)->count();
        if ($count > 0) {
            return response()->json(['message' => "Còn {$count} tài khoản đang dùng vai trò này"], 422);
        }
        $role->delete();
        return response()->json(['message' => 'Đã xóa vai trò']);
    }
}
