import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FirebaseService, PriceAlert } from './firebase.service';
import { CryptoService } from './crypto.service';
import { StockService } from './stock.service';
import { PortfolioService } from './portfolio.service';
import { MarketDataService } from './market-data.service';
import { interval, Subscription, firstValueFrom } from 'rxjs';

// 🔔 Notifikacia
export interface AlertNotification {
  id: string;
  alert: PriceAlert;
  currentPrice: number;
  message: string;
  timestamp: number;
  isRead: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PriceAlertService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly firebaseService = inject(FirebaseService);
  private readonly cryptoService = inject(CryptoService);
  private readonly stockService = inject(StockService);
  private readonly portfolioService = inject(PortfolioService);
  private readonly marketDataService = inject(MarketDataService);

  private readonly _alerts = signal<PriceAlert[]>([]);
  private readonly _notifications = signal<AlertNotification[]>([]);
  private readonly _unreadCount = signal(0);
  
  private checkSubscription: Subscription | null = null;
  private readonly CHECK_INTERVAL = 30000; // 30 sekund

  readonly alerts = this._alerts.asReadonly();
  readonly notifications = this._notifications.asReadonly();
  readonly unreadCount = this._unreadCount.asReadonly();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadAlerts();
      this.startPriceMonitoring();
    }
  }

  // 📥 Nacita aktivne alerty
  async loadAlerts(): Promise<void> {
    const user = this.firebaseService.currentUser();
    if (!user) {
      // Fallback na localStorage
      this.loadFromLocalStorage();
      return;
    }

    const alerts = await this.firebaseService.getPriceAlerts(user.uid);
    this._alerts.set(alerts);
  }

  // 💾 Fallback - nacitanie z localStorage
  private loadFromLocalStorage(): void {
    const stored = localStorage.getItem('investiq_price_alerts');
    if (stored) {
      try {
        this._alerts.set(JSON.parse(stored));
      } catch {
        this._alerts.set([]);
      }
    }
  }

  // 💾 Ulozenie do localStorage
  private saveToLocalStorage(): void {
    localStorage.setItem('investiq_price_alerts', JSON.stringify(this._alerts()));
  }

  // ➕ Vytvorenie noveho alertu
  async createAlert(
    assetId: string,
    assetSymbol: string,
    assetType: 'crypto' | 'stock',
    targetPrice: number,
    condition: 'above' | 'below',
    action: 'notify' | 'auto-buy' | 'auto-sell',
    quantity?: number
  ): Promise<{ success: boolean; message: string }> {
    const user = this.firebaseService.currentUser();
    
    const alert: Omit<PriceAlert, 'id'> = {
      userId: user?.uid || 'local',
      assetId,
      assetSymbol,
      assetType,
      targetPrice,
      condition,
      action,
      quantity: quantity || 0,
      isActive: true,
      createdAt: Date.now()
    };

    if (user) {
      const id = await this.firebaseService.createPriceAlert(alert);
      this._alerts.set([...this._alerts(), { ...alert, id }]);
    } else {
      const id = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      this._alerts.set([...this._alerts(), { ...alert, id }]);
      this.saveToLocalStorage();
    }

    return { 
      success: true, 
      message: `Alert vytvorený: ${condition === 'above' ? 'Nad' : 'Pod'} $${targetPrice}` 
    };
  }

  // 🗑️ Odstranenie alertu
  async removeAlert(alertId: string): Promise<void> {
    const user = this.firebaseService.currentUser();
    
    if (user) {
      await this.firebaseService.deactivateAlert(alertId);
    }
    
    this._alerts.set(this._alerts().filter(a => a.id !== alertId));
    this.saveToLocalStorage();
  }

  // 🔍 Spustenie monitorovania cien
  private startPriceMonitoring(): void {
    this.checkSubscription = interval(this.CHECK_INTERVAL).subscribe(() => {
      this.checkAlerts();
    });
  }

  // 🔍 Kontrola alertov
  private async checkAlerts(): Promise<void> {
    const activeAlerts = this._alerts().filter(a => a.isActive);
    if (activeAlerts.length === 0) return;

    // Ziskaj aktualne ceny
    const cryptoAlerts = activeAlerts.filter(a => a.assetType === 'crypto');
    const stockAlerts = activeAlerts.filter(a => a.assetType === 'stock');

    // Kontrola krypto alertov
    for (const alert of cryptoAlerts) {
      this.cryptoService.getCryptoById(alert.assetId).subscribe(crypto => {
        if (crypto) {
          const price = parseFloat(crypto.priceUsd);
          this.evaluateAlert(alert, price);
        }
      });
    }

    // Kontrola stock alertov
    for (const alert of stockAlerts) {
      this.stockService.getStockBySymbol(alert.assetSymbol).subscribe(stock => {
        if (stock) {
          this.evaluateAlert(alert, stock.price);
        }
      });
    }
  }

  // ⚖️ Vyhodnotenie alertu
  private async evaluateAlert(alert: PriceAlert, currentPrice: number): Promise<void> {
    const triggered = 
      (alert.condition === 'above' && currentPrice >= alert.targetPrice) ||
      (alert.condition === 'below' && currentPrice <= alert.targetPrice);

    if (!triggered) return;

    // Vytvor notifikaciu
    const notification: AlertNotification = {
      id: `notif-${Date.now()}`,
      alert,
      currentPrice,
      message: this.createNotificationMessage(alert, currentPrice),
      timestamp: Date.now(),
      isRead: false
    };

    this._notifications.set([notification, ...this._notifications()]);
    this._unreadCount.set(this._unreadCount() + 1);

    // Deaktivuj alert
    await this.removeAlert(alert.id);

    // Zobraz browser notifikaciu
    this.showBrowserNotification(notification);

    // Auto-trade ak je nastavene
    if (alert.action === 'auto-buy' || alert.action === 'auto-sell') {
      await this.executeAutoTrade(alert, currentPrice);
    }
  }

  private async executeAutoTrade(alert: PriceAlert, currentPrice: number): Promise<void> {
    const quantity = alert.quantity || 1;

    const quotes = await firstValueFrom(this.marketDataService.getAllAssets());
    const quote = quotes.find(q => q.assetId === alert.assetId || q.symbol === alert.assetSymbol);

    if (!quote) {
      this.addAutoTradeNotification(alert, false, 'Aktivum nebolo najdene na trhu');
      return;
    }

    const quoteWithPrice = { ...quote, price: currentPrice };

    if (alert.action === 'auto-buy') {
      const result = this.portfolioService.buy(quoteWithPrice, quantity, currentPrice);
      this.addAutoTradeNotification(alert, result.success,
        result.success
          ? `Auto-nakup: ${quantity} ${alert.assetSymbol} za $${currentPrice.toFixed(2)}`
          : `Auto-nakup zlyhal: ${result.message}`
      );
    } else if (alert.action === 'auto-sell') {
      const result = this.portfolioService.sell(quoteWithPrice, quantity, currentPrice);
      this.addAutoTradeNotification(alert, result.success,
        result.success
          ? `Auto-predaj: ${quantity} ${alert.assetSymbol} za $${currentPrice.toFixed(2)}`
          : `Auto-predaj zlyhal: ${result.message}`
      );
    }
  }

  private addAutoTradeNotification(alert: PriceAlert, success: boolean, message: string): void {
    const notification: AlertNotification = {
      id: `trade-notif-${Date.now()}`,
      alert,
      currentPrice: alert.targetPrice,
      message: `${success ? 'Uspesne' : 'Neuspesne'}: ${message}`,
      timestamp: Date.now(),
      isRead: false
    };
    this._notifications.set([notification, ...this._notifications()]);
    this._unreadCount.set(this._unreadCount() + 1);
  }

  // 📝 Vytvorenie spravy notifikacie
  private createNotificationMessage(alert: PriceAlert, currentPrice: number): string {
    const direction = alert.condition === 'above' ? 'dosiahol' : 'klesol pod';
    const action = alert.action === 'notify' ? '' : 
      alert.action === 'auto-buy' ? ' - automaticky nakúpené!' : ' - automaticky predané!';
    
    return `${alert.assetSymbol} ${direction} $${alert.targetPrice.toFixed(2)} (aktuálne $${currentPrice.toFixed(2)})${action}`;
  }

  // 🔔 Browser notifikacia
  private showBrowserNotification(notification: AlertNotification): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('InvestIQ Price Alert', {
        body: notification.message,
        icon: '/favicon.ico'
      });
    }
  }

  // 🔔 Poziadaj o povolenie notifikacii
  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    
    if (Notification.permission === 'granted') return true;
    
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  // ✅ Oznac notifikaciu ako precitanu
  markAsRead(notificationId: string): void {
    const notifications = this._notifications().map(n => 
      n.id === notificationId ? { ...n, isRead: true } : n
    );
    this._notifications.set(notifications);
    this._unreadCount.set(this._notifications().filter(n => !n.isRead).length);
  }

  // ✅ Oznac vsetky ako precitane
  markAllAsRead(): void {
    const notifications = this._notifications().map(n => ({ ...n, isRead: true }));
    this._notifications.set(notifications);
    this._unreadCount.set(0);
  }

  // 🗑️ Vymaz vsetky notifikacie
  clearNotifications(): void {
    this._notifications.set([]);
    this._unreadCount.set(0);
  }

  ngOnDestroy(): void {
    this.checkSubscription?.unsubscribe();
  }
}
