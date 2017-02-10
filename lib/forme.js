'use strict';

//module imports
const format = require('string-template');
const extend = require('extend');

//local imports
const utils = require('./utils');

const FormeError = require('./errors').FormeError;
const FormeInputError = require('./errors').FormeInputError;
const FormeSessionHandler = require('./session');
const Input = require('./input');
const GroupStructure = require('./groupStructure');

const FormHandlerRequire = require('./handlers/form/formHandlerRequire');
const FormHandlerValidate = require('./handlers/form/formHandlerValidate');

//dev?
const dev = process.env.NODE_ENV == 'dev' || process.env.NODE_ENV == 'development';

//main class
class Forme {
    constructor(name) {
        this._name = name || 'undefined';
        this._label = this._name;
        this._action = '';
        this._method = 'POST',
        this._inputs = [];
        this._sessionHandler = FormeSessionHandler;//default handler
        this._context = {};
        this._validateHandlers = [];
        this._submitHandlers = [];
    }

    //functions
    static _addToGroupStructure(structure, name, group, value) {
        //this function assumes the structure has not been tampered with

        //find the destination
        let destination = structure;
        if (group !== null) {
            for (let targetIndex = 0; targetIndex < group.length; targetIndex++) {
                const segment = group[targetIndex];

                //verify structure
                if (!(destination[segment] instanceof GroupStructure)) {
                    destination = null;
                    break;
                }

                //next in chain
                destination = destination[segment];
            }
        }

        //we should now have a destination
        if (destination) {
            destination[name] = value;
        }
    }

