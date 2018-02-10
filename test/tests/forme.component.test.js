"use strict";

//local imports
const {expect, TestDriverForm, createExpressRequest} = require('../testShared');

//tests
describe('Component', function () {
    describe('#create', function () {
        it('should create a form with a component', function () {
            const form = new TestDriverForm({
                name: 'testForm',
                components: [
                    {
                        type: 'componentValue2',
                        name: 'myComponent2',
                    },
                ],
            });

            //view the form
            return form.view(createExpressRequest())
            .then(result => {
                const templateVars = result.templateVars;
                expect(templateVars).to.be.an('object').that.containSubset({
                    __formeClass: 'form',
                    children: {
                        myComponent2: {
                            __formeClass: 'component',
                            children: {
                                value2: {
                                    __formeClass: 'input',
                                    alias: 'value2',
                                    type: 'text',
                                },
                            },
                        },
                    },
                });
            });
        });

        it('should create a component in a group', function () {
            const form = new TestDriverForm({
                name: 'testForm',
                components: [
                    {
                        type: 'componentValue1',
                        name: 'myComponent',
                        group: ['group1', 'group2'],
                    },
                ],
            });

            //view the form
            return form.view(createExpressRequest())
            .then(result => {
                const templateVars = result.templateVars;

                expect(templateVars).to.be.an('object').that.containSubset({
                    __formeClass: 'form',
                    children: {
                        group1: {
                            __formeClass: 'group',
                            children: {
                                group2: {
                                    __formeClass: 'group',
                                    children: {
                                        myComponent: {
                                            __formeClass: 'component',
                                            children: {
                                                value1: {
                                                    __formeClass: 'input',
                                                    alias: 'value1',
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
        it('should set a component value', function () {
            const form = new TestDriverForm({
                name: 'testForm',
                components: [
                    {
                        type: 'componentWithTwoInputs',
                        name: 'myComponent1',
                    },
                ],
            });

            //view the form
            return form.view(createExpressRequest())
            .then(result => {
                const value = result.form.getValue('myComponent1');

                var wtf = 123;
            });
        });

        it('should set a components value using a setter', function () {
            const form = new TestDriverForm({
                name: 'testForm',
                components: [
                    {
                        type: 'componentWithSetter',
                        name: 'myComponent1',
                        group: ['group1', 'sub1'],
                    },
                ],
            });

            //view the form
            return form.view(createExpressRequest())
            .then(result => {

                const values = result.form._buildValues({
                    alias: true,
                    group: true,
                    store: true,
                });

                var wtf = 123;
            });
        });
    });
});