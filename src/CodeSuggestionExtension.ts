import * as vscode from 'vscode';
import axios, { AxiosResponse } from 'axios';

class CodeSuggestionExtension {
    private completionText: string | undefined;
    private decoration: vscode.TextEditorDecorationType | undefined;
    private currentDecorationRange: vscode.Range | undefined;
    private readonly context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;

        // Register commands
        this.context.subscriptions.push(
            vscode.commands.registerCommand('code-suggestion-extension.getSuggestion', this.getSuggestionCommand.bind(this)),
            vscode.commands.registerCommand('code-suggestion-extension.cancelSuggestion', this.cancelSuggestionCommand.bind(this))
        );
    }

    private async fetchTextResponse(params: {
        endpoint: string;
        endpointChat?: string;
        model: string;
        maxTokens: number;
        completePrompt: string;
        assistantMessage: string;
        asChat: boolean;
        temperature: number;
    }): Promise<string> {
        const { endpoint, endpointChat, model, maxTokens, completePrompt, assistantMessage, asChat, temperature } = params;
        const url = asChat ? endpointChat : endpoint;

        const payload = asChat
            ? {
                messages: [
                    { role: 'assistant', content: assistantMessage },
                    { role: 'user', content: completePrompt }
                ],
                model,
                max_tokens: maxTokens,
                temperature,
            }
            : {
                prompt: completePrompt,
                model,
                max_tokens: maxTokens,
                temperature,
            };

        try {
            const response: AxiosResponse = await axios.post(url!, payload);
            return asChat
                ? response.data.choices[0]?.message?.content ?? ''
                : response.data.choices[0]?.text ?? '';
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                // Axios-specific error handling
                vscode.window.showErrorMessage(`API request failed: ${error.message}`);
            } else if (error instanceof Error) {
                // General JavaScript Error handling
                vscode.window.showErrorMessage(`API request failed: ${error.message}`);
            } else {
                // Fallback for unknown error types
                vscode.window.showErrorMessage('An unknown error occurred during the API request.');
            }
            return '';
        }
    }

    private getActiveEditor(): vscode.TextEditor | null {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('Please open a text editor and select code.');
            return null;
        }
        return editor;
    }

    private async getSuggestionCommand() {
        const editor = this.getActiveEditor();
        if (!editor) {
            return;
        }

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection).trim();
        if (!selectedText) {
            vscode.window.showInformationMessage('Please select code to get a suggestion.');
            return;
        }

        const config = vscode.workspace.getConfiguration('codeSuggestionExtension');
        const params = {
            endpoint: config.get<string>('endpoint') || 'http://localhost:5000/v1/completions',
            endpointChat: config.get<string>('endpointchat') || 'http://localhost:5000/v1/chat/completions',
            model: config.get<string>('model') || 'gpt-4',
            maxTokens: config.get<number>('max_tokens') || 100,
            completePrompt: `${config.get<string>('prompt') || 'Complete the following: '}${selectedText}`,
            assistantMessage: config.get<string>('assistant_message') || 'Provide concise suggestions.',
            asChat: config.get<boolean>('as_chat') ?? false,
            temperature: config.get<number>('temperature') ?? 0.7,
        };

        const suggestion = await this.fetchTextResponse(params);
        this.completionText = suggestion.trim();

        if (!this.completionText) {
            vscode.window.showInformationMessage('No suggestion available.');
            return;
        }

        vscode.window.showInformationMessage(`Suggestion: ${this.completionText}`);
    }

    private cancelSuggestionCommand() {
        const editor = this.getActiveEditor();
        if (editor && this.decoration) {
            editor.setDecorations(this.decoration, []);
            this.completionText = undefined;
            this.currentDecorationRange = undefined;
            this.decoration = undefined;

            vscode.commands.executeCommand('setContext', 'suggestionVisible', false);
        }
    }
}