var clear 			= require('clear');
var chalk 			= require('chalk');
var figlet 			= require('figlet');
var inquirer 		= require('inquirer');
var GitHubApi 	= require('github');
var Preferences = require('preferences');
var CLI 				= require('clui');
var Spinner 		= CLI.Spinner;
var git 				= require('simple-git')();
var _ 					= require('lodash');
var fs 					= require('fs');
var path 				= require('path');
var touch 			= require('touch');
var files 			= require('./lib/files');

/**************************************************
 * Display message
 *************************************************/
clear();
console.log(chalk.yellow(figlet.textSync('Ginit', {    
	horizontalLayout: 'full'  
})));

/**************************************************
 * Check that this isn't already a Git repo
 *************************************************/
if (files.directoryExists('.git')) {
	console.log(chalk.red( 'Already a git repository!'));
	process.exit();
}

var github = new GitHubApi({
	version: '3.0.0'
});

function createGitignore( callback ) {

	var filelist = _.without(fs.readdirSync('.'), '.git', '.gitignore');

	if ( filelist.length ) {

		inquirer.prompt( 
			[
				{
					type: 'checkbox',
					name: 'ignore',
					message: 'Select the files and/or folders you wish to ignore:',
					choices: filelist,
					default: [ 'node_modules', 'bower_components' ]
				}
			], 
			function( answers ) {

				if ( answers.ignore.length ) {			
					
					fs.writeFileSync( '.gitignore', answers.ignore.join( '\n' ) );

				} else {
					
					touch( '.gitignore' );	

				}

				return callback();

			}
		);

	} else {
		touch( '.gitignore' );
		return callback();
	}

}

function getGithubCredentials( callback ) {
	
	var questions = [  	  
	  {
	    type: 'input',
	    name: 'username', 
	    message: 'Enter your Github username or e-mail address:',
	    validate: function( value ) {      
	      if ( value.length ) {
	        return true;
	      } else {
	        return 'Please enter your username or e-mail address';
	      }
	    }
	  },
	  {
	    type: 'password',
	    name: 'password',
	    message: 'Enter your password:',
	    validate: function( value ) {      
	      if ( value.length ) {
	        return true;
	      } else {
	        return 'Please enter your password';
	      }
	    }
	  }
	];

	inquirer.prompt( questions, callback );
}

function getGithubToken( callback ) {

	var prefs = new Preferences('ginit');

	if ( prefs.github && prefs.github.token ) {		
		return callback( null, prefs.github.token );
	}

	getGithubCredentials( function( credentials ) {
		
		var status = new Spinner('Authenticating you, please wait...');
		status.start();
 
		github.authenticate(
			_.extend(
				{
			  	type: 'basic',
				},
				credentials
			)
		);

		github.authorization.create({
			scopes: [ 'user', 'public_repo', 'repo', 'repo:status' ],
			note: 'ginit, the command-line tool for initalizing Git repos'	
		}, function(err, res) {
			status.stop();
			if ( err ) {				
				return callback( err );
			}
			console.log( res );
			if ( res.token ) {				
				prefs.github = {
					token : res.token
				};				
		  	return callback( null, res.token ); 
		  }
		  return callback();
		});

	});

}

function githubAuth( callback ) {

	getGithubToken( function( err, token ){
		if ( err ) {
			return callback( err );
		}
		github.authenticate({
			type : 'oauth',
			token : token
		});
		return callback( null, token );
	})

}

function createRepo( callback ) {

	var questions = [  	  
	  {
	    type: 'input',
	    name: 'name', 
	    message: 'Enter a name for the repository:',
	    default: path.basename( process.cwd() ),
	    validate: function( value ) {      
	      if ( value.length ) {
	        return true;
	      } else {
	        return 'Please enter a name for the repository';
	      }
	    }
	  },
	  {
	    type: 'input',
	    name: 'description',
	    message: 'Optionally enter a description of the repository:'	    
	  },
	  {
	    type: 'list',
	    name: 'visibility',
	    message: 'Public or private:',
	    choices: [ 'public', 'private' ],
	    default: 'public'	    
	  }
	];


	inquirer.prompt( questions, function( answers ) {

		var status = new Spinner('Creating repository...');
		status.start();

		var data = {
			name : answers.name,
			description : answers.description,
			private : ( answers.visibility === 'private' )
		};

		github.repos.create(
		  data,
		  function( err, res ) {
		  	status.stop();
		  	if ( err ) {
		  		return callback( err );
		  	}
		  	return callback( null, res.ssh_url );		  	
		  }
		);

	});

}


function setupRepo( url, callback ) {
	
	var status = new Spinner('Setting up the repository...');
	status.start();

	git 		
		.init()		
		.add('.gitignore')
		.add('./*')
		.commit('Initial commit')			
		.addRemote( 'origin', url )
		.push('origin', 'master')
		.then(function(){
			status.stop();
			return callback();
		});
}

/**************************************************
 * The main app code; start by seeing whether we have
 * a pre-existing Github OAuth code.
 *************************************************/
githubAuth( function( err, authed ) {	
	if ( err ) {
		switch ( err.code ) {
			case 401:
				console.log( chalk.red('Couldn\'t log you in. Please try again.') );
				break;
			case 422:
				console.log( chalk.red('You already have an access token.') );
				break;
		}
	}
	if ( authed ) {
		console.log( chalk.green('Sucessfully authenticated!') );		
		createRepo( function( err, url ){
			if ( err ) {
				console.log('An error has occured');
			}			
			if ( url ) {
				createGitignore( function() {			
					setupRepo( url, function( err ) {
						if ( !err ) {
							console.log(chalk.green('All done!'));
						}
					});							
				});
			}
		});
	}
});
