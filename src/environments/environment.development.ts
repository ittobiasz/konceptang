export const environment = {
  production: false,
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    apiKey: '', // Pridaj svoj Groq API kluc z console.groq.com
    model: 'llama-3.3-70b-versatile'
  },
  openAi: {
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini'
  }
};
