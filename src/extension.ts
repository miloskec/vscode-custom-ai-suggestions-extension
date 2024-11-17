import * as vscode from 'vscode';
import axios, { AxiosResponse } from 'axios';
import * as marked from 'marked';
import { SuggestionSidebarProvider } from './SidebarProvider';
import { CodeSuggestionExtension } from './CodeSuggestionExtension';

export function activate(context: vscode.ExtensionContext) {
    const provider = new SuggestionSidebarProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SuggestionSidebarProvider.viewType, provider)
    );

    new CodeSuggestionExtension(context);

    let completionText: string | undefined;
    let decoration: vscode.TextEditorDecorationType | undefined;
    let currentDecorationRange: vscode.Range | undefined;

    const config = vscode.workspace.getConfiguration('codeSuggestionExtension');
    const endpoint = config.get<string>('endpoint') || 'http://localhost:5000/v1/completions';
    const endpointchat = config.get<string>('endpointchat') || 'http://localhost:5000/v1/chat/completions';

    const model = config.get<string>('model') || 'gpt-4';
    const prompt = config.get<string>('prompt') || 'Complete the following: ';
    const assistantMessage = config.get<string>('assistant_message') || "You are a Laravel expert. Answer all questions with concise and accurate code snippets suitable for Laravel development. Do not include PHP tags (`<?php`, `?>`) or any introductory or explanatory text. Provide only the raw code so that it can be directly copied and pasted into a Laravel application.";
    const maxTokens = config.get<number>('max_tokens') || 100;
    const asChat = config.get<boolean>('as_chat') ?? false;
    const temperature = config.get<number>('temperature') ?? 0.7;


    async function fetchTextResponse(
        endpoint: string,
        endpointChat: string | undefined,
        model: string,
        maxTokens: number,
        completePrompt: string,
        assistantMessage: string,
        asChat: boolean,
        temperature: number
    ): Promise<string> {
        const url = asChat ? endpointChat : endpoint;

        // Choose the request payload based on asChat
        const payload = asChat
            ? {
                messages: [
                    { role: "assistant", content: assistantMessage },
                    { role: "user", content: completePrompt }
                ],
                model: model,
                max_tokens: maxTokens,
                temperature: temperature
            }
            : {
                prompt: completePrompt,
                model: model,
                max_tokens: maxTokens,
                temperature: temperature
            };
        try {
            // Make the request and store the response
            const response: AxiosResponse = await axios.post(url!, payload);

            // Check for valid response structure
            if (!response.data || !response.data.choices) {
                throw new Error('Invalid API response');
            }
            // Extract and return the text based on asChat
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

    function getEditor(): typeof vscode.window.activeTextEditor | null {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('Please open a text editor and select code.');
            return null;
        }
        return editor;
    }

    function escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    const getSidebar = vscode.commands.registerCommand('code-suggestion-extension.showSidebar', async () => {
        const editor = getEditor();
        if (!editor) {
            return;
        }

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        if (!selectedText) {
            vscode.window.showInformationMessage('Please select code to get a suggestion.');
            return;
        }

        const completePrompt = `${prompt}${selectedText}`;

        const text = await fetchTextResponse(
            endpoint,
            endpointchat,
            model,
            maxTokens,
            completePrompt,
            assistantMessage,
            asChat,
            temperature
        );

        const trimmedText = completionText = text.trim();
        if (!trimmedText) {
            vscode.window.showInformationMessage('No suggestion available.');
            return;
        }
        vscode.commands.executeCommand('workbench.view.extension.suggestionSidebarContainer');
        provider.sendMessage({ type: 'update', suggestion: completionText });
    });
    
    const getSuggestionWebViewCommand = vscode.commands.registerCommand('code-suggestion-extension.getWebViewSuggestion', async () => {
        const editor = getEditor();
        if (!editor) {
            return;
        }

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        if (!selectedText) {
            vscode.window.showInformationMessage('Please select code to get a suggestion.');
            return;
        }

        const completePrompt = `${prompt}${selectedText}`;
        try {
            const text = await fetchTextResponse(
                endpoint,
                endpointchat,
                model,
                maxTokens,
                completePrompt,
                assistantMessage,
                asChat,
                temperature
            );

            const trimmedText = completionText = text.trim();
            if (!trimmedText) {
                vscode.window.showInformationMessage('No suggestion available.');
                return;
            }

            //await vscode.commands.executeCommand("setContext", "suggestionVisible", true);
            await vscode.commands.executeCommand("code-suggestion-extension.showWebView", "Suggestions...", completionText);
        } catch (error) {
            vscode.window.showErrorMessage(`Error fetching suggestion: ${error}`);
        }
    });

    // Register a command that opens the webview
    const webViewPanel = vscode.commands.registerCommand('code-suggestion-extension.showWebView', async (title: string, content: string) => {
        const editor = getEditor();
        if (!editor) {
            return;
        }
        // Get the position of the end of the current line
        const endOfLine = editor.document.lineAt(editor.selection.active.line).range.end;
        // Insert a new line after the end of the current line
        const newLinePosition = new vscode.Position(endOfLine.line + 1, 0);
        // Set the current decoration range to start at the new line position and end at the same position
        currentDecorationRange = new vscode.Range(newLinePosition, newLinePosition);

        // Create and show a new webview
        const panel = vscode.window.createWebviewPanel(
            'suggestionsWebview', // Identifies the type of the webview. Used internally
            'Suggestions...', // Title of the panel displayed to the user
            vscode.ViewColumn.One, // Editor column to show the new webview panel in
            {
                enableScripts: true // Enable JavaScript in the webview
            }
        );
        // Set the HTML content for the webview
        panel.webview.html = getWebviewContent(title);
        // escape tags like <?php etc...
        let htmlContent = escapeHtml(content);
        // Convert the Markdown content to HTML using marked
        htmlContent = await marked.parse(htmlContent);
        // Send `content` to the webview after the panel is created
        panel.webview.postMessage({ content, htmlContent });
        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'accept':
                        panel.dispose(); // This will close the webview
                        completionText = message.text;
                        if (editor) {
                            console.log('active Editor');
                            await vscode.window.showTextDocument(editor.document, editor.viewColumn);
                        }
                        vscode.commands.executeCommand("code-suggestion-extension.acceptSuggestion");
                        break;
                    case 'close':
                        panel.dispose(); // This will close the webview
                        if (editor) {
                            await vscode.window.showTextDocument(editor.document, editor.viewColumn);
                        }
                        break;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    const acceptSidebarSuggestionCommand = vscode.commands.registerCommand('code-suggestion-extension.acceptSidebarSuggestion', async (suggestionText: string) => {
        const editor = getEditor();
        if (!editor) {
            return;
        }
        // Get the position of the end of the current line
        const endOfLine = editor.document.lineAt(editor.selection.active.line).range.end;
        // Insert a new line after the end of the current line
        const newLinePosition = new vscode.Position(endOfLine.line + 1, 0);
        // Set the current decoration range to start at the new line position and end at the same position
        currentDecorationRange = new vscode.Range(newLinePosition, newLinePosition);

        if (editor && suggestionText && currentDecorationRange) {
            console.log('inside acceptSidebarSuggestionCommand');
            if (decoration) {
                editor.setDecorations(decoration, []);
            }

            await editor.edit(editBuilder => {
                editBuilder.insert(currentDecorationRange!.start, `\n${suggestionText!}`);
            });

            completionText = undefined;
            currentDecorationRange = undefined;
            decoration = undefined;
        }

    });

    function getWebviewContent(title = '') {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.3.1/styles/default.min.css">
                <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.3.1/highlight.min.js"></script>
            </head>
            <body>
                <h1>${title}</h1>
                <pre><code id="content" data-markdown="">Your code suggestion will appear here!</code></pre>
                <button id="acceptButton">accept</button>
                <button id="closeButton">discard</button>
                <script>
                    const vscode = acquireVsCodeApi();
                    // Listen for messages from the extension

                    window.addEventListener('message', event => {
                        const message = event.data; // The JSON data sent from the extension

                        if (message.htmlContent) {
                            const contentContainer = document.getElementById('content');
                            contentContainer.innerHTML = '';
                            const tempContainer = document.createElement('div');
                            tempContainer.innerHTML =  message.htmlContent;
                            Array.from(tempContainer.childNodes).forEach(node => contentContainer.appendChild(node));
                            hljs.highlightAll();
                        }
                        if (message.content) {
                            const markdownContainer = document.getElementById('content');
                            markdownContainer.setAttribute('data-markdown', message.content);
                        }
                    });

                    // Handle button click
                    document.getElementById('acceptButton').addEventListener('click', () => {
                        // Send a message to the extension
                        const contentDiv = document.getElementById('content');
                        if (contentDiv) {
                            content = contentDiv.getAttribute('data-markdown');
                            // Optionally, send this content back to the extension
                            vscode.postMessage({
                                command: 'accept',
                                text: content
                            });
                        }
                    });
                    // Handle button click
                    document.getElementById('closeButton').addEventListener('click', () => {
                        // Send a message to the extension
                        vscode.postMessage({
                            command: 'close',
                            text: 'Suggestion discarded!'
                        });
                    });
                </script>
            </body>
            </html>
        `;
    }

    context.subscriptions.push(getSuggestionWebViewCommand, webViewPanel, getSidebar, acceptSidebarSuggestionCommand);
    return {
        acceptSidebarSuggestionCommand(suggestionText: string) {
            vscode.commands.executeCommand("code-suggestion-extension.acceptSidebarSuggestion", suggestionText);
        },
        getSidebar() {
            vscode.commands.executeCommand("code-suggestion-extension.showSidebar");
        },
    };

}

export function deactivate() { }
