const fs = require("fs");
const path = require('path');
const xml2js = require('xml2js');
const fileUtil = require("./fileUtils");
const { exec } = require('child_process');

let atlasCount = 0;
let atlasIndex = 0;
let atlasArray = [];
let callback = null;
let atlasData = null;

/**
 * @param {{names: string[], data: string[]}} fontBundle
 * @param {string} bundleName
 * @param {string} sourcePath
 * @param {string} rootPath
 * @param {string} exportPath
 * @param {Function} onCompleteCallback
 */

module.exports = function(fontBundle, bundleName, sourcePath, rootPath, exportPath, onCompleteCallback) {
    console.log("Start atlas generation");

    atlasData = {
        names: [],
        pages: [],
        atlasData: []
    };
    const atlasDir = "atlas";
    const sourceFiles = fs.readdirSync(sourcePath);

    if (sourceFiles.indexOf(atlasDir) === -1) {
        console.log("Bundle '" + bundleName + "' doesn't have atlas folder. Step skipped");
        onCompleteCallback(atlasData);
    }

    const atlasDirPath = path.join(sourcePath, atlasDir);
    const dirFiles = fs.readdirSync(atlasDirPath);
    const atlasFiles = dirFiles.filter(file => file.indexOf(".csi") !== -1);

    atlasIndex = 0;
    atlasArray = atlasFiles;
    atlasCount = atlasArray.length;

    if (atlasCount === 0) {
        console.log("Bundle '" + bundleName + "' atlas dir doesn't have atlas files (need *.csi resolution). Step skipped");
        onCompleteCallback(atlasData);
    }

    callback = onCompleteCallback;

    for (let i = 0; i < atlasCount; ++i) {
        generateAtlas(atlasData, fontBundle, atlasArray[i], atlasDirPath, sourcePath, rootPath, exportPath);
    }

    return atlasData;
};

function generateAtlas(atlasBundle, fontBundle, atlasFileName, atlasPath, sourcePath, rootPath, exportPath) {
    const atlasName = atlasFileName.replace(".csi", "");
    const fontFile = fs.readFileSync(path.join(atlasPath, atlasFileName), "utf8");
    const tmpDirPath = fileUtil.createDir("tmp", rootPath);

    xml2js.parseString(fontFile, (err, jsonData) => {
        const images = jsonData["PlistInfoProjectFile"]["Content"][0]["ImageFiles"][0]["FilePathData"];
        const imageCount = images.length;
        for (let i = 0; i < imageCount; ++i) {
            fileUtil.copyFile(sourcePath, tmpDirPath, images[i]["$"]["Path"]);
        }

        const outJsonFile = path.join(exportPath, atlasName + ".json");
        const outPngFile = path.join(exportPath, atlasName + ".png");

        const commandSplit = [
            "TexturePacker",
            tmpDirPath,
            "--texture-format png",
            "--format pixijs4",
            "--data " + outJsonFile,
            "--texturepath " + outPngFile,
            "--trim-sprite-names",
            "--algorithm MaxRects",
            "--size-constraints POT",
            "--force-squared",
            "--pack-mode Best",
            "--disable-rotation",
            "--extrude 1",
            "--trim-mode Trim",
            "--trim-threshold 1",
            "--trim-margin 1",
            "--opt RGBA8888",
        ];

        const command = commandSplit.join(" ");
        exec(command, (err, stdout, stderr) => {
            if (err) {
                console.log("Creating atlas '" + atlasName + "' failed with error: " + err);
            }
            else {
                console.log("Atlas '" + atlasName + "' generated");
            }
            ++atlasIndex;

            if (atlasIndex === atlasCount) {
                console.log("Finish atlas generation");
                callback(atlasBundle);
                return;
            }
            generateAtlas(atlasData, fontBundle, atlasArray[atlasIndex], atlasPath, sourcePath, rootPath, exportPath);
        });
    });
}