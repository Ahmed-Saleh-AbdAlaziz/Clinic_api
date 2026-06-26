<?php
function handleServices(PDO $db, string $action, array $input, int $userId, int $branchId): void {
    switch ($action) {
        case 'services.list':
            $doctorId = (int)($input['doctor_id'] ?? 0);
            $where = 'branch_id=?'; $params = [$branchId];
            if ($doctorId) { $where .= ' AND (doctor_id=0 OR doctor_id=?)'; $params[] = $doctorId; }
            $q = $db->prepare("SELECT s.*, u.name as doctor_name FROM services s
                               LEFT JOIN users u ON u.id=s.doctor_id
                               WHERE $where AND s.active=1 ORDER BY s.name");
            $q->execute($params);
            jsonOk(['services' => $q->fetchAll()]);

        case 'services.save':
            requirePerm($db, $userId, 'services.create', $branchId);
            $id   = (int)($input['id'] ?? 0);
            $name = sanitize($input['name'] ?? '', 200);
            if (!$name) jsonErr('اسم الخدمة مطلوب');
            $data = [
                'name'      => $name,
                'price'     => (float)($input['price'] ?? 0),
                'doctor_id' => (int)($input['doctor_id'] ?? 0),
                'branch_id' => $branchId,
            ];
            if ($id) {
                $sets = implode(',', array_map(fn($k) => "$k=:$k", array_keys($data)));
                $data['id'] = $id;
                $db->prepare("UPDATE services SET $sets WHERE id=:id")->execute($data);
            } else {
                $cols = implode(',', array_keys($data));
                $vals = ':' . implode(',:', array_keys($data));
                $db->prepare("INSERT INTO services ($cols) VALUES ($vals)")->execute($data);
                $id = (int)$db->lastInsertId();
            }
            jsonOk(['id' => $id]);

        case 'services.delete':
            requirePerm($db, $userId, 'services.delete', $branchId);
            $id = (int)($input['id'] ?? 0);
            $db->prepare("UPDATE services SET active=0 WHERE id=? AND branch_id=?")->execute([$id, $branchId]);
            jsonOk();
    }
}
