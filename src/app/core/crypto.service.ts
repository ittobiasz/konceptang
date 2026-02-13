import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of, shareReplay, timer, switchMap, BehaviorSubject } from 'rxjs';
import { AssetQuote, CryptoAsset } from '../shared/models';

// 🔥 CoinGecko API - spolahlivy a zadarmo
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number;
  circulating_supply: number;
  max_supply: number | null;
  market_cap_rank: number;
}

@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  private readonly http = inject(HttpClient);
  private readonly cache$ = new BehaviorSubject<CryptoAsset[]>([]);
  private readonly CACHE_DURATION = 60000; // 1 minuta cache
  private lastFetch = 0;
  private isLoading = false;

  // 🚀 nacita kryptomeny OKAMZITE z cache/fallback
  getCryptos(limit = 50): Observable<CryptoAsset[]> {
    const now = Date.now();
    
    // Ak mame cache, vrat ju okamzite
    if (this.cache$.value.length > 0 && now - this.lastFetch < this.CACHE_DURATION) {
      return of(this.cache$.value.slice(0, limit));
    }

    // Vrat fallback OKAMZITE, aktualizuj na pozadi
    const fallback = this.getFallbackCryptos().slice(0, limit);
    if (this.cache$.value.length === 0) {
      this.cache$.next(this.getFallbackCryptos());
    }

    // Spusti update na pozadi (len raz)
    if (!this.isLoading) {
      this.isLoading = true;
      this.loadCryptosInBackground(limit);
    }

    return of(this.cache$.value.length > 0 ? this.cache$.value.slice(0, limit) : fallback);
  }

  // 🔄 nacita kryptomeny na pozadi bez blokovania UI
  private loadCryptosInBackground(limit: number): void {
    this.http.get<CoinGeckoMarket[]>(
      `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false`
    ).subscribe({
      next: (response) => {
        const cryptos = response.map(coin => this.mapCoinGeckoToCryptoAsset(coin));
        this.cache$.next(cryptos);
        this.lastFetch = Date.now();
        this.isLoading = false;
      },
      error: (err) => {
        console.warn('CoinGecko API failed:', err);
        this.isLoading = false;
      }
    });
  }

  // nacita kryptomenu podla id
  getCryptoById(id: string): Observable<CryptoAsset | null> {
    return this.http.get<CoinGeckoMarket[]>(
      `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${id}&sparkline=false`
    ).pipe(
      map(response => response.length > 0 ? this.mapCoinGeckoToCryptoAsset(response[0]) : null),
      catchError(() => {
        const fallback = this.getFallbackCryptos().find(c => c.id === id);
        return of(fallback || null);
      })
    );
  }

  // nacita kryptomeny podla viacerych id
  getCryptosByIds(ids: string[]): Observable<CryptoAsset[]> {
    if (ids.length === 0) return of([]);
    const idsParam = ids.join(',');
    return this.http.get<CoinGeckoMarket[]>(
      `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${idsParam}&sparkline=false`
    ).pipe(
      map(response => response.map(coin => this.mapCoinGeckoToCryptoAsset(coin))),
      catchError(() => of(this.getFallbackCryptos().filter(c => ids.includes(c.id))))
    );
  }

  // vyhlada kryptomeny podla nazvu
  searchCryptos(query: string): Observable<CryptoAsset[]> {
    return this.http.get<{ coins: { id: string; name: string; symbol: string }[] }>(
      `${COINGECKO_API}/search?query=${query}`
    ).pipe(
      switchMap(response => {
        const ids = response.coins.slice(0, 10).map(c => c.id);
        if (ids.length === 0) return of([]);
        return this.getCryptosByIds(ids);
      }),
      catchError(() => {
        const q = query.toLowerCase();
        return of(this.getFallbackCryptos().filter(c =>
          c.name.toLowerCase().includes(q) ||
          c.symbol.toLowerCase().includes(q)
        ));
      })
    );
  }

  // mapuje CoinGecko format na nas format
  private mapCoinGeckoToCryptoAsset(coin: CoinGeckoMarket): CryptoAsset {
    return {
      id: coin.id,
      rank: String(coin.market_cap_rank || 0),
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      supply: String(coin.circulating_supply || 0),
      maxSupply: coin.max_supply ? String(coin.max_supply) : null,
      marketCapUsd: String(coin.market_cap || 0),
      volumeUsd24Hr: String(coin.total_volume || 0),
      priceUsd: String(coin.current_price || 0),
      changePercent24Hr: String(coin.price_change_percentage_24h || 0),
      vwap24Hr: String(coin.current_price || 0)
    };
  }

  // prevedie na standardny format
  mapToQuote(crypto: CryptoAsset): AssetQuote {
    return {
      assetId: crypto.id,
      symbol: crypto.symbol,
      name: crypto.name,
      assetType: 'crypto',
      price: parseFloat(crypto.priceUsd),
      changePercent24h: parseFloat(crypto.changePercent24Hr),
      volume24h: parseFloat(crypto.volumeUsd24Hr),
      marketCap: parseFloat(crypto.marketCapUsd),
      image: this.getCryptoIcon(crypto.symbol)
    };
  }

  // vrati ikonu kryptomeny
  getCryptoIcon(symbol: string): string {
    const icons: Record<string, string> = {
      'BTC': '₿',
      'ETH': 'Ξ',
      'USDT': '₮',
      'BNB': '🔶',
      'SOL': '◎',
      'XRP': '✕',
      'ADA': '₳',
      'DOGE': 'Ð',
      'DOT': '●',
      'AVAX': '🔺',
      'LINK': '⬡',
      'MATIC': '⬟',
      'LTC': 'Ł',
      'UNI': '🦄',
      'XLM': '✦'
    };
    return icons[symbol] || '🪙';
  }

  // streamuje aktualne ceny
  getPriceStream$(assetIds: string[]): Observable<Record<string, number>> {
    return timer(0, 10000).pipe(
      switchMap(() => this.getCryptosByIds(assetIds)),
      map(cryptos => {
        const prices: Record<string, number> = {};
        cryptos.forEach(c => {
          prices[c.id] = parseFloat(c.priceUsd);
        });
        return prices;
      })
    );
  }

  // vrati zalohu ak api nefunguje
  private getFallbackCryptos(): CryptoAsset[] {
    return [
      { id: 'bitcoin', rank: '1', symbol: 'BTC', name: 'Bitcoin', supply: '19000000', maxSupply: '21000000', marketCapUsd: '1700000000000', volumeUsd24Hr: '30000000000', priceUsd: '96500.00', changePercent24Hr: '2.5', vwap24Hr: '95000' },
      { id: 'ethereum', rank: '2', symbol: 'ETH', name: 'Ethereum', supply: '120000000', maxSupply: null, marketCapUsd: '380000000000', volumeUsd24Hr: '15000000000', priceUsd: '2650.00', changePercent24Hr: '1.8', vwap24Hr: '2600' },
      { id: 'solana', rank: '3', symbol: 'SOL', name: 'Solana', supply: '400000000', maxSupply: null, marketCapUsd: '100000000000', volumeUsd24Hr: '3000000000', priceUsd: '195.00', changePercent24Hr: '4.07', vwap24Hr: '190' },
      { id: 'ripple', rank: '4', symbol: 'XRP', name: 'XRP', supply: '45000000000', maxSupply: '100000000000', marketCapUsd: '30000000000', volumeUsd24Hr: '2000000000', priceUsd: '2.45', changePercent24Hr: '1.2', vwap24Hr: '2.40' },
      { id: 'dogecoin', rank: '5', symbol: 'DOGE', name: 'Dogecoin', supply: '140000000000', maxSupply: null, marketCapUsd: '14000000000', volumeUsd24Hr: '800000000', priceUsd: '0.25', changePercent24Hr: '3.5', vwap24Hr: '0.24' },
    ];
  }
}
