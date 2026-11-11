import { Navigate } from "react-router";

import { useAuthContext } from "@/contexts/AuthContext";
import { takePendingPairRedirect } from "@/lib/pending-pair";
import LandingPage from "@/app/landing/page";

/**
 * Root route. Renders the chat/discovery app for authenticated users and the
 * public landing page (landing) for guests.
 *
 * AuthContext only mounts route children once auth has settled (it shows a
 * loading screen while pending).
 */
function RootPage() {
  const { isAuthenticated } = useAuthContext();

  if (isAuthenticated) {
    // Dinner Network is the product entry point for this fork. Keep any
    // protocol handoff intact, then send authenticated people to dinner flow.
    const pendingPairPath = takePendingPairRedirect();
    if (pendingPairPath) return <Navigate to={pendingPairPath} replace />;
    return <Navigate to="/dinners" replace />;
  }

  return <LandingPage />;
}

export default RootPage;
export const Component = RootPage;
