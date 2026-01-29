/** @jsxImportSource @akujs/aku/view **/
import type { Component, PropsWithChildren } from "@akujs/aku/view";

interface LayoutProps extends PropsWithChildren {
	currentPath: string;
}

export const Layout: Component<LayoutProps> = ({ children, currentPath }) => (
	<html>
		<head>
			<title>Aku Test App</title>
		</head>
		<body>
			<h1>Aku Test App</h1>
			<nav>
				<NavLink href="/aku/cookies" currentPath={currentPath}>
					Cookies
				</NavLink>{" "}
				|{" "}
				<NavLink href="/aku/storage" currentPath={currentPath}>
					Storage
				</NavLink>{" "}
				|{" "}
				<NavLink href="/aku/database" currentPath={currentPath}>
					Database
				</NavLink>
			</nav>
			<hr />
			{children}
		</body>
	</html>
);

interface NavLinkProps extends PropsWithChildren {
	href: string;
	currentPath: string;
}

const NavLink: Component<NavLinkProps> = ({ href, currentPath, children }) => {
	const isActive = currentPath.startsWith(href);
	return <a href={href}>{isActive ? <b>{children}</b> : children}</a>;
};
