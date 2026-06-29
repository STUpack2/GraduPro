import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dietin.app',
  appName: 'Dietin',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#FFFFFF",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    Browser: {
      androidWindowInsets: {
        displayCutout: "always"
      }
    }
  },
  server: {
    // Use standard scheme/host to avoid Android WebView 117+ and gapi CORS issues
    androidScheme: "https",
    hostname: "localhost",
    cleartext: true
  }
};

export default config;
