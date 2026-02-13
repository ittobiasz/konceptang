export const environment = {
  production: true,
  finnhubApiKey: '',
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    apiKey: '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',
    model: 'llama-3.3-70b-versatile'
  },
  openAi: {
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-4o-mini'
  }
};
