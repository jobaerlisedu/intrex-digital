const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

// Secret key for cryptographic signing of certificates (use environment configuration in production)
const CERT_SIGNING_SECRET = process.env.CERT_SIGNING_SECRET || "secure-intrex-digital-signing-key-2026";

/**
 * 1. validateAndRecordPayment
 * Validates payment amounts, computes outstanding balances, and logs ledger updates.
 */
exports.validateAndRecordPayment = onCall(async (request) => {
  // Check auth
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const { paymentType, recordId, amountPaid, transactionRef } = request.data;

  if (!recordId || amountPaid === undefined || isNaN(amountPaid) || Number(amountPaid) <= 0) {
    throw new HttpsError("invalid-argument", "Missing or invalid payment parameters.");
  }

  const userEmail = request.auth.token.email || "unknown@intrex-digital.com";

  try {
    if (paymentType === "INVOICE") {
      // Solutions Dashboard Invoices (tbl_client_payments)
      const invoiceRef = db.collection("tbl_client_payments").doc(recordId);
      const invoiceSnap = await invoiceRef.get();

      if (!invoiceSnap.exists) {
        throw new HttpsError("not-found", `Invoice ID ${recordId} not found.`);
      }

      const invoiceData = invoiceSnap.data();
      const invoicedAmount = Number(invoiceData.invoiced_amount) || 0;
      const currentReceived = Number(invoiceData.amount_received) || 0;
      const newReceived = currentReceived + Number(amountPaid);

      if (newReceived > invoicedAmount) {
        throw new HttpsError("out-of-range", `Payment amount (${amountPaid} BDT) exceeds outstanding balance of ${(invoicedAmount - currentReceived)} BDT.`);
      }

      const status = newReceived === invoicedAmount ? "Fully Paid" : "Partially Paid";

      await db.runTransaction(async (t) => {
        t.update(invoiceRef, {
          amount_received: newReceived,
          payment_status: status,
          date_received: new Date().toISOString().substring(0, 10),
          transaction_ref: transactionRef || "N/A",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Write an audit log entry
        const logRef = db.collection("tbl_audit_logs").doc();
        t.set(logRef, {
          log_id: logRef.id,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          user_email: userEmail,
          action_type: "PAYMENT_RECORDED",
          collection_name: "tbl_client_payments",
          record_id: recordId,
          details: `Recorded payment of ${amountPaid} BDT. New total received: ${newReceived} BDT. Status: ${status}`
        });
      });

      return { success: true, newReceived, status };
    } else {
      // Training Dashboard Payments
      const paymentRef = db.collection("payments").doc(recordId);
      const paymentSnap = await paymentRef.get();

      if (!paymentSnap.exists) {
        throw new HttpsError("not-found", `Payment record ${recordId} not found.`);
      }

      const paymentData = paymentSnap.data();
      const totalFee = Number(paymentData.totalFee) || 0;
      const discount = Number(paymentData.discount) || 0;
      const currentPaid = Number(paymentData.amountPaid) || 0;
      const netBilled = totalFee - discount;
      const newPaid = currentPaid + Number(amountPaid);

      if (newPaid > netBilled) {
        throw new HttpsError("out-of-range", `Payment amount (${amountPaid} BDT) exceeds outstanding balance of ${(netBilled - currentPaid)} BDT.`);
      }

      const status = newPaid === netBilled ? "Fully Paid" : "Partially Paid";
      const dueAmount = netBilled - newPaid;

      await db.runTransaction(async (t) => {
        t.update(paymentRef, {
          amountPaid: newPaid,
          dueAmount: dueAmount,
          status: status,
          transactionId: transactionRef || paymentData.transactionId || "N/A",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Also update registration entry if it exists
        const regSnap = await db.collection("registrations").where("studentId", "==", paymentData.studentId).limit(1).get();
        if (!regSnap.empty) {
          t.update(regSnap.docs[0].ref, {
            amountPaid: newPaid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      });

      return { success: true, newPaid, status, dueAmount };
    }
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message);
  }
});

/**
 * 2. generateCertificate
 * Cryptographically signs a certificate's critical data using HMAC-SHA256.
 */
exports.generateCertificate = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  // Enforce roles: super_admin, trainer, or PM
  const role = request.auth.token.role;
  if (role !== "super_admin" && role !== "trainer" && role !== "project_manager") {
    throw new HttpsError("permission-denied", "Unauthorized. Only super_admin, trainer, or project_manager can sign certificates.");
  }

  const { certificateId } = request.data;
  if (!certificateId) {
    throw new HttpsError("invalid-argument", "Missing certificate ID.");
  }

  try {
    const certRef = db.collection("certificates").doc(certificateId);
    const certSnap = await certRef.get();

    if (!certSnap.exists) {
      throw new HttpsError("not-found", "Certificate not found.");
    }

    const data = certSnap.data();
    
    // Prepare the payload string for hashing (critical fields only)
    const payload = `${data.certificateId}|${data.studentName}|${data.courseName}|${data.issueDate}|${data.grade}|${data.batch}`;
    
    // Compute cryptographic signature
    const signature = crypto
      .createHmac("sha256", CERT_SIGNING_SECRET)
      .update(payload)
      .digest("hex");

    // Write signature back to document
    await certRef.update({
      signature: signature,
      signedBy: request.auth.token.email || "admin",
      signedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, certificateId, signature };
  } catch (error) {
    throw new HttpsError("internal", error.message);
  }
});

/**
 * 3. processFinancialApproval
 * Restricts financial approvals to Super Admin and Project Manager claims, updating requisitions/POs securely.
 */
exports.processFinancialApproval = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const role = request.auth.token.role;
  if (role !== "super_admin" && role !== "project_manager") {
    throw new HttpsError("permission-denied", "Access denied. Only Super Admins and Project Managers can process financial approvals.");
  }

  const { targetType, recordId, approvalStatus, rejectionReason } = request.data;

  if (!recordId || !approvalStatus || !targetType) {
    throw new HttpsError("invalid-argument", "Missing required parameters.");
  }

  const userEmail = request.auth.token.email || "admin@intrex-digital.com";

  try {
    if (targetType === "REQUISITION") {
      const reqRef = db.collection("tbl_requisitions").doc(recordId);
      const reqSnap = await reqRef.get();

      if (!reqSnap.exists) {
        throw new HttpsError("not-found", "Requisition not found.");
      }

      await db.runTransaction(async (t) => {
        t.update(reqRef, {
          dept_approval: approvalStatus,
          rejection_reason: approvalStatus === "Rejected" ? (rejectionReason || "No reason provided") : "",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Write audit log
        const logRef = db.collection("tbl_audit_logs").doc();
        t.set(logRef, {
          log_id: logRef.id,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          user_email: userEmail,
          action_type: "REQUISITION_APPROVAL",
          collection_name: "tbl_requisitions",
          record_id: recordId,
          details: `Requisition approval state set to: ${approvalStatus}. PM/Admin approval processed.`
        });
      });

      return { success: true, recordId, approvalStatus };
    } else if (targetType === "PURCHASE_ORDER") {
      const poRef = db.collection("tbl_purchase_orders").doc(recordId);
      const poSnap = await poRef.get();

      if (!poSnap.exists) {
        throw new HttpsError("not-found", "Purchase Order not found.");
      }

      await db.runTransaction(async (t) => {
        t.update(poRef, {
          po_status: approvalStatus,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Write audit log
        const logRef = db.collection("tbl_audit_logs").doc();
        t.set(logRef, {
          log_id: logRef.id,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          user_email: userEmail,
          action_type: "PO_APPROVAL",
          collection_name: "tbl_purchase_orders",
          record_id: recordId,
          details: `Purchase order status set to: ${approvalStatus}. PM/Admin approval processed.`
        });
      });

      return { success: true, recordId, approvalStatus };
    } else {
      throw new HttpsError("invalid-argument", "Unsupported target type.");
    }
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message);
  }
});
