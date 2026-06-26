<?php
function handlePrescriptions(PDO $db, string $action, array $input, int $userId, int $branchId): void {
    switch ($action) {
        case 'prescription.get_template':
            $q = $db->prepare("SELECT * FROM prescription_templates WHERE doctor_id=? AND branch_id=? LIMIT 1");
            $q->execute([$userId, $branchId]);
            $tpl = $q->fetch();
            if ($tpl) $tpl['elements'] = json_decode($tpl['elements'], true);
            jsonOk(['template' => $tpl ?: null]);

        case 'prescription.save_template':
            requirePerm($db, $userId, 'settings.prescription', $branchId);
            $elements = $input['elements'] ?? [];
            $existing = $db->prepare("SELECT id FROM prescription_templates WHERE doctor_id=? AND branch_id=?");
            $existing->execute([$userId, $branchId]);
            $id = $existing->fetchColumn();
            $data = [
                'doctor_id'    => $userId,
                'branch_id'    => $branchId,
                'paper_width'  => (int)($input['paper_width']  ?? 210),
                'paper_height' => (int)($input['paper_height'] ?? 297),
                'elements'     => json_encode($elements, JSON_UNESCAPED_UNICODE),
            ];
            if ($id) {
                $sets = implode(',', array_map(fn($k) => "$k=:$k", array_keys($data)));
                $data['id'] = $id;
                $db->prepare("UPDATE prescription_templates SET $sets,updated_at=NOW() WHERE id=:id")->execute($data);
            } else {
                $cols = implode(',', array_keys($data));
                $vals = ':' . implode(',:', array_keys($data));
                $db->prepare("INSERT INTO prescription_templates ($cols) VALUES ($vals)")->execute($data);
                $id = (int)$db->lastInsertId();
            }
            jsonOk(['id' => $id]);

        case 'prescription.print':
            // تسجيل في print_log
            $recordId  = (int)($input['record_id']  ?? 0);
            $patientId = (int)($input['patient_id'] ?? 0);
            $db->prepare("INSERT INTO print_log (type,ref_id,patient_id,branch_id,printed_by) VALUES('prescription',?,?,?,?)")
               ->execute([$recordId, $patientId, $branchId, $userId]);
            jsonOk();
    }
}
