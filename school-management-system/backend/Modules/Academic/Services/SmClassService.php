<?php

namespace Modules\Academic\Services;

use Modules\Academic\Exceptions\ClassException;
use Modules\Academic\Repositories\SmClassRepository;

/** Nghiệp vụ quản lý lớp học THPT. */
class SmClassService
{
    public const WEEKDAYS = [2, 3, 4, 5, 6, 7];

    public function __construct(private SmClassRepository $repo) {}

    /* ---------------------------- Hiển thị ---------------------------- */

    public static function format(object $r): array
    {
        $count = (int) $r->student_count;
        $male = (int) $r->male_count;
        $cap = (int) ($r->capacity ?: 45);

        return [
            'id'                 => (int) $r->id,
            'name'               => $r->name,
            'grade'              => (int) $r->grade,
            'school_year_id'     => (int) $r->school_year_id,
            'school_year_label'  => $r->school_year_label,
            'homeroom_teacher'   => $r->homeroom_teacher_id ? [
                'id' => (int) $r->homeroom_teacher_id, 'code' => $r->homeroom_code, 'full_name' => $r->homeroom_name,
            ] : null,
            'room'               => $r->room,
            'capacity'           => $cap,
            'status'             => $r->status ?: 'active',
            'note'               => $r->note,
            'student_count'      => $count,
            'male_count'         => $male,
            'female_count'       => $count - $male,
            'fill_percent'       => $cap ? min(100, (int) round($count * 100 / $cap)) : 0,
        ];
    }

    public function meta(?int $yearId): array
    {
        $years = $this->repo->years();
        $current = $yearId ?: optional($years->firstWhere('is_current', 1))->id ?: optional($years->first())->id;

        return [
            'current_year_id' => $current,
            'school_years'    => $years,
            'grades'          => [10, 11, 12],
            'teachers'        => $this->repo->teachers($current),
            'subjects'        => $this->repo->subjects(),
            'periods'         => $this->repo->periods(),
            'weekdays'        => self::WEEKDAYS,
            'statuses'        => [
                ['value' => 'active', 'label' => 'Đang hoạt động'],
                ['value' => 'paused', 'label' => 'Tạm ngưng'],
                ['value' => 'closed', 'label' => 'Đã đóng'],
            ],
        ];
    }

    public function list(array $filters, int $perPage): array
    {
        $p = $this->repo->paginate($filters, $perPage);

        return [
            'items' => collect($p->items())->map(fn ($r) => self::format($r))->all(),
            'meta'  => [
                'current_page' => $p->currentPage(), 'last_page' => $p->lastPage(),
                'per_page' => $p->perPage(), 'total' => $p->total(),
            ],
        ];
    }

    public function stats(int $yearId): array
    {
        return $this->repo->stats($yearId);
    }

    public function show(int $id): array
    {
        return self::format($this->mustFind($id));
    }

    private function mustFind(int $id): object
    {
        return $this->repo->find($id) ?? throw new ClassException('Không tìm thấy lớp học.', 404);
    }

    /* ----------------------------- CRUD lớp --------------------------- */

    private function assertHomeroomFree(?int $teacherId, int $yearId, ?int $exceptClassId = null): void
    {
        if (! $teacherId) {
            return;
        }
        $taken = $this->repo->homeroomTakenBy($teacherId, $yearId, $exceptClassId);
        if ($taken) {
            throw new ClassException(sprintf(
                'GV %s đã là chủ nhiệm lớp %s trong năm học này.', $this->repo->teacherName($teacherId), $taken->name
            ));
        }
    }

    public function create(array $data, ?int $uid): array
    {
        $this->assertHomeroomFree($data['homeroom_teacher_id'] ?? null, (int) $data['school_year_id']);
        $id = $this->repo->insert($data);
        $this->repo->log($id, $uid, 'create', "Tạo lớp {$data['name']}");

        return $this->show($id);
    }

    public function update(int $id, array $data, ?int $uid): array
    {
        $old = $this->mustFind($id);
        $count = (int) $old->student_count;

        if ((int) $data['capacity'] < $count) {
            throw new ClassException("Sĩ số tối đa không thể nhỏ hơn số học sinh hiện có ($count).");
        }
        if ((int) $data['grade'] !== (int) $old->grade && $count > 0) {
            throw new ClassException('Không thể đổi khối của lớp đã có học sinh.');
        }
        $this->assertHomeroomFree($data['homeroom_teacher_id'] ?? null, (int) $old->school_year_id, $id);

        unset($data['school_year_id']); // không đổi năm học của lớp đã tạo
        $this->repo->update($id, $data);
        $this->repo->log($id, $uid, 'update', "Cập nhật thông tin lớp {$data['name']}");

        return $this->show($id);
    }

