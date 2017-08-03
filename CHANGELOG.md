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
