import { ChatMessage } from '../LLMProvider';

export function buildL1Prompt(
  courseName: string,
  files: { filename: string; content: string }[]
): ChatMessage[] {
  const fileContents = files
    .map((f, i) => `--- File ${i + 1}: ${f.filename} ---\n${f.content}`)
    .join('\n\n');

  const filenameList = files.map((f) => f.filename).join(', ');

  return [
    {
      role: 'system',
      content: `You are an expert exam preparation assistant. Your task is to analyze course materials and build a structured exam-point content tree.

The tree structure rules:
- Root node: the course name "${courseName}"
- Organize by knowledge structure: group by topics, chapters, or concept areas — NOT by source file
- Do NOT create file-level grouping nodes. Merge related content from different files under the same topic
- Leaf nodes must have an "importance" field: "High-Frequency", "Important", or "Awareness"
- Leaf nodes must have a "sourceFile" field: the filename of the primary source file for that exam point. Must be one of: ${filenameList}
- Non-leaf nodes should NOT have importance or sourceFile
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
        "name": "Topic Area",
        "children": [
          {
            "name": "Subtopic",
            "children": [
              {
                "name": "Exam Point",
                "importance": "High-Frequency",
                "sourceFile": "lecture1.pdf"
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
