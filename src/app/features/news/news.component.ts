import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NewsService, NewsArticle } from '../../core/news.service';

type NewsCategory = 'crypto' | 'stocks' | 'general';

/**
 * Component for displaying crypto and stock market news with sentiment analysis.
 * Users can filter by category and quickly see market sentiment.
 */
@Component({
  selector: 'app-news',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './news.component.html',
  styleUrl: './news.component.scss'
})
export class NewsComponent implements OnInit, OnDestroy {
  private newsService = inject(NewsService);
  private router = inject(Router);
  private refreshInterval: any;

  // News data from service
  news = this.newsService.news;
  loading = this.newsService.isLoading;
  
  // Category filter
  selectedCategory = signal<NewsCategory | 'all'>('all');
  
  // Search filter
  searchQuery = signal<string>('');
  
  // Categories with counts
  categories: { key: NewsCategory | 'all'; label: string; icon: string }[] = [
    { key: 'all', label: 'Všetky', icon: '📰' },
    { key: 'crypto', label: 'Krypto', icon: '🪙' },
    { key: 'stocks', label: 'Akcie', icon: '📈' },
    { key: 'general', label: 'Všeobecné', icon: '🌍' }
  ];

  // Filtered news
  filteredNews = computed(() => {
    let articles = this.news();
    
    // Filter by category
    if (this.selectedCategory() !== 'all') {
      articles = articles.filter(a => a.category === this.selectedCategory());
    }
    
    // Filter by search query
    const query = this.searchQuery().toLowerCase();
    if (query) {
      articles = articles.filter(a => 
        a.title.toLowerCase().includes(query) ||
        a.summary.toLowerCase().includes(query) ||
        (a.relatedAssets && a.relatedAssets.some(asset => asset.toLowerCase().includes(query)))
      );
    }
    
    return articles;
  });

  // Sentiment stats
  sentimentStats = computed(() => {
    const articles = this.news();
    const positive = articles.filter(a => a.sentiment === 'positive').length;
    const negative = articles.filter(a => a.sentiment === 'negative').length;
    const neutral = articles.filter(a => a.sentiment === 'neutral').length;
    
    return { positive, negative, neutral, total: articles.length };
  });

  ngOnInit() {
    this.newsService.loadNews();
    
    // Refresh news every 5 minutes
    this.refreshInterval = setInterval(() => {
      this.newsService.loadNews();
    }, 5 * 60 * 1000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  /**
   * Change category filter
   */
  setCategory(category: NewsCategory | 'all') {
    this.selectedCategory.set(category);
  }

  /**
   * Update search query
   */
  onSearchChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  /**
   * Refresh news manually
   */
  refreshNews() {
    this.newsService.loadNews();
  }

  /**
   * Open article in new tab
   */
  openArticle(article: NewsArticle) {
    window.open(article.url, '_blank');
  }

  /**
   * Navigate to trade page for an asset
   */
  goToTrade(symbol: string) {
    this.router.navigate(['/trade', symbol]);
  }

  /**
   * Get sentiment icon
   */
  getSentimentIcon(sentiment?: 'positive' | 'negative' | 'neutral'): string {
    switch (sentiment) {
      case 'positive': return '🟢';
      case 'negative': return '🔴';
      case 'neutral': return '⚪';
      default: return '⚪';
    }
  }

  /**
   * Get sentiment text
   */
  getSentimentText(sentiment?: 'positive' | 'negative' | 'neutral'): string {
    switch (sentiment) {
      case 'positive': return 'Pozitívny';
      case 'negative': return 'Negatívny';
      case 'neutral': return 'Neutrálny';
      default: return 'Neutrálny';
    }
  }

  /**
   * Get category icon
   */
  getCategoryIcon(category: NewsCategory): string {
    const cat = this.categories.find(c => c.key === category);
    return cat?.icon || '📰';
  }

  /**
   * Format date for display
   */
  formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Less than an hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `pred ${minutes} min`;
    }
    
    // Less than a day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `pred ${hours} hod`;
    }
    
    // Less than a week
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `pred ${days} dňami`;
    }
    
    // Older
    return date.toLocaleDateString('sk-SK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  /**
   * Get overall market sentiment
   */
  getOverallSentiment(): { text: string; class: string } {
    const stats = this.sentimentStats();
    
    if (stats.positive > stats.negative * 1.5) {
      return { text: 'Very Positive', class: 'very-positive' };
    }
    if (stats.positive > stats.negative) {
      return { text: 'Moderately Positive', class: 'positive' };
    }
    if (stats.negative > stats.positive * 1.5) {
      return { text: 'Very Negative', class: 'very-negative' };
    }
    if (stats.negative > stats.positive) {
      return { text: 'Moderately Negative', class: 'negative' };
    }
    
    return { text: 'Neutral', class: 'neutral' };
  }

  /**
   * Count news by category
   */
  getCategoryCount(category: NewsCategory | 'all'): number {
    if (category === 'all') {
      return this.news().length;
    }
    return this.news().filter(a => a.category === category).length;
  }
}
