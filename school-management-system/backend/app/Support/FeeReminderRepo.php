<?php

namespace App\Support;

use PDO;
use Throwable;

/**
 * Nhắc nợ phụ huynh (/api/kt/reminders/*): đề xuất, soạn từ mẫu, gửi theo đợt, theo dõi đã đọc, đo hiệu quả.
 * Kênh "inapp" gửi ngay vào cổng học sinh; "sms", "zalo", "print" tạo danh sách chờ gửi để kế toán xuất/in rồi đánh dấu đã gửi.
 * Công nợ lấy từ FeeDebtRepo (cùng một cách tính với trang Công nợ).
 */
class FeeReminderRepo
{
    public const PER_PAGE = 20;
    public const MAX_PER = 500;
    public const MAX_SEND = 500;
    public const CHANNELS = [
        'inapp' => ['label' => 'Thông báo trên cổng học sinh', 'hint' => 'Gửi ngay. Học sinh và phụ huynh thấy khi đăng nhập cổng học sinh.', 'instant' => true],
        'sms' => ['label' => 'Tin nhắn SMS', 'hint' => 'Tạo danh sách chờ gửi. Xuất file, gửi bằng đầu số của trường, rồi đánh dấu đã gửi.', 'instant' => false],
        'zalo' => ['label' => 'Zalo', 'hint' => 'Tạo danh sách chờ gửi. Xuất file, gửi qua Zalo, rồi đánh dấu đã gửi.', 'instant' => false],
        'print' => ['label' => 'In giấy báo nợ', 'hint' => 'Tạo danh sách chờ gửi. In giấy báo phát cho học sinh, rồi đánh dấu đã gửi.', 'instant' => false],
    ];
    public const LEVELS = [1 => 'Nhắc nhẹ', 2 => 'Nhắc quá hạn', 3 => 'Nhắc lần cuối'];
    public const PLACEHOLDERS = [
        'ten_hs' => 'Họ tên học sinh', 'ma_hs' => 'Mã học sinh', 'lop' => 'Lớp', 'so_tien_no' => 'Tổng số tiền còn nợ', 'tien_qua_han' => 'Số tiền đã quá hạn',
        'han_nop' => 'Hạn nộp gần nhất', 'so_hoa_don' => 'Số hóa đơn còn nợ', 'so_ngay_qua_han' => 'Số ngày quá hạn', 'ten_truong' => 'Tên trường',
        'thong_tin_thanh_toan' => 'Cách đóng tiền', 'lien_he' => 'Nơi liên hệ', 'nguoi_gui' => 'Người gửi', 'ngay_hen' => 'Ngày phụ huynh hẹn trả', 'tien_hen' => 'Số tiền hẹn trả',
    ];
    public const DEFAULT_TEMPLATES = [
        'NHAC_NHE' => [
            'name' => 'Nhắc nhẹ – học phí chưa đóng', 'level' => 1,
            'subject' => 'Thông báo học phí của học sinh {ten_hs}',
            'body' => "Kính gửi Quý phụ huynh học sinh {ten_hs} (mã {ma_hs}, lớp {lop}).\n{ten_truong} xin thông báo: hiện còn {so_hoa_don} hóa đơn học phí chưa đóng, tổng số tiền {so_tien_no}. Hạn nộp gần nhất: {han_nop}.\n{thong_tin_thanh_toan}\nNếu Quý phụ huynh đã đóng, xin bỏ qua thông báo này. Trân trọng cảm ơn.\n{lien_he}",
        ],
        'NHAC_QUA_HAN' => [
            'name' => 'Nhắc quá hạn', 'level' => 2,
            'subject' => 'Nhắc nộp học phí quá hạn – {ten_hs}',
            'body' => "Kính gửi Quý phụ huynh học sinh {ten_hs} (mã {ma_hs}, lớp {lop}).\nKhoản học phí của học sinh đã quá hạn {so_ngay_qua_han} ngày. Số tiền còn nợ: {so_tien_no} (trong đó quá hạn {tien_qua_han}).\n{thong_tin_thanh_toan}\nNếu gia đình gặp khó khăn, xin liên hệ nhà trường để được hướng dẫn hoặc thỏa thuận ngày đóng. Trân trọng cảm ơn.\n{lien_he}",
        ],
        'NHAC_LAN_CUOI' => [
            'name' => 'Nhắc lần cuối – quá hạn lâu', 'level' => 3,
            'subject' => 'Thông báo cuối về học phí quá hạn {so_ngay_qua_han} ngày – {ten_hs}',
            'body' => "Kính gửi Quý phụ huynh học sinh {ten_hs} (mã {ma_hs}, lớp {lop}).\nNhà trường đã nhắc nhiều lần nhưng khoản học phí vẫn chưa được thanh toán: còn nợ {so_tien_no}, quá hạn {so_ngay_qua_han} ngày.\nKính mời Quý phụ huynh đến phòng Kế toán trong thời gian sớm nhất để đóng hoặc đăng ký ngày trả cụ thể.\n{thong_tin_thanh_toan}\n{lien_he}",
        ],
        'NHAC_LOI_HEN' => [
            'name' => 'Nhắc lời hẹn trả', 'level' => 1,
            'subject' => 'Nhắc lịch hẹn đóng học phí – {ten_hs}',
            'body' => "Kính gửi Quý phụ huynh học sinh {ten_hs} (mã {ma_hs}, lớp {lop}).\nTheo thỏa thuận, gia đình sẽ đóng {tien_hen} học phí vào ngày {ngay_hen}. Hiện học sinh còn nợ {so_tien_no}.\n{thong_tin_thanh_toan}\nXin cảm ơn Quý phụ huynh đã phối hợp.\n{lien_he}",
        ],
    ];

    /** @var callable */
    private $clock;

    public function __construct(private PDO $pdo, ?callable $clock = null)
    {
        $this->clock = $clock ?? fn () => time();
    }

    private function now(): int
    {
        return (int) ($this->clock)();
    }

