import React, { useState } from 'react';

// Define a global counter for image load attempts
if (typeof window !== 'undefined' && !window.imageLoadAttempts) {
  window.imageLoadAttempts = new Map();
}

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  width?: number;
  height?: number;
  priority?: boolean;
  onLoadingComplete?: () => void;
}

// Helper function to check if the src is an imported asset (object with default property)
const isImportedAsset = (src: any): boolean => {
  return typeof src === 'object' && src !== null && 'default' in src;
};

export const Image: React.FC<ImageProps> = ({
  src,
  alt = '',
  width,
  height,
  className,
  priority,
  onLoadingComplete,
  onLoad,
  onError,
  ...props
}) => {
  // For imported assets, use the actual path
  const resolvedSrc = isImportedAsset(src) ? src.default : src;
  
  // Get initial path based on environment
  const initialSrc = resolvedSrc;
  const [imgSrc, setImgSrc] = useState(initialSrc);
  const [loaded, setLoaded] = useState(false);
  
  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.log(`Image loaded successfully: ${imgSrc}`);
    setLoaded(true);
    if (onLoad) onLoad(e);
    if (onLoadingComplete) onLoadingComplete();
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    console.error(`Failed to load image: ${imgSrc}`);
    
    // Only try alternative paths for string URLs, not imported assets
    if (typeof initialSrc === 'string' && !imgSrc?.includes('placeholder')) {
      // Get number of attempts for this image
      const attempts = window.imageLoadAttempts.get(initialSrc) || 0;
      
      // Try different path formats based on attempt number
      if (attempts === 0) {
        // First attempt: if path has leading slash, try with dot prefix
        if (imgSrc?.startsWith('/')) {
          const newSrc = `.${imgSrc}`;
          console.log(`Trying alternate path format: ${newSrc}`);
          setImgSrc(newSrc);
        } else if (imgSrc?.startsWith('./')) {
          // If path has dot prefix, try without it
          const newSrc = imgSrc.substring(1);
          console.log(`Trying alternate path format: ${newSrc}`);
          setImgSrc(newSrc);
        }
      } else if (attempts === 1) {
        // Second attempt: try path without any prefixes, just the filename
        const filename = imgSrc?.split('/').pop();
        if (filename) {
          const newSrc = `images/${filename}`;
          console.log(`Trying just the filename: ${newSrc}`);
          setImgSrc(newSrc);
        }
      } else {
        // Last attempt: call user's onError handler
        console.error(`All attempts failed for: ${initialSrc}`);
        if (onError) onError(e);
      }
      
      // Update attempt counter
      window.imageLoadAttempts.set(initialSrc, attempts + 1);
    } else if (onError) {
      // For imported assets or after all path attempts, call user's onError
      onError(e);
    }
  };

  return (
    <div className="relative w-full h-full">
      <img
        src={imgSrc}
        alt={alt}
        width={width}
        height={height}
        className={className}
        loading={priority ? 'eager' : 'lazy'}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800/30 text-white text-xs rounded">
          <p>Loading image...</p>
          <p className="text-xs mt-1 opacity-70">
            {typeof imgSrc === 'string' ? imgSrc.split('/').pop() : 'image'}
          </p>
        </div>
      )}
    </div>
  );
};

// Add this to Window interface to avoid TypeScript errors
declare global {
  interface Window {
    imageLoadAttempts: Map<string, number>;
  }
}

export default Image; 