    public function delete(int $id, ?int $uid): void
    {
        $c = $this->mustFind($id);
        if ($c->student_count > 0) {
            throw new ClassException("Lớp {$c->name} còn {$c->student_count} học sinh. Hãy chuyển học sinh sang lớp khác trước khi xóa.", 409);
        }
        if ($this->repo->gradeCount($id) > 0) {
            throw new ClassException("Lớp {$c->name} đã có dữ liệu điểm nên không thể xóa. Hãy chuyển trạng thái sang 'Đã đóng'.", 409);
        }

        $this->repo->transaction(function () use ($id) {
            foreach ($this->repo->classSubjects($id) as $cs) {
                $this->repo->deleteClassSubject($id, $cs->subject_id);
            }
            $this->repo->delete($id);
        });
        $this->repo->log($id, $uid, 'delete', "Xóa lớp {$c->name}");
    }

    public function assignHomeroom(int $id, ?int $teacherId, ?int $uid): array
    {
        $c = $this->mustFind($id);
        $this->assertHomeroomFree($teacherId, (int) $c->school_year_id, $id);
        $this->repo->update($id, ['homeroom_teacher_id' => $teacherId]);
        $this->repo->log($id, $uid, 'homeroom', $teacherId
            ? 'Phân công GVCN: ' . $this->repo->teacherName($teacherId) : 'Gỡ giáo viên chủ nhiệm');

        return $this->show($id);
    }

    /** Tạo hàng loạt: 10A1..10A8 ... */
    public function bulkCreate(array $d, ?int $uid): array
    {
        $created = [];
        $skipped = [];
        $this->repo->transaction(function () use ($d, &$created, &$skipped) {
            for ($i = 0; $i < (int) $d['count']; $i++) {
                $name = $d['grade'] . $d['prefix'] . ((int) $d['start'] + $i);
                if ($this->repo->nameExists((int) $d['school_year_id'], $name)) {
                    $skipped[] = $name;
                    continue;
                }
                $this->repo->insert([
                    'school_year_id' => $d['school_year_id'], 'grade' => $d['grade'], 'name' => $name,
                    'capacity' => $d['capacity'], 'status' => 'active', 'room' => null, 'note' => null,
                ]);
                $created[] = $name;
            }
        });
        $this->repo->log(0, $uid, 'bulk_create', 'Tạo hàng loạt ' . count($created) . ' lớp khối ' . $d['grade']);

        return ['created' => $created, 'skipped' => $skipped];
    }

    /** Sao chép cơ cấu lớp từ năm học trước sang năm học mới (tùy chọn lên lớp học sinh). */
    public function cloneYear(array $d, ?int $uid): array
    {
        $from = (int) $d['from_year_id'];
        $to = (int) $d['to_year_id'];
        if ($from === $to) {
            throw new ClassException('Năm học nguồn và năm học đích phải khác nhau.');
        }
        $promote = (bool) ($d['promote'] ?? false);
        $copySubjects = (bool) ($d['copy_subjects'] ?? true);

        $res = ['classes_created' => 0, 'classes_skipped' => 0, 'students_moved' => 0, 'graduated' => 0];

        $this->repo->transaction(function () use ($from, $to, $promote, $copySubjects, &$res) {
            foreach ($this->repo->allForYear($from) as $c) {
                $newGrade = $promote ? $c->grade + 1 : $c->grade;
                if ($newGrade > 12) {
                    $res['graduated'] += (int) $c->student_count;
                    continue;
                }
                $newName = $promote ? preg_replace('/^\d+/', (string) $newGrade, $c->name) : $c->name;

                $existing = \Illuminate\Support\Facades\DB::table('sm_classes')
                    ->where('school_year_id', $to)->where('name', $newName)->value('id');

                if ($existing) {
                    $newId = (int) $existing;
                    $res['classes_skipped']++;
                } else {
                    $newId = $this->repo->insert([
                        'school_year_id' => $to, 'grade' => $newGrade, 'name' => $newName,
                        'room' => $c->room, 'capacity' => $c->capacity ?: 45, 'status' => 'active', 'note' => null,
                    ]);
                    $res['classes_created']++;
                    if ($copySubjects) {
                        $this->repo->copyClassSubjects((int) $c->id, $newId);
                    }
                }

                if ($promote) {
                    $ids = $this->repo->enrollmentsOfClass((int) $c->id)->pluck('student_id')->all();
                    if ($ids) {
                        $already = $this->repo->enrolledMap($to, $ids);
                        $rows = [];
                        foreach ($ids as $sid) {
                            if (! isset($already[$sid])) {
                                $rows[] = ['student_id' => $sid, 'school_year_id' => $to, 'class_id' => $newId];
                            }
                        }
                        $this->repo->insertEnrollments($rows);
                        $res['students_moved'] += count($rows);
                    }
                }
            }
        });

        $this->repo->log(0, $uid, 'clone_year', sprintf(
            'Sao chép từ %s sang %s: +%d lớp, %d học sinh', $this->repo->yearLabel($from), $this->repo->yearLabel($to),
            $res['classes_created'], $res['students_moved']
        ));

        return $res;
    }

