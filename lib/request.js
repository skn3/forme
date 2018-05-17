'use strict';

//local imports
const utils = require('./utils');

//functions
function getPageName(page) {
    if (typeof page === 'string') {
        return page;
    } else if (page && typeof page === 'object') {
        return page._name;
    } else {
        return null;
    }
}

//class
class FormeRequest {
    constructor(form, submit) {
        this._form = form;

        this._token = null;
        this._tokenCreated = false;
        this._identifier = null;
        this._page = null;
        this._currentPageName = null;//current page
        this._futurePageName = null;//future page name
        this._destination = null;

        this._clean = true;//has the form submitted at least once?
        this._started = false;
        this._loading = false;
        this._submit = submit;//false = view , true = ...submit!
        this._saved = false;
        this._reset = false;
        this._prev = false;
        this._next = false;
        this._halt = false;
        this._error = false;//has there been an error this request?
        this._finished = false;
        this._formFirst = true;
        this._pageFirst = true;
        this._pageImported = false;
        this._pageExternal = false;
        this._valid = true;
        this._reload = false;
        this._reloadOverride = null;
        this._building = false;
        this._special = false;

        this._descendantInvalidCount = {};

        this._processSpecialActions = true;

        this._raw = {};
        this._values = {};
        this._errors = [];
        this._lastErrors = [];
        this._actions = [];

        this._store = {
            identifiers: [],//values per "page"
            visited: {},//pages visited
            completed: {},//pages completed
        };
        this._currentStoreIdentifier = null;
        this._currentStore = null;
    };

    //public (driver) properties
    get form() {
        return this._form;
    }

    get page() {
        return this._page;
    }

    //private command methods
    _load() {
        if (this._form._currentDriver) {
            //timeout old sessions
            return this._form._currentDriver.timeout()

            //validate or create token
            .then(() => this._getTokenInfo())
            .then(info => {
                this._token = info.token;
                this._tokenCreated = info.created;

                //load the data
                if (this._tokenCreated) {
                    //dont bother loading as this is a newly created token
                    return null;
                } else {
                    //attempt to load data
                    return this._form._currentDriver.load(this._token);
                }
            })

            //process loaded data
            .then(data => {
                //copy data from session into the request
                if (data !== null) {
                    //make sure to create new copies of objects (+arrays), because we dont want anything to delete/alter them outside of our control!
                    this._lastErrors = data.errors.slice();
                    this._formFirst = data.first;
                    this._store = utils.clone.deep(data.store);
                    this._raw = utils.clone.deep(data.raw);
                    this._values = utils.clone.deep(data.values);

                    //set the page to the one stored in the session (this may get overwritten when form form builds the request)
                    //remember that when the request calls ._save() it actually saves the "future" page that was in the request as the current request.
                    //what this means is that now we are calling _load() we know that the page stored in session should be the page we are loading hte request for.
                    //with this in mind we understand that we can check to see if the current page (beit by reading the url or the querystring) differs, and then act accordingly.
                    //this might come in useful say if we are hot linking to a particular form page without submitting!
                    let sessionPageName = data.page || null;

                    //how are we expecting the page to arrive?
                    let newSessionPageName = sessionPageName;
                    if (this._form._pages) {
                        if (data.pageExternal) {
                            //page is external so we calculate the REAL current page via the url
                            const currentUrl = this._form._currentDriver.url();

                            //do they differ?
                            if (!utils.url.comparePaths(currentUrl, sessionPageName)) {
                                //so it looks like we were expecting one page but we have another! Lets use that one instead!
                                newSessionPageName = utils.url.path(currentUrl);
                            }
                        } else {
                            //page is internal so we calculate the REAL current page via the querystring (or first page if no query string)
                            const currentQueryString = utils.url.extractQuery(this._form._currentDriver.url());
                            let currentQueryPage = currentQueryString[this._form._pageField] || null;

                            if (currentQueryPage === null) {
                                //revert to first page
                                newSessionPageName = this._form._pages[0]._name;

                            } else if (currentQueryPage !== sessionPageName) {
                                newSessionPageName = currentQueryPage;
                            }
                        }
                    }

                    //so it looks like we were expecting one page but we have another! Lets use that one instead!
                    let sessionPageChanging = false;
                    if (newSessionPageName !== sessionPageName) {
                        sessionPageName = newSessionPageName;
                        sessionPageChanging = true;
                    }

                    //set the page
                    this._setPage(this._form._findPage(sessionPageName));

                    //should we load values from the store early? (this comes in useful when grabbing values early in the form lifecycle)
                    if (sessionPageChanging || !this._submit) {
                        //no raw because there was no submit (well there should not be in this scenario!)
                        this._raw = {};

                        //lets get the values!
                        const store = this._findStore(this._form._makeIdentifier());//_makeIdentifier relies on the details set during _setPage()

                        if (sessionPageChanging) {
                            //session page is "changing (read above) so we are very strict in only using these exact values. We dont want potential values from the last page leaking onto the next!
                            if (store) {
                                this._values = store.values;
                            } else {
                                this._values = {};
                            }
                        } else {
                            //session page is as expected so we should merge together!
                            if (store) {
                                this._values = utils.merge.allowOverwriteWithNull({}, store.values, this._values);
                            }
                        }
                    }
                }
            })

            //prune excess sessions
            .then(() => this._form._currentDriver.prune(this._form._sessionPrune))//prevent spamming of form sessions to fill up the driver session storage

            //clear the saved after loading, as its now plumbed into the request (as we handle all errors, we can save the data at the end)
            .then(() => this._form._currentDriver.clear(this._token))

            //clean promise chain
            .then(() => true)
        } else {
            //we don't have a session handler so do the best we can
            return Promise.resolve(false);
        }
    }

