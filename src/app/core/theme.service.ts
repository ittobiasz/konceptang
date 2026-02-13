import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'investiq_theme';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly _theme = signal<Theme>('dark');

  readonly theme = this._theme.asReadonly();

  constructor() {
    this.loadTheme();
  }

  // nacita temu z uloziska
  private loadTheme(): void {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme;
      if (stored && (stored === 'dark' || stored === 'light')) {
        this._theme.set(stored);
      }
      this.applyTheme(this._theme());
    }
  }

  // aplikuje temu na dokument
  private applyTheme(theme: Theme): void {
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.setAttribute('data-theme', theme);
      document.body.classList.remove('dark-theme', 'light-theme');
      document.body.classList.add(`${theme}-theme`);
    }
  }

  // prepne temu svetla tmava
  toggleTheme(): void {
    const newTheme = this._theme() === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  // nastavi konkretnu temu
  setTheme(theme: Theme): void {
    this._theme.set(theme);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(STORAGE_KEY, theme);
    }
    this.applyTheme(theme);
  }

  // zisti ci je tmava tema
  isDark(): boolean {
    return this._theme() === 'dark';
  }
}
