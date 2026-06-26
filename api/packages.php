<?php
// ================================================================
//  packages.php v8 — الباقات كاملة
// ================================================================

function handlePackages(PDO $db, string $action, array $input,
                         int $userId, int $branchId): void {
    switch ($action) {

        case 'packages.list':
            $q = $db->prepare("SELECT p.*,
                                      u.name as doctor_name,
                                      GROUP_CONCAT(pi.name ORDER BY pi.id SEPARATOR '|') as items_names,
                                      GROUP_CONCAT(pi.quantity ORDER BY pi.id SEPARATOR '|') as items_qtys,
                                      GROUP_CONCAT(pi.type ORDER BY pi.id SEPARATOR '|') as items_types
                               FROM packages p
                               LEFT JOIN users u ON u.id=p.doctor_id
                               LEFT JOIN package_items pi ON pi.package_id=p.id
                               WHERE p.branch_id=? AND p.active=1
                               GROUP BY p.id ORDER BY p.name");
            $q->execute([$branchId]);
            jsonOk(['packages' => $q->fetchAll()]);

        case 'packages.save':
            requirePerm($db, $userId, 'packages.create', $branchId);
            $id    = (int)($input['id'] ?? 0);
            $name  = sanitize($input['name'] ?? '', 200);
            $items = $input['items'] ?? [];
            if (!$name || empty($items)) jsonErr('اسم الباقة والمحتوى مطلوبان');

            $pkgData = [
                'name'                 => $name,
                'branch_id'            => $branchId,
                'doctor_id'            => (int)($input['doctor_id'] ?? 0),
                'price'                => (float)($input['price'] ?? 0),
                'payment_installments' => max(1, (int)($input['payment_installments'] ?? 1)),
                'created_by'           => $userId,
            ];

            $db->beginTransaction();
            try {
                if ($id) {
                    $sets = implode(',', array_map(fn($k) => "$k=:$k", array_keys($pkgData)));
                    $pkgData['id'] = $id;
                    $db->prepare("UPDATE packages SET $sets WHERE id=:id")->execute($pkgData);
                    $db->prepare("DELETE FROM package_items WHERE package_id=?")->execute([$id]);
                } else {
                    $cols = implode(',', array_keys($pkgData));
                    $vals = ':' . implode(',:', array_keys($pkgData));
                    $db->prepare("INSERT INTO packages ($cols) VALUES ($vals)")->execute($pkgData);
                    $id = (int)$db->lastInsertId();
                }
                foreach ($items as $item) {
                    $db->prepare("INSERT INTO package_items
                                  (package_id,type,name,quantity,consumables_cost)
                                  VALUES(?,?,?,?,?)")
                       ->execute([$id,
                                  in_array($item['type'] ?? '', ['session','pulse']) ? $item['type'] : 'session',
                                  sanitize($item['name'] ?? '', 200),
                                  max(1, (int)($item['quantity'] ?? 1)),
                                  (float)($item['consumables_cost'] ?? 0)]);
                }
                $db->commit();
                jsonOk(['id' => $id]);
            } catch (Exception $e) { $db->rollBack(); throw $e; }

        case 'packages.delete':
            requirePerm($db, $userId, 'packages.create', $branchId);
            $id = (int)($input['id'] ?? 0);
            $db->prepare("UPDATE packages SET active=0 WHERE id=? AND branch_id=?")
               ->execute([$id, $branchId]);
            jsonOk();

        case 'packages.subscribe':
            // تسجيل مريض في باقة
            requirePerm($db, $userId, 'packages.create', $branchId);
            $patientId = (int)($input['patient_id'] ?? 0);
            $packageId = (int)($input['package_id'] ?? 0);
            $doctorId  = (int)($input['doctor_id'] ?? 0);
            $paid      = (float)($input['amount_paid'] ?? 0);
            if (!$patientId || !$packageId) jsonErr('بيانات ناقصة');

            // جلب الباقة ومحتوياتها
            $pkg = $db->prepare("SELECT * FROM packages WHERE id=? AND branch_id=? AND active=1");
            $pkg->execute([$packageId, $branchId]);
            $package = $pkg->fetch();
            if (!$package) jsonErr('الباقة غير موجودة');

            $items = $db->prepare("SELECT * FROM package_items WHERE package_id=?");
            $items->execute([$packageId]);
            $itemsList = $items->fetchAll();

            // بناء sessions_remaining
            $remaining = [];
            foreach ($itemsList as $item) $remaining[$item['id']] = $item['quantity'];

            $db->beginTransaction();
            try {
                $db->prepare("INSERT INTO patient_packages
                              (patient_id,package_id,branch_id,doctor_id,total_price,
                               amount_paid,sessions_remaining,created_by)
                              VALUES(?,?,?,?,?,?,?,?)")
                   ->execute([$patientId, $packageId, $branchId, $doctorId,
                              $package['price'], $paid,
                              json_encode($remaining, JSON_UNESCAPED_UNICODE),
                              $userId]);
                $ppId = (int)$db->lastInsertId();

                if ($paid > 0) {
                    $db->prepare("INSERT INTO ledger
                                  (patient_id,branch_id,type,amount,payment_method,description,performed_by)
                                  VALUES(?,?,'package_payment',?,?,?,?)")
                       ->execute([$patientId, $branchId, $paid,
                                  sanitize($input['payment_method'] ?? 'cash', 20),
                                  "اشتراك باقة: {$package['name']}", $userId]);
                    $db->prepare("UPDATE patients SET global_balance=global_balance+? WHERE id=?")
                       ->execute([$paid - $package['price'], $patientId]);
                }
                $db->commit();
                jsonOk(['patient_package_id' => $ppId]);
            } catch (Exception $e) { $db->rollBack(); throw $e; }

        case 'packages.deduct':
            // خصم جلسة/بلص من باقة
            requirePerm($db, $userId, 'packages.deduct_session', $branchId);
            $ppId    = (int)($input['patient_package_id'] ?? 0);
            $itemId  = (int)($input['item_id'] ?? 0);
            $qty     = max(1, (int)($input['quantity'] ?? 1));
            $apptId  = (int)($input['appointment_id'] ?? 0);
            $doctorId= (int)($input['doctor_id'] ?? $userId);
            $consumables = (float)($input['consumables_cost_actual'] ?? 0);

            if (!$ppId || !$itemId) jsonErr('بيانات ناقصة');

            $pp = $db->prepare("SELECT * FROM patient_packages WHERE id=? AND status='active'");
            $pp->execute([$ppId]);
            $patientPkg = $pp->fetch();
            if (!$patientPkg) jsonErr('الاشتراك غير موجود أو منتهي');

            $remaining = json_decode($patientPkg['sessions_remaining'], true) ?? [];
            $key = (string)$itemId;
            if (!isset($remaining[$key]) || $remaining[$key] < $qty)
                jsonErr('لا يوجد رصيد كافٍ في الباقة');

            $remaining[$key] -= $qty;
            $allDone = array_sum($remaining) === 0;

            $db->beginTransaction();
            try {
                $db->prepare("UPDATE patient_packages SET sessions_remaining=?,
                              status=?, updated_at=NOW() WHERE id=?")
                   ->execute([json_encode($remaining), $allDone ? 'completed' : 'active', $ppId]);

                $db->prepare("INSERT INTO package_sessions
                              (patient_package_id,appointment_id,item_id,quantity_used,
                               doctor_id,original_doctor_id,consumables_cost_actual,performed_by)
                              VALUES(?,?,?,?,?,?,?,?)")
                   ->execute([$ppId, $apptId, $itemId, $qty,
                              $doctorId, $patientPkg['doctor_id'],
                              $consumables, $userId]);

                // حساب عمولة الدكتور
                $item = $db->prepare("SELECT * FROM package_items WHERE id=?");
                $item->execute([$itemId]);
                $itemData = $item->fetch();
                if ($itemData) {
                    $pkg = $db->prepare("SELECT * FROM packages WHERE id=?");
                    $pkg->execute([$patientPkg['package_id']]);
                    $pkgData = $pkg->fetch();
                    $sessionValue = $pkgData['price'] / max(1, array_sum(
                        array_column($db->prepare("SELECT quantity FROM package_items WHERE package_id=?")
                            ->execute([$patientPkg['package_id']]) ? [] : [], 'quantity')
                    ));

                    $doc = $db->prepare("SELECT commission FROM users WHERE id=?");
                    $doc->execute([$doctorId]);
                    $commRate = (int)($doc->fetchColumn() ?: 0);
                    $net = max(0, $sessionValue - $consumables);
                    $commAmt = $net * $commRate / 100;

                    if ($commAmt > 0) {
                        $db->prepare("INSERT INTO doctor_commissions
                                      (doctor_id,package_session_id,branch_id,type,
                                       gross_amount,consumables_cost,net_amount,
                                       commission_rate,commission_amount)
                                      VALUES(?,?,?,'package_session',?,?,?,?,?)")
                           ->execute([$doctorId, (int)$db->lastInsertId(),
                                      $branchId, $sessionValue, $consumables,
                                      $net, $commRate, $commAmt]);
                    }
                }
                $db->commit();
                jsonOk(['remaining' => $remaining, 'completed' => $allDone]);
            } catch (Exception $e) { $db->rollBack(); throw $e; }

        case 'packages.skip':
            // تخطي جلسة بدون خصم (admin فقط)
            requirePerm($db, $userId, 'packages.skip_session', $branchId);
            $ppId   = (int)($input['patient_package_id'] ?? 0);
            $itemId = (int)($input['item_id'] ?? 0);
            $reason = sanitize($input['reason'] ?? '', 500);
            if (!$ppId || !$reason) jsonErr('سبب التخطي مطلوب');

            $db->prepare("INSERT INTO package_sessions
                          (patient_package_id,item_id,skipped,skip_reason,performed_by)
                          VALUES(?,?,1,?,?)")
               ->execute([$ppId, $itemId, $reason, $userId]);
            jsonOk();

        case 'packages.patient_packages':
            $patientId = (int)($input['patient_id'] ?? 0);
            if (!$patientId) jsonErr('patient_id مطلوب');
            $q = $db->prepare("SELECT pp.*, pk.name as package_name,
                                      u.name as doctor_name,
                                      b.name as branch_name
                               FROM patient_packages pp
                               LEFT JOIN packages pk ON pk.id=pp.package_id
                               LEFT JOIN users u ON u.id=pp.doctor_id
                               LEFT JOIN branches b ON b.id=pp.branch_id
                               WHERE pp.patient_id=?
                               ORDER BY pp.created_at DESC");
            $q->execute([$patientId]);
            jsonOk(['patient_packages' => $q->fetchAll()]);

        default:
            jsonErr('unknown packages action');
    }
}
