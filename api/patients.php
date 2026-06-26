<?php
// ================================================================
//  patients.php v8 — CRUD المرضى (global across branches)
// ================================================================

function handlePatients(PDO $db, string $action, array $input,
                         int $userId, int $branchId): void {
    switch ($action) {

        case 'patients.list':
            requirePerm($db, $userId, 'patients.create', $branchId);
            $limit  = min((int)($input['limit'] ?? 50), 200);
            $offset = (int)($input['offset'] ?? 0);
            $q = $db->prepare("SELECT id,code,name,phone,gender,global_balance,
                                      total_visits,registered_at
                               FROM patients WHERE active=1
                               ORDER BY registered_at DESC
                               LIMIT ? OFFSET ?");
            $q->execute([$limit, $offset]);
            $total = $db->query("SELECT COUNT(*) FROM patients WHERE active=1")->fetchColumn();
            jsonOk(['patients' => $q->fetchAll(), 'total' => (int)$total]);

        case 'patients.search':
            $term = sanitize($input['q'] ?? '', 100);
            if (!$term) jsonOk(['patients' => []]);
            $like = "%$term%";
            $q = $db->prepare("SELECT id,code,name,phone,gender,global_balance,total_visits
                               FROM patients
                               WHERE active=1 AND (name LIKE ? OR phone LIKE ? OR code LIKE ? OR national_id LIKE ?)
                               ORDER BY name LIMIT 30");
            $q->execute([$like, $like, $like, $like]);
            jsonOk(['patients' => $q->fetchAll()]);

        case 'patients.get':
            $id = (int)($input['id'] ?? 0);
            if (!$id) jsonErr('id مطلوب');
            $p = $db->prepare("SELECT p.*,
                                      ps.name as source_name,
                                      b.name as source_branch_name
                               FROM patients p
                               LEFT JOIN patient_sources ps ON ps.id=p.source_id
                               LEFT JOIN branches b ON b.id=p.source_branch_id
                               WHERE p.id=?");
            $p->execute([$id]);
            $patient = $p->fetch();
            if (!$patient) jsonErr('المريض غير موجود', 404);

            // آخر 10 مواعيد (من كل الفروع)
            $appts = $db->prepare("SELECT a.id,a.appointment_at,a.status,
                                          a.total_price,a.total_paid,
                                          u.name as doctor_name,
                                          b.name as branch_name
                                   FROM appointments a
                                   LEFT JOIN users u ON u.id=a.doctor_id
                                   LEFT JOIN branches b ON b.id=a.branch_id
                                   WHERE a.patient_id=?
                                   ORDER BY a.appointment_at DESC LIMIT 10");
            $appts->execute([$id]);

            // رصيد per-branch (من ledger)
            $balances = $db->prepare("SELECT branch_id,
                                             SUM(CASE WHEN type IN ('payment','partial_payment','package_payment') THEN amount ELSE 0 END) as paid,
                                             SUM(CASE WHEN type IN ('refund','partial_refund','package_refund') THEN amount ELSE 0 END) as refunded
                                      FROM ledger WHERE patient_id=? GROUP BY branch_id");
            $balances->execute([$id]);

            jsonOk([
                'patient'      => $patient,
                'appointments' => $appts->fetchAll(),
                'branch_balances' => $balances->fetchAll(),
            ]);

        case 'patients.save':
            requirePerm($db, $userId, 'patients.create', $branchId);
            $id   = (int)($input['id'] ?? 0);
            $name = sanitize($input['name'] ?? '', 200);
            if (!$name) jsonErr('اسم المريض مطلوب');

            $data = [
                'name'         => $name,
                'phone'        => sanitize($input['phone'] ?? '', 30),
                'phone_country'=> sanitize($input['phone_country'] ?? '', 10),
                'phone2'       => sanitize($input['phone2'] ?? '', 30),
                'national_id'  => sanitize($input['national_id'] ?? '', 30),
                'date_of_birth'=> $input['date_of_birth'] ?? null,
                'gender'       => in_array($input['gender'] ?? '', ['male','female','other'])
                                    ? $input['gender'] : 'other',
                'address'      => sanitize($input['address'] ?? '', 500),
                'source_id'    => (int)($input['source_id'] ?? 0),
                'notes'        => sanitize($input['notes'] ?? '', 1000),
            ];

            if ($id) {
                requirePerm($db, $userId, 'patients.edit', $branchId);
                $sets = implode(',', array_map(fn($k) => "$k=:$k", array_keys($data)));
                $stmt = $db->prepare("UPDATE patients SET $sets, updated_at=NOW() WHERE id=:id");
                $data['id'] = $id;
                $stmt->execute($data);
                logAudit($db, 'patient.update', 'patient', $id, $userId, $branchId);
                jsonOk(['id' => $id]);
            } else {
                // توليد كود المريض: B{branch_id}-{4digits}
                $count = (int)$db->prepare("SELECT COUNT(*)+1 FROM patients")
                                  ->execute([]) ?: 1;
                $db->prepare("SELECT COUNT(*)+1 FROM patients")->execute([]);
                $countRow = $db->query("SELECT COUNT(*)+1 as c FROM patients")->fetchColumn();
                $code = 'B' . $branchId . '-' . str_pad($countRow, 4, '0', STR_PAD_LEFT);

                $data['code']             = $code;
                $data['source_branch_id'] = $branchId;
                $data['created_by']       = $userId;

                $cols = implode(',', array_keys($data));
                $vals = ':' . implode(',:', array_keys($data));
                $db->prepare("INSERT INTO patients ($cols) VALUES ($vals)")->execute($data);
                $newId = (int)$db->lastInsertId();
                logAudit($db, 'patient.create', 'patient', $newId, $userId, $branchId);
                jsonOk(['id' => $newId, 'code' => $code]);
            }

        case 'patients.delete':
            requirePerm($db, $userId, 'patients.delete', $branchId);
            $id = (int)($input['id'] ?? 0);
            if (!$id) jsonErr('id مطلوب');
            // soft delete
            $db->prepare("UPDATE patients SET active=0, updated_at=NOW() WHERE id=?")
               ->execute([$id]);
            logAudit($db, 'patient.delete', 'patient', $id, $userId, $branchId);
            jsonOk();

        default:
            jsonErr('unknown patients action');
    }
}

function logAudit(PDO $db, string $action, string $entityType, int $entityId,
                  int $userId, int $branchId, string $detail = ''): void {
    $name = '';
    if ($userId) {
        $r = $db->prepare("SELECT name FROM users WHERE id=?");
        $r->execute([$userId]);
        $name = $r->fetchColumn() ?: '';
    }
    $db->prepare("INSERT INTO audit_log(action,entity_type,entity_id,detail,
                  performed_by,performed_by_name,branch_id,ip_address)
                  VALUES(?,?,?,?,?,?,?,?)")
       ->execute([$action, $entityType, $entityId, $detail,
                  $userId, $name, $branchId,
                  $_SERVER['REMOTE_ADDR'] ?? '']);
}
