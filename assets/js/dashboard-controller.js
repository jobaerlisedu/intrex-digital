// assets/js/dashboard-controller.js
import {
  loginAdmin, logoutAdmin, onAdminAuthStateChanged,
  addProject, getAllProjects, deleteProject,
  addContact, getAllContacts, deleteContact,
  addMeeting, getAllMeetings, deleteMeeting,
  addBudget, getAllBudgets, deleteBudget,
  addTask, getAllTasks, deleteTask,
  addRequisition, getAllRequisitions, deleteRequisition,
  addPurchaseOrder, getAllPurchaseOrders, deletePurchaseOrder,
  addExpense, getAllExpenses, deleteExpense,
  addEmployee, getAllEmployees, deleteEmployee,
  addSupportTicket, getAllSupportTickets, deleteSupportTicket,
  addClientPayment, getAllClientPayments, deleteClientPayment,
  addDomainHosting, getAllDomainHosting, deleteDomainHosting,
  addAuditLog, getAllAuditLogs,
  addCertificate, getAllCertificates, deleteCertificate,
  addRegistration, getAllRegistrations, updateRegistration, deleteRegistration,
  getAllPayments, updatePayment
} from "./firebase-service.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// GLOBAL ERROR HANDLING BOUNDARY
// ==========================================
function logErrorToFirestore(errorMsg, url, line, col, errorObj, type = "error") {
  try {
    const fDb = window.db;
    if (!fDb) {
      console.error("Firestore db not initialized for error logging:", errorMsg);
      return;
    }
    const errorsCol = collection(fDb, "tbl_system_errors");
    addDoc(errorsCol, {
      message: errorMsg || "Unknown error",
      url: url || window.location.href,
      line: Number(line) || 0,
      column: Number(col) || 0,
      stack: errorObj && errorObj.stack ? errorObj.stack : "N/A",
      type: type,
      user_email: (typeof currentUserEmail !== "undefined" && currentUserEmail) || "anonymous",
      timestamp: serverTimestamp()
    }).catch(err => console.error("Failed to write error to Firestore:", err));
  } catch (err) {
    console.error("Failed to execute logErrorToFirestore:", err);
  }
}

window.onerror = function (message, source, lineno, colno, error) {
  logErrorToFirestore(message, source, lineno, colno, error, "exception");
  return false;
};

window.addEventListener("unhandledrejection", function (event) {
  const reason = event.reason;
  const msg = reason && reason.message ? reason.message : String(reason);
  logErrorToFirestore(msg, window.location.href, 0, 0, reason, "unhandled_rejection");
});

// ==========================================
// STATE MANAGEMENT & VARIABLES
// ==========================================
let allProjects = [];
let allContacts = [];
let allMeetings = [];
let allBudgets = [];
let allTasks = [];
let allRequisitions = [];
let allPurchaseOrders = [];
let allExpenses = [];
let allEmployees = [];
let allSupportTickets = [];
let allClientPayments = [];
let allDomainHosting = [];
let allAuditLogs = [];

let allRecords = []; // Issued certificates
let allRegistrations = []; // Student list
let allPayments = []; // Course payments

let editingStudentId = null;
let editingCertId = null;
let currentUserEmail = "";
window.currentUserEmail = "";

// Course fees map
const courseFees = {
  "CompTIA A+": 8000,
  "CompTIA Network+": 8000,
  "CCNA 200-301": 12000,
  "MTCNA & MTCRE (MikroTik)": 10000,
  "RHCSA / RHCE (Red Hat Linux)": 12000,
  "CompTIA Security+": 12000
};

// Date range defaults
const today = new Date();
const todayDateStr = today.toISOString().substring(0, 10);

// Print scale charts variables
let chartProjectStatusInstance = null;
let chartBudgetVsExpenseInstance = null;
let chartRequisitionLifecycleInstance = null;
let chartResourceAllocationInstance = null;
let chartMonthlyFinanceInstance = null;

let chartPaymentStatusInstance = null;
let chartCourseEnrollmentInstance = null;
let chartRevenueByCourseInstance = null;
let chartRegTrendsInstance = null;
let chartPaymentFunnelInstance = null;
let chartCertVelocityInstance = null;

// ==========================================
// DYNAMIC DROPDOWNS & AUTOFILL
// ==========================================
function populateProjectDropdowns() {
  const pSelects = ["task_project_id", "meeting_project_id", "budget_project_id", "req_project_id", "po_project_id", "exp_project_id", "inv_project_id", "ticket_project_id", "hosting_project_id", "report_project_id", "filterProject"];
  const options = allProjects.map(p => `<option value="${p.project_id}">${p.project_name} (${p.project_id})</option>`).join('');
  pSelects.forEach(id => {
    const select = document.getElementById(id);
    if (select) {
      const currentVal = select.value;
      const isFilter = id === "filterProject";
      select.innerHTML = (isFilter ? '<option value="all">All Projects</option>' : '<option value="" disabled selected>Select Project</option>') + options;
      if (currentVal) select.value = currentVal;
    }
  });
}

function populateContactSelects() {
  const cSelects = ["meeting_attendees_list", "ticket_requester_id", "ticket_assigned_to", "task_assigned_to"];
  const listMarkup = allContacts.map(c => `<option value="${c.email || c.contact_id}">${c.contact_name} - ${c.organization || 'Contact'} (${c.email || c.contact_id})</option>`).join('');
  cSelects.forEach(id => {
    const select = document.getElementById(id);
    if (select) {
      select.innerHTML = listMarkup;
    }
  });
}

function populatePMDropdown() {
  const pmSelect = document.getElementById("project_manager");
  if (pmSelect) {
    const currentVal = pmSelect.value;
    const options = allEmployees.map(e => `<option value="${e.employee_id}">${e.employee_name} (${e.employee_id})</option>`).join('');
    pmSelect.innerHTML = '<option value="" disabled selected>Select Project Manager</option>' + options;
    if (currentVal) pmSelect.value = currentVal;
  }
}

function populateClientSponsorDropdown() {
  const clientSelect = document.getElementById("client_sponsor");
  if (clientSelect) {
    const currentVal = clientSelect.value;
    const options = allContacts.map(c => `<option value="${c.contact_id}">${c.contact_name} - ${c.organization} (${c.contact_id})</option>`).join('');
    clientSelect.innerHTML = '<option value="" disabled selected>Select Client Sponsor</option>' + options;
    if (currentVal) clientSelect.value = currentVal;
  }
}

function populateRequisitionDropdowns() {
  const reqSelect = document.getElementById("po_requisition_id");
  if (reqSelect) {
    const currentVal = reqSelect.value;
    const options = allRequisitions
      .filter(r => r.dept_approval === "Approved" || r.dept_approval === "Pending Review")
      .map(r => `<option value="${r.requisition_id}" data-project="${r.project_id}" data-total="${r.est_total_cost}">${r.requisition_id} - ${r.item_description} (${r.est_total_cost} BDT)</option>`).join('');
    reqSelect.innerHTML = '<option value="" disabled selected>Select Requisition</option>' + options;
    if (currentVal) reqSelect.value = currentVal;
  }
}

function populatePODropdowns() {
  const poSelect = document.getElementById("exp_po_number_ref");
  if (poSelect) {
    const currentVal = poSelect.value;
    const options = allPurchaseOrders.map(po => `<option value="${po.po_number}" data-project="${po.project_id}" data-total="${po.final_po_total}">${po.po_number} - ${po.vendor_name} (${po.final_po_total} BDT)</option>`).join('');
    poSelect.innerHTML = '<option value="" disabled selected>Select Purchase Order</option>' + options;
    if (currentVal) poSelect.value = currentVal;
  }
}

function populateEmployeeImportDropdown() {
  const empSelect = document.getElementById("task_assigned_to_emp");
  if (empSelect) {
    const currentVal = empSelect.value;
    const options = allEmployees.map(e => `<option value="${e.employee_id}">${e.employee_name} (${e.employee_id})</option>`).join('');
    empSelect.innerHTML = '<option value="" disabled selected>Select Employee</option>' + options;
    if (currentVal) empSelect.value = currentVal;
  }
}

function populateTicketDropdowns() {
  const requesterSelect = document.getElementById("ticket_requester_id");
  const assignedSelect = document.getElementById("ticket_assigned_to");
  if (requesterSelect && assignedSelect) {
    const reqOptions = allEmployees.map(e => `<option value="${e.employee_id}">${e.employee_name} (Employee - ${e.employee_id})</option>`).join('');
    const conOptions = allContacts.map(c => `<option value="${c.contact_id}">${c.contact_name} (Client - ${c.contact_id})</option>`).join('');
    
    requesterSelect.innerHTML = '<option value="" disabled selected>Select Requester</option>' + reqOptions + conOptions;
    assignedSelect.innerHTML = '<option value="" disabled selected>Select Assigned Engineer/PM</option>' + reqOptions;
  }
}

function populateTicketAssetDropdown() {
  const assetSelect = document.getElementById("ticket_asset_id");
  if (assetSelect) {
    const currentVal = assetSelect.value;
    const options = allDomainHosting.map(a => `<option value="${a.asset_id}">${a.asset_url} (${a.asset_id})</option>`).join('');
    assetSelect.innerHTML = '<option value="">None / Not Applicable</option>' + options;
    if (currentVal) assetSelect.value = currentVal;
  }
}

// ==========================================
// DATA LOADING SERVICES
// ==========================================
async function loadAllData() {
  try {
    const results = await Promise.all([
      getAllProjects(),
      getAllContacts(),
      getAllMeetings(),
      getAllBudgets(),
      getAllTasks(),
      getAllRequisitions(),
      getAllPurchaseOrders(),
      getAllExpenses(),
      getAllEmployees(),
      getAllSupportTickets(),
      getAllClientPayments(),
      getAllDomainHosting(),
      getAllAuditLogs(),
      getAllCertificates(),
      getAllRegistrations(),
      getAllPayments()
    ]);
    
    allProjects = results[0];
    allContacts = results[1];
    allMeetings = results[2];
    allBudgets = results[3];
    allTasks = results[4];
    allRequisitions = results[5];
    allPurchaseOrders = results[6];
    allExpenses = results[7];
    allEmployees = results[8];
    allSupportTickets = results[9];
    allClientPayments = results[10];
    allDomainHosting = results[11];
    allAuditLogs = results[12];
    allRecords = results[13];
    allRegistrations = results[14];
    allPayments = results[15];

    // Populate dynamic widgets
    populateProjectDropdowns();
    populateContactSelects();
    populatePMDropdown();
    populateClientSponsorDropdown();
    populateRequisitionDropdowns();
    populatePODropdowns();
    populateEmployeeImportDropdown();
    populateTicketDropdowns();
    populateTicketAssetDropdown();

    // Render lists
    renderProjects();
    renderContacts();
    renderEmployees();
    renderMeetings();
    renderBudgets();
    renderTasks();
    renderRequisitions();
    renderPurchaseOrders();
    renderExpenses();
    renderClientPayments();
    renderSupportTickets();
    renderDomainHosting();
    renderAuditLogs();

    // Render training panels
    renderFilteredRecords();
    renderFilteredRegistrations();
    renderFilteredPayments();

    // Render charts
    updateOverview();
  } catch (err) {
    console.error("Data load failed: ", err);
  }
}

// Inactivity Auto-logout (3 minutes)
const INACTIVITY_TIMEOUT_MS = 3 * 60 * 1000;
let inactivityTimer = null;

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(async () => {
    const emailBeforeLogout = currentUserEmail || "admin@example.com";
    try {
      await addAuditLog({
        user_email: emailBeforeLogout,
        action_type: "SECURITY",
        collection_name: "N/A",
        record_id: "N/A",
        details: "Automatic logout due to 3 minutes of inactivity"
      });
      await logoutAdmin();
    } catch (err) {
      console.error("Inactivity logout failed: ", err);
    }
  }, INACTIVITY_TIMEOUT_MS);
}

// Debounce/Throttle global event listeners to optimize performance
function throttle(func, delay) {
  let prev = 0;
  return function (...args) {
    let now = new Date().getTime();
    if (now - prev >= delay) {
      prev = now;
      func.apply(this, args);
    }
  };
}

const throttledResetTimer = throttle(resetInactivityTimer, 1000);
["mousemove", "keydown", "click", "touchstart", "scroll"].forEach(event => {
  window.addEventListener(event, throttledResetTimer);
});

// ==========================================
// REFRESH SHORTCUTS FOR LOGS/LISTS
// ==========================================
async function refreshProjects() { allProjects = await getAllProjects(); populateProjectDropdowns(); renderProjects(); }
async function refreshContacts() { allContacts = await getAllContacts(); populateContactSelects(); populateClientSponsorDropdown(); renderContacts(); }
async function refreshEmployees() { allEmployees = await getAllEmployees(); populatePMDropdown(); populateEmployeeImportDropdown(); populateTicketDropdowns(); renderEmployees(); }
async function refreshMeetings() { allMeetings = await getAllMeetings(); renderMeetings(); }
async function refreshBudgets() { allBudgets = await getAllBudgets(); renderBudgets(); }
async function refreshTasks() { allTasks = await getAllTasks(); renderTasks(); }
async function refreshRequisitions() { allRequisitions = await getAllRequisitions(); populateRequisitionDropdowns(); renderRequisitions(); }
async function refreshPurchases() { allPurchaseOrders = await getAllPurchaseOrders(); populatePODropdowns(); renderPurchaseOrders(); }
async function refreshExpenses() { allExpenses = await getAllExpenses(); renderExpenses(); }
async function refreshPayments() { allClientPayments = await getAllClientPayments(); renderClientPayments(); }
async function refreshTickets() { allSupportTickets = await getAllSupportTickets(); renderSupportTickets(); }
async function refreshHosting() { allDomainHosting = await getAllDomainHosting(); populateTicketAssetDropdown(); renderDomainHosting(); }
async function refreshAuditLogs() { allAuditLogs = await getAllAuditLogs(); renderAuditLogs(); }

async function loadRecords() { allRecords = await getAllCertificates(); renderFilteredRecords(); updateOverview(); }
async function loadRegistrations() { allRegistrations = await getAllRegistrations(); renderFilteredRegistrations(); updateOverview(); }
async function loadPayments() { allPayments = await getAllPayments(); renderFilteredPayments(); updateOverview(); }

// ==========================================
// RENDER FUNCTIONS (TABLE DATA RENDERING)
// ==========================================
function renderProjects() {
  const tbody = document.getElementById("projectsTableBody");
  if (!tbody) return;
  if (allProjects.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-3 text-muted">No projects found.</td></tr>';
    return;
  }
  tbody.innerHTML = allProjects.map(p => {
    const pm = allEmployees.find(e => e.employee_id === p.project_manager) || allContacts.find(c => c.contact_id === p.project_manager);
    const clientContact = allContacts.find(c => c.contact_id === p.client_sponsor);
    const clientName = clientContact ? clientContact.contact_name : p.client_sponsor;
    return `
      <tr>
        <td><code class="text-dark fw-bold font-monospace">${p.project_id}</code></td>
        <td><strong>${p.project_name}</strong></td>
        <td>${clientName}</td>
        <td>${pm ? (pm.employee_name || pm.contact_name) : 'Unknown Manager'}</td>
        <td><span class="small">${p.start_date} to ${p.end_date}</span></td>
        <td><span class="badge bg-secondary text-dark">${p.project_status}</span></td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-success view-proj-btn me-1" data-id="${p.project_id}"><i class="bi bi-eye"></i></button>
          <button class="btn btn-sm btn-outline-primary edit-proj-btn me-1" data-id="${p.project_id}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger delete-proj-btn" data-id="${p.project_id}"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll(".view-proj-btn").forEach(btn => btn.onclick = () => showRecordDetails("project", btn.dataset.id));
  document.querySelectorAll(".edit-proj-btn").forEach(btn => {
    btn.onclick = () => {
      const p = allProjects.find(proj => proj.project_id === btn.dataset.id);
      if (p) {
        document.getElementById("project_id").value = p.project_id;
        document.getElementById("project_id").readOnly = true;
        document.getElementById("project_name").value = p.project_name;
        document.getElementById("client_sponsor").value = p.client_sponsor || "";
        document.getElementById("project_manager").value = p.project_manager || "";
        document.getElementById("start_date").value = p.start_date;
        document.getElementById("end_date").value = p.end_date;
        document.getElementById("project_status").value = p.project_status;
        document.getElementById("project_desc").value = p.project_desc || "";
        document.getElementById("projFormTitle").innerHTML = '<i class="bi bi-kanban me-2 text-primary"></i>Edit Project';
        document.getElementById("projSubmitBtn").innerHTML = '<i class="bi bi-pencil-square me-2"></i>Update Project';
        document.getElementById("cancelProjEditBtn").classList.remove("d-none");
        document.getElementById("projectForm").scrollIntoView({ behavior: 'smooth' });
      }
    };
  });
  document.querySelectorAll(".delete-proj-btn").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (confirm(`Delete project ${id}?`)) {
        try {
          await deleteProject(id);
          await addAuditLog({
            user_email: currentUserEmail || "admin@example.com",
            action_type: "DELETE",
            collection_name: "tbl_projects",
            record_id: id,
            details: `Deleted project with ID: ${id}`
          });
          refreshProjects();
          refreshAuditLogs();
        } catch (err) {
          alert("Failed to delete project: " + err.message);
        }
      }
    };
  });
}

function renderContacts() {
  const tbody = document.getElementById("contactsTableBody");
  if (!tbody) return;
  if (allContacts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-3 text-muted">No contacts found.</td></tr>';
    return;
  }
  tbody.innerHTML = allContacts.map(c => `
    <tr>
      <td><code class="text-dark fw-bold font-monospace">${c.contact_id}</code></td>
      <td><strong>${c.contact_name}</strong></td>
      <td>${c.designation} <span class="text-muted">(${c.organization})</span></td>
      <td><span class="small font-monospace">${c.mobile_phone}</span></td>
      <td><a href="mailto:${c.email}" class="text-decoration-none small fw-semibold">${c.email}</a></td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-success view-con-btn me-1" data-id="${c.contact_id}"><i class="bi bi-eye"></i></button>
        <button class="btn btn-sm btn-outline-primary edit-con-btn me-1" data-id="${c.contact_id}"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger delete-con-btn" data-id="${c.contact_id}"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll(".view-con-btn").forEach(btn => btn.onclick = () => showRecordDetails("contact", btn.dataset.id));
  document.querySelectorAll(".edit-con-btn").forEach(btn => {
    btn.onclick = () => {
      const c = allContacts.find(con => con.contact_id === btn.dataset.id);
      if (c) {
        document.getElementById("contact_id").value = c.contact_id;
        document.getElementById("contact_id").readOnly = true;
        document.getElementById("contact_project_id").value = c.project_id || "";
        document.getElementById("contact_name").value = c.contact_name;
        document.getElementById("contact_designation").value = c.designation;
        document.getElementById("contact_organization").value = c.organization;
        document.getElementById("contact_mobile_phone").value = c.mobile_phone || "";
        document.getElementById("contact_email").value = c.email || "";
        document.getElementById("conFormTitle").innerHTML = '<i class="bi bi-telephone-inbound me-2 text-primary"></i>Edit Contact';
        document.getElementById("conSubmitBtn").innerHTML = '<i class="bi bi-pencil-square me-2"></i>Update Contact';
        document.getElementById("cancelConEditBtn").classList.remove("d-none");
        document.getElementById("contactForm").scrollIntoView({ behavior: 'smooth' });
      }
    };
  });
  document.querySelectorAll(".delete-con-btn").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (confirm(`Delete contact ${id}?`)) {
        try {
          await deleteContact(id);
          await addAuditLog({
            user_email: currentUserEmail || "admin@example.com",
            action_type: "DELETE",
            collection_name: "tbl_contacts",
            record_id: id,
            details: `Deleted contact registry record: ${id}`
          });
          refreshContacts();
          refreshAuditLogs();
        } catch (err) {
          alert("Failed to delete contact: " + err.message);
        }
      }
    };
  });
}

