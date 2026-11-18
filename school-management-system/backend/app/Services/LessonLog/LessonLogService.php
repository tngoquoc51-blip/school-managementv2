<?php

namespace App\Services\LessonLog;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

/**
 * Sổ đầu bài: ghi tiết dạy, chuyên cần từng tiết, ký sổ, mở lại, xác nhận theo tuần của GVCN, thống kê.
 * $a = ['id' => int (sm_staff_accounts.id), 'name' => string, 'role' => string] – người thao tác.
 */
class LessonLogService
{
    private function t(string $k): string
    {
        return (string) config("lesson_log.tables.$k");
    }

    private function bad(string $f, string $m): ValidationException
    {
        return ValidationException::withMessages([$f => [$m]]);
    }

    private function today(): string
    {
        return Carbon::today()->toDateString();
    }

    /* ===================== vai trò & quyền ===================== */

    public function role(array $a): string
    {
        return strtolower((string) ($a['role'] ?? ''));
    }

    public function isAdmin(array $a): bool
    {
        return in_array($this->role($a), (array) config('lesson_log.admin_roles'), true);
    }

    public function allowed(array $a): bool
    {
        return $this->isAdmin($a) || in_array($this->role($a), (array) config('lesson_log.allowed_roles'), true);
    }

    private function hrCol(): ?string
    {
        $c = config('lesson_log.homeroom_column');
        return $c && Schema::hasColumn($this->t('classes'), $c) ? $c : null;
    }

    public function homeroomClassIds(array $a): array
    {
        $c = $this->hrCol();
        if (! $c || empty($a['id'])) {
            return [];
        }
        return DB::table($this->t('classes'))->where($c, $a['id'])->pluck('id')->map(fn ($x) => (int) $x)->all();
    }

    public function canConfirm(array $a, int $classId): bool
    {
        if ($this->isAdmin($a)) {
            return true;
        }
        if ($this->hrCol()) {
            return in_array($classId, $this->homeroomClassIds($a), true);
        }
        return ! config('lesson_log.strict_homeroom') && $this->role($a) === 'homeroom_teacher';
    }

    private function weekStart(string $date): Carbon
    {
        return Carbon::parse($date)->startOfWeek(Carbon::MONDAY);
    }

    private function weekLocked(int $classId, string $date): bool
    {
        return DB::table('sm_lesson_log_weeks')->where('class_id', $classId)
            ->where('week_start', $this->weekStart($date)->toDateString())->where('status', 'confirmed')->exists();
    }

    private function perms(object $l, array $a): array
    {
        $admin = $this->isAdmin($a);
        $mine = (int) $l->teacher_id === (int) $a['id'];
        $within = $l->lesson_date >= Carbon::today()->subDays((int) config('lesson_log.edit_days', 7))->toDateString();
        $locked = $this->weekLocked((int) $l->class_id, $l->lesson_date);
        $edit = $l->status === 'draft' && ! $locked && (($mine && $within) || $admin);
        $confirm = $this->canConfirm($a, (int) $l->class_id);

        return [
            'can_edit' => $edit, 'can_sign' => $edit,
            'can_unsign' => $l->status === 'signed' && ! $locked && (($mine && $within) || $admin),
            'can_reopen' => $l->status === 'signed' && $confirm,
            'can_delete' => $l->status === 'draft' && ($mine || $admin),
            'can_note' => $confirm, 'week_locked' => $locked, 'mine' => $mine,
        ];
    }

    private function event(int $logId, string $type, string $message, array $a): void
    {
        DB::table('sm_lesson_log_events')->insert([
            'log_id' => $logId, 'type' => $type, 'message' => $message,
            'actor_id' => $a['id'] ?? null, 'actor_name' => $a['name'] ?? 'Hệ thống', 'created_at' => now(),
        ]);
    }

    /* ===================== dữ liệu nền ===================== */

    private function year(): ?object
    {
        return Schema::hasTable($this->t('years')) ? DB::table($this->t('years'))->where('is_current', 1)->first() : null;
    }

