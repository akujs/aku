// Works the same as functions but does not return anything
export default defineEventHandler((event) => {
	// Extends or modify the event
	event.context.user = { name: 'Nitro' };

	event.context.myVar = 'My random string variable';
	// console.log('MIDDLEWARE LOGGED', event);
	// Event includes the Node request and response
	console.log('REQUEST CONTEXT', event.context);
});
