import { useUserStore } from "@/stores/userStore";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface ProFeaturesProps {
  children: React.ReactNode;
  showOnlyForNonPro?: boolean;
}

export default function ProFeatures({ children, showOnlyForNonPro = false }: ProFeaturesProps) {
  const [isPro, setIsPro] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Only set up listener if user is authenticated
    if (!auth.currentUser) {
      setIsLoading(false);
      return;
    }

    // Set up real-time listener for user's pro status
    const unsubscribe = onSnapshot(doc(db, "users", auth.currentUser.uid), (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        setIsPro(userData.isPro || false);
      } else {
        setIsPro(false);
      }
      setIsLoading(false);
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return null;
  }

  // If showOnlyForNonPro is true, only show content when user is NOT pro
  if (showOnlyForNonPro) {
    return !isPro ? <>{children}</> : null;
  }

  // Otherwise, only show content when user IS pro
  return isPro ? <>{children}</> : null;
} 