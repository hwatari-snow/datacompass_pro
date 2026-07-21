import type { ChatMessage } from "@/lib/types"

const HISTORY_KEY = "dc_chat_history"
const THREAD_KEY = "dc_chat_thread"
const VERSION_KEY = "dc_chat_schema_version"
const SCHEMA_VERSION = "2026-07-20"
const MAX_SAVED_MESSAGES = 40
const MAX_SAVED_RESULTS = 10

function ensureVersion() {
  if (typeof window === "undefined") return
  const version = localStorage.getItem(VERSION_KEY)
  if (version !== SCHEMA_VERSION) {
    localStorage.removeItem(HISTORY_KEY)
    localStorage.removeItem(THREAD_KEY)
    localStorage.setItem(VERSION_KEY, SCHEMA_VERSION)
  }
}

export function loadChatHistory(): { messages: ChatMessage[]; threadId: string | null } {
  if (typeof window === "undefined") return { messages: [], threadId: null }
  ensureVersion()
  try {
    const messages = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as ChatMessage[]
    const threadId = localStorage.getItem(THREAD_KEY)
    return { messages, threadId }
  } catch {
    return { messages: [], threadId: null }
  }
}

export function saveChatHistory(messages: ChatMessage[], threadId: string | null) {
  if (typeof window === "undefined") return
  ensureVersion()
  const compact = messages.slice(-MAX_SAVED_MESSAGES).map((message) => ({
    ...message,
    results: message.results?.slice(0, MAX_SAVED_RESULTS),
  }))
  localStorage.setItem(HISTORY_KEY, JSON.stringify(compact))
  if (threadId) localStorage.setItem(THREAD_KEY, threadId)
  else localStorage.removeItem(THREAD_KEY)
}

export function clearChatHistory() {
  if (typeof window === "undefined") return
  localStorage.removeItem(HISTORY_KEY)
  localStorage.removeItem(THREAD_KEY)
}
