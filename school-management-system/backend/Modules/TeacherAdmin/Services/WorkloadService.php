<?php

namespace Modules\TeacherAdmin\Services;

use Illuminate\Support\Facades\DB;
use Modules\TeacherAdmin\Support\Audit;

class WorkloadService
{
    public function quota(bool $homeroom): int
    {
        return (int) config('teacheradmin.teacher_quota', 17) - ($homeroom ? (int) config('teacheradmin.homeroom_reduction', 4) : 0);
    }

    /** teacher_id => [periods, slots, homeroom] */
    public function loads(int $yearId): array
    {
        $rows = DB::table('sm_class_subjects as cs')
            ->join('sm_classes as c', 'c.id', '=', 'cs.class_id')
            ->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')
            ->leftJoin('sm_subj_curriculum as cur', fn ($j) => $j->on('cur.subject_id', '=', 's.id')->on('cur.grade', '=', 'c.grade'))
            ->where('c.school_year_id', $yearId)->whereNotNull('cs.teacher_id')
            ->groupBy('cs.teacher_id')
            ->selectRaw('cs.teacher_id, SUM(COALESCE(cur.periods_per_week, s.periods_per_week)) as periods, COUNT(*) as slots')->get();
        $hr = DB::table('sm_classes')->where('school_year_id', $yearId)->whereNotNull('homeroom_teacher_id')->pluck('homeroom_teacher_id')->all();
        $out = [];
        foreach ($rows as $r) {
            $out[$r->teacher_id] = ['periods' => (int) $r->periods, 'slots' => (int) $r->slots, 'homeroom' => in_array($r->teacher_id, $hr)];
        }
        foreach ($hr as $id) {
            $out[$id] ??= ['periods' => 0, 'slots' => 0, 'homeroom' => true];
            $out[$id]['homeroom'] = true;
        }

        return $out;
    }

    public function overview(int $yearId): array
    {
        $loads = $this->loads($yearId);
        $subjects = DB::table('sm_subjects')->pluck('name', 'id');
        $cs = DB::table('sm_class_subjects as cs')->join('sm_classes as c', 'c.id', '=', 'cs.class_id')->where('c.school_year_id', $yearId)
            ->get(['cs.teacher_id', 'c.name', 'cs.subject_id'])->groupBy('teacher_id');
        $rows = [];
        foreach (DB::table('sm_teachers')->where('status', 'active')->orderBy('full_name')->get() as $t) {
            $l = $loads[$t->id] ?? ['periods' => 0, 'slots' => 0, 'homeroom' => false];
            $q = $this->quota($l['homeroom']);
            $items = $cs[$t->id] ?? collect();
            $rows[] = [
                'id' => $t->id, 'code' => $t->code, 'full_name' => $t->full_name, 'main_subject_id' => $t->main_subject_id,
                'main_subject' => $subjects[$t->main_subject_id] ?? null, 'periods' => $l['periods'], 'quota' => $q,
                'homeroom' => $l['homeroom'], 'classes' => $items->pluck('name')->unique()->values()->all(),
                'subjects' => $items->pluck('subject_id')->unique()->map(fn ($i) => $subjects[$i] ?? '')->values()->all(),
                'status' => $l['periods'] > $q ? 'over' : ($l['periods'] < $q * 0.6 ? 'under' : 'ok'),
            ];
        }
        $n = count($rows) ?: 1;

        return ['teachers' => $rows, 'summary' => [
            'total' => count($rows),
            'over' => count(array_filter($rows, fn ($r) => $r['status'] === 'over')),
            'under' => count(array_filter($rows, fn ($r) => $r['status'] === 'under')),
            'avg' => round(array_sum(array_column($rows, 'periods')) / $n, 1),
            'quota' => (int) config('teacheradmin.teacher_quota', 17),
        ]];
    }

