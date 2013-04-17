module.exports = function(grunt) {
	grunt.initConfig({
		allFiles: ['src/**/*.js'],
		pkg: grunt.file.readJSON('package.json'),
		concat: {
			options: {
				separator: '\n\n'
			},
			node: {
				src: ['src/server/intro.js', 'src/index.js', 'src/proto.js', 'src/route.js', 'src/server/server.js', 'src/utils.js', 'src/server/outro.js'],
		        dest: 'build/<%= pkg.name %>.js'
			},
			client: {
				src: ['src/client/intro.js', 'src/index.js', 'src/proto.js', 'src/route.js', 'src/client/client.js', 'src/utils.js', 'src/client/outro.js'],
		        dest: 'build/<%= pkg.name %>-client.js'
			}
		},
		uglify: {
			options: {
				banner: '/*! <%= pkg.name %> <%= grunt.template.today("dd-mm-yyyy") %> */\n'
			},
			browser:  {
				files: {'build/<%= pkg.name %>.min.js': ['<%= concat.client.dest %>']}
			}
		},
		mochaTest: {
			node: ['test/base.js'],
			client: ['test/server-test.js']
		},
		watch: {
			files: ['<%= allFiles %>'],
			tasks: ['concat', 'mochaTest', 'uglify']
		}
	});
	
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-mocha-test');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-watch');
	
	grunt.registerTask('default', ['concat', 'mochaTest', 'uglify']);
	grunt.registerTask('test', ['mochaTest']);
};