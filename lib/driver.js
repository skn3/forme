'use strict';

class FormeDriver {
    constructor(form, storage, request) {
        this._form = form;
        this._storage = storage;

        //prepare storage
        this._storage.forme = this._storage.forme || {};
        this._storage.forme[form._name] = request;
    }

    //public methods
    load() {
        if (this._storage.session !== undefined && this._storage.session.forme !== undefined && this._storage.session.forme[this._form._request._token] !== undefined) {
            return Promise.resolve(this._storage.session.forme[this._form._request._token]);
        } else {
            return Promise.resolve(null);
        }
    }

    save(data) {
        this._storage.session = this._storage.session || {};
        this._storage.session.forme = this._storage.session.forme || {};
        this._storage.session.forme[this._form._request._token] = data;
        return Promise.resolve();
    }

    clear() {
        if (this._storage.session !== undefined && this._storage.session.forme !== undefined && this._storage.session.forme[this._form._request._token] !== undefined) {
            delete this._storage.session.forme[this._form._request._token];
        }
        return Promise.resolve();
    }

    get(name, defaultValue) {
        if (this._storage.query !== undefined && this._storage.query[name] !== undefined) {
            return this._storage.query[name];
        } else {
            return defaultValue;
        }
    }

    post(name, defaultValue) {
        if (this._storage.body !== undefined && this._storage.body[name] !== undefined) {
            return this._storage.body[name];
        } else {
            return defaultValue;
        }
    }

    request(name, defaultValue) {
        if (this._storage.body !== undefined && this._storage.body[name] !== undefined) {
            return this._storage.body[name];
        } else if (this._storage.query !== undefined && this._storage.query[name] !== undefined) {
            return this._storage.query[name];
        } else {
            return defaultValue;
        }
    }

    url() {
        //try to compensate for various sources of url for different environments
        //todo: this is nasty, but until "drivers" are written then this is the only option
        if (this._storage.originalUrl !== undefined) {
            return this._storage.originalUrl;
        } else if (this._storage.url !== undefined) {
            return this._storage.url;
        } else {
            return '';
        }
    }
}

//expose module
module.exports = FormeDriver;