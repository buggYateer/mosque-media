"use client";

/**
 * A list the admin can put in order: drag a row by its handle (computer), or use the up / down
 * arrows (phones, keyboard). `onMove(from, to)` gets the old and new positions.
 */
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

export function move<T>(list: T[], from: number, to: number) {
  const a = [...list];
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x);
  return a;
}

export function Reorder<T>({
  items,
  keyOf,
  onMove,
  render,
  labels,
}: {
  items: T[];
  keyOf: (x: T) => string | number;
  onMove: (from: number, to: number) => void;
  render: (x: T, i: number) => ReactNode;
  labels: { up: string; down: string; drag: string };
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  return (
    <div>
      {items.map((x, i) => (
        <div
          key={keyOf(x)}
          onDragOver={(e) => {
            if (dragging === null) return;
            e.preventDefault();
            setOver(i);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragging !== null && dragging !== i) onMove(dragging, i);
            setDragging(null);
            setOver(null);
          }}
          className={cn("flex items-center gap-2 border-b px-2 py-2 last:border-b-0", dragging === i && "opacity-50", over === i && dragging !== i && "bg-accent")}
        >
          <span
            draggable
            onDragStart={(e) => {
              setDragging(i);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
            title={labels.drag}
            className="hidden cursor-grab text-muted-foreground active:cursor-grabbing sm:block"
          >
            <GripVertical className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-2">{render(x, i)}</div>
          <Button size="icon-sm" variant="ghost" aria-label={labels.up} disabled={i === 0} onClick={() => onMove(i, i - 1)}>
            <ArrowUp className="size-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label={labels.down} disabled={i === items.length - 1} onClick={() => onMove(i, i + 1)}>
            <ArrowDown className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
