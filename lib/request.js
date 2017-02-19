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
        this._future = null;
        this._destination = null;

        this._submit = false;
        this._saved = false;
        this._reset = false;
        this._halt = false;
        this._finished = false;
        this._first = true;
        this._valid = true;
        this._reload = false;
        this._building = false;
        this._special = false;

        this._processSpecialActions = true;

        this._raw = [];
        this._values = {};
        this._errors = [];
        this._actions = [];
        this._store = {
            identifiers: [],//values per "page"
            visited: {},//pages visited
        };
    };

    //private methods
    _load() {
        if (this._form._session) {
            //is there a token available
            return this._findToken()
            .then(token => {
                this._token = token;
                return this._form._session.load();
            })
            .then(session => {
                //copy data from session
                if (session !== null) {
                    this._errors = session.errors;
                    this._first = session.first;
                    this._store = session.store;
                    this._raw = session.raw;
                    this._values = session.values;

                    //locate page
                    this._page = this._form._findPage(session.page);
                }
            })
            .then(() => this._form._session.clear())
            .then(() => true);
        } else {
            //we don't have a session handler so do the best we can
            return Promise.resolve(false);
        }
    }

    _save() {
        if (this._form._session) {
            if (this._reset) {
                //reset
                this._token = null;
                this._identifier = null;
                this._page = null;
                this._future = null;
                this._saved = false;
                this._raw = {};
                this._values = {};
                this._errors = [];
                this._actions = [];
                this._store = null;

                return Promise.resolve(false);
            } else {
                //save
                this._saved = true;

                return this._form._session.save({
                    raw: this._form._fetchValues(true, false, true, false, null, null),
                    values: this._form._fetchValues(true, false, false, false, null, null),
                    errors: this._errors,
                    first: this._first,
                    page: this._future,//request always saves future page. form is in charge of setting self or next/prev/other page
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
        let token = this._form._storage._request(this._form._tokenField);
        if (token !== undefined) {
            //found old token
            return Promise.resolve(token);
        } else {
            //generate new token
            return utils.string.token(10);
        }
    }

    _createStore(identifier) {
        let store = this._store.identifiers.find(store => store.identifier == identifier);
        if (store === undefined) {
            store = {
                identifier: identifier,
                names: {},
                groups: {},
            };

            this._store.identifiers.push(store);
        }

        return store;
    }

    _currentStore() {
        if (this._identifier !== null && this._store !== null) {
            const store = this._store.identifiers.find(store => store.identifier == this._identifier);
            return store?store:null;
        }
    }

    _addToStore(name, group, value) {
        const store = this._createStore(this._identifier);

        //add to store in different places
        utils.group.addGroup(store.groups, name, group, value);
        store.names[name] = value;
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
        if (this._submit && this._page !== null) {
            this._store.visited[this._page._name] = true;
        }
    }

    //public methods
    template() {
        return this._form._makeTemplate();
    }

    errors(name) {
        return this._form.errors(name);
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