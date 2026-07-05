import { NextResponse } from "next/server"
import { getServiceToken } from "@/lib/snowflake"
import fs from "fs"

export const dynamic = "force-dynamic"

const AGENT_FQN = "PPIH_FULL_DB.ANALYTICS.DATACOMPASS_AGENT"

function getAccountUrl(): string {
  // SPCS sets SNOWFLAKE_HOST or we derive from SNOWFLAKE_ACCOUNT
  if (process.env.SNOWFLAKE_HOST) return `https://${process.env.SNOWFLAKE_HOST}`
  if (process.env.SNOWFLAKE_ACCOUNT_URL) return process.env.SNOWFLAKE_ACCOUNT_URL
  // Fallback: read from SPCS metadata
  try {
    const host = fs.readFileSync("/snowflake/session/host", "utf8").trim()
    return `https://${host}`
  } catch {}
  return "https://hu05376.ap-northeast-1.aws.snowflakecomputing.com"
}

/**
 * POST /api/analyst
 * Body: { message: string, threadId?: string, parentMessageId?: string }
 *
 * Calls Cortex Agent REST API to leverage the deployed DATACOMPASS_AGENT
 * which has cortex_analyst_text_to_sql tool with semantic view.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { message, threadId, parentMessageId } = body as {
      message: string
      threadId?: string
      parentMessageId?: string
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 })
    }

    const token = getServiceToken()
    if (!token) {
      return NextResponse.json({ error: "No Snowflake token available" }, { status: 500 })
    }

    const accountUrl = getAccountUrl()
    const [database, schema, agentName] = AGENT_FQN.split(".")

    // Build the request body for the Cortex Agent API
    // Use the object-based endpoint so the Agent's configured tools/tool_resources are used
    const agentBody: Record<string, unknown> = {
      messages: [{ role: "user", content: [{ type: "text", text: message }] }],
      stream: false,
    }

    // Multi-turn support
    if (threadId) {
      agentBody.thread_id = threadId
      agentBody.parent_message_id = parentMessageId || "0"
    }

    // Object-based agent endpoint: /api/v2/databases/{db}/schemas/{schema}/agents/{name}:run
    const url = `${accountUrl}/api/v2/databases/${database}/schemas/${schema}/agents/${agentName}:run`

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(agentBody),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error("[analyst] Agent API error:", response.status, errText)
      return NextResponse.json({ error: `Agent API error: ${response.status} - ${errText.slice(0, 200)}` }, { status: response.status })
    }

    // Parse response - could be SSE stream or JSON
    const contentType = response.headers.get("content-type") ?? ""
    const text = await response.text()

    let result: AgentResult

    if (contentType.includes("text/event-stream") || text.startsWith("event:")) {
      result = parseAgentStreamResponse(text)
    } else {
      // Non-streaming JSON response
      try {
        const json = JSON.parse(text)
        result = parseAgentJsonResponse(json)
      } catch {
        result = parseAgentStreamResponse(text)
      }
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    console.error("[analyst] Error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

interface AgentResult {
  explanation: string
  sql?: string
  results?: Record<string, unknown>[]
  totalRows?: number
  threadId?: string
  messageId?: string
}

function parseAgentJsonResponse(json: Record<string, unknown>): AgentResult {
  const result: AgentResult = { explanation: "" }
  const textParts: string[] = []

  // Non-streaming response format (stream: false):
  // { role: "assistant", content: [...], metadata: { thread_id, assistant_message_id } }
  const content = json.content as Array<Record<string, unknown>> | undefined

  if (Array.isArray(content)) {
    for (const item of content) {
      if (item.type === "text") {
        const text = (item as { text?: string }).text ?? ""
        if (text) textParts.push(text)
      } else if (item.type === "tool_result") {
        const toolResult = item.tool_result as Record<string, unknown> | undefined
        if (toolResult) {
          const toolContent = toolResult.content as Array<Record<string, unknown>> | undefined
          if (Array.isArray(toolContent)) {
            for (const sub of toolContent) {
              if (sub.type === "json" && sub.json) {
                const j = sub.json as Record<string, unknown>
                if (j.sql) result.sql = String(j.sql)
                if (j.result_set) {
                  const rs = j.result_set as Record<string, unknown>
                  const meta = rs.resultSetMetaData as Record<string, unknown> | undefined
                  const data = rs.data as string[][] | undefined
                  if (meta && data) {
                    const rowType = meta.rowType as Array<{ name: string }> | undefined
                    if (rowType && data.length > 0) {
                      result.results = data.slice(0, 100).map(row => {
                        const obj: Record<string, unknown> = {}
                        rowType.forEach((col, i) => { obj[col.name] = row[i] ?? null })
                        return obj
                      })
                      result.totalRows = Number(meta.numRows ?? data.length)
                    }
                  }
                }
                // Legacy format
                if (Array.isArray(j.results)) {
                  result.results = (j.results as Record<string, unknown>[]).slice(0, 100)
                  result.totalRows = (j.results as unknown[]).length
                }
              }
            }
          }
        }
      } else if (item.type === "table") {
        const table = item.table as Record<string, unknown> | undefined
        if (table?.result_set) {
          const rs = table.result_set as Record<string, unknown>
          const meta = rs.resultSetMetaData as Record<string, unknown> | undefined
          const data = rs.data as string[][] | undefined
          if (meta && data) {
            const rowType = meta.rowType as Array<{ name: string }> | undefined
            if (rowType && data.length > 0) {
              result.results = data.slice(0, 100).map(row => {
                const obj: Record<string, unknown> = {}
                rowType.forEach((col, i) => { obj[col.name] = row[i] ?? null })
                return obj
              })
              result.totalRows = Number(meta.numRows ?? data.length)
            }
          }
        }
      }
    }
  }

  result.explanation = textParts.join("\n").trim()

  // Extract thread/message info from metadata
  const metadata = json.metadata as Record<string, unknown> | undefined
  if (metadata) {
    if (metadata.thread_id) result.threadId = String(metadata.thread_id)
    if (metadata.assistant_message_id) result.messageId = String(metadata.assistant_message_id)
  }

  // Fallback for top-level fields
  if (json.thread_id) result.threadId = String(json.thread_id)
  if (json.message_id) result.messageId = String(json.message_id)

  return result
}

function parseAgentStreamResponse(raw: string): AgentResult {
  const result: AgentResult = { explanation: "" }
  const textParts: string[] = []
  let sql = ""
  let resultRows: Record<string, unknown>[] = []
  let totalRows = 0

  // SSE format: "event: <type>\ndata: <json>\n\n"
  const events = raw.split("\n\n").filter(Boolean)

  for (const event of events) {
    const lines = event.split("\n")
    let eventType = ""
    let dataStr = ""

    for (const line of lines) {
      if (line.startsWith("event: ")) eventType = line.slice(7).trim()
      else if (line.startsWith("data: ")) dataStr = line.slice(6)
      else if (line.startsWith("data:")) dataStr = line.slice(5)
    }

    if (!dataStr) continue

    try {
      const data = JSON.parse(dataStr) as Record<string, unknown>

      switch (eventType) {
        case "response.text.delta": {
          if (typeof data.text === "string") textParts.push(data.text)
          break
        }
        case "response.text": {
          if (typeof data.text === "string") {
            textParts.length = 0
            textParts.push(data.text)
          }
          break
        }
        case "response.tool_result": {
          const content = data.content as Array<Record<string, unknown>> | undefined
          if (Array.isArray(content)) {
            for (const item of content) {
              if (item.type === "json" && item.json) {
                const j = item.json as Record<string, unknown>
                if (j.sql) sql = String(j.sql)
                if (j.result_set) {
                  const rs = j.result_set as Record<string, unknown>
                  const meta = rs.resultSetMetaData as Record<string, unknown> | undefined
                  const rsData = rs.data as string[][] | undefined
                  if (meta && rsData) {
                    const rowType = meta.rowType as Array<{ name: string }> | undefined
                    if (rowType) {
                      resultRows = rsData.slice(0, 100).map(row => {
                        const obj: Record<string, unknown> = {}
                        rowType.forEach((col, i) => { obj[col.name] = row[i] ?? null })
                        return obj
                      })
                      totalRows = Number(meta.numRows ?? rsData.length)
                    }
                  }
                }
              }
            }
          }
          break
        }
        case "response.tool_result.analyst.delta": {
          const delta = data.delta as Record<string, unknown> | undefined
          if (delta) {
            if (typeof delta.sql === "string") sql = delta.sql
            if (delta.result_set) {
              const rs = delta.result_set as Record<string, unknown>
              const meta = rs.resultSetMetaData as Record<string, unknown> | undefined
              const rsData = rs.data as string[][] | undefined
              if (meta && rsData) {
                const rowType = meta.rowType as Array<{ name: string }> | undefined
                if (rowType) {
                  resultRows = rsData.slice(0, 100).map(row => {
                    const obj: Record<string, unknown> = {}
                    rowType.forEach((col, i) => { obj[col.name] = row[i] ?? null })
                    return obj
                  })
                  totalRows = Number(meta.numRows ?? rsData.length)
                }
              }
            }
          }
          break
        }
        case "response.table": {
          const rsObj = data.result_set as Record<string, unknown> | undefined
          if (rsObj) {
            const meta = rsObj.resultSetMetaData as Record<string, unknown> | undefined
            const rsData = rsObj.data as string[][] | undefined
            if (meta && rsData) {
              const rowType = meta.rowType as Array<{ name: string }> | undefined
              if (rowType) {
                resultRows = rsData.slice(0, 100).map(row => {
                  const obj: Record<string, unknown> = {}
                  rowType.forEach((col, i) => { obj[col.name] = row[i] ?? null })
                  return obj
                })
                totalRows = Number(meta.numRows ?? rsData.length)
              }
            }
          }
          break
        }
        case "metadata": {
          const meta = data.metadata as Record<string, unknown> | undefined
          if (meta) {
            if (meta.message_id && meta.role === "assistant") result.messageId = String(meta.message_id)
            if (meta.thread_id) result.threadId = String(meta.thread_id)
          }
          break
        }
        case "response": {
          // Final aggregated event - parse like JSON response
          const parsed = parseAgentJsonResponse(data)
          if (parsed.explanation) result.explanation = parsed.explanation
          if (parsed.sql) result.sql = parsed.sql
          if (parsed.results) { result.results = parsed.results; result.totalRows = parsed.totalRows }
          if (parsed.threadId) result.threadId = parsed.threadId
          if (parsed.messageId) result.messageId = parsed.messageId
          return result
        }
      }
    } catch {
      // Skip unparseable events
    }
  }

  result.explanation = textParts.join("").trim()
  if (sql) result.sql = sql
  if (resultRows.length > 0) {
    result.results = resultRows
    result.totalRows = totalRows
  }

  return result
}
