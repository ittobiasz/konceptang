import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/landing.component').then(m => m.LandingComponent)
  },
  {
    path: 'portfolio',
    loadComponent: () => import('./features/portfolio/portfolio.component').then(m => m.PortfolioComponent)
  },
  {
    path: 'assets',
    loadComponent: () => import('./features/assets/assets.component').then(m => m.AssetsComponent)
  },
  {
    path: 'trade/:id',
    loadComponent: () => import('./features/trade/trade.component').then(m => m.TradeComponent)
  },
  {
    path: 'ai-advisor',
    loadComponent: () => import('./features/ai/ai-advisor.component').then(m => m.AiAdvisorComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
