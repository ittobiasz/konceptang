export interface AiInsight {
  summary: string;
  riskScore: number;
  diversificationScore: number;
  recommendations: string[];
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface AiAnalysisRequest {
  positions: {
    symbol: string;
    name: string;
    type: 'crypto' | 'stock';
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    pnl: number;
    pnlPercent: number;
    allocation: number;
  }[];
  totalValue: number;
  cashBalance: number;
}

export interface GroqChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
