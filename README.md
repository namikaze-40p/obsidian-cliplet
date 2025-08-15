# Obsidian Cliplet

This is an [Obsidian](https://obsidian.md/) plugin that combines a dedicated clipboard with a snippet feature, allowing you to efficiently manage frequently used text and snippets and retrieve them instantly when needed.

## Concept

Cliplet provides both a dedicated clipboard and a snippet manager inside Obsidian. Its storage is fully independent from the OS clipboard, allowing you to store and reuse text, code, and other snippets without disrupting your workflow.

## Storage Options

Cliplet supports two storage methods. With a maximum of 200 items and encryption at rest, performance is comparable in most cases—choose based on portability and backup preferences.

- **IndexedDB** – Stored in Obsidian’s internal browser database **per vault and per device**. This allows you to keep different cliplet data on different devices or vaults, making it useful for separating work and personal content or desktop and mobile usage.
- **data.json** – Stored as a JSON file inside your vault. Easy to locate and manage, and included in your vault backups, sync, and version control.

Both options work entirely offline and keep your data private (content is encrypted at rest).

| Storage type | Advantages | Disadvantages |
|--------------|------------|---------------|
| **IndexedDB** | Per-device and per-vault isolation enables different data sets for different contexts. | Does not sync between devices; data stays local unless you manually export/move it. |
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

![demo](https://raw.githubusercontent.com/namikaze-40p/obsidian-cliplet/main/demo/cliplet.gif)

## Installation

You can find and install this plugin through Obsidian’s Community Plugins Browser.  
For detailed steps or alternative installation methods, click [here](https://github.com/namikaze-40p/obsidian-cliplet/blob/main/docs/installation.md).
