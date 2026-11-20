<?php

namespace Modules\Roster\Services;

use Illuminate\Support\Facades\DB;
use Modules\Catalog\Exceptions\CatalogException;
use Modules\Catalog\Services\AuditService;

class ClassService
{
    public function __construct(private AuditService $audit, private RosterSupport $support) {}

    private function base(int $yearId)
    {
        return DB::table('sm_classes as c')->leftJoin('sm_teachers as t', 't.id', '=', 'c.homeroom_teacher_id')->where('c.school_year_id', $yearId)
            ->selectRaw("c.id, c.school_year_id, c.grade, c.name, c.homeroom_teacher_id, t.full_name as homeroom_name, t.code as homeroom_code,
                (SELECT COUNT(*) FROM sm_enrollments e WHERE e.class_id = c.id) as students,
                (SELECT COUNT(*) FROM sm_enrollments e JOIN sm_students s ON s.id = e.student_id WHERE e.class_id = c.id AND s.gender = 'Nam') as male,
                (SELECT COUNT(*) FROM sm_class_subjects cs WHERE cs.class_id = c.id) as subjects");
    }

    private function present(object $c): array
    {
        $n = (int) $c->students;

        return [
            'id' => (int) $c->id, 'school_year_id' => (int) $c->school_year_id, 'grade' => (int) $c->grade, 'name' => $c->name,
            'homeroom_teacher_id' => $c->homeroom_teacher_id ? (int) $c->homeroom_teacher_id : null,
            'homeroom_name' => $c->homeroom_name, 'homeroom_code' => $c->homeroom_code,
            'students' => $n, 'male' => (int) $c->male, 'female' => $n - (int) $c->male, 'subjects' => (int) $c->subjects,
            'capacity' => RosterSupport::CLASS_MAX,
            'size_state' => $n > RosterSupport::CLASS_MAX ? 'over' : ($n === 0 ? 'empty' : ($n < RosterSupport::CLASS_MIN ? 'under' : 'ok')),
        ];
    }

    public function list(int $yearId, array $f): array
    {
        $q = $this->base($yearId);
        if (! empty($f['grade'])) {
            $q->where('c.grade', (int) $f['grade']);
        }
        if (! empty($f['search'])) {
            $like = '%' . addcslashes(trim((string) $f['search']), '%_\\') . '%';
            $q->where(fn ($w) => $w->where('c.name', 'like', $like)->orWhere('t.full_name', 'like', $like));
        }
        if (($f['filter'] ?? '') === 'no_homeroom') {
            $q->whereNull('c.homeroom_teacher_id');
        }
        $rows = $q->orderBy('c.grade')->orderBy('c.name')->get()->map(fn ($c) => $this->present($c));

        $filter = $f['filter'] ?? '';
        if (in_array($filter, ['over', 'under', 'empty'], true)) {
            $rows = $rows->filter(fn ($r) => $r['size_state'] === $filter);
        }

        return $rows->values()->all();
    }

    private function find(int $id): object
    {
        $c = DB::table('sm_classes')->where('id', $id)->first();
        if (! $c) {
            throw new CatalogException('Không tìm thấy lớp học.', 404);
        }

        return $c;
    }

    public function show(int $id): array
    {
        $c = $this->find($id);
        $info = $this->present($this->base((int) $c->school_year_id)->where('c.id', $id)->first());
        $info['year_label'] = DB::table('sm_school_years')->where('id', $c->school_year_id)->value('label');

        $students = DB::table('sm_enrollments as e')->join('sm_students as s', 's.id', '=', 'e.student_id')->leftJoin('sm_accounts as a', 'a.student_id', '=', 's.id')
            ->where('e.class_id', $id)->orderBy('s.full_name')
            ->selectRaw("s.id, s.code, s.full_name, s.gender, s.birth_date, a.id as account_id,
                CASE WHEN a.id IS NULL THEN NULL WHEN a.locked_until > NOW() THEN 'locked' ELSE a.status END as account_status")->get()
            ->map(fn ($s) => (array) $s)->all();

        $subjects = DB::table('sm_class_subjects as cs')->join('sm_subjects as sub', 'sub.id', '=', 'cs.subject_id')->leftJoin('sm_teachers as t', 't.id', '=', 'cs.teacher_id')
            ->where('cs.class_id', $id)->orderBy('sub.sort_order')
            ->selectRaw('cs.id, sub.id as subject_id, sub.code, sub.name, sub.periods_per_week, t.id as teacher_id, t.full_name as teacher_name, (SELECT COUNT(*) FROM sm_timetable tt WHERE tt.class_subject_id = cs.id) as slots')
            ->get()->map(fn ($s) => (array) $s)->all();

        return ['class' => $info, 'students' => $students, 'subjects' => $subjects];
    }

    private function checkHomeroom(int $yearId, ?int $teacherId, ?int $exceptClass): void
    {
        if (! $teacherId) {
            return;
        }
        if (! DB::table('sm_teachers')->where('id', $teacherId)->exists()) {
            throw new CatalogException('Giáo viên không tồn tại.', 422);
        }
        $other = DB::table('sm_classes')->where('school_year_id', $yearId)->where('homeroom_teacher_id', $teacherId)
            ->when($exceptClass, fn ($q) => $q->where('id', '!=', $exceptClass))->value('name');
        if ($other) {
            throw new CatalogException("Giáo viên này đang chủ nhiệm lớp $other trong năm học này.", 409);
        }
    }

    public function create(array $d): array
    {
        $year = $this->support->resolveYear((int) $d['school_year_id']);
        $name = trim($d['name']);
        if (DB::table('sm_classes')->where('school_year_id', $year)->where('name', $name)->exists()) {
            throw new CatalogException("Lớp $name đã tồn tại trong năm học này.", 422, ['name' => ['Tên lớp đã tồn tại.']]);
        }
        $this->checkHomeroom($year, $d['homeroom_teacher_id'] ?? null, null);

        $id = DB::table('sm_classes')->insertGetId(['school_year_id' => $year, 'grade' => $d['grade'], 'name' => $name, 'homeroom_teacher_id' => $d['homeroom_teacher_id'] ?? null]);
        $this->audit->record('class', $id, "Lớp $name", 'create', null, ['name' => $name, 'grade' => $d['grade'], 'homeroom_teacher_id' => $d['homeroom_teacher_id'] ?? null]);

        return $this->show($id);
    }

    public function update(int $id, array $d): array
    {
        $c = $this->find($id);
        $name = trim($d['name']);
        if (DB::table('sm_classes')->where('school_year_id', $c->school_year_id)->where('name', $name)->where('id', '!=', $id)->exists()) {
            throw new CatalogException("Lớp $name đã tồn tại trong năm học này.", 422, ['name' => ['Tên lớp đã tồn tại.']]);
        }
        $this->checkHomeroom((int) $c->school_year_id, $d['homeroom_teacher_id'] ?? null, $id);

        $new = ['grade' => $d['grade'], 'name' => $name, 'homeroom_teacher_id' => $d['homeroom_teacher_id'] ?? null];
        $before = ['grade' => $c->grade, 'name' => $c->name, 'homeroom_teacher_id' => $c->homeroom_teacher_id];
        DB::table('sm_classes')->where('id', $id)->update($new);
        $this->audit->record('class', $id, "Lớp $name", 'update', $before, $new);

        return $this->show($id);
    }

    public function delete(int $id): void
    {
        $c = $this->find($id);
        $uses = [
            'học sinh' => DB::table('sm_enrollments')->where('class_id', $id)->count(),
            'phân công môn' => DB::table('sm_class_subjects')->where('class_id', $id)->count(),
            'tiết thời khóa biểu' => DB::table('sm_timetable')->where('class_id', $id)->count(),
            'bản ghi điểm' => DB::table('sm_grades')->where('class_id', $id)->count(),
        ];
        $used = array_filter($uses);
        if ($used) {
            $txt = implode(', ', array_map(fn ($k, $v) => "$v $k", array_keys($used), $used));
            throw new CatalogException("Không thể xóa lớp {$c->name} vì còn $txt.", 409);
        }
        DB::table('sm_classes')->where('id', $id)->delete();
        $this->audit->record('class', $id, "Lớp {$c->name}", 'remove', ['name' => $c->name, 'grade' => $c->grade], null);
    }

    /** Gán / đổi giáo viên bộ môn của lớp. */
    public function setSubjectTeacher(int $classId, int $subjectId, int $teacherId): array
    {
        $c = $this->find($classId);
        if (! DB::table('sm_subjects')->where('id', $subjectId)->exists() || ! DB::table('sm_teachers')->where('id', $teacherId)->exists()) {
            throw new CatalogException('Môn học hoặc giáo viên không tồn tại.', 422);
        }
        $row = DB::table('sm_class_subjects')->where('class_id', $classId)->where('subject_id', $subjectId)->first();
        $oldTeacher = $row?->teacher_id;
        if ($row) {
            DB::table('sm_class_subjects')->where('id', $row->id)->update(['teacher_id' => $teacherId]);
        } else {
            DB::table('sm_class_subjects')->insert(['class_id' => $classId, 'subject_id' => $subjectId, 'teacher_id' => $teacherId]);
        }
        $this->audit->record('class', $classId, "Lớp {$c->name}", 'update', ['subject_id' => $subjectId, 'teacher_id' => $oldTeacher], ['subject_id' => $subjectId, 'teacher_id' => $teacherId]);

        return $this->show($classId);
    }

    public function removeSubject(int $classId, int $subjectId): array
    {
        $c = $this->find($classId);
        $row = DB::table('sm_class_subjects')->where('class_id', $classId)->where('subject_id', $subjectId)->first();
        if (! $row) {
            throw new CatalogException('Lớp chưa có môn này.', 404);
        }
        if (DB::table('sm_timetable')->where('class_subject_id', $row->id)->exists()) {
            throw new CatalogException('Môn này đang được xếp trong thời khóa biểu, hãy gỡ khỏi thời khóa biểu trước.', 409);
        }
        DB::table('sm_class_subjects')->where('id', $row->id)->delete();
        $this->audit->record('class', $classId, "Lớp {$c->name}", 'update', ['subject_id' => $subjectId, 'teacher_id' => $row->teacher_id], ['subject_id' => null]);

        return $this->show($classId);
    }

    public function exportRoster(int $classId): array
    {
        $d = $this->show($classId);

        return ['name' => $d['class']['name'], 'rows' => $d['students']];
    }
}