    public function exportRows(int $yearId): array
    {
        $rows = [['Lớp', 'Khối', 'Năm học', 'GVCN', 'Phòng', 'Sĩ số', 'Tối đa', 'Nam', 'Nữ', 'Trạng thái']];
        $labels = ['active' => 'Đang hoạt động', 'paused' => 'Tạm ngưng', 'closed' => 'Đã đóng'];
        foreach ($this->repo->allForYear($yearId) as $r) {
            $f = self::format($r);
            $rows[] = [
                $f['name'], $f['grade'], $f['school_year_label'], $f['homeroom_teacher']['full_name'] ?? '',
                $f['room'] ?? '', $f['student_count'], $f['capacity'], $f['male_count'], $f['female_count'],
                $labels[$f['status']] ?? $f['status'],
            ];
        }
        return $rows;
    }

    /* ----------------------------- Học sinh --------------------------- */

    public function students(int $classId, array $filters): array
    {
        $this->mustFind($classId);
        return $this->repo->students($classId, $filters)->values()->all();
    }

    public function availableStudents(int $classId, ?string $kw): array
    {
        $c = $this->mustFind($classId);
        return $this->repo->availableStudents((int) $c->school_year_id, $kw)->all();
    }

    public function addStudents(int $classId, array $ids, ?int $uid): array
    {
        $c = $this->mustFind($classId);
        $ids = array_values(array_unique(array_map('intval', $ids)));

        return $this->repo->transaction(function () use ($c, $classId, $ids, $uid) {
            $enrolled = $this->repo->enrolledMap((int) $c->school_year_id, $ids);
            $toAdd = array_values(array_filter($ids, fn ($id) => ! isset($enrolled[$id])));

            $room = (int) $c->capacity - (int) $c->student_count;
            if (count($toAdd) > $room) {
                throw new ClassException("Lớp {$c->name} chỉ còn $room chỗ trống (sĩ số tối đa {$c->capacity}).");
            }

            $this->repo->insertEnrollments(array_map(fn ($sid) => [
                'student_id' => $sid, 'school_year_id' => $c->school_year_id, 'class_id' => $classId,
            ], $toAdd));

            if ($toAdd) {
                $this->repo->log($classId, $uid, 'add_students', 'Thêm ' . count($toAdd) . ' học sinh vào lớp');
            }

            return ['added' => count($toAdd), 'skipped' => count($ids) - count($toAdd)];
        });
    }

    public function removeStudent(int $classId, int $studentId, ?int $uid): void
    {
        $c = $this->mustFind($classId);
        if ($this->repo->studentGradeCountInClass($classId, $studentId) > 0) {
            throw new ClassException('Học sinh đã có điểm trong lớp này nên không thể xóa khỏi lớp. Hãy dùng chức năng chuyển lớp.', 409);
        }
        if (! $this->repo->removeEnrollment($classId, $studentId)) {
            throw new ClassException('Học sinh không thuộc lớp này.', 404);
        }
        $this->repo->log($classId, $uid, 'remove_student', "Xóa học sinh #$studentId khỏi lớp {$c->name}");
    }

