/**
 * Velocity X — Contact Module
 * Client-side validation and async submission for the contact form.
 */

const SELECTORS = {
  form: '.contact__form',
  field: '[data-field]',
  status: '.contact__status',
  submit: '[type="submit"]'
};

const CLASSES = {
  invalid: 'is-invalid',
  success: 'is-success',
  error: 'is-error',
  loading: 'is-loading'
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Validates one field and returns an error message, or an empty string.
 * @param {HTMLElement} field
 * @returns {string}
 */
function validateField(field) {
  const value = field.value.trim();
  const type = field.dataset.field;
  const required = field.hasAttribute('required');

  if (required && !value) return 'This field is required.';
  if (!value) return '';

  if (type === 'email' && !EMAIL_PATTERN.test(value)) {
    return 'Please enter a valid email address.';
  }
  if (type === 'name' && value.length < 2) {
    return 'Please enter your full name.';
  }
  if (type === 'message' && value.length < 10) {
    return 'Your message should be at least 10 characters.';
  }

  return '';
}

/**
 * Shows or clears the error state for a field.
 * @param {HTMLElement} field
 * @param {string} message
 */
function setFieldError(field, message) {
  const wrapper = field.closest('.form__group') || field.parentElement;
  if (!wrapper) return;

  let errorEl = wrapper.querySelector('.form__error');

  if (message) {
    if (!errorEl) {
      errorEl = document.createElement('span');
      errorEl.className = 'form__error';
      wrapper.appendChild(errorEl);
    }
    errorEl.textContent = message;
    field.classList.add(CLASSES.invalid);
    field.setAttribute('aria-invalid', 'true');
  } else {
    if (errorEl) errorEl.textContent = '';
    field.classList.remove(CLASSES.invalid);
    field.removeAttribute('aria-invalid');
  }
}

/**
 * Validates every field in the form.
 * @param {HTMLFormElement} form
 * @returns {boolean}
 */
function validateForm(form) {
  const fields = Array.from(form.querySelectorAll(SELECTORS.field));
  let firstInvalid = null;

  fields.forEach((field) => {
    const message = validateField(field);
    setFieldError(field, message);
    if (message && !firstInvalid) firstInvalid = field;
  });

  if (firstInvalid) {
    firstInvalid.focus();
    return false;
  }
  return true;
}

/**
 * Writes a status message below the form.
 * @param {HTMLElement} form
 * @param {string} message
 * @param {string} type
 */
function setStatus(form, message, type) {
  const status = form.querySelector(SELECTORS.status);
  if (!status) return;

  status.textContent = message;
  status.classList.remove(CLASSES.success, CLASSES.error);
  if (type) status.classList.add(type === 'success' ? CLASSES.success : CLASSES.error);
}

/**
 * Sends the payload. Falls back to a resolved promise when no
 * endpoint is configured, so the UI still behaves correctly in dev.
 * @param {HTMLFormElement} form
 * @returns {Promise<void>}
 */
async function sendForm(form) {
  const endpoint = form.getAttribute('action');
  if (!endpoint) {
    return new Promise((resolve) => setTimeout(resolve, 600));
  }

  const response = await fetch(endpoint, {
    method: form.getAttribute('method') || 'POST',
    headers: { Accept: 'application/json' },
    body: new FormData(form)
  });

  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
}

export function initContact() {
  const form = document.querySelector(SELECTORS.form);
  if (!form) return;

  // Let the module own validation instead of the browser's default bubbles.
  form.setAttribute('novalidate', '');

  form.querySelectorAll(SELECTORS.field).forEach((field) => {
    field.addEventListener('blur', () => setFieldError(field, validateField(field)));
    field.addEventListener('input', () => {
      if (field.classList.contains(CLASSES.invalid)) setFieldError(field, '');
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus(form, '', '');

    if (!validateForm(form)) {
      setStatus(form, 'Please fix the highlighted fields.', 'error');
      return;
    }

    const submitBtn = form.querySelector(SELECTORS.submit);
    form.classList.add(CLASSES.loading);
    if (submitBtn) submitBtn.disabled = true;

    try {
      await sendForm(form);
      form.reset();
      setStatus(form, 'Thanks — your message is on its way.', 'success');
    } catch (error) {
      console.error('[contact] Submission failed:', error);
      setStatus(form, 'Something went wrong. Please try again.', 'error');
    } finally {
      form.classList.remove(CLASSES.loading);
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

export default initContact;
