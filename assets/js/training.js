// assets/js/training.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ==========================================
// FIREBASE CONFIGURATION
// ==========================================
// Replace this placeholder config with your actual Firebase Web App Credentials
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
  setPersistence(auth, browserSessionPersistence).catch((error) => {
    console.error("Failed to set auth persistence:", error);
  });
  isFirebaseConfigured = true;
} else {
  console.warn("Firebase configuration has not been set up. Please update the firebaseConfig object in assets/js/training.js.");
}

// Helper to check configuration state
function checkConfiguration() {
  if (!isFirebaseConfigured) {
    alert("Firebase configuration is not set up yet. Please enter your Firebase config details in 'assets/js/training.js'.");
    return false;
  }
  return true;
}

// ==========================================
// 1. PUBLIC CERTIFICATE VERIFICATION FUNCTIONALITY
// ==========================================
export async function verifyCertificate(certificateId) {
  if (!checkConfiguration()) return null;

  try {
    const docRef = doc(db, "certificates", certificateId.trim());
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error looking up certificate: ", error);
    throw error;
  }
}

// ==========================================
// 2. ADMIN AUTHENTICATION & OPERATIONS FUNCTIONALITY
// ==========================================

// Login admin user
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

// Logout admin user
export async function logoutAdmin() {
  if (!checkConfiguration()) return;
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed: ", error);
    throw error;
  }
}

// Watch authentication status changes
export function onAdminAuthStateChanged(callback) {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    setTimeout(() => callback({ email: "admin@intrex-digital.com" }), 100);
    return;
  }
  if (!checkConfiguration()) return;
  onAuthStateChanged(auth, callback);
}

// Add new certificate to Firestore
export async function addCertificate(certData) {
  if (!checkConfiguration()) return;

  const { certificateId, studentId, studentName, courseName, issueDate, grade, status, batch } = certData;

  if (!certificateId || !studentName || !courseName || !issueDate || !batch) {
    throw new Error("Missing required fields");
  }

  try {
    const docRef = doc(db, "certificates", certificateId.trim());
    await setDoc(docRef, {
      certificateId: certificateId.trim(),
      studentId: studentId ? studentId.trim() : "",
      studentName: studentName.trim(),
      courseName: courseName.trim(),
      issueDate: issueDate.trim(),
      grade: grade ? grade.trim() : "N/A",
      status: status || "Verified",
      batch: batch.trim(),
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error saving certificate: ", error);
    throw error;
  }
}

// Fetch all certificates from Firestore
export async function getAllCertificates() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    return [
      {
        certificateId: "INTREX-CERT-495001",
        studentId: "495001",
        studentName: "Shibli Akter",
        courseName: "CompTIA Security+",
        batch: "02",
        status: "Verified",
        grade: "A+",
        issueDate: "2026-06-01"
      }
    ];
  }
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "certificates"));
    const certs = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        certs.push(docSnap.data());
      }
    });
    return certs;
  } catch (error) {
    console.error("Error fetching all certificates: ", error);
    throw error;
  }
}

// Delete certificate from Firestore
export async function deleteCertificate(certificateId) {
  if (!checkConfiguration()) return;
  try {
    const docRef = doc(db, "certificates", certificateId.trim());
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting certificate: ", error);
    throw error;
  }
}

// ==========================================
// ==========================================
// 3. COURSE REGISTRATION OPERATIONS
// ==========================================

// Internal helper to generate student ID
function generateStudentId(courseName, batchName, registrationsList) {
  let maxSerial = 0;
  registrationsList.forEach(r => {
    const id = r.studentId;
    if (id) {
      const match = id.match(/(?:^|-)(495\d{3})$/);
      if (match) {
        const num = parseInt(match[1].substring(3), 10);
        if (num > maxSerial) {
          maxSerial = num;
        }
      }
    }
  });
  const nextSerialNum = maxSerial + 1;
  const serialStr = String(nextSerialNum).padStart(3, "0");
  return `495${serialStr}`;
}

