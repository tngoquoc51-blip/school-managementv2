<?php

namespace Modules\HrSeating\Services;

use Illuminate\Support\Facades\DB;
use Modules\HrSeating\Support\Hr;

/**
 * Xác định "tôi là ai, lớp chủ nhiệm của tôi là lớp nào" từ tài khoản nhân viên.
 * Tự dò cấu trúc bảng thật (sm_staff_accounts / sm_teachers) nên chạy được với nhiều cách nối khác nhau.
 */
class HrContextService
{
    private static ?array $cols = null;

    private static function columns(string $table): array
    {
        if (self::$cols === null) {
            self::$cols = [];
        }
        if (! isset(self::$cols[$table])) {
            $rows = DB::select('SELECT COLUMN_NAME AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [$table]);
            self::$cols[$table] = array_map(fn ($r) => strtolower($r->c), $rows);
        }

        return self::$cols[$table];
    }

    /** @return array{0:?int,1:?string} [teacher_id, cách nhận ra] */
    public function teacherOf(object $staff): array
    {
        $sc = self::columns('sm_staff_accounts');
        $tc = self::columns('sm_teachers');

        if (in_array('teacher_id', $sc, true)) {
            $r = DB::selectOne('SELECT teacher_id AS t FROM sm_staff_accounts WHERE id = ?', [$staff->id]);
            if ($r && $r->t) {
                return [(int) $r->t, 'sm_staff_accounts.teacher_id'];
            }
        }
        foreach (['staff_id', 'account_id', 'staff_account_id'] as $col) {
            if (in_array($col, $tc, true)) {
                $r = DB::selectOne("SELECT id FROM sm_teachers WHERE `$col` = ? LIMIT 1", [$staff->id]);
                if ($r) {
                    return [(int) $r->id, "sm_teachers.$col"];
                }
            }
        }
        if (in_array('username', $tc, true)) {
            $r = DB::selectOne('SELECT id FROM sm_teachers WHERE LOWER(username) = LOWER(?) LIMIT 1', [$staff->username]);
            if ($r) {
                return [(int) $r->id, 'sm_teachers.username'];
            }
        }
        if (in_array('code', $tc, true)) {
            $r = DB::selectOne('SELECT id FROM sm_teachers WHERE LOWER(code) = LOWER(?) LIMIT 1', [$staff->username]);
            if ($r) {
                return [(int) $r->id, 'sm_teachers.code = tên đăng nhập'];
            }
        }
        $rows = DB::select('SELECT id FROM sm_teachers WHERE full_name = ?', [$staff->full_name]);
        if (count($rows) === 1) {
            return [(int) $rows[0]->id, 'sm_teachers.full_name'];
        }

        return [null, null];
    }

    /**
     * Dựng ngữ cảnh cho mọi yêu cầu. Ném DomainException (kèm gợi ý) nếu tài khoản không có lớp nào để làm việc.
     */
    public function build(object $staff, ?int $requestedClassId, ?int $semester = null): array
    {
        $year = Hr::year();
        $manager = in_array($staff->role, Hr::MANAGER_ROLES, true);
        [$teacherId, $via] = $this->teacherOf($staff);

        if ($manager) {
            $classes = DB::select(
                'SELECT c.id, c.name, c.grade, t.full_name AS homeroom FROM sm_classes c LEFT JOIN sm_teachers t ON t.id = c.homeroom_teacher_id WHERE c.school_year_id = ? ORDER BY c.grade, c.name', [$year]);
        } else {
            if (! $teacherId) {
                throw new \DomainException("Không nhận ra tài khoản \"{$staff->username}\" (vai trò {$staff->role}) là giáo viên nào. Hãy liên kết tài khoản với giáo viên trong bảng sm_teachers.");
            }
            $classes = DB::select('SELECT c.id, c.name, c.grade FROM sm_classes c WHERE c.homeroom_teacher_id = ? AND c.school_year_id = ? ORDER BY c.grade, c.name', [$teacherId, $year]);
            if (! $classes) {
                throw new \DomainException('Giáo viên chưa được phân công chủ nhiệm lớp nào trong năm học hiện tại.');
            }
        }

        $classId = $requestedClassId;
        $ids = array_map(fn ($c) => (int) $c->id, $classes);
        if ($classId && ! in_array($classId, $ids, true)) {
            throw new \DomainException('Bạn không có quyền với lớp này.');
        }
        $classId = $classId ?: ($ids[0] ?? 0);
        if (! $classId) {
            throw new \DomainException('Năm học hiện tại chưa có lớp nào.');
        }
        $current = null;
        foreach ($classes as $c) {
            if ((int) $c->id === $classId) {
                $current = $c;
            }
        }

        return [
            'staff' => ['id' => (int) $staff->id, 'username' => $staff->username, 'name' => $staff->full_name, 'role' => $staff->role],
            'actor' => ['id' => (int) $staff->id, 'name' => $staff->full_name],
            'is_manager' => $manager,
            'teacher_id' => $teacherId,
            'resolved_by' => $via ?: ($manager ? 'vai trò quản lý' : null),
            'year_id' => $year,
            'semester' => Hr::semester($semester),
            'class_id' => $classId,
            'class' => ['id' => (int) $current->id, 'name' => $current->name, 'grade' => (int) $current->grade],
            'classes' => array_map(fn ($c) => ['id' => (int) $c->id, 'name' => $c->name, 'grade' => (int) $c->grade], $classes),
        ];
    }
}
