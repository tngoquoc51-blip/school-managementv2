<?php

namespace Modules\Waiver\Services;

use DomainException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Nghiệp vụ Miễn giảm học phí.
 * Đọc/ghi trực tiếp các bảng sm_* trong school_db.
 */
class WaiverService
{
    public const TERMS = ['HK1', 'HK2'];

    // ------------------------------------------------------------------ helpers
    private function fail(string $msg): never
    {
        throw new DomainException($msg);
    }

    public function setting(string $key, string $default = ''): string
    {
        $v = DB::table('sm_fee_settings')->where('skey', $key)->value('svalue');
        return $v === null ? $default : (string) $v;
    }

    public function yearId(?int $id = null): int
    {
        if ($id) return $id;
        return (int) (DB::table('sm_school_years')->where('is_current', 1)->value('id')
            ?? DB::table('sm_school_years')->orderByDesc('id')->value('id'));
    }

    private function yy(int $yearId): string
    {
        $label = (string) DB::table('sm_school_years')->where('id', $yearId)->value('label');
        preg_match_all('/\d{4}/', $label, $m);
        return substr($m[0][0] ?? '0000', 2) . substr($m[0][1] ?? '00', 2);
    }

    private function normTerms($terms): string
    {
        $arr = is_array($terms) ? $terms : explode(',', (string) $terms);
        $arr = array_values(array_intersect(self::TERMS, array_map('trim', $arr)));
        if (!$arr) $this->fail('Phải chọn ít nhất một học kỳ áp dụng.');
        return implode(',', $arr);
    }

    /** Học phí 1 học kỳ (tổng các khoản category = tuition áp dụng cho khối). */
    public function tuitionPerTerm(?int $grade = null): int
    {
        $items = DB::table('sm_fee_items')->where('category', 'tuition')
            ->where(fn ($q) => $q->whereNull('grade')->when($grade, fn ($x) => $x->orWhere('grade', $grade)))
            ->get(['amount', 'unit']);
        $sum = 0;
        foreach ($items as $i) $sum += $i->unit === 'năm' ? intdiv((int) $i->amount, 2) : (int) $i->amount;
        return $sum;
    }

    private function log(string $action, array $d = [], ?string $actor = null): void
    {
        DB::table('sm_fee_waiver_logs')->insert([
            'request_id' => $d['request_id'] ?? null,
            'waiver_id'  => $d['waiver_id'] ?? null,
            'student_id' => $d['student_id'] ?? null,
            'action'     => $action,
            'actor'      => $actor,
            'detail'     => json_encode($d['detail'] ?? [], JSON_UNESCAPED_UNICODE),
            'ip'         => request()->ip(),
            'created_at' => now(),
        ]);
    }

