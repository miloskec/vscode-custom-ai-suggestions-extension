import * as vscode from 'vscode';
import { CodeSuggestionExtension } from './CodeSuggestionExtension';
import { SidebarSuggestionExtension } from './SidebarSuggestionExtension';
import { WebviewSuggestionExtension } from './WebviewSuggestionExtension';

export function activate(context: vscode.ExtensionContext) {
    
    const codeSuggestion = new CodeSuggestionExtension(context);
    const sidebarSuggestionExt = new SidebarSuggestionExtension(context);
    const webviewSuggestionExtension = new WebviewSuggestionExtension(context);
    
    return {
        getSidebar: () => sidebarSuggestionExt.getSidebar(),
        acceptSidebarSuggestionCommand: () => sidebarSuggestionExt.acceptSidebarSuggestionCommand(),
        acceptSuggestionCommand: () => codeSuggestion.acceptSuggestionCommand()
    };
}

export function deactivate() { }
