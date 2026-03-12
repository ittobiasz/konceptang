import { Component, inject, signal, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MarketDataService, PortfolioService, AuthService, CurrencyService, UnifiedMarketService } from '../../core';
import { AssetQuote, Position } from '../../shared/models';
import { Subject, takeUntil, switchMap, interval, startWith } from 'rxjs';
import { PriceChartComponent } from '../../shared/components/price-chart.component';

@Component({
  selector: 'app-trade',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PriceChartComponent],
  templateUrl: './trade.component.html',
  styleUrl: './trade.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TradeComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly marketDataService = inject(MarketDataService);
  private readonly portfolioService = inject(PortfolioService);
  protected readonly authService = inject(AuthService);
  readonly currencyService = inject(CurrencyService);
  private readonly unifiedMarketService = inject(UnifiedMarketService);

  private readonly destroy$ = new Subject<void>();

  readonly asset = signal<AssetQuote | null>(null);
  readonly position = signal<Position | null>(null);
  readonly isLoading = signal(true);
  readonly tradeType = signal<'buy' | 'sell'>('buy');
  readonly quantity = signal<number>(0);
  readonly message = signal<{ type: 'success' | 'error'; text: string } | null>(null);
  readonly isSubmitting = signal(false);

  readonly balance = this.authService.user()?.paperBalance ?? 0;

  ngOnInit(): void {
    this.route.paramMap.pipe(
      takeUntil(this.destroy$),
      switchMap(params => {
        const assetId = params.get('id');
        if (!assetId) {
          this.router.navigate(['/assets']);
          return [];
        }
        // Force fresh API call on page load
        return this.marketDataService.getAllAssetsFresh();
      })
    ).subscribe(assets => {
      const assetId = this.route.snapshot.paramMap.get('id');
      const found = assets.find(a => a.assetId === assetId);
      if (found) {
        this.asset.set(found);
        this.position.set(this.portfolioService.getPositionByAsset(found.assetId));
        
        if (found.assetType === 'crypto') {
          this.unifiedMarketService.subscribeToCrypto([found.assetId]);
        } else {
          this.unifiedMarketService.subscribeToStocks([found.symbol]);
        }
      }
      this.isLoading.set(false);
    });

    interval(5000).pipe(
      takeUntil(this.destroy$),
      startWith(0)
    ).subscribe(() => {
      const current = this.asset();
      if (current) {
        const price = this.unifiedMarketService.getPrice(current.assetId);
        if (price && price !== current.price) {
          this.asset.set({ ...current, price });
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // nastavi typ obchodu
  setTradeType(type: 'buy' | 'sell'): void {
    this.tradeType.set(type);
    this.quantity.set(0);
    this.message.set(null);
  }

  // nastavi mnozstvo aktiva
  setQuantity(value: number): void {
    this.quantity.set(Math.max(0, value));
    this.message.set(null);
  }

  incrementQuantity(): void {
    this.setQuantity(this.quantity() + 1);
  }

  decrementQuantity(): void {
    if (this.quantity() > 0) {
      this.setQuantity(this.quantity() - 1);
    }
  }

  // nastavi maximalne mnozstvo
  setMaxQuantity(): void {
    const asset = this.asset();
    if (!asset) return;

    if (this.tradeType() === 'buy') {
      const balance = this.authService.getBalance();
      const maxQty = Math.floor(balance / asset.price);
      this.setQuantity(maxQty);
    } else {
      const pos = this.position();
      if (pos) {
        this.setQuantity(pos.quantity);
      }
    }
  }

  get total(): number {
    const asset = this.asset();
    if (!asset) return 0;
    return this.quantity() * asset.price;
  }

  get canTrade(): boolean {
    const asset = this.asset();
    if (!asset || this.quantity() <= 0) return false;

    if (this.tradeType() === 'buy') {
      return this.total <= this.authService.getBalance();
    } else {
      const pos = this.position();
      return pos !== null && this.quantity() <= pos.quantity;
    }
  }

  // vykona nakup alebo predaj
  executeTrade(): void {
    const asset = this.asset();
    if (!asset || !this.canTrade) return;

    this.isSubmitting.set(true);

    setTimeout(() => {
      let result;
      if (this.tradeType() === 'buy') {
        result = this.portfolioService.buy(asset, this.quantity(), asset.price);
      } else {
        result = this.portfolioService.sell(asset, this.quantity(), asset.price);
      }

      this.message.set({
        type: result.success ? 'success' : 'error',
        text: result.message
      });

      if (result.success) {
        this.quantity.set(0);
        this.position.set(this.portfolioService.getPositionByAsset(asset.assetId));
      }

      this.isSubmitting.set(false);
    }, 500);
  }

  formatCurrency(amount: number): string {
    return this.currencyService.format(amount);
  }

  formatChange(change: number | undefined): string {
    if (change === undefined) return '0.00%';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  }

  isPositive(value: number | undefined): boolean {
    return (value ?? 0) >= 0;
  }
}
