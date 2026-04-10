import { ChatMessage } from '../LLMProvider';

export function buildL1Prompt(
  courseName: string,
  files: { filename: string; content: string }[]
): ChatMessage[] {
  const fileContents = files
    .map((f, i) => `--- File ${i + 1}: ${f.filename} ---\n${f.content}`)
    .join('\n\n');

  return [
    {
      role: 'system',
      content: `You are an expert exam preparation assistant. Your task is to analyze course materials and build a structured exam-point content tree.

The tree structure rules:
- Root node: the course name "${courseName}"
- Second-level nodes: one per source file (use the filename as the node name)
- Under each second-level node: hierarchical exam-point structure extracted from that file
- Leaf nodes must have an "importance" field: "High-Frequency", "Important", or "Awareness"
- Non-leaf nodes should NOT have importance
- Importance should be assigned from a GLOBAL perspective across all files to ensure cross-file consistency

Importance criteria:
- "High-Frequency": Highly likely to appear in exam questions
- "Important": Core concepts that need to be mastered
- "Awareness": Background knowledge or low-frequency exam points

Output format: valid JSON with this structure:
{
  "tree": {
    "name": "${courseName}",
    "children": [
      {
        "name": "filename",
        "sourceFile": "filename",
        "children": [
          {
            "name": "Chapter/Topic",
            "children": [
              {
                "name": "Exam Point",
                "importance": "High-Frequency" | "Important" | "Awareness"
              }
            ]
          }
        ]
      }
    ]
  }
}

IMPORTANT: Output ONLY valid JSON. No markdown, no code blocks, no explanations.`,
    },
    {
      role: 'user',
      content: `Course: ${courseName}\n\nAnalyze the following course materials and generate the exam-point content tree:\n\n${fileContents}`,
    },
  ];
}
