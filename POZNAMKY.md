# Poznamky - Instalacia InvestIQ

Toto su poznamky o tom, co som pridal a opravil v tejto stranke.

## Zaciatok - Problem
Ceny sa neupdatovali. Zobrazovalo sa tam stale 95,600 USD za Bitcoin aj po refreshi stranky. To bolo blbe, lebo vyzeralo to ako ze stranka nefunguje.

## Co som opravil

### 1. Ceny - retry a cache

Problemy:
- Ceny sa neupdatovali
- Hardcoded fallback ceny boli realcne (96,500 USD za BTC)
- Cache trvala prilis dlho

Riesenie:
- Zmenisem cache z 60 sekund na 30 sekund
- Fallback ceny som dal na 0 USD - tak sa vidi ze to nenacitalo
- Pridal som retry logiku - ak API zlyhava, pokusa sa znova (3 pokusi s exponencialnym backoffom - 1s, 2s, 4s)

Vysledok: Ceny sa updatuju kazde 30 sekund a nikdy nie su zastarale.

### 2. Firebase - autentifikacia

Spociatku:
- Vsetci pouzivatelia zdielali rovnaky portfolio (vsetko v localStorage)
- Nie bola prava prihlasovacia stranka

Pridal som:
- Prihlasovanie cez Firebase Auth (email + heslo)
- Demo ucet - demo@demo.com / demo (prihlasenie hned bez API volania)
- Registracia - novy uzivatel si moze vytvorit ucet
- Odhlasovanie - logout button v headeri

Ako to funguje:
- Ked sa prihlas s demo@demo.com / demo, dostanes email $100,000 a je to hned
- Ked sa registrujes s normalnym emailom, vytvori sa ti Firebase ucet
- Kazdy uzivatel ma svoj vlastny portfolio

### 3. Firestore - ulozisko dat

Pred:
- Vsetko v localStorage (data sa stratia ked vycistis cache)
- Bez servera, vsetko v prehliadaci

Teraz:
- Firebase Firestore - cloud databaza
- Ked sa prihlasis, tvoje obchody a pozicie sa uloziju do Firestore
- Ked sa odhlasis a prihlasis neskorsie, data su tam
- Demo uzivatel pouziva iba localStorage (je to test account)

Kolekcie v Firebase:
- users/ - profily uzivatelov
- positions/ - tvojich akcie a kryptomeny
- trades/ - historia tvojho obchodivania
- alerts/ - price alerty
- prices/ - cache cien

### 4. Prihlasovacia stranka - bezpecnost

Pred:
- Bol si vzdy prihlaseny
- Mohol si pristupit na portfolio bez prihlasenia

Teraz:
- Ked sprustis aplikaciu, vidis prihlasovacia stranku
- Musis sa prihlasit alebo zaregistrovat
- Bez prihlasenia nemozes vidiet portfolio
- Header sa zonda na login stranke (cistsie)

Ako to funguje:
- Route guard - skontroluje ci si prihlaseny
- Ak nie si, presmeruje ta na /login
- Demo credentials su jasne viditelne na stranke

### 5. Ceny - co sa zmenilo

Stocks:
- Vymazal som AAPL, GOOGL, AMZN
- Ostalo: MSFT, NVDA, META, TSLA, JPM, NFLX, V (7 akcii)

Cryptos:
- 50 top kryptomien (Bitcoin, Ethereum, atd)

API:
- CoinGecko - crypto ceny
- Yahoo Finance - stock ceny
- Fallback - 0 USD ked nenacita

### 6. Firebase Security

Nastavil som Firestore rules:
- Uzivatel moze citat a pisat len svoje vlastne data
- Kazda kolekcia ma filter na userId
- Nemoze niekto inak citat tvoje obchody

## Ako sa to pouziva

1. Otvras stranku - http://localhost:64079/
2. Vidis login stranku
3. Alebo zadash demo@demo.com / demo - alebo kliknes na Registracia
4. Po prihlaseni vidis portfolio s $100,000
5. Mozes kupit a predavat
6. Data sa uloziju do Firestore
7. Ked sa odhlasis a prihlasis neskorsie - data su tam

## Technologie

- Angular 21 - frontend
- Firebase Auth - prihlasovanie
- Firestore - databaza
- TypeScript - kod
- SCSS - styling
- Signals - state management

## API Keys

- Firebase: AIzaSyCewScASRwWq7schiUWzixEVw_zkL4OeI8
- Project: investiq-affc3
- CoinGecko: Public API (bez key)
- Yahoo Finance: Via proxy (bez key)

## Build a spustenie

```
npm install      // instaluj dependencies
npm run build    // build production
npm run start    // spusti dev server
npm run test     // spusti testy
```

## Deployment

Ked chces deploynut:
```
npm run build
firebase deploy
```

Alebo na Netlify/Vercel pull dist/ folder.

## Cizi info

- Ked sa aplikacia spusta, skontroluje Firebase prihlasenie
- Ked si prihlaseny uzivatel, nacitaju sa data z Firestore
- Demo uzivatel nema Firestore - je to testovaci account
- Cache cien je 30 sekund, potom sa nacitava znova

To je vsetko! Stranka teraz:
- Ma bezpecne prihlasovanie
- Uklada data do cloudu
- Ziadaja prihlasenie
- Ma spravne ceny
- Retry logiku pre API

