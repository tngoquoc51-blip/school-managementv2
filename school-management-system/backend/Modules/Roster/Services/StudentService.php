<?php

namespace Modules\Roster\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Modules\Catalog\Exceptions\CatalogException;
use Modules\Catalog\Services\AuditService;
use Modules\Roster\Support\Pii;

class StudentService
{
    /** Cột hồ sơ không mã hóa được phép chỉnh sửa. */
    public const PROFILE_PLAIN = ['ethnicity', 'religion', 'birth_place', 'hometown', 'father_name', 'father_job', 'mother_name', 'mother_job',
        'guardian_name', 'guardian_relation', 'emergency_name', 'emergency_relation', 'blood_type', 'height_cm', 'weight_kg', 'youth_union'];

    public function __construct(private AuditService $audit, private RosterSupport $support) {}

    // ───────────── Danh sách ─────────────

    private function listQuery(int $yearId, array $f)
    {
        $q = DB::table('sm_students as s')
            ->leftJoin('sm_enrollments as e', fn ($j) => $j->on('e.student_id', '=', 's.id')->where('e.school_year_id', $yearId))
            ->leftJoin('sm_classes as c', 'c.id', '=', 'e.class_id')
            ->leftJoin('sm_accounts as a', 'a.student_id', '=', 's.id')
            ->selectRaw("s.id, s.code, s.full_name, s.gender, s.birth_date, s.admission_year, c.id as class_id, c.name as class_name, c.grade,
                a.id as account_id, a.username,
                CASE WHEN a.id IS NULL THEN NULL WHEN a.locked_until IS NOT NULL AND a.locked_until > NOW() THEN 'locked' ELSE a.status END as account_status");

        if (! empty($f['search'])) {
            $like = '%' . addcslashes(trim((string) $f['search']), '%_\\') . '%';
            $q->where(fn ($w) => $w->where('s.full_name', 'like', $like)->orWhere('s.code', 'like', $like)->orWhere('a.username', 'like', $like));
        }
        if (! empty($f['class_id'])) {
            $q->where('e.class_id', (int) $f['class_id']);
        }
        if (! empty($f['grade'])) {
            $q->where('c.grade', (int) $f['grade']);
        }
        if (! empty($f['gender'])) {
            $q->where('s.gender', $f['gender']);
        }
        if (! empty($f['admission_year'])) {
            $q->where('s.admission_year', (int) $f['admission_year']);
        }
        $p = $f['placement'] ?? '';
        if ($p === 'placed') $q->whereNotNull('e.id');
        if ($p === 'unplaced') $q->whereNull('e.id');
        $acc = $f['account'] ?? '';
        if ($acc === 'none') $q->whereNull('a.id');
        elseif ($acc === 'locked') $q->whereNotNull('a.id')->where(fn ($w) => $w->where('a.status', '!=', 'active')->orWhere('a.locked_until', '>', now()));
        elseif ($acc === 'active') $q->where('a.status', 'active')->where(fn ($w) => $w->whereNull('a.locked_until')->orWhere('a.locked_until', '<=', now()));

        return $q;
    }

    public function paginate(int $yearId, array $f, int $perPage): LengthAwarePaginator
    {
        $sorts = ['code' => 's.code', 'full_name' => 's.full_name', 'birth_date' => 's.birth_date', 'class_name' => 'c.name', 'admission_year' => 's.admission_year'];
        $col = $sorts[$f['sort'] ?? ''] ?? 's.code';
        $dir = ($f['dir'] ?? 'asc') === 'desc' ? 'desc' : 'asc';

        $page = $this->listQuery($yearId, $f)->orderBy($col, $dir)->orderBy('s.id')->paginate($perPage);
        $page->setCollection($page->getCollection()->map(fn ($r) => $this->row($r)));

        return $page;
    }

    public function export(int $yearId, array $f): array
    {
        return $this->listQuery($yearId, $f)->orderBy('c.name')->orderBy('s.full_name')->limit(10000)->get()->map(fn ($r) => $this->row($r))->all();
    }

    private function row(object $r): array
    {
        return [
            'id' => (int) $r->id, 'code' => $r->code, 'full_name' => $r->full_name, 'gender' => $r->gender, 'birth_date' => $r->birth_date,
            'admission_year' => (int) $r->admission_year, 'class_id' => $r->class_id ? (int) $r->class_id : null, 'class_name' => $r->class_name,
            'grade' => $r->grade ? (int) $r->grade : null, 'account_id' => $r->account_id ? (int) $r->account_id : null,
            'username' => $r->username, 'account_status' => $r->account_status,
        ];
    }

    // ───────────── Chi tiết ─────────────

    private function find(int $id): object
    {
        $s = DB::table('sm_students')->where('id', $id)->first();
        if (! $s) {
            throw new CatalogException('Không tìm thấy học sinh.', 404);
        }

        return $s;
    }

    public function show(int $id, int $yearId, bool $reveal = false): array
    {
        $s = $this->find($id);

        $enroll = DB::table('sm_enrollments as e')->join('sm_classes as c', 'c.id', '=', 'e.class_id')->join('sm_school_years as y', 'y.id', '=', 'e.school_year_id')
            ->where('e.student_id', $id)->orderByDesc('y.start_date')
            ->get(['e.school_year_id', 'y.label as year_label', 'c.id as class_id', 'c.name as class_name', 'c.grade'])->map(fn ($r) => (array) $r)->all();
        $current = collect($enroll)->firstWhere('school_year_id', $yearId);

        $account = DB::table('sm_accounts')->where('student_id', $id)->first();
        $acc = null;
        if ($account) {
            $locked = $account->locked_until && strtotime((string) $account->locked_until) > time();
            $acc = ['id' => (int) $account->id, 'username' => $account->username, 'email' => $account->email, 'status' => $locked ? 'locked' : $account->status,
                'last_login_at' => $account->last_login_at, 'must_change_password' => (bool) $account->must_change_password,
                'password_changed_at' => $account->password_changed_at, 'failed_attempts' => (int) $account->failed_attempts];
        }

        $grades = DB::table('sm_grades as g')->join('sm_subjects as sub', 'sub.id', '=', 'g.subject_id')->where('g.student_id', $id)->where('g.school_year_id', $yearId)
            ->orderBy('sub.sort_order')->get(['sub.name as subject', 'g.semester', 'g.tbm', 'g.assessment']);
        $bySubject = [];
        foreach ($grades as $g) {
            $bySubject[$g->subject]['subject'] = $g->subject;
            $bySubject[$g->subject]['hk' . $g->semester] = $g->tbm !== null ? (float) $g->tbm : $g->assessment;
        }
        $avg = fn (int $sem) => ($v = $grades->where('semester', $sem)->whereNotNull('tbm')->pluck('tbm')) && $v->count() ? round($v->avg(), 2) : null;

        $conduct = DB::table('sm_conduct as c')->join('sm_school_years as y', 'y.id', '=', 'c.school_year_id')->where('c.student_id', $id)->orderByDesc('y.start_date')
            ->get(['y.label as year_label', 'c.hk1', 'c.hk2', 'c.year_result'])->map(fn ($r) => (array) $r)->all();

        $inv = DB::table('sm_invoices')->where('student_id', $id)->where('status', '!=', 'cancelled')->selectRaw('COUNT(*) n, COALESCE(SUM(total),0) t')->first();

        $profile = DB::table('sm_student_profiles')->where('student_id', $id)->first();

        return [
            'student' => ['id' => (int) $s->id, 'code' => $s->code, 'full_name' => $s->full_name, 'gender' => $s->gender, 'birth_date' => $s->birth_date,
                'admission_year' => (int) $s->admission_year, 'created_at' => $s->created_at],
            'current_class' => $current, 'enrollments' => $enroll, 'account' => $acc,
            'profile' => $this->profile($profile, $reveal),
            'grades' => ['rows' => array_values($bySubject), 'avg_hk1' => $avg(1), 'avg_hk2' => $avg(2)],
            'conduct' => $conduct,
            'invoices' => ['count' => (int) $inv->n, 'total' => (int) $inv->t],
            'revealed' => $reveal,
        ];
    }

    private function profile(?object $p, bool $reveal): array
    {
        if (! $p) {
            return ['exists' => false];
        }
        $out = ['exists' => true];
        foreach (self::PROFILE_PLAIN as $c) {
            $out[$c] = $p->$c ?? null;
        }
        $out['youth_union_date'] = $p->youth_union_date;
        $out['updated_at'] = $p->updated_at;
        foreach (Pii::COLUMNS as $c) {
            $plain = Pii::decrypt($p->$c ?? null);
            $out[$c] = $reveal ? $plain : (in_array($c, Pii::PHONES, true) ? Pii::maskPhone($plain) : ($plain ? '••••••••' : null));
        }

        return $out;
    }

    /** Ghi nhật ký khi quản trị viên xem dữ liệu cá nhân nhạy cảm. */
    public function auditReveal(int $id): void
    {
        $s = $this->find($id);
        $this->audit->record('student', $id, "{$s->full_name} ({$s->code})", 'view_pii', null, ['note' => 'Xem số điện thoại, địa chỉ, sức khỏe']);
    }

    // ───────────── Tạo / sửa / xóa ─────────────

    private function nextCode(int $admissionYear): string
    {
        $prefix = 'HS' . substr((string) $admissionYear, -2);
        $max = DB::table('sm_students')->where('code', 'like', $prefix . '%')->selectRaw('MAX(CAST(SUBSTRING(code, ?) AS UNSIGNED)) m', [strlen($prefix) + 1])->value('m');

        return $prefix . str_pad((string) (((int) $max) + 1), 4, '0', STR_PAD_LEFT);
    }

    public function tempPassword(): string
    {
        return Str::upper(Str::random(2)) . Str::lower(Str::random(5)) . random_int(100, 999) . '@';
    }

    public function create(array $d): array
    {
        $year = $this->support->resolveYear($d['school_year_id'] ?? null);
        $code = strtoupper(trim($d['code'] ?? '')) ?: $this->nextCode((int) $d['admission_year']);
        if (DB::table('sm_students')->where('code', $code)->exists()) {
            throw new CatalogException("Mã học sinh $code đã tồn tại.", 422, ['code' => ['Mã đã tồn tại.']]);
        }
        $classId = $d['class_id'] ?? null;
        if ($classId && ! DB::table('sm_classes')->where('id', $classId)->where('school_year_id', $year)->exists()) {
            throw new CatalogException('Lớp được chọn không thuộc năm học đang xem.', 422);
        }

        $temp = null;
        $id = DB::transaction(function () use ($d, $code, $year, $classId, &$temp) {
            $id = DB::table('sm_students')->insertGetId(['code' => $code, 'full_name' => trim($d['full_name']), 'gender' => $d['gender'], 'birth_date' => $d['birth_date'],
                'admission_year' => $d['admission_year'], 'created_at' => now()]);
            if ($classId) {
                DB::table('sm_enrollments')->insert(['student_id' => $id, 'school_year_id' => $year, 'class_id' => $classId]);
            }
            if ($d['create_account'] ?? true) {
                $temp = $this->tempPassword();
                $username = strtolower($code);
                $email = "$username@thpt.edu.vn";
                if (DB::table('sm_accounts')->where('email', $email)->orWhere('username', $username)->exists()) {
                    throw new CatalogException('Tên đăng nhập hoặc email của tài khoản đã tồn tại.', 409);
                }
                DB::table('sm_accounts')->insert(['student_id' => $id, 'username' => $username, 'email' => $email, 'password_hash' => Hash::make($temp),
                    'must_change_password' => 1, 'status' => 'active', 'failed_attempts' => 0]);
            }

            return $id;
        });

        $this->audit->record('student', $id, "{$d['full_name']} ($code)", 'create', null, ['code' => $code, 'full_name' => $d['full_name'], 'gender' => $d['gender'], 'birth_date' => $d['birth_date'], 'class_id' => $classId]);

        return ['id' => $id, 'code' => $code, 'temporary_password' => $temp, 'username' => $temp ? strtolower($code) : null];
    }

    public function update(int $id, array $d): void
    {
        $s = $this->find($id);
        $before = $after = [];

        $basic = array_intersect_key($d, array_flip(['full_name', 'gender', 'birth_date', 'admission_year']));
        foreach ($basic as $k => $v) {
            if ((string) $s->$k !== (string) $v) {
                $before[$k] = $s->$k;
                $after[$k] = $v;
            }
        }

        $profile = DB::table('sm_student_profiles')->where('student_id', $id)->first();
        $pdata = [];
        foreach (self::PROFILE_PLAIN as $c) {
            if (array_key_exists($c, $d['profile'] ?? [])) {
                $v = $d['profile'][$c];
                $v = ($v === '' ? null : $v);
                if (($profile->$c ?? null) != $v) {
                    $before[$c] = $profile->$c ?? null;
                    $after[$c] = $v;
                }
                $pdata[$c] = $v;
            }
        }
        $changedPii = [];
        foreach (Pii::COLUMNS as $c) {
            if (array_key_exists($c, $d['pii'] ?? []) && $d['pii'][$c] !== null) {
                $pdata[$c] = Pii::encrypt($d['pii'][$c]);
                $changedPii[] = $c;
            }
        }
        if ($changedPii) {
            $after['pii_fields'] = $changedPii;
        }
        if (! $before && ! $after) {
            return;
        }

        DB::transaction(function () use ($id, $basic, $pdata, $profile) {
            if ($basic) {
                DB::table('sm_students')->where('id', $id)->update($basic);
            }
            if ($pdata) {
                if ($profile) {
                    DB::table('sm_student_profiles')->where('student_id', $id)->update($pdata + ['updated_at' => now()]);
                } else {
                    DB::table('sm_student_profiles')->insert($pdata + ['student_id' => $id, 'updated_at' => now()]);
                }
            }
        });
        $this->audit->record('student', $id, ($d['full_name'] ?? $s->full_name) . " ({$s->code})", 'update', $before ?: null, $after);
    }

    public function delete(int $id): void
    {
        $s = $this->find($id);
        $uses = [
            'bản ghi điểm' => DB::table('sm_grades')->where('student_id', $id)->count(),
            'hóa đơn' => DB::table('sm_invoices')->where('student_id', $id)->count(),
        ];
        $used = array_filter($uses);
        if ($used) {
            $txt = implode(', ', array_map(fn ($k, $v) => "$v $k", array_keys($used), $used));
            throw new CatalogException("Không thể xóa học sinh {$s->full_name} vì đã có $txt. Hãy khóa tài khoản thay vì xóa.", 409);
        }
        try {
            DB::transaction(function () use ($id) {
                $accIds = DB::table('sm_accounts')->where('student_id', $id)->pluck('id');
                DB::table('sm_api_tokens')->whereIn('account_id', $accIds)->delete();
                DB::table('sm_accounts')->where('student_id', $id)->delete();
                DB::table('sm_student_profiles')->where('student_id', $id)->delete();
                DB::table('sm_conduct')->where('student_id', $id)->delete();
                DB::table('sm_enrollments')->where('student_id', $id)->delete();
                DB::table('sm_students')->where('id', $id)->delete();
            });
        } catch (QueryException) {
            throw new CatalogException('Học sinh còn dữ liệu liên quan ở phân hệ khác nên chưa thể xóa.', 409);
        }
        $this->audit->record('student', $id, "{$s->full_name} ({$s->code})", 'remove', ['code' => $s->code, 'full_name' => $s->full_name, 'gender' => $s->gender, 'birth_date' => $s->birth_date], null);
    }

    // ───────────── Xếp lớp ─────────────

    /** Xếp / chuyển một học sinh vào lớp. */
    public function enroll(int $studentId, int $classId, int $yearId, bool $audit = true): string
    {
        $s = $this->find($studentId);
        $class = DB::table('sm_classes')->where('id', $classId)->first();
        if (! $class || (int) $class->school_year_id !== $yearId) {
            throw new CatalogException('Lớp được chọn không thuộc năm học đang xem.', 422);
        }
        $cur = DB::table('sm_enrollments')->where('student_id', $studentId)->where('school_year_id', $yearId)->first();

        if ($cur && (int) $cur->class_id === $classId) {
            return 'same';
        }
        DB::transaction(function () use ($cur, $studentId, $yearId, $classId) {
            if ($cur) {
                DB::table('sm_enrollments')->where('id', $cur->id)->update(['class_id' => $classId]);
                DB::table('sm_grades')->where('student_id', $studentId)->where('school_year_id', $yearId)->update(['class_id' => $classId]);
            } else {
                DB::table('sm_enrollments')->insert(['student_id' => $studentId, 'school_year_id' => $yearId, 'class_id' => $classId]);
            }
        });
        if ($audit) {
            $from = $cur ? DB::table('sm_classes')->where('id', $cur->class_id)->value('name') : null;
            $this->audit->record('student', $studentId, "{$s->full_name} ({$s->code})", $cur ? 'transfer' : 'enroll', $from ? ['class' => $from] : null, ['class' => $class->name]);
        }

        return $cur ? 'transferred' : 'enrolled';
    }

    public function bulkEnroll(array $studentIds, int $classId, int $yearId): array
    {
        $done = 0; $same = 0; $skipped = [];
        foreach (array_unique($studentIds) as $sid) {
            try {
                $r = $this->enroll((int) $sid, $classId, $yearId);
                $r === 'same' ? $same++ : $done++;
            } catch (CatalogException $e) {
                $skipped[] = ['id' => (int) $sid, 'reason' => $e->getMessage()];
            }
        }
        $size = DB::table('sm_enrollments')->where('class_id', $classId)->count();

        return ['processed' => $done, 'unchanged' => $same, 'skipped' => $skipped, 'class_size' => $size, 'over_capacity' => $size > RosterSupport::CLASS_MAX];
    }

    public function unenroll(int $studentId, int $yearId): void
    {
        $s = $this->find($studentId);
        $cur = DB::table('sm_enrollments as e')->join('sm_classes as c', 'c.id', '=', 'e.class_id')->where('e.student_id', $studentId)->where('e.school_year_id', $yearId)->first(['e.id', 'c.name']);
        if (! $cur) {
            throw new CatalogException('Học sinh chưa được xếp lớp trong năm học này.', 404);
        }
        $grades = DB::table('sm_grades')->where('student_id', $studentId)->where('school_year_id', $yearId)->count();
        if ($grades) {
            throw new CatalogException("Học sinh đã có $grades bản ghi điểm trong năm học này nên không thể gỡ khỏi lớp. Hãy dùng chức năng chuyển lớp.", 409);
        }
        DB::table('sm_enrollments')->where('id', $cur->id)->delete();
        $this->audit->record('student', $studentId, "{$s->full_name} ({$s->code})", 'unenroll', ['class' => $cur->name], null);
    }

    /** Xếp lớp tự động: chia đều học sinh chưa có lớp vào các lớp của một khối, cân bằng sĩ số và giới tính. */
    public function autoAssign(int $yearId, int $grade, ?array $studentIds = null): array
    {
        $classes = DB::table('sm_classes as c')->where('c.school_year_id', $yearId)->where('c.grade', $grade)
            ->selectRaw('c.id, c.name, (SELECT COUNT(*) FROM sm_enrollments e WHERE e.class_id = c.id) n')->get()->map(fn ($c) => ['id' => (int) $c->id, 'name' => $c->name, 'n' => (int) $c->n, 'added' => 0])->all();
        if (! $classes) {
            throw new CatalogException("Chưa có lớp nào thuộc khối $grade trong năm học này.", 422);
        }
        $q = DB::table('sm_students as s')->whereNotExists(fn ($w) => $w->select(DB::raw(1))->from('sm_enrollments as e')->whereColumn('e.student_id', 's.id')->where('e.school_year_id', $yearId));
        if ($studentIds) {
            $q->whereIn('s.id', $studentIds);
        }
        $students = $q->orderBy('s.gender')->orderBy('s.full_name')->get(['s.id', 's.code', 's.full_name']);
        if ($students->isEmpty()) {
            throw new CatalogException('Không có học sinh nào chưa xếp lớp.', 422);
        }

        DB::transaction(function () use (&$classes, $students, $yearId) {
            foreach ($students as $st) {
                usort($classes, fn ($a, $b) => ($a['n'] <=> $b['n']) ?: ($a['id'] <=> $b['id']));
                DB::table('sm_enrollments')->insert(['student_id' => $st->id, 'school_year_id' => $yearId, 'class_id' => $classes[0]['id']]);
                $classes[0]['n']++;
                $classes[0]['added']++;
            }
        });
        usort($classes, fn ($a, $b) => strcmp($a['name'], $b['name']));
        $this->audit->record('student', 0, "Xếp lớp tự động khối $grade", 'auto_assign', null, ['grade' => $grade, 'students' => $students->count(), 'classes' => count($classes)]);

        return ['assigned' => $students->count(), 'classes' => $classes];
    }
}
