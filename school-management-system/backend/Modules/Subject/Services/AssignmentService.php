<?php

namespace Modules\Subject\Services;

use Illuminate\Support\Facades\DB;
use Modules\Subject\Support\Audit;

class AssignmentService
{
    /** Số tiết/tuần hiệu lực của môn cho 1 khối (ưu tiên chương trình theo khối). */
    private function periodsSql(): string
    {
        return 'COALESCE(cur.periods_per_week, s.periods_per_week)';
    }

    public function matrix(int $yearId, ?int $grade): array
    {
        $classes = DB::table('sm_classes as c')->leftJoin('sm_teachers as h', 'h.id', '=', 'c.homeroom_teacher_id')
            ->where('c.school_year_id', $yearId)
            ->when($grade, fn ($q) => $q->where('c.grade', $grade))
            ->orderBy('c.grade')->orderBy('c.name')
            ->get(['c.id', 'c.name', 'c.grade', 'c.homeroom_teacher_id', 'h.full_name as homeroom_name'])->all();

        $subjects = DB::table('sm_subjects')->where('status', 'active')->orderBy('sort_order')
            ->get(['id', 'code', 'name', 'color', 'kind', 'periods_per_week', 'grades'])
            ->map(function ($s) {
                $s->grades = array_map('intval', explode(',', (string) $s->grades));

                return $s;
            })->all();

        $classIds = array_map(fn ($c) => $c->id, $classes);
        $cells = $classIds ? DB::table('sm_class_subjects as cs')
            ->join('sm_teachers as t', 't.id', '=', 'cs.teacher_id')
            ->whereIn('cs.class_id', $classIds)
            ->get(['cs.id', 'cs.class_id', 'cs.subject_id', 'cs.teacher_id', 't.full_name as teacher_name', 't.code as teacher_code', 't.main_subject_id'])->all() : [];

        $teachers = DB::table('sm_teachers')->orderBy('full_name')->get(['id', 'code', 'full_name', 'main_subject_id'])->all();

        return ['classes' => $classes, 'subjects' => $subjects, 'cells' => $cells, 'teachers' => $teachers, 'load' => $this->teacherLoads($yearId)];
    }

    /** teacher_id => số tiết/tuần đang đảm nhiệm trong năm học. */
    public function teacherLoads(int $yearId): array
    {
        $rows = DB::table('sm_class_subjects as cs')
            ->join('sm_classes as c', 'c.id', '=', 'cs.class_id')
            ->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')
            ->leftJoin('sm_subj_curriculum as cur', fn ($j) => $j->on('cur.subject_id', '=', 's.id')->on('cur.grade', '=', 'c.grade'))
            ->where('c.school_year_id', $yearId)
            ->groupBy('cs.teacher_id')
            ->selectRaw('cs.teacher_id, SUM(' . $this->periodsSql() . ') as periods, COUNT(*) as slots')
            ->get();
        $homeroom = DB::table('sm_classes')->where('school_year_id', $yearId)->whereNotNull('homeroom_teacher_id')->pluck('homeroom_teacher_id')->all();
        $out = [];
        foreach ($rows as $r) {
            $out[$r->teacher_id] = ['periods' => (int) $r->periods, 'slots' => (int) $r->slots, 'homeroom' => in_array($r->teacher_id, $homeroom)];
        }

        return $out;
    }