function renderEmployees() {
  const tbody = document.getElementById("employeesTableBody");
  if (!tbody) return;
  if (allEmployees.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-3 text-muted">No employees found.</td></tr>';
    return;
  }
  tbody.innerHTML = allEmployees.map(e => `
    <tr>
      <td><code class="text-dark fw-bold font-monospace">${e.employee_id}</code></td>
      <td><strong>${e.employee_name}</strong></td>
      <td>${e.designation} <span class="badge bg-light text-dark border ms-1">${e.department}</span></td>
      <td><span class="small font-monospace">${e.mobile_phone}</span></td>
      <td><a href="mailto:${e.email}" class="text-decoration-none small fw-semibold">${e.email}</a></td>
      <td><span class="badge bg-success-subtle text-success">${e.status}</span></td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-success view-emp-btn me-1" data-id="${e.employee_id}"><i class="bi bi-eye"></i></button>
        <button class="btn btn-sm btn-outline-primary edit-emp-btn me-1" data-id="${e.employee_id}"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger delete-emp-btn" data-id="${e.employee_id}"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll(".view-emp-btn").forEach(btn => btn.onclick = () => showRecordDetails("employee", btn.dataset.id));
  document.querySelectorAll(".edit-emp-btn").forEach(btn => {
    btn.onclick = () => {
      const emp = allEmployees.find(e => e.employee_id === btn.dataset.id);
      if (emp) {
        document.getElementById("employee_id").value = emp.employee_id;
        document.getElementById("employee_id").readOnly = true;
        document.getElementById("employee_name").value = emp.employee_name;
        document.getElementById("employee_designation").value = emp.designation;
        document.getElementById("employee_department").value = emp.department;
        document.getElementById("emp_mobile_phone").value = emp.mobile_phone || "";
        document.getElementById("employee_email").value = emp.email || "";
        document.getElementById("employee_status").value = emp.status;
        document.getElementById("empFormTitle").innerHTML = '<i class="bi bi-people me-2 text-primary"></i>Edit Employee Details';
        document.getElementById("empSubmitBtn").innerHTML = '<i class="bi bi-pencil-square me-2"></i>Update Employee';
        document.getElementById("cancelEmpEditBtn").classList.remove("d-none");
        document.getElementById("employeeForm").scrollIntoView({ behavior: 'smooth' });
      }
    };
  });
  document.querySelectorAll(".delete-emp-btn").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (confirm(`Delete employee ${id}?`)) {
        try {
          await deleteEmployee(id);
          await addAuditLog({
            user_email: currentUserEmail || "admin@example.com",
            action_type: "DELETE",
            collection_name: "tbl_employees",
            record_id: id,
            details: `Deleted employee profile: ${id}`
          });
          refreshEmployees();
          refreshAuditLogs();
        } catch (err) {
          alert("Failed to delete employee: " + err.message);
        }
      }
    };
  });
}

function renderMeetings() {
  const tbody = document.getElementById("meetingsTableBody");
  if (!tbody) return;
  if (allMeetings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-3 text-muted">No meetings scheduled.</td></tr>';
    return;
  }
  tbody.innerHTML = allMeetings.map(m => `
    <tr>
      <td><code class="text-dark fw-bold font-monospace">${m.meeting_id}</code></td>
      <td><strong>${m.meeting_title}</strong></td>
      <td><span class="small font-monospace">${m.project_id}</span></td>
      <td><span class="small">${m.meeting_timestamp.replace('T', ' ')}</span></td>
      <td><span class="small">${m.attendees_list.length} attendees</span></td>
      <td>${m.meeting_url ? `<a href="${m.meeting_url}" target="_blank" class="badge bg-info text-dark">URL</a>` : '—'}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-success view-mtg-btn me-1" data-id="${m.meeting_id}"><i class="bi bi-eye"></i></button>
        <button class="btn btn-sm btn-outline-primary edit-mtg-btn me-1" data-id="${m.meeting_id}"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger delete-mtg-btn" data-id="${m.meeting_id}"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll(".view-mtg-btn").forEach(btn => btn.onclick = () => showRecordDetails("meeting", btn.dataset.id));
  document.querySelectorAll(".edit-mtg-btn").forEach(btn => {
    btn.onclick = () => {
      const mtg = allMeetings.find(m => m.meeting_id === btn.dataset.id);
      if (mtg) {
        document.getElementById("meeting_id").value = mtg.meeting_id;
        document.getElementById("meeting_id").readOnly = true;
        document.getElementById("meeting_project_id").value = mtg.project_id;
        document.getElementById("meeting_title").value = mtg.meeting_title;
        document.getElementById("meeting_timestamp").value = mtg.meeting_timestamp;
        document.getElementById("meeting_agenda").value = mtg.agenda || "";
        document.getElementById("meeting_url").value = mtg.meeting_url || "";
        document.getElementById("meeting_minutes").value = mtg.meeting_minutes || "";
        document.getElementById("mtgFormTitle").innerHTML = '<i class="bi bi-calendar-event me-2 text-primary"></i>Edit Meeting Schedule';
        document.getElementById("mtgSubmitBtn").innerHTML = '<i class="bi bi-pencil-square me-2"></i>Update Meeting';
        document.getElementById("cancelMtgEditBtn").classList.remove("d-none");
        document.getElementById("meetingForm").scrollIntoView({ behavior: 'smooth' });
      }
    };
  });
  document.querySelectorAll(".delete-mtg-btn").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (confirm(`Delete meeting ${id}?`)) {
        try {
          await deleteMeeting(id);
          await addAuditLog({
            user_email: currentUserEmail || "admin@example.com",
            action_type: "DELETE",
            collection_name: "tbl_meetings",
            record_id: id,
            details: `Deleted meeting schedule: ${id}`
          });
          refreshMeetings();
          refreshAuditLogs();
        } catch (err) {
          alert("Failed to delete meeting: " + err.message);
        }
      }
    };
  });
}

function renderBudgets() {
  const tbody = document.getElementById("budgetTableBody");
  if (!tbody) return;
  if (allBudgets.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-3 text-muted">No budget lines configured.</td></tr>';
    return;
  }
  tbody.innerHTML = allBudgets.map(b => `
    <tr>
      <td><code class="text-dark fw-bold font-monospace">${b.budget_line_id}</code></td>
      <td><span class="small font-monospace">${b.project_id}</span></td>
      <td><span class="badge bg-secondary text-dark">${b.cost_category}</span></td>
      <td><strong>${(Number(b.allocated_amount) || 0).toLocaleString()} BDT</strong></td>
      <td><span class="small text-muted">${b.line_description}</span></td>
      <td><span class="small font-monospace">${b.approved_by}</span></td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-success view-bgt-btn me-1" data-id="${b.budget_line_id}"><i class="bi bi-eye"></i></button>
        <button class="btn btn-sm btn-outline-primary edit-bgt-btn me-1" data-id="${b.budget_line_id}"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger delete-bgt-btn" data-id="${b.budget_line_id}"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll(".view-bgt-btn").forEach(btn => btn.onclick = () => showRecordDetails("budget", btn.dataset.id));
  document.querySelectorAll(".edit-bgt-btn").forEach(btn => {
    btn.onclick = () => {
      const b = allBudgets.find(bgt => bgt.budget_line_id === btn.dataset.id);
      if (b) {
        document.getElementById("budget_line_id").value = b.budget_line_id;
        document.getElementById("budget_line_id").readOnly = true;
        document.getElementById("budget_project_id").value = b.project_id;
        document.getElementById("budget_cost_category").value = b.cost_category;
        document.getElementById("budget_line_description").value = b.line_description;
        document.getElementById("budget_allocated_amount").value = b.allocated_amount;
        document.getElementById("budget_approved_by").value = b.approved_by;
        document.getElementById("bgtFormTitle").innerHTML = '<i class="bi bi-wallet2 me-2 text-primary"></i>Edit Budget Item';
        document.getElementById("bgtSubmitBtn").innerHTML = '<i class="bi bi-pencil-square me-2"></i>Update Budget Line';
        document.getElementById("cancelBgtEditBtn").classList.remove("d-none");
        document.getElementById("budgetForm").scrollIntoView({ behavior: 'smooth' });
      }
    };
  });
  document.querySelectorAll(".delete-bgt-btn").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (confirm(`Delete budget line ${id}?`)) {
        try {
          await deleteBudget(id);
          await addAuditLog({
            user_email: currentUserEmail || "admin@example.com",
            action_type: "DELETE",
            collection_name: "tbl_budget",
            record_id: id,
            details: `Deleted budget line allocation: ${id}`
          });
          refreshBudgets();
          refreshAuditLogs();
        } catch (err) {
          alert("Failed to delete budget line: " + err.message);
        }
      }
    };
  });
}

function renderTasks() {
  const tbody = document.getElementById("tasksTableBody");
  if (!tbody) return;
  if (allTasks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-3 text-muted">No tasks defined.</td></tr>';
    return;
  }
  tbody.innerHTML = allTasks.map(t => {
    let pClass = "bg-success";
    if (t.progress_percent < 30) pClass = "bg-danger";
    else if (t.progress_percent < 80) pClass = "bg-warning text-dark";
    
    return `
      <tr>
        <td><code class="text-dark fw-bold font-monospace">${t.task_id}</code></td>
        <td><strong>${t.task_name}</strong> <span class="small font-monospace text-muted">(${t.wbs_code})</span></td>
        <td><span class="small font-monospace">${t.project_id}</span></td>
        <td><span class="small font-semibold text-dark">${t.assigned_to}</span></td>
        <td><span class="small">${t.task_startDate} to ${t.task_endDate}</span></td>
        <td>
          <div class="d-flex align-items-center gap-2">
            <div class="progress" style="width: 60px; height: 6px;">
              <div class="progress-bar ${pClass}" role="progressbar" style="width: ${t.progress_percent}%"></div>
            </div>
            <span class="small fw-bold">${t.progress_percent}%</span>
          </div>
        </td>
        <td><span class="badge bg-secondary text-dark">${t.task_status}</span></td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-success view-tsk-btn me-1" data-id="${t.task_id}"><i class="bi bi-eye"></i></button>
          <button class="btn btn-sm btn-outline-primary edit-tsk-btn me-1" data-id="${t.task_id}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger delete-tsk-btn" data-id="${t.task_id}"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll(".view-tsk-btn").forEach(btn => btn.onclick = () => showRecordDetails("task", btn.dataset.id));
  document.querySelectorAll(".edit-tsk-btn").forEach(btn => {
    btn.onclick = () => {
      const t = allTasks.find(tsk => tsk.task_id === btn.dataset.id);
      if (t) {
        document.getElementById("task_id").value = t.task_id;
        document.getElementById("task_id").readOnly = true;
        document.getElementById("task_project_id").value = t.project_id;
        document.getElementById("task_wbs_code").value = t.wbs_code || "1.0";
        document.getElementById("task_name").value = t.task_name;
        
        const isEmpId = allEmployees.some(e => e.employee_id === t.assigned_to);
        if (isEmpId) {
          document.getElementById("task_assigned_to_emp").value = t.assigned_to;
          document.getElementById("task_assigned_to_txt").value = "";
        } else {
          document.getElementById("task_assigned_to_emp").value = "";
          document.getElementById("task_assigned_to_txt").value = t.assigned_to;
        }

        document.getElementById("task_startDate").value = t.task_startDate;
        document.getElementById("task_endDate").value = t.task_endDate;
        document.getElementById("task_progress_percent").value = t.progress_percent;
        document.getElementById("task_status").value = t.task_status;
        document.getElementById("task_working_update").value = t.working_update || "";
        
        document.getElementById("tskFormTitle").innerHTML = '<i class="bi bi-activity me-2 text-primary"></i>Edit Task updates';
        document.getElementById("tskSubmitBtn").innerHTML = '<i class="bi bi-pencil-square me-2"></i>Update Task';
        document.getElementById("cancelTskEditBtn").classList.remove("d-none");
        document.getElementById("taskForm").scrollIntoView({ behavior: 'smooth' });
      }
    };
  });
  document.querySelectorAll(".delete-tsk-btn").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (confirm(`Delete task ${id}?`)) {
        try {
          await deleteTask(id);
          await addAuditLog({
            user_email: currentUserEmail || "admin@example.com",
            action_type: "DELETE",
            collection_name: "tbl_tasks",
            record_id: id,
            details: `Deleted task execution record: ${id}`
          });
          refreshTasks();
          refreshAuditLogs();
        } catch (err) {
          alert("Failed to delete task: " + err.message);
        }
      }
    };
  });
}

function renderRequisitions() {
  const tbody = document.getElementById("requisitionsTableBody");
  if (!tbody) return;
  if (allRequisitions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-3 text-muted">No requisitions found.</td></tr>';
    return;
  }
  tbody.innerHTML = allRequisitions.map(r => {
    let rBadge = "bg-secondary";
    if (r.dept_approval === "Approved") rBadge = "bg-success";
    else if (r.dept_approval === "Pending Review") rBadge = "bg-warning text-dark";
    else if (r.dept_approval === "Rejected") rBadge = "bg-danger";

    return `
      <tr>
        <td><code class="text-dark fw-bold font-monospace">${r.requisition_id}</code></td>
        <td><strong>${r.item_description}</strong></td>
        <td><span class="small font-monospace">${r.project_id}</span></td>
        <td><span class="badge bg-light text-dark border">${r.item_category}</span></td>
        <td>${r.qty_requested} x ${(Number(r.est_unit_cost) || 0).toLocaleString()}</td>
        <td><strong>${(Number(r.est_total_cost) || 0).toLocaleString()} BDT</strong></td>
        <td><span class="badge ${rBadge}">${r.dept_approval}</span></td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-success view-req-btn me-1" data-id="${r.requisition_id}"><i class="bi bi-eye"></i></button>
          <button class="btn btn-sm btn-outline-primary edit-req-btn me-1" data-id="${r.requisition_id}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger delete-req-btn" data-id="${r.requisition_id}"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll(".view-req-btn").forEach(btn => btn.onclick = () => showRecordDetails("requisition", btn.dataset.id));
  document.querySelectorAll(".edit-req-btn").forEach(btn => {
    btn.onclick = () => {
      const r = allRequisitions.find(req => req.requisition_id === btn.dataset.id);
      if (r) {
        document.getElementById("requisition_id").value = r.requisition_id;
        document.getElementById("requisition_id").readOnly = true;
        document.getElementById("req_project_id").value = r.project_id;
        document.getElementById("req_item_category").value = r.item_category;
        document.getElementById("req_item_description").value = r.item_description;
        document.getElementById("req_qty_requested").value = r.qty_requested;
        document.getElementById("req_est_unit_cost").value = r.est_unit_cost;
        document.getElementById("req_dept_approval").value = r.dept_approval;
        document.getElementById("req_rejection_reason").value = r.rejection_reason || "";
        
        if (r.dept_approval === "Rejected") {
          document.getElementById("rejectionReasonContainer").classList.remove("d-none");
        } else {
          document.getElementById("rejectionReasonContainer").classList.add("d-none");
        }

        document.getElementById("reqFormTitle").innerHTML = '<i class="bi bi-file-earmark-plus me-2 text-primary"></i>Edit Requisition Form';
        document.getElementById("reqSubmitBtn").innerHTML = '<i class="bi bi-pencil-square me-2"></i>Update Requisition';
        document.getElementById("cancelReqEditBtn").classList.remove("d-none");
        document.getElementById("requisitionForm").scrollIntoView({ behavior: 'smooth' });
      }
    };
  });
  document.querySelectorAll(".delete-req-btn").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (confirm(`Delete requisition ${id}?`)) {
        try {
          await deleteRequisition(id);
          await addAuditLog({
            user_email: currentUserEmail || "admin@example.com",
            action_type: "DELETE",
            collection_name: "tbl_requisitions",
            record_id: id,
            details: `Deleted requisition request: ${id}`
          });
          refreshRequisitions();
          refreshAuditLogs();
        } catch (err) {
          alert("Failed to delete requisition: " + err.message);
        }
      }
    };
  });
}

function renderPurchaseOrders() {
  const tbody = document.getElementById("purchasesTableBody");
  if (!tbody) return;
  if (allPurchaseOrders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-3 text-muted">No purchase orders generated.</td></tr>';
    return;
  }
  tbody.innerHTML = allPurchaseOrders.map(po => `
    <tr>
      <td><code class="text-dark fw-bold font-monospace">${po.po_number}</code></td>
      <td><strong>${po.vendor_name}</strong></td>
      <td><span class="small font-monospace">${po.requisition_id}</span></td>
      <td><span class="small font-monospace">${po.project_id}</span></td>
      <td><strong>${(Number(po.final_po_total) || 0).toLocaleString()} BDT</strong></td>
      <td><span class="small">${po.po_issue_date}</span></td>
      <td><span class="badge bg-success">${po.po_status}</span></td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-success view-po-btn me-1" data-id="${po.po_number}"><i class="bi bi-eye"></i></button>
        <button class="btn btn-sm btn-outline-primary edit-po-btn me-1" data-id="${po.po_number}"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger delete-po-btn" data-id="${po.po_number}"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll(".view-po-btn").forEach(btn => btn.onclick = () => showRecordDetails("purchase", btn.dataset.id));
  document.querySelectorAll(".edit-po-btn").forEach(btn => {
    btn.onclick = () => {
      const po = allPurchaseOrders.find(p => p.po_number === btn.dataset.id);
      if (po) {
        document.getElementById("po_number").value = po.po_number;
        document.getElementById("po_number").readOnly = true;
        document.getElementById("po_requisition_id").value = po.requisition_id;
        document.getElementById("po_project_id").value = po.project_id;
        document.getElementById("po_vendor_name").value = po.vendor_name;
        document.getElementById("po_final_total").value = po.final_po_total;
        document.getElementById("po_payment_terms").value = po.payment_terms;
        document.getElementById("po_issue_date").value = po.po_issue_date;
        document.getElementById("po_status").value = po.po_status;
        document.getElementById("poFormTitle").innerHTML = '<i class="bi bi-cart-check me-2 text-primary"></i>Edit Purchase Order Details';
        document.getElementById("poSubmitBtn").innerHTML = '<i class="bi bi-pencil-square me-2"></i>Update PO';
        document.getElementById("cancelPoEditBtn").classList.remove("d-none");
        document.getElementById("purchaseForm").scrollIntoView({ behavior: 'smooth' });
      }
    };
  });
  document.querySelectorAll(".delete-po-btn").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (confirm(`Delete Purchase Order ${id}?`)) {
        try {
          await deletePurchaseOrder(id);
          await addAuditLog({
            user_email: currentUserEmail || "admin@example.com",
            action_type: "DELETE",
            collection_name: "tbl_purchase_orders",
            record_id: id,
            details: `Deleted Purchase Order document: ${id}`
          });
          refreshPurchases();
          refreshAuditLogs();
        } catch (err) {
          alert("Failed to delete PO: " + err.message);
        }
      }
    };
  });
}

