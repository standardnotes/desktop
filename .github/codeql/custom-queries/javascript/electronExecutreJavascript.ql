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

select "hello world"