    public function classes(): array
    {
        $y = $this->year();
        $q = DB::table($this->t('classes') . ' as c')->join($this->t('enrollments') . ' as e', 'e.class_id', '=', 'c.id');
        if ($y) {
            $q->where('e.school_year_id', $y->id);
        }
        return $q->groupBy('c.id', 'c.name')->orderBy('c.name')->get(['c.id', 'c.name'])
            ->map(fn ($r) => ['id' => (int) $r->id, 'name' => $r->name])->all();
    }

    public function roster(int $classId): array
    {
        $y = $this->year();
        $q = DB::table($this->t('students') . ' as s')->join($this->t('enrollments') . ' as e', 'e.student_id', '=', 's.id')->where('e.class_id', $classId);
        if ($y) {
            $q->where('e.school_year_id', $y->id);
        }
        return $q->orderBy('s.full_name')->get(['s.id', 's.code', 's.full_name'])
            ->map(fn ($r) => ['id' => (int) $r->id, 'code' => $r->code, 'name' => $r->full_name])->all();
    }

    public function meta(array $a): array
    {
        $y = $this->year();
        $subjects = (array) config('lesson_log.subjects');
        $st = (array) config('lesson_log.subject_table');
        if (! empty($st['table']) && Schema::hasTable($st['table']) && Schema::hasColumn($st['table'], $st['name'])) {
            $subjects = array_values(array_unique(array_merge(DB::table($st['table'])->orderBy($st['name'])->pluck($st['name'])->all(), $subjects)));
        }
        $periods = [];
        foreach ((array) config('lesson_log.periods') as $n => $p) {
            if ($n <= (int) config('lesson_log.max_period', 10)) {
                $periods[] = ['n' => (int) $n, 'start' => $p[0], 'end' => $p[1], 'session' => $n <= (int) config('lesson_log.morning_until', 5) ? 'morning' : 'afternoon'];
            }
        }
        $teachers = DB::table('sm_lesson_logs')->whereNotNull('teacher_id')->distinct()->orderBy('teacher_name')->get(['teacher_id', 'teacher_name'])
            ->map(fn ($t) => ['id' => (int) $t->teacher_id, 'name' => $t->teacher_name])->all();

        return [
            'classes' => $this->classes(), 'subjects' => $subjects, 'periods' => $periods, 'teachers' => $teachers,
            'ratings' => config('lesson_log.ratings'), 'absence_types' => config('lesson_log.absence_types'),
            'me' => ['id' => (int) $a['id'], 'name' => $a['name'], 'role' => $this->role($a), 'is_admin' => $this->isAdmin($a), 'homeroom_class_ids' => $this->homeroomClassIds($a)],
            'year' => $y ? ['id' => (int) $y->id, 'label' => $y->label ?? $y->name ?? null] : null,
            'edit_days' => (int) config('lesson_log.edit_days', 7), 'links' => config('lesson_log.links'), 'today' => $this->today(),
        ];
    }

    /* ===================== lưới tuần ===================== */

    private function cell(object $r, array $a): array
    {
        return [
            'id' => (int) $r->id, 'period' => (int) $r->period, 'lesson_date' => $r->lesson_date, 'subject_name' => $r->subject_name,
            'title' => $r->title, 'teacher_id' => $r->teacher_id ? (int) $r->teacher_id : null, 'teacher_name' => $r->teacher_name,
            'status' => $r->status, 'rating' => $r->rating, 'absent' => (int) $r->absent_excused + (int) $r->absent_unexcused,
            'late' => (int) $r->late_count, 'mine' => (int) $r->teacher_id === (int) $a['id'],
        ];
    }

