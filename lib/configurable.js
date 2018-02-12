'use strict';

//local imports
const FormeConfigurationError = require('./errors').FormeConfigurationError;

//classes
class FormeConfigurable {
    //api
    clone() {
        return new this.constructor();
    }
}

class FormeConfigurableMethodBase extends FormeConfigurable {
    //api
    clone(sourceProperty=null) {
        throw new FormeConfigurationError(`${this.constructor.name} must override the clone() method`);
    }
}

class FormeConfigurableMethod extends FormeConfigurableMethodBase {
    constructor(method, overrides, exporter=null, sourceProperty=null) {
        super();

        this.method = method;
        this.overrides = overrides;
        this.exporter = exporter;
        this.sourceProperty = sourceProperty || null;//when provided with a source object, this dictates the actual source by looking up a child property. If null, then the original source is used.
    }

    //properties
    get label() {
        return this.method;
    }

    get exports() {
        return !!this.exporter;
    }

    //api
    clone(sourceProperty=null) {
        //allow overriding the sourceProperty
        return new this.constructor(this.method, !this.overrides?undefined:this.overrides.map(override => override.clone()), !this.exporter?null:this.exporter.clone(), sourceProperty || this.sourceProperty);
    }

    source(source) {
        if (this.sourceProperty === null) {
            return source;
        } else {
            return source[this.sourceProperty];
        }
    }

