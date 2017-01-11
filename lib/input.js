'use strict';

//module imports
const format = require('string-template');
const async = require('async');

//local imports
const InputHandlerRequire = require('./handlers/input/inputHandlerRequire.js');
const InputHandlerOptions = require('./handlers/input/inputHandlerOption.js');
const InputHandlerSize = require('./handlers/input/inputHandlerSize.js');
const InputHandlerValidate = require('./handlers/input/inputHandlerValidate.js');
const InputHandlerHandler = require('./handlers/input/inputHandlerHandler.js');
const InputHandlerIs = require('./handlers/input/inputHandlerIs.js');
const InputHandlerMatch = require('./handlers/input/inputHandlerMatch.js');
const InputHandlerConvert = require('./handlers/input/inputHandlerConvert.js');
const InputHandlerBlacklist = require('./handlers/input/inputHandlerBlacklist.js');

function getArgumentsBool(value, defaultValue) {
    //param is optional. if no param provided then defaults to true
    let result = defaultValue;

    if (value !== undefined) {
        result = value == true;
    }

    return result;
}

//main class
class Input {
    constructor(form, name) {
        this._form = form;
        this._group = name,
        this._name = name;
        this._label = name;
        this._help = '';
        this._placeholder = null;
        this._readonly = false;
        this._required = false;
        this._type = null,
        this._defaultValue = null;
        this._permanentValue = null;
        this._secure = false;
        this._hidden = false;
        this._checked = null;
        this._options = [];
        this._validateHandlers = [];
        this._classNames = [];
        this._context = {};
        this._submitHandlers = [];
    }

    //properties
    get name() {
        return this._name;
    }

    get form() {
        return this._form;
    }

    //internal
    _validateNextHandler(req, index, state) {
        const that = this;
        const handler = that._validateHandlers[index];

        //remember value so we can see if it changed
        const oldValue = state.value;

        //process handler and make sure to get uptodate value from form
        return new Promise(function(resolve, reject){
            return handler.execute(req, that, state)
            .then(function(){
                //update value if it has changed
                if (state.value !== oldValue) {
                    that._form.change(req,that,state.value);
                }

                //success
                resolve();
            })
            .catch(function(err) {
                //extract error string from catch
                let error = err.message || err || '';

                //update value if it has changed
                if (state.value !== oldValue) {
                    that._form.change(req, that, state.value);
                }

                //use handler specified error instead
                if (handler.error !== null) {
                    error = handler.error;
                }

                //apply inline template vars
                error = format(error,{
                    name: that._name,
                    label: that._label,
                });

                //add error to form
                that._form.error(req, that._name, error);

                //cancel iteration
                reject(error);
            });
        })
        .then(function(){
            //next
            if (++index == that._validateHandlers.length) {
                return Promise.resolve();
            } else {
                return that._validateNextHandler(req, index, state);
            }
        });
    }

    _submitNextHandler(req, index) {
        const that = this;
        const handler = that._submitHandlers[index];

        //current submit
        return handler.call(that, req, that.form, that)
        .then(function(){
            //next submit
            if (++index == that._submitHandlers.length) {
                return Promise.resolve();
            } else {
                return that._submitNextHandler(req, index);
            }
        });
    }

    _validate(req) {
        //start iteration
        if (this._validateHandlers.length == 0) {
            return Promise.resolve();
        } else {
            return this._validateNextHandler(req, 0, {
                require: false,
                value: this._form.value(req, this),
            });
        }
    }

