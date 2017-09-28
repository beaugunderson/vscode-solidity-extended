'use strict';

import * as path from 'path';
import {ExtensionContext, workspace} from 'vscode';
import {LanguageClient, LanguageClientOptions, ServerOptions, TransportKind} from 'vscode-languageclient';

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

    context.subscriptions.push(client.start());
}
