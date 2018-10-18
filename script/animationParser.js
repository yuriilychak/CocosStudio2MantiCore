const ACTION_TYPE = {
    NONE: 0,
    POSITION: 1,
    SCALE: 2,
    ROTATION: 3,
    SKEW: 4,
    TINT: 5,
    ALPHA: 6,
    VISIBLE: 7,
    FRAME: 8,
    DELAY: 9
};


let fps;

module.exports = function (bundleData) {
    const animationList = bundleData["AnimationList"];

    if (!animationList || animationList.length === 0) {
        return;
    }

    const animation = bundleData["Animation"];
    const objectData = bundleData["ObjectData"];

    fps = Math.round(60 * animation["Speed"]);
    const timeLines = animation["Timelines"];
    const timeLineCount = timeLines.length;
    const tagTimeLines = {};
    let actionTag, i, key, timeLine, type, frames, actionType, parsedFrames, x, y, easeData, points;

    for (i = 0; i < timeLineCount; ++i) {
        timeLine = timeLines[i];
        actionTag = timeLine["ActionTag"];
        type = timeLine["Property"];
        if (!tagTimeLines.hasOwnProperty(actionTag)) {
            tagTimeLines[actionTag] = {};
        }
        switch (type) {
            case "Position": {
                actionType = ACTION_TYPE.POSITION;
                break;
            }
            case "Scale": {
                actionType = ACTION_TYPE.SCALE;
                break;
            }
            case "CColor": {
                actionType = ACTION_TYPE.TINT;
                break;
            }
            case "Alpha": {
                actionType = ACTION_TYPE.ALPHA;
                break;
            }
            case "VisibleForFrame": {
                actionType = ACTION_TYPE.VISIBLE;
                break;
            }
            case "RotationSkew": {
                actionType = ACTION_TYPE.SKEW;
                break;
            }
        }

        frames = timeLine["Frames"];
        parsedFrames = frames.map(frame => {

            const data = [];
            let ease = null;

            switch (actionType) {
                case ACTION_TYPE.POSITION: {
                    data.push(roundElement(frame, "X"));
                    data.push(roundElement(frame, "Y"));
                    break;
                }
                case ACTION_TYPE.SCALE: {
                    data.push(roundElement(frame, "X", 1, 100));
                    data.push(roundElement(frame, "Y", 1, 100));
                    break;
                }
                case ACTION_TYPE.TINT: {
                    data.push(convertToColor(frame));
                    break;
                }
                case ACTION_TYPE.ALPHA: {
                    data.push(Math.round(frame["Value"] * 100 / 255));
                    break;
                }
                case ACTION_TYPE.VISIBLE: {
                    data.push(Math.round(frame["Value"] ? 1 : 0));
                    ease = null;
                    break;
                }
                case ACTION_TYPE.SKEW: {
                    x = roundElement(frame, "X");
                    y = roundElement(frame, "Y");

                    if (x !== y) {
                        data.push(360 - x);
                        data.push(y);
                    }
                    else {
                        data.push(x);
                        data.push(y);
                    }
                    break;
                }
            }

            if (actionType !== ACTION_TYPE.VISIBLE) {
                easeData = frame["EasingData"];
                const id = easeData["Type"];
                if (id === -1) {
                    points = easeData["Points"];
                    if (points) {
                        ease = [];
                        points.forEach(point =>
                        {
                            ease.push(roundElement(point, "X", 0, 100));
                            ease.push(roundElement(point, "Y", 0, 100));
                        });
                    }
                }
                else {
                    ease = [id];
                }
            }

            return {
                type: actionType,
                index: frame["FrameIndex"],
                data: data,
                ease: ease
            };
        });

        tagTimeLines[actionTag][actionType] = parsedFrames;
    }

    let ownerTimeLine, owner;

    for (key in tagTimeLines)  {
        if (!tagTimeLines.hasOwnProperty(key)) {
            continue;
        }

        actionTag = parseInt(key, 10);
        ownerTimeLine = tagTimeLines[key];
        owner = findOwner(actionTag, objectData);
        generateAnimations(owner, ownerTimeLine, animationList);
    }

    objectData.animations = animationList.map(animation => {
        const result = createAnimationData(animation);
        result.frames = [{
            type: ACTION_TYPE.DELAY,
            index: result.length - 1,
            data: null,
            ease: null
        }];
        return result;
    });

};

