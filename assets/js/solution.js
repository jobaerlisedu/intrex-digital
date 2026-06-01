// assets/js/solution.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ==========================================
// FIREBASE CONFIGURATION
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBS6t7jjgm8xpw-kfa5hIpJvMJ7vzUdzDQ",
  authDomain: "intrex-digital.firebaseapp.com",
  projectId: "intrex-digital",
  storageBucket: "intrex-digital.firebasestorage.app",
  messagingSenderId: "413262848177",
  appId: "1:413262848177:web:c211866e89a5368b79c290",
  measurementId: "G-XRNSDCPK86"
};

// Initialize Firebase
let app, db, auth;
let isFirebaseConfigured = false;

if (firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("placeholder-key")) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  isFirebaseConfigured = true;
} else {
  console.warn("Firebase configuration has not been set up.");
}

// Helper to check configuration state
function checkConfiguration() {
  if (!isFirebaseConfigured) {
    alert("Firebase configuration is not set up yet.");
    return false;
  }
  return true;
}

// Client-side key/ID auto-increment utility
async function getNextSeqId(collectionName, prefix, idField, paddingSize = 4) {
  if (!checkConfiguration()) return prefix + "0001";
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    let maxNum = 0;
    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const val = data[idField];
      if (val && val.startsWith(prefix)) {
        const numPart = val.substring(prefix.length);
        const num = parseInt(numPart, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    const nextNum = maxNum + 1;
    return prefix + String(nextNum).padStart(paddingSize, '0');
  } catch (error) {
    console.error("Error generating next sequence ID for " + collectionName + ":", error);
    return prefix + "0001";
  }
}

// Project ID custom generator
async function generateProjectId() {
  const year = new Date().getFullYear();
  const prefix = `PRJ-${year}-`;
  return await getNextSeqId("tbl_projects", prefix, "project_id", 3);
}

// ==========================================
// 1. ADMIN AUTHENTICATION
// ==========================================
export async function loginAdmin(email, password) {
  if (!checkConfiguration()) return null;
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Login failed: ", error);
    throw error;
  }
}

export async function logoutAdmin() {
  if (!checkConfiguration()) return;
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed: ", error);
    throw error;
  }
}

export function onAdminAuthStateChanged(callback) {
  if (!checkConfiguration()) return;
  onAuthStateChanged(auth, callback);
}

// ==========================================
// 2. PROJECT CREATOR (tbl_projects)
// ==========================================
export async function addProject(projectData) {
  if (!checkConfiguration()) return;
  const { project_id, project_name, client_sponsor, project_desc, start_date, end_date, project_status, project_manager } = projectData;
  if (!project_name || !client_sponsor || !start_date || !end_date || !project_manager) {
    throw new Error("Missing required project fields");
  }

  // Check project name uniqueness
  const querySnapshot = await getDocs(collection(db, "tbl_projects"));
  let nameExists = false;
  querySnapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.project_name && data.project_name.toLowerCase() === project_name.toLowerCase() && data.project_id !== project_id) {
      nameExists = true;
    }
  });
  if (nameExists) {
    throw new Error(`Project Name "${project_name}" is already in use.`);
  }

  try {
    const id = project_id ? project_id.trim().toUpperCase() : await generateProjectId();
    const docRef = doc(db, "tbl_projects", id);
    await setDoc(docRef, {
      project_id: id,
      project_name: project_name.trim(),
      client_sponsor: client_sponsor.trim(),
      project_desc: project_desc ? project_desc.trim() : "",
      start_date: start_date,
      end_date: end_date,
      project_status: project_status || "Pipeline",
      project_manager: project_manager,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return id;
  } catch (error) {
    console.error("Error saving project: ", error);
    throw error;
  }
}

export async function getAllProjects() {
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "tbl_projects"));
    const projects = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        projects.push(docSnap.data());
      }
    });
    return projects;
  } catch (error) {
    console.error("Error fetching projects: ", error);
    throw error;
  }
}

export async function deleteProject(projectId) {
  if (!checkConfiguration()) return;
  try {
    const docRef = doc(db, "tbl_projects", projectId.trim().toUpperCase());
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting project: ", error);
    throw error;
  }
}

