
'use strict';

import * as fs from 'fs';
import {Contract} from './contract';

export class ContractCollection {
    public contracts: Array<Contract>;

    constructor() {
        this.contracts = new Array<Contract>();
    }

    public containsContract(contractPath: string) {
        return this.contracts.findIndex((contract: Contract) => contract.absolutePath === contractPath) > -1;
    }

    public getContractsForCompilation() {
        let contractsForCompilation = {};

        this.contracts.forEach(contract => {
            contractsForCompilation[contract.absolutePath] = {
                content: contract.code,
            };
        });

        return contractsForCompilation;
    }

    public addContractAndResolveImports(contractPath: string, code: string) {
        let contract = this.addContract(contractPath, code);

        if (!contract) {
            return null;
        }

        contract.resolveImports();

        contract.imports.forEach(foundImport => {
            if (fs.existsSync(foundImport)) {
                if (!this.containsContract(foundImport)) {
                    let importContractCode = this.readContractCode(foundImport);

                    if (importContractCode != null) {
                        this.addContractAndResolveImports(foundImport, importContractCode);
                    }
                }
            }
        });
    }

    private addContract(contractPath: string, code: string) {
        if (!this.containsContract(contractPath)) {
            let contract = new Contract(contractPath, code);
            this.contracts.push(contract);

            return contract;
        }
    }

    private readContractCode(contractPath: string) {
        if (fs.existsSync(contractPath)) {
            return fs.readFileSync(contractPath, 'utf8');
        }
    }
}
