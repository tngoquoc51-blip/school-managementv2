<?php

namespace App\Support;

use PDO;

/**
 * Dữ liệu cho khu Giáo vụ / Ban giám hiệu (API /api/gv/*).
 * PDO + SQL chuẩn, dùng chung các bảng sm_* với cổng học sinh.
 */
class AcademicRepo
{
    public const TOKEN_HOURS = 12;
    public const MAX_FAILS = 5;
    public const LOCK_MINUTES = 10;
    public const DEFAULT_PASSWORD = '123456';

    public const ROLES = [
        'academic' => 'Giáo vụ',
        'principal' => 'Hiệu trưởng',
        'vice_principal' => 'Phó hiệu trưởng',
        'super_admin' => 'Quản trị hệ thống',
    ];

    private const WEEKDAY = [2 => 'Thứ Hai', 3 => 'Thứ Ba', 4 => 'Thứ Tư', 5 => 'Thứ Năm', 6 => 'Thứ Sáu', 7 => 'Thứ Bảy', 8 => 'Chủ nhật'];

    /** Cột trong sm_student_profiles được phép sửa + độ dài tối đa */
    private const PROFILE_COLS = [
        'ethnicity' => 30, 'religion' => 30, 'birth_place' => 80, 'hometown' => 80, 'permanent_address' => 200, 'current_address' => 200,
        'phone' => 15, 'father_name' => 80, 'father_job' => 60, 'father_phone' => 15, 'mother_name' => 80, 'mother_job' => 60, 'mother_phone' => 15,
        'guardian_name' => 80, 'guardian_relation' => 30, 'guardian_phone' => 15, 'emergency_name' => 80, 'emergency_relation' => 30, 'emergency_phone' => 15,
        'blood_type' => 3, 'health_note' => 255,
    ];
    private const PHONE_COLS = ['phone', 'father_phone', 'mother_phone', 'guardian_phone', 'emergency_phone'];

    /** @var callable */
    private $clock;

    public function __construct(private PDO $pdo, ?callable $clock = null)
    {
        $this->clock = $clock ?? fn () => time();
    }

    /* ================================================================== tiện ích */

    private function now(): int
    {
        return (int) ($this->clock)();
    }

    private function ts(int $t): string
    {
        return date('Y-m-d H:i:s', $t);
    }

    /** @return array<int,array<string,mixed>> */
    private function all(string $sql, array $p = []): array
    {
        $st = $this->pdo->prepare($sql);
        $st->execute($p);
        return $st->fetchAll(PDO::FETCH_ASSOC);
    }

    /** @return array<string,mixed>|null */
    private function one(string $sql, array $p = []): ?array
    {
        return $this->all($sql, $p)[0] ?? null;
    }

    private function run(string $sql, array $p = []): int
    {
        $st = $this->pdo->prepare($sql);
        $st->execute($p);
        return $st->rowCount();
    }

    private static function dmy(?string $d): ?string
    {
        if (!$d) {
            return null;
        }
        $t = strtotime(substr($d, 0, 10));
        return $t ? date('d/m/Y', $t) : $d;
    }

    private static function classify(?float $avg): ?string
    {
        if ($avg === null) {
            return null;
        }
        return $avg >= 8 ? 'Giỏi' : ($avg >= 6.5 ? 'Khá' : ($avg >= 5 ? 'Trung bình' : ($avg >= 3.5 ? 'Yếu' : 'Kém')));
    }

    /** Khóa sắp xếp tên tiếng Việt: theo TÊN (từ cuối) rồi họ + đệm, bỏ dấu. */
    private static function viKey(string $name): string
    {
        static $map = null;
        if ($map === null) {
            $from = 'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ';
            $to = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';
            $f = preg_split('//u', $from, -1, PREG_SPLIT_NO_EMPTY);
            $t = str_split($to);
            $map = array_combine($f, $t);
        }
        $n = mb_strtolower(trim($name));
        $n = strtr($n, $map);
        $w = preg_split('/\s+/', $n);
        $last = array_pop($w);
        return $last . ' ' . implode(' ', $w);
    }

    /** @param array<int,array<string,mixed>> $rows */
    private static function sortByName(array $rows, string $key = 'full_name'): array
    {
        usort($rows, fn ($a, $b) => strcmp(self::viKey((string) $a[$key]), self::viKey((string) $b[$key])));
        return $rows;
    }

    /** @return array<string,mixed> */
    private function currentYear(): array
    {
        return $this->one('SELECT id, label, start_date, end_date FROM sm_school_years WHERE is_current = 1')
            ?? $this->one('SELECT id, label, start_date, end_date FROM sm_school_years ORDER BY start_date DESC')
            ?? ['id' => 0, 'label' => '—'];
    }

    /** Điểm TB học kỳ / năm của từng học sinh (các môn tính điểm). @return array<int,array<string,mixed>> */
    private function yearAverages(int $yearId, ?int $classId = null): array
    {
        $sql = 'SELECT g.student_id AS sid, g.semester AS sem, AVG(g.tbm) AS a FROM sm_grades g JOIN sm_subjects sj ON sj.id = g.subject_id
                 WHERE g.school_year_id = ? AND sj.kind <> ? AND g.tbm IS NOT NULL';
        $p = [$yearId, 'pass'];
        if ($classId) {
            $sql .= ' AND g.class_id = ?';
            $p[] = $classId;
        }
        $sql .= ' GROUP BY g.student_id, g.semester';
        $tmp = [];
        foreach ($this->all($sql, $p) as $r) {
            $tmp[(int) $r['sid']][(int) $r['sem']] = (float) $r['a'];
        }
        $conduct = [];
        foreach ($this->all('SELECT student_id, hk1, hk2, year_result FROM sm_conduct WHERE school_year_id = ?', [$yearId]) as $c) {
            $conduct[(int) $c['student_id']] = $c;
        }
        $out = [];
        foreach ($tmp as $sid => $s) {
            $h1 = isset($s[1]) ? round($s[1], 2) : null;
            $h2 = isset($s[2]) ? round($s[2], 2) : null;
            $avg = $h1 !== null && $h2 !== null ? round(($h1 + 2 * $h2) / 3, 2) : ($h1 ?? $h2);
            $out[$sid] = ['hk1' => $h1, 'hk2' => $h2, 'avg' => $avg, 'rank' => self::classify($avg)];
        }
        foreach ($conduct as $sid => $c) {
            $out[$sid] = ($out[$sid] ?? ['hk1' => null, 'hk2' => null, 'avg' => null, 'rank' => null]) + ['conduct' => $c['year_result'], 'conduct_hk1' => $c['hk1'], 'conduct_hk2' => $c['hk2']];
        }
        return $out;
    }

    /* ================================================================== đăng nhập nhân viên */

