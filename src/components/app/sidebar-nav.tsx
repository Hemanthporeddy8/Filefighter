// src/components/app/sidebar-nav.tsx
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Printer,
  ImageIcon as ImageIconLucide,
  Copy,
  Files,
  Image,
  Video,
  Pencil,
  Receipt,
  Download,
  Languages,
  GraduationCap,
  Wand2,
  Lock,
  FilePenLine,
  UserSquare,
  Eraser,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/id-copier', label: 'ID & Photo Studio', icon: UserSquare },
  { href: '/print-setup', label: 'Print Setup', icon: Printer },
  { href: '/image-editor', label: 'Image Editor', icon: Image },
  { href: '/video-editor', label: 'Video Editor', icon: Video },
  { href: '/content-editor', label: 'Content Editor', icon: FilePenLine },
  { href: '/document-utilities', label: 'Document Utilities', icon: Files },
  { href: '/multi-language', label: 'Multi-Language', icon: Languages },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <Link href={item.href}>
            <SidebarMenuButton
              className={cn(
                pathname === item.href
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                'w-full justify-start'
              )}
              isActive={pathname === item.href}
              tooltip={{content: item.label, side: "right", align: "center"}}
            >
              <item.icon className="h-5 w-5 mr-2 shrink-0" />
              <span className="truncate">{item.label}</span>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
