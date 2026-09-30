"use client";

import { Maximize2, Minimize2, Minus, X } from "lucide-react";
import { useRef } from "react";
import type { Area, Win } from "@/lib/desktop/windows";
import { cn } from "@/lib/utils";
import { AppTile } from "./app-icons";

interface Props {
  win: Win;
  title: string;
  subtitle?: string;
  focused: boolean;
  compact: boolean;
  area: Area;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onToggleMax: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
  children: React.ReactNode;
}

/** A desktop window: title bar to drag (double-click to maximise), controls, a resize grip, and a body that is its own
 *  size container, so the apps inside lay out by the window's width rather than the screen's. */
export function WindowFrame({ win, title, subtitle, focused, compact, onFocus, onClose, onMinimize, onToggleMax, onMove, onResize, children }: Props) {
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const size = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const full = compact || win.maximized;

  return (
    <section
      aria-label={title}
      data-window={win.key}
      onPointerDownCapture={onFocus}
      className={cn(
        "window-in absolute flex flex-col overflow-hidden border bg-surface-1 transition-[box-shadow,border-color] duration-150",
        full ? "inset-0 rounded-none border-0" : "rounded-[10px]",
        focused ? "border-line-strong shadow-window" : "border-line shadow-window-idle",
        win.minimized && "hidden",
      )}
      style={full ? { zIndex: win.z } : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }}
    >
      <header
        className={cn("flex h-[34px] shrink-0 select-none items-center gap-2 border-b border-line px-2", focused ? "bg-surface-2" : "bg-surface-1")}
        onDoubleClick={() => !compact && onToggleMax()}
        onPointerDown={(e) => {
          if (full || e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
          drag.current = { dx: e.clientX - win.x, dy: e.clientY - win.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => drag.current && onMove(e.clientX - drag.current.dx, e.clientY - drag.current.dy)}
        onPointerUp={() => (drag.current = null)}
        style={{ cursor: full ? "default" : "grab" }}
      >
        <AppTile app={win.app} size={20} className="rounded-[6px]" />
        <h2 className={cn("min-w-0 truncate text-sm font-semibold", focused ? "text-foreground" : "text-text-2")}>{title}</h2>
        {subtitle && <span className="hidden min-w-0 truncate font-mono text-xs text-text-2 sm:inline">{subtitle}</span>}
        <div className="ml-auto flex items-center gap-0.5">
          {!compact && (
            <>
              <button type="button" onClick={onMinimize} aria-label={`Minimise ${title}`} className="win-btn">
                <Minus className="size-3.5" />
              </button>
              <button type="button" onClick={onToggleMax} aria-label={win.maximized ? `Restore ${title}` : `Maximise ${title}`} className="win-btn">
                {win.maximized ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
              </button>
            </>
          )}
          <button type="button" onClick={onClose} aria-label={`Close ${title}`} className="win-btn hover:!bg-st-failed hover:!text-white">
            <X className="size-3.5" />
          </button>
        </div>
      </header>
      <div className="@container min-h-0 flex-1 overflow-auto p-4">{children}</div>
      {!full && (
        <div
          aria-hidden
          className="absolute right-0 bottom-0 size-4 cursor-nwse-resize"
          onPointerDown={(e) => {
            size.current = { x: e.clientX, y: e.clientY, w: win.w, h: win.h };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => size.current && onResize(size.current.w + e.clientX - size.current.x, size.current.h + e.clientY - size.current.y)}
          onPointerUp={() => (size.current = null)}
        />
      )}
    </section>
  );
}
