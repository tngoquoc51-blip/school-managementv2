<?php

namespace Modules\Academic\Repositories;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Truy vấn dữ liệu lớp học (sm_classes + sm_enrollments + sm_students ...).
 * Dùng Query Builder để join/đếm hiệu quả với dữ liệu lớn.
 */
class SmClassRepository
{
    /* ------------------------------------------------------------------ */
    /*  Danh sách / chi tiết                                               */
    /* ------------------------------------------------------------------ */

    private function base(): Builder
    {
        return DB::table('sm_classes as c')
            ->join('sm_school_years as y', 'y.id', '=', 'c.school_year_id')
            ->leftJoin('sm_teachers as t', 't.id', '=', 'c.homeroom_teacher_id')
            ->select(
                'c.id', 'c.school_year_id', 'c.grade', 'c.name', 'c.homeroom_teacher_id',
                'c.room', 'c.capacity', 'c.status', 'c.note',
                'y.label as school_year_label',
                't.code as homeroom_code', 't.full_name as homeroom_name'
            )
            ->selectSub(
                DB::table('sm_enrollments as e')->selectRaw('COUNT(*)')->whereColumn('e.class_id', 'c.id'),
                'student_count'
            )
            ->selectSub(
                DB::table('sm_enrollments as e')
                    ->join('sm_students as s', 's.id', '=', 'e.student_id')
                    ->selectRaw('COUNT(*)')->whereColumn('e.class_id', 'c.id')->where('s.gender', 'Nam'),
                'male_count'
            );
    }

    public function paginate(array $f, int $perPage)
    {
        $q = $this->base();

        if (! empty($f['school_year_id'])) {
            $q->where('c.school_year_id', (int) $f['school_year_id']);
        }
        if (! empty($f['grade'])) {
            $q->where('c.grade', (int) $f['grade']);
        }
        if (! empty($f['status'])) {
            $q->where('c.status', $f['status']);
        }
        if (! empty($f['q'])) {
            $kw = '%' . trim($f['q']) . '%';
            $q->where(function ($w) use ($kw) {
                $w->where('c.name', 'like', $kw)
                  ->orWhere('t.full_name', 'like', $kw)
                  ->orWhere('c.room', 'like', $kw);
            });
        }
        if (($f['homeroom'] ?? '') === 'none') {
            $q->whereNull('c.homeroom_teacher_id');
        } elseif (($f['homeroom'] ?? '') === 'has') {
            $q->whereNotNull('c.homeroom_teacher_id');
        }

        $sortable = ['name' => 'c.name', 'grade' => 'c.grade', 'student_count' => 'student_count', 'id' => 'c.id'];
        $dir = strtolower($f['dir'] ?? 'asc') === 'desc' ? 'desc' : 'asc';
        if (! empty($f['sort']) && isset($sortable[$f['sort']])) {
            $q->orderBy($sortable[$f['sort']], $dir);
        } else {
            $q->orderBy('c.grade')->orderBy('c.name');
        }

        return $q->paginate($perPage);
    }

    public function allForYear(int $yearId)
    {
        return $this->base()->where('c.school_year_id', $yearId)->orderBy('c.grade')->orderBy('c.name')->get();
    }

    public function find(int $id): ?object
    {
        return $this->base()->where('c.id', $id)->first();
    }

    public function rawFind(int $id): ?object
    {
        return DB::table('sm_classes')->where('id', $id)->first();
    }

    /* ------------------------------------------------------------------ */
    /*  Thống kê                                                           */
    /* ------------------------------------------------------------------ */

