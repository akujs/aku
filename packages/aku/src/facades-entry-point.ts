// GENERATED CODE DO NOT EDIT!
// Run `bun codegen` to regenerate this file
import { createFacade } from "./core/facade.ts";
import { Terminal as TerminalContract } from "./cli/contracts/Terminal.ts";
import { Container as ContainerContract } from "./container/contracts/Container.ts";
import { Application as ApplicationContract } from "./core/contracts/Application.ts";
import { Configuration as ConfigurationContract } from "./core/contracts/Configuration.ts";
import { Dispatcher as DispatcherContract } from "./core/contracts/Dispatcher.ts";
import { Database as DatabaseContract } from "./database/contracts/Database.ts";
import { Cookies as CookiesContract } from "./http/contracts/Cookies.ts";
import { Headers as HeadersContract } from "./http/contracts/Headers.ts";
import { KeepAlive as KeepAliveContract } from "./http/contracts/KeepAlive.ts";
import { RequestLocals as RequestLocalsContract } from "./http/contracts/RequestLocals.ts";
import { Storage as StorageContract } from "./storage/contracts/Storage.ts";
import { ViewRenderer as ViewRendererContract } from "./view/contracts/ViewRenderer.ts";

/**
 * Facade for Terminal
 */
export const Terminal: TerminalContract = createFacade(TerminalContract);

/**
 * Facade for Container
 */
export const Container: ContainerContract = createFacade(ContainerContract);

/**
 * Facade for Application
 */
export const Application: ApplicationContract = createFacade(ApplicationContract);

/**
 * Facade for Configuration
 */
export const Configuration: ConfigurationContract = createFacade(ConfigurationContract);

/**
 * Facade for Dispatcher
 */
export const Dispatcher: DispatcherContract = createFacade(DispatcherContract);

/**
 * Facade for Database
 */
export const Database: DatabaseContract = createFacade(DatabaseContract);

/**
 * Facade for Cookies
 */
export const Cookies: CookiesContract = createFacade(CookiesContract);

/**
 * Facade for Headers
 */
export const Headers: HeadersContract = createFacade(HeadersContract);

/**
 * Facade for KeepAlive
 */
export const KeepAlive: KeepAliveContract = createFacade(KeepAliveContract);

/**
 * Facade for RequestLocals
 */
export const RequestLocals: RequestLocalsContract = createFacade(RequestLocalsContract);

/**
 * Facade for Storage
 */
export const Storage: StorageContract = createFacade(StorageContract);

/**
 * Facade for ViewRenderer
 */
export const ViewRenderer: ViewRendererContract = createFacade(ViewRendererContract);
