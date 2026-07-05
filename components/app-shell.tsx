"use client"

import { createContext, useContext, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"
import { FilterBar } from "@/components/filter-bar"
import { AnalystDrawer, AnalystDrawerProvider } from "@/components/analyst-drawer"

interface SidebarContextValue {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue>({ collapsed: false, setCollapsed: () => {} })

export function useSidebar() {
  return useContext(SidebarContext)
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <AnalystDrawerProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div
            className="flex flex-1 flex-col transition-all duration-200"
            style={{ marginLeft: collapsed ? "4rem" : "14rem" }}
          >
            <TopBar />
            <FilterBar />
            <main className="flex-1 overflow-y-auto p-6">
              {children}
            </main>
          </div>
          <AnalystDrawer />
        </div>
      </AnalystDrawerProvider>
    </SidebarContext.Provider>
  )
}
