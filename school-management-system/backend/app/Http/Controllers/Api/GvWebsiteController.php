<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Quản lý nội dung website cho nhân viên (Giáo vụ / Ban giám hiệu / Quản trị).
 * Nằm trong nhóm /api/gv/website/* nên đã có middleware StaffToken kiểm tra đăng nhập.
 * Dữ liệu: sm_admissions (hồ sơ tuyển sinh), sm_contacts (tin nhắn liên hệ), sm_news (tin tức, sự kiện).
 */
class GvWebsiteController extends Controller
{
    private const ADM_STATUS = ['new' => 'Mới đăng ký', 'contacted' => 'Đã liên hệ', 'invited' => 'Mời nộp hồ sơ', 'enrolled' => 'Đã nhập học', 'rejected' => 'Chưa phù hợp'];
    private const KINDS = ['news', 'event'];
    private const CATS = ['Thông báo', 'Tuyển sinh', 'Hoạt động', 'Học tập', 'Sự kiện', 'Khác'];

    private function db()
    {
        return DB::connection();
    }

    private function fail(string $msg, int $code = 422, array $errors = [])
    {
        $b = ['message' => $msg];
        if ($errors) $b['errors'] = $errors;
        return response()->json($b, $code);
    }

    private function actor(Request $r): string
    {
        $s = $r->attributes->get('sm_staff');
        return mb_substr((string) ($s['username'] ?? $s['name'] ?? 'staff'), 0, 80);
    }

    // ------------------------------------------------------------ tổng quan
    public function summary()
    {
        $adm = collect($this->db()->select('SELECT status, COUNT(*) n FROM sm_admissions GROUP BY status'))->pluck('n', 'status');
        $con = collect($this->db()->select('SELECT status, COUNT(*) n FROM sm_contacts GROUP BY status'))->pluck('n', 'status');
        $news = $this->db()->selectOne('SELECT COUNT(*) total, SUM(is_published = 1) published FROM sm_news');
        return response()->json(['data' => [
            'admissions' => ['total' => (int) $adm->sum(), 'by_status' => $adm, 'new' => (int) ($adm['new'] ?? 0)],
            'contacts' => ['total' => (int) $con->sum(), 'new' => (int) ($con['new'] ?? 0)],
            'news' => ['total' => (int) ($news->total ?? 0), 'published' => (int) ($news->published ?? 0)],
            'labels' => self::ADM_STATUS,
        ]]);
    }

    // ------------------------------------------------------------ hồ sơ tuyển sinh
    private function admWhere(Request $r): array
    {
        $w = ['1=1']; $p = [];
        $st = (string) $r->query('status', '');
        if (isset(self::ADM_STATUS[$st])) { $w[] = 'status = ?'; $p[] = $st; }
        $q = trim((string) $r->query('q', ''));
        if ($q !== '') {
            $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%';
            $w[] = '(full_name LIKE ? OR phone LIKE ? OR code LIKE ? OR parent_name LIKE ? OR middle_school LIKE ?)';
            array_push($p, $like, $like, $like, $like, $like);
        }
        return [implode(' AND ', $w), $p];
    }

    public function admissions(Request $r)
    {
        [$where, $p] = $this->admWhere($r);
        $per = 15;
        $page = max(1, (int) $r->query('page', 1));
        $total = (int) $this->db()->selectOne("SELECT COUNT(*) n FROM sm_admissions WHERE $where", $p)->n;
        $rows = $this->db()->select("SELECT id, code, full_name, dob, gender, middle_school, parent_name, phone, email, track, note, status, status_note, created_at, updated_at FROM sm_admissions WHERE $where ORDER BY id DESC LIMIT $per OFFSET " . (($page - 1) * $per), $p);
        return response()->json(['data' => ['items' => $rows, 'total' => $total, 'page' => $page, 'pages' => max(1, (int) ceil($total / $per)), 'labels' => self::ADM_STATUS]]);
    }

