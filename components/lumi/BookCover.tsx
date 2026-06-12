interface BookCoverProps {
  title: string;
  author: string;
  palette:
    | "rust"
    | "navy"
    | "forest"
    | "crimson"
    | "cream"
    | "charcoal"
    | "amber";
  style?: "serif" | "stamp" | "minimal";
}

const palettes: Record<
  BookCoverProps["palette"],
  { bg: string; fg: string; accent: string }
> = {
  rust: { bg: "#6b2c1a", fg: "#f5ecd9", accent: "#c9a876" },
  navy: { bg: "#152238", fg: "#e8d9b0", accent: "#c9a876" },
  forest: { bg: "#1f3a2e", fg: "#f5ecd9", accent: "#c9a876" },
  crimson: { bg: "#7a1a1a", fg: "#f5ecd9", accent: "#e8c07a" },
  cream: { bg: "#e8dcc0", fg: "#2d211a", accent: "#6b2c1a" },
  charcoal: { bg: "#1a1410", fg: "#c9a876", accent: "#f5ecd9" },
  amber: { bg: "#a8722c", fg: "#1a1410", accent: "#f5ecd9" },
};

export function BookCover({
  title,
  author,
  palette,
  style = "serif",
}: BookCoverProps) {
  const p = palettes[palette];
  return (
    <div
      className="relative w-full h-full overflow-hidden flex flex-col justify-between p-5"
      style={{ background: p.bg, color: p.fg }}
    >
      {/* top bar */}
      <div className="flex items-center justify-between">
        <div className="h-px w-8" style={{ background: p.accent }} />
        <span
          className="text-[8px] uppercase tracking-[0.25em] font-medium"
          style={{ color: p.accent }}
        >
          Lumi
        </span>
      </div>

      {/* title block */}
      <div className="flex-1 flex flex-col justify-center items-center text-center gap-2">
        {style === "stamp" && (
          <div
            className="size-12 rounded-full border-2 mb-2 grid place-items-center text-[8px] uppercase tracking-widest"
            style={{ borderColor: p.accent, color: p.accent }}
          >
            ✦
          </div>
        )}
        <h4
          className="font-display font-bold leading-[1.05] text-balance"
          style={{
            fontSize:
              title.length > 28
                ? "0.95rem"
                : title.length > 18
                  ? "1.1rem"
                  : "1.35rem",
          }}
        >
          {title}
        </h4>
        {style === "minimal" && (
          <div className="h-px w-10 my-1" style={{ background: p.accent }} />
        )}
      </div>

      {/* author */}
      <div className="flex items-end justify-between">
        <span className="text-[9px] uppercase tracking-[0.2em] opacity-80">
          {author}
        </span>
        <div className="h-px w-8" style={{ background: p.accent }} />
      </div>

      {/* spine shadow */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/30 to-transparent" />
    </div>
  );
}
