# LocalAI Suggestions - VS Code Extension

The **LocalAI Suggestions** extension provides an AI-powered code completion and suggestion tool designed for seamless integration with local AI models. This extension offers an enhanced coding experience with quick suggestions, code snippets, and a webview for additional AI-driven insights.

---

## Features

- **AI-Powered Code Completion**: Quickly complete your code with the help of a local AI API.
- **Command-Driven Suggestions**: Easily accept, cancel, or trigger suggestions using predefined commands and keybindings.
- **Customizable Prompts**: Define your AI model, prompt, and other parameters through user settings.
- **Webview Integration**: View suggestions in a dedicated sidebar or webview for an enhanced visual experience.

---

## Keybindings and Commands

Here’s a list of the available commands and their default keybindings:

| Command                            | Keybinding         | Description                               | When Active                    |
|------------------------------------|--------------------|-------------------------------------------|---------------------------------|
| **Accept Suggestion**              | `Tab`              | Accept the current suggestion.            | When a suggestion is visible.  |
| **Cancel Suggestion**              | `Escape`           | Cancel the current suggestion.            | When a suggestion is visible.  |
| **Trigger Suggestion**             | `Ctrl+Space`       | Get a new suggestion.                     | When editor is focused.        |
| **Trigger Webview Suggestion**     | `Ctrl+Enter`       | Get suggestions for the webview.          | When editor is focused.        |
| **Open Suggestions Sidebar**       | `Ctrl+U`           | Open the sidebar to view suggestions.     | When editor is focused.        |

You can customize these keybindings in your VS Code settings.

---

## Configuration

To configure the extension, update the following settings in your VS Code `settings.json` file:

| Setting                              | Default Value                                    | Description                                                      |
|--------------------------------------|--------------------------------------------------|------------------------------------------------------------------|
| `codeSuggestionExtension.endpoint`   | `http://localhost:8100/v1/completions`          | The LocalAI API endpoint for completions.                       |
| `codeSuggestionExtension.endpointchat` | `http://localhost:8100/v1/chat/completions`    | The LocalAI API endpoint for chat-based completions.            |
| `codeSuggestionExtension.prompt`     | `Complete the following code:`                  | The prompt used by the AI model.                                |
| `codeSuggestionExtension.model`      | `gpt-4`                                         | The AI model used for suggestions.                              |
| `codeSuggestionExtension.max_tokens` | `1024`                                          | The maximum number of tokens for the AI response.               |
| `codeSuggestionExtension.as_chat`    | `true`                                          | Whether to use chat-based completions.                          |
| `codeSuggestionExtension.assistant_message` | See below for default.                      | The assistant's message for generating responses.               |
| `codeSuggestionExtension.temperature` | `0.7`                                          | The randomness level of the AI's responses.                     |

### **Default Assistant Message**
```plaintext
You are a Laravel expert. When asked a question, respond with only the necessary code snippet in plain text, suitable for direct use in a Laravel application. Avoid including PHP tags (<?php, ?>), backticks for Markdown, or any other syntax like escaped PHP tags. Do not include explanations, comments, or any additional text. Your response should only contain the code content required for the user's query.
```

## Installation
To install the extension, follow these steps:

1. Get the extension from GitHub:
   - Download the repository: https://github.com/miloskec/vscode-custom-ai-suggestions-extension
   - Alternatively, clone the repository: `git clone git@github.com:miloskec/vscode-custom-ai-suggestions-extension.git`

2. Install the extension:
   - Install dependencies: `npm install`
   - Run the compiler: `npm run compile`

## Usage
Once installed, you can use the extension by

## Contributing
To contribute to the extension, follow these steps:

1. Fork the repository.
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Feature: Your feature description'`
4. Push to the branch: `git push origin feature/your-feature`
5. Submit a pull request.

## License
This extension is licensed under the MIT License. See the LICENSE file

## Installation 
### If you dont have vsce file you can create it
npm install -g vsce
vsce package

Once you have the .vsix file, you can install it in VS Code:

Open VS Code.
Press Ctrl+Shift+P (or Cmd+Shift+P on macOS) to open the command palette.
Search for and select Extensions: Install from VSIX....
Browse to the .vsix file you created and select it.


