import * as path from "node:path";

type DockerService = "minio";

export const MINIO_ROOT_USER = "minioadmin";
export const MINIO_ROOT_PASSWORD = "minioadmin";
const MINIO_PORT = 22855;
export const MINIO_ENDPOINT: string = `http://localhost:${MINIO_PORT}`;

/**
 * Cache of services that have successfully responded to health checks.
 * Once a service responds, we assume it's up for the rest of the test run.
 */
const verifiedServices = new Set<DockerService>();

export function shouldSkipDockerTests(): boolean {
	return process.env.SKIP_DOCKER_INTEGRATION_TESTS === "1";
}

export async function ensureDockerServicesRunning(services: DockerService[]): Promise<void> {
	const serviceStatus = await Promise.all(
		services.map(async (service) => ({
			service,
			started: verifiedServices.has(service) || (await isServiceRunning(service)),
		})),
	);

	const servicesNotRunning = serviceStatus
		.filter((check) => !check.started)
		.map((check) => check.service);

	if (servicesNotRunning.length === 0) {
		return;
	}

	const packageRoot = path.resolve(__dirname, "../..");
	const serviceList = servicesNotRunning.join(", ");

	throw new Error(
		`Required services are not running: ${serviceList}\n\n` +
			`Please start them with:\n` +
			`  cd ${packageRoot}\n` +
			`  docker compose up -d\n\n` +
			`Or skip Docker tests by setting: SKIP_DOCKER_INTEGRATION_TESTS=1`,
	);
}

async function isServiceRunning(service: DockerService): Promise<boolean> {
	switch (service) {
		case "minio":
			return await isMinioRunning();
	}
}

async function isMinioRunning(): Promise<boolean> {
	try {
		const response = await fetch(`${MINIO_ENDPOINT}/minio/health/live`, {
			signal: AbortSignal.timeout(1000),
		});
		if (response.ok) {
			verifiedServices.add("minio");
		}
		return response.ok;
	} catch {
		return false;
	}
}
