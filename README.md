# Solidity Extended

Solidity support that aims to enable all of Visual Studio Code's features.

Solidity is the language used in Ethereum to create smart contracts.

This extension provides:

* Fast linting with `solium` and `solc`
* Snippets
* Support for using a workspace-local version of solc
* Support for using a workspace-local version of solium
* Syntax highlighting

## Configuration

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
