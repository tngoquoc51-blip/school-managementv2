<?php

namespace App\Support;

use PDO;

/**
 * Dữ liệu cho website công khai (/api/public/*): số liệu trường, tin tức, sự kiện,
 * đăng ký tuyển sinh, tra cứu hồ sơ, liên hệ. Không cần đăng nhập, nên mọi đầu vào đều bị giới hạn và kiểm tra.
 */
class PublicSiteRepo
{
    public const PER_PAGE = 9;
    public const MAX_PER = 30;
    public const KINDS = ['news', 'event'];
    public const TRACKS = ['Khoa học tự nhiên', 'Khoa học xã hội', 'Chưa xác định'];
    public const TOPICS = ['Tuyển sinh', 'Học phí', 'Học tập', 'Cổng thông tin', 'Khác'];
    public const STATUS = [
        'new' => ['Đã nhận hồ sơ', 'Nhà trường đã nhận đăng ký của bạn và sẽ liên hệ qua số điện thoại đã khai.'],
        'contacted' => ['Đã liên hệ tư vấn', 'Nhà trường đã liên hệ phụ huynh. Hãy chuẩn bị hồ sơ bản giấy theo hướng dẫn.'],
        'invited' => ['Mời nộp hồ sơ', 'Mời phụ huynh mang hồ sơ bản giấy đến trường theo lịch hẹn.'],
        'enrolled' => ['Đã nhập học', 'Hồ sơ đã hoàn tất. Học sinh sẽ nhận tài khoản cổng thông tin từ giáo vụ.'],
        'rejected' => ['Chưa phù hợp', 'Hồ sơ chưa đáp ứng điều kiện. Vui lòng liên hệ nhà trường để được giải thích.'],
    ];
    public const LIMIT_PER_HOUR = 5;

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
        $r = $this->all($sql, $p);
        return $r[0] ?? null;
    }

    private function fail(string $msg, int $status = 422, array $errors = []): array
    {
        return ['ok' => false, 'status' => $status, 'message' => $msg] + ($errors ? ['errors' => $errors] : []);
    }

    private function clean(mixed $v, int $max): string
    {
        $s = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', (string) $v) ?? '');
        return mb_substr($s, 0, $max);
    }

    // ------------------------------------------------------------ số liệu

    /** Số liệu thật từ hệ thống quản lý: lớp, học sinh, giáo viên của năm học hiện tại. */
    public function overview(): array
    {
        $y = $this->one('SELECT id, label FROM sm_school_years WHERE is_current = 1') ?? $this->one('SELECT id, label FROM sm_school_years ORDER BY start_date DESC');
        $yid = (int) ($y['id'] ?? 0);
        $grades = [];
        foreach ($this->all('SELECT c.grade, COUNT(DISTINCT c.id) AS classes, COUNT(e.id) AS students FROM sm_classes c LEFT JOIN sm_enrollments e ON e.class_id = c.id AND e.school_year_id = c.school_year_id WHERE c.school_year_id = ? GROUP BY c.grade ORDER BY c.grade', [$yid]) as $g) {
            $grades[] = ['grade' => (int) $g['grade'], 'classes' => (int) $g['classes'], 'students' => (int) $g['students']];
        }
        $teachers = (int) ($this->one('SELECT COUNT(*) AS n FROM sm_teachers')['n'] ?? 0);
        $subjects = (int) ($this->one('SELECT COUNT(*) AS n FROM sm_subjects')['n'] ?? 0);
        return [
            'school_year' => $y['label'] ?? null,
            'classes' => array_sum(array_column($grades, 'classes')),
            'students' => array_sum(array_column($grades, 'students')),
            'teachers' => $teachers,
            'subjects' => $subjects,
            'grades' => $grades,
        ];
    }

    // ------------------------------------------------------------ tin tức

    private function newsRow(array $r, bool $full = false): array
    {
        $o = [
            'id' => (int) $r['id'], 'slug' => $r['slug'], 'kind' => $r['kind'], 'category' => $r['category'], 'title' => $r['title'],
            'summary' => $r['summary'], 'tone' => $r['tone'], 'featured' => (int) $r['is_featured'] === 1,
            'date' => substr((string) $r['published_at'], 0, 10), 'event_date' => $r['event_date'], 'event_place' => $r['event_place'],
            'views' => (int) $r['views'],
        ];
        if ($full) {
            $o['paragraphs'] = array_values(array_filter(array_map('trim', preg_split('/\R{2,}/', str_replace('\n', "\n", (string) $r['body'])) ?: []), fn ($x) => $x !== ''));
        }
        return $o;
    }

    /** Danh sách tin: lọc theo loại, chuyên mục, từ khóa; có phân trang. */
    public function news(array $f = []): array
    {
        $kind = in_array($f['kind'] ?? '', self::KINDS, true) ? $f['kind'] : '';
        $cat = $this->clean($f['category'] ?? '', 40);
        $q = $this->clean($f['q'] ?? '', 60);
        $per = max(1, min(self::MAX_PER, (int) ($f['per_page'] ?? self::PER_PAGE)));
        $page = max(1, (int) ($f['page'] ?? 1));
        $w = ['is_published = 1', 'published_at <= ?'];
        $p = [$this->ts()];
        if ($kind !== '') { $w[] = 'kind = ?'; $p[] = $kind; }
        if ($cat !== '') { $w[] = 'category = ?'; $p[] = $cat; }
        if ($q !== '') { $w[] = '(title LIKE ? OR summary LIKE ?)'; $p[] = "%$q%"; $p[] = "%$q%"; }
        $where = implode(' AND ', $w);
        $total = (int) $this->one("SELECT COUNT(*) AS n FROM sm_news WHERE $where", $p)['n'];
        $pages = max(1, (int) ceil($total / $per));
        $page = min($page, $pages);
        $rows = $this->all("SELECT * FROM sm_news WHERE $where ORDER BY is_featured DESC, published_at DESC, id DESC LIMIT $per OFFSET " . (($page - 1) * $per), $p);
        $cats = array_column($this->all('SELECT category, COUNT(*) AS n FROM sm_news WHERE is_published = 1 AND published_at <= ? GROUP BY category ORDER BY n DESC', [$this->ts()]), 'category');
        return ['items' => array_map(fn ($r) => $this->newsRow($r), $rows), 'total' => $total, 'page' => $page, 'pages' => $pages, 'per_page' => $per, 'categories' => $cats];
    }

    /** Sự kiện sắp diễn ra, gần nhất trước. */
    public function events(int $limit = 5): array
    {
        $limit = max(1, min(20, $limit));
        $rows = $this->all("SELECT * FROM sm_news WHERE is_published = 1 AND kind = 'event' AND event_date >= ? ORDER BY event_date ASC LIMIT $limit", [date('Y-m-d', $this->now())]);
        return array_map(fn ($r) => $this->newsRow($r), $rows);
    }

    /** Chi tiết một bài. Tăng lượt xem. */
    public function newsOne(string $slug): ?array
    {
        $slug = $this->clean($slug, 160);
        $r = $this->one('SELECT * FROM sm_news WHERE slug = ? AND is_published = 1 AND published_at <= ?', [$slug, $this->ts()]);
        if (!$r) {
            return null;
        }
        $this->pdo->prepare('UPDATE sm_news SET views = views + 1 WHERE id = ?')->execute([$r['id']]);
        $r['views'] = (int) $r['views'] + 1;
        $rel = $this->all('SELECT * FROM sm_news WHERE is_published = 1 AND published_at <= ? AND id <> ? ORDER BY (category = ?) DESC, published_at DESC LIMIT 3', [$this->ts(), $r['id'], $r['category']]);
        return ['item' => $this->newsRow($r, true), 'related' => array_map(fn ($x) => $this->newsRow($x), $rel)];
    }

    // ------------------------------------------------------------ giới hạn tần suất

    private function limited(string $table, ?string $ip): bool
    {
        if ($ip === null || $ip === '') {
            return false;
        }
        $n = (int) $this->one("SELECT COUNT(*) AS n FROM $table WHERE ip = ? AND created_at >= ?", [$ip, date('Y-m-d H:i:s', $this->now() - 3600)])['n'];
        return $n >= self::LIMIT_PER_HOUR;
    }

    private function phoneOk(string $p): bool
    {
        return (bool) preg_match('/^0\d{9}$/', $p);
    }

    // ------------------------------------------------------------ tuyển sinh

    /** @return array<string,mixed> */
    public function admit(array $d, ?string $ip = null): array
    {
        $name = $this->clean($d['full_name'] ?? '', 80);
        $dob = $this->clean($d['dob'] ?? '', 10);
        $gender = $this->clean($d['gender'] ?? '', 3);
        $school = $this->clean($d['middle_school'] ?? '', 120);
        $parent = $this->clean($d['parent_name'] ?? '', 80);
        $phone = preg_replace('/[\s.\-]/', '', $this->clean($d['phone'] ?? '', 20)) ?? '';
        $email = $this->clean($d['email'] ?? '', 120);
        $track = $this->clean($d['track'] ?? 'Chưa xác định', 40);
        $note = $this->clean($d['note'] ?? '', 500);
        $e = [];
        if (mb_strlen($name) < 3 || !preg_match('/\s/u', $name)) $e['full_name'] = 'Nhập đầy đủ họ và tên của học sinh.';
        $t = strtotime($dob . ' 00:00:00');
        $age = $t ? (int) floor(($this->now() - $t) / 31557600) : 0;
        if (!$t || date('Y-m-d', $t) !== $dob) $e['dob'] = 'Chọn ngày sinh hợp lệ.';
        elseif ($age < 13 || $age > 20) $e['dob'] = 'Tuổi học sinh phải từ 13 đến 20.';
        if (!in_array($gender, ['Nam', 'Nữ'], true)) $e['gender'] = 'Chọn giới tính.';
        if (mb_strlen($school) < 3) $e['middle_school'] = 'Nhập tên trường trung học cơ sở đang học.';
        if (mb_strlen($parent) < 3) $e['parent_name'] = 'Nhập họ tên phụ huynh.';
        if (!$this->phoneOk($phone)) $e['phone'] = 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.';
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $e['email'] = 'Email chưa đúng định dạng.';
        if (!in_array($track, self::TRACKS, true)) $e['track'] = 'Chọn một tổ hợp trong danh sách.';
        if ($e) return $this->fail('Vui lòng kiểm tra lại các ô được đánh dấu.', 422, $e);

        // Gửi lặp: cùng em, cùng số điện thoại trong 30 ngày thì trả lại mã cũ, không tạo hồ sơ mới.
        $dup = $this->one('SELECT code FROM sm_admissions WHERE phone = ? AND dob = ? AND full_name = ? AND created_at >= ? ORDER BY id DESC', [$phone, $dob, $name, date('Y-m-d H:i:s', $this->now() - 30 * 86400)]);
        if ($dup) return ['ok' => true, 'message' => 'Hồ sơ này đã được ghi nhận trước đó.', 'code' => $dup['code'], 'duplicate' => true];
        if ($this->limited('sm_admissions', $ip)) return $this->fail('Bạn đã gửi quá nhiều lần trong một giờ. Vui lòng thử lại sau hoặc gọi điện cho nhà trường.', 429);

        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        for ($i = 0; $i < 8; $i++) {
            $code = 'TS' . date('y', $this->now()) . '-';
            for ($j = 0; $j < 5; $j++) $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            if (!$this->one('SELECT id FROM sm_admissions WHERE code = ?', [$code])) break;
            $code = '';
        }
        if ($code === '') return $this->fail('Không tạo được mã hồ sơ. Vui lòng thử lại.', 500);
        $this->pdo->prepare('INSERT INTO sm_admissions (code, full_name, dob, gender, middle_school, parent_name, phone, email, track, note, status, ip, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
            ->execute([$code, $name, $dob, $gender, $school, $parent, $phone, $email !== '' ? $email : null, $track, $note !== '' ? $note : null, 'new', $ip, $this->ts()]);
        return ['ok' => true, 'message' => 'Đã nhận đăng ký của bạn.', 'code' => $code, 'duplicate' => false];
    }

    /** Tra cứu tiến độ bằng mã hồ sơ và số điện thoại đã khai. Sai một trong hai đều báo chung một câu để không lộ hồ sơ. */
    public function lookup(string $code, string $phone): array
    {
        $code = strtoupper($this->clean($code, 14));
        $phone = preg_replace('/[\s.\-]/', '', $this->clean($phone, 20)) ?? '';
        $miss = $this->fail('Không tìm thấy hồ sơ. Kiểm tra lại mã hồ sơ và số điện thoại đã khai.', 404);
        if ($code === '' || !$this->phoneOk($phone)) return $miss;
        $r = $this->one('SELECT code, full_name, track, status, status_note, created_at, updated_at FROM sm_admissions WHERE code = ? AND phone = ?', [$code, $phone]);
        if (!$r) return $miss;
        [$label, $text] = self::STATUS[$r['status']] ?? self::STATUS['new'];
        $parts = preg_split('/\s+/u', trim($r['full_name'])) ?: [];
        return ['ok' => true, 'item' => [
            'code' => $r['code'], 'name' => $r['full_name'], 'track' => $r['track'], 'status' => $r['status'], 'label' => $label, 'text' => $text,
            'note' => $r['status_note'], 'created_at' => $r['created_at'], 'updated_at' => $r['updated_at'],
            'steps' => array_map(fn ($k) => ['key' => $k, 'label' => self::STATUS[$k][0]], ['new', 'contacted', 'invited', 'enrolled']),
        ]];
    }

    // ------------------------------------------------------------ liên hệ

    /** @return array<string,mixed> */
    public function contact(array $d, ?string $ip = null): array
    {
        $name = $this->clean($d['full_name'] ?? '', 80);
        $phone = preg_replace('/[\s.\-]/', '', $this->clean($d['phone'] ?? '', 20)) ?? '';
        $email = $this->clean($d['email'] ?? '', 120);
        $topic = $this->clean($d['topic'] ?? 'Khác', 40);
        $msg = $this->clean($d['message'] ?? '', 1500);
        $e = [];
        if (mb_strlen($name) < 2) $e['full_name'] = 'Nhập họ tên của bạn.';
        if ($phone === '' && $email === '') $e['phone'] = 'Để lại số điện thoại hoặc email để nhà trường trả lời.';
        if ($phone !== '' && !$this->phoneOk($phone)) $e['phone'] = 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.';
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $e['email'] = 'Email chưa đúng định dạng.';
        if (!in_array($topic, self::TOPICS, true)) $topic = 'Khác';
        if (mb_strlen($msg) < 10) $e['message'] = 'Nội dung cần ít nhất 10 ký tự.';
        if ($e) return $this->fail('Vui lòng kiểm tra lại các ô được đánh dấu.', 422, $e);
        if ($this->limited('sm_contacts', $ip)) return $this->fail('Bạn đã gửi quá nhiều tin trong một giờ. Vui lòng thử lại sau.', 429);
        $this->pdo->prepare('INSERT INTO sm_contacts (full_name, phone, email, topic, message, status, ip, created_at) VALUES (?,?,?,?,?,?,?,?)')
            ->execute([$name, $phone !== '' ? $phone : null, $email !== '' ? $email : null, $topic, $msg, 'new', $ip, $this->ts()]);
        return ['ok' => true, 'message' => 'Đã gửi tin nhắn. Nhà trường sẽ trả lời trong giờ làm việc.'];
    }
}
