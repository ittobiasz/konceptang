import { Injectable, signal } from '@angular/core';

export type Currency = 'USD' | 'EUR' | 'CZK' | 'GBP';

interface CurrencyConfig {
  symbol: string;
  rate: number;
  locale: string;
}

const CURRENCIES: Record<Currency, CurrencyConfig> = {
  USD: { symbol: '$', rate: 1, locale: 'en-US' },
  EUR: { symbol: '€', rate: 0.92, locale: 'de-DE' },
  CZK: { symbol: 'Kč', rate: 23.5, locale: 'cs-CZ' },
  GBP: { symbol: '£', rate: 0.79, locale: 'en-GB' }
};

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private readonly _currency = signal<Currency>('USD');
  
  readonly currency = this._currency.asReadonly();

  // nastavi aktivnu menu
  setCurrency(currency: Currency): void {
    this._currency.set(currency);
  }

  // vrati konfiguraciu meny
  getCurrencyConfig(): CurrencyConfig {
    return CURRENCIES[this._currency()];
  }

  // prevedie sumu z usd
  convert(amountUsd: number): number {
    const config = this.getCurrencyConfig();
    return amountUsd * config.rate;
  }

  // naformatuje sumu s menou
  format(amountUsd: number): string {
    const config = this.getCurrencyConfig();
    const converted = amountUsd * config.rate;
    
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: this._currency(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(converted);
  }

  // naformatuje kompaktne velke cisla
  formatCompact(amountUsd: number): string {
    const config = this.getCurrencyConfig();
    const converted = amountUsd * config.rate;
    
    if (Math.abs(converted) >= 1e9) {
      return `${config.symbol}${(converted / 1e9).toFixed(2)}B`;
    } else if (Math.abs(converted) >= 1e6) {
      return `${config.symbol}${(converted / 1e6).toFixed(2)}M`;
    } else if (Math.abs(converted) >= 1e3) {
      return `${config.symbol}${(converted / 1e3).toFixed(2)}K`;
    }
    
    return this.format(amountUsd);
  }

  // vrati symbol meny
  getSymbol(): string {
    return CURRENCIES[this._currency()].symbol;
  }

  // vrati dostupne meny
  getAvailableCurrencies(): Currency[] {
    return Object.keys(CURRENCIES) as Currency[];
  }
}
