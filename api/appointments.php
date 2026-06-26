<?php
// ================================================================
//  appointments.php v8 — المواعيد
// ================================================================

function handleAppointments(PDO $db, string $action, array $input,
                              int $userId, int $branchId): void {
    switch ($action) {

        case 'appointments.list':
            requirePerm($db, $userId, 'appointments.view_all', $branchId);
            $date      = $input['date'] ?? date('Y-m-d');
            $doctorId  = (int)($input['doctor_id'] ?? 0);
            $status    = sanitize($input['status'] ?? '', 20);

            $where = ['a.branch_id=?']; $params = [$branchId];
            if ($date) { $where[] = 'DATE(a.appointment_at)=?'; $params[] = $date; }
            if ($doctorId) { $where[] = 'a.doctor_id=?'; $params[] = $doctorId; }
            if ($status) { $where[] = 'a.status=?'; $params[] = $status; }

            $sql = "SELECT a.*, p.name as patient_name, p.phone as patient_phone,
                           p.global_balance,
                           u.name as doctor_name,
                           GROUP_CONCAT(s.service_name SEPARATOR ', ') as services_list
                    FROM appointments a
                    LEFT JOIN patients p ON p.id=a.patient_id
                    LEFT JOIN users u ON u.id=a.doctor_id
                    LEFT JOIN appointment_services s ON s.appointment_id=a.id
                    WHERE " . implode(' AND ', $where) . "
                    GROUP BY a.id
                    ORDER BY a.appointment_at ASC";
            $q = $db->prepare($sql);
            $q->execute($params);
            jsonOk(['appointments' => $q->fetchAll()]);

        case 'appointments.get':
            $id = (int)($input['id'] ?? 0);
            if (!$id) jsonErr('id مطلوب');
            $q = $db->prepare("SELECT a.*, p.name as patient_name, p.phone,
                                      p.global_balance, u.name as doctor_name
                               FROM appointments a
                               LEFT JOIN patients p ON p.id=a.patient_id
                               LEFT JOIN users u ON u.id=a.doctor_id
                               WHERE a.id=?");
            $q->execute([$id]);
            $appt = $q->fetch();
            if (!$appt) jsonErr('الموعد غير موجود', 404);

            $svcs = $db->prepare("SELECT * FROM appointment_services WHERE appointment_id=?");
            $svcs->execute([$id]);
            $appt['services'] = $svcs->fetchAll();
            jsonOk(['appointment' => $appt]);

        case 'appointments.save':
            requirePerm($db, $userId, 'appointments.create', $branchId);
            $id        = (int)($input['id'] ?? 0);
            $patientId = (int)($input['patient_id'] ?? 0);
            $doctorId  = (int)($input['doctor_id'] ?? 0);
            $apptAt    = $input['appointment_at'] ?? '';
            $services  = $input['services'] ?? [];
            $type      = in_array($input['type'] ?? '', ['service','package'])
                            ? $input['type'] : 'service';

            if (!$patientId || !$apptAt) jsonErr('بيانات ناقصة');

            $totalPrice = 0;
            foreach ($services as $s) $totalPrice += (float)($s['price'] ?? 0) * (int)($s['quantity'] ?? 1);

            $data = [
                'patient_id'        => $patientId,
                'doctor_id'         => $doctorId,
                'branch_id'         => $branchId,
                'appointment_at'    => $apptAt,
                'duration_min'      => (int)($input['duration_min'] ?? 30),
                'type'              => $type,
                'patient_package_id'=> (int)($input['patient_package_id'] ?? 0),
                'status'            => 'scheduled',
                'total_price'       => $totalPrice,
                'total_paid'        => (float)($input['total_paid'] ?? 0),
                'payment_method'    => sanitize($input['payment_method'] ?? 'cash', 20),
                'notes'             => sanitize($input['notes'] ?? '', 500),
                'created_by'        => $userId,
            ];

            $db->beginTransaction();
            try {
                if ($id) {
                    requirePerm($db, $userId, 'appointments.edit', $branchId);
                    $sets = implode(',', array_map(fn($k) => "$k=:$k", array_keys($data)));
                    $stmt = $db->prepare("UPDATE appointments SET $sets, updated_at=NOW() WHERE id=:id");
                    $data['id'] = $id;
                    $stmt->execute($data);
                    $db->prepare("DELETE FROM appointment_services WHERE appointment_id=?")->execute([$id]);
                } else {
                    $cols = implode(',', array_keys($data));
                    $vals = ':' . implode(',:', array_keys($data));
                    $db->prepare("INSERT INTO appointments ($cols) VALUES ($vals)")->execute($data);
                    $id = (int)$db->lastInsertId();
                }

                foreach ($services as $s) {
                    $db->prepare("INSERT INTO appointment_services
                                  (appointment_id,service_id,service_name,price,quantity)
                                  VALUES(?,?,?,?,?)")
                       ->execute([$id, (int)($s['service_id'] ?? 0),
                                  sanitize($s['service_name'] ?? '', 200),
                                  (float)($s['price'] ?? 0),
                                  (int)($s['quantity'] ?? 1)]);
                }

                // تسجيل في الـ ledger لو دُفع
                if ($data['total_paid'] > 0) {
                    recordLedger($db, $patientId, $id, $branchId,
                        'payment', $data['total_paid'],
                        $data['payment_method'], 'دفع موعد', $userId);
                    // تحديث الرصيد العام
                    $db->prepare("UPDATE patients SET global_balance=global_balance+? WHERE id=?")
                       ->execute([$data['total_paid'] - $totalPrice, $patientId]);
                }

                $db->commit();
                logAudit($db, 'appointment.save', 'appointment', $id, $userId, $branchId);
                jsonOk(['id' => $id]);
            } catch (Exception $e) {
                $db->rollBack(); throw $e;
            }

        case 'appointments.update_status':
            $id     = (int)($input['id'] ?? 0);
            $status = sanitize($input['status'] ?? '', 20);
            $validStatuses = ['scheduled','arrived','in_progress','done','cancelled','no_show'];
            if (!$id || !in_array($status, $validStatuses)) jsonErr('بيانات غير صحيحة');

            $extra = [];
            if ($status === 'cancelled') {
                $reason = sanitize($input['reason'] ?? '', 500);
                if (!$reason) jsonErr('سبب الإلغاء مطلوب');
                $extra = ['cancellation_reason' => $reason];
            }

            $sets = 'status=:status,updated_at=NOW()';
            $params = ['status' => $status, 'id' => $id];
            if ($extra) {
                $sets .= ',cancellation_reason=:cancellation_reason';
                $params['cancellation_reason'] = $extra['cancellation_reason'];
            }
            $db->prepare("UPDATE appointments SET $sets WHERE id=:id")->execute($params);

            // لو done → تسجيل في السجل الطبي + تحديث عداد الزيارات
            if ($status === 'done') {
                $appt = $db->prepare("SELECT patient_id FROM appointments WHERE id=?");
                $appt->execute([$id]);
                $patientId = (int)($appt->fetchColumn() ?: 0);
                if ($patientId) {
                    $db->prepare("UPDATE patients SET total_visits=total_visits+1 WHERE id=?")
                       ->execute([$patientId]);
                }
            }

            logAudit($db, "appointment.$status", 'appointment', $id, $userId, $branchId);
            jsonOk();

        case 'appointments.add_service':
            requirePerm($db, $userId, 'appointments.add_service', $branchId);
            $id        = (int)($input['appointment_id'] ?? 0);
            $serviceId = (int)($input['service_id'] ?? 0);
            $name      = sanitize($input['service_name'] ?? '', 200);
            $price     = (float)($input['price'] ?? 0);
            $qty       = max(1, (int)($input['quantity'] ?? 1));
            if (!$id) jsonErr('appointment_id مطلوب');

            $db->prepare("INSERT INTO appointment_services
                          (appointment_id,service_id,service_name,price,quantity)
                          VALUES(?,?,?,?,?)")
               ->execute([$id, $serviceId, $name, $price, $qty]);
            $db->prepare("UPDATE appointments SET total_price=total_price+?, updated_at=NOW() WHERE id=?")
               ->execute([$price * $qty, $id]);
            jsonOk();

        case 'appointments.refund':
            requirePerm($db, $userId, 'appointments.refund', $branchId);
            $id     = (int)($input['id'] ?? 0);
            $amount = (float)($input['amount'] ?? 0);
            $reason = sanitize($input['reason'] ?? '', 300);
            if (!$id || $amount <= 0) jsonErr('بيانات غير صحيحة');

            $appt = $db->prepare("SELECT patient_id,total_paid FROM appointments WHERE id=?");
            $appt->execute([$id]);
            $row = $appt->fetch();
            if (!$row) jsonErr('الموعد غير موجود');
            if ($amount > $row['total_paid']) jsonErr('المبلغ أكبر من المدفوع');

            $db->prepare("UPDATE appointments SET refund_amount=refund_amount+?,
                          total_paid=total_paid-?, updated_at=NOW() WHERE id=?")
               ->execute([$amount, $amount, $id]);
            recordLedger($db, $row['patient_id'], $id, $branchId,
                'refund', $amount, 'cash', "استرداد: $reason", $userId);
            $db->prepare("UPDATE patients SET global_balance=global_balance-? WHERE id=?")
               ->execute([$amount, $row['patient_id']]);

            logAudit($db, 'appointment.refund', 'appointment', $id, $userId, $branchId,
                     "amount=$amount reason=$reason");
            jsonOk();

        default:
            jsonErr('unknown appointments action');
    }
}

function recordLedger(PDO $db, int $patientId, int $apptId, int $branchId,
                       string $type, float $amount, string $method,
                       string $desc, int $userId): void {
    $db->prepare("INSERT INTO ledger
                  (patient_id,appt_id,branch_id,type,amount,payment_method,description,performed_by)
                  VALUES(?,?,?,?,?,?,?,?)")
       ->execute([$patientId, $apptId, $branchId, $type, $amount, $method, $desc, $userId]);
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
       ->execute([$action,$entityType,$entityId,$detail,$userId,$name,$branchId,
                  $_SERVER['REMOTE_ADDR'] ?? '']);
}