function renderExpenses() {
  const tbody = document.getElementById("expensesTableBody");
  if (!tbody) return;
  if (allExpenses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-3 text-muted">No expenses recorded.</td></tr>';
    return;
  }
  tbody.innerHTML = allExpenses.map(e => {
    let payBadgeClass = "bg-secondary";
    if (e.payment_status === "Fully Settled" || e.payment_status === "Fully Paid") payBadgeClass = "bg-success";
    else if (e.payment_status === "Partially Paid") payBadgeClass = "bg-warning text-dark";
    else if (e.payment_status === "Unpaid / Awaiting Approval") payBadgeClass = "bg-danger";

    return `
      <tr>
        <td><code class="text-dark fw-bold font-monospace">${e.expense_id}</code></td>
        <td><span class="small font-monospace">${e.project_id}</span></td>
        <td><strong>${e.expense_routing_type}</strong> ${e.po_number_ref ? `<code class="text-dark small">(${e.po_number_ref})</code>` : ""}</td>
        <td><strong>${(Number(e.invoice_amount) || 0).toLocaleString()} BDT</strong> <span class="small text-muted">/ ${(Number(e.amount_paid) || 0).toLocaleString()} Paid</span></td>
        <td><span class="small font-monospace text-muted">${e.vendor_invoice_num}</span></td>
        <td><span class="badge ${payBadgeClass}">${e.payment_status}</span></td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-success view-exp-btn me-1" data-id="${e.expense_id}"><i class="bi bi-eye"></i></button>
          <button class="btn btn-sm btn-outline-primary edit-exp-btn me-1" data-id="${e.expense_id}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger delete-exp-btn" data-id="${e.expense_id}"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll(".view-exp-btn").forEach(btn => btn.onclick = () => showRecordDetails("expense", btn.dataset.id));
  document.querySelectorAll(".edit-exp-btn").forEach(btn => {
    btn.onclick = () => {
      const exp = allExpenses.find(ex => ex.expense_id === btn.dataset.id);
      if (exp) {
        document.getElementById("expense_id").value = exp.expense_id;
        document.getElementById("expense_id").readOnly = true;
        document.getElementById("exp_project_id").value = exp.project_id;
        document.getElementById("exp_routing_type").value = exp.expense_routing_type;
        document.getElementById("exp_po_number_ref").value = exp.po_number_ref || "";
        document.getElementById("exp_vendor_invoice_num").value = exp.vendor_invoice_num;
        document.getElementById("exp_invoice_amount").value = exp.invoice_amount;
        document.getElementById("exp_amount_paid").value = exp.amount_paid;
        document.getElementById("exp_payment_status").value = exp.payment_status;
        document.getElementById("exp_payment_method").value = exp.payment_method;
        document.getElementById("exp_clearance_date").value = exp.clearance_date || "";
        
        if (exp.expense_routing_type === "PO-Backed") {
          document.getElementById("poRefSelectorContainer").classList.remove("d-none");
        } else {
          document.getElementById("poRefSelectorContainer").classList.add("d-none");
        }

        document.getElementById("expFormTitle").innerHTML = '<i class="bi bi-cash-coin me-2 text-primary"></i>Edit Expense Record';
        document.getElementById("expSubmitBtn").innerHTML = '<i class="bi bi-pencil-square me-2"></i>Update Expense Line';
        document.getElementById("cancelExpEditBtn").classList.remove("d-none");
        document.getElementById("expenseForm").scrollIntoView({ behavior: 'smooth' });
      }
    };
  });
  document.querySelectorAll(".delete-exp-btn").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (confirm(`Delete expense record ${id}?`)) {
        try {
          await deleteExpense(id);
          await addAuditLog({
            user_email: currentUserEmail || "admin@example.com",
            action_type: "DELETE",
            collection_name: "tbl_expenses",
            record_id: id,
            details: `Deleted ledger expense voucher: ${id}`
          });
          refreshExpenses();
          refreshAuditLogs();
        } catch (err) {
          alert("Failed to delete expense record: " + err.message);
        }
      }
    };
  });
}

function renderClientPayments() {
  const tbody = document.getElementById("paymentsTableBody");
  if (!tbody) return;
  if (allClientPayments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-3 text-muted">No client invoices created.</td></tr>';
    return;
  }
  tbody.innerHTML = allClientPayments.map(p => {
    let pBadge = "bg-secondary";
    if (p.payment_status === "Fully Paid") pBadge = "bg-success";
    else if (p.payment_status === "Partially Paid") pBadge = "bg-warning text-dark";
    else if (p.payment_status === "Awaiting Payment") pBadge = "bg-danger";

    return `
      <tr>
        <td><code class="text-dark fw-bold font-monospace">${p.invoice_id}</code></td>
        <td><span class="small font-monospace">${p.project_id}</span></td>
        <td><strong>${p.milestone_type}</strong></td>
        <td><strong>${(Number(p.invoiced_amount) || 0).toLocaleString()} BDT</strong> <span class="small text-muted">/ ${(Number(p.amount_received) || 0).toLocaleString()} Received</span></td>
        <td><span class="small">${p.invoice_date} to ${p.due_date}</span></td>
        <td><span class="badge ${pBadge}">${p.payment_status}</span></td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-success view-pay-btn me-1" data-id="${p.invoice_id}"><i class="bi bi-eye"></i></button>
          <button class="btn btn-sm btn-outline-primary edit-pay-btn me-1" data-id="${p.invoice_id}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger delete-pay-btn" data-id="${p.invoice_id}"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll(".view-pay-btn").forEach(btn => btn.onclick = () => showRecordDetails("payment", btn.dataset.id));
  document.querySelectorAll(".edit-pay-btn").forEach(btn => {
    btn.onclick = () => {
      const pay = allClientPayments.find(p => p.invoice_id === btn.dataset.id);
      if (pay) {
        document.getElementById("invoice_id").value = pay.invoice_id;
        document.getElementById("invoice_id").readOnly = true;
        document.getElementById("inv_project_id").value = pay.project_id;
        document.getElementById("inv_milestone_type").value = pay.milestone_type;
        document.getElementById("inv_date").value = pay.invoice_date;
        document.getElementById("inv_due_date").value = pay.due_date;
        document.getElementById("inv_amount").value = pay.invoiced_amount;
        document.getElementById("inv_amount_received").value = pay.amount_received;
        document.getElementById("inv_payment_status").value = pay.payment_status;
        document.getElementById("inv_date_received").value = pay.date_received || "";
        document.getElementById("inv_transaction_ref").value = pay.transaction_ref || "";
        
        document.getElementById("payFormTitle").innerHTML = '<i class="bi bi-cash-stack me-2 text-primary"></i>Edit Client Invoice Record';
        document.getElementById("paySubmitBtn").innerHTML = '<i class="bi bi-pencil-square me-2"></i>Update Invoice details';
        document.getElementById("cancelPayEditBtn").classList.remove("d-none");
        document.getElementById("paymentForm").scrollIntoView({ behavior: 'smooth' });
      }
    };
  });
  document.querySelectorAll(".delete-pay-btn").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (confirm(`Delete client invoice ${id}?`)) {
        try {
          await deleteClientPayment(id);
          await addAuditLog({
            user_email: currentUserEmail || "admin@example.com",
            action_type: "DELETE",
            collection_name: "tbl_client_payments",
            record_id: id,
            details: `Deleted client invoice with ID: ${id}`
          });
          refreshPayments();
          refreshAuditLogs();
        } catch (err) {
          alert("Failed to delete client invoice: " + err.message);
        }
      }
    };
  });
}

function renderSupportTickets() {
  const tbody = document.getElementById("ticketsTableBody");
  if (!tbody) return;
  if (allSupportTickets.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-3 text-muted">No tickets registered.</td></tr>';
    return;
  }
  tbody.innerHTML = allSupportTickets.map(t => {
    let pClass = "bg-secondary";
    if (t.priority === "Critical") pClass = "bg-danger";
    else if (t.priority === "High") pClass = "bg-warning text-dark";
    else if (t.priority === "Medium") pClass = "bg-info text-dark";
    
    return `
      <tr>
        <td><code class="text-dark fw-bold font-monospace">${t.ticket_id}</code></td>
        <td><strong>${t.ticket_subject}</strong></td>
        <td><span class="small font-monospace">${t.project_id}</span></td>
        <td><span class="badge ${pClass}">${t.priority}</span></td>
        <td><span class="small">${t.requester_id}</span></td>
        <td><span class="badge bg-light text-dark border">${t.ticket_status}</span></td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-success view-tck-btn me-1" data-id="${t.ticket_id}"><i class="bi bi-eye"></i></button>
          <button class="btn btn-sm btn-outline-primary edit-tck-btn me-1" data-id="${t.ticket_id}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger delete-tck-btn" data-id="${t.ticket_id}"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll(".view-tck-btn").forEach(btn => btn.onclick = () => showRecordDetails("ticket", btn.dataset.id));
  document.querySelectorAll(".edit-tck-btn").forEach(btn => {
    btn.onclick = () => {
      const t = allSupportTickets.find(tc => tc.ticket_id === btn.dataset.id);
      if (t) {
        document.getElementById("ticket_id").value = t.ticket_id;
        document.getElementById("ticket_id").readOnly = true;
        document.getElementById("ticket_project_id").value = t.project_id;
        document.getElementById("ticket_requester_id").value = t.requester_id;
        document.getElementById("ticket_subject").value = t.ticket_subject;
        document.getElementById("ticket_desc").value = t.ticket_desc;
        document.getElementById("ticket_priority").value = t.priority;
        document.getElementById("ticket_assigned_to").value = t.assigned_to || "";
        document.getElementById("ticket_status").value = t.ticket_status;
        document.getElementById("ticket_resolution_notes").value = t.resolution_notes || "";
        document.getElementById("ticket_asset_id").value = t.asset_id || "";
        
        document.getElementById("tckFormTitle").innerHTML = '<i class="bi bi-headset me-2 text-primary"></i>Edit Support Ticket Details';
        document.getElementById("tckSubmitBtn").innerHTML = '<i class="bi bi-pencil-square me-2"></i>Update Ticket';
        document.getElementById("cancelTckEditBtn").classList.remove("d-none");
        document.getElementById("ticketForm").scrollIntoView({ behavior: 'smooth' });
      }
    };
  });
  document.querySelectorAll(".delete-tck-btn").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (confirm(`Delete support ticket record ${id}?`)) {
        try {
          await deleteSupportTicket(id);
          await addAuditLog({
            user_email: currentUserEmail || "admin@example.com",
            action_type: "DELETE",
            collection_name: "tbl_support_tickets",
            record_id: id,
            details: `Deleted client support ticket: ${id}`
          });
          refreshTickets();
          refreshAuditLogs();
        } catch (err) {
          alert("Failed to delete ticket: " + err.message);
        }
      }
    };
  });
}

function renderDomainHosting() {
  const tbody = document.getElementById("hostingTableBody");
  if (!tbody) return;
  if (allDomainHosting.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-3 text-muted">No domain & hosting assets configured.</td></tr>';
    return;
  }
  tbody.innerHTML = allDomainHosting.map(a => {
    let statBadge = "bg-secondary";
    if (a.asset_status === "Active / Good Standing") statBadge = "bg-success";
    else if (a.asset_status === "Expired / Action Required") statBadge = "bg-danger";
    else if (a.asset_status === "Suspended / Terminated") statBadge = "bg-dark text-white";

    return `
      <tr>
        <td><code class="text-dark fw-bold font-monospace">${a.asset_id}</code></td>
        <td><a href="${a.asset_url.startsWith('http') ? a.asset_url : 'https://' + a.asset_url}" target="_blank" class="fw-semibold small text-decoration-none">${a.asset_url}</a></td>
        <td><span class="small font-monospace">${a.project_id}</span></td>
        <td><strong>${(Number(a.selling_price) || 0).toLocaleString()} BDT</strong> <span class="small text-muted">/ cycle</span></td>
        <td><span class="badge bg-secondary text-white">${a.billing_cycle}</span></td>
        <td><span class="badge ${statBadge}">${a.asset_status}</span></td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-success view-hosting-btn me-1" data-id="${a.asset_id}"><i class="bi bi-eye"></i></button>
          <button class="btn btn-sm btn-outline-primary edit-hosting-btn me-1" data-id="${a.asset_id}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger delete-hosting-btn" data-id="${a.asset_id}"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll(".view-hosting-btn").forEach(btn => btn.onclick = () => showRecordDetails("hosting", btn.dataset.id));
  document.querySelectorAll(".edit-hosting-btn").forEach(btn => {
    btn.onclick = () => {
      const a = allDomainHosting.find(h => h.asset_id === btn.dataset.id);
      if (a) {
        document.getElementById("hosting_asset_id").value = a.asset_id;
        document.getElementById("hosting_asset_id").readOnly = true;
        document.getElementById("hosting_project_id").value = a.project_id;
        document.getElementById("hosting_package_name").value = a.package_name || "";
        document.getElementById("hosting_capacity").value = a.hosting_capacity || "";
        document.getElementById("hosting_asset_type").value = a.asset_type;
        document.getElementById("hosting_asset_url").value = a.asset_url;
        document.getElementById("hosting_provider_name").value = a.provider_name;
        document.getElementById("hosting_cost_price").value = a.cost_price;
        document.getElementById("hosting_selling_price").value = a.selling_price;
        document.getElementById("hosting_reg_date").value = a.reg_date;
        document.getElementById("hosting_billing_cycle").value = a.billing_cycle;
        document.getElementById("hosting_renewal_date").value = a.renewal_date;
        document.getElementById("hosting_asset_status").value = a.asset_status;
        
        document.getElementById("hostingFormTitle").innerHTML = '<i class="bi bi-server me-2 text-primary"></i>Edit Domain & Hosting details';
        document.getElementById("hostingSubmitBtn").innerHTML = '<i class="bi bi-pencil-square me-2"></i>Update Infrastructure Asset';
        document.getElementById("cancelHostingEditBtn").classList.remove("d-none");
        document.getElementById("hostingForm").scrollIntoView({ behavior: 'smooth' });
      }
    };
  });
  document.querySelectorAll(".delete-hosting-btn").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (confirm(`Delete asset record ${id}?`)) {
        try {
          await deleteDomainHosting(id);
          await addAuditLog({
            user_email: currentUserEmail || "admin@example.com",
            action_type: "DELETE",
            collection_name: "tbl_domain_hosting",
            record_id: id,
            details: `Deleted domain & hosting asset with ID: ${id}`
          });
          refreshHosting();
          refreshAuditLogs();
        } catch (err) {
          alert("Failed to delete domain & hosting asset: " + err.message);
        }
      }
    };
  });
}

function renderAuditLogs() {
  const tbody = document.getElementById("logsTableBody");
  if (!tbody) return;
  if (allAuditLogs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-3 text-muted">No audit logs available.</td></tr>';
    return;
  }
  tbody.innerHTML = allAuditLogs.map(l => `
    <tr>
      <td><code class="text-dark fw-bold font-monospace">${l.log_id}</code></td>
      <td><span class="small font-monospace">${l.local_time || l.timestamp?.toDate().toLocaleString()}</span></td>
      <td><strong>${l.user_email}</strong></td>
      <td><span class="badge bg-secondary text-dark">${l.action_type}</span></td>
      <td><span class="small text-muted font-monospace">${l.collection_name} (${l.record_id})</span></td>
      <td class="small" style="max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${l.details}</td>
    </tr>
  `).join('');
}

// ==========================================
// TRAINING DATA RENDERING
// ==========================================
function renderFilteredRecords() {
  const tbody = document.getElementById("studentTableBody");
  if (!tbody) return;
  const filter = document.getElementById("batchFilter").value;
  const searchVal = document.getElementById("searchCertId").value.toLowerCase().trim();

  let filtered = allRecords;
  if (filter !== "all") {
    filtered = allRecords.filter(r => r.batch === filter);
  }
  if (searchVal) {
    filtered = filtered.filter(r => 
      r.certificateId.toLowerCase().includes(searchVal) ||
      r.studentName.toLowerCase().includes(searchVal) ||
      (r.studentId && r.studentId.toLowerCase().includes(searchVal)) ||
      r.courseName.toLowerCase().includes(searchVal)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-3 text-muted">No certificates found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(r => `
    <tr>
      <td class="text-center"><span class="badge bg-secondary text-dark">${r.studentId || '—'}</span></td>
      <td><strong>${r.studentName}</strong></td>
      <td class="text-center"><code class="text-dark fw-bold font-monospace">${r.certificateId}</code></td>
      <td>${r.courseName}</td>
      <td class="text-center"><span class="badge bg-light text-dark border">${r.batch}</span></td>
      <td class="text-center"><span class="badge bg-success">${r.status || 'Verified'}</span></td>
      <td class="text-center">
        <a href="${getVerifyUrl(r.certificateId)}" target="_blank" class="btn btn-sm btn-outline-success me-1"><i class="bi bi-link-45deg"></i></a>
        <button class="btn btn-sm btn-outline-primary edit-cert-btn me-1" data-id="${r.certificateId}"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger delete-cert-btn" data-id="${r.certificateId}"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll(".edit-cert-btn").forEach(btn => {
    btn.onclick = () => {
      const record = allRecords.find(r => r.certificateId === btn.dataset.id);
      if (record) {
        editingCertId = record.certificateId;
        document.getElementById("certStudentId").value = record.studentId || "";
        document.getElementById("certId").value = record.certificateId.replace("INTREX-CERT-", "");
        document.getElementById("certId").disabled = true;
        document.getElementById("studentName").value = record.studentName || "";
        document.getElementById("courseName").value = record.courseName || "";
        document.getElementById("issueDate").value = record.issueDate || todayDateStr;
        document.getElementById("grade").value = record.grade || "";
        document.getElementById("certBatch").value = record.batch || "";
        document.getElementById("certStatus").value = record.status || "Verified";
        
        document.getElementById("formTitle").innerHTML = '<i class="bi bi-pencil-square me-2 text-primary"></i>Edit Certificate Record';
        document.getElementById("submitCertBtn").innerHTML = '<i class="bi bi-save me-2"></i>Update Certificate';
        document.getElementById("cancelEditBtn").classList.remove("d-none");
        document.getElementById("generatePanel").scrollIntoView({ behavior: 'smooth' });
      }
    };
  });

  document.querySelectorAll(".delete-cert-btn").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (confirm(`Delete certificate record ${id}?`)) {
        try {
          await deleteCertificate(id);
          await addAuditLog({
            user_email: currentUserEmail || "admin@example.com",
            action_type: "DELETE",
            collection_name: "certificates",
            record_id: id,
            details: `Deleted certificate record: ${id}`
          });
          loadRecords();
          refreshAuditLogs();
        } catch (err) {
          alert("Failed to delete certificate: " + err.message);
        }
      }
    };
  });
}

function renderFilteredRegistrations() {
  const tbody = document.getElementById("regStudentTableBody");
  if (!tbody) return;

  const searchVal = document.getElementById("searchRegStudent").value.toLowerCase().trim();
  const courseFilterVal = document.getElementById("courseRegFilter").value;

  let filtered = allRegistrations;
  if (courseFilterVal !== "all") {
    filtered = filtered.filter(r => r.course === courseFilterVal);
  }
  if (searchVal) {
    filtered = filtered.filter(r => 
      r.studentId.toLowerCase().includes(searchVal) ||
      r.fullName.toLowerCase().includes(searchVal) ||
      r.email.toLowerCase().includes(searchVal) ||
      r.phone.toLowerCase().includes(searchVal) ||
      r.course.toLowerCase().includes(searchVal)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-3 text-muted">No registration records found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(r => `
    <tr>
      <td class="text-center"><code class="text-dark fw-bold font-monospace">${r.studentId}</code></td>
      <td><strong>${r.fullName}</strong></td>
      <td>
        <span class="small font-monospace">${r.phone}</span><br>
        <a href="mailto:${r.email}" class="text-decoration-none small">${r.email}</a>
      </td>
      <td>${r.course}</td>
      <td class="text-center"><span class="badge bg-light text-dark border">${r.batch}</span></td>
      <td class="text-center"><span class="small">${r.education || '—'}</span></td>
      <td class="text-center"><span class="small">${r.createdAt ? (r.createdAt.toDate ? r.createdAt.toDate().toLocaleDateString() : new Date(r.createdAt).toLocaleDateString()) : 'N/A'}</span></td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-primary edit-reg-btn me-1" data-id="${r.studentId}"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger delete-reg-btn" data-id="${r.studentId}"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll(".edit-reg-btn").forEach(btn => {
    btn.onclick = () => {
      const reg = allRegistrations.find(r => r.studentId === btn.dataset.id);
      if (reg) {
        editingStudentId = reg.studentId;
        document.getElementById("regFullName").value = reg.fullName;
        document.getElementById("regEmail").value = reg.email;
        document.getElementById("regPhone").value = reg.phone;
        document.getElementById("regCourse").value = reg.course;
        document.getElementById("regBatch").value = reg.batch;
        document.getElementById("regEducation").value = reg.education || "";
        document.getElementById("regSchedule").value = reg.schedule || "";
        document.getElementById("regMessage").value = reg.message || "";
        
        // Hide payment fields since they are editable in Payments tab
        document.getElementById("regPaymentSection").classList.add("d-none");
        document.getElementById("regFormTitle").innerHTML = '<i class="bi bi-pencil-square me-2 text-primary"></i>Edit Course Registration';
        document.getElementById("submitRegBtn").innerHTML = '<i class="bi bi-check-lg me-2"></i>Update Registration';
        document.getElementById("cancelRegEditBtn").classList.remove("d-none");
        document.getElementById("registrationPanel").scrollIntoView({ behavior: 'smooth' });
      }
    };
  });

  document.querySelectorAll(".delete-reg-btn").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (confirm(`Delete registration for student ${id}? This deletes linked payments and certificates too.`)) {
        try {
          await deleteRegistration(id);
          await addAuditLog({
            user_email: currentUserEmail || "admin@example.com",
            action_type: "DELETE",
            collection_name: "registrations",
            record_id: id,
            details: `Deleted student registration and ledger entries: ${id}`
          });
          loadRegistrations();
          loadPayments();
          loadRecords();
          refreshAuditLogs();
        } catch (err) {
          alert("Failed to delete registration: " + err.message);
        }
      }
    };
  });
}

