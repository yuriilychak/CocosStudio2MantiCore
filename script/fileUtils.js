const fs = require("fs");
const path = require('path');

/**
 * @desc Create dir in root path, and return it path.
 * @function
 * @param {string} dir
 * @param {string} rootPath
 * @returns {string}
 */

function createDir(dir, rootPath) {
    const dirs = fs.readdirSync(rootPath);
    const dirPath = path.join(rootPath, dir);

    if (dirs.indexOf(dir) === -1) {
        fs.mkdirSync(dirPath);
    }

    return dirPath;
}

/**
 * @desc Copy file from one folder to another
 * @function
 * @param {string} inPath
 * @param {string} outPath
 * @param {string} filePath
 */

function copyFile(inPath, outPath, filePath) {
    const filePathSplit = filePath.split("/");
    const splitCount = filePathSplit.length;

    if (splitCount !== 1) {
        let path = outPath;
        for (let i = 0; i < splitCount - 1; ++i) {
            path = createDir(filePathSplit[i], path);
        }
    }

    const startPath = path.join(inPath, filePath);
    const resultPath = path.join(outPath, filePath);

    fs.createReadStream(startPath).pipe(fs.createWriteStream(resultPath));
}

/**
 * @desc Clear directory from files.
 * @function
 * @param {string} rootPath
 * @param {string} dir
 */

function clearDir(rootPath, dir) {
    const dirs = fs.readdirSync(rootPath);
    const dirPath = path.join(rootPath, dir);

    if (dirs.indexOf(dir) === -1) {
        return;
    }

    const files = fs.readdirSync(dirPath);
    const fileCount = files.length;

    for (let i = 0; i < fileCount; ++i) {
        fs.unlinkSync(path.join(dirPath, files[i]));
    }
}

module.exports = {
    createDir,
    clearDir,
    copyFile
};