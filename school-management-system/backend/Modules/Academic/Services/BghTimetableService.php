<?php

namespace Modules\Academic\Services;

use Illuminate\Support\Facades\DB;
use Modules\Academic\Support\Bgh;

/** Thời khóa biểu: xem theo lớp / giáo viên, phát hiện trùng tiết, hoán đổi tiết có kiểm tra xung đột. */
class BghTimetableService
{
    public function conflicts(int $year): array
    {
        return DB::select(
            "SELECT cs.teacher_id, t.full_name AS teacher, tt.weekday, tt.period, COUNT(*) AS n,
                    GROUP_CONCAT(c.name ORDER BY c.name SEPARATOR ', ') AS classes
             FROM sm_timetable tt
             JOIN sm_classes c ON c.id = tt.class_id AND c.school_year_id = ?
             JOIN sm_class_subjects cs ON cs.id = tt.class_subject_id
             JOIN sm_teachers t ON t.id = cs.teacher_id
             GROUP BY cs.teacher_id, t.full_name, tt.weekday, tt.period HAVING COUNT(*) > 1
             ORDER BY tt.weekday, tt.period", [$year]);
    }

    public function grid(int $classId): array
    {
        $class = DB::selectOne('SELECT id, name, grade, school_year_id FROM sm_classes WHERE id = ?', [$classId]);
        if (! $class) {
            throw new \DomainException('Không tìm thấy lớp.');
        }
        $slots = DB::select(
            'SELECT tt.id, tt.weekday, tt.period, cs.id AS class_subject_id, s.id AS subject_id, s.code, s.name AS subject, t.id AS teacher_id, t.full_name AS teacher
             FROM sm_timetable tt JOIN sm_class_subjects cs ON cs.id = tt.class_subject_id
             JOIN sm_subjects s ON s.id = cs.subject_id JOIN sm_teachers t ON t.id = cs.teacher_id
             WHERE tt.class_id = ? ORDER BY tt.weekday, tt.period', [$classId]);

        $bad = [];
        foreach ($this->conflicts((int) $class->school_year_id) as $c) {
            $bad[$c->teacher_id . '|' . $c->weekday . '|' . $c->period] = true;
        }
        foreach ($slots as $s) {
            $s->conflict = isset($bad[$s->teacher_id . '|' . $s->weekday . '|' . $s->period]);
        }

        return [
            'class' => $class,
            'periods' => DB::select('SELECT id, start_time, end_time FROM sm_periods ORDER BY id'),
            'slots' => $slots,
        ];
    }

    public function teacherSchedule(int $teacherId): array
    {
        return DB::select(
            'SELECT tt.weekday, tt.period, c.name AS class_name, s.name AS subject, s.code
             FROM sm_timetable tt JOIN sm_class_subjects cs ON cs.id = tt.class_subject_id
             JOIN sm_classes c ON c.id = tt.class_id JOIN sm_subjects s ON s.id = cs.subject_id
             WHERE cs.teacher_id = ? AND c.school_year_id = (SELECT id FROM sm_school_years WHERE is_current = 1 ORDER BY id DESC LIMIT 1)
             ORDER BY tt.weekday, tt.period', [$teacherId]);
    }

    /** Hoán đổi hai tiết trong cùng một lớp; từ chối nếu làm giáo viên bị trùng lịch lớp khác. */
    public function swap(int $classId, array $a, array $b, array $actor): array
    {
        foreach ([$a, $b] as $p) {
            if (($p['weekday'] ?? 0) < 2 || ($p['weekday'] ?? 0) > 7 || ($p['period'] ?? 0) < 1 || ($p['period'] ?? 0) > 5) {
                throw new \DomainException('Vị trí tiết không hợp lệ.');
            }
        }
        if ($a['weekday'] === $b['weekday'] && $a['period'] === $b['period']) {
            throw new \DomainException('Hãy chọn hai tiết khác nhau.');
        }

        return DB::transaction(function () use ($classId, $a, $b, $actor) {
            $find = fn (array $p) => DB::selectOne(
                'SELECT tt.id, tt.class_subject_id, cs.teacher_id, s.name AS subject, t.full_name AS teacher
                 FROM sm_timetable tt JOIN sm_class_subjects cs ON cs.id = tt.class_subject_id
                 JOIN sm_subjects s ON s.id = cs.subject_id JOIN sm_teachers t ON t.id = cs.teacher_id
                 WHERE tt.class_id = ? AND tt.weekday = ? AND tt.period = ? FOR UPDATE', [$classId, $p['weekday'], $p['period']]);
            $ra = $find($a);
            $rb = $find($b);
            if (! $ra && ! $rb) {
                throw new \DomainException('Cả hai ô đều trống.');
            }

            // Kiểm tra giáo viên của tiết chuyển đến vị trí mới có bị trùng lớp khác không.
            $errors = [];
            $check = function ($row, array $to) use ($classId, &$errors) {
                if (! $row) {
                    return;
                }
                $busy = DB::selectOne(
                    'SELECT c.name FROM sm_timetable tt JOIN sm_class_subjects cs ON cs.id = tt.class_subject_id
                     JOIN sm_classes c ON c.id = tt.class_id
                     WHERE cs.teacher_id = ? AND tt.weekday = ? AND tt.period = ? AND tt.class_id <> ?
                       AND c.school_year_id = (SELECT school_year_id FROM sm_classes WHERE id = ?) LIMIT 1',
                    [$row->teacher_id, $to['weekday'], $to['period'], $classId, $classId]);
                if ($busy) {
                    $errors[] = "{$row->teacher} đã có tiết dạy lớp {$busy->name} vào Thứ {$to['weekday']} tiết {$to['period']}.";
                }
            };
            $check($ra, $b);
            $check($rb, $a);
            if ($errors) {
                throw new \DomainException(implode(' ', $errors));
            }

            foreach ([$ra, $rb] as $r) {
                if ($r) {
                    DB::delete('DELETE FROM sm_timetable WHERE id = ?', [$r->id]);
                }
            }
            if ($ra) {
                DB::insert('INSERT INTO sm_timetable (class_id, weekday, period, class_subject_id) VALUES (?,?,?,?)', [$classId, $b['weekday'], $b['period'], $ra->class_subject_id]);
            }
            if ($rb) {
                DB::insert('INSERT INTO sm_timetable (class_id, weekday, period, class_subject_id) VALUES (?,?,?,?)', [$classId, $a['weekday'], $a['period'], $rb->class_subject_id]);
            }
            Bgh::audit($actor, 'timetable.swap', "Lớp #$classId: T{$a['weekday']}/{$a['period']} ⇄ T{$b['weekday']}/{$b['period']}");

            return $this->grid($classId);
        });
    }
}
