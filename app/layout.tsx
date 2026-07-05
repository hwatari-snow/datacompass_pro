import type { Metadata } from "next"
import type React from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { ConditionsProvider } from "@/components/conditions-context"
import { AppShell } from "@/components/app-shell"
import { APP_TITLE } from "@/lib/constants"
import "./globals.css"

export const metadata: Metadata = {
  title: APP_TITLE,
  description: "PPIH DataCompass — ID-POS 分析プラットフォーム",
  icons: { icon: "/icon.svg" },
}

const THEME_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem('theme');
    if (t === 'light') document.documentElement.classList.remove('dark');
    else if (t === 'system') {
      if (!window.matchMedia('(prefers-color-scheme: dark)').matches)
        document.documentElement.classList.remove('dark');
    }
  } catch(e){}
})();
`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <ConditionsProvider>
            <AppShell>{children}</AppShell>
          </ConditionsProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
