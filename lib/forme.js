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

//global (local to this file)
let defaultDriver = FormeDriver;
let sessionTimeout = 1000*60*60*12;//default 12 hour timeout for life of form
let sessionPrune = 50;//limit the total number of allowed form sessions
let sessionTokenSize = 20;//20;//size of the token generated (currently cant be configured)

//main class
class Forme extends FormeContainer {
    constructor(name) {
        super('form', null, name);

        //set form after the fact
        this._form = this;

        this._driver = null;
        this._request = null;

        this._action = '';
        this._identifier = null;
        this._method = 'POST';
        this._pageAllowed = null;//null, false, true (indicates current paging style of the form)
        this._pages = null;
        this._unrequire = false;

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

    get _sessionTimeout() {
        //return global value
        return sessionTimeout;
    }

    get _sessionPrune() {
        //return global value
        return sessionPrune;
    }

    get _sessionTokenSize() {
        //return global value
        return sessionTokenSize;
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
        //todo: move any info that needs cloning, to the request and keep the form pure!
        const form = this._clone();

        //prepare
        form._request = new FormeRequest(form);
        form._driver = new form._driverClass(form._name, storage, form._request);

        //chain cloned form
        return Promise.resolve(form);
    }

    _view(values) {
        //at this point we have called _wrap() so we have: driver, request, live (copied) version of the form
        return this._load()
        .then(() => this._build(true, false, values))
        .then(() => this._processSteps(true, [
            this._processJourney,
        ]))
        .then(() => this._finish(true))
        .catch(err => {
            //catch unhandled errors (eg NOT FormeError errors)
            this._catchError(err);
            return this._finish(false);
        });
    }

    _execute(submit, values) {
        return this._load()
        .then(() => this._build(false, submit, values))
        .then(() => this._processSteps(true, [
            //init
            this._processJourney,
            
            //validation
            this._processInputExecution,//includes process and validate handlers
            this._processPageValidation,
            this._processFormValidation,
            this._processValidationErrors,
            
            //inner workings
            this._processValidState,
            this._processSpecialActions,//this might stop anything else executing
            
            //success
            //different order, form first as page might rely on something form provides!
            this._processFormSuccess,
            this._processPageSuccess,
            this._processInputSuccess,
            
            //submit handlers
            this._processInputSubmit,
            this._processPageSubmit,
            this._processFormSubmit,
            
            //action handlers
            this._processInputActions,
            this._processPageActions,
            this._processFormActions,

            //done handlers
            this._processInputDone,
            this._processPageDone,
            this._processFormDone,
        ]))
        .then(() => this._finish(true))
        .catch(err => {
            //do we need to catch unhandled errors?
            this._catchError(err);

            //handle anything that needs to process before finishing
            //these functions should have guards preventing them being called multiple times per request
            return this._processSteps(false, [
                this._processValidState,
                this._processSpecialActions,

                //success
                //different order, form first as page might rely on something form provides!
                this._processFormFail,
                this._processPageFail,
                this._processInputFail,
            ])
            .then(() => this._finish(false));
        });
    }

    _load() {
        //if looking for where load handlers are called, see _buildFormLoadHandlers
        this._request._loading = true;
        return this._request._load()
        .then(() => {
            this._request._loading = false;
            this._request._started = true;
        })
        .catch(err => {
            //failed to load, this causes a reset so there is no point capturing the error
            this._reset();

            //pass on the error anyway..lol
            return Promise.reject(err);
        });
    }

    _save() {
        //store any input values set to input.keep() dont need to store any values if this is not a submit!
        if (!this._request._reset && this._request._submit) {
            //clear previous store
            this._request._clearCurrentStore();

            //store inputs
            for (let input of this._inputs) {
                //double protection here, checking for _secure flag.
                if (input._keep && !input._secure) {
                    //check to see if secure values are being stored
                    this._request._addInputToStore(input._name, input._group, input._outputName(), this._request._values[input._name]);
                }
            }
        }

        //save the request
        return this._request._save();
    }

    _finish(success) {
        //always flag the visit
        this._request._visitPage(this._request._page);

        //deal with success of view/execute
        if (!success) {
            //fail
            //if we have submitted then we should call for a reload
            if (this._request._submit) {
                //in submit we should call for reload, as it will reload into the view() version
                this._request._reload = true;
            } else {
                //in view mode we should not reload (except for certain circumstances) as it could cause an infinite loop!
                //flag invalid
                this._request._valid = false;

                //attempt to go back a page
                if (this._hasPages()) {
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

            //shutdown (and save, always, as there was an error) the form
            return this._shutdown(true)
            .then(() => new FormeResult(this));
        } else {
            //success
            if (!this._request._prev && this._request._submit) {
                //a good submit!
                this._request._completePage(this._request._page);
                this._request._invalidateAfterPage(this._request._page);
            }

            //always save
            return this._shutdown(true)
            .then(() => {
                const result = new FormeResult(this);

                //reset finished form?
                if (this._request._finished) {
                    this._driver.clear(this._request._token);
                }

                return result;
            });
        }
    }

    _reset() {
        //flag reset
        this._request._halt = true;//must halt otherwise submit handlers could fire after
        this._request._reset = true;
        this._request._reload = true;

        const page = this._findFirstPage();
        this._request._destination = page ? page._destination : null;
    }

    _rerun() {
        //flag reset
        //dont halt, we still want everything else to fire!
        this._request._reset = true;
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

        this._request._halt = true;//must halt otherwise submit handlers could fire after
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

    _shutdown(save) {
        //called at end of request

        //flag form as completely finished if we are not flagged to reload and it was a submit!
        if (this._request._submit && !this._request._reload) {
            this._request._finished = true;
        }

        //do we need to save?
        if (!save) {
            //dont need to save
            return Promise.resolve();
        } else {
            //save, this also handles form reset
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

        let error = null;
        return steps.reduce((prev, curr) => {
            //skip steps if there has been an error
            return prev.then(() => !error?curr.call(this, view, submit, values):Promise.resolve())
            .catch(err => {
                error = err || new FormeError('unspecified error');
            });
        }, Promise.resolve())
        .then(() => {
            if (error) {
                //convert success into error
                return Promise.reject(error);
            } else {
                this._request._building = false;
            }
        })
        .catch(err => {
            this._request._building = false;
            return Promise.reject(error);
        })
    }

    _buildRequest(view, submit) {
        this._request._view = view;
        this._request._submit = submit;

        //override with page for current url
        this._request._setPage(this._findPageDestination(this._driver.url()), true);

        //override with get/post page
        this._request._setPage(this._findPage(this._driver.request(this._pageField)), true);

        //fallback to first page if none, _processJourney() will validate that the correct page is loaded
        if (this._request._page === null) {
            this._request._setPage(this._findFirstPage());
        }

        //set future page default to current page
        this._request._future = this._request._current;

        //set the identifier (used to group submitted values into "pages")
        this._request._identifier = this._makeIdentifier();

        //get if this is the first time a page is seen (eg should we fetch values from the input definitions)
        this._request._pageFirst = !submit && !this._request._hasVisitedPage();
    }

    _buildFormLoadHandlers() {
        return this._loadHandlers === null || this._loadHandlers.length === 0 ? Promise.resolve() : this._nextLoadHandler(0);
    }

    _buildPageLoadHandlers() {
        return this._request._page === null || this._request._page._loadHandlers === null || this._request._page._loadHandlers.length === 0 ? Promise.resolve() : this._request._page._nextLoadHandler(0);
    }

    _buildForm() {
        //.build() the form
        return this._buildHandlers === null || this._buildHandlers.length === 0 ? Promise.resolve() : this._nextBuildHandler(0);
    }

    _buildPage() {
        //.build() the page
        const page = this._request._page;

        if (page === null || page._buildHandlers === null || page._buildHandlers.length === 0) {
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
        //build values after the request has loaded, but before we process validate and submit
        return new Promise((resolve, reject) => {
            //build fresh copies of the values
            const buildRaw = {};
            const buildValues = {};

            //read values
            for (let input of this._inputs) {
                buildRaw[input._name] = this._readInputValue(input, this._request._pageFirst, submit, true, false, null, values);//raw values cant read from store
                buildValues[input._name] = this._readInputValue(input, this._request._pageFirst, submit, false, !submit, null, values);//can only read from the store when NOT submitting
            }

            //replace the request values
            this._request._raw = buildRaw;
            this._request._values = buildValues;

            //done
            resolve();
        });
    }

    //private process methods
    _processSteps(halt, steps) {
        let error = null;

        return steps.reduce((prev, curr) => {
            //skip if there has been an error caught!
            return prev.then(() => {
                return (halt && this._request._halt) || error !== null? Promise.resolve() : curr.call(this);
            })
            .catch(err => {
                error = err || new FormeError('unspecified error');
            });
        }, Promise.resolve())
        .then(() => {
            //convert success into error
            if (error) {
                return Promise.reject(error);
            }
        })
    }

    _processJourney() {
        let valid = true;
        let lastViablePage = null;

        if (this._request._page) {
            //check destination/current when in pageLocation mode
            if (valid && this._request._page._destination !== null) {
                const currentUrl = this._driver.url();
                if (!utils.url.containsQuery(currentUrl, this._request._page._destination) || !utils.url.comparePaths(currentUrl, this._request._page._destination)) {
                    valid = false;
                }
            }

            //validate all prior pages in the journey
            if (valid) {
                //get current page index
                const pageIndex = this._findPageIndex(this._request._current);
                if (pageIndex > 0) {
                    //scan all pages leading up to this page index
                    for (let index = 0; index < pageIndex; index++) {
                        const page = this._pages[index];

                        if ((this._request._view && !this._request._hasCompletedPage(page)) || (this._request._submit && !this._request._hasVisitedPage(page))) {
                            //halt further operation
                            valid = false;
                            break;
                        } else {
                            //track last viable, visited page so we can redirect to it!
                            lastViablePage = page;
                        }
                    }
                }
            }
        }

        //finish validating journey
        if (valid) {
            //original journey was a ok!
            return Promise.resolve();
        } else {
            //the journey was invalid, can we save it?
            if (lastViablePage) {
                this._request._future = lastViablePage;

                //this error will be swallowed depending on where _processJourney was called
                //its purpose is to trigger a fail result so the resulting page will redirect!
                return Promise.reject(new FormeError('invalid form journey'));
            } else {
                //epic fail!
                this._reset();
                return Promise.reject(new FormeError('invalid form journey'));
            }
        }
    }

    _processInputExecution() {
        if (this._inputs.length === 0) {
            return Promise.resolve();
        }

        //iterate inputs 1 by 1, and then reject if ANY error was found (after)
        let errors = [];
        let index = 0;

        const execute = () => {
            const next = () => ++index === this._inputs.length ? Promise.resolve() : execute();

            return this._inputs[index]._execute()
            .then(next)
            .catch(err => {
                //error executing input
                errors.push(err);
                return next();
            });
        };

        return execute()
        .then(() => errors.length ? Promise.reject() : Promise.resolve());
    }

    _processPageValidation() {
        return this._request._page === null ? Promise.resolve() : this._request._page._validate();
    }

    _processFormValidation() {
        return this._validate();
    }

    _processValidationErrors() {
        //any errors?
        return this._request._hasError() ? Promise.reject() : Promise.resolve();
    }

    _processValidState() {
        this._request._valid = this._request._error === false;
        return Promise.resolve();
    }

    _processFormSuccess() {
        return this._success();
    }

    _processPageSuccess() {
        return this._request._page === null ? Promise.resolve() : this._request._page._success();
    }

    _processInputSuccess() {
        return this._inputs.length === 0 ? Promise.resolve() : this._nextInputSuccessHandler(0);
    }

    _processFormFail() {
        return this._fail();
    }

    _processPageFail() {
        return this._request._page === null ? Promise.resolve() : this._request._page._fail();
    }

    _processInputFail() {
        return this._inputs.length === 0 ? Promise.resolve() : this._nextInputFailHandler(0);
    }
    
    _processInputSubmit() {
        return this._inputs.length === 0 ? Promise.resolve() : this._nextInputSubmitHandler(0);
    }

    _processPageSubmit() {
        return this._request._page === null ? Promise.resolve() : this._request._page._submit();
    }

    _processFormSubmit() {
        return this._submit();
    }

    _processInputActions() {
        //trigger special actions directly from input values. These values start with forme:
        for (let input of this._inputs) {
            if (input._actions !== null) {
                const inputValue = this._request._values[input._name];
                for (let action of input._actions) {
                    //trigger with matching value
                    //dont trigger special actions
                    if (!action.special && ((action.value === null && inputValue !== undefined) || action.value === inputValue)) {
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
        return this._request._page === null || this._request._page._actionHandlers === null || this._request._page._actionHandlers.length === 0 ? Promise.resolve() : this._request._page._nextActionHandler(0);
    }

    _processFormActions() {
        return this._actionHandlers === null || this._actionHandlers.length === 0 ? Promise.resolve() : this._nextActionHandler(0);
    }

    _processFormDone() {
        return this._done();
    }

    _processPageDone() {
        return this._request._page === null ? Promise.resolve() : this._request._page._done();
    }

    _processInputDone() {
        return this._inputs.length === 0 ? Promise.resolve() : this._nextInputDoneHandler(0);
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

                                case constants.actions.rerun:
                                    //flag the form for rerun! (only if form valid)
                                    if (inputValue !== null && !this._request._special && this._request._valid) {
                                        this._request._special = true;
                                        this._rerun();
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
    _nextInputSuccessHandler(index) {
        return this._inputs[index]._success()
        .then(() => ++index === this._inputs.length ? Promise.resolve() : this._nextInputSuccessHandler(index));
    }

    _nextInputFailHandler(index) {
        return this._inputs[index]._fail()
        .then(() => ++index === this._inputs.length ? Promise.resolve() : this._nextInputFailHandler(index));
    }

    _nextInputSubmitHandler(index) {
        return this._inputs[index]._submit()
        .then(() => ++index === this._inputs.length ? Promise.resolve() : this._nextInputSubmitHandler(index));
    }

    _nextInputDoneHandler(index) {
        return this._inputs[index]._done()
        .then(() => ++index === this._inputs.length ? Promise.resolve() : this._nextInputDoneHandler(index));
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

    _executeInvalidHandler(handler) {
        return handler.call(this, this);
    }

    _executeSuccessHandler(handler) {
        return handler.call(this, this);
    }

    _executeFailHandler(handler) {
        return handler.call(this, this);
    }

    _executeSubmitHandler(handler) {
        return handler.call(this, this);
    }

    _executeActionHandler(handler, action) {
        return handler.call(this, this, action.action, action.context);
    }

    _executeDoneHandler(handler) {
        return handler.call(this, this);
    }

    //private read methods
    _readValue(valueName, first, submit, raw, store, permanentValue, overrideValue, defaultValue, values) {
        //check to see if input is forcing value (this cant be overridden)
        if (!raw && permanentValue !== null) {
            return permanentValue;
        }

        //check to see if there is an override value (only when submitting)
        if (submit && overrideValue !== null) {
            return overrideValue;
        }

        //override with values passed in
        if (values) {
            const result = values[valueName];
            if (result !== undefined) {
                return result;
            }
        }

        //are we submitting
        if (submit) {
            //always read from the driver first (aside from any overrides above)
            const result = this._readValueFromDriver(valueName);
            if (result !== undefined) {
                return result;
            }

            //there is no value so should we check other places?
            //...only if specified (so this function _findValue* should be called with precision caution to the max!)
            if (store) {
                const result = this._readValueFromStore(valueName);
                if (result !== undefined) {
                    return result;
                }
            }
        } else {
            //check in request
            //its important to only read information from certain places based on the current state
            if (first) {
                //first time so we can only fetch from the store
                if (store) {
                    const result = this._readValueFromStore(valueName);
                    if (result !== undefined) {
                        return result;
                    }
                }
            } else {
                //not the first time
                
                //are we reading a raw value?
                if (raw) {
                    //raw can only load from request raw
                    const result = this._request._raw[valueName];
                    return result === undefined?null:result;
                } else {
                    //try the store first!
                    if (store) {
                        const result = this._readValueFromStore(valueName);
                        if (result !== undefined) {
                            return result;
                        }
                    }
                        
                    //continue to try and read the value from the request built values
                    //always return a value here so we dont fallback to the defaultValue at the bottom of the function
                    const result = this._request._values[valueName];
                    return result === undefined?null:result;
                }
            }
        }

        //ok use the passed in default value
        return defaultValue;
    }

    _readInputValue(input, first, submit, raw, store, defaultValue, values) {
        //check if the input exists!
        if (input === null) {
            return defaultValue;
        }

        //depending on submit or first we modify the default value to that of the input
        return this._readValue(input._name, first, submit, raw, store, input._permanentValue, input._overrideValue, !submit && first?input._defaultValue || defaultValue:defaultValue, values);
    }

    _readValueFromStore(valueName) {
        const store = this._request._currentStore();
        return store?store.names[valueName]:undefined;//might be undefined
    }

    _readValueFromDriver(valueName) {
        switch (this._method) {
            case 'GET':
                return this._driver.get(valueName, undefined);
            case 'POST':
                return this._driver.post(valueName, undefined);
        }

        return undefined;
    }
    
    //private find methods
    _findPage(name) {
        if (name !== undefined && this._pages) {
            for (let page of this._pages) {
                if (page._name === name) {
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
                if (page._name === name) {
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
                    if (page._name === this._request._current) {
                        if (index === 0) {
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
                    if (page._name === this._request._current) {
                        if (index === this._pages.length - 1) {
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
        //get all values from various locations!
        //also see: _buildValues() and _readInputValue()
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
                            //input isn't grouped, so easy to make lookup
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
        //the identifier is primarily used to store information unique to 1 step of a form
        if (this._identifier !== null) {
            //user set
            return '__forme_identifier__override__' + this._identifier;
        } else {
            if (this._request._page !== null) {
                //easy can just use page name as it is unique within the form
                return '__forme_identifier__page__' + this._request._current;
            } else {
                //we still might be paging, but between different forms
                //if the users form has the same name, then we might end up overwriting values stored for that page
                //need to generate a unique identifier based on details that are known
                return '__forme_identifier__auto__' + this._name + '__' + utils.url.path(this._driver.url());
            }
        }
    }

    _makeAction() {
        //get query from the url provided by the driver
        const query = utils.url.extractQuery(this._driver.url());

        //filter any input values
        if (this._method === 'GET') {
            for (let input of this._inputs) {
                delete query[input._name];
            }
        }

        //add the token
        query[this._tokenField] = this._request._token;

        //build the action using the provided action
        return utils.url.addQuery(this._action, query, false);
    }

    _makeTemplate() {
        const errors = this._request._fetchErrors();

        //build action

        //build form template
        const template = {
            form: {
                name: this._name,
                method: this._method,
                action: this._makeAction(),
                context: this._context,
                first: this._request._formFirst && this._request._pageFirst,//both must be first!
                errors: errors.filter(error => this._inputs.find(input => input._name === error.name) === undefined),
            },
            input: this._makeGroupStructure(),
        };

        //build the grouped input structure
        for (let input of this._inputs) {
            const type = input._calculateType();
            const alias = input._outputName();

            //build it and they will come
            const buildInput = {
                id: input._id !== null ? input._id : 'forme_input__' + input._name,
                name: input._name,
                alias: alias,
                className: input._classNames.join(' '),
                data: Object.assign({},...input._data.map(data => ({['data-'+data.name]:data.value}))),
                label: input._label,
                help: input._help,
                type: type,
                placeholder: input._placeholder,
                required: !this._unrequire && input._required,
                readonly: input._readonly,
                value: this._request._values[input._name],
                checked: (this._request._pageFirst && input._checked) || (!this._request._pageFirst && ((type === 'checkbox' && this._request._values[input._name] !== null) || (type !== 'checkbox' && this._request._values[input._name] !== null))),
                errors: errors.filter(error => error.name === input._name).map(error => error.error),
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
        const page = this._pageAllowed !== false && this._pages !== null && !this._isFirstPage(this._request._future);
        let destination = this._request._destination === null?this._driver.url():this._request._destination;

        return this._makeUrl(destination, this._request._token, page?this._request._future:false);
    }

    //private set methods
    _setInputNameValue(inputName, value) {
        if (inputName === null || inputName.length === 0) {
            return null;
        }

        this._request._values[inputName] = value;
    }

    //private get methods
    _getInputNameValue(inputName, unsafe) {
        if (inputName === null || inputName.length === 0) {
            return null;
        }

        //need to handle building case carefully
        if (this._isBuilding()) {
            //the form is building so we need to deal with reading values slightly unsafely.
            //for example: what if we have an input that gets rebuilt dynamically using the value from the another input on the same page. This will always be fine on the first build of the form.
            //On the second build of the page; perhaps there was an error; the value we are relying on to build the dynamic input, needs to be available to read.
            const input = this._findInput(inputName);

            //we only allow inputs that exist, otherwise its too dangerous!
            if (input === null) {
                if (unsafe) {
                    //override in unsafe mode
                    return this._request._values[inputName];
                } else {
                    return null;
                }
            }

            //ok read the value and pass it through input process handlers (such as convert)
            //ok that seemingly simple operation took a shit ton of refactoring :D
            return input._processWithValue(this._readValue(inputName, this._request._pageFirst, this._request._submit, false, true, input?input._permanentValue:null, input?input._overrideValue:null, null, null), false);
        } else {
            //form has already been built, so we know that the value will exist in the request!
            return this._request._values[inputName];
        }
    }
    
    //private is methods
    _isFirstPage(page) {
        if (!this._hasPages()) {
            return true;
        } else {
            if (!page) {
                return this._findPageIndex(this._request._current) === 0;
            } else {
                if (typeof page === 'object') {
                    return this._findPageIndex(page._name) === 0;
                } else {
                    return this._findPageIndex(page) === 0;
                }
            }
        }
    }

    _isStarted() {
        return this._request !== null && this._request._started;
    }

    _isBuilding() {
        return this._request !== null && this._request._building;
    }

    //private has methods
    _hasPages() {
        return this._pages !== null && this._pages.length > 0;
    }

    //private error methods
    _catchError(err) {
        //catch errors not related to forme
        if (err && err.message.length && !(err instanceof FormeError) && !(err instanceof FormeInputError)) {
            if (constants.dev) {
                //development mode
                //to console
                console.error(err.stack);

                //to container
                this.error('[development] '+err.toString());
            } else {
                //production
                this.error(new FormeError('Unhandled Error'));
            }
        }
    }

    //public properties
    storage() {
        //gets the storage that was given to the form
        if (utils.call.check.not.inactive(this, 'form.storage()')) {
            return this._driver._storage;
        }
    }

    template() {
        if (utils.call.check.active(this, 'form.template()')) {
            return this._makeTemplate();
        }
    }

    //public methods
    post(action) {
        if (utils.call.check.not.active(this, 'form.post()')) {
            this._method = 'POST';
            this._action = action || '';

            //chain
            return this;
        }
    }

    get(action) {
        if (utils.call.check.not.active(this, 'form.get()')) {
            this._method = 'GET';
            this._action = action || '';

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
        if (utils.call.check.not.inactive(this)) {
            let name = null;
            let error = '';

            //how was this called?
            if (arguments.length === 1) {
                //form error
                error = arguments[0];
            } else if (arguments.length === 2) {
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
                        } else if (typeof input._pipe === 'string') {
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
        if (utils.call.check.not.inactive(this, 'form.errors()')) {
            if (arguments.length === 0) {
                //all errors
                return this._fetchErrors();
            } else {
                //filter by name
                return this._fetchErrors().filter(error => error.name === arguments[0]);
            }
        }
    }

    getValue(input, unsafe) {
        if (utils.call.check.not.inactive(this, 'form.getValue()')) {
            return this._getInputNameValue(input, !!unsafe);
        }
    }

    setValue(input, value) {
        if (utils.call.check.not.inactive(this, 'form.setValue()')) {
            this._setInputNameValue(input, value);

            //chain
            return this;
        }
    }

    values() {
        if (utils.call.check.not.inactive(this, 'form.values()')) {
            if (!this._request._building) {
                //get submitted values
                return this._fetchValues(false, true, false, true, false, true, null, null);
            } else {
                //get stored values
                return this._fetchValues(false, true, false, true, false, true, null, null);
            }
        }
    }

    raw(input) {
        if (utils.call.check.not.inactive(this, 'form.raw()')) {
            //find input
            input = this._findInput(input);
            if (input === null) {
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
            if (arguments.length === 1 && (typeof arguments[0] === 'function' || Array.isArray(arguments[0]))) {
                //add submit handlers
                return super.submit(arguments[0])
            } else if (arguments.length >= 1 && typeof arguments[0] === 'object') {
                //submit form
                const [storage, values] = arguments;

                //wrap it in clone of form
                return this._wrap(storage)
                .then(form => form._execute(true, values));
            } else {
                utils.call.invalid('form.submit()');
            }
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
                if ((arguments.length === 2 && arguments[1] === true) || Array.isArray(arguments[0])) {
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
        }
    }

    rerun() {
        //trigger special action manually
        if (utils.call.check.active(this, 'form.rerun()')) {
            if (this._request._valid) {
                this._request._special = true;
                this._rerun();

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
                    page = this._findPage(page);
                    if (!page) {
                        //page doesnt exist
                        return this._driver.url();
                    } else {
                        //let the page decide what teh url should be
                        return this._makeUrl(page._url, this._request._token, !this._isFirstPage(page))
                    }
                }
            }
        }
    }

    visitedPage(page) {
        //check if page has been visited
        if (utils.call.check.not.inactive(this, 'form.visitedPage()')) {
            if (!this._hasPages()) {
                return false;
            } else {
                if (page === undefined) {
                    //if no page is defined then use current
                    return this._request._hasVisitedPage(this._request._page);
                } else {
                    //check it!
                    return this._request._hasVisitedPage(this._findPage(page));
                }
            }
        }
    }

    completedPage(page) {
        //check if page can be completed
        if (utils.call.check.not.inactive(this, 'form.completedPage()')) {
            if (!this._hasPages() || !page) {
                return false;
            } else {
                //check it!
                return this._request._hasCompletedPage(this._findPage(page));
            }
        }
    }

    unrequire() {
        //useful for debugging
        if (utils.call.check.not.active(this._form, 'form.unrequire()')) {
            //all values are unrequired
            this._unrequire = true;

            //chain
            return this;
        }
    }
}

//expose module
module.exports = function(name) {
    return new Forme(name);
};

module.exports.Forme = Forme;
module.exports.FormeDriver = FormeDriver;
module.exports.FormeError = FormeError;
module.exports.FormeInputError = FormeInputError;

//utility functions
module.exports.driver = function(driver) {
    defaultDriver = driver;
};

module.exports.sessions = function(timeout, prune) {
    sessionTimeout = timeout;
    sessionPrune = prune;
};