"use client"

import * as React from "react"
import { Moon, Sun, Palette } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"

const colorThemes = [
    { name: 'Slate', class: '' }, // Default
    { name: 'Coral', class: 'theme-coral' },
    { name: 'Rose', class: 'theme-rose' },
    { name: 'Blue', class: 'theme-blue' },
    { name: 'Green', class: 'theme-green' },
];
const themeClasses = colorThemes.map(t => t.class).filter(Boolean);

export function ThemeToggle() {
  const { setTheme: setMode } = useTheme()

  React.useEffect(() => {
    const savedTheme = localStorage.getItem('color-theme') || '';
    if (savedTheme) {
        document.documentElement.classList.add(savedTheme);
    }
  }, []);

  const setColorTheme = (theme: string) => {
    document.documentElement.classList.remove(...themeClasses);
    if(theme) {
        document.documentElement.classList.add(theme);
    }
    localStorage.setItem('color-theme', theme);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setMode("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setMode("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setMode("system")}>
          System
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
            <DropdownMenuSubTrigger>
                <Palette className="mr-2" />
                <span>Color Theme</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
                {colorThemes.map(theme => (
                    <DropdownMenuItem key={theme.name} onClick={() => setColorTheme(theme.class)}>
                        {theme.name}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
