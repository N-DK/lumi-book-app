"use client";

import { PRESET_SCENES } from "@/lib/lumi-data";
import { pressMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
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
    <div className="relative z-[90] flex justify-end">
      <AnimatePresence mode="wait">
        {activePanel && (
          <motion.div
            key={activePanel}
            initial={{ opacity: 0, x: 24, y: "-50%", scale: 0.98 }}
            animate={{ opacity: 1, x: 0, y: "-50%", scale: 1 }}
            exit={{ opacity: 0, x: 18, y: "-50%", scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-[76px] top-1/2 z-[95] w-72 rounded-lg border border-[#f1c36f]/20 bg-[#17100d]/95 p-3 text-white shadow-[0_24px_70px_rgba(0,0,0,0.58)] backdrop-blur-xl"
          >
            {(activePanel === "settings" || activePanel === "scenes") && (
              <div className="grid grid-cols-3 gap-2">
                {PRESET_SCENES.map((scene) => {
                  const active = background === scene.css;
                  return (
                    <motion.button
                      key={scene.id}
                      {...pressMotion}
                      whileHover={{ y: -2, scale: 1.03 }}
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
                <motion.button
                  {...pressMotion}
                  onClick={() => setDark(!dark)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-full border py-2 text-xs transition",
                    dark
                      ? "border-[#e8c98d]/45 bg-[#e8c98d]/[0.12] text-[#f5ddb0]"
                      : "border-white/10 bg-white/[0.04] text-white/65 hover:text-white",
                  )}
                  aria-label="Đổi chế độ sáng tối"
                >
                  {dark ? (
                    <Moon className="size-4" />
                  ) : (
                    <Sun className="size-4" />
                  )}
                </motion.button>
                <motion.button
                  {...pressMotion}
                  onClick={() => setRain(!rain)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-full border py-2 text-xs transition",
                    rain
                      ? "border-[#9ec6ff]/45 bg-[#9ec6ff]/[0.12] text-[#cfe2ff]"
                      : "border-white/10 bg-white/[0.04] text-white/65 hover:text-white",
                  )}
                  aria-label="Bật tắt hiệu ứng mưa"
                  aria-pressed={rain}
                >
                  <CloudRain className="size-4" />
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, x: 14, scale: 0.96 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="flex w-[64px] flex-col items-center rounded-[32px] border border-[#f1c36f]/15 bg-[#17100d]/95 px-2 py-5 shadow-[0_22px_62px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.06] backdrop-blur-xl"
      >
        <motion.button
          {...pressMotion}
          whileHover={{ scale: 1.06 }}
          onClick={() => togglePanel("settings")}
          className={cn(
            "flex size-11 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.08] hover:text-[#f1c36f]",
            activePanel === "settings" && "bg-[#f1c36f]/[0.14] text-[#f1c36f]",
          )}
          aria-label="Không gian"
          aria-pressed={activePanel === "settings"}
          title="Không gian"
        >
          <SlidersHorizontal className="size-6" />
        </motion.button>

        <span className="my-3 h-px w-9 bg-white/[0.16]" />

        <motion.button
          {...pressMotion}
          whileHover={{ scale: 1.06 }}
          onClick={() => togglePanel("scenes")}
          className={cn(
            "flex size-11 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.08] hover:text-[#f1c36f]",
            activePanel === "scenes" && "bg-[#f1c36f]/[0.14] text-[#f1c36f]",
          )}
          aria-label="Cảnh nền"
          aria-pressed={activePanel === "scenes"}
          title="Cảnh nền"
        >
          <Map className="size-7" />
        </motion.button>

        <span className="my-3 h-px w-9 bg-white/[0.16]" />

        <motion.button
          {...pressMotion}
          whileHover={{ scale: 1.06 }}
          onClick={() => togglePanel("media")}
          className={cn(
            "flex size-11 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.08] hover:text-[#f1c36f]",
            activePanel === "media" && "bg-[#f1c36f]/[0.14] text-[#f1c36f]",
          )}
          aria-label="Ảnh nền"
          aria-pressed={activePanel === "media"}
          title="Ảnh nền"
        >
          <Film className="size-7" />
        </motion.button>

        <span className="my-3 h-px w-9 bg-white/[0.16]" />

        <motion.button
          {...pressMotion}
          whileHover={{ scale: 1.06 }}
          onClick={() => setDark(!dark)}
          className={cn(
            "flex size-11 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.08] hover:text-[#f1c36f]",
            dark && "bg-[#f1c36f]/[0.14] text-[#f1c36f]",
          )}
          aria-label="Đổi chế độ sáng tối"
          aria-pressed={dark}
          title="Sáng tối"
        >
          {dark ? <CircleDot className="size-7" /> : <Sun className="size-7" />}
        </motion.button>
      </motion.div>
    </div>
  );
}
