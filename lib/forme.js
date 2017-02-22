'use strict';

//module imports
const extend = require('extend');

//local imports
const constants = require('./constants');
const utils = require('./utils');

const FormeDriver = require('./driver');
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

//global
let defaultDriver = FormeDriver;

//main class
class Forme extends FormeContainer {
    constructor(name) {
        super('form', null, name);

        this._form = this;
        this._driver = null;
        this._request = null;

        this._action = '';
        this._identifier = null;
        this._method = 'POST';
        this._pageAllowed = null;//null, false, true (indicates current paging style of the form)
        this._pages = null;

        this._driverClass = defaultDriver;
        this._driver = null;
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
        form._driver = new form._driverClass(form._name, storage, form._request);

        //chain cloned form
        return Promise.resolve(form);
    }

    _view(values) {
        return this._load()
        .then(() => this._build(true, false, values))
        .then(() => this._processSteps(true, [
            this._processJourney,
        ]))
        .then(() => this._success())
        .catch(err => {
            this._catchError(err);
            return this._fail();
        });
    }

    _submit(submit, values) {
        return this._load()
        .then(() => this._build(false, submit, values))
        .then(() => this._processSteps(true, [
            this._processJourney,
            this._processInputValidation,
            this._processPageValidation,
            this._processFormValidation,
            this._processValidState,
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
            return this._processSteps(false, [
                this._processValidState,
                this._processSpecialActions,
            ])
            .then(() => this._fail());
        });
    }

    _load() {
        //if looking for where load handlers are called, see _buildCallLoadHandlers
        return this._request._load();
    }

    _save() {
        //store any input values set to input.keep()
        if (!this._request._reset) {
            //store inputs
            for (let input of this._inputs) {
                if (input._keep) {
                    //check to see if secure values are being stored
                    this._request._addToStore(input._name, input._group, input._alias, this._request._values[input._name]);
                }
            }
        }

        //save the request
        return this._request._save();
    }

    _success() {
        //store that this page has been visited
        this._request._visit();

        return this._finalise(this._pages !== null)
        .then(() => {
            const result = new FormeResult(this);

            //reset finished form?
            if (this._request._finished) {
                this._driver.clear(this._request._token);
            }

            return result;
        });
    }

    _fail() {
        this._request._first = !this._request._reset;

        //if we have submitted then we should call for a reload
        //in view mode we should not reload as it could cause an infinite loop!
        if (this._request._submit) {
            this._request._reload = true;
        } else {
            if (!this._hasPages()) {
                //no pages
            } else {
                //try going back a page
                if (this._isFirstPage()) {
                    //cant go back a page
                    this._request._reload = false;
                } else {
                    //go back a page
                    this._prev(true);
                }
            }
        }

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

    _next() {
        const page = this._findNextPage();

        this._request._next = true;
        this._request._reload = true;
        this._request._special = true;
        this._request._destination = page ? page._destination : null;
        this._request._future = page ? page._name : null;
    }

    _prev(keepErrors) {
        const page = this._findPreviousPage();

        this._request._prev = true;
        this._request._reload = true;
        this._request._special = true;
        this._request._destination = page ? page._destination : null;
        this._request._future = page ? page._name : null;

        //clear any errors generated because prev doesnt count
        if (!keepErrors) {
            this._request._clearErrors();
        }
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
    _build(view, submit, values) {
        return this._buildSteps(view, submit, values, [
            this._buildRequest,
            this._buildFormLoadHandlers,
            this._buildPageLoadHandlers,
            this._buildForm,
            this._buildPage,
            this._buildFinaliseInputs,
            this._buildValues,
        ]);
    }

    _buildSteps(view, submit, values, steps) {
        //finished building
        this._request._building = true;

        return steps.reduce((prev, curr) => {
            return prev.then(() => curr.call(this, view, submit, values));
        }, Promise.resolve())
        .then(() => {
            this._request._building = false;
        })
        .catch(err => {
            this._request._building = false;
            throw err;
        })
    }

    _buildRequest(view, submit) {
        //build the form
        this._request._started = true;
        this._request._first = !submit;
        this._request._view = view;
        this._request._submit = submit;

        //override with page for current url
        this._request._setPage(this._findPageDestination(this._driver.url()), true);

        //override with get/post page
        this._request._setPage(this._findPage(this._driver.request(this._pageField)), true);

        //fallback to first page if none, processJourney will validate that the correct page is loaded
        if (this._request._page === null) {
            this._request._setPage(this._findFirstPage());
        }

        //set future page default to current page
        this._request._future = this._request._current;

        //set the identifier (used to group submitted values into "pages")
        this._request._identifier = this._makeIdentifier();
    }

    _buildFormLoadHandlers() {
        return this._loadHandlers == null || this._loadHandlers.length == 0 ? Promise.resolve() : this._nextLoadHandler(0);
    }

    _buildPageLoadHandlers() {
        return this._request._page == null || this._request._page._loadHandlers == null || this._request._page._loadHandlers.length == 0 ? Promise.resolve() : this._request._page._nextLoadHandler(0);
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
            return page._nextBuildHandler(0);
        }
    }

    _buildFinaliseInputs() {
        //copy page inputs into the .wrap() form
        const page = this._request._page;
        if (page !== null && page._inputs !== null && page._inputs.length) {
            for (let input of page._inputs) {
                this._addInput(input);
            }
        }

        //horrah
        return Promise.resolve();
    }

    _buildValues(view, submit, values) {
        //read values
        for (let input of this._inputs) {
            this._request._raw[input._name] = this._findValue(input, submit, true, false, null, values);//cant read from store
            this._request._values[input._name] = this._findValue(input, submit, false, true, null, values);
        }

        return Promise.resolve();
    }

    //private process methods
    _processSteps(halt, steps) {
        return steps.reduce((prev, curr) => {
            return prev.then(() => {
                return halt && this._request._halt ? Promise.resolve() : curr.call(this);
            })
        }, Promise.resolve());
    }

    _processJourney() {
        let valid = true;

        if (this._request._page) {
            //check destination/current when in pageLocation mode
            if (valid && this._request._page._destination !== null) {
                const currentUrl = this._driver.url();
                if (!utils.url.containsQuery(currentUrl, this._request._page._destination) || !utils.url.comparePaths(currentUrl, this._request._page._destination)) {
                    valid = false;
                }
            }

            //validate all prior pages have been visited
            if (valid) {
                const pageIndex = this._findPageIndex(this._request._current);
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

    _processValidState() {
        this._request._valid = this._request._error === false;
        return Promise.resolve();
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
                            //we dont trigger these actions when form._request._special has already been set (could be from manual .next(), .prev() etc)
                            switch (action.action) {
                                case constants.actions.prev:
                                    //previous page, we are ok to skip invalid submit as user will have to come back through this page to complete the form
                                    if (inputValue !== null && this._pages !== null && !this._request._special) {
                                        this._prev(false);
                                    }
                                    break;

                                case constants.actions.next:
                                    if (inputValue !== null && !this._request._special) {
                                        if (!this._request._valid) {
                                            //cant next when invalid, but we still have to reload otherwise it will be treated as submit
                                            this._request._reload = true;
                                        } else {
                                            this._next();
                                        }
                                    }
                                    break;

                                case constants.actions.reset:
                                    //reset the form
                                    if (inputValue !== null && !this._request._special) {
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

    //private next handlers
    _nextInputSubmitHandler(index) {
        //current input
        return this._inputs[index]._submit()
        .then(() => ++index == this._inputs.length ? Promise.resolve() : this._nextInputSubmitHandler(index));
    }

    //private execute methods
    _executeLoadHandler(handler) {
        return handler.call(this, this);
    }

    _executeBuildHandler(handler) {
        return handler.call(this, this);
    }

    _executeValidateHandler(handler, state) {
        return handler.call(this, this, state);
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
                            return this._driver.get(input._name, defaultValue);
                        case 'POST':
                            return this._driver.post(input._name, defaultValue);
                    }
                }
            }
        }

        //ok use the passed in default value
        return defaultValue;
    }

    _findPage(name) {
        if (name !== undefined && this._pages) {
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
                    if (page._name == this._request._current) {
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
                    if (page._name == this._request._current) {
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
    _fetchValues(secure, group, raw, store, special, ignore, lookup, values) {
        //build values
        values = values || {};

        //prepare group structure for inputs on this page
        if (group) {
            this._makeGroupStructure(values);
        }

        //read from store first
        //we dump the entire groups structure from store over values, as it will then be overwritten in this func
        store = store ? this._request._fetchStoreValues() : false;
        if (store) {
            //dump store groups into values
            //dont need to worry about flat named values, as these will be resolved below
            utils.group.apply(values, store.groups);

            //add to lookup
            if (lookup) {
                utils.group.addToLookup(store.groups, lookup);
            }
        }

        //iterate over inputs of this form and merge over the top
        let value;
        for (let input of this._inputs) {
            //only allow unsecured values
            //only allow non special values (unless keep)
            //only allow non ignored values (unless keep)
            if ((!secure || !input._secure) && (special || !input._special || input._keep) && (!ignore || !input._ignore || input._keep)) {
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
        return this._request._fetchErrors();
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
                return '__forme_identifier__page__' + this._request._current;
            } else {
                //we still might be paging, but between different forms
                //if the users form has the same name, then we might end up overwritting values stored for that page
                //need to generate a unique identifier based on details that are known
                return '__forme_identifier__auto__' + this._name + '__' + utils.url.path(this._driver.url());
            }
        }
    }

    _makeTemplate() {
        const errors = this._request._fetchErrors();

        const template = {
            form: {
                name: this._name,
                method: this._method,
                action: this._action,
                context: this._context,
                errors: errors.filter(error => this._inputs.find(input => input._name == error.name) === undefined),
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
                errors: errors.filter(error => error.name == input._name).map(error => error.error),
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
        //construct the group structure of all inputs, dont override existing group structure
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

    _makeUrl(destination, token, page) {
        //calculate details
        let addQuery = null;
        const removeQuery = [];

        //token
        if (!token) {
            removeQuery.push(this._tokenField);
        } else {
            addQuery = addQuery || {};
            addQuery[this._tokenField] = token;
        }

        //page
        if (!page) {
            removeQuery.push(this._pageField);
        } else {
            addQuery = addQuery || {};
            addQuery[this._pageField] = page;
        }

        //add and remove query strings
        if (removeQuery.length) {
            destination = utils.url.removeQuery(destination, removeQuery);
        }

        if (addQuery !== null) {
            destination = utils.url.addQuery(destination, addQuery);
        }

        //done
        return destination;
    }

    _makeDestination() {
        //override skips anything else
        if (this._request._reloadOverride) {
            return this._request._reloadOverride;
        }

        //calculate details
        const hasFuture = this._pages === null || this._request._future === null || this._request._page._destination !== null;
        let destination = this._request._destination === null?this._driver.url():this._request._destination;

        return this._makeUrl(destination, this._request._token, hasFuture?this._request._future:false);
    }

    //private set methods
    _setInputValue(input, value) {
        if (input == null) {
            return null;
        }

        return this._request._values[input._name] = value;
    }

    //private get methods
    _getInputValue(input) {
        if (input == null) {
            return null;
        }

        return this._request._values[input._name];
    }

    //private is methods
    _isFirstPage() {
        if (!this._hasPages()) {
            return true;
        } else {
            return this._findPageIndex(this._request._current) == 0;
        }
    }

    //private has methods
    _hasPages() {
        return this._pages !== null && this._pages.length > 0;
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

    driver(driverClass) {
        if (utils.call.check.inactive(this, 'form.driver()')) {
            if (driverClass === undefined) {
                //use default
                this._driverClass = FormeDriver;
            } else {
                this._driverClass = driverClass;
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

            //let the request deal with it
            this._request._addError(name, error);
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
        if (utils.call.check.not.inactive(this, 'form.value()')) {
            if (arguments.length == 1) {
                //get value
                return this._getInputValue(this._findInput(arguments[0]));

            } else if (arguments.length == 2) {
                //set value
                return this._setInputValue(this._findInput(arguments[0]), arguments[1]);
            }
        }
    }

    values(pages) {
        if (utils.call.check.active(this, 'form.values()')) {
            //dont include special values as this is a user call
            return this._fetchValues(false, true, false, !!pages, false, true, null, null);
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
                const [storage, values] = arguments;

                //wrap it in clone of form
                return this._wrap(storage)
                .then(form => form._submit(true, values));
            } else {
                utils.call.invalid('form.submit()');
            }
        }
    }

    validate(callback, error) {
        if (utils.call.check.not.active(this, 'form.validate()')) {
            return super.validate(callback, error);
        }
    }

    save() {
        if (utils.call.check.active(this, 'form.save()')) {
            return this._save()
            .then(() => new FormeResult(this));
        }
    }

    page() {
        if (utils.call.check.not.active(this, 'form.page()')) {
            if (arguments.length >= 1) {
                if ((arguments.length == 2 && arguments[1] === true) || Array.isArray(arguments[0])) {
                    //add page location
                    if (this._pageAllowed === true) {
                        throw new Error('cant call form.pages() after form.page()');
                    } else {
                        if (Array.isArray(arguments[0])) {
                            for (let location of arguments[0]) {
                                this._addPageLocation(location);
                            }
                        } else {
                            this._addPageLocation(arguments[0]);
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
            } else {
                utils.call.invalid('form.page()');
            }
        }
    }

    storage() {
        //gets the storage that was given to the form
        if (utils.call.check.not.inactive(this, 'form.storage()')) {
            return this._request._driver._storage;
        }
    }

    prev() {
        //trigger special action manually
        if (utils.call.check.active(this, 'form.prev()')) {
            if (this._pages !== null) {
                this._prev(false);

                //do we need to save the form?
                if (!this._request._finished) {
                    //this is from a callback so we dont have to do anything
                    return Promise.resolve(false);
                } else {
                    //called after form has finished so have to do manual stuff!
                    return this._save()
                    .then(() => {
                        //chain with destination so we user manually redirect
                        return this._makeDestination();
                    });
                }
            }

            //nope
            return Promise.resolve(false);
        }
    }

    next() {
        //trigger special action manually
        if (utils.call.check.active(this, 'form.next()')) {
            //must be valid otherwise we can break validation
            if (this._request._valid) {
                this._next();

                //do we need to save the form?
                if (!this._request._finished) {
                    //this is from a callback so we dont have to do anything
                    return Promise.resolve(false);
                } else {
                    //called after form has finished so have to do manual stuff!
                    return this._save()
                    .then(() => {
                        //chain with destination so we user manually redirect
                        return this._makeDestination();
                    });
                }
            }

            //nope
            return Promise.reject(false);
        }
    }

    reset() {
        //trigger special action manually
        if (utils.call.check.active(this, 'form.reset()')) {
            this._request._special = true;
            this._reset();

            //do we need to save the form?
            if (!this._request._finished) {
                //this is from a callback so we dont have to do anything
                return Promise.resolve(false);
            } else {
                //called after form has finished so have to do manual stuff!
                return this._save()
                .then(() => {
                    //chain with destination so we user manually redirect
                    return this._makeDestination();
                });
            }

            //nope
            return Promise.resolve(false);
        }
    }

    reload(destination) {
        //override the result destination
        if (utils.call.check.active(this, 'form.reload()')) {
            this._reload = true;
            this._reloadOverride = destination;
        }
    }

    url(page) {
        //get the url for a particular page
        if (utils.call.check.not.inactive(this, 'form.url()')) {
            if (!this._hasPages()) {
                return this._driver.url();
            } else {
                if (page === undefined) {
                    //if no page is defined then use current
                    if (this._isFirstPage()) {
                        return this._makeUrl(this._driver.url(), this._request._token, false);
                    } else {
                        return this._makeUrl(this._driver.url(), this._request._token, this._request._current);
                    }
                } else {
                    const index = this._findPage(page);
                    if (index == -1) {
                        //page doesnt exist
                        return this._driver.url();
                    } else if (index == 0) {
                        //first page (dont need page)
                        return this._makeUrl(this._driver.url(), this._request._token, false)
                    } else {
                        return this._makeUrl(this._driver.url(), this._request._token, name)
                    }
                }
            }
        }
    }
}

//expose module
module.exports = function(name) {
    return new Forme(name);
};

module.exports.FormeDriver = FormeDriver;
module.exports.FormeError = FormeError;
module.exports.FormeInputError = FormeInputError;

//utility functions
module.exports.driver = function(driver) {
    defaultDriver = driver;
}