import { registerPlugin } from '@capacitor/core';

export interface GoogleSignInPlugin {
  signIn(): Promise<{
    idToken: string;
    email: string;
    displayName: string;
    photoUrl?: string;
  }>;
  signOut(): Promise<void>;
}

const GoogleSignInPlugin = registerPlugin<GoogleSignInPlugin>('GoogleSignInPlugin');

export default GoogleSignInPlugin;
