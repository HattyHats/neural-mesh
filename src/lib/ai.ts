import { CreateMLCEngine, MLCEngine } from '@mlc-ai/web-llm';

let engine: MLCEngine | null = null;
let isInitializing = false;

export async function brainstormConcept(conceptText: string, onProgress: (msg: string) => void): Promise<string[]> {
  if (!engine) {
    if (isInitializing) throw new Error("AI is currently downloading/initializing. Please wait.");
    isInitializing = true;
    try {
      engine = await CreateMLCEngine(
        "Llama-3.2-1B-Instruct-q4f16_1-MLC",
        {
          initProgressCallback: (progress) => {
            onProgress(progress.text);
          }
        }
      );
    } catch (e: any) {
      isInitializing = false;
      throw new Error("Failed to load AI model: " + e.message);
    }
    isInitializing = false;
  }

  onProgress("Brainstorming related concepts...");

  const reply = await engine.chat.completions.create({
    messages: [
      { role: "system", content: "You are a brainstorming assistant. Given a concept, generate exactly 3 highly relevant and interesting sub-concepts, ideas, or associations. Output your answer STRICTLY as a JSON array of strings, like: [\"Idea 1\", \"Idea 2\", \"Idea 3\"] and nothing else." },
      { role: "user", content: `Concept: ${conceptText}` }
    ],
    temperature: 0.8,
  });

  const responseText = reply.choices[0].message.content || '[]';
  
  try {
    const match = responseText.match(/\[.*\]/s);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed.slice(0, 3);
    }
    const parsedFallback = JSON.parse(responseText);
    return Array.isArray(parsedFallback) ? parsedFallback.slice(0, 3) : [];
  } catch (e) {
    console.error("Failed to parse AI output:", responseText);
    return ["Concept A", "Concept B", "Concept C"];
  }
}
