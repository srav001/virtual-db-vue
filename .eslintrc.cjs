module.exports = {
	root: true,
	env: {
		browser: true,
		es6: true
	},
	plugins: ['@typescript-eslint', 'sonarjs'],
	extends: [
		'eslint:recommended',
		'plugin:sonarjs/recommended',
		'plugin:vue/vue3-recommended',
		'@vue/eslint-config-typescript/recommended',
		'prettier'
	],
	settings: {
		'import/resolver': {
			typescript: {}
		}
	},
	parserOptions: {
		ecmaVersion: 'latest'
	},
	rules: {
		'no-console': 'warn',
		'no-debugger': 'warn',
		'@typescript-eslint/consistent-type-exports': 2,
		'@typescript-eslint/no-explicit-any': ['error', { ignoreRestArgs: true }]
	}
};
