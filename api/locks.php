<?php
define('LOCK_TTL', 300);
function handleLocks(PDO $db, string $action, array $input,
                      int $userId, int $branchId, string $deviceId): void {
    switch ($action) {
        case 'lock_acquire':
            $type     = sanitize($input['type']??'',50);
            $id       = (int)($input['id']??0);
            $userName = sanitize($input['user_name']??$deviceId,200);
            if (!$type||!$id) jsonErr('missing type/id');
            $db->prepare("DELETE FROM record_locks WHERE expires_at<NOW()")->execute();
            $stmt = $db->prepare("SELECT * FROM record_locks WHERE lock_type=? AND lock_id=?");
            $stmt->execute([$type,$id]);
            $lock = $stmt->fetch();
            if ($lock) {
                if ($lock['device_id']===$deviceId) {
                    $db->prepare("UPDATE record_locks SET expires_at=DATE_ADD(NOW(),INTERVAL ? SECOND) WHERE lock_type=? AND lock_id=?")
                       ->execute([LOCK_TTL,$type,$id]);
                    jsonOk();
                }
                $viewers = $db->prepare("SELECT user_name as name FROM lock_viewers WHERE lock_type=? AND lock_id=? AND last_seen>DATE_SUB(NOW(),INTERVAL 30 SECOND)");
                $viewers->execute([$type,$id]);
                jsonOk(['ok'=>false,'locked_by'=>$lock['user_name'],'since'=>$lock['locked_at'],'viewers'=>$viewers->fetchAll()]);
            }
            $label = sanitize($input['label']??'سجل',300);
            $db->prepare("INSERT INTO record_locks(lock_type,lock_id,device_id,user_name,user_id,label,locked_at,expires_at) VALUES(?,?,?,?,?,?,NOW(),DATE_ADD(NOW(),INTERVAL ? SECOND))")
               ->execute([$type,$id,$deviceId,$userName,$userId,$label,LOCK_TTL]);
            jsonOk();

        case 'lock_release':
            $type=$input['type']??''; $id=(int)($input['id']??0);
            $lrow=$db->prepare("SELECT label FROM record_locks WHERE lock_type=? AND lock_id=? AND device_id=?");
            $lrow->execute([$type,$id,$deviceId]); $ldata=$lrow->fetch();
            $db->prepare("DELETE FROM record_locks WHERE lock_type=? AND lock_id=? AND device_id=?")->execute([$type,$id,$deviceId]);
            if ($ldata) {
                $db->prepare("INSERT INTO lock_releases(lock_type,lock_id,label,released_by) VALUES(?,?,?,?)")
                   ->execute([$type,$id,$ldata['label'],$deviceId]);
                $db->exec("DELETE FROM lock_releases WHERE released_at<DATE_SUB(NOW(),INTERVAL 30 SECOND)");
            }
            $db->prepare("DELETE FROM lock_viewers WHERE lock_type=? AND lock_id=?")->execute([$type,$id]);
            jsonOk();

        case 'lock_heartbeat':
            $type=$input['type']??''; $id=(int)($input['id']??0);
            $db->prepare("UPDATE record_locks SET expires_at=DATE_ADD(NOW(),INTERVAL ? SECOND) WHERE lock_type=? AND lock_id=? AND device_id=?")
               ->execute([LOCK_TTL,$type,$id,$deviceId]);
            jsonOk();

        case 'lock_view':
            $type=$input['type']??''; $id=(int)($input['id']??0);
            $userName=sanitize($input['user_name']??$deviceId,200);
            $db->prepare("INSERT INTO lock_viewers(lock_type,lock_id,device_id,user_name,last_seen) VALUES(?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE user_name=VALUES(user_name),last_seen=NOW()")
               ->execute([$type,$id,$deviceId,$userName]);
            jsonOk();
    }
}