    public function assign(int $classId, int $subjectId, int $teacherId): array
    {
        $class = DB::table('sm_classes')->find($classId);
        $subject = DB::table('sm_subjects')->find($subjectId);
        $teacher = DB::table('sm_teachers')->find($teacherId);
        if (! $class || ! $subject || ! $teacher) {
            return ['ok' => false, 'message' => 'Lớp, môn học hoặc giáo viên không tồn tại'];
        }
        if ($subject->status !== 'active') {
            return ['ok' => false, 'message' => "Môn {$subject->name} đang ngừng sử dụng, không thể phân công"];
        }
        if (! in_array((int) $class->grade, array_map('intval', explode(',', $subject->grades)), true)) {
            return ['ok' => false, 'message' => "Môn {$subject->name} không áp dụng cho khối {$class->grade}"];
        }

        $warnings = [];
        $homeroomPass = $subject->kind === 'pass' && (int) $class->homeroom_teacher_id === $teacherId; // HĐTN do GVCN đảm nhiệm
        if ((int) $teacher->main_subject_id !== $subjectId && ! $homeroomPass) {
            $warnings[] = "{$teacher->full_name} không thuộc chuyên môn {$subject->name}";
        }
        $existing = DB::table('sm_class_subjects')->where(['class_id' => $classId, 'subject_id' => $subjectId])->first();
        if ($existing) {
            DB::table('sm_class_subjects')->where('id', $existing->id)->update(['teacher_id' => $teacherId]);
            $id = $existing->id;
        } else {
            $id = DB::table('sm_class_subjects')->insertGetId(['class_id' => $classId, 'subject_id' => $subjectId, 'teacher_id' => $teacherId]);
        }

        $load = $this->teacherLoads((int) $class->school_year_id)[$teacherId]['periods'] ?? 0;
        $quota = $this->quota((int) $class->school_year_id, $teacherId);
        if ($load > $quota) {
            $warnings[] = "{$teacher->full_name} vượt định mức: $load/$quota tiết/tuần";
        }
        Audit::log('assign', "Phân công {$teacher->full_name} dạy {$subject->name} lớp {$class->name}", $subjectId);

        return ['ok' => true, 'id' => $id, 'warnings' => $warnings, 'load' => $load, 'quota' => $quota];
    }

    public function quota(int $yearId, int $teacherId): int
    {
        $base = (int) config('subject.teacher_quota', 17);
        $isHomeroom = DB::table('sm_classes')->where('school_year_id', $yearId)->where('homeroom_teacher_id', $teacherId)->exists();

        return $base - ($isHomeroom ? (int) config('subject.homeroom_reduction', 4) : 0);
    }

    public function assignMany(int $subjectId, array $classIds, int $teacherId): array
    {
        $ok = 0;
        $errors = [];
        $warnings = [];
        foreach ($classIds as $cid) {
            $r = $this->assign((int) $cid, $subjectId, $teacherId);
            if ($r['ok']) {
                $ok++;
                $warnings = array_merge($warnings, $r['warnings']);
            } else {
                $errors[] = $r['message'];
            }
        }

        return ['assigned' => $ok, 'errors' => array_values(array_unique($errors)), 'warnings' => array_values(array_unique($warnings))];
    }

    public function unassign(int $id, bool $force): array
    {
        $cs = DB::table('sm_class_subjects as cs')->join('sm_classes as c', 'c.id', '=', 'cs.class_id')
            ->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')->where('cs.id', $id)
            ->first(['cs.*', 'c.name as class_name', 'c.school_year_id', 's.name as subject_name']);
        if (! $cs) {
            return ['ok' => false, 'missing' => true];
        }
        $slots = DB::table('sm_timetable')->where('class_subject_id', $id)->count();
        $grades = DB::table('sm_grades')->where(['class_id' => $cs->class_id, 'subject_id' => $cs->subject_id, 'school_year_id' => $cs->school_year_id])->count();
        if ($grades > 0) {
            return ['ok' => false, 'message' => "Đã có $grades bản ghi điểm của môn này ở lớp {$cs->class_name}, không thể gỡ phân công", 'usage' => compact('slots', 'grades')];
        }
        if ($slots > 0 && ! $force) {
            return ['ok' => false, 'needs_force' => true, 'message' => "Phân công đang có $slots tiết trong thời khóa biểu. Gỡ sẽ xóa các tiết này.", 'usage' => compact('slots', 'grades')];
        }
        DB::transaction(function () use ($id) {
            DB::table('sm_timetable')->where('class_subject_id', $id)->delete();
            DB::table('sm_class_subjects')->where('id', $id)->delete();
        });
        Audit::log('unassign', "Gỡ phân công môn {$cs->subject_name} lớp {$cs->class_name}", (int) $cs->subject_id);

        return ['ok' => true, 'removed_slots' => $slots];
    }

