#!/usr/bin/env node

/**
 * Test script to verify vLLM tool calling works correctly
 * This sends a direct request to the vLLM server with tool definitions
 */

async function testVLLMToolCalling() {
  const baseURL = 'http://localhost:8000/v1';
  const model = 'Qwen3-Coder-30B';

  // Define tools in OpenAI format
  const tools = [
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Reads and returns the content of a specified file',
        parameters: {
          type: 'object',
          properties: {
            absolute_path: {
              type: 'string',
              description: 'The absolute path to the file to read'
            }
          },
          required: ['absolute_path']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'glob',
        description: 'Search for files matching a pattern',
        parameters: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'The glob pattern to match files against'
            }
          },
          required: ['pattern']
        }
      }
    }
  ];

  const messages = [
    {
      role: 'user',
      content: 'Can you read the README.md file in /home/andywinnock/Developer/qwen-code/?'
    }
  ];

  console.log('🧪 Testing vLLM Tool Calling\n');
  console.log('📍 Endpoint:', baseURL);
  console.log('🤖 Model:', model);
  console.log('🔧 Tools provided:', tools.map(t => t.function.name).join(', '));
  console.log('\n📨 Sending request...\n');

  try {
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        tools: tools,
        tool_choice: 'auto',
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ HTTP Error:', response.status, response.statusText);
      console.error('Error details:', errorText);
      return;
    }

    const data = await response.json();

    console.log('✅ Response received!\n');
    console.log('📦 Full Response:');
    console.log(JSON.stringify(data, null, 2));
    console.log('\n' + '='.repeat(80) + '\n');

    const message = data.choices[0]?.message;

    if (message?.tool_calls && message.tool_calls.length > 0) {
      console.log('🎉 SUCCESS! Tool calls detected:\n');
      message.tool_calls.forEach((toolCall, idx) => {
        console.log(`Tool Call ${idx + 1}:`);
        console.log(`  ID: ${toolCall.id}`);
        console.log(`  Function: ${toolCall.function.name}`);
        console.log(`  Arguments:`, JSON.stringify(JSON.parse(toolCall.function.arguments), null, 4));
        console.log('');
      });
    } else if (message?.content) {
      console.log('⚠️  No tool calls detected. Got text response instead:\n');
      console.log(message.content);
      console.log('\n');

      // Check if the response contains XML tool call syntax
      if (message.content.includes('<tool_call>')) {
        console.log('❌ ISSUE DETECTED: Model returned XML tool calls as text!');
        console.log('   This means the qwen3_coder parser did NOT convert them to OpenAI format.');
        console.log('   The tools parameter may not be reaching vLLM correctly.\n');
      }
    } else {
      console.log('⚠️  Unexpected response format');
    }

    // Show finish reason
    console.log('Finish reason:', data.choices[0]?.finish_reason || 'unknown');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

// Run the test
testVLLMToolCalling().catch(console.error);
