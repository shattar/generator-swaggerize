'use strict';

var test = require('tape'),
    path = require('path'),
    express = require('express'),
    enjoi = require('enjoi'),
    swaggerize = require('swaggerize-express'),
    SwaggerParser = require('swagger-parser'),
    request = require('supertest');

test('api', function (t) {
    var app = express();

    <%_.forEach(operations, function (operation) { if (operation.method.toLowerCase() === 'post' || operation.method.toLowerCase() === 'put') { %>
    app.use(require('body-parser').json());<%}});%>

    app.use(swaggerize({
        api: path.join(__dirname, './<%=apiPath.replace(/\\/g, "/")%>'),
        handlers: path.join(__dirname, '<%=handlersPath.replace(/\\/g, "/")%>')
    }));

    <%_.forEach(operations, function (operation) {%>
    t.test('test <%=operation.method%> <%=operation.path%>', function (t) {
        <%
        var testPath = operation.path;
        var bodySchema;
        if (operation.parameters && operation.parameters.length) {
            _.forEach(operation.parameters, function (param) {
                if (param.in === 'path') {
                    testPath = testPath.replace(/{([^}]*)}*/, function (p1, p2) {
                        switch (param.type) {
                            case 'integer':
                            case 'number':
                            case 'byte':
                                return 1;
                            case 'string':
                                return 'helloworld';
                            case 'boolean':
                                return true;
                            default:
                                return '{' + p2 + '}';
                        }
                    });
                } else if (param.in === 'body' && param.schema) {
                    bodySchema = param.schema;
                }
            });
        }
        var sendBody = bodySchema && ['post', 'put'].indexOf(operation.method.toLowerCase()) >= 0;
        %>
        SwaggerParser.dereference(path.join(__dirname, './<%=apiPath.replace(/\\/g, "/")%>')).then(function(api) {
            var expectedResponses = api.paths['<%=operation.path%>']['<%=operation.method%>'].responses;
            <%if (sendBody) {%>
            var body = <%=mockgen(bodySchema, 12) + ';'%><%}%>
            request(app)
                .<%=operation.method.toLowerCase()%>('<%=resourcePath%><%=testPath%>')<%if (sendBody) {%>
                .send(body)<%}%>
                .end(function(err, res) {
                    if (err) {
                        t.end(err);
                    } else {
                        var expectedResponse = expectedResponses[res.statusCode] || expectedResponses['default'];
                        if (expectedResponse) {
                            t.pass('Response status code accepted.');
                            if (expectedResponse.schema) {
                                enjoi(expectedResponse.schema).validate(res.body, function(error) {
                                    t.end(error);
                                });
                            } else {
                                t.end();
                            }
                        } else {
                            t.end('Response status code, ' + res.statusCode + ', not defined in schema.');
                        }
                    }
                });
        }).catch(function(err) {
            t.end(err);
        });
    });
    <%});%>
});
