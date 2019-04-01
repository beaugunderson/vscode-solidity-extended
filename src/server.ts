'use strict';

import * as findUp from 'find-up';
import * as fs from 'fs';
import * as moment from 'moment';
import * as path from 'path';
import {
    Diagnostic,
    DiagnosticSeverity,
    Files,
    IConnection,
    IPCMessageReader,
    IPCMessageWriter,
    InitializeResult,
    TextDocuments,
    createConnection,
} from 'vscode-languageserver';
import Uri from 'vscode-uri';

import {ContractCollection} from './contract-collection';
import {errorToDiagnostic} from './compiler-errors';

const TWO_MINUTES = 2 * 60 * 1000;

let validationLocked = 0;

let lastSolcErrors: Array<Diagnostic> = [];
let lastSoliumErrors: Array<Diagnostic> = [];

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

// Create a connection for the server
const connection: IConnection = createConnection(
    new IPCMessageReader(process),
    new IPCMessageWriter(process));

console.log = connection.console.log.bind(connection.console);
console.error = connection.console.error.bind(connection.console);

const documents: TextDocuments = new TextDocuments();

let rootPath;
let solc;
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

function arePathsIdentical(a, b) {
    const fullRoot = path.normalize(path.resolve(rootPath, soliditySettings.solidityRoot));
    const RE_ROOT_PATH = new RegExp(`^${fullRoot}/`);

    const relativeA = path.normalize(a).replace(RE_ROOT_PATH, '');
    const relativeB = path.normalize(b).replace(RE_ROOT_PATH, '');

    if (relativeA === relativeB) {
        return true;
    }
}

function compilationErrors(filePath, documentText): Diagnostic[] {
    const contracts = new ContractCollection();

    try {
        contracts.addContractAndResolveImports(filePath, documentText);

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
            let sourcePath = importPath;

            if (soliditySettings.solidityRoot) {
                sourcePath = path.resolve(rootPath, soliditySettings.solidityRoot, importPath);
            }

            try {
                return {
                    contents: fs.readFileSync(sourcePath, 'utf-8'),
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
                return parsedOutput.errors
                    .map(errorToDiagnostic)
                    .filter((error) => arePathsIdentical(error.fileName, filePath))
                    .map((error) => error.diagnostic);
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
    const soliumConfigPath = findUp.sync('.soliumrc.json', {cwd: fileDirectory});

    if (!soliumConfigPath) {
        log('Skipping solium, .soliumrc.json not found');

        return [];
    }
    if (soliumConfigPath && soliditySettings.multiProjects) {
      const projectDirectory = path.dirname(soliumConfigPath);
      const projectLocalSolium = path.join(projectDirectory, 'node_modules', 'solium', 'lib', 'solium.js');
      const projectLocalSolc = path.join(projectDirectory, 'node_modules', 'solc', 'index.js');
      if (fs.existsSync(projectLocalSolium)) {
          Solium = require(projectLocalSolium);
          solc = require(projectLocalSolc);
      }
    }

    log(`Using "${soliumConfigPath}"`);

    let soliumOptions;

    try {
        soliumOptions = JSON.parse(fs.readFileSync(soliumConfigPath, 'utf8'));
    } catch (err) {
        return [
            {
                message: `Unable to parse .soliumrc.json: ${err.message}`,
                range: {
                    end: {
                        character: 0,
                        line: 0,
                    },
                    start: {
                        character: 0,
                        line: 0,
                    },
                },
            },
        ];
    }

    try {
        return Solium.lint(documentText, soliumOptions).map(itemToDiagnostic);
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
}

function validate(document, validators: LinterChoice = true) {
    if (lockedAndLockIsValid()) {
        log('skipping validation');

        return;
    }

    lockValidation();

    const name = uriToBasename(document.uri);
    const filePath = Files.uriToFilePath(document.uri);
    const documentText = document.getText();

    let diagnostics = [];

    if (validators === true || validators === 'solium-only') {
        const soliumStart = moment();
        lastSoliumErrors = solium(filePath, documentText);
        diagnostics = diagnostics.concat(lastSoliumErrors);
        const soliumEnd = moment();

        log(`validating ${name}, solium done in ${soliumEnd.diff(soliumStart, 'seconds')}s`);
    } else if (soliditySettings.persistErrors) {
        diagnostics = diagnostics.concat(lastSoliumErrors);
    }

    if (validators === true || validators === 'solc-only') {
        const solcStart = moment();
        lastSolcErrors = compilationErrors(filePath, documentText);
        diagnostics = diagnostics.concat(lastSolcErrors);
        const solcEnd = moment();

        log(`validating ${name}, solc done in ${solcEnd.diff(solcStart, 'seconds')}s`);
    } else if (soliditySettings.persistErrors) {
        diagnostics = diagnostics.concat(lastSolcErrors);
    }

    connection.sendDiagnostics({
        diagnostics,
        uri: document.uri,
    });

    unlockValidation();
}

function validateAll() {
    log('validateAll');

    return documents.all().forEach((document) => validate(document));
}

documents.onDidOpen(event => {
    log(`document opened: ${uriToBasename(event.document.uri)}`);

    if (!soliditySettings.lintOnOpen) {
        return;
    }

    validate(event.document, soliditySettings.lintOnOpen);
});

documents.onDidSave(event => {
    log(`document saved: ${uriToBasename(event.document.uri)}`);

    if (!soliditySettings.lintOnSave) {
        return;
    }

    validate(event.document, soliditySettings.lintOnSave);
});

documents.onDidChangeContent(event => {
    log(`document changed: ${uriToBasename(event.document.uri)}`);

    if (!soliditySettings.lintOnChange) {
        return;
    }

    validate(event.document, soliditySettings.lintOnChange);
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

type LinterChoice = true | false | 'solc-only' | 'solium-only';

interface SoliditySettings {
    compilerRemappings: [CompilerRemapping];
    lintOnChange: LinterChoice;
    lintOnOpen: LinterChoice;
    lintOnSave: LinterChoice;
    persistErrors: boolean;
    remoteCompilerVersion: string;
    solidityRoot: string;
    multiProjects: boolean;
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
    rootPath = Uri.parse(result.rootUri).fsPath;

    const localSolium = path.join(rootPath, 'node_modules', 'solium', 'lib', 'solium.js');
    const localSolc = path.join(rootPath, 'node_modules', 'solc', 'index.js');

    if (fs.existsSync(localSolium)) {
        log('loading local solium');

        Solium = require(localSolium);
    } else {
        log('loading global solium');

        Solium = require('solium');
    }

    if (fs.existsSync(localSolc)) {
        log('loading local solc');

        solc = require(localSolc);
    } else {
        log('loading global solc');

        solc = require('solc');
    }

    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
        },
    };
});

connection.listen();