    call(source, input) {
        //iterate over all overrides until we find a match!
        let firstError = null;
        for(let override of this.overrides) {
            try {
                //build params, this is not strict yet but we do check requirement if param does not exist in input
                const build = [];
                const params = override.params;

                //determine if input is actually the singly required param
                if (override.checkSingle(input)) {
                    //single param allowed, so lets extract it from input!
                    const param = override.params[0];

                    if (param.checkValueType(input)) {
                        //keep the value as is
                        build.push(input);

                    } else if (typeof input === 'object') {
                        //extract value from object, make sure that the override's strict policy matches teh input
                        if (override.checkStrictInput(input)) {
                            const name = param.within(input);
                            if (name !== null) {
                                build.push(input[name]);
                            }
                        } else {
                            //noinspection ExceptionCaughtLocallyJS
                            throw new FormeConfigurationError(this, null, 'contains invalid input data');
                        }
                    }

                    //just empty if we couldnt add it otherwise!
                    if (build.length === 0) {
                        build.push(undefined);
                    }

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
                    //multiple params, so we need to check incase teh override is flagged as requring strict input (eg cant contain ANY other properties other then specified)
                    //this is because we might have .foo(name, value) and .foo({name: '', value: '', other: ''}) overrides. In this scenario we should set the .foo(name, value)
                    //as strict, otherwise it will eat up the second override!
                    if (override.checkStrictInput(input)) {
                        for (let index = 0; index < params.length; index++) {
                            const param = params[index];

                            //check if input has this param using the specified param.name(s)
                            const name = param.within(input);
                            if (name === null) {
                                //the param does not existing in the input...
                                if (param.required) {
                                    //error!
                                    //noinspection ExceptionCaughtLocallyJS
                                    throw new FormeConfigurationError(this, param, 'is required');
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
                                //input exists so lets get the value
                                build.push(input[name]);
                            }
                        }
                    } else {
                        //error!
                        //noinspection ExceptionCaughtLocallyJS
                        throw new FormeConfigurationError(this, null, 'contains invalid input data');
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
                //we allow the target to be modified with the .source() method, but this does not alter the chain, we keep that as the original source!
                const target = this.source(source);
                const method = target[this.method];
                if (!method) {
                    //noinspection ExceptionCaughtLocallyJS
                    throw new FormeConfigurationError(this, null, `not found in '${target.formeClass}'`);
                }
                method.apply(target, build);

                //chain original source
                return source;

            } catch(err) {
                //ok there was an error processing this particular override.
                //if this is the first error log it but keep trying further overrides...
                if (err instanceof FormeConfigurationError) {
                    if (firstError === null) {
                        firstError = err;
                    }
                } else {
                    //this is not a configuration error (eg its a code error) so lets throw it!
                    throw err;
                }
            }
        }

        //at this point we will always have an error because otherwise at least 1 override will have succeeded
        throw firstError;
    }

    export(source) {
        return this.exporter.export(this.source(source));
    }
}

class FormeConfigurableMethodPointer extends FormeConfigurableMethodBase {
    constructor(pointer) {
        super();

        this.pointer = pointer;
    }

    //api
    clone(sourceProperty=null) {
        //ignore source property
        return new this.constructor(this.pointer);
    }
}

//override classes (override as in function/method override from other programming languages)
class FormeConfigurableOverride extends FormeConfigurable {
    constructor(params, single, strict=false) {
        super();

        this.params = params || [];
        this.single = single;//allow property input as "single" value
        this.strict = strict;//if there is extra data in the input, this override does not match when in strict mode!
        this.requiredParams = params.filter(param => param.required);
    }

    //api
    clone() {
        return new this.constructor(this.params.map(param => param.clone()), this.single);
    }

    checkSingle(input) {
        if (this.single) {
            if (this.params.length >= 0) {
                let param = this.params[0];
                let name = param.within(input);
                if (name === null) {
                    //if the param cant be found in the input, we try the entire input, but we have to make sure its the correct type!
                    if (!param.checkValueType(input)) {
                        return false;
                    }
                } else {
                    //we found the param in the input, search other params provided with the input and see if other params match!
                    for(let index = 1; index < this.params.length;index++) {
                        param = this.params[index];
                        name = param.within(input);
                        if (name !== null) {
                            //we have more than 1 param
                            return false;
                        }
                    }
                }

            }

            //good!
            return true;
        }

        //nope
        return false;
    }

    checkStrictInput(input) {
        //so we need to check incase teh override is flagged as requring strict input (eg cant contain ANY other properties other then specified)
        //this is because we might have .foo(name, value) and .foo({name: '', value: '', other: ''}) overrides. In this scenario we should set the .foo(name, value)
        //as strict, otherwise it will eat up the second override!

        //innocent until proven guilty
        if (this.strict) {
            if (typeof input === 'object') {
                //check all keys of object
                for(let key of Object.keys(input)) {
                    //assume invalid until a param is found!
                    let invalid = true;
                    for(let param of this.params) {
                        if (param.hasName(key)) {
                            invalid = false;
                            break;
                        }
                    }

                    //check input contains a key that is not part of this override.... REJECTION!
                    if (invalid) {
                        return false;
                    }
                }
            }
        }

        //good
        return true;
    }
}

//param classes
class FormeConfigurableParam extends FormeConfigurable {
    constructor(names, required, defaultValue=undefined) {
        super();

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
    clone() {
        return new this.constructor(this.names, this.required, this.defaultValue);
    }

    checkValueType(value) {
        //default to true as param allows any!
        return true;
    }

    within(input) {
        //find the name of param within input
        if (input && typeof input === 'object') {
            if (Array.isArray(this.names)) {
                for (let name of this.names) {
                    if (input.hasOwnProperty(name)) {
                        return name;
                    }
                }
            } else if (input.hasOwnProperty(this.names)) {
                return this.names;
            }
        }

        //nope
        return null;
    }

    hasName(name) {
        if (Array.isArray(this.names)) {
            return this.names.indexOf(name) !== -1;
        } else if (input.hasOwnProperty(this.names)) {
            return this.names === name;
        }
    }

    validate(method, value) {
        if (this.emptyValues.indexOf(value) !== -1 && this.required) {
            throw new FormeConfigurationError(method, this, 'is required');
        }
    }

    convert(value) {
        return value;
    }
}

class FormeConfigurableBool extends FormeConfigurableParam {
    //api
    convert(value) {
        if (value === 'false') {
            return false;
        } else if (value === 'true') {
            return true;
        } else if (value !== false && value !== true) {
            return !!value;
        } else {
            return value;
        }
    }

    checkValueType(value) {
        return typeof value === 'boolean';
    }
}

class FormeConfigurableBoolOrNull extends FormeConfigurableParam {
    //api
    convert(value) {
        if (value === 'false') {
            return false;
        } else if (value === 'true') {
            return true;
        } else if (value !== false && value !== true && value !== null) {
            return !!value;
        } else {
            return value;
        }
    }

    checkValueType(value) {
        return value === null || typeof value === 'boolean';
    }
}

class FormeConfigurableInt extends FormeConfigurableParam {
    //api
    convert(value) {
        return Number(value);
    }

    checkValueType(value) {
        return typeof value === 'number';
    }
}

class FormeConfigurableFloat extends FormeConfigurableParam {
    //api
    convert(value) {
        return Number(value);
    }

    checkValueType(value) {
        return typeof value === 'number';
    }
}

class FormeConfigurableString extends FormeConfigurableParam {
    //api
    convert(value) {
        if (value === null || value === undefined) {
            return ''
        } else {
            return String(value);
        }
    }

    checkValueType(value) {
        return typeof value === 'string';
    }
}

class FormeConfigurableStringOrNull extends FormeConfigurableParam {
    //api
    convert(value) {
        if (value === null || value === undefined) {
            return null;
        } else {
            return String(value);
        }
    }

    checkValueType(value) {
        return value === null || typeof value === 'string';
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
                throw new FormeConfigurationError(method, this,  'is not a valid object');
            }
        }
    }

    checkValueType(value) {
        return typeof value === 'object';
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

    checkValueType(value) {
        return Array.isArray(value);
    }

    validate(method, value) {
        super.validate(method, value);

        if (!Array.isArray(value)) {
            throw new FormeConfigurationError(method, this, 'is not a valid array');
        }
    }
}

class FormeConfigurableCallback extends FormeConfigurableParam {
    //api
    validate(method, value) {
        super.validate(method, value);

        if (value) {
            if (typeof value !== 'function') {
                throw new FormeConfigurationError(method, this,  'is not a valid callback');
            }
        }
    }

    checkValueType(value) {
        return typeof value === 'function';
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
                        throw new FormeConfigurationError(method, this,  'contains an invalid callback');
                    }
                }
            } else {
                //single callback
                if (typeof value !== 'function') {
                    throw new FormeConfigurationError(method, this,  'is not a valid callback');
                }
            }
        }
    }

    checkValueType(value) {
        return typeof value === 'function' || (Array.isArray(value) && value.findIndex(callback => typeof callback !== 'function') === -1);
    }
}

