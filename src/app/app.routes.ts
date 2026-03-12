import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'landing',
    loadComponent: () => import('./features/landing/landing.component').then(m => m.LandingComponent)
  },
  {
    path: 'portfolio',
    canActivate: [authGuard],
    loadComponent: () => import('./features/portfolio/portfolio.component').then(m => m.PortfolioComponent)
  },
  {
    path: 'assets',
    canActivate: [authGuard],
    loadComponent: () => import('./features/assets/assets.component').then(m => m.AssetsComponent)
  },
  {
    path: 'trade/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/trade/trade.component').then(m => m.TradeComponent)
  },
  {
    path: 'ai-advisor',
    canActivate: [authGuard],
    loadComponent: () => import('./features/ai/ai-advisor.component').then(m => m.AiAdvisorComponent)
  },
  {
    path: 'leaderboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/leaderboard/leaderboard.component').then(m => m.LeaderboardComponent)
  },
  {
    path: 'alerts',
    canActivate: [authGuard],
    loadComponent: () => import('./features/alerts/price-alerts.component').then(m => m.PriceAlertsComponent)
  },
  {
    path: 'news',
    canActivate: [authGuard],
    loadComponent: () => import('./features/news/news.component').then(m => m.NewsComponent)
  },
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/login'
  }
];