    /** Tự động phân công theo chuyên môn + cân bằng tải. */
    public function auto(int $yearId, ?int $grade, ?int $subjectId, bool $dry): array
    {
        $classes = DB::table('sm_classes')->where('school_year_id', $yearId)->when($grade, fn ($q) => $q->where('grade', $grade))->orderBy('grade')->orderBy('name')->get();
        $subjects = DB::table('sm_subjects')->where('status', 'active')->when($subjectId, fn ($q) => $q->where('id', $subjectId))->orderBy('sort_order')->get();
        $teachers = DB::table('sm_teachers')->get()->groupBy('main_subject_id');
        $loads = array_map(fn ($l) => $l['periods'], $this->teacherLoads($yearId));
        $existing = DB::table('sm_class_subjects')->whereIn('class_id', $classes->pluck('id'))->get()->mapWithKeys(fn ($r) => [$r->class_id . ':' . $r->subject_id => 1]);
        $cur = DB::table('sm_subj_curriculum')->get()->mapWithKeys(fn ($r) => [$r->subject_id . ':' . $r->grade => (int) $r->periods_per_week]);

        $plan = [];
        $skipped = [];
        foreach ($classes as $c) {
            foreach ($subjects as $s) {
                if (! in_array((int) $c->grade, array_map('intval', explode(',', $s->grades)), true) || isset($existing[$c->id . ':' . $s->id])) {
                    continue;
                }
                $pool = $teachers[$s->id] ?? collect();
                if ($pool->isEmpty() && $s->kind === 'pass' && $c->homeroom_teacher_id) {
                    $pool = collect([DB::table('sm_teachers')->find($c->homeroom_teacher_id)])->filter(); // môn đánh giá: GVCN đảm nhiệm
                }
                if ($pool->isEmpty()) {
                    $skipped[] = ['class' => $c->name, 'subject' => $s->name, 'reason' => 'Chưa có giáo viên chuyên môn môn này'];
                    continue;
                }
                // ưu tiên: GV chủ nhiệm lớp này nếu cùng chuyên môn, sau đó GV ít tiết nhất
                $pick = $pool->firstWhere('id', $c->homeroom_teacher_id) ?: $pool->sortBy(fn ($t) => $loads[$t->id] ?? 0)->first();
                $p = $cur[$s->id . ':' . $c->grade] ?? (int) $s->periods_per_week;
                $loads[$pick->id] = ($loads[$pick->id] ?? 0) + $p;
                $plan[] = ['class_id' => $c->id, 'class' => $c->name, 'subject_id' => $s->id, 'subject' => $s->name, 'teacher_id' => $pick->id, 'teacher' => $pick->full_name];
            }
        }
        if (! $dry && $plan) {
            DB::transaction(fn () => DB::table('sm_class_subjects')->insert(array_map(fn ($p) => ['class_id' => $p['class_id'], 'subject_id' => $p['subject_id'], 'teacher_id' => $p['teacher_id']], $plan)));
            Audit::log('auto_assign', 'Tự động phân công ' . count($plan) . ' mục giảng dạy' . ($grade ? " khối $grade" : ''));
        }

        return ['plan' => array_slice($plan, 0, 200), 'count' => count($plan), 'skipped' => $skipped, 'applied' => ! $dry && $plan];
    }

    public function copyFromYear(int $from, int $to): array
    {
        $toClasses = DB::table('sm_classes')->where('school_year_id', $to)->pluck('id', 'name');
        $fromClasses = DB::table('sm_classes')->where('school_year_id', $from)->pluck('id', 'name');
        $made = 0;
        DB::transaction(function () use ($toClasses, $fromClasses, &$made) {
            foreach ($toClasses as $name => $newId) {
                if (! isset($fromClasses[$name])) {
                    continue;
                }
                foreach (DB::table('sm_class_subjects')->where('class_id', $fromClasses[$name])->get() as $r) {
                    if (! DB::table('sm_class_subjects')->where(['class_id' => $newId, 'subject_id' => $r->subject_id])->exists()) {
                        DB::table('sm_class_subjects')->insert(['class_id' => $newId, 'subject_id' => $r->subject_id, 'teacher_id' => $r->teacher_id]);
                        $made++;
                    }
                }
            }
        });
        Audit::log('copy_assign', "Sao chép phân công từ năm học #$from sang #$to: $made mục");

        return ['copied' => $made];
    }
}
