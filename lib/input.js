'use strict';

//hello :D

//module imports
const format = require('string-template');

//local imports
const constants = require('./constants');
const utils = require('./utils');

const {FormeConfigurableMethod, FormeConfigurableOverride, FormeConfigurableParam, FormeConfigurableBool, FormeConfigurableInt, FormeConfigurableString, FormeConfigurableObject, FormeConfigurableStrings} = require('./configurable');

const FormeBase = require('./base');
const FormeInputError = require('./errors').FormeInputError;

const InputProcessHandler = require('./handlers/inputProcessHandler');
const InputValidateHandler = require('./handlers/inputValidateHandler');

const InputProcessHandlerConvert = require('./handlers/input/process/inputProcessHandlerConvert');
const InputProcessHandlerEmpty = require('./handlers/input/process/inputProcessHandlerEmpty');

const InputValidateHandlerRequire = require('./handlers/input/validate/inputValidateHandlerRequire');
const InputValidateHandlerOptions = require('./handlers/input/validate/inputValidateHandlerOption');
const InputValidateHandlerSize = require('./handlers/input/validate/inputValidateHandlerSize');
const InputValidateHandlerMin = require('./handlers/input/validate/inputValidateHandlerMin');
const InputValidateHandlerMax = require('./handlers/input/validate/inputValidateHandlerMax');
const InputValidateHandlerCustom = require('./handlers/input/validate/inputValidateHandlerCustom');
const InputValidateHandlerIs = require('./handlers/input/validate/inputValidateHandlerIs');
const InputValidateHandlerMatch = require('./handlers/input/validate/inputValidateHandlerMatch');
const InputValidateHandlerBlacklist = require('./handlers/input/validate/inputValidateHandlerBlacklist');

//locals
const handlerLookup = {
    require: InputValidateHandlerRequire,
    options: InputValidateHandlerOptions,
    size: InputValidateHandlerSize,
    min: InputValidateHandlerMin,
    max: InputValidateHandlerMax,
    validate: InputValidateHandlerCustom,
    is: InputValidateHandlerIs,
    match: InputValidateHandlerMatch,
    blacklist: InputValidateHandlerBlacklist,
};

//main class
class FormeInput extends FormeBase {
    constructor(form, name) {
        super('input', form, name);

        this._group = null;
        this._pipe = false;
        this._special = false;
        this._ignore = false;
        this._convert = false;
        this._id = null;
        this._actions = null;
        this._alias = null;
        this._icon = null;
        this._help = '';
        this._placeholder = null;
        this._readonly = false;
        this._required = false;
        this._keep = false;
        this._type = null;
        this._defaultValue = null;
        this._permanentValue = null;
        this._overrideValue = null;
        this._secure = false;
        this._hidden = false;
        this._checked = null;
        this._options = [];
        this._classNames = [];
        this._data = [];

        this._invalidHandlers = [];
        this._validHandlers = [];
    }

    //static
    static buildConfigurableMethods() {
        return Object.assign(super.buildConfigurableMethods(), {
            //input.id(string)
            id: new FormeConfigurableMethod('id', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('id', false),
                ], true),
            ]),

