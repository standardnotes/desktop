/**
 * @id javascript/call-to-electron-webcontents-execute-javascript
 * @name Use of webContents.executeJavascript
 * @description Finds dangerous calls to webContents.executeJavascript
 * @kind problem
 * @problem.severity warning
 * @precision high
 * @tags correctness
 */

import javascript

from CallExpr c
where c.getCalleeName() = "executeJavaScript"
select c, "Call to 'executeJavascript()' detected."
