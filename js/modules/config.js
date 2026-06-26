/* ============================================================
   CLINIC SYSTEM v8 — API Config
   عدّل API_KEY و API_URL فقط
   ============================================================ */
const CLINIC_CONFIG = {
  API_URL:             'http://192.168.1.202/clinic/api.php',
  API_KEY:             '12345678901234567890123456789013',
  SYNC_INTERVAL_MS:    3000,
  DEFAULT_BRANCH_ID:   1,
  DEFAULT_COUNTRY_CODE:'+20',
};

// للتوافق مع الكود القديم
const MYSQL_CONFIG = CLINIC_CONFIG;
