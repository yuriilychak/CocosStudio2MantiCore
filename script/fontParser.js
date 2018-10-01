const fs = require("fs");
const path = require('path');
const logger = require("./logger");

const actionTemplates = [
    "{0} font generation",
    "Bundle '{0}' doesn't use fonts. Step skipped",
    "Bundle '{0}' doesn't use bitmap fonts, or fonts have wrong resolution (must be *.fnt). Step skipped",
    "Generation of {0} font {1}"
];

module.exports = function(bundleName, sourcePath) {
    logger.logMessage(actionTemplates[0], "Start");
    const result = {
        names: [],
        data: []
    };
    const fontDir = "font";
    const sourceFiles = fs.readdirSync(sourcePath);

    if (sourceFiles.indexOf(fontDir) === -1) {
        logger.logMessage(actionTemplates[1], bundleName);
        return result;
    }

    const fontDirPath = path.join(sourcePath, fontDir);

    const fonFiles = fs.readdirSync(fontDirPath);
    const fontSourceFiles = fonFiles.filter(font => font.indexOf(".fnt") !== -1);
    const fontSurceCount = fontSourceFiles.length;

    if (fontSurceCount === 0) {
        logger.logMessage(actionTemplates[2], bundleName);
        return result;
    }

    for (let i = 0; i < fontSurceCount; ++i) {
        parseFont(fontSourceFiles[i], fontDirPath, result);
    }
    logger.logMessage(actionTemplates[0], "Finish");
    return result;
};

function parseFont(fontName, fontsRootPath, fontBundle) {
    logger.logMessage(actionTemplates[3], fontName, "start");
    fontBundle.names.push(fontName.replace(".fnt", ""));
    const fontPath = path.join(fontsRootPath, fontName);
    const fontSource = fs.readFileSync(fontPath, "utf8");
    const fontData = {
        size: 0,
        spacing: 0,
        lineHeight: 0,
        base: 0,
        chars: [],
        kerning: [],
        offsets: []
    };
    const sourceLines = fontSource.split("\n");
    let sourceSize = sourceLines.length;

    let i, line, prevLine;

    for (i = 0; i < sourceSize; ++i) {
        line = sourceLines[i];
        if (hasSubstring(line, "chars count=")) {
            sourceLines[i] = '"chars": [';
        }
        else if (hasSubstring(line, "kernings count=")) {
            prevLine = sourceLines[i - 1];
            sourceLines[i - 1] = prevLine.substr(0, prevLine.length - 1);
            sourceLines[i] = '], \n"kernings": [';
        }
        else {
            sourceLines[i] = parseLine(line);
        }
    }

    if (sourceLines[sourceLines.length - 1].length === 0) {
        sourceLines.pop();
        sourceSize -= 1;
    }

    sourceLines[sourceSize - 1] = sourceLines[sourceSize - 1].substr(0, sourceLines[sourceSize - 1].length - 1) + "]";

    const resultJsonString = "{\n" + sourceLines.join("\n") + "\n}";
    const resultJson = JSON.parse(resultJsonString);
    const chars = resultJson.chars;
    const kernings = resultJson.kernings || [];
    const kerningCount = kernings.length;
    const charCount = chars.length;
    let char, j;
    const fieldsForDelete = ["x", "y",  "width", "height", "xoffset", "yoffset", "chnl", "xadvance"];
    const fieldCount =  fieldsForDelete.length;
    for (i = 0; i < charCount; ++i) {
        char = chars[i];
        char.dimensions = [char.x, char.y, char.width, char.height];
        char.offset = updateOffset([char.xoffset, char.yoffset], fontData.offsets);
        char.ax = char.xadvance;

        for (j = 0; j < fieldCount; ++j) {
            delete char[fieldsForDelete[j]];
        }

        fontData.chars.push(char);
    }

    for (i = 0; i < kerningCount; ++i) {
        kernings[i] = [kernings[i].first, kernings[i].second, kernings[i].amount];
        fontData.kerning.push(kernings[i]);
    }

    fontData.size = resultJson.info.size;
    fontData.spacing = resultJson.info.spacing;
    fontData.lineHeight = resultJson.common.lineHeight;
    fontData.base = resultJson.common.base;
    fontBundle.data.push(fontData);
    logger.logMessage(actionTemplates[3], fontName, "finish");
}

function updateOffset(offset, offsets) {
    const offsetCount = offsets.length;
    const offsetString = JSON.stringify(offset);

    for (let i = 0; i < offsetCount; ++i) {
        if (offsetString === JSON.stringify(offsets[i])) {
            return i;
        }
    }
    offsets.push(offset);
    return offsets.length - 1;
}

function parseLine(line) {
    const lineSplit = line.split(" ");
    const splitCount = lineSplit.length;
    let suffix = "";

    if (line === "") {
        return "";
    }

    if (lineSplit[0] === "char" || lineSplit[0] === "kerning") {
        lineSplit[0] = "{";
        suffix = " },";
    }
    else {
        lineSplit[0] = '"' + lineSplit[0]  + '": {';
        suffix = " },";
    }

    let i, data;
    
    for (i = 1; i < splitCount; ++i) {
        data = lineSplit[i];
        if (hasSubstring(data, "padding")) {
            lineSplit[i] = updateProperty(data, i, splitCount, '":[', "],", "]", suffix);
        }
        else if (hasSubstring(data, "face")) {
            lineSplit[i] = updateProperty(data, i, splitCount, '":"', '",', '"', suffix);
        }
        else {
            data = data.replace(",", ".");

            if (hasSubstring(data, "charset") || hasSubstring(data, "unicode")) {
                data += "0"
            }

            lineSplit[i] = updateProperty(data, i, splitCount, '":', ",", "", suffix);
        }
        
    }
    return lineSplit.join(" ");
}

function hasSubstring(data, value) {
    return data.indexOf(value) !== -1;
}

function updateProperty(data, index, splitCount, divider, prefix1, prefix2, suffix) {
    return '"' + data.replace('=', divider) + ((index !== splitCount - 1) ? prefix1 : (prefix2 + suffix));
}