const CONSTANT = require("./constant");
const MathUtil = require("./mathUtil");

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

module.exports = function (bundleData, bundle) {
    const animationList = bundleData["AnimationList"];

    if (!animationList || animationList.length === 0) {
        return;
    }

    const animation = bundleData["Animation"];
    const objectData = bundleData["ObjectData"];

    fps = Math.round(CONSTANT.DEFAULT_FPS * animation["Speed"]);
    const timeLines = animation["Timelines"];
    const timeLineCount = timeLines.length;
    const tagTimeLines = {};
    const frameNames = [
        "Unknown",
        "Position",
        "Scale",
        "Rotation",
        "RotationSkew",
        "CColor",
        "Alpha",
        "VisibleForFrame",
        "FileData",
        "Delay"
    ];
    let actionTag, i, key, timeLine, type, frames, actionType, parsedFrames, easeData, points;

    for (i = 0; i < timeLineCount; ++i) {
        timeLine = timeLines[i];
        actionTag = timeLine["ActionTag"];
        type = timeLine["Property"];

        if (!tagTimeLines.hasOwnProperty(actionTag)) {
            tagTimeLines[actionTag] = {};
        }

        actionType = frameNames.indexOf(type);

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
                    data = convertToPointArray(frame, "X", "Y", 1, CONSTANT.MAX_PERCENT);
                    break;
                }
                case ACTION_TYPE.TINT: {
                    data.push(MathUtil.convertToColor(frame, "Color"));
                    break;
                }
                case ACTION_TYPE.ALPHA: {
                    data.push(MathUtil.channelToPercent(frame["Value"]));
                    break;
                }
                case ACTION_TYPE.VISIBLE: {
                    data.push(Math.round(frame["Value"] ? 1 : 0));
                    break;
                }
                case ACTION_TYPE.SKEW: {
                    data = convertToPointArray(frame, "X", "Y");

                    if (data[0] !== data[1]) {
                        data[0] = CONSTANT.MAX_ANGLE - data[0];
                    }
                    break;
                }
                case ACTION_TYPE.FRAME: {
                    data.push(MathUtil.getTextureIndex(frame["TextureFile"]["Path"].split(".")[0], bundle));
                    break;
                }
            }

            if (actionType !== ACTION_TYPE.VISIBLE &&  actionType !== ACTION_TYPE.FRAME) {
                easeData = frame["EasingData"];
                const id = easeData["Type"];
                if (id === -1) {
                    points = easeData["Points"];
                    if (points) {
                        ease = [];
                        points.forEach(point => ease = ease.concat(convertToPointArray(point, "X", "Y", 0, CONSTANT.MAX_PERCENT)));
                        ease.splice(0, 2);
                        ease.splice(3, 2);
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



        if (actionType === ACTION_TYPE.SKEW) {
            let isRotation = true;

            parsedFrames.forEach(frame => {
                if (frame.data[0] === frame.data[1]) {
                    return;
                }
                isRotation = false;
            });

            if (isRotation) {
                parsedFrames.forEach(frame => {
                    frame.type = ACTION_TYPE.ROTATION;
                    frame.data.pop();
                });
                actionType = ACTION_TYPE.ROTATION;
            }
        }

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
    const startScale = convertToPointArray(owner["Scale"], "Y", "X", 1, CONSTANT.MAX_PERCENT);
    const rotation = convertToPointArray(owner, "RotationSkewX", "RotationSkewY");

    if (rotation[0] !== rotation[1]) {
        rotation[0] = CONSTANT.MAX_ANGLE - rotation[0];
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
                        newFrame.data[0] /= prevFrame.data[0];
                        newFrame.data[1] /= prevFrame.data[1];
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
    return Math.round(MathUtil.getProperty(data, link, defaultValue) * multiplier);
}