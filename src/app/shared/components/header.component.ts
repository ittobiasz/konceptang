import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService, ThemeService, CurrencyService, Currency } from '../../core';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <header class="header">
      <div class="header-content">
        <a routerLink="/" class="logo">
          <span class="logo-icon"></span>
          <span class="logo-text">InvestIQ</span>
        </a>

        <nav class="nav" [class.open]="isMenuOpen">
          <a routerLink="/assets" routerLinkActive="active" class="nav-link">
            <span></span> Trhy
          </a>
          <a routerLink="/portfolio" routerLinkActive="active" class="nav-link">
            <span></span> Portfólio
          </a>
          <a routerLink="/ai-advisor" routerLinkActive="active" class="nav-link">
            <span></span> AI Poradca
          </a>
          <a routerLink="/leaderboard" routerLinkActive="active" class="nav-link">
            <span></span> Leaderboard
          </a>
          <a routerLink="/alerts" routerLinkActive="active" class="nav-link">
            <span></span> Alerty
          </a>
          <a routerLink="/news" routerLinkActive="active" class="nav-link">
            <span></span> Správy
          </a>
        </nav>

        <div class="header-actions">
          <!-- Currency Selector -->
          <select 
            class="currency-select"
            [value]="currencyService.currency()"
            (change)="onCurrencyChange($event)">
            @for (cur of currencies; track cur) {
              <option [value]="cur">{{ cur }}</option>
            }
          </select>

          <!-- Balance -->
          <div class="balance">
            <span class="balance-label">Zostatok</span>
            <span class="balance-value">{{ currencyService.format(authService.getBalance()) }}</span>
          </div>

          <!-- User Menu -->
          <div class="user-menu">
            <button class="user-btn" (click)="toggleUserMenu()">
              <span class="user-avatar">👤</span>
              <span class="user-name">{{ authService.user()?.displayName || 'Demo' }}</span>
            </button>
            @if (isUserMenuOpen) {
              <div class="user-dropdown">
                <button (click)="resetBalance()">
                  <span></span> Reset zostatku
                </button>
                <button (click)="logout()" class="logout-btn">
                  <span></span> Odhlásiť sa
                </button>
              </div>
            }
          </div>

          <!-- Mobile Menu Toggle -->
          <button class="menu-toggle" (click)="toggleMenu()">
            {{ isMenuOpen ? '✕' : '☰' }}
          </button>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--bg-elevated);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border-color);
      transition: background-color 0.3s ease, border-color 0.3s ease;
    }

    .header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      max-width: 1400px;
      margin: 0 auto;
      padding: 0.75rem 1.5rem;
      gap: 1.5rem;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
      font-weight: 800;
      font-size: 1.25rem;
      color: var(--text-primary);
      transition: color 0.2s;

      &:hover {
        color: var(--primary);
      }

      .logo-icon {
        font-size: 1.5rem;
      }
    }

    .nav {
      display: flex;
      align-items: center;
      gap: 0.25rem;

      @media (max-width: 768px) {
        display: none;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        flex-direction: column;
        background: var(--bg-card);
        padding: 1rem;
        border-bottom: 1px solid var(--border-color);
        box-shadow: var(--shadow-lg);

        &.open {
          display: flex;
        }
      }
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1rem;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.9375rem;
      font-weight: 500;
      border-radius: 0.5rem;
      transition: all 0.2s;

      &:hover {
        color: var(--text-primary);
        background: var(--bg-card-hover);
      }

      &.active {
        color: var(--primary);
        background: var(--primary-glow);
      }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .currency-select {
      padding: 0.5rem 0.75rem;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      color: var(--text-primary);
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        border-color: var(--border-hover);
      }

      &:focus {
        border-color: var(--primary);
        box-shadow: 0 0 0 3px var(--primary-glow);
      }
    }

    .icon-btn {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      cursor: pointer;
      font-size: 1.125rem;
      transition: all 0.2s;

      &:hover {
        background: var(--bg-card-hover);
        border-color: var(--border-hover);
        transform: scale(1.05);
      }
    }

    .balance {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      padding: 0.375rem 0.75rem;
      background: var(--primary-glow);
      border-radius: 0.5rem;

      @media (max-width: 640px) {
        display: none;
      }

      .balance-label {
        font-size: 0.6875rem;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .balance-value {
        font-size: 1rem;
        font-weight: 700;
        color: var(--primary);
        font-family: var(--font-mono);
      }
    }

    .user-menu {
      position: relative;
    }

    .user-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      color: var(--text-primary);
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        border-color: var(--border-hover);
        background: var(--bg-card-hover);
      }

      .user-avatar {
        font-size: 1.25rem;
      }

      .user-name {
        font-weight: 500;
        @media (max-width: 640px) {
          display: none;
        }
      }
    }

    .user-dropdown {
      position: absolute;
      top: calc(100% + 0.5rem);
      right: 0;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 0.75rem;
      overflow: hidden;
      min-width: 180px;
      box-shadow: var(--shadow-lg);
      animation: slideDown 0.2s ease;

      button {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        width: 100%;
        padding: 0.875rem 1rem;
        background: transparent;
        border: none;
        color: var(--text-primary);
        cursor: pointer;
        text-align: left;
        font-size: 0.9375rem;
        transition: background 0.15s;

        &:hover {
          background: var(--bg-card-hover);
        }

        &.logout-btn {
          color: #ef4444;
          border-top: 1px solid var(--border-color);

          &:hover {
            background: rgba(239, 68, 68, 0.1);
          }
        }
      }
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .btn {
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.2s;

      &-primary {
        background: var(--primary);
        color: #000;

        &:hover {
          background: var(--primary-hover);
        }
      }

      &-secondary {
        background: transparent;
        color: var(--text-primary);
        border: 1px solid var(--border-color);

        &:hover {
          background: var(--bg-card);
        }
      }

      @media (max-width: 640px) {
        display: none;
      }
    }

    .menu-toggle {
      display: none;
      width: 40px;
      height: 40px;
      align-items: center;
      justify-content: center;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      color: var(--text-primary);
      font-size: 1.25rem;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: var(--bg-card-hover);
      }

      @media (max-width: 768px) {
        display: flex;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly currencyService = inject(CurrencyService);
  private readonly router = inject(Router);

  isMenuOpen = false;
  isUserMenuOpen = false;
  currencies: Currency[] = ['USD', 'EUR', 'CZK', 'GBP'];

  // prepne mobilne menu
  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  // prepne uzivatelske menu
  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  // prepne temu aplikacie
  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  // zmeni aktivnu menu
  onCurrencyChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.currencyService.setCurrency(select.value as Currency);
  }

  // resetuje zostatok pouzivatela
  resetBalance(): void {
    this.authService.resetBalance();
    this.isUserMenuOpen = false;
  }

  // odhlasi pouzivatela
  async logout(): Promise<void> {
    await this.authService.logout();
    this.isUserMenuOpen = false;
    this.router.navigate(['/login']);
  }
}
