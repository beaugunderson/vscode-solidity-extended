# Solidity Extended

Solidity support that aims to enable all of Visual Studio Code's features.

Solidity is the language used in Ethereum to create smart contracts.

This extension provides:

* Syntax highlighting
* Snippets
* Compilation supporting EIP82 (dappfile and dependency packages)
* Support for different solidity versions
* Fast linting with `solium` and `solc`

## Commands

### Compile the current contract

- <kbd>F1</kbd> `>Solidity: Compile Current Solidity Contract`
- <kbd>F5</kbd>

### Compile all contracts

- <kbd>F1</kbd> `>Solidity: Compile all Solidity Contracts`
- <kbd>Ctrl</kbd> + <kbd>F5</kbd> / <kbd>⌘</kbd> + <kbd>F5</kbd>

## Configuration

### compileUsingRemoteVersion

To compile using a different version of Solidity, for example latest or 'v0.4.3+commit.2353da71', use the user settings as follows:

```
{
    "solidity.compileUsingRemoteVersion" : "latest"
}
```

### compilerRemappings

Compiler remappings can be specified as an array of objects with a `prefix` and `target` property.

```
{
    "solidity.compilerRemappings": [{"prefix": "ROOT", "target": "./src"}]
}
```

### persistErrors

Persist errors for a linter if it's not run during the next validation event. For example, if there are `solium` errors and `lintOnSave` is set to `"solc-only"`, only `solc` will run. If `persistErrors` is set to `true`, the `solium` errors will remain. If it is set to `false`, they will be cleared.

```
{
    "solidity.persistErrors": true
}
```

### Common settings for linter options

The follow three options take these values:

- `true` (execute all linters)
- `false` (execute no linters)
- `"solc-only"` (only execute solc)
- `"solium-only"` (only execute solium)

### lintOnChange

Lint open files when they're changed, regardless of whether they've been saved. It may be useful to set this to false if the contracts you're working on take a long time to compile.

```
{
    "solidity.lintOnChange": true
}
```

### lintOnSave

Lint open files when they're saved.

```
{
    "solidity.lintOnSave": true
}
```

### lintOnOpen

Lint files immediately upon opening.

```
{
    "solidity.lintOnOpen": true
}
```

## Credits

Many thanks to [Juan Blanco](https://github.com/juanfranblanco), this extension is forked from his original [vscode-solidity](https://github.com/juanfranblanco/vscode-solidity) extension.
