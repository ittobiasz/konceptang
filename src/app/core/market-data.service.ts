import { Injectable, inject } from '@angular/core';
import { Observable, combineLatest, map, shareReplay } from 'rxjs';
import { CryptoService } from './crypto.service';
import { StockService } from './stock.service';
import { AssetQuote } from '../shared/models';

export type AssetFilter = 'all' | 'crypto' | 'stocks';

@Injectable({
  providedIn: 'root'
})
export class MarketDataService {
  private readonly cryptoService = inject(CryptoService);
  private readonly stockService = inject(StockService);

  private readonly allAssets$ = combineLatest([
    this.cryptoService.getCryptos(50),
    this.stockService.getStocks()
  ]).pipe(
    map(([cryptos, stocks]) => {
      const cryptoQuotes = cryptos.map(c => this.cryptoService.mapToQuote(c));
      const stockQuotes = stocks.map(s => this.stockService.mapToQuote(s));
      return [...cryptoQuotes, ...stockQuotes];
    }),
    shareReplay(1)
  );

  // vrati vsetky aktiva
  getAllAssets(): Observable<AssetQuote[]> {
    return this.allAssets$;
  }

  // vrati aktiva podla typu
  getAssetsByType(type: AssetFilter): Observable<AssetQuote[]> {
    return this.allAssets$.pipe(
      map(assets => {
        if (type === 'all') return assets;
        return assets.filter(a => 
          (type === 'crypto' && a.assetType === 'crypto') ||
          (type === 'stocks' && a.assetType === 'stock')
        );
      })
    );
  }

  // vrati top kryptomeny
  getTopCryptos(limit = 5): Observable<AssetQuote[]> {
    return this.cryptoService.getCryptos(limit).pipe(
      map(cryptos => cryptos.map(c => this.cryptoService.mapToQuote(c)))
    );
  }

  // vrati top akcie
  getTopStocks(limit = 5): Observable<AssetQuote[]> {
    return this.stockService.getStocks().pipe(
      map(stocks => stocks.slice(0, limit).map(s => this.stockService.mapToQuote(s)))
    );
  }

  // najde aktivum podla id
  getAssetById(id: string, type: 'crypto' | 'stock'): Observable<AssetQuote | null> {
    if (type === 'crypto') {
      return this.cryptoService.getCryptoById(id).pipe(
        map(crypto => crypto ? this.cryptoService.mapToQuote(crypto) : null)
      );
    } else {
      return this.stockService.getStockBySymbol(id.toUpperCase()).pipe(
        map(stock => stock ? this.stockService.mapToQuote(stock) : null)
      );
    }
  }

  // vyhlada aktiva podla dotazu
  searchAssets(query: string, type: AssetFilter = 'all'): Observable<AssetQuote[]> {
    if (type === 'crypto') {
      return this.cryptoService.searchCryptos(query).pipe(
        map(cryptos => cryptos.map(c => this.cryptoService.mapToQuote(c)))
      );
    } else if (type === 'stocks') {
      return this.stockService.searchStocks(query).pipe(
        map(stocks => stocks.map(s => this.stockService.mapToQuote(s)))
      );
    } else {
      return combineLatest([
        this.cryptoService.searchCryptos(query),
        this.stockService.searchStocks(query)
      ]).pipe(
        map(([cryptos, stocks]) => [
          ...cryptos.map(c => this.cryptoService.mapToQuote(c)),
          ...stocks.map(s => this.stockService.mapToQuote(s))
        ])
      );
    }
  }
}
