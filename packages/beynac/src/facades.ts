// GENERATED CODE DO NOT EDIT!
// Run `bun regenerate-exports` to regenerate this file
import { createFacade } from "./core/facade";
import { Container as ContainerContract } from "./container/contracts/Container";
import { Application as ApplicationContract } from "./core/contracts/Application";
import { Configuration as ConfigurationContract } from "./core/contracts/Configuration";
import { Dispatcher as DispatcherContract } from "./core/contracts/Dispatcher";
import { Cookies as CookiesContract } from "./http/contracts/Cookies";
import { Headers as HeadersContract } from "./http/contracts/Headers";
import { KeepAlive as KeepAliveContract } from "./http/contracts/KeepAlive";
import { RequestLocals as RequestLocalsContract } from "./http/contracts/RequestLocals";
import { Storage as StorageContract } from "./storage/contracts/Storage";
import { ViewRenderer as ViewRendererContract } from "./view/contracts/ViewRenderer";

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
