<?php
function handleLedger(PDO $db, string $action, array $input, int $userId, int $branchId): void {
    switch ($action) {
        case 'ledger.patient':
            $patientId = (int)($input['patient_id']??0);
            if (!$patientId) jsonErr('patient_id مطلوب');
            $q = $db->prepare("SELECT l.*,b.name as branch_name,u.name as performed_by_name
                               FROM ledger l
                               LEFT JOIN branches b ON b.id=l.branch_id
                               LEFT JOIN users u ON u.id=l.performed_by
                               WHERE l.patient_id=? ORDER BY l.ts DESC LIMIT 100");
            $q->execute([$patientId]);
            $balance = $db->prepare("SELECT global_balance FROM patients WHERE id=?");
            $balance->execute([$patientId]);
            jsonOk(['ledger'=>$q->fetchAll(),'global_balance'=>(float)($balance->fetchColumn()?:0)]);

        case 'ledger.summary':
            requirePerm($db, $userId, 'reports.financial_daily', $branchId);
            $from=$input['from']??date('Y-m-d'); $to=$input['to']??date('Y-m-d');
            $q = $db->prepare("SELECT type,payment_method,SUM(amount) as total,COUNT(*) as count
                               FROM ledger WHERE branch_id=? AND DATE(ts) BETWEEN ? AND ?
                               GROUP BY type,payment_method ORDER BY type");
            $q->execute([$branchId,$from,$to]);
            jsonOk(['summary'=>$q->fetchAll(),'from'=>$from,'to'=>$to]);
    }
}
