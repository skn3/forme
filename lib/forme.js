'use strict';

//local imports
const constants = require('./constants');
const utils = require('./utils');

const FormeDriver = require('./driver');
const FormeContainer = require('./container');
const FormePage = require('./page');
const FormePageLocation = require('./pageLocation');
const FormeInput = require('./input');
const FormeComponent = require('./component');
const FormeRequest = require('./request');
const FormeResult = require('./result');

const FormeError = require('./errors').FormeError;
const FormeDriverError = require('./errors').FormeDriverError;
const FormeConfigurationError = require('./errors').FormeConfigurationError;
const FormeContextError = require('./errors').FormeContextError;
const FormeFormError = require('./errors').FormeFormError;
const FormePageError = require('./errors').FormePageError;
const FormeInputError = require('./errors').FormeInputError;
const FormeComponentError = require('./errors').FormeComponentError;
const FormeValidationError = require('./errors').FormeValidationError;

//regexp to update the exported details from configurable.js: /: [a-zA-Z0-9]*\,/
const {
    FormeConfigurableMethod,
    FormeConfigurableMethodPointer,
    FormeConfigurableOverride,

    FormeConfigurableParam,
    FormeConfigurableExportNot,
    FormeConfigurableBool,
    FormeConfigurableBoolOrNull,
    FormeConfigurableInt,
    FormeConfigurableFloat,
    FormeConfigurableString,
    FormeConfigurableStringOrNull,
    FormeConfigurableObject,
    FormeConfigurableArray,
    FormeConfigurableCallback,
    FormeConfigurableCallbacks,
    FormeConfigurableStrings,

    FormeConfigurableExportProperty,
    FormeConfigurableExportPointer,

    FormeConfigurableExportParam,
    FormeConfigurableExportBool,
    FormeConfigurableExportBoolOrNull,
    FormeConfigurableExportString,
    FormeConfigurableExportStringOrNull,
    FormeConfigurableExportObject,
    FormeConfigurableExportArray,
    FormeConfigurableExportCallback,
    FormeConfigurableExportCallbacks,

    FormeConfigurableExportArrayStrings,
    FormeConfigurableExportArrayObjects,
    FormeConfigurableExportArrayObjectsAssign,

    FormeConfigurableExportExecuteHandler,
    FormeConfigurableExportProcessHandler,
    FormeConfigurableExportValidateHandler,
    FormeConfigurableExportValidateHandlers,
    FormeConfigurableExportInputActions,
    FormeConfigurableExportInputSpecialAction,

    FormeConfigurableExportConditionalString,
} = require('./configurable');

//locals
let defaultDriverClass = FormeDriver;

let sessionTimeout = 1000*60*60*12;//default 12 hour timeout for life of form
let sessionPrune = 50;//limit the total number of allowed form sessions
let sessionTokenSize = 20;//20;//size of the token generated (currently cant be configured)

//main class
class Forme extends FormeContainer {
    constructor(name, driverClass=null) {
        //get correct details
        let configure = null;

        //how is the form defined?
        if (typeof name === 'object') {
            //defined as object
            configure = Object.assign({}, name);

            name = configure.name || undefined;

            delete configure.name;
        }

        //call super
        super(name);

        //self reference!
        this._form = this;

        //set form after the fact
        this._driverClass = driverClass || defaultDriverClass;
        this._driver = null;
        this._request = null;
        this._identifier = null;

        this._method = 'POST';
        this._formAction = '';
        this._pageAllowed = null;//null, false, true (indicates current paging style of the form)
        this._pages = null;
        this._unrequire = false;

        this._inputClassNames = ['forme-input'];
        this._buttonClassNames = ['forme-button'];
        this._errorClassNames = ['forme-error'];
        this._requiredClassNames = ['forme-required'];
        
        //configure (todo: will this cause issues if there is no request object yet?)
        this.configure(configure);
    }

    //private properties
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

    get _pathSegments() {
        //form has no groups or containers
        return [];
    }

    get _containerPathSegments() {
        //form has no groups or containers
        return [];
    }

    get _ownGroupSegments() {
        //form has no groups or containers
        return [];
    }

    get _ownPathSegments() {
        //form has no groups or containers
        return [];
    }

    //public properties
    get formeClass() {
        return 'form';
    }

    get parent() {
        return null;
    }

    get container() {
        return null;
    }

    //private build configuration methods
    _buildConfigurableMethods() {
        return Object.assign(super._buildConfigurableMethods(), {
            //form.method(string, string)
            method: new FormeConfigurableMethod('method', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString('method', true),
                    new FormeConfigurableString(['action', 'address'], false),
                ], true),
            ]),

