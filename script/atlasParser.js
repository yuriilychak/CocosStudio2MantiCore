const fs = require("fs");
const path = require('path');
const pngjs = require('pngjs');
const fileUtil = require("./fileUtils");
const logger = require("./logger");
const { execSync } = require('child_process');
const webp = require('webp-converter');
const imagemin = require('imagemin');
const imageminPngquant = require('imagemin-pngquant');

const actionTemplates = [
    "{0} atlas generation",
    "Bundle '{0}' doesn't have atlas folder. Step skipped",
    "Bundle '{0}' atlas dir doesn't have atlas files (need *.csi resolution). Step skipped",
    "Generation of atlas '{0}' {1}",
    "WARNING: 'main' atlas have more than one texture. Please regenerate it."

];

let bundle = null;

/**
 * @param {{names: string[], data: Object[]}} fontBundle
 * @param {string} bundleName
 * @param {string} sourcePath
 * @param {string} rootPath
 * @param {string} exportPath
 * @param {Function} onCompleteCallback
 */

module.exports = async function(fontBundle, bundleName, sourcePath, rootPath, exportPath) {
    logger.logMessage(actionTemplates[0], "Start");

    bundle = {
        textures: [],
        textureParts: [],
        atlases: []
    };
    const atlasDir = "atlas";
    const sourceFiles = fs.readdirSync(sourcePath);

    if (sourceFiles.indexOf(atlasDir) === -1) {
        logger.logMessage(actionTemplates[1], bundleName);
       return bundle;
    }

    const atlasDirPath = path.join(sourcePath, atlasDir);
    const dirFiles = fs.readdirSync(atlasDirPath);
    const atlasFiles = dirFiles.filter(file => file.indexOf(".csi") !== -1);
    const atlasCount = atlasFiles.length;

    if (atlasCount === 0) {
        logger.logMessage(actionTemplates[2], bundleName);
        return bundle;
    }

    const fontDir = "font";
    const fontDirPath = path.join(sourcePath, fontDir);
    const fontNames = fontBundle.names;
    const fontData = fontBundle.data;
    const fontCount = fontNames.length;
    const suffix = ".json";
    let i, j, atlasFileName, atlasName, atlasXmlString, atlasJsonString, atlasJson, meta, frameMap, atlasIndex, atlasPath,
        frameArray, key, frame, images,tmpPath, fontFiles, fontName, fontPath, fontChars, fontExportPath, imgChar, buffer;

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
        "--extrude 2",
        "--border-padding 1",
        "--common-divisor-x 1",
        "--common-divisor-y 1",
        "--trim-mode Trim",
        "--trim-threshold 1",
        "--trim-margin 1",
        "--opt RGBA8888",
        "--multipack"
    ];

    for (i = 0; i < atlasCount; ++i) {
        atlasFileName = atlasFiles[i];
        atlasName = atlasFileName.replace(".csi", "");

        logger.logMessage(actionTemplates[3], atlasName, "start");

        tmpPath = fileUtil.createDir("tmp", rootPath);
        atlasXmlString = fs.readFileSync(path.join(atlasDirPath, atlasFileName), "utf8");
        images = atlasXmlString.split("\n")
            .filter(str => str.indexOf("<FilePathData Path=") !== -1)
            .map(str => str.replace('      <FilePathData Path="', "").replace('" />\r', "").replace('" />', ""));

        images.forEach(image => fileUtil.copyFile(sourcePath, tmpPath, image));

        if (atlasName === "main" && fontCount !== 0) {
            fontFiles = fs.readdirSync(fontDirPath);

            for (j = 0; j < fontCount; ++j) {
                fontName = fontNames[j];

                if (fontFiles.indexOf(fontName + ".png") === -1) {
                    logger.logMessage("Font '{0}' doesn't have *.png file and can't cut", fontName);
                    continue;
                }
                fontChars = fontData[j].chars;
                fontExportPath = fileUtil.createDir(fontName, tmpPath);

                logger.logMessage("Cut '{0}' font", fontName);

                fontPath = path.join(fontDirPath, fontName + ".png");
                await new Promise(resolve => {
                    fs.createReadStream(fontPath)
                        .pipe(new pngjs.PNG())
                        .on('parsed', function() {

                            fontChars.forEach(char => {
                                if (char.dimensions[2] === 0 || char.dimensions[3] === 0) {
                                    return;
                                }
                                imgChar = new pngjs.PNG({width: char.dimensions[2], height: char.dimensions[3]});
                                this.bitblt(imgChar, char.dimensions[0], char.dimensions[1], char.dimensions[2], char.dimensions[3]);
                                buffer = pngjs.PNG.sync.write(imgChar, {});
                                fs.writeFileSync(path.join(fontExportPath, char.id + ".png"), buffer);
                            });
                            logger.logMessage("Cut '{0}' complete", fontName);
                            resolve();
                        });
                });
            }
        }

        command[1] = tmpPath;
        command[5] = path.join(exportPath, atlasName + "_{n}"+ suffix);

        execSync(command.join(" "));
        fileUtil.deleteDirRecursive(tmpPath);

        atlasIndex = 0;

        while (true) {
            atlasPath = path.join(exportPath, atlasName + "_" + atlasIndex + suffix);

            if (!fs.existsSync(atlasPath)) {
                break;
            }

            await pngToWebP(path.join(exportPath, atlasName + "_" + atlasIndex + ".png"));

            atlasJsonString = fs.readFileSync(atlasPath, "utf8");
            atlasJson = JSON.parse(atlasJsonString);

            meta = atlasJson["meta"];
            frameMap = atlasJson["frames"];

            atlasJson.scale = meta.scale;
            atlasJson.size = [meta.size.w, meta.size.h];
            atlasJson.images = [meta.image.split(".")[0]];

            delete atlasJson["meta"];
            delete atlasJson["animations"];

            if (atlasName + "_" + atlasIndex === "main_0") {
                for (j = 0; j < fontCount; ++j) {
                    updateFontDimensions(frameMap, fontNames[j], fontData[j].chars);
                }
            }
            else if (atlasName.indexOf("main_") !== -1) {
                logger.logMessage(actionTemplates[4]);
            }

            frameArray = [];

            for (key in frameMap) {
                frame = frameMap[key];
                frame.id = getTextureIndex(key);
                frame.sourceSize = [
                    frame.sourceSize.w,
                    frame.sourceSize.h
                ];
                frame.spriteDimensions = convertFrameToDimension(frame.spriteSourceSize);
                frame.dimensions = convertFrameToDimension(frame.frame);
                delete frame.spriteSourceSize;
                delete frame.frame;
                frameArray.push(frame);
            }

            atlasJson.name = atlasName;
            atlasJson.frames = frameArray;

            bundle.atlases.push(atlasJson);

            fs.unlinkSync(atlasPath);

            ++atlasIndex;
        }


        logger.logMessage(actionTemplates[3], atlasName, "finish");

    }
    await compressPNG(exportPath);

    logger.logMessage(actionTemplates[0], "Finish");

    return bundle;
};

