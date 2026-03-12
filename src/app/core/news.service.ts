import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of, shareReplay, timeout } from 'rxjs';

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  imageUrl?: string;
  publishedAt: number;
  category: 'crypto' | 'stocks' | 'general';
  sentiment?: 'positive' | 'negative' | 'neutral';
  relatedAssets?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class NewsService {
  private readonly http = inject(HttpClient);
  
  private readonly _news = signal<NewsArticle[]>([]);
  private readonly _isLoading = signal(false);
  
  readonly news = this._news.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  loadNews(): void {
    this._isLoading.set(true);
    
    // Okamzite zobraz fallback, potom skus API
    if (this._news().length === 0) {
      this._news.set(this.getFallbackNews());
    }

    this.fetchCryptoNews().subscribe(articles => {
      if (articles.length > 0) {
        this._news.set(articles);
      }
      this._isLoading.set(false);
    });
  }

  private fetchCryptoNews(): Observable<NewsArticle[]> {
    const url = 'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=popular';
    
    return this.http.get<any>(url).pipe(
      timeout(8000),
      map(response => {
        if (response?.Data && Array.isArray(response.Data) && response.Data.length > 0) {
          return response.Data.slice(0, 30).map((item: any) => this.mapToArticle(item));
        }
        return this.getFallbackNews();
      }),
      catchError(() => of(this.getFallbackNews())),
      shareReplay(1)
    );
  }

  // 🔄 Mapovanie API response na nas format
  private mapToArticle(item: any): NewsArticle {
    return {
      id: item.id || `news-${Date.now()}-${Math.random()}`,
      title: item.title || 'No title',
      summary: item.body?.slice(0, 200) + '...' || item.title,
      source: item.source_info?.name || item.source || 'Unknown',
      url: item.url || item.guid || '#',
      imageUrl: item.imageurl || item.image_url,
      publishedAt: (item.published_on || Date.now() / 1000) * 1000,
      category: 'crypto',
      sentiment: this.analyzeSentiment(item.title + ' ' + (item.body || '')),
      relatedAssets: this.extractAssets(item.title + ' ' + (item.body || ''))
    };
  }

  // 📊 Jednoducha sentiment analyza
  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['surge', 'rally', 'bullish', 'gain', 'rise', 'soar', 'pump', 'moon', 'ath', 'record', 'grow', 'profit'];
    const negativeWords = ['crash', 'dump', 'bearish', 'fall', 'drop', 'plunge', 'sink', 'loss', 'fear', 'sell', 'decline', 'hack'];
    
    const lowerText = text.toLowerCase();
    let score = 0;
    
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) score++;
    });
    
    negativeWords.forEach(word => {
      if (lowerText.includes(word)) score--;
    });
    
    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  }

  // 🔍 Extrakcia relevantnych aktiv z textu
  private extractAssets(text: string): string[] {
    const assets: string[] = [];
    const assetKeywords: Record<string, string> = {
      'bitcoin': 'bitcoin',
      'btc': 'bitcoin',
      'ethereum': 'ethereum',
      'eth': 'ethereum',
      'solana': 'solana',
      'sol': 'solana',
      'xrp': 'ripple',
      'ripple': 'ripple',
      'dogecoin': 'dogecoin',
      'doge': 'dogecoin',
      'cardano': 'cardano',
      'ada': 'cardano'
    };
    
    const lowerText = text.toLowerCase();
    
    Object.entries(assetKeywords).forEach(([keyword, assetId]) => {
      if (lowerText.includes(keyword) && !assets.includes(assetId)) {
        assets.push(assetId);
      }
    });
    
    return assets;
  }

  private getFallbackNews(): NewsArticle[] {
    const now = Date.now();
    const h = 3600000;
    return [
      { id: 'f1', title: 'Bitcoin dosiahol novú mesačnú high nad $98,000', summary: 'Bitcoin pokračuje v rally a približuje sa k psychologickej hranici $100,000. Analytici predpovedajú pokračovanie býčieho trendu vďaka inštitucionálnemu záujmu.', source: 'CoinDesk', url: 'https://www.coindesk.com/markets/bitcoin/', publishedAt: now - 2 * h, category: 'crypto', sentiment: 'positive', relatedAssets: ['bitcoin'] },
      { id: 'f2', title: 'Ethereum 2.0 staking dosahuje rekordné čísla', summary: 'Počet stakovaného ETH prekonal 30 miliónov, čo predstavuje takmer 25% celkovej ponuky Etherea. Sieť je stabilnejšia ako kedykoľvek predtým.', source: 'CoinTelegraph', url: 'https://cointelegraph.com/tags/ethereum', publishedAt: now - 4 * h, category: 'crypto', sentiment: 'positive', relatedAssets: ['ethereum'] },
      { id: 'f3', title: 'SEC odkladá rozhodnutie o Solana ETF', summary: 'Americká SEC opäť posunula termín rozhodnutia o prvom Solana spot ETF. Trh reagoval pokojne, Solana si udržiava pozíciu.', source: 'CoinDesk', url: 'https://www.coindesk.com/policy/', publishedAt: now - 6 * h, category: 'crypto', sentiment: 'neutral', relatedAssets: ['solana'] },
      { id: 'f4', title: 'NVIDIA prekonala očakávania analytikov', summary: 'Akcie NVIDIA vzrástli o 8% po zverejnení štvrťročných výsledkov, ktoré výrazne prekonali odhady Wall Street.', source: 'Reuters', url: 'https://www.reuters.com/technology/nvidia/', publishedAt: now - 8 * h, category: 'stocks', sentiment: 'positive' },
      { id: 'f5', title: 'XRP vyhralo ďalší súdny spor s SEC', summary: 'Ripple Labs zaznamenalo ďalšie víťazstvo v pokračujúcom súdnom spore, cena XRP vzrástla o 12%.', source: 'CoinTelegraph', url: 'https://cointelegraph.com/tags/ripple', publishedAt: now - 10 * h, category: 'crypto', sentiment: 'positive', relatedAssets: ['ripple'] },
      { id: 'f6', title: 'Fed signalizuje možné zníženie úrokových sadzieb', summary: 'Predseda FED naznačil možnosť zníženia úrokových sadzieb v druhej polovici roka. Akciové trhy reagovali pozitívne.', source: 'Reuters', url: 'https://www.reuters.com/markets/us/', publishedAt: now - 12 * h, category: 'general', sentiment: 'positive' },
      { id: 'f7', title: 'Dogecoin rally po tweete Elona Muska', summary: 'DOGE zaznamenal 15% nárast po tom, čo Elon Musk opäť spomenul "psa" na sociálnych sieťach.', source: 'CoinDesk', url: 'https://www.coindesk.com/markets/dogecoin/', publishedAt: now - 14 * h, category: 'crypto', sentiment: 'positive', relatedAssets: ['dogecoin'] },
      { id: 'f8', title: 'Apple predstavil nový Vision Pro 2', summary: 'Apple odhalil druhú generáciu svojho VR/AR headsetu s vylepšeným výkonom a nižšou cenou. Akcie vzrástli o 3%.', source: 'Bloomberg', url: 'https://www.bloomberg.com/quote/AAPL:US', publishedAt: now - 16 * h, category: 'stocks', sentiment: 'positive' },
      { id: 'f9', title: 'Cardano spúšťa Hydra scaling riešenie', summary: 'Cardano úspešne nasadilo Hydra upgrade, ktorý dramaticky zvyšuje priepustnosť transakcií. ADA vzrástla o 8%.', source: 'CoinTelegraph', url: 'https://cointelegraph.com/tags/cardano', publishedAt: now - 18 * h, category: 'crypto', sentiment: 'positive', relatedAssets: ['cardano'] },
      { id: 'f10', title: 'Tesla dodávky prekonali prognózy', summary: 'Tesla oznámila rekordné dodávky vozidiel v poslednom štvrťroku, akcie stúpli o 5% v predburzovom obchodovaní.', source: 'Reuters', url: 'https://www.reuters.com/business/autos-transportation/tesla/', publishedAt: now - 20 * h, category: 'stocks', sentiment: 'positive' },
      { id: 'f11', title: 'Polkadot ohlasuje parachain aukcie pre Q3', summary: 'Polkadot plánuje novú vlnu parachain aukcií. Komunita očakáva zvýšený záujem a nové projekty v ekosystéme.', source: 'CoinDesk', url: 'https://www.coindesk.com/tags/polkadot/', publishedAt: now - 22 * h, category: 'crypto', sentiment: 'neutral', relatedAssets: ['polkadot'] },
      { id: 'f12', title: 'Čínska centrálna banka uvoľňuje menovú politiku', summary: 'PBoC znížila úrokové sadzby o 25 bázických bodov. Globálne trhy reagujú pozitívne na stimulačné opatrenia.', source: 'Bloomberg', url: 'https://www.bloomberg.com/markets/economics', publishedAt: now - 24 * h, category: 'general', sentiment: 'positive' },
      { id: 'f13', title: 'Solana DeFi TVL prekročilo $15 miliárd', summary: 'Celková uzamknutá hodnota v Solana DeFi ekosystéme dosiahla historické maximum. Raydium a Jupiter vedú rebríček.', source: 'CoinTelegraph', url: 'https://cointelegraph.com/tags/solana', publishedAt: now - 26 * h, category: 'crypto', sentiment: 'positive', relatedAssets: ['solana'] },
      { id: 'f14', title: 'Microsoft investuje $10 miliárd do AI infraštruktúry', summary: 'Microsoft oznamuje masívnu investíciu do dátových centier pre AI. Partnerstvo s OpenAI sa rozširuje.', source: 'Reuters', url: 'https://www.reuters.com/technology/artificial-intelligence/', publishedAt: now - 28 * h, category: 'stocks', sentiment: 'positive' },
      { id: 'f15', title: 'Bitcoin dominancia klesá pod 50%', summary: 'Kryptotrh zažíva alt-season. Bitcoin dominancia klesla pod 50% prvýkrát od roku 2024 vďaka rastu altcoinov.', source: 'CoinDesk', url: 'https://www.coindesk.com/markets/', publishedAt: now - 30 * h, category: 'crypto', sentiment: 'neutral', relatedAssets: ['bitcoin'] },
    ];
  }

  // 🔄 Filtruj novinky podla kategorie
  getNewsByCategory(category: 'crypto' | 'stocks' | 'general' | 'all'): NewsArticle[] {
    if (category === 'all') return this._news();
    return this._news().filter(n => n.category === category);
  }

  // 🔄 Filtruj novinky podla aktiva
  getNewsByAsset(assetId: string): NewsArticle[] {
    return this._news().filter(n => n.relatedAssets?.includes(assetId));
  }

  // ⏰ Formatuj cas
  formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return 'práve teraz';
    if (seconds < 3600) return `pred ${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `pred ${Math.floor(seconds / 3600)} hod`;
    if (seconds < 604800) return `pred ${Math.floor(seconds / 86400)} dňami`;
    return new Date(timestamp).toLocaleDateString('sk-SK');
  }
}