// ==========================================
// 3. CONTACT DIRECTORY (tbl_contacts)
// ==========================================
export async function addContact(contactData) {
  if (!checkConfiguration()) return;
  const { contact_id, project_id, contact_name, designation, organization, mobile_phone, email } = contactData;
  if (!contact_name || !project_id || !designation || !organization) {
    throw new Error("Missing required contact fields");
  }

  // Check email uniqueness if provided
  if (email) {
    const querySnapshot = await getDocs(collection(db, "tbl_contacts"));
    let emailExists = false;
    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.email && data.email.toLowerCase() === email.toLowerCase() && data.contact_id !== contact_id) {
        emailExists = true;
      }
    });
    if (emailExists) {
      throw new Error(`Email ${email} is already in use by another contact.`);
    }
  }

  try {
    const id = contact_id || await getNextSeqId("tbl_contacts", "CON-", "contact_id", 4);
    const docRef = doc(db, "tbl_contacts", id);
    await setDoc(docRef, {
      contact_id: id,
      project_id: project_id, // Stored as array of strings
      contact_name: contact_name.trim(),
      designation: designation.trim(),
      organization: organization.trim(),
      mobile_phone: mobile_phone ? mobile_phone.trim() : "",
      email: email ? email.trim() : "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return id;
  } catch (error) {
    console.error("Error saving contact: ", error);
    throw error;
  }
}

export async function getAllContacts() {
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "tbl_contacts"));
    const contacts = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        contacts.push(docSnap.data());
      }
    });
    return contacts;
  } catch (error) {
    console.error("Error fetching contacts: ", error);
    throw error;
  }
}

export async function deleteContact(contactId) {
  if (!checkConfiguration()) return;
  try {
    const docRef = doc(db, "tbl_contacts", contactId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting contact: ", error);
    throw error;
  }
}

// ==========================================
// 4. MEETING SCHEDULER (tbl_meetings)
// ==========================================
export async function addMeeting(meetingData) {
  if (!checkConfiguration()) return;
  const { meeting_id, project_id, meeting_title, meeting_timestamp, agenda, attendees_list, meeting_url, meeting_minutes } = meetingData;
  if (!project_id || !meeting_title || !meeting_timestamp || !attendees_list || attendees_list.length === 0) {
    throw new Error("Missing required meeting fields");
  }
  try {
    const id = meeting_id || await getNextSeqId("tbl_meetings", "MTG-", "meeting_id", 4);
    const docRef = doc(db, "tbl_meetings", id);
    await setDoc(docRef, {
      meeting_id: id,
      project_id: project_id.trim().toUpperCase(),
      meeting_title: meeting_title.trim(),
      meeting_timestamp: meeting_timestamp,
      agenda: agenda ? agenda.trim() : "",
      attendees_list: attendees_list, // Stored as array of emails
      meeting_url: meeting_url ? meeting_url.trim() : "",
      meeting_minutes: meeting_minutes ? meeting_minutes.trim() : "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return id;
  } catch (error) {
    console.error("Error saving meeting: ", error);
    throw error;
  }
}

export async function getAllMeetings() {
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "tbl_meetings"));
    const meetings = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        meetings.push(docSnap.data());
      }
    });
    return meetings;
  } catch (error) {
    console.error("Error fetching meetings: ", error);
    throw error;
  }
}

export async function deleteMeeting(meetingId) {
  if (!checkConfiguration()) return;
  try {
    const docRef = doc(db, "tbl_meetings", meetingId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting meeting: ", error);
    throw error;
  }
}

// ==========================================
// 5. BUDGET PLANNER (tbl_budget)
// ==========================================
export async function addBudget(budgetData) {
  if (!checkConfiguration()) return;
  const { budget_line_id, project_id, cost_category, line_description, allocated_amount, approved_by } = budgetData;
  if (!project_id || !cost_category || !line_description || allocated_amount === undefined || !approved_by) {
    throw new Error("Missing required budget fields");
  }
  try {
    const id = budget_line_id || await getNextSeqId("tbl_budget", "BGT-", "budget_line_id", 4);
    const docRef = doc(db, "tbl_budget", id);
    await setDoc(docRef, {
      budget_line_id: id,
      project_id: project_id.trim().toUpperCase(),
      cost_category: cost_category.trim(),
      line_description: line_description.trim(),
      allocated_amount: Number(allocated_amount) || 0,
      approved_by: approved_by,
      last_updated: new Date().toISOString().substring(0, 10),
      createdAt: serverTimestamp()
    });
    return id;
  } catch (error) {
    console.error("Error saving budget configuration: ", error);
    throw error;
  }
}

export async function getAllBudgets() {
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "tbl_budget"));
    const budgets = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        budgets.push(docSnap.data());
      }
    });
    return budgets;
  } catch (error) {
    console.error("Error fetching budgets: ", error);
    throw error;
  }
}

