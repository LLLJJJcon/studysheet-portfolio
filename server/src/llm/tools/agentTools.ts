import { ToolDefinition } from '../LLMProvider';

/**
 * L5 Agent tool definitions for content tree inspection.
 * These tools allow the LLM to read the tree structure and content
 * before proposing changes.
 */

// Tool definitions for the L5 agent to inspect and search the content tree
export const agentTools: ToolDefinition[] = [
  {
    name: 'get_node_content',
    description:
      'Get the full content (chunk text) and metadata of a specific tree node by its nodeId.',
    parameters: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'string',
          description: 'The unique identifier of the tree node.',
        },
      },
      required: ['nodeId'],
    },
  },
  {
    name: 'get_subtree',
    description:
      'Get the subtree structure starting from a given nodeId. Returns the node, its children (recursively), their names, importance levels, and nodeIds. Does NOT include chunk content — use get_node_content for that.',
    parameters: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'string',
          description:
            'The nodeId of the subtree root. Use "root" to get the entire tree.',
        },
        maxDepth: {
          type: 'number',
          description:
            'Maximum depth to traverse. Default is 3. Use -1 for unlimited depth.',
        },
      },
      required: ['nodeId'],
    },
  },
  {
    name: 'search_nodes',
    description:
      'Search for tree nodes whose name or content matches a query string (case-insensitive substring match). Returns matching nodeIds, names, importance, and a snippet of their content.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to match against node names and content.',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return. Default is 10.',
        },
      },
      required: ['query'],
    },
  },
];
