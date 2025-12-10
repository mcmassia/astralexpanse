// Firebase configuration and initialization
import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, reauthenticateWithPopup } from 'firebase/auth';
import type { Auth, User } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Firebase config - will be loaded from environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Google access tokens last ~1 hour (3600 seconds)
const TOKEN_LIFETIME_MS = 55 * 60 * 1000; // 55 minutes to be safe

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let googleProvider: GoogleAuthProvider;

export const initializeFirebase = () => {
    if (!app) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        googleProvider = new GoogleAuthProvider();
        // Request Drive API scope for file access
        googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
    }
    return { app, auth, db };
};

// Store token with expiration time
const storeAccessToken = (accessToken: string) => {
    const expiresAt = Date.now() + TOKEN_LIFETIME_MS;
    sessionStorage.setItem('googleAccessToken', accessToken);
    sessionStorage.setItem('googleAccessTokenExpiresAt', expiresAt.toString());
    return expiresAt;
};

export const signInWithGoogle = async () => {
    const { auth } = initializeFirebase();
    try {
        const result = await signInWithPopup(auth, googleProvider);
        // Get the Google Access Token for Drive API
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const accessToken = credential?.accessToken;

        // Store access token with expiration for Drive API calls
        if (accessToken) {
            storeAccessToken(accessToken);
        }

        return result.user;
    } catch (error) {
        console.error('Error signing in with Google:', error);
        throw error;
    }
};

// Refresh Google Access Token by re-authenticating
export const refreshGoogleAccessToken = async (): Promise<{ success: boolean; expiresAt?: number }> => {
    const { auth } = initializeFirebase();
    const user = auth.currentUser;

    if (!user) {
        console.warn('[Auth] No user logged in, cannot refresh token');
        return { success: false };
    }

    try {
        console.log('[Auth] Attempting to refresh Google access token...');
        const result = await reauthenticateWithPopup(user, googleProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const accessToken = credential?.accessToken;

        if (accessToken) {
            const expiresAt = storeAccessToken(accessToken);
            console.log('[Auth] Token refreshed successfully, expires at:', new Date(expiresAt).toLocaleTimeString());
            return { success: true, expiresAt };
        }

        return { success: false };
    } catch (error) {
        console.error('[Auth] Error refreshing Google access token:', error);
        return { success: false };
    }
};

export const signOutUser = async () => {
    const { auth } = initializeFirebase();
    await signOut(auth);
    sessionStorage.removeItem('googleAccessToken');
    sessionStorage.removeItem('googleAccessTokenExpiresAt');
};

export const onAuthChange = (callback: (user: User | null) => void) => {
    const { auth } = initializeFirebase();
    return onAuthStateChanged(auth, callback);
};

export const getFirebaseAuth = () => {
    initializeFirebase();
    return auth;
};

export const getFirestoreDb = () => {
    initializeFirebase();
    return db;
};

export const getGoogleAccessToken = () => {
    return sessionStorage.getItem('googleAccessToken');
};

export const getGoogleAccessTokenExpiration = (): number | null => {
    const expiresAt = sessionStorage.getItem('googleAccessTokenExpiresAt');
    return expiresAt ? parseInt(expiresAt, 10) : null;
};

export const isGoogleAccessTokenExpired = (): boolean => {
    const expiresAt = getGoogleAccessTokenExpiration();
    if (!expiresAt) return true;
    // Consider expired 5 minutes before actual expiration
    return Date.now() > (expiresAt - 5 * 60 * 1000);
};