export async function deleteBudget(budgetLineId) {
  if (!checkConfiguration()) return;
  try {
    const docRef = doc(db, "tbl_budget", budgetLineId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting budget line: ", error);
    throw error;
  }
}

// ==========================================
// 6. TASKS & WORKING UPDATES (tbl_tasks)
// ==========================================
export async function addTask(taskData) {
  if (!checkConfiguration()) return;
  const { task_id, project_id, wbs_code, task_name, assigned_to, task_startDate, task_endDate, progress_percent, task_status, working_update } = taskData;
  if (!project_id || !task_name || !assigned_to || !task_startDate || !task_endDate || progress_percent === undefined) {
    throw new Error("Missing required task fields");
  }
  try {
    const id = task_id || await getNextSeqId("tbl_tasks", "TSK-", "task_id", 4);
    const docRef = doc(db, "tbl_tasks", id);
    
    // Read previous task document if existing to support append-only log visualizer
    let finalUpdate = working_update ? working_update.trim() : "";
    if (task_id) {
      const existingSnap = await getDoc(docRef);
      if (existingSnap.exists()) {
        const existingData = existingSnap.data();
        if (existingData.working_update && working_update && existingData.working_update !== working_update) {
          // If the text is new and doesn't already contain the existing logs, append/prepend
          if (!working_update.includes(existingData.working_update)) {
            finalUpdate = existingData.working_update + "\n" + working_update.trim();
          }
        } else if (existingData.working_update && !working_update) {
          finalUpdate = existingData.working_update;
        }
      }
    }

    await setDoc(docRef, {
      task_id: id,
      project_id: project_id.trim().toUpperCase(),
      wbs_code: wbs_code ? wbs_code.trim() : "1.0",
      task_name: task_name.trim(),
      assigned_to: assigned_to,
      task_startDate: task_startDate,
      task_endDate: task_endDate,
      progress_percent: Number(progress_percent) || 0,
      task_status: task_status || "Not Started",
      working_update: finalUpdate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Cascade update the project status if the task is set to Completed/In Progress
    if (task_status === "Completed" || task_status === "In Progress") {
      const projRef = doc(db, "tbl_projects", project_id.trim().toUpperCase());
      const projSnap = await getDoc(projRef);
      if (projSnap.exists()) {
        const currentProjStatus = projSnap.data().project_status;
        if (task_status === "In Progress" && currentProjStatus === "Pipeline") {
          await setDoc(projRef, { project_status: "Active", updatedAt: serverTimestamp() }, { merge: true });
        }
      }
    }

    return id;
  } catch (error) {
    console.error("Error saving task: ", error);
    throw error;
  }
}

export async function getAllTasks() {
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "tbl_tasks"));
    const tasks = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        tasks.push(docSnap.data());
      }
    });
    return tasks;
  } catch (error) {
    console.error("Error fetching tasks: ", error);
    throw error;
  }
}

export async function deleteTask(taskId) {
  if (!checkConfiguration()) return;
  try {
    const docRef = doc(db, "tbl_tasks", taskId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting task: ", error);
    throw error;
  }
}

// ==========================================
// 7. PURCHASE REQUISITIONS (tbl_requisitions)
// ==========================================
export async function addRequisition(reqData) {
  if (!checkConfiguration()) return;
  const { requisition_id, project_id, requested_item, quantity, estimated_unit_cost, justification, requested_by, approval_status } = reqData;
  if (!project_id || !requested_item || !quantity || estimated_unit_cost === undefined || !justification || !requested_by) {
    throw new Error("Missing required requisition fields");
  }
  try {
    const id = requisition_id || await getNextSeqId("tbl_requisitions", "PRQ-", "requisition_id", 4);
    const docRef = doc(db, "tbl_requisitions", id);
    const total = Number(quantity) * Number(estimated_unit_cost);
    
    await setDoc(docRef, {
      requisition_id: id,
      project_id: project_id.trim().toUpperCase(),
      requested_item: requested_item.trim(),
      quantity: Number(quantity) || 1,
      estimated_unit_cost: Number(estimated_unit_cost) || 0,
      estimated_total: total, // Calculated Formula Field
      justification: justification.trim(),
      requested_by: requested_by,
      approval_status: approval_status || "Pending Review",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return id;
  } catch (error) {
    console.error("Error saving requisition: ", error);
    throw error;
  }
}

export async function getAllRequisitions() {
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "tbl_requisitions"));
    const reqs = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        reqs.push(docSnap.data());
      }
    });
    return reqs;
  } catch (error) {
    console.error("Error fetching requisitions: ", error);
    throw error;
  }
}

