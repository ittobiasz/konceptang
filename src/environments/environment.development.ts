export const environment = {
  production: false,
  firebase: {
    apiKey: 'AIzaSyCewScASRwWq7schiUWzixEVw_zkL4OeI8',
    authDomain: 'investiq-affc3.firebaseapp.com',
    projectId: 'investiq-affc3',
    storageBucket: 'investiq-affc3.firebasestorage.app',
    messagingSenderId: '38638502132',
    appId: '1:38638502132:web:96da5d9874b0fa8b1edea1'
  },
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
