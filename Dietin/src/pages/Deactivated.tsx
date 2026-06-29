import React from "react";
import { Link } from "react-router-dom";

export default function Deactivated() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center text-center p-6">
      <h1 className="text-2xl font-bold mb-3">Open the app from your Home Screen</h1>
      <p className="text-muted-foreground mb-6 max-w-md">
        This app is designed to run as a PWA. Please install it to your Home Screen and open it from there.
      </p>
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          You can still access verification and password reset links in your browser:
        </p>
        <ul className="list-disc list-inside">
          <li>
            <Link to="/verify-email" className="text-primary underline">Verify Email</Link>
          </li>
          <li>
            <Link to="/reset-password" className="text-primary underline">Reset Password</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
