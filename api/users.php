<?php
function handleUsers(PDO $db, string $action, array $input, int $userId, int $branchId): void {
    switch ($action) {
        case 'users.list':
            requirePerm($db, $userId, 'settings.users', $branchId);
            $bFilter = (int)($input['branch_id'] ?? 0);
            $where = '1=1'; $params = [];
            if ($bFilter) { $where .= ' AND u.branch_id=?'; $params[] = $bFilter; }
            $q = $db->prepare("SELECT u.id,u.username,u.name,u.role,u.branch_id,
                                      u.specialization_id,u.commission,u.phone,u.active,u.last_login,
                                      b.name as branch_name,s.name as specialization_name
                               FROM users u
                               LEFT JOIN branches b ON b.id=u.branch_id
                               LEFT JOIN specializations s ON s.id=u.specialization_id
                               WHERE $where ORDER BY u.name");
            $q->execute($params);
            jsonOk(['users' => $q->fetchAll()]);

        case 'users.save':
            requirePerm($db, $userId, 'settings.users', $branchId);
            $id = (int)($input['id'] ?? 0);
            $username = sanitize($input['username'] ?? '', 100);
            $name     = sanitize($input['name'] ?? '', 200);
            $role     = in_array($input['role']??'', ['super_admin','admin','doctor','secretary'])
                            ? $input['role'] : 'secretary';
            if (!$username || !$name) jsonErr('بيانات ناقصة');

            $data = [
                'username'          => $username,
                'name'              => $name,
                'role'              => $role,
                'branch_id'         => (int)($input['branch_id'] ?? $branchId),
                'specialization_id' => (int)($input['specialization_id'] ?? 0),
                'commission'        => min(100, max(0, (int)($input['commission'] ?? 0))),
                'phone'             => sanitize($input['phone'] ?? '', 30),
                'active'            => isset($input['active']) ? (int)$input['active'] : 1,
                'settings'          => json_encode($input['settings'] ?? new stdClass()),
            ];
            if ($id) {
                $sets = implode(',', array_map(fn($k) => "$k=:$k", array_keys($data)));
                $data['id'] = $id;
                $db->prepare("UPDATE users SET $sets,updated_at=NOW() WHERE id=:id")->execute($data);
            } else {
                $pass = $input['password'] ?? 'Clinic@2026';
                $data['password'] = password_hash($pass, PASSWORD_BCRYPT);
                $cols = implode(',', array_keys($data));
                $vals = ':' . implode(',:', array_keys($data));
                $db->prepare("INSERT INTO users ($cols) VALUES ($vals)")->execute($data);
                $id = (int)$db->lastInsertId();
            }
            jsonOk(['id' => $id]);

        case 'users.delete':
            requirePerm($db, $userId, 'settings.users', $branchId);
            $id = (int)($input['id'] ?? 0);
            if ($id === $userId) jsonErr('لا يمكن حذف حسابك الخاص');
            $db->prepare("UPDATE users SET active=0 WHERE id=?")->execute([$id]);
            jsonOk();

        case 'users.permissions.get':
            requirePerm($db, $userId, 'settings.users', $branchId);
            $id = (int)($input['user_id'] ?? 0);
            $q = $db->prepare("SELECT perm_key, branch_id FROM user_permissions WHERE user_id=?");
            $q->execute([$id]);
            $allPerms = $db->query("SELECT perm_key, label, category FROM permissions ORDER BY category,label");
            jsonOk(['user_permissions' => $q->fetchAll(), 'all_permissions' => $allPerms->fetchAll()]);

        case 'users.permissions.set':
            requirePerm($db, $userId, 'settings.users', $branchId);
            $id    = (int)($input['user_id'] ?? 0);
            $perms = $input['permissions'] ?? []; // [{perm_key, branch_id}]
            if (!$id) jsonErr('user_id مطلوب');
            $db->prepare("DELETE FROM user_permissions WHERE user_id=?")->execute([$id]);
            foreach ($perms as $p) {
                $db->prepare("INSERT IGNORE INTO user_permissions (user_id,perm_key,branch_id) VALUES(?,?,?)")
                   ->execute([$id, sanitize($p['perm_key']??'',100), (int)($p['branch_id']??0)]);
            }
            jsonOk();
    }
}
