import { Component, inject, signal, OnInit, OnDestroy, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MarketDataService, UnifiedMarketService, CurrencyService, AssetFilter } from '../../core';
import { AssetQuote } from '../../shared/models';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';

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
}
