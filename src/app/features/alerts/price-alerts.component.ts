import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PriceAlertService } from '../../core/price-alert.service';
import { MarketDataService } from '../../core/market-data.service';
import { PriceAlert } from '../../core/firebase.service';

/**
 * Component for managing price alerts with optional auto-trade functionality.
 * Users can create alerts for specific price targets and get notifications
 * or automatic trades when conditions are met.
 */
@Component({
  selector: 'app-price-alerts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './price-alerts.component.html',
  styleUrl: './price-alerts.component.scss'
})
export class PriceAlertsComponent implements OnInit {
  private priceAlertService = inject(PriceAlertService);
  private marketDataService = inject(MarketDataService);
  private router = inject(Router);

  // Alert list
  alerts = this.priceAlertService.alerts;
  notifications = this.priceAlertService.notifications;
  unreadCount = this.priceAlertService.unreadCount;
  
  // Available assets for selection
  availableAssets = signal<{ symbol: string; name: string; price: number; type: 'crypto' | 'stock'; id: string }[]>([]);
  
  // Search query for filtering assets
  searchQuery = signal<string>('');
  
  // Filtered assets based on search
  filteredAssets = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const assets = this.availableAssets();
    
    if (!query) return assets;
    
    return assets.filter(a => 
      a.symbol.toLowerCase().includes(query) ||
      a.name.toLowerCase().includes(query)
    );
  });
  
  // Create alert form
  showCreateModal = signal(false);
  selectedAsset = signal<string>('');
  selectedAssetPrice = signal<number>(0);
  alertCondition = signal<'above' | 'below'>('above');
  targetPrice = signal<number>(0);
  alertAction = signal<'notify' | 'auto-buy' | 'auto-sell'>('notify');
  autoTradeQuantity = signal<number>(1);
  
  // Loading state
  loading = signal(true);

  // Computed stats
  activeAlertsCount = computed(() => 
    this.alerts().filter(a => a.isActive).length
  );
  
  triggeredCount = computed(() => 
    this.notifications().length
  );

  ngOnInit() {
    this.loadAssets();
    this.priceAlertService.loadAlerts();
  }

  /**
   * Load available assets for creating alerts
   */
  private loadAssets() {
    this.loading.set(true);
    
    this.marketDataService.getAllAssets().subscribe(assets => {
      const formattedAssets = assets.map(a => ({
        id: a.assetId,
        symbol: a.symbol,
        name: a.name,
        price: a.price,
        type: a.assetType
      }));
      this.availableAssets.set(formattedAssets);
      this.loading.set(false);
    });
  }

  /**
   * Open the create alert modal
   */
  openCreateModal() {
    this.showCreateModal.set(true);
    this.resetForm();
  }

  /**
   * Close the create alert modal
   */
  closeCreateModal() {
    this.showCreateModal.set(false);
    this.resetForm();
  }

  /**
   * Reset the create alert form
   */
  private resetForm() {
    this.selectedAsset.set('');
    this.selectedAssetPrice.set(0);
    this.alertCondition.set('above');
    this.targetPrice.set(0);
    this.alertAction.set('notify');
    this.autoTradeQuantity.set(1);
    this.searchQuery.set('');
  }

  /**
   * Handle search query change
   */
  onSearchChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  /**
   * Select asset from filtered list
   */
  selectAsset(asset: { symbol: string; name: string; price: number; type: 'crypto' | 'stock'; id: string }) {
    this.selectedAsset.set(asset.id);
    this.selectedAssetPrice.set(asset.price);
    this.searchQuery.set(asset.symbol + ' - ' + asset.name);
    
    // Set default target price
    this.targetPrice.set(
      this.alertCondition() === 'above' 
        ? Math.round(asset.price * 1.05 * 100) / 100
        : Math.round(asset.price * 0.95 * 100) / 100
    );
  }

  /**
   * Handle asset selection change
   */
  onAssetChange(event: Event) {
    const id = (event.target as HTMLSelectElement).value;
    this.selectedAsset.set(id);
    
    const asset = this.availableAssets().find(a => a.id === id);
    if (asset) {
      this.selectedAssetPrice.set(asset.price);
      // Set default target price slightly above/below current price
      this.targetPrice.set(
        this.alertCondition() === 'above' 
          ? Math.round(asset.price * 1.05 * 100) / 100
          : Math.round(asset.price * 0.95 * 100) / 100
      );
    }
  }

  /**
   * Handle alert condition change
   */
  onConditionChange(condition: 'above' | 'below') {
    this.alertCondition.set(condition);
    
    const currentPrice = this.selectedAssetPrice();
    if (currentPrice > 0) {
      this.targetPrice.set(
        condition === 'above'
          ? Math.round(currentPrice * 1.05 * 100) / 100
          : Math.round(currentPrice * 0.95 * 100) / 100
      );
    }
  }

  /**
   * Create a new price alert
   */
  async createAlert() {
    const asset = this.availableAssets().find(a => a.id === this.selectedAsset());
    if (!asset) return;

    await this.priceAlertService.createAlert(
      asset.id,
      asset.symbol,
      asset.type,
      this.targetPrice(),
      this.alertCondition(),
      this.alertAction(),
      this.alertAction() !== 'notify' ? this.autoTradeQuantity() : undefined
    );
    
    this.closeCreateModal();
  }

  /**
   * Delete an alert
   */
  async deleteAlert(alertId: string) {
    await this.priceAlertService.removeAlert(alertId);
  }

  /**
   * Get action icon for an alert
   */
  getActionIcon(action: 'notify' | 'auto-buy' | 'auto-sell'): string {
    switch (action) {
      case 'notify': return '🔔';
      case 'auto-buy': return '🟢';
      case 'auto-sell': return '🔴';
      default: return '❓';
    }
  }

  /**
   * Get action text for display
   */
  getActionText(action: 'notify' | 'auto-buy' | 'auto-sell'): string {
    switch (action) {
      case 'notify': return 'Notifikácia';
      case 'auto-buy': return 'Auto-Kúp';
      case 'auto-sell': return 'Auto-Predaj';
      default: return action;
    }
  }

  /**
   * Format price for display
   */
  formatPrice(price: number): string {
    if (price >= 1000) {
      return price.toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return price.toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  }

  /**
   * Navigate to trade page for an asset
   */
  goToTrade(assetId: string) {
    this.router.navigate(['/trade', assetId]);
  }

  /**
   * Check if form is valid for submission
   */
  isFormValid(): boolean {
    return (
      this.selectedAsset() !== '' &&
      this.targetPrice() > 0 &&
      (this.alertAction() === 'notify' || this.autoTradeQuantity() > 0)
    );
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Notifikácie neboli povolené. Prosím povoľte ich v nastaveniach prehliadača.');
      }
    }
  }

  /**
   * Check if notifications are enabled
   */
  get notificationsEnabled(): boolean {
    return 'Notification' in window && Notification.permission === 'granted';
  }
}
