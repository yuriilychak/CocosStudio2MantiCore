const fs = require("fs");
const path = require('path');
const pngjs = require('pngjs');
const xml2json = require('xml2json');
const fileUtil = require("./fileUtils");
const logger = require("./logger");
const { execSync } = require('child_process');

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

module.exports = async function(fontBundle, bundleName, sourcePath, rootPath, exportPath, onCompleteCallback) {
    logger.logMessage(actionTemplates[0], "Start");

    const atlasData = {
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
    const atlasCount = atlasFiles.length;

    if (atlasCount === 0) {
        logger.logMessage(actionTemplates[2], bundleName);
        onCompleteCallback(atlasData);
    }

    const fontDir = "font";
    const fontDirPath = path.join(sourcePath, fontDir);
    const fontNames = fontBundle.names;
    const fontData = fontBundle.data;
    const fontCount = fontNames.length;
    let i, j, atlasFileName, atlasName, atlasXmlString, atlasJson,
        images,tmpPath, fontFiles, fontName, fontPath, fontChars, fontExportPath, imgChar, buffer;

    const command = [
        "TexturePacker",
        "",// Path of input
        "--texture-format png",
        "--format pixijs4",
        "--data",
        "", //Path of export
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

    for (i = 0; i < atlasCount; ++i) {
        atlasFileName = atlasFiles[i];
        atlasName = atlasFileName.replace(".csi", "");

        logger.logMessage(actionTemplates[3], atlasName, "start");

        tmpPath = fileUtil.createDir("tmp", rootPath);
        atlasXmlString = fs.readFileSync(path.join(atlasDirPath, atlasFileName), "utf8");
        atlasJson = JSON.parse(xml2json.toJson(atlasXmlString));
        images = atlasJson["PlistInfoProjectFile"]["Content"]["ImageFiles"]["FilePathData"];

        images.forEach(image => fileUtil.copyFile(sourcePath, tmpPath, image["Path"]));

        if (atlasName === "main") {
            if (fontCount === 0) {
                continue;
            }
            fontFiles = fs.readdirSync(fontDirPath);

            for (j = 0; j < fontCount; ++j) {
                fontName = fontNames[j];

                if (fontFiles.indexOf(fontName + ".png") === -1) {
                    logger.logMessage("Font '{0}' doesn't have *.png file and can't cut", fontName);
                    continue;
                }
                fontChars = fontData[j].chars;
                fontExportPath = fileUtil.createDir(tmpPath, fontName);
                console.log(fontExportPath);

                logger.logMessage("Cut '{0}' font", fontName);

                fontPath = path.join(fontDirPath, fontName + ".png");
                await new Promise(resolve => {
                    fs.createReadStream(fontPath)
                        .pipe(new pngjs.PNG())
                        .on('parsed', function() {
                            console.log("PARSED");
                            fontChars.forEach(char => {
                                if (char.dimensions[2] === 0 || char.dimensions[3] === 0) {
                                    return;
                                }
                                imgChar = new pngjs.PNG({width: char.dimensions[2], height: char.dimensions[3]});
                                this.bitblt(imgChar, char.dimensions[0], char.dimensions[1], char.dimensions[2], char.dimensions[3]);
                                buffer = pngjs.PNG.sync.write(imgChar, {});
                                fs.writeFileSync(path.join(fontExportPath, char.id + ".png"), buffer);
                            });
                            resolve();
                        });
                });
            }
        }

        command[1] = tmpPath;
        command[5] = path.join(exportPath, atlasName + ".json");

        execSync(command.join(" "));
        fileUtil.deleteDirRecursive(tmpPath);
        logger.logMessage(actionTemplates[0], "Finish");
    }

    logger.logMessage(actionTemplates[3], atlasName, "finish");

    onCompleteCallback(atlasData);
};