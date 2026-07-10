"use client"

import { createContext, useContext, useState } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"
import { FilterBar } from "@/components/filter-bar"
import { ConditionsPanel } from "@/components/conditions-panel"
import { AnalystDrawer, AnalystDrawerProvider } from "@/components/analyst-drawer"
import React from "react"

interface SidebarContextValue {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
}

interface CondPanelContextValue {
  condPanelOpen: boolean
  setCondPanelOpen: (v: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue>({ collapsed: false, setCollapsed: () => {} })
const CondPanelContext = createContext<CondPanelContextValue>({ condPanelOpen: false, setCondPanelOpen: () => {} })

export function useSidebar() {
  return useContext(SidebarContext)
}

export function useCondPanel() {
  return useContext(CondPanelContext)
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [condPanelOpen, setCondPanelOpen] = useState(false)
  const pathname = usePathname()

  // Close panel on navigation
  React.useEffect(() => {
    setCondPanelOpen(false)
  }, [pathname])

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <CondPanelContext.Provider value={{ condPanelOpen, setCondPanelOpen }}>
        <AnalystDrawerProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div
              className="flex flex-1 flex-col transition-all duration-200"
              style={{ marginLeft: collapsed ? "4rem" : "14rem" }}
            >
              <TopBar />
              <FilterBar onTogglePanel={() => setCondPanelOpen(!condPanelOpen)} panelOpen={condPanelOpen} />
              <div className="relative flex-1 overflow-hidden">
                <ConditionsPanel open={condPanelOpen} onClose={() => setCondPanelOpen(false)} />
                <main className="h-full overflow-y-auto p-6">
                  {children}
                </main>
              </div>
            </div>
            <AnalystDrawer />
          </div>
        </AnalystDrawerProvider>
      </CondPanelContext.Provider>
    </SidebarContext.Provider>
  )
}
