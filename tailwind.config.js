/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        paper: 'var(--paper)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        line: 'var(--line)',
        teal: 'var(--teal)',
        'teal-deep': 'var(--teal-deep)',
        'teal-wash': 'var(--teal-wash)',
        rust: 'var(--rust)',
        'rust-wash': 'var(--rust-wash)',
        amber: 'var(--amber)',
        'amber-wash': 'var(--amber-wash)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
        mono: 'var(--font-mono)',
      },
    },
  },
  plugins: [],
}
