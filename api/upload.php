<?php
// ================================================================
//  upload.php v8 — رفع الصور للأرشيف
// ================================================================
function handleUpload(PDO $db, array $input, int $userId, int $branchId): void {
    if (!isset($_FILES['file'])) jsonErr('لم يتم رفع ملف');

    $file      = $_FILES['file'];
    $recordId  = (int)($input['record_id']  ?? 0);
    $patientId = (int)($input['patient_id'] ?? 0);
    if (!$recordId || !$patientId) jsonErr('record_id و patient_id مطلوبان');

    // تحقق من نوع الملف
    $allowedTypes = ['image/jpeg','image/png','image/gif','image/webp'];
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime  = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    if (!in_array($mime, $allowedTypes)) jsonErr('نوع الملف غير مسموح');
    if ($file['size'] > 10 * 1024 * 1024) jsonErr('حجم الملف أكبر من 10MB');

    // مسار الأرشيف
    $archiveBase = rtrim($_ENV['ARCHIVE_PATH'] ?? __DIR__ . '/../../archive', '/\\');
    $dir = "$archiveBase/$branchId/$patientId/$recordId";
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) jsonErr('تعذر إنشاء مجلد الأرشيف');

    $ext      = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'jpg';
    $filename = uniqid('img_', true) . ".$ext";
    $fullPath = "$dir/$filename";
    $webPath  = "archive/$branchId/$patientId/$recordId/$filename";

    if (!move_uploaded_file($file['tmp_name'], $fullPath)) jsonErr('فشل رفع الملف');

    $drawingData = $input['drawing_data'] ?? null;
    $bodyChart   = sanitize($input['body_chart_base'] ?? '', 300);
    $notes       = sanitize($input['notes'] ?? '', 500);

    $db->prepare("INSERT INTO medical_record_images
                  (record_id,file_path,body_chart_base,drawing_data,notes)
                  VALUES(?,?,?,?,?)")
       ->execute([$recordId, $webPath, $bodyChart,
                  $drawingData ? json_encode($drawingData) : null, $notes]);

    jsonOk(['file_path' => $webPath, 'image_id' => (int)$db->lastInsertId()]);
}