function renderFilteredPayments() {
  const tbody = document.getElementById("paymentTableBody");
  if (!tbody) return;

  const searchVal = document.getElementById("searchPayStudent").value.toLowerCase().trim();
  const filterVal = document.getElementById("paymentStatusFilter").value;

  let filtered = allPayments;
  if (filterVal !== "all") {
    filtered = allPayments.filter(p => p.status === filterVal);
  }
  if (searchVal) {
    filtered = filtered.filter(p => 
      p.studentId.toLowerCase().includes(searchVal) ||
      p.studentName.toLowerCase().includes(searchVal) ||
      p.courseName.toLowerCase().includes(searchVal) ||
      p.status.toLowerCase().includes(searchVal)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center py-3 text-muted">No payments found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    let statBadge = "bg-secondary";
    if (p.status === "Fully Paid") statBadge = "bg-success";
    else if (p.status === "Partially Paid") statBadge = "bg-warning text-dark";
    else if (p.status === "Unpaid" || !p.status) statBadge = "bg-danger";

    return `
      <tr>
        <td class="text-center"><code class="text-dark fw-bold font-monospace">${p.studentId}</code></td>
        <td><strong>${p.studentName}</strong></td>
        <td>${p.courseName} <span class="badge bg-light text-dark border ms-1">${p.batch}</span></td>
        <td class="text-end font-monospace">${(Number(p.totalFee) || 0).toLocaleString()}</td>
        <td class="text-end font-monospace">${(Number(p.discount) || 0).toLocaleString()}</td>
        <td class="text-end font-monospace fw-semibold text-success">${(Number(p.amountPaid) || 0).toLocaleString()}</td>
        <td class="text-end font-monospace fw-semibold text-danger">${(Number(p.dueAmount) || 0).toLocaleString()}</td>
        <td class="text-center">${p.paymentType} ${p.transactionId ? `<br><code class="small text-muted font-monospace">${p.transactionId}</code>` : ''}</td>
        <td class="text-center"><span class="badge ${statBadge}">${p.status || 'Unpaid'}</span></td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-primary update-pay-btn" data-id="${p.studentId}"><i class="bi bi-wallet2"></i> Pay</button>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll(".update-pay-btn").forEach(btn => {
    btn.onclick = () => {
      const p = allPayments.find(pay => pay.studentId === btn.dataset.id);
      if (p) {
        document.getElementById("updatePayStudentId").value = p.studentId;
        document.getElementById("updatePayStudentName").value = p.studentName;
        document.getElementById("updatePayCourse").value = p.courseName;
        document.getElementById("updatePayFee").value = p.totalFee;
        document.getElementById("updatePayDiscount").value = p.discount;
        document.getElementById("updatePayAmountPaid").value = p.amountPaid;
        document.getElementById("updatePayType").value = p.paymentType || "Cash";
        document.getElementById("updatePayTxId").value = p.transactionId || "";
        
        if (p.paymentType === "Cash") {
          document.getElementById("updatePayTxIdContainer").classList.add("d-none");
        } else {
          document.getElementById("updatePayTxIdContainer").classList.remove("d-none");
        }

        const modal = new bootstrap.Modal(document.getElementById("updatePaymentModal"));
        modal.show();
      }
    };
  });
}

// Helper to generate verification link
function getVerifyUrl(certificateId) {
  const origin = "https://intrex-digital.com";
  return `${origin}/verify.html?id=${certificateId}`;
}

// ==========================================
// PREMIUM DETAILS MODAL POPUP ENGINE
// ==========================================
function showRecordDetails(type, id) {
  const typeConfigs = {
    project: {
      title: "Project Registry Details",
      badge: "Project File",
      getRecords: () => allProjects,
      idField: "project_id",
      fields: [
        { label: "Project ID", key: "project_id", type: "code", cols: 6 },
        { label: "Project Status", key: "project_status", type: "badge", cols: 6 },
        { label: "Project Name", key: "project_name", type: "text", cols: 12 },
        { label: "Client / Sponsor", key: "client_sponsor", type: "contact", cols: 6 },
        { label: "Project Manager", key: "project_manager", type: "pm", cols: 6 },
        { label: "Start Date", key: "start_date", type: "date", cols: 6 },
        { label: "Target End Date", key: "end_date", type: "date", cols: 6 },
        { label: "Project Description", key: "project_desc", type: "textarea", cols: 12 }
      ]
    },
    contact: {
      title: "External Contact Details",
      badge: "Contact Info",
      getRecords: () => allContacts,
      idField: "contact_id",
      fields: [
        { label: "Contact ID", key: "contact_id", type: "code", cols: 6 },
        { label: "Designation", key: "designation", type: "text", cols: 6 },
        { label: "Full Name", key: "contact_name", type: "text", cols: 6 },
        { label: "Organization", key: "organization", type: "text", cols: 6 },
        { label: "Mobile Phone", key: "mobile_phone", type: "phone", cols: 6 },
        { label: "Email Address", key: "email", type: "email", cols: 6 },
        { label: "Linked Projects", key: "project_id", type: "array", cols: 12 }
      ]
    },
    employee: {
      title: "Internal Employee Details",
      badge: "Personnel Record",
      getRecords: () => allEmployees,
      idField: "employee_id",
      fields: [
        { label: "Employee ID", key: "employee_id", type: "code", cols: 6 },
        { label: "Status", key: "status", type: "badge", cols: 6 },
        { label: "Full Name", key: "employee_name", type: "text", cols: 6 },
        { label: "Designation", key: "designation", type: "text", cols: 6 },
        { label: "Department", key: "department", type: "text", cols: 6 },
        { label: "Mobile Phone", key: "mobile_phone", type: "phone", cols: 6 },
        { label: "Email Address", key: "email", type: "email", cols: 12 }
      ]
    },
    meeting: {
      title: "Meeting Registry Details",
      badge: "Calendar & Agenda",
      getRecords: () => allMeetings,
      idField: "meeting_id",
      fields: [
        { label: "Meeting ID", key: "meeting_id", type: "code", cols: 6 },
        { label: "Project ID", key: "project_id", type: "code", cols: 6 },
        { label: "Meeting Title", key: "meeting_title", type: "text", cols: 12 },
        { label: "Date & Time", key: "meeting_timestamp", type: "datetime", cols: 6 },
        { label: "Meeting Link", key: "meeting_url", type: "url", cols: 6 },
        { label: "Attendees List", key: "attendees_list", type: "array", cols: 12 },
        { label: "Meeting Minutes / Summary", key: "meeting_minutes", type: "textarea", cols: 12 }
      ]
    },
    budget: {
      title: "Budget Allocation Details",
      badge: "Financial Directive",
      getRecords: () => allBudgets,
      idField: "budget_line_id",
      fields: [
        { label: "Budget Line ID", key: "budget_line_id", type: "code", cols: 6 },
        { label: "Project ID", key: "project_id", type: "code", cols: 6 },
        { label: "Cost Category", key: "cost_category", type: "badge", cols: 6 },
        { label: "Approved By", key: "approved_by", type: "contact", cols: 6 },
        { label: "Allocated Amount", key: "allocated_amount", type: "currency", cols: 6 },
        { label: "Last Updated", key: "last_updated", type: "datetime", cols: 6 },
        { label: "Line Item Description", key: "line_description", type: "textarea", cols: 12 }
      ]
    },
    task: {
      title: "Project Task Execution Record",
      badge: "Work Breakdown Structure",
      getRecords: () => allTasks,
      idField: "task_id",
      fields: [
        { label: "Task ID", key: "task_id", type: "code", cols: 6 },
        { label: "WBS Code", key: "wbs_code", type: "code", cols: 6 },
        { label: "Project ID", key: "project_id", type: "code", cols: 6 },
        { label: "Task Status", key: "task_status", type: "badge", cols: 6 },
        { label: "Task Name", key: "task_name", type: "text", cols: 12 },
        { label: "Assigned To", key: "assigned_to", type: "contact", cols: 6 },
        { label: "Progress Percent", key: "progress_percent", type: "progress", cols: 6 },
        { label: "Start Date", key: "task_startDate", type: "date", cols: 6 },
        { label: "End Date", key: "task_endDate", type: "date", cols: 6 },
        { label: "Working Updates Log", key: "working_update", type: "textarea", cols: 12 }
      ]
    },
    requisition: {
      title: "Operational Requisition Details",
      badge: "Material Request",
      getRecords: () => allRequisitions,
      idField: "requisition_id",
      fields: [
        { label: "Requisition ID", key: "requisition_id", type: "code", cols: 6 },
        { label: "Project ID", key: "project_id", type: "code", cols: 6 },
        { label: "Item Category", key: "item_category", type: "badge", cols: 6 },
        { label: "Department Approval", key: "dept_approval", type: "badge", cols: 6 },
        { label: "Quantity Requested", key: "qty_requested", type: "text", cols: 4 },
        { label: "Estimated Unit Cost", key: "est_unit_cost", type: "currency", cols: 4 },
        { label: "Estimated Total Cost", key: "est_total_cost", type: "currency", cols: 4 },
        { label: "Item / Service Description", key: "item_description", type: "text", cols: 12 },
        { label: "Rejection Reason (if any)", key: "rejection_reason", type: "textarea", cols: 12 }
      ]
    },
    purchase: {
      title: "Purchase Order Details",
      badge: "Procurement Record",
      getRecords: () => allPurchaseOrders,
      idField: "po_number",
      fields: [
        { label: "PO Number", key: "po_number", type: "code", cols: 6 },
        { label: "Requisition ID", key: "requisition_id", type: "code", cols: 6 },
        { label: "Project ID", key: "project_id", type: "code", cols: 6 },
        { label: "PO Status", key: "po_status", type: "badge", cols: 6 },
        { label: "Vendor Name", key: "vendor_name", type: "text", cols: 6 },
        { label: "Payment Terms", key: "payment_terms", type: "text", cols: 6 },
        { label: "Final PO Total", key: "final_po_total", type: "currency", cols: 6 },
        { label: "PO Issue Date", key: "po_issue_date", type: "date", cols: 6 }
      ]
    },
    expense: {
      title: "Company Expense Log Details",
      badge: "Financial Expense",
      getRecords: () => allExpenses,
      idField: "expense_id",
      fields: [
        { label: "Expense ID", key: "expense_id", type: "code", cols: 6 },
        { label: "Project ID", key: "project_id", type: "code", cols: 6 },
        { label: "Expense Routing Type", key: "expense_routing_type", type: "text", cols: 6 },
        { label: "Payment Status", key: "payment_status", type: "badge", cols: 6 },
        { label: "PO Reference ID", key: "po_number_ref", type: "code", cols: 6 },
        { label: "Vendor Invoice Number", key: "vendor_invoice_num", type: "text", cols: 6 },
        { label: "Invoice Gross Amount", key: "invoice_amount", type: "currency", cols: 6 },
        { label: "Amount Paid", key: "amount_paid", type: "currency", cols: 6 },
        { label: "Clearance Date", key: "clearance_date", type: "date", cols: 12 }
      ]
    },
    ticket: {
      title: "Support Ticket Registry Details",
      badge: "Helpdesk Resolution",
      getRecords: () => allSupportTickets,
      idField: "ticket_id",
      fields: [
        { label: "Ticket ID", key: "ticket_id", type: "code", cols: 6 },
        { label: "Project ID", key: "project_id", type: "code", cols: 6 },
        { label: "Asset ID Reference", key: "asset_id", type: "code", cols: 6 },
        { label: "Ticket Status", key: "ticket_status", type: "badge", cols: 6 },
        { label: "Requester Name", key: "requester_id", type: "contact", cols: 6 },
        { label: "Assigned Engineer", key: "assigned_to", type: "contact", cols: 6 },
        { label: "Ticket Priority", key: "priority", type: "badge", cols: 6 },
        { label: "SLA Deadline", key: "sla_deadline", type: "datetime", cols: 6 },
        { label: "Ticket Subject", key: "ticket_subject", type: "text", cols: 12 },
        { label: "Description of Issue", key: "ticket_desc", type: "textarea", cols: 12 },
        { label: "Logged Timestamp", key: "created_at", type: "datetime", cols: 6 },
        { label: "Closed Timestamp", key: "closed_at", type: "datetime", cols: 6 },
        { label: "Resolution Notes", key: "resolution_notes", type: "textarea", cols: 12 }
      ]
    },
    payment: {
      title: "Client Payment & Invoice Details",
      badge: "Billing Record",
      getRecords: () => allClientPayments,
      idField: "invoice_id",
      fields: [
        { label: "Invoice / Receipt ID", key: "invoice_id", type: "code", cols: 6 },
        { label: "Project ID", key: "project_id", type: "code", cols: 6 },
        { label: "Billing Milestone Type", key: "milestone_type", type: "text", cols: 6 },
        { label: "Payment Status", key: "payment_status", type: "badge", cols: 6 },
        { label: "Invoiced Amount", key: "invoiced_amount", type: "currency", cols: 6 },
        { label: "Amount Received", key: "amount_received", type: "currency", cols: 6 },
        { label: "Outstanding Balance", key: "outstanding", type: "currency_calc", cols: 6 },
        { label: "Invoice Issue Date", key: "invoice_date", type: "date", cols: 6 },
        { label: "Payment Due Date", key: "due_date", type: "date", cols: 6 },
        { label: "Actual Clearance Date", key: "date_received", type: "date", cols: 6 },
        { label: "Bank Transaction Ref", key: "transaction_ref", type: "text", cols: 6 }
      ]
    },
    hosting: {
      title: "Domain & Hosting Asset Details",
      badge: "Infrastructure Asset",
      getRecords: () => allDomainHosting,
      idField: "asset_id",
      fields: [
        { label: "Asset ID", key: "asset_id", type: "code", cols: 6 },
        { label: "Project ID", key: "project_id", type: "code", cols: 6 },
        { label: "Hosting Package", key: "package_name", type: "package", cols: 6 },
        { label: "Hosting Capacity", key: "hosting_capacity", type: "text", cols: 6 },
        { label: "Asset Type", key: "asset_type", type: "text", cols: 6 },
        { label: "Upstream Provider", key: "provider_name", type: "text", cols: 6 },
        { label: "Domain / Server URL", key: "asset_url", type: "url", cols: 12 },
        { label: "Cost Price (BDT)", key: "cost_price", type: "currency", cols: 6 },
        { label: "Selling Price (BDT)", key: "selling_price", type: "currency", cols: 6 },
        { label: "Billing Cycle", key: "billing_cycle", type: "text", cols: 6 },
        { label: "Asset Status", key: "asset_status", type: "badge", cols: 6 },
        { label: "Registration Date", key: "reg_date", type: "date", cols: 6 },
        { label: "Next Renewal Date", key: "renewal_date", type: "date", cols: 6 }
      ]
    }
  };

  const cfg = typeConfigs[type];
  if (!cfg) return;

  const record = cfg.getRecords().find(r => r[cfg.idField] === id);
  if (!record) {
    alert("Record not found in current view dataset.");
    return;
  }

  document.getElementById("detailsModalBadge").textContent = cfg.badge;
  document.getElementById("detailsViewModalLabel").textContent = `${cfg.title} - ${id}`;

  let subtitleText = "Detailed registry information and audit fields.";
  if (type === "project") subtitleText = record.project_name;
  else if (type === "contact") subtitleText = record.contact_name;
  else if (type === "employee") subtitleText = record.employee_name;
  else if (type === "ticket") subtitleText = record.ticket_subject;
  else if (type === "meeting") subtitleText = record.meeting_title;
  else if (type === "hosting") subtitleText = record.asset_url;
  document.getElementById("detailsModalSubtitle").textContent = subtitleText;

  function getBadgeClass(val) {
    if (!val) return 'bg-secondary';
    const clean = val.toString().trim().toLowerCase();
    if (['active', 'active / good standing', 'active', 'good', 'approved', 'resolved', 'closed', 'fully paid', 'completed', 'success'].includes(clean)) {
      return 'bg-success text-white';
    }
    if (['pending', 'awaiting payment', 'partially paid', 'draft', 'medium', 'in progress', 'warning'].includes(clean)) {
      return 'bg-warning text-dark';
    }
    if (['expired', 'expired / action required', 'suspended', 'suspended / terminated', 'overdue', 'failed', 'rejected', 'high', 'critical', 'danger'].includes(clean)) {
      return 'bg-danger text-white';
    }
    return 'bg-secondary text-white';
  }

  const gridBody = document.getElementById("detailsViewModalBody");
  gridBody.innerHTML = cfg.fields.map(f => {
    let val = record[f.key];

    if (f.type === "currency_calc" && f.key === "outstanding") {
      const invoiced = Number(record.invoiced_amount) || 0;
      const received = Number(record.amount_received) || 0;
      val = invoiced - received;
    }

    if (type === "contact" && f.key === "project_id") {
      const matchingProjects = allProjects.filter(p => p.client_sponsor === record.contact_id || p.client_sponsor === record.contact_name);
      val = matchingProjects.map(p => p.project_id);
    }

    let displayHtml = '';
    if (val === undefined || val === null || val === '') {
      displayHtml = '<span class="text-muted small"><em>— Not Specified —</em></span>';
    } else {
      switch (f.type) {
        case 'code':
          displayHtml = `<code class="text-dark font-monospace fw-bold px-2 py-1 bg-light rounded border" style="font-size: 0.85rem;">${val}</code>`;
          break;
        case 'badge':
          displayHtml = `<span class="badge ${getBadgeClass(val)} px-3 py-2 fw-semibold" style="font-size: 0.8rem;">${val}</span>`;
          break;
        case 'pm':
        case 'contact':
          const match = allEmployees.find(e => e.employee_id === val) || allContacts.find(c => c.contact_id === val);
          displayHtml = match
            ? `<strong class="text-heading-color">${match.employee_name || match.contact_name}</strong> <span class="text-muted font-monospace small">(${val})</span>`
            : `<strong class="text-heading-color">${val}</strong>`;
          break;
        case 'date':
          displayHtml = `<i class="bi bi-calendar-event me-2 text-primary"></i>${val}`;
          break;
        case 'datetime':
          displayHtml = `<i class="bi bi-clock me-2 text-primary"></i>${val.replace('T', ' ')}`;
          break;
        case 'phone':
          displayHtml = `<a href="tel:${val}" class="text-decoration-none text-heading-color fw-semibold"><i class="bi bi-telephone me-2 text-primary"></i>${val}</a>`;
          break;
        case 'email':
          displayHtml = `<a href="mailto:${val}" class="text-decoration-none text-heading-color fw-semibold"><i class="bi bi-envelope me-2 text-primary"></i>${val}</a>`;
          break;
        case 'url':
          let targetUrl = val.trim();
          if (targetUrl && !/^https?:\/\//i.test(targetUrl) && !/^\/\//.test(targetUrl)) {
            targetUrl = 'https://' + targetUrl;
          }
          displayHtml = `<a href="${targetUrl}" target="_blank" class="text-decoration-none fw-semibold"><i class="bi bi-box-arrow-up-right me-2"></i>Open Target Link</a>`;
          break;
        case 'currency':
        case 'currency_calc':
          const num = Number(val) || 0;
          const textClass = num > 0 ? 'text-success fw-bold' : 'text-dark fw-bold';
          displayHtml = `<span class="${textClass}" style="font-size: 1rem;"><i class="bi bi-currency-bangladeshi me-1"></i>${num.toLocaleString()} BDT</span>`;
          break;
        case 'array':
          const arrStr = Array.isArray(val) ? val.join(', ') : val;
          displayHtml = `<span class="small font-monospace">${arrStr}</span>`;
          break;
        case 'progress':
          displayHtml = `
            <div class="d-flex align-items-center gap-3 w-100 mt-1">
              <div class="progress flex-grow-1" style="height: 10px; border-radius: 5px;">
                <div class="progress-bar bg-success progress-bar-striped progress-bar-animated" role="progressbar" style="width: ${val}%"></div>
              </div>
              <strong class="text-heading-color">${val}%</strong>
            </div>
          `;
          break;
        case 'package':
          const pkgColorMap = { "Basic": "bg-info text-dark", "Plus": "bg-warning text-dark", "Business": "bg-success text-white" };
          displayHtml = `<span class="badge ${pkgColorMap[val] || 'bg-secondary'} px-3 py-2 fw-semibold">${val}</span>`;
          break;
        case 'textarea':
          displayHtml = `<div class="p-3 bg-light rounded-3 border" style="font-size: 0.9rem; font-weight: 500; white-space: pre-wrap; line-height: 1.5; min-height: 80px; max-height: 250px; overflow-y: auto;">${val}</div>`;
          break;
        default:
          displayHtml = val;
      }
    }

    const isFullWidth = f.cols === 12 || f.type === 'textarea';
    const cardStyle = f.type === 'textarea' ? 'background: #fdfdfd; border-color: rgba(33,92,92,0.1);' : '';
    return `
      <div class="col-${isFullWidth ? '12' : f.cols || '6'}">
        <div class="detail-card" style="${cardStyle}">
          <div class="detail-card-label">${f.label}</div>
          <div class="detail-card-value">${displayHtml}</div>
        </div>
      </div>
    `;
  }).join('');

  const modalInst = new bootstrap.Modal(document.getElementById('detailsViewModal'));
  modalInst.show();
}

// Details print handler
document.getElementById("detailsPrintBtn").onclick = () => {
  const modalBody = document.getElementById("detailsViewModalBody").innerHTML;
  const modalTitle = document.getElementById("detailsViewModalLabel").textContent;
  const modalBadge = document.getElementById("detailsModalBadge").textContent;
  const modalSubtitle = document.getElementById("detailsModalSubtitle").textContent;

  const printWindow = window.open('', '_blank');
  const printHTML = [
    '<html><head>',
    '<title>Print - ' + modalTitle + '<\/title>',
    '<link href="assets/vendors/bootstrap/bootstrap.min.css" rel="stylesheet">',
    '<link href="assets/vendors/bootstrap-icons/font/bootstrap-icons.min.css" rel="stylesheet">',
    '<style>',
    'body { font-family: Inter, sans-serif; padding: 40px; color: #333; }',
    '.print-header { border-bottom: 2px solid #215C5C; padding-bottom: 20px; margin-bottom: 30px; }',
    '.detail-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 12px 16px; margin-bottom: 15px; page-break-inside: avoid; }',
    '.detail-card-label { font-size: 0.7rem; font-weight: 700; color: #6c757d; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }',
    '.detail-card-value { font-size: 0.925rem; font-weight: 600; color: #212529; word-break: break-word; }',
    '.badge { display: inline-block; padding: 0.35em 0.65em; font-size: 0.75em; font-weight: 700; border-radius: 0.25rem; }',
    '.text-success { color: #198754 !important; }',
    '.text-primary { color: #215C5C !important; }',
    '@media print { .btn { display: none; } body { padding: 0; } }',
    '<\/style><\/head>',
    '<body>',
    '<div class="print-header d-flex justify-content-between align-items-center">',
    '<div>',
    '<span class="badge bg-secondary text-uppercase mb-2">' + modalBadge + '<\/span>',
    '<h2 class="fw-bold text-primary mb-1">' + modalTitle + '<\/h2>',
    '<p class="text-muted small mb-0">' + modalSubtitle + '<\/p>',
    '<\/div>',
    '<div class="text-end">',
    '<h4 class="fw-bold text-primary m-0">INTREX DIGITAL<\/h4>',
    '<p class="small text-muted mt-1 mb-0">Registry Audit Log Export<\/p>',
    '<\/div><\/div>',
    '<div class="row g-3">' + modalBody + '<\/div>',
    '<div class="mt-5 text-center text-muted small border-top pt-3">',
    'Printed on ' + new Date().toLocaleString() + ' | Intrex Digital Hub Solutions Portal',
    '<\/div>',
    '<\/body><\/html>'
  ].join('\n');
  printWindow.document.write(printHTML);

  const script = printWindow.document.createElement("script");
  script.textContent = `
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 500);
    };
  `;
  printWindow.document.body.appendChild(script);
  printWindow.document.close();
};

// ==========================================
// CSV EXPORTER TOOL
// ==========================================
function exportTableToCSV(tableId, filename) {
  const table = document.getElementById(tableId);
  if (!table) return;
  
  let csv = [];
  const rows = table.querySelectorAll("tr");
  
  for (let i = 0; i < rows.length; i++) {
    const row = [];
    const cols = rows[i].querySelectorAll("td, th");
    
    for (let j = 0; j < cols.length; j++) {
      let data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, "").replace(/(\s\s+)/g, ' ');
      data = data.replace(/"/g, '""');
      if (data.indexOf(",") > -1 || data.indexOf('"') > -1) {
        data = '"' + data + '"';
      }
      row.push(data);
    }
    if (row.length > 0) {
      const lastItem = row[row.length - 1].toLowerCase();
      if (lastItem.includes("actions") || lastItem.includes("update") || lastItem.includes("delete") || lastItem.includes("edit") || lastItem.includes("view")) {
        row.pop();
      }
      csv.push(row.join(","));
    }
  }
  
  const csvString = csv.join("\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// CSV button bindings
document.getElementById("exportProjectsCsvBtn")?.addEventListener("click", () => exportTableToCSV("projectsTable", `projects_export_${new Date().toISOString().slice(0,10)}.csv`));
document.getElementById("exportEmployeesCsvBtn")?.addEventListener("click", () => exportTableToCSV("employeesTable", `employees_export_${new Date().toISOString().slice(0,10)}.csv`));
document.getElementById("exportContactsCsvBtn")?.addEventListener("click", () => exportTableToCSV("contactsTable", `contacts_export_${new Date().toISOString().slice(0,10)}.csv`));
document.getElementById("exportMeetingsCsvBtn")?.addEventListener("click", () => exportTableToCSV("meetingsTable", `meetings_export_${new Date().toISOString().slice(0,10)}.csv`));
document.getElementById("exportBudgetCsvBtn")?.addEventListener("click", () => exportTableToCSV("budgetTable", `budgets_export_${new Date().toISOString().slice(0,10)}.csv`));
document.getElementById("exportTasksCsvBtn")?.addEventListener("click", () => exportTableToCSV("tasksTable", `tasks_export_${new Date().toISOString().slice(0,10)}.csv`));
document.getElementById("exportRequisitionsCsvBtn")?.addEventListener("click", () => exportTableToCSV("requisitionsTable", `requisitions_export_${new Date().toISOString().slice(0,10)}.csv`));
document.getElementById("exportPurchasesCsvBtn")?.addEventListener("click", () => exportTableToCSV("purchasesTable", `purchase_orders_export_${new Date().toISOString().slice(0,10)}.csv`));
document.getElementById("exportExpensesCsvBtn")?.addEventListener("click", () => exportTableToCSV("expensesTable", `expenses_export_${new Date().toISOString().slice(0,10)}.csv`));
document.getElementById("exportPaymentsCsvBtn")?.addEventListener("click", () => exportTableToCSV("paymentsTable", `invoices_export_${new Date().toISOString().slice(0,10)}.csv`));
document.getElementById("exportTicketsCsvBtn")?.addEventListener("click", () => exportTableToCSV("ticketsTable", `tickets_export_${new Date().toISOString().slice(0,10)}.csv`));
document.getElementById("exportHostingCsvBtn")?.addEventListener("click", () => exportTableToCSV("hostingTable", `domain_hosting_export_${new Date().toISOString().slice(0,10)}.csv`));
document.getElementById("exportLogsCsvBtn")?.addEventListener("click", () => exportTableToCSV("logsTable", `system_logs_export_${new Date().toISOString().slice(0,10)}.csv`));

document.getElementById("exportRegCsvBtn")?.addEventListener("click", () => exportTableToCSV("regStudentTable", `registrations_export_${new Date().toISOString().slice(0,10)}.csv`));
document.getElementById("exportPayCsvBtn")?.addEventListener("click", () => exportTableToCSV("paymentTable", `payments_export_${new Date().toISOString().slice(0,10)}.csv`));
document.getElementById("exportCertCsvBtn")?.addEventListener("click", () => exportTableToCSV("studentTable", `certificates_export_${new Date().toISOString().slice(0,10)}.csv`));

// Overview filter triggers
document.getElementById("filterStartDate")?.addEventListener("change", updateOverview);
document.getElementById("filterEndDate")?.addEventListener("change", updateOverview);
document.getElementById("filterProject")?.addEventListener("change", updateOverview);
document.getElementById("filterDept")?.addEventListener("change", updateOverview);
document.getElementById("filterCourse")?.addEventListener("change", updateOverview);

document.getElementById("resetOverviewFiltersBtn")?.addEventListener("click", () => {
  document.getElementById("filterStartDate").value = "";
  document.getElementById("filterEndDate").value = "";
  if (document.getElementById("filterProject")) document.getElementById("filterProject").value = "all";
  if (document.getElementById("filterDept")) document.getElementById("filterDept").value = "all";
  if (document.getElementById("filterCourse")) document.getElementById("filterCourse").value = "all";
  updateOverview();
});

// ==========================================
// CHARTS & ANALYTICS CONTROLLER
// ==========================================
function getRecordDate(record) {
  if (!record) return null;
  if (record.createdAt) {
    return record.createdAt.toDate ? record.createdAt.toDate() : new Date(record.createdAt);
  } else if (record.issueDate) {
    return new Date(record.issueDate);
  }
  return null;
}

function updateOverview() {
  const startDateVal = document.getElementById("filterStartDate").value;
  const endDateVal = document.getElementById("filterEndDate").value;
  const projectFilterVal = document.getElementById("filterProject")?.value || "all";
  const deptFilterVal = document.getElementById("filterDept")?.value || "all";
  const courseVal = document.getElementById("filterCourse")?.value || "all";

  // Filter Arrays
  let filteredRegs = allRegistrations;
  let filteredPayments = allPayments;
  let filteredRecords = allRecords;

  let filteredProjects = allProjects;
  let filteredBudgets = allBudgets;
  let filteredExpenses = allExpenses;
  let filteredRequisitions = allRequisitions;
  let filteredClientPayments = allClientPayments;

  // Apply course filtering (Training)
  if (courseVal !== "all") {
    filteredRegs = filteredRegs.filter(r => r.course === courseVal);
    filteredPayments = filteredPayments.filter(p => p.courseName === courseVal);
    filteredRecords = filteredRecords.filter(r => r.courseName === courseVal);
  }

  // Apply project filtering (Solutions)
  if (projectFilterVal !== "all") {
    filteredProjects = filteredProjects.filter(p => p.project_id === projectFilterVal);
    filteredBudgets = filteredBudgets.filter(b => b.project_id === projectFilterVal);
    filteredExpenses = filteredExpenses.filter(e => e.project_id === projectFilterVal);
    filteredRequisitions = filteredRequisitions.filter(r => r.project_id === projectFilterVal);
    filteredClientPayments = filteredClientPayments.filter(p => p.project_id === projectFilterVal);
  }

  // Apply date range filters
  if (startDateVal) {
    const start = new Date(startDateVal);
    start.setHours(0, 0, 0, 0);
    filteredRegs = filteredRegs.filter(r => { const d = getRecordDate(r); return d && d >= start; });
    filteredPayments = filteredPayments.filter(p => { const d = getRecordDate(p); return d && d >= start; });
    filteredRecords = filteredRecords.filter(r => { const d = getRecordDate(r); return d && d >= start; });
    filteredExpenses = filteredExpenses.filter(e => e.createdAt && new Date(e.createdAt) >= start);
    filteredClientPayments = filteredClientPayments.filter(p => p.invoice_date && new Date(p.invoice_date) >= start);
  }

  if (endDateVal) {
    const end = new Date(endDateVal);
    end.setHours(23, 59, 59, 999);
    filteredRegs = filteredRegs.filter(r => { const d = getRecordDate(r); return d && d <= end; });
    filteredPayments = filteredPayments.filter(p => { const d = getRecordDate(p); return d && d <= end; });
    filteredRecords = filteredRecords.filter(r => { const d = getRecordDate(r); return d && d <= end; });
    filteredExpenses = filteredExpenses.filter(e => e.createdAt && new Date(e.createdAt) <= end);
    filteredClientPayments = filteredClientPayments.filter(p => p.invoice_date && new Date(p.invoice_date) <= end);
  }

  // Calculate & Render KPI metrics
  const totalStudents = filteredRegs.length;
  const totalCollected = filteredPayments.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
  const totalDue = filteredPayments.reduce((sum, p) => sum + (Number(p.dueAmount) || 0), 0);
  const totalDiscount = filteredPayments.reduce((sum, p) => sum + (Number(p.discount) || 0), 0);

  const fullyPaidCount = filteredPayments.filter(p => p.status === "Fully Paid").length;
  const partiallyPaidCount = filteredPayments.filter(p => p.status === "Partially Paid").length;
  const unpaidCount = filteredPayments.filter(p => p.status === "Unpaid" || !p.status).length;
  const totalBilled = filteredPayments.reduce((sum, p) => sum + (Number(p.totalFee) || 0) - (Number(p.discount) || 0), 0);
  const collectionRate = totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(1) : "0.0";

  document.getElementById("kpiTotalStudents").textContent = totalStudents.toLocaleString();
  document.getElementById("kpiTotalCollected").textContent = `${totalCollected.toLocaleString()} BDT`;
  document.getElementById("kpiTotalDue").textContent = `${totalDue.toLocaleString()} BDT`;
  document.getElementById("kpiTotalDiscount").textContent = `${totalDiscount.toLocaleString()} BDT`;
  document.getElementById("kpiFullyPaid").textContent = fullyPaidCount.toLocaleString();
  document.getElementById("kpiPartiallyPaid").textContent = partiallyPaidCount.toLocaleString();
  document.getElementById("kpiUnpaid").textContent = unpaidCount.toLocaleString();
  document.getElementById("kpiCollectionRate").textContent = `${collectionRate}%`;

  const totalBudget = filteredBudgets.reduce((sum, b) => sum + (Number(b.allocated_amount) || 0), 0);
  const totalActualExpenses = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount_paid) || 0), 0);
  const monthlyClientInvoicing = filteredClientPayments.reduce((sum, p) => sum + (Number(p.amount_received) || 0), 0);

  document.getElementById("kpiTotalProjects").textContent = filteredProjects.length;
  document.getElementById("kpiActiveProjects").textContent = filteredProjects.filter(p => p.project_status === "Active").length;
  document.getElementById("kpiTotalBudget").textContent = `${totalBudget.toLocaleString()} BDT`;
  document.getElementById("kpiTotalExpenses").textContent = `${totalActualExpenses.toLocaleString()} BDT`;
  document.getElementById("kpiMonthlyCollections").textContent = `${monthlyClientInvoicing.toLocaleString()} BDT`;

  // Draw/Refresh recent registrations list
  const recentList = document.getElementById("recentRegistrationsList");
  if (recentList) {
    const sortedRegs = [...filteredRegs].sort((a, b) => (getRecordDate(b)?.getTime() || 0) - (getRecordDate(a)?.getTime() || 0)).slice(0, 5);
    if (sortedRegs.length === 0) {
      recentList.innerHTML = `<div class="text-muted small text-center py-4">No matching recent registrations.</div>`;
    } else {
      recentList.innerHTML = sortedRegs.map(r => `
        <div class="d-flex align-items-center justify-content-between py-2 border-bottom" style="border-color: rgba(0,0,0,0.05) !important;">
          <div>
            <div class="fw-bold small text-heading-color" style="font-size: 0.85rem;">${r.fullName}</div>
            <div class="text-muted" style="font-size:0.75rem;">${r.course} • ${r.schedule}</div>
          </div>
          <div class="text-end">
            <span class="badge bg-secondary text-dark" style="font-size:0.7rem;">${r.studentId}</span>
          </div>
        </div>
      `).join('');
    }
  }

  // Draw Charts
  if (typeof Chart === 'undefined') return;
  const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
  const chartTextColor = isDark ? '#f8f9fa' : '#494B5B';
  const chartGridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
  const primaryColor = '#215C5C';

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } }
  };

  // --- TRAINING CHARTS ---
  const ctxPayment = document.getElementById("chartPaymentStatus")?.getContext("2d");
  if (ctxPayment) {
    if (chartPaymentStatusInstance) chartPaymentStatusInstance.destroy();
    chartPaymentStatusInstance = new Chart(ctxPayment, {
      type: 'doughnut',
      data: {
        labels: ['Fully Paid', 'Partially Paid', 'Unpaid'],
        datasets: [{
          data: [fullyPaidCount, partiallyPaidCount, unpaidCount],
          backgroundColor: ['#28a745', '#ffc107', '#dc3545'],
          borderWidth: isDark ? 2 : 1,
          borderColor: isDark ? '#212529' : '#fff'
        }]
      },
      options: { ...commonOptions, cutout: '70%' }
    });
  }

  const courseCounts = {};
  filteredRegs.forEach(r => { if (r.course) courseCounts[r.course] = (courseCounts[r.course] || 0) + 1; });
  const courseLabels = Object.keys(courseCounts);
  const courseData = Object.values(courseCounts);
  const ctxCourse = document.getElementById("chartCourseEnrollment")?.getContext("2d");
  if (ctxCourse) {
    if (chartCourseEnrollmentInstance) chartCourseEnrollmentInstance.destroy();
    chartCourseEnrollmentInstance = new Chart(ctxCourse, {
      type: 'bar',
      data: {
        labels: courseLabels,
        datasets: [{ data: courseData, backgroundColor: primaryColor, borderRadius: 6, barThickness: 24 }]
      },
      options: {
        ...commonOptions,
        scales: {
          x: { grid: { display: false }, ticks: { color: chartTextColor, font: { family: 'Inter', size: 10 } } },
          y: { grid: { color: chartGridColor }, ticks: { color: chartTextColor, precision: 0 } }
        }
      }
    });
  }

  const rawTrends = {};
  filteredRegs.forEach(r => {
    const d = getRecordDate(r);
    if (d) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      rawTrends[key] = (rawTrends[key] || 0) + 1;
    }
  });
  const sortedTrendKeys = Object.keys(rawTrends).sort();
  const trendLabels = sortedTrendKeys.map(k => {
    const [y, m] = k.split('-');
    return new Date(y, m - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
  });
  const trendData = sortedTrendKeys.map(k => rawTrends[k]);
  const ctxRegTrends = document.getElementById("chartRegTrends")?.getContext("2d");
  if (ctxRegTrends) {
    if (chartRegTrendsInstance) chartRegTrendsInstance.destroy();
    chartRegTrendsInstance = new Chart(ctxRegTrends, {
      type: 'line',
      data: {
        labels: trendLabels.length ? trendLabels : ['No Data'],
        datasets: [{ data: trendData.length ? trendData : [0], borderColor: primaryColor, backgroundColor: 'rgba(33, 92, 92, 0.1)', fill: true, tension: 0.3 }]
      },
      options: {
        ...commonOptions,
        scales: {
          x: { grid: { display: false }, ticks: { color: chartTextColor } },
          y: { grid: { color: chartGridColor }, ticks: { color: chartTextColor, precision: 0 } }
        }
      }
    });
  }

  const ctxFunnel = document.getElementById("chartPaymentFunnel")?.getContext("2d");
  if (ctxFunnel) {
    if (chartPaymentFunnelInstance) chartPaymentFunnelInstance.destroy();
    chartPaymentFunnelInstance = new Chart(ctxFunnel, {
      type: 'bar',
      data: {
        labels: ['Billed', 'Collected', 'Due', 'Discount'],
        datasets: [{ data: [totalBilled, totalCollected, totalDue, totalDiscount], backgroundColor: ['#0d6efd', '#28a745', '#dc3545', '#ffc107'], borderRadius: 6, barThickness: 20 }]
      },
      options: {
        indexAxis: 'y',
        ...commonOptions,
        scales: {
          x: { grid: { color: chartGridColor }, ticks: { color: chartTextColor } },
          y: { grid: { display: false }, ticks: { color: chartTextColor } }
        }
      }
    });
  }

  const rawCertVelocity = {};
  filteredRecords.forEach(rec => {
    const d = getRecordDate(rec);
    if (d) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      rawCertVelocity[key] = (rawCertVelocity[key] || 0) + 1;
    }
  });
  const sortedCertKeys = Object.keys(rawCertVelocity).sort();
  const certLabels = sortedCertKeys.map(k => {
    const [y, m] = k.split('-');
    return new Date(y, m - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
  });
  const certData = sortedCertKeys.map(k => rawCertVelocity[k]);
  const ctxCert = document.getElementById("chartCertVelocity")?.getContext("2d");
  if (ctxCert) {
    if (chartCertVelocityInstance) chartCertVelocityInstance.destroy();
    chartCertVelocityInstance = new Chart(ctxCert, {
      type: 'bar',
      data: {
        labels: certLabels.length ? certLabels : ['No Data'],
        datasets: [{ data: certData.length ? certData : [0], backgroundColor: '#6f42c1', borderRadius: 4, barThickness: 20 }]
      },
      options: {
        ...commonOptions,
        scales: {
          x: { grid: { display: false }, ticks: { color: chartTextColor } },
          y: { grid: { color: chartGridColor }, ticks: { color: chartTextColor, precision: 0 } }
        }
      }
    });
  }

  const courseRev = {}, courseDue = {};
  filteredPayments.forEach(p => {
    if (p.courseName) {
      courseRev[p.courseName] = (courseRev[p.courseName] || 0) + (Number(p.amountPaid) || 0);
      courseDue[p.courseName] = (courseDue[p.courseName] || 0) + (Number(p.dueAmount) || 0);
    }
  });
  const courseLabelsRev = Object.keys(courseRev);
  const paidDatasets = courseLabelsRev.map(l => courseRev[l]);
  const dueDatasets = courseLabelsRev.map(l => courseDue[l]);
  const ctxRev = document.getElementById("chartRevenueByCourse")?.getContext("2d");
  if (ctxRev) {
    if (chartRevenueByCourseInstance) chartRevenueByCourseInstance.destroy();
    chartRevenueByCourseInstance = new Chart(ctxRev, {
      type: 'bar',
      data: {
        labels: courseLabelsRev,
        datasets: [
          { label: 'Paid', data: paidDatasets, backgroundColor: '#28a745' },
          { label: 'Due', data: dueDatasets, backgroundColor: '#dc3545' }
        ]
      },
      options: {
        ...commonOptions,
        plugins: { legend: { display: true, labels: { color: chartTextColor } } },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: chartTextColor } },
          y: { stacked: true, grid: { color: chartGridColor }, ticks: { color: chartTextColor } }
        }
      }
    });
  }

  // --- SOLUTIONS CHARTS ---
  const projStatuses = { "Pipeline": 0, "Active": 0, "On Hold": 0, "Completed": 0, "Terminated": 0 };
  filteredProjects.forEach(p => { if (p.project_status in projStatuses) projStatuses[p.project_status]++; });
  const ctxStatus = document.getElementById("chartProjectStatus")?.getContext("2d");
  if (ctxStatus) {
    if (chartProjectStatusInstance) chartProjectStatusInstance.destroy();
    chartProjectStatusInstance = new Chart(ctxStatus, {
      type: 'doughnut',
      data: {
        labels: Object.keys(projStatuses),
        datasets: [{
          data: Object.values(projStatuses),
          backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#20c997', '#dc3545'],
          borderWidth: isDark ? 2 : 1,
          borderColor: isDark ? '#212529' : '#fff'
        }]
      },
      options: { ...commonOptions, cutout: '70%' }
    });
  }

  const projBudgetsMap = {}, projExpensesMap = {};
  filteredBudgets.forEach(b => { projBudgetsMap[b.project_id] = (projBudgetsMap[b.project_id] || 0) + (Number(b.allocated_amount) || 0); });
  filteredExpenses.forEach(e => { projExpensesMap[e.project_id] = (projExpensesMap[e.project_id] || 0) + (Number(e.amount_paid) || 0); });
  const budgetLabels = Object.keys(projBudgetsMap);
  const budgetValues = budgetLabels.map(l => projBudgetsMap[l]);
  const expenseValues = budgetLabels.map(l => projExpensesMap[l] || 0);
  const ctxBudget = document.getElementById("chartBudgetVsExpense")?.getContext("2d");
  if (ctxBudget) {
    if (chartBudgetVsExpenseInstance) chartBudgetVsExpenseInstance.destroy();
    chartBudgetVsExpenseInstance = new Chart(ctxBudget, {
      type: 'bar',
      data: {
        labels: budgetLabels,
        datasets: [
          { label: 'Budget Allocated', data: budgetValues, backgroundColor: primaryColor },
          { label: 'Actual Expenses', data: expenseValues, backgroundColor: '#dc3545' }
        ]
      },
      options: {
        ...commonOptions,
        plugins: { legend: { display: true, labels: { color: chartTextColor } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: chartTextColor } },
          y: { grid: { color: chartGridColor }, ticks: { color: chartTextColor } }
        }
      }
    });
  }

  const reqStatuses = { "Pending Review": 0, "Approved": 0, "Rejected": 0 };
  filteredRequisitions.forEach(r => { if (r.dept_approval in reqStatuses) reqStatuses[r.dept_approval]++; });
  const ctxReq = document.getElementById("chartRequisitionLifecycle")?.getContext("2d");
  if (ctxReq) {
    if (chartRequisitionLifecycleInstance) chartRequisitionLifecycleInstance.destroy();
    chartRequisitionLifecycleInstance = new Chart(ctxReq, {
      type: 'pie',
      data: {
        labels: Object.keys(reqStatuses),
        datasets: [{
          data: Object.values(reqStatuses),
          backgroundColor: ['#ffc107', '#198754', '#dc3545'],
          borderWidth: isDark ? 2 : 1,
          borderColor: isDark ? '#212529' : '#fff'
        }]
      },
      options: commonOptions
    });
  }

  const deptCounts = {};
  allEmployees.forEach(e => {
    if (deptFilterVal !== "all" && e.department !== deptFilterVal) return;
    if (e.department) {
      deptCounts[e.department] = (deptCounts[e.department] || 0) + 1;
    }
  });
  const deptLabelsArr = Object.keys(deptCounts);
  const deptDataArr = Object.values(deptCounts);
  const ctxRes = document.getElementById("chartResourceAllocation")?.getContext("2d");
  if (ctxRes) {
    if (chartResourceAllocationInstance) chartResourceAllocationInstance.destroy();
    chartResourceAllocationInstance = new Chart(ctxRes, {
      type: 'bar',
      data: {
        labels: deptLabelsArr,
        datasets: [{ data: deptDataArr, backgroundColor: '#17a2b8', borderRadius: 4, barThickness: 24 }]
      },
      options: {
        ...commonOptions,
        scales: {
          x: { grid: { display: false }, ticks: { color: chartTextColor } },
          y: { grid: { color: chartGridColor }, ticks: { color: chartTextColor, precision: 0 } }
        }
      }
    });
  }

  const monthlyCollections = {}, monthlyExpenses = {};
  filteredClientPayments.forEach(p => {
    if (p.date_received) {
      const k = p.date_received.substring(0, 7);
      monthlyCollections[k] = (monthlyCollections[k] || 0) + (Number(p.amount_received) || 0);
    }
  });
  filteredExpenses.forEach(e => {
    if (e.clearance_date) {
      const k = e.clearance_date.substring(0, 7);
      monthlyExpenses[k] = (monthlyExpenses[k] || 0) + (Number(e.amount_paid) || 0);
    }
  });
  const months = Array.from(new Set([...Object.keys(monthlyCollections), ...Object.keys(monthlyExpenses)])).sort();
  const colData = months.map(m => monthlyCollections[m] || 0);
  const expData = months.map(m => monthlyExpenses[m] || 0);
  const ctxCash = document.getElementById("chartMonthlyFinance")?.getContext("2d");
  if (ctxCash) {
    if (chartMonthlyFinanceInstance) chartMonthlyFinanceInstance.destroy();
    chartMonthlyFinanceInstance = new Chart(ctxCash, {
      type: 'line',
      data: {
        labels: months.map(m => {
          const [y, mo] = m.split('-');
          return new Date(y, mo - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
        }),
        datasets: [
          { label: 'Client Collections', data: colData, borderColor: '#28a745', tension: 0.3, fill: false },
          { label: 'Vendor Expenses', data: expData, borderColor: '#dc3545', tension: 0.3, fill: false }
        ]
      },
      options: {
        ...commonOptions,
        plugins: { legend: { display: true, labels: { color: chartTextColor } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: chartTextColor } },
          y: { grid: { color: chartGridColor }, ticks: { color: chartTextColor } }
        }
      }
    });
  }
}

// ==========================================
// FORM SUBMISSION EVENT LISTENERS
// ==========================================
document.getElementById("projectForm").onsubmit = async (e) => {
  e.preventDefault();
  const start = new Date(document.getElementById("start_date").value);
  const end = new Date(document.getElementById("end_date").value);
  if (end <= start) { alert("Target End Date must be greater than Start Date."); return; }

  const isEdit = document.getElementById("project_id").readOnly;
  const projectName = document.getElementById("project_name").value;

  try {
    const savedId = await addProject({
      project_id: document.getElementById("project_id").value || null,
      project_name: projectName,
      client_sponsor: document.getElementById("client_sponsor").value,
      project_desc: document.getElementById("project_desc").value,
      start_date: document.getElementById("start_date").value,
      end_date: document.getElementById("end_date").value,
      project_status: document.getElementById("project_status").value,
      project_manager: document.getElementById("project_manager").value
    });
    await addAuditLog({
      user_email: currentUserEmail || "admin@example.com",
      action_type: isEdit ? "UPDATE" : "CREATE",
      collection_name: "tbl_projects",
      record_id: savedId,
      details: `${isEdit ? "Updated" : "Created"} project "${projectName}"`
    });
    document.getElementById("projectForm").reset();
    document.getElementById("project_id").readOnly = false;
    document.getElementById("projFormTitle").innerHTML = '<i class="bi bi-kanban me-2 text-primary"></i>Create Project';
    document.getElementById("projSubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Save Project';
    document.getElementById("cancelProjEditBtn").classList.add("d-none");
    document.querySelectorAll('input[type="date"]').forEach(input => {
      if (input.id === "exp_clearance_date" || input.id === "inv_date_received" || input.id === "issueDate" || input.id === "filterStartDate" || input.id === "filterEndDate") return;
      input.value = todayDateStr;
    });
    refreshProjects();
    refreshAuditLogs();
    alert("Project saved successfully.");
  } catch (err) {
    alert("Failed to save project: " + err.message);
  }
};

document.getElementById("employeeForm").onsubmit = async (e) => {
  e.preventDefault();
  const mobile = document.getElementById("emp_mobile_phone").value.trim();
  const mobileRegex = /^\+?[1-9]\d{1,14}$/;
  if (mobile && !mobileRegex.test(mobile)) { alert("Please enter a valid E.164 phone number."); return; }

  const isEdit = document.getElementById("employee_id").readOnly;
  const name = document.getElementById("employee_name").value;

  try {
    const savedId = await addEmployee({
      employee_id: document.getElementById("employee_id").value || null,
      employee_name: name,
      designation: document.getElementById("employee_designation").value,
      department: document.getElementById("employee_department").value,
      mobile_phone: mobile,
      email: document.getElementById("employee_email").value.trim(),
      status: document.getElementById("employee_status").value
    });
    await addAuditLog({
      user_email: currentUserEmail || "admin@example.com",
      action_type: isEdit ? "UPDATE" : "CREATE",
      collection_name: "tbl_employees",
      record_id: savedId,
      details: `${isEdit ? "Updated" : "Registered"} employee "${name}"`
    });
    document.getElementById("employeeForm").reset();
    document.getElementById("employee_id").readOnly = false;
    document.getElementById("empFormTitle").innerHTML = '<i class="bi bi-people me-2 text-primary"></i>Register New Employee';
    document.getElementById("empSubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Save Employee';
    document.getElementById("cancelEmpEditBtn").classList.add("d-none");
    refreshEmployees();
    refreshAuditLogs();
    alert("Employee saved successfully.");
  } catch (err) {
    alert("Failed to save employee: " + err.message);
  }
};

document.getElementById("contactForm").onsubmit = async (e) => {
  e.preventDefault();
  const isEdit = document.getElementById("contact_id").readOnly;
  const name = document.getElementById("contact_name").value;

  try {
    const savedId = await addContact({
      contact_id: document.getElementById("contact_id").value || null,
      project_id: Array.from(document.getElementById("contact_project_id").selectedOptions).map(opt => opt.value),
      contact_name: name,
      designation: document.getElementById("contact_designation").value,
      organization: document.getElementById("contact_organization").value,
      mobile_phone: document.getElementById("contact_mobile_phone").value,
      email: document.getElementById("contact_email").value.trim()
    });
    await addAuditLog({
      user_email: currentUserEmail || "admin@example.com",
      action_type: isEdit ? "UPDATE" : "CREATE",
      collection_name: "tbl_contacts",
      record_id: savedId,
      details: `${isEdit ? "Updated" : "Registered"} contact "${name}"`
    });
    document.getElementById("contactForm").reset();
    document.getElementById("contact_id").readOnly = false;
    document.getElementById("conFormTitle").innerHTML = '<i class="bi bi-telephone-inbound me-2 text-primary"></i>Register External Contact';
    document.getElementById("conSubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Save Contact';
    document.getElementById("cancelConEditBtn").classList.add("d-none");
    refreshContacts();
    refreshAuditLogs();
    alert("Contact saved successfully.");
  } catch (err) {
    alert("Failed to save contact: " + err.message);
  }
};

document.getElementById("meetingForm").onsubmit = async (e) => {
  e.preventDefault();
  const isEdit = document.getElementById("meeting_id").readOnly;
  const title = document.getElementById("meeting_title").value;

  try {
    const savedId = await addMeeting({
      meeting_id: document.getElementById("meeting_id").value || null,
      project_id: document.getElementById("meeting_project_id").value,
      meeting_title: title,
      meeting_timestamp: document.getElementById("meeting_timestamp").value,
      agenda: document.getElementById("meeting_agenda").value,
      attendees_list: Array.from(document.getElementById("meeting_attendees_list").selectedOptions).map(opt => opt.value),
      meeting_url: document.getElementById("meeting_url").value,
      meeting_minutes: document.getElementById("meeting_minutes").value
    });
    await addAuditLog({
      user_email: currentUserEmail || "admin@example.com",
      action_type: isEdit ? "UPDATE" : "CREATE",
      collection_name: "tbl_meetings",
      record_id: savedId,
      details: `${isEdit ? "Updated" : "Scheduled"} meeting "${title}"`
    });
    document.getElementById("meetingForm").reset();
    document.getElementById("meeting_id").readOnly = false;
    document.getElementById("mtgFormTitle").innerHTML = '<i class="bi bi-calendar-event me-2 text-primary"></i>Schedule Meeting';
    document.getElementById("mtgSubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Schedule Meeting';
    document.getElementById("cancelMtgEditBtn").classList.add("d-none");
    document.querySelectorAll('input[type="datetime-local"]').forEach(input => {
      input.value = today.toISOString().substring(0, 16);
    });
    refreshMeetings();
    refreshAuditLogs();
    alert("Meeting saved successfully.");
  } catch (err) {
    alert("Failed to schedule meeting: " + err.message);
  }
};

document.getElementById("budgetForm").onsubmit = async (e) => {
  e.preventDefault();
  const isEdit = document.getElementById("budget_line_id").readOnly;
  const category = document.getElementById("budget_cost_category").value;

  try {
    const savedId = await addBudget({
      budget_line_id: document.getElementById("budget_line_id").value || null,
      project_id: document.getElementById("budget_project_id").value,
      cost_category: category,
      line_description: document.getElementById("budget_line_description").value,
      allocated_amount: document.getElementById("budget_allocated_amount").value,
      approved_by: document.getElementById("budget_approved_by").value
    });
    await addAuditLog({
      user_email: currentUserEmail || "admin@example.com",
      action_type: isEdit ? "UPDATE" : "CREATE",
      collection_name: "tbl_budget",
      record_id: savedId,
      details: `${isEdit ? "Updated" : "Configured"} budget line for ${category}`
    });
    document.getElementById("budgetForm").reset();
    document.getElementById("budget_line_id").readOnly = false;
    document.getElementById("bgtFormTitle").innerHTML = '<i class="bi bi-wallet2 me-2 text-primary"></i>Configure Budget Line';
    document.getElementById("bgtSubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Save Budget Line';
    document.getElementById("cancelBgtEditBtn").classList.add("d-none");
    refreshBudgets();
    refreshAuditLogs();
    alert("Budget line saved successfully.");
  } catch (err) {
    alert("Failed to save budget line: " + err.message);
  }
};

document.getElementById("taskForm").onsubmit = async (e) => {
  e.preventDefault();
  const start = new Date(document.getElementById("task_startDate").value);
  const end = new Date(document.getElementById("task_endDate").value);
  if (end <= start) { alert("Task End Date must be greater than Start Date."); return; }

  const isEdit = document.getElementById("task_id").readOnly;
  const name = document.getElementById("task_name").value;
  const assignedEmp = document.getElementById("task_assigned_to_emp").value;
  const assignedTxt = document.getElementById("task_assigned_to_txt").value.trim();
  const finalAssigned = assignedEmp || assignedTxt;
  if (!finalAssigned) { alert("Please select or type an assignee."); return; }

  try {
    const savedId = await addTask({
      task_id: document.getElementById("task_id").value || null,
      project_id: document.getElementById("task_project_id").value,
      wbs_code: document.getElementById("task_wbs_code").value,
      task_name: name,
      assigned_to: finalAssigned,
      task_startDate: document.getElementById("task_startDate").value,
      task_endDate: document.getElementById("task_endDate").value,
      progress_percent: document.getElementById("task_progress_percent").value,
      task_status: document.getElementById("task_status").value,
      working_update: document.getElementById("task_working_update").value
    });
    await addAuditLog({
      user_email: currentUserEmail || "admin@example.com",
      action_type: isEdit ? "UPDATE" : "CREATE",
      collection_name: "tbl_tasks",
      record_id: savedId,
      details: `${isEdit ? "Updated" : "Assigned"} task "${name}"`
    });
    document.getElementById("taskForm").reset();
    document.getElementById("task_id").readOnly = false;
    document.getElementById("tskFormTitle").innerHTML = '<i class="bi bi-activity me-2 text-primary"></i>Assign Project Task';
    document.getElementById("tskSubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Save Task';
    document.getElementById("cancelTskEditBtn").classList.add("d-none");
    document.querySelectorAll('input[type="date"]').forEach(input => {
      if (input.id === "exp_clearance_date" || input.id === "inv_date_received" || input.id === "issueDate" || input.id === "filterStartDate" || input.id === "filterEndDate") return;
      input.value = todayDateStr;
    });
    refreshTasks();
    refreshProjects();
    refreshAuditLogs();
    alert("Task saved successfully.");
  } catch (err) {
    alert("Failed to save task: " + err.message);
  }
};

document.getElementById("requisitionForm").onsubmit = async (e) => {
  e.preventDefault();
  const isEdit = document.getElementById("requisition_id").readOnly;
  const desc = document.getElementById("req_item_description").value;

  try {
    const savedId = await addRequisition({
      requisition_id: document.getElementById("requisition_id").value || null,
      project_id: document.getElementById("req_project_id").value,
      item_category: document.getElementById("req_item_category").value,
      item_description: desc,
      qty_requested: document.getElementById("req_qty_requested").value,
      est_unit_cost: document.getElementById("req_est_unit_cost").value,
      dept_approval: document.getElementById("req_dept_approval").value,
      rejection_reason: document.getElementById("req_rejection_reason").value
    });
    await addAuditLog({
      user_email: currentUserEmail || "admin@example.com",
      action_type: isEdit ? "UPDATE" : "CREATE",
      collection_name: "tbl_requisitions",
      record_id: savedId,
      details: `${isEdit ? "Updated" : "Created"} requisition request: "${desc.substring(0, 20)}..."`
    });
    document.getElementById("requisitionForm").reset();
    document.getElementById("requisition_id").readOnly = false;
    document.getElementById("rejectionReasonContainer").classList.add("d-none");
    document.getElementById("reqFormTitle").innerHTML = '<i class="bi bi-file-earmark-plus me-2 text-primary"></i>Raise Purchase Requisition';
    document.getElementById("reqSubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Save Requisition';
    document.getElementById("cancelReqEditBtn").classList.add("d-none");
    refreshRequisitions();
    refreshAuditLogs();
    alert("Requisition saved successfully.");
  } catch (err) {
    alert("Failed to save requisition: " + err.message);
  }
};

document.getElementById("purchaseForm").onsubmit = async (e) => {
  e.preventDefault();
  const isEdit = document.getElementById("po_number").readOnly;
  const vendor = document.getElementById("po_vendor_name").value;

  try {
    const savedId = await addPurchaseOrder({
      po_number: document.getElementById("po_number").value || null,
      requisition_id: document.getElementById("po_requisition_id").value,
      project_id: document.getElementById("po_project_id").value,
      vendor_name: vendor,
      final_po_total: document.getElementById("po_final_total").value,
      payment_terms: document.getElementById("po_payment_terms").value,
      po_issue_date: document.getElementById("po_issue_date").value,
      po_status: document.getElementById("po_status").value
    });
    await addAuditLog({
      user_email: currentUserEmail || "admin@example.com",
      action_type: isEdit ? "UPDATE" : "CREATE",
      collection_name: "tbl_purchase_orders",
      record_id: savedId,
      details: `${isEdit ? "Updated" : "Issued"} Purchase Order: "${savedId}" to vendor "${vendor}"`
    });
    document.getElementById("purchaseForm").reset();
    document.getElementById("po_number").readOnly = false;
    document.getElementById("poFormTitle").innerHTML = '<i class="bi bi-cart-check me-2 text-primary"></i>Issue Purchase Order';
    document.getElementById("poSubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Save Purchase Order';
    document.getElementById("cancelPoEditBtn").classList.add("d-none");
    document.querySelectorAll('input[type="date"]').forEach(input => {
      if (input.id === "exp_clearance_date" || input.id === "inv_date_received" || input.id === "issueDate" || input.id === "filterStartDate" || input.id === "filterEndDate") return;
      input.value = todayDateStr;
    });
    refreshPurchases();
    refreshRequisitions();
    refreshExpenses();
    refreshAuditLogs();
    alert("Purchase Order saved successfully.");
  } catch (err) {
    alert("Failed to save Purchase Order: " + err.message);
  }
};

document.getElementById("expenseForm").onsubmit = async (e) => {
  e.preventDefault();
  const isEdit = document.getElementById("expense_id").readOnly;
  const invoiceNum = document.getElementById("exp_vendor_invoice_num").value;

  try {
    const savedId = await addExpense({
      expense_id: document.getElementById("expense_id").value || null,
      project_id: document.getElementById("exp_project_id").value,
      expense_routing_type: document.getElementById("exp_routing_type").value,
      po_number_ref: document.getElementById("exp_po_number_ref").value,
      vendor_invoice_num: invoiceNum,
      invoice_amount: document.getElementById("exp_invoice_amount").value,
      amount_paid: document.getElementById("exp_amount_paid").value,
      payment_status: document.getElementById("exp_payment_status").value,
      payment_method: document.getElementById("exp_payment_method").value,
      clearance_date: document.getElementById("exp_clearance_date").value
    });
    await addAuditLog({
      user_email: currentUserEmail || "admin@example.com",
      action_type: isEdit ? "UPDATE" : "CREATE",
      collection_name: "tbl_expenses",
      record_id: savedId,
      details: `${isEdit ? "Updated" : "Logged"} expense ledger entry "${savedId}"`
    });
    document.getElementById("expenseForm").reset();
    document.getElementById("expense_id").readOnly = false;
    document.getElementById("poRefSelectorContainer").classList.add("d-none");
    document.getElementById("expFormTitle").innerHTML = '<i class="bi bi-cash-coin me-2 text-primary"></i>Log Project Expense';
    document.getElementById("expSubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Save Expense Entry';
    document.getElementById("cancelExpEditBtn").classList.add("d-none");
    refreshExpenses();
    refreshAuditLogs();
    alert("Expense voucher logged successfully.");
  } catch (err) {
    alert("Failed to save expense entry: " + err.message);
  }
};

document.getElementById("paymentForm").onsubmit = async (e) => {
  e.preventDefault();
  const isEdit = document.getElementById("invoice_id").readOnly;
  const milestone = document.getElementById("inv_milestone_type").value;

  try {
    const savedId = await addClientPayment({
      invoice_id: document.getElementById("invoice_id").value || null,
      project_id: document.getElementById("inv_project_id").value,
      milestone_type: milestone,
      invoice_date: document.getElementById("inv_date").value,
      due_date: document.getElementById("inv_due_date").value,
      invoiced_amount: document.getElementById("inv_amount").value,
      amount_received: document.getElementById("inv_amount_received").value,
      payment_status: document.getElementById("inv_payment_status").value,
      date_received: document.getElementById("inv_date_received").value,
      transaction_ref: document.getElementById("inv_transaction_ref").value
    });
    await addAuditLog({
      user_email: currentUserEmail || "admin@example.com",
      action_type: isEdit ? "UPDATE" : "CREATE",
      collection_name: "tbl_client_payments",
      record_id: savedId,
      details: `${isEdit ? "Updated" : "Raised"} client invoice for "${milestone}"`
    });
    document.getElementById("paymentForm").reset();
    document.getElementById("invoice_id").readOnly = false;
    document.getElementById("payFormTitle").innerHTML = '<i class="bi bi-cash-stack me-2 text-primary"></i>Raise Client Invoice';
    document.getElementById("paySubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Save Invoice';
    document.getElementById("cancelPayEditBtn").classList.add("d-none");
    document.querySelectorAll('input[type="date"]').forEach(input => {
      if (input.id === "exp_clearance_date" || input.id === "inv_date_received" || input.id === "issueDate" || input.id === "filterStartDate" || input.id === "filterEndDate") return;
      input.value = todayDateStr;
    });
    refreshPayments();
    refreshAuditLogs();
    alert("Invoice saved successfully.");
  } catch (err) {
    alert("Failed to save invoice: " + err.message);
  }
};

document.getElementById("ticketForm").onsubmit = async (e) => {
  e.preventDefault();
  const isEdit = document.getElementById("ticket_id").readOnly;
  const subject = document.getElementById("ticket_subject").value;

  try {
    const savedId = await addSupportTicket({
      ticket_id: document.getElementById("ticket_id").value || null,
      project_id: document.getElementById("ticket_project_id").value,
      requester_id: document.getElementById("ticket_requester_id").value,
      ticket_subject: subject,
      ticket_desc: document.getElementById("ticket_desc").value,
      priority: document.getElementById("ticket_priority").value,
      assigned_to: document.getElementById("ticket_assigned_to").value,
      ticket_status: document.getElementById("ticket_status").value,
      resolution_notes: document.getElementById("ticket_resolution_notes").value,
      asset_id: document.getElementById("ticket_asset_id").value
    });
    await addAuditLog({
      user_email: currentUserEmail || "admin@example.com",
      action_type: isEdit ? "UPDATE" : "CREATE",
      collection_name: "tbl_support_tickets",
      record_id: savedId,
      details: `${isEdit ? "Updated" : "Logged"} support ticket: "${subject.substring(0,20)}..."`
    });
    document.getElementById("ticketForm").reset();
    document.getElementById("ticket_id").readOnly = false;
    document.getElementById("tckFormTitle").innerHTML = '<i class="bi bi-headset me-2 text-primary"></i>Raise SLA Support Ticket';
    document.getElementById("tckSubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Save Support Ticket';
    document.getElementById("cancelTckEditBtn").classList.add("d-none");
    refreshTickets();
    refreshAuditLogs();
    alert("Support ticket saved successfully.");
  } catch (err) {
    alert("Failed to save ticket: " + err.message);
  }
};

document.getElementById("hostingForm").onsubmit = async (e) => {
  e.preventDefault();
  const isEdit = document.getElementById("hosting_asset_id").readOnly;
  const url = document.getElementById("hosting_asset_url").value;

  try {
    const savedId = await addDomainHosting({
      asset_id: document.getElementById("hosting_asset_id").value || null,
      project_id: document.getElementById("hosting_project_id").value,
      package_name: document.getElementById("hosting_package_name").value,
      hosting_capacity: document.getElementById("hosting_capacity").value,
      asset_type: document.getElementById("hosting_asset_type").value,
      asset_url: url,
      provider_name: document.getElementById("hosting_provider_name").value,
      cost_price: document.getElementById("hosting_cost_price").value,
      selling_price: document.getElementById("hosting_selling_price").value,
      reg_date: document.getElementById("hosting_reg_date").value,
      billing_cycle: document.getElementById("hosting_billing_cycle").value,
      renewal_date: document.getElementById("hosting_renewal_date").value,
      asset_status: document.getElementById("hosting_asset_status").value
    });
    await addAuditLog({
      user_email: currentUserEmail || "admin@example.com",
      action_type: isEdit ? "UPDATE" : "CREATE",
      collection_name: "tbl_domain_hosting",
      record_id: savedId,
      details: `${isEdit ? "Updated" : "Registered"} infrastructure asset: "${url}"`
    });
    document.getElementById("hostingForm").reset();
    document.getElementById("hosting_asset_id").readOnly = false;
    document.getElementById("hostingFormTitle").innerHTML = '<i class="bi bi-server me-2 text-primary"></i>Register Domain & Hosting Asset';
    document.getElementById("hostingSubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Save Asset';
    document.getElementById("cancelHostingEditBtn").classList.add("d-none");
    document.querySelectorAll('input[type="date"]').forEach(input => {
      if (input.id === "exp_clearance_date" || input.id === "inv_date_received" || input.id === "issueDate" || input.id === "filterStartDate" || input.id === "filterEndDate") return;
      input.value = todayDateStr;
    });
    refreshHosting();
    refreshAuditLogs();
    alert("Asset saved successfully.");
  } catch (err) {
    alert("Failed to save asset: " + err.message);
  }
};

document.getElementById("addCertForm").onsubmit = async (e) => {
  e.preventDefault();
  const certSuffix = document.getElementById("certId").value.trim();
  const finalCertId = "INTREX-CERT-" + certSuffix;
  const studentId = document.getElementById("certStudentId").value.trim();
  const studentName = document.getElementById("studentName").value.trim();
  const courseName = document.getElementById("courseName").value;
  const issueDate = document.getElementById("issueDate").value;
  const grade = document.getElementById("grade").value.trim();
  const batch = document.getElementById("certBatch").value.trim();
  const status = document.getElementById("certStatus").value;

  const successAlert = document.getElementById("actionSuccess");
  const errorAlert = document.getElementById("actionError");
  const submitBtn = document.getElementById("submitCertBtn");

  successAlert.classList.add("d-none");
  errorAlert.classList.add("d-none");

  try {
    submitBtn.disabled = true;
    const isEdit = editingCertId !== null;

    if (isEdit) {
      await addCertificate({ certificateId: editingCertId, studentId, studentName, courseName, issueDate, grade, status, batch });
      await addAuditLog({
        user_email: currentUserEmail || "admin@example.com",
        action_type: "UPDATE",
        collection_name: "certificates",
        record_id: editingCertId,
        details: `Updated certificate credentials for "${studentName}"`
      });
      successAlert.querySelector("span").innerText = "Certificate updated successfully!";
      cancelCertEditMode();
    } else {
      const exists = allRecords.some(r => r.certificateId === finalCertId);
      if (exists) { throw new Error(`Certificate ID ${finalCertId} already exists!`); }

      await addCertificate({ certificateId: finalCertId, studentId, studentName, courseName, issueDate, grade, status, batch });
      await addAuditLog({
        user_email: currentUserEmail || "admin@example.com",
        action_type: "CREATE",
        collection_name: "certificates",
        record_id: finalCertId,
        details: `Generated certificate "${finalCertId}" for "${studentName}"`
      });
      successAlert.querySelector("span").innerText = "Certificate registered successfully!";
      document.getElementById("addCertForm").reset();
      document.getElementById("issueDate").value = todayDateStr;
    }

    successAlert.classList.remove("d-none");
    document.getElementById("formTitle").scrollIntoView({ behavior: "smooth" });
    loadRecords();
    refreshAuditLogs();

    setTimeout(() => {
      successAlert.classList.add("d-none");
    }, 3000);

  } catch (err) {
    errorAlert.querySelector("span").innerText = "Error: " + err.message;
    errorAlert.classList.remove("d-none");
    document.getElementById("formTitle").scrollIntoView({ behavior: "smooth" });
  } finally {
    submitBtn.disabled = false;
  }
};

document.getElementById("regForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const fullName = document.getElementById("regFullName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const phone = document.getElementById("regPhone").value.trim();
  const course = document.getElementById("regCourse").value;
  const batch = document.getElementById("regBatch").value.trim();
  const education = document.getElementById("regEducation").value;
  const schedule = document.getElementById("regSchedule").value;
  const totalFee = Number(document.getElementById("regFee").value) || 0;
  const discount = Number(document.getElementById("regDiscount").value) || 0;
  const amountPaid = Number(document.getElementById("regAmountPaid").value) || 0;
  const paymentType = document.getElementById("regPaymentType").value;
  const transactionId = document.getElementById("regPaymentTxId").value.trim();
  const message = document.getElementById("regMessage").value.trim();

  const successAlert = document.getElementById("regSuccess");
  const errorAlert = document.getElementById("regError");
  const submitBtn = document.getElementById("submitRegBtn");

  successAlert.classList.add("d-none");
  errorAlert.classList.add("d-none");

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status"></span>Saving...`;

    if (editingStudentId) {
      await updateRegistration(editingStudentId, { fullName, email, phone, course, batch, education, schedule, message });
      await addAuditLog({
        user_email: currentUserEmail || "admin@example.com",
        action_type: "UPDATE",
        collection_name: "registrations",
        record_id: editingStudentId,
        details: `Updated course registration details for "${fullName}"`
      });
      successAlert.querySelector("span").innerText = "Registration updated successfully!";
      cancelRegEditMode();
    } else {
      const generatedId = await addRegistration({ fullName, email, phone, course, batch, education, schedule, message, totalFee, discount, amountPaid, paymentType, transactionId });
      await addAuditLog({
        user_email: currentUserEmail || "admin@example.com",
        action_type: "CREATE",
        collection_name: "registrations",
        record_id: generatedId,
        details: `Created new course registration for "${fullName}" (ID: ${generatedId})`
      });
      successAlert.querySelector("span").innerHTML = `Student registered successfully!<br><strong>Student ID:</strong> <code class="text-dark font-monospace">${generatedId}</code>`;
      document.getElementById("regForm").reset();
    }

    successAlert.classList.remove("d-none");
    document.getElementById("regFormTitle").scrollIntoView({ behavior: "smooth" });
    await loadRegistrations();
    await loadPayments();
    refreshAuditLogs();

    setTimeout(() => {
      successAlert.classList.add("d-none");
      const tab = document.getElementById("student-list-tab");
      if (tab) bootstrap.Tab.getOrCreateInstance(tab).show();
    }, 3000);

  } catch (err) {
    errorAlert.querySelector("span").innerText = "Error: " + err.message;
    errorAlert.classList.remove("d-none");
    document.getElementById("regFormTitle").scrollIntoView({ behavior: "smooth" });
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = editingStudentId ? `<i class="bi bi-check-lg me-2"></i>Update Registration` : `<i class="bi bi-cloud-arrow-up me-2"></i>Save Registration & Payment Record`;
  }
});

