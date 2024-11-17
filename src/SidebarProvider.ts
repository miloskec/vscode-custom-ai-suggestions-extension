import * as vscode from 'vscode';
import * as marked from 'marked';

export class SuggestionSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'suggestionSidebarView';

    private _view?: vscode.WebviewView;
    private _suggestionText: string | undefined;
    private _htmlSuggestion: string | undefined;

    constructor(private readonly context: vscode.ExtensionContext) { }

    public async sendMessage(message: any) {
        let content = message.suggestion;
        if (content) {
            let htmlContent = this.escapeHtml(content);
            htmlContent = await marked.parse(htmlContent);
            console.log('before');
            console.log(content);
            content = this.stripMarkdown(content);
            console.log('after');
            console.log(content);
            await this.setSuggestion(content);
            message = {
                ...message,
                suggestions: content,
                htmlSuggestion: htmlContent
            }
        }
        console.log(message);
        if (this._view) {
            console.log(message);
            this._view.webview.postMessage(message);
        }
    }

    private unescapeHtml(content: string): string {
        return content
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&amp;/g, "&");
    }

    private escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&(?!gt;|lt;|amp;)/g, "&amp;") // Escapes & unless part of &gt;, &lt;, or &amp;
            .replace(/(?<!-|=|'|' |"|" | )</g, "&lt;")
            .replace(/(?<!-|=|' |'|" |"| |<)>/g, "&gt;"); // Escapes > unless preceded by -
    }

    private stripMarkdown(content: string): string {
        return content.replace(/```[a-z]*|```|__|[*#`~]/gi, '').trim();
        //return content.replace(/(?:__|[*#`~\-]|(?:\[\^?.*?\]\(.*?\)))/g, '').trim();
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext<unknown>,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        // Configure webview options
        webviewView.webview.options = {
            enableScripts: true,
        };

        // Set initial HTML content
        webviewView.webview.html = this.getWebviewContent('Suggestions...');

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'accept':
                    await this.insertSuggestion();
                    this.clearSuggestion();
                    break;
                case 'refresh':
                    this.context.extension.exports.getSidebar();
                    this.clearSuggestion();
                    break;
            }
        });

        // Handle messages from the extension
        this.sendMessage({ type: 'init', suggestion: this._suggestionText, htmlSuggestion: this._htmlSuggestion });
    }

    // Method to update the suggestion text in the sidebar
    public setSuggestion(suggestion: string) {
        this._suggestionText = suggestion;
    }

    private async insertSuggestion() {
        if (this._suggestionText) {
            let unescapeHtml = this.unescapeHtml(this._suggestionText);
            unescapeHtml = unescapeHtml.replace(/->/g, "->");
            this.context.extension.exports.acceptSidebarSuggestionCommand(unescapeHtml);
        }
    }

    private clearSuggestion() {
        this._suggestionText = undefined;
        if (this._view) {
            this.sendMessage({ type: 'clear' });
        }
    }

    private getWebviewContent(title: string): string {
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
                <button id="refreshButton" class="vscode-button">refresh</button>
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    window.addEventListener('message', event => {
                        const message = event.data; // The JSON data sent from the extension
                        console.log(message);
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