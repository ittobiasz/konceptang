import { AssetQuote } from './asset.model';

export interface Position {
  id: string;
  userId: string;
  assetId: string;
  assetSymbol: string;
  assetName: string;
  assetType: 'crypto' | 'stock';
  quantity: number;
  averagePrice: number;
  createdAt: number;
  updatedAt: number;
}

export interface PositionWithQuote extends Position {
  currentPrice: number;
  quote?: AssetQuote;
  marketValue: number;
  totalCost: number;
  pnl: number;
  pnlPercent: number;
}

export interface Trade {
  id: string;
  userId: string;
  assetId: string;
  assetSymbol: string;
  assetName: string;
  assetType: 'crypto' | 'stock';
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
  timestamp: number;
}

export interface PortfolioSnapshot {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPercent: number;
  cashBalance: number;
  totalEquity: number;
  positions: PositionWithQuote[];
}