// Update payment form modal
document.getElementById("updatePaymentForm").onsubmit = async (e) => {
  e.preventDefault();
  const studentId = document.getElementById("updatePayStudentId").value;
  const fee = Number(document.getElementById("updatePayFee").value) || 0;
  const disc = Number(document.getElementById("updatePayDiscount").value) || 0;
  const paid = Number(document.getElementById("updatePayAmountPaid").value) || 0;
  const type = document.getElementById("updatePayType").value;
  const txId = document.getElementById("updatePayTxId").value.trim();

  try {
    await updatePayment(studentId, fee, disc, paid, type, txId);
    await addAuditLog({
      user_email: currentUserEmail || "admin@example.com",
      action_type: "UPDATE",
      collection_name: "payments",
      record_id: studentId,
      details: `Updated course payment metrics for student: ${studentId}`
    });
    
    bootstrap.Modal.getInstance(document.getElementById("updatePaymentModal")).hide();
    loadPayments();
    refreshAuditLogs();
    alert("Payment updated successfully.");
  } catch (err) {
    alert("Failed to update payment: " + err.message);
  }
};

// ==========================================
// CANCEL EDIT SHORTCUTS
// ==========================================
function cancelCertEditMode() {
  editingCertId = null;
  document.getElementById("certId").disabled = false;
  document.getElementById("addCertForm").reset();
  document.getElementById("issueDate").value = todayDateStr;
  document.getElementById("formTitle").innerHTML = '<i class="bi bi-patch-plus me-2 text-primary"></i>Generate Certificate Record';
  document.getElementById("submitCertBtn").innerHTML = '<i class="bi bi-cloud-arrow-up me-2"></i>Save Certificate to Firestore';
  document.getElementById("cancelEditBtn").classList.add("d-none");
}
document.getElementById("cancelEditBtn").onclick = cancelCertEditMode;

