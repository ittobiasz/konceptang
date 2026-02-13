import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map, catchError, of, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AiInsight, ChatMessage, AiAnalysisRequest, GroqChatResponse, PositionWithQuote } from '../shared/models';

@Injectable({
  providedIn: 'root'
})
export class AiAdvisorService {
  private readonly http = inject(HttpClient);
  
  private readonly _isLoading = signal(false);
  private readonly _lastInsight = signal<AiInsight | null>(null);
  private readonly _chatHistory = signal<ChatMessage[]>([]);

  readonly isLoading = this._isLoading.asReadonly();
  readonly lastInsight = this._lastInsight.asReadonly();
  readonly chatHistory = this._chatHistory.asReadonly();

  private getHeaders(provider: 'groq' | 'openai'): HttpHeaders {
    const config = provider === 'groq' ? environment.groq : environment.openAi;
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    });
  }

  async analyzePortfolio(positions: PositionWithQuote[], totalValue: number, cashBalance: number): Promise<AiInsight> {
    this._isLoading.set(true);

    const analysisData: AiAnalysisRequest = {
      positions: positions.map(p => ({
        symbol: p.assetSymbol,
        name: p.assetName,
        type: p.assetType,
        quantity: p.quantity,
        averagePrice: p.averagePrice,
        currentPrice: p.currentPrice,
        pnl: p.pnl,
        pnlPercent: p.pnlPercent,
        allocation: totalValue > 0 ? (p.marketValue / totalValue) * 100 : 0
      })),
      totalValue,
      cashBalance
    };

    const systemPrompt = this.getAnalysisSystemPrompt();
    const userPrompt = this.getAnalysisUserPrompt(analysisData);

    try {
      if (environment.groq.apiKey && !environment.groq.apiKey.includes('YOUR_')) {
        const response = await this.callAiApi('groq', systemPrompt, userPrompt);
        if (response) {
          const insight = this.parseInsightResponse(response);
          this._lastInsight.set(insight);
          this._isLoading.set(false);
          return insight;
        }
      }

      if (environment.openAi.apiKey && !environment.openAi.apiKey.includes('YOUR_')) {
        const response = await this.callAiApi('openai', systemPrompt, userPrompt);
        if (response) {
          const insight = this.parseInsightResponse(response);
          this._lastInsight.set(insight);
          this._isLoading.set(false);
          return insight;
        }
      }

      const insight = this.generateLocalAnalysis(analysisData);
      this._lastInsight.set(insight);
      this._isLoading.set(false);
      return insight;

    } catch (error) {
      console.warn('AI analysis failed, using local fallback:', error);
      const insight = this.generateLocalAnalysis(analysisData);
      this._lastInsight.set(insight);
      this._isLoading.set(false);
      return insight;
    }
  }

  async chat(userMessage: string, portfolioContext?: string): Promise<string> {
    this._isLoading.set(true);

    const userChatMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    };
    this._chatHistory.set([...this._chatHistory(), userChatMsg]);

    const systemPrompt = this.getChatSystemPrompt(portfolioContext);
    
    const recentHistory = this._chatHistory().slice(-10);
    
    try {
      let response: string | null = null;

      if (environment.groq.apiKey && !environment.groq.apiKey.includes('YOUR_')) {
        response = await this.callChatApi('groq', systemPrompt, recentHistory);
      }

      if (!response && environment.openAi.apiKey && !environment.openAi.apiKey.includes('YOUR_')) {
        response = await this.callChatApi('openai', systemPrompt, recentHistory);
      }

      if (!response) {
        response = this.generateLocalChatResponse(userMessage);
      }

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      };
      this._chatHistory.set([...this._chatHistory(), assistantMsg]);
      
      this._isLoading.set(false);
      return response;

    } catch (error) {
      console.warn('Chat failed:', error);
      const fallbackResponse = 'Prepáčte, momentálne nemôžem odpovedať. Skúste to prosím neskôr.';
      
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: fallbackResponse,
        timestamp: Date.now()
      };
      this._chatHistory.set([...this._chatHistory(), errorMsg]);
      
      this._isLoading.set(false);
      return fallbackResponse;
    }
  }

  private async callAiApi(provider: 'groq' | 'openai', systemPrompt: string, userPrompt: string): Promise<string | null> {
    const config = provider === 'groq' ? environment.groq : environment.openAi;
    
    const body = {
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    };

    try {
      const response = await firstValueFrom(
        this.http.post<GroqChatResponse>(config.baseUrl, body, { headers: this.getHeaders(provider) })
      );
      return response.choices[0]?.message?.content || null;
    } catch (error) {
      console.warn(`${provider} API call failed:`, error);
      return null;
    }
  }

  private async callChatApi(provider: 'groq' | 'openai', systemPrompt: string, history: ChatMessage[]): Promise<string | null> {
    const config = provider === 'groq' ? environment.groq : environment.openAi;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({ role: m.role, content: m.content }))
    ];

    const body = {
      model: config.model,
      messages,
      temperature: 0.7,
      max_tokens: 1000
    };

    try {
      const response = await firstValueFrom(
        this.http.post<GroqChatResponse>(config.baseUrl, body, { headers: this.getHeaders(provider) })
      );
      return response.choices[0]?.message?.content || null;
    } catch (error) {
      console.warn(`${provider} chat API call failed:`, error);
      return null;
    }
  }

  private getAnalysisSystemPrompt(): string {
    return `Si skúsený investičný poradca. Analyzuj portfólio používateľa a poskytni stručné, ale užitočné rady.
    
Tvoja odpoveď musí byť v slovenčine a vo formáte JSON s týmito poľami:
{
  "summary": "Stručné zhrnutie stavu portfólia (2-3 vety)",
  "riskScore": číslo 1-10 (1=nízke riziko, 10=vysoké riziko),
  "diversificationScore": číslo 1-10 (1=zlá diverzifikácia, 10=výborná diverzifikácia),
  "recommendations": ["odporúčanie 1", "odporúčanie 2", "odporúčanie 3"]
}

Beri do úvahy:
- Rozloženie medzi krypto a akcie
- Koncentráciu v jednotlivých aktívach
- Celkové P&L
- Pomer hotovosti k investíciám`;
  }

  private getAnalysisUserPrompt(data: AiAnalysisRequest): string {
    if (data.positions.length === 0) {
      return `Portfólio je prázdne. Hotovostný zostatok: $${data.cashBalance.toFixed(2)}. 
Analyzuj situáciu a odporuč, ako začať investovať.`;
    }

    const positionsText = data.positions.map(p => 
      `- ${p.symbol} (${p.type}): ${p.quantity} ks @ $${p.currentPrice.toFixed(2)}, P&L: ${p.pnlPercent.toFixed(2)}%, alokácia: ${p.allocation.toFixed(1)}%`
    ).join('\n');

    return `Analyzuj toto portfólio:

Pozície:
${positionsText}

Celková hodnota: $${data.totalValue.toFixed(2)}
Hotovosť: $${data.cashBalance.toFixed(2)}
Pomer investície/hotovosť: ${((data.totalValue / (data.totalValue + data.cashBalance)) * 100).toFixed(1)}%`;
  }

  private getChatSystemPrompt(portfolioContext?: string): string {
    let prompt = `Si priateľský investičný poradca pre platformu InvestIQ - aplikáciu na papierové obchodovanie.
Odpovedáš v slovenčine, stručne a prakticky.
Neposkytuj konkrétne investičné rady, ale vysvetľuj koncepty a pomáhaj s rozhodovaním.`;

    if (portfolioContext) {
      prompt += `\n\nAktuálne portfólio používateľa:\n${portfolioContext}`;
    }

    return prompt;
  }

  private parseInsightResponse(response: string): AiInsight {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || 'Analýza dokončená.',
          riskScore: Math.min(10, Math.max(1, parsed.riskScore || 5)),
          diversificationScore: Math.min(10, Math.max(1, parsed.diversificationScore || 5)),
          recommendations: parsed.recommendations || [],
          timestamp: Date.now()
        };
      }
    } catch (e) {
      console.warn('Failed to parse AI response as JSON');
    }

    return {
      summary: response.slice(0, 500),
      riskScore: 5,
      diversificationScore: 5,
      recommendations: ['Pokračujte v diverzifikácii portfólia.'],
      timestamp: Date.now()
    };
  }

  private generateLocalAnalysis(data: AiAnalysisRequest): AiInsight {
    const { positions, totalValue, cashBalance } = data;
    
    if (positions.length === 0) {
      return {
        summary: 'Vaše portfólio je prázdne. Máte k dispozícii plný hotovostný zostatok na začatie investovania.',
        riskScore: 1,
        diversificationScore: 1,
        recommendations: [
          'Začnite s investovaním do overených aktív ako Bitcoin alebo blue-chip akcie.',
          'Investujte postupne, nie všetko naraz.',
          'Diverzifikujte medzi kryptomeny a akcie.'
        ],
        timestamp: Date.now()
      };
    }

    const cryptoCount = positions.filter(p => p.type === 'crypto').length;
    const stockCount = positions.filter(p => p.type === 'stock').length;
    const cryptoAllocation = positions.filter(p => p.type === 'crypto').reduce((sum, p) => sum + p.allocation, 0);
    const maxAllocation = Math.max(...positions.map(p => p.allocation));
    const avgPnl = positions.reduce((sum, p) => sum + p.pnlPercent, 0) / positions.length;
    const cashRatio = cashBalance / (totalValue + cashBalance) * 100;

    let riskScore = 5;
    if (cryptoAllocation > 70) riskScore += 2;
    if (maxAllocation > 50) riskScore += 2;
    if (positions.length < 3) riskScore += 1;
    riskScore = Math.min(10, Math.max(1, riskScore));

    let diversificationScore = 5;
    if (cryptoCount > 0 && stockCount > 0) diversificationScore += 2;
    if (positions.length >= 5) diversificationScore += 1;
    if (maxAllocation < 30) diversificationScore += 2;
    if (cashRatio > 10 && cashRatio < 50) diversificationScore += 1;
    diversificationScore = Math.min(10, Math.max(1, diversificationScore));

    let summary = `Máte ${positions.length} pozícií s celkovou hodnotou $${totalValue.toFixed(2)}. `;
    if (avgPnl >= 0) {
      summary += `Celkový zisk je ${avgPnl.toFixed(1)}%. `;
    } else {
      summary += `Celková strata je ${avgPnl.toFixed(1)}%. `;
    }

    const recommendations: string[] = [];
    
    if (positions.length < 3) {
      recommendations.push('Zvážte pridanie ďalších pozícií pre lepšiu diverzifikáciu.');
    }
    if (maxAllocation > 40) {
      recommendations.push('Jedna pozícia tvorí príliš veľkú časť portfólia. Zvážte prerozdelenie.');
    }
    if (cryptoCount === 0) {
      recommendations.push('Zvážte pridanie kryptomien pre vyšší rastový potenciál.');
    }
    if (stockCount === 0) {
      recommendations.push('Pridajte akcie pre stabilitu portfólia.');
    }
    if (cashRatio < 5) {
      recommendations.push('Udržujte aspoň 5-10% hotovosti pre príležitosti.');
    }
    if (cashRatio > 50) {
      recommendations.push('Máte veľa nevyužitej hotovosti. Zvážte postupné investovanie.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Portfólio vyzerá dobre vyvážené. Pokračujte v pravidelnom monitorovaní.');
    }

    return {
      summary,
      riskScore,
      diversificationScore,
      recommendations: recommendations.slice(0, 4),
      timestamp: Date.now()
    };
  }

  private generateLocalChatResponse(message: string): string {
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('bitcoin') || lowerMsg.includes('btc')) {
      return 'Bitcoin je najväčšia kryptomena podľa trhovej kapitalizácie. Je považovaný za "digitálne zlato" a často slúži ako vstupná brána do sveta kryptomien. Pri investovaní zvážte jeho vysokú volatilitu.';
    }
    
    if (lowerMsg.includes('diverzifikácia') || lowerMsg.includes('diverzifik')) {
      return 'Diverzifikácia je kľúčová stratégia na zníženie rizika. Odporúčam rozložiť investície medzi rôzne triedy aktív (akcie, krypto), sektory a geografické regióny. Nikdy nedávajte všetky vajcia do jedného košíka.';
    }
    
    if (lowerMsg.includes('riziko') || lowerMsg.includes('risk')) {
      return 'Riadenie rizika je základom úspešného investovania. Kľúčové princípy: 1) Investujte len peniaze, ktoré si môžete dovoliť stratiť, 2) Diverzifikujte portfólio, 3) Nastavte si stop-loss úrovne, 4) Neinvestujte pod vplyvom emócií.';
    }
    
    if (lowerMsg.includes('akcie') || lowerMsg.includes('stock')) {
      return 'Akcie predstavujú vlastníctvo v spoločnosti. Blue-chip akcie (AAPL, MSFT, GOOGL) sú považované za stabilnejšie, zatiaľ čo rastové akcie môžu ponúknuť vyššie výnosy s väčším rizikom. Pre začiatočníkov odporúčam začať s etablovanými spoločnosťami.';
    }
    
    if (lowerMsg.includes('kedy') && (lowerMsg.includes('kúpiť') || lowerMsg.includes('predať'))) {
      return 'Načasovanie trhu je veľmi ťažké aj pre profesionálov. Stratégia pravidelného investovania (DCA - Dollar Cost Averaging) vám pomôže vyhnúť sa emocionálnym rozhodnutiam. Investujte pravidelne rovnakú sumu bez ohľadu na cenu.';
    }
    
    return 'Ďakujem za otázku. InvestIQ je skvelé miesto na učenie sa investovania bez rizika. Môžete cvičiť obchodovanie s virtuálnymi $100,000 a sledovať, ako by sa vám darilo na reálnom trhu. Máte konkrétnu otázku o investovaní alebo funkcii aplikácie?';
  }

  clearChatHistory(): void {
    this._chatHistory.set([]);
  }
}