            //input.type(string)
            type: new FormeConfigurableMethod('type', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('type', false),
                ], true),
            ]),

            //input.className(string)
            className: new FormeConfigurableMethod('className', [
                new FormeConfigurableOverride([
                    new FormeConfigurableStrings(['className', 'class'], false),
                ], true),
            ]),

            //input.data(*multiple*)
            data: new FormeConfigurableMethod('data', [
                //input.data(key, value)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['name', 'key', 'id'], false),
                    new FormeConfigurableParam('value', false),
                ], false),

                //input.data(object)
                new FormeConfigurableOverride([
                    new FormeConfigurableObject(['data', 'value'], true),
                ], true),
            ]),

            //input.help(string)
            help: new FormeConfigurableMethod('help', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('help', false),
                ], true),
            ]),

            //input.require(bool)
            require: new FormeConfigurableMethod('require', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['require', 'required'], false, true),
                    new FormeConfigurableString('error', false),
                ], true),
            ]),

            //input.size(int)
            size: new FormeConfigurableMethod('size', [
                new FormeConfigurableOverride([
                    new FormeConfigurableInt('size', false),
                ], true),
            ]),

            //input.min(int)
            main: new FormeConfigurableMethod('min', [
                new FormeConfigurableOverride([
                    new FormeConfigurableInt('min', false),
                ], true),
            ]),

            //input.max(int)
            max: new FormeConfigurableMethod('max', [
                new FormeConfigurableOverride([
                    new FormeConfigurableInt('max', false),
                ], true),
            ]),

            //input.is(*multiple*)
            is: new FormeConfigurableMethod('is', [
                //input.is(string, object, string)
                new FormeConfigurableOverride([
                    new FormeConfigurableString('type', true),
                    new FormeConfigurableObject('options', true),
                    new FormeConfigurableString('error', true),
                ], false),

                //input.is(string, object)
                new FormeConfigurableOverride([
                    new FormeConfigurableString('type', true),
                    new FormeConfigurableObject('options', true),
                ], false),

                //input.is(string)
                new FormeConfigurableOverride([
                    new FormeConfigurableString('type', true),
                ], true),
            ]),

            //input.match(*multiple*)
            match: new FormeConfigurableMethod('match', [
                //input.match(string, bool, string)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['target', 'name', 'path'], true),
                    new FormeConfigurableBool('strict', true),
                    new FormeConfigurableString('error', true),
                ], false),

                //input.match(string, bool)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['target', 'name', 'path'], true),
                    new FormeConfigurableBool('strict', true),
                ], false),

                //input.match(string)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['target', 'name', 'path'], true),
                ], true),
            ]),

            //input.options(*multiple*)
            options: new FormeConfigurableMethod('options', [
                //input.options(object, bool, string)
                new FormeConfigurableOverride([
                    new FormeConfigurableObject('options', true),
                    new FormeConfigurableBool('strict', true),
                    new FormeConfigurableString('error', true),
                ], false),

                //input.options(object, bool)
                new FormeConfigurableOverride([
                    new FormeConfigurableObject('options', true),
                    new FormeConfigurableBool('strict', true),
                ], false),

                //input.options(object)
                new FormeConfigurableOverride([
                    new FormeConfigurableObject('options', true),
                ], true),
            ]),

            //input.secure(bool)
            secure: new FormeConfigurableMethod('secure', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['secure', 'secured'], false),
                ], true),
            ]),

            //input.bool(bool)
            bool: new FormeConfigurableMethod('bool', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['null', 'allowNull'], false),
                ], true),
            ]),

            //input.int(bool)
            int: new FormeConfigurableMethod('int', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['null', 'allowNull'], false),
                ], true),
            ]),

            //input.float(bool)
            float: new FormeConfigurableMethod('float', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['null', 'allowNull'], false),
                ], true),
            ]),

            //input.string(bool)
            string: new FormeConfigurableMethod('string', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool(['null', 'allowNull'], false),
                ], true),
            ]),

            //input.empty(value)
            empty: new FormeConfigurableMethod('empty', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('value', false),
                ], true),
            ]),

            //input.group(string, append)
            group: new FormeConfigurableMethod('group', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('group', false),
                    new FormeConfigurableBool('append', false, true),
                ], true),
            ]),

            //input.alias(string)
            alias: new FormeConfigurableMethod('alias', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('alias', false),
                ], true),
            ]),

            //input.checked(bool)
            checked: new FormeConfigurableMethod('checked', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('checked', false),
                ], true),
            ]),

            //input.permanent(value)
            permanent: new FormeConfigurableMethod('permanent', [
                new FormeConfigurableOverride([
                    new FormeConfigurableParam(['value', 'permanent'], false),
                ], true),
            ]),

            //input.override(value)
            override: new FormeConfigurableMethod('override', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['value', 'override'], false),
                ], true),
            ]),

            //input.blacklist(*multiple*)
            blacklist: new FormeConfigurableMethod('blacklist', [
                //input.blacklist(value, bool, string)
                new FormeConfigurableOverride([
                    new FormeConfigurableParam('blacklist', true),
                    new FormeConfigurableBool('strict', true),
                    new FormeConfigurableString('error', true),
                ], false),

                //input.blacklist(value, bool)
                new FormeConfigurableOverride([
                    new FormeConfigurableParam('blacklist', true),
                    new FormeConfigurableBool('strict', true),
                ], false),

                //input.blacklist(value)
                new FormeConfigurableOverride([
                    new FormeConfigurableParam('blacklist', true),
                ], true),
            ]),

            //input.placeholder(string)
            placeholder: new FormeConfigurableMethod('placeholder', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('placeholder', false),
                ], true),
            ]),

            //input.readonly(bool)
            readonly: new FormeConfigurableMethod('readonly', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('readonly', false),
                ], true),
            ]),

            //input.hidden(bool)
            hidden: new FormeConfigurableMethod('hidden', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('hidden', false),
                ], true),
            ]),

            //input.action(string(s), value, value)
            action: new FormeConfigurableMethod('action', [
                new FormeConfigurableOverride([
                    new FormeConfigurableStrings(['action', 'actions'], true),
                    new FormeConfigurableParam('value', false),
                    new FormeConfigurableParam('context', false),
                ], true),
            ]),

            //input.next()
            next: new FormeConfigurableMethod('next'),

            //input.prev()
            prev: new FormeConfigurableMethod('prev'),

            //input.reset()
            reset: new FormeConfigurableMethod('reset'),

            //input.rerun()
            rerun: new FormeConfigurableMethod('rerun'),

            //input.keep(bool)
            keep: new FormeConfigurableMethod('keep', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('keep', false),
                ], true),
            ]),

            //input.value(value)
            value: new FormeConfigurableMethod('value', [
                new FormeConfigurableOverride([
                    new FormeConfigurableParam('value', false),
                ], true),
            ]),

            //input.pipe(value)
            pipe: new FormeConfigurableMethod('pipe', [
                new FormeConfigurableOverride([
                    new FormeConfigurableParam('pipe', false),
                ], true),
            ]),

            //input.ignore(bool)
            ignore: new FormeConfigurableMethod('ignore', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('ignore', false),
                ], true),
            ]),

            //input.icon(string)
            icon: new FormeConfigurableMethod('icon', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('icon', false),
                ], true),
            ]),
        });
    }

    //properties
    get name() {
        return this._name;
    }

    get form() {
        return this._form;
    }

    //private methods
    _clone(override) {
        //create copy
        const clone = new this._form._driverClass.inputClass();

        //iterate over properties
        for(let key of Object.keys(this)) {
            if (override && override[key] !== undefined) {
                clone[key] = override[key];
            } else {
                const property = this[key];

                switch (key) {
                    case '_form':
                        //keep reference
                        clone[key] = this._form;
                        break;
                    default:
                        clone[key] = utils.clone.property(property, override);
                        break;
                }
            }
        }

        //:D
        return clone;
    }

    _invalid() {
        if (this._invalidHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextInvalidHandler(0);
        }
    }

    _valid() {
        if (this._validHandlers.length === 0) {
            return Promise.resolve();
        } else {
            return this._nextValidHandler(0);
        }
    }
    
    _processWithValue(value, promise) {
        //allow for manual processing on this!
        const state = this._createState(arguments.length >= 2?value:this._form._getInputNameValue(this._name));

        //process handlers are synchronous only, so if we ask for a promise, we should wrap it!
        if (promise) {
            //wrap in a promise!
            return new Promise((resolve, reject) => {
                try {
                    this._processAllWithState(state);
                }
                catch(err) {
                    reject(err);
                }

                //done!
                resolve(state.value);
            });
        } else {
            //no promises :D
            this._processAllWithState(state);

            return state.value;
        }
    }

    _processAllWithState(state) {
        if (this._processHandlers.length) {
            const oldValue = state.value;

            try {
                for (let handler of this._processHandlers) {
                    this._executeProcessHandler(handler, state);
                }

                //save state change
                if (state.value !== oldValue) {
                    this._form._setInputNameValue(this._name, state.value);
                }
            }
            catch(err) {
                //catch error, but still save state change
                if (state.value !== oldValue) {
                    this._form._setInputNameValue(this._name, state.value);
                }

                //pass error on!
                throw err;
            }
        }
    }

    //private add methods
    _addCustomValidateHandler(callback, error) {
        this._addValidateHandler(new InputValidateHandlerCustom(callback, error));
    }

    _addCustomInvalidHandler(callback) {
        this._invalidHandlers.push(callback);
    }

    _addCustomValidHandler(callback) {
        this._validHandlers.push(callback);
    }

    _addActions(actions, value, context, special) {
        if (this.callingConfigureMethod('action')) {
            //allow multiple actions
            if (this._actions === null) {
                this._actions = [];
            }

            //allow add of multiple actions with same context
            if (!Array.isArray(actions)) {
                this._actions.push({
                    action: actions,
                    value: value,
                    context: context,
                    special: special,
                });
            } else {
                for (let action of actions) {
                    this._actions.push({
                        action: action,
                        value: value,
                        context: context,
                        special: special,
                    });
                }
            }

            //chain
            return this;
        }
    }

    //private next methods
    _nextExecuteHandler(index) {
        const handler = this._executeHandlers[index];

        return new Promise((resolve, reject) => {
            //what type of handler is it?
            const state = this._createState(this._form._getInputNameValue(this._name));
            const oldValue = state.value;

            return this._executeHandlerByType(handler, state)
            .then(() => {
                //update value if state changed
                if (state.value !== oldValue) {
                    this._form._setInputNameValue(this._name, state.value);
                }

                //next
                resolve();
            })
            .catch(err => {
                //extract error string from catch
                let error = err.message || '';

                //update value if state changed
                if (state.value !== oldValue) {
                    this._form._setInputNameValue(this._name, state.value);
                }

                //use handler specified error instead
                if (handler.error !== null) {
                    error = handler.error;
                }

                //apply inline template vars
                error = format(error,{
                    name: this._name,
                    label: this._label,
                });

                //add error to container
                this.error(error);

                //stop further execution
                reject();
            });
        })
        .then(() => {
            //continue iteration
            if (++index < this._executeHandlers.length) {
                return this._nextExecuteHandler(index);
            }
        })

        //valid :D
        .then(() => this._valid())

        //invalid :(
        .catch(err => {
            //unhandled error
            this._form._catchError(err);

            //call base _invalid execution
            return this._invalid();
        });
    }

    _nextInvalidHandler(index) {
        return utils.promise.result(this._executeInvalidHandler(this._invalidHandlers[index]))
        .then(() => ++index === this._invalidHandlers.length ? Promise.resolve() : this._nextInvalidHandler(index));
    }

    _nextValidHandler(index) {
        return utils.promise.result(this._executeValidHandler(this._validHandlers[index]))
        .then(() => ++index === this._validHandlers.length ? Promise.resolve() : this._nextValidHandler(index));
    }

    //private execute methods
    _executeHandlerByType(handler, state) {
        //decide which type of handler we are...handling!
        if (handler instanceof InputProcessHandler) {
            return this._executeProcessHandler(handler, state);
        } else if (handler instanceof InputValidateHandler) {
            return this._executeValidateHandler(handler, state);
        } else {
            return Promise.reject(new FormeInputError('unknown execution handler'));
        }
    }

    _executeProcessHandler(handler, state) {
        return new Promise((resolve, reject) => {
            //iterate over all handlers
            try {
                handler.execute(this, state);
            } catch(err) {
                //pass error into the promise chain
                reject(err);
            }

            //success
            resolve();
        });
    }

    _executeValidateHandler(handler, state) {
        return handler.execute(this, state);
    }

    _executeInvalidHandler(handler) {
        return handler.call(this, this._form, this);
    }

    _executeValidHandler(handler) {
        return handler.call(this, this._form, this);
    }
    
    _executeSuccessHandler(handler) {
        //should be overridden
        return handler.call(this, this._form, this);
    }

    _executeFailHandler(handler) {
        //should be overridden
        return handler.call(this, this._form, this);
    }

    _executeSubmitHandler(handler) {
        //should be overridden
        return handler.call(this, this._form, this);
    }

    _executeDoneHandler(handler) {
        return handler.call(this, this._form, this);
    }

    //private find methods
    _createState(value) {
        return {
            require: false,
            value: value,
        };
    }

    _findAction(name) {
        for (let action of this._actions) {
            if (action.action === name) {
                return action;
            }
        }
        return null;
    }
    
    //private misc methods
    _calculateType() {
        if (this._type !== null) {
            //overridden by user
            return this._type;
        } else {
            //pick defaults
            if (this._hidden) {
                return 'hidden';
            } else {
                //check for types based on actions
                if (this._actions !== null) {
                    for(let action of this._actions) {
                        //special actions
                        if (action.special) {
                            switch(action.action) {
                                case constants.actions.prev:
                                case constants.actions.next:
                                case constants.actions.reset:
                                    return 'button';
                                case constants.actions.rerun:
                                case constants.actions.submit:
                                    return 'submit';
                            }
                        }
                    }
                }

                //standard types
                if (this._checked !== null) {
                    //checkbox
                    return 'checkbox';
                } else {
                    //is it secured (override always)
                    if (this._secure) {
                        return 'password';
                    } else {
                        //lookup type based on handlers
                        let type = 'text';//default to 'text'

                        //iterate all handlers and apply their html5 input types (handlers later in the chain take precedence)
                        for (let handler of this._executeHandlers) {
                            //check to see if handler sets type
                            let handlerType = handler.HTML5InputType();
                            if (handlerType !== null) {
                                type = handlerType;
                            }
                        }

                        //not found, return default
                        return type;
                    }
                }
            }
        }
    }

    _outputName() {
        return this._alias !== null?this._alias:this._name;
    }

    _getPermanentValue() {
        if (this._overrideValue !== null) {
            return this._overrideValue;
        } else {
            return this._permanentValue;
        }
    }

    //public api
    id(id) {
        if (this.callingConfigureMethod('id')) {
            //allow to override id
            this._id = id;

            //chain
            return this;
        }
    }

    type(type) {
        if (this.callingConfigureMethod('type')) {
            this._type = type;

            //chain
            return this;
        }
    }

    className(name) {
        if (utils.call.check.not.active(this._form, 'input.className()')) {
            //add a class
            if (typeof name === 'string') {
                let parts = name.split(' ');
                for (let index = 0; index < parts.length; index++) {
                    let part = parts[index].trim();
                    if (parts[index].length) {
                        this._classNames.push(part);
                    }
                }
            } else if (Array.isArray(name)) {
                for (let arrayIndex = 0; arrayIndex < name.length; arrayIndex++) {
                    let parts = name.split(' ');
                    for (let index = 0; index < parts.length; index++) {
                        let part = parts[index].trim();
                        if (parts[index].length) {
                            this._classNames.push(part);
                        }
                    }
                }
            }

            //chain
            return this;
        }
    }

    data() {
        if (this.callingConfigureMethod('data')) {
            if (arguments.length === 2 || (arguments.length === 1 && typeof arguments[0] === 'string')) {
                //single data
                this._data.push({
                    name: arguments[0],
                    value: arguments.length > 0?arguments[1]:'',
                });
            } else if (arguments.length === 1 && typeof arguments[0] === 'object') {
                //single object
                const data = arguments[0];
                for(let name of Object.keys(data)) {
                    const value = data[name];
                    this._data.push({
                        name: name,
                        value: value ? value : '',
                    });
                }
            }

            //chain
            return this;
        }
    }

    help(help) {
        if (this.callingConfigureMethod('help')) {
            this._help = help;

            //chain
            return this;
        }
    }

    require(require, error) {
        if (this.callingConfigureMethod('require')) {
            if (require !== undefined && !!require) {
                //remove requirement
                this._required = false;
                this._removeValidateHandler(InputValidateHandlerRequire);

            } else {
                //add requirement
                this._required = true;
                this._addValidateHandler(new InputValidateHandlerRequire(error));
            }

            //chain
            return this;
        }
    }

    size(size, error) {
        if (this.callingConfigureMethod('size')) {
            //requires exact size

            //add handler
            this._addValidateHandler(new InputValidateHandlerSize(size, size, error));

            //chain
            return this;
        }
    }

    min(size, error) {
        if (arguments.length === 0) {
            //find lowest
            const handlers = this._findValidateHandlers(InputValidateHandlerMax);

            let lowest = null;
            if (handlers.length) {
                for(let handler of handlers) {
                    lowest = lowest === null?handler.min:Math.min(lowest, handler.min);
                }
            }
            return lowest;
        } else {
            if (this.callingConfigureMethod('min')) {
                //requires min size

                //add handler
                this._addValidateHandler(new InputValidateHandlerMin(size, error));

                //chain
                return this;
            }
        }
    }

    max(size, error) {
        if (arguments.length === 0) {
            //find highest
            const handlers = this._findValidateHandlers(InputValidateHandlerMax);

            let highest = null;
            if (handlers.length) {
                for(let handler of handlers) {
                    highest = highest === null?handler.max:Math.max(highest, handler.max);
                }
            }
            return highest;
        } else {
            if (this.callingConfigureMethod('max')) {
                //requires max

                //add handler
                this._addValidateHandler(new InputValidateHandlerMax(size, error));

                //chain
                return this;
            }
        }
    }

    remove(what) {
        const type = handlerLookup[what];
        if (type === undefined) {
            throw new Error(`unknown input.remove() type '${what}'`)
        } else {
            this._removeValidateHandler(type);
        }
    }

    is(type, options, error) {
        if (this.callingConfigureMethod('is')) {
            //validate the value against various value types
            this._addValidateHandler(new InputValidateHandlerIs(type, options, error));

            //chain
            return this;
        }
    }

    match(target, strict, error) {
        if (this.callingConfigureMethod('match')) {
            //validate the value against various value types
            this._addValidateHandler(new InputValidateHandlerMatch(target, strict, error));

            //chain
            return this;
        }
    }

    options(options, strict, error) {
        if (this.callingConfigureMethod('options')) {
            //a specific set of options is required

            //set options
            this._options = [];

            if (options instanceof Array) {
                //array of ?
                if (options.length) {
                    if (options[0] instanceof Object) {
                        //value/label pair
                        for (let index = 0; index < options.length; index++) {
                            if (options[index].value !== undefined) {
                                this._options.push({
                                    label: options[index].label !== undefined ? options[index].label : options[index].value,
                                    value: options[index].value,
                                });
                            }
                        }
                    } else {
                        //array of values
                        for (let index = 0; index < options.length; index++) {
                            this._options.push({
                                label: options[index],
                                value: options[index],
                            });
                        }
                    }
                }
            } else if (options instanceof Object) {
                //object with value/label pairs
                for (let value of Object.keys(options)) {
                    this._options.push({
                        label: options[value],
                        value: value,
                    });
                }
            }

            //add handler
            this._addValidateHandler(new InputValidateHandlerOptions(strict, error));

            //chain
            return this;
        }
    }

    secure(secure) {
        if (this.callingConfigureMethod('secure')) {
            //prevent secure mode whilst keeping
            if (this._keep) {
                throw new Error('cant use input.secure() after input.keep()');
            }

            //prevent this value from being stored by the app between container calls
            this._secure = arguments.length?!!secure:true;

            //chain
            return this;
        }
    }

    bool(allowNull) {
        if (this.callingConfigureMethod('bool')) {
            //add handler
            this._addProcessHandler(new InputProcessHandlerConvert('bool', allowNull));

            //flag that there is a conversion happening
            this._convert = true;

            //chain
            return this;
        }
    }

    int(allowNull) {
        if (this.callingConfigureMethod('int')) {
            //convert value to int, force indicates this the value will be forced to exist

            //add handler
            this._addProcessHandler(new InputProcessHandlerConvert('int', allowNull));

            //flag that there is a conversion happening
            this._convert = true;

            //chain
            return this;
        }
    }

    float(allowNull) {
        if (this.callingConfigureMethod('float')) {
            //convert value to float, force indicates this the value will be forced to exist

            //add handler
            this._addProcessHandler(new InputProcessHandlerConvert('float', allowNull));

            //flag that there is a conversion happening
            this._convert = true;

            //chain
            return this;
        }
    }

    string(allowNull) {
        if (this.callingConfigureMethod('string')) {
            //convert value to string, force indicates this the value will be forced to exist

            //add handler
            this._addProcessHandler(new InputProcessHandlerConvert('string', allowNull));

            //flag that there is a conversion happening
            this._convert = true;

            //chain
            return this;
        }
    }

    empty(value) {
        if (this.callingConfigureMethod('empty')) {
            //add handler
            this._addProcessHandler(new InputProcessHandlerEmpty(value));

            //chain
            return this;
        }
    }

    group(segments, atEnd=true) {
        if (this.callingConfigureMethod('group')) {
            //change teh group the input will be added to (used by templating)
            if (this._group === null) {
                this._group = [];
            }

            if (Array.isArray(segments)) {
                //array of
                if (atEnd) {
                    this._group.push(...segments);
                } else {
                    this._group.unshift(...segments);
                }
            } else {
                //single
                if (atEnd) {
                    this._group.push(segments);
                } else {
                    this._group.unshift(segments);
                }
            }

            //chain
            return this;
        }
    }

    alias(alias) {
        if (this.callingConfigureMethod('alias')) {
            //change the name used in template var / values
            this._alias = alias;

            //chain
            return this;
        }
    }

    path() {
        //returns the currently defined "path" (group + alias) for an input
        if (this._group && this._group.length) {
            return this._group.join('.')+'.'+this._outputName();
        } else {
            return this._outputName();
        }

    }

    checked(checked) {
        if (this.callingConfigureMethod('checked')) {
            //change default checked state
            this._checked = arguments.length?!!checked:true;

            //chain
            return this;
        }
    }

    permanent(permanent) {
        if (this.callingConfigureMethod('permanent')) {
            //forces the value to always be this when returned to the template or validation
            this._permanentValue = arguments.length?permanent:null;

            //chain
            return this;
        }
    }

    override(override) {
        if (this.callingConfigureMethod('override')) {
            //forces the value to always be this when returned to validation
            this._overrideValue = arguments.length?override:null;

            //chain
            return this;
        }
    }

    blacklist(options, strict, error) {
        if (this.callingConfigureMethod('blacklist')) {
            //build list of values
            let list;

            if (options instanceof Array) {
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

            //add handler
            this._addValidateHandler(new InputValidateHandlerBlacklist(list, strict, error));

            //chain
            return this;
        }
    }

    placeholder(placeholder) {
        if (this.callingConfigureMethod('placeholder')) {
            //modify the placeholder text
            this._placeholder = placeholder;

            //chain
            return this;
        }
    }

    readonly(readonly) {
        if (this.callingConfigureMethod('readonly')) {
            //change default readonly state
            this._readonly = arguments.length?!!readonly:true;

            //chain
            return this;
        }
    }

    hidden(hidden) {
        if (this.callingConfigureMethod('hidden')) {
            //change default hidden state
            this._hidden = arguments.length?!!hidden:true;

            //chain
            return this;
        }
    }

    action(actions, value, context) {
        if (this.callingConfigureMethod('action')) {
            this._addActions(actions, value, context, false);

            //chain
            return this;
        }
    }

    next() {
        if (this.callingConfigureMethod('next')) {
            this._addActions(constants.actions.next, null, null, true);
            this._defaultValue = this._defaultValue !== null?this._defaultValue:this._name;
            this._special = true;

            //chain
            return this;
        }
    }

    prev() {
        if (this.callingConfigureMethod('prev')) {
            this._addActions(constants.actions.prev, null, null, true);
            this._defaultValue = this._defaultValue !== null?this._defaultValue:this._name;
            this._special = true;

            //chain
            return this;
        }
    }

    reset() {
        if (this.callingConfigureMethod('reset')) {
            this._addActions(constants.actions.reset, null, null, true);
            this._defaultValue = this._defaultValue !== null?this._defaultValue:this._name;
            this._special = true;

            //chain
            return this;
        }
    }

    rerun() {
        if (this.callingConfigureMethod('rerun')) {
            this._addActions(constants.actions.rerun, null, null, true);
            this._defaultValue = this._defaultValue !== null?this._defaultValue:this._name;
            this._special = true;

            //chain
            return this;
        }
    }

    keep(keep) {
        if (this.callingConfigureMethod('keep')) {
            if (this._secure) {
                throw new Error('cant use input.keep() after input.secure()');
            }

            this._keep = arguments.length?!!keep:true;

            //chain
            return this;
        }
    }

    error(message) {
        //shortcut to add a message (container handles input piping)
        if (utils.call.check.active(this._form, 'input.error()')) {
            return this._form.error(this._name, message);
        }
    }

    value() {
        if (arguments.length === 0) {
            //get value, let the form decide where from
            return this._form._getInputNameValue(this._name);

        } else if (arguments.length === 1) {
            if (!this._form._isStarted() || this._form._isBuilding()) {
                //set the default value (e.g. the form is still building)
                this._defaultValue = arguments.length?arguments[0]:null;
            } else {
                //set runtime value (e.g. modify submitted value)
                this._form._setInputNameValue(this._name, arguments[0]);
            }

            //chain
            return this;
        }
    }

    pipe(target) {
        if (this.callingConfigureMethod('pipe')) {
            //pipe input stuff to target
            if (target === null || target === false) {
                //pipe to self
                this._pipe = false;
            } else if (target === true) {
                //pipe to container
                this._pipe = true;
            } else {
                //pipe to specified input
                this._pipe = target;
            }

            //chain
            return this;
        }
    }

    ignore(ignore) {
        if (this.callingConfigureMethod('ignore')) {
            this._ignore = arguments.length?!!ignore:true;

            //chain
            return this;
        }
    }

    submit(callbacks) {
        if (arguments.length === 0) {
            //set to submit button
            if (this.callingConfigureMethod('submit')) {
                this._addActions(constants.actions.submit, null, null, true);
                this._defaultValue = this._defaultValue !== null?this._defaultValue:this._name;
                this._special = true;

                //chain
                return this;
            }
        } else {
            //add submit callback
            return super.submit(callbacks);
        }
    }

    invalid(callbacks) {
        if (this.callingConfigureMethod('invalid')) {
            if (Array.isArray(callbacks)) {
                for(let callback of callbacks) {
                    this._addCustomInvalidHandler(callback);
                }
            } else {
                this._addCustomInvalidHandler(callbacks);
            }

            //chain
            return this;
        }
    }

    valid(callbacks) {
        if (this.callingConfigureMethod('valid')) {
            if (Array.isArray(callbacks)) {
                for(let callback of callbacks) {
                    this._addCustomValidHandler(callback);
                }
            } else {
                this._addCustomValidHandler(callbacks);
            }

            //chain
            return this;
        }
    }

    icon(icon) {
        if (this.callingConfigureMethod('icon')) {
            this._icon = icon || null;

            //chain
            return this;
        }
    }

    template() {
        //do the check here, when calling this it will always eventually have to check (Even if extended FormeInput) because we need these base values by calling super.template()!
        if (utils.call.check.active(this._form, 'input.template()')) {
            const errors = this._form._request._fetchInputErrors(this._name).map(error => error.error);
            const type = this._calculateType();
            const alias = this._outputName();
            const required = !this._form._unrequire && this._required;

            //build input class names
            const classNames = [];
            const stateClassNames = [];

            //input or button
            if (type === 'button' || type === 'submit') {
                if (this._form._buttonClassNames.length) {
                    for (let className of this._form._buttonClassNames) {
                        classNames.push(className);
                    }
                }
            } else {
                if (this._form._inputClassNames.length) {
                    for (let className of this._form._inputClassNames) {
                        classNames.push(className);
                    }
                }
            }

            //error (state)
            if (errors.length && this._form._errorClassNames.length) {
                for (let className of this._form._errorClassNames) {
                    classNames.push(className);
                    stateClassNames.push(className)
                }
            }

            //required (state)
            if (required && this._form._requiredClassNames.length) {
                for (let className of this._form._requiredClassNames) {
                    classNames.push(className);
                    stateClassNames.push(className)
                }
            }

            //input custom defined via input.className()
            if (this._classNames.length) {
                for (let className of this._classNames) {
                    classNames.push(className);
                }
            }

            return {
                id: this._id !== null ? this._id : 'forme_input__' + this._name,
                name: this._name,
                alias: alias,
                className: classNames.join(' '),
                stateClassName: stateClassNames.join(' '),
                icon: this._icon,
                data: Object.assign({}, ...this._data.map(data => ({['data-' + data.name]: data.value}))),
                label: this._label,
                help: this._help,
                type: type,
                placeholder: this._placeholder,
                required: required,
                readonly: this._readonly,
                value: this._form._request._values[this._name],
                checked: (this._form._request._pageFirst && this._checked) || (!this._form._request._pageFirst && ((type === 'checkbox' && this._form._request._values[this._name] !== null) || (type !== 'checkbox' && this._form._request._values[this._name] !== null))),
                errors: errors && errors.length ? errors : null,
                options: this._options,
                context: this._context,
            }
        }
    }
}

//expose module
module.exports = FormeInput;