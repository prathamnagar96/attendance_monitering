// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // shadcn-style tokens
                background: "#020617",
                foreground: "#f9fafb",
                primary: "#2563eb",
                "primary-foreground": "#f9fafb",
                secondary: "#e5e7eb",
                "secondary-foreground": "#020617",
                destructive: "#dc2626",
                "destructive-foreground": "#fef2f2",
                accent: "#f3f4f6",
                "accent-foreground": "#020617",
                card: "#ffffff",
                "card-foreground": "#020617",
                input: "#e5e7eb",
                ring: "#2563eb",

                // app-specific semantic colors
                "light-bg": "#f9fafb",
                "dark-bg": "#020617",
                "light-card": "#ffffff",
                "dark-card": "#020617",
                "light-border": "#e5e7eb",
                "dark-border": "#1f2937",
                "light-textSecondary": "#6b7280",
                "dark-textSecondary": "#9ca3af",
                "instagram-purple": "#c13584",
            },
            borderRadius: {
                xl: "0.75rem",
                lg: "0.5rem",
                md: "0.375rem",
                sm: "0.25rem",
            },
        },
    },
    plugins: [],
}
