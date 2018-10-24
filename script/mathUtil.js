const CONSTANT = require("./constant");

/**
 * @desc Convert value from [0..255] to [0..100]
 * @param {int} channel
 * @returns {int}
 */

function channelToPercent(channel) {
    return  Math.round(channel * CONSTANT.MAX_PERCENT / CONSTANT.MAX_CHANNEL);
}

/**
 * @desc Convert object to int color.
 * @param {Object} data
 * @param {string} link
 * @returns {int}
 */

function convertToColor(data, link) {
    if (!data.hasOwnProperty(link)) {
        return -1;
    }
    const color = data[link];
    const r = getProperty(color, "R", CONSTANT.MAX_CHANNEL);
    const g = getProperty(color, "G", CONSTANT.MAX_CHANNEL);
    const b = getProperty(color, "B", CONSTANT.MAX_CHANNEL);
    return (r << 16) + (g << 8) + b;
}

/**
 * @param {Object} data
 * @param {string} link
 * @param {*} defaultValue
 * @returns {*}
 */

function getProperty(data, link, defaultValue) {
    return data.hasOwnProperty(link) ? data[link] : defaultValue;
}

/**
 * @desc Add texture to cache, and returns index.
 * @function
 * @param {string} name
 * @returns {int}
 */

function getTextureIndex(name, bundle) {
    const decomposed = decomposeTexturePath(name, bundle);
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

function decomposeTexturePath(name, bundle) {
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


module.exports = {
    channelToPercent,
    convertToColor,
    getProperty,
    getTextureIndex
};