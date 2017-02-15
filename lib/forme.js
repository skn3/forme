'use strict';

//module imports
const format = require('string-template');
const extend = require('extend');

//local imports
const constants = require('./constants');
const utils = require('./utils');

const FormeSession = require('./session');
const FormeStorage = require('./storage');
const FormeContainer = require('./container');
const FormePage = require('./page');
const FormeRequest = require('./request');
const FormeResult = require('./result');
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
        this._pages = null;

        this._sessionConstructor = FormeSession;//default session handler is reading from storage.session (eg req.session)
        this._session = null;
    }

    //properties
    get _tokenField() {
        return this._name+'_token';
    }

    get _pageField() {
        return this._name+'_page';
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

    _wrap(storage) {
        //bootstrap form processing. this operation should not produce any rejections
        //clone form
        const form = this._clone();

        //prepare
        form._request = new FormeRequest(form);
        form._storage = new FormeStorage(form, storage, form._request);
        form._session = new form._sessionConstructor(form);

        //chain cloned form
        return Promise.resolve(form);
    }

    _build(submit, values) {
        //build the form
        this._request._building = true;
        this._request._first = !submit;

        //convert the loaded page name into a page object
        if (this._request._page === null) {
            this._request._page = this._findFirstPage();
        } else {
            this._request._page = this._findPage(this._request._page);
        }

        //set future page default to current page
        this._request._future = this._request._page?this._request._page._name:null;

        //let the current page build
        return this._buildPage()
        .then(page => {
            //read values
            for (let input of this._inputs) {
                this._request._raw[input._name] = this._findValue(input, submit, true, null, values);
                this._request._values[input._name] = this._findValue(input, submit, false, null, values);
            }

            //finished building
            this._request._building = false;

            //chain
            return this;
        });
    }

    _buildPage() {
        //let page process
        if (this._request._page === null) {
            return Promise.resolve(null);
        } else {
            return this._request._page._build();
        }
    }

    _load() {
        return this._request._load();
    }

    _save() {
        this._request._saved = true;
        return this._request._save();
    }

    _success() {
        this._request._valid = true;

        return this._finalise()
        .then(() => new FormeResult(this));
    }

    _fail() {
        //save session
        return new Promise((resolve, reject) => {
            //update request before saving
            this._request._first = false;
            this._request._valid = false;

            //save the form
            return this._save()
            .then(() => {
                //session saved, always resolve
                resolve();
            })
            .catch(err => {
                //failed to save session
                this.error(err.message);

                //always resolve
                resolve();
            });
        })
        .then(() => new FormeResult(this));
    }

    _finalise() {
        //called at the end of a successful view/validate
        if (this._request._pages === null) {
            //if we dont have a page we dont need to save the page state
            return Promise.resolve();
        } else {
            //save
            return this._save()
            .catch(err => {
                //failed to save session
                this.error(err.message);

                //flag in the request that it is now invalid and then continue .then()
                this._request._valid = false;
                return Promise.resolve();
            });
        }
    }

    _view(values) {
        //viewing the container (rendering is not *yet?*) handled by this module)
        return this._load()
        .then(() => this._build(false, values))
        .then(() => this._success());
    }

    _validate(submit, values) {
        //everything called from here will have the cloned this object trickle down
        return this._load()
        .then(() => this._build(submit, values))
        .then(() => this._inputs.length == 0 ? true: this._processInputValidationHandlers())
        .then(() => this._validateHandlers.length == 0 ? true : this._processNextValidateHandler(0))
        .then(() => this._inputs.length == 0 ? true : this._processNextInputSubmitHandler(0))
        .then(() => this._submitHandlers.length == 0 ? true : this._processNextSubmitHandler(0))
        .then(() => this._processInputActions())
        .then(() => this._actionHandlers.length == 0 ? true : this._processNextActionHandler(0))
        .then(() => this._processSpecialActions())
        .then(() => this._success())
        .catch(err => {
            //error processing container
            this._catchError(err);
            return this._fail();
        });
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
        return utils.promise.result(this._submitHandlers[index].call(this, this._storage._container, this))
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
                jobs.push(utils.promise.result(callback.call(this, this, this._storage._container, requestAction.action, requestAction.context)));
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
                    //trigger with matching value
                    //dont trigger special actions
                    if (!action.special && ((action.value === null && inputValue !== undefined) || action.value == inputValue)) {
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

                for(let action of input._actions) {
                    if (action.special) {
                        switch(action.action) {
                            case constants.actions.prev:
                                if (inputValue !== null) {
                                    this._request._reload = true;
                                    this._request._destination = action.context || null;

                                    //set future page
                                    const page = this._findPreviousPage();
                                    this._request._future = page?page._name:null;
                                }
                                break;

                            case constants.actions.next:
                                if (inputValue !== null) {
                                    this._request._reload = true;
                                    this._request._destination = action.context || null;

                                    //set future page
                                    const page = this._findNextPage();
                                    this._request._future = page?page._name:null;
                                }
                                break;
                        }
                    }
                }
            }
        }
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
                //check in request
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
                        //load value from request
                        if (raw) {
                            //raw value
                            if (this._request._raw[input._name] === undefined) {
                                //blank/empty value
                                return null;

                            } else {
                                //value from session
                                return this._request._raw[input._name];
                            }
                        } else {
                            //computed value
                            if (this._request._values[input._name] === undefined) {
                                //blank/empty value
                                return null;

                            } else {
                                //value from session
                                return this._request._values[input._name];
                            }
                        }
                    }
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
                            return this._storage._get(input._name, defaultValue);
                        case 'POST':
                            return this._storage._post(input._name, defaultValue);
                    }
                }
            }
        }

        //ok use the passed in default value
        return defaultValue;
    }

    _findPage(name) {
        if (this._pages) {
            for (let page of this._pages) {
                if (page._name == name) {
                    return page;
                }
            }
        }
        return null;
    }

    _findFirstPage() {
        if (this._pages) {
            return this._pages[0];
        }

        return null;
    }

    _findPreviousPage() {
        if (this._pages) {
            if (this._request._page === null) {
                return this._findFirstPage();
            } else {
                for (let index = 0; index < this._pages.length; index++) {
                    const page = this._pages[index];
                    if (page._name == this._request._page._name) {
                        if (index == 0) {
                            return null;
                        } else {
                            return this._pages[index - 1];
                        }
                    }
                }
            }
        }

        return null;
    }

    _findNextPage() {
        if (this._pages) {
            if (this._request._page === null) {
                return this._findFirstPage();
            } else {
                for (let index = 0; index < this._pages.length; index++) {
                    const page = this._pages[index];
                    if (page._name == this._request._page._name) {
                        if (index == this._pages.length - 1) {
                            return null;
                        } else {
                            return this._pages[index + 1];
                        }
                    }
                }
            }
        }

        return null;
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

    _fetchErrors() {
        return this._request._errors.slice();
    }

    //public methods
    post(action) {
        if (utils.call.check.inactive(this, 'form.post()')) {
            this._method = 'POST';
            this._action = action;

            //chain
            return this;
        }
    }

    get(action) {
        if (utils.call.check.inactive(this, 'form.get()')) {
            this._method = 'GET';
            this._action = action;

            //chain
            return this;
        }
    }

    session(sessionConstructor) {
        if (utils.call.check.inactive(this, 'form.session()')) {
            if (sessionConstructor === undefined) {
                //use default
                this._sessionConstructor = FormeSession;
            } else {
                this._sessionConstructor = sessionConstructor;
            }

            //chain
            return this;
        }
    }

    error() {
        if (utils.call.check.active(this)) {
            let name = null;
            let error = '';

            //how was this called?
            if (arguments.length == 1) {
                //form error
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

            this._request._errors.push({
                name: name,
                error: error,
            });
        }
    }

    errors() {
        if (utils.call.check.active(this, 'form.errors()')) {
            if (arguments.length == 0) {
                //all errors
                return this._fetchErrors();
            } else {
                //filter by name
                return this._fetchErrors().filter(error => error.name == arguments[0]);
            }
        }
    }

    value() {
        if (utils.call.check.active(this, 'form.value()')) {
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
    }

    values() {
        if (utils.call.check.active(this, 'form.values()')) {
            //get all values
            return this._fetchValues(false, true, false, null);
        }
    }

    raw(input) {
        if (utils.call.check.active(this, 'form.raw()')) {
            //find input
            input = this._findInput(input);
            if (input == null) {
                return null;
            }

            //return the value
            return this._request._raw[input._name];
        }
    }

    //operation api
    view(storage, values) {
        if (utils.call.check.inactive(this, 'form.view()')) {
            //wrap it in clone of form
            return this._wrap(storage)
            .then(form => form._view(values));
        }
    }

    submit() {
        if (utils.call.check.inactive(this, 'form.submit()')) {
            if (arguments.length >= 1 && typeof arguments[0] == 'function') {
                //add submit handler
                return super.submit(...arguments)
            } else if (arguments.length >= 1 && typeof arguments[0] == 'object') {
                //submit form
                const storage = arguments[0];

                //wrap it in clone of form
                return this._wrap(storage)
                .then(form => form._validate(true, arguments[1]));
            } else {
                utils.call.invalid('form.submit()');
            }
        }
    }

    validate() {
        if (utils.call.check.inactive(this, 'form.validate()')) {
            if (arguments.length >= 1 && typeof arguments[0] == 'function') {
                //add validate handler
                return super.validate(...arguments)
            } else if (arguments.length >= 1 && typeof arguments[0] == 'object') {
                //validate form (without submitting)
                const storage = arguments[0];

                //wrap it in clone of form
                return this._wrap(storage)
                .then(form => form._validate(false, arguments[1]));
            } else {
                utils.call.invalid('form.validate()');
            }
        }
    }

    store() {
        if (utils.call.check.active(this, 'form.store()')) {
            return this._save()
            .then(() => new FormeResult(this));
        }
    }

    action() {
        if (arguments.length == 2 && this._request === null) {
            //add action handler
            return super.action(...arguments);

        } else if (arguments.length == 3 && this._request !== null) {
            //processing submitted actions
            return this._processActions(...arguments);
        }

        throw new Error('invalid call to form.action()');
    }

    page(name, callback) {
        if (utils.call.check.inactive(this, 'form.page()')) {
            if (arguments.length == 1) {
                //static page
                if (this._pages === null) {
                    this._pages = [];
                }

                const page = new FormePage(this, name, null);
                this._pages.push(page);

                //chain page
                return page;
            } else if (arguments.length == 2) {
                //dynamic page
                if (this._pages === null) {
                    this._pages = [];
                }

                this._pages.push(new FormePage(this, name, callback));

                //chain form
                return this;
            }
        }
    }
}

//expose module
module.exports = function(name, method, session) {
    return new Forme(name, method, session);
};

module.exports.FormeError = FormeError;
module.exports.FormeInputError = FormeInputError;