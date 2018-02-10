'use strict';

//module imports
const chai = require('chai');
const chaiSubset = require('chai-subset');
const expect = chai.expect;
const querystring = require('querystring');

chai.use(chaiSubset);

//local imports
const forme = require('../index');
const utils = require('../lib/utils');

//flag dev mode on in forme constants (so that we catch errors)
const constants = require('../lib/constants');
constants.dev = true;

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
registerComponentType('componentValue1', (form, page, component, details) => {
    component.add({
        type: 'text',
        name: 'value1',
    });
});

registerComponentType('componentValue2', (form, page, component, details) => {
    component.add({
        type: 'text',
        name: 'value2',
    });
});

registerComponentType('componentWithTwoInputs', (form, page, component, details) => {
    component.configure({
        inputs:[
            {
                type: 'text',
                name: 'value1',
            },
            {
                type: 'text',
                name: 'value2',
            }
        ],
    });
});

registerComponentType('componentWithSetter', (form, page, component, details) => {
    component.configure({
        inputs:[
            {
                type: 'text',
                name: 'value1',
            },
            {
                type: 'text',
                name: 'value2',
            }
        ],
        setter: (component, value) => {
            var wtf = 123;
        },
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
class ExpressRequest {
    constructor(options) {
        this.session = {};
        this.query = {};
        this.body = {};
        this.originalUrl = null;

        this.configure(options);
    }

    reset() {
        this.query = {};
        this.body = {};
        this.originalUrl = null;
    }

    configure(options) {
        if (options) {
            if (options.query !== undefined) {
                this.setQuery(options.query);
            }

            if (options.body !== undefined) {
                this.setBody(options.body);
            }
        }
    }

    setQuery(query) {
        this.query = query;
        if (typeof this.query === 'string') {
            this.query = querystring.parse(this.query.slice(1));
        }
    }

    setBody(body) {
        this.body = body;
    }
}

function createExpressRequest(options=null) {
    return new ExpressRequest(options);

    //create base session (or reuse the one passed in)
    const session = Object.assign({
        session: {},
        query: {},
        body: {},
        originalUrl: null,
    }, ...overrides);

    //parse string query
    if (typeof session.query === 'string') {
        session.query = querystring.parse(session.query.slice(1));
    }

    //chain
    return session;
}

function viewFormSubmitThenView(form, values, validate=null) {
    //execute the form
    return form.execute(createExpressRequest({
        body: values,
    }))
    .then(result => {
        //check we had validation error!
        if (validate) {
            validate(result);
        }

        //reset the request
        const request = result.storage;
        request.reset();
        request.configure({
            query: result.destination,
        });

        //view the form
        return form.view(request);
    });
}

//form creation shortcuts
function createFormWithTwoRootInputs(configure=null) {
    return new TestDriverForm({
        name: 'testForm',
        inputs: [
            {
                name: 'input1',
                type: 'text',
            },
            {
                name: 'input2',
                type: 'text',
            },
        ]
    }).configure(configure);
}

function createFormWithTwoInputAddedDuringBuild(configure=null) {
    return new TestDriverForm({
        name: 'testForm',
        build: form => {
            form.add([
                {
                    name: 'input1',
                    type: 'text',
                },
                {
                    name: 'input2',
                    type: 'text',
                },
            ])
        },
    }).configure(configure);
}

function createFormWithTwoGroupedInputs(configure=null) {
    return new TestDriverForm({
        name: 'testForm',
        inputs: [
            {
                name: 'input1',
                type: 'text',
                group: ['group1', 'group2'],
            },
            {
                name: 'input2',
                type: 'text',
                group: ['group1'],
            },
        ]
    }).configure(configure);
}

//expose
module.exports = {
    createForm: {
        withTwoRootInputs: createFormWithTwoRootInputs,
        withTwoInputAddedDuringBuild: createFormWithTwoInputAddedDuringBuild,
        withTwoGroupedInputs: createFormWithTwoGroupedInputs,
    },
    expect: expect,
    TestDriverForm: TestDriverForm,
    createExpressRequest: createExpressRequest,
    viewFormSubmitThenView: viewFormSubmitThenView,
    request: {
        create: createExpressRequest,
    },
};