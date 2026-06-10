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
import { AdExportOverlay } from '@/components/app/AdExportOverlay';


const EditroyIcon = ({ className = "h-8 w-8", style }: { className?: string; style?: React.CSSProperties }) => (
  <img src="/icons/icon-192.png" alt="Editroy Logo" className={`logo-img object-contain flex-shrink-0 ${className}`} style={style} />
);

// Custom Platform-Specific PWA Install Guidance Modal
function PwaInstallModal({ isOpen, onClose, onInstall, deferredPrompt }: {
  isOpen: boolean;
  onClose: () => void;
  onInstall: () => void;
  deferredPrompt: any;
}) {
  const [activeTab, setActiveTab] = useState<'desktop' | 'android' | 'ios' | 'linux'>('desktop');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md transition-all duration-300">
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden p-6 animate-in fade-in-50 zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="p-2 bg-primary/10 rounded-xl">
            <img src="/icons/icon-192.png" alt="Editroy Logo" className="h-10 w-10 object-contain" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-headline text-foreground">Install Editroy App</h2>
            <p className="text-xs text-muted-foreground">Run natively on your device for a first-class offline workspace.</p>
          </div>
        </div>

        {/* Platform Tabs */}
        <div className="flex border-b border-border mb-6 overflow-x-auto gap-2 scrollbar-none">
          <button 
            onClick={() => setActiveTab('desktop')}
            className={`pb-2 text-xs font-semibold px-2 border-b-2 transition-all whitespace-nowrap ${activeTab === 'desktop' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            💻 Windows / Mac
          </button>
          <button 
            onClick={() => setActiveTab('android')}
            className={`pb-2 text-xs font-semibold px-2 border-b-2 transition-all whitespace-nowrap ${activeTab === 'android' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            🤖 Android
          </button>
          <button 
            onClick={() => setActiveTab('ios')}
            className={`pb-2 text-xs font-semibold px-2 border-b-2 transition-all whitespace-nowrap ${activeTab === 'ios' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            🍏 iPhone / iPad
          </button>
          <button 
            onClick={() => setActiveTab('linux')}
            className={`pb-2 text-xs font-semibold px-2 border-b-2 transition-all whitespace-nowrap ${activeTab === 'linux' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            🐧 Linux
          </button>
        </div>

        {/* Tab Content */}
        <div className="min-h-[140px] flex flex-col justify-between">
          
          {activeTab === 'desktop' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Enjoy Editroy as a full standalone desktop application. It launches in a dedicated window, works offline, and handles file edits at maximum speeds.
              </p>
              {deferredPrompt ? (
                <Button onClick={onInstall} className="w-full h-10 gap-2">
                  <Download className="h-4 w-4" /> Install Desktop App
                </Button>
              ) : (
                <p className="text-xs text-amber-500 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                  ⚠️ Direct browser install is currently unavailable (already installed or unsupported browser). You can still install by clicking the **Install Icon** in your browser's address bar.
                </p>
              )}
            </div>
          )}

          {activeTab === 'android' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Add Editroy to your Android home screen. It will open full-screen like a native application and store files locally for offline use.
              </p>
              {deferredPrompt ? (
                <Button onClick={onInstall} className="w-full h-10 gap-2">
                  <Download className="h-4 w-4" /> Install on Android
                </Button>
              ) : (
                <p className="text-xs text-amber-500 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                  ⚠️ Open this page in **Google Chrome** on your Android device to install natively, or tap the three dots **(⋮)** in Chrome and select **Add to Home screen**.
                </p>
              )}
            </div>
          )}

          {activeTab === 'ios' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Apple iOS does not support automatic web-app installation prompts. Follow these quick steps to install on your iPhone or iPad:
              </p>
              <div className="text-xs space-y-2.5 bg-muted/50 p-4 rounded-xl border border-border">
                <p className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 bg-background border border-border rounded-full font-bold">1</span>
                  <span>Open <strong>Safari</strong> and go to editroy.com.</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 bg-background border border-border rounded-full font-bold">2</span>
                  <span>Tap the <strong>Share</strong> button (the square icon with up arrow).</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 bg-background border border-border rounded-full font-bold">3</span>
                  <span>Scroll down and select <strong>"Add to Home Screen"</strong>.</span>
                </p>
              </div>
            </div>
          )}

          {activeTab === 'linux' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Run Editroy natively on your Linux desktop with full hardware acceleration.
              </p>
              {deferredPrompt ? (
                <Button onClick={onInstall} className="w-full h-10 gap-2">
                  <Download className="h-4 w-4" /> Install Linux App
                </Button>
              ) : (
                <p className="text-xs text-amber-500 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                  ⚠️ Direct install requires Chrome/Chromium. Alternatively, click the **App Install** indicator in your address bar.
                </p>
              )}
            </div>
          )}

        </div>

      </div>
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

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Ad Overlay states for handling iframe exports
  const [adOverlayOpen, setAdOverlayOpen] = useState(false);
  const [exportFileName, setExportFileName] = useState('');
  const [iframeSourceWindow, setIframeSourceWindow] = useState<any>(null);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'start-export-ad') {
        setExportFileName(e.data.fileName || 'file');
        setIframeSourceWindow(e.source);
        setAdOverlayOpen(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleAdComplete = () => {
    if (iframeSourceWindow) {
      iframeSourceWindow.postMessage({ type: 'ad-completed' }, '*');
    }
  };

  const handleAdClose = () => {
    setAdOverlayOpen(false);
    setIframeSourceWindow(null);
  };


  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Prevent spamming: only show banner if user hasn't dismissed it in the last 24 hours
      const dismissedTime = localStorage.getItem('pwa-prompt-dismissed-time');
      const now = Date.now();
      if (!dismissedTime || now - parseInt(dismissedTime) > 24 * 60 * 60 * 1000) {
        setShowBanner(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
      setIsModalOpen(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <>
      <SidebarProvider defaultOpen>
        <Sidebar Rail={<SidebarRail />} collapsible="icon" className="peer">
          <SidebarHeader className="p-3 flex items-center justify-center border-b border-sidebar-border">
            <div className="flex items-center justify-center w-full group-data-[collapsible=icon]:hidden py-3">
              <EditroyIcon className="w-auto" style={{ height: '64px' }} />
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
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5 text-xs h-8 hidden sm:flex border-primary/20 hover:bg-muted"
                onClick={() => setIsModalOpen(true)}
              >
                <Download className="h-3.5 w-3.5" /> Download App
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 sm:hidden text-foreground hover:bg-muted"
                onClick={() => setIsModalOpen(true)}
                aria-label="Download App"
              >
                <Download className="h-4 w-4" />
              </Button>
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

      {/* PWA Install Banner */}
      {showBanner && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-primary text-primary-foreground px-4 py-3 rounded-xl shadow-2xl max-w-sm w-[calc(100%-2rem)]">
          <img src="/icons/icon-192.png" alt="Editroy" className="w-8 h-8 rounded-lg flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold leading-tight">Install Editroy App</p>
            <p className="text-xs opacity-80 leading-tight">Works offline, opens like an app</p>
          </div>
          <Button size="sm" variant="secondary" className="flex-shrink-0 h-8 text-xs px-3" onClick={() => setIsModalOpen(true)}>
            <Download className="h-3 w-3 mr-1" /> Install
          </Button>
          <button 
            onClick={() => {
              setShowBanner(false);
              localStorage.setItem('pwa-prompt-dismissed-time', Date.now().toString());
            }} 
            className="text-primary-foreground/70 hover:text-primary-foreground flex-shrink-0 min-h-0 h-auto p-0" 
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Guidance Modal */}
      <PwaInstallModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onInstall={handleInstall} 
        deferredPrompt={deferredPrompt} 
      />

      <AdExportOverlay
        isOpen={adOverlayOpen}
        onClose={handleAdClose}
        onComplete={handleAdComplete}
        fileName={exportFileName}
      />
    </>
  );
}