    _save() {
        if (this._form._currentDriver) {
            if (this._reset) {
                //reset
                this._token = null;
                this._identifier = null;
                this._page = null;
                this._pageFirst = true;
                this._pageExternal = false;
                this._currentPageName = null;
                this._futurePageName = null;
                this._saved = false;
                this._raw = {};
                this._values = {};
                this._actions = [];
                this._store = null;

                //we need to handle errors that still might need to be captured. Transfer all errors into the lastErrors, as this does not save in the session!
                this._lastErrors = [].concat(this._lastErrors, this._errors);

                //now make sure to reset "current" errors
                this._errors = [];

                //finish
                return Promise.resolve(false);
            } else {
                //save
                this._saved = true;

                //let the driver save
                return this._form._currentDriver.save(this._token, {
                    //these values are not to be confused with the values stored per identifier (per page). These values are for the immediate page/form in question
                    //with that in mind we should never apply the {discard: true} option (the one that handles element.keep()) to the _buildValues call.

                    raw: this._form._buildValues({//should save a flat list (ungrouped)
                        secure: true,//always secure as this could be saved to the users database/session
                        raw: true,
                        special: true,
                    }),

                    values: this._form._buildValues({//should save a flat list (ungrouped)
                        secure: true,//always secure as this could be saved to the users database/session
                        special: true,
                    }),

                    errors: this._errors,
                    clean: this._clean,
                    first: this._formFirst,
                    page: this._futurePageName,
                    pageExternal: this._pageExternal,//because forms cant mix internal and external pages, we can assume that the future page will share the same external setting as the current!
                    store: this._store,
                    timeout: Date.now()+(this._form._sessionTimeout),//save timeout, its upto the driver to manage this
                })
                .then(() => true);
            }
        } else {
            //no session
            return Promise.resolve(false);
        }
    }

    _visitPage(page) {
        const pageName = getPageName(page);

        if (this._submit) {
            this._formFirst = false;
        }

        //flag page (if there is one) as visited
        if (pageName && this._started && this._valid && this._page !== null) {
            this._store.visited[pageName] = true;
        }
    }

    _completePage(page) {
        const pageName = getPageName(page);

        if (pageName && this._submit && this._started && this._valid && this._page !== null) {
            this._store.visited[pageName] = true;
            this._store.completed[pageName] = true;
        }
    }

