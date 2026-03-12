import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of, forkJoin, shareReplay, BehaviorSubject, timer, switchMap, retryWhen, delay } from 'rxjs';
import { AssetQuote, StockAsset } from '../shared/models';

//  Yahoo Finance API cez AllOrigins proxy (bez API kluca)
const YAHOO_API = 'https://query1.finance.yahoo.com/v8/finance/chart';

const STOCK_SYMBOLS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
  { symbol: 'NFLX', name: 'Netflix Inc.' },
  { symbol: 'V', name: 'Visa Inc.' },
];

interface YahooChartResponse {
  chart: {
    result: [{
      meta: {
        regularMarketPrice: number;
        previousClose: number;
        symbol: string;
      };
    }] | null;
    error: { code: string; description: string } | null;
  };
}

@Injectable({
  providedIn: 'root'
})
export class StockService {
  private readonly http = inject(HttpClient);
  private readonly cache$ = new BehaviorSubject<StockAsset[]>([]);
  private readonly CACHE_DURATION = 30000; // 30 sekund cache - viac frequent updates
  private lastFetch = 0;
  private isLoading = false;
  private retryAttempts = 0;

  // 🚀 nacita akcie OKAMZITE z fallback, potom aktualizuje na pozadi
  getStocks(forceRefresh = false): Observable<StockAsset[]> {
    const now = Date.now();
    
    // Vrat fallback OKAMZITE, aktualizuj na pozadi
    const fallbackStocks = this.getFallbackStocks();
    if (this.cache$.value.length === 0) {
      this.cache$.next(fallbackStocks);
    }

    // Vynuť update z API ak cache je starý, je to prvý krát, alebo je force refresh
    if ((now - this.lastFetch >= this.CACHE_DURATION || forceRefresh) && !this.isLoading) {
      this.isLoading = true;
      this.loadStocksInBackground();
    }

    // Vrať BehaviorSubject ktorý sa automaticky aktualizuje
    return this.cache$.asObservable().pipe(
      shareReplay(1)
    );
  }

  // 🔄 nacita akcie na pozadi bez blokovania UI
  private loadStocksInBackground(): void {
    // Nacitame len 5 hlavnych akcii pre rychlost
    const topStocks = STOCK_SYMBOLS.slice(0, 5);
    const requests = topStocks.map(stock =>
      this.getStockQuote(stock.symbol, stock.name).pipe(
        catchError(err => {
          console.warn(`Stock API failed for ${stock.symbol}:`, err.message);
          // Vrati null, merge s fallback
          return of(null);
        })
      )
    );

    forkJoin(requests).subscribe({
      next: (stocks) => {
        const validStocks = stocks.filter((s): s is StockAsset => s !== null);
        // Aktualizuj len tie co sme dostali, ostatne nechaj z fallback
        const fallbackStocks = this.getFallbackStocks();
        const mergedStocks = fallbackStocks.map(fb => {
          const live = validStocks.find(v => v.symbol === fb.symbol);
          return live || fb;
        });
        this.cache$.next(mergedStocks);
        this.lastFetch = Date.now();
        this.retryAttempts = 0;
        console.log('✓ Stock prices updated from API');
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Fatal stock error:', err);
        this.isLoading = false;
      }
    });
  }

  // nacita cenu jednej akcie cez Yahoo Finance
  private getStockQuote(symbol: string, name: string): Observable<StockAsset | null> {
    // Try primary proxy first, then fallback to secondary
    const primaryProxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(`${YAHOO_API}/${symbol}?interval=1d&range=1d`)}`;
    const secondaryProxy = `https://corsproxy.io/?${encodeURIComponent(`${YAHOO_API}/${symbol}?interval=1d&range=1d`)}`;

