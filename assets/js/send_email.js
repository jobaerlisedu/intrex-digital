document.addEventListener("DOMContentLoaded", function () {

  /* ── Contact / Inquiry Form ─────────────────────────────────── */
  const contactForm = document.getElementById("contactForm");
  const successMessage = document.getElementById("successMessage");
  const errorMessage = document.getElementById("errorMessage");

  if (contactForm) {
    contactForm.addEventListener("submit", function (event) {
      event.preventDefault();

      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";

      successMessage.classList.add("d-none");
      errorMessage.classList.add("d-none");

      const formData = new FormData(contactForm);
      const endpoint = contactForm.dataset.formspree;

      if (!endpoint) {
        errorMessage.textContent = "Form endpoint not configured.";
        errorMessage.classList.remove("d-none");
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
        return;
      }

      fetch(endpoint, {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
      })
        .then(function (response) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
          if (response.ok) {
            successMessage.classList.remove("d-none");
            contactForm.reset();
          } else {
            return response.json().then(function (data) {
              errorMessage.textContent =
                data.errors
                  ? data.errors.map(function (e) { return e.message; }).join(", ")
                  : "Request failed. Please try again.";
              errorMessage.classList.remove("d-none");
            });
          }
        })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
          errorMessage.textContent = "Network error. Please check your connection and try again.";
          errorMessage.classList.remove("d-none");
        });
    });
  }

  /* ── Newsletter Form ────────────────────────────────────────── */
  const newsletterForm = document.getElementById("newsletterForm");

  if (newsletterForm) {
    newsletterForm.addEventListener("submit", function (event) {
      event.preventDefault();

      const submitBtn = newsletterForm.querySelector('button[type="submit"]');
      const feedback = document.getElementById("newsletterFeedback");
      const originalBtnText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Subscribing...";
      if (feedback) {
        feedback.textContent = "";
        feedback.className = "small mt-2";
      }

      const formData = new FormData(newsletterForm);
      const endpoint = newsletterForm.dataset.formspree;

      if (!endpoint) {
        if (feedback) {
          feedback.textContent = "Newsletter endpoint not configured.";
          feedback.classList.add("text-danger");
        }
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
        return;
      }

      fetch(endpoint, {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
      })
        .then(function (response) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
          if (response.ok) {
            newsletterForm.reset();
            if (feedback) {
              feedback.textContent = "✓ You're subscribed! Thank you.";
              feedback.classList.add("text-success", "fw-semibold");
            }
          } else {
            return response.json().then(function (data) {
              if (feedback) {
                feedback.textContent =
                  data.errors
                    ? data.errors.map(function (e) { return e.message; }).join(", ")
                    : "Subscription failed. Please try again.";
                feedback.classList.add("text-danger");
              }
            });
          }
        })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
          if (feedback) {
            feedback.textContent = "Network error. Please try again.";
            feedback.classList.add("text-danger");
          }
        });
    });
  }

  /* ── Registration Modal – pre-fill course & handle submit ───── */
  const registrationModal = document.getElementById("registrationModal");
  const registrationForm  = document.getElementById("registrationForm");
  const regCourseSelect   = document.getElementById("reg-course");
  const regSuccessMessage = document.getElementById("regSuccessMessage");
  const regErrorMessage   = document.getElementById("regErrorMessage");

  // Pre-fill course dropdown when any Register button opens the modal
  if (registrationModal && regCourseSelect) {
    registrationModal.addEventListener("show.bs.modal", function (event) {
      const triggerBtn = event.relatedTarget;
      const course = triggerBtn && triggerBtn.dataset.course;
      if (course) {
        regCourseSelect.value = course;
      }
      // Reset feedback on re-open
      if (regSuccessMessage) regSuccessMessage.classList.add("d-none");
      if (regErrorMessage)   regErrorMessage.classList.add("d-none");
      if (registrationForm)  registrationForm.classList.remove("d-none");
    });
  }

  if (registrationForm) {
    registrationForm.addEventListener("submit", function (event) {
      event.preventDefault();

      const submitBtn = registrationForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Submitting...';

      if (regSuccessMessage) regSuccessMessage.classList.add("d-none");
      if (regErrorMessage)   regErrorMessage.classList.add("d-none");

      const formData = new FormData(registrationForm);
      const endpoint = registrationForm.dataset.formspree;

      if (!endpoint) {
        if (regErrorMessage) {
          regErrorMessage.textContent = "Registration endpoint not configured.";
          regErrorMessage.classList.remove("d-none");
        }
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        return;
      }

      fetch(endpoint, {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
      })
        .then(function (response) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
          if (response.ok) {
            registrationForm.reset();
            registrationForm.classList.add("d-none");
            if (regSuccessMessage) regSuccessMessage.classList.remove("d-none");
          } else {
            return response.json().then(function (data) {
              if (regErrorMessage) {
                regErrorMessage.textContent =
                  data.errors
                    ? data.errors.map(function (e) { return e.message; }).join(", ")
                    : "Submission failed. Please try again.";
                regErrorMessage.classList.remove("d-none");
              }
            });
          }
        })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
          if (regErrorMessage) {
            regErrorMessage.textContent = "Network error. Please check your connection and try again.";
            regErrorMessage.classList.remove("d-none");
          }
        });
    });
  }

});
