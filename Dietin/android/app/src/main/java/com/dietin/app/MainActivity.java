package com.dietin.app;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private static final int RC_SIGN_IN = 9001;
    private GoogleSignInClient mGoogleSignInClient;
    private String currentCallback = null;
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Check Google Play Services availability
        checkGooglePlayServices();
        
        // Initialize Google Sign-In
        initializeGoogleSignIn();
        
        // Add JavaScript interface to WebView (ensure it's added after WebView is ready)
        addJavaScriptInterface();
    }
    
    @Override
    protected void onResume() {
        super.onResume();
        // Re-add interface on resume to ensure it's always available
        addJavaScriptInterface();
    }
    
    private void addJavaScriptInterface() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().post(() -> {
                Log.d(TAG, "Adding AndroidInterface to WebView");
                getBridge().getWebView().addJavascriptInterface(new AndroidInterface(), "AndroidInterface");
                
                // Verify the interface was added by executing a test script
                getBridge().getWebView().evaluateJavascript(
                    "console.log('AndroidInterface available:', typeof window.AndroidInterface !== 'undefined');", 
                    null
                );
            });
        } else {
            Log.w(TAG, "WebView not ready, retrying AndroidInterface injection in 500ms");
            new android.os.Handler().postDelayed(this::addJavaScriptInterface, 500);
        }
    }
    
    private void initializeGoogleSignIn() {
        try {
            String webClientId = getString(getResources()
                .getIdentifier("default_web_client_id", "string", getPackageName()));
            
            Log.d(TAG, "Initializing Google Sign-In with web client ID: " + webClientId);
            
            GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                    .requestIdToken(webClientId)
                    .requestEmail()
                    .build();

            mGoogleSignInClient = GoogleSignIn.getClient(this, gso);
            Log.d(TAG, "Google Sign-In client initialized successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize Google Sign-In client", e);
        }
    }
    
    public class AndroidInterface {
        @JavascriptInterface
        public void signInWithGoogle(String callbackName) {
            Log.d(TAG, "JavaScript interface signInWithGoogle called with callback: " + callbackName);
            currentCallback = callbackName;
            
            if (mGoogleSignInClient == null) {
                executeCallback(false, "{\"message\": \"Google Sign-In client not initialized\"}");
                return;
            }
            
            Intent signInIntent = mGoogleSignInClient.getSignInIntent();
            startActivityForResult(signInIntent, RC_SIGN_IN);
        }
    }
    
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        
        if (requestCode == RC_SIGN_IN) {
            try {
                Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
                GoogleSignInAccount account = task.getResult(ApiException.class);
                
                Log.d(TAG, "Google sign-in successful for: " + account.getEmail());
                
                String result = "{\"idToken\": \"" + account.getIdToken() + "\", " +
                               "\"email\": \"" + account.getEmail() + "\", " +
                               "\"displayName\": \"" + (account.getDisplayName() != null ? account.getDisplayName() : "") + "\"}";
                
                executeCallback(true, result);
            } catch (ApiException e) {
                Log.e(TAG, "Google sign-in failed with code: " + e.getStatusCode(), e);
                executeCallback(false, "{\"message\": \"Google sign-in failed: " + e.getMessage() + "\"}");
            }
        }
    }
    
    private void executeCallback(boolean success, String data) {
        if (currentCallback != null) {
            String script = currentCallback + "(" + success + ", " + data + ");";
            Log.d(TAG, "Executing callback: " + script);
            
            getBridge().getWebView().post(() -> {
                getBridge().getWebView().evaluateJavascript(script, null);
            });
            
            currentCallback = null;
        }
    }
    
    private void checkGooglePlayServices() {
        GoogleApiAvailability googleApiAvailability = GoogleApiAvailability.getInstance();
        int status = googleApiAvailability.isGooglePlayServicesAvailable(this);
        
        if (status != ConnectionResult.SUCCESS) {
            Log.e(TAG, "Google Play Services not available. Status: " + status);
            if (googleApiAvailability.isUserResolvableError(status)) {
                googleApiAvailability.getErrorDialog(this, status, 2404).show();
            }
        } else {
            Log.d(TAG, "Google Play Services available and up to date");
        }
    }
}
