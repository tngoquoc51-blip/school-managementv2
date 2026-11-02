<?php
// Chạy: php tests/Unit/SystemLogSupportTest.php   (không cần Laravel)
require __DIR__ . '/../../app/Support/SystemLog/Sanitizer.php';
require __DIR__ . '/../../app/Support/SystemLog/Diff.php';
require __DIR__ . '/../../app/Support/SystemLog/Anomaly.php';
require __DIR__ . '/../../app/Support/SystemLog/Health.php';

use App\Support\SystemLog\{Sanitizer, Diff, Anomaly, Health};

$fail = 0; $n = 0;
function ok(string $name, bool $cond): void { global $fail, $n; $n++; if (!$cond) { $fail++; echo "  ✗ $name\n"; } else { echo "  ✓ $name\n"; } }

echo "Sanitizer\n";
$c = Sanitizer::clean(['user' => 'an', 'password' => 'x', 'api_key' => 'k', 'nested' => ['token' => 't', 'ok' => 1], 'Authorization' => 'Bearer z']);
ok('che password', $c['password'] === '***');
ok('che api_key', $c['api_key'] === '***');
ok('che token lồng nhau', $c['nested']['token'] === '***' && $c['nested']['ok'] === 1);
ok('che Authorization (không phân biệt hoa thường)', $c['Authorization'] === '***');
ok('giữ trường thường', $c['user'] === 'an');
ok('cắt chuỗi dài', mb_strlen(Sanitizer::clean(str_repeat('á', 900))) === 501);
ok('json rỗng → null', Sanitizer::json([]) === null);
ok('json tiếng Việt không bị escape', str_contains(Sanitizer::json(['ten' => 'Nguyễn']), 'Nguyễn'));
$big = Sanitizer::json(array_fill(0, 55, str_repeat('x', 480)));
ok('json quá lớn → chỉ giữ bản xem trước', strlen($big) < 17000 && str_contains($big, '_truncated'));
ok('chặn đệ quy sâu', str_contains(json_encode(Sanitizer::clean([[[[[[[['a' => 1]]]]]]]]), JSON_UNESCAPED_UNICODE), 'quá sâu'));

echo "Diff\n";
$d = Diff::compute(['a' => 1, 'b' => 'x', 'c' => 3], ['a' => 1, 'b' => 'y', 'd' => 4]);
$by = array_column($d, 'type', 'key');
ok('b đổi', ($by['b'] ?? '') === 'changed');
ok('c bị xóa', ($by['c'] ?? '') === 'removed');
ok('d được thêm', ($by['d'] ?? '') === 'added');
ok('a không đổi thì bỏ qua', !isset($by['a']));
ok('null → mảng rỗng', Diff::compute(null, null) === []);

echo "Anomaly\n";
$now = new DateTimeImmutable('2026-10-29 14:20:00');
$mk = function (int $cur, array $base) use ($now) { $b = [$now->format('Y-m-d H') => $cur]; foreach ($base as $i => $v) { $b[$now->modify('-' . ($i + 1) . ' day')->format('Y-m-d') . ' 14'] = $v; } return $b; };
$spike = Anomaly::detect(['auth' => $mk(40, [4, 6, 5, 3, 5, 6, 4])], $now);
ok('phát hiện đột biến (40 so với ~5)', count($spike) === 1 && $spike[0]['scope'] === 'auth' && $spike[0]['z'] >= 3);
ok('không báo khi bình thường', Anomaly::detect(['auth' => $mk(6, [4, 6, 5, 3, 5, 6, 4])], $now) === []);
ok('không báo khi quá ít sự kiện (<5)', Anomaly::detect(['x' => $mk(4, [0, 0, 0, 0, 0, 0, 0])], $now) === []);
ok('phát hiện khi lịch sử toàn 0 nhưng giờ này vọt lên', count(Anomaly::detect(['x' => $mk(12, [0, 0, 0, 0, 0, 0, 0])], $now)) === 1);

echo "Health\n";
$h = Health::score(['total' => 1000, 'errors' => 0, 'critical' => 0, 'failed_logins' => 0, 'logins' => 200, 'open_warning' => 0, 'open_error' => 0, 'open_critical' => 0]);
ok('hệ thống sạch = 100 điểm, hạng A', $h['score'] === 100 && $h['grade'] === 'A' && $h['parts'] === []);
$h = Health::score(['total' => 1000, 'errors' => 50, 'critical' => 1, 'failed_logins' => 30, 'logins' => 100, 'open_warning' => 1, 'open_error' => 0, 'open_critical' => 1]);
ok('nhiều vấn đề → điểm thấp, có giải thích', $h['score'] < 60 && count($h['parts']) === 4);
ok('điểm không âm', Health::score(['total' => 10, 'errors' => 10, 'critical' => 9, 'failed_logins' => 50, 'logins' => 1, 'open_warning' => 9, 'open_error' => 9, 'open_critical' => 9])['score'] >= 0);

echo "\n$n kiểm thử, $fail lỗi\n";
exit($fail ? 1 : 0);
