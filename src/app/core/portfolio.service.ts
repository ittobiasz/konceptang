import { Injectable, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from './auth.service';
import { Position, PositionWithQuote, Trade, PortfolioSnapshot, AssetQuote } from '../shared/models';

const POSITIONS_KEY = 'investiq_positions';
const TRADES_KEY = 'investiq_trades';

@Injectable({
  providedIn: 'root'
})
export class PortfolioService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly authService = inject(AuthService);

  private readonly _positions = signal<Position[]>([]);
  private readonly _trades = signal<Trade[]>([]);
  private readonly _isLoading = signal(false);

  readonly positions = this._positions.asReadonly();
  readonly trades = this._trades.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  constructor() {
    this.loadData();
  }

  // nacita data z local storage
  private loadData(): void {
    if (isPlatformBrowser(this.platformId)) {
      const positions = localStorage.getItem(POSITIONS_KEY);
      const trades = localStorage.getItem(TRADES_KEY);
      
      if (positions) {
        try {
          this._positions.set(JSON.parse(positions));
        } catch {
          this._positions.set([]);
        }
      }
      
      if (trades) {
        try {
          this._trades.set(JSON.parse(trades));
        } catch {
          this._trades.set([]);
        }
      }
    }
  }

  // ulozi pozicie do uloziska
  private savePositions(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(POSITIONS_KEY, JSON.stringify(this._positions()));
    }
  }

  // ulozi obchody do uloziska
  private saveTrades(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(TRADES_KEY, JSON.stringify(this._trades()));
    }
  }

  // vrati pozicie pouzivatela
  getPositions(): Position[] {
    const user = this.authService.user();
    if (!user) return [];
    return this._positions().filter(p => p.userId === user.uid);
  }

  // vrati pozicie s cenami
  getPositionsWithQuotes(quotes: Map<string, AssetQuote>): PositionWithQuote[] {
    return this.getPositions().map(position => {
      const quote = quotes.get(position.assetId);
      const currentPrice = quote?.price ?? position.averagePrice;
      const marketValue = position.quantity * currentPrice;
      const totalCost = position.quantity * position.averagePrice;
      const pnl = marketValue - totalCost;
      const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

      return {
        ...position,
        currentPrice,
        quote,
        marketValue,
        totalCost,
        pnl,
        pnlPercent
      };
    });
  }

  // vytvori prehlad celeho portfolia
  getPortfolioSnapshot(quotes: Map<string, AssetQuote>): PortfolioSnapshot {
    const positions = this.getPositionsWithQuotes(quotes);
    const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
    const totalCost = positions.reduce((sum, p) => sum + p.totalCost, 0);
    const totalPnl = totalValue - totalCost;
    const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
    const cashBalance = this.authService.getBalance();

    return {
      totalValue,
      totalCost,
      totalPnl,
      totalPnlPercent,
      cashBalance,
      totalEquity: totalValue + cashBalance,
      positions
    };
  }

  // vrati vsetky obchody pouzivatela
  getTrades(): Trade[] {
    const user = this.authService.user();
    if (!user) return [];
    return this._trades()
      .filter(t => t.userId === user.uid)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  // vrati posledne obchody
  getRecentTrades(limit = 5): Trade[] {
    return this.getTrades().slice(0, limit);
  }

  // nakupi aktivum pre pouzivatela
  buy(asset: AssetQuote, quantity: number, price: number): { success: boolean; message: string } {
    const user = this.authService.user();
    if (!user) {
      return { success: false, message: 'Používateľ nie je prihlásený' };
    }

    const total = quantity * price;
    if (total > user.paperBalance) {
      return { success: false, message: 'Nedostatok prostriedkov' };
    }

    const trade: Trade = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: user.uid,
      assetId: asset.assetId,
      assetSymbol: asset.symbol,
      assetName: asset.name,
      assetType: asset.assetType,
      type: 'buy',
      quantity,
      price,
      total,
      timestamp: Date.now()
    };

    const positions = this._positions();
    const existingIndex = positions.findIndex(
      p => p.userId === user.uid && p.assetId === asset.assetId
    );

    if (existingIndex >= 0) {
      const existing = positions[existingIndex];
      const newQuantity = existing.quantity + quantity;
      const newAveragePrice = 
        (existing.quantity * existing.averagePrice + quantity * price) / newQuantity;
      
      positions[existingIndex] = {
        ...existing,
        quantity: newQuantity,
        averagePrice: newAveragePrice,
        updatedAt: Date.now()
      };
    } else {
      const newPosition: Position = {
        id: `pos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: user.uid,
        assetId: asset.assetId,
        assetSymbol: asset.symbol,
        assetName: asset.name,
        assetType: asset.assetType,
        quantity,
        averagePrice: price,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      positions.push(newPosition);
    }

    this.authService.updateBalance(user.paperBalance - total);

    this._positions.set([...positions]);
    this._trades.set([...this._trades(), trade]);
    this.savePositions();
    this.saveTrades();

    return { success: true, message: `Nakúpené ${quantity} ${asset.symbol} za ${price.toFixed(2)} USD` };
  }

  // preda aktivum za cenu
  sell(asset: AssetQuote, quantity: number, price: number): { success: boolean; message: string } {
    const user = this.authService.user();
    if (!user) {
      return { success: false, message: 'Používateľ nie je prihlásený' };
    }

    const positions = this._positions();
    const positionIndex = positions.findIndex(
      p => p.userId === user.uid && p.assetId === asset.assetId
    );

    if (positionIndex < 0) {
      return { success: false, message: 'Nemáte túto pozíciu' };
    }

    const position = positions[positionIndex];
    if (quantity > position.quantity) {
      return { success: false, message: 'Nedostatok aktív na predaj' };
    }

    const total = quantity * price;

    const trade: Trade = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: user.uid,
      assetId: asset.assetId,
      assetSymbol: asset.symbol,
      assetName: asset.name,
      assetType: asset.assetType,
      type: 'sell',
      quantity,
      price,
      total,
      timestamp: Date.now()
    };

    const newQuantity = position.quantity - quantity;
    if (newQuantity <= 0) {
      positions.splice(positionIndex, 1);
    } else {
      positions[positionIndex] = {
        ...position,
        quantity: newQuantity,
        updatedAt: Date.now()
      };
    }

    this.authService.updateBalance(user.paperBalance + total);

    this._positions.set([...positions]);
    this._trades.set([...this._trades(), trade]);
    this.savePositions();
    this.saveTrades();

    return { success: true, message: `Predané ${quantity} ${asset.symbol} za ${price.toFixed(2)} USD` };
  }

  // najde poziciu podla aktiva
  getPositionByAsset(assetId: string): Position | null {
    const user = this.authService.user();
    if (!user) return null;
    return this._positions().find(
      p => p.userId === user.uid && p.assetId === assetId
    ) || null;
  }

  // vymaze vsetky data portfolia
  clearAllData(): void {
    this._positions.set([]);
    this._trades.set([]);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(POSITIONS_KEY);
      localStorage.removeItem(TRADES_KEY);
    }
  }
}