    public function week(int $classId, string $date, array $a): array
    {
        $mon = $this->weekStart($date);
        $end = $mon->copy()->addDays(5);
        $rows = DB::table('sm_lesson_logs')->where('class_id', $classId)->whereBetween('lesson_date', [$mon->toDateString(), $end->toDateString()])->get();

        $cells = [];
        $sum = ['entries' => 0, 'signed' => 0, 'confirmed' => 0, 'drafts' => 0, 'absent' => 0, 'late' => 0];
        foreach ($rows as $r) {
            $cells[$r->lesson_date][(int) $r->period] = $this->cell($r, $a);
            $sum['entries']++;
            $r->status === 'draft' ? $sum['drafts']++ : $sum['signed']++;
            if ($r->status === 'confirmed') {
                $sum['confirmed']++;
            }
            $sum['absent'] += (int) $r->absent_excused + (int) $r->absent_unexcused;
            $sum['late'] += (int) $r->late_count;
        }
        $names = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
        $days = [];
        for ($i = 0; $i < 6; $i++) {
            $d = $mon->copy()->addDays($i)->toDateString();
            $days[] = ['date' => $d, 'label' => $names[$i], 'is_today' => $d === $this->today()];
        }
        $w = DB::table('sm_lesson_log_weeks')->where('class_id', $classId)->where('week_start', $mon->toDateString())->first();

        return [
            'class' => ['id' => $classId, 'name' => DB::table($this->t('classes'))->where('id', $classId)->value('name')],
            'week_start' => $mon->toDateString(), 'week_end' => $end->toDateString(), 'days' => $days, 'cells' => $cells,
            'week' => $w ? ['status' => $w->status, 'confirmed_name' => $w->confirmed_name, 'confirmed_at' => $w->confirmed_at, 'note' => $w->note] : ['status' => 'open'],
            'summary' => $sum, 'can_confirm' => $this->canConfirm($a, $classId),
        ];
    }

    /* ===================== danh sách / chi tiết ===================== */

    private function filtered(array $f, array $a)
    {
        $q = DB::table('sm_lesson_logs as l');
        foreach (['class_id', 'teacher_id', 'status', 'rating'] as $k) {
            if (! empty($f[$k])) {
                $q->where('l.' . $k, $f[$k]);
            }
        }
        if (! empty($f['mine'])) {
            $q->where('l.teacher_id', $a['id']);
        }
        if (! empty($f['subject'])) {
            $q->where('l.subject_name', $f['subject']);
        }
        if (! empty($f['from'])) {
            $q->where('l.lesson_date', '>=', $f['from']);
        }
        if (! empty($f['to'])) {
            $q->where('l.lesson_date', '<=', $f['to']);
        }
        if (! empty($f['q'])) {
            $k = '%' . $f['q'] . '%';
            $q->where(fn ($w) => $w->where('l.title', 'like', $k)->orWhere('l.subject_name', 'like', $k)->orWhere('l.teacher_name', 'like', $k)->orWhere('l.class_name', 'like', $k)->orWhere('l.content', 'like', $k));
        }
        return $q;
    }

    private function row(object $r): array
    {
        $x = (array) $r;
        foreach (['id', 'class_id', 'period', 'total_students', 'absent_excused', 'absent_unexcused', 'late_count'] as $k) {
            $x[$k] = (int) $x[$k];
        }
        $x['absent'] = $x['absent_excused'] + $x['absent_unexcused'];
        return $x;
    }

    public function list(array $f, array $a): array
    {
        $per = ! empty($f['all']) ? 5000 : min(max((int) ($f['per_page'] ?? 15), 5), 100);
        $page = ! empty($f['all']) ? 1 : max(1, (int) ($f['page'] ?? 1));
        $q = $this->filtered($f, $a);
        $total = (clone $q)->count();
        $rows = $q->orderByDesc('l.lesson_date')->orderByDesc('l.period')->forPage($page, $per)->get(['l.*'])->map(fn ($r) => $this->row($r))->all();

        return ['rows' => $rows, 'meta' => ['current_page' => $page, 'last_page' => max(1, (int) ceil($total / $per)), 'per_page' => $per, 'total' => $total]];
    }

    public function show(int $id, array $a): ?array
    {
        $l = DB::table('sm_lesson_logs')->where('id', $id)->first();
        if (! $l) {
            return null;
        }
        return [
            'log' => $this->row($l),
            'absences' => DB::table('sm_lesson_log_absences')->where('log_id', $id)->orderBy('type')->orderBy('student_name')->get()->map(fn ($r) => (array) $r)->all(),
            'events' => DB::table('sm_lesson_log_events')->where('log_id', $id)->orderByDesc('id')->limit(60)->get()->map(fn ($r) => (array) $r)->all(),
            'perms' => $this->perms($l, $a),
        ];
    }

