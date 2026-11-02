<?php

namespace App\Services\DataHub;

use Carbon\Carbon;
use Illuminate\Support\Str;

/** Chuẩn hóa giá trị người dùng nhập/dán (ngày dd/mm/yyyy, số điện thoại, giới tính "Nữ"…). */
class Normalizer
{
    public static function unaccent(string $s): string
    {
        return mb_strtolower(trim(preg_replace('/\s+/u', ' ', Str::ascii($s))));
    }

    /** @return array{0: mixed, 1: ?string} [giá trị đã chuẩn hóa, lỗi] */
    public function value(array $field, $raw): array
    {
        if ($raw === null) {
            return [null, null];
        }
        $v = is_string($raw) ? trim($raw) : $raw;
        if ($v === '' || $v === null) {
            return [null, null];
        }

        switch ($field['type'] ?? 'text') {
            case 'email':
                return [mb_strtolower((string) $v), null];

            case 'phone':
                $d = preg_replace('/\D+/', '', (string) $v);
                if (str_starts_with($d, '84') && strlen($d) >= 11) {
                    $d = '0' . substr($d, 2);
                } elseif (strlen($d) === 9) {
                    $d = '0' . $d;
                }
                if (strlen($d) < 10 || strlen($d) > 11) {
                    return [null, 'số điện thoại không hợp lệ (cần 10–11 chữ số)'];
                }
                return [$d, null];

            case 'date':
                return $this->date((string) $v);

            case 'number':
                $n = $this->number((string) $v);
                return $n === null ? [null, 'phải là số'] : [$n, null];

            case 'checkbox':
                $t = self::unaccent((string) $v);
                if (in_array($t, ['1', 'true', 'yes', 'co', 'x', 'y', 'dang cong tac', 'dang giang day', 'dang su dung', 'hien hanh', 'active'], true)) {
                    return [1, null];
                }
                if (in_array($t, ['0', 'false', 'no', 'khong', 'n', 'nghi', 'ngung', 'inactive'], true)) {
                    return [0, null];
                }
                return [null, 'chỉ nhận Có/Không (hoặc 1/0)'];

            case 'select':
                $t = self::unaccent((string) $v);
                if (! empty($field['map'])) {
                    if (isset($field['map'][$t])) {
                        return [$field['map'][$t], null];
                    }
                    return [null, "giá trị '{$v}' không nằm trong danh sách cho phép"];
                }
                return [$t, null];

            default:
                return [is_string($v) ? preg_replace('/\s+/u', ' ', $v) : $v, null];
        }
    }

    private function date(string $v): array
    {
        // số serial của Excel (ví dụ 38412)
        if (preg_match('/^\d{5}$/', $v)) {
            return [Carbon::create(1899, 12, 30)->addDays((int) $v)->toDateString(), null];
        }
        foreach (['Y-m-d', 'd/m/Y', 'j/n/Y', 'd-m-Y', 'j-n-Y', 'd.m.Y', 'Y/m/d', 'd/m/y'] as $fmt) {
            try {
                $c = Carbon::createFromFormat('!' . $fmt, $v);
                if ($c && $c->format($fmt) === $v || ($c && $c->year > 1900)) {
                    if ($c->year < 100) {
                        $c->year += $c->year > 30 ? 1900 : 2000;
                    }
                    return [$c->toDateString(), null];
                }
            } catch (\Throwable $e) {
                // thử định dạng tiếp theo
            }
        }
        return [null, "ngày '{$v}' không hợp lệ (dùng dd/mm/yyyy hoặc yyyy-mm-dd)"];
    }

    private function number(string $v)
    {
        $s = str_replace([' ', "\u{00A0}"], '', $v);
        if (preg_match('/^\d{1,3}(\.\d{3})+$/', $s)) {      // 1.320.000
            $s = str_replace('.', '', $s);
        } elseif (preg_match('/^\d{1,3}(,\d{3})+$/', $s)) { // 1,320,000
            $s = str_replace(',', '', $s);
        } else {
            $s = str_replace(',', '.', $s);                 // 7,5 → 7.5
        }
        return is_numeric($s) ? $s + 0 : null;
    }
}
