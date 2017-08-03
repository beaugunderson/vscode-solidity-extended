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

* <kbd>F1</kbd> `>Solidity: Compile Current Solidity Contract`
* <kbd>F5</kbd>

### Compile all contracts

* <kbd>F1</kbd> `>Solidity: Compile all Solidity Contracts`
* <kbd>Ctrl</kbd> + <kbd>F5</kbd> / <kbd>Cmd</kbd> + <kbd>F5</kbd>

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

## Credits

Many thanks to [Juan Blanco](https://github.com/juanfranblanco), this extension is forked from his original [vscode-solidity](https://github.com/juanfranblanco/vscode-solidity) extension.
