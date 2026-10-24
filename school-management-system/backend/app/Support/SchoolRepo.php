<?php

namespace App\Support;
use PDO;
use App\Support\DataCrypto; // có thể viết tắt: không cần nếu cùng namespace App\Support


/**
 * Truy vấn dữ liệu học sinh từ các bảng sm_* (xem school_data.sql).
 *
 * Viết bằng PDO + SQL chuẩn nên chạy giống nhau trên MySQL/MariaDB (dự án) và SQLite (kiểm thử).
 * Controller chỉ gọi lớp này, không có logic nghiệp vụ nằm rải rác ở nơi khác.
 */
class SchoolRepo
{
    public const TOKEN_DAYS = 7;
    public const MAX_FAILS = 5;
    public const LOCK_MINUTES = 10;
    public const MIN_PASSWORD = 8;
    public const RESET_MINUTES = 10;       // mã quên mật khẩu hết hạn sau 10 phút
    public const RESET_MAX_TRIES = 5;      // nhập sai 5 lần là hủy mã
    public const RESET_RESEND_SECONDS = 60; // giãn cách giữa 2 lần gửi mã
    public const RESET_MAX_PER_HOUR = 5;   // tối đa 5 mã / giờ / tài khoản

    private const WEEKDAY_LABEL = [2 => 'Thứ Hai', 3 => 'Thứ Ba', 4 => 'Thứ Tư', 5 => 'Thứ Năm', 6 => 'Thứ Sáu', 7 => 'Thứ Bảy', 8 => 'Chủ nhật'];

    /** @var callable */
    private $clock;

    public function __construct(private PDO $pdo, ?callable $clock = null)
    {
        $this->clock = $clock ?? fn () => time();
    }

    /* ------------------------------------------------------------------ tiện ích */

    private function now(): int
    {
        return (int) ($this->clock)();
    }

    private function ts(int $t): string
    {
        return date('Y-m-d H:i:s', $t);
    }

    /** @return array<int,array<string,mixed>> */
    private function all(string $sql, array $params = []): array
    {
        $st = $this->pdo->prepare($sql);
        $st->execute($params);
        return $st->fetchAll(PDO::FETCH_ASSOC);
    }

    /** @return array<string,mixed>|null */
    private function one(string $sql, array $params = []): ?array
    {
        $rows = $this->all($sql, $params);
        return $rows[0] ?? null;
    }

    private function run(string $sql, array $params = []): void
    {
        $this->pdo->prepare($sql)->execute($params);
    }

    private static function num($v): ?float
    {
        return $v === null || $v === '' ? null : (float) $v;
    }

    private static function hm(?string $t): ?string
    {
        return $t === null ? null : substr($t, 0, 5);
    }

    private static function dmy(?string $d): ?string
    {
        if (!$d) {
            return null;
        }
        $ts = strtotime(substr($d, 0, 10));
        return $ts ? date('d/m/Y', $ts) : $d;
    }

    /* ------------------------------------------------------------------ đăng nhập / token */

    /**
     * @return array{ok:bool,status:int,message?:string,token?:string,expires_at?:string,must_change_password?:bool,student?:array}
     */
    public function login(string $username, string $password): array
    {
        $username = strtolower(trim($username));
        $acc = $this->one(
            'SELECT id, student_id, username, password_hash, status, failed_attempts, locked_until, must_change_password
               FROM sm_accounts WHERE LOWER(username) = ?',
            [$username]
        );

        if (!$acc) {
            // Băm giả để thời gian phản hồi không lộ việc tên đăng nhập có tồn tại hay không.
            password_verify($password, '$2y$10$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPsA.ztMG');
            return ['ok' => false, 'status' => 401, 'message' => 'Sai tên đăng nhập hoặc mật khẩu.'];
        }
        if ($acc['status'] !== 'active') {
            return ['ok' => false, 'status' => 403, 'message' => 'Tài khoản đã bị khóa. Vui lòng liên hệ nhà trường.'];
        }

        $now = $this->now();
        if (!empty($acc['locked_until']) && strtotime($acc['locked_until']) > $now) {
            $mins = (int) ceil((strtotime($acc['locked_until']) - $now) / 60);
            return ['ok' => false, 'status' => 423, 'message' => "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau {$mins} phút."];
        }

        if (!password_verify($password, $acc['password_hash'])) {
            $fails = (int) $acc['failed_attempts'] + 1;
            if ($fails >= self::MAX_FAILS) {
                $this->run('UPDATE sm_accounts SET failed_attempts = 0, locked_until = ? WHERE id = ?',
                    [$this->ts($now + self::LOCK_MINUTES * 60), $acc['id']]);
                return ['ok' => false, 'status' => 423, 'message' => 'Đăng nhập sai quá nhiều lần. Tài khoản tạm khóa ' . self::LOCK_MINUTES . ' phút.'];
            }
            $this->run('UPDATE sm_accounts SET failed_attempts = ? WHERE id = ?', [$fails, $acc['id']]);
            return ['ok' => false, 'status' => 401, 'message' => 'Sai tên đăng nhập hoặc mật khẩu.'];
        }

        $this->run('UPDATE sm_accounts SET failed_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?',
            [$this->ts($now), $acc['id']]);
        $this->run('DELETE FROM sm_api_tokens WHERE account_id = ? AND expires_at < ?', [$acc['id'], $this->ts($now)]);

        $raw = bin2hex(random_bytes(32));
        $exp = $this->ts($now + self::TOKEN_DAYS * 86400);
        $this->run('INSERT INTO sm_api_tokens (account_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)',
            [$acc['id'], hash('sha256', $raw), $exp, $this->ts($now)]);

        return [
            'ok' => true,
            'status' => 200,
            'token' => $raw,
            'expires_at' => $exp,
            'must_change_password' => (int) $acc['must_change_password'] === 1,
            'student' => $this->profile((int) $acc['student_id']),
        ];
    }

    /** @return array{id:int,student_id:int,username:string}|null */
    public function authenticate(?string $bearer): ?array
    {
        if (!$bearer) {
            return null;
        }
        $row = $this->one(
            'SELECT a.id, a.student_id, a.username
               FROM sm_api_tokens t JOIN sm_accounts a ON a.id = t.account_id
              WHERE t.token_hash = ? AND t.expires_at > ? AND a.status = ?',
            [hash('sha256', $bearer), $this->ts($this->now()), 'active']
        );
        return $row ? ['id' => (int) $row['id'], 'student_id' => (int) $row['student_id'], 'username' => $row['username']] : null;
    }

