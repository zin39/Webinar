// ===== Countdown Timer =====
function initCountdown() {
  const countdownEl = document.getElementById('countdown');
  if (!countdownEl) return;

  const targetDate = new Date(countdownEl.dataset.date).getTime();

  const daysEl = document.getElementById('days');
  const hoursEl = document.getElementById('hours');
  const minutesEl = document.getElementById('minutes');
  const secondsEl = document.getElementById('seconds');

  function updateCountdown() {
    const now = new Date().getTime();
    const distance = targetDate - now;

    if (distance < 0) {
      daysEl.textContent = '00';
      hoursEl.textContent = '00';
      minutesEl.textContent = '00';
      secondsEl.textContent = '00';
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    daysEl.textContent = String(days).padStart(2, '0');
    hoursEl.textContent = String(hours).padStart(2, '0');
    minutesEl.textContent = String(minutes).padStart(2, '0');
    secondsEl.textContent = String(seconds).padStart(2, '0');
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);
}

// ===== FAQ Accordion =====
function initFAQ() {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');

    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      // Close all other items
      faqItems.forEach(otherItem => {
        otherItem.classList.remove('active');
      });

      // Toggle current item
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });
}

// ===== Mobile Navigation =====
function initMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (!toggle || !navLinks) return;

  toggle.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    toggle.classList.toggle('active');
  });

  // Close menu when clicking on a link
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('active');
      toggle.classList.remove('active');
    });
  });
}

// ===== Live Attendee Count =====
function initLiveCount() {
  const countEl = document.getElementById('attendee-count');
  if (!countEl) return;

  // Update every 30 seconds
  setInterval(async () => {
    try {
      const response = await fetch('/api/attendee-count');
      const data = await response.json();
      countEl.textContent = data.count;
    } catch (error) {
      console.error('Failed to fetch attendee count:', error);
    }
  }, 30000);
}

// ===== Smooth Scroll =====
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        const navHeight = document.querySelector('.nav')?.offsetHeight || 0;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

// ===== Alert Auto-dismiss =====
function initAlerts() {
  const alerts = document.querySelectorAll('.alert');

  alerts.forEach(alert => {
    setTimeout(() => {
      alert.style.opacity = '0';
      alert.style.transform = 'translateY(-10px)';
      setTimeout(() => alert.remove(), 300);
    }, 5000);
  });
}

// ===== Form Validation Enhancement =====
function initFormValidation() {
  const forms = document.querySelectorAll('form');

  // Helper functions for showing/hiding errors
  function showError(input, errorId, message) {
    input.classList.add('error');
    input.classList.remove('valid');
    const errorEl = document.getElementById(errorId);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('visible');
    }
    const formGroup = input.closest('.form-group');
    if (formGroup) formGroup.classList.add('has-error');
  }

  function clearError(input, errorId) {
    input.classList.remove('error');
    const errorEl = document.getElementById(errorId);
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('visible');
    }
    const formGroup = input.closest('.form-group');
    if (formGroup) formGroup.classList.remove('has-error');
  }

  function markValid(input) {
    input.classList.remove('error');
    input.classList.add('valid');
    const formGroup = input.closest('.form-group');
    if (formGroup) formGroup.classList.remove('has-error');
  }

  forms.forEach(form => {
    // Email validation
    const emailInput = form.querySelector('#email');
    if (emailInput) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      emailInput.addEventListener('input', () => {
        clearError(emailInput, 'email-error');
      });

      emailInput.addEventListener('blur', () => {
        const value = emailInput.value.trim();
        if (!value) {
          showError(emailInput, 'email-error', 'Email address is required');
        } else if (!emailPattern.test(value)) {
          showError(emailInput, 'email-error', 'Please enter a valid email address (e.g., name@example.com)');
        } else {
          clearError(emailInput, 'email-error');
          markValid(emailInput);
        }
      });
    }

    // Name validation
    const nameInput = form.querySelector('#name');
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        clearError(nameInput, 'name-error');
      });

      nameInput.addEventListener('blur', () => {
        const value = nameInput.value.trim();
        if (!value) {
          showError(nameInput, 'name-error', 'Full name is required');
        } else if (value.length < 2) {
          showError(nameInput, 'name-error', 'Please enter your full name (at least 2 characters)');
        } else {
          clearError(nameInput, 'name-error');
          markValid(nameInput);
        }
      });
    }

    // Phone number validation
    const phoneInput = form.querySelector('#phone');
    if (phoneInput) {
      phoneInput.addEventListener('input', (e) => {
        // Only allow digits
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
        clearError(phoneInput, 'phone-error');

        // Real-time validation feedback
        const value = e.target.value;
        if (value.length > 0 && value.length < 6) {
          showError(phoneInput, 'phone-error', 'Phone number must be at least 6 digits');
        } else if (value.length > 15) {
          e.target.value = value.slice(0, 15);
          showError(phoneInput, 'phone-error', 'Phone number cannot exceed 15 digits');
        } else if (value.length >= 6) {
          clearError(phoneInput, 'phone-error');
          markValid(phoneInput);
        }
      });

      phoneInput.addEventListener('blur', () => {
        const value = phoneInput.value.trim();
        if (value && value.length < 6) {
          showError(phoneInput, 'phone-error', 'Phone number must be at least 6 digits');
        } else if (value.length >= 6) {
          clearError(phoneInput, 'phone-error');
          markValid(phoneInput);
        }
      });

      // Prevent non-numeric paste
      phoneInput.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        const cleanedText = pastedText.replace(/[^0-9]/g, '').slice(0, 15);
        e.target.value = cleanedText;

        if (cleanedText.length > 0 && cleanedText.length < 6) {
          showError(phoneInput, 'phone-error', 'Phone number must be at least 6 digits');
        } else if (cleanedText.length >= 6) {
          clearError(phoneInput, 'phone-error');
          markValid(phoneInput);
        }
      });
    }

    // Form submission validation
    form.addEventListener('submit', (e) => {
      let hasError = false;

      // Validate name
      if (nameInput) {
        const nameValue = nameInput.value.trim();
        if (!nameValue) {
          showError(nameInput, 'name-error', 'Full name is required');
          hasError = true;
        } else if (nameValue.length < 2) {
          showError(nameInput, 'name-error', 'Please enter your full name (at least 2 characters)');
          hasError = true;
        }
      }

      // Validate email
      if (emailInput) {
        const emailValue = emailInput.value.trim();
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailValue) {
          showError(emailInput, 'email-error', 'Email address is required');
          hasError = true;
        } else if (!emailPattern.test(emailValue)) {
          showError(emailInput, 'email-error', 'Please enter a valid email address (e.g., name@example.com)');
          hasError = true;
        }
      }

      // Validate phone if filled
      if (phoneInput && phoneInput.value) {
        const phoneValue = phoneInput.value.trim();
        if (phoneValue.length > 0 && phoneValue.length < 6) {
          showError(phoneInput, 'phone-error', 'Phone number must be at least 6 digits');
          hasError = true;
        }
      }

      if (hasError) {
        e.preventDefault();
        // Scroll to first error
        const firstError = form.querySelector('.field-error.visible');
        if (firstError) {
          const input = firstError.previousElementSibling;
          if (input && input.tagName === 'INPUT') {
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            input.focus();
          } else {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    });
  });
}

// ===== Initialize All =====
document.addEventListener('DOMContentLoaded', () => {
  initCountdown();
  initFAQ();
  initMobileNav();
  initLiveCount();
  initSmoothScroll();
  initAlerts();
  initFormValidation();
});
