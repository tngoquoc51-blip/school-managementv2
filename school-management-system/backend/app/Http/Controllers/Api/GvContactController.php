<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Module "Liên hệ & Hỗ trợ" của cổng Giáo vụ: /api/gv/website/inbox/*
 * Bảng: sm_contacts (tin nhắn), sm_contact_events (nhật ký xử lý), sm_contact_templates (mẫu trả lời), sm_web_settings.
 * Middleware StaffToken ở nhóm /gv đã kiểm tra đăng nhập; người thao tác lấy từ request attribute sm_staff.
 */
class GvContactController extends Controller
{
    private const STATUS = ['new' => 'Mới', 'working' => 'Đang xử lý', 'done' => 'Đã trả lời', 'spam' => 'Spam'];
    private const TOPICS = ['Tuyển sinh', 'Học phí', 'Học tập', 'Cổng thông tin', 'Khác'];
    private const CHANNELS = ['Điện thoại', 'Email', 'Zalo', 'Gặp trực tiếp', 'Khác'];

    private function db() { return DB::connection(); }

    private function fail(string $msg, int $code = 422, array $errors = [])
    {
        $b = ['message' => $msg];
        if ($errors) $b['errors'] = $errors;
        return response()->json($b, $code);
    }

    private function me(Request $r): array
    {
        $s = (array) $r->attributes->get('sm_staff');
        return ['u' => mb_substr((string) ($s['username'] ?? 'staff'), 0, 30), 'n' => mb_substr((string) ($s['name'] ?? $s['full_name'] ?? $s['username'] ?? 'Nhân viên'), 0, 80)];
    }

    private function now(): string { return now()->format('Y-m-d H:i:s'); }

    private function setting(string $k, string $def): string
    {
        $r = $this->db()->selectOne('SELECT v FROM sm_web_settings WHERE k = ?', [$k]);
        return $r ? (string) $r->v : $def;
    }

    private function sla(): int { return max(1, (int) $this->setting('sla_hours', '24')); }

    private function log(int $id, string $kind, string $body, array $me, ?string $channel = null): void
    {
        $this->db()->insert('INSERT INTO sm_contact_events (contact_id, kind, channel, body, actor, actor_name, created_at) VALUES (?,?,?,?,?,?,?)', [$id, $kind, $channel, mb_substr($body, 0, 2000), $me['u'], $me['n'], $this->now()]);
    }

    private function staffName(?string $u): ?string
    {
        if (!$u) return null;
        $r = $this->db()->selectOne('SELECT full_name FROM sm_staff_accounts WHERE username = ?', [$u]);
        return $r ? (string) $r->full_name : $u;
    }

    // ============================================================ nhân viên (để giao việc)
    public function staff()
    {
        $rows = $this->db()->select("SELECT username, full_name, role FROM sm_staff_accounts WHERE status = 'active' ORDER BY full_name");
        return response()->json(['data' => $rows]);
    }

