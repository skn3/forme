"use strict";

//local imports
const {expect, TestDriverForm, createExpressRequest, blueprints} = require('../testShared');

//tests
describe('Component', function () {
    describe('#create', function () {
        it('should create a form with a component', function () {
            return blueprints.view.withComponentConfiguration({
                type: 'componentValue2',
                name: 'component2',
            })
            .then(result => {
                expect(result.templateVars).to.be.an('object').that.containSubset({
                    __formeClass: 'form',
                    children: {
                        component2: {
                            __formeClass: 'component',
                            children: {
                                input2: {
                                    __formeClass: 'input',
                                    alias: 'input2',
                                    type: 'text',
                                },
                            },
                        },
                    },
                });
            });
        });

        it('should create a component in a group', function () {
            return blueprints.view.withGroupedComponent()
            .then(result => {
                expect(result.templateVars).to.be.an('object').that.containSubset({
                    __formeClass: 'form',
                    children: {
                        group1: {
                            __formeClass: 'group',
                            children: {
                                group2: {
                                    __formeClass: 'group',
                                    children: {
                                        component1: {
                                            __formeClass: 'component',
                                            children: {
                                                input1: {
                                                    __formeClass: 'input',
                                                    alias: 'input1',
                                                    type: 'text',
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                });
            });
        });

        it('should create a component with form compose handler', function () {
            const form = new TestDriverForm({
                name: 'form1',
                compose: (form, page, component, details) => true,
                component: {
                    name: 'component1',
                    type: 'handledByFormComposeAbove',
                },
            });

            //execute the custom form
            return form.execute(createExpressRequest())
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result.form.getElement('component1')).to.exist;
            });
        });
    });

    describe('#values', function () {
        it('should get the value of a multi input component', function () {
            return blueprints.view.withMultiComponentInputDefaultValues()
            .then(result => {
                const value = result.form.getElementValue('component1');
                expect(value).to.deep.equal({
                    input1: 'default1',
                    input2: 'default2',
                });
            });
        });

        it('should set component value', function () {
            return blueprints.view.withMultiComponent()
            .then(result => {
                result.form.setElementValue('component1', {input1: 'hello', input2: 'world'});
                expect(result.form.getElementValue('component1')).to.deep.equal({
                    input1: 'hello',
                    input2: 'world',
                });
            });
        });

        it('should partially set component values', function () {
            return blueprints.view.withMultiComponent()
            .then(result => {
                result.form.setElementValue('component1', {input1: 'hello', input3: 'world'});
                expect(result.form.getElementValue('component1')).to.deep.equal({
                    input1: 'hello',
                    input2: null,
                });
            });
        });

        it('should overwrite component values with null when input not provided', function () {
            return blueprints.view.withMultiComponent()
            .then(result => {
                result.form.setElementValue('component1', {input1: 'hello', input2: 'world'});
                expect(result.form.getElementValue('component1')).to.deep.equal({
                    input1: 'hello',
                    input2: 'world',
                });
                result.form.setElementValue('component1', {input1: 'monkies'});
                expect(result.form.getElementValue('component1')).to.deep.equal({
                    input1: 'monkies',
                    input2: null,
                });
            });
        });

        it('should wipe component when null given', function () {
            return blueprints.view.withMultiComponent()
            .then(result => {
                result.form.setElementValue('component1', {input1: 'hello', input2: 'world'});
                expect(result.form.getElementValue('component1')).to.deep.equal({
                    input1: 'hello',
                    input2: 'world',
                });
                result.form.setElementValue('component1', null);
                expect(result.form.getElementValue('component1')).to.deep.equal({
                    input1: null,
                    input2: null,
                });
            });
        });

        it('should merge component value', function () {
            return blueprints.view.withMultiComponent()
            .then(result => {
                result.form.setElementValue('component1', {input1: 'hello', input2: 'world'});
                expect(result.form.getElementValue('component1')).to.deep.equal({
                    input1: 'hello',
                    input2: 'world',
                });
                result.form.mergeElementValue('component1', {input2: 'goodbye!'});
                expect(result.form.getElementValue('component1')).to.deep.equal({
                    input1: 'hello',
                    input2: 'goodbye!',
                });
            });
        });

        it('should change component value with setter', function () {
            return blueprints.view.withComponentSetter((form, component, value, merge) => {
                //set (using the without setter option)
                component.setValueWithoutSetter({
                    input1: 'AWESOME:' + value,
                    input2: 'BEANS:' + value,
                });

                //handled
                return true;
            })
            .then(result => {
                result.form.setElementValue('component1', 'THIS_VALUE_IS_COOL');
                expect(result.form.getElementValue('component1')).to.deep.equal({
                    input1: 'AWESOME:THIS_VALUE_IS_COOL',
                    input2: 'BEANS:THIS_VALUE_IS_COOL',
                });
            });
        });

        it('should set default value of inputs from component defaultValue', function () {
            return blueprints.view.withMultiComponentDefaultValue()
            .then(result => {
                expect(result.form.getElementValue('component1')).to.deep.equal({
                    input1: 'default1',
                    input2: 'default2',
                });
            });
        });

        it('should change component default value and then still apply to internal inputs', function () {
            const form = blueprints.create.withMultiComponentDefaultValue()

            form.getElement('component1').defaultValue({
                input1: 'CHANGED!',
            });

            return form.view(createExpressRequest())
            .then(result => {
                expect(result.form.getElementValue('component1')).to.deep.equal({
                    input1: 'CHANGED!',
                    input2: null,
                });
            });
        });

        it('should submit component defaults but not overwrite post values', function () {
            return blueprints.viewSubmit.withMultiComponentDefaultValue({
                component1: {
                    input1: 'CHANGED!'
                },
            })
            .then(result => {
                expect(result.form.getElementValue('component1')).to.deep.equal({
                    input1: 'CHANGED!',
                    input2: 'default2',
                });
            });
        });

        it('should get value of single exposed component', function () {
            return blueprints.viewSubmit.withMultiComponentOneExposedDefaultValue({
                component1: 'value1',
            })
            .then(result => {
                expect(result.values).to.deep.equal({
                    component1: 'default1',
                });
            });
        });

        it('should get value of multiple exposed component', function () {
            return blueprints.viewSubmit.withMultiComponentTwoExposed({
                component1: {
                    input1: 'value1',
                    input3: 'value3',
                },
            })
            .then(result => {
                expect(result.values).to.deep.equal({
                    component1: {
                        input1: 'value1',
                        input3: 'value3',
                    }
                });
            });
        });

        it('should set defaultValue of single exposed component', function () {
            return blueprints.viewSubmit.withMultiComponentOneExposedDefaultValue()
            .then(result => {
                expect(result.values).to.deep.equal({
                    component1: 'default1',
                });
            });
        });

        it('should set defaultValue of multiple exposed component', function () {
            return blueprints.viewSubmit.withMultiComponentTwoExposedDefaultValue()
            .then(result => {
                expect(result.values).to.deep.equal({
                    component1: {
                        input1: 'default1',
                        input3: 'default3',
                    },
                });

                //validate we didnt set default of unexposed input
                expect(result.form.getElementValue('component1.input2')).to.equal(null);
            });
        });
    });

    describe('#validation', function () {
        it('should fail validation for component with required input error piped to component', function () {
            return blueprints.submit.withComponentInputRequired()
            .then(result => {
                const errors = result.form.getElementErrors('input1');
                expect(result.valid).to.equal(false);
                expect(result.errors).to.deep.equal([{
                    error: 'CUSTOM_REQUIRED_ERROR',
                    class: 'component',
                    name: null,
                    path: 'component1',
                    source: {
                        class: 'input',
                        path: 'component1.input1',
                        name: '__forme_element__form1__component1__input1',
                    }
                }]);
            });
        });

        it('should call internal composed validation handlers first', function () {
            const callList = [];

            const form = new TestDriverForm({
                name: 'form1',

                //custom form compose handler
                compose: (form, page, component, details) => {
                    component.configure({
                        validate: (form, component, state) => {
                            callList.push('compose');
                        },
                    });

                    //handled!
                    return true;
                },

                //components in form
                component: {
                    name: 'component1',
                    type: 'handledByFormComposeAbove',
                    validate: (form, component, state) => {
                        callList.push('component');
                    },
                },
            });

            //execute the custom form
            return form.execute(createExpressRequest())
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result.form.getElement('component1')).to.exist;
                expect(callList).to.be.an('array').that.deep.equals(['compose', 'component']);
            });
        });
    });

    describe('#output', function () {
        it('should modify component output', function () {
            return blueprints.submit.withComponentOutput()
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result.values).to.have.nested.property('component1.input1').that.equals('CHANGED');
            });
        });

        it('should fail to modify component output', function () {
            let called = false;
            return blueprints.submit.withComponentOutputError()
            .then(result => {
                expect(result.valid).to.equal(false);
                expect(result.errors).to.be.an('array').with.lengthOf(1).and.have.nested.property('[0].error').that.equals('CUSTOM_OUTPUT_ERROR');
            });
        });
    });
});