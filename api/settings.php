<?php
function handleSettings(PDO $db, string $action, array $input, int $userId, int $branchId): void {
    switch ($action) {
        case 'settings.get':
            $row = $db->query("SELECT k,v FROM kv_store WHERE k IN ('clinicName','clinicTheme','defaultCountryCode','settings')")->fetchAll();
            $result = [];
            foreach ($row as $r) $result[$r['k']] = json_decode($r['v'], true);
            jsonOk(['settings' => $result]);

        case 'settings.save':
            requirePerm($db, $userId, 'settings.clinic', $branchId);
            foreach (['clinicName','clinicTheme','defaultCountryCode','settings'] as $k) {
                if (isset($input[$k])) {
                    $db->prepare("INSERT INTO kv_store(k,v) VALUES(?,?) ON DUPLICATE KEY UPDATE v=VALUES(v),version=version+1")
                       ->execute([$k, json_encode($input[$k], JSON_UNESCAPED_UNICODE)]);
                }
            }
            jsonOk();

        case 'settings.specializations':
            if ($_SERVER['REQUEST_METHOD'] === 'GET' || ($input['action2'] ?? '') === 'list') {
                $q = $db->query("SELECT * FROM specializations WHERE active=1 ORDER BY name");
                jsonOk(['specializations' => $q->fetchAll()]);
            }
            requirePerm($db, $userId, 'settings.specializations', $branchId);
            $id   = (int)($input['id'] ?? 0);
            $name = sanitize($input['name'] ?? '', 200);
            if (!$name) jsonErr('الاسم مطلوب');
            if ($id) {
                $db->prepare("UPDATE specializations SET name=?,body_chart_folder=? WHERE id=?")
                   ->execute([$name, sanitize($input['body_chart_folder']??'',300), $id]);
            } else {
                $db->prepare("INSERT INTO specializations (name,body_chart_folder) VALUES(?,?)")
                   ->execute([$name, sanitize($input['body_chart_folder']??'',300)]);
                $id = (int)$db->lastInsertId();
            }
            jsonOk(['id' => $id]);

        case 'settings.patient_sources':
            if (!isset($input['name'])) {
                $q = $db->prepare("SELECT * FROM patient_sources WHERE branch_id=0 OR branch_id=? ORDER BY name");
                $q->execute([$branchId]);
                jsonOk(['sources' => $q->fetchAll()]);
            }
            $name = sanitize($input['name'] ?? '', 200);
            $perm = (int)($input['is_permanent'] ?? 1);
            $db->prepare("INSERT INTO patient_sources (name,branch_id,is_permanent,created_by) VALUES(?,?,?,?)")
               ->execute([$name, $perm ? 0 : $branchId, $perm, $userId]);
            jsonOk(['id' => (int)$db->lastInsertId()]);

        case 'settings.country_codes':
            $q = $db->query("SELECT * FROM country_codes ORDER BY name");
            jsonOk(['country_codes' => $q->fetchAll()]);
    }
}