    private function ts(): string
    {
        return date('Y-m-d H:i:s', $this->now());
    }

    private function today(): string
    {
        return date('Y-m-d', $this->now());
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

    private static function fail(string $msg, int $status = 422, array $extra = []): array
    {
        return ['ok' => false, 'status' => $status, 'message' => $msg] + $extra;
    }

    private function dt(?string $v): ?string
    {
        $t = $v ? strtotime($v) : false;
        return $t ? date('H:i d/m/Y', $t) : null;
    }

    private static function vnd(int $n): string
    {
        return number_format($n, 0, ',', '.') . 'đ';
    }

    private static function dmy(?string $d): string
    {
        return $d ? implode('/', array_reverse(explode('-', substr($d, 0, 10)))) : '';
    }

    /** @return array<int,int> */
    private static function cleanIds(mixed $ids): array
    {
        return is_array($ids) ? array_values(array_unique(array_filter(array_map('intval', $ids), fn ($x) => $x > 0))) : [];
    }

    private function debt(): FeeDebtRepo
    {
        return new FeeDebtRepo($this->pdo, $this->clock);
    }

    /* ================================================================== cài đặt và mẫu */

    /** @return array<string,string> */
    private function settingsRaw(): array
    {
        $o = [];
        foreach ($this->all('SELECT skey, svalue FROM sm_fee_settings') as $r) {
            $o[$r['skey']] = (string) $r['svalue'];
        }
        return $o;
    }

    /** @return array<string,mixed> */
    public function settings(): array
    {
        $s = $this->settingsRaw();
        $gap = (int) ($s['reminder_gap_days'] ?? 3);
        $pay = trim($s['reminder_payment_info'] ?? '');
        $auto = '';
        if ($pay === '') {
            $auto = !empty($s['account_no'])
                ? 'Chuyển khoản: ' . ($s['bank_short'] ?? $s['bank_name'] ?? 'ngân hàng') . ' – STK ' . $s['account_no'] . ($s['account_name'] ?? '' ? ' – ' . $s['account_name'] : '') . '. ' . ($s['transfer_hint'] ?? '')
                : 'Phụ huynh đóng tiền mặt tại phòng Kế toán trong giờ hành chính.';
        }

        return [
            'gap_days' => min(30, max(1, $gap)), 'school_name' => $s['school_name'] ?? 'Trường THPT',
            'contact' => trim($s['reminder_contact'] ?? '') !== '' ? trim($s['reminder_contact']) : 'Phòng Kế toán nhà trường',
            'payment_info' => $pay, 'payment_info_effective' => $pay !== '' ? $pay : trim($auto),
        ];
    }

    /**
     * @param array<string,mixed> $staff
     * @param array<string,mixed> $d gap_days, contact, payment_info
     * @return array<string,mixed>
     */
    public function saveSettings(array $staff, array $d): array
    {
        $errors = [];
        $gap = (int) ($d['gap_days'] ?? 0);
        if ($gap < 1 || $gap > 30) {
            $errors['gap_days'] = 'Khoảng cách giữa hai lần nhắc từ 1 đến 30 ngày.';
        }
        $contact = trim((string) ($d['contact'] ?? ''));
        if (mb_strlen($contact) > 120) {
            $errors['contact'] = 'Tối đa 120 ký tự.';
        }
        $pay = trim((string) ($d['payment_info'] ?? ''));
        if (mb_strlen($pay) > 255) {
            $errors['payment_info'] = 'Tối đa 255 ký tự.';
        }
        if ($errors) {
            return self::fail('Vui lòng kiểm tra lại thông tin.', 422, ['errors' => $errors]);
        }
        foreach (['reminder_gap_days' => (string) $gap, 'reminder_contact' => $contact, 'reminder_payment_info' => $pay] as $k => $v) {
            if ($this->one('SELECT skey FROM sm_fee_settings WHERE skey = ?', [$k])) {
                $this->run('UPDATE sm_fee_settings SET svalue = ? WHERE skey = ?', [$v, $k]);
            } else {
                $this->run('INSERT INTO sm_fee_settings (skey, svalue) VALUES (?, ?)', [$k, $v]);
            }
        }

        return ['ok' => true, 'status' => 200, 'message' => 'Đã lưu cài đặt nhắc nợ.', 'settings' => $this->settings()];
    }

    /** Tạo các mẫu mặc định còn thiếu (theo mã). */
    private function seedDefaults(): void
    {
        $have = array_column($this->all('SELECT code FROM sm_reminder_templates'), 'code');
        foreach (self::DEFAULT_TEMPLATES as $code => $t) {
            if (!in_array($code, $have, true)) {
                $this->run('INSERT INTO sm_reminder_templates (code, name, level, subject, body, is_active, is_system, created_by, created_at) VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)',
                    [$code, $t['name'], $t['level'], $t['subject'], $t['body'], 'Hệ thống', $this->ts()]);
            }
        }
    }

    /** @return array<int,array<string,mixed>> */
    public function templates(): array
    {
        $this->seedDefaults();
        $use = [];
        foreach ($this->all('SELECT template_id, COUNT(*) AS n FROM sm_reminder_batches WHERE template_id IS NOT NULL GROUP BY template_id') as $r) {
            $use[(int) $r['template_id']] = (int) $r['n'];
        }

        return array_map(fn ($t) => [
            'id' => (int) $t['id'], 'code' => $t['code'], 'name' => $t['name'], 'level' => (int) $t['level'], 'level_label' => self::LEVELS[(int) $t['level']] ?? '',
            'subject' => $t['subject'], 'body' => $t['body'], 'active' => (int) $t['is_active'] === 1, 'system' => (int) $t['is_system'] === 1,
            'used' => $use[(int) $t['id']] ?? 0, 'updated_by' => $t['updated_by'] ?? $t['created_by'], 'updated_at' => $this->dt($t['updated_at'] ?? $t['created_at']),
        ], $this->all('SELECT * FROM sm_reminder_templates ORDER BY level, id'));
    }

    /** Kiểm tra các {biến} trong văn bản; trả về danh sách biến lạ. @return array<int,string> */
    private static function unknownVars(string $text): array
    {
        preg_match_all('/\{([a-z_]+)\}/', $text, $m);
        return array_values(array_unique(array_filter($m[1], fn ($v) => !isset(self::PLACEHOLDERS[$v]))));
    }

    /**
     * @param array<string,mixed> $staff
     * @param array<string,mixed> $d name, level, subject, body
     * @return array<string,mixed>
     */
    public function saveTemplate(array $staff, ?int $id, array $d): array
    {
        $name = trim((string) ($d['name'] ?? ''));
        $level = (int) ($d['level'] ?? 0);
        $subject = trim((string) ($d['subject'] ?? ''));
        $body = trim((string) ($d['body'] ?? ''));
        $errors = [];
        if (mb_strlen($name) < 3 || mb_strlen($name) > 80) {
            $errors['name'] = 'Tên mẫu từ 3 đến 80 ký tự.';
        }
        if (!isset(self::LEVELS[$level])) {
            $errors['level'] = 'Chọn mức nhắc.';
        }
        if (mb_strlen($subject) < 3 || mb_strlen($subject) > 120) {
            $errors['subject'] = 'Tiêu đề từ 3 đến 120 ký tự.';
        } elseif ($bad = self::unknownVars($subject)) {
            $errors['subject'] = 'Biến không hợp lệ: {' . implode('}, {', $bad) . '}.';
        }
        if (mb_strlen($body) < 20 || mb_strlen($body) > 1500) {
            $errors['body'] = 'Nội dung từ 20 đến 1500 ký tự.';
        } elseif ($bad = self::unknownVars($body)) {
            $errors['body'] = 'Biến không hợp lệ: {' . implode('}, {', $bad) . '}.';
        }
        if ($errors) {
            return self::fail('Vui lòng kiểm tra lại thông tin.', 422, ['errors' => $errors]);
        }
        $this->seedDefaults();
        if ($id) {
            if (!$this->one('SELECT id FROM sm_reminder_templates WHERE id = ?', [$id])) {
                return self::fail('Không tìm thấy mẫu tin.', 404);
            }
            $this->run('UPDATE sm_reminder_templates SET name = ?, level = ?, subject = ?, body = ?, updated_by = ?, updated_at = ? WHERE id = ?', [$name, $level, $subject, $body, $staff['name'], $this->ts(), $id]);
        } else {
            $this->run('INSERT INTO sm_reminder_templates (code, name, level, subject, body, is_active, is_system, created_by, created_at) VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)',
                ['TC' . date('ymdHis', $this->now()) . random_int(10, 99), $name, $level, $subject, $body, $staff['name'], $this->ts()]);
        }

        return ['ok' => true, 'status' => 200, 'message' => $id ? 'Đã cập nhật mẫu tin.' : 'Đã tạo mẫu tin mới.', 'templates' => $this->templates()];
    }

    /**
     * @param array<string,mixed> $staff
     * @return array<string,mixed>
     */
    public function toggleTemplate(array $staff, int $id): array
    {
        $t = $this->one('SELECT id, is_active FROM sm_reminder_templates WHERE id = ?', [$id]);
        if (!$t) {
            return self::fail('Không tìm thấy mẫu tin.', 404);
        }
        if ((int) $t['is_active'] === 1 && (int) $this->one('SELECT COUNT(*) AS n FROM sm_reminder_templates WHERE is_active = 1')['n'] <= 1) {
            return self::fail('Phải còn ít nhất một mẫu tin đang dùng.', 409);
        }
        $this->run('UPDATE sm_reminder_templates SET is_active = ?, updated_by = ?, updated_at = ? WHERE id = ?', [(int) $t['is_active'] === 1 ? 0 : 1, $staff['name'], $this->ts(), $id]);

        return ['ok' => true, 'status' => 200, 'message' => (int) $t['is_active'] === 1 ? 'Đã tắt mẫu tin.' : 'Đã bật mẫu tin.', 'templates' => $this->templates()];
    }

    /** @return array<string,mixed> */
    public function meta(): array
    {
        $ch = [];
        foreach (self::CHANNELS as $k => $c) {
            $ch[] = ['key' => $k, 'label' => $c['label'], 'hint' => $c['hint'], 'instant' => $c['instant']];
        }
        $lv = [];
        foreach (self::LEVELS as $k => $l) {
            $lv[] = ['key' => $k, 'label' => $l];
        }
        $ph = [];
        foreach (self::PLACEHOLDERS as $k => $l) {
            $ph[] = ['key' => $k, 'label' => $l];
        }
        $base = $this->debt()->meta();

        return [
            'templates' => $this->templates(), 'channels' => $ch, 'levels' => $lv, 'placeholders' => $ph, 'settings' => $this->settings(),
            'years' => $base['years'], 'periods' => $base['periods'], 'classes' => $base['classes'], 'grades' => $base['grades'], 'buckets' => $base['buckets'], 'today' => $this->today(),
        ];
    }

    /* ================================================================== đề xuất cần nhắc */

    /**
     * Lịch sử nhắc gần đây (90 ngày) của từng học sinh.
     *
     * @return array<int,array<string,mixed>>
     */
    private function recentIndex(): array
    {
        $from = date('Y-m-d H:i:s', $this->now() - 90 * 86400);
        $today = strtotime($this->today());
        $o = [];
        foreach ($this->all("SELECT student_id, level, channel, status, created_at FROM sm_reminders WHERE status <> 'cancelled' AND created_at >= ? ORDER BY id DESC LIMIT 50000", [$from]) as $r) {
            $sid = (int) $r['student_id'];
            if (!isset($o[$sid])) {
                $o[$sid] = ['count' => 0, 'last_at' => $r['created_at'], 'last_level' => (int) $r['level'], 'last_channel' => $r['channel'], 'last_status' => $r['status'],
                    'days_since' => (int) floor(($today - strtotime(substr($r['created_at'], 0, 10))) / 86400)];
            }
            $o[$sid]['count']++;
        }

        return $o;
    }

    /** @return array<int,array<string,mixed>> */
    private function openPromises(): array
    {
        try {
            $o = [];
            foreach ($this->all("SELECT student_id, promise_date, promise_amount FROM sm_debt_notes WHERE kind = 'promise' AND status = 'open' ORDER BY promise_date DESC") as $r) {
                $o[(int) $r['student_id']] = ['date' => $r['promise_date'], 'amount' => (int) $r['promise_amount']];
            }
            return $o;
        } catch (Throwable) {
            return [];
        }
    }

    private static function suggestLevel(array $s, array $recent): int
    {
        $n = (int) ($recent['count'] ?? 0);
        $lv = min(3, $n + 1);
        if ($n === 0 && $s['max_days'] > 30) {
            $lv = 2;
        }
        if ($s['max_days'] > 60 && $n >= 1) {
            $lv = 3;
        }
        if ($s['max_days'] <= 0) {
            $lv = 1;
        }

        return $lv;
    }

    /**
     * @param array<string,mixed> $f q, year_id, period_id, grade, class_id, bucket, min, eligible (all|yes|no), level (1|2|3), sort, page, per_page
     * @return array<string,mixed>
     */
    public function suggestions(array $f): array
    {
        $gap = $this->settings()['gap_days'];
        $debtors = $this->debt()->debtors($f);
        $recent = $this->recentIndex();
        $promises = $this->openPromises();
        $bucket = (string) ($f['bucket'] ?? '');
        $min = max(0, (int) ($f['min'] ?? 0));
        $rows = [];
        $sum = ['debtors' => 0, 'eligible' => 0, 'never' => 0, 'balance' => 0, 'by_level' => [1 => 0, 2 => 0, 3 => 0]];
        foreach ($debtors as $id => $s) {
            if (($bucket !== '' && $s['bucket'] !== $bucket) || $s['balance'] < $min) {
                continue;
            }
            $rc = $recent[$id] ?? null;
            $eligible = $rc === null || $rc['days_since'] >= $gap;
            $lv = self::suggestLevel($s, $rc ?? []);
            $sum['debtors']++;
            $sum['balance'] += $s['balance'];
            $sum['never'] += $rc === null ? 1 : 0;
            if ($eligible) {
                $sum['eligible']++;
                $sum['by_level'][$lv]++;
            }
            $rows[] = array_intersect_key($s, array_flip(['id', 'code', 'name', 'class', 'grade', 'balance', 'overdue', 'max_days', 'open_invoices', 'bucket', 'oldest_due', 'paid_pct']))
                + ['level' => $lv, 'eligible' => $eligible, 'reminder' => $rc, 'promise' => $promises[$id] ?? null,
                    'next_in' => $eligible ? 0 : max(1, $gap - ($rc['days_since'] ?? 0))];
        }
        $elig = (string) ($f['eligible'] ?? 'all');
        $level = (int) ($f['level'] ?? 0);
        $list = array_values(array_filter($rows, fn ($r) => ($elig === 'all' || ($elig === 'yes') === $r['eligible']) && (!$level || $r['level'] === $level)));
        $sort = (string) ($f['sort'] ?? 'days_desc');
        usort($list, fn ($a, $b) => match ($sort) {
            'balance_desc' => [$b['balance'], $a['code']] <=> [$a['balance'], $b['code']],
            'last_asc' => [$a['reminder']['last_at'] ?? '', $a['code']] <=> [$b['reminder']['last_at'] ?? '', $b['code']],
            'name' => strcmp((string) $a['name'], (string) $b['name']),
            'class' => [(string) $a['class'], $a['code']] <=> [(string) $b['class'], $b['code']],
            default => [$b['max_days'], $b['balance']] <=> [$a['max_days'], $a['balance']],
        });
        $total = count($list);
        $per = min(self::MAX_PER, max(1, (int) ($f['per_page'] ?? self::PER_PAGE)));
        $pages = max(1, (int) ceil($total / $per));
        $page = min($pages, max(1, (int) ($f['page'] ?? 1)));

        return [
            'items' => array_slice($list, ($page - 1) * $per, $per), 'total' => $total, 'page' => $page, 'pages' => $pages, 'per_page' => $per,
            'summary' => $sum, 'gap_days' => $gap, 'filtered_balance' => array_sum(array_column($list, 'balance')),
        ];
    }

    /* ================================================================== soạn và gửi */

    /**
     * @param array<string,mixed> $s học sinh còn nợ (từ FeeDebtRepo::debtors)
     * @param array<string,mixed> $staff
     * @param array<string,mixed> $set cài đặt
     * @param array<string,mixed>|null $promise
     * @return array<string,string>
     */
    private function vars(array $s, array $staff, array $set, ?array $promise): array
    {
        return [
            'ten_hs' => (string) $s['name'], 'ma_hs' => (string) $s['code'], 'lop' => $s['class'] ?: 'chưa xếp lớp', 'so_tien_no' => self::vnd((int) $s['balance']),
            'tien_qua_han' => self::vnd((int) $s['overdue']), 'han_nop' => self::dmy($s['oldest_due']), 'so_hoa_don' => (string) $s['open_invoices'],
            'so_ngay_qua_han' => (string) $s['max_days'], 'ten_truong' => $set['school_name'], 'thong_tin_thanh_toan' => $set['payment_info_effective'],
            'lien_he' => $set['contact'], 'nguoi_gui' => (string) $staff['name'],
            'ngay_hen' => $promise ? self::dmy($promise['date']) : '(chưa có lịch hẹn)', 'tien_hen' => $promise ? self::vnd($promise['amount']) : '(chưa có)',
        ];
    }

    private static function render(string $tpl, array $vars): string
    {
        return preg_replace_callback('/\{([a-z_]+)\}/', fn ($m) => $vars[$m[1]] ?? $m[0], $tpl);
    }

    /**
     * Xem trước nội dung với tối đa 3 học sinh.
     *
     * @param array<string,mixed> $staff
     * @param array<string,mixed> $d template_id | subject + body, student_ids
     * @return array<string,mixed>
     */
    public function preview(array $staff, array $d): array
    {
        [$subject, $body, $err] = $this->resolveText($d);
        if ($err) {
            return $err;
        }
        $ids = array_slice(self::cleanIds($d['student_ids'] ?? []), 0, 3);
        if (!$ids) {
            return self::fail('Chưa chọn học sinh để xem trước.');
        }
        $set = $this->settings();
        $debtors = $this->debt()->debtors();
        $prom = $this->openPromises();
        $out = [];
        foreach ($ids as $id) {
            if (!isset($debtors[$id])) {
                continue;
            }
            $v = $this->vars($debtors[$id], $staff, $set, $prom[$id] ?? null);
            $out[] = ['student' => ['id' => $id, 'code' => $debtors[$id]['code'], 'name' => $debtors[$id]['name']], 'subject' => self::render($subject, $v), 'body' => self::render($body, $v)];
        }

        return ['ok' => true, 'status' => 200, 'message' => 'OK', 'items' => $out];
    }

    /** @return array{0:string,1:string,2:?array<string,mixed>} */
    private function resolveText(array $d): array
    {
        $subject = trim((string) ($d['subject'] ?? ''));
        $body = trim((string) ($d['body'] ?? ''));
        if (!empty($d['template_id']) && ($subject === '' || $body === '')) {
            $t = $this->one('SELECT subject, body FROM sm_reminder_templates WHERE id = ?', [(int) $d['template_id']]);
            if (!$t) {
                return ['', '', self::fail('Không tìm thấy mẫu tin.', 404)];
            }
            $subject = $subject !== '' ? $subject : $t['subject'];
            $body = $body !== '' ? $body : $t['body'];
        }
        $errors = [];
        if (mb_strlen($subject) < 3 || mb_strlen($subject) > 120) {
            $errors['subject'] = 'Tiêu đề từ 3 đến 120 ký tự.';
        } elseif ($bad = self::unknownVars($subject)) {
            $errors['subject'] = 'Biến không hợp lệ: {' . implode('}, {', $bad) . '}.';
        }
        if (mb_strlen($body) < 20 || mb_strlen($body) > 1500) {
            $errors['body'] = 'Nội dung từ 20 đến 1500 ký tự.';
        } elseif ($bad = self::unknownVars($body)) {
            $errors['body'] = 'Biến không hợp lệ: {' . implode('}, {', $bad) . '}.';
        }

        return [$subject, $body, $errors ? self::fail('Vui lòng kiểm tra lại nội dung.', 422, ['errors' => $errors]) : null];
    }

    /**
     * @param array<string,mixed> $staff
     * @param array<string,mixed> $d template_id, subject, body, channel, student_ids, force, name, note, level
     * @return array<string,mixed>
     */
    public function send(array $staff, array $d): array
    {
        $channel = (string) ($d['channel'] ?? '');
        if (!isset(self::CHANNELS[$channel])) {
            return self::fail('Chọn kênh gửi.');
        }
        $ids = self::cleanIds($d['student_ids'] ?? []);
        if (!$ids) {
            return self::fail('Chưa chọn học sinh nào.');
        }
        if (count($ids) > self::MAX_SEND) {
            return self::fail('Mỗi đợt gửi tối đa ' . self::MAX_SEND . ' học sinh.');
        }
        [$subject, $body, $err] = $this->resolveText($d);
        if ($err) {
            return $err;
        }
        $level = (int) ($d['level'] ?? 0);
        $tid = !empty($d['template_id']) ? (int) $d['template_id'] : null;
        if ($tid && !isset(self::LEVELS[$level])) {
            $level = (int) ($this->one('SELECT level FROM sm_reminder_templates WHERE id = ?', [$tid])['level'] ?? 1);
        }
        $level = isset(self::LEVELS[$level]) ? $level : 1;
        $force = !empty($d['force']);
        $set = $this->settings();
        $gap = $set['gap_days'];
        $debtors = $this->debt()->debtors();
        $recent = $this->recentIndex();
        $prom = $this->openPromises();
        $info = [];
        foreach ($this->all('SELECT s.id, s.code, s.full_name FROM sm_students s WHERE s.id IN (' . implode(',', $ids) . ')') as $r) {
            $info[(int) $r['id']] = $r;
        }
        $rows = [];
        $skipped = [];
        foreach ($ids as $id) {
            $who = ['id' => $id, 'code' => $info[$id]['code'] ?? '', 'name' => $info[$id]['full_name'] ?? 'Không rõ'];
            if (!isset($info[$id])) {
                $skipped[] = $who + ['reason' => 'unknown', 'detail' => 'Không tìm thấy học sinh.'];
                continue;
            }
            if (!isset($debtors[$id])) {
                $skipped[] = $who + ['reason' => 'no_debt', 'detail' => 'Học sinh không còn nợ.'];
                continue;
            }
            $rc = $recent[$id] ?? null;
            if (!$force && $rc !== null && $rc['days_since'] < $gap) {
                $skipped[] = $who + ['reason' => 'recent', 'detail' => 'Đã nhắc ' . ($rc['days_since'] === 0 ? 'hôm nay' : $rc['days_since'] . ' ngày trước') . ' (cách tối thiểu ' . $gap . ' ngày).'];
                continue;
            }
            $v = $this->vars($debtors[$id], $staff, $set, $prom[$id] ?? null);
            $sj = self::render($subject, $v);
            $bd = self::render($body, $v);
            if (mb_strlen($sj) > 120 || mb_strlen($bd) > 1500) {
                $skipped[] = $who + ['reason' => 'too_long', 'detail' => 'Nội dung sau khi điền thông tin quá dài.'];
                continue;
            }
            $rows[] = [$id, $sj, $bd, (int) $debtors[$id]['balance'], (int) $debtors[$id]['max_days']];
        }
        if (!$rows) {
            $why = implode(' ', array_map(fn ($x) => $x['name'] . ': ' . $x['detail'], array_slice($skipped, 0, 3)));
            return self::fail('Không có học sinh nào đủ điều kiện để gửi.', 422, ['errors' => ['students' => $why . (count($skipped) > 3 ? ' (và ' . (count($skipped) - 3) . ' học sinh khác)' : '')], 'skipped' => array_slice($skipped, 0, 50), 'skipped_count' => count($skipped)]);
        }
        $name = trim((string) ($d['name'] ?? ''));
        $name = $name !== '' ? mb_substr($name, 0, 120) : 'Nhắc nợ ' . date('d/m/Y H:i', $this->now());
        $note = mb_substr(trim((string) ($d['note'] ?? '')), 0, 255);
        $instant = self::CHANNELS[$channel]['instant'];
        $now = $this->ts();
        $this->pdo->beginTransaction();
        try {
            $this->run('INSERT INTO sm_reminder_batches (name, template_id, level, channel, subject, body, note, cancelled, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)',
                [$name, $tid, $level, $channel, $subject, $body, $note !== '' ? $note : null, $staff['name'], $now]);
            $bid = (int) $this->pdo->lastInsertId();
            foreach ($rows as [$sid, $sj, $bd, $amt, $days]) {
                $this->run('INSERT INTO sm_reminders (batch_id, student_id, level, channel, subject, body, debt_amount, overdue_days, status, created_by, created_at, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [$bid, $sid, $level, $channel, $sj, $bd, $amt, $days, $instant ? 'sent' : 'queued', $staff['name'], $now, $instant ? $now : null]);
            }
            $this->pdo->commit();
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            return self::fail('Không gửi được, vui lòng thử lại.', 500);
        }
        $msg = $instant ? 'Đã gửi ' . count($rows) . ' thông báo đến cổng học sinh.' : 'Đã tạo ' . count($rows) . ' tin chờ gửi. Hãy xuất danh sách, gửi đi rồi đánh dấu đã gửi.';

        return ['ok' => true, 'status' => 200, 'message' => $msg, 'batch_id' => $bid, 'created' => count($rows), 'instant' => $instant, 'skipped' => array_slice($skipped, 0, 50), 'skipped_count' => count($skipped)];
    }

    /* ================================================================== lịch sử các đợt gửi */

    /**
     * @param array<string,mixed> $f q, channel, page
     * @return array<string,mixed>
     */
    public function batches(array $f): array
    {
        $w = ['1 = 1'];
        $p = [];
        if (!empty($f['id'])) {
            $w[] = 'b.id = ?';
            $p[] = (int) $f['id'];
        }
        if (trim((string) ($f['q'] ?? '')) !== '') {
            $w[] = 'b.name LIKE ?';
            $p[] = '%' . trim((string) $f['q']) . '%';
        }
        if (!empty($f['channel']) && isset(self::CHANNELS[$f['channel']])) {
            $w[] = 'b.channel = ?';
            $p[] = $f['channel'];
        }
        $total = (int) $this->one('SELECT COUNT(*) AS n FROM sm_reminder_batches b WHERE ' . implode(' AND ', $w), $p)['n'];
        $per = min(self::MAX_PER, max(1, (int) ($f['per_page'] ?? 10)));
        $pages = max(1, (int) ceil($total / $per));
        $page = min($pages, max(1, (int) ($f['page'] ?? 1)));
        $rows = $this->all("SELECT b.*, COUNT(r.id) AS total,
                SUM(CASE WHEN r.status = 'queued' THEN 1 ELSE 0 END) AS queued,
                SUM(CASE WHEN r.status IN ('sent', 'read') THEN 1 ELSE 0 END) AS sent,
                SUM(CASE WHEN r.status = 'read' THEN 1 ELSE 0 END) AS rd,
                SUM(CASE WHEN r.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_n,
                COALESCE(SUM(r.debt_amount), 0) AS amount
             FROM sm_reminder_batches b LEFT JOIN sm_reminders r ON r.batch_id = b.id WHERE " . implode(' AND ', $w) . "
             GROUP BY b.id ORDER BY b.id DESC LIMIT $per OFFSET " . (($page - 1) * $per), $p);
        $paid = $this->paidMap(array_map(fn ($r) => (int) $r['id'], $rows));
        $items = array_map(fn ($b) => [
            'id' => (int) $b['id'], 'name' => $b['name'], 'channel' => $b['channel'], 'channel_label' => self::CHANNELS[$b['channel']]['label'] ?? $b['channel'],
            'level' => (int) $b['level'], 'level_label' => self::LEVELS[(int) $b['level']] ?? '', 'by' => $b['created_by'], 'at' => $this->dt($b['created_at']),
            'total' => (int) $b['total'], 'queued' => (int) $b['queued'], 'sent' => (int) $b['sent'], 'read' => (int) $b['rd'], 'cancelled' => (int) $b['cancelled_n'],
            'amount' => (int) $b['amount'], 'paid' => $paid[(int) $b['id']] ?? 0, 'note' => $b['note'],
            'status' => (int) $b['total'] > 0 && (int) $b['cancelled_n'] === (int) $b['total'] ? 'cancelled' : ((int) $b['queued'] > 0 ? 'queued' : 'done'),
        ], $rows);

        return ['items' => $items, 'total' => $total, 'page' => $page, 'pages' => $pages, 'per_page' => $per];
    }

    /**
     * Số học sinh đã đóng đủ (không còn nợ) trong từng đợt.
     *
     * @param array<int,int> $batchIds
     * @return array<int,int>
     */
    private function paidMap(array $batchIds): array
    {
        if (!$batchIds) {
            return [];
        }
        $debtors = $this->debt()->debtors();
        $o = [];
        foreach ($this->all("SELECT DISTINCT batch_id, student_id FROM sm_reminders WHERE status <> 'cancelled' AND batch_id IN (" . implode(',', $batchIds) . ')') as $r) {
            if (!isset($debtors[(int) $r['student_id']])) {
                $o[(int) $r['batch_id']] = ($o[(int) $r['batch_id']] ?? 0) + 1;
            }
        }

        return $o;
    }

    /**
     * @param array<string,mixed> $f status (all|queued|sent|read|cancelled), q, page, per_page
     * @return array<string,mixed>|null
     */
    public function batch(int $id, array $f = []): ?array
    {
        $b = $this->one('SELECT * FROM sm_reminder_batches WHERE id = ?', [$id]);
        if (!$b) {
            return null;
        }
        $head = $this->batches(['id' => $id, 'per_page' => 1]);
        $sum = null;
        foreach ($head['items'] as $h) {
            if ($h['id'] === $id) {
                $sum = $h;
            }
        }
        if ($sum === null) {
            $sum = ['id' => $id, 'name' => $b['name'], 'total' => 0, 'queued' => 0, 'sent' => 0, 'read' => 0, 'cancelled' => 0, 'paid' => 0, 'amount' => 0, 'status' => 'done',
                'channel' => $b['channel'], 'channel_label' => self::CHANNELS[$b['channel']]['label'] ?? $b['channel'], 'level' => (int) $b['level'], 'level_label' => self::LEVELS[(int) $b['level']] ?? '', 'by' => $b['created_by'], 'at' => $this->dt($b['created_at']), 'note' => $b['note']];
        }
        $w = ['r.batch_id = ?'];
        $p = [$id];
        $st = (string) ($f['status'] ?? 'all');
        if (in_array($st, ['queued', 'sent', 'read', 'cancelled'], true)) {
            $w[] = 'r.status = ?';
            $p[] = $st;
        }
        $q = trim((string) ($f['q'] ?? ''));
        if ($q !== '') {
            $w[] = '(s.code LIKE ? OR s.full_name LIKE ?)';
            $p[] = '%' . $q . '%';
            $p[] = '%' . $q . '%';
        }
        $cy = $this->one('SELECT id FROM sm_school_years WHERE is_current = 1');
        $base = ' FROM sm_reminders r JOIN sm_students s ON s.id = r.student_id LEFT JOIN sm_enrollments e ON e.student_id = s.id AND e.school_year_id = ? LEFT JOIN sm_classes c ON c.id = e.class_id WHERE ' . implode(' AND ', $w);
        $pp = array_merge([(int) ($cy['id'] ?? 0)], $p);
        $total = (int) $this->one('SELECT COUNT(*) AS n' . $base, $pp)['n'];
        $per = min(self::MAX_PER, max(1, (int) ($f['per_page'] ?? 20)));
        $pages = max(1, (int) ceil($total / $per));
        $page = min($pages, max(1, (int) ($f['page'] ?? 1)));
        $rows = $this->all('SELECT r.*, s.code AS scode, s.full_name AS sname, c.name AS cname' . $base . " ORDER BY r.id LIMIT $per OFFSET " . (($page - 1) * $per), $pp);
        $debtors = $this->debt()->debtors();
        $items = array_map(fn ($r) => [
            'id' => (int) $r['id'], 'student' => ['id' => (int) $r['student_id'], 'code' => $r['scode'], 'name' => $r['sname'], 'class' => $r['cname']],
            'subject' => $r['subject'], 'body' => $r['body'], 'status' => $r['status'], 'debt_amount' => (int) $r['debt_amount'], 'overdue_days' => (int) $r['overdue_days'],
            'sent_at' => $this->dt($r['sent_at']), 'read_at' => $this->dt($r['read_at']), 'paid' => $r['status'] !== 'cancelled' && !isset($debtors[(int) $r['student_id']]),
            'balance' => $debtors[(int) $r['student_id']]['balance'] ?? 0,
        ], $rows);

        return [
            'batch' => $sum + ['subject' => $b['subject'], 'body' => $b['body']], 'items' => $items, 'total' => $total, 'page' => $page, 'pages' => $pages, 'per_page' => $per,
        ];
    }

    /**
     * Đánh dấu các tin chờ gửi đã được gửi đi (kênh SMS, Zalo, in giấy).
     *
     * @param array<string,mixed> $staff
     * @return array<string,mixed>
     */
    public function markSent(array $staff, int $batchId, array $ids = []): array
    {
        if (!$this->one('SELECT id FROM sm_reminder_batches WHERE id = ?', [$batchId])) {
            return self::fail('Không tìm thấy đợt gửi.', 404);
        }
        $ids = self::cleanIds($ids);
        $sql = "UPDATE sm_reminders SET status = 'sent', sent_at = ? WHERE batch_id = ? AND status = 'queued'" . ($ids ? ' AND id IN (' . implode(',', $ids) . ')' : '');
        $n = $this->run($sql, [$this->ts(), $batchId]);
        if ($n === 0) {
            return self::fail('Không còn tin nào chờ gửi trong đợt này.', 409);
        }

        return ['ok' => true, 'status' => 200, 'message' => 'Đã đánh dấu ' . $n . ' tin là đã gửi.', 'updated' => $n];
    }

    /**
     * Thu hồi: hủy các tin chờ gửi, và tin trên cổng học sinh mà học sinh chưa đọc.
     *
     * @param array<string,mixed> $staff
     * @return array<string,mixed>
     */
    public function cancelBatch(array $staff, int $batchId): array
    {
        $b = $this->one('SELECT id, channel FROM sm_reminder_batches WHERE id = ?', [$batchId]);
        if (!$b) {
            return self::fail('Không tìm thấy đợt gửi.', 404);
        }
        $n = $this->run("UPDATE sm_reminders SET status = 'cancelled' WHERE batch_id = ? AND (status = 'queued' OR (status = 'sent' AND channel = 'inapp'))", [$batchId]);
        if ($n === 0) {
            return self::fail('Không có tin nào có thể thu hồi (tin đã đọc hoặc đã gửi ngoài hệ thống).', 409);
        }
        if ((int) $this->one("SELECT COUNT(*) AS n FROM sm_reminders WHERE batch_id = ? AND status <> 'cancelled'", [$batchId])['n'] === 0) {
            $this->run('UPDATE sm_reminder_batches SET cancelled = 1 WHERE id = ?', [$batchId]);
        }

        return ['ok' => true, 'status' => 200, 'message' => 'Đã thu hồi ' . $n . ' tin.', 'updated' => $n];
    }

    /** @return array<int,array<string,mixed>> */
    public function studentHistory(int $studentId): array
    {
        return array_map(fn ($r) => [
            'id' => (int) $r['id'], 'batch' => $r['bname'], 'level' => (int) $r['level'], 'level_label' => self::LEVELS[(int) $r['level']] ?? '', 'channel' => $r['channel'],
            'channel_label' => self::CHANNELS[$r['channel']]['label'] ?? $r['channel'], 'status' => $r['status'], 'debt_amount' => (int) $r['debt_amount'],
            'at' => $this->dt($r['created_at']), 'read_at' => $this->dt($r['read_at']), 'by' => $r['created_by'], 'subject' => $r['subject'],
        ], $this->all('SELECT r.*, b.name AS bname FROM sm_reminders r JOIN sm_reminder_batches b ON b.id = r.batch_id WHERE r.student_id = ? ORDER BY r.id DESC LIMIT 50', [$studentId]));
    }

    /* ================================================================== hiệu quả */

    /**
     * @param array<string,mixed> $f days (7|30|90|180|365)
     * @return array<string,mixed>
     */
    public function stats(array $f): array
    {
        $days = (int) ($f['days'] ?? 30);
        $days = in_array($days, [7, 30, 90, 180, 365], true) ? $days : 30;
        $to = $this->today();
        $from = date('Y-m-d', strtotime($to) - ($days - 1) * 86400);
        $rows = $this->all("SELECT student_id, level, channel, status, created_at, substr(created_at, 1, 10) AS d FROM sm_reminders WHERE status <> 'cancelled' AND substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?", [$from, $to]);
        $debtors = $this->debt()->debtors();
        $series = [];
        for ($t = strtotime($from); $t <= strtotime($to); $t += 86400) {
            $series[date('Y-m-d', $t)] = 0;
        }
        $byCh = [];
        $byLv = [];
        $students = [];
        $inapp = 0;
        $read = 0;
        foreach ($rows as $r) {
            $series[$r['d']] = ($series[$r['d']] ?? 0) + 1;
            $byCh[$r['channel']] = ($byCh[$r['channel']] ?? 0) + 1;
            $byLv[(int) $r['level']] = ($byLv[(int) $r['level']] ?? 0) + 1;
            $students[(int) $r['student_id']] = 1;
            if ($r['channel'] === 'inapp' && in_array($r['status'], ['sent', 'read'], true)) {
                $inapp++;
                $read += $r['status'] === 'read' ? 1 : 0;
            }
        }
        $paid = count(array_filter(array_keys($students), fn ($id) => !isset($debtors[$id])));
        $sent = count($rows);
        $queued = (int) $this->one("SELECT COUNT(*) AS n FROM sm_reminders WHERE status = 'queued'")['n'];
        $ch = [];
        foreach (self::CHANNELS as $k => $c) {
            $ch[] = ['key' => $k, 'label' => $c['label'], 'count' => $byCh[$k] ?? 0];
        }
        $lv = [];
        foreach (self::LEVELS as $k => $l) {
            $lv[] = ['key' => $k, 'label' => $l, 'count' => $byLv[$k] ?? 0];
        }
        $ser = [];
        foreach ($series as $d => $n) {
            $ser[] = ['date' => $d, 'count' => $n];
        }

        return [
            'days' => $days, 'from' => $from, 'to' => $to, 'total' => $sent, 'students' => count($students), 'paid_after' => $paid,
            'paid_rate' => count($students) ? round($paid * 100 / count($students), 1) : 0.0, 'inapp' => $inapp, 'read' => $read, 'read_rate' => $inapp ? round($read * 100 / $inapp, 1) : 0.0,
            'queued_all' => $queued, 'by_channel' => $ch, 'by_level' => $lv, 'series' => $ser,
        ];
    }

    /* ================================================================== phía học sinh (cổng học sinh) */

    /** @return array<string,mixed> */
    public function forStudent(int $studentId): array
    {
        $rows = $this->all("SELECT id, level, subject, body, debt_amount, status, sent_at, read_at FROM sm_reminders WHERE student_id = ? AND channel = 'inapp' AND status IN ('sent', 'read') ORDER BY id DESC LIMIT 30", [$studentId]);
        $unread = 0;
        $items = array_map(function ($r) use (&$unread) {
            $unread += $r['status'] === 'sent' ? 1 : 0;
            return ['id' => (int) $r['id'], 'level' => (int) $r['level'], 'subject' => $r['subject'], 'body' => $r['body'], 'debt_amount' => (int) $r['debt_amount'], 'at' => $this->dt($r['sent_at']), 'read' => $r['status'] === 'read'];
        }, $rows);

        return ['items' => $items, 'unread' => $unread];
    }

    /** @return array<string,mixed> */
    public function markRead(int $studentId, ?int $id): array
    {
        $n = $id
            ? $this->run("UPDATE sm_reminders SET status = 'read', read_at = ? WHERE id = ? AND student_id = ? AND channel = 'inapp' AND status = 'sent'", [$this->ts(), $id, $studentId])
            : $this->run("UPDATE sm_reminders SET status = 'read', read_at = ? WHERE student_id = ? AND channel = 'inapp' AND status = 'sent'", [$this->ts(), $studentId]);

        return ['ok' => true, 'status' => 200, 'message' => 'OK', 'updated' => $n];
    }
}
