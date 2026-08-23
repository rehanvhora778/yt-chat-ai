/**
 * components/layout/AppShell.jsx
 * ------------------------------
 * Layout route for everything behind authentication: navigation rail, top bar
 * and the shared workspace data provider. Pages render into the <Outlet/>.
 */

import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import Loader from "../Loader";
import { WorkspaceProvider } from "../../context/WorkspaceContext";

const AppShell = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the mobile drawer whenever the route changes
  useEffect(() => setSidebarOpen(false), [pathname]);

  return (
    <WorkspaceProvider>
      <div className="min-h-screen">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="lg:pl-[248px]">
          <Topbar onOpenSidebar={() => setSidebarOpen(true)} />

          <main className="min-h-[calc(100vh-4rem)]">
            <Suspense
              fallback={
                <div className="flex min-h-[60vh] items-center justify-center">
                  <Loader label="Loading..." />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </WorkspaceProvider>
  );
};

export default AppShell;
