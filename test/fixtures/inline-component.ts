import { Component } from '@angular/core';

@Component({
  selector: 'app-status-banner',
  template: `
    <div class="banner">
      <div aria-live="assertive">{{ statusMessage }}</div>
      <span class="chevron">›</span>
    </div>
  `,
})
export class StatusBannerComponent {
  statusMessage = '';
}