class FormeConfigurableStrings extends FormeConfigurableParam {
    //api
    validate(method, value) {
        super.validate(method, value);

        if (value) {
            if (Array.isArray(value)) {
                //multiple string so they all must be valid!
                for (let callback of value) {
                    if (typeof callback !== 'string') {
                        throw new FormeConfigurationError(method, this,  'contains an invalid string');
                    }
                }
            } else {
                //single string
                if (typeof value !== 'string') {
                    throw new FormeConfigurationError(method, this,  'is not a valid string');
                }
            }
        }
    }

    checkValueType(value) {
        return typeof value === 'string' || (Array.isArray(value) && value.findIndex(callback => typeof callback !== 'string') === -1);
    }
}

class FormeConfigurableStringsOrNull extends FormeConfigurableParam {
    //api
    convert(value) {
        if (value === null || value === undefined) {
            return null;
        } else if (Array.isArray(value)) {
            if (value.length === 0) {
                return null;
            }
            return value;
        } else {
            return String(value) || null;
        }
    }

    validate(method, value) {
        super.validate(method, value);

        if (value) {
            if (Array.isArray(value)) {
                //multiple string so they all must be valid!
                for (let callback of value) {
                    if (typeof callback !== 'string') {
                        throw new FormeConfigurationError(method, this,  'contains an invalid string');
                    }
                }
            } else {
                //single string
                if (typeof value !== 'string') {
                    throw new FormeConfigurationError(method, this,  'is not a valid string');
                }
            }
        }
    }

