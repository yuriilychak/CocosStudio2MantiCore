const addUIToBundle = require("./uiParser");
const addFontToBundle = require("./fontParser");
const generateAtlases = require("./atlasParser");
const fileUtil = require("./fileUtils");
const parseAnimations = require("./animationParser");
const logger = require('./logger');
const fs = require("fs"); 
const path = require('path');


/**
 * @desc Dir name for export bundles.
 * @type {string}
 */

const exportDir = "export";

/**
 * @desc Dir name that contain source files.
 * @type {string}
 */

const sourceDir = "cocosstudio";

/**
 * @desc Working directory of script.
 * @type {string}
 */

const workingDir = process.cwd();

/**
 * @desc Path of export dir.
 * @type {string}
 */

const exportPath = path.join(workingDir, exportDir);

/**
 * @desc Array with directories that parse script.
 * @type {string[]}
 */

const dirs = fs.readdirSync(workingDir).filter(file => fs.statSync(path.join(workingDir, file)).isDirectory());

/**
 * @desc Array with asset directories that parse script.
 * @type {string[]}
 */

const assetDirs = dirs.filter(dir => fs.readdirSync(dir).includes(sourceDir));

/**
 * @desc Generate asset bandle from source.
 * @function
 * @param {string} dirName - Name of dir
 */

async function generateAssetBundle(dirName) {
    const actionTemplates = [
        "Bundle '{0}' generation {1}",
        "Has '{0}' elements: {1}",
        "Generate {0} bundles",
        "Bundle '{0}' doesn't have {1} elements. Step skipped",
        "Clear '{0}' export dir"
    ];
    const errorTemplates = [
        "Error '{0}' asset don't have '{1}' folder in '{2}'"
    ];

    logger.logMessage(actionTemplates[4], dirName);

    fileUtil.clearDir(exportPath, dirName);
    fileUtil.createDir(dirName, exportPath);

    logger.logMessage(actionTemplates[0], dirName, "start");

    const rootDirPath = path.join(workingDir, dirName);
    const projectFiles = fs.readdirSync(rootDirPath);
    const assetDir = "export";

    if (projectFiles.indexOf(assetDir) === -1) {
        logger.logMessage(errorTemplates[0], dirName, assetDir, rootDirPath);
        return;
    }

    const assetDirPath = path.join(rootDirPath, assetDir);
    const assetDirs = fs.readdirSync(assetDirPath);
    const elementDir = "element";

    if (assetDirs.indexOf(elementDir) === -1) {
        logger.logMessage(errorTemplates[0], dirName, elementDir, assetDirPath);
        return;
    }

    const sourceDirPath = path.join(rootDirPath, sourceDir);
    const fontBundle = addFontToBundle(dirName, sourceDirPath);

    const atlasBundle = await generateAtlases(fontBundle, dirName, sourceDirPath, workingDir, path.join(exportPath, dirName));
    const elementDirPath = path.join(assetDirPath, elementDir);
    const elementDirs = fs.readdirSync(elementDirPath);

    const desktopDir = "desktop";
    const commonDir = "common";
    const mobileDir = "mobile";
    const hasCommon = elementDirs.indexOf(commonDir) !== -1;
    const hasDesktop = elementDirs.indexOf(desktopDir) !== -1;
    const hasMobile = elementDirs.indexOf(mobileDir) !== -1;
    const desktopPath = hasDesktop ? path.join(elementDirPath, desktopDir) : null;
    const mobilePath = hasMobile ? path.join(elementDirPath, mobileDir) : null;
    const commonPath = hasCommon ? path.join(elementDirPath, commonDir) : null;

    logger.logMessage(actionTemplates[1], commonDir, hasCommon);
    logger.logMessage(actionTemplates[1], desktopDir, hasDesktop);
    logger.logMessage(actionTemplates[1], mobileDir, hasMobile);

    if (hasDesktop || hasCommon) {
        const bundle = createEmptyAssetBundle();
        bundle.fonts = fontBundle.names;
        bundle.fontData = fontBundle.data;
        bundle.textures = atlasBundle.textures;
        bundle.textureParts = atlasBundle.textureParts;
        bundle.atlases = atlasBundle.atlases;
        bundle.name = dirName;
        logger.logMessage(actionTemplates[2], desktopDir);
        createAssetBundle(bundle, desktopPath, commonPath, dirName, false);
    }
    else {
        logger.logMessage(actionTemplates[3], dirName, desktopDir);
    }

    if (hasMobile || hasCommon) {
        const bundle = createEmptyAssetBundle();
        bundle.fonts = fontBundle.names;
        bundle.fontData = fontBundle.data;
        bundle.textures = atlasBundle.textures;
        bundle.textureParts = atlasBundle.textureParts;
        bundle.atlases = atlasBundle.atlases;
        bundle.name = dirName;
        logger.logMessage(actionTemplates[2], mobileDir);
        createAssetBundle(bundle, mobilePath, commonPath, dirName, true);
    }
    else {
        logger.logMessage(actionTemplates[3], dirName, mobileDir);
    }

    logger.logMessage(actionTemplates[0], dirName, "finish");
}


/**
 * @desc Create asset bundle.
 * @function
 * @param {?string} mainPath
 * @param {?string} commonPath
 * @param {string} name
 * @param {boolean} isMobile
 */
function createAssetBundle(bundle, mainPath, commonPath, name, isMobile) {
    const bundleName = "bundle_" + (isMobile ? "m" : "d") + ".json";
    const bundlePath = path.join(exportPath, name);
    const exportDirs = fs.readdirSync(exportPath);
    const bundleFilePath = path.join(bundlePath, bundleName);

    if (exportDirs.indexOf(name) === -1) {
        fs.mkdirSync(bundlePath);
    }
    const uiData = {
        names: [],
        data: []
    };

    getAssetElementData(uiData, mainPath, bundle);
    getAssetElementData(uiData, commonPath, bundle);

    addUIToBundle(bundle, uiData);

    fs.writeFileSync(bundleFilePath, JSON.stringify(bundle));
}


/**
 * @desc Returns asset element names and data
 * @function
 * @param {{names: string[], data: Object[]}} uiData
 * @param {?string} dirPath
 * @param {Object} bundle
 */

function getAssetElementData(uiData, dirPath, bundle)  {
    if (dirPath === null) {
        return;
    }

    const suffix = ".json";
    const content = fs.readdirSync(dirPath);
    const assets = content.filter(asset => asset.indexOf(suffix) !== -1);

    uiData.names = uiData.names.concat(assets.map(asset => asset.replace(suffix, "")));

    uiData.data = uiData.data.concat(assets.map(asset => {
        const assetPath = path.join(dirPath, asset);
        const data = JSON.parse(fs.readFileSync(assetPath));
        parseAnimations(data["Content"]["Content"], bundle);
        return data["Content"]["Content"]["ObjectData"];
    }));
}

/**
 * @desc Generate empty asset bundle
 * @function
 * @returns {Object}
 */

function createEmptyAssetBundle() {
    return {
        anchors: [],
        animationNames: [],
        atlases: [],
        atlasFonts: [],
        colors: [],
        componentNames: [],
        elementNames: [],
        fonts: [],
        fontData: [],
        fontStyles: [],
        texts: [],
        textFieldStyles: [],
        textures: [],
        textureParts: [],
        ui: [],
        bundleType: 1, //Asset bundle,
        name: ""
    }
}

if (dirs.indexOf(exportDir) === -1) {
    fs.mkdirSync(exportPath);
}

assetDirs.forEach(dir => generateAssetBundle(dir));