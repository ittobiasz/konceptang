export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  paperBalance: number;
  createdAt: number;
  updatedAt?: number;
}

export const DEFAULT_BALANCE = 100000;

// vytvori noveho demo uzivatela
export function createDemoUser(): User {
  return {
    uid: `demo-user-${Date.now()}`,
    email: 'demo@investiq.sk',
    displayName: 'Demo Používateľ',
    role: 'admin',
    paperBalance: DEFAULT_BALANCE,
    createdAt: Date.now()
  };
}
