"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DocumentTool } from '@/lib/tools-data';

interface DocumentToolCardProps {
  tool: DocumentTool;
  onClick: (toolId: string) => void;
}

export const DocumentToolCard: React.FC<DocumentToolCardProps> = ({ tool, onClick }) => {
  return (
    <Card 
      className={cn(
        "group relative transition-all duration-300 hover:shadow-lg h-full flex flex-col",
        tool.isPlaceholder ? "border-green-100/50 bg-green-50/10" : "hover:-translate-y-1"
      )}
    >
      {tool.isPlaceholder && (
        <Badge 
          className="absolute top-2 right-2 bg-green-500 hover:bg-green-600 text-[10px] py-0 px-2"
        >
          Coming Soon
        </Badge>
      )}
      
      <CardContent className="p-4 flex flex-col items-center text-center flex-grow">
        <div 
          className={cn(
            "w-12 h-12 rounded-xl mb-4 flex items-center justify-center text-2xl transition-transform group-hover:scale-110 shadow-sm",
            tool.isPlaceholder ? "bg-green-100 text-green-700" : "bg-primary/5 text-primary"
          )}
          style={!tool.isPlaceholder && tool.color ? { backgroundColor: `${tool.color}15`, color: tool.color } : {}}
        >
          {tool.icon}
        </div>
        
        <h3 className="font-bold text-sm mb-1 line-clamp-1">{tool.name}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-4 flex-grow">
          {tool.description}
        </p>
        
        <Button 
          variant={tool.isPlaceholder ? "secondary" : "default"}
          size="sm"
          className={cn(
            "w-full text-[11px] font-bold h-8",
            tool.isPlaceholder ? "bg-green-500 hover:bg-green-600 text-white border-none" : ""
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (!tool.isPlaceholder) onClick(tool.id);
          }}
          disabled={tool.isPlaceholder}
        >
          {tool.isPlaceholder ? "Notify Me" : "Try Tool"}
        </Button>
      </CardContent>
    </Card>
  );
};