    // ============================================================ tổng quan
    public function overview()
    {
        $sla = $this->sla();
        $cut = now()->subHours($sla)->format('Y-m-d H:i:s');
        $by = collect($this->db()->select('SELECT status, COUNT(*) n FROM sm_contacts GROUP BY status'))->pluck('n', 'status');
        $over = (int) $this->db()->selectOne("SELECT COUNT(*) n FROM sm_contacts WHERE status IN ('new','working') AND created_at < ?", [$cut])->n;
        $today = (int) $this->db()->selectOne('SELECT COUNT(*) n FROM sm_contacts WHERE DATE(created_at) = ?', [now()->format('Y-m-d')])->n;
        $unassigned = (int) $this->db()->selectOne("SELECT COUNT(*) n FROM sm_contacts WHERE status IN ('new','working') AND (assigned_to IS NULL OR assigned_to = '')")->n;
        $days = collect($this->db()->select('SELECT DATE(created_at) d, COUNT(*) n FROM sm_contacts WHERE created_at >= ? GROUP BY DATE(created_at)', [now()->subDays(13)->format('Y-m-d 00:00:00')]))->pluck('n', 'd');
        $series = [];
        for ($i = 13; $i >= 0; $i--) { $d = now()->subDays($i)->format('Y-m-d'); $series[] = ['date' => $d, 'n' => (int) ($days[$d] ?? 0)]; }
        $topics = $this->db()->select("SELECT topic, COUNT(*) n, SUM(status IN ('new','working')) open_n FROM sm_contacts WHERE status <> 'spam' GROUP BY topic ORDER BY n DESC");
        $avg = $this->db()->selectOne("SELECT AVG(TIMESTAMPDIFF(MINUTE, created_at, first_response_at)) m FROM sm_contacts WHERE first_response_at IS NOT NULL AND created_at >= ?", [now()->subDays(30)->format('Y-m-d H:i:s')]);
        $work = $this->db()->select("SELECT c.assigned_to u, COALESCE(a.full_name, c.assigned_to) name, COUNT(*) n FROM sm_contacts c LEFT JOIN sm_staff_accounts a ON a.username = c.assigned_to WHERE c.status IN ('new','working') AND c.assigned_to IS NOT NULL AND c.assigned_to <> '' GROUP BY c.assigned_to, a.full_name ORDER BY n DESC LIMIT 8");
        $latest = $this->db()->select("SELECT id, full_name, topic, message, created_at, priority FROM sm_contacts WHERE status = 'new' ORDER BY priority DESC, id DESC LIMIT 6");
        return response()->json(['data' => [
            'counts' => ['new' => (int) ($by['new'] ?? 0), 'working' => (int) ($by['working'] ?? 0), 'done' => (int) ($by['done'] ?? 0), 'spam' => (int) ($by['spam'] ?? 0), 'total' => (int) $by->sum()],
            'overdue' => $over, 'today' => $today, 'unassigned' => $unassigned, 'sla_hours' => $sla,
            'avg_response_minutes' => $avg && $avg->m !== null ? (int) round($avg->m) : null,
            'series' => $series, 'topics' => $topics, 'workload' => $work, 'latest' => $latest,
        ]]);
    }