    _invalidatePagesAfter(page) {
        const pageName = getPageName(page);

        if (pageName && this._submit && this._started && this._valid && this._page !== null) {
            //find the specified page
            let found = false;
            for (let index = 0; index < this._form._pages.length;index++) {
                const page = this._form._pages[index];
                if (!found) {
                    //not found yet so keep scanning
                    if (page._name === pageName) {
                        found = true;
                    }
                } else {
                    //ok we found on previous step, so this page counts as being "after", so we should invalidate!
                    delete this._store.visited[page._name];//need to unvisit the page because the previous page may have changed the structure of the next!
                    delete this._store.completed[page._name];
                }
            }
        }
    }

    //private find methods
    _findStore(identifier) {
        return this._store !== null && this._store.identifiers.find(store => store.identifier === identifier) || null;
    }

    //private flag methods (these provide a central place for setting various running states todo: we should really convert this into a state machine ;_;)
    _flagHalt() {
        this._halt = true;
    }

    _flagStarted() {
        this._started = true;
    }

    _flagLoading() {
        this._loading = true;
    }

    _flagFinishedLoading() {
        this._loading = false;
    }

    _flagFailedLoading() {
        this._loading = false;
    }

    _flagBuilding() {
        this._building = true;
    }

    _flagFinishedBuilding() {
        this._building = false;
    }

    _flagFailedBuilding() {
        this._building = false;
    }

    _flagReload() {
        this._reload = true;
    }

    _flagNoReload() {
        this._reload = false;
    }

    _flagSpecial() {
        this._special = true;
    }

    _flagReset() {
        this._reset = true;
    }

    _flagNext() {
        this._next = true;
    }

    _flagPrev() {
        this._prev = true;
    }

    _flagInvalid() {
        this._valid = false;
    }

    _flagError() {
        this._error = true;
    }

    _flagFailedValidation() {
        this._flagError();
    }

    _flagFinished() {
        this._finished = true;
    }

    _flagUnfinished() {
        this._finished = false;
    }

    _flagInvalidElementDescendant(path) {
        if (!this._descendantInvalidCount.hasOwnProperty(path)) {
            this._descendantInvalidCount[path] = 1;
        } else {
            this._descendantInvalidCount[path]++;
        }
    }

    _flagPageImported() {
        this._pageImported = true;
    }

    _flagPageFirst() {
        this._pageFirst = true;
    }

    _flagPageRevisit() {
        this._pageFirst = false;
    }

    //private add methods
    _addError(error, formeClass, path, name, sourceClass, sourcePath, sourceName) {
        //eat the error
        this._errors.push({
            error: error,
            class: formeClass,
            name: name,
            path: path,
            source: {
                class: sourceClass,
                path: sourcePath,
                name: sourceName,
            }
        });

        //flag that this request has had an error
        this._flagError();
    }

    //private has methods
    _hasErrorWithSourcePath(path) {
        return this._lastErrors.findIndex(error => error.source.path === path) !== -1 || this._errors.findIndex(error => error.source.path === path) !== -1;
    }

    _hasInvalidDescendant(path) {
        const count = this._descendantInvalidCount[path];
        return count !== undefined && count > 0;
    }

    _hasError() {
        return this._error || this._errors.length > 0;
    }

    _hasNamedValue(name) {
        return this._values && this._values.hasOwnProperty(name);
    }

    _hasCompletedPage(page) {
        const pageName = getPageName(page);
        return pageName && this._page !== null && this._store.completed[pageName];
    }

    _hasVisitedPage(page) {
        const pageName = getPageName(page);
        return (this._page === null && !this._formFirst) || (pageName && this._page && this._store.visited[pageName]) || false;
    }

    _hasVisitedCurrentPage() {
        return this._hasVisitedPage(this._currentPageName);
    }

    _hasCompletedCurrentPage() {
        return this._hasCompletedPage(this._currentPageName);
    }

    _hasValidPageState(page) {
        return (!this._submit && this._hasCompletedPage(page)) || (this._submit && this._hasVisitedPage(page));
    }

    //private get methods
    _getCurrentStore() {
        //this is cached to avoid wasted cycles checking the identifiers!
        if (this._identifier !== null && this._store !== null) {
            //check if cached pointer has been invalidated
            if (this._identifier !== this._currentStoreIdentifier) {
                this._currentStoreIdentifier = this._identifier;
                this._currentStore = this._store.identifiers.find(store => store.identifier === this._identifier) || null;
            }

            //return easy quickness!
            return this._currentStore;
        }
        return null;
    }

