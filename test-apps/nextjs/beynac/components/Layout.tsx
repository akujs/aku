/** @jsxImportSource beynac/view **/
import type { Component, PropsWithChildren } from "beynac/view";

interface LayoutProps extends PropsWithChildren {
	currentPath: string;
}

export const Layout: Component<LayoutProps> = ({ children, currentPath }) => (
	<html>
		<head>
			<title>Beynac Test App</title>
		</head>
		<body>
			<h1>Beynac Test App</h1>
			<nav>
				<NavLink href="/beynac/cookies" currentPath={currentPath}>
					Cookies
				</NavLink>{" "}
				|{" "}
				<NavLink href="/beynac/storage" currentPath={currentPath}>
					Storage
				</NavLink>{" "}
				|{" "}
				<NavLink href="/beynac/database" currentPath={currentPath}>
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
