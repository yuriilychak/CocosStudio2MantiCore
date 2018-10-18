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
const MAX_CHANNEL = 255;
const DEFAULT_FPS = 60;
const MAX_PERCENT = 100;
const MAX_ANGLE = 360;

module.exports = function (bundleData) {
    const animationList = bundleData["AnimationList"];

    if (!animationList || animationList.length === 0) {
        return;
    }

    const animation = bundleData["Animation"];
    const objectData = bundleData["ObjectData"];

    fps = Math.round(DEFAULT_FPS * animation["Speed"]);
    const timeLines = animation["Timelines"];
    const timeLineCount = timeLines.length;
    const tagTimeLines = {};
    let actionTag, i, key, timeLine, type, frames, actionType, parsedFrames, easeData, points;

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

            let data = [];
            let ease = null;

            switch (actionType) {
                case ACTION_TYPE.POSITION: {
                    data = convertToPointArray(frame, "X", "Y");
                    break;
                }
                case ACTION_TYPE.SCALE: {
                    data = convertToPointArray(frame, "X", "Y", 1, MAX_PERCENT);
                    break;
                }
                case ACTION_TYPE.TINT: {
                    data.push(convertToColor(frame));
                    break;
                }
                case ACTION_TYPE.ALPHA: {
                    data = [Math.round(frame["Value"] * MAX_PERCENT / MAX_CHANNEL)];
                    break;
                }
                case ACTION_TYPE.VISIBLE: {
                    data = [Math.round(frame["Value"] ? 1 : 0)];
                    break;
                }
                case ACTION_TYPE.SKEW: {
                    data = convertToPointArray(frame, "X", "Y");

                    if (data[0] !== data[1]) {
                        data[0] = MAX_ANGLE - data[0];
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
                        points.forEach(point => ease = ease.concat(convertToPointArray(point, "X", "Y", 0, MAX_PERCENT)));
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
    const startPos = convertToPointArray(owner["Position"], "X", "Y");
    const startScale = convertToPointArray(owner["Scale"], "Y", "X", 1, MAX_PERCENT);
    const rotation = convertToPointArray(owner, "RotationSkewX", "RotationSkewY");

    if (rotation[0] !== rotation[1]) {
        rotation[0] = MAX_ANGLE - rotation[0];
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
 *
 * @param {Object} data
 * @param {string} field1
 * @param {string} field2
 * @param {int} defaultValue
 * @param {int} multiplier
 * @returns {int[]}
 */

function convertToPointArray(data, field1, field2, defaultValue = 0, multiplier = 1) {
    return [
        roundElement(data, field1, defaultValue, multiplier),
        roundElement(data, field2, defaultValue, multiplier)
    ];
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