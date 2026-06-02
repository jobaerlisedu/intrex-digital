// assets/js/verify.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
  isFirebaseConfigured = true;
} else {
  console.warn("Firebase configuration has not been set up. Please update the firebaseConfig object in assets/js/verify.js.");
}

// Helper to check configuration state
function checkConfiguration() {
  if (!isFirebaseConfigured) {
    alert("Firebase configuration is not set up yet. Please enter your Firebase config details in 'assets/js/verify.js'.");
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
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "certificates"));
    const certs = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists() && docSnap.id !== "_init_") {
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

  const { fullName, email, phone, course, batch, education, schedule, message, totalFee, discount, amountPaid, paymentType, transactionId } = regData;

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

    const studentId = generateStudentId(course, batch, regs);

    // 2. Save registration info using studentId as document ID
    const regRef = doc(db, "registrations", studentId);
    await setDoc(regRef, {
      studentId,
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      course: course.trim(),
      batch: batch.trim(),
      education: education || "",
      schedule: schedule || "",
      message: message ? message.trim() : "",
      createdAt: serverTimestamp()
    });

    // 3. Create corresponding payment record linked by studentId as document ID
    const fee = Number(totalFee) || 0;
    const disc = Number(discount) || 0;
    const paid = Number(amountPaid) || 0;
    const effectiveFee = Math.max(0, fee - disc);
    const due = Math.max(0, effectiveFee - paid);
    let status = "Unpaid";
    if (paid > 0) {
      status = paid >= effectiveFee ? "Fully Paid" : "Partially Paid";
    }

    const payRef = doc(db, "payments", studentId);
    await setDoc(payRef, {
      studentId,
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
      updatedAt: serverTimestamp()
    });

    return studentId;
  } catch (error) {
    console.error("Error adding course registration: ", error);
    throw error;
  }
}

// Fetch all course registrations
export async function getAllRegistrations() {
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "registrations"));
    const regs = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists() && docSnap.id !== "_init_") {
        regs.push(docSnap.data());
      }
    });
    return regs;
  } catch (error) {
    console.error("Error fetching registrations: ", error);
    throw error;
  }
}

// Update course registration
export async function updateRegistration(studentId, regData) {
  if (!checkConfiguration()) return;

  const { fullName, email, phone, course, batch, education, schedule, message } = regData;

  if (!fullName || !email || !phone || !course || !batch || !schedule) {
    throw new Error("Missing required registration fields");
  }

  try {
    const regRef = doc(db, "registrations", studentId);
    await setDoc(regRef, {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      course: course.trim(),
      batch: batch.trim(),
      education: education || "",
      schedule: schedule || "",
      message: message ? message.trim() : ""
    }, { merge: true });

    // Sync student name, email, course and batch to the payment record
    const payRef = doc(db, "payments", studentId);
    
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
export async function deleteRegistration(studentId) {
  if (!checkConfiguration()) return;
  try {
    const regRef = doc(db, "registrations", studentId);
    await deleteDoc(regRef);

    const payRef = doc(db, "payments", studentId);
    await deleteDoc(payRef);

    // Also delete any certificates for this student
    const certQuerySnapshot = await getDocs(collection(db, "certificates"));
    certQuerySnapshot.forEach(async (docSnap) => {
      if (docSnap.exists()) {
        const certData = docSnap.data();
        if (certData.studentId === studentId) {
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
  if (!checkConfiguration()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, "payments"));
    const pays = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists() && docSnap.id !== "_init_") {
        pays.push(docSnap.data());
      }
    });
    return pays;
  } catch (error) {
    console.error("Error fetching payments: ", error);
    throw error;
  }
}

// Update payment record details
export async function updatePayment(studentId, totalFee, discount, amountPaid, paymentType, transactionId) {
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

    const payRef = doc(db, "payments", studentId);
    await setDoc(payRef, {
      totalFee: fee,
      discount: disc,
      amountPaid: paid,
      dueAmount: due,
      status: status,
      paymentType: paymentType || "Cash",
      transactionId: (paymentType !== "Cash" && transactionId) ? transactionId.trim() : "",
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error updating payment: ", error);
    throw error;
  }
}

