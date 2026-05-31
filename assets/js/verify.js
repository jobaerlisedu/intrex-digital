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

  const { certificateId, studentName, courseName, issueDate, grade, status, batch } = certData;
  
  if (!certificateId || !studentName || !courseName || !issueDate || !batch) {
    throw new Error("Missing required fields");
  }

  try {
    const docRef = doc(db, "certificates", certificateId.trim());
    await setDoc(docRef, {
      certificateId: certificateId.trim(),
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
