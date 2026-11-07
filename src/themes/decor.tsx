/**
 * Decorative artwork per theme. Colours come from CSS variables, so the
 * palettes stay in themes.css.
 */
import type { ThemeId } from "#/themes/registry";

interface ArtProps {
  className?: string;
}

/** The playful theme's fox. */
export function Fox({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {/* ears */}
      <path d="M7 4 L27 22 L13 33 Z" fill="var(--primary)" />
      <path d="M57 4 L37 22 L51 33 Z" fill="var(--primary)" />
      <path d="M11 11 L22 21 L14 28 Z" fill="var(--foreground)" opacity="0.85" />
      <path d="M53 11 L42 21 L50 28 Z" fill="var(--foreground)" opacity="0.85" />
      {/* head */}
      <path d="M8 27 Q32 9 56 27 L32 60 Z" fill="var(--primary)" />
      {/* white cheeks */}
      <path d="M8 27 L23 39 L32 60 Z" fill="#fff" />
      <path d="M56 27 L41 39 L32 60 Z" fill="#fff" />
      {/* eyes and nose */}
      <ellipse cx="23.5" cy="31" rx="2.6" ry="3.4" fill="var(--foreground)" />
      <ellipse cx="40.5" cy="31" rx="2.6" ry="3.4" fill="var(--foreground)" />
      <circle cx="24.4" cy="29.8" r="0.9" fill="#fff" />
      <circle cx="41.4" cy="29.8" r="0.9" fill="#fff" />
      <path d="M28.5 55 Q32 52 35.5 55 Q32 60 28.5 55 Z" fill="var(--foreground)" />
    </svg>
  );
}

export function PawPrint({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <ellipse cx="12" cy="16" rx="5" ry="4.2" />
      <ellipse cx="5.5" cy="10" rx="2.1" ry="2.7" />
      <ellipse cx="9.5" cy="6" rx="2.1" ry="2.8" />
      <ellipse cx="14.5" cy="6" rx="2.1" ry="2.8" />
      <ellipse cx="18.5" cy="10" rx="2.1" ry="2.7" />
    </svg>
  );
}

function Mug({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" fill="none">
      <path
        d="M22 6c-3 4 3 6 0 10M32 4c-3 4 3 6 0 10M42 6c-3 4 3 6 0 10"
        stroke="var(--muted-foreground)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M10 22h40v20a14 14 0 0 1-14 14H24a14 14 0 0 1-14-14V22Z" fill="var(--primary)" />
      <path d="M50 27h3a7 7 0 0 1 0 14h-4" stroke="var(--primary)" strokeWidth="4" />
      <path
        d="M14 30h32M14 37h32M14 44h30"
        stroke="var(--primary-foreground)"
        strokeOpacity="0.35"
        strokeWidth="2"
        strokeDasharray="3 3"
      />
    </svg>
  );
}

function Moon({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M40 8a24 24 0 1 0 16 38A20 20 0 0 1 40 8Z" fill="var(--primary)" />
      <path d="M50 10l1.6 4.4L56 16l-4.4 1.6L50 22l-1.6-4.4L44 16l4.4-1.6Z" fill="var(--accent)" />
      <path d="M57 28l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1Z" fill="var(--foreground)" />
    </svg>
  );
}

function Sprig({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M32 60C32 40 30 22 22 6"
        stroke="var(--primary)"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M31 44c-10-1-16-7-17-15 9 0 15 6 17 15Z" fill="var(--primary)" />
      <path d="M31 32c8-2 13-8 13-16-8 1-13 7-13 16Z" fill="var(--primary)" opacity="0.8" />
      <path d="M27 22c-7-2-10-7-10-13 6 1 10 6 10 13Z" fill="var(--primary)" opacity="0.65" />
      <circle cx="44" cy="44" r="5" fill="var(--accent)" />
      <circle cx="44" cy="44" r="2" fill="var(--card)" />
    </svg>
  );
}

function PixelHeart({ className }: ArtProps) {
  // 9x8 pixel heart
  const rows = [
    "011000110",
    "111101111",
    "111111111",
    "111111111",
    "011111110",
    "001111100",
    "000111000",
    "000010000",
  ];
  return (
    <svg viewBox="0 0 9 8" className={className} aria-hidden="true" shapeRendering="crispEdges">
      {rows.flatMap((row, y) =>
        row
          .split("")
          .map((cell, x) =>
            cell === "1" ? (
              <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="var(--primary)" />
            ) : null,
          ),
      )}
    </svg>
  );
}

const MASCOTS: Partial<Record<ThemeId, (props: ArtProps) => React.ReactElement>> = {
  playful: Fox,
  cozy: Mug,
  celestial: Moon,
  botanical: Sprig,
  retro: PixelHeart,
};

/** Header artwork for the active theme (minimal has none). */
export function Mascot({ theme, className }: { theme: ThemeId; className?: string }) {
  const Art = MASCOTS[theme];
  return Art ? (
    <span className="mascot inline-block">
      <Art className={className} />
    </span>
  ) : null;
}

/** Small bullet shown before priority labels. */
export function PriorityMark({ theme, className }: { theme: ThemeId; className?: string }) {
  if (theme === "playful") return <PawPrint className={className} />;
  return null;
}