    public function logout(string $bearer): void
    {
        $this->run('DELETE FROM sm_api_tokens WHERE token_hash = ?', [hash('sha256', $bearer)]);
    }

    /** @return array{ok:bool,status:int,message:string} */
    public function changePassword(int $accountId, string $current, string $new, string $keepBearer): array
    {
        $acc = $this->one('SELECT id, username, password_hash FROM sm_accounts WHERE id = ?', [$accountId]);
        if (!$acc || !password_verify($current, $acc['password_hash'])) {
            return ['ok' => false, 'status' => 422, 'message' => 'Mật khẩu hiện tại không đúng.'];
        }
        if ($new === $current) {
            return ['ok' => false, 'status' => 422, 'message' => 'Mật khẩu mới phải khác mật khẩu hiện tại.'];
        }
        if ($problem = self::passwordProblem($new, (string) $acc['username'])) {
            return ['ok' => false, 'status' => 422, 'message' => $problem];
        }
        $this->run('UPDATE sm_accounts SET password_hash = ?, must_change_password = 0 WHERE id = ?',
            [password_hash($new, PASSWORD_BCRYPT), $accountId]);
        $this->touchPasswordChanged($accountId);
        // Đăng xuất các thiết bị khác
        $this->run('DELETE FROM sm_api_tokens WHERE account_id = ? AND token_hash <> ?', [$accountId, hash('sha256', $keepBearer)]);
        return ['ok' => true, 'status' => 200, 'message' => 'Đổi mật khẩu thành công.'];
    }


    /* ------------------------------------------------------------------ quên mật khẩu (mã OTP qua Gmail) */

    private function codeHash(string $code, int $accountId): string
    {
        return hash('sha256', $code . '|' . $accountId);
    }

    /** @return array<string,mixed>|null */
    private function accountByEmail(string $email): ?array
    {
        return $this->one(
            'SELECT a.id, a.email, a.username, a.status, s.full_name
               FROM sm_accounts a JOIN sm_students s ON s.id = a.student_id
              WHERE LOWER(a.email) = ?',
            [strtolower(trim($email))]
        );
    }