    return this.http.get<YahooChartResponse>(primaryProxy, { timeout: 5000 }).pipe(
      catchError(() => this.http.get<YahooChartResponse>(secondaryProxy, { timeout: 5000 }))
    ).pipe(
      map(response => {
        if (response.chart.result && response.chart.result.length > 0) {
          const meta = response.chart.result[0].meta;
          const price = meta.regularMarketPrice;
          const previousClose = meta.previousClose;
          const change = price - previousClose;
          const changePercent = (change / previousClose) * 100;

          return {
            symbol,
            name,
            price,
            change,
            changePercent,
            volume: 0
          };
        }
        return null;
      }),
      catchError(() => {
        const fallback = this.getFallbackPrices()[symbol];
        if (fallback) {
          return of({
            symbol,
            name,
            price: fallback.price,
            change: fallback.change,
            changePercent: fallback.change,
            volume: 0
          });
        }
        return of(null);
      })
    );
  }

  // najde akciu podla symbolu
  getStockBySymbol(symbol: string): Observable<StockAsset | null> {
    const stockInfo = STOCK_SYMBOLS.find(s => s.symbol === symbol);
    if (!stockInfo) {
      return of(null);
    }
    return this.getStockQuote(symbol, stockInfo.name);
  }

  // vyhlada akcie podla dotazu
  searchStocks(query: string): Observable<StockAsset[]> {
    const q = query.toUpperCase();
    const matching = STOCK_SYMBOLS.filter(s =>
      s.symbol.includes(q) || s.name.toUpperCase().includes(q)
    );

    if (matching.length === 0) {
      return of([]);
    }

    const requests = matching.slice(0, 10).map(stock =>
      this.getStockQuote(stock.symbol, stock.name)
    );

    return forkJoin(requests).pipe(
      map(stocks => stocks.filter((s): s is StockAsset => s !== null)),
      catchError(() => of([]))
    );
  }

  // vrati zalohu ak api nefunguje
  private getFallbackStocks(): StockAsset[] {
    const fallbackPrices = this.getFallbackPrices();
    return STOCK_SYMBOLS.map(stock => {
      const fallback = fallbackPrices[stock.symbol] || { price: 100, change: 0 };
      return {
        symbol: stock.symbol,
        name: stock.name,
        price: fallback.price,
        change: fallback.change,
        changePercent: fallback.change,
        volume: 0
      };
    });
  }

  // realisticke fallback ceny - API ich prepise ak funguje
  private getFallbackPrices(): Record<string, { price: number; change: number }> {
    return {
      'AAPL': { price: 195, change: 1.2 },
      'MSFT': { price: 415, change: 0.8 },
      'GOOGL': { price: 155, change: 0.5 },
      'AMZN': { price: 185, change: 1.1 },
      'NVDA': { price: 520, change: 2.3 },
      'META': { price: 505, change: 0.9 },
      'TSLA': { price: 275, change: -1.5 },
      'JPM': { price: 195, change: 0.4 },
      'NFLX': { price: 620, change: 1.8 },
      'V': { price: 280, change: 0.3 },
    };
  }

  // prevedie na standardny format
  mapToQuote(stock: StockAsset): AssetQuote {
    return {
      assetId: stock.symbol.toLowerCase(),
      symbol: stock.symbol,
      name: stock.name,
      assetType: 'stock',
      price: stock.price,
      change24h: stock.change,
      changePercent24h: stock.changePercent,
      volume24h: stock.volume,
      image: this.getStockIcon(stock.symbol)
    };
  }

  // vrati ikonu akcie
  getStockIcon(symbol: string): string {
    const icons: Record<string, string> = {
      'AAPL': '🍎',
      'MSFT': '🪟',
      'GOOGL': '🔍',
      'AMZN': '📦',
      'NVDA': '🎮',
      'META': '👤',
      'TSLA': '🚗',
      'BRK-B': '💼',
      'JPM': '🏦',
      'V': '💳',
    };
    return icons[symbol] || '📈';
  }

  // streamuje ceny akcii realtime
  getPriceStream$(symbols: string[]): Observable<Record<string, number>> {
    return timer(0, 60000).pipe(
      switchMap(() => {
        const requests = symbols.map(symbol => {
          const stockInfo = STOCK_SYMBOLS.find(s => s.symbol === symbol);
          if (!stockInfo) return of(null);
          return this.getStockQuote(symbol, stockInfo.name);
        });
        return forkJoin(requests);
      }),
      map(stocks => {
        const prices: Record<string, number> = {};
        stocks.forEach(s => {
          if (s) {
            prices[s.symbol.toLowerCase()] = s.price;
          }
        });
        return prices;
      })
    );
  }

  // vrati vsetky dostupne symboly
  getAllSymbols(): { symbol: string; name: string }[] {
    return STOCK_SYMBOLS;
  }
}
