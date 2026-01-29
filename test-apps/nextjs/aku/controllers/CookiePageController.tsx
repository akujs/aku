/** @jsxImportSource @akujs/aku/view **/
import type { Controller } from "@akujs/aku/http";
import { raw } from "@akujs/aku/view";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Layout } from "../components/Layout";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const clientScript = readFileSync(join(__dirname, "../public/client.js"), "utf-8");

export const CookiePageController: Controller = ({ url }) => {
	return <CookiePageView currentPath={url.pathname} />;
};

const CookiePageView = ({ currentPath }: { currentPath: string }) => (
	<Layout currentPath={currentPath}>
		<h2>Cookie API Test</h2>

		<div style="margin-bottom: 20px;">
			<label>
				Cookie Name:
				<input type="text" id="cookieName" style="margin-left: 10px;" />
			</label>
			<br />
			<label style="margin-top: 10px; display: inline-block;">
				Cookie Value:
				<input type="text" id="cookieValue" style="margin-left: 10px;" />
			</label>
		</div>

		<div style="margin-bottom: 20px;">
			<button onclick="getCookies()">Get Cookies</button>
			<button onclick="setCookie()" style="margin-left: 10px;">
				Set Cookie
			</button>
			<button onclick="deleteCookie()" style="margin-left: 10px;">
				Delete Cookie
			</button>
		</div>

		<h3>Response:</h3>
		<pre
			id="output"
			style="background: #f5f5f5; padding: 10px; border: 1px solid #ccc; min-height: 100px;"
		>
			Click a button to see API response
		</pre>

		<script>{raw(clientScript)}</script>
	</Layout>
);
