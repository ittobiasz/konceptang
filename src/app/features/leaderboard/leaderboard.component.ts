import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LeaderboardService, CopyablePosition } from '../../core/leaderboard.service';
import { CurrencyService, AuthService } from '../../core';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="leaderboard-page">
      <div class="container">
        <header class="page-header">
          <h1>Leaderboard</h1>
          <p>Top traderi podľa celkového zisku</p>
        </header>

        @if (leaderboardService.isLoading()) {
          <div class="loading">
            <div class="spinner"></div>
            <p>Načítavam rebríček...</p>
          </div>
        } @else {
          <!-- Leaderboard tabuľka -->
          @if (!selectedTrader()) {
            <div class="leaderboard-table">
              <div class="table-header">
                <span class="rank">Rank</span>
                <span class="name">Trader</span>
                <span class="pnl">Zisk</span>
                <span class="pnl-percent">%</span>
                <span class="win-rate">Win Rate</span>
                <span class="trades">Obchody</span>
                <span class="actions">Akcia</span>
              </div>
              
              @for (trader of leaderboardService.leaderboard(); track trader.uid) {
                <div class="table-row" [class.top3]="trader.rank <= 3">
                  <span class="rank">
                    @if (trader.rank === 1) { 🥇 }
                    @else if (trader.rank === 2) { 🥈 }
                    @else if (trader.rank === 3) { 🥉 }
                    @else { {{ trader.rank }} }
                  </span>
                  <span class="name">
                    <span class="avatar">{{ trader.displayName.charAt(0) }}</span>
                    {{ trader.displayName }}
                  </span>
                  <span class="pnl" [class.positive]="trader.totalPnl >= 0" [class.negative]="trader.totalPnl < 0">
                    {{ currencyService.format(trader.totalPnl) }}
                  </span>
                  <span class="pnl-percent" [class.positive]="trader.totalPnlPercent >= 0" [class.negative]="trader.totalPnlPercent < 0">
                    {{ trader.totalPnlPercent >= 0 ? '+' : '' }}{{ trader.totalPnlPercent.toFixed(1) }}%
                  </span>
                  <span class="win-rate">{{ trader.winRate }}%</span>
                  <span class="trades">{{ trader.totalTrades }}</span>
                  <span class="actions">
                    <button class="btn-copy" (click)="selectTrader(trader.uid)">
                      📋 Kopírovať
                    </button>
                  </span>
                </div>
              }
            </div>
          } @else {
            <!-- Copy Trading Modal -->
            <div class="copy-trading-modal">
              <div class="modal-header">
                <h2>📋 Kopírovať portfólio</h2>
                <button class="btn-close" (click)="closeCopyModal()">✕</button>
              </div>
              
              <div class="trader-info">
                <div class="trader-avatar">{{ selectedTrader()!.displayName.charAt(0) }}</div>
                <div class="trader-details">
                  <h3>{{ selectedTrader()!.displayName }}</h3>
                  <p>Celkový zisk: {{ currencyService.format(selectedTrader()!.totalPnl) }}</p>
                </div>
              </div>

              <div class="budget-section">
                <label>Koľko chceš investovať?</label>
                <div class="budget-input">
                  <span class="currency">$</span>
                  <input 
                    type="number" 
                    [(ngModel)]="copyBudget" 
                    (ngModelChange)="recalculateCopy()"
                    [max]="authService.getBalance()"
                    min="1"
                  />
                  <span class="max-budget">Max: {{ currencyService.format(authService.getBalance()) }}</span>
                </div>
              </div>

              <div class="positions-section">
                <div class="section-header">
                  <h4>Pozície na skopírovanie</h4>
                  <div class="select-actions">
                    <button (click)="leaderboardService.selectAll()">Vybrať všetky</button>
                    <button (click)="leaderboardService.deselectAll()">Zrušiť výber</button>
                  </div>
                </div>
                
                <div class="positions-list">
                  @for (position of calculatedPositions(); track position.assetId) {
                    <div class="position-item" [class.selected]="position.selected">
                      <label class="checkbox-wrapper">
                        <input 
                          type="checkbox" 
                          [checked]="position.selected"
                          (change)="togglePosition(position.assetId)"
                        />
                        <span class="checkmark"></span>
                      </label>
                      <div class="position-info">
                        <span class="symbol">{{ position.assetSymbol }}</span>
                        <span class="name">{{ position.assetName }}</span>
                      </div>
                      <div class="position-allocation">
                        <span>{{ position.allocation.toFixed(1) }}%</span>
                      </div>
                      <div class="position-copy-value">
                        @if (position.selected && position.copyValue > 0) {
                          <span class="copy-amount">{{ currencyService.format(position.copyValue) }}</span>
                          <span class="copy-quantity">{{ position.copyQuantity.toFixed(4) }} ks</span>
                        } @else {
                          <span class="not-selected">-</span>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>

              <div class="copy-summary">
                <div class="summary-row">
                  <span>Vybrané pozície:</span>
                  <span>{{ selectedCount() }}</span>
                </div>
                <div class="summary-row">
                  <span>Celková investícia:</span>
                  <span>{{ currencyService.format(totalCopyValue()) }}</span>
                </div>
              </div>

              <div class="modal-actions">
                <button class="btn-secondary" (click)="closeCopyModal()">Zrušiť</button>
                <button 
                  class="btn-primary" 
                  [disabled]="selectedCount() === 0 || copyBudget <= 0"
                  (click)="executeCopy()">
                  Kopírovať portfólio
                </button>
              </div>

              @if (copyResult()) {
                <div class="copy-result" [class.success]="copyResult()!.success" [class.error]="!copyResult()!.success">
                  {{ copyResult()!.message }}
                </div>
              }
            </div>
          }
        }
      </div>
    </main>
  `,
  styleUrl: './leaderboard.component.scss'
})
export class LeaderboardComponent implements OnInit {
  readonly leaderboardService = inject(LeaderboardService);
  readonly currencyService = inject(CurrencyService);
  readonly authService = inject(AuthService);

  readonly selectedTrader = this.leaderboardService.selectedTrader;
  readonly calculatedPositions = signal<CopyablePosition[]>([]);
  readonly copyResult = signal<{ success: boolean; message: string } | null>(null);
  
  copyBudget = 1000;

  ngOnInit(): void {
    this.leaderboardService.loadLeaderboard();
  }

  selectTrader(uid: string): void {
    this.leaderboardService.selectTrader(uid).then(() => {
      this.recalculateCopy();
    });
  }

  closeCopyModal(): void {
    this.leaderboardService.clearSelection();
    this.copyResult.set(null);
  }

  recalculateCopy(): void {
    const positions = this.leaderboardService.calculateCopyAmounts(this.copyBudget);
    this.calculatedPositions.set(positions);
  }

  togglePosition(assetId: string): void {
    this.leaderboardService.togglePositionSelection(assetId);
    this.recalculateCopy();
  }

  selectedCount(): number {
    return this.calculatedPositions().filter(p => p.selected).length;
  }

  totalCopyValue(): number {
    return this.calculatedPositions()
      .filter(p => p.selected)
      .reduce((sum, p) => sum + p.copyValue, 0);
  }

  async executeCopy(): Promise<void> {
    const result = await this.leaderboardService.copyPortfolio(this.calculatedPositions());
    this.copyResult.set(result);
    
    if (result.success) {
      setTimeout(() => {
        this.closeCopyModal();
      }, 2000);
    }
  }
}
