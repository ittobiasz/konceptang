import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { User, createDemoUser, DEFAULT_BALANCE } from '../shared/models';

const STORAGE_KEY = 'investiq_user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  
  private readonly _user = signal<User | null>(null);
  private readonly _isLoading = signal(true);

  readonly user = this._user.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user());
  readonly isAdmin = computed(() => this._user()?.role === 'admin');

  constructor() {
    this.loadUser();
  }

  // nacita uzivatela z uloziska
  private loadUser(): void {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          this._user.set(JSON.parse(stored));
        } catch {
          const demoUser = createDemoUser();
          this.saveUser(demoUser);
        }
      } else {
        const demoUser = createDemoUser();
        this.saveUser(demoUser);
      }
    }
    this._isLoading.set(false);
  }

  // ulozi uzivatela do uloziska
  private saveUser(user: User | null): void {
    if (isPlatformBrowser(this.platformId)) {
      if (user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    this._user.set(user);
  }

  // prihlasi uzivatela do systemu
  login(email: string, _password: string): Promise<User> {
    return new Promise((resolve) => {
      setTimeout(() => {
        let user = this._user();
        if (!user) {
          user = createDemoUser();
          user.email = email;
        }
        this.saveUser(user);
        resolve(user);
      }, 500);
    });
  }

  // zaregistruje noveho uzivatela
  register(email: string, displayName: string, _password: string): Promise<User> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const user = createDemoUser();
        user.email = email;
        user.displayName = displayName;
        this.saveUser(user);
        resolve(user);
      }, 500);
    });
  }

  // odhlasi uzivatela zo systemu
  logout(): Promise<void> {
    return new Promise((resolve) => {
      this.saveUser(null);
      resolve();
    });
  }

  // aktualizuje zostatok uzivatela
  updateBalance(newBalance: number): void {
    const user = this._user();
    if (user) {
      const updated = { ...user, paperBalance: newBalance, updatedAt: Date.now() };
      this.saveUser(updated);
    }
  }

  // resetuje zostatok na zaciatok
  resetBalance(): void {
    this.updateBalance(DEFAULT_BALANCE);
  }

  // vrati aktualny zostatok
  getBalance(): number {
    return this._user()?.paperBalance ?? DEFAULT_BALANCE;
  }
}
