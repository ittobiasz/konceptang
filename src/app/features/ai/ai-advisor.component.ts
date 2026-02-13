import { Component, inject, signal, OnInit, ChangeDetectionStrategy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AiAdvisorService, PortfolioService, MarketDataService, CurrencyService } from '../../core';
import { AiInsight, ChatMessage, PositionWithQuote, AssetQuote } from '../../shared/models';

@Component({
  selector: 'app-ai-advisor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ai-advisor.component.html',
  styleUrl: './ai-advisor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiAdvisorComponent implements OnInit {
  @ViewChild('chatContainer') chatContainer!: ElementRef;

  private readonly aiService = inject(AiAdvisorService);
  private readonly portfolioService = inject(PortfolioService);
  private readonly marketDataService = inject(MarketDataService);
  readonly currencyService = inject(CurrencyService);

  readonly isLoading = this.aiService.isLoading;
  readonly insight = signal<AiInsight | null>(null);
  readonly chatHistory = this.aiService.chatHistory;
  readonly chatInput = signal('');
  readonly activeTab = signal<'analysis' | 'chat'>('analysis');
  readonly positions = signal<PositionWithQuote[]>([]);
  readonly isAnalyzing = signal(false);

  private quotes = new Map<string, AssetQuote>();

  ngOnInit(): void {
    this.loadPortfolioData();
  }

  // nacita data portfolia
  private loadPortfolioData(): void {
    this.marketDataService.getAllAssets().subscribe(assets => {
      assets.forEach(a => this.quotes.set(a.assetId, a));
      const snapshot = this.portfolioService.getPortfolioSnapshot(this.quotes);
      this.positions.set(snapshot.positions);
      
      const lastInsight = this.aiService.lastInsight();
      if (lastInsight) {
        this.insight.set(lastInsight);
      }
    });
  }

  // prepne aktivny tab
  setActiveTab(tab: 'analysis' | 'chat'): void {
    this.activeTab.set(tab);
  }

  // spusti AI analyzu portfolia
  async analyzePortfolio(): Promise<void> {
    this.isAnalyzing.set(true);
    const snapshot = this.portfolioService.getPortfolioSnapshot(this.quotes);
    
    try {
      const result = await this.aiService.analyzePortfolio(
        snapshot.positions,
        snapshot.totalValue,
        snapshot.cashBalance
      );
      this.insight.set(result);
    } finally {
      this.isAnalyzing.set(false);
    }
  }

  // posle spravu do chatu
  async sendMessage(): Promise<void> {
    const message = this.chatInput().trim();
    if (!message) return;

    this.chatInput.set('');
    
    const snapshot = this.portfolioService.getPortfolioSnapshot(this.quotes);
    let context = '';
    if (snapshot.positions.length > 0) {
      context = `Pozície: ${snapshot.positions.map(p => 
        `${p.assetSymbol} (${p.quantity} ks, P&L: ${p.pnlPercent.toFixed(1)}%)`
      ).join(', ')}. Celková hodnota: $${snapshot.totalValue.toFixed(2)}, Hotovosť: $${snapshot.cashBalance.toFixed(2)}`;
    } else {
      context = `Prázdne portfólio, hotovosť: $${snapshot.cashBalance.toFixed(2)}`;
    }

    await this.aiService.chat(message, context);
    
    setTimeout(() => {
      if (this.chatContainer) {
        this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }

  // vymaze historiu chatu
  clearChat(): void {
    this.aiService.clearChatHistory();
  }

  // spracuje stlacenie klavesy
  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // vrati farbu rizika
  getRiskColor(score: number): string {
    if (score <= 3) return '#10b981';
    if (score <= 6) return '#f59e0b';
    return '#ef4444';
  }

  // vrati farbu diverzifikacie
  getDiversificationColor(score: number): string {
    if (score >= 7) return '#10b981';
    if (score >= 4) return '#f59e0b';
    return '#ef4444';
  }

  getRiskLabel(score: number): string {
    if (score <= 3) return 'Nízke';
    if (score <= 6) return 'Stredné';
    return 'Vysoké';
  }

  getDiversificationLabel(score: number): string {
    if (score >= 7) return 'Výborná';
    if (score >= 4) return 'Priemerná';
    return 'Slabá';
  }

  formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString('sk-SK', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