function updateFontDimensions(atlasFrames, fontName, chars) {
    const charCount = chars.length;
    let i, charData, charFrame, frame;

    for (i = 0; i < charCount; ++i) {
        charData = chars[i];
        charFrame = fontName + "/" + charData.id;
        if (!atlasFrames.hasOwnProperty(charFrame)) {
            continue;
        }
        frame = atlasFrames[charFrame];
        charData.dimensions = convertFrameToDimension(frame.frame);
        delete atlasFrames[charFrame];
    }
}

function convertFrameToDimension(data) {
    return [
        data.x,
        data.y,
        data.w,
        data.h
    ];
}

/**
 * @desc Add texture to cache, and returns index.
 * @function
 * @param {string} name
 * @returns {int}
 */

function getTextureIndex(name) {
    const decomposed = decomposeTexturePath(name);
    const stringified = JSON.stringify(decomposed);
    const textureCount = bundle.textures.length;
    let i;
    for (i = 0; i < textureCount; ++i) {
        if (stringified === JSON.stringify(bundle.textures[i])) {
            return i;
        }
    }
    let result = bundle.textures.length;
    bundle.textures.push(decomposed);

    return result;
}

function decomposeTexturePath(name) {
    const result = [];
    const nameSplit = name.split("/");
    const splitCount = nameSplit.length;
    let index, i, part;
    for (i = 0; i < splitCount; ++i) {
        part = nameSplit[i];
        index = bundle.textureParts.indexOf(part);
        if (index === -1) {
            index = bundle.textureParts.length;
            bundle.textureParts.push(part);
        }
        result.push(index);
    }
    return result;
}

async function pngToWebP(path) {
    return new Promise((resolve, reject) => {
        webp.cwebp(path, path.replace(".png", ".webp"), "-q 85", (status) => {
            console.log("WebP for " + path  + "created successfully");
            resolve();
        });
    });
}

async function compressPNG(path) {
    const files = await imagemin([path + "/*.png"], path, {
        plugins: [
            imageminPngquant({quality: '65-70'})
        ]
    });
}