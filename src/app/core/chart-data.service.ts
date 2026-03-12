import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of, shareReplay } from 'rxjs';

// 📊 Candlestick data pre grafy
export interface CandlestickData {
  time: number; // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// 📈 Historicka udalost
export interface HistoricalEvent {
  date: string;
  title: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  priceChange?: number;
  assetId?: string;
}

// 🕐 Casovy rozsah
export type TimeRange = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';

@Injectable({
  providedIn: 'root'
})
export class ChartDataService {
  private readonly http = inject(HttpClient);
  
  // Cache pre historicke data
  private cache = new Map<string, { data: CandlestickData[]; timestamp: number }>();
  private readonly CACHE_DURATION = 60 * 1000; // 1 minúta - rýchla aktualizácia grafov

  // 📊 Nacita historicke data pre kryptomenu z CoinGecko
  getCryptoHistory(coinId: string, range: TimeRange): Observable<CandlestickData[]> {
    const cacheKey = `crypto-${coinId}-${range}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return of(cached.data);
    }

    const days = this.rangeToDays(range);
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
    
    return this.http.get<number[][]>(url).pipe(
      map(data => {
        const candles = data.map(item => ({
          time: Math.floor(item[0] / 1000),
          open: item[1],
          high: item[2],
          low: item[3],
          close: item[4]
        }));
        this.cache.set(cacheKey, { data: candles, timestamp: Date.now() });
        return candles;
      }),
      catchError(() => of(this.generateFallbackData(range))),
      shareReplay(1)
    );
  }

  // 📊 Nacita historicke data pre akciu cez Yahoo Finance
  getStockHistory(symbol: string, range: TimeRange): Observable<CandlestickData[]> {
    const cacheKey = `stock-${symbol}-${range}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return of(cached.data);
    }

    const { interval, period } = this.rangeToYahooParams(range);
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${period}`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`;
    
    return this.http.get<any>(proxyUrl).pipe(
      map(response => {
        if (!response.chart?.result?.[0]) {
          return this.generateFallbackData(range);
        }
        
        const result = response.chart.result[0];
        const timestamps = result.timestamp || [];
        const quotes = result.indicators.quote[0];
        
        const candles: CandlestickData[] = [];
        for (let i = 0; i < timestamps.length; i++) {
          if (quotes.open[i] && quotes.close[i]) {
            candles.push({
              time: timestamps[i],
              open: quotes.open[i],
              high: quotes.high[i],
              low: quotes.low[i],
              close: quotes.close[i],
              volume: quotes.volume[i]
            });
          }
        }
        
        this.cache.set(cacheKey, { data: candles, timestamp: Date.now() });
        return candles;
      }),
      catchError(() => of(this.generateFallbackData(range))),
      shareReplay(1)
    );
  }

