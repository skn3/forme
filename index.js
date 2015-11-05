'use strict';

var promiserate = require('promiserate');

class Form {
	constructor(inputs) {
		this.inputs = {};
		this.errors = [];
	}

	//form api
	process(values) {
		var form = this;

		return new Promise(function (resolve, reject) {
			//read input values and dump them into their correct input objects

			//validate the form
			validate();

			//return the errors
			resolve(form.errors);
		});
	}

	//internal
	validate() {
		var form = this;

		//wrapper promise so we can return a good result!
		return new Promise(function (resolve, reject) {
			//iterate over all inputs
			return promiserate(form.inputs, function (index, input) {
					//validate each input
					return input.validate();
				})
				.then(function () {
					//finished iterating
					resolve();
				})
				.catch(function (err) {
					//error in form (unknown)
					form.addError(err.message);
					resolve();
				});
		}).then(function () {
			//lets pass it to the next then!
			return form;
		});
	}

	//error api
	addError(message) {
		var err = {
			message: message,
			input: null,
		};

		//add to self
		this.errors.push(err);
	}

	hasError() {
		return this.errors.length > 0;
	}

	//input api
	add(input) {
		input.form = this;
		this.inputs[input.id] = input;
	}

	//express api
	express(options) {
		var form = this;

		//middleware handler!
		return function (req, res, next) {
			//add form object to request
			req.form = form;

			//handle the process
			form.process(req.body).then(function (errors) {
				//next handler
				next();
			});
		}
	}
}

class Input {
	constructor(options) {
		//fields
		this.errors = [];
		this.value = '';

		//get details passed in
		this.form = null;
		this.type = 'input';
		this.id = options.id || '';
		this.title = options.title || options.name || options.id || '';
		this.name = options.name || '';
		this.validateCallbacks = options.validate || [];
	}

	//validation api
	validate() {
		var input = this;

		console.log('validate.input: ' + this.id);

		//iterate over all validation options
		return promiserate(this.validateCallbacks, function (callback, options) {
			var func = input['validate' + utils.capitalizeFirst(callback)];

			if (typeof func === 'function') {
				//valid
				//call the func with the correct context
				return func.call(input, options);

			} else {
				//invalid validate func
				reject(Error('invalid validation callback'));
			}
		}).catch(function (err) {
			//we catch any errors and add them as form errors
			//this means that the form can properly iterate over inputs and use the reject mechanism
			input.addError(err.message);
		});
	}

	validateRequired(required) {
		var input = this;
		console.log('validate.required: ' + input.id);
		return new Promise(function (resolve, reject) {
			if (required && input.value.length == 0) {
				reject(Error('The ' + input.title + ' is required.'));
			} else {
				resolve();
			}
		});
	}

	validateSize(options) {
		var input = this;
		console.log('validate.size');
		return new Promise(function (resolve, reject) {
			//crate options
			if (typeof options !== 'object') {
				options = {
					min: options
				};
			}
			options.min = options.min || 0;
			options.max = options.max || 0;

			//check
			if (options.min > 0 && input.value.length < options.min) {
				//min
				reject(Error('The ' + input.title + ' is too short. It must be at least ' + options.min + ' characters long.'));

			} else if (options.max > 0 && input.value.length > options.min) {
				//max
				reject(Error('The ' + input.title + ' is too long. It must be at most ' + options.min + ' characters long.'))
			}

			//success
			resolve();
		});
	}

	//error api
	addError(message) {
		var err = {
			message: message,
			input: this,
		};

		//add to form
		this.form.errors.push(err);

		//add to self
		this.errors.push(err);
	}

	hasError() {
		return this.errors.length > 0;
	}
}

class InputText extends Input {
	constructor(options) {
		super(options);
		this.type = 'text';
	}
}

class InputPassword extends Input {
	constructor(options) {
		super(options);
		this.type = 'password';
	}
}

//public
module.exports = function (options) {
	return new Form(options);
};

//input class (for extending)
module.exports.Input = Input;

//input types
module.exports.Text = function (options) {
	return new InputText(options);
};

module.exports.Password = function (options) {
	return new InputPassword(options);
};