// src/app/(main)/layout.tsx
"use client";

import type React from 'react';
import { useEffect, Suspense } from 'react';
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
import { LogOut, Settings } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Script from 'next/script';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { ErrorBoundary } from '@/components/app/error-boundary';

// Placeholder SVG for Editroy icon if lucide-react doesn't have it
const EditroyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-primary">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <path d="M12 18v-1a2 2 0 0 1 2-2h1a2 2 0 0 0 0-4h-1a2 2 0 0 1-2-2V9"></path>
      <path d="M12 12h.01"></path>
    </svg>
  );


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Skeleton className="h-12 w-12 rounded-full bg-primary/20 mb-4" />
        <Skeleton className="h-8 w-48 bg-primary/20 mb-2" />
        <Skeleton className="h-6 w-32 bg-primary/20" />
        <p className="mt-4 text-sm text-muted-foreground">Redirecting to login if not authenticated...</p>
      </div>
    );
  }

  return (
    <>
      <SidebarProvider defaultOpen>
        <Sidebar Rail={<SidebarRail />} collapsible="icon" className="peer">
          <SidebarHeader className="p-4 flex items-center gap-2">
            <div className="flex items-center gap-2">
              <EditroyIcon />
              <h1 className="text-2xl font-headline font-semibold text-primary group-data-[collapsible=icon]:hidden">Editroy</h1>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarNav />
          </SidebarContent>
          <SidebarFooter className="p-4 mt-auto border-t border-sidebar-border group-data-[collapsible=icon]:p-2">
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
              <Avatar className="h-9 w-9">
                <AvatarImage src="https://placehold.co/40x40.png" alt="User Avatar" data-ai-hint="avatar person" />
                <AvatarFallback>FF</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-sidebar-foreground">User</p>
                <p className="text-xs text-sidebar-foreground/70">user@editroy.com</p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center"
              onClick={logout}
              aria-label="Logout"
            >
              <LogOut className="h-5 w-5 mr-2 group-data-[collapsible=icon]:mr-0" />
              <span className="group-data-[collapsible=icon]:hidden">Logout</span>
            </Button>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="sticky top-0 z-10 flex items-center justify-between h-16 px-4 bg-background/80 backdrop-blur-sm border-b">
            <div className="flex items-center">
              <SidebarTrigger className="md:hidden" />
              <SidebarTrigger className="hidden md:flex" />
            </div>
            <div className="flex items-center gap-4">
               <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
            <ErrorBoundary>
              <Suspense fallback={<div className="space-y-4"><Skeleton className="h-12 w-1/3"/><Skeleton className="h-[400px] w-full"/></div>}>
                  {children}
              </Suspense>
            </ErrorBoundary>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
