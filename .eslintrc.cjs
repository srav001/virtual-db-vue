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
		'plugin:@typescript-eslint/recommended',
		'plugin:vue/vue3-recommended',
		'prettier'
	],
	rules: {
		'no-console': process.env.NODE_ENV === 'production' ? 'off' : 'warn',
		'no-debugger': process.env.NODE_ENV === 'production' ? 'off' : 'warn',
		'@typescript-eslint/no-explicit-any': 2,
		'@typescript-eslint/consistent-type-imports': 2,
		'@typescript-eslint/consistent-type-exports': 2
	},
	settings: {
		'import/resolver': {
			typescript: {}
		}
	},
	parser: 'vue-eslint-parser',
	parserOptions: {
		parser: '@typescript-eslint/parser',
		ecmaVersion: 'latest'
	}
};
