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
  console.warn("Firebase configuration has not been set up. Please update the firebaseConfig object in assets/js/solution.js.");
}

// Helper to check configuration state
function checkConfiguration() {
  if (!isFirebaseConfigured) {
    alert("Firebase configuration is not set up yet.");
    return false;
  }
  return true;
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
// 2. PROJECT MANAGEMENT
// ==========================================
export async function addProject(projectData) {
  if (!checkConfiguration()) return;
  const { projectId, projectName, clientName, description, startDate, endDate, status } = projectData;
  if (!projectId || !projectName || !clientName) {
    throw new Error("Missing required project fields");
  }
  try {
    const docRef = doc(db, "sol_projects", projectId.trim().toUpperCase());
    await setDoc(docRef, {
      projectId: projectId.trim().toUpperCase(),
      projectName: projectName.trim(),
      clientName: clientName.trim(),
      description: description ? description.trim() : "",
      startDate: startDate || "",
      endDate: endDate || "",
      status: status || "Planned",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error saving project: ", error);
    throw error;
  }
}

export async function getAllProjects() {
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "sol_projects"));
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
    const docRef = doc(db, "sol_projects", projectId.trim().toUpperCase());
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting project: ", error);
    throw error;
  }
}

// ==========================================
// 3. CONTACT DIRECTORY
// ==========================================
export async function addContact(contactData) {
  if (!checkConfiguration()) return;
  const { contactId, fullName, designation, organization, mobile, email, projectId } = contactData;
  if (!fullName || !projectId) {
    throw new Error("Missing required contact fields");
  }
  try {
    const id = contactId || "CNT-" + Date.now();
    const docRef = doc(db, "sol_contacts", id);
    await setDoc(docRef, {
      contactId: id,
      fullName: fullName.trim(),
      designation: designation ? designation.trim() : "",
      organization: organization ? organization.trim() : "",
      mobile: mobile || "",
      email: email || "",
      projectId: projectId.trim().toUpperCase(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error saving contact: ", error);
    throw error;
  }
}

export async function getAllContacts() {
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "sol_contacts"));
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
    const docRef = doc(db, "sol_contacts", contactId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting contact: ", error);
    throw error;
  }
}

// ==========================================
// 4. MEETING SCHEDULER
// ==========================================
export async function addMeeting(meetingData) {
  if (!checkConfiguration()) return;
  const { meetingId, title, date, time, duration, projectId, agenda } = meetingData;
  if (!title || !date || !time || !projectId) {
    throw new Error("Missing required meeting fields");
  }
  try {
    const id = meetingId || "MTG-" + Date.now();
    const docRef = doc(db, "sol_meetings", id);
    await setDoc(docRef, {
      meetingId: id,
      title: title.trim(),
      date: date,
      time: time,
      duration: duration || "30 mins",
      projectId: projectId.trim().toUpperCase(),
      agenda: agenda ? agenda.trim() : "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error saving meeting: ", error);
    throw error;
  }
}

export async function getAllMeetings() {
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "sol_meetings"));
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
    const docRef = doc(db, "sol_meetings", meetingId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting meeting: ", error);
    throw error;
  }
}

// ==========================================
// 5. BUDGET PLANNER
// ==========================================
export async function addBudget(budgetData) {
  if (!checkConfiguration()) return;
  const { projectId, estimatedBudget, notes, status } = budgetData;
  if (!projectId || estimatedBudget === undefined) {
    throw new Error("Missing required budget fields");
  }
  try {
    const docRef = doc(db, "sol_budgets", projectId.trim().toUpperCase());
    await setDoc(docRef, {
      projectId: projectId.trim().toUpperCase(),
      estimatedBudget: Number(estimatedBudget) || 0,
      notes: notes ? notes.trim() : "",
      status: status || "Draft",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error saving budget: ", error);
    throw error;
  }
}

export async function getAllBudgets() {
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "sol_budgets"));
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

export async function deleteBudget(projectId) {
  if (!checkConfiguration()) return;
  try {
    const docRef = doc(db, "sol_budgets", projectId.trim().toUpperCase());
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting budget: ", error);
    throw error;
  }
}

// ==========================================
// 6. WORKING UPDATES (PROJECT MANAGEMENT)
// ==========================================
export async function addProjectUpdate(updateData) {
  if (!checkConfiguration()) return;
  const { updateId, projectId, date, progressPercent, updateNotes, status } = updateData;
  if (!projectId || progressPercent === undefined || !date) {
    throw new Error("Missing required update fields");
  }
  try {
    const id = updateId || "UPD-" + Date.now();
    const docRef = doc(db, "sol_updates", id);
    await setDoc(docRef, {
      updateId: id,
      projectId: projectId.trim().toUpperCase(),
      date: date,
      progressPercent: Number(progressPercent) || 0,
      updateNotes: updateNotes ? updateNotes.trim() : "",
      status: status || "Active",
      createdAt: serverTimestamp()
    });

    // Cascade update the project collection status
    if (status) {
      const projRef = doc(db, "sol_projects", projectId.trim().toUpperCase());
      const projSnap = await getDoc(projRef);
      if (projSnap.exists()) {
        await setDoc(projRef, { status: status, updatedAt: serverTimestamp() }, { merge: true });
      }
    }
  } catch (error) {
    console.error("Error saving project update: ", error);
    throw error;
  }
}

export async function getAllProjectUpdates() {
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "sol_updates"));
    const updates = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        updates.push(docSnap.data());
      }
    });
    return updates;
  } catch (error) {
    console.error("Error fetching project updates: ", error);
    throw error;
  }
}

