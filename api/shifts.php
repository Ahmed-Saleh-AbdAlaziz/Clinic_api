<?php
function handleShifts(PDO $db, string $action, array $input, int $userId, int $branchId): void {
    switch ($action) {
        case 'shifts.open':
            requirePerm($db, $userId, 'shifts.open_close', $branchId);
            // تحقق مش فيه شيفت مفتوح
            $open = $db->prepare("SELECT id FROM shifts WHERE user_id=? AND branch_id=? AND status='open'");
            $open->execute([$userId, $branchId]);
            if ($open->fetch()) jsonErr('يوجد شيفت مفتوح بالفعل');
            $db->prepare("INSERT INTO shifts (user_id,branch_id) VALUES(?,?)")->execute([$userId, $branchId]);
            jsonOk(['shift_id' => (int)$db->lastInsertId()]);

        case 'shifts.close':
            requirePerm($db, $userId, 'shifts.open_close', $branchId);
            $shiftId = (int)($input['shift_id'] ?? 0);
            if (!$shiftId) jsonErr('shift_id مطلوب');
            // احسب الإجماليات
            $totals = $db->prepare("SELECT
                SUM(CASE WHEN type='payment' AND payment_method='cash' THEN amount ELSE 0 END) as cash,
                SUM(CASE WHEN type='payment' AND payment_method='card' THEN amount ELSE 0 END) as card,
                SUM(CASE WHEN type='payment' AND payment_method='wallet' THEN amount ELSE 0 END) as wallet,
                SUM(CASE WHEN type='refund' THEN amount ELSE 0 END) as refunds,
                COUNT(DISTINCT appointment_id) as appts
                FROM shift_transactions WHERE shift_id=?");
            $totals->execute([$shiftId]);
            $t = $totals->fetch();
            $expenses = $db->prepare("SELECT SUM(amount) FROM expenses WHERE shift_id=?")->execute([$shiftId]);
            $expTotal = $db->prepare("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE shift_id=?");
            $expTotal->execute([$shiftId]);
            $db->prepare("UPDATE shifts SET status='closed',ended_at=NOW(),
                          total_cash=?,total_card=?,total_wallet=?,
                          total_refunds=?,total_expenses=?,appointments_count=?
                          WHERE id=? AND status='open'")
               ->execute([$t['cash']??0,$t['card']??0,$t['wallet']??0,
                          $t['refunds']??0,$expTotal->fetchColumn()??0,
                          $t['appts']??0,$shiftId]);
            jsonOk();

        case 'shifts.current':
            $q = $db->prepare("SELECT * FROM shifts WHERE user_id=? AND branch_id=? AND status='open' ORDER BY started_at DESC LIMIT 1");
            $q->execute([$userId, $branchId]);
            jsonOk(['shift' => $q->fetch() ?: null]);

        case 'shifts.list':
            requirePerm($db, $userId, 'shifts.view_all', $branchId);
            $date = $input['date'] ?? date('Y-m-d');
            $q = $db->prepare("SELECT s.*, u.name as user_name FROM shifts s
                               LEFT JOIN users u ON u.id=s.user_id
                               WHERE s.branch_id=? AND DATE(s.started_at)=?
                               ORDER BY s.started_at DESC");
            $q->execute([$branchId, $date]);
            jsonOk(['shifts' => $q->fetchAll()]);

        case 'shifts.add_expense':
            requirePerm($db, $userId, 'treasury.add_expense', $branchId);
            $shiftId  = (int)($input['shift_id'] ?? 0);
            $amount   = (float)($input['amount'] ?? 0);
            $category = sanitize($input['category'] ?? '', 100);
            $desc     = sanitize($input['description'] ?? '', 300);
            if ($amount <= 0) jsonErr('المبلغ غير صحيح');
            $db->prepare("INSERT INTO expenses (branch_id,shift_id,category,amount,description,performed_by) VALUES(?,?,?,?,?,?)")
               ->execute([$branchId,$shiftId,$category,$amount,$desc,$userId]);
            if ($shiftId) {
                $db->prepare("INSERT INTO shift_transactions (shift_id,amount,type,notes) VALUES(?,'expense',?,?)")
                   ->execute([$shiftId,$amount,$desc]);
            }
            jsonOk();
    }
}
