import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

interface PackageJson {
    name: string;
    version: string;
}

export interface ListByPackage {
    [key: string]: string[];
}

export function installLocal(packagesByTarget: ListByPackage): Promise<ListByPackage> {
    const packagesBySource = mapToPackagesBySource(packagesByTarget);
    return Promise.all(
        Object.keys(packagesBySource)
            .map(source => installPackagesInto(source, packagesBySource[source])))
        .then(() => packagesBySource);
}

export function mapToPackagesBySource(packagesByTarget: ListByPackage) {
    const packagesBySource: ListByPackage = {};
    Object.keys(packagesByTarget)
        .forEach(targetLocalPackage => packagesByTarget[targetLocalPackage].forEach(sourceLocalPackage => {
            const targetFullPath = path.resolve(targetLocalPackage);
            const sourceFullPath = path.resolve(sourceLocalPackage);
            let targetPackages = packagesBySource[sourceFullPath];
            if (!targetPackages) {
                targetPackages = [];
                packagesBySource[sourceFullPath] = targetPackages;
            }
            if (targetPackages.every(pkg => pkg !== targetFullPath)) {
                targetPackages.push(targetFullPath);
            }
        }));
    return packagesBySource;
}

function installPackagesInto(source: string, targets: string[]) {
    return Promise.all([
        readPackageJson(source).then(pck => path.resolve(`${pck.name}-${pck.version}.tgz`)),
        exec('', `npm pack ${source}`)
    ]).then(([packFile]) =>
        Promise.all(targets.map(targetPackage => exec(targetPackage, `npm i --no-save ${packFile}`)))
            .then(() => del(packFile)));
}

export function exec(cwd: string, command: string) {
    return new Promise<string>((res, rej) => {
        childProcess.exec(command, { cwd }, (err, stdout, stderr) => {
            if (err) {
                rej(err);
            } else {
                res(`${stdout}${stderr ? `${os.EOL}stderr: ${stderr}` : ''}`);
            }
        });
    });
}

function readPackageJson(from: string) {
    return new Promise<PackageJson>((res, rej) => {
        fs.readFile(path.join(from, 'package.json'), 'utf8', (err, content) => {
            if (err) {
                rej(err);
            } else {
                res(JSON.parse(content) as PackageJson);
            }
        });
    });
}

function del(file: string) {
    return new Promise<undefined>((res, rej) => fs.unlink(file, err => {
        if (err) {
            rej(err);
        } else {
            res(undefined);
        }
    }));
}