    public function stats(int $yearId): array
    {
        $totalClasses = DB::table('sm_classes')->where('school_year_id', $yearId)->count();
        $totalStudents = DB::table('sm_enrollments')->where('school_year_id', $yearId)->count();

        $byGrade = DB::table('sm_classes as c')
            ->leftJoin('sm_enrollments as e', 'e.class_id', '=', 'c.id')
            ->where('c.school_year_id', $yearId)
            ->groupBy('c.grade')->orderBy('c.grade')
            ->selectRaw('c.grade, COUNT(DISTINCT c.id) as classes, COUNT(e.id) as students')
            ->get();

        $gender = DB::table('sm_enrollments as e')
            ->join('sm_students as s', 's.id', '=', 'e.student_id')
            ->where('e.school_year_id', $yearId)
            ->groupBy('s.gender')->selectRaw('s.gender, COUNT(*) as total')->pluck('total', 'gender');

        $noHomeroom = DB::table('sm_classes')->where('school_year_id', $yearId)->whereNull('homeroom_teacher_id')->count();

        $fullClasses = DB::table('sm_classes as c')->where('c.school_year_id', $yearId)
            ->whereRaw('(SELECT COUNT(*) FROM sm_enrollments e WHERE e.class_id = c.id) >= c.capacity')->count();

        $unassigned = DB::table('sm_students as s')
            ->whereNotExists(function ($q) use ($yearId) {
                $q->select(DB::raw(1))->from('sm_enrollments as e')
                    ->whereColumn('e.student_id', 's.id')->where('e.school_year_id', $yearId);
            })->count();

        return [
            'total_classes'     => $totalClasses,
            'total_students'    => $totalStudents,
            'avg_per_class'     => $totalClasses ? round($totalStudents / $totalClasses, 1) : 0,
            'male'              => (int) ($gender['Nam'] ?? 0),
            'female'            => (int) ($gender['Nữ'] ?? 0),
            'no_homeroom'       => $noHomeroom,
            'full_classes'      => $fullClasses,
            'unassigned_students' => $unassigned,
            'by_grade'          => $byGrade,
        ];
    }

    /* ------------------------------------------------------------------ */
    /*  Meta                                                               */
    /* ------------------------------------------------------------------ */

    public function years()
    {
        return DB::table('sm_school_years')->orderByDesc('id')->get(['id', 'label', 'is_current', 'status', 'start_date', 'end_date']);
    }

    public function teachers(?int $yearId)
    {
        return DB::table('sm_teachers as t')
            ->join('sm_subjects as s', 's.id', '=', 't.main_subject_id')
            ->leftJoin('sm_classes as hc', function ($j) use ($yearId) {
                $j->on('hc.homeroom_teacher_id', '=', 't.id');
                if ($yearId) {
                    $j->where('hc.school_year_id', '=', $yearId);
                }
            })
            ->orderBy('t.full_name')
            ->get([
                't.id', 't.code', 't.full_name', 't.main_subject_id', 's.name as main_subject',
                'hc.id as homeroom_class_id', 'hc.name as homeroom_class_name',
            ]);
    }

    public function subjects()
    {
        return DB::table('sm_subjects')->orderBy('sort_order')->get();
    }

    public function periods()
    {
        return DB::table('sm_periods')->orderBy('id')->get();
    }

    /* ------------------------------------------------------------------ */
    /*  Ghi dữ liệu lớp                                                    */
    /* ------------------------------------------------------------------ */

    public function insert(array $data): int
    {
        return (int) DB::table('sm_classes')->insertGetId($data + ['created_at' => now(), 'updated_at' => now()]);
    }

    public function update(int $id, array $data): void
    {
        DB::table('sm_classes')->where('id', $id)->update($data + ['updated_at' => now()]);
    }

    public function delete(int $id): void
    {
        DB::table('sm_classes')->where('id', $id)->delete();
    }

    public function nameExists(int $yearId, string $name): bool
    {
        return DB::table('sm_classes')->where('school_year_id', $yearId)->where('name', $name)->exists();
    }

    public function homeroomTakenBy(int $teacherId, int $yearId, ?int $exceptClassId = null): ?object
    {
        return DB::table('sm_classes')
            ->where('school_year_id', $yearId)->where('homeroom_teacher_id', $teacherId)
            ->when($exceptClassId, fn ($q) => $q->where('id', '<>', $exceptClassId))
            ->first(['id', 'name']);
    }

    public function enrollmentCount(int $classId): int
    {
        return DB::table('sm_enrollments')->where('class_id', $classId)->count();
    }

    public function gradeCount(int $classId): int
    {
        return DB::table('sm_grades')->where('class_id', $classId)->count();
    }

    /* ------------------------------------------------------------------ */
    /*  Học sinh                                                           */
    /* ------------------------------------------------------------------ */

