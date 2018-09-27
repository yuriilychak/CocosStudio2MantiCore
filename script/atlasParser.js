const fs = require("fs");
const path = require('path');
const pngjs = require('pngjs');
const xml2json = require('xml2json');
const fileUtil = require("./fileUtils");
const logger = require("./logger");
const { execSync } = require('child_process');

let atlasCount = 0;
let atlasIndex = 0;
let callback = null;
let atlasData = null;

const actionTemplates = [
    "{0} atlas generation",
    "Bundle '{0}' doesn't have atlas folder. Step skipped",
    "Bundle '{0}' atlas dir doesn't have atlas files (need *.csi resolution). Step skipped",
    "Generation of atlas '{0}' {1}"
];

/**
 * @param {{names: string[], data: Object[]}} fontBundle
 * @param {string} bundleName
 * @param {string} sourcePath
 * @param {string} rootPath
 * @param {string} exportPath
 * @param {Function} onCompleteCallback
 */

module.exports = function(fontBundle, bundleName, sourcePath, rootPath, exportPath, onCompleteCallback) {
    logger.logMessage(actionTemplates[0], "Start");

    atlasData = {
        names: [],
        pages: [],
        atlasData: []
    };
    const atlasDir = "atlas";
    const sourceFiles = fs.readdirSync(sourcePath);

    if (sourceFiles.indexOf(atlasDir) === -1) {
        logger.logMessage(actionTemplates[1], bundleName);
        onCompleteCallback(atlasData);
    }

    const atlasDirPath = path.join(sourcePath, atlasDir);
    const dirFiles = fs.readdirSync(atlasDirPath);
    const atlasFiles = dirFiles.filter(file => file.indexOf(".csi") !== -1);

    atlasIndex = 0;
    atlasCount = atlasFiles.length;

    if (atlasCount === 0) {
        logger.logMessage(actionTemplates[2], bundleName);
        onCompleteCallback(atlasData);
    }

    callback = onCompleteCallback;

    for (let i = 0; i < atlasCount; ++i) {
        generateAtlas(atlasData, fontBundle, atlasFiles[i], atlasDirPath, sourcePath, rootPath, exportPath);
    }

    logger.logMessage(actionTemplates[0], "Finish");

    return atlasData;
};

function generateAtlas(atlasBundle, fontBundle, atlasFileName, atlasPath, sourcePath, rootPath, exportPath) {
    const atlasName = atlasFileName.replace(".csi", "");
    const fontFile = fs.readFileSync(path.join(atlasPath, atlasFileName), "utf8");
    const tmpDirPath = fileUtil.createDir("tmp", rootPath);

    logger.logMessage(actionTemplates[3], atlasName, "start");

    if (atlasName === "main") {
        cutFonts(fontBundle, sourcePath, tmpDirPath);
    }

    const atlasJson = JSON.parse(xml2json.toJson(fontFile));
    const images = atlasJson["PlistInfoProjectFile"]["Content"]["ImageFiles"]["FilePathData"];
    const imageCount = images.length;

    for (let i = 0; i < imageCount; ++i) {
        fileUtil.copyFile(sourcePath, tmpDirPath, images[i]["Path"]);
    }

    const outJsonFile = path.join(exportPath, atlasName + ".json");

    const commandSplit = [
        "TexturePacker",
        tmpDirPath,
        "--texture-format png",
        "--format pixijs4",
        "--data " + outJsonFile,
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
    execSync(command);
    logger.logMessage(actionTemplates[3], atlasName, "finish");
}

/**
 * @desc Cut fonts image for pack font to atlas.
 * @function
 * @param {{names: string[], data: Object[]}} fontBundle
 */

function cutFonts(fontBundle, sourcePath, tmpPath) {
    const fontNames = fontBundle.names;
    const fontCount = fontNames.length;

    if (fontCount === 0) {
        return;
    }

    const fontDir = "font";
    const fontDirPath = path.join(sourcePath, fontDir);
    const fontFiles = fs.readdirSync(fontDirPath);

    let i, fontName;

    const fontIndexForUpdate = [];

    for (i = 0; i < fontCount; ++i) {

        fontName = fontNames[i];
        if (fontFiles.indexOf(fontName + ".png") === -1) {
            logger.logMessage("Font '{0}' doesn't have *.png file and can't cut", fontName);
            continue;
        }
        fontIndexForUpdate.push(i);
    }
}