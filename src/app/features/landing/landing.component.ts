import { Component, inject, signal, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CryptoService, StockService, AuthService, ThemeService } from '../../core';
import { AssetQuote } from '../../shared/models';
import { Subject, takeUntil, interval, switchMap, startWith } from 'rxjs';

type MarketTab = 'crypto' | 'stocks';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingComponent implements OnInit, OnDestroy {
  private readonly cryptoService = inject(CryptoService);
  private readonly stockService = inject(StockService);
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);

  private readonly destroy$ = new Subject<void>();

  readonly activeTab = signal<MarketTab>('crypto');
  readonly cryptos = signal<AssetQuote[]>([]);
  readonly stocks = signal<AssetQuote[]>([]);
  readonly isLoadingMarket = signal(true);

  readonly features = [
    {
      icon: '█',
      title: 'Real-time Dáta',
      description: 'Sledujte aktuálne ceny kryptomien a akcií v reálnom čase.'
    },
    {
      icon: '✓',
      title: 'Bez Rizika',
      description: 'Cvičte obchodovanie s virtuálnymi $100,000 bez straty reálnych peňazí.'
    },
    {
      icon: '◈',
      title: 'AI Poradca',
      description: 'Získajte personalizované investičné odporúčania od AI.'
    },
    {
      icon: '▲',
      title: 'Portfólio Analýza',
      description: 'Sledujte výkonnosť, P&L a diverzifikáciu vášho portfólia.'
    },
    {
      icon: '◆',
      title: 'Bezpečné',
      description: 'Všetky dáta sú uložené lokálne vo vašom prehliadači.'
    },
    {
      icon: '◉',
      title: 'Vzdelávanie',
      description: 'Naučte sa investovať skôr, než vložíte reálne peniaze.'
    }
  ];

  readonly stats = [
    { value: '$100K', label: 'Štartovací zostatok', icon: '◆' },
    { value: '50+', label: 'Kryptomien', icon: '◈' },
    { value: '20+', label: 'US Akcií', icon: '▲' },
    { value: 'AI', label: 'Portfólio poradca', icon: '◉' }
  ];

  ngOnInit(): void {
    this.loadMarketData();
    
    interval(30000).pipe(
      takeUntil(this.destroy$),
      startWith(0)
    ).subscribe(() => {
      this.loadMarketData();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // nacita trhove data
  private loadMarketData(): void {
    this.cryptoService.getCryptos(5).pipe(
      takeUntil(this.destroy$)
    ).subscribe(cryptos => {
      this.cryptos.set(cryptos.map(c => this.cryptoService.mapToQuote(c)));
      this.isLoadingMarket.set(false);
    });

    this.stockService.getStocks().pipe(
      takeUntil(this.destroy$)
    ).subscribe(stocks => {
      this.stocks.set(stocks.slice(0, 5).map(s => this.stockService.mapToQuote(s)));
    });
  }

  // prepne aktivny tab
  setActiveTab(tab: MarketTab): void {
    this.activeTab.set(tab);
  }

  // vrati aktiva podla tabu
  getCurrentAssets(): AssetQuote[] {
    return this.activeTab() === 'crypto' ? this.cryptos() : this.stocks();
  }

  // naformatuje cenu aktiva
  formatPrice(price: number): string {
    if (price >= 1000) {
      return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (price >= 1) {
      return '$' + price.toFixed(2);
    }
    return '$' + price.toFixed(4);
  }

  // naformatuje zmenu ceny
  formatChange(change: number | undefined): string {
    if (change === undefined) return '0.00%';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  }

  isPositiveChange(change: number | undefined): boolean {
    return (change ?? 0) >= 0;
  }

  getCryptoIcon(symbol: string): string {
    return this.cryptoService.getCryptoIcon(symbol);
  }
}
