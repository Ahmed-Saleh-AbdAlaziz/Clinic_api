<?php
function handleMedical(PDO $db, string $action, array $input, int $userId, int $branchId): void {
    switch ($action) {
        case 'medical.get':
            requirePerm($db, $userId, 'medical.view', $branchId);
            $apptId = (int)($input['appointment_id'] ?? 0);
            $q = $db->prepare("SELECT mr.*,
                                      GROUP_CONCAT(DISTINCT mrp.id) as rx_ids
                               FROM medical_records mr
                               LEFT JOIN medical_record_prescriptions mrp ON mrp.record_id=mr.id
                               WHERE mr.appointment_id=? GROUP BY mr.id");
            $q->execute([$apptId]);
            $record = $q->fetch();
            if (!$record) { jsonOk(['record' => null]); }

            $rx = $db->prepare("SELECT * FROM medical_record_prescriptions WHERE record_id=?");
            $rx->execute([$record['id']]);
            $labs = $db->prepare("SELECT * FROM medical_record_labs WHERE record_id=?");
            $labs->execute([$record['id']]);
            $imgs = $db->prepare("SELECT * FROM medical_record_images WHERE record_id=?");
            $imgs->execute([$record['id']]);

            $record['prescriptions'] = $rx->fetchAll();
            $record['labs']          = $labs->fetchAll();
            $record['images']        = $imgs->fetchAll();
            jsonOk(['record' => $record]);

        case 'medical.save':
            requirePerm($db, $userId, 'medical.edit', $branchId);
            $apptId    = (int)($input['appointment_id'] ?? 0);
            $patientId = (int)($input['patient_id'] ?? 0);
            if (!$apptId || !$patientId) jsonErr('بيانات ناقصة');

            $data = [
                'patient_id'           => $patientId,
                'appointment_id'       => $apptId,
                'doctor_id'            => $userId,
                'branch_id'            => $branchId,
                'chief_complaint'      => sanitize($input['chief_complaint'] ?? '', 2000),
                'examination_findings' => sanitize($input['examination_findings'] ?? '', 2000),
                'diagnosis'            => sanitize($input['diagnosis'] ?? '', 2000),
                'treatment_plan'       => sanitize($input['treatment_plan'] ?? '', 2000),
                'next_visit_date'      => $input['next_visit_date'] ?? null,
            ];

            // هل موجود؟
            $existing = $db->prepare("SELECT id FROM medical_records WHERE appointment_id=?");
            $existing->execute([$apptId]);
            $existingId = $existing->fetchColumn();

            $db->beginTransaction();
            try {
                if ($existingId) {
                    $sets = implode(',', array_map(fn($k) => "$k=:$k", array_keys($data)));
                    $data['id'] = $existingId;
                    $db->prepare("UPDATE medical_records SET $sets,updated_at=NOW() WHERE id=:id")->execute($data);
                    $recordId = $existingId;
                } else {
                    $cols = implode(',', array_keys($data));
                    $vals = ':' . implode(',:', array_keys($data));
                    $db->prepare("INSERT INTO medical_records ($cols) VALUES ($vals)")->execute($data);
                    $recordId = (int)$db->lastInsertId();
                }

                // الروشتة
                if (isset($input['prescriptions'])) {
                    $db->prepare("DELETE FROM medical_record_prescriptions WHERE record_id=?")->execute([$recordId]);
                    foreach ($input['prescriptions'] as $rx) {
                        $db->prepare("INSERT INTO medical_record_prescriptions
                            (record_id,drug_name,times_per_day,duration_days,timing,schedule,interval_hours,dose,notes)
                            VALUES(?,?,?,?,?,?,?,?,?)")
                           ->execute([$recordId,
                               sanitize($rx['drug_name'] ?? '', 200),
                               (int)($rx['times_per_day'] ?? 1),
                               (int)($rx['duration_days'] ?? 0),
                               in_array($rx['timing']??'', ['before_meal','after_meal','any']) ? $rx['timing'] : 'any',
                               in_array($rx['schedule']??'', ['morning','evening','morning_evening','every_x_hours','continuous','as_needed']) ? $rx['schedule'] : 'morning',
                               (int)($rx['interval_hours'] ?? 0),
                               sanitize($rx['dose'] ?? '', 100),
                               sanitize($rx['notes'] ?? '', 500),
                           ]);

                        // إضافة للقاموس تلقائياً
                        $drugName = sanitize($rx['drug_name'] ?? '', 200);
                        if ($drugName) {
                            $db->prepare("INSERT INTO doctor_dictionaries (doctor_id,branch_id,type,term,use_count)
                                          VALUES(?,?,'drug',?,1)
                                          ON DUPLICATE KEY UPDATE use_count=use_count+1")
                               ->execute([$userId, $branchId, $drugName]);
                        }
                    }
                }

                // التحاليل
                if (isset($input['labs'])) {
                    $db->prepare("DELETE FROM medical_record_labs WHERE record_id=?")->execute([$recordId]);
                    foreach ($input['labs'] as $lab) {
                        $db->prepare("INSERT INTO medical_record_labs (record_id,type,name,result,template_id) VALUES(?,?,?,?,?)")
                           ->execute([$recordId,
                               in_array($lab['type']??'', ['lab','radiology','other']) ? $lab['type'] : 'lab',
                               sanitize($lab['name'] ?? '', 200),
                               sanitize($lab['result'] ?? '', 1000),
                               (int)($lab['template_id'] ?? 0)]);
                    }
                }

                // إضافة للقاموس (الشكوى + التشخيص)
                foreach ([
                    ['complaint', $data['chief_complaint']],
                    ['finding',   $data['examination_findings']],
                    ['diagnosis', $data['diagnosis']],
                ] as [$type, $term]) {
                    $term = trim($term ?? '');
                    if ($term) {
                        $db->prepare("INSERT INTO doctor_dictionaries (doctor_id,branch_id,type,term,use_count)
                                      VALUES(?,?,?,?,1)
                                      ON DUPLICATE KEY UPDATE use_count=use_count+1")
                           ->execute([$userId, $branchId, $type, $term]);
                    }
                }

                $db->commit();
                jsonOk(['record_id' => $recordId]);
            } catch (Exception $e) { $db->rollBack(); throw $e; }

        case 'medical.history':
            requirePerm($db, $userId, 'medical.view', $branchId);
            $patientId = (int)($input['patient_id'] ?? 0);
            if (!$patientId) jsonErr('patient_id مطلوب');
            $q = $db->prepare("SELECT mr.*,u.name as doctor_name,b.name as branch_name,
                                      a.appointment_at
                               FROM medical_records mr
                               LEFT JOIN users u ON u.id=mr.doctor_id
                               LEFT JOIN branches b ON b.id=mr.branch_id
                               LEFT JOIN appointments a ON a.id=mr.appointment_id
                               WHERE mr.patient_id=?
                               ORDER BY mr.created_at DESC LIMIT 50");
            $q->execute([$patientId]);
            jsonOk(['history' => $q->fetchAll()]);

        case 'medical.dictionary_search':
            $type = sanitize($input['type'] ?? '', 20);
            $term = sanitize($input['q'] ?? '', 100);
            if (!$term) jsonOk(['results' => []]);
            $q = $db->prepare("SELECT term, use_count FROM doctor_dictionaries
                               WHERE doctor_id=? AND type=? AND term LIKE ?
                               ORDER BY use_count DESC LIMIT 10");
            $q->execute([$userId, $type, "%$term%"]);
            jsonOk(['results' => $q->fetchAll()]);

        case 'medical.dictionary_save':
            $type = sanitize($input['type'] ?? '', 20);
            $term = sanitize($input['term'] ?? '', 300);
            if (!$type || !$term) jsonErr('بيانات ناقصة');
            $db->prepare("INSERT INTO doctor_dictionaries (doctor_id,branch_id,type,term,use_count)
                          VALUES(?,?,?,?,1)
                          ON DUPLICATE KEY UPDATE use_count=use_count+1")
               ->execute([$userId, $branchId, $type, $term]);
            jsonOk();

        case 'medical.upload_image':
            requirePerm($db, $userId, 'medical.images', $branchId);
            // يُعالج في upload.php
            jsonErr('استخدم endpoint upload');
    }
}
