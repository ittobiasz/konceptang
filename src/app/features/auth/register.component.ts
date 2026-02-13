import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <h1>Registrácia</h1>
          <p>Vytvorte si bezplatný účet</p>
        </div>

        <form (ngSubmit)="onSubmit()" class="auth-form">
          <div class="form-group">
            <label for="name">Meno</label>
            <input 
              type="text" 
              id="name" 
              [(ngModel)]="displayName" 
              name="name"
              placeholder="Vaše meno"
              required>
          </div>

          <div class="form-group">
            <label for="email">Email</label>
            <input 
              type="email" 
              id="email" 
              [(ngModel)]="email" 
              name="email"
              placeholder="vas@email.com"
              required>
          </div>

          <div class="form-group">
            <label for="password">Heslo</label>
            <input 
              type="password" 
              id="password" 
              [(ngModel)]="password" 
              name="password"
              placeholder="••••••••"
              required>
          </div>

          @if (error()) {
            <div class="error-message">{{ error() }}</div>
          }

          <button type="submit" class="submit-btn" [disabled]="isLoading()">
            @if (isLoading()) {
              <span class="spinner"></span>
              Registrujem...
            } @else {
              Vytvoriť účet
            }
          </button>
        </form>

        <div class="auth-footer">
          <p>Máte už účet? <a routerLink="/login">Prihláste sa</a></p>
        </div>

        <div class="bonus-notice">
          <span>🎁</span>
          <span>Získate $100,000 virtuálnych prostriedkov na obchodovanie!</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      background: #0a0a0a;
    }

    .auth-card {
      width: 100%;
      max-width: 400px;
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 1rem;
      padding: 2rem;
    }

    .auth-header {
      text-align: center;
      margin-bottom: 2rem;

      h1 {
        margin: 0;
        font-size: 1.75rem;
        color: #fff;
      }

      p {
        margin: 0.5rem 0 0;
        color: #9ca3af;
      }
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;

      label {
        font-size: 0.875rem;
        color: #9ca3af;
      }

      input {
        padding: 0.75rem 1rem;
        background: #0a0a0a;
        border: 1px solid #2a2a2a;
        border-radius: 0.5rem;
        color: #fff;
        font-size: 1rem;

        &::placeholder {
          color: #6b7280;
        }

        &:focus {
          outline: none;
          border-color: #10b981;
        }
      }
    }

    .error-message {
      padding: 0.75rem;
      background: rgba(#ef4444, 0.1);
      border: 1px solid rgba(#ef4444, 0.3);
      border-radius: 0.5rem;
      color: #ef4444;
      font-size: 0.875rem;
    }

    .submit-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.875rem;
      background: #10b981;
      border: none;
      border-radius: 0.5rem;
      color: #000;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;

      &:hover:not(:disabled) {
        background: #059669;
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .spinner {
        width: 18px;
        height: 18px;
        border: 2px solid transparent;
        border-top-color: currentColor;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .auth-footer {
      text-align: center;
      margin-top: 1.5rem;
      color: #9ca3af;

      a {
        color: #10b981;
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }
    }

    .bonus-notice {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 1.5rem;
      padding: 0.75rem;
      background: rgba(#f59e0b, 0.1);
      border: 1px solid rgba(#f59e0b, 0.2);
      border-radius: 0.5rem;
      font-size: 0.8125rem;
      color: #f59e0b;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  displayName = '';
  email = '';
  password = '';
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  // zaregistruje noveho pouzivatela
  async onSubmit(): Promise<void> {
    if (!this.displayName || !this.email || !this.password) {
      this.error.set('Vyplňte všetky polia');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      await this.authService.register(this.email, this.displayName, this.password);
      this.router.navigate(['/portfolio']);
    } catch (err) {
      this.error.set('Registrácia zlyhala');
    } finally {
      this.isLoading.set(false);
    }
  }
}
