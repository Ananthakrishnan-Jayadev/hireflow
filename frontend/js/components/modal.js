let activeModal = null;

/**
 * Open a modal.
 *
 * @param {string} title
 * @param {string} bodyHtml
 * @param {Object} [opts]
 * @param {string} [opts.footerHtml] - HTML to render in the footer
 * @param {string} [opts.size] - 'sm' | '' | 'lg'
 * @param {Function} [opts.onClose] - Called when modal closes
 * @returns {HTMLElement} The modal element
 */
export function openModal(title, bodyHtml, opts = {}) {
  closeModal();

  const sizeClass = opts.size === 'lg' ? 'modal-lg' : opts.size === 'sm' ? 'modal-sm' : '';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'modal-title');

  overlay.innerHTML = `
    <div class="modal ${sizeClass}">
      <div class="modal-header">
        <h2 id="modal-title" class="modal-title">${title}</h2>
        <button class="modal-close" aria-label="Close modal">
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="modal-body">
        ${bodyHtml}
      </div>
      ${opts.footerHtml ? `<div class="modal-footer">${opts.footerHtml}</div>` : ''}
    </div>
  `;

  // Close on backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Close button
  overlay.querySelector('.modal-close').addEventListener('click', closeModal);

  // Close on Escape
  const onKeyDown = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', onKeyDown);
  overlay._keyHandler = onKeyDown;

  document.body.appendChild(overlay);
  document.body.classList.add('modal-open');
  activeModal = overlay;
  activeModal._onClose = opts.onClose || null;

  // Init Lucide icons inside the modal
  if (window.lucide) lucide.createIcons({ nodes: [overlay] });

  // Focus first focusable element
  requestAnimationFrame(() => {
    const focusable = overlay.querySelector(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();
  });

  return overlay;
}

/**
 * Close the currently active modal.
 */
export function closeModal() {
  if (!activeModal) return;
  if (activeModal._keyHandler) {
    document.removeEventListener('keydown', activeModal._keyHandler);
  }
  if (activeModal._onClose) activeModal._onClose();
  activeModal.remove();
  activeModal = null;
  document.body.classList.remove('modal-open');
}

/**
 * Show a confirmation modal.
 *
 * @param {string} message
 * @param {Object} [opts]
 * @param {string} [opts.title]
 * @param {string} [opts.confirmLabel]
 * @param {string} [opts.cancelLabel]
 * @param {boolean} [opts.danger]
 * @returns {Promise<boolean>}
 */
export function confirmModal(message, opts = {}) {
  return new Promise((resolve) => {
    const footerHtml = `
      <button class="btn btn-secondary" id="modal-cancel">${opts.cancelLabel || 'Cancel'}</button>
      <button class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm">
        ${opts.confirmLabel || 'Confirm'}
      </button>
    `;

    const modal = openModal(opts.title || 'Confirm', `<p style="font-size:14px;line-height:1.7;color:var(--text-secondary);">${message}</p>`, {
      size: 'sm',
      footerHtml,
      onClose: () => resolve(false),
    });

    modal.querySelector('#modal-cancel')?.addEventListener('click', () => {
      closeModal();
      resolve(false);
    });

    modal.querySelector('#modal-confirm')?.addEventListener('click', () => {
      closeModal();
      resolve(true);
    });
  });
}

/**
 * Get the body element of the active modal (for dynamic content updates).
 */
export function getModalBody() {
  return activeModal?.querySelector('.modal-body') || null;
}