    _getCurrentErrors() {
        if (!this._submit) {
            //include current errors as well as last errors
            //this is because we might have generated an error while building/loading/etc a form when in view mode
            return this._lastErrors.slice().concat(this._errors);
        } else {
            return this._errors.slice();
        }
    }

    _getOrphanedErrors() {
        //gets all erros that dont currently have an owner!
        return this._getCurrentErrors().filter(error => error.path === null);
    }

    _getNamedErrors(name) {
        return this._getCurrentErrors().filter(error => error.name === name);
    }

    _getErrorsWithPath(path) {
        return this._getCurrentErrors().filter(error => error.path === path);
    }

    _getTokenInfo() {
        return new Promise((resolve, reject) => {
            let token = this._form._currentDriver.request(this._form.tokenName, undefined);

            //make sure its valid
            if (token !== undefined) {
                if (token.length !== this._form._sessionTokenSize || !/^[a-z0-9]+$/i.test(token)) {
                    reject(this._form._createError('invalid form token'));
                } else {
                    //found old token (and its valid)
                    resolve({
                        created: false,
                        token: token,
                    });
                }
            } else {
                //no token, or it was invalid so generate new
                return utils.string.token(this._form._sessionTokenSize, (err) => this._form._createError(err))
                .then(token => resolve({
                    created: true,
                    token: token,
                }))
                .catch(err => reject(err));
            }
        });
    }

    _getStoreValue(name, defaultValue=undefined) {
        const store = this._getCurrentStore();
        if (store) {
            if (store.values.hasOwnProperty(name)) {
                return store.values[name];
            }
        }
        return defaultValue;
    }

    _getElementStoreValue(path, defaultValue=undefined) {
        const store = this._getCurrentStore();
        if (store) {
            return utils.object.find.path(store.structure, path, defaultValue);
        }
        return defaultValue;
    }

    _getNamedValue(name, defaultValue=undefined, unsafe=false) {
        if (this._values.hasOwnProperty(name)) {
            return this._values[name];
        } else {
            if (unsafe) {
                //unsafe mode can read directly from the driver!
                return this._form._currentDriver.request(name, defaultValue);
            } else {
                //safe mode can only return the default value!
                return defaultValue;
            }
        }
    }

    _getMergedElementStoreValues(values, current=true) {
        //create complete set of values from store.structure for all identifiers (but not current if flagged to not include)
        if (!values) {
            values = {};
        } else {
            values = Object.assign({}, values);
        }

        //merge all together!
        if (this._store) {
            //todo: can we improve the performance of this?
            for(let identifier of this._store.identifiers) {
                if (current || !this._identifier || identifier.identifier !== this._identifier) {
                    utils.merge.dontOverwriteWithNull(values, identifier.structure);
                }
            }
        }

        //nothing, soz
        return values;
    }

    _getRawValue(name, defaultValue=undefined) {
        if (this._raw.hasOwnProperty(name)) {
            return this._raw[name];
        }
        return defaultValue;
    }

    //private set methods
    _setPage(page, ignoreNull) {
        if (!ignoreNull || page !== null) {
            this._page = page;
            this._pageExternal = page? page._external : false;
            this._currentPageName = getPageName(page);
        }
    }

    _setFuturePageName(page) {
        this._futurePageName = getPageName(page);
    }

    _setCurrentStore(values, structure) {
        //we save both the flat list (values) and the grouped/aliased values because we want the flexibility to read values in various different ways in the future!
        if (this._identifier !== null && this._store !== null) {
            //check if the store already exists?
            let store = this._findStore(this._identifier);

            if (!store) {
                //create store
                store = {
                    identifier: this._identifier,
                    values: values,
                    structure: structure,
                };

                //stash it
                this._store.identifiers.push(store);

                //store pointers to it, for quick access in ._getCurrentStore()
                this._currentStoreIdentifier = this._identifier;
                this._currentStore = store;
            } else {
                //already exists, so just overwrite values
                store.values = values;
                store.structure = structure;
            }
        }
    }

    //private clear methods
    _clearErrors() {
        //never clear "last errors"
        this._error = false;
        this._errors = [];
    }
}

//expose
module.exports = FormeRequest;