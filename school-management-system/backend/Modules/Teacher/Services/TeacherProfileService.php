<?php

namespace Modules\Teacher\Services;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Hồ sơ cá nhân giáo viên – dùng tài khoản nhân viên (sm_staff_accounts / sm_staff_tokens),
 * cùng cách xác thực với StaffToken của Cổng giáo viên.
 */
class TeacherProfileService
{
    private const PROFILE_FIELDS = [
        'phone', 'email', 'gender', 'birth_date', 'ethnicity', 'religion', 'id_number', 'hometown', 'address',
        'degree_level', 'major', 'job_title', 'department', 'career_start_year', 'joined_at', 'bio',
        'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
    ];

    private const REQUEST_FIELDS = ['full_name' => 'Họ và tên', 'gender' => 'Giới tính', 'employee_code' => 'Mã giáo viên'];

    private const DEFAULT_PREFS = ['email' => true, 'push' => true, 'grades' => true, 'attendance' => true, 'system' => true, 'security' => true];

    /* ---------- danh tính ---------- */

    /** Tài khoản nhân viên đang đăng nhập (tra từ Bearer token, giống LessonAttendanceStaffController) */
    public function staff(Request $r): object
    {
        $token = $r->bearerToken();
        $row = $token ? DB::table('sm_staff_tokens as k')->join('sm_staff_accounts as a', 'a.id', '=', 'k.staff_id')
            ->where('k.token_hash', hash('sha256', $token))->where('k.expires_at', '>', now())
            ->first(['a.id', 'a.username', 'a.full_name', 'a.role', 'a.teacher_id', 'a.status', 'a.last_login_at', 'k.id as token_id']) : null;
        abort_unless($row, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');

        return $row;
    }

    private function teacherOf(object $staff): ?object
    {
        if (! $staff->teacher_id) return null;

        return DB::table('sm_teachers as t')->leftJoin('sm_subjects as s', 's.id', '=', 't.main_subject_id')
            ->where('t.id', $staff->teacher_id)->first(['t.id', 't.code', 't.full_name', 't.gender', 't.main_subject_id', 's.name as subject_name']);
    }

    private function must(object $staff): object
    {
        $t = $this->teacherOf($staff);
        if (! $t) {
            throw ValidationException::withMessages(['teacher' => ['Tài khoản này chưa được liên kết với hồ sơ giáo viên.']]);
        }

        return $t;
    }

    private function year(): ?int
    {
        return DB::table('sm_school_years')->where('is_current', 1)->value('id');
    }

    /** Ảnh được phát qua API (cùng cổng /api của trang), không phụ thuộc APP_URL hay storage:link */
    private function avatarUrl(?int $teacherId, ?string $path): ?string
    {
        return ($teacherId && $path) ? "/api/gv/teacher/avatar/{$teacherId}?v=" . substr(md5($path), 0, 10) : null;
    }

    public function avatarPath(int $teacherId): ?string
    {
        return DB::table('teacher_profiles')->where('teacher_id', $teacherId)->value('avatar');
    }

    /* ---------- tổng quan ---------- */

    public function overview(object $staff): array
    {
        $teacher = $this->teacherOf($staff);
        $p = $teacher ? DB::table('teacher_profiles')->where('teacher_id', $teacher->id)->first() : null;
        $year = $this->year();

        $stats = ['teaching_classes' => 0, 'periods_per_week' => 0, 'homeroom' => [], 'qualifications' => 0];
        if ($teacher) {
            $cs = DB::table('sm_class_subjects as cs')->join('sm_classes as c', 'c.id', '=', 'cs.class_id')
                ->where('cs.teacher_id', $teacher->id)->when($year, fn ($q) => $q->where('c.school_year_id', $year));
            $stats['teaching_classes'] = (clone $cs)->distinct()->count('cs.class_id');
            $stats['periods_per_week'] = DB::table('sm_timetable as tt')->join('sm_class_subjects as cs', 'cs.id', '=', 'tt.class_subject_id')
                ->join('sm_classes as c', 'c.id', '=', 'tt.class_id')->where('cs.teacher_id', $teacher->id)
                ->when($year, fn ($q) => $q->where('c.school_year_id', $year))->count();
            $stats['homeroom'] = DB::table('sm_classes')->where('homeroom_teacher_id', $teacher->id)
                ->when($year, fn ($q) => $q->where('school_year_id', $year))->pluck('name')->all();
            $stats['qualifications'] = DB::table('teacher_qualifications')->where('teacher_id', $teacher->id)->count();
        }

        $checks = [
            'phone' => [(bool) ($p->phone ?? null), 'Số điện thoại', 'personal'],
            'avatar' => [(bool) ($p->avatar ?? null), 'Ảnh đại diện', 'personal'],
            'birth_date' => [(bool) ($p->birth_date ?? null), 'Ngày sinh', 'personal'],
            'id_number' => [(bool) ($p->id_number ?? null), 'Số CCCD', 'personal'],
            'address' => [(bool) ($p->address ?? null), 'Địa chỉ thường trú', 'personal'],
            'bio' => [(bool) ($p->bio ?? null), 'Giới thiệu bản thân', 'personal'],
            'degree_level' => [(bool) ($p->degree_level ?? null), 'Trình độ chuyên môn', 'personal'],
            'emergency' => [(bool) ($p->emergency_contact_phone ?? null), 'Liên hệ khẩn cấp', 'personal'],
            'qualification' => [$stats['qualifications'] > 0, 'Bằng cấp / chứng chỉ', 'qualifications'],
        ];
        $done = count(array_filter($checks, fn ($c) => $c[0]));

        return [
            'user' => [
                'id' => $staff->id, 'name' => $staff->full_name, 'email' => '', 'username' => $staff->username,
                'phone' => $p->phone ?? null, 'avatar' => $this->avatarUrl($teacher->id ?? null, $p->avatar ?? null), 'status' => $staff->status,
            ],
            'teacher' => $teacher,
            'profile' => $p,
            'homeroom_detail' => $teacher ? $this->homeroomDetail($teacher->id, $year) : [],
            'stats' => $stats + ['years_of_service' => ($p->career_start_year ?? null) ? max(0, (int) date('Y') - (int) $p->career_start_year) : (($p->joined_at ?? null) ? (int) Carbon::parse($p->joined_at)->diffInYears(now()) : null)],
            'completion' => [
                'percent' => (int) round($done / count($checks) * 100),
                'missing' => collect($checks)->filter(fn ($c) => ! $c[0])->map(fn ($c, $k) => ['key' => $k, 'label' => $c[1], 'tab' => $c[2]])->values(),
            ],
        ];
    }

    /** Lớp chủ nhiệm: sĩ số, nam/nữ, đơn xin nghỉ chờ duyệt */
    private function homeroomDetail(int $teacherId, ?int $year): array
    {
        return DB::table('sm_classes')->where('homeroom_teacher_id', $teacherId)
            ->when($year, fn ($q) => $q->where('school_year_id', $year))->orderBy('grade')->orderBy('name')
            ->get(['id', 'name', 'grade', 'room', 'capacity'])
            ->map(function ($c) use ($year) {
                $st = DB::table('sm_enrollments as e')->join('sm_students as st', 'st.id', '=', 'e.student_id')
                    ->where('e.class_id', $c->id)->when($year, fn ($q) => $q->where('e.school_year_id', $year));
                $total = (clone $st)->count();
                $male = (clone $st)->where('st.gender', 'Nam')->count();
                $pending = DB::table('sm_leave_requests as lv')->join('sm_enrollments as e', 'e.student_id', '=', 'lv.student_id')
                    ->where('e.class_id', $c->id)->when($year, fn ($q) => $q->where('e.school_year_id', $year))
                    ->where('lv.status', 'pending')->count();

                return [
                    'id' => $c->id, 'name' => $c->name, 'grade' => $c->grade, 'room' => $c->room, 'capacity' => $c->capacity,
                    'students' => $total, 'male' => $male, 'female' => $total - $male, 'pending_leaves' => $pending,
                ];
            })->all();
    }

    /* ---------- thông tin cá nhân ---------- */

    public function updateInfo(object $staff, array $data): array
    {
        $t = $this->must($staff);
        DB::table('teacher_profiles')->updateOrInsert(['teacher_id' => $t->id], Arr::only($data, self::PROFILE_FIELDS) + ['updated_at' => now()]);

        return $this->overview($staff);
    }

    public function updateAvatar(object $staff, UploadedFile $file): ?string
    {
        $t = $this->must($staff);
        $old = DB::table('teacher_profiles')->where('teacher_id', $t->id)->value('avatar');
        $path = $file->store('avatars', 'public');
        DB::table('teacher_profiles')->updateOrInsert(['teacher_id' => $t->id], ['avatar' => $path, 'updated_at' => now()]);
        if ($old) Storage::disk('public')->delete($old);

        return $this->avatarUrl($t->id, $path);
    }

    /* ---------- giảng dạy ---------- */

    public function teaching(object $staff): array
    {
        $teacher = $this->teacherOf($staff);
        if (! $teacher) return ['classes' => [], 'slots' => [], 'periods' => [], 'homeroom' => []];
        $year = $this->year();

        $classes = DB::table('sm_class_subjects as cs')
            ->join('sm_classes as c', 'c.id', '=', 'cs.class_id')->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')
            ->where('cs.teacher_id', $teacher->id)->when($year, fn ($q) => $q->where('c.school_year_id', $year))
            ->orderBy('c.grade')->orderBy('c.name')
            ->get(['cs.id as class_subject_id', 'c.id as class_id', 'c.name as class_name', 'c.grade', 'c.room', 'c.capacity', 's.name as subject_name']);

        $slots = DB::table('sm_timetable as tt')
            ->join('sm_class_subjects as cs', 'cs.id', '=', 'tt.class_subject_id')
            ->join('sm_classes as c', 'c.id', '=', 'tt.class_id')->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')
            ->where('cs.teacher_id', $teacher->id)->when($year, fn ($q) => $q->where('c.school_year_id', $year))
            ->orderBy('tt.weekday')->orderBy('tt.period')
            ->get(['tt.weekday', 'tt.period', 'c.name as class_name', 'c.room', 's.name as subject_name']);

        return [
            'classes' => $classes, 'slots' => $slots,
            'periods' => DB::table('sm_periods')->orderBy('id')->get(['id', 'start_time', 'end_time']),
            'homeroom' => DB::table('sm_classes')->where('homeroom_teacher_id', $teacher->id)
                ->when($year, fn ($q) => $q->where('school_year_id', $year))->get(['id', 'name', 'grade', 'room', 'capacity']),
        ];
    }

    /* ---------- bằng cấp & chứng chỉ ---------- */

    public function qualifications(object $staff)
    {
        $t = $this->teacherOf($staff);

        return $t ? DB::table('teacher_qualifications')->where('teacher_id', $t->id)->orderByDesc('issued_year')->orderByDesc('id')->get() : collect();
    }

    public function saveQualification(object $staff, array $data, ?int $id = null): object
    {
        $t = $this->must($staff);
        $row = Arr::only($data, ['type', 'title', 'organization', 'issued_year', 'expires_at', 'note']) + ['updated_at' => now()];
        if ($id) {
            abort_unless(DB::table('teacher_qualifications')->where('id', $id)->where('teacher_id', $t->id)->exists(), 404, 'Không tìm thấy bản ghi.');
            DB::table('teacher_qualifications')->where('id', $id)->where('teacher_id', $t->id)->update($row);
        } else {
            $id = DB::table('teacher_qualifications')->insertGetId($row + ['teacher_id' => $t->id, 'created_at' => now()]);
        }

        return DB::table('teacher_qualifications')->find($id);
    }

    public function deleteQualification(object $staff, int $id): void
    {
        $t = $this->must($staff);
        abort_unless(DB::table('teacher_qualifications')->where('id', $id)->where('teacher_id', $t->id)->delete(), 404, 'Không tìm thấy bản ghi.');
    }

    /* ---------- yêu cầu chỉnh sửa hồ sơ ---------- */

    public function requests(object $staff)
    {
        $t = $this->teacherOf($staff);

        return $t ? DB::table('teacher_profile_requests')->where('teacher_id', $t->id)->orderByDesc('id')->get() : collect();
    }

    public function createRequest(object $staff, array $data): object
    {
        $t = $this->must($staff);
        $field = $data['field_key'];
        abort_if(! isset(self::REQUEST_FIELDS[$field]), 422, 'Trường không được phép yêu cầu chỉnh sửa.');
        if (DB::table('teacher_profile_requests')->where('teacher_id', $t->id)->where('field_key', $field)->where('status', 'pending')->exists()) {
            throw ValidationException::withMessages(['field_key' => ['Bạn đã có yêu cầu đang chờ duyệt cho trường này.']]);
        }
        $old = match ($field) { 'full_name' => $t->full_name, 'gender' => $t->gender, 'employee_code' => $t->code };
        $id = DB::table('teacher_profile_requests')->insertGetId([
            'teacher_id' => $t->id, 'field_key' => $field, 'old_value' => $old,
            'new_value' => $data['new_value'], 'reason' => $data['reason'], 'status' => 'pending', 'created_at' => now(),
        ]);

        return DB::table('teacher_profile_requests')->find($id);
    }

    public function cancelRequest(object $staff, int $id): void
    {
        $t = $this->must($staff);
        $n = DB::table('teacher_profile_requests')->where('id', $id)->where('teacher_id', $t->id)->where('status', 'pending')->update(['status' => 'cancelled']);
        abort_unless($n, 404, 'Yêu cầu không tồn tại hoặc đã được xử lý.');
    }

    /* ---------- bảo mật ---------- */

    public function changePassword(object $staff, string $current, string $new): void
    {
        $hash = DB::table('sm_staff_accounts')->where('id', $staff->id)->value('password_hash');
        if (! Hash::check($current, $hash)) {
            throw ValidationException::withMessages(['current_password' => ['Mật khẩu hiện tại không đúng.']]);
        }
        if (Hash::check($new, $hash)) {
            throw ValidationException::withMessages(['password' => ['Mật khẩu mới phải khác mật khẩu hiện tại.']]);
        }
        DB::table('sm_staff_accounts')->where('id', $staff->id)->update(['password_hash' => Hash::make($new)]);
        $this->upsertSettings($staff->id, ['password_changed_at' => now()]);
        DB::table('sm_staff_tokens')->where('staff_id', $staff->id)->where('id', '!=', $staff->token_id)->delete(); // đăng xuất thiết bị khác
    }

    public function sessions(object $staff): array
    {
        return DB::table('sm_staff_tokens')->where('staff_id', $staff->id)->where('expires_at', '>', now())
            ->orderByDesc('id')->limit(30)->get(['id', 'created_at', 'expires_at'])
            ->map(fn ($t) => [
                'id' => $t->id, 'name' => 'Phiên đăng nhập', 'last_used_at' => null, 'created_at' => $t->created_at,
                'expires_at' => $t->expires_at, 'current' => (int) $t->id === (int) $staff->token_id,
            ])->all();
    }

    public function revokeSession(object $staff, int $id): void
    {
        abort_if((int) $staff->token_id === $id, 422, 'Không thể đăng xuất phiên hiện tại tại đây.');
        abort_unless(DB::table('sm_staff_tokens')->where('id', $id)->where('staff_id', $staff->id)->delete(), 404, 'Phiên không tồn tại.');
    }

    public function revokeOthers(object $staff): int
    {
        return DB::table('sm_staff_tokens')->where('staff_id', $staff->id)->where('id', '!=', $staff->token_id)->delete();
    }

    public function loginHistory(object $staff): array
    {
        return DB::table('sm_audit_logs')->where('actor_type', 'staff')->where('actor_id', $staff->id)
            ->where('module', 'auth')->whereIn('action', ['login', 'login_failed'])
            ->orderByDesc('id')->limit(30)->get(['id', 'status', 'ip', 'user_agent', 'occurred_at'])
            ->map(fn ($r) => [
                'id' => $r->id, 'status' => $r->status, 'ip_address' => $r->ip, 'device' => null,
                'browser' => $this->browser((string) $r->user_agent), 'platform' => $this->platform((string) $r->user_agent), 'created_at' => $r->occurred_at,
            ])->all();
    }

    private function browser(string $ua): ?string
    {
        foreach (['Edg' => 'Edge', 'OPR' => 'Opera', 'Chrome' => 'Chrome', 'Firefox' => 'Firefox', 'Safari' => 'Safari'] as $k => $v) {
            if (stripos($ua, $k) !== false) return $v;
        }

        return $ua ? 'Trình duyệt khác' : null;
    }

    private function platform(string $ua): ?string
    {
        foreach (['Windows' => 'Windows', 'Android' => 'Android', 'iPhone' => 'iPhone', 'iPad' => 'iPad', 'Mac OS' => 'macOS', 'Linux' => 'Linux'] as $k => $v) {
            if (stripos($ua, $k) !== false) return $v;
        }

        return null;
    }

    /* ---------- cài đặt ---------- */

    private function upsertSettings(int $staffId, array $data): void
    {
        DB::table('teacher_settings')->updateOrInsert(['staff_id' => $staffId], $data + ['updated_at' => now()]);
    }

    public function settings(object $staff): array
    {
        $s = DB::table('teacher_settings')->where('staff_id', $staff->id)->first();
        $prefs = $s && $s->notification_prefs ? (json_decode($s->notification_prefs, true) ?: []) : [];

        return [
            'theme' => $s->theme ?? 'light', 'language' => $s->language ?? 'vi', 'timezone' => $s->timezone ?? 'Asia/Ho_Chi_Minh',
            'date_format' => $s->date_format ?? 'DD/MM/YYYY', 'density' => $s->density ?? 'comfortable',
            'notification_prefs' => array_merge(self::DEFAULT_PREFS, Arr::only($prefs, array_keys(self::DEFAULT_PREFS))),
            'password_changed_at' => $s->password_changed_at ?? null,
        ];
    }

    public function updateSettings(object $staff, array $data): array
    {
        $row = Arr::only($data, ['theme', 'language', 'timezone', 'date_format', 'density']);
        if (isset($data['notification_prefs'])) {
            $row['notification_prefs'] = json_encode(array_merge(self::DEFAULT_PREFS, Arr::only($data['notification_prefs'], array_keys(self::DEFAULT_PREFS))));
        }
        $this->upsertSettings($staff->id, $row);

        return $this->settings($staff);
    }

    /* ---------- nhật ký (lấy từ sm_audit_logs do hệ thống tự ghi) ---------- */

    public function activity(object $staff, int $perPage = 20): array
    {
        $p = DB::table('sm_audit_logs')->where('actor_type', 'staff')->where('actor_id', $staff->id)->orderByDesc('id')
            ->paginate($perPage, ['id', 'module', 'summary', 'ip', 'occurred_at']);

        return [
            'data' => collect($p->items())->map(fn ($r) => [
                'id' => $r->id, 'action' => $r->module, 'description' => $r->summary, 'ip_address' => $r->ip, 'created_at' => $r->occurred_at,
            ])->all(),
            'current_page' => $p->currentPage(), 'last_page' => $p->lastPage(), 'total' => $p->total(),
        ];
    }
}
