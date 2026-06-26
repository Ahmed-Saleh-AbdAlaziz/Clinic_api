<?php
function handleBackup(PDO $db, string $action, array $input, int $userId): void {
    $settRow  = $db->query("SELECT v FROM kv_store WHERE k='settings'")->fetch();
    $settings = $settRow ? json_decode($settRow['v'], true) : [];
    $backupDir = trim($settings['backupPath'] ?? '');

    switch ($action) {
        case 'backup':
            if (!$backupDir) jsonErr('لم يتم تحديد مسار الباكب');
            if (!is_dir($backupDir) && !mkdir($backupDir, 0755, true)) jsonErr('تعذر إنشاء المجلد');

            // جمع بيانات الإعدادات فقط (المرضى والمواعيد في DB)
            $data = ['_backupDate' => date('c'), '_version' => 'v8'];
            $rows = $db->query("SELECT k,v FROM kv_store")->fetchAll();
            foreach ($rows as $r) $data[$r['k']] = json_decode($r['v'], true);

            $filename = 'clinic_backup_' . date('Y-m-d_H-i-s') . '.json';
            $filepath = rtrim($backupDir, '/\\') . DIRECTORY_SEPARATOR . $filename;
            file_put_contents($filepath, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

            $files = glob(rtrim($backupDir, '/\\') . DIRECTORY_SEPARATOR . 'clinic_backup_*.json');
            if (count($files) > 168) { sort($files); array_splice($files, -168); foreach ($files as $f) @unlink($f); }
            jsonOk(['filename' => $filename]);

        case 'list_backups':
            if (!$backupDir || !is_dir($backupDir)) jsonOk(['files' => []]);
            $files = glob(rtrim($backupDir, '/\\') . DIRECTORY_SEPARATOR . 'clinic_backup_*.json');
            sort($files);
            jsonOk(['files' => array_map(fn($f) => ['name'=>basename($f),'size'=>filesize($f)], $files)]);

        case 'restore_backup':
            $filename  = basename($input['filename'] ?? '');
            $filepath  = rtrim($backupDir, '/\\') . DIRECTORY_SEPARATOR . $filename;
            if (realpath(dirname($filepath)) !== realpath($backupDir)) jsonErr('مسار غير مسموح');
            if (!file_exists($filepath)) jsonErr('الملف غير موجود');
            $data = json_decode(file_get_contents($filepath), true);
            if (!$data) jsonErr('ملف تالف');
            $db->beginTransaction();
            try {
                foreach ($data as $k => $v) {
                    if (str_starts_with($k, '_')) continue;
                    $db->prepare("INSERT INTO kv_store(k,v,updated_at) VALUES(?,?,NOW()) ON DUPLICATE KEY UPDATE v=VALUES(v),updated_at=NOW(),version=version+1")
                       ->execute([$k, json_encode($v, JSON_UNESCAPED_UNICODE)]);
                }
                $db->commit();
            } catch (Exception $e) { $db->rollBack(); throw $e; }
            jsonOk();
    }
}
