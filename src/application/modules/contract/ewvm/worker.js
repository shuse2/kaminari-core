const path = require('path');
 
if (__dirname.includes('src')) {
	require('ts-node').register();
	require(path.resolve(__dirname, './executer.ts'));
} else {
	require(path.resolve(__dirname, './executer.js'));
}