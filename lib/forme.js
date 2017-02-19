'use strict';

//module imports
const extend = require('extend');

//local imports
const constants = require('./constants');
const utils = require('./utils');

const FormeSession = require('./session');
const FormeStorage = require('./storage');
const FormeContainer = require('./container');
const FormePageContainer = require('./pageContainer');
const FormePageLocation = require('./pageLocation');
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
        super('form', null, name);

        this._form = this;
        this._storage = null;
        this._request = null;

        this._action = '';
        this._identifier = null;
        this._method = 'POST';
        this._pageAllowed = null;//null, false, true
        this._pages = null;

        this._sessionConstructor = FormeSession;//default session handler is reading from storage.session (eg req.session)
        this._session = null;
    }

    //properties
    get _tokenField() {
        return this._name + '_token';
    }

    get _pageField() {
        return this._name + '_page';
    }

    //private command methods
    _clone(override) {
        //create copy
        const clone = new Forme;
        override = extend(false, {}, override, {_form: clone});

        //iterate over properties
        for (let key of Object.keys(this)) {
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

    _view(values) {
        //viewing the container (rendering is not *yet?*) handled by this module)
        return this._load()
        .then(() => this._buildSteps(false, values, [
            this._buildRequest,
            this._buildForm,
            this._buildPage,
            this._buildValues,
        ]))
        .then(() => this._processSteps([
            this._processJourney,
        ]))
        .then(() => this._success())
        .catch(err => {
            this._catchError(err);
            return this._fail();
        });
    }

    _validate(submit, values) {
        //everything called from here will have the cloned this object trickle down

        return this._load()
        .then(() => this._buildSteps(submit, values, [
            this._buildRequest,
            this._buildForm,
            this._buildPage,
            this._buildValues,
        ]))
        .then(() => this._processSteps([
            this._processJourney,
            this._processInputValidation,
            this._processPageValidation,
            this._processFormValidation,
            this._processInputSubmit,
            this._processPageSubmit,
            this._processFormSubmit,
            this._processInputActions,
            this._processPageActions,
            this._processFormActions,
            this._processSpecialActions,
        ]))
        .then(() => this._success())
        .catch(err => {
            this._catchError(err);

            //handle anything that needs to process before finishing
            //these functions should have guards preventing them being called multiple times per request
            return this._processSpecialActions()
            .then(() => this._fail());
        });
    }

    _load() {
        return this._request._load();
    }

    _save() {
        //store any input values set to input.keep()
        if (!this._request._reset) {
            for (let input of this._inputs) {
                if (input._keep) {
                    this._request._addToStore(input._name, input._group, this._request._values[input._name]);
                }
            }
        }

        //save the request
        return this._request._save();
    }

    _success() {
        this._request._valid = true;

        //store that this page has been visited
        this._request._visit();

        return this._finalise(this._pages !== null)
        .then(() => {
            const result = new FormeResult(this);

            //reset finished form?
            if (this._request._finished) {
                this._session.clear();
            }

            return result;
        });
    }

    _fail() {
        this._request._first = !this._request._reset;
        this._request._valid = false;
        this._request._reload = true;

        return this._finalise(true)
        .then(() => new FormeResult(this));
    }

    _reset() {
        //flag reset
        this._request._reset = true;
        this._request._halt = true;
        this._request._reload = true;

        const page = this._findFirstPage();
        this._request._destination = page ? page._destination : null;
    }

    _finalise(save) {
        //called at end of request
        if (this._request._submit && !this._request._reload) {
            this._request._finished = true;
        }

        if (!save) {
            //dont need to save
            return Promise.resolve();
        } else {
            //save
            return this._save()
            .catch(err => {
                //failed to save session (hopefully this will never happen)
                this.error(err.message);

                //flag in the request that it is now invalid and then continue .then()
                this._request._valid = false;
                this._request._finished = false;
                this._request._reload = true;
                return Promise.resolve();
            });
        }
    }

    //private build methods
    _buildSteps(submit, values, steps) {
        //finished building
        this._request._building = true;

        return steps.reduce((prev, curr) => {
            return prev.then(() => curr.call(this, submit, values));
        }, Promise.resolve())
        .then(() => {
            this._request._building = false;
        })
        .catch(err => {
            this._request._building = false;
            throw err;
        })
    }

    _buildRequest(submit) {
        //build the form
        this._request._first = !submit;
        this._request._submit = submit;

        //override with page for current url
        let page = this._findPageDestination(this._storage._url());
        if (page !== null) {
            this._request._page = page;
        }

        //override with get/post page
        page = this._storage._request(this._pageField);
        if (page !== undefined) {
            page = this._findPage(page);
            if (page !== null) {
                this._request._page = page;
            }
        }

        //fallback to first page if none, processJourney will validate that the correct page is loaded
        if (this._request._page === null) {
            this._request._page = this._findFirstPage();
        }

        //set future page default to current page
        this._request._future = this._request._page ? this._request._page._name : null;

        //set the identifier (used to group submitted values into "pages")
        this._request._identifier = this._makeIdentifier();
    }

    _buildForm() {
        //.build() the form
        return this._buildHandlers == null || this._buildHandlers.length == 0 ? Promise.resolve() : this._nextBuildHandler(0);
    }

    _buildPage() {
        //.build() the page
        const page = this._request._page;

        if (page == null || page._buildHandlers == null || page._buildHandlers.length == 0) {
            return Promise.resolve();
        } else {
            return page._nextBuildHandler(0)
            .then(() => {
                //copy the inputs from the page to the form
                if (page._inputs.length) {
                    for (let input of page._inputs) {
                        this._addInput(input);
                    }
                }
            });
        }
    }

    _buildValues(submit, values) {
        //read values
        for (let input of this._inputs) {
            this._request._raw[input._name] = this._findValue(input, submit, true, false, null, values);//cant read from store
            this._request._values[input._name] = this._findValue(input, submit, false, true, null, values);
        }

        return Promise.resolve();
    }

    //private process methods
    _processSteps(steps) {
        return steps.reduce((prev, curr) => {
            return prev.then(() => {
                return this._request._halt ? Promise.resolve() : curr.call(this);
            })
        }, Promise.resolve());
    }

    _processJourney() {
        let valid = true;

        if (this._request._page) {
            //check destination/current when in pageLocation mode
            if (valid && this._request._page._destination !== null) {
                const currentUrl = this._storage._url();
                if (!utils.url.containsQuery(currentUrl, this._request._page._destination) || !utils.url.comparePaths(currentUrl, this._request._page._destination)) {
                    valid = false;
                }
            }

            //validate all prior pages have been visited
            if (valid) {
                const pageIndex = this._findPageIndex(this._request._page._name);
                if (pageIndex > 0) {
                    for (let index = 0; index < pageIndex; index++) {
                        const page = this._pages[index];
                        if (this._request._store.visited[page._name] === undefined) {
                            //halt further operation
                            valid = false;
                            break;
                        }
                    }
                }
            }
        }

        //finish validating journey
        if (valid) {
            return Promise.resolve();
        } else {
            this._reset();
            return Promise.reject(new FormeError('invalid form session'));
        }
    }

    _processInputValidation() {
        if (this._inputs.length == 0) {
            return Promise.resolve();
        }

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

    _processPageValidation() {
        return this._request._page == null || this._request._page._validateHandlers == null || this._request._page._validateHandlers.length == 0 ? Promise.resolve() : this._request._page._nextValidateHandler(0);
    }

    _processFormValidation() {
        return this._validateHandlers == null || this._validateHandlers.length == 0 ? Promise.resolve() : this._nextValidateHandler(0);
    }

    _processInputSubmit() {
        return this._inputs.length == 0 ? Promise.resolve() : this._nextInputSubmitHandler(0);
    }

    _processPageSubmit() {
        return this._request._page == null || this._request._page._submitHandlers == null || this._request._page._submitHandlers.length == 0 ? Promise.resolve() : this._request._page._nextSubmitHandler(0);
    }

    _processFormSubmit() {
        return this._submitHandlers == null || this._submitHandlers.length == 0 ? Promise.resolve() : this._nextSubmitHandler(0);
    }

    _processInputActions() {
        //trigger special actions directly from input values. These values start with forme:
        for (let input of this._inputs) {
            if (input._actions !== null) {
                const inputValue = this._request._values[input._name];
                for (let action of input._actions) {
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

    _processPageActions() {
        return this._request._page == null || this._request._page._actionHandlers == null || this._request._page._actionHandlers.length == 0 ? Promise.resolve() : this._request._page._nextActionHandler(0);
    }

    _processFormActions() {
        return this._actionHandlers == null || this._actionHandlers.length == 0 ? Promise.resolve() : this._nextActionHandler(0);
    }

    _processSpecialActions() {
        //get any actions that inputs may have triggered
        if (this._request._processSpecialActions) {
            this._request._processSpecialActions = false;

            for (let input of this._inputs) {
                if (input._actions !== null) {
                    const inputValue = this._request._values[input._name];

                    for (let action of input._actions) {
                        if (action.special) {
                            switch (action.action) {
                                case constants.actions.prev:
                                    //previous page
                                    if (inputValue !== null && this._pages !== null) {
                                        const page = this._findPreviousPage();

                                        this._request._reload = true;
                                        this._request._special = true;
                                        this._request._destination = page ? page._destination : null;
                                        this._request._future = page ? page._name : null;
                                    }
                                    break;

                                case constants.actions.next:
                                    //next page
                                    if (inputValue !== null) {
                                        const page = this._findNextPage();

                                        this._request._reload = true;
                                        this._request._special = true;
                                        this._request._destination = page ? page._destination : null;
                                        this._request._future = page ? page._name : null;
                                    }
                                    break;

                                case constants.actions.reset:
                                    //reset the form
                                    if (inputValue !== null) {
                                        this._request._special = true;
                                        this._reset();
                                    }
                                    break;
                            }
                        }
                    }
                }
            }
        }

        return Promise.resolve();
    }

    _nextInputSubmitHandler(index) {
        //current input
        return this._inputs[index]._submit()
        .then(() => ++index == this._inputs.length ? Promise.resolve() : this._nextInputSubmitHandler(index));
    }

    //private execute methods
    _executeBuildHandler(handler) {
        return handler.call(this, this);
    }

    _executeValidateHandler(handler, state) {
        return handler.execute(this, state);
    }

    _executeSubmitHandler(handler) {
        return handler.call(this, this);
    }

    _executeActionHandler(handler, action) {
        return handler.call(this, this, action.action, action.context);
    }

    //private find methods
    _findValue(input, submit, raw, store, defaultValue, values) {
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
                const currentStore = store ? this._request._currentStore() : null;

                //do we have anything in the store
                if (this._request._first) {
                    //first time
                    if (values && values[input._name] !== undefined) {
                        //override
                        return values[input._name];

                    } else if (currentStore && currentStore.names[input._name] !== undefined) {
                        //store
                        return currentStore.names[input._name];

                    } else if (input._defaultValue !== null) {
                        //input default value
                        return input._defaultValue;
                    }
                } else {
                    //not the first time
                    if (values && values[input._name] !== undefined) {
                        //override
                        return values[input._name];
                    } else {
                        //load value from request
                        if (raw) {
                            //raw value (cant load from store?)
                            if (this._request._raw[input._name] === undefined) {
                                //blank/empty value
                                return null;

                            } else {
                                return this._request._raw[input._name];
                            }
                        } else {
                            if (currentStore && currentStore.names[input._name] !== undefined) {
                                //store
                                return currentStore.names[input._name];

                            } else if (this._request._values[input._name] !== undefined) {
                                //computed value
                                return this._request._values[input._name];

                            } else {
                                //blank/empty value
                                return null;
                            }
                        }
                    }
                }
            } else {
                //submitted values are always considered raw!
                //unless we override by passing values in, then submit forces values to read from get/post/etc
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

    _findPageIndex(name) {
        if (this._pages) {
            for (let index = 0; index < this._pages.length; index++) {
                const page = this._pages[index];
                if (page._name == name) {
                    return index;
                }
            }
        }
        return -1;
    }

    _findPageDestination(destination) {
        if (this._pages !== null) {
            for (let page of this._pages) {
                if (utils.url.containsQuery(destination, page._destination) && utils.url.comparePaths(destination, page._destination)) {
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

    //private add methods
    _addPageContainer(name, callback) {
        this._pageAllowed = true;
        this._pages = this._pages || [];

        //do we need to generate a page name automatically
        name = name || '__forme__page__' + this._pages.length;

        //enforce unique page names
        if (this._findPage(name)) {
            throw new Error('duplicate page name');
        }

        const page = new FormePageContainer(this, name, callback);
        this._pages.push(page);
        return page;
    }

    _addPageLocation(path) {
        this._pageAllowed = false;
        this._pages = this._pages || [];
        this._pages.push(new FormePageLocation(this, path));
    }

    //private fetch methods
    _fetchValues(secure, group, raw, store, lookup, values) {
        //build values
        values = values || {};

        //read from store first
        //we dump the entire groups structure from store over values, as it will then be overwritten in this func
        store = store ? this._request._fetchStoreValues() : false;
        if (store) {
            //dump store groups into values
            extend(true, values, store.groups);

            //add to lookup
            if (lookup) {
                utils.group.addToLookup(store.groups, lookup);
            }
        }

        //prepare group structure for inputs on this page
        if (group) {
            this._makeGroupStructure(values);
        }

        //iterate over inputs of this form and merge over the top
        let value;
        for (let input of this._inputs) {
            //only allow unsecured values
            if (!secure || !input._secure) {
                //by this point, values will always be ready to use from the storage object
                //get default value state from store, if possible. otherwise null
                if (!store) {
                    value = null;
                } else {
                    //see if store contains this value
                    const tryValue = store.names[input._name];
                    if (tryValue === undefined) {
                        value = null;
                    } else {
                        value = tryValue;
                    }
                }

                //raw or value?
                //dont set value if its not defined in the specified target
                //this will always override
                if (raw) {
                    const tryValue = this._request._raw[input._name];
                    if (tryValue !== undefined) {
                        value = tryValue;
                    }
                } else {
                    const tryValue = this._request._values[input._name];
                    if (tryValue !== undefined) {
                        value = tryValue;
                    }
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
                    utils.group.addGroup(values, alias, input._group, value);

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

    //private make methods
    _makeIdentifier() {
        //this is important as it allows our form to be uniquely identified in all (most) situations
        //the indentifier is primarily used to store information unique to 1 step of a form
        if (this._identifier !== null) {
            //user set
            return '__forme_identifier__override__' + this._identifier;
        } else {
            if (this._request._page !== null) {
                //easy can just use page name as it is unique within the form
                return '__forme_identifier__page__' + this._request._page._name;
            } else {
                //we still might be paging, but between different forms
                //if the users form has the same name, then we might end up overwritting values stored for that page
                //need to generate a unique identifier based on details that are known
                return '__forme_identifier__auto__' + this._name + '__' + utils.url.path(this._storage._url());
            }
        }
    }

    _makeTemplate() {
        const template = {
            form: {
                name: this._name,
                method: this._method,
                action: this._action,
                context: this._context,
                errors: this._request._errors.filter(error => this._inputs.find(input => input._name == error.name) === undefined),
            },
            input: this._makeGroupStructure(),
        };

        //build the grouped input structure
        for (let input of this._inputs) {
            const type = input._calculateType();
            const alias = input._outputName();

            //build it and they will come
            const buildInput = {
                id: input._id !== null ? input.id : 'forme_input__' + input._name,
                name: input._name,
                alias: alias,
                className: input._classNames.join(' '),
                label: input._label,
                help: input._help,
                type: type,
                placeholder: input._placeholder,
                required: input._required,
                readonly: input._readonly,
                value: this._request._values[input._name],//convert value to string as it will be used in template
                checked: (this._request._first && input._checked) || (!this._request._first && ((type == 'checkbox' && this._request._raw[input._name] !== null) || (this._request._raw[input._name] == this._request._values[input._name]))),
                errors: this._request._errors.filter(error => error.name == input._name).map(error => error.error),
                options: input._options,
                context: input._context,
            };

            //add input to group structure
            utils.group.addGroup(template.input, alias, input._group, buildInput);
        }

        //done
        return template;
    }

    _makeGroupStructure(structure) {
        //construct the group structure of all inputs
        structure = structure || {};

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

    //private error methods
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

    //public methods
    post(action) {
        if (utils.call.check.not.active(this, 'form.post()')) {
            this._method = 'POST';
            this._action = action;

            //chain
            return this;
        }
    }

    get(action) {
        if (utils.call.check.not.active(this, 'form.get()')) {
            this._method = 'GET';
            this._action = action;

            //chain
            return this;
        }
    }

    session(sessionConstructor) {
        if (utils.call.check.not.active(this, 'form.session()')) {
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

                return this._request._values[input._name];

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

    values(store) {
        if (utils.call.check.active(this, 'form.values()')) {
            return this._fetchValues(false, true, false, !!store, null, null);
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
        if (utils.call.check.not.active(this, 'form.view()')) {
            //wrap it in clone of form
            return this._wrap(storage)
            .then(form => form._view(values));
        }
    }

    submit() {
        if (utils.call.check.not.active(this, 'form.submit()')) {
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
        if (utils.call.check.not.active(this, 'form.validate()')) {
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

    save() {
        if (utils.call.check.active(this, 'form.save()')) {
            return this._save()
            .then(() => new FormeResult(this));
        }
    }

    page(identifier, location) {
        if (utils.call.check.not.active(this, 'form.page()')) {
            if (location) {
                //add page location
                if (this._pageAllowed === true) {
                    throw new Error('cant call form.pages() after form.page()');
                } else {
                    if (Array.isArray(identifier)) {
                        for (let location of identifier) {
                            this._addPageLocation(location);
                        }
                    } else {
                        this._addPageLocation(identifier);
                    }

                    //chain
                    return this;
                }
            } else {
                //add page object
                if (this._pageAllowed === false) {
                    throw new Error('cant combine page types on the same form');
                } else {
                    return this._addPageContainer(arguments[0], null);
                }
            }
        }
    }

    storage() {
        //gets the storage that was given to the form
        if (utils.call.check.not.inactive(this, 'form.storage()')) {
            return this._request._storage._container;
        }
    }
}

//expose module
module.exports = function(name) {
    return new Forme(name);
};

module.exports.FormeError = FormeError;
module.exports.FormeInputError = FormeInputError;