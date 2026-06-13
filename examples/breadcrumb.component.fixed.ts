/**
 * The remediated version of breadcrumb.component.ts — every finding fixed.
 *
 *   npx aria-reach scan examples/breadcrumb.component.fixed.ts   # → clean
 */
import { Component } from '@angular/core';

@Component({
  selector: 'app-breadcrumb',
  template: `
    <nav aria-label="Breadcrumb">
      <ol class="crumbs">
        <li><a href="/">Home</a></li>
        <li><span class="crumb-chevron" aria-hidden="true">›</span></li>
        <li><a href="/reports">Reports</a></li>
      </ol>
    </nav>

    <div aria-live="polite" class="save-status">{{ saveStatus }}</div>

    <button aria-haspopup="listbox" [attr.aria-expanded]="yearListOpen">Year: {{ selectedYear }}</button>
    <ul role="listbox" aria-label="Year">
      <li role="option" [attr.aria-selected]="selectedYear === 2025">2025</li>
      <li role="option" [attr.aria-selected]="selectedYear === 2026">2026</li>
    </ul>
  `,
})
export class BreadcrumbComponent {
  saveStatus = '';
  selectedYear = 2026;
  yearListOpen = false;
}
