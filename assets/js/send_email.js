document.addEventListener("DOMContentLoaded", function () {
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

      // Simulate sending email (AJAX request)
      setTimeout(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;

        // Success simulation
        successMessage.classList.remove("d-none");
        contactForm.reset();
      }, 1500);
    });
  }
});
