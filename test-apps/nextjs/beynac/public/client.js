// Client-side API interaction script for cookie management

async function callApi(method, path, body = null) {
	const output = document.getElementById("output");
	try {
		const options = {
			method,
			headers: body ? { "Content-Type": "application/json" } : {},
		};
		if (body) {
			options.body = JSON.stringify(body);
		}

		const response = await fetch(path, options);
		const data = await response.json();

		const result = {
			status: response.status,
			headers: Object.fromEntries(response.headers.entries()),
			body: data,
		};

		output.textContent = JSON.stringify(result, null, 2);
	} catch (error) {
		output.textContent = `Error: ${error.message}`;
	}
}

function getCookies() {
	callApi("GET", "/beynac/api/cookies");
}

function setCookie() {
	const name = document.getElementById("cookieName").value;
	const value = document.getElementById("cookieValue").value;

	if (!name) {
		alert("Cookie name is required");
		return;
	}

	callApi("POST", "/beynac/api/cookies", { name, value });
}

function deleteCookie() {
	const name = document.getElementById("cookieName").value;

	if (!name) {
		alert("Cookie name is required");
		return;
	}

	callApi("DELETE", `/beynac/api/cookies/${encodeURIComponent(name)}`);
}
