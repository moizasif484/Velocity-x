/**
 * Velocity X — forms.js
 * ---------------------------------------------------------------------------
 * Declarative form validation + async submission handling.
 *
 * Handles:
 *   - Contact form            [data-form="contact"]
 *   - Test-drive booking      [data-form="booking"]
 *   - Newsletter signup       [data-form="newsletter"]
 *
 * Fields opt in through data attributes:
 *   <input data-validate="required|email" data-label="Email address">
 *   <input data-validate="required|minLength:3">
 *   <input data-validate="match:password">
 * ---------------------------------------------------------------------------
 */

import { $, $$, debounce } from './utils.js';
import { showToast } from './ui.js';

/* -------------------------------------------------------------------------- */
/* Config                                                                      */
/* -------------------------------------------------------------------------- */

const SELECTORS = Object.freeze({
  form: '[data-form]',
  field: '[data-validate]',
  error: '[data-error-for]',
  submit: '[type="submit"]',
  counter: '[data-counter-for]',
});

const CLASSES = Object.freeze({
  invalid: 'is-invalid',
  valid: 'is-valid',
  loading: 'is-loading',
  success: 'is-success',
  field: 'form-field',
  message: 'form-field__error',
});

const PATTERNS = Object.freeze({
  email: /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i,
  phone: /^[+]?[\d\s()-]{7,18}$/,
  name: /^[\p{L}\s'.-]{2,}$/u,
});

const ENDPOINT = Object.freeze({
  contact: '/api/contact',
  booking: '/api/booking',
  newsletter: '/api/newsletter',
});

const SUCCESS_MESSAGE = Object.freeze({
  contact: 'Message sent — our team will reply within 24 hours.',
  booking: 'Test drive requested. We will confirm your slot shortly.',
  newsletter: 'You are on the list. Welcome to Velocity X.',
});

/* -------------------------------------------------------------------------- */
/* Validators                                                                  */
/* -------------------------------------------------------------------------- */

const validators = {
  required: (value, _arg, label) =>
    value.trim().length > 0 || `${label} is required.`,

  email: (value, _arg, label) =>
    !value || PATTERNS.email.test(value.trim()) || `Enter a valid ${label.toLowerCase()}.`,

  phone: (value) =>
    !value || PATTERNS.phone.test(value.trim()) || 'Enter a valid phone number.',

  name: (value, _arg, label) =>
    !value || PATTERNS.name.test(value.trim()) || `${label} looks incomplete.`,

  minLength: (value, arg, label) =>
    !value || value.trim().length >= Number(arg) || `${label} needs at least ${arg} characters.`,

  maxLength: (value, arg, label) =>
    value.trim().length <= Number(arg) || `${label} cannot exceed ${arg} characters.`,

  number: (value, _arg, label) =>
    !value || !Number.isNaN(Number(value)) || `${label} must be a number.`,

  min: (value, arg, label) =>
    !value || Number(value) >= Number(arg) || `${label} must be ${arg} or more.`,

  max: (value, arg, label) =>
    !value || Number(value) <= Number(arg) || `${label} must be ${arg} or less.`,

  futureDate: (value, _arg, label) => {
    if (!value) return true;
    const today = new Date().setHours(0, 0, 0, 0);
    return new Date(value).getTime() >= today || `${label} must be today or later.`;
  },

  checked: (_value, _arg, label, field) =>
    field.checked || `Please accept the ${label.toLowerCase()}.`,

  match: (value, arg, label, field) => {
    const other = field.form?.elements[arg];
    return !other || value === other.value || `${label} does not match.`;
  },
};

/* -------------------------------------------------------------------------- */
/* Field level helpers                                                         */
/* -------------------------------------------------------------------------- */

/**
 * @param {HTMLElement} field
 * @returns {string}
 */
function labelFor(field) {
  if (field.dataset.label) return field.dataset.label;
  const label = field.form ? $(`label[for="${field.id}"]`, field.form) : null;
  return (label?.textContent || field.name || 'This field').replace('*', '').trim();
}

/**
 * @param {HTMLElement} field
 * @returns {HTMLElement|null}
 */
function errorHostFor(field) {
  const existing =
    (field.form && $(`[data-error-for="${field.name}"]`, field.form)) || null;
  if (existing) return existing;

  const wrapper = field.closest(`.${CLASSES.field}`);
  if (!wrapper) return null;

  const created = document.createElement('span');
  created.className = CLASSES.message;
  created.dataset.errorFor = field.name;
  created.setAttribute('role', 'alert');
  wrapper.appendChild(created);
  return created;
}

/**
 * Runs the `data-validate` rule chain on a single field.
 * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} field
 * @returns {string} empty string when the field is valid
 */
export function validateField(field) {
  const rules = (field.dataset.validate || '').split('|').filter(Boolean);
  const label = labelFor(field);
  const value = field.type === 'checkbox' ? String(field.checked) : field.value;

  for (const rule of rules) {
    const [name, arg] = rule.split(':');
    const validator = validators[name];
    if (!validator) continue;

    const result = validator(value, arg, label, field);
    if (result !== true) return typeof result === 'string' ? result : `${label} is invalid.`;
  }

  return '';
}

/**
 * @param {HTMLElement} field
 * @param {string} message
 */
function renderFieldState(field, message) {
  const wrapper = field.closest(`.${CLASSES.field}`) || field;
  const host = errorHostFor(field);
  const invalid = Boolean(message);

  wrapper.classList.toggle(CLASSES.invalid, invalid);
  wrapper.classList.toggle(CLASSES.valid, !invalid && field.value.trim() !== '');
  field.setAttribute('aria-invalid', invalid ? 'true' : 'false');

  if (host) {
    host.textContent = message;
    host.hidden = !invalid;
    if (invalid) field.setAttribute('aria-describedby', host.id || (host.id = `err-${field.name}`));
  }
}

/**
 * @param {HTMLFormElement} form
 * @returns {{ valid: boolean, errors: Record<string,string> }}
 */
export function validateForm(form) {
  const errors = {};


  $$(SELECTORS.field, form).forEach((field) => {
    const message = validateField(field);
    renderFieldState(field, message);
    if (message) errors[field.name] = message;
  });

  return { valid: Object.keys(errors).length === 0, errors };
}

/* -------------------------------------------------------------------------- */
/* Submission                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * @param {HTMLFormElement} form
 * @returns {Record<string, FormDataEntryValue|FormDataEntryValue[]>}
 */
export function serializeForm(form) {
  const data = {};

  new FormData(form).forEach((value, key) => {
    if (key in data) {
      data[key] = Array.isArray(data[key]) ? [...data[key], value] : [data[key], value];
    } else {
      data[key] = value;
    }
  });

  return data;
}

/**
 * Simulated transport. Swap the body of this function for a real `fetch`
 * once the Velocity X backend endpoints go live.
 *
 * @param {string} endpoint
 * @param {object} payload
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
async function send(endpoint, payload) {
  if (!endpoint) return { ok: true };

  await new Promise((resolve) => setTimeout(resolve, 900));

  // eslint-disable-next-line no-console
  console.info('[VelocityX] form payload →', endpoint, payload);
  return { ok: true };
}

/**
 * @param {HTMLButtonElement|null} button
 * @param {boolean} loading
 */
function setButtonState(button, loading) {
  if (!button) return;
  button.disabled = loading;
  button.classList.toggle(CLASSES.loading, loading);
  button.setAttribute('aria-busy', loading ? 'true' : 'false');

  if (loading) {
    button.dataset.originalLabel ??= button.textContent.trim();
    button.textContent = button.dataset.loadingLabel || 'Sending…';
  } else if (button.dataset.originalLabel) {
    button.textContent = button.dataset.originalLabel;
  }
}

/* -------------------------------------------------------------------------- */
/* Controller                                                                  */
/* -------------------------------------------------------------------------- */

class FormController {
  /**
   * @param {HTMLFormElement} form
   * @param {{ onSuccess?: Function, onError?: Function }} [hooks]
   */
  constructor(form, hooks = {}) {
    this.form = form;
    this.type = form.dataset.form;
    this.hooks = hooks;
    this.submitBtn = $(SELECTORS.submit, form);
    this.fields = $$(SELECTORS.field, form);
    this.submitted = false;

    this.form.setAttribute('novalidate', '');
    this.bindEvents();
    this.bindCounters();
  }

  bindEvents() {
    this.form.addEventListener('submit', this.handleSubmit.bind(this));

    const liveValidate = debounce((field) => {
      if (!this.submitted && !field.dataset.touched) return;
      renderFieldState(field, validateField(field));
    }, 220);

    this.fields.forEach((field) => {
      field.addEventListener('blur', () => {
        field.dataset.touched = 'true';
        renderFieldState(field, validateField(field));
      });

      field.addEventListener('input', () => liveValidate(field));
      field.addEventListener('change', () => {
        field.dataset.touched = 'true';
        renderFieldState(field, validateField(field));
      });
    });
  }

  bindCounters() {

    $$(SELECTORS.counter, this.form).forEach((counter) => {
      const field = this.form.elements[counter.dataset.counterFor];
      if (!field) return;

      const max = field.dataset.validate?.match(/maxLength:(\d+)/)?.[1] || field.maxLength;
      const paint = () => {
        counter.textContent = max > 0 ? `${field.value.length}/${max}` : `${field.value.length}`;
      };

      field.addEventListener('input', paint);
      paint();
    });
  }

  /** @param {SubmitEvent} event */
  async handleSubmit(event) {
    event.preventDefault();
    this.submitted = true;

    // Honeypot — silently accept and discard bot submissions.
    if (this.form.elements.website?.value) return;

    const { valid, errors } = validateForm(this.form);

    if (!valid) {
      const firstKey = Object.keys(errors)[0];
      const firstField = this.form.elements[firstKey];
      firstField?.focus({ preventScroll: true });
      firstField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast?.('Please fix the highlighted fields.', 'error');
      return;
    }

    const payload = serializeForm(this.form);
    setButtonState(this.submitBtn, true);

    try {
      const response = await send(ENDPOINT[this.type], payload);
      if (!response.ok) throw new Error(response.message || 'Request failed.');

      this.form.classList.add(CLASSES.success);
      this.form.reset();
      this.resetFieldStates();

      showToast?.(SUCCESS_MESSAGE[this.type] || 'Sent successfully.', 'success');
      this.hooks.onSuccess?.(payload, this.form);
      this.form.dispatchEvent(
        new CustomEvent('form:success', { detail: { type: this.type, payload }, bubbles: true })
      );
    } catch (error) {
      showToast?.('Something went wrong. Please try again.', 'error');
      this.hooks.onError?.(error, this.form);
      // eslint-disable-next-line no-console
      console.error('[VelocityX] form error →', error);
    } finally {
      setButtonState(this.submitBtn, false);
      this.submitted = false;
      window.setTimeout(() => this.form.classList.remove(CLASSES.success), 2400);
    }
  }

  resetFieldStates() {
    this.fields.forEach((field) => {
      delete field.dataset.touched;
      renderFieldState(field, '');
      field.closest(`.${CLASSES.field}`)?.classList.remove(CLASSES.valid);
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

const controllers = new Map();

/**
 * Boots every `[data-form]` inside the given scope.
 * @param {ParentNode} [scope=document]
 * @param {object} [hooks]
 * @returns {FormController[]}
 */
export function initForms(scope = document, hooks = {}) {
  return $$(SELECTORS.form, scope).map((form) => {
    if (controllers.has(form)) return controllers.get(form);
    const controller = new FormController(form, hooks);
    controllers.set(form, controller);
    return controller;
  });
}

/**
 * Fills every `[data-car-select]` dropdown from the car catalogue,
 * so the booking form always mirrors cars.js data.
 *
 * @param {Array<{ id: string|number, name: string }>} cars
 * @param {ParentNode} [scope=document]
 */
export function populateCarOptions(cars = [], scope = document) {

  $$('[data-car-select]', scope).forEach((select) => {
    const placeholder = select.querySelector('option[value=""]')?.outerHTML || '';
    select.innerHTML =
      placeholder +
      cars
        .map((car) => `<option value="${car.id}">${car.name}</option>`)
        .join('');
  });
}

/**
 * Pre-selects a car in the booking form and scrolls to it —
 * used by the "Book a test drive" buttons rendered in cars.js.
 *
 * @param {string|number} carId
 */
export function prefillBooking(carId) {
  const form = $('[data-form="booking"]');
  if (!form) return;

  const select = $('[data-car-select]', form);
  if (select) select.value = String(carId);

  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => $('input, select', form)?.focus({ preventScroll: true }), 600);
}

export { validators, PATTERNS };
export default initForms;
