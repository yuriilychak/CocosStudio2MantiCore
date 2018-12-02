const fs = require("fs");
const path = require('path');
const fileUtil = require("./fileUtils");
const logger = require("./logger");
const { execSync } = require('child_process');

module.exports = function (bundleName, sourcePath, rootPath) {
    const spinePath = path.join(sourcePath, "spine");

    if (!fs.existsSync(spinePath)) {
        console.log("Bundle '" + bundleName + "' doesn't use spine animation. Step skipped.");
        return {
            skeletons: [],
            skeletonNames: []
        }
    }
    logger.logMessage("Parsing skeletons: {0}", "Start");
    const result = {
        skeletons: [],
        skeletonNames: []
    };
    const projects = fs.readdirSync(spinePath);
    const projectCount = projects.length;
    const tmpPath = fileUtil.createDir("tmp", rootPath);
    const isLinux = process.platform === "linux";
    //TODO Write simple parsing.
    const firstLine = isLinux ? "cd /home/yurii/Applications/Spine && ./Spine.sh" : "Spine";
    const command = [
        firstLine,
        "-i",
        "",
        "-o",
        tmpPath,
        "-e",
        path.join(spinePath, "export.json")
    ];
    const code = "utf8";
    let i, projectName, skeletonName, skeleton;

    logger.logMessage("Export skeletons: {0}", "Start");

    for (i = 0; i < projectCount; ++i) {
        projectName = projects[i];
        if (projectName.indexOf(".spine") === -1) {
            continue;
        }
        logger.logMessage("Export skeleton {0}: {1}", projectName, "Start");
        command[2] = path.join(spinePath, projectName);
        execSync(command.join(" "));
        logger.logMessage("Export skeleton {0}: {1}", projectName, "Finish");
    }

    const exportedSkeletons = fs.readdirSync(tmpPath);
    const skeletonCount = exportedSkeletons.length;

    for (i = 0; i < skeletonCount; ++i) {
        skeletonName = exportedSkeletons[i];
        skeleton = JSON.parse(fs.readFileSync(path.join(tmpPath, skeletonName), code));
        result.skeletonNames.push(skeletonName.split(".")[0]);
        result.skeletons.push(skeleton);
    }

    logger.logMessage("Export skeletons: {0}", "Finish");
    fileUtil.deleteDirRecursive(tmpPath);
    logger.logMessage("Parsing skeletons: {0}", "Finish");

    return result;
};