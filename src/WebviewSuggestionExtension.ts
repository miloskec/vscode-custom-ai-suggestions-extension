import * as vscode from 'vscode';
import { BaseExtension } from './BaseExtension';
import * as marked from 'marked';

export class WebviewSuggestionExtension extends BaseExtension {
    constructor(context: vscode.ExtensionContext) {
        super(context); // Call the constructor of BaseExtension
        this.registerCommands();
    }
    // Register commands specific to this extension
    private registerCommands() {    // Register commands
        this.context.subscriptions.push(
            vscode.commands.registerCommand('code-suggestion-extension.showWebView', this.webViewPanel.bind(this)),
            vscode.commands.registerCommand('code-suggestion-extension.getWebViewSuggestion', this.getSuggestionWebViewCommand.bind(this))
        );
    }

    private async webViewPanel(title: string, content: string) {
        const editor = this.getActiveEditor();
        if (!editor) {
            return;
        }

        // Get the position of the end of the current line
        const endOfLine = editor.document.lineAt(editor.selection.active.line).range.end;
        // Insert a new line after the end of the current line
        const newLinePosition = new vscode.Position(endOfLine.line + 1, 0);
        // Set the current decoration range to start at the new line position and end at the same position
        this.currentDecorationRange = new vscode.Range(newLinePosition, newLinePosition);

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
        panel.webview.html = this.getWebviewContent(title, false);
        // escape tags like <?php etc...
        let htmlContent = this.escapeHtml(content);
        // Convert the Markdown content to HTML using marked
        htmlContent = await marked.parse(htmlContent);
        // Send `content` to the webview after the panel is created
        panel.webview.postMessage({ suggestion: content, htmlSuggestion: htmlContent });
        //prepare for insertion
        this.completionText = this.stripMarkdown(content);
        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'accept':
                        panel.dispose(); // This will close the webview
                        if (editor) {
                            await vscode.window.showTextDocument(editor.document, editor.viewColumn);
                        }
                        this.acceptWebviewContentCommand();
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
            this.context.subscriptions
        );
    }

    private async getSuggestionWebViewCommand() {
        try {
            const editor = this.getActiveEditor();
            if (!editor) {
                return;
            }

            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            if (!selectedText) {
                vscode.window.showInformationMessage('Please select code to get a suggestion.');
                return;
            }

            this.params.completePrompt = `${this.params.prompt}${selectedText}`;

            const suggestion = await this.fetchTextResponse(this.params);
            this.completionRaw = suggestion;
            this.completionText = suggestion.trim();

            if (!this.completionText) {
                vscode.window.showInformationMessage('No suggestion available.');
                return;
            }
            await this.webViewPanel("Suggestions...", this.completionText);
        } catch (error) {
            vscode.window.showErrorMessage(`Error fetching suggestion: ${error}`);
        }
    }

    public async acceptWebviewContentCommand() {
        const editor = this.getActiveEditor();
        if (!editor) {
            return;
        }
        // Get the position of the end of the current line
        const endOfLine = editor.document.lineAt(editor.selection.active.line).range.end;
        // Insert a new line after the end of the current line
        const newLinePosition = new vscode.Position(endOfLine.line + 1, 0);
        // Set the current decoration range to start at the new line position and end at the same position
        this.currentDecorationRange = new vscode.Range(newLinePosition, newLinePosition);

        if (editor && this.completionText && this.currentDecorationRange) {
            if (this.decoration) {
                editor.setDecorations(this.decoration, []);
            }

            await editor.edit(editBuilder => {
                editBuilder.insert(this.currentDecorationRange!.start, `\n${this.completionText!}`);
            });

            this.completionText = undefined;
            this.currentDecorationRange = undefined;
            this.decoration = undefined;
        }
    }
}