    checkValueType(value) {
        return value === null || typeof value === 'string' || (Array.isArray(value) && value.findIndex(value => typeof value !== 'string') === -1);
    }
}

//export classes
class FormeConfigurableExport extends FormeConfigurable {
    constructor(property) {
        super();

        this.property = property;
    }

    //api
    clone() {
        return new this.constructor(this.property);
    }

    export(source) {
        return null;
    }
}

class FormeConfigurableExportPointer extends FormeConfigurableExport {
    //api
    export(source) {
        const value = source[this.property];

        if (value === undefined || value === null) {
            return undefined;
        }

        return value;
    }
}

class FormeConfigurableExportProperty extends FormeConfigurableExport {
    //api
    export(source) {
        const value = source[this.property];

        if (value === undefined || value === null) {
            return value;
        }

        if (typeof value === 'object') {
            if (Array.isArray(value)) {
                return Array.from(value);
            } else {
                return Object.assign({}, value);
            }
        }

        return value;
    }
}

class FormeConfigurableExportArray extends FormeConfigurableExport {
    //api
    export(source) {
        const value = source[this.property];
        if (value === undefined || value === null || !Array.isArray(value) || value.length === 0) {
            return undefined;
        }

        return Array.from(value);
    }
}

class FormeConfigurableExportArrayObjects extends FormeConfigurableExportArray {
    //api
    export(source) {
        const value = super.export(source);
        if (value === undefined) {
            return value;
        }

        const out = [];

        for(let child of value) {
            if (child !== undefined && child !== null && typeof child !== 'object') {
                out.push(Object.assign({}, child));
            }
        }

        if (out.length === 0) {
            return undefined;
        }

        return out;
    }
}

class FormeConfigurableExportArrayStrings extends FormeConfigurableExportArray {
    //api
    export(source) {
        const value = super.export(source);
        if (value === undefined) {
            return value;
        }

        const out = [];

        for(let child of value) {
            if (child !== undefined && child !== null && typeof child === 'string' && child.length > 0) {
                out.push(child);
            }
        }

        if (out.length === 0) {
            return undefined;
        }

        return out;
    }
}

class FormeConfigurableExportCallback extends FormeConfigurableExport {
    export(source) {
        const value = source[this.property];

        if (value === undefined || value === null) {
            return undefined;
        }

        return value;
    }
}

class FormeConfigurableExportCallbacks extends FormeConfigurableExport {
    export(source) {
        const value = source[this.property];

        if (value === undefined || value === null || !Array.isArray(value) || value.length === 0) {
            return undefined;
        }

        return Array.from(value);
    }
}

class FormeConfigurableExportParam extends FormeConfigurableExportProperty {
    //api
    export(source) {
        const value = super.export(source);
        if (value === undefined || value === null) {
            return undefined;
        }

        return value;
    }
}

class FormeConfigurableExportNot extends FormeConfigurableExportParam {
    constructor(property, not) {
        super(property);
        this.not = not;
    }

    //api
    clone() {
        return new this.constructor(this.property, this.not);
    }

    export(source) {
        const value = super.export(source);
        if (value !== undefined && this.not !== undefined) {
            if (Array.isArray(this.not)) {
                if (this.not.indexOf(value) !== -1) {
                    return undefined;
                }
            } else {
                if (value === this.not) {
                    return undefined;
                }
            }
        }

        return value;
    }
}

class FormeConfigurableExportString extends FormeConfigurableExport {
    //api
    export(source) {
        const value = source[this.property];
        if (value === undefined || value === null || typeof value !== 'string' || value.length === 0) {
            return undefined;
        }

        return value;
    }
}

class FormeConfigurableExportStringOrNull extends FormeConfigurableExport {
    //api
    export(source) {
        const value = source[this.property];
        if (value === undefined || value === false) {
            return null;
        }

        return String(value);
    }
}

