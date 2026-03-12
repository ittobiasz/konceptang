import { 
  Component, 
  Input, 
  OnInit, 
  OnDestroy, 
  ElementRef, 
  ViewChild, 
  AfterViewInit,
  inject,
  signal,
  effect,
  PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChartDataService, CandlestickData, TimeRange } from '../../core/chart-data.service';
import { CurrencyService } from '../../core/currency.service';

@Component({
  selector: 'app-price-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-container">
      <div class="chart-header">
        <div class="time-range-selector">
          @for (range of timeRanges; track range) {
            <button 
              [class.active]="selectedRange() === range"
              (click)="changeRange(range)">
              {{ range }}
            </button>
          }
        </div>
      </div>
      
      <div class="chart-wrapper" #chartContainer>
        @if (isLoading()) {
          <div class="loading">
            <div class="spinner"></div>
            <span>Loading chart...</span>
          </div>
        }
      </div>
      
      <div class="chart-legend">
        <span class="legend-item">
          <span class="dot green"></span> Up
        </span>
        <span class="legend-item">
          <span class="dot red"></span> Down
        </span>
      </div>
    </div>
  `,
  styles: [`
    .chart-container {
      background: var(--card-bg, #1a1a1a);
      border-radius: 12px;
      padding: 1rem;
      border: 1px solid var(--border-color, #2a2a2a);
    }
    
    .chart-header {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      margin-bottom: 1rem;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    
    .time-range-selector {
      display: flex;
      gap: 0.25rem;
      background: var(--bg-secondary, #0f0f0f);
      padding: 0.25rem;
      border-radius: 8px;
    }
    
    .time-range-selector button {
      padding: 0.4rem 0.75rem;
      border: none;
      background: transparent;
      color: var(--text-secondary, #888);
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      transition: all 0.2s;
    }
    
    .time-range-selector button:hover {
      background: var(--card-bg, #1a1a1a);
    }
    
    .time-range-selector button.active {
      background: #10b981;
      color: white;
    }
    
    .chart-wrapper {
      height: 300px;
      position: relative;
      min-height: 200px;
    }
    
    .loading {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      color: var(--text-secondary, #888);
    }
    
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--border-color, #2a2a2a);
      border-top-color: #10b981;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .chart-legend {
      display: flex;
      justify-content: center;
      gap: 1.5rem;
      margin-top: 0.75rem;
      font-size: 0.85rem;
      color: var(--text-secondary, #888);
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    
    .dot.green { background: #10b981; }
    .dot.red { background: #ef4444; }
    
    @media (max-width: 600px) {
      .chart-header {
        flex-direction: column;
        align-items: flex-start;
      }
      
      .chart-wrapper {
        height: 250px;
      }
    }
  `]
})
export class PriceChartComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() assetId!: string;
  @Input() assetType: 'crypto' | 'stock' = 'crypto';
  @Input() symbol?: string;
  
  @ViewChild('chartContainer') chartContainer!: ElementRef;
  
  private readonly platformId = inject(PLATFORM_ID);
  private readonly chartDataService = inject(ChartDataService);
  readonly currencyService = inject(CurrencyService);
  
  private chart: any = null;
  private candlestickSeries: any = null;
  
  readonly timeRanges: TimeRange[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];
  readonly selectedRange = signal<TimeRange>('1M');
  readonly isLoading = signal(true);
  
  private chartData: CandlestickData[] = [];

  ngOnInit(): void {
    // Chart data loaded after view init
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        this.initChart().then(() => this.loadData()).catch(err => {
          console.error('Chart init failed:', err);
          this.isLoading.set(false);
        });
      }, 100);
    }
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.remove();
    }
  }

  // Chart initialization
  private async initChart(): Promise<void> {
    // Dynamicky import lightweight-charts
    const { createChart, ColorType } = await import('lightweight-charts');
    
    const container = this.chartContainer.nativeElement;
    
    this.chart = createChart(container, {
      width: container.clientWidth,
      height: 300,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#888'
      },
      grid: {
        vertLines: { color: 'rgba(42, 42, 42, 0.5)' },
        horzLines: { color: 'rgba(42, 42, 42, 0.5)' }
      },
      crosshair: {
        mode: 0
      },
      rightPriceScale: {
        borderColor: '#2a2a2a'
      },
      timeScale: {
        borderColor: '#2a2a2a',
        timeVisible: true,
        secondsVisible: false
      }
    });
    
    this.candlestickSeries = this.chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444'
    });
    
    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (this.chart) {
        this.chart.applyOptions({ width: container.clientWidth });
      }
    });
    resizeObserver.observe(container);
  }

  // Load chart data
  loadData(): void {
    this.isLoading.set(true);
    
    const observable = this.assetType === 'crypto'
      ? this.chartDataService.getCryptoHistory(this.assetId, this.selectedRange())
      : this.chartDataService.getStockHistory(this.symbol || this.assetId, this.selectedRange());
    
    observable.subscribe(data => {
      this.chartData = data;
      this.updateChart(data);
      this.isLoading.set(false);
    });
  }

  // Update chart with new data
  private updateChart(data: CandlestickData[]): void {
    if (this.candlestickSeries && data.length > 0) {
      this.candlestickSeries.setData(data);
      this.chart.timeScale().fitContent();
    }
  }

  // Change time range
  changeRange(range: TimeRange): void {
    this.selectedRange.set(range);
    this.loadData();
  }
}