    /* ===================== ghi sổ ===================== */

    private function absences(int $classId, array $items): array
    {
        $roster = [];
        foreach ($this->roster($classId) as $s) {
            $roster[$s['id']] = $s;
        }
        $out = [];
        foreach ($items as $it) {
            $sid = (int) ($it['student_id'] ?? 0);
            $type = (string) ($it['type'] ?? '');
            if (! isset($roster[$sid])) {
                throw $this->bad('absences', 'Có học sinh không thuộc lớp này.');
            }
            if (! array_key_exists($type, (array) config('lesson_log.absence_types'))) {
                throw $this->bad('absences', 'Loại vắng không hợp lệ.');
            }
            $out[$sid] = ['student_id' => $sid, 'student_name' => $roster[$sid]['name'], 'student_code' => $roster[$sid]['code'], 'type' => $type, 'reason' => isset($it['reason']) ? mb_substr(trim((string) $it['reason']), 0, 255) : null];
        }
        return array_values($out);
    }

    private function counts(array $abs): array
    {
        $c = ['excused' => 0, 'unexcused' => 0, 'late' => 0];
        foreach ($abs as $x) {
            $c[$x['type']]++;
        }
        return ['absent_excused' => $c['excused'], 'absent_unexcused' => $c['unexcused'], 'late_count' => $c['late']];
    }

    private function saveAbsences(int $logId, array $abs): void
    {
        DB::table('sm_lesson_log_absences')->where('log_id', $logId)->delete();
        foreach ($abs as $x) {
            DB::table('sm_lesson_log_absences')->insert($x + ['log_id' => $logId, 'created_at' => now(), 'updated_at' => now()]);
        }
    }

    public function store(array $d, array $a): int
    {
        $classId = (int) $d['class_id'];
        $date = $d['lesson_date'];
        $period = (int) $d['period'];
        if ($period < 1 || $period > (int) config('lesson_log.max_period', 10)) {
            throw $this->bad('period', 'Tiết học không hợp lệ.');
        }
        if ($date > $this->today()) {
            throw $this->bad('lesson_date', 'Không ghi sổ cho ngày chưa đến.');
        }
        if (! $this->isAdmin($a) && $date < Carbon::today()->subDays((int) config('lesson_log.edit_days', 7))->toDateString()) {
            throw $this->bad('lesson_date', 'Đã quá hạn ghi sổ (' . config('lesson_log.edit_days', 7) . ' ngày). Hãy nhờ giáo viên chủ nhiệm hoặc Ban Giám hiệu hỗ trợ.');
        }
        $cn = DB::table($this->t('classes'))->where('id', $classId)->value('name');
        if (! $cn) {
            throw $this->bad('class_id', 'Không tìm thấy lớp.');
        }
        if ($this->weekLocked($classId, $date)) {
            throw $this->bad('lesson_date', 'Tuần này đã được giáo viên chủ nhiệm xác nhận, không thêm được tiết mới.');
        }
        if (DB::table('sm_lesson_logs')->where(['class_id' => $classId, 'lesson_date' => $date, 'period' => $period])->exists()) {
            throw $this->bad('period', "Tiết {$period} ngày " . Carbon::parse($date)->format('d/m/Y') . " của lớp {$cn} đã có bản ghi.");
        }

        return DB::transaction(function () use ($d, $a, $classId, $date, $period, $cn) {
            $abs = $this->absences($classId, (array) ($d['absences'] ?? []));
            $y = $this->year();
            $id = (int) DB::table('sm_lesson_logs')->insertGetId([
                'school_year_id' => $y->id ?? null, 'class_id' => $classId, 'class_name' => $cn, 'subject_name' => $d['subject_name'],
                'lesson_date' => $date, 'period' => $period, 'teacher_id' => $a['id'], 'teacher_name' => $a['name'],
                'lesson_no' => $d['lesson_no'] ?? null, 'title' => $d['title'] ?? null, 'content' => $d['content'] ?? null,
                'equipment' => $d['equipment'] ?? null, 'homework' => $d['homework'] ?? null, 'rating' => $d['rating'] ?? null,
                'total_students' => count($this->roster($classId)), 'discipline_note' => $d['discipline_note'] ?? null, 'remark' => $d['remark'] ?? null,
                'status' => 'draft', 'created_by' => $a['id'], 'created_at' => now(), 'updated_at' => now(),
            ] + $this->counts($abs));
            $this->saveAbsences($id, $abs);
            $this->event($id, 'create', "Ghi sổ tiết {$period} – {$d['subject_name']} – lớp {$cn}", $a);
            return $id;
        });
    }

