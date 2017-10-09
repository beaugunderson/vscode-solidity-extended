## 3.0.1, 3.0.2

- Add `pure` and `view` function modifiers to syntax highlighting

## 3.0.0

- The extension will no longer generate `solium` warnings if a `.soliumrc.json` file does not exist in the project. Previously we generated `solium` warnings using a default configuration
- The compilation commands have been removed; they were broken and not that useful given current workflows
- `.soliumrc.json` is now re-read when it is modified instead of just re-validating all files using the old values
- The extension will now use the local `solc` if it exists in `${workspaceRoot}/node_modules`

## 2.5.1

- Restrict `solc` errors to those in the current file

## 2.5.0

- Add `solidity.solidityRoot` configuration option for resolving imports correctly within `solc`

## 2.4.2

- Add proper highlighting for `using`

## 2.4.1

- Add proper highlighting for `internal`

## 2.4.0

- Added `solidity.persistErrors` configuration option

## 2.3.0

- Added `solidity.lintOnOpen` configuration option
- Added `"solium-only"` and `"solc-only"` options for all settings

## 2.2.0

- Added `solidity.lintOnChange` and `solidity.lintOnSave` configuration options

## 2.1.2

- Add debug logging to diagnose linting slowdowns
- Update `solc` to 0.4.16
- Update other dependencies

## 2.1.1

- Normalize paths passed to `solc`

## 2.1.0

- Update `solc` to 0.4.14

## 2.0.0

- The linter now checks for a copy of Solium in `${workspaceRoot}/node_modules` and prefers that if it exists, this is useful for running a forked copy of Solium
- The linter will now only run one solium/solc validation at a time

## 1.1.0

- The linter now checks for the nearest `.soliumrc.json` file
- A source is now specified for each linter error or warning (`solc` or `solium`)
- Compiler remappings are now supported via the `solidity.compilerRemappings` setting

## 1.0.1

- Marketplace formatting improvements

## 1.0.0

- Initial release