class FormeConfigurableExportStringsOrNull extends FormeConfigurableExport {
    //api
    export(source) {
        const value = source[this.property];
        if (value === undefined) {
            return undefined;
        }

        if (value === null) {
            return null;
        }

        if (Array.isArray(value)) {
            if (value.length === 0) {
                return undefined;
            }
            return value.map(value => String(value));
        } else {
            if (value.length === 0 || !value) {
                return undefined;
            }
        }

        return String(value);
    }
}

class FormeConfigurableExportBool extends FormeConfigurableExport {
    //api
    export(source) {
        const value = source[this.property];
        if (value === null || value === undefined || value === false) {
            return undefined;
        }

        return !!value;
    }
}

class FormeConfigurableExportBoolOrNull extends FormeConfigurableExport {
    //api
    export(source) {
        const value = source[this.property];
        if (value === undefined || value === false) {
            return undefined;
        }

        return !!value;
    }
}

class FormeConfigurableExportObject extends FormeConfigurableExport {
    //api
    export(source) {
        const value = source[this.property];
        if (value === undefined || value === null || typeof value !== 'object' || Object.keys(value).length === 0) {
            return undefined;
        }
        return Object.assign({}, value);
    }
}

class FormeConfigurableExportArrayObjectsAssign extends FormeConfigurableExport {
    //api
    export(source) {
        let value = source[this.property];
        if (value === null || value === undefined || typeof value !== 'object') {
            return undefined;
        }

        //merge array of objects
        if (Array.isArray(value)) {
            if (value.length === 0) {
                return undefined;
            }

            value = Object.assign({}, ...value);
        }

        //validate value has keys
        if (Object.keys(out).length === 0) {
            return undefined;
        }

        return value;
    }
}

class FormeConfigurableExportExecuteHandler extends FormeConfigurableExport {
    constructor(factory) {
        super(null);
        this.factory = factory;
    }
}

class FormeConfigurableExportProcessHandler extends FormeConfigurableExportExecuteHandler {
    //api
    clone() {
        return new this.constructor(this.factory);
    }

    export(source) {
        //find the process handler
        const handlers = source._findProcessHandlers(this.factory);
        if (!handlers || handlers.length === 0) {
            return undefined;
        }

        //get the last one as this is the one!
        const handler = handlers.pop();

        //let handler do the configuration
        return handler.configuration;
    }
}

class FormeConfigurableExportValidateHandler extends FormeConfigurableExportExecuteHandler {
    //api
    clone() {
        return new this.constructor(this.factory);
    }

    export(source) {
        //find the process handler
        const handlers = source._findValidateHandlers(this.factory);
        if (!handlers || handlers.length === 0) {
            return undefined;
        }

        //get the last one as this is the one!
        const handler = handlers.pop();

        //let handler do the configuration
        return handler.configuration;
    }
}

class FormeConfigurableExportValidateHandlers extends FormeConfigurableExportExecuteHandler {
    constructor(factory) {
        super(null);
        this.factory = factory;
    }

    //api
    clone() {
        return new this.constructor(this.factory);
    }

    export(source) {
        //find the process handler
        const handlers = source._findValidateHandlers(this.factory);
        if (!handlers || handlers.length === 0) {
            return undefined;
        }

        //export all
        return handlers.map(handler => handler.configuration);
    }
}

class FormeConfigurableExportTriggers extends FormeConfigurableExport {
    constructor() {
        super(null);
    }

    //api
    clone() {
        return new this.constructor();
    }

    export(source) {
        const triggers = source._findCustomTriggers();
        if (!triggers || triggers.length === 0) {
            return undefined;
        }

        return triggers.map(trigger => ({
            value: trigger.value,
            action: trigger.action,
            context: trigger.context,
        }))
    }
}

class FormeConfigurableExportSpecialTrigger extends FormeConfigurableExport {
    constructor(action) {
        super(null);
        this.action = action;
    }

    //api
    clone() {
        return new this.constructor(this.action);
    }

