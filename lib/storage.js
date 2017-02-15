'use strict';

class FormeStorage {
    constructor(form, container, context) {
        this._form = form;
        this._container = container;
        this._context = context;

        //prepare storage
        this._container.forme = this._container.forme || {};
        this._container.forme[form._name] = context;
    }

    //private methods
    _get(name, defaultValue) {
        if (this._container.query !== undefined && this._container.query[name] !== undefined) {
            return this._container.query[name];
        } else {
            return defaultValue;
        }
    }

    _post(name, defaultValue) {
        if (this._container.body !== undefined && this._container.body[name] !== undefined) {
            return this._container.body[name];
        } else {
            return defaultValue;
        }
    }

    _request(name, defaultValue) {
        if (this._container.body !== undefined && this._container.body[name] !== undefined) {
            return this._container.body[name];
        } else if (this._container.query !== undefined && this._container.query[name] !== undefined) {
            return this._container.query[name];
        } else {
            return defaultValue;
        }
    }

    _url() {
        //try to compensate for various sources of url for different environments
        //todo: this is nasty, but until "drivers" are written then this is the only option
        if (this._container.originalUrl !== undefined) {
            return this._container.originalUrl;
        } else if (this._container.url !== undefined) {
            return this._container.url;
        } else {
            return '';
        }
    }
}

//expose module
module.exports = FormeStorage;