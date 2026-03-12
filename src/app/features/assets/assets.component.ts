import { Component, inject, signal, OnInit, OnDestroy, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MarketDataService, UnifiedMarketService, CurrencyService, AssetFilter } from '../../core';
import { AssetQuote } from '../../shared/models';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, switchMap, of, interval } from 'rxjs';

@Component({
  selector: 'app-assets',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './assets.component.html',
  styleUrl: './assets.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetsComponent implements OnInit, OnDestroy {
  private readonly marketDataService = inject(MarketDataService);
  private readonly unifiedMarketService = inject(UnifiedMarketService);
  readonly currencyService = inject(CurrencyService);

  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject$ = new Subject<string>();

  readonly isLoading = signal(true);
  readonly assets = signal<AssetQuote[]>([]);
  readonly filteredAssets = signal<AssetQuote[]>([]);
  readonly activeFilter = signal<AssetFilter>('all');
  readonly searchQuery = signal('');
  readonly sortBy = signal<'name' | 'price' | 'change'>('name');
  readonly sortOrder = signal<'asc' | 'desc'>('asc');

  // Sparkline cache
  private sparklineCache = new Map<string, string>();

  readonly filters: { value: AssetFilter; label: string }[] = [
    { value: 'all', label: 'Všetky' },
    { value: 'crypto', label: 'Krypto' },
    { value: 'stocks', label: 'Akcie' }
  ];

  readonly stats = computed(() => {
    const all = this.assets();
    const crypto = all.filter(a => a.assetType === 'crypto').length;
    const stocks = all.filter(a => a.assetType === 'stock').length;
    return { total: all.length, crypto, stocks };
  });

  ngOnInit(): void {
    this.loadAssets();
    this.setupSearch();
    this.setupRealTimeUpdates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadAssets(): void {
    this.marketDataService.getAllAssets().pipe(
      takeUntil(this.destroy$)
    ).subscribe(assets => {
      this.assets.set(assets);
      this.applyFilters();
      this.isLoading.set(false);
    });
  }

  private setupSearch(): void {
    this.searchSubject$.pipe(
      takeUntil(this.destroy$),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (query.length < 2) {
          return of(this.assets());
        }
        return this.marketDataService.searchAssets(query, this.activeFilter());
      })
    ).subscribe(assets => {
      if (this.searchQuery().length >= 2) {
        this.filteredAssets.set(this.sortAssets(assets));
      } else {
        this.applyFilters();
      }
    });
  }

  private setupRealTimeUpdates(): void {
    this.unifiedMarketService.getPriceUpdates$().pipe(
      takeUntil(this.destroy$)
    ).subscribe(prices => {
      const updated = this.assets().map(asset => {
        const newPrice = prices.get(asset.assetId);
        if (newPrice && newPrice !== asset.price) {
          const oldPrice = asset.price;
          const change24h = ((newPrice - oldPrice) / oldPrice) * 100;
          return { ...asset, price: newPrice, changePercent24h: change24h };
        }
        return asset;
      });
      this.assets.set(updated);
      this.applyFilters();
    });

    // Auto-refresh kazdych 30 sekund
    interval(30000).pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.marketDataService.getAllAssetsFresh().pipe(
        takeUntil(this.destroy$)
      ).subscribe(assets => {
        this.assets.set(assets);
        this.applyFilters();
      });
    });
  }

  onSearchInput(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchQuery.set(query);
    this.searchSubject$.next(query);
  }

  setFilter(filter: AssetFilter): void {
    this.activeFilter.set(filter);
    this.applyFilters();
  }

  setSortBy(sort: 'name' | 'price' | 'change'): void {
    if (this.sortBy() === sort) {
      this.sortOrder.set(this.sortOrder() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(sort);
      this.sortOrder.set('asc');
    }
    this.applyFilters();
  }

  private applyFilters(): void {
    let filtered = this.assets();
    
    if (this.activeFilter() === 'crypto') {
      filtered = filtered.filter(a => a.assetType === 'crypto');
    } else if (this.activeFilter() === 'stocks') {
      filtered = filtered.filter(a => a.assetType === 'stock');
    }

    const query = this.searchQuery().toLowerCase();
    if (query.length >= 2) {
      filtered = filtered.filter(a => 
        a.name.toLowerCase().includes(query) ||
        a.symbol.toLowerCase().includes(query)
      );
    }

    this.filteredAssets.set(this.sortAssets(filtered));
  }

  private sortAssets(assets: AssetQuote[]): AssetQuote[] {
    const sorted = [...assets];
    const order = this.sortOrder() === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      switch (this.sortBy()) {
        case 'name':
          return a.name.localeCompare(b.name) * order;
        case 'price':
          return (a.price - b.price) * order;
        case 'change':
          return ((a.changePercent24h ?? 0) - (b.changePercent24h ?? 0)) * order;
        default:
          return 0;
      }
    });

    return sorted;
  }

  formatPrice(price: number): string {
    return this.currencyService.format(price);
  }

  formatChange(change: number | undefined): string {
    if (change === undefined) return '0.00%';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  }

  formatMarketCap(cap: number | undefined): string {
    if (!cap) return '-';
    return this.currencyService.formatCompact(cap);
  }

  isPositive(change: number | undefined): boolean {
    return (change ?? 0) >= 0;
  }

  getAssetTypeLabel(type: 'crypto' | 'stock'): string {
    return type === 'crypto' ? 'Krypto' : 'Akcia';
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.applyFilters();
  }
  getSparklinePath(asset: AssetQuote): string {
    const key = asset.assetId + '-' + Math.round(asset.price * 100);
    if (this.sparklineCache.has(key)) {
      return this.sparklineCache.get(key)!;
    }
    const path = this.generateSparkline(asset);
    this.sparklineCache.set(key, path);
    return path;
  }

  private generateSparkline(asset: AssetQuote): string {
    const points = 20;
    const width = 120;
    const height = 40;
    const change = asset.changePercent24h ?? 0;
    const seed = this.hashCode(asset.assetId);
    const values: number[] = [];

    let val = 50;
    for (let i = 0; i < points; i++) {
      const noise = Math.sin(seed + i * 0.7) * 8 + Math.cos(seed * 0.3 + i * 1.1) * 5;
      val += noise + (change / points) * 1.5;
      val = Math.max(5, Math.min(95, val));
      values.push(val);
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const coords = values.map((v, i) => {
      const x = (i / (points - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return 'M' + coords.join(' L');
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash;
  }

  getSparklineColor(asset: AssetQuote): string {
    return (asset.changePercent24h ?? 0) >= 0 ? '#10b981' : '#ef4444';
  }
}