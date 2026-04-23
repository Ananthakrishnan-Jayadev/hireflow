/**
 * Renders the topbar HTML string.
 *
 * @param {Object} opts
 * @param {string} opts.title - Main page title (uses Instrument Serif)
 * @param {string} [opts.subtitle] - Optional subtitle shown below the title
 * @param {Array<{label: string, href?: string}>} [opts.breadcrumbs] - Optional breadcrumb trail
 * @param {string} [opts.actions] - HTML string for topbar action buttons (right side)
 */
export function renderTopbar({ title, subtitle, breadcrumbs, actions = '' }) {
  const leftHtml = breadcrumbs && breadcrumbs.length > 0
    ? `
      <div class="topbar-left">
        <h1 class="topbar-title">${title}</h1>
        <nav class="topbar-breadcrumbs" aria-label="Breadcrumb">
          ${breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return isLast
              ? `<span>${crumb.label}</span>`
              : `<a href="${crumb.href || '#'}" class="breadcrumb-link">${crumb.label}</a>
                 <span class="breadcrumb-sep" aria-hidden="true">/</span>`;
          }).join('')}
        </nav>
      </div>
    `
    : `
      <div class="topbar-left">
        <h1 class="topbar-title">${title}</h1>
        ${subtitle ? `<p class="topbar-subtitle">${subtitle}</p>` : ''}
      </div>
    `;

  return `
    <header class="topbar">
      ${leftHtml}
      ${actions ? `<div class="topbar-actions">${actions}</div>` : ''}
    </header>
  `;
}
