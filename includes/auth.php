<?php
require_once __DIR__ . '/db.php';

$allowedOrigin = $_ENV['ALLOWED_ORIGIN'] ?? '*';
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . ($allowedOrigin === '*' ? '*' : $origin));
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Clinic-Key, X-Branch-Id, X-User-Id');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

define('API_KEY', $_ENV['API_KEY'] ?? '');

function getApiKey(): string {
    foreach (getallheaders() as $n => $v)
        if (strtolower($n) === 'x-clinic-key') return $v;
    return $_GET['_key'] ?? ($GLOBALS['input']['_key'] ?? '');
}

function checkRateLimit(string $ip, int $limit = 60): bool {
    if (!function_exists('apcu_fetch')) return true;
    $key = "rl:$ip:" . floor(time() / 60);
    $count = apcu_fetch($key) ?: 0;
    if ($count >= $limit) return false;
    apcu_store($key, $count + 1, 65);
    return true;
}

function requirePerm(PDO $db, int $userId, string $permKey, int $branchId = 0): void {
    if ($userId === 0) return;
    $r = $db->prepare("SELECT role FROM users WHERE id=? AND active=1");
    $r->execute([$userId]);
    $user = $r->fetch();
    if (!$user) { http_response_code(403); echo json_encode(['error' => 'مستخدم غير موجود']); exit; }
    if (in_array($user['role'], ['super_admin', 'admin'])) return;
    $stmt = $db->prepare("SELECT 1 FROM user_permissions
                          WHERE user_id=? AND perm_key=?
                          AND (branch_id=0 OR branch_id=?) LIMIT 1");
    $stmt->execute([$userId, $permKey, $branchId]);
    if (!$stmt->fetch()) {
        http_response_code(403);
        echo json_encode(['error' => "ليس لديك صلاحية: $permKey"]); exit;
    }
}

function sanitize(?string $v, int $max = 200): string {
    return mb_substr(trim($v ?? ''), 0, $max);
}

function jsonOk(array $data = []): void {
    echo json_encode(array_merge(['ok' => true], $data), JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonErr(string $msg, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

// ── Validate Request ──────────────────────────────────────────────
$input    = json_decode(file_get_contents('php://input'), true) ?? [];
$clientIP = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

if (!checkRateLimit($clientIP, (int)($_ENV['RATE_LIMIT_PER_MINUTE'] ?? 60)))
    jsonErr('Too many requests', 429);

$apiKey = getApiKey() ?: ($input['_key'] ?? '');
if (!API_KEY || $apiKey !== API_KEY) jsonErr('Unauthorized', 401);

$branchId  = (int)($_SERVER['HTTP_X_BRANCH_ID']  ?? $input['branch_id']  ?? 1);
$userId    = (int)($_SERVER['HTTP_X_USER_ID']    ?? $input['user_id']    ?? 0);
$deviceId  = sanitize($input['device_id'] ?? 'unknown', 100);
$action    = sanitize($_GET['action'] ?? $input['action'] ?? '', 50);
