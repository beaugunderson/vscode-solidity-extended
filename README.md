# Solidity support for Visual Studio code

Solidity is the language used in Ethereum to create smart contracts.

This extension provides: 

* Syntax highlighting
* Snippets
* Compilation of the current contract (Press F1 Solidity : Compile Current
  Solidity Contract), or F5
* Compilation of all the contracts (Press F1 Solidity : Compile all Solidity
  Contracts), or Ctrl+F5 / Cmd+F5
* Compilation supporting EIP82 (dappfile and dependency packages)
* Support for different solidity versions

To compile using a different version of Solidity, for example latest or
'v0.4.3+commit.2353da71', use the user settings as follows:

```
"solidity.compileUsingRemoteVersion" : "latest"
```

# Credits

Many thanks to [Juan Blanco](https://github.com/juanfranblanco), this extension
is forked from his
[vscode-solidity](https://github.com/juanfranblanco/vscode-solidity) extension.
