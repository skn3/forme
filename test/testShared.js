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
    component.input({
        type: 'text',
        name: 'input1',
    });
});

registerComponentType('componentValue2', (form, page, component, details) => {
    component.input({
        type: 'text',
        name: 'input2',
    });
});

registerComponentType('componentInputRequired', (form, page, component, details) => {
    component.input({
        type: 'text',
        name: 'input1',
        required: {
            required: true,
            error: 'CUSTOM_REQUIRED_ERROR',
        }
    });
});

registerComponentType('componentWithTwoInputs', (form, page, component, details) => {
    component.configure({
        inputs:[
            {
                type: 'text',
                name: 'input1',
            },
            {
                type: 'text',
                name: 'input2',
            }
        ],
    });
});

registerComponentType('componentWithTwoInputDefaultValues', (form, page, component, details) => {
    component.configure({
        inputs:[
            {
                type: 'text',
                name: 'input1',
                defaultValue: 'default1',
            },
            {
                type: 'text',
                name: 'input2',
                defaultValue: 'default2',
            }
        ],
    });
});

registerComponentType('componentWithTwoInputsWithOneExposed', (form, page, component, details) => {
    component.configure({
        expose: 'input1',
        inputs:[
            {
                type: 'text',
                name: 'input1',
            },
            {
                type: 'text',
                name: 'input2',
            }
        ],
    });
});

