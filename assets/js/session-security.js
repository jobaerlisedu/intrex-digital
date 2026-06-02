// assets/js/session-security.js
// Enterprise Session Security & Lifecycle Management Utility

let inactivityTimer = null;
const INACTIVITY_TIMEOUT_MS = 3 * 60 * 1000; // Exactly 3 minutes

/**
 * Wipes all storage, nullifies memory references, and redirects to login.
 * @param {string} loginPageUrl - URL of the login page.
 */
export function cleanseStateAndRedirect(loginPageUrl) {
  try {
    // 1. Wipe client-side storage
    localStorage.clear();
    sessionStorage.clear();

    // 2. Nullify window reference attributes to prevent memory harvest/XSS
    if (window.firebase) window.firebase = null;
    if (window.auth) window.auth = null;
    if (window.db) window.db = null;

    // 3. Clear sensitive variables from global scope where possible
    window.currentUserEmail = null;
    window.allRecords = null;
    window.allRegistrations = null;
    window.allPayments = null;

  } catch (err) {
    console.error("State cleansing encountered an error:", err);
  } finally {
    // 4. Force browser navigation redirect
    window.location.replace(loginPageUrl);
  }
}

/**
 * Marks the session as active inside this tab context.
 */
export function markTabSessionActive() {
  sessionStorage.setItem("tab_session_active", "true");
}

/**
 * Initializes inactivity auto-logout and tab closure security checks.
 * @param {object} authInstance - Firebase Auth instance.
 * @param {function} logoutFn - Callback to execute Firebase signOut().
 * @param {string} loginPageUrl - Redirect path after session invalidation.
 */
export function initSessionSecurity(authInstance, logoutFn, loginPageUrl) {
  // --- 1. TAB/WINDOW CLOSURE TERMINATION CHECK ---
  // If a tab is loaded or restored, sessionStorage is checked.
  // If Firebase Auth holds a session but sessionStorage does not contain the active flag,
  // it implies a restore attempt on a different/new tab, which is rejected.
  authInstance.onAuthStateChanged(async (user) => {
    if (user) {
      const isTabActive = sessionStorage.getItem("tab_session_active") === "true";
      if (!isTabActive) {
        console.warn("Session isolation violation: Active session found without tab-specific token. Terminating session...");
        try {
          await logoutFn();
        } catch (err) {
          console.error("SignOut failure during tab security check:", err);
        } finally {
          cleanseStateAndRedirect(loginPageUrl);
        }
      } else {
        // Tab is validated; activate the inactivity tracking
        resetInactivityTimer();
      }
    }
  });

  // --- 2. 3-MINUTE INACTIVITY AUTO-LOGOUT ---
  function resetInactivityTimer() {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }
    inactivityTimer = setTimeout(async () => {
      console.warn("User inactivity limit reached. Initiating automatic security sign-out...");
      try {
        await logoutFn();
      } catch (err) {
        console.error("SignOut failure during inactivity auto-logout:", err);
      } finally {
        cleanseStateAndRedirect(loginPageUrl);
      }
    }, INACTIVITY_TIMEOUT_MS);
  }

  // Throttle user events to maintain rendering performance (re-evaluates every 2 seconds max)
  let lastEventTime = 0;
  const eventThrottleDelay = 2000;

  function onUserActivity() {
    const now = Date.now();
    if (now - lastEventTime > eventThrottleDelay) {
      lastEventTime = now;
      resetInactivityTimer();
    }
  }

  // Bind optimized listeners for physical user interactions
  const activityEvents = ["mousemove", "keydown", "click", "touchstart", "scroll"];
  activityEvents.forEach((evt) => {
    window.addEventListener(evt, onUserActivity, { passive: true });
  });

  // --- 3. HARD CLOSURE LIFECYCLE LISTENERS ---
  // Attempt to invoke signOut beforeunload/unload to invalidate session tokens on server side
  window.addEventListener("beforeunload", () => {
    // Attempt standard synchronous cleanup on close
    logoutFn();
    cleanseStateAndRedirect(loginPageUrl);
  });
}