// Add new course registration
export async function addRegistration(regData) {
  if (!checkConfiguration()) return null;

  const { fullName, email, phone, course, batch, education, schedule, message, totalFee, discount, amountPaid, paymentType, transactionId, registrationFee, installments, isJobHolder, companyName, designation, studentId } = regData;

  if (!fullName || !email || !phone || !course || !batch || !schedule) {
    throw new Error("Missing required registration fields");
  }

  try {
    // 1. Fetch current registrations to compute student ID
    const querySnapshot = await getDocs(collection(db, "registrations"));
    const regs = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        regs.push(docSnap.data());
      }
    });

    const finalStudentId = studentId || generateStudentId(course, batch, regs);
    const cleanCourse = course.trim().replace(/[^a-zA-Z0-9]/g, "");
    const docId = finalStudentId + "_" + cleanCourse;

    // 2. Save registration info using docId as document ID
    const regRef = doc(db, "registrations", docId);
    await setDoc(regRef, {
      studentId: finalStudentId,
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      course: course.trim(),
      batch: batch.trim(),
      education: education || "",
      schedule: schedule || "",
      message: message ? message.trim() : "",
      isJobHolder: isJobHolder || false,
      companyName: companyName || "",
      designation: designation || "",
      createdAt: serverTimestamp()
    });

    // 3. Create corresponding payment record linked by docId as document ID
    const fee = Number(totalFee) || 0;
    const disc = Number(discount) || 0;
    const paid = Number(amountPaid) || 0;
    const effectiveFee = Math.max(0, fee - disc);
    const due = Math.max(0, effectiveFee - paid);
    let status = "Unpaid";
    if (paid > 0) {
      status = paid >= effectiveFee ? "Fully Paid" : "Partially Paid";
    }

    const payRef = doc(db, "payments", docId);
    await setDoc(payRef, {
      studentId: finalStudentId,
      studentName: fullName.trim(),
      email: email.trim(),
      courseName: course.trim(),
      batch: batch.trim(),
      totalFee: fee,
      discount: disc,
      amountPaid: paid,
      dueAmount: due,
      status: status,
      paymentType: paymentType || "Cash",
      transactionId: (paymentType !== "Cash" && transactionId) ? transactionId.trim() : "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      registrationFee: Number(registrationFee) || 0,
      installments: installments || []
    });

    return finalStudentId;
  } catch (error) {
    console.error("Error adding course registration: ", error);
    throw error;
  }
}

// Fetch all course registrations
export async function getAllRegistrations() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    return [
      {
        id: "495001_CompTIASecurity+",
        studentId: "495001",
        fullName: "Shibli Akter",
        email: "shibli@example.com",
        phone: "+8801700000000",
        course: "CompTIA Security+",
        batch: "02",
        education: "B.Sc in CSE",
        schedule: "Fri-Sat 10:00 AM",
        createdAt: new Date(),
        message: "Looking forward to starting the course."
      }
    ];
  }
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "registrations"));
    const regs = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        data.id = docSnap.id;
        regs.push(data);
      }
    });
    return regs;
  } catch (error) {
    console.error("Error fetching registrations: ", error);
    throw error;
  }
}

// Update course registration
export async function updateRegistration(docId, regData) {
  if (!checkConfiguration()) return;

  const { fullName, email, phone, course, batch, education, schedule, message, isJobHolder, companyName, designation } = regData;

  if (!fullName || !email || !phone || !course || !batch || !schedule) {
    throw new Error("Missing required registration fields");
  }

  try {
    const regRef = doc(db, "registrations", docId);
    const regSnap = await getDoc(regRef);
    const existingData = regSnap.exists() ? regSnap.data() : {};
    const studentId = existingData.studentId || "";

    await setDoc(regRef, {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      course: course.trim(),
      batch: batch.trim(),
      education: education || "",
      schedule: schedule || "",
      message: message ? message.trim() : "",
      isJobHolder: isJobHolder || false,
      companyName: companyName || "",
      designation: designation || ""
    }, { merge: true });

    // Sync student name, email, course and batch to the payment record
    const payRef = doc(db, "payments", docId);

    const paySnap = await getDoc(payRef);
    if (paySnap.exists()) {
      const payData = paySnap.data();
      const totalFee = payData.totalFee || 0;
      const disc = payData.discount || 0;
      const amountPaid = payData.amountPaid || 0;
      const effectiveFee = Math.max(0, totalFee - disc);
      const dueAmount = Math.max(0, effectiveFee - amountPaid);
      let status = "Unpaid";
      if (amountPaid > 0) {
        status = amountPaid >= effectiveFee ? "Fully Paid" : "Partially Paid";
      }

      await setDoc(payRef, {
        studentName: fullName.trim(),
        email: email.trim(),
        courseName: course.trim(),
        batch: batch.trim(),
        dueAmount,
        status,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } else {
      await setDoc(payRef, {
        studentName: fullName.trim(),
        email: email.trim(),
        courseName: course.trim(),
        batch: batch.trim(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    // Sync certificate records as well if they exist
    const certQuerySnapshot = await getDocs(collection(db, "certificates"));
    certQuerySnapshot.forEach(async (docSnap) => {
      if (docSnap.exists()) {
        const certData = docSnap.data();
        if (certData.studentId === studentId) {
          const certRef = doc(db, "certificates", certData.certificateId);
          await setDoc(certRef, {
            studentName: fullName.trim(),
            courseName: course.trim(),
            batch: batch.trim()
          }, { merge: true });
        }
      }
    });
  } catch (error) {
    console.error("Error updating registration: ", error);
    throw error;
  }
}

// Delete course registration and linked payment record
export async function deleteRegistration(docId) {
  if (!checkConfiguration()) return;
  try {
    const regRef = doc(db, "registrations", docId);
    const regSnap = await getDoc(regRef);
    let studentId = "";
    let course = "";
    if (regSnap.exists()) {
      studentId = regSnap.data().studentId;
      course = regSnap.data().course;
    }

    await deleteDoc(regRef);

    const payRef = doc(db, "payments", docId);
    await deleteDoc(payRef);

    // Also delete any certificates for this student's specific course
    const certQuerySnapshot = await getDocs(collection(db, "certificates"));
    certQuerySnapshot.forEach(async (docSnap) => {
      if (docSnap.exists()) {
        const certData = docSnap.data();
        if (certData.studentId === studentId && (!course || certData.courseName === course)) {
          const certRef = doc(db, "certificates", certData.certificateId);
          await deleteDoc(certRef);
        }
      }
    });
  } catch (error) {
    console.error("Error deleting registration & payment: ", error);
    throw error;
  }
}

// ==========================================
// 4. PAYMENT RECORD OPERATIONS
// ==========================================

// Fetch all payment records
export async function getAllPayments() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    return [
      {
        id: "495001_CompTIASecurity+",
        studentId: "495001",
        studentName: "Shibli Akter",
        email: "shibli@example.com",
        courseName: "CompTIA Security+",
        batch: "02",
        status: "Fully Paid",
        totalFee: 12000,
        discount: 2000,
        amountPaid: 10000,
        dueAmount: 0,
        paymentType: "Bkash",
        transactionId: "TRX998877",
        updatedAt: new Date(),
        registrationFee: 2000,
        installments: [
          { amount: 4000, dueDate: "2026-07-01", status: "Paid" },
          { amount: 4000, dueDate: "2026-08-01", status: "Paid" }
        ]
      }
    ];
  }
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "payments"));
    const pays = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        data.id = docSnap.id;
        pays.push(data);
      }
    });
    return pays;
  } catch (error) {
    console.error("Error fetching payments: ", error);
    throw error;
  }
}

