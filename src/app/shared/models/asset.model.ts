export interface AssetQuote {
  assetId: string;
  symbol: string;
  name: string;
  assetType: 'crypto' | 'stock';
  price: number;
  change24h?: number;
  changePercent24h?: number;
  volume24h?: number;
  marketCap?: number;
  image?: string;
}

export interface CryptoAsset {
  id: string;
  rank: string;
  symbol: string;
  name: string;
  supply: string;
  maxSupply: string | null;
  marketCapUsd: string;
  volumeUsd24Hr: string;
  priceUsd: string;
  changePercent24Hr: string;
  vwap24Hr: string;
}

export interface StockAsset {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
}

export interface CoinCapResponse<T> {
  data: T;
  timestamp: number;
}

export interface FinnhubQuote {
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
}