    public function update(int $id, array $d, array $a): void
    {
        $l = DB::table('sm_lesson_logs')->where('id', $id)->first();
        if (! $l) {
            throw $this->bad('id', 'Không tìm thấy bản ghi.');
        }
        if (! $this->perms($l, $a)['can_edit']) {
            throw $this->bad('status', 'Không sửa được: bản ghi đã ký sổ, đã quá hạn sửa, tuần đã được xác nhận hoặc không phải của bạn.');
        }
        DB::transaction(function () use ($id, $d, $a, $l) {
            $upd = array_intersect_key($d, array_flip(['subject_name', 'lesson_no', 'title', 'content', 'equipment', 'homework', 'rating', 'remark', 'discipline_note']));
            if (array_key_exists('absences', $d)) {
                $abs = $this->absences((int) $l->class_id, (array) $d['absences']);
                $upd += $this->counts($abs);
                $this->saveAbsences($id, $abs);
            }
            DB::table('sm_lesson_logs')->where('id', $id)->update($upd + ['updated_at' => now()]);
            $this->event($id, 'update', 'Cập nhật nội dung tiết học', $a);
        });
    }

    public function destroy(int $id, array $a): void
    {
        $l = DB::table('sm_lesson_logs')->where('id', $id)->first();
        if (! $l || ! $this->perms($l, $a)['can_delete']) {
            throw $this->bad('id', 'Chỉ xóa được bản ghi nháp của chính bạn.');
        }
        DB::transaction(function () use ($id) {
            DB::table('sm_lesson_log_absences')->where('log_id', $id)->delete();
            DB::table('sm_lesson_log_events')->where('log_id', $id)->delete();
            DB::table('sm_lesson_logs')->where('id', $id)->delete();
        });
    }

    public function sign(int $id, array $a): void
    {
        $l = DB::table('sm_lesson_logs')->where('id', $id)->first();
        if (! $l || ! $this->perms($l, $a)['can_sign']) {
            throw $this->bad('status', 'Không ký sổ được tiết này (đã ký, quá hạn hoặc tuần đã xác nhận).');
        }
        if (! trim((string) $l->title) || ! $l->rating) {
            throw $this->bad('title', 'Cần nhập tên bài học và xếp loại tiết học trước khi ký sổ.');
        }
        DB::table('sm_lesson_logs')->where('id', $id)->update(['status' => 'signed', 'signed_at' => now(), 'updated_at' => now()]);
        $this->event($id, 'sign', 'Giáo viên ký sổ', $a);
    }

    public function unsign(int $id, array $a): void
    {
        $l = DB::table('sm_lesson_logs')->where('id', $id)->first();
        if (! $l || ! $this->perms($l, $a)['can_unsign']) {
            throw $this->bad('status', 'Không hủy ký được (đã quá hạn hoặc tuần đã được xác nhận).');
        }
        DB::table('sm_lesson_logs')->where('id', $id)->update(['status' => 'draft', 'signed_at' => null, 'updated_at' => now()]);
        $this->event($id, 'unsign', 'Hủy ký sổ để chỉnh sửa', $a);
    }

