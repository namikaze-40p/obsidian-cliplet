# Obsidian Cliplet

This is an [Obsidian](https://obsidian.md/) plugin that a clipboard and snippet manager — your own, separate from the OS clipboard.

## Concept

Cliplet is designed to keep your snippets always at hand inside Obsidian. With its separate clipboard, you can capture ideas, reuse text or code, and speed up your writing—without ever overwriting your system clipboard.

Cliplet also provides a Cliplet history inside Obsidian. With the data.json option, your snippets stay with your vault and sync across devices.

## Why Cliplet?

- Keep multiple snippets without overwriting your system clipboard.
- Keep work and personal snippets separate from your OS clipboard.
- Mobile-friendly: browse and paste snippets where clipboard managers are limited.

![demo](https://raw.githubusercontent.com/namikaze-40p/obsidian-cliplet/main/demo/diff-to-os.gif)

## Storage Options

Cliplet supports two storage methods. With a maximum of 200 items and encryption at rest, performance is comparable in most cases—choose based on portability and backup preferences.

- **IndexedDB** – Stored in Obsidian’s internal browser database **per vault and per device**. This allows you to keep different cliplet data on different devices or vaults, making it useful for separating work and personal content or desktop and mobile usage.
- **data.json** – Stored as a JSON file inside your vault. Easy to locate and manage, and included in your vault backups, sync, and version control.

Both options work entirely offline and keep your data private (content is encrypted at rest).

| Storage type  | Advantages                                                                                                       | Disadvantages                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **IndexedDB** | Per-device and per-vault isolation enables different data sets for different contexts.                           | Does not sync between devices; data stays local unless you manually export/move it.       |
| **data.json** | Easy to locate and manage. Included in vault backups, sync solutions, and Git history. Portable between devices. | Storing many large cliplets can increase file size, which may slow loading or sync times. |

> [!NOTE]
>
> - **Encryption**: Cliplet encrypts stored content. While this prevents casual access, it is open-source software—someone with sufficient knowledge and access could theoretically decrypt the data.
> - **data.json storage caution**: This applies only when using the `data.json` storage option. If your vault is stored on the internet (e.g., in a public GitHub repository or shared cloud folder), avoid making `data.json` publicly accessible. Even though its contents are encrypted, publishing it may still expose sensitive information to potential decryption attempts.
> - **Device behavior**: IndexedDB is per device and per vault; `data.json` travels with your vault (Obsidian Sync/Dropbox/Git, etc.).
> - **Switching**: You can change the storage method in settings. A built-in migration moves all items to the selected storage and deletes them from the previous one.

## How to use

For the best experience, assign hotkeys to Cliplet commands in Obsidian’s settings.  
This allows you to add, paste, and search cliplets quickly without leaving the keyboard.

1. Add a cliplet: Run the “Add cliplet” command after selecting text.
1. Paste the latest cliplet: Run the “Paste latest cliplet” command.
1. Search cliplets: Run the “Search cliplet” command to find, then paste or edit the desired cliplet.

![demo](https://raw.githubusercontent.com/namikaze-40p/obsidian-cliplet/main/demo/add-and-paste.gif)

![demo](https://raw.githubusercontent.com/namikaze-40p/obsidian-cliplet/main/demo/search.gif)

## Installation

You can find and install this plugin through Obsidian’s Community Plugins Browser.  
For detailed steps or alternative installation methods, click [here](https://github.com/namikaze-40p/obsidian-cliplet/blob/main/docs/installation.md).
