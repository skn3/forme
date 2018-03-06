'use strict';

//module imports
const chai = require('chai');
const chaiSubset = require('chai-subset');
const chaiAsPromised = require("chai-as-promised");
const chaiString = require('chai-string');
const expect = chai.expect;
const querystring = require('querystring');

chai.use(chaiSubset);
chai.use(chaiAsPromised);
chai.use(chaiString);

//local imports
const forme = require('../index');
const utils = require('../lib/utils');

//flag dev mode on in forme constants (so that we catch more errors)
const constants = require('../lib/constants');
constants.dev = true;
//constants.logErrors = false;//disable

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

            if (options.originalUrl !== undefined && options.originalUrl !== null) {
                this.setOriginalUrl(options.originalUrl);
            }
        }
    }

    redirect(url) {
        this.configure({
            query: url,
            originalUrl: url,
        });
        var wtf = 123;
    }

    setQuery(query) {
        if (typeof query === 'string') {
            this.query = utils.url.extractQuery(query);
        } else {
            this.query = Object.assign({}, query);
        }
    }

    setBody(body) {
        this.body = Object.assign({}, body);
    }

    setOriginalUrl(originalUrl) {
        this.originalUrl = originalUrl;
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

function runFormCommands(commands=null, globalForm=null) {
    if (!commands || commands.length === 0) {
        throw new Error(`no commands provided to runFormCommands()`)
    }

    //steps handler
    const nextStep = (commandIndex, request, lastResult) => {
        //get the command!
        const command = commands[commandIndex];

        //get current form for the current command (revert back to global form otherwise)
        const currentForm = command.form || globalForm;

        //validate
        if (!currentForm) {
            throw new Error(`invalid form for command #${commandIndex} ('${command.command}') in runFormCommands()`)
        }

        //save/reset action state on teh current form, for this command!
        currentForm.context('commandIndex', commandIndex);
        currentForm.context('commandCurrent', command);
        currentForm.context('commandSuccess', false);

        //attach command handlers if we have not already
        if (!currentForm.context('commandHandlerAttached')) {
            //flag as attached
            currentForm.context('commandHandlerAttached', true);

            //load handler
            currentForm.load(form => {
                const command = form.context('commandCurrent');

                //force fail the form
                if (command.fail) {
                    form.forceFail();
                }
            });

            //success handler
            currentForm.success(form => {
                //this basically looks for a form success, and based on the currentCommand, performs some forme thang!
                const commandIndex = form.context('commandIndex');
                const command = form.context('commandCurrent');

                //flag success!
                form.context('commandSuccess', true);

                //move the page
                switch (command.page) {
                    case 'prev':
                        if (form.pageIndex === -1) {
                            throw new Error(`invalid prev on un-paged form for command #${commandIndex} ('${command.command}') in runFormCommands()`)
                        }
                        form.prev();
                        break;

                    case 'next':
                        if (form.pageIndex === -1) {
                            throw new Error(`invalid next on un-paged form for command #${commandIndex} ('${command.command}') in runFormCommands()`)
                        }
                        form.next();
                        break;
                }
            });
        }

        //do stuff before
        if (command.originalUrl !== undefined) {
            request.setOriginalUrl(command.originalUrl);
        }

        //execute teh main command!
        return Promise.resolve()
        .then(() => {
            switch (command.command) {
                //view style actions
                case 'view':
                    //flag success on view because the success handler doesnt obviously get called!
                    currentForm.context('commandSuccess', true);

                    return currentForm.view(request);

                //submit style actions
                case 'execute':
                    //build body values and remember we need to merge in previous values (because the test code may only provide a limited set of submit values)
                    let bodyValues;
                    if (command.values && typeof command.values === 'object') {
                        if (!lastResult) {
                            bodyValues = currentForm.convertElementValues(command.values);
                        } else {
                            bodyValues = utils.merge.allowOverwriteWithNull(lastResult.form.getNamedValues(), lastResult.form.convertElementValues(command.values));
                        }
                    } else {
                        if (lastResult) {
                            bodyValues = lastResult.form.getNamedValues();
                        }
                    }

                    //set body values in the request
                    request.setBody(bodyValues);

                    //execute the form!
                    return currentForm.execute(request);
                default:
                    throw new Error(`unknown command #${commandIndex} ('${command.command}') in runFormCommands()`)
            }
        })
        .then(result => {
            const form = result.form;
            const command = form.context('commandCurrent');
            const commandIndex = form.context('commandIndex');
            const request = result.storage;

            //make sure teh success handler got called (or overidden in view mode)
            if (command.expectSuccess === true && !result.form.context('commandSuccess')) {
                throw new Error(`failed success handler for command #${commandIndex} ('${command.command}') in runFormCommands()`);
            }

            //validate expected page index
            if (command.expectPageIndex !== undefined && command.expectPageIndex !== result.pageIndex) {
                throw new Error(`unexpected page index '${result.pageIndex}' for command #${commandIndex} ('${command.command}') in runFormCommands()`);
            }

            //validate valid (last)
            if (command.expectValidResult === true && !result.valid) {
                throw new Error(`invalid result.valid for command #${commandIndex} ('${command.command}') runFormCommands()`);
            }

            //reset the request for the next step!
            request.reset();
            request.redirect(result.destination);

            //do things before
            if (command.goto !== undefined) {
                const page = form.getPageWithIndex(parseInt(command.goto)) || form.getPageWithName(command.goto);
                if (!page) {
                    throw new Error(`can't find goto page '${command.goto}' for command #${commandIndex} ('${command.command}') in runFormCommands()`);
                }

                //redirect teh request
                request.redirect(page._url);
            }

            //next step?
            if (commandIndex < commands.length - 1) {
                //next step
                return nextStep(commandIndex+1, request, result);
            } else {
                //finished, so pass on the result!
                return result;
            }
        });
    };

    //start steps
    return nextStep(0, createExpressRequest(), null);
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

function createFormWithTwoCheckboxes() {
    return new TestDriverForm({
        name: 'form1',
        inputs: [
            {
                name: 'checkbox1',
                type: 'checkbox',
                checkedValue: 1,
            },
            {
                name: 'checkbox2',
                type: 'checkbox',
                checkedValue: 1,
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

//page shortcuts
function createFormWithTwoPagesFourInputsKeepTwo() {
    return new TestDriverForm({
        name: 'form1',
        pages: [
            {
                name: 'page1',
                inputs: [
                    {
                        name: 'input1',
                        type: 'text',
                        keep: true,
                    },
                    {
                        name: 'input2',
                        type: 'text',
                        keep: false,
                    },
                ],
            },
            {
                name: 'page2',
                inputs: [
                    {
                        name: 'input3',
                        type: 'text',
                        keep: true,
                    },
                    {
                        name: 'input4',
                        type: 'text',
                        keep: false,
                    },
                ],
            },
        ],
    });
}

function createFormWithThreePagesSixInputsKeepThree() {
    return new TestDriverForm({
        name: 'form1',
        pages: [
            {
                name: 'page1',
                inputs: [
                    {
                        name: 'input1',
                        type: 'text',
                        keep: true,
                    },
                    {
                        name: 'input2',
                        type: 'text',
                        keep: false,
                    },
                ],
            },
            {
                name: 'page2',
                inputs: [
                    {
                        name: 'input3',
                        type: 'text',
                        keep: true,
                    },
                    {
                        name: 'input4',
                        type: 'text',
                        keep: false,
                    },
                ],
            },
            {
                name: 'page3',
                inputs: [
                    {
                        name: 'input5',
                        type: 'text',
                        keep: true,
                    },
                    {
                        name: 'input6',
                        type: 'text',
                        keep: false,
                    },
                ],
            },
        ],
    });
}

function createFormWithTwoPagesFourInputsTwoCheckboxes() {
    return new TestDriverForm({
        name: 'form1',
        pages: [
            {
                name: 'page1',
                inputs: [
                    {
                        name: 'checkbox1',
                        type: 'checkbox',
                        keep: true,
                        checkedValue: 1,
                    },
                    {
                        name: 'checkbox2',
                        type: 'checkbox',
                        keep: true,
                        checkedValue: 1,
                    },
                ],
            },
            {
                name: 'page2',
                inputs: [
                    {
                        name: 'input1',
                        type: 'text',
                        keep: true,
                    },
                    {
                        name: 'input2',
                        type: 'text',
                        keep: true,
                    },
                ],
            },
        ],
    });
}

//external page shortcuts
function createFormWithExternalPages(pages, configure) {
    return new TestDriverForm({
        name: 'form1',
        externalPages: pages,
    }).configure(configure);
}

function createFormWithThreeExternalPages(configure) {
    return createFormWithExternalPages(['website.com/page1.html', 'website.com/page2.html', 'website.com/page3.html'], configure);
}

function createFormWithExternalPageOneOfThree() {
    return createFormWithThreeExternalPages({
        inputs: [
            {
                name: 'input1',
                type: 'text',
                keep: true,
            },
            {
                name: 'input2',
                type: 'text',
                keep: false,
            },
        ],
    });
}

function createFormWithExternalPageTwoOfThree() {
    return createFormWithThreeExternalPages({
        inputs: [
            {
                name: 'input3',
                type: 'text',
                keep: true,
            },
            {
                name: 'input4',
                type: 'text',
                keep: false,
            },
        ],
    });
}

function createFormWithExternalPageThreeOfThree() {
    return createFormWithThreeExternalPages({
        inputs: [
            {
                name: 'input5',
                type: 'text',
                keep: true,
            },
            {
                name: 'input6',
                type: 'text',
                keep: false,
            },
        ],
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
    withTwoCheckboxes: createFormWithTwoCheckboxes,

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

    withTwoPagesFourInputsKeepTwo: createFormWithTwoPagesFourInputsKeepTwo,
    withTwoPagesFourInputsTwoCheckboxes: createFormWithTwoPagesFourInputsTwoCheckboxes,

    withThreePagesSixInputsKeepThree: createFormWithThreePagesSixInputsKeepThree,

    withExternalPages: createFormWithExternalPages,
    withThreeExternalPages: createFormWithThreeExternalPages,
    withExternalPageOneOfThree: createFormWithExternalPageOneOfThree,
    withExternalPageTwoOfThree: createFormWithExternalPageTwoOfThree,
    withExternalPageThreeOfThree: createFormWithExternalPageThreeOfThree,
};

//expose
module.exports = {
    //blueprints (shortcuts)
    blueprints: {
        create: formBlueprints,

        view: Object.assign({}, ...Object.keys(formBlueprints).map(key => ({
            [key]: function(...params) {
                return runFormCommands([
                    {
                        command: 'view',
                    },
                ], formBlueprints[key](...params));
            },
        }))),

        submit: Object.assign({}, ...Object.keys(formBlueprints).map(key => ({
            [key]: function(values=null, ...params) {
                return runFormCommands([
                    {
                        command: 'execute',
                        values: values,
                    },
                ], formBlueprints[key](...params));
            }
        }))),

        viewSubmit: Object.assign({}, ...Object.keys(formBlueprints).map(key => ({
            [key]: function(values=null, ...params) {
                return runFormCommands([
                    {
                        command: 'view',
                    },
                    {
                        command: 'execute',
                        values: values,
                    },
                ], formBlueprints[key](...params));
            }
        }))),

        submitView: Object.assign({}, ...Object.keys(formBlueprints).map(key => ({
            [key]: function(values=null, ...params) {
                return runFormCommands([
                    {
                        command: 'execute',
                        values: values,
                        fail: true,//must do this otherwise the form will be completed and thus the result would be unexpected
                    },
                    {
                        command: 'view',
                    },
                ], formBlueprints[key](...params));
            }
        }))),

        runCommands: Object.assign({}, ...Object.keys(formBlueprints).map(key => ({
            [key]: function(commands, ...params) {
                return runFormCommands(commands, formBlueprints[key](...params));
            }
        }))),
    },

    //3rd party exposed
    expect: expect,

    //objects
    TestDriverForm: TestDriverForm,

    //functions
    createExpressRequest: createExpressRequest,
    trackInputConfigurationCalls: trackInputConfigurationCalls,
    runFormCommands: runFormCommands,
};