    /** Toàn bộ hồ sơ theo bộ lọc (tối đa 5000 dòng) để xuất Excel/CSV. */
    public function admissionsExport(Request $r)
    {
        [$where, $p] = $this->admWhere($r);
        $rows = $this->db()->select("SELECT code, full_name, dob, gender, middle_school, parent_name, phone, email, track, note, status, status_note, created_at FROM sm_admissions WHERE $where ORDER BY id DESC LIMIT 5000", $p);
        return response()->json(['data' => ['items' => $rows, 'labels' => self::ADM_STATUS]]);
    }

    public function admissionUpdate(Request $r, int $id)
    {
        $row = $this->db()->selectOne('SELECT id FROM sm_admissions WHERE id = ?', [$id]);
        if (!$row) return $this->fail('Không tìm thấy hồ sơ.', 404);
        $status = (string) $r->input('status', '');
        $note = trim((string) $r->input('status_note', ''));
        if (!isset(self::ADM_STATUS[$status])) return $this->fail('Trạng thái không hợp lệ.', 422, ['status' => 'Chọn một trạng thái trong danh sách.']);
        if (mb_strlen($note) > 255) return $this->fail('Ghi chú quá dài.', 422, ['status_note' => 'Ghi chú tối đa 255 ký tự.']);
        $this->db()->update('UPDATE sm_admissions SET status = ?, status_note = ?, updated_at = ? WHERE id = ?', [$status, $note !== '' ? $note : null, now()->format('Y-m-d H:i:s'), $id]);
        return response()->json(['message' => 'Đã cập nhật hồ sơ.']);
    }

    public function admissionDelete(int $id)
    {
        $n = $this->db()->delete('DELETE FROM sm_admissions WHERE id = ?', [$id]);
        return $n ? response()->json(['message' => 'Đã xóa hồ sơ.']) : $this->fail('Không tìm thấy hồ sơ.', 404);
    }

    // ------------------------------------------------------------ tin nhắn liên hệ
    public function contacts(Request $r)
    {
        $w = ['1=1']; $p = [];
        $st = (string) $r->query('status', '');
        if (in_array($st, ['new', 'done'], true)) { $w[] = 'status = ?'; $p[] = $st; }
        $q = trim((string) $r->query('q', ''));
        if ($q !== '') {
            $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%';
            $w[] = '(full_name LIKE ? OR phone LIKE ? OR email LIKE ? OR message LIKE ?)';
            array_push($p, $like, $like, $like, $like);
        }
        $where = implode(' AND ', $w);
        $per = 15;
        $page = max(1, (int) $r->query('page', 1));
        $total = (int) $this->db()->selectOne("SELECT COUNT(*) n FROM sm_contacts WHERE $where", $p)->n;
        $rows = $this->db()->select("SELECT id, full_name, phone, email, topic, message, status, created_at FROM sm_contacts WHERE $where ORDER BY status = 'new' DESC, id DESC LIMIT $per OFFSET " . (($page - 1) * $per), $p);
        return response()->json(['data' => ['items' => $rows, 'total' => $total, 'page' => $page, 'pages' => max(1, (int) ceil($total / $per))]]);
    }

    public function contactUpdate(Request $r, int $id)
    {
        $st = (string) $r->input('status', '');
        if (!in_array($st, ['new', 'done'], true)) return $this->fail('Trạng thái không hợp lệ.');
        $n = $this->db()->update('UPDATE sm_contacts SET status = ? WHERE id = ?', [$st, $id]);
        return response()->json(['message' => 'Đã cập nhật.', 'changed' => $n]);
    }

    public function contactDelete(int $id)
    {
        $n = $this->db()->delete('DELETE FROM sm_contacts WHERE id = ?', [$id]);
        return $n ? response()->json(['message' => 'Đã xóa tin nhắn.']) : $this->fail('Không tìm thấy tin nhắn.', 404);
    }

