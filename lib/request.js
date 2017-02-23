'use strict';

//module imports
const extend = require('extend');

//load imports
const utils = require('./utils');

class FormeRequest {
    constructor(form) {
        this._form = form;

        this._token = null;
        this._identifier = null;
        this._page = null;
        this._current = null;//current page name
        this._future = null;//future page name
        this._destination = null;

        this._started = false;
        this._view = false;
        this._submit = false;
        this._saved = false;
        this._reset = false;
        this._prev = false;
        this._next = false;
        this._halt = false;
        this._error = false;//has there been an error this request?
        this._finished = false;
        this._first = true;
        this._valid = true;
        this._reload = false;
        this._reloadOverride = null;
        this._building = false;
        this._special = false;

        this._processSpecialActions = true;

        this._raw = [];
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
            //is there a token available
            return this._findToken()
            .then(token => {
                this._token = token;
                return this._form._driver.load(this._token);
            })
            .then(data => {
                //copy data from session
                if (data !== null) {
                    this._lastErrors = data.errors;
                    this._first = data.first;
                    this._store = data.store;
                    this._raw = data.raw;
                    this._values = data.values;

                    //locate page
                    this._setPage(this._form._findPage(data.page));
                }
            })
            .then(() => this._form._driver.clear(this._token))//clear the saved after loading, as its now plumbed into the request (as we handle all errors, we can save the data at the end)
            .then(() => true);
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
                    first: this._first,
                    page: this._future,
                    store: this._store,
                })
                .then(() => true);
            }
        } else {
            //no session
            return Promise.resolve(false);
        }
    }

    _findToken() {
        let token = this._form._driver.request(this._form._tokenField);
        if (token !== undefined) {
            //found old token
            return Promise.resolve(token);
        } else {
            //generate new token
            return utils.string.token(10);
        }
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
        let store = this._store.identifiers.find(store => store.identifier == identifier);
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
            this._store.identifiers = this._store.identifiers.filter(identifier => identifier.identifier != this._identifier);
        }
    }

    _currentStore() {
        if (this._identifier !== null && this._store !== null) {
            const store = this._store.identifiers.find(store => store.identifier == this._identifier);
            return store?store:null;
        }
    }

    _fetchErrors() {
        if (this._view) {
            return this._lastErrors.slice();
        } else {
            return this._errors.slice();
        }
    }

    _clearErrors() {
        //never clear "last errors"
        this._error = false;
        this._errors = [];
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
        if (this._started && this._valid && this._page !== null) {
            this._store.visited[this._current] = true;
        }
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