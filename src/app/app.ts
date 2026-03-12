import { Component, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { HeaderComponent } from './shared/components/header.component';
import { computed } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent],
  template: `
    @if (!isAuthPage()) {
      <app-header />
    }
    <main class="main-content">
      <router-outlet />
    </main>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
    }

    .main-content {
      flex: 1;
      background: var(--bg-dark, #0a0a0a);
      background: linear-gradient(180deg, rgba(10, 10, 10, 0.95) 0%, rgba(15, 15, 25, 0.97) 100%);
    }
  `]
})
export class App {
  private readonly router = inject(Router);
  
  readonly isAuthPage = computed(() => {
    const url = this.router.url;
    return url.includes('/login') || url.includes('/register');
  });

  title = 'InvestIQ';
}