// Update payment record details
export async function updatePayment(docId, totalFee, discount, amountPaid, paymentType, transactionId, registrationFee, installments) {
  if (!checkConfiguration()) return;

  try {
    const fee = Number(totalFee) || 0;
    const disc = Number(discount) || 0;
    const paid = Number(amountPaid) || 0;
    const effectiveFee = Math.max(0, fee - disc);
    const due = Math.max(0, effectiveFee - paid);
    let status = "Unpaid";
    if (paid > 0) {
      status = paid >= effectiveFee ? "Fully Paid" : "Partially Paid";
    }

    const payRef = doc(db, "payments", docId);
    await setDoc(payRef, {
      totalFee: fee,
      discount: disc,
      amountPaid: paid,
      dueAmount: due,
      status: status,
      paymentType: paymentType || "Cash",
      transactionId: (paymentType !== "Cash" && transactionId) ? transactionId.trim() : "",
      updatedAt: serverTimestamp(),
      registrationFee: Number(registrationFee) || 0,
      installments: installments || []
    }, { merge: true });
  } catch (error) {
    console.error("Error updating payment: ", error);
    throw error;
  }
}

// ==========================================
// 5. AUDIT LOGS SYSTEM (tbl_audit_logs)
// ==========================================
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

let mockAuditLogs = null;

export async function addAuditLog(logData) {
  if (!checkConfiguration()) return;
  const { user_email, action_type, collection_name, record_id, details } = logData;
  if (!user_email || !action_type || !details) {
    throw new Error("Missing required audit log fields");
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    if (!mockAuditLogs) {
      await getAllAuditLogs();
    }
    const nextId = "LOG-" + String(mockAuditLogs.length + 1).padStart(5, '0');
    const newLog = {
      log_id: nextId,
      user_email: user_email,
      action_type: action_type,
      collection_name: collection_name || "N/A",
      record_id: record_id || "N/A",
      details: details,
      local_time: new Date().toLocaleString(),
      createdAt: new Date()
    };
    mockAuditLogs.unshift(newLog);
    return nextId;
  }

  try {
    const id = await getNextSeqId("tbl_audit_logs", "LOG-", "log_id", 5);
    const docRef = doc(db, "tbl_audit_logs", id);
    await setDoc(docRef, {
      log_id: id,
      user_email: user_email,
      action_type: action_type,
      collection_name: collection_name || "N/A",
      record_id: record_id || "N/A",
      details: details,
      local_time: new Date().toLocaleString(),
      createdAt: serverTimestamp()
    });
    return id;
  } catch (error) {
    console.error("Error saving audit log: ", error);
    throw error;
  }
}

export async function getAllAuditLogs() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    if (!mockAuditLogs) {
      mockAuditLogs = [
        {
          log_id: "LOG-00003",
          local_time: new Date().toLocaleString(),
          user_email: "admin@intrex-digital.com",
          action_type: "LOGIN",
          collection_name: "N/A",
          record_id: "N/A",
          details: "Admin logged in successfully to training dashboard via mock auto-login"
        },
        {
          log_id: "LOG-00002",
          local_time: new Date(Date.now() - 3600000).toLocaleString(),
          user_email: "admin@intrex-digital.com",
          action_type: "CREATE",
          collection_name: "certificates",
          record_id: "INTREX-CERT-495001",
          details: "Created certificate record for student \"Shibli Akter\" (495001), status: Verified"
        },
        {
          log_id: "LOG-00001",
          local_time: new Date(Date.now() - 7200000).toLocaleString(),
          user_email: "admin@intrex-digital.com",
          action_type: "CREATE",
          collection_name: "registrations",
          record_id: "495001",
          details: "Registered student \"Shibli Akter\" for course \"CompTIA Security+\" under batch \"02\". Payment: Bkash, initial paid BDT 10000."
        }
      ];
    }
    return mockAuditLogs;
  }

  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "tbl_audit_logs"));
    const logs = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        logs.push(docSnap.data());
      }
    });
    logs.sort((a, b) => b.log_id.localeCompare(a.log_id));
    return logs;
  } catch (error) {
    console.error("Error fetching audit logs: ", error);
    throw error;
  }
}

