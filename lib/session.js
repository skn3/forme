'use strict';

class FormeSession {
    clear(storage, form) {
        if (storage.session !== undefined && storage.session.forme !== undefined && storage.session.forme[form._name] !== undefined) {
            delete storage.session.forme[form._name];
        }
        return Promise.resolve();
    }

    save(storage, form, data) {
        storage.session = storage.session || {};
        storage.session.forme = storage.session.forme || {};
        storage.session.forme[form._name] = data;
        return Promise.resolve();
    }

    load(storage, form) {
        if (storage.session !== undefined && storage.session.forme !== undefined && storage.session.forme[form._name] !== undefined) {
            return Promise.resolve(storage.session.forme[form._name]);
        } else {
            return Promise.resolve(null);
        }
    }
}

//singleton
const session = new FormeSession();

//expose module
module.exports = session;