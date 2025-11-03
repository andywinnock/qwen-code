/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Filters out incomplete XML tool call tags from streaming content
 *
 * Prevents raw XML like `<tool_call><function=read_file>` from appearing
 * in the terminal while the model is still generating the complete tool call.
 *
 * @param text - Raw streaming text that may contain incomplete XML
 * @returns Sanitized text with incomplete XML tool call tags removed
 */
export function filterIncompleteXMLToolCalls(text: string): string {
  if (!text) return text;

  let filtered = text;

  // Remove incomplete tool_call blocks (opening tag without closing)
  // Matches: <tool_call> ... (any content) ... but NO </tool_call>
  filtered = filtered.replace(/<tool_call>(?:(?!<\/tool_call>).)*$/gs, '');

  // Remove incomplete function tags
  // Matches: <function=anything> without closing
  filtered = filtered.replace(/<function=[^>]*>(?:(?!<\/function>).)*$/gs, '');

  // Remove orphaned parameter tags
  filtered = filtered.replace(
    /<parameter=[^>]*>(?:(?!<\/parameter>).)*$/gs,
    '',
  );

  // Remove repetitive incomplete function tags (the loop pattern)
  // Matches multiple consecutive `<function=name` or `<function=name>` without closing
  filtered = filtered.replace(/(?:<function=[^>]*>?\s*){3,}/g, '');

  return filtered;
}

/**
 * Detects if the streaming text contains signs of an infinite generation loop
 *
 * Common patterns:
 * - Same token repeated many times: `<function=read_file <function=read_file ...`
 * - Incomplete tags appearing more than expected
 *
 * @param text - Recent streaming text to analyze
 * @param threshold - Number of repetitions to consider a loop (default: 5)
 * @returns true if loop pattern detected
 */
export function detectToolCallLoop(
  text: string,
  threshold: number = 5,
): boolean {
  // Check for repetitive <function= patterns
  const functionTagMatches = text.match(/<function=[^>]*>/g);
  if (functionTagMatches && functionTagMatches.length > threshold) {
    return true;
  }

  // Check for same incomplete tag repeated
  const incompleteMatches = text.match(/<function=[^\s>]+(?:\s|$)/g);
  if (incompleteMatches && incompleteMatches.length > threshold) {
    return true;
  }

  return false;
}
