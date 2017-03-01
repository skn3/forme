'use strict';

//hello :D

//module imports
const format = require('string-template');

//local imports
const constants = require('./constants');
const utils = require('./utils');

const FormeBase = require('./base');
const FormeInputError = require('./errors').FormeInputError;

const InputHandlerRequire = require('./handlers/input/inputHandlerRequire');
const InputHandlerOptions = require('./handlers/input/inputHandlerOption');
const InputHandlerSize = require('./handlers/input/inputHandlerSize');
const InputHandlerValidate = require('./handlers/input/inputHandlerValidate');
const InputHandlerHandler = require('./handlers/input/inputHandlerHandler');
const InputHandlerIs = require('./handlers/input/inputHandlerIs');
const InputHandlerMatch = require('./handlers/input/inputHandlerMatch');
const InputHandlerConvert = require('./handlers/input/inputHandlerConvert');
const InputHandlerBlacklist = require('./handlers/input/inputHandlerBlacklist');

//main class
class FormeInput extends FormeBase {
    constructor(form, name) {
        super(name);
        this._form = form;
        this._group = null;
        this._pipe = false;
        this._special = false;
        this._ignore = false;
        this._id = null;
        this._actions = null;
        this._alias = null;
        this._help = '';
        this._placeholder = null;
        this._readonly = false;
        this._required = false;
        this._keep = false;
        this._type = null;
        this._defaultValue = null;
        this._permanentValue = null;
        this._secure = false;
        this._hidden = false;
        this._checked = null;
        this._options = [];
        this._validateHandlers = [];
        this._classNames = [];
        this._submitHandlers = [];
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
        const clone = new FormeInput();

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

    _addSubmitHandler(callback) {
        this._submitHandlers.push(callback);
    }

    _nextValidateHandler(index, state) {
        const handler = this._validateHandlers[index];

        //remember value so we can see if it changed
        const oldValue = state.value;

        //process handler and make sure to get uptodate value from container
        return new Promise((resolve, reject) => {
            return handler.execute(this, state)
            .then(() => {
                //update value if it has changed
                if (state.value !== oldValue) {
                    this._form._setInputValue(this, state.value);
                }
                resolve();
            })
            .catch(err => {
                //extract error string from catch
                let error = err.message || '';

                //update value if it has changed
                if (state.value !== oldValue) {
                    this._form._setInputValue(this, state.value);
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
            });
        })
        .then(() => ++index == this._validateHandlers.length ? Promise.resolve() : this._nextValidateHandler(index, state))
        .catch(err => {
            //unhandled error
            this._form._catchError(err);
        });
    }

    _nextSubmitHandler(index) {
        const handler = this._submitHandlers[index];

        //current submit
        return utils.promise.result(handler.call(this, this.form, this))
        .then(() => ++index == this._submitHandlers.length ? Promise.resolve() : this._nextSubmitHandler(index));
    }

    _validate() {
        //start iteration
        if (this._validateHandlers.length == 0) {
            return Promise.resolve();
        } else {
            return this._nextValidateHandler(0, {
                require: false,
                value: this._form._getInputValue(this),
            });
        }
    }

    _submit() {
        if (this._submitHandlers.length == 0) {
            return Promise.resolve();
        } else {
            return this._nextSubmitHandler(0);
        }
    }

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
                                case constants.actions.submit:
                                    return 'submit';
                                    break;
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
                        for (let index = 0; index < this._validateHandlers.length; index++) {
                            let handler = this._validateHandlers[index];

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

    _findAction(name) {
        for (let action of this._actions) {
            if (action.action == name) {
                return action;
            }
        }
        return null;
    }

    _addActions(actions, value, context, special) {
        if (utils.call.check.not.active(this._form, 'input.action()')) {
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

    //handler methods
    id(id) {
        if (utils.call.check.not.active(this._form, 'input.id()')) {
            //allow to override id
            this._id = id;

            //chain
            return this;
        }
    }

    type(type) {
        if (utils.call.check.not.active(this._form, 'input.type()')) {
            this._type = type;

            //chain
            return this;
        }
    }

    className(name) {
        if (utils.call.check.not.active(this._form, 'input.className()')) {
            //add a class
            if (typeof name == 'string') {
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

    help(help) {
        if (utils.call.check.not.active(this._form, 'input.help()')) {
            this._help = help;

            //chain
            return this;
        }
    }

    require(error) {
        if (utils.call.check.not.active(this._form, 'input.require()')) {
            //any value is required
            this._required = true;

            //add handler
            this._validateHandlers.push(new InputHandlerRequire(error));

            //chain
            return this;
        }
    }

    size(size, error) {
        if (utils.call.check.not.active(this._form, 'input.size()')) {
            //requires exact size

            //add handler
            this._validateHandlers.push(new InputHandlerSize(size, size, error));

            //chain
            return this;
        }
    }

    min(size, error) {
        if (utils.call.check.not.active(this._form, 'input.min()')) {
            //requires min size

            //add handler
            this._validateHandlers.push(new InputHandlerSize(size, null, error));

            //chain
            return this;
        }
    }

    max(size, error) {
        if (utils.call.check.not.active(this._form, 'input.max()')) {
            //requires max

            //add handler
            this._validateHandlers.push(new InputHandlerSize(null, size, error));

            //chain
            return this;
        }
    }

    is(type, error) {
        if (utils.call.check.not.active(this._form, 'input.is()')) {
            //validate the value against various value types
            this._validateHandlers.push(new InputHandlerIs(type, error));

            //chain
            return this;
        }
    }

    match(target, error) {
        if (utils.call.check.not.active(this._form, 'input.match()')) {
            //validate the value against various value types
            this._validateHandlers.push(new InputHandlerMatch(target, error));

            //chain
            return this;
        }
    }

    options(options, error) {
        if (utils.call.check.not.active(this._form, 'input.options()')) {
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
            this._validateHandlers.push(new InputHandlerOptions(error));

            //chain
            return this;
        }
    }

    validate(callback, error) {
        if (utils.call.check.not.active(this._form, 'input.validate()')) {
            //validate callback, user must return a promise

            //add handler
            this._validateHandlers.push(new InputHandlerValidate(callback, error));

            //chain
            return this;
        }
    }

    submit(callback) {
        if (arguments.length == 0) {
            //set to submit button
            if (utils.call.check.not.active(this._form, 'input.submit()')) {
                this._addActions(constants.actions.submit, null, null, true);
                this._defaultValue = this._defaultValue !== null?this._defaultValue:this._name;
                this._special = true;

                //chain
                return this;
            }
        } else {
            //add submit callback
            if (utils.call.check.not.active(this._form, 'input.submit()')) {
                this._addSubmitHandler(arguments[0]);

                //chain
                return this;
            }
        }
    }

    handler(callback) {
        //todo: remove this?
        if (utils.call.check.not.active(this._form, 'input.handler()')) {
            //generic callback for custom

            //add handler
            this._validateHandlers.push(new InputHandlerHandler(callback));

            //chain
            return this;
        }
    }

    secure(secure) {
        if (utils.call.check.not.active(this._form, 'input.secure()')) {
            //prevent secure mode whilst keeping
            if (this._keep) {
                throw new Error('cant use input.secure() after input.keep()');
            }

            //prevent this value from being stored by the app between container calls
            this._secure = utils.value.bool(secure, true);

            //chain
            return this;
        }
    }

    bool(force) {
        if (utils.call.check.not.active(this._form, 'input.bool()')) {
            //convert value to bool, force indicates this the value will be forced to exist

            //add handler
            this._validateHandlers.push(new InputHandlerConvert('bool', force));

            //chain
            return this;
        }
    }

    int(force) {
        if (utils.call.check.not.active(this._form, 'input.int()')) {
            //convert value to int, force indicates this the value will be forced to exist

            //add handler
            this._validateHandlers.push(new InputHandlerConvert('int', force));

            //chain
            return this;
        }
    }

    string(force) {
        if (utils.call.check.not.active(this._form, 'input.string()')) {
            //convert value to int, force indicates this the value will be forced to exist

            //add handler
            this._validateHandlers.push(new InputHandlerConvert('string', force));

            //chain
            return this;
        }
    }

    float(force) {
        if (utils.call.check.not.active(this._form, 'input.float()')) {
            //convert value to int, force indicates this the value will be forced to exist

            //add handler
            this._validateHandlers.push(new InputHandlerConvert('float', force));

            //chain
            return this;
        }
    }

    alias(alias) {
        if (utils.call.check.not.active(this._form, 'input.alias()')) {
            //change the name used in template var / values
            this._alias = alias;

            //chain
            return this;
        }
    }

    group(segments) {
        if (utils.call.check.not.active(this._form, 'input.group()')) {
            //change teh group the input will be added to (used by templating)
            if (this._group === null) {
                this._group = [];
            }

            if (Array.isArray(segments)) {
                //array of
                for (let index = 0; index < segments.length; index++) {
                    this._group.push(segments[index]);
                }
            } else {
                //single
                this._group.push(segments);
            }

            //chain
            return this;
        }
    }

    checked(checked) {
        if (utils.call.check.not.active(this._form, 'input.checked()')) {
            //change default checked state
            this._checked = utils.value.bool(checked, true);

            //chain
            return this;
        }
    }

    permanent(permanent) {
        if (utils.call.check.not.active(this._form, 'input.permanent()')) {
            //forces the value to always be this when returned to the template or validation
            this._permanentValue = utils.value.bool(permanent, true);

            //chain
            return this;
        }
    }

    blacklist(options, error) {
        if (utils.call.check.not.active(this._form, 'input.blacklist()')) {
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
            this._validateHandlers.push(new InputHandlerBlacklist(list, error));

            //chain
            return this;
        }
    }

    placeholder(placeholder) {
        if (utils.call.check.not.active(this._form, 'input.placeholder()')) {
            //modify the placeholder text
            this._placeholder = placeholder;

            //chain
            return this;
        }
    }

    readonly(readonly) {
        if (utils.call.check.not.active(this._form, 'input.readonly()')) {
            //change default readonly state
            this._readonly = utils.value.bool(readonly, true);

            //chain
            return this;
        }
    }

    hidden(hidden) {
        if (utils.call.check.not.active(this._form, 'input.hidden()')) {
            //change default hidden state
            this._hidden = utils.value.bool(hidden, true);

            //chain
            return this;
        }
    }

    action(actions, value, context) {
        if (utils.call.check.not.active(this._form, 'input.action()')) {
            this._addActions(actions, value, context, false);

            //chain
            return this;
        }
    }

    next() {
        if (utils.call.check.not.active(this._form, 'input.next()')) {
            this._addActions(constants.actions.next, null, null, true);
            this._defaultValue = this._defaultValue !== null?this._defaultValue:this._name;
            this._special = true;

            //chain
            return this;
        }
    }

    prev() {
        if (utils.call.check.not.active(this._form, 'input.prev()')) {
            this._addActions(constants.actions.prev, null, null, true);
            this._defaultValue = this._defaultValue !== null?this._defaultValue:this._name;
            this._special = true;

            //chain
            return this;
        }
    }

    reset() {
        if (utils.call.check.not.active(this._form, 'input.reset()')) {
            this._addActions(constants.actions.reset, null, null, true);
            this._defaultValue = this._defaultValue !== null?this._defaultValue:this._name;
            this._special = true;

            //chain
            return this;
        }
    }

    keep(keep) {
        if (utils.call.check.not.active(this._form, 'input.keep()')) {
            if (this._secure) {
                throw new Error('cant use input.keep() after input.secure()');
            }

            this._keep = utils.value.bool(keep, true);

            //chain
            return this;
        }
    }

    //request api
    error(message) {
        //shortcut to add a message (container handles input piping)
        if (utils.call.check.active(this._form, 'input.error()')) {
            return this._form.error(this._name, message);
        }
    }

    value() {
        if (this._form._request === null || this._form._request._building || !this._form._request._started) {
            //set the default value
            this._defaultValue = arguments.length?arguments[0]:null;

            //chain
            return this;
        } else {
            if (arguments.length == 0) {
                //get value
                return this._form._getInputValue(this, arguments[0]);
            } else if (arguments.length == 1) {
                //set value
                this._form._setInputValue(this, arguments[0]);

                //chain
                return this;
            }
        }
    }

    pipe(target) {
        if (utils.call.check.not.active(this._form, 'input.pipe()')) {
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
        if (utils.call.check.not.active(this._form, 'input.ignore()')) {
            this._ignore = utils.value.bool(ignore, true);

            //chain
            return this;
        }
    }
}

//expose module
module.exports = FormeInput;