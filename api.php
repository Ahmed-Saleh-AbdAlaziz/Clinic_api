<?php
// ================================================================
//  api.php v8 — Main Router
//  كل endpoint في ملف منفصل
// ================================================================
require_once __DIR__ . '/includes/auth.php';

try {
    $db = getDB();

    // تسجيل presence
    $presence = $input['presence'] ?? null;
    if ($presence && !empty($presence['user_id'])) {
        $db->prepare("INSERT INTO user_presence(user_id,user_name,role,device_id,branch_id,last_seen)
                      VALUES(?,?,?,?,?,NOW())
                      ON DUPLICATE KEY UPDATE user_name=VALUES(user_name),last_seen=NOW(),
                      role=VALUES(role),branch_id=VALUES(branch_id)")
           ->execute([
               (int)$presence['user_id'],
               sanitize($presence['user_name'] ?? '', 200),
               sanitize($presence['role'] ?? '', 50),
               $deviceId,
               $branchId,
           ]);
    }

    // ── Router ────────────────────────────────────────────────────
    switch ($action) {

        case 'ping':
            jsonOk(['time' => date('c'), 'version' => 'v8', 'branch_id' => $branchId]);

        case 'login':
            require __DIR__ . '/api/auth-actions.php';
            handleLogin($db, $input);
            break;

        case 'change_password':
            require __DIR__ . '/api/auth-actions.php';
            handleChangePassword($db, $input, $userId);
            break;

        // ── Branches ──────────────────────────────────────────────
        case 'branches.list':
        case 'branches.save':
            require __DIR__ . '/api/branches.php';
            handleBranches($db, $action, $input, $userId, $branchId);
            break;

        // ── Patients ──────────────────────────────────────────────
        case 'patients.list':
        case 'patients.get':
        case 'patients.save':
        case 'patients.delete':
        case 'patients.search':
            require __DIR__ . '/api/patients.php';
            handlePatients($db, $action, $input, $userId, $branchId);
            break;

        // ── Appointments ──────────────────────────────────────────
        case 'appointments.list':
        case 'appointments.get':
        case 'appointments.save':
        case 'appointments.delete':
        case 'appointments.update_status':
        case 'appointments.add_service':
        case 'appointments.refund':
            require __DIR__ . '/api/appointments.php';
            handleAppointments($db, $action, $input, $userId, $branchId);
            break;

        // ── Services ──────────────────────────────────────────────
        case 'services.list':
        case 'services.save':
        case 'services.delete':
            require __DIR__ . '/api/services.php';
            handleServices($db, $action, $input, $userId, $branchId);
            break;

        // ── Packages ──────────────────────────────────────────────
        case 'packages.list':
        case 'packages.save':
        case 'packages.delete':
        case 'packages.subscribe':
        case 'packages.deduct':
        case 'packages.skip':
        case 'packages.patient_packages':
            require __DIR__ . '/api/packages.php';
            handlePackages($db, $action, $input, $userId, $branchId);
            break;

        // ── Shifts ────────────────────────────────────────────────
        case 'shifts.open':
        case 'shifts.close':
        case 'shifts.current':
        case 'shifts.list':
        case 'shifts.add_expense':
            require __DIR__ . '/api/shifts.php';
            handleShifts($db, $action, $input, $userId, $branchId);
            break;

        // ── Medical Records ───────────────────────────────────────
        case 'medical.get':
        case 'medical.save':
        case 'medical.history':
        case 'medical.upload_image':
        case 'medical.dictionary_search':
        case 'medical.dictionary_save':
            require __DIR__ . '/api/medical.php';
            handleMedical($db, $action, $input, $userId, $branchId);
            break;

        // ── Prescriptions ─────────────────────────────────────────
        case 'prescription.get_template':
        case 'prescription.save_template':
        case 'prescription.print':
            require __DIR__ . '/api/prescriptions.php';
            handlePrescriptions($db, $action, $input, $userId, $branchId);
            break;

        // ── Users & Permissions ───────────────────────────────────
        case 'users.list':
        case 'users.save':
        case 'users.delete':
        case 'users.permissions.get':
        case 'users.permissions.set':
            require __DIR__ . '/api/users.php';
            handleUsers($db, $action, $input, $userId, $branchId);
            break;

        // ── Reports & Treasury ────────────────────────────────────
        case 'reports.daily':
        case 'reports.monthly':
        case 'reports.yearly':
        case 'reports.doctor_commission':
        case 'reports.patient_source':
        case 'reports.shift':
        case 'treasury.summary':
        case 'treasury.add_expense':
            require __DIR__ . '/api/reports.php';
            handleReports($db, $action, $input, $userId, $branchId);
            break;

        // ── Ledger ────────────────────────────────────────────────
        case 'ledger.patient':
        case 'ledger.summary':
            require __DIR__ . '/api/ledger.php';
            handleLedger($db, $action, $input, $userId, $branchId);
            break;

        // ── Audit Log ─────────────────────────────────────────────
        case 'audit.list':
            require __DIR__ . '/api/audit.php';
            handleAudit($db, $action, $input, $userId, $branchId);
            break;

        // ── Settings ─────────────────────────────────────────────
        case 'settings.get':
        case 'settings.save':
        case 'settings.specializations':
        case 'settings.patient_sources':
        case 'settings.country_codes':
            require __DIR__ . '/api/settings.php';
            handleSettings($db, $action, $input, $userId, $branchId);
            break;

        // ── Lock System ───────────────────────────────────────────
        case 'lock_acquire':
        case 'lock_release':
        case 'lock_heartbeat':
        case 'lock_view':
            require __DIR__ . '/api/locks.php';
            handleLocks($db, $action, $input, $userId, $branchId, $deviceId);
            break;

        // ── Sync (للإعدادات والـ kv_store فقط) ───────────────────
        case 'sync':
            require __DIR__ . '/api/sync.php';
            handleSync($db, $input, $userId, $branchId, $deviceId);
            break;

        // ── Backup ───────────────────────────────────────────────
        case 'backup':
        case 'list_backups':
        case 'restore_backup':
            require __DIR__ . '/api/backup.php';
            handleBackup($db, $action, $input, $userId);
            break;

        // ── File Upload ──────────────────────────────────────────
        case 'upload':
            require __DIR__ . '/api/upload.php';
            handleUpload($db, $input, $userId, $branchId);
            break;

        default:
            jsonErr("Unknown action: $action");
    }

} catch (PDOException $e) {
    $isProduction = ($_ENV['APP_ENV'] ?? 'development') === 'production';
    jsonErr($isProduction ? 'Database error' : $e->getMessage(), 500);
} catch (Exception $e) {
    $isProduction = ($_ENV['APP_ENV'] ?? 'development') === 'production';
    jsonErr($isProduction ? 'Server error' : $e->getMessage(), 500);
}