    export(source) {
        //find the process handler
        const action = source._findSpecialTriggers(this.action);
        if (!action || action.length === 0) {
            return undefined;
        }

        return null;//this needs exporting as *something* so that it gets added to the configuration (if we returned undefined, it would be stripped from config)
    }
}

class FormeConfigurableExportConditionalString extends FormeConfigurableExport {
    constructor(property, conditionProperty, conditionValue) {
        super(property);
        this.conditionProperty = conditionProperty;
        this.conditionValue = conditionValue;
    }

    //api
    clone() {
        return new this.constructor(this.property, this.conditionProperty, this.conditionValue);
    }

    export(source) {
        if (source[this.conditionProperty] !== this.conditionValue) {
            return undefined;
        }

        const value = source[this.property];
        if (value === undefined || value === null || typeof value !== 'string' || value.length === 0) {
            return undefined;
        }

        return value;
    }
}

//expose
module.exports = {
    FormeConfigurableMethod: FormeConfigurableMethod,
    FormeConfigurableMethodPointer: FormeConfigurableMethodPointer,
    FormeConfigurableOverride: FormeConfigurableOverride,

    FormeConfigurableParam: FormeConfigurableParam,
    FormeConfigurableExportNot: FormeConfigurableExportNot,
    FormeConfigurableBool: FormeConfigurableBool,
    FormeConfigurableBoolOrNull: FormeConfigurableBoolOrNull,
    FormeConfigurableInt: FormeConfigurableInt,
    FormeConfigurableFloat: FormeConfigurableFloat,
    FormeConfigurableString: FormeConfigurableString,
    FormeConfigurableStringOrNull: FormeConfigurableStringOrNull,
    FormeConfigurableStringsOrNull: FormeConfigurableStringsOrNull,
    FormeConfigurableObject: FormeConfigurableObject,
    FormeConfigurableArray: FormeConfigurableArray,
    FormeConfigurableCallback: FormeConfigurableCallback,
    FormeConfigurableCallbacks: FormeConfigurableCallbacks,
    FormeConfigurableStrings: FormeConfigurableStrings,

    FormeConfigurableExportProperty: FormeConfigurableExportProperty,
    FormeConfigurableExportPointer: FormeConfigurableExportPointer,

    FormeConfigurableExportParam: FormeConfigurableExportParam,
    FormeConfigurableExportBool: FormeConfigurableExportBool,
    FormeConfigurableExportBoolOrNull: FormeConfigurableExportBoolOrNull,
    FormeConfigurableExportString: FormeConfigurableExportString,
    FormeConfigurableExportStringOrNull: FormeConfigurableExportStringOrNull,
    FormeConfigurableExportStringsOrNull: FormeConfigurableExportStringsOrNull,
    FormeConfigurableExportObject: FormeConfigurableExportObject,
    FormeConfigurableExportArray: FormeConfigurableExportArray,
    FormeConfigurableExportCallback: FormeConfigurableExportCallback,
    FormeConfigurableExportCallbacks: FormeConfigurableExportCallbacks,

    FormeConfigurableExportArrayStrings: FormeConfigurableExportArrayStrings,
    FormeConfigurableExportArrayObjects: FormeConfigurableExportArrayObjects,
    FormeConfigurableExportArrayObjectsAssign: FormeConfigurableExportArrayObjectsAssign,

    FormeConfigurableExportExecuteHandler: FormeConfigurableExportExecuteHandler,
    FormeConfigurableExportProcessHandler: FormeConfigurableExportProcessHandler,
    FormeConfigurableExportValidateHandler: FormeConfigurableExportValidateHandler,
    FormeConfigurableExportValidateHandlers: FormeConfigurableExportValidateHandlers,
    FormeConfigurableExportTriggers: FormeConfigurableExportTriggers,
    FormeConfigurableExportSpecialTrigger: FormeConfigurableExportSpecialTrigger,

    FormeConfigurableExportConditionalString: FormeConfigurableExportConditionalString,
};