"use strict";

//local imports
const {expect, TestDriverForm, createExpressRequest, blueprints} = require('../testShared');

//tests
describe('Base', function () {
    describe('#_buildValues', function () {
        it('should build a flat list of values from grouped structure', function () {
            return blueprints.view.withTwoGroupedInputs()
            .then(result => {
                expect(result.form._buildValues({
                    group: false,
                })).to.deep.equals({
                    element_123456: null,
                    this_is_input1_with_funky_long_name: null,
                });
            });
        });

        it('should ignore secure values', function () {
            return blueprints.view.withTwoGroupedInputsOneSecured()
            .then(result => {
                expect(result.form._buildValues({
                    group: false,
                    secure: true,
                })).to.deep.equals({
                    element_123456: null,
                });
            });
        });
    });

    describe('#tags', function () {
        it('should tag inputs', function () {
            return blueprints.view.withThreeTaggedInputs()
            .then(result => {
                expect(result.form.getTaggedElementValuesFlattened(['tag1'])).to.deep.equal({
                    input1: 'value1',
                });

                expect(result.form.getTaggedElementValuesFlattened(['multiple'])).to.deep.equal({
                    input2: 'value2',
                    input3: 'value3',
                });
            });
        });

        it('should remove duplicate tags', function () {
            return blueprints.view.withThreeTaggedInputs()
            .then(result => {
                const element = result.form.getElement('group1.group2.group3.input3');
                expect(element.getTags()).to.deep.equal(['tag3', 'multiple']);
            });
        });

        it('should not have tags', function () {
            return blueprints.view.withThreeTaggedInputs()
            .then(result => {
                expect(result.form.getTaggedElements(['DOESNT', 'EXIST'])).to.be.an('array').with.length(0);
            });
        });

        it('should have all tags (AND)', function () {
            return blueprints.view.withThreeTaggedInputs()
            .then(result => {
                expect(result.form.getTaggedElementValuesFlattened(['tag3', 'multiple'], false)).to.deep.equal({
                    input3: 'value3',
                });
            });
        });

        it('should have any tags (OR)', function () {
            return blueprints.view.withThreeTaggedInputs()
            .then(result => {
                expect(result.form.getTaggedElementValuesFlattened(['tag3', 'tag1'], true)).to.deep.equal({
                    input1: 'value1',
                    input3: 'value3',
                });
            });
        });

        it('should match all tags with wildcard', function () {
            return blueprints.view.withThreeTaggedInputs()
            .then(result => {
                expect(result.form.getTaggedElementValuesFlattened('*')).to.deep.equal({
                    input1: 'value1',
                    input2: 'value2',
                    input3: 'value3',
                });
            });
        });

        it('should match all tags with wildcard (passed as array)', function () {
            return blueprints.view.withThreeTaggedInputs()
            .then(result => {
                expect(result.form.getTaggedElementValuesFlattened(['*'])).to.deep.equal({
                    input1: 'value1',
                    input2: 'value2',
                    input3: 'value3',
                });
            });
        });

        it('should match all tags when doing AND with wildcard', function () {
            return blueprints.view.withThreeTaggedInputs()
            .then(result => {
                expect(result.form.getTaggedElementValuesFlattened(['tag3', '*'], false)).to.deep.equal({
                    input1: 'value1',
                    input2: 'value2',
                    input3: 'value3',
                });
            });
        });

        it('should match all tags when doing OR with wildcard', function () {
            return blueprints.view.withThreeTaggedInputs()
            .then(result => {
                expect(result.form.getTaggedElementValuesFlattened(['tag3', '*'], true)).to.deep.equal({
                    input1: 'value1',
                    input2: 'value2',
                    input3: 'value3',
                });
            });
        });

        it('should match all elements tagged with wildcard', function () {
            return blueprints.view.withFourTaggedInputsTwoWildcard()
            .then(result => {
                expect(result.form.getTaggedElementValuesFlattened(['DOESNT_EXIST'])).to.deep.equal({
                    input1: 'value1',
                    input3: 'value3',
                });
            });
        });

        it('should match all elements tagged with wildcard plus 1 other tag (OR)', function () {
            return blueprints.view.withFourTaggedInputsTwoWildcard()
            .then(result => {
                expect(result.form.getTaggedElementValuesFlattened(['DOESNT_EXIST', 'tag4'], true)).to.deep.equal({
                    input1: 'value1',
                    input3: 'value3',
                    input4: 'value4',
                });
            });
        });

        it('should only match elements tagged with wildcard (AND)', function () {
            return blueprints.view.withFourTaggedInputsTwoWildcard()
            .then(result => {
                expect(result.form.getTaggedElementValuesFlattened(['DOESNT_EXIST', 'tag4'], false)).to.deep.equal({
                    input1: 'value1',
                    input3: 'value3',
                });
            });
        });

        it('should get flattened tagged element values', function () {
            return blueprints.view.withThreeTaggedInputs()
            .then(result => {
                expect(result.form.getTaggedElementValuesFlattened(['tag3', 'tag1'])).to.deep.equal({
                    input1: 'value1',
                    input3: 'value3',
                });
            });
        });

        it('should get grouped tagged element values', function () {
            return blueprints.view.withThreeTaggedInputs()
            .then(result => {
                expect(result.form.getTaggedElementValuesGrouped(['tag3', 'tag1'])).to.deep.equal({
                    group1: {
                        group2: {
                            group3: {
                                input3: 'value3'
                            },
                            input1: 'value1',
                        }
                    }
                });
            });
        });
    });
});