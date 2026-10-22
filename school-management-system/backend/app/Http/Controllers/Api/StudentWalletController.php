<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class StudentWalletController extends Controller
{
    private function studentCode(Request $request): ?string
    {
        $acc = $request->attributes->get('sm_account');
        if ($acc && !empty($acc['username'])) {
            return (string) $acc['username'];
        }
        return null;
    }

    private function ensureWallet(string $code): void
    {
        $exists = DB::table('sm_wallets')->where('student_code', $code)->exists();
        if (!$exists) {
            DB::table('sm_wallets')->insert([
                'student_code' => $code,
                'balance' => 0,
                'updated_at' => now(),
            ]);
        }
    }

    private function money(int $n): string
    {
        return number_format($n, 0, ',', '.') . ' đ';
    }

    /** GET /api/hs/wallet/balance */
    public function balance(Request $request)
    {
        $code = $this->studentCode($request);
        if (!$code) {
            return response()->json(['message' => 'Chưa đăng nhập'], 401);
        }
        $this->ensureWallet($code);
        $bal = (int) DB::table('sm_wallets')->where('student_code', $code)->value('balance');

        return response()->json([
            'data' => [
                'student_code' => $code,
                'balance' => $bal,
                'balance_label' => $this->money($bal),
            ],
        ]);
    }

    /** GET /api/hs/wallet/transactions */
    public function transactions(Request $request)
    {
        $code = $this->studentCode($request);
        if (!$code) {
            return response()->json(['message' => 'Chưa đăng nhập'], 401);
        }

        $rows = DB::table('sm_wallet_tx')
            ->where('student_code', $code)
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(function ($r) {
                return [
                    'id' => $r->id,
                    'type' => $r->type,
                    'title' => $r->title,
                    'amount' => (int) $r->amount,
                    'amount_label' => ($r->amount >= 0 ? '+' : '−') . $this->money((int) abs($r->amount)),
                    'method' => $r->method,
                    'status' => $r->status,
                    'time' => $r->created_at,
                ];
            });

        return response()->json(['data' => $rows]);
    }

    /**
     * POST /api/hs/wallet/topup
     * body: { amount: number, method: "momo"|"vnpay", return_url?: string }
     */
    public function topup(Request $request)
    {
        $code = $this->studentCode($request);
        if (!$code) {
            return response()->json(['message' => 'Chưa đăng nhập'], 401);
        }

        $amount = (int) $request->input('amount', 0);
        $method = strtolower(trim((string) $request->input('method', 'momo')));
        $returnUrl = trim((string) $request->input('return_url', env('MOMO_REDIRECT_URL', 'http://localhost:3000/student/fees/wallet')));

        if ($amount < 10000) {
            return response()->json(['message' => 'Số tiền nạp tối thiểu 10.000 đ'], 422);
        }
        if ($amount > 50000000) {
            return response()->json(['message' => 'Số tiền nạp tối đa 50.000.000 đ'], 422);
        }
        if (!in_array($method, ['momo', 'vnpay'], true)) {
            return response()->json(['message' => 'Phương thức không hỗ trợ'], 422);
        }

        $this->ensureWallet($code);

        $orderId = 'WL' . $code . '_' . time() . '_' . Str::upper(Str::random(4));

        DB::table('sm_wallet_tx')->insert([
            'student_code' => $code,
            'type' => 'topup',
            'amount' => $amount,
            'method' => $method,
            'status' => 'pending',
            'gateway_ref' => $orderId,
            'title' => 'Nạp ví qua ' . ($method === 'momo' ? 'MoMo' : 'VNPay'),
            'created_at' => now(),
        ]);

        if ($method === 'momo') {
            $payUrl = $this->createMomoPayment($orderId, $amount, $returnUrl, $code);
        } else {
            $payUrl = $this->createVnpayPayment($orderId, $amount, $code);
        }

        if (!$payUrl) {
            // Không cấu hình sandbox → demo: cộng tiền luôn (chỉ local)
            if (env('APP_ENV') === 'local' && env('WALLET_DEMO_TOPUP', true)) {
                $this->creditWallet($code, $amount, $orderId);
                return response()->json([
                    'message' => 'Demo local: đã cộng tiền (chưa cấu hình MoMo/VNPay).',
                    'data' => [
                        'demo' => true,
                        'order_id' => $orderId,
                        'amount' => $amount,
                        'pay_url' => null,
                    ],
                ]);
            }

            return response()->json(['message' => 'Không tạo được phiên thanh toán. Kiểm tra cấu hình sandbox.'], 500);
        }

        return response()->json([
            'data' => [
                'order_id' => $orderId,
                'amount' => $amount,
                'method' => $method,
                'pay_url' => $payUrl,
            ],
        ]);
    }

    // ----------------- MoMo Sandbox -----------------

    private function createMomoPayment(string $orderId, int $amount, string $redirectUrl, string $code): ?string
    {
        $partnerCode = env('MOMO_PARTNER_CODE');
        $accessKey   = env('MOMO_ACCESS_KEY');
        $secretKey   = env('MOMO_SECRET_KEY');
        $endpoint    = env('MOMO_ENDPOINT', 'https://test-payment.momo.vn/v2/gateway/api/create');
        $ipnUrl      = env('MOMO_IPN_URL', env('APP_URL') . '/api/hs/wallet/momo/ipn');

        if (!$partnerCode || !$accessKey || !$secretKey) {
            Log::warning('MoMo: thiếu cấu hình .env');
            return null;
        }

        // redirectUrl lấy từ .env (ổn định), không lấy từ body frontend
        $redirectUrl = env('MOMO_REDIRECT_URL', $redirectUrl);

        $requestId   = (string) $orderId;
        $orderInfo   = 'Nap vi hoc phi ' . $code;
        $extraData   = '';
        $requestType = 'payWithATM'; // Form nhập thẻ ATM (như ảnh)

        $raw = 'accessKey=' . $accessKey
            . '&amount=' . $amount
            . '&extraData=' . $extraData
            . '&ipnUrl=' . $ipnUrl
            . '&orderId=' . $orderId
            . '&orderInfo=' . $orderInfo
            . '&partnerCode=' . $partnerCode
            . '&redirectUrl=' . $redirectUrl
            . '&requestId=' . $requestId
            . '&requestType=' . $requestType;

        $signature = hash_hmac('sha256', $raw, $secretKey);

        // Không gửi accessKey trong body (chỉ dùng ký)
        $payload = [
            'partnerCode' => $partnerCode,
            'partnerName' => 'THPT Wallet',
            'storeId'     => 'THPT_Store',
            'requestId'   => $requestId,
            'amount'      => $amount,
            'orderId'     => $orderId,
            'orderInfo'   => $orderInfo,
            'redirectUrl' => $redirectUrl,
            'ipnUrl'      => $ipnUrl,
            'lang'        => 'vi',
            'extraData'   => $extraData,
            'requestType' => $requestType,
            'signature'   => $signature,
        ];

        try {
            $res = Http::timeout(30)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post($endpoint, $payload);

            $json = $res->json();
            Log::info('MoMo create', ['status' => $res->status(), 'res' => $json, 'raw' => $raw]);

            if ((int) ($json['resultCode'] ?? -1) === 0 && !empty($json['payUrl'])) {
                return $json['payUrl'];
            }

            Log::error('MoMo create failed', ['res' => $json]);
        } catch (\Throwable $e) {
            Log::error('MoMo create error: ' . $e->getMessage());
        }

        return null;
    }

    /** POST /api/hs/wallet/momo/ipn */
    public function momoIpn(Request $request)
    {
        $data = $request->all();
        Log::info('MoMo IPN', $data);

        $secretKey = env('MOMO_SECRET_KEY');
        $accessKey = env('MOMO_ACCESS_KEY');

        // Verify chữ ký (rút gọn theo tài liệu MoMo)
        $orderId = (string) ($data['orderId'] ?? '');
        $resultCode = (int) ($data['resultCode'] ?? -1);
        $amount = (int) ($data['amount'] ?? 0);

        if ($orderId === '') {
            return response()->json(['message' => 'invalid'], 400);
        }

        $tx = DB::table('sm_wallet_tx')->where('gateway_ref', $orderId)->first();
        if (!$tx) {
            return response()->json(['message' => 'order not found'], 404);
        }

        if ($tx->status === 'success') {
            return response()->json(['message' => 'already']);
        }

        if ($resultCode === 0) {
            $this->creditWallet($tx->student_code, $amount > 0 ? $amount : (int) $tx->amount, $orderId);
            return response()->json(['message' => 'ok']);
        }

        DB::table('sm_wallet_tx')->where('gateway_ref', $orderId)->update(['status' => 'failed']);
        return response()->json(['message' => 'failed']);
    }

    // ----------------- VNPay Sandbox -----------------

    private function createVnpayPayment(string $orderId, int $amount, string $code): ?string
    {
        date_default_timezone_set('Asia/Ho_Chi_Minh');

        $tmn = env('VNP_TMN_CODE');
        $hashSecret = env('VNP_HASH_SECRET');
        $vnpUrl = env('VNP_URL', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html');
        $returnUrl = env('VNP_RETURN_URL', env('APP_URL') . '/api/hs/wallet/vnpay/return');

        if (!$tmn || !$hashSecret) {
            Log::warning('VNPay: thiếu cấu hình .env');
            return null;
        }

        $ip = request()->ip() ?: '127.0.0.1';
        $createDate = date('YmdHis');
        $expireDate = date('YmdHis', strtotime('+2 hours'));

        $input = [
            'vnp_Version' => '2.1.0',
            'vnp_TmnCode' => $tmn,
            'vnp_Amount' => $amount * 100,
            'vnp_Command' => 'pay',
            'vnp_CreateDate' => $createDate,
            'vnp_CurrCode' => 'VND',
            'vnp_IpAddr' => $ip,
            'vnp_Locale' => 'vn',
            'vnp_OrderInfo' => 'Nap vi hoc phi ' . $code,
            'vnp_OrderType' => 'other',
            'vnp_ReturnUrl' => $returnUrl,
            'vnp_TxnRef' => $orderId,
            'vnp_ExpireDate' => $expireDate,
        ];

        ksort($input);
        $hashData = [];
        $query = [];
        foreach ($input as $k => $v) {
            $hashData[] = urlencode($k) . '=' . urlencode($v);
            $query[] = urlencode($k) . '=' . urlencode($v);
        }
        $secureHash = hash_hmac('sha512', implode('&', $hashData), $hashSecret);

        return $vnpUrl . '?' . implode('&', $query) . '&vnp_SecureHash=' . $secureHash;
    }

    /** GET /api/hs/wallet/vnpay/return */
    public function vnpayReturn(Request $request)
    {
        $data = $request->all();
        $frontend = env('VNP_FRONTEND_RETURN', 'http://localhost:3000/student/fees/wallet');

        $hashSecret = env('VNP_HASH_SECRET');
        $secureHash = $data['vnp_SecureHash'] ?? '';
        unset($data['vnp_SecureHash'], $data['vnp_SecureHashType']);

        ksort($data);
        $hashData = [];
        foreach ($data as $k => $v) {
            if ($v !== '' && $v !== null) {
                $hashData[] = urlencode($k) . '=' . urlencode($v);
            }
        }
        $check = hash_hmac('sha512', implode('&', $hashData), $hashSecret);

        $orderId = (string) ($request->query('vnp_TxnRef', ''));
        $respCode = (string) ($request->query('vnp_ResponseCode', ''));
        $amount = (int) round(((int) $request->query('vnp_Amount', 0)) / 100);

        $ok = hash_equals($check, $secureHash) && $respCode === '00';

        if ($ok && $orderId !== '') {
            $tx = DB::table('sm_wallet_tx')->where('gateway_ref', $orderId)->first();
            if ($tx && $tx->status !== 'success') {
                $this->creditWallet($tx->student_code, $amount > 0 ? $amount : (int) $tx->amount, $orderId);
            }
            return redirect($frontend . '?pay=success&order=' . urlencode($orderId));
        }

        if ($orderId !== '') {
            DB::table('sm_wallet_tx')->where('gateway_ref', $orderId)->where('status', 'pending')->update(['status' => 'failed']);
        }

        return redirect($frontend . '?pay=failed');
    }

    // ----------------- Cộng tiền ví -----------------

    private function creditWallet(string $code, int $amount, string $orderId): void
    {
        if ($amount <= 0) {
            return;
        }

        DB::transaction(function () use ($code, $amount, $orderId) {
            $this->ensureWallet($code);

            $tx = DB::table('sm_wallet_tx')->where('gateway_ref', $orderId)->lockForUpdate()->first();
            if (!$tx || $tx->status === 'success') {
                return;
            }

            DB::table('sm_wallets')->where('student_code', $code)->update([
                'balance' => DB::raw('balance + ' . (int) $amount),
                'updated_at' => now(),
            ]);

            DB::table('sm_wallet_tx')->where('gateway_ref', $orderId)->update([
                'status' => 'success',
                'amount' => $amount,
            ]);
        });
    }
}
