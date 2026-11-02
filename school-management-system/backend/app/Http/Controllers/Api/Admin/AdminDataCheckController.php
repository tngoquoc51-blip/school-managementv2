<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Support\AdminNotifier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Kiểm tra chất lượng & toàn vẹn dữ liệu (chỉ đọc, không sửa dữ liệu). */
class AdminDataCheckController extends Controller
{
    private const W = ['error' => 3, 'warn' => 2, 'info' => 1];

    /** [code, module, mức độ, tiêu đề, mô tả, cách xử lý, cột mẫu, FROM, WHERE] */
    private function catalog(): array
    {
        $rows = [
            ['stu_no_enroll', 'students', 'error', 'Học sinh chưa được xếp lớp', 'Học sinh không có bản ghi ghi danh nào.', 'Vào Học sinh / Lớp học để xếp lớp.', 's.code AS ma_hs, s.full_name AS ho_ten, s.admission_year AS nam_nhap_hoc', 'sm_students s', 'NOT EXISTS (SELECT 1 FROM sm_enrollments e WHERE e.student_id=s.id)'],
            ['stu_dup_code', 'students', 'error', 'Trùng mã học sinh', 'Nhiều học sinh dùng chung một mã.', 'Đổi mã để mỗi học sinh có mã riêng.', 's.code AS ma_hs, s.full_name AS ho_ten', 'sm_students s', 's.code IN (SELECT code FROM sm_students GROUP BY code HAVING COUNT(*)>1)'],
            ['stu_no_account', 'students', 'warn', 'Học sinh chưa có tài khoản', 'Không có tài khoản đăng nhập cổng học sinh.', 'Tạo tài khoản cho học sinh.', 's.code AS ma_hs, s.full_name AS ho_ten', 'sm_students s', 'NOT EXISTS (SELECT 1 FROM sm_accounts a WHERE a.student_id=s.id)'],
            ['stu_bad_birth', 'students', 'warn', 'Ngày sinh bất thường', 'Thiếu ngày sinh, ở tương lai hoặc tuổi ngoài khoảng 10–25.', 'Đối chiếu với hồ sơ gốc và sửa.', 's.code AS ma_hs, s.full_name AS ho_ten, s.birth_date AS ngay_sinh', 'sm_students s', 's.birth_date IS NULL OR s.birth_date>CURDATE() OR TIMESTAMPDIFF(YEAR,s.birth_date,CURDATE()) NOT BETWEEN 10 AND 25'],
            ['stu_no_contact', 'students', 'warn', 'Thiếu số điện thoại liên hệ', 'Không có SĐT của học sinh, cha, mẹ hoặc người giám hộ.', 'Bổ sung trong hồ sơ học sinh.', 's.code AS ma_hs, s.full_name AS ho_ten', 'sm_students s LEFT JOIN sm_student_profiles p ON p.student_id=s.id', 'p.id IS NULL OR COALESCE(NULLIF(p.phone,""),NULLIF(p.guardian_phone,""),NULLIF(p.father_phone,""),NULLIF(p.mother_phone,"")) IS NULL'],
            ['cls_no_homeroom', 'classes', 'warn', 'Lớp chưa có giáo viên chủ nhiệm', 'Cột homeroom_teacher_id đang trống.', 'Phân công GVCN trong mục Lớp học.', 'c.grade AS khoi, c.name AS lop', 'sm_classes c', 'c.homeroom_teacher_id IS NULL'],
            ['cls_empty', 'classes', 'warn', 'Lớp không có học sinh', 'Lớp chưa có ghi danh nào.', 'Xếp học sinh vào lớp hoặc xoá lớp thừa.', 'c.grade AS khoi, c.name AS lop', 'sm_classes c', 'NOT EXISTS (SELECT 1 FROM sm_enrollments e WHERE e.class_id=c.id)'],
            ['cls_oversize', 'classes', 'warn', 'Lớp vượt sĩ số 45', 'Sĩ số lớn hơn 45 học sinh.', 'Chuyển bớt học sinh sang lớp khác.', 'c.grade AS khoi, c.name AS lop, (SELECT COUNT(*) FROM sm_enrollments e WHERE e.class_id=c.id) AS si_so', 'sm_classes c', '(SELECT COUNT(*) FROM sm_enrollments e WHERE e.class_id=c.id)>45'],
            ['cls_subject_no_teacher', 'classes', 'warn', 'Môn học chưa có giáo viên', 'Phân công môn của lớp chưa chọn giáo viên.', 'Cập nhật ở mục Phân công giảng dạy.', 'c.name AS lop, cs.subject_id AS mon_id', 'sm_class_subjects cs JOIN sm_classes c ON c.id=cs.class_id', 'cs.teacher_id IS NULL'],
            ['tch_unassigned', 'classes', 'info', 'Giáo viên chưa được phân công', 'Giáo viên không dạy lớp nào.', 'Phân công giảng dạy nếu cần.', 't.code AS ma_gv, t.full_name AS ho_ten', 'sm_teachers t', 'NOT EXISTS (SELECT 1 FROM sm_class_subjects cs WHERE cs.teacher_id=t.id)'],
            ['grd_range', 'grades', 'error', 'Điểm ngoài khoảng 0–10', 'Có cột điểm nhỏ hơn 0 hoặc lớn hơn 10.', 'Nhập lại điểm đúng.', 's.code AS ma_hs, g.subject_id AS mon_id, g.semester AS hoc_ky, g.tbm AS tbm', 'sm_grades g JOIN sm_students s ON s.id=g.student_id', 'g.tx1<0 OR g.tx1>10 OR g.tx2<0 OR g.tx2>10 OR g.tx3<0 OR g.tx3>10 OR g.tx4<0 OR g.tx4>10 OR g.gk<0 OR g.gk>10 OR g.ck<0 OR g.ck>10 OR g.tbm<0 OR g.tbm>10'],
            ['grd_no_tbm', 'grades', 'warn', 'Có điểm thành phần nhưng thiếu TBM', 'Đã có điểm giữa/cuối kỳ nhưng chưa tính TBM.', 'Tính lại điểm trung bình môn.', 's.code AS ma_hs, g.subject_id AS mon_id, g.semester AS hoc_ky', 'sm_grades g JOIN sm_students s ON s.id=g.student_id', 'g.tbm IS NULL AND (g.gk IS NOT NULL OR g.ck IS NOT NULL)'],
            ['grd_class_mismatch', 'grades', 'error', 'Điểm thuộc lớp học sinh không học', 'Lớp ghi trên điểm khác lớp đã ghi danh trong năm học.', 'Đối chiếu ghi danh và bảng điểm.', 's.code AS ma_hs, g.class_id AS lop_id, g.subject_id AS mon_id', 'sm_grades g JOIN sm_students s ON s.id=g.student_id', 'NOT EXISTS (SELECT 1 FROM sm_enrollments e WHERE e.student_id=g.student_id AND e.school_year_id=g.school_year_id AND e.class_id=g.class_id)'],
            ['cond_missing', 'grades', 'warn', 'Chưa có hạnh kiểm', 'Học sinh có ghi danh nhưng chưa có hạnh kiểm của năm học.', 'GVCN nhập hạnh kiểm.', 's.code AS ma_hs, s.full_name AS ho_ten', 'sm_enrollments e JOIN sm_students s ON s.id=e.student_id', 'NOT EXISTS (SELECT 1 FROM sm_conduct c WHERE c.student_id=e.student_id AND c.school_year_id=e.school_year_id)'],
            ['inv_total', 'finance', 'error', 'Hoá đơn sai tổng tiền', 'Tổng khác (tạm tính − giảm).', 'Tính lại hoá đơn.', 'i.code AS ma_hd, i.subtotal AS tam_tinh, i.discount AS giam, i.total AS tong', 'sm_invoices i', 'i.total<>i.subtotal-i.discount'],
            ['inv_lines', 'finance', 'warn', 'Tạm tính lệch tổng các dòng', 'Tạm tính khác tổng các dòng chi tiết.', 'Kiểm tra dòng chi tiết của hoá đơn.', 'i.code AS ma_hd, i.subtotal AS tam_tinh', 'sm_invoices i', 'i.subtotal<>(SELECT COALESCE(SUM(l.amount),0) FROM sm_invoice_lines l WHERE l.invoice_id=i.id)'],
            ['inv_due', 'finance', 'warn', 'Hạn nộp trước ngày lập', 'Hạn nộp sớm hơn ngày phát hành.', 'Sửa hạn nộp.', 'i.code AS ma_hd, i.issue_date AS ngay_lap, i.due_date AS han_nop', 'sm_invoices i', 'i.due_date<i.issue_date'],
            ['pay_orphan', 'finance', 'error', 'Phiếu thu bất thường', 'Phiếu thu mất hoá đơn hoặc số tiền ≤ 0.', 'Rà soát phiếu thu với kế toán.', 'p.receipt_code AS ma_phieu, p.amount AS so_tien', 'sm_payments p', 'p.amount<=0 OR NOT EXISTS (SELECT 1 FROM sm_invoices i WHERE i.id=p.invoice_id)'],
            ['acc_locked', 'security', 'info', 'Tài khoản đang bị khoá', 'Khoá tạm do nhập sai mật khẩu nhiều lần.', 'Chờ hết hạn khoá hoặc đặt lại mật khẩu.', 'a.username AS tai_khoan, a.locked_until AS khoa_den', 'sm_accounts a', 'a.locked_until>NOW()'],
            ['acc_must_change', 'security', 'info', 'Chưa đổi mật khẩu mặc định', 'Tài khoản còn cờ bắt buộc đổi mật khẩu.', 'Nhắc học sinh đổi mật khẩu.', 'a.username AS tai_khoan', 'sm_accounts a', 'a.must_change_password=1'],
        ];
        $out = [];
        foreach ($rows as [$code, $mod, $sev, $title, $desc, $fix, $cols, $from, $where]) {
            $out[$code] = compact('code', 'mod', 'sev', 'title', 'desc', 'fix') + [
                'count' => "SELECT COUNT(*) AS n FROM $from WHERE $where",
                'sample' => "SELECT $cols FROM $from WHERE $where LIMIT 30",
            ];
        }
        return $out;
    }

