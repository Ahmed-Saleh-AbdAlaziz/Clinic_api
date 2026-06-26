<?php
function loadEnv(string $path = __DIR__ . '/../../.env'): void {
    if (!file_exists($path)) return;
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#')) continue;
        [$key, $value] = array_map('trim', explode('=', $line, 2) + ['', '']);
        if ($key && !isset($_ENV[$key])) { $_ENV[$key] = $value; putenv("$key=$value"); }
    }
}
loadEnv();
$isProduction = ($_ENV['APP_ENV'] ?? 'development') === 'production';
ini_set('display_errors', $isProduction ? 0 : 1);
error_reporting($isProduction ? 0 : E_ALL);

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4',
            $_ENV['DB_HOST'] ?? 'localhost', $_ENV['DB_NAME'] ?? 'clinic_db');
        $pdo = new PDO($dsn, $_ENV['DB_USER'] ?? '', $_ENV['DB_PASS'] ?? '', [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}
