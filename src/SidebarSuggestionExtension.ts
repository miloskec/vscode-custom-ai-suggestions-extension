import * as vscode from 'vscode';
import { BaseExtension } from './BaseExtension';
import { SuggestionSidebarProvider } from './SidebarProvider';

export class SidebarSuggestionExtension extends BaseExtension {
    protected suggestionProvider: SuggestionSidebarProvider;

    constructor(context: vscode.ExtensionContext) {
        super(context); // Call the constructor of BaseExtension
        this.suggestionProvider = new SuggestionSidebarProvider(context, this);
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(SuggestionSidebarProvider.viewType, this.suggestionProvider)
        );
        this.registerCommands();
    }
    // Register commands specific to this extension
    private registerCommands() {    // Register commands
        this.context.subscriptions.push(
            vscode.commands.registerCommand('code-suggestion-extension.showSidebar', this.getSidebar.bind(this)),
            vscode.commands.registerCommand('code-suggestion-extension.acceptSidebarSuggestion', (suggestion: string | null) => this.acceptSidebarSuggestionCommand(suggestion))
        );
    }

    public async getSidebar() {
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
        vscode.commands.executeCommand('workbench.view.extension.suggestionSidebarContainer');
        this.suggestionProvider.sendMessage({ type: 'update', suggestion: this.completionText });
    }

    public async acceptSidebarSuggestionCommand(suggestion: string | null = null) {
        if(suggestion)
            this.completionText = suggestion;
        
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

    public getUnescapedHtml(input: string): string {
        return this.unescapeHtml(input); // Access the protected method
    }
    public getEscapeHtml(input: string): string {
        return this.escapeHtml(input); // Access the protected method
    }
    public getStripMarkdown(input: string): string {
        return this.stripMarkdown(input); // Access the protected method
    }
    public getPublicWebviewContent(title: string): string {
        return this.getWebviewContent(title, true);
    }
}