const fs = require("fs");
const path = require('path');

module.exports = function(sourcePath) {

    const result = {
        particleNames: [],
        particleData: [],
    };
    const particleDir = path.join(sourcePath, "particle");
    if (!fs.existsSync(particleDir)) {
        console.log("Particles don't exist. Step skipped.");
        return result;
    }
    const suffix = ".json";
    const files = fs.readdirSync(particleDir);
    const fileCount = files.length;
    let i, fileName;

    for (i = 0; i < fileCount; ++i) {
        fileName = files[i];
        if (fileName.indexOf(suffix) === -1) {
            continue;
        }
        result.particleData.push(JSON.parse(fs.readFileSync(path.join(particleDir, fileName), "utf8")));
        result.particleNames.push(fileName.replace(suffix, ""));
    }
    return result;
};
