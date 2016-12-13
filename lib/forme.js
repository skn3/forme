'use strict';

//module imports
const async = require('async');
const format = require('string-template');
const extend = require('extend');

//local imports
const FormeSessionHandler = require('./session.js');
const Input = require('./input.js');

const FormHandlerRequire = require('./handlers/form/formHandlerRequire.js');

//main class
class Forme {
    constructor(name) {
        this._name = name || 'undefined';
        this._label = 'Undefined';
        this._action = '';
        this._method = 'POST',
        this._inputs = [];
        this._sessionHandler = FormeSessionHandler;//default handler
        this._context = {};
        this._validateHandlers = [];
        this._submitHandlers = [];
    }

    //internal
    _findInput(source) {
        if (source instanceof Input) {
            return source;
        } else {
            for (let index = 0; index < this._inputs.length; index++) {
                if (this._inputs[index].name == source) {
                    return this._inputs[index];
                }
            }

            return null;
        }
    }

    _findValue(req, input, submit, raw, defaultValue) {
        //make sure we have a valid input
        if (input == null) {
            return defaultValue;
        }

        const reqForm = req.forme[input._form._name];

        //check to see if input is forcing value
        if (!raw && input._permanentValue !== null) {
            return input._permanentValue;
        } else {
            //do some checks wbased on submit mode
            if (!submit) {
                //check in session
                if (reqForm.first) {
                    //first time so get value from input default
                    if (input._defaultValue !== null) {
                        return input._defaultValue;
                    }
                } else {
                    //load value from session
                    if (raw) {
                        //raw value
                        if (reqForm.session.raw[input._name] == 'undefined') {
                            //blank/empty value
                            return null;

                        } else {
                            //value from session
                            return reqForm.session.raw[input._name];
                        }
                    } else {
                        //computed value
                        if (reqForm.session.values[input._name] == 'undefined') {
                            //blank/empty value
                            return null;

                        } else {
                            //value from session
                            return reqForm.session.values[input._name];
                        }
                    }
                }
            } else {
                //submitted values are always considered raw!
                switch (this._method) {
                    case 'GET':
                        if (typeof req.query != 'undefined' && typeof req.query[input._name] != 'undefined') {
                            return req.query[input._name];
                        }
                        break;
                    case 'POST':
                        if (typeof req.body != 'undefined' && typeof req.body[input._name] != 'undefined') {
                            return req.body[input._name];
                        }
                        break;
                }
            }
        }

        //ok use the passed in default value
        return defaultValue;
    }

    _process(req, submit) {
        //general purpose form processing for various scenarios
        const that = this;

        //prepare the request object
        req.forme = req.forme || {};
        req.forme[this._name] = {
            //base session object
            session: {
                raw: {},
                values: {},
                errors: [],
                first: !submit,
            },

            //form values
            raw: [],
            values: {},
            errors: [],
            stored: false,
            first: !submit,
        };
        const reqForm = req.forme[this._name];

        //add template function
        reqForm.template = function () {
            return that._buildTemplate(reqForm);
        }

        //need to load the session
        if (this._sessionHandler) {
            //let session handler do load
            return this._sessionHandler.load(req, this)
            .then(function(session) {
                //save session into the form
                extend(reqForm.session, session);

                //copy data from session (todo: perhaps we can just rely in teh session object and get rid of separate form details)
                reqForm.errors = reqForm.session.errors;
                reqForm.first = reqForm.session.first;

                //get values
                let input;
                for (let index = 0; index < that._inputs.length; index++) {
                    input = that._inputs[index];

                    //get values for this input
                    reqForm.raw[input._name] = that._findValue(req, input, submit, true, null);
                    reqForm.values[input._name] = that._findValue(req, input, submit, false, null);
                }

                //clear the session
                return that._sessionHandler.clear(req, that);
            });
        } else {
            //we don't have a session handler so do the best we can
            //get values
            let input;
            for (let index = 0; index < that._inputs.length; index++) {
                input = that._inputs[index];

                //get values for this input
                reqForm.raw[input._name] = that._findValue(req, input, submit, true, null);
                reqForm.values[input._name] = that._findValue(req, input, submit, false, null);
            }

            //finished
            return Promise.resolve();
        }
    }

    _buildInputConditions(conditions) {
        const build = [];

        if (typeof conditions == 'string') {
            //single string
            build.push([conditions]);
        } else if (conditions instanceof Array) {
            //array of ?
            for(let index = 0;index < conditions.length;index++) {
                if (typeof conditions[index] == 'string') {
                    //single string
                    build.push([conditions[index]]);
                } else if (conditions[index] instanceof Array) {
                    //provided an array so we need to add all strings
                    let subBuild = [];
                    for(let subIndex = 0;subIndex < conditions[index].length;subIndex++) {
                        if (typeof conditions[index][subIndex] == 'string') {
                            subBuild.push(conditions[index][subIndex]);
                        }
                    }

                    //only bother adding if it has any valid strings
                    if (subBuild.length) {
                        build.push(subBuild);
                    }
                }
            }
        }

        return build;
    }

