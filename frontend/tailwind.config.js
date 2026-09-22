/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F9FAFB',
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F3F4F6',
          subtle: '#F9FAFB',
          hover: '#F3F4F6',
          border: '#E5E7EB',
          dark: '#111827',
        },
        ink: {
          DEFAULT: '#111827',
          secondary: '#374151',
          muted: '#6B7280',
          subtle: '#9CA3AF',
        },
        // Pure Semantic Verification States
        verdict: {
          supported: {
            text: '#047857',
            bg: '#ECFDF5',
            border: '#A7F3D0',
            dot: '#059669',
          },
          contradicted: {
            text: '#BE123C',
            bg: '#FFF1F2',
            border: '#FECDD3',
            dot: '#E11D48',
          },
          partial: {
            text: '#B45309',
            bg: '#FFFBEB',
            border: '#FDE68A',
            dot: '#D97706',
          },
          uncertain: {
            text: '#B45309',
            bg: '#FEF3C7',
            border: '#FCD34D',
            dot: '#D97706',
          },
          unverifiable: {
            text: '#4B5563',
            bg: '#F3F4F6',
            border: '#E5E7EB',
            dot: '#6B7280',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.07), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        panel: '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
}
