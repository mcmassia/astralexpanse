import { GoogleGenerativeAI } from '@google/generative-ai';
import { useAIStore } from '../stores/aiStore';
import { useObjectStore } from '../stores/objectStore';

class AIService {
    private getClient() {
        const { apiKey, isEnabled } = useAIStore.getState();
        if (!isEnabled || !apiKey) {
            throw new Error('AI features are disabled or API key is missing.');
        }
        return new GoogleGenerativeAI(apiKey);
    }

    private getModel(feature: keyof ReturnType<typeof useAIStore.getState>['models']) {
        const client = this.getClient();
        const { models } = useAIStore.getState();
        return client.getGenerativeModel({ model: models[feature] });
    }

    async generateObject(
        prompt: string,
        schema?: any, // We can refine this type if using valid SchemaType
        // schemaName: string = 'Response' // Unused
    ): Promise<any> {
        const model = this.getModel('smartConstructor');

        // Construct a prompt that enforces JSON
        const fullPrompt = `${prompt}
    
    Respond STRICTLY in JSON format. Do not include markdown code blocks (no \`\`\`json).
    Target Schema: ${JSON.stringify(schema, null, 2)}`;

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        try {
            // Clean up any potential markdown formatting in case the model ignores instruction
            const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (e) {
            console.error('Failed to parse AI response:', text);
            throw new Error('Failed to parse AI response as JSON');
        }
    }

    async extractEntities(content: string): Promise<any[]> {
        const model = this.getModel('entityExtraction');
        const prompt = `
      Analyze the following text and extract actionable entities.
      Return a JSON array of objects with "type" (Task, Event, Person) and "details".
      
      Text: "${content}"
    `;

        // Reuse generateObject logic or custom
        // For simplicity, reusing the raw generation with JSON enforcement
        const result = await model.generateContent(prompt + "\nRespond in JSON array format only.");
        const text = result.response.text();
        try {
            const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (e) {
            return [];
        }
    }

    // --- SELF-QUERYING ROUTER ---
    async analyzeQuery(query: string): Promise<{
        filters: { type?: string; tags?: string[]; dateRange?: string };
        searchQuery: string;
        intent: 'search' | 'summary' | 'count';
    }> {
        const model = this.getModel('smartConstructor'); // Use a fast model if possible

        // Dynamic Type Injection - Use ONLY name and namePlural, never IDs
        const objectTypes = useObjectStore.getState().objectTypes;
        const typeList = objectTypes.map(t =>
            `"${t.name}" (plural: "${t.namePlural}")`
        ).join(', ');

        const prompt = `
        You are a Search Router for a Personal Knowledge Management (PKM) system.
        Analyze the user's query and extract filters and search intent.
        
        AVAILABLE OBJECT TYPES (use EXACTLY these names):
        ${typeList}
        
        USER QUERY: "${query}"
        
        CRITICAL RULES FOR TYPE FILTER:
        - The "type" field MUST be set to one of the EXACT values from AVAILABLE OBJECT TYPES above (singular name or plural name).
        - Do NOT translate or interpret the type. Use the EXACT string from the list.
        - If the user says "tareas", return "Tareas". If they say "proyecto", return "Proyecto".
        - If no type matches, set type to null.
        
        Return JSON ONLY:
        {
          "filters": {
            "type": "string (EXACT name or plural name from AVAILABLE OBJECT TYPES, or null)",
            "tags": ["string array"],
            "dateRange": "enum: 'last_7_days', 'last_30_days', 'future' or null"
          },
          "searchQuery": "string (optimized keywords for vector search, removing stop words)",
          "intent": "enum: 'search', 'summary', 'count'"
        }
        
        Example: "Resume las reuniones de la semana pasada"
        Response: { "filters": { "type": "Reuniones", "dateRange": "last_7_days" }, "searchQuery": "resumen actas", "intent": "summary" }
        `;

        try {
            const result = await this.retry(() => model.generateContent(prompt));
            const text = result.response.text();
            const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (e) {
            console.warn('[AI] Router failed, falling back to raw query', e);
            return { filters: {}, searchQuery: query, intent: 'search' };
        }
    }

    private async retry<T>(
        fn: () => Promise<T>,
        retries = 3,
        delay = 2000,
        onRetry?: (attempt: number, delayMs: number, reason: string) => void
    ): Promise<T> {
        try {
            return await fn();
        } catch (error: any) {
            const isRetryable =
                error?.message?.includes('429') ||
                error?.message?.includes('503') ||
                error?.message?.includes('overloaded') ||
                error?.message?.includes('Service Unavailable');

            if (retries > 0 && isRetryable) {
                const reason = error?.message?.includes('429') ? 'Rate Limited (429)' : 'Model Overloaded (503)';
                console.warn(`[AI] ${reason}. Retrying in ${delay}ms... (${retries} retries left)`);
                onRetry?.(4 - retries, delay, reason);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.retry(fn, retries - 1, delay * 2, onRetry);
            }
            throw error;
        }
    }

    async chat(
        message: string,
        contextDocs: string[],
        history: { role: 'user' | 'model', parts: [{ text: string }] }[] = [],
        onRetry?: (attempt: number, delayMs: number, reason: string) => void
    ) {
        const model = this.getModel('chat');

        // Create a system instruction or context preamble
        const systemInstruction = `You are the Astral Expanse AI Assistant. 
    Answer the user's question based ONLY on the provided context if possible.
    If the context contains objects with IDs (e.g., [ID:123]), cite them in your answer.
    
    IMPORTANT:
    - many objects may have empty CONTENT. In those cases, you MUST infer their purpose/nature from their TITLE, TYPE, and PROPERTIES.
    - If you see a list of linked objects (e.g., project phases), summarize them based on their titles.
    
    SYSTEM METADATA & CONTEXT:
    ${contextDocs.join('\n\n---\n\n')}
    `;

        const chat = model.startChat({
            history: [
                {
                    role: 'user',
                    parts: [{ text: systemInstruction }]
                },
                {
                    role: 'model',
                    parts: [{ text: 'Understood. I will answer based on the context.' }]
                },
                ...history
            ]
        });

        // Use retry wrapper with onRetry callback
        const result = await this.retry(() => chat.sendMessage(message), 3, 2000, onRetry);
        const response = await result.response;
        return response.text();
    }

    async getEmbeddings(text: string): Promise<number[]> {
        const client = this.getClient();
        const { models } = useAIStore.getState();
        const model = client.getGenerativeModel({ model: models.embeddings });

        // Use retry wrapper
        const result = await this.retry(() => model.embedContent(text));
        return result.embedding.values;
    }
}

export const aiService = new AIService();