    _buildTemplate(reqForm) {
        //return template details for the form
        const inputs = this._inputs;
        const formRaw = reqForm.raw;
        const formValues = reqForm.values;
        const formErrors = reqForm.errors;
        const template = {
            form: {
                name: this._name,
                method: this._method,
                action: this._action,
                context: this._context,
            },
            input: {}
        };
        let input;

        for (let inputIndex = 0; inputIndex < inputs.length; inputIndex++) {
            input = inputs[inputIndex];

            //build input errors array
            let errors = [];
            for (let errorIndex = 0; errorIndex < formErrors.length; errorIndex++) {
                if (formErrors[errorIndex].name == input.name) {
                    errors.push(formErrors[errorIndex].error);
                }
            }

            //create input details
            const buildInput = {
                name: input._name,
                className: input._classNames.join(' '),
                label: input._label,
                help: input._help,
                type: input._calculateType(),
                placeholder: input._placeholder,
                required: input._required,
                readonly: input._readonly,
                value: formValues[input._name],
                checked: (reqForm.first && input._checked) || (!reqForm.first && formRaw[input._name] == formValues[input._name]),
                errors: errors,
                options: input._options,
                context: input._context,
            };

            //add to template object
            if (typeof template.input[input._group] == 'undefined') {
                //first
                template.input[input._group] = buildInput;
            } else {
                if (!(template.input[input._group] instanceof Array)) {
                    //convert to array
                    template.input[input._group] = [template.input[input._group]];
                }

                //add
                template.input[input._group].push(buildInput);
            }
        }

        //done
        return template;
    }

    _validateInputs(req) {
        //iterate inputs 1 by 1, and then reject if ANY error was found (after)
        const that = this;
        let errors = [];
        let index = 0;

        function validate() {
            //validate and process
            return that._inputs[index]._validate(req)
            .then(next)
            .catch(error);
        }

        function next() {
            //next or last iteration
            if (++index == that._inputs.length) {
                return Promise.resolve();
            } else {
                return validate();
            }
        }

        function error(err) {
            //error always tries to continue iteration
            errors.push(err);
            return next();
        }

        return new Promise(function(resolve, reject) {
            validate().then(function(){
                //finished iteration
                if (errors.length) {
                    reject();
                } else {
                    resolve();
                }
            });
        });
    }

    _validateNextFormHandler(req, index) {
        const that = this;
        const handler = that._validateHandlers[index];

        //current submit
        return new Promise(function(resolve, reject) {
            return handler.execute(req, that).then(function () {
                //success
                resolve();
            }).catch(function (err) {
                //extract error string from catch
                let error = err.message || err || '';

                //use handler specified error instead
                if (handler.error !== null) {
                    error = handler.error;
                }

                //apply inline template vars
                error = format(error, {
                    name: that._name,
                    label: that._label,
                });

                //add error to form
                that.error(req, null, error);

                //pass modified error down catch chain
                reject(error);
            });
        }).then(function(){
            //next submit
            if (++index == that._validateHandlers.length) {
                return Promise.resolve();
            } else {
                return that._validateNextFormHandler(req, index);
            }
        });
    }

    _submitNextInput(req, index) {
        const that = this;

        //current input
        return that._inputs[index]._submit(req)
        .then(function(){
            //next input
            if (++index == that._inputs.length) {
                return Promise.resolve();
            } else {
                return that._submitNextInput(req, index);
            }
        });
    }

    _submitNextFormHandler(req, index) {
        const that = this;

        //current submit
        return that._submitHandlers[index].call(that, req, that)
        .then(function(){
            //next submit
            if (++index == that._submitHandlers.length) {
                return Promise.resolve();
            } else {
                return that._submitNextFormHandler(req, index);
            }
        });
    }

    //methods
    name(name) {
        this._name = name;

        //chain
        return this;
    }

    post(action) {
        this._method = 'POST';
        this._action = action;

        //chain
        return this;
    }

    get(action) {
        this._method = 'GET';
        this._action = action;

        //chain
        return this;
    }

    session(sessionHandler) {
        if (sessionHandler === undefined) {
            //use default
            this._sessionHandler = FormeSessionHandler;
        } else {
            this._sessionHandler = sessionHandler;
        }

        //chain
        return this;
    }

    add(name) {
        const input = new Input(this, name);
        this._inputs.push(input);

        //chain
        return input;
    }
    
    error(req, name, error) {
        req.forme[this._name].errors.push({
            name: name,
            error: error,
        });
    }

