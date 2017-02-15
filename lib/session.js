'use strict';

class FormeSession {
    static load(form) {
        if (form._storage.session !== undefined && form._storage.session.forme !== undefined && form._storage.session.forme[form._name] !== undefined) {
            return Promise.resolve(form._storage.session.forme[form._name]);
        } else {
            return Promise.resolve(null);
        }
    }

    static save(form, data) {
        form._storage.session = form._storage.session || {};
        form._storage.session.forme = form._storage.session.forme || {};
        form._storage.session.forme[form._name] = data;
        return Promise.resolve();
    }

    static clear(form) {
        if (form._storage.session !== undefined && form._storage.session.forme !== undefined && form._storage.session.forme[form._name] !== undefined) {
            delete form._storage.session.forme[form._name];
        }
        return Promise.resolve();
    }
}

//singleton
const session = new FormeSession();

//expose module
module.exports = session;