    static _buildInputConditions(conditions) {
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

    static _findValueInState(state, lookup, name, defaultValue) {
        //lookup is a key/value pair, probably generated in the _fetchValues function
        if (lookup.name === undefined) {
            //not found
            return defaultValue;
        } else {
            //find path, continue until lookup path is exhausted
            let pointer = state.values;
            let lookupItem = lookup[name];

            for(let index = 0; index < lookupItem.length;index++) {
                if (pointer[lookupItem[index]] === undefined) {
                    return defaultValue;
                } else {
                    pointer = pointer[lookupItem[index]];
                }
            }

            //we now have the value
            return pointer;
        }
    }

    //methods
    _view(req, values) {
        //viewing the form (rendering is not *yet?*) handled by this module)
        return this._process(req, false, values)
        .then(() => ({
            req: req,
            form: this,
        }));
    }

    _validate(req, values) {
        //start validation
        return this._process(req, true, values)
        .then(() => this._inputs.length == 0 ? true: this._validateInputs(req))
        .then(() => this._validateHandlers.length == 0 ? true : this._validateNextFormHandler(req, 0))
        .then(() => this._inputs.length == 0 ? true : this._submitNextInput(req, 0))
        .then(() => this._submitHandlers.length == 0 ? true : this._submitNextFormHandler(req, 0))
        .then(() => ({
            validated: true,
            req: req,
            form: this,
            values: this._fetchValues(req, false, true, false, null),
            errors: null,
        }))
        .catch(err => {
            //error processing form
            //catch any unhandled errors
            this._catchError(req, err);

            //save session
            return new Promise((resolve, reject) => {
                const reqForm = req.forme[this._name];
                reqForm._first = false;

                return this.store(req)
                .then(() => {
                    //session saved, always resolve
                    resolve(reqForm._errors);
                })
                .catch(err => {
                    //failed to save session
                    //add error
                    let errors = reqForm._errors.slice();
                    errors.push(err);

                    //always resolve
                    resolve(errors);
                });
            })
            .then(errors => Promise.resolve({
                validated: false,
                req: req,
                form: this,
                values: this._fetchValues(req, false, true, false, null),
                errors: errors,
            }));
        });
    }

    _process(req, submit, values) {
        //general purpose form processing for various scenarios
        //prepare the request object
        req.forme = req.forme || {};
        req.forme[this._name] = {
            //base session object
            _session: {
                raw: {},
                values: {},
                errors: [],
                first: !submit,
            },

            //form values
            _raw: [],
            _values: {},
            _errors: [],
            _stored: false,
            _first: !submit,
        };

        const reqForm = req.forme[this._name];

        //add helper functions
        reqForm.template = () => this._buildTemplate(reqForm);
        reqForm.errors = name => this.errors(req, name);
        reqForm.values = () => this.values(req);
        reqForm.value = (name) => this.value(req, name);

        //need to load the session
        if (this._sessionHandler) {
            //let session handler do load
            return this._sessionHandler.load(req, this)
            .then(session => {
                //save session into the form
                extend(reqForm._session, session);

                //copy data from session (todo: perhaps we can just rely in teh session object and get rid of separate form details)
                reqForm._errors = reqForm._session.errors;
                reqForm._first = reqForm._session.first;

                //get values
                let input;
                for (let index = 0; index < this._inputs.length; index++) {
                    input = this._inputs[index];

                    //get values for this input
                    reqForm._raw[input._name] = this._findValue(req, input, submit, true, null, values);
                    reqForm._values[input._name] = this._findValue(req, input, submit, false, null, values);
                }

                //clear the session
                return this._sessionHandler.clear(req, this);
            });
        } else {
            //we don't have a session handler so do the best we can
            //get values
            let input;
            for (let index = 0; index < this._inputs.length; index++) {
                input = this._inputs[index];

                //get values for this input
                reqForm._raw[input._name] = this._findValue(req, input, submit, true, null, values);
                reqForm._values[input._name] = this._findValue(req, input, submit, false, null, values);
            }

            //finished
            return Promise.resolve();
        }
    }

    _validateInputs(req) {
        //iterate inputs 1 by 1, and then reject if ANY error was found (after)
        let errors = [];
        let index = 0;

        const validate = () => {
            const next = () => ++index == this._inputs.length ? Promise.resolve() : validate();

            return this._inputs[index]._validate(req)
            .then(next)
            .catch(err => {
                errors.push(err);
                return next();
            });
        };

        return validate()
        .then(() => errors.length ? Promise.reject() : Promise.resolve());
    }

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

    _buildGroupStructure() {
        //construct the group structure of all inputs
        const structure = {};

        //iterate over all inputs
        for (let inputIndex = 0; inputIndex < this._inputs.length; inputIndex++) {
            const input = this._inputs[inputIndex];
            const group = input._group;

            //add segments to the group structure
            if (group !== null) {
                let parent = structure;
                for (let segmentIndex = 0; segmentIndex < group.length; segmentIndex++) {
                    const segment = group[segmentIndex];

                    //check if segment exists in parent
                    if (parent[segment] === undefined) {
                        parent[segment] = new GroupStructure();
                    }

                    //update parent pointer
                    parent = parent[segment];
                }
            }
        }

        //winner
        return structure;
    }

    _findValue(req, input, submit, raw, defaultValue, values) {
        //make sure we have a valid input
        if (input == null) {
            return defaultValue;
        }

        const reqForm = req.forme[input._form._name];

        //check to see if input is forcing value (this cant be overridden)
        if (!raw && input._permanentValue !== null) {
            return input._permanentValue;
        } else {
            //do some checks based on submit mode
            if (!submit) {
                //check in session
                if (reqForm._first) {
                    //first time
                    if (values && values[input._name] !== undefined) {
                        return values[input._name];
                    } else if (input._defaultValue !== null) {
                        return input._defaultValue;
                    }
                } else {
                    if (values && values[input._name] !== undefined) {
                        return values[input._name];
                    } else {
                        //load value from session (if no session has been loaded, all returned values will be null)
                        if (raw) {
                            //raw value
                            if (reqForm._session.raw[input._name] === undefined) {
                                //blank/empty value
                                return null;

                            } else {
                                //value from session
                                return reqForm._session.raw[input._name];
                            }
                        } else {
                            //computed value
                            if (reqForm._session.values[input._name] === undefined) {
                                //blank/empty value
                                return null;

                            } else {
                                //value from session
                                return reqForm._session.values[input._name];
                            }
                        }
                    }
                }
            } else {
                if (reqForm._first) {
                    //being called from api type call (eg without submitting)
                    if (values && values[input._name] !== undefined) {
                        return values[input._name];
                    } else if (input._defaultValue !== null) {
                        return input._defaultValue;
                    }
                } else {
                    //submitted values are always considered raw!
                    //override with values?
                    if (values && values[input._name] !== undefined) {
                        return values[input._name];
                    } else {
                        //get/post
                        switch (this._method) {
                            case 'GET':
                                if (req.query !== undefined && req.query[input._name] !== undefined) {
                                    return req.query[input._name];
                                }
                                break;
                            case 'POST':
                                if (req.body !== undefined && req.body[input._name] !== undefined) {
                                    return req.body[input._name];
                                }
                                break;
                        }
                    }
                }
            }
        }

        //ok use the passed in default value
        return defaultValue;
    }

    _buildTemplate(reqForm) {
        //return template details for the form
        const inputs = this._inputs;
        const formRaw = reqForm._raw;
        const formValues = reqForm._values;
        const formErrors = reqForm._errors;
        const template = {
            form: {
                name: this._name,
                method: this._method,
                action: this._action,
                context: this._context,
            },
            input: this._buildGroupStructure(),
        };

        //build the grouped input structure
        for (let inputIndex = 0; inputIndex < inputs.length; inputIndex++) {
            const input = inputs[inputIndex];

            //build input errors array
            let errors = [];
            for (let errorIndex = 0; errorIndex < formErrors.length; errorIndex++) {
                if (formErrors[errorIndex].name == input.name) {
                    errors.push(formErrors[errorIndex].error);
                }
            }

            //create input details
            const type = input._calculateType();
            const buildInput = {
                id: input._id !== null?input.id:'forme_input__'+input._name,
                name: input._name,
                alias: input._outputName(),
                className: input._classNames.join(' '),
                label: input._label,
                help: input._help,
                type: type,
                placeholder: input._placeholder,
                required: input._required,
                readonly: input._readonly,
                value: formValues[input._name],
                checked: (reqForm._first && input._checked) || (!reqForm._first && (type == 'checkbox' && formRaw[input._name] !== null) || (formRaw[input._name] == formValues[input._name])),
                errors: errors,
                options: input._options,
                context: input._context,
            };

            //add to the group structure
            this.constructor._addToGroupStructure(template.input, buildInput.alias, input._group, buildInput);
        }

        //done
        return template;
    }

    _validateNextFormHandler(req, index) {
        const handler = this._validateHandlers[index];

        //build state, values are not grouped here!
        //lookup will be populated by _fetchValues, and provide an array of group segments to reach a speciffic ._name input
        //eg lookup['inputNameOne'] = ['group1','subGroup2','inputAlias/inputName']
        const lookup = {};
        const state = {
            values: this._fetchValues(req, false, true, false, lookup),
        }

        const oldValues = this._fetchValues(req, false, false, false, null);

        //current submit
        return new Promise((resolve, reject) => {
            //execute
            return handler.execute(req, this, state)
            .then(() => resolve())
            .catch(err => {
                //extract error string from catch
                let error = err.message || '';

                //use handler specified error instead
                if (handler.error !== null) {
                    error = handler.error;
                }

                //apply inline template vars
                error = format(error, {
                    name: this._name,
                    label: this._label,
                });

                //add error to form
                this.error(req, null, error);

                //pass modified error down catch chain
                reject(new FormeError(error));
            });
        })
        .then(() => {
            //check if state has changed, we need to locate based on group
            for(let index = 0; index < this._inputs.length;index++) {
                const input = this._inputs[index];
                const newValue = this.constructor._findValueInState(state, lookup, input._name, null);

                if (newValue != oldValues[input._name]) {
                    this.change(req, input, newValue);
                }
            }

            //next submit
            if (++index == this._validateHandlers.length) {
                return Promise.resolve();
            } else {
                return this._validateNextFormHandler(req, index);
            }
        });
    }

    _submitNextInput(req, index) {
        //current input
        return this._inputs[index]._submit(req)
        .then(() => ++index == this._inputs.length ? Promise.resolve() : this._submitNextInput(req, index));
    }

    _submitNextFormHandler(req, index) {
        return utils.promise.result(this._submitHandlers[index].call(this, req, this))
        .then(() => ++index == this._submitHandlers.length ? Promise.resolve() : this._submitNextFormHandler(req, index));
    }

    _catchError(req, err) {
        //catch errors not related to forme
        if (err !== undefined && !(err instanceof FormeError) && !(err instanceof FormeInputError)) {
            if (dev) {
                //development mode
                //to console
                console.error(err.stack);

                //to form
                this.error(req, err.toString());
            } else {
                //production
                this.error(req, new FormeError('unhandled form error'));
            }
        }
    }

    _fetchValues(req, secure, group, raw, lookup) {
        //build values
        const values = group?this._buildGroupStructure():{};

        let value;
        const reqForm = req.forme[this._name];

        for (let index = 0;index < this._inputs.length;index++) {
            const input = this._inputs[index];

            //only allow unsecured values
            if (!secure || !input._secure) {
                //by this point, values will always be ready to use from the req object
                //raw or value?
                if (raw) {
                    value = reqForm._raw[input._name];
                } else {
                    value = reqForm._values[input._name];
                }

                //grouped?
                if (!group) {
                    //non grouped, use name per input
                    values[input._name] = value;

                    //add to lookup
                    if (lookup) {
                        lookup[input._name] = [input._name];
                    }
                } else {
                    //grouped
                    const alias = input._outputName();

                    //add to structure
                    this.constructor._addToGroupStructure(values, alias, input._group, value);

                    //add to lookup
                    if (lookup) {
                        if (input._group === null) {
                            //input isnt grouped, so easy to make lookup
                            lookup[input._name] = [alias];
                        } else {
                            //use the handy group segments this we already have!
                            lookup[input._name] = input._group.slice();
                            lookup[input._name].push(alias);
                        }
                    }
                }
            }
        }

        //done
        return values;
    }

    //methods
    name(name) {
        this._name = name;

        //chain
        return this;
    }

    label(label) {
        this._label = label;

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

    error() {
        let req = null;
        let name = null;
        let error = '';

        //how was this called?
        if (arguments.length == 2) {
            //form error
            req = arguments[0];
            error = arguments[1];
        } else if (arguments.length == 3) {
            //input error
            req = arguments[0];
            name = arguments[1];
            error = arguments[2];

            //check for piping
            const input = this._findInput(name);
            if (input && input._pipe !== false) {
                if (input._pipe === true) {
                    //form
                    name = null;
                } else if (typeof input._pipe == 'string') {
                    //other target
                    name = input._pipe;
                }
            }
        }

        if (req) {
            req.forme[this._name]._errors.push({
                name: name,
                error: error,
            });
        }
    }

    errors(req, name) {
        const errors = req.forme[this._name]._errors;
        if (name === undefined) {
            return errors;
        } else {
            const group = errors[name];
            return group === undefined?[]:group;
        }
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
        return req.forme[this._name]._values[input._name];
    }

    values(req) {
        //get all values
        return this._fetchValues(req, false, true, false, null);
    }

    context() {
        //get or set a context
        if (arguments.length == 1) {
            //get
            if (this._context[arguments[0]] !== undefined) {
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

    change(req, source, value) {
        //find input
        let input = this._findInput(source);
        if (input == null) {
            //nope, doesnt exist
            return null;
        }

        //change the value
        req.forme[this._name]._values[input._name] = value;
    }

    inputs() {
        //return names of all inputs
        const inputs = [];
        for(let index = 0;index < this._inputs.length;index++) {
            inputs.push(this._inputs[index]._name);
        }
        return inputs;
    }

    //operation api
    view(req, values) {
        return this._view(req, values);
    }

    validate() {
        if (arguments.length >= 1 && typeof arguments[0] == 'function') {
            //this is being called to add validation handler
            const [callback, error] = arguments;

            //add validation handler to form
            this._validateHandlers.push(new FormHandlerValidate(callback, error));

            //chain
            return this;
        } else if (arguments.length >= 1 && typeof arguments[0] == 'object') {
            //this is being called to start form validation
            const [req, values] = arguments;

            return this._validate(req, values);
        } else {
            throw new Error('invalid call to form.validate()');
        }
    }

    store(req) {
        const reqForm = req.forme[this._name];

        //store values in session
        reqForm._stored = true;

        if (this._sessionHandler) {
            //crete session data (todo: allow user code to add details to session)
            let data = {
                raw: this._fetchValues(req, true, false, true, null),
                values: this._fetchValues(req, true, false, false, null),
                errors: reqForm._errors,
                first: reqForm._first,
            };

            //attempt to save session
            return this._sessionHandler.save(req, this, data)
            .then(() => ({
                req: req,
                form: this,
            }));
        } else {
            //success (as no session handler)
            return Promise.resolve({
                req: req,
                form: this,
            });
        }
    }

    //handler methods
    require(conditions, op, error) {
        //build list of arrays
        conditions = this.constructor._buildInputConditions(conditions);
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

module.exports.FormeError = FormeError;
module.exports.FormeInputError = FormeInputError;