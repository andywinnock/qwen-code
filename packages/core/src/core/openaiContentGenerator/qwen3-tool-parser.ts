/**
 * Qwen3-Coder XML Tool Call Parser (Client-Side)
 *
 * Parses Qwen3's XML-format tool calls that come through streaming as raw text.
 * Format: <tool_call><function=name><parameter=arg>value</parameter></function></tool_call>
 */

// Simple logging utility for XML parser
const log = {
  info: (msg: string, data?: any) => {
    if (process.env['DEBUG']?.includes('qwen3-tool-parser')) {
      console.log(`[qwen3-tool-parser] ${msg}`, data || '');
    }
  },
  warn: (msg: string, data?: any) => {
    console.warn(`[qwen3-tool-parser] ${msg}`, data || '');
  },
  error: (msg: string, data?: any) => {
    console.error(`[qwen3-tool-parser] ${msg}`, data || '');
  }
};

export interface ParsedToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string  // JSON string
  }
}

/**
 * Extract tool calls from XML-formatted text
 * Handles the Qwen3-Coder XML format: <tool_call><function=name><parameter=arg>value</parameter></function></tool_call>
 */
export function parseQwen3ToolCalls(text: string): ParsedToolCall[] {
  const toolCalls: ParsedToolCall[] = []

  // Match all <tool_call>...</tool_call> blocks
  const toolCallRegex = /<tool_call>([\s\S]*?)<\/tool_call>/g
  let match: RegExpExecArray | null
  let callIndex = 0

  while ((match = toolCallRegex.exec(text)) !== null) {
    const toolCallContent = match[1]

    try {
      // Extract function name from <function=name>
      const funcMatch = toolCallContent.match(/<function\s*=\s*([^>]+)>/)
      if (!funcMatch) {
        log.warn("Failed to extract function name", { content: toolCallContent })
        continue
      }

      const functionName = funcMatch[1].trim()
      const args: Record<string, any> = {}

      // Extract all parameters: <parameter=name>value</parameter> or just <parameter>value</parameter>
      const paramRegex = /<parameter(?:\s*=\s*([^>]+))?>([\s\S]*?)<\/parameter>/g
      let paramMatch: RegExpExecArray | null

      while ((paramMatch = paramRegex.exec(toolCallContent)) !== null) {
        const paramName = paramMatch[1]?.trim()
        const paramValue = paramMatch[2]?.trim()

        if (paramName && paramValue) {
          // Try to parse as JSON if it looks like JSON
          try {
            args[paramName] = JSON.parse(paramValue)
          } catch {
            // Keep as string if not valid JSON
            args[paramName] = paramValue
          }
        }
      }

      // Alternative format: <name>value</name> (no parameter wrapper)
      const directParamRegex = /<([a-zA-Z_][a-zA-Z0-9_]*)>([\s\S]*?)<\/\1>/g
      let directMatch: RegExpExecArray | null

      while ((directMatch = directParamRegex.exec(toolCallContent)) !== null) {
        const paramName = directMatch[1]
        const paramValue = directMatch[2]?.trim()

        // Skip if it's 'function' (already handled)
        if (paramName === 'function' || paramName === 'parameter') continue

        if (paramName && paramValue) {
          try {
            args[paramName] = JSON.parse(paramValue)
          } catch {
            args[paramName] = paramValue
          }
        }
      }

      const toolCall: ParsedToolCall = {
        id: `call_${callIndex++}`,
        type: "function",
        function: {
          name: functionName,
          arguments: JSON.stringify(args)
        }
      }

      toolCalls.push(toolCall)

      log.info("Parsed tool call", {
        function: functionName,
        args: Object.keys(args)
      })

    } catch (error) {
      log.error("Failed to parse tool call", { error, content: toolCallContent })
    }
  }

  return toolCalls
}

/**
 * Check if text contains Qwen3 XML tool calls
 */
export function containsQwen3ToolCalls(text: string): boolean {
  return /<tool_call>[\s\S]*?<\/tool_call>/.test(text)
}

/**
 * Strip tool call XML from text, leaving only non-tool-call content
 */
export function stripQwen3ToolCalls(text: string): string {
  return text.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '').trim()
}

/**
 * Buffer for accumulating streaming XML
 * Handles partial XML blocks that span multiple stream chunks
 */
export class Qwen3StreamBuffer {
  private buffer = ""
  private completedToolCalls: ParsedToolCall[] = []
  private inToolCall = false

  /**
   * Add a chunk of streamed text
   * Returns any completed tool calls found in this chunk
   */
  addChunk(chunk: string): ParsedToolCall[] {
    this.buffer += chunk

    // Track if we're inside a tool call
    const openCount = (this.buffer.match(/<tool_call>/g) || []).length
    const closeCount = (this.buffer.match(/<\/tool_call>/g) || []).length
    this.inToolCall = openCount > closeCount

    // If we have complete tool calls, extract them
    if (!this.inToolCall && openCount > 0) {
      const newToolCalls = parseQwen3ToolCalls(this.buffer)

      // Only return NEW tool calls (not ones we've already seen)
      const newCallsOnly = newToolCalls.slice(this.completedToolCalls.length)
      this.completedToolCalls = newToolCalls

      return newCallsOnly
    }

    return []
  }

  /**
   * Get any remaining content after tool calls are removed
   */
  getTextContent(): string {
    return stripQwen3ToolCalls(this.buffer)
  }

  /**
   * Check if currently inside an incomplete tool call block
   */
  isInToolCall(): boolean {
    return this.inToolCall
  }

  /**
   * Get all completed tool calls
   */
  getCompletedToolCalls(): ParsedToolCall[] {
    return this.completedToolCalls
  }

  /**
   * Get the raw buffer (for debugging)
   */
  getBuffer(): string {
    return this.buffer
  }

  /**
   * Reset the buffer
   */
  reset(): void {
    this.buffer = ""
    this.completedToolCalls = []
    this.inToolCall = false
  }
}
