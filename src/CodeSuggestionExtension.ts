import * as vscode from 'vscode';
import { BaseExtension } from './BaseExtension';
import { KeyBinding } from './types'; // Adjust the path based on your project structure

export class CodeSuggestionExtension extends BaseExtension {

    constructor(context: vscode.ExtensionContext) {
        super(context); // Call the constructor of BaseExtension
        this.registerCommands();
    }
    // Register commands specific to this extension
    private registerCommands() {    // Register commands
        this.context.subscriptions.push(
            vscode.commands.registerCommand('code-suggestion-extension.getSuggestion', this.getSuggestionCommand.bind(this)),
            vscode.commands.registerCommand('code-suggestion-extension.cancelSuggestion', this.cancelSuggestionCommand.bind(this)),
            vscode.commands.registerCommand('code-suggestion-extension.acceptSuggestion', this.acceptSuggestionCommand.bind(this))
        );
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

        this.params.completePrompt = `${this.params.prompt}${selectedText}`;

        const suggestion = await this.fetchTextResponse(this.params);
        this.completionRaw = suggestion;
        this.completionText = suggestion.trim();

        if (!this.completionText) {
            vscode.window.showInformationMessage('No suggestion available.');
            return;
        }
        
        if (this.decoration) {
            editor.setDecorations(this.decoration, []);
        }

        this.decoration = vscode.window.createTextEditorDecorationType({
            opacity: '0.5',
            fontStyle: 'italic',
            color: 'gray'
        });

        const lines = this.completionText.split('\n');

        let lineRange;
        let decorationOptions = [];
        
        const lineStartPosition = new vscode.Position(selection.start.line + 1, 0);
        const lineEndPosition = new vscode.Position(lineStartPosition.line, lines[0].length);
        
        lineRange = new vscode.Range(lineStartPosition, lineEndPosition);
        
        decorationOptions.push({
            range: lineRange,
            hoverMessage: this.completionRaw,
            renderOptions: {
                after: {
                    contentText: lines.join(' '),
                    color: 'gray'
                }
            }
        });
        editor.setDecorations(this.decoration, decorationOptions);
        //prepare for Editor insertion
        this.completionText = this.stripMarkdown(this.completionText);
        console.log('after stripMarkdown');
        console.log(this.completionText);
        await vscode.commands.executeCommand("setContext", "suggestionVisible", true);
    }
    public async acceptSuggestionCommand() {
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
                editBuilder.insert(this.currentDecorationRange!.start, `\n${this.completionText!}\n`);
            });

            this.completionText = undefined;
            this.currentDecorationRange = undefined;
            this.decoration = undefined;

            await vscode.commands.executeCommand("setContext", "suggestionVisible", false);
        }
    }
    private cancelSuggestionCommand() {
        const editor = this.getActiveEditor();
        if (editor && this.decoration) {
            editor.setDecorations(this.decoration, []);
            this.completionText = undefined;
            this.completionRaw = undefined;
            this.currentDecorationRange = undefined;
            this.decoration = undefined;

            vscode.commands.executeCommand('setContext', 'suggestionVisible', false);
        }
    }
}