import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  Auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  getFirestore, 
  Firestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  addDoc,
  deleteDoc,
  where,
  Timestamp
} from 'firebase/firestore';
import { environment } from '../../environments/environment';

//  User profil v Firestore
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  paperBalance: number;
  createdAt: number;
  totalPnl: number;
  totalTrades: number;
  winRate: number;
  isPublic: boolean; // Pre leaderboard
}

//  Position v Firestore
export interface FirestorePosition {
  id: string;
  userId: string;
  assetId: string;
  assetSymbol: string;
  assetName: string;
  assetType: 'crypto' | 'stock';
  quantity: number;
  averagePrice: number;
  createdAt: number;
  updatedAt: number;
}

//  Trade v Firestore
export interface FirestoreTrade {
  id: string;
  userId: string;
  assetId: string;
  assetSymbol: string;
  assetName: string;
  assetType: 'crypto' | 'stock';
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
  timestamp: number;
  pnl?: number;
}

//  Price Alert
export interface PriceAlert {
  id: string;
  userId: string;
  assetId: string;
  assetSymbol: string;
  assetType: 'crypto' | 'stock';
  targetPrice: number;
  condition: 'above' | 'below';
  action: 'notify' | 'auto-buy' | 'auto-sell';
  quantity?: number;
  isActive: boolean;
  createdAt: number;
  triggeredAt?: number;
}

