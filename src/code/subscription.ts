import { ref, readonly } from 'vue';
type Options = Record<string, unknown>;

export function useSubscription<T>(value: T, options?: Options) {
	if (options) {
		//TODO: To add features
	}
	if (value === undefined) {
		throw new Error('No value provided');
	}
	const _subRef = ref(value);
	const _subscriptions: Set<Function> = new Set();
	const _reactiveOverrider: {
		value: (typeof _subRef)['value'];
		subscriber: (val: (typeof _subRef)['value']) => void;
	} = {
		get value() {
			return _subRef.value;
		},
		set value(val) {
			_subRef.value = val;
			_subscriptions.forEach(dep => dep(val));
		},
		set subscriber(customEffect: () => void) {
			_subscriptions.add(customEffect);
		}
	};

	return { $sub: _reactiveOverrider, subRef: readonly(_subRef) };
}
