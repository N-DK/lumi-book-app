"use client";

import { PRESET_SCENES } from "@/lib/lumi-data";
import { cn } from "@/lib/utils";
import {
  CircleDot,
  CloudRain,
  Film,
  ImagePlus,
  Link2,
  Map,
  Moon,
  SlidersHorizontal,
  Sun,
} from "lucide-react";
import { useState } from "react";

function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Không đọc được ảnh nền."));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Không đọc được ảnh nền."));
    reader.readAsDataURL(file);
  });
}

interface SpacePanelProps {
  background: string;
  setBackground: (v: string) => void;
  dark: boolean;
  setDark: (v: boolean) => void;
  rain: boolean;
  setRain: (v: boolean) => void;
}

export function SpacePanel({
  background,
  setBackground,
  dark,
  setDark,
  rain,
  setRain,
}: SpacePanelProps) {
  const [url, setUrl] = useState("");
  const [activePanel, setActivePanel] = useState<
    "settings" | "scenes" | "media" | null
  >(null);

  function applyUrl() {
    const v = url.trim();
    if (!v) return;
    setBackground(`url("${v}") center/cover no-repeat`);
  }

  async function handleUpload(file: File | null) {
    if (!file) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setBackground(`url("${dataUrl}") center/cover no-repeat`);
      setActivePanel(null);
    } catch (error) {
      console.warn("Không đọc được ảnh nền.", error);
    }
  }

  function togglePanel(panel: NonNullable<typeof activePanel>) {
    setActivePanel((current) => (current === panel ? null : panel));
  }

  return (
    <div className="relative flex w-full justify-center lg:justify-end">
      {activePanel && (
        <div className="absolute right-20 top-2 z-20 w-72 rounded-2xl border border-white/10 bg-black/80 p-3 text-white shadow-2xl backdrop-blur-xl">
          {(activePanel === "settings" || activePanel === "scenes") && (
            <div className="grid grid-cols-3 gap-2">
              {PRESET_SCENES.map((scene) => {
                const active = background === scene.css;
                return (
                  <button
                    key={scene.id}
                    onClick={() => setBackground(scene.css)}
                    className={cn(
                      "h-14 overflow-hidden rounded-md border transition",
                      active
                        ? "border-[#e8c98d] ring-2 ring-[#e8c98d]/40"
                        : "border-white/10 hover:border-white/35",
                    )}
                    style={{ background: scene.css }}
                    title={scene.name}
                    aria-label={`Cảnh ${scene.name}`}
                    aria-pressed={active}
                  />
                );
              })}
            </div>
          )}

          {(activePanel === "settings" || activePanel === "media") && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3">
                <Link2 className="size-4 shrink-0 text-white/45" />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyUrl()}
                  placeholder="https://..."
                  className="min-w-0 flex-1 bg-transparent py-2 text-xs text-white outline-none placeholder:text-white/35"
                />
                <button
                  onClick={applyUrl}
                  className="rounded-full bg-white/10 px-3 py-1 text-[10px] text-white/75 transition hover:bg-white/[0.18]"
                >
                  OK
                </button>
              </div>

              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-dashed border-white/15 bg-white/[0.04] py-2 text-xs text-white/65 transition hover:border-white/35 hover:text-white">
                <ImagePlus className="size-4" />
                Ảnh nền
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void handleUpload(e.target.files?.[0] ?? null);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          )}

          {activePanel === "settings" && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => setDark(!dark)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-full border py-2 text-xs transition",
                  dark
                    ? "border-[#e8c98d]/45 bg-[#e8c98d]/12 text-[#f5ddb0]"
                    : "border-white/10 bg-white/[0.04] text-white/65 hover:text-white",
                )}
                aria-label="Đổi chế độ sáng tối"
              >
                {dark ? (
                  <Moon className="size-4" />
                ) : (
                  <Sun className="size-4" />
                )}
              </button>
              <button
                onClick={() => setRain(!rain)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-full border py-2 text-xs transition",
                  rain
                    ? "border-[#9ec6ff]/45 bg-[#9ec6ff]/12 text-[#cfe2ff]"
                    : "border-white/10 bg-white/[0.04] text-white/65 hover:text-white",
                )}
                aria-label="Bật tắt hiệu ứng mưa"
                aria-pressed={rain}
              >
                <CloudRain className="size-4" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex w-16 flex-col items-center rounded-full bg-black/30 px-2 py-6 shadow-[0_18px_45px_rgba(0,0,0,0.38)] ring-1 ring-white/[0.08] backdrop-blur-md">
        <button
          onClick={() => togglePanel("settings")}
          className={cn(
            "flex size-11 items-center justify-center rounded-full text-white/40 transition hover:bg-white/[0.08] hover:text-white/75",
            activePanel === "settings" && "bg-white/10 text-white/80",
          )}
          aria-label="Không gian"
          aria-pressed={activePanel === "settings"}
          title="Không gian"
        >
          <SlidersHorizontal className="size-6" />
        </button>

        <span className="my-3 h-px w-9 bg-white/[0.18]" />

        <button
          onClick={() => togglePanel("scenes")}
          className={cn(
            "flex size-11 items-center justify-center rounded-full text-white/40 transition hover:bg-white/[0.08] hover:text-white/75",
            activePanel === "scenes" && "bg-white/10 text-white/80",
          )}
          aria-label="Cảnh nền"
          aria-pressed={activePanel === "scenes"}
          title="Cảnh nền"
        >
          <Map className="size-7" />
        </button>

        <span className="my-3 h-px w-9 bg-white/[0.18]" />

        <button
          onClick={() => togglePanel("media")}
          className={cn(
            "flex size-11 items-center justify-center rounded-full text-white/40 transition hover:bg-white/[0.08] hover:text-white/75",
            activePanel === "media" && "bg-white/10 text-white/80",
          )}
          aria-label="Ảnh nền"
          aria-pressed={activePanel === "media"}
          title="Ảnh nền"
        >
          <Film className="size-7" />
        </button>

        <span className="my-3 h-px w-9 bg-white/[0.18]" />

        <button
          onClick={() => setDark(!dark)}
          className={cn(
            "flex size-11 items-center justify-center rounded-full text-white/40 transition hover:bg-white/[0.08] hover:text-white/75",
            dark && "bg-white/10 text-white/80",
          )}
          aria-label="Đổi chế độ sáng tối"
          aria-pressed={dark}
          title="Sáng tối"
        >
          {dark ? <CircleDot className="size-7" /> : <Sun className="size-7" />}
        </button>
      </div>
    </div>
  );
}