    public function students(int $classId, array $f = [])
    {
        $class = $this->rawFind($classId);

        return DB::table('sm_enrollments as e')
            ->join('sm_students as s', 's.id', '=', 'e.student_id')
            ->leftJoin('sm_conduct as cd', function ($j) {
                $j->on('cd.student_id', '=', 's.id')->on('cd.school_year_id', '=', 'e.school_year_id');
            })
            ->where('e.class_id', $classId)
            ->when(! empty($f['q']), function ($q) use ($f) {
                $kw = '%' . trim($f['q']) . '%';
                $q->where(fn ($w) => $w->where('s.full_name', 'like', $kw)->orWhere('s.code', 'like', $kw));
            })
            ->when(! empty($f['gender']), fn ($q) => $q->where('s.gender', $f['gender']))
            ->orderBy('s.full_name')
            ->get([
                's.id', 's.code', 's.full_name', 's.gender', 's.birth_date', 's.admission_year',
                'cd.year_result as conduct', 'e.id as enrollment_id',
            ])
            ->map(function ($r) use ($class) {
                $r->school_year_id = $class->school_year_id;
                return $r;
            });
    }

    /** Học sinh chưa được xếp lớp trong năm học (để thêm vào lớp). */
    public function availableStudents(int $yearId, ?string $kw, int $limit = 30)
    {
        return DB::table('sm_students as s')
            ->whereNotExists(function ($q) use ($yearId) {
                $q->select(DB::raw(1))->from('sm_enrollments as e')
                    ->whereColumn('e.student_id', 's.id')->where('e.school_year_id', $yearId);
            })
            ->when($kw, function ($q) use ($kw) {
                $like = '%' . trim($kw) . '%';
                $q->where(fn ($w) => $w->where('s.full_name', 'like', $like)->orWhere('s.code', 'like', $like));
            })
            ->orderBy('s.full_name')->limit($limit)
            ->get(['s.id', 's.code', 's.full_name', 's.gender', 's.birth_date']);
    }

    /** @return array<int,int> map student_id => class_id (đã xếp lớp trong năm) */
    public function enrolledMap(int $yearId, array $studentIds): array
    {
        return DB::table('sm_enrollments')->where('school_year_id', $yearId)
            ->whereIn('student_id', $studentIds)->pluck('class_id', 'student_id')->all();
    }

