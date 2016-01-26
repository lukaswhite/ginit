var fs = require('fs');
var path = require('path');

module.exports = {

  getCurrentDirectoryBase : function() {

    return path.basename( process.cwd() );

  },

  fileExists : function(filePath)
  {
    try
    {
  		return fs.statSync(filePath).isFile();
    }
    catch (err)
    {
  		return false;
    }
  },

  directoryExists : function(filePath)
  {
    try
    {
  		return fs.statSync(filePath).isDirectory();
    }
    catch (err)
    {
  		return false;
    }
  }
  
};