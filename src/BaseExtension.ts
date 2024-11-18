import * as vscode from 'vscode';
import axios, { AxiosResponse } from 'axios';
import { KeyBinding, Params } from './types'; // Adjust the path based on your project structure


export class BaseExtension {
    protected completionText: string | undefined;
    protected completionRaw: string | undefined;
    protected decoration: vscode.TextEditorDecorationType | undefined;
    protected currentDecorationRange: vscode.Range | undefined;
    protected readonly context: vscode.ExtensionContext;
    protected params: Params;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        const config = vscode.workspace.getConfiguration('codeSuggestionExtension');
        this.params = {
            endpoint: config.get<string>('endpoint') || 'http://localhost:5000/v1/completions',
            endpointChat: config.get<string>('endpointchat') || 'http://localhost:5000/v1/chat/completions',
            model: config.get<string>('model') || 'gpt-4',
            maxTokens: config.get<number>('max_tokens') || 100,
            prompt: `${config.get<string>('prompt') || 'Complete the following: '}`,
            completePrompt: '',
            assistantMessage: config.get<string>('assistant_message') || 'Provide concise suggestions.',
            asChat: config.get<boolean>('as_chat') ?? false,
            temperature: config.get<number>('temperature') ?? 0.7,
        };
    }

    protected async fetchTextResponse(params: Params): Promise<string> {
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

    protected getActiveEditor(): vscode.TextEditor | null {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('Please open a text editor and select code.');
            return null;
        }
        return editor;
    }

    protected escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&(?!gt;|lt;|amp;)/g, "&amp;") // Escapes & unless part of &gt;, &lt;, or &amp;
            .replace(/(?<!-|=|'|' |"|" | )<(?!\?)/g, "&lt;")
            .replace(/(?<!-|=|\?|' |'|" |"| |<)>/g, "&gt;"); // Escapes > unless preceded by -
    }

    protected unescapeHtml(content: string): string {
        return content
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&amp;/g, "&");
    }

    protected stripMarkdown(content: string): string {
        return content.replace(/```[a-z]*|```|__|[*#`~]/gi, '').trim();
        //return content.replace(/(?:__|[*#`~\-]|(?:\[\^?.*?\]\(.*?\)))/g, '').trim();
    }

    protected getWebviewContent(title: string, is_sidebar: boolean | false): string {
        let refreshButton = '';
        if (is_sidebar) {
            refreshButton = '<button id="refreshButton" class="vscode-button">refresh</button>';
        }
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.3.1/styles/default.min.css">
                <style>
                    body {
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        font-family: var(--vscode-font-family);
                    }
                    .vscode-button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: 1px solid transparent;
                        border-radius: 2px;
                        padding: 5px 10px;
                        cursor: pointer;
                    }
                    .vscode-button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    button.hidden {
                        display:none;
                    }
                    /* Filled Icon */
                    .info-icon-filled {
                        display: inline-block;
                        width: 11px;
                        height: 11px;
                        margin-right: 6px;
                        background-color: #007acc; /* The fill color */
                        mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>') no-repeat center / contain;
                        -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>') no-repeat center / contain;
                        vertical-align: middle;
                        flex-shrink: 0;
                    }

                    /* Outlined Icon */
                    .info-icon-outline {
                        display: inline-block;
                        width: 11px;
                        height: 11px;
                        margin-right: 6px;
                        background-color: transparent; /* Transparent background */
                        border: 2px solid #007acc; /* Circle border color */
                        border-radius: 50%; /* Makes the border circular */
                        position: relative; /* Allows positioning the inner 'i' */
                        vertical-align: middle;
                        flex-shrink: 0;
                    }

                    .info-icon-outline::before {
                        content: "i"; /* The 'i' inside the circle */
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        font-size: 10px; /* Adjust font size for the 'i' */
                        color: #007acc; /* Color of the 'i' */
                        font-family: Arial, sans-serif; /* Use a simple font for the 'i' */
                        font-weight: bold; /* Bold 'i' */
                    }
                    .info-message {
                        display: flex;
                        align-items: center; /* Align icon and text */
                        font-size: 13px; /* Matches VSCode's default info font size */
                        font-family: var(--vscode-font-family, 'Segoe WPC', 'Segoe UI', sans-serif); /* Use VSCode's font family */
                        font-weight: var(--vscode-font-weight, normal); /* Use VSCode's font weight */
                        color: var(--vscode-editor-foreground, #333333); /* Use VSCode's text color */
                        line-height: var(--vscode-line-height, 1.5); /* Use VSCode's default line height */
                    }
                    .hljs {
                        font-family: var(--vscode-editor-font-family, Consolas, 'Courier New', monospace);
                        font-size: var(--vscode-editor-font-size, 14px);
                        line-height: var(--vscode-editor-line-height, 1.5);
                        background-color: var(--vscode-editor-background, #1e1e1e); /* VSCode editor background */
                        color: var(--vscode-editor-foreground, #d4d4d4); /* Default text color */
                        padding: 8px;
                        border-radius: 4px;
                        overflow: auto;
                    }

                    .hljs-keyword,
                    .hljs-selector-tag,
                    .hljs-literal,
                    .hljs-strong {
                        color: var(--vscode-editor-keywordForeground, #569cd6); /* Keywords, tags */
                        font-weight: bold;
                    }

                    .hljs-string,
                    .hljs-title,
                    .hljs-name {
                        color: var(--vscode-editor-stringForeground, #ce9178); /* Strings and titles */
                    }

                    .hljs-comment {
                        color: var(--vscode-editor-commentForeground, #6a9955); /* Comments */
                        font-style: italic;
                    }
                </style>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.3.1/highlight.min.js"></script>
            </head>
            <body>
                <h2>${title}</h2>
                <div class="info-message">
                    <span class="info-icon-outline"></span>
                    Highlight text in the editor to generate AI-powered suggestions.
                </div>
                <pre><code id="content" data-markdown="">Your code suggestion will appear here!</code></pre>
                <button id="acceptButton"  class="vscode-button">accept</button>
                ${refreshButton}
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    window.addEventListener('message', event => {
                        const message = event.data; // The JSON data sent from the extension
                        if (message.htmlSuggestion) {
                            const contentContainer = document.getElementById('content');
                            contentContainer.innerHTML = '';
                            const tempContainer = document.createElement('div');
                            tempContainer.innerHTML =  message.htmlSuggestion;
                            Array.from(tempContainer.childNodes).forEach(node => contentContainer.appendChild(node));
                            hljs.highlightAll();
                        }
                        if (message.suggestion) {
                            const markdownContainer = document.getElementById('content');
                            markdownContainer.setAttribute('data-markdown', message.suggestion);
                        }
                        const buttonAccept = document.getElementById('acceptButton');
                        const buttonNext = document.getElementById('refreshButton');
                        if (message.type == 'clear') {
                            button.classList.add('hidden');
                            button.classList.add('hidden');
                        } else {
                            button.classList.remove('hidden');
                            button.classList.remove('hidden');
                        }
                    });
                    
                    // Handle button click
                    document.getElementById('acceptButton').addEventListener('click', () => {
                        vscode.postMessage({ command: 'accept' });
                    });
                    document.getElementById('refreshButton').addEventListener('click', () => {
                        vscode.postMessage({ command: 'refresh' });
                    });
                </script>
            </body>
            </html>
        `;
    }
}