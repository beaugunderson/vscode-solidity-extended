'use strict';

import * as path from 'path';
import {compileAllContracts} from './compileAll';
import {compileActiveContract, initDiagnosticCollection} from './compileActive';
import {DiagnosticCollection, ExtensionContext, commands, languages, workspace} from 'vscode';
import {LanguageClient, LanguageClientOptions, ServerOptions, TransportKind} from 'vscode-languageclient';

let diagnosticCollection: DiagnosticCollection;

export function activate(context: ExtensionContext) {
    const serverModule = path.join(__dirname, 'server.js');

    const serverOptions: ServerOptions = {
        debug: {
            module: serverModule,
            options: {
                execArgv: ['--nolazy', '--debug=6004'],
            },
            transport: TransportKind.ipc,
        },
        run: {
            module: serverModule,
            transport: TransportKind.ipc,
        },
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: ['solidity'],
        synchronize: {
            configurationSection: 'solidity',
            fileEvents: workspace.createFileSystemWatcher('**/.soliumrc.json'),
        },
    };

    const client = new LanguageClient(
        'solidity',
        'Solidity Language Server',
        serverOptions,
        clientOptions);

    diagnosticCollection = languages.createDiagnosticCollection('solidity');

    context.subscriptions.push(diagnosticCollection);

    initDiagnosticCollection(diagnosticCollection);

    context.subscriptions.push(
        client.start(),

        commands.registerCommand('solidity.compile.active', () => {
            compileActiveContract();
        }),

        commands.registerCommand('solidity.compile', () => {
            compileAllContracts(diagnosticCollection);
        }));
}
