/**
 * @id javascript/call-to-electron-webcontents-execute-javascript
 * @name Use of webcontents.executeJavascript
 * @description Finds dangerous calls to webcontents.executeJavascript
 * @kind problem
 * @problem.severity warning
 * @precision very-high
 * @tags correctness
 */

import javascript

from CallExpr c
where c.getCalleeName() = "executeJavaScript"
select c
