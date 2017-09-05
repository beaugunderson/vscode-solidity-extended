'use strict';

import * as findUp from 'find-up';
import * as fs from 'fs';
import * as moment from 'moment';
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
import Uri from 'vscode-uri';

import {ContractCollection} from './model/contractsCollection';
import {errorToDiagnostic} from './compilerErrors';

const TWO_MINUTES = 2 * 60 * 1000;

let validationLocked = 0;

function uriToBasename(uri: string) {
    return path.basename(Uri.parse(uri).fsPath);
}

function now() {
    return new Date().valueOf();
}

function timestamp() {
    return moment().format('HH:mm:ss.SS');
}

function log(string) {
    console.log(`${timestamp()} ${string}`);
}

function lockedAndLockIsValid() {
    if (validationLocked > (now() - TWO_MINUTES)) {
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
                remappings: soliditySettings.compilerRemappings.map(mapping =>
                    `${mapping.prefix}=${path.resolve(mapping.target).replace(/\\/g, '\/')}`),
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
    const start = moment();

    if (lockedAndLockIsValid()) {
        log('skipping validation');

        return;
    }

    lockValidation();

    const name = uriToBasename(document.uri);

    log(`validating ${name}`);

    const filePath = Files.uriToFilePath(document.uri);
    const documentText = document.getText();

    const soliumStart = moment();
    const soliumDiagnostics = solium(filePath, documentText);
    const soliumEnd = moment();

    const solcStart = moment();
    const solcDiagnostics = compilationErrors(filePath, documentText);
    const solcEnd = moment();

    const diagnostics = soliumDiagnostics.concat(solcDiagnostics);

    connection.sendDiagnostics({
        diagnostics,
        uri: document.uri,
    });

    unlockValidation();

    log(`validating ${name} done in ${moment().diff(start, 'seconds')}s ` +
        `(solium: ${soliumEnd.diff(soliumStart, 'seconds')}s, solc: ${solcEnd.diff(solcStart, 'seconds')}s)`);
}

function validateAll() {
    log('validateAll');

    return documents.all().forEach(validate);
}

documents.onDidSave(event => {
    log(`document saved: ${uriToBasename(event.document.uri)}`);

    if (soliditySettings.lintOnSave) {
        validate(event.document);
    }
});

documents.onDidChangeContent(event => {
    log(`document changed: ${uriToBasename(event.document.uri)}`);

    if (soliditySettings.lintOnChange) {
        validate(event.document);
    }
});

// remove diagnostics from the Problems panel when we close the file
documents.onDidClose(event => connection.sendDiagnostics({
    diagnostics: [],
    uri: event.document.uri,
}));

documents.listen(connection);

interface CompilerRemapping {
    prefix: string;
    target: string;
}

interface SoliditySettings {
    compilerRemappings: [CompilerRemapping];
    lintOnChange: boolean;
    lintOnSave: boolean;
    remoteCompilerVersion: string;
}

let soliditySettings: SoliditySettings;

connection.onDidChangeWatchedFiles(params => {
    params.changes.forEach(change => {
        if (uriToBasename(change.uri) === '.soliumrc.json') {
            validateAll();
        }
    });
});

// The settings have changed. Is sent on server activation as well.
connection.onDidChangeConfiguration(params => {
    log('onDidChangeConfiguration');

    soliditySettings = <SoliditySettings>params.settings.solidity;

    validateAll();
});

connection.onInitialize((result): InitializeResult => {
    rootPath = result.rootPath;

    let localSolium = path.join(rootPath, 'node_modules', 'solium', 'lib', 'solium.js');

    if (fs.existsSync(localSolium)) {
        log('loading local solium');

        Solium = require(localSolium);
    } else {
        log('loading global solium');

        Solium = require('solium');
    }

    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
        },
    };
});

connection.listen();