function generateAnimations(owner, timeLines, animations) {
    const startPos = [roundElement(owner["Position"], "X"), roundElement(owner["Position"], "Y")];
    const startScale = [roundElement(owner["Scale"], "Y", 1, 100), roundElement(owner["Scale"], "X", 1, 100)];
    const rotation = [roundElement(owner, "RotationSkewX"), roundElement(owner, "RotationSkewY")];

    if (rotation[0] !== rotation[1]) {
        rotation[0] = 360 - rotation[0];
    }

    const animationCount = animations.length;
    let i, j, animation, startIndex, endIndex, filteredCount, newFrame,
        animationData, key, frames, filteredFrames, prevFrame, frame;

    for (i = 0; i < animationCount; ++i) {
        animation = animations[i];
        startIndex = animation["StartIndex"];
        endIndex = animation["EndIndex"];
        animationData = createAnimationData(animation);

        for (key in timeLines) {
            if (!timeLines.hasOwnProperty(key)) {
                continue;
            }

            frames = timeLines[key];
            filteredFrames = frames.filter(frame => frame.index >= startIndex && frame.index <= endIndex);
            filteredCount = filteredFrames.length;
            prevFrame = null;

            for (j = 0; j < filteredCount; ++j) {
                frame = filteredFrames[j];

                newFrame = JSON.parse(JSON.stringify(frame));
                newFrame.index = newFrame.index - startIndex;

                switch(newFrame.type) {
                    case ACTION_TYPE.POSITION: {
                        if (prevFrame === null) {
                            prevFrame = {data: startPos};
                        }
                        newFrame.data[0] -= prevFrame.data[0];
                        newFrame.data[1] = prevFrame.data[1] - newFrame.data[1];
                        prevFrame = frame;
                        break;
                    }
                    case ACTION_TYPE.SCALE: {
                        if (prevFrame === null) {
                            prevFrame = {data: startScale};
                        }
                        newFrame.data[0] -= prevFrame.data[0];
                        newFrame.data[1] -= prevFrame.data[1];
                        prevFrame = frame;
                        break;
                    }
                    case ACTION_TYPE.SKEW: {
                        if (prevFrame === null) {
                            prevFrame = {data: rotation};
                        }
                        newFrame.data[0] -= prevFrame.data[0];
                        newFrame.data[1] -= prevFrame.data[1];
                        prevFrame = frame;
                        break;
                    }
                    default: {
                        break;
                    }
                }
                animationData.frames.push(newFrame);
            }
        }
        if (animationData.frames.length !== 0) {
            if (!owner.animations) {
                owner.animations = [];
            }
            owner.animations.push(animationData);
        }
    }
}

/**
 * @param {Object} animation
 * @returns {{name: string, length: int, frames: Object[]}}
 */

function createAnimationData(animation) {
    return  {
        name: animation["Name"],
        length: animation["EndIndex"] - animation["StartIndex"] + 1,
        frames: [],
        fps: fps
    };
}

/**
 * @desc Find
 * @param {int} actionTag
 * @param {Object} data
 * @returns {Object | null}
 */

function findOwner(actionTag, data) {
    if (data["ActionTag"] === actionTag) {
        return data;
    }

    const children = data["Children"] || [];
    const childCount = children.length;

    if (childCount === 0) {
        return null;
    }

    let i, child, target;

    for (i = 0; i < childCount; ++i) {
        child = children[i];

        target = findOwner(actionTag, child);
        if (target !== null) {
            return target;
        }
    }

    return null;
}


function roundElement(data, link, defaultValue = 0, multiplier = 1) {
    return Math.round(getProperty(data, link, defaultValue) * multiplier);
}

/**
 *
 * @param {Object} data
 * @returns {int}
 */

function convertToColor(data) {
    const color = data["Color"];
    const MAX_CHANNEL = 255;
    const r = getProperty(color, "R", MAX_CHANNEL);
    const g = getProperty(color, "G", MAX_CHANNEL);
    const b = getProperty(color, "B", MAX_CHANNEL);
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