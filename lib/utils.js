'use strict';

//module imports
const crypto = require('crypto');
const url = require('url');
const querystring = require('querystring');
const _ = require('lodash');

//cyclic pattern
const utils = {};
module.exports = utils;

//local imports
const FormeError = require('./errors').FormeError;

//functions
function generateToken(size, errorFactory) {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(Math.ceil(size/2), (err, buffer) => {
            if (err) {
                if (errorFactory) {
                    return reject(errorFactory(err));
                } else {
                    return new FormeError(err);
                }
            } else {
                return resolve(buffer.toString('hex').slice(0, size));
            }
        });
    })
}

function getString(value) {
    if (typeof value === 'string') {
        return value;
    } else if(value === true) {
        return '1';
    } else if (value === false) {
        return '0';
    } else if (value === null || value === undefined) {
        return '';
    } else {
        if (Array.isArray(value)) {
            return value.join(',');
        } else if (typeof value === 'object') {
            return value.toString();
        } else {
            return '';
        }
    }
}

function upperCaseFirst(text) {
    if (typeof text === 'string' && text.length > 0) {
        return text.slice(0,1).toUpperCase()+text.slice(1);
    } else {
        return text;
    }
}

function getPathSegments(path) {
    return typeof path === 'string'?path.split('.'):path;
}

function mergeClassNames(value, classNames) {
    if (!classNames) {
        return value;

    } else if (Array.isArray(classNames)) {
        classNames = classNames.filter(className => !!className);
        if (classNames.length === 0) {
            return value;
        } else {
            return (value && value.length?value+' ':'')+classNames.join(' ');
        }
    } else {
        return (value && value.length?value+' ':'')+classNames;
    }
}

function mergeDontOverwriteWithNull() {
    return _.mergeWith(...arguments, (objValue, srcValue) => {
        if (srcValue === null && (objValue !== null && objValue !== undefined)) {
            return objValue;
        }
        //otherwise let lodash do its thang!
    });
}

function getValueList(options) {
    let list;

    if (options === undefined) {
        list = [];

    } else if (options instanceof Array) {
        //array of ?
        list = options;

    } else if (options instanceof Object) {
        //object with value/label pairs
        list = [];
        for (let value of Object.keys(options)) {
            list.push(options[value]);
        }

    } else {
        list = [options];
    }

    return list;
}

//url functions
function addQuery(path, values, escape) {
    const info = url.parse(path, false);
    const query = querystring.parse(info.query);
    escape = escape === undefined ? true : escape;

    //add and escape all existing query values that wont get overwritten
    const build = [];
    for (let key of Object.keys(query)) {
        if (query[key] !== undefined && values[key] === undefined) {
            build.push(querystring.escape(key) + '=' + querystring.escape(query[key]));
        }
    }

    //add values
    for (let key of Object.keys(values)) {
        if (escape) {
            build.push(querystring.escape(key) + '=' + querystring.escape(values[key]));
        } else {
            build.push(querystring.escape(key) + '=' + values[key]);
        }
    }

    //update info
    info.query = null;
    info.search = build.length === 0?'':'?' + build.join('&');
    return url.format(info);
}

function extractQuery(path) {
    const info = url.parse(path, false);
    return querystring.parse(info.query);
}

function removeQuery(path, keys) {
    const info = url.parse(path, false);
    const query = querystring.parse(info.query);

    const build = [];
    if (Array.isArray(keys)) {
        for (let key of Object.keys(query)) {
            if (keys.indexOf(key) === -1) {
                build.push(querystring.escape(key) + '=' + querystring.escape(query[key]));
            }
        }
    } else {
        for (let key of Object.keys(query)) {
            if (key !== keys) {
                build.push(querystring.escape(key) + '=' + querystring.escape(query[key]));
            }
        }
    }

    //update info
    info.query = null;
    info.search = build.length === 0?'':'?' + build.join('&');
    return url.format(info);
}

function containsQuery(path1, path2) {
    if (path1 === null || path2 === null) {
        return false;
    }

    const info1 = url.parse(path1, true);
    const info2 = url.parse(path2, true);

    for(let key2 of Object.keys(info2.query)) {
        if (info1.query[key2] === undefined) {
            return false;
        }
    }

    return true;
}

function urlPath(path) {
    //noinspection Annotator
    return url.parse(path).pathname || '';
}

function compareUrlPaths(path1, path2) {
    return urlPath(path1) === urlPath(path2);
}

//call functions
function callInvalid(context) {
    throw new Error(`invalid call to ${context}`);
}

function callUnsupported(context) {
    throw new Error(`unsupported call to ${context}`);
}

