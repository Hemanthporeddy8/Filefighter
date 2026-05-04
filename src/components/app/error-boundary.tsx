// src/components/app/error-boundary.tsx
"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
          return this.props.fallback;
      }
      return (
        <div className="flex items-center justify-center min-h-[400px] p-4">
            <Card className="w-full max-w-md border-destructive/50">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-4 p-3 rounded-full bg-destructive/10 text-destructive w-fit">
                        <AlertTriangle size={32} />
                    </div>
                    <CardTitle className="text-2xl font-headline text-destructive">Something went wrong</CardTitle>
                    <CardDescription>
                        A component crashed. We have caught the error to prevent the entire app from failing.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="bg-muted p-4 rounded-md text-sm font-mono overflow-auto max-h-[150px] text-muted-foreground">
                        {this.state.error?.message || "Unknown error"}
                    </div>
                </CardContent>
                <CardFooter>
                    <Button 
                        variant="outline" 
                        className="w-full" 
                        onClick={() => this.setState({ hasError: false, error: null })}
                    >
                        <RefreshCw className="mr-2 h-4 w-4" /> Try Again
                    </Button>
                </CardFooter>
            </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
