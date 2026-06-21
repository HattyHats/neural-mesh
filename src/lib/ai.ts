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
    } catch (e: unknown) {
      isInitializing = false;
      throw new Error("Failed to load AI model: " + (e as Error).message);
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
  } catch {
    console.error("Failed to parse AI output:", responseText);
    return ["Concept A", "Concept B", "Concept C"];
  }
}

export async function findGhostLinks(nodeTitle: string, allNodeTitles: string[], onProgress: (msg: string) => void): Promise<string[]> {
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
    } catch (e: unknown) {
      isInitializing = false;
      throw new Error("Failed to load AI model: " + (e as Error).message);
    }
    isInitializing = false;
  }

  onProgress("Finding conceptual links...");

  const prompt = `You are an AI serendipity engine. Your job is to find conceptual links between thoughts. 
Given a target thought and a list of other existing thoughts, return exactly 1 to 3 existing thoughts that are conceptually related or have interesting hidden links to the target thought.
Target thought: "${nodeTitle}"
Available thoughts: ${JSON.stringify(allNodeTitles)}

Output your answer STRICTLY as a JSON array of strings from the available thoughts list, like: ["Thought A", "Thought B"] and nothing else.`;

  const reply = await engine.chat.completions.create({
    messages: [
      { role: "system", content: "You are a serendipity engine. You ONLY reply with a JSON array of strings representing conceptually related concepts." },
      { role: "user", content: prompt }
    ],
    temperature: 0.5,
  });

  const responseText = reply.choices[0].message.content || '[]';
  
  try {
    const match = responseText.match(/\[.*\]/s);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed.filter(t => allNodeTitles.includes(t));
    }
    const parsedFallback = JSON.parse(responseText);
    return Array.isArray(parsedFallback) ? parsedFallback.filter(t => allNodeTitles.includes(t)) : [];
  } catch {
    console.error("Failed to parse AI Ghost Link output:", responseText);
    return [];
  }
}

export async function devilsAdvocate(conceptText: string, onProgress: (msg: string) => void): Promise<string[]> {
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
    } catch (e: unknown) {
      isInitializing = false;
      throw new Error("Failed to load AI model: " + (e as Error).message, { cause: e });
    }
    isInitializing = false;
  }

  onProgress("Playing Devil's Advocate...");

  const reply = await engine.chat.completions.create({
    messages: [
      { role: "system", content: "You are a 'Devil's Advocate' engine. Given a concept, generate exactly 2 distinct counter-arguments, opposing viewpoints, or deeply challenging questions about the concept. Output your answer STRICTLY as a JSON array of strings, like: [\"Counter argument 1\", \"Counter argument 2\"] and nothing else." },
      { role: "user", content: `Concept: ${conceptText}` }
    ],
    temperature: 0.8,
  });

  const responseText = reply.choices[0].message.content || '[]';
  
  try {
    const match = responseText.match(/\[.*\]/s);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed.slice(0, 2);
    }
    const parsedFallback = JSON.parse(responseText);
    return Array.isArray(parsedFallback) ? parsedFallback.slice(0, 2) : [];
  } catch {
    console.error("Failed to parse AI output:", responseText);
    return ["What is the primary flaw in this thinking?", "How might the opposite be true?"];
  }
}

export async function autoClusterNodes(nodes: {id: string, text: string}[], onProgress: (msg: string) => void): Promise<{ category: string, nodeIds: string[] }[]> {
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
    } catch (e: unknown) {
      isInitializing = false;
      throw new Error("Failed to load AI model: " + (e as Error).message);
    }
    isInitializing = false;
  }

  onProgress("Clustering thoughts...");

  const prompt = `You are an AI semantic clustering engine. Your job is to group a list of thoughts into 2 to 4 distinct categories based on their semantic similarity or underlying themes.
Input thoughts: ${JSON.stringify(nodes.map(n => ({ id: n.id, text: n.text })))}

Output your answer STRICTLY as a JSON array of objects, where each object has a "category" (string name of the group) and "nodeIds" (array of string IDs belonging to that category). Like: [{"category": "Work", "nodeIds": ["id1", "id2"]}, {"category": "Ideas", "nodeIds": ["id3"]}] and nothing else.`;

  const reply = await engine.chat.completions.create({
    messages: [
      { role: "system", content: "You are a semantic clustering engine. You ONLY reply with a JSON array of category objects." },
      { role: "user", content: prompt }
    ],
    temperature: 0.2,
  });

  const responseText = reply.choices[0].message.content || '[]';
  
  try {
    const match = responseText.match(/\[.*\]/s);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed;
    }
    const parsedFallback = JSON.parse(responseText);
    return Array.isArray(parsedFallback) ? parsedFallback : [];
  } catch {
    console.error("Failed to parse AI Clustering output:", responseText);
    return [];
  }
}
