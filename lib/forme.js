'use strict';

//module imports
const format = require('string-template');
const extend = require('extend');

//local imports
const constants = require('./constants');
const utils = require('./utils');

const FormeSession = require('./session');
const FormeContainer = require('./container');
const FormePage = require('./page');
const FormeRequest = require('./request');
const FormeGroup = require('./group');

const FormeError = require('./errors').FormeError;
const FormeInputError = require('./errors').FormeInputError;

//dev?
const dev = process.env.NODE_ENV == 'dev' || process.env.NODE_ENV == 'development';

//main class
class Forme extends FormeContainer {
    constructor(name) {
        super(null, name);
        this._form = this;
        this._storage = null;
        this._request = null;

        this._action = '';
        this._method = 'POST';
        this._pages = [];
        this._sessionHandler = FormeSession;//default handler
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
                if (!(destination[segment] instanceof FormeGroup)) {
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
    _clone(override) {
        //create copy
        const clone = new Forme;
        override = extend(false,{}, override, {_form: clone});

        //iterate over properties
        for(let key of Object.keys(this)) {
            if (override && override[key] !== undefined) {
                clone[key] = override[key];
            } else {
                const property = this[key];

                //handle special cases
                switch (key) {
                    case '_form':
                        //self reference to cloned form
                        clone[key] = clone;
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

    _start(storage) {
        //bootstrap form processing. this operation should not produce any rejections
        //copy form
        const form = this._clone();

        //prepare storage
        storage.forme = storage.forme || {};
        form._storage = storage;

        //prepare request
        form._request = new FormeRequest(form);
        storage.forme[form._name] = form._request;

        //chain cloned form
        return Promise.resolve(form);
    }

    _process(submit, values) {
        //general purpose container processing for various scenarios
        this._request._first = !submit;
        this._request._session.first = !submit;

        //load and process form
        return this._load()
        .then(success => this._buildPage())
        .then(page => {
            //read values
            for (let input of this._inputs) {
                this._request._raw[input._name] = this._findValue(input, submit, true, null, values);
                this._request._values[input._name] = this._findValue(input, submit, false, null, values);
            }

            //return the cloned form in chain
            return this;
        });
    }

    _load() {
        if (this._sessionHandler) {
            //let session handler do load
            return this._sessionHandler.load(this._storage, this)
            .then(session => {
                //save session into the container
                extend(this._request._session, session);

                //copy data from session (todo: perhaps we can just rely in teh session object and get rid of separate container details)
                this._request._errors = this._request._session.errors;
                this._request._first = this._request._session.first;

                //clear the session
                return this._sessionHandler.clear(this._storage, this)
                .then(() => true);
            });
        } else {
            //we don't have a session handler so do the best we can
            return Promise.resolve(false);
        }
    }

    _view(values) {
        //viewing the container (rendering is not *yet?*) handled by this module)
        return this._process(false, values)
        .then(() => ({
            storage: this._storage,
            form: this,
        }));
    }

    _submit(values) {
        //everything called from here will have the cloned this object trickle down
        return this._process(true, values)
        .then(() => this._inputs.length == 0 ? true: this._processInputValidationHandlers())
        .then(() => this._validateHandlers.length == 0 ? true : this._processNextValidateHandler(0))
        .then(() => this._inputs.length == 0 ? true : this._processNextInputSubmitHandler(0))
        .then(() => this._submitHandlers.length == 0 ? true : this._processNextSubmitHandler(0))
        .then(() => this._processInputActions())
        .then(() => this._actionHandlers.length == 0 ? true : this._processNextActionHandler(0))
        .then(() => this._processSpecialActions())
        .then(() => ({
            validated: true,
            storage: this.storage,
            form: this,
            values: this._fetchValues(false, true, false, null),
            errors: null,
            actions: this._request._actions,
        }))
        .catch(err => {
            //error processing container
            //catch any unhandled errors
            this._catchError(err);

            //save session
            return new Promise((resolve, reject) => {
                this._request._first = false;

                return this.store()
                .then(() => {
                    //session saved, always resolve
                    resolve(this._request._errors);
                })
                .catch(err => {
                    //failed to save session
                    //add error
                    let errors = this._request._errors.slice();
                    errors.push(err);

                    //always resolve
                    resolve(errors);
                });
            })
            .then(errors => Promise.resolve({
                validated: false,
                storage: this._storage,
                form: this,
                values: this._fetchValues(false, true, false, null),
                errors: errors,
                actions: [],
            }));
        });
    }

    _buildPage() {
        //let page process
        const page = this._page();
        if (!page) {
            return Promise.resolve(null);
        } else {
            return page._build();
        }
    }

    _processNextInputSubmitHandler(index) {
        //current input
        return this._inputs[index]._submit()
        .then(() => ++index == this._inputs.length ? Promise.resolve() : this._processNextInputSubmitHandler(index));
    }

    _processNextValidateHandler(index) {
        const handler = this._validateHandlers[index];

        //build state, values are not grouped here!
        //lookup will be populated by _fetchValues, and provide an array of group segments to reach a speciffic ._name input
        //eg lookup['inputNameOne'] = ['group1','subGroup2','inputAlias/inputName']
        const lookup = {};
        const state = {
            values: this._fetchValues(false, true, false, lookup),
        };
        const oldValues = this._fetchValues(false, false, false, null);

        //iterate
        return new Promise((resolve, reject) => {
            return handler.execute(this, state)
            .then(() => {
                //check if state has changed, we need to locate based on group
                for (let input of this._inputs) {
                    const newValue = this.constructor._findValueInState(state, lookup, input._name, null);

                    if (newValue != oldValues[input._name]) {
                        this.value(input, newValue);
                    }
                }

                resolve();
            })
            .catch(err => {
                //pass it after the iteration where the error is handled
                reject(err);
            });
        })
        .then(() => ++index == this._validateHandlers.length ? Promise.resolve() : this._processNextValidateHandler(index))
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

                //add error to container
                this.error(error);

                //pass modified error down catch chain
                return Promise.reject(new FormeError(error));
            }
        });
    }

    _processNextSubmitHandler(index) {
        return utils.promise.result(this._submitHandlers[index].call(this, this._storage, this))
        .then(() => ++index == this._submitHandlers.length ? Promise.resolve() : this._processNextSubmitHandler(index));
    }

    _processNextActionHandler(index) {
        return this._processActions(this._actionHandlers[index].action, this._actionHandlers[index].callback)
        .then(() => ++index == this._actionHandlers.length ? Promise.resolve() : this._processNextActionHandler(index));
    }

    _processAction(action, callback) {
        const jobs = [];
        for(let requestAction of this._request._actions) {
            if (requestAction.action == action) {
                jobs.push(utils.promise.result(callback.call(this, this, this._storage, requestAction.action, requestAction.context)));
            }
        }

        return Promise.all(jobs);
    }

    _processActions(actions, callback) {
        //skip
        if (!callback) {
            return Promise.resolve();
        }

        if (!Array.isArray(actions)) {
            return this._processAction(actions, callback);
        } else {
            const jobs = [];
            for(let action of actions) {
                jobs.push(this._processAction(action, callback));
            }
            return Promise.all(jobs);
        }
    }

    _processInputValidationHandlers() {
        //iterate inputs 1 by 1, and then reject if ANY error was found (after)
        let errors = [];
        let index = 0;

        const validate = () => {
            const next = () => ++index == this._inputs.length ? Promise.resolve() : validate();

            return this._inputs[index]._validate()
            .then(next)
            .catch(err => {
                errors.push(err);
                return next();
            });
        };

        return validate()
        .then(() => errors.length ? Promise.reject() : Promise.resolve());
    }

    _processInputActions() {
        //trigger special actions directly from input values. These values start with forme:
        for(let input of this._inputs) {
            if (input._actions !== null) {
                const inputValue = this._request._values[input._name];
                for(let action of input._actions) {
                    //only trigger matching values
                    if (action.value === null || action.value == inputValue) {
                        this._request._actions.push({
                            action: action.action,
                            context: action.context,
                        })
                    }
                }
            }
        }
    }

    _processSpecialActions() {
        //get any actions that inputs may have triggered
        for(let input of this._inputs) {
            if (input._actions !== null) {
                const inputValue = this._request._values[input._name];
                if (typeof inputValue == 'string' && inputValue.startsWith(constants.actionPrefix)) {
                    const action = inputValue.slice(constants.actionPrefix.length);
                    switch(action) {
                        case 'prev':
                            break;
                        case 'next':
                            break;
                    }
                }
            }
        }
    }

    _containsRequest() {
        return this._storage !== null && typeof this._storage == 'object' && this._storage.forme !== undefined && this._storage.forme[this._name] !== undefined && this._storage.forme[this._name] instanceof FormeRequest;
    }

    _page() {
        return null;
    }

    _buildGroupStructure() {
        //construct the group structure of all inputs
        const structure = {};

        //iterate over all inputs
        for (let input of this._inputs) {
            const group = input._group;

            //add segments to the group structure
            if (group !== null) {
                let parent = structure;
                for (let segmentIndex = 0; segmentIndex < group.length; segmentIndex++) {
                    const segment = group[segmentIndex];

                    //check if segment exists in parent
                    if (parent[segment] === undefined) {
                        parent[segment] = new FormeGroup();
                    }

                    //update parent pointer
                    parent = parent[segment];
                }
            }
        }

        //winner
        return structure;
    }

    _findValue(input, submit, raw, defaultValue, values) {
        //make sure we have a valid input
        if (input == null) {
            return defaultValue;
        }

        //check to see if input is forcing value (this cant be overridden)
        if (!raw && input._permanentValue !== null) {
            return input._permanentValue;
        } else {
            //do some checks based on submit mode
            if (!submit) {
                //check in session
                if (this._request._first) {
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
                            if (this._request._session.raw[input._name] === undefined) {
                                //blank/empty value
                                return null;

                            } else {
                                //value from session
                                return this._request._session.raw[input._name];
                            }
                        } else {
                            //computed value
                            if (this._request._session.values[input._name] === undefined) {
                                //blank/empty value
                                return null;

                            } else {
                                //value from session
                                return this._request._session.values[input._name];
                            }
                        }
                    }
                }
            } else {
                if (this._request._first) {
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
                                if (this._storage.query !== undefined && this._storage.query[input._name] !== undefined) {
                                    return this._storage.query[input._name];
                                }
                                break;
                            case 'POST':
                                if (this._storage.body !== undefined && this._storage.body[input._name] !== undefined) {
                                    return this._storage.body[input._name];
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

    _buildTemplate() {
        const template = {
            form: {
                name: this._name,
                method: this._method,
                action: this._action,
                context: this._context,
                errors: this._request._errors.filter(error => this._inputs.find(input => input._name == error.name) === undefined),
            },
            input: this._buildGroupStructure(),
        };

        //build the grouped input structure
        for (let input of this._inputs) {
            //build input errors array
            let errors = this._request._errors.filter(error => error.name == input.name).map(error => error.error);

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
                value: this._request._values[input._name],
                checked: (this._request._first && input._checked) || (!this._request._first && ((type == 'checkbox' && this._request._raw[input._name] !== null) || (this._request._raw[input._name] == this._request._values[input._name]))),
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

    _catchError(err) {
        //catch errors not related to forme
        if (err !== undefined && !(err instanceof FormeError) && !(err instanceof FormeInputError)) {
            if (dev) {
                //development mode
                //to console
                console.error(err.stack);

                //to container
                this.error(err.toString());
            } else {
                //production
                this.error(new FormeError('unhandled container error'));
            }
        }
    }

    _fetchValues(secure, group, raw, lookup) {
        //build values
        const values = group?this._buildGroupStructure():{};

        let value;

        for (let input of this._inputs) {
            //only allow unsecured values
            if (!secure || !input._secure) {
                //by this point, values will always be ready to use from the storage object
                //raw or value?
                if (raw) {
                    value = this._request._raw[input._name];
                } else {
                    value = this._request._values[input._name];
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

    //public methods
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
            this._sessionHandler = FormeSession;
        } else {
            this._sessionHandler = sessionHandler;
        }

        //chain
        return this;
    }

    error() {
        let name = null;
        let error = '';

        //how was this called?
        if (arguments.length == 1) {
            //container error
            error = arguments[0];
        } else if (arguments.length == 2) {
            //input error
            name = arguments[0];
            error = arguments[1];

            //check for piping
            const input = this._findInput(name);
            if (input) {
                if (input._pipe !== false) {
                    if (input._pipe === true) {
                        //container
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

        if (this._request) {
            this._request._errors.push({
                name: name,
                error: error,
            });
        }
    }

    errors(name) {
        if (name === undefined) {
            return this._request._errors.slice();
        } else {
            const group = this._request._errors[name];
            return group === undefined?[]:group;
        }
    }

    value() {
        if (arguments.length == 1) {
            //get value
            const input = this._findInput(arguments[0]);

            if (input == null) {
                return null;
            }

            return this._request._values[input._name] = value;

        } else if (arguments.length == 2) {
            //set value
            const input = this._findInput(arguments[0]);
            const value = arguments[1];

            if (input == null) {
                return null;
            }

            return this._request._values[input._name] = value;
        }
    }

    values() {
        //get all values
        return this._fetchValues(false, true, false, null);
    }

    raw(input) {
        //find input
        input = this._findInput(input);
        if (input == null) {
            return null;
        }

        //return the value
        return this._request._raw[input._name];
    }

    //operation api
    view(storage, values) {
        //wrap it in clone of form
        return this._start(storage)
        .then(form => form._view(values));
    }

    submit() {
        if (arguments.length >= 1 && typeof arguments[0] == 'function') {
            //add submit handler
            return super.submit(...arguments)
        } else if (arguments.length >= 1 && typeof arguments[0] == 'object') {
            //submit form
            const storage = arguments[0];

            //wrap it in clone of form
            return this._start(storage)
            .then(form => form._submit(arguments[1]));
        } else {
            throw new Error('invalid call to container.submit()');
        }
    }

    store() {
        //store values in session
        this._request._stored = true;

        if (this._sessionHandler) {
            //crete session data (todo: allow user code to add details to session)
            let data = {
                raw: this._fetchValues(true, false, true, null),
                values: this._fetchValues(true, false, false, null),
                errors: this._request._errors,
                first: this._request._first,
            };

            //attempt to save session
            return this._sessionHandler.save(this._storage, this, data)
            .then(() => ({
                storage: this._storage,
                form: this,
            }));
        } else {
            //success (as no session handler)
            return Promise.resolve({
                storage: this._storage,
                form: this,
            });
        }
    }

    action() {
        if (arguments.length == 2) {
            return super.action(...arguments);

        } else if (arguments.length == 3) {
            //processing submitted actions
            return this._processActions(...arguments);
        } else {
            throw new Error('invalid call to container.action()');
        }
    }

    next() {
        if (arguments.length == 1) {
            return super.action(constants.actionPrefix+'next', arguments[0]);
        } else if (arguments.length == 2) {
            return this.action(arguments[0], constants.actionPrefix+'next',arguments[1]);
        } else {
            throw new Error('invalid call to form.next()');
        }
    }

    prev() {
        if (arguments.length == 1) {
            return super.action(constants.actionPrefix+'prev', arguments[0]);
        } else if (arguments.length == 2) {
            return this.action(arguments[0], constants.actionPrefix+'prev',arguments[1]);
        } else {
            throw new Error('invalid call to form.prev()');
        }
    }

    page(name, callback) {
        if (arguments.length == 1) {
            //static page
            const page = new FormePage(this, name, null);
            this._pages.push(page);

            //chain page
            return page;
        } else if(arguments.length == 2) {
            //dynamic page
            this._pages.push(new FormePage(this, name, callback));

            //chain form
            return this;
        } else {
            throw new Error('invalid call to form.page()');
        }
    }
}

//expose module
module.exports = function(name, method, session) {
    return new Forme(name, method, session);
};

module.exports.FormeError = FormeError;
module.exports.FormeInputError = FormeInputError;