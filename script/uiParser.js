const CONSTANT = require("./constant");
const MathUtil = require("./mathUtil");

module.exports = function (bundle, bundleData) {

    bundle.componentNames = bundleData.names;

    const ANCHOR_CENTER = [CONSTANT.HALF_PERCENT, CONSTANT.HALF_PERCENT];
    const SCROLL_DIRECTION = {
        NONE: 0,
        VERTICAL: 1,
        HORIZONTAL: 2,
        BOTH: 3
    };
    
    const PANEL_GRAPHIC_TYPE = {
        NONE: 0,
        COLOR: 1,
        SPRITE: 2
    };
    
    const UI_ELEMENT = {
        NONE: 0,
        UI_ELEMENT: 1,
        WIDGET: 2,
        PANEL: 3,
        IMAGE_VIEW: 4,
        BUTTON: 5,
        LABEL: 6,
        SLIDER: 7,
        TOGGLE_BUTTON: 8,
        SPRITE: 9,
        CONTAINER: 10,
        PROGRESS_BAR: 11,
        CHECK_BOX: 12,
        ATLAS_LABEL: 13,
        TEXT_FIELD: 14,
        SCROLL_VIEW: 15,
        LIST_VIEW: 16
    };
    
    const HORIZONTAL_ALIGN = {
        NONE: 0,
        LEFT: 1,
        CENTER: 2,
        RIGHT: 3
    };
    
    const VERTICAL_ALIGN = {
        NONE: 0,
        TOP: 1,
        MIDDLE: 2,
        BOTTOM: 3
    };
    
    const DIRECTION = {
        NONE: 0,
        LEFT: 1,
        RIGHT: 2,
        UP: 3,
        DOWN: 4
    };
    
    const DEFAULT_TEMPLATE = generateDefaultTemplate(); 
    const WHITE_COLOR_INDEX = getColorIndex(CONSTANT.COLOR_WHITE);
    
    const files = bundleData.data.map(element => formatData(element));
    
    files.forEach(file => updateElementNames(file));

    bundle.ui = files;
    
    
    function getFontStyleIndex(fontStyle) {
        const styleCount = bundle.fontStyles.length;
        for (let i = 0; i < styleCount; ++i) {
            if (JSON.stringify(bundle.fontStyles[i]) === JSON.stringify(fontStyle)) {
                    return i;
            }
        }
    
        bundle.fontStyles.push(fontStyle);
        return styleCount;
    }
    
    function updateElementNames(data) {
        data.name = getElementNameIndex(data.name);
        if (data.content) {
            updateElementNames(data.content);
        }
        if (data.children !== null) {
            const children = data["children"];
            children.forEach(child => updateElementNames(child));
        }
    }
    
    function formatData(data) {
        formatElement(data, null);
        return data;
    }
    
    function formatElement(element, parent) {
        swapPointToArray(element, "Scale", "scale", [CONSTANT.MAX_PERCENT, CONSTANT.MAX_PERCENT], true, "Scale");
        swapPointToArray(element, "AnchorPoint", "anchor", [0, 0], true, "Scale");

        if (!element.Position) {
            element.Position = {
                X: 0,
                Y: 0
            }
        }

        if (!element.PrePosition) {
            element.PrePosition = {
                X: 0,
                Y: 0
            }
        }

        if (!element.PreSize) {
            element.PreSize = {
                X: 1,
                Y: 1
            }
        }

        unionDimension(element, "dimensions", "Position", "Size", [0, 0], [1, 1], false);
        unionDimension(element, "preDimensions", "PrePosition", "PreSize", [0, 0], [CONSTANT.MAX_PERCENT, CONSTANT.MAX_PERCENT], true);
    
        if (element.scale[0] === CONSTANT.MAX_PERCENT && element.scale[1] === CONSTANT.MAX_PERCENT) {
            element.scale = null;
        }
        else {
            let temp = element.scale[0];
            element.scale[0] = element.scale[1];
            element.scale[1] = temp;
        }
    
        const swapIn = ["Name", "TouchEnable", "FontSize", "ctype", "Children", "ClipAble", "ComboBoxIndex", "VisibleForFrame"];
        const swapOut = ["name", "interactive", "fontSize", "type", "children", "clipped", "colliderVisible", "visible"];
        const swapCount = swapIn.length;
    
        element.alpha = MathUtil.channelToPercent(extractValue(element, "Alpha", CONSTANT.MAX_CHANNEL));
    
        for (let i = 0; i < swapCount; ++i) {
            swapProperty(element, swapIn[i], swapOut[i]);
        }
    
        swapColor(element, "SingleColor", "panelColor");
        swapColor(element, "CColor", "tint");
        swapColor(element, "OutlineColor", "outlineColor");
        swapColor(element, "ShadowColor", "shadowColor");
        swapColor(element, "TextColor", "textColor");
    
        unionFields(element, "margin", ["LeftMargin", "RightMargin", "TopMargin", "BottomMargin"], 0, true);
        unionFields(element, "flip", ["FlipX", "FlipY"], false);
        updateScale9(element);
        unionFields(element, "stretch", ["StretchWidthEnable", "StretchHeightEnable"], false);
        updateEdge(element);
        unionFields(element, "percent", ["PositionPercentXEnabled", "PositionPercentYEnabled", "PercentWidthEnable", "PercentHeightEnable"], false);
        unionFields(element, "rotation", ["RotationSkewX", "RotationSkewY"], 0, true);
    
        if (element.rotation !== null && element.rotation[1] !== element.rotation[2]) {
            element.rotation[0] = CONSTANT.MAX_ANGLE - element.rotation[0];
        }
    
        const contentData = [
            "FileData", "PressedFileData", "DisabledFileData", "NormalFileData", 
            "ProgressBarData", "BackGroundData", "BallNormalData", "BallPressedData", 
            "BallDisabledData", "FontResource", "ImageFileData", "NormalBackFileData",
            "PressedBackFileData", "DisableBackFileData", "NodeNormalFileData", 
            "NodeDisableFileData", "LabelBMFontFile_CNB", "LabelAtlasFileImage_CNB"
        ];
        const contentDataCount = contentData.length;
    
        for (let i = 0; i < contentDataCount; ++i) {
            updateContentData(element, contentData[i]);
        }
    
    
        if (element.hasOwnProperty("children")) {
            const children = element["children"];
            children.forEach(child => formatElement(child, element));
        }
    
        if (parent !== null) {
            let parentSize;
            if (parent.type === "ScrollViewObjectData")  {
                const innerSize = parent["InnerNodeSize"] || null;
                parentSize = innerSize !== null && innerSize["Height"] ? innerSize["Height"] : parent.dimensions[3];
                
            }
            else {
                parentSize = parent.dimensions[3];
            }
            element.dimensions[1] = parentSize - element.dimensions[1];
            element.anchor[1] = CONSTANT.MAX_PERCENT - element.anchor[1];
            element.preDimensions[1] = CONSTANT.MAX_PERCENT - element.preDimensions[1];
        }


        if (element.animations) {
            element.animations.forEach(animation => {
                let index = bundle.animationNames.indexOf(animation.name);
                if (index === -1) {
                    index = bundle.animationNames.length;
                    bundle.animationNames.push(animation.name);
                }
                animation.name = index;
            });
        }

        parseCustomComponents(element);
        updateByType(element);
    
        element.anchor = getAnchorIndex(element.anchor);
    
        if (!element.hasOwnProperty("fileData")) {
            element.fileData = null;
        }
    
        if (!element.hasOwnProperty("content")) {
            element.content = null;
        }
    
        if (!element.hasOwnProperty("children") || element.children === null || element.children.length === 0) {
            element.children = null;
        }
    
        let key;
    
        for (key in element) {
            if (!DEFAULT_TEMPLATE.hasOwnProperty(key)) {
                delete element[key];
            }
        }
    
        for (key in DEFAULT_TEMPLATE) {
            if (!element.hasOwnProperty(key)) {
                element[key] = DEFAULT_TEMPLATE[key];
            }
        }
    }
    
    function mergeArrays(data, link1, link2, newLink) {
        data[newLink] = data[link1].concat(data[link2]);
        delete data[link1];
        delete data[link2];
    }
    
    function swapProperty(data, link, newLink) {
        if (!data.hasOwnProperty(link)) {
            return;
        }
    
        data[newLink] = data[link];
        delete data[link];
    }
    
    function updateEdge(data) {
        const result = {};
    
        insertValue(data, "HorizontalEdge", "horizontal", result);
        insertValue(data, "VerticalEdge", "vertical", result);
    
        if (Object.keys(result).length === 0) {
            data.edge = null;
            return;
        }
    
        const edge = [];
    
        if (result["horizontal"]) {
            switch (result["horizontal"]) {
                case "LeftEdge": {
                    edge.push(HORIZONTAL_ALIGN.LEFT);
                    break;
                }
                case "RightEdge": {
                    edge.push(HORIZONTAL_ALIGN.RIGHT);
                    break;
                }
                case "BothEdge": {
                    edge.push(HORIZONTAL_ALIGN.CENTER);
                    break;
                }
            }
        }
        else {
            edge.push(HORIZONTAL_ALIGN.NONE);
        }
    
        if (result["vertical"]) {
            switch (result["vertical"]) {
                case "TopEdge": {
                    edge.push(VERTICAL_ALIGN.TOP);
                    break;
                }
                case "BottomEdge": {
                    edge.push(VERTICAL_ALIGN.BOTTOM);
                    break;
                }
                case "BothEdge": {
                    edge.push(VERTICAL_ALIGN.MIDDLE);
                    break;
                }
            }
        }
        else {
            edge.push(VERTICAL_ALIGN.NONE);
        }
    
        data.edge = !(edge[0] === -1 && edge[1] === -1) ? edge : null;
    }
    
    function insertValue(data, link, newLink, result, defaultValue = null) {
        if (!data.hasOwnProperty(link)) {
            if (defaultValue !== null) {
                result[newLink] = defaultValue;
            }
            return;
        }
    
        result[newLink] = data[link];
        delete data[link];
    }
    
    function updateScale9(data) {
        const link = "slice9";
        if (!data["Scale9Enable"]) {
            data[link] = null;
            return;
        }
        unionFields(data, link, ["Scale9OriginX", "Scale9OriginY", "Scale9Width", "Scale9Height"], 0);
    }
    
    function swapColor(data, link, newLink) {
        const color = MathUtil.convertToColor(data, link);

        if (color === -1) {
            return;
        }

        delete data[link];
        data[newLink] = getColorIndex(color);
    }
    
    function swapPointToArray(data, link, newLink, defaultValue, isFloat = false, prefix = "") {
        let prevPoint = data[link];
    
        if (!prevPoint || Object.keys(prevPoint).length === 0) {
            data[newLink] = defaultValue;
            delete data[link];
            return;
        }
    
        roundPoint(data, link, isFloat, prefix);
        data[newLink] = [prevPoint[prefix + "X"] || 0, prevPoint[prefix + "Y"] || 0];
    
        delete data[link];
    }
    
    function extractPointToArray(data, link, defaultValue, isFloat = false, prefix = "") {
        const point = extractValue(data, link, {});
        const result = [
            extractValue(point, prefix + "X", defaultValue),
            extractValue(point, prefix + "Y", defaultValue)
        ];
        const dimCount = result.length;
        const multiplier = isFloat ? CONSTANT.MAX_PERCENT : 1;
        for (let i = 0; i < dimCount; ++i) {
            result[i] = Math.round(result[i] * multiplier);
        } 
        return result
    }
    
    function unionDimension(data, link, posLink, sizeLink, defaultPos, defaultSize, isFloat) {
        const position = extractPointToArray(data, posLink, defaultPos, isFloat);
        const size = extractPointToArray(data, sizeLink, defaultSize, isFloat);
        data[link] = position.concat(size);
    }
    
    function roundPoint(data, link, isFloat = false, prefix = "") {
        if (!data.hasOwnProperty(link)) {
            return;
        }
    
        var point = data[link];
        roundElement(point, prefix + "X", isFloat);
        roundElement(point, prefix + "Y", isFloat);
    }
    
    function roundElement(data, link, isFloat = false) {
        if (!data.hasOwnProperty(link)) {
            return;
        }
    
        data[link] = !isFloat ? Math.round(data[link]) :  Math.round(data[link] * CONSTANT.MAX_PERCENT);
    }
    
    function updateContentData(data, link) {
        if (!data.hasOwnProperty(link)) {
            return;
        }
        let path = data[link]["Path"];
    
        path = updatePath(path, ".json");
        path = updatePath(path, ".ttf");
        path = updatePath(path, ".fnt");
    
        data[link] = path.split(".")[0];
    }
    
    function updatePath(path, suffix) {
    
        if (path.indexOf(suffix) !== -1) {
            const splitedPath = path.split("/");
            return splitedPath[splitedPath.length - 1];
        }
    
        return path;
    }
    
    function parseCustomComponents(data) {
        if (!data.hasOwnProperty("UserData"))  {
            return;
        }
    
        const userDataString = data["UserData"];
        const userDataSplitted = userDataString.split(" ");
        const splitCount = userDataSplitted.length;
        const userData = {};
        let splitData, i;
    
        for (i = 0; i < splitCount; ++i) {
            splitData = userDataSplitted[i].split(":");
            userData[splitData[0]] = splitData[1];
        }
    
        switch (userData["NAME"]) {
            case "TOGGLE_BUTTON": {
                data.type = "ToggleButton";
    
                let selected = extractChild(data, "btnSelected");
                let deselected = extractChild(data, "btnDeselected");
    
                data.fileData = deselected.fileData.concat(selected.fileData);
                data.content = selected.content;
                data.slice9 = selected.slice9;
                data.children = selected.children;
                break;
            }
            case "PROGRESS_BAR": {
                data.type = "ProgressBar";
                addTextures(data, "FileData");
                extractClipping(data, userData);
                extractDirection(data, userData);
                break;
            }
            case "SLIDER": {
                data.type = "Slider";
                addTextures(data, "FileData");
                extractClipping(data, userData);
                extractDirection(data, userData);
                data.content = extractChild(data, "btnBall");
                break;
            }
            case "CHECK_BOX": {
                data.type = "CheckBox"; 
    
                generateOverFrame(data, "NormalFileData", "OverFileData");
                addTextures(data, ["NormalFileData", "PressedFileData", "OverFileData", "DisabledFileData"]);
    
                data.content = extractChild(data, "btnIcon");
                break;
            }
            case "LABEL": {
                data.autoSize = parseInt(userData["AUTO_SIZE"] || 0, 10);
                data.letterSpacing = parseInt(userData["LETTER_SPACING"] || 0, 10);
                break;
            }
        }
    }
    
    function extractClipping(data, userData) {
        const type = extractValue(userData, "TYPE", "SIZE");
        data.clipped = type === "CLIP";
    }
    
    function extractDirection(data, userData) {
        const direction = extractValue(userData, "DIRECTION", "LEFT");
        switch (direction) {
            case "LEFT": {
                data.fileData.push(DIRECTION.LEFT);
                break;
            }
            case "RIGHT": {
                data.fileData.push(DIRECTION.RIGHT);
                break;
            }
            case "DOWN": {
                data.fileData.push(DIRECTION.DOWN);
                break;
            }
            case "UP": {
                data.fileData.push(DIRECTION.UP);
                break;
            }
        }
    }
    
    function updateByType(data) {
        
        switch (data["type"]) {
            case "PanelObjectData":  {
                if (data["colliderVisible"] || data["FileData"]) {
                    data.fileData = [];
                    data["type"] = UI_ELEMENT.PANEL;
                    if (data["FileData"]) {
                        addTextures(data, "FileData");
                        data.fileData.push(PANEL_GRAPHIC_TYPE.SPRITE);
                        data.fileData.push(getColorIndex(CONSTANT.COLOR_WHITE));
                        data.fileData.push(CONSTANT.MAX_PERCENT);
                    }
                    else {
                        const alpha = MathUtil.channelToPercent(extractValue(data, "BackColorAlpha", 0));
                        data.fileData.push(-1);
                        data.fileData.push(PANEL_GRAPHIC_TYPE.COLOR);
                        data.fileData.push(data["panelColor"] || getColorIndex(CONSTANT.COLOR_WHITE));
                        data.fileData.push(alpha);
                    }
                    data.name = "pnl" + data.name;
                }
                else {
                    data["type"] = UI_ELEMENT.WIDGET;
                    data.name = "wgt" + data.name;
                }
                break;
            }
            case "ImageViewObjectData": {
                data["type"] = UI_ELEMENT.IMAGE_VIEW;
                addTextures(data, "FileData");
                data.name = "img" + data.name;
                break;
            } 
            case "LayerObjectData": {
                data["type"] = UI_ELEMENT.WIDGET;
                data.name = "wgt" + data.name;
                break;
            }
            case "ProjectNodeObjectData": {
                data["type"] = UI_ELEMENT.UI_ELEMENT;
                data.fileData = [getComponentNameIndex(data, "FileData")];
                data.name = "uie" + data.name;
                break;
            }
            case "TextObjectData": {
                data["type"] = UI_ELEMENT.LABEL;
                data.name = "txt" + data.name;
    
                const fontStyle = createFontStyle();
    
                let align;
    
                align = extractValue(data, "HorizontalAlignmentType", "HT_Left");
    
                switch (align) {
                    case "HT_Left": {
                        fontStyle.align[0] = HORIZONTAL_ALIGN.LEFT;
                        break;
                    }
                    case "HT_Center": {
                        fontStyle.align[0] = HORIZONTAL_ALIGN.CENTER;
                        break;
                    }
                    case "HT_Right": {
                        fontStyle.align[0] = HORIZONTAL_ALIGN.RIGHT;
                        break;
                    }
                }
    
                align = extractValue(data, "VerticalAlignmentType", "VT_Top");
    
                switch (align) {
                    case "VT_Top": {
                        fontStyle.align[1] = VERTICAL_ALIGN.TOP;
                        break;
                    }
                    case "VT_Center": {
                        fontStyle.align[1] = VERTICAL_ALIGN.MIDDLE;
                        break;
                    }
                    case "VT_Bottom": {
                        fontStyle.align[1] = VERTICAL_ALIGN.BOTTOM;
                        break;
                    }
                }
    
                fontStyle.name = getFontIndex(data,"FontResource");
                fontStyle.size = extractValue(data, "fontSize", 0);
                fontStyle.color = data["tint"];
    
                const outlineEnabled = extractValue(data, "OutlineEnabled", false);
                if (outlineEnabled) {
                    fontStyle.outlineColor = extractValue(data, "outlineColor", WHITE_COLOR_INDEX);
                    fontStyle.outlineSize = extractValue(data, "OutlineSize", 1);
                }
    
                const shadowEnabled = extractValue(data, "ShadowEnabled", false);
                if (shadowEnabled) {
                    fontStyle.shadowColor = extractValue(data, "shadowColor", WHITE_COLOR_INDEX);
                    fontStyle.shadowOffset = [
                        extractValue(data, "ShadowOffsetX", 0),
                        -extractValue(data, "ShadowOffsetY", 0)
                    ];
                }
    
                data.fileData = [
                    getFontStyleIndex(fontStyle),
                    getTextIndex(data["LabelText"]),
                    data.autoSize || 0,
                    data.letterSpacing || 0
                ];

                delete data["tint"];
    
                break;
            }
            case "TextFieldObjectData": {
                data.type = UI_ELEMENT.TEXT_FIELD;
                data.name = "txt" + data.name;
    
                const fontStyle = createFontStyle();
                const placeHolderText = extractValue(data, "PlaceHolderText", "");
                const placeHolderIndex = placeHolderText === "" ? -1 : getTextIndex(placeHolderText);
                const textFieldStyle = {
                    placeHolderText: placeHolderIndex,
                    maxLength: extractValue(data, "MaxLengthText", -1),
                    passwordMode: extractValue(data, "PasswordEnable", -1),
                    passwordChar: getTextIndex(extractValue(data, "PasswordStyleText", "*")),
                };
    
                let index = -1;
                const styleCount = bundle.textFieldStyles.length;
                const styleString = JSON.stringify(textFieldStyle);
    
                for (let i = 0; i < styleCount; ++i) {
                    if (styleString === JSON.stringify(bundle.fontStyles[i])) {
                        index = i;
                        break;
                    }
                }
    
                if (index === -1) {
                    index = styleCount;
                    bundle.textFieldStyles.push(textFieldStyle);
                }
    
                fontStyle.name = getFontIndex(data,"FontResource");
                fontStyle.size = extractValue(data, "fontSize", 0);
                fontStyle.color = data["tint"];
                data.fileData = [
                    getFontStyleIndex(fontStyle), 
                    getTextIndex(data["LabelText"]),
                    index,
                    data.autoSize || 0,
                    data.letterSpacing || 0
                ];

                delete data["tint"];
                
                break;
            }
            case "ToggleButton": {
                data.type = UI_ELEMENT.TOGGLE_BUTTON;
                data.interactive = true;
                data.name = "tgb" + data.name;
                break;
            }
            case "LoadingBarObjectData": {
                data.type = UI_ELEMENT.PROGRESS_BAR;
                addTextures(data, "ImageFileData");
                const direction = extractValue(data, "ProgressType", "Left_To_Right");
                data.fileData.push(direction === "Right_To_Left" ? DIRECTION.RIGHT : DIRECTION.LEFT);
                data.clipped = true;
                data.name = "pgb" + data.name;
                break;
            }
            case "ButtonObjectData": {
                data["type"] = UI_ELEMENT.BUTTON;
                data.name = "btn" + data.name;
    
                generateOverFrame(data, "NormalFileData", "OverFileData");
                addTextures(data, ["NormalFileData", "PressedFileData", "OverFileData", "DisabledFileData"]);
    
                const position = [data.dimensions[2] >> 1, data.dimensions[3] >> 1];
    
                if (data["ButtonText"] && data["ButtonText"] !== "") {
                    const content = generateDefaultTemplate();
                    const fontStyle = createFontStyle();
    
                    fontStyle.name = getFontIndex(data, "FontResource");
                    fontStyle.size = extractValue(data, "fontSize", 0);
                    fontStyle.color = extractValue(data, "textColor", WHITE_COLOR_INDEX);
                    fontStyle.align = [
                        HORIZONTAL_ALIGN.CENTER,
                        VERTICAL_ALIGN.MIDDLE
                    ];
                    content.fileData = [getFontStyleIndex(fontStyle), getTextIndex(data["ButtonText"]), 0, 0];
                    content.name = "txtTitle";
                    content.dimensions = [position[0], position[1], data.dimensions[2], data.dimensions[3]];
                    content.preDimension = [CONSTANT.HALF_PERCENT, CONSTANT.HALF_PERCENT, CONSTANT.MAX_PERCENT, CONSTANT.MAX_PERCENT];
                    content.scale = null;
                    content.anchor = getAnchorIndex(ANCHOR_CENTER);
                    content.margin = [0, 0, 0, 0];
                    content.percent = [true, true, true, true];
                    content.type = UI_ELEMENT.LABEL;
    
                    data.content = content;
                }
                else {
                    data.content = extractChild(data, "txtTitle");
                }
    
                deleteFields(
                    data, [
                        "ButtonText",
                        "shadowColor", "outlineColor", "ShadowOffsetY", "ShadowOffsetX"
                    ]
                );
                break;
            }
            case "SliderObjectData": {
                data["type"] = UI_ELEMENT.SLIDER;
                data.name = "sld" + data.name;
    
                if (data["ProgressBarData"].indexOf("transparentFrame") === -1) {
                    addTextures(data, "ProgressBarData");
                }
                else {
                    data.fileData = [-1];
                }
    
                const content = generateDefaultTemplate();
    
                data.fileData.push(DIRECTION.LEFT);
    
                moveFields(data, content, ["BallNormalData", "BallPressedData", "BallDisabledData"]);
                generateOverFrame(content, "BallNormalData", "BallOverFileData");
                addTextures(content, ["BallNormalData", "BallPressedData", "BallOverFileData", "BallDisabledData"]);
    
                content.name = "btnBall";
                content.type = UI_ELEMENT.BUTTON;
                data.content = content;
    
                break;
            }
            case "SpriteObjectData": {
                data.name = "spt" + data.name;
                addTextures(data, "FileData");
                data.type = UI_ELEMENT.SPRITE;
                break;
            }
            case "SingleNodeObjectData": {
                data.name = "con" + data.name;
                data.type = UI_ELEMENT.CONTAINER;
                break;
            }
            case "TextBMFontObjectData": {
                data.name = "txt" + data.name;
                data.type = UI_ELEMENT.LABEL;
    
                const fontStyle = createFontStyle();
                fontStyle.name = getFontIndex(data, "LabelBMFontFile_CNB");
                fontStyle.size = bundle.fontData[fontStyle.name].size;
                fontStyle.color = data["tint"];
                fontStyle.align = [ HORIZONTAL_ALIGN.CENTER, VERTICAL_ALIGN.MIDDLE];
    
                data.fileData = [getFontStyleIndex(fontStyle), getTextIndex(data["LabelText"])];

                delete data["tint"];
    
                break;
            }
            case "CheckBoxObjectData": {
                data.name = "chb" + data.name;
                generateOverFrame(data, "NormalBackFileData", "OverBackFileData");
                addTextures(data, ["NormalBackFileData","PressedBackFileData", "OverBackFileData", "DisableBackFileData"]);
    
                const content = generateDefaultTemplate();
                
                moveFields(data, content, ["NodeNormalFileData", "NodeDisableFileData"]);
                cloneField(content, "NodeNormalFileData", "NodePressedFileData");
                cloneField(content, "NodeNormalFileData", "NodeOverFileData");
                addTextures(content, ["NodeNormalFileData","NodePressedFileData", "NodeOverFileData", "NodeDisableFileData"]);
                
                content.anchor = getAnchorIndex(ANCHOR_CENTER);
                content.dimensions = [
                    data.dimensions[2] >> 1,
                    data.dimensions[3] >> 1,
                    data.dimensions[2], data.dimensions[3]
                ];
                content.preDimensions = [CONSTANT.HALF_PERCENT, CONSTANT.HALF_PERCENT, -1, -1];
                content.percent = [true, true, false, false];
                content.name = "btnIcon";
                data.type = UI_ELEMENT.CHECK_BOX;
                data.content = content;
                break;
            }
            case "ScrollViewObjectData": {
                data.name = "scv" + data.name;
                data.type = UI_ELEMENT.SCROLL_VIEW;
                data.fileData = [];
                if (data["FileData"]) {
                    addTextures(data, "FileData");
                    data.fileData.push(PANEL_GRAPHIC_TYPE.SPRITE);
                    data.fileData.push(getColorIndex(CONSTANT.COLOR_WHITE));
                    data.fileData.push(CONSTANT.MAX_PERCENT);
                }
                else {
                    data.fileData.push(-1);
                    const solidData = extractValue(data, "colliderVisible", 0);
                    const alpha = MathUtil.channelToPercent(extractValue(data, "BackColorAlpha", 0));
                    data.fileData.push(solidData ? PANEL_GRAPHIC_TYPE.COLOR : PANEL_GRAPHIC_TYPE.NONE);
                    data.fileData.push(data["panelColor"] || getColorIndex(CONSTANT.COLOR_WHITE));
                    data.fileData.push(alpha);
                }
    
                const innerNodeSize = extractValue(data, 'InnerNodeSize', {});
                data.content = generateDefaultTemplate();
                data.content.dimensions[2] = extractValue(innerNodeSize, "Width", data.dimensions[2]);
                data.content.dimensions[3] = extractValue(innerNodeSize, "Height", data.dimensions[3]);
    
                const scrollDirection = extractValue(data, "ScrollDirectionType", "Vertical_Horizontal");
    
                switch (scrollDirection) {
                    case "Vertical": {
                        data.fileData.push(SCROLL_DIRECTION.VERTICAL);
                        break;
                    }
                    case "Horizontal": {
                        data.fileData.push(SCROLL_DIRECTION.HORIZONTAL);
                        break;
                    }
                    default: {
                        data.fileData.push(SCROLL_DIRECTION.BOTH);
                        break;
                    }
                }

                data.fileData.push(data.IsBounceEnabled ? 1 : 0);

                break;
            }
            case "ListViewObjectData": {
                data.name = "ltv" + data.name;
                data.type = UI_ELEMENT.LIST_VIEW;
                data.fileData = [];
                if (data["FileData"]) {
                    addTextures(data, "FileData");
                    data.fileData.push(PANEL_GRAPHIC_TYPE.SPRITE);
                    data.fileData.push(getColorIndex(CONSTANT.COLOR_WHITE));
                    data.fileData.push(CONSTANT.MAX_PERCENT);
                }
                else {
                    data.fileData.push(-1);
                    const solidData = extractValue(data, "colliderVisible", 0);
                    const alpha = MathUtil.channelToPercent(extractValue(data, "BackColorAlpha", 0));
                    data.fileData.push(solidData ? PANEL_GRAPHIC_TYPE.COLOR : PANEL_GRAPHIC_TYPE.NONE);
                    data.fileData.push(data["panelColor"] || getColorIndex(CONSTANT.COLOR_WHITE));
                    data.fileData.push(alpha);
                }
    
                const innerNodeSize = extractValue(data, 'InnerNodeSize', {});
                data.content = generateDefaultTemplate();
                data.content.dimensions[2] = extractValue(innerNodeSize, "Width", data.dimensions[2]);
                data.content.dimensions[3] = extractValue(innerNodeSize, "Height", data.dimensions[3]);
    
                const scrollDirection = extractValue(data, "DirectionType", "Horizontal");
    
                switch (scrollDirection) {
                    case "Vertical": {
                        data.fileData.push(SCROLL_DIRECTION.VERTICAL);
                        break;
                    }
                    default: {
                        data.fileData.push(SCROLL_DIRECTION.HORIZONTAL);
                        break;
                    }
                }
    
                data.fileData.push(extractValue(data, "ItemMargin", 0));
                data.fileData.push(data.IsBounceEnabled ? 1 : 0);
                break;
            }
            case "Slider": {
                data.name = "sld" + data.name;
                data.type = UI_ELEMENT.SLIDER;
                break;
            }
            case "ProgressBar": {
                data.name = "pgb" + data.name;
                data.type = UI_ELEMENT.PROGRESS_BAR;
                break;
            }
            case "CheckBox": {
                data.name = "chb" + data.name;
                data.type = UI_ELEMENT.CHECK_BOX;
                break;
            }
            case "TextAtlasObjectData": {
                data.name = "txt" + data.name;
                const textureIndex = MathUtil.getTextureIndex(data["LabelAtlasFileImage_CNB"], bundle);
                let atlasFontIndex = -1;
                let atlasFontCount = bundle.atlasFonts.length;
                let i, atlasFont;
    
                for (i = 0; i < atlasFontCount; ++i) {
                    atlasFont = bundle.atlasFonts[i];
                    if (atlasFont.texture === textureIndex) {
                        atlasFontIndex = i;
                        break;
                    }
                }
    
                if (atlasFontIndex !== -1) {
                    data.fileData = [atlasFontIndex];
                }
                else {
                    data.fileData = [atlasFontCount];
                    const charWidth = extractValue(data, "CharWidth", 0);
                    bundle.atlasFonts.push({
                            texture: textureIndex,
                            dotWidth: Math.floor(charWidth / 4),
                            size: [
                                charWidth,
                                extractValue(data, "CharHeight", 0)
                            ]
                    });
                }
                data.fileData.push(
                    getTextIndex(data["LabelText"]),
                    data.autoSize || 0,
                    data.letterSpacing || 0
                );
                data.type = UI_ELEMENT.ATLAS_LABEL;
                break;
            }
            default: {
                console.log(data["type"]);
                break;
            }
        }
    }
    
    function extractChild(data, childName) {
        const children = data.children;
    
        if (!children) {
            return null;
        }
    
        const childCount = children.length;
        let child, i;
    
        for (i = 0; i < childCount; ++i) {
            child = children[i];
            if (child.name === childName) {
                children.splice(i, 1);
                return child;
            }
        }
    
        return null;
    }
    
    function generateOverFrame(data, upLink, overLink) {
        const splitedUp = data[upLink].split("/");
        splitedUp[splitedUp.length - 1] = "over";
        data[overLink] = splitedUp.join("/");
    }
    
    function generateDefaultTemplate() {
        return {
            anchor: getAnchorIndex([0, 0]),
            children: null,
            clipped: false,
            content: null,
            dimensions: [0,0,-1,-1],
            scale: null,
            rotation: null,
            flip: null,
            margin: null,
            name: "default",
            interactive: false,
            alpha: CONSTANT.MAX_PERCENT,
            type: 0,
            tint: getColorIndex(CONSTANT.COLOR_WHITE),
            slice9: null,
            stretch: null,
            edge: null,
            percent: null,
            fileData: null,
            preDimensions: [0, 0,CONSTANT.MAX_PERCENT,CONSTANT.MAX_PERCENT],
            visible: true,
            animations: null
        };
    }
    
    function getFontIndex(data, link) {
        const fontName = data[link];
        delete data[link];
        let index = bundle.fonts.indexOf(fontName);
        if (index === -1) {
            index = bundle.fonts.length;
            bundle.fonts.push(fontName);
        }
        return index;
    }
    
    function getComponentNameIndex(data, link) {
        const name = data[link];
        delete data[link];
        let index = bundle.componentNames.indexOf(name);
        if (index === -1) {
            index = bundle.componentNames.length;
            bundle.componentNames.push(name);
        }
        return index;
    }
    
    /**
     * @desc Union fields to array.
     * @param {Object} data
     * @param {string} link
     * @param {string[]} fields
     * @param {*} defaultValue
     * @param {boolean} [isRound = false]
     * @param {boolean} [isFloat = false]
     */
    
    function unionFields(data, link, fields, defaultValue, isRound = false, isFloat = false) {
        const fieldCount = fields.length;
        let isCustom = false; 
        const result = [];
        let i, value;
    
        for (i = 0; i < fieldCount; ++i) {
            value = extractValue(data, fields[i], defaultValue);
    
            if (isFloat) {
                value = Math.round(value * CONSTANT.MAX_PERCENT);
    
            }
            else if (isRound) {
                value = Math.round(value);
            }
    
            if (!isCustom && value !== defaultValue) {
                isCustom = true;
            }
            result.push(value);
        }
        data[link] = isCustom ? result : null;
    }
    
    /**
     * @desc Extract value from object.
     * @function
     * @param {Object} data
     * @param {string} link
     * @param {*} defaultValue
     * @returns {*}
     */
    
    function extractValue(data, link, defaultValue) {
        if (!data.hasOwnProperty(link)) {
            return defaultValue;
        }
        const result = data[link];
        delete data[link];
        return result;
    }
    
    /**
     * @desc Clone field in object
     * @function
     * @param {Object} data
     * @param {string} inputLink
     * @param {string} outputLink
     * @returns
     */
    
    function cloneField(data, inputLink, outputLink) {
        if (!data.hasOwnProperty(inputLink)) {
            return;
        }
        data[outputLink] = data[inputLink];
    }
    
    /**
     * @desc Move fields from one object to another
     * @function
     * @param {Object} input
     * @param {Object} output
     * @param {string | string[]} links
     */
    
    function moveFields(input, output, links) {
        if (typeof links === "string") {
            links = [links];
        }
    
        const linkCount = links.length;
        let i, link;
    
        for (i = 0; i < linkCount; ++i) {
            link = links[i];
    
            if (!input.hasOwnProperty(link)) {
                continue;
            }
            output[link] = input[link];
            delete input[link];
        }
    }
    
    /**
     * @desc Add texture frames to cache, generate texture links, remove old fields.
     * @function
     * @param {Object} data
     * @param {string | string[]} linkArray
     */
    
    function addTextures(data, linkArray) {
        if (!data.fileData) {
            data.fileData = [];
        }
    
        if (typeof linkArray === "string") {
            linkArray = [linkArray];
        }
    
        const linkCount = linkArray.length;
        let i, link, value;
    
        for (i = 0; i < linkCount; ++i) {
            link = linkArray[i];
            value = data[link];
            
            if (value) {
                data.fileData.push(MathUtil.getTextureIndex(value, bundle));
            }
    
            delete data[link];
        }
    }
    
    /**
     * @desc Create font style.
     * @function
     * @returns
     */
    
    function createFontStyle() {
        return {
            name: -1,
            size: 0,
            color: WHITE_COLOR_INDEX, 
            align: [
                HORIZONTAL_ALIGN.LEFT,
                VERTICAL_ALIGN.TOP
            ],
            shadowColor: WHITE_COLOR_INDEX,
            shadowOffset: [0, 0],
            outlineColor: WHITE_COLOR_INDEX,
            outlineSize: 0
        };
    } 
    
    /**
     * @desc Returns anchor point index.
     * @function
     * @param {int[]} anchor
     * @returns {int}
     */
    
    function getAnchorIndex(anchor) {
        const anchorCount = bundle.anchors.length;
        let crtAnchor, i;
    
        for (i = 0; i < anchorCount; ++i) {
            crtAnchor = bundle.anchors[i];
            if (crtAnchor[0] === anchor[0] && crtAnchor[1] === anchor[1]) {
                return i;
            }
        }
    
        bundle.anchors.push(anchor);
        return bundle.anchors.length - 1;
    }
    
    function getColorIndex(color) {
        let index = bundle.colors.indexOf(color);
        if (index === -1) {
            index = bundle.colors.length;
            bundle.colors.push(color);
        }
        return index;
    }
    
    /**
     * @desc Delete fields from object.
     * @function
     * @param {Object} data
     * @param {string[]} fields
     */
    
    function deleteFields(data, fields) {
        const fieldCount = fields.length;
        for (let i = 0; i < fieldCount; ++i) {
            delete data[fields[i]];
        }
    }
    
    
    /**
     * @desc Returns text index.
     * @function
     * @param {string} text
     * @returns {int}
     */
    
    function getTextIndex(text) {
        const textLength = text.length;
        //Workaround for chines crap code
        if(text.lastIndexOf("\n") === textLength - 1) {
            text = text.substring(0, textLength - 1);
        }
        let index = bundle.texts.indexOf(text);
        if (index === -1) {
            index = bundle.texts.length;
            bundle.texts.push(text);
        }
        return index;
    }
    
    /**
     * @desc Returns element index.
     * @function
     * @param {string} name
     * @returns {int}
     */
    
    function getElementNameIndex(name) {
        let index = bundle.elementNames.indexOf(name);
        if (index === -1) {
            index = bundle.elementNames.length;
            bundle.elementNames.push(name);
        }
        return index;
    }
};