    // ------------------------------------------------------------ tin tức, sự kiện
    public function news(Request $r)
    {
        $w = ['1=1']; $p = [];
        $k = (string) $r->query('kind', '');
        if (in_array($k, self::KINDS, true)) { $w[] = 'kind = ?'; $p[] = $k; }
        $q = trim((string) $r->query('q', ''));
        if ($q !== '') { $w[] = 'title LIKE ?'; $p[] = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%'; }
        $where = implode(' AND ', $w);
        $per = 15;
        $page = max(1, (int) $r->query('page', 1));
        $total = (int) $this->db()->selectOne("SELECT COUNT(*) n FROM sm_news WHERE $where", $p)->n;
        $rows = $this->db()->select("SELECT id, slug, kind, category, title, summary, tone, cover, event_date, event_place, is_published, is_featured, views, published_at FROM sm_news WHERE $where ORDER BY published_at DESC, id DESC LIMIT $per OFFSET " . (($page - 1) * $per), $p);
        return response()->json(['data' => ['items' => $rows, 'total' => $total, 'page' => $page, 'pages' => max(1, (int) ceil($total / $per)), 'categories' => self::CATS]]);
    }

    public function newsOne(int $id)
    {
        $row = $this->db()->selectOne('SELECT * FROM sm_news WHERE id = ?', [$id]);
        return $row ? response()->json(['data' => $row]) : $this->fail('Không tìm thấy bài viết.', 404);
    }

    /** Kiểm tra dữ liệu bài viết. Trả [dữ liệu sạch, lỗi]. */
    private function newsInput(Request $r): array
    {
        $d = [
            'kind' => (string) $r->input('kind', 'news'),
            'category' => trim((string) $r->input('category', 'Thông báo')),
            'title' => trim((string) $r->input('title', '')),
            'summary' => trim((string) $r->input('summary', '')),
            'body' => trim((string) $r->input('body', '')),
            'tone' => (string) $r->input('tone', 'a'),
            'cover' => trim((string) $r->input('cover', '')),
            'event_date' => trim((string) $r->input('event_date', '')),
            'event_place' => trim((string) $r->input('event_place', '')),
            'is_published' => $r->boolean('is_published', true) ? 1 : 0,
            'is_featured' => $r->boolean('is_featured', false) ? 1 : 0,
            'published_at' => trim((string) $r->input('published_at', '')),
        ];
        $e = [];
        if (!in_array($d['kind'], self::KINDS, true)) $e['kind'] = 'Loại bài không hợp lệ.';
        if (mb_strlen($d['category']) < 2 || mb_strlen($d['category']) > 40) $e['category'] = 'Chuyên mục từ 2 đến 40 ký tự.';
        if (mb_strlen($d['title']) < 5 || mb_strlen($d['title']) > 200) $e['title'] = 'Tiêu đề từ 5 đến 200 ký tự.';
        if (mb_strlen($d['summary']) < 10 || mb_strlen($d['summary']) > 400) $e['summary'] = 'Tóm tắt từ 10 đến 400 ký tự.';
        if (mb_strlen($d['body']) < 20) $e['body'] = 'Nội dung quá ngắn (tối thiểu 20 ký tự).';
        if (!in_array($d['tone'], ['a', 'b', 'c', 'd'], true)) $d['tone'] = 'a';
        if ($d['cover'] !== '' && !preg_match('#^(/[A-Za-z0-9._\-/]+|https?://\S+)$#', $d['cover'])) $e['cover'] = 'Đường dẫn ảnh dạng /images/ten-anh.jpg.';
        if ($d['kind'] === 'event') {
            $t = strtotime($d['event_date']);
            if (!$t || date('Y-m-d', $t) !== $d['event_date']) $e['event_date'] = 'Sự kiện cần có ngày diễn ra hợp lệ.';
        } else { $d['event_date'] = ''; $d['event_place'] = ''; }
        if (mb_strlen($d['event_place']) > 120) $e['event_place'] = 'Địa điểm tối đa 120 ký tự.';
        $pt = $d['published_at'] !== '' ? strtotime($d['published_at']) : time();
        if (!$pt) $e['published_at'] = 'Ngày đăng không hợp lệ.';
        $d['published_at'] = date('Y-m-d H:i:s', $pt ?: time());
        return [$d, $e];
    }

    private function slug(string $title, ?int $exceptId = null): string
    {
        $s = mb_strtolower($title, 'UTF-8');
        $s = str_replace(['đ'], ['d'], $s);
        $t = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
        if ($t === false || $t === '') $t = $s;
        $t = preg_replace('/[^a-z0-9]+/', '-', strtolower($t)) ?? '';
        $t = trim(substr($t, 0, 120), '-') ?: 'bai-viet';
        $slug = $t; $i = 2;
        while ($this->db()->selectOne('SELECT id FROM sm_news WHERE slug = ?' . ($exceptId ? ' AND id <> ' . (int) $exceptId : ''), [$slug])) $slug = $t . '-' . $i++;
        return $slug;
    }

    public function newsStore(Request $r)
    {
        [$d, $e] = $this->newsInput($r);
        if ($e) return $this->fail('Vui lòng kiểm tra lại các ô được đánh dấu.', 422, $e);
        $this->db()->insert('INSERT INTO sm_news (slug, kind, category, title, summary, body, tone, cover, event_date, event_place, is_published, is_featured, published_at, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
            $this->slug($d['title']), $d['kind'], $d['category'], $d['title'], $d['summary'], $d['body'], $d['tone'], $d['cover'] ?: null,
            $d['event_date'] ?: null, $d['event_place'] ?: null, $d['is_published'], $d['is_featured'], $d['published_at'], $this->actor($r), now()->format('Y-m-d H:i:s'),
        ]);
        return response()->json(['message' => 'Đã đăng bài.', 'id' => (int) $this->db()->getPdo()->lastInsertId()], 201);
    }