// ==========================================
// 6. ONLINE PENDING REGISTRATIONS OPERATIONS
// ==========================================

// Add new online registration from public page
export async function addOnlineRegistration(regData) {
  if (!checkConfiguration()) return null;

  const { fullName, email, phone, course, education, schedule, message, isJobHolder, companyName, designation } = regData;

  if (!fullName || !email || !phone || !course || !schedule) {
    throw new Error("Missing required registration fields");
  }

  try {
    // Generate a unique registration key: REG- followed by 6 random digits
    let isUnique = false;
    let regKey = "";
    let attempts = 0;
    
    while (!isUnique && attempts < 10) {
      attempts++;
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      regKey = `REG-${randomNum}`;
      
      // Verify uniqueness by checking if the doc already exists
      const docRef = doc(db, "online_registrations", regKey);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        isUnique = true;
      }
    }

    const regRef = doc(db, "online_registrations", regKey);
    await setDoc(regRef, {
      registrationKey: regKey,
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      course: course.trim(),
      education: education || "",
      schedule: schedule || "",
      message: message ? message.trim() : "",
      isJobHolder: isJobHolder || false,
      companyName: companyName || "",
      designation: designation || "",
      createdAt: serverTimestamp()
    });

    return regKey;
  } catch (error) {
    console.error("Error saving online registration: ", error);
    throw error;
  }
}

// Fetch all pending online registrations (for dashboard list)
export async function getAllOnlineRegistrations() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    return [
      {
        registrationKey: "REG-123456",
        fullName: "Mock Student",
        email: "mock@example.com",
        phone: "+8801500000000",
        course: "CompTIA Security+",
        schedule: "Fri-Sat 10:00 AM",
        education: "HSC",
        message: "Mock registration message.",
        createdAt: new Date()
      }
    ];
  }
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "online_registrations"));
    const regs = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        regs.push(docSnap.data());
      }
    });
    // Sort by createdAt descending (newest first)
    regs.sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
    return regs;
  } catch (error) {
    console.error("Error fetching online registrations: ", error);
    throw error;
  }
}

// Fetch single online registration by key
export async function getOnlineRegistration(regKey) {
  if (!checkConfiguration()) return null;
  try {
    const docRef = doc(db, "online_registrations", regKey.trim().toUpperCase());
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error("Error fetching online registration: ", error);
    throw error;
  }
}

// Delete online registration from Firestore
export async function deleteOnlineRegistration(regKey) {
  if (!checkConfiguration()) return;
  try {
    const docRef = doc(db, "online_registrations", regKey.trim().toUpperCase());
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting online registration: ", error);
    throw error;
  }
}

// ==========================================
// 7. ONLINE INQUIRIES OPERATIONS
// ==========================================

// Add new inquiry from public training/service page
export async function addOnlineInquiry(inquiryData) {
  if (!checkConfiguration()) return null;

  const { name, email, phone, subject, message, source } = inquiryData;

  if (!name || !email || !message) {
    throw new Error("Missing required inquiry fields: name, email, message");
  }

  try {
    // Generate unique inquiry key: INQ-XXXXXX
    let isUnique = false;
    let inquiryKey = "";
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      attempts++;
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      inquiryKey = `INQ-${randomNum}`;
      const docRef = doc(db, "online_inquiries", inquiryKey);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) isUnique = true;
    }

    const inquiryRef = doc(db, "online_inquiries", inquiryKey);
    await setDoc(inquiryRef, {
      inquiryKey,
      name: name.trim(),
      email: email.trim(),
      phone: phone ? phone.trim() : "",
      subject: subject ? subject.trim() : "",
      message: message.trim(),
      source: source || "training-page",
      status: "New",
      createdAt: serverTimestamp()
    });

    return inquiryKey;
  } catch (error) {
    console.error("Error saving online inquiry: ", error);
    throw error;
  }
}

// Fetch all pending inquiries (for dashboard)
export async function getAllOnlineInquiries() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    return [
      {
        inquiryKey: "INQ-693174",
        status: "New",
        name: "Jobaer",
        email: "hsjobaer.nu.edu@gmail.com",
        phone: "+8801711223344",
        subject: "CompTIA Security+",
        source: "training-page",
        createdAt: new Date(),
        message: "Test message from Jobaer."
      }
    ];
  }
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "online_inquiries"));
    const inquiries = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) inquiries.push(docSnap.data());
    });
    inquiries.sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
    return inquiries;
  } catch (error) {
    console.error("Error fetching online inquiries: ", error);
    throw error;
  }
}