//  Leaderboard entry
export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  totalPnl: number;
  totalPnlPercent: number;
  winRate: number;
  totalTrades: number;
  rank: number;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private readonly platformId = inject(PLATFORM_ID);
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private db: Firestore | null = null;
  
  private readonly _currentUser = signal<FirebaseUser | null>(null);
  private readonly _userProfile = signal<UserProfile | null>(null);
  private readonly _isLoading = signal(true);
  private readonly _isInitialized = signal(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly userProfile = this._userProfile.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isInitialized = this._isInitialized.asReadonly();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.initializeFirebase();
    }
  }

  //  Inicializacia Firebase
  private initializeFirebase(): void {
    try {
      this.app = initializeApp(environment.firebase);
      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);
      
      // Sleduj stav autentifikacie
      onAuthStateChanged(this.auth, async (user) => {
        this._currentUser.set(user);
        if (user) {
          await this.loadUserProfile(user.uid);
        } else {
          this._userProfile.set(null);
        }
        this._isLoading.set(false);
      });
      
      this._isInitialized.set(true);
    } catch (error) {
      console.error('Firebase initialization failed:', error);
      this._isLoading.set(false);
    }
  }

  //  Registracia s emailom
  async register(email: string, password: string, displayName: string): Promise<{ success: boolean; message: string }> {
    if (!this.auth || !this.db) {
      return { success: false, message: 'Firebase nie je inicializovaný' };
    }

    try {
      const credential = await createUserWithEmailAndPassword(this.auth, email, password);
      
      // Vytvor user profil
      const profile: UserProfile = {
        uid: credential.user.uid,
        email: email,
        displayName: displayName,
        paperBalance: 100000,
        createdAt: Date.now(),
        totalPnl: 0,
        totalTrades: 0,
        winRate: 0,
        isPublic: true
      };
      
      await setDoc(doc(this.db, 'users', credential.user.uid), profile);
      this._userProfile.set(profile);
      
      return { success: true, message: 'Registrácia úspešná!' };
    } catch (error: any) {
      return { success: false, message: this.getErrorMessage(error.code) };
    }
  }

  //  Prihlasenie s emailom
  async login(email: string, password: string): Promise<{ success: boolean; message: string }> {
    if (!this.auth) {
      return { success: false, message: 'Firebase nie je inicializovaný' };
    }

    try {
      await signInWithEmailAndPassword(this.auth, email, password);
      return { success: true, message: 'Prihlásenie úspešné!' };
    } catch (error: any) {
      return { success: false, message: this.getErrorMessage(error.code) };
    }
  }

  //  Google prihlasenie
  async loginWithGoogle(): Promise<{ success: boolean; message: string }> {
    if (!this.auth || !this.db) {
      return { success: false, message: 'Firebase nie je inicializovaný' };
    }

    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(this.auth, provider);
      
      // Skontroluj ci existuje profil
      const profileDoc = await getDoc(doc(this.db, 'users', credential.user.uid));
      if (!profileDoc.exists()) {
        const profile: UserProfile = {
          uid: credential.user.uid,
          email: credential.user.email || '',
          displayName: credential.user.displayName || 'Trader',
          paperBalance: 100000,
          createdAt: Date.now(),
          totalPnl: 0,
          totalTrades: 0,
          winRate: 0,
          isPublic: true
        };
        await setDoc(doc(this.db, 'users', credential.user.uid), profile);
        this._userProfile.set(profile);
      }
      
      return { success: true, message: 'Prihlásenie cez Google úspešné!' };
    } catch (error: any) {
      return { success: false, message: this.getErrorMessage(error.code) };
    }
  }

  //  Odhlasenie
  async logout(): Promise<void> {
    if (this.auth) {
      await signOut(this.auth);
      this._userProfile.set(null);
    }
  }

  //  Nacitanie user profilu
  private async loadUserProfile(uid: string): Promise<void> {
    if (!this.db) return;
    
    try {
      const profileDoc = await getDoc(doc(this.db, 'users', uid));
      if (profileDoc.exists()) {
        this._userProfile.set(profileDoc.data() as UserProfile);
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  }

  //  Aktualizacia zostatku
  async updateBalance(newBalance: number): Promise<void> {
    const user = this._currentUser();
    if (!user || !this.db) return;
    
    await updateDoc(doc(this.db, 'users', user.uid), { paperBalance: newBalance });
    const profile = this._userProfile();
    if (profile) {
      this._userProfile.set({ ...profile, paperBalance: newBalance });
    }
  }

  //  Ulozenie pozicie
  async savePosition(position: FirestorePosition): Promise<void> {
    if (!this.db) return;
    await setDoc(doc(this.db, 'positions', position.id), position);
  }

  //  Nacitanie pozicii
  async getPositions(userId: string): Promise<FirestorePosition[]> {
    if (!this.db) return [];
    
    const q = query(
      collection(this.db, 'positions'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as FirestorePosition);
  }

  // ️ Vymazanie pozicie
  async deletePosition(positionId: string): Promise<void> {
    if (!this.db) return;
    await deleteDoc(doc(this.db, 'positions', positionId));
  }

  //  Ulozenie obchodu
  async saveTrade(trade: FirestoreTrade): Promise<void> {
    if (!this.db) return;
    await setDoc(doc(this.db, 'trades', trade.id), trade);
    
    // Aktualizuj statistiky
    const user = this._currentUser();
    const profile = this._userProfile();
    if (user && profile) {
      const newTotalTrades = profile.totalTrades + 1;
      const newTotalPnl = profile.totalPnl + (trade.pnl || 0);
      await updateDoc(doc(this.db, 'users', user.uid), {
        totalTrades: newTotalTrades,
        totalPnl: newTotalPnl
      });
      this._userProfile.set({
        ...profile,
        totalTrades: newTotalTrades,
        totalPnl: newTotalPnl
      });
    }
  }

  //  Nacitanie obchodov
  async getTrades(userId: string, limitCount = 50): Promise<FirestoreTrade[]> {
    if (!this.db) return [];
    
    const q = query(
      collection(this.db, 'trades'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as FirestoreTrade);
  }

  //  Vytvorenie price alertu
  async createPriceAlert(alert: Omit<PriceAlert, 'id'>): Promise<string> {
    if (!this.db) return '';
    
    const alertRef = await addDoc(collection(this.db, 'priceAlerts'), {
      ...alert,
      id: ''
    });
    await updateDoc(alertRef, { id: alertRef.id });
    return alertRef.id;
  }

  //  Nacitanie price alertov
  async getPriceAlerts(userId: string): Promise<PriceAlert[]> {
    if (!this.db) return [];
    
    const q = query(
      collection(this.db, 'priceAlerts'),
      where('userId', '==', userId),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as PriceAlert);
  }

  //  Deaktivacia alertu
  async deactivateAlert(alertId: string): Promise<void> {
    if (!this.db) return;
    await updateDoc(doc(this.db, 'priceAlerts', alertId), {
      isActive: false,
      triggeredAt: Date.now()
    });
  }

  //  Nacitanie leaderboardu
  async getLeaderboard(limitCount = 20): Promise<LeaderboardEntry[]> {
    if (!this.db) return [];
    
    const q = query(
      collection(this.db, 'users'),
      where('isPublic', '==', true),
      orderBy('totalPnl', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map((doc, index) => {
      const data = doc.data() as UserProfile;
      return {
        uid: data.uid,
        displayName: data.displayName,
        totalPnl: data.totalPnl,
        totalPnlPercent: (data.totalPnl / 100000) * 100,
        winRate: data.winRate,
        totalTrades: data.totalTrades,
        rank: index + 1
      };
    });
  }

  //  Nacitanie profilu ineho usera (pre copy trading)
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    if (!this.db) return null;
    
    const profileDoc = await getDoc(doc(this.db, 'users', uid));
    if (profileDoc.exists()) {
      const data = profileDoc.data() as UserProfile;
      if (data.isPublic) {
        return data;
      }
    }
    return null;
  }

  //  Nacitanie pozicii ineho usera (pre copy trading)
  async getUserPositions(uid: string): Promise<FirestorePosition[]> {
    if (!this.db) return [];
    
    // Najprv over ci je user public
    const profile = await this.getUserProfile(uid);
    if (!profile || !profile.isPublic) return [];
    
    return this.getPositions(uid);
  }

  //  Preklad error kodov
  private getErrorMessage(code: string): string {
    const messages: Record<string, string> = {
      'auth/email-already-in-use': 'Email je už zaregistrovaný',
      'auth/invalid-email': 'Neplatný email',
      'auth/weak-password': 'Heslo je príliš slabé (min. 6 znakov)',
      'auth/user-not-found': 'Používateľ neexistuje',
      'auth/wrong-password': 'Nesprávne heslo',
      'auth/popup-closed-by-user': 'Prihlásenie zrušené',
      'auth/network-request-failed': 'Chyba siete'
    };
    return messages[code] || 'Nastala chyba';
  }
}
