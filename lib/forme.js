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
const Request = require('./request');
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
        this._method = 'POST';
        this._inputs = [];
        this._sessionHandler = FormeSessionHandler;//default handler
        this._context = {};
        this._validateHandlers = [];
        this._submitHandlers = [];
        this._actionHandlers = [];
    }

    //private functions
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
        if (lookup[name] === undefined) {
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

    //private methods
    _view(storage, values) {
        //viewing the form (rendering is not *yet?*) handled by this module)
        return this._process(storage, false, values)
        .then(() => ({
            storage: storage,
            form: this,
        }));
    }

    _submit(storage, values) {
        //start validation
        return this._process(storage, true, values)
        .then(() => this._inputs.length == 0 ? true: this._processInputValidationHandlers(storage))
        .then(() => this._validateHandlers.length == 0 ? true : this._processNextValidateHandler(storage, 0))
        .then(() => this._inputs.length == 0 ? true : this._processNextInputSubmitHandler(storage, 0))
        .then(() => this._submitHandlers.length == 0 ? true : this._processNextSubmitHandler(storage, 0))
        .then(() => this._processInputActions(storage))
        .then(() => this._submitHandlers.length == 0 ? true : this._processNextActionHandler(storage, 0))
        .then(() => ({
            validated: true,
            storage: storage,
            form: this,
            values: this._fetchValues(storage, false, true, false, null),
            errors: null,
            actions: this._request(storage)._actions,
        }))
        .catch(err => {
            //error processing form
            //catch any unhandled errors
            this._catchError(storage, err);

            //save session
            return new Promise((resolve, reject) => {
                const request = this._request(storage);
                request._first = false;

                return this.store(storage)
                .then(() => {
                    //session saved, always resolve
                    resolve(request._errors);
                })
                .catch(err => {
                    //failed to save session
                    //add error
                    let errors = request._errors.slice();
                    errors.push(err);

                    //always resolve
                    resolve(errors);
                });
            })
            .then(errors => Promise.resolve({
                validated: false,
                storage: storage,
                form: this,
                values: this._fetchValues(storage, false, true, false, null),
                errors: errors,
                actions: [],
            }));
        });
    }

    _process(storage, submit, values) {
        //general purpose form processing for various scenarios
        //prepare the request object
        storage.forme = storage.forme || {};

        //create request container
        const request = new Request(storage, this);
        storage.forme[this._name] = request;
        request._first = !submit;
        request._session.first = !submit;

        //need to load the session
        if (this._sessionHandler) {
            //let session handler do load
            return this._sessionHandler.load(storage, this)
            .then(session => {
                //save session into the form
                extend(request._session, session);

                //copy data from session (todo: perhaps we can just rely in teh session object and get rid of separate form details)
                request._errors = request._session.errors;
                request._first = request._session.first;

                //get values
                let input;
                for (let index = 0; index < this._inputs.length; index++) {
                    input = this._inputs[index];

                    //get values for this input
                    request._raw[input._name] = this._findValue(storage, input, submit, true, null, values);
                    request._values[input._name] = this._findValue(storage, input, submit, false, null, values);
                }

                //clear the session
                return this._sessionHandler.clear(storage, this);
            });
        } else {
            //we don't have a session handler so do the best we can
            //get values
            let input;
            for (let index = 0; index < this._inputs.length; index++) {
                input = this._inputs[index];

                //get values for this input
                request._raw[input._name] = this._findValue(storage, input, submit, true, null, values);
                request._values[input._name] = this._findValue(storage, input, submit, false, null, values);
            }

            //finished
            return Promise.resolve();
        }
    }

    _processNextInputSubmitHandler(storage, index) {
        //current input
        return this._inputs[index]._submit(storage)
        .then(() => ++index == this._inputs.length ? Promise.resolve() : this._processNextInputSubmitHandler(storage, index));
    }

    _processNextValidateHandler(storage, index) {
        const handler = this._validateHandlers[index];

        //build state, values are not grouped here!
        //lookup will be populated by _fetchValues, and provide an array of group segments to reach a speciffic ._name input
        //eg lookup['inputNameOne'] = ['group1','subGroup2','inputAlias/inputName']
        const lookup = {};
        const state = {
            values: this._fetchValues(storage, false, true, false, lookup),
        };
        const oldValues = this._fetchValues(storage, false, false, false, null);

        //iterate
        return new Promise((resolve, reject) => {
            return handler.execute(storage, this, state)
            .then(() => {
                //check if state has changed, we need to locate based on group
                for (let input of this._inputs) {
                    const newValue = this.constructor._findValueInState(state, lookup, input._name, null);

                    if (newValue != oldValues[input._name]) {
                        this.value(storage, input, newValue);
                    }
                }

                resolve();
            })
            .catch(err => {
                //pass it after the iteration where the error is handled
                reject(err);
            });
        })
        .then(() => ++index == this._validateHandlers.length ? Promise.resolve() : this._processNextValidateHandler(storage, index))
        .catch(err => {
            //extract error string from catch (if an error was provided)
            let error = (err?err.message:null) || '';

            //use handler specified error instead
            if (handler.error !== null) {
                error = handler.error;
            }

            if (!error || error.length == 0) {
                //reject without an error
                return Promise.reject();
            } else {
                //apply inline template vars
                error = format(error, {
                    name: this._name,
                    label: this._label,
                });

                //add error to form
                this.error(storage, error);

                //pass modified error down catch chain
                return Promise.reject(new FormeError(error));
            }
        });
    }

    _processNextSubmitHandler(storage, index) {
        return utils.promise.result(this._submitHandlers[index].call(this, storage, this))
        .then(() => ++index == this._submitHandlers.length ? Promise.resolve() : this._processNextSubmitHandler(storage, index));
    }

    _processNextActionHandler(storage, index) {
        return this._processActions(storage, this._actionHandlers[index].action, this._actionHandlers[index].callback)
        .then(() => ++index == this._actionHandlers.length ? Promise.resolve() : this._processNextActionHandler(storage, index));
    }

    _processAction(storage, action, callback) {
        const request = this._request(storage);

        const jobs = [];
        for(let requestAction of request._actions) {
            if (requestAction.action == action) {
                jobs.push(utils.promise.result(callback.call(this, this, storage, requestAction.action, requestAction.context)));
            }
        }

        return Promise.all(jobs);
    }

    _processActions(storage, actions, callback) {
        //skip
        if (!callback) {
            return Promise.resolve();
        }

        if (!Array.isArray(actions)) {
            return this._processAction(storage, actions, callback);
        } else {
            const jobs = [];
            for(let action of actions) {
                jobs.push(this._processAction(storage, action, callback));
            }
            return Promise.all(jobs);
        }
    }

    _processInputValidationHandlers(storage) {
        //iterate inputs 1 by 1, and then reject if ANY error was found (after)
        let errors = [];
        let index = 0;

        const validate = () => {
            const next = () => ++index == this._inputs.length ? Promise.resolve() : validate();

            return this._inputs[index]._validate(storage)
            .then(next)
            .catch(err => {
                errors.push(err);
                return next();
            });
        };

        return validate()
        .then(() => errors.length ? Promise.reject() : Promise.resolve());
    }


    _processInputActions(storage) {
        //get any actions that inputs may have triggered
        const request = this._request(storage);

        for(let input of this._inputs) {
            if (input._actions !== null) {
                const inputValue = request._values[input._name];
                for(let action of input._actions) {
                    //only trigger matching values
                    if (action.value === null || action.value == inputValue) {
                        request._actions.push({
                            action: action.action,
                            context: action.context,
                        })
                    }
                }
            }
        }
    }

    _containsRequest(storage) {
        return storage !== null && typeof storage == 'object' && storage.forme !== undefined && storage.forme[this._name] !== undefined && storage.forme[this._name] instanceof Request;
    }

    _request(storage) {
        return storage.forme[this._name];
    }

    _findInput(source) {
        if (source instanceof Input) {
            return source;
        } else {
            let input = null;
            let sourceGroups;

            if (Array.isArray(source)) {
                //passed in array group path
                sourceGroups = source;
            } else {
                //1 - search for exact name match
                let input = this._inputs.find(input => input._name == source);

                if (input) {
                    return input;
                }

                //continue to search the group path
                sourceGroups = source.split('.');
            }

            //2 - search for group path/andor alias
            const sourceName = sourceGroups.pop()
            for(input of this._inputs) {
                if (input._group === null) {
                    //check alias
                    if (input._alias == sourceName) {
                        return input;
                    }
                } else {
                    //search path
                    const groups = input._group;

                    if (groups.length === sourceGroups.length) {
                        let found = true;

                        for (let index = 0; index < sourceGroups.length; index++) {
                            if (groups[index] != sourceGroups[index]) {
                                found = false;
                                break;
                            }
                        }

                        if (found && (sourceName == input._name || sourceName == input._alias)) {
                            return input;
                        }
                    }
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

    _findValue(storage, input, submit, raw, defaultValue, values) {
        //make sure we have a valid input
        if (input == null) {
            return defaultValue;
        }

        const request = input._form._request(storage);

        //check to see if input is forcing value (this cant be overridden)
        if (!raw && input._permanentValue !== null) {
            return input._permanentValue;
        } else {
            //do some checks based on submit mode
            if (!submit) {
                //check in session
                if (request._first) {
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
                            if (request._session.raw[input._name] === undefined) {
                                //blank/empty value
                                return null;

                            } else {
                                //value from session
                                return request._session.raw[input._name];
                            }
                        } else {
                            //computed value
                            if (request._session.values[input._name] === undefined) {
                                //blank/empty value
                                return null;

                            } else {
                                //value from session
                                return request._session.values[input._name];
                            }
                        }
                    }
                }
            } else {
                if (request._first) {
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
                                if (storage.query !== undefined && storage.query[input._name] !== undefined) {
                                    return storage.query[input._name];
                                }
                                break;
                            case 'POST':
                                if (storage.body !== undefined && storage.body[input._name] !== undefined) {
                                    return storage.body[input._name];
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

    _buildTemplate(request) {
        //return template details for the form
        const inputs = this._inputs;
        const requestRaw = request._raw;
        const requestValues = request._values;
        const requestErrors = request._errors;
        const template = {
            form: {
                name: this._name,
                method: this._method,
                action: this._action,
                context: this._context,
                errors: requestErrors.filter(error => inputs.find(input => input._name == error.name) === undefined),
            },
            input: this._buildGroupStructure(),
        };

        //build the grouped input structure
        for (let inputIndex = 0; inputIndex < inputs.length; inputIndex++) {
            const input = inputs[inputIndex];

            //build input errors array
            let errors = [];
            for (let errorIndex = 0; errorIndex < requestErrors.length; errorIndex++) {
                if (requestErrors[errorIndex].name == input.name) {
                    errors.push(requestErrors[errorIndex].error);
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
                value: requestValues[input._name],
                checked: (request._first && input._checked) || (!request._first && ((type == 'checkbox' && requestRaw[input._name] !== null) || (requestRaw[input._name] == requestValues[input._name]))),
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

    _catchError(storage, err) {
        //catch errors not related to forme
        if (err !== undefined && !(err instanceof FormeError) && !(err instanceof FormeInputError)) {
            if (dev) {
                //development mode
                //to console
                console.error(err.stack);

                //to form
                this.error(storage, err.toString());
            } else {
                //production
                this.error(storage, new FormeError('unhandled form error'));
            }
        }
    }

    _fetchValues(storage, secure, group, raw, lookup) {
        //build values
        const values = group?this._buildGroupStructure():{};

        let value;
        const request = this._request(storage);

        for (let index = 0;index < this._inputs.length;index++) {
            const input = this._inputs[index];

            //only allow unsecured values
            if (!secure || !input._secure) {
                //by this point, values will always be ready to use from the storage object
                //raw or value?
                if (raw) {
                    value = request._raw[input._name];
                } else {
                    value = request._values[input._name];
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

    _addActionHandler(action, callback) {
        //add action handler
        this._actionHandlers.push({
            action: action,
            callback: callback,
        })
    }

    _addActionHandlers(actions, callback) {
        if (!Array.isArray(actions)) {
            this._addActionHandler(actions, callback);
        } else {
            for(let action of actions) {
                this._addActionHandler(action, callback);
            }
        }
    }

    _addValidateHandler(callback, error) {
        this._validateHandlers.push(new FormHandlerValidate(callback, error));
    }

    _addSubmitHandler(callback) {
        this._submitHandlers.push(callback);
    }

    //public methods
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
        let storage = null;
        let name = null;
        let error = '';

        //how was this called?
        if (arguments.length == 2) {
            //form error
            storage = arguments[0];
            error = arguments[1];
        } else if (arguments.length == 3) {
            //input error
            storage = arguments[0];
            name = arguments[1];
            error = arguments[2];

            //check for piping
            const input = this._findInput(name);
            if (input) {
                if (input._pipe !== false) {
                    if (input._pipe === true) {
                        //form
                        name = null;
                    } else if (typeof input._pipe == 'string') {
                        //other target
                        name = input._pipe;
                    }
                } else {
                    name = input._name;
                }
            }
        }

        if (storage) {
            this._request(storage)._errors.push({
                name: name,
                error: error,
            });
        }
    }

    errors(storage, name) {
        const request = this._request(storage);

        if (name === undefined) {
            return request._errors.slice();
        } else {
            const group = request._errors[name];
            return group === undefined?[]:group;
        }
    }

    value() {
        if (arguments.length == 2) {
            //get value
            const storage = arguments[0];
            const input = this._findInput(arguments[1]);

            if (input == null) {
                return null;
            }

            const request = this._request(storage);
            return request._values[input._name] = value;

        } else if (arguments.length == 3) {
            //set value
            const storage = arguments[0];
            const input = this._findInput(arguments[1]);
            const value = arguments[2];

            if (input == null) {
                return null;
            }

            const request = this._request(storage);
            return request._values[input._name] = value;
        }
    }

    values(storage) {
        //get all values
        return this._fetchValues(storage, false, true, false, null);
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

    raw(storage, input) {
        //find input
        input = this._findInput(input);
        if (input == null) {
            return null;
        }

        //return the value
        const request = this._request(storage);
        return request._raw[input._name];
    }

    inputs() {
        //return names of all inputs
        const inputs = [];
        for(let index = 0;index < this._inputs.length;index++) {
            inputs.push(this._inputs[index]._name);
        }
        return inputs;
    }

    validate(callback, error) {
        this._addValidateHandler(callback, error);
    }

    //operation api
    view(storage, values) {
        return this._view(storage, values);
    }

    submit(handler) {
        if (arguments.length >= 1 && typeof arguments[0] == 'function') {
            this._addSubmitHandler(...arguments);

            //chain
            return this;
        } else if (arguments.length >= 1 && typeof arguments[0] == 'object') {
            return this._submit(...arguments);
        } else {
            throw new Error('invalid call to form.submit()');
        }
    }

    store(storage) {
        const request = this._request(storage);

        //store values in session
        request._stored = true;

        if (this._sessionHandler) {
            //crete session data (todo: allow user code to add details to session)
            let data = {
                raw: this._fetchValues(storage, true, false, true, null),
                values: this._fetchValues(storage, true, false, false, null),
                errors: request._errors,
                first: request._first,
            };

            //attempt to save session
            return this._sessionHandler.save(storage, this, data)
            .then(() => ({
                storage: storage,
                form: this,
            }));
        } else {
            //success (as no session handler)
            return Promise.resolve({
                storage: storage,
                form: this,
            });
        }
    }

    action() {
        if (arguments.length == 2) {
            //adding action callback
            //callbacks defined like this are automatically called at the end of a valid submit
            this._addActionHandlers(...arguments);

            //chain
            return this;

        } else if (arguments.length == 3) {
            //processing submitted actions
            //callbacks fire automatically if any of the actions are submitted
            return this._processActions(...arguments);
        } else {
            throw new Error('invalid call to form.action()');
        }
    }

    next() {
        if (arguments.length == 1) {
            return this.action('forme:next', arguments[0]);
        } else if(arguments.length == 2) {
            return this.action(arguments[0], 'forme:next', arguments[1]);
        } else {
            throw new Error('invalid call to form.next()');
        }
    }

    prev() {
        if (arguments.length == 1) {
            return this.action('forme:prev', arguments[0]);
        } else if(arguments.length == 2) {
            return this.action(arguments[0], 'forme:prev', arguments[1]);
        } else {
            throw new Error('invalid call to form.prev()');
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