// Delete inquiry from Firestore
export async function deleteOnlineInquiry(inquiryKey) {
  if (!checkConfiguration()) return;
  try {
    const docRef = doc(db, "online_inquiries", inquiryKey.trim().toUpperCase());
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting online inquiry: ", error);
    throw error;
  }
}

// Add newsletter subscription to Firestore
export async function addNewsletterSubscription(email) {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    return email;
  }
  if (!checkConfiguration()) return null;
  if (!email) {
    throw new Error("Email is required");
  }
  try {
    const docRef = doc(db, "newsletter_subscriptions", email.trim().toLowerCase());
    await setDoc(docRef, {
      email: email.trim().toLowerCase(),
      createdAt: serverTimestamp()
    });
    return email;
  } catch (error) {
    console.error("Error saving newsletter subscription: ", error);
    throw error;
  }
}

// ==========================================
// 8. EMPLOYEE DATABASE OPERATIONS (tbl_employees)
// ==========================================
let mockEmployees = null;

export async function addEmployee(employeeData) {
  const { employee_id, employee_name, designation, employee_type, mobile_phone, email, status } = employeeData;
  if (!employee_name || !designation || !employee_type || !status) {
    throw new Error("Missing required employee fields");
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    if (!mockEmployees) {
      await getAllEmployees();
    }
    // Check email uniqueness if provided
    if (email) {
      const emailExists = mockEmployees.some(emp => emp.email && emp.email.toLowerCase() === email.toLowerCase() && emp.employee_id !== employee_id);
      if (emailExists) {
        throw new Error(`Email ${email} is already in use by another employee.`);
      }
    }
    const id = employee_id || "EMP-" + String(mockEmployees.length + 1).padStart(4, '0');
    const existingIndex = mockEmployees.findIndex(emp => emp.employee_id === id);
    const newEmp = {
      employee_id: id,
      employee_name: employee_name.trim(),
      designation: designation.trim(),
      employee_type: employee_type.trim(),
      mobile_phone: mobile_phone ? mobile_phone.trim() : "",
      email: email ? email.trim() : "",
      status: status || "Active",
      updatedAt: new Date()
    };
    if (existingIndex > -1) {
      newEmp.createdAt = mockEmployees[existingIndex].createdAt || new Date();
      mockEmployees[existingIndex] = newEmp;
    } else {
      newEmp.createdAt = new Date();
      mockEmployees.push(newEmp);
    }
    return id;
  }

  if (!checkConfiguration()) return null;

  // Check email uniqueness if provided
  if (email) {
    const querySnapshot = await getDocs(collection(db, "tbl_employees"));
    let emailExists = false;
    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.email && data.email.toLowerCase() === email.toLowerCase() && data.employee_id !== employee_id) {
        emailExists = true;
      }
    });
    if (emailExists) {
      throw new Error(`Email ${email} is already in use by another employee.`);
    }
  }

  try {
    const id = employee_id || await getNextSeqId("tbl_employees", "EMP-", "employee_id", 4);
    const docRef = doc(db, "tbl_employees", id);
    let originalCreatedAt = null;
    if (employee_id) {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        originalCreatedAt = snap.data().createdAt;
      }
    }
    await setDoc(docRef, {
      employee_id: id,
      employee_name: employee_name.trim(),
      designation: designation.trim(),
      employee_type: employee_type.trim(),
      mobile_phone: mobile_phone ? mobile_phone.trim() : "",
      email: email ? email.trim() : "",
      status: status || "Active",
      createdAt: originalCreatedAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    return id;
  } catch (error) {
    console.error("Error saving employee: ", error);
    throw error;
  }
}

export async function getAllEmployees() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    if (!mockEmployees) {
      mockEmployees = [
        {
          employee_id: "EMP-0001",
          employee_name: "Jobaer Hossain",
          designation: "Operations Manager",
          employee_type: "In-house Staff",
          mobile_phone: "+8801711223344",
          email: "jobaer@intrex-digital.com",
          status: "Active",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          employee_id: "EMP-0002",
          employee_name: "Sarah Jenkins",
          designation: "Corporate Trainer",
          employee_type: "External Professionals",
          mobile_phone: "+8801799887766",
          email: "sarah.j@intrex-digital.com",
          status: "Active",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          employee_id: "EMP-0003",
          employee_name: "Tariqul Islam",
          designation: "Finance Officer",
          employee_type: "In-house Staff",
          mobile_phone: "+8801555443322",
          email: "tariqul@intrex-digital.com",
          status: "Active",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    }
    return mockEmployees;
  }

  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "tbl_employees"));
    const employees = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        employees.push(docSnap.data());
      }
    });
    employees.sort((a, b) => a.employee_id.localeCompare(b.employee_id));
    return employees;
  } catch (error) {
    console.error("Error fetching employees: ", error);
    throw error;
  }
}