    public function reopen(int $id, string $reason, array $a): void
    {
        $l = DB::table('sm_lesson_logs')->where('id', $id)->first();
        if (! $l) {
            throw $this->bad('id', 'Không tìm thấy bản ghi.');
        }
        if ($l->status === 'confirmed') {
            throw $this->bad('status', 'Tuần này đã được xác nhận. Hãy mở lại tuần trước khi mở lại tiết học.');
        }
        if (! $this->perms($l, $a)['can_reopen']) {
            throw $this->bad('status', 'Chỉ giáo viên chủ nhiệm lớp (hoặc Ban Giám hiệu) mới mở lại được sổ đã ký.');
        }
        if (mb_strlen(trim($reason)) < 5) {
            throw $this->bad('reason', 'Hãy ghi rõ lý do mở lại (ít nhất 5 ký tự).');
        }
        DB::table('sm_lesson_logs')->where('id', $id)->update(['status' => 'draft', 'signed_at' => null, 'updated_at' => now()]);
        $this->event($id, 'reopen', 'Mở lại để sửa: ' . trim($reason), $a);
    }

    public function comment(int $id, string $body, array $a): void
    {
        if (! DB::table('sm_lesson_logs')->where('id', $id)->exists()) {
            throw $this->bad('id', 'Không tìm thấy bản ghi.');
        }
        $this->event($id, 'comment', $body, $a);
    }

    public function homeroomNote(int $id, ?string $note, array $a): void
    {
        $l = DB::table('sm_lesson_logs')->where('id', $id)->first();
        if (! $l || ! $this->perms($l, $a)['can_note']) {
            throw $this->bad('note', 'Chỉ giáo viên chủ nhiệm lớp (hoặc Ban Giám hiệu) mới ghi ý kiến vào sổ.');
        }
        DB::table('sm_lesson_logs')->where('id', $id)->update(['homeroom_note' => $note, 'updated_at' => now()]);
        $this->event($id, 'comment', 'Ý kiến GVCN: ' . ($note ?: '(đã xóa)'), $a);
    }

    /* ===================== xác nhận tuần ===================== */

    public function confirmWeek(int $classId, string $date, ?string $note, bool $force, array $a): array
    {
        if (! $this->canConfirm($a, $classId)) {
            throw $this->bad('class', 'Chỉ giáo viên chủ nhiệm lớp này (hoặc Ban Giám hiệu) mới xác nhận được sổ tuần.');
        }
        $mon = $this->weekStart($date);
        $range = [$mon->toDateString(), $mon->copy()->addDays(5)->toDateString()];

        return DB::transaction(function () use ($classId, $mon, $range, $note, $force, $a) {
            $drafts = DB::table('sm_lesson_logs')->where('class_id', $classId)->whereBetween('lesson_date', $range)->where('status', 'draft')->count();
            if ($drafts > 0 && ! $force) {
                throw $this->bad('week', "Còn {$drafts} tiết chưa ký sổ. Nhắc giáo viên bộ môn ký sổ, hoặc chọn “Vẫn xác nhận”.");
            }
            $ids = DB::table('sm_lesson_logs')->where('class_id', $classId)->whereBetween('lesson_date', $range)->where('status', 'signed')->pluck('id')->all();
            if ($ids) {
                DB::table('sm_lesson_logs')->whereIn('id', $ids)->update(['status' => 'confirmed', 'confirmed_by' => $a['id'], 'confirmed_at' => now(), 'updated_at' => now()]);
                foreach ($ids as $i) {
                    $this->event((int) $i, 'confirm', 'GVCN xác nhận sổ tuần ' . $mon->format('d/m') . ($note ? ': ' . $note : ''), $a);
                }
            }
            $row = ['status' => 'confirmed', 'confirmed_by' => $a['id'], 'confirmed_name' => $a['name'], 'confirmed_at' => now(), 'note' => $note, 'updated_at' => now()];
            $k = ['class_id' => $classId, 'week_start' => $mon->toDateString()];
            DB::table('sm_lesson_log_weeks')->where($k)->exists()
                ? DB::table('sm_lesson_log_weeks')->where($k)->update($row)
                : DB::table('sm_lesson_log_weeks')->insert($k + $row + ['created_at' => now()]);

            return ['confirmed' => count($ids), 'drafts' => $drafts];
        });
    }

