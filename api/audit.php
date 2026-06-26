<?php
function handleAudit(PDO $db, string $action, array $input, int $userId, int $branchId): void {
    requirePerm($db, $userId, 'reports.audit_log', $branchId);
    $from  = $input['from']  ?? date('Y-m-d');
    $to    = $input['to']    ?? date('Y-m-d');
    $limit = min((int)($input['limit']??100), 500);
    $q = $db->prepare("SELECT * FROM audit_log WHERE branch_id=? AND DATE(created_at) BETWEEN ? AND ? ORDER BY created_at DESC LIMIT ?");
    $q->execute([$branchId,$from,$to,$limit]);
    jsonOk(['audit'=>$q->fetchAll()]);
}
