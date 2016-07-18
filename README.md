# Forme

Forme has been designed to offer a sane way for handling forms in nodejs. A form can be built to handle a user input or even manage data from api requests. Forme does not dictate to you how a form should build, process or render. With forme you can handle forms in the way that suites you.

Your form object is created in such a way that it can be reused for multiple instances of that form. The request object will be used to store any live data when processing a particular instance of the form. You can also create a form per request if you need to add a dynamic set of fields.

Forme has no concept of rendering but does provide a simple way to build an template vars. The object containing all the variables can then be passed to the appropriate templating engine of choice.

- Create static or dynamic form objects to handle input in a generic fashion.
- Easily apply built in input handlers to process and validate your data.
- Integrate into the templating system of your choice.
- Not limited to any specific frameworks.
- Semi-Automatic session data handling using extendable session handler. 

The project is still in development so use with caution, however the functionality is there so feel free to have a play!

## Example

A simple static login form.

**setup the static form**
```javascript
var forme = require('forme');

var form = forme('login');
form.add('username').label('Username').require().is('username');
form.add('password').label('Password').require().secure();
```

**render the form (using pug/jade)**
```javascript
var pug = require('pug');

form.view(request, function() {
    var options = {};
    var locals = form.template();
    
    //render
    var html = pug.renderFile('login.pug', merge(options, locals));
});
```

**pug template (using bootstrap)**
```pug
div.panel.panel-default
    div.panel-heading Login
    div.panel-body
        form(name=forme.login.form.name, method=forme.login.form.method)
            div.form-group
                input.form-control(type='text', name=forme.login.input.username.name, placeholder='Username', value=forme.login.input.username.value)

            div.form-group
                input.form-control(type='password', name=forme.login.input.password.name, placeholder='Password', value=forme.login.input.password.value)

            input.btn.btn-primary(type='submit', value='Login')
```

**process the form (using)**
```javascript
form.validate(request, function(validated, values, errors){
    if (!validated) {
        //form validation failed, redirect back to login form
    } else {
        //form validated, so try login 
        if (!login(values.username, values.password)) {
            //failed, so store form data using session handler
            form.store(req, function(){
                //redirect back to login form
            });
        } else {
            //success, do something here
        }
    }
});
```

## Input API
- **.value(** value, *[error]* **)** - sets the default value of this input
- **.label(string)** - sets the inputs label used in error messages and template vars
- **.require(** value, *[error]* **)** - makes sure the input value exists when validated
- **.size(** size, *[error]* **)** - the input value has to be exactly this size when validated
- **.min(** size, *[error]* **)** - the input value has to be at least exactly this size when validated
- **.max(** size, *[error]* **)** - the input value has to be at no greater than this size when validated
- **.is(** string, *[error]* **)** - ensures the input value is of a particular *type* when validated. Uses [validator](https://github.com/chriso/validator.js)
- **.options(** array/object, *[error]* **)** - ensures the input is one of the specified values when validating. Also provides values to the template vars
- **.callback(** function **)** - allows custom callback to be executed upon validation
- **.secure()** - prevents storing of this value between page views/sessions
- **.bool()** - converts the value to a bool
- **.int()** - converts the value to an int
- **.string()** - converts the value to a string
- **.float()** - converts the value to a float
- **.group(** string **)** - specifies a group name for values and template vars. When multiple inputs have the same group name, forme will convert these entries to an object with properties
- **.permanent(** value **)** - forces the input to always have this value


## Form API
- **.require(** array/object, operator, *[error]* **)** - and/or validation on single, multiple or groups of inputs 