import { ReactNode } from "react";
import { ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ConfigurationRowProps {
  title: string;
  description: string;
  infoText?: ReactNode;
  statusNode?: ReactNode;
  metadataNode?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function ConfigurationRow({
  title,
  description,
  infoText,
  statusNode,
  metadataNode,
  onClick,
  className
}: ConfigurationRowProps) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "group flex items-center justify-between p-4 border-b border-border bg-background hover:bg-muted/40 transition-colors",
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className="flex flex-col gap-1 pr-6">
        <div className="flex items-center gap-3">
          <span className="text-[14px] font-medium text-foreground">{title}</span>
          {infoText && (
            <div onClick={(e) => e.stopPropagation()}>
              <TooltipProvider>
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground transition-colors cursor-help">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs font-normal">
                    {infoText}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          {statusNode}
        </div>
        <span className="text-[13px] text-muted-foreground line-clamp-1">
          {description}
        </span>
      </div>
      
      <div className="flex items-center gap-6 shrink-0">
        {metadataNode && (
          <div className="text-[13px] text-muted-foreground">
            {metadataNode}
          </div>
        )}
        {onClick && (
          <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
        )}
      </div>
    </div>
  );
}