function cancelRegEditMode() {
  editingStudentId = null;
  document.getElementById("regForm").reset();
  document.getElementById("regPaymentSection").classList.remove("d-none");
  document.getElementById("regFormTitle").innerHTML = '<i class="bi bi-pencil-square me-2 text-primary"></i>Course Registration form';
  document.getElementById("submitRegBtn").innerHTML = '<i class="bi bi-cloud-arrow-up me-2"></i>Save Registration & Payment Record';
  document.getElementById("cancelRegEditBtn").classList.add("d-none");
}
document.getElementById("cancelRegEditBtn").onclick = cancelRegEditMode;

// Cancel buttons bindings (Solutions)
document.getElementById("cancelProjEditBtn").onclick = () => {
  document.getElementById("projectForm").reset();
  document.getElementById("project_id").readOnly = false;
  document.getElementById("projFormTitle").innerHTML = '<i class="bi bi-kanban me-2 text-primary"></i>Create Project';
  document.getElementById("projSubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Save Project';
  document.getElementById("cancelProjEditBtn").classList.add("d-none");
};

document.getElementById("cancelEmpEditBtn").onclick = () => {
  document.getElementById("employeeForm").reset();
  document.getElementById("employee_id").readOnly = false;
  document.getElementById("empFormTitle").innerHTML = '<i class="bi bi-people me-2 text-primary"></i>Register New Employee';
  document.getElementById("empSubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Save Employee';
  document.getElementById("cancelEmpEditBtn").classList.add("d-none");
};

document.getElementById("cancelConEditBtn").onclick = () => {
  document.getElementById("contactForm").reset();
  document.getElementById("contact_id").readOnly = false;
  document.getElementById("conFormTitle").innerHTML = '<i class="bi bi-telephone-inbound me-2 text-primary"></i>Register External Contact';
  document.getElementById("conSubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Save Contact';
  document.getElementById("cancelConEditBtn").classList.add("d-none");
};

document.getElementById("cancelMtgEditBtn").onclick = () => {
  document.getElementById("meetingForm").reset();
  document.getElementById("meeting_id").readOnly = false;
  document.getElementById("mtgFormTitle").innerHTML = '<i class="bi bi-calendar-event me-2 text-primary"></i>Schedule Meeting';
  document.getElementById("mtgSubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Schedule Meeting';
  document.getElementById("cancelMtgEditBtn").classList.add("d-none");
};

document.getElementById("cancelBgtEditBtn").onclick = () => {
  document.getElementById("budgetForm").reset();
  document.getElementById("budget_line_id").readOnly = false;
  document.getElementById("bgtFormTitle").innerHTML = '<i class="bi bi-wallet2 me-2 text-primary"></i>Configure Budget Line';
  document.getElementById("bgtSubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Save Budget Line';
  document.getElementById("cancelBgtEditBtn").classList.add("d-none");
};

document.getElementById("cancelTskEditBtn").onclick = () => {
  document.getElementById("taskForm").reset();
  document.getElementById("task_id").readOnly = false;
  document.getElementById("tskFormTitle").innerHTML = '<i class="bi bi-activity me-2 text-primary"></i>Assign Project Task';
  document.getElementById("tskSubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Save Task';
  document.getElementById("cancelTskEditBtn").classList.add("d-none");
};

document.getElementById("cancelReqEditBtn").onclick = () => {
  document.getElementById("requisitionForm").reset();
  document.getElementById("requisition_id").readOnly = false;
  document.getElementById("rejectionReasonContainer").classList.add("d-none");
  document.getElementById("reqFormTitle").innerHTML = '<i class="bi bi-file-earmark-plus me-2 text-primary"></i>Raise Purchase Requisition';
  document.getElementById("reqSubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Save Requisition';
  document.getElementById("cancelReqEditBtn").classList.add("d-none");
};

document.getElementById("cancelPoEditBtn").onclick = () => {
  document.getElementById("purchaseForm").reset();
  document.getElementById("po_number").readOnly = false;
  document.getElementById("poFormTitle").innerHTML = '<i class="bi bi-cart-check me-2 text-primary"></i>Issue Purchase Order';
  document.getElementById("poSubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Save Purchase Order';
  document.getElementById("cancelPoEditBtn").classList.add("d-none");
};

document.getElementById("cancelExpEditBtn").onclick = () => {
  document.getElementById("expenseForm").reset();
  document.getElementById("expense_id").readOnly = false;
  document.getElementById("poRefSelectorContainer").classList.add("d-none");
  document.getElementById("expFormTitle").innerHTML = '<i class="bi bi-cash-coin me-2 text-primary"></i>Log Project Expense';
  document.getElementById("expSubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Save Expense Entry';
  document.getElementById("cancelExpEditBtn").classList.add("d-none");
};

document.getElementById("cancelPayEditBtn").onclick = () => {
  document.getElementById("paymentForm").reset();
  document.getElementById("invoice_id").readOnly = false;
  document.getElementById("payFormTitle").innerHTML = '<i class="bi bi-cash-stack me-2 text-primary"></i>Raise Client Invoice';
  document.getElementById("paySubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Save Invoice';
  document.getElementById("cancelPayEditBtn").classList.add("d-none");
};

document.getElementById("cancelTckEditBtn").onclick = () => {
  document.getElementById("ticketForm").reset();
  document.getElementById("ticket_id").readOnly = false;
  document.getElementById("tckFormTitle").innerHTML = '<i class="bi bi-headset me-2 text-primary"></i>Raise SLA Support Ticket';
  document.getElementById("tckSubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Save Support Ticket';
  document.getElementById("cancelTckEditBtn").classList.add("d-none");
};

document.getElementById("cancelHostingEditBtn").onclick = () => {
  document.getElementById("hostingForm").reset();
  document.getElementById("hosting_asset_id").readOnly = false;
  document.getElementById("hostingFormTitle").innerHTML = '<i class="bi bi-server me-2 text-primary"></i>Register Domain & Hosting Asset';
  document.getElementById("hostingSubmitBtn").innerHTML = '<i class="bi bi-save me-2"></i>Save Asset';
  document.getElementById("cancelHostingEditBtn").classList.add("d-none");
};

// ==========================================
// REPORT GENERATOR & OTHER CONTROLLERS
// ==========================================
document.getElementById("generateReportBtn")?.addEventListener("click", () => {
  const projId = document.getElementById("report_project_id").value;
  if (!projId) { alert("Please select a project first."); return; }
  
  const project = allProjects.find(p => p.project_id === projId);
  if (!project) { alert("Selected project not found."); return; }
  
  document.getElementById("reportOutput").classList.remove("d-none");
  document.getElementById("printReportBtn").classList.remove("d-none");
  
  document.getElementById("repProjName").textContent = project.project_name;
  document.getElementById("repProjId").textContent = project.project_id;
  document.getElementById("repProjStatus").textContent = project.project_status;
  
  const statusBadge = document.getElementById("repProjStatus");
  statusBadge.className = "badge px-3 py-2 fw-semibold";
  if (project.project_status === "Active" || project.project_status === "Completed") {
    statusBadge.classList.add("bg-success", "text-white");
  } else if (project.project_status === "Pipeline" || project.project_status === "On Hold") {
    statusBadge.classList.add("bg-warning", "text-dark");
  } else {
    statusBadge.classList.add("bg-danger", "text-white");
  }
  
  const pm = allEmployees.find(e => e.employee_id === project.project_manager);
  document.getElementById("repProjManager").textContent = pm ? pm.employee_name : (project.project_manager || "—");
  
  const client = allContacts.find(c => c.contact_id === project.client_sponsor);
  document.getElementById("repProjClient").textContent = client ? client.contact_name : (project.client_sponsor || "—");
  
  document.getElementById("repProjTimeline").textContent = `${project.start_date} to ${project.end_date}`;
  document.getElementById("repProjDesc").textContent = project.project_desc || "No description provided.";
  
  const projBudgets = allBudgets.filter(b => b.project_id === projId);
  const projReqs = allRequisitions.filter(r => r.project_id === projId);
  const projPOs = allPurchaseOrders.filter(po => po.project_id === projId);
  const projExpenses = allExpenses.filter(e => e.project_id === projId);
  const projInvoices = allClientPayments.filter(inv => inv.project_id === projId);
  const projHosting = allDomainHosting.filter(a => a.project_id === projId);
  
  const totalBudget = projBudgets.reduce((sum, b) => sum + (Number(b.allocated_amount) || 0), 0);
  const totalExpenses = projExpenses.reduce((sum, e) => sum + (Number(e.amount_paid) || 0), 0);
  const totalInvoiced = projInvoices.reduce((sum, inv) => sum + (Number(inv.invoiced_amount) || 0), 0);
  const totalCollected = projInvoices.reduce((sum, inv) => sum + (Number(inv.amount_received) || 0), 0);
  
  document.getElementById("repTotalBudget").textContent = `${totalBudget.toLocaleString()} BDT`;
  document.getElementById("repTotalExpenses").textContent = `${totalExpenses.toLocaleString()} BDT`;
  document.getElementById("repTotalInvoiced").textContent = `${totalInvoiced.toLocaleString()} BDT`;
  document.getElementById("repTotalCollected").textContent = `${totalCollected.toLocaleString()} BDT`;
  
  const budgetBody = document.getElementById("repBudgetBody");
  if (projBudgets.length === 0) {
    budgetBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">No budget records found.</td></tr>';
  } else {
    budgetBody.innerHTML = projBudgets.map(b => {
      const approver = allContacts.find(c => c.contact_id === b.approved_by) || allEmployees.find(e => e.employee_id === b.approved_by);
      const appName = approver ? (approver.contact_name || approver.employee_name) : (b.approved_by || "—");
      return `
        <tr>
          <td><code class="text-dark font-monospace">${b.budget_line_id}</code></td>
          <td><span class="badge bg-secondary text-white">${b.cost_category}</span></td>
          <td class="small">${b.line_description || '—'}</td>
          <td>${appName}</td>
          <td class="text-end fw-semibold text-dark">${(Number(b.allocated_amount) || 0).toLocaleString()} BDT</td>
        </tr>
      `;
    }).join('');
  }
  
  const reqPOBody = document.getElementById("repReqPOBody");
  if (projReqs.length === 0) {
    reqPOBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">No requisition records found.</td></tr>';
  } else {
    reqPOBody.innerHTML = projReqs.map(r => {
      const matchingPO = projPOs.find(po => po.requisition_id === r.requisition_id);
      const poCell = matchingPO 
        ? `<code class="text-dark font-monospace">${matchingPO.po_number}</code> <span class="small text-muted">(${matchingPO.vendor_name})</span>`
        : '<span class="text-muted small"><em>No PO Generated</em></span>';
      
      let approvalBadgeClass = 'bg-secondary';
      if (r.dept_approval === 'Approved') approvalBadgeClass = 'bg-success';
      else if (r.dept_approval === 'Pending Review') approvalBadgeClass = 'bg-warning text-dark';
      else if (r.dept_approval === 'Rejected') approvalBadgeClass = 'bg-danger';
      
      return `
        <tr>
          <td><code class="text-dark font-monospace">${r.requisition_id}</code></td>
          <td><span class="badge bg-light text-dark border">${r.item_category}</span></td>
          <td class="small">${r.item_description}</td>
          <td class="small font-monospace">${r.qty_requested} x ${(Number(r.est_unit_cost) || 0).toLocaleString()}</td>
          <td class="fw-semibold text-dark">${(Number(r.est_total_cost) || 0).toLocaleString()} BDT</td>
          <td><span class="badge ${approvalBadgeClass}">${r.dept_approval}</span></td>
          <td>${poCell}</td>
        </tr>
      `;
    }).join('');
  }
  
  const expenseBody = document.getElementById("repExpenseBody");
  if (projExpenses.length === 0) {
    expenseBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">No expense records logged.</td></tr>';
  } else {
    expenseBody.innerHTML = projExpenses.map(e => {
      let statusClass = 'bg-secondary';
      if (e.payment_status === 'Fully Settled' || e.payment_status === 'Fully Paid') statusClass = 'bg-success';
      else if (e.payment_status === 'Partially Paid') statusClass = 'bg-warning text-dark';
      else if (e.payment_status === 'Unpaid / Awaiting Approval') statusClass = 'bg-danger';
      
      return `
        <tr>
          <td><code class="text-dark font-monospace">${e.expense_id}</code></td>
          <td><span class="small">${e.expense_routing_type}</span></td>
          <td><code class="text-dark font-monospace">${e.po_number_ref || e.vendor_invoice_num}</code></td>
          <td><span class="small">${e.payment_method}</span></td>
          <td><span class="small">${e.clearance_date || '—'}</span></td>
          <td><span class="badge ${statusClass}">${e.payment_status}</span></td>
          <td class="text-end small">${(Number(e.invoice_amount) || 0).toLocaleString()} BDT</td>
          <td class="text-end fw-semibold text-danger">${(Number(e.amount_paid) || 0).toLocaleString()} BDT</td>
        </tr>
      `;
    }).join('');
  }
  
  const invoiceBody = document.getElementById("repInvoiceBody");
  if (projInvoices.length === 0) {
    invoiceBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">No client invoice records found.</td></tr>';
  } else {
    invoiceBody.innerHTML = projInvoices.map(inv => {
      let statusClass = 'bg-secondary';
      if (inv.payment_status === 'Fully Paid') statusClass = 'bg-success';
      else if (inv.payment_status === 'Partially Paid') statusClass = 'bg-warning text-dark';
      else if (inv.payment_status === 'Awaiting Payment') statusClass = 'bg-danger';
      
      return `
        <tr>
          <td><code class="text-dark font-monospace">${inv.invoice_id}</code></td>
          <td><span class="small font-semibold">${inv.milestone_type}</span></td>
          <td><span class="small">${inv.invoice_date} to ${inv.due_date}</span></td>
          <td><span class="badge ${statusClass}">${inv.payment_status}</span></td>
          <td><span class="small">${inv.date_received || '—'}</span></td>
          <td class="text-end small">${(Number(inv.invoiced_amount) || 0).toLocaleString()} BDT</td>
          <td class="text-end fw-semibold text-success">${(Number(inv.amount_received) || 0).toLocaleString()} BDT</td>
          <td class="text-end fw-bold text-dark">${(Number(inv.outstanding_balance) || 0).toLocaleString()} BDT</td>
        </tr>
      `;
    }).join('');
  }
  
  const hostingBody = document.getElementById("repHostingBody");
  if (projHosting.length === 0) {
    hostingBody.innerHTML = '<tr><td colspan="10" class="text-center text-muted py-3">No hosting assets allocated.</td></tr>';
  } else {
    hostingBody.innerHTML = projHosting.map(a => {
      const pkgBadgeMap = { "Basic": "bg-info text-dark", "Plus": "bg-warning text-dark", "Business": "bg-success" };
      const pkgBadge = a.package_name
        ? `<span class="badge ${pkgBadgeMap[a.package_name] || 'bg-secondary'}">${a.package_name}</span>`
        : '<span class="text-muted small">—</span>';
      
      let statusClass = 'bg-secondary';
      if (a.asset_status === 'Active / Good Standing') statusClass = 'bg-success';
      else if (a.asset_status === 'Expired / Action Required') statusClass = 'bg-danger';
      else if (a.asset_status === 'Suspended / Terminated') statusClass = 'bg-dark text-white';
      
      return `
        <tr>
          <td><code class="text-dark font-monospace">${a.asset_id}</code></td>
          <td>${pkgBadge}</td>
          <td><span class="small">${a.hosting_capacity || '—'}</span></td>
          <td><span class="small">${a.asset_type}</span></td>
          <td><a href="${a.asset_url.startsWith('http') ? a.asset_url : 'https://' + a.asset_url}" target="_blank" class="small fw-semibold text-decoration-none">${a.asset_url}</a></td>
          <td><span class="small">${a.provider_name}</span></td>
          <td class="text-end small">${(Number(a.cost_price) || 0).toLocaleString()} BDT</td>
          <td class="text-end fw-semibold text-success">${(Number(a.selling_price) || 0).toLocaleString()} BDT</td>
          <td class="fw-semibold small">${a.renewal_date}</td>
          <td><span class="badge ${statusClass}">${a.asset_status}</span></td>
        </tr>
      `;
    }).join('');
  }
});

document.getElementById("printReportBtn")?.addEventListener("click", () => {
  const printContents = document.getElementById("reportOutput").innerHTML;
  const win = window.open("", "_blank");
  win.document.write(`
    <html>
    <head>
      <title>Project Report - ${document.getElementById("repProjId").textContent}</title>
      <link href="assets/vendors/bootstrap/bootstrap.min.css" rel="stylesheet">
      <style>
        body { font-family: sans-serif; padding: 40px; background: white; color: black; }
        .badge { border: 1px solid #ddd; padding: 4px 8px; border-radius: 4px; font-size: 0.85em; }
        .bg-success { background-color: #d4edda !important; color: #155724 !important; }
        .bg-warning { background-color: #fff3cd !important; color: #856404 !important; }
        .bg-danger { background-color: #f8d7da !important; color: #721c24 !important; }
        .bg-secondary { background-color: #e2e3e5 !important; color: #383d41 !important; }
        .table-light { background-color: #f8f9fa !important; }
        code { font-family: monospace; }
        @media print { body { padding: 0; } .no-print { display: none; } }
      </style>
    </head>
    <body>
      ${printContents}
    </body>
    </html>
  `);
  
  const script = win.document.createElement("script");
  script.textContent = `
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 500);
    };
  `;
  win.document.body.appendChild(script);
  win.document.close();
});

document.getElementById("logs-tab")?.addEventListener("click", refreshAuditLogs);
document.getElementById("refreshLogsBtn")?.addEventListener("click", refreshAuditLogs);

// Form dynamic selectors dependencies
document.getElementById("po_requisition_id")?.addEventListener("change", (e) => {
  const opt = e.target.selectedOptions[0];
  if (opt) {
    document.getElementById("po_project_id").value = opt.dataset.project;
    document.getElementById("po_final_total").value = opt.dataset.total;
  }
});

document.getElementById("exp_routing_type")?.addEventListener("change", (e) => {
  if (e.target.value === "PO-Backed") {
    document.getElementById("poRefSelectorContainer").classList.remove("d-none");
  } else {
    document.getElementById("poRefSelectorContainer").classList.add("d-none");
  }
});

document.getElementById("exp_po_number_ref")?.addEventListener("change", (e) => {
  const opt = e.target.selectedOptions[0];
  if (opt) {
    document.getElementById("exp_project_id").value = opt.dataset.project;
    document.getElementById("exp_invoice_amount").value = opt.dataset.total;
  }
});

document.getElementById("req_dept_approval")?.addEventListener("change", (e) => {
  if (e.target.value === "Rejected") {
    document.getElementById("rejectionReasonContainer").classList.remove("d-none");
  } else {
    document.getElementById("rejectionReasonContainer").classList.add("d-none");
  }
});

document.getElementById("regCourse")?.addEventListener("change", (e) => {
  const fee = courseFees[e.target.value] || 0;
  document.getElementById("regFee").value = fee;
  document.getElementById("regDiscount").value = 0;
  document.getElementById("regAmountPaid").value = 0;
});

document.getElementById("regPaymentType")?.addEventListener("change", (e) => {
  if (e.target.value === "Cash") {
    document.getElementById("regPaymentTxIdContainer").classList.add("d-none");
  } else {
    document.getElementById("regPaymentTxIdContainer").classList.remove("d-none");
  }
});

document.getElementById("updatePayType")?.addEventListener("change", (e) => {
  if (e.target.value === "Cash") {
    document.getElementById("updatePayTxIdContainer").classList.add("d-none");
  } else {
    document.getElementById("updatePayTxIdContainer").classList.remove("d-none");
  }
});

// Auto-fill Student ID on Certificate Lookup
document.getElementById("lookupCertStudentBtn")?.addEventListener("click", () => {
  const studentId = document.getElementById("lookupCertStudentId").value.trim();
  if (!studentId) { alert("Please enter Student ID."); return; }
  
  const reg = allRegistrations.find(r => r.studentId === studentId);
  if (!reg) { alert(`Student ID ${studentId} not found in registrations.`); return; }
  
  document.getElementById("certStudentId").value = reg.studentId;
  document.getElementById("certId").value = reg.studentId;
  document.getElementById("studentName").value = reg.fullName;
  document.getElementById("courseName").value = reg.course;
  document.getElementById("certBatch").value = reg.batch;
});

// Direct Link Generator
document.getElementById("copyLinkBtn")?.addEventListener("click", () => {
  const linkInput = document.getElementById("generatedLink");
  linkInput.select();
  linkInput.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(linkInput.value);
  alert("Verification Link copied to clipboard!");
});

document.getElementById("certId")?.addEventListener("input", (e) => {
  const suffix = e.target.value.trim();
  document.getElementById("generatedLink").value = suffix ? getVerifyUrl("INTREX-CERT-" + suffix) : "";
});

// Dynamic theme observer to update charts styling on the fly
const themeObserver = new MutationObserver(() => {
  if (allProjects.length > 0 || allRegistrations.length > 0) {
    updateOverview();
  }
});
themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });

// A4 Printing Lifecycle listeners
window.addEventListener("beforeprint", () => {
  const header = document.createElement("div");
  header.id = "print-header-confidential";
  header.style.textAlign = "center";
  header.style.fontWeight = "bold";
  header.style.marginBottom = "20px";
  header.style.color = "#dc3545";
  header.style.borderBottom = "2px solid #dc3545";
  header.style.paddingBottom = "5px";
  header.style.fontSize = "14pt";
  header.innerText = `CONFIDENTIAL - Printed on ${new Date().toLocaleString()}`;
  document.body.insertBefore(header, document.body.firstChild);

  const charts = [
    chartProjectStatusInstance, chartBudgetVsExpenseInstance, chartRequisitionLifecycleInstance, chartResourceAllocationInstance, chartMonthlyFinanceInstance,
    chartPaymentStatusInstance, chartCourseEnrollmentInstance, chartRegTrendsInstance, chartPaymentFunnelInstance, chartCertVelocityInstance, chartRevenueByCourseInstance
  ];
  charts.forEach(chart => { if (chart) chart.resize(); });
});

window.addEventListener("afterprint", () => {
  const header = document.getElementById("print-header-confidential");
  if (header) header.remove();

  const charts = [
    chartProjectStatusInstance, chartBudgetVsExpenseInstance, chartRequisitionLifecycleInstance, chartResourceAllocationInstance, chartMonthlyFinanceInstance,
    chartPaymentStatusInstance, chartCourseEnrollmentInstance, chartRegTrendsInstance, chartPaymentFunnelInstance, chartCertVelocityInstance, chartRevenueByCourseInstance
  ];
  charts.forEach(chart => { if (chart) chart.resize(); });
});

// ==========================================
// FIREBASE AUTH MONITOR & CORE STATE ENTRY
// ==========================================
onAdminAuthStateChanged((user) => {
  const loginSection = document.getElementById("loginSection");
  const dashboardSection = document.getElementById("dashboardSection");

  if (user) {
    currentUserEmail = user.email || "admin@example.com";
    window.currentUserEmail = currentUserEmail;
    
    loginSection.classList.add("d-none");
    dashboardSection.classList.remove("d-none");
    if (window.AOS) AOS.refresh();
    
    // Set default date values
    document.querySelectorAll('input[type="date"]').forEach(input => {
      if (input.id === "exp_clearance_date" || input.id === "inv_date_received" || input.id === "issueDate" || input.id === "filterStartDate" || input.id === "filterEndDate") return;
      input.value = todayDateStr;
    });
    
    // Fetch and load all metrics
    loadAllData();
    resetInactivityTimer();
  } else {
    currentUserEmail = "";
    window.currentUserEmail = "";
    loginSection.classList.remove("d-none");
    dashboardSection.classList.add("d-none");
    clearTimeout(inactivityTimer);
    if (window.AOS) AOS.refresh();
  }
});

// Login Form submission
document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value;
  const errorDiv = document.getElementById("loginError");
  errorDiv.classList.add("d-none");

  try {
    await loginAdmin(email, password);
    await addAuditLog({
      user_email: email,
      action_type: "LOGIN",
      collection_name: "N/A",
      record_id: "N/A",
      details: "Admin logged in successfully via login form"
    });
  } catch (err) {
    errorDiv.innerText = "Login failed: " + err.message.replace("Firebase: ", "");
    errorDiv.classList.remove("d-none");
  }
});

// Logout action
document.getElementById("logoutBtn").addEventListener("click", async function () {
  const emailBeforeLogout = currentUserEmail || "admin@example.com";
  try {
    await addAuditLog({
      user_email: emailBeforeLogout,
      action_type: "LOGOUT",
      collection_name: "N/A",
      record_id: "N/A",
      details: "Admin logged out manually"
    });
    await logoutAdmin();
  } catch (err) {
    alert("Logout failed: " + err.message);
  }
});