    // ============================================================ hộp thư
    private function filters(Request $r, ?string $me = null): array
    {
        $w = ['1=1']; $p = [];
        $st = (string) $r->query('status', '');
        if ($st === 'open') $w[] = "c.status IN ('new','working')";
        elseif (isset(self::STATUS[$st])) { $w[] = 'c.status = ?'; $p[] = $st; }
        $tp = (string) $r->query('topic', '');
        if (in_array($tp, self::TOPICS, true)) { $w[] = 'c.topic = ?'; $p[] = $tp; }
        if ($r->query('priority') === '1') $w[] = 'c.priority = 1';
        if ($r->query('starred') === '1') $w[] = 'c.is_starred = 1';
        $as = (string) $r->query('assigned', '');
        if ($as === 'none') $w[] = "(c.assigned_to IS NULL OR c.assigned_to = '')";
        elseif ($as === 'me' && $me) { $w[] = 'c.assigned_to = ?'; $p[] = $me; }
        elseif ($as !== '' && $as !== 'me') { $w[] = 'c.assigned_to = ?'; $p[] = $as; }
        if ($r->query('overdue') === '1') { $w[] = "c.status IN ('new','working') AND c.created_at < ?"; $p[] = now()->subHours($this->sla())->format('Y-m-d H:i:s'); }
        foreach (['from' => '>=', 'to' => '<='] as $k => $op) {
            $v = (string) $r->query($k, '');
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) { $w[] = "c.created_at $op ?"; $p[] = $v . ($k === 'from' ? ' 00:00:00' : ' 23:59:59'); }
        }
        $q = trim((string) $r->query('q', ''));
        if ($q !== '') {
            $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%';
            $w[] = '(c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.message LIKE ?)';
            array_push($p, $like, $like, $like, $like);
        }
        return [implode(' AND ', $w), $p];
    }

    private function decorate(array $rows): array
    {
        $cut = now()->subHours($this->sla())->timestamp;
        foreach ($rows as $x) {
            $x->overdue = in_array($x->status, ['new', 'working'], true) && strtotime((string) $x->created_at) < $cut;
            $x->assigned_name = $this->staffName($x->assigned_to);
            $x->priority = (int) $x->priority; $x->is_starred = (int) $x->is_starred;
        }
        return $rows;
    }

    public function inbox(Request $r)
    {
        $me = $this->me($r)['u'];
        [$where, $p] = $this->filters($r, $me);
        $per = 15;
        $page = max(1, (int) $r->query('page', 1));
        $order = match ((string) $r->query('sort', 'smart')) {
            'old' => 'c.id ASC', 'new' => 'c.id DESC',
            default => "(c.status IN ('new','working')) DESC, c.priority DESC, c.id DESC",
        };
        $total = (int) $this->db()->selectOne("SELECT COUNT(*) n FROM sm_contacts c WHERE $where", $p)->n;
        $rows = $this->db()->select("SELECT c.id, c.full_name, c.phone, c.email, c.topic, c.message, c.status, c.priority, c.is_starred, c.assigned_to, c.created_at, c.first_response_at, c.closed_at,
            (SELECT COUNT(*) FROM sm_contact_events e WHERE e.contact_id = c.id AND e.kind IN ('reply','note')) AS notes
            FROM sm_contacts c WHERE $where ORDER BY $order LIMIT $per OFFSET " . (($page - 1) * $per), $p);
        $tabs = collect($this->db()->select('SELECT status, COUNT(*) n FROM sm_contacts GROUP BY status'))->pluck('n', 'status');
        return response()->json(['data' => [
            'items' => $this->decorate($rows), 'total' => $total, 'page' => $page, 'pages' => max(1, (int) ceil($total / $per)),
            'tabs' => ['open' => (int) (($tabs['new'] ?? 0) + ($tabs['working'] ?? 0)), 'new' => (int) ($tabs['new'] ?? 0), 'working' => (int) ($tabs['working'] ?? 0), 'done' => (int) ($tabs['done'] ?? 0), 'spam' => (int) ($tabs['spam'] ?? 0), 'all' => (int) $tabs->sum()],
            'topics' => self::TOPICS, 'sla_hours' => $this->sla(), 'me' => $me,
        ]]);
    }

    public function inboxExport(Request $r)
    {
        [$where, $p] = $this->filters($r, $this->me($r)['u']);
        $rows = $this->db()->select("SELECT c.id, c.full_name, c.phone, c.email, c.topic, c.message, c.status, c.priority, c.assigned_to, c.created_at, c.first_response_at, c.closed_at FROM sm_contacts c WHERE $where ORDER BY c.id DESC LIMIT 5000", $p);
        return response()->json(['data' => ['items' => $this->decorate($rows), 'status_labels' => self::STATUS]]);
    }

    public function show(int $id)
    {
        $c = $this->db()->selectOne('SELECT * FROM sm_contacts WHERE id = ?', [$id]);
        if (!$c) return $this->fail('Không tìm thấy tin nhắn.', 404);
        $this->decorate([$c]);
        $events = $this->db()->select('SELECT id, kind, channel, body, actor, actor_name, created_at FROM sm_contact_events WHERE contact_id = ? ORDER BY id ASC', [$id]);
        $phone = (string) ($c->phone ?? ''); $mail = (string) ($c->email ?? '');
        $same = ($phone !== '' || $mail !== '') ? $this->db()->select("SELECT id, topic, message, status, created_at FROM sm_contacts WHERE id <> ? AND ((? <> '' AND phone = ?) OR (? <> '' AND email = ?)) ORDER BY id DESC LIMIT 6", [$id, $phone, $phone, $mail, $mail]) : [];
        $adm = $phone !== '' ? $this->db()->select('SELECT id, code, full_name, status, created_at FROM sm_admissions WHERE phone = ? ORDER BY id DESC LIMIT 5', [preg_replace('/[\s.\-]/', '', $phone)]) : [];
        $prev = $this->db()->selectOne('SELECT id FROM sm_contacts WHERE id < ? ORDER BY id DESC LIMIT 1', [$id]);
        $next = $this->db()->selectOne('SELECT id FROM sm_contacts WHERE id > ? ORDER BY id ASC LIMIT 1', [$id]);
        $tpl = $this->db()->select('SELECT id, title, topic, body FROM sm_contact_templates ORDER BY (topic = ?) DESC, sort_order, id', [$c->topic]);
        return response()->json(['data' => [
            'item' => $c, 'events' => $events, 'same_sender' => $same, 'admissions' => $adm,
            'prev_id' => $prev->id ?? null, 'next_id' => $next->id ?? null, 'templates' => $tpl,
            'signature' => $this->setting('signature', ''), 'sla_hours' => $this->sla(),
            'status_labels' => self::STATUS, 'channels' => self::CHANNELS, 'topics' => self::TOPICS,
        ]]);
    }

    /** Đổi trạng thái, mức ưu tiên, người phụ trách, chủ đề, đánh dấu sao. Mỗi thay đổi ghi vào nhật ký. */
    public function update(Request $r, int $id)
    {
        $c = $this->db()->selectOne('SELECT * FROM sm_contacts WHERE id = ?', [$id]);
        if (!$c) return $this->fail('Không tìm thấy tin nhắn.', 404);
        $me = $this->me($r);
        $set = []; $p = []; $logs = [];
        if ($r->has('status')) {
            $s = (string) $r->input('status');
            if (!isset(self::STATUS[$s])) return $this->fail('Trạng thái không hợp lệ.', 422, ['status' => 'Chọn trạng thái trong danh sách.']);
            if ($s !== $c->status) {
                $set[] = 'status = ?'; $p[] = $s;
                if ($s === 'done' || $s === 'spam') { $set[] = 'closed_at = ?'; $p[] = $this->now(); if ($s === 'done' && !$c->first_response_at) { $set[] = 'first_response_at = ?'; $p[] = $this->now(); } }
                else { $set[] = 'closed_at = NULL'; }
                $logs[] = ['status', 'Đổi trạng thái: ' . (self::STATUS[$c->status] ?? $c->status) . ' → ' . self::STATUS[$s]];
            }
        }
        if ($r->has('priority')) {
            $pr = $r->boolean('priority') ? 1 : 0;
            if ($pr !== (int) $c->priority) { $set[] = 'priority = ?'; $p[] = $pr; $logs[] = ['priority', $pr ? 'Đánh dấu ưu tiên cao' : 'Bỏ ưu tiên cao']; }
        }
        if ($r->has('is_starred')) { $set[] = 'is_starred = ?'; $p[] = $r->boolean('is_starred') ? 1 : 0; }
        if ($r->has('topic')) {
            $t = (string) $r->input('topic');
            if (!in_array($t, self::TOPICS, true)) return $this->fail('Chủ đề không hợp lệ.', 422, ['topic' => 'Chọn chủ đề trong danh sách.']);
            if ($t !== $c->topic) { $set[] = 'topic = ?'; $p[] = $t; $logs[] = ['note', 'Đổi chủ đề: ' . $c->topic . ' → ' . $t]; }
        }
        if ($r->has('assigned_to')) {
            $u = trim((string) $r->input('assigned_to', ''));
            if ($u === 'me') $u = $me['u'];
            if ($u !== '' && !$this->db()->selectOne("SELECT id FROM sm_staff_accounts WHERE username = ? AND status = 'active'", [$u])) return $this->fail('Người phụ trách không hợp lệ.', 422, ['assigned_to' => 'Chọn nhân viên trong danh sách.']);
            if ($u !== (string) ($c->assigned_to ?? '')) {
                $set[] = 'assigned_to = ?'; $p[] = $u !== '' ? $u : null;
                $logs[] = ['assign', $u !== '' ? 'Giao cho ' . $this->staffName($u) : 'Bỏ phân công'];
                if ($u !== '' && $c->status === 'new') { $set[] = "status = 'working'"; }
            }
        }
        if (!$set) return response()->json(['message' => 'Không có thay đổi.']);
        $set[] = 'updated_at = ?'; $p[] = $this->now(); $p[] = $id;
        $this->db()->update('UPDATE sm_contacts SET ' . implode(', ', $set) . ' WHERE id = ?', $p);
        foreach ($logs as [$k, $b]) $this->log($id, $k, $b, $me);
        return response()->json(['message' => 'Đã cập nhật.']);
    }

    /** Thêm ghi chú nội bộ hoặc ghi nhận một lần trả lời. */
    public function addEvent(Request $r, int $id)
    {
        $c = $this->db()->selectOne('SELECT * FROM sm_contacts WHERE id = ?', [$id]);
        if (!$c) return $this->fail('Không tìm thấy tin nhắn.', 404);
        $kind = (string) $r->input('kind', 'note');
        $body = trim((string) $r->input('body', ''));
        $e = [];
        if (!in_array($kind, ['note', 'reply'], true)) return $this->fail('Loại không hợp lệ.');
        if (mb_strlen($body) < 3) $e['body'] = $kind === 'reply' ? 'Nhập nội dung đã trả lời (tối thiểu 3 ký tự).' : 'Nhập nội dung ghi chú.';
        if (mb_strlen($body) > 2000) $e['body'] = 'Tối đa 2000 ký tự.';
        $ch = null;
        if ($kind === 'reply') {
            $ch = (string) $r->input('channel', '');
            if (!in_array($ch, self::CHANNELS, true)) $e['channel'] = 'Chọn kênh đã dùng để trả lời.';
        }
        if ($e) return $this->fail('Vui lòng kiểm tra lại các ô được đánh dấu.', 422, $e);
        $me = $this->me($r);
        $this->log($id, $kind, $body, $me, $ch);
        if ($kind === 'reply') {
            $close = $r->boolean('close', true);
            $sets = ['updated_at = ?']; $p = [$this->now()];
            if (!$c->first_response_at) { $sets[] = 'first_response_at = ?'; $p[] = $this->now(); }
            if ($close) { $sets[] = "status = 'done'"; $sets[] = 'closed_at = ?'; $p[] = $this->now(); } elseif ($c->status === 'new') { $sets[] = "status = 'working'"; }
            if (!$c->assigned_to) { $sets[] = 'assigned_to = ?'; $p[] = $me['u']; }
            $p[] = $id;
            $this->db()->update('UPDATE sm_contacts SET ' . implode(', ', $sets) . ' WHERE id = ?', $p);
        }
        return response()->json(['message' => $kind === 'reply' ? 'Đã ghi nhận trả lời.' : 'Đã thêm ghi chú.'], 201);
    }

    public function destroy(int $id)
    {
        $this->db()->delete('DELETE FROM sm_contact_events WHERE contact_id = ?', [$id]);
        $n = $this->db()->delete('DELETE FROM sm_contacts WHERE id = ?', [$id]);
        return $n ? response()->json(['message' => 'Đã xóa tin nhắn.']) : $this->fail('Không tìm thấy tin nhắn.', 404);
    }

    /** Thao tác hàng loạt: status | assign | priority | delete. Tối đa 100 tin một lần. */
    public function bulk(Request $r)
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', (array) $r->input('ids', [])))));
        if (!$ids || count($ids) > 100) return $this->fail('Chọn từ 1 đến 100 tin nhắn.');
        $act = (string) $r->input('action', ''); $val = (string) $r->input('value', '');
        $me = $this->me($r); $in = implode(',', array_fill(0, count($ids), '?'));
        if ($act === 'delete') {
            $this->db()->delete("DELETE FROM sm_contact_events WHERE contact_id IN ($in)", $ids);
            $n = $this->db()->delete("DELETE FROM sm_contacts WHERE id IN ($in)", $ids);
            return response()->json(['message' => "Đã xóa $n tin nhắn.", 'count' => $n]);
        }
        $n = 0;
        foreach ($ids as $id) {
            $req = new Request();
            $req->attributes->set('sm_staff', $r->attributes->get('sm_staff'));
            if ($act === 'status') $req->merge(['status' => $val]);
            elseif ($act === 'assign') $req->merge(['assigned_to' => $val]);
            elseif ($act === 'priority') $req->merge(['priority' => $val === '1']);
            else return $this->fail('Thao tác không hợp lệ.');
            $res = $this->update($req, $id);
            if ($res->getStatusCode() === 422) return $res;
            $n++;
        }
        return response()->json(['message' => "Đã cập nhật $n tin nhắn.", 'count' => $n]);
    }

    // ============================================================ mẫu trả lời
    public function templates()
    {
        return response()->json(['data' => ['items' => $this->db()->select('SELECT id, title, topic, body, sort_order FROM sm_contact_templates ORDER BY sort_order, id'), 'topics' => self::TOPICS, 'signature' => $this->setting('signature', '')]]);
    }

    private function tplInput(Request $r): array
    {
        $d = ['title' => trim((string) $r->input('title', '')), 'topic' => trim((string) $r->input('topic', '')), 'body' => trim((string) $r->input('body', '')), 'sort_order' => (int) $r->input('sort_order', 0)];
        $e = [];
        if (mb_strlen($d['title']) < 3 || mb_strlen($d['title']) > 80) $e['title'] = 'Tên mẫu từ 3 đến 80 ký tự.';
        if ($d['topic'] !== '' && !in_array($d['topic'], self::TOPICS, true)) $e['topic'] = 'Chủ đề không hợp lệ.';
        if (mb_strlen($d['body']) < 10 || mb_strlen($d['body']) > 1500) $e['body'] = 'Nội dung từ 10 đến 1500 ký tự.';
        return [$d, $e];
    }

    public function templateStore(Request $r)
    {
        [$d, $e] = $this->tplInput($r);
        if ($e) return $this->fail('Vui lòng kiểm tra lại các ô được đánh dấu.', 422, $e);
        $this->db()->insert('INSERT INTO sm_contact_templates (title, topic, body, sort_order, created_at) VALUES (?,?,?,?,?)', [$d['title'], $d['topic'] ?: null, $d['body'], $d['sort_order'], $this->now()]);
        return response()->json(['message' => 'Đã thêm mẫu trả lời.'], 201);
    }

    public function templateUpdate(Request $r, int $id)
    {
        [$d, $e] = $this->tplInput($r);
        if ($e) return $this->fail('Vui lòng kiểm tra lại các ô được đánh dấu.', 422, $e);
        $n = $this->db()->update('UPDATE sm_contact_templates SET title=?, topic=?, body=?, sort_order=? WHERE id=?', [$d['title'], $d['topic'] ?: null, $d['body'], $d['sort_order'], $id]);
        return response()->json(['message' => 'Đã lưu mẫu trả lời.', 'changed' => $n]);
    }

    public function templateDestroy(int $id)
    {
        $n = $this->db()->delete('DELETE FROM sm_contact_templates WHERE id = ?', [$id]);
        return $n ? response()->json(['message' => 'Đã xóa mẫu.']) : $this->fail('Không tìm thấy mẫu.', 404);
    }

    // ============================================================ báo cáo
    public function report(Request $r)
    {
        $days = in_array((int) $r->query('days', 30), [7, 30, 90, 365], true) ? (int) $r->query('days', 30) : 30;
        $from = now()->subDays($days - 1)->format('Y-m-d 00:00:00');
        $sla = $this->sla();
        $tot = $this->db()->selectOne("SELECT COUNT(*) total, SUM(status = 'spam') spam, SUM(status = 'done') done, SUM(first_response_at IS NOT NULL) answered,
            AVG(CASE WHEN first_response_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, created_at, first_response_at) END) avg_min,
            SUM(first_response_at IS NOT NULL AND TIMESTAMPDIFF(HOUR, created_at, first_response_at) <= ?) in_sla
            FROM sm_contacts WHERE created_at >= ?", [$sla, $from]);
        $byDay = collect($this->db()->select('SELECT DATE(created_at) d, COUNT(*) n FROM sm_contacts WHERE created_at >= ? GROUP BY DATE(created_at)', [$from]))->pluck('n', 'd');
        $series = [];
        $step = $days > 90 ? 7 : 1;
        for ($i = $days - 1; $i >= 0; $i -= 1) { $d = now()->subDays($i)->format('Y-m-d'); $series[] = ['date' => $d, 'n' => (int) ($byDay[$d] ?? 0)]; }
        if ($step > 1) { $agg = []; foreach (array_chunk($series, $step) as $ch) $agg[] = ['date' => $ch[0]['date'], 'n' => array_sum(array_column($ch, 'n'))]; $series = $agg; }
        $topics = $this->db()->select("SELECT topic, COUNT(*) n, SUM(status = 'done') done, AVG(CASE WHEN first_response_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, created_at, first_response_at) END) avg_min FROM sm_contacts WHERE created_at >= ? AND status <> 'spam' GROUP BY topic ORDER BY n DESC", [$from]);
        $staff = $this->db()->select("SELECT COALESCE(a.full_name, c.assigned_to) name, COUNT(*) n, SUM(c.status = 'done') done FROM sm_contacts c LEFT JOIN sm_staff_accounts a ON a.username = c.assigned_to WHERE c.created_at >= ? AND c.assigned_to IS NOT NULL AND c.assigned_to <> '' GROUP BY c.assigned_to, a.full_name ORDER BY n DESC", [$from]);
        $answered = (int) ($tot->answered ?? 0);
        return response()->json(['data' => [
            'days' => $days, 'sla_hours' => $sla,
            'total' => (int) ($tot->total ?? 0), 'spam' => (int) ($tot->spam ?? 0), 'done' => (int) ($tot->done ?? 0), 'answered' => $answered,
            'avg_response_minutes' => $tot->avg_min !== null ? (int) round($tot->avg_min) : null,
            'sla_rate' => $answered ? (int) round(100 * ((int) $tot->in_sla) / $answered) : null,
            'series' => $series, 'topics' => $topics, 'staff' => $staff,
        ]]);
    }

    // ============================================================ cài đặt
    public function settings()
    {
        return response()->json(['data' => ['sla_hours' => $this->sla(), 'signature' => $this->setting('signature', '')]]);
    }

    public function settingsUpdate(Request $r)
    {
        $sla = (int) $r->input('sla_hours', 24);
        $sig = trim((string) $r->input('signature', ''));
        $e = [];
        if ($sla < 1 || $sla > 168) $e['sla_hours'] = 'Từ 1 đến 168 giờ.';
        if (mb_strlen($sig) > 300) $e['signature'] = 'Tối đa 300 ký tự.';
        if ($e) return $this->fail('Vui lòng kiểm tra lại các ô được đánh dấu.', 422, $e);
        foreach (['sla_hours' => (string) $sla, 'signature' => $sig] as $k => $v) {
            $this->db()->statement('INSERT INTO sm_web_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', [$k, $v]);
        }
        return response()->json(['message' => 'Đã lưu cài đặt.']);
    }
}
