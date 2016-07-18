'use strict';

//module imports
var format = require('string-template');
var async = require('async');

//local imports
var InputHandlerRequire = require('./handlers/input/inputHandlerRequire.js');
var InputHandlerOptions = require('./handlers/input/inputHandlerOption.js');
var InputHandlerSize = require('./handlers/input/inputHandlerSize.js');
var InputHandlerCallback = require('./handlers/input/inputHandlerCallback.js');
var InputHandlerIs = require('./handlers/input/inputHandlerIs.js');
var InputHandlerConvert = require('./handlers/input/inputHandlerConvert.js');

//main class
class Input {
    constructor(form, name) {
        this._form = form;
        this._group = name,
        this._name = name;
        this._label = name;
        this._defaultValue = null;
        this._permanentValue = null;
        this._secure = false;
        this._checked = false;
        this._options = [];
        this._handlers = [];
    }

    //properties
    get name() {
        return this._name;
    }

    //methods
    execute(req, callback) {
        var that = this;

        //create base state
        var state = {
            require: false,
            value: that._form.value(req, this),
        };

        //execute all handlers
        async.eachSeries(this._handlers, function(handler, next) {
            //remember value so we can see if it changed
            var oldValue = state.value;

            //process handler and make sure to get uptodate value from form
            handler.execute(req, that, state, function(error) {
                //update value if it has changed
                if (state.value !== oldValue) {
                    that._form.changeValue(req,that,state.value);
                }

                //finish handler
                if (error) {
                    //error
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

                    //cancel execute loop
                    next(error);
                } else {
                    //success
                    next();
                }
            });
        }, function(err) {
            //finished executing all handlers
            callback();
        })

        //chain
        return this;
    }

    //handler methods
    value(value) {
        //set the default value
        this._defaultValue = value;
        
        //chain
        return this;
    }

    label(label) {
        this._label = label;

        //chain
        return this;
    }

    //built in handler constructors
    require(error) {
        //any value is required

        //add handler
        this._handlers.push(new InputHandlerRequire(error));

        //chain
        return this;
    }

    size(size, error) {
        //requires exact size

        //add handler
        this._handlers.push(new InputHandlerSize(size, size, error));

        //chain
        return this;
    }

    min(size, error) {
        //requires min size

        //add handler
        this._handlers.push(new InputHandlerSize(size, null, error));

        //chain
        return this;
    }

    max(size, error) {
        //requires max

        //add handler
        this._handlers.push(new InputHandlerSize(null, size, error));

        //chain
        return this;
    }

    is(type, error) {
        //validate the value against various value types
        this._handlers.push(new InputHandlerIs(type, error));

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
                    for(var index = 0;index < options.length;index++) {
                        if (typeof options[index].value != 'undefined') {
                            this._options.push({
                                label: typeof options[index].label != 'undefined'?options[index].label:options[index].value,
                                value: options[index].value,
                            });
                        }
                    }
                } else {
                    //array of values
                    for(var index = 0;index < options.length;index++) {
                        this._options.push({
                            label: options[index],
                            value: options[index],
                        });
                    }
                }
            }
        } else if (options instanceof Object) {
            //object with value/label pairs
            for(var label in options) {
                this._options.push({
                    label: label,
                    value: options[label],
                });
            }
        }

        //add handler
        this._handlers.push(new InputHandlerOptions(error));

        //chain
        return this;
    }

    callback(callback) {
        //generic callback for custom

        //add handler
        this._handlers.push(new InputHandlerCallback(callback));

        //chain
        return this;
    }

    secure() {
        //prevent this value from being stored by the app between form calls
        this._secure = true;

        //chain
        return this;
    }

    bool(force) {
        //convert value to bool, force indicates that the value will be forced to exist

        //add handler
        this._handlers.push(new InputHandlerConvert('bool', force));

        //chain
        return this;
    }

    int(force) {
        //convert value to int, force indicates that the value will be forced to exist

        //add handler
        this._handlers.push(new InputHandlerConvert('int', force));

        //chain
        return this;
    }

    string(force) {
        //convert value to int, force indicates that the value will be forced to exist

        //add handler
        this._handlers.push(new InputHandlerConvert('string', force));

        //chain
        return this;
    }

    float(force) {
        //convert value to int, force indicates that the value will be forced to exist

        //add handler
        this._handlers.push(new InputHandlerConvert('float', force));

        //chain
        return this;
    }

    group(group) {
        //change teh group the input will be added to (used by templating)
        this._group = group;

        //chain
        return this;
    }

    checked() {
        //param is optional. if no param provided then defaults to true
        var checked = true;
        if (arguments.length > 0) {
            //undefined/null counts as false
            checked = typeof arguments[0] != 'undefined' && arguments[0];
        }

        //change default checked state
        this._checked = checked;

        //chain
        return this;
    }

    permanent(value) {
        //forces the value to always be this when returned to the template or validation
        this._permanentValue = value;

        //chain
        return this;
    }
}

//expose module
module.exports = Input;