export async function deleteEmployee(employeeId) {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    if (!mockEmployees) {
      await getAllEmployees();
    }
    mockEmployees = mockEmployees.filter(emp => emp.employee_id !== employeeId);
    return;
  }

  if (!checkConfiguration()) return;
  try {
    const docRef = doc(db, "tbl_employees", employeeId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting employee: ", error);
    throw error;
  }
}

// ==========================================
// 9. TRAINING BATCHES OPERATIONS (batches)
// ==========================================
let mockBatches = null;

export async function getAllBatches() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    if (!mockBatches) {
      mockBatches = [
        {
          batchId: "CCNA-B01",
          courseName: "CCNA",
          schedule: "Morning (9am – 12pm)",
          capacity: 10,
          status: "Active",
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        },
        {
          batchId: "SEC-B01",
          courseName: "CompTIA Security+",
          schedule: "Evening (5pm – 8pm)",
          capacity: 10,
          status: "Active",
          createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
        },
        {
          batchId: "NET-B01",
          courseName: "CompTIA Network+",
          schedule: "Weekend Batch",
          capacity: 10,
          status: "Upcoming",
          createdAt: new Date()
        }
      ];
    }
    return mockBatches;
  }

  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "batches"));
    const batches = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        batches.push(docSnap.data());
      }
    });
    batches.sort((a, b) => a.batchId.localeCompare(b.batchId));
    return batches;
  } catch (error) {
    console.error("Error fetching batches: ", error);
    throw error;
  }
}

export async function addBatch(batchData) {
  const { batchId, courseName, schedule, capacity, status } = batchData;
  if (!batchId || !courseName || !status) {
    throw new Error("Missing required batch fields");
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    if (!mockBatches) {
      await getAllBatches();
    }
    const existingIndex = mockBatches.findIndex(b => b.batchId.toLowerCase() === batchId.trim().toLowerCase());
    if (existingIndex > -1) {
      throw new Error(`Batch ID ${batchId} already exists.`);
    }
    const newBatch = {
      batchId: batchId.trim(),
      courseName: courseName.trim(),
      schedule: schedule || "Morning (9am – 12pm)",
      capacity: Number(capacity) || 10,
      status: status || "Active",
      createdAt: new Date()
    };
    mockBatches.push(newBatch);
    return batchId;
  }

  if (!checkConfiguration()) return null;

  try {
    const docRef = doc(db, "batches", batchId.trim());
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      throw new Error(`Batch ID ${batchId} already exists.`);
    }
    await setDoc(docRef, {
      batchId: batchId.trim(),
      courseName: courseName.trim(),
      schedule: schedule || "Morning (9am – 12pm)",
      capacity: Number(capacity) || 10,
      status: status || "Active",
      createdAt: serverTimestamp()
    });
    return batchId;
  } catch (error) {
    console.error("Error saving batch: ", error);
    throw error;
  }
}

export async function updateBatch(batchId, batchData) {
  const { courseName, schedule, capacity, status } = batchData;

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    if (!mockBatches) {
      await getAllBatches();
    }
    const existingIndex = mockBatches.findIndex(b => b.batchId === batchId.trim());
    if (existingIndex > -1) {
      mockBatches[existingIndex] = {
        ...mockBatches[existingIndex],
        courseName: courseName ? courseName.trim() : mockBatches[existingIndex].courseName,
        schedule: schedule ? schedule.trim() : mockBatches[existingIndex].schedule,
        capacity: capacity !== undefined ? Number(capacity) : mockBatches[existingIndex].capacity,
        status: status ? status.trim() : mockBatches[existingIndex].status,
        updatedAt: new Date()
      };
    }
    return batchId;
  }

  if (!checkConfiguration()) return;

  try {
    const docRef = doc(db, "batches", batchId.trim());
    await setDoc(docRef, {
      courseName: courseName.trim(),
      schedule: schedule || "Morning (9am – 12pm)",
      capacity: Number(capacity) || 10,
      status: status || "Active",
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error updating batch: ", error);
    throw error;
  }
}

export async function deleteBatch(batchId) {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    if (!mockBatches) {
      await getAllBatches();
    }
    mockBatches = mockBatches.filter(b => b.batchId !== batchId);
    return;
  }

  if (!checkConfiguration()) return;
  try {
    const docRef = doc(db, "batches", batchId.trim());
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting batch: ", error);
    throw error;
  }
}

// ==========================================
// 10. PUBLIC INSTITUTES OPERATIONS (public_institutes)
// ==========================================
let mockPublicInstitutes = null;