    public function newsUpdate(Request $r, int $id)
    {
        if (!$this->db()->selectOne('SELECT id FROM sm_news WHERE id = ?', [$id])) return $this->fail('Không tìm thấy bài viết.', 404);
        [$d, $e] = $this->newsInput($r);
        if ($e) return $this->fail('Vui lòng kiểm tra lại các ô được đánh dấu.', 422, $e);
        $this->db()->update('UPDATE sm_news SET kind=?, category=?, title=?, summary=?, body=?, tone=?, cover=?, event_date=?, event_place=?, is_published=?, is_featured=?, published_at=? WHERE id=?', [
            $d['kind'], $d['category'], $d['title'], $d['summary'], $d['body'], $d['tone'], $d['cover'] ?: null,
            $d['event_date'] ?: null, $d['event_place'] ?: null, $d['is_published'], $d['is_featured'], $d['published_at'], $id,
        ]);
        return response()->json(['message' => 'Đã lưu bài viết.']);
    }

    /** Bật/tắt nhanh: hiển thị hoặc nổi bật. */
    public function newsToggle(Request $r, int $id)
    {
        $f = (string) $r->input('field', '');
        if (!in_array($f, ['is_published', 'is_featured'], true)) return $this->fail('Trường không hợp lệ.');
        $n = $this->db()->update("UPDATE sm_news SET $f = IF($f = 1, 0, 1) WHERE id = ?", [$id]);
        return $n ? response()->json(['message' => 'Đã cập nhật.']) : $this->fail('Không tìm thấy bài viết.', 404);
    }

    public function newsDelete(int $id)
    {
        $n = $this->db()->delete('DELETE FROM sm_news WHERE id = ?', [$id]);
        return $n ? response()->json(['message' => 'Đã xóa bài viết.']) : $this->fail('Không tìm thấy bài viết.', 404);
    }
}
