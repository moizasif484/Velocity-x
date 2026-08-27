/* ============================================================
   Velocity X — pricing.js
   Editable Pricing Grid Component
   ============================================================ */

import { $ } from './utils.js';
import { CONFIG } from '../config.js';
import { toast } from './ui.js';

export function renderPricing() {
  const container = $('#pricing-grid');
  if (!container) return;

  const plans = CONFIG.pricing || [];

  container.innerHTML = plans.map(plan => `
    <article class="pricing-card glass ${plan.featured ? 'pricing-card--featured' : ''}">
      ${plan.badge ? `<span class="pricing-badge">${plan.badge}</span>` : ''}
      <div class="pricing-head">
        <h3>${plan.name}</h3>
        <div class="pricing-price">
          <span class="price-val">${plan.pricePKR}</span>
          <small class="price-usd">${plan.priceUSD}</small>
        </div>
      </div>

      <ul class="pricing-features">
        ${plan.features.map(feat => `
          <li>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
            <span>${feat}</span>
          </li>
        `).join('')}
      </ul>

      <button class="btn ${plan.featured ? 'btn--primary' : 'btn--ghost'} btn--block pricing-btn" data-plan-id="${plan.id}" type="button">
        <span>${plan.buttonText}</span>
      </button>
    </article>
  `).join('');

  // Handle plan button selection
  container.querySelectorAll('.pricing-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const planId = btn.dataset.planId;
      const plan = plans.find(p => p.id === planId);
      if (plan) {
        toast(`Selected ${plan.name} Package (${plan.pricePKR}). Scroll down to contact us!`, { type: 'success' });
        const contactSection = $('#contact');
        if (contactSection) {
          contactSection.scrollIntoView({ behavior: 'smooth' });
          const topicSelect = $('#cf-topic');
          if (topicSelect) {
            topicSelect.value = 'Business & licensing';
          }
        }
      }
    });
  });
}

export function initPricing() {
  renderPricing();
}

export default initPricing;
