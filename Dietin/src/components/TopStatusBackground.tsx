import React from 'react';

// Renders a white background behind the OS status bar area on iOS PWAs
// Uses env(safe-area-inset-top) so it only shows on devices with a notch/safe-area.
// The element is pointer-events-none so it doesn't block clicks.
export default function TopStatusBackground() {
  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 right-0 z-40 pointer-events-none bg-white dark:bg-black"
      style={{
        // Height equals the safe area inset on iOS; 0 elsewhere
        height: 'env(safe-area-inset-top)',
      }}
    />
  );
}