    /**
     * Bước 1: tạo mã 6 số. Luôn trả "thành công" dù Gmail có tồn tại hay không (tránh dò tài khoản);
     * chỉ khi 'send' = true thì controller mới gửi thư.
     *
     * @return array{ok:bool,status:int,message?:string,send?:bool,code?:string,to?:string,name?:string}
     */
    public function forgotStart(string $email): array
    {
        $email = strtolower(trim($email));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'status' => 422, 'message' => 'Địa chỉ Gmail không hợp lệ.'];
        }
        $acc = $this->accountByEmail($email);
        if (!$acc || $acc['status'] !== 'active') {
            return ['ok' => true, 'status' => 200, 'send' => false];
        }

        $now = $this->now();
        $last = $this->one('SELECT created_at FROM sm_password_resets WHERE account_id = ? ORDER BY id DESC', [$acc['id']]);
        if ($last && $now - strtotime($last['created_at']) < self::RESET_RESEND_SECONDS) {
            return ['ok' => true, 'status' => 200, 'send' => false];
        }
        $recent = $this->one(
            'SELECT COUNT(*) AS n FROM sm_password_resets WHERE account_id = ? AND created_at > ?',
            [$acc['id'], $this->ts($now - 3600)]
        );
        if ((int) ($recent['n'] ?? 0) >= self::RESET_MAX_PER_HOUR) {
            return ['ok' => true, 'status' => 200, 'send' => false];
        }

        // Hủy các mã cũ chưa dùng, tạo mã mới
        $this->run('UPDATE sm_password_resets SET used_at = ? WHERE account_id = ? AND used_at IS NULL', [$this->ts($now), $acc['id']]);
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $this->run(
            'INSERT INTO sm_password_resets (account_id, code_hash, attempts, expires_at, created_at) VALUES (?, ?, 0, ?, ?)',
            [$acc['id'], $this->codeHash($code, (int) $acc['id']), $this->ts($now + self::RESET_MINUTES * 60), $this->ts($now)]
        );

        return ['ok' => true, 'status' => 200, 'send' => true, 'code' => $code, 'to' => $acc['email'], 'name' => $acc['full_name']];
    }

    /**
     * Kiểm tra mã (không làm hỏng mã). Sai quá RESET_MAX_TRIES lần thì mã bị hủy.
     *
     * @return array{ok:bool,status:int,message?:string,account_id?:int,reset_id?:int}
     */
    private function checkCode(string $email, string $code): array
    {
        $fail = ['ok' => false, 'status' => 422, 'message' => 'Mã không đúng hoặc đã hết hạn.'];
        if (!preg_match('/^\d{6}$/', $code)) {
            return $fail;
        }
        $acc = $this->accountByEmail($email);
        if (!$acc || $acc['status'] !== 'active') {
            return $fail;
        }
        $now = $this->now();
        $rs = $this->one(
            'SELECT id, code_hash, attempts FROM sm_password_resets
              WHERE account_id = ? AND used_at IS NULL AND expires_at > ? ORDER BY id DESC',
            [$acc['id'], $this->ts($now)]
        );
        if (!$rs || (int) $rs['attempts'] >= self::RESET_MAX_TRIES) {
            return $fail;
        }
        if (!hash_equals($rs['code_hash'], $this->codeHash($code, (int) $acc['id']))) {
            $tries = (int) $rs['attempts'] + 1;
            if ($tries >= self::RESET_MAX_TRIES) {
                $this->run('UPDATE sm_password_resets SET attempts = ?, used_at = ? WHERE id = ?', [$tries, $this->ts($now), $rs['id']]);
                return ['ok' => false, 'status' => 422, 'message' => 'Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới.'];
            }
            $this->run('UPDATE sm_password_resets SET attempts = ? WHERE id = ?', [$tries, $rs['id']]);
            $left = self::RESET_MAX_TRIES - $tries;
            return ['ok' => false, 'status' => 422, 'message' => "Mã không đúng. Bạn còn {$left} lần thử."];
        }
        return ['ok' => true, 'status' => 200, 'account_id' => (int) $acc['id'], 'reset_id' => (int) $rs['id']];
    }

    /** Bước 2: xác nhận mã. @return array{ok:bool,status:int,message?:string} */
    public function forgotVerify(string $email, string $code): array
    {
        $r = $this->checkCode($email, $code);
        return $r['ok'] ? ['ok' => true, 'status' => 200] : $r;
    }

    /** Quy tắc mật khẩu mới: ≥ 8 ký tự, có chữ và số. */
    public static function passwordProblem(string $pw, string $username = ''): ?string
    {
        if (mb_strlen($pw) < self::MIN_PASSWORD) {
            return 'Mật khẩu phải có ít nhất ' . self::MIN_PASSWORD . ' ký tự.';
        }
        if (!preg_match('/\pL/u', $pw) || !preg_match('/\d/', $pw)) {
            return 'Mật khẩu phải gồm cả chữ và số.';
        }
        if ($username !== '' && strtolower($pw) === strtolower($username)) {
            return 'Mật khẩu không được trùng tên đăng nhập.';
        }
        return null;
    }

    /** Bước 3: đặt mật khẩu mới (kiểm tra lại mã). @return array{ok:bool,status:int,message:string} */
    public function forgotReset(string $email, string $code, string $password, string $confirm): array
    {
        $acc = $this->accountByEmail($email);
        if ($password !== $confirm) {
            return ['ok' => false, 'status' => 422, 'message' => 'Hai lần nhập mật khẩu không khớp.'];
        }
        if ($problem = self::passwordProblem($password, (string) ($acc['username'] ?? ''))) {
            return ['ok' => false, 'status' => 422, 'message' => $problem];
        }
        $r = $this->checkCode($email, $code);
        if (!$r['ok']) {
            return ['ok' => false, 'status' => 422, 'message' => $r['message'] ?? 'Mã không đúng hoặc đã hết hạn.'];
        }
        $now = $this->ts($this->now());
        $this->run(
            'UPDATE sm_accounts SET password_hash = ?, must_change_password = 0, failed_attempts = 0, locked_until = NULL WHERE id = ?',
            [password_hash($password, PASSWORD_BCRYPT), $r['account_id']]
        );
        $this->touchPasswordChanged((int) $r['account_id']);
        $this->run('UPDATE sm_password_resets SET used_at = ? WHERE account_id = ? AND used_at IS NULL', [$now, $r['account_id']]);
        $this->run('DELETE FROM sm_api_tokens WHERE account_id = ?', [$r['account_id']]); // đăng xuất mọi thiết bị
        return ['ok' => true, 'status' => 200, 'message' => 'Đổi mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.'];
    }


    /* ------------------------------------------------------------------ trung tâm bảo mật */

    /** Ghi thời điểm đổi mật khẩu; bỏ qua êm nếu cột password_changed_at chưa được thêm (chưa chạy migration). */
    private function touchPasswordChanged(int $accountId): void
    {
        try {
            $this->run('UPDATE sm_accounts SET password_changed_at = ? WHERE id = ?', [$this->ts($this->now()), $accountId]);
        } catch (\Throwable $e) {
            // chưa có cột → không sao
        }
    }

    private static function maskEmail(string $e): string
    {
        [$u, $d] = array_pad(explode('@', $e, 2), 2, '');
        if ($d === '') {
            return $e;
        }
        return mb_substr($u, 0, 2) . str_repeat('•', max(2, min(mb_strlen($u) - 2, 6))) . '@' . $d;
    }

    /**
     * Tổng quan bảo mật tài khoản: thông tin đăng nhập, điểm bảo mật, các phiên đăng nhập.
     *
     * @return array<string,mixed>|null
     */
    public function security(int $accountId, string $bearer): ?array
    {
        $acc = $this->one('SELECT id, student_id, username, email, must_change_password, last_login_at FROM sm_accounts WHERE id = ?', [$accountId]);
        if (!$acc) {
            return null;
        }
        $changedAt = null;
        try {
            $changedAt = ($this->one('SELECT password_changed_at AS c FROM sm_accounts WHERE id = ?', [$accountId]))['c'] ?? null;
        } catch (\Throwable $e) {
            // chưa có cột
        }
        $now = $this->now();
        $cur = hash('sha256', $bearer);
        $sessions = array_map(fn ($t) => [
            'id' => (int) $t['id'],
            'created_at' => $t['created_at'],
            'expires_at' => $t['expires_at'],
            'current' => hash_equals($cur, $t['token_hash']),
        ], $this->all('SELECT id, token_hash, created_at, expires_at FROM sm_api_tokens WHERE account_id = ? AND expires_at > ? ORDER BY id DESC', [$accountId, $this->ts($now)]));

        $emailReal = !preg_match('/@thpt\.edu\.vn$/i', (string) $acc['email']);
        $isDefault = (int) $acc['must_change_password'] === 1;
        $fresh = $changedAt && ($now - strtotime($changedAt)) <= 180 * 86400;
        $checks = [
            ['key' => 'password', 'label' => 'Đã đổi mật khẩu mặc định', 'ok' => !$isDefault, 'weight' => 40,
                'hint' => 'Mật khẩu mặc định ai cũng đoán được. Hãy đặt mật khẩu của riêng bạn.'],
            ['key' => 'email', 'label' => 'Đã liên kết Gmail để khôi phục', 'ok' => $emailReal, 'weight' => 30,
                'hint' => 'Cần Gmail thật để dùng chức năng quên mật khẩu. Liên hệ nhà trường để liên kết.'],
            ['key' => 'fresh', 'label' => 'Mật khẩu được đổi trong 6 tháng gần đây', 'ok' => (bool) $fresh, 'weight' => 20,
                'hint' => 'Nên đổi mật khẩu định kỳ 3–6 tháng một lần.'],
            ['key' => 'sessions', 'label' => 'Chỉ đăng nhập trên thiết bị đang dùng', 'ok' => count($sessions) <= 1, 'weight' => 10,
                'hint' => 'Đăng xuất các phiên không dùng nữa, nhất là trên máy công cộng.'],
        ];
        $score = array_sum(array_map(fn ($c) => $c['ok'] ? $c['weight'] : 0, $checks));

        return [
            'account' => [
                'username' => $acc['username'],
                'email' => $emailReal ? self::maskEmail((string) $acc['email']) : null,
                'email_linked' => $emailReal,
            ],
            'password' => ['must_change' => $isDefault, 'changed_at' => $changedAt],
            'last_login_at' => $acc['last_login_at'],
            'score' => $score,
            'level' => $score >= 90 ? 'high' : ($score >= 60 ? 'medium' : 'low'),
            'checks' => $checks,
            'sessions' => $sessions,
        ];
    }

    /** Đăng xuất mọi phiên khác (giữ phiên hiện tại). @return int số phiên đã đăng xuất */
    public function revokeOtherSessions(int $accountId, string $bearer): int
    {
        $st = $this->pdo->prepare('DELETE FROM sm_api_tokens WHERE account_id = ? AND token_hash <> ?');
        $st->execute([$accountId, hash('sha256', $bearer)]);
        return $st->rowCount();
    }

    /** Đăng xuất 1 phiên theo id (chỉ phiên của chính tài khoản, không được xóa phiên đang dùng). */
    public function revokeSession(int $accountId, int $sessionId, string $bearer): bool
    {
        $st = $this->pdo->prepare('DELETE FROM sm_api_tokens WHERE id = ? AND account_id = ? AND token_hash <> ?');
        $st->execute([$sessionId, $accountId, hash('sha256', $bearer)]);
        return $st->rowCount() > 0;
    }


    /* ------------------------------------------------------------------ hồ sơ cá nhân đầy đủ */

    /** Trường học sinh được TỰ sửa (lưu ngay). key => nhãn */
    public const PROFILE_DIRECT = [
        'phone' => 'Số điện thoại', 'current_address' => 'Địa chỉ hiện tại',
        'emergency_name' => 'Người liên hệ khẩn cấp', 'emergency_relation' => 'Quan hệ', 'emergency_phone' => 'SĐT khẩn cấp',
        'blood_type' => 'Nhóm máu', 'height_cm' => 'Chiều cao', 'weight_kg' => 'Cân nặng', 'health_note' => 'Ghi chú sức khỏe',
    ];

    /** Trường phải GỬI YÊU CẦU để nhà trường duyệt. key => nhãn */
    public const PROFILE_REQUEST = [
        'full_name' => 'Họ và tên', 'birth_date' => 'Ngày sinh', 'gender' => 'Giới tính',
        'ethnicity' => 'Dân tộc', 'religion' => 'Tôn giáo', 'birth_place' => 'Nơi sinh', 'hometown' => 'Quê quán',
        'permanent_address' => 'Địa chỉ thường trú',
        'father_name' => 'Họ tên bố', 'father_job' => 'Nghề nghiệp của bố', 'father_phone' => 'SĐT của bố',
        'mother_name' => 'Họ tên mẹ', 'mother_job' => 'Nghề nghiệp của mẹ', 'mother_phone' => 'SĐT của mẹ',
        'guardian_name' => 'Họ tên người giám hộ', 'guardian_relation' => 'Quan hệ với người giám hộ', 'guardian_phone' => 'SĐT người giám hộ',
    ];

    private const PROFILE_PHONE_KEYS = ['phone', 'emergency_phone', 'father_phone', 'mother_phone', 'guardian_phone'];

    private static function normPhone(string $v): ?string
    {
        $d = preg_replace('/[\s.\-()]/', '', $v);
        if (str_starts_with($d, '+84')) {
            $d = '0' . substr($d, 3);
        }
        return preg_match('/^0\d{9}$/', $d) ? $d : null;
    }

    private static function classify(?float $avg): ?string
    {
        if ($avg === null) {
            return null;
        }
        return $avg >= 8 ? 'Giỏi' : ($avg >= 6.5 ? 'Khá' : ($avg >= 5 ? 'Trung bình' : ($avg >= 3.5 ? 'Yếu' : 'Kém')));
    }

    /** Điểm trung bình các môn tính điểm theo từng năm / học kỳ + hạnh kiểm. @return array<int,array<string,mixed>> */
    private function academicByYear(int $studentId): array
    {
        $avg = [];
        foreach ($this->all(
            'SELECT g.school_year_id AS y, g.semester AS s, g.tbm FROM sm_grades g JOIN sm_subjects sj ON sj.id = g.subject_id
              WHERE g.student_id = ? AND sj.kind <> ? AND g.tbm IS NOT NULL', [$studentId, 'pass']) as $r) {
            $avg[(int) $r['y']][(int) $r['s']][] = (float) $r['tbm'];
        }
        $conduct = [];
        foreach ($this->all('SELECT school_year_id, hk1, hk2, year_result FROM sm_conduct WHERE student_id = ?', [$studentId]) as $c) {
            $conduct[(int) $c['school_year_id']] = $c;
        }
        $out = [];
        foreach ($this->all(
            'SELECT y.id, y.label, y.is_current, c.name AS class_name, c.grade, t.full_name AS homeroom
               FROM sm_enrollments e JOIN sm_school_years y ON y.id = e.school_year_id JOIN sm_classes c ON c.id = e.class_id
          LEFT JOIN sm_teachers t ON t.id = c.homeroom_teacher_id
              WHERE e.student_id = ? ORDER BY y.start_date', [$studentId]) as $y) {
            $id = (int) $y['id'];
            $m = fn ($sem) => isset($avg[$id][$sem]) ? round(array_sum($avg[$id][$sem]) / count($avg[$id][$sem]), 2) : null;
            $h1 = $m(1);
            $h2 = $m(2);
            $yr = $h1 !== null && $h2 !== null ? round(($h1 + 2 * $h2) / 3, 2) : ($h1 ?? $h2);
            $out[] = [
                'year' => $y['label'], 'is_current' => (int) $y['is_current'] === 1, 'class' => $y['class_name'], 'grade' => (int) $y['grade'],
                'homeroom' => $y['homeroom'], 'hk1' => $h1, 'hk2' => $h2, 'avg' => $yr, 'rank' => self::classify($yr),
                'conduct_hk1' => $conduct[$id]['hk1'] ?? null, 'conduct_hk2' => $conduct[$id]['hk2'] ?? null, 'conduct_year' => $conduct[$id]['year_result'] ?? null,
            ];
        }
        return $out;
    }

    /** @return array<string,mixed>|null */
        private function profileRow(int $studentId): ?array
        {
            try {
                $row = $this->one('SELECT * FROM sm_student_profiles WHERE student_id = ?', [$studentId]);
                return $row ? DataCrypto::decryptFields($row) : null;
            } catch (\Throwable $e) {
                return null; // chưa chạy SQL hồ sơ
            }
        }

    /** @return array<int,array<string,mixed>> */
    private function requestsOf(int $studentId): array
    {
        try {
            $rows = $this->all('SELECT id, field_key, old_value, new_value, reason, status, review_note, created_at, reviewed_at
                                  FROM sm_profile_requests WHERE student_id = ? ORDER BY id DESC LIMIT 50', [$studentId]);
        } catch (\Throwable $e) {
            return [];
        }
        return array_map(fn ($r) => [
            'id' => (int) $r['id'], 'field' => $r['field_key'], 'field_label' => self::PROFILE_REQUEST[$r['field_key']] ?? $r['field_key'],
            'old_value' => $r['old_value'], 'new_value' => $r['new_value'], 'reason' => $r['reason'], 'status' => $r['status'],
            'review_note' => $r['review_note'], 'created_at' => $r['created_at'], 'reviewed_at' => $r['reviewed_at'],
        ], $rows);
    }

    /**
     * Toàn bộ hồ sơ cá nhân cho trang "Thông tin cá nhân".
     *
     * @return array<string,mixed>|null
     */
    public function fullProfile(int $studentId, int $accountId): ?array
    {
        $st = $this->one('SELECT id, code, full_name, gender, birth_date, admission_year FROM sm_students WHERE id = ?', [$studentId]);
        if (!$st) {
            return null;
        }
        $acc = $this->one('SELECT username, email FROM sm_accounts WHERE id = ?', [$accountId]);
        $pr = $this->profileRow($studentId);
        $ready = $pr !== null;
        $g = fn ($k) => ($pr[$k] ?? null) === '' ? null : ($pr[$k] ?? null);
        $iso = substr((string) $st['birth_date'], 0, 10);
        $age = $iso ? (int) floor(($this->now() - strtotime($iso)) / (365.25 * 86400)) : null;

        $acad = $this->academicByYear($studentId);
        $current = null;
        foreach ($acad as $a) {
            if ($a['is_current']) {
                $current = $a;
            }
        }
        $h = $g('height_cm');
        $w = $g('weight_kg');
        $bmi = $h && $w ? round($w / (($h / 100) ** 2), 1) : null;
        $realEmail = $acc && !preg_match('/@thpt\.edu\.vn$/i', (string) $acc['email']);

        // Mức độ hoàn thiện hồ sơ
        $must = [
            'phone' => ['Số điện thoại của bạn', $g('phone'), 'contact'],
            'current_address' => ['Địa chỉ hiện tại', $g('current_address'), 'contact'],
            'emergency_phone' => ['Liên hệ khẩn cấp', $g('emergency_phone'), 'contact'],
            'blood_type' => ['Nhóm máu', $g('blood_type'), 'contact'],
            'height_cm' => ['Chiều cao, cân nặng', $h && $w ? '1' : null, 'contact'],
            'email' => ['Gmail khôi phục mật khẩu', $realEmail ? '1' : null, 'overview'],
            'father_phone' => ['SĐT của bố hoặc mẹ', $g('father_phone') ?? $g('mother_phone'), 'family'],
            'permanent_address' => ['Địa chỉ thường trú', $g('permanent_address'), 'personal'],
        ];
        $missing = [];
        foreach ($must as $k => [$label, $val, $tab]) {
            if ($val === null || $val === '') {
                $missing[] = ['key' => $k, 'label' => $label, 'tab' => $tab];
            }
        }
        $percent = (int) round((count($must) - count($missing)) / count($must) * 100);

        return [
            'ready' => $ready,
            'student' => [
                'id' => (int) $st['id'], 'code' => $st['code'], 'full_name' => $st['full_name'], 'gender' => $st['gender'],
                'birth_date' => self::dmy($st['birth_date']), 'birth_date_iso' => $iso, 'age' => $age,
                'admission_year' => (int) $st['admission_year'],
            ],
            'class' => $current ? ['name' => $current['class'], 'grade' => $current['grade'], 'homeroom' => $current['homeroom'], 'year' => $current['year']] : null,
            'account' => ['username' => $acc['username'] ?? null, 'email' => $realEmail ? $acc['email'] : null, 'email_linked' => $realEmail],
            'personal' => [
                'ethnicity' => $g('ethnicity'), 'religion' => $g('religion'), 'birth_place' => $g('birth_place'), 'hometown' => $g('hometown'),
                'permanent_address' => $g('permanent_address'),
                'youth_union' => (int) ($pr['youth_union'] ?? 0) === 1, 'youth_union_date' => self::dmy($pr['youth_union_date'] ?? null),
            ],
            'contact' => [
                'phone' => $g('phone'), 'current_address' => $g('current_address'),
                'emergency_name' => $g('emergency_name'), 'emergency_relation' => $g('emergency_relation'), 'emergency_phone' => $g('emergency_phone'),
            ],
            'family' => [
                'father' => ['name' => $g('father_name'), 'job' => $g('father_job'), 'phone' => $g('father_phone'), 'birth_year' => $g('father_birth_year') ? (int) $g('father_birth_year') : null],
                'mother' => ['name' => $g('mother_name'), 'job' => $g('mother_job'), 'phone' => $g('mother_phone'), 'birth_year' => $g('mother_birth_year') ? (int) $g('mother_birth_year') : null],
                'guardian' => ['name' => $g('guardian_name'), 'relation' => $g('guardian_relation'), 'phone' => $g('guardian_phone')],
            ],
            'health' => ['blood_type' => $g('blood_type'), 'height_cm' => $h ? (int) $h : null, 'weight_kg' => $w ? (int) $w : null, 'bmi' => $bmi, 'note' => $g('health_note')],
            'academic' => ['current' => $current, 'history' => array_reverse($acad)],
            'requests' => $this->requestsOf($studentId),
            'completeness' => ['percent' => $percent, 'missing' => $missing],
            'fields' => ['direct' => self::PROFILE_DIRECT, 'request' => self::PROFILE_REQUEST],
            'updated_at' => $pr['updated_at'] ?? null,
        ];
    }

    /** Học sinh tự cập nhật thông tin liên hệ + sức khỏe (chỉ các khóa trong PROFILE_DIRECT). */
    public function updateContact(int $studentId, array $in): array
    {
        if ($this->profileRow($studentId) === null && !$this->ensureProfileRow($studentId)) {
            return ['ok' => false, 'status' => 503, 'message' => 'Hồ sơ chưa được khởi tạo. Vui lòng liên hệ nhà trường.'];
        }
        $set = [];
        $errors = [];
        foreach (self::PROFILE_DIRECT as $k => $label) {
            if (!array_key_exists($k, $in)) {
                continue;
            }
            $v = is_string($in[$k]) ? trim($in[$k]) : $in[$k];
            if ($v === '' || $v === null) {
                $set[$k] = null;
                continue;
            }
            if (in_array($k, self::PROFILE_PHONE_KEYS, true)) {
                $n = self::normPhone((string) $v);
                if ($n === null) {
                    $errors[$k] = 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0.';
                    continue;
                }
                $set[$k] = $n;
            } elseif ($k === 'blood_type') {
                if (!in_array($v, ['A', 'B', 'AB', 'O'], true)) {
                    $errors[$k] = 'Nhóm máu chỉ gồm A, B, AB hoặc O.';
                    continue;
                }
                $set[$k] = $v;
            } elseif ($k === 'height_cm' || $k === 'weight_kg') {
                [$lo, $hi] = $k === 'height_cm' ? [100, 230] : [25, 200];
                if (!is_numeric($v) || (int) $v < $lo || (int) $v > $hi) {
                    $errors[$k] = "{$label} phải từ {$lo} đến {$hi}.";
                    continue;
                }
                $set[$k] = (int) $v;
            } else {
                $max = $k === 'current_address' ? 200 : ($k === 'health_note' ? 255 : ($k === 'emergency_relation' ? 30 : 80));
                if (mb_strlen((string) $v) > $max) {
                    $errors[$k] = "{$label} tối đa {$max} ký tự.";
                    continue;
                }
                $set[$k] = (string) $v;
            }
        }
        if ($errors) {
            return ['ok' => false, 'status' => 422, 'message' => 'Thông tin chưa hợp lệ, vui lòng kiểm tra lại.', 'errors' => $errors];
        }
        if (!$set) {
            return ['ok' => false, 'status' => 422, 'message' => 'Không có thông tin nào để cập nhật.'];
        }

        // Mã hóa PII trước khi ghi DB (phone, địa chỉ, health_note, ...)
        $set = DataCrypto::encryptFields($set);

        $cols = implode(', ', array_map(fn ($c) => "$c = ?", array_keys($set)));
        $this->run(
            "UPDATE sm_student_profiles SET $cols, updated_at = ? WHERE student_id = ?",
            [...array_values($set), $this->ts($this->now()), $studentId]
        );

        return ['ok' => true, 'status' => 200, 'message' => 'Đã lưu thông tin.'];
    }

    private function ensureProfileRow(int $studentId): bool
    {
        try {
            $this->run('INSERT INTO sm_student_profiles (student_id, youth_union, updated_at) VALUES (?, 0, ?)', [$studentId, $this->ts($this->now())]);
            return true;
        } catch (\Throwable $e) {
            return false;
        }
    }

    /** Gửi yêu cầu chỉnh sửa thông tin cần nhà trường duyệt. */
    public function createProfileRequest(int $studentId, string $field, string $newValue, string $reason): array
    {
        if (!isset(self::PROFILE_REQUEST[$field])) {
            return ['ok' => false, 'status' => 422, 'message' => 'Thông tin này không nằm trong danh sách được yêu cầu chỉnh sửa.'];
        }
        $newValue = trim($newValue);
        $reason = trim($reason);
        if ($newValue === '' || mb_strlen($newValue) > 200) {
            return ['ok' => false, 'status' => 422, 'message' => 'Giá trị mới không được để trống và tối đa 200 ký tự.'];
        }
        if (mb_strlen($reason) < 5 || mb_strlen($reason) > 255) {
            return ['ok' => false, 'status' => 422, 'message' => 'Vui lòng nhập lý do (5–255 ký tự).'];
        }
        if (in_array($field, self::PROFILE_PHONE_KEYS, true)) {
            $n = self::normPhone($newValue);
            if ($n === null) {
                return ['ok' => false, 'status' => 422, 'message' => 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0.'];
            }
            $newValue = $n;
        } elseif ($field === 'birth_date') {
            if (preg_match('#^(\d{1,2})/(\d{1,2})/(\d{4})$#', $newValue, $m) && checkdate((int) $m[2], (int) $m[1], (int) $m[3])) {
                $newValue = sprintf('%04d-%02d-%02d', $m[3], $m[2], $m[1]);
            } elseif (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $newValue) || !checkdate((int) substr($newValue, 5, 2), (int) substr($newValue, 8, 2), (int) substr($newValue, 0, 4))) {
                return ['ok' => false, 'status' => 422, 'message' => 'Ngày sinh không hợp lệ (dạng dd/mm/yyyy).'];
            }
        } elseif ($field === 'gender' && !in_array($newValue, ['Nam', 'Nữ'], true)) {
            return ['ok' => false, 'status' => 422, 'message' => 'Giới tính chỉ gồm Nam hoặc Nữ.'];
        }

        try {
            $pending = $this->all('SELECT field_key FROM sm_profile_requests WHERE student_id = ? AND status = ?', [$studentId, 'pending']);
        } catch (\Throwable $e) {
            return ['ok' => false, 'status' => 503, 'message' => 'Chức năng yêu cầu chỉnh sửa chưa được kích hoạt. Vui lòng liên hệ nhà trường.'];
        }
        if (count($pending) >= 5) {
            return ['ok' => false, 'status' => 422, 'message' => 'Bạn đang có 5 yêu cầu chờ duyệt. Vui lòng chờ nhà trường xử lý.'];
        }
        foreach ($pending as $p) {
            if ($p['field_key'] === $field) {
                return ['ok' => false, 'status' => 422, 'message' => 'Bạn đã có một yêu cầu chờ duyệt cho thông tin này.'];
            }
        }

        // Giá trị hiện tại
        if (in_array($field, ['full_name', 'birth_date', 'gender'], true)) {
            $old = ($this->one("SELECT $field AS v FROM sm_students WHERE id = ?", [$studentId]))['v'] ?? null;
            if ($field === 'birth_date') {
                $old = self::dmy($old);
            }
        } else {
            $old = ($this->profileRow($studentId))[$field] ?? null;
        }
        if ($field === 'birth_date') {
            $newShown = self::dmy($newValue);
            if ($newShown === $old) {
                return ['ok' => false, 'status' => 422, 'message' => 'Giá trị mới trùng với thông tin hiện tại.'];
            }
        } elseif ((string) $old === $newValue) {
            return ['ok' => false, 'status' => 422, 'message' => 'Giá trị mới trùng với thông tin hiện tại.'];
        }
        $storeNew = $field === 'birth_date' ? self::dmy($newValue) : $newValue;
        $this->run('INSERT INTO sm_profile_requests (student_id, field_key, old_value, new_value, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [$studentId, $field, $old, $storeNew, $reason, 'pending', $this->ts($this->now())]);

        return ['ok' => true, 'status' => 200, 'message' => 'Đã gửi yêu cầu. Nhà trường sẽ xem xét và phản hồi.'];
    }

    /** Học sinh tự hủy yêu cầu còn chờ duyệt của mình. */
    public function cancelProfileRequest(int $studentId, int $requestId): array
    {
        try {
            $st = $this->pdo->prepare('UPDATE sm_profile_requests SET status = ?, reviewed_at = ? WHERE id = ? AND student_id = ? AND status = ?');
            $st->execute(['cancelled', $this->ts($this->now()), $requestId, $studentId, 'pending']);
        } catch (\Throwable $e) {
            return ['ok' => false, 'status' => 503, 'message' => 'Chức năng yêu cầu chỉnh sửa chưa được kích hoạt.'];
        }

        return $st->rowCount() > 0
            ? ['ok' => true, 'status' => 200, 'message' => 'Đã hủy yêu cầu.']
            : ['ok' => false, 'status' => 404, 'message' => 'Không tìm thấy yêu cầu đang chờ duyệt.'];
    }

    /* ------------------------------------------------------------------ hồ sơ */

    /** @return array<string,mixed>|null */
    public function profile(int $studentId): ?array
    {
        $r = $this->one(
            'SELECT s.id, s.code, s.full_name, s.gender, s.birth_date,
                    c.id AS class_id, c.name AS class_name, c.grade, y.id AS year_id, y.label AS year_label,
                    t.full_name AS homeroom
               FROM sm_students s
               JOIN sm_enrollments e ON e.student_id = s.id
               JOIN sm_school_years y ON y.id = e.school_year_id AND y.is_current = 1
               JOIN sm_classes c ON c.id = e.class_id
          LEFT JOIN sm_teachers t ON t.id = c.homeroom_teacher_id
              WHERE s.id = ?',
            [$studentId]
        );
        if (!$r) {
            $s = $this->one('SELECT id, code, full_name, gender, birth_date FROM sm_students WHERE id = ?', [$studentId]);
            if (!$s) {
                return null;
            }
            return ['id' => (int) $s['id'], 'code' => $s['code'], 'name' => $s['full_name'], 'gender' => $s['gender'],
                'birth_date' => self::dmy($s['birth_date']), 'class' => null, 'year' => null];
        }
        return [
            'id' => (int) $r['id'],
            'code' => $r['code'],
            'name' => $r['full_name'],
            'gender' => $r['gender'],
            'birth_date' => self::dmy($r['birth_date']),
            'class' => ['id' => (int) $r['class_id'], 'name' => $r['class_name'], 'grade' => (int) $r['grade'], 'homeroom_teacher' => $r['homeroom']],
            'year' => ['id' => (int) $r['year_id'], 'label' => $r['year_label']],
        ];
    }

    /* ------------------------------------------------------------------ thời khóa biểu */

    /** @return array<string,mixed>|null */
    public function schedule(int $studentId): ?array
    {
        $p = $this->profile($studentId);
        if (!$p || !$p['class']) {
            return null;
        }
        $periods = array_map(
            fn ($r) => ['period' => (int) $r['id'], 'start' => self::hm($r['start_time']), 'end' => self::hm($r['end_time'])],
            $this->all('SELECT id, start_time, end_time FROM sm_periods ORDER BY id')
        );
        $rows = $this->all(
            'SELECT tt.weekday, tt.period, s.name AS subject, s.code AS subject_code, t.full_name AS teacher
               FROM sm_timetable tt
               JOIN sm_class_subjects cs ON cs.id = tt.class_subject_id
               JOIN sm_subjects s ON s.id = cs.subject_id
               JOIN sm_teachers t ON t.id = cs.teacher_id
              WHERE tt.class_id = ?
              ORDER BY tt.weekday, tt.period',
            [$p['class']['id']]
        );
        $byDay = [];
        foreach ($rows as $r) {
            $byDay[(int) $r['weekday']][] = [
                'period' => (int) $r['period'],
                'subject' => $r['subject'],
                'subject_code' => $r['subject_code'],
                'teacher' => $r['teacher'],
            ];
        }
        $days = [];
        foreach ($byDay as $wd => $lessons) {
            $days[] = ['weekday' => $wd, 'label' => self::WEEKDAY_LABEL[$wd] ?? "Thứ $wd", 'lessons' => $lessons];
        }
                return [
                    'student' => ['code' => $p['code'], 'name' => $p['name']],
                    'class' => $p['class'],
                    'year' => $p['year'],
                    'periods' => $periods,
                    'days' => $days,
                    'total_periods' => count($rows),
                ];
            }

            /* ------------------------------------------------------------------ danh sách học sinh cùng lớp */

            /** @return array<string,mixed>|null */
            public function classmates(int $studentId): ?array
            {
                $p = $this->profile($studentId);
                if (!$p || empty($p['class'])) {
                    return null;
                }

                $rows = $this->all(
                    'SELECT s.id, s.code, s.full_name
                       FROM sm_enrollments e
                       JOIN sm_students s ON s.id = e.student_id
                       JOIN sm_school_years y ON y.id = e.school_year_id AND y.is_current = 1
                      WHERE e.class_id = ?
                      ORDER BY s.full_name',
                    [(int) $p['class']['id']]
                );

                $students = [];
                foreach ($rows as $i => $r) {
                    $students[] = [
                        'stt'  => $i + 1,
                        'id'   => (int) $r['id'],
                        'code' => $r['code'],
                        'name' => $r['full_name'],
                    ];
                }

                return [
                    'class'    => $p['class'],
                    'year'     => $p['year'],
                    'students' => $students,
                ];
            }

            /* ------------------------------------------------------------------ lịch thi */

    /** @return array<string,mixed>|null */
    public function exams(int $studentId): ?array
    {
        $p = $this->profile($studentId);
        if (!$p || !$p['class']) {
            return null;
        }
        $rows = $this->all(
            'SELECT p.id AS pid, p.code, p.name, p.semester, p.start_date, p.end_date,
                    e.exam_date, e.start_time, e.duration_minutes, e.exam_format,
                    s.name AS subject, s.code AS subject_code
               FROM sm_exam_periods p
               JOIN sm_exam_schedules e ON e.exam_period_id = p.id AND e.grade = ?
               JOIN sm_subjects s ON s.id = e.subject_id
              WHERE p.school_year_id = ?
              ORDER BY p.start_date, e.exam_date, e.start_time',
            [$p['class']['grade'], $p['year']['id']]
        );
        $today = date('Y-m-d', $this->now());
        $periods = [];
        foreach ($rows as $r) {
            $pid = (int) $r['pid'];
            if (!isset($periods[$pid])) {
                $periods[$pid] = [
                    'id' => $pid, 'code' => $r['code'], 'name' => $r['name'], 'semester' => (int) $r['semester'],
                    'start_date' => $r['start_date'], 'end_date' => $r['end_date'], 'items' => [],
                ];
            }
            $d = substr($r['exam_date'], 0, 10);
            $startTs = strtotime($d . ' ' . self::hm($r['start_time']));
            $dur = (int) $r['duration_minutes'];
            $wd = (int) date('N', strtotime($d)) + 1; // 2 = Thứ Hai … 8 = Chủ nhật
            $periods[$pid]['items'][] = [
                'date' => $d,
                'weekday' => $wd,
                'weekday_label' => self::WEEKDAY_LABEL[$wd],
                'start' => self::hm($r['start_time']),
                'end' => date('H:i', $startTs + $dur * 60),
                'duration_minutes' => $dur,
                'subject' => $r['subject'],
                'subject_code' => $r['subject_code'],
                'format' => $r['exam_format'],
                'status' => $d < $today ? 'done' : ($d === $today ? 'today' : 'upcoming'),
            ];
        }
        return [
            'student' => ['code' => $p['code'], 'name' => $p['name']],
            'class' => $p['class'],
            'year' => $p['year'],
            'today' => $today,
            'periods' => array_values($periods),
        ];
    }

    /* ------------------------------------------------------------------ bảng điểm (tất cả năm học) */

    /** @return array<string,mixed>|null */
    public function grades(int $studentId): ?array
    {
        $s = $this->one('SELECT id, code, full_name FROM sm_students WHERE id = ?', [$studentId]);
        if (!$s) {
            return null;
        }
        $years = $this->all(
            'SELECT y.id, y.label, y.is_current, c.name AS class_name, c.grade
               FROM sm_enrollments e
               JOIN sm_school_years y ON y.id = e.school_year_id
               JOIN sm_classes c ON c.id = e.class_id
              WHERE e.student_id = ?
              ORDER BY y.start_date',
            [$studentId]
        );
        $conduct = [];
        foreach ($this->all('SELECT school_year_id, hk1, hk2, year_result FROM sm_conduct WHERE student_id = ?', [$studentId]) as $c) {
            $conduct[(int) $c['school_year_id']] = ['hk1' => $c['hk1'], 'hk2' => $c['hk2'], 'year' => $c['year_result']];
        }
        $rows = $this->all(
            'SELECT g.id, g.school_year_id, g.semester, g.tx1, g.tx2, g.tx3, g.tx4, g.gk, g.ck, g.tbm, g.assessment, g.updated_at,
                    s.name AS subject, s.kind, t.full_name AS teacher
               FROM sm_grades g
               JOIN sm_subjects s ON s.id = g.subject_id
          LEFT JOIN sm_teachers t ON t.id = g.teacher_id
              WHERE g.student_id = ?
              ORDER BY g.school_year_id, g.semester, s.sort_order',
            [$studentId]
        );
        $bySem = [];
        foreach ($rows as $r) {
            $isPass = $r['kind'] === 'pass';
            $bySem[(int) $r['school_year_id']][(int) $r['semester']][] = [
                'id' => (string) $r['id'],
                'subject' => $r['subject'],
                'type' => $isPass ? 'pass' : 'score',
                'teacher_name' => $r['teacher'],
                'updated_at' => self::dmy($r['updated_at']),
                'tx' => [self::num($r['tx1']), self::num($r['tx2']), self::num($r['tx3']), self::num($r['tx4'])],
                'gk' => self::num($r['gk']),
                'ck' => self::num($r['ck']),
                'tbm' => self::num($r['tbm']),
                'rank' => $isPass ? $r['assessment'] : null,
            ];
        }
        $out = [];
        foreach ($years as $y) {
            $yid = (int) $y['id'];
            $out[] = [
                'id' => (string) $yid,
                'label' => $y['label'],
                'is_current' => (int) $y['is_current'] === 1,
                'class_name' => $y['class_name'],
                'grade' => (int) $y['grade'],
                'conduct' => $conduct[$yid] ?? new \stdClass(),
                'semesters' => ['hk1' => $bySem[$yid][1] ?? [], 'hk2' => $bySem[$yid][2] ?? []],
            ];
        }
        return ['student' => ['code' => $s['code'], 'name' => $s['full_name']], 'years' => $out];
    }
}
