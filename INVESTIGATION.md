# Qwen-Code XML Tag Leaking Investigation

## Problem Summary

**Symptoms:**

1. Raw XML tags (`<tool_call>`, `<function=read_file>`) are displayed in terminal
2. Model enters infinite loops generating `<function=...>` repeatedly (2042+ tokens)
3. Functionality works 100% (tools execute correctly) but display is broken

**Example of Broken Output:**

```
✦ Let me explore the packages directory:

  <tool_call>
  <function=list_directory
  <function=list_directory
  <function=list_directory
 ╭─────────────────────────────────────────────╮
 │ ✓  ReadFolder packages                      │
 ╰─────────────────────────────────────────────╯
```

**Expected Output:**

```
✦ Let me explore the packages directory:
 ╭─────────────────────────────────────────────╮
 │ ⊷  ReadFolder packages                      │
 ╰─────────────────────────────────────────────╯
 ╭─────────────────────────────────────────────╮
 │ ✓  ReadFolder packages                      │
 │    Listed 2 item(s).                        │
 ╰─────────────────────────────────────────────╯
```

## User Setup

**Model:** Qwen3-Coder-480B-A35B-Instruct (Q2_K_XL quantization)
**Backend:** llama.cpp server (OpenAI-compatible API)
**Performance:** 66 tok/s decode speed (optimized dual-GPU setup)
**Port:** 10002
**Endpoint:** http://localhost:10002/v1

**Alias:**

```bash
alias qc-480b='OPENAI_BASE_URL=http://localhost:10002/v1 OPENAI_API_KEY=EMPTY node ~/.npm-global/lib/node_modules/@qwen-code/qwen-code/cli.js -m qwen3-coder-480b-optimized'
```

## Root Cause Analysis

### 1. Expected XML Format

From `packages/core/src/core/prompts.ts`, the model should output:

```xml
<tool_call>
<function=FUNCTION_NAME>
<parameter=param_name>
value
</parameter>
</function>
</tool_call>
```

### 2. THE REAL PROBLEM: Infinite Generation Loop

**What's happening:**
The model generates `<function=read_file` over 2000+ times in a row:

```
<function=read_file
<function=read_file
<function=read_file
[... 2000+ times ...]
```

**Root Causes:**

#### A. Missing Stop Sequences

Qwen-code is NOT configuring stop sequences in API requests:

- No `"stop": ["<", "</tool_call>", "</function>"]` in request
- Model doesn't know when to stop after opening tag
- With temperature=0.0, it deterministically repeats

#### B. No Repetition Penalty

Looking at server logs:

```json
{
  "repeat_penalty": 1.0, // NO PENALTY!
  "temperature": 0.0 // DETERMINISTIC
}
```

- `repeat_penalty: 1.0` means NO repetition penalty
- With temp=0.0, model picks same token infinitely

#### C. Grammar Constraint Bug

From earlier server logs:

```
Unexpected empty grammar stack after accepting piece: <function=glob><
```

llama.cpp grammar parser is hitting edge cases with the Jinja template

### 3. Display Bug (Secondary Issue)

Raw XML tags ARE also leaking to display:

- Model outputs: `<function=read_file>`
- Expected: Parse tag, hide from display, show UI box
- Actual: Raw tag printed to terminal PLUS generation loop

## Files to Investigate

### High Priority

1. **packages/cli/src/ui/components/Composer.tsx**
   - Likely handles streaming message display
   - Need to find where raw text is rendered

2. **packages/cli/src/gemini.tsx**
   - Main integration point
   - May handle streaming response processing

3. **packages/core/src/core/prompts.ts**
   - Contains XML format examples
   - Line ~88: Shows proper XML structure

### Medium Priority

4. **packages/core/src/core/openaiContentGenerator/converter.ts**
   - Converts between formats
   - May have XML→JSON conversion logic

5. **packages/cli/src/ui/components/GeminiRespondingSpinner.tsx**
   - Handles "responding" state
   - May display raw streaming content

## Potential Fixes

### Fix 1: Add Stop Sequences (CRITICAL)

In request builder, add stop sequences for XML tool calls:

```typescript
// packages/core/src/core/openaiContentGenerator/pipeline.ts
const openaiRequest = {
  messages: this.converter.convertGeminiRequestToOpenAI(request),
  model: this.contentGeneratorConfig.model,
  stream: true,
  tools: convertedTools,
  // ADD THIS:
  stop: [
    '<tool_call>',
    '</tool_call>',
    '</function>',
    '</parameter>',
    '<|im_end|>',
  ],
};
```

### Fix 2: Add Repetition Penalty (CRITICAL)

Configure llama.cpp parameters to prevent loops:

```typescript
// In API request
const openaiRequest = {
  // ... existing params
  repetition_penalty: 1.1, // Penalize repeated tokens
  frequency_penalty: 0.5, // Additional deterrent
};
```

Or in launch script:

```bash
llama-server \
  --repeat-penalty 1.1 \
  --frequency-penalty 0.5
```

### Fix 3: Add Max Tokens Per Response

Client-side protection:

```typescript
const MAX_TOOL_CALL_TOKENS = 500;
let toolCallTokens = 0;

for await (const chunk of stream) {
  toolCallTokens++;
  if (toolCallTokens > MAX_TOOL_CALL_TOKENS) {
    throw new Error('Tool call generation exceeded token limit');
  }
}
```

### Fix 4: Filter XML Tags from Display (Display Fix)

In streaming display handler:

```typescript
function filterIncompleteXML(text: string): string {
  // Hide incomplete tool call tags during streaming
  return text
    .replace(/<tool_call>[\s\S]*?(?!<\/tool_call>)$/g, '[Tool Call...]')
    .replace(/<function=[^>]*$/g, '');
}
```

### Fix 5: Improve Grammar Template

Fix grammar parsing issues in template:

```jinja
{# Add explicit stop tokens #}
{{- '<tool_call>\n<function=' + tool_call.name + '>\n' }}
{# Ensure closing tags are generated #}
{{- '</function>\n</tool_call>\n' }}
```

## Next Steps

1. **Locate Display Handler**
   - Find where streaming response text is rendered to terminal
   - Search for React components that display `streamingContent` or similar

2. **Add XML Filtering**
   - Filter out incomplete XML tags before display
   - Only show completed, parsed tool calls

3. **Add Safety Limits**
   - Max tokens per tool call (500-1000)
   - Timeout for incomplete tool calls (30s)
   - Cancel stuck generation requests

4. **Test Fix**
   - Build modified version: `npm run build`
   - Install locally: `npm link` or direct path
   - Test with qc-480b alias

## Testing the Fix

```bash
# 1. Clone and setup (already done)
cd ~/Developer/qwen-code

# 2. Install dependencies
npm install

# 3. Build
npm run build

# 4. Link for local testing
npm link

# 5. Or run directly
node ~/Developer/qwen-code/dist/cli.js --base-url http://localhost:10002/v1 -m qwen3-coder-480b-optimized
```

## Server Status

- **Server:** Running healthy on PID 245865
- **Performance:** 66 tok/s (9x speedup from baseline)
- **Issue:** NOT a server bug - pure CLI display issue
- **All slots:** Currently clean (no stuck requests after manual cancellation)
