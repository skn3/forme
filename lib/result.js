'use strict';

//local imports
const utils = require('./utils');

class FormeResult {
    constructor(form) {
        this._form = form;
        this._token = form._request._token;
        this._valid = form._request._valid;
        this._saved = form._request._saved;
        this._reload = form._request._reload;
        this._destination = form._request._destination;
        this._values = form._fetchValues(false, true, false, null);
        this._errors = form._fetchErrors();
        this._actions = form._request._actions;
    };

    //properties
    get form() {
        return this._form;
    }

    get valid() {
        return this._valid;
    }

    get saved() {
        return this._saved;
    }

    get reload() {
        return this._reload;
    }

    get destination() {
        const query = {
            [this._form._tokenField]:this._token,
        };

        if (this._form._pages !== null) {
            query[this._form._pageField] = this._form._request._future;
        }

        if (this._destination === null) {
            return utils.url.addQuery(this._form._storage._url(), query);
        } else {
            return utils.url.addQuery(this._destination, query);
        }
    }

    get values() {
        return this._values;
    }

    get errors() {
        return this._errors;
    }

    get actions() {
        return this._actions;
    }
}

//expose
module.exports = FormeResult;