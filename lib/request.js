'use strict';

//module imports
const extend = require('extend');

//local imports
const utils = require('./utils');
const FormeError = require('./errors').FormeError;

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
        this._valid = true;
        this._reload = false;
        this._reloadOverride = null;
        this._building = false;
        this._special = false;

        this._processSpecialActions = true;

        this._raw = {};
        this._values = {};
        this._errors = [];
        this._lastErrors = [];
        this._actions = [];
        this._store = {
            identifiers: [],//values per "page"
            visited: {},//pages visited
        };
    };

    //private methods
    _load() {
        if (this._form._driver) {
            //timeout old sessions
            return this._form._driver.timeout()

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
                    return this._form._driver.load(this._token);
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
            .then(() => this._form._driver.prune(this._form._sessionPrune))//prevent spamming of form sessions

            //clear the saved after loading, as its now plumbed into the request (as we handle all errors, we can save the data at the end)
            .then(() => this._form._driver.clear(this._token))

            //clean promise chain
            .then(() => true)
            .catch(err => Promise.reject(err));//dont need to catch here like this
        } else {
            //we don't have a session handler so do the best we can
            return Promise.resolve(false);
        }
    }

    _save() {
        if (this._form._driver) {
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
                return this._form._driver.save(this._token, {
                    raw: this._form._fetchValues(true, false, true, false, true, false, null, null),//secure values will be ignored
                    values: this._form._fetchValues(true, false, false, false, true, false, null, null),//secure values will be ignored
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

    _getTokenInfo() {
        return new Promise((resolve, reject) => {
            let token = this._form._driver.request(this._form._tokenField, undefined);

            //make sure its valid
            if (token !== undefined) {
                if (token.length !== this._form._sessionTokenSize || !/^[a-z0-9]+$/i.test(token)) {
                    reject(new FormeError('invalid form token'));
                } else {
                    //found old token (and its valid)
                    resolve({
                        created: false,
                        token: token,
                    });
                }
            } else {
                //no token, or it was invalid so generate new
                return utils.string.token(this._form._sessionTokenSize)
                .then(token => resolve({
                    created: true,
                    token: token,
                }))
                .catch(err => reject(err));
            }
        });
    }

    _addError(name, error) {
        //eat teh error
        this._errors.push({
            name: name,
            error: error,
        });

        //flag that this request has had an error
        this._error = true;
    }

    _createStore(identifier) {
        let store = this._store.identifiers.find(store => store.identifier === identifier);

        //do we need to create the store cache?
        if (store === undefined) {
            store = {
                identifier: identifier,
                names: {},
                groups: {},
            };

            //add form group structure to the store
            this._form._makeGroupStructure(store.groups);

            //add to stored identifiers
            this._store.identifiers.push(store);
        }

        //return cached
        return store;
    }

    _clearCurrentStore() {
        if (this._identifier !== null && this._store !== null) {
            this._store.identifiers = this._store.identifiers.filter(identifier => identifier.identifier !== this._identifier);
        }
    }

    _currentStore() {
        if (this._identifier !== null && this._store !== null) {
            const store = this._store.identifiers.find(store => store.identifier === this._identifier);
            return store?store:null;
        }
    }

    _fetchErrors() {
        if (this._view) {
            //include current errors as well as last errors
            //this is because we might have generated an error while building/loading/etc a form when in view mode
            return this._lastErrors.slice().concat(this._errors);
        } else {
            return this._errors.slice();
        }
    }

    _clearErrors() {
        //never clear "last errors"
        this._error = false;
        this._errors = [];
    }

    _hasError() {
        return this._errors.length > 0;
    }

    _setPage(page, ignoreNull) {
        if (!ignoreNull || page !== null) {
            this._page = page;
            this._current = page ? page._name : null;
        }
    }

    _addInputToStore(name, group, alias, value) {
        if (value !== undefined) {
            //alias is produced by input._outputName()
            const store = this._createStore(this._identifier);

            //add to store in different places
            utils.group.addGroup(store.groups, alias, group, value);
            store.names[name] = value;
        }
    }

    _fetchStoreValues(values) {
        //create complete set of values from store
        values = values || {};
        values.names = {};
        values.groups = {};

        //merge all together!
        if (this._store) {
            //todo: can we improve the performance of this?
            extend(true, values, ...this._store.identifiers.filter(identifier => ({
                names: identifier.names,
                groups: identifier.groups,
            })));
        }

        //nothing, soz
        return values;
    }

    _visit() {
        //always flag off form first
        if (this._submit) {
            this._formFirst = false;

            //flag page (if there is one) as visited
            if (this._started && this._valid && this._page !== null) {
                this._store.visited[this._current] = true;
            }
        }
    }

    _hasVisited(page) {
        return (this._page === null && !this._formFirst) || (!page && this._page && this._store.visited[this._current]) || (page && this._store.visited[page._name]);
    }

    //public methods
    template() {
        return this._form._makeTemplate();
    }

    errors() {
        return this._form.errors(...arguments);
    }

    values() {
        return this._form.values();
    }

    value(name) {
        return this._form.value(name);
    }
}

//expose
module.exports = FormeRequest;