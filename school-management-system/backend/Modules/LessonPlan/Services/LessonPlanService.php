<?php

namespace Modules\LessonPlan\Services;

use DomainException;
use Illuminate\Support\Facades\DB;

/**
 * Kế hoạch bài dạy của giáo viên: mỗi giáo viên chỉ thao tác trên các lớp-môn được phân công (sm_class_subjects.teacher_id).
 * Quy trình: draft -> submitted (nộp duyệt) -> approved | returned (cần chỉnh sửa). Mọi thời điểm dùng NOW() của MySQL.
 */
class LessonPlanService
{
    private const EDITABLE = ['draft', 'returned'];
    private const ITEM_FIELDS = ['title', 'week_no', 'periods', 'planned_date', 'objectives_knowledge', 'objectives_competence', 'objectives_quality',
        'equipment', 'act_start', 'act_learn', 'act_practice', 'act_apply', 'assessment', 'notes'];

    private function base(array $tc)
    {
        return DB::table('sm_lesson_plans as p')
            ->join('sm_class_subjects as cs', 'cs.id', '=', 'p.class_subject_id')
            ->join('sm_classes as c', 'c.id', '=', 'cs.class_id')
            ->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')
            ->where('p.teacher_id', $tc['id'])->where('c.school_year_id', $tc['year_id']);
    }

    private function cols(): array
    {
        return [
            'p.id', 'p.class_subject_id', 'p.semester', 'p.title', 'p.status', 'p.total_periods', 'p.submitted_at', 'p.reviewed_at', 'p.review_note', 'p.updated_at',
            'c.name as class_name', 'c.grade', 's.id as subject_id', 's.name as subject',
            DB::raw('(SELECT COUNT(*) FROM sm_lesson_plan_items i WHERE i.plan_id = p.id) AS lessons'),
            DB::raw("(SELECT COUNT(*) FROM sm_lesson_plan_items i WHERE i.plan_id = p.id AND i.status = 'taught') AS taught"),
        ];
    }

    private function row(object $r): array
    {
        return [
            'id' => (int) $r->id, 'class_subject_id' => (int) $r->class_subject_id, 'semester' => (int) $r->semester, 'title' => $r->title,
            'status' => $r->status, 'total_periods' => (int) $r->total_periods, 'submitted_at' => $r->submitted_at, 'reviewed_at' => $r->reviewed_at,
            'review_note' => $r->review_note, 'updated_at' => $r->updated_at, 'class_name' => $r->class_name, 'grade' => (int) $r->grade,
            'subject_id' => (int) $r->subject_id, 'subject' => $r->subject, 'lessons' => (int) $r->lessons, 'taught' => (int) $r->taught,
        ];
    }

    private function item(object $i): array
    {
        $a = (array) $i;
        foreach (['id', 'plan_id', 'position', 'week_no', 'periods'] as $k) $a[$k] = (int) $a[$k];
        unset($a['created_at']);
        return $a;
    }

    private function event(int $planId, string $type, ?int $actorId, string $name, string $action, ?string $note): void
    {
        DB::table('sm_lesson_plan_events')->insert([
            'plan_id' => $planId, 'actor_type' => $type, 'actor_id' => $actorId, 'actor_name' => $name, 'action' => $action,
            'note' => $note !== null && trim($note) !== '' ? trim($note) : null, 'created_at' => DB::raw('NOW()'),
        ]);
    }

    private function recount(int $planId): void
    {
        DB::update('UPDATE sm_lesson_plans SET total_periods = (SELECT COALESCE(SUM(periods), 0) FROM sm_lesson_plan_items WHERE plan_id = ?), updated_at = NOW() WHERE id = ?', [$planId, $planId]);
    }

    private function own(array $tc, int $id): ?object
    {
        return $this->base($tc)->where('p.id', $id)->first(['p.*']);
    }