    private function guard(Request $r): void
    {
        $u = $r->user();
        $roles = method_exists($u, 'getRoleNames') ? $u->getRoleNames()->all() : [];
        $ok = $roles
            ? (bool) array_intersect($roles, ['super_admin', 'admin', 'principal', 'vice_principal'])
            : in_array(strtolower((string) $u->username), ['admin', 'superadmin'], true);
        abort_unless($ok, 403, 'Bạn không có quyền dùng chức năng kiểm tra dữ liệu.');
    }

    private function history(int $limit = 12)
    {
        return DB::table('admin_check_runs')->orderByDesc('id')->limit($limit)
            ->get(['id', 'score', 'errors', 'warnings', 'infos', 'passed', 'duration_ms', 'created_at']);
    }

    public function index(Request $r)
    {
        $this->guard($r);
        $meta = collect($this->catalog())->map(fn ($c) => collect($c)->except(['count', 'sample']))->values();
        $last = DB::table('admin_check_runs')->orderByDesc('id')->first();
        return response()->json([
            'checks' => $meta,
            'last' => $last ? ['run' => collect($last)->except('results'), 'results' => json_decode($last->results, true)] : null,
            'history' => $this->history(),
        ]);
    }

    public function run(Request $r)
    {
        $this->guard($r);
        $t0 = microtime(true);
        $res = [];
        $sum = ['error' => 0, 'warn' => 0, 'info' => 0, 'passed' => 0];
        $got = $max = 0;
        foreach ($this->catalog() as $c) {
            try {
                $n = (int) DB::selectOne($c['count'])->n;
            } catch (\Throwable $e) {
                $res[$c['code']] = ['n' => null, 'err' => mb_substr($e->getMessage(), 0, 200)];
                continue;
            }
            $res[$c['code']] = ['n' => $n];
            $w = self::W[$c['sev']];
            $max += $w;
            if ($n === 0) { $got += $w; $sum['passed']++; } else { $sum[$c['sev']]++; }
        }
        $score = $max ? (int) round(100 * $got / $max) : 100;
        $ms = (int) round((microtime(true) - $t0) * 1000);
        $id = DB::table('admin_check_runs')->insertGetId([
            'user_id' => $r->user()->id, 'score' => $score, 'errors' => $sum['error'], 'warnings' => $sum['warn'],
            'infos' => $sum['info'], 'passed' => $sum['passed'], 'duration_ms' => $ms,
            'results' => json_encode($res), 'created_at' => now(),
        ]);
        try {
            AdminNotifier::push($r->user()->id, 'system', "Kiểm tra dữ liệu xong: $score/100",
                "{$sum['error']} lỗi nghiêm trọng, {$sum['warn']} cảnh báo, {$sum['passed']} mục đạt.",
                $sum['error'] ? 'danger' : ($sum['warn'] ? 'warning' : 'success'));
        } catch (\Throwable $e) { /* bỏ qua */ }
        return response()->json([
            'run' => ['id' => $id, 'score' => $score, 'errors' => $sum['error'], 'warnings' => $sum['warn'],
                'infos' => $sum['info'], 'passed' => $sum['passed'], 'duration_ms' => $ms, 'created_at' => now()],
            'results' => $res, 'history' => $this->history(),
        ]);
    }

    public function detail(Request $r, string $code)
    {
        $this->guard($r);
        $c = $this->catalog()[$code] ?? null;
        abort_unless($c, 404, 'Không có mục kiểm tra này.');
        return response()->json(['rows' => DB::select($c['sample']), 'limit' => 30]);
    }
}
