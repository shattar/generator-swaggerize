'use strict';

function jsFriendlyJSONStringify(value, replacer, space) {
    return JSON.stringify(value, replacer, space).
        replace(/\u2028/g, '\\u2028').
        replace(/\u2029/g, '\\u2029');
}

function genObject(objectSchema) {
    if (!objectSchema.hasOwnProperty('type') || objectSchema.type === 'object') {
        var obj = {};
        Object.keys(objectSchema.properties).forEach(function(key, index) {
            obj[key] = genObject(objectSchema.properties[key]);
        });
        return obj;
    } else if (objectSchema.type === 'array') {
        return [genObject(objectSchema.items)];
    } else {
        if (objectSchema.enum) {
            return objectSchema.enum[0];
        } else {
            switch (objectSchema.type) {
                case 'integer':
                    return 1;
                case 'number':
                    return 1.0;
                case 'string':
                    switch (objectSchema.format) {
                        case 'binary':
                            return 'FEEDBEEF';
                        case 'date':
                            return '2016-01-01';
                        case 'date-time':
                            return '2016-01-01T00:00:00Z';
                        case 'password':
                            return '******';
                        default:
                            return 'Mock';
                    }
                case 'boolean':
                    return true;
                default:
                    return null;
            }
        }
    }
}


function mockgen(objectSchema, indent) {
    var mock = jsFriendlyJSONStringify(genObject(objectSchema), null, 4);
    if (indent) {
        if (typeof(indent) === 'number') {
            mock = mock.replace(/\n/g, '\n' + ' '.repeat(indent));
        } else {
            mock = mock.replace(/\n/g, '\n' + indent);
        }
    }
    return mock;
}

module.exports = mockgen;