export async function deleteProjectUpdate(updateId) {
  if (!checkConfiguration()) return;
  try {
    const docRef = doc(db, "sol_updates", updateId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting project update: ", error);
    throw error;
  }
}

// ==========================================
// 7. PURCHASE REQUISITIONS
// ==========================================
export async function addRequisition(reqData) {
  if (!checkConfiguration()) return;
  const { requisitionId, projectId, itemName, quantity, estimatedCost, status } = reqData;
  if (!projectId || !itemName || !quantity || estimatedCost === undefined) {
    throw new Error("Missing required requisition fields");
  }
  try {
    const id = requisitionId || "REQ-" + Date.now();
    const docRef = doc(db, "sol_requisitions", id);
    await setDoc(docRef, {
      requisitionId: id,
      projectId: projectId.trim().toUpperCase(),
      itemName: itemName.trim(),
      quantity: Number(quantity) || 1,
      estimatedCost: Number(estimatedCost) || 0,
      status: status || "Pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error saving requisition: ", error);
    throw error;
  }
}

export async function getAllRequisitions() {
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "sol_requisitions"));
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
    const docRef = doc(db, "sol_requisitions", requisitionId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting requisition: ", error);
    throw error;
  }
}

// ==========================================
// 8. PURCHASE MANAGEMENT
// ==========================================
export async function addPurchase(purchaseData) {
  if (!checkConfiguration()) return;
  const { purchaseId, requisitionId, projectId, itemName, supplier, finalCost, status } = purchaseData;
  if (!projectId || !itemName || finalCost === undefined) {
    throw new Error("Missing required purchase fields");
  }
  try {
    const id = purchaseId || "PUR-" + Date.now();
    const docRef = doc(db, "sol_purchases", id);
    await setDoc(docRef, {
      purchaseId: id,
      requisitionId: requisitionId || "Direct",
      projectId: projectId.trim().toUpperCase(),
      itemName: itemName.trim(),
      supplier: supplier ? supplier.trim() : "",
      finalCost: Number(finalCost) || 0,
      status: status || "Ordered",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Cascade update: If purchase is derived from requisition, update requisition status
    if (requisitionId && requisitionId !== "Direct") {
      const reqRef = doc(db, "sol_requisitions", requisitionId);
      const reqSnap = await getDoc(reqRef);
      if (reqSnap.exists()) {
        await setDoc(reqRef, { status: "Purchased", updatedAt: serverTimestamp() }, { merge: true });
      }
    }

    // Cascade add to Expense tracker automatically
    const expenseId = "EXP-AUTO-" + id;
    const expRef = doc(db, "sol_expenses", expenseId);
    await setDoc(expRef, {
      expenseId: expenseId,
      projectId: projectId.trim().toUpperCase(),
      category: "Equipment & Supplies",
      amount: Number(finalCost) || 0,
      date: new Date().toISOString().substring(0, 10),
      description: `Auto-generated from purchase record ${id} (${itemName})`,
      createdAt: serverTimestamp()
    });

  } catch (error) {
    console.error("Error saving purchase: ", error);
    throw error;
  }
}

export async function getAllPurchases() {
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "sol_purchases"));
    const purchases = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        purchases.push(docSnap.data());
      }
    });
    return purchases;
  } catch (error) {
    console.error("Error fetching purchases: ", error);
    throw error;
  }
}

export async function deletePurchase(purchaseId) {
  if (!checkConfiguration()) return;
  try {
    const docRef = doc(db, "sol_purchases", purchaseId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting purchase: ", error);
    throw error;
  }
}

// ==========================================
// 9. COST/EXPENSE MANAGEMENT
// ==========================================
export async function addExpense(expenseData) {
  if (!checkConfiguration()) return;
  const { expenseId, projectId, category, amount, date, description } = expenseData;
  if (!projectId || amount === undefined || !date || !category) {
    throw new Error("Missing required expense fields");
  }
  try {
    const id = expenseId || "EXP-" + Date.now();
    const docRef = doc(db, "sol_expenses", id);
    await setDoc(docRef, {
      expenseId: id,
      projectId: projectId.trim().toUpperCase(),
      category: category.trim(),
      amount: Number(amount) || 0,
      date: date,
      description: description ? description.trim() : "",
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error saving expense: ", error);
    throw error;
  }
}

export async function getAllExpenses() {
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "sol_expenses"));
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
    const docRef = doc(db, "sol_expenses", expenseId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting expense: ", error);
    throw error;
  }
}
