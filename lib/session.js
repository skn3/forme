'use strict';

class FormeSession {
    constructor(form) {
        this._form = form;
    }
    
    load() {
        const container = this._form._storage._container;

        if (container.session !== undefined && container.session.forme !== undefined && container.session.forme[this._form._request._token] !== undefined) {
            return Promise.resolve(container.session.forme[this._form._request._token]);
        } else {
            return Promise.resolve(null);
        }
    }

    save(data) {
        const container = this._form._storage._container;
        container.session = container.session || {};
        container.session.forme = container.session.forme || {};
        container.session.forme[this._form._request._token] = data;
        return Promise.resolve();
    }

    clear() {
        const container = this._form._storage._container;
        if (container.session !== undefined && container.session.forme !== undefined && container.session.forme[this._form._request._token] !== undefined) {
            delete container.session.forme[this._form._request._token];
        }
        return Promise.resolve();
    }
}

//expose module
module.exports = FormeSession;