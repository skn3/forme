'use strict';

//local imports
const FormeError = require('./errors').FormeError;

//functions
function configurableParamError(method, param, what) {
    return new FormeError(`configure method '${method.label}' param '${param.label}' ${what}`);
}

//classes
class FormeConfigurableMethod {
    constructor(method, overrides) {
        this.method = method;
        this.overrides = overrides;
    }

    //properties
    get label() {
        return this.method;
    }

    //api
    call(target, input) {
        //build the params we will call the method with
        const build = [];

        //iterate over all overrides until we find a match!
        let firstError = null;
        for(let override of this.overrides) {
            try {
                //build params, this is not strict yet but we do check requirement if param does not exist in input
                const params = override.params;

                //determine if input is actually the singally required param
                if (override.checkSingle(input)) {
                    //single param allowed
                    build.push(input);

                    //now fill build with the other default values
                    for(let index = 1; index < params.length;index++) {
                        //check that default value is defined
                        const value = params[index].defaultValue;
                        if (value === undefined) {
                            //default value is undefined so we break out of adding to build.
                            break;
                        }

                        //add
                        build.push(params[index].defaultValue);
                    }
                } else {
                    for (let index = 0; index < params.length; index++) {
                        const param = params[index];

                        //check if input has this param using the specified param.name(s)
                        const name = param.within(input);
                        if (name === null) {
                            //the param does not existing in the input...
                            if (param.required) {
                                //error!
                                throw configurableParamError(this, param, 'is required');
                            } else {
                                //use default
                                //check that default value is defined
                                const value = param.defaultValue;
                                if (value === undefined) {
                                    //default value is undefined so we break out of adding to build.
                                    break;
                                }

                                //add
                                build.push(param.defaultValue);
                            }
                        } else {
                            //input exists so lets add it
                            build.push(input[name]);
                        }
                    }
                }

                //validate and convert built params
                for (let index = 0; index < build.length; index++) {
                    const param = params[index];
                    const value = build[index];

                    //validate
                    param.validate(this, value);

                    //store back into build
                    build[index] = param.convert(value);
                }

                //at this point we should have a built array where ALL values have been validated and converted in to a flat array that matches teh length of the expected params

                //all good so do the call the method and prevent a) further execution b) any queued errors from throwing
                return target[this.method].apply(target, build);

            } catch(err) {
                //ok there was an error processing this particular override.
                //if this is the first error log it but keep trying further overrides...
                if (firstError === null) {
                    firstError = err;
                }
            }
        }

        //at this point we will always have an error because otherwise at least 1 override will have succeeded
        throw firstError;
    }
}

//override classes (override as in function/method override from other programming languages)
class FormeConfigurableOverride {
    constructor(params, single) {
        this.params = params;
        this.single = single;
        this.requiredParams = params.filter(param => param.required);
    }

    //api
    checkSingle(input) {
        if (this.single) {
            if (input && typeof input === 'object' && !Array.isArray(input)) {
                //deal with special object case (not arrays)
                return true;//always return true for this object because we have flagged

            } else {
                //otherwise the only requirement for single is that there is max 1 required param
                return this.requiredParams.length <= 1;
            }
        }

        //nope
        return false;
    }
}

//param classes
class FormeConfigurableParam {
    constructor(names, required, defaultValue=undefined) {
        this.names = names;
        this.required = required;
        this.defaultValue = defaultValue;
    }

    //properties
    get label() {
        if (Array.isArray(this.names)) {
            return `[${this.names.join('/')}]`;
        } else {
            return this.names;
        }
    }

    get emptyValues() {
        return [undefined, null];
    }

    //api
    within(input) {
        //find the name of param within input
        if (Array.isArray(this.names)) {
            for(let name of this.names) {
                if (input.hasOwnProperty(name)) {
                    return name;
                }
            }
        } else {
            if (input.hasOwnProperty(this.names)) {
                return this.names;
            }
        }

        //nope
        return null;
    }

    validate(method, value) {
        if (this.emptyValues.indexOf(value) !== -1 && this.required) {
            throw configurableParamError(this, param, 'is required');
        }
    }

    convert(value) {
        return value;
    }
}

class FormeConfigurableBool extends FormeConfigurableParam {
    //api
    convert(value) {
        return value !== 'false' && !!value;
    }
}

class FormeConfigurableInt extends FormeConfigurableParam {
    //api
    convert(value) {
        return Number(value);
    }
}

class FormeConfigurableFloat extends FormeConfigurableParam {
    //api
    convert(value) {
        return Number(value);
    }
}

class FormeConfigurableString extends FormeConfigurableParam {
    //api
    convert(value) {
        return String(value);
    }
}

class FormeConfigurableObject extends FormeConfigurableParam {
    //api
    convert(value) {
        if (value && typeof value === 'object') {
            return value;
        } else {
            return null;
        }
    }

    validate(method, value) {
        super.validate(method, value);

        if (value) {
            if (typeof value !== 'object') {
                throw configurableParamError(this, param, 'is not a valid object');
            }
        }
    }
}

class FormeConfigurableArray extends FormeConfigurableParam {
    //api
    convert(value) {
        if (Array.isArray(value)) {
            return value;
        } else {
            return null;
        }
    }
}

class FormeConfigurableCallbacks extends FormeConfigurableParam {
    //api
    validate(method, value) {
        super.validate(method, value);

        if (value) {
            if (Array.isArray(value)) {
                //multiple callbacks so they all must be valid!
                for (let callback of value) {
                    if (typeof callback !== 'function') {
                        throw configurableParamError(this, param, 'contains an invalid callback');
                    }
                }
            } else {
                //single callback
                if (typeof value !== 'function') {
                    throw configurableParamError(this, param, 'is not a valid callback');
                }
            }
        }
    }
}

class FormeConfigurableStrings extends FormeConfigurableParam {
    //api
    validate(method, value) {
        super.validate(method, value);

        if (value) {
            if (Array.isArray(value)) {
                //multiple callbacks so they all must be valid!
                for (let callback of value) {
                    if (typeof callback !== 'string') {
                        throw configurableParamError(this, param, 'contains an invalid string');
                    }
                }
            } else {
                //single callback
                if (typeof value !== 'string') {
                    throw configurableParamError(this, param, 'is not a valid string');
                }
            }
        }
    }
}

//expose
module.exports = {
    FormeConfigurableMethod: FormeConfigurableMethod,
    FormeConfigurableOverride: FormeConfigurableOverride,
    FormeConfigurableParam: FormeConfigurableParam,
    FormeConfigurableBool: FormeConfigurableBool,
    FormeConfigurableInt: FormeConfigurableInt,
    FormeConfigurableFloat: FormeConfigurableFloat,
    FormeConfigurableString: FormeConfigurableString,
    FormeConfigurableObject: FormeConfigurableObject,
    FormeConfigurableArray: FormeConfigurableArray,
    FormeConfigurableCallbacks: FormeConfigurableCallbacks,
    FormeConfigurableStrings: FormeConfigurableStrings,
};