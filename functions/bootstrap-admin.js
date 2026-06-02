const admin = require("firebase-admin");
const path = require("path");

const email = process.argv[2];
const role = process.argv[3] || "super_admin";

if (!email) {
  console.error("Usage: node bootstrap-admin.js <email> [role]");
  process.exit(1);
}

const serviceAccountPath = path.join(__dirname, "service-account.json");

try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  admin.auth().getUserByEmail(email)
    .then((user) => {
      return admin.auth().setCustomUserClaims(user.uid, { role })
        .then(() => {
          console.log(`Successfully set custom claim '${role}' for user '${email}'.`);
          process.exit(0);
        });
    })
    .catch((error) => {
      if (error.code === "auth/user-not-found") {
        console.log(`User '${email}' not found. Creating a new user account...`);
        const tempPassword = "TempPassword2026!";
        return admin.auth().createUser({
          email: email,
          password: tempPassword,
          emailVerified: true
        })
        .then((userRecord) => {
          console.log(`User created successfully with UID: ${userRecord.uid}`);
          console.log(`Temporary Password: ${tempPassword}`);
          return admin.auth().setCustomUserClaims(userRecord.uid, { role })
            .then(() => {
              console.log(`Successfully set custom claim '${role}' for user '${email}'.`);
              console.log("\nYou can now log in to the dashboard using these credentials.");
              process.exit(0);
            });
        });
      } else {
        console.error("Error setting custom claims:", error.message);
        process.exit(1);
      }
    });
} catch (err) {
  console.error("Error: Could not load service-account.json.");
  console.error(`Expected file at: ${serviceAccountPath}`);
  console.error("\nTo generate this file:\n1. Go to Firebase Console -> Project Settings -> Service accounts.\n2. Click 'Generate new private key' and download the JSON file.\n3. Save it as 'service-account.json' inside the 'functions/' directory.");
  process.exit(1);
}
