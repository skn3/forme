'use strict';

//load imports
const utils = require('./utils');

class FormeRequest {
    constructor(form) {
        this._form = form;
        this._token = null;
        this._page = null;
        this._future = null;
        this._saved = false;
        this._first = true;
        this._valid = true;
        this._reload = false;
        this._destination = null;
        this._building = false;
        this._raw = [];
        this._values = {};
        this._errors = [];
        this._actions = [];
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
                    this._page = session.page;
                }

                //try to override page from request(get/post)
                //this allows for same-page forms to work with browser history.
                //if no page param is found, then forme can fallback to page tracking in session
                const page = this._form._storage._request(this._form._pageField);
                if (page !== undefined) {
                    this._page = page;
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
            return this._form._session.save({
                raw: this._form._fetchValues(true, false, true, null),
                values: this._form._fetchValues(true, false, false, null),
                errors: this._errors,
                first: this._first,
                page: this._future,//request always saves future page. form is in charge of setting self or next/prev/other page
            })
            .then(() => true);
        } else {
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

    //public methods
    template() {
        return this._form._buildTemplate();
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