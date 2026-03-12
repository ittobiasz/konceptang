import { Injectable, inject, signal } from '@angular/core';
import { FirebaseService, LeaderboardEntry, FirestorePosition, UserProfile } from './firebase.service';
import { PortfolioService } from './portfolio.service';
import { MarketDataService } from './market-data.service';
import { AssetQuote } from '../shared/models';
import { firstValueFrom } from 'rxjs';

// 📊 Copy trade vysledok
export interface CopyTradeResult {
  success: boolean;
  message: string;
  copiedPositions: number;
  totalInvested: number;
  skippedPositions: { symbol: string; reason: string }[];
}

// 📊 Portfolio na skopirovanie
export interface CopyablePosition {
  assetId: string;
  assetSymbol: string;
  assetName: string;
  assetType: 'crypto' | 'stock';
  originalQuantity: number;
  originalValue: number;
  allocation: number; // % z celkoveho portfolia
  selected: boolean;
  copyQuantity: number;
  copyValue: number;
}

@Injectable({
  providedIn: 'root'
})
export class LeaderboardService {
  private readonly firebaseService = inject(FirebaseService);
  private readonly portfolioService = inject(PortfolioService);
  private readonly marketDataService = inject(MarketDataService);

  private readonly _leaderboard = signal<LeaderboardEntry[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _selectedTrader = signal<UserProfile | null>(null);
  private readonly _traderPositions = signal<CopyablePosition[]>([]);

  readonly leaderboard = this._leaderboard.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly selectedTrader = this._selectedTrader.asReadonly();
  readonly traderPositions = this._traderPositions.asReadonly();

  // 🏆 Nacita leaderboard
  async loadLeaderboard(): Promise<void> {
    this._isLoading.set(true);
    
    try {
      // Skus Firebase
      const entries = await this.firebaseService.getLeaderboard(50);
      
      if (entries.length > 0) {
        this._leaderboard.set(entries);
      } else {
        // Fallback - demo data
        this._leaderboard.set(this.getDemoLeaderboard());
      }
    } catch {
      this._leaderboard.set(this.getDemoLeaderboard());
    }
    
    this._isLoading.set(false);
  }

  // 👤 Vyberie tradera na skopirovanie
  async selectTrader(uid: string): Promise<void> {
    this._isLoading.set(true);
    
    try {
      let profile: UserProfile | null = null;
      let positions: FirestorePosition[] = [];

      if (uid.startsWith('demo')) {
        // Demo traderi - pouzij lokalne data, nevolaj Firebase
        const demoTrader = this.getDemoLeaderboard().find(t => t.uid === uid);
        if (demoTrader) {
          profile = {
            uid: demoTrader.uid,
            email: `${demoTrader.displayName.toLowerCase()}@demo.com`,
            displayName: demoTrader.displayName,
            paperBalance: 100000 + demoTrader.totalPnl,
            totalPnl: demoTrader.totalPnl,
            winRate: demoTrader.winRate,
            totalTrades: demoTrader.totalTrades,
            createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
            isPublic: true
          };
        }
        positions = this.getDemoPositions(uid);
      } else {
        // Real user - nacitaj z Firebase
        profile = await this.firebaseService.getUserProfile(uid);
        if (profile) {
          positions = await this.firebaseService.getUserPositions(uid);
        }
      }
      
      this._selectedTrader.set(profile);
      
      if (profile) {
        
        // Ziskaj aktualne ceny
        const quotes = await firstValueFrom(this.marketDataService.getAllAssets());
        const quoteMap = new Map<string, AssetQuote>();
        quotes.forEach(q => quoteMap.set(q.assetId, q));
        
        // Vypocitaj hodnoty a alokacie
        let totalValue = 0;
        const positionsWithValue = positions.map(p => {
          const quote = quoteMap.get(p.assetId);
          const value = p.quantity * (quote?.price || p.averagePrice);
          totalValue += value;
          return { ...p, value, quote };
        });
        
        // Vytvor copyable positions
        const copyable: CopyablePosition[] = positionsWithValue.map(p => ({
          assetId: p.assetId,
          assetSymbol: p.assetSymbol,
          assetName: p.assetName,
          assetType: p.assetType,
          originalQuantity: p.quantity,
          originalValue: p.value,
          allocation: totalValue > 0 ? (p.value / totalValue) * 100 : 0,
          selected: true,
          copyQuantity: 0,
          copyValue: 0
        }));
        
        this._traderPositions.set(copyable);
      }
    } catch (error) {
      console.error('Failed to load trader data:', error);
    }
    
    this._isLoading.set(false);
  }

  // 📊 Prepocita copy hodnoty podla dostupneho budzetu
  calculateCopyAmounts(budget: number): CopyablePosition[] {
    const positions = this._traderPositions();
    const selectedPositions = positions.filter(p => p.selected);
    
    if (selectedPositions.length === 0 || budget <= 0) {
      return positions;
    }
    
    // Vypocitaj celkovu alokaciu vybranych pozicii
    const totalAllocation = selectedPositions.reduce((sum, p) => sum + p.allocation, 0);
    
    // Ziskaj aktualne ceny
    return positions.map(position => {
      if (!position.selected) {
        return { ...position, copyQuantity: 0, copyValue: 0 };
      }
      
      // Pomerny podiel z budzetu
      const positionBudget = (position.allocation / totalAllocation) * budget;
      
      // TODO: Ziskaj aktualnu cenu z market data
      const pricePerUnit = position.originalValue / position.originalQuantity;
      const copyQuantity = positionBudget / pricePerUnit;
      
      return {
        ...position,
        copyValue: positionBudget,
        copyQuantity: copyQuantity
      };
    });
  }

  // 📋 Skopiruje portfolio
  async copyPortfolio(positions: CopyablePosition[]): Promise<CopyTradeResult> {
    const selectedPositions = positions.filter(p => p.selected && p.copyQuantity > 0);
    
    if (selectedPositions.length === 0) {
      return {
        success: false,
        message: 'Neboli vybrané žiadne pozície na kopírovanie',
        copiedPositions: 0,
        totalInvested: 0,
        skippedPositions: []
      };
    }

    const results: { success: boolean; symbol: string; reason?: string }[] = [];
    let totalInvested = 0;
    
    // Ziskaj ceny
    const quotes = await firstValueFrom(this.marketDataService.getAllAssets());
    const quoteMap = new Map<string, AssetQuote>();
    quotes.forEach(q => quoteMap.set(q.assetId, q));

    for (const position of selectedPositions) {
      const quote = quoteMap.get(position.assetId);
      
      if (!quote) {
        results.push({ success: false, symbol: position.assetSymbol, reason: 'Cena nedostupná' });
        continue;
      }
      
      const result = this.portfolioService.buy(quote, position.copyQuantity, quote.price);
      
      if (result.success) {
        results.push({ success: true, symbol: position.assetSymbol });
        totalInvested += position.copyValue;
      } else {
        results.push({ success: false, symbol: position.assetSymbol, reason: result.message });
      }
    }

    const copiedCount = results.filter(r => r.success).length;
    const skipped = results.filter(r => !r.success).map(r => ({ symbol: r.symbol, reason: r.reason || 'Neznáma chyba' }));

    return {
      success: copiedCount > 0,
      message: copiedCount > 0 
        ? `Úspešne skopírovaných ${copiedCount} pozícií` 
        : 'Nepodarilo sa skopírovať žiadnu pozíciu',
      copiedPositions: copiedCount,
      totalInvested,
      skippedPositions: skipped
    };
  }

  // 🔄 Toggle vyber pozicie
  togglePositionSelection(assetId: string): void {
    const positions = this._traderPositions().map(p => 
      p.assetId === assetId ? { ...p, selected: !p.selected } : p
    );
    this._traderPositions.set(positions);
  }

  // ✅ Vybrat vsetky
  selectAll(): void {
    const positions = this._traderPositions().map(p => ({ ...p, selected: true }));
    this._traderPositions.set(positions);
  }

  // ❌ Odvybrat vsetky
  deselectAll(): void {
    const positions = this._traderPositions().map(p => ({ ...p, selected: false }));
    this._traderPositions.set(positions);
  }

  // 🔄 Reset vyber tradera
  clearSelection(): void {
    this._selectedTrader.set(null);
    this._traderPositions.set([]);
  }

  private getDemoLeaderboard(): LeaderboardEntry[] {
    return [
      { uid: 'demo1', displayName: 'CryptoKing', totalPnl: 45000, totalPnlPercent: 45, winRate: 72, totalTrades: 156, rank: 1 },
      { uid: 'demo2', displayName: 'BitcoinBull', totalPnl: 38500, totalPnlPercent: 38.5, winRate: 68, totalTrades: 203, rank: 2 },
      { uid: 'demo3', displayName: 'DiamondHands', totalPnl: 32000, totalPnlPercent: 32, winRate: 65, totalTrades: 89, rank: 3 },
      { uid: 'demo4', displayName: 'ETHMaxi', totalPnl: 28750, totalPnlPercent: 28.75, winRate: 63, totalTrades: 124, rank: 4 },
      { uid: 'demo5', displayName: 'TradeMaster', totalPnl: 25200, totalPnlPercent: 25.2, winRate: 61, totalTrades: 312, rank: 5 },
      { uid: 'demo6', displayName: 'HODLer', totalPnl: 22100, totalPnlPercent: 22.1, winRate: 59, totalTrades: 45, rank: 6 },
      { uid: 'demo7', displayName: 'MoonBoy', totalPnl: 19800, totalPnlPercent: 19.8, winRate: 58, totalTrades: 178, rank: 7 },
      { uid: 'demo8', displayName: 'Satoshi2024', totalPnl: 17500, totalPnlPercent: 17.5, winRate: 56, totalTrades: 234, rank: 8 },
      { uid: 'demo9', displayName: 'AltSeason', totalPnl: 15200, totalPnlPercent: 15.2, winRate: 54, totalTrades: 167, rank: 9 },
      { uid: 'demo10', displayName: 'WhaleWatcher', totalPnl: 12800, totalPnlPercent: 12.8, winRate: 52, totalTrades: 98, rank: 10 },
      { uid: 'demo11', displayName: 'DeFiWizard', totalPnl: 11500, totalPnlPercent: 11.5, winRate: 51, totalTrades: 275, rank: 11 },
      { uid: 'demo12', displayName: 'SolanaSniper', totalPnl: 10200, totalPnlPercent: 10.2, winRate: 50, totalTrades: 189, rank: 12 },
      { uid: 'demo13', displayName: 'BlockchainBoss', totalPnl: 9100, totalPnlPercent: 9.1, winRate: 49, totalTrades: 142, rank: 13 },
      { uid: 'demo14', displayName: 'TokenTrader', totalPnl: 8400, totalPnlPercent: 8.4, winRate: 48, totalTrades: 321, rank: 14 },
      { uid: 'demo15', displayName: 'CandleStick', totalPnl: 7200, totalPnlPercent: 7.2, winRate: 47, totalTrades: 256, rank: 15 },
      { uid: 'demo16', displayName: 'PumpDetector', totalPnl: 6500, totalPnlPercent: 6.5, winRate: 46, totalTrades: 198, rank: 16 },
      { uid: 'demo17', displayName: 'SwingKing', totalPnl: 5800, totalPnlPercent: 5.8, winRate: 45, totalTrades: 367, rank: 17 },
      { uid: 'demo18', displayName: 'GreenCandle', totalPnl: 4900, totalPnlPercent: 4.9, winRate: 44, totalTrades: 113, rank: 18 },
      { uid: 'demo19', displayName: 'CryptoNinja', totalPnl: 3600, totalPnlPercent: 3.6, winRate: 43, totalTrades: 87, rank: 19 },
      { uid: 'demo20', displayName: 'DCALegend', totalPnl: 2800, totalPnlPercent: 2.8, winRate: 42, totalTrades: 52, rank: 20 }
    ];
  }

  // 🎭 Demo pozicie pre traderov
  private getDemoPositions(uid: string): FirestorePosition[] {
    const now = Date.now();
    const basePosition = { id: '', userId: uid, createdAt: now - 7 * 24 * 60 * 60 * 1000, updatedAt: now };
    
    const demoPortfolios: Record<string, Partial<FirestorePosition>[]> = {
      demo1: [
        { assetId: 'bitcoin', assetSymbol: 'BTC', assetName: 'Bitcoin', assetType: 'crypto', quantity: 0.5, averagePrice: 85000 },
        { assetId: 'ethereum', assetSymbol: 'ETH', assetName: 'Ethereum', assetType: 'crypto', quantity: 8, averagePrice: 2300 },
        { assetId: 'solana', assetSymbol: 'SOL', assetName: 'Solana', assetType: 'crypto', quantity: 100, averagePrice: 150 }
      ],
      demo2: [
        { assetId: 'bitcoin', assetSymbol: 'BTC', assetName: 'Bitcoin', assetType: 'crypto', quantity: 0.8, averagePrice: 78000 },
        { assetId: 'aapl', assetSymbol: 'AAPL', assetName: 'Apple Inc.', assetType: 'stock', quantity: 50, averagePrice: 175 }
      ],
      demo3: [
        { assetId: 'bitcoin', assetSymbol: 'BTC', assetName: 'Bitcoin', assetType: 'crypto', quantity: 0.3, averagePrice: 82000 },
        { assetId: 'ethereum', assetSymbol: 'ETH', assetName: 'Ethereum', assetType: 'crypto', quantity: 5, averagePrice: 2200 },
        { assetId: 'msft', assetSymbol: 'MSFT', assetName: 'Microsoft', assetType: 'stock', quantity: 30, averagePrice: 380 },
        { assetId: 'nvda', assetSymbol: 'NVDA', assetName: 'NVIDIA', assetType: 'stock', quantity: 20, averagePrice: 450 }
      ],
      demo4: [
        { assetId: 'ethereum', assetSymbol: 'ETH', assetName: 'Ethereum', assetType: 'crypto', quantity: 25, averagePrice: 2100 },
        { assetId: 'solana', assetSymbol: 'SOL', assetName: 'Solana', assetType: 'crypto', quantity: 80, averagePrice: 140 }
      ],
      demo5: [
        { assetId: 'bitcoin', assetSymbol: 'BTC', assetName: 'Bitcoin', assetType: 'crypto', quantity: 0.25, averagePrice: 88000 },
        { assetId: 'googl', assetSymbol: 'GOOGL', assetName: 'Alphabet', assetType: 'stock', quantity: 100, averagePrice: 140 },
        { assetId: 'tsla', assetSymbol: 'TSLA', assetName: 'Tesla', assetType: 'stock', quantity: 40, averagePrice: 250 }
      ],
      demo6: [
        { assetId: 'bitcoin', assetSymbol: 'BTC', assetName: 'Bitcoin', assetType: 'crypto', quantity: 0.6, averagePrice: 80000 },
        { assetId: 'cardano', assetSymbol: 'ADA', assetName: 'Cardano', assetType: 'crypto', quantity: 5000, averagePrice: 0.45 }
      ],
      demo7: [
        { assetId: 'solana', assetSymbol: 'SOL', assetName: 'Solana', assetType: 'crypto', quantity: 150, averagePrice: 120 },
        { assetId: 'dogecoin', assetSymbol: 'DOGE', assetName: 'Dogecoin', assetType: 'crypto', quantity: 50000, averagePrice: 0.15 }
      ],
      demo8: [
        { assetId: 'bitcoin', assetSymbol: 'BTC', assetName: 'Bitcoin', assetType: 'crypto', quantity: 0.4, averagePrice: 86000 },
        { assetId: 'ethereum', assetSymbol: 'ETH', assetName: 'Ethereum', assetType: 'crypto', quantity: 10, averagePrice: 2250 },
        { assetId: 'ripple', assetSymbol: 'XRP', assetName: 'XRP', assetType: 'crypto', quantity: 3000, averagePrice: 0.55 }
      ],
      demo9: [
        { assetId: 'polkadot', assetSymbol: 'DOT', assetName: 'Polkadot', assetType: 'crypto', quantity: 500, averagePrice: 6.5 },
        { assetId: 'avalanche-2', assetSymbol: 'AVAX', assetName: 'Avalanche', assetType: 'crypto', quantity: 200, averagePrice: 30 },
        { assetId: 'chainlink', assetSymbol: 'LINK', assetName: 'Chainlink', assetType: 'crypto', quantity: 300, averagePrice: 14 }
      ],
      demo10: [
        { assetId: 'bitcoin', assetSymbol: 'BTC', assetName: 'Bitcoin', assetType: 'crypto', quantity: 0.35, averagePrice: 90000 },
        { assetId: 'aapl', assetSymbol: 'AAPL', assetName: 'Apple Inc.', assetType: 'stock', quantity: 30, averagePrice: 185 },
        { assetId: 'amzn', assetSymbol: 'AMZN', assetName: 'Amazon', assetType: 'stock', quantity: 20, averagePrice: 170 }
      ],
      demo11: [
        { assetId: 'ethereum', assetSymbol: 'ETH', assetName: 'Ethereum', assetType: 'crypto', quantity: 15, averagePrice: 2400 },
        { assetId: 'uniswap', assetSymbol: 'UNI', assetName: 'Uniswap', assetType: 'crypto', quantity: 800, averagePrice: 8 }
      ],
      demo12: [
        { assetId: 'solana', assetSymbol: 'SOL', assetName: 'Solana', assetType: 'crypto', quantity: 200, averagePrice: 130 },
        { assetId: 'bitcoin', assetSymbol: 'BTC', assetName: 'Bitcoin', assetType: 'crypto', quantity: 0.15, averagePrice: 92000 }
      ],
      demo13: [
        { assetId: 'bitcoin', assetSymbol: 'BTC', assetName: 'Bitcoin', assetType: 'crypto', quantity: 0.2, averagePrice: 85000 },
        { assetId: 'ethereum', assetSymbol: 'ETH', assetName: 'Ethereum', assetType: 'crypto', quantity: 6, averagePrice: 2300 },
        { assetId: 'msft', assetSymbol: 'MSFT', assetName: 'Microsoft', assetType: 'stock', quantity: 15, averagePrice: 400 }
      ],
      demo14: [
        { assetId: 'dogecoin', assetSymbol: 'DOGE', assetName: 'Dogecoin', assetType: 'crypto', quantity: 100000, averagePrice: 0.12 },
        { assetId: 'ripple', assetSymbol: 'XRP', assetName: 'XRP', assetType: 'crypto', quantity: 5000, averagePrice: 0.50 },
        { assetId: 'cardano', assetSymbol: 'ADA', assetName: 'Cardano', assetType: 'crypto', quantity: 8000, averagePrice: 0.40 }
      ],
      demo15: [
        { assetId: 'nvda', assetSymbol: 'NVDA', assetName: 'NVIDIA', assetType: 'stock', quantity: 25, averagePrice: 480 },
        { assetId: 'tsla', assetSymbol: 'TSLA', assetName: 'Tesla', assetType: 'stock', quantity: 30, averagePrice: 260 },
        { assetId: 'bitcoin', assetSymbol: 'BTC', assetName: 'Bitcoin', assetType: 'crypto', quantity: 0.1, averagePrice: 88000 }
      ],
      demo16: [
        { assetId: 'solana', assetSymbol: 'SOL', assetName: 'Solana', assetType: 'crypto', quantity: 120, averagePrice: 145 },
        { assetId: 'avalanche-2', assetSymbol: 'AVAX', assetName: 'Avalanche', assetType: 'crypto', quantity: 150, averagePrice: 32 }
      ],
      demo17: [
        { assetId: 'bitcoin', assetSymbol: 'BTC', assetName: 'Bitcoin', assetType: 'crypto', quantity: 0.3, averagePrice: 87000 },
        { assetId: 'googl', assetSymbol: 'GOOGL', assetName: 'Alphabet', assetType: 'stock', quantity: 50, averagePrice: 150 }
      ],
      demo18: [
        { assetId: 'ethereum', assetSymbol: 'ETH', assetName: 'Ethereum', assetType: 'crypto', quantity: 8, averagePrice: 2350 },
        { assetId: 'chainlink', assetSymbol: 'LINK', assetName: 'Chainlink', assetType: 'crypto', quantity: 400, averagePrice: 13 }
      ],
      demo19: [
        { assetId: 'bitcoin', assetSymbol: 'BTC', assetName: 'Bitcoin', assetType: 'crypto', quantity: 0.18, averagePrice: 91000 },
        { assetId: 'solana', assetSymbol: 'SOL', assetName: 'Solana', assetType: 'crypto', quantity: 60, averagePrice: 155 },
        { assetId: 'aapl', assetSymbol: 'AAPL', assetName: 'Apple Inc.', assetType: 'stock', quantity: 20, averagePrice: 190 }
      ],
      demo20: [
        { assetId: 'bitcoin', assetSymbol: 'BTC', assetName: 'Bitcoin', assetType: 'crypto', quantity: 0.45, averagePrice: 82000 },
        { assetId: 'ethereum', assetSymbol: 'ETH', assetName: 'Ethereum', assetType: 'crypto', quantity: 4, averagePrice: 2200 }
      ]
    };

    const portfolioData = demoPortfolios[uid] || [
      { assetId: 'bitcoin', assetSymbol: 'BTC', assetName: 'Bitcoin', assetType: 'crypto' as const, quantity: 0.2, averagePrice: 90000 },
      { assetId: 'ethereum', assetSymbol: 'ETH', assetName: 'Ethereum', assetType: 'crypto' as const, quantity: 3, averagePrice: 2400 },
      { assetId: 'aapl', assetSymbol: 'AAPL', assetName: 'Apple Inc.', assetType: 'stock' as const, quantity: 25, averagePrice: 180 }
    ];

    return portfolioData.map((p, index) => ({
      ...basePosition,
      id: `${uid}-pos-${index}`,
      assetId: p.assetId!,
      assetSymbol: p.assetSymbol!,
      assetName: p.assetName!,
      assetType: p.assetType as 'crypto' | 'stock',
      quantity: p.quantity!,
      averagePrice: p.averagePrice!
    }));
  }
}
