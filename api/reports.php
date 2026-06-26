<?php
function handleReports(PDO $db, string $action, array $input, int $userId, int $branchId): void {
    switch ($action) {
        case 'reports.daily':
            requirePerm($db, $userId, 'reports.financial_daily', $branchId);
            $date = $input['date'] ?? date('Y-m-d');
            $allBranches = ($input['all_branches'] ?? false) && !$branchId;
            $bWhere = $allBranches ? '1=1' : "branch_id=$branchId";

            $revenue = $db->prepare("SELECT COALESCE(SUM(amount),0) FROM ledger
                                     WHERE DATE(ts)=? AND $bWhere
                                     AND type IN ('payment','partial_payment','package_payment')");
            $revenue->execute([$date]);

            $refunds = $db->prepare("SELECT COALESCE(SUM(amount),0) FROM ledger
                                     WHERE DATE(ts)=? AND $bWhere AND type LIKE '%refund%'");
            $refunds->execute([$date]);

            $expenses = $db->prepare("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE DATE(ts)=? AND $bWhere");
            $expenses->execute([$date]);

            $appointments = $db->prepare("SELECT status, COUNT(*) as cnt FROM appointments
                                          WHERE DATE(appointment_at)=? AND $bWhere GROUP BY status");
            $appointments->execute([$date]);

            $byMethod = $db->prepare("SELECT payment_method, COALESCE(SUM(amount),0) as total
                                      FROM ledger WHERE DATE(ts)=? AND $bWhere
                                      AND type IN ('payment','partial_payment','package_payment')
                                      GROUP BY payment_method");
            $byMethod->execute([$date]);

            $rev = (float)$revenue->fetchColumn();
            $ref = (float)$refunds->fetchColumn();
            $exp = (float)$expenses->fetchColumn();
            jsonOk([
                'date'          => $date,
                'revenue'       => $rev,
                'refunds'       => $ref,
                'expenses'      => $exp,
                'net'           => $rev - $ref - $exp,
                'appointments'  => $appointments->fetchAll(),
                'by_method'     => $byMethod->fetchAll(),
            ]);

        case 'reports.doctor_commission':
            requirePerm($db, $userId, 'reports.doctor_commission', $branchId);
            $from = $input['from'] ?? date('Y-m-01');
            $to   = $input['to']   ?? date('Y-m-d');
            $q = $db->prepare("SELECT u.name as doctor_name,
                                      SUM(dc.gross_amount) as gross,
                                      SUM(dc.consumables_cost) as consumables,
                                      SUM(dc.net_amount) as net,
                                      SUM(dc.commission_amount) as commission,
                                      dc.type
                               FROM doctor_commissions dc
                               LEFT JOIN users u ON u.id=dc.doctor_id
                               WHERE dc.branch_id=? AND DATE(dc.created_at) BETWEEN ? AND ?
                               GROUP BY dc.doctor_id, dc.type
                               ORDER BY u.name");
            $q->execute([$branchId, $from, $to]);
            jsonOk(['commissions' => $q->fetchAll(), 'from' => $from, 'to' => $to]);

        case 'reports.patient_source':
            requirePerm($db, $userId, 'reports.patient_source', $branchId);
            $from = $input['from'] ?? date('Y-m-01');
            $to   = $input['to']   ?? date('Y-m-d');
            $q = $db->prepare("SELECT ps.name as source, COUNT(p.id) as count
                               FROM patients p
                               LEFT JOIN patient_sources ps ON ps.id=p.source_id
                               WHERE DATE(p.registered_at) BETWEEN ? AND ?
                               AND (p.source_branch_id=? OR ?=0)
                               GROUP BY p.source_id ORDER BY count DESC");
            $q->execute([$from, $to, $branchId, $branchId]);
            jsonOk(['sources' => $q->fetchAll()]);

        case 'treasury.summary':
            requirePerm($db, $userId, 'treasury.view', $branchId);
            $from = $input['from'] ?? date('Y-m-01');
            $to   = $input['to']   ?? date('Y-m-d');
            $allB = ($input['all_branches'] ?? false);
            $bCond = $allB ? '1=1' : "branch_id=$branchId";

            $income   = $db->prepare("SELECT COALESCE(SUM(amount),0) FROM ledger WHERE DATE(ts) BETWEEN ? AND ? AND $bCond AND type NOT LIKE '%refund%'");
            $income->execute([$from, $to]);
            $outgoing = $db->prepare("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE DATE(ts) BETWEEN ? AND ? AND $bCond");
            $outgoing->execute([$from, $to]);
            $refunds  = $db->prepare("SELECT COALESCE(SUM(amount),0) FROM ledger WHERE DATE(ts) BETWEEN ? AND ? AND $bCond AND type LIKE '%refund%'");
            $refunds->execute([$from, $to]);

            jsonOk([
                'from'     => $from, 'to' => $to,
                'income'   => (float)$income->fetchColumn(),
                'expenses' => (float)$outgoing->fetchColumn(),
                'refunds'  => (float)$refunds->fetchColumn(),
            ]);

        case 'treasury.add_expense':
            requirePerm($db, $userId, 'treasury.add_expense', $branchId);
            $amount   = (float)($input['amount'] ?? 0);
            $category = sanitize($input['category'] ?? '', 100);
            $desc     = sanitize($input['description'] ?? '', 300);
            if ($amount <= 0) jsonErr('المبلغ غير صحيح');
            $db->prepare("INSERT INTO expenses (branch_id,shift_id,category,amount,description,performed_by) VALUES(?,?,?,?,?,?)")
               ->execute([$branchId, (int)($input['shift_id']??0), $category, $amount, $desc, $userId]);
            jsonOk();
    }
}