export async function getAllPublicInstitutes() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    if (!mockPublicInstitutes) {
      mockPublicInstitutes = [
        {
          id: "INST-0001",
          name: "National Academy for Computer Training and Research (NACTAR)",
          contactPerson: "Dr. MD. Omar Faruque",
          email: "nactar@gov.bd",
          phone: "+8801711223344",
          type: "Government Training Institute",
          location: "Bogura, Bangladesh",
          website: "http://nactar.gov.bd",
          status: "Active",
          notes: "NACTAR is an apex training institute of Ministry of Education.",
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        },
        {
          id: "INST-0002",
          name: "Bangladesh Industrial Technical Assistance Center (BITAC)",
          contactPerson: "Engr. MD. Anwar Hossain",
          email: "info@bitac.gov.bd",
          phone: "+8801555667788",
          type: "Government Training Institute",
          location: "Tejgaon Industrial Area, Dhaka",
          website: "http://bitac.gov.bd",
          status: "Active",
          notes: "BITAC offers various technical training courses for industry workers.",
          createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
        },
        {
          id: "INST-0003",
          name: "Intrex Digital Professional Training Academy",
          contactPerson: "Sarah Jenkins",
          email: "academy@intrex-digital.com",
          phone: "+8801799887766",
          type: "Professional Training Institute",
          location: "Mirpur-10, Dhaka",
          website: "https://intrex-digital.com",
          status: "Active",
          notes: "Our internal professional training academy partners.",
          createdAt: new Date()
        }
      ];
    }
    return mockPublicInstitutes;
  }

  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "public_institutes"));
    const institutes = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        institutes.push(docSnap.data());
      }
    });
    institutes.sort((a, b) => a.id.localeCompare(b.id));
    return institutes;
  } catch (error) {
    console.error("Error fetching public institutes: ", error);
    throw error;
  }
}

export async function addPublicInstitute(instData) {
  const { name, contactPerson, email, phone, type, location, website, status, notes } = instData;
  if (!name || !type || !status) {
    throw new Error("Missing required institute fields: name, type, status");
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    if (!mockPublicInstitutes) {
      await getAllPublicInstitutes();
    }
    const id = "INST-" + String(mockPublicInstitutes.length + 1).padStart(4, '0');
    const newInst = {
      id,
      name: name.trim(),
      contactPerson: contactPerson ? contactPerson.trim() : "",
      email: email ? email.trim() : "",
      phone: phone ? phone.trim() : "",
      type: type.trim(),
      location: location ? location.trim() : "",
      website: website ? website.trim() : "",
      status: status || "Active",
      notes: notes ? notes.trim() : "",
      createdAt: new Date()
    };
    mockPublicInstitutes.push(newInst);
    return id;
  }

  if (!checkConfiguration()) return null;

  try {
    const id = await getNextSeqId("public_institutes", "INST-", "id", 4);
    const docRef = doc(db, "public_institutes", id);
    await setDoc(docRef, {
      id,
      name: name.trim(),
      contactPerson: contactPerson ? contactPerson.trim() : "",
      email: email ? email.trim() : "",
      phone: phone ? phone.trim() : "",
      type: type.trim(),
      location: location ? location.trim() : "",
      website: website ? website.trim() : "",
      status: status || "Active",
      notes: notes ? notes.trim() : "",
      createdAt: serverTimestamp()
    });
    return id;
  } catch (error) {
    console.error("Error saving public institute: ", error);
    throw error;
  }
}

export async function updatePublicInstitute(instId, instData) {
  const { name, contactPerson, email, phone, type, location, website, status, notes } = instData;

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    if (!mockPublicInstitutes) {
      await getAllPublicInstitutes();
    }
    const index = mockPublicInstitutes.findIndex(inst => inst.id === instId.trim());
    if (index > -1) {
      mockPublicInstitutes[index] = {
        ...mockPublicInstitutes[index],
        name: name ? name.trim() : mockPublicInstitutes[index].name,
        contactPerson: contactPerson !== undefined ? contactPerson.trim() : mockPublicInstitutes[index].contactPerson,
        email: email !== undefined ? email.trim() : mockPublicInstitutes[index].email,
        phone: phone !== undefined ? phone.trim() : mockPublicInstitutes[index].phone,
        type: type ? type.trim() : mockPublicInstitutes[index].type,
        location: location !== undefined ? location.trim() : mockPublicInstitutes[index].location,
        website: website !== undefined ? website.trim() : mockPublicInstitutes[index].website,
        status: status ? status.trim() : mockPublicInstitutes[index].status,
        notes: notes !== undefined ? notes.trim() : mockPublicInstitutes[index].notes,
        updatedAt: new Date()
      };
    }
    return instId;
  }

  if (!checkConfiguration()) return;

  try {
    const docRef = doc(db, "public_institutes", instId.trim());
    await setDoc(docRef, {
      name: name.trim(),
      contactPerson: contactPerson ? contactPerson.trim() : "",
      email: email ? email.trim() : "",
      phone: phone ? phone.trim() : "",
      type: type.trim(),
      location: location ? location.trim() : "",
      website: website ? website.trim() : "",
      status: status || "Active",
      notes: notes ? notes.trim() : "",
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error updating public institute: ", error);
    throw error;
  }
}

export async function deletePublicInstitute(instId) {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    if (!mockPublicInstitutes) {
      await getAllPublicInstitutes();
    }
    mockPublicInstitutes = mockPublicInstitutes.filter(inst => inst.id !== instId);
    return;
  }

  if (!checkConfiguration()) return;
  try {
    const docRef = doc(db, "public_institutes", instId.trim());
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting public institute: ", error);
    throw error;
  }
}

