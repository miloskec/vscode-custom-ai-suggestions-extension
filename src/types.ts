// types.ts
export interface Params {
    endpoint?: string;          // Optional non-chat-specific API endpoint
    endpointChat?: string;      // Optional chat-specific API endpoint
    model: string;              // AI model name (e.g., GPT-4)
    maxTokens: number;          // Maximum tokens allowed
    prompt: string;             // Base prompt text
    completePrompt: string;     // Generated full prompt
    assistantMessage?: string;   // Assistant's predefined message
    asChat: boolean;            // Indicates whether chat mode is used
    temperature: number;        // Randomness of response
}

export interface KeyBinding {
    type: String;
    default: String;
    binding: {
        type: String;
        command: string; 
        key: string; 
        when?: string;
    },
    description: String;
}