    /**
     * Gợi ý cân bằng tải: chuyển phân công từ GV quá tải sang GV cùng chuyên môn còn dư tiết.
     * Chỉ gợi ý, không tự thay đổi dữ liệu.
     */
    public function suggestions(int $yearId): array
    {
        $data = $this->overview($yearId)['teachers'];
        $byId = [];
        foreach ($data as $t) {
            $byId[$t['id']] = $t;
        }
        $spec = DB::table('sm_tch_subjects')->get()->groupBy('subject_id')->map(fn ($g) => $g->pluck('teacher_id')->all());
        $over = array_filter($byId, fn ($t) => $t['periods'] > $t['quota']);
        $out = [];
        foreach ($over as $t) {
            $assign = DB::table('sm_class_subjects as cs')->join('sm_classes as c', 'c.id', '=', 'cs.class_id')->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')
                ->leftJoin('sm_subj_curriculum as cur', fn ($j) => $j->on('cur.subject_id', '=', 's.id')->on('cur.grade', '=', 'c.grade'))
                ->where('cs.teacher_id', $t['id'])->where('c.school_year_id', $yearId)
                ->orderByRaw('COALESCE(cur.periods_per_week, s.periods_per_week) asc')
                ->get(['cs.id', 'cs.subject_id', 's.name as subject', 'c.name as class_name', DB::raw('COALESCE(cur.periods_per_week, s.periods_per_week) as periods')]);
            $excess = $t['periods'] - $t['quota'];
            foreach ($assign as $a) {
                if ($excess <= 0) {
                    break;
                }
                $best = null;
                foreach ($spec[$a->subject_id] ?? [] as $cand) {
                    if ($cand === $t['id'] || ! isset($byId[$cand])) {
                        continue;
                    }
                    $room = $byId[$cand]['quota'] - $byId[$cand]['periods'];
                    if ($room >= $a->periods && (! $best || $room > $best['room'])) {
                        $best = ['id' => $cand, 'name' => $byId[$cand]['full_name'], 'room' => $room];
                    }
                }
                if ($best) {
                    $out[] = ['class_subject_id' => $a->id, 'from_id' => $t['id'], 'from' => $t['full_name'], 'to_id' => $best['id'], 'to' => $best['name'],
                        'subject' => $a->subject, 'class_name' => $a->class_name, 'periods' => (int) $a->periods,
                        'from_after' => $t['periods'] - $a->periods, 'to_after' => $byId[$best['id']]['periods'] + $a->periods];
                    $byId[$best['id']]['periods'] += $a->periods;
                    $excess -= $a->periods;
                }
            }
        }

        return $out;
    }

    public function applyTransfer(int $classSubjectId, int $toTeacherId): array
    {
        $cs = DB::table('sm_class_subjects')->find($classSubjectId);
        $to = DB::table('sm_teachers')->find($toTeacherId);
        if (! $cs || ! $to) {
            return [false, 'Không tìm thấy phân công hoặc giáo viên'];
        }
        if ($to->status !== 'active') {
            return [false, "{$to->full_name} không ở trạng thái đang công tác"];
        }
        $conflict = $this->scheduleConflict($classSubjectId, $toTeacherId);
        if ($conflict) {
            return [false, $conflict];
        }
        $from = DB::table('sm_teachers')->find($cs->teacher_id);
        DB::table('sm_class_subjects')->where('id', $classSubjectId)->update(['teacher_id' => $toTeacherId]);
        Audit::log('transfer', 'Chuyển phân công từ ' . ($from->full_name ?? '—') . " sang {$to->full_name} (cs #$classSubjectId)", $toTeacherId);

        return [true, "Đã chuyển phân công sang {$to->full_name}"];
    }

