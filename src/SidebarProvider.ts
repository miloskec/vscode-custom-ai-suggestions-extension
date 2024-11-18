import * as vscode from 'vscode';
import * as marked from 'marked';
import { SidebarSuggestionExtension } from './SidebarSuggestionExtension';

export class SuggestionSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'suggestionSidebarView';

    private _view?: vscode.WebviewView;
    private _suggestionText: string | undefined;
    private _htmlSuggestion: string | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly baseExtension: SidebarSuggestionExtension
    ) { }

    public async sendMessage(message: any) {
        let content = message.suggestion;
        if (content) {
            let htmlContent = this.baseExtension.getEscapeHtml(content);
            htmlContent = await marked.parse(htmlContent);
            htmlContent.replace(/'/g, "\\'");
            
            content = this.baseExtension.getStripMarkdown(content);
            content.replace(/'/g, "\\'");
            
            await this.setSuggestion(content);
            message = {
                ...message,
                suggestions: content,
                htmlSuggestion: htmlContent
            }
        }
        if (this._view) {
            this._view.webview.postMessage(message);
        }
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
        webviewView.webview.html = this.baseExtension.getPublicWebviewContent('Suggestions...');

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
            let unescapeHtml = this.baseExtension.getUnescapedHtml(this._suggestionText);
            unescapeHtml = unescapeHtml.replace(/->/g, "->");
            vscode.commands.executeCommand(
                'code-suggestion-extension.acceptSidebarSuggestion',
                unescapeHtml
            );
        }
    }

    private clearSuggestion() {
        this._suggestionText = undefined;
        if (this._view) {
            this.sendMessage({ type: 'clear' });
        }
    }
}