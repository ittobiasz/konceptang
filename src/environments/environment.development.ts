export const environment = {
  production: false,
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    apiKey: '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',
    model: 'llama-3.3-70b-versatile'
  },
  openAi: {
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini'
  }
};