registerComponentType('componentWithThreeInputsWithTwoExposed', (form, page, component, details) => {
    component.configure({
        expose: ['input1', 'input3'],
        inputs: [
            {
                type: 'text',
                name: 'input1',
            },
            {
                type: 'text',
                name: 'input2',
            },
            {
                type: 'text',
                name: 'input3',
            }
        ],
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
            if (options.query !== undefined && options.query !== null) {
                this.setQuery(options.query);
            }

            if (options.body !== undefined && options.body !== null) {
                this.setBody(options.body);
            }
        }
    }

    setQuery(query) {
        if (typeof query === 'string') {
            this.query = querystring.parse(query.slice(1));
        } else {
            this.query = Object.assign({}, query);
        }
    }

    setBody(body) {
        this.body = Object.assign({}, body);
    }
}

function createExpressRequest(options=null) {
    return new ExpressRequest(options);
}

function trackInputConfigurationCalls(configuration) {
    //this helper will create a form, add an input and then override all configuration methods on that input. The overrides simply
    //dump the method name into an output array, which we can use to track the order of calls.
    const form = new TestDriverForm('form1');
    const input = form.input('input1');

    //replace all configurable methods with own special ones that track the order of execution
    const output = [];
    const methods = input.configurableMethodNames;
    for(let method of methods) {
        input[method] = () => {output.push(method)};
    }

    //apply the configuration passed in
    input.configure(configuration);

    //chain output
    return output;
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

//configuration shortcuts
function createFormWithConfiguration(configuration) {
    return new TestDriverForm(Object.assign({
        name: 'form1',
    }, configuration));
}

function createFormWithPageConfiguration(configuration) {
    return new TestDriverForm({
        name: 'form1',
        page: Object.assign({
            name: 'page1',
        }, configuration),
    });
}

function createFormWithComponentConfiguration(configuration) {
    return new TestDriverForm({
        name: 'form1',
        component: Object.assign({
            name: 'component1',
            type: 'componentValue1',
        }, configuration),
    });
}

function createFormWithInputConfiguration(configuration) {
    return new TestDriverForm({
        name: 'form1',
        input: Object.assign({
            name: 'input1',
            type: 'text',
        }, configuration),
    });
}

//1 input shortcuts
function createFormWithInput() {
    return new TestDriverForm({
        name: 'form1',
        inputs: [
            {
                name: 'input1',
                type: 'text',
            },
        ]
    });
}

function createFormWithInputDefaultValue() {
    return new TestDriverForm({
        name: 'form1',
        inputs: [
            {
                type: 'text',
                name: 'input1',
                defaultValue: 'theDefaultValue',
            },
        ]
    });
}

function createFormWithInputRequired() {
    return new TestDriverForm({
        name: 'form1',
        inputs: [
            {
                type: 'text',
                name: 'input1',
                required: {
                    required: true,
                    error: 'CUSTOM_REQUIRED_ERROR',
                },
            },
        ]
    });
}

function createFormWithInputOptions() {
    return new TestDriverForm({
        name: 'form1',
        inputs: [
            {
                type: 'text',
                name: 'input1',
                options: {
                    options: 'I_AM_ALLOWED',
                    error: 'CUSTOM_OPTIONS_ERROR',
                },
            },
        ]
    });
}

function createFormWithInputBlacklist() {
    return new TestDriverForm({
        name: 'form1',
        inputs: [
            {
                type: 'text',
                name: 'input1',
                blacklist: {
                    options: 'I_AM_NOT_ALLOWED!!!',
                    error: 'CUSTOM_BLACKLIST_ERROR',
                },
            },
        ]
    });
}

function createFormWithInputContext() {
    const form = new TestDriverForm({
        name: 'form1',
    });

    const input = form.input({
        type: 'text',
        name: 'input1',
    });

    input.context('context1', 'privateValue1', false);
    input.context('context2', 'publicValue2', true);

    return form;
}

//two input shortcuts
function createFormWithTwoInputs() {
    return new TestDriverForm({
        name: 'form1',
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
    });
}

function createFormWithTwoInputsOneRequired() {
    return new TestDriverForm({
        name: 'form1',
        inputs: [
            {
                name: 'input1',
                type: 'text',
                required: {
                    required: true,
                    error: 'CUSTOM_REQUIRED_ERROR',
                },
            },
            {
                name: 'input2',
                type: 'text',
            },
        ]
    });
}

function createFormWithTwoDynamicInputs() {
    return new TestDriverForm({
        name: 'form1',
        build: form => {
            form.input([
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
    });
}

function createFormWithTwoGroupedInputs() {
    return new TestDriverForm({
        name: 'form1',
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
    });
}

function createFormWithTwoGroupedInputs() {
    return new TestDriverForm({
        name: 'form1',
        inputs: [
            {
                name: 'this_is_input1_with_funky_long_name',
                alias: 'input1',
                type: 'text',
                group: ['group1', 'group2'],
            },
            {
                name: 'element_123456',
                alias: 'input2',
                type: 'text',
                group: ['group1'],
            },
        ]
    });
}

function createFormWithTwoGroupedInputsOneRequired() {
    return new TestDriverForm({
        name: 'form1',
        inputs: [
            {
                name: 'input1',
                type: 'text',
                group: ['group1', 'group2'],
                required: {
                    required: true,
                    error: 'CUSTOM_REQUIRED_ERROR',
                },
            },
            {
                name: 'input2',
                type: 'text',
                group: ['group1'],
            },
        ]
    });
}

function createFormWithTwoGroupedInputsOneSecured() {
    return new TestDriverForm({
        name: 'form1',
        inputs: [
            {
                name: 'this_is_input1_with_funky_long_name',
                alias: 'input1',
                type: 'text',
                group: ['group1', 'group2'],
                secure: true,
            },
            {
                name: 'element_123456',
                alias: 'input2',
                type: 'text',
                group: ['group1'],
            },
        ]
    });
}

//three input shortcuts
function createFormWithThreeGroupedInputs() {
    return new TestDriverForm({
        name: 'form1',
        inputs: [
            {
                type: 'text',
                name: 'input1',
                group: ['group1', 'group2'],
            },
            {
                type: 'text',
                name: 'input2',
                group: ['group1'],
            },
            {
                type: 'text',
                name: 'myInput3',
                group: ['group1', 'group2', 'group3'],
            },
        ],
    });
}

//component shortcuts
function createFormWithGroupedComponent() {
    return new TestDriverForm({
        name: 'form1',
        component: {
            name: 'component1',
            type: 'componentValue1',
            group: ['group1', 'group2'],
        },
    });
}

function createFormWithComponentInputRequired() {
    return new TestDriverForm({
        name: 'form1',
        component: {
            name: 'component1',
            type: 'componentInputRequired',
        },
    });
}

function createFormWithMultiComponent() {
    return new TestDriverForm({
        name: 'form1',
        component: {
            name: 'component1',
            type: 'componentWithTwoInputs',
        },
    });
}

function createFormWithMultiComponentDefaultValue(defaultValue) {
    return new TestDriverForm({
        name: 'form1',
        component: {
            name: 'component1',
            type: 'componentWithTwoInputs',
            defaultValue: defaultValue || {
                input1: 'default1',
                input2: 'default2',
            }
        },
    });
}

function createFormWithMultiComponentOneExposed(defaultValue) {
    return new TestDriverForm({
        name: 'form1',
        component: {
            name: 'component1',
            type: 'componentWithTwoInputsWithOneExposed',
        },
    });
}

function createFormWithMultiComponentOneExposedDefaultValue(defaultValue) {
    return new TestDriverForm({
        name: 'form1',
        component: {
            name: 'component1',
            type: 'componentWithTwoInputsWithOneExposed',
            defaultValue: 'default1',
        },
    });
}

function createFormWithMultiComponentTwoExposed(defaultValue) {
    return new TestDriverForm({
        name: 'form1',
        component: {
            name: 'component1',
            type: 'componentWithThreeInputsWithTwoExposed',
        },
    });
}

function createFormWithMultiComponentTwoExposedDefaultValue(defaultValue) {
    return new TestDriverForm({
        name: 'form1',
        component: {
            name: 'component1',
            type: 'componentWithThreeInputsWithTwoExposed',
            defaultValue: {
                input1: 'default1',
                input2: 'default2',//this wont actually set because the component has not exposed it!
                input3: 'default3',
            },
        },
    });
}

function createFormWithMultiComponentInputDefaultValues() {
    return new TestDriverForm({
        name: 'form1',
        component: {
            name: 'component1',
            type: 'componentWithTwoInputDefaultValues',
        },
    });
}

function createFormWithComponentSetter(setter) {
    return new TestDriverForm({
        name: 'form1',
        component: {
            name: 'component1',
            type: 'componentWithTwoInputs',
            setter: setter,
        },
    });
}

//create shortcuts
const formBlueprints = {
    withConfiguration: createFormWithConfiguration,
    withPageConfiguration: createFormWithPageConfiguration,
    withComponentConfiguration: createFormWithComponentConfiguration,
    withInputConfiguration: createFormWithInputConfiguration,

    withInput: createFormWithInput,
    withInputDefaultValue: createFormWithInputDefaultValue,
    withInputRequired: createFormWithInputRequired,
    withInputOptions: createFormWithInputOptions,
    withInputBlacklist: createFormWithInputBlacklist,
    withInputContext: createFormWithInputContext,

    withTwoInputs: createFormWithTwoInputs,
    withTwoInputsOneRequired: createFormWithTwoInputsOneRequired,
    withTwoDynamicInputs: createFormWithTwoDynamicInputs,
    withTwoGroupedInputs: createFormWithTwoGroupedInputs,
    withTwoGroupedInputsOneRequired: createFormWithTwoGroupedInputsOneRequired,
    withTwoGroupedInputsOneSecured: createFormWithTwoGroupedInputsOneSecured,

    withThreeGroupedInputs: createFormWithThreeGroupedInputs,

    withComponentInputRequired: createFormWithComponentInputRequired,
    withComponentSetter: createFormWithComponentSetter,

    withGroupedComponent: createFormWithGroupedComponent,

    withMultiComponent: createFormWithMultiComponent,
    withMultiComponentDefaultValue: createFormWithMultiComponentDefaultValue,
    withMultiComponentInputDefaultValues: createFormWithMultiComponentInputDefaultValues,
    withMultiComponentOneExposed: createFormWithMultiComponentOneExposed,
    withMultiComponentOneExposedDefaultValue: createFormWithMultiComponentOneExposedDefaultValue,
    withMultiComponentTwoExposed: createFormWithMultiComponentTwoExposed,
    withMultiComponentTwoExposedDefaultValue: createFormWithMultiComponentTwoExposedDefaultValue,
};

//expose
module.exports = {
    blueprints: {
        create: formBlueprints,

        view: Object.assign({}, ...Object.keys(formBlueprints).map(key => ({
            [key]: function(...params) {
                const form = formBlueprints[key](...params);
                const request = createExpressRequest();

                return form.view(request);
            },
        }))),

        submit: Object.assign({}, ...Object.keys(formBlueprints).map(key => ({
            [key]: function(values=null, ...params) {
                const form = formBlueprints[key](...params);
                const request = createExpressRequest({body: form.convertElementValues(values)});

                return form.execute(request);
            }
        }))),

        viewThenSubmit: Object.assign({}, ...Object.keys(formBlueprints).map(key => ({
            [key]: function(values=null, ...params) {
                const form = formBlueprints[key](...params);
                const request = createExpressRequest();

                return form.view(request)
                .then(result => {
                    //continue...
                    const request = result.storage;

                    //reset the request
                    request.reset();

                    //set the query details!
                    request.configure({
                        query: result.destination,
                        body: Object.assign(result.namedValues, result.form.convertElementValues(values)),//merge in the result values with the submit data. This simulates the defaultValues for a form
                    });

                    //view the form
                    return form.execute(request);
                });
            }
        }))),

        submitThenView: Object.assign({}, ...Object.keys(formBlueprints).map(key => ({
            [key]: function(values=null, ...params) {
                const form = formBlueprints[key](...params);
                const request = createExpressRequest({body: form.convertElementValues(values)});

                //add an always failing validation handler to form so the view happens. Otherwise forme will end the session on successful submit
                form.alwaysInvalid();

                return form.execute(request)
                .then(result => {
                    //continue...
                    const request = result.storage;

                    //reset the request
                    request.reset();

                    //set the query details!
                    request.configure({
                        query: result.destination,
                    });

                    //view the form
                    return form.view(request);
                });
            }
        }))),
    },
    expect: expect,
    TestDriverForm: TestDriverForm,
    createExpressRequest: createExpressRequest,
    trackInputConfigurationCalls: trackInputConfigurationCalls,
    viewFormSubmitThenView: viewFormSubmitThenView,
    request: {
        create: createExpressRequest,
    },
};