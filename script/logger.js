/**
 * @desc Log step messages
 * @function
 * @param {...*} var_args
 */

function logMessage(var_args) {
    const argumentCount = arguments.length;
    let result;

    if (argumentCount === 1) {
        result = arguments[0];
    }
    else {
        const template = "{0}";
        result = arguments[0];
        for (let i = 1; i < argumentCount; ++i) {
            result = result.replace(template.replace("0", i - 1), arguments[i].toString());
        }
    }
    console.log(result);
}

module.exports = {
    logMessage
};