  // 📈 Historicke udalosti krypto sveta
  getHistoricalEvents(): HistoricalEvent[] {
    return [
      {
        date: '2024-04-20',
        title: 'Bitcoin Halving 2024',
        description: 'Štvrtý halving Bitcoinu - odmena za blok znížená na 3.125 BTC',
        impact: 'positive',
        priceChange: 15,
        assetId: 'bitcoin'
      },
      {
        date: '2024-01-10',
        title: 'Bitcoin ETF schválený',
        description: 'SEC schválila prvé Bitcoin spot ETF v USA',
        impact: 'positive',
        priceChange: 25,
        assetId: 'bitcoin'
      },
      {
        date: '2022-11-11',
        title: 'FTX Krach',
        description: 'Jedna z najväčších crypto búrz FTX zbankrotovala',
        impact: 'negative',
        priceChange: -20
      },
      {
        date: '2022-05-12',
        title: 'Terra Luna Kolaps',
        description: 'Stablecoin UST a LUNA stratili takmer celú hodnotu',
        impact: 'negative',
        priceChange: -30
      },
      {
        date: '2021-11-10',
        title: 'Bitcoin ATH $69,000',
        description: 'Bitcoin dosiahol historické maximum',
        impact: 'positive',
        priceChange: 0,
        assetId: 'bitcoin'
      },
      {
        date: '2021-04-14',
        title: 'Coinbase IPO',
        description: 'Coinbase vstúpil na burzu s valuáciou $86 miliárd',
        impact: 'positive',
        priceChange: 5
      },
      {
        date: '2020-05-11',
        title: 'Bitcoin Halving 2020',
        description: 'Tretí halving - odmena znížená na 6.25 BTC',
        impact: 'positive',
        priceChange: 50,
        assetId: 'bitcoin'
      },
      {
        date: '2020-03-12',
        title: 'COVID Crash',
        description: 'Bitcoin spadol o 50% počas pandemického výpredaja',
        impact: 'negative',
        priceChange: -50,
        assetId: 'bitcoin'
      },
      {
        date: '2017-12-17',
        title: 'Bitcoin $20,000',
        description: 'Bitcoin prvýkrát dosiahol $20,000',
        impact: 'positive',
        priceChange: 0,
        assetId: 'bitcoin'
      },
      {
        date: '2016-07-09',
        title: 'Bitcoin Halving 2016',
        description: 'Druhý halving - odmena znížená na 12.5 BTC',
        impact: 'positive',
        priceChange: 100,
        assetId: 'bitcoin'
      },
      {
        date: '2015-07-30',
        title: 'Ethereum Launch',
        description: 'Ethereum mainnet spustený',
        impact: 'positive',
        assetId: 'ethereum'
      },
      {
        date: '2014-02-24',
        title: 'Mt. Gox Hack',
        description: 'Najväčšia burza Mt. Gox hacknuta, stratených 850,000 BTC',
        impact: 'negative',
        priceChange: -40,
        assetId: 'bitcoin'
      },
      {
        date: '2012-11-28',
        title: 'Prvý Bitcoin Halving',
        description: 'Prvý halving - odmena znížená z 50 na 25 BTC',
        impact: 'positive',
        priceChange: 200,
        assetId: 'bitcoin'
      },
      {
        date: '2010-05-22',
        title: 'Bitcoin Pizza Day',
        description: 'Prvá reálna transakcia - 10,000 BTC za 2 pizzy',
        impact: 'neutral',
        assetId: 'bitcoin'
      },
      {
        date: '2009-01-03',
        title: 'Genesis Block',
        description: 'Satoshi Nakamoto vytvoril prvý Bitcoin blok',
        impact: 'positive',
        assetId: 'bitcoin'
      }
    ];
  }

  // 📊 Vygeneruje fallback data pre grafy
  private generateFallbackData(range: TimeRange): CandlestickData[] {
    const days = this.rangeToDays(range);
    const data: CandlestickData[] = [];
    const now = Math.floor(Date.now() / 1000);
    const interval = (days * 24 * 60 * 60) / 100; // 100 bodov
    
    let price = 50000; // Zaciatok
    
    for (let i = 100; i >= 0; i--) {
      const time = now - (i * interval);
      const change = (Math.random() - 0.48) * price * 0.03;
      const open = price;
      price = Math.max(1000, price + change);
      const close = price;
      const high = Math.max(open, close) * (1 + Math.random() * 0.02);
      const low = Math.min(open, close) * (1 - Math.random() * 0.02);
      
      data.push({ time: Math.floor(time), open, high, low, close });
    }
    
    return data;
  }

  // 🕐 Prevod range na dni
  private rangeToDays(range: TimeRange): number {
    const mapping: Record<TimeRange, number> = {
      '1D': 1,
      '1W': 7,
      '1M': 30,
      '3M': 90,
      '1Y': 365,
      'ALL': 1825 // 5 rokov
    };
    return mapping[range];
  }

  // 🕐 Prevod range na Yahoo Finance parametre
  private rangeToYahooParams(range: TimeRange): { interval: string; period: string } {
    const mapping: Record<TimeRange, { interval: string; period: string }> = {
      '1D': { interval: '5m', period: '1d' },
      '1W': { interval: '15m', period: '5d' },
      '1M': { interval: '1h', period: '1mo' },
      '3M': { interval: '1d', period: '3mo' },
      '1Y': { interval: '1d', period: '1y' },
      'ALL': { interval: '1wk', period: '5y' }
    };
    return mapping[range];
  }
}
