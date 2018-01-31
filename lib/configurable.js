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
        //build the params we will call the method with
        const build = [];

        //iterate over all overrides until we find a match!
        let firstError = null;
        for(let override of this.overrides) {
            try {
                //build params, this is not strict yet but we do check requirement if param does not exist in input
                const params = override.params;

                //determine if input is actually the singly required param
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
                //we allow the target to be modified with the .source() method, but this does not alter the chain, we keep that as the original source!
                const target = this.source(source);
                const method = target[this.method];
                if (!method) {
                    //noinspection ExceptionCaughtLocallyJS
                    throw new FormeConfigurationError(this, null, `not found in '${target._baseType}'`);
                }
                method.apply(target, build);

                //chain original source
                return source;

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
    constructor(params, single) {
        super();

        this.params = params || [];
        this.single = single;
        this.requiredParams = params.filter(param => param.required);
    }

    //api
    clone() {
        return new this.constructor(this.params.map(param => param.clone()), this.single);
    }

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
                throw new FormeConfigurationError(method, this,  'is not a valid object');
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
                        throw new FormeConfigurationError(method, this,  'contains an invalid string');
                    }
                }
            } else {
                //single callback
                if (typeof value !== 'string') {
                    throw new FormeConfigurationError(method, this,  'is not a valid string');
                }
            }
        }
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
}

class FormeConfigurableExportProcessHandler extends FormeConfigurableExportExecuteHandler {
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

        //get the last one as this is the one!
        const handler = handlers.pop();

        //let handler do the configuration
        return handler.configuration;
    }
}

class FormeConfigurableExportValidateHandlers extends FormeConfigurableExport {
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

class FormeConfigurableExportValidateHandlersConcat extends FormeConfigurableExport {
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
        const values = [].concat(...handlers.map(handler => handler.configuration)).filter(value => value !== undefined);
    }
}

class FormeConfigurableExportInputActions extends FormeConfigurableExport {
    constructor() {
        super(null);
    }

    //api
    clone() {
        return new this.constructor();
    }

    export(source) {
        //find the process handler
        const actions = source._findCustomActions();
        if (!actions || actions.length === 0) {
            return undefined;
        }

        return actions.map(action => ({
            action: action.action,
            value: action.value,
            context: action.context,
        }))
    }
}

class FormeConfigurableExportInputSpecialAction extends FormeConfigurableExport {
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
        const action = source._findSpecialAction(this.action);
        if (!action || action.length === 0) {
            return undefined;
        }

        return null;//this should still export because only undefined gets ignored
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
    FormeConfigurableObject: FormeConfigurableObject,
    FormeConfigurableArray: FormeConfigurableArray,
    FormeConfigurableCallbacks: FormeConfigurableCallbacks,
    FormeConfigurableStrings: FormeConfigurableStrings,

    FormeConfigurableExportProperty: FormeConfigurableExportProperty,
    FormeConfigurableExportPointer: FormeConfigurableExportPointer,

    FormeConfigurableExportParam: FormeConfigurableExportParam,
    FormeConfigurableExportBool: FormeConfigurableExportBool,
    FormeConfigurableExportBoolOrNull: FormeConfigurableExportBoolOrNull,
    FormeConfigurableExportString: FormeConfigurableExportString,
    FormeConfigurableExportObject: FormeConfigurableExportObject,
    FormeConfigurableExportArray: FormeConfigurableExportArray,
    FormeConfigurableExportCallbacks: FormeConfigurableExportCallbacks,

    FormeConfigurableExportArrayStrings: FormeConfigurableExportArrayStrings,
    FormeConfigurableExportArrayObjects: FormeConfigurableExportArrayObjects,
    FormeConfigurableExportArrayObjectsAssign: FormeConfigurableExportArrayObjectsAssign,

    FormeConfigurableExportExecuteHandler: FormeConfigurableExportExecuteHandler,
    FormeConfigurableExportProcessHandler: FormeConfigurableExportProcessHandler,
    FormeConfigurableExportValidateHandler: FormeConfigurableExportValidateHandler,
    FormeConfigurableExportValidateHandlers: FormeConfigurableExportValidateHandlers,
    FormeConfigurableExportValidateHandlersConcat: FormeConfigurableExportValidateHandlersConcat,
    FormeConfigurableExportInputActions: FormeConfigurableExportInputActions,
    FormeConfigurableExportInputSpecialAction: FormeConfigurableExportInputSpecialAction,

    FormeConfigurableExportConditionalString: FormeConfigurableExportConditionalString,
};