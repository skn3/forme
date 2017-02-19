'use strict';

//local imports
const utils = require('./utils');

class FormeResult {
    constructor(form) {
        //this needs to create a snapshot of data as the form could be reset after the result is created
        this._form = form;
        this._token = form._request._token;
        this._future = form._request._future;
        this._valid = form._request._valid;
        this._saved = form._request._saved;
        this._reload = form._request._reload;
        this._destination = form._request._destination;
        this._values = form._fetchValues(false, true, false, true, null, null);//result always contains ALL values
        this._errors = form._fetchErrors();
        this._actions = form._request._actions.slice();
        this._pageQuery = this._form._pages === null || this._future === null || this._form._request._page._destination !== null;
        this._template = !this._form._request._submit ? this._form._makeTemplate() : null;//dont bother generating template when submitting
    };

    //properties
    get form() {
        return this._form;
    }

    get valid() {
        return this._valid;
    }

    get reload() {
        return this._reload;
    }

    get template() {
        return this._template;
    }

    get destination() {
        let destination = this._destination === null?this._form._storage._url():this._destination;
        let addQuery = null;
        const removeQuery = [];

        //token
        if (this._token === null) {
            removeQuery.push(this._form._tokenField);
        } else {
            addQuery = addQuery || {};
            addQuery[this._form._tokenField] = this._token;
        }

        //page
        if (this._pageQuery) {
            removeQuery.push(this._form._pageField);
        } else {
            addQuery = addQuery || {};
            addQuery[this._form._pageField] = this._future;
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