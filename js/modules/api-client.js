/* ============================================================
   API CLIENT v8 — كل calls للـ backend هنا
   ============================================================ */

let _currentUser = null;
let _currentBranch = 1;

function setCurrentUser(user) { _currentUser = user; }
function setCurrentBranch(branchId) { _currentBranch = branchId; }

async function apiV8(action, data = {}, method = 'POST') {
  const headers = {
    'Content-Type':  'application/json',
    'X-Clinic-Key':  CLINIC_CONFIG.API_KEY,
    'X-Branch-Id':   String(_currentBranch),
    'X-User-Id':     String(_currentUser?.id || 0),
  };
  try {
    const res = await fetch(
      `${CLINIC_CONFIG.API_URL}?action=${action}`,
      { method, headers, body: JSON.stringify({ ...data, action }) }
    );
    const json = await res.json();
    if (!res.ok && !json.ok) {
      showToast(`⛔ ${json.error || 'خطأ في الاتصال'}`, 'danger');
      return null;
    }
    return json;
  } catch (e) {
    showToast('⛔ لا يوجد اتصال بالسيرفر', 'danger');
    return null;
  }
}

// ── Patients ──────────────────────────────────────────────────────
const PatientsAPI = {
  list:   (params = {}) => apiV8('patients.list',   params),
  search: (q)           => apiV8('patients.search',  { q }),
  get:    (id)          => apiV8('patients.get',     { id }),
  save:   (data)        => apiV8('patients.save',    data),
  delete: (id)          => apiV8('patients.delete',  { id }),
};

// ── Appointments ─────────────────────────────────────────────────
const AppointmentsAPI = {
  list:          (params)       => apiV8('appointments.list',           params),
  get:           (id)           => apiV8('appointments.get',            { id }),
  save:          (data)         => apiV8('appointments.save',           data),
  updateStatus:  (id, status, extra = {}) => apiV8('appointments.update_status', { id, status, ...extra }),
  addService:    (data)         => apiV8('appointments.add_service',    data),
  refund:        (id, amount, reason) => apiV8('appointments.refund',   { id, amount, reason }),
};

// ── Services ─────────────────────────────────────────────────────
const ServicesAPI = {
  list:   (doctorId = 0) => apiV8('services.list',   { doctor_id: doctorId }),
  save:   (data)         => apiV8('services.save',   data),
  delete: (id)           => apiV8('services.delete', { id }),
};

// ── Packages ─────────────────────────────────────────────────────
const PackagesAPI = {
  list:            ()       => apiV8('packages.list',            {}),
  save:            (data)   => apiV8('packages.save',            data),
  delete:          (id)     => apiV8('packages.delete',          { id }),
  subscribe:       (data)   => apiV8('packages.subscribe',       data),
  deduct:          (data)   => apiV8('packages.deduct',          data),
  skip:            (data)   => apiV8('packages.skip',            data),
  patientPackages: (patientId) => apiV8('packages.patient_packages', { patient_id: patientId }),
};

// ── Medical Records ───────────────────────────────────────────────
const MedicalAPI = {
  get:              (appointmentId) => apiV8('medical.get',               { appointment_id: appointmentId }),
  save:             (data)          => apiV8('medical.save',              data),
  history:          (patientId)     => apiV8('medical.history',           { patient_id: patientId }),
  dictSearch:       (type, q)       => apiV8('medical.dictionary_search', { type, q }),
  dictSave:         (type, term)    => apiV8('medical.dictionary_save',   { type, term }),
};

// ── Users ─────────────────────────────────────────────────────────
const UsersAPI = {
  list:           (branchId = 0) => apiV8('users.list',               { branch_id: branchId }),
  save:           (data)         => apiV8('users.save',               data),
  delete:         (id)           => apiV8('users.delete',             { id }),
  getPermissions: (userId)       => apiV8('users.permissions.get',    { user_id: userId }),
  setPermissions: (userId, permissions) => apiV8('users.permissions.set', { user_id: userId, permissions }),
  changePassword: (data)         => apiV8('change_password',          data),
};

// ── Branches ──────────────────────────────────────────────────────
const BranchesAPI = {
  list: () => apiV8('branches.list', {}),
  save: (data) => apiV8('branches.save', data),
};

// ── Shifts ───────────────────────────────────────────────────────
const ShiftsAPI = {
  open:       ()        => apiV8('shifts.open',       {}),
  close:      (shiftId) => apiV8('shifts.close',      { shift_id: shiftId }),
  current:    ()        => apiV8('shifts.current',    {}),
  list:       (date)    => apiV8('shifts.list',       { date }),
  addExpense: (data)    => apiV8('shifts.add_expense', data),
};

// ── Reports ───────────────────────────────────────────────────────
const ReportsAPI = {
  daily:            (date, allBranches = false)  => apiV8('reports.daily',             { date, all_branches: allBranches }),
  doctorCommission: (from, to)                   => apiV8('reports.doctor_commission', { from, to }),
  patientSource:    (from, to)                   => apiV8('reports.patient_source',    { from, to }),
  treasury:         (from, to, allBranches)      => apiV8('treasury.summary',          { from, to, all_branches: allBranches }),
  addExpense:       (data)                       => apiV8('treasury.add_expense',      data),
};

// ── Ledger ────────────────────────────────────────────────────────
const LedgerAPI = {
  patient: (patientId) => apiV8('ledger.patient', { patient_id: patientId }),
  summary: (from, to)  => apiV8('ledger.summary', { from, to }),
};

// ── Settings ─────────────────────────────────────────────────────
const SettingsAPI = {
  get:              ()     => apiV8('settings.get',              {}),
  save:             (data) => apiV8('settings.save',             data),
  specializations:  ()     => apiV8('settings.specializations',  {}),
  patientSources:   ()     => apiV8('settings.patient_sources',  {}),
  addSource:        (name, isPermanent) => apiV8('settings.patient_sources', { name, is_permanent: isPermanent }),
  countryCodes:     ()     => apiV8('settings.country_codes',    {}),
};

// ── Prescriptions ─────────────────────────────────────────────────
const PrescriptionsAPI = {
  getTemplate:  ()     => apiV8('prescription.get_template',  {}),
  saveTemplate: (data) => apiV8('prescription.save_template', data),
  logPrint:     (recordId, patientId) => apiV8('prescription.print', { record_id: recordId, patient_id: patientId }),
};

// ── Audit ─────────────────────────────────────────────────────────
const AuditAPI = {
  list: (from, to, limit = 100) => apiV8('audit.list', { from, to, limit }),
};
