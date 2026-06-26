<?php
// sync.php v8 — للإعدادات فقط (kv_store)
// البيانات الكبيرة لها endpoints منفصلة
function handleSync(PDO $db, array $input, int $userId, int $branchId, string $deviceId): void {
    $clientData = $input['data'] ?? [];
    $SETTINGS_KEYS = ['clinicName','clinicTheme','defaultCountryCode','settings'];

    $db->beginTransaction();
    try {
        $result = [];
        foreach ($SETTINGS_KEYS as $k) {
            $row = $db->prepare("SELECT v FROM kv_store WHERE k=?");
            $row->execute([$k]); $r = $row->fetch();
            $sv = $r ? json_decode($r['v'], true) : null;
            if (array_key_exists($k, $clientData)) {
                $db->prepare("INSERT INTO kv_store(k,v,updated_at) VALUES(?,?,NOW()) ON DUPLICATE KEY UPDATE v=VALUES(v),updated_at=NOW(),version=version+1")
                   ->execute([$k, json_encode($clientData[$k], JSON_UNESCAPED_UNICODE)]);
                $result[$k] = $clientData[$k];
            } else {
                $result[$k] = $sv;
            }
        }
        $db->commit();
    } catch (Exception $e) { $db->rollBack(); throw $e; }

    $db->exec("DELETE FROM user_presence WHERE last_seen<DATE_SUB(NOW(),INTERVAL 15 SECOND)");
    $online = $db->query("SELECT user_id as id,user_name as name,role,branch_id FROM user_presence")->fetchAll();

    $released = $db->prepare("SELECT lock_type,lock_id,label FROM lock_releases WHERE released_at>DATE_SUB(NOW(),INTERVAL 10 SECOND) AND released_by!=?");
    $released->execute([$deviceId]);

    jsonOk([
        'data'           => $result,
        'server_time'    => date('c'),
        'online_users'   => $online,
        'released_locks' => array_map(fn($r) => ['type'=>$r['lock_type'],'id'=>(int)$r['lock_id'],'label'=>$r['label']], $released->fetchAll()),
    ]);
}