    /** @return array<string,mixed> */
    public function login(string $username, string $password): array
    {
                $username = strtolower(trim($username));

                // Cho phép: giaovu  hoặc  giaovu@thpt.edu.vn
                $candidates = [$username];
                if (str_contains($username, '@')) {
                    $candidates[] = explode('@', $username, 2)[0];
                } else {
                    $candidates[] = $username . '@thpt.edu.vn';
                }
                $candidates = array_values(array_unique($candidates));

                $a = null;
                foreach ($candidates as $cand) {
                    $a = $this->one(
                        'SELECT id, username, full_name, role, password_hash, status, failed_attempts, locked_until
                         FROM sm_staff_accounts WHERE LOWER(username) = ?',
                        [$cand]
                    );
                    if ($a) {
                        break;
                    }
                }

                if (!$a) {
                    password_verify($password, '$2y$10$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPsA.ztMG');
                    return ['ok' => false, 'status' => 401, 'message' => 'Sai tên đăng nhập hoặc mật khẩu.'];
                }
        if ($a['status'] !== 'active') {
            return ['ok' => false, 'status' => 403, 'message' => 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.'];
        }
        $now = $this->now();
        if (!empty($a['locked_until']) && strtotime($a['locked_until']) > $now) {
            $m = (int) ceil((strtotime($a['locked_until']) - $now) / 60);
            return ['ok' => false, 'status' => 423, 'message' => "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau {$m} phút."];
        }
        if (!password_verify($password, $a['password_hash'])) {
            $f = (int) $a['failed_attempts'] + 1;
            if ($f >= self::MAX_FAILS) {
                $this->run('UPDATE sm_staff_accounts SET failed_attempts = 0, locked_until = ? WHERE id = ?', [$this->ts($now + self::LOCK_MINUTES * 60), $a['id']]);
                return ['ok' => false, 'status' => 423, 'message' => 'Đăng nhập sai quá nhiều lần. Tài khoản tạm khóa ' . self::LOCK_MINUTES . ' phút.'];
            }
            $this->run('UPDATE sm_staff_accounts SET failed_attempts = ? WHERE id = ?', [$f, $a['id']]);
            return ['ok' => false, 'status' => 401, 'message' => 'Sai tên đăng nhập hoặc mật khẩu.'];
        }
        $this->run('UPDATE sm_staff_accounts SET failed_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?', [$this->ts($now), $a['id']]);
        $this->run('DELETE FROM sm_staff_tokens WHERE staff_id = ? AND expires_at < ?', [$a['id'], $this->ts($now)]);
        $raw = bin2hex(random_bytes(32));
        $exp = $this->ts($now + self::TOKEN_HOURS * 3600);
        $this->run('INSERT INTO sm_staff_tokens (staff_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)', [$a['id'], hash('sha256', $raw), $exp, $this->ts($now)]);

        return ['ok' => true, 'status' => 200, 'token' => $raw, 'expires_at' => $exp, 'staff' => $this->staffView($a)];
    }

    /** @param array<string,mixed> $a */
    private function staffView(array $a): array
    {
        return ['id' => (int) $a['id'], 'username' => $a['username'], 'name' => $a['full_name'], 'role' => $a['role'], 'role_label' => self::ROLES[$a['role']] ?? $a['role']];
    }

    /** @return array<string,mixed>|null */
    public function authenticate(?string $bearer): ?array
    {
        if (!$bearer) {
            return null;
        }
        $a = $this->one('SELECT a.id, a.username, a.full_name, a.role FROM sm_staff_tokens t JOIN sm_staff_accounts a ON a.id = t.staff_id
                          WHERE t.token_hash = ? AND t.expires_at > ? AND a.status = ?', [hash('sha256', $bearer), $this->ts($this->now()), 'active']);
        return $a && isset(self::ROLES[$a['role']]) ? $this->staffView($a) : null;
    }

    public function logout(string $bearer): void
    {
        $this->run('DELETE FROM sm_staff_tokens WHERE token_hash = ?', [hash('sha256', $bearer)]);
    }

    /* ================================================================== dashboard */

    /** @return array<string,mixed> */
    public function dashboard(): array
    {
        $y = $this->currentYear();
        $yid = (int) $y['id'];
        $byGrade = $this->all('SELECT c.grade, COUNT(DISTINCT c.id) AS classes, COUNT(e.id) AS students FROM sm_classes c
                                LEFT JOIN sm_enrollments e ON e.class_id = c.id AND e.school_year_id = c.school_year_id
                               WHERE c.school_year_id = ? GROUP BY c.grade ORDER BY c.grade', [$yid]);
        $gender = $this->all('SELECT s.gender, COUNT(*) AS n FROM sm_students s JOIN sm_enrollments e ON e.student_id = s.id AND e.school_year_id = ? GROUP BY s.gender', [$yid]);
        $g = ['Nam' => 0, 'Nữ' => 0];
        foreach ($gender as $r) {
            $g[$r['gender']] = (int) $r['n'];
        }
        $avgs = $this->yearAverages($yid);
        $ranks = ['Giỏi' => 0, 'Khá' => 0, 'Trung bình' => 0, 'Yếu' => 0, 'Kém' => 0];
        $sum = 0;
        $cnt = 0;
        foreach ($avgs as $a) {
            if (!empty($a['rank'])) {
                $ranks[$a['rank']]++;
                $sum += $a['avg'];
                $cnt++;
            }
        }
        $pending = 0;
        $recent = [];
        try {
            $pending = (int) ($this->one('SELECT COUNT(*) AS n FROM sm_profile_requests WHERE status = ?', ['pending'])['n'] ?? 0);
            $recent = $this->requestRows('r.status = ?', ['pending'], 5);
        } catch (\Throwable $e) {
        }
        $noGmail = (int) ($this->one("SELECT COUNT(*) AS n FROM sm_accounts WHERE email LIKE '%@thpt.edu.vn'")['n'] ?? 0);
        $mustChange = (int) ($this->one('SELECT COUNT(*) AS n FROM sm_accounts WHERE must_change_password = 1')['n'] ?? 0);
        $accounts = (int) ($this->one('SELECT COUNT(*) AS n FROM sm_accounts')['n'] ?? 0);
        $noHomeroom = (int) ($this->one('SELECT COUNT(*) AS n FROM sm_classes WHERE school_year_id = ? AND homeroom_teacher_id IS NULL', [$yid])['n'] ?? 0);
        $noPhone = null;
        try {
            $noPhone = (int) ($this->one('SELECT COUNT(*) AS n FROM sm_student_profiles WHERE phone IS NULL')['n'] ?? 0);
        } catch (\Throwable $e) {
        }
        $missingGrades = (int) ($this->one('SELECT COUNT(*) AS n FROM sm_grades g JOIN sm_subjects sj ON sj.id = g.subject_id WHERE g.school_year_id = ? AND sj.kind <> ? AND g.tbm IS NULL', [$yid, 'pass'])['n'] ?? 0);

        return [
            'year' => $y['label'],
            'totals' => [
                'students' => $g['Nam'] + $g['Nữ'], 'male' => $g['Nam'], 'female' => $g['Nữ'],
                'classes' => array_sum(array_map(fn ($r) => (int) $r['classes'], $byGrade)),
                'teachers' => (int) ($this->one('SELECT COUNT(*) AS n FROM sm_teachers')['n'] ?? 0),
                'pending_requests' => $pending, 'avg_score' => $cnt ? round($sum / $cnt, 2) : null,
            ],
            'by_grade' => array_map(fn ($r) => ['grade' => (int) $r['grade'], 'classes' => (int) $r['classes'], 'students' => (int) $r['students']], $byGrade),
            'ranks' => $ranks,
            'tasks' => [
                ['key' => 'requests', 'label' => 'Hồ sơ chờ duyệt', 'count' => $pending, 'link' => '/academic/students/requests', 'level' => $pending > 0 ? 'warn' : 'ok'],
                ['key' => 'gmail', 'label' => 'Tài khoản chưa liên kết Gmail', 'count' => $noGmail, 'link' => '/academic/students', 'level' => $noGmail > 0 ? 'info' : 'ok', 'total' => $accounts],
                ['key' => 'default_pw', 'label' => 'Tài khoản còn mật khẩu mặc định', 'count' => $mustChange, 'link' => '/academic/students', 'level' => $mustChange > 0 ? 'info' : 'ok', 'total' => $accounts],
                ['key' => 'phone', 'label' => 'Học sinh chưa có số điện thoại', 'count' => $noPhone, 'link' => '/academic/students', 'level' => $noPhone ? 'info' : 'ok'],
                ['key' => 'grades', 'label' => 'Ô điểm TBM còn thiếu', 'count' => $missingGrades, 'link' => '/academic/grades', 'level' => $missingGrades > 0 ? 'warn' : 'ok'],
                ['key' => 'homeroom', 'label' => 'Lớp chưa có giáo viên chủ nhiệm', 'count' => $noHomeroom, 'link' => '/academic/classes', 'level' => $noHomeroom > 0 ? 'warn' : 'ok'],
            ],
            'recent_requests' => $recent,
        ];
    }

    /* ================================================================== học sinh */

    /** @return array<string,mixed> */
    public function students(array $f): array
    {
        $y = $this->currentYear();
        $where = ['e.school_year_id = ?'];
        $p = [(int) $y['id']];
        if (!empty($f['q'])) {
            $q = '%' . str_replace(['%', '_'], ['\\%', '\\_'], trim((string) $f['q'])) . '%';
            $where[] = "(s.full_name LIKE ? ESCAPE '\\' OR s.code LIKE ? ESCAPE '\\')";
            array_push($p, $q, $q);
        }
        if (!empty($f['grade'])) {
            $where[] = 'c.grade = ?';
            $p[] = (int) $f['grade'];
        }
        if (!empty($f['class_id'])) {
            $where[] = 'c.id = ?';
            $p[] = (int) $f['class_id'];
        }
        if (!empty($f['gender']) && in_array($f['gender'], ['Nam', 'Nữ'], true)) {
            $where[] = 's.gender = ?';
            $p[] = $f['gender'];
        }
        $w = implode(' AND ', $where);
        $total = (int) ($this->one("SELECT COUNT(*) AS n FROM sm_students s JOIN sm_enrollments e ON e.student_id = s.id JOIN sm_classes c ON c.id = e.class_id WHERE $w", $p)['n'] ?? 0);
        $per = max(5, min(100, (int) ($f['per_page'] ?? 20)));
        $pages = max(1, (int) ceil($total / $per));
        $page = max(1, min($pages, (int) ($f['page'] ?? 1)));
        $rows = $this->all("SELECT s.code, s.full_name, s.gender, s.birth_date, c.id AS class_id, c.name AS class_name, c.grade,
                                   a.username, a.status, a.must_change_password, a.email
                              FROM sm_students s JOIN sm_enrollments e ON e.student_id = s.id JOIN sm_classes c ON c.id = e.class_id
                         LEFT JOIN sm_accounts a ON a.student_id = s.id
                             WHERE $w ORDER BY c.grade, c.name, s.code LIMIT $per OFFSET " . (($page - 1) * $per), $p);

        return [
            'items' => array_map(fn ($r) => [
                'code' => $r['code'], 'full_name' => $r['full_name'], 'gender' => $r['gender'], 'birth_date' => self::dmy($r['birth_date']),
                'class_id' => (int) $r['class_id'], 'class_name' => $r['class_name'], 'grade' => (int) $r['grade'],
                'username' => $r['username'], 'account_status' => $r['status'], 'default_password' => (int) $r['must_change_password'] === 1,
                'gmail_linked' => $r['email'] !== null && !preg_match('/@thpt\.edu\.vn$/i', (string) $r['email']),
            ], $rows),
            'total' => $total, 'page' => $page, 'pages' => $pages, 'per_page' => $per,
        ];
    }

    /** @return array<string,mixed>|null */
    public function studentDetail(string $code): ?array
    {
        $s = $this->one('SELECT id FROM sm_students WHERE code = ?', [strtoupper(trim($code))]);
        if (!$s) {
            return null;
        }
        $sid = (int) $s['id'];
        $acc = $this->one('SELECT id, username, email, status, must_change_password, failed_attempts, locked_until, last_login_at FROM sm_accounts WHERE student_id = ?', [$sid]);
        $repo = new SchoolRepo($this->pdo, $this->clock);

        return [
            'profile' => $repo->fullProfile($sid, (int) ($acc['id'] ?? 0)),
            'account' => $acc ? [
                'username' => $acc['username'], 'email' => $acc['email'], 'status' => $acc['status'], 'default_password' => (int) $acc['must_change_password'] === 1,
                'locked' => !empty($acc['locked_until']) && strtotime($acc['locked_until']) > $this->now(), 'last_login_at' => $acc['last_login_at'],
            ] : null,
            'grades' => $repo->grades($sid),
        ];
    }

    /**
     * Kiểm tra + chuẩn hóa 1 giá trị hồ sơ. @return array{0:bool,1:mixed} [true, giá trị đã chuẩn hóa] hoặc [false, thông báo lỗi]
     */
    private function normalizeField(string $field, $value): array
    {
        $v = is_string($value) ? trim($value) : $value;
        if ($field === 'full_name') {
            $v = trim(preg_replace('/\s+/u', ' ', (string) $v));
            if (mb_strlen($v) < 2 || mb_strlen($v) > 80 || !preg_match('/^[\p{L}][\p{L}\s\'.\-]*$/u', $v) || count(explode(' ', $v)) < 2) {
                return [false, 'Họ và tên phải gồm ít nhất 2 từ, chỉ có chữ cái.'];
            }
            return [true, $v];
        }
        if ($field === 'birth_date') {
            $s = (string) $v;
            if (preg_match('#^(\d{1,2})/(\d{1,2})/(\d{4})$#', $s, $m) && checkdate((int) $m[2], (int) $m[1], (int) $m[3])) {
                return [true, sprintf('%04d-%02d-%02d', $m[3], $m[2], $m[1])];
            }
            if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $s, $m) && checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
                return [true, $s];
            }
            return [false, 'Ngày sinh không hợp lệ (dạng dd/mm/yyyy).'];
        }
        if ($field === 'gender') {
            return in_array($v, ['Nam', 'Nữ'], true) ? [true, $v] : [false, 'Giới tính chỉ gồm Nam hoặc Nữ.'];
        }
        if ($field === 'height_cm' || $field === 'weight_kg') {
            if ($v === '' || $v === null) {
                return [true, null];
            }
            [$lo, $hi] = $field === 'height_cm' ? [100, 230] : [25, 200];
            return is_numeric($v) && (int) $v >= $lo && (int) $v <= $hi ? [true, (int) $v] : [false, "Giá trị phải từ {$lo} đến {$hi}."];
        }
        if (!isset(self::PROFILE_COLS[$field])) {
            return [false, 'Thông tin không được phép chỉnh sửa.'];
        }
        if ($v === '' || $v === null) {
            return [true, null];
        }
        if (in_array($field, self::PHONE_COLS, true)) {
            $d = preg_replace('/[\s.\-()]/', '', (string) $v);
            if (str_starts_with($d, '+84')) {
                $d = '0' . substr($d, 3);
            }
            return preg_match('/^0\d{9}$/', $d) ? [true, $d] : [false, 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0.'];
        }
        if ($field === 'blood_type' && !in_array($v, ['A', 'B', 'AB', 'O'], true)) {
            return [false, 'Nhóm máu chỉ gồm A, B, AB hoặc O.'];
        }
        if (mb_strlen((string) $v) > self::PROFILE_COLS[$field]) {
            return [false, 'Quá dài (tối đa ' . self::PROFILE_COLS[$field] . ' ký tự).'];
        }
        return [true, (string) $v];
    }

    private function ensureProfileRow(int $sid): void
    {
        if (!$this->one('SELECT id FROM sm_student_profiles WHERE student_id = ?', [$sid])) {
            $this->run('INSERT INTO sm_student_profiles (student_id, youth_union, updated_at) VALUES (?, 0, ?)', [$sid, $this->ts($this->now())]);
        }
    }

    private function applyField(int $sid, string $field, $normalized): void
    {
        if (in_array($field, ['full_name', 'birth_date', 'gender'], true)) {
            $this->run("UPDATE sm_students SET $field = ? WHERE id = ?", [$normalized, $sid]);
            return;
        }
        $this->ensureProfileRow($sid);
        $this->run("UPDATE sm_student_profiles SET $field = ?, updated_at = ? WHERE student_id = ?", [$normalized, $this->ts($this->now()), $sid]);
    }

    private function currentValue(int $sid, string $field): ?string
    {
        if (in_array($field, ['full_name', 'birth_date', 'gender'], true)) {
            $v = ($this->one("SELECT $field AS v FROM sm_students WHERE id = ?", [$sid]))['v'] ?? null;
            return $field === 'birth_date' ? self::dmy($v) : $v;
        }
        try {
            $v = ($this->one("SELECT $field AS v FROM sm_student_profiles WHERE student_id = ?", [$sid]))['v'] ?? null;
        } catch (\Throwable $e) {
            return null;
        }
        return $v === null ? null : (string) $v;
    }

    /** Giáo vụ sửa trực tiếp hồ sơ học sinh. @param array<string,mixed> $fields */
    public function updateStudent(string $code, array $fields, array $staff): array
    {
        $s = $this->one('SELECT id FROM sm_students WHERE code = ?', [strtoupper(trim($code))]);
        if (!$s) {
            return ['ok' => false, 'status' => 404, 'message' => 'Không tìm thấy học sinh.'];
        }
        $sid = (int) $s['id'];
        $norm = [];
        $errors = [];
        foreach ($fields as $k => $v) {
            [$ok, $val] = $this->normalizeField((string) $k, $v);
            if ($ok) {
                $norm[$k] = $val;
            } else {
                $errors[$k] = $val;
            }
        }
        if ($errors) {
            return ['ok' => false, 'status' => 422, 'message' => 'Thông tin chưa hợp lệ.', 'errors' => $errors];
        }
        if (!$norm) {
            return ['ok' => false, 'status' => 422, 'message' => 'Không có thông tin nào để cập nhật.'];
        }
        $this->pdo->beginTransaction();
        try {
            foreach ($norm as $k => $val) {
                $old = $this->currentValue($sid, $k);
                $this->applyField($sid, $k, $val);
                $this->audit($sid, $k, $old, $k === 'birth_date' ? self::dmy($val) : (string) $val, $staff);
            }
            $this->pdo->commit();
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }

        return ['ok' => true, 'status' => 200, 'message' => 'Đã cập nhật hồ sơ học sinh.'];
    }

    /** Ghi nhật ký thay đổi hồ sơ (dùng bảng yêu cầu, trạng thái đã duyệt). */
    private function audit(int $sid, string $field, ?string $old, ?string $new, array $staff): void
    {
        if ($new === null || $new === '') {
            $new = '(để trống)';
        }
        $now = $this->ts($this->now());
        try {
            $this->run('INSERT INTO sm_profile_requests (student_id, field_key, old_value, new_value, reason, status, review_note, created_at, reviewed_at, reviewed_by)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [$sid, $field, $old, mb_substr($new, 0, 255), 'Cập nhật trực tiếp', 'approved', 'Nhân viên nhà trường cập nhật', $now, $now, $staff['name'] ?? null]);
        } catch (\Throwable $e) {
            try {
                $this->run('INSERT INTO sm_profile_requests (student_id, field_key, old_value, new_value, reason, status, review_note, created_at, reviewed_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [$sid, $field, $old, mb_substr($new, 0, 255), 'Cập nhật trực tiếp', 'approved', 'Nhân viên nhà trường cập nhật', $now, $now]);
            } catch (\Throwable $e2) {
            }
        }
    }

    /** Cấp lại mật khẩu mặc định + mở khóa tài khoản học sinh. */
    public function resetStudentPassword(string $code): array
    {
        $a = $this->one('SELECT a.id FROM sm_accounts a JOIN sm_students s ON s.id = a.student_id WHERE s.code = ?', [strtoupper(trim($code))]);
        if (!$a) {
            return ['ok' => false, 'status' => 404, 'message' => 'Không tìm thấy tài khoản của học sinh.'];
        }
        $this->run('UPDATE sm_accounts SET password_hash = ?, must_change_password = 1, failed_attempts = 0, locked_until = NULL WHERE id = ?', [password_hash(self::DEFAULT_PASSWORD, PASSWORD_BCRYPT), $a['id']]);
        $this->run('DELETE FROM sm_api_tokens WHERE account_id = ?', [$a['id']]);

        return ['ok' => true, 'status' => 200, 'message' => 'Đã đặt lại mật khẩu về mặc định (' . self::DEFAULT_PASSWORD . '). Học sinh sẽ được nhắc đổi mật khẩu.'];
    }

    /* ================================================================== duyệt hồ sơ */

    /** @return array<int,array<string,mixed>> */
    private function requestRows(string $where, array $p, int $limit = 100, int $offset = 0): array
    {
        $rows = $this->all("SELECT r.id, r.field_key, r.old_value, r.new_value, r.reason, r.status, r.review_note, r.created_at, r.reviewed_at,
                                   s.code, s.full_name, c.name AS class_name
                              FROM sm_profile_requests r JOIN sm_students s ON s.id = r.student_id
                         LEFT JOIN sm_enrollments e ON e.student_id = s.id AND e.school_year_id = ?
                         LEFT JOIN sm_classes c ON c.id = e.class_id
                             WHERE $where ORDER BY r.id DESC LIMIT $limit OFFSET $offset", [(int) $this->currentYear()['id'], ...$p]);
        $labels = SchoolRepo::PROFILE_REQUEST + ['full_name' => 'Họ và tên'] + SchoolRepo::PROFILE_DIRECT;
        $by = $this->reviewerMap(array_column($rows, 'id'));

        return array_map(fn ($r) => [
            'id' => (int) $r['id'], 'student' => ['code' => $r['code'], 'name' => $r['full_name'], 'class' => $r['class_name']],
            'field' => $r['field_key'], 'field_label' => $labels[$r['field_key']] ?? $r['field_key'], 'old_value' => $r['old_value'], 'new_value' => $r['new_value'],
            'reason' => $r['reason'], 'status' => $r['status'], 'review_note' => $r['review_note'], 'created_at' => $r['created_at'], 'reviewed_at' => $r['reviewed_at'],
            'reviewed_by' => $by[(int) $r['id']] ?? null,
        ], $rows);
    }

    /** @param array<int,mixed> $ids @return array<int,string> */
    private function reviewerMap(array $ids): array
    {
        if (!$ids) {
            return [];
        }
        try {
            $in = implode(',', array_fill(0, count($ids), '?'));
            $out = [];
            foreach ($this->all("SELECT id, reviewed_by FROM sm_profile_requests WHERE id IN ($in)", array_map('intval', $ids)) as $r) {
                $out[(int) $r['id']] = $r['reviewed_by'];
            }
            return $out;
        } catch (\Throwable $e) {
            return [];
        }
    }

    /** @return array<string,mixed> */
    public function requests(?string $status, int $page = 1, int $per = 20): array
    {
        $valid = ['pending', 'approved', 'rejected', 'cancelled'];
        $counts = array_fill_keys($valid, 0);
        try {
            foreach ($this->all('SELECT status, COUNT(*) AS n FROM sm_profile_requests GROUP BY status') as $r) {
                $counts[$r['status']] = (int) $r['n'];
            }
            $per = max(5, min(100, $per));
            $total = $status && in_array($status, $valid, true) ? $counts[$status] : array_sum($counts);
            $pages = max(1, (int) ceil($total / $per));
            $page = max(1, min($pages, $page));
            $items = $status && in_array($status, $valid, true)
                ? $this->requestRows('r.status = ?', [$status], $per, ($page - 1) * $per)
                : $this->requestRows('1 = 1', [], $per, ($page - 1) * $per);
        } catch (\Throwable $e) {
            return ['items' => [], 'counts' => $counts, 'total' => 0, 'page' => 1, 'pages' => 1, 'ready' => false];
        }

        return ['items' => $items, 'counts' => $counts, 'total' => $total, 'page' => $page, 'pages' => $pages, 'ready' => true];
    }

    public function reviewRequest(int $id, string $action, string $note, array $staff): array
    {
        $r = $this->one('SELECT id, student_id, field_key, new_value, status FROM sm_profile_requests WHERE id = ?', [$id]);
        if (!$r) {
            return ['ok' => false, 'status' => 404, 'message' => 'Không tìm thấy yêu cầu.'];
        }
        if ($r['status'] !== 'pending') {
            return ['ok' => false, 'status' => 409, 'message' => 'Yêu cầu này đã được xử lý trước đó.'];
        }
        $note = trim($note);
        $now = $this->ts($this->now());
        if ($action === 'reject') {
            if (mb_strlen($note) < 3) {
                return ['ok' => false, 'status' => 422, 'message' => 'Vui lòng nhập lý do từ chối.'];
            }
            $this->markReviewed($id, 'rejected', $note, $now, $staff);
            return ['ok' => true, 'status' => 200, 'message' => 'Đã từ chối yêu cầu.'];
        }
        if ($action !== 'approve') {
            return ['ok' => false, 'status' => 422, 'message' => 'Thao tác không hợp lệ.'];
        }
        [$ok, $val] = $this->normalizeField($r['field_key'], $r['new_value']);
        if (!$ok) {
            return ['ok' => false, 'status' => 422, 'message' => 'Không áp dụng được giá trị đề nghị: ' . $val];
        }
        $this->pdo->beginTransaction();
        try {
            $this->applyField((int) $r['student_id'], $r['field_key'], $val);
            $this->markReviewed($id, 'approved', $note !== '' ? $note : 'Đã cập nhật hồ sơ theo đề nghị.', $now, $staff);
            $this->pdo->commit();
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }

        return ['ok' => true, 'status' => 200, 'message' => 'Đã duyệt và cập nhật hồ sơ học sinh.'];
    }

    private function markReviewed(int $id, string $status, string $note, string $now, array $staff): void
    {
        try {
            $this->run('UPDATE sm_profile_requests SET status = ?, review_note = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?', [$status, $note, $now, $staff['name'] ?? null, $id]);
        } catch (\Throwable $e) {
            $this->run('UPDATE sm_profile_requests SET status = ?, review_note = ?, reviewed_at = ? WHERE id = ?', [$status, $note, $now, $id]);
        }
    }

    /* ================================================================== lớp */

    /** @return array<string,mixed> */
    public function classes(): array
    {
        $y = $this->currentYear();
        $yid = (int) $y['id'];
        $classes = $this->all('SELECT c.id, c.name, c.grade, t.full_name AS homeroom FROM sm_classes c LEFT JOIN sm_teachers t ON t.id = c.homeroom_teacher_id
                                WHERE c.school_year_id = ? ORDER BY c.grade, c.name', [$yid]);
        $st = [];
        foreach ($this->all('SELECT e.class_id, s.gender, e.student_id FROM sm_enrollments e JOIN sm_students s ON s.id = e.student_id WHERE e.school_year_id = ?', [$yid]) as $r) {
            $cid = (int) $r['class_id'];
            $st[$cid]['n'] = ($st[$cid]['n'] ?? 0) + 1;
            $st[$cid][$r['gender'] === 'Nam' ? 'm' : 'f'] = ($st[$cid][$r['gender'] === 'Nam' ? 'm' : 'f'] ?? 0) + 1;
            $st[$cid]['ids'][] = (int) $r['student_id'];
        }
        $avgs = $this->yearAverages($yid);
        $items = [];
        foreach ($classes as $c) {
            $cid = (int) $c['id'];
            $sum = 0;
            $n = 0;
            $good = 0;
            foreach ($st[$cid]['ids'] ?? [] as $sid) {
                if (isset($avgs[$sid]['avg'])) {
                    $sum += $avgs[$sid]['avg'];
                    $n++;
                    $good += in_array($avgs[$sid]['rank'], ['Giỏi', 'Khá'], true) ? 1 : 0;
                }
            }
            $items[] = [
                'id' => $cid, 'name' => $c['name'], 'grade' => (int) $c['grade'], 'homeroom' => $c['homeroom'],
                'students' => $st[$cid]['n'] ?? 0, 'male' => $st[$cid]['m'] ?? 0, 'female' => $st[$cid]['f'] ?? 0,
                'avg' => $n ? round($sum / $n, 2) : null, 'good_rate' => $n ? round($good * 100 / $n) : null,
            ];
        }

        return ['year' => $y['label'], 'items' => $items];
    }

    /** @return array<string,mixed>|null */
    public function classDetail(int $classId): ?array
    {
        $c = $this->one('SELECT c.id, c.name, c.grade, c.school_year_id, t.full_name AS homeroom, y.label FROM sm_classes c
                           JOIN sm_school_years y ON y.id = c.school_year_id LEFT JOIN sm_teachers t ON t.id = c.homeroom_teacher_id WHERE c.id = ?', [$classId]);
        if (!$c) {
            return null;
        }
        $yid = (int) $c['school_year_id'];
        $avgs = $this->yearAverages($yid, $classId);
        $roster = $this->all('SELECT s.code, s.full_name, s.gender, s.birth_date, a.status, a.must_change_password FROM sm_enrollments e
                                JOIN sm_students s ON s.id = e.student_id LEFT JOIN sm_accounts a ON a.student_id = s.id
                               WHERE e.class_id = ? AND e.school_year_id = ?', [$classId, $yid]);
        $ids = [];
        foreach ($this->all('SELECT s.code, s.id FROM sm_enrollments e JOIN sm_students s ON s.id = e.student_id WHERE e.class_id = ?', [$classId]) as $r) {
            $ids[$r['code']] = (int) $r['id'];
        }
        $ranks = ['Giỏi' => 0, 'Khá' => 0, 'Trung bình' => 0, 'Yếu' => 0, 'Kém' => 0];
        $out = [];
        $sum = 0;
        $n = 0;
        foreach (self::sortByName($roster) as $i => $r) {
            $a = $avgs[$ids[$r['code']] ?? 0] ?? [];
            if (!empty($a['rank'])) {
                $ranks[$a['rank']]++;
                $sum += $a['avg'];
                $n++;
            }
            $out[] = [
                'no' => $i + 1, 'code' => $r['code'], 'full_name' => $r['full_name'], 'gender' => $r['gender'], 'birth_date' => self::dmy($r['birth_date']),
                'hk1' => $a['hk1'] ?? null, 'hk2' => $a['hk2'] ?? null, 'avg' => $a['avg'] ?? null, 'rank' => $a['rank'] ?? null, 'conduct' => $a['conduct'] ?? null,
                'default_password' => (int) ($r['must_change_password'] ?? 0) === 1,
            ];
        }
        $subjects = $this->all('SELECT cs.id, sj.name AS subject, sj.periods_per_week AS ppw, t.full_name AS teacher FROM sm_class_subjects cs
                                  JOIN sm_subjects sj ON sj.id = cs.subject_id JOIN sm_teachers t ON t.id = cs.teacher_id
                                 WHERE cs.class_id = ? ORDER BY sj.sort_order', [$classId]);

        return [
            'class' => ['id' => (int) $c['id'], 'name' => $c['name'], 'grade' => (int) $c['grade'], 'homeroom' => $c['homeroom'], 'year' => $c['label']],
            'stats' => ['students' => count($out), 'male' => count(array_filter($out, fn ($x) => $x['gender'] === 'Nam')), 'female' => count(array_filter($out, fn ($x) => $x['gender'] === 'Nữ')), 'avg' => $n ? round($sum / $n, 2) : null, 'ranks' => $ranks],
            'students' => $out,
            'subjects' => array_map(fn ($s) => ['id' => (int) $s['id'], 'subject' => $s['subject'], 'periods' => (int) $s['ppw'], 'teacher' => $s['teacher']], $subjects),
        ];
    }

    /* ================================================================== phân công giảng dạy */

    /** @return array<string,mixed> */
    public function assignments(?int $classId): array
    {
        $y = $this->currentYear();
        $classes = $this->all('SELECT id, name, grade FROM sm_classes WHERE school_year_id = ? ORDER BY grade, name', [(int) $y['id']]);
        $classId = $classId ?: (int) ($classes[0]['id'] ?? 0);
        $rows = $this->all('SELECT cs.id, sj.id AS subject_id, sj.name AS subject, sj.periods_per_week AS ppw, t.id AS teacher_id, t.full_name AS teacher, t.code AS teacher_code
                              FROM sm_class_subjects cs JOIN sm_subjects sj ON sj.id = cs.subject_id JOIN sm_teachers t ON t.id = cs.teacher_id
                             WHERE cs.class_id = ? ORDER BY sj.sort_order', [$classId]);
        $teachers = $this->all('SELECT t.id, t.code, t.full_name, t.main_subject_id, sj.name AS subject FROM sm_teachers t JOIN sm_subjects sj ON sj.id = t.main_subject_id ORDER BY sj.sort_order, t.full_name');
        $load = [];
        foreach ($this->all('SELECT cs.teacher_id, COUNT(tt.id) AS n, COUNT(DISTINCT cs.class_id) AS c FROM sm_class_subjects cs
                              LEFT JOIN sm_timetable tt ON tt.class_subject_id = cs.id
                              JOIN sm_classes cl ON cl.id = cs.class_id AND cl.school_year_id = ? GROUP BY cs.teacher_id', [(int) $y['id']]) as $r) {
            $load[(int) $r['teacher_id']] = ['periods' => (int) $r['n'], 'classes' => (int) $r['c']];
        }

        return [
            'year' => $y['label'], 'class_id' => $classId, 'classes' => array_map(fn ($c) => ['id' => (int) $c['id'], 'name' => $c['name'], 'grade' => (int) $c['grade']], $classes),
            'rows' => array_map(fn ($r) => [
                'id' => (int) $r['id'], 'subject_id' => (int) $r['subject_id'], 'subject' => $r['subject'], 'periods' => (int) $r['ppw'],
                'teacher_id' => (int) $r['teacher_id'], 'teacher' => $r['teacher'], 'teacher_code' => $r['teacher_code'],
            ], $rows),
            'teachers' => array_map(fn ($t) => [
                'id' => (int) $t['id'], 'code' => $t['code'], 'name' => $t['full_name'], 'subject_id' => (int) $t['main_subject_id'], 'subject' => $t['subject'],
                'periods' => $load[(int) $t['id']]['periods'] ?? 0, 'classes' => $load[(int) $t['id']]['classes'] ?? 0,
            ], $teachers),
        ];
    }

    public function updateAssignment(int $csId, int $teacherId): array
    {
        $cs = $this->one('SELECT cs.id, cs.class_id, cs.subject_id, cs.teacher_id, c.school_year_id FROM sm_class_subjects cs JOIN sm_classes c ON c.id = cs.class_id WHERE cs.id = ?', [$csId]);
        if (!$cs) {
            return ['ok' => false, 'status' => 404, 'message' => 'Không tìm thấy phân công.'];
        }
        $t = $this->one('SELECT id, full_name, main_subject_id FROM sm_teachers WHERE id = ?', [$teacherId]);
        if (!$t) {
            return ['ok' => false, 'status' => 404, 'message' => 'Không tìm thấy giáo viên.'];
        }
        if ((int) $t['main_subject_id'] !== (int) $cs['subject_id']) {
            return ['ok' => false, 'status' => 422, 'message' => 'Giáo viên này không dạy bộ môn đó.'];
        }
        if ((int) $cs['teacher_id'] === $teacherId) {
            return ['ok' => false, 'status' => 422, 'message' => 'Giáo viên này đang được phân công rồi.'];
        }
        // trùng tiết với lớp khác?
        $conf = $this->one('SELECT tt.weekday, tt.period, c.name AS class_name FROM sm_timetable mine
                              JOIN sm_timetable tt ON tt.weekday = mine.weekday AND tt.period = mine.period
                              JOIN sm_class_subjects o ON o.id = tt.class_subject_id AND o.teacher_id = ?
                              JOIN sm_classes c ON c.id = tt.class_id
                             WHERE mine.class_subject_id = ? AND tt.class_subject_id <> ?', [$teacherId, $csId, $csId]);
        if ($conf) {
            return ['ok' => false, 'status' => 422, 'message' => 'Trùng lịch: ' . $t['full_name'] . ' đã dạy lớp ' . $conf['class_name'] . ' vào ' . (self::WEEKDAY[(int) $conf['weekday']] ?? '') . ', tiết ' . $conf['period'] . '.'];
        }
        $this->pdo->beginTransaction();
        try {
            $this->run('UPDATE sm_class_subjects SET teacher_id = ? WHERE id = ?', [$teacherId, $csId]);
            $this->run('UPDATE sm_grades SET teacher_id = ? WHERE class_id = ? AND subject_id = ? AND school_year_id = ?', [$teacherId, $cs['class_id'], $cs['subject_id'], $cs['school_year_id']]);
            $this->pdo->commit();
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }

        return ['ok' => true, 'status' => 200, 'message' => 'Đã phân công ' . $t['full_name'] . '.'];
    }

    /* ================================================================== thời khóa biểu */

    /** @return array<string,mixed>|null */
    public function timetable(?int $classId, ?int $teacherId): ?array
    {
        $y = $this->currentYear();
        $classes = $this->all('SELECT id, name, grade FROM sm_classes WHERE school_year_id = ? ORDER BY grade, name', [(int) $y['id']]);
        $teachers = $this->all('SELECT id, full_name FROM sm_teachers ORDER BY full_name');
        $periods = array_map(fn ($r) => ['period' => (int) $r['id'], 'start' => substr($r['start_time'], 0, 5), 'end' => substr($r['end_time'], 0, 5)], $this->all('SELECT id, start_time, end_time FROM sm_periods ORDER BY id'));
        $base = 'SELECT tt.weekday, tt.period, sj.name AS subject, t.full_name AS teacher, c.name AS class_name FROM sm_timetable tt
                   JOIN sm_class_subjects cs ON cs.id = tt.class_subject_id JOIN sm_subjects sj ON sj.id = cs.subject_id
                   JOIN sm_teachers t ON t.id = cs.teacher_id JOIN sm_classes c ON c.id = tt.class_id';
        if ($teacherId) {
            $rows = $this->all("$base WHERE cs.teacher_id = ? AND c.school_year_id = ? ORDER BY tt.weekday, tt.period", [$teacherId, (int) $y['id']]);
            $mode = 'teacher';
            $title = ($this->one('SELECT full_name FROM sm_teachers WHERE id = ?', [$teacherId])['full_name'] ?? '');
        } else {
            $classId = $classId ?: (int) ($classes[0]['id'] ?? 0);
            $rows = $this->all("$base WHERE tt.class_id = ? ORDER BY tt.weekday, tt.period", [$classId]);
            $mode = 'class';
            $title = ($this->one('SELECT name FROM sm_classes WHERE id = ?', [$classId])['name'] ?? '');
        }

        return [
            'year' => $y['label'], 'mode' => $mode, 'title' => $title, 'class_id' => $classId, 'teacher_id' => $teacherId,
            'classes' => array_map(fn ($c) => ['id' => (int) $c['id'], 'name' => $c['name'], 'grade' => (int) $c['grade']], $classes),
            'teachers' => array_map(fn ($t) => ['id' => (int) $t['id'], 'name' => $t['full_name']], $teachers),
            'periods' => $periods, 'weekdays' => array_map(fn ($k, $v) => ['weekday' => $k, 'label' => $v], array_keys(array_slice(self::WEEKDAY, 0, 6, true)), array_slice(self::WEEKDAY, 0, 6, true)),
            'cells' => array_map(fn ($r) => ['weekday' => (int) $r['weekday'], 'period' => (int) $r['period'], 'subject' => $r['subject'], 'teacher' => $r['teacher'], 'class' => $r['class_name']], $rows),
            'total' => count($rows),
        ];
    }

    /* ================================================================== lịch thi */

    /** @return array<string,mixed> */
    public function exams(): array
    {
        $y = $this->currentYear();
        $rows = $this->all('SELECT p.id AS pid, p.code, p.name, p.semester, p.start_date, p.end_date, e.grade, e.exam_date, e.start_time, e.duration_minutes, e.exam_format, s.name AS subject
                              FROM sm_exam_periods p JOIN sm_exam_schedules e ON e.exam_period_id = p.id JOIN sm_subjects s ON s.id = e.subject_id
                             WHERE p.school_year_id = ? ORDER BY p.start_date, e.grade, e.exam_date, e.start_time', [(int) $y['id']]);
        $today = date('Y-m-d', $this->now());
        $periods = [];
        foreach ($rows as $r) {
            $pid = (int) $r['pid'];
            $periods[$pid] ??= ['id' => $pid, 'code' => $r['code'], 'name' => $r['name'], 'semester' => (int) $r['semester'], 'start_date' => $r['start_date'], 'end_date' => $r['end_date'], 'grades' => []];
            $d = substr($r['exam_date'], 0, 10);
            $st = substr($r['start_time'], 0, 5);
            $wd = (int) date('N', strtotime($d)) + 1;
            $periods[$pid]['grades'][(int) $r['grade']][] = [
                'date' => $d, 'weekday_label' => self::WEEKDAY[$wd], 'start' => $st, 'end' => date('H:i', strtotime("$d $st") + (int) $r['duration_minutes'] * 60),
                'duration' => (int) $r['duration_minutes'], 'subject' => $r['subject'], 'format' => $r['exam_format'], 'status' => $d < $today ? 'done' : ($d === $today ? 'today' : 'upcoming'),
            ];
        }
        $out = [];
        foreach ($periods as $p) {
            ksort($p['grades']);
            $p['grades'] = array_map(fn ($g, $items) => ['grade' => $g, 'items' => $items], array_keys($p['grades']), array_values($p['grades']));
            $out[] = $p;
        }

        return ['year' => $y['label'], 'today' => $today, 'periods' => $out];
    }

    /* ================================================================== quản lý điểm */

    /** @return array<string,mixed> */
    public function grades(?int $classId, int $semester): array
    {
        $y = $this->currentYear();
        $yid = (int) $y['id'];
        $classes = $this->all('SELECT id, name, grade FROM sm_classes WHERE school_year_id = ? ORDER BY grade, name', [$yid]);
        $classId = $classId ?: (int) ($classes[0]['id'] ?? 0);
        $semester = $semester === 2 ? 2 : 1;
        $subjects = $this->all('SELECT id, name, kind FROM sm_subjects ORDER BY sort_order');
        $students = [];
        foreach ($this->all('SELECT s.id, s.code, s.full_name FROM sm_enrollments e JOIN sm_students s ON s.id = e.student_id WHERE e.class_id = ? AND e.school_year_id = ?', [$classId, $yid]) as $r) {
            $students[(int) $r['id']] = ['code' => $r['code'], 'full_name' => $r['full_name'], 'scores' => [], 'sum' => 0, 'n' => 0];
        }
        $colSum = [];
        $colN = [];
        $colMissing = [];
        foreach ($this->all('SELECT g.student_id, g.subject_id, g.tbm, g.assessment FROM sm_grades g WHERE g.class_id = ? AND g.school_year_id = ? AND g.semester = ?', [$classId, $yid, $semester]) as $r) {
            $sid = (int) $r['student_id'];
            $sub = (int) $r['subject_id'];
            if (!isset($students[$sid])) {
                continue;
            }
            $kind = null;
            foreach ($subjects as $s) {
                if ((int) $s['id'] === $sub) {
                    $kind = $s['kind'];
                }
            }
            if ($kind === 'pass') {
                $students[$sid]['scores'][$sub] = $r['assessment'];
                if ($r['assessment'] === null) {
                    $colMissing[$sub] = ($colMissing[$sub] ?? 0) + 1;
                }
                continue;
            }
            if ($r['tbm'] === null) {
                $students[$sid]['scores'][$sub] = null;
                $colMissing[$sub] = ($colMissing[$sub] ?? 0) + 1;
            } else {
                $v = (float) $r['tbm'];
                $students[$sid]['scores'][$sub] = $v;
                $students[$sid]['sum'] += $v;
                $students[$sid]['n']++;
                $colSum[$sub] = ($colSum[$sub] ?? 0) + $v;
                $colN[$sub] = ($colN[$sub] ?? 0) + 1;
            }
        }
        $list = [];
        foreach (self::sortByName(array_values($students)) as $i => $s) {
            $avg = $s['n'] ? round($s['sum'] / $s['n'], 2) : null;
            $list[] = ['no' => $i + 1, 'code' => $s['code'], 'full_name' => $s['full_name'], 'scores' => (object) $s['scores'], 'avg' => $avg, 'rank' => self::classify($avg)];
        }

        return [
            'year' => $y['label'], 'class_id' => $classId, 'semester' => $semester,
            'classes' => array_map(fn ($c) => ['id' => (int) $c['id'], 'name' => $c['name'], 'grade' => (int) $c['grade']], $classes),
            'subjects' => array_map(fn ($s) => [
                'id' => (int) $s['id'], 'name' => $s['name'], 'kind' => $s['kind'],
                'avg' => isset($colN[(int) $s['id']]) ? round($colSum[(int) $s['id']] / $colN[(int) $s['id']], 2) : null, 'missing' => $colMissing[(int) $s['id']] ?? 0,
            ], $subjects),
            'students' => $list,
        ];
    }

    /* ================================================================== xét lên lớp */

    /** @return array{0:string,1:string} [mã, nhãn] */
    private static function promotionResult(int $grade, ?string $rank, ?string $conduct): array
    {
        if ($rank === null || $conduct === null) {
            return ['unknown', 'Chưa đủ dữ liệu'];
        }
        if ($rank === 'Kém' || $conduct === 'Chưa đạt') {
            return ['retain', 'Ở lại lớp'];
        }
        if ($rank === 'Yếu') {
            return ['review', 'Cần xem xét'];
        }
        return ['pass', $grade === 12 ? 'Đủ điều kiện xét tốt nghiệp' : 'Đủ điều kiện lên lớp'];
    }

    /** @return array<string,mixed> */
    public function promotion(?int $classId): array
    {
        $y = $this->currentYear();
        $yid = (int) $y['id'];
        $avgs = $this->yearAverages($yid);
        $cls = $this->all('SELECT id, name, grade FROM sm_classes WHERE school_year_id = ? ORDER BY grade, name', [$yid]);
        $stu = $this->all('SELECT e.class_id, s.id, s.code, s.full_name FROM sm_enrollments e JOIN sm_students s ON s.id = e.student_id WHERE e.school_year_id = ?', [$yid]);
        $sum = [];
        $list = [];
        foreach ($stu as $s) {
            $a = $avgs[(int) $s['id']] ?? [];
            [$code, $label] = self::promotionResult((int) ($cls[array_search((int) $s['class_id'], array_map('intval', array_column($cls, 'id')), true)]['grade'] ?? 10), $a['rank'] ?? null, $a['conduct'] ?? null);
            $cid = (int) $s['class_id'];
            $sum[$cid][$code] = ($sum[$cid][$code] ?? 0) + 1;
            if ($classId && $cid === $classId) {
                $list[] = ['code' => $s['code'], 'full_name' => $s['full_name'], 'avg' => $a['avg'] ?? null, 'rank' => $a['rank'] ?? null, 'conduct' => $a['conduct'] ?? null, 'result' => $code, 'result_label' => $label];
            }
        }
        $list = self::sortByName($list);
        foreach ($list as $i => &$r) {
            $r['no'] = $i + 1;
        }
        unset($r);

        return [
            'year' => $y['label'], 'class_id' => $classId,
            'rule' => 'Ở lại lớp: học lực Kém hoặc hạnh kiểm Chưa đạt. Cần xem xét: học lực Yếu. Còn lại đủ điều kiện (khối 12 xét tốt nghiệp).',
            'classes' => array_map(fn ($c) => [
                'id' => (int) $c['id'], 'name' => $c['name'], 'grade' => (int) $c['grade'],
                'total' => array_sum($sum[(int) $c['id']] ?? []), 'pass' => $sum[(int) $c['id']]['pass'] ?? 0, 'review' => $sum[(int) $c['id']]['review'] ?? 0,
                'retain' => $sum[(int) $c['id']]['retain'] ?? 0, 'unknown' => $sum[(int) $c['id']]['unknown'] ?? 0,
            ], $cls),
            'students' => $list,
        ];
    }

    /* ================================================================== báo cáo */

    /** @return array<string,mixed> */
    public function reports(): array
    {
        $y = $this->currentYear();
        $yid = (int) $y['id'];
        $avgs = $this->yearAverages($yid);
        $rows = $this->all('SELECT e.student_id, c.grade, s.gender FROM sm_enrollments e JOIN sm_classes c ON c.id = e.class_id JOIN sm_students s ON s.id = e.student_id WHERE e.school_year_id = ?', [$yid]);
        $grades = [];
        foreach ($rows as $r) {
            $g = (int) $r['grade'];
            $grades[$g] ??= ['grade' => $g, 'students' => 0, 'male' => 0, 'female' => 0, 'ranks' => ['Giỏi' => 0, 'Khá' => 0, 'Trung bình' => 0, 'Yếu' => 0, 'Kém' => 0],
                'conduct' => ['Tốt' => 0, 'Khá' => 0, 'Đạt' => 0, 'Chưa đạt' => 0], 'sum' => 0, 'n' => 0];
            $grades[$g]['students']++;
            $grades[$g][$r['gender'] === 'Nam' ? 'male' : 'female']++;
            $a = $avgs[(int) $r['student_id']] ?? [];
            if (!empty($a['rank'])) {
                $grades[$g]['ranks'][$a['rank']]++;
                $grades[$g]['sum'] += $a['avg'];
                $grades[$g]['n']++;
            }
            if (!empty($a['conduct'])) {
                $grades[$g]['conduct'][$a['conduct']] = ($grades[$g]['conduct'][$a['conduct']] ?? 0) + 1;
            }
        }
        ksort($grades);
        $subj = [];
        foreach ($this->all('SELECT c.grade, sj.name, sj.sort_order, AVG(g.tbm) AS a FROM sm_grades g JOIN sm_classes c ON c.id = g.class_id JOIN sm_subjects sj ON sj.id = g.subject_id
                              WHERE g.school_year_id = ? AND sj.kind <> ? AND g.tbm IS NOT NULL GROUP BY c.grade, sj.name, sj.sort_order ORDER BY sj.sort_order', [$yid, 'pass']) as $r) {
            $subj[$r['name']]['subject'] = $r['name'];
            $subj[$r['name']]['by_grade'][(int) $r['grade']] = round((float) $r['a'], 2);
        }

        return [
            'year' => $y['label'],
            'grades' => array_values(array_map(fn ($g) => ['grade' => $g['grade'], 'students' => $g['students'], 'male' => $g['male'], 'female' => $g['female'], 'avg' => $g['n'] ? round($g['sum'] / $g['n'], 2) : null, 'ranks' => $g['ranks'], 'conduct' => $g['conduct']], $grades)),
            'subjects' => array_values($subj),
        ];
    }
}
