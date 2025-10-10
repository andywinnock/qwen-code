#!/usr/bin/env node

/**
 * Direct vLLM testing - compare streaming vs non-streaming tool calls
 */

const baseURL = 'http://localhost:8000/v1';
const model = 'Qwen3-Coder-30B';

const tools = [
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'Lists files and directories in a specified path',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The directory path to list'
          }
        },
        required: ['path']
      }
    }
  }
];

const messages = [
  {
    role: 'user',
    content: 'List the files in /home/andywinnock/Developer/qwen-code'
  }
];

async function testNonStreaming() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 TEST 1: NON-STREAMING MODE');
  console.log('═══════════════════════════════════════════════════════════\n');

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      messages: messages,
      tools: tools,
      tool_choice: 'auto',
      temperature: 0.7,
      stream: false
    })
  });

  const data = await response.json();
  const message = data.choices[0]?.message;

  console.log('📦 Complete Response:');
  console.log(JSON.stringify(data, null, 2));
  console.log('\n' + '─'.repeat(60) + '\n');

  console.log('📋 Message Content:', message.content);
  console.log('🔧 Tool Calls:', message.tool_calls ? JSON.stringify(message.tool_calls, null, 2) : 'None');
  console.log('🏁 Finish Reason:', data.choices[0]?.finish_reason);
  console.log('\n');
}

async function testStreaming() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 TEST 2: STREAMING MODE');
  console.log('═══════════════════════════════════════════════════════════\n');

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      messages: messages,
      tools: tools,
      tool_choice: 'auto',
      temperature: 0.7,
      stream: true
    })
  });

  console.log('📡 Streaming chunks:\n');

  let chunkCount = 0;
  let content = '';
  let toolCalls = [];
  let finishReason = null;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '));

    for (const line of lines) {
      const data = line.replace('data: ', '').trim();
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        chunkCount++;

        const delta = parsed.choices[0]?.delta;

        // Accumulate content
        if (delta?.content) {
          content += delta.content;
          console.log(`  Chunk ${chunkCount}: content="${delta.content}"`);
        }

        // Check for tool_calls in delta
        if (delta?.tool_calls) {
          console.log(`  Chunk ${chunkCount}: tool_calls=`, JSON.stringify(delta.tool_calls, null, 2));
          toolCalls = delta.tool_calls;
        }

        // Check finish reason
        if (parsed.choices[0]?.finish_reason) {
          finishReason = parsed.choices[0].finish_reason;
          console.log(`  Chunk ${chunkCount}: finish_reason="${finishReason}"`);
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }

  console.log('\n' + '─'.repeat(60) + '\n');
  console.log('📊 STREAMING SUMMARY:');
  console.log('  Total chunks:', chunkCount);
  console.log('  Accumulated content:', JSON.stringify(content));
  console.log('  Tool calls found:', toolCalls.length > 0 ? JSON.stringify(toolCalls, null, 2) : 'None');
  console.log('  Final finish reason:', finishReason);
  console.log('\n');
}

async function main() {
  try {
    await testNonStreaming();
    await testStreaming();

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ ANALYSIS:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('Non-streaming mode:');
    console.log('  - Should have tool_calls in message');
    console.log('  - Should have content = null');
    console.log('  - Should have finish_reason = "tool_calls"');
    console.log('');
    console.log('Streaming mode:');
    console.log('  - Check if tool_calls appear in delta');
    console.log('  - Check if XML appears in content');
    console.log('  - Check what finish_reason is set to');
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
