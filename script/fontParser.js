const fs = require("fs");
const path = require('path'); 

module.exports = function(bundleName, sourcePath) {
    const result = {
        names: [],
        data: []
    }
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
    return result;
}

function parseFont(fontName, fontsRootPath, fontBundle) {
    fontBundle.names.push(fontName.replace(".fnt", ""));
    const fontPath = path.join(fontsRootPath, fontName);
    const fontSource = fs.readFileSync(fontPath, "utf8");
    const fontData = {
        size: 0,
        bold: false,
        italic: false,
        stretchH: 0,
        smooth: false,
        aa: true,
        padding:[0, 0, 0, 0],
        spacing: 0,
        outline: 0,
        lineHeight: 0,
        base: 56,
        chars: [],
        kerning: []
    };
    const sourceLines = fontSource.split("\n");
    const sourceSize = sourceLines.length;

    let i, tempString;

    for (i = 0; i < sourceSize; ++i) {
        sourceLines[i] = parseLine(sourceLines[i]);
        console.log(sourceLines[i]);
    }
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
    
    for (let i = 1; i < splitCount; ++i) {
        if (lineSplit[i].indexOf("padding") !== -1) {
            lineSplit[i] = '"' + lineSplit[i].replace('=', '":[') + ((i !== splitCount - 1) ? "]," : ("]" + suffix));
        }
        else if (lineSplit[i].indexOf("face") !== -1) {
            lineSplit[i] = '"' + lineSplit[i].replace('=', '":"') + ((i !== splitCount - 1) ? '",' : ('"' + suffix));
        }
        else {
            lineSplit[i] = lineSplit[i].replace(",", ".");
            lineSplit[i] = '"' + lineSplit[i].replace('=', '":') + ((i !== splitCount - 1) ? "," : suffix);
        }
        
    }
    return lineSplit.join(" ");
}