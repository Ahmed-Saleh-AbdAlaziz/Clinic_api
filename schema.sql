-- ================================================================
--  CLINIC SYSTEM v8 — Complete Schema
--  Multi-Branch + Packages + Medical Records + Permissions
-- ================================================================

CREATE DATABASE IF NOT EXISTS clinic_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE clinic_db;

-- ================================================================
--  1. BRANCHES (الفروع)
-- ================================================================
CREATE TABLE IF NOT EXISTS branches (
  id           INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(200)    NOT NULL,
  address      VARCHAR(500)    NOT NULL DEFAULT '',
  phone        VARCHAR(30)     NOT NULL DEFAULT '',
  logo_path    VARCHAR(500)    NOT NULL DEFAULT '',
  settings     JSON,
  active       TINYINT(1)      NOT NULL DEFAULT 1,
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                 ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
--  2. COUNTRY CODES (أكواد الدول)
-- ================================================================
CREATE TABLE IF NOT EXISTS country_codes (
  id           INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100)    NOT NULL,
  code         VARCHAR(10)     NOT NULL,
  phone_length TINYINT         NOT NULL DEFAULT 10,
  flag         VARCHAR(10)     NOT NULL DEFAULT '',
  INDEX idx_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
--  3. SPECIALIZATIONS (التخصصات)
-- ================================================================
CREATE TABLE IF NOT EXISTS specializations (
  id                INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(200)    NOT NULL,
  body_chart_folder VARCHAR(300)    NOT NULL DEFAULT '',
  active            TINYINT(1)      NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
--  4. USERS (المستخدمون)
-- ================================================================
CREATE TABLE IF NOT EXISTS users (
  id                INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username          VARCHAR(100)    NOT NULL UNIQUE,
  password          VARCHAR(255)    NOT NULL,
  name              VARCHAR(200)    NOT NULL,
  role              ENUM('super_admin','admin','doctor','secretary')
                                    NOT NULL DEFAULT 'secretary',
  branch_id         INT UNSIGNED    NOT NULL DEFAULT 0,
  -- 0 = super_admin (كل الفروع)
  specialization_id INT UNSIGNED    NOT NULL DEFAULT 0,
  commission        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  phone             VARCHAR(30)     NOT NULL DEFAULT '',
  active            TINYINT(1)      NOT NULL DEFAULT 1,
  last_login        DATETIME,
  settings          JSON,
  created_at        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                      ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_role      (role),
  INDEX idx_branch    (branch_id),
  INDEX idx_active    (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
--  5. PERMISSIONS (الصلاحيات)
-- ================================================================
CREATE TABLE IF NOT EXISTS permissions (
  id           INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY,
  perm_key     VARCHAR(100)    NOT NULL UNIQUE,
  label        VARCHAR(200)    NOT NULL,
  category     VARCHAR(100)    NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id      INT UNSIGNED    NOT NULL,
  perm_key     VARCHAR(100)    NOT NULL,
  branch_id    INT UNSIGNED    NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, perm_key, branch_id),
  INDEX idx_user   (user_id),
  INDEX idx_branch (branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
--  6. PATIENT SOURCES (مصادر المرضى)
-- ================================================================
CREATE TABLE IF NOT EXISTS patient_sources (
  id           INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(200)    NOT NULL,
  branch_id    INT UNSIGNED    NOT NULL DEFAULT 0,
  is_permanent TINYINT(1)      NOT NULL DEFAULT 1,
  created_by   INT UNSIGNED    NOT NULL DEFAULT 0,
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_branch (branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
--  7. PATIENTS (المرضى) — global عبر الفروع
-- ================================================================
CREATE TABLE IF NOT EXISTS patients (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(30)     NOT NULL DEFAULT '',
  -- كود المريض: فرع-رقم مثل B1-0042
  name            VARCHAR(200)    NOT NULL,
  phone           VARCHAR(30)     NOT NULL DEFAULT '',
  phone_country   VARCHAR(10)     NOT NULL DEFAULT '',
  phone2          VARCHAR(30)     NOT NULL DEFAULT '',
  national_id     VARCHAR(30)     NOT NULL DEFAULT '',
  date_of_birth   DATE,
  gender          ENUM('male','female','other') NOT NULL DEFAULT 'other',
  address         VARCHAR(500)    NOT NULL DEFAULT '',
  source_id       INT UNSIGNED    NOT NULL DEFAULT 0,
  source_branch_id INT UNSIGNED   NOT NULL DEFAULT 0,
  -- الفرع اللي سجّله أول مرة
  global_balance  DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  -- + رصيد دائن، - مديونية
  total_visits    INT UNSIGNED    NOT NULL DEFAULT 0,
  notes           TEXT,
  active          TINYINT(1)      NOT NULL DEFAULT 1,
  registered_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                    ON UPDATE CURRENT_TIMESTAMP(3),
  created_by      INT UNSIGNED    NOT NULL DEFAULT 0,

  INDEX idx_name       (name),
  INDEX idx_phone      (phone),
  INDEX idx_national   (national_id),
  INDEX idx_code       (code),
  INDEX idx_updated    (updated_at),
  INDEX idx_balance    (global_balance),
  FULLTEXT idx_ft_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
--  8. SERVICES (الخدمات) — per branch
-- ================================================================
CREATE TABLE IF NOT EXISTS services (
  id          INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(200)    NOT NULL,
  price       DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  doctor_id   INT UNSIGNED    NOT NULL DEFAULT 0,
  branch_id   INT UNSIGNED    NOT NULL DEFAULT 1,
  active      TINYINT(1)      NOT NULL DEFAULT 1,
  updated_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_doctor (doctor_id),
  INDEX idx_branch (branch_id),
  INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
--  9. PACKAGES (الباقات)
-- ================================================================
CREATE TABLE IF NOT EXISTS packages (
  id                    INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name                  VARCHAR(200)    NOT NULL,
  branch_id             INT UNSIGNED    NOT NULL DEFAULT 1,
  doctor_id             INT UNSIGNED    NOT NULL DEFAULT 0,
  price                 DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  payment_installments  TINYINT         NOT NULL DEFAULT 1,
  -- عدد أقساط الدفع
  active                TINYINT(1)      NOT NULL DEFAULT 1,
  created_by            INT UNSIGNED    NOT NULL DEFAULT 0,
  created_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_branch  (branch_id),
  INDEX idx_doctor  (doctor_id),
  INDEX idx_active  (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS package_items (
  id                INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY,
  package_id        INT UNSIGNED    NOT NULL,
  type              ENUM('session','pulse') NOT NULL DEFAULT 'session',
  name              VARCHAR(200)    NOT NULL,
  quantity          SMALLINT        NOT NULL DEFAULT 1,
  consumables_cost  DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  INDEX idx_package (package_id),
  FOREIGN KEY fk_pi_pkg (package_id)
    REFERENCES packages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS patient_packages (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id          BIGINT UNSIGNED NOT NULL,
  package_id          INT UNSIGNED    NOT NULL,
  branch_id           INT UNSIGNED    NOT NULL DEFAULT 1,
  doctor_id           INT UNSIGNED    NOT NULL DEFAULT 0,
  total_price         DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  amount_paid         DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  amount_remaining    DECIMAL(10,2)   GENERATED ALWAYS AS (total_price - amount_paid) STORED,
  sessions_remaining  JSON,
  -- {"item_id": remaining_count}
  status              ENUM('active','completed','cancelled')
                                      NOT NULL DEFAULT 'active',
  installment_count   TINYINT         NOT NULL DEFAULT 1,
  created_by          INT UNSIGNED    NOT NULL DEFAULT 0,
  created_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                        ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_patient (patient_id),
  INDEX idx_branch  (branch_id),
  INDEX idx_status  (status),
  FOREIGN KEY fk_pp_patient (patient_id)
    REFERENCES patients(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS package_sessions (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_package_id    BIGINT UNSIGNED NOT NULL,
  appointment_id        BIGINT UNSIGNED NOT NULL DEFAULT 0,
  item_id               INT UNSIGNED    NOT NULL,
  quantity_used         SMALLINT        NOT NULL DEFAULT 1,
  doctor_id             INT UNSIGNED    NOT NULL DEFAULT 0,
  original_doctor_id    INT UNSIGNED    NOT NULL DEFAULT 0,
  consumables_cost_actual DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  skipped               TINYINT(1)      NOT NULL DEFAULT 0,
  skip_reason           VARCHAR(500)    NOT NULL DEFAULT '',
  performed_by          INT UNSIGNED    NOT NULL DEFAULT 0,
  performed_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_pkg     (patient_package_id),
  INDEX idx_appt    (appointment_id),
  INDEX idx_doctor  (doctor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
--  10. APPOINTMENTS (المواعيد)
-- ================================================================
CREATE TABLE IF NOT EXISTS appointments (
  id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id      BIGINT UNSIGNED  NOT NULL,
  doctor_id       INT UNSIGNED     NOT NULL DEFAULT 0,
  branch_id       INT UNSIGNED     NOT NULL DEFAULT 1,
  appointment_at  DATETIME         NOT NULL,
  duration_min    SMALLINT         NOT NULL DEFAULT 30,
  type            ENUM('service','package') NOT NULL DEFAULT 'service',
  patient_package_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  status          ENUM('scheduled','arrived','in_progress','done',
                       'cancelled','no_show')
                                   NOT NULL DEFAULT 'scheduled',
  total_price     DECIMAL(10,2)    NOT NULL DEFAULT 0.00,
  total_paid      DECIMAL(10,2)    NOT NULL DEFAULT 0.00,
  payment_method  ENUM('cash','card','wallet','mixed','later')
                                   NOT NULL DEFAULT 'cash',
  cancellation_reason VARCHAR(500) NOT NULL DEFAULT '',
  refund_amount   DECIMAL(10,2)    NOT NULL DEFAULT 0.00,
  notes           TEXT,
  created_by      INT UNSIGNED     NOT NULL DEFAULT 0,
  updated_at      DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                    ON UPDATE CURRENT_TIMESTAMP(3),
  created_at      DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX idx_patient    (patient_id),
  INDEX idx_doctor     (doctor_id),
  INDEX idx_branch     (branch_id),
  INDEX idx_date       (appointment_at),
  INDEX idx_status     (status),
  INDEX idx_updated    (updated_at),
  FOREIGN KEY fk_appt_patient (patient_id)
    REFERENCES patients(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appointment_services (
  id             BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  appointment_id BIGINT UNSIGNED  NOT NULL,
  service_id     INT UNSIGNED     NOT NULL DEFAULT 0,
  service_name   VARCHAR(200)     NOT NULL DEFAULT '',
  price          DECIMAL(10,2)    NOT NULL DEFAULT 0.00,
  quantity       TINYINT          NOT NULL DEFAULT 1,
  INDEX idx_appt (appointment_id),
  FOREIGN KEY fk_as_appt (appointment_id)
    REFERENCES appointments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
--  11. DOCTOR COMMISSIONS (عمولات الأطباء)
-- ================================================================
CREATE TABLE IF NOT EXISTS doctor_commissions (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  doctor_id           INT UNSIGNED    NOT NULL,
  appointment_id      BIGINT UNSIGNED NOT NULL DEFAULT 0,
  package_session_id  BIGINT UNSIGNED NOT NULL DEFAULT 0,
  branch_id           INT UNSIGNED    NOT NULL DEFAULT 1,
  type                ENUM('service','package_session') NOT NULL,
  gross_amount        DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  consumables_cost    DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  net_amount          DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  commission_rate     TINYINT         NOT NULL DEFAULT 0,
  commission_amount   DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  created_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_doctor  (doctor_id),
  INDEX idx_branch  (branch_id),
  INDEX idx_date    (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
--  12. SHIFTS (الشيفتات)
-- ================================================================
CREATE TABLE IF NOT EXISTS shifts (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id           INT UNSIGNED    NOT NULL,
  branch_id         INT UNSIGNED    NOT NULL DEFAULT 1,
  started_at        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ended_at          DATETIME(3),
  total_cash        DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  total_card        DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  total_wallet      DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  total_refunds     DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  total_expenses    DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  appointments_count INT UNSIGNED   NOT NULL DEFAULT 0,
  status            ENUM('open','closed') NOT NULL DEFAULT 'open',
  notes             TEXT,
  INDEX idx_user   (user_id),
  INDEX idx_branch (branch_id),
  INDEX idx_status (status),
  INDEX idx_date   (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shift_transactions (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  shift_id        BIGINT UNSIGNED NOT NULL,
  appointment_id  BIGINT UNSIGNED NOT NULL DEFAULT 0,
  amount          DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  payment_method  ENUM('cash','card','wallet') NOT NULL DEFAULT 'cash',
  type            ENUM('payment','refund','expense') NOT NULL DEFAULT 'payment',
  notes           VARCHAR(300)    NOT NULL DEFAULT '',
  created_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_shift (shift_id),
  FOREIGN KEY fk_st_shift (shift_id)
    REFERENCES shifts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
--  13. LEDGER (دفتر اليومية) — global
-- ================================================================
CREATE TABLE IF NOT EXISTS ledger (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id   BIGINT UNSIGNED,
  appt_id      BIGINT UNSIGNED,
  branch_id    INT UNSIGNED    NOT NULL DEFAULT 1,
  shift_id     BIGINT UNSIGNED NOT NULL DEFAULT 0,
  type         ENUM('payment','partial_payment','refund',
                    'partial_refund','expense','income',
                    'package_payment','package_refund')
                               NOT NULL,
  amount       DECIMAL(12,2)   NOT NULL,
  payment_method ENUM('cash','card','wallet','mixed') NOT NULL DEFAULT 'cash',
  description  VARCHAR(500)    NOT NULL DEFAULT '',
  performed_by INT UNSIGNED    NOT NULL DEFAULT 0,
  ts           DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX idx_patient (patient_id),
  INDEX idx_branch  (branch_id),
  INDEX idx_date    (ts),
  INDEX idx_type    (type),
  INDEX idx_shift   (shift_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
--  14. TREASURY / EXPENSES (الخزنة والمصاريف)
-- ================================================================
CREATE TABLE IF NOT EXISTS expenses (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  branch_id    INT UNSIGNED    NOT NULL DEFAULT 1,
  shift_id     BIGINT UNSIGNED NOT NULL DEFAULT 0,
  category     VARCHAR(100)    NOT NULL DEFAULT '',
  amount       DECIMAL(10,2)   NOT NULL,
  description  VARCHAR(300)    NOT NULL DEFAULT '',
  performed_by INT UNSIGNED    NOT NULL DEFAULT 0,
  ts           DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_branch (branch_id),
  INDEX idx_date   (ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
--  15. MEDICAL RECORDS (السجل الطبي)
-- ================================================================
CREATE TABLE IF NOT EXISTS medical_records (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id           BIGINT UNSIGNED NOT NULL,
  appointment_id       BIGINT UNSIGNED NOT NULL DEFAULT 0,
  doctor_id            INT UNSIGNED    NOT NULL DEFAULT 0,
  branch_id            INT UNSIGNED    NOT NULL DEFAULT 1,
  chief_complaint      TEXT,
  examination_findings TEXT,
  diagnosis            TEXT,
  treatment_plan       TEXT,
  next_visit_date      DATE,
  created_at           DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                         ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_patient (patient_id),
  INDEX idx_appt    (appointment_id),
  INDEX idx_doctor  (doctor_id),
  INDEX idx_date    (created_at),
  FOREIGN KEY fk_mr_patient (patient_id)
    REFERENCES patients(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medical_record_prescriptions (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  record_id      BIGINT UNSIGNED NOT NULL,
  drug_name      VARCHAR(200)    NOT NULL,
  times_per_day  TINYINT         NOT NULL DEFAULT 1,
  duration_days  SMALLINT        NOT NULL DEFAULT 0,
  timing         ENUM('before_meal','after_meal','any')
                                 NOT NULL DEFAULT 'any',
  schedule       ENUM('morning','evening','morning_evening',
                       'every_x_hours','continuous','as_needed')
                                 NOT NULL DEFAULT 'morning',
  interval_hours TINYINT         NOT NULL DEFAULT 0,
  dose           VARCHAR(100)    NOT NULL DEFAULT '',
  notes          TEXT,
  INDEX idx_record (record_id),
  FOREIGN KEY fk_mrp_record (record_id)
    REFERENCES medical_records(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medical_record_labs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  record_id   BIGINT UNSIGNED NOT NULL,
  type        ENUM('lab','radiology','other') NOT NULL DEFAULT 'lab',
  name        VARCHAR(200)    NOT NULL,
  result      TEXT,
  template_id INT UNSIGNED    NOT NULL DEFAULT 0,
  INDEX idx_record (record_id),
  FOREIGN KEY fk_mrl_record (record_id)
    REFERENCES medical_records(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lab_templates (
  id        INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT UNSIGNED    NOT NULL DEFAULT 0,
  branch_id INT UNSIGNED    NOT NULL DEFAULT 1,
  name      VARCHAR(200)    NOT NULL,
  items     JSON,
  INDEX idx_doctor (doctor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medical_record_images (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  record_id        BIGINT UNSIGNED NOT NULL,
  file_path        VARCHAR(500)    NOT NULL,
  body_chart_base  VARCHAR(300)    NOT NULL DEFAULT '',
  drawing_data     JSON,
  notes            TEXT,
  uploaded_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_record (record_id),
  FOREIGN KEY fk_mri_record (record_id)
    REFERENCES medical_records(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
--  16. DOCTOR DICTIONARIES (القاموس الذكي)
-- ================================================================
CREATE TABLE IF NOT EXISTS doctor_dictionaries (
  id        INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT UNSIGNED    NOT NULL,
  branch_id INT UNSIGNED    NOT NULL DEFAULT 1,
  type      ENUM('complaint','finding','diagnosis','drug')
                            NOT NULL DEFAULT 'complaint',
  term      VARCHAR(300)    NOT NULL,
  use_count INT UNSIGNED    NOT NULL DEFAULT 1,
  INDEX idx_doctor (doctor_id),
  INDEX idx_type   (type),
  FULLTEXT idx_ft_term (term)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
--  17. PRESCRIPTION TEMPLATES (قوالب الروشتة)
-- ================================================================
CREATE TABLE IF NOT EXISTS prescription_templates (
  id           INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY,
  doctor_id    INT UNSIGNED    NOT NULL,
  branch_id    INT UNSIGNED    NOT NULL DEFAULT 1,
  paper_width  SMALLINT        NOT NULL DEFAULT 210,
  paper_height SMALLINT        NOT NULL DEFAULT 297,
  elements     JSON,
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                 ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_doctor (doctor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
--  18. PRINT LOG (سجل الطباعة)
-- ================================================================
CREATE TABLE IF NOT EXISTS print_log (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  type         ENUM('prescription','receipt','report','other')
                               NOT NULL DEFAULT 'receipt',
  ref_id       BIGINT UNSIGNED NOT NULL DEFAULT 0,
  patient_id   BIGINT UNSIGNED NOT NULL DEFAULT 0,
  branch_id    INT UNSIGNED    NOT NULL DEFAULT 1,
  printed_by   INT UNSIGNED    NOT NULL DEFAULT 0,
  printed_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_branch  (branch_id),
  INDEX idx_date    (printed_at),
  INDEX idx_patient (patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
--  19. KV_STORE (للإعدادات فقط)
-- ================================================================
CREATE TABLE IF NOT EXISTS kv_store (
  k          VARCHAR(100)    NOT NULL PRIMARY KEY,
  v          LONGTEXT        NOT NULL,
  updated_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
               ON UPDATE CURRENT_TIMESTAMP(3),
  version    BIGINT UNSIGNED NOT NULL DEFAULT 1,
  INDEX idx_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
--  20. LOCKING & PRESENCE (بدون تغيير)
-- ================================================================
CREATE TABLE IF NOT EXISTS record_locks (
  lock_type  VARCHAR(50)     NOT NULL,
  lock_id    BIGINT UNSIGNED NOT NULL,
  device_id  VARCHAR(100)    NOT NULL,
  user_name  VARCHAR(200)    NOT NULL,
  user_id    INT             NOT NULL DEFAULT 0,
  label      VARCHAR(300)    NOT NULL DEFAULT '',
  locked_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3)     NOT NULL,
  PRIMARY KEY (lock_type, lock_id),
  INDEX idx_expires (expires_at),
  INDEX idx_device  (device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lock_releases (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lock_type   VARCHAR(50)     NOT NULL,
  lock_id     BIGINT UNSIGNED NOT NULL,
  label       VARCHAR(300)    NOT NULL DEFAULT '',
  released_by VARCHAR(100)    NOT NULL,
  released_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_released (released_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lock_viewers (
  lock_type  VARCHAR(50)     NOT NULL,
  lock_id    BIGINT UNSIGNED NOT NULL,
  device_id  VARCHAR(100)    NOT NULL,
  user_name  VARCHAR(200)    NOT NULL,
  last_seen  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
               ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (lock_type, lock_id, device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_presence (
  device_id  VARCHAR(100)    NOT NULL PRIMARY KEY,
  user_id    INT             NOT NULL DEFAULT 0,
  user_name  VARCHAR(200)    NOT NULL,
  role       VARCHAR(50)     NOT NULL DEFAULT '',
  branch_id  INT UNSIGNED    NOT NULL DEFAULT 1,
  last_seen  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
               ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_last_seen (last_seen),
  INDEX idx_user_id   (user_id),
  INDEX idx_branch    (branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  action            VARCHAR(200)    NOT NULL,
  entity_type       VARCHAR(50)     NOT NULL DEFAULT '',
  entity_id         BIGINT UNSIGNED NOT NULL DEFAULT 0,
  detail            TEXT,
  performed_by      INT UNSIGNED    NOT NULL DEFAULT 0,
  performed_by_name VARCHAR(200)    NOT NULL DEFAULT '',
  branch_id         INT UNSIGNED    NOT NULL DEFAULT 0,
  ip_address        VARCHAR(45)     NOT NULL DEFAULT '',
  created_at        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_created  (created_at),
  INDEX idx_performer(performed_by),
  INDEX idx_entity   (entity_type, entity_id),
  INDEX idx_branch   (branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
--  SEED DATA
-- ================================================================

-- فرع افتراضي
INSERT IGNORE INTO branches (id, name, address) VALUES
  (1, 'الفرع الرئيسي', '');

-- أكواد دول شائعة
INSERT IGNORE INTO country_codes (name, code, phone_length, flag) VALUES
  ('مصر',         '+20',  10, '🇪🇬'),
  ('السعودية',    '+966',  9, '🇸🇦'),
  ('الإمارات',    '+971',  9, '🇦🇪'),
  ('الكويت',      '+965',  8, '🇰🇼'),
  ('قطر',         '+974',  8, '🇶🇦'),
  ('البحرين',     '+973',  8, '🇧🇭'),
  ('عُمان',       '+968',  8, '🇴🇲'),
  ('الأردن',      '+962',  9, '🇯🇴'),
  ('لبنان',       '+961',  8, '🇱🇧'),
  ('ليبيا',       '+218', 10, '🇱🇾'),
  ('تونس',        '+216',  8, '🇹🇳'),
  ('المغرب',      '+212',  9, '🇲🇦'),
  ('الجزائر',     '+213',  9, '🇩🇿'),
  ('السودان',     '+249',  9, '🇸🇩');

-- تخصصات افتراضية
INSERT IGNORE INTO specializations (id, name) VALUES
  (1, 'عام'),
  (2, 'جلدية'),
  (3, 'أسنان'),
  (4, 'عظام'),
  (5, 'قلب'),
  (6, 'نساء وتوليد'),
  (7, 'أطفال'),
  (8, 'عيون'),
  (9, 'أنف وأذن وحنجرة'),
  (10, 'طب طبيعي وتأهيل');

-- صلاحيات النظام
INSERT IGNORE INTO permissions (perm_key, label, category) VALUES
  -- المواعيد
  ('appointments.create',       'إضافة موعد',              'المواعيد'),
  ('appointments.edit',         'تعديل موعد',              'المواعيد'),
  ('appointments.delete',       'حذف موعد',                'المواعيد'),
  ('appointments.view_all',     'عرض كل المواعيد',         'المواعيد'),
  ('appointments.view_own',     'عرض مواعيدي فقط',         'المواعيد'),
  ('appointments.refund',       'استرداد مبلغ',            'المواعيد'),
  ('appointments.add_service',  'إضافة خدمة للموعد',       'المواعيد'),
  -- المرضى
  ('patients.create',           'إضافة مريض',              'المرضى'),
  ('patients.edit',             'تعديل بيانات مريض',       'المرضى'),
  ('patients.delete',           'حذف مريض',                'المرضى'),
  ('patients.view_financial',   'عرض الرصيد المالي',       'المرضى'),
  -- الخدمات
  ('services.create',           'إضافة خدمة',              'الخدمات'),
  ('services.edit',             'تعديل خدمة',              'الخدمات'),
  ('services.delete',           'حذف خدمة',                'الخدمات'),
  ('services.set_own',          'إضافة خدماتي الخاصة',     'الخدمات'),
  -- الباقات
  ('packages.create',           'إضافة باقة',              'الباقات'),
  ('packages.edit',             'تعديل باقة',              'الباقات'),
  ('packages.deduct_session',   'خصم جلسة من باقة',        'الباقات'),
  ('packages.skip_session',     'تخطي جلسة بدون خصم',      'الباقات'),
  ('packages.set_installments', 'تقسيط دفع الباقة',        'الباقات'),
  -- التقارير
  ('reports.shift_own',         'تقرير شيفتي',             'التقارير'),
  ('reports.shift_all',         'كل الشيفتات',             'التقارير'),
  ('reports.financial_daily',   'تقرير يومي',              'التقارير'),
  ('reports.financial_monthly', 'تقرير شهري',              'التقارير'),
  ('reports.financial_yearly',  'تقرير سنوي',              'التقارير'),
  ('reports.doctor_commission', 'عمولات الأطباء',          'التقارير'),
  ('reports.patient_source',    'مصادر المرضى',            'التقارير'),
  ('reports.audit_log',         'سجل العمليات',            'التقارير'),
  ('reports.print_log',         'سجل الطباعة',             'التقارير'),
  -- الإعدادات
  ('settings.clinic',           'إعدادات العيادة',         'الإعدادات'),
  ('settings.users',            'إدارة المستخدمين',        'الإعدادات'),
  ('settings.specializations',  'إدارة التخصصات',          'الإعدادات'),
  ('settings.prescription',     'قالب الروشتة',            'الإعدادات'),
  ('settings.branches',         'إدارة الفروع',            'الإعدادات'),
  -- الخزنة
  ('treasury.view',             'عرض الخزنة',              'الخزنة'),
  ('treasury.add_expense',      'إضافة مصروف',             'الخزنة'),
  ('treasury.view_all_branches','خزنة كل الفروع',          'الخزنة'),
  -- الشيفتات
  ('shifts.open_close',         'فتح/إغلاق شيفت',          'الشيفتات'),
  ('shifts.view_own',           'عرض شيفتي',               'الشيفتات'),
  ('shifts.view_all',           'عرض كل الشيفتات',         'الشيفتات'),
  -- السجل الطبي
  ('medical.view',              'عرض السجل الطبي',         'السجل الطبي'),
  ('medical.edit',              'تعديل السجل الطبي',       'السجل الطبي'),
  ('medical.images',            'رفع صور الزيارة',         'السجل الطبي');

-- مصادر مرضى افتراضية
INSERT IGNORE INTO patient_sources (id, name, branch_id, is_permanent) VALUES
  (1, 'إعلان سوشيال ميديا', 0, 1),
  (2, 'توصية من مريض',       0, 1),
  (3, 'بحث جوجل',            0, 1),
  (4, 'بانر خارجي',          0, 1),
  (5, 'مجهول',               0, 1);

-- خدمات افتراضية للفرع الأول
INSERT IGNORE INTO services (id, name, price, doctor_id, branch_id, active) VALUES
  (1, 'كشف عام',    200, 0, 1, 1),
  (2, 'استشارة',    150, 0, 1, 1),
  (3, 'متابعة',     100, 0, 1, 1),
  (4, 'جلسة علاج',  300, 0, 1, 1);

-- إعدادات النظام
INSERT IGNORE INTO kv_store (k, v) VALUES
  ('clinicName',  '"عيادة النيل"'),
  ('clinicTheme', '"green"'),
  ('defaultCountryCode', '"+20"'),
  ('settings', '{"backupEnabled":false,"backupIntervalHours":1,"backupPath":"","defaultBranchId":1}');

