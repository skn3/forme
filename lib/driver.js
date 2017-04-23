'use strict';

class FormeDriver {
    constructor(name, storage, request) {
        this._name = name;
        this._storage = storage;

        //we assign the passed in FormeRequest to the correct place in the storage
        this._storage.forme = this._storage.forme || {};
        this._storage.forme[this._name] = request;
    }

    //public methods
    load(token) {
        return new Promise((resolve, reject) => {
            if (this._storage.session !== undefined && this._storage.session.forme !== undefined && this._storage.session.forme[token] !== undefined) {
                resolve(this._storage.session.forme[token]);
            } else {
                resolve(null);
            }
        });
    }

    save(token, data) {
        //make sure objects are created
        return new Promise((resolve, reject) => {
            this._storage.session = this._storage.session || {};
            this._storage.session.forme = this._storage.session.forme || {};

            //save the passed in data specific to this form request
            this._storage.session.forme[token] = data;

            resolve();
        });
    }

    clear(token) {
        return new Promise((resolve, reject) => {
            if (this._storage.session !== undefined && this._storage.session.forme !== undefined && this._storage.session.forme[token] !== undefined) {
                delete this._storage.session.forme[token];
            }

            resolve();
        });
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