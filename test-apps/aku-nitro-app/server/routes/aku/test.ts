export default defineEventHandler((event) => {
	const name = getRouterParam(event, 'name');
	const age = getRouterParam(event, 'age');
	return `Aku Test ${name} is ${age} years old`;
});