            //form.post(string)
            post: new FormeConfigurableMethod('post', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['action', 'address'], false),
                ], true),
            ], new FormeConfigurableExportConditionalString('_action', '_method', 'POST')),

            //form.get(string)
            get: new FormeConfigurableMethod('get', [
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['action', 'address'], false),
                ], true),
            ], new FormeConfigurableExportConditionalString('_action', '_method', 'GET')),

            //form.driver(value)
            driver: new FormeConfigurableMethod('driver', [
                new FormeConfigurableOverride([
                    new FormeConfigurableParam('driver', false),
                ], true),
            ], new FormeConfigurableExportPointer('_driverClass')),

            //form.page(*multiple*)
            page: new FormeConfigurableMethod('page', [
                //form.page(array)
                new FormeConfigurableOverride([
                    new FormeConfigurableArray(['page', 'pages', 'configuration'], true),
                ], true),

                //form.page(object)
                new FormeConfigurableOverride([
                    new FormeConfigurableObject(['page', 'pages', 'configuration'], true),
                ], true),

                //form.page(name)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['name'], false),//optional because form auto generates page names otherwise!
                ], true),
            ]),
            pages: new FormeConfigurableMethodPointer('page'),

            //form.externalPage(*multiple*)
            externalPage: new FormeConfigurableMethod('page', [
                //form.page(name)
                new FormeConfigurableOverride([
                    new FormeConfigurableString(['location'], true),
                ], true),

                //form.page(array)
                new FormeConfigurableOverride([
                    new FormeConfigurableArray(['location', 'locations'], true),
                ], true),
            ]),
            externalPages: new FormeConfigurableMethodPointer('externalPage'),

            //form.unrequire(bool)
            unrequire: new FormeConfigurableMethod('unrequire', [
                new FormeConfigurableOverride([
                    new FormeConfigurableBool('unrequire', false, true),
                ], true),
            ], new FormeConfigurableExportBool('_hidden')),

            //form.inputClassName(*multiple*)
            inputClassName: new FormeConfigurableMethod('inputClassName', [
                //form.inputClassName(className) array
                new FormeConfigurableOverride([
                    new FormeConfigurableArray('className', false, true),
                ], true),

                //form.inputClassName(className) string
                new FormeConfigurableOverride([
                    new FormeConfigurableString('className', false, true),
                ], true),

                //form.inputClassName()
                new FormeConfigurableOverride([], true),
            ], new FormeConfigurableExportArrayStrings('_inputClassNames')),

            //form.buttonClassName(*multiple*)
            buttonClassName: new FormeConfigurableMethod('buttonClassName', [
                //form.buttonClassName(className) array
                new FormeConfigurableOverride([
                    new FormeConfigurableArray('className', false, true),
                ], true),

                //form.buttonClassName(className) string
                new FormeConfigurableOverride([
                    new FormeConfigurableString('className', false, true),
                ], true),

                //form.buttonClassName()
                new FormeConfigurableOverride([], true),
            ], new FormeConfigurableExportArrayStrings('_buttonClassNames')),

            //form.errorClassName(*multiple*)
            errorClassName: new FormeConfigurableMethod('errorClassName', [
                //form.errorClassName(className) array
                new FormeConfigurableOverride([
                    new FormeConfigurableArray('className', false, true),
                ], true),

                //form.errorClassName(className) string
                new FormeConfigurableOverride([
                    new FormeConfigurableString('className', false, true),
                ], true),

                //form.errorClassName()
                new FormeConfigurableOverride([], true),
            ], new FormeConfigurableExportArrayStrings('_errorClassNames')),

            //form.requiredClassName(*multiple*)
            requiredClassName: new FormeConfigurableMethod('requiredClassName', [
                //form.requiredClassName(className) array
                new FormeConfigurableOverride([
                    new FormeConfigurableArray('className', false, true),
                ], true),

                //form.requiredClassName(className) string
                new FormeConfigurableOverride([
                    new FormeConfigurableString('className', false, true),
                ], true),

                //form.requiredClassName()
                new FormeConfigurableOverride([], true),
            ], new FormeConfigurableExportArrayStrings('_requiredClassNames')),
        });
    }

    //private run methods
    _runWrap(storage) {
        //bootstrap form processing. this operation should not produce any rejections
        return new Promise((resolve, reject) => {
            //clone form
            //todo: move any info that needs cloning, to the request and keep the form pure!
            const form = this._clone();

            //prepare
            form._request = new FormeRequest(form);
            form._driver = new form._driverClass(form._name, storage, form._request);

            //chain cloned form
            return resolve(form);
        });
    }

    _runView(values) {
        //at this point we have called _wrap() so we have: driver, request, live (copied) version of the form
        return this._runLoad()
        .then(() => this._build(true, false, values))
        .then(() => this._processSteps(true, [
            () => this._processJourney(),
        ]))

        //FINISH HIM!
        .then(() => this._runFinish(true))

        //whoops fail time!
        .catch(err => {
            //catch unhandled errors (eg NOT FormeError errors)
            this._catchError(err);
            return this._runFinish(false);
        });
    }

    _runSubmit(submit, values) {
        return this._runLoad()
        .then(() => this._build(false, submit, values))
        .then(() => this._processSteps(true, [
            //init
            () => this._processJourney(),//process paged forms

            //execution (process and validation)
            () => this._executeChildren(),//process and validate elements
            () => !this._request._page?Promise.resolve():this._request._page._execute(),//calls page._fooChildren then page._fooSelf
            () => this._executeSelf(),//validate the form
            () => this._processValidationErrors(),

            //inner workings
            () => this._processValidState(),
            () => this._processSpecialActions(),//this might stop anything else executing

            //success
            //different order, form first as page might rely on something form provides!
            () => this._successSelf(),
            () => !this._request._page?Promise.resolve():this._request._page._success(),//calls page._fooSelf then page._fooChildren
            () => this._successChildren(),

            //submit handlers
            () => this._submitChildren(),
            () => !this._request._page?Promise.resolve():this._request._page._submit(),//calls page._fooChildren then page._fooSelf
            () => this._submitSelf(),

            //action handlers
            () => this._processActionTriggers(),//reads in action triggers from the form
            () => !this._request._page?Promise.resolve():this._request._page._actions(),//only page
            () => this._actions(),//only form

            //done handlers
            () => this._doneChildren(),
            () => !this._request._page?Promise.resolve():this._request._page._done(),//calls page._fooChildren then page._fooSelf
            () => this._doneSelf(),
        ]))

        //FINISH HIM!
        .then(() => this._runFinish(true))

        //whoops, fail time!
        .catch(err => {
            //do we need to catch unhandled errors?
            this._catchError(err);

            //handle anything that needs to process before finishing
            //these functions should have guards preventing them being called multiple times per request
            return this._processSteps(false, [
                () => this._processValidState(),
                () => this._processSpecialActions(),

                //success
                //different order, form first as page might rely on something form provides!
                () => this._failSelf(),
                () => !this._request._page?Promise.resolve():this._request._page._fail(),//calls page._fooSelf then page._fooChildren
                () => this._failChildren(),
            ])
            .then(() => this._runFinish(false));
        });
    }

    _runLoad() {
        //if looking for where load handlers are called, see _buildFormLoadHandlers
        this._request._loading = true;
        return this._request._load()
        .then(() => {
            this._request._loading = false;
            this._request._started = true;
        })
        .catch(err => {
            //failed to load, this causes a reset so there is no point capturing the error
            this._runReset();

            //pass on the error anyway..lol
            return Promise.reject(err);
        });
    }

    _runSave() {
        //store any input values set to input.keep() dont need to store any values if this is not a submit!
        if (!this._request._runReset && this._request._submit) {
            //store current values in the request!
            this._request._setCurrentStore(this._buildValues({}));
        }

        //save the request
        return this._request._save();
    }

    _runReset() {
        //flag reset
        this._request._halt = true;//must halt otherwise submit handlers could fire after
        this._request._reset = true;
        this._request._reload = true;

        const page = this._findFirstPage();
        this._request._destination = page ? page._destination : null;
    }

    _runRerun() {
        //flag reset
        //dont halt, we still want everything else to fire!
        this._request._reset = true;
        this._request._reload = true;

        const page = this._findFirstPage();
        this._request._destination = page ? page._destination : null;
    }

    _runNext() {
        const page = this._findNextPage();

        this._request._next = true;
        this._request._reload = true;
        this._request._special = true;
        this._request._destination = page ? page._destination : null;
        this._request._future = page ? page._name : null;
    }

    _runPrev(keepErrors) {
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

    _runFinish(success) {
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
                        this._runPrev(true);
                    }
                }
            }

            //shutdown (and save, always, as there was an error) the form
            return this._runShutdown(true)
            .then(() => FormeResult.createWithPromise(this));
        } else {
            //success
            if (!this._request._runPrev && this._request._submit) {
                //a good submit!
                this._request._completePage(this._request._page);
                this._request._invalidateAfterPage(this._request._page);
            }

            //always save
            return this._runShutdown(true)
            .then(() => FormeResult.createWithPromise(this))
            .then(result => {
                if (this._request._finished) {
                    this._driver.clear(this._request._token);
                }

                return result;
            });
        }
    }

    _runShutdown(save) {
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
            return this._runSave()
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
            //request
            (view, submit, values) => this._buildRequest(view, submit, values),

            //load
            (view, submit, values) => this._buildLoadHandlers(view, submit, values),
            (view, submit, values) => !this._request._page?Promise.resolve():this._request._page._buildLoadHandlers(view, submit, values),//page load handlers

            //build
            (view, submit, values) => this._buildBuildHandlers(view, submit, values),
            (view, submit, values) => !this._request._page?Promise.resolve():this._request._page._build(view, submit, values),//page build handlers

            //children
            (view, submit, values) => this._buildChildren(view, submit, values),
            (view, submit, values) => !this._request._page?Promise.resolve():this._request._page._buildChildren(view, submit, values),//page children

            //finalise
            (view, submit, values) => this._buildRead(view, submit, values),
        ]);
    }

    _buildSteps(view, submit, values, steps) {
        //finished building
        this._request._building = true;

        //remove empty steps (this allows us to do clean conditional compiling
        steps = steps.filter(step => !!step);

        //process steps in order
        let error = null;
        return steps.reduce((prev, curr) => {
            //skip steps if there has been an error
            return prev.then(() => !error?curr.call(this, view, submit, values):Promise.resolve())
            .catch(err => error = err || this._createError('unspecified error'));
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
            return Promise.reject(err);
        })
    }

    _buildRequest(view, submit, values) {
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

    _buildRead(view, submit, values) {
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

    //private build values methods
    _buildValuesInclude(options) {
        //form always included!
        return true;
    }

    _buildValueGroups(options, parent) {
        //form has no groups!
        return parent;
    }

    //private build tempalte methods
    _buildTemplateStructure(options, parent) {
        return new Promise((resolve, reject) => {
            //form adds to root (parent) because it is not a child of
            const vars = this._buildTemplateVars(options);

            //how to update parent?
            if (parent) {
                //we passed in the parent container so we have ot merge with it! (just use object assign)
                return resolve(Object.assign(parent, vars));
            } else {
                //no parent, so we are creating the root object here!
                return resolve(vars);
            }
        });
    }

    _buildTemplateVars(options) {
        return Object.assign(super._buildTemplateVars(options), {
            method: this._method,
            action: this._makeAction(),
            first: this._request._formFirst && this._request._pageFirst,//both must be first!
            errors: this._request._fetchFormErrors(),
        });
    }

    //private process methods
    _processSteps(halt, steps) {
        let error = null;

        //filter empty steps
        steps = steps.filter(step => !!step);

        //execute
        return steps.reduce((prev, curr) => {
            //skip if there has been an error caught!
            return prev.then(() => (halt && this._request._halt) || error !== null? Promise.resolve() : curr.call(this));
        }, Promise.resolve())
        .then(() => {
            //convert success into error
            if (error) {
                return Promise.reject(error);
            }
        });
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

                        if ((this._request._runView && !this._request._hasCompletedPage(page)) || (this._request._submit && !this._request._hasVisitedPage(page))) {
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
                return Promise.reject(this._createError('invalid form journey'));
            } else {
                //epic fail!
                this._runReset();
                return Promise.reject(this._createError('invalid form journey'));
            }
        }
    }

    _processValidationErrors() {
        //any errors?
        return this._request._hasError() ? Promise.reject(null) : Promise.resolve();
    }

    _processValidState() {
        this._request._valid = this._request._error === false;
        return Promise.resolve();
    }

    _processActionTriggers() {
        //trigger special actions directly from input values. These values start with forme:
        for (let input of this._inputs) {
            if (input._actionTriggers !== null) {
                const inputValue = this._request._values[input._name];
                for (let action of input._actionTriggers) {
                    //trigger with matching value
                    //dont trigger special actions
                    if (!action.special && ((action.value === null && inputValue !== undefined) || action.value === inputValue)) {
                        this._request._actions.push({
                            action: action.action,
                            context: action.context,
                        });
                    }
                }
            }
        }
    }

    _processSpecialActions() {
        //get any actions that inputs may have triggered
        if (this._request._processSpecialActions) {
            this._request._processSpecialActions = false;

            for (let input of this._inputs) {
                if (input._actionTriggers !== null) {
                    const inputValue = this._request._values[input._name];

                    for (let action of input._actionTriggers) {
                        if (action.special) {
                            //we dont trigger these actions when form._request._special has already been set (could be from manual .next(), .prev() etc)
                            switch (action.action) {
                                case constants.actions.prev:
                                    //previous page, we are ok to skip invalid submit as user will have to come back through this page to complete the form
                                    if (inputValue !== null && this._pages !== null && !this._request._special) {
                                        this._runPrev(false);
                                    }
                                    break;

                                case constants.actions.next:
                                    if (inputValue !== null && !this._request._special) {
                                        if (!this._request._valid) {
                                            //cant next when invalid, but we still have to reload otherwise it will be treated as submit
                                            this._request._reload = true;
                                        } else {
                                            this._runNext();
                                        }
                                    }
                                    break;

                                case constants.actions.reset:
                                    //reset the form
                                    if (inputValue !== null && !this._request._special) {
                                        this._request._special = true;
                                        this._runReset();
                                    }
                                    break;

                                case constants.actions.rerun:
                                    //flag the form for rerun! (only if form valid)
                                    if (inputValue !== null && !this._request._special && this._request._valid) {
                                        this._request._special = true;
                                        this._runRerun();
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

    //private execute methods
    _execute() {
        //dont call children
        return this._executeSelf();
    }

    //private invalid methods
    _invalid() {
        //dont call children
        return this._invalidSelf();
    }

    //private valid methods
    _valid() {
        //dont call children
        return this._validSelf();
    }

    //private success methods
    _success() {
        //dont call children
        return this._successSelf();
    }

    //private fail methods
    _fail() {
        //dont call children
        return this._failSelf();
    }

    //private submit methods
    _submit() {
        //dont call children
        return this._submitSelf();
    }

    //private done methods
    _done() {
        //dont call children
        return this._doneSelf();
    }

    //private execute handler methods
    _executeLoadHandler(handler) {
        return handler.call(this, this);
    }

    _executeBuildHandler(handler) {
        return handler.call(this, this);
    }

    _executeComposeHandler(handler, component, details) {
        return handler.call(this, this, component, details);
    }

    _executeValidateHandler(handler, state) {
        return handler.call(this, this, state);
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

    //private pipe methods
    _pipeLostError(error) {
        //fallback when piping fails!
        this._request._addError(null, error);
    }
    
    //private add methods
    _addInput(input) {
        this._inputs.push(input);
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
        const store = this._request._getCurrentStore();
        return store?store.values[valueName]:undefined;//might be undefined
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

    //private create methods
    _createPage(name) {
        //get the details when passed in
        let configure = null;
        if (name && typeof name === 'object') {
            //passed as configure object, copy it so we dont kill the passed in data
            configure = Object.assign({}, name);
            name = configure.name || undefined;

            //cleanup some keys
            delete configure.name;
        }

        //auto generate name
        name = name || '__forme_page__' + (this._pages && this._pages.length || 0);

        //validate
        if (!name || typeof name !== 'string') {
            throw this._createError(`invalid forme page name '${name}'`);
        }

        if (this._findPage(name)) {
            throw new Error(`duplicate forme page name '${name}'`);
        }

        //add and configure
        const page = new this._form._driverClass.pageClass(this._form, name);

        //setup links
        page._form = this;

        //initial configure
        return page.configure(configure);
    }

    _createError(message) {
        return new FormeFormError(message);
    }

    _createGroup() {
        return {
            __formeClass: 'group',
            children: {},
        }
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
    _addPageContainer(page) {
        //setup page links
        page._form = this;

        //add
        this._pageAllowed = true;
        this._pages = this._pages || [];
        this._pages.push(page);

        //chain
        return page;
    }

    _addExternalPage(path) {
        //setup page links
        const page = new FormePageLocation(path);
        page._form = this;

        //add
        this._pageAllowed = false;
        this._pages = this._pages || [];
        this._pages.push(page);

        //chain
        return page;
    }

    //private fetch methods
    _fetchErrors() {
        return this._request._fetchErrors();
    }

    //private make methods
    _makeIdentifier() {
        //this is important as it allows our form to be uniquely identified in all (most) situations
        //the identifier is primarily used to store information unique to 1 step of a form
        if (this._identifier !== null) {
            //user set
            return '__forme_identifier_override__' + this._identifier;
        } else {
            if (this._request._page !== null) {
                //easy can just use page name as it is unique within the form
                return '__forme_identifier_page__' + this._request._current;
            } else {
                //we still might be paging, but between different forms
                //if the users form has the same name, then we might end up overwriting values stored for that page
                //need to generate a unique identifier based on details that are known
                return '__forme_identifier_auto__' + this._name + '__' + utils.url.path(this._driver.url());
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
        return utils.url.addQuery(this._formAction, query, false);
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
    _getNamedValue(inputName, unsafe) {
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
            //ok that seemingly simple operation took a sh1t3 ton of refactoring :D
            const value = this._readValue(inputName, this._request._pageFirst, this._request._submit, false, true, input?input._permanentValue:null, input?input._overrideValue:null, null, null);
            return input._getProcessedValue(value);
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
        //catch errors
        if (err && err.message.length && !(err instanceof FormeValidationError)) {
            if (constants.dev) {
                //development mode
                //to console
                console.error(err);

                //to container
                this.error('[development] '+err.toString());
            } else {
                //production
                this.error(this._createError('Unhandled Error'));
            }
        }

        //chain it
        return err;
    }

    //configuration methods
    driver(driverClass) {
        if (this.callingConfigureMethod('driver')) {
            this._driverClass = driverClass || defaultDriverClass;

            //chain
            return this;
        }
    }

    page(pages) {
        //todo: currently can only add pages in unstarted form!
        if (this.callingInactiveMethod('page')) {
            //add page container object
            if (this._pageAllowed === false) {
                throw new Error('cant combine page types on the same form');
            } else {
                if (Array.isArray(pages)) {
                    //multiple
                    return pages.map(page => this._addPageContainer(this._createPage(page)));
                } else {
                    //single
                    return this._addPageContainer(this._createPage(pages));
                }
            }
        }
    }

    pages() {
        //shortcut
        return this.page(...arguments);
    }

    externalPage(locations) {
        if (this.callingConfigureMethod('externalPage')) {
            //add page location
            if (this._pageAllowed === true) {
                throw new Error('cant combine page types on the same form');
            } else {
                if (Array.isArray(locations)) {
                    for (let location of locations) {
                        this._addExternalPage(location);
                    }
                } else {
                    this._addExternalPage(locations);
                }

                //chain
                return this;
            }
        }
    }

    externalPages() {
        //shortcut
        return this.externalPage(...arguments);
    }

    method(method, action) {
        if (method) {
            switch (method.toLowerCase()) {
                case 'get':
                    return this.get(action);
                case 'post':
                    return this.post(action);
            }
        }

        throw this._createError(`unsupported method '${method}'`);
    }

    post(action) {
        if (this.callingConfigureMethod('post')) {
            this._method = 'POST';
            this._formAction = action || '';

            //chain
            return this;
        }
    }

    get(action) {
        if (this.callingConfigureMethod('get')) {
            this._method = 'GET';
            this._formAction = action || '';

            //chain
            return this;
        }
    }

    unrequire(unrequire) {
        //useful for debugging
        if (this.callingConfigureMethod('unrequire')) {
            //all values are unrequired
            this._unrequire = unrequire;

            //chain
            return this;
        }
    }

    //commands
    view(storage, values=null) {
        if (this.callingOperationMethod('view')) {
            //wrap it in clone of form
            return this._runWrap(storage)

            //now view the form!
            .then(form => form._runView(values));
        }
    }

    execute(storage, values=null) {
        if (this.callingOperationMethod('execute')) {
            //wrap it in clone of form
            return this._runWrap(storage)
            .then(form => form._runSubmit(true, values));
        }
    }

    save() {
        if (this.callingActiveMethod('save')) {
            return this._runSave()
            .then(() => FormeResult.createWithPromise(this));
        }
    }

    prev() {
        //trigger special action manually
        if (this.callingActiveMethod('prev')) {
            if (this._pages !== null) {
                this._runPrev(false);

                //do we need to save the form?
                if (!this._request._finished) {
                    //this is from a callback so we dont have to do anything
                    return Promise.resolve(false);
                } else {
                    //called after form has finished so have to do manual stuff!
                    return this._runSave()
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
        if (this.callingActiveMethod('next')) {
            //must be valid otherwise we can break validation
            if (this._request._valid) {
                this._runNext();

                //do we need to save the form?
                if (!this._request._finished) {
                    //this is from a callback so we dont have to do anything
                    return Promise.resolve(false);
                } else {
                    //called after form has finished so have to do manual stuff!
                    return this._runSave()
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
        if (this.callingActiveMethod('reset')) {
            this._request._special = true;
            this._runReset();

            //do we need to save the form?
            if (!this._request._finished) {
                //this is from a callback so we dont have to do anything
                return Promise.resolve(false);
            } else {
                //called after form has finished so have to do manual stuff!
                return this._runSave()
                .then(() => {
                    //chain with destination so we user manually redirect
                    return this._makeDestination();
                });
            }
        }
    }

    rerun() {
        //trigger special action manually
        if (this.callingActiveMethod('rerun')) {
            if (this._request._valid) {
                this._request._special = true;
                this._runRerun();

                //do we need to save the form?
                if (!this._request._finished) {
                    //this is from a callback so we dont have to do anything
                    return Promise.resolve(false);
                } else {
                    //called after form has finished so have to do manual stuff!
                    return this._runSave()
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
        if (this.callingActiveMethod('reload')) {
            this._reload = true;
            this._reloadOverride = destination;
        }
    }

    //templating methods
    inputClassName(classNames) {
        if (this.callingConfigureMethod('inputClassName')) {
            if (classNames === undefined) {
                //clear
                this._inputClassNames = [];
            } else {
                //add
                if (Array.isArray(classNames)) {
                    for(let className of classNames) {
                        if (typeof className === 'string') {
                            this._inputClassNames = this._inputClassNames.concat(className.split(' '));
                        }
                    }
                } else {
                    if (typeof classNames === 'string') {
                        this._inputClassNames = this._inputClassNames.concat(classNames.split(' '));
                    }
                }
            }

            //chain
            return this;
        }
    }

    buttonClassName(classNames) {
        if (this.callingConfigureMethod('buttonClassName')) {
            if (classNames === undefined) {
                //clear
                this._buttonClassNames = [];
            } else {
                //add
                if (Array.isArray(classNames)) {
                    for(let className of classNames) {
                        if (typeof className === 'string') {
                            this._buttonClassNames = this._buttonClassNames.concat(className.split(' '));
                        }
                    }
                } else {
                    if (typeof classNames === 'string') {
                        this._buttonClassNames = this._buttonClassNames.concat(classNames.split(' '));
                    }
                }
            }

            //chain
            return this;
        }
    }

    errorClassName(classNames) {
        if (this.callingConfigureMethod('errorClassName')) {
            if (classNames === undefined) {
                //clear
                this._errorClassNames = [];
            } else {
                //add
                if (Array.isArray(classNames)) {
                    for(let className of classNames) {
                        if (typeof className === 'string') {
                            this._errorClassNames = this._errorClassNames.concat(className.split(' '));
                        }
                    }
                } else {
                    if (typeof classNames === 'string') {
                        this._errorClassNames = this._errorClassNames.concat(classNames.split(' '));
                    }
                }
            }

            //chain
            return this;
        }
    }

    requiredClassName(classNames) {
        if (this.callingConfigureMethod('requiredClassName')) {
            if (classNames === undefined) {
                //clear
                this._requiredClassNames = [];
            } else {
                //add
                if (Array.isArray(classNames)) {
                    for(let className of classNames) {
                        if (typeof className === 'string') {
                            this._requiredClassNames = this._requiredClassNames.concat(className.split(' '));
                        }
                    }
                } else {
                    if (typeof classNames === 'string') {
                        this._requiredClassNames = this._requiredClassNames.concat(classNames.split(' '));
                    }
                }
            }

            //chain
            return this;
        }
    }

    //state
    storage() {
        //gets the storage that was given to the form
        if (this.callingActiveMethod('storage')) {
            return this._driver._storage;
        }
    }

    errors() {
        if (this.callingActiveMethod('errors')) {
            if (arguments.length === 0) {
                //all errors
                return this._fetchErrors();
            } else {
                //filter by name
                return this._fetchErrors().filter(error => error.name === arguments[0]);
            }
        }
    }

    getValue(path, unsafe) {
        if (this.callingActiveMethod('getValue')) {
            return this._getNamedValue(input, !!unsafe);
        }
    }

    setValue(input, value) {
        if (this.callingActiveMethod('setValue')) {
            this._setInputNameValue(input, value);

            //chain
            return this;
        }
    }

    values() {
        if (this.callingActiveMethod('values')) {
            return this._buildValues({
                alias: true,
                group: true,
                store: true,
                ignore: true,
            });
        }
    }

    raw(input) {
        if (this.callingActiveMethod('raw')) {
            //find input
            input = this._findInput(input);
            if (input === null) {
                return null;
            }

            //return the value
            return this._request._raw[input._name];
        }
    }

    url(page) {
        //get the url for a particular page
        if (this.callingActiveMethod('url')) {
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
        if (this.callingActiveMethod('visitedPage')) {
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
        if (this.callingActiveMethod('completedPage')) {
            if (!this._hasPages() || !page) {
                return false;
            } else {
                //check it!
                return this._request._hasCompletedPage(this._findPage(page));
            }
        }
    }
}

//expose module
module.exports = function(details) {
    //noinspection Annotator
    return new defaultDriverClass.formClass(details);
};

module.exports.Forme = Forme;
module.exports.FormePage = FormePage;
module.exports.FormeComponent = FormeComponent;
module.exports.FormeInput = FormeInput;
module.exports.FormeDriver = FormeDriver;

module.exports.FormeError = FormeError;
module.exports.FormeDriverError = FormeDriverError;
module.exports.FormeConfigurationError = FormeConfigurationError;
module.exports.FormeContextError = FormeContextError;
module.exports.FormeFormError = FormeFormError;
module.exports.FormePageError = FormePageError;
module.exports.FormeInputError = FormeInputError;
module.exports.FormeComponentError = FormeComponentError;
module.exports.FormeValidationError = FormeValidationError;

module.exports.FormeConfigurableMethod = FormeConfigurableMethod;
module.exports.FormeConfigurableMethodPointer = FormeConfigurableMethodPointer;

module.exports.FormeConfigurableOverride = FormeConfigurableOverride;
module.exports.FormeConfigurableParam = FormeConfigurableParam;
module.exports.FormeConfigurableBool = FormeConfigurableBool;
module.exports.FormeConfigurableBoolOrNull = FormeConfigurableBoolOrNull;
module.exports.FormeConfigurableInt = FormeConfigurableInt;
module.exports.FormeConfigurableFloat = FormeConfigurableFloat;
module.exports.FormeConfigurableString = FormeConfigurableString;
module.exports.FormeConfigurableStringOrNull = FormeConfigurableStringOrNull;
module.exports.FormeConfigurableObject = FormeConfigurableObject;
module.exports.FormeConfigurableArray = FormeConfigurableArray;
module.exports.FormeConfigurableCallback = FormeConfigurableCallback;
module.exports.FormeConfigurableCallbacks = FormeConfigurableCallbacks;
module.exports.FormeConfigurableStrings = FormeConfigurableStrings;

module.exports.FormeConfigurableExportProperty = FormeConfigurableExportProperty;
module.exports.FormeConfigurableExportPointer = FormeConfigurableExportPointer;

module.exports.FormeConfigurableExportParam = FormeConfigurableExportParam;
module.exports.FormeConfigurableExportNot = FormeConfigurableExportNot;
module.exports.FormeConfigurableExportBool = FormeConfigurableExportBool;
module.exports.FormeConfigurableExportBoolOrNull = FormeConfigurableExportBoolOrNull;
module.exports.FormeConfigurableExportString = FormeConfigurableExportString;
module.exports.FormeConfigurableExportStringOrNull = FormeConfigurableExportStringOrNull;
module.exports.FormeConfigurableExportObject = FormeConfigurableExportObject;
module.exports.FormeConfigurableExportArray = FormeConfigurableExportArray;
module.exports.FormeConfigurableExportCallback = FormeConfigurableExportCallback;
module.exports.FormeConfigurableExportCallbacks = FormeConfigurableExportCallbacks;

module.exports.FormeConfigurableExportArrayStrings = FormeConfigurableExportArrayStrings;
module.exports.FormeConfigurableExportArrayObjects = FormeConfigurableExportArrayObjects;
module.exports.FormeConfigurableExportArrayObjectsAssign = FormeConfigurableExportArrayObjectsAssign;

module.exports.FormeConfigurableExportExecuteHandler = FormeConfigurableExportExecuteHandler;
module.exports.FormeConfigurableExportProcessHandler = FormeConfigurableExportProcessHandler;
module.exports.FormeConfigurableExportValidateHandler = FormeConfigurableExportValidateHandler;
module.exports.FormeConfigurableExportValidateHandlers = FormeConfigurableExportValidateHandlers;
module.exports.FormeConfigurableExportInputActions = FormeConfigurableExportInputActions;
module.exports.FormeConfigurableExportInputSpecialAction = FormeConfigurableExportInputSpecialAction;

module.exports.FormeConfigurableExportConditionalString = FormeConfigurableExportConditionalString;

//utility functions
module.exports.driver = function(driver) {
    defaultDriverClass = driver;
};

module.exports.sessions = function(timeout, prune) {
    sessionTimeout = timeout;
    sessionPrune = prune;
};