    value(req, input) {
        //find input
        if (typeof input == 'string') {
            input = this._findInput(input);
        }

        //check input exists
        if (input == null) {
            return null;
        }

        //return the value
        return req.forme[this._name].values[input._name];
    }

    values(req) {
        //get all values
        return req.forme[this._name].values;
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

    submit(handler) {
        //add a submit handler
        this._submitHandlers.push(handler);

        //chain
        return this;
    }

    raw(req, input) {
        //find input
        input = this._findInput(input);
        if (input == null) {
            return null;
        }

        //return the value
        return req.forme[this._name].raw[input._name];
    }

    fetchValues(req, secure, group, raw) {
        //build values
        const values = {};
        const groupState = {};

        let input;
        let value;
        const reqForm = req.forme[this._name];

        for (let index = 0;index < this._inputs.length;index++) {
            input = this._inputs[index];

            //only allow unsecured values
            if (!secure || !input._secure) {
                //by this point, values will always be ready to use from the req object
                //raw or value?
                if (raw) {
                    value = reqForm.raw[input._name];
                } else {
                    value = reqForm.values[input._name];
                }

                //are we grouping values?
                if (!group) {
                    //non grouped, use name per input
                    values[input._name] = value;
                } else {
                    //group values
                    if (typeof groupState[input._group] == 'undefined') {
                        //single value
                        values[input._group] = value;
                        groupState[input._group] = 1;
                    } else {
                        //array value
                        if (groupState[input._group] == 1) {
                            //convert to array
                            values[input._group] = [values[input._group]];
                            groupState[input._group] = 2;
                        }

                        //add to group
                        values[input._group].push(value);
                    }
                }
            }
        }

        //done
        return values;
    }

    changeValue(req, input, value) {
        //find input
        input = this._findInput(input);
        if (input == null) {
            return null;
        }
        
        //change the value
        req.forme[this._name].values[input._name] = value;
    }

    //operation api
    view(req) {
        //viewing the form (rendering is not *yet?*) handled by this module)
        const that = this;

        return this._process(req, false).then(function(){
            return {
                req: req,
                form: that,
            };
        });
    }

    validate(req) {
        const that = this;

        return this._process(req, true).then(function() {
            //execute all input validate
            if (that._inputs.length == 0) {
                return true;
            } else {
                return that._validateInputs(req);
            }
        }).then(function(){
            //execute all form validate
            if (that._validateHandlers.length == 0) {
                return true;
            } else {
                return that._validateNextFormHandler(req, 0);
            }
        }).then(function() {
            //execute all input submit
            if (that._inputs.length == 0) {
                return true;
            } else {
                return that._submitNextInput(req, 0);
            }
        }).then(function() {
            //execute all form submit
            if (that._submitHandlers.length == 0) {
                return true;
            } else {
                return that._submitNextFormHandler(req, 0);
            }
        }).then(function(){
            //success (validated)
            return {
                validated: true,
                req: req,
                form: that,
                values: that.fetchValues(req, false, true, false),
                errors: null,
            } ;
        }).catch(function(err){
            //error processing form
            //need to change first state
            req.forme[that._name].first = false;

            //save session
            return new Promise(function(resolve, reject){
                that.store(req).then(function() {
                    //session saved
                    resolve(req.forme[that._name].errors);
                }).catch(function(err){
                    //failed to save session
                    //add error
                    let errors = req.forme[that._name].errors.slice();
                    errors.push(err);

                    resolve(errors);
                });
            }).then(function(errors){
                return Promise.resolve({
                    validated: false,
                    req: req,
                    form: that,
                    values: that.fetchValues(req, false, true, false),
                    errors: errors,
                });
            });
        });
    }

    store(req) {
        const that = this;
        const reqForm = req.forme[this._name];
        
        //store values in session
        reqForm.stored = true;

        if (this._sessionHandler) {
            //crete session data (todo: allow user code to add details to session)
            let data = {
                raw: this.fetchValues(req, true, false, true),
                values: this.fetchValues(req, true, false, false),
                errors: reqForm.errors,
                first: reqForm.first,
            };

            //attempt to save session
            return this._sessionHandler.save(req, this, data).then(function() {
                return {
                    req: req,
                    form: that,
                };
            });
        } else {
            //success (as no session handler)
            return Promise.resolve({
                req: req,
                form: that,
            });
        }
    }
    
    //handler methods
    require(conditions, op, error) {
        //build list of arrays
        conditions = this._buildInputConditions(conditions);
        if (conditions.length) {
            //add handler
            this._validateHandlers.push(new FormHandlerRequire(conditions, op, error));
        }

        //chain
        return this;
    }
}

//expose module
module.exports = function(name, method, session) {
    return new Forme(name, method, session);
};