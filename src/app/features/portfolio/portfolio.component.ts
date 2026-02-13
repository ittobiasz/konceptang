import { Component, inject, signal, OnInit, OnDestroy, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PortfolioService, AuthService, MarketDataService, UnifiedMarketService, CurrencyService } from '../../core';
import { PositionWithQuote, Trade, AssetQuote } from '../../shared/models';
import { Subject, takeUntil, interval, startWith, switchMap } from 'rxjs';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './portfolio.component.html',
  styleUrl: './portfolio.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PortfolioComponent implements OnInit, OnDestroy {
  private readonly portfolioService = inject(PortfolioService);
  private readonly authService = inject(AuthService);
  private readonly marketDataService = inject(MarketDataService);
  private readonly unifiedMarketService = inject(UnifiedMarketService);
  readonly currencyService = inject(CurrencyService);

  private readonly destroy$ = new Subject<void>();
  private readonly quotes = new Map<string, AssetQuote>();

  readonly isLoading = signal(true);
  readonly positions = signal<PositionWithQuote[]>([]);
  readonly recentTrades = signal<Trade[]>([]);
  
  readonly totalValue = signal(0);
  readonly totalCost = signal(0);
  readonly totalPnl = signal(0);
  readonly totalPnlPercent = signal(0);
  readonly cashBalance = signal(0);
  readonly totalEquity = signal(0);

  readonly user = computed(() => this.authService.user());

  ngOnInit(): void {
    this.loadPortfolioData();
    
    interval(5000).pipe(
      takeUntil(this.destroy$),
      startWith(0),
      switchMap(() => this.marketDataService.getAllAssets())
    ).subscribe(assets => {
      this.quotes.clear();
      assets.forEach(a => this.quotes.set(a.assetId, a));
      this.updatePortfolio();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // nacita data portfolia
  private loadPortfolioData(): void {
    this.marketDataService.getAllAssets().pipe(
      takeUntil(this.destroy$)
    ).subscribe(assets => {
      assets.forEach(a => this.quotes.set(a.assetId, a));
      this.updatePortfolio();
      this.isLoading.set(false);
      
      const cryptoIds = this.portfolioService.getPositions()
        .filter(p => p.assetType === 'crypto')
        .map(p => p.assetId);
      const stockSymbols = this.portfolioService.getPositions()
        .filter(p => p.assetType === 'stock')
        .map(p => p.assetSymbol);
      
      if (cryptoIds.length > 0) {
        this.unifiedMarketService.subscribeToCrypto(cryptoIds);
      }
      if (stockSymbols.length > 0) {
        this.unifiedMarketService.subscribeToStocks(stockSymbols);
      }
    });
  }

  // aktualizuje stav portfolia
  private updatePortfolio(): void {
    const snapshot = this.portfolioService.getPortfolioSnapshot(this.quotes);
    
    this.positions.set(snapshot.positions);
    this.totalValue.set(snapshot.totalValue);
    this.totalCost.set(snapshot.totalCost);
    this.totalPnl.set(snapshot.totalPnl);
    this.totalPnlPercent.set(snapshot.totalPnlPercent);
    this.cashBalance.set(snapshot.cashBalance);
    this.totalEquity.set(snapshot.totalEquity);
    
    this.recentTrades.set(this.portfolioService.getRecentTrades(5));
  }

  // naformatuje sumu v mene
  formatCurrency(amount: number): string {
    return this.currencyService.format(amount);
  }

  // naformatuje percentualnu hodnotu
  formatPercent(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }

  // naformatuje datum obchodu
  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('sk-SK', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  isPositive(value: number): boolean {
    return value >= 0;
  }

  getTradeTypeLabel(type: 'buy' | 'sell'): string {
    return type === 'buy' ? 'Nákup' : 'Predaj';
  }

  getAssetTypeLabel(type: 'crypto' | 'stock'): string {
    return type === 'crypto' ? 'Krypto' : 'Akcia';
  }

  // resetuje cele portfolio
  resetPortfolio(): void {
    if (confirm('Naozaj chcete resetovať portfólio? Všetky pozície a obchody budú vymazané.')) {
      this.portfolioService.clearAllData();
      this.authService.resetBalance();
      this.updatePortfolio();
    }
  }
}
