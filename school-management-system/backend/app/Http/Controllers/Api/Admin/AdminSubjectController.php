<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Quản lý môn học (Admin): danh sách, thống kê, thêm/sửa/xóa, bật/tắt, phân công giáo viên theo lớp. */
class AdminSubjectController extends Controller
{
    private const ROLES = ['super_admin', 'admin', 'system_admin', 'administrator', 'quan_tri', 'quan_tri_vien'];
    private const YEAR = '(SELECT id FROM sm_school_years WHERE is_current = 1 LIMIT 1)';

    /** Nhận token nhân sự, token Sanctum hoặc (chỉ khi APP_ENV=local) demo-token; yêu cầu vai trò quản trị. */
    private function guard(Request $r): void
    {
        $tk = $r->bearerToken();
        abort_unless($tk, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
        if (app()->environment('local') && $tk === 'demo-token') return;

        $roles = [];
        $row = DB::selectOne('SELECT a.role FROM sm_staff_tokens t JOIN sm_staff_accounts a ON a.id = t.staff_id
            WHERE t.token_hash = ? AND t.expires_at > NOW() LIMIT 1', [hash('sha256', $tk)]);
        if ($row) {
            $roles[] = strtolower((string) $row->role);
        } else {
            $u = class_exists(\Laravel\Sanctum\PersonalAccessToken::class) ? \Laravel\Sanctum\PersonalAccessToken::findToken($tk)?->tokenable : null;
            abort_unless($u, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
            if (method_exists($u, 'getRoleNames')) $roles = $u->getRoleNames()->map(fn ($x) => strtolower((string) $x))->all();
            if (is_string($u->role ?? null)) $roles[] = strtolower($u->role);
        }
        abort_unless(array_intersect($roles, self::ROLES), 403,
            'Vai trò hiện tại (' . implode(', ', $roles ?: ['không xác định']) . ') không có quyền quản lý môn học.');
    }

    private function rules(?int $id): array
    {
        return [
            'code' => ['required', 'string', 'max:10', 'regex:/^[A-Za-z0-9_]+$/', Rule::unique('sm_subjects', 'code')->ignore($id)],
            'name' => 'required|string|max:60',
            'kind' => 'required|string|max:10',
            'periods_per_week' => 'required|integer|min:1|max:10',
            'sort_order' => 'nullable|integer|min:1|max:250',
            'department' => 'nullable|string|max:60',
            'description' => 'nullable|string|max:500',
            'color' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'is_active' => 'nullable|boolean',
        ];
    }

    public function index(Request $r): JsonResponse
    {
        $this->guard($r);
        $q = trim((string) $r->query('q', ''));
        $dept = (string) $r->query('dept', 'all');
        $st = (string) $r->query('status', 'all');
        $rows = DB::select("SELECT s.id, s.code, s.name, s.kind, s.periods_per_week, s.sort_order,
              COALESCE(p.department, '') AS department, COALESCE(p.description, '') AS description,
              COALESCE(p.color, '#0ea5e9') AS color, COALESCE(p.is_active, 1) AS is_active,
              (SELECT COUNT(*) FROM sm_class_subjects cs JOIN sm_classes c ON c.id = cs.class_id
                 WHERE cs.subject_id = s.id AND c.school_year_id = " . self::YEAR . ") AS classes_count,
              (SELECT COUNT(DISTINCT cs.teacher_id) FROM sm_class_subjects cs JOIN sm_classes c ON c.id = cs.class_id
                 WHERE cs.subject_id = s.id AND c.school_year_id = " . self::YEAR . ") AS teachers_count,
              (SELECT COUNT(*) FROM sm_teachers t WHERE t.main_subject_id = s.id) AS main_teachers
            FROM sm_subjects s LEFT JOIN sm_subject_profiles p ON p.subject_id = s.id
            WHERE (? = '' OR s.name LIKE ? OR s.code LIKE ?)
              AND (? = 'all' OR COALESCE(p.department, '') = ?)
              AND (? = 'all' OR COALESCE(p.is_active, 1) = IF(? = 'active', 1, 0))
            ORDER BY s.sort_order, s.id", [$q, "%$q%", "%$q%", $dept, $dept, $st, $st]);
        return response()->json(['data' => $rows]);
    }

    public function stats(Request $r): JsonResponse
    {
        $this->guard($r);
        $s = DB::selectOne("SELECT COUNT(*) AS total, COALESCE(SUM(COALESCE(p.is_active, 1) = 1), 0) AS active,
              COALESCE(SUM(s.periods_per_week), 0) AS periods,
              COALESCE(SUM(NOT EXISTS (SELECT 1 FROM sm_class_subjects cs JOIN sm_classes c ON c.id = cs.class_id
                 WHERE cs.subject_id = s.id AND c.school_year_id = " . self::YEAR . ")), 0) AS unassigned
            FROM sm_subjects s LEFT JOIN sm_subject_profiles p ON p.subject_id = s.id");
        $dept = DB::select("SELECT COALESCE(p.department, '') AS name, COUNT(*) AS c FROM sm_subjects s
            LEFT JOIN sm_subject_profiles p ON p.subject_id = s.id GROUP BY COALESCE(p.department, '') ORDER BY c DESC");
        return response()->json(['data' => ['total' => (int) $s->total, 'active' => (int) $s->active, 'periods' => (int) $s->periods,
            'unassigned' => (int) $s->unassigned, 'departments' => $dept]]);
    }

    public function meta(Request $r): JsonResponse
    {
        $this->guard($r);
        return response()->json(['data' => [
            'classes' => DB::select('SELECT id, name, grade FROM sm_classes WHERE school_year_id = ' . self::YEAR . ' ORDER BY grade, name'),
            'teachers' => DB::select('SELECT id, code, full_name, main_subject_id FROM sm_teachers ORDER BY full_name'),
        ]]);
    }

    public function show(Request $r, int $id): JsonResponse
    {
        $this->guard($r);
        $s = DB::selectOne('SELECT s.id, s.code, s.name, s.kind, s.periods_per_week, s.sort_order,
              COALESCE(p.department, \'\') AS department, COALESCE(p.description, \'\') AS description,
              COALESCE(p.color, \'#0ea5e9\') AS color, COALESCE(p.is_active, 1) AS is_active
            FROM sm_subjects s LEFT JOIN sm_subject_profiles p ON p.subject_id = s.id WHERE s.id = ?', [$id]);
        abort_unless($s, 404, 'Không tìm thấy môn học.');
        $assign = DB::select('SELECT cs.id, c.id AS class_id, c.name AS class_name, c.grade, t.id AS teacher_id, t.full_name AS teacher_name,
              (SELECT COUNT(*) FROM sm_timetable tt WHERE tt.class_subject_id = cs.id) AS slots
            FROM sm_class_subjects cs JOIN sm_classes c ON c.id = cs.class_id JOIN sm_teachers t ON t.id = cs.teacher_id
            WHERE cs.subject_id = ? AND c.school_year_id = ' . self::YEAR . ' ORDER BY c.grade, c.name', [$id]);
        return response()->json(['data' => ['subject' => $s, 'assignments' => $assign]]);
    }

    private function save(array $v, int $id): void
    {
        DB::table('sm_subjects')->where('id', $id)->update([
            'code' => strtoupper($v['code']), 'name' => $v['name'], 'kind' => $v['kind'],
            'periods_per_week' => $v['periods_per_week'], 'sort_order' => $v['sort_order'] ?? 100,
        ]);
        DB::statement('INSERT INTO sm_subject_profiles (subject_id, department, description, color, is_active) VALUES (?,?,?,?,?)
            ON DUPLICATE KEY UPDATE department = VALUES(department), description = VALUES(description), color = VALUES(color), is_active = VALUES(is_active)',
            [$id, $v['department'] ?? '', $v['description'] ?? '', $v['color'] ?? '#0ea5e9', (int) ($v['is_active'] ?? 1)]);
    }

    public function store(Request $r): JsonResponse
    {
        $this->guard($r);
        $v = $r->validate($this->rules(null));
        $id = DB::transaction(function () use ($v) {
            $id = DB::table('sm_subjects')->insertGetId(['code' => strtoupper($v['code']), 'name' => $v['name'], 'kind' => $v['kind'],
                'periods_per_week' => $v['periods_per_week'], 'sort_order' => $v['sort_order'] ?? 100]);
            $this->save($v, $id);
            return $id;
        });
        return response()->json(['data' => ['id' => $id], 'message' => 'Đã thêm môn học'], 201);
    }

    public function update(Request $r, int $id): JsonResponse
    {
        $this->guard($r);
        abort_unless(DB::table('sm_subjects')->where('id', $id)->exists(), 404, 'Không tìm thấy môn học.');
        $v = $r->validate($this->rules($id));
        DB::transaction(fn () => $this->save($v, $id));
        return response()->json(['message' => 'Đã cập nhật môn học']);
    }

    public function toggle(Request $r, int $id): JsonResponse
    {
        $this->guard($r);
        abort_unless(DB::table('sm_subjects')->where('id', $id)->exists(), 404, 'Không tìm thấy môn học.');
        DB::statement('INSERT INTO sm_subject_profiles (subject_id, is_active) VALUES (?, 0)
            ON DUPLICATE KEY UPDATE is_active = 1 - is_active', [$id]);
        $on = (int) DB::table('sm_subject_profiles')->where('subject_id', $id)->value('is_active');
        return response()->json(['data' => ['is_active' => $on], 'message' => $on ? 'Đã bật môn học' : 'Đã tạm ngưng môn học']);
    }

    public function destroy(Request $r, int $id): JsonResponse
    {
        $this->guard($r);
        $used = DB::table('sm_class_subjects')->where('subject_id', $id)->count();
        abort_if($used > 0, 409, "Môn học đang được phân công cho $used lớp, không thể xóa. Hãy gỡ phân công hoặc tạm ngưng môn.");
        abort_if(DB::table('sm_teachers')->where('main_subject_id', $id)->exists(), 409, 'Còn giáo viên có môn chính là môn này, không thể xóa.');
        DB::transaction(function () use ($id) {
            DB::table('sm_subject_profiles')->where('subject_id', $id)->delete();
            DB::table('sm_subjects')->where('id', $id)->delete();
        });
        return response()->json(['message' => 'Đã xóa môn học']);
    }

    public function assign(Request $r, int $id): JsonResponse
    {
        $this->guard($r);
        $v = $r->validate(['class_id' => 'required|integer|exists:sm_classes,id', 'teacher_id' => 'required|integer|exists:sm_teachers,id']);
        abort_unless(DB::table('sm_subjects')->where('id', $id)->exists(), 404, 'Không tìm thấy môn học.');
        abort_if(DB::table('sm_class_subjects')->where('class_id', $v['class_id'])->where('subject_id', $id)->exists(), 409, 'Lớp này đã được phân công môn học này.');
        DB::table('sm_class_subjects')->insert(['class_id' => $v['class_id'], 'subject_id' => $id, 'teacher_id' => $v['teacher_id']]);
        return response()->json(['message' => 'Đã phân công giáo viên cho lớp'], 201);
    }

    public function reassign(Request $r, int $id, int $csid): JsonResponse
    {
        $this->guard($r);
        $v = $r->validate(['teacher_id' => 'required|integer|exists:sm_teachers,id']);
        $n = DB::table('sm_class_subjects')->where('id', $csid)->where('subject_id', $id)->update(['teacher_id' => $v['teacher_id']]);
        abort_unless($n !== null && DB::table('sm_class_subjects')->where('id', $csid)->where('subject_id', $id)->exists(), 404, 'Không tìm thấy phân công.');
        return response()->json(['message' => 'Đã đổi giáo viên phụ trách']);
    }

    public function unassign(Request $r, int $id, int $csid): JsonResponse
    {
        $this->guard($r);
        $row = DB::table('sm_class_subjects')->where('id', $csid)->where('subject_id', $id)->first();
        abort_unless($row, 404, 'Không tìm thấy phân công.');
        $slots = DB::table('sm_timetable')->where('class_subject_id', $csid)->count();
        abort_if($slots > 0, 409, "Phân công này đang có $slots tiết trong thời khóa biểu. Hãy xóa các tiết đó trước.");
        DB::table('sm_class_subjects')->where('id', $csid)->delete();
        return response()->json(['message' => 'Đã gỡ phân công']);
    }
}
