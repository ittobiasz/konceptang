import { Injectable, signal, computed, inject, PLATFORM_ID, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { User, createDemoUser, DEFAULT_BALANCE } from '../shared/models';
import { FirebaseService, UserProfile } from './firebase.service';

const STORAGE_KEY = 'investiq_user';
const DEMO_EMAIL = 'demo@demo.com';
const DEMO_PASSWORD = 'demo';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly firebaseService = inject(FirebaseService);
  
  private readonly _user = signal<User | null>(null);
  private readonly _isLoading = signal(true);

  readonly user = this._user.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user());
  readonly isAdmin = computed(() => this._user()?.role === 'admin');

  constructor() {
    this.initializeAuth();
  }

  // inicijalizuje autentifikaciu
  private initializeAuth(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Sleduj Firebase auth state cez effect
      effect(() => {
        const firebaseUser = this.firebaseService.currentUser();
        if (firebaseUser) {
          // User is logged in via Firebase
          const profile = this.firebaseService.userProfile();
          if (profile) {
            this._user.set(this.convertProfileToUser(profile));
            this.saveUser(this._user());
          }
        } else {
          // User is logged out - check localStorage
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            try {
              this._user.set(JSON.parse(stored));
            } catch {
              this._user.set(null);
            }
          } else {
            this._user.set(null);
          }
        }
        this._isLoading.set(false);
      });
    } else {
      this._isLoading.set(false);
    }
  }

  // prihlasi uzivatela do systemu
  async login(email: string, password: string): Promise<User> {
    // Special handling for demo user
    if (email.toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
      return this.loginDemo();
    }

    // Real Firebase login
    const result = await this.firebaseService.login(email, password);
    if (!result.success) {
      throw new Error(result.message);
    }

    // Load profile from Firebase
    const profile = this.firebaseService.userProfile();
    if (!profile) {
      throw new Error('Failed to load user profile');
    }

    const user = this.convertProfileToUser(profile);
    this.saveUser(user);
    return user;
  }

  // prihlasi demo uzivatela
  private loginDemo(): User {
    const demoUser: User = {
      uid: 'demo',
      email: DEMO_EMAIL,
      displayName: 'Demo User',
      role: 'user',
      paperBalance: DEFAULT_BALANCE,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.saveUser(demoUser);
    return demoUser;
  }

  // zaregistruje noveho uzivatela
  async register(email: string, displayName: string, password: string): Promise<User> {
    const result = await this.firebaseService.register(email, password, displayName);
    if (!result.success) {
      throw new Error(result.message);
    }

    const profile = this.firebaseService.userProfile();
    if (!profile) {
      throw new Error('Failed to create user profile');
    }

    const user = this.convertProfileToUser(profile);
    this.saveUser(user);
    return user;
  }

  // odhlasi uzivatela zo systemu
  async logout(): Promise<void> {
    await this.firebaseService.logout();
    this.saveUser(null);
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

  // konvertuje Firebase profil na User
  private convertProfileToUser(profile: UserProfile): User {
    return {
      uid: profile.uid,
      email: profile.email,
      displayName: profile.displayName,
      role: 'user',
      paperBalance: profile.paperBalance,
      createdAt: profile.createdAt,
      updatedAt: Date.now()
    };
  }

  // aktualizuje zostatok uzivatela
  updateBalance(newBalance: number): void {
    const user = this._user();
    if (user) {
      const updated = { ...user, paperBalance: newBalance, updatedAt: Date.now() };
      this.saveUser(updated);
      this.firebaseService.updateBalance(newBalance);
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
