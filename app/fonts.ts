import localFont from "next/font/local";

/**
 * Montserrat variable (weight axis 100-900), subsetted from the variable TTF that
 * shipped in the design bundle. Latin + Latin Ext-A + punctuation, arrows and
 * geometric shapes, so the prototype's glyphs (—  ·  →  ▶  curly quotes) all resolve.
 *
 * Roman only. The design uses no italic anywhere, and next/font preloads every
 * declared face, so shipping the italic cost 39KB of first paint for zero glyphs.
 */
export const montserrat = localFont({
  src: [
    {
      path: "./fonts/Montserrat-Variable.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-sans-loaded",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});