export async function deleteRequisition(requisitionId) {
  if (!checkConfiguration()) return;
  try {
    const docRef = doc(db, "tbl_requisitions", requisitionId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting requisition: ", error);
    throw error;
  }
}

// ==========================================
// 8. PURCHASE ORDER MANAGEMENT (tbl_purchase_orders)
// ==========================================
export async function addPurchaseOrder(poData) {
  if (!checkConfiguration()) return;
  const { po_number, requisition_id, project_id, vendor_name, final_total, po_date, delivery_date, order_status } = poData;
  if (!requisition_id || !project_id || !vendor_name || final_total === undefined || !po_date || !delivery_date) {
    throw new Error("Missing required purchase order fields");
  }

  // Check unique requisition_id
  const querySnapshot = await getDocs(collection(db, "tbl_purchase_orders"));
  let reqExists = false;
  querySnapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.requisition_id === requisition_id && data.po_number !== po_number) {
      reqExists = true;
    }
  });
  if (reqExists) {
    throw new Error(`A Purchase Order is already associated with Requisition ID ${requisition_id}.`);
  }

  try {
    const id = po_number || await getNextSeqId("tbl_purchase_orders", "PO-", "po_number", 5);
    const docRef = doc(db, "tbl_purchase_orders", id);
    await setDoc(docRef, {
      po_number: id,
      requisition_id: requisition_id,
      project_id: project_id.trim().toUpperCase(),
      vendor_name: vendor_name.trim(),
      final_total: Number(final_total) || 0,
      po_date: po_date,
      delivery_date: delivery_date,
      order_status: order_status || "Issued",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Cascade update: update requisition status
    const reqRef = doc(db, "tbl_requisitions", requisition_id);
    const reqSnap = await getDoc(reqRef);
    if (reqSnap.exists()) {
      await setDoc(reqRef, { approval_status: "Approved", updatedAt: serverTimestamp() }, { merge: true });
    }

    // Cascade add to Expense tracker automatically (ledger of truth)
    const expenseId = "EXP-AUTO-" + id;
    const expRef = doc(db, "tbl_expenses", expenseId);
    await setDoc(expRef, {
      expense_id: expenseId,
      project_id: project_id.trim().toUpperCase(),
      po_number: id,
      invoice_number: "INV-PO-" + id,
      payment_date: po_date,
      amount_paid: Number(final_total) || 0,
      cost_category: "Hardware Procurement",
      receipt_url: "",
      createdAt: serverTimestamp()
    });

    return id;
  } catch (error) {
    console.error("Error saving purchase order: ", error);
    throw error;
  }
}

export async function getAllPurchaseOrders() {
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "tbl_purchase_orders"));
    const purchases = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        purchases.push(docSnap.data());
      }
    });
    return purchases;
  } catch (error) {
    console.error("Error fetching purchase orders: ", error);
    throw error;
  }
}

export async function deletePurchaseOrder(poNumber) {
  if (!checkConfiguration()) return;
  try {
    const docRef = doc(db, "tbl_purchase_orders", poNumber);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting purchase order: ", error);
    throw error;
  }
}

// ==========================================
// 9. COST / EXPENSE LEDGER (tbl_expenses)
// ==========================================
export async function addExpense(expenseData) {
  if (!checkConfiguration()) return;
  const { expense_id, project_id, po_number, invoice_number, payment_date, amount_paid, cost_category, receipt_url } = expenseData;
  if (!project_id || !invoice_number || !payment_date || amount_paid === undefined || !cost_category) {
    throw new Error("Missing required expense fields");
  }
  try {
    const id = expense_id || await getNextSeqId("tbl_expenses", "EXP-", "expense_id", 4);
    const docRef = doc(db, "tbl_expenses", id);
    await setDoc(docRef, {
      expense_id: id,
      project_id: project_id.trim().toUpperCase(),
      po_number: po_number || "",
      invoice_number: invoice_number.trim(),
      payment_date: payment_date,
      amount_paid: Number(amount_paid) || 0,
      cost_category: cost_category.trim(),
      receipt_url: receipt_url ? receipt_url.trim() : "",
      createdAt: serverTimestamp()
    });
    return id;
  } catch (error) {
    console.error("Error saving expense entry: ", error);
    throw error;
  }
}

export async function getAllExpenses() {
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "tbl_expenses"));
    const expenses = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        expenses.push(docSnap.data());
      }
    });
    return expenses;
  } catch (error) {
    console.error("Error fetching expenses: ", error);
    throw error;
  }
}

export async function deleteExpense(expenseId) {
  if (!checkConfiguration()) return;
  try {
    const docRef = doc(db, "tbl_expenses", expenseId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting expense entry: ", error);
    throw error;
  }
}