    public function reopenWeek(int $classId, string $date, array $a): int
    {
        if (! $this->canConfirm($a, $classId)) {
            throw $this->bad('class', 'Chỉ giáo viên chủ nhiệm lớp này (hoặc Ban Giám hiệu) mới mở lại được tuần.');
        }
        $mon = $this->weekStart($date);
        $range = [$mon->toDateString(), $mon->copy()->addDays(5)->toDateString()];
        DB::table('sm_lesson_log_weeks')->where(['class_id' => $classId, 'week_start' => $mon->toDateString()])->update(['status' => 'open', 'updated_at' => now()]);

        return DB::table('sm_lesson_logs')->where('class_id', $classId)->whereBetween('lesson_date', $range)->where('status', 'confirmed')->update(['status' => 'signed', 'updated_at' => now()]);
    }

    /* ===================== thống kê ===================== */

    public function stats(array $f, array $a): array
    {
        $to = $f['to'] ?? $this->today();
        $from = $f['from'] ?? Carbon::parse($to)->subDays(29)->toDateString();
        $b = fn () => DB::table('sm_lesson_logs as l')->whereBetween('l.lesson_date', [$from, $to])
            ->when(! empty($f['class_id']), fn ($q) => $q->where('l.class_id', $f['class_id']))
            ->when(! empty($f['mine']), fn ($q) => $q->where('l.teacher_id', $a['id']));

        $k = $b()->selectRaw("COUNT(*) as entries, COALESCE(SUM(l.status <> 'draft'), 0) as signed, COALESCE(SUM(l.status = 'confirmed'), 0) as confirmed, COALESCE(SUM(l.status = 'draft'), 0) as drafts, COALESCE(SUM(l.absent_excused + l.absent_unexcused), 0) as absent, COALESCE(SUM(l.absent_unexcused), 0) as unexcused, COALESCE(SUM(l.late_count), 0) as late")->first();
        $overdue = $b()->where('l.status', 'draft')->where('l.lesson_date', '<', Carbon::today()->subDay()->toDateString())->count();
        $entries = (int) $k->entries;

        $ratings = $b()->selectRaw('l.rating, COUNT(*) as n')->whereNotNull('l.rating')->groupBy('l.rating')->pluck('n', 'rating')->all();
        $byRating = [];
        foreach ((array) config('lesson_log.ratings') as $key => $label) {
            $byRating[] = ['key' => $key, 'label' => $label, 'count' => (int) ($ratings[$key] ?? 0)];
        }
        $bySubject = $b()->selectRaw("l.subject_name as subject, COUNT(*) as n, COALESCE(SUM(l.rating IN ('good','fair')), 0) as ok")->groupBy('l.subject_name')->orderByDesc('n')->limit(10)->get()
            ->map(fn ($r) => ['subject' => $r->subject, 'count' => (int) $r->n, 'good_rate' => $r->n ? (int) round($r->ok / $r->n * 100) : 0])->all();
        $byTeacher = $b()->selectRaw("l.teacher_id, l.teacher_name as name, COUNT(*) as n, COALESCE(SUM(l.status <> 'draft'), 0) as signed, COALESCE(SUM(l.status = 'draft'), 0) as drafts")->groupBy('l.teacher_id', 'l.teacher_name')->orderByDesc('n')->limit(15)->get()
            ->map(fn ($r) => ['teacher_id' => (int) $r->teacher_id, 'name' => $r->name, 'entries' => (int) $r->n, 'signed' => (int) $r->signed, 'drafts' => (int) $r->drafts])->all();

        $wd = $b()->selectRaw('DAYOFWEEK(l.lesson_date) as d, COALESCE(SUM(l.absent_excused + l.absent_unexcused), 0) as absent, COALESCE(SUM(l.late_count), 0) as late')->groupByRaw('DAYOFWEEK(l.lesson_date)')->get()->keyBy('d');
        $byWeekday = [];
        foreach ([2 => 'T2', 3 => 'T3', 4 => 'T4', 5 => 'T5', 6 => 'T6', 7 => 'T7'] as $n => $lb) {
            $byWeekday[] = ['label' => $lb, 'absent' => (int) ($wd[$n]->absent ?? 0), 'late' => (int) ($wd[$n]->late ?? 0)];
        }

        $top = [];
        try {
            $top = DB::table('sm_lesson_log_absences as x')->join('sm_lesson_logs as l', 'l.id', '=', 'x.log_id')->whereBetween('l.lesson_date', [$from, $to])
                ->when(! empty($f['class_id']), fn ($q) => $q->where('l.class_id', $f['class_id']))->where('x.type', '<>', 'late')
                ->selectRaw("x.student_id, x.student_name as name, x.student_code as code, MAX(l.class_name) as class_name, COUNT(*) as n, SUM(x.type = 'unexcused') as bad")
                ->groupBy('x.student_id', 'x.student_name', 'x.student_code')->orderByDesc('n')->limit(8)->get()
                ->map(fn ($r) => ['student_id' => (int) $r->student_id, 'name' => $r->name, 'code' => $r->code, 'class_name' => $r->class_name, 'count' => (int) $r->n, 'unexcused' => (int) $r->bad])->all();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('LessonLog stats top absent calculation: ' . $e->getMessage());
        }

        $pending = [];
        try {
            $pending = DB::table('sm_lesson_logs as l')
                ->leftJoin('sm_lesson_log_weeks as w', function ($j) {
                    $j->on('w.class_id', '=', 'l.class_id')->whereRaw('w.week_start = DATE_SUB(l.lesson_date, INTERVAL WEEKDAY(l.lesson_date) DAY)');
                })
                ->whereBetween('l.lesson_date', [$from, $to])->whereRaw('DATE_ADD(DATE_SUB(l.lesson_date, INTERVAL WEEKDAY(l.lesson_date) DAY), INTERVAL 6 DAY) < CURDATE()')
                ->where(fn ($q) => $q->whereNull('w.status')->orWhere('w.status', '<>', 'confirmed'))
                ->when(! empty($f['class_id']), fn ($q) => $q->where('l.class_id', $f['class_id']))
                ->selectRaw("l.class_id, l.class_name, DATE_SUB(l.lesson_date, INTERVAL WEEKDAY(l.lesson_date) DAY) as week_start, COUNT(*) as n, SUM(l.status = 'draft') as drafts")
                ->groupByRaw("l.class_id, l.class_name, DATE_SUB(l.lesson_date, INTERVAL WEEKDAY(l.lesson_date) DAY)")
                ->orderByRaw("DATE_SUB(l.lesson_date, INTERVAL WEEKDAY(l.lesson_date) DAY) desc")
                ->limit(10)->get()
                ->map(fn ($r) => ['class_id' => (int) $r->class_id, 'class_name' => $r->class_name, 'week_start' => $r->week_start, 'entries' => (int) $r->n, 'drafts' => (int) $r->drafts])->all();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('LessonLog stats pending_weeks calculation: ' . $e->getMessage());
        }

        $recent = DB::table('sm_lesson_log_events as e')->join('sm_lesson_logs as l', 'l.id', '=', 'e.log_id')->orderByDesc('e.id')->limit(10)
            ->get(['e.id', 'e.log_id', 'e.type', 'e.message', 'e.actor_name', 'e.created_at', 'l.class_name', 'l.subject_name', 'l.period'])->map(fn ($r) => (array) $r)->all();

        return [
            'from' => $from, 'to' => $to,
            'kpi' => [
                'entries' => $entries, 'signed' => (int) $k->signed, 'confirmed' => (int) $k->confirmed, 'drafts' => (int) $k->drafts, 'overdue_drafts' => $overdue,
                'sign_rate' => $entries ? (int) round($k->signed / $entries * 100) : 0, 'absent' => (int) $k->absent, 'unexcused' => (int) $k->unexcused, 'late' => (int) $k->late,
            ],
            'by_rating' => $byRating, 'by_subject' => $bySubject, 'by_teacher' => $byTeacher, 'by_weekday' => $byWeekday, 'top_absent' => $top, 'pending_weeks' => $pending, 'recent' => $recent,
        ];
    }
}
