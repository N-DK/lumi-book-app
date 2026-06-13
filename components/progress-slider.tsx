"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useRef } from "react";

interface ProgressSliderProps {
  value: number;
  min?: number;
  max: number;
  step?: number;
  disabled?: boolean;
  ariaLabel: string;
  valueLabel?: string;
  className?: string;
  fillColor?: string;
  trackColor?: string;
  thumbColor?: string;
  onChange: (value: number) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function snapToStep(value: number, min: number, max: number, step: number) {
  if (!Number.isFinite(step) || step <= 0) return clamp(value, min, max);

  const precision = step.toString().split(".")[1]?.length ?? 0;
  const snapped = min + Math.round((value - min) / step) * step;
  return clamp(Number(snapped.toFixed(precision + 2)), min, max);
}

export function ProgressSlider({
  value,
  min = 0,
  max,
  step = 1,
  disabled = false,
  ariaLabel,
  valueLabel,
  className,
  fillColor = "#d9b98a",
  trackColor = "#332716",
  thumbColor = fillColor,
  onChange,
}: ProgressSliderProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const safeMax = Math.max(min, max);
  const safeValue = clamp(value, min, safeMax);
  const percent = safeMax > min ? ((safeValue - min) / (safeMax - min)) * 100 : 0;

  function valueFromClientX(clientX: number) {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return safeValue;

    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return snapToStep(min + ratio * (safeMax - min), min, safeMax, step);
  }

  function updateFromClientX(clientX: number) {
    if (disabled || safeMax <= min) return;
    onChange(valueFromClientX(clientX));
  }

  function adjust(delta: number) {
    if (disabled || safeMax <= min) return;
    onChange(snapToStep(safeValue + delta, min, safeMax, step));
  }

  return (
    <div
      ref={rootRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={safeMax}
      aria-valuenow={safeValue}
      aria-valuetext={valueLabel}
      aria-disabled={disabled}
      className={cn(
        "relative h-5 min-w-0 touch-none select-none rounded-full outline-none",
        disabled ? "cursor-default opacity-45" : "cursor-pointer",
        className,
      )}
      onPointerDown={(event) => {
        if (disabled || safeMax <= min) return;
        draggingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateFromClientX(event.clientX);
      }}
      onPointerMove={(event) => {
        if (!draggingRef.current) return;
        updateFromClientX(event.clientX);
      }}
      onPointerUp={(event) => {
        draggingRef.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={(event) => {
        draggingRef.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onKeyDown={(event) => {
        if (disabled || safeMax <= min) return;

        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          event.preventDefault();
          adjust(step);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          event.preventDefault();
          adjust(-step);
        } else if (event.key === "PageUp") {
          event.preventDefault();
          adjust(step * 10);
        } else if (event.key === "PageDown") {
          event.preventDefault();
          adjust(-step * 10);
        } else if (event.key === "Home") {
          event.preventDefault();
          onChange(min);
        } else if (event.key === "End") {
          event.preventDefault();
          onChange(safeMax);
        }
      }}
    >
      <span
        className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full"
        style={{ backgroundColor: trackColor }}
      />
      <motion.span
        className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full"
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: `${percent}%`, backgroundColor: fillColor }}
      />
      <motion.span
        className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_3px_rgba(217,185,138,0.14),0_2px_8px_rgba(0,0,0,0.28)]"
        animate={{ left: `${percent}%` }}
        transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
        style={{
          left: `${percent}%`,
          backgroundColor: thumbColor,
        }}
      />
    </div>
  );
}