    public function transferStudents(int $classId, array $ids, int $targetId, ?int $uid): array
    {
        $from = $this->mustFind($classId);
        $to = $this->mustFind($targetId);

        if ((int) $from->id === (int) $to->id) {
            throw new ClassException('Lớp đích phải khác lớp hiện tại.');
        }
        if ((int) $from->school_year_id !== (int) $to->school_year_id) {
            throw new ClassException('Chỉ chuyển lớp trong cùng một năm học.');
        }
        $room = (int) $to->capacity - (int) $to->student_count;
        if (count($ids) > $room) {
            throw new ClassException("Lớp {$to->name} chỉ còn $room chỗ trống.");
        }

        $moved = $this->repo->transaction(
            fn () => $this->repo->moveStudents($classId, $targetId, (int) $from->school_year_id, $ids)
        );
        $this->repo->log($classId, $uid, 'transfer', "Chuyển $moved học sinh từ {$from->name} sang {$to->name}");
        $this->repo->log($targetId, $uid, 'transfer_in', "Nhận $moved học sinh từ lớp {$from->name}");

        return ['moved' => $moved];
    }

    /* ------------------------- Môn học / GV bộ môn -------------------- */

    public function subjects(int $classId): array
    {
        $this->mustFind($classId);
        return $this->repo->classSubjects($classId)->values()->all();
    }

    public function saveSubjects(int $classId, array $assignments, ?int $uid): array
    {
        $c = $this->mustFind($classId);

        $this->repo->transaction(function () use ($classId, $assignments) {
            $incoming = collect($assignments)->keyBy('subject_id');

            foreach ($this->repo->classSubjects($classId) as $cur) {
                if (! $incoming->has($cur->subject_id) && $this->repo->classSubjectUsedInTimetable((int) $cur->id)) {
                    throw new ClassException("Môn {$cur->subject_name} đang được xếp trong thời khóa biểu, hãy gỡ khỏi TKB trước.");
                }
                if (! $incoming->has($cur->subject_id)) {
                    $this->repo->deleteClassSubject($classId, (int) $cur->subject_id);
                }
            }
            foreach ($incoming as $a) {
                $this->repo->upsertClassSubject($classId, (int) $a['subject_id'], (int) $a['teacher_id']);
            }
        });

        $this->repo->log($classId, $uid, 'subjects', "Cập nhật phân công môn học lớp {$c->name}");

        return $this->subjects($classId);
    }

    /* ---------------------------- Thời khóa biểu ---------------------- */

    public function timetable(int $classId): array
    {
        $this->mustFind($classId);

        return [
            'slots'    => $this->repo->timetable($classId)->values()->all(),
            'subjects' => $this->repo->classSubjects($classId)->values()->all(),
            'periods'  => $this->repo->periods()->values()->all(),
            'weekdays' => self::WEEKDAYS,
        ];
    }

    public function saveTimetable(int $classId, array $slots, ?int $uid): array
    {
        $c = $this->mustFind($classId);

        $this->repo->transaction(function () use ($c, $classId, $slots) {
            foreach ($slots as $s) {
                $csId = $s['class_subject_id'] ?? null;
                if ($csId) {
                    $cs = $this->repo->findClassSubject((int) $csId);
                    if (! $cs || (int) $cs->class_id !== $classId) {
                        throw new ClassException('Môn học không thuộc lớp này.');
                    }
                    $conflict = $this->repo->teacherConflict(
                        (int) $cs->teacher_id, (int) $c->school_year_id, (int) $s['weekday'], (int) $s['period'], $classId
                    );
                    if ($conflict) {
                        throw new ClassException(sprintf(
                            'GV %s đã có tiết dạy lớp %s vào Thứ %d tiết %d (trùng lịch).',
                            $this->repo->teacherName((int) $cs->teacher_id), $conflict->class_name, $s['weekday'], $s['period']
                        ));
                    }
                }
                $this->repo->setSlot($classId, (int) $s['weekday'], (int) $s['period'], $csId ? (int) $csId : null);
            }
        });

        $this->repo->log($classId, $uid, 'timetable', "Cập nhật thời khóa biểu lớp {$c->name}");

        return $this->timetable($classId);
    }

    public function activity(int $classId): array
    {
        $this->mustFind($classId);
        return $this->repo->activity($classId)->values()->all();
    }
}
