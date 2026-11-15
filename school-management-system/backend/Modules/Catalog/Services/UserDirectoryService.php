<?php

namespace Modules\Catalog\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Modules\Catalog\Exceptions\CatalogException;

/**
 * Quản lý người dùng toàn hệ thống theo chức năng (vai trò).
 * Gộp 3 nguồn tài khoản thật của dự án:
 *   web     = bảng `users` (quản trị, giáo viên, phụ huynh… — phân quyền Spatie)
 *   staff   = bảng `sm_staff_accounts` (nhân sự: giáo vụ, kế toán, hiệu trưởng… — cột `role`)
 *   student = bảng `sm_accounts` (tài khoản học sinh, gắn `sm_students`)
 */
class UserDirectoryService
{
    public const TYPES = ['web' => 'Tài khoản hệ thống', 'staff' => 'Nhân sự', 'student' => 'Học sinh'];

    public const ROLE_LABELS = [
        'super_admin' => 'Quản trị tối cao', 'principal' => 'Hiệu trưởng', 'vice_principal' => 'Phó hiệu trưởng',
        'teacher' => 'Giáo viên bộ môn', 'homeroom_teacher' => 'Giáo viên chủ nhiệm', 'department_head' => 'Tổ trưởng chuyên môn',
        'academic' => 'Giáo vụ / Đào tạo', 'giao_vu' => 'Giáo vụ', 'accountant' => 'Kế toán', 'librarian' => 'Thư viện',
        'medical' => 'Y tế học đường', 'supervisor' => 'Giám thị', 'student' => 'Học sinh', 'parent' => 'Phụ huynh', 'staff' => 'Nhân viên',
    ];

    public const STATUSES = ['active', 'inactive', 'locked'];

    public function __construct(private AuditService $audit) {}

    // ───────────────────────── Danh sách ─────────────────────────

    private function webModel(): string
    {
        return (string) config('auth.providers.users.model', 'App\\Models\\User');
    }

    private function union()
    {
        $web = DB::table('users as u')->selectRaw(
            "'web' as type, u.id as id, u.name as name, u.username as username, u.email as email, u.phone as phone,
             (SELECT GROUP_CONCAT(r.name ORDER BY r.name SEPARATOR ',') FROM model_has_roles mr JOIN roles r ON r.id = mr.role_id
               WHERE mr.model_id = u.id AND mr.model_type = ?) as roles,
             u.status as status, NULL as locked_until, NULL as last_login_at, 0 as must_change_password, u.created_at as created_at",
            [$this->webModel()]
        );

        $staff = DB::table('sm_staff_accounts as a')->selectRaw(
            "'staff' as type, a.id, a.full_name, a.username, NULL, NULL, a.role,
             CASE WHEN a.locked_until IS NOT NULL AND a.locked_until > NOW() THEN 'locked' ELSE a.status END,
             a.locked_until, a.last_login_at, 0, a.created_at"
        );

        $student = DB::table('sm_accounts as a')->join('sm_students as st', 'st.id', '=', 'a.student_id')->selectRaw(
            "'student' as type, a.id, st.full_name, a.username, a.email, NULL, 'student',
             CASE WHEN a.locked_until IS NOT NULL AND a.locked_until > NOW() THEN 'locked' ELSE a.status END,
             a.locked_until, a.last_login_at, a.must_change_password, st.created_at"
        );

        return $web->unionAll($staff)->unionAll($student);
    }

    private function base(array $f)
    {
        $q = DB::query()->fromSub($this->union(), 'x');

        if (! empty($f['type']) && isset(self::TYPES[$f['type']])) {
            $q->where('x.type', $f['type']);
        }
        if (! empty($f['status'])) {
            $q->where('x.status', $f['status']);
        }
        if (! empty($f['role'])) {
            $q->whereRaw('FIND_IN_SET(?, x.roles) > 0', [$f['role']]);
        }
        if (! empty($f['search'])) {
            $like = '%' . addcslashes(trim((string) $f['search']), '%_\\') . '%';
            $q->where(fn ($w) => $w->where('x.name', 'like', $like)->orWhere('x.username', 'like', $like)->orWhere('x.email', 'like', $like));
        }

        return $q;
    }

