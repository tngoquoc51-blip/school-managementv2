<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FeeItem;
use App\Models\FeeReceipt;
use App\Models\Student;
use App\Models\StudentFeeDebt;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AccountantController extends Controller
{
    private function yearId(): int
    {
        return (int) (DB::table('school_years')->where('is_current', 1)->value('id') ?? 1);
    }

    private function money($n): string
    {
        return number_format((int) $n, 0, ',', '.');
    }

    /** GET /api/accountant/dashboard */
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
                    'receipt_no' => $r->receipt_no,
                    'student' => $r->student?->full_name,
                    'class' => $r->student?->classRoom?->name,
                    'amount' => $this->money($r->total_amount),
                    'amount_raw' => (int) $r->total_amount,
                    'method' => $r->payment_method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt',
                    'date' => optional($r->paid_at)->format('d/m/Y'),
                    'by' => $r->collected_by,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => [
                'total_collected' => $totalCollected,
                'total_collected_label' => $this->formatCompact($totalCollected),
                'total_debt' => $totalDebt,
                'total_debt_label' => $this->formatCompact($totalDebt),
                'paid_full_count' => $paidFullCount,
                'debt_student_count' => $debtStudentCount,
                'recent_receipts' => $recent,
            ],
        ]);
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

    /** GET /api/accountant/fees */
    public function fees()
    {
        $yearId = $this->yearId();

        $items = FeeItem::where('school_year_id', $yearId)
            ->orderBy('id')
            ->get()
            ->map(function ($f, $i) {
                $target = match ($f->target_type) {
                    'grade' => 'Khối ' . ($f->grade_level ?? ''),
                    'class' => 'Theo lớp',
                    default => 'Toàn trường',
                };
                $statusLabel = match ($f->status) {
                    'active' => 'Đang áp dụng',
                    'pending' => 'Chưa mở',
                    default => 'Ngừng',
                };
                $period = $f->semester_code
                    ?: match ($f->period_type) {
                        'year' => 'Năm',
                        'once' => 'Đầu năm',
                        default => 'Học kỳ',
                    };

                return [
                    'stt' => $i + 1,
                    'id' => $f->id,
                    'name' => $f->name,
                    'target' => $target,
                    'amount' => $this->money($f->amount),
                    'amount_raw' => (int) $f->amount,
                    'period' => $period,
                    'status' => $f->status,
                    'status_label' => $statusLabel,
                ];
            });

        return response()->json(['success' => true, 'data' => $items]);
    }

    /** GET /api/accountant/debts */
    public function debts(Request $request)
    {
        $yearId = $this->yearId();
        $grade = $request->query('grade'); // 10, 11, 12
        $status = $request->query('status'); // unpaid, partial, all
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
                // class name bắt đầu bằng khối, VD 10A2
                $query->where('classes.name', 'like', $grade . '%');
            })
            ->groupBy('students.id', 'students.code', 'students.full_name', 'classes.name')
            ->havingRaw('total_debt > 0')
            ->orderByDesc('total_debt')
            ->get();

        $data = $rows->map(function ($r, $i) use ($status) {
            $st = (int) $r->total_paid === 0 ? 'unpaid' : 'partial';
            if ($status && $status !== 'all' && $st !== $status) {
                return null;
            }
            return [
                'stt' => $i + 1,
                'code' => $r->code,
                'name' => $r->full_name,
                'class' => $r->class_name,
                'total' => $this->money($r->total_due),
                'paid' => $this->money($r->total_paid),
                'debt' => $this->money($r->total_debt),
                'status' => $st,
            ];
        })->filter()->values();

        // re-index stt
        $data = $data->values()->map(function ($row, $i) {
            $row['stt'] = $i + 1;
            return $row;
        });

        return response()->json([
            'success' => true,
            'data' => $data,
            'summary' => [
                'debt_count' => $data->count(),
                'total_debt' => (int) $rows->sum('total_debt'),
                'partial_count' => $data->where('status', 'partial')->count(),
                'unpaid_count' => $data->where('status', 'unpaid')->count(),
            ],
        ]);
    }

    /** GET /api/accountant/receipts */
    public function receipts(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        $date = $request->query('date'); // YYYY-MM-DD

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
                    'no' => $r->receipt_no,
                    'student' => $r->student?->full_name,
                    'class' => $r->student?->classRoom?->name,
                    'amount' => $this->money($r->total_amount),
                    'method' => $r->payment_method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt',
                    'date' => optional($r->paid_at)->format('d/m/Y'),
                    'by' => $r->collected_by,
                ];
            });

        return response()->json(['success' => true, 'data' => $list]);
    }

    /** GET /api/accountant/reports */
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
                    'name' => $r->name,
                    'paid_students' => (int) $r->paid_students,
                    'collected' => $this->money($r->collected),
                    'collected_raw' => (int) $r->collected,
                    'debt_students' => (int) $r->debt_students,
                    'remain' => $this->money($r->remain),
                    'remain_raw' => (int) $r->remain,
                ];
            });

        $totalCollected = (int) StudentFeeDebt::where('school_year_id', $yearId)->sum('amount_paid');
        $totalDebt = (int) StudentFeeDebt::where('school_year_id', $yearId)
            ->selectRaw('COALESCE(SUM(GREATEST(amount_due - amount_paid, 0)), 0) as s')
            ->value('s');

        $todayCollected = (int) FeeReceipt::whereDate('paid_at', now()->toDateString())->sum('total_amount');

        return response()->json([
            'success' => true,
            'data' => [
                'today_collected_label' => $this->formatCompact($todayCollected),
                'semester_collected_label' => $this->formatCompact($totalCollected),
                'semester_debt_label' => $this->formatCompact($totalDebt),
                'by_item' => $byItem,
            ],
        ]);
    }

    /** GET /api/accountant/students/search?q= */
    public function searchStudent(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        $className = $request->query('class');

        if ($q === '' && !$className) {
            return response()->json(['success' => true, 'data' => null]);
        }

        $student = Student::with('classRoom')
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($w) use ($q) {
                    $w->where('code', 'like', "%{$q}%")
                        ->orWhere('full_name', 'like', "%{$q}%");
                });
            })
            ->when($className, function ($query) use ($className) {
                $query->whereHas('classRoom', fn ($c) => $c->where('name', $className));
            })
            ->where('status', 'active')
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
                return [
                    'id' => $d->id,
                    'fee_name' => $d->feeItem?->name,
                    'amount_due' => (int) $d->amount_due,
                    'amount_paid' => (int) $d->amount_paid,
                    'remain' => max(0, (int) $d->amount_due - (int) $d->amount_paid),
                    'amount_due_label' => $this->money($d->amount_due),
                    'amount_paid_label' => $this->money($d->amount_paid),
                    'remain_label' => $this->money(max(0, (int) $d->amount_due - (int) $d->amount_paid)),
                    'status' => $d->status,
                ];
            });

        $remainTotal = $debts->sum('remain');

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $student->id,
                'code' => $student->code,
                'name' => $student->full_name,
                'class' => $student->classRoom?->name,
                'remain_total' => $remainTotal,
                'remain_total_label' => $this->money($remainTotal),
                'status_label' => $remainTotal > 0
                    ? ('Còn nợ ' . $this->money($remainTotal) . ' đ')
                    : 'Đã đóng đủ',
                'debts' => $debts,
            ],
        ]);
    }
}
