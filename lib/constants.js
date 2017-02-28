'use strict';

module.exports = {
    actions: {
        prev: 'forme:prev',
        next: 'forme:next',
        reset: 'forme:reset',
        submit: 'forme:submit',
    },
    dev: process.env.NODE_ENV == 'dev' || process.env.NODE_ENV == 'development',
};
