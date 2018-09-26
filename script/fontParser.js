const fs = require("fs");
const path = require('path'); 

module.exports = function(bundleName, sourcePath) {
    console.log("Start font generation");
    const result = {
        names: [],
        data: []
    };
    const fontDir = "font";
    const sourceFiles = fs.readdirSync(sourcePath);

    if (sourceFiles.indexOf(fontDir) === -1) {
        console.log("Bundle '" + bundleName + "' doesn't use fonts. Step skipped;");
        return result;
    }

    const fontDirPath = path.join(sourcePath, fontDir);

    const fonFiles = fs.readdirSync(fontDirPath);
    const fontSourceFiles = fonFiles.filter(font => font.indexOf(".fnt") !== -1);
    const fontSurceCount = fontSourceFiles.length;

    if (fontSurceCount === 0) {
        console.log("Bundle '" + bundleName + "' doesn't use bitmap fonts, or fonts have wrong resolution (must be *.fnt). Step skipped;");
        return result;
    }

    for (let i = 0; i < fontSurceCount; ++i) {
        parseFont(fontSourceFiles[i], fontDirPath, result);
    }
    console.log("Finish font generation");
    return result;
};

function parseFont(fontName, fontsRootPath, fontBundle) {
    console.log("Generation of " + fontName + " font start");
    fontBundle.names.push(fontName.replace(".fnt", ""));
    const fontPath = path.join(fontsRootPath, fontName);
    const fontSource = fs.readFileSync(fontPath, "utf8");
    const fontData = {
        size: 0,
        spacing: 0,
        lineHeight: 0,
        chars: [],
        kerning: [],
        offsets: []
    };
    const sourceLines = fontSource.split("\n");
    const sourceSize = sourceLines.length;

    let i, line, prevLine;

    for (i = 0; i < sourceSize; ++i) {
        line = sourceLines[i];
        if (line.indexOf("chars count=") !== -1) {
            sourceLines[i] = '"chars": [';
        }
        else if (line.indexOf("kernings count=") !== -1) {
            prevLine = sourceLines[i - 1];
            sourceLines[i - 1] = prevLine.substr(0, prevLine.length - 1);
            sourceLines[i] = '], \n"kernings": [';
        }
        else {
            sourceLines[i] = parseLine(line);
        }
    }

    sourceLines[sourceSize - 1] = sourceLines[sourceSize - 1].substr(0, sourceLines[sourceSize - 1].length - 1) + "]";

    const resultJsonString = "{\n" + sourceLines.join("\n") + "\n}";
    const resultJson = JSON.parse(resultJsonString);
    const chars = resultJson.chars;
    const kernings = resultJson.kernings || [];
    const kerningCount = kernings.length;
    const charCount = chars.length;
    let char;
    for (i = 0; i < charCount; ++i) {
        char = chars[i];
        char.dimensions = [char.x, char.y, char.width, char.height];
        char.offset = updateOffset([char.xoffset, char.yoffset], fontData.offsets);
        char.ax = char.xadvance;
        delete char.x;
        delete char.y;
        delete char.width;
        delete char.height;
        delete char.xoffset;
        delete char.yoffset;
        delete char.chnl;
        delete char.xadvance;
        fontData.chars.push(char);
    }

    for (i = 0; i < kerningCount; ++i) {
        kernings[i] = [kernings[i].first, kernings[i].second, kernings[i].amount];
        fontData.kerning.push(kernings[i]);
    }

    fontData.size = resultJson.info.size;
    fontData.spacing = resultJson.info.spacing;
    fontData.lineHeight = resultJson.common.lifetime;
    fontBundle.data.push(fontData);
    console.log("Generation of " + fontName + " font finish");
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
        if (data.indexOf("padding") !== -1) {
            lineSplit[i] = '"' + data.replace('=', '":[') + ((i !== splitCount - 1) ? "]," : ("]" + suffix));
        }
        else if (data.indexOf("face") !== -1) {
            lineSplit[i] = '"' + data.replace('=', '":"') + ((i !== splitCount - 1) ? '",' : ('"' + suffix));
        }
        else {
            data = data.replace(",", ".");

            if (data.indexOf("charset") !== -1 || data.indexOf("unicode") !== -1) {
                data += "0"
            }

            lineSplit[i] = '"' + data.replace('=', '":') + ((i !== splitCount - 1) ? "," : suffix);
        }
        
    }
    return lineSplit.join(" ");
}