let mockJobPlacements = null;

export async function getAllJobPlacements() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    if (!mockJobPlacements) {
      mockJobPlacements = [
        {
          id: "PLACE-0001",
          studentId: "495001",
          studentName: "Jobaer Hossain",
          courseName: "CCNA",
          batchId: "CCNA-B01",
          company: "Intrex Digital",
          jobTitle: "Network Specialist",
          placementDate: "2026-05-15",
          salary: 35000,
          placementType: "Full-time Permanent",
          notes: "Placed successfully through corporate partners.",
          createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
        },
        {
          id: "PLACE-0002",
          studentId: "495002",
          studentName: "Rahat Kabir",
          courseName: "CompTIA Security+",
          batchId: "SEC-B01",
          company: "Grameenphone",
          jobTitle: "SOC Analyst Intern",
          placementDate: "2026-06-01",
          salary: 18000,
          placementType: "Internship",
          notes: "3-month probation period.",
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
        }
      ];
    }
    return mockJobPlacements;
  }

  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "job_placements"));
    const placements = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        placements.push(docSnap.data());
      }
    });
    placements.sort((a, b) => a.id.localeCompare(b.id));
    return placements;
  } catch (error) {
    console.error("Error fetching job placements: ", error);
    throw error;
  }
}

export async function addJobPlacement(placementData) {
  const { studentId, studentName, courseName, batchId, company, jobTitle, placementDate, salary, placementType, notes } = placementData;
  if (!studentId || !studentName || !company || !jobTitle || !placementDate || !placementType) {
    throw new Error("Missing required placement fields: studentId, studentName, company, jobTitle, placementDate, placementType");
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    if (!mockJobPlacements) {
      await getAllJobPlacements();
    }
    const id = "PLACE-" + String(mockJobPlacements.length + 1).padStart(4, '0');
    const newPlacement = {
      id,
      studentId: studentId.trim(),
      studentName: studentName.trim(),
      courseName: courseName ? courseName.trim() : "",
      batchId: batchId ? batchId.trim() : "",
      company: company.trim(),
      jobTitle: jobTitle.trim(),
      placementDate,
      salary: salary ? Number(salary) : 0,
      placementType: placementType.trim(),
      notes: notes ? notes.trim() : "",
      createdAt: new Date()
    };
    mockJobPlacements.push(newPlacement);
    return id;
  }

  if (!checkConfiguration()) return null;

  try {
    const id = await getNextSeqId("job_placements", "PLACE-", "id", 4);
    const docRef = doc(db, "job_placements", id);
    await setDoc(docRef, {
      id,
      studentId: studentId.trim(),
      studentName: studentName.trim(),
      courseName: courseName ? courseName.trim() : "",
      batchId: batchId ? batchId.trim() : "",
      company: company.trim(),
      jobTitle: jobTitle.trim(),
      placementDate,
      salary: salary ? Number(salary) : 0,
      placementType: placementType.trim(),
      notes: notes ? notes.trim() : "",
      createdAt: serverTimestamp()
    });
    return id;
  } catch (error) {
    console.error("Error saving job placement: ", error);
    throw error;
  }
}

export async function updateJobPlacement(placementId, placementData) {
  const { company, jobTitle, placementDate, salary, placementType, notes } = placementData;

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    if (!mockJobPlacements) {
      await getAllJobPlacements();
    }
    const index = mockJobPlacements.findIndex(p => p.id === placementId.trim());
    if (index > -1) {
      mockJobPlacements[index] = {
        ...mockJobPlacements[index],
        company: company ? company.trim() : mockJobPlacements[index].company,
        jobTitle: jobTitle ? jobTitle.trim() : mockJobPlacements[index].jobTitle,
        placementDate: placementDate ? placementDate : mockJobPlacements[index].placementDate,
        salary: salary !== undefined ? Number(salary) : mockJobPlacements[index].salary,
        placementType: placementType ? placementType.trim() : mockJobPlacements[index].placementType,
        notes: notes !== undefined ? notes.trim() : mockJobPlacements[index].notes,
        updatedAt: new Date()
      };
    }
    return placementId;
  }

  if (!checkConfiguration()) return;

  try {
    const docRef = doc(db, "job_placements", placementId.trim());
    await setDoc(docRef, {
      company: company.trim(),
      jobTitle: jobTitle.trim(),
      placementDate,
      salary: salary ? Number(salary) : 0,
      placementType: placementType.trim(),
      notes: notes ? notes.trim() : "",
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error updating job placement: ", error);
    throw error;
  }
}

export async function deleteJobPlacement(placementId) {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mock') === '1') {
    if (!mockJobPlacements) {
      await getAllJobPlacements();
    }
    mockJobPlacements = mockJobPlacements.filter(p => p.id !== placementId);
    return;
  }

  if (!checkConfiguration()) return;
  try {
    const docRef = doc(db, "job_placements", placementId.trim());
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting job placement: ", error);
    throw error;
  }
}




