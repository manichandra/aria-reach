/**
 * Example component with seeded ARIA anti-patterns — used by the
 * Getting Started walkthrough. Compare with breadcrumb.component.fixed.ts.
 *
 *   npx aria-reach scan examples/breadcrumb.component.ts
 */
import { Component } from '@angular/core';

@Component({
  selector: 'app-breadcrumb',
  template: `
    <nav aria-label="Breadcrumb">
      <ol class="crumbs">
        <li><a href="/">Home</a></li>
        <li><span class="crumb-chevron">›</span></li>
        <li><a href="/reports">Reports</a></li>
      </ol>
    </nav>

    <div aria-live="assertive" class="save-status">{{ saveStatus }}</div>

    <button aria-haspopup="listbox">Year: {{ selectedYear }}</button>
    <ul role="listbox" aria-label="Year">
      <li role="option">2025</li>
      <li role="option">2026</li>
    </ul>
  `,
})
export class BreadcrumbComponent {
  saveStatus = '';
  selectedYear = 2026;
}
