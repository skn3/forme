"use strict";

//local imports
const {expect, TestDriverForm, createExpressRequest} = require('../testShared');
const utils = require('../../lib/utils');

//tests
describe('Utils', function () {
    describe('#structure', function () {
        it('should find a path in structure using a path string', function () {
            const form = new TestDriverForm({
                name: 'testForm',
                inputs: [
                    {
                        type: 'text',
                        name: 'myInput1',
                        group: ['group1', 'group2'],
                    },
                    {
                        type: 'text',
                        name: 'myInput2',
                        group: ['group1'],
                    },
                    {
                        type: 'text',
                        name: 'myInput3',
                        group: ['group1', 'group2', 'group3'],
                    },
                ],
            });

            //view the form
            return form.view(createExpressRequest())
            .then(result => {
                const structure = result.templateVars;
                const pointer = utils.structure.find.path(structure, 'group1.group2');

                expect(result.inputs).to.be.an('array').that.has.lengthOf(3);
                expect(pointer).to.containSubset({
                    __formeClass: 'group',
                    children: {
                        group3: {
                            __formeClass: 'group',
                            children: {},
                        }
                    },
                });
            });
        });

        it('should find a path in structure using a path array', function () {
            const form = new TestDriverForm({
                name: 'testForm',
                inputs: [
                    {
                        type: 'text',
                        name: 'myInput1',
                        group: ['group1', 'group2'],
                    },
                    {
                        type: 'text',
                        name: 'myInput2',
                        group: ['group1'],
                    },
                    {
                        type: 'text',
                        name: 'myInput3',
                        group: ['group1', 'group2', 'group3'],
                    },
                ],
            });

            //view the form
            return form.view(createExpressRequest())
            .then(result => {
                const structure = result.templateVars;
                const pointer = utils.structure.find.path(structure, ['group1', 'group2']);

                expect(result.inputs).to.be.an('array').that.has.lengthOf(3);
                expect(pointer).to.containSubset({
                    __formeClass: 'group',
                    children: {
                        group3: {
                            __formeClass: 'group',
                            children: {},
                        }
                    },
                });
            });
        });
    });

    describe('#object', function () {
        it('should add path segments to empty object', function () {
            const obj = {};

            utils.object.add.path(obj, 'node1.subNode.endPoint');
            expect(obj).to.deep.equal({
                node1: {
                    subNode: {
                        endPoint: {},
                    }
                }
            });
        });

        it('should add path segments overlapping object', function () {
            const obj = {
                node1: {
                    subNode: {
                        existingHere: {},
                    },
                },
            };

            utils.object.add.path(obj, 'node1.anotherSub.blahBlah');
            expect(obj).to.deep.equal({
                node1: {
                    anotherSub:{
                        blahBlah: {},
                    },
                    subNode: {
                        existingHere: {},
                    }
                },
            });
        });

        it('should add path segments replacing value', function () {
            const obj = {
                node1: {
                    wasAValue: 'hello world',
                },
            };

            utils.object.add.path(obj, 'node1.wasAValue.nestedWee');
            expect(obj).to.deep.equal({
                node1: {
                    wasAValue:{
                        nestedWee: {},
                    },
                },
            });
        });

        it('should find path in object', function () {
            const obj = {
                node1: {
                    sub1: {
                        defaultValue: 'one',
                        other: 'hello',
                    },
                    sub2: {
                        defaultValue: 'two',
                        other: 'world',
                    },
                    other: 't00t!',
                },
                other: 'uuhhh nottingham!?',
            };

            const pointer = utils.object.find.path(obj, 'node1.sub2');
            expect(pointer).to.deep.equal({
                other: 'world',
                defaultValue: 'two',
            });
        });

        it('should fail to find path in object', function () {
            const obj = {
                node1: {
                    sub1: {
                        defaultValue: 'one',
                        other: 'hello',
                    },
                    sub2: {
                        defaultValue: 'two',
                        other: 'world',
                    },
                    other: 't00t!',
                },
                other: 'uuhhh nottingham!?',
            };

            const pointer = utils.object.find.path(obj, 'node1.subNotAtHome');
            expect(pointer).to.equal(undefined);
        });
    });
});