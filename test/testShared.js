'use strict';

//local imports
const forme = require('../index');
const utils = require('../lib/utils');

//forme imports
const {
    FormeDriver,
    Forme,
    FormePage,
    FormeComponent,
    FormeInput,
} = forme;

//component type functions
const componentTypes = {};

function registerComponentType(type, callback) {
    componentTypes[type] = callback;
}

function findComponentType(type) {
    return componentTypes[type] || null;
}

//register test component types
registerComponentType('component1', (form, page, component, details) => {
    component.add({
        type: 'text',
        name: 'value1',
    });
});

registerComponentType('component2', (form, page, component, details) => {
    component.configure({
        encase: false,
    });

    component.add({
        type: 'text',
        name: 'value2',
    });
});

//forme objects
class TestFormeDriver extends FormeDriver {
    static get formClass() {
        return TestDriverForm;
    }

    static get pageClass() {
        return TestDriverPage;
    }

    static get componentClass() {
        return TestDriverComponent;
    }

    static get inputClass() {
        return TestDriverInput;
    }
    
    compose(form, page, component, details) {
        //look for our registered component types
        const callback = findComponentType(details.type);
        if (callback !== null) {
            //we have a match so let that type handle the build. Make sure its wrapped in a promise...
            return utils.promise.result(callback(form, page, component, details))

            //return that the compose() was handled!
            .then(() => true);
        } else {
            throw new Error(`unknown component type '${details.type}'`);
        }
    }
}

class TestDriverForm extends Forme {
    constructor(name, driver=null) {
        //pass in our driver to handle new FooForm() calls (although this is handled via teh defaultDriverClass too)
        super(name, TestFormeDriver);
    }
}

class TestDriverPage extends FormePage {
}

class TestDriverComponent extends FormeComponent {
}

class TestDriverInput extends FormeInput {
}

//set default forme driver (intercepts calls to forme() to construct forms)
forme.driver(TestFormeDriver);

//functions
function createExpressStyleRequest(values=null) {
    return {
        session: {},
        query: values || {},
        body: values || {},
        originalUrl: null,
    };
}

//expose
module.exports = {
    TestDriverForm: TestDriverForm,
    createExpressStyleRequest: createExpressStyleRequest,
};