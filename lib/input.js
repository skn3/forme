'use strict';

//hello :D

//module imports
const format = require('string-template');

//local imports
const constants = require('./constants');
const utils = require('./utils');

const FormeBaseInput = require('./baseInput');
const FormeInputError = require('./errors').FormeInputError;

const InputProcessHandler = require('./handlers/input/inputProcessHandler');
const InputValidateHandler = require('./handlers/input/inputValidateHandler');

const {FormeConfigurableMethod} = require('./configurable');

//main class
class FormeInput extends FormeBaseInput {
    constructor(form, page, name) {
        super('input', form, page, name);

        this._special = false;
        this._convert = false;
        this._template = null;
    }

    //private configuration methods
    _buildConfigurableMethods() {
        return Object.assign(super._buildConfigurableMethods(), {
            //input.next()
            next: new FormeConfigurableMethod('next'),

            //input.prev()
            prev: new FormeConfigurableMethod('prev'),

            //input.reset()
            reset: new FormeConfigurableMethod('reset'),

            //input.rerun()
            rerun: new FormeConfigurableMethod('rerun'),
        });
    }

    //private methods
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

    //private next methods
    _nextExecuteHandler(handlers, index) {
        const handler = handlers[index];

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
            if (++index < handlers.length) {
                return this._nextExecuteHandler(handlers, index);
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

    //private execute methods
    _executeHandlerByType(handler, state) {
        //decide which type of handler we are...handling!
        if (handler instanceof InputProcessHandler) {
            return this._executeProcessHandler(handler, state);
        } else if (handler instanceof InputValidateHandler) {
            return this._executeValidateHandler(handler, state);
        } else {
            return Promise.reject(this._createError(`unknown execution handler '${handler}'`, this));
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

    //private create methods
    _createError(message) {
        return new FormeInputError(message);
    }

    _createState(value) {
        return {
            require: false,
            value: value,
        };
    }

    //private methods
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
                if (this._actionTriggers !== null) {
                    for(let action of this._actionTriggers) {
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
                            let handlerType = handler.htmlInputType;
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

    //templating
    templateVars() {
        //do the check here, when calling this it will always eventually have to check (Even if extended FormeInput) because we need these base values by calling super.templateVars()!
        if (this.callingActiveMethod('templateVars')) {
            //build component vars ( if we have any)
            return (this._component?this._component.templateVars():Promise.resolve(null))

            //now build input vars
            .then(componentVars => {
                const errors = this._form._request._fetchInputErrors(this._name).map(error => error.error);
                const type = this._calculateType();
                const alias = this._outputName;
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

                //build the vars (remembering to merge the component vars)
                return Object.assign({
                    id: this._id !== null ? this._id : `__forme_auto_id__${this._name}`,
                    name: this._name,
                    alias: alias,
                    className: classNames.join(' '),
                    stateClassName: stateClassNames.join(' '),
                    icon: this._icon,
                    data: Object.assign({}, ...this._data.map(data => ({['data-' + data.name]: data.value}))),
                    label: this._label,
                    help: this._help,
                    type: type,
                    component: null,//will get overridden by this._component.templateVars()
                    placeholder: this._placeholder,
                    required: required,
                    readonly: this._readonly,
                    value: this._form._request._values[this._name],
                    checked: (this._form._request._pageFirst && this._checked) || (!this._form._request._pageFirst && ((type === 'checkbox' && this._form._request._values[this._name] !== null) || (type !== 'checkbox' && this._form._request._values[this._name] !== null))),
                    errors: errors && errors.length ? errors : null,
                    options: this._options,
                    context: this._context,

                    //input template vars (dont populate these yet because we might cause an infinite loop on user code. )
                    template: null,
                    rendered: null,
                }, componentVars);
            })

            //we have a complete vars object for this input
            .then(vars => {
                //does the input have a template
                if (!this._template) {
                    //no template so chain em!
                    return vars;
                } else {
                    //let the driver render the template!
                    return utils.promise.result(this._form._driver.renderInputTemplate(this._form, this, this._template, vars))
                    .then(rendered => {
                        //done, so lets dump details into rendered
                        vars.template = this._template;
                        vars.rendered = rendered || null;

                        //chain
                        return vars;
                    });
                }
            });
        }
    }

    //state
    value() {
        //we need to override this to check for different calling pattern
        //todo: modify this so we have value() and getValue();
        if (arguments.length === 0) {
            //get value, let the form decide where from
            return this._form._getInputNameValue(this._name);

        } else if (arguments.length === 1) {
            if (!this._form._isStarted() || this._form._isBuilding()) {
                //set the default value (e.g. the form is still building)
                return super.value(...arguments);
            } else {
                //set runtime value (e.g. modify submitted value)
                this._form._setInputNameValue(this._name, arguments[0]);
            }

            //chain
            return this;
        }
    }

    error(error) {
        //shortcut to add a message (container handles input piping)
        if (this.callingActiveMethod('error')) {
            return this._form.error(this._name, error);
        }
    }
}

//expose module
module.exports = FormeInput;