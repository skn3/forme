'use strict';

//local imports
const utils = require('./utils');

//class
class FormeRequest {
    constructor(form) {
        this._form = form;

        this._token = null;
        this._tokenCreated = false;
        this._identifier = null;
        this._page = null;
        this._current = null;//current page name
        this._future = null;//future page name
        this._destination = null;

        this._clean = true;//has the form submitted at least once?
        this._started = false;
        this._loading = false;
        this._view = false;
        this._submit = false;
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
                    //make sure to create new copies of objects/arrays, because we dont want anything to delete/alter them outside of our control!
                    this._lastErrors = data.errors.slice();
                    this._formFirst = data.first;
                    this._store = Object.assign({}, data.store);
                    this._raw = Object.assign({}, data.raw);
                    this._values = Object.assign({}, data.values);

                    //set the page to the one stored in the session
                    this._setPage(this._form._findPage(data.page));
                }
            })

            //prune excess sessions
            .then(() => this._form._currentDriver.prune(this._form._sessionPrune))//prevent spamming of form sessions to fill up the driver session storage

            //clear the saved after loading, as its now plumbed into the request (as we handle all errors, we can save the data at the end)
            .then(() => this._form._currentDriver.clear(this._token))

            //clean promise chain
            .then(() => true)
            .catch(err => Promise.reject(err));//dont need to catch here like this
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
                this._current = null;
                this._future = null;
                this._saved = false;
                this._pageFirst = true;
                this._raw = {};
                this._values = {};
                this._errors = [];
                this._lastErrors = [];
                this._actions = [];
                this._store = null;

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
                    page: this._future,
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

    _visit(page) {
        const pageName = this._getPageName(page);

        if (this._submit) {
            this._formFirst = false;
        }

        //flag page (if there is one) as visited
        if (pageName && this._started && this._valid && this._page !== null) {
            this._store.visited[pageName] = true;
        }
    }

    _complete(page) {
        const pageName = this._getPageName(page);

        if (pageName && this._submit && this._started && this._valid && this._page !== null) {
            this._store.visited[this._current] = true;
            this._store.completed[this._current] = true;
        }
    }

    _invalidateAfter(page) {
        const pageName = this._getPageName(page);

        if (pageName && this._submit && this._started && this._valid && this._page !== null) {
            let found = false;
            for (let page of this._form._pages) {
                if (!found) {
                    if (page._name === pageName) {
                        //found, so now after this point we unvisit!
                        found = true;
                    }
                } else {
                    //invalidate!
                    delete this._store.visited[page._name];
                    delete this._store.completed[page._name];
                }
            }
        }
    }

    //private find methods
    _findStore(identifier) {
        return this._identifier !== null && this._store !== null && this._store.identifiers.find(store => store.identifier === identifier) || null;
    }

    //private flag methods
    _flagHalt() {
        this._halt = true;
    }

    _flagReload() {
        this._reload = true;
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
        this._error = true;
    }

    //private has methods
    _hasErrorWithSourcePath(path) {
        return this._lastErrors.findIndex(error => error.source.path === path) !== -1 || this._errors.findIndex(error => error.source.path === path) !== -1;
    }

    _hasInvalidDescendant(path) {
        const count = this._descendantInvalidCount[path];
        return count !== undefined && count > 0;
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
        if (this._view) {
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

    _getStoreValue(path, defaultValue=undefined) {
        const store = this._getCurrentStore();
        if (store) {
            return utils.object.find.path(store.values, path, defaultValue);
        }
        return defaultValue;
    }

    _getMergedStoreValues(values, current=true) {
        //create complete set of values from store
        values = values || {};

        //merge all together!
        if (this._store) {
            //todo: can we improve the performance of this?
            for(let identifier of this._store.identifiers) {
                if (current || !this._identifier || identifier.identifier !== this._identifier) {
                    utils.merge(values, identifier.values);
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

    _getValue(name, defaultValue=undefined, unsafe=false) {
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

    _getPageName(page) {
        if (typeof page === 'string') {
            return page;
        } else if (page && typeof page === 'object') {
            return page._name;
        } else {
            return null;
        }
    }

    //private set methods
    _setPage(page, ignoreNull) {
        if (!ignoreNull || page !== null) {
            this._page = page;
            this._current = page ? page._name : null;
        }
    }

    _setCurrentStore(values) {
        if (this._identifier !== null && this._store !== null) {
            //check if the store already exists?
            let store = this._findStore(this._identifier);

            if (!store) {
                //create store
                store = {
                    identifier: this._identifier,
                    values: values,
                };

                //stash it
                this._store.identifiers.push(store);

                //store pointers to it, for quick access in ._getCurrentStore()
                this._currentStoreIdentifier = this._identifier;
                this._currentStore = store;
            } else {
                //already exists, so just overwrite values
                store.values = values;
            }
        }
    }

    //private clear methods
    _clearErrors() {
        //never clear "last errors"
        this._error = false;
        this._errors = [];
    }

    //private had api
    _hasError() {
        return this._error || this._errors.length > 0;
    }

    _hasCompletedPage(page) {
        const pageName = this._getPageName(page);
        return pageName && this._page !== null && this._store.completed[pageName];
    }

    _hasVisitedPage(page) {
        const pageName = this._getPageName(page);
        return (this._page === null && !this._formFirst) || (pageName && this._page && this._store.visited[pageName]);
    }
}

//expose
module.exports = FormeRequest;