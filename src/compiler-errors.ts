
import { DiagnosticSeverity } from 'vscode-languageserver';

interface CompilerError {
    diagnostic: any;
    fileName: string;
}

const RE_ERROR_LOCATION = /^(\s*)(\^-*\^{0,1})\s*$/;

function getDiagnosticSeverity(severity: string): DiagnosticSeverity {
    switch (severity) {
        case 'error':
            return DiagnosticSeverity.Error;
        case 'warning':
            return DiagnosticSeverity.Warning;
        default:
            return DiagnosticSeverity.Error;
    }
}

export function errorToDiagnostic(error: any): CompilerError {
    const errorSplit = error.formattedMessage.split(':');

    let fileName = errorSplit[0];
    let index = 1;

    // a full path in windows includes a : for the drive
    if (process.platform === 'win32') {
        fileName = errorSplit[0] + ':' + errorSplit[1];
        index = 2;
    }

    const line = parseInt(errorSplit[index], 10);

    let columnStart = parseInt(errorSplit[index + 1], 10);
    let columnEnd = columnStart;

    const lines = error.formattedMessage.trim().split(/\n/g);
    const lastLine = lines.pop();

    const matches = RE_ERROR_LOCATION.exec(lastLine);

    if (matches) {
        columnStart = matches[1].length;
        columnEnd = columnStart + matches[2].length;
    }

    return {
        diagnostic: {
            message: error.message,
            range: {
                end: {
                    character: columnStart,
                    line: line - 1,
                },
                start: {
                    character: columnEnd,
                    line: line - 1,
                },
            },
            severity: getDiagnosticSeverity(error.severity),
            source: 'solc',
        },
        fileName: fileName,
    };
}
