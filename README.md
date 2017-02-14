# Forme

Forme has been designed to offer a sane way for handling forms in nodejs using **promises**. A form can be built to handle a user input or even manage data from api requests. Forme does not dictate to you how a form should build, process or render. With forme you can handle forms in the way that suites you.

Your form object is created in such a way that it can be reused for multiple instances of that form. The request object will be used to store any live data when processing a particular instance of the form. You can also create a form per request if you need to add a dynamic set of fields.

Forme has no concept of rendering but does provide a simple way to build your template vars. The object containing all the variables can then be passed to the appropriate templating engine of choice.

- Create static or dynamic form objects to handle input in a generic fashion.
- Easily apply built in input handlers to process and validate your data.
- Integrate into the templating system of your choice.
- Not limited to any specific frameworks.
- Semi-Automatic session data handling using extendable session handler. 

The project is still in development so use with caution, however the functionality is there so feel free to have a play!


## Index

**Topics**
- [Custom Errors](#customErrors)
- [Input Type](#inputType)
- [Form Require Validation (and/or)](#formRequireValidation)
- [Grouping and Referencing Inputs](#groupingAndReferencingInputs)
- [Custom Form Validation](#customFormValidation)
- [Custom Input Validation](#customInputValidation)
- [Custom Submit Handling](#customSubmitHandling)
- [Order of Validation](#orderOfValidation)
- [Validation in final .then()](#validationInFinalThen)

**API/Reference**
- [Form](#apiForm)
- [Input](#apiInput)

**Examples**
- [Static Form](#staticFormExample)
- [Dynamic Form](#dynamicFormExample)
- [API Form](#apiFormExample)
- [Validate The Form](#validateExample)


## <a name="customErrors"></a> Custom Errors 

Many input methods allow you to provide a custom error string. For example:
```javascript
const forme = require('forme');

const form = forme('login').post('form/process.html');
form.add('username').label('Username').require().is('username','{label} is invalid');
```

You can see see in this example we have added a second argument *'{label} is invalid'* to the **.is()** method. This is our custom error that will be returned should the input fail the **.is()** test. Custom error messages can contain placeholder tokens, which will be automatically converted to useful information.
 
You can also use placeholder tokens with a small selection of form methods. For example when you call `form.validate(callback, error)`.
 
**Form Placeholder tokens:**
- **{label}** the current label for the form, defined with **form.label('My Label')**
- **{name}** the current name for the form. This is the machine-name for the form.
 
**Input Placeholder tokens:**
- **{label}** the current label for this input, defined with **input.label('My Label')**
- **{name}** the current name for this input. This is the machine-name for the input.


## <a name="inputType"></a> Input Type 

Forme will intelligently try to guess the input 'type' you have defined. It does this by looking at the API's you have called on the input. You can override the type by calling **.type('email')**. The type is only used when returning the template vars with **forme.template()**, it does not alter how forme handles the input.

When Forme is guessing the input type, it lets the most recently called API take precedence. So for example if we call **.is('email')** and then **.secure()**, the guessed type will be *'password'* and not *'email'*. 

As well as your type being defined by various methods that you have called, the following rules exist. The rules are checked in order, when one of these conditions is met, subsequent conditions are ignored.

- If you have called **.hidden()** on an input, then the type will always return *'hidden'* *(unless overridden with .type())*.
- If you have called **.checked()** on an input, then the type will always return *'checkbox'* *(unless overridden with .type())*.
- If you have called **.secure()** on an input, then the type will always return *'password'* *(unless overridden with .type())*.

**Examples**
```javascript
form.add('some_input').label('Some Input').int() //type="number";
form.add('some_input').label('Some Input').checked() //type="checkbox";
form.add('some_input').label('Some Input').secure() //type="password";
form.add('some_input').label('Some Input').is('email') //type="email";
form.add('some_input').label('Some Input').is('email').secure() //type="password";
form.add('some_input').label('Some Input').is('email').secure().type('date') //type="date";
```

## Form.Require() Validation <a name="formRequireValidation"></a>

When you specify **form.require(*conditions, op*)** for a form, you are telling Forme to apply input requirement tests upon validation. This lets you do and/or tests on specific sets of inputs. For each call to **.require()** the form MUST pass that particular test; so if you had multiple .require() then they would all have to pass.
 
```javascript
const forme = require('forme');
const form = forme('login').post('form/process.html').require([['input1'],['input2']],'or');
```
 
When we call **.require()** we provide conditions to match and also an operator to match them with. Conditions are defined like so:
```javascript
const conditions = [
    //group1
    [
        'input1',
        'input2',
    ],
    
    //group2
    [
        'input1',
        'input3',         
    ]
];

const forme = require('forme');
const form = forme('login').post('form/process.html').require(conditions,'or');
```
 
The above example translates to hte following conditional check:
```javascript
if ((input1.Length && input2.Length) || (input1.Length && input3.Length)) {
}
```

If we changed the op to **'and'** then it would be the equivalent of:
```javascript
if ((input1.Length || input2.Length) && (input1.Length || input3.Length)) {
}
```

## <a name="groupingAndReferencingInputs"></a> Grouping and Referencing inputs

Forme lets you add inputs to groups and it lets you set aliases. With these two powerful mechanisms we can have our value data and output generated in a clean way. For example:

```javascript
const forme = require('forme');
const form = forme('some_form');
 
//add 10 unique inputs
for(let index = 0;index < 3;index++) {
   form.add('items__'+index+'__field1').label('Field1').group(['items','item_'+index]).alias('field1').value('foo');
   form.add('items__'+index+'__field2').label('Field2').group(['items','item_'+index]).alias('field2').value('bar');
}
```

You can see in this example we are creating 3 sets of inputs each with a unique name. Now we could go ahead and reference this input using that name, but that's not entirely sane for long term development.
Instead, we are specifying a `.group()` and `.alias()` for this input. You can chain multiple `.group('a').group('b').group('c')` or provide an array of strings. 

When forme generates some form of output, it will now group the values using whatever has been defined. So continuing from the example above:

```javascript
form.validate(storage)
.then((result) => {
    console.log(result.values);
});
```

This would produce the following output:

```javascript
   {
       items: {
           item_0: {
               field1: 'foo',
               field2: 'bar',
           },
           item_1: {
               field1: 'foo',
               field2: 'bar',
           },
           item_2: {
               field1: 'foo',
               field2: 'bar',
           }
       }
   };
```

The final piece of the puzzle is how do we now refer to these grouped/aliased inputs? Simple, we just use the group/alias in any function that lets us reference an input. For example:
 
```javascript
const field1 = form.value(storage,'items.item_0.field1');
const field2 = form.value(storage,['items','item_0','field2']);
```

We can pass a group path as a string separated with `.`, or an array of group segments. The final segment/part of the group should be the alias or name of the input you are referencing.

## <a name="customFormValidation"></a> Custom Form Validation 

Forme lets you define custom form validation for doing more complex data checking. Using the form.validate(callback, error) method, we can allow a custom callback to execute.

**Caution: form.validate() is also used to validate a submitted form when a request object is passed in. Make sure you are calling this with the correct arguments.**

**example of custom validation**
```javascript
const forme = require('forme');

const form = forme('test').post('form/process.html');

form.add('value1');
form.add('value2');

form.validate((storage, form, state) => {
	//our custom validate handler must return a promise
	//we can also reject with a custom error message.
	if (state.values.value1 == 'database' || state.values.value2 == 'database') {
	    return Promise.reject(new FormeError('form contained a reserved word'));
 	} else {
 	    return Promise.resolve();
 	}
 }, 'Invalid values');
```

Notice in the example above we are using promise resolve / reject to indicate the result. This allows us to perform async operations and signal to forme when we know the answer. If we dont return a promise, forme will assume the result was positive.

**state object**

The custom form validation callback receives a state object. This consists of:
 - **values** - an object containing the current form values.

**custom errors**

If you would like to provide a custom error message from within the callback, simply reject the promise with your custom message. We can use the same placeholder tokens as described in the [Custom Errors](#customErrors) section.

**overriding the submitted value**

If you want to alter the submitted values within your callback, simply modify `state.values`. 
 
 
## <a name="customInputValidation"></a> Custom Input Validation 

Forme lets you define custom input validation for doing more complex data checking. Using the input.validate() method, we can allow a custom callback to execute.

**example of custom validation**
```javascript
const forme = require('forme');

const form = forme('login').post('form/process.html');
form.add('username').label('Username').placeholder('User').require().is('username')
.validate((storage, form, input, state) => {
	//our custom validate handler must return a promise
	//we can also reject with a custom error message.
	return database.user.load(state.value)
	.then(user => {
		if (user) {
			//resolve the promise to indicate that we have successfully validated
			return Promise.resolve();
		} else {
			//reject the promise to indicate the user doesnt exist.
			return Promise.reject(new Error('invalid user'));
		}
	});
}, 'Invalid user');
```
Notice in the example above we are using promise resolve / reject to indicate the result. This allows us to perform async operations and signal to forme when we know the answer. If we dont return a promise, forme will assume the result was positive.

**state object**

The custom input validation callback receives a state object. This consists of:
 - **value** - the current input value.

**custom errors**

If you would like to provide a custom error message from within the callback, simply reject the promise with your custom message. We can use the same placeholder tokens as described in the [Custom Errors](#customErrors) section.

**overriding the submitted value**

If you want to alter the submitted value within your callback, simply modify the `state.value`. 


## <a name="customSubmitHandling"></a> Custom Submit Handling 

Forme lets you specify callback routines to be called on your form/inputs once the entire form has validated successfully. To add a submit handler to an input simply use the `input.submit()` api. To add a submit handler to a form use `form.submit()`. With the `.submit()` handler we have the ability to do execute our own code, just before the form returns back to your main validate callback. 

**example of custom input submit handler**
```javascript
const forme = require('forme');

const form = forme('login').post('form/process.html');
form.add('title').label('Title').placeholder('page title').require()
.submit((storage, form, input) => {
    //our custom submit handler must return a promise
    
	//lets check for reserved word in title
	if (input.value(storage) == 'admin') {
	    //rename this page
	    input.value(storage, input.value(storage)+ 'renamed');
	}
	
	//finished submit
	return Promise.resolve();
});
```
Notice in the example above we are using `Promise.resolve()` to indicate that we are done. This allows us to perform async operations using promises and then signal to forme when we are finished. We could also return a long running promise (`return new Promise(function(resolve, reject)){});`) and forme will wait for this to complete before continuing. If we dont return a promise, forme will assume the result was positive.

**example of custom form submit handler**
```javascript
const forme = require('forme');

const form = forme('login').post('form/process.html').submit((storage, form) => {
    //do something here
    return Promise.resolve();
});
```

## <a name="orderOfValidation"></a> Order of Validation 

Forme has a super sensible order of execution. The order is as follows:

1. call `form.submit(storage)`
2. iterate over each input and execute all validate handlers in order defined. This includes execution of `input.validate()` and `input.handler()`
3. execute all form validate handlers in order defined. This includes execution of `form.validate()` and `form.require()`
4. iterate over all inputs and execute their `input.submit()` handlers. The order in which you called `input.submit()`, is the order in which they are executed.
5. execute all `form.submit(callback)` handlers. The order in which you called `form.submit(callback)`, is the order in which they are executed.
6. execute all `form.action(action, callback)` handlers. The order in which you called `form.action(action, callback)`, is the order in which they are executed.
7. return promise to `form.submit(storage).then(result => {})`.

During the above execution order, forme might fail the process and skip to step 7. The result will contain `result.validated = false`.

## Validation/form error in your final `validate.then()` <a name="validationInFinalThen"></a>

Forme provides more sensible ways to add custom validation code, but if you want to validate in the final step and produce an error, then you will have to manually `.store()` the form.

**validate the form (using express)**
```javascript
function route(storage, res, next) {
    return form.validate(storage)
    .then(result => {    
        if (!result.validated) {
            //form validation failed, redirect back to login form
            res.redirect('back');
        } else {
            //form validated, so try something custom here (should really be using input.validate())
            if (!doSomethingGood()) {
                //failed, so store form data using session handler
                result.form.error(storage, 'some validation error');
                
                return result.form.store(result.storage)
                .then(result => {
                    //redirect back to login form
                    res.redirect('back');
                });
            } else {
                //success, do something here
            }
        }
    });
}
```

## <a name="staticFormExample"></a> Static Form Example 

A simple static login form.

**setup the static form**
```javascript
const forme = require('forme');

const form = forme('login').post('form/process.html');
form.add('username').label('Username').placeholder('User').require().is('username');
form.add('password').type('password').label('Password').placeholder('Password').require().secure();
```

**render/view the form (using pug/jade)**
```javascript
const pug = require('pug');

form.view(request)
.then(result => {
    const options = {};
    const locals = result.form.template();
    
    //render
    const html = pug.renderFile('login.pug', merge(options, locals));
});
```

The `form.view().then()` result object contains:
- **.storage** - original request object
- **.form** - the forme object

**pug template (using bootstrap)**
```pug
div.panel.panel-default
    div.panel-heading Login
    div.panel-body
        form(name=forme.login.form.name, method=forme.login.form.method, action=forme.login.form.action)
            div.form-group
                input.form-control(type=forme.login.input.username.type, name=forme.login.input.username.name, placeholder=forme.login.input.username.placeholder, value=forme.login.input.username.value)

            div.form-group
                input.form-control(type=forme.login.input.password.type, name=forme.login.input.password.name, placeholder=forme.login.input.password.placeholder, value=forme.login.input.password.value)

            input.btn.btn-primary(type='submit', value='Login')
```

**validate the form**
```javascript
form.validate(request)
.then(result => {    
    if (!result.validated) {
        //form validation failed, redirect back to login form
    } else {
        //form validated, so try login 
        if (!login(result.values.username, result.values.password)) {
            //failed, so store form data using session handler
            result.form.store(result.storage)
            .then(result => {
                //redirect back to login form
            });
        } else {
            //success, do something here
        }
    }
});
```

The `form.validate().then()` result object contains:
- **.storage** - original request object
- **.form** - the forme object
- **.validated** - true or false, did the form validate
- **.values** -  object map of submitted/validated values,
- **.errors** -  array of errors produced,

The `form.store().then()` result object contains:
- **.storage** - original request object
- **.form** - the forme object

## <a name="dynamicFormExample"></a> Dynamic Form Example 

An example of creating a dynamic form.

**combined code snippets for dynamic form**
```javascript
const forme = require('forme');

//form constructor function
function myForm(numFields) {
    //create form
    const form = forme('dynamicFormExample').post('form/process.html');
    
    //save number of fields in context for useful access to it later
    form.context('numFields', numFields);
    
    //add dynamic number of fields
    for(let index = 0; index < numFields; index++) {
        form.add('field_'+index).label('Field '+index);
    }
    
    //done
    return form;
}

//view the form
myForm(10).view(request)
.then((result) => {
    const numFields = result.form.context('numFields');
    
    //construct some crude html dynamically (better off doing this in templating engine)
    let html = '';
    for(let index = 0; index < numFields; index++) {
        let fieldName = 'field_'+index;
        html += '<input name="'+fieldName+'" value="'+result.form.value(result.storage, fieldName)+'" type="text" />';
    }
});

//validate the form
myForm(10).validate(request)
.then(result => {
    const numFields = result.form.context('numFields');
    
    //validate all fields
    for(let index = 0; index < numFields; index++) {
        if (result.values['field_'+index] == 69) {
            //redirect back, this number is too racey!
        }
    }
});
```

## <a name="apiFormExample"></a> API Form Example 

Use forme to handle your API data

**setup the api and then validate it**
```javascript
const forme = require('forme');

const api = forme('api_do_something');
api.add('field1').require().int();
api.add('field2').require().float();

api.validate(request, {
    field1: 123,
    field2: 4.567,
})
.then(result => {
    let json = null;
    
    if (!result.validated) {
        json = { succes: false };
    } else {
        json = { succes: true };
    }
    
    //send the json back to the user
    console.log(json);
});
```

Notice how we can pass values to the `form.validate(storage, values)` call.


## <a name="apiInput"></a> Input API 
- **.id(** string **)** - override the id that is generated for template vars. If no id id set the default id will be *'forme_input__[input.name]'* (minus square brackets)
- **.className(** string/array **)** - adds a className(s) to the input *(only used in form.template())* 
- **.label(** string **)** - sets the inputs label used in error messages and template vars
- **.help(string)** - sets the inputs help text *(only used in form.template())*  
- **.require(** value, *[error]* **)** - makes sure the input value exists when validated
- **.size(** size, *[error]* **)** - the input value has to be exactly this size when validated
- **.min(** size, *[error]* **)** - the input value has to be at least exactly this size when validated
- **.max(** size, *[error]* **)** - the input value has to be at no greater than this size when validated
- **.is(** string, *[error]* **)** - ensures the input value is of a particular *type* when validated. Uses [validator](https://github.com/chriso/validator.js)
- **.match(** string, *[error]* **)** - ensures the input value matches the target input value when validated.
- **.options(** array/object, *[error]* **)** - ensures the input is one of the specified values when validating. Also provides values to the template vars
- **.blacklist(** array, *[error]* **)** - value must not be one of the provided values
- **.validate(** promise/handler, *[error]* **)** - allow for custom validation routines to be added to inputs
- **.submit(** promise/handler **)** - allow for custom submit routines to be added to inputs. These are called in order just before a valid form returns to your main validate function
- **.handler(** promise/handler **)** - allows custom handler callback to be executed upon validation. Please use .validate() instead
- **.secure(** *[flag]* **)** - prevents storing of this value between page views/sessions
- **.checked(** *[flag]* **)** - sets a checkbox defaults checked state
- **.readonly(** *[flag]* **)** - set input template var *readonly* *(currently only used in form.template() vars. e.g. &lt;input readonly /&gt;)*
- **.hidden(** *[flag]* **)** - set input template var *type* to *'hidden'* *(currently only used in form.template() vars. e.g. &lt;input readonly /&gt;)*
- **.type(** string **)** - override input template var *type*. By default forme will guess a type based on the input properties that you have defined. 
- **.bool()** - converts the value to a bool
- **.int()** - converts the value to an int
- **.string()** - converts the value to a string
- **.float()** - converts the value to a float
- **.group(** string/array **)** - specifies a group for values and template vars. Forme will automatically group value/template information when you specify a group, even if there is only 1 item in the group. You can chain multiple calls to .group() or provide an array of group names. This allows you to create groups at any depth.
- **.alias(** string **)** - lets you override the *name* of the input when built in template vars or form.values(). Forme still uses the inputs real name internally.
- **.permanent(** value **)** - forces the input to always have this value
- **.context(** string, value **)** - store a named context value in this input. *(Accessible in form.template() and input.validate())*
- **.context(** string **)** - retrieve a named context value from this input. *(Accessible in form.template() and input.validate())*
- **.value(** value **)** - sets the default value of this input
- **.value(** storage **)** - get the current value for this input using the request object
- **.value(** storage, value **)** - set the current value for this input using the request object
- **.pipe(** false/true/string **)** - pipe errors generated for this input to a specified target. (false: to self, true: to form, string: to input with matching name. The string can also be any string, these errors can be retrieved with `form.errors(storage, 'name')`)


## <a name="apiForm"></a> Form API 
- **.name(** string **)** - change the form's name
- **.label(** string **)** - sets the forms label used in error messages and template vars
- **.get(** string **)** - set the form to get and specify the action address
- **.post(** string **)** - set the form to post and specify the action address *(a form will default the method to POST)*
- **.session(** sessionHandler **)** - set the session handler to use. If called with no arguments *(e.g. .session())* then the default session handler will be used. Forms will use teh default session handler unless changed.
- **.require(** array/object, operator, *[error]* **)** - and/or validation on single, multiple or groups of inputs
- **.add(** string **)** - add a new input to the form with the given name
- **.context(** string, value, *[template]* **)** - store a named context value in this form. *(accessible in form.template() and anywhere we have the form object)*
- **.context(** string **)** - retrieve a named context value from this form. *(accessible in form.template() and anywhere we have the form object)*
- **.view(** storage, *[values]* **)** - process viewing the form and then return a promise. An object of values can be provided as the second argument. This will replace all non permanent values when processing the form.
- **.validate(** storage object, *[values]* **)** - process validating the form and then return a promise. An object of values can be provided as the second argument. This will replace all non permanent values when processing the form.  
- **.validate(** function, *[error]* **)** - allow for custom validation routines to be added to form
- **.store(** storage **)** - process storing the form session and then return a promise
- **.submit(** promise/handler **)** - allow for custom submit routines to be added to the form. These are called in order just before a valid form returns to your main validate function
- **.values(** storage **)** - get all the current values for a submitted form
- **.value(** storage, input/string/path **)** - get the current submitted value for a specific input. 
- **.value(** storage, input/string/path, value **)** - set the current submitted value for a specific input
- **.error(** storage, error **)** - add an error to the form
- **.error(** storage, input/string/path, error **)** - add an error to something that is named. This does not need to be the name of an input, if no match is found, the error will be added to the form and will retain the name you specified.
- **.inputs()** - returns an array of all the input names
- **.template(** **)** - builds all template vars for the form
- **.errors(** storage, *[name]* **)** - gets all errors in the form. If a name is provided, then only errors with that matching name are returned. Name can be an input name, or name defined in input.pipe().