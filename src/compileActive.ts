'use strict';

import * as path from 'path';
import * as projService from './projectService';
import * as util from './util';
import * as vscode from 'vscode';

import {compile} from './compiler';
import {ContractCollection} from './model/contractsCollection';

let diagnosticCollection: vscode.DiagnosticCollection;

export function initDiagnosticCollection(diagnostics: vscode.DiagnosticCollection) {
    diagnosticCollection = diagnostics;
}

export function compileActiveContract() {
    let editor = vscode.window.activeTextEditor;

    // We need something open
    if (!editor) {
        return;
    }

    if (path.extname(editor.document.fileName) !== '.sol') {
        vscode.window.showWarningMessage('This not a solidity file (*.sol)');

        return;
    }

    // Check if is folder, if not stop we need to output to a bin folder on rootPath
    if (vscode.workspace.rootPath === undefined) {
        vscode.window.showWarningMessage('Please open a folder in Visual Studio Code as a workspace');

        return;
    }

    const contractsCollection = new ContractCollection();
    const contractCode = editor.document.getText();
    const contractPath = editor.document.fileName;
    const project = projService.initialiseProject(vscode.workspace.rootPath);
    const contract = contractsCollection.addContractAndResolveImports(contractPath, contractCode, project);
    const packagesPath = util.formatPath(project.packagesDir);

    compile(contractsCollection.getContractsForCompilation(),
            diagnosticCollection,
            project.projectPackage.build_dir,
            null,
            packagesPath,
            contract.absolutePath);
}
