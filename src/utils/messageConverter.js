const IGNORE_PREFIX_COMMAND = '<command-name>';
const IGNORE_PREFIX_INTERRUPTED = '[Request interrupted';

/**
 * Normalizes tool result content safely.
 */
const formatToolResultContent = (toolResult) => {
  if (!toolResult) return null;
  if (toolResult.content == null) return null;
  return typeof toolResult.content === 'string' ? toolResult.content : JSON.stringify(toolResult.content);
};

/**
 * Safely converts a value to an ISO string, falling back to current time if invalid.
 */
const safeToISOString = (value) => {
  const date = new Date(value ?? Date.now());
  if (isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
};

/**
 * Converts raw Gemini CLI session messages into the app's internal chat message format.
 * @param {Array} rawMessages - The raw messages from the API.
 * @returns {Array} converted - The normalized chat messages.
 */
export const convertSessionMessages = (rawMessages) => {
  if (!rawMessages || !Array.isArray(rawMessages)) return [];
  
  const converted = [];
  const toolResults = new Map();
  
  // First pass: collect results
  for (const msg of rawMessages) {
    if (msg.message?.role === 'user' && Array.isArray(msg.message?.content)) {
      for (const part of msg.message.content) {
        if (part.type === 'tool_result') {
          toolResults.set(part.tool_use_id, {
            content: part.content,
            isError: part.is_error,
            timestamp: safeToISOString(msg.timestamp)
          });
        }
      }
    }
  }
  
  // Second pass: process messages
  for (const msg of rawMessages) {
    if (msg.message?.role === 'user' && msg.message?.content) {
      const content = Array.isArray(msg.message.content)
        ? msg.message.content
            .filter(p => p.type === 'text')
            .map(p => p.text)
            .join('\n')
        : String(msg.message.content);
      
      if (content && !content.startsWith(IGNORE_PREFIX_COMMAND) && !content.startsWith(IGNORE_PREFIX_INTERRUPTED)) {
        converted.push({
          type: 'user',
          content: content,
          timestamp: safeToISOString(msg.timestamp)
        });
      }
    } else if (msg.message?.role === 'assistant' && msg.message?.content) {
      if (Array.isArray(msg.message.content)) {
        for (const part of msg.message.content) {
          if (part.type === 'text') {
            converted.push({
              type: 'assistant',
              content: part.text,
              timestamp: safeToISOString(msg.timestamp)
            });
          } else if (part.type === 'tool_use') {
            const toolResult = toolResults.get(part.id);
            converted.push({
              type: 'assistant',
              content: '',
              timestamp: safeToISOString(msg.timestamp),
              isToolUse: true,
              toolName: part.name,
              toolInput: JSON.stringify(part.input ?? {}),
              toolResult: formatToolResultContent(toolResult),
              toolError: toolResult?.isError || false,
              toolResultTimestamp: safeToISOString(toolResult?.timestamp)
            });
          }
        }
      } else if (typeof msg.message.content === 'string') {
        converted.push({
          type: 'assistant',
          content: msg.message.content,
          timestamp: safeToISOString(msg.timestamp)
        });
      }
    }
  }
  return converted;
};
