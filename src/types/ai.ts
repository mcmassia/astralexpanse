export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    content: string;
    timestamp: number;
}

export interface AIModelConfig {
    smartConstructor: string;
    entityExtraction: string;
    chat: string;
    embeddings: string;
}
