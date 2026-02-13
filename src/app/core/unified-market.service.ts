import { Injectable, inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject, BehaviorSubject, timer, switchMap, takeUntil, map, merge, of } from 'rxjs';
import { CryptoService } from './crypto.service';
import { StockService } from './stock.service';

export interface PriceUpdate {
  assetId: string;
  price: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class UnifiedMarketService implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cryptoService = inject(CryptoService);
  private readonly stockService = inject(StockService);

  private websocket: WebSocket | null = null;
  private readonly destroy$ = new Subject<void>();
  private readonly priceUpdates$ = new BehaviorSubject<Map<string, number>>(new Map());

  private subscribedCryptos = new Set<string>();
  private subscribedStocks = new Set<string>();

  readonly prices$ = this.priceUpdates$.asObservable();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.startPolling();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnectWebSocket();
  }

  // spusti polling cien
  private startPolling(): void {
    timer(0, 5000).pipe(
      takeUntil(this.destroy$),
      switchMap(() => {
        const cryptoIds = Array.from(this.subscribedCryptos);
        if (cryptoIds.length === 0) return of({});
        return this.cryptoService.getCryptosByIds(cryptoIds).pipe(
          map(cryptos => {
            const prices: Record<string, number> = {};
            cryptos.forEach(c => {
              prices[c.id] = parseFloat(c.priceUsd);
            });
            return prices;
          })
        );
      })
    ).subscribe(prices => {
      const current = this.priceUpdates$.value;
      Object.entries(prices).forEach(([id, price]) => {
        current.set(id, price as number);
      });
      this.priceUpdates$.next(new Map(current));
    });

    timer(0, 60000).pipe(
      takeUntil(this.destroy$),
      switchMap(() => {
        const symbols = Array.from(this.subscribedStocks);
        if (symbols.length === 0) return of({});
        return this.stockService.getStocks().pipe(
          map(stocks => {
            const prices: Record<string, number> = {};
            stocks.filter(s => symbols.includes(s.symbol.toLowerCase())).forEach(s => {
              prices[s.symbol.toLowerCase()] = s.price;
            });
            return prices;
          })
        );
      })
    ).subscribe(prices => {
      const current = this.priceUpdates$.value;
      Object.entries(prices).forEach(([id, price]) => {
        current.set(id, price as number);
      });
      this.priceUpdates$.next(new Map(current));
    });
  }

  // prihlasi sa na krypto ceny
  subscribeToCrypto(ids: string[]): void {
    ids.forEach(id => this.subscribedCryptos.add(id));
  }

  // prihlasi sa na akciove ceny
  subscribeToStocks(symbols: string[]): void {
    symbols.forEach(s => this.subscribedStocks.add(s.toLowerCase()));
  }

  // odhlasi sa z krypto
  unsubscribeFromCrypto(ids: string[]): void {
    ids.forEach(id => this.subscribedCryptos.delete(id));
  }

  // odhlasi sa z akcii
  unsubscribeFromStocks(symbols: string[]): void {
    symbols.forEach(s => this.subscribedStocks.delete(s.toLowerCase()));
  }

  // vrati aktualnu cenu
  getPrice(assetId: string): number | undefined {
    return this.priceUpdates$.value.get(assetId.toLowerCase());
  }

  // vrati stream cenovych zmien
  getPriceUpdates$(): Observable<Map<string, number>> {
    return this.priceUpdates$.asObservable();
  }

  // pripoji websocket pre realtime
  connectWebSocket(cryptoIds: string[]): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    this.disconnectWebSocket();
    
    const assets = cryptoIds.join(',');
    const wsUrl = `wss://ws.coincap.io/prices?assets=${assets}`;
    
    try {
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const current = this.priceUpdates$.value;
        
        Object.entries(data).forEach(([id, price]) => {
          current.set(id, parseFloat(price as string));
        });
        
        this.priceUpdates$.next(new Map(current));
      };

      this.websocket.onerror = (error) => {
        console.warn('WebSocket error, falling back to polling:', error);
      };

      this.websocket.onclose = () => {
        console.log('WebSocket closed');
      };
    } catch (error) {
      console.warn('Failed to connect WebSocket:', error);
    }
  }

  // odpoji websocket spojenie
  disconnectWebSocket(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }
}
