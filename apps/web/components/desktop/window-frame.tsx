"use client";

import { Minus, Plus, X } from "lucide-react";
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

/** The three macOS window buttons. Their glyphs show when the pointer is over the group; grey when the window is behind. */
function TrafficLights(props: { focused: boolean; title: string; compact: boolean; maximized: boolean; onClose: () => void; onMinimize: () => void; onToggleMax: () => void }) {
  const { focused, title, compact, maximized, onClose, onMinimize, onToggleMax } = props;
  const dot = "flex size-3 items-center justify-center rounded-full ring-[0.5px] ring-black/15 transition-colors";
  const off = "bg-[#d3d5d9] dark:bg-[#4a4f57]";
  return (
    <div className="group/tl relative z-10 flex items-center gap-2 pl-1" onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" onClick={onClose} aria-label={`Close ${title}`} className={cn(dot, focused ? "bg-tl-close" : off, "group-hover/tl:bg-tl-close")}>
        <X className="size-2 text-black/60 opacity-0 group-hover/tl:opacity-100" strokeWidth={3} />
      </button>
      {!compact && (
        <>
          <button type="button" onClick={onMinimize} aria-label={`Minimise ${title}`} className={cn(dot, focused ? "bg-tl-min" : off, "group-hover/tl:bg-tl-min")}>
            <Minus className="size-2 text-black/60 opacity-0 group-hover/tl:opacity-100" strokeWidth={3} />
          </button>
          <button type="button" onClick={onToggleMax} aria-label={maximized ? `Restore ${title}` : `Maximise ${title}`} className={cn(dot, focused ? "bg-tl-max" : off, "group-hover/tl:bg-tl-max")}>
            <Plus className="size-2 text-black/60 opacity-0 group-hover/tl:opacity-100" strokeWidth={3} />
          </button>
        </>
      )}
    </div>
  );
}

/** A macOS-style window: traffic lights, a title bar you drag (double-click to zoom), a resize grip, and a body that is
 *  its own size container, so apps lay out by the window's width rather than the screen's. */
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
        "window-in absolute flex flex-col overflow-hidden bg-surface-1 transition-shadow duration-200",
        full ? "inset-0 rounded-none" : "rounded-[12px]",
        focused ? "shadow-window" : "shadow-window-idle",
        win.docked && !full && "dock-left-in",
        win.minimized && "hidden",
      )}
      style={full ? { zIndex: win.z } : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }}
    >
      <header
        className={cn("relative flex h-[38px] shrink-0 select-none items-center border-b border-hairline px-3", focused ? "bg-surface-2" : "bg-surface-1")}
        onDoubleClick={() => !compact && onToggleMax()}
        onPointerDown={(e) => {
          if (full || e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
          drag.current = { dx: e.clientX - win.x, dy: e.clientY - win.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => drag.current && onMove(e.clientX - drag.current.dx, e.clientY - drag.current.dy)}
        onPointerUp={() => (drag.current = null)}
      >
        <TrafficLights focused={focused} title={title} compact={compact} maximized={win.maximized} onClose={onClose} onMinimize={onMinimize} onToggleMax={onToggleMax} />
        <div className="pointer-events-none absolute inset-x-20 flex min-w-0 items-center justify-center gap-2">
          <AppTile app={win.app} size={16} />
          <h2 className={cn("min-w-0 truncate text-[13px] font-semibold", focused ? "text-foreground" : "text-text-2")}>{title}</h2>
          {subtitle && <span className="hidden min-w-0 truncate font-mono text-[11px] text-text-2 sm:inline">{subtitle}</span>}
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
