'use strict';

/**
 * Operations on <%=route.path%>
 */
module.exports = {
    <%_.forEach(route.methods, function (method, i) {%>
    /**
     * <%=method.description.trim()%>
     *
     * parameters: <%=method.parameters.map(function (p) { return p.name }).join(', ')%>
     * produces: <%=method.produces && method.produces.join(', ')%>
     */
    <%=method.method%>: function <%=method.name%>(req, res, next) {<%
        if (method.method === 'get' && method.produces && method.produces.indexOf('application/json') >= 0) {
            if (method.responses[200]) {
                if (method.responses[200].schema) {%>
        var body = <%=mockgen(method.responses[200].schema, 8) + ';'%><%
                } else {%>
        var body = {};<%
                }
            } else if (method.responses.default) {
                if (method.responses.default.schema) {%>
        var body = <%=mockgen(method.responses.default.schema, 8) + ';'%><%
                } else {%>
        var body = {};<%
                }%>
            } else {%>
        var body = {};<%
            }%>
        res.json(body);<%
        } else {%>
        next({status: 501, message: 'Not Implemented.'});<%
        }%>
    }<%if (i < route.methods.length - 1) {%>, <%}%>
    <%})%>
};