function callCheckInactive(form, context) {
    if (form && (form._request === null || !form._request._started)) {
        return true;
    }

    callInvalid(context);
}

function callCheckBuilding(form, context) {
    if (form && form._request !== null && form._request._building) {
        return true;
    }

    callInvalid(context);
}

function callCheckActive(form, context) {
    if (form && form._request !== null && form._request._started && !form._request._building) {
        return true;
    }

    callInvalid(context);
}

function callCheckNotInactive(form, context) {
    if (form && form._request !== null && (form._request._started || form._request._loading || form._request._reset)) {
        return true;
    }

    callInvalid(context);
}

function callCheckNotBuilding(form, context) {
    if (form && (form._request === null || !form._request._building)) {
        return true;
    }

    callInvalid(context);
}

function callCheckNotActive(form, context) {
    if (form && (!form._request || form._request._building)) {
        return true;
    }

    callInvalid(context);
}

//structure functions
function findPathInStructure(structure, path, defaultValue=undefined) {
    //skip
    if (!structure || typeof structure !== 'object') {
        return defaultValue;
    }

    if (!path || (Array.isArray(path) && path.length === 0)) {
        return structure;
    }

    //get segments
    const segments = getPathSegments(path);

    //iterate, following the path
    let pointer = structure;
    for(let index = 0; index < segments.length; index++) {
        const segment = segments[index];

        //update to next pointer and check it exists!
        if (pointer.__formeClass !== undefined) {
            //check for non iterable
            if (pointer.__formeClass === 'input') {
                return defaultValue;
            }

            //relocate pointer to the children container within pointer
            pointer = pointer.children;
        }

        //look for child!
        pointer = pointer[segment];
        if (pointer === undefined) {
            return defaultValue;
        }
    }

    //done
    return pointer;
}

//object functions
function addPathToObject(structure, path) {
    //this is not the same as the "group" stuff, its for building the value store

    //make sure we have a structure
    structure = structure || {};

    //get segments
    const segments = getPathSegments(path);

    //add segments
    let pointer = structure;
    for(let index = 0; index < segments.length;index++) {
        const segment = segments[index];
        let child = pointer[segment];

        //make sure its an object
        if (!child || typeof child !== 'object') {
            child = pointer[segment] = {};
        }

        //update pointer
        pointer = child;
    }

    //chain the pointer!
    return pointer;
}

function findPathInObject(structure, path, defaultValue=undefined) {
    //skip
    if (!structure || typeof structure !== 'object') {
        return defaultValue;
    }

    if (!path || (Array.isArray(path) && path.length === 0)) {
        return structure;
    }

    //get segments
    const segments = getPathSegments(path);

    //iterate, following the path
    let pointer = structure;
    for(let index = 0; index < segments.length; index++) {
        const segment = segments[index];

        //check current pointer to make sure the search can continue!
        if (!pointer || typeof pointer !=='object' || Array.isArray(pointer)) {
            return defaultValue;
        }

        //update to next pointer and check it exists!
        pointer = pointer[segment];
        if (pointer === undefined) {
            return defaultValue;
        }
    }

    //done
    return pointer;
}

//element functions
function createUniqueElementName(formName, segments) {
    return `__forme_element__${formName}__${segments.join('__')}`;
}

//expose
utils.string = {
    token: generateToken,
    upperCaseFirst: upperCaseFirst,
    merge: {
        classNames: mergeClassNames,
    },
};

utils.url = {
    addQuery: addQuery,
    removeQuery: removeQuery,
    containsQuery: containsQuery,
    path: urlPath,
    comparePaths: compareUrlPaths,
    extractQuery: extractQuery,
};

utils.call = {
    check: {
        inactive: callCheckInactive,
        building: callCheckBuilding,
        active: callCheckActive,
        not: {
            inactive: callCheckNotInactive,
            building: callCheckNotBuilding,
            active: callCheckNotActive,
        },
    },
    invalid: callInvalid,
    unsupported: callUnsupported,
};

utils.path = {
    segments: getPathSegments,
};

utils.structure = {
    find: {
        path: findPathInStructure,
    },
};

utils.object = {
    add: {
        path: addPathToObject,
    },
    find: {
        path: findPathInObject,
    },
};

utils.element = {
    create: {
        uniqueName: createUniqueElementName,
    },
};

utils.value = {
    string: getString,
    compare: _.isEqual,
    list: getValueList,
};

utils.merge = {
    dontOverwriteWithNull: mergeDontOverwriteWithNull,
    allowOverwriteWithNull: _.merge,
};

utils.clone = {
    deep: _.cloneDeep,
};