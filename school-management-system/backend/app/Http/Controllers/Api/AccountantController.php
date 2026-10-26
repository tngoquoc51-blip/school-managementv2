<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FeeItem;
use App\Models\FeeReceipt;
use App\Models\Student;
use App\Models\StudentFeeDebt;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AccountantController extends Controller
{
    /* =========================================================
     |  TIỆN ÍCH
     * ========================================================= */

    private function yearId(): int
    {
        return (int) (DB::table('school_years')->where('is_current', 1)->value('id') ?? 1);
    }

    private function money($n): string
    {
        return number_format((int) $n, 0, ',', '.');
    }

    private function formatCompact(int $n): string
    {
        if ($n >= 1_000_000_000) {
            return round($n / 1_000_000_000, 2) . ' tỷ';
        }
        if ($n >= 1_000_000) {
            return round($n / 1_000_000, 1) . ' triệu';
        }

        return $this->money($n) . ' đ';
    }

    private function feeAudit(string $action, ?int $feeId = null, $detail = null): void
    {
        try {
            if (!Schema::hasTable('sm_fee_audit')) {
                return;
            }
            DB::table('sm_fee_audit')->insert([
                'actor_id'    => auth()->id(),
                'action'      => $action,
                'fee_item_id' => $feeId,
                'detail'      => is_string($detail)
                    ? $detail
                    : json_encode($detail, JSON_UNESCAPED_UNICODE),
                'ip'          => request()->ip(),
                'created_at'  => now(),
            ]);
        } catch (\Throwable $e) {
            // không chặn nghiệp vụ
        }
    }

    private function mapFeeItem($f, int $stt): array
    {
        $target = match ($f->target_type) {
            'grade' => 'Khối ' . ($f->grade_level ?? ''),
            'class' => 'Theo lớp',
            default => 'Toàn trường',
        };

        $statusLabel = match ($f->status) {
            'active'  => 'Đang áp dụng',
            'pending' => 'Chưa mở',
            default   => 'Ngừng',
        };

        $period = $f->semester_code
            ?: match ($f->period_type) {
                'year' => 'Năm',
                'once' => 'Đầu năm',
                default => 'Học kỳ',
            };

        $code = $f->code ?? null;
        if (!$code) {
            $code = 'FEE' . $f->id;
        }

        $mandatory = true;
        if (isset($f->is_mandatory)) {
            $mandatory = (bool) $f->is_mandatory;
        }

        return [
            'stt'           => $stt,
            'id'            => (int) $f->id,
            'code'          => $code,
            'name'          => $f->name,
            'description'   => $f->note,
            'target'        => $target,
            'target_type'   => $f->target_type,
            'grade_level'   => $f->grade_level,
            'amount'        => $this->money($f->amount),
            'amount_raw'    => (int) $f->amount,
            'period'        => $period,
            'period_type'   => $f->period_type,
            'semester_code' => $f->semester_code,
            'is_mandatory'  => $mandatory,
            'status'        => $f->status,
            'status_label'  => $statusLabel,
        ];
    }

    /* =========================================================
     |  DASHBOARD
     * ========================================================= */

    /** GET /api/v1/accountant/dashboard */
    public function dashboard()
    {
        $yearId = $this->yearId();

        $totalCollected = (int) StudentFeeDebt::where('school_year_id', $yearId)->sum('amount_paid');

        $totalDebt = (int) StudentFeeDebt::where('school_year_id', $yearId)
            ->whereColumn('amount_due', '>', 'amount_paid')
            ->selectRaw('COALESCE(SUM(amount_due - amount_paid), 0) as s')
            ->value('s');

        $hasDebtIds = StudentFeeDebt::where('school_year_id', $yearId)
            ->whereIn('status', ['unpaid', 'partial'])
            ->distinct()
            ->pluck('student_id');

        $debtStudentCount = $hasDebtIds->count();

        $activeStudentIds = Student::where('status', 'active')->pluck('id');
        $paidFullCount = $activeStudentIds->filter(function ($sid) use ($yearId) {
            $debts = StudentFeeDebt::where('student_id', $sid)
                ->where('school_year_id', $yearId)
                ->get();
            if ($debts->isEmpty()) {
                return false;
            }

            return $debts->every(fn ($d) => $d->status === 'paid');
        })->count();

        $recent = FeeReceipt::with(['student.classRoom'])
            ->orderByDesc('paid_at')
            ->orderByDesc('id')
            ->limit(10)
            ->get()
            ->map(function ($r) {
                return [
                    'receipt_no'  => $r->receipt_no,
                    'student'     => $r->student?->full_name,
                    'class'       => $r->student?->classRoom?->name,
                    'amount'      => $this->money($r->total_amount),
                    'amount_raw'  => (int) $r->total_amount,
                    'method'      => $r->payment_method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt',
                    'date'        => optional($r->paid_at)->format('d/m/Y'),
                    'by'          => $r->collected_by,
                ];
            });

        return response()->json([
            'success' => true,
            'data'    => [
                'total_collected'       => $totalCollected,
                'total_collected_label' => $this->formatCompact($totalCollected),
                'total_debt'            => $totalDebt,
                'total_debt_label'      => $this->formatCompact($totalDebt),
                'paid_full_count'       => $paidFullCount,
                'debt_student_count'    => $debtStudentCount,
                'recent_receipts'       => $recent,
            ],
        ]);
    }

    /* =========================================================
     |  DANH MỤC KHOẢN THU (CRUD)
     * ========================================================= */

    /** GET /api/v1/accountant/fees?status=all|active|inactive */
    public function fees(Request $request)
    {
        $yearId = $this->yearId();
        $status = $request->query('status');

        $q = FeeItem::where('school_year_id', $yearId)->orderBy('id');

        if ($status === 'active') {
            $q->where('status', 'active');
        } elseif ($status === 'inactive') {
            $q->where('status', 'inactive');
        }

        $items = $q->get()->values()->map(fn ($f, $i) => $this->mapFeeItem($f, $i + 1));

        return response()->json(['success' => true, 'data' => $items]);
    }

    /** POST /api/v1/accountant/fees */
    public function storeFee(Request $request)
    {
        $yearId = $this->yearId();

        $v = $request->validate([
            'name'          => 'required|string|max:150',
            'amount'        => 'required|integer|min:0',
            'code'          => 'nullable|string|max:32',
            'target_type'   => 'nullable|in:all,grade,class',
            'grade_level'   => 'nullable|integer|in:10,11,12',
            'period_type'   => 'nullable|in:semester,year,once',
            'semester_code' => 'nullable|string|max:10',
            'is_mandatory'  => 'nullable|boolean',
            'status'        => 'nullable|in:active,inactive,pending',
            'description'   => 'nullable|string',
        ]);

        $data = [
            'school_year_id' => $yearId,
            'name'           => $v['name'],
            'target_type'    => $v['target_type'] ?? 'all',
            'grade_level'    => $v['grade_level'] ?? null,
            'amount'         => $v['amount'],
            'period_type'    => $v['period_type'] ?? 'semester',
            'semester_code'  => $v['semester_code'] ?? null,
            'status'         => $v['status'] ?? 'active',
            'note'           => $v['description'] ?? null,
            'created_at'     => now(),
            'updated_at'     => now(),
        ];

        if (Schema::hasColumn('fee_items', 'code')) {
            $data['code'] = $v['code'] ?? null;
        }
        if (Schema::hasColumn('fee_items', 'is_mandatory')) {
            $data['is_mandatory'] = ($v['is_mandatory'] ?? true) ? 1 : 0;
        }

        $id = DB::table('fee_items')->insertGetId($data);

        if (Schema::hasColumn('fee_items', 'code') && empty($v['code'])) {
            DB::table('fee_items')->where('id', $id)->update(['code' => 'FEE' . $id]);
        }

        $this->feeAudit('fee_create', $id, $v);

        return response()->json(['success' => true, 'data' => ['id' => $id]], 201);
    }

    /** PUT /api/v1/accountant/fees/{id} */
    public function updateFee(Request $request, int $id)
    {
        $row = FeeItem::where('id', $id)->where('school_year_id', $this->yearId())->first();
        if (!$row) {
            return response()->json(['success' => false, 'message' => 'Không tìm thấy khoản thu'], 404);
        }

        $v = $request->validate([
            'name'          => 'sometimes|string|max:150',
            'amount'        => 'sometimes|integer|min:0',
            'code'          => 'nullable|string|max:32',
            'target_type'   => 'nullable|in:all,grade,class',
            'grade_level'   => 'nullable|integer|in:10,11,12',
            'period_type'   => 'nullable|in:semester,year,once',
            'semester_code' => 'nullable|string|max:10',
            'is_mandatory'  => 'nullable|boolean',
            'status'        => 'nullable|in:active,inactive,pending',
            'description'   => 'nullable|string',
        ]);

        $upd = ['updated_at' => now()];

        foreach (['name', 'amount', 'target_type', 'grade_level', 'period_type', 'semester_code', 'status'] as $k) {
            if (array_key_exists($k, $v)) {
                $upd[$k] = $v[$k];
            }
        }
        if (array_key_exists('code', $v) && Schema::hasColumn('fee_items', 'code')) {
            $upd['code'] = $v['code'];
        }
        if (array_key_exists('is_mandatory', $v) && Schema::hasColumn('fee_items', 'is_mandatory')) {
            $upd['is_mandatory'] = $v['is_mandatory'] ? 1 : 0;
        }
        if (array_key_exists('description', $v)) {
            $upd['note'] = $v['description'];
        }

        DB::table('fee_items')->where('id', $id)->update($upd);
        $this->feeAudit('fee_update', $id, $v);

        return response()->json(['success' => true, 'message' => 'Đã cập nhật']);
    }

    /** PATCH /api/v1/accountant/fees/{id}/status */
    public function toggleFeeStatus(int $id)
    {
        $row = FeeItem::where('id', $id)->where('school_year_id', $this->yearId())->first();
        if (!$row) {
            return response()->json(['success' => false, 'message' => 'Không tìm thấy'], 404);
        }

        $next = $row->status === 'active' ? 'inactive' : 'active';
        $row->status = $next;
        $row->save();

        $this->feeAudit('fee_toggle', $id, ['status' => $next]);

        return response()->json(['success' => true, 'data' => ['status' => $next]]);
    }

    /**
     * POST /api/v1/accountant/fees/generate-debts
     * Body: { "fee_item_id": 1 }
     */
    public function generateDebts(Request $request)
    {
        $yearId = $this->yearId();
        $feeId = (int) $request->input('fee_item_id');

        $fee = FeeItem::where('id', $feeId)->where('school_year_id', $yearId)->first();
        if (!$fee) {
            return response()->json(['success' => false, 'message' => 'Khoản thu không tồn tại'], 404);
        }

        if (!Schema::hasTable('student_fee_debts')) {
            return response()->json(['success' => false, 'message' => 'Chưa có bảng student_fee_debts'], 500);
        }

        $query = DB::table('students')->where('students.status', 'active');

        if ($fee->target_type === 'grade' && $fee->grade_level) {
            $query->join('classes', 'classes.id', '=', 'students.class_id')
                ->where('classes.name', 'like', $fee->grade_level . '%');
        }

        $studentIds = $query->pluck('students.id');

        $created = 0;
        foreach ($studentIds as $sid) {
            $exists = DB::table('student_fee_debts')
                ->where('student_id', $sid)
                ->where('fee_item_id', $feeId)
                ->where('school_year_id', $yearId)
                ->exists();

            if ($exists) {
                continue;
            }

            $row = [
                'student_id'     => $sid,
                'fee_item_id'    => $feeId,
                'school_year_id' => $yearId,
                'amount_due'     => (int) $fee->amount,
                'amount_paid'    => 0,
                'status'         => 'unpaid',
                'created_at'     => now(),
                'updated_at'     => now(),
            ];

            // chỉ insert cột tồn tại
            $cols = Schema::getColumnListing('student_fee_debts');
            $row = array_intersect_key($row, array_flip($cols));

            DB::table('student_fee_debts')->insert($row);
            $created++;
        }

        $this->feeAudit('fee_generate_debts', $feeId, [
            'created' => $created,
            'targets' => $studentIds->count(),
        ]);

        return response()->json([
            'success' => true,
            'message' => "Đã tạo {$created} bản ghi công nợ",
            'data'    => [
                'created'          => $created,
                'target_students'  => $studentIds->count(),
            ],
        ]);
    }

    /** GET /api/v1/accountant/fees/export */
    public function exportFees()
    {
        $yearId = $this->yearId();
        $rows = FeeItem::where('school_year_id', $yearId)->orderBy('id')->get();

        $lines = ['STT,Mã,Tên,Số tiền,Đối tượng,Kỳ,Trạng thái'];
        foreach ($rows as $i => $f) {
            $code = $f->code ?: ('FEE' . $f->id);
            $lines[] = sprintf(
                '%d,"%s","%s",%d,"%s","%s","%s"',
                $i + 1,
                $code,
                str_replace('"', "''", $f->name),
                (int) $f->amount,
                $f->target_type,
                $f->semester_code ?: $f->period_type,
                $f->status
            );
        }

        $csv = "\xEF\xBB\xBF" . implode("\r\n", $lines);

        return response($csv, 200, [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="fee_items.csv"',
        ]);
    }

    /* =========================================================
     |  CÔNG NỢ
     * ========================================================= */

    /** GET /api/v1/accountant/debts */
    public function debts(Request $request)
    {
        $yearId = $this->yearId();
        $grade = $request->query('grade');
        $status = $request->query('status');
        $q = trim((string) $request->query('q', ''));

        $rows = StudentFeeDebt::query()
            ->select([
                'students.id as student_id',
                'students.code',
                'students.full_name',
                'classes.name as class_name',
                DB::raw('SUM(student_fee_debts.amount_due) as total_due'),
                DB::raw('SUM(student_fee_debts.amount_paid) as total_paid'),
                DB::raw('SUM(student_fee_debts.amount_due - student_fee_debts.amount_paid) as total_debt'),
            ])
            ->join('students', 'students.id', '=', 'student_fee_debts.student_id')
            ->leftJoin('classes', 'classes.id', '=', 'students.class_id')
            ->where('student_fee_debts.school_year_id', $yearId)
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($w) use ($q) {
                    $w->where('students.full_name', 'like', "%{$q}%")
                        ->orWhere('students.code', 'like', "%{$q}%");
                });
            })
            ->when($grade, function ($query) use ($grade) {
                $query->where('classes.name', 'like', $grade . '%');
            })
            ->groupBy('students.id', 'students.code', 'students.full_name', 'classes.name')
            ->havingRaw('total_debt > 0')
            ->orderByDesc('total_debt')
            ->get();

        $data = $rows->map(function ($r) use ($status) {
            $st = (int) $r->total_paid === 0 ? 'unpaid' : 'partial';
            if ($status && $status !== 'all' && $st !== $status) {
                return null;
            }

            return [
                'code'   => $r->code,
                'name'   => $r->full_name,
                'class'  => $r->class_name,
                'total'  => $this->money($r->total_due),
                'paid'   => $this->money($r->total_paid),
                'debt'   => $this->money($r->total_debt),
                'status' => $st,
            ];
        })->filter()->values()->map(function ($row, $i) {
            $row['stt'] = $i + 1;

            return $row;
        });

        return response()->json([
            'success' => true,
            'data'    => $data,
            'summary' => [
                'debt_count'    => $data->count(),
                'total_debt'    => (int) $rows->sum('total_debt'),
                'partial_count' => $data->where('status', 'partial')->count(),
                'unpaid_count'  => $data->where('status', 'unpaid')->count(),
            ],
        ]);
    }

    /* =========================================================
     |  PHIẾU THU
     * ========================================================= */

    /** GET /api/v1/accountant/receipts */
    public function receipts(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        $date = $request->query('date');

        $list = FeeReceipt::with(['student.classRoom'])
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($w) use ($q) {
                    $w->where('receipt_no', 'like', "%{$q}%")
                        ->orWhereHas('student', function ($s) use ($q) {
                            $s->where('full_name', 'like', "%{$q}%")
                                ->orWhere('code', 'like', "%{$q}%");
                        });
                });
            })
            ->when($date, fn ($query) => $query->whereDate('paid_at', $date))
            ->orderByDesc('paid_at')
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->map(function ($r) {
                return [
                    'no'      => $r->receipt_no,
                    'student' => $r->student?->full_name,
                    'class'   => $r->student?->classRoom?->name,
                    'amount'  => $this->money($r->total_amount),
                    'method'  => $r->payment_method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt',
                    'date'    => optional($r->paid_at)->format('d/m/Y'),
                    'by'      => $r->collected_by,
                ];
            });

        return response()->json(['success' => true, 'data' => $list]);
    }

    /* =========================================================
     |  BÁO CÁO
     * ========================================================= */

    /** GET /api/v1/accountant/reports */
    public function reports()
    {
        $yearId = $this->yearId();

        $byItem = StudentFeeDebt::query()
            ->select([
                'fee_items.name',
                DB::raw('SUM(CASE WHEN student_fee_debts.amount_paid > 0 THEN 1 ELSE 0 END) as paid_students'),
                DB::raw('SUM(student_fee_debts.amount_paid) as collected'),
                DB::raw('SUM(CASE WHEN student_fee_debts.amount_due > student_fee_debts.amount_paid THEN 1 ELSE 0 END) as debt_students'),
                DB::raw('SUM(student_fee_debts.amount_due - student_fee_debts.amount_paid) as remain'),
            ])
            ->join('fee_items', 'fee_items.id', '=', 'student_fee_debts.fee_item_id')
            ->where('student_fee_debts.school_year_id', $yearId)
            ->groupBy('fee_items.id', 'fee_items.name')
            ->orderBy('fee_items.id')
            ->get()
            ->map(function ($r) {
                return [
                    'name'          => $r->name,
                    'paid_students' => (int) $r->paid_students,
                    'collected'     => $this->money($r->collected),
                    'collected_raw' => (int) $r->collected,
                    'debt_students' => (int) $r->debt_students,
                    'remain'        => $this->money($r->remain),
                    'remain_raw'    => (int) $r->remain,
                ];
            });

        $totalCollected = (int) StudentFeeDebt::where('school_year_id', $yearId)->sum('amount_paid');
        $totalDebt = (int) StudentFeeDebt::where('school_year_id', $yearId)
            ->selectRaw('COALESCE(SUM(GREATEST(amount_due - amount_paid, 0)), 0) as s')
            ->value('s');

        $todayCollected = (int) FeeReceipt::whereDate('paid_at', now()->toDateString())->sum('total_amount');

        return response()->json([
            'success' => true,
            'data'    => [
                'today_collected_label'    => $this->formatCompact($todayCollected),
                'semester_collected_label' => $this->formatCompact($totalCollected),
                'semester_debt_label'      => $this->formatCompact($totalDebt),
                'by_item'                  => $byItem,
            ],
        ]);
    }

    /* =========================================================
     |  TÌM HỌC SINH (thu học phí)
     * ========================================================= */

    /** GET /api/v1/accountant/students/search?q= */
    /** GET /api/v1/accountant/students/search?q= */
    public function searchStudent(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        $className = $request->query('class');

        if ($q === '' && !$className) {
            return response()->json(['success' => true, 'data' => null]);
        }

        // Chuẩn hoá: "hs250086", "HS250086", "250086" đều tìm được
        $qRaw = $q;
        $qDigits = preg_replace('/\D+/', '', $q); // chỉ số: 250086

        $student = Student::with('classRoom')
            ->when($qRaw !== '', function ($query) use ($qRaw, $qDigits) {
                $query->where(function ($w) use ($qRaw, $qDigits) {
                    $w->where('code', 'like', '%' . $qRaw . '%')
                        ->orWhere('full_name', 'like', '%' . $qRaw . '%');

                    if ($qDigits !== '') {
                        $w->orWhere('code', 'like', '%' . $qDigits . '%');
                    }

                    // không phân biệt hoa thường
                    $w->orWhereRaw('LOWER(code) LIKE ?', ['%' . mb_strtolower($qRaw) . '%'])
                        ->orWhereRaw('LOWER(full_name) LIKE ?', ['%' . mb_strtolower($qRaw) . '%']);
                });
            })
            ->when($className, function ($query) use ($className) {
                $query->whereHas('classRoom', fn ($c) => $c->where('name', $className));
            })
            ->where(function ($w) {
                $w->where('status', 'active')
                    ->orWhereNull('status'); // phòng status null
            })
            ->first();

        if (!$student) {
            return response()->json(['success' => false, 'message' => 'Không tìm thấy học sinh'], 404);
        }

        $yearId = $this->yearId();
        $debts = StudentFeeDebt::with('feeItem')
            ->where('student_id', $student->id)
            ->where('school_year_id', $yearId)
            ->get()
            ->map(function ($d) {
                $remain = max(0, (int) $d->amount_due - (int) $d->amount_paid);

                return [
                    'id'                => $d->id,
                    'fee_name'          => $d->feeItem?->name,
                    'amount_due'        => (int) $d->amount_due,
                    'amount_paid'       => (int) $d->amount_paid,
                    'remain'            => $remain,
                    'amount_due_label'  => $this->money($d->amount_due),
                    'amount_paid_label' => $this->money($d->amount_paid),
                    'remain_label'      => $this->money($remain),
                    'status'            => $d->status,
                ];
            });

        $remainTotal = $debts->sum('remain');

        return response()->json([
            'success' => true,
            'data'    => [
                'id'                 => $student->id,
                'code'               => $student->code,
                'name'               => $student->full_name,
                'class'              => $student->classRoom?->name,
                'remain_total'       => $remainTotal,
                'remain_total_label' => $this->money($remainTotal),
                'status_label'       => $remainTotal > 0
                    ? ('Còn nợ ' . $this->money($remainTotal) . ' đ')
                    : 'Đã đóng đủ',
                'debts'              => $debts,
            ],
        ]);
    }
}

