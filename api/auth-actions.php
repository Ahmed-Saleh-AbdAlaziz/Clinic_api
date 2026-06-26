<?php
// ================================================================
//  auth-actions.php v8 — Login + Change Password
// ================================================================

function handleLogin(PDO $db, array $input): void {
    $username = sanitize($input['username'] ?? '', 100);
    $password = $input['password'] ?? '';
    if (!$username || !$password) jsonErr('بيانات ناقصة');

    $stmt = $db->prepare("SELECT u.*, b.name as branch_name
                          FROM users u
                          LEFT JOIN branches b ON b.id = u.branch_id
                          WHERE u.username=? AND u.active=1 LIMIT 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user) { usleep(300_000); jsonErr('بيانات الدخول غير صحيحة', 401); }

    $stored = $user['password'];
    $valid  = str_starts_with($stored, '$2')
        ? password_verify($password, $stored)
        : ($password === $stored);

    if (!$valid) { usleep(300_000); jsonErr('بيانات الدخول غير صحيحة', 401); }

    // ترقية تلقائية لـ bcrypt
    if (!str_starts_with($stored, '$2')) {
        $db->prepare("UPDATE users SET password=? WHERE id=?")
           ->execute([password_hash($password, PASSWORD_BCRYPT), $user['id']]);
    }

    // تحديث last_login
    $db->prepare("UPDATE users SET last_login=NOW() WHERE id=?")->execute([$user['id']]);

    // جلب الصلاحيات
    $perms = $db->prepare("SELECT perm_key, branch_id FROM user_permissions WHERE user_id=?");
    $perms->execute([$user['id']]);
    $permissions = $perms->fetchAll();

    unset($user['password']);
    jsonOk(['user' => $user, 'permissions' => $permissions]);
}

function handleChangePassword(PDO $db, array $input, int $requesterId): void {
    $targetId   = (int)($input['user_id'] ?? 0);
    $oldPass    = $input['old_password'] ?? '';
    $newPass    = $input['new_password'] ?? '';

    // Admin يقدر يغير لأي حد بدون old_password
    $requesterRole = '';
    if ($requesterId) {
        $r = $db->prepare("SELECT role FROM users WHERE id=?");
        $r->execute([$requesterId]);
        $requesterRole = $r->fetchColumn() ?: '';
    }

    $isAdmin = in_array($requesterRole, ['super_admin', 'admin']);

    if (!$targetId || (!$isAdmin && !$oldPass) || !$newPass)
        jsonErr('بيانات ناقصة');
    if (mb_strlen($newPass) < 8)
        jsonErr('كلمة المرور يجب أن تكون 8 أحرف على الأقل');

    $stmt = $db->prepare("SELECT password FROM users WHERE id=? AND active=1");
    $stmt->execute([$targetId]);
    $user = $stmt->fetch();
    if (!$user) jsonErr('المستخدم غير موجود');

    if (!$isAdmin) {
        $valid = str_starts_with($user['password'], '$2')
            ? password_verify($oldPass, $user['password'])
            : ($oldPass === $user['password']);
        if (!$valid) jsonErr('كلمة المرور الحالية غير صحيحة', 403);
    }

    $db->prepare("UPDATE users SET password=?, updated_at=NOW() WHERE id=?")
       ->execute([password_hash($newPass, PASSWORD_BCRYPT), $targetId]);

    jsonOk();
}
