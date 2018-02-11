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
    });

    describe('#values', function () {
        it('should get the value of a multi input component', function () {
            return blueprints.view.withMultiInputComponentWithDefaultValues()
            .then(result => {
                const value = result.form.getElementValue('component1');
                expect(value).to.deep.equal({
                    input1: 'default1',
                    input2: 'default2',
                });
            });
        });
    });

    describe('#values', function () {
        it('should set a component value', function () {
            const form = new TestDriverForm({
                name: 'testForm',
                components: [
                    {
                        type: 'componentWithTwoInputs',
                        name: 'component1',
                    },
                ],
            });

            //view the form
            return form.view(createExpressRequest())
            .then(result => {
                const value = result.form.getNamedValue('component1');

                var wtf = 123;
            });
        });
    });
});