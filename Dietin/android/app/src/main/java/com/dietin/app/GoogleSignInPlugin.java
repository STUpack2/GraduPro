package com.dietin.app;

import android.content.Intent;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

@CapacitorPlugin(name = "GoogleSignInPlugin")
public class GoogleSignInPlugin extends Plugin {
    private static final String TAG = "GoogleSignInPlugin";
    private static final int RC_SIGN_IN = 9001;
    private GoogleSignInClient mGoogleSignInClient;

    @Override
    public void load() {
        super.load();
        initializeGoogleSignIn();
    }

    private void initializeGoogleSignIn() {
        try {
            // Get the default web client ID from the generated resources
            String webClientId = getContext().getString(getContext().getResources()
                .getIdentifier("default_web_client_id", "string", getContext().getPackageName()));
            
            Log.d(TAG, "Initializing Google Sign-In with web client ID: " + webClientId);
            
            GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                    .requestIdToken(webClientId)
                    .requestEmail()
                    .build();

            mGoogleSignInClient = GoogleSignIn.getClient(getActivity(), gso);
            Log.d(TAG, "Google Sign-In client initialized successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize Google Sign-In client", e);
        }
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        if (mGoogleSignInClient == null) {
            Log.e(TAG, "Google Sign-In client not initialized");
            call.reject("Google Sign-In client not initialized");
            return;
        }

        Intent signInIntent = mGoogleSignInClient.getSignInIntent();
        startActivityForResult(call, signInIntent, "handleSignInResult");
    }

    @ActivityCallback
    private void handleSignInResult(PluginCall call, Intent data) {
        try {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            GoogleSignInAccount account = task.getResult(ApiException.class);
            
            Log.d(TAG, "Google sign-in successful for: " + account.getEmail());
            
            JSObject result = new JSObject();
            result.put("idToken", account.getIdToken());
            result.put("email", account.getEmail());
            result.put("displayName", account.getDisplayName());
            result.put("photoUrl", account.getPhotoUrl() != null ? account.getPhotoUrl().toString() : null);
            
            call.resolve(result);
        } catch (ApiException e) {
            Log.e(TAG, "Google sign-in failed with code: " + e.getStatusCode(), e);
            call.reject("Google sign-in failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        if (mGoogleSignInClient != null) {
            mGoogleSignInClient.signOut().addOnCompleteListener(task -> {
                Log.d(TAG, "Google sign-out completed");
                call.resolve();
            });
        } else {
            call.resolve();
        }
    }
}