    private function notify(string $title, string $body, string $actor, string $priority = 'normal'): void
    {
        try {
            DB::table('sm_notifications')->insert([
                'title' => $title, 'body' => $body, 'type' => 'finance', 'priority' => $priority,
                'audience' => 'staff', 'sender_name' => $actor, 'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            // thông báo lỗi không được làm hỏng nghiệp vụ chính
        }
    }

    // ------------------------------------------------------------------ meta
    public function meta(): array
    {
        $current = $this->yearId();
        return [
            'years'            => DB::table('sm_school_years')->orderByDesc('id')->get(['id', 'label', 'is_current']),
            'current_year_id'  => $current,
            'types'            => DB::table('sm_fee_waiver_types')->orderBy('sort_order')->orderBy('id')->get(),
            'classes'          => DB::table('sm_classes')->where('school_year_id', $current)->orderBy('grade')->orderBy('name')->get(['id', 'name', 'grade', 'school_year_id']),
            'tuition_per_term' => $this->tuitionPerTerm(),
            'auto_apply'       => $this->setting('waiver_auto_apply', '1') === '1',
            'terms'            => self::TERMS,
        ];
    }

    // ------------------------------------------------------------------ stats
    public function stats(int $yearId): array
    {
        $req = DB::table('sm_fee_waiver_requests')->where('school_year_id', $yearId)
            ->selectRaw('status, COUNT(*) c')->groupBy('status')->pluck('c', 'status');

        $active = DB::table('sm_fee_waivers as w')
            ->where('w.school_year_id', $yearId)->where('w.status', 'active')
            ->get(['w.student_id', 'w.kind', 'w.label', 'w.percent', 'w.terms']);

        $tuition = $this->tuitionPerTerm();
        $estimate = 0; $byType = [];
        foreach ($active as $w) {
            $val = (int) round($tuition * count(explode(',', $w->terms)) * $w->percent / 100);
            $estimate += $val;
            $byType[$w->kind] ??= ['kind' => $w->kind, 'label' => $w->label, 'count' => 0, 'estimate' => 0];
            $byType[$w->kind]['count']++;
            $byType[$w->kind]['estimate'] += $val;
        }

        $byGrade = DB::table('sm_fee_waivers as w')
            ->join('sm_enrollments as e', fn ($j) => $j->on('e.student_id', '=', 'w.student_id')->on('e.school_year_id', '=', 'w.school_year_id'))
            ->join('sm_classes as c', 'c.id', '=', 'e.class_id')
            ->where('w.school_year_id', $yearId)->where('w.status', 'active')
            ->selectRaw('c.grade, COUNT(DISTINCT w.student_id) students')->groupBy('c.grade')->orderBy('c.grade')->get();

        $enrolled = DB::table('sm_enrollments')->where('school_year_id', $yearId)->count();

        $trend = DB::table('sm_fee_waiver_requests')
            ->where('school_year_id', $yearId)->whereNotNull('reviewed_at')
            ->where('reviewed_at', '>=', now()->subMonths(5)->startOfMonth())
            ->selectRaw("DATE_FORMAT(reviewed_at,'%Y-%m') m, status, COUNT(*) c")
            ->groupBy('m', 'status')->orderBy('m')->get();

        $pending = DB::table('sm_fee_waiver_requests as r')
            ->join('sm_students as s', 's.id', '=', 'r.student_id')
            ->leftJoin('sm_enrollments as e', fn ($j) => $j->on('e.student_id', '=', 'r.student_id')->on('e.school_year_id', '=', 'r.school_year_id'))
            ->leftJoin('sm_classes as c', 'c.id', '=', 'e.class_id')
            ->where('r.school_year_id', $yearId)->where('r.status', 'pending')
            ->orderByRaw("r.priority = 'high' DESC")->orderBy('r.requested_at')->limit(6)
            ->get(['r.id', 'r.code', 'r.label', 'r.percent', 'r.priority', 'r.requested_at', 's.full_name as student_name', 's.code as student_code', 'c.name as class_name']);

        return [
            'requests'      => ['pending' => (int) ($req['pending'] ?? 0), 'approved' => (int) ($req['approved'] ?? 0), 'rejected' => (int) ($req['rejected'] ?? 0), 'cancelled' => (int) ($req['cancelled'] ?? 0)],
            'active_count'  => $active->count(),
            'students'      => $active->pluck('student_id')->unique()->count(),
            'enrolled'      => $enrolled,
            'estimate'      => $estimate,
            'by_type'       => array_values($byType),
            'by_grade'      => $byGrade,
            'trend'         => $trend,
            'pending_queue' => $pending,
        ];
    }

    // ------------------------------------------------------------------ requests
    private function requestQuery(array $f)
    {
        return DB::table('sm_fee_waiver_requests as r')
            ->join('sm_students as s', 's.id', '=', 'r.student_id')
            ->leftJoin('sm_enrollments as e', fn ($j) => $j->on('e.student_id', '=', 'r.student_id')->on('e.school_year_id', '=', 'r.school_year_id'))
            ->leftJoin('sm_classes as c', 'c.id', '=', 'e.class_id')
            ->when($f['school_year_id'] ?? null, fn ($q, $v) => $q->where('r.school_year_id', $v))
            ->when($f['status'] ?? null, fn ($q, $v) => $q->where('r.status', $v))
            ->when($f['type_id'] ?? null, fn ($q, $v) => $q->where('r.type_id', $v))
            ->when($f['grade'] ?? null, fn ($q, $v) => $q->where('c.grade', $v))
            ->when($f['class_id'] ?? null, fn ($q, $v) => $q->where('e.class_id', $v))
            ->when($f['q'] ?? null, fn ($q, $v) => $q->where(fn ($x) => $x
                ->where('s.full_name', 'like', "%$v%")->orWhere('s.code', 'like', "$v%")->orWhere('r.code', 'like', "$v%")));
    }

    private function page($paginator): array
    {
        return ['items' => $paginator->items(), 'meta' => [
            'page' => $paginator->currentPage(), 'per_page' => $paginator->perPage(),
            'total' => $paginator->total(), 'last_page' => $paginator->lastPage(),
        ]];
    }

    public function listRequests(array $f): array
    {
        $p = $this->requestQuery($f)
            ->select('r.*', 's.code as student_code', 's.full_name as student_name', 's.gender', 'c.name as class_name', 'c.grade')
            ->orderByRaw("FIELD(r.status,'pending','approved','rejected','cancelled')")->orderByDesc('r.id')
            ->paginate(min((int) ($f['per_page'] ?? 15), 100));
        return $this->page($p);
    }

    public function showRequest(int $id): array
    {
        $r = $this->requestQuery([])->where('r.id', $id)
            ->select('r.*', 's.code as student_code', 's.full_name as student_name', 's.gender', 's.birth_date', 'c.name as class_name', 'c.grade')->first();
        if (!$r) $this->fail('Không tìm thấy đơn.');
        $history = DB::table('sm_fee_waiver_logs')->where('request_id', $id)->orderBy('id')->get(['action', 'actor', 'detail', 'created_at']);
        $others = DB::table('sm_fee_waivers')->where('student_id', $r->student_id)->where('school_year_id', $r->school_year_id)
            ->where('status', 'active')->get(['id', 'label', 'percent', 'terms']);
        return ['request' => $r, 'history' => $history, 'active_waivers' => $others,
                'impact' => $this->impact((int) $r->student_id, (int) $r->school_year_id, 0, explode(',', $r->terms))];
    }

    public function createRequest(array $d, string $actor): array
    {
        return DB::transaction(function () use ($d, $actor) {
            $sid = (int) $d['student_id']; $yid = (int) $d['school_year_id'];
            if (!DB::table('sm_enrollments')->where('student_id', $sid)->where('school_year_id', $yid)->exists())
                $this->fail('Học sinh chưa được xếp lớp trong năm học này.');
            $type = DB::table('sm_fee_waiver_types')->where('id', $d['type_id'])->where('is_active', 1)->first();
            if (!$type) $this->fail('Chính sách miễn giảm không tồn tại hoặc đã tạm ngưng.');
            $percent = (int) $d['percent'];
            if ($percent < 1 || $percent > 100) $this->fail('Tỷ lệ miễn giảm phải từ 1% đến 100%.');
            if (DB::table('sm_fee_waiver_requests')->where(['student_id' => $sid, 'school_year_id' => $yid, 'type_id' => $type->id, 'status' => 'pending'])->exists())
                $this->fail('Học sinh đã có đơn "' . $type->label . '" đang chờ duyệt.');
            if (DB::table('sm_fee_waivers')->where(['student_id' => $sid, 'school_year_id' => $yid, 'kind' => $type->code, 'status' => 'active'])->exists())
                $this->fail('Học sinh đang được áp dụng chính sách "' . $type->label . '" trong năm học này.');

            $id = DB::table('sm_fee_waiver_requests')->insertGetId([
                'code' => 'TMP' . Str::random(8), 'student_id' => $sid, 'school_year_id' => $yid,
                'type_id' => $type->id, 'kind' => $type->code, 'label' => $type->label,
                'percent' => $percent, 'terms' => $this->normTerms($d['terms'] ?? self::TERMS),
                'reason' => isset($d['reason']) ? Str::limit($d['reason'], 490, '') : null,
                'proof_note' => isset($d['proof_note']) ? Str::limit($d['proof_note'], 250, '') : null,
                'priority' => ($d['priority'] ?? 'normal') === 'high' ? 'high' : 'normal',
                'status' => 'pending', 'requested_by' => $actor, 'requested_at' => now(),
            ]);
            $code = 'MG' . $this->yy($yid) . '-' . str_pad((string) $id, 5, '0', STR_PAD_LEFT);
            DB::table('sm_fee_waiver_requests')->where('id', $id)->update(['code' => $code]);

            $name = DB::table('sm_students')->where('id', $sid)->value('full_name');
            $this->log('create', ['request_id' => $id, 'student_id' => $sid, 'detail' => ['code' => $code, 'label' => $type->label, 'percent' => $percent]], $actor);
            $this->notify('Đơn miễn giảm mới ' . $code, "$name - {$type->label} ($percent%) đang chờ duyệt.", $actor, ($d['priority'] ?? '') === 'high' ? 'high' : 'normal');
            return ['id' => $id, 'code' => $code];
        });
    }

    public function approve(int $id, ?string $note, string $actor, ?bool $applyInvoices = null): array
    {
        $applyInvoices ??= $this->setting('waiver_auto_apply', '1') === '1';
        return DB::transaction(function () use ($id, $note, $actor, $applyInvoices) {
            $r = DB::table('sm_fee_waiver_requests')->where('id', $id)->lockForUpdate()->first();
            if (!$r) $this->fail('Không tìm thấy đơn.');
            if ($r->status !== 'pending') $this->fail('Đơn này đã được xử lý trước đó.');
            $now = now();
            $row = [
                'type_id' => $r->type_id, 'request_id' => $r->id, 'label' => $r->label, 'percent' => $r->percent,
                'terms' => $r->terms, 'note' => Str::limit((string) $r->reason, 250, ''), 'approved_by' => $actor,
                'status' => 'active', 'valid_from' => $now->toDateString(), 'valid_to' => null,
                'revoked_at' => null, 'revoked_by' => null, 'revoke_reason' => null, 'updated_at' => $now,
            ];
            $existing = DB::table('sm_fee_waivers')->where(['student_id' => $r->student_id, 'school_year_id' => $r->school_year_id, 'kind' => $r->kind])->first();
            if ($existing) { DB::table('sm_fee_waivers')->where('id', $existing->id)->update($row); $wid = $existing->id; }
            else $wid = DB::table('sm_fee_waivers')->insertGetId($row + [
                'student_id' => $r->student_id, 'school_year_id' => $r->school_year_id, 'kind' => $r->kind, 'created_at' => $now]);

            DB::table('sm_fee_waiver_requests')->where('id', $id)->update([
                'status' => 'approved', 'reviewed_by' => $actor, 'reviewed_at' => $now,
                'review_note' => $note ? Str::limit($note, 250, '') : null, 'waiver_id' => $wid]);

            $inv = $applyInvoices ? $this->recalcInvoices((int) $r->student_id, (int) $r->school_year_id, true, $actor) : null;
            $this->log('approve', ['request_id' => $id, 'waiver_id' => $wid, 'student_id' => $r->student_id,
                'detail' => ['note' => $note, 'invoices' => $inv ? count($inv) : 0]], $actor);
            $this->notify('Đã duyệt miễn giảm ' . $r->code, "{$r->label} ({$r->percent}%) được duyệt bởi $actor.", $actor);
            return ['waiver_id' => $wid, 'invoices' => $inv];
        });
    }

    public function reject(int $id, string $note, string $actor): void
    {
        DB::transaction(function () use ($id, $note, $actor) {
            $r = DB::table('sm_fee_waiver_requests')->where('id', $id)->lockForUpdate()->first();
            if (!$r) $this->fail('Không tìm thấy đơn.');
            if ($r->status !== 'pending') $this->fail('Đơn này đã được xử lý trước đó.');
            DB::table('sm_fee_waiver_requests')->where('id', $id)->update([
                'status' => 'rejected', 'reviewed_by' => $actor, 'reviewed_at' => now(), 'review_note' => Str::limit($note, 250, '')]);
            $this->log('reject', ['request_id' => $id, 'student_id' => $r->student_id, 'detail' => ['note' => $note]], $actor);
        });
    }

    public function cancel(int $id, string $actor): void
    {
        $r = DB::table('sm_fee_waiver_requests')->where('id', $id)->first();
        if (!$r) $this->fail('Không tìm thấy đơn.');
        if ($r->status !== 'pending') $this->fail('Chỉ hủy được đơn đang chờ duyệt.');
        DB::table('sm_fee_waiver_requests')->where('id', $id)->update(['status' => 'cancelled', 'reviewed_by' => $actor, 'reviewed_at' => now()]);
        $this->log('cancel', ['request_id' => $id, 'student_id' => $r->student_id], $actor);
    }

    public function bulkApprove(array $ids, ?string $note, string $actor): array
    {
        $ok = 0; $errors = [];
        foreach ($ids as $id) {
            try { $this->approve((int) $id, $note, $actor); $ok++; }
            catch (DomainException $e) { $errors[] = "#$id: " . $e->getMessage(); }
        }
        return ['approved' => $ok, 'errors' => $errors];
    }

    // ------------------------------------------------------------------ records (đã áp dụng)
    public function listRecords(array $f): array
    {
        $p = DB::table('sm_fee_waivers as w')
            ->join('sm_students as s', 's.id', '=', 'w.student_id')
            ->leftJoin('sm_enrollments as e', fn ($j) => $j->on('e.student_id', '=', 'w.student_id')->on('e.school_year_id', '=', 'w.school_year_id'))
            ->leftJoin('sm_classes as c', 'c.id', '=', 'e.class_id')
            ->when($f['school_year_id'] ?? null, fn ($q, $v) => $q->where('w.school_year_id', $v))
            ->when($f['status'] ?? null, fn ($q, $v) => $q->where('w.status', $v))
            ->when($f['kind'] ?? null, fn ($q, $v) => $q->where('w.kind', $v))
            ->when($f['grade'] ?? null, fn ($q, $v) => $q->where('c.grade', $v))
            ->when($f['class_id'] ?? null, fn ($q, $v) => $q->where('e.class_id', $v))
            ->when($f['q'] ?? null, fn ($q, $v) => $q->where(fn ($x) => $x->where('s.full_name', 'like', "%$v%")->orWhere('s.code', 'like', "$v%")))
            ->select('w.*', 's.code as student_code', 's.full_name as student_name', 'c.name as class_name', 'c.grade')
            ->orderByRaw("w.status = 'active' DESC")->orderByDesc('w.id')
            ->paginate(min((int) ($f['per_page'] ?? 15), 100));
        $out = $this->page($p);
        foreach ($out['items'] as $w) {
            $w->estimate = (int) round($this->tuitionPerTerm($w->grade ? (int) $w->grade : null) * count(explode(',', (string) ($w->terms ?? 'HK1,HK2'))) * $w->percent / 100);
        }
        return $out;
    }

    public function revoke(int $waiverId, string $reason, string $actor): array
    {
        return DB::transaction(function () use ($waiverId, $reason, $actor) {
            $w = DB::table('sm_fee_waivers')->where('id', $waiverId)->lockForUpdate()->first();
            if (!$w) $this->fail('Không tìm thấy bản ghi miễn giảm.');
            if ($w->status !== 'active') $this->fail('Bản ghi này đã được thu hồi.');
            DB::table('sm_fee_waivers')->where('id', $waiverId)->update([
                'status' => 'revoked', 'revoked_at' => now(), 'revoked_by' => $actor, 'revoke_reason' => Str::limit($reason, 250, ''), 'updated_at' => now()]);
            $inv = $this->recalcInvoices((int) $w->student_id, (int) $w->school_year_id, $this->setting('waiver_auto_apply', '1') === '1', $actor);
            $this->log('revoke', ['waiver_id' => $waiverId, 'student_id' => $w->student_id, 'detail' => ['reason' => $reason, 'label' => $w->label]], $actor);
            return ['invoices' => $inv];
        });
    }

    // ------------------------------------------------------------------ liên kết hóa đơn
    /**
     * Tính lại giảm trừ trên dòng học phí của hóa đơn (HK1/HK2, status = issued) theo các miễn giảm đang hiệu lực.
     * Hóa đơn đã thu quá số phải nộp mới sẽ bị bỏ qua để kế toán xử lý hoàn tiền thủ công.
     */
    public function recalcInvoices(int $studentId, int $yearId, bool $apply = true, ?string $actor = null): array
    {
        $pct = ['HK1' => 0, 'HK2' => 0];
        $waivers = DB::table('sm_fee_waivers')->where(['student_id' => $studentId, 'school_year_id' => $yearId, 'status' => 'active'])->get(['percent', 'terms']);
        foreach ($waivers as $w) foreach (explode(',', $w->terms) as $t) if (isset($pct[$t])) $pct[$t] += (int) $w->percent;
        foreach ($pct as $t => $v) $pct[$t] = min(100, $v);

        $result = [];
        $invoices = DB::table('sm_invoices')->where(['student_id' => $studentId, 'school_year_id' => $yearId, 'status' => 'issued'])->whereIn('term', self::TERMS)->get();
        foreach ($invoices as $inv) {
            $lines = DB::table('sm_invoice_lines as l')->leftJoin('sm_fee_items as f', 'f.id', '=', 'l.fee_item_id')
                ->where('l.invoice_id', $inv->id)->get(['l.id', 'l.quantity', 'l.unit_price', 'l.discount', 'f.category']);
            $subtotal = 0; $discount = 0; $updates = [];
            foreach ($lines as $l) {
                $gross = (int) $l->quantity * (int) $l->unit_price;
                $subtotal += $gross;
                $d = $l->category === 'tuition' ? (int) round($gross * $pct[$inv->term] / 100) : (int) $l->discount;
                $discount += $d;
                if ($l->category === 'tuition' && $d !== (int) $l->discount) $updates[$l->id] = [$d, $gross - $d];
            }
            $newTotal = $subtotal - $discount;
            $paid = (int) DB::table('sm_payments')->where('invoice_id', $inv->id)->where('status', 'confirmed')->sum('amount');
            $row = ['invoice' => $inv->code, 'term' => $inv->term, 'old_total' => (int) $inv->total, 'new_total' => $newTotal, 'paid' => $paid];
            if ($newTotal === (int) $inv->total) { $result[] = $row + ['result' => 'unchanged']; continue; }
            if ($paid > $newTotal) { $result[] = $row + ['result' => 'skipped_paid']; continue; }
            if ($apply) {
                foreach ($updates as $lid => [$d, $amt]) DB::table('sm_invoice_lines')->where('id', $lid)->update(['discount' => $d, 'amount' => $amt]);
                DB::table('sm_invoices')->where('id', $inv->id)->update(['subtotal' => $subtotal, 'discount' => $discount, 'total' => $newTotal]);
            }
            $result[] = $row + ['result' => $apply ? 'updated' : 'will_update'];
        }
        if ($apply && $actor) $this->log('recalc', ['student_id' => $studentId, 'detail' => ['year' => $yearId, 'invoices' => count($result)]], $actor);
        return $result;
    }

    // ------------------------------------------------------------------ tìm học sinh + xem trước tác động
    public function searchStudents(string $q, int $yearId): array
    {
        $rows = DB::table('sm_students as s')
            ->join('sm_enrollments as e', fn ($j) => $j->on('e.student_id', '=', 's.id')->where('e.school_year_id', $yearId))
            ->join('sm_classes as c', 'c.id', '=', 'e.class_id')
            ->where(fn ($x) => $x->where('s.full_name', 'like', "%$q%")->orWhere('s.code', 'like', "$q%"))
            ->orderBy('s.full_name')->limit(12)
            ->get(['s.id', 's.code', 's.full_name', 's.gender', 's.birth_date', 'c.name as class_name', 'c.grade']);
        $ids = $rows->pluck('id');
        $active = DB::table('sm_fee_waivers')->whereIn('student_id', $ids)->where('school_year_id', $yearId)->where('status', 'active')->get(['student_id', 'label', 'percent'])->groupBy('student_id');
        $pending = DB::table('sm_fee_waiver_requests')->whereIn('student_id', $ids)->where('school_year_id', $yearId)->where('status', 'pending')->selectRaw('student_id, COUNT(*) c')->groupBy('student_id')->pluck('c', 'student_id');
        foreach ($rows as $r) { $r->waivers = $active[$r->id] ?? []; $r->pending = (int) ($pending[$r->id] ?? 0); }
        return $rows->all();
    }

    public function impact(int $studentId, int $yearId, int $addPercent, array $terms): array
    {
        $grade = DB::table('sm_enrollments as e')->join('sm_classes as c', 'c.id', '=', 'e.class_id')
            ->where(['e.student_id' => $studentId, 'e.school_year_id' => $yearId])->value('c.grade');
        $tuition = $this->tuitionPerTerm($grade ? (int) $grade : null);
        $active = DB::table('sm_fee_waivers')->where(['student_id' => $studentId, 'school_year_id' => $yearId, 'status' => 'active'])->get(['percent', 'terms']);
        $out = [];
        foreach (self::TERMS as $t) {
            $cur = 0; foreach ($active as $w) if (in_array($t, explode(',', $w->terms))) $cur += (int) $w->percent;
            $cur = min(100, $cur);
            $proj = in_array($t, $terms) ? min(100, $cur + $addPercent) : $cur;
            $inv = DB::table('sm_invoices')->where(['student_id' => $studentId, 'school_year_id' => $yearId, 'term' => $t, 'status' => 'issued'])->first(['id', 'code', 'total']);
            $paid = $inv ? (int) DB::table('sm_payments')->where('invoice_id', $inv->id)->where('status', 'confirmed')->sum('amount') : 0;
            $out[] = [
                'term' => $t, 'tuition' => $tuition, 'current_percent' => $cur, 'projected_percent' => $proj,
                'current_discount' => (int) round($tuition * $cur / 100), 'projected_discount' => (int) round($tuition * $proj / 100),
                'invoice' => $inv ? ['code' => $inv->code, 'total' => (int) $inv->total, 'paid' => $paid] : null,
            ];
        }
        return ['grade' => $grade, 'terms' => $out, 'capped' => collect($out)->contains(fn ($x) => $x['current_percent'] + $addPercent > 100 && in_array($x['term'], $terms))];
    }

    // ------------------------------------------------------------------ danh mục chính sách
    public function saveType(?int $id, array $d, string $actor): int
    {
        $data = [
            'code' => $d['code'], 'label' => $d['label'], 'description' => $d['description'] ?? null,
            'default_percent' => (int) $d['default_percent'], 'applies_to' => $d['applies_to'] ?? 'tuition',
            'legal_basis' => $d['legal_basis'] ?? null, 'required_docs' => $d['required_docs'] ?? null,
            'is_active' => (int) ($d['is_active'] ?? 1), 'sort_order' => (int) ($d['sort_order'] ?? 0),
        ];
        $isNew = !$id;
        if ($id) {
            if (DB::table('sm_fee_waiver_types')->where('code', $data['code'])->where('id', '!=', $id)->exists()) $this->fail('Mã chính sách đã tồn tại.');
            DB::table('sm_fee_waiver_types')->where('id', $id)->update($data);
        } else {
            if (DB::table('sm_fee_waiver_types')->where('code', $data['code'])->exists()) $this->fail('Mã chính sách đã tồn tại.');
            $id = DB::table('sm_fee_waiver_types')->insertGetId($data);
        }
        $this->log($isNew ? 'type.create' : 'type.update', ['detail' => ['type_id' => $id, 'code' => $data['code']]], $actor);
        return $id;
    }

    public function listTypes(): array
    {
        $usage = DB::table('sm_fee_waivers')->where('status', 'active')->selectRaw('kind, COUNT(*) c')->groupBy('kind')->pluck('c', 'kind');
        return DB::table('sm_fee_waiver_types')->orderBy('sort_order')->orderBy('id')->get()
            ->map(fn ($t) => tap($t, fn ($x) => $x->usage = (int) ($usage[$t->code] ?? 0)))->all();
    }

    public function toggleType(int $id, string $actor): int
    {
        $t = DB::table('sm_fee_waiver_types')->where('id', $id)->first();
        if (!$t) $this->fail('Không tìm thấy chính sách.');
        $new = $t->is_active ? 0 : 1;
        DB::table('sm_fee_waiver_types')->where('id', $id)->update(['is_active' => $new]);
        $this->log('type.update', ['detail' => ['type_id' => $id, 'is_active' => $new]], $actor);
        return $new;
    }

    // ------------------------------------------------------------------ nhật ký + xuất file
    public function listLogs(array $f): array
    {
        $p = DB::table('sm_fee_waiver_logs as l')->leftJoin('sm_students as s', 's.id', '=', 'l.student_id')
            ->when($f['action'] ?? null, fn ($q, $v) => $q->where('l.action', 'like', "$v%"))
            ->when($f['q'] ?? null, fn ($q, $v) => $q->where(fn ($x) => $x->where('s.full_name', 'like', "%$v%")->orWhere('l.actor', 'like', "%$v%")))
            ->orderByDesc('l.id')->select('l.*', 's.full_name as student_name', 's.code as student_code')
            ->paginate(min((int) ($f['per_page'] ?? 20), 100));
        return $this->page($p);
    }

    /** Dữ liệu xuất CSV: records hoặc requests (không phân trang). */
    public function exportRows(string $what, array $f): array
    {
        $f['per_page'] = 100000;
        if ($what === 'requests') {
            $rows = $this->requestQuery($f)->select('r.code', 's.code as ma_hs', 's.full_name', 'c.name as lop', 'r.label', 'r.percent', 'r.terms', 'r.status', 'r.requested_by', 'r.requested_at', 'r.reviewed_by', 'r.reviewed_at', 'r.review_note')->orderBy('r.id')->get();
            $head = ['Mã đơn', 'Mã HS', 'Họ tên', 'Lớp', 'Chính sách', '% giảm', 'Học kỳ', 'Trạng thái', 'Người lập', 'Ngày lập', 'Người duyệt', 'Ngày duyệt', 'Ghi chú duyệt'];
        } else {
            $rows = DB::table('sm_fee_waivers as w')->join('sm_students as s', 's.id', '=', 'w.student_id')
                ->leftJoin('sm_enrollments as e', fn ($j) => $j->on('e.student_id', '=', 'w.student_id')->on('e.school_year_id', '=', 'w.school_year_id'))
                ->leftJoin('sm_classes as c', 'c.id', '=', 'e.class_id')
                ->when($f['school_year_id'] ?? null, fn ($q, $v) => $q->where('w.school_year_id', $v))
                ->select('s.code as ma_hs', 's.full_name', 'c.name as lop', 'w.label', 'w.percent', 'w.terms', 'w.status', 'w.approved_by', 'w.valid_from', 'w.revoked_at', 'w.revoke_reason')->orderBy('c.name')->orderBy('s.full_name')->get();
            $head = ['Mã HS', 'Họ tên', 'Lớp', 'Chính sách', '% giảm', 'Học kỳ', 'Trạng thái', 'Người duyệt', 'Hiệu lực từ', 'Thu hồi lúc', 'Lý do thu hồi'];
        }
        return [$head, $rows];
    }
}
