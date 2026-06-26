<?php
function handleBranches(PDO $db, string $action, array $input, int $userId, int $branchId): void {
    switch ($action) {
        case 'branches.list':
            $q = $db->query("SELECT * FROM branches WHERE active=1 ORDER BY name");
            jsonOk(['branches' => $q->fetchAll()]);
        case 'branches.save':
            requirePerm($db, $userId, 'settings.branches', 0);
            $id   = (int)($input['id'] ?? 0);
            $name = sanitize($input['name'] ?? '', 200);
            if (!$name) jsonErr('اسم الفرع مطلوب');
            $data = ['name'=>$name,'address'=>sanitize($input['address']??'',500),
                     'phone'=>sanitize($input['phone']??'',30),
                     'settings'=>json_encode($input['settings']??new stdClass())];
            if ($id) {
                $sets = implode(',', array_map(fn($k) => "$k=:$k", array_keys($data)));
                $data['id']=$id;
                $db->prepare("UPDATE branches SET $sets WHERE id=:id")->execute($data);
            } else {
                $cols=implode(',',array_keys($data)); $vals=':'.implode(',:',(array_keys($data)));
                $db->prepare("INSERT INTO branches ($cols) VALUES ($vals)")->execute($data);
                $id=(int)$db->lastInsertId();
            }
            jsonOk(['id'=>$id]);
    }
}
