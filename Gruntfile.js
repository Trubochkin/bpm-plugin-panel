module.exports = (grunt) => {
    require('load-grunt-tasks')(grunt);

    var pkgJson = require('./package.json');

    grunt.loadNpmTasks('grunt-execute');
    grunt.loadNpmTasks('grunt-contrib-clean');

    grunt.initConfig({
        clean: {
            dist: 'dist',
            build: 'dist/build'
        },

        copy: {
            src_to_dist: {
                cwd: 'src',
                expand: true,
                src: ['!**/*.js', 'lib/**', 'partials/*'],
                dest: 'dist'
            },
            pluginDef: {
                expand: true,
                src: ['README.md'],
                dest: 'dist',
            },
            img_to_dist: {
                cwd: 'src',
                expand: true,
                src: ['img/**'],
                dest: 'dist/'
            },
        },

        'string-replace': {
            dist: {
                files: [{
                    cwd: 'src',
                    expand: true,
                    src: ['**/plugin.json'],
                    dest: 'dist'
                }],
                options: {
                    replacements: [{
                        pattern: '%VERSION%',
                        replacement: pkgJson.version
                    },{
                        pattern: '%TODAY%',
                        replacement: '<%= grunt.template.today("yyyy-mm-dd") %>'
                    }]
                }
            }
        },

        watch: {
            rebuild_all: {
                files: ['src/**/*', 'plugin.json', 'Gruntfile.js'],
                tasks: ['default'],
                options: {
                    spawn: false,
                    livereload: true
                }
            },
            sass: {
                files: {'dist/css/{,*/}*.{css}': 'src/style/{,*/}*.{scss,sass}'},
                tasks: ['sass']
            }
        },

        babel: {
            options: {
                sourceMap: true,
                // presets: ['es2015'],
                // presets: ['env'],
                // plugins: ['transform-es2015-modules-systemjs', 'transform-es2015-for-of', 'transform-class-properties', 'transform-object-rest-spread'],
            },
            dist: {
                files: [{
                    cwd: 'src',
                    expand: true,
                    src: ['*.js', '*/*.js'],
                    dest: 'dist',
                    ext: '.js'
                }]
            },
        },

        uglify: {
            options: {
                mangle: false,
                sourceMap: true,
            },
            my_target: {
                files: [
                    {src:'dist/build/module.js', dest: 'dist/module.js'},
                    {src:'dist/build/points.js', dest: 'dist/points.js'},
                    {src:'dist/build/charts-actions.js', dest: 'dist/charts-actions.js'},
                ]
            }
        },

        sass: {
            options: {
                sourceMap: true,
                outputStyle: 'expanded' // Values: nested, expanded, compact, compressed
            },
            dist: {
                files: {
                    'dist/css/bpm.dark.css': 'src/style/bpm.dark.scss',
                    'dist/css/bpm.light.css': 'src/style/bpm.dark.scss',
                }
            }
        },
    });

    grunt.loadNpmTasks('grunt-string-replace');
    grunt.loadNpmTasks('grunt-contrib-uglify'); // загружаем задачу
    grunt.registerTask('default', ['clean:dist', 'copy:src_to_dist', 'copy:pluginDef', 'copy:img_to_dist', 'string-replace', 'babel', 'sass', /* 'uglify', */ /* 'clean:build' */]);
};
