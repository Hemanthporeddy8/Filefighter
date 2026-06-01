// src/app/(main)/layout.tsx
"use client";

import type React from 'react';
import { useEffect, Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
  SidebarRail,
} from '@/components/ui/sidebar';
import { SidebarNav } from '@/components/app/sidebar-nav';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, Download, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { ErrorBoundary } from '@/components/app/error-boundary';

const EditroyIcon = ({ className = "h-8 w-8" }: { className?: string }) => (
  <img src="/icons/icon-192.png" alt="Editroy Logo" className={`logo-img object-contain flex-shrink-0 ${className}`} />
);

// PWA Install Banner
function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!show || !deferredPrompt) return null;

  const handleInstall = async () => {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShow(false);
    setDeferredPrompt(null);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-primary text-primary-foreground px-4 py-3 rounded-xl shadow-2xl max-w-sm w-[calc(100%-2rem)]">
      <img src="/icons/icon-192.png" alt="Editroy" className="w-8 h-8 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold leading-tight">Install Editroy App</p>
        <p className="text-xs opacity-80 leading-tight">Works offline, opens like an app</p>
      </div>
      <Button size="sm" variant="secondary" className="flex-shrink-0 h-8 text-xs px-3" onClick={handleInstall}>
        <Download className="h-3 w-3 mr-1" /> Install
      </Button>
      <button onClick={() => setShow(false)} className="text-primary-foreground/70 hover:text-primary-foreground flex-shrink-0 min-h-0 h-auto p-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { logout } = useAuth();
  const router = useRouter();

  return (
    <>
      <SidebarProvider defaultOpen>
        <Sidebar Rail={<SidebarRail />} collapsible="icon" className="peer">
          <SidebarHeader className="p-3 flex items-center justify-center border-b border-sidebar-border">
            <div className="flex items-center justify-center w-full group-data-[collapsible=icon]:hidden py-1">
              <EditroyIcon className="h-10 w-auto" />
            </div>
            <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center w-full">
              <EditroyIcon className="h-8 w-8" />
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarNav />
          </SidebarContent>
          <SidebarFooter className="p-3 mt-auto border-t border-sidebar-border group-data-[collapsible=icon]:p-2">
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden min-w-0">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src="/icons/icon-192.png" alt="User" />
                <AvatarFallback>E</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">User</p>
                <p className="text-xs text-sidebar-foreground/70 truncate">editroy.com</p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center mt-2"
              onClick={logout}
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4 mr-2 group-data-[collapsible=icon]:mr-0" />
              <span className="group-data-[collapsible=icon]:hidden">Logout</span>
            </Button>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="min-w-0">
          {/* Responsive sticky header */}
          <header className="sticky top-0 z-10 flex items-center justify-between h-14 px-3 sm:px-4 bg-background/90 backdrop-blur-sm border-b gap-2">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </header>

          {/* Responsive main content */}
          <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto min-w-0">
            <ErrorBoundary>
              <Suspense fallback={
                <div className="space-y-4">
                  <Skeleton className="h-10 w-2/3"/>
                  <Skeleton className="h-48 w-full"/>
                  <Skeleton className="h-48 w-full"/>
                </div>
              }>
                {children}
              </Suspense>
            </ErrorBoundary>
          </main>
        </SidebarInset>
      </SidebarProvider>

      {/* PWA Install Banner (shows automatically on Android Chrome) */}
      <InstallBanner />
    </>
  );
}


