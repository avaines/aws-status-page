const statusPageGenerator = require('./statusPageGenerator');

exports.handler = async (event, context) => {
  return await statusPageGenerator.handler(event, context);
};