    _submit(req) {
        if (this._submitHandlers.length == 0) {
            return Promise.resolve();
        } else {
            return this._submitNextHandler(req, 0);
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

    //handler methods
    value(value) {
        //set the default value
        this._defaultValue = value;
        
        //chain
        return this;
    }

    type(type) {
        this._type = type;

        //chain
        return this;
    }

    className(name) {
        //add a class
        if (typeof name == 'string') {
            let parts = name.split(' ');
            for(let index = 0; index < parts.length;index++) {
                let part = parts[index].trim();
                if (parts[index].length) {
                    this._classNames.push(part);
                }
            }
        } else if (Array.isArray(name)) {
            for (let arrayIndex = 0; arrayIndex < name.length;arrayIndex++) {
                let parts = name.split(' ');
                for(let index = 0; index < parts.length;index++) {
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

    label(label) {
        this._label = label;

        //chain
        return this;
    }

    help(help) {
        this._help = help;

        //chain
        return this;
    }

    //built in handler constructors
    require(error) {
        //any value is required
        this._required = true;

        //add handler
        this._validateHandlers.push(new InputHandlerRequire(error));

        //chain
        return this;
    }

    size(size, error) {
        //requires exact size

        //add handler
        this._validateHandlers.push(new InputHandlerSize(size, size, error));

        //chain
        return this;
    }

    min(size, error) {
        //requires min size

        //add handler
        this._validateHandlers.push(new InputHandlerSize(size, null, error));

        //chain
        return this;
    }

    max(size, error) {
        //requires max

        //add handler
        this._validateHandlers.push(new InputHandlerSize(null, size, error));

        //chain
        return this;
    }

    is(type, error) {
        //validate the value against various value types
        this._validateHandlers.push(new InputHandlerIs(type, error));

        //chain
        return this;
    }

    match(target, error) {
        //validate the value against various value types
        this._validateHandlers.push(new InputHandlerMatch(target, error));

        //chain
        return this;
    }

    options(options, error) {
        //a specific set of options is required

        //set options
        this._options = [];

        if (options instanceof Array) {
            //array of ?
            if (options.length) {
                if (options[0] instanceof Object) {
                    //value/label pair
                    for(let index = 0;index < options.length;index++) {
                        if (typeof options[index].value != 'undefined') {
                            this._options.push({
                                label: typeof options[index].label != 'undefined'?options[index].label:options[index].value,
                                value: options[index].value,
                            });
                        }
                    }
                } else {
                    //array of values
                    for(let index = 0;index < options.length;index++) {
                        this._options.push({
                            label: options[index],
                            value: options[index],
                        });
                    }
                }
            }
        } else if (options instanceof Object) {
            //object with value/label pairs
            for(let value in options) {
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

    validate(callback, error) {
        //validate callback, user must call provided valid() invalid() callbacks

        //add handler
        this._validateHandlers.push(new InputHandlerValidate(callback, error));

        //chain
        return this;
    }

    submit(callback) {
        //add a submit handler
        this._submitHandlers.push(callback);

        //chain
        return this;
    }

    handler(callback) {
        //generic callback for custom

        //add handler
        this._validateHandlers.push(new InputHandlerHandler(callback));

        //chain
        return this;
    }

    secure(secure) {
        //prevent this value from being stored by the app between form calls
        this._secure = getArgumentsBool(secure, true);

        //chain
        return this;
    }

    bool(force) {
        //convert value to bool, force indicates that the value will be forced to exist

        //add handler
        this._validateHandlers.push(new InputHandlerConvert('bool', force));

        //chain
        return this;
    }

    int(force) {
        //convert value to int, force indicates that the value will be forced to exist

        //add handler
        this._validateHandlers.push(new InputHandlerConvert('int', force));

        //chain
        return this;
    }

    string(force) {
        //convert value to int, force indicates that the value will be forced to exist

        //add handler
        this._validateHandlers.push(new InputHandlerConvert('string', force));

        //chain
        return this;
    }

    float(force) {
        //convert value to int, force indicates that the value will be forced to exist

        //add handler
        this._validateHandlers.push(new InputHandlerConvert('float', force));

        //chain
        return this;
    }

    group(group) {
        //change teh group the input will be added to (used by templating)
        this._group = group;

        //chain
        return this;
    }

    checked(checked) {
        //change default checked state
        this._checked = getArgumentsBool(checked, true);

        //chain
        return this;
    }

    permanent(value) {
        //forces the value to always be this when returned to the template or validation
        this._permanentValue = value;

        //chain
        return this;
    }

    blacklist(options, error) {
        //build list of values
        let list;

        if (options instanceof Array) {
            //array of ?
            list = options;
        } else if (options instanceof Object) {
            //object with value/label pairs
            for(let value in options) {
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

    placeholder(placeholder) {
        //modify the placeholder text
        this._placeholder = placeholder;

        //chain
        return this;
    }

    readonly(readonly) {
        //change default readonly state
        this._readonly = getArgumentsBool(readonly, true);

        //chain
        return this;
    }

    hidden(hidden) {
        //change default hidden state
        this._hidden = getArgumentsBool(hidden, true);

        //chain
        return this;
    }

    context() {
        //get or set a context
        if (arguments.length == 1) {
            //get
            if (this._context.hasOwnProperty(arguments[0])) {
                return this._context[arguments[0]];
            } else {
                return null;
            }
        } else if (arguments.length == 2) {
            //set
            this._context[arguments[0]] = arguments[1];
        }
    }

    //request api
    error(req, message) {
        //shortcut to add a message
        this._form.error(req, this._name, message);
    }

    change(req, value) {
        //change value in form
        this._form.change(req, this, value);
    }

    current(req) {
        //get the current value
        return this._form.value(req, this);
    }
}

//expose module
module.exports = Input;