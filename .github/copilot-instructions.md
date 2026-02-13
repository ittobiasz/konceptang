# InvestIQ - Copilot Instructions

## Project Overview
InvestIQ is an Angular 21+ paper trading application for stocks and cryptocurrencies. Users receive a $100,000 virtual balance and can practice trading with real market data.

## Tech Stack
- **Framework:** Angular 21+ with standalone components
- **Language:** TypeScript 5.x
- **Styling:** SCSS with dark theme
- **State:** Angular Signals
- **Storage:** localStorage (demo mode)
- **APIs:** CoinCap (crypto), Finnhub (stocks), Groq/OpenAI (AI)

## Project Structure
```
src/
├── app/
│   ├── core/                    # Services and guards
│   │   ├── auth.service.ts
│   │   ├── crypto.service.ts
│   │   ├── stock.service.ts
│   │   ├── portfolio.service.ts
│   │   ├── market-data.service.ts
│   │   ├── unified-market.service.ts
│   │   ├── currency.service.ts
│   │   ├── theme.service.ts
│   │   └── ai-advisor.service.ts
│   ├── shared/                  # Shared models and components
│   │   └── models/
│   ├── features/                # Feature modules
│   │   ├── landing/
│   │   ├── portfolio/
│   │   ├── assets/
│   │   └── ai/
│   └── app.routes.ts
├── environments/
└── styles.scss
```

## Key Patterns
- Use standalone components
- Use Angular signals for reactive state
- Inject services with `inject()` function
- Use async pipe or toSignal for observables
- Follow OnPush change detection

## API Integrations
- **CoinCap:** No API key required, `https://api.coincap.io/v2`
- **Groq AI:** Requires API key from console.groq.com
- **Finnhub:** Requires API key for stock data

## Styling Guidelines
- Dark theme: background #0a0a0a, cards #1a1a1a
- Accent color: #10b981 (emerald green)
- Use CSS custom properties for theming
- Mobile-first responsive design