    public function insertEnrollments(array $rows): void
    {
        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('sm_enrollments')->insert($chunk);
        }
    }

    public function removeEnrollment(int $classId, int $studentId): int
    {
        return DB::table('sm_enrollments')->where('class_id', $classId)->where('student_id', $studentId)->delete();
    }

    public function studentGradeCountInClass(int $classId, int $studentId): int
    {
        return DB::table('sm_grades')->where('class_id', $classId)->where('student_id', $studentId)->count();
    }

    public function moveStudents(int $fromClass, int $toClass, int $yearId, array $studentIds): int
    {
        DB::table('sm_grades')->where('school_year_id', $yearId)->where('class_id', $fromClass)
            ->whereIn('student_id', $studentIds)->update(['class_id' => $toClass]);

        return DB::table('sm_enrollments')->where('class_id', $fromClass)->where('school_year_id', $yearId)
            ->whereIn('student_id', $studentIds)->update(['class_id' => $toClass]);
    }

    public function enrollmentsOfClass(int $classId)
    {
        return DB::table('sm_enrollments')->where('class_id', $classId)->get(['student_id']);
    }

    /* ------------------------------------------------------------------ */
    /*  Môn học & giáo viên bộ môn                                         */
    /* ------------------------------------------------------------------ */

    public function classSubjects(int $classId)
    {
        return DB::table('sm_class_subjects as cs')
            ->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')
            ->join('sm_teachers as t', 't.id', '=', 'cs.teacher_id')
            ->where('cs.class_id', $classId)
            ->orderBy('s.sort_order')
            ->get([
                'cs.id', 'cs.subject_id', 's.code as subject_code', 's.name as subject_name',
                's.periods_per_week', 'cs.teacher_id', 't.code as teacher_code', 't.full_name as teacher_name',
            ]);
    }

    public function findClassSubject(int $id): ?object
    {
        return DB::table('sm_class_subjects')->where('id', $id)->first();
    }

    public function upsertClassSubject(int $classId, int $subjectId, int $teacherId): void
    {
        $exists = DB::table('sm_class_subjects')->where('class_id', $classId)->where('subject_id', $subjectId)->first();
        if ($exists) {
            DB::table('sm_class_subjects')->where('id', $exists->id)->update(['teacher_id' => $teacherId]);
        } else {
            DB::table('sm_class_subjects')->insert(['class_id' => $classId, 'subject_id' => $subjectId, 'teacher_id' => $teacherId]);
        }
    }

    public function deleteClassSubject(int $classId, int $subjectId): void
    {
        DB::table('sm_class_subjects')->where('class_id', $classId)->where('subject_id', $subjectId)->delete();
    }

    public function classSubjectUsedInTimetable(int $classSubjectId): bool
    {
        return DB::table('sm_timetable')->where('class_subject_id', $classSubjectId)->exists();
    }

    public function copyClassSubjects(int $fromClass, int $toClass): int
    {
        $rows = DB::table('sm_class_subjects')->where('class_id', $fromClass)->get(['subject_id', 'teacher_id']);
        foreach ($rows as $r) {
            $this->upsertClassSubject($toClass, $r->subject_id, $r->teacher_id);
        }
        return $rows->count();
    }

    /* ------------------------------------------------------------------ */
    /*  Thời khóa biểu                                                     */
    /* ------------------------------------------------------------------ */

    public function timetable(int $classId)
    {
        return DB::table('sm_timetable as tt')
            ->join('sm_class_subjects as cs', 'cs.id', '=', 'tt.class_subject_id')
            ->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')
            ->join('sm_teachers as t', 't.id', '=', 'cs.teacher_id')
            ->where('tt.class_id', $classId)
            ->get([
                'tt.id', 'tt.weekday', 'tt.period', 'tt.class_subject_id',
                's.name as subject_name', 's.code as subject_code', 't.full_name as teacher_name', 'cs.teacher_id',
            ]);
    }

    /** Giáo viên đã có tiết ở lớp khác cùng thời điểm? */
    public function teacherConflict(int $teacherId, int $yearId, int $weekday, int $period, int $exceptClassId): ?object
    {
        return DB::table('sm_timetable as tt')
            ->join('sm_class_subjects as cs', 'cs.id', '=', 'tt.class_subject_id')
            ->join('sm_classes as c', 'c.id', '=', 'tt.class_id')
            ->where('cs.teacher_id', $teacherId)->where('c.school_year_id', $yearId)
            ->where('tt.weekday', $weekday)->where('tt.period', $period)
            ->where('tt.class_id', '<>', $exceptClassId)
            ->first(['c.name as class_name']);
    }

    public function setSlot(int $classId, int $weekday, int $period, ?int $classSubjectId): void
    {
        $q = DB::table('sm_timetable')->where('class_id', $classId)->where('weekday', $weekday)->where('period', $period);
        if ($classSubjectId === null) {
            $q->delete();
            return;
        }
        if ($q->exists()) {
            $q->update(['class_subject_id' => $classSubjectId]);
        } else {
            DB::table('sm_timetable')->insert([
                'class_id' => $classId, 'weekday' => $weekday, 'period' => $period, 'class_subject_id' => $classSubjectId,
            ]);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Nhật ký                                                            */
    /* ------------------------------------------------------------------ */

    public function log(?int $classId, ?int $userId, string $action, ?string $detail = null): void
    {
        DB::table('sm_class_activity')->insert([
            'class_id' => $classId ?? 0, 'user_id' => $userId, 'action' => $action,
            'detail' => $detail ? mb_substr($detail, 0, 500) : null, 'created_at' => now(),
        ]);
    }

    public function activity(int $classId, int $limit = 50)
    {
        return DB::table('sm_class_activity as a')
            ->leftJoin('users as u', 'u.id', '=', 'a.user_id')
            ->where('a.class_id', $classId)->orderByDesc('a.id')->limit($limit)
            ->get(['a.id', 'a.action', 'a.detail', 'a.created_at', 'u.name as user_name']);
    }

    /* ------------------------------------------------------------------ */
    /*  Tiện ích                                                           */
    /* ------------------------------------------------------------------ */

    public function teacherName(int $id): string
    {
        return (string) DB::table('sm_teachers')->where('id', $id)->value('full_name');
    }

    public function subjectName(int $id): string
    {
        return (string) DB::table('sm_subjects')->where('id', $id)->value('name');
    }

    public function yearLabel(int $id): string
    {
        return (string) DB::table('sm_school_years')->where('id', $id)->value('label');
    }

    public function transaction(callable $fn)
    {
        return DB::transaction($fn);
    }
}
