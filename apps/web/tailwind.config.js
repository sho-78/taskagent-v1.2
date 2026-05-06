/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // v0.4 design tokens (chapter 12.3.1)
        bg: {
          page: "#FAFAFA",
          card: "#FFFFFF",
          sub: "#F5F5F4",
        },
        text: {
          primary: "#111827",
          secondary: "#6B7280",
          muted: "#9CA3AF",
        },
        border: {
          DEFAULT: "#E5E7EB",
          strong: "#D1D5DB",
        },
        primary: "#2563EB",
        ai: "#7C3AED",
        success: "#16A34A",
        warning: "#F59E0B",
        danger: "#DC2626",
      },
      fontFamily: {
        sans: [
          "Inter",
          "Noto Sans JP",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
      },
      fontSize: {
        xs: ["12px", { lineHeight: "1.6" }],
        sm: ["13px", { lineHeight: "1.6" }],
        base: ["14px", { lineHeight: "1.7" }],
        md: ["16px", { lineHeight: "1.7" }],
        lg: ["18px", { lineHeight: "1.5" }],
        xl: ["22px", { lineHeight: "1.4" }],
        "2xl": ["28px", { lineHeight: "1.3" }],
        "3xl": ["36px", { lineHeight: "1.2" }],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
    },
  },
  plugins: [],
};