    /** Trả về chuỗi mô tả nếu GV đích bị trùng tiết với thời khóa biểu của phân công này. */
    public function scheduleConflict(int $classSubjectId, int $teacherId): ?string
    {
        $slots = DB::table('sm_timetable')->where('class_subject_id', $classSubjectId)->get(['weekday', 'period']);
        foreach ($slots as $s) {
            $hit = DB::table('sm_timetable as tt')->join('sm_class_subjects as cs', 'cs.id', '=', 'tt.class_subject_id')
                ->join('sm_classes as c', 'c.id', '=', 'cs.class_id')
                ->where('cs.teacher_id', $teacherId)->where('tt.weekday', $s->weekday)->where('tt.period', $s->period)
                ->where('tt.class_subject_id', '!=', $classSubjectId)->value('c.name');
            if ($hit) {
                return 'Trùng lịch: thứ ' . $s->weekday . ' tiết ' . $s->period . " đang dạy lớp $hit";
            }
        }

        return null;
    }

    // ---- Chủ nhiệm ----
    public function homeroom(int $yearId): array
    {
        $classes = DB::table('sm_classes as c')->leftJoin('sm_teachers as t', 't.id', '=', 'c.homeroom_teacher_id')
            ->where('c.school_year_id', $yearId)->orderBy('c.grade')->orderBy('c.name')
            ->get(['c.id', 'c.name', 'c.grade', 'c.homeroom_teacher_id', 't.full_name as teacher', 't.code as teacher_code', 't.main_subject_id']);
        $cnt = DB::table('sm_students')->selectRaw('class_id, COUNT(*) as n')->groupBy('class_id')->pluck('n', 'class_id');
        $loads = $this->loads($yearId);
        $out = [];
        foreach ($classes as $c) {
            $row = (array) $c;
            $row['students'] = (int) ($cnt[$c->id] ?? 0);
            $row['teaches_class'] = $c->homeroom_teacher_id ? DB::table('sm_class_subjects')->where('class_id', $c->id)->where('teacher_id', $c->homeroom_teacher_id)->exists() : false;
            $row['teacher_periods'] = $c->homeroom_teacher_id ? ($loads[$c->homeroom_teacher_id]['periods'] ?? 0) : null;
            $out[] = $row;
        }
        // GV đủ điều kiện làm chủ nhiệm: đang công tác, chưa chủ nhiệm lớp nào, ưu tiên GV đang dạy lớp đó
        $busy = collect($out)->pluck('homeroom_teacher_id')->filter()->all();
        $free = DB::table('sm_teachers')->where('status', 'active')->whereNotIn('id', $busy ?: [0])->orderBy('full_name')->get(['id', 'code', 'full_name', 'main_subject_id']);

        return ['classes' => $out, 'free_teachers' => $free];
    }

    public function setHomeroom(int $classId, ?int $teacherId): array
    {
        $class = DB::table('sm_classes')->find($classId);
        if (! $class) {
            return [false, 'Không tìm thấy lớp', []];
        }
        $warn = [];
        if ($teacherId) {
            $t = DB::table('sm_teachers')->find($teacherId);
            if (! $t) {
                return [false, 'Không tìm thấy giáo viên', []];
            }
            if ($t->status !== 'active') {
                return [false, "{$t->full_name} không ở trạng thái đang công tác", []];
            }
            $other = DB::table('sm_classes')->where('school_year_id', $class->school_year_id)->where('homeroom_teacher_id', $teacherId)->where('id', '!=', $classId)->value('name');
            if ($other) {
                return [false, "{$t->full_name} đang chủ nhiệm lớp $other (mỗi giáo viên chỉ chủ nhiệm 1 lớp)", []];
            }
            if (! DB::table('sm_class_subjects')->where('class_id', $classId)->where('teacher_id', $teacherId)->exists()) {
                $warn[] = "{$t->full_name} chưa dạy môn nào ở lớp {$class->name}";
            }
        }
        DB::table('sm_classes')->where('id', $classId)->update(['homeroom_teacher_id' => $teacherId]);
        Audit::log('homeroom', $teacherId ? "Phân công {$t->full_name} chủ nhiệm lớp {$class->name}" : "Bỏ chủ nhiệm lớp {$class->name}", $teacherId);

        return [true, $teacherId ? 'Đã phân công chủ nhiệm' : 'Đã bỏ chủ nhiệm', $warn];
    }
}
