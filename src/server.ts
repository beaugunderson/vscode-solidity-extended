'use strict';

import * as fs from 'fs';
import * as findUp from 'find-up';
import * as path from 'path';
import * as projService from './projectService';
import * as solc from 'solc';

import {
    Diagnostic,
    DiagnosticSeverity,
    Files,
    IConnection,
    IPCMessageReader,
    IPCMessageWriter,
    InitializeResult,
    TextDocumentChangeEvent,
    TextDocuments,
    createConnection,
} from 'vscode-languageserver';

import {ContractCollection} from './model/contractsCollection';
import {errorToDiagnostic} from './compilerErrors';

const FIFTEEN_SECONDS = 15 * 1000;

let validationLocked = 0;

function now() {
    return new Date().valueOf();
}

function lockedAndLockIsValid() {
    if (validationLocked > (now() - FIFTEEN_SECONDS)) {
        return true;
    }

    return false;
}

function lockValidation() {
    validationLocked = now();
}

function unlockValidation() {
    validationLocked = 0;
}

const DEFAULT_SOLIUM_OPTIONS = {
    rules: {
        'array-declarations': true,
        'blank-lines': true,
        camelcase: true,
        'deprecated-suicide': true,
        'double-quotes': true,
        'imports-on-top': true,
        indentation: true,
        lbrace: true,
        mixedcase: true,
        'no-empty-blocks': true,
        'no-unused-vars': true,
        'no-with': true,
        'operator-whitespace': true,
        'pragma-on-top': true,
        uppercase: true,
        'variable-declarations': true,
        whitespace: true,
    },
};

// Create a connection for the server
const connection: IConnection = createConnection(
    new IPCMessageReader(process),
    new IPCMessageWriter(process));

console.log = connection.console.log.bind(connection.console);
console.error = connection.console.error.bind(connection.console);

const documents: TextDocuments = new TextDocuments();

let rootPath;
let Solium;

function itemToDiagnostic(item) {
    const severity = item.type === 'warning' ?
        DiagnosticSeverity.Warning :
        DiagnosticSeverity.Error;

    const line = item.line - 1;

    return {
        message: `${item.ruleName}: ${item.message}`,
        range: {
            end: {
                character: item.node.end,
                line: line,
            },
            start: {
                character: item.column,
                line: line,
            },
        },
        severity: severity,
        source: 'solium',
    };
}

function compilationErrors(filePath, documentText): Diagnostic[] {
    const contracts = new ContractCollection();

    try {
        contracts.addContractAndResolveImports(
            filePath,
            documentText,
            projService.initialiseProject(rootPath));

        let input = {
            language: 'Solidity',
            optimizer: {
                enabled: true,
            },
            settings: {
                outputSelection: ['metadata'],
                remappings: compilerRemappings.map(mapping => `${mapping.prefix}=${mapping.target}`),
            },
            sources: contracts.getContractsForCompilation(),
        };

        const output: string = solc.compileStandardWrapper(JSON.stringify(input), (importPath) => {
            try {
                return {
                    contents: fs.readFileSync(importPath, 'utf-8'),
                };
            } catch (err) {
                return {
                    error: `Unable to read "${importPath}": ${err}`,
                };
            }
        });

        if (output) {
            const parsedOutput = JSON.parse(output);

            if (parsedOutput.errors) {
                return parsedOutput.errors.map((error) => errorToDiagnostic(error).diagnostic);
            }
        }

        return [];
    } catch (err) {
        connection.window.showErrorMessage('solc error: ' + err);

        console.error('solc error: ' + err);
        console.error('solc error: ' + err.stack);
    }

    return [];
}

function solium(filePath, documentText): Diagnostic[] {
    const fileDirectory = path.dirname(filePath);
    const fileName = path.basename(filePath);

    let items = [];
    let soliumOptions = DEFAULT_SOLIUM_OPTIONS;

    const soliumConfigPath = findUp.sync('.soliumrc.json', {cwd: fileDirectory});

    if (soliumConfigPath) {
        soliumOptions = require(soliumConfigPath);
    }

    try {
        items = Solium.lint(documentText, soliumOptions);
    } catch (err) {
        let match = /An error .*?\nSyntaxError: (.*?) Line: (\d+), Column: (\d+)/.exec(err.message);

        if (match) {
            let line = parseInt(match[2], 10) - 1;
            let character = parseInt(match[3], 10) - 1;

            return [
                {
                    message: `Syntax error: ${match[1]}`,
                    range: {
                        end: {
                            character: character,
                            line: line,
                        },
                        start: {
                            character: character,
                            line: line,
                        },
                    },
                    severity: DiagnosticSeverity.Error,
                },
            ];
        } else {
            connection.window.showErrorMessage('solium error: ' + err);
            console.error('solium error: ' + err);
        }
    }

    return items.map(itemToDiagnostic);
}

function validate(document) {
    if (lockedAndLockIsValid()) {
        return;
    }

    lockValidation();

    const filePath = Files.uriToFilePath(document.uri);
    const documentText = document.getText();

    const soliumDiagnostics = solium(filePath, documentText);
    const solcDiagnostics = compilationErrors(filePath, documentText);

    const diagnostics = soliumDiagnostics.concat(solcDiagnostics);

    connection.sendDiagnostics({
        diagnostics,
        uri: document.uri,
    });

    unlockValidation();
}

function validateAll() {
    return documents.all().forEach(validate);
}

documents.onDidChangeContent(event => validate(event.document));

// remove diagnostics from the Problems panel when we close the file
documents.onDidClose(event => connection.sendDiagnostics({
    diagnostics: [],
    uri: event.document.uri,
}));

documents.listen(connection);

let compilerRemappings: [CompilerRemapping];

interface CompilerRemapping {
    prefix: string;
    target: string;
}

interface Settings {
    solidity: {
        remoteCompilerVersion: string,
        compilerRemappings: [CompilerRemapping],
    };
}

connection.onDidChangeWatchedFiles((params) => {
    params.changes.forEach((change) => {
        const filePath = Files.uriToFilePath(change.uri);
        const fileName = path.basename(filePath);

        if (fileName === '.soliumrc.json') {
            validateAll();
        }
    });
});

// The settings have changed. Is sent on server activation as well.
connection.onDidChangeConfiguration((params) => {
    let settings = <Settings>params.settings;

    compilerRemappings = settings.solidity.compilerRemappings;

    validateAll();
});

connection.onInitialize((result): InitializeResult => {
    rootPath = result.rootPath;

    let localSolium = path.join(rootPath, 'node_modules', 'solium', 'lib', 'solium.js');

    if (fs.existsSync(localSolium)) {
        console.log('Loading local solium');

        Solium = require(localSolium);
    } else {
        console.log('Loading global solium');

        Solium = require('solium');
    }

    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
        },
    };
});

connection.listen();
