export default defineEventHandler((event) => {
	const path = getRouterParam(event, 'path');
	const url = getRequestURL(event);

	return `A catch all path here ${path} and URL is ${url}!`;
});