    public function paginate(array $f, int $perPage): LengthAwarePaginator
    {
        $sort = in_array($f['sort'] ?? '', ['name', 'last_login_at', 'created_at'], true) ? $f['sort'] : 'created_at';
        $dir = ($f['dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        $page = $this->base($f)->orderBy("x.$sort", $dir)->orderBy('x.id')->paginate($perPage);
        $page->setCollection($page->getCollection()->map(fn ($r) => $this->present($r)));

        return $page;
    }

    public function export(array $f): array
    {
        return $this->base($f)->orderBy('x.type')->orderBy('x.name')->limit(10000)->get()->map(fn ($r) => $this->present($r))->all();
    }

    private function present(object $r): array
    {
        $roles = $r->roles ? array_values(array_filter(explode(',', (string) $r->roles))) : [];

        return [
            'key' => $r->type . ':' . $r->id,
            'type' => $r->type,
            'type_label' => self::TYPES[$r->type] ?? $r->type,
            'id' => (int) $r->id,
            'name' => $r->name,
            'username' => $r->username,
            'email' => $r->email,
            'phone' => $r->phone,
            'roles' => $roles,
            'role_labels' => array_map(fn ($x) => self::ROLE_LABELS[$x] ?? $x, $roles),
            'status' => $r->status,
            'locked_until' => $r->locked_until,
            'last_login_at' => $r->last_login_at,
            'must_change_password' => (bool) $r->must_change_password,
            'created_at' => $r->created_at,
            'is_self' => $r->type === 'web' && (int) $r->id === (int) Auth::id(),
        ];
    }

    // ───────────────────────── Thống kê & vai trò ─────────────────────────

    public function summary(): array
    {
        $union = $this->union();
        $byType = DB::query()->fromSub($union, 'x')->selectRaw('x.type, COUNT(*) as c')->groupBy('x.type')->pluck('c', 'type');
        $byStatus = DB::query()->fromSub($this->union(), 'x')->selectRaw('x.status, COUNT(*) as c')->groupBy('x.status')->pluck('c', 'status');

        $types = [];
        foreach (self::TYPES as $k => $label) {
            $types[] = ['key' => $k, 'label' => $label, 'count' => (int) ($byType[$k] ?? 0)];
        }

        $recentLogin = DB::query()->fromSub($this->union(), 'x')->where('x.last_login_at', '>=', now()->subDays(7))->count();
        $mustChange = DB::table('sm_accounts')->where('must_change_password', 1)->count();

        return [
            'total' => (int) $byType->sum(),
            'types' => $types,
            'status' => [
                'active' => (int) ($byStatus['active'] ?? 0),
                'pending' => (int) ($byStatus['pending'] ?? 0),
                'locked' => (int) ($byStatus['locked'] ?? 0),
                'inactive' => (int) ($byStatus['inactive'] ?? 0),
            ],
            'logged_in_7d' => $recentLogin,
            'must_change_password' => $mustChange,
        ];
    }

    /** Danh sách chức năng (vai trò) kèm số người dùng và quyền chi tiết. */
    public function roles(): array
    {
        $webCounts = DB::table('model_has_roles')->where('model_type', $this->webModel())->selectRaw('role_id, COUNT(*) c')->groupBy('role_id')->pluck('c', 'role_id');
        $staffCounts = DB::table('sm_staff_accounts')->selectRaw('role, COUNT(*) c')->groupBy('role')->pluck('c', 'role');
        $studentTotal = DB::table('sm_accounts')->count();

        $perms = [];
        if (Schema::hasTable('role_has_permissions')) {
            foreach (DB::table('role_has_permissions as rp')->join('permissions as p', 'p.id', '=', 'rp.permission_id')->select('rp.role_id', 'p.name')->orderBy('p.name')->get() as $row) {
                $perms[$row->role_id][] = $row->name;
            }
        }

        return DB::table('roles')->orderBy('id')->get()->map(function ($r) use ($webCounts, $staffCounts, $studentTotal, $perms) {
            $count = (int) ($webCounts[$r->id] ?? 0) + (int) ($staffCounts[$r->name] ?? 0) + ($r->name === 'student' ? $studentTotal : 0);

            return [
                'id' => (int) $r->id,
                'name' => $r->name,
                'label' => self::ROLE_LABELS[$r->name] ?? $r->name,
                'users_count' => $count,
                'permissions' => $perms[$r->id] ?? [],
                'locked' => $r->name === 'super_admin',
            ];
        })->all();
    }

    public function permissionList(): array
    {
        return Schema::hasTable('permissions') ? DB::table('permissions')->orderBy('name')->pluck('name')->all() : [];
    }

    // ───────────────────────── Thao tác ─────────────────────────

    private function load(string $type, int $id): object
    {
        $row = match ($type) {
            'web' => DB::table('users')->where('id', $id)->first(),
            'staff' => DB::table('sm_staff_accounts')->where('id', $id)->first(),
            'student' => DB::table('sm_accounts as a')->join('sm_students as st', 'st.id', '=', 'a.student_id')->where('a.id', $id)->selectRaw('a.*, st.full_name')->first(),
            default => throw new CatalogException('Loại tài khoản không hợp lệ.', 422),
        };
        if (! $row) {
            throw new CatalogException('Không tìm thấy tài khoản.', 404);
        }

        return $row;
    }

    private function nameOf(string $type, object $row): string
    {
        $n = $type === 'web' ? $row->name : $row->full_name;

        return $n . ' (' . mb_strtolower(self::TYPES[$type]) . ')';
    }

    private function rolesOf(string $type, object $row): array
    {
        return match ($type) {
            'web' => DB::table('model_has_roles as mr')->join('roles as r', 'r.id', '=', 'mr.role_id')
                ->where('mr.model_type', $this->webModel())->where('mr.model_id', $row->id)->orderBy('r.name')->pluck('r.name')->all(),
            'staff' => [$row->role],
            default => ['student'],
        };
    }

    private function statusOf(string $type, object $row): string
    {
        if ($type !== 'web' && ! empty($row->locked_until) && strtotime((string) $row->locked_until) > time()) {
            return 'locked';
        }

        return (string) $row->status;
    }

    private function table(string $type): string
    {
        return ['web' => 'users', 'staff' => 'sm_staff_accounts', 'student' => 'sm_accounts'][$type];
    }

    /** Số quản trị tối cao còn hoạt động, không tính tài khoản (type,id) đang xét. */
    private function otherActiveSuperAdmins(string $type, int $id): int
    {
        $web = DB::table('users as u')->join('model_has_roles as mr', fn ($j) => $j->on('mr.model_id', '=', 'u.id')->where('mr.model_type', $this->webModel()))
            ->join('roles as r', 'r.id', '=', 'mr.role_id')->where('r.name', 'super_admin')->where('u.status', 'active')
            ->when($type === 'web', fn ($q) => $q->where('u.id', '!=', $id))->distinct()->count('u.id');
        $staff = DB::table('sm_staff_accounts')->where('role', 'super_admin')->where('status', 'active')
            ->when($type === 'staff', fn ($q) => $q->where('id', '!=', $id))->count();

        return $web + $staff;
    }

    private function revokeTokens(string $type, int $id): void
    {
        if ($type === 'web' && Schema::hasTable('personal_access_tokens')) {
            DB::table('personal_access_tokens')->where('tokenable_type', $this->webModel())->where('tokenable_id', $id)->delete();
        } elseif ($type === 'staff' && Schema::hasTable('sm_staff_tokens')) {
            DB::table('sm_staff_tokens')->where('staff_id', $id)->delete();
        } elseif ($type === 'student' && Schema::hasTable('sm_api_tokens')) {
            DB::table('sm_api_tokens')->where('account_id', $id)->delete();
        }
    }

    private function forgetPermissionCache(): void
    {
        if (class_exists(\Spatie\Permission\PermissionRegistrar::class)) {
            app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
        }
    }

    /** Khóa / mở khóa / ngừng sử dụng một tài khoản. */
    public function setStatus(string $type, int $id, string $status): array
    {
        if (! in_array($status, self::STATUSES, true)) {
            throw new CatalogException('Trạng thái không hợp lệ.', 422);
        }
        $row = $this->load($type, $id);
        $before = $this->statusOf($type, $row);

        if ($status !== 'active') {
            if ($type === 'web' && (int) $id === (int) Auth::id()) {
                throw new CatalogException('Bạn không thể khóa hoặc ngừng chính tài khoản đang đăng nhập.', 422);
            }
            if (in_array('super_admin', $this->rolesOf($type, $row), true) && $this->otherActiveSuperAdmins($type, $id) < 1) {
                throw new CatalogException('Đây là tài khoản quản trị tối cao cuối cùng còn hoạt động, không thể khóa.', 422);
            }
        }

        DB::transaction(function () use ($type, $id, $status) {
            $data = ['status' => $status];
            if ($type !== 'web') {
                if ($status === 'active') {
                    $data += ['failed_attempts' => 0, 'locked_until' => null];
                }
            } else {
                $data['updated_at'] = now();
            }
            DB::table($this->table($type))->where('id', $id)->update($data);
            if ($status !== 'active') {
                $this->revokeTokens($type, $id);
            }
        });

        $action = $status === 'active' ? 'unlock' : ($status === 'locked' ? 'lock' : 'deactivate');
        $this->audit->record('user', $id, $this->nameOf($type, $row), $action, ['type' => $type, 'status' => $before], ['type' => $type, 'status' => $status]);

        return ['status' => $status];
    }

    /** Đặt lại mật khẩu — trả mật khẩu tạm thời đúng một lần, không lưu vào nhật ký. */
    public function resetPassword(string $type, int $id): array
    {
        $row = $this->load($type, $id);
        $plain = Str::upper(Str::random(2)) . Str::lower(Str::random(5)) . random_int(100, 999) . '@';
        $hash = Hash::make($plain);

        DB::transaction(function () use ($type, $id, $hash) {
            match ($type) {
                'web' => DB::table('users')->where('id', $id)->update(['password' => $hash, 'updated_at' => now()]),
                'staff' => DB::table('sm_staff_accounts')->where('id', $id)->update(['password_hash' => $hash, 'failed_attempts' => 0, 'locked_until' => null]),
                'student' => DB::table('sm_accounts')->where('id', $id)->update(['password_hash' => $hash, 'must_change_password' => 1, 'failed_attempts' => 0, 'locked_until' => null, 'password_changed_at' => null]),
            };
            $this->revokeTokens($type, $id);
        });

        $this->audit->record('user', $id, $this->nameOf($type, $row), 'reset_password', null, ['type' => $type, 'note' => 'Đã cấp mật khẩu tạm thời']);

        return ['temporary_password' => $plain, 'username' => $row->username ?? null];
    }

    /** Gán lại chức năng. web: nhiều vai trò (Spatie). staff: đúng một vai trò. student: không đổi. */
    public function setRoles(string $type, int $id, array $roles): array
    {
        if ($type === 'student') {
            throw new CatalogException('Tài khoản học sinh luôn có chức năng "Học sinh".', 422);
        }
        $roles = array_values(array_unique($roles));
        $valid = DB::table('roles')->whereIn('name', $roles)->pluck('id', 'name');
        foreach ($roles as $r) {
            if (! isset($valid[$r])) {
                throw new CatalogException("Chức năng \"$r\" không tồn tại.", 422);
            }
        }
        if ($type === 'staff' && count($roles) !== 1) {
            throw new CatalogException('Tài khoản nhân sự chỉ có đúng một chức năng.', 422);
        }

        $row = $this->load($type, $id);
        $old = $this->rolesOf($type, $row);

        if (in_array('super_admin', $old, true) && ! in_array('super_admin', $roles, true)) {
            if ($type === 'web' && (int) $id === (int) Auth::id()) {
                throw new CatalogException('Bạn không thể tự gỡ quyền quản trị tối cao của mình.', 422);
            }
            if ($this->otherActiveSuperAdmins($type, $id) < 1) {
                throw new CatalogException('Phải còn ít nhất một quản trị tối cao đang hoạt động.', 422);
            }
        }

        DB::transaction(function () use ($type, $id, $roles, $valid) {
            if ($type === 'staff') {
                DB::table('sm_staff_accounts')->where('id', $id)->update(['role' => $roles[0]]);
                $this->revokeTokens('staff', $id);
                return;
            }
            DB::table('model_has_roles')->where('model_type', $this->webModel())->where('model_id', $id)->delete();
            foreach ($roles as $r) {
                DB::table('model_has_roles')->insert(['role_id' => $valid[$r], 'model_type' => $this->webModel(), 'model_id' => $id]);
            }
        });
        $this->forgetPermissionCache();

        $this->audit->record('user', $id, $this->nameOf($type, $row), 'roles', ['type' => $type, 'roles' => $old], ['type' => $type, 'roles' => $roles]);

        return ['roles' => $roles];
    }

    /** Hàng loạt: lock | unlock | deactivate. */
    public function bulkStatus(string $action, array $keys): array
    {
        $map = ['lock' => 'locked', 'unlock' => 'active', 'deactivate' => 'inactive'];
        if (! isset($map[$action])) {
            throw new CatalogException('Hành động không hợp lệ.', 422);
        }
        $done = 0;
        $skipped = [];
        foreach (array_slice(array_unique($keys), 0, 200) as $key) {
            [$type, $id] = array_pad(explode(':', (string) $key, 2), 2, null);
            try {
                $this->setStatus((string) $type, (int) $id, $map[$action]);
                $done++;
            } catch (CatalogException $e) {
                $skipped[] = ['key' => $key, 'reason' => $e->getMessage()];
            }
        }

        return ['action' => $action, 'processed' => $done, 'skipped' => $skipped];
    }

    /** Cập nhật quyền chi tiết của một chức năng. */
    public function setRolePermissions(int $roleId, array $permissions): array
    {
        $role = DB::table('roles')->where('id', $roleId)->first();
        if (! $role) {
            throw new CatalogException('Không tìm thấy chức năng.', 404);
        }
        if ($role->name === 'super_admin') {
            throw new CatalogException('Chức năng Quản trị tối cao luôn có toàn quyền, không thể chỉnh.', 422);
        }
        $permissions = array_values(array_unique($permissions));
        $ids = DB::table('permissions')->whereIn('name', $permissions)->pluck('id', 'name');
        foreach ($permissions as $p) {
            if (! isset($ids[$p])) {
                throw new CatalogException("Quyền \"$p\" không tồn tại.", 422);
            }
        }
        $old = DB::table('role_has_permissions as rp')->join('permissions as p', 'p.id', '=', 'rp.permission_id')->where('rp.role_id', $roleId)->orderBy('p.name')->pluck('p.name')->all();

        DB::transaction(function () use ($roleId, $permissions, $ids) {
            DB::table('role_has_permissions')->where('role_id', $roleId)->delete();
            foreach ($permissions as $p) {
                DB::table('role_has_permissions')->insert(['permission_id' => $ids[$p], 'role_id' => $roleId]);
            }
        });
        $this->forgetPermissionCache();

        sort($permissions);
        $this->audit->record('role', $roleId, self::ROLE_LABELS[$role->name] ?? $role->name, 'permissions', ['permissions' => $old], ['permissions' => $permissions]);

        return ['permissions' => $permissions];
    }
}