    private function mustEdit(object $p): void
    {
        if (!in_array($p->status, self::EDITABLE, true)) {
            throw new DomainException('Kế hoạch đang chờ duyệt hoặc đã được duyệt nên chưa sửa được. Hãy mở lại kế hoạch trước khi chỉnh sửa.');
        }
    }

    private function itemOwned(array $tc, int $itemId): ?object
    {
        return DB::table('sm_lesson_plan_items as i')
            ->join('sm_lesson_plans as p', 'p.id', '=', 'i.plan_id')
            ->join('sm_class_subjects as cs', 'cs.id', '=', 'p.class_subject_id')
            ->join('sm_classes as c', 'c.id', '=', 'cs.class_id')
            ->where('i.id', $itemId)->where('p.teacher_id', $tc['id'])->where('c.school_year_id', $tc['year_id'])
            ->first(['i.*', 'p.status as plan_status']);
    }

    // ---------- Tổng quan ----------
    public function overview(array $tc): array
    {
        $args = [$tc['id'], $tc['year_id']];
        $join = 'JOIN sm_class_subjects cs ON cs.id = p.class_subject_id JOIN sm_classes c ON c.id = cs.class_id';
        $c = DB::selectOne("SELECT COUNT(*) AS total, COALESCE(SUM(p.status = 'draft'), 0) AS draft, COALESCE(SUM(p.status = 'submitted'), 0) AS submitted,
                                   COALESCE(SUM(p.status = 'approved'), 0) AS approved, COALESCE(SUM(p.status = 'returned'), 0) AS returned
                              FROM sm_lesson_plans p $join WHERE p.teacher_id = ? AND c.school_year_id = ?", $args);
        $g = DB::selectOne("SELECT COUNT(i.id) AS lessons, COALESCE(SUM(i.status = 'taught'), 0) AS taught, COALESCE(SUM(i.periods), 0) AS periods,
                                   COALESCE(SUM(CASE WHEN i.status = 'taught' THEN i.periods END), 0) AS taught_periods
                              FROM sm_lesson_plan_items i JOIN sm_lesson_plans p ON p.id = i.plan_id $join WHERE p.teacher_id = ? AND c.school_year_id = ?", $args);
        $week = DB::select("SELECT i.id, i.plan_id, i.title, i.periods, i.planned_date, i.status, c.name AS class_name, s.name AS subject
                              FROM sm_lesson_plan_items i JOIN sm_lesson_plans p ON p.id = i.plan_id $join JOIN sm_subjects s ON s.id = cs.subject_id
                             WHERE p.teacher_id = ? AND c.school_year_id = ? AND i.planned_date IS NOT NULL AND YEARWEEK(i.planned_date, 1) = YEARWEEK(CURDATE(), 1)
                             ORDER BY i.planned_date, c.name LIMIT 12", $args);
        $back = DB::select("SELECT p.id, p.title, p.review_note, p.reviewed_at, c.name AS class_name
                              FROM sm_lesson_plans p $join WHERE p.teacher_id = ? AND c.school_year_id = ? AND p.status = 'returned'
                             ORDER BY p.reviewed_at DESC LIMIT 5", $args);
        return [
            'plans' => array_map('intval', (array) $c), 'progress' => array_map('intval', (array) $g),
            'this_week' => array_map(fn ($x) => (array) $x, $week), 'returned' => array_map(fn ($x) => (array) $x, $back),
        ];
    }

    // ---------- Kế hoạch ----------
    public function list(array $tc, array $f): array
    {
        $q = $this->base($tc)->select($this->cols());
        if (!empty($f['class_subject_id'])) $q->where('p.class_subject_id', (int) $f['class_subject_id']);
        if (!empty($f['semester'])) $q->where('p.semester', (int) $f['semester']);
        if (!empty($f['status']) && in_array($f['status'], ['draft', 'submitted', 'approved', 'returned'], true)) $q->where('p.status', $f['status']);
        return $q->orderByRaw("FIELD(p.status, 'returned', 'draft', 'submitted', 'approved')")->orderBy('c.grade')->orderBy('c.name')->orderBy('p.semester')
            ->get()->map(fn ($r) => $this->row($r))->all();
    }

    private function pack(object $p, bool $owner): array
    {
        $items = DB::table('sm_lesson_plan_items')->where('plan_id', $p->id)->orderBy('position')->get()->map(fn ($i) => $this->item($i))->all();
        $events = DB::table('sm_lesson_plan_events')->where('plan_id', $p->id)->orderBy('id')
            ->get(['id', 'actor_type', 'actor_name', 'action', 'note', 'created_at'])->map(fn ($e) => (array) $e)->all();
        $rev = $p->reviewer_id ? DB::table('sm_staff_accounts')->where('id', $p->reviewer_id)->value('full_name') : null;
        return $this->row($p) + [
            'description' => $p->description, 'reviewer_name' => $rev,
            'teacher_name' => $p->teacher_name ?? null,
            'can_edit' => $owner && in_array($p->status, self::EDITABLE, true),
            'items' => $items, 'events' => $events,
        ];
    }

    public function detail(array $tc, int $id): ?array
    {
        $p = $this->base($tc)->select(array_merge($this->cols(), ['p.description', 'p.reviewer_id']))->where('p.id', $id)->first();
        return $p ? $this->pack($p, true) : null;
    }

    public function create(array $tc, array $d): int
    {
        $ok = DB::table('sm_class_subjects as cs')->join('sm_classes as c', 'c.id', '=', 'cs.class_id')
            ->where('cs.id', (int) $d['class_subject_id'])->where('cs.teacher_id', $tc['id'])->where('c.school_year_id', $tc['year_id'])->exists();
        if (!$ok) throw new DomainException('Bạn không được phân công dạy môn và lớp này.');
        if (DB::table('sm_lesson_plans')->where('class_subject_id', $d['class_subject_id'])->where('semester', $d['semester'])->exists()) {
            throw new DomainException('Lớp và môn này đã có kế hoạch cho học kỳ đã chọn. Hãy mở kế hoạch cũ để chỉnh sửa.');
        }
        return DB::transaction(function () use ($tc, $d) {
            $id = DB::table('sm_lesson_plans')->insertGetId([
                'class_subject_id' => (int) $d['class_subject_id'], 'teacher_id' => $tc['id'], 'semester' => (int) $d['semester'],
                'title' => trim($d['title']), 'description' => $d['description'] ?? null, 'status' => 'draft',
                'created_at' => DB::raw('NOW()'), 'updated_at' => DB::raw('NOW()'),
            ]);
            $this->event($id, 'teacher', $tc['id'], $tc['name'], 'create', null);
            return $id;
        });
    }

    public function updateHeader(array $tc, int $id, array $d): bool
    {
        $p = $this->own($tc, $id);
        if (!$p) return false;
        $this->mustEdit($p);
        $upd = array_intersect_key($d, array_flip(['title', 'description']));
        if ($upd) DB::table('sm_lesson_plans')->where('id', $id)->update($upd + ['updated_at' => DB::raw('NOW()')]);
        return true;
    }

    public function remove(array $tc, int $id): bool
    {
        $p = $this->own($tc, $id);
        if (!$p) return false;
        if ($p->status !== 'draft') throw new DomainException('Chỉ xóa được kế hoạch ở trạng thái bản nháp.');
        DB::table('sm_lesson_plans')->where('id', $id)->delete();
        return true;
    }

    public function submit(array $tc, int $id): bool
    {
        $p = $this->own($tc, $id);
        if (!$p) return false;
        $this->mustEdit($p);
        if (!DB::table('sm_lesson_plan_items')->where('plan_id', $id)->exists()) throw new DomainException('Kế hoạch chưa có bài học nào để nộp duyệt.');
        $bad = DB::select("SELECT position FROM sm_lesson_plan_items WHERE plan_id = ?
                              AND (TRIM(title) = '' OR TRIM(COALESCE(objectives_knowledge, '')) = '' OR TRIM(COALESCE(act_learn, '')) = '') ORDER BY position", [$id]);
        if ($bad) throw new DomainException('Còn ' . count($bad) . ' bài chưa đủ nội dung bắt buộc (mục tiêu về kiến thức và hoạt động hình thành kiến thức): '
            . implode(', ', array_map(fn ($x) => 'Bài ' . $x->position, array_slice($bad, 0, 8))) . (count($bad) > 8 ? '...' : '') . '.');
        DB::table('sm_lesson_plans')->where('id', $id)->update([
            'status' => 'submitted', 'submitted_at' => DB::raw('NOW()'), 'reviewer_id' => null, 'reviewed_at' => null, 'review_note' => null, 'updated_at' => DB::raw('NOW()'),
        ]);
        $this->event($id, 'teacher', $tc['id'], $tc['name'], 'submit', null);
        return true;
    }

    /** Rút lại hoặc mở lại kế hoạch đã nộp/đã duyệt để chỉnh sửa */
    public function reopen(array $tc, int $id, ?string $note): bool
    {
        $p = $this->own($tc, $id);
        if (!$p) return false;
        if (!in_array($p->status, ['submitted', 'approved'], true)) throw new DomainException('Kế hoạch đang ở trạng thái có thể chỉnh sửa.');
        DB::table('sm_lesson_plans')->where('id', $id)->update(['status' => 'draft', 'updated_at' => DB::raw('NOW()')]);
        $this->event($id, 'teacher', $tc['id'], $tc['name'], 'reopen', $note);
        return true;
    }

    /** Sao chép kế hoạch (và toàn bộ bài học) sang các lớp cùng môn mà giáo viên dạy */
    public function clone(array $tc, int $id, array $targets): ?array
    {
        $src = $this->base($tc)->select(array_merge($this->cols(), ['p.description']))->where('p.id', $id)->first();
        if (!$src) return null;
        $created = []; $skipped = [];
        foreach (array_unique(array_map('intval', $targets)) as $csId) {
            $t = DB::table('sm_class_subjects as cs')->join('sm_classes as c', 'c.id', '=', 'cs.class_id')
                ->where('cs.id', $csId)->where('cs.teacher_id', $tc['id'])->where('c.school_year_id', $tc['year_id'])->first(['cs.id', 'cs.subject_id', 'c.name']);
            if (!$t || (int) $t->subject_id !== (int) $src->subject_id || $csId === (int) $src->class_subject_id) {
                $skipped[] = ['class_subject_id' => $csId, 'reason' => 'Không phải lớp cùng môn mà bạn đang dạy.']; continue;
            }
            if (DB::table('sm_lesson_plans')->where('class_subject_id', $csId)->where('semester', $src->semester)->exists()) {
                $skipped[] = ['class_subject_id' => $csId, 'class_name' => $t->name, 'reason' => 'Lớp này đã có kế hoạch cùng học kỳ.']; continue;
            }
            $newId = DB::transaction(function () use ($tc, $src, $t, $id) {
                $nid = DB::table('sm_lesson_plans')->insertGetId([
                    'class_subject_id' => $t->id, 'teacher_id' => $tc['id'], 'semester' => $src->semester,
                    'title' => str_replace($src->class_name, $t->name, $src->title), 'description' => $src->description, 'status' => 'draft',
                    'created_at' => DB::raw('NOW()'), 'updated_at' => DB::raw('NOW()'),
                ]);
                DB::insert('INSERT INTO sm_lesson_plan_items (plan_id, position, week_no, periods, title, objectives_knowledge, objectives_competence, objectives_quality,
                                equipment, act_start, act_learn, act_practice, act_apply, assessment, notes, status, created_at, updated_at)
                            SELECT ?, position, week_no, periods, title, objectives_knowledge, objectives_competence, objectives_quality,
                                equipment, act_start, act_learn, act_practice, act_apply, assessment, notes, \'planned\', NOW(), NOW()
                              FROM sm_lesson_plan_items WHERE plan_id = ?', [$nid, $id]);
                $this->recount($nid);
                $this->event($nid, 'teacher', $tc['id'], $tc['name'], 'clone', 'Sao chép từ kế hoạch lớp ' . $src->class_name);
                return $nid;
            });
            $created[] = ['id' => (int) $newId, 'class_name' => $t->name];
        }
        return ['created' => $created, 'skipped' => $skipped];
    }

    // ---------- Bài học ----------
    private function itemData(array $d): array
    {
        $x = array_intersect_key($d, array_flip(self::ITEM_FIELDS));
        foreach ($x as $k => $v) if (is_string($v)) $x[$k] = trim($v) === '' && $k !== 'title' ? null : trim($v);
        return $x;
    }

    public function addItem(array $tc, int $planId, array $d): ?array
    {
        $p = $this->own($tc, $planId);
        if (!$p) return null;
        $this->mustEdit($p);
        $pos = (int) DB::table('sm_lesson_plan_items')->where('plan_id', $planId)->max('position') + 1;
        $data = $this->itemData($d) + ['week_no' => min(40, $pos), 'periods' => 1];
        $id = DB::table('sm_lesson_plan_items')->insertGetId($data + ['plan_id' => $planId, 'position' => $pos, 'status' => 'planned',
            'created_at' => DB::raw('NOW()'), 'updated_at' => DB::raw('NOW()')]);
        $this->recount($planId);
        return $this->item(DB::table('sm_lesson_plan_items')->where('id', $id)->first());
    }

    public function updateItem(array $tc, int $itemId, array $d): ?array
    {
        $i = $this->itemOwned($tc, $itemId);
        if (!$i) return null;
        if (!in_array($i->plan_status, self::EDITABLE, true)) throw new DomainException('Kế hoạch đang chờ duyệt hoặc đã được duyệt nên chưa sửa được. Hãy mở lại kế hoạch trước khi chỉnh sửa.');
        $data = $this->itemData($d);
        if ($data) DB::table('sm_lesson_plan_items')->where('id', $itemId)->update($data + ['updated_at' => DB::raw('NOW()')]);
        $this->recount((int) $i->plan_id);
        return $this->item(DB::table('sm_lesson_plan_items')->where('id', $itemId)->first());
    }

    public function removeItem(array $tc, int $itemId): bool
    {
        $i = $this->itemOwned($tc, $itemId);
        if (!$i) return false;
        if (!in_array($i->plan_status, self::EDITABLE, true)) throw new DomainException('Kế hoạch đang chờ duyệt hoặc đã được duyệt nên chưa sửa được.');
        DB::transaction(function () use ($i, $itemId) {
            DB::table('sm_lesson_plan_items')->where('id', $itemId)->delete();
            foreach (DB::table('sm_lesson_plan_items')->where('plan_id', $i->plan_id)->orderBy('position')->pluck('id') as $n => $id) {
                DB::table('sm_lesson_plan_items')->where('id', $id)->update(['position' => $n + 1]);
            }
            $this->recount((int) $i->plan_id);
        });
        return true;
    }

    public function reorder(array $tc, int $planId, array $ids): ?bool
    {
        $p = $this->own($tc, $planId);
        if (!$p) return null;
        $this->mustEdit($p);
        $have = DB::table('sm_lesson_plan_items')->where('plan_id', $planId)->pluck('id')->map(fn ($x) => (int) $x)->all();
        $ids = array_map('intval', $ids);
        if (count($ids) !== count($have) || array_diff($ids, $have)) throw new DomainException('Danh sách bài học không khớp với kế hoạch.');
        DB::transaction(function () use ($ids) {
            foreach ($ids as $n => $id) DB::table('sm_lesson_plan_items')->where('id', $id)->update(['position' => $n + 1]);
        });
        return true;
    }

    /** Đánh dấu đã dạy: cho phép cả khi kế hoạch đã duyệt (theo dõi tiến độ thực hiện) */
    public function markTaught(array $tc, int $itemId, bool $taught, ?string $date): ?array
    {
        $i = $this->itemOwned($tc, $itemId);
        if (!$i) return null;
        if ($i->plan_status === 'draft' || $i->plan_status === 'returned') throw new DomainException('Hãy nộp và được duyệt kế hoạch trước khi đánh dấu tiến độ dạy.');
        DB::table('sm_lesson_plan_items')->where('id', $itemId)->update([
            'status' => $taught ? 'taught' : 'planned',
            'taught_date' => $taught ? ($date ?: DB::raw('CURDATE()')) : null, 'updated_at' => DB::raw('NOW()'),
        ]);
        return $this->item(DB::table('sm_lesson_plan_items')->where('id', $itemId)->first());
    }

    // ---------- Phía người duyệt (Ban giám hiệu) ----------
    private function reviewBase()
    {
        return DB::table('sm_lesson_plans as p')
            ->join('sm_class_subjects as cs', 'cs.id', '=', 'p.class_subject_id')
            ->join('sm_classes as c', 'c.id', '=', 'cs.class_id')
            ->join('sm_school_years as y', function ($j) { $j->on('y.id', '=', 'c.school_year_id')->where('y.is_current', 1); })
            ->join('sm_subjects as s', 's.id', '=', 'cs.subject_id')
            ->join('sm_teachers as t', 't.id', '=', 'p.teacher_id');
    }

    public function reviewList(array $f): array
    {
        $status = $f['status'] ?? 'submitted';
        $q = $this->reviewBase()->select(array_merge($this->cols(), ['t.full_name as teacher_name', 't.code as teacher_code']));
        if (in_array($status, ['draft', 'submitted', 'approved', 'returned'], true)) $q->where('p.status', $status);
        if (!empty($f['q'])) {
            $like = '%' . str_replace(['%', '_'], ['\%', '\_'], trim($f['q'])) . '%';
            $q->where(function ($w) use ($like) { $w->where('t.full_name', 'like', $like)->orWhere('p.title', 'like', $like)->orWhere('c.name', 'like', $like); });
        }
        $q->orderBy($status === 'submitted' ? 'p.submitted_at' : 'p.updated_at', $status === 'submitted' ? 'asc' : 'desc');
        return $q->limit(100)->get()->map(fn ($r) => $this->row($r) + ['teacher_name' => $r->teacher_name, 'teacher_code' => $r->teacher_code])->all();
    }

    public function reviewDetail(int $id): ?array
    {
        $p = $this->reviewBase()->select(array_merge($this->cols(), ['p.description', 'p.reviewer_id', 't.full_name as teacher_name']))->where('p.id', $id)->first();
        return $p ? $this->pack($p, false) : null;
    }

    public function review(array $me, int $id, string $action, ?string $note): bool
    {
        $p = DB::table('sm_lesson_plans')->where('id', $id)->first();
        if (!$p) return false;
        if ($p->status !== 'submitted') throw new DomainException('Kế hoạch này không ở trạng thái chờ duyệt.');
        $note = $note !== null ? trim($note) : null;
        if ($action === 'return' && mb_strlen((string) $note) < 5) throw new DomainException('Hãy ghi rõ nội dung cần chỉnh sửa (ít nhất 5 ký tự).');
        DB::table('sm_lesson_plans')->where('id', $id)->update([
            'status' => $action === 'approve' ? 'approved' : 'returned', 'reviewer_id' => $me['id'], 'reviewed_at' => DB::raw('NOW()'),
            'review_note' => $note !== '' ? $note : null, 'updated_at' => DB::raw('NOW()'),
        ]);
        $this->event($id, 'reviewer', $me['id'], $me['name'], $action, $note);
        return true;
    }
}
