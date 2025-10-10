# Investigation Prompt: Fixing Streaming Tool Calls with vLLM and Qwen3-Coder

## Context

We're using vLLM to serve Qwen3-Coder-30B with the `qwen3_coder` tool parser for OpenAI-compatible tool calling. We've discovered that:

**Non-Streaming Mode (Works ✅):**
- vLLM returns proper OpenAI `tool_calls` format
- `content: null`
- `finish_reason: "tool_calls"`
- Tools execute correctly

**Streaming Mode (Broken ❌):**
- vLLM streams raw XML in the `content` field: `"<tool_call>\n<function=list_directory>\n<parameter=path>..."`
- No `tool_calls` field in any delta chunks
- `finish_reason: "stop"` (should be `"tool_calls"`)
- The `qwen3_coder` parser doesn't convert XML to tool_calls during streaming

## Current Setup

**vLLM Server Config:**
```bash
vllm serve /path/to/Qwen3-Coder-30B-A3B-Instruct \
  --served-model-name Qwen3-Coder-30B \
  --host 0.0.0.0 \
  --port 8000 \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.95 \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_coder \
  --reasoning-parser qwen3
```

**Test Evidence:**
- Non-streaming request with `stream: false` → Perfect tool_calls JSON
- Streaming request with `stream: true` → Raw XML in content field, no tool_calls

## Questions to Investigate

### 1. Is this a vLLM limitation or bug?
- Does vLLM's `qwen3_coder` parser support streaming mode at all?
- Is there an open issue or PR about this?
- What does the vLLM documentation say about tool calling parsers and streaming?
- Search: "vLLM qwen3_coder parser streaming tool_calls"
- Search: "vLLM tool call parser stream mode"

### 2. Can we create a custom streaming parser?
- Where is vLLM's `qwen3_coder` parser implemented?
- Can we extend or replace it with streaming support?
- What would a streaming-aware parser need to do?
  - Buffer XML chunks
  - Detect complete tool call XML blocks
  - Convert XML → tool_calls delta chunks
  - Set correct finish_reason
- Search: "vLLM custom tool call parser"
- Search: "vLLM tool parser implementation streaming"

### 3. Client-side streaming XML parser?
- Could we parse XML tool calls on the Qwen Code CLI side during streaming?
- Buffer streamed XML content
- Detect complete `</tool_call>` tags
- Convert to Gemini functionCall format before yielding
- Pro: Works with any vLLM version
- Con: More complex client logic
- Search: "streaming XML parser JavaScript"
- Search: "incremental XML parsing Node.js"

### 4. Alternative vLLM configurations?
- Are there other tool parsers that support streaming?
- Can we use `--tool-call-parser hermes` or other parsers?
- Does `--enable-auto-tool-choice` affect streaming behavior?
- Search: "vLLM tool call parser comparison"
- Search: "vLLM hermes parser streaming"

### 5. Qwen3-Coder model behavior?
- Does Qwen3-Coder natively support streaming tool calls?
- Should we use a different prompt format?
- Are there model-specific settings to enable streaming tool calls?
- Search: "Qwen3-Coder streaming tool calls"
- Search: "Qwen models function calling streaming"

## Technical Deep Dive Needed

### vLLM Source Code Investigation
1. **Parser Location:**
   - Find `qwen3_coder_tool_parser.py` or similar in vLLM source
   - Check if it has streaming support
   - Look for `parse_streaming()` or similar methods

2. **Streaming Pipeline:**
   - How does vLLM process tool calls during streaming?
   - When/where does XML → JSON conversion happen?
   - Is there a flag to enable streaming tool call conversion?

3. **OpenAI Compatibility:**
   - How does vLLM's OpenAI API layer handle streaming tool_calls?
   - Does it support delta tool_calls like OpenAI does?

### Potential Solutions

#### Option A: Fix vLLM Parser (Upstream)
- Modify `qwen3_coder` parser to support streaming
- Submit PR to vLLM
- Wait for release
- **Timeline:** Weeks to months

#### Option B: Custom vLLM Parser (Local)
- Create `qwen3_coder_streaming` parser
- Implement streaming XML → tool_calls conversion
- Load as custom parser in vLLM
- **Timeline:** Days to weeks
- **Maintenance:** Need to keep in sync with vLLM updates

#### Option C: Client-Side Parser (Qwen Code)
- Detect XML tool calls in streaming content
- Buffer until complete
- Convert to functionCall format
- Clear content field to prevent display
- **Timeline:** Days
- **Maintenance:** Contained in Qwen Code repo

#### Option D: Hybrid Approach (Current)
- Keep non-streaming for tool calls
- Use streaming for regular chat
- **Timeline:** Already implemented ✅
- **Downside:** Less responsive UX for tool calls

## Specific Code Locations to Check

**vLLM (if investigating upstream):**
```
vllm/entrypoints/openai/tool_parsers/qwen3_coder_tool_parser.py
vllm/entrypoints/openai/api_server.py
vllm/engine/output_processor/
```

**Qwen Code (if doing client-side):**
```
packages/core/src/core/openaiContentGenerator/converter.ts
packages/core/src/core/openaiContentGenerator/pipeline.ts
packages/core/src/utils/streamingToolCallParser.ts
```

## Success Criteria

A successful solution should:
1. ✅ Support streaming mode with tools
2. ✅ Return proper `tool_calls` format (no XML in content)
3. ✅ Set correct `finish_reason: "tool_calls"`
4. ✅ Maintain compatibility with non-streaming mode
5. ✅ Work with standard vLLM configuration
6. ✅ Provide smooth UX (no buffering delays if possible)

## Additional Resources to Search

- vLLM GitHub issues: "tool call streaming"
- vLLM GitHub PRs: "tool parser"
- OpenAI API spec: streaming tool_calls format
- Qwen model documentation: function calling
- Similar projects: How do others handle streaming tool calls with vLLM?

## Recommended Investigation Path

1. **Quick Check (10 min):** Search vLLM docs/issues for streaming tool call support
2. **Source Dive (30 min):** Look at vLLM's `qwen3_coder` parser implementation
3. **Feasibility (30 min):** Determine if client-side parsing is viable
4. **Prototype (2-4 hours):** Try the most promising approach
5. **Test (1 hour):** Validate with real tool calls
6. **Document (30 min):** Update solution in code comments

---

## Output Expected

Please investigate and provide:

1. **Root cause analysis:** Why doesn't streaming work?
2. **Feasibility assessment:** Can we fix it? Which approach is best?
3. **Implementation plan:** Step-by-step if fixable
4. **Code pointers:** Specific files/functions to modify
5. **Risk assessment:** What could break?
6. **Timeline estimate:** How long to implement?

If not fixable: Explain why and recommend keeping the current hybrid approach.
